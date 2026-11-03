"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { actualModule } = require("./helpers/global-favorites-main-ports.cjs");
function load(file, supplied = {}) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
        },
    }).outputText;
    vm.runInNewContext(code, {
        Array,
        Error,
        exports,
        isFinite,
        JSON,
        Math,
        Number,
        Object,
        Promise,
        require(name) {
            if (name === "./global-favorites-providers")
                return actualModule(
                    "src/media/global-favorites-providers.ts",
                    {}
                );
            if (!(name in supplied))
                throw new Error("Unprovided dependency " + name);
            return supplied[name];
        },
        String,
        window: {},
    });
    return exports;
}
const codec = load(
    "src/settings/global-favorites-portable.ts"
).createGlobalFavoritesPortableCodec();
const create = load(
    "src/media/global-favorites-router.ts"
).createGlobalFavoritesRouter;
function deferred() {
    let resolve;
    const promise = new Promise((done) => (resolve = done));
    return { promise, resolve };
}
async function flush() {
    for (let i = 0; i < 15; i++) await Promise.resolve();
}
function fixture(provider = "m3u") {
    let now = 0,
        current = true,
        snapshotCurrent = true,
        targetCurrent = true,
        plays = 0,
        releases = 0,
        timer;
    const origin = {
        profile: "Second",
        provider,
        sourceAlias: "Source",
        subprofile: null,
    };
    const locator =
        provider === "plex"
            ? { kind: "plex-media", ratingKey: "42", serverId: "PMS" }
            : provider === "local"
              ? {
                    kind: "local-media",
                    relativePath: "Dir/file.mp4",
                    rootAlias: "Root",
                }
              : provider === "vportal"
                ? { id: "42", idField: "id", kind: "vportal-media" }
                : { channelId: "m3u-epg:news", kind: "channel" };
    const row = {
        id: "00000000-0000-4000-8000-000000000001",
        locator,
        origin,
        title: "Title",
    };
    const target = { current: () => targetCurrent, origin };
    const session = {
        complete() {},
        current: () => targetCurrent,
        origin,
        play: async () => {
            plays++;
            return true;
        },
        release: () => releases++,
        resolve: async () => ({ available: true, locator }),
    };
    const ports = {
        activate: async () => session,
        allowed: () => current,
        changed() {},
        clearTimer() {},
        codec,
        current: () => current,
        now: () => now,
        setTimer: (fn) => {
            timer = fn;
            return 1;
        },
        snapshot: async () => ({
            current: () => snapshotCurrent,
            entries: [row],
            revision: "r1",
        }),
        targets: async () => [target],
    };
    return {
        block: () => (current = false),
        expire: () => {
            now = 30000;
            timer();
        },
        plays: () => plays,
        ports,
        releases: () => releases,
        router: create(ports),
        row,
        session,
        staleStore: () => (snapshotCurrent = false),
        staleTarget: () => (targetCurrent = false),
        target,
    };
}
const cases = [];
function test(name, run) {
    cases.push([name, run]);
}
for (const provider of ["m3u", "plex", "vportal", "local"])
    test(
        "exact " + provider + " locator reaches only selected origin",
        async () => {
            const f = fixture(provider),
                result = await f.router.select(f.row.id).result;
            assert.equal(result.status, "ok");
            assert.equal(f.plays(), 1);
        }
    );
