"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const storageImports =
    require("./helpers/remote-transfer-dependency.cjs").storage;

function runSource(host, file) {
    const code = ts.transpileModule(
        fs.readFileSync(file, "utf8").replace(/^export /gm, ""),
        {
            compilerOptions: {
                module: ts.ModuleKind.None,
                target: ts.ScriptTarget.ES5,
            },
        }
    ).outputText;
    vm.runInContext(code, host, { filename: file });
}

function sourceNode(file, predicate) {
    const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true
    );
    let result;
    function visit(node) {
        if (!result && predicate(node)) result = node;
        ts.forEachChild(node, visit);
    }
    visit(source);
    assert(result, "Missing source node in " + file);
    return { node: result, source, text: result.getText(source) };
}

function runCode(host, code) {
    vm.runInContext(
        ts.transpileModule(code.replace(/^export /gm, ""), {
            compilerOptions: {
                module: ts.ModuleKind.None,
                target: ts.ScriptTarget.ES5,
            },
        }).outputText,
        host
    );
}

// Run the real async command admission, host migration/open, list view, host
// renderer and provider's remembering branch. Only actual IO/rendering is stubbed.
function deferredFavorites(f, delaySnapshot = false) {
    const w = f.host;
    const hostFile = "src/media/global-favorites-host.ts";
    const hostOpen = sourceNode(
        hostFile,
        (n) => ts.isFunctionDeclaration(n) && n.name?.text === "open"
    );
    const show = sourceNode(
        hostFile,
        (n) => ts.isPropertyAssignment(n) && n.name.getText() === "show"
    );
    const captureScreen = sourceNode(
        hostFile,
        (n) =>
            ts.isPropertyAssignment(n) && n.name.getText() === "captureScreen"
    );
    const channelList = sourceNode(
        "src/provider/index.ts",
        (n) => ts.isFunctionDeclaration(n) && n.name?.text === "_channelsList"
    );
    const remember = channelList.node.body.statements.find(
        (n) =>
            ts.isIfStatement(n) &&
            n.thenStatement.getText().includes(".rememberCategory?.(")
    );
    assert(remember);
    let load, pending, releaseSnapshot, snapshotStarted;
    let painted = 0;
    const snapshotReady = new Promise((resolve) => (snapshotStarted = resolve));
    Object.assign(w, {
        captureFavoritesPhysicalStorage: () => ({}),
        captureGlobalFavoriteMigration: async () => null,
        codec: {},
        initializeGlobalFavorites: () => ({
            open: (...args) => (pending = w.open(...args)),
        }),
        loadRemoteFeature: (_host, _feature, ready) => {
            load = ready;
        },
        permitted: () => true,
        player: {},
        w,
    });
    runCode(
        w,
        "var globalFavoriteIntent = 0; var migrationPending = [];\n" +
            hostOpen.text
    );
    runCode(
        w,
        "var showFavorites = " + show.node.initializer.getText(show.source)
    );
    runCode(
        w,
        "function rememberRendered(view) { var catIdx = 0; " +
            remember.getText(channelList.source) +
            " }"
    );
    runCode(
        w,
        "var captureFavoritesScreen = " +
            captureScreen.node.initializer.getText(captureScreen.source)
    );
    w.__ottChannelListView = {
        show: (view) => {
            painted++;
            w.rememberRendered(view);
        },
    };
    runSource(w, "src/media/global-favorites-view.ts");
    w.view = w.createGlobalFavoritesView({
        captureScreen: w.captureFavoritesScreen,
        current: () => true,
        navigation: { currentId: () => null },
        show: w.showFavorites,
        store: {
            snapshot: async () => {
                if (delaySnapshot) {
                    const wait = new Promise(
                        (resolve) => (releaseSnapshot = resolve)
                    );
                    snapshotStarted();
                    await wait;
                }
                return { current: () => true, entries: [] };
            },
        },
        translate: (text) => text,
    });
    for (const name of ["globalFavoriteAction", "openGlobalFavorites"]) {
        runCode(
            w,
            sourceNode(
                "src/commands/global-favorites.ts",
                (n) => ts.isFunctionDeclaration(n) && n.name?.text === name
            ).text
        );
    }
    w.channelsList = () => w.openGlobalFavorites();
    return {
        async finish() {
            assert(load, "The optional feature load is deferred");
            load();
            await pending;
        },
        painted: () => painted,
        refresh: () => w.view.open(),
        releaseSnapshot: () => releaseSnapshot(),
        settled: () => pending,
        snapshotReady,
        start: () => load(),
    };
}

