"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const { JSDOM } = require("jsdom");
const { compatibilitySource } = require("./helpers/english-source-fixture.cjs");
const { settingsSource } = require("./helpers/settings-source-fixture.cjs");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

// Exercise the production renderer and setting transaction without a bundle.
function selected(file, names, assignments = []) {
    const ast = ts.createSourceFile(
        file,
        read(file),
        ts.ScriptTarget.Latest,
        true
    );
    return ast.statements
        .filter(
            (node) =>
                (ts.isFunctionDeclaration(node) &&
                    names.includes(node.name?.text)) ||
                (ts.isExpressionStatement(node) &&
                    ts.isBinaryExpression(node.expression) &&
                    assignments.includes(node.expression.left.getText(ast)))
        )
        .map((node) => node.getText(ast))
        .join("\n");
}
function compile(source) {
    return ts
        .transpileModule(source, {
            compilerOptions: {
                module: ts.ModuleKind.ES2015,
                target: ts.ScriptTarget.ES5,
            },
        })
        .outputText.replace(/^import .*$/gm, "")
        .replace(/^export /gm, "");
}
function fixture() {
    const dom = new JSDOM(
        '<div id="list"><div id="listCaption"></div><div id="listIn"></div>' +
            '<div id="listDetail"></div><div id="listPodval"></div></div>' +
            '<div id="dialogbox"><div class="item">Dialog row</div></div>' +
            '<div id="listPopUp"></div><div id="info1"></div>' +
            '<div id="list_window"></div><div id="list_osd"></div>' +
            '<div id="permanentTime"></div><div id="progress"></div>',
        { runScripts: "outside-only", url: "https://player.example/" }
    );
    const w = dom.window;
    const context = dom.getInternalVMContext();
    const data = new Map([
        [
            "parentPIN",
            require("./helpers/protected-pin-fixture.cjs").record("1234"),
        ],
    ]);
    const write = (key, value) => data.set(key, String(value));
    Object.assign(w, {
        _: (value) => value,
        $tooltipSpan: null,
        bodyColor: "#fff",
        categoryRowsProjection: null,
        catIndex: 0,
        channels: { 1: { channel_name: "Fixture" } },
        closeList() {},
        curColor: "gold",
        curColorB: "#668",
        curEpgData: [],
        detailEPG() {},
        epg_ch_id: 1,
        epgKeyHandler() {},
        epgListMode: 0,
        epgreturn: false,
        favoritesArray: [],
        getListItemFn: null,
        getViewportHeightScale: () => 1,
        getViewportWidthScale: () => 1,
        hsvToRgb: () => [80, 90, 100],
        isListVisible: false,
        isPlayDistribution: () => false,
        itemEPG: (row) => row.name,
        itemWidth: 735,
        keys: {
            ENTER: 13,
            GREEN: 71,
            LEFT: 37,
            N0: 48,
            N9: 57,
            PAUSE: 81,
            PLAY: 80,
            RED: 1,
            RETURN: 27,
            RIGHT: 39,
            TOOLS: 84,
        },
        listArray: [],
        listDataArray: [],
        listEpgArray: [],
        listFitPageSize: (size) => size,
        listRowHeight: () => 24,
        m3uArr: { active: 0, M3Us: [{ www: "https://one.invalid/list" }] },
        metadataText: (text) => String(text),
        noop() {},
        p_pref: "m3u",
        packListRowBoxes: () => 24,
        prependMenuButtonHint() {},
        primaryIndex: 0,
        providerDelItem: (key) => data.delete("p:" + key),
        providerGetItem: (key) => data.get("p:" + key) ?? null,
        providerGetJson: (key, fallback) =>
            JSON.parse(data.get("p:" + key) || "null") || fallback,
        providerSetItem: (key, value) => write("p:" + key, value),
        renderButtonHint: () => "",
        renderEpgFooter() {},
        requestAnimationFrame: () => 1,
        scheduleListDetailUpdate() {},
        selIndex: 0,
        setFontSize() {},
        setListPos() {},
        showProviderSelection() {},
        showShift() {},
        stbSetOsdOpacity() {},
        storage: {
            del: (key) => data.delete(key),
            get: (key) => data.get(key) ?? null,
            set: write,
            setI: write,
        },
        strPlayPause: "Play",
        strRETURN: "Return",
        strTools: "",
        tooltip: null,
    });
    vm.runInContext(read("js/jquery-1.11.1.min.js"), context);
    require("./helpers/shared-core-runtime.cjs")(context);
    vm.runInContext(compatibilitySource + settingsSource(), context);
    vm.runInContext(compile(read("src/ui/interface-colors.ts")), context);
    vm.runInContext(
        compile(
            selected(
                "src/index.ts",
                [
                    "classicColorRgb",
                    "setColor",
                    "setListArrays",
                    "createSettingsPage",
                ],
                ["window.settingsLists", "window._setSetup"]
            )
        ),
        context
    );
    vm.runInContext(
        compile(selected("src/provider/index.ts", ["optionsList"])),
        context
    );
    vm.runInContext(
        compile(selected("src/ui/index.ts", ["epgTimeCssColor", "showPage"])),
        context
    );
    vm.runInContext(
        compile(
            selected("src/channels/index.ts", [
                "bucketsList",
                "renderGuideView",
            ])
        ),
        context
    );
    const style = w.document.createElement("style");
    style.textContent = read("styles/player.css");
    w.document.head.appendChild(style);
    w.$infoBar = w.$("#info1");
    w.listElement = w.document.getElementById("list");
    w.listInElement = w.document.getElementById("listIn");
    // Keep the real ScreenPort and its classic/typed formatter aliases.
    w.listCaptionElement = w.document.getElementById("listCaption");
    w.listFooter = w.document.getElementById("listPodval");
    w.optionsArr = [{ action: w.settingsLists, name: "Lists settings" }];
    w.__ottClassicGuide = { cancelConsumers() {}, encodeRows: (rows) => rows };
    w.settings.interfaceTheme = 0;
    w.setColor();
    return {
        context,
        data,
        dom,
        render(kind) {
            if (kind === "category") {
                w.bucketsList(0, undefined, {
                    key() {},
                    labels: ["One", "Two"],
                });
            } else if (kind === "epg" || kind === "archive") {
                const rows = [{ name: "One", programmeId: "one" }];
                w.renderGuideView(
                    kind === "archive" ? 0 : 1,
                    1,
                    {
                        rows,
                        schedule: rows,
                        selectedId: "one",
                    },
                    false,
                    [0, 0]
                );
            } else {
                const formatter = (row) => row;
                if (kind === "channel") formatter.__ottCatalog = {};
                if (kind === "media") formatter.__ottMediaRows = true;
                w.getListItemFn = formatter;
                w.listDataArray = w.listArray = ["One", "Two"];
                w.showPage(true);
            }
        },
        row: () => w.document.getElementById("it0"),
        shadow: (node) => w.getComputedStyle(node).boxShadow,
        w,
    };
}

