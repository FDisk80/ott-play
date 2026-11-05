"use strict";
// Real Local plugin + storage shadow + selection. Only host lifetime and IO are
// injected; no browser, server, player, filesystem source scan or decoder runs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const vm = require("node:vm");
const imports = require("./helpers/remote-transfer-dependency.cjs").storage;
const ROOT = path.resolve(__dirname, "..");
const clone = (v) => JSON.parse(JSON.stringify(v));
function load(name, requires = {}, globals = {}) {
    const exports = {};
    const source = fs.readFileSync(path.join(ROOT, name), "utf8");
    vm.runInNewContext(
        ts.transpileModule(source, {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES5,
            },
        }).outputText,
        {
            clearTimeout,
            console,
            exports,
            require(name) {
                assert.ok(Object.hasOwn(requires, name), name);
                return requires[name];
            },
            setTimeout,
            URL,
            ...globals,
            exports,
        }
    );
    return exports;
}
function catalog(name = "one") {
    return {
        available: true,
        items: [
            {
                available: true,
                id: name,
                mime: "video/mp4",
                name: name + ".mp4",
                sourceId: "source-" + name,
                url: "blob:fixture/" + name,
            },
        ],
        persistent: false,
        scanning: false,
        sources: [
            {
                available: true,
                id: "source-" + name,
                kind: "file",
                name: name + ".mp4",
            },
        ],
    };
}
function fixture() {
    const saved = new Map([
        ["ottplayprov", "m3u"],
        ["m3uprimaryIndex", "4"],
        [
            "offlineProfiles",
            '{"active":0,"profiles":[{"name":"saved folder"}]}',
        ],
        ["offlinechannelLibrary:offline", '{"selected":"old","rows":["old"]}'],
    ]);
    const before = new Map(saved),
        calls = [],
        releases = [],
        events = {},
        pending = [];
    let blocked = false,
        kiosk = false,
        locked = false,
        defer = false;
    const forbidden = () => {
        throw new Error(
            "Unexpected source scan, network or persistence helper"
        );
    };
    const w = {
        __ottActiveProviderDriver: { dispose() {}, id: "m3u" },
        __ottClassicPlayback: { cancel() {}, checkpointNow() {} },
        __ottCommandChannelLoad: {},
        __ottKiosk: { locked: () => kiosk },
        __ottOfflineProfiles: {
            current: () => ({ binding_id: "saved-folder" }),
            namespace: () => "offline",
        },
        __ottParental: { needs: () => locked },
        __ottStandby: {
            blocked: () => blocked,
            error: () => new Error("standby"),
        },
        addEventListener(name, handler) {
            events[name] = handler;
        },
        closeList() {},
        fetch: forbidden,
        localStorage: {
            getItem: (k) => (saved.has(k) ? saved.get(k) : null),
            key: (i) => [...saved.keys()][i] || null,
            get length() {
                return saved.size;
            },
            removeItem: (k) => saved.delete(k),
            setItem: (k, v) => saved.set(k, String(v)),
        },
    };
    const storageModule = load(
        "src/storage/index.ts",
        {},
        {
            ...imports(),
            document: { cookie: "" },
            window: w,
        }
    );
    w.stbGetItem = storageModule.stbGetItem;
    w.stbSetItem = storageModule.stbSetItem;
    w.stbDelItem = storageModule.stbDelItem;
    const api = load("src/plugins/local-media.ts", {
        "../commands/remote-feature": { loadRemoteFeature: forbidden },
        "../offline/browser-local-media": {
            installBrowserLocalMedia: () => ({ list: forbidden, suspend() {} }),
            installOfflineShell() {},
        },
        "../offline/local-media-progress": load(
            "src/offline/local-media-progress.ts"
        ),
        "../offline/playback-selection": load(
            "src/offline/playback-selection.ts"
        ),
        "../offline/profiles": { installOfflineProfiles() {} },
        "./native-bridge": {
            resolveNativePlugin: () => ({}),
            tauriInvoke: forbidden,
        },
    }).installLocalMedia(w);
    w.loadProv = (id, session) => {
        calls.push(["load", id]);
        w.__ottCommandChannelLoad = {};
        w.__ottActiveProviderDriver?.dispose();
        w.__ottActiveProviderDriver = null;
        const start = () => {
            if (session) session();
            let alive = true;
            const driver = {
                dispose() {
                    alive = false;
                    release?.();
                },
                id: id || w.stbGetItem("ottplayprov"),
            };
            w.__ottActiveProviderDriver = driver;
            const release =
                driver.id === "offline"
                    ? api.bindPlaybackOwner(() => alive)
                    : undefined;
        };
        if (defer) pending.push(start);
        else start();
    };
    return {
        api,
        before,
        calls,
        drop(name = "one", admitted = () => true) {
            const value = catalog(name);
            api.playDroppedVideo(value, admitted, () => releases.push(name));
            return value;
        },
        events,
        pending,
        releases,
        saved,
        setBlocked: (v) => {
            blocked = v;
        },
        setDeferred: (v) => {
            defer = v;
        },
        setKiosk: (v) => {
            kiosk = v;
        },
        setLocked: (v) => {
            locked = v;
        },
        w,
    };
}

