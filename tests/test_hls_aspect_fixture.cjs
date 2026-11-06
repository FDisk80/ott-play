const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const {
    createHlsAspectFixture,
    normalizeHlsInit,
    validateHlsInit,
} = require("./helpers/hls-aspect-fixture.cjs");
const ts = fs.readFileSync(
    path.join(__dirname, "fixtures/media-runtime/segment00.ts")
);
const original = {};
const muxer = new (require("mux.js").mp4.Transmuxer)({ remux: false });
muxer.on("data", (segment) => {
    original[segment.type] = segment;
});
muxer.push(new Uint8Array(ts));
muxer.flush();
const fixture = createHlsAspectFixture(ts);
// Independently locate the fields in these generated version-zero boxes.
function timingOffset(bytes, type, delta) {
    const index = bytes.indexOf(Buffer.from(type));
    assert.ok(index > 4);
    assert.equal(bytes.indexOf(Buffer.from(type), index + 4), -1);
    assert.equal(bytes[index + 4], 0);
    return index - 4 + delta;
}
for (const type of ["audio", "video"]) {
    test(
        type +
            " HLS init meets header syntax without changing codec parameters or sample bytes",
        () => {
            const before = Buffer.from(original[type].initSegment);
            const after = fixture[type + "-init.mp4"];
            validateHlsInit(after);
            assert.throws(() => validateHlsInit(before));
            assert.equal(after.length, before.length);
            const expected = Buffer.from(before);
            expected.write("iso6", 8, 4, "ascii");
            expected.writeUInt32BE(0, timingOffset(before, "mvhd", 24));
            expected.writeUInt32BE(0, timingOffset(before, "tkhd", 28));
            if (type === "video") {
                const sample = before.indexOf(
                    Buffer.from("avc1"),
                    before.indexOf(Buffer.from("moov"))
                );
                const config = before.indexOf(Buffer.from("avcC"));
                // Independent positions in the known generated sample entry.
                assert.equal(sample, 417);
                assert.equal(config, 503);
                expected.writeUInt16BE(0xffff, sample + 80);
                expected[config + 9] |= 0xe0;
            }
            assert.deepEqual(after, expected);
            assert.deepEqual(
                fixture[type + "-segment.m4s"],
                Buffer.from(original[type].data)
            );
            assert.deepEqual(Buffer.from(original[type].initSegment), before);
            assert.deepEqual(normalizeHlsInit(after), after);
        }
    );
    test(
        type + " validator rejects each incorrect HLS initialization field",
        () => {
            const valid = fixture[type + "-init.mp4"];
            for (const offset of [
                8,
                timingOffset(valid, "mvhd", 24),
                timingOffset(valid, "tkhd", 28),
            ]) {
                const invalid = Buffer.from(valid);
                invalid.writeUInt32BE(0xffffffff, offset);
                assert.throws(() => validateHlsInit(invalid));
            }
        }
    );
}
test("fixture normalization rejects malformed or unsupported boxes", () => {
    const valid = fixture["video-init.mp4"];
    for (const input of [
        Buffer.alloc(0),
        valid.subarray(0, valid.length - 1),
        Buffer.alloc(1024 * 1024 + 1),
    ]) {
        assert.throws(() => normalizeHlsInit(input));
    }
    for (const size of [0, 1, 7, 0xffffffff]) {
        const invalid = Buffer.from(valid);
        invalid.writeUInt32BE(size, 0);
        assert.throws(() => normalizeHlsInit(invalid));
    }
    const unsupported = Buffer.from(valid);
    unsupported[timingOffset(valid, "mvhd", 8)] = 1;
    assert.throws(() => normalizeHlsInit(unsupported));
});
test("AVC validator rejects incorrect reserved fields independently", () => {
    const valid = fixture["video-init.mp4"];
    for (const offset of [497, 498, 512]) {
        const invalid = Buffer.from(valid);
        invalid[offset] = 0;
        assert.throws(() => validateHlsInit(invalid));
    }
});

