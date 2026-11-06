"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function source(file, names) {
    const ast = ts.createSourceFile(
        file,
        read(file),
        ts.ScriptTarget.Latest,
        true
    );
    return ast.statements
        .filter((node) => {
            if (ts.isImportDeclaration(node)) return false;
            if (!names) return true;
            if (ts.isFunctionDeclaration(node))
                return names.includes(node.name?.text);
            return (
                ts.isVariableStatement(node) &&
                node.declarationList.declarations.some((item) =>
                    names.includes(item.name.getText(ast))
                )
            );
        })
        .map((node) => node.getText(ast))
        .join("\n");
}

function fixture() {
    const dom = new JSDOM(
        '<style id="ott-interface-style" nonce="style-proof"></style>' +
            '<body class="hide-list-separators"><div id="list"><div id="listCaption"></div>' +
            '<div id="listIn"></div><div id="listDetail"></div><div id="listPodval"></div></div>' +
            '<div id="listPopUp"></div><div id="dialogbox"></div><div id="mask" class="list_back"></div>' +
            '<div id="overlay" class="osd"></div><div id="progress"></div><div id="programm_name2"></div>' +
            '<div class="ott-epg-time"></div><div id="listAbout"></div><div id="listEdit"></div>' +
            '<video style="background-color: black"></video></body>',
        {
            runScripts: "outside-only",
            url: "https://player.example/",
        }
    );
    const w = dom.window;
    const context = dom.getInternalVMContext();
    vm.runInContext(read("js/jquery-1.11.1.min.js"), context);
    Object.assign(w, {
        $tooltipSpan: null,
        bodyColor: "#f0f0f0",
        curColor: "gold",
        curColorB: "#668",
        settings: {
            epgTimeColor: 0,
            highlightColor: "50,85",
            highlightColorB: "255,0",
            highlightColorSel: "240,25",
            interfaceMode: 0,
            interfaceTheme: 0,
            osdOpacity: 7,
            showListSeparators: 0,
            uiColorConfig: "",
        },
        tooltip: null,
    });
    const code = [
        source("src/settings/interface-colors.ts"),
        source("src/settings/index.ts", ["epgTimeColors", "epgTimeColorPair"]),
        source("src/ui/index.ts", [
            "hsvToRgb",
            "epgTimeCssColor",
            "clickKey",
            "clickVal",
        ]),
        source("src/ui/interface-colors.ts"),
        source("src/index.ts", [
            "classicColorRgb",
            "setColor",
            "stbSetOsdOpacity",
        ]),
    ].join("\n");
    vm.runInContext(
        ts
            .transpileModule(code, {
                compilerOptions: {
                    module: ts.ModuleKind.ES2015,
                    target: ts.ScriptTarget.ES5,
                },
            })
            .outputText.replace(/^export /gm, ""),
        context
    );
    return { dom, w };
}

function configure(w, colors) {
    w.settings.uiColorConfig = w.serializeInterfaceColors(colors);
    w.setColor();
}

function ownedRules(w, element, property) {
    const style = w.document.getElementById("ott-interface-colors-style");
    return Array.from(style.sheet.cssRules)
        .filter(
            (rule) =>
                element.matches(rule.selectorText) &&
                rule.style.getPropertyValue(property)
        )
        .map((rule) => ({
            priority: rule.style.getPropertyPriority(property),
            value: rule.style.getPropertyValue(property),
        }));
}

test("empty/reset retains all three themes, opacity, separators and video styles", () => {
    const { w } = fixture();
    try {
        for (const theme of [0, 1, 2]) {
            w.settings.interfaceTheme = theme;
            w.setColor();
            const before = w.document.body.outerHTML;
            const globals = [w.curColor, w.curColorB, w.bodyColor];
            configure(w, {
                accent: "#ABCDEF",
                background: "#102030",
                border: "#334455",
                selection: "#223344",
                selectionText: "#EEDDCC",
                surface: "#345678",
                text: "#FEDCBA",
            });
            assert.equal(w.curColor, "#ABCDEF");
            assert.equal(
                w.document.getElementById("overlay").style.backgroundColor,
                "rgba(52, 86, 120, 0.7)"
            );
            w.stbSetOsdOpacity(40);
            assert.equal(
                w.document.getElementById("overlay").style.backgroundColor,
                "rgba(52, 86, 120, 0.4)"
            );
            w.settings.uiColorConfig = "";
            w.setColor();
            assert.equal(w.document.body.outerHTML, before);
            assert.deepEqual([w.curColor, w.curColorB, w.bodyColor], globals);
            assert.equal(
                w.document.getElementById("ott-interface-colors-style"),
                null
            );
        }
    } finally {
        w.close();
    }
});

