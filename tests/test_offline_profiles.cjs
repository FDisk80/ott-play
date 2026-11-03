const storageImports =
    require("./helpers/remote-transfer-dependency.cjs").storage;
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const code = require("./helpers/offline-profile-source.cjs")();
require("acorn").parse(code, { ecmaVersion: 5 });
const clone = (v) => JSON.parse(JSON.stringify(v));
function fixture(initial, realStorage = false) {
    const data = new Map(initial);
    let catalog = {
        items: [
            {
                id: "PRIVATE-ITEM",
                name: "sub/movie.mp4",
                sourceId: "PRIVATE-SOURCE",
                url: "blob:PRIVATE",
            },
        ],
        sources: [{ id: "PRIVATE-SOURCE", kind: "folder", name: "Cartoons" }],
    };
    const host = {
        __ottActiveProviderDriver: { id: "offline" },
        crypto: webcrypto,
        curList: ["local-PRIVATE-ITEM"],
        loadChannels: () => {
            f.reloads++;
        },
        primaryIndex: 0,
        stbDelItem: (k) => data.delete(k),
        stbGetItem: (k) => data.get(k) ?? null,
        stbSetItem: (k, v) => data.set(k, v),
        Uint8Array,
    };
    vm.createContext(host);
    if (realStorage) {
        host.window = host;
        host.document = { cookie: "" };
        host.localStorage = {
            getItem: (key) => (data.has(key) ? data.get(key) : null),
            key: (index) => [...data.keys()][index] || null,
            get length() {
                return data.size;
            },
            removeItem: (key) => data.delete(key),
            setItem: (key, value) => data.set(key, String(value)),
        };
        Object.assign(host, storageImports(host.require));
        host.exports = {};
        vm.runInContext(
            require("typescript").transpileModule(
                require("node:fs").readFileSync("src/storage/index.ts", "utf8"),
                {
                    compilerOptions: {
                        module: require("typescript").ModuleKind.CommonJS,
                        target: require("typescript").ScriptTarget.ES5,
                    },
                }
            ).outputText,
            host
        );
        host.stbGetItem = host.exports.stbGetItem;
        host.stbSetItem = host.exports.stbSetItem;
        host.stbDelItem = host.exports.stbDelItem;
    }
    vm.runInContext(code, host);
    const media = {
        libraryIdentity: () => "browser:",
        snapshot: async () => catalog,
    };
    const api = host.installOfflineProfiles(host, media);
    const f = {
        api,
        call: async (action, params = {}) =>
            clone(await api.request({ action, params })),
        catalog: () => catalog,
        data,
        host,
        media,
        reloads: 0,
        setCatalog: (v) => {
            catalog = v;
        },
    };
    return f;
}
async function saved(f, number = 1) {
    assert.equal(
        (await f.call("profile_save", { name: "Family", number })).status,
        "ok"
    );
    return (await f.call("profile_export", { number })).data.profile;
}
test("explicit profile save promotes one-off playback, export stays durable and profile load discards one-off bookmarks", async () => {
    const f = fixture(
        [
            ["ottplayprov", "m3u"],
            ["offlineplaybackJournal", "previous-bookmark"],
        ],
        true
    );
    const old = await saved(f, 1);
    f.host.ottpStorage.localPlayback.begin(() => "stable-profile");
    f.host.stbSetItem("localMediaPlaybackSelection", "temporary-folder");
    f.host.stbSetItem("offlineplaybackJournal", "temporary-bookmark");
    assert.deepEqual(
        (await f.call("profile_export", { number: 1 })).data.profile,
        old
    );
    assert.equal(f.data.get("ottplayprov"), "m3u");
    assert.equal(
        (await f.call("profile_save", { name: "Explicit save", number: 2 }))
            .status,
        "ok"
    );
    assert.equal(f.data.get("ottplayprov"), "offline");
    assert.equal(f.data.get("localMediaPlaybackSelection"), "temporary-folder");
    assert.equal(f.data.get("offlineplaybackJournal"), "temporary-bookmark");
    assert.equal(f.host.ottpStorage.localPlayback.active(), false);
    f.host.ottpStorage.localPlayback.begin(() => "stable-profile");
    f.host.stbSetItem("offlineplaybackJournal", "second-one-off-bookmark");
    assert.equal((await f.call("profile", { number: 1 })).status, "ok");
    assert.equal(f.data.get("offlineplaybackJournal"), "temporary-bookmark");
    assert.equal(f.data.get("ottplayprov"), "offline");
    assert.equal(f.host.ottpStorage.localPlayback.active(), false);
});

