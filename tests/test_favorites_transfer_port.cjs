"use strict";
const storageImports =
    require("./helpers/remote-transfer-dependency.cjs").storage;
const assert = require("node:assert/strict"),
    fs = require("node:fs"),
    path = require("node:path"),
    vm = require("node:vm"),
    crypto = require("node:crypto"),
    ts = require("typescript");
const root = path.resolve(__dirname, "..");
function load(file, host, document = { cookie: "" }) {
    const context = vm.createContext({
        console,
        Date,
        document,
        Error,
        exports: {},
        Promise,
        require(name) {
            if (
                name === "./favorites-physical-storage" ||
                name === "../settings/interface-colors"
            )
                return storageImports().require(name);
            if (name === "./favorites-recovery-codec")
                return load(
                    "src/settings/favorites-recovery-codec.ts",
                    host,
                    document
                ).exports;
            throw new Error("Unexpected favorites fixture import: " + name);
        },
        Uint8Array,
        window: host,
    });
    vm.runInContext(
        ts.transpileModule(fs.readFileSync(root + "/" + file, "utf8"), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2018,
            },
        }).outputText,
        context
    );
    return context;
}
const scope = {
    profileBindingId: "11111111-1111-4111-8111-111111111111",
    provider: "plex",
    sourceBindingId: "22222222-2222-4222-8222-222222222222",
};
const tvSource = "plex@channel-source",
    mediaSource = "plex@media-source",
    tvKey = "plexfavoritesLibrary:" + tvSource,
    mediaKey = "plexmediaJournal.v1:" + mediaSource,
    receiptKey = "favorites-receipts.v1";
