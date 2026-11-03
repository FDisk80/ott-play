#!/usr/bin/env node
"use strict";

// Explicit, process-local workaround for the verified CLI 3.2.6 TCP probe.
// Do not load through global NODE_OPTIONS or modify the installed CLI.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Stream } = require("node:stream");

const CLI_VERSION = "3.2.6";
const NOVACOM_SHA256 =
    "0019b58f8f9020bb6a76b96eff81b44134e42247ae2aa72af44669e2f74466d8";
const COMMANDS = new Set([
    "ares-device",
    "ares-install",
    "ares-launch",
    "ares-novacom",
]);
const USAGE =
    "Usage: node native/webos/ares-compat.cjs /path/to/@webos-tools/cli <ares-command> [arguments...]";

function packageFile(root, relative) {
    const expected = path.resolve(root, relative);
    const actual = fs.realpathSync(expected);
    if (actual !== expected || !fs.statSync(actual).isFile()) {
        throw new Error(
            "Expected a regular CLI package file without redirected paths."
        );
    }
    return actual;
}

function validateCli(rootArgument, command) {
    if (!COMMANDS.has(command)) {
        throw new Error(
            "Supported commands: " + [...COMMANDS].join(", ") + "."
        );
    }
    const root = fs.realpathSync(rootArgument);
    const metadata = JSON.parse(
        fs.readFileSync(packageFile(root, "package.json"), "utf8")
    );
    if (
        metadata.name !== "@webos-tools/cli" ||
        metadata.version !== CLI_VERSION
    ) {
        throw new Error(
            "This workaround requires exactly @webos-tools/cli " +
                CLI_VERSION +
                ". Use the ordinary CLI for other versions."
        );
    }
    const relativeEntry = "bin/" + command + ".js";
    if (!metadata.bin || metadata.bin[command] !== relativeEntry) {
        throw new Error(
            "The CLI command mapping differs from the verified package."
        );
    }
    const entry = packageFile(root, relativeEntry);
    const novacom = packageFile(root, "lib/base/novacom.js");
    const digest = crypto
        .createHash("sha256")
        .update(fs.readFileSync(novacom))
        .digest("hex");
    if (digest !== NOVACOM_SHA256) {
        throw new Error(
            "The CLI TCP probe source does not match the verified SHA256. Refusing to apply the workaround."
        );
    }
    return { entry, novacom };
}

function completeOnce(original) {
    return function (target, next) {
        let completed = false;
        return original.call(this, target, (...args) => {
            if (completed) return;
            completed = true;
            next(...args);
        });
    };
}