test("profile save samples the real playback model before atomic promotion and preserves durable rollback", async () => {
    for (const reject of [false, true]) {
        const f = fixture([["ottplayprov", "m3u"]], true);
        const h = f.host;
        Object.assign(h, {
            catIndex: 0,
            cats: { all: h.curList },
            catsArray: ["all"],
            channels: {},
            clearTimeout() {},
            medHistory: [],
            p_pref: "offline",
            playTime: 0,
            playType: 0,
            prevArr: [],
            providerGetItem: (key) => h.stbGetItem("offline" + key),
            providerSetItem: (key, value) =>
                h.stbSetItem("offline" + key, value),
            setInterval() {},
            setTimeout() {},
            settings: { prevCount: 2 },
            stbGetLen: () => 600,
            stbGetPosTime: () => 123,
        });
        require("./helpers/shared-core-runtime.cjs")(h);
        const playback = h.__ottClassicPlayback;
        playback.importLegacy();
        playback.command({
            channelId: "local-PRIVATE-ITEM",
            position: 123,
            type: "live",
        });
        h.ottpStorage.localPlayback.begin(() => "profile");
        playback.checkpoint(playback.snapshot(), true);
        assert.equal(playback.snapshot().position, 123);
        let samples = 0;
        h.stbPlay = () => {};
        h.__ottCoreTransport = { play: h.stbPlay };
        h.__ottCoreBackend = () => ({
            current: () => ({
                active: () => true,
                sample() {
                    samples++;
                    playback.command({
                        duration: 600,
                        generation: playback.snapshot().generation,
                        position: 147,
                        type: "position",
                    });
                },
            }),
        });
        const before = new Map(f.data);
        if (reject) h.ottpStorage.localPlayback.profile = () => false;
        const result = await f.call("profile_save", {
            name: "Fresh position",
            number: 1,
        });
        assert.equal(samples, 1);
        assert.equal(playback.snapshot().position, 147);
        assert.equal(result.status, reject ? "rejected" : "ok");
        if (reject) {
            assert.deepEqual([...f.data], [...before]);
            assert.equal(h.ottpStorage.localPlayback.active(), true);
        } else {
            const journal = JSON.parse(f.data.get("offlineplaybackJournal"));
            assert.equal(journal.bookmark.position, 147);
            assert.equal(h.ottpStorage.localPlayback.active(), false);
            assert.equal(f.data.get("ottplayprov"), "offline");
        }
    }
});

test("profile save rejects checkpoint reentry that replaces its driver, selection or RAM owner", async () => {
    for (const mutation of ["driver", "selection", "session"]) {
        const f = fixture([["ottplayprov", "m3u"]], true);
        f.host.ottpStorage.localPlayback.begin(() => "profile");
        const before = new Map(f.data);
        let checkpoints = 0;
        f.host.__ottClassicPlayback = {
            checkpointNow() {
                checkpoints++;
                if (mutation === "driver")
                    f.host.__ottActiveProviderDriver = { id: "offline" };
                if (mutation === "selection")
                    f.host.curList = ["local-replacement"];
                if (mutation === "session")
                    f.host.ottpStorage.localPlayback.begin(() => "replacement");
            },
        };
        assert.equal(
            (await f.call("profile_save", { number: 1 })).status,
            "rejected"
        );
        assert.equal(checkpoints, 1);
        assert.deepEqual([...f.data], [...before]);
        assert.equal(f.host.ottpStorage.localPlayback.active(), true);
    }
});

test("a session profile transaction rejects stable foreign storage aliases without either backing changing", async () => {
    const f = fixture([["ottplayprov", "m3u"]], true);
    await saved(f, 1);
    f.host.ottpStorage.localPlayback.begin(() => "profile");
    const before = new Map(f.data);
    const foreign = new Map(f.data);
    f.host.stbGetItem = (key) => foreign.get(key) ?? null;
    f.host.stbSetItem = (key, value) => foreign.set(key, value);
    f.host.stbDelItem = (key) => foreign.delete(key);
    assert.equal(
        (await f.call("profile_save", { number: 2 })).status,
        "rejected"
    );
    assert.deepEqual([...f.data], [...before]);
    assert.deepEqual([...foreign], [...before]);
    assert.equal(f.host.ottpStorage.localPlayback.active(), true);
});

