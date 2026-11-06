"use strict";
const storageImports =
    require("./helpers/remote-transfer-dependency.cjs").storage;
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const test = require("node:test");
const acorn = require("acorn");
const clone = (value) => JSON.parse(JSON.stringify(value));
const contract = JSON.parse(
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
        require(name) {
            if (
                name === "./favorites-physical-storage" ||
                name === "../settings/interface-colors"
            )
                return storageImports().require(name);
            assert.ok(name in requires, name);
            return requires[name];
        },
        setTimeout,
        URL,
        ...extra,
    });
    return exports;
}
const selection = load("src/offline/playback-selection.ts");
const progress = load("src/offline/local-media-progress.ts");
const runnerWindow = {};
load("src/commands/remote-local-runner.ts", {}, { window: runnerWindow });
function deferredExecute(loadFeature, extra = {}) {
    return load(
        "src/commands/remote-local-media.ts",
        {
            "../offline/playback-selection": selection,
            "./remote-feature": { loadRemoteFeature: loadFeature },
            "./remote-restart": {
                remotePlayerInfo: (w) => ({ runtime: w.runtime }),
            },
        },
        extra
    ).executeRemoteLocalMedia;
}
const execute = deferredExecute((w, name, done) => {
    assert.equal(name, "remote-local-runner");
    w.__ottRemoteLocalMediaRun = runnerWindow.__ottRemoteLocalMediaRun;
    done();
});
const source = {
    available: true,
    id: "source-123",
    kind: "folder",
    name: "Movies",
};
const other = { available: true, id: "other", kind: "folder", name: "Other" };
function catalog() {
    return {
        items: [1, 2, 3]
            .map((id) => ({
                id: String(id),
                name: id + ".mp4",
                sourceId: source.id,
                url: "/v/" + id,
            }))
            .concat({
                id: "unrelated",
                name: "Other.mp4",
                sourceId: "other",
                url: "/v/other",
            }),
        scanning: false,
        sources: [source, other],
    };
}
function sourceCatalog(state = "complete", generation = 1) {
    return {
        ...catalog(),
        scanning: true,
        sourceScans: [
            { generation, sourceId: source.id, state },
            { generation: 1, sourceId: other.id, state: "scanning" },
        ],
    };
}
function fixture() {
    const calls = [],
        value = catalog();
    const w = {
        __ottActiveProviderDriver: { id: "m3u" },
        __ottCommandChannelLoad: {},
        __ottLocalMedia: {
            remoteActivate: (...args) =>
                calls.push(["activate", ...args.slice(0, 2)]),
            remoteCapabilities: () => clone(contract.capability),
            remoteCatalog: async () => value,
            remoteConnect: async (path) => {
                calls.push(["connect", path]);
                return { source };
            },
            remoteSources: async () => ({ sources: value.sources }),
        },
        runtime: "page-123",
    };
    return {
        calls,
        request(params, expiresAt) {
            return new Promise((resolve) =>
                execute(
                    w,
                    params,
                    (result) => resolve(clone(result)),
                    expiresAt
                )
            );
        },
        value,
        w,
    };
}
const request = (op, extra = {}) => ({
    op,
    runtime: "page-123",
    ...(op === "sources" ? {} : { source: "Movies" }),
    ...extra,
});
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("shared contract: named play and shuffle return exact correlated shape, source-only unique order", async () => {
    for (const op of ["play", "shuffle"]) {
        const f = fixture();
        const result = await f.request(request(op));
        assert.equal(result.status, "ok");
        assert.deepEqual(result.data, contract[op + "_result"]);
        assert.equal(f.calls[0][0], "activate");
        assert.equal(f.calls[0][1], source.id);
        assert.deepEqual([...f.calls[0][2]].sort(), ["1", "2", "3"]);
        assert.equal(new Set(f.calls[0][2]).size, 3);
        assert.deepEqual(
            f.value.items.map((x) => x.id),
            ["1", "2", "3", "unrelated"]
        );
    }
});

test("sources and connect preserve provider/playback; native source paths are explicit only", async () => {
    const f = fixture();
    f.value.sources = [{ ...source, path: "/Volumes/data/Movies" }];
    const provider = f.w.__ottActiveProviderDriver;
    assert.deepEqual(
        (await f.request(request("sources"))).data,
        contract.sources_result
    );
    assert.deepEqual(
        (await f.request(request("sources", { include_paths: true }))).data,
        contract.paths_result
    );
    const connected = await f.request(request("connect"));
    assert.equal(connected.status, "ok");
    assert.equal(connected.data.count, 0);
    assert.deepEqual(connected.data.source, source);
    assert.deepEqual(f.calls, []);
    assert.equal(f.w.__ottActiveProviderDriver, provider);
});

test("browser cannot gain paths or link absolute folders; exact source IDs and names only", async () => {
    const f = fixture();
    f.w.__ottLocalMedia.remoteCapabilities = () => ({
        ...contract.capability,
        absolute_paths: false,
    });
    for (const params of [
        request("sources", { include_paths: true }),
        request("shuffle", { source: "/Volumes/data/Movies" }),
    ])
        assert.equal((await f.request(params)).data.error, "unsupported");
    for (const name of ["Movie", "movies", "missing"])
        assert.equal(
            (await f.request(request("shuffle", { source: name }))).data.error,
            "source_not_found"
        );
    assert.equal(
        (await f.request(request("play", { source: "../Movies" }))).data.error,
        "invalid_request"
    );
    assert.equal(
        (await f.request(request("play", { source: source.id }))).status,
        "ok"
    );
});

test("ambiguous, unavailable, empty, partial and oversized folders never fall back to all sources", async () => {
    for (const [change, expected] of [
        [
            (f) => f.value.sources.push({ ...source, id: "duplicate" }),
            "source_ambiguous",
        ],
        [
            (f) => (f.value.sources = [{ ...source, available: false }]),
            "source_unavailable",
        ],
        [
            (f) =>
                (f.value.items = f.value.items.filter(
                    (x) => x.sourceId === "other"
                )),
            "empty_source",
        ],
        [(f) => (f.value.scanning = true), "catalog_loading"],
        [
            (f) =>
                (f.value.items = Array.from({ length: 50001 }, (_, n) => ({
                    id: String(n),
                    sourceId: source.id,
                    url: "/v",
                }))),
            "too_many_items",
        ],
        [(f) => f.value.items.push(f.value.items[0]), "catalog_unavailable"],
    ]) {
        const f = fixture();
        change(f);
        assert.equal(
            (await f.request(request("shuffle"))).data.error,
            expected
        );
        assert.deepEqual(f.calls, []);
    }
});

test("profile restrictions are retained when selecting a folder", async () => {
    const f = fixture();
    f.w.__ottOfflineProfiles = {
        filter: (value) => ({
            ...value,
            items: value.items.filter((x) => x.sourceId !== source.id),
        }),
    };
    assert.equal(
        (await f.request(request("shuffle"))).data.error,
        "empty_source"
    );
    assert.deepEqual(f.calls, []);
});

test("runtime, provider and load supersession during catalog collection cannot start playback", async () => {
    for (const change of [
        (w) => (w.runtime = "page-new"),
        (w) => (w.__ottActiveProviderDriver = { id: "m3u" }),
        (w) => (w.__ottCommandChannelLoad = {}),
        (w) => (w.__ottStandby = { blocked: () => true }),
    ]) {
        const f = fixture();
        let resolve;
        f.w.__ottLocalMedia.remoteCatalog = () =>
            new Promise((done) => (resolve = done));
        const pending = f.request(request("shuffle"));
        await tick();
        change(f.w);
        resolve(f.value);
        const result = await pending;
        assert.equal(result.data.error, "runtime_changed");
        assert.equal(result.data.runtime, "page-123");
        assert.deepEqual(f.calls, []);
    }
});

test("expired requests reply once and cannot start playback after a late scan", async () => {
    const f = fixture();
    let resolve,
        replies = 0;
    f.w.__ottLocalMedia.remoteCatalog = () =>
        new Promise((done) => (resolve = done));
    const result = await new Promise((done) =>
        execute(
            f.w,
            request("shuffle"),
            (value) => {
                replies++;
                done(clone(value));
            },
            (Date.now() + 30) / 1000
        )
    );
    assert.equal(result.data.error, "catalog_loading");
    assert.equal(f.w.__ottLocalMediaRequestActive, false);
    resolve(f.value);
    await tick();
    assert.equal(replies, 1);
    assert.deepEqual(f.calls, []);
});

test("singleflight rejects overlap without releasing the active operation", async () => {
    const f = fixture();
    let resolve;
    f.w.__ottLocalMedia.remoteCatalog = () =>
        new Promise((done) => (resolve = done));
    const pending = f.request(request("play"));
    await tick();
    assert.equal(
        (await f.request(request("shuffle"))).data.error,
        "operation_in_progress"
    );
    assert.equal(f.w.__ottLocalMediaRequestActive, true);
    resolve(f.value);
    assert.equal((await pending).status, "ok");
    assert.equal(f.w.__ottLocalMediaRequestActive, false);
});

