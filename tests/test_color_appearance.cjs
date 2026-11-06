"use strict";

// Mounted DOM contracts; the small owner model follows finishEditor closing
// the nested owner before invoking its captured save callback. No browser/GUI.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const sources = ["color-values", "color-appearance"].map(
    (name) =>
        ts.transpileModule(
            fs.readFileSync(path.join(root, "src/ui", name + ".ts"), "utf8"),
            {
                compilerOptions: {
                    module: ts.ModuleKind.None,
                    target: ts.ScriptTarget.ES5,
                },
            }
        ).outputText
);

function fixture(t, overrides = {}) {
    const dom = new JSDOM(
        '<div id="listCaption"></div><div id="listDetail"></div><div id="listAbout" tabindex="-1"></div><div id="listPodval"></div>',
        { runScripts: "outside-only" }
    );
    t.after(() => dom.window.close());
    const w = dom.window;
    const defaults = {
        accent: "#67E8F9",
        background: "#080C12",
        border: "#334155",
        epgTime: "#67E8F9",
        muted: "#94A3B8",
        selection: "#164E63",
        selectionText: "#FFFFFF",
        surface: "#111B2B",
        text: "#FFFFFF",
    };
    const state = {
        allowSet: true,
        editor: true,
        input: null,
        owner: true,
        parent: true,
        restoredPanels: 0,
        routed: [],
        savedPanels: 0,
        sets: [],
        shownPages: 0,
        top: "parent",
    };
    const values = {
        uiColorConfig: JSON.stringify({ colors: overrides, version: 1 }),
    };
    const timers = new Map();
    let nextTimer = 0;
    const cleanups = [];
    const parent = {
        active: () => state.parent,
        foreground: () => state.parent && state.top === "parent",
    };
    const owner = {
        active: () => state.owner && state.parent,
        foreground: () => state.owner && state.parent && state.top === "about",
        own: (cleanup) => cleanups.push(cleanup),
    };
    const editor = {
        active: () => state.editor,
        get: (key) => values[key],
        set(key, value) {
            state.sets.push({ key, value });
            if (!state.allowSet) return false;
            values[key] = value;
            return true;
        },
    };
    Object.assign(w, {
        _: (text) => text,
        __ottClassicScreenPort: {
            dispatch(key, event) {
                state.routed.push({ event, key });
                return state.callback(key);
            },
            listOwner: () => parent,
            setOwnedCallback(kind, callback) {
                assert.equal(kind, "about");
                state.callback = callback;
                state.top = "about";
                return { owner };
            },
        },
        __ottInterfaceColors: {
            parse: (text) => JSON.parse(text),
            resolve: (config) => ({
                ...defaults,
                ...JSON.parse(config.uiColorConfig).colors,
            }),
            serialize: (colors) => JSON.stringify({ colors, version: 1 }),
        },
        __ottSettingsEditor: editor,
        $(node) {
            return {
                hide() {
                    node.style.display = "none";
                    return this;
                },
                show() {
                    node.style.display = "block";
                    return this;
                },
                text(value) {
                    node.textContent = value;
                    return this;
                },
            };
        },
        clearTimeout: (id) => timers.delete(id),
        keys: {
            DOWN: 40,
            ENTER: 13,
            EXIT: 88,
            GREEN: 71,
            LEFT: 37,
            RETURN: 27,
            RIGHT: 39,
            UP: 38,
        },
        restoreListPanelState() {
            state.restoredPanels++;
            state.top = "parent";
            state.owner = false;
            cleanups.forEach((cleanup) => cleanup());
        },
        saveListPanelState() {
            state.savedPanels++;
        },
        saveSettings() {
            assert.fail("color UI must not save the settings editor");
        },
        setTimeout(callback) {
            const id = ++nextTimer;
            timers.set(id, callback);
            return id;
        },
        showEditKey(key) {
            assert.equal(key, w.keys.ENTER);
            state.input = {
                caption: w.editCaption,
                initial: w.editvar,
                save: w.setEdit,
            };
            state.top = "editor";
        },
        showPage() {
            state.shownPages++;
        },
        stbSetItem() {
            assert.fail("color UI must not persist settings");
        },
    });
    sources.forEach((source) => w.eval(source));
    const panel = w.document.getElementById("listAbout");
    const action = (id) => {
        const button = panel.querySelector('[data-color-action="' + id + '"]');
        assert.ok(button, "mounted action " + id);
        return button;
    };
    return {
        action,
        click: (id) => action(id).click(),
        colors: () => JSON.parse(values.uiColorConfig).colors,
        flush() {
            const pending = [...timers.values()];
            timers.clear();
            pending.forEach((callback) => callback());
        },
        key(key) {
            const event = new w.KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key,
            });
            panel.dispatchEvent(event);
            return event;
        },
        open: () => w.__ottColorAppearance.open(editor),
        panel,
        state,
        submit(text, save = true) {
            assert.equal(state.top, "editor");
            const captured = state.input.save;
            w.editvar = text;
            state.top = "about";
            if (save) captured();
        },
        values,
        w,
    };
}