test("save/export/load and same-device reimport retain sources and exact selected file without media or grants", async () => {
    const f = fixture(),
        profile = await saved(f);
    const bytes = JSON.stringify(profile);
    assert(!/PRIVATE|blob:|handle|bookmark|url/.test(bytes));
    assert.deepEqual(profile.selected, {
        name: "sub/movie.mp4",
        source_key: "s0",
    });
    assert.equal(
        (await f.call("profile_import", { number: 2, profile })).data
            .binding_required,
        false
    );
    assert.equal((await f.call("profile", { number: 2 })).status, "ok");
    assert.equal(f.reloads, 1);
    assert.equal(f.api.namespace(), "offline:1");
    assert.equal(f.api.selection(), "local-PRIVATE-ITEM");
    const reopened = fixture(f.data);
    assert.equal(reopened.api.selection(), "local-PRIVATE-ITEM");
    assert.equal(reopened.api.filter(reopened.catalog()).items.length, 1);
});
test("foreign import never trusts coincident source IDs or names and explicit local binding restores selection", async () => {
    const profile = await saved(fixture()),
        f = fixture();
    const imported = await f.call("profile_import", { number: 3, profile });
    assert.equal(imported.data.binding_required, true);
    await f.call("profile", { number: 3 });
    assert.equal(f.api.filter(f.catalog()).items.length, 0);
    assert.equal(f.api.selection(), "");
    f.api.bind(f.catalog());
    assert.equal(f.api.selection(), "local-PRIVATE-ITEM");
    assert.equal(f.api.filter(f.catalog()).items.length, 1);
});
test("changed descriptors cannot reuse another local binding ID", async () => {
    const f = fixture(),
        profile = await saved(f);
    profile.selected.name = "another.mp4";
    const receipt = await f.call("profile_import", { number: 2, profile });
    assert.equal(receipt.data.binding_required, true);
});
test("profile source subset survives extra connected folders and save into another slot", async () => {
    const f = fixture();
    await saved(f);
    await f.call("profile", { number: 1 });
    f.catalog().sources.push({ id: "OTHER", kind: "folder", name: "Other" });
    f.catalog().items.push({
        id: "OTHER-ITEM",
        name: "other.mp4",
        sourceId: "OTHER",
        url: "blob:other",
    });
    assert.equal(f.api.filter(f.catalog()).items.length, 1);
    const second = await saved(f, 2);
    assert.equal(second.sources.length, 1);
});
test("profile reads are allowed in kiosk but saves/exports/import/load/bind are denied", async () => {
    const f = fixture(),
        profile = await saved(f);
    f.host.__ottKiosk = { enabled: () => true };
    assert.equal((await f.call("profiles")).status, "ok");
    assert.deepEqual(clone(f.api.capabilities().operations), ["list"]);
    for (const [action, params] of [
        ["profile", { number: 1 }],
        ["profile_save", { number: 1 }],
        ["profile_export", { number: 1 }],
        ["profile_import", { number: 2, profile }],
    ])
        assert.equal((await f.call(action, params)).status, "rejected");
    assert.throws(() => f.api.bind(f.catalog()));
});
test("delayed save cannot publish after provider, policy, endpoint or profile change", async () => {
    for (const change of [
        (f) => {
            f.host.__ottActiveProviderDriver = { id: "offline" };
        },
        (f) => {
            f.host.__ottKiosk = { enabled: () => true };
        },
        (f) => {
            f.media.libraryIdentity = () => "other";
        },
        (f) => {
            f.data.set("offlineProfiles", "changed");
        },
    ]) {
        const f = fixture();
        let release;
        f.media.snapshot = () =>
            new Promise((resolve) => {
                release = resolve;
            });
        const result = f.call("profile_save", { number: 1 });
        await Promise.resolve();
        assert.equal(
            (await f.call("profile_save", { number: 2 })).status,
            "rejected"
        );
        change(f);
        release(f.catalog());
        assert.equal((await result).status, "rejected");
        assert(!f.data.has("offlineProfileBindings"));
    }
});
test("foreign binding fails closed for duplicate folder labels or missing selected file", async () => {
    const profile = await saved(fixture()),
        f = fixture();
    await f.call("profile_import", { number: 1, profile });
    await f.call("profile", { number: 1 });
    f.catalog().sources.push({
        id: "SECOND",
        kind: "folder",
        name: "Cartoons",
    });
    assert.throws(() => f.api.bind(f.catalog()), /exactly one/);
    f.catalog().sources.pop();
    f.catalog().items = [];
    assert.throws(() => f.api.bind(f.catalog()), /missing or ambiguous/);
});
test("strict portable schema rejects paths, arbitrary fields, authority, oversized documents and invalid slots", async () => {
    const f = fixture(),
        original = await saved(f);
    for (const mutate of [
        (p) => {
            p.bookmark = "secret";
        },
        (p) => {
            p.sources[0].handle = {};
        },
        (p) => {
            p.sources[0].name = "/private/video";
        },
        (p) => {
            p.selected.name = "C:\\private\\movie.mp4";
        },
        (p) => {
            p.selected.name = "../movie.mp4";
        },
        (p) => {
            p.selected.name = "file:movie.mp4";
        },
        (p) => {
            p.selected.source_key = "s99";
        },
        (p) => {
            p.name = "й".repeat(129);
        },
        (p) => {
            p.sources = Array.from({ length: 32 }, (_, i) => ({
                key: `s${i}`,
                kind: "folder",
                name: "я".repeat(255),
            }));
        },
    ]) {
        const profile = clone(original);
        mutate(profile);
        assert.equal(
            (await f.call("profile_import", { number: 2, profile })).status,
            "rejected"
        );
    }
    for (const number of [0, 16, 1.5, null, "1", NaN])
        assert.equal((await f.call("profile", { number })).status, "rejected");
    assert.equal(f.api.read().profiles.filter(Boolean).length, 1);
});
test("storage write failure never reports saved or reloads", async () => {
    const f = fixture();
    f.host.stbSetItem = () => {};
    assert.equal(
        (await f.call("profile_save", { number: 1 })).status,
        "rejected"
    );
    assert.equal(f.reloads, 0);
});

test("initial storage failure releases operation lock and does not leak backend details", async () => {
    const f = fixture(),
        read = f.host.stbGetItem;
    f.host.stbGetItem = () => {
        throw new Error("PRIVATE_BOOKMARK");
    };
    const failed = await f.call("profiles");
    assert.equal(failed.status, "rejected");
    assert(!JSON.stringify(failed).includes("PRIVATE_BOOKMARK"));
    f.host.stbGetItem = read;
    assert.equal((await f.call("profiles")).status, "ok");
});

test("missing selected media cannot silently replace saved selection with null", async () => {
    const f = fixture();
    await saved(f);
    f.catalog().items = [];
    const before = f.data.get("offlineProfiles");
    assert.equal(
        (await f.call("profile_save", { number: 1 })).status,
        "rejected"
    );
    assert.equal(f.data.get("offlineProfiles"), before);
});

test("reentrant storage publication cannot reload a replacement provider", async () => {
    const f = fixture();
    await saved(f);
    const write = f.host.stbSetItem;
    f.host.stbSetItem = (key, value) => {
        write(key, value);
        if (key === "offlineProfiles")
            f.host.__ottActiveProviderDriver = { id: "m3u" };
    };
    assert.equal((await f.call("profile", { number: 1 })).status, "rejected");
    assert.equal(f.reloads, 0);
});

