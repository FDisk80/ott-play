"use strict";
const storageImports =
    require("./helpers/remote-transfer-dependency.cjs").storage;
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const localLibraryLZ = require("./helpers/remote-transfer-dependency.cjs")(
    "../utils/lzstring",
    {}
);
function boot(saved = new Map()) {
    const host = {
        localStorage: {
            getItem: (key) => (saved.has(key) ? saved.get(key) : null),
            key: (index) => [...saved.keys()][index] || null,
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
            compress: localLibraryLZ.compress,
            console,
            decompress: localLibraryLZ.decompress,
            document: { cookie: "" },
            exports,
            window: host,
        }
    );
    return { ...exports, adapter: exports.storage, host, saved };
}
{
    const f = boot(
        new Map([
            ["ottplayprov", "m3u"],
            ["offlineprimaryIndex", "3"],
            ["offlineProfiles", "saved-profile"],
        ])
    );
    const read = f.stbGetItem,
        write = f.stbSetItem;
    f.adapter.localPlayback.begin(() => "profile");
    write("localMediaPlaybackSelection", "command-folder");
    write("offlineprimaryIndex", "12");
    write("offlineplaybackJournal:offline:2", "command-bookmark");
    assert.equal(read("ottplayprov"), "offline");
    assert.equal(f.adapter.getI("offlineprimaryIndex"), 12);
    assert.equal(f.adapter.has("localMediaPlaybackSelection"), true);
    assert.equal(f.adapter.hasValue("localMediaPlaybackSelection"), true);
    assert.equal(
        read,
        f.adapter.get,
        "classic storage alias identity is retained"
    );
    assert.equal(write, f.adapter.set);
    write("sVolume", "42");
    write("localMediaEndpoint", "https://library.invalid");
    write("stalkertoken", "unchanged-auth-boundary");
    assert.equal(f.saved.get("sVolume"), "42");
    assert.equal(f.saved.get("localMediaEndpoint"), "https://library.invalid");
    assert.equal(f.saved.get("stalkertoken"), "unchanged-auth-boundary");
    assert.equal(f.adapter.dump().offlineProfiles, "saved-profile");
    assert.equal(f.adapter.dump().ottplayprov, "m3u");
    assert.equal(f.adapter.dump().offlineprimaryIndex, "3");
    assert.equal(f.adapter.dump().localMediaPlaybackSelection, undefined);
    assert.equal(f.stbGetPersistedItem("ottplayprov"), "m3u");
    const restart = boot(f.saved);
    assert.equal(restart.stbGetItem("ottplayprov"), "m3u");
    assert.equal(restart.stbGetItem("offlineprimaryIndex"), "3");
    assert.equal(restart.stbGetItem("localMediaPlaybackSelection"), null);
}
{
    const f = boot(
        new Map([
            ["ottplayprov", "offline"],
            ["offlineplaybackJournal", "previous-bookmark"],
        ])
    );
    let identity = "a";
    f.adapter.localPlayback.begin(() => identity);
    f.adapter.set("offlineplaybackJournal", "temporary");
    identity = "b";
    assert.throws(
        () => f.adapter.get("offlineplaybackJournal"),
        /session changed/
    );
    assert.throws(
        () => f.adapter.set("offlineplaybackJournal", "stale"),
        /session changed/
    );
    assert.equal(f.adapter.localPlayback.end(true), false);
    assert.equal(f.saved.get("offlineplaybackJournal"), "previous-bookmark");
    f.adapter.localPlayback.end(false);
    assert.equal(f.adapter.get("offlineplaybackJournal"), "previous-bookmark");
}
{
    const f = boot(new Map([["ottplayprov", "m3u"]]));
    f.adapter.localPlayback.begin(() => "a");
    f.adapter.set("localMediaPlaybackSelection", "chosen-folder");
    assert.equal(
        f.adapter.localPlayback.end(true, {
            key: "kiosk-policy",
            value: "explicit-policy",
        }),
        true
    );
    const restart = boot(f.saved);
    assert.equal(restart.adapter.get("ottplayprov"), "offline");
    assert.equal(
        restart.adapter.get("localMediaPlaybackSelection"),
        "chosen-folder"
    );
    assert.equal(restart.adapter.get("kiosk-policy"), "explicit-policy");
}
{
    for (const promote of [false, true]) {
        const f = boot(
            new Map([
                ["ottplayprov", "m3u"],
                ["offlineProfiles", "old-profile"],
                ["offlineplaybackJournal", "old-bookmark"],
            ])
        );
        f.adapter.localPlayback.begin(() => f.adapter.get("offlineProfiles"));
        f.adapter.set("offlineplaybackJournal", "one-off-bookmark");
        assert.equal(
            f.adapter.localPlayback.profile(
                [
                    {
                        after: "new-profile",
                        before: "old-profile",
                        key: "offlineProfiles",
                    },
                ],
                () => true,
                promote
            ),
            true
        );
        const restart = boot(f.saved);
        assert.equal(restart.adapter.get("ottplayprov"), "offline");
        assert.equal(restart.adapter.get("offlineProfiles"), "new-profile");
        assert.equal(
            restart.adapter.get("offlineplaybackJournal"),
            promote ? "one-off-bookmark" : "old-bookmark"
        );
    }
}
{
    const f = boot();
    const rollback = f.adapter.localPlayback.begin(() => "a");
    f.adapter.set("localMediaPlaybackSelection", "first");
    f.adapter.localPlayback.begin(() => "b");
    rollback();
    assert.equal(
        f.adapter.get("ottplayprov"),
        "offline",
        "stale rollback cannot retire a replacement owner"
    );
    assert.equal(
        f.adapter.transaction(
            [
                { after: "7", before: null, key: "offlineprimaryIndex" },
                { after: "12", before: null, key: "sVolume" },
            ],
            () => true
        ),
        false
    );
    assert.equal(f.saved.get("sVolume"), undefined);
    assert.equal(f.adapter.get("offlineprimaryIndex"), null);
    f.adapter.reset();
    assert.equal(f.adapter.localPlayback.active(), false);
    assert.equal(f.adapter.get("ottplayprov"), null);
    f.adapter.localPlayback.begin(() => "c");
    f.adapter.clear();
    assert.equal(f.adapter.localPlayback.active(), false);
}
{
    const f = boot();
    const adapter = f.installLocalPlaybackSession({
        clear() {},
        del() {},
        dump: () => ({}),
        get: () => null,
        reset() {},
        set() {
            throw Error("unexpected write");
        },
    });
    adapter.localPlayback.begin(() => "a");
    assert.equal(
        adapter.localPlayback.end(true),
        false,
        "unavailable durable transaction never partially promotes"
    );
    assert.equal(adapter.localPlayback.active(), true);
}
console.log(
    "PASS Local playback RAM session: restart, aliases, durable export, profile/kiosk promotion, identity, reset, atomic failure"
);
// Preview protects only the selected cursor; explicit library metadata remains durable.
for (const commit of [false, true]) {
    const key = "offlinechannelLibrary:offline";
    const original = {
        groups: ["old"],
        locks: {},
        selected: { itemId: "local-saved" },
        version: 2,
    };
    const f = boot(new Map([[key, JSON.stringify(original)]]));
    const preview = f.adapter.localPlayback.preview(() => "library");
    f.adapter.set(
        key,
        JSON.stringify({
            ...original,
            groups: ["edited"],
            selected: { itemId: "local-first" },
        })
    );
    assert.equal(JSON.parse(f.saved.get(key)).selected.itemId, "local-saved");
    assert.deepEqual(JSON.parse(f.saved.get(key)).groups, ["edited"]);
    const before = f.adapter.get(key);
    const after = JSON.stringify({
        ...JSON.parse(before),
        groups: ["transaction-edit"],
        locks: { one: true },
    });
    assert.equal(
        f.adapter.transaction([{ after, before, key }], () => true),
        true
    );
    assert.equal(JSON.parse(f.saved.get(key)).selected.itemId, "local-saved");
    assert.equal(JSON.parse(f.adapter.get(key)).selected.itemId, "local-first");
    assert.deepEqual(JSON.parse(f.saved.get(key)).groups, ["transaction-edit"]);
    assert.deepEqual(JSON.parse(f.saved.get(key)).locks, { one: true });
    if (commit) assert.equal(preview.commit(), true);
    else preview.discard();
    const restored = JSON.parse(boot(f.saved).adapter.get(key));
    assert.equal(
        restored.selected.itemId,
        commit ? "local-first" : "local-saved"
    );
    assert.deepEqual(restored.groups, ["transaction-edit"]);
    assert.deepEqual(restored.locks, { one: true });
}
console.log(
    "PASS preview channel-library metadata survives direct writes, native transactions, discard and selected commit"
);

