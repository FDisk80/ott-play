"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const {
    installTimeoutProbes,
    parseProbeEvent,
} = require("./helpers/permission-timeout-probes.cjs");

const source = Object.freeze({
    id: "source-fixture-123-folder",
    kind: "folder",
    name: "Profile cartoons",
});
const catalog = Object.freeze({
    cancelled: false,
    readErrorName: "TimeoutError",
    readErrorPhase: "permission",
    scanning: false,
    sources: Object.freeze([source]),
});
const never = new Promise(() => {});

function fixture(options = {}) {
    const calls = [],
        logs = [],
        timers = new Map(),
        deferred = new Map();
    const databases = new Map();
    let now = 0,
        timerId = 0;
    const fresh = { identity: "folder", kind: "directory", tag: "fresh" };
    const restored = { ...fresh, tag: "restored" };
    const record = Object.freeze({ ...source, handle: restored });
    function later(name, callback) {
        if (options.hold === name) deferred.set(name, callback);
        else queueMicrotask(callback);
    }
    function open(name, version) {
        calls.push(["open", name, version]);
        const app = name === "ott-local-media";
        assert.ok(
            app || name === "ott-direct-media-permission-probe-unit-unique"
        );
        const request = {};
        const db = {
            close() {
                calls.push(["close", name]);
            },
            createObjectStore(store) {
                assert.equal(app, false, "never upgrade application storage");
                assert.equal(store, "handles");
                databases.set(name, new Map());
            },
            transaction(store, mode) {
                calls.push(["transaction", name, store, mode]);
                if (app) {
                    assert.equal(
                        mode,
                        "readonly",
                        "application records are read-only"
                    );
                    assert.equal(store, "files");
                } else assert.equal(store, "handles");
                let active = true;
                const tx = {
                    abort() {
                        if (!active) return;
                        active = false;
                        calls.push(["abort", name]);
                        queueMicrotask(() => tx.onabort?.());
                    },
                    objectStore() {
                        return {
                            get(key) {
                                assert.equal(key, app ? source.id : "fresh");
                                const getRequest = {};
                                later(app ? "app-read" : "read", () => {
                                    if (!active) return;
                                    getRequest.result = app
                                        ? record
                                        : databases.get(name).get(key);
                                    getRequest.onsuccess();
                                    active = false;
                                    tx.oncomplete();
                                });
                                return getRequest;
                            },
                            put(value, key) {
                                assert.equal(app, false);
                                assert.equal(value, fresh);
                                assert.equal(key, "fresh");
                                later("write", () => {
                                    if (!active) return;
                                    databases.get(name).set(key, {
                                        ...value,
                                        tag: "roundtrip",
                                    });
                                    active = false;
                                    tx.oncomplete();
                                });
                            },
                        };
                    },
                };
                return tx;
            },
        };
        later(app ? "app-open" : "open", () => {
            request.result = db;
            request.transaction = {
                abort() {
                    calls.push(["upgrade-abort", name]);
                },
            };
            if (!app) request.onupgradeneeded();
            request.onsuccess();
        });
        return request;
    }
    const w = {
        clearTimeout(id) {
            timers.delete(id);
        },
        console: { log: (line) => logs.push(line) },
        crypto: { randomUUID: () => "unit-unique" },
        FileSystemDirectoryHandle: {
            prototype: {
                getDirectoryHandle(name, flags) {
                    calls.push(["folder", name, flags.create]);
                    assert.equal(this.tag, "root");
                    assert.equal(name, "Profile cartoons");
                    assert.equal(flags.create, false);
                    return Promise.resolve(fresh);
                },
            },
        },
        FileSystemHandle: {
            prototype: {
                isSameEntry(other) {
                    calls.push(["identity", this.tag, other.tag]);
                    assert.equal(this, restored);
                    assert.equal(other, fresh);
                    if (options.hang?.includes("identity")) return never;
                    return Promise.resolve(
                        options.sameEntry ?? this.identity === other.identity
                    );
                },
            },
        },
        indexedDB: {
            deleteDatabase(name) {
                assert.equal(
                    name,
                    "ott-direct-media-permission-probe-unit-unique"
                );
                calls.push(["delete", name]);
                const request = {};
                later("delete", () => {
                    databases.delete(name);
                    request.onsuccess();
                });
                return request;
            },
            open,
        },
        navigator: {
            storage: {
                getDirectory() {
                    calls.push(["root"]);
                    return Promise.resolve({ kind: "directory", tag: "root" });
                },
            },
        },
        performance: { now: () => now },
        setTimeout(fn, delay) {
            assert.equal(delay, 10000, "each arm retains its ten-second bound");
            timers.set(++timerId, { at: now + delay, fn });
            return timerId;
        },
        structuredClone(value) {
            calls.push(["clone", value.tag]);
            assert.equal(value, fresh);
            if (options.cloneError) {
                const error = new Error("private clone failure detail");
                error.name = "DataCloneError";
                throw error;
            }
            return { ...value, tag: "clone" };
        },
    };
    const nativeQuery = function (mode) {
        calls.push(["query", this.tag, mode.mode]);
        assert.equal(mode.mode, "read");
        if (this.tag === "roundtrip") {
            assert.equal(
                databases.size,
                1,
                "query before deleting the disposable database"
            );
            assert.equal(
                calls.some(
                    (row) => row[0] === "close" && row[1] !== "ott-local-media"
                ),
                false,
                "query while the disposable connection remains open"
            );
        }
        if (options.hang?.includes(this.tag)) return never;
        if (options.reject === this.tag) {
            const error = new Error("private credentials and filesystem paths");
            error.name = "NotAllowedError";
            return Promise.reject(error);
        }
        return Promise.resolve(options.access?.[this.tag] || "granted");
    };
    // The real browser fixture serializes only the installer, without module scope.
    vm.runInNewContext(`(${installTimeoutProbes.toString()})(w, nativeQuery)`, {
        nativeQuery,
        w,
    });
    async function flush() {
        for (let i = 0; i < 100; i++) await Promise.resolve();
    }
    async function drain(pending) {
        let done = false,
            rejection;
        pending.then(
            () => {
                done = true;
            },
            (error) => {
                done = true;
                rejection = error;
            }
        );
        for (let turn = 0; turn < 10 && !done; turn++) {
            await flush();
            if (done) break;
            const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
            assert.ok(next, "pending diagnostics always have a finite timer");
            now = next[1].at;
            timers.delete(next[0]);
            next[1].fn();
        }
        assert.equal(
            done,
            true,
            "diagnostics finish within their five-arm budget"
        );
        if (rejection) throw rejection;
    }
    const events = () =>
        logs.map((line) => {
            assert.ok(line.startsWith("[direct-media-probe] "));
            return parseProbeEvent(line.slice("[direct-media-probe] ".length));
        });
    return {
        calls,
        databases,
        deferred,
        drain,
        events,
        flush,
        logs,
        now: () => now,
        record,
        restored,
        timers,
        w,
    };
}

