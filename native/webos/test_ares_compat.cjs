"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const { Stream, Writable } = require("node:stream");
const { completeOnce, drainRun, validateCli } = require("./ares-compat.cjs");

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
        if (name === "node:stream") return { Stream };
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

// Synthetic contract fixture, not copied SDK code. It deliberately completes
// on exit before output EOF, ends Writable destinations at stdout EOF, and
// leaves stderr data in the exit diagnostic. The pinned SDK is tested separately.
function earlyExitRun(command, options, input, output, errorOutput, next) {
    this.ssh.exec(command, options, (error, channel) => {
        if (error) return next(error);
        let exited = false;
        let diagnostic = "";
        channel.on("data", (data) => {
            if (typeof output === "function") output(data);
            else if (output) output.write(data);
        });
        channel.stderr.on("data", (data) => {
            diagnostic += data;
        });
        channel.on("end", () => {
            for (const target of [output, errorOutput]) {
                if (target instanceof Stream) target.end();
            }
        });
        channel.on("exit", (code, signal) => {
            exited = true;
            const failure =
                code || signal
                    ? Object.assign(new Error(diagnostic), { code, signal })
                    : null;
            setImmediate(() => next(failure));
        });
        channel.on("close", () => {
            if (!exited) setImmediate(() => next(null));
        });
    });
    return 19;
}

const turn = () => new Promise((resolve) => setImmediate(resolve));
function streamFixture({ wrapped = true, destination, holdOpen = false } = {}) {
    const client = new EventEmitter();
    const channel = new EventEmitter();
    channel.stderr = new EventEmitter();
    const chunks = [];
    const output =
        destination ||
        new Writable({
            write(chunk, encoding, done) {
                chunks.push(Buffer.from(chunk));
                done();
            },
        });
    let open;
    client.exec = (command, options, callback) => {
        assert.equal(command, "fixed command");
        assert.deepEqual(options, { fixed: true });
        open = callback;
        if (!holdOpen) callback(null, channel);
    };
    const originalExec = client.exec;
    const results = [];
    let resolve;
    const done = new Promise((value) => {
        resolve = value;
    });
    const run = wrapped ? drainRun(earlyExitRun) : earlyExitRun;
    assert.equal(
        run.call(
            { ssh: client },
            "fixed command",
            { fixed: true },
            null,
            output,
            null,
            (error) => {
                results.push(error);
                resolve(error);
            }
        ),
        19
    );
    assert.equal(
        client.exec,
        originalExec,
        "shared SSH client must not be patched"
    );
    return {
        channel,
        chunks,
        clean() {
            for (const target of [client, channel, channel.stderr, output]) {
                assert.equal(target.listenerCount("error"), 0);
            }
            assert.equal(client.listenerCount("close"), 0);
            assert.equal(channel.stderr.listenerCount("end"), 0);
            assert.equal(channel.stderr.listenerCount("close"), 0);
        },
        client,
        done,
        endError() {
            channel.stderr.emit("end");
            channel.stderr.emit("close");
        },
        endMain() {
            channel.emit("end");
            channel.emit("close");
        },
        open: (...args) => open(...args),
        output,
        results,
    };
}

test("synthetic early-exit fixture exposes success before the output tail", {
    timeout: 2000,
}, async () => {
    const fixture = streamFixture({ wrapped: false });
    fixture.channel.emit("data", Buffer.from("head"));
    fixture.channel.emit("exit", 0);
    await fixture.done;
    assert.equal(Buffer.concat(fixture.chunks).toString(), "head");
    fixture.channel.emit("data", Buffer.from("tail"));
    fixture.endMain();
    fixture.endError();
    assert.equal(Buffer.concat(fixture.chunks).toString(), "headtail");
});

test("run drain waits for both channels and preserves the exact output tail", {
    timeout: 2000,
}, async () => {
    const fixture = streamFixture();
    const data = Buffer.from([0, 255, 10, 13, 65]);
    fixture.channel.emit("data", data.subarray(0, 2));
    fixture.channel.emit("exit", 0);
    await turn();
    assert.equal(fixture.results.length, 0);
    fixture.channel.emit("data", data.subarray(2));
    fixture.endMain();
    await turn();
    assert.equal(fixture.results.length, 0, "stderr remains open");
    fixture.channel.stderr.emit("data", Buffer.from("not stdout"));
    fixture.endError();
    assert.equal(await fixture.done, null);
    assert.deepEqual(Buffer.concat(fixture.chunks), data);
    assert.equal(fixture.output.writableFinished, true);
    fixture.channel.emit("exit", 0);
    await turn();
    assert.equal(fixture.results.length, 1);
    fixture.clean();
});

test("run drain waits for real Writable flush and reports a write error", {
    timeout: 2000,
}, async () => {
    let finishWrite;
    const failure = new Error("controlled write failure");
    const output = new Writable({
        write(chunk, encoding, done) {
            finishWrite = done;
        },
    });
    const fixture = streamFixture({ destination: output });
    fixture.channel.emit("data", Buffer.from("pending"));
    fixture.channel.emit("exit", 0);
    fixture.endMain();
    fixture.endError();
    await turn();
    assert.equal(fixture.results.length, 0);
    finishWrite(failure);
    assert.equal(await fixture.done, failure);
    fixture.clean();
});

test("run drain preserves nonzero exit and stderr diagnostic over later cancellation", {
    timeout: 2000,
}, async () => {
    const fixture = streamFixture();
    fixture.channel.stderr.emit("data", Buffer.from("controlled stderr"));
    fixture.channel.emit("exit", 7, null);
    await turn();
    fixture.client.emit("error", new Error("later cancellation"));
    fixture.endMain();
    fixture.endError();
    const error = await fixture.done;
    assert.equal(error.code, 7);
    assert.equal(error.message, "controlled stderr");
    fixture.clean();
});