// Explicit sort changes persist while a startup cursor is protected.
{
    const key = "offlinesSortAbc";
    const f = boot(new Map([[key, "0"]]));
    let preview = f.adapter.localPlayback.preview(() => "library");
    f.adapter.set(key, "1");
    preview.discard();
    assert.equal(boot(f.saved).adapter.get(key), "1");
    preview = f.adapter.localPlayback.preview(() => "library");
    assert.equal(
        f.adapter.transaction([{ after: "0", before: "1", key }], () => true),
        true
    );
    preview.discard();
    assert.equal(boot(f.saved).adapter.get(key), "0");
    const discard = f.adapter.localPlayback.begin(() => "remote");
    f.adapter.set(key, "1");
    assert.equal(f.adapter.get(key), "1");
    discard();
    assert.equal(boot(f.saved).adapter.get(key), "0");
}
console.log(
    "PASS preview sort changes remain durable; remote session sort stays isolated"
);

// A command begins without inheriting any old cursor, including dynamic journals.
{
    const keys = [
        "offlineprimaryIndex",
        "offlinecatIndex",
        "offlineprevArr",
        "offlinecontinueWatch",
        "offlinelastcid",
        "offlineplaybackJournal",
        "offlineplaybackJournalSource",
        "offlineplaybackJournal:profile:future-source",
    ];
    const f = boot(
        new Map(
            keys
                .map((key) => [key, "saved"])
                .concat([
                    ["offlineProfiles", "profile"],
                    ["offlinesSortAbc", "1"],
                    ["ottplayprovs", "offline,m3u"],
                ])
        )
    );
    const session = f.adapter.localPlayback;
    assert.equal(session.transient(), false);
    const preview = session.preview(() => "profile");
    assert.equal(session.transient(), false);
    for (const key of keys) assert.equal(f.adapter.get(key), "saved");
    preview.discard();
    session.begin(() => "profile");
    assert.equal(session.transient(), true);
    for (const key of keys) {
        assert.equal(f.adapter.get(key), null, key);
        f.adapter.set(key, "current");
        assert.equal(f.adapter.get(key), "current", key);
        assert.equal(f.saved.get(key), "saved", key);
    }
    assert.equal(f.adapter.get("offlineProfiles"), "profile");
    assert.equal(f.adapter.get("offlinesSortAbc"), "1");
    assert.equal(f.adapter.get("ottplayprovs"), "offline,m3u");
    session.begin(() => "profile");
    for (const key of keys) assert.equal(f.adapter.get(key), null, key);
    session.end(false);
    for (const key of keys) assert.equal(f.adapter.get(key), "saved", key);
}

