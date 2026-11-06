"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const HEAD = "14ea5da80b20a8311bb55cee250f794ae278d310";
const NODE = "22.23.4";
const ZLIB = "1.3.1-e00f703";
const METRICS = ["bytes", "gzipBytes"];
const ROOTS = {
    mobile: "dist-mobile/dist",
    tauri: "src-tauri/frontend/dist",
    web: "dist",
};
const CHANGED = {
    "color-appearance.js": "optional",
    "player.js": "entry",
    "provider-edem.js": "providerEdem",
    "remote-settings-lifecycle.js": "remoteSettingsLifecycle",
    "subtitle-appearance.js": "appearance",
};
const CATEGORIES = ["rootJavaScript", "stylesheets", "locales"];
const CLASSIC_COUNTS = { A: 78, B: 81 };
const ROOT_JS_COUNTS = { A: 79, B: 82 };
const WORKER = "dist/offline-worker.js";
const COMPARISON_ERROR =
    "Complete JavaScript inventory differs from the bound source expectation";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sorted = (items) => [...items].sort();
const sum = (rows, metric) =>
    rows.reduce((total, row) => total + row[metric], 0);
const zero = () => ({ bytes: 0, gzipBytes: 0 });
function validHash(value) {
    assert.match(value, /^[0-9a-f]{64}$/);
}
function read(directory, name) {
    const bytes = fs.readFileSync(path.join(directory, name));
    return { data: JSON.parse(bytes.toString("utf8")), sha256: sha(bytes) };
}

