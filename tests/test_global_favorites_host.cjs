"use strict";
const {
    createMainPorts,
} = require("./helpers/global-favorites-main-ports.cjs");
const assert = require("node:assert/strict"),
    fs = require("node:fs"),
    path = require("node:path"),
    vm = require("node:vm"),
    ts = require("typescript"),
    crypto = require("node:crypto");
function fixture(partial = false) {
    const data = new Map(),
        writes = [],
        cache = {},
        timers = new Map();
    let serial = 0,
        clock = 1000000,
        held = false,
        active = true,
        runtimeCurrent = true,
        handler = {},
        shown = [],
        toggles = [];
    let writeFailure = null,
        writeHook = null;
    const hash = (value) =>
        crypto
            .createHash("sha256")
            .update(typeof value === "string" ? value : Buffer.from(value))
            .digest("hex");
    const w = {
        _: (v) => v,
        __ottChannelListView: {
            show(view) {
                w.selIndex = view.selected;
                shown.push(view);
            },
        },
        __ottClassicPlayback: { snapshot: () => ({ generation: 1 }) },
        __ottClassicScreenPort: { screens: { current: () => null } },
        __ottCommandChannelLoad: {},
        __ottKiosk: { enabled: () => false },
        __ottParental: { needs: () => false },
        __ottSourceIdentity: {
            current: () => "m3u:source",
            media: () => "media:source",
        },
        __ottStandby: { blocked: () => false },
        channels: {
            7: {
                __ottFavoriteTvgId: "News",
                channel_name: "News",
                itemId: "news",
            },
        },
        cList: [7],
        clearTimeout(id) {
            timers.delete(id);
        },
        closeList() {},
        commandChannelsReady: true,
        keys: { ENTER: 13, EXIT: 27, PLAY: 80, RETURN: 27 },
        listKeyHandlerFn: handler,
        setTimeout(fn) {
            timers.set(++serial, fn);
            return serial;
        },
        showShift() {},
        stbGetItem: (key) => (data.has(key) ? data.get(key) : null),
    };
    data.set(
        "m3um3uArr",
        JSON.stringify({
            active: 0,
            M3Us: [
                {
                    name: "Profile",
                    rechours: 0,
                    www: "https://fixture.test/list",
                },
            ],
        })
    );
    w.__ottActiveProviderDriver = {
        configuration: () => JSON.parse(w.stbGetItem("m3um3uArr")),
        id: "m3u",
    };
    function load(name) {
        if (cache[name]) return cache[name];
        const exports = (cache[name] = {});
        vm.runInNewContext(
            ts.transpileModule(fs.readFileSync(name, "utf8"), {
                compilerOptions: {
                    module: ts.ModuleKind.CommonJS,
                    target: ts.ScriptTarget.ES5,
                },
            }).outputText,
            {
                console,
                exports,
                Promise,
                require: (relative) =>
                    load(
                        path.posix.normalize(
                            path.posix.join(
                                path.posix.dirname(name),
                                relative + ".ts"
                            )
                        )
                    ),
                Uint8Array,
                window: w,
            }
        );
        return exports;
    }
    load("src/channels/channel-references.ts");
    load("src/media/journal.ts");
    function journal(position, title = "News") {
        data.set(
            "mediaJournal.v1:media:source",
            // biome-ignore assist/source/useSortedKeys: Preserve the raw media journal fixture used by capture guards.
            JSON.stringify({
                version: 1,
                sourceId: "media:source",
                favorites: [
                    // biome-ignore assist/source/useSortedKeys: Preserve the raw media journal fixture used by capture guards.
                    {
                        sourceId: "media:source",
                        itemId: "news",
                        position: 0,
                        // biome-ignore assist/source/useSortedKeys: Preserve the raw media journal fixture used by capture guards.
                        payload: { title, __ottGlobalChannel: 7 },
                    },
                ],
                history: [
                    // biome-ignore assist/source/useSortedKeys: Preserve the raw media journal fixture used by capture guards.
                    {
                        sourceId: "media:source",
                        itemId: "news",
                        position,
                        // biome-ignore assist/source/useSortedKeys: Preserve the raw media journal fixture used by capture guards.
                        payload: { title, __ottGlobalChannel: 7 },
                    },
                ],
            })
        );
    }
    journal(1);
    const media = w.__ottMediaJournal.create({
        core: {},
        current: () => active,
        enabled: () => true,
        importRows: () => [],
        limit: () => 20,
        read: w.stbGetItem,
        sourceId: "media:source",
        write() {
            throw Error("read-only capture must not write journal");
        },
    });
    w.__ottMedia = {
        captureGlobalFavorites: () => media.captureFavorites(),
        current: () => null,
    };
    if (partial) {
        // biome-ignore assist/source/useSortedKeys: Preserve the raw channel-list fixture used by capture guards.
        const document = {
            sourceId: "m3u:source",
            // biome-ignore assist/source/useSortedKeys: Preserve the raw channel-list fixture used by capture guards.
            lists: {
                order: ["Favorites"],
                lists: {
                    Favorites: [{ itemId: "news" }, { itemId: "missing" }],
                },
            },
        };
        w.__ottFavoritesLibrary = {
            captureGlobal: () => ({
                current: () => active,
                document,
                raw: JSON.stringify(document),
            }),
        };
    }
    const grant = {
        compareAndSwap(key, before, after, admitted) {
            assert(held);
            if (
                !active ||
                (admitted && !admitted()) ||
                w.stbGetItem(key) !== before
            )
                return "conflict";
            const hooked = writeHook?.({ after, before, key });
            if (hooked !== undefined) return hooked;
            if (
                (key === "remoteFavorites.v1" && writeFailure === "conflict") ||
                (key === "local-favorite-path-proofs.v1" &&
                    writeFailure === "proof-conflict")
            )
                return "conflict";
            writes.push(key);
            if (
                !(
                    key === "local-favorite-path-proofs.v1" &&
                    writeFailure === "proof-ignored"
                )
            )
                data.set(key, after);
            return (key === "remoteFavorites.v1" &&
                writeFailure === "unknown") ||
                !active ||
                (admitted && !admitted())
                ? "unknown"
                : "confirmed";
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
        implementationVersion: 1,
        kind: "synchronous-localstorage",
        lockName: "ottplay:favorites-ledger",
        origin: "https://fixture.test",
        privateLedgerKey: "favorites-receipts.v1",
        read: w.stbGetItem,
    };
    const mainCalls = [],
        main = createMainPorts(w);
    for (const name of [
        "remoteCheckpoint",
        "handleRemoteProfiles",
        "isProviderAllowed",
        "providerIds",
        "selectProviderByIndex",
        "selectMediaProfile",
    ]) {
        const actual = main[name];
        main[name] = function () {
            mainCalls.push(name);
            return actual.apply(undefined, arguments);
        };
    }
    const hostPorts = {
        ...main,
        authorized: () => true,
        base64Decode: (text) => new Uint8Array(Buffer.from(text, "base64")),
        base64Encode: (bytes) => Buffer.from(bytes).toString("base64"),
        capture: () => grant,
        captureLegacy: async () => {
            throw Error("unexpected legacy capture");
        },
        current: () => active && runtimeCurrent,
        favoriteRemoved: (title) => w.showShift("Favorites: − " + title),
        favoriteToggled: (title, added) => toggles.push([title, added]),
        now: () => clock,
        playLegacy() {
            throw Error("unexpected legacy play");
        },
        runtime: () => "runtime-one",
        sha256: async (value) => hash(value),
        uuid: () =>
            `00000000-0000-4000-8000-${String(++serial).padStart(12, "0")}`,
    };
    const makeHost = load(
            "src/media/global-favorites-host.ts"
        ).createGlobalFavoritesHost,
        host = makeHost(w, hostPorts);
    return {
        data,
        deactivate() {
            active = false;
        },
        expireRuntime() {
            runtimeCurrent = false;
        },
        failWrites(mode) {
            writeFailure = mode;
        },
        hash,
        host,
        hostPorts,
        journal,
        load,
        mainCalls,
        makeHost,
        onWrite(hook) {
            writeHook = hook;
        },
        shown,
        toggles,
        w,
        writes,
    };
}
async function seededPlayableFixture(title = "Seeded playable") {
    const f = fixture(),
        w = f.w,
        categorySaves = [];
    let state = {
            generation: 1,
            phase: "playing",
            target: { channelId: 7, kind: "live", sourceId: "m3u:source" },
        },
        plays = 0;
    w._playSession = 11;
    w.__ottClassicPlayback = { checkpoint() {}, snapshot: () => state };
    w.__ottChannels = {
        index: () => 0,
        rememberCategory(group) {
            categorySaves.push({
                group,
                provider: w.__ottActiveProviderDriver.id,
            });
            return true;
        },
    };
    w.catsArray = ["all"];
    w.cats = { all: [7] };
    w.playChannel = (group, index, force, current) => {
        assert(current());
        plays++;
        w._playSession++;
        state = {
            generation: state.generation + 1,
            phase: "playing",
            target: {
                channelId: w.cats[w.catsArray[group]][index],
                kind: "live",
                sourceId: "m3u:source",
            },
        };
        return true;
    };
    const entry = {
        locator: { channelId: "m3u-epg:News", kind: "channel" },
        origin: {
            profile: "Paired Profile",
            provider: "m3u",
            sourceAlias: "Paired Source",
            subprofile: null,
        },
        title,
    };
    await f.host.committer.qualify();
    const before = await f.host.store.snapshot();
    await f.host.store.mutate(before.revision, { entries: [entry], op: "put" });
    await f.host.pair(entry.origin, 0, undefined, () => true);
    const snapshot = await f.host.store.snapshot();
    assert.equal(snapshot.entries.length, 1);
    const id = snapshot.entries[0].id;
    assert.equal(
        (await f.host.router.select(id).result).status,
        "ok",
        "healthy same stored/paired route must be playable"
    );
    assert.equal(plays, 1);
    assert(f.host.router.captureCurrent());
    return { ...f, categorySaves, id, plays: () => plays };
}
function assertRawUnchanged(f, before) {
    assert.equal(f.data.size, before.size);
    for (const [key, value] of before)
        assert.equal(f.data.get(key), value, key);
}

function rootLocalFixture() {
    const f = fixture(),
        w = f.w;
    const item = {
        available: true,
        id: "file-in-root",
        name: "Clip.mp4",
        relativePath: "Clip.mp4",
        sourceId: "local-disk",
    };
    const catalog = {
        items: [item],
        sources: [{ id: item.sourceId, kind: "folder", name: "Movies" }],
    };
    let state = {
            generation: 1,
            phase: "playing",
            target: { channelId: "local-" + item.id, sourceId: "local-source" },
        },
        scans = 0;
    w.__ottActiveProviderDriver = { configuration: () => null, id: "offline" };
    w.__ottSourceIdentity = {
        current: () => "local-source",
        media: () => "local-source",
    };
    w.__ottClassicPlayback = { snapshot: () => state };
    w.__ottOfflineProfiles = { read: () => ({ active: -1 }) };
    w.__ottLocalMedia = {
        cancelScan() {},
        favoriteSnapshot: () => ({ catalog, current: () => true }),
        libraryIdentity: () => "this-local-library",
        async remoteCatalog(current, source, firstPlayable) {
            assert(current());
            assert.equal(source, item.sourceId);
            assert(firstPlayable(catalog));
            scans++;
            return catalog;
        },
    };
    w.__ottChannels = { index: () => 0, rememberCategory: () => true };
    w.cats = { All: ["local-" + item.id] };
    w.catsArray = ["All"];
    w.channels = { ["local-" + item.id]: { itemId: "local-" + item.id } };
    w._playSession = 1;
    w.playChannel = (group, index, force, current) => {
        assert(current());
        assert(
            w.__ottGlobalFavoritesHandoff.accept({
                channelId: "local-" + item.id,
                sourceId: "local-source",
            })
        );
        w._playSession++;
        state = {
            generation: state.generation + 1,
            phase: "playing",
            target: { channelId: "local-" + item.id, sourceId: "local-source" },
        };
        return true;
    };
    return { ...f, catalog, item, scans: () => scans };
}
async function checkLocalProofHost() {
    const key = "local-favorite-path-proofs.v1",
        f = rootLocalFixture();
    const captured = await f.host.capture();
    assert(captured.localProof, "actual capture exposes exact item evidence");
    assert(!f.data.has(key), "read-only capture must not persist trust");
    await f.host.add({ __ottGlobalChannel: "local-" + f.item.id });
    assert(f.data.has(key), "explicit add persists verified private evidence");
    const id = (await f.host.store.snapshot()).entries[0].id;
    f.host.dispose();
    let restarted = f.makeHost(f.w, f.hostPorts);
    assert.equal(
        (await restarted.router.select(id).result).status,
        "ok",
        "actual cold host uses durable exact proof"
    );
    assert.equal(f.scans(), 1);
    // Mimic an old basename import: retaining the root binding alone is insufficient.
    restarted.dispose();
    f.data.delete(key);
    restarted = f.makeHost(f.w, f.hostPorts);
    assert.notEqual((await restarted.router.select(id).result).status, "ok");
    assert.equal(f.scans(), 1, "unproven import stops before scan");
    const unprovenRaw = f.data.get("remoteFavorites.v1");
    assert.equal(
        (await restarted.currentItem()).entry,
        null,
        "unproven collision is not reported as the current Favorite"
    );
    await assert.rejects(restarted.capture(), /unavailable/);
    await assert.rejects(
        restarted.toggle({ __ottGlobalChannel: "local-" + f.item.id }),
        /unavailable/
    );
    await assert.rejects(
        restarted.remove({ __ottGlobalChannel: "local-" + f.item.id }),
        /unavailable/
    );
    assert.equal(
        f.data.get("remoteFavorites.v1"),
        unprovenRaw,
        "toggle/current-item remove cannot delete the old nested Favorite"
    );
    await restarted.add({ __ottGlobalChannel: "local-" + f.item.id });
    assert(
        f.data.has(key),
        "explicit re-add of an existing row establishes missing proof"
    );
    assert((await restarted.currentItem()).entry);
    await restarted.toggle({ __ottGlobalChannel: "local-" + f.item.id });
    assert.equal(
        (await restarted.store.snapshot()).entries.length,
        0,
        "proven root membership can be toggled off"
    );
    await restarted.facade.add();
    assert.equal(
        (await restarted.store.snapshot()).entries.length,
        1,
        "facade explicit add uses the same proof publication path"
    );
    restarted.dispose();
    const ignored = rootLocalFixture();
    ignored.failWrites("proof-ignored");
    await assert.rejects(
        ignored.host.add({ __ottGlobalChannel: "local-" + ignored.item.id }),
        /storage_unavailable/
    );
    assert(!ignored.data.has(key));
    assert.equal(
        ignored.toggles.length,
        0,
        "ignored proof write never reports successful addition"
    );
    ignored.host.dispose();
    console.log(
        "PASS actual Local host explicit add, restart, unproven import, re-add and ignored proof writer"
    );
}

async function checkLocalProofFailureAtomicity() {
    const proofKey = "local-favorite-path-proofs.v1",
        storeKey = "remoteFavorites.v1",
        receiptKey = "favorites-receipts.v1";
    for (const mode of ["proof-ignored", "proof-conflict", "proof-throw"]) {
        const f = rootLocalFixture(),
            payload = { __ottGlobalChannel: "local-" + f.item.id };
        f.failWrites(mode);
        if (mode === "proof-throw")
            f.onWrite(({ key }) => {
                if (key === proofKey) throw Error("write rejected");
            });
        await assert.rejects(f.host.add(payload), /storage_unavailable/);
        assert.equal(
            (await f.host.store.snapshot()).entries.length,
            0,
            `${mode}: failed proof cannot leave a newly added Favorite`
        );
        assert.equal(f.data.has(proofKey), false);
        assert.equal(f.toggles.length, 0);
        f.failWrites(null);
        f.onWrite(null);
        assert.equal((await f.host.add(payload)).outcome, "verified");
        assert(
            (await f.host.currentItem()).entry,
            "retry needs no host recreation"
        );
        f.host.dispose();
        const restarted = f.makeHost(f.w, f.hostPorts),
            [saved] = (await restarted.store.snapshot()).entries;
        assert.equal(
            (await restarted.router.select(saved.id).result).status,
            "ok"
        );
        restarted.dispose();
    }
    {
        const f = rootLocalFixture(),
            payload = { __ottGlobalChannel: "local-" + f.item.id };
        await f.host.add(payload);
        f.data.delete(proofKey);
        const prior = f.data.get(storeKey);
        f.failWrites("proof-ignored");
        await assert.rejects(f.host.add(payload), /storage_unavailable/);
        assert.equal(
            f.data.get(storeKey),
            prior,
            "failed re-proof retains existing row and UUID"
        );
        f.failWrites(null);
        await f.host.add(payload);
        assert.equal(f.data.get(storeKey), prior);
        assert((await f.host.currentItem()).entry);
        f.host.dispose();
    }
    {
        const f = rootLocalFixture(),
            payload = { __ottGlobalChannel: "local-" + f.item.id };
        await f.host.committer.qualify();
        const initial = await f.host.store.snapshot();
        await f.host.store.mutate(initial.revision, {
            entries: [
                {
                    locator: { channelId: "m3u-epg:Kept", kind: "channel" },
                    origin: {
                        profile: "Profile",
                        provider: "m3u",
                        sourceAlias: "Source",
                        subprofile: null,
                    },
                    title: "Kept",
                },
            ],
            op: "put",
        });
        const prior = f.data.get(storeKey),
            receipt = f.data.get(receiptKey);
        f.failWrites("proof-ignored");
        await assert.rejects(f.host.add(payload), /storage_unavailable/);
        assert.equal(
            f.data.get(storeKey),
            prior,
            "rollback restores the complete old document exactly"
        );
        assert.equal(
            f.data.get(receiptKey),
            receipt,
            "rollback never invents or alters a receipt"
        );
        f.host.dispose();
    }
    for (const changed of [storeKey, receiptKey, proofKey]) {
        const f = rootLocalFixture(),
            payload = { __ottGlobalChannel: "local-" + f.item.id };
        let changedRaw;
        f.onWrite(({ key }) => {
            if (key !== proofKey) return;
            changedRaw =
                changed === storeKey
                    ? JSON.stringify({
                          ...JSON.parse(f.data.get(storeKey)),
                          migrations: ["1".repeat(64)],
                      })
                    : "concurrent writer owns this value";
            f.data.set(changed, changedRaw);
            return "conflict";
        });
        await assert.rejects(f.host.add(payload), /reconciliation_required/);
        assert.equal(
            f.data.get(changed),
            changedRaw,
            "compensation must preserve concurrent " + changed
        );
        assert.equal(JSON.parse(f.data.get(storeKey)).entries.length, 1);
        assert.equal(f.toggles.length, 0);
        f.host.dispose();
    }
    for (const failure of [
        "rollback-ignored",
        "grant-lost",
        "runtime-expired",
    ]) {
        const f = rootLocalFixture(),
            payload = { __ottGlobalChannel: "local-" + f.item.id };
        let proofAttempted = false;
        f.onWrite(({ key }) => {
            if (key === proofKey) {
                proofAttempted = true;
                if (failure === "grant-lost") f.deactivate();
                if (failure === "runtime-expired") f.expireRuntime();
                return "conflict";
            }
            if (
                proofAttempted &&
                key === storeKey &&
                failure === "rollback-ignored"
            )
                return "confirmed";
        });
        await assert.rejects(
            f.host.add(payload),
            failure === "runtime-expired"
                ? /storage_unavailable/
                : /reconciliation_required/
        );
        assert.equal(
            JSON.parse(f.data.get(storeKey)).entries.length,
            failure === "runtime-expired" ? 0 : 1,
            "compensation relies on exact physical ownership, verifies its write and survives UI cancellation"
        );
        assert.equal(f.toggles.length, 0);
        f.host.dispose();
    }
    {
        const f = rootLocalFixture(),
            payload = { __ottGlobalChannel: "local-" + f.item.id };
        f.onWrite(({ after, key }) => {
            if (key !== proofKey) return;
            f.data.set(key, after);
            return "unknown";
        });
        await assert.rejects(f.host.add(payload), /reconciliation_required/);
        const saved = new Map(f.data);
        f.onWrite(null);
        await assert.rejects(f.host.add(payload), /unavailable/);
        assertRawUnchanged(f, saved);
        assert.equal(
            f.toggles.length,
            0,
            "uncertain proof write cannot report success"
        );
        f.host.dispose();
        const restarted = f.makeHost(f.w, f.hostPorts);
        assert(
            (await restarted.currentItem()).entry,
            "restart validates actual durable proof instead of persisting an uncertainty flag"
        );
        restarted.dispose();
    }
    console.log(
        "PASS Local proof failure compensation, retry, existing rows, concurrent writes and uncertain fencing"
    );
}

async function main() {
    await checkLocalProofHost();
    await checkLocalProofFailureAtomicity();
    {
        const target = await seededPlayableFixture();
        assert.deepEqual(
            target.categorySaves,
            [],
            "playing a Favorite is not an explicit category selection"
        );
        assert(target.host.navigation.active());
        target.categorySaves.length = 0;
        const driver = target.w.__ottActiveProviderDriver;
        target.w.__ottActiveProviderDriver = { id: "plex" };
        target.w.stbSetItem = (key, value) => target.data.set(key, value);
        target.w.loadProv = () => {
            assert.equal(target.data.get("ottplayprov"), "m3u");
            target.w.__ottActiveProviderDriver = driver;
            target.w.__ottCommandChannelLoad = {};
            target.w.commandChannelsReady = true;
        };
        const pending = target.host.router.select(target.id);
        assert.deepEqual(
            target.categorySaves,
            [],
            "loading cannot change a category"
        );
        assert.equal((await pending.result).status, "ok");
        assert.deepEqual(
            target.categorySaves,
            [],
            "completed cross-provider playback preserves the remembered category"
        );
        assert(target.host.navigation.active());
        assert.equal(target.host.navigation.currentId(), target.id);
        target.host.dispose();
    }
    for (const outcome of ["failed", "stale"]) {
        const target = await seededPlayableFixture();
        target.categorySaves.length = 0;
        target.w.playChannel = () => {
            if (outcome === "stale") target.expireRuntime();
            return outcome !== "failed";
        };
        assert.notEqual(
            (await target.host.router.select(target.id).result).status,
            "ok"
        );
        assert.deepEqual(
            target.categorySaves,
            [],
            outcome + " playback cannot save a category"
        );
        target.host.dispose();
    }
    const localA = fixture();
    await localA.host.committer.qualify();
    const foreign = {
        locator: { channelId: "m3u-epg:News", kind: "channel" },
        origin: {
            profile: "Foreign",
            provider: "m3u",
            sourceAlias: "Foreign alias",
            subprofile: null,
        },
        title: "Foreign binding",
    };
    let aliasView = await localA.host.store.snapshot();
    await localA.host.store.mutate(aliasView.revision, {
        entries: [foreign],
        op: "put",
    });
    await localA.host.pair(foreign.origin, 0, undefined, () => true);
    const awayB = fixture();
    awayB.data.set("remoteFavorites.v1", localA.data.get("remoteFavorites.v1"));
    awayB.data.set(
        "favorites-bindings.v1",
        localA.data.get("favorites-bindings.v1")
    );
    const awayConfig = JSON.parse(awayB.data.get("m3um3uArr"));
    awayConfig.M3Us[0].name = "B";
    awayB.data.set("m3um3uArr", JSON.stringify(awayConfig));
    awayB.w.__ottSourceIdentity.current = () => "m3u:away-B";
    awayB.w.keys.YELLOW = 405;
    awayB.w.keys.TOOLS = 84;
    awayB.w.keys.N0 = 48;
    await awayB.host.open();
    const awayView = awayB.shown.at(-1),
        foreignId = (await awayB.host.store.snapshot()).entries.find(
            (row) => row.title === "Foreign binding"
        ).id;
    awayB.w.selIndex = awayView.rows.indexOf(foreignId);
    assert(awayView.key(405));
    for (let turn = 0; turn < 20; turn++) await new Promise(setImmediate);
    localA.data.set("remoteFavorites.v1", awayB.data.get("remoteFavorites.v1"));
    await localA.host.open();
    assert(
        !(await localA.host.store.snapshot()).entries.some(
            (row) =>
                row.locator.channelId === "m3u-epg:News" &&
                row.origin.profile !== "B"
        ),
        "verified Foreign-to-Local mapping cannot resurrect under Local alias"
    );
    await localA.host.add({ __ottGlobalChannel: 7 });
    aliasView = await localA.host.store.snapshot();
    assert.equal(
        aliasView.entries.filter((row) => row.origin.profile === "Foreign")
            .length,
        1,
        "manual explicit Add retains paired Foreign identity"
    );
    assert.equal(
        aliasView.entries.filter((row) => row.origin.profile === "Profile")
            .length,
        0,
        "no duplicate Local identity"
    );
    assert.equal(
        (await localA.host.add({ __ottGlobalChannel: 7 })).changed,
        false
    );
    await localA.host.toggle({ __ottGlobalChannel: 7 });
    assert(
        !(await localA.host.store.snapshot()).entries.some(
            (row) => row.origin.profile === "Foreign"
        ),
        "manual F toggles mapped identity"
    );
    await localA.host.pair(
        {
            ...foreign.origin,
            profile: "Other imported",
            sourceAlias: "Other imported",
        },
        0,
        undefined,
        () => true
    );
    const ambiguousRaw = new Map(localA.data);
    await assert.rejects(
        localA.host.add({ __ottGlobalChannel: 7 }),
        /unavailable/
    );
    assertRawUnchanged(localA, ambiguousRaw);
    localA.host.dispose();
    awayB.host.dispose();
    const sourceB = fixture();
    await sourceB.host.committer.qualify();
    const importedA = {
        locator: { channelId: "m3u-epg:News", kind: "channel" },
        origin: {
            profile: "A",
            provider: "m3u",
            sourceAlias: "A",
            subprofile: null,
        },
        title: "Imported A",
    };
    let importedView = await sourceB.host.store.snapshot();
    await sourceB.host.store.mutate(importedView.revision, {
        entries: [importedA],
        op: "put",
    });
    sourceB.w.keys.YELLOW = 405;
    sourceB.w.keys.TOOLS = 84;
    sourceB.w.keys.N0 = 48;
    await sourceB.host.open();
    const viewB = sourceB.shown.at(-1),
        idA = (await sourceB.host.store.snapshot()).entries.find(
            (row) => row.title === "Imported A"
        ).id;
    sourceB.w.selIndex = viewB.rows.indexOf(idA);
    assert(viewB.key(sourceB.w.keys.YELLOW));
    for (let turn = 0; turn < 20; turn++) await new Promise(setImmediate);
    assert(
        !(await sourceB.host.store.snapshot()).entries.some(
            (row) => row.id === idA
        )
    );
    const sourceA = fixture();
    sourceA.data.set(
        "remoteFavorites.v1",
        sourceB.data.get("remoteFavorites.v1")
    );
    const profileA = JSON.parse(sourceA.data.get("m3um3uArr"));
    profileA.M3Us[0].name = "A";
    sourceA.data.set("m3um3uArr", JSON.stringify(profileA));
    sourceA.w.__ottSourceIdentity.current = () => "m3u:unvisited-A";
    sourceA.hostPorts.uuid = () => "99999999-9999-4999-8999-999999999999";
    await sourceA.host.open();
    assert(
        !(await sourceA.host.store.snapshot()).entries.some(
            (row) => row.origin.profile === "A"
        ),
        "first visit A does not resurrect row removed by UUID while B was current"
    );
    await sourceA.host.add({ __ottGlobalChannel: 7 });
    assert(
        (await sourceA.host.store.snapshot()).entries.some(
            (row) => row.origin.profile === "A"
        ),
        "explicit re-add on A works after durable suppression"
    );
    sourceA.host.dispose();
    sourceB.host.dispose();
    const deferred = fixture();
    await deferred.host.committer.qualify();
    assert.equal((await deferred.host.store.snapshot()).entries.length, 0);
    await deferred.host.remove({ __ottGlobalChannel: 7 });
    await deferred.host.open();
    assert.equal(
        (await deferred.host.store.snapshot()).entries.filter(
            (row) => row.locator.channelId === "m3u-epg:News"
        ).length,
        0,
        "remove before first migration must not resurrect the legacy favorite"
    );
    await deferred.host.add({ __ottGlobalChannel: 7 });
    assert.equal(
        (await deferred.host.store.snapshot()).entries.filter(
            (row) => row.locator.channelId === "m3u-epg:News"
        ).length,
        1,
        "explicit add after removal remains available"
    );
    assert.equal(
        (await deferred.host.add({ __ottGlobalChannel: 7 })).changed,
        false
    );
    deferred.host.dispose();
    const menus = await seededPlayableFixture("Explicit menu item");
    const item = { __ottGlobalChannel: 7 };
    assert.equal(
        (await menus.host.add(item)).changed,
        false,
        "add existing is a no-op"
    );
    assert.equal((await menus.host.remove(item)).changed, true);
    assert.equal(
        (await menus.host.remove(item)).changed,
        false,
        "remove absent never adds"
    );
    assert.equal((await menus.host.add(item)).changed, true);
    assert.equal(
        (await menus.host.add(item)).changed,
        false,
        "repeat add never removes"
    );
    assert.equal((await menus.host.store.snapshot()).entries.length, 1);
    assert.deepEqual(
        menus.toggles,
        [
            ["Explicit menu item", false],
            ["Explicit menu item", true],
        ],
        "only persisted changes emit one confirmation each"
    );
    const protectedRaw = new Map(menus.data);
    await assert.rejects(menus.host.remove(item, () => false));
    assertRawUnchanged(menus, protectedRaw);
    menus.w.keys.YELLOW = 405;
    menus.w.keys.TOOLS = 84;
    menus.w.keys.N0 = 48;
    await menus.host.open();
    const shown = menus.shown.at(-1);
    assert.equal(shown.actions, "Favorites: −");
    const beforeMenuRemove = (await menus.host.store.snapshot()).entries;
    const selectedMenuId = shown.rows[shown.selected];
    assert(beforeMenuRemove.some((row) => row.id === selectedMenuId));
    assert.equal(shown.key(menus.w.keys.YELLOW), true);
    for (let turn = 0; turn < 20; turn++) await new Promise(setImmediate);
    assert.deepEqual(
        Array.from(
            (await menus.host.store.snapshot()).entries,
            (row) => row.id
        ),
        Array.from(
            beforeMenuRemove.filter((row) => row.id !== selectedMenuId),
            (row) => row.id
        ),
        "global view action removes only the selected UUID, preserving migrated entries"
    );
    assert.equal(
        shown.key(menus.w.keys.YELLOW),
        false,
        "stale repeated remove cannot affect another row"
    );
    menus.w.sFavorites = -1;
    await menus.host.open();
    assert.equal(
        menus.shown.at(-1).actions,
        false,
        "editing-disabled list does not advertise remove"
    );
    menus.host.dispose();
    const literal = "<b>A & B</b> &amp;";
    const toggleFixture = await seededPlayableFixture(literal);
    await toggleFixture.host.toggle();
    await toggleFixture.host.toggle();
    assert.deepEqual(
        toggleFixture.toggles,
        [
            [literal, false],
            [literal, true],
        ],
        "one confirmed removal/addition notification with the unmodified title"
    );
    const refusedBefore = new Map(toggleFixture.data),
        refusedWrites = toggleFixture.writes.length;
    toggleFixture.failWrites("conflict");
    await assert.rejects(toggleFixture.host.toggle(), /storage_unavailable/);
    assertRawUnchanged(toggleFixture, refusedBefore);
    assert.equal(toggleFixture.writes.length, refusedWrites);
    assert.equal(
        toggleFixture.toggles.length,
        2,
        "refused persistence emits no success"
    );
    toggleFixture.failWrites("unknown");
    await assert.rejects(toggleFixture.host.toggle(), /storage_unavailable/);
    assert.equal(
        toggleFixture.toggles.length,
        2,
        "uncertain persistence emits no success or rollback claim"
    );
    toggleFixture.host.dispose();
    const byteFixture = fixture();
    for (const request of [
        { text: "ASCII" },
        { text: "Привет 世界 😀" },
        { text: "\ud800" },
    ]) {
        assert.equal(
            byteFixture.host.requestBytes(request),
            Buffer.byteLength(JSON.stringify(request), "utf8")
        );
    }
    assert.equal(byteFixture.host.requestBytes("a".repeat(16382)), 16384);
    assert.equal(byteFixture.host.requestBytes("a".repeat(16383)), 16385);
    const circular = {};
    circular.self = circular;
    assert.throws(() => byteFixture.host.requestBytes(circular));
    assert.throws(() => byteFixture.host.requestBytes(undefined));
    assert.throws(() => byteFixture.host.requestBytes("a".repeat(1048576)));
    const originalRequestBytes = byteFixture.host.requestBytes;
    const originalCreateItems = byteFixture.host.createItems;
    async function invokeByteWrapper(kind, request, missingMethod = false) {
        const seen = [];
        const execute = (_params, count) => {
            seen.push(count);
            return Promise.resolve(
                count > 16384
                    ? { error: "envelope_too_large" }
                    : { accepted: true }
            );
        };
        byteFixture.host.requestBytes = missingMethod
            ? undefined
            : originalRequestBytes;
        byteFixture.host.createItems = () => ({ cancel() {}, execute });
        const w = {
            __ottGlobalFavorites: byteFixture.host,
            __ottGlobalFavoritesFacade: byteFixture.host.facade,
            __ottGlobalFavoritesPorts: byteFixture.hostPorts,
            __ottGlobalFavoritesProtocol: { execute },
            __ottGlobalFavoritesRecovery: {
                execute(value) {
                    seen.push(value);
                    return Promise.resolve({ accepted: true });
                },
            },
        };
        const module = byteFixture.load(
            "src/commands/remote-favorites-global" +
                (kind === "core" ? "" : "-" + kind) +
                ".ts"
        );
        const dispatch =
            kind === "core"
                ? module.executeGlobalFavorites
                : kind === "items"
                  ? module.executeGlobalFavoritesItems
                  : module.executeGlobalFavoritesRecovery;
        const reply = await new Promise((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                settled = true;
                reject(new Error("wrapper callback was not delivered"));
            }, 2000);
            try {
                dispatch(w, "runtime-one", request, (value) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    resolve(value);
                });
            } catch (error) {
                settled = true;
                clearTimeout(timer);
                reject(error);
            }
        });
        return { reply, seen };
    }
    function byteRequest(size) {
        const request = {
            expires_at: Date.now() / 1000 + 60,
            padding: "😀界",
            params: { op: "describe", runtime: "runtime-one" },
        };
        request.padding += "a".repeat(
            size - Buffer.byteLength(JSON.stringify(request), "utf8")
        );
        assert.equal(Buffer.byteLength(JSON.stringify(request), "utf8"), size);
        return request;
    }
    for (const kind of ["core", "items", "recovery"]) {
        const exact = await invokeByteWrapper(kind, byteRequest(16384));
        assert.equal(exact.reply.status, "ok");
        assert.equal(exact.seen.length, 1);
        if (kind !== "recovery") assert.equal(exact.seen[0], 16384);
        const over = await invokeByteWrapper(kind, byteRequest(16385));
        assert.equal(over.reply.data.error, "envelope_too_large");
        assert.equal(over.seen.length, kind === "recovery" ? 0 : 1);
        if (kind !== "recovery") assert.equal(over.seen[0], 16385);
        for (const invalid of ["cycle", "undefined", "missing"]) {
            const request = byteRequest(256);
            if (invalid === "cycle") request.cycle = request;
            if (invalid === "undefined") request.toJSON = () => undefined;
            const bad = await invokeByteWrapper(
                kind,
                request,
                invalid === "missing"
            );
            assert.equal(
                bad.reply.data.error,
                kind === "recovery" ? "invalid_request" : "envelope_too_large"
            );
            assert.equal(bad.seen.length, kind === "recovery" ? 0 : 1);
            if (kind !== "recovery") assert.equal(bad.seen[0], 16385);
        }
    }
    byteFixture.host.requestBytes = originalRequestBytes;
    byteFixture.host.createItems = originalCreateItems;
    byteFixture.host.dispose();
    const required = [
        "current",
        "caselessKey",
        "remoteCheckpoint",
        "handleRemoteProfiles",
        "isProviderAllowed",
        "localItemRelativePath",
        "providerIds",
        "selectProviderByIndex",
        "selectMediaProfile",
    ];
    const missing = fixture();
    for (const name of required) {
        let captures = 0;
        const invalid = {
            ...missing.hostPorts,
            [name]: undefined,
            capture() {
                captures++;
                throw Error("missing port reached physical capture");
            },
        };
        assert.throws(
            () => missing.makeHost(missing.w, invalid),
            (error) => error.message === "unsupported",
            name
        );
        assert.equal(captures, 0);
    }
    let captures = 0;
    assert.throws(
        () =>
            missing.makeHost(missing.w, {
                ...missing.hostPorts,
                capture() {
                    captures++;
                    throw Error("stale host captured storage");
                },
                current: () => false,
            }),
        (error) => error.message === "context_changed"
    );
    assert.equal(captures, 0);
    assert.equal(missing.writes.length, 0);
    assert.equal(missing.w.__ottGlobalFavorites, undefined);
    assert.equal(missing.w.__ottGlobalFavoritesPorts, undefined);
    missing.host.dispose();
    for (const name of required) {
        const stale = await seededPlayableFixture(),
            before = new Map(stale.data),
            calls = stale.mainCalls.length,
            writes = stale.writes.length;
        let replacements = 0;
        stale.hostPorts[name] = () => {
            replacements++;
            throw Error("stale replacement invoked");
        };
        assert.equal(stale.host.facade.current(), false, name);
        assert.notEqual(
            (await stale.host.router.select(stale.id).result).status,
            "ok"
        );
        assert.equal(replacements, 0);
        assert.equal(
            stale.mainCalls.length,
            calls,
            "replacement port cannot call provider/checkpoint/profile"
        );
        assert.equal(stale.writes.length, writes);
        assert.equal(stale.plays(), 1);
        assertRawUnchanged(stale, before);
        stale.host.dispose();
    }
    for (const invalidate of ["deactivate", "expireRuntime"]) {
        const stale = await seededPlayableFixture(),
            before = new Map(stale.data),
            calls = stale.mainCalls.length,
            writes = stale.writes.length;
        stale[invalidate]();
        assert.equal(stale.host.facade.current(), false);
        assert.notEqual(
            (await stale.host.router.select(stale.id).result).status,
            "ok"
        );
        await assert.rejects(
            stale.host.open(),
            (error) => error.message === "policy_denied"
        );
        assert.equal(stale.mainCalls.length, calls);
        assert.equal(stale.writes.length, writes);
        assert.equal(stale.plays(), 1);
        assertRawUnchanged(stale, before);
        stale.host.dispose();
    }
    for (const partial of [false, true]) {
        const f = fixture(partial),
            before = new Map(f.data);
        const described = await f.host.protocol.execute(
            { op: "describe", runtime: "runtime-one" },
            80,
            1030
        );
        assert.equal(
            described.error,
            undefined,
            "actual cold host protocol has its required context port"
        );
        assert.equal(described.write_ready, true);
        assert.deepEqual(
            Array.from(described.locator_kinds),
            Array.from(described.locator_kinds).sort()
        );
        assert.equal(f.writes.length, 0);
        for (const [key, value] of before) assert.equal(f.data.get(key), value);
        await f.host.open();
        const snapshot = await f.host.store.snapshot();
        assert.equal(
            snapshot.entries.length,
            1,
            "actual capture migrates source membership"
        );
        await f.host.store.mutate(snapshot.revision, {
            ids: [snapshot.entries[0].id],
            op: "remove",
        });
        assert.equal((await f.host.store.snapshot()).entries.length, 0);
        f.journal(99, "Renamed label");
        await f.host.open();
        assert.equal(
            (await f.host.store.snapshot()).entries.length,
            0,
            "history/title change cannot resurrect deleted global favorite, including partial source capture"
        );
        assert.equal(
            JSON.parse(f.data.get("mediaJournal.v1:media:source")).favorites
                .length,
            1,
            "original per-source favorite is retained"
        );
        f.host.dispose();
    }
    const f = fixture(),
        w = f.w;
    let state = {
        generation: 1,
        phase: "playing",
        target: { channelId: 7, kind: "live", sourceId: "m3u:source" },
    };
    w._playSession = 11;
    w.__ottClassicPlayback = { checkpoint() {}, snapshot: () => state };
    w.__ottChannels = { index: () => 0 };
    w.catsArray = ["all"];
    w.cats = { all: [7, 8] };
    w.channels[8] = {
        __ottFavoriteTvgId: "Other",
        channel_name: "Other",
        itemId: "other",
    };
    w.cList.push(8);
    w.playChannel = (group, index, _force, current) => {
        assert(current());
        w._playSession++;
        state = {
            generation: state.generation + 1,
            phase: "playing",
            target: {
                channelId: w.cats[w.catsArray[group]][index],
                kind: "live",
                sourceId: "m3u:source",
            },
        };
        return true;
    };
    const imported = {
        locator: { channelId: "m3u-epg:News", kind: "channel" },
        origin: {
            profile: "Imported Profile Alias",
            provider: "m3u",
            sourceAlias: "Imported Source Alias",
            subprofile: null,
        },
        title: "Imported News",
    };
    const other = {
        locator: { channelId: "m3u-epg:Other", kind: "channel" },
        origin: {
            profile: "Another profile",
            provider: "m3u",
            sourceAlias: "Another source",
            subprofile: null,
        },
        title: "Unrelated row",
    };
    await f.host.committer.qualify();
    let before = await f.host.store.snapshot();
    await f.host.store.mutate(before.revision, {
        entries: [imported, other],
        op: "put",
    });
    await f.host.pair(imported.origin, 0, undefined, () => true);
    const entries = (await f.host.store.snapshot()).entries,
        selected = entries.find((row) => row.title === imported.title),
        retained = entries.find((row) => row.title === other.title);
    assert.equal((await f.host.router.select(selected.id).result).status, "ok");
    const writesBeforeCurrent = f.writes.length;
    assert.equal(
        (await f.host.currentItem()).entry.origin.sourceAlias,
        imported.origin.sourceAlias,
        "actual host current API retains the proven imported alias"
    );
    assert.equal(
        f.writes.length,
        writesBeforeCurrent,
        "currentItem remains read-only"
    );
    w.channels[7] = { ...w.channels[7], __ottFavoriteTvgId: "Different" };
    assert.equal(
        f.host.router.captureCurrent(),
        null,
        "same numeric row with different stable identity retires provenance"
    );
    w.channels[7].__ottFavoriteTvgId = "News";
    assert.equal((await f.host.router.select(selected.id).result).status, "ok");
    w._playSession++;
    assert.equal(
        f.host.router.captureCurrent(),
        null,
        "actual session generation bump retires provenance"
    );
    assert.equal((await f.host.router.select(selected.id).result).status, "ok");
    assert.equal(
        f.host.router.captureCurrent({ __ottGlobalChannel: 8 }),
        null,
        "selected different row cannot inherit the playing identity"
    );
    await f.host.toggle();
    let after = await f.host.store.snapshot();
    assert.deepEqual(
        Array.from(after.entries, (row) => row.id),
        [retained.id],
        "fullscreen toggle removes imported playing row only, with distinct local profile labels"
    );
    await f.host.toggle();
    after = await f.host.store.snapshot();
    assert.equal(after.entries.length, 2);
    assert(after.entries.some((row) => row.id === retained.id));
    const restored = after.entries.find((row) => row.id !== retained.id);
    assert.equal(
        restored.origin.sourceAlias,
        imported.origin.sourceAlias,
        "second F re-adds the same imported identity"
    );
    state = {
        generation: state.generation + 1,
        phase: "playing",
        target: { channelId: 8, kind: "live", sourceId: "m3u:source" },
    };
    assert.equal(
        f.host.router.captureCurrent(),
        null,
        "manual channel switch retires the imported identity"
    );
    const manualItem = (await f.host.currentItem()).entry;
    assert.equal(
        manualItem.origin.sourceAlias,
        imported.origin.sourceAlias,
        "manual entry uses the verified profile binding, not prior playback provenance"
    );
    assert.equal(
        manualItem.locator.channelId,
        "m3u-epg:Other",
        "manual switch still captures the newly selected content"
    );
    f.host.dispose();
    const g = fixture(),
        gw = g.w;
    let gs = {
        generation: 1,
        phase: "playing",
        target: { channelId: 7, kind: "live", sourceId: "m3u:source" },
    };
    gw._playSession = 1;
    gw.__ottClassicPlayback = { checkpoint() {}, snapshot: () => gs };
    gw.__ottChannels = { index: () => 0 };
    gw.catsArray = ["all"];
    gw.cats = { all: [7] };
    gw.playChannel = (group, index, force, current) => {
        assert(current());
        gw._playSession++;
        gs = {
            generation: gs.generation + 1,
            phase: "playing",
            target: { channelId: 7, kind: "live", sourceId: "m3u:source" },
        };
        return true;
    };
    await g.host.committer.qualify();
    let gb = await g.host.store.snapshot();
    await g.host.store.mutate(gb.revision, {
        entries: [
            {
                locator: { channelId: "m3u-epg:News", kind: "channel" },
                origin: {
                    profile: "Profile",
                    provider: "m3u",
                    sourceAlias: "Profile",
                    subprofile: null,
                },
                title: "Automatic mapping",
            },
        ],
        op: "put",
    });
    const gid = (await g.host.store.snapshot()).entries[0].id;
    assert.equal((await g.host.router.select(gid).result).status, "ok");
    assert(g.host.router.captureCurrent());
    const bindingKey = "favorites-bindings.v1",
        binding = JSON.parse(g.data.get(bindingKey));
    binding.revision++;
    g.data.set(bindingKey, JSON.stringify(binding));
    assert.equal(
        g.host.router.captureCurrent(),
        null,
        "automatically persisted mapping is pinned after handoff"
    );
    g.host.dispose();
    console.log(
        "PASS actual host imported-playing identity, fullscreen toggle and manual-switch retirement"
    );
    console.log(
        "PASS actual cold host describe and complete/partial migration tombstones after history changes"
    );
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
