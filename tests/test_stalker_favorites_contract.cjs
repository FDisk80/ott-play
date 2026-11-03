"use strict";

// Golden keys come from the shipped Stalker driver AND bundled provider core.
// The test never substitutes another encoder for the production key(path, id).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const driverFixture = require("./helpers/stalker-driver-fixture.cjs");
const { actualModule } = require("./helpers/global-favorites-main-ports.cjs");
const {
    fixture: storeFixture,
    hash,
    load,
} = require("./global-favorites-fixture.cjs");
const fixturePath = path.join(
    __dirname,
    "fixtures/stalker-favorites-typed-path-v1.json"
);
const codec = load(
    "src/settings/global-favorites-portable.ts"
).createGlobalFavoritesPortableCodec();
const clone = (value) => JSON.parse(JSON.stringify(value));
const specs = [
    { category: "films", folders: [], id: "movie", leaf: "42" },
    {
        category: "series",
        folders: [{ flag: "is_series", id: "20", type: "portal-movie" }],
        id: "movie-folder",
        leaf: "42",
    },
    {
        category: "series",
        folders: [
            { flag: "is_series", id: "20", type: "portal-movie" },
            { flag: "is_season", id: "2", type: "portal-season" },
        ],
        id: "season-folder",
        leaf: "42",
    },
    {
        category: "series",
        folders: [
            { flag: "is_series", id: "20", type: "portal-movie" },
            { flag: "is_season", id: "2", type: "portal-season" },
            { flag: "is_episode", id: "3", type: "portal-episode" },
        ],
        id: "episode-folder",
        leaf: "file-1",
    },
    {
        category: "日本",
        folders: [{ flag: "is_season", id: "сезон", type: "portal-season" }],
        id: "unicode",
        leaf: "эпизод",
    },
    {
        category: "a/b:c%2F",
        folders: [{ flag: "is_season", id: 's "1"', type: "portal-season" }],
        id: "escaped-id",
        leaf: "v/7:50%",
    },
    {
        category: "root",
        folders: Array.from({ length: 7 }, (_, i) => ({
            flag: "is_series",
            id: String(i),
            type: "portal-movie",
        })),
        id: "eight-folders",
        leaf: "v",
    },
    { category: "a", folders: [], id: "maximum-key", leaf: "v".repeat(161) },
    { category: "", folders: [], id: "empty-category", leaf: "42" },
    { category: " \t", folders: [], id: "untrimmed-category", leaf: "42" },
    {
        category: "a\u0001b",
        folders: [{ flag: "is_series", id: "x\u0001y", type: "portal-movie" }],
        id: "c0-provider-ids",
        leaf: "v\u0000\b\f\n\r\tx",
    },
    {
        category: "a",
        folders: [],
        id: "trimmed-leaf",
        leaf: " \nleaf\t ",
        normalizedLeaf: "leaf",
    },
];
const movie = (id, name = "Fixture film") => ({
    cmd: "ffmpeg https://media.test/fresh.mp4",
    id,
    name,
});

