const assert = require("node:assert/strict");
const { createHash, randomBytes } = require("node:crypto");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const envelope = require("../scripts/check-release-envelope-size.cjs");
const bundle = require("../scripts/classic-bundle.cjs");
const budgets = require("../scripts/classic-size.cjs");
const {
    CLASSIC_PLAYER_NAME_POLICY,
} = require("../scripts/classic-function-names.cjs");
const {
    transformPlaySystemIcons,
} = require("../scripts/play-system-icons.cjs");
const scriptPath = path.resolve(
    __dirname,
    "../scripts/check-release-envelope-size.cjs"
);
const head = "1234567890abcdef1234567890abcdef12345678";
const main =
    'var version="__OTTP_VERSION__", revision="__OTTP_SOURCE_REVISION__", id="__OTTP_BUILD_ID__", icon="&#xe810;";';
const fixtures = () =>
    Object.fromEntries(
        envelope
            .definitions()
            .map(({ name }) => [name, 'var fixture="' + name + '";'])
    );

test("release envelope uses nonempty HEAD and production identity hash input without attestation", () => {
    const version = envelope.representativeVersion("1.2.3-rc.4");
    assert.equal(version, "1.2.3-beta.999999");
    const result = envelope.stampMain(main, version, head);
    assert.equal(result.identity.sourceRevision, head);
    assert.equal(
        result.identity.buildId,
        "bundle-" +
            createHash("sha256")
                .update(main.replace(/__OTTP_VERSION__/g, version))
                .digest("hex")
    );
    assert(result.code.includes(head));
    assert(result.code.includes(version));
    assert(!result.code.includes("__OTTP_"));
    for (const invalid of [undefined, "", "local", "1.2", "v1.2.3"])
        assert.throws(() => envelope.representativeVersion(invalid), /version/);
    for (const invalid of [
        undefined,
        "",
        "a".repeat(39),
        "A".repeat(40),
        "g".repeat(40),
    ])
        assert.throws(() => envelope.stampMain(main, version, invalid), /HEAD/);
    for (const marker of [
        "__OTTP_VERSION__",
        "__OTTP_BUILD_ID__",
        "__OTTP_SOURCE_REVISION__",
    ])
        assert.throws(
            () => envelope.stampMain(main.replace(marker, ""), version, head),
            /placeholder/
        );
});

test("web/native measurement uses production asset names, caps, icons and counts optional assets once", () => {
    const assets = fixtures();
    assets["player.js"] = main;
    const report = envelope.inspectEnvelope(assets);
    assert.deepEqual(report.errors, []);
    for (const target of Object.values(report.targets)) {
        assert.equal(
            target.assets.filter(({ kind }) => kind === "entry").length,
            1
        );
        assert.equal(
            target.assets.filter(({ kind }) => kind === "provider").length,
            Object.keys(bundle.CLASSIC_PROVIDER_BUNDLES).length
        );
        assert.equal(
            target.assets.filter(({ kind }) => kind === "optional").length,
            Object.keys(bundle.CLASSIC_OPTIONAL_BUNDLES).length
        );
        assert.equal(
            new Set(target.assets.map(({ path }) => path)).size,
            Object.keys(assets).length
        );
        for (const metric of ["bytes", "gzipBytes"]) {
            const sum = (rows) =>
                rows.reduce((total, row) => total + row[metric], 0);
            assert.equal(
                target.legacyTotal[metric],
                sum(target.assets.filter(({ kind }) => kind !== "optional"))
            );
            assert.equal(target.total[metric], sum(target.assets));
            assert.equal(
                target.total[metric] - target.legacyTotal[metric],
                sum(target.assets.filter(({ kind }) => kind === "optional"))
            );
        }
        for (const row of target.assets)
            assert.deepEqual(
                row.budget,
                row.kind === "entry"
                    ? budgets.BUDGET
                    : row.kind === "provider"
                      ? budgets.PROVIDER_BUDGET
                      : budgets.OPTIONAL_BUDGETS[row.path.slice(0, -3)]
            );
    }
    assert.equal(
        report.targets.native.assets[0].sha256,
        budgets.collectBundleMeasurement(
            transformPlaySystemIcons(main),
            "player.js"
        ).sha256
    );
    assert.notEqual(
        report.targets.native.assets[0].sha256,
        report.targets.web.assets[0].sha256
    );
});

test("entry, provider and optional raw/gzip caps are enforced unchanged", () => {
    for (const kind of ["entry", "provider", "optional"]) {
        const row = envelope
            .definitions()
            .filter((entry) => entry.kind === kind)
            .sort((a, b) => a.budget.bytes - b.budget.bytes)[0];
        for (const metric of ["bytes", "gzipBytes"]) {
            const assets = fixtures();
            assets[row.name] =
                metric === "bytes"
                    ? "x".repeat(row.budget.bytes + 1)
                    : randomBytes(row.budget.gzipBytes * 2).toString("base64");
            const report = envelope.inspectEnvelope(assets);
            for (const target of ["web", "native"])
                assert(
                    report.errors.some(
                        (error) =>
                            error.target === target &&
                            error.asset === row.name &&
                            error.metric === metric &&
                            error.limit === row.budget[metric]
                    )
                );
        }
    }
});