// Actual storage session wrapper and catalogue adapter, with only rendering and
// provider IO replaced by deterministic ports. No device or user library access.
function fixture(saved = new Map([["ottplayprov", "m3u"]])) {
    const messages = [];
    const host = {
        localStorage: {
            getItem: (key) => saved.get(key) ?? null,
            key: (index) => [...saved.keys()][index] ?? null,
            get length() {
                return saved.size;
            },
            removeItem: (key) => saved.delete(key),
            setItem: (key, value) => saved.set(key, String(value)),
        },
    };
    const exports = {};
    vm.runInNewContext(
        ts.transpileModule(fs.readFileSync("src/storage/index.ts", "utf8"), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES5,
            },
        }).outputText,
        {
            ...storageImports(),
            console,
            document: { cookie: "" },
            exports,
            window: host,
        }
    );
    const storage = exports.storage;
    let provider = "m3u",
        source = "m3u:first",
        opened = null;
    Object.assign(host, {
        _: (value) => value,
        __ottSourceIdentity: { current: () => source },
        catIndex: 0,
        channels: {},
        cList: [],
        curList: [],
        favoritesArray: [],
        ottpStorage: storage,
        primaryIndex: 0,
        providerGetItem: (key) => storage.get(provider + key),
        providerGetPersistedItem: (key) => saved.get(provider + key) ?? null,
        providerSetItem: (key, value) => storage.set(provider + key, value),
        sFavorites: 0,
        showShift: (message) => messages.push(message),
        stbDelItem: storage.del,
        stbGetItem: storage.get,
        stbGetPersistedItem: exports.stbGetPersistedItem,
        stbSetItem: storage.set,
    });
    host.window = host;
    vm.createContext(host);
    runSource(host, "src/channels/library.ts");
    runSource(host, "src/channels/classic-library.ts");
    host.channelsList = (category) => {
        opened = host.__ottChannels.group(category);
        host.listCatIndex = category;
        host.__ottChannels.rememberCategory(category);
    };
    function enter(nextProvider, profile, offset = 0) {
        provider = nextProvider;
        source = nextProvider + ":" + profile;
        host.__ottActiveProviderDriver = { id: provider };
        host.catIndex = 0;
        host.primaryIndex = 0;
        host.curList = [];
        host.cList = [11 + offset, 22 + offset];
        host.channels = Object.fromEntries(
            host.cList.map((id, index) => [
                id,
                {
                    category: { name: index ? "Films" : "News" },
                    channel_name: "Entry " + index,
                    groupId: index ? "provider:films" : "provider:news",
                    itemId: index ? "stable-film" : "stable-news",
                },
            ])
        );
        host.__ottChannels.mount(host);
    }
    return {
        browse(group) {
            assert(host.__ottChannels.browse(group));
        },
        browsing() {
            return host.__ottChannels.group(host.__ottChannels.browsingIndex());
        },
        enter,
        host,
        messages,
        open() {
            opened = null;
            host.__ottChannels.restoreBrowsing();
            return opened;
        },
        play(group, id) {
            assert(
                host.__ottChannels.select(host.__ottChannels.index(group), id)
            );
        },
        saved,
        storage,
    };
}

test("unified Favorites follows provider handoffs without changing stable playback selection", () => {
    const f = fixture();
    f.enter("m3u", "first");
    f.play("provider:films", 22);
    f.browse("system:favorites");
    for (const [provider, profile] of [
        ["m3u", "second"],
        ["plex", "library"],
        ["vportal", "home"],
        ["stalker", "portal"],
    ]) {
        f.enter(provider, profile);
        assert.equal(
            f.browsing(),
            "system:favorites",
            provider + " lost the unified category"
        );
        assert.equal(f.open(), "system:favorites");
    }
    f.enter("m3u", "first", 100);
    assert.equal(
        f.host.__ottChannels.document().selected.itemId,
        "stable-film"
    );
    assert.equal(f.host.curList[f.host.primaryIndex], 122);
    assert.equal(f.browsing(), "system:favorites");
});

