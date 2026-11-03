"use strict";
const assert = require("node:assert/strict"),
    fs = require("node:fs"),
    vm = require("node:vm"),
    ts = require("typescript");
const load = require("./helpers/private-runtime.cjs");
const { actualModule } = require("./helpers/global-favorites-main-ports.cjs");
const context = vm.createContext({ console, JSON });
context.window = context;
load(context, "src/media/journal.ts");
load(context, "src/channels/channel-references.ts");
// biome-ignore assist/source/useSortedKeys: Preserve the exact raw journal baseline in the no-write test.
const original = JSON.stringify({
    version: 1,
    sourceId: "owned",
    history: [],
    favorites: [
        // biome-ignore assist/source/useSortedKeys: Preserve the exact raw journal baseline in the no-write test.
        {
            sourceId: "owned",
            itemId: "provider:42",
            position: 0,
            // biome-ignore assist/source/useSortedKeys: Preserve the exact raw journal baseline in the no-write test.
            payload: { title: "Film", id: "42" },
        },
    ],
});
let raw = original,
    writes = 0,
    alive = true;
const journal = context.__ottMediaJournal.create({
    core: {},
    current: () => alive,
    enabled: () => false,
    importRows: () => [],
    limit: () => 20,
    read: (key) => (key === "mediaJournal.v1:owned" ? raw : null),
    sourceId: "owned",
    write() {
        writes++;
    },
});
const captured = journal.captureFavorites();
assert(
    captured && captured.current(),
    "disabled favorite editing does not hide existing source-owned read-only data"
);
assert.equal(captured.favorites.length, 1);
assert.equal(writes, 0);
assert.equal(raw, original);
// biome-ignore assist/source/useSortedKeys: Preserve the exact raw journal replacement used by the drift test.
raw = JSON.stringify({
    version: 1,
    sourceId: "foreign",
    history: [],
    favorites: [],
});
assert.equal(captured.current(), false);
assert.equal(journal.captureFavorites(), null);
assert.equal(writes, 0);
raw = original;
alive = false;
assert.equal(journal.captureFavorites(), null);
function moduleAt(file, deps) {
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
            require: (name) =>
                name === "../offline/local-item-path"
                    ? actualModule("src/offline/local-item-path.ts", {})
                    : name === "./global-favorites-providers"
                      ? actualModule(
                            "src/media/global-favorites-providers.ts",
                            {}
                        )
                      : deps[name],
            String,
            window: {},
        }
    );
    return exports;
}
const identities = moduleAt("src/media/global-favorites-identities.ts", {}),
    capture = moduleAt("src/media/global-favorites-capture.ts", {
        "./global-favorites-identities": identities,
    });
const codec = moduleAt(
    "src/settings/global-favorites-portable.ts",
    {}
).createGlobalFavoritesPortableCodec();
const migration = moduleAt("src/media/global-favorites-migration.ts", {
    "./global-favorites-capture": capture,
}).captureGlobalFavoriteMigration;
async function main() {
    let current = true;
    const w = {
        __ottActiveProviderDriver: {
            configuration: () => ({ active: 0 }),
            id: "m3u",
        },
        __ottChannelReferences: context.__ottChannelReferences,
        __ottClassicPlayback: { snapshot: () => ({ generation: 1 }) },
        __ottCommandChannelLoad: {},
        __ottFavoritesLibrary: {
            captureGlobal: () => ({
                current: () => current,
                document: {
                    lists: {
                        lists: {
                            Favorites: [
                                { itemId: "stable" },
                                { itemId: "missing" },
                            ],
                        },
                        order: ["Favorites"],
                    },
                    sourceId: "m3u:source",
                },
                raw: "exact-tv",
            }),
        },
        __ottSourceIdentity: { current: () => "m3u:source" },
        channels: {
            7: {
                __ottFavoriteTvgId: "stable",
                category: { name: "TV" },
                channel_name: "News",
                itemId: "stable",
            },
        },
        cList: [7],
        commandChannelsReady: true,
    };
    const player = {
        allowed: () => current,
        captureSelector: async () => ({ bound: true }),
        selected: () => ({ name: "Profile" }),
    };
    const result = await migration(w, player, codec);
    assert.equal(result.entries.length, 1);
    assert.equal(
        result.pending.length,
        1,
        "unmapped source favorite remains pending, preventing complete migration marker"
    );
    assert(result.current());
    let registryCurrent = true;
    player.canonicalizeFavorite = async (value) => ({
        ...value,
        current: () => value.current() && registryCurrent,
    });
    const mappedCapture = await migration(w, player, codec);
    assert(mappedCapture.current());
    registryCurrent = false;
    assert.equal(
        mappedCapture.current(),
        false,
        "aggregate migration retains each verified binding guard through later hashing/CAS"
    );
    delete player.canonicalizeFavorite;
    current = false;
    assert.equal(result.current(), false);
    current = true;
    w.__ottActiveProviderDriver.catalogLoading = () => true;
    assert.equal(
        await migration(w, player, codec),
        null,
        "partial source cannot be marked migrated"
    );
    console.log("PASS read-only journal capture and owned partial migration");
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