function pluginFixture(options = {}) {
    let linked = !!options.connected;
    let reads = 0;
    const data = options.data || new Map(),
        calls = [],
        snapshots = [],
        w = {
            __ottActiveProviderDriver: { id: "m3u" },
            __ottCommandChannelLoad: {},
            __TAURI__: {},
            closeList() {},
            fetch: async () => {
                reads++;
                return {
                    json: async () =>
                        options.catalog
                            ? options.catalog()
                            : snapshots.length > 1
                              ? snapshots.shift()
                              : snapshots[0],
                    ok: true,
                };
            },
            loadProv(id, session) {
                if (session) session();
                calls.push(["provider", id]);
                this.__ottActiveProviderDriver = { id };
                this.__ottCommandChannelLoad = {};
            },
            optionsList() {},
            runtime: "page-123",
            stbGetItem: (key) => data.get(key) || "",
            stbSetItem: (key, value) => data.set(key, value),
        };
    w.localStorage = {
        getItem: (key) => (data.has(key) ? data.get(key) : null),
        key: (index) => [...data.keys()][index] || null,
        get length() {
            return data.size;
        },
        removeItem: (key) => data.delete(key),
        setItem: (key, value) => data.set(key, String(value)),
    };
    const storage = load(
        "src/storage/index.ts",
        {},
        { document: { cookie: "" }, window: w }
    );
    w.stbGetItem = storage.stbGetItem;
    w.stbSetItem = storage.stbSetItem;
    w.stbDelItem = storage.stbDelItem;
    const install = load("src/plugins/local-media.ts", {
        "../commands/remote-feature": {
            loadRemoteFeature() {
                throw Error("Unexpected UI load");
            },
        },
        "../offline/browser-local-media": {
            installBrowserLocalMedia: () => options.browser || { suspend() {} },
            installOfflineShell() {},
        },
        "../offline/local-media-progress": progress,
        "../offline/playback-selection": selection,
        "../offline/profiles": { installOfflineProfiles() {} },
        "./native-bridge": {
            resolveNativePlugin: () => options.native || {},
            tauriInvoke: async (name, args) => {
                calls.push([name, args]);
                if (options.invoke) {
                    const result = options.invoke(name, args);
                    if (result !== undefined) return result;
                }
                if (name === "local_media_capabilities")
                    return {
                        absolutePaths: true,
                        sourcePaths: true,
                        version: 1,
                    };
                if (name === "local_media_sources")
                    return {
                        endpoint: "http://localhost/catalog",
                        sources: args.path
                            ? linked
                                ? [source]
                                : []
                            : [source, other],
                    };
                if (name === "local_media_link_folder") {
                    linked = true;
                    return { endpoint: "http://localhost/catalog", source };
                }
                if (name === "offline_media_endpoint")
                    return { endpoint: "http://localhost/catalog" };
                throw Error(name);
            },
        },
    }).installLocalMedia;
    if (options.mode) delete w.__TAURI__;
    if (options.mode === "native")
        w.Capacitor = { isNativePlatform: () => true };
    if (options.host) Object.assign(w, options.host);
    const api = install(w);
    return {
        api,
        calls,
        data,
        get reads() {
            return reads;
        },
        snapshots,
        w,
    };
}

test("new native absolute folder waits for the complete scan and activates only its own source", async () => {
    const f = pluginFixture();
    await tick();
    f.snapshots.push(
        { ...catalog(), items: [catalog().items[0]], scanning: true },
        catalog()
    );
    const result = await new Promise((resolve) =>
        execute(
            f.w,
            request("shuffle", { source: "/Volumes/data/Movies/" }),
            resolve
        )
    );
    assert.equal(result.status, "ok");
    assert.equal(result.data.count, 3);
    assert.ok(f.calls.some((x) => x[0] === "local_media_link_folder"));
    assert.equal(f.calls.filter((x) => x[0] === "provider").length, 1);
    const initial = f.api.takeImportSelection();
    const delivered = await f.api.list();
    const filtered = f.api.playbackFilter(delivered);
    assert.deepEqual(clone(filtered.items.map((x) => x.id)).sort(), [
        "1",
        "2",
        "3",
    ]);
    const order = clone(f.api.playbackOrder());
    assert.deepEqual(order.slice().sort(), ["local-1", "local-2", "local-3"]);
    assert.deepEqual(clone(filtered.items.map((x) => "local-" + x.id)), order);
    assert.equal(initial, order[0]);
    f.api.playbackOrdered();
    assert.equal(f.api.playbackOrder(), null);
});

test("remote Local refuses stable foreign storage aliases before admission and deferred handoff", async () => {
    for (const deferred of [false, true]) {
        const f = pluginFixture();
        await tick();
        const before = new Map(f.data),
            foreign = new Map(f.data);
        let handoff;
        if (deferred) {
            f.w.loadProv = (_id, callback) => {
                f.w.__ottCommandChannelLoad = {};
                handoff = callback;
            };
            f.api.remoteActivate(source.id, ["1"], catalog(), () => true);
        }
        f.w.stbGetItem = (key) => foreign.get(key) ?? null;
        f.w.stbSetItem = (key, value) => foreign.set(key, value);
        f.w.stbDelItem = (key) => foreign.delete(key);
        assert.throws(
            () =>
                deferred
                    ? handoff()
                    : f.api.remoteActivate(
                          source.id,
                          ["1"],
                          catalog(),
                          () => true
                      ),
            (error) =>
                ["restricted", "runtime_changed"].includes(error.localMediaCode)
        );
        assert.deepEqual([...f.data], [...before]);
        assert.deepEqual([...foreign], [...before]);
        assert.equal(f.w.ottpStorage.localPlayback.active(), false);
    }
});

test("stale Local session finishing cannot promote or cancel a synchronously replacing command", async () => {
    for (const during of ["checkpoint", "dispose"]) {
        const f = pluginFixture();
        await tick();
        f.api.remoteActivate(source.id, ["1", "2", "3"], catalog(), () => true);
        const replace = () =>
            f.api.remoteActivate(
                other.id,
                ["other-item"],
                catalog(),
                () => true
            );
        if (during === "checkpoint")
            f.w.__ottClassicPlayback = { checkpointNow: replace };
        else f.w.__ottActiveProviderDriver.dispose = replace;
        assert.equal(f.api.finishSession(during === "checkpoint"), false);
        assert.equal(f.w.ottpStorage.localPlayback.active(), true);
        const selection = JSON.parse(
            f.w.stbGetItem("localMediaPlaybackSelection")
        );
        assert.equal(selection.source, other.id);
        assert.equal(f.data.get("localMediaPlaybackSelection"), undefined);
        assert.equal(f.w.__ottActiveProviderDriver.id, "offline");
    }
});

test("a complete native folder plays and explicitly promoted Local choice reloads while unrelated scans remain incomplete", async () => {
    const f = pluginFixture({ connected: true });
    await tick();
    f.snapshots.push(sourceCatalog());
    const reply = await new Promise((resolve) =>
        execute(f.w, request("shuffle"), resolve)
    );
    assert.equal(reply.status, "ok");
    assert.equal(reply.data.count, 3);
    assert.equal(f.reads, 1, "Movies does not await the unrelated FFFF scan");
    assert.equal(
        f.calls.find(([name]) => name === "local_media_sources")[1].selection,
        "Movies",
        "named lookup only probes the requested native source"
    );
    assert.equal(
        f.calls.find(([name]) => name === "offline_media_endpoint")[1].sourceId,
        source.id
    );
    const delivered = await f.api.playbackList();
    assert.equal(
        delivered.scanning,
        true,
        "the cached catalogue retains global scan state"
    );
    assert.equal(delivered.sources.length, 2);
    const scoped = f.api.playbackFilter(delivered);
    const order = clone(scoped.items.map((item) => item.id));
    assert.equal(scoped.scanning, false);
    assert.deepEqual(order.slice().sort(), ["1", "2", "3"]);
    assert.equal(
        scoped.items.some((item) => item.sourceId === other.id),
        false
    );
    assert.equal(f.api.completedSources(), null);
    await assert.rejects(f.api.snapshot(), /scan to finish/);

    assert.equal(f.api.finishSession(true), true);
    const reloaded = pluginFixture({ connected: true, data: f.data });
    reloaded.w.__ottActiveProviderDriver = { id: "offline" };
    reloaded.snapshots.push(sourceCatalog());
    const restored = await reloaded.api.playbackList();
    assert.deepEqual(
        clone(
            reloaded.api.playbackFilter(restored).items.map((item) => item.id)
        ),
        order
    );
    assert.equal(
        reloaded.calls.find(([name]) => name === "offline_media_endpoint")[1]
            .sourceId,
        source.id
    );
    await assert.rejects(reloaded.api.snapshot(), /scan to finish/);

    const complete = { ...sourceCatalog(), scanning: false };
    complete.sourceScans[1].state = "complete";
    reloaded.snapshots.splice(
        0,
        reloaded.snapshots.length,
        sourceCatalog(),
        complete
    );
    let managerReady = false;
    const manager = reloaded.api.list().then((value) => {
        managerReady = true;
        return value;
    });
    await tick();
    assert.equal(
        managerReady,
        false,
        "the manager still waits for the whole library"
    );
    assert.equal((await manager).sources.length, 2);
    assert.equal((await reloaded.api.snapshot()).items.length, 4);
    assert.equal(reloaded.api.completedSources().length, 2);
    assert.equal(
        reloaded.calls
            .filter(([name]) => name === "offline_media_endpoint")
            .at(-1)[1].sourceId,
        undefined
    );
});

test("a new native folder starts its permitted partial queue and hands off background discoveries", async () => {
    const f = pluginFixture();
    await tick();
    const prefix = {
        ...sourceCatalog("scanning", 4),
        items: [catalog().items[0]],
    };
    const complete = sourceCatalog("complete", 4);
    f.snapshots.push(prefix, complete);
    const reply = await new Promise((resolve) =>
        execute(
            f.w,
            request("shuffle", {
                progressive: true,
                source: "/Volumes/data/Movies/",
            }),
            resolve
        )
    );
    assert.deepEqual(clone(reply.data), {
        ...contract.progressive_shuffle_result,
        count: 1,
    });
    assert.equal(f.reads, 1);
    assert.equal(f.calls.filter(([name]) => name === "provider").length, 1);
    f.api.bindPlaybackOwner(() => true);
    const seen = [];
    const delivered = await f.api.playbackList((value) => {
        seen.push(clone(f.api.playbackFilter(value)));
        return true;
    });
    assert.deepEqual(
        seen.map((value) => value.items.length),
        [1, 3]
    );
    assert.equal(seen[0].scanning, true);
    assert.equal(seen[1].scanning, false);
    assert.equal(seen[1].items[0].id, seen[0].items[0].id);
    assert.equal(f.api.playbackFilter(delivered).scanning, false);
    assert.equal(
        f.calls.filter(([name]) => name === "provider").length,
        1,
        "background discoveries do not activate the provider again"
    );
});