test("temporary Local playback and a fresh runtime retain Favorites and the durable provider", () => {
    const f = fixture();
    f.enter("m3u", "first");
    f.browse("system:favorites");
    // Same actual session admission used by Local remoteActivate for one-off playback.
    f.storage.localPlayback.begin(() => "same-offline-profile");
    f.storage.set("localMediaPlaybackSelection", "temporary-folder");
    f.enter("offline", "temporary-folder");
    assert.equal(f.browsing(), "system:favorites");
    assert.equal(f.storage.get("ottplayprov"), "offline");
    assert.equal(f.saved.get("ottplayprov"), "m3u");
    const reopened = fixture(f.saved);
    reopened.enter(reopened.storage.get("ottplayprov"), "first", 100);
    assert.equal(reopened.open(), "system:favorites");
    assert.equal(reopened.storage.get("localMediaPlaybackSelection"), null);
});

test("manual category selection retires the global override; transient rendering does not", () => {
    const f = fixture();
    f.enter("m3u", "first");
    f.browse("system:favorites");
    f.host.__ottChannels.browse("system:all", false);
    f.enter("plex", "library");
    assert.equal(f.browsing(), "system:favorites");
    f.browse("provider:news");
    assert.equal(f.open(), "provider:news");
    f.enter("m3u", "first");
    assert.equal(f.browsing(), "system:all");
    assert.equal(f.open(), "system:all");
    assert.equal(
        f.host.__ottChannels.document().browsedGroup,
        "system:favorites"
    );
    f.enter("vportal", "new-profile");
    assert.notEqual(f.browsing(), "system:favorites");
    const reopened = fixture(f.saved);
    reopened.enter("plex", "library");
    assert.equal(reopened.open(), "provider:news");
});

test("a manual category change during temporary playback is durable without saving its provider", () => {
    const f = fixture();
    f.enter("m3u", "first");
    f.browse("provider:films");
    f.storage.localPlayback.begin(() => "temporary");
    f.enter("offline", "temporary");
    f.browse("system:favorites");
    assert.equal(f.saved.get("globalFavoritesSelection"), "1");
    const favoriteRestart = fixture(f.saved);
    favoriteRestart.enter("m3u", "first");
    assert.equal(favoriteRestart.open(), "system:favorites");
    f.browse("provider:news");
    assert.equal(f.saved.get("globalFavoritesSelection"), "0");
    assert.equal(f.saved.get("ottplayprov"), "m3u");
    const manualRestart = fixture(f.saved);
    manualRestart.enter("m3u", "first");
    assert.equal(manualRestart.open(), "provider:films");
});

test("catalog refresh and historical per-source Favorites do not establish a global choice", () => {
    const f = fixture();
    f.enter("m3u", "first");
    f.browse("system:favorites");
    f.saved.delete("globalFavoritesSelection");
    const legacy = fixture(f.saved);
    legacy.enter("m3u", "first");
    assert.equal(legacy.open(), "system:favorites");
    legacy.host.__ottChannels.refresh();
    assert.equal(f.saved.has("globalFavoritesSelection"), false);
    legacy.enter("plex", "new");
    assert.equal(legacy.browsing(), "system:all");
    assert.equal(f.saved.has("globalFavoritesSelection"), false);
});

for (const refusal of ["throw", "ignore", "memory-only"]) {
    test(
        "refused global persistence retains the previous category: " + refusal,
        () => {
            const f = fixture();
            f.enter("m3u", "first");
            f.browse("provider:news");
            const before = Array.from(f.saved);
            let memory;
            f.host.stbSetItem = (key, value) => {
                assert.equal(key, "globalFavoritesSelection");
                if (refusal === "throw") throw Error("storage refused");
                if (refusal === "memory-only") memory = String(value);
            };
            if (refusal === "memory-only")
                f.host.stbGetItem = (key) => memory ?? f.storage.get(key);
            assert.equal(
                f.host.__ottChannels.rememberCategory("system:favorites"),
                false
            );
            assert.equal(f.browsing(), "provider:news");
            assert.equal(
                f.host.__ottChannels.document().browsedGroup,
                "provider:news"
            );
            assert.deepEqual(Array.from(f.saved), before);
        }
    );
}

