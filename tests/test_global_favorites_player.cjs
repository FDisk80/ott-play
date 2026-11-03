"use strict";
const {
    actualModule,
    createMainPorts,
} = require("./helpers/global-favorites-main-ports.cjs");
const assert = require("node:assert/strict"),
    fs = require("node:fs"),
    vm = require("node:vm"),
    ts = require("typescript");
const { createHash } = require("node:crypto");
const { fixture } = require("./helpers/provider-driver-fixture.cjs");
function moduleAt(file, deps, window) {
    const exports = {};
    vm.runInNewContext(
        ts.transpileModule(fs.readFileSync(file, "utf8"), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES5,
            },
        }).outputText,
        {
            Array,
            Error,
            exports,
            isFinite,
            JSON,
            Math,
            Number,
            Object,
            Promise,
            require: (name) => {
                if (
                    name === "../offline/local-item-path" ||
                    name === "./local-item-path"
                )
                    return actualModule(
                        "src/offline/local-item-path.ts",
                        window || {}
                    );
                if (name === "./global-favorites-providers")
                    return actualModule(
                        "src/media/global-favorites-providers.ts",
                        window || {}
                    );
                if (!deps[name]) throw new Error(name);
                return deps[name];
            },
            String,
            window,
        }
    );
    return exports;
}
const identities = moduleAt("src/media/global-favorites-identities.ts", {});
const selectors = moduleAt("src/settings/global-favorites-bindings.ts", {});
function setup() {
    const f = fixture({
        m3um3uArr: JSON.stringify({
            active: 0,
            M3Us: [
                { name: "One", rechours: 0, www: "https://one.test/list" },
                { name: "Two", rechours: 0, www: "https://two.test/list" },
            ],
        }),
    });
    const w = f.host,
        driver = f.mount("m3u"),
        timers = new Map();
    let sequence = 0;
    w.__ottStandby = { blocked: () => false };
    w.__ottKiosk = { enabled: () => false, locked: () => false };
    w.__ottParental = { needs: () => false };
    w.__ottCommandChannelLoad = {};
    w.commandChannelsReady = false;
    w.__ottSourceIdentity = {
        current: () => "m3u:" + driver.configuration().active,
    };
    w.setTimeout = (fn) => {
        timers.set(++sequence, fn);
        return sequence;
    };
    w.clearTimeout = (id) => timers.delete(id);
    w.loadPlaylist = () => {
        w.commandChannelsReady = false;
        w.__ottCommandChannelLoad = {};
        driver.load((catalog, error) => {
            assert.equal(error, undefined);
            w.channels = catalog.channels;
            w.cList = catalog.ids;
            w.cats = catalog.groups;
            w.catsArray = catalog.groupOrder;
            w.onChannelsLoaded();
            w.commandChannelsReady = true;
        });
    };
    const player = moduleAt(
        "src/media/global-favorites-player.ts",
        {
            "../settings/global-favorites-bindings": selectors,
            "./global-favorites-identities": identities,
        },
        w
    ).createGlobalFavoritesPlayer(w, {
        ...createMainPorts(w),
        bindings: { list: () => ({ entries: [] }) },
        current: () => true,
        sha256: async (text) => createHash("sha256").update(text).digest("hex"),
    });
    const loadedSource = ts.createSourceFile(
        "channels.ts",
        fs.readFileSync("src/channels/index.ts", "utf8"),
        ts.ScriptTarget.Latest,
        true
    );
    const loaded = loadedSource.statements.find(
        (n) =>
            ts.isFunctionDeclaration(n) && n.name?.text === "onChannelsLoaded"
    );
    let mounts = 0,
        restores = 0,
        opens = 0;
    w.document = { getElementById: () => null };
    w.loadFavoritesLists = () => {};
    w.__ottClassicPlayback = { hydrate() {} };
    w.__ottMedia = {
        restoreLast: () => {
            restores++;
            return false;
        },
        sourceId: () => "source",
        useSource() {},
    };
    w.popMedia = () => opens++;
    w.restoreContinueWatch = () => {
        restores++;
        return false;
    };
    w.loadEpgTimers = () => {};
    vm.runInContext(
        ts.transpileModule(
            loaded.getText(loadedSource).replace(/^export /, ""),
            {
                compilerOptions: {
                    module: ts.ModuleKind.None,
                    target: ts.ScriptTarget.ES5,
                },
            }
        ).outputText,
        w
    );
    w.__ottChannels = { index: () => 0, mount: () => mounts++ };
    let played = [];
    w.playChannel = (group, index, _force, current) => {
        assert(current());
        played.push(w.cats[w.catsArray[group]][index]);
        return true;
    };
    return {
        driver,
        f,
        get mounts() {
            return mounts;
        },
        get opens() {
            return opens;
        },
        played,
        player,
        get restores() {
            return restores;
        },
        timers,
        w,
    };
}
async function flush() {
    for (let i = 0; i < 20; i++) await Promise.resolve();
}
async function main() {
    const s = setup(),
        origin = {
            profile: "Two",
            provider: "m3u",
            sourceAlias: "Two",
            subprofile: null,
        };
    const target = await s.player.choiceTarget(origin, {
        alias: "Two",
        label: "Two",
        profile: "Two",
        provider: "m3u",
        slot: 1,
    });
    assert(target && target.current());
    const pending = s.player.activate(target, () => true);
    await flush();
    assert.equal(
        s.driver.configuration().active,
        1,
        "actual handleRemoteProfiles selected second configured slot"
    );
    assert.equal(
        s.played.length,
        0,
        "profile transition must not play the previous cursor"
    );
    assert(s.f.requests[0].settings.url.includes("two.test"));
    s.f.requests[0].resolve(
        '#EXTM3U\n#EXTINF:-1 tvg-id="Second.ID" group-title="News",Two\nhttps://stream.test/two\n'
    );
    for (const [id, callback] of [...s.timers]) {
        s.timers.delete(id);
        callback();
    }
    await flush();
    const session = await pending,
        resolved = await session.resolve(
            { channelId: "m3u-epg:Second.ID", kind: "channel" },
            () => true
        );
    assert(resolved && resolved.available);
    assert.equal(await session.play(resolved, () => true), true);
    assert.equal(s.played.length, 1);
    assert.equal(s.mounts, 1, "actual startup handler still mounts catalog");
    assert.equal(
        s.restores,
        0,
        "actual startup handler does not restore old media"
    );
    session.complete();
    assert.equal(s.w.__ottGlobalFavoritesHandoff, null);
    const names = await s.player.choices("m3u");
    assert.equal(names.length, 2);
    assert.equal(
        await s.player.choiceTarget(origin, {
            alias: "Two",
            label: "wrong",
            profile: "Two",
            provider: "m3u",
            slot: 1,
        }),
        null,
        "unregistered fabricated choice is rejected"
    );
    s.driver.saveConfiguration({
        ...s.driver.configuration(),
        M3Us: s.driver
            .configuration()
            .M3Us.map((row, i) =>
                i === 1 ? { ...row, www: "https://changed.test" } : row
            ),
    });
    assert.equal(
        target.current(),
        false,
        "changed configured source invalidates private target"
    );
    const late = setup();
    let admission = true;
    const lateTarget = await late.player.choiceTarget(origin, {
        alias: "Two",
        label: "Two",
        profile: "Two",
        provider: "m3u",
        slot: 1,
    });
    const failed = late.player
        .activate(lateTarget, () => admission)
        .then(
            () => false,
            () => true
        );
    await flush();
    admission = false;
    for (const [id, callback] of [...late.timers]) {
        late.timers.delete(id);
        callback();
    }
    assert.equal(await failed, true);
    assert(
        late.w.__ottGlobalFavoritesHandoff.cancelled,
        "cancel retains an owned late-load tombstone"
    );
    late.driver.capabilities.libraryOnly = true;
    late.driver.libraryReady = () => true;
    late.w.providerMediaClient = {};
    late.w.getMediaArray = () => {};
    late.w.onChannelsLoaded();
    assert.equal(late.played.length, 0);
    assert.equal(late.restores, 0);
    assert.equal(late.opens, 0, "cancelled library startup cannot reopen UI");
    assert.equal(late.w.__ottGlobalFavoritesHandoff, null);
    late.w.onChannelsLoaded();
    assert.equal(
        late.restores,
        0,
        "non-Plex library fallback does not call Plex restoreLast"
    );
    assert.equal(
        late.opens,
        1,
        "positive control reaches normal library fallback when no handoff owns it"
    );
    const map = new Map(),
        before = JSON.stringify({
            active: 0,
            profiles: Array.from({ length: 15 }, (_, i) =>
                i < 2
                    ? {
                          binding_id:
                              "00000000-0000-4000-8000-" +
                              String(i + 1).padStart(12, "0"),
                          name: "Local" + i,
                          provider: "offline",
                          selected: null,
                          sources: [],
                          version: 1,
                      }
                    : null
            ),
            version: 1,
        });
    map.set("offlineProfiles", before);
    let writes = 0,
        reloads = 0,
        localAdmission = true;
    const local = {
        __ottActiveProviderDriver: { id: "offline" },
        __ottKiosk: { enabled: () => false },
        __ottParental: { needs: () => false },
        loadChannels: () => reloads++,
        stbDelItem: (key) => {
            writes++;
            map.delete(key);
        },
        stbGetItem: (key) => map.get(key) || null,
        stbSetItem: (key, value) => {
            writes++;
            map.set(key, value);
        },
    };
    const settings = moduleAt("src/settings/store.ts", {}, local);
    const install = moduleAt(
        "src/offline/profiles.ts",
        { "../settings/store": settings },
        local
    ).installOfflineProfiles;
    const api = install(local, { libraryIdentity: () => "tauri" });
    const queued = api.request(
        { action: "profile", params: { number: 2 } },
        () => localAdmission
    );
    localAdmission = false;
    assert.equal((await queued).status, "rejected");
    assert.equal(writes, 0);
    assert.equal(reloads, 0);
    assert.equal(map.get("offlineProfiles"), before);
    localAdmission = true;
    const accepted = await api.request(
        { action: "profile", params: { number: 2 } },
        () => localAdmission
    );
    assert.equal(accepted.status, "ok");
    assert.equal(writes, 1);
    assert.equal(reloads, 1);
    assert.equal(
        JSON.parse(map.get("offlineProfiles")).active,
        1,
        "positive control performs the real settings transaction"
    );
    console.log(
        "PASS actual startup suppression, late-cancelled library fallback, and queued Local profile admission"
    );
    console.log(
        "PASS actual M3U driver + actual profile operation + exact global route"
    );
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
