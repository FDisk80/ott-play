const { cloudSource } = require("./helpers/cloud-source-fixture.cjs");
const { localizationRuntime } = require("./helpers/localization-runtime.cjs");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const acorn = require("acorn");
const {
    attachSourceAliases,
    classicName,
} = require("./helpers/english-source-fixture.cjs");
const root = path.resolve(__dirname, "..");
const ts = require(path.join(root, "node_modules/typescript"));
const asts = {};
const bundleIndex = process.argv.indexOf("--bundle");
const bundleAst =
    bundleIndex >= 0
        ? ts.createSourceFile(
              "bundle.js",
              fs.readFileSync(
                  path.resolve(process.argv[bundleIndex + 1]),
                  "utf8"
              ),
              ts.ScriptTarget.Latest,
              true
          )
        : null;
const { JSDOM } = require(path.join(root, "node_modules/jsdom"));
const localizationCode = localizationRuntime(
    bundleIndex >= 0
        ? path.relative(root, path.resolve(process.argv[bundleIndex + 1]))
        : undefined
);
function ast(file) {
    return (
        asts[file] ||
        (asts[file] = ts.createSourceFile(
            file,
            fs.readFileSync(path.join(root, file), "utf8"),
            ts.ScriptTarget.Latest,
            true
        ))
    );
}
function js(text) {
    return ts.transpileModule(text.replace(/^export /gm, ""), {
        compilerOptions: {
            module: ts.ModuleKind.None,
            target: ts.ScriptTarget.ES5,
        },
    }).outputText;
}
function func(file, name) {
    if (file.startsWith("src/") && bundleAst) name = classicName(name);
    const a = (file.startsWith("src/") && bundleAst) || ast(file),
        n = a.statements.find(
            (n) => ts.isFunctionDeclaration(n) && n.name?.text === name
        );
    if (!n) throw Error(name);
    return js(n.getText(a));
}
function variable(file, name) {
    const a = (file.startsWith("src/") && bundleAst) || ast(file);
    for (const n of a.statements)
        if (ts.isVariableStatement(n))
            for (const d of n.declarationList.declarations)
                if (d.name.getText(a) === name)
                    return js("var " + d.getText(a) + ";");
    throw Error(name);
}
function interfaceColorSource() {
    return [
        variable("src/settings/interface-colors.ts", "interfaceColorRoles"),
        func("src/settings/interface-colors.ts", "normalizeColorRoles"),
        func("src/settings/interface-colors.ts", "parseInterfaceColorConfig"),
        ...[
            "interfaceColorRgb",
            "interfaceColorRules",
            "applyInterfaceColors",
        ].map((name) => func("src/ui/interface-colors.ts", name)),
    ].join("\n");
}
function fixture() {
    const d = new JSDOM(
        '<div id="listAbout" style="display:none"></div><div id="dialogbox" style="display:none"></div><div id="listEdit"></div><div id="listIn"></div><div id="listCaption"></div><div id="listDetail"></div><div id="listPodval"></div>',
        { runScripts: "dangerously", url: "https://localhost/index.html" }
    );
    const w = d.window;
    require("./helpers/shared-core-runtime.cjs")(d.getInternalVMContext());
    if (bundleAst) attachSourceAliases(w);
    w.console.warn = () => {};
    w.eval(
        fs.readFileSync(
            path.join(
                root,
                process.env.OTTPLAY_TEST_JQUERY || "js/jquery-1.11.1.min.js"
            ),
            "utf8"
        )
    );
    w.$.expr.filters.visible = (e) => e.style.display !== "none";
    w.eval(localizationCode);
    if (bundleAst) {
        w.eval(
            bundleAst.statements
                .filter(
                    (n) =>
                        ts.isFunctionDeclaration(n) &&
                        /^__ottReadImport/.test(n.name?.text || "")
                )
                .map((n) => n.getText(bundleAst))
                .join("\n")
        );
    }
    Object.assign(w, {
        _: (x) => x,
        bodyColor: "#fff",
        curColor: "gold",
        curColorB: "#668",
        host: "https://localhost",
        keys: {
            ENTER: 13,
            EXIT: 27,
            FF: 70,
            INFO: 73,
            N2: 50,
            NEXT: 78,
            RETURN: 8,
            RIGHT: 39,
        },
        listCaptionElement: w.document.getElementById("listCaption"),
        listDetail: w.document.getElementById("listDetail"),
        listFooterElement: w.document.getElementById("listPodval"),
        nativeListInertia: null,
        renderButtonHint: (key, s, label) =>
            '<span data-key="' + key + '">' + label + "</span>",
        restoreListPanelState() {},
        saveListPanelState() {},
        scrollUp() {},
        settingsRecoveryRequired: () => false,
        showPage() {},
        stbEventToKeyCode: (e) => e.keyCode,
        stbGetItem: () => null,
        strFF: "FF",
        strInfo: "Info",
        strNEXT: "Next",
        strRETURN: "Return",
        strRIGHT: "Right",
        ui_state: { ld: "Synthetic programme description" },
    });
    for (const name of [
        "strENTER",
        "strEXIT",
        "strSTOP",
        "strPLAY",
        "strPAUSE",
        "strPREV",
        "strRW",
        "strUP",
        "strDOWN",
        "strLEFT",
        "strTools",
        "strEPG",
        "strAudio",
        "strLANG",
        "strSubt",
        "strAspect",
        "strZoom",
        "strPip",
        "strFAV",
        "strMENU",
    ])
        w[name] = name;
    w.eval(
        [
            "metadataText",
            "metadataImageUrl",
            "metadataCssUrl",
            "metadataHtml",
            "hasTmdbService",
        ]
            .map((n) => func("src/utils/helpers.ts", n))
            .join("\n")
    );
    w.eval(func("src/ui/index.ts", "localizedTextHtml"));
    w.eval(func("src/storage/recovery-ui.ts", "showSettingsRecovery"));
    w.setTimeout = () => 1;
    w.clearTimeout = () => {};
    w.requestAnimationFrame = () => {};
    w.eval(func("src/storage/index.ts", "isInstallationSettingsKey"));
    w.eval(func("src/storage/index.ts", "isPortableSettingsKey"));
    return w;
}

let count = 0;
function test(name, run) {
    run();
    count++;
    console.log("PASS frontend safety: " + name);
}
const hostile =
    '<img src="missing" onerror="window.__executed=true"><script>window.__executed=true</script>';

test("startup document keeps initial presentation without inline style attributes", () => {
    const dom = new JSDOM(
        fs.readFileSync(path.join(root, "index.html"), "utf8"),
        { runScripts: "outside-only" }
    );
    try {
        const w = dom.window;
        assert.equal(w.document.querySelector("[style]"), null);
        const css = (id) => w.getComputedStyle(w.document.getElementById(id));
        assert.equal(
            w.getComputedStyle(w.document.body).backgroundColor,
            "rgb(17, 17, 17)"
        );
        assert.equal(
            w.getComputedStyle(w.document.body).color,
            "rgb(204, 204, 204)"
        );
        assert.equal(css("programm_descr_clip").overflow, "hidden");
        assert.equal(css("programm_clear").clear, "both");
        assert.equal(css("audio_badge").display, "none");
        w.document.getElementById("audio_badge").style.display = "inline-block";
        assert.equal(
            css("audio_badge").display,
            "inline-block",
            "runtime can reveal the audio badge"
        );
    } finally {
        dom.window.close();
    }
});