test("early admission waits past denied, unsupported and unrelated files", async () => {
    const f = pluginFixture({ connected: true });
    await tick();
    f.w.__ottOfflineProfiles = {
        catalogGuard: () => () => true,
        filter: (value) => ({
            ...value,
            items: value.items.filter((item) => item.id !== "1"),
        }),
    };
    const blocked = {
        ...sourceCatalog("scanning", 5),
        items: [
            catalog().items[0],
            { ...catalog().items[1], playback: { mode: "unsupported" } },
            catalog().items[3],
        ],
    };
    const playable = {
        ...sourceCatalog("scanning", 5),
        items: [...blocked.items, catalog().items[2]],
    };
    f.snapshots.push(blocked, playable);
    const reply = await new Promise((resolve) =>
        execute(f.w, request("shuffle", { progressive: true }), resolve)
    );
    assert.equal(reply.status, "ok");
    assert.equal(reply.data.count, 1);
    assert.equal(reply.data.scanning, true);
    assert.equal(f.reads, 2);
    assert.deepEqual(clone(f.api.playbackOrder()), ["local-3"]);
});

test("legacy commands wait for completion and retain exactly nine response fields", async () => {
    for (const op of ["play", "shuffle"]) {
        const f = pluginFixture({ connected: true });
        await tick();
        f.snapshots.push(
            {
                ...sourceCatalog("scanning", 8),
                items: [catalog().items[0]],
            },
            sourceCatalog("complete", 8)
        );
        const reply = await new Promise((resolve) =>
            execute(f.w, request(op), resolve)
        );
        assert.equal(reply.status, "ok");
        assert.deepEqual(clone(reply.data), contract[op + "_result"]);
        assert.equal(Object.keys(reply.data).length, 9);
        assert.equal(f.reads, 2);
    }
});

test("progressive opt-in is strict true and restricted to play and shuffle", async () => {
    for (const params of [
        request("play", { progressive: false }),
        request("shuffle", { progressive: false }),
        request("play", { progressive: null }),
        request("play", { progressive: "true" }),
        request("shuffle", { progressive: 1 }),
        request("sources", { progressive: true }),
        request("connect", { progressive: true }),
        request("connect", { progressive: false }),
    ]) {
        const f = fixture();
        assert.equal((await f.request(params)).data.error, "invalid_request");
        assert.deepEqual(f.calls, []);
    }
    for (const op of ["play", "shuffle"]) {
        const f = fixture();
        const reply = await f.request(request(op, { progressive: true }));
        assert.deepEqual(
            reply.data,
            contract[op + "_result"],
            "completed opt-in retains the old response shape"
        );
    }
});

test("default remote catalog still waits for source completion", async () => {
    const f = pluginFixture({ connected: true });
    await tick();
    f.snapshots.push(
        sourceCatalog("scanning", 6),
        sourceCatalog("complete", 6)
    );
    const value = await f.api.remoteCatalog(() => true, source.id);
    assert.equal(value.sourceScans[0].state, "complete");
    assert.equal(f.reads, 2);
});

test("a partial provider handoff rejects a replacement source generation", async () => {
    const f = pluginFixture({ connected: true });
    await tick();
    f.snapshots.push(
        { ...sourceCatalog("scanning", 6), items: [catalog().items[0]] },
        sourceCatalog("complete", 7)
    );
    const reply = await new Promise((resolve) =>
        execute(f.w, request("shuffle", { progressive: true }), resolve)
    );
    assert.equal(reply.status, "ok");
    f.api.bindPlaybackOwner(() => true);
    const seen = [];
    await assert.rejects(
        f.api.playbackList((value) => {
            seen.push(value);
            return true;
        }),
        (error) => error.localMediaCode === "runtime_changed"
    );
    assert.equal(seen.length, 1);
    assert.equal(seen[0].sourceScans[0].generation, 6);
});

test("seeded partial restart retains discovered order, refreshes rows and bounds growth", () => {
    const data = new Map();
    const make = () =>
        selection.createLocalPlaybackSelection(
            {
                stbGetItem: (key) => data.get(key) || "",
                stbSetItem: (key, value) => data.set(key, value),
            },
            () => "fixture"
        );
    const selected = make();
    selected.select(source.id, ["1"], 42);
    const restored = make();
    const initial = {
        ...sourceCatalog("scanning", 9),
        items: catalog().items.slice(0, 1),
    };
    assert.deepEqual(
        clone(restored.filter(initial).items.map((item) => item.id)),
        ["1"]
    );
    const expanded = sourceCatalog("scanning", 9);
    expanded.items[0] = { ...expanded.items[0], name: "refreshed.mp4" };
    const result = restored.filter(expanded);
    assert.equal(result.items[0].id, "1");
    assert.equal(result.items[0].name, "refreshed.mp4");
    assert.deepEqual(clone(result.items.map((item) => item.id)).sort(), [
        "1",
        "2",
        "3",
    ]);
    assert.deepEqual(
        clone(restored.filter(expanded).items.map((item) => item.id)),
        clone(result.items.map((item) => item.id))
    );
    assert.throws(
        () =>
            restored.filter({
                ...expanded,
                items: Array.from({ length: 50001 }, (_, i) => ({
                    id: String(i),
                    sourceId: source.id,
                    url: "/v/" + i,
                })),
            }),
        (error) => error.localMediaCode === "too_many_items"
    );
});

test("waiting for a selected folder preserves the current playback reader until the provider handoff", async () => {
    let ready = false;
    let scanned = 0;
    let backgroundProgress = 0;
    let backgroundSettled = false;
    const f = pluginFixture({
        catalog: () => ({
            ...sourceCatalog(ready ? "complete" : "scanning"),
            items: ready ? catalog().items : [],
            scanned: ++scanned,
        }),
        connected: true,
    });
    await tick();
    f.w.__ottActiveProviderDriver = { id: "offline" };
    const background = f.api
        .list(() => {
            backgroundProgress++;
            return true;
        })
        .then((value) => {
            backgroundSettled = true;
            return value;
        });
    await tick();
    const pending = new Promise((resolve) =>
        execute(f.w, request("shuffle"), resolve)
    );
    await new Promise((resolve) => setTimeout(resolve, 280));
    const progressBeforeHandoff = backgroundProgress;
    const settledBeforeHandoff = backgroundSettled;
    const providerBeforeHandoff = f.calls.some(([name]) => name === "provider");
    ready = true;
    assert.equal((await pending).status, "ok");
    assert.equal(
        (await background).cancelled,
        true,
        "accepted handoff retires the previous reader"
    );
    assert.ok(
        progressBeforeHandoff >= 2,
        "the existing reader keeps receiving its own native progress"
    );
    assert.equal(
        settledBeforeHandoff,
        false,
        "a pending command must not cancel the current provider"
    );
    assert.equal(providerBeforeHandoff, false);
    assert.equal(f.calls.filter(([name]) => name === "provider").length, 1);
});

test("only an authoritative selected source permits a partial queue", async () => {
    for (const state of ["pending", "scanning"]) {
        const f = fixture();
        Object.assign(f.value, sourceCatalog(state));
        const reply = await f.request(
            request("shuffle", { progressive: true })
        );
        assert.equal(reply.status, "ok");
        assert.equal(reply.data.scanning, true);
        assert.equal(reply.data.count, 3);
    }
    for (const [state, error] of [["error", "catalog_unavailable"]]) {
        const f = fixture();
        Object.assign(f.value, sourceCatalog(state), { scanning: false });
        const reply = await f.request(
            request("shuffle", { progressive: true })
        );
        assert.equal(reply.data.error, error);
        assert.deepEqual(f.calls, []);
    }
    for (const scans of [
        [],
        [{ generation: 0, sourceId: source.id, state: "complete" }],
        [sourceCatalog().sourceScans[0], sourceCatalog().sourceScans[0]],
    ]) {
        const f = fixture();
        f.value.sourceScans = scans;
        const reply = await f.request(
            request("shuffle", { progressive: true })
        );
        assert.notEqual(reply.status, "ok");
        assert.deepEqual(f.calls, []);
    }
    const f = fixture();
    Object.assign(f.value, sourceCatalog(), {
        scanError: "Unrelated source failed",
    });
    assert.equal(
        (await f.request(request("shuffle", { progressive: true }))).status,
        "ok"
    );
    const scoped = selection
        .createLocalPlaybackSelection(
            {
                stbGetItem: () =>
                    JSON.stringify({
                        library: "fixture",
                        seed: 42,
                        source: source.id,
                        version: 1,
                    }),
            },
            () => "fixture"
        )
        .filter(f.value);
    assert.equal(scoped.scanning, false);
    assert.equal(scoped.scanError, undefined);
    assert.equal(
        f.value.scanError,
        "Unrelated source failed",
        "projection never clears the global failure"
    );
});

test("an unrelated scan error does not interrupt a pending selected source", async () => {
    const f = pluginFixture({ connected: true });
    await tick();
    const pending = {
        ...sourceCatalog("scanning", 3),
        scanError: "Other folder failed",
    };
    const complete = {
        ...sourceCatalog("complete", 3),
        scanError: "Other folder failed",
    };
    f.snapshots.push(pending, complete);
    const reply = await new Promise((resolve) =>
        execute(f.w, request("shuffle", { progressive: true }), resolve)
    );
    assert.equal(reply.status, "ok");
    assert.equal(f.reads, 1);
    assert.equal(reply.data.scanning, true);
    const projection = f.api.playbackFilter(pending);
    assert.equal(projection.scanning, true);
    assert.equal(projection.scanError, undefined);
    assert.equal(projection.items.length, 3);
    assert.equal(pending.scanError, "Other folder failed");
    const delivered = await f.api.playbackList(() => true);
    assert.equal(f.api.playbackFilter(delivered).scanning, false);
    await assert.rejects(f.api.snapshot(), /scan to finish/);
    assert.throws(
        () => f.api.playbackFilter(sourceCatalog("error", 3)),
        /selected local source/
    );

    const legacy = pluginFixture({ connected: true });
    await tick();
    legacy.snapshots.push({
        ...catalog(),
        scanError: "Global failure",
        scanning: true,
    });
    const failure = await new Promise((resolve) =>
        execute(legacy.w, request("shuffle", { progressive: true }), resolve)
    );
    assert.equal(failure.status, "rejected");
    assert.equal(
        legacy.calls.some(([name]) => name === "provider"),
        false
    );
});