test("identical saves reuse binding, changed saves evict only unreferenced history", async () => {
    const f = fixture();
    const first = await saved(f);
    assert.equal((await saved(f)).binding_id, first.binding_id);
    for (let index = 0; index < 135; index++) {
        f.catalog().items[0].name = `episode-${index}.mp4`;
        assert.equal(
            (await f.call("profile_save", { number: 2 })).status,
            "ok"
        );
    }
    assert.equal(
        Object.keys(JSON.parse(f.data.get("offlineProfileBindings"))).length,
        128
    );
    await f.call("profile", { number: 1 });
    assert.equal(f.api.selection(), "local-PRIVATE-ITEM");
});

test("profile load restores its private server/local library context", async () => {
    const f = fixture();
    f.data.set("localMediaEndpoint", "https://server.invalid/private-token");
    f.media.libraryIdentity = () =>
        "browser:" + (f.data.get("localMediaEndpoint") || "");
    f.media.libraryWrite = (value) => ({
        key: "localMediaEndpoint",
        value: value.slice(8),
    });
    const profile = await saved(f);
    assert(!JSON.stringify(profile).includes("private-token"));
    f.data.set("localMediaEndpoint", "");
    assert.equal((await f.call("profile", { number: 1 })).status, "ok");
    assert.equal(
        f.media.libraryIdentity(),
        "browser:https://server.invalid/private-token"
    );
    assert.equal(f.api.selection(), "local-PRIVATE-ITEM");
});

test("binding gesture cannot authorize a different profile or library after pending list", async () => {
    for (const drift of [
        (f) => {
            const store = f.api.read();
            store.active = 1;
            f.data.set("offlineProfiles", JSON.stringify(store));
        },
        (f) => {
            f.media.libraryIdentity = () => "other";
        },
    ]) {
        const profile = await saved(fixture()),
            f = fixture();
        await f.call("profile_import", { number: 1, profile });
        await f.call("profile_import", { number: 2, profile });
        await f.call("profile", { number: 1 });
        let release;
        f.media.snapshot = () =>
            new Promise((resolve) => {
                release = resolve;
            });
        const pending = f.api.bindCurrent();
        drift(f);
        release(f.catalog());
        await assert.rejects(pending, /changed while reading/);
        assert(!f.data.has("offlineProfileBindings"));
    }
});

test("endpoint/profile batch rolls back rejected writes and preserves foreign endpoint changes", async () => {
    for (const mode of [
        "endpoint-reject",
        "profile-reject",
        "profile-throw-after",
        "foreign-endpoint",
        "foreign-driver",
    ]) {
        const f = fixture();
        f.data.set("localMediaEndpoint", "https://server.invalid/private");
        f.media.libraryIdentity = () =>
            "browser:" + (f.data.get("localMediaEndpoint") || "");
        f.media.libraryWrite = (identity) => ({
            key: "localMediaEndpoint",
            value: identity.slice(8),
        });
        await saved(f);
        f.data.set("localMediaEndpoint", "");
        const before = f.data.get("offlineProfiles"),
            write = f.host.stbSetItem;
        let once = false;
        f.host.stbSetItem = (key, value) => {
            if (mode === "endpoint-reject" && key === "localMediaEndpoint")
                return;
            if (mode === "profile-reject" && key === "offlineProfiles") return;
            write(key, value);
            if (!once && key === "offlineProfiles") {
                once = true;
                if (mode === "profile-throw-after")
                    throw new Error("storage rejected after write");
                if (mode === "foreign-endpoint")
                    write(
                        "localMediaEndpoint",
                        "https://external.invalid/other"
                    );
                if (mode === "foreign-driver")
                    f.host.__ottActiveProviderDriver = { id: "m3u" };
            }
        };
        assert.equal(
            (await f.call("profile", { number: 1 })).status,
            "rejected",
            mode
        );
        assert.equal(f.reloads, 0);
        if (mode === "foreign-endpoint")
            assert.equal(
                f.data.get("localMediaEndpoint"),
                "https://external.invalid/other"
            );
        else if (mode !== "foreign-driver")
            assert.equal(f.data.get("localMediaEndpoint"), "");
        if (mode !== "foreign-driver")
            assert.equal(f.data.get("offlineProfiles"), before);
    }
});

test("binding imported identities also bounds unreferenced history", async () => {
    const profile = await saved(fixture()),
        f = fixture();
    for (let index = 0; index < 132; index++) {
        profile.binding_id = require("node:crypto").randomUUID();
        const slot = (index % 2) + 1;
        await f.call("profile_import", {
            number: slot,
            profile: clone(profile),
        });
        await f.call("profile", { number: slot });
        f.api.bind(f.catalog());
    }
    assert.equal(
        Object.keys(JSON.parse(f.data.get("offlineProfileBindings"))).length,
        128
    );
});

test("local endpoint preparation cannot overwrite a newer profile draft", async () => {
    const f = fixture();
    f.data.set("localMediaEndpoint", "https://original.invalid/library");
    f.media.libraryIdentity = () =>
        "browser:" + (f.data.get("localMediaEndpoint") || "");
    await saved(f);
    f.data.set("localMediaEndpoint", "");
    const changed = f.api.read();
    changed.profiles[0].name = "Newer name";
    f.media.libraryWrite = (identity) => {
        f.data.set("offlineProfiles", JSON.stringify(changed));
        return { key: "localMediaEndpoint", value: identity.slice(8) };
    };
    assert.equal((await f.call("profile", { number: 1 })).status, "rejected");
    assert.equal(f.api.read().profiles[0].name, "Newer name");
    assert.equal(f.data.get("localMediaEndpoint"), "");
    assert.equal(f.reloads, 0);
});

