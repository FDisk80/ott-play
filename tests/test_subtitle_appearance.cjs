const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const helperSource = fs.readFileSync("src/utils/helpers.ts", "utf8");
const helperAst = ts.createSourceFile(
    "helpers.ts",
    helperSource,
    ts.ScriptTarget.Latest,
    true
);
const scaleSource = helperAst.statements
    .filter(
        (node) =>
            ts.isFunctionDeclaration(node) &&
            ["uiFontScale", "uiFontSize"].includes(node.name?.text)
    )
    .map((node) => node.getText(helperAst))
    .join("\n");
const scaleCode = ts
    .transpileModule(scaleSource, {
        compilerOptions: {
            module: ts.ModuleKind.ES2015,
            target: ts.ScriptTarget.ES5,
        },
    })
    .outputText.replace(/^export /gm, "");
function bindScale(target) {
    Object.defineProperty(target, "sUiFontScale", {
        get: () => target.settings.uiFontScale,
    });
    vm.runInNewContext(scaleCode, target);
}
const source = fs.readFileSync("src/ui/subtitle-appearance.ts", "utf8");
const code = ts.transpileModule(source, {
    compilerOptions: {
        module: ts.ModuleKind.None,
        target: ts.ScriptTarget.ES5,
    },
}).outputText;
require("acorn").parse(code, { ecmaVersion: 5 });
const host = {
    getComputedStyle: () => ({ objectFit: "contain" }),
    settings: {},
    window: null,
};
host.window = host;
bindScale(host);
vm.runInNewContext(code, host);
const api = host.__ottSubtitleAppearance;
const media = (width, height, vw = 1920, vh = 1080) => ({
    getBoundingClientRect: () => ({ height, width }),
    videoHeight: vh,
    videoWidth: vw,
});
assert.equal(
    api.declarations(media(1280, 720), {}),
    "",
    "default leaves source appearance alone"
);
const settings = {
    subtitleBackground: 3,
    subtitleFontFamily: 2,
    subtitleFontSize: 3,
    subtitleOutline: 3,
    subtitleTextColor: 2,
};
const css = api.declarations(media(1280, 720), settings);
assert.match(css, /font-family:Georgia,serif/);
assert.match(css, /font-size:36px/);
assert.match(css, /color:#ffff00/);
assert.match(css, /text-shadow:.*2px/);
assert.match(css, /background-color:rgba\(0,0,0,0.5\)/);
assert.doesNotMatch(
    css,
    /(?:^|;)(?:position|top|bottom|left|right|line|align|transform|padding|width|height):/
);
assert.match(
    api.declarations(media(320, 180), settings),
    /font-size:9px/,
    "PiP scales to its own rendered video height"
);
assert.match(
    api.declarations(media(1280, 720, 1920, 800), settings),
    /font-size:26.67px/,
    "letterbox content, not viewport, determines font size"
);
assert.equal(
    api.declarations(media(0, 0), { subtitleFontSize: 2 }),
    "",
    "hidden video never receives a synthetic minimum font size"
);
for (const value of [-1, 99, NaN, Infinity, 1.5, "1", "url(https://invalid)"])
    assert.equal(
        api.declarations(media(1280, 720), {
            subtitleBackground: value,
            subtitleFontFamily: value,
            subtitleFontSize: value,
            subtitleOutline: value,
            subtitleTextColor: value,
        }),
        "",
        "invalid persisted settings cannot inject CSS"
    );
const elements = [],
    video = media(1280, 720);
video.setAttribute = () => {};
video.closest = () => null;
host.document = {
    createElement: () => ({}),
    head: { appendChild: (node) => elements.push(node) },
    querySelectorAll: () => [video],
};
host.settings = settings;
api.apply();
assert.equal(elements.length, 1);
assert.match(
    elements[0].textContent,
    /video\[data-ott-subtitle-style="0"\]::cue/
);
host.settings = {};
api.apply();
assert.equal(
    elements[0].textContent,
    "",
    "reset removes all prior style overrides"
);
console.log(
    "PASS subtitle appearance defaults, validation, per-video scale and reset"
);

// Static player typography uses authored values, never the previous scaled result.
{
    function rule(value, selector = ".label", priority = "") {
        return {
            selectorText: selector,
            style: {
                fontSize: value,
                getPropertyPriority: () => priority,
                setProperty(name, next, nextPriority) {
                    assert.equal(name, "font-size");
                    assert.equal(nextPriority, priority);
                    this.fontSize = next;
                    this.writes = (this.writes || 0) + 1;
                },
            },
        };
    }
    const px = rule("20px", ".label", "important");
    const vh = rule("3vh");
    const vw = rule("4vw");
    const pt = rule("12pt");
    const complex = rule("clamp(13px, 1.15vw, 20px)");
    const relative = ["1.2em", "120%", "inherit", "larger"].map((value) =>
        rule(value)
    );
    const cue = rule("24px", "video::cue");
    const external = rule("36px");
    const unknownInline = rule("18px");
    const runtime = rule("11px");
    const sheets = [
        {
            cssRules: [px, { cssRules: [vh, vw, pt] }, cue, ...relative],
            href: "https://player.example/styles/player.css?v=1",
        },
        {
            cssRules: [complex],
            href: null,
            ownerNode: { id: "ott-interface-style" },
        },
        {
            get cssRules() {
                assert.fail("cross-origin CSS must not be inspected");
            },
            href: "https://external.example/styles/player.css",
        },
        { cssRules: [external], href: "https://player.example/videojs.css" },
        { cssRules: [unknownInline], href: null, ownerNode: { id: "other" } },
    ];
    const fontHost = {
        document: { styleSheets: sheets },
        location: new URL("https://player.example/f/pc/"),
        settings: { uiFontScale: 20 },
        URL,
    };
    fontHost.window = fontHost;
    bindScale(fontHost);
    vm.runInNewContext(code, fontHost);
    for (const value of [20, 23, 40, 50, 100, 200]) {
        fontHost.settings.uiFontScale = value;
        assert.equal(fontHost.uiFontScale(), value / 100);
    }
    for (const value of [19, 201, 20.5, NaN, Infinity, "20"]) {
        fontHost.settings.uiFontScale = value;
        assert.equal(fontHost.uiFontScale(), 1);
    }
    fontHost.settings.uiFontScale = 20;
    const scaleFonts = fontHost.__ottSubtitleAppearance.scaleFonts;
    scaleFonts();
    assert.equal(px.style.fontSize, "4px");
    assert.equal(vh.style.fontSize, "0.6000000000000001vh");
    assert.equal(vw.style.fontSize, "0.8vw");
    assert.equal(pt.style.fontSize, "2.4000000000000004pt");
    assert.equal(
        complex.style.fontSize,
        "clamp(2.6px, 0.22999999999999998vw, 4px)"
    );
    fontHost.settings.uiFontScale = 150;
    sheets.push({
        cssRules: [runtime],
        href: null,
        ownerNode: { id: "ott-tauri-loading-logs-style" },
    });
    scaleFonts();
    assert.equal(px.style.fontSize, "30px");
    assert.equal(
        runtime.style.fontSize,
        "16.5px",
        "late trusted style is discovered"
    );
    fontHost.settings.uiFontScale = 100;
    scaleFonts();
    assert.equal(px.style.fontSize, "20px");
    assert.equal(vh.style.fontSize, "3vh");
    assert.equal(vw.style.fontSize, "4vw");
    assert.equal(pt.style.fontSize, "12pt");
    assert.equal(complex.style.fontSize, "clamp(13px, 1.15vw, 20px)");
    assert.equal(runtime.style.fontSize, "11px");
    for (const untouched of [cue, external, unknownInline, ...relative])
        assert.equal(untouched.style.writes, undefined);
    fontHost.settings.uiFontScale = 19;
    scaleFonts();
    assert.equal(
        px.style.fontSize,
        "20px",
        "invalid scale is treated as the default"
    );
}
console.log(
    "PASS interface font scaling preserves authored values, nested rules and excluded typography"
);

const entry = fs.readFileSync("src/index.ts", "utf8");
const ast = ts.createSourceFile(
    "entry.ts",
    entry,
    ts.ScriptTarget.Latest,
    true
);
const loaderSource = ast.statements
    .filter(
        (node) =>
            (ts.isFunctionDeclaration(node) &&
                [
                    "classicColorRgb",
                    "loadSubtitleAppearance",
                    "openSubtitleAppearance",
                    "notifySubtitleAppearanceReady",
                ].includes(node.name?.text)) ||
            (ts.isVariableStatement(node) &&
                node.declarationList.declarations.some((item) =>
                    [
                        "subtitleAppearanceLoading",
                        "subtitleAppearanceGeneration",
                        "subtitleAppearanceOpen",
                        "subtitleAppearanceReady",
                    ].includes(item.name.getText(ast))
                )) ||
            (ts.isExpressionStatement(node) &&
                ts.isBinaryExpression(node.expression) &&
                node.expression.left
                    .getText(ast)
                    .match(/\.(applySubtitleAppearance|__ottAppearanceHost)/))
    )
    .map((node) => node.getText(ast))
    .join("\n");
const colorAst = ts.createSourceFile(
    "ui.ts",
    fs.readFileSync("src/ui/index.ts", "utf8"),
    ts.ScriptTarget.Latest,
    true
);
const colorSource = colorAst.statements
    .filter(
        (node) =>
            ts.isFunctionDeclaration(node) && node.name?.text === "hsvToRgb"
    )
    .map((node) => node.getText(colorAst))
    .join("\n");
function loaderFixture() {
    const calls = [],
        timers = new Map(),
        notices = [],
        f = { active: true, applied: 0, opened: 0, settings: {} };
    let nextTimer = 0;
    Object.assign(f, {
        _: (text) => text,
        __ottActiveProviderDriver: {},
        __ottClassicScreenPort: {
            listOwner: () => ({ active: () => f.active }),
        },
        clearTimeout: (id) => timers.delete(id),
        createSettingsPage() {},
        document: {
            createElement: () => ({}),
            head: {
                appendChild(node) {
                    node.parentNode = {
                        removeChild() {
                            node.parentNode = null;
                        },
                    };
                    calls.push(node);
                },
            },
        },
        hostUrl: "https://player.example",
        languageNames: {},
        PLAYER_VERSION: "test-version",
        p_pref: "source-one",
        setListArrays() {},
        setTimeout: (fn) => {
            timers.set(++nextTimer, fn);
            return nextTimer;
        },
        showShift: (text) => notices.push(text),
    });
    f.window = f;
    vm.createContext(f);
    vm.runInContext(
        ts
            .transpileModule(colorSource + "\n" + loaderSource, {
                compilerOptions: {
                    module: ts.ModuleKind.ES2015,
                    target: ts.ScriptTarget.ES5,
                },
            })
            .outputText.replace(/^export /gm, ""),
        f
    );
    f.ready = () => {
        f.__ottSubtitleAppearance = {
            apply: () => f.applied++,
            open: () => f.opened++,
        };
        calls.at(-1).onload();
    };
    return { calls, f, notices, timers };
}
{
    const { f, calls } = loaderFixture();
    assert.equal(f.__ottAppearanceHost.color("50,85", 100), "255,219,38");
    assert.equal(f.__ottAppearanceHost.color("240,25", 50), "96,96,128");
    assert.equal(f.__ottAppearanceHost.color("255,0"), "0,0,0");
    assert.equal(f.__ottAppearanceHost.color("120,50"), "0,128,0");
    f.applySubtitleAppearance();
    assert.equal(
        calls.length,
        0,
        "default startup loads no appearance or editor code"
    );
    f.settings.subtitleFontSize = 2;
    f.applySubtitleAppearance();
    assert.equal(calls.length, 1);
    assert.equal(
        calls[0].src,
        "https://player.example/dist/subtitle-appearance.js?test-version"
    );
    f.ready();
    assert.equal(f.applied, 1);
}
for (const revoke of [
    (f) => {
        f.active = false;
    },
    (f) => {
        f.p_pref = "source-two";
    },
]) {
    const { f, calls } = loaderFixture();
    f.openSubtitleAppearance("open");
    revoke(f);
    f.ready();
    assert.equal(
        f.opened,
        0,
        "late load cannot reopen after Back or source change"
    );
    assert.equal(calls.length, 1);
}

{
    const { f, calls, timers, notices } = loaderFixture();
    f.openSubtitleAppearance("open");
    const late = calls[0].onload;
    [...timers.values()][0]();
    assert.deepEqual(notices, ["Failed to load!"]);
    assert.equal(f.opened, 0);
    assert.equal(calls[0].parentNode, null);
    f.openSubtitleAppearance("open");
    assert.equal(calls.length, 2, "timeout permits an immediate retry");
    late();
    assert.equal(
        f.opened,
        0,
        "late completion from expired generation is ignored"
    );
    f.ready();
    assert.equal(f.opened, 1);
    assert.equal(timers.size, 0);
}
{
    const { f, calls, notices } = loaderFixture();
    f.openSubtitleAppearance("open");
    calls[0].onerror();
    assert.deepEqual(notices, ["Failed to load!"]);
    f.openSubtitleAppearance("open");
    assert.equal(calls.length, 2, "failed asset permits retry without reload");
}
console.log(
    "PASS subtitle lazy loader: no default request, versioned asset, stale UI cancellation"
);
{
    const watching = new Set();
    let current = video;
    const observedHost = {
        addEventListener() {},
        document: {
            ...host.document,
            addEventListener() {},
            querySelectorAll: () => [current],
        },
        getComputedStyle: host.getComputedStyle,
        ResizeObserver: class {
            observe(target) {
                watching.add(target);
            }
            unobserve(target) {
                watching.delete(target);
            }
        },
        settings,
        window: null,
    };
    observedHost.window = observedHost;
    vm.runInNewContext(
        ts.transpileModule(
            fs.readFileSync("src/ui/subtitle-appearance.ts", "utf8"),
            {
                compilerOptions: {
                    module: ts.ModuleKind.None,
                    target: ts.ScriptTarget.ES5,
                },
            }
        ).outputText,
        observedHost
    );
    observedHost.__ottSubtitleAppearance.apply();
    assert(watching.has(current));
    const removed = current;
    current = { ...video };
    observedHost.__ottSubtitleAppearance.apply();
    assert(
        !watching.has(removed),
        "replaced engine video is released by ResizeObserver"
    );
    assert(watching.has(current));
    assert.equal(watching.size, 1);
}
console.log("PASS subtitle observer releases a replaced engine video");

{
    const { f, calls } = loaderFixture();
    const results = [];
    f.__ottAppearanceHost.ready((ready) => results.push(ready));
    const cancel = f.__ottAppearanceHost.ready(() =>
        assert.fail("cancelled readiness callback")
    );
    f.openSubtitleAppearance("open");
    cancel();
    assert.equal(
        calls.length,
        1,
        "UI and remote readiness share one asset load"
    );
    f.ready();
    assert.deepEqual(results, [true]);
    assert.equal(
        f.opened,
        1,
        "readiness callback preserves the pending UI open"
    );
    f.__ottAppearanceHost.ready((ready) => results.push(ready));
    assert.deepEqual(results, [true, true]);
    assert.equal(calls.length, 1);
}
{
    const { f, calls } = loaderFixture();
    const results = [];
    f.__ottAppearanceHost.ready((ready) => results.push(ready));
    calls[0].onerror();
    assert.deepEqual(results, [false]);
    assert.equal(f.opened, 0);
}
console.log(
    "PASS shared subtitle readiness: single load, cancelled observers, preserved UI open, explicit failure"
);