test("duplicate descriptor never picks the first profile", async () => {
    const f = fixture();
    f.ports.targets = async () => [f.target, f.target];
    assert.equal((await f.router.select(f.row.id).result).status, "ambiguous");
    assert.equal(f.plays(), 0);
});
test("missing profile remains unresolved without activation", async () => {
    const f = fixture();
    f.ports.targets = async () => [];
    f.ports.activate = () => {
        throw new Error("must not activate");
    };
    assert.equal((await f.router.select(f.row.id).result).status, "missing");
});
test("cancel during acquisition releases the late owner once", async () => {
    const f = fixture(),
        pending = deferred();
    f.ports.activate = () => pending.promise;
    const request = f.router.select(f.row.id);
    await flush();
    request.cancel();
    pending.resolve(f.session);
    await flush();
    assert.equal((await request.result).status, "cancelled");
    assert.equal(f.plays(), 0);
    assert.equal(f.releases(), 1);
});
test("source replacement, list revision and policy change fence a late resolution", async () => {
    for (const change of ["staleStore", "staleTarget", "block"]) {
        const f = fixture(),
            pending = deferred();
        f.session.resolve = () => pending.promise;
        const request = f.router.select(f.row.id);
        await flush();
        f[change]();
        pending.resolve({ available: true, locator: f.row.locator });
        await flush();
        assert.notEqual((await request.result).status, "ok");
        assert.equal(f.plays(), 0);
    }
});
test("wrong server item returned by resolver cannot play", async () => {
    const f = fixture("plex");
    f.session.resolve = async () => ({
        available: true,
        locator: { ...f.row.locator, ratingKey: "43" },
    });
    assert.equal(
        (await f.router.select(f.row.id).result).status,
        "unavailable"
    );
    assert.equal(f.plays(), 0);
});
test("whole handoff deadline cancels pending resolution without retry", async () => {
    const f = fixture();
    f.session.resolve = () => new Promise(() => {});
    const request = f.router.select(f.row.id);
    await flush();
    f.expire();
    assert.equal((await request.result).status, "timeout");
    assert.equal(f.plays(), 0);
    assert.equal(f.releases(), 1);
});
test("numeric renderer fallback is never portable identity", () => {
    const helpers = load("src/media/global-favorites-identities.ts");
    assert.equal(
        helpers.globalFavoriteChannelId("m3u", {
            epg: "guessed",
            itemId: "channel:42",
        }),
        null
    );
    assert.equal(
        helpers.globalFavoriteChannelId("m3u", {
            __ottFavoriteTvgId: "Exact.ID",
        }),
        "m3u-epg:Exact.ID"
    );
    assert.equal(helpers.globalFavoriteProviderId(9007199254740992), null);
    assert.equal(helpers.globalFavoriteProviderId(1.5), null);
});
test("actual M3U driver preserves explicit tvg-id and not a title fallback", () => {
    const make = require("./helpers/m3u-driver-fixture.cjs");
    const f = make(),
        driver = f.start();
    let completed = false;
    f.host.getChannelsArray(() => (completed = true));
    f.requests[0].resolve(
        '#EXTM3U\n#EXTINF:-1 tvg-id="Stable.ID",One\nhttps://media.test/one\n#EXTINF:-1,Two\nhttps://media.test/two\n'
    );
    assert.equal(completed, true);
    assert.equal(
        f.host.channels[f.host.cList[0]].__ottFavoriteTvgId,
        "Stable.ID"
    );
    assert.equal(f.host.channels[f.host.cList[1]].__ottFavoriteTvgId, "");
});
test("actual capture prefers an explicit identity, otherwise exact unique name/group", async () => {
    const identities = load("src/media/global-favorites-identities.ts");
    const capture = load("src/media/global-favorites-capture.ts", {
        "./global-favorites-identities": identities,
    }).captureGlobalFavorite;
    const state = {
        generation: 1,
        phase: "playing",
        target: { channelId: 7, kind: "live", sourceId: "source" },
    };
    const w = {
        __ottActiveProviderDriver: {
            configuration: () => ({ active: 0 }),
            id: "m3u",
        },
        __ottChannelReferences: {
            create: () => ({
                project: () => 7,
                resolve: () => ({ itemId: "channel:7" }),
            }),
        },
        __ottClassicPlayback: { snapshot: () => state },
        __ottCommandChannelLoad: {},
        __ottSourceIdentity: { current: () => "source" },
        channels: {
            7: { category: { name: "A" }, channel_name: "News" },
            8: { category: { name: "B" }, channel_name: "News" },
        },
        cList: [7, 8],
    };
    const player = {
        allowed: () => true,
        captureSelector: async () => ({ bound: true }),
        selected: () => ({ name: "Profile" }),
    };
    const captured = await capture(w, player, codec);
    assert.deepEqual(JSON.parse(JSON.stringify(captured.value.locator)), {
        group: "A",
        kind: "channel-name",
        name: "News",
    });
    w.channels[8].category.name = "A";
    assert.equal(
        await capture(w, player, codec),
        null,
        "duplicate exact name/group is unresolved"
    );
    w.channels[7].__ottFavoriteTvgId = "explicit";
    assert.equal(
        (await capture(w, player, codec)).value.locator.channelId,
        "m3u-epg:explicit"
    );
});
test("actual VPortal capture requires source-owned ID attestation", async () => {
    const identities = load("src/media/global-favorites-identities.ts");
    const capture = load("src/media/global-favorites-capture.ts", {
        "./global-favorites-identities": identities,
    }).captureGlobalFavorite;
    const w = {
        __ottActiveProviderDriver: {
            configuration: () => ({ active: 1 }),
            id: "vportal",
        },
        __ottClassicPlayback: { snapshot: () => ({ generation: 3 }) },
        __ottCommandChannelLoad: {},
        __ottSourceIdentity: { current: () => "source", media: () => "media" },
    };
    const player = {
        allowed: () => true,
        captureSelector: async () => ({ bound: true }),
        selected: () => ({ name: "Second" }),
    };
    const payload = { id: "42", title: "Film", vportalSource: "media" };
    assert.equal(await capture(w, player, codec, payload), null);
    payload.__ottFavoriteId = { field: "id", value: "42" };
    w.cList = [7];
    w.channels = { 7: { __ottMediaItem: payload } };
    assert.equal(
        (await capture(w, player, codec, payload)).value.locator.id,
        "42"
    );
    payload.__ottMediaCategory = { name: "Films / Series" };
    payload.__ottMediaCategories = [payload.__ottMediaCategory];
    assert.equal(
        (await capture(w, player, codec, payload)).value.origin.subprofile,
        "Films / Series"
    );
    w.cList.push(8);
    w.channels[8] = { __ottMediaItem: payload };
    assert.equal(
        await capture(w, player, codec, payload),
        null,
        "ambiguous provider ID is not captured"
    );
    w.cList.pop();
    w.__ottActiveProviderDriver.catalogLoading = () => true;
    assert.equal(
        await capture(w, player, codec, payload),
        null,
        "a partial recursive catalog cannot prove unique identity"
    );
    w.__ottActiveProviderDriver.catalogLoading = () => false;
    payload.vportalSource = "foreign";
    assert.equal(await capture(w, player, codec, payload), null);
});
test("actual Local capture uses exact bound root and relative path", async () => {
    const identities = load("src/media/global-favorites-identities.ts");
    const capture = load("src/media/global-favorites-capture.ts", {
        "./global-favorites-identities": identities,
    }).captureGlobalFavorite;
    let same = true;
    const w = {
        __ottActiveProviderDriver: { configuration: () => null, id: "offline" },
        __ottClassicPlayback: {
            snapshot: () => ({
                generation: 3,
                target: { channelId: "local-one" },
            }),
        },
        __ottCommandChannelLoad: {},
        __ottLocalMedia: {
            favoriteSnapshot: () => ({
                catalog: {
                    items: [
                        {
                            available: true,
                            id: "one",
                            name: "Folder/file.mp4",
                            sourceId: "root",
                        },
                    ],
                    sources: [{ id: "root", kind: "folder", name: "Movies" }],
                },
                current: () => same,
            }),
        },
        __ottOfflineProfiles: { read: () => ({ active: -1 }) },
        __ottSourceIdentity: { current: () => "source" },
    };
    const player = {
        allowed: () => true,
        captureSelector: async () => ({ bound: true }),
        localItemRelativePath: actualModule("src/offline/local-item-path.ts", w)
            .localItemRelativePath,
        selected: () => ({ default: true }),
    };
    const result = await capture(w, player, codec);
    assert.equal(result.value.locator.relativePath, "Folder/file.mp4");
    assert.equal(result.root.id, "root");
    same = false;
    assert.equal(
        await capture(w, player, codec),
        null,
        "changed catalog is not captured"
    );
});
test("actual Plex capture pins verified server and current source", async () => {
    const ids = load("src/media/global-favorites-identities.ts"),
        capture = load("src/media/global-favorites-capture.ts", {
            "./global-favorites-identities": ids,
        }).captureGlobalFavorite;
    let verified = true;
    const w = {
        __ottActiveProviderDriver: {
            configuration: () => ({}),
            favoritesSource: () => ({
                current: () => verified,
                serverId: "PMS-A",
            }),
            id: "plex",
        },
        __ottClassicPlayback: { snapshot: () => ({ generation: 1 }) },
        __ottCommandChannelLoad: {},
        __ottSourceIdentity: { current: () => "source", media: () => "media" },
    };
    const player = {
        allowed: () => true,
        captureSelector: async () => ({}),
        selected: () => ({}),
    };
    const payload = {
        plexSource: "media",
        request: { path: "/library/metadata/42" },
        title: "Film",
    };
    assert.equal(
        (await capture(w, player, codec, payload)).value.locator.serverId,
        "PMS-A"
    );
    verified = false;
    assert.equal(await capture(w, player, codec, payload), null);
    verified = true;
    payload.plexSource = "foreign";
    assert.equal(await capture(w, player, codec, payload), null);
});
test("global empty category is localized and a stale async open cannot reopen UI", async () => {
    const make = load(
        "src/media/global-favorites-view.ts"
    ).createGlobalFavoritesView;
    let active = true,
        shown = 0,
        descriptor;
    const pending = deferred();
    const navigation = load(
        "src/media/global-favorites-navigation.ts"
    ).createGlobalFavoritesNavigation({
        allowed: () => true,
        cancel() {},
        capture: () => null,
        current: () => true,
        failed() {
            throw Error("unexpected navigation failure");
        },
        identity: (value) => codec.identity(value),
        select: () => {
            throw Error("empty view must not dispatch");
        },
        snapshot: async () => ({ current: () => true, entries: [] }),
    });
    const ports = {
        captureScreen: () => () => active,
        current: () => true,
        describe: () => "",
        error: () => {
            throw Error("unexpected");
        },
        navigation,
        router: {},
        show: (view) => {
            shown++;
            descriptor = view;
            return () => true;
        },
        store: { snapshot: () => pending.promise },
        translate: (text) => (text === "Favorites" ? "Избранное" : text),
    };
    const view = make(ports);
    assert.equal(view.category().id, "system:global-favorites");
    assert.equal(view.category().label, "Избранное");
    const first = view.open();
    active = false;
    pending.resolve({ current: () => true, entries: [], unresolvedLegacy: [] });
    await first;
    assert.equal(shown, 0);
    active = true;
    ports.store.snapshot = async () => ({
        current: () => true,
        entries: [],
        unresolvedLegacy: [],
    });
    await view.open();
    assert.equal(shown, 1);
    assert.equal(descriptor.rows.length, 0);
});
function playbackBindingFixture(provider) {
    const valid = load(
        "src/settings/global-favorites-bindings.ts"
    ).isGlobalFavoriteSelector;
    const make = load(
        "src/settings/favorites-bindings.ts"
    ).createFavoritesBindings;
    const state = {
        next: 1,
        raw: null,
        stale: false,
        staleSource: false,
        writes: 0,
    };
    const registry = make({
        compareAndSwap: (before, after) => {
            assert.equal(before, state.raw);
            state.raw = after;
            state.writes++;
            return "confirmed";
        },
        current: (entry) =>
            !state.stale && !(state.staleSource && entry.kind === "source"),
        persistedRead: () => state.raw,
        read: () => state.raw,
        uuid: () =>
            "00000000-0000-4000-8000-" + String(state.next++).padStart(12, "0"),
        validateSelector: (_kind, value) => valid(value),
    });
    const selector = {
        configurationDigest: "a".repeat(64),
        kind: "global-playback-target",
        origin: {
            profile: "Two",
            provider,
            sourceAlias: "Two",
            subprofile: null,
        },
        provider,
        slot: 1,
    };
    const binding = {
        owner: "global:" + selector.configurationDigest,
        selector,
    };
    return {
        binding,
        registry,
        state,
        value: { profile: binding, provider, source: binding },
    };
}
for (const provider of ["m3u", "stalker", "xtream", "bestlist/stalker"]) {
    test(
        provider + " private profile/source pair uses one actual registry CAS",
        () => {
            const f = playbackBindingFixture(provider);
            const result = f.registry.provisionPlayback(f.value, 0);
            assert.equal(f.state.writes, 1);
            assert.equal(JSON.parse(f.state.raw).entries.length, 2);
            assert.equal(result.result.profile.provider, provider);
            assert.equal(result.result.source.provider, provider);
            assert.equal(
                result.result.source.profile_id,
                result.result.profile.id
            );
            assert.equal(
                f.registry.resolve(result.result.source.id).binding.selector
                    .provider,
                provider
            );
            f.registry.provisionPlayback(f.value, result.revision);
            assert.equal(
                f.state.writes,
                1,
                "existing exact pair is idempotent"
            );
        }
    );
}
test("playback pairing rejects mismatched providers and stale profile/source grants before writing", () => {
    const rejects = (f, code) => {
        assert.throws(
            () => f.registry.provisionPlayback(f.value, 0),
            (error) => error.code === code
        );
        assert.equal(f.state.writes, 0);
        assert.equal(f.state.raw, null);
    };
    let f = playbackBindingFixture("stalker");
    f.value.provider = "m3u";
    rejects(f, "invalid_binding");
    f = playbackBindingFixture("m3u");
    f.value.source = playbackBindingFixture("stalker").binding;
    rejects(f, "invalid_binding");
    f = playbackBindingFixture("stalker");
    f.value.profile = playbackBindingFixture("xtream").binding;
    rejects(f, "invalid_binding");
    for (const invalid of [
        "Stalker",
        "stalker\n",
        "https://portal.test",
        123,
    ]) {
        f = playbackBindingFixture("stalker");
        f.value.provider = invalid;
        rejects(f, "invalid_binding");
    }
    f = playbackBindingFixture("stalker");
    f.state.stale = true;
    rejects(f, "stale_context");
    f = playbackBindingFixture("stalker");
    f.state.staleSource = true;
    rejects(f, "stale_context");
});