// Library metadata remains durable while only the command's selected cursor is ephemeral.
for (const promote of [false, true]) {
    const key = "offlinechannelLibrary:offline";
    const original = {
        groups: ["saved"],
        selected: { itemId: "saved" },
        version: 2,
    };
    const f = boot(new Map([[key, JSON.stringify(original)]]));
    f.adapter.localPlayback.begin(() => "profile");
    assert.equal(JSON.parse(f.adapter.get(key)).selected, undefined);
    const logical = {
        ...original,
        groups: ["edited"],
        selected: { itemId: "temporary" },
    };
    const before = f.adapter.get(key);
    assert.equal(
        f.adapter.transaction(
            [{ after: JSON.stringify(logical), before, key }],
            () => true
        ),
        true
    );
    assert.equal(JSON.parse(f.saved.get(key)).selected.itemId, "saved");
    assert.deepEqual(JSON.parse(f.saved.get(key)).groups, ["edited"]);
    assert.equal(JSON.parse(f.adapter.get(key)).selected.itemId, "temporary");
    assert.throws(() => f.adapter.del(key), /Choose a Local file/);
    assert.equal(f.adapter.localPlayback.end(promote), true);
    assert.equal(
        JSON.parse(f.saved.get(key)).selected.itemId,
        promote ? "temporary" : "saved"
    );
}
{
    const f = boot();
    const key = "offlinechannelLibrary:offline:new";
    f.adapter.localPlayback.begin(() => "new");
    assert.equal(
        f.adapter.get(key),
        null,
        "a missing library must not become invalid empty metadata"
    );
    f.adapter.set(
        key,
        JSON.stringify({
            groups: [],
            selected: { itemId: "first" },
            version: 2,
        })
    );
    assert.equal(JSON.parse(f.saved.get(key)).selected, undefined);
    assert.equal(JSON.parse(f.adapter.get(key)).selected.itemId, "first");
    f.adapter.localPlayback.end(false);
    assert.equal(JSON.parse(f.adapter.get(key)).selected, undefined);
}
console.log(
    "PASS fresh Local commands isolate saved resume and selected cursors without hiding metadata edits"
);
// A competing metadata writer must never become a fresh CAS baseline mid-write.
for (const operation of ["transaction", "commit", "profile"]) {
    const key = "offlinechannelLibrary:offline";
    const original = {
        groups: ["old"],
        locks: {},
        selected: { itemId: "local-saved" },
        version: 2,
    };
    const competitor = JSON.stringify({
        ...original,
        groups: ["competitor"],
        locks: { protected: true },
    });
    const f = boot(new Map([[key, JSON.stringify(original)]]));
    const preview = f.adapter.localPlayback.preview(() => "library");
    f.adapter.set(
        key,
        JSON.stringify({ ...original, selected: { itemId: "local-first" } })
    );
    const before = f.adapter.get(key);
    const after = JSON.stringify({
        ...JSON.parse(before),
        groups: ["transaction"],
    });
    const getItem = f.host.localStorage.getItem;
    let reads = 0;
    f.host.localStorage.getItem = (readKey) => {
        if (readKey === key && ++reads === 2) f.saved.set(key, competitor);
        return getItem(readKey);
    };
    let accepted = false;
    try {
        accepted =
            operation === "transaction"
                ? f.adapter.transaction([{ after, before, key }], () => true)
                : operation === "commit"
                  ? preview.commit()
                  : f.adapter.localPlayback.profile(
                        [
                            {
                                after: "new-profile",
                                before: null,
                                key: "offlineProfiles",
                            },
                        ],
                        () => true,
                        true
                    );
    } catch (error) {
        assert.match(String(error), /changed|mismatch|current/i);
    }
    assert.equal(accepted, false, operation);
    assert.equal(reads >= 2, true, operation);
    assert.equal(f.saved.get(key), competitor, operation);
    assert.equal(JSON.parse(f.adapter.get(key)).selected.itemId, "local-first");
    assert.equal(f.saved.get("offlineProfiles"), undefined);
    preview.discard();
    assert.equal(f.saved.get(key), competitor, operation);
}
console.log(
    "PASS preview transaction, commit and profile reject concurrent library metadata edits"
);

