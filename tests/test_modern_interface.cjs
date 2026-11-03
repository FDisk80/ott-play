const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");
const { JSDOM } = require("jsdom");
const { settingsSource } = require("./helpers/settings-source-fixture.cjs");
const { compatibilitySource } = require("./helpers/english-source-fixture.cjs");

const root = path.resolve(__dirname, "..");
function compile(file) {
    return ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
        },
    }).outputText;
}
function settingsFixture(stored = new Map()) {
    const dom = new JSDOM("<main></main>", {
        runScripts: "outside-only",
        url: "https://example.invalid/",
    });
    const w = dom.window;
    const effects = [];
    let provider = "one";
    require("./helpers/shared-core-runtime.cjs")(dom.getInternalVMContext());
    Object.assign(w, require("./load-wire.cjs")());
    w.eval(compatibilitySource);
    const storage = {
        del: (key) => stored.delete(key),
        get: (key) => stored.get(key) ?? null,
        getI: (key, fallback) => {
            const value = Number.parseInt(stored.get(key), 10);
            return Number.isNaN(value) ? fallback : value;
        },
        set: (key, value) => stored.set(key, String(value)),
        setI: (key, value) => stored.set(key, String(value)),
    };
    Object.assign(w, {
        _: (value) => value,
        ott_device: "pc",
        p_pref: provider,
        providerDelItem: (key) => storage.del(provider + ":" + key),
        providerGetItem: (key) => storage.get(provider + ":" + key),
        providerSetItem: (key, value) =>
            storage.set(provider + ":" + key, value),
        setInterfaceMode: () => effects.push("interface"),
        setPlayerMode: () => effects.push("player"),
        storage,
    });
    w.eval(settingsSource());
    w.loadSettings();
    return {
        dom,
        effects,
        provider(value) {
            provider = value;
            w.p_pref = value;
            w.loadProviderSettings(0);
        },
        stored,
        w,
    };
}

test("interface mode is opt-in and separate from the existing theme", () => {
    const f = settingsFixture();
    try {
        assert.equal(f.w.settings.interfaceMode, 0);
        assert.equal(f.w.settings.interfaceTheme, 2);
        assert.equal(f.stored.has("sInterfaceMode"), false);
        assert.equal(f.w.saveSettings({ interfaceMode: 1 }), true);
        assert.equal(f.w.settings.interfaceMode, 1);
        assert.equal(f.w.settings.interfaceTheme, 2);
        assert.deepEqual(f.effects, ["interface"]);
    } finally {
        f.dom.window.close();
    }
});

test("mode persists for this client across providers and a fresh session", () => {
    const stored = new Map();
    const f = settingsFixture(stored);
    try {
        assert.equal(f.w.saveSettings({ interfaceMode: 1 }), true);
        assert.equal(stored.get("sInterfaceMode"), "1");
        stored.set("two:sInterfaceMode", "0");
        f.provider("two");
        assert.equal(f.w.settings.interfaceMode, 1);
        assert.equal(f.w.sInterfaceMode, 1);
        assert.deepEqual(f.effects, ["interface"]);
    } finally {
        f.dom.window.close();
    }
    const next = settingsFixture(stored);
    try {
        assert.equal(next.w.settings.interfaceMode, 1);
        assert.equal(next.w.saveSettings({ interfaceMode: 0 }), true);
        next.provider("one");
        assert.equal(next.w.settings.interfaceMode, 0);
        assert.equal(stored.get("sInterfaceMode"), "0");
    } finally {
        next.dom.window.close();
    }
});

test("invalid modes cannot overwrite a valid setting or run effects", () => {
    const f = settingsFixture();
    try {
        assert.equal(f.w.saveSettings({ interfaceMode: 1 }), true);
        for (const value of [-1, 2, 0.5, NaN, null, "modern", {}, []]) {
            const effectsBefore = f.effects.length;
            assert.equal(f.w.saveSettings({ interfaceMode: value }), false);
            assert.equal(f.w.settings.interfaceMode, 1);
            assert.equal(f.stored.get("sInterfaceMode"), "1");
            assert.equal(f.effects.length, effectsBefore);
        }
    } finally {
        f.dom.window.close();
    }
});

function loaderFixture() {
    const dom = new JSDOM("<main></main>", {
        runScripts: "outside-only",
        url: "https://example.invalid/player/",
    });
    const w = dom.window;
    const timers = new Map();
    const notices = [];
    let sequence = 0;
    Object.assign(w, {
        __cv: "fixture version",
        clearTimeout: (id) => timers.delete(id),
        hostUrl: "https://example.invalid/player/",
        loadChannels: () => assert.fail("view mode must not reload the source"),
        setTimeout: (callback) => {
            const id = ++sequence;
            timers.set(id, callback);
            return id;
        },
        showPopup: (message) => notices.push(message),
        sInterfaceMode: 0,
        stopPlayer: () => assert.fail("view mode must not stop playback"),
    });
    w.eval(compile("src/ui/interface-mode.ts"));
    return {
        dom,
        notices,
        ready(refresh = () => {}) {
            w.__ottModernUi = { prepare() {}, refresh };
            const script = this.script();
            assert(script, "a module request must exist before completion");
            script.onload();
        },
        script: () => w.document.querySelector("script"),
        timers,
        w,
    };
}

test("Classic makes no optional request; concurrent Modern loads are coalesced", () => {
    const f = loaderFixture();
    try {
        assert.equal(f.script(), null);
        const results = [];
        f.w.__ottEnsureModernUi((value) => results.push(["first", value]));
        f.w.__ottEnsureModernUi((value) => results.push(["second", value]));
        assert.equal(f.w.document.querySelectorAll("script").length, 1);
        assert.equal(
            f.script().src,
            "https://example.invalid/player/dist/modern-interface.js?fixture%20version"
        );
        f.ready();
        assert.deepEqual(results, [
            ["first", true],
            ["second", true],
        ]);
        assert.equal(f.timers.size, 0);
        assert.equal(f.script(), null);
    } finally {
        f.dom.window.close();
    }
});