function readinessObservationFixture({ brokenReporter = false } = {}) {
    const vm = require("node:vm");
    const { EventEmitter } = require("node:events");
    let now = 0;
    let unrefed = 0;
    const timers = new Map();
    const records = [];
    const page = new EventEmitter();
    const state = { closed: false, connected: true };
    page.isClosed = () => state.closed;
    page.context = () => ({
        browser: () => ({ isConnected: () => state.connected }),
    });
    page.evaluate = () => {
        throw new Error("Diagnostics contacted the page");
    };
    const context = {
        Buffer,
        clearTimeout: (timer) => timers.delete(timer),
        console: {
            error: (message) => {
                if (brokenReporter) throw new Error("Reporter unavailable");
                assert.ok(message.length < 8192);
                records.push(JSON.parse(message.slice(message.indexOf("{"))));
            },
        },
        module: { exports: {} },
        require: (name) => {
            assert.equal(name, "node:perf_hooks");
            return { performance: { now: () => now } };
        },
        setTimeout: (callback, delay) => {
            const timer = {
                unref: () => {
                    unrefed++;
                },
            };
            timers.set(timer, { at: now + delay, callback });
            return timer;
        },
    };
    vm.runInNewContext(
        fs.readFileSync(
            path.join(__dirname, "helpers/aspect-readiness-diagnostics.cjs"),
            "utf8"
        ),
        context
    );
    return {
        advance: (elapsed) => {
            now += elapsed;
            for (const [timer, value] of [...timers]) {
                if (value.at > now) continue;
                timers.delete(timer);
                value.callback();
            }
        },
        observe: context.module.exports,
        page,
        records,
        state,
        timers,
        unrefed: () => unrefed,
    };
}

test("readiness observation preserves success and removes only its own listener", async () => {
    const f = readinessObservationFixture();
    const external = () => {};
    f.page.on("crash", external);
    const value = {};
    assert.equal(
        await f.observe(
            f.page,
            { engine: "hls.js", phase: "reload" },
            () => value
        ),
        value
    );
    assert.equal(f.timers.size, 0);
    assert.equal(f.unrefed(), 1);
    assert.deepEqual(f.page.listeners("crash"), [external]);
    f.advance(60000);
    assert.deepEqual(f.records, []);
});

test("readiness rejection preserves the exact error without a page protocol call", async () => {
    for (const synchronous of [false, true]) {
        const f = readinessObservationFixture();
        const error = new Error("private URL or credential must not be logged");
        const operation = () => {
            if (synchronous) throw error;
            return Promise.reject(error);
        };
        await assert.rejects(
            f.observe(f.page, { engine: "shaka", phase: "next" }, operation),
            (actual) => actual === error
        );
        assert.deepEqual(f.records, [
            {
                browserConnected: true,
                crashed: false,
                elapsedMs: 0,
                engine: "shaka",
                event: "rejected",
                pageClosed: false,
                phase: "next",
            },
        ]);
        assert.equal(f.timers.size, 0);
        assert.equal(f.page.listenerCount("crash"), 0);
    }
});

test("host deadline records a stalled operation once without settling or cancelling it", async () => {
    const f = readinessObservationFixture();
    let reject;
    let settled = false;
    const pending = new Promise((resolve, rejectOperation) => {
        reject = rejectOperation;
    });
    const result = f.observe(
        f.page,
        {
            engine: "https://private.invalid/" + "x".repeat(10000),
            phase: "secret",
        },
        () => pending
    );
    const observed = result.then(
        () => {
            settled = true;
        },
        () => {
            settled = true;
        }
    );
    f.advance(14999);
    assert.deepEqual(f.records, []);
    f.page.emit("crash");
    f.state.closed = true;
    f.state.connected = false;
    f.advance(1);
    await Promise.resolve();
    assert.equal(settled, false);
    assert.deepEqual(f.records, [
        {
            browserConnected: false,
            crashed: true,
            elapsedMs: 15000,
            engine: "unknown",
            event: "pending",
            pageClosed: true,
            phase: "unknown",
        },
    ]);
    f.advance(60000);
    const error = new Error("Original browser failure");
    reject(error);
    await assert.rejects(result, (actual) => actual === error);
    await observed;
    assert.equal(f.records.length, 1);
    assert.equal(f.timers.size, 0);
    assert.equal(f.page.listenerCount("crash"), 0);
});

test("failed diagnostic output cannot replace the browser error", async () => {
    const f = readinessObservationFixture({ brokenReporter: true });
    const error = new Error("Original error");
    await assert.rejects(
        f.observe(f.page, { engine: "html5", phase: "initial" }, () =>
            Promise.reject(error)
        ),
        (actual) => actual === error
    );
    assert.equal(f.timers.size, 0);
    assert.equal(f.page.listenerCount("crash"), 0);
});