const relativePathFixture = require("./fixtures/local-favorites-relative-path.json");
function localCatalogFixture(prefix = "sender") {
    return {
        items: relativePathFixture.items.map((item, index) => ({
            ...item,
            available: true,
            id: prefix + "-" + index,
            sourceId: prefix + "-root",
        })),
        sources: [{ ...relativePathFixture.source, id: prefix + "-root" }],
    };
}
async function captureLocalItem(catalog, index) {
    const w = {
        __ottActiveProviderDriver: { configuration: () => null, id: "offline" },
        __ottClassicPlayback: {
            snapshot: () => ({
                generation: 3,
                target: { channelId: "local-" + catalog.items[index].id },
            }),
        },
        __ottCommandChannelLoad: {},
        __ottLocalMedia: {
            favoriteSnapshot: () => ({ catalog, current: () => true }),
        },
        __ottOfflineProfiles: { read: () => ({ active: -1 }) },
        __ottSourceIdentity: { current: () => "source" },
    };
    return actualModule(
        "src/media/global-favorites-capture.ts",
        w
    ).captureGlobalFavorite(
        w,
        {
            allowed: () => true,
            captureSelector: async () => ({ bound: true }),
            localItemRelativePath: actualModule(
                "src/offline/local-item-path.ts",
                w
            ).localItemRelativePath,
            selected: () => ({ default: true }),
        },
        codec
    );
}
function localPlayerFixture(catalog, localFavoriteProof) {
    let state = { generation: 0, phase: "idle", target: null };
    const scanned = [],
        played = [];
    const ids = catalog.items.map((item) => "local-" + item.id);
    const w = {
        __ottActiveProviderDriver: { id: "offline" },
        __ottChannels: { index: () => 0 },
        __ottClassicPlayback: { snapshot: () => state },
        __ottCommandChannelLoad: {},
        __ottLocalMedia: {
            cancelScan() {},
            favoriteSnapshot: () => ({ catalog, current: () => true }),
            libraryIdentity: () => "receiver-library",
            remoteCatalog: async (current, source, firstPlayable) => {
                assert(current());
                assert.equal(source, catalog.sources[0].id);
                scanned.push(
                    catalog.items.map((item) =>
                        firstPlayable({ items: [item] })
                    )
                );
                return catalog;
            },
        },
        __ottSourceIdentity: {
            current: () => "receiver-source",
            media: () => "receiver-source",
        },
        _playSession: 0,
        cats: { All: ids },
        catsArray: ["All"],
        channels: Object.fromEntries(ids.map((id) => [id, { itemId: id }])),
        clearTimeout() {},
        commandChannelsReady: true,
        playChannel(group, index, _force, current) {
            assert(current());
            assert.equal(group, 0);
            const id = ids[index];
            assert(
                w.__ottGlobalFavoritesHandoff.accept({
                    channelId: id,
                    sourceId: "receiver-source",
                })
            );
            played.push(id);
            w._playSession++;
            state = {
                generation: state.generation + 1,
                phase: "playing",
                target: { channelId: id, sourceId: "receiver-source" },
            };
            return true;
        },
        setTimeout() {
            throw Error("Unexpected wait in prepared local catalog");
        },
        stbGetItem: () => null,
    };
    const player = actualModule(
        "src/media/global-favorites-player.ts",
        w
    ).createGlobalFavoritesPlayer(w, {
        bindings: { list: async () => ({ entries: [] }) },
        current: () => true,
        isProviderAllowed: () => true,
        localFavoriteProof,
        localItemRelativePath: actualModule("src/offline/local-item-path.ts", w)
            .localItemRelativePath,
        remoteCheckpoint() {},
        sha256: async (text) =>
            require("node:crypto")
                .createHash("sha256")
                .update(text)
                .digest("hex"),
    });
    return { catalog, played, player, scanned, w };
}

