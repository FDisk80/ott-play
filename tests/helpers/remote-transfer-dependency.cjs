// Use the actual optional-transfer admission path in legacy dispatcher fixtures.
// Unknown dependencies remain the caller's responsibility; no caps are fabricated.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const acorn = require("acorn");
const files = {
    "../settings/interface-colors": "src/settings/interface-colors.ts",
    "../storage/index": "src/storage/index.ts",
    "../utils/helpers": "src/utils/helpers.ts",
    "../utils/lzstring": "src/utils/lzstring.ts",
    "./favorites-physical-storage": "src/storage/favorites-physical-storage.ts",
    "./remote-favorites-contract": "src/commands/remote-favorites-contract.ts",
    "./remote-favorites-global": "src/commands/remote-favorites-global.ts",
    "./remote-favorites-global-items":
        "src/commands/remote-favorites-global-items.ts",
    "./remote-favorites-global-recovery":
        "src/commands/remote-favorites-global-recovery.ts",
    "./remote-favorites-transfer": "src/commands/remote-favorites-transfer.ts",
    "./remote-feature": "src/commands/remote-feature.ts",
    "./remote-provider-diagnostics":
        "src/commands/remote-provider-diagnostics.ts",
};
module.exports = function dependency(name, host, environment = {}) {
    if (name === "./player-state")
        return require("./player-presence.cjs").load(
            "src/commands/player-state.ts",
            { ...environment, window: host }
        );
    if (!Object.hasOwn(files, name)) return null;
    const exports = {};
    const output = ts.transpileModule(
        fs.readFileSync(path.resolve(__dirname, "../..", files[name]), "utf8"),
        {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES5,
            },
        }
    ).outputText;
    acorn.parse(output, { ecmaVersion: 5 });
    vm.runInNewContext(output, {
        ...environment,
        exports,
        require: (next) => {
            const value = dependency(next, host, environment);
            assert(value, "Unexpected transfer fixture dependency: " + next);
            return value;
        },
        window: host,
    });
    return exports;
};

// Real factories for full-module CJS imports and legacy AST/global fixtures.
module.exports.storage = function storageImports(fallback) {
    const physical = module.exports("./favorites-physical-storage", {});
    const colors = module.exports("../settings/interface-colors", {});
    return {
        ...physical,
        ...colors,
        exports: {},
        require(name) {
            if (name === "./favorites-physical-storage") return physical;
            if (name === "../settings/interface-colors") return colors;
            if (fallback) return fallback(name);
            throw new Error("Unexpected storage fixture dependency: " + name);
        },
    };
};