test("late optional load cannot undo a user's return to Classic", () => {
    const f = loaderFixture();
    let paints = 0;
    try {
        f.w.sInterfaceMode = 1;
        f.w.setInterfaceMode();
        assert.equal(f.w.__ottInterfaceModeState.status, "loading");
        f.w.sInterfaceMode = 0;
        f.w.setInterfaceMode();
        f.ready(() => paints++);
        assert.equal(f.w.__ottInterfaceModeState.status, "classic");
        assert.equal(f.w.__ottInterfaceModeState.effective, 0);
        assert.equal(
            f.w.document.body.classList.contains("interface-modern"),
            false
        );
        assert.equal(paints, 0);
    } finally {
        f.dom.window.close();
    }
});

for (const failure of [
    "error",
    "timeout",
    "incomplete-module",
    "unsupported",
]) {
    test(`${failure} keeps Classic usable and prevents retry storms`, () => {
        const f = loaderFixture();
        try {
            f.w.sInterfaceMode = 1;
            f.w.setInterfaceMode();
            if (failure === "timeout") [...f.timers.values()][0]();
            else if (failure === "error") f.script().onerror();
            else {
                if (failure === "unsupported")
                    f.w.__ottModernUi = {
                        prepare() {},
                        refresh() {
                            assert.fail("unsupported renderer cannot repaint");
                        },
                        supported: () => false,
                    };
                f.script().onload();
            }
            assert.equal(f.w.__ottInterfaceModeState.status, "fallback");
            assert.equal(f.w.__ottInterfaceModeState.effective, 0);
            assert.equal(
                f.w.document.body.classList.contains("interface-modern"),
                false
            );
            assert.equal(f.script(), null);
            assert.equal(f.timers.size, 0);
            f.w.setInterfaceMode();
            assert.equal(
                f.script(),
                null,
                "failure must not create a request loop"
            );
            f.w.sInterfaceMode = 0;
            f.w.setInterfaceMode();
            f.w.sInterfaceMode = 1;
            f.w.setInterfaceMode();
            assert(
                f.script(),
                "explicit Classic→Modern choice permits a retry"
            );
        } finally {
            f.dom.window.close();
        }
    });
}

test("successful mode changes only repaint and keep one renderer instance", () => {
    const f = loaderFixture();
    const paints = [];
    try {
        f.w.sInterfaceMode = 1;
        f.w.setInterfaceMode();
        f.ready(() => paints.push(f.w.__ottInterfaceModeState.effective));
        const renderer = f.w.__ottModernUi;
        assert.equal(f.w.__ottInterfaceModeState.status, "modern");
        assert.equal(
            f.w.document.body.classList.contains("interface-modern"),
            true
        );
        f.w.sInterfaceMode = 0;
        f.w.setInterfaceMode();
        f.w.sInterfaceMode = 1;
        f.w.setInterfaceMode();
        assert.deepEqual(paints, [1, 0, 1]);
        assert.equal(f.w.__ottModernUi, renderer);
        assert.equal(f.script(), null);
        assert.deepEqual(f.notices, []);
    } finally {
        f.dom.window.close();
    }
});

function rendererFixture() {
    const dom = new JSDOM(
        '<div id="listIn"></div><div id="listDetail"></div>',
        {
            runScripts: "outside-only",
            url: "https://example.invalid/",
        }
    );
    const w = dom.window;
    const container = w.document.getElementById("listIn");
    Object.defineProperties(container, {
        clientHeight: { value: 570 },
        clientWidth: { value: 760 },
    });
    Object.assign(w, {
        changeSelect(delta) {
            w.selIndex += delta;
        },
        changeVolume: () =>
            assert.fail("grid navigation must not adjust volume"),
        innerHeight: 720,
        innerWidth: 1280,
        isListVisible: true,
        loadChannels: () => assert.fail("renderer must not reload a source"),
        playChannel: () =>
            assert.fail("navigation must not activate a channel"),
        selIndex: 3450,
        settings: { interfaceMode: 1 },
        sUiFontScale: 100,
    });
    w.eval(compile("src/ui/modern.ts"));
    const ids = Array.from({ length: 10000 }, (_, index) => "item-" + index);
    let reads = 0;
    const formatter = () => "Classic row";
    formatter.__ottCatalog = {
        playing: (id) => id === ids[3450],
        row(id) {
            reads++;
            return {
                __ottMediaItem: {
                    __ottMediaCollection: "Library",
                    description: "Shared source metadata",
                    poster: "https://example.invalid/poster.jpg",
                },
                channel_name: "Film " + id,
            };
        },
    };
    return {
        api: w.__ottModernUi,
        container,
        dom,
        formatter,
        ids,
        reads: () => reads,
        w,
    };
}

test("10k catalogue renders a bounded window without cloning or traversing it", () => {
    const f = rendererFixture();
    try {
        const original = f.ids.slice();
        const layout = f.api.prepare(f.ids, f.formatter, f.container);
        assert.equal(layout.grid, true);
        assert(layout.cellWidth > 0);
        assert(layout.pageSize > 0 && layout.pageSize <= 30);
        assert(f.reads() <= 2, "layout must not read all source metadata");
        const start = 3450;
        for (let index = start; index < start + layout.pageSize; index++) {
            const item = f.w.document.createElement("div");
            item.className = "item";
            item.id = "it" + index;
            item.dataset.idx = index;
            item.innerHTML = f.api.render(f.ids[index], index);
            f.container.appendChild(item);
        }
        f.api.decorate(f.container, start, start + layout.pageSize);
        assert.equal(
            f.container.querySelectorAll(".modern-card").length,
            layout.pageSize
        );
        assert(f.reads() <= layout.pageSize * 3 + 2);
        assert.equal(f.w.document.querySelectorAll(".ott-playing").length, 1);
        assert.equal(
            f.w.document.querySelector(".modern-title").textContent,
            "Film item-3450"
        );
        assert.deepEqual(
            f.ids,
            original,
            "view must not reorder the shared catalogue"
        );
        assert.equal(f.w.selIndex, 3450);
    } finally {
        f.dom.window.close();
    }
});

