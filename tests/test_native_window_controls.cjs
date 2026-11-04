const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
const acorn = require("acorn");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
    path.join(root, "src/ui/menu-registry.ts"),
    "utf8"
);
const code = ts.transpileModule(source, {
    compilerOptions: {
        module: ts.ModuleKind.None,
        target: ts.ScriptTarget.ES5,
    },
}).outputText;
acorn.parse(code, { ecmaVersion: 5 });

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, reject, resolve };
}

function fixture() {
    const script = vm.createContext({});
    script.window = script;
    vm.runInContext(code, script);
    let owner = null;
    let locked = false;
    let topmost = false;
    let fullscreen = false;
    const calls = [],
        messages = [];
    const host = {
        _: (key) => key,
        __ottClassicScreenPort: { listOwner: () => owner },
        __ottKiosk: { locked: () => locked },
        __ottTauriNativeFs: false,
        closeList() {
            calls.push(["close"]);
            owner = null;
        },
        keys: {},
        navigator: { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        popupActions: [],
        popupArray: [],
        popupDetail: [],
        sHideMenus: [],
        showPopup: (message) => messages.push(message),
        sNoColorKeys: 1,
        sNoNumbersKeys: 1,
    };
    const current = {
        isAlwaysOnTop() {
            assert.equal(this, current);
            calls.push(["read"]);
            return Promise.resolve(topmost);
        },
        label: "main",
    };
    const native = {
        invoke(command, args) {
            assert.equal(this, native);
            calls.push([command, args && JSON.parse(JSON.stringify(args))]);
            if (command === "toggle_fullscreen") {
                fullscreen = !fullscreen;
                return Promise.resolve({ fullscreen, ok: true });
            }
            assert.equal(command, "set_always_on_top");
            topmost = args.alwaysOnTop;
            return Promise.resolve({ alwaysOnTop: topmost, ok: true });
        },
    };
    host.__TAURI__ = {
        core: native,
        window: { getCurrentWindow: () => current },
    };
    const registry = script.__ottMenuRegistry;
    function open() {
        const menu = registry.open(host);
        owner = { foreground: () => true };
        menu.bindOwner();
        return menu;
    }
    function action(menu, kind) {
        return menu.rows.find((row) => row.id === "window." + kind).action();
    }
    return {
        action,
        calls,
        close() {
            owner = null;
        },
        current,
        host,
        lock() {
            locked = true;
        },
        messages,
        native,
        open,
        registry,
        replace() {
            owner = { foreground: () => true };
        },
    };
}

test("native main window has one provider-independent pair in both presentation modes", () => {
    const f = fixture();
    for (const mode of [0, 1]) {
        f.host.sInterfaceMode = mode;
        for (const provider of ["m3u", "plex", "vportal", "local"]) {
            f.host.p_pref = provider;
            const rows = f.open().rows;
            assert.deepEqual(
                Array.from(rows, (row) => row.id),
                ["window.fullscreen", "window.alwaysOnTop"]
            );
            assert.match(rows[0].name, />L<.*Full screen/);
            assert.equal(rows[1].name, "Always on top");
        }
    }
    f.host.sHideMenus = ["window.alwaysOnTop"];
    assert.deepEqual(
        Array.from(f.open().rows, (row) => row.id),
        ["window.fullscreen"]
    );
    assert.deepEqual(f.host.popupActions, []);
    assert.deepEqual(f.calls, [], "opening a menu has no native side effects");
});

test("browser, mobile, PiP and missing native APIs expose no native window actions", () => {
    for (const change of [
        (f) => {
            delete f.host.__TAURI__;
        },
        (f) => {
            f.host.__TAURI__ = {};
        },
        (f) => {
            f.host.Capacitor = {};
        },
        (f) => {
            f.host.navigator.userAgent = "Android";
        },
        (f) => {
            f.host.navigator.userAgent = "iPad";
        },
        (f) => {
            f.host.navigator.userAgent = "Macintosh; Mobile Safari";
        },
        (f) => {
            f.current.label = "pip";
        },
        (f) => {
            delete f.native.invoke;
        },
        (f) => {
            f.host.__TAURI__.window.getCurrentWindow = () => {
                throw Error("unavailable");
            };
        },
    ]) {
        const f = fixture();
        change(f);
        assert.equal(f.open().rows.length, 0);
        assert.deepEqual(f.calls, []);
    }
    const f = fixture();
    delete f.current.isAlwaysOnTop;
    assert.deepEqual(
        Array.from(f.open().rows, (row) => row.id),
        ["window.fullscreen"]
    );
});

test("fullscreen publishes confirmed native state, without using the video/browser fullscreen path", async () => {
    const f = fixture();
    f.host.stbToFullScreen = f.host.requestFullscreen = () =>
        assert.fail("wrong fullscreen path");
    await f.action(f.open(), "fullscreen");
    assert.equal(f.host.__ottTauriNativeFs, true);
    assert.deepEqual(f.calls, [["toggle_fullscreen", undefined], ["close"]]);
    assert.deepEqual(f.messages, ["Full screen: on"]);
    await f.action(f.open(), "fullscreen");
    assert.equal(f.host.__ottTauriNativeFs, false);
    assert.equal(f.messages.at(-1), "Full screen: off");
});

test("topmost reads current state and sends explicit native values with bound receivers", async () => {
    const f = fixture();
    await f.action(f.open(), "alwaysOnTop");
    await f.action(f.open(), "alwaysOnTop");
    assert.deepEqual(f.calls, [
        ["read"],
        ["set_always_on_top", { alwaysOnTop: true }],
        ["close"],
        ["read"],
        ["set_always_on_top", { alwaysOnTop: false }],
        ["close"],
    ]);
    assert.deepEqual(f.messages, ["Always on top: on", "Always on top: off"]);
});

test("overlapping actions are blocked until the single native operation settles", async () => {
    const f = fixture(),
        wait = deferred();
    f.native.invoke = (command) => {
        f.calls.push([command]);
        return wait.promise;
    };
    const menu = f.open();
    const first = f.action(menu, "fullscreen");
    await f.action(menu, "alwaysOnTop");
    assert.deepEqual(f.calls, [["toggle_fullscreen"]]);
    assert.deepEqual(f.messages, []);
    wait.resolve({ fullscreen: true, ok: true });
    await first;
    assert.equal(f.messages.length, 1);
});

test("closed or replaced menus cannot be repainted or closed by a late reply", async () => {
    for (const leave of [
        (f) => f.close(),
        (f) => f.replace(),
        (f) => f.lock(),
    ]) {
        const f = fixture(),
            wait = deferred();
        f.native.invoke = () => wait.promise;
        const pending = f.action(f.open(), "fullscreen");
        await Promise.resolve();
        leave(f);
        wait.resolve({ fullscreen: true, ok: true });
        await pending;
        assert.equal(
            f.host.__ottTauriNativeFs,
            true,
            "known native state remains truthful"
        );
        assert.deepEqual(f.calls, []);
        assert.deepEqual(f.messages, []);
    }
});

test("a delayed read cannot change topmost after leaving the owning menu", async () => {
    const f = fixture(),
        wait = deferred();
    f.current.isAlwaysOnTop = () => wait.promise;
    const pending = f.action(f.open(), "alwaysOnTop");
    await Promise.resolve();
    f.close();
    wait.resolve(false);
    await pending;
    assert.deepEqual(f.calls, []);
    assert.deepEqual(f.messages, []);
});

test("stale rows and kiosk admission cannot start a native operation", async () => {
    for (const leave of [
        (f) => f.close(),
        (f) => f.replace(),
        (f) => f.lock(),
    ]) {
        const f = fixture(),
            menu = f.open();
        leave(f);
        await f.action(menu, "fullscreen");
        await f.action(menu, "alwaysOnTop");
        assert.deepEqual(f.calls, []);
        assert.deepEqual(f.messages, []);
    }
});

test("native rejection or malformed fullscreen result cannot report success or retry", async () => {
    for (const reply of [
        undefined,
        {},
        { fullscreen: true, ok: false },
        { fullscreen: "true", ok: true },
        Error("denied"),
    ]) {
        const f = fixture();
        let calls = 0;
        f.host.__TAURI_INTERNALS__ = {
            invoke: () => assert.fail("must not retry a mutation"),
        };
        f.native.invoke = () => {
            calls++;
            return reply instanceof Error ? Promise.reject(reply) : reply;
        };
        await f.action(f.open(), "fullscreen");
        assert.equal(calls, 1);
        assert.equal(f.host.__ottTauriNativeFs, false);
        assert.deepEqual(f.messages, ["Full screen: ERROR!"]);
        assert.deepEqual(f.calls, []);
    }
});

test("bad topmost read/result and native throws release the pending guard for retry", async () => {
    for (const change of [
        (f) => {
            f.current.isAlwaysOnTop = () => undefined;
        },
        (f) => {
            f.current.isAlwaysOnTop = () => Promise.reject(Error("read"));
        },
        (f) => {
            f.native.invoke = () => {
                throw Error("setter");
            };
        },
        (f) => {
            f.native.invoke = () => ({ alwaysOnTop: false, ok: true });
        },
        (f) => {
            f.native.invoke = () => ({ ok: true });
        },
    ]) {
        const f = fixture(),
            get = f.current.isAlwaysOnTop,
            invoke = f.native.invoke;
        change(f);
        await f.action(f.open(), "alwaysOnTop");
        assert.equal(f.messages.at(-1), "Always on top: ERROR!");
        assert(!f.calls.some((call) => call[0] === "close"));
        f.current.isAlwaysOnTop = get;
        f.native.invoke = invoke;
        await f.action(f.open(), "alwaysOnTop");
        assert.equal(f.messages.at(-1), "Always on top: on");
    }
});

test("API disappearance after opening reports failure without touching video or another invoke owner", async () => {
    const f = fixture(),
        menu = f.open();
    delete f.host.__TAURI__;
    await f.action(menu, "fullscreen");
    assert.deepEqual(f.messages, ["Full screen: ERROR!"]);
    assert.deepEqual(f.calls, []);
});

test("the real popup binds the committed owner for both Classic and Modern presentation", async () => {
    const file = path.join(root, "src/ui/index.ts");
    const ast = ts.createSourceFile(
        file,
        fs.readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true
    );
    const fn = ast.statements.find(
        (node) =>
            ts.isFunctionDeclaration(node) && node.name?.text === "popupList"
    );
    assert(fn);
    const popup = ts.transpileModule(fn.getText(ast).replace(/^export /, ""), {
        compilerOptions: {
            module: ts.ModuleKind.None,
            target: ts.ScriptTarget.ES5,
        },
    }).outputText;
    for (const mode of [0, 1]) {
        const f = fixture();
        const host = f.host;
        host.sInterfaceMode = mode;
        host.__ottMenuRegistry = f.registry;
        host.__ottClassicScreenPort.close = () => {};
        host.__ottClassicScreenPort.ownListHandler = (fn) => fn;
        host.__ottClassicScreenPort.commitList = () => f.replace();
        const scope = vm.createContext({
            _: host._,
            $: () => ({ hide() {}, is: () => false, show() {} }),
            closeList: host.closeList,
            keys: {},
            listCaptionElement: null,
            listDetailElement: null,
            listFooterElement: null,
            renderButtonHint: () => "",
            showPage() {},
            window: host,
        });
        vm.runInContext(popup, scope);
        scope.popupList();
        const row = scope.listArray.find(
            (item) => item.id === "window.fullscreen"
        );
        assert(row);
        await row.action();
        assert.equal(host.__ottTauriNativeFs, true);
        assert.equal(f.messages.at(-1), "Full screen: on");
    }
});

function installFullscreenKeyHelpers(f) {
    const file = "src/core/index.ts";
    const ast = ts.createSourceFile(
        file,
        fs.readFileSync(path.join(root, file), "utf8"),
        ts.ScriptTarget.Latest,
        true
    );
    const names = [
        "stbToggleTauriNativeFullscreen",
        "stbSetTauriNativeFullscreen",
        "runTauriFullscreenCall",
        "reportTauriFullscreenError",
        "publishTauriFullscreen",
    ];
    const helper = ts.transpileModule(
        ast.statements
            .filter(
                (node) =>
                    ts.isFunctionDeclaration(node) &&
                    names.includes(node.name.text)
            )
            .map((node) => node.getText(ast).replace(/^export /, ""))
            .join("\n"),
        {
            compilerOptions: {
                module: ts.ModuleKind.None,
                target: ts.ScriptTarget.ES5,
            },
        }
    ).outputText;
    f.host.window = f.host;
    f.host.isListVisible = true;
    f.host.console = { warn() {} };
    vm.createContext(f.host);
    vm.runInContext(helper, f.host);
}

for (const key of ["L", "Escape"]) {
    test(
        "late Menu fullscreen reply cannot overwrite a newer " +
            key +
            " result",
        async () => {
            const f = fixture(),
                old = deferred();
            installFullscreenKeyHelpers(f);
            let count = 0;
            f.native.invoke = () =>
                ++count === 1
                    ? old.promise
                    : Promise.resolve({ fullscreen: false, ok: true });
            const menu = f.action(f.open(), "fullscreen");
            await Promise.resolve();
            await (key === "L"
                ? f.host.stbToggleTauriNativeFullscreen()
                : f.host.stbSetTauriNativeFullscreen(false));
            old.resolve({ fullscreen: true, ok: true });
            await menu;
            assert.equal(f.host.__ottTauriNativeFs, false);
            assert.deepEqual(f.messages, []);
            assert.deepEqual(
                f.calls,
                [],
                "stale Menu must not close even if still current"
            );
        }
    );
    test(
        "late " +
            key +
            " reply cannot overwrite a newer Menu fullscreen result",
        async () => {
            const f = fixture(),
                old = deferred();
            installFullscreenKeyHelpers(f);
            let count = 0;
            f.native.invoke = () =>
                ++count === 1
                    ? old.promise
                    : Promise.resolve({ fullscreen: true, ok: true });
            const keyCall =
                key === "L"
                    ? f.host.stbToggleTauriNativeFullscreen()
                    : f.host.stbSetTauriNativeFullscreen(false);
            await f.action(f.open(), "fullscreen");
            old.resolve({ fullscreen: false, ok: true });
            await keyCall;
            assert.equal(f.host.__ottTauriNativeFs, true);
            assert.equal(
                f.calls.length,
                1,
                "only current Menu closes its screen"
            );
            assert.deepEqual(f.messages, ["Full screen: on"]);
        }
    );
}

test("superseded L failure does not retry another mutating IPC after Menu", async () => {
    const f = fixture(),
        old = deferred();
    installFullscreenKeyHelpers(f);
    let count = 0;
    f.native.invoke = () =>
        ++count === 1
            ? old.promise
            : Promise.resolve({ fullscreen: true, ok: true });
    f.host.__TAURI_INTERNALS__ = {
        invoke() {
            assert.fail("stale fallback invocation");
        },
    };
    const keyCall = f.host.stbToggleTauriNativeFullscreen();
    await f.action(f.open(), "fullscreen");
    old.reject(Error("late native rejection"));
    await keyCall;
    assert.equal(count, 2);
    assert.equal(f.host.__ottTauriNativeFs, true);
});

test("a stale fallback probe cannot set fullscreen after a newer Menu request", async () => {
    const f = fixture(),
        probe = deferred(),
        started = deferred();
    installFullscreenKeyHelpers(f);
    delete f.host.__TAURI__.core;
    f.current.isFullscreen = () => {
        started.resolve();
        return probe.promise;
    };
    const keyCall = f.host.stbToggleTauriNativeFullscreen();
    await started.promise;
    let count = 0;
    f.host.__TAURI__.core = f.native;
    f.native.invoke = (command) => {
        count++;
        assert.equal(command, "toggle_fullscreen");
        return Promise.resolve({ fullscreen: true, ok: true });
    };
    await f.action(f.open(), "fullscreen");
    probe.resolve(false);
    await keyCall;
    assert.equal(count, 1);
    assert.equal(f.host.__ottTauriNativeFs, true);
});

test("applied L toggle with failed native readback never replays through internal or Menu paths", async () => {
    const f = fixture();
    installFullscreenKeyHelpers(f);
    let nativeFullscreen = false;
    let mutations = 0;
    let warnings = 0;
    f.host.console.warn = () => warnings++;
    f.native.invoke = (command) => {
        assert.equal(command, "toggle_fullscreen");
        mutations++;
        nativeFullscreen = !nativeFullscreen;
        return Promise.reject(
            Error("native readback failed after application")
        );
    };
    f.host.__TAURI_INTERNALS__ = {
        invoke() {
            mutations++;
            assert.fail("ambiguous failure must not replay");
        },
    };
    f.current.isFullscreen = () =>
        assert.fail("must not start post-dispatch fallback");
    const menu = f.open();
    await f.host.stbToggleTauriNativeFullscreen();
    assert.equal(mutations, 1);
    assert.equal(nativeFullscreen, true);
    assert.equal(f.host.__ottTauriNativeFs, false);
    assert.equal(warnings, 1);
    assert.deepEqual(f.messages, []);
    assert.deepEqual(f.calls, []);
    assert.equal(
        menu.rows.length,
        2,
        "failure does not replace the current Menu"
    );
});