test("both native style creators preserve the author nonce without script authority", () => {
    const a = ast("src/index.ts");
    const functions = [];
    function visit(node) {
        if (
            ts.isFunctionExpression(node) &&
            node.body.statements.some(
                (statement) =>
                    ts.isVariableStatement(statement) &&
                    statement.declarationList.declarations.some(
                        (d) =>
                            d.name.getText(a) === "STYLE_ID" &&
                            /ott-tauri-(frameless-drag|loading-logs-style)/.test(
                                d.initializer?.getText(a) || ""
                            )
                    )
            )
        )
            functions.push(node);
        ts.forEachChild(node, visit);
    }
    visit(a);
    assert.equal(functions.length, 2);
    for (const initialNonce of ["native-style-authority", ""]) {
        const dom = new JSDOM(
            '<head><style id="ott-interface-style"></style><script nonce="wrong-script-authority"></script></head><body></body>',
            { runScripts: "outside-only" }
        );
        try {
            const w = dom.window;
            const authority = w.document.getElementById("ott-interface-style");
            authority.nonce = initialNonce;
            const getAttribute = authority.getAttribute.bind(authority);
            authority.getAttribute = (name) =>
                name === "nonce" ? "" : getAttribute(name);
            w.eval(func("src/index.ts", "createInterfaceStyle"));
            for (const expression of functions) {
                const statements = expression.body.statements;
                const needed = [
                    "CLASS",
                    "OVERLAY_CLASS",
                    "STYLE_ID",
                    "STRIP_ID",
                    "STRIP_H",
                    "NO_DRAG_SEL",
                    "PANEL_ID",
                ];
                const declarations = statements.filter(
                    (node) =>
                        ts.isVariableStatement(node) &&
                        node.declarationList.declarations.every((d) =>
                            needed.includes(d.name.getText(a))
                        )
                );
                const ensure = statements.find(
                    (node) =>
                        ts.isFunctionDeclaration(node) &&
                        node.name?.text === "ensureStyles"
                );
                const block =
                    ensure ||
                    statements.find(
                        (node) =>
                            ts.isIfStatement(node) &&
                            node.getText(a).includes("createInterfaceStyle()")
                    );
                assert(block, "execute the real native style creation path");
                const code =
                    declarations.map((node) => node.getText(a)).join("\n") +
                    "\n" +
                    block.getText(a) +
                    (ensure
                        ? "\nensureStyles(); ensureStyles();"
                        : "\n" + block.getText(a));
                w.eval(js("(function(){" + code + "})()"));
                const force = statements
                    .filter(ts.isVariableStatement)
                    .flatMap((node) =>
                        Array.from(node.declarationList.declarations)
                    )
                    .find((node) => node.name.getText(a) === "forceNoDragEl");
                if (force) {
                    w.eval(
                        js(
                            "window.fixtureNoDrag = " +
                                force.initializer.getText(a)
                        )
                    );
                    const footer = w.document.createElement("div");
                    footer.innerHTML =
                        '<button class="btn" style="app-region:no-drag!important;-webkit-app-region:no-drag!important" data-tauri-drag-region>Save</button>';
                    const button = footer.firstElementChild;
                    w.fixtureNoDrag(button);
                    assert.equal(
                        button.getAttribute("style"),
                        null,
                        "app-owned no-drag CSS must not re-enter saved panel HTML"
                    );
                    assert.equal(
                        button.hasAttribute("data-tauri-drag-region"),
                        false
                    );
                    const saved = footer.innerHTML;
                    footer.textContent = "";
                    footer.innerHTML = saved;
                    assert.equal(footer.querySelector("[style]"), null);
                    assert.equal(footer.textContent, "Save");
                    button.style.color = "red";
                    const removed = [];
                    const remove = button.style.removeProperty.bind(
                        button.style
                    );
                    button.style.removeProperty = (name) => {
                        removed.push(name);
                        return remove(name);
                    };
                    w.fixtureNoDrag(button);
                    assert.deepEqual(removed, [
                        "-webkit-app-region",
                        "app-region",
                    ]);
                    assert.equal(
                        button.style.color,
                        "red",
                        "unrelated styling survives"
                    );
                }
            }
            for (const id of [
                "ott-tauri-frameless-drag",
                "ott-tauri-loading-logs-style",
            ]) {
                const styles = w.document.querySelectorAll("#" + id);
                assert.equal(styles.length, 1);
                assert.equal(styles[0].nonce, initialNonce);
                assert(styles[0].sheet.cssRules.length > 0);
            }
            const targets = w.document.createElement("div");
            targets.innerHTML =
                '<div id="list"></div><div id="listIn"></div><div id="listCaption"></div>' +
                '<div class="item"></div><div id="it42"></div><div id="ott-tauri-drag-strip"></div>';
            w.document.body.appendChild(targets);
            w.document.documentElement.classList.add("ott-tauri-frameless");
            const dragStyle = w.document.getElementById(
                "ott-tauri-frameless-drag"
            );
            const rules = Array.from(dragStyle.sheet.cssRules);
            const matchingRules = (element) =>
                rules.filter(
                    (rule) =>
                        rule.selectorText && element.matches(rule.selectorText)
                );
            // JSDOM drops unknown native CSS properties from CSSOM. Read only
            // the two drag declarations from the actual generated flat sheet;
            // selectors still match the DOM, and ordinary CSS uses CSSOM below.
            const flatRule = /([^{}]+)\{([^{}]*)\}/g;
            assert.equal(
                dragStyle.textContent.replace(flatRule, "").trim(),
                "",
                "native stylesheet remains flat for this declaration reader"
            );
            const nativeRules = Array.from(
                dragStyle.textContent.matchAll(flatRule),
                (match) => ({
                    declarations: Array.from(
                        match[2].matchAll(
                            /(?:^|;)\s*((?:-webkit-)?app-region)\s*:\s*([^;]*)/g
                        ),
                        (declaration) => ({
                            important: /!important\s*$/i.test(declaration[2]),
                            property: declaration[1],
                            value: declaration[2]
                                .replace(/\s*!important\s*$/i, "")
                                .trim(),
                        })
                    ),
                    selector: match[1].trim(),
                })
            );
            const strip = targets.querySelector("#ott-tauri-drag-strip");
            for (const open of [false, true]) {
                w.document.documentElement.classList.toggle(
                    "ott-tauri-overlay-open",
                    open
                );
                for (const selector of [
                    "#list",
                    "#listIn",
                    "#listCaption",
                    ".item",
                    '[id^="it"]',
                    "#ott-tauri-drag-strip",
                ]) {
                    const element = targets.querySelector(selector);
                    for (const property of [
                        "-webkit-app-region",
                        "app-region",
                    ]) {
                        // Every applicable native declaration must agree, so
                        // specificity cannot re-enable native drag.
                        const declarations = nativeRules
                            .filter((rule) => element.matches(rule.selector))
                            .flatMap((rule) => rule.declarations)
                            .filter(
                                (declaration) =>
                                    declaration.property === property
                            );
                        assert(
                            declarations.length > 0,
                            `${selector} has ${property} protection with overlay=${open}`
                        );
                        for (const declaration of declarations) {
                            assert.equal(declaration.value, "no-drag");
                            assert.equal(declaration.important, true);
                        }
                    }
                }
                const computed = w.getComputedStyle(strip);
                assert.equal(computed.display === "none", open);
                assert.equal(computed.pointerEvents, open ? "none" : "auto");
                if (open) {
                    for (const property of ["display", "pointer-events"]) {
                        assert(
                            matchingRules(strip).some(
                                (rule) =>
                                    rule.style.getPropertyValue(property) ===
                                        "none" &&
                                    rule.style.getPropertyPriority(property) ===
                                        "important"
                            ),
                            `overlay ${property} remains authoritative`
                        );
                    }
                }
            }
        } finally {
            dom.window.close();
        }
    }
});