test("mounted palette edits only local preview; Apply writes the owning draft once", (t) => {
    const f = fixture(t);
    assert.equal(f.open(), true);
    const detachedApply = f.action("apply");
    f.click("swatch-EF4444");
    detachedApply.click();
    assert.equal(
        f.panel.querySelector("[data-color-preview]").style.color,
        "rgb(239, 68, 68)"
    );
    assert.deepEqual(f.state.sets, []);
    assert.deepEqual(f.colors(), {});
    f.click("apply");
    assert.equal(f.state.sets.length, 1);
    assert.equal(f.state.sets[0].key, "uiColorConfig");
    assert.deepEqual(f.colors(), { text: "#EF4444" });
    assert.equal(f.panel.style.display, "none");
    assert.equal(f.state.savedPanels, 1);
    assert.equal(f.state.restoredPanels, 1);
    assert.equal(f.state.shownPages, 1);
});

test("Cancel and Return discard local scheme changes; Reset waits for Apply", (t) => {
    for (const close of ["cancel", "return"]) {
        const f = fixture(t, { text: "#123456" });
        f.open();
        f.click("scheme-1");
        if (close === "cancel") f.click("cancel");
        else f.state.callback(f.w.keys.RETURN);
        assert.deepEqual(f.state.sets, []);
        assert.deepEqual(f.colors(), { text: "#123456" });
    }
    const f = fixture(t, { accent: "#ABCDEF", text: "#123456" });
    f.open();
    f.click("reset");
    assert.deepEqual(f.state.sets, []);
    assert.deepEqual(f.colors(), { accent: "#ABCDEF", text: "#123456" });
    f.click("apply");
    assert.deepEqual(f.colors(), {});
});

test("nested HEX, RGB and HSV use strict actual conversions and preserve role", (t) => {
    for (const [kind, invalid, valid, expected] of [
        ["hex", "#fff; color:red", "#abc", "#AABBCC"],
        ["rgb", "256, 0, 1", "1, 2, 3", "#010203"],
        ["hsv", "120, 101, 50", "120, 100, 50", "#008000"],
    ]) {
        const f = fixture(t);
        f.open();
        f.click("role-accent");
        f.click(kind);
        assert.ok(
            f.state.input.caption.includes(
                kind === "hsv"
                    ? "Hue, Saturation, Brightness"
                    : kind.toUpperCase()
            )
        );
        f.submit(invalid);
        f.flush();
        assert.equal(
            f.panel.querySelector('[role="status"]').textContent,
            "Invalid color value"
        );
        assert.deepEqual(f.state.sets, []);
        f.click(kind);
        f.submit(valid);
        f.flush();
        assert.equal(f.panel.querySelector('[role="status"]').textContent, "");
        f.click("apply");
        assert.deepEqual(f.colors(), { accent: expected });
    }
});

test("nested Cancel discards input and late callbacks cannot write a retired draft", (t) => {
    const f = fixture(t, { text: "#123456" });
    f.open();
    f.click("hex");
    f.submit("#ABCDEF", false);
    f.click("apply");
    assert.deepEqual(f.colors(), { text: "#123456" });
    for (const revoke of [
        (f) => {
            f.state.parent = false;
        },
        (f) => {
            f.state.editor = false;
        },
        (f) => {
            f.state.owner = false;
        },
        (f) => {
            f.w.__ottSettingsEditor = {};
        },
    ]) {
        const g = fixture(t);
        g.open();
        g.click("hex");
        const apply = g.action("apply");
        revoke(g);
        g.submit("#FF0000");
        apply.click();
        assert.deepEqual(g.state.sets, []);
    }
});

