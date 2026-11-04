const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const acorn = require("acorn");

const code = ts.transpileModule(
    fs.readFileSync("src/commands/remote-local-source-diagnostics.ts", "utf8"),
    {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
        },
    }
).outputText;
acorn.parse(code, { ecmaVersion: 5 });
const ITEM = "a".repeat(32),
    SOURCE = "b".repeat(32);
const URL =
    "http://127.0.0.1:34567/offline-media/" + "c".repeat(64) + "/" + ITEM;
const plain = (v) => JSON.parse(JSON.stringify(v));
const route = (kind = "direct", endpointMatch = "match", itemId = ITEM) => ({
    endpointMatch,
    itemId,
    kind,
});
function fixture(clock = Date) {
    const calls = [],
        codecCalls = [],
        timers = new Map();
    let timerId = 0,
        resolveNative;
    const node = {
        canPlayType(value) {
            codecCalls.push(value);
            return "probably";
        },
        currentSrc: URL,
        error: null,
        src: URL,
    };
    const state = {
        attachment: 2,
        generation: 7,
        native: null,
        runtime: "page-123",
    };
    const handle = {
        diagnosticAttempt: () => ({ attachment: state.attachment }),
        diagnosticMedia: () => ({ generation: state.generation, media: node }),
        id: 3,
    };
    const backend = { current: () => handle };
    const w = {
        __ottActiveProviderDriver: {},
        __ottClassicPlayback: {
            snapshot: () => ({ generation: state.generation }),
        },
        __ottCoreBackendPeek: () => backend,
        __ottLocalMedia: {
            diagnosticSource: (value) =>
                value === URL
                    ? { itemId: ITEM, revision: 1, sourceId: SOURCE }
                    : null,
        },
        __TAURI_INTERNALS__: {},
        clearTimeout(id) {
            timers.delete(id);
        },
        document: { getElementById: (id) => (id === "video" ? node : null) },
        setTimeout(fn) {
            const id = ++timerId;
            timers.set(id, fn);
            return id;
        },
    };
    w.__TAURI__ = {
        invoke(name, args) {
            calls.push([name, args]);
            assert.equal(name, "local_source_diagnostics");
            return (
                state.native ||
                new Promise((resolve) => {
                    resolveNative = resolve;
                })
            );
        },
    };
    vm.runInNewContext(code, { Date: clock, Promise, window: w });
    return {
        backend,
        calls,
        codecCalls,
        collect: () => w.__ottLocalSourceDiagnostics(w, () => state.runtime),
        finish: (value) =>
            resolveNative(
                value || {
                    currentSource: route(),
                    requestedSource: route(),
                    version: 1,
                }
            ),
        handle,
        node,
        producer: w.__ottLocalSourceDiagnostics,
        state,
        timers,
        w,
    };
}
test("actual currentSrc and DOM assigned src remain separate; fixed browser hints only", async () => {
    const f = fixture();
    f.node.currentSrc = "";
    const pending = f.collect();
    assert.equal(f.calls.length, 1);
    assert.deepEqual(plain(f.calls[0][1]), {
        currentSource: "",
        requestedSource: URL,
    });
    f.finish({
        currentSource: route("empty", "not_applicable", null),
        requestedSource: route(),
        version: 1,
    });
    const result = plain(await pending);
    assert.equal(result.consistent, true);
    assert.deepEqual(result.currentSource, {
        endpointMatch: "not_applicable",
        itemId: null,
        kind: "empty",
        sourceId: null,
    });
    assert.equal(result.requestedSource.itemId, ITEM);
    assert.deepEqual(f.codecCalls, [
        'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
        'video/mp4; codecs="hvc1.1.6.L93.B0, mp4a.40.2"',
    ]);
    const encoded = JSON.stringify(result);
    assert(!encoded.includes("http"));
    assert(!encoded.includes("34567"));
    assert(!encoded.includes("c".repeat(64)));
});
test("stale current endpoint and matching assigned endpoint carry independent evidence", async () => {
    const f = fixture();
    const pending = f.collect();
    f.finish({
        currentSource: route("direct", "mismatch", null),
        requestedSource: route(),
        version: 1,
    });
    const result = await pending;
    assert.equal(result.currentSource.endpointMatch, "mismatch");
    assert.equal(result.currentSource.itemId, null);
    assert.equal(result.requestedSource.sourceId, SOURCE);
});
test("native path identity alone never manufactures a cached source mapping", async () => {
    const f = fixture();
    f.w.__ottLocalMedia.diagnosticSource = () => null;
    const pending = f.collect();
    f.finish();
    const result = await pending;
    assert.equal(result.currentSource.endpointMatch, "match");
    assert.equal(result.currentSource.itemId, null);
});
test("cached ID must exactly equal native route ID", async () => {
    const f = fixture();
    f.w.__ottLocalMedia.diagnosticSource = () => ({
        itemId: "d".repeat(32),
        revision: 1,
        sourceId: SOURCE,
    });
    const pending = f.collect();
    f.finish();
    assert.equal((await pending).currentSource.itemId, null);
});
test("malformed native evidence cannot classify an HTTP source as non-Local", async () => {
    for (const currentSource of [
        undefined,
        null,
        "other",
        {},
        { ...route(), privateUrl: URL },
    ]) {
        const f = fixture();
        const pending = f.collect();
        f.finish({ currentSource, requestedSource: route(), version: 1 });
        const result = await pending;
        assert.equal(result.currentSource.kind, "unavailable");
        assert.equal(result.currentSource.endpointMatch, "unknown");
        assert.equal(result.currentSource.itemId, null);
        assert.equal(result.requestedSource.itemId, ITEM);
        assert.equal(JSON.stringify(result).includes(URL), false);
    }
});
for (const field of [
    "runtime",
    "generation",
    "ownerGeneration",
    "ownedNode",
    "hls",
    "attachment",
    "node",
    "handle",
    "driver",
    "current",
    "requested",
    "catalog",
]) {
    test(
        "async " +
            field +
            " replacement invalidates the entire identity snapshot",
        async () => {
            const f = fixture();
            const pending = f.collect();
            if (field === "runtime") f.state.runtime = "page-other";
            else if (field === "generation") f.state.generation++;
            else if (field === "hls")
                f.handle.diagnosticMedia = () => ({
                    generation: f.state.generation,
                    hls: {},
                    media: f.node,
                });
            else if (field === "ownerGeneration")
                f.handle.diagnosticMedia = () => ({
                    generation: 999,
                    media: f.node,
                });
            else if (field === "ownedNode")
                f.handle.diagnosticMedia = () => ({
                    generation: f.state.generation,
                    media: { ...f.node },
                });
            else if (field === "attachment") f.state.attachment++;
            else if (field === "node")
                f.w.document.getElementById = (id) =>
                    id === "video" ? { ...f.node } : null;
            else if (field === "handle")
                f.backend.current = () => ({ ...f.handle });
            else if (field === "driver") f.w.__ottActiveProviderDriver = {};
            else if (field === "current") f.node.currentSrc += "-other";
            else if (field === "requested") f.node.src += "-other";
            else
                f.w.__ottLocalMedia.diagnosticSource = () => ({
                    itemId: ITEM,
                    revision: 2,
                    sourceId: SOURCE,
                });
            f.finish();
            const result = await pending;
            assert.equal(result.consistent, false);
            for (const key of ["generation", "handleId", "mediaErrorCode"])
                assert.equal(result[key], null);
            assert.deepEqual(plain(result.codecs), { h264: null, hevc: null });
            for (const key of ["currentSource", "requestedSource"])
                assert.deepEqual(plain(result[key]), {
                    endpointMatch: "unknown",
                    itemId: null,
                    kind: "unavailable",
                    sourceId: null,
                });
        }
    );
}
test("same URL after a new attachment cannot pass an A to B to A race", async () => {
    const f = fixture();
    const pending = f.collect();
    f.node.currentSrc = "other";
    f.state.attachment++;
    f.node.currentSrc = URL;
    f.finish();
    assert.equal((await pending).consistent, false);
});
test("missing reliable owner fence with nonempty URL withholds identity", async () => {
    const f = fixture();
    delete f.handle.diagnosticAttempt;
    const pending = f.collect();
    f.finish();
    assert.equal((await pending).consistent, false);
});
test("a stable DOM video cannot claim a different or absent handle-owned media node", async () => {
    for (const mode of ["different", "missing", "generation"]) {
        const f = fixture();
        if (mode === "missing") delete f.handle.diagnosticMedia;
        else
            f.handle.diagnosticMedia = () => ({
                generation: mode === "generation" ? 999 : f.state.generation,
                media: mode === "different" ? {} : f.node,
            });
        const pending = f.collect();
        f.finish();
        const result = await pending;
        assert.equal(result.consistent, false);
        assert.equal(result.currentSource.itemId, null);
        assert.equal(result.requestedSource.endpointMatch, "unknown");
        assert.equal(result.codecs.hevc, null);
    }
});
test("media error and canPlayType are strict optional observations", async () => {
    for (const value of [null, 0, 1, 2, 3, 4, 5, true, 1.5, "1"]) {
        const f = fixture();
        f.node.error = { code: value };
        f.node.canPlayType = (value) => (value.includes("avc1") ? "" : "maybe");
        const pending = f.collect();
        f.finish();
        const result = await pending;
        assert.equal(
            result.mediaErrorCode,
            [1, 2, 3, 4].includes(value) ? value : null
        );
        assert.deepEqual(plain(result.codecs), { h264: "", hevc: "maybe" });
    }
    const f = fixture();
    f.node.canPlayType = () => {
        throw new Error("private");
    };
    Object.defineProperty(f.node, "error", {
        get() {
            throw new Error("private");
        },
    });
    const pending = f.collect();
    f.finish();
    assert.deepEqual(plain((await pending).codecs), { h264: null, hevc: null });
});
test("deadline preserves ordinary status and one unresolved native request maximum", async () => {
    const f = fixture();
    const pending = f.collect();
    assert.equal(f.timers.size, 1);
    [...f.timers.values()][0]();
    const first = await pending;
    assert.equal(first.currentSource.kind, "unavailable");
    const second = await f.collect();
    assert.equal(second.currentSource.endpointMatch, "unknown");
    assert.equal(f.calls.length, 1);
    assert.equal(f.w.__ottLocalSourceDiagnosticPending, true);
    f.finish();
    await Promise.resolve();
    assert.equal(f.w.__ottLocalSourceDiagnosticPending, false);
    assert.equal(first.currentSource.kind, "unavailable");
});
test("empty DOM and absent native bridge are truthful without initialization", async () => {
    const f = fixture();
    delete f.w.__TAURI_INTERNALS__;
    delete f.w.__TAURI__;
    f.node.currentSrc = f.node.src = "";
    f.state.generation = null;
    f.handle.id = null;
    delete f.handle.diagnosticAttempt;
    const result = await f.collect();
    assert.equal(result.consistent, true);
    assert.equal(result.currentSource.kind, "empty");
    assert.equal(f.calls.length, 0);
});