test("a readiness result after the diagnostic deadline still succeeds unchanged", async () => {
    const f = readinessObservationFixture();
    let resolve;
    const pending = new Promise((resolveOperation) => {
        resolve = resolveOperation;
    });
    const result = f.observe(
        f.page,
        { engine: "hls.js", phase: "reload" },
        () => pending
    );
    f.advance(15000);
    const value = {};
    resolve(value);
    assert.equal(await result, value);
    assert.equal(f.records.length, 1);
    assert.equal(f.records[0].event, "pending");
    assert.equal(f.timers.size, 0);
    assert.equal(f.page.listenerCount("crash"), 0);
});

function channelOpeningFixture({
    brokenLogger = false,
    error,
    pending = false,
} = {}) {
    const f = readinessObservationFixture();
    const calls = [];
    const evaluations = [];
    const messages = [];
    let enter;
    const entered = new Promise((resolve) => {
        enter = resolve;
    });
    let rejectTransition;
    const transition = pending
        ? new Promise((resolve, reject) => {
              rejectTransition = reject;
          })
        : null;
    const source = fs.readFileSync(
        path.join(__dirname, "browser/plex-provider.spec.cjs"),
        "utf8"
    );
    const start = source.indexOf("async function openPlexChannels(");
    const end = source.indexOf("async function selectPlexChannel(", start);
    assert.ok(start >= 0 && end > start);
    const window = {
        _: (text) => text,
        __ottActiveProviderDriver: {
            catalogLoading: () => false,
            libraryReady: () => true,
        },
        __ottMedia: {
            open: (value) => calls.push(["open", value]),
            useSource: (value) => calls.push(["useSource", value]),
        },
        closeList: () => calls.push(["closeList"]),
        providerMediaClient: {},
        stbStop: () => calls.push(["stop"]),
        video: {
            buffered: {
                end(index) {
                    assert.equal(index, 0);
                    return 6;
                },
                length: 1,
            },
            currentSrc: "https://private.invalid/source?token=private",
            currentTime: 2.5,
            duration: 10,
            ended: false,
            error: null,
            networkState: 2,
            paused: false,
            readyState: 3,
        },
    };
    f.page.waitForFunction = async (predicate) => {
        assert.equal(predicate(), true);
    };
    f.page.evaluate = async (callback) => {
        evaluations.push(callback.toString());
        if (callback.toString().includes("window.stbStop")) {
            if (error) {
                f.page.emit("crash");
                throw error;
            }
            callback();
            enter();
            return transition;
        }
        return callback();
    };
    f.page.locator = (selector) => selector;
    const assertions = [];
    const expect = (selector) => ({
        not: {
            toContainText: async (value) =>
                assertions.push([selector, "not", value]),
        },
        toContainText: async (value) => assertions.push([selector, value]),
        toHaveCount: async (value) => assertions.push([selector, value]),
    });
    const open = require("node:vm").runInNewContext(
        source.slice(start, end) + "\nopenPlexChannels",
        {
            console: {
                log(text) {
                    if (brokenLogger) throw new Error("Logger unavailable");
                    messages.push(text);
                    f.page.emit("console", { text: () => text });
                },
            },
            expect,
            observeAspectReadiness: f.observe,
            window,
        }
    );
    return {
        ...f,
        assertions,
        calls,
        entered,
        evaluations,
        messages,
        open,
        rejectTransition,
        window,
    };
}

test("channel opening observes the original single-evaluate transition without changing calls", async () => {
    const f = channelOpeningFixture();
    const external = () => {};
    f.page.on("crash", external);
    assert.equal(await f.open(f.page, "video.js"), undefined);
    assert.deepEqual(f.calls, [
        ["stop"],
        ["closeList"],
        ["useSource", null],
        ["open", null],
    ]);
    assert.equal(f.evaluations.length, 2);
    for (const call of ["stbStop", "closeList", "useSource", "open(null)"])
        assert.ok(f.evaluations[0].includes(call));
    assert.deepEqual(f.assertions, [
        ["#listCaption", "Channel list. Category: "],
        ["#mediaPlaybackControls", 0],
        ["#listPodval", "not", "Filter"],
    ]);
    assert.equal(f.unrefed(), 1);
    assert.equal(f.timers.size, 0);
    assert.deepEqual(f.page.listeners("crash"), [external]);
    assert.deepEqual(f.records, []);
});