test("arrow grid and Enter route the original keyboard event; pointer uses the same mounted action", (t) => {
    const f = fixture(t);
    const scrolled = [];
    f.w.HTMLElement.prototype.scrollIntoView = function (options) {
        scrolled.push(options);
        if (typeof options === "object")
            throw new TypeError("legacy signature");
    };
    f.open();
    assert.equal(scrolled[1], false, "legacy scroll signature remains usable");
    assert.equal(f.w.document.activeElement, f.action("role-background"));
    const event = f.key("ArrowRight");
    assert.equal(event.defaultPrevented, true);
    assert.equal(f.state.routed[0].event, event);
    assert.equal(f.state.routed[0].key, f.w.keys.RIGHT);
    assert.equal(f.w.document.activeElement, f.action("role-surface"));
    f.key("ArrowDown");
    assert.equal(f.w.document.activeElement, f.action("role-accent"));
    f.key("Enter");
    assert.equal(f.action("role-accent").getAttribute("aria-pressed"), "true");
    const swatch = f.action("swatch-22C55E");
    const tap = new f.w.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
    });
    swatch.dispatchEvent(tap);
    assert.equal(tap.defaultPrevented, true);
    assert.deepEqual(f.state.sets, []);
    f.click("apply");
    assert.deepEqual(f.colors(), { accent: "#22C55E" });
});

test("fifth scheme remains reachable in the wrapped keyboard row", (t) => {
    const f = fixture(t);
    f.open();
    f.action("scheme-0").focus();
    f.key("ArrowDown");
    assert.equal(f.w.document.activeElement, f.action("scheme-4"));
    f.key("Enter");
    assert.deepEqual(f.state.sets, []);
    f.click("apply");
    assert.equal(Object.keys(f.colors()).length, 9);
});

test("covered owner and refused draft write do not close or persist settings", (t) => {
    const f = fixture(t);
    f.open();
    f.click("hex");
    f.action("apply").click();
    assert.deepEqual(f.state.sets, []);
    f.submit("#ABCDEF");
    f.state.allowSet = false;
    f.click("apply");
    assert.equal(f.state.sets.length, 1);
    assert.deepEqual(f.colors(), {});
    assert.equal(f.state.restoredPanels, 0);
    assert.equal(
        f.panel.querySelector('[role="status"]').textContent,
        "Settings could not be saved"
    );
});

function loaderFixture() {
    const text = fs.readFileSync(
        path.join(root, "src/ui/subtitle-appearance.ts"),
        "utf8"
    );
    const parsed = ts.createSourceFile(
        "subtitle-appearance.ts",
        text,
        ts.ScriptTarget.Latest,
        true
    );
    const pieces = [];
    function visit(node) {
        if (
            (ts.isFunctionDeclaration(node) &&
                node.name?.text === "openColors") ||
            (ts.isVariableStatement(node) &&
                node.declarationList.declarations.some((item) =>
                    ["colorLoading", "colorOpen"].includes(
                        item.name.getText(parsed)
                    )
                ))
        ) {
            pieces.push(node.getText(parsed));
            return;
        }
        ts.forEachChild(node, visit);
    }
    visit(parsed);
    assert.equal(
        pieces.length,
        3,
        "actual loader and both owned state declarations"
    );
    const state = {
        active: true,
        foreground: true,
        notices: [],
        opened: 0,
        scripts: [],
        timers: new Map(),
    };
    const editor = { active: () => state.active };
    const parent = { foreground: () => state.foreground };
    const head = {
        appendChild(script) {
            script.parentNode = head;
            state.scripts.push(script);
        },
        removeChild(script) {
            script.parentNode = null;
        },
    };
    let nextTimer = 0;
    const host = {
        _: (value) => value,
        __cv: "1.1.66",
        __ottActiveProviderDriver: {},
        __ottClassicScreenPort: { listOwner: () => parent },
        __ottSettingsEditor: editor,
        __ottStandby: { blocked: () => false },
        clearTimeout: (id) => state.timers.delete(id),
        document: { createElement: () => ({}), head },
        hostUrl: "https://player.example/",
        p_pref: "profile-a",
        setTimeout(callback) {
            const id = ++nextTimer;
            state.timers.set(id, callback);
            return id;
        },
        showShift: (value) => state.notices.push(value),
    };
    const code = ts.transpileModule(pieces.join("\n"), {
        compilerOptions: {
            module: ts.ModuleKind.None,
            target: ts.ScriptTarget.ES5,
        },
    }).outputText;
    const context = { host };
    vm.createContext(context);
    vm.runInContext(code, context);
    return {
        host,
        open: () => context.openColors(),
        ready() {
            host.__ottColorAppearance = {
                open(actual) {
                    assert.equal(actual, editor);
                    state.opened++;
                    return true;
                },
            };
            state.scripts.at(-1).onload();
        },
        state,
    };
}