test("grid owns directional input only for its current foreground catalogue", () => {
    const f = rendererFixture();
    try {
        const layout = f.api.prepare(f.ids, f.formatter, f.container);
        let foreground = true;
        const owner = {
            foreground: () => foreground,
            model: { render: f.formatter },
        };
        assert.equal(f.api.navigation({ id: "right" }, owner), true);
        assert.equal(f.w.selIndex, 3451);
        assert.equal(f.api.navigation({ id: "down" }, owner), true);
        assert.equal(f.w.selIndex, 3451 + layout.columns);
        const selected = f.w.selIndex;
        f.w.isListVisible = false;
        assert.equal(f.api.navigation({ id: "left" }, owner), false);
        f.w.isListVisible = true;
        foreground = false;
        assert.equal(f.api.navigation({ id: "left" }, owner), false);
        foreground = true;
        owner.model.render = () => "Other screen";
        assert.equal(f.api.navigation({ id: "left" }, owner), false);
        owner.model.render = f.formatter;
        f.w.settings.interfaceMode = 0;
        assert.equal(f.api.navigation({ id: "left" }, owner), false);
        assert.equal(f.w.selIndex, selected);
    } finally {
        f.dom.window.close();
    }
});

test("Classic and non-catalogue screens remove Modern layout without changing selection", () => {
    const f = rendererFixture();
    try {
        f.api.prepare(f.ids, f.formatter, f.container);
        assert(f.container.classList.contains("modern-grid"));
        const menu = f.api.prepare(f.ids, () => "Settings row", f.container);
        assert.equal(menu.menu, true);
        assert.equal(menu.grid, false);
        assert.equal(menu.columns, 1);
        assert(menu.pageSize <= 12);
        assert.equal(f.api.render(f.ids[0], 0), null);
        assert.equal(f.container.classList.contains("modern-catalog"), false);
        assert.equal(f.container.classList.contains("modern-options"), true);
        assert.equal(
            f.container.style.gridTemplateColumns,
            "repeat(1, minmax(0, 1fr))"
        );
        assert.equal(f.api.prepare(f.ids, f.formatter, null), null);
        f.w.settings.interfaceMode = 0;
        assert.equal(f.api.prepare(f.ids, f.formatter, f.container), null);
        assert.equal(f.api.render(f.ids[0], 0), null);
        assert.equal(f.w.selIndex, 3450);
    } finally {
        f.dom.window.close();
    }
});

test("a failed Modern render can use Classic while retaining the user's saved preference", () => {
    const f = rendererFixture();
    try {
        f.w.__ottInterfaceModeState = { effective: 1 };
        assert(f.api.prepare(f.ids, f.formatter, f.container));
        f.w.__ottInterfaceModeState.effective = 0;
        assert.equal(f.api.prepare(f.ids, f.formatter, f.container), null);
        assert.equal(f.api.render(f.ids[0], 0), null);
        assert.equal(f.container.classList.contains("modern-catalog"), false);
        assert.equal(f.w.settings.interfaceMode, 1);
    } finally {
        f.dom.window.close();
    }
});

test("metadata remains text and rejected artwork leaves a usable fallback", () => {
    const f = rendererFixture();
    try {
        f.w.selIndex = 0;
        f.formatter.__ottCatalog.row = () => ({
            __ottMediaItem: { poster: "javascript:alert(1)" },
            channel_name:
                'Movie <img src=x onerror="window.changed=1"> & title',
        });
        assert(f.api.prepare(["id"], f.formatter, f.container));
        f.container.innerHTML = f.api.render("id", 0);
        assert.equal(f.container.querySelectorAll("img,script").length, 0);
        assert.equal(
            f.container.querySelector(".modern-title").textContent,
            'Movie <img src=x onerror="window.changed=1"> & title'
        );
        assert.equal(
            f.container.querySelector(".modern-art-fallback").textContent,
            "M"
        );
        assert.equal(f.w.changed, undefined);
    } finally {
        f.dom.window.close();
    }
});

test("mixed Favorites keep one grid shape and source identity while focus moves between films and live channels", () => {
    const f = rendererFixture();
    try {
        f.formatter.__ottCatalog.kind = "mixed";
        f.formatter.__ottCatalog.row = (id) => ({
            __ottMediaItem: id === "live" ? null : { name: id },
            channel_name: id,
            modernMeta: id === "live" ? "M3U / Home" : "Plex / Films / " + id,
        });
        const rows = ["film", "live", "film-two"];
        for (let selected = 0; selected < rows.length; selected++) {
            f.w.selIndex = selected;
            const layout = f.api.prepare(rows, f.formatter, f.container);
            assert.equal(layout.grid, true);
            assert.equal(f.container.classList.contains("modern-live"), false);
            assert.equal(f.container.classList.contains("modern-grid"), true);
            f.container.innerHTML = f.api.render(rows[selected], selected);
            assert.equal(
                f.container.querySelector(".modern-meta").textContent,
                selected === 1
                    ? "M3U / Home"
                    : "Plex / Films / " + rows[selected]
            );
        }
    } finally {
        f.dom.window.close();
    }
});

test("live artwork comes from the same provider projection as the Classic list", () => {
    const f = rendererFixture();
    try {
        const requested = [];
        f.w.selIndex = 0;
        f.formatter.__ottCatalog.row = (id) => ({ channel_name: id });
        f.formatter.__ottCatalog.picon = (id) => {
            requested.push(id);
            return "https://example.invalid/provider-logo.png";
        };
        const layout = f.api.prepare(["station"], f.formatter, f.container);
        assert.equal(layout.grid, false);
        f.container.innerHTML = f.api.render("station", 0);
        assert.equal(
            f.container.querySelector("img").src,
            "https://example.invalid/provider-logo.png"
        );
        assert(requested.length > 0);
        assert.equal(
            requested.every((id) => id === "station"),
            true
        );
    } finally {
        f.dom.window.close();
    }
});