test("profile loader cannot report success for a reentrantly replaced provider", async () => {
    const f = fixture();
    await saved(f);
    f.host.loadChannels = () => {
        f.host.__ottActiveProviderDriver = { id: "m3u" };
    };
    assert.equal((await f.call("profile", { number: 1 })).status, "rejected");
});

test("saving an unbound imported profile never turns description placeholders into grants", async () => {
    const profile = await saved(fixture()),
        f = fixture();
    profile.selected = null;
    f.host.curList = [];
    await f.call("profile_import", { number: 1, profile });
    await f.call("profile", { number: 1 });
    assert.equal(
        (await f.call("profile_save", { number: 2 })).status,
        "rejected"
    );
    assert.equal(f.api.read().profiles[1], null);
    assert.equal(f.data.has("offlineProfileBindings"), false);
});

test("save and bind reject partial or cancelled catalogs without launching another scan", async () => {
    for (const state of [{ scanning: true }, { cancelled: true }]) {
        const f = fixture();
        f.media.list = () => {
            throw new Error("Profile request must not restart enumeration");
        };
        Object.assign(f.catalog(), state);
        const result = await f.call("profile_save", { number: 1 });
        assert.equal(result.status, "rejected");
        assert.match(result.data.error, /scan to finish/);
        assert.equal(f.data.has("offlineProfiles"), false);
        await assert.rejects(f.api.bindCurrent(), /scan to finish/);
    }
});

test("save and binding reject partial or cancelled catalogs before granting source access", async () => {
    for (const flags of [{ scanning: true }, { cancelled: true }]) {
        const profile = await saved(fixture());
        const f = fixture();
        await f.call("profile_import", { number: 1, profile });
        await f.call("profile", { number: 1 });
        const before = Array.from(f.data.entries());
        f.setCatalog({ ...f.catalog(), ...flags });
        assert.throws(() => f.api.bind(f.catalog()), /scan to finish/);
        await assert.rejects(f.api.bindCurrent(), /scan to finish/);
        assert.deepEqual(Array.from(f.data.entries()), before);
        assert.equal(f.data.has("offlineProfileBindings"), false);
        const fresh = fixture();
        fresh.host.curList = [];
        fresh.setCatalog({ ...fresh.catalog(), ...flags });
        const result = await fresh.call("profile_save", { number: 1 });
        assert.equal(result.status, "rejected");
        assert.match(result.data.error, /scan to finish/);
        assert.equal(fresh.data.size, 0);
    }
});

test("profile catalog ownership ignores other slots but retains active binding and endpoint guards", async () => {
    const f = fixture();
    const profile = await saved(f);
    await f.call("profile", { number: 1 });
    const guard = f.api.catalogGuard();
    assert.equal(guard(), true);
    assert.equal(
        (await f.call("profile_import", { number: 2, profile })).status,
        "ok"
    );
    assert.equal(
        guard(),
        true,
        "inactive import must not truncate the active scan"
    );
    const before = f.data.get("offlineProfileBindings");
    const bindings = JSON.parse(before);
    bindings["11111111-1111-4111-8111-111111111111"] = clone(
        bindings[profile.binding_id]
    );
    f.data.set("offlineProfileBindings", JSON.stringify(bindings));
    assert.equal(
        guard(),
        true,
        "unrelated binding must not truncate the active scan"
    );
    bindings[profile.binding_id].selected = "OTHER-ITEM";
    f.data.set("offlineProfileBindings", JSON.stringify(bindings));
    assert.equal(guard(), false);
    f.data.set("offlineProfileBindings", before);
    assert.equal(guard(), true);
    f.media.libraryIdentity = () => "browser:https://different.invalid/library";
    assert.equal(guard(), false);
});

test("rejected in-progress save leaves no late write and retries the complete cached source set", async () => {
    const f = fixture();
    let scans = 0;
    f.media.list = () => {
        scans++;
        throw new Error("Unexpected rescan");
    };
    f.catalog().scanning = true;
    const rejected = await f.call("profile_save", { number: 1 });
    assert.equal(rejected.status, "rejected");
    assert.equal(f.data.size, 0);
    f.catalog().sources.push({ id: "SECOND", kind: "folder", name: "Second" });
    f.catalog().scanning = false;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
        f.data.size,
        0,
        "completion of the original scan cannot save a rejected request later"
    );
    assert.equal((await f.call("profile_save", { number: 1 })).status, "ok");
    assert.equal(f.api.read().profiles[0].sources.length, 2);
    assert.equal(scans, 0);
});

test("rejected in-progress binding never grants access after later ambiguous completion", async () => {
    const profile = await saved(fixture());
    const f = fixture();
    await f.call("profile_import", { number: 1, profile });
    await f.call("profile", { number: 1 });
    const before = [...f.data];
    let scans = 0;
    f.media.list = () => {
        scans++;
        throw new Error("Unexpected rescan");
    };
    f.catalog().scanning = true;
    await assert.rejects(f.api.bindCurrent(), /scan to finish/);
    f.catalog().sources.push({
        id: "DUPLICATE",
        kind: "folder",
        name: "Cartoons",
    });
    f.catalog().scanning = false;
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual([...f.data], before);
    await assert.rejects(f.api.bindCurrent(), /exactly one/);
    assert.equal(f.data.has("offlineProfileBindings"), false);
    assert.equal(scans, 0);
});