test("native catalog full paths survive capture and transfer despite identical basenames", async () => {
    const catalog = localCatalogFixture();
    const entries = [];
    for (let index = 0; index < catalog.items.length; index++) {
        const captured = await captureLocalItem(catalog, index);
        assert(captured);
        assert.equal(captured.value.title, catalog.items[index].name);
        assert.equal(
            captured.value.locator.relativePath,
            relativePathFixture.items[index].relativePath
        );
        entries.push(captured.value);
    }
    assert.notEqual(codec.identity(entries[0]), codec.identity(entries[1]));
    const transferred = codec.document(
        JSON.parse(JSON.stringify({ entries, version: 1 }))
    );
    assert(transferred);
    for (let index = 0; index < transferred.entries.length; index++) {
        // A new runtime and changed IDs model restarting on another client.
        const f = localPlayerFixture(localCatalogFixture("receiver"));
        const favorite = transferred.entries[index];
        const targets = await f.player.targets(
            favorite.origin,
            () => true,
            favorite.locator
        );
        assert.equal(targets.length, 1);
        const session = await f.player.activate(targets[0], () => true);
        const item = await session.resolve(favorite.locator, () => true);
        assert.equal(item.id, "local-receiver-" + index);
        assert.deepEqual(
            f.scanned[0],
            catalog.items.map((_item, position) => position === index)
        );
        assert(await session.play(item, () => true));
        const proof = session.capturePlayback();
        assert(proof && proof.current());
        session.complete();
        assert(
            proof.current(),
            "completing the handoff retains exact played identity"
        );
        f.catalog.items[index].name = "Display label changed.mp4";
        assert(proof.current(), "display basename is not file identity");
        f.catalog.items[index].relativePath =
            "Other/" + relativePathFixture.items[index].name;
        assert.equal(
            proof.current(),
            false,
            "same basename cannot keep a changed-file playback proof"
        );
        f.catalog.items[index].name = favorite.locator.relativePath;
        f.catalog.items[index].relativePath = null;
        assert.equal(
            proof.current(),
            false,
            "explicit nonportable path cannot use display name in playback proof"
        );
        delete f.catalog.items[index].relativePath;
        assert(
            proof.current(),
            "legacy omitted path still verifies its complete relative name"
        );
    }
});

