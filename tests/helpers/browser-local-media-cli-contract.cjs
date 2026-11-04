const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

module.exports = function browserLocalMediaCliContract(
    root = path.resolve(__dirname, "../..")
) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "ott-cli-guard-"));
    const preload = path.join(temporary, "no-startup.cjs");
    const marker = "UNEXPECTED_CLI_STARTUP";
    try {
        // Exercise the actual CLI entry while preventing browser/network startup
        // even if a future change removes or moves its early argument guard.
        fs.writeFileSync(
            preload,
            `const Module = require("node:module");
const load = Module._load;
const refuse = () => { throw new Error("${marker}"); };
require("node:http").createServer = refuse;
Module._load = function (name, ...args) {
    const loaded = load.call(this, name, ...args);
    if (name === "@playwright/test") loaded.chromium.launch = refuse;
    return loaded;
};
`
        );
        function run(args) {
            const result = spawnSync(
                process.execPath,
                ["--require", preload, ...args],
                {
                    cwd: root,
                    encoding: "utf8",
                    env: {
                        ...process.env,
                        NODE_OPTIONS: "",
                        TEMP: temporary,
                        TMP: temporary,
                        TMPDIR: temporary,
                    },
                    timeout: 10000,
                }
            );
            assert.ifError(result.error);
            assert.equal(result.signal, null);
            assert.equal(result.status, 1);
            return result.stderr;
        }
        // A positive tripwire control prevents a silently ineffective preload.
        assert.ok(
            run([
                "-e",
                'require("@playwright/test").chromium.launch()',
            ]).includes("Error: " + marker)
        );
        for (const flags of [
            ["--initial-retry"],
            ["--built-ui", "--initial-retry", "--stalled-file"],
        ]) {
            const error = run(["tests/test_browser_local_media.cjs", ...flags]);
            assert.ok(
                error.includes(
                    "Error: --initial-retry requires --built-ui and excludes --stalled-file"
                ),
                error
            );
            assert.ok(
                !error.includes(marker),
                "invalid CLI mode reached startup"
            );
        }
    } finally {
        fs.rmSync(temporary, { force: true, recursive: true });
    }
};