function setup(source, liveId = "42") {
    const f = driverFixture({
        config: {
            mac: "02:00:00:00:00:01",
            name: "Fixture portal",
            portal: "https://portal.test/c/",
        },
    });
    const timers = new Map();
    let next = 0;
    f.host.setTimeout = (callback, delay) => {
        timers.set(++next, { callback, delay });
        return next;
    };
    f.host.clearTimeout = (id) => timers.delete(id);
    f.ports.sourceIdentity = () => source;
    f.driver.load((catalog, error) => {
        assert(!error, String(error));
        if (catalog.incremental && f.catalog) {
            f.catalog.ids.push(...catalog.ids);
            Object.assign(f.catalog.channels, catalog.channels);
        } else f.catalog = catalog;
    });
    f.respond = (js) => f.requests.at(-1).done({ js });
    f.page = (data) => f.respond({ data, total_items: data.length });
    f.params = () =>
        new URL(JSON.parse(f.requests.at(-1).settings.data).url).searchParams;
    f.tick = () => {
        const timer = [...timers].find(([, value]) => value.delay === 0);
        if (!timer) return false;
        timers.delete(timer[0]);
        timer[1].callback();
        return true;
    };
    f.respond({ token: "fixture-token" });
    f.respond({ id: "1", status: "0" });
    f.respond([{ id: "live", title: "News" }]);
    f.page([
        {
            cmd: "https://media.test/live.m3u8",
            id: liveId,
            name: "Fixture live",
            use_http_tmp_link: 0,
        },
    ]);
    f.source = source;
    f.rows = () =>
        f.catalog.ids
            .map((id) => f.catalog.channels[id])
            .filter((row) => row.__ottMediaItem);
    return f;
}
function scan(f, spec) {
    f.driver.startMedia();
    f.respond([{ id: spec.category, title: "Fixture category" }]);
    for (const folder of spec.folders) {
        assert(f.tick());
        f.page([{ id: folder.id, name: "Fixture folder", [folder.flag]: 1 }]);
    }
    if (f.driver.catalogLoading()) {
        assert(f.tick());
        if (f.driver.catalogLoading()) f.page([movie(spec.leaf)]);
    }
    f.tick();
    return f.rows();
}
function host(f) {
    const w = f.host;
    Object.assign(w, {
        __ottActiveProviderDriver: f.driver,
        __ottClassicPlayback: {
            snapshot: () => ({ generation: 1, phase: "stopped", target: null }),
        },
        __ottCommandChannelLoad: {},
        __ottParental: { needs: () => false },
        __ottProviderDriverProfiles: [
            { id: "stalker", kind: "stalker", prefix: "", title: "Stalker" },
        ],
        __ottSourceIdentity: {
            current: () => "profile:" + f.source,
            media: () => f.source,
        },
        channels: f.catalog.channels,
        cList: Array.from(f.catalog.ids),
    });
    w.__ottChannelReferences = {
        create: () => ({
            project: (reference) =>
                Object.keys(w.channels).find(
                    (id) => w.channels[id].itemId === reference.itemId
                ) ?? null,
            resolve: (id) => ({ itemId: w.channels[id]?.itemId }),
        }),
    };
    return w;
}
async function capture(f, row) {
    const w = host(f);
    return actualModule(
        "src/media/global-favorites-capture.ts",
        w
    ).captureGlobalFavorite(
        w,
        {
            allowed: () => true,
            captureSelector: async () => ({ provider: "stalker", slot: 0 }),
            selected: () => ({ name: "Fixture portal" }),
        },
        codec,
        row.__ottMediaItem || { __ottGlobalChannel: row.ch_id }
    );
}
const playerAst = ts.createSourceFile(
    "player.ts",
    fs.readFileSync(
        path.join(__dirname, "../src/media/global-favorites-player.ts"),
        "utf8"
    ),
    ts.ScriptTarget.Latest,
    true
);
let resolveSource;
(function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "resolveItem")
        resolveSource = node.getText(playerAst);
    else ts.forEachChild(node, visit);
})(playerAst);
assert(resolveSource, "actual Favorites resolver exists");
const resolveCode = ts.transpileModule(resolveSource, {
    compilerOptions: { target: ts.ScriptTarget.ES5 },
}).outputText;
async function resolve(f, locator, current = () => true) {
    const w = host(f),
        pendingOperations = [];
    const context = vm.createContext({
        Date,
        driver: f.driver,
        pendingOperations,
        same: current,
        target: { origin: { subprofile: null }, selector: {} },
        w,
        ...actualModule("src/media/global-favorites-identities.ts", w),
        channel: (id, selected) => ({ available: true, id, locator: selected }),
    });
    vm.runInContext(resolveCode, context);
    return context.resolveItem(locator, current);
}
function freshPlayback(f, spec, row, mode = "ok") {
    let result = "pending";
    const media = f.driver.mediaClient();
    const saved = media.persist(row.__ottMediaItem);
    if (mode === "foreign-source")
        saved.__ottMediaRef = {
            itemId: "provider:" + row.itemId,
            sourceId: "other-profile",
        };
    const before = f.requests.length;
    media.resolve(saved, (value) => {
        result = value;
    });
    if (mode === "foreign-source") {
        assert.equal(f.requests.length, before);
        return result;
    }
    if (mode === "missing-category") {
        f.respond([]);
        return result;
    }
    f.respond([{ id: spec.category, title: "Renamed category" }]);
    for (const folder of spec.folders)
        f.page([{ id: folder.id, name: "Renamed folder", [folder.flag]: 1 }]);
    f.page([movie(spec.leaf, "Renamed film")]);
    assert.equal(f.params().get("action"), "create_link");
    f.respond({ cmd: "ffmpeg https://media.test/resolved-now.mp4" });
    return result;
}