const localLibraryMarker = "\x01LZ\x01";
const localLibraryKey = "channelLibrary:offline";
const localLibraryPhysicalKey = "offline" + localLibraryKey;
function compressedLibraryFixture() {
    const f = boot();
    f.setProviderPrefix("offline");
    const document = {
        groups: Array.from({ length: 8 }, (_, index) => ({
            id: "user:" + index,
            label: "Movies — Фильмы — 🎬 " + index,
            members: ["channel:local-one", "channel:local-two"],
        })),
        hidden: [],
        locks: [],
        preferences: {},
        selected: { groupId: "system:all", itemId: "channel:local-saved" },
        sourceId: "offline",
        version: 1,
    };
    f.providerSetItem(localLibraryKey, JSON.stringify(document));
    assert(f.saved.get(localLibraryPhysicalKey).startsWith(localLibraryMarker));
    assert.deepEqual(JSON.parse(f.providerGetItem(localLibraryKey)), document);
    return { ...f, document };
}
function readPhysicalLibrary(f) {
    const raw = f.saved.get(localLibraryPhysicalKey);
    return JSON.parse(
        raw.startsWith(localLibraryMarker)
            ? localLibraryLZ.decompress(raw.slice(localLibraryMarker.length))
            : raw
    );
}
function enterLibrarySession(f, mode) {
    return mode === "preview"
        ? f.adapter.localPlayback.preview(() => "compressed-library")
        : {
              discard: f.adapter.localPlayback.begin(
                  () => "compressed-library"
              ),
          };
}

