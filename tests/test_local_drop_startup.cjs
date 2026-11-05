"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const { integrationFixture } = require("./helpers/provider-driver-fixture.cjs");
const privateRuntime = require("./helpers/private-runtime.cjs");

const plugin = {};
vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/plugins/local-drop.ts", "utf8"), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
        },
    }).outputText,
    {
        exports: plugin,
        require(name) {
            assert.equal(name, "../offline/dropped-video");
            return {
                createDroppedVideo() {
                    assert.fail("not a DOM drop");
                },
            };
        },
    }
);
const flush = () => new Promise((resolve) => setImmediate(resolve));
const GRANT = "startup_native_grant";

async function fixture(provider = "stalker", lazy = true) {
    const f = integrationFixture(provider, {
        stalkerstalker_data: JSON.stringify({
            mac: "02:00:00:00:00:01",
            portal: "https://portal.test/",
        }),
    });
    const w = f.host;
    const assets = [],
        ready = [],
        takes = [],
        released = [],
        played = [],
        events = [];
    let subscription,
        firstRuns = 0;
    w.console.error = () => {};
    w.firstRun = () => {
        firstRuns++;
        events.push("first-run");
    };
    w.metadataText = String; // Error-label rendering is a mocked UI port.
    w.addEventListener = () => {};
    w.removeEventListener = () => {};
    w.__ottLocalMedia = {
        playDroppedVideo(catalog, admitted) {
            assert.equal(admitted(), true);
            played.push(catalog);
        },
    };
    w.__TAURI__ = {
        core: {
            invoke(command, args) {
                if (command === "local_media_drop_ready") {
                    events.push("ready");
                    ready.push(w.__ottCommandChannelLoad);
                    subscription({ payload: { grant: GRANT } });
                    return Promise.resolve();
                }
                if (command === "local_media_release_drop") {
                    released.push(args.grant);
                    return Promise.resolve();
                }
                assert.equal(command, "local_media_take_drop");
                assert.equal(args.grant, GRANT);
                return new Promise((resolve) =>
                    takes.push({ load: w.__ottCommandChannelLoad, resolve })
                );
            },
        },
        event: {
            listen(name, callback) {
                assert.equal(name, "local-media-drop");
                subscription = callback;
                return Promise.resolve(() => {});
            },
        },
    };
    const original = w.__ottStalkerDriver;
    if (lazy) {
        privateRuntime(w, "src/provider/assets.ts");
        w.__ottProviderAssets.classic = w.__ottProviderAssets.create(
            w,
            (url, ready, fail) => {
                assets.push({ fail, ready, url });
            }
        );
        delete w.__ottStalkerDriver;
    }
    plugin.installLocalDrop(w);
    await flush();
    return {
        ...f,
        assets,
        get completed() {
            return f.completed;
        },
        events,
        get firstRuns() {
            return firstRuns;
        },
        mount() {
            w.__ottStalkerDriver = original;
            assets[0].ready();
        },
        played,
        ready,
        released,
        takes,
    };
}

// Real loadProv and loadChannels plus real lazy-assets and local-drop code.
// Only transport, native invoke, UI ports and the final playback sink are mocked.
test("cold native file waits for lazy mount and the real channel generation, not catalog response", async () => {
    const f = await fixture();
    f.host.loadProv();
    const providerGeneration = f.host.__ottCommandChannelLoad;
    assert.equal(f.assets.length, 1);
    assert.equal(
        f.ready.length,
        0,
        "startup provider token is not the channel token"
    );
    f.mount();
    assert.equal(
        f.requests.length,
        1,
        "real Stalker catalog transport is still pending"
    );
    assert.equal(f.completed, 0);
    assert.equal(f.host.commandChannelsReady, false);
    assert.equal(f.ready.length, 1);
    assert.notEqual(f.ready[0], providerGeneration);
    assert.equal(f.ready[0], f.host.__ottCommandChannelLoad);
    assert.equal(f.host.__ottCommandChannelCancel.owner, f.ready[0]);
    const catalog = { items: [{ id: "native-item" }] };
    f.takes[0].resolve(catalog);
    await flush();
    assert.deepEqual(f.played, [catalog]);
    assert.deepEqual(f.released, []);
    // The playback sink is mocked; complete its still-held provider transport
    // to prove the completion getter above observes the live fixture.
    f.requests[0].resolve({ result: {} });
    f.requests[1].resolve({
        result: [{ id: 42, name: "News", url: "https://live.test/42" }],
    });
    assert.equal(f.completed, 1);
});