test("a refused source category restores the global selection and retains the stable playing item", () => {
    const f = fixture();
    f.enter("m3u", "first");
    f.browse("system:favorites");
    f.play("provider:films", 22);
    f.host.providerSetItem = () => {
        throw Error("source storage refused");
    };
    f.host.__ottChannels.mount(f.host);
    const before = Array.from(f.saved);
    assert.equal(f.host.__ottChannels.rememberCategory("provider:news"), false);
    assert.equal(f.saved.get("globalFavoritesSelection"), "1");
    assert.equal(f.browsing(), "system:favorites");
    assert.equal(
        f.host.__ottChannels.document().selected.itemId,
        "stable-film"
    );
    assert.deepEqual(Array.from(f.saved), before);
});

test("a refused global clear cannot discard Favorites or change the source category", () => {
    const f = fixture();
    f.enter("m3u", "first");
    f.browse("system:favorites");
    const before = Array.from(f.saved);
    f.host.stbSetItem = () => {};
    assert.equal(f.host.__ottChannels.rememberCategory("provider:news"), false);
    assert.equal(f.browsing(), "system:favorites");
    assert.equal(
        f.host.__ottChannels.document().browsedGroup,
        "system:favorites"
    );
    assert.deepEqual(Array.from(f.saved), before);
});

test("a source write retained only in memory rolls back both category stores", () => {
    const f = fixture();
    f.enter("m3u", "first");
    f.browse("system:favorites");
    const get = f.host.providerGetItem;
    const memory = new Map();
    f.host.providerGetItem = (key) =>
        memory.has(key) ? memory.get(key) : get(key);
    f.host.providerSetItem = (key, value) => memory.set(key, value);
    f.host.__ottChannels.mount(f.host);
    const before = Array.from(f.saved);
    const key = "channelLibrary:m3u:first";
    const prior = f.host.providerGetItem(key);
    assert.equal(f.host.__ottChannels.rememberCategory("provider:news"), false);
    assert.equal(f.saved.get("globalFavoritesSelection"), "1");
    assert.equal(f.host.providerGetItem(key), prior);
    assert.equal(
        f.host.__ottChannels.document().browsedGroup,
        "system:favorites"
    );
    assert.equal(f.browsing(), "system:favorites");
    assert.deepEqual(Array.from(f.saved), before);
    const restart = fixture(f.saved);
    restart.enter("m3u", "first");
    assert.equal(restart.open(), "system:favorites");
});

test("durable category changes retain the separate Local preview cursor", () => {
    const f = fixture();
    f.enter("offline", "folder");
    f.play("provider:news", 11);
    const preview = f.storage.localPlayback.preview(() => "preview");
    assert(preview);
    f.play("provider:films", 22);
    assert(f.host.__ottChannels.rememberCategory("system:favorites"));
    const key = "offlinechannelLibrary:offline:folder";
    assert.equal(JSON.parse(f.saved.get(key)).browsedGroup, "system:favorites");
    assert.equal(JSON.parse(f.saved.get(key)).selected.itemId, "stable-news");
    assert.equal(
        f.host.__ottChannels.document().selected.itemId,
        "stable-film"
    );
    preview.discard();
    const restart = fixture(f.saved);
    restart.enter("offline", "folder");
    assert.equal(restart.open(), "system:favorites");
    assert.equal(
        restart.host.__ottChannels.document().selected.itemId,
        "stable-news"
    );
});

test("a first global choice requires rollback support before writing", () => {
    const f = fixture();
    f.enter("m3u", "first");
    delete f.host.stbDelItem;
    const before = Array.from(f.saved);
    assert.equal(
        f.host.__ottChannels.rememberCategory("system:favorites"),
        false
    );
    assert.deepEqual(Array.from(f.saved), before);
});

test("async restoration and list refresh do not promote historical Favorites", async () => {
    const initial = fixture();
    initial.enter("m3u", "first");
    initial.browse("system:favorites");
    initial.saved.delete("globalFavoritesSelection");
    const f = fixture(initial.saved);
    f.enter("m3u", "first");
    const deferred = deferredFavorites(f);
    assert(f.host.__ottChannels.restoreBrowsing());
    assert.equal(f.saved.has("globalFavoritesSelection"), false);
    await deferred.finish();
    assert.equal(deferred.painted(), 1);
    assert.equal(f.saved.has("globalFavoritesSelection"), false);
    await deferred.refresh();
    assert.equal(deferred.painted(), 2);
    assert.equal(f.saved.has("globalFavoritesSelection"), false);
});