// Import through the actual staged protocol and durable browser store, then
// export its frozen snapshot. This also checks receipts and canonical bytes.
async function transfer(entries) {
    const f = storeFixture();
    let serial = 0;
    const ports = {
        authorized: () => true,
        base64Decode: (s) => new Uint8Array(Buffer.from(s, "base64")),
        base64Encode: (b) => Buffer.from(b).toString("base64"),
        captureContext: async () => ({
            current: () => true,
            revision: f.context,
        }),
        clearTimer() {},
        codec: f.codec,
        committer: f.committer,
        current: () => true,
        facade: {
            exportSnapshot: async () => {
                const s = await f.store.snapshot();
                return {
                    current: s.current,
                    document: f.codec.document({
                        entries: s.entries.map(
                            ({ title, origin, locator }) => ({
                                locator,
                                origin,
                                title,
                            })
                        ),
                        version: 1,
                    }),
                };
            },
        },
        locatorKinds: [
            "channel",
            "channel-name",
            "local-media",
            "plex-media",
            "vportal-media",
        ],
        now: () => 1000000,
        resolve: async (rows) => rows.map(() => "missing"),
        runtime: () => "receiver-runtime",
        setTimer: () => 1,
        sha256: async (bytes) => hash(bytes),
        store: f.store,
        uuid: () =>
            `20000000-0000-4000-8000-${String(++serial).padStart(12, "0")}`,
    };
    const api = load(
        "src/commands/global-favorites-protocol.ts"
    ).createGlobalFavoritesProtocol(ports);
    f.hooks.authority = (id, digest) => api.freshAdmission(id, digest);
    f.hooks.statusAllowed = true;
    const call = (op, data = {}) =>
        api.execute({ op, runtime: "receiver-runtime", ...data }, 512, 1030);
    const document = f.codec.document({ entries, version: 1 });
    assert(document);
    const bytes = Buffer.from(JSON.stringify(document));
    assert(bytes.length <= 8192);
    const d = await call("describe"),
        b = await call("begin", {
            budget_ms: 30000,
            chunk_count: 1,
            document_sha256: hash(bytes),
            expected_context_revision: d.context_revision,
            expected_revision: d.revision,
            mode: "replace",
            operation_id: d.admission.operation_id,
            required_kinds: f.codec.requiredLocatorKinds(document),
            size_bytes: bytes.length,
        });
    assert(!b.error, b.error);
    const appended = await call("append", {
        chunk_sha256: hash(bytes),
        data_base64: bytes.toString("base64"),
        offset: 0,
        seq: 0,
        transaction_id: b.transaction_id,
    });
    assert(!appended.error, appended.error);
    const preview = await call("preview", {
        max_entries: 64,
        page_offset: 0,
        transaction_id: b.transaction_id,
    });
    assert.equal(preview.ready, true);
    const commit = await call("commit", {
        operation_id: b.operation_id,
        plan_digest: preview.plan_digest,
        transaction_id: b.transaction_id,
    });
    assert.equal(commit.receipt.outcome, "verified");
    assert.equal(commit.receipt.result_document_sha256, hash(bytes));
    const exported = await call("describe"),
        chunk = await call("export", {
            max_bytes: 65536,
            offset: 0,
            snapshot_id: exported.export.snapshot_id,
        });
    const output = Buffer.from(chunk.data_base64, "base64");
    assert.deepEqual(output, bytes);
    assert.equal(chunk.document_sha256, hash(output));
    return JSON.parse(output.toString("utf8"));
}