test("accepted drop uses Local handoff and repeated reads retain only its in-memory catalog", async () => {
    const f = fixture();
    const input = f.drop();
    assert.deepEqual(f.calls, [["load", "offline"]]);
    const first = await f.api.playbackList();
    const second = await f.api.list();
    assert.equal(first, second);
    assert.notEqual(first, input, "caller cannot mutate the captured catalog");
    assert.equal(first.items.length, 1);
    assert.equal(first.items[0].id, "one");
    assert.equal(f.api.playbackMime(first.items[0].url), "video/mp4");
    assert.equal(f.api.playbackMime("blob:not-owned"), "");
    assert.equal(f.api.isDroppedCatalog(first), true);
    assert.equal(f.api.isDroppedCatalog(clone(first)), false);
    assert.equal(f.api.playbackFilter(first), first);
    assert.equal(f.w.stbGetItem("ottplayprov"), "offline");
    assert.deepEqual(f.saved, f.before);
    assert.deepEqual(f.releases, []);
});

test("drop fully shadows library metadata, cursor and deletion; persist request discards them", async () => {
    const f = fixture();
    f.drop();
    const storage = f.w.ottpStorage;
    const key = "offlinechannelLibrary:offline";
    assert.equal(storage.get(key), null);
    storage.set(key, '{"selected":"one","rows":["one"]}');
    assert.equal(
        storage.transaction(
            [{ after: '{"rows":["two"]}', before: storage.get(key), key }],
            () => true
        ),
        true
    );
    storage.del(key);
    assert.equal(storage.get(key), null);
    storage.set("offlineprimaryIndex", "99");
    assert.equal(storage.localPlayback.end(true), false);
    assert.equal(
        storage.localPlayback.profile([], () => true, true),
        false
    );
    assert.deepEqual(f.saved, f.before);
    assert.equal(f.api.favoriteSnapshot(), null);
    await assert.rejects(f.api.snapshot(), /cannot be saved/);
    assert.equal(f.api.finishSession(true), true);
    assert.deepEqual(f.releases, ["one"]);
    assert.equal(storage.localPlayback.active(), false);
    assert.equal(storage.get("ottplayprov"), "m3u");
    assert.deepEqual(f.saved, f.before);
});

test("invalid replacement and policy refusals release only the rejected lease", () => {
    for (const condition of [
        "shape",
        "admission",
        "kiosk",
        "settings",
        "standby",
    ]) {
        const f = fixture();
        f.drop("old");
        const old = f.w.__ottActiveProviderDriver;
        const value = catalog("rejected");
        if (condition === "shape") value.items.push(clone(value.items[0]));
        if (condition === "kiosk") f.setKiosk(true);
        if (condition === "settings") f.setLocked(true);
        if (condition === "standby") f.setBlocked(true);
        assert.throws(() =>
            f.api.playDroppedVideo(
                value,
                () => condition !== "admission",
                () => f.releases.push("rejected")
            )
        );
        assert.equal(f.w.__ottActiveProviderDriver, old);
        assert.deepEqual(f.calls, [["load", "offline"]]);
        assert.deepEqual(f.releases, ["rejected"]);
        assert.deepEqual(f.saved, f.before);
    }
});