test("cloud bundle extraction selects exact closures and rejects missing dependencies", () => {
    const code = [
        'var STORAGE_FALLBACK_KEYS = "ottplayStorageFallback";',
        "function isStorageMetadataKey(key) { return key === STORAGE_FALLBACK_KEYS; }",
        "function isInstallationSettingsKey(key) { return isStorageMetadataKey(key); }",
        "function isPortableSettingsKey(key) { return !isInstallationSettingsKey(key); }",
        "var interfaceColorRoles = [];",
        "function normalizeColorRoles(value) { return value; }",
        "function parseInterfaceColorConfig(value) { return value; }",
        "function normalizeInterfaceColorConfig(value) { return value; }",
        "function serializeInterfaceColors(value) { return value; }",
        "function metadataText(value) { return value; }",
        "function settingsFailure() {}",
        "function commitSettingsWrites() {}",
        "var unrelated = 1, cloudSettingsTransfer = { send: function(){}, load: function(){} };",
        "function cloudSendSettings() { cloudSettingsTransfer.send(); }",
        "function cloudLoadSettings() { cloudSettingsTransfer.load(); }",
        "(function(){window.unrelatedBefore = true;})(), (function(){window.__ottSourceIdentity = {};})(), (function(){window.__ottCloudSettingsCodec = {};})(), (function(){window.unrelatedAfter = true;})();",
    ].join("\n");
    const parse = (value) =>
        ts.createSourceFile("artifact.js", value, ts.ScriptTarget.Latest, true);
    const extracted = cloudSource(parse(code));
    acorn.parse(extracted, { ecmaVersion: 5 });
    assert.equal(extracted.includes("unrelated"), false);
    for (const name of [
        "STORAGE_FALLBACK_KEYS",
        "isStorageMetadataKey",
        "isInstallationSettingsKey",
        "isPortableSettingsKey",
        "interfaceColorRoles",
        "normalizeColorRoles",
        "parseInterfaceColorConfig",
        "normalizeInterfaceColorConfig",
        "serializeInterfaceColors",
        "metadataText",
        "settingsFailure",
        "commitSettingsWrites",
        "cloudSettingsTransfer",
        "cloudSendSettings",
        "cloudLoadSettings",
        "__ottSourceIdentity",
        "__ottCloudSettingsCodec",
    ]) {
        const artifact = bundleAst ? bundleAst.text : code;
        assert.throws(
            () =>
                cloudSource(parse(artifact.replaceAll(name, name + "Missing"))),
            /Expected (?:one bundled cloud dependency|one storage policy function|storage metadata namespace)/,
            name + " must come from the supplied artifact"
        );
    }
});

test("cloud supplied-artifact extraction retains nonempty color normalization", () => {
    const supplied =
        bundleAst ||
        ts.createSourceFile(
            "cloud-source-artifact.js",
            cloudSource(),
            ts.ScriptTarget.Latest,
            true
        );
    const isolated = vm.createContext({ window: {} });
    const extracted = ts.createSourceFile(
        "extracted-cloud.js",
        cloudSource(supplied),
        ts.ScriptTarget.Latest,
        true
    );
    const colorNames = [
        "normalizeColorRoles",
        "parseInterfaceColorConfig",
        "normalizeInterfaceColorConfig",
        "serializeInterfaceColors",
    ];
    vm.runInContext(
        extracted.statements
            .filter(
                (node) =>
                    (ts.isFunctionDeclaration(node) &&
                        colorNames.includes(node.name?.text)) ||
                    (ts.isVariableStatement(node) &&
                        node.declarationList.declarations.some(
                            (item) =>
                                item.name.getText(extracted) ===
                                "interfaceColorRoles"
                        ))
            )
            .map((node) => node.getText(extracted))
            .join("\n"),
        isolated
    );
    assert.equal(
        isolated.normalizeInterfaceColorConfig(
            '{"colors":{"accent":"#aabbcc","background":"#010203"},"version":1}'
        ),
        '{"version":1,"colors":{"background":"#010203","accent":"#AABBCC"}}'
    );
});

