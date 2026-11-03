const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { gzipSync } = require("node:zlib");
const ts = require("typescript");
const {
    assembleClassic,
    CLASSIC_OPTIONAL_BUNDLES,
    CLASSIC_PROVIDER_BUNDLES,
} = require("./classic-bundle.cjs");
const { optimizeClassic } = require("./classic-optimizer.cjs");
const { CLASSIC_PLAYER_NAME_POLICY } = require("./classic-function-names.cjs");

// Isolate the optional asset without building, stamping or staging the player.
// Snapshot both inputs so an ongoing edit cannot change a measurement midway.
async function main() {
    const [revision, destination, bundle = "modern"] = process.argv.slice(2);
    if (!revision || !destination || !["modern", "plex"].includes(bundle))
        throw new Error(
            "Usage: node scripts/measure-modern-shell.cjs BASE OUTPUT_DIRECTORY [modern|plex]"
        );
    const root = path.resolve(__dirname, "..");
    const output = path.resolve(destination);
    if (fs.existsSync(output))
        throw new Error("Output directory must not already exist");
    const git = (...args) =>
        execFileSync("git", args, { cwd: root, encoding: "utf8" });
    const base = git("rev-parse", "--verify", revision + "^{commit}").trim();
    const bundleModules =
        bundle === "plex"
            ? CLASSIC_PROVIDER_BUNDLES.plex
            : CLASSIC_OPTIONAL_BUNDLES["modern-interface"];
    const files = bundleModules.map((file) =>
        file.replace(/^build\//, "src/").replace(/\.js$/, ".ts")
    );
    const hash = (value) => createHash("sha256").update(value).digest("hex");
    const measure = (value) => ({
        bytes: Buffer.byteLength(value),
        gzipBytes: gzipSync(value, { level: 9 }).length,
        sha256: hash(value),
    });
    const snapshots = { baseline: {}, candidate: {} };
    for (const file of files) {
        snapshots.baseline[file] = git("show", base + ":" + file);
        snapshots.candidate[file] = fs.readFileSync(
            path.join(root, file),
            "utf8"
        );
    }
    const options = ts.convertCompilerOptionsFromJson(
        JSON.parse(fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"))
            .compilerOptions,
        root
    ).options;
    const report = {
        base,
        packageLock: hash(
            fs.readFileSync(path.join(root, "package-lock.json"))
        ),
        schema: 1,
        scope: bundle + " asset only; does not approve complete release size",
        snapshots: {},
        toolchain: {
            gzipLevel: 9,
            node: process.versions.node,
            terser: require("terser/package.json").version,
            typescript: ts.version,
            zlib: process.versions.zlib,
        },
    };
    fs.mkdirSync(output, { recursive: true });
    for (const [name, sources] of Object.entries(snapshots)) {
        const buildRoot = path.join(output, name);
        const input = {};
        const modules = [];
        for (const file of files) {
            const source = sources[file];
            const target = file
                .replace(/^src\//, "build/")
                .replace(/\.ts$/, ".js");
            fs.mkdirSync(path.dirname(path.join(buildRoot, file)), {
                recursive: true,
            });
            fs.mkdirSync(path.dirname(path.join(buildRoot, target)), {
                recursive: true,
            });
            fs.writeFileSync(path.join(buildRoot, file), source);
            const compiled = ts.transpileModule(source, {
                compilerOptions: options,
                fileName: path.join(buildRoot, file),
            }).outputText;
            fs.writeFileSync(path.join(buildRoot, target), compiled);
            input[file] = {
                compiled: measure(compiled),
                source: measure(source),
            };
            modules.push(target);
        }
        const linked = assembleClassic(buildRoot, modules);
        const optimized = await optimizeClassic(
            linked,
            CLASSIC_PLAYER_NAME_POLICY
        );
        fs.writeFileSync(
            path.join(
                buildRoot,
                bundle === "plex" ? "provider-plex.js" : "modern-interface.js"
            ),
            optimized.code
        );
        report.snapshots[name] = { input, output: measure(optimized.code) };
    }
    report.delta = Object.fromEntries(
        ["bytes", "gzipBytes"].map((metric) => [
            metric,
            report.snapshots.candidate.output[metric] -
                report.snapshots.baseline.output[metric],
        ])
    );
    fs.writeFileSync(
        path.join(output, "measurements.json"),
        JSON.stringify(report, null, 2) + "\n"
    );
    console.log(JSON.stringify({ delta: report.delta, output }));
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