test("a basename-only saved Favorite cannot redirect to a different nested file", async () => {
    const catalog = localCatalogFixture();
    // Even one matching basename is not proof: the original root file may
    // have been removed while a different nested file has the same name.
    catalog.items = [catalog.items[2]];
    const captured = await captureLocalItem(catalog, 0);
    const favorite = captured.value;
    favorite.locator.relativePath = catalog.items[0].name;
    const saved = JSON.stringify(favorite);
    const f = localPlayerFixture(catalog);
    const [target] = await f.player.targets(
        favorite.origin,
        () => true,
        favorite.locator
    );
    const session = await f.player.activate(target, () => true);
    assert.equal(await session.resolve(favorite.locator, () => true), null);
    assert.equal(
        JSON.stringify(favorite),
        saved,
        "unresolved Favorite remains intact"
    );
    assert.equal(f.played.length, 0);
    session.release();
});

test("legacy browser and Capacitor full names remain valid without relativePath", async () => {
    const catalog = localCatalogFixture();
    for (const item of catalog.items) {
        item.name = item.relativePath;
        delete item.relativePath;
    }
    const captured = await captureLocalItem(catalog, 1);
    assert.equal(
        captured.value.locator.relativePath,
        relativePathFixture.items[1].relativePath
    );
    const f = localPlayerFixture(catalog);
    const [target] = await f.player.targets(
        captured.value.origin,
        () => true,
        captured.value.locator
    );
    const session = await f.player.activate(target, () => true);
    const item = await session.resolve(captured.value.locator, () => true);
    assert.equal(item.id, "local-sender-1");
    assert(await session.play(item, () => true));
    assert(session.capturePlayback().current());
});