test("changing source generation, disconnecting, or standby retires a waiting native queue", async () => {
    for (const change of ["generation", "disconnect", "standby"]) {
        const f = pluginFixture({ connected: true });
        await tick();
        const initial = sourceCatalog("scanning", 2);
        initial.items = [];
        const final = sourceCatalog(
            "complete",
            change === "generation" ? 3 : 2
        );
        if (change === "disconnect") {
            final.sources = [other];
            final.sourceScans = [final.sourceScans[1]];
        }
        f.snapshots.push(initial, final);
        let blocked = false;
        f.w.__ottStandby = { blocked: () => blocked };
        const pending = new Promise((resolve) =>
            execute(f.w, request("shuffle"), resolve)
        );
        await tick();
        if (change === "standby") blocked = true;
        const reply = await pending;
        assert.equal(reply.status, "rejected", change);
        assert.equal(
            reply.data.error,
            change === "disconnect" ? "source_unavailable" : "runtime_changed",
            change
        );
        assert.equal(
            f.calls.some(([name]) => name === "provider"),
            false
        );
        assert.equal(f.data.has("localMediaPlaybackSelection"), false);
    }
});

test("cancelled catalogue waits stop only their reader and keep the unrelated scan alive", async () => {
    const f = pluginFixture({ connected: true });
    await tick();
    f.snapshots.push(
        { ...sourceCatalog("scanning"), items: [] },
        sourceCatalog()
    );
    let replies = 0;
    const cancel = execute(f.w, request("shuffle"), () => replies++);
    await tick();
    cancel();
    await new Promise((resolve) => setTimeout(resolve, 280));
    assert.equal(f.reads, 1);
    assert.equal(replies, 0);
    assert.equal(
        f.calls.some(([name]) => name === "local_media_cancel_request"),
        false
    );
    assert.equal(
        f.calls.some(([name]) => name === "provider"),
        false
    );
    assert.equal(f.snapshots[0].sourceScans[1].state, "scanning");
    const retry = await new Promise((resolve) =>
        execute(f.w, request("shuffle"), resolve)
    );
    assert.equal(retry.status, "ok");
    assert.equal(f.reads, 2);
});

test("unrelated source generations do not invalidate the selected scan and legacy catalogues still wait globally", async () => {
    for (const legacy of [false, true]) {
        const f = pluginFixture({ connected: true });
        await tick();
        const initial = legacy
            ? { ...catalog(), scanning: true }
            : sourceCatalog("scanning", 7);
        const complete = legacy ? catalog() : sourceCatalog("complete", 7);
        if (!legacy) {
            initial.items = [];
            complete.sourceScans[1].generation = 999;
        }
        f.snapshots.push(initial, complete);
        let finished = false;
        const pending = new Promise((resolve) =>
            execute(f.w, request("shuffle"), resolve)
        ).then((value) => {
            finished = true;
            return value;
        });
        await tick();
        assert.equal(finished, false);
        assert.equal((await pending).status, "ok");
        assert.equal(f.reads, 2);
    }
});

test("expired native link is cancelled by request ID and cannot erase a newer catalogue", async () => {
    let finishLink;
    const f = pluginFixture({
        invoke(name) {
            if (name === "local_media_link_folder")
                return new Promise((resolve) => {
                    finishLink = resolve;
                });
            if (name === "local_media_cancel_request") return Promise.resolve();
        },
    });
    await tick();
    const deadline = Date.now() + 40;
    const reply = await new Promise((resolve) =>
        execute(
            f.w,
            request("shuffle", { source: "/Volumes/data/Movies" }),
            resolve,
            deadline / 1000
        )
    );
    assert.equal(reply.data.error, "catalog_loading");
    const link = f.calls.find(
        ([name]) => name === "local_media_link_folder"
    )[1];
    const cancel = f.calls.find(
        ([name]) => name === "local_media_cancel_request"
    )[1];
    assert.equal(link.deadlineMs, deadline);
    assert.equal(cancel.requestId, link.requestId);
    assert.match(link.requestId, /^local-link-[0-9]+-[0-9]+$/);
    f.snapshots.push(catalog());
    await f.api.list();
    const newer = clone(await f.api.snapshot());
    finishLink({ endpoint: "http://localhost/catalog", source });
    await tick();
    assert.deepEqual(clone(await f.api.snapshot()), newer);
    assert.equal(
        f.calls.some(([name]) => name === "provider"),
        false
    );
});

test("older native cancellation rejection is contained and repeated cancellation is idempotent", async () => {
    let finish;
    const f = pluginFixture({
        invoke(name) {
            if (name === "local_media_link_folder")
                return new Promise((resolve) => {
                    finish = resolve;
                });
            if (name === "local_media_cancel_request")
                return Promise.reject(new Error("Unknown native command"));
        },
    });
    await tick();
    const pending = f.api.remoteConnect("/Volumes/data/Movies");
    pending.cancel();
    pending.cancel();
    await tick();
    finish({ endpoint: "http://localhost/catalog", source });
    await pending;
    assert.equal(
        f.calls.filter(([name]) => name === "local_media_cancel_request")
            .length,
        1
    );
});

test("a late successful link cannot invalidate a newer catalogue or changed playback context", async () => {
    for (const change of ["catalogue", "context"]) {
        let finish;
        let current = true;
        const f = pluginFixture({
            invoke(name) {
                if (name === "local_media_link_folder")
                    return new Promise((resolve) => {
                        finish = resolve;
                    });
            },
        });
        await tick();
        f.snapshots.push(catalog());
        await f.api.list();
        const pending = f.api.remoteConnect(
            "/Volumes/data/Movies",
            () => current
        );
        if (change === "catalogue") await f.api.list();
        else current = false;
        const expected = clone(await f.api.snapshot());
        finish({ endpoint: "http://localhost/catalog", source });
        await pending;
        assert.deepEqual(clone(await f.api.snapshot()), expected, change);
    }
});

test("pending local activation is scoped to its provider generation", async () => {
    const f = pluginFixture();
    await tick();
    f.snapshots.push(catalog());
    f.api.remoteActivate(source.id, ["3", "2", "1"], catalog(), () => true);
    f.w.__ottCommandChannelLoad = {};
    assert.equal(f.api.takeImportSelection(), "");
    assert.equal(f.api.playbackOrder(), null);
    await f.api.list();
    assert.equal(f.api.playbackOrder(), null);
});

test("source filter survives reload, retains connected sources and fails closed if the folder vanishes", () => {
    const data = new Map();
    let identity = "tauri";
    const w = {
        stbGetItem: (k) => data.get(k),
        stbSetItem: (k, v) => data.set(k, v),
    };
    const a = selection.createLocalPlaybackSelection(w, () => identity);
    a.select(source.id, ["3", "1", "2"]);
    const fresh = selection.createLocalPlaybackSelection(w, () => identity);
    assert.equal(fresh.order(), null);
    assert.deepEqual(clone(fresh.filter(catalog()).sources), [source]);
    assert.equal(catalog().sources.length, 2);
    assert.throws(
        () => fresh.filter({ items: catalog().items, sources: [other] }),
        /unavailable/
    );
    identity = "browser:";
    assert.equal(fresh.filter(catalog()).items.length, 4);
    identity = "tauri";
    fresh.clear();
    assert.equal(fresh.filter(catalog()).items.length, 4);
});

test("local playback order replaces all provider groups atomically and survives reload without changing custom groups", () => {
    const host = { window: {} };
    vm.createContext(host);
    require("./helpers/private-runtime.cjs")(host, "src/channels/library.ts");
    const saved = new Map();
    let fail = false;
    const rows = [1, 2, 3].map((id) => ({
        groupId: "local",
        groupLabel: "Local videos",
        id: "local-" + id,
        itemId: "local:" + id,
        label: String(id),
    }));
    const ports = {
        current: () => true,
        get: (key) => saved.get(key),
        set: (key, value) => {
            if (fail) throw Error("full");
            saved.set(key, value);
        },
        sourceId: "local-test",
    };
    const create = () => host.window.__ottChannelLibrary.create(ports, rows);
    let api = create();
    const custom = api.createGroup("Custom", "local");
    const before = clone(api.snapshot().groups.find((x) => x.id === custom));
    api.renameGroup("local", "Family movies");
    api.changeMember("local", "local-2", "remove");
    rows.unshift(rows.pop());
    api = create();
    assert.equal(
        api.adoptPlaybackOrder(["local-3", "local-1", "local-2"]),
        true
    );
    const state = clone(create().snapshot());
    assert.deepEqual(state.all, ["local-3", "local-1", "local-2"]);
    assert.deepEqual(state.groups.find((x) => x.id === "local").members, [
        "local-3",
        "local-1",
        "local-2",
    ]);
    assert.equal(
        state.groups.find((x) => x.id === "local").label,
        "Family movies"
    );
    assert.deepEqual(
        state.groups.find((x) => x.id === custom),
        before
    );
    assert.deepEqual(state.selected, {
        groupId: "system:all",
        itemId: "local:3",
    });
    for (const invalid of [
        ["local-1"],
        ["local-1", "local-1", "local-2"],
        ["local-1", "local-2", "foreign"],
    ]) {
        assert.equal(api.adoptPlaybackOrder(invalid), false);
        assert.deepEqual(clone(api.snapshot()), state);
    }
    api.select("system:all", "local-1");
    const beforeFailure = clone(api.snapshot());
    fail = true;
    assert.equal(
        api.adoptPlaybackOrder(["local-3", "local-1", "local-2"]),
        false
    );
    assert.deepEqual(clone(api.snapshot()), beforeFailure);
});

test("native canonical lookup is metadata-only, with paths returned only on explicit opt-in", async () => {
    const f = fixture();
    let calls = [];
    f.w.__ottLocalMedia.remoteSources = async (includePaths, path) => {
        calls.push([includePaths, path]);
        return { sources: [{ ...source, path: "/private/var/media/Movies" }] };
    };
    const result = await f.request(contract.lookup_request.params);
    assert.deepEqual(result.data, contract.lookup_result);
    const hidden = await f.request({
        ...contract.lookup_request.params,
        include_paths: false,
    });
    assert.equal(Object.hasOwn(hidden.data.sources[0], "path"), false);
    assert.deepEqual(calls, [
        [true, "/var/media/Movies"],
        [false, "/var/media/Movies"],
    ]);
    assert.deepEqual(f.calls, []);
    assert.equal(
        (await f.request(request("sources", { path: "Movies" }))).data.error,
        "invalid_request"
    );
    f.w.__ottLocalMedia.remoteCapabilities = () => ({
        ...contract.capability,
        absolute_paths: false,
    });
    assert.equal(
        (await f.request(contract.lookup_request.params)).data.error,
        "unsupported"
    );
});