test("an explicit async Favorites opening retains its selection intent", async () => {
    const f = fixture();
    f.enter("m3u", "first");
    const deferred = deferredFavorites(f);
    f.browse("system:favorites");
    assert.equal(f.saved.has("globalFavoritesSelection"), false);
    await deferred.finish();
    assert.equal(f.saved.get("globalFavoritesSelection"), "1");
    assert.equal(
        f.host.__ottChannels.document().browsedGroup,
        "system:favorites"
    );
});

test("a delayed Favorites opening cannot overwrite a newer explicit category", async () => {
    const f = fixture();
    f.enter("m3u", "first");
    f.browse("provider:films");
    const deferred = deferredFavorites(f);
    f.browse("system:favorites");
    assert(f.host.__ottChannels.rememberCategory("provider:news"));
    await deferred.finish();
    assert.equal(f.saved.get("globalFavoritesSelection"), "0");
    assert.equal(f.browsing(), "provider:news");
    assert.equal(f.host.__ottChannels.document().browsedGroup, "provider:news");
    assert.equal(deferred.painted(), 0);
});

test("captured category intent is single-use and a newer capture supersedes it", () => {
    const f = fixture();
    f.enter("m3u", "first");
    const older = f.host.__ottChannels.captureCategorySelection();
    const newer = f.host.__ottChannels.captureCategorySelection();
    assert.equal(older("system:favorites"), false);
    assert.equal(newer("system:favorites"), true);
    assert.equal(newer("provider:news"), false);
    assert.equal(f.saved.get("globalFavoritesSelection"), "1");
});

test("a newer category while the Favorites snapshot loads also prevents stale rendering", async () => {
    const f = fixture();
    f.enter("m3u", "first");
    const deferred = deferredFavorites(f, true);
    f.browse("system:favorites");
    deferred.start();
    await deferred.snapshotReady;
    assert(f.host.__ottChannels.rememberCategory("provider:news"));
    deferred.releaseSnapshot();
    await deferred.settled();
    assert.equal(f.saved.get("globalFavoritesSelection"), "0");
    assert.equal(f.browsing(), "provider:news");
    assert.equal(deferred.painted(), 0);
});

test("a missing channel library still opens and saves explicit Favorites", async () => {
    const f = fixture();
    const deferred = deferredFavorites(f);
    assert(f.host.openGlobalFavorites());
    await deferred.finish();
    assert.equal(deferred.painted(), 1);
    assert.equal(f.saved.get("globalFavoritesSelection"), "1");
    assert.deepEqual(f.messages, []);
    const restart = fixture(f.saved);
    restart.enter("m3u", "first");
    assert.equal(restart.open(), "system:favorites");
});

test("unmounted category handles cannot survive a mount followed by reset", () => {
    const f = fixture();
    const selection = f.host.__ottChannels.captureCategorySelection();
    const current = f.host.__ottChannels.captureCategoryCurrent();
    assert.equal(selection.current(), true);
    assert.equal(current(), true);
    f.enter("m3u", "first");
    f.host.__ottChannels.reset();
    assert.equal(selection.current(), false);
    assert.equal(current(), false);
    assert.equal(selection("system:favorites"), false);
    assert.equal(f.saved.has("globalFavoritesSelection"), false);
});

test("an unmounted async opening cannot repaint after mount and reset", async () => {
    const f = fixture();
    const deferred = deferredFavorites(f, true);
    assert(f.host.openGlobalFavorites());
    deferred.start();
    await Promise.race([
        deferred.snapshotReady,
        deferred.settled().then(() => {
            throw new Error("Favorites did not reach the view");
        }),
    ]);
    f.enter("m3u", "first");
    f.host.__ottChannels.reset();
    deferred.releaseSnapshot();
    await deferred.settled();
    assert.equal(deferred.painted(), 0);
});