test("compatibility leases and server credentials stay out of portable profiles", async () => {
    const f = fixture();
    f.media.libraryIdentity = () =>
        "browser:https://server.test/private-library-token";
    f.catalog().items[0].playback = {
        mode: "compatibility",
        prepareUrl: "https://server.test/private-library-token/prepare",
    };
    f.catalog().items[0].url =
        "https://server.test/private-library-token/compat/private-lease/index.m3u8";
    const profile = await saved(f);
    assert.equal(profile.selected.name, "sub/movie.mp4");
    assert(
        !/private-library-token|private-lease|prepareUrl|playback|https:/.test(
            JSON.stringify(profile)
        )
    );
});

const pathFixture = require("./fixtures/local-favorites-relative-path.json");
test("local path validation retains segment, UTF-16 and boundary behavior", () => {
    const actual = fixture().host.localItemRelativePath;
    // The previous scanner is an independent oracle for the compact regexes.
    function previous(value) {
        if (
            typeof value !== "string" ||
            !value ||
            value.trim() !== value ||
            value.length > 8192 ||
            /^[\/]|\\|^[A-Za-z]:|[\u0000-\u001f\u007f]/.test(value) ||
            value.indexOf("://") >= 0 ||
            value
                .split("/")
                .some((part) => !part || part === "." || part === "..")
        )
            return null;
        for (let i = 0; i < value.length; i++) {
            const code = value.charCodeAt(i);
            if (code >= 0xd800 && code <= 0xdbff) {
                const low = value.charCodeAt(++i);
                if (!(low >= 0xdc00 && low <= 0xdfff)) return null;
            } else if (code >= 0xdc00 && code <= 0xdfff) return null;
        }
        return value;
    }
    function check(value) {
        const expected = previous(value);
        assert.equal(actual({ name: value }), expected);
        assert.equal(
            actual({ name: "fallback.mp4", relativePath: value }),
            expected
        );
    }
    const alphabet = [
        "a",
        ".",
        "/",
        "\\",
        "\n",
        "\0",
        "\ud800",
        "\udbff",
        "\udc00",
        "\udfff",
        "é",
    ];
    function walk(value, depth) {
        check(value);
        if (depth)
            for (const character of alphabet)
                walk(value + character, depth - 1);
    }
    walk("", 5);
    for (let code = 0; code <= 0xffff; code++)
        check("a" + String.fromCharCode(code) + ".mp4");
    for (const value of [
        undefined,
        null,
        0,
        {},
        " file.mp4",
        "file.mp4 ",
        "a".repeat(8192),
        "a".repeat(8193),
        "é".repeat(8192),
        "custom:file.mp4",
        "C:file.mp4",
        "https://example.test/file.mp4",
        "folder/scheme://file.mp4",
        "folder/%2e%2e/file.mp4",
        "文件夹/🎬.mp4",
        "folder/../file.mp4",
        "folder/./file.mp4",
        "folder//file.mp4",
    ])
        check(value);
    assert.equal(actual(null), null);
    assert.equal(
        actual({ name: "fallback.mp4", relativePath: undefined }),
        null
    );
});

test("portable profile and catalog path limits retain their distinct contracts", async () => {
    const profile = await saved(fixture());
    for (const [value, helperAccepts, profileAccepts] of [
        [" file.mp4", false, true],
        ["file.mp4 ", false, true],
        ["custom:file.mp4", true, false],
        ["é".repeat(513), true, false],
        ["é".repeat(512), true, true],
        ["folder/🎬.mp4", true, true],
        ["folder//file.mp4", false, false],
        ["https://example.test/file.mp4", false, false],
    ]) {
        const receiver = fixture();
        const candidate = clone(profile);
        candidate.selected.name = value;
        assert.equal(
            receiver.host.localItemRelativePath({ relativePath: value }) ===
                value,
            helperAccepts
        );
        assert.equal(
            (
                await receiver.call("profile_import", {
                    number: 2,
                    profile: candidate,
                })
            ).status,
            profileAccepts ? "ok" : "rejected"
        );
    }
});

function nativePathCatalog(prefix) {
    return {
        items: pathFixture.items.map((item, index) => ({
            ...item,
            id: prefix + "-" + index,
            sourceId: prefix + "-root",
        })),
        sources: [{ ...pathFixture.source, id: prefix + "-root" }],
    };
}

test("native nested selection transfers and resumes the exact same-basename file", async () => {
    const sender = fixture();
    sender.setCatalog(nativePathCatalog("sender"));
    sender.host.curList = ["local-sender-1"];
    const profile = await saved(sender);
    assert.equal(profile.selected.name, pathFixture.items[1].relativePath);

    const receiver = fixture();
    receiver.setCatalog(nativePathCatalog("receiver"));
    assert.equal(
        (await receiver.call("profile_import", { number: 3, profile })).status,
        "ok"
    );
    assert.equal((await receiver.call("profile", { number: 3 })).status, "ok");
    receiver.api.bind(receiver.catalog());
    assert.equal(receiver.api.selection(), "local-receiver-1");
    const restarted = fixture(receiver.data);
    restarted.setCatalog(nativePathCatalog("receiver"));
    assert.equal(restarted.api.selection(), "local-receiver-1");
    assert.equal(
        (await restarted.call("profile_export", { number: 3 })).data.profile
            .selected.name,
        pathFixture.items[1].relativePath
    );
});

