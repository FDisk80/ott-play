const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const ts = require(path.join(root, "node_modules/typescript"));
function runSource(host, file) {
    vm.runInContext(
        ts.transpileModule(
            fs
                .readFileSync(path.join(root, file), "utf8")
                .replace(/^export /gm, ""),
            {
                compilerOptions: {
                    module: ts.ModuleKind.None,
                    target: ts.ScriptTarget.ES5,
                },
            }
        ).outputText,
        host
    );
}
const results = [];
function check(name, run) {
    try {
        run();
        results.push({ name, status: "PASS" });
    } catch (error) {
        results.push({ error: String(error), name, status: "FAIL" });
    }
}
const row = (id, locked = false) => ({
    groupId: "g",
    groupLabel: "News",
    id,
    itemId: "stream:" + id,
    label: "Channel " + id,
    locked,
});
function libraryFixture(seed = []) {
    const host = { window: {} };
    vm.createContext(host);
    runSource(host, "src/channels/library.ts");
    const saved = new Map(seed);
    const ports = {
        current: () => true,
        get: (key) => saved.get(key) ?? null,
        set: (key, value) => saved.set(key, value),
        sourceId: "source",
    };
    return {
        create: (rows) => host.window.__ottChannelLibrary.create(ports, rows),
        saved,
    };
}
check(
    "new protected records are locked after a saved empty-lock catalog",
    () => {
        const f = libraryFixture();
        f.create([row(11)]).persist();
        assert.deepEqual(
            Array.from(f.create([row(11), row(12, true)]).snapshot().locks),
            [12]
        );
    }
);
check(
    "explicit unlock survives refresh while another new adult record is locked",
    () => {
        const f = libraryFixture();
        let a = f.create([row(11, true)]);
        assert(a.lock(11, false));
        assert.deepEqual(
            Array.from(
                f.create([row(11, true), row(12, true)]).snapshot().locks
            ),
            [12]
        );
    }
);
check(
    "legacy manual lock and preference resolve when a missing record returns",
    () => {
        const f = libraryFixture([
            ["parentalArray", "[12]"],
            ["aAspects", '{"12":3}'],
        ]);
        f.create([row(11)]).persist();
        const a = f.create([row(11), row(12)]);
        assert.deepEqual(Array.from(a.snapshot().locks), [12]);
        assert.equal(a.preference("aspect", 12), 3);
    }
);
function favoritesFixture() {
    let source = "a",
        hook = null;
    const envelope = (id, item) =>
        JSON.stringify({
            lists: {
                active: "Main",
                lists: { Main: [item] },
                order: ["Main"],
                v: 1,
            },
            sourceId: id,
            version: 1,
        });
    const saved = new Map([
        ["a:favoritesLibrary:a", envelope("a", 11)],
        ["b:favoritesLibrary:b", envelope("b", 22)],
    ]);
    const host = {
        _: (s) => s,
        channels: {
            11: { itemId: "channel:11" },
            22: { itemId: "channel:22" },
        },
        providerGetItem(key) {
            const value = saved.get(source + ":" + key) ?? null;
            if (hook && key === "favoritesLibrary:a") {
                const fn = hook;
                hook = null;
                fn();
            }
            return value;
        },
        providerGetJson(key, fallback) {
            return (
                JSON.parse(saved.get(source + ":" + key) || "null") || fallback
            );
        },
        providerSetItem(key, value) {
            saved.set(source + ":" + key, value);
        },
    };
    host.window = host;
    vm.createContext(host);
    require(path.join(root, "tests/helpers/shared-core-runtime.cjs"))(host);
    host.__ottSourceIdentity = { current: () => source };
    runSource(host, "src/channels/favorites-lists.ts");
    return {
        host,
        reenter() {
            hook = () => {
                source = "b";
                host.loadFavoritesLists();
            };
        },
        saved,
    };
}
function assertB(f) {
    assert.deepEqual(Array.from(f.host.favoritesArray), [22]);
    assert.deepEqual(
        JSON.parse(f.saved.get("b:favoritesLibrary:b")).lists.lists.Main,
        [{ itemId: "channel:22" }]
    );
}
check("reentrant favorites load cannot erase the replacement source", () => {
    const f = favoritesFixture();
    f.reenter();
    f.host.loadFavoritesLists();
    assertB(f);
});
check(
    "reentrant favorites save cannot overwrite the replacement source",
    () => {
        const f = favoritesFixture();
        f.host.loadFavoritesLists();
        f.host.addFavoritesList("Extra");
        f.reenter();
        assert.equal(f.host.saveFavoritesLists(), false);
        assertB(f);
    }
);
check("unreadable favorites storage does not throw or permit writes", () => {
    const f = favoritesFixture();
    f.host.providerGetItem = () => {
        throw Error("storage blocked");
    };
    assert.doesNotThrow(() => f.host.loadFavoritesLists());
    assert.equal(f.host.saveFavoritesLists(), false);
});
function shuffleFixture() {
    const f = favoritesFixture();
    f.host.channels[33] = { itemId: "channel:33" };
    f.saved.set(
        "a:favoritesLibrary:a",
        JSON.stringify({
            lists: {
                active: "Main",
                lists: {
                    Main: [11, 44, 22, 33].map((id) => ({
                        itemId: "channel:" + id,
                    })),
                },
                order: ["Main"],
                v: 1,
            },
            sourceId: "a",
            version: 2,
        })
    );
    f.host.loadFavoritesLists();
    vm.runInContext("Math.random = function () { return 0; }", f.host);
    return f;
}
const readShuffle = (f) => JSON.parse(f.saved.get("a:favoritesLibrary:a"));
check(
    "favorites shuffle preserves hidden members, first baseline, reload and rename",
    () => {
        const f = shuffleFixture();
        const original = readShuffle(f).lists.lists.Main;
        assert.equal(f.host.shuffleFavoritesList(), true);
        assert.deepEqual(Array.from(f.host.favoritesArray), [22, 33, 11]);
        assert.equal(readShuffle(f).lists.lists.Main.length, 4);
        assert.deepEqual(readShuffle(f).shuffleBefore.Main, original);
        assert.equal(f.host.shuffleFavoritesList(), true);
        assert.deepEqual(readShuffle(f).shuffleBefore.Main, original);
        f.host.loadFavoritesLists();
        assert.equal(f.host.renameFavoritesList("Main", "Renamed"), true);
        assert.equal(f.host.saveFavoritesLists(), true);
        assert.deepEqual(readShuffle(f).shuffleBefore.Renamed, original);
        assert.equal(f.host.shuffleFavoritesList(true), true);
        assert.deepEqual(Array.from(f.host.favoritesArray), [11, 22, 33]);
        assert.deepEqual(readShuffle(f).lists.lists.Renamed, original);
        assert.equal(readShuffle(f).shuffleBefore, undefined);
        assert.equal(f.host.shuffleFavoritesList(true), false);
    }
);
check(
    "favorites reset retains additions and does not resurrect removed visible items",
    () => {
        const f = shuffleFixture();
        assert.equal(f.host.shuffleFavoritesList(), true);
        const view = f.host.activeFavoritesList();
        view.splice(view.indexOf(22), 1);
        f.host.channels[55] = { itemId: "channel:55" };
        view.push(55);
        assert.equal(f.host.saveFavoritesLists(), true);
        assert.equal(f.host.shuffleFavoritesList(true), true);
        assert.deepEqual(Array.from(f.host.favoritesArray), [11, 33, 55]);
        assert.deepEqual(
            readShuffle(f).lists.lists.Main.map((item) => item.itemId),
            ["channel:11", "channel:44", "channel:33", "channel:55"]
        );
    }
);
check(
    "favorites shuffle storage failure is atomic and does not publish a reordered view",
    () => {
        const f = shuffleFixture();
        const before = f.host.favoritesArray;
        const saved = f.saved.get("a:favoritesLibrary:a");
        f.host.providerSetItem = () => {
            throw Error("disk full");
        };
        // Rebind the source owner to this storage implementation before fault injection.
        f.host.loadFavoritesLists();
        assert.equal(f.host.shuffleFavoritesList(), false);
        assert.deepEqual(Array.from(f.host.favoritesArray), Array.from(before));
        assert.equal(f.saved.get("a:favoritesLibrary:a"), saved);
    }
);
check(
    "favorites reset resolves stable IDs after catalog renumbering and forgets deleted lists",
    () => {
        const f = shuffleFixture();
        assert.equal(f.host.shuffleFavoritesList(), true);
        f.host.channels = {
            101: { itemId: "channel:11" },
            102: { itemId: "channel:22" },
            103: { itemId: "channel:33" },
            104: { itemId: "channel:44" },
        };
        f.host.loadFavoritesLists();
        assert.equal(f.host.shuffleFavoritesList(true), true);
        assert.deepEqual(
            Array.from(f.host.favoritesArray),
            [101, 104, 102, 103]
        );
        assert.equal(f.host.shuffleFavoritesList(), true);
        assert.equal(f.host.addFavoritesList("Other"), true);
        assert.equal(f.host.deleteFavoritesList("Main"), true);
        assert.equal(f.host.saveFavoritesLists(), true);
        assert.equal(readShuffle(f).shuffleBefore, undefined);
        assert.equal(f.host.shuffleFavoritesList(true), false);
    }
);
check("favorites shuffle cannot publish over a replacement source", () => {
    const f = shuffleFixture();
    f.reenter();
    assert.equal(f.host.shuffleFavoritesList(), false);
    assertB(f);
    assert.equal(readShuffle(f).shuffleBefore, undefined);
});
function includeFunctions(host, file, names) {
    const source = ts.createSourceFile(
        file,
        fs.readFileSync(path.join(root, file), "utf8"),
        ts.ScriptTarget.Latest,
        true
    );
    const declarations = source.statements.filter(
        (node) =>
            ts.isFunctionDeclaration(node) && names.includes(node.name?.text)
    );
    assert.equal(declarations.length, names.length);
    vm.runInContext(
        ts
            .transpileModule(
                declarations.map((node) => node.getText(source)).join("\n"),
                {
                    compilerOptions: {
                        module: ts.ModuleKind.ES2015,
                        target: ts.ScriptTarget.ES5,
                    },
                }
            )
            .outputText.replace(/^export /gm, ""),
        host,
        { filename: file }
    );
}