test("channel list keeps hostile titles as text and preserves intentional row layout", () => {
    const w = fixture();
    try {
        const a = ast("src/provider/index.ts");
        let renderer, channelRow;
        function visit(n) {
            if (ts.isFunctionDeclaration(n) && n.name?.text === "channelRow")
                channelRow = n;
            if (
                ts.isVariableDeclaration(n) &&
                n.name.getText(a) === "channelItemFormatter" &&
                n.initializer &&
                ts.isFunctionExpression(n.initializer)
            )
                renderer = n.initializer;
            ts.forEachChild(n, visit);
        }
        visit(a);
        assert(renderer);
        assert(channelRow);
        Object.assign(w, {
            $infoBar: w.$("<div>"),
            archWidth: 0,
            boxH: 28,
            channelLogoSize: 0,
            channels: {
                fixture: {
                    channel_name: hostile,
                    name: hostile,
                    time: 1,
                    time_to: Date.now() / 1000 + 30,
                },
                other: { channel_name: "Other channel", name: "Other channel" },
            },
            currentProgramRequestQueue: [],
            getViewportWidthScale: () => 1,
            listArray: [],
            listDataArray: ["fixture", "other"],
            listElement: null,
            listFitPageSize: (wanted) => wanted,
            listInElement: w.document.getElementById("listIn"),
            listRowHeight: () => 28,
            numWidth: 0,
            observeCurrentProgramme() {},
            packListRowBoxes() {},
            parentalArray: [],
            parentPIN: "*",
            progBarH: 1,
            progMargin: 0,
            progWidth: 0,
            scheduleListDetailUpdate() {},
            selIndex: 0,
            settings: { noSmall: 1, pageSize: 25 },
            showName: true,
            showProgram: true,
            sPSchannels: false,
            updateChannelListRow() {},
        });
        // The renderer delegates roving focus and selected state to this real
        // port; keep it present in the fixture as it is in the classic bundle.
        w.eval(
            js(
                fs.readFileSync(
                    path.join(root, "src/ui/accessibility.ts"),
                    "utf8"
                )
            )
        );
        w.eval(
            js(
                "var view;" +
                    channelRow.getText(a) +
                    "window.getListItemFn=" +
                    renderer.getText(a) +
                    ";"
            ) + func("src/ui/index.ts", "showPage")
        );
        w.showPage();
        assert.equal(
            w.document.querySelectorAll("#listIn img,#listIn script").length,
            0
        );
        assert(w.document.getElementById("it0").textContent.includes(hostile));
        assert.equal(
            w.document.getElementById("it0").getAttribute("role"),
            "option"
        );
        assert.equal(w.document.getElementById("it0").tabIndex, 0);
        assert.equal(
            w.document.getElementById("it0").getAttribute("aria-selected"),
            "true"
        );
        assert.equal(
            w.document.getElementById("it1").getAttribute("role"),
            "option"
        );
        assert.equal(
            w.document.getElementById("it1").getAttribute("aria-selected"),
            "false"
        );
        assert.equal(w.document.getElementById("it1").tabIndex, -1);
        w.selIndex = 1;
        w.showPage();
        assert.equal(w.document.getElementById("it0").tabIndex, -1);
        assert.equal(
            w.document.getElementById("it0").getAttribute("aria-selected"),
            "false"
        );
        assert.equal(w.document.getElementById("it1").tabIndex, 0);
        assert.equal(
            w.document.getElementById("it1").getAttribute("aria-selected"),
            "true"
        );
        assert.equal(w.__executed, undefined);
    } finally {
        w.close();
    }
});
test("VOD descriptions and thumbnails preserve formatting while removing active content and unsafe attributes", () => {
    const w = fixture();
    try {
        w.eval(
            func("src/channels/index.ts", "getMediaDescr") +
                func("src/utils/helpers.ts", "getThumbnail")
        );
        w.sThumbnail = 1;
        w.getViewportWidthScale = () => 1;
        w.getViewportHeightScale = () => 1;
        const description =
            "<b>Heading</b><br>Detail <i>italic</i>" +
            hostile +
            '<svg onload="window.__executed=true"></svg><img src="javascript:alert(1)"><a href="javascript:alert(1)">link</a>';
        const target = w.document.getElementById("listDetail");
        target.innerHTML = w.getMediaDescr({ description: () => description });
        assert.equal(target.querySelector("b").textContent, "Heading");
        assert(target.querySelector("br"));
        assert(target.querySelector("i"));
        assert.equal(
            target.querySelectorAll(
                "script,svg,iframe,[onerror],[onload],[href]"
            ).length,
            0
        );
        assert.equal(target.querySelectorAll("img").length, 1);
        assert.equal(w.__executed, undefined);
        target.innerHTML = w.getThumbnail(
            'https://images.invalid/a\'");color:red;" onerror="window.__executed=true'
        );
        assert.equal(target.children.length, 1);
        assert.equal(target.querySelectorAll("[onerror]").length, 0);
        assert.equal(target.firstChild.style.color, "");
        for (const url of [
            "javascript:alert(1)",
            "file:///private",
            "data:text/html,<script>x</script>",
        ])
            assert.equal(w.metadataImageUrl(url), "");
        assert.equal(
            w.metadataImageUrl("https://images.invalid/icon?a=1&b=2"),
            "https://images.invalid/icon?a=1&b=2"
        );
        acorn.parse(func("src/utils/helpers.ts", "metadataHtml"), {
            ecmaVersion: 5,
        });
    } finally {
        w.close();
    }
});
test("EPG list titles are escaped without losing current-programme highlighting", () => {
    const w = fixture();
    try {
        Object.assign(w, {
            channels: { fixture: { rec: true } },
            epg_ch_id: "fixture",
        });
        w.eval(
            fs.readFileSync(path.join(root, "vendor/ottplay-core.js"), "utf8")
        );
        const programme = {
            name: hostile,
            programmeId: "guide-row",
            time: Date.now() / 1000 - 2,
            time_to: Date.now() / 1000 + 30,
        };
        w.listEpgArray = [programme];
        w.eval(
            func("src/channels/index.ts", "formatEpgTime") +
                func("src/channels/index.ts", "formatEpgDate") +
                func("src/channels/index.ts", "itemEPG")
        );
        w.document.getElementById("listIn").innerHTML = w.itemEPG(programme, 0);
        assert.equal(
            w.document.querySelectorAll("#listIn img,#listIn script").length,
            0
        );
        assert(w.document.querySelector("#listIn .ott-epg-current-title"));
        assert.equal(w.document.querySelector("#listIn [style]"), null);
        assert(
            w.document.getElementById("listIn").textContent.includes(hostile)
        );
        w._ = () => hostile;
        w.sEpgArchiveLabel = 0;
        programme.time_to = programme.time + 1;
        w.document.getElementById("listIn").innerHTML = w.itemEPG(programme, 0);
        assert.equal(
            w.document.querySelectorAll("#listIn img,#listIn script,[onerror]")
                .length,
            0
        );
        assert.equal(
            w.document
                .querySelector("#listIn .btn.green")
                .getAttribute("aria-label"),
            hostile
        );
        assert.equal(
            w.document.querySelector("#listIn .epg-archive-tag"),
            null
        );
    } finally {
        w.close();
    }
});
test("buttons help closes with Back and existing RETURN, while native cloud save opens export", () => {
    const w = fixture();
    try {
        w.eval(
            func("src/index.ts", "buttonsInfo") +
                func("src/key-handler/index.ts", "cancelNativeListInertia") +
                func("src/key-handler/index.ts", "keyHandler") +
                cloudSource(bundleAst)
        );
        for (const key of [w.keys.EXIT, w.keys.RETURN]) {
            w.buttonsInfo();
            w.keyHandler({
                keyCode: key,
                preventDefault() {},
                stopPropagation() {},
            });
            assert.equal(
                w.document.getElementById("listAbout").style.display,
                "none"
            );
        }
        let exported = 0;
        w.exportSettingsUI = () => exported++;
        w.Capacitor = {};
        w.cloudSendSettings();
        assert.equal(exported, 1);
        delete w.Capacitor;
        w.__TAURI__ = {};
        w.cloudSendSettings();
        assert.equal(exported, 2);
        delete w.__TAURI__;
        w.host_ott = "fixture.invalid";
        w.host_ott_proto = "https://";
        w.stbGetAllItems = () => ({
            fixture: "value",
            sLocalHttpDeviceCode: "private-device-code-do-not-upload",
            sLocalHttpEnabled: "1",
        });
        let post;
        w.$.ajax = (opts) => {
            post = opts;
        };
        w.cloudSendSettings();
        assert.equal(post.url, "https://fixture.invalid/swop/a.php");
        assert(post.data.d.includes("fixture"));
        assert(!post.data.d.includes("sLocalHttpEnabled"));
        assert(!post.data.d.includes("sLocalHttpDeviceCode"));
        assert(!post.data.d.includes("private-device-code-do-not-upload"));
    } finally {
        w.close();
    }
});
test("cloud restore ignores injected local HTTP consent and credentials", () => {
    const w = fixture();
    try {
        w.eval(cloudSource(bundleAst));
        const stored = new Map([
            ["sLocalHttpEnabled", "1"],
            ["sLocalHttpDeviceCode", "old-local-code"],
            ["ordinary", "old-value"],
        ]);
        let cleared = 0;
        let restarted = 0;
        let post;
        let poll;
        w.host_ott = "fixture.invalid";
        w.host_ott_proto = "https://";
        w.stbClearAllItems = () => {
            cleared++;
            stored.clear();
        };
        w.stbSetItem = (key, value) => stored.set(key, value);
        w.stbGetItem = (key) => stored.get(key) ?? null;
        w.stbDelItem = (key) => stored.delete(key);
        w.stbGetAllItems = () => Object.fromEntries(stored);
        w.restart = () => restarted++;
        w.setTimeout = (callback, delay) => {
            if (delay === 10000) poll = callback;
            return 1;
        };
        w.$.ajax = (options) => {
            post = options;
        };
        w.cloudLoadSettings();
        assert.equal(post.data.c, "get_code");
        post.success({ code: "transfer-code" });
        assert.equal(
            cleared,
            0,
            "requesting a cloud import must not change local consent"
        );
        poll();
        assert.equal(post.data.c, "get");
        assert.equal(post.data.d, "transfer-code");
        post.success({
            data:
                "<properties><comment>OTT-Play Preferences</comment>" +
                '<entry key="ordinary">restored-value</entry>' +
                '<entry key="sLocalHttpEnabled">1</entry>' +
                '<entry key="sLocalHttpDeviceCode">injected-code</entry>' +
                "</properties>",
            status: "success",
        });
        assert.equal(cleared, 0, "restore never clears the storage wholesale");
        assert.equal(restarted, 1);
        assert.equal(stored.get("ordinary"), "restored-value");
        assert.equal(
            stored.has("sLocalHttpEnabled"),
            false,
            "cloud imports cannot enable a local listener"
        );
        assert.equal(
            stored.has("sLocalHttpDeviceCode"),
            false,
            "cloud imports cannot copy another device's code"
        );
    } finally {
        w.close();
    }
});
test("Capacitor hides unavailable TMDb; web and Tauri retain the functional action", () => {
    const w = fixture();
    try {
        w.eval(
            js(
                fs.readFileSync(
                    path.join(root, "src/localization/assets.ts"),
                    "utf8"
                )
            ) +
                variable("src/index.ts", "TMDb") +
                func("src/ui/index.ts", "infoSearchFooter") +
                func("src/ui/index.ts", "searchInfoTmdb") +
                func("src/ui/index.ts", "showProgramInfo")
        );
        let calls = [];
        w.$.ajax = (opts) => calls.push(opts);
        w.Capacitor = {};
        w.showProgramInfo("A programme");
        assert(
            !w.document
                .getElementById("listPodval")
                .textContent.includes("TMDb")
        );
        w.TMDb.search("Blocked");
        assert.equal(calls.length, 0);
        delete w.Capacitor;
        w.__TAURI__ = {};
        w.showProgramInfo("A programme");
        assert(
            w.document.getElementById("listPodval").textContent.includes("TMDb")
        );
        w.aboutKeyHandler(w.keys.N2);
        assert.equal(calls.length, 1);
        assert(calls[0].url.includes("/tmdb/s/search/multi"));
        delete w.__TAURI__;
        w.TMDb.search("Web programme");
        assert.equal(calls.length, 2);
    } finally {
        w.close();
    }
});
test("programme and media info keep distinct search shortcuts and late service state", () => {
    for (const screen of ["programme", "media"]) {
        for (const enabled of [false, true]) {
            const w = fixture();
            try {
                let handler;
                let restored = 0;
                let service = enabled;
                const searches = [];
                const hints = [];
                const title = "A title <unchanged>";
                Object.assign(w, {
                    __ottClassicScreenPort: {
                        savedPanel: () => ({ ld: "Programme description" }),
                        setOwnedCallback: (_owner, next) => {
                            handler = next;
                        },
                    },
                    getMediaDescr: () => "Media description",
                    hasTmdbService: () => service,
                    listArray: [{ title }],
                    renderButtonHint: (...args) => {
                        hints.push(args);
                        return args[2];
                    },
                    restoreListPanelState: () => restored++,
                    sArrowFun: 2,
                    selIndex: 0,
                    sPNFun: 1,
                    sRewFun: 1,
                    TMDb: { search: (value) => searches.push(value) },
                });
                w.eval(
                    [
                        "infoSearchFooter",
                        "searchInfoTmdb",
                        "showProgramInfo",
                        "infoMedia",
                    ]
                        .map((name) => func("src/ui/index.ts", name))
                        .join("\n")
                );
                function open() {
                    if (screen === "programme") w.showProgramInfo(title);
                    else w.infoMedia();
                }
                for (const key of [
                    "N2",
                    "INFO",
                    "RIGHT",
                    "FF",
                    "NEXT",
                    "RETURN",
                ]) {
                    restored = 0;
                    searches.length = 0;
                    hints.length = 0;
                    open();
                    assert.equal(w.listCaptionElement.textContent, title);
                    assert.equal(
                        hints.some((hint) => hint[2] === "TMDb"),
                        enabled
                    );
                    if (enabled)
                        assert.equal(
                            hints.find((hint) => hint[2] === "TMDb")[4],
                            w.strRIGHT
                        );
                    assert.equal(handler(w.keys[key]), true);
                    const admitted =
                        key !== "RETURN" &&
                        (screen === "programme" ||
                            (key !== "FF" && key !== "NEXT"));
                    assert.deepEqual(
                        searches,
                        admitted && enabled ? [title] : []
                    );
                    assert.equal(restored, admitted ? 0 : 1);
                }
                for (const [key, setting] of [
                    ["RIGHT", "sArrowFun"],
                    ["FF", "sRewFun"],
                    ["NEXT", "sPNFun"],
                ]) {
                    restored = 0;
                    searches.length = 0;
                    w[setting] = 0;
                    open();
                    handler(w.keys[key]);
                    assert.deepEqual(searches, []);
                    assert.equal(
                        restored,
                        1,
                        "Unmapped shortcuts retain their close behavior"
                    );
                    w[setting] = setting === "sArrowFun" ? 2 : 1;
                }
                searches.length = 0;
                open();
                service = !enabled;
                handler(w.keys.N2);
                assert.deepEqual(
                    searches,
                    service ? [title] : [],
                    "Search samples current service availability"
                );
            } finally {
                w.close();
            }
        }
    }
});
const startupFailure = new Error(hostile + ' & "message"');
startupFailure.name = hostile + ' & "name"';
const startupCases = [
    ["Error", startupFailure, startupFailure.name, startupFailure.message],
    ["empty Error", new Error(""), "Error", ""],
    ["empty error shape", { message: "", name: "" }, "", ""],
    ["null", null, "Error", "null"],
    ["undefined", undefined, "Error", "undefined"],
    ["hostile string", hostile, "Error", hostile],
];
for (const entrypoint of ["startPlayer", "onStbReady"]) {
    for (const hasLaunch of [true, false]) {
        for (const [kind, failure, name, message] of startupCases) {
            test(
                entrypoint +
                    " handles thrown " +
                    kind +
                    (hasLaunch ? " as launch text" : " without a launch panel"),
                () => {
                    const w = fixture();
                    try {
                        const launch = w.document.createElement("div");
                        launch.id = "launch";
                        const button = w.document.createElement("button");
                        button.textContent = "Boot progress";
                        launch.appendChild(button);
                        if (hasLaunch) w.document.body.appendChild(launch);
                        let previous, existingBreaks;
                        let reachedFailure = false;
                        const fail = () => {
                            reachedFailure = true;
                            previous = launch.firstChild;
                            existingBreaks =
                                launch.querySelectorAll("br").length;
                            throw failure;
                        };
                        Object.assign(w, {
                            _: (key) =>
                                key === "Player could not start"
                                    ? "Не удалось запустить плеер"
                                    : key,
                            hostUrl: "https://localhost",
                            isPlayDistribution: () => true,
                            loadSettings: fail,
                            onPlayerStart() {},
                            PLAYER_VERSION: "fixture",
                            storage: { reset: fail },
                        });
                        const logged = [];
                        w.console.error = (error) => logged.push(error);
                        w.eval(
                            func("src/index.ts", "startupError") +
                                func("src/index.ts", entrypoint)
                        );
                        assert.doesNotThrow(() => w[entrypoint]());
                        assert.equal(reachedFailure, true);
                        assert.equal(logged.length, 1);
                        assert.equal(logged[0], failure);
                        assert.equal(launch.firstChild, previous);
                        if (hasLaunch) {
                            assert.equal(
                                launch.querySelector("b").textContent,
                                "Не удалось запустить плеер"
                            );
                            assert.equal(
                                launch.querySelectorAll("br").length,
                                existingBreaks + 2
                            );
                            assert.equal(
                                launch.lastChild.textContent,
                                entrypoint + " " + name + ": " + message
                            );
                        } else {
                            assert.equal(
                                w.document.getElementById("launch"),
                                null
                            );
                            assert.equal(launch.childNodes.length, 1);
                        }
                        assert.equal(
                            launch.querySelectorAll("img,script,[onerror]")
                                .length,
                            0
                        );
                        assert.equal(w.__executed, undefined);
                    } finally {
                        w.close();
                    }
                }
            );
        }
    }
}
for (const phase of ["request", "poll"]) {
    test(
        "remote provider " +
            phase +
            " errors display response text without HTML",
        () => {
            const w = fixture();
            try {
                const requests = [],
                    timers = [];
                Object.assign(w, {
                    __test: "",
                    host_ott: "localhost",
                    host_ott_proto: "https://",
                    isPlayDistribution: () => false,
                    listFooter: w.document.getElementById("listPodval"),
                    setTimeout: (callback, delay) =>
                        timers.push({ callback, delay }),
                });
                w.$.ajax = (request) => requests.push(request);
                w.eval(func("src/provider/index.ts", "edit_dealer_remote"));
                w.edit_dealer_remote();
                assert.equal(requests[0].data.c, "get_var");
                if (phase === "poll") {
                    requests[0].success({ code: "fixture-code" });
                    timers.find((timer) => timer.delay === 1e4).callback();
                    assert.equal(requests[1].data.c, "get_val");
                }
                const responseText = hostile + ' & "response"';
                requests[requests.length - 1].error({ responseText });
                const panel = w.document.getElementById("listEdit");
                assert.equal(panel.textContent, "ERROR:" + responseText);
                assert.equal(panel.firstChild.style.color, "red");
                assert.equal(panel.querySelectorAll("br").length, 3);
                assert.equal(
                    panel.querySelectorAll("img,script,[onerror]").length,
                    0
                );
                assert.equal(w.__executed, undefined);
            } finally {
                w.close();
            }
        }
    );
}
test("legacy editor treats captions and field values as text and round-trips saved input", () => {
    const w = fixture();
    try {
        w.eval(
            func("devices/legacy-core.js", "showEditKey2") +
                func("devices/legacy-core.js", "editKey2")
        );
        w.listCaption = w.document.getElementById("listCaption");
        w.saveCPD = () => {};
        w.restoreCPD = () => {};
        w.btnDiv = w.renderButtonHint;
        w.editCaption = hostile + ' & "caption"';
        w.editvar =
            '\"><img src="missing" onerror="window.__executed=true">&quot;&amp;';
        w.showEditKey2();
        const panel = w.document.getElementById("listEdit");
        const input = panel.querySelector("input");
        assert.equal(w.listCaption.textContent, w.editCaption);
        assert(panel.textContent.startsWith(w.editCaption + ":"));
        assert.equal(input.value, w.editvar);
        assert.equal(input.style.color, "gold");
        assert.equal(w.document.activeElement, input);
        assert.equal(
            w.document.querySelectorAll("img,script,[onerror]").length,
            0
        );
        const updated = 'https://example.invalid/?a="<&b=&quot;';
        input.value = updated;
        let saved;
        w.setEdit = () => (saved = w.editvar);
        w.editKey2(w.keys.ENTER);
        assert.equal(saved, updated);
        assert.equal(panel.style.display, "none");
        // CSS values must not escape into attributes or markup either.
        w.curColor = 'red;\" onfocus="window.__executed=true';
        w.showEditKey2();
        assert.equal(panel.querySelectorAll("[onfocus],img,script").length, 0);
        assert.equal(w.__executed, undefined);
    } finally {
        w.close();
    }
});
test("button hint label stripping is bounded on long unmatched tag starts", () => {
    // Isolate the label stage from the HTML sanitizer: a future sanitizer must
    // not make malformed markup trigger quadratic backtracking in this stage.
    const context = vm.createContext({
        _: (value) => value,
        keys: {},
        metadataHtml: (value) => value,
        translate: (value) => value,
        window: {},
    });
    vm.runInContext(
        func("src/utils/helpers.ts", "metadataText") +
            func("src/ui/index.ts", "renderButtonHint"),
        context
    );
    const call =
        (bundleAst ? classicName("renderButtonHint") : "renderButtonHint") +
        '(13, "Enter", description)';
    context.description = "<".repeat(150000);
    const rendered = vm.runInContext(call, context, { timeout: 2000 });
    assert(rendered.includes('aria-label="' + "&lt;".repeat(150000) + '"'));
    context.description = "<b>Play</b><br> / pause";
    assert(
        vm.runInContext(call, context).includes('aria-label=" Play   / pause"')
    );
});
test("real password action selects a secret editor; normal input restores text and controls are keyboard accessible", () => {
    const w = fixture();
    try {
        w.eval(
            func("src/ui/index.ts", "showEditKey2") +
                func("providers/xtream/provider.js", "editXtreamSettings") +
                func("src/ui/index.ts", "renderButtonHint")
        );
        w.xtream = {
            password: "synthetic-secret",
            server: "https://fixture.invalid",
            username: "fixture",
        };
        w.loadXtreamParams = () => {};
        w.showEditKey = w.showEditKey2;
        w.listCaption = w.document.getElementById("listCaption");
        w.listFooter = w.document.getElementById("listPodval");
        attachSourceAliases(w);
        w.editXtreamSettings();
        w.selIndex = 2;
        w.listKeyHandler(w.keys.ENTER);
        let input = w.document.getElementById("editvar");
        assert.equal(input.type, "password");
        assert.equal(input.value, "synthetic-secret");
        assert.equal(input.autocomplete, "off");
        assert.equal(input.getAttribute("aria-label"), "Enter password");
        w.editCaption = "Playlist URL";
        w.editvar = "https://fixture.invalid?a=1&b=2";
        w.showEditKey2();
        input = w.document.getElementById("editvar");
        assert.equal(input.type, "text");
        assert.equal(input.value, w.editvar);
        w.document.getElementById("listPodval").innerHTML = w.renderButtonHint(
            13,
            "▸",
            "<b>Play</b> / pause"
        );
        const control = w.document.querySelector('#listPodval [role="button"]');
        assert.equal(control.tabIndex, 0);
        assert(control.getAttribute("aria-label").includes("Play"));
        let pressed;
        w._doKey = (key) => (pressed = key);
        w.eval(func("src/ui/index.ts", "uiInit"));
        w.uiInit();
        control.focus();
        control.dispatchEvent(
            new w.KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                keyCode: 13,
            })
        );
        assert.equal(pressed, 13);
    } finally {
        w.close();
    }
});
test("button hints reject executable key values and sanitize every badge while preserving icons", () => {
    const w = fixture();
    try {
        w.eval(func("src/ui/index.ts", "renderButtonHint"));
        for (const key of [
            "13);window.__executed=1;//",
            '13\" onmouseover=\"window.__executed=1',
            "invalid",
        ]) {
            assert.equal(w.renderButtonHint(key, "Enter", "Confirm"), "");
        }
        const legacyIcon = '<span class="fontello">&#xe811;</span>';
        const nativeBundle =
            bundleAst && /\bsystem-icons\b/.test(bundleAst.text);
        const icon = nativeBundle
            ? require("../scripts/play-system-icons.cjs").transformPlaySystemIcons(
                  legacyIcon
              )
            : legacyIcon;
        const footer = w.document.getElementById("listPodval");
        footer.innerHTML = w.renderButtonHint(
            "13",
            icon + hostile,
            "<b>Confirm</b>" + hostile,
            icon + hostile,
            icon + hostile
        );
        assert.equal(
            footer.querySelectorAll("script,[onerror],[onmouseover],svg")
                .length,
            0
        );
        const badges = footer.querySelectorAll(".btn");
        assert.equal(badges.length, 3);
        for (const badge of badges) {
            const preserved = badge.querySelector(
                nativeBundle ? "span.system-icons" : "span.fontello"
            );
            assert(preserved, "Every badge retains its platform icon");
            const expected = w.document.createElement("div");
            expected.innerHTML = icon;
            assert.equal(preserved.textContent, expected.textContent);
        }
        const control = footer.querySelector('[role="button"]');
        assert.equal(control.tabIndex, 0);
        assert(control.getAttribute("aria-label").includes("Confirm"));
        let pressed;
        w._doKey = (key) => (pressed = key);
        w.eval(func("src/ui/index.ts", "uiInit"));
        w.uiInit();
        control.dispatchEvent(
            new w.KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                keyCode: 32,
            })
        );
        assert.equal(pressed, 13);
        assert.equal(w.__executed, undefined);
    } finally {
        w.close();
    }
});
test("notifications keep literal text while stream selectors preserve safe icon markup", () => {
    const w = fixture();
    try {
        const container = w.document.createElement("div");
        container.id = "notifications";
        w.document.body.appendChild(container);
        Object.defineProperty(w.document, "hidden", { value: false });
        Object.defineProperty(w.document, "visibilityState", {
            value: "visible",
        });
        w.eval(
            func("src/ui/notification-banners.ts", "createNotificationBanners")
        );
        w.channelNumberElement = w.document.createElement("div");
        w.document.body.appendChild(w.channelNumberElement);
        w.closeList = () => {};
        w.eval(
            func("src/ui/index.ts", "showShift") +
                func("src/ui/index.ts", "showSelectBox")
        );
        w.showShift("<b>Notice</b>" + hostile);
        const info = container.querySelector(".remote-notify-local");
        assert(info);
        assert.equal(info.textContent, "<b>Notice</b>" + hostile);
        assert.equal(info.querySelectorAll("b,script,[onerror]").length, 0);
        const legacyIcon = '<span class="fontello">&#xe811;</span>';
        const nativeBundle =
            bundleAst && /\bsystem-icons\b/.test(bundleAst.text);
        const icon = nativeBundle
            ? require("../scripts/play-system-icons.cjs").transformPlaySystemIcons(
                  legacyIcon
              )
            : legacyIcon;
        w.showSelectBox(0, [hostile, icon], () => {}, -1);
        assert.equal(
            w.channelNumberElement.querySelectorAll("script,[onerror]").length,
            0
        );
        assert(
            w.channelNumberElement.querySelector(
                "span.fontello, span.system-icons"
            )
        );
        assert.equal(
            w.channelNumberElement.querySelector(
                "span.fontello, span.system-icons"
            ).textContent,
            new JSDOM(icon).window.document.querySelector("span").textContent
        );
        assert.equal(w.__executed, undefined);
    } finally {
        w.close();
    }
});
test("Play URL policy explains remote HTTP rejection without changing Full or local endpoints", () => {
    const w = fixture();
    try {
        w.eval(
            func("src/provider/index.ts", "isPlayDistribution") +
                func("src/provider/index.ts", "checkProviderUrl")
        );
        w.providerDistribution = "play";
        let messages = [];
        w.alert = (message) => messages.push(message);
        assert.equal(
            w.checkProviderUrl("http://provider.invalid/playlist"),
            false
        );
        assert(messages[0].includes("HTTPS"));
        for (const url of [
            "https://provider.invalid/playlist",
            "http://127.0.0.1:8080/commands",
            "http://localhost/internal",
            "/demo/pattern.mp4",
        ])
            assert.equal(w.checkProviderUrl(url), true);
        w.providerDistribution = "full";
        assert.equal(
            w.checkProviderUrl("http://provider.invalid/playlist"),
            true
        );
    } finally {
        w.close();
    }
});
test("EPG color updates an already-rendered time row across default, custom and legacy", () => {
    const w = fixture();
    try {
        w.eval(
            fs.readFileSync(path.join(root, "vendor/ottplay-core.js"), "utf8")
        );
        const programme = {
            name: "Programme",
            programmeId: "color-row",
            time: 100,
            time_to: 200,
        };
        Object.assign(w, {
            $tooltipSpan: null,
            channels: { fixture: { rec: false } },
            epg_ch_id: "fixture",
            listEpgArray: [programme],
            settings: {
                epgTimeColor: 0,
                highlightColor: "50,85",
                highlightColorB: "255,0",
                highlightColorSel: "50,85",
                interfaceTheme: 0,
                osdOpacity: 7,
                showListSeparators: 0,
            },
            stbSetOsdOpacity() {},
            tooltip: null,
        });
        w.eval(
            interfaceColorSource() +
                variable("src/settings/index.ts", "epgTimeColors") +
                func("src/settings/index.ts", "epgTimeColorPair") +
                func("src/ui/index.ts", "hsvToRgb") +
                func("src/ui/index.ts", "epgTimeCssColor") +
                func("src/index.ts", "classicColorRgb") +
                func("src/index.ts", "setColor") +
                func("src/channels/index.ts", "formatEpgTime") +
                func("src/channels/index.ts", "formatEpgDate") +
                func("src/channels/index.ts", "itemEPG")
        );
        const list = w.document.getElementById("listIn");
        list.innerHTML = w.itemEPG(programme, 0);
        const time = list.querySelector(".ott-epg-time"),
            original = list.innerHTML;
        const structure = () => {
            const copy = list.cloneNode(true);
            copy.querySelector(".ott-epg-time").removeAttribute("style");
            return copy.innerHTML;
        };
        assert(time);
        for (const [value, color] of [
            [0, "inherit"],
            [6 + 211 * 101 + 65, "rgb(89,169,255)"],
            [106, "rgb(255,0,0)"],
            [36466, "rgb(255,0,0)"],
            [1, "#FFFFFF"],
            [2, "#FFFF00"],
            [3, "#00FFFF"],
            [4, "#00FF00"],
            [5, "#FFB3FF"],
            [0, "inherit"],
        ]) {
            w.settings.epgTimeColor = value;
            w.setColor();
            assert.equal(
                w.document.documentElement.style.getPropertyValue(
                    "--ott-epg-time-color"
                ),
                color
            );
            assert.equal(
                list.querySelector(".ott-epg-time"),
                time,
                "No row replacement"
            );
            assert.equal(structure(), original);
            assert.equal(
                time.style.length,
                1,
                "Only the time color is changed"
            );
            assert.equal(time.style.item(0), "color");
            assert.equal(w.settings.showListSeparators, 0);
            assert.equal(
                w.document.body.classList.contains("hide-list-separators"),
                true
            );
        }
        for (const hue of [0, 360]) {
            w.settings.highlightColor = hue + ",100";
            w.settings.highlightColorSel = hue + ",100";
            w.setColor();
            assert.equal(w.curColor, "rgb(255,0,0)");
            assert.equal(w.curColorB, "rgb(128,0,0)");
        }
        for (const value of [
            undefined,
            -1,
            36467,
            6.5,
            NaN,
            Infinity,
            "1",
            "red;display:none",
            "__proto__",
        ]) {
            w.settings.epgTimeColor = value;
            w.setColor();
            assert.equal(
                w.document.documentElement.style.getPropertyValue(
                    "--ott-epg-time-color"
                ),
                "inherit"
            );
        }
        // The shared colour update must keep the two preferences independent.
        w.settings.epgTimeColor = 6 + 211 * 101 + 65;
        w.setColor();
        assert.equal(
            w.document.body.classList.contains("hide-list-separators"),
            true
        );
        w.settings.showListSeparators = 1;
        w.setColor();
        assert.equal(
            w.document.body.classList.contains("hide-list-separators"),
            false
        );
        assert.equal(w.settings.epgTimeColor, 6 + 211 * 101 + 65);
        assert.equal(
            w.document.documentElement.style.getPropertyValue(
                "--ott-epg-time-color"
            ),
            "rgb(89,169,255)"
        );
    } finally {
        w.close();
    }
});