// Scope: one guarded run_ssh invocation, without changing the shared SSH client.
function drainRun(original) {
    return function (cmd, opt, stdin, stdout, stderr, next) {
        if (typeof next !== "function") return original.apply(this, arguments);
        const client = this.ssh;
        const outputs = [
            ...new Set(
                [stdout, stderr].filter((value) => value instanceof Stream)
            ),
        ];
        const listeners = [];
        const ended = [false, false],
            closed = [false, false];
        let bound = false,
            received = false,
            finishing = false,
            delivered = false;
        let sdkError, streamError;
        const failure = (code) => Object.assign(new Error(code), { code });
        function remember(error) {
            if (!streamError && !delivered) streamError = error;
        }
        function listen(emitter, event, callback) {
            emitter.on(event, callback);
            listeners.push([emitter, event, callback]);
        }
        function cleanup() {
            for (const [emitter, event, callback] of listeners)
                emitter.removeListener(event, callback);
            listeners.length = 0;
        }
        function flush(done) {
            let pending = outputs.length,
                firstError;
            if (!pending) return done();
            for (const output of outputs) {
                let settled = false;
                function finish(error) {
                    if (settled) return;
                    settled = true;
                    if (!firstError && error) firstError = error;
                    output.removeListener("error", finish);
                    output.removeListener("close", premature);
                    if (!--pending) done(firstError);
                }
                function premature() {
                    finish(
                        output.writableFinished
                            ? null
                            : failure("ARES_OUTPUT_CLOSED")
                    );
                }
                output.on("error", finish);
                output.on("close", premature);
                try {
                    if (output.destroyed && !output.writableFinished)
                        premature();
                    else if (
                        output === process.stdout ||
                        output === process.stderr
                    )
                        output.write("", finish);
                    else if (output.writableFinished) finish();
                    else output.end(finish);
                } catch (error) {
                    finish(error);
                }
            }
        }
        function advance() {
            if (finishing || !received || (bound && !(closed[0] && closed[1])))
                return;
            if (bound && !(ended[0] && ended[1]))
                remember(failure("ARES_PREMATURE_STREAM_CLOSE"));
            finishing = true;
            flush((error) =>
                setImmediate(() => {
                    delivered = true;
                    cleanup();
                    next(sdkError || streamError || error || null);
                })
            );
        }
        function result(error) {
            if (received || finishing) return;
            received = true;
            sdkError = error;
            advance();
        }
        // Proxy Writable destinations as functions, so the old SDK cannot end
        // stderr at stdout EOF. End/flush both only after their own channel drain.
        const destination = (output) =>
            outputs.includes(output) ? (data) => output.write(data) : output;
        const session = Object.create(this);
        session.ssh = Object.create(client);
        session.ssh.exec = function (command, options, opened) {
            return client.exec(command, options, (error, channel) => {
                if (error) return opened(error, channel);
                if (
                    !channel ||
                    !channel.stderr ||
                    typeof channel.on !== "function" ||
                    typeof channel.stderr.on !== "function"
                ) {
                    return result(failure("ARES_UNSUPPORTED_CHANNEL"));
                }
                bound = true;
                [channel, channel.stderr].forEach((readable, index) => {
                    listen(readable, "end", () => {
                        ended[index] = true;
                        advance();
                    });
                    listen(readable, "close", () => {
                        closed[index] = true;
                        advance();
                    });
                    listen(readable, "error", remember);
                });
                opened(error, channel);
            });
        };
        try {
            listen(client, "error", remember);
            listen(client, "close", () => {
                if (!(closed[0] && closed[1]))
                    remember(failure("ARES_TRANSPORT_CLOSED"));
            });
            for (const output of outputs) listen(output, "error", remember);
            return original.call(
                session,
                cmd,
                opt,
                stdin,
                destination(stdout),
                destination(stderr),
                result
            );
        } catch (error) {
            finishing = true;
            cleanup();
            throw error;
        }
    };
}

function run(args) {
    if (args.length < 2) throw new Error(USAGE);
    const { entry, novacom } = validateCli(args[0], args[1]);
    const implementation = require(novacom);
    const prototype =
        implementation.Session && implementation.Session.prototype;
    if (!prototype || typeof prototype.checkConnection !== "function") {
        throw new Error(
            "The CLI TCP probe interface differs from the verified package."
        );
    }
    // Keep the first probe result, including errors. The separate begin() method
    // still establishes the SSH session and authenticates with the original key.
    prototype.checkConnection = completeOnce(prototype.checkConnection);
    if (args[1] === "ares-novacom" && args.slice(2).includes("--run")) {
        if (
            typeof prototype.begin !== "function" ||
            typeof prototype.run_ssh !== "function"
        ) {
            throw new Error(
                "The CLI command stream interface differs from the verified package."
            );
        }
        prototype.begin = completeOnce(prototype.begin);
        prototype.run_ssh = drainRun(prototype.run_ssh);
    }
    process.argv = [process.execPath, entry, ...args.slice(2)];
    require(entry);
}

module.exports = { completeOnce, drainRun, run, validateCli };

if (require.main === module) {
    if (process.argv.length === 3 && process.argv[2] === "--help") {
        console.log(
            USAGE + "\nSupported commands: " + [...COMMANDS].join(", ")
        );
    } else {
        try {
            run(process.argv.slice(2));
        } catch (error) {
            console.error("ares-compat: " + error.message);
            process.exitCode = 1;
        }
    }
}