function categoryStartupFixture(saved, options = {}) {
    const provider = options.provider || "m3u";
    const profile = options.profile || 0;
    const prefix = provider + ":" + profile + ":";
    const events = [];
    const favorites = options.favorites || [22];
    const panel = { hide() {}, html() {}, is: () => false };
    const host = {
        _: (value) => options.labels?.[value] || value,
        __ottActiveProviderDriver: {
            capabilities: { mediaPlaylist: provider !== "m3u" },
            configuration: () => ({ active: profile }),
            credentials: () => ({
                server: "https://profile-" + profile + ".test",
            }),
            id: provider,
        },
        __ottCatalogSelectedId: options.preferred,
        __ottOfflineProfiles: {
            namespace: () => "offline:" + profile,
            selection: () => options.localSelection ?? null,
        },
        $: () => panel,
        catIndex: Number(saved.get(prefix + "catIndex")) || 0,
        cats: {},
        catsArray: [],
        channels: {
            11: {
                category: { name: "News" },
                channel_name: "First",
                groupId: "provider:news",
                itemId: "channel:first",
            },
            22: {
                category: { name: "News" },
                channel_name: "Second",
                groupId: "provider:news",
                itemId: "channel:second",
            },
            33: {
                category: { name: "Films" },
                channel_name: "Third",
                groupId: "provider:films",
                itemId: "channel:third",
            },
        },
        channelsKeyHandler() {},
        cList: options.ids || [11, 22, 33],
        clearTimeout() {},
        console: {
            error: (error) => {
                throw error;
            },
        },
        curList: [],
        detailProg() {},
        document: { getElementById: () => null },
        favoritesArray: [],
        getViewportHeightScale: () => 1,
        getViewportWidthScale: () => 1,
        globalNumber: null,
        innerHeight: 720,
        keys: { ENTER: 13, POWER: 81 },
        listCaptionElement: {},
        listDetail: {},
        listFooter: {},
        loadEpgTimers() {},
        loadFavoritesLists() {
            host.favoritesArray = favorites.slice();
        },
        m3uArr: {
            active: profile,
            M3Us: [
                { name: "Local", www: "https://first.test/list" },
                { name: "Other", www: "https://second.test/list" },
            ],
        },
        medHistory: [],
        p_pref: provider,
        playTime: 0,
        playType: 0,
        prevArr: [],
        primaryIndex: Number(saved.get(prefix + "primaryIndex")) || 0,
        providerGetItem: (key) => saved.get(prefix + key) ?? null,
        providerSetItem: (key, value) => saved.set(prefix + key, value),
        renderButtonHint: () => "",
        sArrowFun: 0,
        setPopupChannels() {},
        setTimeout() {},
        settings: { pageSize: 10, prevCount: 2 },
        sFavorites: options.mode ?? 0,
        showPage() {
            host.isListVisible = true;
        },
        sPNFun: 0,
        sRewFun: 0,
        stbExit: () => events.push("exit"),
        stbGetLen: () => 600,
        stbGetPosTime: () => 37,
        stbStop: () => events.push("stop"),
        stbStopPip: () => events.push("stop-pip"),
        strEPG: "",
        strInfo: "",
        strPlayPause: "",
        strTools: "",
    };
    host.window = host;
    vm.createContext(host);
    require("./helpers/shared-core-runtime.cjs")(host);
    require("./helpers/category-selector-runtime.cjs")(host);
    includeFunctions(host, "src/channels/index.ts", [
        "setCurrent",
        "onChannelsLoaded",
        "restoreContinueWatch",
        "bucketsKeyHandler",
        "playingChannelIdxInCategory",
    ]);
    includeFunctions(host, "src/provider/index.ts", ["_channelsList"]);
    includeFunctions(host, "src/commands/global-favorites.ts", [
        "openGlobalFavorites",
    ]);
    includeFunctions(host, "src/index.ts", ["body_onUnload"]);
    includeFunctions(host, "src/key-handler/index.ts", [
        "handleMainKey",
        "toggleMainPlayback",
    ]);
    host.channelsList = host._channelsList;
    host.globalFavoriteAction = (action) => {
        assert.equal(action, "open");
        host._channelsList(0, 0, {
            categoryName: host._("Favorites"),
            channel: (id) => host.channels[id],
            detail() {},
            id: "system:global-favorites",
            key() {},
            rows: favorites.slice(),
        });
        events.push("favorites");
        return true;
    };
    host.playChannel = (category, index, _pip, _automatic, resume) => {
        const id = host.cats[host.catsArray[category]]?.[index];
        assert.notEqual(
            id,
            undefined,
            "startup chooses a current catalog item"
        );
        host.setCurrent(category, index);
        host.__ottClassicPlayback.command({ channelId: id, type: "live" });
        host.__ottClassicPlayback.command({
            duration: 600,
            generation: host.__ottClassicPlayback.snapshot().generation,
            position: resume?.position ?? 37,
            type: "playing",
        });
        events.push(["play", host.__ottChannels.group(category), id]);
        return true;
    };
    return {
        browse(group) {
            host.selIndex = host.__ottChannels.index(group);
            assert(host.selIndex >= 0);
            host.bucketsKeyHandler(host.keys.ENTER);
        },
        events,
        host,
        launch: () => host.onChannelsLoaded(),
        open() {
            host.handleMainKey(host.keys.ENTER, {
                key: "Enter",
                preventDefault() {},
                stopPropagation() {},
            });
        },
        play(group, id) {
            const category = host.__ottChannels.index(group);
            const index = host.cats[host.catsArray[category]].indexOf(id);
            host.playChannel(category, index);
        },
        quit() {
            host.handleMainKey(81, {
                key: "q",
                preventDefault() {},
                stopPropagation() {},
            });
            assert.deepEqual(events.slice(-3), ["stop", "stop-pip", "exit"]);
        },
        selection() {
            return [
                host.__ottChannels.group(host.catIndex),
                host.curList[host.primaryIndex],
            ];
        },
    };
}