for (const stylesheet of ["absent", "stale"]) {
    test(
        "settings rows retain CSP-safe geometry with " + stylesheet + " CSS",
        () => {
            const f = fixture();
            try {
                const { w } = f;
                for (const style of w.document.querySelectorAll("style"))
                    style.remove();
                if (stylesheet === "stale") {
                    const style = w.document.createElement("style");
                    style.textContent =
                        ".item-label,.item-value{flex:0 0 100%;max-width:100%;white-space:normal;text-align:left}.item-label{min-width:90em}";
                    w.document.head.appendChild(style);
                }
                const html = Object.getOwnPropertyDescriptor(
                    w.Element.prototype,
                    "innerHTML"
                );
                Object.defineProperty(w.listInElement, "innerHTML", {
                    get() {
                        return html.get.call(this);
                    },
                    set(value) {
                        html.set.call(this, value);
                        assert.equal(
                            this.querySelector("[style]"),
                            null,
                            "settings markup must not depend on CSP-blocked style attributes"
                        );
                    },
                });
                w.settingsLists();
                function check(row) {
                    const label = row.querySelector(".item-label");
                    const value = row.querySelector(".item-value");
                    assert.equal(w.getComputedStyle(label).flexGrow, "1");
                    assert.equal(w.getComputedStyle(label).minWidth, "0px");
                    assert.equal(
                        w.getComputedStyle(label).textOverflow,
                        "ellipsis"
                    );
                    assert.equal(w.getComputedStyle(value).flexShrink, "0");
                    assert.equal(w.getComputedStyle(value).maxWidth, "42%");
                    assert.equal(w.getComputedStyle(value).marginLeft, "auto");
                    assert.equal(
                        w.getComputedStyle(value).whiteSpace,
                        "nowrap"
                    );
                    assert.equal(w.getComputedStyle(value).textAlign, "right");
                }
                const firstRow = f.row();
                check(firstRow);
                w.settings.pageSize = 1;
                w.selIndex = 1;
                w.showPage(true);
                check(w.document.getElementById("it1"));
                assert.equal(
                    firstRow.isConnected,
                    false,
                    "new rows replace the styled page"
                );
                w.getListItemFn = () =>
                    '<div class="item-label">Other</div><div class="item-value">Value</div>';
                w.listDataArray = w.listArray = ["Other"];
                w.selIndex = 0;
                w.showPage(true);
                assert.equal(
                    f.row().querySelector(".item-label").style.flex,
                    "",
                    "settings geometry must not leak to another formatter"
                );
            } finally {
                f.dom.window.close();
            }
        }
    );
}

