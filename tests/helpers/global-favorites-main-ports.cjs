"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"),
    path = require("node:path"),
    vm = require("node:vm"),
    ts = require("typescript");
const root = path.resolve(__dirname, "../..");
function actualModule(name, window, overrides = {}) {
    const exports = {};
    const code = ts.transpileModule(
        fs.readFileSync(path.join(root, name), "utf8"),
        {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES5,
            },
        }
    ).outputText;
    vm.runInNewContext(code, {
        console,
        exports,
        require(relative) {
            if (Object.prototype.hasOwnProperty.call(overrides, relative))
                return overrides[relative];
            return actualModule(
                path.posix.normalize(
                    path.posix.join(path.posix.dirname(name), relative + ".ts")
                ),
                window
            );
        },
        URL,
        window,
    });
    return exports;
}
function actualFunctions(file, names) {
    const ast = ts.createSourceFile(
        file,
        fs.readFileSync(path.join(root, file), "utf8"),
        ts.ScriptTarget.Latest,
        true
    );
    const selected = ast.statements.filter(
        (n) =>
            (ts.isFunctionDeclaration(n) && names.includes(n.name?.text)) ||
            (ts.isVariableStatement(n) &&
                n.declarationList.declarations.some((d) =>
                    names.includes(d.name.getText(ast))
                ))
    );
    for (const name of names)
        assert(
            selected.some((n) =>
                ts.isFunctionDeclaration(n)
                    ? n.name?.text === name
                    : n.declarationList.declarations.some(
                          (d) => d.name.getText(ast) === name
                      )
            ),
            "Missing actual MAIN function " + name
        );
    return ts.transpileModule(
        selected
            .map((n) => n.getText(ast).replace(/^export\s+/, ""))
            .join("\n"),
        { compilerOptions: { target: ts.ScriptTarget.ES5 } }
    ).outputText;
}
function createMainPorts(w) {
    function call(name, args) {
        if (typeof w[name] !== "function")
            throw Error("Fixture has no actual host port: " + name);
        return w[name].apply(w, args);
    }
    const context = vm.createContext({
        _: (...args) => call("_", args),
        alert: (...args) => call("alert", args),
        console,
        enterPinAndSetAccess: (...args) => call("enterPinAndSetAccess", args),
        loadProv: (...args) => call("loadProv", args),
        stbGetItem: (...args) => call("stbGetItem", args),
        stbSetItem: (...args) => call("stbSetItem", args),
        URL,
        window: w,
    });
    vm.runInContext(
        actualFunctions("src/provider/index.ts", [
            "providerDistribution",
            "providerIds",
            "isPlayDistribution",
            "isProviderAllowed",
            "checkProviderUrl",
            "selectProviderByIndex",
        ]),
        context
    );
    vm.runInContext(
        actualFunctions("src/commands/remote-restart.ts", ["remoteCheckpoint"]),
        context
    );
    const provider = {
        checkProviderUrl: context.checkProviderUrl,
        isProviderAllowed: context.isProviderAllowed,
        selectProviderByIndex: context.selectProviderByIndex,
    };
    Object.defineProperty(provider, "providerIds", {
        get: () => context.providerIds,
    });
    const profiles = actualModule("src/commands/remote-profiles.ts", w, {
        "../provider": provider,
    });
    const caseless = actualModule("src/utils/caseless.ts", w);
    return {
        caselessKey: caseless.caselessKey,
        handleRemoteProfiles: profiles.handleRemoteProfiles,
        isProviderAllowed: provider.isProviderAllowed,
        localItemRelativePath: actualModule("src/offline/local-item-path.ts", w)
            .localItemRelativePath,
        profilesModule: profiles,
        providerIds: () => provider.providerIds,
        providerModule: provider,
        remoteCheckpoint: context.remoteCheckpoint,
        selectMediaProfile: profiles.selectGlobalMediaProfile,
        selectProviderByIndex: provider.selectProviderByIndex,
    };
}
module.exports = { actualModule, createMainPorts };