// The hosted comparison failed its root-JS cardinality check. Derive comparison
// rows only from its hash-bound inventories, without rewriting that failure or
// recompressing measurements using a different Node/zlib build.
function verifyClientColorsEvidence(directory, context) {
    const receiptFile = read(directory, "receipt.json");
    const manifestFile = read(directory, "manifest.json");
    const { data: receipt } = receiptFile;
    const { data: manifest } = manifestFile;
    const { data: verification } = read(directory, "DATA-VERIFY.json");
    const supplementalFile = read(directory, "DATA-COMPARISON.json");
    const { data: supplemental } = supplementalFile;
    const { data: rawVerification } = read(directory, "raw-verification.json");
    assert.equal(
        verification.verdict,
        "DATA_RECONCILED_WITH_ORIGINAL_RUN_FAILURE"
    );
    assert.equal(verification.checksFailed, 0);
    assert.equal(verification.comparisonSha256, supplementalFile.sha256);
    assert.equal(
        supplemental.status,
        "SUPPLEMENTAL_DATA_RECONCILIATION_NOT_PIPELINE_PASS"
    );
    for (const evidence of [verification, supplemental]) {
        assert.equal(evidence.runId, receipt.runId);
        assert.equal(evidence.workflowSha, receipt.workflowSha);
        assert.equal(evidence.originalReceiptSha256, receiptFile.sha256);
        assert.equal(evidence.featurePatchSha256, receipt.featurePatchSha256);
    }
    assert.deepEqual(verification.originalOutcome, {
        allCommandsPassed: false,
        complete: false,
        error: COMPARISON_ERROR,
        workflow: "FAILURE",
    });
    assert.equal(rawVerification.result, "PASS");
    assert.equal(rawVerification.receiptSha256, receiptFile.sha256);
    assert.equal(rawVerification.manifestSha256, manifestFile.sha256);
    assert.equal(rawVerification.node, NODE);
    assert.equal(rawVerification.zlib, ZLIB);
    assert.equal(rawVerification.allCommandsPassed, false);
    assert(
        !fs.existsSync(path.join(directory, "comparison.json")),
        "the original failed experiment produced no comparison.json"
    );
    assert.equal(receipt.schemaVersion, 1);
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.status, "bound");
    assert.equal(receipt.baseCommit, HEAD);
    assert.equal(manifest.baseCommit, HEAD);
    assert.equal(receipt.nodeVersions.node, NODE);
    assert.equal(receipt.nodeVersions.zlib, ZLIB);
    assert.equal(manifest.nodeVersion, NODE);
    assert.equal(manifest.zlibVersion, ZLIB);
    assert.equal(receipt.manifestSha256, manifestFile.sha256);
    validHash(receipt.featurePatchSha256);
    assert.equal(receipt.featurePatchSha256, manifest.featurePatchSha256);
    assert.deepEqual(receipt.tools, manifest.tools);
    for (const digest of Object.values(receipt.tools)) validHash(digest);
    assert.equal(receipt.complete, false);
    assert.equal(receipt.error, COMPARISON_ERROR);
    assert.equal(receipt.allCommandsPassed, false);
    assert.deepEqual(manifest.expectedRootJavaScriptFiles, CLASSIC_COUNTS);
    assert.deepEqual(manifest.expectedNewRootJs, ["color-appearance.js"]);
    assert.deepEqual(sorted(Object.keys(receipt.arms)), ["A", "B"]);
    assert.deepEqual(
        receipt.arms.A.identityProbe,
        receipt.arms.B.identityProbe
    );
    assert.equal(receipt.arms.A.identityProbe.sourceHead, HEAD);
    assert.equal(receipt.arms.A.identityProbe.sourceRevision, "");
    assert.equal(receipt.arms.A.markerSha256, receipt.arms.B.markerSha256);
    validHash(receipt.arms.A.markerSha256);

    const inventories = {};
    const inventoryHashes = {};
    const tables = {};
    for (const arm of ["A", "B"]) {
        const state = receipt.arms[arm];
        assert.equal(state.gitHead, HEAD);
        assert.equal(state.inputValid, true);
        assert.equal(state.sourceValidatedAfter, true);
        assert.equal(state.measurementComplete, true);
        assert.deepEqual(
            state.steps.map((step) => step.name),
            [
                "clone",
                "checkout",
                ...(arm === "B" ? ["apply"] : []),
                "dependencies",
                "media",
                "build",
                "size",
                "collect",
            ]
        );
        for (const step of state.steps)
            assert.equal(
                step.exit_code,
                arm === "B" && ["build", "size"].includes(step.name) ? 1 : 0,
                arm + " original " + step.name + " exit status"
            );
        assert.equal(state.allCommandsPassed, arm === "A");
        assert.equal(
            state.allCommandsPassed,
            state.steps.every((step) => step.exit_code === 0)
        );
        for (const [name, digest] of Object.entries(manifest.unchanged))
            assert.equal(
                state.sourceHashes[name],
                digest,
                arm + " frozen " + name
            );
        for (const [name, identity] of Object.entries(manifest.files))
            assert.deepEqual(
                state.sourceHashes[name],
                identity[arm === "A" ? "before" : "after"],
                name
            );
        const file = read(directory, arm + "/assets/inventory.json");
        assert.equal(file.sha256, state.inventorySha256);
        inventoryHashes[arm] = file.sha256;
        const inventory = (inventories[arm] = file.data);
        assert.equal(inventory.version, 1);
        assert.equal(inventory.complete, true);
        assert.equal(inventory.node, NODE);
        assert.equal(inventory.zlib, ZLIB);
        assert.deepEqual(inventory.errors, []);
        assert.equal(inventory.omittedErrors, 0);
        assert.equal(
            inventory.measurement.sha256,
            manifest.unchanged["scripts/classic-size.cjs"]
        );
        assert.equal(inventory.measurement.export, "collectBundleMeasurement");
        assert.equal(inventory.measurement.gzipLevel, 9);
        const table = (tables[arm] = new Map());
        for (const record of inventory.records) {
            assert(
                !table.has(record.path),
                "duplicate measured asset: " + record.path
            );
            assert(Object.hasOwn(ROOTS, record.family));
            assert(CATEGORIES.includes(record.category));
            assert.equal(record.preservedPath, "raw/" + record.path);
            validHash(record.sha256);
            for (const metric of METRICS)
                assert(
                    Number.isSafeInteger(record[metric]) && record[metric] > 0,
                    record.path
                );
            table.set(record.path, record);
        }
        for (const family of [null, ...Object.keys(ROOTS)]) {
            const totals =
                family === null
                    ? inventory.totals
                    : inventory.families.find((row) => row.name === family)
                          .totals;
            for (const category of CATEGORIES) {
                const records = inventory.records.filter(
                    (record) =>
                        record.category === category &&
                        (family === null || record.family === family)
                );
                assert.deepEqual(totals[category], {
                    bytes: sum(records, "bytes"),
                    files: records.length,
                    gzipBytes: sum(records, "gzipBytes"),
                });
            }
        }
        const actualJs = inventory.records.filter(
            (record) => record.category === "rootJavaScript"
        );
        const expectedJs = Object.values(ROOTS).flatMap((root) => [
            root + "/player.js",
            ...Object.keys(context.providers).map(
                (name) => root + "/provider-" + name + ".js"
            ),
            ...Object.keys(context.optionals)
                .filter((name) => arm === "B" || name !== "color-appearance")
                .map((name) => root + "/" + name + ".js"),
        ]);
        assert.equal(expectedJs.length, CLASSIC_COUNTS[arm]);
        assert.equal(actualJs.length, ROOT_JS_COUNTS[arm]);
        assert.deepEqual(
            sorted(actualJs.map((row) => row.path)),
            sorted([...expectedJs, WORKER]),
            "only the web offline worker is outside the Classic registry"
        );
    }
    assert.equal(
        receipt.allCommandsPassed,
        Object.values(receipt.arms).every((arm) => arm.allCommandsPassed)
    );
    const allPaths = sorted(new Set([...tables.A.keys(), ...tables.B.keys()]));
    const assets = allPaths.map((name) => {
        const before = tables.A.get(name) || null;
        const after = tables.B.get(name) || null;
        const reference = before || after;
        return {
            after,
            before,
            category: reference.category,
            deltaBytes: (after ? after.bytes : 0) - (before ? before.bytes : 0),
            deltaGzipBytes:
                (after ? after.gzipBytes : 0) - (before ? before.gzipBytes : 0),
            family: reference.family,
            path: name,
            status: !before
                ? "added"
                : !after
                  ? "removed"
                  : before.sha256 === after.sha256
                    ? "unchanged"
                    : "changed",
        };
    });
    const recordValues = (record) =>
        record && {
            bytes: record.bytes,
            gzipBytes: record.gzipBytes,
            preservedPath: record.preservedPath,
            sha256: record.sha256,
        };
    assert.deepEqual(
        supplemental.allPerFileDeltas,
        assets.map((row) => ({
            after: recordValues(row.after),
            before: recordValues(row.before),
            category: row.category,
            deltaBytes: row.deltaBytes,
            deltaRecordedGzipBytes: row.deltaGzipBytes,
            family: row.family,
            path: row.path,
            status: row.status,
        }))
    );
    for (const arm of ["A", "B"])
        assert.deepEqual(rawVerification.counts[arm], {
            bytes: sum(inventories[arm].records, "bytes"),
            files: inventories[arm].records.length,
        });
    for (const row of assets) {
        const { before, after } = row;
        if (before && after) {
            assert.equal(before.family, after.family);
            assert.equal(before.category, after.category);
        }
        if (row.status === "unchanged") assert.deepEqual(before, after);
        assert(after, "no measured asset may disappear: " + row.path);
        if (row.category === "rootJavaScript") {
            assert.equal(path.posix.dirname(row.path), ROOTS[row.family]);
            if (row.path === WORKER) {
                assert(before);
                assert.equal(row.family, "web");
                assert.equal(row.deltaBytes, 27);
                assert.equal(row.deltaGzipBytes, 3);
                continue;
            }
            const family = CHANGED[path.posix.basename(row.path)];
            if (!family)
                assert.deepEqual(
                    before,
                    after,
                    "unreviewed changed bundle: " + row.path
                );
            if (family === "optional") assert.equal(before, null);
            else assert(before, "only the color editor may be newly emitted");
        } else if (row.category === "stylesheets") {
            assert.deepEqual(
                before,
                after,
                "unreviewed stylesheet change: " + row.path
            );
        } else if (row.status !== "unchanged") {
            assert(
                Object.hasOwn(
                    manifest.files,
                    "locales/" + path.posix.basename(row.path)
                ),
                "unreviewed locale: " + row.path
            );
        }
    }
    for (const category of CATEGORIES) {
        const rows = assets.filter((row) => row.category === category);
        for (const metric of METRICS)
            assert.equal(
                sum(rows, metric === "bytes" ? "deltaBytes" : "deltaGzipBytes"),
                inventories.B.totals[category][metric] -
                    inventories.A.totals[category][metric]
            );
    }
    const computed = Object.fromEntries(
        Object.values(CHANGED).map((name) => [name, zero()])
    );
    const margins = [];
    for (const [family, root] of Object.entries(ROOTS)) {
        const rows = assets.filter(
            (row) =>
                row.family === family &&
                row.category === "rootJavaScript" &&
                row.path !== WORKER
        );
        for (const [filename, part] of Object.entries(CHANGED)) {
            const row = rows.find(
                (entry) => entry.path === root + "/" + filename
            );
            assert(row, family + " missing " + filename);
            for (const metric of METRICS) {
                const delta =
                    row.after[metric] - (row.before ? row.before[metric] : 0);
                computed[part][metric] = Math.max(
                    computed[part][metric],
                    delta
                );
            }
        }
        const edem = rows.find(
            (row) => row.path === root + "/provider-edem.js"
        );
        const providerMargin = {
            after: zero(),
            before: zero(),
            consumed: zero(),
            family,
        };
        for (const metric of METRICS) {
            const cap = context.providerBudget[metric];
            providerMargin.before[metric] = cap - edem.before[metric];
            providerMargin.after[metric] = cap - edem.after[metric];
            providerMargin.consumed[metric] =
                edem.after[metric] - edem.before[metric];
            assert(
                providerMargin.before[metric] >= 0 &&
                    providerMargin.after[metric] >= 0,
                family + " Edem exceeds unchanged cap"
            );
            assert.equal(
                providerMargin.before[metric] - providerMargin.after[metric],
                providerMargin.consumed[metric]
            );
        }
        margins.push(providerMargin);
        for (const [name, select] of [
            ["BUDGET", (row) => row.path === root + "/player.js"],
            [
                "LEGACY_TOTAL_BUDGET",
                (row) =>
                    /^(?:player|provider-.+)\.js$/.test(
                        path.posix.basename(row.path)
                    ),
            ],
            ["BASE_TOTAL_BUDGET", () => true],
            ["TOTAL_BUDGET", () => true],
        ]) {
            const members = rows.filter(select);
            for (const metric of METRICS) {
                const before = members.reduce(
                    (total, row) =>
                        total + (row.before ? row.before[metric] : 0),
                    0
                );
                const after = members.reduce(
                    (total, row) => total + row.after[metric],
                    0
                );
                assert(
                    context.after[name][metric] - after >=
                        context.before[name][metric] - before,
                    family + " " + name + " preserves measured margin"
                );
                if (name !== "BASE_TOTAL_BUDGET")
                    assert(
                        after <= context.after[name][metric],
                        family + " " + name + " candidate fits"
                    );
            }
        }
        for (const filename of [
            "subtitle-appearance",
            "remote-settings-lifecycle",
        ]) {
            const row = rows.find(
                (entry) => entry.path === root + "/" + filename + ".js"
            );
            for (const metric of METRICS) {
                const before =
                    context.before.OPTIONAL_BUDGETS[filename][metric] -
                    row.before[metric];
                const after =
                    context.after.OPTIONAL_BUDGETS[filename][metric] -
                    row.after[metric];
                assert(
                    after >= before && after >= 0,
                    family + " " + filename + " preserves measured margin"
                );
            }
        }
        const editor = rows.find(
            (row) => row.path === root + "/color-appearance.js"
        );
        for (const metric of METRICS)
            assert(
                editor.after[metric] <=
                    context.after.OPTIONAL_BUDGETS["color-appearance"][metric]
            );
    }
    assert.deepEqual(
        context.allowance,
        computed,
        "five independently measured nonnegative maxima; no extra reserve or three-target sum"
    );
    const worker = assets.find((row) => row.path === WORKER);
    return {
        classicJavaScriptCounts: { ...CLASSIC_COUNTS },
        comparisonSource: "derived from original hash-bound inventories",
        computed,
        inventorySha256: inventoryHashes,
        manifestSha256: manifestFile.sha256,
        originalComparison: {
            allCommandsPassed: receipt.allCommandsPassed,
            artifactAvailable: false,
            complete: receipt.complete,
            error: receipt.error,
        },
        providerMargins: margins,
        receiptSha256: receiptFile.sha256,
        rootJavaScriptCounts: { ...ROOT_JS_COUNTS },
        separateWorkerDelta: {
            bytes: worker.deltaBytes,
            gzipBytes: worker.deltaGzipBytes,
            path: worker.path,
        },
    };
}
module.exports = { verifyClientColorsEvidence };
