"use strict";
const {
    createMainPorts,
} = require("./helpers/global-favorites-main-ports.cjs");
const assert = require("node:assert/strict"),
    fs = require("node:fs"),
    vm = require("node:vm"),
    ts = require("typescript");
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
            JSON,
            Math,
            Number,
            Object,
            Promise,
            require: (name) => {
                if (!(name in deps)) throw Error(name);
                return deps[name];
            },
            String,
            Uint8Array,
            window,
        }
    );
    return exports;
}
const physical = moduleAt("src/storage/favorites-physical-storage.ts", {}, {});
const utils = ts.createSourceFile(
    "helpers.ts",
    fs.readFileSync("src/utils/helpers.ts", "utf8"),
    ts.ScriptTarget.Latest,
    true
);
const metadata = utils.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === "metadataText"
);
const helperExports = {};
vm.runInNewContext(
    ts.transpileModule(metadata.getText(utils), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
        },
    }).outputText,
    { exports: helperExports }
);
let writes = 0,
    loads = 0;
const storage = {
    getItem() {
        return null;
    },
    removeItem() {
        writes++;
    },
    setItem() {
        writes++;
    },
};
const w = {
    localStorage: storage,
    location: { origin: "https://fixture.test" },
    navigator: {},
};
const capture = () =>
    physical.createFavoritesPhysicalStorageGrant(w, storage, () => true);
assert.equal(
    capture(),
    null,
    "real physical factory refuses missing Web Locks"
);
const mainPorts = createMainPorts(w);
const entry = moduleAt(
    "src/commands/global-favorites.ts",
    {
        "../offline/local-item-path": {
            localItemRelativePath: mainPorts.localItemRelativePath,
        },
        "../provider": mainPorts.providerModule,
        "../storage/index": { captureFavoritesPhysicalStorage: capture },
        "../utils/caseless": { caselessKey: mainPorts.caselessKey },
        "../utils/helpers": helperExports,
        "./remote-favorites": {
            captureLegacyCurrentFavorite() {
                throw Error("must not capture");
            },
            executeLegacyFavoriteTarget() {
                throw Error("must not dispatch");
            },
        },
        "./remote-feature": {
            loadRemoteFeature() {
                loads++;
                throw Error("must not load");
            },
        },
        "./remote-profiles": mainPorts.profilesModule,
        "./remote-restart": {
            remoteCheckpoint: mainPorts.remoteCheckpoint,
            remotePlayerInfo: () => ({ runtime: "fixture-runtime" }),
        },
    },
    w
);
assert.equal(
    entry.toggleGlobalFavorite(),
    false,
    "unsupported global path yields to existing per-source favorite"
);
assert.equal(
    entry.openGlobalFavorites(),
    false,
    "unsupported global path yields to existing category view"
);
assert.equal(writes, 0);
assert.equal(loads, 0);
assert.equal(w.__ottGlobalFavorites, undefined);
assert.equal(w.__ottGlobalFavoritesPorts, undefined);
const source = ts.createSourceFile(
    "keys.ts",
    fs.readFileSync("src/key-handler/index.ts", "utf8"),
    ts.ScriptTarget.Latest,
    true
);
const node = source.statements.find(
    (n) =>
        ts.isFunctionDeclaration(n) && n.name?.text === "toggleKeyboardFavorite"
);
assert(node, "real keyboard favorite handler exists");

const runtime = vm.createContext({ console });
vm.runInContext(
    ts
        .transpileModule(
            metadata.getText(utils) + "\n" + node.getText(source),
            {
                compilerOptions: {
                    module: ts.ModuleKind.ES2015,
                    target: ts.ScriptTarget.ES5,
                },
            }
        )
        .outputText.replace(/^export /gm, ""),
    runtime
);
let saves = 0;
Object.assign(w, {
    _: (value) => value,
    __ottActiveProviderDriver: { id: "m3u" },
    __ottClassicPlayback: {
        snapshot: () => ({
            phase: "playing",
            target: { channelId: 7, kind: "live", sourceId: "source" },
        }),
    },
    __ottClassicScreenPort: { screens: { current: () => null } },
    __ottSourceIdentity: { current: () => "source" },
    addToFavorites: (id) => w.favoritesArray.push(id),
    channels: { 7: { channel_name: "News" } },
    favoritesArray: [],
    ott_device: "pc",
    saveChannelsCats: () => {
        saves++;
        return true;
    },
    sFavorites: 0,
});
assert.equal(runtime.toggleKeyboardFavorite(w), true);
assert.deepEqual(w.favoritesArray, [7]);
assert.equal(
    saves,
    1,
    "actual keyboard handler reaches existing per-source persistence callback"
);
assert.equal(writes, 0);
assert.equal(loads, 0);
console.log(
    "PASS real missing-WebLocks qualification keeps legacy fallback and makes no global write/load"
);