test("channel opening crash retains the original error and identifies the pre-playback phase", async () => {
    const error = new Error(
        "Target crashed: private details must not be logged"
    );
    const f = channelOpeningFixture({ error });
    await assert.rejects(
        f.open(f.page, "video.js"),
        (actual) => actual === error
    );
    assert.deepEqual(f.records, [
        {
            browserConnected: true,
            crashed: true,
            elapsedMs: 0,
            engine: "video.js",
            event: "rejected",
            pageClosed: false,
            phase: "open-channels",
            transition: [],
        },
    ]);
    assert.equal(f.evaluations.length, 1);
    assert.deepEqual(f.assertions, []);
    assert.equal(f.timers.size, 0);
    assert.equal(f.page.listenerCount("crash"), 0);
});

test("channel opening host deadline observes once without settling or retrying the transition", async () => {
    const f = channelOpeningFixture({ pending: true });
    const result = f.open(f.page, "hls.js");
    let settled = false;
    result.then(
        () => {
            settled = true;
        },
        () => {
            settled = true;
        }
    );
    await f.entered;
    assert.equal(f.calls.length, 4);
    f.advance(14999);
    const before = f.records.slice();
    f.advance(1);
    await Promise.resolve();
    const settledAtDeadline = settled;
    const atDeadline = f.records.slice();
    f.advance(60000);
    const error = new Error("Original transition timeout");
    f.rejectTransition(error);
    await assert.rejects(result, (actual) => actual === error);
    assert.deepEqual(before, []);
    assert.equal(settledAtDeadline, false);
    assert.equal(atDeadline.length, 1);
    assert.deepEqual(atDeadline[0], {
        browserConnected: true,
        crashed: false,
        elapsedMs: 15000,
        engine: "hls.js",
        event: "pending",
        pageClosed: false,
        phase: "open-channels",
        transition: Array.from({ length: 8 }, (_, step) => ({
            media: {
                bufferedRangeCount: 1,
                currentTime: 2.5,
                duration: 10,
                ended: false,
                errorCode: null,
                lastBufferEnd: 6,
                networkState: 2,
                paused: false,
                readyState: 3,
                sourcePresent: true,
            },
            step,
        })),
    });
    assert.equal(f.records.length, 1);
    assert.equal(f.evaluations.length, 1);
    assert.equal(f.calls.length, 4);
    assert.deepEqual(f.assertions, []);
    assert.equal(f.timers.size, 0);
    assert.equal(f.page.listenerCount("crash"), 0);
});

test("channel transition marks bound each original call and retain its failure", async () => {
    for (const [index, name] of [
        "stbStop",
        "closeList",
        "useSource",
        "open",
    ].entries()) {
        const f = channelOpeningFixture();
        const error = new Error("private failure " + name);
        const target = index < 2 ? f.window : f.window.__ottMedia;
        target[name] = () => {
            throw error;
        };
        await assert.rejects(f.open(f.page, "video.js"), (e) => e === error);
        const expected = Array.from({ length: index * 2 + 1 }, (_, n) => n);
        assert.deepEqual(
            f.records[0].transition.map((row) => row.step),
            expected
        );
        assert.equal(f.messages.length, expected.length);
        assert.equal(f.calls.length, index);
        assert.equal(f.evaluations.length, 1);
        assert.deepEqual(f.assertions, []);
        assert.equal(f.page.listenerCount("console"), 0);
        assert.equal(f.page.listenerCount("crash"), 0);
        assert.equal(f.timers.size, 0);
        assert.ok(!JSON.stringify(f.records).includes("private"));
    }
});

test("channel marks capture before and after media state without copying source URLs", async () => {
    const f = channelOpeningFixture({ pending: true });
    f.window.stbStop = () => {
        f.window.video.paused = true;
        f.window.video.currentTime = 0;
        f.window.video.currentSrc = "";
        f.window.video.buffered = {
            end() {
                throw new Error("An empty range must not be read");
            },
            length: 0,
        };
    };
    const result = f.open(f.page, "video.js");
    await f.entered;
    f.advance(15000);
    const rows = f.records[0].transition;
    assert.equal(rows.length, 8);
    assert.deepEqual(
        rows.map((row) => row.step),
        [0, 1, 2, 3, 4, 5, 6, 7]
    );
    assert.equal(rows[0].media.paused, false);
    assert.equal(rows[1].media.paused, true);
    assert.equal(rows[0].media.currentTime, 2.5);
    assert.equal(rows[1].media.currentTime, 0);
    assert.equal(rows[0].media.sourcePresent, true);
    assert.equal(rows[1].media.sourcePresent, false);
    assert.equal(rows[0].media.bufferedRangeCount, 1);
    assert.equal(rows[0].media.lastBufferEnd, 6);
    assert.equal(rows[1].media.bufferedRangeCount, 0);
    assert.equal(rows[1].media.lastBufferEnd, null);
    assert.ok(!JSON.stringify(f.messages).includes("private"));
    const error = new Error("original timeout");
    f.rejectTransition(error);
    await assert.rejects(result, (e) => e === error);
    assert.equal(f.page.listenerCount("console"), 0);
});

