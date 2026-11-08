#!/usr/bin/env node
// Size diagnostics from existing compiler output; never stamp or stage a release.
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
    assembleClassic,
    CLASSIC_MAIN_MODULES,
    CLASSIC_OPTIONAL_BUNDLES,
    CLASSIC_PROVIDER_BUNDLES,
} = require("./classic-bundle.cjs");
const { CLASSIC_PLAYER_NAME_POLICY } = require("./classic-function-names.cjs");
const { optimizeClassic } = require("./classic-optimizer.cjs");
const { applyPlayerBuildIdentity } = require("./player-build-identity.cjs");
const { transformPlaySystemIcons } = require("./play-system-icons.cjs");
const {
    BUDGET,
    collectBundleMeasurement,
    LEGACY_TOTAL_BUDGET,
    OPTIONAL_BUDGETS,
    PROVIDER_BUDGET,
    TOTAL_BUDGET,
} = require("./classic-size.cjs");

const REPORT = "build/reports/release-envelope-size.json";
const SUFFIX = "-beta.999999";

function definitions() {
    return [
        {
            budget: BUDGET,
            files: CLASSIC_MAIN_MODULES,
            kind: "entry",
            name: "player.js",
        },
        ...Object.entries(CLASSIC_PROVIDER_BUNDLES).map(([kind, files]) => ({
            budget: PROVIDER_BUDGET,
            files,
            kind: "provider",
            name: "provider-" + kind + ".js",
        })),
        ...Object.entries(CLASSIC_OPTIONAL_BUNDLES).map(([name, files]) => {
            if (!OPTIONAL_BUDGETS[name])
                throw Error("Missing optional budget: " + name);
            return {
                budget: OPTIONAL_BUDGETS[name],
                files,
                kind: "optional",
                name: name + ".js",
            };
        }),
    ];
}