function shellFixture() {
    const f = rendererFixture();
    const doc = f.w.document;
    const list = doc.createElement("section");
    list.id = "list";
    doc.body.appendChild(list);
    list.appendChild(f.container);
    list.appendChild(doc.getElementById("listDetail"));
    const caption = list.appendChild(doc.createElement("header"));
    caption.id = "listCaption";
    caption.textContent = "My library";
    const footer = list.appendChild(doc.createElement("footer"));
    footer.id = "listPodval";
    footer.innerHTML =
        '<span data-ott-key="123" aria-label="Categories">Category</span>';
    let active = true;
    const owner = { foreground: () => active, model: { render: f.formatter } };
    const effects = [];
    Object.assign(f.w, {
        __ottClassicScreenPort: { listOwner: () => owner },
        __ottKiosk: { enabled: () => false, locked: () => false },
        __ottModernActions: () => [
            {
                id: "settings",
                label: "Settings",
                run: () => effects.push("settings"),
            },
        ],
        _doKey: (key) => effects.push(key),
    });
    return {
        ...f,
        doc,
        effects,
        foreground: (value) => {
            active = value;
        },
        list,
        owner,
    };
}

test("Modern mounts one shared shell with typed selected-item information and removes it on Classic", () => {
    const f = shellFixture();
    try {
        f.api.prepare(f.ids, f.formatter, f.container);
        assert(f.list.classList.contains("modern-screen-grid"));
        assert.equal(f.doc.querySelectorAll("#modernRail").length, 1);
        assert.equal(
            f.doc.querySelector("#modernRail").getAttribute("aria-label"),
            "Menu"
        );
        assert.equal(
            f.doc.querySelector(".modern-hero-title").textContent,
            "Film item-3450"
        );
        assert.equal(
            f.doc.querySelector(".modern-hero-summary").textContent,
            "Shared source metadata"
        );
        assert.equal(
            f.doc.querySelector(".modern-library-count").textContent,
            "3451 / 10000"
        );
        f.w.selIndex = 6;
        f.api.detail();
        assert.equal(
            f.doc.querySelector(".modern-hero-title").textContent,
            "Film item-6"
        );
        assert.equal(
            f.doc.querySelector(".modern-library-count").textContent,
            "7 / 10000"
        );
        f.api.prepare(f.ids, f.formatter, f.container);
        assert.equal(f.doc.querySelectorAll("#modernShell").length, 1);
        f.w.settings.interfaceMode = 0;
        f.api.refresh();
        assert.equal(f.doc.querySelector("#modernShell"), null);
        assert(!f.list.classList.contains("modern-screen"));
        assert.equal(f.w.selIndex, 6);
    } finally {
        f.dom.window.close();
    }
});

test("Home and Library reuse the catalogue, selection and decoder with distinct bounded layouts", () => {
    const f = shellFixture();
    try {
        let paints = 0;
        let layout;
        f.w.__ottModernActions = () => [
            {
                id: "library",
                label: "Media Library",
                run: () =>
                    assert.fail("a local view switch must not route or reload"),
            },
        ];
        f.w.showPage = (retainDetail) => {
            assert.equal(retainDetail, true);
            paints++;
            layout = f.api.prepare(f.ids, f.formatter, f.container);
        };
        layout = f.api.prepare(f.ids, f.formatter, f.container);
        assert(f.list.classList.contains("modern-view-home"));
        assert.equal(layout.home, true);
        assert.equal(layout.pageSize, layout.columns);
        const originalIds = f.ids.slice();
        const library = f.doc.querySelector('[data-modern-action="library"]');
        library.focus();
        assert(library.classList.contains("modern-rail-selected"));
        library.click();
        assert(f.list.classList.contains("modern-view-library"));
        assert(!f.list.classList.contains("modern-view-home"));
        assert.equal(layout.home, false);
        assert(layout.pageSize <= layout.columns * 2);
        assert.equal(paints, 1);
        f.doc.querySelector('[data-modern-action="library"]').click();
        assert.equal(paints, 1, "reselecting the active view does not repaint");
        f.doc.querySelector('[data-modern-action="home"]').click();
        assert.equal(paints, 2);
        assert.equal(layout.pageSize, layout.columns);
        assert.equal(f.w.selIndex, 3450);
        assert.deepEqual(f.ids, originalIds);
        assert.equal(f.owner.model.render, f.formatter);
        const row = f.container.appendChild(f.doc.createElement("button"));
        row.id = "it" + f.w.selIndex;
        row.focus();
        assert.equal(f.doc.activeElement, row);
        assert.equal(
            f.doc
                .querySelector('[data-modern-action="home"]')
                .getAttribute("aria-current"),
            "page"
        );
        assert.equal(library.hasAttribute("aria-current"), false);
        assert.deepEqual(
            Array.from(
                f.doc.querySelectorAll(".modern-rail-selected"),
                (button) => button.getAttribute("data-modern-action")
            ),
            [],
            "switching views must not retain the previous rail focus highlight"
        );
    } finally {
        f.dom.window.close();
    }
});

