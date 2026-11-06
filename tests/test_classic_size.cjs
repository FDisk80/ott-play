const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
let {
    CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE,
    INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE,
    DESKTOP_DROP_ALLOWANCE,
    DESKTOP_VIDEO_QUEUE_ALLOWANCE,
    AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE,
    NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE,
    FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE,
    LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE,
    LOCAL_FAVORITES_PATH_ALLOWANCE,
    COMPANION_DIAGNOSTICS_ALLOWANCE,
    TORRENT_DISCOVERY_ALLOWANCE,
    TORRENT_STREAMS_ALLOWANCE,
    TORZNAB_DISCOVERY_ALLOWANCE,
    TORRENT_PROVIDER_ALLOWANCE,
    MODERN_EXPERIENCE_ALLOWANCE,
    MODERN_INFO_INTERACTION_ALLOWANCE,
    MODERN_INTERFACE_ENTRY_ALLOWANCE,
    MODERN_INTERFACE_OPTIONAL_ALLOWANCE,
    MODERN_INTERFACE_RELATED_ALLOWANCES,
    MODERN_NATIVE_SHELL_OPTIONAL_ALLOWANCE,
    MODERN_REPAINT_OPTIONAL_ALLOWANCE,
    MODERN_PLAYER_OPTIONAL_ALLOWANCE,
    MEDIA_COMPANION_ENTRY_ALLOWANCE,
    MEDIA_COMPANION_OPTIONAL_ALLOWANCE,
    MEDIA_COMPANION_SETTINGS_ALLOWANCE,
    MEDIA_COMPANION_TRANSPORT_ALLOWANCE,
    MEDIA_COMPANION_PREPARATION_ALLOWANCE,
    CATEGORY_NAVIGATION_ENTRY_ALLOWANCE,
    CATEGORY_NAVIGATION_FAVORITES_ALLOWANCE,
    CATEGORY_PICKER_ENTRY_ALLOWANCE,
    CATEGORY_SELECTION_ENTRY_ALLOWANCE,
    CATEGORY_VISIBILITY_ENTRY_ALLOWANCE,
    EPG_PRESENTATION_ENTRY_ALLOWANCE,
    CATEGORY_SELECTION_FAVORITES_ALLOWANCE,
    MIXED_GLOBAL_FAVORITES_ENTRY_ALLOWANCE,
    MIXED_GLOBAL_FAVORITES_OPTIONAL_ALLOWANCE,
    MIXED_GLOBAL_FAVORITES_PROVIDER_ALLOWANCE,
    FAVORITES_RECOVERY_ENTRY_ALLOWANCE,
    FAVORITES_RECOVERY_OPTIONAL_ALLOWANCE,
    DESKTOP_FAVORITES_KEY_ALLOWANCE,
    SHAKA_RETIREMENT_ENTRY_ALLOWANCE,
    SHAKA_TRACKS_ENTRY_ALLOWANCE,
    ARCHIVE_RELATIVE_SEEK_ALLOWANCE,
    RELATIVE_SEEK_ENTRY_ALLOWANCE,
    PLEX_ARTWORK_ALLOWANCE,
    PLEX_QUEUE_STEP_TOTAL_ALLOWANCE,
    PLAYER_PRESENCE_ENTRY_ALLOWANCE,
    PLAYER_PRESENCE_TRANSPORT_ALLOWANCE,
    STB_PLAYER_ENTRY_ALLOWANCE,
    STB_PLAYER_FAVORITES_ALLOWANCE,
    STB_PLAYER_STALKER_ALLOWANCE,
    STB_PLAYER_XTREAM_ALLOWANCE,
    FAVORITES_TRANSFER_ENTRY_ALLOWANCE,
    FAVORITES_TRANSFER_PLEX_ALLOWANCE,
    FAVORITES_TRANSFER_OPTIONAL_ALLOWANCE,
    ARTIFACTS,
    clearBuildSizeReports,
    collectBundleMeasurement,
    writeBuildBundleReport,
    BUDGET,
    BASE_TOTAL_BUDGET,
    LOCAL_COMPATIBILITY_ALLOWANCE,
    LOCAL_SOURCE_DIAGNOSTICS_ALLOWANCE,
    LOCAL_STALL_RECOVERY_ALLOWANCE,
    LOCAL_COMMAND_SESSION_ALLOWANCE,
    LOCAL_STARTUP_PREVIEW_ALLOWANCE,
    OPTIONAL_BUDGET,
    OPTIONAL_BUDGETS,
    PROVIDER_BUDGET,
    TOTAL_BUDGET,
    TIZEN_PACKAGE_BOOT_ALLOWANCE,
    LEGACY_TOTAL_BUDGET,
    inspectBundleSets,
    inspectBundles,
    measureBundle,
    writeBundleReport,
} = require("../scripts/classic-size.cjs");
let {
    CLASSIC_PROVIDER_BUNDLES,
    CLASSIC_OPTIONAL_BUNDLES,
} = require("../scripts/classic-bundle.cjs");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ottplay-size-test-"));
const androidOutput = fs.mkdtempSync(
    path.join(os.tmpdir(), "ottplay-size-android-output-")
);
// Preserve the real caps for live over-limit checks. Historical projections
// exclude only the explicitly named newer features, never unrelated allowances.
const latestCaps = Object.freeze({
    BASE_TOTAL_BUDGET,
    BUDGET,
    LEGACY_TOTAL_BUDGET,
    OPTIONAL_BUDGETS,
    TOTAL_BUDGET,
});
const latestOptionalBundles = CLASSIC_OPTIONAL_BUNDLES;
function capsWithoutAllowances(names) {
    assert.equal(new Set(names).size, names.length);
    const filename = require.resolve("../scripts/classic-size.cjs");
    let source = fs.readFileSync(filename, "utf8");
    const parsed = ts.createSourceFile(
        filename,
        source,
        ts.ScriptTarget.Latest,
        true
    );
    const declarations = parsed.statements
        .filter(ts.isVariableStatement)
        .flatMap((statement) => [...statement.declarationList.declarations]);
    const initializers = names.map((name) => {
        const matches = declarations.filter(
            (declaration) => declaration.name.getText(parsed) === name
        );
        assert.equal(matches.length, 1, name + " has one budget declaration");
        assert(matches[0].initializer);
        return { initializer: matches[0].initializer, name };
    });
    for (const { name, initializer } of initializers.sort(
        (a, b) => b.initializer.pos - a.initializer.pos
    )) {
        const neutral = [
            "CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE",
            "INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE",
        ].includes(name)
            ? "Object.freeze({entry:Object.freeze({bytes:0,gzipBytes:0}),appearance:Object.freeze({bytes:0,gzipBytes:0})})"
            : name === "DESKTOP_DROP_ALLOWANCE"
              ? "Object.freeze({entry:Object.freeze({bytes:0,gzipBytes:0}),optional:Object.freeze({bytes:0,gzipBytes:0})})"
              : "Object.freeze({bytes:0,gzipBytes:0,optional:Object.freeze({bytes:4800,gzipBytes:1900}),entry:Object.freeze({bytes:0,gzipBytes:0}),favorites:Object.freeze({bytes:0,gzipBytes:0})})";
        source =
            source.slice(0, initializer.getStart(parsed)) +
            neutral +
            source.slice(initializer.end);
    }
    const Module = require("node:module");
    const baseline = new Module(filename, module);
    baseline.filename = filename;
    baseline.paths = module.paths;
    baseline._compile(source, filename);
    if (names.includes("DESKTOP_DROP_ALLOWANCE"))
        baseline.exports.OPTIONAL_BUDGETS = Object.freeze(
            Object.fromEntries(
                Object.entries(baseline.exports.OPTIONAL_BUDGETS).filter(
                    ([name]) => name !== "local-drop"
                )
            )
        );
    return baseline.exports;
}
// Observed net payload accounting preserves the previous headroom. The two
// artifacts use different identities; never relabel them as an isolated experiment.
const notificationEvidence = require("../docs/evidence/interface-notification-settings-size-20261106.json");
const preNotificationCaps = capsWithoutAllowances([
    "INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE",
]);
assert.equal(
    notificationEvidence.status,
    "OBSERVED_NET_PAIR_NOT_BUILD_QUALIFICATION"
);
assert.equal(notificationEvidence.compatibility.same_version_envelope, false);
assert.equal(
    notificationEvidence.compatibility
        .isolated_same_identity_feature_measurement,
    false
);
assert.equal(
    notificationEvidence.compatibility.final_combined_head_gate_required,
    true
);
assert.deepEqual(
    notificationEvidence.baseline.toolchain,
    notificationEvidence.candidate.toolchain
);
assert.deepEqual(
    INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE,
    notificationEvidence.measured_allowance
);
assert(Object.isFrozen(INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE));
for (const cap of Object.values(INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE))
    assert(Object.isFrozen(cap));
for (const source of [
    notificationEvidence.baseline,
    notificationEvidence.candidate,
]) {
    assert.match(source.head, /^[0-9a-f]{40}$/);
    assert.match(source.report_sha256, /^[0-9a-f]{64}$/);
}
const notificationPaths = new Map();
for (const entry of ARTIFACTS) {
    notificationPaths.set(entry, "entry");
    const directory = path.posix.dirname(entry);
    for (const name of Object.keys(CLASSIC_PROVIDER_BUNDLES))
        notificationPaths.set(
            directory + "/provider-" + name + ".js",
            "provider"
        );
    for (const name of Object.keys(CLASSIC_OPTIONAL_BUNDLES))
        notificationPaths.set(directory + "/" + name + ".js", "optional");
}
assert.deepEqual(
    notificationEvidence.assets.map((a) => a.path).sort(),
    [...notificationPaths.keys()].sort()
);
let unchangedNotificationAssets = 0;
for (const asset of notificationEvidence.assets) {
    assert.equal(asset.kind, notificationPaths.get(asset.path));
    for (const side of ["baseline", "candidate"]) {
        assert.match(asset[side].sha256, /^[0-9a-f]{64}$/);
        for (const metric of ["bytes", "gzipBytes"])
            assert(
                Number.isSafeInteger(asset[side][metric]) &&
                    asset[side][metric] > 0
            );
    }
    if (
        asset.kind !== "entry" &&
        !asset.path.endsWith("/subtitle-appearance.js")
    ) {
        assert.deepEqual(asset.baseline, asset.candidate, asset.path);
        unchangedNotificationAssets++;
    }
    const cap =
        asset.kind === "entry"
            ? latestCaps.BUDGET
            : asset.kind === "provider"
              ? PROVIDER_BUDGET
              : latestCaps.OPTIONAL_BUDGETS[
                    path.posix.basename(asset.path, ".js")
                ];
    assert(cap, asset.path);
    for (const metric of ["bytes", "gzipBytes"])
        assert(
            asset.candidate[metric] <= cap[metric],
            asset.path + " fits current " + metric + " cap"
        );
}
assert.equal(unchangedNotificationAssets, 72);
assert.equal(
    unchangedNotificationAssets,
    notificationEvidence.compatibility.unchanged_other_assets
);
for (const [part, select] of [
    ["entry", (a) => a.kind === "entry"],
    ["appearance", (a) => a.path.endsWith("/subtitle-appearance.js")],
]) {
    const assets = notificationEvidence.assets.filter(select);
    assert.equal(assets.length, 3);
    for (const metric of ["bytes", "gzipBytes"])
        assert.equal(
            INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE[part][metric],
            Math.max(
                ...assets.map((a) => a.candidate[metric] - a.baseline[metric])
            ),
            part + " counts maximum observed delta, not overrun or target sum"
        );
}
assert.deepEqual(
    notificationEvidence.variants.map((v) => v.entry).sort(),
    [...ARTIFACTS].sort()
);
for (const variant of notificationEvidence.variants) {
    const assets = notificationEvidence.assets.filter(
        (a) => path.posix.dirname(a.path) === path.posix.dirname(variant.entry)
    );
    for (const [scope, name] of [
        ["legacyTotal", "LEGACY_TOTAL_BUDGET"],
        ["total", "TOTAL_BUDGET"],
    ]) {
        const included =
            scope === "legacyTotal"
                ? assets.filter((a) => a.kind !== "optional")
                : assets;
        for (const metric of ["bytes", "gzipBytes"]) {
            for (const side of ["baseline", "candidate"])
                assert.equal(
                    variant[side][scope][metric],
                    included.reduce((sum, a) => sum + a[side][metric], 0)
                );
            assert(
                variant.candidate[scope][metric] <= latestCaps[name][metric]
            );
            assert(
                latestCaps[name][metric] - variant.candidate[scope][metric] >=
                    preNotificationCaps[name][metric] -
                        variant.baseline[scope][metric],
                variant.entry + " retains previous measured headroom"
            );
        }
    }
}
for (const [name, before] of Object.entries(notificationEvidence.caps_before)) {
    const oldCap =
        name === "appearance"
            ? preNotificationCaps.OPTIONAL_BUDGETS["subtitle-appearance"]
            : preNotificationCaps[name];
    const newCap =
        name === "appearance"
            ? latestCaps.OPTIONAL_BUDGETS["subtitle-appearance"]
            : latestCaps[name];
    assert.deepEqual(oldCap, before);
    assert.deepEqual(newCap, notificationEvidence.caps_after[name]);
    for (const metric of ["bytes", "gzipBytes"]) {
        const allowance = INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE;
        const delta =
            name === "appearance"
                ? allowance.appearance[metric]
                : allowance.entry[metric] +
                  (["BASE_TOTAL_BUDGET", "TOTAL_BUDGET"].includes(name)
                      ? allowance.appearance[metric]
                      : 0);
        assert.equal(
            newCap[metric] - oldCap[metric],
            delta,
            name + " counts each component exactly once"
        );
    }
}
for (const name of ["PROVIDER_BUDGET", "OPTIONAL_BUDGET"])
    assert.deepEqual(
        require("../scripts/classic-size.cjs")[name],
        preNotificationCaps[name]
    );
assert.deepEqual(
    Object.keys(latestCaps.OPTIONAL_BUDGETS).sort(),
    Object.keys(preNotificationCaps.OPTIONAL_BUDGETS).sort()
);
for (const [name, cap] of Object.entries(latestCaps.OPTIONAL_BUDGETS))
    if (name !== "subtitle-appearance")
        assert.deepEqual(cap, preNotificationCaps.OPTIONAL_BUDGETS[name], name);
// Old receipts are immutable and predate this named feature. Keep their
// projections separate; the later live-inspector section restores latestCaps.

// The queue is a separately emitted optional chunk. Keep its measured increment
// out of older receipts and never treat the version-mismatched entry delta as cost.
const preQueueCaps = capsWithoutAllowances([
    "INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE",
    "DESKTOP_VIDEO_QUEUE_ALLOWANCE",
]);
const queueEvidence = require("../docs/evidence/desktop-video-queue-size-20261105.json");
assert.equal(queueEvidence.schema, 1);
assert.deepEqual(DESKTOP_VIDEO_QUEUE_ALLOWANCE, { bytes: 407, gzipBytes: 169 });
assert(Object.isFrozen(DESKTOP_VIDEO_QUEUE_ALLOWANCE));
assert.deepEqual(
    DESKTOP_VIDEO_QUEUE_ALLOWANCE,
    queueEvidence.measured_allowance
);
assert.deepEqual(queueEvidence.reference_cap, { bytes: 5400, gzipBytes: 2200 });
assert.deepEqual(queueEvidence.proposed_cap, { bytes: 5807, gzipBytes: 2369 });
assert.deepEqual(queueEvidence.headroom, { bytes: 44, gzipBytes: 96 });
assert.deepEqual(
    preQueueCaps.OPTIONAL_BUDGETS["local-drop"],
    queueEvidence.reference_cap
);
assert.deepEqual(
    preNotificationCaps.OPTIONAL_BUDGETS["local-drop"],
    queueEvidence.proposed_cap
);
for (const side of ["baseline", "candidate"]) {
    assert.match(queueEvidence[side].head, /^[0-9a-f]{40}$/);
    assert.match(queueEvidence[side].report_sha256, /^[0-9a-f]{64}$/);
}
assert.notEqual(queueEvidence.baseline.head, queueEvidence.candidate.head);
assert.notEqual(
    queueEvidence.baseline.version,
    queueEvidence.candidate.version
);
assert.equal(queueEvidence.compatibility.same_version_envelope, false);
assert.equal(queueEvidence.compatibility.optional_feature_cost_qualified, true);
assert.equal(
    queueEvidence.compatibility.entry_total_feature_cost_qualified,
    false
);
assert.equal(
    queueEvidence.compatibility.final_combined_head_gate_required,
    true
);
const queuePaths = new Map();
for (const entry of ARTIFACTS) {
    queuePaths.set(entry, "entry");
    const directory = path.posix.dirname(entry);
    for (const name of Object.keys(CLASSIC_PROVIDER_BUNDLES))
        queuePaths.set(directory + "/provider-" + name + ".js", "provider");
    for (const name of Object.keys(CLASSIC_OPTIONAL_BUNDLES))
        queuePaths.set(directory + "/" + name + ".js", "optional");
}
assert.equal(queueEvidence.assets.length, 78);
assert.deepEqual(
    queueEvidence.assets.map((asset) => asset.path).sort(),
    [...queuePaths.keys()].sort()
);
let unchangedQueueAssets = 0;
const queueChunks = [];
for (const asset of queueEvidence.assets) {
    assert.equal(asset.kind, queuePaths.get(asset.path));
    for (const side of ["baseline", "candidate"]) {
        assert.match(asset[side].sha256, /^[0-9a-f]{64}$/);
        for (const metric of ["bytes", "gzipBytes"])
            assert(
                Number.isSafeInteger(asset[side][metric]) &&
                    asset[side][metric] > 0
            );
    }
    if (asset.path.endsWith("/local-drop.js")) {
        queueChunks.push(asset);
        assert.notEqual(asset.baseline.sha256, asset.candidate.sha256);
        for (const metric of ["bytes", "gzipBytes"]) {
            assert.equal(
                asset.candidate[metric] - asset.baseline[metric],
                DESKTOP_VIDEO_QUEUE_ALLOWANCE[metric]
            );
            assert.equal(
                queueEvidence.reference_cap[metric] - asset.baseline[metric],
                queueEvidence.headroom[metric]
            );
            assert.equal(
                queueEvidence.proposed_cap[metric] - asset.candidate[metric],
                queueEvidence.headroom[metric]
            );
        }
    } else if (asset.kind === "entry") {
        // Record the changed entry envelope, without allocating its net delta.
        assert.notEqual(asset.baseline.sha256, asset.candidate.sha256);
    } else {
        assert.deepEqual(asset.baseline, asset.candidate, asset.path);
        unchangedQueueAssets++;
    }
}
assert.equal(queueChunks.length, 3);
for (const side of ["baseline", "candidate"])
    for (const asset of queueChunks)
        assert.deepEqual(
            asset[side],
            queueChunks[0][side],
            "identical optional bytes across all three targets"
        );
assert.equal(unchangedQueueAssets, 72);
assert.equal(
    queueEvidence.compatibility.unchanged_assets,
    unchangedQueueAssets
);
for (const metric of ["bytes", "gzipBytes"]) {
    assert.equal(
        preNotificationCaps.OPTIONAL_BUDGETS["local-drop"][metric] -
            preQueueCaps.OPTIONAL_BUDGETS["local-drop"][metric],
        DESKTOP_VIDEO_QUEUE_ALLOWANCE[metric]
    );
    for (const name of ["BASE_TOTAL_BUDGET", "TOTAL_BUDGET"])
        assert.equal(
            preNotificationCaps[name][metric] - preQueueCaps[name][metric],
            DESKTOP_VIDEO_QUEUE_ALLOWANCE[metric],
            name +
                " includes one optional increment, not three target copies or the entry delta"
        );
}
for (const name of [
    "BUDGET",
    "LEGACY_TOTAL_BUDGET",
    "PROVIDER_BUDGET",
    "OPTIONAL_BUDGET",
])
    assert.deepEqual(
        preNotificationCaps[name],
        preQueueCaps[name],
        name + " is unchanged by the optional queue allowance"
    );
assert.deepEqual(
    Object.keys(preNotificationCaps.OPTIONAL_BUDGETS).sort(),
    Object.keys(preQueueCaps.OPTIONAL_BUDGETS).sort()
);
for (const [name, cap] of Object.entries(preNotificationCaps.OPTIONAL_BUDGETS))
    if (name !== "local-drop")
        assert.deepEqual(cap, preQueueCaps.OPTIONAL_BUDGETS[name], name);

// The paired presentation/settings receipt includes all three platform
// inventories. Allocate the largest per-platform delta, never their sum.
const presentationEvidence = require("../docs/evidence/classic-presentation-settings-size-20261105.json");
const presentationBaseline = capsWithoutAllowances([
    "INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE",
    "DESKTOP_VIDEO_QUEUE_ALLOWANCE",
    "CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE",
]);
assert.deepEqual(
    CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE,
    presentationEvidence.measured_allowance
);
assert(Object.isFrozen(CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE));
for (const part of Object.values(CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE))
    assert(Object.isFrozen(part));
const presentationPaths = new Map();
for (const entry of ARTIFACTS) {
    presentationPaths.set(entry, "entry");
    const directory = path.posix.dirname(entry);
    for (const name of Object.keys(CLASSIC_PROVIDER_BUNDLES))
        presentationPaths.set(
            directory + "/provider-" + name + ".js",
            "provider"
        );
    for (const name of Object.keys(CLASSIC_OPTIONAL_BUNDLES))
        presentationPaths.set(directory + "/" + name + ".js", "optional");
}
const presentationAssets = presentationEvidence.assets;
assert.equal(presentationAssets.length, 78);
assert.deepEqual(
    presentationAssets.map((asset) => asset.path).sort(),
    [...presentationPaths.keys()].sort()
);
let unchangedPresentationAssets = 0;
for (const asset of presentationAssets) {
    assert.equal(asset.kind, presentationPaths.get(asset.path));
    for (const side of ["baseline", "candidate"]) {
        assert.match(asset[side].sha256, /^[0-9a-f]{64}$/);
        for (const metric of ["bytes", "gzipBytes"])
            assert(
                Number.isSafeInteger(asset[side][metric]) &&
                    asset[side][metric] > 0
            );
    }
    const changed =
        asset.kind === "entry" ||
        asset.path.endsWith("/subtitle-appearance.js");
    if (changed) assert.notEqual(asset.baseline.sha256, asset.candidate.sha256);
    else {
        assert.deepEqual(asset.baseline, asset.candidate, asset.path);
        unchangedPresentationAssets++;
    }
}
assert.equal(unchangedPresentationAssets, 72);
for (const [part, select] of [
    ["entry", (asset) => asset.kind === "entry"],
    ["appearance", (asset) => asset.path.endsWith("/subtitle-appearance.js")],
]) {
    const selected = presentationAssets.filter(select);
    assert.equal(selected.length, 3);
    for (const metric of ["bytes", "gzipBytes"])
        assert.equal(
            CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE[part][metric],
            Math.max(
                ...selected.map(
                    (asset) => asset.candidate[metric] - asset.baseline[metric]
                )
            ),
            part + " uses the measured maximum without extra reserve"
        );
}
assert.deepEqual(
    presentationEvidence.variants.map((variant) => variant.entry).sort(),
    [...ARTIFACTS].sort()
);
for (const variant of presentationEvidence.variants) {
    const assets = presentationAssets.filter(
        (asset) =>
            path.posix.dirname(asset.path) === path.posix.dirname(variant.entry)
    );
    for (const [scope, name] of [
        ["legacyTotal", "LEGACY_TOTAL_BUDGET"],
        ["total", "TOTAL_BUDGET"],
    ])
        for (const metric of ["bytes", "gzipBytes"]) {
            const included =
                scope === "legacyTotal"
                    ? assets.filter((asset) => asset.kind !== "optional")
                    : assets;
            for (const side of ["baseline", "candidate"])
                assert.equal(
                    variant[side][scope][metric],
                    included.reduce(
                        (sum, asset) => sum + asset[side][metric],
                        0
                    ),
                    variant.entry + " " + scope + " includes every asset once"
                );
            assert(
                preQueueCaps[name][metric] - variant.candidate[scope][metric] >=
                    presentationBaseline[name][metric] -
                        variant.baseline[scope][metric],
                variant.entry + " preserves measured headroom"
            );
        }
}
for (const [name, before] of Object.entries(presentationEvidence.caps_before)) {
    const oldCap =
        name === "appearance"
            ? presentationBaseline.OPTIONAL_BUDGETS["subtitle-appearance"]
            : presentationBaseline[name];
    const newCap =
        name === "appearance"
            ? preQueueCaps.OPTIONAL_BUDGETS["subtitle-appearance"]
            : preQueueCaps[name];
    assert.deepEqual(
        oldCap,
        before,
        name + " preserves the measured starting cap"
    );
    assert.deepEqual(newCap, presentationEvidence.caps_after[name]);
    for (const metric of ["bytes", "gzipBytes"]) {
        const allowance = CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE;
        const expected =
            name === "appearance"
                ? allowance.appearance[metric]
                : allowance.entry[metric] +
                  (["BASE_TOTAL_BUDGET", "TOTAL_BUDGET"].includes(name)
                      ? allowance.appearance[metric]
                      : 0);
        assert.equal(
            newCap[metric] - oldCap[metric],
            expected,
            name + " counts each allowance exactly once"
        );
    }
}
for (const name of ["PROVIDER_BUDGET", "OPTIONAL_BUDGET"])
    assert.deepEqual(preNotificationCaps[name], presentationBaseline[name]);
for (const [name, cap] of Object.entries(preQueueCaps.OPTIONAL_BUDGETS))
    if (name !== "subtitle-appearance")
        assert.deepEqual(
            cap,
            presentationBaseline.OPTIONAL_BUDGETS[name],
            name
        );

// Qualify desktop startup and its new optional asset independently. Earlier
// receipts predate both; remove them only from the historical cap projections.
const desktopBaseline = capsWithoutAllowances([
    "INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE",
    "DESKTOP_VIDEO_QUEUE_ALLOWANCE",
    "CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE",
    "DESKTOP_DROP_ALLOWANCE",
]);
const desktopEvidence = require("../docs/evidence/desktop-video-drop-size.json");
assert.deepEqual(DESKTOP_DROP_ALLOWANCE, desktopEvidence.allowance);
assert(Object.isFrozen(DESKTOP_DROP_ALLOWANCE));
for (const value of Object.values(DESKTOP_DROP_ALLOWANCE))
    assert(Object.isFrozen(value));
assert.deepEqual(
    presentationBaseline.OPTIONAL_BUDGETS["local-drop"],
    DESKTOP_DROP_ALLOWANCE.optional
);
assert.deepEqual(latestOptionalBundles["local-drop"], [
    "build/offline/dropped-video.js",
    "build/plugins/local-drop.js",
]);
for (const metric of ["bytes", "gzipBytes"]) {
    const measured =
        desktopEvidence.entry.after[metric] -
        desktopEvidence.entry.before[metric];
    assert.equal(measured, desktopEvidence.entry.delta[metric]);
    assert(measured > 0 && measured <= DESKTOP_DROP_ALLOWANCE.entry[metric]);
    const optionalMeasured =
        desktopEvidence.optional[
            metric === "bytes" ? "optimizedBytes" : "gzipBytes"
        ];
    assert(
        optionalMeasured > 0 &&
            optionalMeasured <= DESKTOP_DROP_ALLOWANCE.optional[metric]
    );
    for (const name of [
        "BUDGET",
        "LEGACY_TOTAL_BUDGET",
        "BASE_TOTAL_BUDGET",
        "TOTAL_BUDGET",
    ])
        assert.equal(
            presentationBaseline[name][metric] - desktopBaseline[name][metric],
            DESKTOP_DROP_ALLOWANCE.entry[metric] +
                (["BASE_TOTAL_BUDGET", "TOTAL_BUDGET"].includes(name)
                    ? DESKTOP_DROP_ALLOWANCE.optional[metric]
                    : 0),
            name + " counts each desktop allowance once"
        );
}
for (const name of ["PROVIDER_BUDGET", "OPTIONAL_BUDGET"])
    assert.deepEqual(preNotificationCaps[name], desktopBaseline[name]);