const op = "33333333-3333-4333-8333-333333333333",
    stage = "44444444-4444-4444-8444-444444444444";
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const plain = (value) => JSON.parse(JSON.stringify(value));
const ref = (id) => ({ itemId: "channel:plex-" + id });
const mediaRow = (id) => ({
    itemId: 'request:{"path":"/library/metadata/' + id + '"}',
    payload: {
        request: { path: "/library/metadata/" + id },
        title: "Synthetic",
    },
    position: 17,
    sourceId: mediaSource,
});
function fixture(saved, runtime = "runtime-1", backend = "local") {
    const originalTV = {
        defaultList: "Favorites",
        lists: {
            active: "Saved",
            lists: { Favorites: [ref("42")], Saved: [ref("42"), ref("99")] },
            order: ["Saved", "Favorites"],
            v: 1,
        },
        shuffleBefore: { Saved: [ref("99"), ref("42")] },
        sourceId: tvSource,
        version: 2,
    };
    const originalMedia = {
        extra: { retained: true },
        favorites: [mediaRow("42")],
        history: [mediaRow("41")],
        sourceId: mediaSource,
        version: 1,
    };
    saved =
        saved ||
        new Map([
            [tvKey, JSON.stringify(originalTV)],
            [mediaKey, JSON.stringify(originalMedia)],
        ]);
    let writeInterceptor = null;
    const rawWrite = (key, value) => saved.set(key, String(value));
    let locked = false;
    const locks = {
        request(_name, _options, callback) {
            if (locked) return Promise.resolve().then(() => callback(null));
            locked = true;
            return Promise.resolve()
                .then(() => callback({}))
                .finally(() => {
                    locked = false;
                });
        },
    };
    const localStorage = {
        clear() {
            saved.clear();
        },
        getItem: (k) => (saved.has(k) ? saved.get(k) : null),
        key: (i) => [...saved.keys()][i] || null,
        get length() {
            return saved.size;
        },
        removeItem: (k) => saved.delete(k),
        setItem: (k, v) =>
            writeInterceptor
                ? writeInterceptor(k, v, rawWrite)
                : rawWrite(k, v),
    };
    const host = {
        _: (value) => value,
        channels: {
            "plex-42": {
                __ottMediaItem: {
                    plexSource: mediaSource,
                    request: { path: "/library/metadata/42" },
                },
            },
        },
        localStorage,
        location: { origin: "https://player.example" },
        navigator: { locks },
        p_pref: "plex",
        sFavorites: 1,
    };
    let active = true,
        time = 1000;
    if (backend === "cookie") host.localStorage = null;
    const cookies = {
        get cookie() {
            return [...saved]
                .map(
                    ([key, value]) =>
                        encodeURIComponent(key) +
                        "=" +
                        encodeURIComponent(value)
                )
                .join("; ");
        },
        set cookie(text) {
            const part = text.split(";")[0],
                at = part.indexOf("="),
                key = decodeURIComponent(part.slice(0, at)),
                value = decodeURIComponent(part.slice(at + 1));
            if (/expires=Thu, 01 Jan 1970/.test(text)) saved.delete(key);
            else saved.set(key, value);
        },
    };
    const s = load(
            "src/storage/index.ts",
            host,
            backend === "cookie" ? cookies : { cookie: "" }
        ).exports,
        storage = s.storage;
    Object.assign(host, {
        ottpStorage: storage,
        stbDelItem: storage.del,
        stbGetItem: storage.get,
        stbGetPersistedItem: s.stbGetPersistedItem,
        stbSetItem: storage.set,
    });
    host.providerGetItem = (k) => storage.get("plex" + k);
    host.providerSetItem = (k, v) => storage.set("plex" + k, v);
    host.providerGetPersistedItem = (k) => s.stbGetPersistedItem("plex" + k);
    host.providerGetJson = (k, fallback) => {
        const raw = host.providerGetItem(k);
        return raw ? JSON.parse(raw) : fallback;
    };
    host.__ottSourceIdentity = {
        current: () => tvSource,
        media: () => mediaSource,
    };
    const proof = {
        current: () => active,
        serverId: "server-one",
        sourceId: mediaSource,
        verified: true,
    };
    host.__ottActiveProviderDriver = {
        favoritesSource: () => (active ? proof : null),
        id: "plex",
    };
    load("src/settings/favorites-bindings.ts", host);
    const bindingKey = "favorites-bindings.v1",
        ids = [
            scope.profileBindingId,
            scope.sourceBindingId,
            "66666666-6666-4666-8666-666666666666",
        ];
    const registry = host.__ottFavoritesBindings.create({
        compareAndSwap(before, after) {
            if (
                storage.get(bindingKey) !== before ||
                s.stbGetPersistedItem(bindingKey) !== before
            )
                return "conflict";
            storage.set(bindingKey, after);
            return s.stbGetPersistedItem(bindingKey) === after
                ? "confirmed"
                : "unknown";
        },
        current: (_entry, binding) =>
            active &&
            binding.owner === "synthetic-local-grant" &&
            binding.selector.target.indexOf("synthetic-") === 0,
        read: () => storage.get(bindingKey),
        uuid: () => ids.shift(),
        validateSelector: (_kind, selector) =>
            Object.keys(selector).join(",") === "target" &&
            typeof selector.target === "string",
    });
    if (!registry.list().entries.length) {
        registry.create(
            {
                binding: {
                    owner: "synthetic-local-grant",
                    selector: { target: "synthetic-current-profile" },
                },
                kind: "profile",
                provider: "plex",
            },
            0
        );
        registry.create(
            {
                binding: {
                    owner: "synthetic-local-grant",
                    selector: { target: "synthetic-current-source" },
                },
                kind: "source",
                profile_id: scope.profileBindingId,
                provider: "plex",
            },
            1
        );
    }
    function currentBinding(expected) {
        try {
            const profile = registry.resolve(expected.profileBindingId),
                source = registry.resolve(expected.sourceBindingId);
            if (
                expected.provider !== "plex" ||
                profile.entry.provider !== "plex" ||
                source.entry.provider !== "plex" ||
                source.entry.profile_id !== profile.entry.id ||
                profile.revision !== source.revision
            )
                return null;
            const captured = source.revision;
            return {
                current: () => {
                    try {
                        return (
                            active &&
                            registry.resolve(profile.entry.id).revision ===
                                captured &&
                            registry.resolve(source.entry.id).revision ===
                                captured
                        );
                    } catch (_) {
                        return false;
                    }
                },
                revision: String(captured),
            };
        } catch (_) {
            return null;
        }
    }
    const coreContext = vm.createContext({});
    coreContext.window = coreContext;
    host.OttPlayCore = require("./helpers/shared-core-runtime.cjs")(
        coreContext,
        { vendorOnly: true }
    );
    load("src/channels/channel-references.ts", host);
    load("src/channels/favorites-plex-references.ts", host);
    const favorites = load("src/channels/favorites-lists.ts", host).exports;
    favorites.loadFavoritesLists();
    load("src/media/journal.ts", host);
    const journal = host.__ottMediaJournal.create({
        core: host.OttPlayCore,
        current: () => active,
        enabled: () => host.sFavorites !== -1,
        importRows: () => [],
        limit: () => 1000,
        read: host.providerGetItem,
        sourceId: mediaSource,
        write: host.providerSetItem,
    });
    journal.read();
    const adapterSource = ts.createSourceFile(
        "classic-adapter.ts",
        fs.readFileSync(root + "/src/media/classic-adapter.ts", "utf8"),
        ts.ScriptTarget.Latest,
        true
    );
    let transferMethod;
    function find(node) {
        if (
            ts.isPropertyAssignment(node) &&
            node.name.getText(adapterSource) === "favoritesTransfer" &&
            node.initializer.getText(adapterSource).includes("journal.adopt")
        )
            transferMethod = node.getText(adapterSource);
        ts.forEachChild(node, find);
    }
    find(adapterSource);
    assert(transferMethod);
    const bridgeContext = vm.createContext({
        collections() {},
        context: null,
        current: () => active,
        journal,
        source: mediaSource,
        w: host,
    });
    vm.runInContext(
        ts.transpileModule(
            "var api={" + transferMethod + "};var mediaClassicInstance=api;",
            { compilerOptions: { target: ts.ScriptTarget.ES2018 } }
        ).outputText,
        bridgeContext
    );
    host.__ottMedia = {
        favoritesTransfer: (expected) =>
            expected === mediaSource
                ? bridgeContext.api.favoritesTransfer(expected)
                : null,
    };
    const json = load("src/commands/favorites-document-json.ts", host).exports;
    load("src/media/favorites-plex-codec.ts", host);
    const plex = host.__ottFavoritesPlexCodec
        ? host.__ottFavoritesPlexCodec.create
        : null;
    const plexContext = load("src/media/favorites-plex-codec.ts", host);
    const locator = plexContext.createFavoritesPlexCodec({
        current: () =>
            active
                ? {
                      serverId: "server-one",
                      sourceId: mediaSource,
                      verified: true,
                  }
                : null,
        request: (p) => ({ path: p }),
    });
    load("src/media/favorites-plex-document.ts", host);
    const codec = host.__ottFavoritesPlexDocument.create({
        current: () =>
            active ? { ...proof, channelSourceId: tvSource } : null,
        json: {
            encode: json.encodeFavoritesDocumentJson,
            parse: json.parseFavoritesDocumentJson,
        },
        plex: locator,
        references: host.__ottFavoritesPlexReferences.create(
            host.channels,
            proof
        ),
    });
    const receiptFactory = load(
        "src/settings/favorites-operation-receipts.ts",
        host
    ).createFavoritesOperationReceipts;
    const physical = s.captureFavoritesPhysicalStorage();
    const fence = physical
        ? {
              backendProof: hash(
                  JSON.stringify([
                      "ottplay-favorites-recovery-backend-v1",
                      physical.origin,
                      physical.privateLedgerKey,
                      physical.lockName,
                      physical.kind,
                      2,
                      physical.implementationVersion,
                  ])
              ),
              guardImplementationVersion: 1,
              version: 2,
          }
        : null;
    let writing = false;
    function exclusive(work) {
        if (!physical) return Promise.reject(Error("unsupported_persistence"));
        return physical.exclusive(async () => {
            writing = true;
            try {
                return await work();
            } finally {
                writing = false;
            }
        });
    }
    const ledger = receiptFactory({
        compareAndSwap(before, after) {
            if (
                storage.get(receiptKey) !== before ||
                s.stbGetPersistedItem(receiptKey) !== before
            )
                return "conflict";
            return physical
                ? physical.compareAndSwap(receiptKey, before, after)
                : "conflict";
        },
        current: (expected, refs) =>
            active &&
            expected.provider === "plex" &&
            refs.runtimeId === runtime,
        fence: () => fence,
        now: () => time,
        persistedRead: () => s.stbGetPersistedItem(receiptKey),
        read: () => storage.get(receiptKey),
        writeGuard: (value) =>
            writing &&
            physical &&
            physical.current() &&
            JSON.stringify(value) === JSON.stringify(fence),
    });
    const ports = {
        admitOperation: () => ({ budgetAccepted: true, operationFresh: true }),
        binding: currentBinding,
        document: codec,
        now: () => time,
        receipts: {
            current: () => active,
            factory: receiptFactory,
            physicalKey: receiptKey,
            service: ledger,
        },
        sha256: hash,
        utf8: (value) => new Uint8Array(Buffer.from(value)),
    };
    const adapter = load(
        "src/media/favorites-transfer-port.ts",
        host
    ).exports.createCurrentPlexFavoritesTransferPort(host, ports);
    const apply = adapter.apply;
    adapter.apply = (plan, context, current) =>
        exclusive(() => apply(plan, context, current));
    return {
        adapter,
        binding: () =>
            registry.create(
                {
                    binding: {
                        owner: "synthetic-local-grant",
                        selector: { target: "synthetic-extra-profile" },
                    },
                    kind: "profile",
                    provider: "plex",
                },
                registry.list().revision
            ),
        clock: (value) => {
            time = value;
        },
        codec,
        exclusive,
        favorites,
        host,
        interceptWrites: (callback) => {
            writeInterceptor = callback;
        },
        journal,
        json,
        ledger,
        originalMedia,
        originalTV,
        ports,
        proof,
        registry,
        runtime,
        saved,
        stop: () => {
            active = false;
        },
        storage,
    };
}
async function prepare(f, mutate, operationId = op) {
    const snapshot = await f.adapter.snapshot(scope, () => true),
        document = f.json.parseFavoritesDocumentJson(snapshot.bytes);
    if (mutate) mutate(document);
    const bytes = f.codec.encode(document);
    const context = {
        document_sha256: hash(bytes),
        operation_id: operationId,
        runtime: f.runtime,
        transaction_id: stage,
    };
    const admission = await f.adapter.inspect(scope, operationId, context),
        plan = await f.adapter.preview(bytes, scope, admission, () => true);
    return {
        context: {
            ...context,
            bytes,
            counts: plan.counts,
            plan_digest: "b".repeat(64),
            scope,
        },
        plan,
    };
}
function transferClient(f) {
    const timers = new Map();
    let timer = 0,
        sequence = 0;
    const factory = load("src/commands/favorites-transfer.ts", f.host).exports
        .createFavoritesTransfer;
    const transfer = factory({
        adapter: f.adapter,
        base64Decode: (value) => new Uint8Array(Buffer.from(value, "base64")),
        base64Encode: (value) => Buffer.from(value).toString("base64"),
        clearTimer: (id) => timers.delete(id),
        codec: { validate: f.codec.validate },
        now: f.ports.now,
        runtime: () => f.runtime,
        setTimer: (callback) => {
            timers.set(++timer, callback);
            return timer;
        },
        sha256: hash,
        utf8: f.ports.utf8,
        uuid: () =>
            "99999999-9999-4999-8999-" + String(++sequence).padStart(12, "0"),
    });
    async function send(op, args = {}) {
        const params = { op, runtime: f.runtime, ...args };
        return transfer.execute(params, {
            deadlineAt: f.ports.now() + 600000,
            envelope: {
                action: "favorites_transfer",
                expires_at: "2030-01-01T00:00:00Z",
                id: "synthetic",
                params,
            },
            runtime: f.runtime,
        });
    }
    async function begin(id, invalid = false) {
        const snapshot = await send("snapshot", { scope });
        assert.equal(snapshot.error, undefined);
        const bytes = Buffer.from(snapshot.document_base64, "base64");
        const begun = await send("begin", {
            binding_revision: snapshot.binding_revision,
            chunk_count: 1,
            document_sha256: hash(bytes),
            expected_revision: invalid ? "invalid-revision" : snapshot.revision,
            operation_id: id,
            persistence: "persistent",
            scope,
            size_bytes: bytes.length,
        });
        return { begun, bytes, id, snapshot };
    }
    async function preview(value) {
        assert.equal(value.begun.error, undefined);
        assert.equal(
            (
                await send("append", {
                    chunk_sha256: hash(value.bytes),
                    data_base64: value.bytes.toString("base64"),
                    offset: 0,
                    seq: 0,
                    transaction_id: value.begun.transaction_id,
                })
            ).error,
            undefined
        );
        const result = await send("preview", {
            transaction_id: value.begun.transaction_id,
        });
        assert.equal(result.error, undefined);
        assert.equal(result.ready, true);
        return result;
    }
    async function commit(value, plan) {
        return send("commit", {
            expected_revision: value.snapshot.revision,
            operation_id: value.id,
            plan_digest: plan.plan_digest,
            transaction_id: value.begun.transaction_id,
        });
    }
    return { begin, commit, preview, send, timers };
}
async function main() {
    {
        const f = fixture(),
            contract = JSON.parse(
                fs.readFileSync(
                    root + "/docs/design/favorites-current-plex-contract.json",
                    "utf8"
                )
            );
        assert.deepEqual(
            plain(f.registry.list()),
            contract.registry_public_input
        );
        const rows = f.registry.list().entries,
            sourceRow = rows.find((row) => row.kind === "source"),
            profileRow = rows.find((row) => row.id === sourceRow.profile_id);
        assert.deepEqual(
            {
                profileBindingId: profileRow.id,
                provider: sourceRow.provider,
                sourceBindingId: sourceRow.id,
            },
            scope
        );
        assert.deepEqual(
            contract.proposed_bindingcatalog_response.bindings[0].scope,
            scope
        );
        assert.equal(
            contract.proposed_capability.favorites_transfer
                .receipt_retention_seconds,
            86400
        );
    }

    {
        const f = fixture(),
            timers = new Map();
        let timerId = 0;
        const factory = load("src/commands/favorites-transfer.ts", f.host)
            .exports.createFavoritesTransfer;
        const transfer = factory({
            adapter: f.adapter,
            base64Decode: (value) =>
                new Uint8Array(Buffer.from(value, "base64")),
            base64Encode: (bytes) => Buffer.from(bytes).toString("base64"),
            clearTimer: (id) => timers.delete(id),
            codec: { validate: f.codec.validate },
            now: f.ports.now,
            runtime: () => f.runtime,
            setTimer: (callback) => {
                timers.set(++timerId, callback);
                return timerId;
            },
            sha256: hash,
            utf8: f.ports.utf8,
            uuid: () => stage,
        });
        async function send(operation, args = {}) {
            const params = { op: operation, runtime: f.runtime, ...args };
            return transfer.execute(params, {
                deadlineAt: 60000,
                envelope: {
                    action: "favorites_transfer",
                    expires_at: "2030-01-01T00:00:00Z",
                    id: "synthetic",
                    params,
                },
                runtime: f.runtime,
            });
        }
        const snapshot = await send("snapshot", { scope });
        assert.equal(snapshot.error, undefined);
        const bytes = Buffer.from(snapshot.document_base64, "base64");
        const begun = await send("begin", {
            binding_revision: snapshot.binding_revision,
            chunk_count: 1,
            document_sha256: hash(bytes),
            expected_revision: snapshot.revision,
            operation_id: op,
            persistence: "persistent",
            scope,
            size_bytes: bytes.length,
        });
        assert.equal(begun.error, undefined);
        assert.equal(
            (
                await send("append", {
                    chunk_sha256: hash(bytes),
                    data_base64: bytes.toString("base64"),
                    offset: 0,
                    seq: 0,
                    transaction_id: begun.transaction_id,
                })
            ).error,
            undefined
        );
        const preview = await send("preview", {
            transaction_id: begun.transaction_id,
        });
        assert.equal(preview.error, undefined);
        assert.equal(preview.ready, true);
        assert.equal(preview.stores.length, 3);
        const committed = await send("commit", {
            expected_revision: snapshot.revision,
            operation_id: op,
            plan_digest: preview.plan_digest,
            transaction_id: begun.transaction_id,
        });
        assert.equal(committed.error, undefined);
        assert.equal(committed.outcome, "verified");
        assert.equal(committed.receipt.plan_digest, preview.plan_digest);
        assert.equal(
            (await send("status", { operation_id: op })).outcome,
            "verified"
        );
        assert.equal(timers.size, 0);
    }
    {
        const f = fixture(),
            p = await prepare(f, (doc) => {
                doc.mediaFavorites.push({
                    locator: {
                        kind: "plex-media",
                        ratingKey: "43",
                        serverId: "server-one",
                    },
                    state: "located",
                    title: "Imported",
                });
            });
        assert.equal(p.plan.ready, true);
        assert.equal(p.plan.stores.length, 3);
        assert.deepEqual(plain(p.plan.counts), {
            channelLists: 2,
            channelMemberships: 3,
            mediaFavorites: 2,
            unresolved: 0,
        });
        const result = await f.adapter.apply(p.plan, p.context, () => true);
        assert.equal(result.outcome, "verified");
        assert(result.per_store.every((row) => row.outcome === "verified"));
        assert.deepEqual(
            JSON.parse(f.saved.get(mediaKey)).history,
            f.originalMedia.history
        );
        assert.deepEqual(
            JSON.parse(f.saved.get(mediaKey)).extra,
            f.originalMedia.extra
        );
        const tv = JSON.parse(f.saved.get(tvKey));
        assert.deepEqual(tv.lists.order, ["Saved", "Favorites"]);
        assert.equal(tv.lists.active, "Saved");
        assert.equal(tv.defaultList, "Favorites");
        assert.deepEqual(tv.lists.lists.Saved, [ref("42"), ref("99")]);
        assert.deepEqual(tv.shuffleBefore.Saved, [ref("99"), ref("42")]);
        assert.deepEqual(
            Array.from(f.favorites.activeFavoritesList()),
            ["plex-42"],
            "missing canonical membership is retained invisibly"
        );
        assert.deepEqual(plain(f.host.__ottFavoritesLibrary.document()), tv);
        assert.equal(f.journal.read().document.favorites.length, 2);
        const rawReceipt = JSON.parse(f.saved.get(receiptKey));
        assert.equal(
            rawReceipt.entries[0].receipt.plan_digest,
            p.context.plan_digest
        );
        assert.deepEqual(
            rawReceipt.entries[0].receipt.counts,
            plain(p.plan.counts)
        );
        assert.equal(rawReceipt.entries[0].receipt.outcome, "verified");
        await assert.rejects(
            f.adapter.apply(p.plan, p.context, () => true),
            /reconciliation_required/
        );
        assert.equal(
            f.journal.change("position", {
                ...f.originalMedia.history[0],
                position: 47,
            }),
            true
        );
        assert.equal(
            JSON.parse(f.saved.get(mediaKey)).favorites.length,
            2,
            "checkpoint cannot overwrite adopted favorites"
        );
        f.stop();
        const restart = fixture(f.saved, "runtime-2");
        const status = await restart.adapter.status(op, () => true);
        assert.equal(
            status.outcome,
            "verified",
            "fresh read-only source grant can inspect old-runtime receipt"
        );
        assert.equal(status.receipt.plan_digest, p.context.plan_digest);
        await assert.rejects(
            restart.adapter.inspect(scope, op, {
                ...p.context,
                runtime: "runtime-2",
            }),
            /./,
            "read-only status cannot resurrect a write admission"
        );
    }
    {
        const f = fixture(),
            p = await prepare(f, (doc) => {
                doc.channelLists.lists[1].entries.push({
                    provenance: { legacyId: 7, origin: "raw" },
                    reason: "legacy-unportable",
                    state: "unresolved",
                });
            });
        assert.equal(p.plan.ready, false);
        assert.equal(p.plan.unresolved.length, 1);
        const beforeTV = f.saved.get(tvKey),
            beforeMedia = f.saved.get(mediaKey);
        await assert.rejects(f.adapter.apply(p.plan, p.context, () => true));
        assert.equal(f.saved.get(tvKey), beforeTV);
        assert.equal(f.saved.get(mediaKey), beforeMedia);
    }
    {
        const f = fixture(undefined, "cookie-runtime", "cookie"),
            before = [...f.saved];
        await assert.rejects(prepare(f), /unsupported_persistence/);
        assert.deepEqual(
            [...f.saved],
            before,
            "v2 refuses cookie-backed mutation without physical guard; no favorites or receipt writes"
        );
    }
    for (const target of [tvKey, mediaKey, receiptKey]) {
        const f = fixture(),
            p = await prepare(f, (doc) =>
                doc.mediaFavorites.push({
                    locator: {
                        kind: "plex-media",
                        ratingKey: "43",
                        serverId: "server-one",
                    },
                    state: "located",
                })
            );
        f.interceptWrites((key, value, write) => {
            if (key === target) throw Error("synthetic quota");
            write(key, value);
        });
        const applied = await f.adapter.apply(p.plan, p.context, () => true);
        assert.notEqual(applied.outcome, "verified", target);
        if (target === tvKey) {
            assert.equal(
                applied.per_store[2].outcome,
                "partial",
                "confirmed reservation is a ledger change even if the first favorite write fails"
            );
        }
        if (target === mediaKey)
            assert.equal(applied.per_store[0].outcome, "verified");
        if (target === receiptKey) {
            assert.equal(applied.per_store[0].outcome, "not_applied");
            assert.equal(applied.per_store[1].outcome, "not_applied");
            assert.equal(f.saved.get(tvKey), JSON.stringify(f.originalTV));
            assert.equal(
                f.saved.get(mediaKey),
                JSON.stringify(f.originalMedia)
            );
        }
        await assert.rejects(
            f.adapter.apply(p.plan, p.context, () => true),
            target === receiptKey
                ? /reconciliation_required/
                : /unsupported_persistence/
        );
    }
    {
        const f = fixture(),
            p = await prepare(f),
            before = f.saved.get(tvKey);
        await f.exclusive(() =>
            f.ledger.reserve(
                {
                    operationId: "55555555-5555-4555-8555-555555555555",
                    payloadHash: "c".repeat(64),
                    refs: { runtimeId: f.runtime, stageId: "other-stage" },
                    scope,
                },
                { freshAdmission: true }
            )
        );
        await assert.rejects(
            f.adapter.apply(p.plan, p.context, () => true),
            /ledger_changed/
        );
        assert.equal(f.saved.get(tvKey), before);
        assert.equal(JSON.parse(f.saved.get(receiptKey)).entries.length, 1);
    }
    for (const kind of [
        "source",
        "aliases",
        "binding",
        "TV",
        "media",
        "ledger",
    ]) {
        const f = fixture(),
            p = await prepare(f),
            tvBefore = f.saved.get(tvKey),
            mediaBefore = f.saved.get(mediaKey);
        if (kind === "source") f.stop();
        if (kind === "aliases") f.host.stbSetItem = () => {};
        if (kind === "binding") f.binding("binding-2");
        if (kind === "TV")
            f.saved.set(
                tvKey,
                JSON.stringify({
                    ...JSON.parse(tvBefore),
                    defaultList: undefined,
                })
            );
        if (kind === "media")
            f.saved.set(
                mediaKey,
                JSON.stringify({ ...f.originalMedia, history: [] })
            );
        if (kind === "ledger")
            f.saved.set(
                receiptKey,
                JSON.stringify({ entries: [], version: 1 })
            );
        const tvNow = f.saved.get(tvKey),
            mediaNow = f.saved.get(mediaKey);
        await assert.rejects(f.adapter.apply(p.plan, p.context, () => true));
        assert.equal(f.saved.get(tvKey), tvNow, kind);
        assert.equal(f.saved.get(mediaKey), mediaNow, kind);
    }
    {
        const f = fixture(),
            bridge = f.host.__ottFavoritesLibrary.transfer(),
            original = f.saved.get(tvKey),
            changed = JSON.stringify({
                ...JSON.parse(original),
                defaultList: undefined,
            });
        let writes = 0;
        const write = f.host.providerSetItem;
        f.host.providerSetItem = (...args) => {
            writes++;
            write(...args);
        };
        f.saved.set(tvKey, changed);
        assert.equal(
            bridge.adopt(changed),
            false,
            "provider alias replacement retires capture"
        );
        f.host.providerSetItem = write;
        const current = f.host.__ottFavoritesLibrary.transfer();
        assert.equal(current.adopt(changed), true);
        assert.equal(writes, 0);
        assert.equal(f.saved.get(tvKey), changed);
        assert.equal(
            current.adopt(original),
            false,
            "raw readback mismatch cannot publish"
        );
        assert.equal(
            current.adopt(
                JSON.stringify({ ...JSON.parse(changed), sourceId: "foreign" })
            ),
            false
        );
    }
    {
        const f = fixture(),
            bridge = f.host.__ottFavoritesLibrary.transfer(),
            raw = f.saved.get(tvKey),
            cached = plain(bridge.snapshot());
        assert.equal(bridge.adopt("{"), false);
        assert.deepEqual(plain(bridge.snapshot()), cached);
        f.stop();
        assert.equal(bridge.current(), false);
        assert.equal(bridge.adopt(raw), false);
        assert.equal(f.saved.get(tvKey), raw);
    }
    {
        const f = fixture(),
            long = "9007199254740993";
        f.host.channels["plex-" + long] = {
            __ottMediaItem: {
                plexSource: mediaSource,
                request: { path: "/library/metadata/" + long },
            },
        };
        const refs = f.host.__ottFavoritesPlexReferences.create(
            f.host.channels,
            f.proof
        );
        assert.equal(refs.project(ref(long)), "plex-" + long);
        assert.equal(
            refs.resolve("plex-" + long, "canonical").itemId,
            "channel:plex-" + long
        );
        assert.equal(refs.resolve(42, "canonical").itemId, undefined);
        assert.equal(refs.project({ itemId: "channel:42" }), null);
        assert.equal(refs.project(ref("99")), null);
        const snapshot = await f.adapter.snapshot(scope, () => true),
            parsed = f.json.parseFavoritesDocumentJson(snapshot.bytes);
        parsed.channelLists.lists[0].entries[0].locator.serverId =
            "foreign-server";
        const foreign = f.codec.prepare(
            f.codec.encode(parsed),
            scope,
            JSON.parse(f.saved.get(mediaKey))
        );
        assert.equal(foreign.ready, false);
        assert.equal(foreign.counts.unresolved, 1);
        assert.equal(
            JSON.stringify(foreign.unresolved).includes("foreign-server"),
            false
        );
        parsed.channelLists.lists[0].entries[0].locator.ratingKey =
            "42?token=secret";
        assert.throws(() => f.codec.encode(parsed), /codec_error/);
        const invalid = f.json.parseFavoritesDocumentJson(snapshot.bytes);
        invalid.channelLists.lists[0].entries[0] = {
            provenance: { legacyId: "secret-string", origin: "raw" },
            reason: "legacy-unportable",
            state: "unresolved",
        };
        assert.throws(() => f.codec.encode(invalid), /codec_error/);
        const original = f.saved.get(tvKey);
        const withLegacy = JSON.parse(original);
        withLegacy.lists.lists.Favorites.push({ legacyId: -7, origin: "raw" });
        assert.throws(
            () =>
                f.codec.snapshot(
                    scope,
                    withLegacy,
                    JSON.parse(f.saved.get(mediaKey))
                ),
            /codec_error/
        );
        assert.equal(
            f.saved.get(tvKey),
            original,
            "unrepresentable legacy membership never disappears"
        );
    }
    for (const target of [tvKey, mediaKey, receiptKey]) {
        const f = fixture(),
            prepared = await prepare(f);
        assert.equal(
            (await f.adapter.apply(prepared.plan, prepared.context, () => true))
                .outcome,
            "verified"
        );
        let release, hashing;
        const paused = new Promise((resolve) => {
            hashing = resolve;
        });
        f.ports.sha256 = (bytes) =>
            new Promise((resolve) => {
                release = () => resolve(hash(bytes));
                hashing();
            });
        const pending = f.adapter.status(op, () => true);
        await paused;
        const changed = JSON.parse(f.saved.get(target));
        if (target === tvKey) changed.lists.lists.Favorites.push(ref("99"));
        if (target === mediaKey) changed.favorites.push(mediaRow("99"));
        if (target === receiptKey)
            changed.entries[0].receipt.counts.mediaFavorites++;
        f.saved.set(target, JSON.stringify(changed));
        release();
        const status = await pending;
        assert.equal(
            status.outcome,
            "unknown",
            "status cannot verify a stale capture after " +
                target +
                " changes during SHA"
        );
        assert.notEqual(status.receipt_verified, true);
        assert(status.per_store.every((store) => store.outcome === "unknown"));
        assert.equal(
            f.saved.get(target),
            JSON.stringify(changed),
            "read-only status never repairs or overwrites drift"
        );
    }
    {
        const f = fixture(),
            client = transferClient(f);
        let writes = 0;
        const writtenKeys = [];
        f.interceptWrites((key, value, write) => {
            writes++;
            writtenKeys.push(key);
            write(key, value);
        });
        let tick = 1000;
        for (const cycle of ["abort", "rejected", "expired"]) {
            for (let index = 1; index <= 40; index++) {
                const id =
                    "66666666-6666-4666-8666-" +
                    String(
                        (cycle === "abort"
                            ? 0
                            : cycle === "rejected"
                              ? 100
                              : 200) + index
                    ).padStart(12, "0");
                const value = await client.begin(id, cycle === "rejected");
                if (cycle === "rejected")
                    assert.equal(value.begun.error, "revision_conflict");
                else {
                    await client.preview(value);
                    if (cycle === "abort")
                        assert.equal(
                            (
                                await client.send("abort", {
                                    transaction_id: value.begun.transaction_id,
                                })
                            ).state,
                            "aborted"
                        );
                    else {
                        tick += 120001;
                        f.clock(tick);
                        const status = await client.send("status", {
                            operation_id: id,
                        });
                        assert.equal(status.state, "expired");
                    }
                }
                assert.equal(
                    writes,
                    0,
                    cycle + " cannot persist favorite or receipt bytes"
                );
                assert.equal(f.saved.get(receiptKey), undefined);
            }
        }
        const value = await client.begin(
            "66666666-6666-4666-8666-000000000999"
        );
        const plan = await client.preview(value);
        assert.equal(writes, 0);
        assert.equal((await client.commit(value, plan)).outcome, "verified");
        assert(
            writes > 0,
            "reservation first persists only on successful commit"
        );
        assert.deepEqual(
            writtenKeys,
            [receiptKey, tvKey, mediaKey, receiptKey],
            "exact pending receipt is persisted before any favorite write, followed by completion"
        );
        assert.equal(client.timers.size, 0);
    }
    {
        const f = fixture(),
            client = transferClient(f);
        let last;
        for (let index = 1; index <= 40; index++) {
            const id =
                "77777777-7777-4777-8777-" + String(index).padStart(12, "0");
            const value = await client.begin(id),
                plan = await client.preview(value);
            const result = await client.commit(value, plan);
            assert.equal(result.error, undefined);
            assert.equal(result.outcome, "verified");
            last = value;
        }
        assert.equal(JSON.parse(f.saved.get(receiptKey)).entries.length, 32);
        assert.equal(
            (await client.send("status", { operation_id: last.id })).outcome,
            "verified"
        );
        assert.equal(
            (
                await client.send("status", {
                    operation_id: "77777777-7777-4777-8777-000000000001",
                })
            ).outcome,
            "unknown",
            "pressure-evicted completed receipt is unknown, never replay permission"
        );
        const before = f.saved.get(receiptKey);
        const replay = await client.begin(last.id);
        assert(replay.begun.error);
        assert.equal(f.saved.get(receiptKey), before);
    }
    {
        const f = fixture();
        const retained = [];
        for (let index = 1; index <= 16; index++) {
            const id =
                "88888888-8888-4888-8888-" + String(index).padStart(12, "0");
            const prepared = await prepare(f, undefined, id);
            retained.push(prepared);
            {
                const complete = f.ledger.commitCompletion;
                f.ledger.commitCompletion = () => {
                    throw Error("synthetic completion uncertainty");
                };
                assert.equal(
                    (
                        await f.adapter.apply(
                            prepared.plan,
                            prepared.context,
                            () => true
                        )
                    ).outcome,
                    "unknown"
                );
                f.ledger.commitCompletion = complete;
                await assert.rejects(
                    f.adapter.apply(
                        prepared.plan,
                        prepared.context,
                        () => true
                    ),
                    /reconciliation_required/
                );
            }
        }
        const before = f.saved.get(receiptKey);
        await assert.rejects(
            prepare(f, undefined, "88888888-8888-4888-8888-000000000017"),
            /limits_exceeded/
        );
        assert.equal(
            f.saved.get(receiptKey),
            before,
            "started uncertain slots cannot be evicted to admit another operation"
        );
        assert.equal(JSON.parse(before).entries.length, 16);
        assert.equal(
            await f.adapter.status(
                retained[15].context.operation_id,
                () => true
            ),
            null
        );
    }
    console.log(
        "PASS complete current Plex favorites: actual 3 stores, named lists/order/default/shuffle/invisible refs, real ledger, restart read-only status, history/cache and ownership guards"
    );
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