test("Library fits natural portrait cards and enlarged captions in a narrow viewport", () => {
    const f = shellFixture();
    try {
        const container = f.doc.createElement("div");
        container.id = "listIn";
        container.style.fontSize = "28px";
        f.container.replaceWith(container);
        Object.defineProperties(container, {
            clientHeight: { value: 543 },
            clientWidth: { value: 361 },
        });
        f.w.innerWidth = 393;
        f.w.innerHeight = 851;
        f.w.sUiFontScale = 140;
        let layout;
        f.w.showPage = () => {
            layout = f.api.prepare(f.ids, f.formatter, container);
        };
        f.w.showPage();
        assert.equal(layout.home, true);
        f.doc.querySelector('[data-modern-action="library"]').click();
        assert.equal(layout.home, false);
        assert(
            layout.columns > 1,
            "one enlarged poster would clip its caption"
        );
        assert(layout.columns <= 8);
        const naturalHeight = (layout.cellWidth - 2) * 1.5 + 28 * 3.2 + 2;
        assert(naturalHeight <= layout.cellHeight + 1);
        assert(layout.cellHeight <= container.clientHeight);
        assert.equal(f.w.selIndex, 3450);
        assert.equal(f.effects.length, 0);
    } finally {
        f.dom.window.close();
    }
});

test("provider/settings controls and category selector keep host callbacks outside the top capsule", () => {
    const f = shellFixture();
    try {
        f.w.__ottModernActions = () =>
            ["favorites", "search", "categories", "providers", "settings"].map(
                (id) => ({
                    id,
                    label: id,
                    run: () => f.effects.push(id),
                })
            );
        f.api.prepare(f.ids, f.formatter, f.container);
        for (const id of ["home", "library", "favorites", "search"])
            assert(
                f.doc.querySelector(`#modernRail [data-modern-action="${id}"]`)
            );
        for (const id of ["providers", "settings"]) {
            const button = f.doc.querySelector(
                `.modern-account-actions [data-modern-action="${id}"]`
            );
            assert(button);
            assert(button.querySelector("svg"));
            button.click();
        }
        f.doc
            .querySelector(
                '.modern-library-actions [data-modern-action="categories"]'
            )
            .click();
        assert.deepEqual(f.effects, ["providers", "settings", "categories"]);
    } finally {
        f.dom.window.close();
    }
});

test("hero actions use selected-item contracts and reject stale selection, covered owners and kiosk", () => {
    const f = shellFixture();
    try {
        f.api.prepare(f.ids, f.formatter, f.container);
        assert.equal(f.doc.querySelectorAll(".modern-hero-action").length, 0);
        f.w.__ottModernSelectedActions = () => [
            {
                id: "play",
                label: "Play",
                run: () => f.effects.push("play:" + f.w.selIndex),
            },
            {
                id: "details",
                label: "Details",
                run: () => f.effects.push("details"),
            },
        ];
        f.api.detail();
        const stale = f.doc.querySelector('[data-modern-hero-action="play"]');
        f.w.selIndex = 4;
        stale.click();
        assert.deepEqual(f.effects, []);
        f.api.detail();
        const play = f.doc.querySelector('[data-modern-hero-action="play"]');
        f.foreground(false);
        play.click();
        f.foreground(true);
        f.w.__ottKiosk.enabled = () => true;
        play.click();
        assert.deepEqual(f.effects, []);
        f.w.__ottKiosk.enabled = () => false;
        play.click();
        assert.deepEqual(f.effects, ["play:4"]);
        f.doc.querySelector('[data-modern-action="library"]').click();
        play.click();
        assert.deepEqual(
            f.effects,
            ["play:4"],
            "hidden Library hero controls are stale"
        );
        assert.equal(f.doc.querySelectorAll(".modern-hero-action").length, 0);
    } finally {
        f.dom.window.close();
    }
});

test("Up from a later visible grid page reaches the capsule; Down restores its item", () => {
    const f = shellFixture();
    try {
        const layout = f.api.prepare(f.ids, f.formatter, f.container);
        f.w.selIndex = layout.pageSize * 3 + 1;
        const row = f.container.appendChild(f.doc.createElement("div"));
        row.id = "it" + f.w.selIndex;
        row.tabIndex = 0;
        const selected = f.w.selIndex;
        assert.equal(f.api.navigation({ id: "up" }, f.owner), true);
        assert.equal(f.doc.activeElement.dataset.modernAction, "home");
        assert.equal(f.api.navigation({ id: "down" }, f.owner), true);
        assert.equal(f.doc.activeElement, row);
        assert.equal(f.w.selIndex, selected);
        f.w.__ottKiosk.enabled = () => true;
        assert.equal(f.api.navigation({ id: "up" }, f.owner), false);
    } finally {
        f.dom.window.close();
    }
});

test("Home hero actions are reachable between the top capsule and media strip with D-pad", () => {
    const f = shellFixture();
    try {
        f.w.selIndex = 0;
        const row = f.container.appendChild(f.doc.createElement("div"));
        row.id = "it0";
        row.tabIndex = -1;
        f.w.__ottModernSelectedActions = () => [
            { id: "play", label: "Play", run: () => f.effects.push("play") },
            {
                id: "details",
                label: "Details",
                run: () => f.effects.push("details"),
            },
        ];
        f.api.prepare(f.ids, f.formatter, f.container);
        f.api.navigation({ id: "up" }, f.owner);
        assert.equal(f.doc.activeElement.dataset.modernHeroAction, "play");
        f.api.navigation({ id: "right" }, f.owner);
        assert.equal(f.doc.activeElement.dataset.modernHeroAction, "details");
        f.api.navigation({ id: "up" }, f.owner);
        assert.equal(f.doc.activeElement.dataset.modernAction, "home");
        f.api.navigation({ id: "down" }, f.owner);
        assert.equal(f.doc.activeElement.dataset.modernHeroAction, "play");
        f.api.navigation({ id: "down" }, f.owner);
        assert.equal(f.doc.activeElement, row);
        assert.equal(f.w.selIndex, 0);
        assert.deepEqual(f.effects, []);
    } finally {
        f.dom.window.close();
    }
});