function representativeVersion(version) {
    const match =
        typeof version === "string" &&
        /^(\d+\.\d+\.\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(
            version
        );
    if (!match) throw Error("Missing or invalid package version");
    return match[1] + SUFFIX;
}

function stampMain(source, version, head) {
    if (typeof head !== "string" || !/^[0-9a-f]{40}$/.test(head))
        throw Error("Expected actual 40-hex Git HEAD");
    for (const marker of [
        "__OTTP_VERSION__",
        "__OTTP_BUILD_ID__",
        "__OTTP_SOURCE_REVISION__",
    ])
        if (!source.includes(marker))
            throw Error("Missing main identity placeholder: " + marker);
    const versioned = source.replace(/__OTTP_VERSION__/g, version);
    // Same hash input as createPlayerBuildIdentity, without a source attestation.
    const identity = {
        buildId:
            "bundle-" + createHash("sha256").update(versioned).digest("hex"),
        sourceRevision: head,
    };
    return { code: applyPlayerBuildIdentity(versioned, identity), identity };
}

function inspectEnvelope(assets) {
    const expected = definitions();
    const names = Object.keys(assets);
    if (
        names.length !== expected.length ||
        expected.some(({ name }) => !Object.hasOwn(assets, name))
    )
        throw Error("Missing or unexpected envelope assets");
    const errors = [],
        targets = {};
    for (const target of ["web", "native"]) {
        const check = (name, measured, budget) => {
            for (const metric of ["bytes", "gzipBytes"])
                if (measured[metric] > budget[metric])
                    errors.push({
                        actual: measured[metric],
                        asset: name,
                        limit: budget[metric],
                        metric,
                        target,
                    });
        };
        const measured = expected.map(({ budget, kind, name }) => {
            if (typeof assets[name] !== "string" || !assets[name])
                throw Error("Empty or invalid envelope asset: " + name);
            const code =
                target === "native"
                    ? transformPlaySystemIcons(assets[name])
                    : assets[name];
            const row = {
                ...collectBundleMeasurement(code, name),
                budget,
                kind,
            };
            check(name, row, budget);
            return row;
        });
        const sum = (rows) =>
            rows.reduce(
                (total, row) => ({
                    bytes: total.bytes + row.bytes,
                    gzipBytes: total.gzipBytes + row.gzipBytes,
                }),
                { bytes: 0, gzipBytes: 0 }
            );
        const legacyTotal = sum(
            measured.filter(({ kind }) => kind !== "optional")
        );
        const total = sum(measured);
        check("legacyTotal", legacyTotal, LEGACY_TOTAL_BUDGET);
        check("total", total, TOTAL_BUDGET);
        targets[target] = { assets: measured, legacyTotal, total };
    }
    return { errors, targets };
}

async function releaseEnvelope(root, head, environment = process.env) {
    for (const key of [
        "OTTPLAY_CONTROL_DISCOVERY_URL",
        "OTTPLAY_CONTROL_DISCOVERY_SHA256",
        "OTTPLAY_ANDROID_FLAVOR",
        "OTTPLAY_ANDROID_OUTPUT",
        "OTTPLAY_ANDROID_COMPILE_ROOT",
    ])
        if (environment[key] !== undefined)
            throw Error("Unsupported envelope build override: " + key);
    if (typeof head !== "string" || !/^[0-9a-f]{40}$/.test(head))
        throw Error("Expected actual 40-hex Git HEAD");
    const version = representativeVersion(
        JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
            .version
    );
    const expected = definitions();
    for (const file of new Set(expected.flatMap(({ files }) => files))) {
        const input = fs.lstatSync(path.join(root, file));
        if (!input.isFile() || !input.size)
            throw Error("Missing or invalid compiled input: " + file);
    }
    const assets = {};
    let identity;
    for (const { files, kind, name } of expected) {
        let source = assembleClassic(root, files);
        if (kind === "entry") {
            const stamped = stampMain(source, version, head);
            source = stamped.code;
            identity = stamped.identity;
        } else if (kind === "provider") {
            source = source.replace(/__OTTP_VERSION__/g, version);
        }
        // Optional assembly intentionally does not substitute version or identity:
        // this is the same per-asset production path as vite.config.ts.
        assets[name] = (
            await optimizeClassic(source, CLASSIC_PLAYER_NAME_POLICY)
        ).code;
    }
    const measured = inspectEnvelope(assets);
    return {
        ...measured,
        budgets: {
            entry: BUDGET,
            legacyTotal: LEGACY_TOTAL_BUDGET,
            optional: OPTIONAL_BUDGETS,
            provider: PROVIDER_BUDGET,
            total: TOTAL_BUDGET,
        },
        identity,
        nativeTargets: ["tauri", "capacitor"],
        releaseAttestation: false,
        representativeVersion: version,
        schema: 1,
        scope: "Representative release metadata size only; not a worst-case bound, source verification, staging, or release acceptance",
        sourceHead: head,
        status: measured.errors.length
            ? "FAIL_RELEASE_ENVELOPE_SIZE"
            : "PASS_RELEASE_ENVELOPE_SIZE",
        toolchain: {
            gzipLevel: 9,
            node: process.versions.node,
            terser: require("terser/package.json").version,
            zlib: process.versions.zlib,
        },
    };
}

async function main() {
    const root = path.resolve(__dirname, "..");
    let report;
    try {
        if (process.argv.length !== 2)
            throw Error("Usage: node scripts/check-release-envelope-size.cjs");
        const head = execFileSync(
            "git",
            ["--no-optional-locks", "rev-parse", "--verify", "HEAD"],
            {
                cwd: root,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
                timeout: 10000,
            }
        ).trim();
        report = await releaseEnvelope(root, head);
    } catch (error) {
        report = {
            errors: [{ message: error.message }],
            releaseAttestation: false,
            schema: 1,
            status: "FAIL_RELEASE_ENVELOPE_INPUT",
        };
    }
    const output = path.join(root, REPORT);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(report.status + ": " + REPORT);
    if (report.errors.length) process.exitCode = 1;
}

module.exports = {
    definitions,
    inspectEnvelope,
    releaseEnvelope,
    representativeVersion,
    stampMain,
};
if (require.main === module)
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