test("explicit invalid native path never falls back to name on save or binding", async () => {
    const original = await saved(fixture());
    for (const invalid of [
        undefined,
        null,
        "",
        "../movie.mp4",
        "/private/movie.mp4",
        " sub/movie.mp4",
        "sub/movie.mp4\u00a0",
    ]) {
        const sender = fixture();
        sender.catalog().items[0].relativePath = invalid;
        assert.equal(
            (await sender.call("profile_save", { number: 1 })).status,
            "rejected"
        );
        assert.equal(sender.data.has("offlineProfiles"), false);

        const receiver = fixture();
        assert.equal(
            (
                await receiver.call("profile_import", {
                    number: 2,
                    profile: original,
                })
            ).status,
            "ok"
        );
        assert.equal(
            (await receiver.call("profile", { number: 2 })).status,
            "ok"
        );
        receiver.catalog().items[0].relativePath = invalid;
        const before = [...receiver.data];
        assert.throws(
            () => receiver.api.bind(receiver.catalog()),
            /missing or ambiguous/
        );
        assert.deepEqual([...receiver.data], before);
    }
});

test("explicit full paths retain the existing portable selected-name limit", async () => {
    const f = fixture();
    f.catalog().items[0].name = "short.mp4";
    f.catalog().items[0].relativePath = "a/" + "x".repeat(1020) + ".mp4";
    assert.equal(
        (await f.call("profile_save", { number: 1 })).status,
        "rejected"
    );
    assert.equal(f.data.has("offlineProfiles"), false);
});

test("an individually bound file with null relativePath saves transfers and resumes by file source", async () => {
    function fileCatalog(prefix) {
        return {
            items: [
                {
                    id: prefix + "-item",
                    name: "Clip.mp4",
                    relativePath: null,
                    sourceId: prefix + "-file",
                },
            ],
            sources: [{ id: prefix + "-file", kind: "file", name: "Clip.mp4" }],
        };
    }
    const sender = fixture();
    sender.setCatalog(fileCatalog("sender"));
    sender.host.curList = ["local-sender-item"];
    const profile = await saved(sender);
    assert.deepEqual(profile.sources, [
        { key: "s0", kind: "file", name: "Clip.mp4" },
    ]);
    assert.deepEqual(profile.selected, { name: "Clip.mp4", source_key: "s0" });

    const receiver = fixture();
    receiver.setCatalog(fileCatalog("receiver"));
    assert.equal(
        (await receiver.call("profile_import", { number: 2, profile })).status,
        "ok"
    );
    assert.equal((await receiver.call("profile", { number: 2 })).status, "ok");
    receiver.api.bind(receiver.catalog());
    assert.equal(receiver.api.selection(), "local-receiver-item");
    assert.equal(fixture(receiver.data).api.selection(), "local-receiver-item");
});

test("a saved basename-only folder selection cannot select another nested file", async () => {
    const sender = fixture();
    sender.setCatalog({
        items: [{ id: "old-item", name: "Clip.mp4", sourceId: "old-root" }],
        sources: [{ id: "old-root", kind: "folder", name: "Movies" }],
    });
    sender.host.curList = ["local-old-item"];
    const profile = await saved(sender);
    const receiver = fixture();
    receiver.setCatalog({
        items: [
            {
                id: "new-item",
                name: "Clip.mp4",
                relativePath: "Another/Clip.mp4",
                sourceId: "new-root",
            },
        ],
        sources: [{ id: "new-root", kind: "folder", name: "Movies" }],
    });
    await receiver.call("profile_import", { number: 2, profile });
    await receiver.call("profile", { number: 2 });
    const before = [...receiver.data];
    assert.throws(
        () => receiver.api.bind(receiver.catalog()),
        /missing or ambiguous/
    );
    assert.deepEqual(
        [...receiver.data],
        before,
        "unresolved profile remains intact"
    );
});

function rootCollisionCatalog(includeOriginal = true) {
    return {
        items: [
            {
                id: "wrong-root-file",
                name: "Clip.mp4",
                relativePath: "Clip.mp4",
                sourceId: "receiver-root",
            },
            ...(includeOriginal
                ? [
                      {
                          id: "original-nested-file",
                          name: "Clip.mp4",
                          relativePath: "Season1/Clip.mp4",
                          sourceId: "receiver-root",
                      },
                  ]
                : []),
        ],
        sources: [{ id: "receiver-root", kind: "folder", name: "Movies" }],
    };
}

test("legacy imported folder basenames never rebind to a coincident root file", async () => {
    // Literal old wire data: using a newly captured profile here would hide a
    // future provenance-format migration and stop testing legacy imports.
    const profile = {
        binding_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Movies",
        provider: "offline",
        selected: { name: "Clip.mp4", source_key: "s0" },
        sources: [{ key: "s0", kind: "folder", name: "Movies" }],
        version: 1,
    };
    for (const includeOriginal of [true, false]) {
        const receiver = fixture();
        receiver.setCatalog(rootCollisionCatalog(includeOriginal));
        assert.equal(
            (await receiver.call("profile_import", { number: 2, profile }))
                .status,
            "ok"
        );
        assert.equal(
            (await receiver.call("profile", { number: 2 })).status,
            "ok"
        );
        const before = [...receiver.data];
        assert.throws(
            () => receiver.api.bind(receiver.catalog()),
            /missing or ambiguous/
        );
        assert.deepEqual([...receiver.data], before);
        assert.equal(receiver.data.has("offlineProfileBindings"), false);
        assert.equal(receiver.api.selection(), "");
        assert.deepEqual(
            (await receiver.call("profile_export", { number: 2 })).data.profile,
            profile
        );
    }
});