for (const mode of ["preview", "transient"]) {
    for (const ending of ["discard", "promote", "profile"]) {
        for (const encoding of ["plain", "compressed"]) {
            const f = compressedLibraryFixture();
            const scope = enterLibrarySession(f, mode);
            const initial = JSON.parse(f.providerGetItem(localLibraryKey));
            assert.deepEqual(
                initial.selected,
                mode === "preview" ? f.document.selected : undefined,
                mode + ": provider reads decode the projected raw library"
            );
            const edited = {
                ...initial,
                selected: {
                    groupId: "system:all",
                    itemId: "channel:local-fresh",
                },
            };
            const initialDocument = readPhysicalLibrary(f);
            f.providerSetItem(localLibraryKey, JSON.stringify(edited));
            assert(
                f.saved
                    .get(localLibraryPhysicalKey)
                    .startsWith(localLibraryMarker)
            );
            assert.deepEqual(
                readPhysicalLibrary(f),
                initialDocument,
                "cursor-only writes preserve every metadata field and the saved selected cursor"
            );
            assert.deepEqual(
                JSON.parse(f.providerGetItem(localLibraryKey)),
                edited
            );
            edited.groups[0].label = "Edited movies 🎬";
            f.providerSetItem(localLibraryKey, JSON.stringify(edited));
            assert(
                f.saved
                    .get(localLibraryPhysicalKey)
                    .startsWith(localLibraryMarker)
            );
            assert.deepEqual(
                readPhysicalLibrary(f).selected,
                f.document.selected
            );
            assert.equal(
                readPhysicalLibrary(f).groups[0].label,
                edited.groups[0].label
            );
            assert.deepEqual(
                JSON.parse(f.providerGetItem(localLibraryKey)),
                edited
            );

            // Transactions operate on raw adapter bytes, including their original
            // compression spelling. Provider reads still expose plain JSON.
            const before = f.adapter.get(localLibraryPhysicalKey);
            assert(before.startsWith(localLibraryMarker));
            const next = {
                ...edited,
                preferences: { audio: { "channel:local-fresh": 2 } },
                selected: {
                    groupId: "system:all",
                    itemId: "channel:local-next",
                },
            };
            const json = JSON.stringify(next);
            const after =
                encoding === "compressed"
                    ? localLibraryMarker + localLibraryLZ.compress(json)
                    : json;
            assert.equal(
                f.adapter.transaction(
                    [{ after, before, key: localLibraryPhysicalKey }],
                    () => true
                ),
                true,
                mode + "/" + encoding
            );
            assert.equal(f.adapter.get(localLibraryPhysicalKey), after);
            assert.deepEqual(
                JSON.parse(f.providerGetItem(localLibraryKey)),
                next
            );
            assert.deepEqual(
                readPhysicalLibrary(f).selected,
                f.document.selected
            );
            assert.deepEqual(
                readPhysicalLibrary(f).preferences,
                next.preferences
            );

            if (ending === "discard") scope.discard();
            else if (ending === "promote")
                assert.equal(
                    mode === "preview"
                        ? scope.commit()
                        : f.adapter.localPlayback.end(true),
                    true
                );
            else
                assert.equal(
                    f.adapter.localPlayback.profile(
                        [
                            {
                                after: "explicit-profile",
                                before: null,
                                key: "offlineProfiles",
                            },
                        ],
                        () => true,
                        true
                    ),
                    true
                );
            assert.equal(f.adapter.localPlayback.active(), false);
            const expected = {
                ...next,
                selected:
                    ending === "discard" ? f.document.selected : next.selected,
            };
            assert.deepEqual(readPhysicalLibrary(f), expected);
            const restored = boot(f.saved);
            restored.setProviderPrefix("offline");
            assert.deepEqual(
                JSON.parse(restored.providerGetItem(localLibraryKey)),
                expected
            );
        }
    }
}