assert.deepEqual(
    Object.fromEntries(
        Object.entries(presentationBaseline.OPTIONAL_BUDGETS).filter(
            ([name]) => name !== "local-drop"
        )
    ),
    desktopBaseline.OPTIONAL_BUDGETS
);
CLASSIC_OPTIONAL_BUNDLES = Object.fromEntries(
    Object.entries(latestOptionalBundles).filter(
        ([name]) => name !== "local-drop"
    )
);
// The Auto and earlier receipts also predate the presentation/settings delta.
// Remove only those named features from historical projections. Live checks
// below retain the complete merged caps and restore the full asset inventory.
const preRecoveryCaps = capsWithoutAllowances([
    "INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE",
    "DESKTOP_VIDEO_QUEUE_ALLOWANCE",
    "CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE",
    "DESKTOP_DROP_ALLOWANCE",
    "AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE",
]);
const withoutAutoRecovery = capsWithoutAllowances([
    "INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE",
    "AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE",
]);
function historicalCapsWithoutAllowances(names) {
    return capsWithoutAllowances([
        "INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE",
        "DESKTOP_VIDEO_QUEUE_ALLOWANCE",
        "CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE",
        "DESKTOP_DROP_ALLOWANCE",
        "AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE",
        ...names,
    ]);
}
const autoRecoveryEvidence = require("../docs/evidence/auto-relay-stall-recovery-size-20261105.json");
assert(Object.isFrozen(AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE));
assert.deepEqual(
    AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE,
    autoRecoveryEvidence.measured_allowance
);
assert.equal(AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE.bytes, 0);
assert.deepEqual(
    autoRecoveryEvidence.entries.map((row) => row.path).sort(),
    [...ARTIFACTS].sort()
);
assert.deepEqual(
    autoRecoveryEvidence.payloads.map((row) => row.entry).sort(),
    [...ARTIFACTS].sort()
);
assert.equal(
    AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE.gzipBytes,
    Math.max(
        0,
        ...autoRecoveryEvidence.entries.map(
            (row) => row.candidate.gzipBytes - row.base.gzipBytes
        )
    ),
    "allocate the maximum positive entry cost, not three copies or the overrun"
);
for (const [scope, name] of Object.entries({
    baseTotal: "BASE_TOTAL_BUDGET",
    completeTotal: "TOTAL_BUDGET",
    entry: "BUDGET",
    legacyTotal: "LEGACY_TOTAL_BUDGET",
})) {
    assert.deepEqual(
        preRecoveryCaps[name],
        autoRecoveryEvidence.budget_before[scope]
    );
    assert.deepEqual(
        desktopBaseline[name],
        autoRecoveryEvidence.budget_after[scope]
    );
    for (const metric of ["bytes", "gzipBytes"])
        assert.equal(
            desktopBaseline[name][metric] - preRecoveryCaps[name][metric],
            AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE[metric],
            name + " counts the Auto recovery entry cost exactly once"
        );
}
for (const [name, recorded] of Object.entries({
    OPTIONAL_BUDGET: autoRecoveryEvidence.optionalBudget,
    OPTIONAL_BUDGETS: autoRecoveryEvidence.optionalBudgets,
    PROVIDER_BUDGET: autoRecoveryEvidence.providerBudget,
})) {
    const actual = desktopBaseline[name];
    assert.deepEqual(actual, preRecoveryCaps[name]);
    assert.deepEqual(actual, recorded);
}
// The paired record lists every unchanged provider/optional asset. Rebuild
// both payload totals from those measurements, so entry-only growth cannot
// hide an omitted asset or an independently increased provider/optional cost.
const recoveryAssetPaths = new Map();
for (const entry of ARTIFACTS) {
    const directory = path.posix.dirname(entry);
    for (const name of Object.keys(CLASSIC_PROVIDER_BUNDLES))
        recoveryAssetPaths.set(
            directory + "/provider-" + name + ".js",
            "providers"
        );
    for (const name of Object.keys(CLASSIC_OPTIONAL_BUNDLES))
        recoveryAssetPaths.set(
            directory + "/" + name + ".js",
            "optionalAssets"
        );
}
assert.equal(recoveryAssetPaths.size, 72);
assert.equal(autoRecoveryEvidence.unchangedAssets.length, 72);
assert.deepEqual(autoRecoveryEvidence.assetDifferences, []);
const recoveryAssets = new Map();
for (const asset of autoRecoveryEvidence.unchangedAssets) {
    assert.equal(recoveryAssetPaths.get(asset.path), asset.group, asset.path);
    assert(!recoveryAssets.has(asset.path), "duplicate asset: " + asset.path);
    assert.match(asset.sha256, /^[0-9a-f]{64}$/);
    const cap =
        asset.group === "providers"
            ? PROVIDER_BUDGET
            : OPTIONAL_BUDGETS[path.posix.basename(asset.path, ".js")];
    for (const metric of ["bytes", "gzipBytes"]) {
        assert(Number.isSafeInteger(asset[metric]) && asset[metric] > 0);
        assert(
            asset[metric] <= cap[metric],
            asset.path + " retains its existing cap"
        );
    }
    recoveryAssets.set(asset.path, asset);
}
assert.deepEqual(
    [...recoveryAssets.keys()].sort(),
    [...recoveryAssetPaths.keys()].sort()
);
for (const entry of autoRecoveryEvidence.entries) {
    const payload = autoRecoveryEvidence.payloads.find(
        (row) => row.entry === entry.path
    );
    const assets = [...recoveryAssets.values()].filter(
        (row) => path.posix.dirname(row.path) === path.posix.dirname(entry.path)
    );
    for (const metric of ["bytes", "gzipBytes"]) {
        const delta = entry.candidate[metric] - entry.base[metric];
        assert.equal(entry.delta[metric], delta);
        assert(entry.candidate[metric] <= desktopBaseline.BUDGET[metric]);
        for (const [scope, name] of Object.entries({
            legacyTotal: "LEGACY_TOTAL_BUDGET",
            total: "TOTAL_BUDGET",
        })) {
            const included =
                scope === "legacyTotal"
                    ? assets.filter((row) => row.group === "providers")
                    : assets;
            const unchanged = included.reduce(
                (sum, row) => sum + row[metric],
                0
            );
            for (const stage of ["base", "candidate"])
                assert.equal(
                    payload[scope][stage][metric],
                    entry[stage][metric] + unchanged,
                    entry.path +
                        " " +
                        scope +
                        " preserves every unchanged asset"
                );
            assert.equal(payload[scope].delta[metric], delta);
            assert.equal(
                payload[scope].candidate[metric] - payload[scope].base[metric],
                delta,
                "each payload grows by one entry, never by all three variants"
            );
            assert(
                payload[scope].candidate[metric] <=
                    desktopBaseline[name][metric]
            );
        }
    }
}
for (const arm of ["A", "B"]) {
    assert.equal(autoRecoveryEvidence.validation[arm].inputValid, true);
    assert.deepEqual(
        autoRecoveryEvidence.identities[arm].map((row) => row.path).sort(),
        [...ARTIFACTS].sort()
    );
    for (const identity of autoRecoveryEvidence.identities[arm])
        assert.deepEqual(
            identity.sourceRevisions,
            [""],
            "same dirty identity mode in both arms"
        );
}

// Also qualify Auto recovery in the merged caps, with desktop still present.
for (const name of [
    "BUDGET",
    "LEGACY_TOTAL_BUDGET",
    "BASE_TOTAL_BUDGET",
    "TOTAL_BUDGET",
])
    for (const metric of ["bytes", "gzipBytes"])
        assert.equal(
            preNotificationCaps[name][metric] -
                withoutAutoRecovery[name][metric],
            AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE[metric],
            name + " counts Auto recovery once alongside desktop drop"
        );
for (const name of ["PROVIDER_BUDGET", "OPTIONAL_BUDGET", "OPTIONAL_BUDGETS"])
    assert.deepEqual(
        preNotificationCaps[name],
        withoutAutoRecovery[name],
        name + " is unchanged by Auto recovery"
    );

// Qualify the new EPG layer against exact paired output, keeping old receipts immutable.
const epgBaseline = historicalCapsWithoutAllowances([
    "EPG_PRESENTATION_ENTRY_ALLOWANCE",
]);
const epgEvidence = require("../docs/evidence/epg-presentation-size.json");
assert(Object.isFrozen(EPG_PRESENTATION_ENTRY_ALLOWANCE));
assert.deepEqual(EPG_PRESENTATION_ENTRY_ALLOWANCE, epgEvidence.allowance);
for (const metric of ["bytes", "gzipBytes"]) {
    const delta = epgEvidence.candidate[metric] - epgEvidence.baseline[metric];
    assert.equal(delta, EPG_PRESENTATION_ENTRY_ALLOWANCE[metric]);
    assert.equal(
        epgBaseline.BUDGET[metric],
        epgEvidence.previousEntryCap[metric]
    );
    assert.equal(
        preRecoveryCaps.BUDGET[metric] - epgEvidence.candidate[metric],
        epgBaseline.BUDGET[metric] - epgEvidence.baseline[metric]
    );
    for (const name of [
        "BUDGET",
        "LEGACY_TOTAL_BUDGET",
        "BASE_TOTAL_BUDGET",
        "TOTAL_BUDGET",
    ])
        assert.equal(
            preRecoveryCaps[name][metric] - epgBaseline[name][metric],
            delta
        );
}
for (const name of ["PROVIDER_BUDGET", "OPTIONAL_BUDGET", "OPTIONAL_BUDGETS"])
    assert.deepEqual(preRecoveryCaps[name], epgBaseline[name]);
// This feature changes only the shared entry. Retain historical receipts and
// verify the exact increment once in each affected aggregate.
const visibilityBaseline = historicalCapsWithoutAllowances([
    "CATEGORY_VISIBILITY_ENTRY_ALLOWANCE",
    "EPG_PRESENTATION_ENTRY_ALLOWANCE",
]);
const visibilityEvidence = require("../docs/evidence/category-visibility-size.json");
assert(Object.isFrozen(CATEGORY_VISIBILITY_ENTRY_ALLOWANCE));
assert.deepEqual(
    CATEGORY_VISIBILITY_ENTRY_ALLOWANCE,
    visibilityEvidence.allowance
);
for (const metric of ["bytes", "gzipBytes"]) {
    const delta =
        visibilityEvidence.candidate[metric] -
        visibilityEvidence.baseline[metric];
    assert.equal(delta, CATEGORY_VISIBILITY_ENTRY_ALLOWANCE[metric]);
    assert.equal(
        visibilityBaseline.BUDGET[metric],
        visibilityEvidence.previousEntryCap[metric]
    );
    assert.equal(
        epgBaseline.BUDGET[metric] - visibilityEvidence.candidate[metric],
        visibilityBaseline.BUDGET[metric] - visibilityEvidence.baseline[metric]
    );
    for (const name of [
        "BUDGET",
        "LEGACY_TOTAL_BUDGET",
        "BASE_TOTAL_BUDGET",
        "TOTAL_BUDGET",
    ])
        assert.equal(
            epgBaseline[name][metric] - visibilityBaseline[name][metric],
            delta
        );
}
for (const name of ["PROVIDER_BUDGET", "OPTIONAL_BUDGET", "OPTIONAL_BUDGETS"])
    assert.deepEqual(preRecoveryCaps[name], visibilityBaseline[name]);
const favoritesCategoryPersistenceBaseline = historicalCapsWithoutAllowances([
    "FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE",
]);
const localFavoritesPathCaps = preRecoveryCaps;
const localFavoritesPathBaseline = historicalCapsWithoutAllowances([
    "LOCAL_FAVORITES_PATH_ALLOWANCE",
]);
const localFavoriteWriteRecoveryBaseline = historicalCapsWithoutAllowances([
    "LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE",
]);
const historicalIncomingCaps = historicalCapsWithoutAllowances([
    "EPG_PRESENTATION_ENTRY_ALLOWANCE",
    "CATEGORY_VISIBILITY_ENTRY_ALLOWANCE",
    "NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE",
    "LOCAL_SOURCE_DIAGNOSTICS_ALLOWANCE",
    "LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE",
    "LOCAL_FAVORITES_PATH_ALLOWANCE",
    "FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE",
    "MODERN_REPAINT_OPTIONAL_ALLOWANCE",
]);
({
    BASE_TOTAL_BUDGET,
    BUDGET,
    LEGACY_TOTAL_BUDGET,
    OPTIONAL_BUDGETS,
    TOTAL_BUDGET,
} = historicalIncomingCaps);
const plexArtworkCaps = {
    BASE_TOTAL_BUDGET,
    BUDGET,
    LEGACY_TOTAL_BUDGET,
    OPTIONAL_BUDGETS,
    TOTAL_BUDGET,
};
const torrentDelta = (name, allowance = TORRENT_PROVIDER_ALLOWANCE) => {
    const kinds =
        name === "BUDGET"
            ? ["entry"]
            : name === "LEGACY_TOTAL_BUDGET"
              ? ["entry", "catalog"]
              : ["entry", "catalog", "favorites", "settings", "companion"];
    return Object.fromEntries(
        ["bytes", "gzipBytes"].map((metric) => [
            metric,
            kinds.reduce((sum, kind) => sum + allowance[kind][metric], 0),
        ])
    );
};
const subtract = (budget, delta) =>
    Object.freeze(
        Object.fromEntries(
            ["bytes", "gzipBytes"].map((metric) => [
                metric,
                budget[metric] - delta[metric],
            ])
        )
    );