test("separator setting keeps the existing default and rejects invalid values", () => {
    const f = fixture();
    assert.equal(f.w.settings.showListSeparators, 1);
    assert.equal(f.w.sShowListSeparators, 1);
    assert.equal(f.data.has("sShowListSeparators"), false);
    f.render("category");
    assert.match(f.shadow(f.row()), /inset/);
    for (const value of [-1, 2, 0.5, "0", null]) {
        assert.equal(f.w.saveSettings({ showListSeparators: value }), false);
        assert.equal(f.w.settings.showListSeparators, 1);
    }
    f.dom.window.close();
});

for (const kind of ["category", "channel", "epg", "archive"]) {
    test(
        kind +
            " hides only row separators without changing row geometry or selection",
        () => {
            const f = fixture();
            f.render(kind);
            const height = f.row().style.height;
            const border = f.w.getComputedStyle(
                f.w.document.getElementById("listCaption")
            ).borderBottom;
            assert.match(f.shadow(f.row()), /inset/);
            assert.equal(f.w.saveSettings({ showListSeparators: 0 }), true);
            assert.equal(f.shadow(f.row()), "none");
            assert.equal(f.row().style.height, height);
            assert.equal(f.row().classList.contains("ott-selected"), true);
            assert.equal(
                f.w.getComputedStyle(f.w.document.getElementById("listCaption"))
                    .borderBottom,
                border
            );
            assert.match(
                f.shadow(f.w.document.querySelector("#dialogbox .item")),
                /inset/
            );
            assert.equal(f.w.saveSettings({ showListSeparators: 1 }), true);
            assert.match(f.shadow(f.row()), /inset/);
            f.dom.window.close();
        }
    );
}

test("switching to a non-content list clears the previous content marker", () => {
    const f = fixture();
    f.w.saveSettings({ showListSeparators: 0 });
    f.render("category");
    assert.equal(f.shadow(f.row()), "none");
    f.w.settingsLists();
    assert.equal(
        f.w.listInElement.classList.contains("content-list-rows"),
        false
    );
    assert.match(f.shadow(f.row()), /inset/);
    f.w.listKeyHandlerFn(f.w.keys.RETURN);
    assert.equal(f.w.listCaptionElement.textContent, "Settings");
    assert.equal(
        f.w.listInElement.classList.contains("content-list-rows"),
        false
    );
    assert.match(f.shadow(f.row()), /inset/);
    f.dom.window.close();
});