test("an invalid explicit relativePath cannot fall back during capture or resolution", async () => {
    for (const invalid of [
        undefined,
        null,
        "",
        4,
        "../escape.mp4",
        "/absolute.mp4",
        "C:/private.mp4",
        "a\\b.mp4",
        "a//b.mp4",
        " file.mp4",
        "file.mp4\u00a0",
        "\ufefffile.mp4",
        "\ud800",
    ]) {
        const catalog = localCatalogFixture();
        const captured = await captureLocalItem(catalog, 0);
        catalog.items[0].name = captured.value.locator.relativePath;
        catalog.items[0].relativePath = invalid;
        assert.equal(await captureLocalItem(catalog, 0), null);
        const f = localPlayerFixture(catalog);
        const [target] = await f.player.targets(
            captured.value.origin,
            () => true,
            captured.value.locator
        );
        const session = await f.player.activate(target, () => true);
        assert.equal(
            await session.resolve(captured.value.locator, () => true),
            null
        );
        assert.equal(f.scanned[0][0], false);
        session.release();
    }
});

test("duplicate paths in one root are ambiguous, while source identity remains required", async () => {
    const catalog = localCatalogFixture();
    catalog.items[1].relativePath = catalog.items[0].relativePath;
    assert.equal(await captureLocalItem(catalog, 0), null);
    catalog.items[1].sourceId = "other-root";
    assert(await captureLocalItem(catalog, 0));
    const captured = await captureLocalItem(catalog, 0);
    const f = localPlayerFixture(catalog);
    const [target] = await f.player.targets(
        captured.value.origin,
        () => true,
        captured.value.locator
    );
    const session = await f.player.activate(target, () => true);
    const item = await session.resolve(captured.value.locator, () => true);
    assert(await session.play(item, () => true));
    const proof = session.capturePlayback();
    catalog.items[0].sourceId = "other-root";
    assert.equal(proof.current(), false);
});

const localProofKey = "local-favorite-path-proofs.v1";
function localProofFixture() {
    const data = new Map(),
        hooks = {},
        writes = [];
    let held = false,
        active = true,
        serial = 0;
    const hash = async (text) =>
        require("node:crypto").createHash("sha256").update(text).digest("hex");
    const grant = {
        compareAndSwap(key, before, after, admission) {
            assert(held);
            hooks.before?.(key);
            if (
                !admission() ||
                grant.read(key) !== before ||
                hooks.mode === "conflict"
            )
                return "conflict";
            writes.push(key);
            if (hooks.mode !== "ignored") data.set(key, after);
            return hooks.mode === "unknown" ? "unknown" : "confirmed";
        },
        current: () => active,
        async exclusive(work) {
            assert(!held);
            held = true;
            try {
                return await work(grant);
            } finally {
                held = false;
            }
        },
        read: (key) => data.get(key) ?? null,
    };
    const store = actualModule(
        "src/settings/global-favorites.ts",
        {}
    ).createGlobalFavoritesStore({
        capture: () => grant,
        codec,
        current: () => active,
        sha256: hash,
        uuid: () =>
            "00000000-0000-4000-8000-" + String(++serial).padStart(12, "0"),
    });
    const make = () =>
        actualModule(
            "src/settings/local-favorite-proofs.ts",
            {}
        ).createLocalFavoriteProofs({
            canWrite: () => !hooks.blocked,
            current: () => active,
            grant,
            sha256: hash,
            snapshot: store.snapshot,
        });
    return { data, grant, hooks, make, store, writes };
}
function rootCatalog() {
    return {
        items: [
            {
                available: true,
                id: "root-file-id",
                name: "Clip.mp4",
                relativePath: "Clip.mp4",
                sourceId: "disk-root",
            },
        ],
        sources: [{ id: "disk-root", kind: "folder", name: "Movies" }],
    };
}
async function prepareLocalProof(f, catalog = rootCatalog()) {
    const capture = await captureLocalItem(catalog, 0);
    const player = localPlayerFixture(catalog);
    const [target] = await player.player.targets(
        capture.value.origin,
        () => true,
        capture.value.locator
    );
    capture.selector = target.selector;
    const before = await f.store.snapshot();
    const result = await f.store.mutate(before.revision, {
        entries: [capture.value],
        op: "put",
    });
    return { capture, catalog, revision: result.revision, target };
}