for (const provider of ["m3u", "offline", "plex", "vportal"]) {
    for (const mode of [0, 1, -1]) {
        check(
            `${provider} browsing Favorites survives quit without changing playback in mode ${mode}`,
            () => {
                const saved = new Map();
                const options = { mode, provider };
                const first = categoryStartupFixture(saved, options);
                first.launch();
                first.play("provider:films", 33);
                first.browse("system:favorites");
                assert.deepEqual(first.selection(), ["provider:films", 33]);
                assert.deepEqual(Array.from(first.host.listArray), [22]);
                first.quit();
                const next = categoryStartupFixture(saved, {
                    ...options,
                    localSelection: provider === "offline" ? 33 : null,
                    preferred: provider === "m3u" ? undefined : 33,
                });
                next.launch();
                assert.deepEqual(next.selection(), ["provider:films", 33]);
                assert.equal(
                    next.host.isListVisible,
                    false,
                    "startup remains in playback"
                );
                next.open();
                assert.equal(
                    next.host.isListVisible,
                    true,
                    "remembered category reopens"
                );
                assert.equal(next.events.at(-1), "favorites");
                assert.deepEqual(Array.from(next.host.listArray), [22]);
            }
        );
    }
}

check(
    "M3U presets retain independent browsing categories across quit and relaunch",
    () => {
        const saved = new Map();
        for (const [profile, group] of [
            [0, "system:favorites"],
            [1, "provider:news"],
        ]) {
            const first = categoryStartupFixture(saved, { profile });
            first.launch();
            first.play("provider:films", 33);
            first.browse(group);
            first.quit();
        }
        for (const [profile, label, rows] of [
            [0, "Favorites", [22]],
            [1, "News", [11, 22]],
        ]) {
            const next = categoryStartupFixture(saved, { profile });
            next.launch();
            assert.deepEqual(next.selection(), ["provider:films", 33]);
            assert.equal(next.host.isListVisible, false);
            next.open();
            assert.equal(next.host.isListVisible, true);
            assert.equal(
                next.host.listCaptionElement.textContent,
                "Channel list. Category: " + label
            );
            assert.deepEqual(Array.from(next.host.listArray), rows);
        }
    }
);