test("run drain preserves signal exit and detects premature channel close", {
    timeout: 2000,
}, async () => {
    const signal = streamFixture();
    signal.channel.emit("exit", null, "TERM");
    signal.endMain();
    signal.endError();
    assert.equal((await signal.done).signal, "TERM");
    signal.clean();
    const closed = streamFixture();
    closed.channel.emit("exit", 0);
    closed.channel.emit("close");
    closed.endError();
    assert.equal((await closed.done).code, "ARES_PREMATURE_STREAM_CLOSE");
    closed.clean();
});

test("run drain retains late channel errors and transport cancellation", {
    timeout: 2000,
}, async () => {
    for (const target of ["channel", "client"]) {
        const fixture = streamFixture();
        const failure = new Error("controlled late error");
        fixture.channel.emit("exit", 0);
        await turn();
        fixture[target].emit("error", failure);
        fixture.endMain();
        fixture.endError();
        assert.equal(await fixture.done, failure);
        fixture.clean();
    }
});

test("run drain preserves prebind transport failure and cleans up after exec failure", {
    timeout: 2000,
}, async () => {
    const fixture = streamFixture({ holdOpen: true });
    fixture.client.emit("error", new Error("transport failed before channel"));
    fixture.client.emit("close");
    await turn();
    assert.equal(fixture.results.length, 0);
    const failure = new Error("exec failed");
    fixture.open(failure);
    assert.equal(await fixture.done, failure);
    fixture.clean();
});

test("run drain accepts clean close without exit and rejects transport close before drain", {
    timeout: 2000,
}, async () => {
    const clean = streamFixture();
    clean.endMain();
    clean.endError();
    assert.equal(await clean.done, null);
    clean.clean();
    const cancelled = streamFixture();
    cancelled.client.emit("close");
    cancelled.channel.emit("exit", 0);
    cancelled.endMain();
    cancelled.endError();
    assert.equal((await cancelled.done).code, "ARES_TRANSPORT_CLOSED");
    cancelled.clean();
});

test("run drain preserves late errors while the destination is still flushing", {
    timeout: 2000,
}, async () => {
    let finish;
    const output = new Writable({
        final(done) {
            finish = done;
        },
        write(chunk, encoding, done) {
            done();
        },
    });
    const fixture = streamFixture({ destination: output });
    fixture.channel.emit("exit", 0);
    fixture.endMain();
    fixture.endError();
    await turn();
    assert.equal(fixture.results.length, 0);
    assert.equal(typeof finish, "function");
    const failure = new Error("controlled error during flush");
    fixture.channel.emit("error", failure);
    finish();
    assert.equal(await fixture.done, failure);
    fixture.clean();
});

test("run drain removes its listeners when exec throws synchronously", () => {
    const failure = new Error("synchronous exec failure");
    const client = new EventEmitter();
    client.exec = () => {
        throw failure;
    };
    const output = new Writable({
        write(chunk, encoding, done) {
            done();
        },
    });
    assert.throws(
        () =>
            drainRun(earlyExitRun).call(
                { ssh: client },
                "fixed command",
                {},
                null,
                output,
                null,
                () => assert.fail("callback after throw")
            ),
        (error) => error === failure
    );
    assert.equal(client.listenerCount("error"), 0);
    assert.equal(client.listenerCount("close"), 0);
    assert.equal(output.listenerCount("error"), 0);
});

function launchContract(command, args) {
    const root = path.resolve("/verified-cli");
    const entry = path.join(root, "bin", command + ".js");
    const novacom = path.join(root, "lib/base/novacom.js");
    const original = { begin() {}, checkConnection() {}, run_ssh() {} };
    function Session() {}
    Session.prototype = { ...original };
    const moduleStub = { exports: {} };
    const processStub = { argv: [], execPath: "/node" };
    vm.runInNewContext(
        fs.readFileSync(path.join(__dirname, "ares-compat.cjs"), "utf8"),
        {
            module: moduleStub,
            process: processStub,
            require(name) {
                if (name === "node:path") return path;
                if (name === "node:stream") return { Stream };
                if (name === "node:fs")
                    return {
                        readFileSync: (file) =>
                            file.endsWith("package.json")
                                ? JSON.stringify({
                                      bin: {
                                          [command]: "bin/" + command + ".js",
                                      },
                                      name: "@webos-tools/cli",
                                      version: "3.2.6",
                                  })
                                : "synthetic guarded source",
                        realpathSync: (file) => file,
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
                if (name === novacom) return { Session };
                assert.equal(name, entry);
            },
        }
    );
    moduleStub.exports.run([root, command, ...args]);
    assert.deepEqual(Array.from(processStub.argv), ["/node", entry, ...args]);
    assert.notEqual(
        Session.prototype.checkConnection,
        original.checkConnection
    );
    return { actual: Session.prototype, original };
}

test("drain activates only for explicit novacom --run and leaves other commands unchanged", () => {
    for (const [command, args, active] of [
        ["ares-novacom", ["--device", "TV", "--run", "fixed command"], true],
        ["ares-novacom", ["--device", "TV", "--forward", "1234"], false],
        ["ares-install", ["--run", "literal argument"], false],
        ["ares-launch", ["--running"], false],
    ]) {
        const { original, actual } = launchContract(command, args);
        for (const name of ["begin", "run_ssh"]) {
            assert.equal(actual[name] === original[name], !active);
        }
    }
});