test("an explicit Favorites opening reports refused persistence without painting", async () => {
    const f = fixture();
    f.enter("m3u", "first");
    f.browse("provider:news");
    f.host.stbSetItem = () => {};
    const deferred = deferredFavorites(f);
    f.browse("system:favorites");
    await assert.rejects(deferred.finish(), /category_save_failed/);
    assert.equal(deferred.painted(), 0);
    assert.equal(f.saved.get("globalFavoritesSelection"), "0");
    assert(f.messages.includes("Favorites: Unavailable"));
});

for (const explicit of [false, true]) {
    test(
        "Favorites playback does not select a category: explicit prior choice " +
            explicit,
        () => {
            const f = fixture();
            f.enter("m3u", "first");
            if (explicit) f.browse("provider:news");
            const saved = Array.from(f.saved);
            let routed = 0;
            let published = 0;
            Object.assign(f.host, {
                current: () => true,
                navigation: { routeState: () => routed++ },
                permitted: () => true,
                ports: { changed: () => published++ },
                router: {
                    captureCurrent: () => ({
                        current: () => true,
                        id: "chosen",
                    }),
                },
            });
            const changed = sourceNode(
                "src/media/global-favorites-host.ts",
                (n) =>
                    ts.isPropertyAssignment(n) && n.name.getText() === "changed"
            );
            runCode(
                f.host,
                "var playbackChanged = " +
                    changed.node.initializer.getText(changed.source)
            );
            f.host.playbackChanged({ id: "chosen", phase: "playing" });
            assert.equal(routed, 1);
            assert.equal(published, 1);
            assert.deepEqual(Array.from(f.saved), saved);
            const restart = fixture(f.saved);
            restart.enter("m3u", "first");
            assert.notEqual(restart.browsing(), "system:favorites");
        }
    );
}

for (const refusal of ["throw", "ignore", "memory-only"]) {
    test("failed global rollback is reported: " + refusal, () => {
        const f = fixture();
        f.enter("m3u", "first");
        f.browse("provider:news");
        const set = f.host.stbSetItem;
        const get = f.host.stbGetItem;
        let memory;
        f.host.stbGetItem = (key) => memory ?? get(key);
        f.host.stbSetItem = (key, value) => {
            if (value === "1") return set(key, value);
            if (refusal === "throw") throw new Error("rollback refused");
            if (refusal === "memory-only") memory = value;
        };
        f.host.providerSetItem = () => {
            throw new Error("source refused");
        };
        f.host.__ottChannels.mount(f.host);
        assert.equal(
            f.host.__ottChannels.rememberCategory("system:favorites"),
            false
        );
        assert.equal(f.saved.get("globalFavoritesSelection"), "1");
        assert(f.messages.includes("Favorites: Unavailable"));
    });
}

test("rollback verifies durable restoration even when the setter throws afterwards", () => {
    const f = fixture();
    f.enter("m3u", "first");
    f.browse("provider:news");
    const set = f.host.stbSetItem;
    f.host.stbSetItem = (key, value) => {
        set(key, value);
        if (value === "0") throw new Error("after durable restoration");
    };
    f.host.providerSetItem = () => {
        throw new Error("source refused");
    };
    f.host.__ottChannels.mount(f.host);
    assert.equal(
        f.host.__ottChannels.rememberCategory("system:favorites"),
        false
    );
    assert.equal(f.saved.get("globalFavoritesSelection"), "0");
    assert.deepEqual(f.messages, []);
});

test("unmounted category handles are invalidated by source identity changes", () => {
    const f = fixture();
    let source = "first";
    f.host.__ottSourceIdentity = { current: () => source };
    const selection = f.host.__ottChannels.captureCategorySelection();
    const current = f.host.__ottChannels.captureCategoryCurrent();
    source = "second";
    assert.equal(selection.current(), false);
    assert.equal(current(), false);
    assert.equal(selection("system:favorites"), false);
    assert.equal(f.saved.has("globalFavoritesSelection"), false);
});

test("a failed rollback removal of the first global choice is reported", () => {
    const f = fixture();
    f.enter("m3u", "first");
    f.host.stbDelItem = () => {};
    f.host.providerSetItem = () => {
        throw new Error("source refused");
    };
    f.host.__ottChannels.mount(f.host);
    assert.equal(
        f.host.__ottChannels.rememberCategory("system:favorites"),
        false
    );
    assert.equal(f.saved.get("globalFavoritesSelection"), "1");
    assert(f.messages.includes("Favorites: Unavailable"));
});
