"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { completeOnce, validateCli } = require("./ares-compat.cjs");

test("TCP probe completes once per call and preserves the first result and context", () => {
    const owner = {};
    const failure = new Error("connection refused");
    const wrapped = completeOnce(function (target, next) {
        assert.equal(this, owner);
        next(...target.first);
        next(...target.second);
        return 42;
    });
    const calls = [];
    assert.equal(
        wrapped.call(
            owner,
            { first: [null, "target"], second: [failure] },
            (...args) => calls.push(args)
        ),
        42
    );
    wrapped.call(
        owner,
        { first: [failure], second: [null, "target"] },
        (...args) => calls.push(args)
    );
    assert.deepEqual(calls, [[null, "target"], [failure]]);
});

test("unknown versions, changed source, command paths and redirected files fail closed", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ares-compat-test-"));
    t.after(() => fs.rmSync(root, { force: true, recursive: true }));
    fs.mkdirSync(path.join(root, "bin"));
    fs.mkdirSync(path.join(root, "lib/base"), { recursive: true });
    fs.writeFileSync(path.join(root, "bin/ares-device.js"), "");
    fs.writeFileSync(path.join(root, "lib/base/novacom.js"), "unverified");
    const metadata = {
        bin: { "ares-device": "bin/ares-device.js" },
        name: "@webos-tools/cli",
        version: "3.2.7",
    };
    const save = () =>
        fs.writeFileSync(
            path.join(root, "package.json"),
            JSON.stringify(metadata)
        );
    save();
    assert.throws(
        () => validateCli(root, "../ares-device"),
        /Supported commands/
    );
    assert.throws(() => validateCli(root, "ares-device"), /requires exactly/);
    metadata.version = "3.2.6";
    save();
    assert.throws(() => validateCli(root, "ares-device"), /verified SHA256/);
    metadata.bin["ares-device"] = "../outside.js";
    save();
    assert.throws(() => validateCli(root, "ares-device"), /command mapping/);
    metadata.bin["ares-device"] = "bin/ares-device.js";
    save();
    fs.renameSync(path.join(root, "bin"), path.join(root, "elsewhere"));
    // A directory junction needs no Windows file-symlink privilege. On POSIX,
    // the type is ignored and this still exercises a real redirected path.
    fs.symlinkSync(
        path.join(root, "elsewhere"),
        path.join(root, "bin"),
        "junction"
    );
    assert.throws(() => validateCli(root, "ares-device"), /redirected paths/);
});

test("launcher preserves CLI argument boundaries and only wraps the TCP probe", () => {
    const root = path.resolve("/verified-cli");
    const entry = path.join(root, "bin/ares-install.js");
    const novacom = path.join(root, "lib/base/novacom.js");
    const begin = () => {};
    const probe = () => {};
    function Session() {}
    Session.prototype = { begin, checkConnection: probe };
    const metadata = {
        bin: { "ares-install": "bin/ares-install.js" },
        name: "@webos-tools/cli",
        version: "3.2.6",
    };
    const loaded = [];
    const processStub = { argv: ["original"], execPath: "/node" };
    const moduleStub = { exports: {} };
    const requireStub = (name) => {
        if (name === "node:path") return path;
        if (name === "node:fs")
            return {
                readFileSync: (value) =>
                    value.endsWith("package.json")
                        ? JSON.stringify(metadata)
                        : "verified source",
                realpathSync: (value) => value,
                statSync: () => ({ isFile: () => true }),
            };
        if (name === "node:crypto")
            return {
                createHash: () => ({
                    update: () => ({
                        digest: () =>
                            "0019b58f8f9020bb6a76b96eff81b44134e42247ae2aa72af44669e2f74466d8",
                    }),
                }),
            };
        loaded.push(name);
        if (name === novacom) return { Session };
        assert.equal(name, entry);
    };
    vm.runInNewContext(
        fs.readFileSync(path.join(__dirname, "ares-compat.cjs"), "utf8"),
        { module: moduleStub, process: processStub, require: requireStub }
    );
    const args = [
        "--device",
        "Living room TV",
        "/downloads/an app.ipk",
        "--",
        "$literal",
    ];
    moduleStub.exports.run([root, "ares-install", ...args]);
    assert.deepEqual(Array.from(processStub.argv), ["/node", entry, ...args]);
    assert.deepEqual(loaded, [novacom, entry]);
    assert.equal(Session.prototype.begin, begin);
    assert.notEqual(Session.prototype.checkConnection, probe);
});