test("preloaded provider publishes one ready for the actual channel generation", async () => {
    const f = await fixture("stalker", false);
    f.host.loadProv();
    const load = f.host.__ottCommandChannelLoad;
    assert.equal(f.assets.length, 0);
    assert.equal(f.requests.length, 1);
    assert.equal(f.completed, 0);
    assert.equal(f.ready.length, 1);
    assert.equal(f.takes[0].load, load);
    f.host.__ottLocalDrop.ready();
    assert.equal(f.ready.length, 1);
    assert.equal(f.takes.length, 1);
    f.takes[0].resolve({ items: [{ id: "preloaded-item" }] });
    await flush();
    assert.equal(f.host.__ottCommandChannelLoad, load);
    assert.equal(f.played.length, 1);
    assert.deepEqual(f.released, []);
});

test("no configured provider reaches first-run before publishing native readiness", async () => {
    const f = await fixture("");
    f.host.loadProv();
    assert.equal(f.firstRuns, 1);
    assert.deepEqual(f.events, ["first-run", "ready"]);
    assert.equal(f.assets.length, 0);
    assert.equal(f.ready.length, 1);
    f.takes[0].resolve({ items: [{ id: "first-run-item" }] });
    await flush();
    assert.equal(f.played.length, 1);
});

test("optional provider failure still admits the queued native file after first-run", async () => {
    const f = await fixture();
    f.host.loadProv();
    assert.equal(f.ready.length, 0);
    f.assets[0].fail(new Error("synthetic asset failure"));
    assert.equal(f.firstRuns, 1);
    assert.deepEqual(f.events, ["first-run", "ready"]);
    assert.equal(f.ready.length, 1);
    f.takes[0].resolve({ items: [{ id: "fallback-item" }] });
    await flush();
    assert.equal(f.played.length, 1);
});

test("first-run reentry cannot publish readiness for a newer unfinished provider", async () => {
    const f = await fixture("");
    f.host.firstRun = () => {
        f.saved.set("ottplayprov", "stalker");
        f.host.loadProv("stalker");
    };
    f.host.loadProv();
    assert.equal(f.assets.length, 1);
    assert.equal(f.ready.length, 0);
    f.mount();
    assert.equal(f.ready.length, 1);
    assert.equal(f.ready[0], f.host.__ottCommandChannelLoad);
});

test("a genuine later channel reload still retires a pending native take", async () => {
    const f = await fixture();
    f.host.loadProv();
    f.mount();
    const captured = f.takes[0].load;
    f.host.loadChannels();
    assert.notEqual(f.host.__ottCommandChannelLoad, captured);
    f.takes[0].resolve({ items: [{ id: "stale-item" }] });
    await flush();
    assert.deepEqual(f.played, []);
    assert.deepEqual(f.released, [GRANT]);
});

test("synchronous channel setup failure publishes its committed generation", async () => {
    const f = await fixture();
    f.host.setPlayerMode = () => {
        throw new Error("synthetic setup failure");
    };
    f.host.loadProv();
    assert.equal(f.ready.length, 0);
    f.mount();
    assert.equal(f.ready.length, 1);
    assert.equal(f.ready[0], f.host.__ottCommandChannelLoad);
    f.takes[0].resolve({ items: [{ id: "setup-failure-item" }] });
    await flush();
    assert.equal(f.played.length, 1);
});
