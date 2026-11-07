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
        accessMediaPlugin: () => null,
        bodyColor: "#fff",
        categoryRowsProjection: null,
        catIndex: 0,
        catsArray: ["Fixture category"],
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
        epgTimeColorDialog() {},
        favoritesArray: [],
        formatEpgTime: () => "12:00",
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
                [
                    "window.settingsLists",
                    "window.settingsInfobar",
                    "window.settingsChannels",
                    "window.settingsButtons",
                    "window.settingsMenu",
                    "window.settingsManage",
                    "window._setSetup",
                ]
            )
        ),
        context
    );
    vm.runInContext(
        compile(selected("src/provider/index.ts", ["optionsList"])),
        context
    );
    vm.runInContext(
        compile(
            selected("src/ui/index.ts", [
                "epgTimeCssColor",
                "popupList",
                "showPage",
            ])
        ),
        context
    );
    vm.runInContext(
        compile(
            selected("src/channels/index.ts", [
                "bucketsList",
                "renderGuideView",
                "renderCategoryRecordings",
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
    w.listFooterElement = w.listFooter;
    w.optionsArr = [{ action: w.settingsLists, name: "Lists settings" }];
    w.toggleProviderSettingsVisibility = function () {};
    w.popupActions = [w.optionsList, w.toggleProviderSettingsVisibility];
    w.popupArray = ["Settings", "Provider settings"];
    w.__ottClassicGuide = { cancelConsumers() {}, encodeRows: (rows) => rows };
    w.settings.interfaceTheme = 0;
    w.setColor();
    return {
        context,
        data,
        dom,
        render(kind) {
            if (kind === "menu") {
                w.popupList();
            } else if (kind === "settings") {
                w.optionsList();
            } else if (kind.startsWith("settings")) {
                w[kind]();
            } else if (kind === "recordings") {
                w.renderCategoryRecordings(0, {
                    channelIds: { one: 1 },
                    rows: [{ name: "One", programmeId: "one", time: 0 }],
                    selectedId: "one",
                });
            } else if (kind === "category") {
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

const listKinds = [
    "category",
    "channel",
    "epg",
    "archive",
    "recordings",
    "menu",
    "settings",
    "settingsLists",
    "settingsInfobar",
    "settingsChannels",
    "settingsButtons",
    "settingsMenu",
    "settingsManage",
    "media",
];

function rowAppearance(w, row) {
    const style = w.getComputedStyle(row);
    return {
        background: style.backgroundColor,
        borderStyle: style.borderBottomStyle,
        borderWidth: style.borderBottomWidth,
        color: style.color,
        height: style.height,
        margin: style.margin,
        padding: style.padding,
        selected: row.classList.contains("ott-selected"),
    };
}

for (const modern of [false, true]) {
    for (const kind of listKinds) {
        test(
            (modern ? "Modern " : "Classic ") +
                kind +
                " toggles all row separators without changing geometry or selection",
            () => {
                const f = fixture();
                const { w } = f;
                if (modern) w.document.body.classList.add("interface-modern");
                f.render(kind);
                const rows = [...w.listInElement.querySelectorAll(".item")];
                assert.ok(rows.length, "production screen renders rows");
                assert.ok(
                    rows.some((row) => row.classList.contains("ott-selected"))
                );
                const before = rows.map((row) => rowAppearance(w, row));
                const borders = rows.map(
                    (row) => w.getComputedStyle(row).borderBottomColor
                );
                const frames = ["listCaption", "listDetail", "dialogbox"].map(
                    (id) =>
                        w.getComputedStyle(w.document.getElementById(id)).border
                );
                if (!modern)
                    rows.forEach((row) => assert.match(f.shadow(row), /inset/));
                assert.equal(w.saveSettings({ showListSeparators: 0 }), true);
                rows.forEach((row, index) => {
                    assert.equal(f.shadow(row), "none");
                    if (modern)
                        assert.equal(
                            w.getComputedStyle(row).borderBottomColor,
                            "rgba(0, 0, 0, 0)"
                        );
                    assert.deepEqual(rowAppearance(w, row), before[index]);
                });
                assert.deepEqual(
                    ["listCaption", "listDetail", "dialogbox"].map(
                        (id) =>
                            w.getComputedStyle(w.document.getElementById(id))
                                .border
                    ),
                    frames
                );
                assert.equal(
                    f.shadow(w.document.querySelector("#dialogbox .item")),
                    "none"
                );
                // A rerender and navigation must obey the saved preference too.
                f.render("menu");
                assert.equal(f.shadow(f.row()), "none");
                f.render(kind);
                assert.equal(f.shadow(f.row()), "none");
                assert.equal(w.saveSettings({ showListSeparators: 1 }), true);
                [...w.listInElement.querySelectorAll(".item")].forEach(
                    (row, index) => {
                        if (modern)
                            assert.equal(
                                w.getComputedStyle(row).borderBottomColor,
                                borders[index]
                            );
                        else assert.match(f.shadow(row), /inset/);
                    }
                );
                assert.match(
                    f.shadow(w.document.querySelector("#dialogbox .item")),
                    /inset/
                );
                f.dom.window.close();
            }
        );
    }
}

test("navigation between content, settings, menu and recordings keeps separators hidden", () => {
    const f = fixture();
    f.w.saveSettings({ showListSeparators: 0 });
    for (const kind of [
        "category",
        "settingsLists",
        "menu",
        "recordings",
        "media",
        "channel",
    ]) {
        f.render(kind);
        assert.equal(f.shadow(f.row()), "none", kind);
    }
    f.w.settingsLists();
    f.w.listKeyHandlerFn(f.w.keys.RETURN);
    assert.equal(f.w.listCaptionElement.textContent, "Settings");
    assert.equal(f.shadow(f.row()), "none");
    f.dom.window.close();
});

test("Modern catalog card outlines and selected focus shadows are preserved", () => {
    const f = fixture();
    const { w } = f;
    w.document.body.classList.add("interface-modern");
    f.render("channel");
    w.listInElement.classList.add("modern-catalog");
    for (const kind of ["modern-card", "modern-channel"]) {
        f.row().className = "item " + kind + " ott-selected";
        const baseline = w.getComputedStyle(f.row());
        const appearance = [
            baseline.boxShadow,
            baseline.border,
            baseline.backgroundColor,
        ];
        assert.notEqual(
            appearance[0],
            "none",
            "selected catalog item has focus styling"
        );
        w.saveSettings({ showListSeparators: 0 });
        const after = w.getComputedStyle(f.row());
        assert.deepEqual(
            [after.boxShadow, after.border, after.backgroundColor],
            appearance
        );
        w.saveSettings({ showListSeparators: 1 });
    }
    f.dom.window.close();
});

for (const interfaceTheme of [1, 2]) {
    test(
        "theme " +
            interfaceTheme +
            " keeps its existing separator-free appearance",
        () => {
            const f = fixture();
            f.w.saveSettings({ interfaceTheme });
            f.render("menu");
            const before = rowAppearance(f.w, f.row());
            assert.equal(f.shadow(f.row()), "none");
            for (const showListSeparators of [0, 1]) {
                f.w.saveSettings({ showListSeparators });
                assert.equal(f.shadow(f.row()), "none");
                assert.deepEqual(rowAppearance(f.w, f.row()), before);
            }
            f.dom.window.close();
        }
    );
}

for (const modern of [false, true]) {
    test(
        (modern ? "Modern" : "Classic") +
            " new settings pages retain selection and hide separators",
        () => {
            const f = fixture();
            const { w } = f;
            if (modern) w.document.body.classList.add("interface-modern");
            w.settingsLists();
            const firstRow = f.row();
            w.saveSettings({ showListSeparators: 0 });
            w.settings.pageSize = 1;
            w.selIndex = 2;
            w.showPage(true);
            const row = w.document.getElementById("it2");
            assert.equal(firstRow.isConnected, false);
            assert.equal(w.selIndex, 2);
            assert.equal(row.classList.contains("ott-selected"), true);
            assert.equal(f.shadow(row), "none");
            if (modern)
                assert.equal(
                    w.getComputedStyle(row).borderBottomColor,
                    "rgba(0, 0, 0, 0)"
                );
            f.dom.window.close();
        }
    );
}

test("Lists settings Cancel discards a draft and Save applies it immediately", () => {
    const f = fixture();
    f.w.settingsLists();
    let row = f.w.listArray.find(
        (item) => item.settingId === "showListSeparators"
    );
    assert.equal(row.name, "Show list separators");
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