test("EPG color paints current and future rows without CSS variables", () => {
    const w = fixture();
    try {
        w.eval(
            fs.readFileSync(path.join(root, "vendor/ottplay-core.js"), "utf8")
        );
        w.Date.now = () => 150000;
        // Model a legacy engine that ignores custom properties. Begin with no
        // stylesheet: the real boot loader does not await player.css.
        const rootStyle = w.document.documentElement.style;
        const setProperty = rootStyle.setProperty.bind(rootStyle);
        rootStyle.setProperty = (name, value, priority) => {
            if (!name.startsWith("--")) setProperty(name, value, priority);
        };
        const programme = {
            name: "Programme <unchanged>",
            programmeId: "legacy-color",
            time: 100,
            time_to: 200,
        };
        Object.assign(w, {
            $infoBar: w.$("<div>"),
            $tooltipSpan: null,
            channels: { fixture: { rec: false } },
            epg_ch_id: "fixture",
            getViewportWidthScale: () => 1,
            listArray: [programme],
            listDataArray: [programme],
            listElement: null,
            listEpgArray: [programme],
            listFitPageSize: (wanted) => wanted,
            listInElement: w.document.getElementById("listIn"),
            listRowHeight: () => 28,
            packListRowBoxes: () => 28,
            requestAnimationFrame: () => 1,
            scheduleListDetailUpdate() {},
            selIndex: 0,
            settings: {
                epgTimeColor: 0,
                highlightColor: "50,85",
                highlightColorB: "255,0",
                highlightColorSel: "50,85",
                interfaceTheme: 0,
                noSmall: 1,
                osdOpacity: 7,
                pageSize: 25,
                showListSeparators: 0,
                showScroll: 0,
            },
            stbSetOsdOpacity() {},
            tooltip: null,
        });
        w.eval(
            interfaceColorSource() +
                variable("src/settings/index.ts", "epgTimeColors") +
                func("src/settings/index.ts", "epgTimeColorPair") +
                func("src/ui/index.ts", "hsvToRgb") +
                func("src/ui/index.ts", "epgTimeCssColor") +
                func("src/index.ts", "classicColorRgb") +
                func("src/index.ts", "setColor") +
                func("src/channels/index.ts", "formatEpgTime") +
                func("src/channels/index.ts", "formatEpgDate") +
                func("src/channels/index.ts", "itemEPG") +
                func("src/ui/index.ts", "showPage")
        );
        w.getListItemFn = w.itemEPG;
        const list = w.document.getElementById("listIn");
        assert(
            !w.itemEPG(programme, 0).includes("style="),
            "No inline markup is introduced"
        );
        w.settings.epgTimeColor = 2;
        w.setColor();
        w.showPage();
        assert.equal(
            w.getComputedStyle(list.querySelector(".ott-epg-time")).color,
            "rgb(255, 255, 0)",
            "First render does not depend on stylesheet readiness"
        );
        assert.equal(
            list.querySelector(".ott-epg-time").getAttribute("dir"),
            "auto"
        );
        assert.equal(list.querySelector("unchanged"), null);
        const style = w.document.createElement("style");
        const css = fs.readFileSync(
            path.join(root, "styles/player.css"),
            "utf8"
        );
        const shippedRule = css.match(/\.ott-epg-time\s*\{[^}]*\}/);
        assert(shippedRule);
        style.textContent = shippedRule[0];
        w.document.head.appendChild(style);
        style.sheet.cssRules[0].style.removeProperty("color");
        for (const [value, expected] of [
            [1, "rgb(255, 255, 255)"],
            [2, "rgb(255, 255, 0)"],
            [3, "rgb(0, 255, 255)"],
            [4, "rgb(0, 255, 0)"],
            [5, "rgb(255, 179, 255)"],
            [6 + 211 * 101 + 65, "rgb(89, 169, 255)"],
            [36466, "rgb(255, 0, 0)"],
        ]) {
            const current = list.querySelector(".ott-epg-time");
            const title = list.querySelector(".ott-epg-current-title");
            const titleColor = title.style.color;
            w.settings.epgTimeColor = value;
            w.setColor();
            assert.equal(w.getComputedStyle(current).color, expected);
            assert.equal(
                list.querySelector(".ott-epg-time"),
                current,
                "Recolor must not replace the row"
            );
            assert.equal(
                title.style.color,
                titleColor,
                "Programme highlighting is unchanged"
            );
            assert.equal(title.textContent, programme.name);
            w.showPage();
            const future = list.querySelector(".ott-epg-time");
            assert.notEqual(
                future,
                current,
                "Exercise an actual subsequent render"
            );
            assert.equal(w.getComputedStyle(future).color, expected);
            assert.equal(
                rootStyle.getPropertyValue("--ott-epg-time-color"),
                ""
            );
        }
        for (const value of [0, undefined, -1, 36467, 6.5, NaN, "1"]) {
            w.settings.epgTimeColor = value;
            w.setColor();
            assert.equal(
                list.querySelector(".ott-epg-time").style.color,
                "inherit",
                "Default or invalid value clears the current color"
            );
            w.showPage();
            assert.equal(
                list.querySelector(".ott-epg-time").style.color,
                "inherit",
                "Inherited color also survives a later render"
            );
        }
        const originalPair = w.epgTimeColorPair;
        let colorReads = 0;
        w.epgTimeColorPair = (value) => {
            colorReads++;
            return originalPair(value);
        };
        w.listArray = w.listDataArray = [
            programme,
            { ...programme, programmeId: "second" },
        ];
        w.settings.epgTimeColor = 36466;
        w.showPage();
        assert.equal(list.querySelectorAll(".ott-epg-time").length, 2);
        assert.equal(
            colorReads,
            1,
            "Resolve the shared color once per painted page"
        );
        assert(
            [...list.querySelectorAll(".ott-epg-time")].every(
                (node) => node.style.color === "rgb(255, 0, 0)"
            )
        );
        assert.equal(w.settings.showListSeparators, 0);
    } finally {
        w.close();
    }
});