test("installation and non-timeout catalogs perform no native or storage work", async () => {
    const f = fixture();
    assert.equal(f.calls.length, 0);
    assert.equal(f.timers.size, 0);
    for (const input of [
        null,
        {},
        { ...catalog, scanning: true },
        { ...catalog, cancelled: true },
        { ...catalog, readErrorPhase: "read" },
        { ...catalog, readErrorName: "NotAllowedError" },
    ]) {
        await f.w.__directMediaTimeoutProbes(input);
    }
    assert.equal(f.calls.length, 0);
    assert.equal(f.logs.length, 0);
    assert.equal(f.timers.size, 0);
    await f.drain(f.w.__directMediaTimeoutProbes(catalog));
    assert.equal(
        f.events().filter((row) => row.event === "complete").length,
        5
    );
});

test("captured natives compare restored identity and query fresh clone/isolated roundtrip", async () => {
    const f = fixture({ hang: ["restored"] });
    const changed = () => {
        throw new Error("fixture wrapper must not run");
    };
    f.w.FileSystemHandle.prototype.isSameEntry = changed;
    f.w.FileSystemDirectoryHandle.prototype.getDirectoryHandle = changed;
    f.w.navigator.storage.getDirectory = changed;
    f.w.indexedDB.open = f.w.indexedDB.deleteDatabase = changed;
    f.w.structuredClone = changed;
    await f.drain(f.w.__directMediaTimeoutProbes(catalog));
    assert.deepEqual(
        f.calls.filter((row) => row[0] === "query").map((row) => row[1]),
        ["restored", "fresh", "clone", "roundtrip"]
    );
    assert.deepEqual(
        f.calls.find((row) => row[0] === "identity"),
        ["identity", "restored", "fresh"]
    );
    assert.equal(
        f
            .events()
            .find((row) => row.probe === "identity" && row.event === "complete")
            .sameEntry,
        true
    );
    assert.equal(f.events().filter((row) => row.event === "timeout").length, 1);
    assert.equal(f.now(), 10000);
    assert.equal(f.record.handle, f.restored);
    assert.equal(f.databases.size, 0);
    assert.equal(f.timers.size, 0);
    const deletion = f.calls.findIndex((row) => row[0] === "delete");
    assert.ok(
        deletion >
            f.calls.findIndex(
                (row) => row[0] === "query" && row[1] === "roundtrip"
            )
    );
    const callsBefore = f.calls.length;
    await f.w.__directMediaTimeoutProbes(catalog);
    assert.equal(
        f.calls.length,
        callsBefore,
        "a second request never retries native operations"
    );
    assert.equal(f.events().at(-1).event, "skipped");
    assert.ok(f.logs.length <= 64);
    assert.ok(!f.logs.join("\n").includes(source.id));
    assert.ok(!f.logs.join("\n").includes(source.name));
});