async function savedLegacyBasename() {
    const f = fixture();
    f.setCatalog({
        items: [
            {
                id: "original-nested-file",
                name: "Clip.mp4",
                sourceId: "receiver-root",
            },
        ],
        sources: [{ id: "receiver-root", kind: "folder", name: "Movies" }],
    });
    f.host.curList = ["local-original-nested-file"];
    const profile = await saved(f);
    assert.equal(profile.selected.name, "Clip.mp4");
    assert.equal((await f.call("profile", { number: 1 })).status, "ok");
    return { f, profile };
}

test("a legacy private selected ID survives restart and a root-name collision", async () => {
    const { f, profile } = await savedLegacyBasename();
    const restarted = fixture(f.data);
    restarted.setCatalog(rootCollisionCatalog());
    assert.equal(restarted.api.selection(), "local-original-nested-file");
    restarted.api.bind(restarted.catalog());
    assert.equal(restarted.api.selection(), "local-original-nested-file");
    assert.deepEqual(
        (await restarted.call("profile_export", { number: 1 })).data.profile,
        profile
    );
    delete restarted.catalog().items[1].relativePath;
    restarted.api.bind(restarted.catalog());
    assert.equal(restarted.api.selection(), "local-original-nested-file");
});

test("legacy private selected IDs do not override invalid explicit paths", async () => {
    for (const invalid of [
        undefined,
        null,
        "",
        "../escape.mp4",
        " Folder/Clip.mp4",
        "Folder/Clip.mp4\u00a0",
        "/private/Clip.mp4",
        "C:/private/Clip.mp4",
    ]) {
        const { f, profile } = await savedLegacyBasename();
        f.setCatalog(rootCollisionCatalog());
        f.catalog().items[1].relativePath = invalid;
        const before = [...f.data];
        assert.throws(() => f.api.bind(f.catalog()), /missing or ambiguous/);
        assert.deepEqual([...f.data], before);
        assert.equal(f.api.selection(), "local-original-nested-file");
        assert.deepEqual(
            (await f.call("profile_export", { number: 1 })).data.profile,
            profile
        );
    }
});

test("legacy private proof must match library, signature, source and a present exact ID", async () => {
    for (const invalidate of [
        (binding) => {
            binding.library = "browser:another";
        },
        (binding) => {
            binding.signature = "another-profile";
        },
        (binding) => {
            binding.sources.s0 = "another-source";
        },
        (binding) => {
            binding.selected = "missing-original";
        },
    ]) {
        const { f, profile } = await savedLegacyBasename();
        const bindings = JSON.parse(f.data.get("offlineProfileBindings"));
        invalidate(bindings[profile.binding_id]);
        f.data.set("offlineProfileBindings", JSON.stringify(bindings));
        f.setCatalog(rootCollisionCatalog());
        const before = [...f.data];
        assert.throws(() => f.api.bind(f.catalog()), /missing or ambiguous/);
        assert.deepEqual([...f.data], before);
    }
});

test("new root-file captures retain their exact private selection locally", async () => {
    const f = fixture();
    f.setCatalog(rootCollisionCatalog());
    f.host.curList = ["local-wrong-root-file"];
    const profile = await saved(f);
    assert.equal(profile.selected.name, "Clip.mp4");
    assert.equal((await f.call("profile", { number: 1 })).status, "ok");
    const restarted = fixture(f.data);
    restarted.setCatalog(rootCollisionCatalog());
    assert.equal(restarted.api.selection(), "local-wrong-root-file");
    restarted.api.bind(restarted.catalog());
    assert.equal(restarted.api.selection(), "local-wrong-root-file");
    assert.deepEqual(
        (await restarted.call("profile_export", { number: 1 })).data.profile,
        profile
    );
});

test("an individual file profile cannot bind a folder source with the same name", async () => {
    const sender = fixture();
    sender.setCatalog({
        items: [
            {
                id: "sender-item",
                name: "Clip.mp4",
                relativePath: null,
                sourceId: "sender-file",
            },
        ],
        sources: [{ id: "sender-file", kind: "file", name: "Clip.mp4" }],
    });
    sender.host.curList = ["local-sender-item"];
    const profile = await saved(sender);
    const receiver = fixture();
    receiver.setCatalog({
        items: [
            {
                id: "receiver-item",
                name: "Clip.mp4",
                relativePath: null,
                sourceId: "receiver-folder",
            },
        ],
        sources: [{ id: "receiver-folder", kind: "folder", name: "Clip.mp4" }],
    });
    await receiver.call("profile_import", { number: 2, profile });
    await receiver.call("profile", { number: 2 });
    const before = [...receiver.data];
    assert.throws(
        () => receiver.api.bind(receiver.catalog()),
        /exactly one matching source/
    );
    assert.deepEqual([...receiver.data], before);
});