test("option pages never focus a category control hidden with the catalog heading", () => {
    const f = shellFixture();
    try {
        const menu = () => "Settings";
        f.owner.model.render = menu;
        f.w.selIndex = 0;
        f.w.__ottModernActions = () => [
            {
                id: "library",
                label: "Library",
                run: () => f.effects.push("library"),
            },
            {
                id: "categories",
                label: "Categories",
                run: () => assert.fail("invisible category"),
            },
            {
                id: "settings",
                label: "Settings",
                run: () => f.effects.push("settings"),
            },
        ];
        f.api.prepare(["Settings"], menu, f.container);
        assert.equal(
            f.doc.querySelector('[data-modern-action="categories"]'),
            null
        );
        f.api.navigation({ id: "up" }, f.owner);
        f.api.navigation({ id: "right" }, f.owner);
        f.api.navigation({ id: "right" }, f.owner);
        assert.equal(f.doc.activeElement.dataset.modernAction, "settings");
        f.api.navigation({ id: "accept" }, f.owner);
        assert.deepEqual(f.effects, ["settings"]);
    } finally {
        f.dom.window.close();
    }
});

for (const type of ["live catalogue", "option list"]) {
    test(`Modern ${type} keeps Up linear across page boundaries`, () => {
        const f = shellFixture();
        try {
            const formatter = () => "Settings";
            if (type === "live catalogue")
                formatter.__ottCatalog = {
                    row: (id) => ({ channel_name: "Channel " + id }),
                };
            f.owner.model.render = formatter;
            f.w.selIndex = 0;
            const layout = f.api.prepare(f.ids, formatter, f.container);
            assert.equal(layout.grid, false);
            for (const index of [1, layout.pageSize, layout.pageSize * 2]) {
                f.w.selIndex = index;
                const row = f.container.appendChild(f.doc.createElement("div"));
                row.id = "it" + index;
                row.tabIndex = 0;
                row.focus();
                assert.equal(f.api.navigation({ id: "up" }, f.owner), false);
                assert.equal(f.doc.activeElement, row);
                assert.equal(f.w.selIndex, index);
                // The shared linear handler retains ownership of this step.
                f.w.changeSelect(-1);
                assert.equal(f.w.selIndex, index - 1);
            }
            f.w.selIndex = 0;
            assert.equal(f.api.navigation({ id: "up" }, f.owner), true);
            assert.equal(
                f.doc.activeElement.dataset.modernAction,
                type === "live catalogue" ? "library" : "browse"
            );
        } finally {
            f.dom.window.close();
        }
    });
}

test("Modern grid keeps top navigation available from a later page's first row", () => {
    const f = shellFixture();
    try {
        const layout = f.api.prepare(f.ids, f.formatter, f.container);
        assert.equal(layout.grid, true);
        const selected = layout.pageSize + layout.columns - 1;
        f.w.selIndex = selected;
        assert.equal(f.api.navigation({ id: "up" }, f.owner), true);
        assert.equal(f.doc.activeElement.dataset.modernAction, "home");
        assert.equal(f.w.selIndex, selected);
    } finally {
        f.dom.window.close();
    }
});

test("top navigation uses horizontal travel and Back returns to the same media item", () => {
    const f = shellFixture();
    try {
        f.w.selIndex = 0;
        const row = f.container.appendChild(f.doc.createElement("div"));
        row.id = "it0";
        row.tabIndex = 0;
        f.api.prepare(f.ids, f.formatter, f.container);
        assert.equal(f.api.navigation({ id: "up" }, f.owner), true);
        assert.equal(f.doc.activeElement.dataset.modernAction, "home");
        f.api.navigation({ id: "right" }, f.owner);
        assert.equal(f.doc.activeElement.dataset.modernAction, "library");
        f.api.navigation({ id: "right" }, f.owner);
        assert.equal(f.doc.activeElement.dataset.modernAction, "settings");
        f.api.navigation({ id: "accept" }, f.owner);
        assert.deepEqual(f.effects, ["settings"]);
        f.api.navigation({ id: "up" }, f.owner);
        assert.equal(f.api.navigation({ id: "back" }, f.owner), true);
        assert.equal(f.doc.activeElement, row);
        assert.equal(f.w.selIndex, 0);
        f.foreground(false);
        assert.equal(f.api.navigation({ id: "left" }, f.owner), false);
    } finally {
        f.dom.window.close();
    }
});

test("host navigation keeps contextual footer actions out of the rail", () => {
    const f = shellFixture();
    try {
        const footer = f.doc.getElementById("listPodval");
        f.api.prepare(f.ids, f.formatter, f.container);
        assert.equal(
            f.doc.querySelector('#modernRail [data-modern-action="key-123"]'),
            null
        );
        assert.equal(footer.querySelectorAll("[data-ott-key]").length, 1);
        delete f.w.__ottModernActions;
        f.api.syncScreen();
        const fallback = f.doc.querySelector(
            '#modernRail [data-modern-action="key-123"]'
        );
        assert(fallback);
        fallback.click();
        assert.deepEqual(f.effects, [123]);
    } finally {
        f.dom.window.close();
    }
});

test("rail buttons reject stale renderers, covered screens and kiosk restrictions", () => {
    const f = shellFixture();
    try {
        f.api.prepare(f.ids, f.formatter, f.container);
        const old = f.doc.querySelector('[data-modern-action="settings"]');
        const staleHandler = old.onclick;
        f.api.syncScreen();
        assert.equal(
            f.doc.querySelector('[data-modern-action="settings"]'),
            old
        );
        staleHandler(new f.w.MouseEvent("click"));
        assert.deepEqual(f.effects, []);
        const current = () =>
            f.doc.querySelector('[data-modern-action="settings"]');
        f.foreground(false);
        current().click();
        assert.deepEqual(f.effects, []);
        f.foreground(true);
        f.w.__ottKiosk.locked = () => true;
        current().click();
        assert.deepEqual(f.effects, []);
        f.w.__ottKiosk.locked = () => false;
        current().click();
        assert.deepEqual(f.effects, ["settings"]);
        f.owner.model.render = () => "Other";
        current().click();
        assert.deepEqual(f.effects, ["settings"]);
    } finally {
        f.dom.window.close();
    }
});

