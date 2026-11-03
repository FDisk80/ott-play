#!/usr/bin/env node
"use strict";

// Explicit, process-local workaround for the verified CLI 3.2.6 TCP probe.
// Do not load through global NODE_OPTIONS or modify the installed CLI.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

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
    process.argv = [process.execPath, entry, ...args.slice(2)];
    require(entry);
}

module.exports = { completeOnce, run, validateCli };

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