test("accepted B retires A once; delayed A disposer cannot release B", async () => {
    const f = fixture();
    f.drop("a");
    const old = f.w.__ottActiveProviderDriver;
    f.drop("b");
    assert.deepEqual(f.releases, ["a"]);
    old.dispose();
    old.dispose();
    assert.deepEqual(f.releases, ["a"]);
    assert.equal((await f.api.playbackList()).items[0].id, "b");
    f.api.cancelDroppedVideo();
    f.api.cancelDroppedVideo();
    assert.deepEqual(f.releases, ["a", "b"]);
    assert.deepEqual(f.saved, f.before);
});

test("superseded pending A cannot start or retire accepted B", async () => {
    const f = fixture();
    f.setDeferred(true);
    f.drop("a");
    f.drop("b");
    assert.deepEqual(f.releases, ["a"]);
    assert.throws(() => f.pending[0]());
    f.pending[1]();
    assert.equal((await f.api.playbackList()).items[0].id, "b");
    assert.deepEqual(f.releases, ["a"]);
    assert.deepEqual(f.saved, f.before);
});

test("standby disposal and generic cancellation retain the lease for wake rebind", async () => {
    const f = fixture();
    f.drop();
    f.api.cancelPlayback("blob:fixture/one");
    f.setBlocked(true);
    f.w.__ottActiveProviderDriver.dispose();
    f.w.__ottActiveProviderDriver = null;
    f.api.suspend();
    f.api.cancelDroppedVideo();
    await assert.rejects(f.api.playbackList(), /standby/);
    assert.deepEqual(f.releases, []);
    f.setBlocked(false);
    f.w.loadProv();
    assert.equal((await f.api.playbackList()).items[0].id, "one");
    assert.deepEqual(f.saved, f.before);
    assert.deepEqual(f.releases, []);
});

test("retained drop identity survives standby without a driver and ends with release", () => {
    const f = fixture();
    assert.equal(f.api.hasDroppedVideo(), false);
    f.setDeferred(true);
    f.drop();
    assert.equal(
        f.api.hasDroppedVideo(),
        false,
        "pending handoff has no accepted Local session"
    );
    f.pending[0]();
    assert.equal(f.api.hasDroppedVideo(), true);
    f.setBlocked(true);
    f.w.__ottActiveProviderDriver.dispose();
    f.w.__ottActiveProviderDriver = null;
    f.api.suspend();
    assert.equal(
        f.api.hasDroppedVideo(),
        true,
        "standby retires the driver, not the owned session"
    );
    f.setBlocked(false);
    assert.equal(
        f.api.hasDroppedVideo(),
        true,
        "wake admission does not require the next driver yet"
    );
    f.api.cancelDroppedVideo();
    assert.equal(f.api.hasDroppedVideo(), false);
    assert.deepEqual(f.releases, ["one"]);
    assert.deepEqual(f.saved, f.before);
});

test("page teardown and ordinary provider selection retire only the owned transient session", () => {
    for (const leave of [
        (f) => f.events.pagehide(),
        (f) => {
            f.api.cancelDroppedVideo();
            f.w.loadProv("m3u");
        },
    ]) {
        const f = fixture();
        f.drop();
        leave(f);
        f.api.cancelDroppedVideo();
        assert.deepEqual(f.releases, ["one"]);
        assert.equal(f.w.ottpStorage.localPlayback.active(), false);
        assert.equal(f.w.stbGetItem("ottplayprov"), "m3u");
        assert.deepEqual(f.saved, f.before);
    }
});

test("ordinary remote activation retains its existing promotable session contract", async () => {
    const f = fixture(),
        value = catalog("ordinary");
    f.api.remoteActivate(
        value.sources[0].id,
        [value.items[0].id],
        value,
        () => true
    );
    const delivered = await f.api.playbackList();
    assert.equal(f.api.isDroppedCatalog(delivered), false);
    assert.equal(f.w.ottpStorage.localPlayback.end(true), true);
    assert.equal(f.saved.get("ottplayprov"), "offline");
    assert.deepEqual(f.releases, []);
});