const modernNativeShellCaps = Object.fromEntries(
    Object.entries(plexArtworkCaps).map(([name, budget]) => [
        name,
        ["LEGACY_TOTAL_BUDGET", "BASE_TOTAL_BUDGET", "TOTAL_BUDGET"].includes(
            name
        )
            ? subtract(budget, PLEX_ARTWORK_ALLOWANCE)
            : budget,
    ])
);
// The newer optional shell changes only its asset and the complete payload.
// Remove that measured increment before replaying immutable older receipts.
const archiveRelativeSeekCaps = Object.fromEntries(
    Object.entries(modernNativeShellCaps).map(([name, budget]) => [
        name,
        name === "OPTIONAL_BUDGETS"
            ? Object.freeze({
                  ...budget,
                  "modern-interface": subtract(
                      budget["modern-interface"],
                      MODERN_NATIVE_SHELL_OPTIONAL_ALLOWANCE
                  ),
              })
            : name === "BASE_TOTAL_BUDGET" || name === "TOTAL_BUDGET"
              ? subtract(budget, MODERN_NATIVE_SHELL_OPTIONAL_ALLOWANCE)
              : budget,
    ])
);
// Replay historical receipts without charging this newer archive feature twice.
const modernInfoInteractionCaps = Object.fromEntries(
    Object.entries(archiveRelativeSeekCaps).map(([name, budget]) => [
        name,
        name === "OPTIONAL_BUDGETS"
            ? budget
            : subtract(budget, ARCHIVE_RELATIVE_SEEK_ALLOWANCE),
    ])
);
const modernInfoOptionalKinds = {
    "favorites-transfer": "favorites",
    "modern-interface": "renderer",
};
const modernInfoDelta = (name) => {
    const kinds =
        name === "BUDGET"
            ? ["entry"]
            : name === "LEGACY_TOTAL_BUDGET"
              ? ["entry", "edem", "plex"]
              : Object.keys(MODERN_INFO_INTERACTION_ALLOWANCE);
    return Object.fromEntries(
        ["bytes", "gzipBytes"].map((metric) => [
            metric,
            kinds.reduce(
                (sum, kind) =>
                    sum + MODERN_INFO_INTERACTION_ALLOWANCE[kind][metric],
                0
            ),
        ])
    );
};
// Keep earlier receipts immutable: remove only this newest measured feature
// before replaying their original entry, provider and optional accounting.
const companionDiagnosticsCaps = Object.fromEntries(
    Object.entries(modernInfoInteractionCaps).map(([name, budget]) => [
        name,
        name === "OPTIONAL_BUDGETS"
            ? Object.freeze(
                  Object.fromEntries(
                      Object.entries(budget).map(([key, value]) => [
                          key,
                          modernInfoOptionalKinds[key]
                              ? subtract(
                                    value,
                                    MODERN_INFO_INTERACTION_ALLOWANCE[
                                        modernInfoOptionalKinds[key]
                                    ]
                                )
                              : value,
                      ])
                  )
              )
            : subtract(budget, modernInfoDelta(name)),
    ])
);
// The playback overlay arrived after the companion evidence was frozen. Project
// its optional allowance out before replaying the earlier cap snapshots.
const modernPlayerCaps = Object.fromEntries(
    Object.entries(companionDiagnosticsCaps).map(([name, budget]) => [
        name,
        name === "OPTIONAL_BUDGETS"
            ? Object.freeze(
                  Object.fromEntries(
                      Object.entries(budget).map(([key, value]) => [
                          key,
                          key === "modern-interface"
                              ? subtract(
                                    value,
                                    MODERN_PLAYER_OPTIONAL_ALLOWANCE
                                )
                              : value,
                      ])
                  )
              )
            : name === "BASE_TOTAL_BUDGET" || name === "TOTAL_BUDGET"
              ? subtract(budget, MODERN_PLAYER_OPTIONAL_ALLOWANCE)
              : budget,
    ])
);
const companionDiagnosticsDelta = (name) => {
    const kinds =
        name === "BUDGET"
            ? ["entry"]
            : name === "LEGACY_TOTAL_BUDGET"
              ? ["entry", "catalog"]
              : Object.keys(COMPANION_DIAGNOSTICS_ALLOWANCE);
    return Object.fromEntries(
        ["bytes", "gzipBytes"].map((metric) => [
            metric,
            kinds.reduce(
                (sum, kind) =>
                    sum + COMPANION_DIAGNOSTICS_ALLOWANCE[kind][metric],
                0
            ),
        ])
    );
};
const modernExperienceCaps = Object.fromEntries(
    Object.entries(modernPlayerCaps).map(([name, budget]) => [
        name,
        name === "OPTIONAL_BUDGETS"
            ? Object.fromEntries(
                  Object.entries(budget).map(([key, value]) => [
                      key,
                      key === "media-companion"
                          ? subtract(
                                value,
                                COMPANION_DIAGNOSTICS_ALLOWANCE.companion
                            )
                          : value,
                  ])
              )
            : subtract(budget, companionDiagnosticsDelta(name)),
    ])
);
const modernExperienceDelta = (name) => {
    const kinds =
        name === "BUDGET"
            ? ["entry"]
            : name === "LEGACY_TOTAL_BUDGET"
              ? ["entry", "catalog"]
              : Object.keys(MODERN_EXPERIENCE_ALLOWANCE);
    return Object.fromEntries(
        ["bytes", "gzipBytes"].map((metric) => [
            metric,
            kinds.reduce(
                (sum, kind) => sum + MODERN_EXPERIENCE_ALLOWANCE[kind][metric],
                0
            ),
        ])
    );
};
const torznabCaps = Object.fromEntries(
    Object.entries(modernExperienceCaps).map(([name, budget]) => [
        name,
        name === "OPTIONAL_BUDGETS"
            ? Object.fromEntries(
                  Object.entries(budget).map(([key, value]) => [
                      key,
                      key === "modern-interface"
                          ? subtract(
                                value,
                                MODERN_EXPERIENCE_ALLOWANCE.renderer
                            )
                          : value,
                  ])
              )
            : subtract(budget, modernExperienceDelta(name)),
    ])
);
const torznabDelta = (name) => {
    const kinds =
        name === "BUDGET"
            ? ["entry"]
            : name === "LEGACY_TOTAL_BUDGET"
              ? ["entry", "catalog"]
              : Object.keys(TORZNAB_DISCOVERY_ALLOWANCE);
    return Object.fromEntries(
        ["bytes", "gzipBytes"].map((metric) => [
            metric,
            kinds.reduce(
                (sum, kind) => sum + TORZNAB_DISCOVERY_ALLOWANCE[kind][metric],
                0
            ),
        ])
    );
};
const torznabOptionalKinds = {
    "favorites-transfer": "favorites",
    "media-companion": "companion",
    "remote-settings-lifecycle": "settings",
};
const streamsCaps = Object.fromEntries(
    Object.entries(torznabCaps).map(([name, budget]) => [
        name,
        name === "OPTIONAL_BUDGETS"
            ? Object.fromEntries(
                  Object.entries(budget).map(([key, value]) => [
                      key,
                      torznabOptionalKinds[key]
                          ? subtract(
                                value,
                                TORZNAB_DISCOVERY_ALLOWANCE[
                                    torznabOptionalKinds[key]
                                ]
                            )
                          : value,
                  ])
              )
            : subtract(budget, torznabDelta(name)),
    ])
);
const streamsDelta = (name) => {
    const kinds =
        name === "BUDGET"
            ? ["entry"]
            : name === "LEGACY_TOTAL_BUDGET"
              ? ["entry", "catalog"]
              : ["entry", "catalog", "companion", "settings"];
    return Object.fromEntries(
        ["bytes", "gzipBytes"].map((metric) => [
            metric,
            kinds.reduce(
                (sum, kind) => sum + TORRENT_STREAMS_ALLOWANCE[kind][metric],
                0
            ),
        ])
    );
};
const discoveryCaps = Object.fromEntries(
    Object.entries(streamsCaps).map(([name, budget]) => [
        name,
        name === "OPTIONAL_BUDGETS"
            ? Object.fromEntries(
                  Object.entries(budget).map(([key, value]) => [
                      key,
                      key === "media-companion"
                          ? subtract(value, TORRENT_STREAMS_ALLOWANCE.companion)
                          : key === "remote-settings-lifecycle"
                            ? subtract(
                                  value,
                                  TORRENT_STREAMS_ALLOWANCE.settings
                              )
                            : value,
                  ])
              )
            : subtract(budget, streamsDelta(name)),
    ])
);
const discoveryDelta = (name) => {
    const kinds =
        name === "BUDGET"
            ? ["entry"]
            : name === "LEGACY_TOTAL_BUDGET"
              ? ["entry", "catalog"]
              : ["entry", "catalog", "settings"];
    return Object.fromEntries(
        ["bytes", "gzipBytes"].map((metric) => [
            metric,
            kinds.reduce(
                (sum, kind) => sum + TORRENT_DISCOVERY_ALLOWANCE[kind][metric],
                0
            ),
        ])
    );
};
const currentCaps = Object.fromEntries(
    Object.entries(discoveryCaps).map(([name, budget]) => [
        name,
        name === "OPTIONAL_BUDGETS"
            ? Object.fromEntries(
                  Object.entries(budget).map(([key, value]) => [
                      key,
                      key === "remote-settings-lifecycle"
                          ? subtract(
                                value,
                                TORRENT_DISCOVERY_ALLOWANCE.settings
                            )
                          : value,
                  ])
              )
            : subtract(budget, discoveryDelta(name)),
    ])
);
const historicalCaps = Object.fromEntries(
    Object.entries(currentCaps).map(([name, budget]) => [
        name,
        name === "OPTIONAL_BUDGETS"
            ? Object.freeze(
                  Object.fromEntries(
                      Object.entries(budget).map(([key, value]) => [
                          key,
                          key === "favorites-transfer"
                              ? subtract(
                                    value,
                                    TORRENT_PROVIDER_ALLOWANCE.favorites
                                )
                              : key === "media-companion"
                                ? subtract(
                                      value,
                                      TORRENT_PROVIDER_ALLOWANCE.companion
                                  )
                                : value,
                      ])
                  )
              )
            : subtract(budget, torrentDelta(name)),
    ])
);
try {
    const windowEvidence = require("../docs/evidence/native-window-controls-size-20261103.json");
    const withoutWindowControls = historicalCapsWithoutAllowances([
        "NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE",
    ]);
    assert.deepEqual(
        NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE,
        windowEvidence.measured_allowance
    );
    assert(Object.isFrozen(NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE));
    for (const metric of ["bytes", "gzipBytes"])
        for (const name of [
            "BUDGET",
            "LEGACY_TOTAL_BUDGET",
            "BASE_TOTAL_BUDGET",
            "TOTAL_BUDGET",
        ])
            assert.equal(
                preRecoveryCaps[name][metric] -
                    withoutWindowControls[name][metric],
                NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE[metric],
                name + " counts the window-controls entry cost once"
            );
    for (const name of [
        "PROVIDER_BUDGET",
        "OPTIONAL_BUDGET",
        "OPTIONAL_BUDGETS",
    ])
        assert.deepEqual(
            preRecoveryCaps[name],
            withoutWindowControls[name],
            name + " is unchanged by window controls"
        );
    for (const [evidenceName, budgetName] of Object.entries({
        completeTotal: "TOTAL_BUDGET",
        entry: "BUDGET",
        legacyTotal: "LEGACY_TOTAL_BUDGET",
    })) {
        assert.deepEqual(
            windowEvidence.budget_before[evidenceName],
            subtract(withoutWindowControls[budgetName], {
                bytes:
                    CATEGORY_VISIBILITY_ENTRY_ALLOWANCE.bytes +
                    EPG_PRESENTATION_ENTRY_ALLOWANCE.bytes,
                gzipBytes:
                    CATEGORY_VISIBILITY_ENTRY_ALLOWANCE.gzipBytes +
                    EPG_PRESENTATION_ENTRY_ALLOWANCE.gzipBytes,
            })
        );
        assert.deepEqual(
            windowEvidence.budget_after[evidenceName],
            visibilityBaseline[budgetName]
        );
    }
    for (const metric of ["bytes", "gzipBytes"])
        assert.equal(
            Math.max(
                ...windowEvidence.entries.map((row) => {
                    const delta = row.candidate[metric] - row.base[metric];
                    assert.equal(delta, row.delta[metric]);
                    return delta;
                })
            ),
            NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE[metric]
        );
    const repaint = require("../docs/evidence/modern-repaint-size-20261103.json");
    assert.deepEqual(MODERN_REPAINT_OPTIONAL_ALLOWANCE, repaint.allowance);
    assert(Object.isFrozen(MODERN_REPAINT_OPTIONAL_ALLOWANCE));
    assert.equal(repaint.delta.bytes, -83);
    assert.equal(repaint.delta.gzipBytes, 196);
    const actualCaps = preRecoveryCaps;
    for (const [name, before] of Object.entries(repaint.budgets.before)) {
        const after = structuredClone(before);
        if (name === "OPTIONAL_BUDGETS")
            after["modern-interface"].gzipBytes += 193;
        assert.deepEqual(repaint.budgets.after[name], after);
    }
    for (const [stage, measured] of [
        ["before", repaint.baseline],
        ["after", repaint.candidate],
    ])
        assert.equal(
            repaint.budgets[stage].OPTIONAL_BUDGETS["modern-interface"]
                .gzipBytes - measured.output.gzipBytes,
            repaint.gzipHeadroom[stage]
        );
    assert.deepEqual(repaint.gzipHeadroom, { after: 118, before: 121 });
    assert.equal(
        repaint.candidate.output.gzipBytes - repaint.baseline.output.gzipBytes,
        repaint.delta.gzipBytes
    );
    const withoutRepaint = historicalCapsWithoutAllowances([
        "MODERN_REPAINT_OPTIONAL_ALLOWANCE",
    ]);
    for (const name of Object.keys(repaint.budgets.before)) {
        const expected = structuredClone(withoutRepaint[name]);
        if (name === "OPTIONAL_BUDGETS")
            expected["modern-interface"].gzipBytes += 193;
        assert.deepEqual(actualCaps[name], expected);
    }
    for (const variant of repaint.historicalOptimizerComparison.variants) {
        assert.equal(
            variant.sha256,
            repaint.historicalOptimizerComparison.output.sha256
        );
        assert.equal(
            variant.gzipBytes,
            repaint.historicalOptimizerComparison.output.gzipBytes
        );
    }
    const writeRecoveryEvidence = require("../docs/evidence/local-favorite-write-recovery-size-20261102.json");
    assert.deepEqual(
        LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE,
        writeRecoveryEvidence.allowance
    );
    assert(Object.isFrozen(LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE));
    for (const cap of Object.values(LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE))
        assert(Object.isFrozen(cap));
    assert.equal(writeRecoveryEvidence.measurements.length, 3);
    assert.equal(
        new Set(writeRecoveryEvidence.measurements.map((row) => row.variant))
            .size,
        3
    );
    const recoveryCapNames = {
        entry: "BUDGET",
        favorites: "favorites-transfer",
        legacy: "LEGACY_TOTAL_BUDGET",
        total: "TOTAL_BUDGET",
    };
    for (const metric of ["bytes", "gzipBytes"]) {
        const entry = LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE.entry[metric],
            favorites =
                LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE.favorites[metric];
        assert(Number.isInteger(entry) && entry >= 0);
        assert(Number.isInteger(favorites) && favorites >= 0);
        for (const name of [
            "BUDGET",
            "LEGACY_TOTAL_BUDGET",
            "BASE_TOTAL_BUDGET",
            "TOTAL_BUDGET",
        ])
            assert.equal(
                preRecoveryCaps[name][metric] -
                    localFavoriteWriteRecoveryBaseline[name][metric],
                entry +
                    (["BASE_TOTAL_BUDGET", "TOTAL_BUDGET"].includes(name)
                        ? favorites
                        : 0),
                name + " counts each write-recovery component once"
            );
        for (const name of Object.keys(preRecoveryCaps.OPTIONAL_BUDGETS))
            assert.equal(
                preRecoveryCaps.OPTIONAL_BUDGETS[name][metric] -
                    localFavoriteWriteRecoveryBaseline.OPTIONAL_BUDGETS[name][
                        metric
                    ],
                name === "favorites-transfer" ? favorites : 0,
                name + " retains unrelated optional caps"
            );
        for (const name of ["PROVIDER_BUDGET", "OPTIONAL_BUDGET"])
            assert.equal(
                preRecoveryCaps[name][metric],
                localFavoriteWriteRecoveryBaseline[name][metric]
            );
        for (const row of writeRecoveryEvidence.measurements) {
            const delta = {};
            for (const name of Object.keys(recoveryCapNames)) {
                const before = row.baseline[name][metric],
                    after = row.candidate[name][metric],
                    allocated =
                        name === "favorites"
                            ? favorites
                            : entry + (name === "total" ? favorites : 0),
                    previousHeadroom =
                        writeRecoveryEvidence.previousCaps[name][metric] -
                        before;
                assert(Number.isInteger(before) && before >= 0);
                assert(Number.isInteger(after) && after >= 0);
                assert(
                    Number.isInteger(
                        writeRecoveryEvidence.previousCaps[name][metric]
                    )
                );
                delta[name] = after - before;
                assert.equal(row.delta[name][metric], delta[name]);
                assert(
                    delta[name] <= allocated,
                    row.variant + " " + name + " measured recovery growth fits"
                );
                assert(
                    previousHeadroom >= 0,
                    row.variant + " " + name + " baseline fits"
                );
                assert(
                    writeRecoveryEvidence.previousCaps[name][metric] +
                        allocated -
                        after >=
                        previousHeadroom,
                    row.variant + " " + name + " retains previous headroom"
                );
            }
            assert.equal(delta.legacy, delta.entry);
            assert.equal(delta.total, delta.entry + delta.favorites);
        }
    }
    const categoryPersistenceEvidence = require("../docs/evidence/favorites-category-persistence-size-20261102.json");
    assert.deepEqual(
        FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE,
        categoryPersistenceEvidence.allowance
    );
    assert(Object.isFrozen(FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE));
    for (const cap of Object.values(FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE))
        assert(Object.isFrozen(cap));
    assert.equal(categoryPersistenceEvidence.measurements.length, 3);
    assert.equal(
        new Set(
            categoryPersistenceEvidence.measurements.map((row) => row.variant)
        ).size,
        3
    );
    for (const metric of ["bytes", "gzipBytes"]) {
        const entry = FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE.entry[metric];
        const favorites =
            FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE.favorites[metric];
        assert(Number.isInteger(entry) && entry >= 0);
        assert(Number.isInteger(favorites) && favorites >= 0);
        for (const name of [
            "BUDGET",
            "LEGACY_TOTAL_BUDGET",
            "BASE_TOTAL_BUDGET",
            "TOTAL_BUDGET",
        ])
            assert.equal(
                preRecoveryCaps[name][metric] -
                    favoritesCategoryPersistenceBaseline[name][metric],
                entry +
                    (["BASE_TOTAL_BUDGET", "TOTAL_BUDGET"].includes(name)
                        ? favorites
                        : 0),
                name + " counts each category persistence component once"
            );
        assert.equal(
            preRecoveryCaps.OPTIONAL_BUDGETS["favorites-transfer"][metric] -
                favoritesCategoryPersistenceBaseline.OPTIONAL_BUDGETS[
                    "favorites-transfer"
                ][metric],
            favorites
        );
        for (const name of Object.keys(preRecoveryCaps.OPTIONAL_BUDGETS))
            if (name !== "favorites-transfer")
                assert.equal(
                    preRecoveryCaps.OPTIONAL_BUDGETS[name][metric],
                    favoritesCategoryPersistenceBaseline.OPTIONAL_BUDGETS[name][
                        metric
                    ]
                );
        for (const name of ["PROVIDER_BUDGET", "OPTIONAL_BUDGET"])
            assert.equal(
                preRecoveryCaps[name][metric],
                favoritesCategoryPersistenceBaseline[name][metric]
            );
        for (const row of categoryPersistenceEvidence.measurements) {
            const deltas = {};
            for (const name of ["entry", "favorites", "legacy", "total"]) {
                assert(
                    Number.isInteger(row.baseline[name][metric]) &&
                        row.baseline[name][metric] >= 0
                );
                assert(
                    Number.isInteger(row.candidate[name][metric]) &&
                        row.candidate[name][metric] >= 0
                );
                const delta =
                    row.candidate[name][metric] - row.baseline[name][metric];
                deltas[name] = delta;
                assert.equal(row.delta[name][metric], delta);
                const allocated =
                    name === "favorites"
                        ? favorites
                        : entry + (name === "total" ? favorites : 0);
                assert(
                    delta <= allocated,
                    row.variant +
                        " " +
                        name +
                        " measured growth fits its allowance"
                );
                const previousHeadroom =
                    categoryPersistenceEvidence.previousCaps[name][metric] -
                    row.baseline[name][metric];
                const nextHeadroom =
                    categoryPersistenceEvidence.previousCaps[name][metric] +
                    allocated -
                    row.candidate[name][metric];
                assert(
                    previousHeadroom >= 0,
                    row.variant + " baseline fits its original cap"
                );
                assert(
                    nextHeadroom >= previousHeadroom,
                    row.variant + " " + name + " preserves previous headroom"
                );
            }
            assert.equal(deltas.legacy, deltas.entry);
            assert.equal(deltas.total, deltas.entry + deltas.favorites);
        }
    }
    const pathEvidence = require("../docs/evidence/local-favorites-path-size-20261102.json");
    assert.deepEqual(LOCAL_FAVORITES_PATH_ALLOWANCE, pathEvidence.allowance);
    assert(Object.isFrozen(LOCAL_FAVORITES_PATH_ALLOWANCE));
    for (const cap of Object.values(LOCAL_FAVORITES_PATH_ALLOWANCE))
        assert(Object.isFrozen(cap));
    for (const metric of ["bytes", "gzipBytes"]) {
        const entry = LOCAL_FAVORITES_PATH_ALLOWANCE.entry[metric];
        const favorites = LOCAL_FAVORITES_PATH_ALLOWANCE.favorites[metric];
        for (const name of [
            "BUDGET",
            "LEGACY_TOTAL_BUDGET",
            "BASE_TOTAL_BUDGET",
            "TOTAL_BUDGET",
        ])
            assert.equal(
                localFavoritesPathCaps[name][metric] -
                    localFavoritesPathBaseline[name][metric],
                entry +
                    (["BASE_TOTAL_BUDGET", "TOTAL_BUDGET"].includes(name)
                        ? favorites
                        : 0),
                name + " counts each applicable Local Favorites allowance once"
            );
        assert.equal(
            localFavoritesPathCaps.OPTIONAL_BUDGETS["favorites-transfer"][
                metric
            ] -
                localFavoritesPathBaseline.OPTIONAL_BUDGETS[
                    "favorites-transfer"
                ][metric],
            favorites
        );
        for (const name of Object.keys(OPTIONAL_BUDGETS))
            if (name !== "favorites-transfer")
                assert.equal(
                    localFavoritesPathCaps.OPTIONAL_BUDGETS[name][metric],
                    localFavoritesPathBaseline.OPTIONAL_BUDGETS[name][metric]
                );
        for (const name of ["PROVIDER_BUDGET", "OPTIONAL_BUDGET"])
            assert.equal(
                preRecoveryCaps[name][metric],
                localFavoritesPathBaseline[name][metric]
            );
        for (const row of pathEvidence.measurements) {
            const deltas = Object.fromEntries(
                ["entry", "favorites", "legacy", "total"].map((name) => [
                    name,
                    row.candidate[name][metric] - row.baseline[name][metric],
                ])
            );
            assert.equal(deltas.entry, row.delta.entry[metric]);
            assert.equal(deltas.favorites, row.delta.favorites[metric]);
            assert.equal(deltas.legacy, deltas.entry);
            assert.equal(deltas.total, deltas.entry + deltas.favorites);
            assert.equal(
                row.featureHeadroom.entry[metric],
                entry - deltas.entry
            );
            assert.equal(
                row.featureHeadroom.favorites[metric],
                favorites - deltas.favorites
            );
            for (const name of ["entry", "favorites", "legacy", "total"]) {
                const allocated =
                    name === "favorites"
                        ? favorites
                        : entry + (name === "total" ? favorites : 0);
                const headroom =
                    pathEvidence.previousCaps[name][metric] +
                    allocated -
                    row.candidate[name][metric];
                assert.equal(row.resultingHeadroom[name][metric], headroom);
                assert(
                    headroom >= 0,
                    row.variant +
                        " " +
                        name +
                        " recorded candidate fits approved caps"
                );
            }
        }
    }
    assert.equal(
        pathEvidence.measurementContext.gitSourceIdentityBytesExcluded,
        40
    );
    assert.equal(pathEvidence.measurementContext.betaSuffixIncluded, false);
    assert.deepEqual(pathEvidence.comparison.candidateInputErrors, []);
    const shellEvidence = require("../docs/evidence/modern-native-shell-size-20261102.json");
    const artworkEvidence = require("../docs/evidence/plex-artwork-size-20261102.json");
    assert.deepEqual(PLEX_ARTWORK_ALLOWANCE, artworkEvidence.allowance);
    assert(Object.isFrozen(PLEX_ARTWORK_ALLOWANCE));
    for (const metric of ["bytes", "gzipBytes"]) {
        assert.equal(
            PLEX_ARTWORK_ALLOWANCE[metric],
            artworkEvidence.candidate.output[metric] -
                artworkEvidence.baseline.output[metric]
        );
        for (const name of [
            "LEGACY_TOTAL_BUDGET",
            "BASE_TOTAL_BUDGET",
            "TOTAL_BUDGET",
        ])
            assert.equal(
                plexArtworkCaps[name][metric] -
                    modernNativeShellCaps[name][metric],
                PLEX_ARTWORK_ALLOWANCE[metric]
            );
    }
    for (const [stage, caps] of Object.entries({
        after: plexArtworkCaps,
        before: modernNativeShellCaps,
    }))
        assert.deepEqual(artworkEvidence.budgets[stage], {
            // Replay the immutable Plex receipt before later Modern fixes.
            baseTotal: subtract(
                caps.BASE_TOTAL_BUDGET,
                shellEvidence.finalization.delta
            ),
            legacy: caps.LEGACY_TOTAL_BUDGET,
            total: subtract(
                caps.TOTAL_BUDGET,
                shellEvidence.finalization.delta
            ),
        });
    assert.deepEqual(artworkEvidence.protectedCaps, {
        entry: BUDGET,
        provider: PROVIDER_BUDGET,
    });
    assert.strictEqual(plexArtworkCaps.BUDGET, modernNativeShellCaps.BUDGET);
    assert.strictEqual(
        plexArtworkCaps.OPTIONAL_BUDGETS,
        modernNativeShellCaps.OPTIONAL_BUDGETS
    );
    assert.deepEqual(
        MODERN_NATIVE_SHELL_OPTIONAL_ALLOWANCE,
        shellEvidence.allowance
    );
    assert(Object.isFrozen(MODERN_NATIVE_SHELL_OPTIONAL_ALLOWANCE));
    for (const metric of ["bytes", "gzipBytes"]) {
        assert.equal(
            shellEvidence.finalization.delta[metric],
            shellEvidence.candidate.output[metric] -
                shellEvidence.previousCandidate.output[metric]
        );
        assert.equal(
            MODERN_NATIVE_SHELL_OPTIONAL_ALLOWANCE[metric],
            shellEvidence.previousCandidate.allowance[metric] +
                shellEvidence.finalization.delta[metric],
            "finalization adds only the measured optional cost"
        );
        assert.equal(
            MODERN_NATIVE_SHELL_OPTIONAL_ALLOWANCE[metric],
            shellEvidence.candidate.output[metric] -
                shellEvidence.baseline.output[metric]
        );
        for (const name of ["BASE_TOTAL_BUDGET", "TOTAL_BUDGET"])
            assert.equal(
                modernNativeShellCaps[name][metric] -
                    archiveRelativeSeekCaps[name][metric],
                MODERN_NATIVE_SHELL_OPTIONAL_ALLOWANCE[metric]
            );
        assert.equal(
            modernNativeShellCaps.OPTIONAL_BUDGETS["modern-interface"][metric] -
                shellEvidence.candidate.output[metric],
            archiveRelativeSeekCaps.OPTIONAL_BUDGETS["modern-interface"][
                metric
            ] - shellEvidence.baseline.output[metric],
            "the optional feature preserves its previous measured headroom"
        );
    }
    for (const [stage, caps] of Object.entries({
        after: modernNativeShellCaps,
        before: archiveRelativeSeekCaps,
    }))
        assert.deepEqual(shellEvidence.budgets[stage], {
            baseTotal: caps.BASE_TOTAL_BUDGET,
            modern: caps.OPTIONAL_BUDGETS["modern-interface"],
            total: caps.TOTAL_BUDGET,
        });
    assert.deepEqual(shellEvidence.protectedCaps, {
        entry: modernNativeShellCaps.BUDGET,
        legacy: modernNativeShellCaps.LEGACY_TOTAL_BUDGET,
        provider: PROVIDER_BUDGET,
    });
    for (const name of ["BUDGET", "LEGACY_TOTAL_BUDGET"])
        assert.strictEqual(
            modernNativeShellCaps[name],
            archiveRelativeSeekCaps[name]
        );
    for (const name of Object.keys(OPTIONAL_BUDGETS))
        if (name !== "modern-interface")
            assert.strictEqual(
                modernNativeShellCaps.OPTIONAL_BUDGETS[name],
                archiveRelativeSeekCaps.OPTIONAL_BUDGETS[name]
            );
    const archiveEvidence = require("../docs/evidence/archive-relative-seek-size-20261102.json");
    assert.deepEqual(
        ARCHIVE_RELATIVE_SEEK_ALLOWANCE,
        archiveEvidence.allowance
    );
    assert(Object.isFrozen(ARCHIVE_RELATIVE_SEEK_ALLOWANCE));
    for (const metric of ["bytes", "gzipBytes"]) {
        assert.equal(
            ARCHIVE_RELATIVE_SEEK_ALLOWANCE[metric],
            Math.max(
                ...archiveEvidence.candidate.map(
                    (after, index) =>
                        after[metric] - archiveEvidence.baseline[index][metric]
                )
            )
        );
        for (const name of [
            "BUDGET",
            "LEGACY_TOTAL_BUDGET",
            "BASE_TOTAL_BUDGET",
            "TOTAL_BUDGET",
        ])
            assert.equal(
                archiveRelativeSeekCaps[name][metric] -
                    modernInfoInteractionCaps[name][metric],
                ARCHIVE_RELATIVE_SEEK_ALLOWANCE[metric]
            );
    }
    assert.deepEqual(
        archiveRelativeSeekCaps.OPTIONAL_BUDGETS,
        modernInfoInteractionCaps.OPTIONAL_BUDGETS
    );
    const infoEvidence = require("../docs/evidence/modern-info-interaction-size-20261101.json");
    assert.deepEqual(infoEvidence.allowance, MODERN_INFO_INTERACTION_ALLOWANCE);
    assert.deepEqual(infoEvidence.beforeCaps, companionDiagnosticsCaps);
    assert.deepEqual(infoEvidence.afterCaps, modernInfoInteractionCaps);
    assert.deepEqual(infoEvidence.protectedCaps, {
        optional: OPTIONAL_BUDGET,
        provider: PROVIDER_BUDGET,
    });
    assert.equal(
        infoEvidence.baseline.revision,
        "3ef56b0f03d28b74a01d085a207d35853abba19c"
    );
    assert.equal(
        infoEvidence.candidate.revision,
        "2e6139060123a85315aad1d0a29213b9daf9b383"
    );
    for (const source of [infoEvidence.baseline, infoEvidence.candidate]) {
        assert.equal(
            source.version,
            "1.1.62-beta.22+fix." + source.revision.slice(0, 8)
        );
        assert.equal(source.sourceHead, source.revision);
        assert.equal(source.embeddedSourceRevision, null);
        assert.equal(source.allTrackedInputsVerified, true);
        assert.match(source.archiveSha256, /^[a-f0-9]{64}$/);
    }
    assert.deepEqual(infoEvidence.toolchain, {
        gzipLevel: 9,
        node: "26.8.2",
        terser: "5.51.2",
        typescript: "5.9.3",
        vite: "8.3.5",
        zlib: "1.2.12",
    });
    // Calculated metadata projections stay distinct from measured local builds.
    // Three shorter version literals cover the one 40-byte source literal with
    // the existing headroom, including a four-digit beta sequence; no reserve.
    const metadata = infoEvidence.metadataProjection;
    assert.equal(metadata.localVersion, infoEvidence.candidate.version);
    assert.equal(metadata.localVersionLength, metadata.localVersion.length);
    assert.equal(metadata.sourceRevisionBytes, 40);
    assert.deepEqual(metadata.extraReserve, { bytes: 0, gzipBytes: 0 });
    assert.deepEqual(Object.keys(metadata.variants).sort(), [
        "mobile",
        "native",
        "web",
    ]);
    assert.deepEqual(
        metadata.scenarios.map((scenario) => scenario.version),
        ["1.1.62", "1.1.62-beta.23", "1.1.62-beta.9999"]
    );
    for (const [name, variant] of Object.entries(metadata.variants)) {
        assert.equal(
            variant.entrySha256,
            infoEvidence.components.find((row) => row.name === "player.js")
                .variants[name].after.sha256
        );
        assert.equal(variant.versionOccurrences, 3);
        assert.equal(variant.sourceRevisionOccurrences, 1);
        assert.equal(variant.occurrencesOutsideEntry, 0);
        assert.equal(
            variant.completeRawHeadroom,
            modernInfoInteractionCaps.TOTAL_BUDGET.bytes -
                infoEvidence.totals[name].after.complete.bytes
        );
        for (const scenario of metadata.scenarios) {
            assert.equal(scenario.versionLength, scenario.version.length);
            const delta =
                metadata.sourceRevisionBytes +
                variant.versionOccurrences *
                    (scenario.versionLength - metadata.localVersionLength);
            assert.equal(scenario.projectedEntryAndCompleteRawDelta, delta);
            assert.equal(
                scenario.remainingCompleteRawHeadroom[name],
                variant.completeRawHeadroom - delta
            );
            assert(scenario.remainingCompleteRawHeadroom[name] >= 0);
        }
    }
    const infoKinds = {
        "favorites-transfer.js": "favorites",
        "modern-interface.js": "renderer",
        "player.js": "entry",
        "provider-edem.js": "edem",
        "provider-plex.js": "plex",
    };
    assert.deepEqual(
        infoEvidence.components.map((row) => row.name).sort(),
        Object.keys(infoKinds).sort()
    );
    const infoComponents = [
        ...infoEvidence.components,
        ...infoEvidence.unchangedComponents,
    ];
    assert.deepEqual(
        infoComponents.map((row) => row.name).sort(),
        [
            "player.js",
            ...Object.keys(CLASSIC_PROVIDER_BUNDLES).map(
                (name) => `provider-${name}.js`
            ),
            ...Object.keys(CLASSIC_OPTIONAL_BUNDLES).map(
                (name) => `${name}.js`
            ),
        ].sort()
    );
    assert(Object.isFrozen(MODERN_INFO_INTERACTION_ALLOWANCE));
    for (const allowance of Object.values(MODERN_INFO_INTERACTION_ALLOWANCE))
        assert(Object.isFrozen(allowance));
    for (const row of infoComponents) {
        assert.deepEqual(Object.keys(row.variants).sort(), [
            "mobile",
            "native",
            "web",
        ]);
        for (const variant of Object.values(row.variants)) {
            for (const record of infoKinds[row.name]
                ? [variant.before, variant.after]
                : [variant]) {
                assert.match(record.sha256, /^[a-f0-9]{64}$/);
                assert(Number.isInteger(record.bytes) && record.bytes > 0);
                assert(
                    Number.isInteger(record.gzipBytes) && record.gzipBytes > 0
                );
            }
            if (infoKinds[row.name])
                for (const metric of ["bytes", "gzipBytes"])
                    assert.equal(
                        variant.delta[metric],
                        variant.after[metric] - variant.before[metric]
                    );
        }
        if (infoKinds[row.name])
            for (const metric of ["bytes", "gzipBytes"])
                assert.equal(
                    MODERN_INFO_INTERACTION_ALLOWANCE[infoKinds[row.name]][
                        metric
                    ],
                    Math.max(
                        ...Object.values(row.variants).map(
                            (variant) => variant.delta[metric]
                        )
                    )
                );
    }
    for (const [variantName, totals] of Object.entries(infoEvidence.totals))
        for (const [scope, capName] of [
            ["entry", "BUDGET"],
            ["legacy", "LEGACY_TOTAL_BUDGET"],
            ["complete", "TOTAL_BUDGET"],
        ]) {
            const rows = infoComponents.filter(
                (row) =>
                    scope === "complete" ||
                    row.name === "player.js" ||
                    (scope === "legacy" && row.name.startsWith("provider-"))
            );
            for (const metric of ["bytes", "gzipBytes"]) {
                for (const state of ["before", "after"])
                    assert.equal(
                        totals[state][scope][metric],
                        rows.reduce((sum, row) => {
                            const variant = row.variants[variantName];
                            return (
                                sum +
                                (infoKinds[row.name]
                                    ? variant[state]
                                    : variant)[metric]
                            );
                        }, 0)
                    );
                assert.equal(
                    totals.delta[scope][metric],
                    totals.after[scope][metric] - totals.before[scope][metric]
                );
                assert(
                    modernInfoInteractionCaps[capName][metric] -
                        totals.after[scope][metric] >=
                        companionDiagnosticsCaps[capName][metric] -
                            totals.before[scope][metric]
                );
            }
        }
    const companionDiagnosticsEvidence = require("../docs/evidence/companion-diagnostics-size-20261031.json");
    assert.deepEqual(
        companionDiagnosticsEvidence.allowance,
        COMPANION_DIAGNOSTICS_ALLOWANCE
    );
    assert.equal(
        companionDiagnosticsEvidence.baseline.revision,
        "127bd3cec155051b83ae1a51c7e3f8e65ddcc1a9"
    );
    for (const [name, cap] of Object.entries(modernExperienceCaps))
        assert.deepEqual(companionDiagnosticsEvidence.beforeCaps[name], cap);
    for (const [name, cap] of Object.entries(modernPlayerCaps))
        assert.deepEqual(companionDiagnosticsEvidence.afterCaps[name], cap);
    assert.deepEqual(
        companionDiagnosticsEvidence.beforeCaps.PROVIDER_BUDGET,
        PROVIDER_BUDGET
    );
    assert.deepEqual(
        companionDiagnosticsEvidence.beforeCaps.OPTIONAL_BUDGET,
        OPTIONAL_BUDGET
    );
    const companionKinds = {
        "media-companion.js": "companion",
        "player.js": "entry",
        "provider-torrent.js": "catalog",
    };
    assert.deepEqual(
        companionDiagnosticsEvidence.components.map((row) => row.name).sort(),
        Object.keys(companionKinds).sort()
    );
    assert(Object.isFrozen(COMPANION_DIAGNOSTICS_ALLOWANCE));
    assert.deepEqual(
        [
            ...companionDiagnosticsEvidence.components,
            ...companionDiagnosticsEvidence.unchangedComponents,
        ]
            .map((row) => row.name)
            .sort(),
        [
            "player.js",
            ...Object.keys(CLASSIC_PROVIDER_BUNDLES).map(
                (name) => `provider-${name}.js`
            ),
            ...Object.keys(CLASSIC_OPTIONAL_BUNDLES).map(
                (name) => `${name}.js`
            ),
        ].sort()
    );
    assert.deepEqual(
        companionDiagnosticsEvidence.supplementalAssets.stylesheet.before,
        companionDiagnosticsEvidence.supplementalAssets.stylesheet.after
    );
    for (const row of companionDiagnosticsEvidence.components) {
        assert.deepEqual(Object.keys(row.variants).sort(), [
            "mobile",
            "native",
            "web",
        ]);
        const cap = COMPANION_DIAGNOSTICS_ALLOWANCE[companionKinds[row.name]];
        assert(Object.isFrozen(cap));
        for (const metric of ["bytes", "gzipBytes"]) {
            for (const variant of Object.values(row.variants)) {
                assert.equal(
                    variant.delta[metric],
                    variant.after[metric] - variant.before[metric]
                );
                assert.match(variant.before.sha256, /^[a-f0-9]{64}$/);
                assert.match(variant.after.sha256, /^[a-f0-9]{64}$/);
            }
            assert.equal(
                cap[metric],
                Math.max(
                    ...Object.values(row.variants).map(
                        (variant) => variant.delta[metric]
                    )
                )
            );
        }
    }
    const experienceEvidence = require("../docs/evidence/modern-provider-experience-size-20261031.json");
    assert.deepEqual(experienceEvidence.allowance, MODERN_EXPERIENCE_ALLOWANCE);
    assert.deepEqual(experienceEvidence.beforeCaps, torznabCaps);
    assert.deepEqual(experienceEvidence.afterCaps, modernExperienceCaps);
    assert.deepEqual(experienceEvidence.protectedCaps, {
        optional: OPTIONAL_BUDGET,
        provider: PROVIDER_BUDGET,
    });
    assert.equal(
        experienceEvidence.baseline.revision,
        "517f169ec871cce2df0f944cce67bfb0afb4b0b7"
    );
    assert.deepEqual(experienceEvidence.toolchain, {
        gzipLevel: 9,
        node: "26.8.2",
        zlib: "1.2.12",
    });
    const experienceKinds = {
        "modern-interface.js": "renderer",
        "player.js": "entry",
        "provider-torrent.js": "catalog",
    };
    const experienceComponents = [
        ...experienceEvidence.components,
        ...experienceEvidence.unchangedComponents,
    ];
    assert.deepEqual(
        experienceEvidence.components.map((row) => row.name).sort(),
        Object.keys(experienceKinds).sort()
    );
    assert.deepEqual(
        experienceComponents.map((row) => row.name).sort(),
        [
            "player.js",
            ...Object.keys(CLASSIC_PROVIDER_BUNDLES).map(
                (name) => `provider-${name}.js`
            ),
            ...Object.keys(CLASSIC_OPTIONAL_BUNDLES).map(
                (name) => `${name}.js`
            ),
        ].sort()
    );
    assert(Object.isFrozen(MODERN_EXPERIENCE_ALLOWANCE));
    for (const allowance of Object.values(MODERN_EXPERIENCE_ALLOWANCE))
        assert(Object.isFrozen(allowance));
    for (const row of experienceComponents) {
        assert.deepEqual(Object.keys(row.variants).sort(), [
            "mobile",
            "native",
            "web",
        ]);
        for (const variant of Object.values(row.variants)) {
            for (const state of ["before", "after"])
                assert.match(variant[state].sha256, /^[a-f0-9]{64}$/);
            for (const metric of ["bytes", "gzipBytes"])
                assert.equal(
                    variant.delta[metric],
                    variant.after[metric] - variant.before[metric]
                );
            if (!experienceKinds[row.name])
                assert.deepEqual(variant.after, variant.before);
        }
        if (experienceKinds[row.name])
            for (const metric of ["bytes", "gzipBytes"])
                assert.equal(
                    MODERN_EXPERIENCE_ALLOWANCE[experienceKinds[row.name]][
                        metric
                    ],
                    Math.max(
                        ...Object.values(row.variants).map(
                            (variant) => variant.delta[metric]
                        )
                    )
                );
    }
    for (const [variant, totals] of Object.entries(experienceEvidence.totals))
        for (const state of ["before", "after"])
            for (const metric of ["bytes", "gzipBytes"])
                for (const scope of ["legacy", "complete"])
                    assert.equal(
                        totals[state][scope][metric],
                        experienceComponents
                            .filter(
                                (row) =>
                                    scope === "complete" ||
                                    row.name === "player.js" ||
                                    row.name.startsWith("provider-")
                            )
                            .reduce(
                                (sum, row) =>
                                    sum + row.variants[variant][state][metric],
                                0
                            )
                    );
    const torznabEvidence = require("../docs/evidence/torznab-discovery-size-20261030.json");
    assert.deepEqual(torznabEvidence.allowance, TORZNAB_DISCOVERY_ALLOWANCE);
    assert.deepEqual(torznabEvidence.beforeCaps, streamsCaps);
    assert.deepEqual(torznabEvidence.afterCaps, torznabCaps);
    assert.deepEqual(torznabEvidence.protectedCaps, {
        optional: OPTIONAL_BUDGET,
        provider: PROVIDER_BUDGET,
    });
    assert.deepEqual(torznabEvidence.toolchain, {
        gzipLevel: 9,
        node: "26.8.2",
        zlib: "1.2.12",
    });
    assert.equal(
        torznabEvidence.baseline.revision,
        "94fe329822e9e12b88674102f6002593dd693de1"
    );
    assert.equal(
        torznabEvidence.baseline.runtimeArchiveRevision,
        "c59cc470e9bac730dae785fe7d8688dfae5e04d0"
    );
    assert.equal(
        torznabEvidence.baseline.archiveSha256,
        "2259667775b0ccfb5d91c4bb70f510f95bda466d95f596658bf84163082ae3c8"
    );
    const torznabKinds = {
        "favorites-transfer.js": "favorites",
        "media-companion.js": "companion",
        "player.js": "entry",
        "provider-torrent.js": "catalog",
        "remote-settings-lifecycle.js": "settings",
    };
    const torznabNames = [
        "player.js",
        ...Object.keys(CLASSIC_PROVIDER_BUNDLES).map(
            (name) => `provider-${name}.js`
        ),
        ...Object.keys(CLASSIC_OPTIONAL_BUNDLES).map((name) => `${name}.js`),
    ].sort();
    const torznabComponents = [
        ...torznabEvidence.components,
        ...torznabEvidence.unchangedComponents,
    ];
    assert.deepEqual(
        torznabEvidence.components.map((row) => row.name).sort(),
        Object.keys(torznabKinds).sort()
    );
    assert.deepEqual(
        torznabComponents.map((row) => row.name).sort(),
        torznabNames
    );
    assert.equal(
        torznabEvidence.nativeBaseline
            .candidateTransformVerifiedArtifactsPerVariant,
        torznabNames.length
    );
    assert(Object.isFrozen(TORZNAB_DISCOVERY_ALLOWANCE));
    for (const allowance of Object.values(TORZNAB_DISCOVERY_ALLOWANCE))
        assert(Object.isFrozen(allowance));
    for (const row of torznabComponents) {
        assert.deepEqual(Object.keys(row.variants).sort(), [
            "mobile",
            "native",
            "web",
        ]);
        for (const variant of Object.values(row.variants)) {
            for (const state of ["before", "after"])
                assert.match(variant[state].sha256, /^[a-f0-9]{64}$/);
            for (const metric of ["bytes", "gzipBytes"])
                assert.equal(
                    variant.delta[metric],
                    variant.after[metric] - variant.before[metric]
                );
            if (!torznabKinds[row.name])
                assert.deepEqual(variant.after, variant.before);
        }
        if (torznabKinds[row.name])
            for (const metric of ["bytes", "gzipBytes"]) {
                assert.equal(
                    TORZNAB_DISCOVERY_ALLOWANCE[torznabKinds[row.name]][metric],
                    Math.max(
                        ...Object.values(row.variants).map(
                            (variant) => variant.delta[metric]
                        )
                    )
                );
            }
    }
    for (const [variant, totals] of Object.entries(torznabEvidence.totals)) {
        for (const state of ["before", "after"])
            for (const metric of ["bytes", "gzipBytes"]) {
                assert.equal(
                    totals[state].complete[metric],
                    torznabComponents.reduce(
                        (sum, row) =>
                            sum + row.variants[variant][state][metric],
                        0
                    )
                );
                assert.equal(
                    totals[state].legacy[metric],
                    torznabComponents
                        .filter(
                            (row) =>
                                row.name === "player.js" ||
                                row.name.startsWith("provider-")
                        )
                        .reduce(
                            (sum, row) =>
                                sum + row.variants[variant][state][metric],
                            0
                        )
                );
            }
    }
    const streamsEvidence = require("../docs/evidence/torrent-streams-size-20261030.json");
    const archivedStreams = [
        ...streamsEvidence.components,
        ...streamsEvidence.unchangedComponents,
    ];
    for (const row of torznabComponents)
        for (const [variant, measurement] of Object.entries(row.variants)) {
            assert.deepEqual(
                measurement.before,
                archivedStreams.find((old) => old.name === row.name).variants[
                    variant
                ].after
            );
        }

    assert.deepEqual(streamsEvidence.allowance, TORRENT_STREAMS_ALLOWANCE);
    assert.deepEqual(streamsEvidence.beforeCaps, discoveryCaps);
    assert.deepEqual(streamsEvidence.afterCaps, streamsCaps);
    assert.deepEqual(streamsEvidence.toolchain, {
        gzipLevel: 9,
        node: "26.8.2",
        zlib: "1.2.12",
    });
    assert.match(streamsEvidence.baseline.revision, /^[a-f0-9]{40}$/);
    assert.match(streamsEvidence.baseline.archiveSha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(streamsEvidence.protectedCaps, {
        optional: OPTIONAL_BUDGET,
        provider: PROVIDER_BUDGET,
    });
    const streamsKinds = {
        "media-companion.js": "companion",
        "player.js": "entry",
        "provider-torrent.js": "catalog",
        "remote-settings-lifecycle.js": "settings",
    };
    const streamNames = [
        "player.js",
        ...Object.keys(CLASSIC_PROVIDER_BUNDLES).map(
            (name) => `provider-${name}.js`
        ),
        ...Object.keys(CLASSIC_OPTIONAL_BUNDLES).map((name) => `${name}.js`),
    ];
    assert.deepEqual(
        streamsEvidence.components.map((row) => row.name).sort(),
        Object.keys(streamsKinds).sort()
    );
    const streamComponents = [
        ...streamsEvidence.components,
        ...streamsEvidence.unchangedComponents,
    ];
    assert.deepEqual(
        streamComponents.map((row) => row.name).sort(),
        streamNames.sort()
    );
    for (const component of streamComponents) {
        assert.deepEqual(Object.keys(component.variants).sort(), [
            "mobile",
            "native",
            "web",
        ]);
        for (const variant of Object.values(component.variants)) {
            for (const state of ["before", "after"])
                assert.match(variant[state].sha256, /^[a-f0-9]{64}$/);
            for (const metric of ["bytes", "gzipBytes"])
                assert.equal(
                    variant.delta[metric],
                    variant.after[metric] - variant.before[metric]
                );
            if (!streamsKinds[component.name])
                assert.deepEqual(variant.before, variant.after);
        }
        if (streamsKinds[component.name])
            for (const metric of ["bytes", "gzipBytes"])
                assert.equal(
                    TORRENT_STREAMS_ALLOWANCE[streamsKinds[component.name]][
                        metric
                    ],
                    Math.max(
                        ...Object.values(component.variants).map(
                            (variant) => variant.delta[metric]
                        )
                    )
                );
    }
    for (const [variant, totals] of Object.entries(streamsEvidence.totals))
        for (const state of ["before", "after"])
            for (const metric of ["bytes", "gzipBytes"]) {
                assert.equal(
                    totals[state].complete[metric],
                    streamComponents.reduce(
                        (sum, row) =>
                            sum + row.variants[variant][state][metric],
                        0
                    )
                );
                assert.equal(
                    totals[state].legacy[metric],
                    streamComponents
                        .filter(
                            (row) =>
                                row.name === "player.js" ||
                                row.name.startsWith("provider-")
                        )
                        .reduce(
                            (sum, row) =>
                                sum + row.variants[variant][state][metric],
                            0
                        )
                );
            }
    assert(Object.isFrozen(TORRENT_STREAMS_ALLOWANCE));
    for (const value of Object.values(TORRENT_STREAMS_ALLOWANCE))
        assert(Object.isFrozen(value));
    const discoveryEvidence = require("../docs/evidence/torrent-discovery-size-20261030.json");
    assert.deepEqual(discoveryEvidence.allowance, TORRENT_DISCOVERY_ALLOWANCE);
    assert.deepEqual(discoveryEvidence.beforeCaps, currentCaps);
    assert.deepEqual(discoveryEvidence.afterCaps, discoveryCaps);
    assert.deepEqual(discoveryEvidence.toolchain, {
        gzipLevel: 9,
        node: "26.8.2",
        zlib: "1.2.12",
    });
    assert.match(discoveryEvidence.baseline.archiveSha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(discoveryEvidence.protectedCaps, {
        optional: OPTIONAL_BUDGET,
        provider: PROVIDER_BUDGET,
    });
    const discoveryKinds = {
        "player.js": "entry",
        "provider-torrent.js": "catalog",
        "remote-settings-lifecycle.js": "settings",
    };
    assert.deepEqual(
        discoveryEvidence.components.map((row) => row.name).sort(),
        Object.keys(discoveryKinds).sort()
    );
    const discoveryNames = [
        "player.js",
        ...Object.keys(CLASSIC_PROVIDER_BUNDLES).map(
            (name) => `provider-${name}.js`
        ),
        ...Object.keys(CLASSIC_OPTIONAL_BUNDLES).map((name) => `${name}.js`),
    ].sort();
    assert.deepEqual(
        [
            ...discoveryEvidence.components,
            ...discoveryEvidence.unchangedComponents,
        ]
            .map((row) => row.name)
            .sort(),
        discoveryNames
    );
    for (const component of discoveryEvidence.components) {
        assert.deepEqual(Object.keys(component.variants).sort(), [
            "mobile",
            "native",
            "web",
        ]);
        for (const variant of Object.values(component.variants)) {
            for (const state of ["before", "after"])
                assert.match(variant[state].sha256, /^[a-f0-9]{64}$/);
            for (const metric of ["bytes", "gzipBytes"])
                assert.equal(
                    variant.delta[metric],
                    variant.after[metric] - variant.before[metric]
                );
        }
        for (const metric of ["bytes", "gzipBytes"])
            assert.equal(
                TORRENT_DISCOVERY_ALLOWANCE[discoveryKinds[component.name]][
                    metric
                ],
                Math.max(
                    ...Object.values(component.variants).map(
                        (variant) => variant.delta[metric]
                    )
                )
            );
    }
    for (const component of discoveryEvidence.unchangedComponents)
        for (const variant of Object.values(component.variants))
            assert.deepEqual(variant.before, variant.after);
    assert(Object.isFrozen(TORRENT_DISCOVERY_ALLOWANCE));
    for (const value of Object.values(TORRENT_DISCOVERY_ALLOWANCE))
        assert(Object.isFrozen(value));
    const torrentEvidence = require("../docs/evidence/torrent-provider-size-20261030.json");
    const rpcEvidence = require("../docs/evidence/torrent-catalog-rpc-size-20261030.json");
    const rpcKinds = {
        "favorites-transfer.js": "favorites",
        "media-companion.js": "companion",
        "player.js": "entry",
        "provider-torrent.js": "catalog",
    };
    assert.deepEqual(
        rpcEvidence.components.map((row) => row.name).sort(),
        Object.keys(rpcKinds).sort()
    );
    const rpcAllowance = { settings: { bytes: 0, gzipBytes: 0 } };
    for (const component of rpcEvidence.components) {
        for (const metric of ["bytes", "gzipBytes"]) {
            assert.equal(
                component.delta[metric],
                component.after[metric] - component.before[metric]
            );
        }
        for (const state of ["before", "after"])
            assert.match(component[state].sha256, /^[a-f0-9]{64}$/);
        rpcAllowance[rpcKinds[component.name]] = component.delta;
    }
    assert.deepEqual(TORRENT_PROVIDER_ALLOWANCE, {
        catalog: { bytes: 33485, gzipBytes: 11308 },
        companion: { bytes: -3377, gzipBytes: -1358 },
        entry: { bytes: 4572, gzipBytes: 1086 },
        favorites: { bytes: 4249, gzipBytes: 1121 },
        settings: { bytes: 263, gzipBytes: 102 },
    });
    for (const kind of Object.keys(TORRENT_PROVIDER_ALLOWANCE)) {
        assert.deepEqual(
            subtract(TORRENT_PROVIDER_ALLOWANCE[kind], rpcAllowance[kind]),
            torrentEvidence.allowance[kind]
        );
    }
    assert(Object.isFrozen(TORRENT_PROVIDER_ALLOWANCE));
    for (const [name, key] of [
        ["BUDGET", "entry"],
        ["LEGACY_TOTAL_BUDGET", "legacyTotal"],
        ["TOTAL_BUDGET", "total"],
    ]) {
        assert.deepEqual(historicalCaps[name], torrentEvidence.beforeCaps[key]);
        assert.deepEqual(
            subtract(currentCaps[name], torrentDelta(name, rpcAllowance)),
            torrentEvidence.afterCaps[key]
        );
    }
    for (const [name, key] of [
        ["media-companion", "companion"],
        ["favorites-transfer", "favorites"],
    ]) {
        assert.deepEqual(
            historicalCaps.OPTIONAL_BUDGETS[name],
            torrentEvidence.beforeCaps[key]
        );
        assert.deepEqual(
            subtract(currentCaps.OPTIONAL_BUDGETS[name], rpcAllowance[key]),
            torrentEvidence.afterCaps[key]
        );
    }
    // Historical feature receipts retain their original caps; the new allocation
    // is verified above, then removed once while replaying those receipts.
    ({
        BUDGET,
        BASE_TOTAL_BUDGET,
        LEGACY_TOTAL_BUDGET,
        OPTIONAL_BUDGETS,
        TOTAL_BUDGET,
    } = historicalCaps);
    const routingEvidence = require("../docs/evidence/media-companion-playback-routing-size-20261030.json");
    assert.equal(routingEvidence.budgetsChanged, false);
    assert.deepEqual(routingEvidence.toolchain, {
        node: "22.23.4",
        zlib: "1.3.1-e00f703",
    });
    assert.equal(routingEvidence.baseline.includesPreparationFix, true);
    assert.equal(routingEvidence.baseline.workingTree, true);
    assert.match(routingEvidence.baseline.manifestSha256, /^[a-f0-9]{64}$/);
    assert.equal(
        routingEvidence.candidate.allRecordedArtifactHashesAndSizesReverified,
        true
    );
    for (const [name, budget] of Object.entries({
        BASE_TOTAL_BUDGET,
        BUDGET,
        LEGACY_TOTAL_BUDGET,
        OPTIONAL_BUDGET,
        OPTIONAL_BUDGETS,
        PROVIDER_BUDGET,
        TOTAL_BUDGET,
    }))
        assert.deepEqual(
            budget,
            routingEvidence.caps[name],
            name + " unchanged by finite-stream routing"
        );
    assert.deepEqual(
        routingEvidence.modes.map((mode) => mode.path),
        ARTIFACTS
    );
    for (const mode of routingEvidence.modes) {
        assert.deepEqual(
            mode.components.map((row) => row.name).sort(),
            [
                "player.js",
                ...Object.keys(CLASSIC_PROVIDER_BUNDLES)
                    .filter((name) => name !== "torrent")
                    .map((name) => "provider-" + name + ".js"),
                ...Object.keys(CLASSIC_OPTIONAL_BUNDLES).map(
                    (name) => name + ".js"
                ),
            ].sort()
        );
        for (const row of mode.components) {
            assert.match(row.before.sha256, /^[a-f0-9]{64}$/);
            assert.match(row.after.sha256, /^[a-f0-9]{64}$/);
            if (!["player.js", "media-companion.js"].includes(row.name))
                assert.deepEqual(
                    row.before,
                    row.after,
                    row.name + " unaffected by finite-stream routing"
                );
            for (const metric of ["bytes", "gzipBytes"]) {
                assert.equal(
                    row.delta[metric],
                    row.after[metric] - row.before[metric]
                );
                if (row.name === "player.js")
                    assert(row.after[metric] <= BUDGET[metric]);
                if (row.name === "media-companion.js")
                    assert(
                        row.after[metric] <=
                            OPTIONAL_BUDGETS["media-companion"][metric]
                    );
            }
        }
        for (const metric of ["bytes", "gzipBytes"])
            assert(
                mode.components.reduce(
                    (sum, row) => sum + row.after[metric],
                    0
                ) <= TOTAL_BUDGET[metric]
            );
    }
    const preparationDelta = (budget, metric) =>
        [BUDGET, LEGACY_TOTAL_BUDGET, BASE_TOTAL_BUDGET, TOTAL_BUDGET].includes(
            budget
        )
            ? MEDIA_COMPANION_PREPARATION_ALLOWANCE[metric]
            : 0;
    const beforePreparationBudget = (budget) =>
        Object.fromEntries(
            ["bytes", "gzipBytes"].map((metric) => [
                metric,
                budget[metric] - preparationDelta(budget, metric),
            ])
        );
    const preparationEvidence = require("../docs/evidence/media-companion-preparation-size-20261030.json");
    assert(Object.isFrozen(MEDIA_COMPANION_PREPARATION_ALLOWANCE));
    assert.deepEqual(
        MEDIA_COMPANION_PREPARATION_ALLOWANCE,
        preparationEvidence.allowance
    );
    assert.deepEqual(preparationEvidence.toolchain, {
        node: "22.23.4",
        zlib: "1.3.1-e00f703",
    });
    assert.match(preparationEvidence.baseline.revision, /^[a-f0-9]{40}$/);
    assert.match(preparationEvidence.lockSha256, /^[a-f0-9]{64}$/);
    assert.equal(
        preparationEvidence.candidate
            .allRecordedArtifactHashesAndSizesReverified,
        true
    );
    assert.deepEqual(
        preparationEvidence.modes.map((row) => row.path),
        ARTIFACTS
    );
    for (const [name, budget] of Object.entries({
        BASE_TOTAL_BUDGET,
        BUDGET,
        LEGACY_TOTAL_BUDGET,
        OPTIONAL_BUDGET,
        PROVIDER_BUDGET,
        TOTAL_BUDGET,
    })) {
        assert.deepEqual(budget, preparationEvidence.nextCaps[name]);
        assert.deepEqual(
            beforePreparationBudget(budget),
            preparationEvidence.previousCaps[name],
            name + " counts preparation entry once"
        );
    }
    assert.deepEqual(
        OPTIONAL_BUDGETS,
        preparationEvidence.previousCaps.OPTIONAL_BUDGETS
    );
    assert.deepEqual(
        OPTIONAL_BUDGETS,
        preparationEvidence.nextCaps.OPTIONAL_BUDGETS
    );
    for (const metric of ["bytes", "gzipBytes"])
        assert.equal(
            MEDIA_COMPANION_PREPARATION_ALLOWANCE[metric],
            Math.max(
                ...preparationEvidence.modes.map(
                    (mode) =>
                        mode.components.find((row) => row.name === "player.js")
                            .delta[metric]
                )
            ) + preparationEvidence.reserve[metric]
        );
    for (const mode of preparationEvidence.modes) {
        assert.deepEqual(
            mode.components.map((row) => row.name).sort(),
            [
                "player.js",
                ...Object.keys(CLASSIC_PROVIDER_BUNDLES)
                    .filter((name) => name !== "torrent")
                    .map((name) => "provider-" + name + ".js"),
                ...Object.keys(CLASSIC_OPTIONAL_BUNDLES).map(
                    (name) => name + ".js"
                ),
            ].sort()
        );
        for (const row of mode.components) {
            assert.match(row.before.sha256, /^[a-f0-9]{64}$/);
            assert.match(row.after.sha256, /^[a-f0-9]{64}$/);
            if (row.name !== "player.js")
                assert.deepEqual(
                    row.before,
                    row.after,
                    row.name + " is unchanged by preparation feedback"
                );
            for (const metric of ["bytes", "gzipBytes"])
                assert.equal(
                    row.delta[metric],
                    row.after[metric] - row.before[metric]
                );
        }
    }
    const transportDelta = (budget, metric) =>
        [
            BASE_TOTAL_BUDGET,
            TOTAL_BUDGET,
            OPTIONAL_BUDGETS["media-companion"],
        ].includes(budget)
            ? MEDIA_COMPANION_TRANSPORT_ALLOWANCE[metric]
            : 0;
    const beforeTransportBudget = (budget) =>
        Object.fromEntries(
            ["bytes", "gzipBytes"].map((metric) => [
                metric,
                budget[metric] -
                    transportDelta(budget, metric) -
                    preparationDelta(budget, metric),
            ])
        );
    const transportEvidence = require("../docs/evidence/media-companion-transport-size-20261030.json");
    assert(Object.isFrozen(MEDIA_COMPANION_TRANSPORT_ALLOWANCE));
    assert.deepEqual(
        MEDIA_COMPANION_TRANSPORT_ALLOWANCE,
        transportEvidence.allowance
    );
    assert.deepEqual(transportEvidence.toolchain, {
        node: "22.23.4",
        zlib: "1.3.1-e00f703",
    });
    assert.match(transportEvidence.baseline.revision, /^[a-f0-9]{40}$/);
    assert.match(transportEvidence.lockSha256, /^[a-f0-9]{64}$/);
    assert.equal(
        transportEvidence.candidate.allRecordedArtifactHashesAndSizesReverified,
        true
    );
    assert.deepEqual(
        transportEvidence.modes.map((row) => row.path),
        ARTIFACTS.map((file) =>
            path.posix.join(path.posix.dirname(file), "media-companion.js")
        )
    );
    for (const [name, budget] of Object.entries({
        BASE_TOTAL_BUDGET,
        BUDGET,
        LEGACY_TOTAL_BUDGET,
        OPTIONAL_BUDGET,
        PROVIDER_BUDGET,
        TOTAL_BUDGET,
    })) {
        assert.deepEqual(
            beforePreparationBudget(budget),
            transportEvidence.nextCaps[name]
        );
        assert.deepEqual(
            beforeTransportBudget(budget),
            transportEvidence.previousCaps[name],
            name + " counts transport only in complete payloads"
        );
    }
    assert.deepEqual(
        OPTIONAL_BUDGETS,
        transportEvidence.nextCaps.OPTIONAL_BUDGETS
    );
    assert.deepEqual(
        Object.fromEntries(
            Object.entries(OPTIONAL_BUDGETS).map(([name, budget]) => [
                name,
                beforeTransportBudget(budget),
            ])
        ),
        transportEvidence.previousCaps.OPTIONAL_BUDGETS
    );
    for (const row of transportEvidence.modes) {
        assert.deepEqual(row.before, transportEvidence.baseline.measurement);
        for (const measurement of [row.before, row.after])
            assert.match(measurement.sha256, /^[a-f0-9]{64}$/);
        for (const metric of ["bytes", "gzipBytes"]) {
            assert.equal(
                row.delta[metric],
                row.after[metric] - row.before[metric]
            );
            assert.equal(
                MEDIA_COMPANION_TRANSPORT_ALLOWANCE[metric],
                row.delta[metric] + transportEvidence.reserve[metric]
            );
            assert.equal(
                OPTIONAL_BUDGETS["media-companion"][metric] - row.after[metric],
                transportEvidence.previousCaps.OPTIONAL_BUDGETS[
                    "media-companion"
                ][metric] - row.before[metric],
                "transport preserves previous optional headroom exactly"
            );
        }
    }
    // Preserve the independently measured feature receipts. Historical caps
    // project out both features exactly once; neither allocation masks the other.
    const companionDelta = (budget, metric) =>
        [BUDGET, BASE_TOTAL_BUDGET, LEGACY_TOTAL_BUDGET, TOTAL_BUDGET].includes(
            budget
        )
            ? MEDIA_COMPANION_ENTRY_ALLOWANCE[metric] +
              ([BASE_TOTAL_BUDGET, TOTAL_BUDGET].includes(budget)
                  ? MEDIA_COMPANION_OPTIONAL_ALLOWANCE[metric] +
                    MEDIA_COMPANION_SETTINGS_ALLOWANCE[metric]
                  : 0)
            : budget === OPTIONAL_BUDGETS["remote-settings-lifecycle"]
              ? MEDIA_COMPANION_SETTINGS_ALLOWANCE[metric]
              : 0;
    const beforeCompanionBudget = (budget) =>
        Object.fromEntries(
            ["bytes", "gzipBytes"].map((metric) => [
                metric,
                budget[metric] -
                    companionDelta(budget, metric) -
                    transportDelta(budget, metric) -
                    preparationDelta(budget, metric),
            ])
        );
    const modernDelta = (budget, metric) => {
        if (budget === BUDGET || budget === LEGACY_TOTAL_BUDGET)
            return MODERN_INTERFACE_ENTRY_ALLOWANCE[metric];
        if (budget === BASE_TOTAL_BUDGET || budget === TOTAL_BUDGET)
            return (
                MODERN_INTERFACE_ENTRY_ALLOWANCE[metric] +
                MODERN_INTERFACE_OPTIONAL_ALLOWANCE[metric] +
                Object.values(MODERN_INTERFACE_RELATED_ALLOWANCES).reduce(
                    (sum, allowance) => sum + allowance[metric],
                    0
                )
            );
        const related = Object.entries(
            MODERN_INTERFACE_RELATED_ALLOWANCES
        ).find(([name]) => budget === OPTIONAL_BUDGETS[name]);
        return related ? related[1][metric] : 0;
    };
    const beforeModernBudget = (budget) =>
        Object.fromEntries(
            ["bytes", "gzipBytes"].map((metric) => [
                metric,
                budget[metric] -
                    modernDelta(budget, metric) -
                    transportDelta(budget, metric) -
                    preparationDelta(budget, metric),
            ])
        );
    const beforeFeaturesBudget = (budget) =>
        Object.fromEntries(
            ["bytes", "gzipBytes"].map((metric) => [
                metric,
                budget[metric] -
                    companionDelta(budget, metric) -
                    modernDelta(budget, metric) -
                    transportDelta(budget, metric) -
                    preparationDelta(budget, metric),
            ])
        );
    const historicalOptionalBudgets = Object.fromEntries(
        Object.entries(OPTIONAL_BUDGETS)
            .filter(
                ([name]) =>
                    name !== "media-companion" && name !== "modern-interface"
            )
            .map(([name, budget]) => [name, beforeFeaturesBudget(budget)])
    );
    const historicalOptionalBundles = Object.fromEntries(
        Object.entries(CLASSIC_OPTIONAL_BUNDLES).filter(
            ([name]) =>
                name !== "media-companion" && name !== "modern-interface"
        )
    );
    const withoutModernOptionalBudgets = Object.fromEntries(
        Object.entries(OPTIONAL_BUDGETS)
            .filter(([name]) => name !== "modern-interface")
            .map(([name, budget]) => [name, beforeModernBudget(budget)])
    );
    const withoutCompanionOptionalBudgets = Object.fromEntries(
        Object.entries(OPTIONAL_BUDGETS)
            .filter(([name]) => name !== "media-companion")
            .map(([name, budget]) => [name, beforeCompanionBudget(budget)])
    );
    const companionEvidence = require("../docs/evidence/media-companion-size-20261030.json");
    assert.deepEqual(
        MEDIA_COMPANION_ENTRY_ALLOWANCE,
        companionEvidence.allowances.entry
    );
    assert.deepEqual(
        MEDIA_COMPANION_OPTIONAL_ALLOWANCE,
        companionEvidence.allowances.optional
    );
    assert(Object.isFrozen(MEDIA_COMPANION_ENTRY_ALLOWANCE));
    assert(Object.isFrozen(MEDIA_COMPANION_OPTIONAL_ALLOWANCE));
    assert(Object.isFrozen(MEDIA_COMPANION_SETTINGS_ALLOWANCE));
    assert.deepEqual(
        MEDIA_COMPANION_SETTINGS_ALLOWANCE,
        companionEvidence.allowances.settings
    );
    assert.deepEqual(
        beforeTransportBudget(OPTIONAL_BUDGETS["media-companion"]),
        MEDIA_COMPANION_OPTIONAL_ALLOWANCE
    );
    assert.deepEqual(companionEvidence.toolchain, {
        node: "22.23.4",
        zlib: "1.3.1-e00f703",
    });
    assert.equal(companionEvidence.baseline.sourceRevisionAtBuild, null);
    assert.equal(companionEvidence.candidate.sourceRevisionAtBuild, null);
    assert.equal(
        companionEvidence.candidate.allArtifactHashesAndSizesReverified,
        true
    );
    assert.match(companionEvidence.baseline.revision, /^[a-f0-9]{40}$/);
    assert.match(companionEvidence.baseline.reportSha256, /^[a-f0-9]{64}$/);
    assert.match(companionEvidence.candidate.reportSha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(
        historicalOptionalBudgets,
        companionEvidence.previousCaps.OPTIONAL_BUDGETS
    );
    assert.deepEqual(
        withoutModernOptionalBudgets,
        companionEvidence.nextCaps.OPTIONAL_BUDGETS
    );
    for (const [name, budget] of Object.entries({
        BASE_TOTAL_BUDGET,
        BUDGET,
        LEGACY_TOTAL_BUDGET,
        OPTIONAL_BUDGET,
        PROVIDER_BUDGET,
        TOTAL_BUDGET,
    })) {
        assert.deepEqual(
            beforeModernBudget(budget),
            companionEvidence.nextCaps[name]
        );
        assert.deepEqual(
            beforeFeaturesBudget(budget),
            companionEvidence.previousCaps[name],
            name + " counts companion cost once"
        );
    }
    assert.deepEqual(
        companionEvidence.modes.map((mode) => mode.path),
        ARTIFACTS
    );
    for (const metric of ["bytes", "gzipBytes"]) {
        const observedEntry = Math.max(
            ...companionEvidence.modes.map((mode) => mode.delta.entry[metric])
        );
        const observedOptional = Math.max(
            ...companionEvidence.modes.map(
                (mode) =>
                    mode.components.find(
                        (row) => row.name === "media-companion.js"
                    ).after[metric]
            )
        );
        assert.equal(companionEvidence.observed.entry[metric], observedEntry);
        assert.equal(
            companionEvidence.observed.optional[metric],
            observedOptional
        );
        const observedSettings = Math.max(
            ...companionEvidence.modes.map(
                (mode) =>
                    mode.components.find(
                        (row) => row.name === "remote-settings-lifecycle.js"
                    ).delta[metric]
            )
        );
        assert.equal(
            MEDIA_COMPANION_SETTINGS_ALLOWANCE[metric],
            observedSettings + companionEvidence.reserve.settings[metric]
        );
        assert.equal(
            MEDIA_COMPANION_ENTRY_ALLOWANCE[metric],
            observedEntry + companionEvidence.reserve.entry[metric]
        );
        assert.equal(
            MEDIA_COMPANION_OPTIONAL_ALLOWANCE[metric],
            observedOptional + companionEvidence.reserve.optional[metric]
        );
    }
    for (const mode of companionEvidence.modes) {
        assert.equal(
            mode.components.length,
            1 +
                Object.keys(CLASSIC_PROVIDER_BUNDLES).filter(
                    (name) => name !== "torrent"
                ).length +
                Object.keys(CLASSIC_OPTIONAL_BUNDLES).filter(
                    (name) => name !== "modern-interface"
                ).length
        );
        for (const row of mode.components) {
            assert.match(row.after.sha256, /^[a-f0-9]{64}$/);
            if (row.name === "media-companion.js")
                assert.equal(row.before, null);
            else if (
                row.family !== "entry" &&
                row.name !== "remote-settings-lifecycle.js"
            )
                assert.deepEqual(
                    row.before,
                    row.after,
                    row.name + " remains byte-identical"
                );
            for (const metric of ["bytes", "gzipBytes"])
                assert.equal(
                    row.delta[metric],
                    row.after[metric] - (row.before ? row.before[metric] : 0)
                );
        }
        for (const metric of ["bytes", "gzipBytes"]) {
            assert.equal(mode.delta.legacy[metric], mode.delta.entry[metric]);
            assert.equal(
                mode.after.total[metric],
                mode.components.reduce((sum, row) => sum + row.after[metric], 0)
            );
            assert.equal(
                mode.delta.total[metric],
                mode.delta.entry[metric] +
                    mode.components.find(
                        (row) => row.name === "media-companion.js"
                    ).after[metric] +
                    mode.components.find(
                        (row) => row.name === "remote-settings-lifecycle.js"
                    ).delta[metric]
            );
            assert(
                beforeModernBudget(TOTAL_BUDGET)[metric] -
                    mode.after.total[metric] >=
                    companionEvidence.previousCaps.TOTAL_BUDGET[metric] -
                        mode.before.total[metric]
            );
        }
    }
    const modernEvidence = require("../docs/evidence/modern-interface-size-20261030.json");
    for (const [name, allowance] of Object.entries({
        entry: MODERN_INTERFACE_ENTRY_ALLOWANCE,
        optional: MODERN_INTERFACE_OPTIONAL_ALLOWANCE,
        related: MODERN_INTERFACE_RELATED_ALLOWANCES,
    })) {
        assert(Object.isFrozen(allowance));
        assert.deepEqual(allowance, modernEvidence.allowances[name]);
    }
    assert.deepEqual(modernEvidence.toolchain, {
        node: "22.23.4",
        zlib: "1.3.1-e00f703",
    });
    for (const [name, budget] of Object.entries({
        BASE_TOTAL_BUDGET,
        BUDGET,
        LEGACY_TOTAL_BUDGET,
        TOTAL_BUDGET,
    })) {
        assert.deepEqual(
            beforeCompanionBudget(budget),
            modernEvidence.nextCaps[name]
        );
        assert.deepEqual(
            beforeFeaturesBudget(budget),
            modernEvidence.previousCaps[name],
            name + " counts each Modern component exactly once"
        );
    }
    assert.deepEqual(
        historicalOptionalBudgets,
        modernEvidence.previousCaps.OPTIONAL_BUDGETS
    );
    assert.deepEqual(
        withoutCompanionOptionalBudgets,
        modernEvidence.nextCaps.OPTIONAL_BUDGETS
    );
    assert.deepEqual(
        OPTIONAL_BUDGETS["modern-interface"],
        MODERN_INTERFACE_OPTIONAL_ALLOWANCE
    );
    for (const [source, optionalNames] of [
        [modernEvidence.baseline, Object.keys(historicalOptionalBundles)],
        [
            modernEvidence.candidate,
            Object.keys(CLASSIC_OPTIONAL_BUNDLES).filter(
                (name) => name !== "media-companion"
            ),
        ],
    ]) {
        assert.match(source.head, /^[a-f0-9]{40}$/);
        assert.equal(typeof source.trackedSourceClean, "boolean");
        const expectedPaths = ARTIFACTS.flatMap((file) => [
            file,
            ...Object.keys(CLASSIC_PROVIDER_BUNDLES)
                .filter((name) => name !== "torrent")
                .map((name) =>
                    path.posix.join(
                        path.posix.dirname(file),
                        "provider-" + name + ".js"
                    )
                ),
            ...optionalNames.map((name) =>
                path.posix.join(path.posix.dirname(file), name + ".js")
            ),
        ]).sort();
        assert.deepEqual(
            source.measurements.map((row) => row.path).sort(),
            expectedPaths
        );
        for (const row of source.measurements) {
            assert.match(row.sha256, /^[a-f0-9]{64}$/);
            for (const metric of ["bytes", "gzipBytes"])
                assert(Number.isSafeInteger(row[metric]) && row[metric] > 0);
        }
    }
    for (const file of ARTIFACTS) {
        const directory = path.posix.dirname(file);
        const before = modernEvidence.baseline.measurements.filter(
            (row) => path.posix.dirname(row.path) === directory
        );
        const after = modernEvidence.candidate.measurements.filter(
            (row) => path.posix.dirname(row.path) === directory
        );
        const renderer = after.find(
            (row) => path.posix.basename(row.path) === "modern-interface.js"
        );
        const entryBefore = before.find((row) => row.path === file);
        const entryAfter = after.find((row) => row.path === file);
        assert(renderer && entryBefore && entryAfter);
        for (const metric of ["bytes", "gzipBytes"]) {
            assert(
                renderer[metric] <= MODERN_INTERFACE_OPTIONAL_ALLOWANCE[metric]
            );
            assert(entryAfter[metric] <= beforeCompanionBudget(BUDGET)[metric]);
            assert(
                entryAfter[metric] - entryBefore[metric] <=
                    MODERN_INTERFACE_ENTRY_ALLOWANCE[metric]
            );
            const completeBefore = before.reduce(
                (sum, row) => sum + row[metric],
                0
            );
            const completeAfter = after.reduce(
                (sum, row) => sum + row[metric],
                0
            );
            assert(
                completeAfter <= beforeCompanionBudget(TOTAL_BUDGET)[metric]
            );
            assert(
                beforeCompanionBudget(TOTAL_BUDGET)[metric] - completeAfter >=
                    modernEvidence.previousCaps.TOTAL_BUDGET[metric] -
                        completeBefore,
                file + " preserves pre-Modern complete payload headroom"
            );
            for (const [name, allowance] of Object.entries(
                MODERN_INTERFACE_RELATED_ALLOWANCES
            )) {
                const oldRow = before.find(
                    (row) => path.posix.basename(row.path) === name + ".js"
                );
                const newRow = after.find(
                    (row) => path.posix.basename(row.path) === name + ".js"
                );
                assert(oldRow && newRow);
                assert(
                    newRow[metric] - oldRow[metric] <= allowance[metric],
                    name + " has a bounded Modern increment"
                );
                assert(
                    newRow[metric] <=
                        withoutCompanionOptionalBudgets[name][metric]
                );
            }
        }
    }
    const tizenPackageBootDelta = (budget, metric) =>
        companionDelta(budget, metric) +
        modernDelta(budget, metric) +
        transportDelta(budget, metric) +
        preparationDelta(budget, metric) +
        ([
            BUDGET,
            BASE_TOTAL_BUDGET,
            LEGACY_TOTAL_BUDGET,
            TOTAL_BUDGET,
        ].includes(budget)
            ? TIZEN_PACKAGE_BOOT_ALLOWANCE[metric]
            : 0);
    const beforeTizenPackageBootBudget = (budget) =>
        Object.fromEntries(
            ["bytes", "gzipBytes"].map((metric) => [
                metric,
                budget[metric] - tizenPackageBootDelta(budget, metric),
            ])
        );
    const tizenEvidence = require("../docs/evidence/tizen-package-boot-size-20261030.json");
    assert(Object.isFrozen(TIZEN_PACKAGE_BOOT_ALLOWANCE));
    assert.deepEqual(TIZEN_PACKAGE_BOOT_ALLOWANCE, tizenEvidence.allowance);
    assert.deepEqual(tizenEvidence.sourceIdentityReserve, {
        bytes: 0,
        gzipBytes: 20,
    });
    assert.equal(tizenEvidence.version, "1.1.62");
    assert.deepEqual(tizenEvidence.toolchain, {
        node: "22.23.4",
        zlib: "1.3.1-e00f703",
    });
    assert.match(tizenEvidence.lockSha256, /^[a-f0-9]{64}$/);
    const tizenComponentCount =
        1 +
        Object.keys(CLASSIC_PROVIDER_BUNDLES).filter(
            (name) => name !== "torrent"
        ).length +
        Object.keys(historicalOptionalBundles).length;
    for (const source of [tizenEvidence.baseline, tizenEvidence.candidate]) {
        assert.match(source.head, /^[a-f0-9]{40}$/);
        assert.match(source.reportSha256, /^[a-f0-9]{64}$/);
        assert.equal(source.sourceRevisionAtBuild, source.head);
        assert.equal(source.trackedSourceClean, true);
        assert.equal(source.allArtifactHashesAndSizesReverified, true);
        assert.equal(
            source.artifactCount,
            ARTIFACTS.length * tizenComponentCount
        );
        assert.deepEqual(
            source.sourceStamps,
            ARTIFACTS.map((file) => ({
                path: file,
                sourceRevision: source.head,
            }))
        );
    }
    assert.notEqual(tizenEvidence.baseline.head, tizenEvidence.candidate.head);
    assert.equal(tizenEvidence.baseline.buildExitCode, 0);
    assert.equal(tizenEvidence.candidate.buildExitCode, 0);
    assert.equal(tizenEvidence.candidate.complete, true);
    assert.deepEqual(tizenEvidence.candidate.inputErrors, []);
    assert.deepEqual(tizenEvidence.candidate.sizeViolations, []);
    for (const [name, budget] of Object.entries({
        BASE_TOTAL_BUDGET,
        BUDGET,
        LEGACY_TOTAL_BUDGET,
        OPTIONAL_BUDGET,
        PROVIDER_BUDGET,
        TOTAL_BUDGET,
    })) {
        assert.deepEqual(
            beforeFeaturesBudget(budget),
            tizenEvidence.nextCaps[name]
        );
        assert.deepEqual(
            beforeTizenPackageBootBudget(budget),
            tizenEvidence.previousCaps[name],
            name + " counts the Tizen entry allowance exactly once"
        );
    }
    assert.deepEqual(
        historicalOptionalBudgets,
        tizenEvidence.previousCaps.OPTIONAL_BUDGETS
    );
    assert.deepEqual(
        historicalOptionalBudgets,
        tizenEvidence.nextCaps.OPTIONAL_BUDGETS
    );
    assert.deepEqual(
        tizenEvidence.modes.map((mode) => mode.path),
        ARTIFACTS
    );
    for (const mode of tizenEvidence.modes) {
        assert.equal(mode.components.length, tizenComponentCount);
        assert.deepEqual(
            mode.components.map((row) => [row.family, row.name]),
            [
                ["entry", "player.js"],
                ...Object.keys(CLASSIC_PROVIDER_BUNDLES)
                    .filter((name) => name !== "torrent")
                    .map((name) => ["providers", "provider-" + name + ".js"]),
                ...Object.keys(historicalOptionalBundles).map((name) => [
                    "optionalAssets",
                    name + ".js",
                ]),
            ]
        );
        assert.deepEqual(
            mode.components
                .filter((row) => row.before.sha256 !== row.after.sha256)
                .map((row) => row.name),
            ["player.js"]
        );
        for (const row of mode.components) {
            assert.equal(
                row.before.path,
                path.posix.join(path.posix.dirname(mode.path), row.name)
            );
            assert.equal(row.after.path, row.before.path);
            for (const value of [row.before, row.after]) {
                assert.match(value.sha256, /^[a-f0-9]{64}$/);
                assert(Number.isSafeInteger(value.bytes) && value.bytes > 0);
                assert(
                    Number.isSafeInteger(value.gzipBytes) && value.gzipBytes > 0
                );
            }
            if (row.family !== "entry") assert.deepEqual(row.after, row.before);
            for (const metric of ["bytes", "gzipBytes"])
                assert.equal(
                    row.after[metric] - row.before[metric],
                    row.delta[metric]
                );
        }
        for (const metric of ["bytes", "gzipBytes"]) {
            for (const [name, rows] of [
                [
                    "legacyTotal",
                    mode.components.filter(
                        (row) => row.family !== "optionalAssets"
                    ),
                ],
                ["completeTotal", mode.components],
            ]) {
                for (const version of ["before", "after"])
                    assert.equal(
                        rows.reduce(
                            (sum, row) => sum + row[version][metric],
                            0
                        ),
                        mode[version][name][metric]
                    );
                assert.equal(
                    rows.reduce((sum, row) => sum + row.delta[metric], 0),
                    mode.delta[name][metric]
                );
            }
            for (const [name, before, after] of [
                ["BUDGET", mode.components[0].before, mode.components[0].after],
                [
                    "LEGACY_TOTAL_BUDGET",
                    mode.before.legacyTotal,
                    mode.after.legacyTotal,
                ],
                [
                    "BASE_TOTAL_BUDGET",
                    mode.before.completeTotal,
                    mode.after.completeTotal,
                ],
                [
                    "TOTAL_BUDGET",
                    mode.before.completeTotal,
                    mode.after.completeTotal,
                ],
            ]) {
                // BASE excludes the separately allocated local compatibility payload.
                if (name !== "BASE_TOTAL_BUDGET") {
                    assert(
                        after[metric] <= tizenEvidence.nextCaps[name][metric]
                    );
                    assert(
                        after[metric] <=
                            tizenEvidence.candidate.budgetsAtBuild[name][
                                metric
                            ],
                        "recorded candidate was already a successful production build"
                    );
                }
                assert(
                    tizenEvidence.nextCaps[name][metric] - after[metric] >=
                        tizenEvidence.previousCaps[name][metric] -
                            before[metric],
                    name + " preserves pre-Tizen headroom"
                );
            }
        }
    }
    for (const metric of ["bytes", "gzipBytes"])
        assert.equal(
            TIZEN_PACKAGE_BOOT_ALLOWANCE[metric],
            Math.max(
                ...tizenEvidence.modes.map(
                    (mode) => mode.components[0].delta[metric]
                )
            ) + tizenEvidence.sourceIdentityReserve[metric]
        );
    const categoryNavigationDelta = (budget, metric) =>
        budget === OPTIONAL_BUDGETS["favorites-transfer"] ||
        budget === historicalOptionalBudgets["favorites-transfer"]
            ? CATEGORY_NAVIGATION_FAVORITES_ALLOWANCE[metric]
            : CATEGORY_NAVIGATION_ENTRY_ALLOWANCE[metric] +
              (budget === BASE_TOTAL_BUDGET || budget === TOTAL_BUDGET
                  ? CATEGORY_NAVIGATION_FAVORITES_ALLOWANCE[metric]
                  : 0);
    const beforeCategoryNavigationBudget = (budget) =>
        Object.fromEntries(
            ["bytes", "gzipBytes"].map((metric) => [
                metric,
                beforeTizenPackageBootBudget(budget)[metric] -
                    categoryNavigationDelta(budget, metric),
            ])
        );
    const navigationEvidence = require("../docs/evidence/category-navigation-size-20261029.json");
    for (const [name, allowance] of Object.entries({
        entry: CATEGORY_NAVIGATION_ENTRY_ALLOWANCE,
        favoritesTransfer: CATEGORY_NAVIGATION_FAVORITES_ALLOWANCE,
    })) {
        assert(Object.isFrozen(allowance));
        assert.deepEqual(allowance, navigationEvidence.allowances[name]);
    }
    assert.deepEqual(navigationEvidence.sourceIdentityReserve, {
        bytes: 0,
        gzipBytes: 20,
    });
    assert.equal(navigationEvidence.version, "1.1.62");
    assert.deepEqual(navigationEvidence.toolchain, {
        node: "22.23.4",
        zlib: "1.3.1-e00f703",
    });
    for (const source of [
        navigationEvidence.baseline,
        navigationEvidence.candidate,
    ]) {
        assert.match(source.head, /^[a-f0-9]{40}$/);
        assert.equal(source.sourceRevisionAtBuild, source.head);
        assert.equal(source.trackedSourceClean, true);
        assert.equal(source.allArtifactHashesAndSizesReverified, true);
    }
    assert.equal(navigationEvidence.baseline.buildExitCode, 0);
    assert.equal(navigationEvidence.candidate.buildExitCode, 1);
    assert.equal(navigationEvidence.candidate.complete, true);
    assert.equal(navigationEvidence.candidate.sizeViolations.length, 6);
    assert.deepEqual(navigationEvidence.candidate.inputErrors, []);
    for (const [name, budget] of Object.entries({
        BASE_TOTAL_BUDGET,
        BUDGET,
        LEGACY_TOTAL_BUDGET,
        TOTAL_BUDGET,
    })) {
        assert.deepEqual(
            beforeTizenPackageBootBudget(budget),
            navigationEvidence.nextCaps[name]
        );
        assert.deepEqual(
            beforeCategoryNavigationBudget(budget),
            navigationEvidence.previousCaps[name],
            name + " counts each navigation component once"
        );
    }
    assert.deepEqual(
        PROVIDER_BUDGET,
        navigationEvidence.previousCaps.PROVIDER_BUDGET
    );
    assert.deepEqual(
        OPTIONAL_BUDGET,
        navigationEvidence.previousCaps.OPTIONAL_BUDGET
    );
    assert.deepEqual(
        historicalOptionalBudgets,
        navigationEvidence.nextCaps.OPTIONAL_BUDGETS
    );
    for (const [name, budget] of Object.entries(historicalOptionalBudgets))
        assert.deepEqual(
            name === "favorites-transfer"
                ? beforeCategoryNavigationBudget(budget)
                : budget,
            navigationEvidence.previousCaps.OPTIONAL_BUDGETS[name]
        );
    assert.deepEqual(
        navigationEvidence.modes.map((mode) => mode.path),
        ARTIFACTS
    );
    for (const mode of navigationEvidence.modes) {
        assert.equal(
            mode.components.filter((row) => row.family === "entry").length,
            1
        );
        assert.equal(
            mode.components.filter((row) => row.family === "providers").length,
            Object.keys(CLASSIC_PROVIDER_BUNDLES).filter(
                (name) => name !== "torrent"
            ).length
        );
        assert.equal(
            mode.components.filter((row) => row.family === "optionalAssets")
                .length,
            Object.keys(historicalOptionalBundles).length
        );
        assert.deepEqual(
            mode.components
                .filter((row) => row.before.sha256 !== row.after.sha256)
                .map((row) => row.name)
                .sort(),
            ["favorites-transfer.js", "player.js"]
        );
        for (const metric of ["bytes", "gzipBytes"]) {
            for (const row of mode.components) {
                assert.equal(
                    row.after[metric] - row.before[metric],
                    row.delta[metric]
                );
                if (row.name === "favorites-transfer.js")
                    assert.equal(
                        row.delta[metric],
                        CATEGORY_NAVIGATION_FAVORITES_ALLOWANCE[metric]
                    );
                else if (row.name !== "player.js")
                    assert.equal(row.delta[metric], 0);
            }
            for (const [name, components] of [
                [
                    "legacyTotal",
                    mode.components.filter(
                        (row) => row.family !== "optionalAssets"
                    ),
                ],
                ["completeTotal", mode.components],
            ]) {
                for (const version of ["before", "after"])
                    assert.equal(
                        components.reduce(
                            (sum, row) => sum + row[version][metric],
                            0
                        ),
                        mode[version][name][metric]
                    );
                assert.equal(
                    components.reduce((sum, row) => sum + row.delta[metric], 0),
                    mode.delta[name][metric],
                    "each emitted component counted once"
                );
            }
            for (const [name, before, after, budget] of [
                [
                    "BUDGET",
                    mode.components[0].before,
                    mode.components[0].after,
                    BUDGET,
                ],
                [
                    "LEGACY_TOTAL_BUDGET",
                    mode.before.legacyTotal,
                    mode.after.legacyTotal,
                    LEGACY_TOTAL_BUDGET,
                ],
                [
                    "BASE_TOTAL_BUDGET",
                    mode.before.completeTotal,
                    mode.after.completeTotal,
                    BASE_TOTAL_BUDGET,
                ],
                [
                    "TOTAL_BUDGET",
                    mode.before.completeTotal,
                    mode.after.completeTotal,
                    TOTAL_BUDGET,
                ],
            ])
                assert(
                    beforeTizenPackageBootBudget(budget)[metric] -
                        after[metric] >=
                        navigationEvidence.previousCaps[name][metric] -
                            before[metric],
                    name + " preserves pre-navigation headroom"
                );
        }
    }
    for (const metric of ["bytes", "gzipBytes"])
        assert.equal(
            CATEGORY_NAVIGATION_ENTRY_ALLOWANCE[metric],
            Math.max(
                ...navigationEvidence.modes.map(
                    (mode) => mode.components[0].delta[metric]
                )
            ) + navigationEvidence.sourceIdentityReserve[metric]
        );
    const stbPlayerDelta = (budget, metric) =>
        budget === OPTIONAL_BUDGETS["favorites-transfer"] ||
        budget === historicalOptionalBudgets["favorites-transfer"]
            ? STB_PLAYER_FAVORITES_ALLOWANCE[metric]
            : STB_PLAYER_ENTRY_ALLOWANCE[metric] +
              (budget === BUDGET
                  ? 0
                  : STB_PLAYER_STALKER_ALLOWANCE[metric] +
                    STB_PLAYER_XTREAM_ALLOWANCE[metric]) +
              (budget === BASE_TOTAL_BUDGET || budget === TOTAL_BUDGET
                  ? STB_PLAYER_FAVORITES_ALLOWANCE[metric]
                  : 0);
    const beforeStbPlayerBudget = (budget) =>
        Object.fromEntries(
            ["bytes", "gzipBytes"].map((metric) => [
                metric,
                budget[metric] -
                    tizenPackageBootDelta(budget, metric) -
                    categoryNavigationDelta(budget, metric) -
                    stbPlayerDelta(budget, metric),
            ])
        );
    const stbEvidence = require("../docs/evidence/stb-player-improvements-size-20261029.json");
    for (const [name, allowance] of Object.entries({
        entry: STB_PLAYER_ENTRY_ALLOWANCE,
        favoritesTransfer: STB_PLAYER_FAVORITES_ALLOWANCE,
        stalker: STB_PLAYER_STALKER_ALLOWANCE,
        xtream: STB_PLAYER_XTREAM_ALLOWANCE,
    })) {
        assert(Object.isFrozen(allowance));
        assert.deepEqual(allowance, stbEvidence.allowances[name]);
    }
    assert.deepEqual(stbEvidence.sourceIdentityReserve, {
        bytes: 0,
        gzipBytes: 20,
    });
    assert.equal(stbEvidence.baseline.sourceRevisionAtBuild, null);
    assert.equal(stbEvidence.candidate.sourceRevisionAtBuild, null);
    assert.equal(stbEvidence.baseline.buildExitCode, 0);
    assert.equal(stbEvidence.candidate.buildExitCode, 0);
    assert.equal(stbEvidence.candidate.sizeViolations, 0);
    assert.equal(stbEvidence.resolverCandidate.sizeViolations, 3);
    assert.equal(stbEvidence.initialCandidate.sizeViolations, 24);
    assert.equal(
        stbEvidence.candidate.dependencySymlinkExcludedFromStatus,
        false
    );
    assert.equal(
        stbEvidence.resolverCandidate.changesSinceInitial.length,
        ARTIFACTS.length
    );
    for (const change of stbEvidence.resolverCandidate.changesSinceInitial) {
        assert.equal(path.basename(change.path), "provider-stalker.js");
        assert.deepEqual(change.delta, { bytes: 252, gzipBytes: 89 });
        const hostedChange =
            stbEvidence.hostedCandidate.changesSincePrevious.find(
                (row) => row.path === change.path
            );
        assert.deepEqual(change.after, hostedChange.before);
        for (const metric of ["bytes", "gzipBytes"])
            assert.equal(
                change.after[metric] - change.before[metric],
                change.delta[metric]
            );
    }
    assert.equal(
        stbEvidence.candidate.changesSinceResolver.length,
        ARTIFACTS.length
    );
    for (const change of stbEvidence.candidate.changesSinceResolver) {
        assert.equal(path.basename(change.path), "favorites-transfer.js");
        assert.deepEqual(change.delta, { bytes: 107, gzipBytes: -10 });
        const component = stbEvidence.modes
            .flatMap((mode) => mode.components)
            .find((row) => row.after.path === change.path);
        assert.deepEqual(change.after, component.after);
        for (const metric of ["bytes", "gzipBytes"])
            assert.equal(
                change.after[metric] - change.before[metric],
                change.delta[metric]
            );
    }
    assert.deepEqual(stbEvidence.candidate.inputErrors, []);
    assert.equal(stbEvidence.hostedCandidate.initialSizeViolations, 9);
    assert.deepEqual(stbEvidence.hostedCandidate.inputErrors, []);
    assert.equal(
        stbEvidence.hostedCandidate.changesSincePrevious.length,
        ARTIFACTS.length * 2
    );
    for (const change of stbEvidence.hostedCandidate.changesSincePrevious) {
        assert(
            ["player.js", "provider-stalker.js"].includes(
                path.basename(change.path)
            )
        );
        const component = stbEvidence.modes
            .flatMap((mode) => mode.components)
            .find((row) => row.after.path === change.path);
        assert.deepEqual(change.after, component.after);
        for (const metric of ["bytes", "gzipBytes"])
            assert.equal(
                change.after[metric] - change.before[metric],
                change.delta[metric]
            );
    }
    assert.equal(
        stbEvidence.baseline.allArtifactHashesAndSizesReverified,
        true
    );
    assert.equal(
        stbEvidence.candidate.allArtifactHashesAndSizesReverified,
        true
    );
    for (const [name, budget] of Object.entries({
        BASE_TOTAL_BUDGET,
        BUDGET,
        LEGACY_TOTAL_BUDGET,
        TOTAL_BUDGET,
    })) {
        assert.deepEqual(
            beforeCategoryNavigationBudget(budget),
            stbEvidence.nextCaps[name]
        );
        assert.deepEqual(
            beforeStbPlayerBudget(budget),
            stbEvidence.previousCaps[name]
        );
    }
    assert.deepEqual(PROVIDER_BUDGET, stbEvidence.previousCaps.PROVIDER_BUDGET);
    assert.deepEqual(OPTIONAL_BUDGET, stbEvidence.previousCaps.OPTIONAL_BUDGET);
    assert.deepEqual(
        Object.fromEntries(
            Object.entries(historicalOptionalBudgets).map(([name, budget]) => [
                name,
                name === "favorites-transfer"
                    ? beforeCategoryNavigationBudget(budget)
                    : budget,
            ])
        ),
        stbEvidence.nextCaps.OPTIONAL_BUDGETS
    );
    for (const [name, budget] of Object.entries(historicalOptionalBudgets))
        assert.deepEqual(
            name === "favorites-transfer"
                ? beforeStbPlayerBudget(budget)
                : budget,
            stbEvidence.previousCaps.OPTIONAL_BUDGETS[name]
        );
    assert.deepEqual(
        stbEvidence.modes.map((mode) => mode.path),
        ARTIFACTS
    );
    for (const mode of stbEvidence.modes) {
        assert.equal(
            mode.components.filter((row) => row.family === "entry").length,
            1
        );
        assert.equal(
            mode.components.filter((row) => row.family === "providers").length,
            Object.keys(CLASSIC_PROVIDER_BUNDLES).filter(
                (name) => name !== "torrent"
            ).length
        );
        assert.equal(
            mode.components.filter((row) => row.family === "optionalAssets")
                .length,
            Object.keys(historicalOptionalBundles).length
        );
        assert.deepEqual(
            mode.components
                .filter((row) => row.before.sha256 !== row.after.sha256)
                .map((row) => row.name)
                .sort(),
            [
                "favorites-transfer.js",
                "player.js",
                "provider-stalker.js",
                "provider-xtream.js",
            ]
        );
        for (const metric of ["bytes", "gzipBytes"]) {
            for (const row of mode.components) {
                assert.equal(
                    row.after[metric] - row.before[metric],
                    row.delta[metric]
                );
                const allowance = {
                    "favorites-transfer.js": STB_PLAYER_FAVORITES_ALLOWANCE,
                    "player.js": STB_PLAYER_ENTRY_ALLOWANCE,
                    "provider-stalker.js": STB_PLAYER_STALKER_ALLOWANCE,
                    "provider-xtream.js": STB_PLAYER_XTREAM_ALLOWANCE,
                }[row.name];
                if (row.name === "player.js")
                    assert(row.delta[metric] <= allowance[metric]);
                else if (allowance)
                    assert.equal(row.delta[metric], allowance[metric]);
                else assert.equal(row.delta[metric], 0);
            }
            assert.equal(
                mode.components
                    .filter((row) => row.family !== "optionalAssets")
                    .reduce((sum, row) => sum + row.delta[metric], 0),
                mode.delta.legacyTotal[metric]
            );
            assert.equal(
                mode.components.reduce(
                    (sum, row) => sum + row.delta[metric],
                    0
                ),
                mode.delta.completeTotal[metric]
            );
            for (const [name, before, after, budget] of [
                [
                    "BUDGET",
                    mode.components[0].before,
                    mode.components[0].after,
                    BUDGET,
                ],
                [
                    "LEGACY_TOTAL_BUDGET",
                    mode.before.legacyTotal,
                    mode.after.legacyTotal,
                    LEGACY_TOTAL_BUDGET,
                ],
                [
                    "BASE_TOTAL_BUDGET",
                    mode.before.completeTotal,
                    mode.after.completeTotal,
                    BASE_TOTAL_BUDGET,
                ],
                [
                    "TOTAL_BUDGET",
                    mode.before.completeTotal,
                    mode.after.completeTotal,
                    TOTAL_BUDGET,
                ],
            ])
                assert(
                    beforeTizenPackageBootBudget(budget)[metric] -
                        after[metric] >=
                        stbEvidence.previousCaps[name][metric] - before[metric],
                    name + " preserves prior headroom"
                );
        }
    }
    for (const metric of ["bytes", "gzipBytes"])
        assert.equal(
            STB_PLAYER_ENTRY_ALLOWANCE[metric],
            Math.max(
                ...stbEvidence.modes.map(
                    (mode) => mode.components[0].delta[metric]
                )
            ) + stbEvidence.sourceIdentityReserve[metric]
        );
    const categoryDelta = (budget, metric) =>
        CATEGORY_SELECTION_ENTRY_ALLOWANCE[metric] +
        (budget === BASE_TOTAL_BUDGET || budget === TOTAL_BUDGET
            ? CATEGORY_SELECTION_FAVORITES_ALLOWANCE[metric]
            : 0);
    const categoryOptionalDelta = (name, metric) =>
        name === "favorites-transfer"
            ? CATEGORY_SELECTION_FAVORITES_ALLOWANCE[metric]
            : 0;
    const presenceDelta = (budget, metric) =>
        PLAYER_PRESENCE_ENTRY_ALLOWANCE[metric] +
        (budget === BASE_TOTAL_BUDGET || budget === TOTAL_BUDGET
            ? PLAYER_PRESENCE_TRANSPORT_ALLOWANCE[metric]
            : 0);
    // Preserve historical evidence by subtracting each later entry delta once.
    const sharedFeatureDelta = (budget, metric) =>
        tizenPackageBootDelta(budget, metric) +
        categoryNavigationDelta(budget, metric) +
        stbPlayerDelta(budget, metric) +
        presenceDelta(budget, metric) +
        categoryDelta(budget, metric) +
        CATEGORY_PICKER_ENTRY_ALLOWANCE[metric];
    const beforeSharedFeatureBudget = (budget) =>
        Object.fromEntries(
            ["bytes", "gzipBytes"].map((metric) => [
                metric,
                budget[metric] - sharedFeatureDelta(budget, metric),
            ])
        );
    const beforeSharedFeatureOptional = (
        name,
        budget = OPTIONAL_BUDGETS[name]
    ) =>
        Object.fromEntries(
            ["bytes", "gzipBytes"].map((metric) => [
                metric,
                budget[metric] -
                    companionDelta(budget, metric) -
                    modernDelta(budget, metric) -
                    transportDelta(budget, metric) -
                    preparationDelta(budget, metric) -
                    (name === "control-transport"
                        ? PLAYER_PRESENCE_TRANSPORT_ALLOWANCE[metric]
                        : 0) -
                    (name === "favorites-transfer"
                        ? STB_PLAYER_FAVORITES_ALLOWANCE[metric] +
                          CATEGORY_NAVIGATION_FAVORITES_ALLOWANCE[metric]
                        : 0) -
                    categoryOptionalDelta(name, metric),
            ])
        );
    const presenceEvidence = require("../docs/evidence/player-presence-size-20261029.json");
    for (const [name, allowance] of Object.entries({
        PLAYER_PRESENCE_ENTRY_ALLOWANCE,
        PLAYER_PRESENCE_TRANSPORT_ALLOWANCE,
    })) {
        assert(Object.isFrozen(allowance));
        const evidence = presenceEvidence.allowances[name];
        for (const metric of ["bytes", "gzipBytes"])
            assert.equal(
                allowance[metric],
                (evidence.projectedMaximum || evidence.observed)[metric] +
                    evidence.identityReserve[metric]
            );
    }
    assert.deepEqual(PLAYER_PRESENCE_ENTRY_ALLOWANCE, {
        bytes: 7747,
        gzipBytes: 2609,
    });
    assert.deepEqual(PLAYER_PRESENCE_TRANSPORT_ALLOWANCE, {
        bytes: 27,
        gzipBytes: 10,
    });
    for (const [name, budget] of Object.entries({
        BASE_TOTAL_BUDGET,
        BUDGET,
        LEGACY_TOTAL_BUDGET,
        TOTAL_BUDGET,
    }))
        assert.deepEqual(
            beforeSharedFeatureBudget(budget),
            presenceEvidence.previousCaps[name],
            name + " counts each presence component exactly once"
        );
    assert.deepEqual(
        PROVIDER_BUDGET,
        presenceEvidence.previousCaps.PROVIDER_BUDGET
    );
    assert.deepEqual(
        OPTIONAL_BUDGET,
        presenceEvidence.previousCaps.OPTIONAL_BUDGET
    );
    for (const [name, budget] of Object.entries(historicalOptionalBudgets))
        assert.deepEqual(
            beforeSharedFeatureOptional(name, budget),
            presenceEvidence.previousCaps.OPTIONAL_BUDGETS[name],
            name + " preserves prior optional headroom"
        );
    assert.equal(presenceEvidence.sourceBuild.sourceRevisionAtBuild, null);
    assert.equal(presenceEvidence.sourceBuild.buildExitCode, 1);
    assert.equal(presenceEvidence.sourceBuild.sizeViolations, 18);
    assert.equal(
        presenceEvidence.baseline.allSavedArtifactHashesAndSizesReverified,
        true
    );
    assert.equal(presenceEvidence.modes.length, 3);
    for (const mode of presenceEvidence.modes) {
        assert.equal(
            mode.components.filter((row) => row.family === "providers").length,
            8
        );
        assert.equal(
            mode.components.filter((row) => row.family === "optionalAssets")
                .length,
            13
        );
        for (const row of mode.components) {
            for (const metric of ["bytes", "gzipBytes"])
                assert.equal(
                    row.after[metric] - row.before[metric],
                    row.delta[metric]
                );
            if (
                row.family === "providers" ||
                (row.family === "optionalAssets" &&
                    row.name !== "control-transport.js")
            )
                assert.deepEqual(
                    row.after,
                    row.before,
                    row.name + " bytes unchanged"
                );
        }
        for (const metric of ["bytes", "gzipBytes"]) {
            assert.equal(
                mode.components.reduce(
                    (sum, row) => sum + row.delta[metric],
                    0
                ),
                mode.initialDelta[metric],
                "all emitted artifacts counted once"
            );
            assert.equal(
                mode.projectedCompleteDelta[metric],
                mode.projectedEntryDelta[metric] +
                    PLAYER_PRESENCE_TRANSPORT_ALLOWANCE[metric]
            );
            for (const [kind, name, budget] of [
                ["entry", "BUDGET", BUDGET],
                ["legacy", "LEGACY_TOTAL_BUDGET", LEGACY_TOTAL_BUDGET],
                ["complete", "TOTAL_BUDGET", TOTAL_BUDGET],
            ]) {
                assert.equal(
                    mode.projection[kind][metric] - mode.initial[kind][metric],
                    mode.projection.identityIncrement[metric],
                    "source identity projection added once"
                );
                assert(
                    budget[metric] -
                        tizenPackageBootDelta(budget, metric) -
                        categoryNavigationDelta(budget, metric) -
                        stbPlayerDelta(budget, metric) -
                        categoryDelta(budget, metric) -
                        CATEGORY_PICKER_ENTRY_ALLOWANCE[metric] -
                        mode.projection[kind][metric] >=
                        presenceEvidence.previousCaps[name][metric] -
                            mode.baseline[kind][metric],
                    kind + " prior headroom retained"
                );
            }
        }
    }
    const categoryEvidence = require("../docs/evidence/category-selection-size-20261029.json");
    assert(Object.isFrozen(CATEGORY_SELECTION_ENTRY_ALLOWANCE));
    assert(Object.isFrozen(CATEGORY_SELECTION_FAVORITES_ALLOWANCE));
    assert.deepEqual(CATEGORY_SELECTION_ENTRY_ALLOWANCE, {
        bytes: 2781,
        gzipBytes: 800,
    });
    assert.deepEqual(CATEGORY_SELECTION_FAVORITES_ALLOWANCE, {
        bytes: 209,
        gzipBytes: 65,
    });
    assert.deepEqual(
        CATEGORY_SELECTION_ENTRY_ALLOWANCE,
        categoryEvidence.allowances.entry
    );
    assert.deepEqual(
        CATEGORY_SELECTION_FAVORITES_ALLOWANCE,
        categoryEvidence.allowances.favoritesTransfer
    );
    for (const [name, budget] of Object.entries({
        base_total: BASE_TOTAL_BUDGET,
        entry: BUDGET,
        favorites_transfer: OPTIONAL_BUDGETS["favorites-transfer"],
        legacy: LEGACY_TOTAL_BUDGET,
        total: TOTAL_BUDGET,
    })) {
        const withoutPresence = Object.fromEntries(
            ["bytes", "gzipBytes"].map((metric) => [
                metric,
                budget[metric] -
                    tizenPackageBootDelta(budget, metric) -
                    categoryNavigationDelta(budget, metric) -
                    stbPlayerDelta(budget, metric) -
                    (name === "favorites_transfer"
                        ? 0
                        : presenceDelta(budget, metric) +
                          CATEGORY_PICKER_ENTRY_ALLOWANCE[metric]),
            ])
        );
        assert.deepEqual(withoutPresence, categoryEvidence.budgetsAfter[name]);
        for (const metric of ["bytes", "gzipBytes"])
            assert.equal(
                withoutPresence[metric] -
                    categoryEvidence.budgetsBefore[name][metric],
                name === "favorites_transfer"
                    ? CATEGORY_SELECTION_FAVORITES_ALLOWANCE[metric]
                    : categoryDelta(budget, metric),
                name + " counts each category component once"
            );
    }
    for (const mode of categoryEvidence.measurements.canonicalModes) {
        for (const metric of ["bytes", "gzipBytes"]) {
            for (const kind of [
                "entry",
                "favoritesTransfer",
                "legacyTotal",
                "completeTotal",
            ])
                assert.equal(
                    mode.after[kind][metric] - mode.before[kind][metric],
                    mode.delta[kind][metric]
                );
            assert.equal(
                mode.delta.legacyTotal[metric],
                mode.delta.entry[metric]
            );
            assert.equal(
                mode.delta.completeTotal[metric],
                mode.delta.entry[metric] + mode.delta.favoritesTransfer[metric]
            );
            assert(
                mode.delta.entry[metric] <=
                    CATEGORY_SELECTION_ENTRY_ALLOWANCE[metric]
            );
            assert.equal(
                mode.delta.favoritesTransfer[metric],
                CATEGORY_SELECTION_FAVORITES_ALLOWANCE[metric]
            );
        }
        assert.equal(
            mode.unchangedProviders,
            Object.keys(CLASSIC_PROVIDER_BUNDLES).filter(
                (name) => name !== "torrent"
            ).length
        );
        assert.equal(
            mode.unchangedOptionalAssets,
            Object.keys(historicalOptionalBundles).length - 1
        );
    }
    const pickerEvidence = require("../docs/evidence/category-picker-size-20261029.json");
    assert(Object.isFrozen(CATEGORY_PICKER_ENTRY_ALLOWANCE));
    assert.deepEqual(CATEGORY_PICKER_ENTRY_ALLOWANCE, {
        bytes: 45,
        gzipBytes: 8,
    });
    assert.deepEqual(CATEGORY_PICKER_ENTRY_ALLOWANCE, pickerEvidence.allowance);
    assert.deepEqual(pickerEvidence.additionalReserve, {
        bytes: 0,
        gzipBytes: 0,
    });
    assert.deepEqual(
        pickerEvidence.measurements.map((row) => row.path),
        ARTIFACTS
    );
    for (const [name, budget] of Object.entries({
        baseTotalBudget: BASE_TOTAL_BUDGET,
        budget: BUDGET,
        legacyTotalBudget: LEGACY_TOTAL_BUDGET,
        totalBudget: TOTAL_BUDGET,
    })) {
        assert.deepEqual(
            beforeStbPlayerBudget(budget),
            pickerEvidence.nextBudgets[name]
        );
        for (const metric of ["bytes", "gzipBytes"])
            assert.equal(
                budget[metric] -
                    tizenPackageBootDelta(budget, metric) -
                    categoryNavigationDelta(budget, metric) -
                    stbPlayerDelta(budget, metric) -
                    pickerEvidence.previousBudgets[name][metric],
                CATEGORY_PICKER_ENTRY_ALLOWANCE[metric],
                name + " counts the picker entry delta once"
            );
    }
    for (const row of pickerEvidence.measurements) {
        for (const metric of ["bytes", "gzipBytes"]) {
            assert.equal(
                row.after[metric] - row.before[metric],
                CATEGORY_PICKER_ENTRY_ALLOWANCE[metric]
            );
            assert.equal(
                row.delta[metric],
                CATEGORY_PICKER_ENTRY_ALLOWANCE[metric]
            );
            for (const [before, after, name, budget] of [
                [row.before, row.after, "budget", BUDGET],
                [
                    row.legacyBefore,
                    row.legacyAfter,
                    "legacyTotalBudget",
                    LEGACY_TOTAL_BUDGET,
                ],
                [
                    row.completeBefore,
                    row.completeAfter,
                    "totalBudget",
                    TOTAL_BUDGET,
                ],
            ])
                assert.equal(
                    budget[metric] -
                        tizenPackageBootDelta(budget, metric) -
                        categoryNavigationDelta(budget, metric) -
                        stbPlayerDelta(budget, metric) -
                        after[metric],
                    pickerEvidence.previousBudgets[name][metric] -
                        before[metric],
                    row.path + " preserves previous " + name + " headroom"
                );
        }
        assert.equal(
            row.unchangedProviders,
            Object.keys(CLASSIC_PROVIDER_BUNDLES).filter(
                (name) => name !== "torrent"
            ).length
        );
        assert.equal(
            row.unchangedOptionalAssets,
            Object.keys(historicalOptionalBundles).length
        );
    }
    const shakaTrackDelta = (budget, metric) =>
        SHAKA_TRACKS_ENTRY_ALLOWANCE[metric] +
        (budget === BASE_TOTAL_BUDGET || budget === TOTAL_BUDGET
            ? OPTIONAL_BUDGETS["shaka-tracks"][metric]
            : 0);
    const plexStepDelta = (budget, metric) =>
        budget === BASE_TOTAL_BUDGET || budget === TOTAL_BUDGET
            ? PLEX_QUEUE_STEP_TOTAL_ALLOWANCE[metric]
            : 0;
    const plexEvidence = require("../docs/evidence/plex-queue-step-size-20261029.json");
    const rollbackEvidence = require("../docs/evidence/relative-seek-rollback-size-20261029.json");
    assert(Object.isFrozen(PLEX_QUEUE_STEP_TOTAL_ALLOWANCE));
    assert.deepEqual(PLEX_QUEUE_STEP_TOTAL_ALLOWANCE, {
        bytes: 308,
        gzipBytes: 70,
    });
    for (const [name, budget] of Object.entries({
        baseTotalBudget: BASE_TOTAL_BUDGET,
        budget: BUDGET,
        legacyTotalBudget: LEGACY_TOTAL_BUDGET,
        totalBudget: TOTAL_BUDGET,
    }))
        for (const metric of ["bytes", "gzipBytes"])
            assert.equal(
                budget[metric] -
                    sharedFeatureDelta(budget, metric) -
                    rollbackEvidence.increment[metric] -
                    shakaTrackDelta(budget, metric) -
                    plexEvidence.previousCaps[name][metric],
                plexStepDelta(budget, metric),
                name + " counts the Plex change only once in complete totals"
            );
    assert.deepEqual(
        Object.fromEntries(
            Object.entries(historicalOptionalBudgets)
                .filter(([name]) => name !== "shaka-tracks")
                .map(([name, value]) => [
                    name,
                    beforeSharedFeatureOptional(name, value),
                ])
        ),
        plexEvidence.previousCaps.optionalBudgets
    );
    assert.deepEqual(OPTIONAL_BUDGET, plexEvidence.previousCaps.optionalBudget);
    for (const variant of plexEvidence.variants)
        for (const metric of ["bytes", "gzipBytes"]) {
            const delta = PLEX_QUEUE_STEP_TOTAL_ALLOWANCE[metric];
            assert.equal(
                variant.plexAfter[metric] - variant.plexBefore[metric],
                delta
            );
            assert.equal(
                variant.completeAfter[metric] - variant.completeBefore[metric],
                delta
            );
            assert.equal(
                variant.legacyAfter[metric] - variant.legacyBefore[metric],
                delta
            );
            assert.equal(
                TOTAL_BUDGET[metric] -
                    sharedFeatureDelta(TOTAL_BUDGET, metric) -
                    rollbackEvidence.increment[metric] -
                    shakaTrackDelta(TOTAL_BUDGET, metric) -
                    variant.completeAfter[metric],
                plexEvidence.previousCaps.totalBudget[metric] -
                    variant.completeBefore[metric],
                "complete-total headroom is preserved exactly"
            );
            assert(variant.entry[metric] <= BUDGET[metric]);
            assert(variant.legacyAfter[metric] <= LEGACY_TOTAL_BUDGET[metric]);
            assert(variant.plexAfter[metric] <= PROVIDER_BUDGET[metric]);
        }
    const source = "var title = 'Программа';";
    const measurement = measureBundle(source, "unicode.js");
    assert.equal(measurement.bytes, Buffer.byteLength(source));
    assert.ok(measurement.bytes > source.length);
    assert.throws(() => measureBundle("", "empty"), /Empty classic bundle/);
    assert.throws(
        () => measureBundle(source, "raw", { bytes: 1, gzipBytes: 1000 }),
        /bytes .* exceeds budget/
    );
    assert.throws(
        () => measureBundle(source, "gzip", { bytes: 1000, gzipBytes: 1 }),
        /gzipBytes .* exceeds budget/
    );
    assert.throws(() => inspectBundles(root), /ENOENT/);
    for (const file of ARTIFACTS) {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), source);
    }
    assert.equal(inspectBundles(root).length, 3);
    assert.throws(() => inspectBundleSets(root), /ENOENT/);
    for (const file of ARTIFACTS) {
        for (const kind of Object.keys(CLASSIC_PROVIDER_BUNDLES))
            fs.writeFileSync(
                path.join(root, path.dirname(file), "provider-" + kind + ".js"),
                source
            );
    }
    for (const file of ARTIFACTS)
        for (const name of Object.keys(latestOptionalBundles))
            fs.writeFileSync(
                path.join(root, path.dirname(file), name + ".js"),
                source
            );
    assert.deepEqual(
        Object.keys(OPTIONAL_BUDGETS).sort(),
        Object.keys(CLASSIC_OPTIONAL_BUNDLES).sort()
    );
    assert.deepEqual(OPTIONAL_BUDGETS["subtitle-appearance"], {
        bytes:
            8100 +
            MODERN_INTERFACE_RELATED_ALLOWANCES["subtitle-appearance"].bytes,
        gzipBytes:
            3400 +
            MODERN_INTERFACE_RELATED_ALLOWANCES["subtitle-appearance"]
                .gzipBytes,
    });
    assert.deepEqual(OPTIONAL_BUDGETS["remote-settings-extras"], {
        bytes: 7000,
        gzipBytes: 2800,
    });
    assert.deepEqual(OPTIONAL_BUDGETS["remote-provider-fields"], {
        bytes: 18000,
        gzipBytes: 6200,
    });
    assert.equal(
        BASE_TOTAL_BUDGET.bytes,
        LEGACY_TOTAL_BUDGET.bytes +
            PLEX_QUEUE_STEP_TOTAL_ALLOWANCE.bytes +
            // Relocated assets share the existing complete payload allowance;
            // their independent caps do not allocate additional TOTAL bytes.
            Object.entries(OPTIONAL_BUDGETS)
                .filter(
                    ([name]) =>
                        ![
                            "local-compatibility",
                            "local-media-ui",
                            "remote-local-runner",
                        ].includes(name)
                )
                .map(([, budget]) => budget)
                .reduce((sum, budget) => sum + budget.bytes, 0)
    );
    assert.equal(
        BASE_TOTAL_BUDGET.gzipBytes,
        LEGACY_TOTAL_BUDGET.gzipBytes +
            PLEX_QUEUE_STEP_TOTAL_ALLOWANCE.gzipBytes +
            // Relocated assets share the existing complete payload allowance;
            // their independent caps do not allocate additional TOTAL bytes.
            Object.entries(OPTIONAL_BUDGETS)
                .filter(
                    ([name]) =>
                        ![
                            "local-compatibility",
                            "local-media-ui",
                            "remote-local-runner",
                        ].includes(name)
                )
                .map(([, budget]) => budget)
                .reduce((sum, budget) => sum + budget.gzipBytes, 0)
    );
    assert.deepEqual(beforeSharedFeatureBudget(BASE_TOTAL_BUDGET), {
        bytes: 1637960,
        gzipBytes: 503842,
    });
    assert.deepEqual(LOCAL_COMMAND_SESSION_ALLOWANCE, {
        bytes: 5632,
        gzipBytes: 1792,
    });
    assert.deepEqual(LOCAL_STALL_RECOVERY_ALLOWANCE, {
        bytes: 2048,
        gzipBytes: 640,
    });
    assert.deepEqual(LOCAL_COMPATIBILITY_ALLOWANCE, {
        bytes: 4480,
        gzipBytes: 2304,
    });
    assert.deepEqual(beforeSharedFeatureBudget(TOTAL_BUDGET), {
        bytes: 1642440,
        gzipBytes: 506146,
    });
    assert.deepEqual(beforeSharedFeatureBudget(BUDGET), {
        bytes: 1136586,
        gzipBytes: 347622,
    });
    assert.deepEqual(beforeSharedFeatureBudget(LEGACY_TOTAL_BUDGET), {
        bytes: 1281422,
        gzipBytes: 400312,
    });
    assert.deepEqual(OPTIONAL_BUDGETS["local-media-ui"], {
        bytes: 8500,
        gzipBytes: 3400,
    });
    assert.deepEqual(OPTIONAL_BUDGETS["local-compatibility"], {
        bytes: 4800,
        gzipBytes: 1900,
    });
    assert.deepEqual(OPTIONAL_BUDGETS["remote-local-runner"], {
        bytes: 2700,
        gzipBytes: 1300,
    });
    assert.deepEqual(LOCAL_STARTUP_PREVIEW_ALLOWANCE, {
        bytes: 8192,
        gzipBytes: 2560,
    });
    assert(Object.isFrozen(LOCAL_STARTUP_PREVIEW_ALLOWANCE));
    assert.deepEqual(MIXED_GLOBAL_FAVORITES_ENTRY_ALLOWANCE, {
        bytes: 34739,
        gzipBytes: 8485,
    });
    assert.deepEqual(MIXED_GLOBAL_FAVORITES_OPTIONAL_ALLOWANCE, {
        bytes: 132130,
        gzipBytes: 32892,
    });
    assert.deepEqual(MIXED_GLOBAL_FAVORITES_PROVIDER_ALLOWANCE, {
        bytes: 1536,
        gzipBytes: 640,
    });
    // Exact raw boundaries still pass; one byte beyond each named asset fails.
    for (const [name, cap] of [
        ["entry", BUDGET],
        ["control-transport", OPTIONAL_BUDGETS["control-transport"]],
        ["favorites-transfer", OPTIONAL_BUDGETS["favorites-transfer"]],
    ]) {
        const atBoundary = "a".repeat(cap.bytes);
        assert.equal(measureBundle(atBoundary, name, cap).bytes, cap.bytes);
        assert.throws(
            () => measureBundle(atBoundary + "a", name, cap),
            /bytes .* exceeds budget/
        );
        const actualGzip = measureBundle(atBoundary, name).gzipBytes;
        assert.equal(
            measureBundle(atBoundary, name, { ...cap, gzipBytes: actualGzip })
                .gzipBytes,
            actualGzip
        );
        assert.throws(
            () =>
                measureBundle(atBoundary, name, {
                    ...cap,
                    gzipBytes: actualGzip - 1,
                }),
            /gzipBytes .* exceeds budget/
        );
    }
    assert.deepEqual(OPTIONAL_BUDGETS["shaka-tracks"], {
        bytes: 1200,
        gzipBytes: 640,
    });
    const shakaEvidence = require("../docs/evidence/shaka-track-controls-size-20261029.json");
    assert.deepEqual(
        SHAKA_TRACKS_ENTRY_ALLOWANCE,
        shakaEvidence.entryAllowance
    );
    assert.deepEqual(
        OPTIONAL_BUDGETS["shaka-tracks"],
        shakaEvidence.optionalAllowance
    );
    for (let index = 0; index < 3; index++) {
        const before = shakaEvidence.baseline[index];
        const after = shakaEvidence.candidate[index];
        for (const metric of ["bytes", "gzipBytes"]) {
            const delta = after.entry[metric] - before.entry[metric];
            assert(delta > 0 && delta <= SHAKA_TRACKS_ENTRY_ALLOWANCE[metric]);
            assert(
                after.optional[metric] <=
                    OPTIONAL_BUDGETS["shaka-tracks"][metric]
            );
            assert.equal(
                after.total[metric] - before.total[metric],
                delta + after.optional[metric]
            );
        }
    }
    const mixedEvidence = require("../docs/evidence/mixed-global-favorites-size-20261028.json");
    const mixedDelta = (budget, metric) =>
        MIXED_GLOBAL_FAVORITES_ENTRY_ALLOWANCE[metric] +
        (budget === BUDGET
            ? 0
            : MIXED_GLOBAL_FAVORITES_PROVIDER_ALLOWANCE[metric]) +
        (budget === BASE_TOTAL_BUDGET || budget === TOTAL_BUDGET
            ? MIXED_GLOBAL_FAVORITES_OPTIONAL_ALLOWANCE[metric]
            : 0);
    for (const [name, budget] of Object.entries({
        BASE_TOTAL_BUDGET,
        BUDGET,
        LEGACY_TOTAL_BUDGET,
        TOTAL_BUDGET,
    }))
        for (const metric of ["bytes", "gzipBytes"])
            assert.equal(
                budget[metric] -
                    sharedFeatureDelta(budget, metric) -
                    shakaTrackDelta(budget, metric) -
                    RELATIVE_SEEK_ENTRY_ALLOWANCE[metric] -
                    plexStepDelta(budget, metric) -
                    mixedEvidence.previousCaps[name][metric],
                mixedDelta(budget, metric),
                name + " counts each mixed component once"
            );
    for (const [name, allowance] of Object.entries({
        MIXED_GLOBAL_FAVORITES_ENTRY_ALLOWANCE,
        MIXED_GLOBAL_FAVORITES_OPTIONAL_ALLOWANCE,
        MIXED_GLOBAL_FAVORITES_PROVIDER_ALLOWANCE,
    })) {
        assert(Object.isFrozen(allowance));
        for (const metric of ["bytes", "gzipBytes"]) {
            assert.equal(
                allowance[metric],
                mixedEvidence.allowances[name][metric]
            );
            assert.equal(
                allowance[metric] -
                    mixedEvidence.allowances[name].observed[metric],
                mixedEvidence.allowances[name].rounding[metric]
            );
        }
    }
    assert.deepEqual(PROVIDER_BUDGET, { bytes: 863400, gzipBytes: 268490 });
    for (const [name, budget] of Object.entries(
        mixedEvidence.unchangedOptionalCaps
    ))
        assert.deepEqual(
            beforeSharedFeatureOptional(name),
            budget,
            name + " cap unchanged"
        );
    for (const metric of ["bytes", "gzipBytes"])
        assert.equal(
            beforeSharedFeatureOptional("favorites-transfer")[metric] -
                (metric === "bytes" ? 109300 : 29300),
            MIXED_GLOBAL_FAVORITES_OPTIONAL_ALLOWANCE[metric]
        );
    assert.deepEqual(
        mixedEvidence.toolchains.baseline,
        mixedEvidence.toolchains.candidate
    );
    for (const mode of mixedEvidence.modes) {
        for (const metric of ["bytes", "gzipBytes"])
            assert.equal(
                mode.components.reduce(
                    (total, component) => total + component.delta[metric],
                    0
                ),
                mode.total_delta[metric],
                "all component growth accounted"
            );
        for (const metric of ["bytes", "gzipBytes"])
            assert.equal(
                mode.components
                    .filter((row) => row.family !== "optionalAssets")
                    .reduce((sum, row) => sum + row.delta[metric], 0),
                mode.legacy_delta[metric],
                "legacy growth includes entry and provider components once"
            );
        for (const component of mode.components) {
            for (const metric of ["bytes", "gzipBytes"])
                assert.equal(
                    component.after[metric] - component.before[metric],
                    component.delta[metric]
                );
            if (
                component.family === "optionalAssets" &&
                component.name !== "favorites-transfer.js"
            )
                assert.deepEqual(
                    component.after,
                    component.before,
                    "unrelated optional bytes unchanged"
                );
        }
    }
    for (const mode of mixedEvidence.modes) {
        for (const [kind, cap] of [
            ["entry", BUDGET],
            ["legacy", LEGACY_TOTAL_BUDGET],
            ["complete", TOTAL_BUDGET],
        ])
            for (const metric of ["bytes", "gzipBytes"])
                assert(mode.actual[kind][metric] <= cap[metric]);
    }
    for (const mode of mixedEvidence.versus_prior_modes) {
        const unchanged = mode.components.filter(
            (row) =>
                row.family === "providers" ||
                (row.family === "optionalAssets" &&
                    row.name !== "favorites-transfer.js")
        );
        assert.equal(unchanged.length, 19);
        for (const row of unchanged) assert.deepEqual(row.after, row.before);
    }
    for (const mode of mixedEvidence.latest_versus_b377_modes) {
        for (const metric of ["bytes", "gzipBytes"])
            assert.equal(
                mode.components.reduce(
                    (sum, row) => sum + row.delta[metric],
                    0
                ),
                mode.total_delta[metric],
                "final callback and ownership corrections are counted exactly once"
            );
        for (const [kind, cap] of [
            ["entry", BUDGET],
            ["legacy", LEGACY_TOTAL_BUDGET],
            ["complete", TOTAL_BUDGET],
        ])
            for (const metric of ["bytes", "gzipBytes"])
                assert(mode.actual[kind][metric] <= cap[metric]);
        for (const component of mode.components)
            if (component.family === "optionalAssets")
                for (const metric of ["bytes", "gzipBytes"])
                    assert(
                        component.after[metric] <=
                            OPTIONAL_BUDGETS[
                                component.name.replace(/\.js$/, "")
                            ][metric]
                    );
    }
    const retirementEvidence = require("../docs/evidence/shaka-retirement-size-20261028.json");
    assert.deepEqual(SHAKA_RETIREMENT_ENTRY_ALLOWANCE, {
        bytes: 1152,
        gzipBytes: 0,
    });
    assert(Object.isFrozen(SHAKA_RETIREMENT_ENTRY_ALLOWANCE));
    assert.deepEqual(
        retirementEvidence.allocation,
        SHAKA_RETIREMENT_ENTRY_ALLOWANCE
    );
    assert.deepEqual(
        retirementEvidence.baseline.toolchain,
        retirementEvidence.candidates.ui.toolchain
    );
    for (const [name, budget] of Object.entries({
        BASE_TOTAL_BUDGET,
        BUDGET,
        LEGACY_TOTAL_BUDGET,
        TOTAL_BUDGET,
    })) {
        assert.equal(
            budget.bytes -
                sharedFeatureDelta(budget, "bytes") -
                RELATIVE_SEEK_ENTRY_ALLOWANCE.bytes -
                plexStepDelta(budget, "bytes") -
                mixedDelta(budget, "bytes") -
                shakaTrackDelta(budget, "bytes") -
                retirementEvidence.previousCaps[name].bytes,
            1152,
            name + " counts retirement once"
        );
        assert.equal(
            budget.gzipBytes -
                sharedFeatureDelta(budget, "gzipBytes") -
                RELATIVE_SEEK_ENTRY_ALLOWANCE.gzipBytes -
                plexStepDelta(budget, "gzipBytes") -
                mixedDelta(budget, "gzipBytes") -
                shakaTrackDelta(budget, "gzipBytes"),
            retirementEvidence.previousCaps[name].gzipBytes,
            name + " gzip unchanged"
        );
    }
    assert.deepEqual(
        PROVIDER_BUDGET,
        retirementEvidence.previousCaps.PROVIDER_BUDGET
    );
    assert.deepEqual(
        Object.fromEntries(
            Object.entries(historicalOptionalBudgets)
                .filter(([name]) => name !== "shaka-tracks")
                .map(([name, value]) => [
                    name,
                    beforeSharedFeatureOptional(name, value),
                ])
                .map(([name, value]) => [
                    name,
                    name === "favorites-transfer"
                        ? {
                              bytes:
                                  value.bytes -
                                  MIXED_GLOBAL_FAVORITES_OPTIONAL_ALLOWANCE.bytes,
                              gzipBytes:
                                  value.gzipBytes -
                                  MIXED_GLOBAL_FAVORITES_OPTIONAL_ALLOWANCE.gzipBytes,
                          }
                        : value,
                ])
        ),
        retirementEvidence.previousCaps.OPTIONAL_BUDGETS
    );
    for (const candidate of Object.values(retirementEvidence.candidates)) {
        for (const [kind, budget] of [
            ["entries", BUDGET],
            ["legacy", LEGACY_TOTAL_BUDGET],
            ["complete", TOTAL_BUDGET],
        ])
            for (const item of candidate[kind]) {
                assert(
                    item.bytes <= budget.bytes,
                    kind + " raw measured output fits"
                );
                assert(
                    item.gzipBytes <= budget.gzipBytes,
                    kind + " unchanged gzip fits"
                );
            }
    }
    for (let index = 0; index < 3; index++)
        for (const kind of ["entries", "legacy", "complete"])
            assert.equal(
                retirementEvidence.candidates.ui[kind][index].bytes -
                    retirementEvidence.baseline[kind][index].bytes,
                1145
            );
    for (let index = 0; index < 3; index++)
        assert.equal(
            retirementEvidence.candidates.pr925.entries[index].bytes -
                retirementEvidence.pr925Baseline.entries[index].bytes,
            1145
        );
    assert.equal(retirementEvidence.allocation.bytes - 1145, 7);

    const recoveryEvidence = require("../docs/evidence/favorites-recovery-size-20261028.json");
    const recoveryDelta = (budget, metric) =>
        FAVORITES_RECOVERY_ENTRY_ALLOWANCE[metric] +
        (budget === BASE_TOTAL_BUDGET || budget === TOTAL_BUDGET
            ? FAVORITES_RECOVERY_OPTIONAL_ALLOWANCE[metric]
            : 0);
    assert.deepEqual(FAVORITES_RECOVERY_ENTRY_ALLOWANCE, {
        bytes: 4800,
        gzipBytes: 1400,
    });
    assert.deepEqual(FAVORITES_RECOVERY_OPTIONAL_ALLOWANCE, {
        bytes: 23300,
        gzipBytes: 4900,
    });
    assert(Object.isFrozen(FAVORITES_RECOVERY_ENTRY_ALLOWANCE));
    assert(Object.isFrozen(FAVORITES_RECOVERY_OPTIONAL_ALLOWANCE));
    for (const [name, budget] of Object.entries({
        BASE_TOTAL_BUDGET,
        BUDGET,
        LEGACY_TOTAL_BUDGET,
        TOTAL_BUDGET,
    }))
        for (const metric of ["bytes", "gzipBytes"])
            assert.equal(
                budget[metric] -
                    sharedFeatureDelta(budget, metric) -
                    RELATIVE_SEEK_ENTRY_ALLOWANCE[metric] -
                    plexStepDelta(budget, metric) -
                    mixedDelta(budget, metric) -
                    shakaTrackDelta(budget, metric) -
                    SHAKA_RETIREMENT_ENTRY_ALLOWANCE[metric] -
                    recoveryEvidence.previousCaps[name][metric],
                recoveryDelta(budget, metric),
                "recovery counted exactly once: " + name
            );
    assert.deepEqual(
        PROVIDER_BUDGET,
        recoveryEvidence.previousCaps.PROVIDER_BUDGET
    );
    assert.deepEqual(
        OPTIONAL_BUDGET,
        recoveryEvidence.previousCaps.OPTIONAL_BUDGET
    );
    for (const [file, hash] of Object.entries(
        recoveryEvidence.historicalEvidenceSha256
    ))
        assert.equal(
            require("node:crypto")
                .createHash("sha256")
                .update(
                    fs.readFileSync(
                        path.join(__dirname, "../docs/evidence", file)
                    )
                )
                .digest("hex"),
            hash,
            "historical evidence byte-immutable: " + file
        );
    for (const [name, old] of Object.entries(
        recoveryEvidence.previousCaps.OPTIONAL_BUDGETS
    ))
        for (const metric of ["bytes", "gzipBytes"])
            assert.equal(
                beforeSharedFeatureOptional(name)[metric] -
                    (name === "favorites-transfer"
                        ? MIXED_GLOBAL_FAVORITES_OPTIONAL_ALLOWANCE[metric]
                        : 0) -
                    old[metric],
                name === "favorites-transfer"
                    ? FAVORITES_RECOVERY_OPTIONAL_ALLOWANCE[metric]
                    : 0,
                "only favorites envelope gains recovery: " + name
            );
    assert.deepEqual(
        recoveryEvidence.baseline.toolchain,
        recoveryEvidence.candidate.toolchain
    );
    for (const [kind, budget, observed] of [
        ["entries", BUDGET, recoveryEvidence.measurement.measuredEntryDelta],
        [
            "legacy",
            LEGACY_TOTAL_BUDGET,
            recoveryEvidence.measurement.measuredEntryDelta,
        ],
        [
            "complete",
            TOTAL_BUDGET,
            recoveryEvidence.measurement.measuredCompleteDelta,
        ],
    ])
        for (let i = 0; i < 3; i++) {
            const before = recoveryEvidence.baseline[kind][i],
                after = recoveryEvidence.candidate[kind][i];
            assert.equal(after.bytes - before.bytes, observed.bytes);
            assert.equal(
                after.gzipBytes - before.gzipBytes,
                i === 0 ? observed.webGzipBytes : observed.nativeGzipBytes
            );
            for (const metric of ["bytes", "gzipBytes"]) {
                assert(
                    after[metric] <= budget[metric],
                    "measured final variant fits independent feature allocation"
                );
                const old =
                    recoveryEvidence.previousCaps[
                        kind === "entries"
                            ? "BUDGET"
                            : kind === "legacy"
                              ? "LEGACY_TOTAL_BUDGET"
                              : "TOTAL_BUDGET"
                    ];
                assert(
                    budget[metric] - after[metric] >=
                        old[metric] - before[metric],
                    "prior release headroom retained: " + kind
                );
            }
        }
    for (let i = 0; i < 3; i++) {
        const before = recoveryEvidence.baseline.favoritesOptional[i],
            after = recoveryEvidence.candidate.favoritesOptional[i];
        for (const metric of ["bytes", "gzipBytes"]) {
            assert.equal(
                after[metric] - before[metric],
                recoveryEvidence.measurement.measuredOptionalDelta[metric]
            );
            assert(
                beforeSharedFeatureOptional("favorites-transfer")[metric] -
                    after[metric] >=
                    recoveryEvidence.previousCaps.OPTIONAL_BUDGETS[
                        "favorites-transfer"
                    ][metric] -
                        before[metric],
                "prior optional headroom retained"
            );
        }
    }
    const favoritesEvidence = require("../docs/evidence/favorites-transfer-size-20261028.json");
    const favoritesDelta = (budget, metric) =>
        FAVORITES_TRANSFER_ENTRY_ALLOWANCE[metric] +
        (budget === BUDGET ? 0 : FAVORITES_TRANSFER_PLEX_ALLOWANCE[metric]) +
        (budget === BASE_TOTAL_BUDGET || budget === TOTAL_BUDGET
            ? FAVORITES_TRANSFER_OPTIONAL_ALLOWANCE[metric]
            : 0);
    for (const [name, budget] of Object.entries({
        BASE_TOTAL_BUDGET,
        BUDGET,
        LEGACY_TOTAL_BUDGET,
        TOTAL_BUDGET,
    }))
        for (const metric of ["bytes", "gzipBytes"])
            assert.equal(
                budget[metric] -
                    sharedFeatureDelta(budget, metric) -
                    RELATIVE_SEEK_ENTRY_ALLOWANCE[metric] -
                    plexStepDelta(budget, metric) -
                    mixedDelta(budget, metric) -
                    shakaTrackDelta(budget, metric) -
                    SHAKA_RETIREMENT_ENTRY_ALLOWANCE[metric] -
                    DESKTOP_FAVORITES_KEY_ALLOWANCE[metric] -
                    recoveryDelta(budget, metric) -
                    favoritesEvidence.previousCaps[name][metric],
                favoritesDelta(budget, metric),
                "favorites allocation counted exactly once: " + name
            );
    assert.deepEqual(
        PROVIDER_BUDGET,
        favoritesEvidence.previousCaps.PROVIDER_BUDGET
    );
    for (const [name, budget] of Object.entries(
        favoritesEvidence.previousCaps.OPTIONAL_BUDGETS
    ))
        assert.deepEqual(
            beforeSharedFeatureOptional(name),
            budget,
            "existing optional cap unchanged: " + name
        );
    assert.deepEqual(FAVORITES_TRANSFER_ENTRY_ALLOWANCE, {
        bytes: 9300,
        gzipBytes: 2400,
    });
    assert.deepEqual(FAVORITES_TRANSFER_PLEX_ALLOWANCE, {
        bytes: 500,
        gzipBytes: 150,
    });
    assert.deepEqual(FAVORITES_TRANSFER_OPTIONAL_ALLOWANCE, {
        bytes: 86000,
        gzipBytes: 24400,
    });
    for (const metric of ["bytes", "gzipBytes"])
        assert.equal(
            beforeSharedFeatureOptional("favorites-transfer")[metric] -
                MIXED_GLOBAL_FAVORITES_OPTIONAL_ALLOWANCE[metric] -
                FAVORITES_RECOVERY_OPTIONAL_ALLOWANCE[metric],
            FAVORITES_TRANSFER_OPTIONAL_ALLOWANCE[metric]
        );
    for (const allowance of [
        FAVORITES_TRANSFER_ENTRY_ALLOWANCE,
        FAVORITES_TRANSFER_PLEX_ALLOWANCE,
        FAVORITES_TRANSFER_OPTIONAL_ALLOWANCE,
    ])
        assert(Object.isFrozen(allowance));
    assert.deepEqual(DESKTOP_FAVORITES_KEY_ALLOWANCE, {
        bytes: 4650,
        gzipBytes: 1100,
    });
    assert(Object.isFrozen(DESKTOP_FAVORITES_KEY_ALLOWANCE));
    for (const [actual, previous] of [
        [BUDGET, { bytes: 1078632, gzipBytes: 333306 }],
        [LEGACY_TOTAL_BUDGET, { bytes: 1221432, gzipBytes: 385206 }],
        [BASE_TOTAL_BUDGET, { bytes: 1335032, gzipBytes: 425834 }],
        [TOTAL_BUDGET, { bytes: 1339512, gzipBytes: 428138 }],
    ])
        for (const key of ["bytes", "gzipBytes"])
            assert.equal(
                actual[key] -
                    sharedFeatureDelta(actual, key) -
                    RELATIVE_SEEK_ENTRY_ALLOWANCE[key] -
                    plexStepDelta(actual, key) -
                    mixedDelta(actual, key) -
                    shakaTrackDelta(actual, key) -
                    SHAKA_RETIREMENT_ENTRY_ALLOWANCE[key] -
                    favoritesDelta(actual, key) -
                    recoveryDelta(actual, key) -
                    previous[key],
                DESKTOP_FAVORITES_KEY_ALLOWANCE[key],
                "desktop favorites counted exactly once"
            );
    const favoriteEvidence = require("../docs/evidence/desktop-favorites-key-size-20261028.json");
    assert.deepEqual(
        favoriteEvidence.allocation,
        DESKTOP_FAVORITES_KEY_ALLOWANCE
    );
    assert.deepEqual(
        favoriteEvidence.baseline.toolchain,
        favoriteEvidence.candidate.toolchain
    );
    for (let i = 0; i < favoriteEvidence.candidate.entries.length; i++) {
        const after = favoriteEvidence.candidate.entries[i],
            before = favoriteEvidence.baseline.entries[i];
        assert.equal(
            after.bytes - before.bytes,
            favoriteEvidence.observedDelta.bytes
        );
        assert.equal(
            after.gzipBytes - before.gzipBytes,
            i === 0
                ? favoriteEvidence.observedDelta.webGzipBytes
                : favoriteEvidence.observedDelta.nativeAndMobileGzipBytes
        );
        assert(
            after.bytes <= BUDGET.bytes && after.gzipBytes <= BUDGET.gzipBytes
        );
        const total = favoriteEvidence.candidate.complete[i];
        assert(
            total.bytes <= TOTAL_BUDGET.bytes &&
                total.gzipBytes <= TOTAL_BUDGET.gzipBytes
        );
    }

    for (const [actual, previous] of [
        [BUDGET, { bytes: 1070440, gzipBytes: 330746 }],
        [LEGACY_TOTAL_BUDGET, { bytes: 1213240, gzipBytes: 382646 }],
        [BASE_TOTAL_BUDGET, { bytes: 1326840, gzipBytes: 423274 }],
        [TOTAL_BUDGET, { bytes: 1331320, gzipBytes: 425578 }],
    ])
        for (const key of ["bytes", "gzipBytes"])
            assert.equal(
                actual[key] -
                    sharedFeatureDelta(actual, key) -
                    RELATIVE_SEEK_ENTRY_ALLOWANCE[key] -
                    plexStepDelta(actual, key) -
                    mixedDelta(actual, key) -
                    shakaTrackDelta(actual, key) -
                    SHAKA_RETIREMENT_ENTRY_ALLOWANCE[key] -
                    favoritesDelta(actual, key) -
                    recoveryDelta(actual, key) -
                    DESKTOP_FAVORITES_KEY_ALLOWANCE[key] -
                    previous[key],
                LOCAL_STARTUP_PREVIEW_ALLOWANCE[key],
                "startup preview counted exactly once"
            );
    const startupEvidence = require("../docs/evidence/local-startup-preview-size-20261027.json");
    assert.deepEqual(
        startupEvidence.allocation,
        LOCAL_STARTUP_PREVIEW_ALLOWANCE
    );
    assert.equal(
        startupEvidence.featureHeadroom.bytes,
        LOCAL_STARTUP_PREVIEW_ALLOWANCE.bytes -
            startupEvidence.observedDelta.bytes
    );
    assert.equal(
        startupEvidence.featureHeadroom.minimumGzipBytes,
        LOCAL_STARTUP_PREVIEW_ALLOWANCE.gzipBytes -
            Math.max(
                startupEvidence.observedDelta.webGzipBytes,
                startupEvidence.observedDelta.nativeAndMobileGzipBytes
            )
    );
    for (const metric of ["bytes", "gzipBytes"]) {
        assert.equal(
            startupEvidence.minimumCompleteHeadroom[metric],
            Math.min(
                ...startupEvidence.canonical.complete.map(
                    (item) =>
                        TOTAL_BUDGET[metric] -
                        sharedFeatureDelta(TOTAL_BUDGET, metric) -
                        RELATIVE_SEEK_ENTRY_ALLOWANCE[metric] -
                        plexStepDelta(TOTAL_BUDGET, metric) -
                        mixedDelta(TOTAL_BUDGET, metric) -
                        shakaTrackDelta(TOTAL_BUDGET, metric) -
                        SHAKA_RETIREMENT_ENTRY_ALLOWANCE[metric] -
                        favoritesDelta(TOTAL_BUDGET, metric) -
                        recoveryDelta(TOTAL_BUDGET, metric) -
                        DESKTOP_FAVORITES_KEY_ALLOWANCE[metric] -
                        item[metric]
                )
            )
        );
        assert(
            startupEvidence.canonical.entries.every(
                (item) =>
                    item[metric] <=
                    BUDGET[metric] -
                        sharedFeatureDelta(BUDGET, metric) -
                        RELATIVE_SEEK_ENTRY_ALLOWANCE[metric] -
                        mixedDelta(BUDGET, metric) -
                        shakaTrackDelta(BUDGET, metric) -
                        SHAKA_RETIREMENT_ENTRY_ALLOWANCE[metric] -
                        favoritesDelta(BUDGET, metric) -
                        recoveryDelta(BUDGET, metric) -
                        DESKTOP_FAVORITES_KEY_ALLOWANCE[metric]
            )
        );
    }
    ({
        BUDGET,
        BASE_TOTAL_BUDGET,
        LEGACY_TOTAL_BUDGET,
        OPTIONAL_BUDGETS,
        TOTAL_BUDGET,
    } = companionDiagnosticsCaps);
    assert.deepEqual(OPTIONAL_BUDGETS["modern-interface"], {
        bytes:
            MODERN_INTERFACE_OPTIONAL_ALLOWANCE.bytes +
            MODERN_PLAYER_OPTIONAL_ALLOWANCE.bytes +
            MODERN_EXPERIENCE_ALLOWANCE.renderer.bytes,
        gzipBytes:
            MODERN_INTERFACE_OPTIONAL_ALLOWANCE.gzipBytes +
            MODERN_PLAYER_OPTIONAL_ALLOWANCE.gzipBytes +
            MODERN_EXPERIENCE_ALLOWANCE.renderer.gzipBytes,
    });
    const modernPlayerEvidence = require("../docs/evidence/modern-player-size-20261031.json");
    assert.deepEqual(
        modernPlayerEvidence.allowance,
        MODERN_PLAYER_OPTIONAL_ALLOWANCE
    );
    assert.deepEqual(modernPlayerEvidence.budgets.before["modern-interface"], {
        bytes:
            MODERN_INTERFACE_OPTIONAL_ALLOWANCE.bytes +
            MODERN_EXPERIENCE_ALLOWANCE.renderer.bytes,
        gzipBytes:
            MODERN_INTERFACE_OPTIONAL_ALLOWANCE.gzipBytes +
            MODERN_EXPERIENCE_ALLOWANCE.renderer.gzipBytes,
    });
    assert.deepEqual(
        modernPlayerEvidence.budgets.after["modern-interface"],
        OPTIONAL_BUDGETS["modern-interface"]
    );
    for (const metric of ["bytes", "gzipBytes"])
        assert.equal(
            modernPlayerEvidence.delta[metric],
            modernPlayerEvidence.candidate[metric] -
                modernPlayerEvidence.baseline[metric]
        );
    // Exercise live inspectors against the actual latest caps after the
    // historical assertions, including rejection one byte above every cap.
    ({
        BUDGET,
        BASE_TOTAL_BUDGET,
        LEGACY_TOTAL_BUDGET,
        OPTIONAL_BUDGETS,
        TOTAL_BUDGET,
    } = latestCaps);
    CLASSIC_OPTIONAL_BUNDLES = latestOptionalBundles;
    assert(Object.isFrozen(BASE_TOTAL_BUDGET));
    assert(Object.isFrozen(LOCAL_COMPATIBILITY_ALLOWANCE));
    assert(Object.isFrozen(TOTAL_BUDGET));
    for (const key of ["bytes", "gzipBytes"])
        assert.equal(
            TOTAL_BUDGET[key],
            BASE_TOTAL_BUDGET[key] +
                LOCAL_COMPATIBILITY_ALLOWANCE[key] +
                LOCAL_SOURCE_DIAGNOSTICS_ALLOWANCE[key]
        );
    const localDiagnosticsBaseline = capsWithoutAllowances([
        "LOCAL_SOURCE_DIAGNOSTICS_ALLOWANCE",
    ]);
    for (const name of [
        "BUDGET",
        "BASE_TOTAL_BUDGET",
        "LEGACY_TOTAL_BUDGET",
        "PROVIDER_BUDGET",
        "OPTIONAL_BUDGET",
    ])
        assert.deepEqual(
            require("../scripts/classic-size.cjs")[name],
            localDiagnosticsBaseline[name],
            name + " remains unchanged by optional Local diagnostics"
        );
    for (const metric of ["bytes", "gzipBytes"])
        assert.equal(
            TOTAL_BUDGET[metric] -
                localDiagnosticsBaseline.TOTAL_BUDGET[metric],
            LOCAL_SOURCE_DIAGNOSTICS_ALLOWANCE[metric]
        );
    const localEvidence = require("../docs/evidence/local-source-diagnostics-size-20261103.json");
    assert.deepEqual(
        localEvidence.allowance,
        LOCAL_SOURCE_DIAGNOSTICS_ALLOWANCE
    );
    for (const metric of ["bytes", "gzipBytes"])
        assert.equal(
            localEvidence.currentTotalCap[metric] -
                localEvidence.previousTotalCap[metric],
            LOCAL_SOURCE_DIAGNOSTICS_ALLOWANCE[metric]
        );
    assert.equal(
        Math.max(
            ...localEvidence.measurements.map(
                (row) => row.delta.total.gzipBytes
            )
        ),
        LOCAL_SOURCE_DIAGNOSTICS_ALLOWANCE.gzipBytes
    );
    for (const row of localEvidence.measurements) {
        for (const metric of ["bytes", "gzipBytes"])
            for (const part of ["entry", "local", "legacy", "total"])
                assert.equal(
                    row.delta[part][metric],
                    row.candidate[part][metric] - row.baseline[part][metric]
                );
        assert(row.candidate.entry.bytes <= BUDGET.bytes);
        assert(row.candidate.total.bytes <= TOTAL_BUDGET.bytes);
        assert(row.candidate.total.gzipBytes <= TOTAL_BUDGET.gzipBytes);
        for (const metric of ["bytes", "gzipBytes"]) {
            assert(row.delta.total[metric] > 0);
            assert(
                row.delta.total[metric] <=
                    LOCAL_SOURCE_DIAGNOSTICS_ALLOWANCE[metric]
            );
        }
    }
    for (const name of Object.keys(OPTIONAL_BUDGETS))
        if (name !== "local-compatibility")
            assert.deepEqual(
                OPTIONAL_BUDGETS[name],
                localDiagnosticsBaseline.OPTIONAL_BUDGETS[name]
            );
    for (const name of Object.keys(OPTIONAL_BUDGETS)) {
        const file = path.join(root, "dist", name + ".js");
        fs.writeFileSync(file, "x".repeat(OPTIONAL_BUDGETS[name].bytes + 1));
        assert.throws(() => inspectBundleSets(root), /bytes .* exceeds budget/);
        fs.writeFileSync(file, source);
    }
    assert.deepEqual(OPTIONAL_BUDGETS["runtime-debug-details"], {
        bytes: 3800,
        gzipBytes: 1900,
    });
    assert.deepEqual(OPTIONAL_BUDGETS["perf-capture"], {
        bytes: 22200,
        gzipBytes: 8528,
    });
    const providerFieldsPath = path.join(
        root,
        "dist/remote-provider-fields.js"
    );
    const crypto = require("node:crypto");
    const modernPath = path.join(root, "dist/modern-interface.js");
    const denseModern = Buffer.concat(
        Array.from(
            {
                length:
                    Math.ceil(
                        latestCaps.OPTIONAL_BUDGETS["modern-interface"]
                            .gzipBytes / 32
                    ) + 30,
            },
            (_, index) =>
                crypto
                    .createHash("sha256")
                    .update("modern" + index)
                    .digest()
        )
    ).toString("base64");
    assert(
        denseModern.length <
            latestCaps.OPTIONAL_BUDGETS["modern-interface"].bytes
    );
    function modernBoundary(target) {
        const size = (length) =>
            collectBundleMeasurement(
                denseModern.slice(0, length),
                "modern-boundary"
            ).gzipBytes;
        let low = 1;
        let high = denseModern.length;
        assert(size(high) > target);
        while (low < high) {
            const middle = Math.floor((low + high) / 2);
            if (size(middle) < target) low = middle + 1;
            else high = middle;
        }
        // Deflate size can fluctuate locally; find the exact boundary using
        // the active zlib instead of pinning compressed bytes from one host.
        for (
            let length = Math.max(1, low - 256);
            length <= Math.min(denseModern.length, low + 256);
            length++
        )
            if (size(length) === target) return denseModern.slice(0, length);
        assert.fail("No exact gzip boundary fixture for " + target);
    }
    const modernCap = latestCaps.OPTIONAL_BUDGETS["modern-interface"].gzipBytes;
    const admittedModern = modernBoundary(modernCap);
    const oversizedModern = modernBoundary(modernCap + 1);
    assert.equal(
        collectBundleMeasurement(oversizedModern, "modern-boundary").gzipBytes,
        modernCap + 1
    );
    fs.writeFileSync(modernPath, admittedModern);
    assert.doesNotThrow(() => inspectBundleSets(root));
    fs.writeFileSync(modernPath, oversizedModern);
    assert.throws(
        () => inspectBundleSets(root),
        new RegExp(
            "modern-interface\\.js: gzipBytes .* exceeds budget " +
                latestCaps.OPTIONAL_BUDGETS["modern-interface"].gzipBytes
        )
    );
    fs.writeFileSync(modernPath, source);
    const denseFields = Buffer.concat(
        Array.from({ length: 288 }, (_, index) =>
            crypto.createHash("sha256").update(String(index)).digest()
        )
    ).toString("base64");
    assert(
        denseFields.length < OPTIONAL_BUDGETS["remote-provider-fields"].bytes
    );
    fs.writeFileSync(providerFieldsPath, denseFields);
    assert.throws(
        () => inspectBundleSets(root),
        /remote-provider-fields\.js: gzipBytes .* exceeds budget 6200/
    );
    fs.writeFileSync(providerFieldsPath, source);
    const perfPath = path.join(root, "dist/perf-capture.js");
    fs.writeFileSync(perfPath, denseFields);
    assert.throws(
        () => inspectBundleSets(root),
        /perf-capture\.js: gzipBytes .* exceeds budget 8528/
    );
    fs.writeFileSync(perfPath, source);
    const extrasPath = path.join(root, "dist/remote-settings-extras.js");
    const denseExtras = denseFields.slice(0, 4000);
    assert(
        denseExtras.length < OPTIONAL_BUDGETS["remote-settings-extras"].bytes
    );
    fs.writeFileSync(extrasPath, denseExtras);
    assert.throws(
        () => inspectBundleSets(root),
        /remote-settings-extras\.js: gzipBytes .* exceeds budget 2800/
    );
    fs.writeFileSync(extrasPath, source);
    const sets = inspectBundleSets(root);
    assert.equal(sets.length, 3);
    assert.equal(sets[0].providers.length, 9);
    const optionalCount = Object.keys(CLASSIC_OPTIONAL_BUNDLES).length;
    assert.equal(sets[0].total.bytes, measurement.bytes * (10 + optionalCount));
    assert.equal(
        sets[0].total.gzipBytes,
        measurement.gzipBytes * (10 + optionalCount)
    );
    // A complete distribution can use exactly one approved allowance; even a
    // one-byte overrun must fail while all component/legacy caps still pass.
    const distribution = [
        "dist/player.js",
        ...Object.keys(CLASSIC_PROVIDER_BUNDLES).map(
            (name) => "dist/provider-" + name + ".js"
        ),
        ...Object.keys(CLASSIC_OPTIONAL_BUNDLES).map(
            (name) => "dist/" + name + ".js"
        ),
    ];
    const originals = new Map(
        distribution.map((file) => [
            file,
            fs.readFileSync(path.join(root, file)),
        ])
    );
    function restoreDistribution() {
        for (const [file, bytes] of originals)
            fs.writeFileSync(path.join(root, file), bytes);
    }
    try {
        for (const file of distribution)
            fs.writeFileSync(path.join(root, file), "x");
        fs.writeFileSync(
            path.join(root, "dist/player.js"),
            "x".repeat(BUDGET.bytes)
        );
        const m3u = path.join(root, "dist/provider-m3u.js");
        fs.writeFileSync(
            m3u,
            "x".repeat(LEGACY_TOTAL_BUDGET.bytes - BUDGET.bytes - 8)
        );
        let remaining = TOTAL_BUDGET.bytes - LEGACY_TOTAL_BUDGET.bytes;
        let spare;
        const optionalNames = Object.keys(OPTIONAL_BUDGETS);
        optionalNames.forEach((name, index) => {
            const bytes = Math.min(
                OPTIONAL_BUDGETS[name].bytes,
                remaining - (optionalNames.length - index - 1)
            );
            fs.writeFileSync(
                path.join(root, "dist/" + name + ".js"),
                "x".repeat(bytes)
            );
            remaining -= bytes;
            if (bytes < OPTIONAL_BUDGETS[name].bytes)
                spare = path.join(root, "dist/" + name + ".js");
        });
        assert.equal(remaining, 0);
        assert(spare);
        assert.equal(
            inspectBundleSets(root)[0].total.bytes,
            TOTAL_BUDGET.bytes
        );
        fs.appendFileSync(spare, "x");
        assert.throws(
            () =>
                writeBuildBundleReport(
                    root,
                    {
                        outputSha256: collectBundleMeasurement(
                            fs.readFileSync(path.join(root, "dist/player.js")),
                            "entry"
                        ).sha256,
                    },
                    []
                ),
            /validation failed/
        );
        const aggregateFailure = JSON.parse(
            fs.readFileSync(
                path.join(root, "build/reports/classic-size-diagnostics.json")
            )
        );
        assert(
            aggregateFailure.violations.some(
                (item) => item.scope === "total" && item.metric === "bytes"
            )
        );
        assert.throws(
            () => inspectBundleSets(root),
            new RegExp(
                "complete player bytes .* exceeds budget " + TOTAL_BUDGET.bytes
            )
        );
    } finally {
        restoreDistribution();
    }
    // Independently exercise the aggregate gzip gate with incompressible small
    // fixtures; every per-file and legacy limit must remain satisfied.
    try {
        for (const file of distribution)
            fs.writeFileSync(path.join(root, file), "x");
        function dense(target) {
            const bytes = crypto.randomBytes(target - 128);
            return bytes;
        }
        const members = [
            {
                budget: BUDGET,
                // Track entry-only feature allocations while retaining room
                // under the per-file and legacy limits tested below.
                bytes: dense(BUDGET.gzipBytes - 8000),
                file: "dist/player.js",
            },
            ...Object.keys(CLASSIC_PROVIDER_BUNDLES).map((name) => ({
                budget: PROVIDER_BUDGET,
                // Keep the aggregate-only failure after measured provider growth.
                bytes:
                    name === "m3u"
                        ? dense(
                              59000 +
                                  STB_PLAYER_STALKER_ALLOWANCE.gzipBytes +
                                  STB_PLAYER_XTREAM_ALLOWANCE.gzipBytes
                          )
                        : name === "torrent"
                          ? dense(
                                MODERN_EXPERIENCE_ALLOWANCE.catalog.gzipBytes +
                                    TORZNAB_DISCOVERY_ALLOWANCE.catalog
                                        .gzipBytes +
                                    TORRENT_PROVIDER_ALLOWANCE.catalog
                                        .gzipBytes +
                                    TORRENT_STREAMS_ALLOWANCE.catalog
                                        .gzipBytes +
                                    TORRENT_DISCOVERY_ALLOWANCE.catalog
                                        .gzipBytes
                            )
                          : Buffer.from("x"),
                file: "dist/provider-" + name + ".js",
            })),
            ...Object.entries(OPTIONAL_BUDGETS).map(([name, budget]) => ({
                budget,
                bytes: dense(budget.gzipBytes),
                file: "dist/" + name + ".js",
            })),
        ];
        const measured = members.map((member) => {
            fs.writeFileSync(path.join(root, member.file), member.bytes);
            return measureBundle(member.bytes, member.file, member.budget);
        });
        const legacy = measured.slice(0, 10);
        assert(
            legacy.reduce((sum, item) => sum + item.gzipBytes, 0) <
                LEGACY_TOTAL_BUDGET.gzipBytes
        );
        assert(
            measured.reduce((sum, item) => sum + item.bytes, 0) <
                TOTAL_BUDGET.bytes
        );
        assert(
            measured.reduce((sum, item) => sum + item.gzipBytes, 0) >
                TOTAL_BUDGET.gzipBytes
        );
        assert.throws(
            () =>
                writeBuildBundleReport(
                    root,
                    {
                        outputSha256: collectBundleMeasurement(
                            fs.readFileSync(path.join(root, "dist/player.js")),
                            "entry"
                        ).sha256,
                    },
                    []
                ),
            /validation failed/
        );
        const gzipFailure = JSON.parse(
            fs.readFileSync(
                path.join(root, "build/reports/classic-size-diagnostics.json")
            )
        );
        assert(
            gzipFailure.violations.some(
                (item) => item.scope === "total" && item.metric === "gzipBytes"
            )
        );
        assert(
            !gzipFailure.violations.some(
                (item) => item.scope === "asset" || item.scope === "legacyTotal"
            )
        );
        assert.throws(
            () => inspectBundleSets(root),
            new RegExp(
                "complete player gzipBytes .* exceeds budget " +
                    TOTAL_BUDGET.gzipBytes
            )
        );
    } finally {
        restoreDistribution();
    }
    const extra = path.join(root, "dist/provider-old.js");
    fs.writeFileSync(extra, source);
    assert.throws(() => inspectBundleSets(root), /Unexpected provider bundle/);
    fs.unlinkSync(extra);
    const oversizedSet = path.join(root, "dist/provider-m3u.js");
    // Entry-only growth must not silently relax the existing provider limit.
    const providerBudget = { bytes: 863400, gzipBytes: 268490 };
    assert.deepEqual(PROVIDER_BUDGET, providerBudget);
    const entryOnlyGrowth = "x".repeat(providerBudget.bytes + 1);
    assert.doesNotThrow(() => measureBundle(entryOnlyGrowth, "entry"));
    fs.writeFileSync(oversizedSet, entryOnlyGrowth);
    assert.throws(
        () => inspectBundleSets(root),
        /provider-m3u\.js: bytes .* exceeds budget 863400/
    );
    fs.writeFileSync(oversizedSet, "x".repeat(providerBudget.bytes - 1));
    const additional = path.join(root, "dist/provider-edem.js");
    const aggregateOverflow = path.join(root, "dist/provider-xtream.js");
    const remainingTotal = TOTAL_BUDGET.bytes - (providerBudget.bytes - 1);
    const additionalBytes = Math.min(remainingTotal, providerBudget.bytes - 1);
    fs.writeFileSync(additional, "y".repeat(additionalBytes));
    fs.writeFileSync(
        aggregateOverflow,
        "z".repeat(remainingTotal - additionalBytes)
    );
    assert.throws(
        () => inspectBundleSets(root),
        /complete player bytes .* exceeds budget/
    );
    fs.writeFileSync(oversizedSet, source);
    fs.writeFileSync(additional, source);
    fs.writeFileSync(aggregateOverflow, source);
    fs.writeFileSync(oversizedSet, "x".repeat(800000));
    fs.writeFileSync(
        additional,
        "y".repeat(LEGACY_TOTAL_BUDGET.bytes - 800000)
    );
    assert.throws(
        () =>
            writeBuildBundleReport(
                root,
                { outputSha256: measurement.sha256 },
                []
            ),
        /validation failed/
    );
    const legacyFailure = JSON.parse(
        fs.readFileSync(
            path.join(root, "build/reports/classic-size-diagnostics.json")
        )
    );
    assert(
        legacyFailure.violations.some(
            (item) => item.scope === "legacyTotal" && item.metric === "bytes"
        )
    );
    assert.throws(
        () => inspectBundleSets(root),
        new RegExp(
            `legacy complete player bytes .* exceeds budget ${LEGACY_TOTAL_BUDGET.bytes}`
        ),
        "legacy payload cannot borrow unused optional-asset headroom"
    );
    fs.writeFileSync(oversizedSet, source);
    fs.writeFileSync(additional, source);
    const optimizer = { outputSha256: measurement.sha256 };
    const diagnosticFile = path.join(
        root,
        "build/reports/classic-size-diagnostics.json"
    );
    function diagnose(artifacts = ARTIFACTS, kinds) {
        const first = fs.existsSync(path.join(root, artifacts[0]))
            ? collectBundleMeasurement(
                  fs.readFileSync(path.join(root, artifacts[0])),
                  artifacts[0]
              )
            : measurement;
        assert.throws(
            () =>
                writeBuildBundleReport(
                    root,
                    { outputSha256: first.sha256 },
                    [],
                    artifacts,
                    kinds,
                    {
                        attempt: "fresh-attempt",
                        mode: "fixture",
                        source: "exact-source",
                    }
                ),
            /Classic bundle validation failed/
        );
        assert(
            !fs.existsSync(path.join(root, "build/reports/classic-bundle.json"))
        );
        return JSON.parse(fs.readFileSync(diagnosticFile));
    }
    // Valid collection is byte/schema identical to the original strict report.
    const strictReport = writeBundleReport(root, optimizer, []);
    assert.deepEqual(writeBuildBundleReport(root, optimizer, []), strictReport);
    assert(!fs.existsSync(diagnosticFile));
    // Entry overflow cannot stop collection of later variants or either metric.
    const denseEntry = crypto.randomBytes(BUDGET.bytes + 1);
    fs.writeFileSync(path.join(root, ARTIFACTS[0]), denseEntry);
    fs.writeFileSync(
        path.join(root, ARTIFACTS[2]),
        "x".repeat(BUDGET.bytes + 1)
    );
    fs.writeFileSync(
        path.join(root, "dist/provider-m3u.js"),
        "x".repeat(PROVIDER_BUDGET.bytes + 1)
    );
    fs.writeFileSync(
        path.join(root, "dist/local-media-ui.js"),
        "x".repeat(OPTIONAL_BUDGETS["local-media-ui"].bytes + 1)
    );
    const failed = diagnose();
    for (const [key, allowance] of Object.entries({
        autoRelayStallRecoveryEntryAllowance:
            AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE,
        classicPresentationSettingsAllowance:
            CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE,
        desktopVideoQueueAllowance: DESKTOP_VIDEO_QUEUE_ALLOWANCE,
        favoritesCategoryPersistenceAllowance:
            FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE,
        interfaceNotificationSettingsAllowance:
            INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE,
        localFavoritesPathAllowance: LOCAL_FAVORITES_PATH_ALLOWANCE,
        localFavoriteWriteRecoveryAllowance:
            LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE,
        mediaCompanionEntryAllowance: MEDIA_COMPANION_ENTRY_ALLOWANCE,
        mediaCompanionOptionalAllowance: MEDIA_COMPANION_OPTIONAL_ALLOWANCE,
        mediaCompanionPreparationAllowance:
            MEDIA_COMPANION_PREPARATION_ALLOWANCE,
        mediaCompanionSettingsAllowance: MEDIA_COMPANION_SETTINGS_ALLOWANCE,
        mediaCompanionTransportAllowance: MEDIA_COMPANION_TRANSPORT_ALLOWANCE,
        modernInfoInteractionAllowance: MODERN_INFO_INTERACTION_ALLOWANCE,
        modernNativeShellOptionalAllowance:
            MODERN_NATIVE_SHELL_OPTIONAL_ALLOWANCE,
        nativeWindowControlsEntryAllowance:
            NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE,
        plexArtworkAllowance: PLEX_ARTWORK_ALLOWANCE,
    })) {
        assert.deepEqual(strictReport[key], allowance);
        assert.deepEqual(failed[key], strictReport[key]);
    }
    assert(!Object.hasOwn(failed, "MEDIA_COMPANION_PREPARATION_ALLOWANCE"));
    assert.equal(failed.diagnostic, true);
    assert.equal(failed.complete, true);
    assert.equal(failed.source, "exact-source");
    assert.equal(failed.attempt, "fresh-attempt");
    assert.equal(failed.artifacts.length, 3);
    assert.deepEqual(failed.budget, BUDGET);
    assert.deepEqual(failed.totalBudget, TOTAL_BUDGET);
    assert.deepEqual(
        failed.tizenPackageBootAllowance,
        TIZEN_PACKAGE_BOOT_ALLOWANCE
    );
    assert.deepEqual(
        failed.categoryNavigationEntryAllowance,
        CATEGORY_NAVIGATION_ENTRY_ALLOWANCE
    );
    assert.deepEqual(
        failed.categoryNavigationFavoritesAllowance,
        CATEGORY_NAVIGATION_FAVORITES_ALLOWANCE
    );
    assert.deepEqual(
        failed.categoryPickerEntryAllowance,
        CATEGORY_PICKER_ENTRY_ALLOWANCE
    );
    assert.deepEqual(
        failed.categorySelectionEntryAllowance,
        CATEGORY_SELECTION_ENTRY_ALLOWANCE
    );
    assert.deepEqual(
        failed.categoryVisibilityEntryAllowance,
        CATEGORY_VISIBILITY_ENTRY_ALLOWANCE
    );
    assert.deepEqual(
        failed.epgPresentationEntryAllowance,
        EPG_PRESENTATION_ENTRY_ALLOWANCE
    );
    assert.deepEqual(
        failed.categorySelectionFavoritesAllowance,
        CATEGORY_SELECTION_FAVORITES_ALLOWANCE
    );
    assert.deepEqual(
        failed.playerPresenceEntryAllowance,
        PLAYER_PRESENCE_ENTRY_ALLOWANCE
    );
    assert.deepEqual(
        failed.playerPresenceTransportAllowance,
        PLAYER_PRESENCE_TRANSPORT_ALLOWANCE
    );
    assert.deepEqual(
        failed.plexQueueStepTotalAllowance,
        PLEX_QUEUE_STEP_TOTAL_ALLOWANCE
    );
    assert.deepEqual(
        failed.shakaRetirementEntryAllowance,
        SHAKA_RETIREMENT_ENTRY_ALLOWANCE
    );
    assert.deepEqual(
        failed.favoritesRecoveryEntryAllowance,
        FAVORITES_RECOVERY_ENTRY_ALLOWANCE
    );
    assert.deepEqual(
        failed.favoritesRecoveryOptionalAllowance,
        FAVORITES_RECOVERY_OPTIONAL_ALLOWANCE
    );
    for (const metric of ["bytes", "gzipBytes"])
        assert(
            failed.violations.some(
                (item) => item.path === ARTIFACTS[0] && item.metric === metric
            )
        );
    for (const file of [
        ARTIFACTS[2],
        "dist/provider-m3u.js",
        "dist/local-media-ui.js",
    ])
        assert(failed.violations.some((item) => item.path === file));
    for (const set of failed.providerBundles) {
        assert.equal(
            set.providers.length,
            Object.keys(CLASSIC_PROVIDER_BUNDLES).length
        );
        assert.equal(set.optionalAssets.length, optionalCount);
        const entry = failed.artifacts.find((item) => item.path === set.entry);
        for (const metric of ["bytes", "gzipBytes"]) {
            assert.equal(
                set.legacyTotal[metric],
                [entry, ...set.providers].reduce(
                    (sum, item) => sum + item[metric],
                    0
                )
            );
            assert.equal(
                set.total[metric],
                [entry, ...set.providers, ...set.optionalAssets].reduce(
                    (sum, item) => sum + item[metric],
                    0
                )
            );
        }
    }
    restoreDistribution();
    fs.writeFileSync(path.join(root, ARTIFACTS[2]), source);
    // Missing data produces null totals, never zeros or a stale complete report.
    const missing = path.join(root, "dist-mobile/dist/local-media-ui.js");
    fs.unlinkSync(missing);
    let incomplete = diagnose();
    assert.equal(incomplete.complete, false);
    assert.equal(incomplete.providerBundles[2].total, null);
    assert(incomplete.providerBundles[2].legacyTotal);
    assert(
        incomplete.inputErrors.some(
            (item) => item.path === "dist-mobile/dist/local-media-ui.js"
        )
    );
    fs.writeFileSync(missing, source);
    // Bounded input errors do not prevent independent variant collection.
    const unsafe = path.join(root, "dist/provider-m3u.js");
    for (const kind of ["empty", "directory", "symlink", "excessive"]) {
        fs.unlinkSync(unsafe);
        if (kind === "directory") fs.mkdirSync(unsafe);
        else if (kind === "symlink")
            fs.symlinkSync(path.join(root, ARTIFACTS[2]), unsafe);
        else if (kind === "excessive") {
            const fd = fs.openSync(unsafe, "w");
            fs.ftruncateSync(fd, 16 * 1024 * 1024 + 1);
            fs.closeSync(fd);
        } else fs.writeFileSync(unsafe, "");
        incomplete = diagnose();
        assert.equal(incomplete.complete, false, kind);
        assert.equal(incomplete.providerBundles[0].legacyTotal, null, kind);
        assert(incomplete.providerBundles[2].total, kind);
        fs.rmSync(unsafe, { force: true, recursive: true });
        fs.writeFileSync(unsafe, source);
    }
    const originalRead = fs.readSync;
    let destabilized = false;
    fs.readSync = function (fd, buffer, ...args) {
        const count = originalRead.call(this, fd, buffer, ...args);
        if (!destabilized) {
            destabilized = true;
            fs.appendFileSync(path.join(root, ARTIFACTS[0]), "changed");
        }
        return count;
    };
    try {
        assert.throws(
            () => writeBuildBundleReport(root, optimizer, []),
            /validation failed/
        );
        incomplete = JSON.parse(fs.readFileSync(diagnosticFile));
        assert(
            incomplete.inputErrors.some((item) => /Unstable/.test(item.error))
        );
        assert.equal(incomplete.providerBundles[0].total, null);
    } finally {
        fs.readSync = originalRead;
        fs.writeFileSync(path.join(root, ARTIFACTS[0]), source);
    }
    fs.writeFileSync(path.join(root, "dist/provider-unexpected.js"), source);
    incomplete = diagnose();
    assert.equal(incomplete.providerBundles[0].total, null);
    assert(
        incomplete.inputErrors.some((item) =>
            /Unexpected provider/.test(item.error)
        )
    );
    fs.unlinkSync(path.join(root, "dist/provider-unexpected.js"));
    assert.throws(
        () => writeBuildBundleReport(root, { outputSha256: "wrong" }, []),
        /validation failed/
    );
    assert(
        JSON.parse(fs.readFileSync(diagnosticFile)).inputErrors.some((item) =>
            /optimizer/.test(item.error)
        )
    );
    const originalWrite = fs.writeFileSync;
    fs.writeFileSync = function (file, ...args) {
        if (file === diagnosticFile) throw new Error("fixture write failure");
        return originalWrite.call(this, file, ...args);
    };
    try {
        assert.throws(
            () => writeBuildBundleReport(root, { outputSha256: "wrong" }, []),
            /validation failed.*diagnostics write failed: fixture write failure/
        );
    } finally {
        fs.writeFileSync = originalWrite;
    }
    writeBuildBundleReport(root, optimizer, []);
    fs.writeFileSync(diagnosticFile, "stale");
    clearBuildSizeReports(root);
    assert(!fs.existsSync(diagnosticFile));
    assert(
        !fs.existsSync(path.join(root, "build/reports/classic-bundle.json"))
    );
    const serverReport = writeBuildBundleReport(
        root,
        optimizer,
        [],
        [ARTIFACTS[0]],
        undefined,
        { mode: "server" }
    );
    assert.equal(serverReport.artifacts.length, 1);
    assert.equal(serverReport.providerBundles.length, 1);
    const serverOnly = path.join(root, "server-only");
    fs.mkdirSync(serverOnly);
    fs.cpSync(path.join(root, "dist"), path.join(serverOnly, "dist"), {
        recursive: true,
    });
    assert.equal(
        writeBuildBundleReport(serverOnly, optimizer, [], ["dist/player.js"])
            .artifacts.length,
        1
    );
    fs.writeFileSync(
        path.join(serverOnly, "dist/player.js"),
        "x".repeat(BUDGET.bytes + 1)
    );
    assert.throws(
        () =>
            writeBuildBundleReport(
                serverOnly,
                {
                    outputSha256: collectBundleMeasurement(
                        fs.readFileSync(
                            path.join(serverOnly, "dist/player.js")
                        ),
                        "entry"
                    ).sha256,
                },
                [],
                ["dist/player.js"],
                undefined,
                { mode: "server" }
            ),
        /validation failed/
    );
    const serverFailure = JSON.parse(
        fs.readFileSync(
            path.join(serverOnly, "build/reports/classic-size-diagnostics.json")
        )
    );
    assert.equal(serverFailure.mode, "server");
    assert.equal(serverFailure.complete, true);
    assert.equal(serverFailure.artifacts.length, 1);
    // Android Play ships exactly the four permitted provider families.
    // Check both its retained flat export and the nested Capacitor entry point.
    const playArtifacts = ["play/player.js", "play/dist/player.js"];
    const playKinds = ["m3u", "plex", "stalker", "vportal"];
    for (const file of playArtifacts) {
        const directory = path.join(root, path.dirname(file));
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(path.join(root, file), source);
        for (const name of Object.keys(CLASSIC_OPTIONAL_BUNDLES))
            fs.writeFileSync(path.join(directory, name + ".js"), source);
        for (const kind of playKinds)
            fs.writeFileSync(
                path.join(directory, "provider-" + kind + ".js"),
                source
            );
    }
    const playSets = inspectBundleSets(root, playArtifacts, playKinds);
    assert.equal(playSets.length, 2);
    assert.equal(playSets[0].providers.length, 4);
    assert.equal(
        playSets[0].total.bytes,
        measurement.bytes * (5 + optionalCount)
    );
    assert.equal(
        playSets[0].total.gzipBytes,
        measurement.gzipBytes * (5 + optionalCount)
    );
    // Android's configured output may be outside the repository entirely.
    // Both inventories are relative to that output root, not the default dist.
    const androidArtifacts = ["player.js", "dist/player.js"];
    for (const file of androidArtifacts) {
        const directory = path.join(androidOutput, path.dirname(file));
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(path.join(androidOutput, file), source);
        for (const name of Object.keys(CLASSIC_OPTIONAL_BUNDLES))
            fs.writeFileSync(path.join(directory, name + ".js"), source);
        for (const kind of playKinds)
            fs.writeFileSync(
                path.join(directory, "provider-" + kind + ".js"),
                source
            );
    }
    const config = ts.createSourceFile(
        "vite.config.ts",
        fs.readFileSync(path.join(__dirname, "../vite.config.ts"), "utf8"),
        ts.ScriptTarget.Latest,
        true
    );
    // Exercise the actual staging functions, not just the final size inventory.
    const helpers = config.statements
        .filter(
            (node) =>
                ts.isFunctionDeclaration(node) &&
                ["stageTauriFrontend", "removeDuplicatePlayerAssets"].includes(
                    node.name?.text
                )
        )
        .map((node) => node.getText(config))
        .join("\n");
    const packaging = {
        ...fs,
        autoPlaybackScript: () => "fixture",
        CLASSIC_OPTIONAL_BUNDLES,
        CLASSIC_PROVIDER_BUNDLES,
        console: { log() {} },
        copyRuntimeAssets() {},
        join: path.join,
        stageNativeRuntime() {},
        stagePlayerAssets() {},
    };
    vm.createContext(packaging);
    vm.runInContext(
        ts.transpileModule(helpers, {
            compilerOptions: {
                module: ts.ModuleKind.None,
                target: ts.ScriptTarget.ES2020,
            },
        }).outputText,
        packaging
    );
    const nativeStage = path.join(root, "native-stage");
    packaging.stageTauriFrontend(root, path.join(root, "dist"), nativeStage);
    assert.equal(
        fs.readFileSync(
            path.join(nativeStage, "dist/subtitle-appearance.js"),
            "utf8"
        ),
        source
    );
    const nestedLoops = [];
    function findNestedLoop(node) {
        if (
            ts.isForOfStatement(node) &&
            node.getText(config).includes("providerKinds.map") &&
            node.getText(config).includes("CLASSIC_OPTIONAL_BUNDLES")
        )
            nestedLoops.push(node);
        ts.forEachChild(node, findNestedLoop);
    }
    findNestedLoop(config);
    assert.equal(nestedLoops.length, 1);
    const mobileStage = path.join(root, "mobile-stage");
    fs.cpSync(path.join(root, "dist"), mobileStage, { recursive: true });
    fs.mkdirSync(path.join(mobileStage, "dist"));
    fs.copyFileSync(
        path.join(mobileStage, "player.js"),
        path.join(mobileStage, "dist/player.js")
    );
    vm.runInNewContext(nestedLoops[0].getText(config), {
        ...packaging,
        outDir: mobileStage,
        providerKinds: Object.keys(CLASSIC_PROVIDER_BUNDLES),
    });
    assert.equal(
        fs.readFileSync(
            path.join(mobileStage, "dist/subtitle-appearance.js"),
            "utf8"
        ),
        source
    );
    assert.equal(
        fs.readFileSync(
            path.join(nativeStage, "dist/remote-settings.js"),
            "utf8"
        ),
        source
    );
    assert.equal(
        fs.readFileSync(
            path.join(mobileStage, "dist/remote-settings.js"),
            "utf8"
        ),
        source
    );
    packaging.removeDuplicatePlayerAssets(mobileStage);
    assert(!fs.existsSync(path.join(mobileStage, "remote-settings.js")));
    assert(fs.existsSync(path.join(mobileStage, "dist/remote-settings.js")));
    assert(!fs.existsSync(path.join(mobileStage, "subtitle-appearance.js")));
    assert(
        fs.existsSync(path.join(mobileStage, "dist/subtitle-appearance.js"))
    );
    const pipelineSource = fs.readFileSync(
        path.join(__dirname, "../vite.config.ts"),
        "utf8"
    );
    assert(pipelineSource.includes("const size = collectBundleMeasurement("));
    assert(!/\bmeasureBundle\(/.test(pipelineSource));
    assert(
        pipelineSource.indexOf('stageNativeRuntime(mobileDir, "capacitor")') <
            pipelineSource.lastIndexOf("writeBuildBundleReport(")
    );
    const androidGates = [];
    function findAndroidGate(node) {
        if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === "writeBuildBundleReport" &&
            node.arguments[0]?.getText(config) === "outDir"
        )
            androidGates.push(node.getText(config));
        ts.forEachChild(node, findAndroidGate);
    }
    findAndroidGate(config);
    assert.equal(androidGates.length, 1);
    const inspectAndroid = () =>
        vm.runInNewContext(androidGates[0], {
            __dirname: root,
            androidFlavor: "play",
            CLASSIC_MAIN_MODULES: [],
            outDir: androidOutput,
            providerKinds: playKinds,
            result: { code: source, report: optimizer },
            sizeContext: { attempt: "fixture", source: "fixture" },
            writeBuildBundleReport,
        });
    const androidSets = inspectAndroid().providerBundles;
    assert.deepEqual(
        Array.from(androidSets, (set) => set.entry),
        androidArtifacts
    );
    assert.equal(
        androidSets[1].total.bytes,
        measurement.bytes * (5 + optionalCount)
    );
    const {
        transformPlaySystemIcons,
    } = require("../scripts/play-system-icons.cjs");
    const iconSource = 'var icon="\\ue810";';
    const transformed = transformPlaySystemIcons(iconSource);
    assert.notEqual(transformed, iconSource);
    const iconOptimizer = {
        outputSha256: collectBundleMeasurement(iconSource, "entry").sha256,
    };
    for (const file of androidArtifacts)
        fs.writeFileSync(path.join(androidOutput, file), transformed);
    assert.equal(
        writeBuildBundleReport(
            androidOutput,
            iconOptimizer,
            [],
            androidArtifacts,
            playKinds,
            { mode: "android-play", nativeEntrySource: iconSource }
        ).artifacts[0].sha256,
        collectBundleMeasurement(transformed, "entry").sha256
    );
    assert.throws(
        () =>
            writeBuildBundleReport(
                androidOutput,
                { outputSha256: "wrong" },
                [],
                androidArtifacts,
                playKinds,
                { mode: "android-play", nativeEntrySource: iconSource }
            ),
        /validation failed/
    );
    // Native icon rewriting cannot grant headroom to oversized optimizer output.
    const rawBoundary =
        iconSource +
        "x".repeat(BUDGET.bytes + 1 - Buffer.byteLength(iconSource));
    const iconPrefix = iconSource.repeat(4096);
    const densePayload = Buffer.concat(
        Array.from({ length: 12000 }, (_, index) =>
            crypto.createHash("sha256").update(String(index)).digest()
        )
    ).toString("base64");
    const gzipCandidate = (length) =>
        iconPrefix + 'var payload="' + densePayload.slice(0, length) + '";';
    let low = 0,
        high = densePayload.length;
    while (low < high) {
        const middle = (low + high) >> 1;
        if (
            collectBundleMeasurement(gzipCandidate(middle), "optimizer-output")
                .gzipBytes > BUDGET.gzipBytes
        )
            high = middle;
        else low = middle + 1;
    }
    for (const [metric, original] of [
        ["bytes", rawBoundary],
        ["gzipBytes", gzipCandidate(low)],
    ]) {
        const originalSize = collectBundleMeasurement(
            original,
            "optimizer-output"
        );
        assert(originalSize[metric] > BUDGET[metric]);
        assert.throws(
            () => measureBundle(original, "entry"),
            new RegExp(metric + ".*exceeds budget")
        );
        const staged = transformPlaySystemIcons(original);
        assert.doesNotThrow(() => measureBundle(staged, "native-entry"));
        for (const file of androidArtifacts)
            fs.writeFileSync(path.join(androidOutput, file), staged);
        assert.throws(
            () =>
                writeBuildBundleReport(
                    androidOutput,
                    { outputSha256: originalSize.sha256 },
                    [],
                    androidArtifacts,
                    playKinds,
                    { mode: "android-play", nativeEntrySource: original }
                ),
            /validation failed/
        );
        const boundaryFailure = JSON.parse(
            fs.readFileSync(
                path.join(
                    androidOutput,
                    "build/reports/classic-size-diagnostics.json"
                )
            )
        );
        assert.equal(boundaryFailure.complete, true);
        assert.equal(boundaryFailure.inputErrors.length, 0);
        assert(
            boundaryFailure.violations.some(
                (item) =>
                    item.scope === "optimizer" &&
                    item.metric === metric &&
                    item.actual === originalSize[metric] &&
                    item.budget === BUDGET[metric]
            )
        );
        assert(
            !boundaryFailure.violations.some((item) => item.scope === "asset")
        );
        assert.equal(boundaryFailure.providerBundles.length, 2);
        assert(
            !fs.existsSync(
                path.join(androidOutput, "build/reports/classic-bundle.json")
            )
        );
    }
    for (const file of androidArtifacts)
        fs.writeFileSync(path.join(androidOutput, file), source);
    const externalChunk = path.join(androidOutput, "dist/provider-m3u.js");
    fs.unlinkSync(externalChunk);
    assert.throws(inspectAndroid, /Classic bundle validation failed/);
    const androidFailure = JSON.parse(
        fs.readFileSync(
            path.join(
                androidOutput,
                "build/reports/classic-size-diagnostics.json"
            )
        )
    );
    assert.equal(androidFailure.complete, false);
    assert(
        androidFailure.inputErrors.some(
            (item) =>
                item.path === "dist/provider-m3u.js" &&
                /ENOENT/.test(item.error)
        )
    );
    assert.equal(androidFailure.providerBundles[1].total, null);
    assert.equal(
        writeBundleReport(root, optimizer, [], playArtifacts, playKinds)
            .providerBundles[0].providers.length,
        4
    );
    assert.throws(() => inspectBundleSets(root, playArtifacts), /ENOENT/);
    assert.throws(
        () => inspectBundleSets(root, playArtifacts, ["m3u", "unknown"]),
        /Invalid expected provider bundle kinds/
    );
    assert.throws(
        () => inspectBundleSets(root, playArtifacts, ["m3u", "m3u"]),
        /Invalid expected provider bundle kinds/
    );
    const fullOnly = path.join(root, "play/dist/provider-edem.js");
    fs.writeFileSync(fullOnly, source);
    assert.throws(
        () => inspectBundleSets(root, playArtifacts, playKinds),
        /Unexpected provider bundle/
    );
    fs.unlinkSync(fullOnly);
    const required = path.join(root, "play/dist/provider-stalker.js");
    fs.unlinkSync(required);
    assert.throws(
        () => inspectBundleSets(root, playArtifacts, playKinds),
        /ENOENT/
    );
    fs.writeFileSync(required, source);
    fs.writeFileSync(required, "x".repeat(providerBudget.bytes - 1));
    const otherRequired = path.join(root, "play/dist/provider-m3u.js");
    fs.writeFileSync(otherRequired, "y".repeat(additionalBytes));
    fs.writeFileSync(
        path.join(root, "play/dist/provider-plex.js"),
        "z".repeat(remainingTotal - additionalBytes)
    );
    assert.throws(
        () => inspectBundleSets(root, playArtifacts, playKinds),
        /complete player bytes .* exceeds budget/
    );
    const report = writeBundleReport(root, optimizer, ["entry.js"]);
    assert.deepEqual(report.baseTotalBudget, BASE_TOTAL_BUDGET);
    assert.deepEqual(
        report.desktopVideoQueueAllowance,
        DESKTOP_VIDEO_QUEUE_ALLOWANCE
    );
    assert.deepEqual(
        report.localCompatibilityAllowance,
        LOCAL_COMPATIBILITY_ALLOWANCE
    );
    assert.deepEqual(report.totalBudget, TOTAL_BUDGET);
    assert.deepEqual(
        report.tizenPackageBootAllowance,
        TIZEN_PACKAGE_BOOT_ALLOWANCE
    );
    assert.deepEqual(
        report.categoryNavigationEntryAllowance,
        CATEGORY_NAVIGATION_ENTRY_ALLOWANCE
    );
    assert.deepEqual(
        report.categoryNavigationFavoritesAllowance,
        CATEGORY_NAVIGATION_FAVORITES_ALLOWANCE
    );
    assert.deepEqual(
        report.categoryPickerEntryAllowance,
        CATEGORY_PICKER_ENTRY_ALLOWANCE
    );
    assert.deepEqual(
        report.categorySelectionEntryAllowance,
        CATEGORY_SELECTION_ENTRY_ALLOWANCE
    );
    assert.deepEqual(
        report.categoryVisibilityEntryAllowance,
        CATEGORY_VISIBILITY_ENTRY_ALLOWANCE
    );
    assert.deepEqual(
        report.epgPresentationEntryAllowance,
        EPG_PRESENTATION_ENTRY_ALLOWANCE
    );
    assert.deepEqual(
        report.categorySelectionFavoritesAllowance,
        CATEGORY_SELECTION_FAVORITES_ALLOWANCE
    );
    assert.deepEqual(
        report.playerPresenceEntryAllowance,
        PLAYER_PRESENCE_ENTRY_ALLOWANCE
    );
    assert.deepEqual(
        report.playerPresenceTransportAllowance,
        PLAYER_PRESENCE_TRANSPORT_ALLOWANCE
    );
    assert.deepEqual(
        report.shakaRetirementEntryAllowance,
        SHAKA_RETIREMENT_ENTRY_ALLOWANCE
    );
    assert.deepEqual(
        report.favoritesRecoveryEntryAllowance,
        FAVORITES_RECOVERY_ENTRY_ALLOWANCE
    );
    assert.deepEqual(
        report.favoritesRecoveryOptionalAllowance,
        FAVORITES_RECOVERY_OPTIONAL_ALLOWANCE
    );
    assert.deepEqual(
        report.localStallRecoveryAllowance,
        LOCAL_STALL_RECOVERY_ALLOWANCE
    );
    assert.deepEqual(
        report.localStartupPreviewAllowance,
        LOCAL_STARTUP_PREVIEW_ALLOWANCE
    );
    assert.deepEqual(
        report.localCommandSessionAllowance,
        LOCAL_COMMAND_SESSION_ALLOWANCE
    );
    assert.deepEqual(
        JSON.parse(
            fs.readFileSync(
                path.join(root, "build/reports/classic-bundle.json")
            )
        ),
        report
    );
    assert.throws(
        () => writeBundleReport(root, { outputSha256: "stale" }, []),
        /does not match/
    );
    // A previously valid report must never allow an oversized staged artifact.
    fs.writeFileSync(
        path.join(root, ARTIFACTS[2]),
        "x".repeat(BUDGET.bytes + 1)
    );
    assert.throws(() => inspectBundles(root), /dist-mobile.* exceeds budget/);
    assert.throws(
        () => writeBundleReport(root, optimizer, []),
        /dist-mobile.* exceeds budget/
    );
    fs.unlinkSync(path.join(root, ARTIFACTS[1]));
    assert.throws(() => inspectBundles(root), /ENOENT/);
    console.log(
        "PASS classic bundle budgets: bytes, gzip, missing/stale/oversized artifacts"
    );
} finally {
    fs.rmSync(root, { force: true, recursive: true });
    fs.rmSync(androidOutput, { force: true, recursive: true });
}