async function main() {
    const cases = [],
        entries = [];
    for (const spec of specs) {
        const sender = setup("sender:" + spec.id);
        const [row] = scan(sender, spec);
        assert(row, spec.id);
        assert.equal(sender.driver.catalogError(), false, spec.id);
        const captured = await capture(sender, row);
        assert(captured, spec.id);
        const key = row.__ottStalkerMediaKey;
        const decoded = JSON.parse(
            Buffer.from(
                key.slice("stalker-media:".length),
                "base64url"
            ).toString("utf8")
        );
        const route = [
            { id: spec.category, type: "portal-category" },
            ...spec.folders.map(({ id, type }) => ({ id, type })),
        ];
        const codes = {
            "portal-category": "c",
            "portal-episode": "e",
            "portal-movie": "m",
            "portal-season": "s",
        };
        assert.deepEqual(
            decoded,
            [
                ...route.map((part) => [codes[part.type], part.id]),
                ["v", spec.normalizedLeaf ?? spec.leaf],
            ],
            spec.id
        );
        assert(key.length <= 256);
        if (spec.id === "maximum-key") assert.equal(key.length, 256);
        cases.push({
            channelId: key,
            document: clone(
                codec.document({ entries: [captured.value], version: 1 })
            ),
            id: spec.id,
            input: spec,
            leafId: spec.normalizedLeaf ?? spec.leaf,
            route,
        });
        assert(
            !/fixture-token|portal\.test|media\.test|02:00:|stalkerSource|"request"|"cmd"/.test(
                JSON.stringify(cases.at(-1).document)
            )
        );
        entries.push(captured.value);
        const originalSource = row.__ottMediaItem.stalkerSource;
        row.__ottMediaItem.stalkerSource = "foreign-runtime";
        assert.equal(await capture(sender, row), null);
        row.__ottMediaItem.stalkerSource = originalSource;
        const receiver = setup("receiver:" + spec.id);
        const [received] = scan(receiver, spec);
        assert.equal(
            received.__ottStalkerMediaKey,
            key,
            "source/runtime does not enter portable key"
        );
        const imported = await transfer([captured.value]);
        const resolved = await resolve(receiver, imported.entries[0].locator);
        assert(resolved, spec.id);
        assert.equal(receiver.catalog.channels[resolved.id].itemId, key);
        assert.equal(
            freshPlayback(receiver, spec, received).stream_url,
            "https://media.test/resolved-now.mp4"
        );
        assert.equal(
            freshPlayback(receiver, spec, received, "foreign-source"),
            null
        );
        assert.equal(
            freshPlayback(receiver, spec, received, "missing-category"),
            null
        );
        const extraId = 2000000000;
        receiver.catalog.ids.push(extraId);
        receiver.catalog.channels[extraId] = received;
        assert.equal(
            await resolve(receiver, imported.entries[0].locator),
            null,
            "duplicate catalog routes are ambiguous"
        );
        receiver.catalog.ids.pop();
        delete receiver.catalog.channels[extraId];
        const old = received.__ottMediaItem.stalkerSource;
        received.__ottMediaItem.stalkerSource = "other-profile";
        assert.equal(
            await resolve(receiver, imported.entries[0].locator),
            null
        );
        received.__ottMediaItem.stalkerSource = old;
        assert.equal(
            await resolve(receiver, imported.entries[0].locator, () => false),
            null
        );
        sender.driver.dispose();
        receiver.driver.dispose();
    }
    const sender = setup("sender:live"),
        live = sender.catalog.channels[sender.catalog.ids[0]],
        captured = await capture(sender, live);
    assert(captured);
    assert.deepEqual(clone(captured.value.locator), {
        group: null,
        kind: "channel-name",
        name: "Fixture live",
    });
    const receiver = setup("receiver:live", "77");
    scan(receiver, specs[0]);
    const imported = await transfer([captured.value]);
    const selected = await resolve(receiver, imported.entries[0].locator);
    assert.equal(
        String(selected.id),
        "77",
        "live Favorites survive numeric channel renumbering"
    );
    const exact = clone(captured.value);
    for (const field of ["profile", "provider", "sourceAlias"]) {
        const foreign = clone(exact.origin);
        foreign[field] = field === "provider" ? "bestlist/stalker" : "Other";
        assert.equal(
            codec.match(
                exact,
                [{ origin: foreign }],
                () => true,
                () => true
            ).status,
            "missing"
        );
    }
    assert.equal(
        codec.match(
            exact,
            [{ origin: exact.origin }, { origin: exact.origin }],
            () => true,
            () => true
        ).status,
        "ambiguous"
    );
    cases.unshift({
        document: clone(
            codec.document({ entries: [captured.value], version: 1 })
        ),
        id: "live",
        input: { liveId: "42", name: "Fixture live" },
    });
    const otherLive = clone(live);
    otherLive.ch_id = 99;
    otherLive.itemId = "other-live";
    live.category = { name: "Primary" };
    otherLive.category = { name: "Secondary" };
    sender.catalog.channels[99] = otherLive;
    sender.catalog.ids.push(99);
    const grouped = await capture(sender, live);
    assert(grouped);
    assert.deepEqual(clone(grouped.value.locator), {
        group: "Primary",
        kind: "channel-name",
        name: "Fixture live",
    });
    assert((await resolve(sender, grouped.value.locator)) !== null);
    assert.equal(
        await resolve(sender, { ...grouped.value.locator, group: "Missing" }),
        null
    );
    assert.equal(
        await resolve(sender, captured.value.locator),
        null,
        "duplicate live names require an exact group"
    );
    cases.push({
        document: clone(
            codec.document({ entries: [grouped.value], version: 1 })
        ),
        id: "live-exact-group",
    });
    const mixed = await transfer([...entries, captured.value, grouped.value]);
    assert.equal(mixed.entries.length, entries.length + 2);
    const key = cases[1].channelId;
    const alphabet =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const noncanonical =
        key.slice(0, -1) + alphabet[alphabet.indexOf(key.at(-1)) + 1];
    assert.deepEqual(
        Buffer.from(noncanonical.slice(14), "base64url"),
        Buffer.from(key.slice(14), "base64url")
    );
    const jsonKey = (value) =>
        "stalker-media:" +
        Buffer.from(JSON.stringify(value)).toString("base64url");
    const badKeys = [
        ["raw-live-id", "42"],
        ["invalid-utf8", "stalker-media:_w"],
        [
            "invalid-json",
            "stalker-media:" + Buffer.from("not-json").toString("base64url"),
        ],
        ["invalid-base64-length", "stalker-media:a"],
        ["noncanonical-base64", noncanonical],
        [
            "noncanonical-json",
            "stalker-media:" +
                Buffer.from('[ ["c","films"], ["v","42"] ]').toString(
                    "base64url"
                ),
        ],
        [
            "unknown-route-type",
            jsonKey([
                ["x", "films"],
                ["v", "42"],
            ]),
        ],
        [
            "numeric-provider-id",
            jsonKey([
                ["c", 1],
                ["v", "42"],
            ]),
        ],
        [
            "extra-tuple-field",
            jsonKey([
                ["c", "films", "unexpected"],
                ["v", "42"],
            ]),
        ],
        ["missing-leaf", jsonKey([["c", "films"]])],
        ["missing-folder", jsonKey([["v", "42"]])],
        [
            "empty-leaf",
            jsonKey([
                ["c", "films"],
                ["v", ""],
            ]),
        ],
        [
            "empty-movie-folder",
            jsonKey([
                ["c", "films"],
                ["m", ""],
                ["v", "42"],
            ]),
        ],
        [
            "missing-file",
            jsonKey([
                ["c", "films"],
                ["v", "not-in-catalog"],
            ]),
        ],
        [
            "repeated-ancestor",
            jsonKey([
                ["c", "films"],
                ["m", "same"],
                ["m", "same"],
                ["v", "42"],
            ]),
        ],
        [
            "overdeep-route",
            jsonKey([
                ...Array.from({ length: 9 }, (_, i) => ["c", String(i)]),
                ["v", "42"],
            ]),
        ],
        ["padding", cases[1].channelId + "="],
        ["oversize", "stalker-media:" + "A".repeat(243)],
    ];
    const canonicalIds = new Set([
        "unknown-route-type",
        "numeric-provider-id",
        "extra-tuple-field",
        "missing-leaf",
        "missing-folder",
        "empty-leaf",
        "empty-movie-folder",
        "missing-file",
        "repeated-ancestor",
        "overdeep-route",
    ]);
    const structuralIds = new Set([
        "noncanonical-base64",
        "noncanonical-json",
        "missing-file",
        "repeated-ancestor",
        "padding",
    ]);
    const invalid = [];
    for (const [id, key] of badKeys) {
        const entry = clone(entries[0]);
        entry.locator.channelId = key;
        const portable = !!codec.document({ entries: [entry], version: 1 });
        const canonicalEncoding = canonicalIds.has(id);
        if (canonicalEncoding)
            assert.equal(
                jsonKey(
                    JSON.parse(
                        Buffer.from(key.slice(14), "base64url").toString("utf8")
                    )
                ),
                key
            );
        invalid.push({
            canonicalEncoding,
            channelId: key,
            id,
            portable,
            resolves: false,
            structurallyValid: structuralIds.has(id),
        });
        if (portable) {
            const retained = await transfer([entry]);
            assert.deepEqual(retained.entries[0], entry);
            assert.equal(
                await resolve(receiver, retained.entries[0].locator),
                null,
                id
            );
        }
    }
    const deep = specs.find((spec) => spec.id === "eight-folders");
    for (const spec of [
        { ...specs[0], category: "x".repeat(300) },
        {
            ...deep,
            folders: [
                ...deep.folders,
                { flag: "is_series", id: "8", type: "portal-movie" },
            ],
        },
        {
            ...specs.find((spec) => spec.id === "maximum-key"),
            leaf: "v".repeat(162),
        },
    ]) {
        const over = setup("bounds");
        assert.equal(scan(over, spec).length, 0);
        assert.equal(over.driver.catalogError(), true);
        over.driver.dispose();
    }
    const producerRejected = [];
    for (const spec of [
        { category: "a", folders: [], id: "empty-leaf", leaf: "" },
        { category: "a", folders: [], id: "blank-leaf", leaf: " \n\t" },
        {
            category: "a",
            folders: [{ flag: "is_series", id: "", type: "portal-movie" }],
            id: "empty-movie-folder",
            leaf: "42",
        },
    ]) {
        const f = setup("rejected:" + spec.id);
        assert.equal(scan(f, spec).length, 0);
        assert.equal(f.driver.catalogError(), false);
        producerRejected.push({
            catalogError: false,
            input: spec,
            published: 0,
        });
        f.driver.dispose();
    }
    const artifact = {
        cases,
        evidence: {
            encoding:
                "stalker-media: + unpadded base64url of UTF-8 JSON typed tuples; last tuple is v leaf; at most eight folders and 256 total characters",
            invalid:
                "Generic portable channel IDs may be retained even when their Stalker route is unavailable",
            invalidProperties:
                "canonicalEncoding checks exact unpadded base64url and JSON.stringify bytes; structurallyValid checks the decoded typed route. Neither guarantees a current catalog match. Repeated ancestors are structurally valid but discovery refuses their cycle.",
            live: "channel-name uses exact name and optional exact group; raw live numbers are not media routes",
            producer:
                "src/provider/stalker-driver.ts:createStalkerMedia key(path,id), executed with vendor/ottplay-core.js",
            providerIds:
                "Category IDs preserve empty strings, whitespace and C0 characters. Leaf and media-folder IDs are trimmed by the core; empty results are omitted. Internal C0 characters are preserved and JSON-escaped.",
            resolver:
                "src/media/global-favorites-player.ts:resolveItem and actual driver mediaClient.resolve",
            transfer:
                "src/commands/global-favorites-protocol.ts staged import/commit/export",
        },
        invalid,
        producerRejected,
        version: 1,
    };
    if (process.argv.includes("--write"))
        fs.writeFileSync(fixturePath, JSON.stringify(artifact, null, 2) + "\n");
    else
        assert.deepEqual(
            JSON.parse(fs.readFileSync(fixturePath, "utf8")),
            artifact,
            "Stalker typed path fixture differs from actual driver/runtime"
        );
    sender.driver.dispose();
    receiver.driver.dispose();
    console.log(
        `Stalker Favorites contract: ${cases.length} actual-runtime routes, ${invalid.length} invalid/unavailable keys, staged transfers and fresh playback passed`
    );
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
