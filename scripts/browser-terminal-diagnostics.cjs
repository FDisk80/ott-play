const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");

const phases = new Set([
    "initializing",
    "probe-launch",
    "probe-session",
    "verify-inputs",
    "verify-capabilities",
    "scenario-process",
    "verify-scenarios",
    "write-acceptance",
]);
const errorCodes = new Set([
    "ETIMEDOUT",
    "ENOENT",
    "EACCES",
    "EPERM",
    "ENOBUFS",
    "ERR_ASSERTION",
]);
const signals = new Set([
    "SIGABRT",
    "SIGBUS",
    "SIGFPE",
    "SIGILL",
    "SIGKILL",
    "SIGPIPE",
    "SIGSEGV",
    "SIGTERM",
    "SIGTRAP",
    "SIGXCPU",
    "SIGXFSZ",
]);
function bounded(value, pattern) {
    return typeof value === "string" && pattern.test(value) ? value : null;
}
function errorCode(error) {
    try {
        const code = error?.code;
        return errorCodes.has(code) ? code : null;
    } catch (_) {
        return null;
    }
}

// Operational evidence only. This file is never a successful acceptance receipt.
// Do not include raw errors, browser output, URLs, environment or memory dumps.
module.exports = async function observeTerminal(
    { output, runtime, candidate },
    operation
) {
    const started = performance.now();
    const record = {
        acceptance: false,
        browserVersion: bounded(runtime.browserVersion, /^[0-9.]{1,40}$/),
        candidateSha: bounded(candidate.sourceSha, /^[a-f0-9]{40}$/),
        engine: ["chromium", "firefox", "webkit"].includes(runtime.engine)
            ? runtime.engine
            : null,
        errorCode: null,
        outcome: "failed",
        phase: "initializing",
        playwrightVersion: bounded(runtime.playwrightVersion, /^[0-9.]{1,40}$/),
        runAttempt: bounded(
            process.env.GITHUB_RUN_ATTEMPT,
            /^[1-9][0-9]{0,5}$/
        ),
        runId: bounded(process.env.GITHUB_RUN_ID, /^[1-9][0-9]{0,19}$/),
        scenarioProcess: null,
        schema: 1,
        sourceSha: bounded(runtime.sourceSha, /^[a-f0-9]{40}$/),
        target: bounded(runtime.target, /^[a-z0-9-]{1,80}$/),
    };
    const observer = {
        phase(value) {
            record.phase = phases.has(value) ? value : "initializing";
        },
        process(result) {
            record.scenarioProcess = {
                errorCode: errorCode(result.error),
                signal: signals.has(result.signal) ? result.signal : null,
                status: Number.isInteger(result.status) ? result.status : null,
            };
        },
    };
    try {
        const value = await operation(observer);
        record.outcome = "passed";
        return value;
    } catch (error) {
        record.errorCode = errorCode(error);
        throw error;
    } finally {
        record.elapsedMs = Math.round(performance.now() - started);
        try {
            // Exclusive creation refuses an existing file or symlink. Never
            // overwrite another attempt's diagnostic or follow its final link.
            fs.writeFileSync(
                path.join(output, "acceptance-terminal.json"),
                JSON.stringify(record, null, 2) + "\n",
                { flag: "wx", mode: 0o600 }
            );
        } catch (_) {
            // Evidence failure must not replace the original test result.
            console.error("Browser terminal diagnostic could not be saved.");
        }
    }
};