for (const mode of ["preview", "transient"]) {
    for (const operation of ["transaction", "promote", "profile"]) {
        const f = compressedLibraryFixture();
        const scope = enterLibrarySession(f, mode);
        const edited = JSON.parse(f.providerGetItem(localLibraryKey));
        edited.selected = { itemId: "channel:local-fresh" };
        f.providerSetItem(localLibraryKey, JSON.stringify(edited));
        const before = f.adapter.get(localLibraryPhysicalKey);
        const next = { ...edited, preferences: { audio: { fresh: 2 } } };
        const after =
            localLibraryMarker + localLibraryLZ.compress(JSON.stringify(next));
        const competitor = { ...f.document, hidden: ["concurrent-hidden"] };
        const competitorRaw =
            localLibraryMarker +
            localLibraryLZ.compress(JSON.stringify(competitor));
        const getItem = f.host.localStorage.getItem;
        let reads = 0;
        f.host.localStorage.getItem = (key) => {
            if (key === localLibraryPhysicalKey && ++reads === 2)
                f.saved.set(key, competitorRaw);
            return getItem(key);
        };
        let accepted = false;
        try {
            accepted =
                operation === "transaction"
                    ? f.adapter.transaction(
                          [{ after, before, key: localLibraryPhysicalKey }],
                          () => true
                      )
                    : operation === "promote"
                      ? f.adapter.localPlayback.end(true)
                      : f.adapter.localPlayback.profile(
                            [
                                {
                                    after: "replacement",
                                    before: null,
                                    key: "offlineProfiles",
                                },
                            ],
                            () => true,
                            true
                        );
        } catch (error) {
            assert.match(String(error), /changed|mismatch|current/i);
        }
        assert.equal(accepted, false, mode + "/" + operation);
        assert.equal(f.saved.get(localLibraryPhysicalKey), competitorRaw);
        assert.equal(f.saved.has("offlineProfiles"), false);
        assert.deepEqual(
            JSON.parse(f.providerGetItem(localLibraryKey)).selected,
            edited.selected
        );
        scope.discard();
        assert.deepEqual(
            JSON.parse(f.providerGetItem(localLibraryKey)),
            competitor
        );
    }
}
for (const mode of ["preview", "transient"]) {
    const f = compressedLibraryFixture();
    const scope = enterLibrarySession(f, mode);
    const before = f.adapter.get(localLibraryPhysicalKey);
    const equivalentRaw = JSON.stringify(readPhysicalLibrary(f));
    const getItem = f.host.localStorage.getItem;
    let reads = 0;
    f.host.localStorage.getItem = (key) => {
        if (key === localLibraryPhysicalKey && ++reads === 2)
            f.saved.set(key, equivalentRaw);
        return getItem(key);
    };
    let accepted = false;
    try {
        accepted = f.adapter.transaction(
            [{ after: before, before, key: localLibraryPhysicalKey }],
            () => true
        );
    } catch (error) {
        assert.match(String(error), /changed|mismatch|current/i);
    }
    assert.equal(
        accepted,
        false,
        "CAS still rejects changed raw bytes even when their decoded document is identical"
    );
    assert(reads >= 2);
    assert.equal(f.saved.get(localLibraryPhysicalKey), equivalentRaw);
    scope.discard();
}
for (const mode of ["preview", "transient"]) {
    const f = compressedLibraryFixture();
    const scope = enterLibrarySession(f, mode);
    const prior = f.saved.get(localLibraryPhysicalKey);
    // A compressed empty stream cannot be treated as missing JSON metadata.
    const malformed = localLibraryMarker + localLibraryLZ.compress("");
    assert.throws(
        () => f.adapter.set(localLibraryPhysicalKey, malformed),
        /Invalid Local channel library/
    );
    assert.equal(f.saved.get(localLibraryPhysicalKey), prior);
    f.saved.set(localLibraryPhysicalKey, malformed);
    assert.throws(
        () => f.providerSetItem(localLibraryKey, JSON.stringify(f.document)),
        /Invalid Local channel library/
    );
    assert.equal(f.saved.get(localLibraryPhysicalKey), malformed);
    scope.discard();
}
console.log(
    "PASS compressed provider libraries: fresh cursor, metadata, raw transactions, discard/promotion, preview, CAS"
);