test("legacy and complete aggregate caps remain separate from per-asset caps", () => {
    for (const metric of ["bytes", "gzipBytes"]) {
        const assets = fixtures();
        for (const row of envelope.definitions()) {
            if (metric === "bytes") {
                if (row.kind === "provider")
                    assets[row.name] = "x".repeat(200000);
                if (row.kind === "optional")
                    assets[row.name] = "y".repeat(row.budget.bytes);
            } else {
                const bytes =
                    row.kind === "entry"
                        ? 300000
                        : row.kind === "provider"
                          ? 25000
                          : Math.floor(
                                Math.min(
                                    row.budget.gzipBytes * 0.85,
                                    row.budget.bytes * 0.6
                                )
                            );
                assets[row.name] = randomBytes(bytes).toString("base64");
            }
        }
        const report = envelope.inspectEnvelope(assets);
        for (const target of ["web", "native"])
            for (const [asset, budget] of [
                ["legacyTotal", budgets.LEGACY_TOTAL_BUDGET],
                ["total", budgets.TOTAL_BUDGET],
            ])
                assert(
                    report.errors.some(
                        (error) =>
                            error.target === target &&
                            error.asset === asset &&
                            error.metric === metric &&
                            error.limit === budget[metric]
                    )
                );
        assert(
            report.errors.every(
                ({ asset }) => asset === "legacyTotal" || asset === "total"
            )
        );
    }
});

test("incomplete, unexpected, empty and invalid native assets fail closed", () => {
    for (const mutate of [
        (assets) => delete assets["player.js"],
        (assets) =>
            delete assets[
                Object.keys(bundle.CLASSIC_OPTIONAL_BUNDLES)[0] + ".js"
            ],
        (assets) => {
            assets["extra.js"] = "extra";
        },
        (assets) => {
            assets["player.js"] = "";
        },
        (assets) => {
            assets["player.js"] = 3;
        },
        (assets) => {
            assets["player.js"] = '"\\ue801"';
        },
    ]) {
        const assets = fixtures();
        mutate(assets);
        assert.throws(
            () => envelope.inspectEnvelope(assets),
            /assets|asset|Unmapped Play icon/
        );
    }
});

function pipelineFixture(options = {}) {
    const calls = [],
        real = createRequire(scriptPath);
    const sandbox = {
        __dirname: path.dirname(scriptPath),
        Buffer,
        console,
        module: { exports: {} },
        process,
        require(name) {
            if (name === "node:fs")
                return {
                    lstatSync(file) {
                        calls.push(["input", file]);
                        if (options.missingInput)
                            throw Error("Missing compiled input");
                        return {
                            isFile: () => !options.directoryInput,
                            size: options.emptyInput ? 0 : 10,
                        };
                    },
                    readFileSync() {
                        return JSON.stringify({
                            version:
                                options.version === undefined
                                    ? "1.2.3"
                                    : options.version,
                        });
                    },
                };
            if (name === "./classic-bundle.cjs")
                return {
                    ...bundle,
                    assembleClassic(root, files) {
                        calls.push(["assemble", root, files]);
                        return files === bundle.CLASSIC_MAIN_MODULES
                            ? main
                            : 'var version="__OTTP_VERSION__";';
                    },
                };
            if (name === "./classic-optimizer.cjs")
                return {
                    async optimizeClassic(code, policy) {
                        calls.push(["optimize", code, policy]);
                        return { code };
                    },
                };
            return real(name);
        },
    };
    vm.runInNewContext(fs.readFileSync(scriptPath, "utf8"), sandbox, {
        filename: scriptPath,
    });
    return { api: sandbox.module.exports, calls };
}

test("pipeline follows production version/identity and separate optional assembly without staging", async () => {
    const { api, calls } = pipelineFixture();
    const report = await api.releaseEnvelope("/fixture", head, {});
    const assembled = calls.filter(([kind]) => kind === "assemble");
    const optimized = calls.filter(([kind]) => kind === "optimize");
    assert.equal(assembled.length, envelope.definitions().length);
    assert.equal(optimized.length, assembled.length);
    assert.equal(
        new Set(
            calls.filter(([kind]) => kind === "input").map(([, file]) => file)
        ).size,
        new Set(envelope.definitions().flatMap(({ files }) => files)).size
    );
    envelope.definitions().forEach(({ files, kind }, index) => {
        assert.equal(assembled[index][2], files);
        assert.equal(optimized[index][2], CLASSIC_PLAYER_NAME_POLICY);
        assert.equal(
            optimized[index][1].includes("__OTTP_VERSION__"),
            kind === "optional"
        );
    });
    assert.equal(report.identity.sourceRevision, head);
    assert.equal(report.releaseAttestation, false);
    assert.equal(report.errors.length, 0);
});

test("pipeline refuses unsupported profiles and invalid or missing compiled inputs before optimization", async () => {
    for (const options of [
        { missingInput: true },
        { emptyInput: true },
        { directoryInput: true },
        { version: "local" },
    ]) {
        const { api, calls } = pipelineFixture(options);
        await assert.rejects(
            api.releaseEnvelope("/fixture", head, {}),
            /input|version/
        );
        assert(!calls.some(([kind]) => kind === "optimize"));
    }
    for (const name of [
        "OTTPLAY_CONTROL_DISCOVERY_URL",
        "OTTPLAY_CONTROL_DISCOVERY_SHA256",
        "OTTPLAY_ANDROID_FLAVOR",
        "OTTPLAY_ANDROID_OUTPUT",
        "OTTPLAY_ANDROID_COMPILE_ROOT",
    ]) {
        const { api, calls } = pipelineFixture();
        await assert.rejects(
            api.releaseEnvelope("/fixture", head, { [name]: "" }),
            /override/
        );
        assert.equal(calls.length, 0);
    }
});