test("stable idle video without an owner keeps codec hints in browser and native snapshots", async () => {
    for (const native of [false, true]) {
        const f = fixture();
        f.node.currentSrc = f.node.src = "";
        f.state.generation = null;
        f.backend.current = () => null;
        if (!native) {
            delete f.w.__TAURI_INTERNALS__;
            delete f.w.__TAURI__;
        }
        const pending = f.collect();
        if (native)
            f.finish({
                currentSource: route("empty", "not_applicable", null),
                requestedSource: route("empty", "not_applicable", null),
                version: 1,
            });
        const result = await pending;
        assert.equal(result.consistent, true);
        assert.equal(result.generation, null);
        assert.equal(result.handleId, null);
        assert.deepEqual(plain(result.codecs), {
            h264: "probably",
            hevc: "probably",
        });
        assert.equal(result.currentSource.kind, "empty");
        assert.equal(result.requestedSource.kind, "empty");
        assert.equal(f.calls.length, native ? 1 : 0);
    }
});
test("idle exemption preserves active-source and detached-owner checks", async () => {
    for (const mode of ["active-unowned", "idle-detached-owner"]) {
        const f = fixture();
        if (mode === "active-unowned") f.backend.current = () => null;
        else {
            f.node.currentSrc = f.node.src = "";
            const detached = {};
            f.handle.diagnosticMedia = () => ({
                generation: f.state.generation,
                media: detached,
            });
        }
        const pending = f.collect();
        f.finish();
        const result = await pending;
        assert.equal(result.consistent, false);
        assert.deepEqual(plain(result.codecs), { h264: null, hevc: null });
        assert.equal(result.currentSource.kind, "unavailable");
        assert.equal(result.requestedSource.kind, "unavailable");
    }
});
test("idle DOM replacement during native collection still invalidates the snapshot", async () => {
    const f = fixture();
    f.node.currentSrc = f.node.src = "";
    f.backend.current = () => null;
    const pending = f.collect();
    const replacement = { ...f.node };
    f.w.document.getElementById = (id) => (id === "video" ? replacement : null);
    f.finish();
    const result = await pending;
    assert.equal(result.consistent, false);
    assert.deepEqual(plain(result.codecs), { h264: null, hevc: null });
});