// A library first created in a temporary session has no durable cursor. Its
// logical readback must retain the writer's selected-field position: the real
// library commit verifies exact text, not just decoded field values.
for (const mode of ["preview", "transient"]) {
    for (const encoding of ["plain", "compressed"]) {
        for (const initiallyMissing of [false, true]) {
            const encode = (value) => {
                const text = JSON.stringify(value);
                return encoding === "compressed"
                    ? localLibraryMarker + localLibraryLZ.compress(text)
                    : text;
            };
            const decode = (raw) =>
                JSON.parse(
                    raw.startsWith(localLibraryMarker)
                        ? localLibraryLZ.decompress(
                              raw.slice(localLibraryMarker.length)
                          )
                        : raw
                );
            const desired = {
                groups: [{ id: "films", members: ["first", "second"] }],
                hidden: [],
                selected: null,
                sourceId: "temporary",
                version: 1,
            };
            const metadata = { ...desired };
            delete metadata.selected;
            const f = boot(
                initiallyMissing
                    ? new Map()
                    : new Map([[localLibraryPhysicalKey, encode(metadata)]])
            );
            const scope = enterLibrarySession(f, mode);
            for (const selected of [null, { itemId: "fresh" }]) {
                desired.selected = selected;
                const expected = encode(desired);
                f.adapter.set(localLibraryPhysicalKey, expected);
                assert.equal(
                    f.adapter.get(localLibraryPhysicalKey),
                    expected,
                    mode + "/" + encoding + ": exact first-write readback"
                );
                assert.deepEqual(
                    decode(f.saved.get(localLibraryPhysicalKey)),
                    metadata,
                    "temporary cursor never becomes durable"
                );
            }
            for (const change of [
                (value) => delete value.hidden,
                (value) => (value.extra = "new metadata"),
                (value) => (value.sourceId = "changed"),
                (value) => value.groups[0].members.reverse(),
                (value) =>
                    Object.defineProperty(value, "__proto__", {
                        enumerable: true,
                        value: { savedMetadata: true },
                    }),
            ]) {
                const actual = structuredClone(metadata);
                change(actual);
                f.saved.set(localLibraryPhysicalKey, encode(actual));
                const logical = f.adapter.get(localLibraryPhysicalKey);
                assert.notEqual(logical, encode(desired));
                const decoded = decode(logical);
                assert.deepEqual(decoded.selected, desired.selected);
                delete decoded.selected;
                assert.deepEqual(
                    decoded,
                    actual,
                    "cursor overlay cannot hide or replace changed metadata"
                );
            }
            scope.discard();
        }
    }
}
console.log(
    "PASS missing durable cursor: exact logical order and metadata changes"
);