test("native API passes canonical lookup to sources without starting a catalog scan", async () => {
    const f = pluginFixture();
    await tick();
    await f.api.remoteSources(true, "/var/media/Movies");
    assert.deepEqual(clone(f.calls.at(-1)), [
        "local_media_sources",
        { includePaths: true, path: "/var/media/Movies" },
    ]);
    assert.equal(
        f.calls.some(
            (x) => x[0] === "offline_media_endpoint" || x[0] === "provider"
        ),
        false
    );
});

test("missing native folder reports source_unavailable without changing current playback", async () => {
    for (const op of ["sources", "play", "shuffle"]) {
        const f = pluginFixture({
            invoke(name) {
                if (name === "local_media_sources")
                    return Promise.reject("source_unavailable");
            },
        });
        await tick();
        const driver = f.w.__ottActiveProviderDriver;
        const channelLoad = f.w.__ottCommandChannelLoad;
        const saved = [...f.data];
        const args =
            op === "sources"
                ? { path: "/media/disconnected/Movies" }
                : { source: "/media/disconnected/Movies" };
        const result = await new Promise((resolve) =>
            execute(f.w, request(op, args), resolve)
        );
        assert.equal(result.status, "rejected");
        assert.equal(result.data.error, "source_unavailable");
        assert.equal(f.w.__ottActiveProviderDriver, driver);
        assert.equal(f.w.__ottCommandChannelLoad, channelLoad);
        assert.deepEqual([...f.data], saved);
        assert.equal(f.w.__ottLocalMediaRequestActive, false);
        assert.equal(f.reads, 0);
        assert.equal(
            f.calls.filter(([name]) => name === "local_media_sources").length,
            1
        );
        assert.equal(
            f.calls.some(([name]) =>
                [
                    "local_media_link_folder",
                    "offline_media_endpoint",
                    "provider",
                ].includes(name)
            ),
            false
        );
    }
});

test("native source deadline remains busy without connecting, scanning or activating", async () => {
    for (const op of ["play", "shuffle", "connect"]) {
        for (const selector of ["/media/Movies", "Movies", source.id]) {
            const f = pluginFixture({
                invoke(name) {
                    if (name === "local_media_sources")
                        return Promise.reject("operation_in_progress");
                },
            });
            await tick();
            const driver = f.w.__ottActiveProviderDriver;
            const channelLoad = f.w.__ottCommandChannelLoad;
            const saved = [...f.data];
            const initialCalls = f.calls.length;
            const result = await new Promise((resolve) =>
                execute(f.w, request(op, { source: selector }), resolve)
            );
            assert.deepEqual(clone(result), {
                data: {
                    error: "operation_in_progress",
                    op,
                    runtime: "page-123",
                    state: "error",
                    version: 1,
                },
                status: "rejected",
            });
            assert.equal(f.w.__ottActiveProviderDriver, driver);
            assert.equal(f.w.__ottCommandChannelLoad, channelLoad);
            assert.deepEqual([...f.data], saved);
            assert.equal(f.w.ottpStorage.localPlayback.active(), false);
            assert.equal(f.w.__ottLocalMediaRequestActive, false);
            assert.equal(f.reads, 0);
            assert.deepEqual(
                f.calls.slice(initialCalls).map(([name]) => name),
                ["local_media_sources"]
            );
            const lookup = f.calls.at(-1)[1];
            assert.equal(
                selector.startsWith("/") ? lookup.path : lookup.selection,
                selector
            );
        }
    }
});

test("native source errors without the exact fixed code remain generic and private", async () => {
    for (const error of [
        "Local sources unavailable; select an accessible absolute directory",
        "source_unavailable: private diagnostic context",
        new Error("source_unavailable"),
        "operation_in_progress: private diagnostic context",
        " operation_in_progress",
        "operation_in_progress ",
        "Operation_in_progress",
        new Error("operation_in_progress"),
    ]) {
        const f = pluginFixture({
            invoke(name) {
                if (name === "local_media_sources")
                    return Promise.reject(error);
            },
        });
        await tick();
        const result = await new Promise((resolve) =>
            execute(f.w, request("play", { source: "/media/Movies" }), resolve)
        );
        assert.equal(result.data.error, "native_error");
        assert.equal(
            JSON.stringify(result).includes("private diagnostic"),
            false
        );
        assert.equal(f.reads, 0);
        assert.equal(
            f.calls.some(([name]) => name === "provider"),
            false
        );
    }
});

test("local selection is scoped to the active saved profile binding", async () => {
    const f = pluginFixture();
    await tick();
    let slot = 0,
        binding = "a";
    f.w.__ottOfflineProfiles = {
        current: () => ({ binding_id: binding }),
        namespace: () => "offline:" + slot,
    };
    f.api.remoteActivate(source.id, ["1", "2", "3"], catalog(), () => true);
    assert.equal(f.api.playbackFilter(catalog()).items.length, 3);
    slot = 1;
    assert.throws(() => f.api.playbackFilter(catalog()), /session changed/);
    slot = 0;
    binding = "replacement";
    assert.throws(() => f.api.playbackFilter(catalog()), /session changed/);
});

test("asynchronous driver mount binds the intended local order across the catalogue generation change", async () => {
    const f = pluginFixture();
    await tick();
    let active = true;
    f.api.remoteActivate(source.id, ["3", "1", "2"], catalog(), () => true);
    // Production mounts the driver under loadProv's generation, then
    // loadChannels starts its own generation before calling driver.load.
    f.api.bindPlaybackOwner(() => active);
    f.w.__ottCommandChannelLoad = {};
    assert.equal(f.api.takeImportSelection(), "local-3");
    await f.api.list();
    assert.deepEqual(clone(f.api.playbackOrder()), [
        "local-3",
        "local-1",
        "local-2",
    ]);
    f.w.__ottCommandChannelLoad = {};
    assert.equal(f.api.playbackOrder(), null);
    active = false;
});

test("replaced driver ownership never lends a pending local handoff to a newer driver", async () => {
    const f = pluginFixture();
    await tick();
    let active = true;
    f.api.remoteActivate(source.id, ["3", "1", "2"], catalog(), () => true);
    f.api.bindPlaybackOwner(() => active);
    active = false;
    f.w.__ottCommandChannelLoad = {};
    f.api.bindPlaybackOwner(() => true);
    assert.equal(f.api.takeImportSelection(), "");
    assert.equal(f.api.playbackOrder(), null);
});

test("expired native scans stop polling before their next request and never activate", async () => {
    const f = pluginFixture();
    await tick();
    f.snapshots.push(
        { ...catalog(), items: [catalog().items[0]], scanning: true },
        catalog()
    );
    const result = await new Promise((resolve) =>
        execute(
            f.w,
            request("shuffle", { source: "/Volumes/data/Movies" }),
            resolve,
            (Date.now() + 30) / 1000
        )
    );
    assert.equal(result.data.error, "catalog_loading");
    await new Promise((resolve) => setTimeout(resolve, 280));
    assert.equal(
        f.snapshots.length,
        1,
        "completed snapshot must not be requested after expiration"
    );
    assert.equal(
        f.calls.some((x) => x[0] === "provider"),
        false
    );
});

test("13,611-file shuffle is complete and reproducible within its session with only a compact seed", async () => {
    const f = pluginFixture();
    await tick();
    const value = catalog();
    value.items = Array.from({ length: 13611 }, (_, index) => ({
        id: index.toString(16).padStart(32, "0"),
        name: "Movie " + index + ".mp4",
        sourceId: source.id,
        url: "/v/" + index,
    })).concat(value.items.filter((item) => item.sourceId === "other"));
    f.snapshots.push(value);
    const reply = await new Promise((resolve) =>
        execute(f.w, request("shuffle"), resolve)
    );
    assert.equal(reply.status, "ok");
    assert.equal(reply.data.count, 13611);
    const first = f.api.playbackFilter(await f.api.list());
    const order = first.items.map((item) => item.id);
    assert.equal(new Set(order).size, 13611);
    assert.equal(
        first.items.every((item) => item.sourceId === source.id),
        true
    );
    assert.equal(f.data.has("localMediaPlaybackSelection"), false);
    const persisted = JSON.parse(f.w.stbGetItem("localMediaPlaybackSelection"));
    assert.ok(persisted.seed > 0);
    assert.ok(f.w.stbGetItem("localMediaPlaybackSelection").length < 256);
    const reloaded = selection.createLocalPlaybackSelection(
        f.w,
        () => persisted.library
    );
    const again = reloaded.filter({
        ...value,
        items: value.items.slice().reverse(),
    });
    assert.deepEqual(clone(again.items.map((item) => item.id)), clone(order));
    assert.deepEqual(
        clone(reloaded.filter({ ...value, scanning: true }).items),
        []
    );
    const host = { window: {} };
    vm.createContext(host);
    require("./helpers/private-runtime.cjs")(host, "src/channels/library.ts");
    const documents = new Map();
    const rows = first.items.map((item) => ({
        groupId: "local",
        groupLabel: "Local videos",
        id: "local-" + item.id,
        itemId: "channel:local-" + item.id,
        label: item.name,
    }));
    const library = host.window.__ottChannelLibrary.create(
        {
            current: () => true,
            get: (key) => documents.get(key),
            set: (key, text) => documents.set(key, text),
            sourceId: "large-local",
        },
        rows
    );
    assert.equal(library.adoptPlaybackOrder(f.api.playbackOrder()), true);
    assert.deepEqual(
        clone(library.snapshot().all),
        clone(rows.map((row) => row.id))
    );
    assert.ok(
        [...documents.values()].reduce((n, text) => n + text.length, 0) < 1024,
        "provider order must not duplicate 13,611 IDs in persistent storage"
    );
});

test("invalid wire source identities are rejected before any playback mutation", async () => {
    for (const bad of [
        { ...source, id: "invalid/id" },
        { ...source, name: "x".repeat(513) },
        { ...source, name: "https://secret" },
        { ...source, name: "folder/subfolder" },
    ]) {
        const f = fixture();
        f.value.sources = [bad];
        assert.equal(
            (
                await f.request(
                    request("play", {
                        source: bad.id === source.id ? source.id : "Movies",
                    })
                )
            ).data.error,
            "catalog_unavailable"
        );
        assert.deepEqual(f.calls, []);
    }
});