test("old or imported basenames cannot play a new root collision, even with the original nested file present", async () => {
    for (const nested of [false, true]) {
        const catalog = rootCatalog();
        if (nested)
            catalog.items.push({
                ...catalog.items[0],
                id: "original",
                relativePath: "Season 1/Clip.mp4",
            });
        const captured = await captureLocalItem(catalog, 0);
        const f = localPlayerFixture(catalog);
        const [target] = await f.player.targets(
            captured.value.origin,
            () => true,
            captured.value.locator
        );
        const session = await f.player.activate(target, () => true);
        assert.equal(
            await session.resolve(captured.value.locator, () => true),
            null
        );
        assert.equal(
            f.scanned.length,
            0,
            "an unproven basename must fail before scanning"
        );
        assert.equal(f.played.length, 0);
        session.release();
    }
});

test("explicit root capture has a durable exact-item proof across restart without adding wire fields", async () => {
    const f = localProofFixture(),
        prepared = await prepareLocalProof(f);
    const first = f.make();
    assert.equal(
        await first.read(
            prepared.target.selector,
            prepared.capture.value.locator
        ),
        null
    );
    await first.record(prepared.capture, prepared.revision);
    const restarted = f.make();
    const reader = (selector, locator) => restarted.read(selector, locator);
    const p = localPlayerFixture(prepared.catalog, reader);
    const [target] = await p.player.targets(
        prepared.capture.value.origin,
        () => true,
        prepared.capture.value.locator
    );
    const session = await p.player.activate(target, () => true);
    const item = await session.resolve(
        prepared.capture.value.locator,
        () => true
    );
    assert.equal(item.id, "local-root-file-id");
    assert(await session.play(item, () => true));
    const proof = session.capturePlayback();
    assert(proof.current());
    assert.deepEqual(Object.keys(prepared.capture.value).sort(), [
        "locator",
        "origin",
        "title",
    ]);
    assert.equal(
        JSON.stringify((await f.store.portableSnapshot()).entries).includes(
            "root-file-id"
        ),
        false
    );
    const writes = f.writes.length;
    await restarted.read(target.selector, prepared.capture.value.locator);
    assert.equal(f.writes.length, writes, "read is side-effect free");
    prepared.catalog.items[0].relativePath = null;
    assert.equal(
        proof.current(),
        false,
        "same ID cannot revive an explicitly invalid path"
    );
    session.release();
});

test("proof binds exact Favorite UUID, canonical row, source and selected configuration", async () => {
    const f = localProofFixture(),
        prepared = await prepareLocalProof(f),
        proofs = f.make();
    await proofs.record(prepared.capture, prepared.revision);
    const selector = prepared.target.selector,
        locator = prepared.capture.value.locator;
    assert(await proofs.read(selector, locator));
    for (const changed of [
        { ...selector, configurationDigest: "a".repeat(64) },
        { ...selector, slot: 1 },
        { ...selector, root: { ...selector.root, id: "other-disk" } },
    ])
        assert.equal(await proofs.read(changed, locator), null);
    const raw = f.data.get("remoteFavorites.v1"),
        changed = JSON.parse(raw);
    changed.entries[0].title = "Different canonical row";
    f.data.set("remoteFavorites.v1", JSON.stringify(changed));
    assert.equal(await proofs.read(selector, locator), null);
    f.data.set("remoteFavorites.v1", raw);
    const oldProof = await proofs.read(selector, locator);
    let snapshot = await f.store.snapshot();
    await f.store.mutate(snapshot.revision, {
        ids: [snapshot.entries[0].id],
        op: "remove",
    });
    assert.equal(oldProof.current(), false);
    snapshot = await f.store.snapshot();
    await f.store.mutate(snapshot.revision, {
        entries: [prepared.capture.value],
        op: "put",
    });
    assert.equal(
        await proofs.read(selector, locator),
        null,
        "a new import UUID cannot inherit orphaned evidence"
    );
    const readded = await f.store.snapshot();
    await proofs.record(prepared.capture, readded.revision);
    assert(
        await proofs.read(selector, locator),
        "explicit re-add can supply exact evidence again"
    );
});

test("exact item ID and explicit path must still match after proof restore", async () => {
    for (const change of [
        (item) => {
            item.id = "new-file-id";
        },
        (item) => {
            item.sourceId = "other-disk";
        },
        (item) => {
            item.relativePath = "Season 1/Clip.mp4";
        },
        (item) => {
            item.relativePath = null;
        },
        (item) => {
            delete item.relativePath;
        },
    ]) {
        const f = localProofFixture(),
            prepared = await prepareLocalProof(f),
            proofs = f.make();
        await proofs.record(prepared.capture, prepared.revision);
        change(prepared.catalog.items[0]);
        const p = localPlayerFixture(prepared.catalog, (selector, locator) =>
            proofs.read(selector, locator)
        );
        const [target] = await p.player.targets(
            prepared.capture.value.origin,
            () => true,
            prepared.capture.value.locator
        );
        const session = await p.player.activate(target, () => true);
        assert.equal(
            await session.resolve(prepared.capture.value.locator, () => true),
            null
        );
        assert.equal(p.played.length, 0);
        session.release();
    }
});