test("all native promises can remain pending without exceeding 50 seconds", async () => {
    const f = fixture({
        hang: ["restored", "fresh", "identity", "clone", "roundtrip"],
    });
    await f.drain(f.w.__directMediaTimeoutProbes(catalog));
    assert.equal(f.now(), 50000);
    assert.equal(f.events().filter((row) => row.event === "timeout").length, 5);
    assert.equal(
        f.databases.size,
        0,
        "timeout cleans up the database after a hanging query"
    );
    assert.equal(f.timers.size, 0);
    assert.ok(f.logs.length <= 64);
});

for (const stage of ["open", "write", "read", "delete"]) {
    test(`isolated ${stage} stalls stay bounded and late work cannot start new queries or writes`, async () => {
        const f = fixture({ hold: stage });
        await f.drain(f.w.__directMediaTimeoutProbes(catalog));
        assert.equal(f.now(), 10000);
        const timeout = f.events().find((row) => row.event === "timeout");
        assert.equal(timeout.probe, "roundtrip");
        assert.equal(timeout.stage, `isolated-${stage}`);
        assert.equal(
            f.calls.some((row) => row[0] === "query" && row[1] === "roundtrip"),
            stage === "delete"
        );
        const transactionsBefore = f.calls.filter(
            (row) => row[0] === "transaction"
        ).length;
        f.deferred.get(stage)();
        await f.flush();
        assert.equal(
            f.calls.filter((row) => row[0] === "transaction").length,
            transactionsBefore
        );
        assert.equal(
            f.calls.some((row) => row[0] === "query" && row[1] === "roundtrip"),
            stage === "delete"
        );
        assert.equal(f.timers.size, 0);
        assert.equal(f.databases.size, 0);
        assert.ok(f.calls.some((row) => row[0] === "delete"));
        if (stage !== "delete")
            assert.ok(
                f.calls.some(
                    (row) => row[0] === "close" && row[1] !== "ott-local-media"
                )
            );
    });
}

test("mismatched identity, denied access and native errors are diagnostic values, not grants", async () => {
    const f = fixture({
        access: { clone: "denied" },
        reject: "roundtrip",
        sameEntry: false,
    });
    await f.drain(f.w.__directMediaTimeoutProbes(catalog));
    const result = (probe) =>
        f
            .events()
            .find(
                (row) =>
                    row.probe === probe &&
                    ["complete", "rejected"].includes(row.event)
            );
    assert.equal(result("identity").sameEntry, false);
    assert.equal(result("clone").access, "denied");
    assert.equal(result("roundtrip").error, "NotAllowedError");
    assert.ok(!f.logs.join("\n").includes("private credentials"));
    assert.equal(f.databases.size, 0);
});

