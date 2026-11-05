"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const wire = require("./load-wire.cjs")();
const code = ts.transpileModule(
    fs.readFileSync("src/plugins/remote-settings-host.ts", "utf8"),
    {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
        },
    }
).outputText;
require("acorn").parse(code, { ecmaVersion: 5 });
function fixture() {
    let now = 1000,
        timerId = 0;
    const timers = new Map(),
        calls = [],
        data = new Map();
    const state = {
        enabled: false,
        failure: "",
        generation: 0,
        state: "disconnected",
    };
    const w = {
        __ottCommandServer: {
            configure(config, save) {
                calls.push([config, save]);
                state.generation++;
                state.enabled = config.enabled;
                state.address = config.address;
                state.token = config.token;
                state.state = config.enabled ? "connecting" : "disconnected";
            },
            matches: (value) =>
                value.address === state.address &&
                value.token === state.token &&
                value.enabled === state.enabled,
            status: () => state,
        },
        clearTimeout(id) {
            timers.delete(id);
        },
        ensureDeviceClientId(id) {
            w.deviceUUID = id;
            data.set("ott_device_uuid", id);
            data.set("deviceId", id);
            return id;
        },
        localStorage: {
            getItem: (key) => data.get(key) ?? null,
            removeItem: (key) => data.delete(key),
            setItem: (key, value) => data.set(key, value),
        },
        location: { href: "https://player.example/", protocol: "https:" },
        setTimeout(fn) {
            const id = ++timerId;
            timers.set(id, fn);
            return id;
        },
    };
    const ports = {
        applyLanguageMetadata: (id) => {
            calls.push(["metadata", id]);
        },
        detectLanguage: () => "_eng",
        languageNames: { _eng: "English", _rus: "Russian" },
        loadLanguage: (id, done) => {
            calls.push(["language", id, done]);
            return () => {};
        },
        normalizeAddress: (value) => value,
        storage: {
            del: (key) => data.delete(key),
            get: (key) => data.get(key) ?? null,
            set: (key, value) => data.set(key, value),
        },
        validDeviceToken: wire.validDeviceToken,
        validSwopClientId: wire.validSwopClientId,
    };
    vm.runInNewContext(code, {
        Date: { now: () => now },
        exports: {},
        require: (name) =>
            name.includes("wire-contracts")
                ? wire
                : { languageNames: { _eng: "English", _rus: "Russian" } },
        URL,
        window: w,
    });
    const host = w.__ottRemoteLifecycleHostFactory.create(w, ports);
    return {
        calls,
        data,
        host,
        ports,
        state,
        tick(ms = 250) {
            now += ms;
            const pending = [...timers.values()];
            timers.clear();
            pending.forEach((fn) => fn());
        },
        w,
    };
}
const token = "device_token_012345678901234567890123456789";
let passed = 0;
function test(name, fn) {
    fn();
    passed++;
    console.log("OK: " + name);
}
test("tuple validation rejects unsafe URL, credential, unknown field and primitive types", () => {
    const f = fixture(),
        good = {
            commandServerAddress:
                "https://control.example/api/webhook/commands",
            commandServerEnabled: 1,
            commandServerToken: token,
        };
    assert.ok(f.host.validate("command_server", good, {}));
    for (const patch of [
        { commandServerEnabled: true },
        { commandServerToken: "short" },
        { commandServerAddress: "http://control.example" },
        { commandServerAddress: "https://user:pass@control.example" },
        { commandServerAddress: "https://control.example/#fragment" },
        { unknown: 1 },
    ])
        assert.equal(
            f.host.validate("command_server", { ...good, ...patch }, {}),
            null
        );
    assert.equal(
        f.host.validate(
            "local_http",
            {
                localCmdUrl: "",
                localHttpDeviceCode: token,
                localHttpEnabled: 1,
            },
            {}
        ),
        null
    );
    assert.ok(
        f.host.validate(
            "local_http",
            {
                localCmdUrl: "/commands",
                localHttpDeviceCode: token,
                localHttpEnabled: 1,
            },
            {}
        )
    );
});
test("language writes resolve manual and system modes before saving", () => {
    const f = fixture();
    assert.equal(
        f.host.validate(
            "language",
            { ottplaylang: "_rus", ottplaylangmode: "system" },
            { ottplaylang: "_rus" }
        ).ottplaylangmode,
        "manual"
    );
    assert.equal(
        f.host.validate(
            "language",
            { ottplaylang: "_rus", ottplaylangmode: "system" },
            { ottplaylangmode: "system" }
        ).ottplaylang,
        "_eng"
    );
    assert.equal(
        f.host.validate(
            "language",
            { ottplaylang: "_unknown", ottplaylangmode: "manual" },
            {}
        ),
        null
    );
});
test("command owner must prove a connected authenticated generation", () => {
    const f = fixture(),
        result = [];
    f.host.apply(
        "command_server",
        {
            commandServerAddress:
                "https://control.example/api/webhook/commands",
            commandServerEnabled: 1,
            commandServerToken: token,
        },
        (error) => result.push(error)
    );
    assert.equal(f.calls[0][1], false);
    assert.deepEqual(result, []);
    f.state.state = "connected";
    f.tick();
    assert.deepEqual(result, [undefined]);
});
test("owner handshake reports timeout, authorization failure and supersession", () => {
    for (const reason of [
        "handshake_timeout",
        "authorization_failed",
        "superseded",
    ]) {
        const f = fixture(),
            result = [];
        f.host.apply(
            "command_server",
            {
                commandServerAddress:
                    "https://control.example/api/webhook/commands",
                commandServerEnabled: 1,
                commandServerToken: token,
            },
            (error) => result.push(error)
        );
        if (reason === "authorization_failed") f.state.failure = reason;
        if (reason === "superseded") f.state.generation++;
        f.tick(30000);
        assert.deepEqual(result, [reason]);
    }
});
test("disabling the actual command owner completes without a handshake", () => {
    const f = fixture(),
        result = [];
    f.host.apply(
        "command_server",
        {
            commandServerAddress: "",
            commandServerEnabled: 0,
            commandServerToken: "",
        },
        (error) => result.push(error)
    );
    assert.deepEqual(result, [undefined]);
    assert.equal(f.state.enabled, false);
});
test("language application waits for the actual dictionary loader", () => {
    const f = fixture(),
        result = [];
    f.host.apply(
        "language",
        { ottplaylang: "_rus", ottplaylangmode: "manual" },
        (error) => result.push(error)
    );
    assert.deepEqual(result, []);
    assert.equal(f.calls[0][0], "language");
    f.calls[0][2](false);
    assert.deepEqual(result, ["effect_failed"]);
});
test("SWOP retires old ownership and verifies both durable identity aliases", () => {
    const f = fixture(),
        result = [];
    let cancelled = 0;
    f.w.__ottCancelSwopSession = () => cancelled++;
    f.host.apply(
        "swop",
        {
            deviceUuid: "remote-test-device",
            swopBaseUrl: "https://swop.example",
        },
        (error) => result.push(error)
    );
    assert.equal(cancelled, 1);
    assert.deepEqual(result, [undefined]);
    f.w.ensureDeviceClientId = (id) => id;
    f.host.apply(
        "swop",
        { deviceUuid: "different-device", swopBaseUrl: "https://swop.example" },
        (error) => result.push(error)
    );
    assert.equal(result[1], "storage_failed");
});
test("boot retains prior connection routes while the recovery module is unavailable", () => {
    const text = fs.readFileSync("src/index.ts", "utf8");
    const start = text.indexOf("        var recoverySettings: any =");
    const end = text.indexOf(
        "        if (typeof (window as any).applyLocalSwopConfig",
        start
    );
    const bootCode = ts.transpileModule(text.slice(start, end), {
        compilerOptions: { target: ts.ScriptTarget.ES5 },
    }).outputText;
    const commandCalls = [],
        localCalls = [],
        loads = [],
        discoveries = [];
    const previous = {
        commandServerAddress: "https://old.example",
        commandServerEnabled: 1,
        commandServerToken: token,
        localCmdUrl: "https://old-local.example",
        localHttpDeviceCode: token,
        localHttpEnabled: 1,
    };
    const w = {
        __ottCommandServer: { configure: (...args) => commandCalls.push(args) },
        __ottControlDiscovery: { start: () => discoveries.push(true) },
        __ottLocalHttpRemote: {
            configure: (...args) => {
                localCalls.push(args);
                return Promise.resolve();
            },
            init: () => assert.fail("must retain the prior tuple"),
        },
        __ottRemoteDiagnostics: {},
        __ottRemoteNotifications: { setEnabled: () => {} },
    };
    const context = {
        getScriptDOM: (...args) => loads.push(args),
        hostUrl: "https://player.example",
        PLAYER_VERSION: "test",
        readNotificationsEnabled: () => true,
        settings: {
            commandServerAddress: "",
            commandServerEnabled: 0,
            commandServerToken: "",
        },
        storage: {
            get: (key) =>
                /command_server|local_http/.test(key)
                    ? JSON.stringify({ previous, state: "pending", version: 1 })
                    : null,
        },
        window: w,
    };
    vm.runInNewContext(bootCode, context);
    assert.equal(commandCalls[0][0].address, previous.commandServerAddress);
    assert.equal(commandCalls[0][1], false);
    assert.equal(localCalls[0][0].url, previous.localCmdUrl);
    assert.equal(localCalls[0][1], false);
    assert.equal(loads.length, 1);
    assert.equal(
        discoveries.length,
        0,
        "pending disconnect cannot be mistaken for a fresh installation"
    );
    assert.equal(context.settings.commandServerAddress, "");
    assert.equal(context.settings.commandServerToken, "");
    assert.equal(context.settings.commandServerEnabled, 0);

    // A different recovering subsystem must not suppress first-time discovery.
    context.storage.get = (key) =>
        key.endsWith("local_http")
            ? JSON.stringify({ previous, state: "pending", version: 1 })
            : null;
    vm.runInNewContext(bootCode, context);
    assert.equal(discoveries.length, 1);

    // Neither does an ordinary new installation without any recovery journal.
    w.__ottLocalHttpRemote.init = () => {};
    context.storage.get = () => null;
    vm.runInNewContext(bootCode, context);
    assert.equal(discoveries.length, 2);
});
test("overlapping dictionary loads settle the old request without disturbing the new owner", () => {
    const text = fs.readFileSync("src/index.ts", "utf8");
    const ast = ts.createSourceFile(
        "index.ts",
        text,
        ts.ScriptTarget.Latest,
        true
    );
    const fn = ast.statements.find(
        (node) =>
            ts.isFunctionDeclaration(node) &&
            node.name?.text === "loadInterfaceLanguage"
    );
    const source = ts.transpileModule(fn.getText(ast), {
        compilerOptions: { target: ts.ScriptTarget.ES5 },
    }).outputText;
    const timers = new Map(),
        loads = [],
        results = [];
    let next = 0;
    const original = { lang: "Original" },
        w = { keyStrings: original };
    const context = {
        applyLanguageMetadata: (code) => {
            w.language = code;
        },
        clearTimeout: (id) => timers.delete(id),
        getScriptDOM: (url, done, error) => loads.push({ done, error, url }),
        hostUrl: "https://player.example",
        languageAssetPath: (code) => "/" + code + ".js",
        PLAYER_VERSION: "test",
        setTimeout: (fn) => {
            timers.set(++next, fn);
            return next;
        },
        window: w,
    };
    vm.runInNewContext(source, context);
    context.loadInterfaceLanguage("_eng", (loaded, reason) =>
        results.push(["remote", loaded, reason])
    );
    context.loadInterfaceLanguage("_rus", (loaded) =>
        results.push(["ui", loaded])
    );
    timers.get(1)();
    assert.deepEqual(results, [["remote", false, "superseded"]]);
    const fresh = { lang: "New" };
    w.keyStrings = fresh;
    loads[1].done();
    assert.deepEqual(results[1], ["ui", true]);
    assert.equal(w.keyStrings, fresh);
    w.keyStrings = { lang: "Late old dictionary" };
    loads[0].done();
    assert.equal(w.keyStrings, fresh);
    assert.equal(results.length, 2);
});
test("default automatic language remains recoverable and manual mode uses the loaded language", () => {
    const f = fixture();
    f.w.__ottInterfaceLanguage = "_rus";
    assert.ok(
        f.host.validate(
            "language",
            { ottplaylang: "", ottplaylangmode: "system" },
            {}
        )
    );
    assert.equal(
        f.host.validate(
            "language",
            { ottplaylang: "", ottplaylangmode: "manual" },
            { ottplaylangmode: "manual" }
        ).ottplaylang,
        "_rus"
    );
    assert.equal(
        f.host.validate(
            "language",
            { ottplaylang: "", ottplaylangmode: "system" },
            { ottplaylang: "" }
        ),
        null
    );
});
test("equal saved connection values are applied only with matching live owner evidence", () => {
    const f = fixture();
    const tuple = {
        commandServerAddress: "https://control.example/api/webhook/commands",
        commandServerEnabled: 1,
        commandServerToken: token,
    };
    assert.equal(f.host.applied("command_server", tuple), false);
    f.w.__ottCommandServer.configure(
        { address: tuple.commandServerAddress, enabled: true, token },
        false
    );
    assert.equal(f.host.applied("command_server", tuple), false);
    f.state.state = "waiting";
    assert.equal(f.host.applied("command_server", tuple), true);
    assert.equal(
        f.host.applied("command_server", {
            ...tuple,
            commandServerToken: token + "x",
        }),
        false
    );
    f.state.state = "error";
    assert.equal(f.host.applied("command_server", tuple), false);
});
test("a hung local HTTP owner times out once and ignores late or cancelled completion", () => {
    const f = fixture();
    let resolve;
    const outcomes = [];
    const state = { code: token, enabled: true, generation: 1, ready: true };
    f.w.__ottLocalHttpRemote = {
        configure: () => ({
            then: (success) => {
                resolve = success;
            },
        }),
        status: () => state,
    };
    const tuple = {
        localCmdUrl: "https://control.example/local",
        localHttpDeviceCode: token,
        localHttpEnabled: 1,
    };
    f.host.apply("local_http", tuple, (reason) => outcomes.push(reason));
    f.tick(30000);
    assert.deepEqual(outcomes, ["handshake_timeout"]);
    resolve();
    assert.deepEqual(outcomes, ["handshake_timeout"]);
    const cancel = f.host.apply("local_http", tuple, (reason) =>
        outcomes.push(reason)
    );
    cancel();
    resolve();
    f.tick(30000);
    assert.deepEqual(outcomes, ["handshake_timeout"]);
});
console.log(`OK: ${passed} lifecycle owner scenarios`);
