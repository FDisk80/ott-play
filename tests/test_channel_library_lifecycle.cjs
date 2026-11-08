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

function shelvesFixture(options = {}) {
    const f = categoryStartupFixture(new Map(), options);
    includeFunctions(f.host, "src/ui/modern.ts", [
        "createModernCatalogShelves",
    ]);
    const shelves = f.host.createModernCatalogShelves(f.host);
    f.getShelves = () => shelves(f.host.getListItemFn);
    f.host.showPage = () => f.host.__ottClassicScreenPort.commitList();
    f.host.loadFavoritesLists();
    f.host.__ottChannels.mount(f.host);
    f.host.channelsList(f.host.__ottChannels.index("system:all"), 0);
    return f;
}
check(
    "catalog shelves reuse the host snapshot and focus an exact category occurrence without playback",
    () => {
        const { host, events, getShelves } = shelvesFixture();
        const shelves = getShelves();
        const snapshot = host.__ottChannels.remoteCatalog();
        assert.equal(
            host.getListItemFn.__ottCatalog.categoryIndex,
            host.__ottChannels.index("system:all")
        );
        assert.equal(host.getListItemFn.__ottCatalog.channelSource, snapshot);
        assert.equal(host.getListItemFn.__ottCatalog.shelves, undefined);
        assert.equal(
            getShelves(),
            shelves,
            "same owner reuses lazy capability"
        );
        assert.equal(shelves.source, snapshot);
        assert.equal(shelves.groups, snapshot.groups);
        assert.equal(shelves.selected, "system:all");
        const playing = [host.catIndex, host.primaryIndex, host.curList];
        assert.equal(shelves.focus("provider:news", 1), true);
        assert.equal(host.listArray[host.selIndex], 22);
        assert.equal(getShelves().selected, "provider:news");
        assert.equal(getShelves().groups, snapshot.groups);
        assert.deepEqual(
            [host.catIndex, host.primaryIndex, host.curList],
            playing
        );
        assert.deepEqual(events, []);
        assert.equal(
            shelves.focus("provider:films", 0),
            false,
            "retired formatter cannot move selection"
        );
    }
);
check(
    "shelf category indices preserve the captured host order across Favorites modes",
    () => {
        for (const mode of [-1, 0, 1]) {
            const { host, getShelves } = shelvesFixture({ mode });
            const snapshot = host.__ottChannels.remoteCatalog();
            snapshot.groups.forEach((group, index) => {
                assert.equal(group.id, host.__ottChannels.group(index));
                assert.deepEqual(
                    Array.from(group.members),
                    Array.from(host.cats[host.catsArray[index]])
                );
            });
            assert.equal(getShelves().selected, "system:all");
            assert.equal(getShelves().focus("provider:news", 1), true);
            assert.equal(getShelves().selected, "provider:news");
        }
    }
);
check(
    "shelves rebind the current shuffled snapshot without reviving the old capability",
    () => {
        const { host, getShelves } = shelvesFixture({ provider: "vportal" });
        includeFunctions(host, "src/channels/index.ts", ["shuffleChannelList"]);
        host.isCategorySelectionList = () => false;
        host.sortChannels = () => {};
        vm.runInContext("Math.random = function () { return 0; }", host);
        const formatter = host.getListItemFn;
        const before = getShelves();
        host.shuffleChannelList();
        assert.equal(host.getListItemFn, formatter);
        assert.equal(before.source.active(), false);
        const current = getShelves();
        assert.equal(current.source, host.__ottChannels.remoteCatalog());
        assert.deepEqual(
            Array.from(
                current.groups.find((group) => group.id === "system:all")
                    .members
            ),
            Array.from(host.listArray)
        );
        assert.notDeepEqual(Array.from(host.listArray), [11, 22, 33]);
        assert.equal(before.focus("provider:news", 0), false);
        assert.equal(current.focus("provider:news", 0), true);
    }
);
check(
    "shelves rebind progressive append with the same formatter and ScreenPort owner",
    () => {
        const { host, getShelves } = shelvesFixture({ provider: "vportal" });
        const formatter = host.getListItemFn;
        const owner = host.__ottClassicScreenPort.listOwner();
        const before = getShelves();
        host.channels[44] = {
            category: { name: "News" },
            channel_name: "Fourth",
            groupId: "provider:news",
            itemId: "channel:fourth",
        };
        host.cList.push(44);
        host.__ottChannels.append([44]);
        assert.equal(host.getListItemFn, formatter);
        assert.equal(host.__ottClassicScreenPort.listOwner(), owner);
        assert.deepEqual(Array.from(host.listArray), [11, 22, 33, 44]);
        const current = getShelves();
        assert.equal(current.source, host.__ottChannels.remoteCatalog());
        assert.equal(before.focus("provider:news", 1), false);
        assert.equal(current.focus("provider:news", 2), true);
        assert.equal(host.listArray[host.selIndex], 44);
    }
);
check(
    "shelves cannot rebind a remounted source with identical channel IDs",
    () => {
        const { host, getShelves } = shelvesFixture({ provider: "vportal" });
        const formatter = host.getListItemFn;
        const before = getShelves();
        host.__ottChannels.mount(host);
        host.listArray = host.listDataArray =
            host.cats[host.catsArray[host.listCatIndex]];
        host.showPage();
        assert.equal(host.getListItemFn, formatter);
        assert.deepEqual(Array.from(host.listArray), [11, 22, 33]);
        assert.notEqual(
            before.source.generation,
            host.__ottChannels.remoteCatalog().generation
        );
        assert.equal(getShelves(), undefined);
        assert.equal(before.focus("provider:news", 0), false);
    }
);
for (const gate of [
    "modal",
    "enabled",
    "locked",
    "refresh",
    "members",
    "row",
    "formatter",
]) {
    check("catalog shelf focus rejects stale or blocked " + gate, () => {
        const { host, getShelves } = shelvesFixture();
        const shelves = getShelves();
        const group = shelves.groups.find((row) => row.id === "provider:news");
        if (gate === "modal")
            host.__ottClassicScreenPort.openOverlay("dialog", () => {});
        if (gate === "enabled" || gate === "locked")
            host.__ottKiosk = { [gate]: () => true };
        if (gate === "refresh") host.__ottChannels.refresh();
        if (gate === "members") group.members = group.members.slice();
        if (gate === "row") group.members[1] = 33;
        if (gate === "formatter") host.getListItemFn = () => "replacement";
        const before = [host.listArray, host.selIndex];
        assert.equal(shelves.focus("provider:news", 1), false);
        assert.deepEqual([host.listArray, host.selIndex], before);
    });
}
check(
    "shelves reject invalid indices and provider views never inherit the global catalog",
    () => {
        const { host, getShelves } = shelvesFixture();
        const shelves = getShelves();
        for (const index of [-1, 0.5, 2, NaN, Infinity, "1"])
            assert.equal(shelves.focus("provider:news", index), false);
        assert.equal(shelves.focus("missing", 0), false);
        assert.equal(shelves.focus("system:favorites", 0), false);
        host._channelsList(0, 0, {
            categoryName: "Provider view",
            channel: () => ({}),
            detail() {},
            key() {},
            picon: () => "",
            playing: () => false,
            rows: ["private-row"],
        });
        assert.equal(getShelves(), undefined);
    }
);
check(
    "Plex shelves preserve repeated occurrences and route Enter through the current owned handler",
    () => {
        const { host, getShelves } = shelvesFixture();
        runSource(host, "src/plugins/plex-list.ts");
        const selected = [],
            highlighted = [];
        let revision = 1,
            active = true;
        const frame = {
            items: [0, 1, 2].map((index) => ({
                payload: {
                    __ottMediaCategories: [
                        {
                            id: index ? "films" : "animation",
                            name: index ? "Films" : "Animation",
                        },
                    ],
                    title: "Film " + index,
                },
                ref: {
                    itemId: index ? "repeat" : "first",
                    sourceId: "plex@test",
                },
            })),
            route: { kind: "catalog" },
            selected: 0,
        };
        host.__ottChannelListView = {
            detail() {},
            show: (view) => host._channelsList(0, view.selected, view),
        };
        host.__ottCategoryListView = {};
        const ports = {
            api: { select: (index) => selected.push(index) },
            bindScreen() {},
            current: () => active,
            host,
            journal: { peek: () => ({ document: { favorites: [] } }) },
            library: {
                highlight: (index) => highlighted.push(index),
                revision: () => revision,
            },
            playable: () => true,
            playback: () => null,
            rendering() {},
            source: "plex@test",
            title: (item) => item.title,
        };
        assert.equal(
            host.__ottPlexList.create(ports).render({ frame, revision: 1 }),
            true
        );
        // Exercise the provider capability directly, before Modern validates it.
        const rawShelves = host.getListItemFn.__ottCatalog.shelves;
        const originalFormatter = host.getListItemFn;
        const highlightsBefore = highlighted.length;
        const nonNumber = {
            valueOf() {
                assert.fail("Plex shelf indices must not coerce objects");
            },
        };
        for (const index of [
            NaN,
            Infinity,
            -Infinity,
            -1,
            -0.5,
            0.5,
            2,
            "0",
            undefined,
            null,
            false,
            true,
            [],
            nonNumber,
            Symbol("index"),
            0n,
        ])
            assert.equal(rawShelves.focus("folder:films", index), false);
        assert.equal(host.getListItemFn, originalFormatter);
        assert.equal(highlighted.length, highlightsBefore);
        assert.deepEqual(selected, []);
        assert.equal(rawShelves.focus("folder:films", -0), true);
        assert.equal(host.selIndex, 0);
        assert.equal(host.listArray[host.selIndex], "plex-row-1");
        assert.deepEqual(
            selected,
            [],
            "index validation never starts playback"
        );
        const before = getShelves();
        assert.equal(before.source, frame);
        before.groups.find(
            (group) => group.id === "folder:films"
        ).members.indexOf = () => {
            throw Error("shelf focus must reuse its validated member index");
        };
        assert.equal(before.focus("folder:films", 1), true);
        const current = getShelves();
        assert.equal(current.source, frame);
        assert.equal(current.groups, before.groups);
        assert.equal(host.listArray[host.selIndex], "plex-row-2");
        assert.equal(highlighted.at(-1), 2);
        assert.deepEqual(selected, []);
        assert.equal(before.focus("folder:animation", 0), false);
        assert.equal(host.listKeyHandlerFn(host.keys.ENTER), true);
        assert.deepEqual(selected, [2]);
        revision++;
        assert.equal(current.focus("system:all", 0), false);
        revision--;
        active = false;
        assert.equal(current.focus("system:all", 0), false);
        active = true;
        const item = frame.items[2];
        frame.items[2] = { ...item };
        assert.equal(current.focus("folder:films", 1), false);
        frame.items[2] = item;
        host.__ottKiosk = { enabled: () => true };
        assert.equal(current.focus("system:all", 0), false);
    }
);

console.log(JSON.stringify({ results, root }, null, 2));
if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