test("rail repaint preserves nested targets and refreshes descriptors but replaces changed owners and routes", () => {
    const f = shellFixture();
    try {
        let revision = 0;
        let disabled = false;
        let active = false;
        let ids = ["settings", "providers"];
        f.w.__ottModernActions = () =>
            ids.map((id) => ({
                active,
                disabled,
                id,
                label: id + revision,
                run: () => f.effects.push(id + revision),
            }));
        f.api.prepare(f.ids, f.formatter, f.container);
        const selector = '[data-modern-action="settings"]';
        const old = f.doc.querySelector(selector);
        const image = old.firstElementChild;
        const caption = old.lastElementChild;
        const graphic = image.firstElementChild;
        old.focus();
        f.api.syncScreen();
        assert.equal(f.doc.querySelector(selector), old);
        assert.equal(old.firstElementChild, image);
        assert.equal(image.firstElementChild, graphic);
        assert.equal(old.lastElementChild, caption);
        assert.equal(f.doc.activeElement, old);
        revision++;
        disabled = active = true;
        f.api.syncScreen();
        assert.equal(f.doc.querySelector(selector), old);
        assert.equal(old.getAttribute("aria-label"), "settings1");
        assert.equal(old.title, "settings1");
        assert.equal(caption.textContent, "settings1");
        assert.equal(old.getAttribute("aria-current"), "page");
        assert.equal(old.disabled, true);
        old.click();
        assert.deepEqual(f.effects, []);
        disabled = active = false;
        f.api.syncScreen();
        assert.equal(old.hasAttribute("aria-current"), false);
        old.click();
        assert.deepEqual(f.effects, ["settings1"]);
        ids.reverse();
        f.api.syncScreen();
        assert.equal(old.isConnected, false);
        old.click();
        assert.deepEqual(f.effects, ["settings1"]);
        const beforeOwner = f.doc.querySelector(selector);
        const nextOwner = {
            foreground: () => true,
            model: { render: f.formatter },
        };
        f.w.__ottClassicScreenPort.listOwner = () => nextOwner;
        f.api.syncScreen();
        assert.equal(beforeOwner.isConnected, false);
        beforeOwner.click();
        assert.deepEqual(f.effects, ["settings1"]);
        const removed = f.doc.querySelector(selector);
        ids = ["providers"];
        f.api.syncScreen();
        assert.equal(f.doc.querySelector(selector), null);
        removed.click();
        assert.deepEqual(f.effects, ["settings1"]);
    } finally {
        f.dom.window.close();
    }
});

test("hero repaint preserves nested targets only for the same selected item and renderer", () => {
    const f = shellFixture();
    try {
        let label = "Play";
        f.w.__ottModernSelectedActions = () => [
            {
                id: "play",
                label,
                run: () => f.effects.push(label),
            },
        ];
        f.api.prepare(f.ids, f.formatter, f.container);
        const selector = '[data-modern-hero-action="play"]';
        const old = f.doc.querySelector(selector);
        const image = old.firstElementChild;
        const caption = old.lastElementChild;
        old.focus();
        f.api.detail();
        assert.equal(f.doc.querySelector(selector), old);
        assert.equal(old.firstElementChild, image);
        assert.equal(old.lastElementChild, caption);
        assert.equal(f.doc.activeElement, old);
        label = "Open";
        f.api.detail();
        assert.equal(f.doc.querySelector(selector), old);
        assert.equal(old.getAttribute("aria-label"), label);
        assert.equal(caption.textContent, label);
        old.click();
        assert.deepEqual(f.effects, ["Open"]);
        f.w.selIndex++;
        f.api.detail();
        assert.equal(old.isConnected, false);
        old.click();
        assert.deepEqual(f.effects, ["Open"]);
        const beforeRender = f.doc.querySelector(selector);
        const render = Object.assign(() => "item", {
            __ottCatalog: f.formatter.__ottCatalog,
        });
        f.owner.model.render = render;
        f.api.prepare(f.ids, render, f.container);
        assert.equal(beforeRender.isConnected, false);
        beforeRender.click();
        assert.deepEqual(f.effects, ["Open"]);
    } finally {
        f.dom.window.close();
    }
});

test("settings and empty catalogues retain Modern navigation without stale selected media", () => {
    const f = shellFixture();
    try {
        f.api.prepare(f.ids, f.formatter, f.container);
        const render = () => "Settings";
        f.owner.model.render = render;
        f.api.prepare([{ name: "First setting" }], render, f.container);
        assert(f.list.classList.contains("modern-screen-menu"));
        assert(!f.list.classList.contains("modern-screen-grid"));
        assert.equal(f.doc.getElementById("modernHero").hidden, true);
        f.owner.model.render = f.formatter;
        f.api.prepare([], f.formatter, f.container);
        assert.equal(f.doc.getElementById("modernHero").hidden, true);
        assert.equal(
            f.doc.querySelector(".modern-library-count").textContent,
            ""
        );
    } finally {
        f.dom.window.close();
    }
});

test("empty or unprojectable catalogues expose the original status detail until media arrives", () => {
    const f = shellFixture();
    try {
        const detail = f.doc.getElementById("listDetail");
        const message = detail.appendChild(f.doc.createElement("p"));
        const retry = detail.appendChild(f.doc.createElement("button"));
        let retried = 0;
        retry.onclick = () => retried++;
        for (const status of [
            "Loading...",
            "Not found",
            "Failed to load!",
            "Not configured",
        ]) {
            message.textContent = status;
            f.api.prepare([], f.formatter, f.container);
            assert(f.list.classList.contains("modern-empty"));
            assert.equal(f.doc.getElementById("modernHero").hidden, true);
            assert.equal(detail.firstChild, message);
            assert.equal(detail.textContent, status);
            assert.equal(detail.lastChild, retry);
        }
        retry.click();
        assert.equal(retried, 1);
        const row = f.formatter.__ottCatalog.row;
        f.formatter.__ottCatalog.row = () => null;
        f.w.selIndex = 0;
        f.api.prepare(["unavailable"], f.formatter, f.container);
        assert(f.list.classList.contains("modern-empty"));
        f.formatter.__ottCatalog.row = row;
        f.api.prepare(f.ids, f.formatter, f.container);
        assert(!f.list.classList.contains("modern-empty"));
        assert.equal(f.doc.getElementById("modernHero").hidden, false);
        f.api.prepare([], f.formatter, f.container);
        const menu = () => "Settings";
        f.owner.model.render = menu;
        f.api.prepare([], menu, f.container);
        assert(!f.list.classList.contains("modern-empty"));
        f.owner.model.render = f.formatter;
        f.api.prepare([], f.formatter, f.container);
        f.w.settings.interfaceMode = 0;
        f.api.refresh();
        assert(!f.list.classList.contains("modern-empty"));
    } finally {
        f.dom.window.close();
    }
});

