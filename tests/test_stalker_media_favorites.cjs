"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");
const { actualModule } = require("./helpers/global-favorites-main-ports.cjs");

function moduleAt(file, deps = {}) {
    const exports = {};
    vm.runInNewContext(
        ts.transpileModule(fs.readFileSync(file, "utf8"), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES5,
            },
        }).outputText,
        {
            exports,
            require: (id) => {
                if (id === "../offline/local-item-path")
                    return actualModule("src/offline/local-item-path.ts", {});
                assert(deps[id], id);
                return deps[id];
            },
        }
    );
    return exports;
}
const identities = moduleAt("src/media/global-favorites-identities.ts");
const capture = moduleAt("src/media/global-favorites-capture.ts", {
    "./global-favorites-identities": identities,
    "./global-favorites-providers": actualModule(
        "src/media/global-favorites-providers.ts",
        {}
    ),
}).captureGlobalFavorite;
const codec = moduleAt(
    "src/settings/global-favorites-portable.ts"
).createGlobalFavoritesPortableCodec();
const ast = ts.createSourceFile(
    "player.ts",
    fs.readFileSync("src/media/global-favorites-player.ts", "utf8"),
    ts.ScriptTarget.Latest,
    true
);
function declaration(name) {
    let found;
    function visit(node) {
        if (ts.isFunctionDeclaration(node) && node.name?.text === name)
            found = node;
        else ts.forEachChild(node, visit);
    }
    visit(ast);
    assert(found);
    return ts.transpileModule(found.getText(ast), {
        compilerOptions: { target: ts.ScriptTarget.ES5 },
    }).outputText;
}
function fixture() {
    const key = "stalker-media:W1siYyIsImEiXSxbInYiLCI0MiJdXQ";
    const payload = {
        adult: 0,
        itemId: key,
        request: {
            id: "classic-stalker:stalker:vod:42",
            key,
            kind: "stalker-media",
            path: [
                {
                    id: "classic-stalker:stalker:category:a",
                    type: "portal-category",
                },
            ],
        },
        stalkerSource: "media:stalker:0",
        title: "Film",
    };
    const row = {
        __ottMediaItem: payload,
        __ottMediaProvider: "stalker",
        __ottStalkerMediaKey: key,
        channel_name: "Film",
        itemId: key,
    };
    const state = { generation: 7, phase: "stopped", target: null };
    const driver = {
        catalogLoading: () => false,
        configuration: () => ({ active: 0 }),
        id: "stalker",
    };
    const media = {
        payload: { ...payload, request: structuredClone(payload.request) },
        ref: { itemId: "provider:" + key, sourceId: payload.stalkerSource },
    };
    const w = {
        __ottActiveProviderDriver: driver,
        __ottChannelReferences: {
            create: () => ({
                project: (ref) =>
                    Object.keys(w.channels).find(
                        (id) => w.channels[id].itemId === ref.itemId
                    ) ?? null,
                resolve: (id) => ({ itemId: w.channels[id]?.itemId }),
            }),
        },
        __ottClassicPlayback: { snapshot: () => state },
        __ottCommandChannelLoad: {},
        __ottMedia: { current: () => media },
        __ottParental: { needs: () => false },
        __ottProviderDriverProfiles: [
            { id: "stalker", kind: "stalker", prefix: "", title: "Stalker" },
        ],
        __ottSourceIdentity: {
            current: () => "stalker:0",
            media: () => "media:stalker:0",
        },
        _playSession: 9,
        channels: { 42: row },
        cList: [42],
    };
    driver.hasMediaKey = (wanted) => w.cList.length > 0 && wanted === key;
    const player = {
        allowed: () => true,
        captureSelector: async () => ({ provider: "stalker", slot: 0 }),
        selected: () => ({ name: "My portal" }),
    };
    return { driver, key, media, payload, player, row, state, w };
}