test("new selected rows and EPG nodes receive literal important rules independently of accent", () => {
    const { w } = fixture();
    try {
        configure(w, {
            accent: "#112233",
            epgTime: "#AABBCC",
            selection: "#445566",
            selectionText: "#DDEEFF",
        });
        const style = w.document.getElementById("ott-interface-colors-style");
        assert.equal(style.getAttribute("nonce"), "style-proof");
        const row = w.document.createElement("div");
        row.className = "item ott-selected";
        row.style.color = w.curColor;
        row.style.backgroundColor = w.curColorB;
        row.innerHTML = '<span class="ott-channel-programme">Programme</span>';
        w.document.getElementById("listIn").appendChild(row);
        assert.deepEqual(ownedRules(w, row.firstChild, "color").at(-1), {
            priority: "important",
            value: "rgb(221, 238, 255)",
        });
        const time = w.document.createElement("span");
        time.className = "ott-epg-time";
        time.style.color = "inherit";
        w.document.getElementById("listDetail").appendChild(time);
        assert.deepEqual(ownedRules(w, time, "color").at(-1), {
            priority: "important",
            value: "rgb(170, 187, 204)",
        });
        assert.equal(w.curColor, "#112233");
        assert.doesNotMatch(style.textContent, /var\(/);
        const same = style;
        w.setColor();
        assert.equal(
            w.document.getElementById("ott-interface-colors-style"),
            same
        );
        assert.equal(
            w.document.querySelectorAll("#ott-interface-colors-style").length,
            1
        );
        w.settings.uiColorConfig = "";
        w.setColor();
        assert.equal(row.style.color, "rgb(255, 219, 38)");
        assert.equal(row.style.backgroundColor, "rgb(96, 96, 128)");
        assert.equal(time.style.color, "inherit");

        // Real hard-coded theme declarations must lose to explicit light roles.
        const baseline = w.document.createElement("style");
        const css = read("styles/player.css");
        const selectors = [
            "#modernPlayer .modern-player-panel",
            ".btn",
            "#listEdit .osk-cap",
            ".theme-studio #_name .ott-channel-detail-accent",
            ".theme-studio #_nextpr",
        ];
        baseline.textContent = selectors
            .map((selector) => {
                const start = css.indexOf("\n" + selector + " {");
                assert.notEqual(
                    start,
                    -1,
                    selector + " is an existing theme rule"
                );
                return css.slice(start, css.indexOf("}", start) + 1);
            })
            .join("\n");
        w.document.head.appendChild(baseline);
        w.document.body.classList.add("interface-modern");
        w.settings.interfaceTheme = 2;
        w.document.getElementById("listDetail").innerHTML =
            '<div id="_name"><span class="ott-channel-detail-accent">Title</span></div>' +
            '<div id="_nextpr" class="ott-channel-next-overlay">Next</div>';
        w.document.getElementById("listEdit").innerHTML =
            '<div class="osk-cap">Caption</div><input id="editvar"><div class="osk-key">Key</div>';
        row.innerHTML = '<span class="btn">Save settings</span>';
        const player = w.document.createElement("div");
        player.id = "modernPlayer";
        player.innerHTML = '<div class="modern-player-panel">Controls</div>';
        w.document.body.appendChild(player);
        configure(w, {
            accent: "#123456",
            selection: "#DDEEFF",
            selectionText: "#112233",
            surface: "#FAFAFA",
            text: "#223344",
        });
        const light = { priority: "important", value: "rgb(250, 250, 250)" };
        assert.deepEqual(
            ownedRules(w, player.firstChild, "background").at(-1),
            light
        );
        const panelRule = Array.from(
            w.document.getElementById("ott-interface-colors-style").sheet
                .cssRules
        ).find((rule) => rule.selectorText.includes(".modern-player-panel"));
        assert.equal(
            panelRule.style.getPropertyValue("background-image"),
            "none"
        );
        assert.deepEqual(ownedRules(w, row.firstChild, "background").at(-1), {
            priority: "important",
            value: "rgb(221, 238, 255)",
        });
        assert.deepEqual(ownedRules(w, row.firstChild, "color").at(-1), {
            priority: "important",
            value: "rgb(17, 34, 51)",
        });
        assert.deepEqual(
            ownedRules(w, w.document.querySelector("#_name span"), "color").at(
                -1
            ),
            {
                priority: "important",
                value: "rgb(18, 52, 86)",
            }
        );
        assert.deepEqual(
            ownedRules(w, w.document.querySelector(".osk-cap"), "color").at(-1),
            {
                priority: "important",
                value: "rgb(34, 51, 68)",
            }
        );
        assert.deepEqual(
            ownedRules(
                w,
                w.document.getElementById("editvar"),
                "background-color"
            ).at(-1),
            light
        );
        assert.deepEqual(
            ownedRules(
                w,
                w.document.getElementById("_nextpr"),
                "background-color"
            ).at(-1),
            light
        );
    } finally {
        w.close();
    }
});

test("partial palette leaves unrelated roles alone and covers a later Modern switch", () => {
    const { w } = fixture();
    try {
        configure(w, { background: "#102030" });
        const css = w.document.getElementById(
            "ott-interface-colors-style"
        ).textContent;
        assert.doesNotMatch(
            css,
            /--modern-text|--modern-accent|[{;]color:#102030/
        );
        w.document.body.classList.add("interface-modern");
        assert.deepEqual(
            ownedRules(
                w,
                w.document.getElementById("list"),
                "background-color"
            ).at(-1),
            { priority: "important", value: "rgb(16, 32, 48)" }
        );
        assert.deepEqual(
            ownedRules(w, w.document.body, "--modern-surface").at(-1),
            { priority: "important", value: "#102030" }
        );
        assert.equal(
            w.document.body.classList.contains("hide-list-separators"),
            true
        );
        w.settings.uiColorConfig =
            '{"version":1,"colors":{"text":"red;display:none"}}';
        w.setColor();
        assert.equal(
            w.document.getElementById("ott-interface-colors-style"),
            null
        );
    } finally {
        w.close();
    }
});

test("preview returns complete HEX roles and inherited EPG follows effective text", () => {
    const { w } = fixture();
    try {
        const classic = w.interfaceColorPreview(w.settings);
        assert.equal(classic.background, "#000000");
        assert.equal(classic.selection, "#606080");
        assert.equal(classic.accent, "#FFDB26");
        const pli = w.interfaceColorPreview({
            ...w.settings,
            interfaceTheme: 1,
        });
        assert.equal(pli.selection, "#303240");
        assert.equal(pli.selectionText, "#FCC000");
        const studio = w.interfaceColorPreview({
            ...w.settings,
            interfaceTheme: 2,
        });
        assert.equal(studio.selection, "#E7F1EB");
        assert.equal(studio.selectionText, "#112119");
        const modern = w.interfaceColorPreview({
            ...w.settings,
            interfaceMode: 1,
        });
        assert.equal(modern.background, "#22282A");
        assert.equal(modern.selection, "#F5F5F7");
        assert.equal(modern.selectionText, "#15171D");
        for (const interfaceTheme of [0, 1, 2]) {
            const values = {
                ...w.settings,
                interfaceTheme,
                uiColorConfig: w.serializeInterfaceColors({
                    accent: "#00FF00",
                }),
            };
            assert.equal(
                w.interfaceColorPreview(values).selectionText,
                interfaceTheme === 2 ? "#112119" : "#00FF00"
            );
            assert.equal(
                w.interfaceColorPreview(values).border,
                ["#00FF00", "#555555", "#2B3430"][interfaceTheme]
            );
            assert.equal(
                w.interfaceColorPreview({ ...values, interfaceMode: 1 })
                    .selectionText,
                "#15171D"
            );
            assert.equal(
                w.interfaceColorPreview({ ...values, interfaceMode: 1 }).border,
                "#555B69"
            );
            values.uiColorConfig = w.serializeInterfaceColors({
                accent: "#00FF00",
                border: "#773311",
                selectionText: "#224466",
            });
            assert.equal(
                w.interfaceColorPreview(values).selectionText,
                "#224466"
            );
            assert.equal(w.interfaceColorPreview(values).border, "#773311");
        }
        for (const interfaceMode of [0, 1]) {
            for (const interfaceTheme of [0, 1, 2]) {
                const values = { ...w.settings, interfaceMode, interfaceTheme };
                values.uiColorConfig = w.serializeInterfaceColors({
                    text: "#123ABC",
                });
                const preview = w.interfaceColorPreview(values);
                assert.equal(Object.keys(preview).length, 9);
                Object.values(preview).forEach((value) =>
                    assert.match(value, /^#[0-9A-F]{6}$/)
                );
                assert.equal(preview.epgTime, "#123ABC");
                values.epgTimeColor = 3;
                assert.equal(
                    w.interfaceColorPreview(values).epgTime,
                    "#00FFFF"
                );
                values.uiColorConfig = w.serializeInterfaceColors({
                    epgTime: "#654321",
                });
                assert.equal(
                    w.interfaceColorPreview(values).epgTime,
                    "#654321"
                );
            }
        }
    } finally {
        w.close();
    }
});

test("real keyboard/value focus moves its styling marker without dispatch changes", () => {
    const { w } = fixture();
    try {
        configure(w, { selectionText: "#ABCDEF" });
        const panel = w.document.getElementById("listEdit");
        panel.innerHTML =
            '<div id="ik0" class="osk-key ott-selected">A</div><div id="ik1" class="osk-key">B</div>';
        const calls = [];
        Object.assign(w, {
            _curVal: 1,
            _keyCur: 0,
            aboutKeyHandler: null,
            editKey1: (key) => calls.push(key),
            keys: { ENTER: 13 },
            listDetailElement: null,
        });
        w.clickKey(1);
        assert.equal(
            w.document.getElementById("ik0").classList.contains("ott-selected"),
            false
        );
        assert.equal(
            w.document.getElementById("ik1").classList.contains("ott-selected"),
            true
        );
        assert.deepEqual(calls, [13]);
        w.document
            .getElementById("listAbout")
            .append(...Array.from(panel.children));
        w.clickVal(0, true);
        assert.equal(
            w.document.getElementById("ik1").classList.contains("ott-selected"),
            false
        );
        assert.deepEqual(
            ownedRules(w, w.document.getElementById("ik0"), "color").at(-1),
            { priority: "important", value: "rgb(171, 205, 239)" }
        );
        assert.deepEqual(calls, [13]);
    } finally {
        w.close();
    }
});

test("real PIN cursor and provider quality renderer mark only the selected control", () => {
    const { dom, w } = fixture();
    try {
        configure(w, { selectionText: "#ABCDEF" });
        let handler;
        const owner = { active: () => true, foreground: () => true, own() {} };
        Object.assign(w, {
            __ottClassicScreenPort: {
                close() {},
                setOwnedCallback(_kind, callback) {
                    handler = callback;
                    callback.owner = owner;
                    return callback;
                },
            },
            __ottSourceIdentity: { current: () => "fixture" },
            keys: { ENTER: 13, LEFT: 37, RIGHT: 39 },
            parentPIN: "fixture-only",
            providerGetItem() {},
            providerSetItem() {},
        });
        for (let digit = 0; digit < 10; digit++)
            w.keys["N" + digit] = 100 + digit;
        const code =
            read("src/access/session.ts") +
            "\n" +
            source("src/access/classic-adapter.ts", ["createClassicAccess"]);
        vm.runInContext(
            ts.transpileModule(code, {
                compilerOptions: {
                    module: ts.ModuleKind.None,
                    target: ts.ScriptTarget.ES5,
                },
            }).outputText,
            dom.getInternalVMContext()
        );
        w.createClassicAccess(w).pin("PIN", () =>
            assert.fail("navigation must not submit")
        );
        assert.equal(
            w.document
                .getElementById("k1")
                .classList.contains("ott-color-selected"),
            true
        );
        handler(w.keys.RIGHT);
        assert.equal(
            w.document
                .getElementById("k1")
                .classList.contains("ott-color-selected"),
            false
        );
        assert.equal(
            w.document
                .getElementById("k2")
                .classList.contains("ott-color-selected"),
            true
        );
        assert.deepEqual(
            ownedRules(w, w.document.getElementById("k2"), "color").at(-1),
            { priority: "important", value: "rgb(171, 205, 239)" }
        );
    } finally {
        w.close();
    }

    const f = require("./helpers/edem-driver-fixture.cjs").edemFixture();
    f.mount("edem");
    f.host.playMedia({ request: {}, title: "Movie" });
    f.requests.at(-1).resolve({
        url: "high",
        variants: Object.fromEntries([
            ["Low", "low"],
            ["High", "high"],
        ]),
    });
    const before = f.panels["#dialogbox"].html;
    assert.match(before, /id="edemQuality1" class="ott-color-selected"/);
    f.host.dialogBoxKeyHandler(f.host.keys.RIGHT);
    const after = f.panels["#dialogbox"].html;
    assert.match(after, /id="edemQuality0" class="ott-color-selected"/);
    assert.doesNotMatch(after, /id="edemQuality1" class="ott-color-selected"/);
    assert.equal(f.events.filter((event) => event[0] === "play").length, 0);
});
