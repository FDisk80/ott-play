/* Execute the shared Auto watcher and actual core with deterministic media IO. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const source = [
    "src/core/auto-playback.ts",
    "src/core/buffer-policy.ts",
    "src/core/native-hls.ts",
    "src/playback/stream-policy.ts",
    "src/core/index.ts",
]
    .map((file) =>
        ts
            .transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
                compilerOptions: {
                    module: ts.ModuleKind.ES2015,
                    target: ts.ScriptTarget.ES5,
                },
            })
            .outputText.replace(/^import .*\n/gm, "")
            .replace(/^export /gm, "")
    )
    .join("\n");

function media(nativeHls) {
    let source = "",
        position = 0;
    const listeners = {};
    return {
        addEventListener(event, callback) {
            (listeners[event] ||= []).push(callback);
        },
        audioTracks: [],
        canPlayType() {
            return nativeHls ? "probably" : "";
        },
        get currentSrc() {
            return source;
        },
        get currentTime() {
            return position;
        },
        set currentTime(value) {
            if (this.readyState === 0) throw new Error("InvalidStateError");
            position = value;
        },
        emit(event) {
            // DOM dispatch snapshots listeners, but removed listeners are not invoked.
            for (const callback of [...(listeners[event] || [])])
                if ((listeners[event] || []).includes(callback)) callback();
        },
        error: null,
        getAttribute(name) {
            return name === "src" ? source || null : null;
        },
        listeners,
        load() {
            this.readyState = 0;
        },
        muted: false,
        pause() {
            this.pauseCalls++;
            this.paused = true;
        },
        pauseCalls: 0,
        paused: true,
        play() {
            this.playCalls++;
            this.paused = false;
        },
        playbackRate: 1,
        playCalls: 0,
        readyState: 0,
        removeAttribute(name) {
            if (name === "src") this.src = "";
        },
        removeEventListener(event, callback) {
            listeners[event] = (listeners[event] || []).filter(
                (fn) => fn !== callback
            );
        },
        sourceHistory: [],
        get src() {
            return source;
        },
        set src(value) {
            source = value;
            this.sourceHistory.push(value);
            position = 0;
            this.readyState = 0;
            this.videoWidth = this.videoHeight = 0;
            this.audioTracks = [];
            this.videoTracks = [];
            this.error = null;
        },
        videoHeight: 0,
        videoTracks: [],
        videoWidth: 0,
    };
}

function fixture(options = {}) {
    let now = 0,
        nextTimer = 0;
    const timers = new Map(),
        players = [],
        shakaPlayers = [],
        messages = [];
    const preferences = {};
    const documentListeners = {};
    if (options.savedPlayerMode !== undefined)
        preferences.sPlayers = String(options.savedPlayerMode);
    function Hls(config) {
        this.config = config || {};
        this.events = {};
        this.levels = [];
        this.audioTracks = [];
        this.subtitleTracks = [];
        this.destroyCalls = 0;
        this.recoverCalls = 0;
        players.push(this);
    }
    Hls.Events = {
        AUDIO_TRACKS_UPDATED: "audio",
        ERROR: "error",
        FRAG_PARSING_INIT_SEGMENT: "tracks",
        MANIFEST_PARSED: "manifest",
    };
    Hls.ErrorTypes = { MEDIA_ERROR: "media", NETWORK_ERROR: "network" };
    Hls.isSupported = () => options.hlsSupported !== false;
    Hls.prototype.on = function (event, callback) {
        (this.events[event] ||= []).push(callback);
    };
    Hls.prototype.emit = function (event, data) {
        this.emitting = true;
        try {
            for (const callback of this.events[event] || [])
                callback(event, data);
        } finally {
            this.emitting = false;
        }
    };
    Hls.prototype.loadSource = function (url) {
        this.url = url;
    };
    Hls.prototype.attachMedia = function (target) {
        this.media = target;
        target.src = "blob:hls-" + players.indexOf(this);
    };
    Hls.prototype.destroy = function () {
        if (this.config.startFragPrefetch)
            assert.ok(
                !this.emitting,
                "Probe destruction waits until the HLS event returns"
            );
        this.destroyCalls++;
        if (this.media) this.media.src = "";
    };
    Hls.prototype.recoverMediaError = function () {
        this.recoverCalls++;
    };
    Hls.prototype.startLoad = function () {};
    Hls.prototype.removeLevel = function () {};
    function Shaka(target) {
        this.media = target;
        this.destroyCalls = 0;
        shakaPlayers.push(this);
    }
    Shaka.isBrowserSupported = () => options.shakaSupported !== false;
    Shaka.prototype.load = function (url, position) {
        this.url = url;
        this.position = position;
        this.media.src = "blob:shaka-" + shakaPlayers.indexOf(this);
    };
    Shaka.prototype.getMediaElement = function () {
        return this.media;
    };
    Shaka.prototype.destroy = function () {
        this.destroyCalls++;
        return Promise.resolve().then(() => {
            this.media.removeAttribute("src");
            this.media.load();
            this.media = null;
        });
    };
    const w = {
        _: (text) => text,
        __TAURI__: options.tauri === false ? undefined : {},
        $: () => ({ css() {}, hide() {}, html() {}, show() {} }),
        applyChannelPreference() {},
        clearInterval() {},
        clearTimeout(timer) {
            timers.delete(timer);
        },
        console: { error() {}, log() {}, warn() {} },
        Date: { now: () => now },
        document: {
            addEventListener(event, callback) {
                (documentListeners[event] ||= []).push(callback);
            },
            body: { style: {} },
            emit(event) {
                for (const callback of [...(documentListeners[event] || [])])
                    callback();
            },
            removeEventListener(event, callback) {
                documentListeners[event] = (
                    documentListeners[event] || []
                ).filter((fn) => fn !== callback);
            },
            visibilityState: "visible",
        },
        Hls,
        innerHeight: 720,
        innerWidth: 1280,
        Map: undefined,
        navigator: { userAgent: options.userAgent || "" },
        ott_device: options.device || "pc",
        // The classic bundle still executes without Promise/Map/Set globals.
        Promise: undefined,
        providerHasItemValue: (key) =>
            Object.prototype.hasOwnProperty.call(preferences, key),
        providerSetItem(key, value) {
            preferences[key] = String(value);
        },
        Set: undefined,
        saveChannelPreference() {},
        setInterval() {
            return ++nextTimer;
        },
        setTimeout(callback, delay) {
            timers.set(++nextTimer, { callback, due: now + delay });
            return nextTimer;
        },
        shaka: { Player: Shaka },
        showShift(message) {
            messages.push(message);
        },
        ...options.globals,
    };
    if (options.hlsMissing) delete w.Hls;
    w.window = w;
    vm.createContext(w);
    require("./helpers/shared-core-runtime.cjs")(w);
    vm.runInContext(source, w);
    w.video = media(options.nativeHls !== false);
    w.videoPip = media(options.nativeHls !== false);
    w.setPlayerMode(options.savedPlayerMode ?? 3);
    function advance(milliseconds) {
        const end = now + milliseconds;
        for (let count = 0; count < 100; count++) {
            const next = [...timers.entries()]
                .filter(([, timer]) => timer.due <= end)
                .sort((a, b) => a[1].due - b[1].due)[0];
            if (!next) {
                now = end;
                return;
            }
            timers.delete(next[0]);
            now = next[1].due;
            next[1].callback();
        }
        throw new Error("Unexpected unbounded timer loop");
    }
    return { advance, messages, players, preferences, shakaPlayers, timers, w };
}

function ready(target, video = false) {
    target.readyState = 3;
    target.audioTracks = [{ language: "en" }];
    target.videoTracks = video ? [{}] : [];
    target.videoWidth = video ? 1920 : 0;
    target.videoHeight = video ? 1080 : 0;
    target.emit("loadedmetadata");
    target.emit("playing");
}
function hevc(player, muxed = false) {
    player.emit("tracks", {
        id: "main",
        tracks: muxed
            ? { audiovideo: { codec: "mp4a.40.2,hvc1.1.6.L120" } }
            : { video: { codec: "hvc1.1.6.L120" } },
    });
}
function probe(fixture, target = fixture.w.video) {
    ready(target);
    fixture.advance(1500);
    const player = fixture.players.at(-1);
    assert.equal(player.config.startFragPrefetch, true);
    assert.equal(player.config.testBandwidth, false);
    assert.equal(player.media, undefined, "Probe does not attach a decoder");
    assert.equal(
        target.paused,
        false,
        "Probe preserves play/pause control state"
    );
    return player;
}
const cases = [];
function test(name, callback) {
    cases.push([name, callback]);
}

function frameFixture(options = {}) {
    const f = fixture({ savedPlayerMode: 3, ...options });
    const target = f.w.video;
    f.quality = { droppedVideoFrames: 0, totalVideoFrames: 0 };
    target.getVideoPlaybackQuality = () => f.quality;
    f.bufferAhead = 30;
    target.buffered = {
        end: () => target.currentTime + f.bufferAhead,
        length: 1,
        start: () => 0,
    };
    f.w.stbPlay("frame-drops.m3u8");
    ready(target, true);
    return f;
}

function advanceFrames(f, seconds, total = 25, dropped = 24) {
    for (let i = 0; i < seconds; i++) {
        if (f.w.video.readyState) f.w.video.currentTime++;
        f.quality.totalVideoFrames += total;
        f.quality.droppedVideoFrames += dropped;
        f.advance(1000);
    }
}

test("Tauri Auto switches sustained native frame loss directly to HLS once", () => {
    const f = frameFixture();
    const handle = f.w.__ottCoreBackend().current();
    assert.equal(handle.diagnosticEngine(), "html5");
    advanceFrames(f, 12);
    assert.equal(
        f.players.length,
        0,
        "Startup and two full windows are required"
    );
    advanceFrames(f, 1);
    assert.equal(f.players.length, 1);
    const hls = f.players[0];
    assert.equal(handle.diagnosticEngine(), "hls.js");
    assert.equal(hls.media, f.w.video);
    assert.equal(hls.url, "frame-drops.m3u8");
    assert.equal(
        hls.config.startFragPrefetch,
        undefined,
        "No parallel stream probe"
    );
    hls.emit("manifest");
    ready(f.w.video, true);
    advanceFrames(f, 30);
    assert.equal(
        f.players.length,
        1,
        "A bad HLS decoder cannot start a fallback loop"
    );
    assert.equal(f.w.playerMode, 3);
    assert.equal(f.preferences.sPlayers, "3");
    assert.equal(
        f.timers.size,
        0,
        "Native monitoring is disposed after fallback"
    );
});

function localStallFixture() {
    const f = fixture();
    f.w.__ottLocalMedia = { isPlaybackUrl: (url) => url === "local.mp4" };
    f.w.startCoreEngine("local.mp4", 195);
    return f;
}
test("Local native startup stall retries twice at its retained position then stops", () => {
    const f = localStallFixture();
    for (let retry = 0; retry < 2; retry++) {
        f.advance(30000);
        assert.equal(f.w.coreStreamAttempt.state().pending, true);
        f.advance(retry ? 1000 : 500);
        ready(f.w.video, true);
        assert.equal(f.w.video.currentTime, 195);
    }
    f.advance(30000);
    assert.equal(f.w.coreStreamAttempt.state().terminal, true);
    assert.equal(
        f.w.video.sourceHistory.filter((x) => x === "local.mp4").length,
        3
    );
    f.advance(60000);
    assert.equal(
        f.w.video.sourceHistory.filter((x) => x === "local.mp4").length,
        3
    );
});
test("Local playing stalls retain position and renew the budget only after ten continuous wallseconds", () => {
    for (const seconds of [3, 9, 10]) {
        const f = localStallFixture();
        ready(f.w.video, true);
        f.w.video.currentTime = 240;
        f.advance(30000);
        f.advance(2000);
        ready(f.w.video, true);
        assert.equal(f.w.video.currentTime, 240);
        // Observe the restored position before counting one-second intervals.
        // A resume seek is not healthy playback time.
        f.advance(1000);
        for (let i = 0; i < seconds; i++) {
            f.w.video.currentTime += 1;
            f.advance(1000);
        }
        for (let i = 0; i < 2; i++) {
            f.advance(30000);
            f.advance(2000);
            ready(f.w.video, true);
        }
        assert.equal(
            f.w.coreStreamAttempt.state().terminal,
            seconds < 10,
            seconds + " observed seconds before the next stalls"
        );
        assert.equal(
            f.w.video.sourceHistory.filter((url) => url === "local.mp4").length,
            seconds < 10 ? 3 : 4,
            "Short progress cannot admit an extra retry"
        );
        f.advance(30000);
        assert.equal(f.w.coreStreamAttempt.state().terminal, true);
    }
});
test("Local watchdog ignores focus but suspends paused time and is cancelled by stop or replacement", () => {
    for (const action of ["stop", "replace"]) {
        const f = localStallFixture();
        f.w.video.paused = true;
        f.advance(60000);
        assert.equal(f.w.coreAttemptCounters.streamRetries, 0);
        f.w.video.paused = false;
        f.w.document.visibilityState = "hidden";
        f.advance(30000);
        assert.equal(f.w.coreStreamAttempt.state().pending, true);
        if (action === "stop") f.w.stopCoreEngine();
        else f.w.startCoreEngine("other.mp4", 20);
        const history = f.w.video.sourceHistory.length;
        f.advance(60000);
        assert.equal(f.w.video.sourceHistory.length, history);
    }
});

test("Local seek and end cannot trigger a spurious retry", () => {
    const f = localStallFixture();
    ready(f.w.video, true);
    f.w.video.seeking = true;
    f.advance(60000);
    assert.equal(f.w.coreAttemptCounters.streamRetries, 0);
    f.w.video.currentTime = 500;
    f.w.video.seeking = false;
    f.advance(30000);
    f.advance(500);
    ready(f.w.video, true);
    assert.equal(f.w.video.currentTime, 500);
    f.w.video.ended = true;
    const starts = f.w.video.sourceHistory.length;
    f.advance(60000);
    assert.equal(f.w.video.sourceHistory.length, starts);
    assert.equal(f.w.coreStreamAttempt.state().pending, false);
});
test("Local stall timer fences provider changes and synchronous replacement during retry", () => {
    for (const action of ["provider", "stop", "replace"]) {
        const f = localStallFixture();
        if (action === "provider")
            f.w.__ottActiveProviderDriver = { id: "other" };
        else
            f.w.__ottPerfSink = {
                recovery() {
                    if (action === "stop") f.w.stopCoreEngine();
                    else f.w.startCoreEngine("replacement.mp4", 44);
                },
            };
        f.advance(33000);
        assert.equal(
            f.w.video.sourceHistory.filter((x) => x === "local.mp4").length,
            1
        );
        f.advance(60000);
        assert.equal(
            f.w.video.sourceHistory.filter((x) => x === "local.mp4").length,
            1
        );
        assert.equal([...f.timers.values()].length, 0);
    }
});

for (const transition of ["end", "provider"]) {
    for (const timing of ["queued window", "synchronous retry report"]) {
        test(
            "Local queued retry rejects " + transition + " during " + timing,
            () => {
                const f = localStallFixture();
                f.advance(30000);
                assert.equal(f.w.coreStreamAttempt.state().pending, true);
                function retire() {
                    if (transition === "end") f.w.video.ended = true;
                    else f.w.__ottActiveProviderDriver = { id: "replacement" };
                }
                if (timing === "queued window") retire();
                else
                    f.w.__ottPerfSink = {
                        recovery(key) {
                            if (key === "streamRetries") retire();
                        },
                    };
                f.advance(500);
                assert.equal(
                    f.w.video.sourceHistory.filter((url) => url === "local.mp4")
                        .length,
                    1,
                    "retired local retry must not reopen its source"
                );
                assert.equal(f.w.coreStreamAttempt.state().pending, false);
                assert.equal(f.w.coreStreamAttempt.state().terminal, true);
                f.advance(60000);
                assert.equal(
                    f.w.video.sourceHistory.filter((url) => url === "local.mp4")
                        .length,
                    1
                );
                assert.equal(
                    f.timers.size,
                    0,
                    "retired watchdog leaves no polling/retry timer"
                );
            }
        );
    }
}

test("Local backend pause/resume retires queued intent and resumes actual media", () => {
    const f = fixture();
    f.w.__ottLocalMedia = { isPlaybackUrl: (url) => url === "local.mp4" };
    const lease = f.w.openCoreEngineLease(
        { lane: "main", position: 240, url: "local.mp4" },
        () => {}
    );
    ready(f.w.video, true);
    f.advance(30000);
    assert.equal(f.w.coreStreamAttempt.state().pending, true);
    lease.pause();
    assert.equal(f.w.video.paused, true);
    const plays = f.w.video.playCalls;
    lease.resume();
    assert.equal(f.w.video.playCalls, plays + 1);
    assert.equal(f.w.video.paused, false);
    assert.equal(f.w.coreStreamAttempt.state().pending, false);
    f.advance(500);
    assert.equal(
        f.w.video.sourceHistory.filter((url) => url === "local.mp4").length,
        1
    );
    for (let i = 0; i < 3; i++) {
        f.w.video.currentTime++;
        f.advance(1000);
    }
    assert.equal(f.w.coreStreamAttempt.state().terminal, false);
    const retained = f.w.video.currentTime;
    f.advance(32000);
    assert.equal(
        f.w.video.sourceHistory.filter((url) => url === "local.mp4").length,
        2
    );
    ready(f.w.video, true);
    assert.equal(f.w.video.currentTime, retained);
});

for (const transition of [
    "completed seek",
    "active seek",
    "same-position seek",
    "native seek",
    "native pause",
    "resumed progress",
]) {
    for (const timing of ["queued window", "synchronous retry report"]) {
        test(
            "Local retry intent rejects " + transition + " during " + timing,
            () => {
                const f = localStallFixture();
                ready(f.w.video, true);
                f.w.video.currentTime = 240;
                f.advance(30000);
                assert.equal(f.w.coreStreamAttempt.state().pending, true);
                function changeIntent() {
                    if (transition === "native pause") f.w.video.pause();
                    else if (transition === "resumed progress")
                        f.w.video.currentTime += 0.25;
                    else if (transition === "native seek")
                        f.w.video.currentTime = 500;
                    else {
                        f.w.seekCoreMedia(
                            transition === "same-position seek" ? 240 : 500,
                            f.w._playSession
                        );
                        f.w.video.seeking = transition === "active seek";
                    }
                }
                if (timing === "queued window") changeIntent();
                else
                    f.w.__ottPerfSink = {
                        recovery(key) {
                            if (key === "streamRetries") changeIntent();
                        },
                    };
                f.advance(500);
                assert.equal(
                    f.w.video.sourceHistory.filter((url) => url === "local.mp4")
                        .length,
                    1
                );
                assert.equal(f.w.coreStreamAttempt.state().pending, false);
                assert.equal(
                    f.w.coreStreamAttempt.state().terminal,
                    false,
                    "changed intent cancels only this queued retry"
                );
                assert.equal(
                    f.w.video.currentTime,
                    transition === "resumed progress"
                        ? 240.25
                        : transition.includes("seek") &&
                            transition !== "same-position seek"
                          ? 500
                          : 240
                );
                f.w.__ottPerfSink = null;
                f.w.video.seeking = false;
                f.w.video.paused = false;
                const retained = f.w.video.currentTime;
                f.advance(1000);
                f.advance(30000);
                f.advance(2000);
                assert.equal(
                    f.w.video.sourceHistory.filter((url) => url === "local.mp4")
                        .length,
                    2,
                    "a subsequent independent stall remains recoverable"
                );
                ready(f.w.video, true);
                assert.equal(f.w.video.currentTime, retained);
            }
        );
    }
}

test("native frame monitoring keeps smooth, low-FPS and transient startup playback", () => {
    for (const [total, dropped] of [
        [25, 0],
        [1, 0],
        [25, 5],
    ]) {
        const f = frameFixture();
        advanceFrames(f, 30, total, dropped);
        assert.equal(f.players.length, 0, total + "/" + dropped);
    }
    const f = frameFixture();
    advanceFrames(f, 8);
    advanceFrames(f, 30, 25, 0);
    assert.equal(
        f.players.length,
        0,
        "Startup losses are not sustained failure"
    );
});

test("pause, seek, hidden, waiting, rate and buffer interruptions reset frame evidence", () => {
    const interruptions = [
        [
            "pause",
            (f) => {
                f.w.video.paused = true;
            },
            (f) => {
                f.w.video.paused = false;
            },
        ],
        [
            "seeking",
            (f) => {
                f.w.video.seeking = true;
            },
            (f) => {
                f.w.video.seeking = false;
            },
        ],
        [
            "visibilitychange",
            (f) => {
                f.w.document.visibilityState = "hidden";
            },
            (f) => {
                f.w.document.visibilityState = "visible";
            },
        ],
        [
            "waiting",
            (f) => {
                f.w.video.readyState = 2;
            },
            (f) => {
                f.w.video.readyState = 3;
            },
        ],
        [
            "ratechange",
            (f) => {
                f.w.video.playbackRate = 2;
            },
            (f) => {
                f.w.video.playbackRate = 1;
            },
        ],
        [
            null,
            (f) => {
                f.bufferAhead = 1;
            },
            (f) => {
                f.bufferAhead = 30;
            },
        ],
    ];
    for (const [event, interrupt, resume] of interruptions) {
        const f = frameFixture();
        advanceFrames(f, 9);
        interrupt(f);
        if (event)
            (event === "visibilitychange" ? f.w.document : f.w.video).emit(
                event
            );
        advanceFrames(f, 20);
        assert.equal(f.players.length, 0, event || "buffer");
        resume(f);
        advanceFrames(f, 12);
        assert.equal(
            f.players.length,
            0,
            "A fresh complete observation is required"
        );
        advanceFrames(f, 1);
        assert.equal(f.players.length, 1, event || "buffer");
    }
});

test("brief between-sample interruptions cannot combine two bad frame windows", () => {
    for (const event of ["pause", "seeking", "waiting", "visibilitychange"]) {
        const f = frameFixture();
        advanceFrames(f, 9);
        (event === "visibilitychange" ? f.w.document : f.w.video).emit(event);
        advanceFrames(f, 12);
        assert.equal(f.players.length, 0, event);
        advanceFrames(f, 1);
        assert.equal(f.players.length, 1, event);
    }
});

test("counter resets and timeline jumps require fresh frame evidence", () => {
    for (const reset of [
        (f) => {
            f.quality.totalVideoFrames = f.quality.droppedVideoFrames = 0;
        },
        (f) => {
            f.w.video.currentTime += 100;
        },
        (f) => {
            f.w.video.currentTime = 0;
        },
    ]) {
        const f = frameFixture();
        advanceFrames(f, 9);
        reset(f);
        advanceFrames(f, 13);
        assert.equal(f.players.length, 0);
        advanceFrames(f, 1);
        assert.equal(f.players.length, 1);
    }
});

test("unknown, invalid and throwing frame counters cannot force an engine switch", () => {
    for (const value of [undefined, NaN, Infinity, -1, "250"]) {
        const f = frameFixture();
        f.w.video.getVideoPlaybackQuality = () => ({
            droppedVideoFrames: value,
            totalVideoFrames: value,
        });
        advanceFrames(f, 30);
        assert.equal(f.players.length, 0, String(value));
    }
    const f = frameFixture();
    f.w.video.getVideoPlaybackQuality = () => {
        throw new Error("unavailable");
    };
    advanceFrames(f, 30);
    assert.equal(f.players.length, 0);
    const unknownVisibility = frameFixture();
    delete unknownVisibility.w.document.visibilityState;
    advanceFrames(unknownVisibility, 30);
    assert.equal(unknownVisibility.players.length, 0);
});

test("a pause or cancellation after frame recovery is queued keeps user intent", () => {
    for (const action of ["pause", "stop", "mode", "channel"]) {
        const f = frameFixture();
        const schedule = f.w.setTimeout;
        let acted = false;
        f.w.setTimeout = function (callback, delay) {
            const id = schedule(callback, delay);
            if (delay === 0 && !acted) {
                acted = true;
                if (action === "pause") f.w.stbPause();
                if (action === "stop") f.w.stbStop();
                if (action === "mode") f.w.setPlayerMode(0);
                if (action === "channel") f.w.stbPlay("new.mp4");
            }
            return id;
        };
        advanceFrames(f, 13);
        assert.equal(acted, true);
        assert.equal(f.players.length, action === "pause" ? 1 : 0, action);
        if (action === "pause") {
            f.players[0].emit("manifest");
            assert.equal(f.w.video.paused, true);
            assert.equal(f.w.forcePlay, false);
        }
        assert.equal(f.timers.size, 0);
    }
});

test("legacy WebKit frame counters support the same guarded fallback", () => {
    const f = frameFixture();
    delete f.w.video.getVideoPlaybackQuality;
    Object.defineProperties(f.w.video, {
        webkitDecodedFrameCount: { get: () => f.quality.totalVideoFrames },
        webkitDroppedFrameCount: { get: () => f.quality.droppedVideoFrames },
    });
    advanceFrames(f, 13);
    assert.equal(f.players.length, 1);
});

test("native frame recovery is limited to Tauri Auto main video", () => {
    for (const options of [
        { savedPlayerMode: 0 },
        { device: "lg/webos", tauri: false },
        { hlsSupported: false },
    ]) {
        const f = frameFixture(options);
        advanceFrames(f, 30);
        assert.equal(f.players.length, 0);
    }
    const f = frameFixture();
    let pipReads = 0;
    f.w.videoPip.getVideoPlaybackQuality = () => {
        pipReads++;
        return f.quality;
    };
    f.w.videoPip.buffered = f.w.video.buffered;
    f.w.stbPlayPip("pip-frame-drops.m3u8");
    ready(f.w.videoPip, true);
    advanceFrames(f, 13);
    assert.equal(f.players.length, 1);
    assert.equal(f.w.videoPip.src, "pip-frame-drops.m3u8");
    assert.equal(pipReads, 0, "PiP never starts frame-drop monitoring");
});

test("stop, channel change and explicit mode dispose frame recovery", () => {
    for (const dispose of [
        (f) => f.w.stbStop(),
        (f) => {
            f.w.stbPlay("next.mp4");
            ready(f.w.video, true);
        },
        (f) => f.w.setPlayerMode(0),
    ]) {
        const f = frameFixture();
        advanceFrames(f, 9);
        dispose(f);
        advanceFrames(f, 30);
        assert.equal(f.players.length, 0);
        assert.equal(f.timers.size, 0);
    }
});

test("a real radio track keeps the existing native probe outcome despite old video counters", () => {
    const f = frameFixture();
    ready(f.w.video, false);
    advanceFrames(f, 2);
    assert.equal(f.players.length, 1);
    f.players[0].emit("tracks", {
        id: "main",
        tracks: { audio: { codec: "mp4a.40.2" } },
    });
    f.advance(0);
    ready(f.w.video, false);
    advanceFrames(f, 30);
    assert.equal(
        f.players.length,
        1,
        "No HLS playback engine is attached for radio"
    );
    assert.equal(f.players[0].media, undefined);
    assert.equal(f.w.video.src, "frame-drops.m3u8");
    f.w.stbStop();
    assert.equal(f.timers.size, 0);
});

test("late native video after an audio-only probe still recovers severe frame loss", () => {
    for (const action of ["recover", "pause", "stop", "mode", "channel"]) {
        const f = frameFixture();
        ready(f.w.video, false);
        f.advance(1500);
        const probePlayer = f.players[0];
        ready(f.w.video, true);
        hevc(probePlayer);
        f.advance(0);
        assert.equal(probePlayer.destroyCalls, 1);
        assert.equal(f.w.video.src, "frame-drops.m3u8");
        ready(f.w.video, true);
        if (action === "pause") f.w.stbPause();
        if (action === "stop") f.w.stbStop();
        if (action === "mode") f.w.setPlayerMode(0);
        if (action === "channel") {
            f.w.stbPlay("next.mp4");
            ready(f.w.video, true);
        }
        // Stale events from the destroyed probe must not renew playback.
        hevc(probePlayer);
        advanceFrames(f, 30);
        assert.equal(f.players.length, action === "recover" ? 2 : 1, action);
        if (action === "recover") {
            assert.equal(f.players[1].media, f.w.video);
            assert.equal(f.players[1].config.startFragPrefetch, undefined);
        }
        if (action === "pause") assert.equal(f.w.video.paused, true);
        f.w.stbStop();
        assert.equal(f.timers.size, 0, action);
    }
});

test("Tauri Auto preserves working native H264 and explicit HTML5/hls.js choices", () => {
    const f = fixture();
    f.w.stbPlay("working.m3u8?token=1");
    ready(f.w.video, true);
    f.advance(10000);
    assert.equal(f.players.length, 0);
    assert.equal(f.w.video.playCalls, 1);
    assert.equal(f.w.video.videoWidth, 1920);
    assert.equal(f.w.video.src, "working.m3u8?token=1");
    f.w.setPlayerMode(0);
    f.w.stbPlay("explicit.m3u8");
    ready(f.w.video);
    f.advance(10000);
    assert.equal(f.players.length, 0, "Explicit HTML5 has no Auto watcher");
    f.w.setPlayerMode(1);
    f.w.stbPlay("explicit-hls.m3u8");
    assert.equal(f.players.length, 1);
    assert.equal(f.players[0].media, f.w.video);
});

test("Plex Original uses native files per item without changing the selected engine", () => {
    for (const tauri of [true, false]) {
        for (const mode of [0, 1, 2, 3]) {
            const url =
                "http://plex.test/library/parts/1/file.mp4?X-Plex-Token=private-access";
            let current = {
                payload: {
                    __ottPlexPlayback: { mime: "video/mp4", type: "file" },
                    stream_url: url,
                },
            };
            const logs = [];
            const f = fixture({
                globals: {
                    console: {
                        error() {},
                        log: (...args) => logs.push(args.join(" ")),
                        warn() {},
                    },
                },
                savedPlayerMode: mode,
                tauri,
            });
            f.w.__ottMedia = { current: () => current };
            const selectedMode = f.w.playerMode;
            f.w.stbPlay(url, 67);
            ready(f.w.video, true);
            assert.equal(f.w.video.src, url);
            assert.equal(f.w.video.currentTime, 67);
            assert.equal(f.players.length, 0, "No HLS parser receives an MP4");
            assert.equal(f.shakaPlayers.length, 0);
            assert.equal(f.w.playerMode, selectedMode);
            assert.equal(f.preferences.sPlayers, String(mode));
            assert.equal(logs.join("\n").includes("private-access"), false);
            assert.equal(logs.join("\n").includes("X-Plex-Token"), false);
            f.w.stbPause();
            f.w.stbContinue();
            assert.equal(f.w.video.paused, false);
            f.w.stbStop();
            current = null;
            f.w.stbPlay("next-channel.m3u8");
            if (selectedMode === 1) assert.equal(f.players.length, 1);
            if (selectedMode === 2) assert.equal(f.shakaPlayers.length, 1);
            assert.equal(f.w.playerMode, selectedMode);
            assert.equal(f.preferences.sPlayers, String(mode));
        }
    }
});

test("Plex hints require the exact active file and leave HLS variants unchanged", () => {
    const url = "http://plex.test/play.m3u8?X-Plex-Token=private-access";
    const current = {
        payload: {
            __ottPlexPlayback: { type: "file" },
            stream_url: url + "-old",
        },
    };
    const f = fixture({ savedPlayerMode: 1 });
    f.w.__ottMedia = { current: () => current };
    f.w.stbPlay(url);
    assert.equal(
        f.players.length,
        1,
        "A stale file hint cannot affect another URL"
    );
    current.payload.stream_url = url;
    current.payload.__ottPlexPlayback.type = "hls";
    f.w.stbPlay(url);
    assert.equal(
        f.players.length,
        2,
        "Compatible HLS keeps its selected engine"
    );
    assert.equal(f.players[0].destroyCalls, 1);
    assert.equal(f.players[1].url, url);
});

test("registered normalization routes use per-source MSE without changing preferences", () => {
    const play =
        "https://gateway.test/normalize/play/example/" +
        "a".repeat(48) +
        "/master.m3u8";
    const lease =
        "https://gateway.test/normalize/lease/" +
        "b".repeat(32) +
        "/" +
        "c".repeat(32) +
        "/master.m3u8";
    for (const url of [play, lease])
        for (const mode of [0, 2, 3]) {
            const f = fixture({
                globals: { location: { href: "https://player.test/" }, URL },
                savedPlayerMode: mode,
            });
            f.w.stbPlay(url);
            assert.equal(f.players.length, 1);
            assert.equal(f.players[0].url, url);
            assert.equal(f.shakaPlayers.length, 0);
            assert.equal(f.w.playerMode, mode);
            assert.equal(f.preferences.sPlayers, String(mode));
            f.w.stbStop();
            f.w.stbPlay("https://ordinary.test/next.m3u8");
            assert.equal(f.players.length, 1);
            assert.equal(f.shakaPlayers.length, mode === 2 ? 1 : 0);
        }
});

test("normalization matching uses the exact parsed route and falls back without MSE", () => {
    const root =
        "https://gateway.test/normalize/play/example/" + "a".repeat(48);
    const f = fixture({
        globals: { location: { href: "https://player.test/" }, URL },
        savedPlayerMode: 0,
    });
    for (const url of [
        root + "/track_0.m3u8",
        root + "/master.m3u8?x=1",
        root + "/master.m3u8#x",
        "https://ordinary.test/not/normalize/play/example/" +
            "a".repeat(48) +
            "/master.m3u8",
        "https://ordinary.test/?url=" +
            encodeURIComponent(root + "/master.m3u8"),
        root.replace("example", "%65xample") + "/master.m3u8",
        root.replace("https://", "https://user:password@") + "/master.m3u8",
    ]) {
        assert.equal(f.w.coreNormalizedMse(url), false);
        f.w.stbPlay(url);
        assert.equal(f.players.length, 0);
    }
    for (const suffix of ["", "?", "#", "?#"]) {
        assert.equal(
            f.w.coreNormalizedMse(root + "/master.m3u8" + suffix),
            true
        );
    }
    for (const prefix of ["http://gateway.test:8080", "https://[::1]:8443"]) {
        assert.equal(
            f.w.coreNormalizedMse(
                root.replace("https://gateway.test", prefix) + "/master.m3u8"
            ),
            true
        );
    }
    for (const credentials of ["user@", ":password@", "user:password@"])
        assert.equal(
            f.w.coreNormalizedMse(
                root.replace("https://", "https://" + credentials) +
                    "/master.m3u8"
            ),
            false
        );
    assert.equal(
        f.w.coreNormalizedMse(root.replace("https:", "ftp:") + "/master.m3u8"),
        false
    );
    assert.equal(f.w.coreNormalizedMse("not a URL"), false);
    const unsupported = fixture({
        globals: { location: { href: "https://player.test/" }, URL },
        hlsMissing: true,
        savedPlayerMode: 0,
    });
    unsupported.w.stbPlay(root + "/master.m3u8");
    assert.equal(unsupported.w.video.src, root + "/master.m3u8");
    assert.equal(unsupported.w.playerMode, 0);
});

test("normalized CSS PiP uses MSE only when supported and owns its lifetime", () => {
    const url =
        "https://gateway.test/normalize/play/example/" +
        "a".repeat(48) +
        "/master.m3u8";
    for (const supported of [true, false]) {
        const f = fixture({
            globals: { location: { href: "https://player.test/" }, URL },
            hlsSupported: supported,
            savedPlayerMode: 0,
        });
        f.w.stbPlay("https://ordinary.test/main.m3u8");
        f.w.stbPlayPip(url);
        assert.equal(f.w.video.src, "https://ordinary.test/main.m3u8");
        assert.equal(f.players.length, supported ? 1 : 0);
        if (supported) {
            assert.equal(f.players[0].media, f.w.videoPip);
            f.w.stbStopPip();
            assert.equal(f.players[0].destroyCalls, 1);
        } else assert.equal(f.w.videoPip.src, url);
        assert.equal(f.w.playerMode, 0);
        assert.equal(f.preferences.sPlayers, "0");
    }
});

test("Plex HEVC remux selects MSE per item even when native HLS is the saved preference", () => {
    for (const mode of [0, 2, 3]) {
        const f = fixture({ savedPlayerMode: mode });
        const url = "https://plex.test/remux.m3u8?X-Plex-Token=private-access";
        const current = {
            payload: {
                __ottPlexPlayback: { engine: "mse", type: "hls" },
                stream_url: url,
            },
        };
        f.w.__ottMedia = { current: () => current };
        f.w.stbPlay(url, 40);
        assert.equal(f.players.length, 1);
        assert.equal(f.players[0].url, url);
        assert.equal(f.players[0].media, f.w.video);
        assert.equal(f.players[0].config.startFragPrefetch, undefined);
        assert.equal(f.shakaPlayers.length, 0);
        assert.equal(f.w.playerMode, mode);
        assert.equal(f.preferences.sPlayers, String(mode));
        f.w.stbStop();
        f.w.stbPlay("https://ordinary.test/next.m3u8");
        assert.equal(
            f.players.length,
            1,
            "The previous item's MSE hint cannot affect another URL"
        );
        assert.equal(f.shakaPlayers.length, mode === 2 ? 1 : 0);
    }
});

test("Plex MSE hint does not assume an unavailable HLS runtime", () => {
    const f = fixture({ hlsMissing: true, savedPlayerMode: 0 });
    const url = "https://plex.test/remux.m3u8";
    f.w.__ottMedia = {
        current: () => ({
            payload: {
                __ottPlexPlayback: { engine: "mse", type: "hls" },
                stream_url: url,
            },
        }),
    };
    f.w.stbPlay(url);
    assert.equal(f.w.video.src, url);
    assert.equal(f.players.length, 0);
});

test("webOS uses Auto for every requested mode while Tauri and NetCast preserve manual modes", () => {
    for (const requested of [0, 1, 2, 3]) {
        const webos = fixture({
            device: "lg/webos",
            savedPlayerMode: requested,
            tauri: false,
        });
        assert.equal(webos.w.getDefaultPlayerMode(), 3);
        assert.equal(webos.w.normalizePlayerMode(requested), 3);
        assert.equal(webos.w.playerMode, 3);
        assert.equal(webos.preferences.sPlayers, String(requested));
        for (const device of ["pc", "lg/netcast"]) {
            const legacy = fixture({
                device,
                savedPlayerMode: requested,
                tauri: false,
            });
            assert.equal(legacy.w.getDefaultPlayerMode(), 0);
            assert.equal(
                legacy.w.normalizePlayerMode(requested),
                requested === 3 ? 0 : requested
            );
            assert.equal(legacy.preferences.sPlayers, String(requested));
        }
        const tauri = fixture({ savedPlayerMode: requested });
        assert.equal(tauri.w.getDefaultPlayerMode(), 3);
        assert.equal(tauri.w.playerMode, requested);
        assert.equal(tauri.preferences.sPlayers, String(requested));
    }
});

const testHost = {
    device: "android",
    tauri: false,
    userAgent:
        "Mozilla/5.0 (Linux; Android 16) Chrome/143.0.0.0 OttplayTestWebView/1.0",
};

test("Android test host marker is exact, bounded and independent of native product bridges", () => {
    for (const userAgent of [
        "OttplayTestWebView/1.0",
        testHost.userAgent,
        "Mozilla/5.0 OttplayTestWebView/1.0 Chrome/143",
        "Mozilla/5.0\tOttplayTestWebView/1.0\tChrome/143",
    ]) {
        const f = fixture({ ...testHost, userAgent });
        assert.equal(f.w.isOttplayTestWebView(), true);
        assert.equal(f.w.getDefaultPlayerMode(), 3);
        assert.deepEqual(Array.from(f.w.playerModeNames), [
            "html5",
            "hls.js",
            "shaka",
            "auto",
        ]);
    }
    for (const userAgent of [
        "Mozilla/5.0 (Linux; Android 16) Chrome/143.0.0.0",
        "NotOttplayTestWebView/1.0",
        "OttplayTestWebView/1.00",
        "OttplayTestWebView/1.0.1",
        "OttplayTestWebView/1.0suffix",
        "OttplayTestWebView/1.0;Other",
        "ottplaytestwebview/1.0",
        "OttplayTestWebView/2.0",
    ]) {
        const f = fixture({ ...testHost, userAgent });
        assert.equal(f.w.isOttplayTestWebView(), false, userAgent);
        assert.equal(f.w.getDefaultPlayerMode(), 0);
        assert.equal(f.w.playerModeNames.length, 3);
        f.w.setPlayer();
        f.w.stbPlay("old-android.m3u8");
        assert.equal(f.w.video.src, "old-android.m3u8");
        assert.equal(f.players.length, 0);
    }
    for (const device of ["pc", "lg/webos", "lg/netcast", "samsung/tizen"]) {
        const f = fixture({ ...testHost, device });
        assert.equal(f.w.isOttplayTestWebView(), false, device);
    }
    for (const bridge of [
        "Capacitor",
        "__ottNativeRuntime",
        "Android",
        "__TAURI__",
        "__TAURI_INTERNALS__",
    ]) {
        const f = fixture({ ...testHost, globals: { [bridge]: {} } });
        assert.equal(f.w.isOttplayTestWebView(), false, bridge);
        assert.equal(
            f.w.getDefaultPlayerMode(),
            bridge.startsWith("__TAURI") ? 3 : 0
        );
        f.w.setPlayer();
        f.w.stbPlay("native-product.m3u8");
        ready(f.w.video, true);
        f.advance(10000);
        assert.equal(f.w.video.src, "native-product.m3u8", bridge);
        assert.equal(
            f.players.length,
            0,
            "native product behavior remains unchanged"
        );
    }
    const guarded = fixture(testHost);
    // Node's contextified global suppresses throwing getters; use a normal
    // window object here to exercise an unavailable native bridge faithfully.
    guarded.w.window = Object.create(guarded.w);
    Object.defineProperty(guarded.w.window, "Android", {
        get() {
            throw new Error("native bridge unavailable");
        },
    });
    assert.equal(guarded.w.isOttplayTestWebView(), false);
    assert.equal(guarded.w.getDefaultPlayerMode(), 0);
});

test("marked Android defaults to Auto without replacing saved manual engine choices", () => {
    const fresh = fixture(testHost);
    fresh.w.setPlayerMode(fresh.w.getDefaultPlayerMode());
    fresh.w.setPlayer();
    assert.equal(fresh.w.playerMode, 3);
    assert.deepEqual(fresh.preferences, {});
    for (const savedPlayerMode of [0, 1, 2]) {
        const f = fixture({ ...testHost, savedPlayerMode });
        f.w.setPlayer();
        f.w.stbPlay("manual-android.m3u8");
        assert.equal(f.w.playerMode, savedPlayerMode);
        assert.equal(f.players.length, savedPlayerMode === 1 ? 1 : 0);
        assert.equal(f.shakaPlayers.length, savedPlayerMode === 2 ? 1 : 0);
        assert.equal(f.preferences.sPlayers, String(savedPlayerMode));
        if (savedPlayerMode === 0) {
            f.w.video.error = { code: 4 };
            f.w.video.emit("error");
            f.advance(10000);
            assert.equal(
                f.players.length,
                0,
                "explicit HTML5 remains an explicit choice"
            );
        }
    }
});

test("marked Android Auto uses HLS despite native claims, Shaka for DASH and native MP4", async () => {
    const f = fixture(testHost);
    assert.equal(
        f.w.video.canPlayType("application/vnd.apple.mpegurl"),
        "probably"
    );
    f.w.stbPlay("android-live.M3U8?quality=auto#live");
    assert.equal(f.players.length, 1);
    assert.equal(f.players[0].media, f.w.video);
    assert.equal(f.players[0].url, "android-live.M3U8?quality=auto#live");
    assert.equal(
        f.players[0].config.startFragPrefetch,
        undefined,
        "actual playback starts without a native probe"
    );
    assert.deepEqual(f.w.video.sourceHistory, ["blob:hls-0"]);
    f.players[0].emit("manifest");
    assert.equal(f.w.video.playCalls, 1);
    f.w.stbPlay("android-archive.MPD?start=33", 33);
    assert.equal(f.players[0].destroyCalls, 1);
    assert.equal(f.shakaPlayers.length, 1);
    assert.equal(f.shakaPlayers[0].media, f.w.video);
    assert.equal(f.shakaPlayers[0].url, "android-archive.MPD?start=33");
    assert.equal(f.shakaPlayers[0].position, 33);
    f.w.stbPlay("android-vod.mp4?quality=high");
    assert.equal(f.shakaPlayers[0].destroyCalls, 1);
    assert.notEqual(
        f.w.video.src,
        "android-vod.mp4?quality=high",
        "next decoder waits for Shaka release"
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.shakaPlayers[0].getMediaElement(), null);
    assert.equal(f.w.video.src, "android-vod.mp4?quality=high");
    assert.equal(f.players.length, 1);
    assert.equal(f.w.playerMode, 3);
    assert.deepEqual(f.preferences, {});
});

test("marked Android Auto falls back to native when HLS is missing or unsupported", () => {
    for (const unavailable of [{ hlsMissing: true }, { hlsSupported: false }]) {
        for (const nativeHls of [true, false]) {
            const f = fixture({ ...testHost, ...unavailable, nativeHls });
            f.w.stbPlay("missing-hls.m3u8");
            f.w.stbPlayPip("missing-pip.m3u8");
            assert.equal(f.players.length, 0);
            assert.equal(f.w.video.src, "missing-hls.m3u8");
            assert.equal(f.w.videoPip.src, "missing-pip.m3u8");
            assert.equal(f.w.video.playCalls, 1);
            assert.equal(f.w.videoPip.playCalls, 1);
        }
    }
});

test("marked Android CSS PiP shares HLS-first Auto selection and keeps main playback isolated", () => {
    const f = fixture(testHost);
    f.w.stbPlay("main.m3u8");
    f.w.stbPlayPip("pip.m3u8?channel=2");
    assert.equal(f.players.length, 2);
    assert.equal(f.players[0].media, f.w.video);
    assert.equal(f.players[1].media, f.w.videoPip);
    assert.deepEqual(f.w.videoPip.sourceHistory, ["blob:hls-1"]);
    f.players[0].emit("manifest");
    f.players[1].emit("manifest");
    assert.equal(f.w.video.playCalls, 1);
    assert.equal(f.w.videoPip.playCalls, 1);
    f.w.stbPlayPip("pip-vod.mp4");
    assert.equal(f.players[1].destroyCalls, 1);
    assert.equal(f.w.videoPip.src, "pip-vod.mp4");
    assert.equal(f.w.video.src, "blob:hls-0");
    f.w.stbStopPip();
    f.players[1].emit("manifest");
    assert.equal(
        f.w.videoPip.playCalls,
        2,
        "stale PiP manifest cannot restart playback"
    );
    assert.equal(f.players[0].destroyCalls, 0);
    assert.equal(f.w.video.src, "blob:hls-0");
});

test("webOS keeps working HLS native despite an old HTML5, HLS or Shaka preference", () => {
    for (const savedPlayerMode of [0, 1, 2]) {
        const f = fixture({
            device: "lg/webos",
            savedPlayerMode,
            tauri: false,
        });
        f.w.setPlayer();
        f.w.stbPlay("working-lg.m3u8?token=1");
        ready(f.w.video, true);
        f.advance(10000);
        assert.equal(f.w.video.src, "working-lg.m3u8?token=1");
        assert.equal(f.w.video.playCalls, 1);
        assert.equal(f.players.length, 0);
        assert.equal(f.shakaPlayers.length, 0);
        assert.equal(f.w.playerMode, 3);
        assert.equal(f.preferences.sPlayers, String(savedPlayerMode));
    }
});

test("webOS without native HLS uses HLS and routes DASH through Shaka", () => {
    for (const savedPlayerMode of [0, 1, 2]) {
        const f = fixture({
            device: "lg/webos",
            nativeHls: false,
            savedPlayerMode,
            tauri: false,
        });
        f.w.stbPlay("lg-live.m3u8?quality=auto");
        assert.equal(f.players.length, 1);
        assert.equal(f.players[0].url, "lg-live.m3u8?quality=auto");
        assert.equal(f.players[0].media, f.w.video);
        f.players[0].emit("manifest");
        assert.equal(f.w.video.playCalls, 1);
        f.w.stbPlay("lg-archive.mpd?start=33", 33);
        assert.equal(f.players[0].destroyCalls, 1);
        assert.equal(f.shakaPlayers.length, 1);
        assert.equal(f.shakaPlayers[0].url, "lg-archive.mpd?start=33");
        assert.equal(f.shakaPlayers[0].position, 33);
        assert.equal(f.shakaPlayers[0].media, f.w.video);
        assert.equal(f.w.video.playCalls, 2);
        assert.equal(f.preferences.sPlayers, String(savedPlayerMode));
    }
});

test("webOS native decode failure switches to HLS once without changing the saved choice", () => {
    const f = fixture({
        device: "lg/webos",
        savedPlayerMode: 0,
        tauri: false,
    });
    f.w.stbPlay("lg-error.m3u8");
    f.w.video.error = { code: 3 };
    f.w.video.emit("error");
    f.w.video.emit("error");
    f.advance(0);
    assert.equal(f.players.length, 1);
    assert.equal(f.players[0].url, "lg-error.m3u8");
    assert.equal(f.players[0].media, f.w.video);
    f.players[0].emit("manifest");
    ready(f.w.video, true);
    f.advance(10000);
    assert.equal(f.players.length, 1);
    assert.equal(f.w.playerMode, 3);
    assert.equal(f.preferences.sPlayers, "0");
});

test("webOS routes DASH through Shaka even with native HLS and retains unsupported-library fallback", () => {
    for (const shakaSupported of [true, false]) {
        const f = fixture({
            device: "lg/webos",
            savedPlayerMode: 0,
            shakaSupported,
            tauri: false,
        });
        f.w.stbPlay("lg-dash.mpd");
        assert.equal(f.shakaPlayers.length, shakaSupported ? 1 : 0);
        assert.equal(f.players.length, 0);
        assert.equal(f.w.video.playCalls, 1);
        if (!shakaSupported) assert.equal(f.w.video.src, "lg-dash.mpd");
    }
    const f = fixture({
        device: "lg/webos",
        hlsSupported: false,
        nativeHls: false,
        savedPlayerMode: 1,
        tauri: false,
    });
    f.w.stbPlay("lg-no-mse.m3u8");
    assert.equal(f.players.length, 0);
    assert.equal(f.w.video.src, "lg-no-mse.m3u8");
    assert.equal(f.w.video.playCalls, 1);
});

test("setPlayer applies late webOS detection and preserves an active native session", () => {
    const f = fixture({ savedPlayerMode: 2, tauri: false });
    assert.equal(f.w.playerMode, 2);
    f.w.ott_device = "lg/webos";
    f.w.setPlayer();
    assert.equal(f.w.playerMode, 3);
    f.w.stbPlay("late-lg.m3u8");
    ready(f.w.video, true);
    f.w.setPlayer();
    f.advance(10000);
    assert.equal(f.w.video.playCalls, 1);
    assert.deepEqual(f.w.video.sourceHistory, ["late-lg.m3u8"]);
    assert.equal(f.players.length, 0);
    assert.equal(f.shakaPlayers.length, 0);
    assert.equal(f.preferences.sPlayers, "2");
});

test("Tauri Shaka and NetCast native/HLS preferences still select their requested engines", () => {
    const tauri = fixture({ savedPlayerMode: 2 });
    tauri.w.setPlayer();
    tauri.w.stbPlay("tauri-manual.m3u8");
    assert.equal(tauri.shakaPlayers.length, 1);
    assert.equal(tauri.shakaPlayers[0].url, "tauri-manual.m3u8");
    for (const savedPlayerMode of [0, 1]) {
        const netcast = fixture({
            device: "lg/netcast",
            savedPlayerMode,
            tauri: false,
        });
        netcast.w.setPlayer();
        netcast.w.stbPlay("netcast-manual.m3u8");
        netcast.w.video.error = { code: 3 };
        netcast.w.video.emit("error");
        netcast.advance(10000);
        assert.equal(netcast.w.playerMode, savedPlayerMode);
        assert.equal(netcast.players.length, savedPlayerMode);
        assert.equal(netcast.preferences.sPlayers, String(savedPlayerMode));
    }
});

test("webOS CSS PiP native fallback leaves the working main stream alone", () => {
    const f = fixture({
        device: "lg/webos",
        savedPlayerMode: 1,
        tauri: false,
    });
    f.w.stbPlay("lg-main.m3u8");
    ready(f.w.video, true);
    f.w.stbPlayPip("lg-pip.m3u8");
    f.w.videoPip.error = { code: 4 };
    f.w.videoPip.emit("error");
    f.advance(0);
    assert.equal(f.players.length, 1);
    assert.equal(f.players[0].url, "lg-pip.m3u8");
    assert.equal(f.players[0].media, f.w.videoPip);
    assert.equal(f.w.video.src, "lg-main.m3u8");
    assert.equal(f.w.video.playCalls, 1);
    assert.equal(f.preferences.sPlayers, "1");
});

test("HEVC audio-only probes once, retains URL and VOD position, and never caps 1080 to window size", () => {
    const f = fixture();
    const url = "http://127.0.0.1:8090/channel/test/index.m3u8?q=1789308244275";
    f.w.stbPlay(url, 45);
    ready(f.w.video);
    assert.equal(f.w.video.currentTime, 45);
    f.w.video.currentTime = 52;
    f.advance(1500);
    const first = f.players[0];
    hevc(first);
    assert.equal(
        first.destroyCalls,
        0,
        "Result is deferred out of transmux callback"
    );
    f.advance(0);
    const actual = f.players[1];
    assert.equal(first.destroyCalls, 1);
    assert.equal(actual.url, url);
    assert.equal(actual.media, f.w.video);
    assert.equal(actual.config.capLevelToPlayerSize, false);
    actual.emit("manifest");
    ready(f.w.video, true);
    assert.equal(actual.config.startPosition, 52);
    assert.equal(f.w.video.currentTime, 0, "HLS controls its buffered seek");
    assert.equal(f.w.video.videoHeight, 1080);
    hevc(first);
    f.advance(10000);
    assert.equal(f.players.length, 2);
    assert.equal(
        f.w.playerMode,
        3,
        "Fallback does not rewrite saved Auto mode"
    );
});

test("real radio renews the proxy session once and keeps native playback", () => {
    const f = fixture();
    f.w.stbPlay("radio.m3u8");
    const first = probe(f);
    first.emit("tracks", {
        id: "audio",
        tracks: { audio: { codec: "mp4a.40.2" } },
    });
    f.advance(0);
    assert.equal(
        first.destroyCalls,
        0,
        "Alternate audio is not the main stream result"
    );
    first.emit("tracks", {
        id: "main",
        tracks: { audio: { codec: "mp4a.40.2" } },
    });
    f.advance(0);
    assert.equal(first.destroyCalls, 1);
    assert.equal(
        f.w.video.sourceHistory.filter((url) => url === "radio.m3u8").length,
        2
    );
    assert.equal(f.w.video.playCalls, 2);
    ready(f.w.video);
    f.advance(10000);
    assert.equal(
        f.players.length,
        1,
        "Radio does not repeatedly probe or change engine"
    );
});

test("advertised 720p dimensions cannot hide audio-only native HEVC or misclassify radio", () => {
    for (const result of ["hevc", "radio"]) {
        const f = fixture();
        f.w.stbPlay("advertised.m3u8");
        ready(f.w.video);
        f.w.video.videoWidth = 1280;
        f.w.video.videoHeight = 720;
        f.w.video.emit("resize");
        f.advance(1500);
        const first = f.players[0];
        assert.ok(first, "Empty videoTracks overrides advertised dimensions");
        if (result === "hevc") hevc(first);
        else
            first.emit("tracks", {
                id: "main",
                tracks: { audio: { codec: "mp4a.40.2" } },
            });
        f.advance(0);
        assert.equal(first.destroyCalls, 1);
        if (result === "hevc") {
            assert.equal(f.players.length, 2);
            assert.equal(f.players[1].media, f.w.video);
        } else {
            assert.equal(f.players.length, 1);
            assert.equal(f.w.video.src, "advertised.m3u8");
            assert.equal(f.w.video.sourceHistory.length, 2);
        }
    }
});

test("probe timeout or unknown/error result restores native even when user paused", () => {
    for (const result of ["timeout", "error", "unknown"]) {
        const f = fixture();
        f.w.stbPlay("radio.m3u8", 20);
        const first = probe(f);
        f.w.stbPause();
        if (result === "timeout") f.advance(8000);
        else if (result === "error") first.emit("error", { fatal: true });
        else first.emit("tracks", { id: "main", tracks: {} });
        f.advance(0);
        ready(f.w.video);
        assert.equal(first.destroyCalls, 1);
        assert.equal(f.w.video.src, "radio.m3u8");
        assert.equal(f.w.video.currentTime, 20);
        assert.equal(f.w.video.playCalls, 1);
        assert.equal(f.w.video.paused, true);
        assert.equal(f.w.forcePlay, false);
        assert.equal(f.timers.size, 0);
    }
});

test("native Auto transition owns its error before outer recovery and preserves later HLS retries", () => {
    for (const code of [3, 4]) {
        const f = fixture();
        const url = "https://source.invalid/live.m3u8";
        f.w.stbPlay(url);
        f.w.video.error = { code };
        f.w.video.emit("error");
        f.w.video.emit("error");
        f.advance(0);
        assert.equal(f.players.length, 1);
        assert.deepEqual(
            f.messages,
            [],
            "queued Auto fallback is not terminal"
        );
        assert.notEqual(f.w.__ottStreamPolicy.snapshot().state, "failed");
        f.players[0].emit("error", {
            details: "manifestParsingError",
            fatal: true,
            type: "network",
        });
        assert.equal(f.messages.at(-1), "Reconnecting…");
        f.advance(500);
        assert.equal(
            f.w.__ottStreamPolicy.snapshot().attempts,
            1,
            "Auto fallback retains its request retry budget"
        );
        assert.equal(
            f.w.video.src,
            url,
            "the retry reopens the original source"
        );
        f.w.video.error = { code };
        f.w.video.emit("error");
        f.advance(0);
        assert.equal(f.players.length, 2);
        assert.equal(f.players[1].url, url);
        assert.equal(f.messages.includes("Stream could not be played"), false);
        f.w.stbStop();
        assert.equal(f.timers.size, 0);
    }
});

test("native errors during an Auto probe remain owned until its deferred outcome", () => {
    for (const result of ["hls", "radio"]) {
        const f = fixture();
        const url = "https://source.invalid/live.m3u8";
        f.w.stbPlay(url);
        const activeProbe = probe(f);
        f.w.video.error = { code: 3 };
        f.w.video.emit("error");
        f.advance(0);
        assert.deepEqual(f.messages, []);
        if (result === "hls") hevc(activeProbe);
        else activeProbe.emit("tracks", { id: "main", tracks: { audio: {} } });
        f.advance(0);
        assert.deepEqual(f.messages, []);
        assert.equal(activeProbe.destroyCalls, 1);
        if (result === "hls") assert.equal(f.players.length, 2);
        else {
            assert.equal(f.w.video.src, url);
            // The completed probe no longer hides an unrelated native error.
            f.w.video.error = { code: 3 };
            f.w.video.emit("error");
            f.advance(0);
            assert.equal(f.messages.at(-1), "Stream could not be played");
        }
        f.w.stbStop();
        assert.equal(f.timers.size, 0);
    }
});

test("Stop and source replacement cancel queued native failure and Auto fallback", () => {
    for (const action of ["stop", "replace"]) {
        const f = fixture();
        f.w.stbPlay("old.m3u8");
        f.w.video.error = { code: 3 };
        f.w.video.emit("error");
        if (action === "stop") f.w.stbStop();
        else f.w.stbPlay("new.mp4");
        f.advance(10000);
        assert.deepEqual(f.messages, []);
        assert.equal(f.players.length, 0);
        assert.equal(f.timers.size, 0);
        assert.equal(f.w.video.src, action === "stop" ? "" : "new.mp4");
    }
});

test("direct MP4 stays native while an HLS-only webview uses hls.js immediately", () => {
    const f = fixture({ nativeHls: false });
    f.w.stbPlay("movie.mp4?download=1", 12);
    ready(f.w.video, true);
    assert.equal(f.w.video.currentTime, 12);
    f.w.video.error = { code: 4 };
    f.w.video.emit("error");
    f.advance(10000);
    assert.equal(f.players.length, 0);
    assert.equal(f.messages.at(-1), "Stream could not be played");
    assert.equal(f.timers.size, 0);
    f.w.stbPlay("movie.m3u8?download=1");
    assert.equal(f.players.length, 1);
    assert.equal(f.players[0].media, f.w.video);
    assert.equal(f.players[0].config.startFragPrefetch, undefined);
});

test("native decode/unsupported errors fall back once; network errors and absent track APIs do not", () => {
    for (const code of [2, 3, 4]) {
        const f = fixture();
        f.w.stbPlay("error.m3u8");
        f.w.video.error = { code };
        f.w.video.emit("error");
        f.w.video.emit("error");
        f.advance(0);
        assert.equal(f.players.length, code === 2 ? 0 : 1);
    }
    const f = fixture();
    f.w.stbPlay("unknown.m3u8");
    ready(f.w.video);
    f.w.video.videoTracks = undefined;
    f.w.video.emit("timeupdate");
    f.advance(10000);
    assert.equal(f.players.length, 0);
    assert.equal(f.w.video.pauseCalls, 0);
});

test("Auto retries query-selected Stalker HLS once without rewriting signed links", () => {
    for (const url of [
        "http://portal.test/play/live.php?extension=m3u8",
        "https://portal.test/play/live.php?stream=42&extension=m3u8&play_token=a%2Bb%2f&x=1&x=2",
        "https://portal.test/play/live.php?extension=M3U8#player",
    ]) {
        for (const pip of [false, true]) {
            const f = fixture();
            const media = pip ? f.w.videoPip : f.w.video;
            if (pip) f.w.stbPlayPip(url);
            else f.w.stbPlay(url);
            assert.equal(media.src, url);
            media.error = { code: 4 };
            media.emit("error");
            media.emit("error");
            f.advance(0);
            assert.equal(f.players.length, 1);
            assert.equal(f.players[0].url, url);
            assert.equal(f.players[0].media, media);
            assert.equal(f.w.playerMode, 3);
        }
    }
});

test("query-selected HLS keeps working native playback and cancels stale fallbacks", () => {
    const url =
        "http://portal.test/play/live.php?extension=m3u8&play_token=opaque";
    const f = fixture();
    f.w.stbPlay(url);
    ready(f.w.video, true);
    f.advance(10000);
    assert.equal(f.players.length, 0);
    f.w.video.error = { code: 4 };
    f.w.video.emit("error");
    f.w.stbPlay("next.mp4");
    f.advance(0);
    assert.equal(f.players.length, 0);
    assert.equal(f.w.video.src, "next.mp4");
});

test("unrelated query values and fragments do not trigger HLS error fallback", () => {
    for (const tail of [
        "?extension=ts",
        "?extension=m3u8evil",
        "?other_extension=m3u8",
        "#?extension=m3u8",
        "?next=?extension=m3u8",
    ]) {
        const f = fixture();
        f.w.stbPlay("http://portal.test/play/live.php" + tail);
        f.w.video.error = { code: 4 };
        f.w.video.emit("error");
        f.advance(0);
        assert.equal(f.players.length, 0);
    }
});

test("late dimensions or a user pause cancel speculative audio-only detection", () => {
    for (const action of ["video", "pause"]) {
        const f = fixture();
        f.w.stbPlay("slow.m3u8");
        ready(f.w.video);
        f.advance(1000);
        if (action === "video") ready(f.w.video, true);
        else f.w.stbPause();
        f.advance(10000);
        assert.equal(f.players.length, 0);
    }
});

test("native video arriving during a probe or its deferred result keeps the native engine", () => {
    for (const timing of ["during-probe", "after-result"]) {
        const f = fixture();
        f.w.stbPlay("slow-video.m3u8");
        const first = probe(f);
        if (timing === "during-probe") ready(f.w.video, true);
        hevc(first);
        if (timing === "after-result") ready(f.w.video, true);
        f.advance(0);
        assert.equal(first.destroyCalls, 1);
        assert.equal(f.players.length, 1, "No fallback decoder is attached");
        assert.equal(f.w.video.src, "slow-video.m3u8");
        assert.equal(f.w.video.sourceHistory.length, 2, "Renew proxy session");
    }
});

test("pause during a HEVC probe survives HLS attachment and late manifest", () => {
    const f = fixture();
    f.w.stbPlay("paused.m3u8", 35);
    const first = probe(f);
    f.w.stbPause();
    hevc(first, true);
    f.advance(0);
    f.players[1].emit("manifest");
    ready(f.w.video, true);
    assert.equal(f.players[1].config.startPosition, 35);
    assert.equal(f.w.video.currentTime, 0, "HLS controls its buffered seek");
    assert.equal(f.w.video.playCalls, 1);
    assert.equal(f.w.video.paused, true);
    f.w.stbContinue();
    assert.equal(f.w.video.playCalls, 2);
});

test("stop, channel switch and mode change dispose pending probes and suppress their queued results", () => {
    for (const action of ["stop", "switch", "mode"]) {
        const f = fixture();
        f.w.stbPlay("old.m3u8");
        const first = probe(f);
        hevc(first);
        if (action === "stop") f.w.stbStop();
        else if (action === "switch") f.w.stbPlay("new.mp4");
        else f.w.setPlayerMode(0);
        const expectedSrc = f.w.video.src;
        const expectedPlays = f.w.video.playCalls;
        hevc(first);
        first.emit("error", { fatal: true });
        f.advance(10000);
        assert.equal(first.destroyCalls, 1);
        assert.equal(f.players.length, 1);
        assert.equal(f.w.video.src, expectedSrc);
        assert.equal(f.w.video.playCalls, expectedPlays);
        assert.equal(f.timers.size, 0);
    }
});

test("mode changes renew a probed native session exactly once and preserve pause/seek intent", () => {
    for (const queued of [false, true]) {
        for (const paused of [false, true]) {
            const f = fixture();
            f.w.stbPlay("mode-change.m3u8", 24);
            const first = probe(f);
            if (queued) hevc(first);
            if (paused) f.w.stbPause();
            f.w.setPlayerMode(0);
            assert.equal(first.destroyCalls, 1);
            assert.equal(f.w.video.src, "mode-change.m3u8");
            assert.equal(
                f.w.video.sourceHistory.length,
                2,
                "Renew the native proxy session once"
            );
            ready(f.w.video);
            assert.equal(f.w.video.currentTime, 24);
            assert.equal(f.w.video.playCalls, paused ? 1 : 2);
            assert.equal(f.w.video.paused, paused);
            hevc(first);
            f.advance(10000);
            f.w.setPlayerMode(1);
            assert.equal(
                f.players.length,
                1,
                "Mode-change cancellation suppresses the pending fallback"
            );
            assert.equal(f.w.video.sourceHistory.length, 2);
            assert.equal(f.timers.size, 0);
        }
    }
});

test("mode changes before a probe starts do not renew native source or restart playback", () => {
    const f = fixture();
    f.w.stbPlay("preprobe.m3u8");
    ready(f.w.video);
    f.w.setPlayerMode(0);
    f.advance(10000);
    assert.equal(f.players.length, 0);
    assert.equal(f.w.video.sourceHistory.length, 1);
    assert.equal(f.w.video.playCalls, 1);
    assert.equal(f.timers.size, 0);
});

test("a failed Auto HLS fallback never returns to audio-only native playback", () => {
    const f = fixture();
    f.w.stbPlay("broken.m3u8");
    hevc(probe(f));
    f.advance(0);
    const actual = f.players[1];
    actual.emit("manifest");
    const fatal = { details: "bufferAppendError", fatal: true, type: "media" };
    actual.emit("error", fatal);
    assert.equal(actual.recoverCalls, 1);
    actual.emit("error", fatal);
    f.advance(10000);
    assert.equal(actual.destroyCalls, 1);
    assert.equal(
        f.w.video.sourceHistory.filter((url) => url === "broken.m3u8").length,
        1
    );
    assert.equal(f.players.length, 2);
});

test("main and CSS PiP Auto sessions isolate fallback, stop and stale manifests", () => {
    const f = fixture();
    f.w.stbPlay("main.m3u8");
    ready(f.w.video, true);
    f.w.stbPlayPip("pip.m3u8");
    const first = probe(f, f.w.videoPip);
    hevc(first);
    f.advance(0);
    const actual = f.players[1];
    assert.equal(actual.media, f.w.videoPip);
    actual.emit("manifest");
    assert.equal(f.w.videoPip.playCalls, 2);
    assert.equal(f.w.video.src, "main.m3u8");
    assert.equal(f.w.video.playCalls, 1);
    f.w.stbStopPip();
    actual.emit("manifest");
    assert.equal(f.w.videoPip.playCalls, 2);
    assert.equal(f.w.videoPip.src, "");
    f.w.stbPlayPip("pending.m3u8");
    const pending = probe(f, f.w.videoPip);
    f.w.stbStopPip();
    hevc(pending);
    f.advance(10000);
    assert.equal(pending.destroyCalls, 1);
    assert.equal(f.players.length, 3);
    assert.equal(f.w.video.src, "main.m3u8");
});

test("changing engine mode immediately cancels a pending CSS PiP probe", () => {
    const f = fixture();
    f.w.stbPlayPip("old-pip.m3u8");
    const first = probe(f, f.w.videoPip);
    f.w.setPlayerMode(0);
    assert.equal(first.destroyCalls, 1);
    const plays = f.w.videoPip.playCalls;
    hevc(first);
    f.advance(10000);
    assert.equal(f.players.length, 1);
    assert.equal(f.w.videoPip.playCalls, plays);
    assert.equal(f.timers.size, 0);
});

test("lazy engine loading preserves saved preference and attaches only after readiness", () => {
    const f = fixture({ hlsMissing: true, savedPlayerMode: 1 });
    const loadedHls = fixture().w.Hls;
    const requests = [];
    f.w.__ottLoadMediaEngine = (engine, ready) =>
        requests.push({ engine, ready });
    f.w.setPlayerMode(1);
    assert.equal(f.w.playerMode, 1);
    f.w.stbPlay("lazy.m3u8");
    assert.deepEqual(
        requests.map((request) => request.engine),
        ["hls"]
    );
    assert.equal(f.w.video.src, "");
    assert.equal(f.w.hlsInstance, null);
    f.w.Hls = loadedHls;
    requests[0].ready(true);
    assert(
        f.w.hlsInstance,
        "MSE is attached only after the constructor is ready"
    );
});

test("lazy completion cannot revive a stopped or replaced playback", () => {
    for (const action of ["stop", "replace"]) {
        const f = fixture({ hlsMissing: true, savedPlayerMode: 1 });
        const requests = [];
        f.w.__ottLoadMediaEngine = (engine, ready) =>
            requests.push({ engine, ready });
        f.w.setPlayerMode(1);
        f.w.stbPlay("stale.m3u8");
        if (action === "stop") f.w.stbStop();
        else f.w.stbPlay("current.m3u8");
        requests[0].ready(false);
        assert.equal(f.w.video.src, "");
        if (action === "replace") {
            requests[1].ready(false);
            assert.equal(
                f.w.video.src,
                "current.m3u8",
                "Failed engine falls back on current source"
            );
        }
    }
});

test("native files never request an engine and native HLS loads only for an actual probe", () => {
    const f = fixture({ hlsMissing: true });
    const requests = [];
    f.w.__ottLoadMediaEngine = (engine, ready) =>
        requests.push({ engine, ready });
    f.w.stbPlay("local.mp4");
    assert.equal(requests.length, 0);
    assert.equal(f.w.video.src, "local.mp4");
    f.w.stbPlay("native.m3u8");
    ready(f.w.video, true);
    f.advance(1500);
    assert.equal(
        requests.length,
        0,
        "Working native video does not download a probe engine"
    );
    ready(f.w.video, false);
    f.advance(1500);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].engine, "hls");
    f.w.stbStop();
    f.w.Hls = fixture().w.Hls;
    requests[0].ready(true);
    assert.equal(
        f.w.video.src,
        "",
        "Cancelled probe must not reattach a decoder"
    );
});

test("Shaka is requested alone and DASH never reaches native after a failed download", async () => {
    const f = fixture({ savedPlayerMode: 2 });
    const runtime = f.w.shaka;
    delete f.w.shaka;
    const requests = [];
    f.w.__ottLoadMediaEngine = (engine, ready) =>
        requests.push({ engine, ready });
    f.w.stbPlay("delayed.mpd");
    assert.equal(requests[0].engine, "shaka");
    assert.equal(f.w.video.src, "");
    f.w.shaka = runtime;
    requests[0].ready(true);
    assert.equal(f.shakaPlayers.length, 1);
    assert.equal(f.shakaPlayers[0].url, "delayed.mpd");
    delete f.w.shaka;
    f.w.stbPlay("failed.mpd");
    assert.equal(requests.length, 1, "next load waits for old Shaka release");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.shakaPlayers[0].getMediaElement(), null);
    requests[1].ready(false);
    assert.notEqual(f.w.video.src, "failed.mpd");
    assert(f.messages.includes("Reconnecting…"));
    f.w.stbStop();
    f.advance(3000);
    assert.equal(requests.length, 2);
});

test("fresh Chrome selects lazy HLS without a saved player preference", () => {
    const f = fixture({ hlsMissing: true, nativeHls: false, tauri: false });
    const runtime = fixture().w.Hls;
    const requests = [];
    f.w.__ottLoadMediaEngine = (engine, ready) =>
        requests.push({ engine, ready });
    f.w.setPlayerMode(0);
    f.w.setPlayer();
    assert.equal(f.w.playerMode, 1);
    assert.equal(f.preferences.sPlayers, undefined);
    f.w.stbPlay("fresh.m3u8");
    assert.equal(requests[0].engine, "hls");
    assert.equal(f.w.hlsInstance, null);
    f.w.Hls = runtime;
    requests[0].ready(true);
    assert(f.w.hlsInstance);
    assert.match(f.w.video.src, /^blob:hls-/);
});

test("only normalized initial masters extend actual HLS manifest policy", () => {
    const context = {
        clearInterval,
        clearTimeout,
        console: { error() {}, log() {}, warn() {} },
        exports: {},
        module: { exports: {} },
        navigator: { userAgent: "test" },
        performance,
        setInterval,
        setTimeout,
        TextDecoder,
        TextEncoder,
        URL,
    };
    context.self = context;
    vm.runInNewContext(
        fs.readFileSync(path.join(root, "js/hls.min.js"), "utf8"),
        context
    );
    const RealHls = context.module.exports;
    const key = "a".repeat(48);
    const urls = [
        [
            "https://gateway.test/normalize/play/example/" +
                key +
                "/master.m3u8",
            75000,
        ],
        ["https://ordinary.test/live.m3u8", 20000],
        [
            "https://gateway.test/normalize/lease/" +
                "b".repeat(32) +
                "/" +
                "c".repeat(32) +
                "/master.m3u8",
            20000,
        ],
        [
            "https://gateway.test/normalize/play/example/" +
                key +
                "/master.m3u8?other=1",
            20000,
        ],
    ];
    for (const [url, timeout] of urls) {
        const f = fixture({ globals: { URL }, savedPlayerMode: 1 });
        f.w.stbPlay(url);
        f.w.stbPlayPip(url);
        assert.equal(f.players.length, 2);
        for (const player of f.players) {
            const actual = new RealHls(player.config);
            assert.equal(
                actual.config.manifestLoadPolicy.default.maxLoadTimeMs,
                timeout
            );
            if (timeout === 75000)
                assert.equal(
                    actual.config.manifestLoadPolicy.default
                        .maxTimeToFirstByteMs,
                    timeout
                );
            assert.equal(
                actual.config.playlistLoadPolicy.default.maxLoadTimeMs,
                20000
            );
            assert.equal(
                actual.config.fragLoadPolicy.default.maxLoadTimeMs,
                120000
            );
            actual.destroy();
        }
    }
});

test("local compatibility VOD uses HLS with source-time resume even under a native-file preference", () => {
    const url = "https://library.test/compat/item/lease/index.m3u8";
    const original = "https://library.test/offline-media/item";
    const cancelled = [];
    const f = fixture({
        globals: {
            __ottLocalMedia: {
                cancelPlayback: (value) => cancelled.push(value),
                compatibilityPlayback: () => true,
                isPlaybackUrl: () => true,
                playbackSourceUrl: () => original,
                preparePlayback: () => new Promise(() => {}),
            },
        },
        savedPlayerMode: 0,
    });
    f.w.__ottActiveProviderDriver = {
        id: "offline",
        resolveStream: (value, done) => {
            done(value);
            return () => {};
        },
    };
    const lease = f.w.openCoreEngineLease(
        { lane: "main", position: 3600, sourceUrl: original, url },
        () => {}
    );
    assert.equal(f.players.length, 1);
    assert.equal(f.players[0].url, url);
    assert.equal(f.players[0].config.startPosition, 3600);
    assert.equal(f.w.__ottCoreCompatibilityUrl, url);
    assert.equal(
        f.w.playerMode,
        0,
        "compatibility does not rewrite the saved preference"
    );
    f.w.video.readyState = 1;
    f.w.video.duration = 7321.5;
    f.w.video.currentTime = 0;
    assert.equal(
        lease.sample().position,
        3600,
        "unbuffered replacement reports its requested source time, not media zero"
    );
    f.w.video.currentTime = 120;
    for (const invalid of [-1, NaN, Infinity]) {
        f.players[0].config.startPosition = invalid;
        assert.equal(
            lease.sample().position,
            120,
            "invalid HLS targets fall back to media time"
        );
    }
    f.players[0].config.startPosition = 3600;
    f.players[0].hasEnoughToStart = true;
    assert.equal(
        lease.sample().position,
        120,
        "buffered playback reports actual media time"
    );
    f.players[0].hasEnoughToStart = false;
    f.w.video.currentTime = 0;
    let resumedPreparation = 0;
    f.w.__ottLocalMedia.preparePlayback = () => {
        resumedPreparation++;
        return new Promise(() => {});
    };
    lease.pause();
    lease.resume();
    assert.equal(
        resumedPreparation,
        1,
        "Resume replaces a possibly expired idle lease"
    );
    assert.equal(
        lease.sample().position,
        3600,
        "pause/resume before buffering must not reset the requested source time"
    );
    lease.seek(5000);
    assert.equal(
        lease.sample().position,
        5000,
        "quit during prepare retains the pending source-time seek"
    );
    f.w.stopCoreEngine();
    assert(cancelled.length >= 2);
    assert(cancelled.every((value) => value === url));
});

test("compatibility retries retire only their prior main lease before preparing a replacement", () => {
    const original = "https://library.test/offline-media/movie";
    const events = [],
        cancelled = [];
    let sequence = 0,
        current,
        stopping = false;
    const f = fixture({
        globals: {
            __ottLocalMedia: {
                cancelPlayback(url) {
                    if (!stopping)
                        assert.equal(
                            f.w.__ottCoreCompatibilityUrl,
                            "",
                            "tracking is cleared before cancellation is dispatched"
                        );
                    cancelled.push(url);
                    events.push(["cancel", url]);
                },
                compatibilityPlayback: () => true,
                isPlaybackUrl: () => true,
                playbackSourceUrl: () => original,
            },
        },
        savedPlayerMode: 0,
    });
    f.w.__ottCorePipCompatibilityUrl =
        "https://library.test/compat/pip/index.m3u8";
    f.w.__ottActiveProviderDriver = {
        id: "offline",
        resolveStream(value, done) {
            if (value !== original) {
                assert.equal(value, current);
                done(value);
                return () => {};
            }
            if (current)
                assert.equal(
                    cancelled.at(-1),
                    current,
                    "prior main lease is retired before replacement preparation"
                );
            current =
                "https://library.test/compat/lease-" +
                ++sequence +
                "/index.m3u8";
            events.push(["prepare", current]);
            done(current);
            return () => {};
        },
    };
    f.w.stbPlay(original, 120);
    for (const wait of [500, 1000]) {
        const old = current;
        // Exhaust HLS's two in-place retries to exercise the outer attempt.
        for (let failure = 0; failure < 3; failure++)
            f.players.at(-1).emit("error", {
                details: "fragLoadError",
                fatal: true,
                type: "network",
            });
        f.advance(wait);
        assert.notEqual(current, old);
        assert.equal(f.w.__ottCoreCompatibilityUrl, current);
        assert.equal(cancelled.filter((url) => url === old).length, 1);
        assert.equal(events.at(-2)[0], "cancel");
        assert.equal(events.at(-1)[0], "prepare");
    }
    assert(
        !cancelled.includes(f.w.__ottCorePipCompatibilityUrl),
        "independent PiP lease is not retired"
    );
    stopping = true;
    f.w.stbStop();
    assert.equal(cancelled.at(-1), current);
    assert.equal(cancelled.filter((url) => url === current).length, 1);
});

test("stopping during compatibility retry prevents a late replacement from attaching", () => {
    const original = "https://library.test/offline-media/movie";
    const first = "https://library.test/compat/first/index.m3u8";
    const cancelled = [];
    let requests = 0,
        pending,
        pendingCancelled = 0;
    const f = fixture({
        globals: {
            __ottLocalMedia: {
                cancelPlayback: (url) => cancelled.push(url),
                compatibilityPlayback: () => true,
                isPlaybackUrl: () => true,
                playbackSourceUrl: () => original,
            },
        },
        savedPlayerMode: 0,
    });
    f.w.__ottActiveProviderDriver = {
        id: "offline",
        resolveStream(value, done) {
            if (value === original && requests++ > 0) {
                pending = done;
                return () => {
                    pendingCancelled++;
                };
            }
            done(first);
            return () => {};
        },
    };
    f.w.stbPlay(original, 120);
    for (let failure = 0; failure < 3; failure++)
        f.players.at(-1).emit("error", {
            details: "fragLoadError",
            fatal: true,
            type: "network",
        });
    f.advance(500);
    assert.equal(typeof pending, "function");
    assert.deepEqual(cancelled, [first]);
    assert.equal(f.w.__ottCoreCompatibilityUrl, "");
    const attached = f.players.length;
    f.w.stbStop();
    assert.equal(pendingCancelled, 1);
    pending("https://library.test/compat/stale/index.m3u8");
    assert.equal(f.players.length, attached);
    assert.equal(f.w.__ottCoreCompatibilityUrl, "");
});

for (const reentry of ["performance callback", "old lease cancellation"]) {
    test(
        "synchronous " +
            reentry +
            " cannot let a retired compatibility retry cancel new playback",
        () => {
            const original = "https://library.test/offline-media/old";
            const otherOriginal = "https://library.test/offline-media/new";
            const oldLease = "https://library.test/compat/old/index.m3u8";
            const newLease = "https://library.test/compat/new/index.m3u8";
            const pipLease = "https://library.test/compat/pip/index.m3u8";
            const cancelled = [],
                resolved = [];
            let armed = false,
                replacements = 0;
            function replace() {
                if (!armed) return;
                armed = false;
                replacements++;
                f.w.stbPlay(otherOriginal, 240);
            }
            const f = fixture({
                globals: {
                    __ottLocalMedia: {
                        cancelPlayback(url) {
                            cancelled.push(url);
                            if (
                                reentry === "old lease cancellation" &&
                                url === oldLease
                            )
                                replace();
                        },
                        compatibilityPlayback: (url) =>
                            url === original ||
                            url === otherOriginal ||
                            url.includes("/compat/"),
                        isPlaybackUrl: () => true,
                        playbackSourceUrl: (url) =>
                            url === newLease ? otherOriginal : original,
                    },
                    __ottPerfSink: {
                        changed() {},
                        recovery(key) {
                            if (
                                reentry === "performance callback" &&
                                key === "streamRetries"
                            )
                                replace();
                        },
                    },
                },
                savedPlayerMode: 0,
            });
            f.w.__ottActiveProviderDriver = {
                id: "offline",
                resolveStream(value, done) {
                    resolved.push(value);
                    done(
                        value === original
                            ? oldLease
                            : value === otherOriginal
                              ? newLease
                              : value
                    );
                    return () => {};
                },
            };
            f.w.stbPlayPip(pipLease);
            const pip = f.players.find(
                (player) => player.media === f.w.videoPip
            );
            const pipSource = f.w.videoPip.src;
            f.w.stbPlay(original, 120);
            const old = f.players.at(-1);
            assert.equal(old.url, oldLease);
            armed = true;
            for (let failure = 0; failure < 3; failure++)
                old.emit("error", {
                    details: "fragLoadError",
                    fatal: true,
                    type: "network",
                });
            f.advance(500);
            const current = f.players.at(-1);
            assert.equal(replacements, 1);
            assert.equal(
                resolved.filter((url) => url === original).length,
                1,
                "retired retry must not prepare the old original again"
            );
            assert.equal(
                resolved.filter((url) => url === otherOriginal).length,
                1
            );
            assert.equal(f.w.__ottCoreCompatibilityUrl, newLease);
            assert.equal(current.url, newLease);
            assert.equal(current.config.startPosition, 240);
            assert.equal(current.media, f.w.video);
            assert.equal(current.destroyCalls, 0);
            assert.equal(cancelled.filter((url) => url === oldLease).length, 1);
            assert.equal(cancelled.includes(newLease), false);
            assert.equal(f.w.__ottCorePipCompatibilityUrl, pipLease);
            assert.equal(pip.destroyCalls, 0);
            assert.equal(f.w.videoPip.src, pipSource);
            assert.equal(cancelled.includes(pipLease), false);
            f.w.stbStop();
            assert.equal(cancelled.filter((url) => url === newLease).length, 1);
            assert.equal(current.destroyCalls, 1);
            assert.equal(f.w.__ottCoreCompatibilityUrl, "");
            assert.equal(
                pip.destroyCalls,
                0,
                "main Stop keeps the PiP decoder alive"
            );
            assert.equal(cancelled.includes(pipLease), false);
        }
    );
}

test("shared local guards preserve optional receiver and missing-method behavior", () => {
    const f = fixture(),
        w = f.w;
    assert.equal(w.coreField(null, "mode"), undefined);
    assert.equal(w.coreField({ mode: 0 }, "mode"), 0);
    assert.equal(w.coreCall(null, "blocked", [], 1), undefined);
    assert.equal(w.coreCall({}, "blocked", [], 3), undefined);
    assert.throws(() => w.coreCall({}, "blocked", [], 1));
    let reads = 0;
    const owner = {
        get method() {
            reads++;
            return function (a) {
                return this.value + a;
            };
        },
        value: 7,
    };
    assert.equal(w.coreCall(owner, "method", [5], 3), 12);
    assert.equal(reads, 1);
    delete w.__ottLocalMedia;
    assert.equal(w.coreCompat("source"), false);
    w.cancelCoreCompat("source");
    const calls = [];
    w.__ottLocalMedia = {
        cancelPlayback(url) {
            calls.push([this, url]);
        },
        compatibilityPlayback(url) {
            calls.push([this, url]);
            return true;
        },
    };
    assert.equal(w.coreCompat("source"), true);
    w.cancelCoreCompat("source");
    assert.equal(calls.length, 2);
    assert(
        calls.every(
            ([receiver, url]) =>
                receiver === w.__ottLocalMedia && url === "source"
        )
    );
});

// Actual native transport + core + Auto watcher. No network or real timers.
async function relayRecovery(mode = 3, options = {}) {
    const calls = [];
    const f = fixture({
        ...options,
        globals: {
            __TAURI__: {
                core: {
                    invoke(command, args) {
                        calls.push({ args, command });
                        return Promise.resolve(
                            command === "native_hls_start"
                                ? {
                                      session: "relay-a",
                                      url: "http://127.0.0.1:12345/relay/index.m3u8",
                                  }
                                : { bytes: 0, samples: 0, seconds: 0 }
                        );
                    },
                },
            },
        },
        savedPlayerMode: mode,
    });
    const url = "https://source.invalid/recover.m3u8";
    f.w.video.getVideoPlaybackQuality = () => ({
        droppedVideoFrames: 0,
        totalVideoFrames: 0,
    });
    f.w.video.buffered = { length: 0 };
    f.w.stbPlay(url);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.w.video.src, "http://127.0.0.1:12345/relay/index.m3u8");
    f.calls = calls;
    f.url = url;
    return f;
}
function relayError(f) {
    const oldWatcher = f.w._coreAutoCancel;
    const session = f.w._playSession;
    f.w.video.error = { code: 4 };
    f.w.video.emit("error");
    assert.equal(
        f.w.video.src,
        f.url,
        "relay error first retries the original URL"
    );
    assert.equal(
        f.w.video.error,
        null,
        "changing src clears the old DOM error"
    );
    assert.equal(
        f.w._playSession,
        session,
        "transport retry retains playback ownership"
    );
    if (oldWatcher) {
        assert.notEqual(
            f.w._coreAutoCancel,
            oldWatcher,
            "direct attempt owns a new watcher"
        );
        assert.equal(
            oldWatcher.pending(),
            false,
            "old Auto watcher was cancelled during dispatch"
        );
    }
    assert.equal(
        f.calls.filter((x) => x.command === "native_hls_stop").length,
        1
    );
    assert.equal(
        f.w._coreAutoHlsUsed,
        false,
        "old relay error does not force the new direct attempt"
    );
    f.advance(0);
    assert.equal(f.players.length, 0);
}
function bufferedNoFrame(f) {
    const media = f.w.video;
    media.readyState = 2;
    media.videoWidth = 1920;
    media.videoHeight = 1080;
    media.videoTracks = [{}];
    media.audioTracks = [{}];
    media.buffered = { end: () => 12, length: 1, start: () => 0 };
    media.getVideoPlaybackQuality = () => ({
        droppedVideoFrames: 0,
        totalVideoFrames: 0,
    });
    media.emit("loadedmetadata");
}
function seconds(f, count) {
    for (let i = 0; i < count; i++) f.advance(1000);
}

test("Auto relay error rearms a bounded direct buffered no-frame attempt", async () => {
    const f = await relayRecovery();
    relayError(f);
    bufferedNoFrame(f);
    seconds(f, 30);
    assert.equal(
        f.players.length,
        0,
        "30 seconds of continuous evidence are required after first sample"
    );
    seconds(f, 30);
    assert.equal(
        f.players.length,
        1,
        "buffered direct retry cannot remain stuck for 60 seconds"
    );
    assert.equal(f.players[0].media, f.w.video);
    assert.equal(f.players[0].url, f.url);
    assert.equal(f.w._coreAutoHlsUsed, true);
    assert.equal(
        f.calls.filter((x) => x.command === "native_hls_start").length,
        1
    );
    seconds(f, 60);
    assert.equal(f.players.length, 1, "one Auto fallback, not a retry loop");
    f.w.stbStop();
    assert.equal(f.timers.size, 0);
});

test("buffered no-frame recovery preserves explicit HTML5 and normal native startup", async () => {
    for (const mode of [0, 3]) {
        const f = await relayRecovery(mode);
        if (mode === 0) relayError(f);
        bufferedNoFrame(f);
        seconds(f, 60);
        assert.equal(
            f.players.length,
            0,
            mode === 0
                ? "explicit HTML5 remains explicit"
                : "initial relay has no new watchdog"
        );
        f.w.stbStop();
    }
});

test("direct recovery waits for positive video and readable frame evidence", async () => {
    for (const missing of [
        "counter",
        "invalid-counter",
        "video",
        "buffer",
        "metadata",
    ]) {
        const f = await relayRecovery();
        relayError(f);
        bufferedNoFrame(f);
        if (missing === "counter") delete f.w.video.getVideoPlaybackQuality;
        if (missing === "invalid-counter")
            f.w.video.getVideoPlaybackQuality = () => ({
                totalVideoFrames: NaN,
            });
        if (missing === "video") {
            f.w.video.videoTracks = [];
            f.w.video.videoWidth = 0;
        }
        if (missing === "buffer") f.w.video.buffered = { length: 0 };
        if (missing === "metadata") f.w.video.readyState = 1;
        seconds(f, 60);
        assert.equal(f.players.length, 0, missing);
        f.w.stbStop();
    }
});

test("direct recovery resets interrupted observation and cannot mistake paused or hidden video for failure", async () => {
    for (const interruption of [
        "pause",
        "hidden",
        "seeking",
        "underrun",
        "ended",
    ]) {
        const f = await relayRecovery();
        relayError(f);
        bufferedNoFrame(f);
        seconds(f, 20);
        if (interruption === "pause") f.w.stbPause();
        if (interruption === "hidden") {
            f.w.document.visibilityState = "hidden";
            f.w.document.emit("visibilitychange");
        }
        if (interruption === "seeking") {
            f.w.video.seeking = true;
            f.w.video.emit("seeking");
        }
        if (interruption === "underrun") f.w.video.buffered = { length: 0 };
        if (interruption === "ended") f.w.video.ended = true;
        seconds(f, 60);
        assert.equal(f.players.length, 0, interruption);
        if (interruption === "pause") f.w.stbContinue();
        if (interruption === "hidden") {
            f.w.document.visibilityState = "visible";
            f.w.document.emit("visibilitychange");
        }
        if (interruption === "seeking") f.w.video.seeking = false;
        if (interruption === "ended") f.w.video.ended = false;
        f.w.video.buffered = { end: () => 12, length: 1, start: () => 0 };
        seconds(f, 30);
        assert.equal(
            f.players.length,
            0,
            "interrupted time cannot count toward the new window"
        );
        seconds(f, 2);
        assert.equal(
            f.players.length,
            1,
            interruption + " resumed observation can recover"
        );
        f.w.stbStop();
    }
});

test("first direct frame or clock progress permanently completes startup observation", async () => {
    for (const progress of ["frame", "clock"]) {
        const f = await relayRecovery();
        relayError(f);
        bufferedNoFrame(f);
        seconds(f, 20);
        if (progress === "frame")
            f.w.video.getVideoPlaybackQuality = () => ({
                droppedVideoFrames: 0,
                totalVideoFrames: 1,
            });
        else f.w.video.currentTime = 0.04;
        seconds(f, 1);
        // A later no-frame state must not resurrect the completed startup monitor.
        f.w.video.getVideoPlaybackQuality = () => ({
            droppedVideoFrames: 0,
            totalVideoFrames: 0,
        });
        f.w.video.currentTime = 0;
        seconds(f, 60);
        assert.equal(f.players.length, 0, progress);
        f.w.stbStop();
    }
});

test("retired direct owner, standby, explicit mode and replaced src cannot trigger late recovery", async () => {
    for (const retire of [
        "stop",
        "standby",
        "channel",
        "mode",
        "src",
        "handle",
    ]) {
        const f = await relayRecovery();
        relayError(f);
        bufferedNoFrame(f);
        seconds(f, 20);
        if (retire === "stop") f.w.stbStop();
        if (retire === "standby") {
            f.w.document.getElementById = () => null;
            f.w.stbSetStandby(true);
            assert.equal(f.w.stbIsStandby(), true);
        }
        if (retire === "channel") f.w.stbPlay("https://source.invalid/new.mp4");
        if (retire === "mode") f.w.setPlayerMode(0);
        if (retire === "src") f.w.video.src = "https://source.invalid/new.mp4";
        if (retire === "handle") f.w.video = media(true);
        seconds(f, 60);
        assert.equal(f.players.length, 0, retire);
        f.w.stbStop();
    }
});

test("a queued direct recovery checks ownership and current play intent again", async () => {
    for (const retire of [
        "stop",
        "mode",
        "pause",
        "pause-resume",
        "hidden",
        "frame",
        "clock",
        "src",
        "src-error",
        "src-emptied-error",
        "src-gap-error",
        "clock-gap",
    ]) {
        const f = await relayRecovery();
        relayError(f);
        bufferedNoFrame(f);
        const schedule = f.w.setTimeout;
        let intercepted = 0;
        f.w.setTimeout = (callback, delay) =>
            schedule(() => {
                if (delay === 0) {
                    intercepted++;
                    if (retire === "stop") f.w.stbStop();
                    if (retire === "mode") f.w.setPlayerMode(0);
                    if (retire === "pause") f.w.stbPause();
                    if (retire === "pause-resume") {
                        f.w.stbPause();
                        f.w.video.emit("pause");
                        f.w.stbContinue();
                        f.w.video.emit("play");
                    }
                    if (retire === "hidden")
                        f.w.document.visibilityState = "hidden";
                    if (retire === "frame")
                        f.w.video.getVideoPlaybackQuality = () => ({
                            droppedVideoFrames: 0,
                            totalVideoFrames: 1,
                        });
                    if (retire === "clock") f.w.video.currentTime = 0.04;
                    if (retire === "src")
                        f.w.video.src = "https://source.invalid/new.mp4";
                    if (
                        [
                            "src-error",
                            "src-emptied-error",
                            "src-gap-error",
                        ].includes(retire)
                    ) {
                        f.w.video.src = "https://source.invalid/new.mp4";
                        if (retire === "src-emptied-error")
                            f.w.video.emit("emptied");
                        if (retire === "src-gap-error")
                            f.w.Date.now = () => 600000;
                        f.w.video.error = { code: 4 };
                    }
                    if (retire === "clock-gap") f.w.Date.now = () => 600000;
                }
                callback();
            }, delay);
        seconds(f, 32);
        assert.equal(
            intercepted,
            1,
            "test must exercise the queued fallback window"
        );
        assert.equal(f.players.length, 0, retire);
        f.w.stbStop();
    }
});

test("sub-second pause interrupts direct recovery even between sampled states", async () => {
    const f = await relayRecovery();
    relayError(f);
    bufferedNoFrame(f);
    seconds(f, 29);
    f.w.stbPause();
    f.w.video.emit("pause");
    f.w.stbContinue();
    f.w.video.emit("play");
    seconds(f, 3);
    assert.equal(
        f.players.length,
        0,
        "pause/play edges reset continuous evidence"
    );
    seconds(f, 29);
    assert.equal(f.players.length, 1);
    f.w.stbStop();
});

test("direct retry error retains immediate Auto fallback and WebKit zero-frame counters recover", async () => {
    for (const signal of ["error", "webkit-counter"]) {
        const f = await relayRecovery();
        relayError(f);
        bufferedNoFrame(f);
        if (signal === "error") {
            f.w.video.error = { code: 4 };
            f.w.video.emit("error");
            f.advance(0);
        } else {
            delete f.w.video.getVideoPlaybackQuality;
            f.w.video.webkitDecodedFrameCount = 0;
            f.w.video.webkitDroppedFrameCount = 0;
            seconds(f, 32);
        }
        assert.equal(f.players.length, 1, signal);
        seconds(f, 60);
        assert.equal(
            f.players.length,
            1,
            "startup timer cannot add a second fallback"
        );
        f.w.stbStop();
    }
});

test("native error during queued initial recovery is reobserved when its listener resumes", async () => {
    const f = await relayRecovery();
    relayError(f);
    bufferedNoFrame(f);
    const schedule = f.w.setTimeout;
    let queued = 0;
    f.w.setTimeout = (callback, delay) =>
        schedule(() => {
            if (delay === 0 && ++queued === 1) {
                f.w.video.error = { code: 4 };
                f.w.video.emit("error");
            }
            callback();
        }, delay);
    seconds(f, 32);
    assert.equal(
        queued,
        3,
        "initial action, deferred lease error observation, then native Auto fallback"
    );
    assert.equal(
        f.players.length,
        1,
        "the intervening native error is not lost"
    );
    f.w.stbStop();
});

test("unavailable Hls.js support cannot be enabled by direct startup recovery", async () => {
    const f = await relayRecovery(3, { hlsSupported: false });
    relayError(f);
    bufferedNoFrame(f);
    seconds(f, 60);
    assert.equal(f.players.length, 0);
    f.w.stbStop();
});

for (const outcome of ["radio", "error", "timeout"]) {
    test(
        "direct probe retires startup observation after " + outcome,
        async () => {
            const f = await relayRecovery();
            relayError(f);
            const first = probe(f);
            if (outcome === "radio")
                first.emit("tracks", {
                    id: "main",
                    tracks: { audio: { codec: "mp4a.40.2" } },
                });
            if (outcome === "error") first.emit("error", {});
            if (outcome === "timeout") seconds(f, 8);
            f.advance(0);
            assert.equal(first.destroyCalls, 1);
            assert.equal(
                f.players.length,
                1,
                "native outcome creates no HLS player"
            );
            assert.equal(
                f.timers.size,
                1,
                "only the existing frame-drop observer remains after native decision"
            );
            seconds(f, 60);
            assert.equal(
                f.timers.size,
                1,
                "retired startup polling cannot recur"
            );
            assert.equal(f.players.length, 1);
            f.quality = { droppedVideoFrames: 0, totalVideoFrames: 0 };
            f.w.video.getVideoPlaybackQuality = () => f.quality;
            f.w.video.buffered = {
                end: () => f.w.video.currentTime + 30,
                length: 1,
                start: () => 0,
            };
            ready(f.w.video, true);
            advanceFrames(f, 13);
            assert.equal(
                f.players.length,
                2,
                "late severe frame loss still recovers"
            );
            assert.equal(f.players[1].media, f.w.video);
            f.w.stbStop();
            assert.equal(f.timers.size, 0);
        }
    );
}

test("explicit live seek before the first direct sample disables initial recovery", async () => {
    const f = await relayRecovery();
    relayError(f);
    bufferedNoFrame(f);
    f.w.video.duration = Infinity;
    f.w.stbSetPosTime(7);
    assert.equal(
        f.w._coreSeekRevision,
        1,
        "actual core accepted the explicit seek"
    );
    assert.equal(f.w.video.currentTime, 7);
    seconds(f, 65);
    assert.equal(
        f.players.length,
        0,
        "do not replace the requested live timeline with MSE live edge"
    );
    assert.equal(f.w.video.currentTime, 7);
    f.w.stbStop();
    assert.equal(f.timers.size, 0);
});

test("command pause/resume fences the queued direct recovery without early DOM events", async () => {
    const f = await relayRecovery();
    relayError(f);
    bufferedNoFrame(f);
    const schedule = f.w.setTimeout;
    let intercepted = 0;
    f.w.setTimeout = (callback, delay) =>
        schedule(() => {
            if (delay === 0 && ++intercepted === 1) {
                const revision = f.w._corePauseRevision;
                f.w.stbPause();
                f.w.stbResume();
                assert.ok(f.w._corePauseRevision > revision);
                assert.equal(f.w.video.paused, false);
                // Browser pause/play events have not been dispatched yet.
            }
            callback();
        }, delay);
    seconds(f, 32);
    assert.equal(intercepted, 1, "hit the actual deferred decision");
    assert.equal(
        f.players.length,
        0,
        "commands invalidate the already collected evidence"
    );
    seconds(f, 29);
    assert.equal(
        f.players.length,
        0,
        "fresh continuous observation is required"
    );
    seconds(f, 2);
    assert.equal(f.players.length, 1);
    f.w.stbStop();
    assert.equal(f.timers.size, 0);
});

test("command pause/resume between samples resets the direct window without DOM events", async () => {
    const f = await relayRecovery();
    relayError(f);
    bufferedNoFrame(f);
    seconds(f, 29);
    f.w.stbPause();
    f.w.stbResume();
    seconds(f, 3);
    assert.equal(f.players.length, 0);
    seconds(f, 29);
    assert.equal(f.players.length, 1);
    f.w.stbStop();
});

for (const tauri of [true, false]) {
    test(
        "video-evidenced probe restore rearms one bounded zero-frame attempt: " +
            (tauri ? "Tauri" : "webOS"),
        async () => {
            const f = tauri
                ? await relayRecovery()
                : fixture({ device: "lg/webos", tauri: false });
            if (tauri) relayError(f);
            else f.w.stbPlay("https://source.invalid/native.m3u8");
            const first = probe(f);
            ready(f.w.video, true);
            hevc(first);
            f.advance(0);
            assert.equal(first.destroyCalls, 1);
            assert.equal(
                f.players.length,
                1,
                "native video preserved at probe completion"
            );
            assert.equal(
                f.w.video.readyState,
                0,
                "actual restore replaced the native source"
            );
            bufferedNoFrame(f);
            seconds(f, 30);
            assert.equal(
                f.players.length,
                1,
                "new source needs its own full evidence window"
            );
            seconds(f, 2);
            assert.equal(
                f.players.length,
                2,
                "video restore cannot disable recovery forever"
            );
            assert.equal(f.players[1].media, f.w.video);
            seconds(f, 60);
            assert.equal(f.players.length, 2, "one recovery only");
            f.w.stbStop();
            assert.equal(f.timers.size, 0);
        }
    );
}

for (const failed of ["reject", "invalid", "throw"]) {
    test(
        "native transport " +
            failed +
            " rearms direct Auto but preserves explicit HTML5",
        async () => {
            for (const mode of [0, 3]) {
                const calls = [];
                const f = fixture({
                    globals: {
                        __TAURI__: {
                            core: {
                                invoke(command) {
                                    calls.push(command);
                                    if (command !== "native_hls_start")
                                        return Promise.resolve({});
                                    if (failed === "throw")
                                        throw new Error(
                                            "transport startup failed"
                                        );
                                    return failed === "reject"
                                        ? Promise.reject(
                                              new Error("transport unavailable")
                                          )
                                        : Promise.resolve({});
                                },
                            },
                        },
                    },
                    savedPlayerMode: mode,
                });
                f.w.stbPlay("https://source.invalid/transport-failure.m3u8");
                await new Promise((resolve) => setImmediate(resolve));
                assert.equal(
                    f.w.video.src,
                    "https://source.invalid/transport-failure.m3u8"
                );
                assert.equal(
                    calls.filter((x) => x === "native_hls_start").length,
                    1
                );
                bufferedNoFrame(f);
                seconds(f, 30);
                assert.equal(f.players.length, 0);
                seconds(f, 2);
                assert.equal(f.players.length, mode === 3 ? 1 : 0);
                f.w.stbStop();
                assert.equal(f.timers.size, 0);
            }
        }
    );
}

for (const jump of [120000, -5000]) {
    test(
        "actual sample clock jump starts a fresh direct evidence window: " +
            jump,
        async () => {
            const f = await relayRecovery();
            relayError(f);
            bufferedNoFrame(f);
            seconds(f, 20);
            const originalNow = f.w.Date.now;
            f.w.Date.now = () => originalNow() + jump;
            seconds(f, 1); // The jump is observed in the 1-second sampler, not the deferred action.
            assert.equal(f.players.length, 0);
            seconds(f, 29);
            assert.equal(f.players.length, 0);
            seconds(f, 1);
            assert.equal(f.players.length, 1);
            f.w.stbStop();
        }
    );
}

test("rejected seek does not disable the initial direct recovery", async () => {
    const f = await relayRecovery();
    relayError(f);
    bufferedNoFrame(f);
    const revision = f.w._coreSeekRevision;
    f.w.stbSetPosTime(NaN);
    assert.equal(f.w._coreSeekRevision, revision);
    seconds(f, 32);
    assert.equal(f.players.length, 1);
    f.w.stbStop();
});

test("video-evidenced restored source respects progress, pause, seek and ownership", async () => {
    for (const tauri of [true, false])
        for (const action of [
            "frame",
            "clock",
            "pause",
            "seek",
            "stop",
            "source",
        ]) {
            const f = tauri
                ? await relayRecovery()
                : fixture({ device: "lg/webos", tauri: false });
            if (tauri) relayError(f);
            else f.w.stbPlay("https://source.invalid/native.m3u8");
            const first = probe(f);
            ready(f.w.video, true);
            hevc(first);
            f.advance(0);
            bufferedNoFrame(f);
            if (action === "frame")
                f.w.video.getVideoPlaybackQuality = () => ({
                    droppedVideoFrames: 0,
                    totalVideoFrames: 1,
                });
            if (action === "clock") {
                seconds(f, 1);
                f.w.video.currentTime = 0.04;
            }
            if (action === "pause") f.w.stbPause();
            if (action === "seek") f.w.stbSetPosTime(7);
            if (action === "stop") f.w.stbStop();
            if (action === "source")
                f.w.video.src = "https://source.invalid/new.mp4";
            seconds(f, 65);
            assert.equal(
                f.players.length,
                1,
                (tauri ? "Tauri " : "webOS ") + action
            );
            if (!tauri && ["frame", "clock", "seek"].includes(action))
                assert.equal(
                    f.timers.size,
                    0,
                    "completed initial-only sampler retires"
                );
            f.w.stbStop();
            assert.equal(f.timers.size, 0);
        }
});

test("internal native probe restore keeps VOD position without becoming an explicit seek", () => {
    const f = fixture();
    f.w.stbPlay("https://source.invalid/vod.m3u8", 7);
    const first = probe(f);
    ready(f.w.video, true);
    hevc(first);
    f.advance(0);
    bufferedNoFrame(f);
    assert.equal(f.w.video.currentTime, 7);
    assert.equal(
        f.w._coreSeekRevision,
        0,
        "internal restore is startup positioning"
    );
    seconds(f, 32);
    assert.equal(f.players.length, 2);
    assert.equal(f.players[1].config.startPosition, 7);
    f.w.stbStop();
});

test("webOS restored-source progress in the deferred gap retires the initial-only observer", () => {
    const f = fixture({ device: "lg/webos", tauri: false });
    f.w.stbPlay("https://source.invalid/native.m3u8");
    const first = probe(f);
    ready(f.w.video, true);
    hevc(first);
    f.advance(0);
    bufferedNoFrame(f);
    const schedule = f.w.setTimeout;
    let queued = 0;
    f.w.setTimeout = (callback, delay) =>
        schedule(() => {
            if (delay === 0 && ++queued === 1)
                f.w.video.getVideoPlaybackQuality = () => ({
                    droppedVideoFrames: 0,
                    totalVideoFrames: 1,
                });
            callback();
        }, delay);
    seconds(f, 32);
    assert.equal(queued, 1);
    assert.equal(f.players.length, 1);
    assert.equal(
        f.timers.size,
        0,
        "completion must not create a replacement idle sampler"
    );
    f.w.stbStop();
});

async function run() {
    let failures = 0;
    for (const [name, callback] of cases) {
        try {
            await callback();
            console.log("PASS " + name);
        } catch (error) {
            failures++;
            console.error("FAIL " + name + "\n" + error.stack);
        }
    }
    if (failures) process.exitCode = 1;
}
run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