test("an accepted local command cannot replay its pending start after actual standby and wake", async () => {
    const f = pluginFixture();
    await tick();
    Object.assign(f.w, { clearInterval, clearTimeout, setTimeout });
    f.snapshots.push(catalog());
    const gate = load("src/core/standby.ts").installStandby(
        f.w,
        f.w.stbGetItem,
        f.w.stbSetItem
    );
    const reply = await new Promise((resolve) =>
        execute(f.w, request("shuffle"), resolve)
    );
    assert.equal(reply.status, "ok");
    assert.ok(f.api.playbackOrder());
    gate.set(true);
    assert.equal(f.api.playbackOrder(), null);
    assert.equal(f.api.takeImportSelection(), "");
    gate.set(false, () => f.w.loadProv("offline"));
    await tick();
    f.api.bindPlaybackOwner(() => true);
    assert.equal(f.api.playbackOrder(), null);
    assert.equal(f.api.takeImportSelection(), "");
});

test("a profile replacement after acceptance retires the old source/order before async driver mount", async () => {
    const f = pluginFixture();
    await tick();
    f.snapshots.push(catalog());
    let profile = { binding_id: "before" };
    f.w.__ottOfflineProfiles = {
        current: () => profile,
        filter: (value) => value,
        namespace: () => "offline:0",
    };
    const reply = await new Promise((resolve) =>
        execute(f.w, request("shuffle"), resolve)
    );
    assert.equal(reply.status, "ok");
    profile = { binding_id: "after" };
    f.api.bindPlaybackOwner(() => true);
    assert.equal(f.api.takeImportSelection(), "");
    assert.equal(f.api.playbackOrder(), null);
    profile = { binding_id: "before" };
    assert.equal(
        f.api.playbackOrder(),
        null,
        "retired intent cannot revive when the profile returns"
    );
});

test("seeded playback and its pending order use the same playable subset", async () => {
    const f = pluginFixture();
    await tick();
    const value = catalog();
    value.items.push(
        {
            available: false,
            id: "blocked",
            sourceId: source.id,
            url: "/blocked",
        },
        { id: "missing-url", sourceId: source.id }
    );
    f.snapshots.push(value);
    const reply = await new Promise((resolve) =>
        execute(f.w, request("shuffle"), resolve)
    );
    assert.equal(reply.status, "ok");
    assert.equal(reply.data.count, 3);
    assert.deepEqual(
        clone(
            f.api
                .playbackFilter(await f.api.list())
                .items.map((item) => "local-" + item.id)
        ),
        clone(f.api.playbackOrder())
    );
    const broken = fixture();
    broken.value.scanError = "scan traversal limit reached";
    assert.equal(
        (await broken.request(request("shuffle"))).data.error,
        "catalog_unavailable"
    );
    assert.deepEqual(broken.calls, []);
});

test("transport cancellation retires pending scan work and suppresses late replies and playback", async () => {
    const f = fixture();
    let resolve,
        cancelled = 0,
        replies = 0;
    f.w.__ottLocalMedia.remoteCatalog = () =>
        Object.assign(new Promise((done) => (resolve = done)), {
            cancel() {
                cancelled++;
            },
        });
    const cancel = execute(f.w, request("shuffle"), () => replies++);
    await tick();
    assert.equal(typeof cancel, "function");
    cancel();
    cancel();
    assert.equal(cancelled, 1);
    assert.equal(f.w.__ottLocalMediaRequestActive, false);
    resolve(f.value);
    await tick();
    assert.equal(replies, 0);
    assert.deepEqual(f.calls, []);
});

test("real request dispatcher preserves local cancellation and structured kiosk policy", async () => {
    const f = fixture();
    const modules = {};
    for (const match of fs
        .readFileSync("src/commands/remote-requests.ts", "utf8")
        .matchAll(/from "([^"]+)"/g))
        modules[match[1]] = {};
    modules["./remote-local-media"] = { executeRemoteLocalMedia: execute };
    modules["./player-state"] = require("./helpers/player-presence.cjs").load(
        "src/commands/player-state.ts"
    );
    const dispatch = load("src/commands/remote-requests.ts", modules, {
        window: f.w,
    }).executeRemoteRequest;
    let resolve,
        replies = 0;
    f.w.__ottLocalMedia.remoteCatalog = () =>
        new Promise((done) => (resolve = done));
    const cancel = dispatch(
        { action: "local_media", params: request("shuffle") },
        () => replies++
    );
    await tick();
    cancel();
    resolve(f.value);
    await tick();
    assert.equal(replies, 0);
    f.w.__ottKiosk = { enabled: () => true };
    let result;
    dispatch(
        { action: "local_media", params: request("shuffle") },
        (value) => (result = clone(value))
    );
    assert.deepEqual(result, {
        data: {
            error: "restricted",
            op: "shuffle",
            runtime: "page-123",
            state: "error",
            version: 1,
        },
        status: "rejected",
    });
    result = await new Promise((done) =>
        dispatch({ action: "local_media", params: request("sources") }, done)
    );
    assert.equal(result.status, "ok");
});

test("existing absolute folders are reused without relinking or starting a replacement scan", async () => {
    for (const op of ["play", "shuffle", "connect"]) {
        const f = pluginFixture({ connected: true });
        await tick();
        f.snapshots.push(catalog());
        const reply = await new Promise((resolve) =>
            execute(
                f.w,
                request(op, { source: "/Volumes/data/Movies/" }),
                resolve
            )
        );
        assert.equal(reply.status, "ok");
        assert.equal(reply.data.source.id, source.id);
        assert.equal(
            f.calls.some((call) => call[0] === "local_media_link_folder"),
            false
        );
        const lookup = f.calls.find(
            (call) => call[0] === "local_media_sources"
        );
        assert.deepEqual(clone(lookup[1]), {
            includePaths: false,
            path: "/Volumes/data/Movies/",
        });
        assert.equal(
            f.calls.some(
                (call) =>
                    call[0] === "offline_media_endpoint" && call[1].refresh
            ),
            false
        );
        if (op === "connect")
            assert.equal(
                f.calls.some((call) => call[0] === "offline_media_endpoint"),
                false
            );
    }
});

test("unavailable or ambiguous canonical folders never fall back to reconnecting another source", async () => {
    for (const [sources, code] of [
        [[{ ...source, available: false }], "source_unavailable"],
        [[{ ...source, kind: "file" }], "source_unavailable"],
        [[source, other], "source_ambiguous"],
    ]) {
        const f = fixture();
        f.w.__ottLocalMedia.remoteSources = async () => ({ sources });
        const reply = await f.request(
            request("shuffle", { source: "/Volumes/data/Movies" })
        );
        assert.equal(reply.data.error, code);
        assert.deepEqual(f.calls, []);
    }
});

test("retry after a timed-out new-folder scan reuses its binding and reads the completed catalog", async () => {
    const f = pluginFixture();
    await tick();
    f.w.__ottActiveProviderDriver = { id: "offline" };
    f.snapshots.push(
        { ...catalog(), items: [catalog().items[0]], scanning: true },
        catalog()
    );
    const params = request("shuffle", { source: "/Volumes/data/Movies" });
    const first = await new Promise((resolve) =>
        execute(f.w, params, resolve, (Date.now() + 30) / 1000)
    );
    assert.equal(first.data.error, "catalog_loading");
    assert.equal(
        f.calls.some((call) => call[0] === "provider"),
        false
    );
    await new Promise((resolve) => setTimeout(resolve, 280));
    const second = await new Promise((resolve) =>
        execute(f.w, params, resolve)
    );
    assert.equal(second.status, "ok");
    assert.equal(second.data.count, 3);
    assert.equal(
        f.calls.filter((call) => call[0] === "local_media_link_folder").length,
        1
    );
    assert.equal(
        f.calls.filter((call) => call[0] === "offline_media_endpoint").length,
        2
    );
    assert.equal(f.calls.filter((call) => call[0] === "provider").length, 1);
});

test("Local source names retain legal POSIX colons in full listings and exact selections", async () => {
    const f = fixture();
    f.value.sources = [
        { ...source, name: "Anime:2024" },
        { ...other, name: "Kids: Cartoons" },
    ];
    const listed = await f.request(request("sources"));
    assert.equal(listed.status, "ok");
    assert.deepEqual(listed.data.sources, f.value.sources);
    for (const source of f.value.sources) {
        const played = await f.request(
            request("shuffle", { source: source.name })
        );
        assert.equal(played.status, "ok");
        assert.equal(played.data.source.name, source.name);
        assert.equal(played.data.source.id, source.id);
    }
    f.value.sources.push({ ...other, id: "bad/id" });
    assert.equal(
        (await f.request(request("sources"))).data.error,
        "catalog_unavailable"
    );
});

test("successful disconnect clears only the matching source selection on native, Tauri and browser", async () => {
    const pluginSource = fs.readFileSync("src/plugins/local-media.ts", "utf8");
    const start = pluginSource.indexOf("    function removeSource(id:");
    const end = pluginSource.indexOf("    function reconnectSource(", start);
    assert.ok(start > 0 && end > start);
    const code = ts.transpileModule(
        "export " + pluginSource.slice(start, end).trim(),
        {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES5,
            },
        }
    ).outputText;
    for (const mode of ["native", "tauri", "browser"])
        for (const outcome of ["selected", "unrelated", "failed"]) {
            const stored = new Map();
            let retired = 0,
                identity = "library:profile-a";
            const w = {
                stbGetItem: (key) => stored.get(key),
                stbSetItem: (key, value) => stored.set(key, value),
            };
            const selected = selection.createLocalPlaybackSelection(
                w,
                () => identity
            );
            selected.select(source.id, ["1", "2", "3"], 42);
            identity = "library:profile-b";
            const before = stored.get("localMediaPlaybackSelection");
            const backend = async () => {
                if (outcome === "failed") throw Error("disconnect failed");
                return { items: [], sources: [other] };
            };
            const context = {
                browser: { removeSource: backend },
                exports: {},
                isNative: () => mode === "native",
                isTauri: () => mode === "tauri",
                list: async () => ({ items: [], sources: [other] }),
                locked: () => false,
                native: { removeSource: backend },
                nativeLibrary: () => mode === "native",
                playbackSelection: selected,
                remember: (value) => value,
                remoteEndpoint: () => "",
                retireRemotePlayback: () => retired++,
                settingsLocked: () => false,
                tauriInvoke: backend,
            };
            vm.runInNewContext(code, context);
            const operation = context.exports.removeSource(
                outcome === "unrelated" ? other.id : source.id
            );
            if (outcome === "failed")
                await assert.rejects(operation, /disconnect failed/);
            else await operation;
            assert.equal(
                stored.get("localMediaPlaybackSelection"),
                outcome === "selected" ? "" : before,
                mode + ":" + outcome
            );
            assert.equal(
                retired,
                outcome === "selected" ? 1 : 0,
                mode + ":" + outcome
            );
        }
});