function statusDispatcher(f, clock = Date) {
    const source = fs.readFileSync("src/commands/remote-requests.ts", "utf8");
    const modules = {};
    for (const match of source.matchAll(/from "([^"]+)"/g))
        modules[match[1]] = {};
    modules["./remote-restart"] = {
        remotePlayerInfo: () => ({ runtime: f.state.runtime }),
    };
    modules["./player-state"] = { readPlayerState: () => ({ playback: null }) };
    modules["./remote-provider-diagnostics"] = {
        companionDiagnosticsSnapshot: () => null,
        providerDiagnosticsSnapshot: () => null,
    };
    const exports = {};
    const compiled = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
        },
    }).outputText;
    vm.runInNewContext(compiled, {
        Date: clock,
        exports,
        Promise,
        require(name) {
            assert(name in modules, name);
            return modules[name];
        },
        window: f.w,
    });
    f.w.__ottActiveProviderDriver.id = "offline";
    f.w.stbGetVolume = () => 35;
    return exports.executeRemoteRequest;
}

test("ordinary status before optional registration stays synchronous and performs no loading", () => {
    for (const hasLocal of [false, true]) {
        const f = fixture(),
            replies = [];
        delete f.w.__ottLocalSourceDiagnostics;
        if (!hasLocal) delete f.w.__ottLocalMedia;
        f.w.getScriptDOM = () => assert.fail("status must not load assets");
        statusDispatcher(f)({ action: "status", params: {} }, (value) =>
            replies.push(value)
        );
        assert.equal(replies.length, 1);
        assert.equal(replies[0].data.volume, 35);
        assert.equal(replies[0].data.local_source_diagnostics, undefined);
        assert.equal(f.calls.length, 0);
        assert.equal(f.timers.size, 0);
    }
});