check(
    "remembered Favorites follows its identity after language and category position change",
    () => {
        const saved = new Map();
        const first = categoryStartupFixture(saved, { mode: 1 });
        first.launch();
        first.play("provider:films", 33);
        first.browse("system:favorites");
        first.quit();
        const next = categoryStartupFixture(saved, {
            labels: { All: "Tous", Favorites: "Favoris" },
            mode: 0,
        });
        next.launch();
        next.open();
        assert.equal(
            next.host.listCaptionElement.textContent,
            "Channel list. Category: Favoris"
        );
        assert.deepEqual(Array.from(next.host.listArray), [22]);
    }
);

check(
    "a first launch does not open a category until the user has browsed one",
    () => {
        const first = categoryStartupFixture(new Map());
        first.launch();
        assert.equal(first.host.isListVisible, false);
        assert.equal(first.events.includes("favorites"), false);
    }
);

check("empty Favorites remains the browsed category after quit", () => {
    const saved = new Map();
    const first = categoryStartupFixture(saved);
    first.launch();
    first.play("provider:films", 33);
    first.browse("system:favorites");
    first.quit();
    const next = categoryStartupFixture(saved, { favorites: [] });
    next.launch();
    assert.deepEqual(next.selection(), ["provider:films", 33]);
    next.open();
    assert.equal(next.events.at(-1), "favorites");
    assert.deepEqual(Array.from(next.host.listArray), []);
});