test("a synchronous clone error is identified without exposing its message or stopping other probes", async () => {
    const f = fixture({ cloneError: true });
    await f.drain(f.w.__directMediaTimeoutProbes(catalog));
    const error = f
        .events()
        .find((row) => row.probe === "clone" && row.event === "rejected");
    assert.equal(error.error, "DataCloneError");
    assert.ok(
        f
            .events()
            .some(
                (row) => row.probe === "roundtrip" && row.event === "complete"
            )
    );
    assert.ok(!f.logs.join("\n").includes("private clone failure"));
    assert.equal(f.databases.size, 0);
});

test("the actual browser failure block still throws the original failure after successful probes", async () => {
    const text = fs.readFileSync(
        path.join(__dirname, "test_browser_direct_media.cjs"),
        "utf8"
    );
    const block = text.match(
        /if \(rawCatalog\.readErrorName \|\| rawCatalog\.reconnectRequired\) \{[\s\S]*?throw originalPermissionFailure;\s*\}/
    );
    assert.ok(
        block,
        "exercise the real failure-only caller, not a replacement assertion"
    );
    const f = fixture();
    f.w.__directMediaProfilePermission = {
        queries: 1,
        queriesRejected: 0,
        queriesResolved: 0,
    };
    const runFailure = vm.runInNewContext(
        `(async (window, rawCatalog) => {${block[0]}})`
    );
    await assert.rejects(f.drain(runFailure(f.w, catalog)), {
        message:
            "Profile catalog permission timed out; native permission queries=1, resolved=0, rejected=0",
    });
    assert.equal(
        f.events().filter((row) => row.event === "complete").length,
        5
    );
    f.w.__directMediaTimeoutProbes = async () => {
        throw new Error("diagnostic failed");
    };
    await assert.rejects(runFailure(f.w, catalog), {
        message:
            "Profile catalog permission timed out; native permission queries=1, resolved=0, rejected=0",
    });
});

test("invalid source identity never opens databases, and event schema forbids private or unbounded data", async () => {
    const f = fixture();
    await f.w.__directMediaTimeoutProbes({
        ...catalog,
        sources: [{ ...source, name: "Other" }],
    });
    assert.equal(f.calls.length, 0);
    assert.equal(f.events().at(-1).event, "invalid-source");
    const event = {
        elapsedMs: 1,
        event: "complete",
        ordinal: 1,
        probe: "identity",
        sameEntry: true,
        stage: "native-same-entry",
    };
    assert.deepEqual(parseProbeEvent(JSON.stringify(event)), event);
    for (const invalid of [
        { ...event, path: "/private" },
        { ...event, sameEntry: "yes" },
        { ...event, ordinal: 65 },
        { ...event, elapsedMs: 120001 },
        { ...event, probe: "unknown" },
        { ...event, stage: "unknown" },
    ]) {
        assert.throws(
            () => parseProbeEvent(JSON.stringify(invalid)),
            /PROBE_EVENT_SHAPE/
        );
    }
    assert.throws(() => parseProbeEvent("x".repeat(2049)), /PROBE_EVENT_BOUND/);
});

function reopenFixture() {
    const source = fs.readFileSync(
        path.join(__dirname, "test_browser_direct_media.cjs"),
        "utf8"
    );
    const start = source.indexOf('checkpoint("close saved-profile page");');
    const end = source.indexOf("const profilePhasePrefix", start);
    assert(start >= 0 && end > start, "use the real page-reopen sequence");
    const deferred = () => {
        let resolve, reject;
        const promise = new Promise((yes, no) => {
            resolve = yes;
            reject = no;
        });
        return { promise, reject, resolve };
    };
    const close = deferred(),
        create = deferred(),
        navigate = deferred();
    const phases = [],
        calls = [],
        output = [];
    let closeEvent;
    const reopened = {
        goto(address) {
            assert.equal(address, "private fixture address");
            calls.push("goto");
            return navigate.promise;
        },
    };
    const completion = vm.runInNewContext(
        `(async () => {${source.slice(start, end)}})()`,
        {
            address: "private fixture address",
            checkpoint: (phase) => phases.push(phase),
            console: { log: (value) => output.push(value) },
            profileContext: {
                newPage() {
                    calls.push("newPage");
                    return create.promise;
                },
            },
            profilePage: {
                close() {
                    calls.push("close");
                    return close.promise;
                },
                once(event, handler) {
                    assert.equal(event, "close");
                    closeEvent = handler;
                },
            },
        }
    );
    return {
        calls,
        close,
        closeEvent,
        completion,
        create,
        navigate,
        output,
        phases,
        reopened,
    };
}