test("capability requires actual optional registration, with no native or asset calls", () => {
    function load(file, requires = {}) {
        const exports = {};
        vm.runInNewContext(
            ts.transpileModule(fs.readFileSync(file, "utf8"), {
                compilerOptions: {
                    module: ts.ModuleKind.CommonJS,
                    target: ts.ScriptTarget.ES5,
                },
            }).outputText,
            { Date, exports, require: (name) => requires[name] }
        );
        return exports;
    }
    const control = load("src/commands/remote-restart.ts", {
        "./remote-app-update": load("src/commands/remote-app-update.ts", {
            "../plugins/native-bridge": {
                resolveNativePlugin: () => assert.fail("passive capability"),
            },
        }),
        "./remote-favorites-contract": load(
            "src/commands/remote-favorites-contract.ts"
        ),
        "./remote-plex": load("src/commands/remote-plex.ts"),
    });
    const f = fixture();
    function caps() {
        let result;
        control.executeRemoteControl(f.w, "capabilities", {}, (value) => {
            result = value;
        });
        return result.data;
    }
    assert.deepEqual(plain(caps().local_source_diagnostics), { version: 1 });
    delete f.w.__ottLocalSourceDiagnostics;
    assert.equal(caps().local_source_diagnostics, undefined);
    assert.equal(f.calls.length, 0);
});