check(
    "missing provider categories fall back to All without changing playback",
    () => {
        const saved = new Map();
        const first = categoryStartupFixture(saved);
        first.launch();
        first.play("provider:films", 33);
        first.browse("provider:news");
        first.quit();
        const next = categoryStartupFixture(saved, { ids: [33] });
        next.launch();
        assert.deepEqual(next.selection(), ["provider:films", 33]);
        next.open();
        assert.equal(
            next.host.listCaptionElement.textContent,
            "Channel list. Category: All"
        );
        assert.deepEqual(Array.from(next.host.listArray), [33]);
        assert.equal(
            next.host.__ottChannels.document().browsedGroup,
            "provider:news"
        );
        next.browse("provider:films");
        assert.equal(
            next.host.__ottChannels.document().browsedGroup,
            "provider:films"
        );
    }
);

for (const gate of ["standby", "kiosk", "prompt"]) {
    check(`category restoration preserves an active ${gate}`, () => {
        const saved = new Map();
        const first = categoryStartupFixture(saved);
        first.launch();
        first.browse("system:favorites");
        first.quit();
        const next = categoryStartupFixture(saved);
        if (gate === "standby")
            next.host.__ottStandby = { blocked: () => true };
        if (gate === "kiosk") next.host.__ottKiosk = { enabled: () => true };
        if (gate === "prompt")
            next.host.__ottClassicScreenPort.screens.current = () => ({
                kind: "dialog",
            });
        next.launch();
        assert.equal(next.host.__ottChannels.restoreBrowsing(), false);
        assert.equal(next.events.includes("favorites"), false);
    });
}

check(
    "failed category persistence leaves the prior browse and playback selection intact",
    () => {
        const saved = new Map();
        const first = categoryStartupFixture(saved);
        first.launch();
        first.play("provider:films", 33);
        first.browse("system:favorites");
        first.quit();
        const before = Array.from(saved);
        const next = categoryStartupFixture(saved);
        next.host.providerSetItem = () => {
            throw Error("storage full");
        };
        next.host.loadFavoritesLists();
        next.host.__ottChannels.mount(next.host);
        assert.equal(
            next.host.__ottChannels.rememberCategory("provider:news"),
            false
        );
        assert.equal(
            next.host.__ottChannels.group(
                next.host.__ottChannels.browsingIndex()
            ),
            "system:favorites"
        );
        assert.deepEqual(next.selection(), ["provider:films", 33]);
        assert.deepEqual(Array.from(saved), before);
    }
);

console.log(JSON.stringify({ results, root }, null, 2));
if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