test("Favorites capture accepts the selected current row while nothing plays", async () => {
    const f = fixture();
    const result = await capture(f.w, f.player, codec, f.payload);
    assert(result);
    assert.deepEqual(JSON.parse(JSON.stringify(result.value.locator)), {
        channelId: f.key,
        kind: "channel",
    });
    assert.equal(result.slot, 0);
    assert.equal(result.value.origin.subprofile, null);
    const exported = JSON.stringify(result.value);
    for (const secret of [
        "https:",
        "Bearer",
        "portalGeneration",
        "request",
        "cmd",
    ])
        assert(!exported.includes(secret));
    f.w.__ottCommandChannelLoad = {};
    assert.equal(
        result.current(),
        false,
        "captured load token cannot survive catalog replacement"
    );
});

test("copied, foreign-source, duplicate, adult and stale-profile payloads are rejected", async () => {
    let f = fixture();
    assert.equal(
        await capture(f.w, f.player, codec, structuredClone(f.payload)),
        null
    );
    f.payload.stalkerSource = "media:stalker:1";
    assert.equal(await capture(f.w, f.player, codec, f.payload), null);
    f = fixture();
    f.w.cList.push(43);
    f.w.channels[43] = f.row;
    assert.equal(await capture(f.w, f.player, codec, f.payload), null);
    f = fixture();
    f.payload.adult = 1;
    f.w.__ottParental.needs = () => true;
    assert.equal(await capture(f.w, f.player, codec, f.payload), null);
    f = fixture();
    f.player.captureSelector = async () => {
        f.w.__ottActiveProviderDriver = { id: "stalker" };
        return {};
    };
    assert.equal(await capture(f.w, f.player, codec, f.payload), null);
    f = fixture();
    f.row.__ottStalkerMediaKey = "stalker-media:forged";
    assert.equal(identities.globalFavoriteChannelId("stalker", f.row), null);
    assert.equal(
        identities.globalFavoriteChannelId("m3u", fixture().row),
        null
    );
});

test("current described media copy captures only its exact source and request", async () => {
    const f = fixture();
    f.state.phase = "playing";
    f.state.target = {
        channelId: f.media.ref.itemId,
        kind: "vod",
        sourceId: f.media.ref.sourceId,
    };
    assert(await capture(f.w, f.player, codec));
    f.media.payload.request.id = "other";
    assert.equal(await capture(f.w, f.player, codec), null);
});

test("current Stalker media remains capturable alongside live channels", async () => {
    const f = fixture();
    f.w.cList.unshift(1);
    f.w.channels[1] = { channel_name: "Live", itemId: "live:1" };
    f.state.phase = "playing";
    f.state.target = {
        channelId: f.media.ref.itemId,
        kind: "vod",
        sourceId: f.media.ref.sourceId,
    };
    const result = await capture(f.w, f.player, codec);
    assert(result);
    assert.deepEqual(JSON.parse(JSON.stringify(result.value.locator)), {
        channelId: f.key,
        kind: "channel",
    });
    f.media.payload.request.id = "other";
    assert.equal(await capture(f.w, f.player, codec), null);
});

function resolver(f) {
    const timers = new Map(),
        pendingOperations = [];
    let seq = 0,
        current = true,
        allowed = true,
        now = 1000;
    f.w.setTimeout = (fn, delay) => {
        timers.set(++seq, { delay, fn });
        return seq;
    };
    f.w.clearTimeout = (id) => timers.delete(id);
    const scope = vm.createContext({
        Date: { now: () => now },
        driver: f.driver,
        pendingOperations,
        same: () => current,
        target: { origin: { subprofile: null }, selector: {} },
        w: f.w,
        ...identities,
        channel: (id, locator) => ({ available: true, id, locator }),
    });
    vm.runInContext(declaration("resolveItem"), scope);
    return {
        elapse: (ms) => {
            now += ms;
        },
        invalidate: () => {
            current = false;
        },
        pendingOperations,
        resolve: () =>
            scope.resolveItem(
                { channelId: f.key, kind: "channel" },
                () => allowed
            ),
        revoke: () => {
            allowed = false;
        },
        tick: (delay = 50) => {
            const entry = [...timers].find(
                ([, value]) => value.delay === delay
            );
            assert(entry);
            timers.delete(entry[0]);
            entry[1].fn();
        },
        timers,
    };
}