test("real status dispatch survives a hung native peek and responds once", async () => {
    const f = fixture(),
        replies = [];
    statusDispatcher(f)({ action: "status", params: {} }, (result) =>
        replies.push(result)
    );
    assert.equal(replies.length, 0);
    [...f.timers.values()][0]();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(replies.length, 1);
    assert.equal(replies[0].status, "ok");
    assert.equal(replies[0].data.volume, 35);
    assert.equal(
        replies[0].data.local_source_diagnostics.currentSource.kind,
        "unavailable"
    );
    f.finish();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(replies.length, 1);
});

test("cancelled status suppresses late completion without repeating the native peek", async () => {
    const f = fixture(),
        replies = [];
    const cancel = statusDispatcher(f)(
        { action: "status", params: {} },
        (result) => replies.push(result)
    );
    cancel();
    f.finish();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(replies.length, 0);
    assert.equal(f.calls.length, 1);
});

test("near-expiry status skips optional diagnostics and keeps the ordinary reply", () => {
    const now = 5000000;
    for (const remaining of [0, 1, 249, 250]) {
        const clock = { now: () => now };
        const f = fixture(clock),
            replies = [];
        const execute = statusDispatcher(f, clock);
        const request = {
            action: "status",
            params: {},
            expires_at: (now + remaining) / 1000,
        };
        execute(request, (reply) => replies.push(reply));
        assert.equal(
            replies.length,
            1,
            "ordinary status is synchronous at " + remaining
        );
        assert.equal(replies[0].status, "ok");
        assert.equal(replies[0].data.local_source_diagnostics, undefined);
        assert.equal(
            f.calls.length,
            0,
            "no native peek may consume remaining TTL"
        );
        assert.equal(f.timers.size, 0);
        assert.equal(
            f.codecCalls.length,
            0,
            "the optional producer was not entered"
        );
        delete f.w.__ottLocalSourceDiagnostics;
        execute(request, (reply) => replies.push(reply));
        assert.deepEqual(plain(replies[0]), plain(replies[1]));
    }
});

test("status with enough time or no deadline retains optional diagnostics", async () => {
    const now = 5000000;
    for (const remaining of [251, 1000, undefined]) {
        const clock = { now: () => now };
        const f = fixture(clock),
            replies = [];
        const execute = statusDispatcher(f, clock);
        execute(
            {
                action: "status",
                params: {},
                ...(remaining === undefined
                    ? {}
                    : { expires_at: (now + remaining) / 1000 }),
            },
            (reply) => replies.push(reply)
        );
        assert.equal(replies.length, 0);
        assert.equal(f.calls.length, 1);
        assert.equal(f.timers.size, 1);
        f.finish();
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(replies.length, 1);
        assert.equal(replies[0].status, "ok");
        assert.equal(replies[0].data.volume, 35);
        assert.equal(replies[0].data.local_source_diagnostics.consistent, true);
        assert.equal(f.timers.size, 0);
    }
});

test("status rechecks remaining TTL after assembling the ordinary snapshot", () => {
    let now = 5000000;
    const f = fixture(),
        replies = [];
    const execute = statusDispatcher(f, { now: () => now });
    f.w.stbGetVolume = () => {
        now += 100;
        return 35;
    };
    execute(
        { action: "status", params: {}, expires_at: (now + 300) / 1000 },
        (reply) => replies.push(reply)
    );
    assert.equal(replies.length, 1);
    assert.equal(replies[0].status, "ok");
    assert.equal(replies[0].data.volume, 35);
    assert.equal(replies[0].data.local_source_diagnostics, undefined);
    assert.equal(f.calls.length, 0);
    assert.equal(f.timers.size, 0);
});

test("optional capture cannot start a native wait after using the remaining allowance", async () => {
    let now = 5000000;
    const clock = { now: () => now };
    const f = fixture(clock),
        replies = [];
    const execute = statusDispatcher(f, clock);
    const canPlayType = f.node.canPlayType;
    f.node.canPlayType = (value) => {
        now += 1;
        return canPlayType(value);
    };
    execute(
        { action: "status", params: {}, expires_at: (now + 251) / 1000 },
        (reply) => replies.push(reply)
    );
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(
        f.calls.length,
        0,
        "only 249 ms remain after the two codec getters"
    );
    assert.equal(f.timers.size, 0);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].status, "ok");
    assert.equal(replies[0].data.volume, 35);
});