test("deferred Local runner keeps cold/warm wire shape and singleflight during download", async () => {
    const f = fixture(),
        pending = [];
    let loads = 0;
    const run = deferredExecute((w, name, done) => {
        assert.equal(name, "remote-local-runner");
        loads++;
        pending.push(done);
    });
    const reply = new Promise((resolve) => run(f.w, request("play"), resolve));
    assert.equal(f.w.__ottLocalMediaRequestActive, true);
    const second = await new Promise((resolve) =>
        run(f.w, request("shuffle"), resolve)
    );
    assert.equal(second.data.error, "operation_in_progress");
    assert.equal(loads, 1);
    f.w.__ottRemoteLocalMediaRun = runnerWindow.__ottRemoteLocalMediaRun;
    pending.shift()();
    assert.deepEqual(clone((await reply).data), contract.play_result);
    const warm = await new Promise((resolve) =>
        run(f.w, request("play"), resolve)
    );
    assert.equal(warm.status, "ok");
    assert.equal(loads, 1);
    assert.equal(f.w.__ottLocalMediaRequestActive, false);
});

test("deferred Local runner never enters after cancel or deadline and releases its owner", async () => {
    for (const timeout of [false, true]) {
        const f = fixture();
        let ready,
            deadline,
            entries = 0,
            replies = 0;
        const run = deferredExecute(
            (w, name, done) => {
                ready = done;
            },
            {
                clearTimeout() {},
                setTimeout(fn) {
                    deadline = fn;
                    return 1;
                },
            }
        );
        const cancel = run(f.w, request("play"), () => replies++);
        if (timeout) deadline();
        else cancel();
        f.w.__ottRemoteLocalMediaRun = () => {
            entries++;
        };
        ready();
        await tick();
        assert.equal(entries, 0);
        assert.equal(replies, timeout ? 1 : 0);
        assert.equal(f.w.__ottLocalMediaRequestActive, false);
    }
});

test("deferred Local runner rejects runtime, driver, load, profile and standby changes before entry", async () => {
    for (const kind of ["runtime", "driver", "load", "profile", "standby"]) {
        const f = fixture();
        let ready,
            profile = 1,
            entries = 0;
        f.w.__ottOfflineProfiles = {
            catalogGuard() {
                const value = profile;
                return () => profile === value;
            },
        };
        const run = deferredExecute((w, name, done) => {
            ready = done;
        });
        const reply = new Promise((resolve) =>
            run(f.w, request("play"), resolve)
        );
        if (kind === "runtime") f.w.runtime = "page-new";
        if (kind === "driver") f.w.__ottActiveProviderDriver = {};
        if (kind === "load") f.w.__ottCommandChannelLoad = {};
        if (kind === "profile") profile++;
        if (kind === "standby") f.w.__ottStandby = { blocked: () => true };
        f.w.__ottRemoteLocalMediaRun = () => {
            entries++;
        };
        ready();
        assert.equal((await reply).data.error, "runtime_changed", kind);
        assert.equal(entries, 0);
        assert.equal(f.w.__ottLocalMediaRequestActive, false);
    }
});

test("deferred Local runner load failure and missing factory settle once and permit retry", async () => {
    for (const error of [undefined, "unsupported"]) {
        const f = fixture();
        let ready;
        const run = deferredExecute((w, name, done) => {
            ready = done;
        });
        const reply = new Promise((resolve) =>
            run(f.w, request("play"), resolve)
        );
        ready(error);
        const result = await reply;
        assert.equal(result.status, "unsupported");
        assert.equal(f.w.__ottLocalMediaRequestActive, false);
        f.w.__ottRemoteLocalMediaRun = runnerWindow.__ottRemoteLocalMediaRun;
        assert.equal(
            (await new Promise((resolve) => run(f.w, request("play"), resolve)))
                .status,
            "ok"
        );
    }
});

test("deferred Local runner contains synchronous runner/profile errors without leaked flag", async () => {
    for (const profileFailure of [false, true]) {
        const f = fixture();
        let ready,
            throwProfile = false,
            replies = 0;
        f.w.__ottOfflineProfiles = {
            catalogGuard: () => () => {
                if (throwProfile) throw Error("profile");
                return true;
            },
        };
        const run = deferredExecute((w, name, done) => {
            ready = done;
        });
        const reply = new Promise((resolve) =>
            run(f.w, request("play"), (value) => {
                replies++;
                resolve(value);
            })
        );
        if (profileFailure) throwProfile = true;
        f.w.__ottRemoteLocalMediaRun = () => {
            throw Error("runner");
        };
        ready();
        ready();
        assert.equal((await reply).data.error, "native_error");
        assert.equal(replies, 1);
        assert.equal(f.w.__ottLocalMediaRequestActive, false);
    }
});

test("invalid Local schema remains synchronous and never downloads the runner", () => {
    const f = fixture();
    let replies = 0;
    const run = deferredExecute(() =>
        assert.fail("invalid request loaded runner")
    );
    run(f.w, request("play", { progressive: false }), (value) => {
        replies++;
        assert.equal(value.data.error, "invalid_request");
    });
    assert.equal(replies, 1);
    assert.equal(f.w.__ottLocalMediaRequestActive, undefined);
});

test("progressive capability follows the implemented backend and settled native probe", async () => {
    for (const marker of ["__TAURI__", "__TAURI_INTERNALS__"]) {
        const f = pluginFixture({
            host: { __TAURI__: undefined, [marker]: {} },
        });
        assert.equal(
            f.api.remoteProgressive(),
            false,
            "no promise before native capability resolution"
        );
        await tick();
        const before = f.calls.length;
        assert.equal(f.api.remoteProgressive(), true);
        assert.equal(f.api.remoteCapabilities().version, 1);
        assert.equal(
            f.calls.length,
            before,
            "capability read starts no native work"
        );
        assert.equal(f.reads, 0);
    }
    for (const capability of [
        {},
        { absolutePaths: true, version: 1 },
        { sourcePaths: true, version: 1 },
        { absolutePaths: false, sourcePaths: true, version: 1 },
        { absolutePaths: true, sourcePaths: true, version: 2 },
        { absolutePaths: "true", sourcePaths: true, version: 1 },
        null,
        "reject",
    ]) {
        const f = pluginFixture({
            invoke(name) {
                if (name === "local_media_capabilities")
                    return capability === "reject"
                        ? Promise.reject(Error("unavailable"))
                        : capability;
            },
        });
        await tick();
        assert.equal(f.api.remoteProgressive(), false);
        assert.equal(
            f.api.remoteCapabilities().version,
            1,
            "ordinary Local remains available"
        );
        assert.equal(f.reads, 0);
    }
    for (const platform of [
        "browser",
        "server",
        "capacitor",
        "capacitor-server",
    ]) {
        const server = platform.includes("server");
        const f = pluginFixture({
            data: new Map(
                server
                    ? [["localMediaEndpoint", "http://local.example/catalog"]]
                    : []
            ),
            host: {
                __TAURI__: undefined,
                indexedDB: {},
                ...(platform.startsWith("capacitor")
                    ? { Capacitor: { isNativePlatform: () => true } }
                    : {}),
            },
        });
        await tick();
        assert.equal(f.api.remoteCapabilities().version, 1, platform);
        assert.equal(f.api.remoteProgressive(), true, platform);
        assert.equal(
            f.calls.length,
            0,
            "non-Tauri capability inspection invokes no native probe"
        );
        assert.equal(f.reads, 0);
    }
});

test("browser remote startup adopts one live scan before its remainder resolves", async () => {
    let progress,
        finish,
        lists = 0,
        suspended = 0;
    const browser = {
        list: (callback, preferred, priorities) => {
            lists++;
            assert.deepEqual(Array.from(priorities), [source.id]);
            progress = callback;
            return new Promise((resolve) => {
                finish = resolve;
            });
        },
        sources: async () => ({
            sources: [{ ...source, available: undefined }],
        }),
        suspend() {
            suspended++;
        },
    };
    const f = pluginFixture({
        browser,
        host: { indexedDB: {} },
        mode: "browser",
    });
    const pending = new Promise((resolve) =>
        execute(f.w, request("shuffle", { progressive: true }), resolve)
    );
    await tick();
    assert.equal(lists, 1);
    const prefix = {
        ...catalog(),
        items: [catalog().items[0]],
        scanning: true,
    };
    progress(prefix);
    const reply = await pending;
    assert.equal(reply.status, "ok");
    assert.equal(reply.data.count, 1);
    assert.equal(reply.data.scanning, true);
    f.api.bindPlaybackOwner(() => true);
    const seen = [];
    const scan = f.api.playbackList((value) => {
        seen.push(clone(f.api.playbackFilter(value)));
        return true;
    });
    assert.equal(lists, 1, "provider adopts the same pending iterator");
    assert.deepEqual(
        seen.map((value) => value.items.length),
        [1]
    );
    const expanded = { ...catalog(), scanning: true };
    progress(expanded);
    assert.deepEqual(
        seen.map((value) => value.items.length),
        [1, 3]
    );
    assert.equal(
        seen[1].items[0].id,
        seen[0].items[0].id,
        "shuffle prefix is stable"
    );
    finish(catalog());
    assert.equal((await scan).scanning, false);
    assert.equal(suspended, 0);
    assert.equal(f.calls.filter(([name]) => name === "provider").length, 1);
});