test("Favorites wait for first matching rescan leaf, without waiting for remaining branches", async () => {
    const f = fixture();
    f.w.cList = [];
    f.driver.catalogLoading = () => true;
    let scans = 0;
    f.w.cList.filter = function (predicate) {
        scans++;
        return Array.prototype.filter.call(this, predicate);
    };
    let starts = 0;
    f.driver.startMedia = () => starts++;
    const r = resolver(f);
    let settled = false;
    const result = r.resolve().then((value) => {
        settled = true;
        return value;
    });
    await Promise.resolve();
    assert.equal(settled, false);
    assert.equal(starts, 1);
    r.tick();
    r.tick();
    assert.equal(scans, 0, "pending polls use the collector index");
    f.w.cList.push(42);
    r.tick();
    assert.equal((await result).id, 42);
    assert.equal(scans, 1, "one final source/catalog attestation");
    assert.equal(r.timers.size, 0);
});

test("empty, failed, timed out and canceled rescans terminate without a playable target", async () => {
    for (const reason of [
        "empty",
        "failed",
        "timeout",
        "overdue",
        "profile",
        "access",
        "release",
    ]) {
        const f = fixture();
        f.w.cList = [];
        f.driver.catalogLoading = () => !["empty", "failed"].includes(reason);
        f.driver.catalogError = () => reason === "failed";
        const r = resolver(f),
            result = r.resolve();
        if (reason === "timeout") r.tick(120000);
        if (reason === "overdue") {
            r.elapse(120001);
            f.w.cList.push(42);
            r.tick();
        }
        if (reason === "profile") {
            r.invalidate();
            r.tick();
        }
        if (reason === "access") {
            r.revoke();
            r.tick();
        }
        if (reason === "release")
            r.pendingOperations.forEach((cancel) => cancel());
        assert.equal(await result, null, reason);
        assert.equal(r.timers.size, 0, reason);
    }
});

function proof(f) {
    f.state.phase = "playing";
    f.state.target = {
        channelId: f.media.ref.itemId,
        kind: "vod",
        sourceId: f.media.ref.sourceId,
    };
    const scope = vm.createContext({
        driver: f.driver,
        expectedLoad: f.w.__ottCommandChannelLoad,
        playbackItem: {
            id: 42,
            locator: { channelId: f.key, kind: "channel" },
        },
        source: "stalker:0",
        target: {
            current: () => true,
            origin: { subprofile: null },
            selector: {},
        },
        w: f.w,
        ...identities,
    });
    vm.runInContext(declaration("capturePlayback"), scope);
    return scope.capturePlayback();
}

test("Stalker media proof binds source, canonical request, load token, generation and session", () => {
    for (const change of [
        (f) => {
            f.media.ref.itemId = "other";
        },
        (f) => {
            f.media.ref.sourceId = "media:stalker:1";
        },
        (f) => {
            f.media.payload.stalkerSource = "media:stalker:1";
        },
        (f) => {
            f.row.__ottMediaItem.request = {
                id: "other",
                key: f.key,
                kind: "stalker-media",
            };
        },
        (f) => {
            f.media.payload.request.id = "other";
        },
        (f) => {
            f.w.__ottCommandChannelLoad = {};
        },
        (f) => {
            f.state.generation++;
        },
        (f) => {
            f.w._playSession++;
        },
        (f) => {
            f.w.__ottActiveProviderDriver = { id: "stalker" };
        },
    ]) {
        const f = fixture(),
            p = proof(f);
        assert(p);
        assert(p.current());
        assert(p.matches({ __ottGlobalChannel: 42 }));
        assert(p.matches({ __ottMediaRef: f.media.ref }));
        change(f);
        assert.equal(p.current(), false);
    }
});

test("only a prepared EOF accepts the next stopped generation", () => {
    const f = fixture(),
        p = proof(f),
        end = p.prepareEnded(7);
    assert.equal(typeof end, "function");
    assert.equal(end(), false);
    f.state.phase = "paused";
    assert(p.current());
    f.state.phase = "stopped";
    f.state.generation = 8;
    assert.equal(p.current(), false);
    assert.equal(end(), true);
    assert.equal(p.prepareEnded(8), null);
    f.w.__ottCommandChannelLoad = {};
    assert.equal(end(), false);
});