test("proof writes require durable acknowledgement and retain store/receipt/source admission", async () => {
    for (const mode of ["conflict", "ignored", "unknown", "stale", "blocked"]) {
        const f = localProofFixture(),
            prepared = await prepareLocalProof(f),
            proofs = f.make();
        if (mode === "stale") prepared.capture.current = () => false;
        else if (mode === "blocked") f.hooks.blocked = true;
        else f.hooks.mode = mode;
        await assert.rejects(
            proofs.record(prepared.capture, prepared.revision)
        );
        assert.equal(
            await proofs.read(
                prepared.target.selector,
                prepared.capture.value.locator
            ),
            null
        );
        if (mode !== "unknown") assert.equal(f.data.has(localProofKey), false);
    }
    const f = localProofFixture(),
        prepared = await prepareLocalProof(f),
        proofs = f.make();
    f.hooks.before = () =>
        f.data.set("favorites-receipts.v1", "changed while waiting");
    await assert.rejects(proofs.record(prepared.capture, prepared.revision));
    assert.equal(f.data.has(localProofKey), false);
});

test("proof record preserves immediate admission and rejects synchronous lock failures as a promise", async () => {
    const f = localProofFixture(),
        prepared = await prepareLocalProof(f),
        proofs = f.make();
    let pending,
        calls = 0;
    const exclusive = f.grant.exclusive;
    f.grant.exclusive = (work) => {
        calls++;
        return exclusive(work);
    };
    assert.doesNotThrow(() => {
        pending = proofs.record(prepared.capture, prepared.revision);
    });
    assert.equal(calls, 1, "lock acquisition starts during the original call");
    await pending;
    prepared.capture.current = () => false;
    assert.doesNotThrow(() => {
        pending = proofs.record(prepared.capture, prepared.revision);
    });
    await assert.rejects(pending, /unavailable/);
    assert.equal(calls, 1, "failed admission does not acquire a lock");
    prepared.capture.current = () => true;
    f.grant.exclusive = () => {
        throw Error("busy");
    };
    assert.doesNotThrow(() => {
        pending = proofs.record(prepared.capture, prepared.revision);
    });
    await assert.rejects(pending, /busy/);
});

test("capture never promotes an old basename-only catalog into exact proof", async () => {
    const catalog = rootCatalog();
    delete catalog.items[0].relativePath;
    const captured = await captureLocalItem(catalog, 0);
    assert(captured);
    assert.equal(captured.localProof, null);
});

test("private proofs cannot be read, written, erased or imported through ordinary settings", async () => {
    const imports =
        require("./helpers/remote-transfer-dependency.cjs").storage();
    const saved = JSON.stringify({ entries: [], version: 1 });
    const data = new Map([
        [localProofKey, saved],
        ["ordinary", "yes"],
    ]);
    const backing = {
        clear: () => data.clear(),
        getItem: (key) => data.get(key) ?? null,
        key: (index) => [...data.keys()][index],
        get length() {
            return data.size;
        },
        removeItem: (key) => data.delete(key),
        setItem: (key, value) => data.set(key, value),
    };
    const w = {
        localStorage: backing,
        OttPlayCore: {
            classicInstallationState: () => ({
                commandServerAddress: "",
                commandServerToken: "",
                sLocalHttpDeviceCode: "",
                sLocalHttpEnabled: "0",
            }),
            classicPortableKey: () => true,
            classicPortableSnapshot: (value) => ({ ...value }),
        },
    };
    const exports = {};
    const output = ts.transpileModule(
        fs.readFileSync("src/storage/index.ts", "utf8"),
        {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES5,
            },
        }
    ).outputText;
    vm.runInNewContext(output, {
        ...imports,
        document: { cookie: "" },
        exports,
        window: w,
    });
    Object.assign(w, exports);
    w.commitSettingsWrites = actualModule(
        "src/settings/store.ts",
        w
    ).commitSettingsWrites;
    assert.equal(exports.stbGetItem(localProofKey), null);
    exports.stbSetItem(localProofKey, "forged");
    exports.stbDelItem(localProofKey);
    assert.equal(data.get(localProofKey), saved);
    assert.equal(exports.stbGetAllItems()[localProofKey], undefined);
    assert.equal(exports.isPortableSettingsKey(localProofKey), false);
    assert.equal(
        exports.portableSettingsSnapshot({ [localProofKey]: "forged" })[
            localProofKey
        ],
        undefined
    );
    exports.restoreLocalSettingsSnapshot({
        [localProofKey]: "forged",
        ordinary: "changed",
    });
    assert.equal(data.get(localProofKey), saved);
    assert.equal(data.get("ordinary"), "changed");
    assert.throws(() =>
        exports.writeSettingsJournal(
            backing,
            [{ after: "forged", before: saved, key: localProofKey }],
            () => true
        )
    );
    assert.equal(data.get(localProofKey), saved);
});

(async () => {
    for (const [name, run] of cases) {
        await run();
        console.log("PASS global Favorites: " + name);
    }
    console.log("PASS " + cases.length + " global Favorites scenarios");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