test("native progressive import selects the chosen source and adopts its request", async () => {
    let event,
        finish,
        args,
        lists = 0;
    const native = {
        addListener: async (_, callback) => {
            event = callback;
            return { remove() {} };
        },
        importFolder: async (options) => {
            assert.equal(options.progressive, true);
            return { items: [], scanning: true, sourceIds: [source.id] };
        },
        list: (options) => {
            lists++;
            args = options;
            return new Promise((resolve) => {
                finish = resolve;
            });
        },
    };
    const f = pluginFixture({ mode: "native", native });
    let resolved = false;
    const imported = f.api.importFiles(true).then((value) => {
        resolved = true;
        return value;
    });
    await tick();
    assert.deepEqual(Array.from(args.sourceIds), [source.id]);
    event({
        catalog: { ...catalog(), items: [catalog().items[3]], scanning: true },
        requestId: args.requestId,
    });
    await tick();
    assert.equal(resolved, false, "unrelated source cannot end import wait");
    const prefix = {
        ...catalog(),
        items: [catalog().items[0]],
        scanning: true,
    };
    event({ catalog: prefix, requestId: args.requestId });
    await imported;
    f.api.activate();
    f.api.bindPlaybackOwner(() => true);
    const seen = [];
    const scan = f.api.playbackList((value) => {
        seen.push(value.items.length);
        return true;
    });
    assert.equal(lists, 1);
    assert.deepEqual(seen, [1]);
    assert.equal(f.api.takeImportSelection(), "local-1");
    finish(catalog());
    await scan;
});

test("pending queue completion wakes only for its own append and scan generation", () => {
    const f = pluginFixture();
    const value = (items, state = "scanning", generation = 1) => ({
        ...sourceCatalog(state, generation),
        items,
    });
    const first = catalog().items[0];
    let resumed = 0;
    f.api.queueProgress(value([first]));
    assert.equal(
        f.api.deferQueueEnd(source.id, () => resumed++),
        true
    );
    f.api.queueProgress(value([first, catalog().items[3]]));
    assert.equal(resumed, 0, "another source cannot wake this queue");
    f.api.queueProgress(value([first, catalog().items[1]]));
    assert.equal(resumed, 1);
    f.api.queueProgress(value([first, catalog().items[1]]));
    assert.equal(resumed, 1, "one waiter resumes once");
    f.api.deferQueueEnd(source.id, () => resumed++);
    f.api.queueProgress(value([first], "scanning", 2));
    f.api.queueProgress(value([first, catalog().items[1]], "complete", 2));
    assert.equal(resumed, 1, "replacement scan retires old EOF");
    f.api.queueProgress(value([first]));
    f.api.deferQueueEnd(source.id, () => resumed++);
    f.api.queueProgress(value([first], "complete"));
    assert.equal(resumed, 2, "completion settles a queue without more files");
    assert.equal(
        f.api.deferQueueEnd(source.id, () => resumed++),
        false
    );
    f.api.queueProgress(value([first]));
    f.api.deferQueueEnd(source.id, () => resumed++);
    f.api.queueProgress(null);
    f.api.queueProgress(value([first, catalog().items[1]]));
    assert.equal(resumed, 2, "failed scan never revives pending EOF");
});

test("a fast next batch cannot break native/browser scan adoption", async () => {
    let finish,
        lists = 0;
    const f = pluginFixture({
        browser: {
            list: (callback) => {
                lists++;
                callback({
                    ...catalog(),
                    items: [catalog().items[0]],
                    scanning: true,
                });
                callback({ ...catalog(), scanning: true });
                return new Promise((resolve) => {
                    finish = resolve;
                });
            },
            sources: async () => ({ sources: [source] }),
            suspend() {},
        },
        host: { indexedDB: {} },
        mode: "browser",
    });
    const reply = await new Promise((resolve) =>
        execute(f.w, request("play", { progressive: true }), resolve)
    );
    assert.equal(reply.status, "ok");
    f.api.bindPlaybackOwner(() => true);
    const batches = [];
    const pending = f.api.playbackList((value) => {
        batches.push(
            Array.from(f.api.playbackFilter(value).items, (item) => item.id)
        );
        return true;
    });
    assert.equal(lists, 1);
    assert.deepEqual(batches[0], ["1"]);
    assert.equal(
        batches[1][0],
        "1",
        "accepted prefix survives a faster background batch"
    );
    finish(catalog());
    await pending;
});

test("cancelling a pending browser first-file request rejects late work", async () => {
    let progress,
        finish,
        suspended = 0;
    const f = pluginFixture({
        browser: {
            list: (callback) => {
                progress = callback;
                return new Promise((resolve) => {
                    finish = resolve;
                });
            },
            sources: async () => ({ sources: [source] }),
            suspend() {
                suspended++;
            },
        },
        host: { indexedDB: {} },
        mode: "browser",
    });
    let replies = 0;
    const cancel = execute(
        f.w,
        request("play", { progressive: true }),
        () => replies++
    );
    await tick();
    cancel();
    assert.equal(progress({ ...catalog(), scanning: true }), false);
    finish(catalog());
    await tick();
    assert.equal(replies, 0);
    assert.equal(suspended, 1);
    assert.equal(f.calls.filter(([name]) => name === "provider").length, 0);
});

test("public browser source listing retains real availability checks", async () => {
    let inventories = 0,
        scans = 0;
    const f = pluginFixture({
        browser: {
            list: async () => {
                scans++;
                return {
                    items: [],
                    scanning: false,
                    sources: [{ ...source, available: false }],
                };
            },
            sources: async () => {
                inventories++;
                return { sources: [source] };
            },
            suspend() {},
        },
        host: { indexedDB: {} },
        mode: "browser",
    });
    const reply = await new Promise((resolve) =>
        execute(f.w, request("sources"), resolve)
    );
    assert.equal(reply.status, "ok");
    assert.equal(reply.data.sources[0].available, false);
    assert.equal(inventories, 0);
    assert.equal(scans, 1);
});

test("server helper selects from token-scoped inventory and hands off the first source generation", async () => {
    const base = "http://127.0.0.1:1234/offline-media/test-token";
    const requests = [];
    const snapshots = [
        { ...sourceCatalog("scanning", 17), items: [catalog().items[0]] },
        sourceCatalog("complete", 17),
    ];
    const f = pluginFixture({
        data: new Map([["localMediaEndpoint", base]]),
        host: {
            fetch: async (url) => {
                requests.push(url);
                return {
                    json: async () =>
                        url === base + "/sources"
                            ? {
                                  sources: [
                                      {
                                          id: source.id,
                                          kind: "folder",
                                          name: source.name,
                                      },
                                  ],
                              }
                            : snapshots.shift(),
                    ok: true,
                };
            },
        },
        mode: "browser",
    });
    const reply = await new Promise((resolve) =>
        execute(f.w, request("shuffle", { progressive: true }), resolve)
    );
    assert.equal(reply.status, "ok");
    assert.equal(reply.data.count, 1);
    assert.equal(reply.data.scanning, true);
    assert.deepEqual(requests, [
        base + "/sources",
        base + "?sourceId=" + source.id,
    ]);
    f.api.bindPlaybackOwner(() => true);
    const seen = [];
    const complete = await f.api.playbackList((value) => {
        seen.push(value.items.length);
        return true;
    });
    assert.deepEqual(seen, [1, 4]);
    assert.equal(f.api.playbackFilter(complete).scanning, false);
    assert.ok(requests.every((url) => url.startsWith(base)));
});

test("helper authentication failures do not fall back to catalog reads", async () => {
    for (const status of [401, 403, 500]) {
        const requests = [];
        const f = pluginFixture({
            data: new Map([
                ["localMediaEndpoint", "http://helper/offline-media/token"],
            ]),
            host: {
                fetch: async (url) => {
                    requests.push(url);
                    return { ok: false, status };
                },
            },
            mode: "browser",
        });
        const reply = await new Promise((resolve) =>
            execute(f.w, request("play", { progressive: true }), resolve)
        );
        assert.notEqual(reply.status, "ok");
        assert.equal(requests.length, 1);
        assert.equal(f.calls.filter(([name]) => name === "provider").length, 0);
    }
});

test("legacy helper inventory fallback waits for a proven complete catalog", async () => {
    const base = "http://helper/offline-media/token";
    const requests = [];
    let reads = 0;
    const f = pluginFixture({
        data: new Map([["localMediaEndpoint", base]]),
        host: {
            fetch: async (url) => {
                requests.push(url);
                if (url.endsWith("/sources")) return { ok: false, status: 404 };
                reads++;
                return {
                    json: async () => ({ ...catalog(), scanning: reads === 2 }),
                    ok: true,
                };
            },
        },
        mode: "browser",
    });
    const reply = await new Promise((resolve) =>
        execute(f.w, request("play", { progressive: true }), resolve)
    );
    assert.equal(reply.status, "ok");
    assert.equal(
        reply.data.scanning,
        undefined,
        "no source generation means no unproven partial handoff"
    );
    assert.equal(reads, 3);
    assert.equal(requests[0], base + "/sources");
    assert.equal(requests[2], base + "?sourceId=" + source.id);
});

test("individual file imports can wait for the next independently sourced file", () => {
    const f = pluginFixture();
    const first = { id: "file-a", sourceId: "file-a", url: "blob:a" };
    const second = { id: "file-b", sourceId: "file-b", url: "blob:b" };
    let resumed = 0;
    f.api.queueProgress({ items: [first], scanning: true });
    assert.equal(
        f.api.deferQueueEnd("", () => resumed++),
        true
    );
    f.api.queueProgress({ items: [first, second], scanning: true });
    assert.equal(resumed, 1);
    f.api.deferQueueEnd("", () => resumed++);
    f.api.cancelQueueEnd();
    f.api.queueProgress({ items: [first, second], scanning: false });
    assert.equal(resumed, 1);
});

test("standby during screen cleanup cancels an accepted remote handoff", async () => {
    let blocked = false;
    const f = pluginFixture({
        connected: true,
        host: {
            __ottStandby: { blocked: () => blocked },
            closeList() {
                blocked = true;
                this.__ottLocalMedia.suspend();
            },
        },
    });
    await tick();
    f.snapshots.push(sourceCatalog("scanning"));
    const reply = await new Promise((resolve) =>
        execute(f.w, request("play", { progressive: true }), resolve)
    );
    assert.notEqual(reply.status, "ok");
    assert.equal(f.calls.filter(([name]) => name === "provider").length, 0);
});