test("legacy media and folder rows retain separators", () => {
    const f = fixture();
    f.w.saveSettings({ showListSeparators: 0 });
    f.render("media");
    assert.equal(
        f.w.listInElement.classList.contains("content-list-rows"),
        false
    );
    assert.match(f.shadow(f.row()), /inset/);
    f.dom.window.close();
});

test("Modern rows retain their own borders and shadows", () => {
    const f = fixture();
    f.w.document.body.classList.add("interface-modern");
    f.render("channel");
    const before = f.w.getComputedStyle(f.row());
    const baseline = [before.boxShadow, before.borderBottom];
    f.w.saveSettings({ showListSeparators: 0 });
    const after = f.w.getComputedStyle(f.row());
    assert.deepEqual([after.boxShadow, after.borderBottom], baseline);
    assert.equal(
        f
            .row()
            .matches(
                "body.hide-list-separators:not(.interface-modern) #listIn.content-list-rows > .item"
            ),
        false
    );
    f.dom.window.close();
});

test("Lists settings Cancel discards a draft and Save applies it immediately", () => {
    const f = fixture();
    f.w.settingsLists();
    let row = f.w.listArray.find(
        (item) => item.settingId === "showListSeparators"
    );
    assert.equal(row.name, "Show list separators (Classic)");
    row.val = 0;
    f.w.listKeyHandlerFn(f.w.keys.RETURN);
    assert.equal(f.w.settings.showListSeparators, 1);
    assert.equal(f.data.has("sShowListSeparators"), false);
    f.w.settingsLists();
    row = f.w.listArray.find((item) => item.settingId === "showListSeparators");
    row.val = 0;
    f.w.listKeyHandlerFn(f.w.keys.GREEN);
    assert.equal(f.data.get("sShowListSeparators"), "0");
    assert.equal(
        f.w.document.body.classList.contains("hide-list-separators"),
        true
    );
    f.dom.window.close();
});

test("client preference survives reload, provider changes, and backup roundtrip", () => {
    const f = fixture();
    f.w.saveSettings({ showListSeparators: 0 });
    f.w.loadSettings();
    assert.equal(f.w.settings.showListSeparators, 0);
    f.w.p_pref = "another-provider";
    f.w.loadProviderSettings(0);
    assert.equal(f.w.settings.showListSeparators, 0);
    const backup = f.w.exportSettings();
    f.w.saveSettings({ showListSeparators: 1 });
    let restored;
    f.w.importSettings(backup, (ok) => {
        restored = ok;
    });
    assert.equal(restored, true);
    assert.equal(f.w.settings.showListSeparators, 0);
    assert.equal(f.data.get("sShowListSeparators"), "0");
    f.dom.window.close();
});

test("remote settings exposes the application preference and its reset value", () => {
    const f = fixture();
    vm.runInContext(compile(read("src/plugins/remote-settings.ts")), f.context);
    const api = f.w.__ottPlayerSettingsFactory.create(
        f.w,
        () => "separators-test"
    );
    function request(params) {
        let result;
        api.request({ action: "player_settings", params }, (reply) => {
            result = reply;
        });
        return result;
    }
    function get() {
        return request({
            id: "showListSeparators",
            op: "get",
            runtime: "separators-test",
        });
    }
    let result = get();
    assert.equal(result.data.descriptor.scope, "application");
    assert.equal(result.data.descriptor.default_value, 1);
    for (const value of [0, result.data.descriptor.default_value]) {
        result = get();
        request({
            context: result.data.context.token,
            id: "showListSeparators",
            op: "set",
            revision: result.data.setting.revision,
            runtime: result.data.runtime,
            value,
        });
        assert.equal(f.w.settings.showListSeparators, value);
        assert.equal(f.data.get("sShowListSeparators"), String(value));
        assert.equal(
            f.w.document.body.classList.contains("hide-list-separators"),
            value === 0
        );
    }
    f.dom.window.close();
});
