// Source generator only; run after an admitted source/build plan is approved.
const fs = require("node:fs"),
    path = require("node:path"),
    ts = require("typescript");
const root = path.resolve(__dirname, "../../.."),
    modules = {},
    pins = {};
for (const file of [
    "src/storage/favorites-physical-storage.ts",
    "src/storage/index.ts",
    "src/settings/interface-colors.ts",
    "src/utils/lzstring.ts",
    "src/settings/favorites-operation-receipts.ts",
    "src/settings/favorites-recovery-codec.ts",
    "src/commands/favorites-recovery.ts",
    "src/commands/favorites-transfer.ts",
]) {
    const raw = fs.readFileSync(path.join(root, file), "utf8");
    pins[file] = require("node:crypto")
        .createHash("sha256")
        .update(raw)
        .digest("hex");
    const result = ts.transpileModule(raw, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
        },
        reportDiagnostics: true,
    });
    if (result.diagnostics.length)
        throw Error("Fixture module failed to transpile: " + file);
    modules[
        file === "src/storage/index.ts"
            ? "storage-main"
            : path.basename(file, ".ts")
    ] = result.outputText;
}
const text =
    "(function(){var factories={" +
    Object.entries(modules)
        .map(
            ([key, value]) =>
                JSON.stringify(key) +
                ":function(exports,require){" +
                value +
                "}"
        )
        .join(",") +
    "},cache={};window.nativeFixtureLoad=function load(name){name=name.split('/').pop();if(cache[name])return cache[name];if(!factories[name])throw Error('Unknown fixture module');var value={};cache[name]=value;factories[name](value,load);return value;};}());\n";
fs.writeFileSync(
    path.join(__dirname, "generated-modules.js"),
    text +
        "window.nativeSourcePins=Object.freeze(" +
        JSON.stringify(pins) +
        ");\n"
);