test("existing media controls keep their callbacks and are exposed without copying their DOM", () => {
    const f = shellFixture();
    try {
        f.api.prepare(f.ids, f.formatter, f.container);
        const detail = f.doc.getElementById("listDetail");
        const controls = detail.appendChild(f.doc.createElement("div"));
        controls.id = "mediaPlaybackControls";
        const button = controls.appendChild(f.doc.createElement("span"));
        button.setAttribute("data-ott-key", "13");
        let calls = 0;
        button.onclick = () => calls++;
        f.api.detail();
        assert(f.list.classList.contains("modern-has-controls"));
        assert.equal(
            f.doc.querySelectorAll("#mediaPlaybackControls").length,
            1
        );
        assert.equal(controls.parentNode, detail);
        button.click();
        assert.equal(calls, 1);
        controls.remove();
        f.api.detail();
        assert(!f.list.classList.contains("modern-has-controls"));
    } finally {
        f.dom.window.close();
    }
});

test("menu Library action uses the host route and cannot double fire on keyboard Enter", () => {
    const f = shellFixture();
    try {
        f.w.__ottModernActions = () => [
            {
                id: "library",
                label: "Library",
                run: () => f.effects.push("library"),
            },
        ];
        const menu = () => "Settings";
        f.owner.model.render = menu;
        f.api.prepare(["Settings"], menu, f.container);
        assert.equal(
            f.doc.querySelector('[data-modern-action="browse"]'),
            null
        );
        const button = f.doc.querySelector('[data-modern-action="library"]');
        const event = new f.w.KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key: "Enter",
        });
        button.dispatchEvent(event);
        assert.equal(event.defaultPrevented, true);
        assert.deepEqual(f.effects, ["library"]);
    } finally {
        f.dom.window.close();
    }
});

test("Modern option pages fit larger measured rows while preserving the original formatter and controls", () => {
    const f = shellFixture();
    try {
        const render = () => '<span class="original">Setting value</span>';
        f.owner.model.render = render;
        const rows = Array.from({ length: 30 }, (_, index) => ({
            name: "Setting " + index,
        }));
        const layout = f.api.prepare(rows, render, f.container);
        assert.equal(layout.menu, true);
        assert.equal(layout.columns, 1);
        assert(layout.pageSize > 0 && layout.pageSize <= 12);
        assert(layout.cellHeight >= 50);
        const row = f.container.appendChild(f.doc.createElement("div"));
        row.id = "it0";
        const button = row.appendChild(f.doc.createElement("button"));
        button.textContent = "Original action";
        let calls = 0;
        button.onclick = () => calls++;
        f.api.decorate(f.container, 0, 1);
        assert(row.classList.contains("modern-option"));
        assert.equal(f.api.render(rows[0], 0), null);
        assert.equal(row.firstChild, button);
        button.click();
        assert.equal(calls, 1);
        assert.equal(f.api.navigation({ id: "down" }, f.owner), false);
        assert.equal(f.doc.getElementById("modernHero").hidden, true);
    } finally {
        f.dom.window.close();
    }
});

test("Modern host navigation uses shared routing and rejects stale or covered actions", () => {
    const output = ts.transpileModule(
        fs.readFileSync(path.join(root, "src/ui/modern-actions.ts"), "utf8"),
        { compilerOptions: { module: ts.ModuleKind.CommonJS } }
    ).outputText;
    const context = { exports: {} };
    require("node:vm").runInNewContext(output, context);
    const calls = [];
    let foreground = true;
    let locked = false;
    let providers = true;
    let owner = { foreground: () => foreground };
    const host = {
        _: (value) => value,
        __ottActiveProviderDriver: {
            catalogBrowser: {
                restore: () => {
                    calls.push("library");
                    return true;
                },
            },
        },
        __ottChannelSearch: { open: () => calls.push("search") },
        __ottChannels: { browsingIndex: () => 3 },
        __ottClassicScreenPort: { listOwner: () => owner },
        __ottKiosk: { locked: () => locked },
        bucketsList: (index) => calls.push("category:" + index),
        openGlobalFavorites: () => calls.push("favorites"),
    };
    const get = context.exports.createModernActions(host, {
        providers: () => calls.push("providers"),
        providersAvailable: () => providers,
        settings: () => calls.push("settings"),
    });
    const actions = get();
    assert.equal(host.__ottGlobalFavorites, undefined);
    assert(actions.some((action) => action.id === "favorites"));
    for (const action of actions) action.run();
    assert.deepEqual(calls, [
        "library",
        "favorites",
        "category:3",
        "search",
        "providers",
        "settings",
    ]);
    calls.length = 0;
    foreground = false;
    for (const action of actions) action.run();
    assert.equal(get().length, 0);
    foreground = true;
    owner = { foreground: () => true };
    for (const action of actions) action.run();
    assert.deepEqual(calls, []);
    providers = false;
    assert.equal(
        get().some((action) => action.id === "providers"),
        false
    );
    locked = true;
    assert.equal(get().length, 0);
});
