"use strict";
// Small source/asset integration checks. No server, browser, native build or decoder.
const assert = require("node:assert/strict");
const { File } = require("node:buffer");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const acorn = require("acorn");
const root = path.resolve(__dirname, "..");
const bundle = require("../scripts/classic-bundle.cjs");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
function compiled(source, module = ts.ModuleKind.CommonJS) {
    return ts.transpileModule(source, {
        compilerOptions: { module, target: ts.ScriptTarget.ES5 },
    }).outputText;
}
function namedFunction(file, name) {
    const text = read(file);
    const parsed = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true
    );
    let found;
    function visit(node) {
        if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
            assert.equal(found, undefined, "one actual function: " + name);
            found = node.getText(parsed);
        }
        ts.forEachChild(node, visit);
    }
    visit(parsed);
    assert.ok(found, "actual source function: " + name);
    return found.replace(/^export\s+/, "");
}
function temporary(t) {
    const dir = fs.mkdtempSync(
        path.join(os.tmpdir(), "ott-local-drop-packaging-")
    );
    t.after(() => fs.rmSync(dir, { force: true, recursive: true }));
    return dir;
}

test("optional bundle links both actual modules and installs a usable drop factory", async (t) => {
    const dir = temporary(t);
    const modules = bundle.CLASSIC_OPTIONAL_BUNDLES["local-drop"];
    assert.deepEqual(modules, [
        "build/offline/dropped-video.js",
        "build/plugins/local-drop.js",
    ]);
    for (const file of modules) {
        assert.equal(bundle.CLASSIC_MAIN_MODULES.includes(file), false);
        assert.equal(
            Object.hasOwn(bundle.CLASSIC_PRIVATE_MODULES, file),
            false
        );
        const output = path.join(dir, file);
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(
            output,
            compiled(
                read(file.replace(/^build\//, "src/").replace(/\.js$/, ".ts")),
                ts.ModuleKind.ES2015
            )
        );
    }
    const assembled = bundle.assembleClassic(dir, modules);
    const { optimizeClassic } = require("../scripts/classic-optimizer.cjs");
    const {
        CLASSIC_PLAYER_NAME_POLICY,
    } = require("../scripts/classic-function-names.cjs");
    const { code } = await optimizeClassic(
        assembled,
        CLASSIC_PLAYER_NAME_POLICY
    );
    acorn.parse(code, { ecmaVersion: 5 });
    const handlers = new Map(),
        played = [];
    const w = {
        __ottActiveProviderDriver: {},
        __ottCommandChannelLoad: {},
        __ottLocalMedia: {
            playDroppedVideo(catalog, admitted) {
                assert.equal(admitted(), true);
                played.push(catalog);
            },
        },
        addEventListener(name, handler) {
            handlers.set(name, handler);
        },
        document: { createElement: () => ({ canPlayType: () => "probably" }) },
        File,
        removeEventListener() {},
        URL: {
            createObjectURL: () => "blob:synthetic/video",
            revokeObjectURL() {},
        },
    };
    vm.runInNewContext(code, { window: w });
    assert.ok(w.__ottLocalDrop);
    assert.equal(typeof handlers.get("drop"), "function");
    const event = {
        dataTransfer: {
            files: [
                new File(["synthetic"], "movie.mp4", { type: "video/mp4" }),
            ],
            types: ["Files"],
        },
        preventDefault() {
            this.prevented = true;
        },
        stopPropagation() {},
    };
    handlers.get("drop")(event);
    assert.equal(event.prevented, true);
    assert.equal(played.length, 1);
    assert.equal(played[0].items[0].url, "blob:synthetic/video");
    assert.equal(played[0].persistent, false);
});

test("PC and PC2 request the optional asset through the real getScriptDOM path", () => {
    const helpers = compiled(
        namedFunction("src/utils/helpers.ts", "loadScript") +
            "\n" +
            namedFunction("src/utils/helpers.ts", "getScriptDOM")
    );
    for (const device of ["pc", "pc2"]) {
        const appended = [];
        const document = {
            body: {
                appendChild(script) {
                    appended.push(script);
                },
            },
            createElement: () => ({}),
        };
        const context = {
            console,
            document,
            version: "",
            window: {
                __cv: "revision 1",
                host: "https://example.invalid/player",
            },
        };
        vm.runInNewContext(
            helpers + "\n" + read("devices/" + device + "/device.js"),
            context
        );
        assert.equal(appended.length, 1, device);
        assert.equal(
            appended[0].src,
            "https://example.invalid/player/dist/local-drop.js?revision%201",
            device
        );
        assert.equal(appended[0].type, "text/javascript");
    }
});

test("accepted browser File MIME reaches actual PC2 source selection without HLS fallback", () => {
    const exports = {};
    vm.runInNewContext(compiled(read("src/offline/dropped-video.ts")), {
        exports,
    });
    const w = {
        document: { createElement: () => ({ canPlayType: () => "probably" }) },
        File,
        URL: {
            createObjectURL: () => "blob:synthetic/video",
            revokeObjectURL() {},
        },
    };
    const sourceType = vm.runInNewContext(
        namedFunction("devices/pc2/device.js", "sourceType") + "\nsourceType",
        { w }
    );
    for (const [name, type, expected] of [
        ["movie.mp4", "", "video/mp4"],
        ["movie.mp4", "application/octet-stream", "video/mp4"],
        ["movie.webm", "", "video/webm"],
        ["movie.m4v", "application/octet-stream", "video/mp4"],
        ["movie.mov", "", "video/quicktime"],
        ["movie.mkv", "application/x-matroska", "video/x-matroska"],
    ]) {
        const dropped = exports.createDroppedVideo(
            w,
            new File(["synthetic"], name, { type })
        );
        const item = dropped.catalog.items[0];
        w.__ottLocalMedia = {
            playbackMime: (url) => (url === item.url ? item.mime : ""),
        };
        assert.equal(sourceType(item.url), expected, name + ":" + type);
        dropped.release();
    }
    assert.equal(
        sourceType("https://example.invalid/live"),
        "application/x-mpegURL"
    );
    assert.equal(
        sourceType("https://example.invalid/movie.webm"),
        "video/webm"
    );
});

test("new optional asset has an explicit finite packaging budget", () => {
    const { OPTIONAL_BUDGETS } = require("../scripts/classic-size.cjs");
    const budget = OPTIONAL_BUDGETS["local-drop"];
    assert.ok(
        budget,
        "the existing artifact writer rejects an optional asset without a budget"
    );
    assert.ok(Number.isFinite(budget.bytes) && budget.bytes > 0);
    assert.ok(Number.isFinite(budget.gzipBytes) && budget.gzipBytes > 0);
});

test("public offline shell includes the optional script without caching dropped media", (t) => {
    const dir = temporary(t);
    fs.mkdirSync(path.join(dir, "dist"));
    fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html>");
    fs.writeFileSync(
        path.join(dir, "dist/local-drop.js"),
        "/* synthetic asset */"
    );
    fs.writeFileSync(path.join(dir, "dist/movie.mp4"), "synthetic media");
    const { stageOfflineShell } = require("../scripts/offline-shell.cjs");
    const manifest = stageOfflineShell(dir);
    assert.ok(manifest.assets.includes("dist/local-drop.js"));
    assert.equal(manifest.assets.includes("dist/movie.mp4"), false);
});
