"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const test = require("node:test");
const acorn = require("acorn");
const plain = (x) => JSON.parse(JSON.stringify(x));
const contract = JSON.parse(
    fs.readFileSync("contracts/local-media-session-v1.json", "utf8")
);
const legacy = JSON.parse(
    fs.readFileSync("contracts/local-media-v1.json", "utf8")
);
function load(file, requires = {}, extra = {}) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
        },
    }).outputText;
    acorn.parse(code, { ecmaVersion: 5 });
    vm.runInNewContext(code, {
        clearTimeout,
        Date,
        exports,
        require: (name) => {
            assert.ok(name in requires, name);
            return requires[name];
        },
        setTimeout,
        ...extra,
    });
    return exports;
}
const selection = load("src/offline/playback-selection.ts");
const runner = {};
load("src/commands/remote-local-runner.ts", {}, { window: runner });
const plex = load("src/commands/remote-plex.ts");
const favorites = load("src/commands/remote-favorites-contract.ts");
const update = load("src/commands/remote-app-update.ts", {
    "../plugins/native-bridge": {
        resolveNativePlugin: () => assert.fail("no installer"),
    },
});
const control = load("src/commands/remote-restart.ts", {
    "./remote-app-update": update,
    "./remote-favorites-contract": favorites,
    "./remote-plex": plex,
});
function fixture(scanning = false) {
    const source = plain(contract.play_result.source);
    const catalog = {
        items: [1, 2, 3].map((n) => ({
            id: String(n),
            name: n + ".mp4",
            sourceId: source.id,
            url: "/v/" + n,
        })),
        scanning,
        sourceScans: [
            {
                generation: 1,
                sourceId: source.id,
                state: scanning ? "scanning" : "complete",
            },
        ],
        sources: [source],
    };
    const calls = [];
    const w = {
        __ottActiveProviderDriver: { id: "m3u" },
        __ottCommandChannelLoad: {},
        __ottLocalMedia: {
            remoteActivate: (...args) => calls.push(args),
            remoteCapabilities: () => plain(legacy.capability),
            remoteCatalog: async () => catalog,
            remoteConnect: async () => ({ source }),
            remoteProgressive: () => true,
            remoteSources: async () => ({ sources: [source] }),
        },
        runtime: "page-123",
    };
    const execute = load("src/commands/remote-local-media.ts", {
        "../offline/playback-selection": selection,
        "./remote-feature": {
            loadRemoteFeature: (win, name, done) => {
                assert.equal(name, "remote-local-runner");
                win.__ottRemoteLocalMediaRun = runner.__ottRemoteLocalMediaRun;
                done();
            },
        },
        "./remote-restart": {
            remotePlayerInfo: (win) => ({ runtime: win.runtime }),
        },
    }).executeRemoteLocalMedia;
    return {
        calls,
        request: (params) =>
            new Promise((resolve) =>
                execute(w, params, (reply) => resolve(plain(reply)))
            ),
        w,
    };
}
function capability(w, params) {
    let result;
    control.executeRemoteControl(w, "capabilities", params, (reply) => {
        result = plain(reply);
    });
    return result;
}
test("session-only and combined probes preserve Local/session independently of progressive support", () => {
    for (const supported of [true, false, undefined])
        for (const probe of [
            contract.probe_request,
            contract.session_probe_request,
            { params: {} },
        ]) {
            const f = fixture();
            if (supported === undefined)
                delete f.w.__ottLocalMedia.remoteProgressive;
            else f.w.__ottLocalMedia.remoteProgressive = () => supported;
            const reply = capability(f.w, probe.params);
            assert.equal(reply.status, "ok");
            assert.deepEqual(
                reply.data.local_media_session,
                contract.capability
            );
            assert.deepEqual(reply.data.local_media, legacy.capability);
            assert.equal(Object.keys(reply.data.local_media).length, 5);
            assert.deepEqual(
                reply.data.local_media_progressive,
                supported === true ? { version: 1 } : undefined
            );
            assert.equal(f.calls.length, 0);
        }
    const f = fixture();
    delete f.w.__ottLocalMedia;
    assert.equal(
        capability(f.w, { local_media_session: true }).data.local_media_session,
        undefined
    );
});
test("probe extensions require present true; no unknown or malformed capability parameters", () => {
    for (const field of ["local_media_session", "local_media_progressive"])
        for (const value of [false, null, 1, "true", undefined]) {
            assert.equal(
                capability(fixture().w, { [field]: value }).status,
                "rejected"
            );
        }
    assert.equal(capability(fixture().w, { unknown: true }).status, "rejected");
});
test("flagged play/shuffle and progressive results match shared session fixture exactly", async () => {
    for (const key of [
        "play",
        "shuffle",
        "progressive_play",
        "progressive_shuffle",
    ]) {
        const f = fixture(key.startsWith("progressive"));
        const result = await f.request(contract[key + "_request"].params);
        assert.equal(result.status, "ok");
        assert.deepEqual(result.data, contract[key + "_result"]);
        assert.equal(f.calls.length, 1);
    }
});
test("legacy ACK unchanged; progressive remains independent of session", async () => {
    for (const op of ["play", "shuffle"]) {
        const f = fixture();
        const result = await f.request({
            op,
            runtime: "page-123",
            source: "Movies",
        });
        assert.deepEqual(result.data, legacy[op + "_result"]);
        assert.ok(!("session" in result.data));
        const progress = await fixture(true).request({
            op,
            progressive: true,
            runtime: "page-123",
            source: "Movies",
        });
        assert.equal(progress.status, "ok");
        assert.equal(progress.data.scanning, true);
        assert.ok(!("session" in progress.data));
    }
});
test("session false/null/undefined rejected; session cannot decorate sources or connect", async () => {
    for (const op of ["play", "shuffle"])
        for (const session of [false, null, undefined, 1, "true"]) {
            const f = fixture();
            const reply = await f.request({
                op,
                runtime: "page-123",
                session,
                source: "Movies",
            });
            assert.equal(reply.status, "rejected");
            assert.equal(reply.data.error, "invalid_request");
            assert.equal(f.calls.length, 0);
        }
    for (const op of ["sources", "connect"]) {
        const reply = await fixture().request({
            op,
            runtime: "page-123",
            ...(op === "connect" ? { source: "Movies" } : {}),
            session: true,
        });
        assert.equal(reply.status, "rejected");
        assert.equal(reply.data.error, "invalid_request");
        assert.ok(!("session" in reply.data));
    }
});
test("session request errors keep legacy error shape without falsely confirming a session", async () => {
    const f = fixture();
    f.w.__ottLocalMedia.remoteSources = async () => ({
        sources: [contract.play_result.source, contract.play_result.source],
    });
    const reply = await f.request(contract.shuffle_request.params);
    assert.equal(reply.status, "rejected");
    assert.deepEqual(reply.data, contract.error_result);
});