test("unavailable media and failed console logging do not change the channel calls", async () => {
    for (const brokenLogger of [false, true]) {
        const f = channelOpeningFixture({ brokenLogger });
        Object.defineProperty(f.window, "video", {
            get() {
                throw new Error("private inaccessible media");
            },
        });
        const external = () => {};
        f.page.on("console", external);
        await f.open(f.page, "video.js");
        assert.deepEqual(f.calls, [
            ["stop"],
            ["closeList"],
            ["useSource", null],
            ["open", null],
        ]);
        assert.equal(f.assertions.length, 3);
        assert.equal(f.messages.length, brokenLogger ? 0 : 8);
        assert.ok(!JSON.stringify(f.messages).includes("private"));
        assert.deepEqual(f.page.listeners("console"), [external]);
        assert.equal(f.timers.size, 0);
    }
});

test("host transition collection is bounded, ordered, and retains only typed fields", async () => {
    const f = readinessObservationFixture();
    const emit = (text) => f.page.emit("console", { text: () => text });
    const prefix = "Plex channel transition: ";
    const error = new Error("original failure");
    await assert.rejects(
        f.observe(
            f.page,
            { engine: "video.js", phase: "open-channels" },
            () => {
                f.page.emit("console", {
                    text() {
                        throw new Error("private inaccessible text");
                    },
                });
                for (const text of [
                    "unrelated private log",
                    prefix + "invalid json",
                    prefix + "null",
                    prefix + JSON.stringify({ step: "0" }),
                    prefix + JSON.stringify({ step: -1 }),
                    prefix + JSON.stringify({ step: 8 }),
                    prefix +
                        JSON.stringify({ step: 0, secret: "x".repeat(1024) }),
                    prefix +
                        JSON.stringify({ step: 0, secret: "😊".repeat(300) }),
                ])
                    emit(text);
                emit(
                    prefix +
                        JSON.stringify({
                            media: {
                                currentTime: "private",
                                duration: 1e12,
                                ended: "private",
                                errorCode: "private",
                                networkState: 99,
                                paused: {},
                                readyState: -1,
                                sourcePresent: "private",
                                url: "https://private.invalid/",
                            },
                            secret: "private",
                            step: 0,
                        })
                );
                emit(prefix + JSON.stringify({ step: 0 }));
                for (let step = 1; step <= 7; step++)
                    emit(prefix + JSON.stringify({ media: null, step }));
                emit(prefix + JSON.stringify({ step: 7 }));
                throw error;
            }
        ),
        (actual) => actual === error
    );
    const rows = f.records[0].transition;
    assert.equal(rows.length, 8);
    assert.deepEqual(
        rows.map((row) => row.step),
        [0, 1, 2, 3, 4, 5, 6, 7]
    );
    assert.deepEqual(rows[0].media, {
        bufferedRangeCount: null,
        currentTime: null,
        duration: null,
        ended: null,
        errorCode: null,
        lastBufferEnd: null,
        networkState: null,
        paused: null,
        readyState: null,
        sourcePresent: null,
    });
    assert.ok(!JSON.stringify(f.records).includes("private"));
    assert.equal(f.page.listenerCount("console"), 0);
});

test("failed diagnostic listener registration and removal preserve the operation", async () => {
    for (const failOn of ["on", "off"]) {
        const f = readinessObservationFixture();
        const original = f.page[failOn].bind(f.page);
        f.page[failOn] = (...args) => {
            original(...args);
            throw new Error("listener failure");
        };
        const error = new Error("original failure");
        await assert.rejects(
            f.observe(
                f.page,
                { engine: "video.js", phase: "open-channels" },
                () => {
                    throw error;
                }
            ),
            (actual) => actual === error
        );
        assert.equal(f.page.listenerCount("console"), 0);
        assert.equal(f.page.listenerCount("crash"), 0);
        assert.equal(f.timers.size, 0);
    }
});