test("reopen checkpoints distinguish pending close, creation and navigation without waiting for a close event", async () => {
    const f = reopenFixture();
    assert.deepEqual(f.calls, ["close"]);
    assert.deepEqual(f.phases, ["close saved-profile page"]);
    f.closeEvent();
    assert.deepEqual(
        f.phases,
        ["close saved-profile page"],
        "close event is not close-promise completion"
    );
    f.close.resolve();
    await new Promise(setImmediate);
    assert.deepEqual(f.calls, ["close", "newPage"]);
    assert.equal(f.phases.at(-1), "create reopened-profile page");
    f.create.resolve(f.reopened);
    await new Promise(setImmediate);
    assert.deepEqual(f.calls, ["close", "newPage", "goto"]);
    assert.equal(f.phases.at(-1), "navigate reopened-profile page");
    f.navigate.resolve();
    await f.completion;
    assert.deepEqual(f.phases, [
        "close saved-profile page",
        "create reopened-profile page",
        "navigate reopened-profile page",
        "profile import/load after reopen",
    ]);
    assert.deepEqual(f.output, [
        '[direct-media-native] {"event":"saved-profile-page-closed"}',
    ]);
    assert(!f.phases.join(" ").includes("private fixture address"));
});

for (const stage of ["close", "create", "navigate"]) {
    test(`reopen ${stage} rejection retains the original error and its exact last phase`, async () => {
        const f = reopenFixture();
        const failure = new Error("private original rejection");
        const rejected = assert.rejects(
            f.completion,
            (error) => error === failure
        );
        if (stage !== "close") {
            f.close.resolve();
            await new Promise(setImmediate);
        }
        if (stage === "navigate") {
            f.create.resolve(f.reopened);
            await new Promise(setImmediate);
        }
        f[stage].reject(failure);
        await rejected;
        const phases = {
            close: "close saved-profile page",
            create: "create reopened-profile page",
            navigate: "navigate reopened-profile page",
        };
        assert.equal(f.phases.at(-1), phases[stage]);
        assert.equal(
            f.calls.length,
            ["close", "create", "navigate"].indexOf(stage) + 1
        );
        assert(!f.phases.join(" ").includes(failure.message));
    });
}

test("original permission failure reaches the actual nonzero terminal handler unchanged", async () => {
    const source = fs.readFileSync(
        path.join(__dirname, "test_browser_direct_media.cjs"),
        "utf8"
    );
    const block = source.match(
        /if \(rawCatalog\.readErrorName \|\| rawCatalog\.reconnectRequired\) \{[\s\S]*?throw originalPermissionFailure;\s*\}/
    );
    const terminal = source.match(
        /\(error\) => \{\s*clearTimeout\(deadline\);\s*console\.error\([\s\S]*?process\.exit\(1\);\s*\}/
    );
    assert(
        block && terminal,
        "use the real permission failure and terminal handler"
    );
    for (const probeFails of [false, true]) {
        let original, observed;
        const codes = [],
            logs = [],
            cleared = [];
        const context = {
            clearTimeout: (value) => cleared.push(value),
            console: { error: (...args) => logs.push(args) },
            deadline: 42,
            Error: function (message) {
                original = new Error(message);
                return original;
            },
            phase: "profile reopen: list-resolved",
            process: { exit: (code) => codes.push(code) },
        };
        const run = vm.runInNewContext(
            `(async (window, rawCatalog) => {${block[0]}})`,
            context
        );
        await assert.rejects(
            run(
                {
                    __directMediaProfilePermission: {
                        queries: 1,
                        queriesRejected: 0,
                        queriesResolved: 0,
                    },
                    __directMediaTimeoutProbes: async () => {
                        if (probeFails)
                            throw new Error("private diagnostic error");
                    },
                },
                catalog
            ),
            (error) => {
                observed = error;
                return error === original;
            }
        );
        const fail = vm.runInNewContext(`(${terminal[0]})`, context);
        fail(observed);
        assert.deepEqual(codes, [1]);
        assert.deepEqual(cleared, [42]);
        assert.equal(logs.length, 1);
        assert.equal(logs[0][1], original);
        assert(!original.message.includes("private diagnostic error"));
    }
});