test("actual color loader is lazy, coalesces requests and ignores expired completion", () => {
    const f = loaderFixture();
    assert.equal(f.state.scripts.length, 0);
    f.open();
    f.open();
    assert.equal(f.state.scripts.length, 1);
    assert.equal(
        f.state.scripts[0].src,
        "https://player.example/dist/color-appearance.js?1.1.66"
    );
    const late = f.state.scripts[0].onload;
    [...f.state.timers.values()][0]();
    assert.deepEqual(f.state.notices, ["Failed to load!"]);
    assert.equal(f.state.scripts[0].parentNode, null);
    f.open();
    assert.equal(f.state.scripts.length, 2);
    late();
    assert.equal(f.state.opened, 0);
    f.ready();
    assert.equal(f.state.opened, 1);
    assert.equal(f.state.timers.size, 0);
});

test("actual color loader rejects late owner, profile, driver or standby replacement", () => {
    for (const revoke of [
        (f) => {
            f.state.active = false;
        },
        (f) => {
            f.state.foreground = false;
        },
        (f) => {
            f.host.__ottSettingsEditor = {};
        },
        (f) => {
            f.host.p_pref = "profile-b";
        },
        (f) => {
            f.host.__ottActiveProviderDriver = {};
        },
        (f) => {
            f.host.__ottStandby.blocked = () => true;
        },
    ]) {
        const f = loaderFixture();
        f.open();
        revoke(f);
        f.ready();
        assert.equal(f.state.opened, 0);
        assert.deepEqual(f.state.notices, []);
    }
});

test("fixed visual rows retain remote columns and localized text stays separate from LTR values", (t) => {
    const f = fixture(t);
    f.w._ = (text) => "א " + text;
    f.w.renderButtonHint = (key, icon, text) =>
        '<span data-hint="' + key + '">' + text + "</span>";
    const showEditor = f.w.showEditKey;
    f.w.showEditKey = (key) => {
        for (const id of ["editvar", "ee"]) {
            const node = f.w.document.createElement(
                id === "editvar" ? "input" : "div"
            );
            node.id = id;
            f.w.document.body.appendChild(node);
        }
        showEditor(key);
    };
    f.open();
    const grid = f.action("swatch-FFFFFF").closest("table");
    assert.ok(grid, "swatch layout is available without flex, grid or calc");
    assert.equal(grid.getAttribute("role"), "presentation");
    assert.equal(grid.dir, "ltr");
    assert.equal(grid.style.tableLayout, "fixed");
    assert.equal(grid.rows.length, 4);
    for (const row of grid.rows) assert.equal(row.cells.length, 8);
    assert.equal(f.action("role-text").dir, "auto");
    assert.equal(f.panel.querySelector("p").dir, "auto");
    assert.equal(f.action("hex").dir, "ltr");
    assert.equal(f.action("rgb").dir, "ltr");
    assert.equal(f.action("hsv").dir, "ltr");
    const footer = f.w.document.getElementById("listPodval");
    assert.equal(footer.querySelectorAll("[data-hint]").length, 2);
    assert.doesNotMatch(footer.textContent, /changes to this draft/);
    f.click("hex");
    assert.equal(f.w.document.getElementById("editvar").dir, "ltr");
    assert.equal(f.w.document.getElementById("ee").dir, "ltr");
});