(async function () {
    const w = fixture();
    try {
        const a = ast("src/index.ts");
        const block = a.statements.find(
            (n) =>
                ts.isIfStatement(n) &&
                n.getText(a).includes("window.stbExit = function") &&
                n.getText(a).includes("stopBackgroundAudio")
        );
        assert(block);
        const calls = [];
        let finishStop;
        w.stbStop = () => calls.push("decoder");
        w.Capacitor = {
            Plugins: {
                App: {
                    exitApp: async () => {
                        calls.push("app-exit");
                        throw Error("fixture unavailable");
                    },
                },
                MobileNativeMedia: {
                    exitApp: async () => calls.push("fallback-exit"),
                    stopBackgroundAudio: () => {
                        calls.push("native-stop");
                        return new Promise((resolve) => (finishStop = resolve));
                    },
                },
            },
        };
        w.eval(js(block.getText(a)));
        w.stbExit();
        assert.deepEqual(calls, ["decoder", "native-stop"]);
        finishStop();
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.deepEqual(calls, [
            "decoder",
            "native-stop",
            "app-exit",
            "fallback-exit",
        ]);
        count++;
        console.log(
            "PASS frontend safety: native exit waits for media stop and handles async App failure"
        );
    } finally {
        w.close();
    }
    console.log("Frontend safety: " + count + " scenarios passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
