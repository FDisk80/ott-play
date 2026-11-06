// Real feedback and real stbInit listeners; only time/media/host effects are fake.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { JSDOM } = require("jsdom");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const DISPLAY_DELAY = 500;
const STALL_LIMIT = 45000;
const metadata = "1920 × 1080 / H.264";
const core = ts.createSourceFile(
    "src/core/index.ts",
    fs.readFileSync(path.join(root, "src/core/index.ts"), "utf8"),
    ts.ScriptTarget.Latest,
    true
);

function coreFunctions(names) {
    return ts.transpileModule(
        [...new Set([...names, "coreField", "coreCall"])]
            .map((name) => {
                const matches = core.statements.filter(
                    (node) =>
                        ts.isFunctionDeclaration(node) &&
                        node.name.text === name
                );
                assert.equal(matches.length, 1, "actual core function " + name);
                return matches[0].getText(core).replace(/^export /, "");
            })
            .join("\n"),
        { compilerOptions: { target: ts.ScriptTarget.ES5 } }
    ).outputText;
}

function fixture(mode, withFeedback = true) {
    const dom = new JSDOM(
        "<style>#buffering,#pip_buffering{display:none}</style>" +
            '<body><div id="launch"></div><div id="buffering"></div>' +
            '<div id="video_res"></div><div id="pip_buffering"></div>' +
            '<div id="vdiv"><video id="video"></video></div>' +
            '<video id="videopip" style="display:none"></video></body>',
        { runScripts: "outside-only" }
    );
    const w = dom.window;
    if (mode === "stbInit")
        w.eval(
            fs.readFileSync(path.join(root, "js/jquery-1.11.1.min.js"), "utf8")
        );
    let now = 0,
        nextTimer = 0,
        asleep = false;
    const timers = new Map();
    const errors = [];
    const calls = { directShows: 0, info: 0, preferences: [], stops: 0 };
    function schedule(fn, delay, interval) {
        assert.equal(typeof fn, "function");
        assert.ok(Number.isFinite(delay) && delay >= 0);
        const id = ++nextTimer;
        timers.set(id, { at: now + delay, fn, interval });
        return id;
    }
    w.Date.now = () => now;
    w.setTimeout = (fn, delay = 0) => schedule(fn, delay, 0);
    w.setInterval = (fn, delay) => {
        assert.ok(delay > 0);
        return schedule(fn, delay, delay);
    };
    w.clearTimeout = w.clearInterval = (id) => timers.delete(id);
    function advance(ms) {
        const target = now + ms;
        let dispatched = 0;
        for (;;) {
            const next = [...timers]
                .filter(([, timer]) => timer.at <= target)
                .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
            if (!next) break;
            assert.ok(++dispatched < 10000, "bounded fake-clock dispatch");
            const [id, timer] = next;
            now = timer.at;
            if (timer.interval) timer.at += timer.interval;
            else timers.delete(id);
            timer.fn();
        }
        now = target;
    }
    function media(node, url) {
        const state = {
            currentSrc: url,
            currentTime: 0,
            ended: false,
            paused: false,
            playbackRate: 1,
            readyState: 4,
            seeking: false,
        };
        node.src = url;
        for (const name of Object.keys(state))
            Object.defineProperty(node, name, {
                configurable: true,
                get: () => state[name],
                set: (value) => {
                    state[name] = value;
                },
            });
        node.pause = () => {
            state.paused = true;
            node.dispatchEvent(new w.Event("pause"));
        };
        node.load = () => {};
        return node;
    }
    media(w.document.getElementById("video"), "https://example.test/one.mp4");
    w._ = (value) => value;
    w.forcePlay = true;
    w.console.error = w.console.warn = (error) => errors.push(String(error));
    w.console.log = () => {};
    // Any unintended transport access fails; no media engine is started here.
    w.fetch =
        w.XMLHttpRequest =
        w.WebSocket =
            () => {
                throw new Error(
                    "unexpected network access in buffering fixture"
                );
            };
    if (withFeedback)
        w.eval(
            ts.transpileModule(
                fs.readFileSync(
                    path.join(root, "src/core/playback-feedback.ts"),
                    "utf8"
                ),
                { compilerOptions: { target: ts.ScriptTarget.ES5 } }
            ).outputText
        );
    const api = w.__ottPlaybackFeedback;
    if (mode === "stbInit") {
        const show = w.$.fn.show;
        w.$.fn.show = function (...args) {
            if (this[0]?.id === "buffering") calls.directShows++;
            return show.apply(this, args);
        };
        Object.assign(w, {
            __ottStandby: {
                blocked: () => asleep,
                failed: () => errors.push("standby cleanup failed"),
                isStandby: () => asleep,
                set(value, resume) {
                    asleep = value;
                    if (!value && resume) resume();
                },
            },
            _coreHlsBitrate: null,
            _coreShakaTeardown: null,
            _coreTransientPlayback: false,
            _playSession: 0,
            _standby: false,
            applyChannelPreference: (name) => calls.preferences.push(name),
            coreDeviceEffects: {},
            coreNativeAttached: false,
            coreStreamAttempt: null,
            // The already-admitted backend delegates Stop to the real core teardown.
            // Engine destruction, media I/O and unrelated host effects stay inert.
            getCoreMediaBackend: () => ({
                stop() {
                    calls.stops++;
                    w.stopCoreEngine();
                },
            }),
            hlsInstance: null,
            initialHlsBufferPolicy: null,
            isFullscreen: false,
            requestAnimationFrame: (fn) => fn(),
            setSubtitleTrack: (_index, audio) =>
                calls.preferences.push(audio ? "aAudios" : "aSubs"),
            updateCoreVideoInfo: () => calls.info++,
            video: w.document.getElementById("video"),
            videoPip: null,
        });
        for (const name of [
            "applyAspectRatio",
            "applyZoom",
            "installTauriFsKeyCapture",
            "closeList",
            "resetCoreNativeBitrate",
            "setAspect",
            "setAudioTrack",
            "setSleepTimeout",
            "setZoom",
            "showViewportSizeIndicator",
            "stbBindKeyHandler",
            "stbStopPip",
            "stbToFullScreen",
            "videoEvent",
            "releaseCoreCompanion",
            "cancelCoreCompat",
            "cancelCoreStreamAttempt",
            "cancelCoreSourcePreparation",
            "cancelCoreSeek",
            "cancelCoreAutoPlayback",
            "cancelCoreNativeHls",
            "setCoreDemoMute",
            "destroyCoreShaka",
            "clearPlayTimeInterval",
        ])
            w[name] = () => {};
        w.eval(
            coreFunctions([
                "stbInit",
                "stbSetStandby",
                "stbIsStandby",
                "stbStop",
                "stopCorePlayback",
                "stopCoreEngine",
            ])
        );
        w.startPlayer = () => w.stbInit();
        w.stbInit();
    } else api.bind(w.document.getElementById("video"));
    function current() {
        return w.document.getElementById("video");
    }
    function event(name, node = current()) {
        node.dispatchEvent(new w.Event(name));
    }
    function busy(id = "buffering") {
        return (
            w.getComputedStyle(w.document.getElementById(id)).display !== "none"
        );
    }
    function text() {
        return w.document.getElementById("video_res").textContent;
    }
    function healthy() {
        w.forcePlay = true;
        current().paused = false;
        current().ended = false;
        api.begin();
        event("loadstart");
        advance(1000);
        current().currentTime += 1;
        event("timeupdate");
        assert.equal(
            api.visible(),
            false,
            "fixture established actual progress"
        );
        assert.equal(busy(), false);
        w.document.getElementById("video_res").textContent = metadata;
    }
    return {
        advance,
        api,
        busy,
        calls,
        close() {
            try {
                assert.deepEqual(
                    errors,
                    [],
                    "no swallowed fixture/initializer errors"
                );
            } finally {
                dom.window.close();
            }
        },
        current,
        dom,
        errors,
        event,
        healthy,
        // Exercise only the new presentation ticket. Manually firing a cancelled
        // long-lived failure timeout would invent a different timer contract.
        presentationCallbacks: () =>
            [...timers.values()]
                .filter(
                    (timer) =>
                        !timer.interval && timer.at <= now + DISPLAY_DELAY
                )
                .map((timer) => timer.fn),
        replace() {
            const old = current();
            const next = media(
                w.document.createElement("video"),
                "https://example.test/two.mp4"
            );
            next.id = "video";
            old.replaceWith(next);
            if (mode === "stbInit") w.stbInit();
            else api.bind(next);
            return old;
        },
        text,
        timeouts: () => [...timers.values()].filter((timer) => !timer.interval),
        w,
    };
}

for (const mode of ["feedback", "stbInit"]) {
    test(`1057 ${mode}: transient waiting and stalled preserve presentation until real progress`, () => {
        const f = fixture(mode);
        try {
            f.healthy();
            for (const name of ["waiting", "stalled", "waiting", "stalled"]) {
                f.advance(4900);
                f.current().currentTime += 4.9;
                f.event("timeupdate");
                f.w.document.getElementById("video_res").textContent = metadata;
                const directShows = f.calls.directShows;
                f.event(name);
                assert.equal(
                    f.busy(),
                    false,
                    name + " must not flash immediately"
                );
                assert.equal(
                    f.text(),
                    metadata,
                    name + " must not replace metadata immediately"
                );
                assert.equal(
                    f.api.visible(),
                    true,
                    "logical deadline remains active"
                );
                assert.equal(
                    f.calls.directShows,
                    directShows,
                    "owned core listener must not bypass feedback"
                );
                f.advance(99);
                assert.equal(f.busy(), false, "no intermediate spinner");
                assert.equal(
                    f.text(),
                    metadata,
                    "no intermediate Buffering label"
                );
                f.advance(1);
                f.current().currentTime += 0.1;
                f.event("timeupdate");
                assert.equal(
                    f.text(),
                    metadata,
                    "healthy cancellation keeps metadata intact"
                );
                f.advance(DISPLAY_DELAY);
                assert.equal(
                    f.busy(),
                    false,
                    "cancelled presentation cannot return"
                );
                assert.doesNotMatch(f.text(), /Buffering|Connecting|ERROR/);
                assert.equal(f.api.visible(), false);
                assert.equal(f.timeouts().length, 0);
            }
        } finally {
            f.close();
        }
    });

    test(`1057 ${mode}: presentation boundary observes progress without a timeupdate event`, () => {
        const f = fixture(mode);
        try {
            f.healthy();
            f.event("stalled");
            f.advance(DISPLAY_DELAY - 1);
            assert.equal(f.busy(), false);
            assert.equal(f.text(), metadata);
            f.current().currentTime += 0.4;
            f.advance(1);
            assert.equal(f.busy(), false);
            assert.doesNotMatch(f.text(), /Buffering|ERROR/);
            assert.equal(
                f.api.visible(),
                false,
                "real movement cancels the original deadline too"
            );
            assert.equal(f.timeouts().length, 0);
        } finally {
            f.close();
        }
    });

    test(`1057 ${mode}: real stall survives native playing and expires at the first event deadline`, () => {
        const f = fixture(mode);
        try {
            f.healthy();
            f.event("waiting");
            f.advance(200);
            f.event("stalled");
            f.advance(DISPLAY_DELAY - 201);
            f.event("waiting");
            assert.equal(
                f.busy(),
                false,
                "repeats neither show early nor renew grace"
            );
            assert.equal(f.text(), metadata);
            f.advance(1);
            assert.equal(
                f.busy(),
                true,
                "a sustained stall is visible at 500 ms"
            );
            assert.equal(f.text(), "Buffering...");
            for (const name of ["playing", "canplay", "timeupdate"]) {
                f.event(name);
                assert.equal(
                    f.busy(),
                    true,
                    name + " without movement cannot hide a stall"
                );
                assert.equal(f.text(), "Buffering...");
            }
            if (mode === "stbInit")
                assert.deepEqual(f.calls.preferences, [
                    "aAspects",
                    "aZooms",
                    "aSubs",
                    "aAudios",
                ]);
            f.advance(STALL_LIMIT - DISPLAY_DELAY - 1);
            assert.equal(f.busy(), true);
            f.advance(1);
            assert.equal(f.busy(), false);
            assert.equal(f.text(), "ERROR!");
            assert.match(
                f.w.document.getElementById("video_res").title,
                /timed out/
            );
            assert.equal(f.timeouts().length, 0);
            f.advance(1000);
            f.current().currentTime += 1;
            f.event("timeupdate");
            assert.equal(
                f.api.visible(),
                false,
                "real late progress still recovers"
            );
            assert.doesNotMatch(f.text(), /ERROR|Buffering/);
        } finally {
            f.close();
        }
    });

    test(`1057 ${mode}: startup preparation retry and failure remain immediate`, () => {
        const f = fixture(mode);
        try {
            f.api.begin();
            assert.equal(f.busy(), true);
            assert.equal(f.text(), "Connecting...");
            f.event("loadstart");
            f.event("stalled");
            assert.equal(
                f.busy(),
                true,
                "startup has no progress-qualified grace"
            );
            f.api.prepare();
            f.event("waiting");
            assert.equal(f.text(), "Connecting...");
            assert.equal(f.busy(), true);
            f.api.fail("network");
            assert.equal(f.busy(), false);
            assert.equal(f.text(), "ERROR!");
            f.healthy();
            f.event("waiting");
            assert.equal(f.busy(), false);
            f.advance(100);
            f.api.retry();
            assert.equal(f.busy(), true);
            assert.equal(f.text(), "Retrying...");
            f.advance(STALL_LIMIT - 101);
            assert.equal(f.busy(), true);
            f.advance(1);
            assert.equal(
                f.text(),
                "ERROR!",
                "retry does not replace the first stall deadline"
            );
            assert.equal(f.busy(), false);
        } finally {
            f.close();
        }
    });

    test(`1057 ${mode}: pause stop and end retire delayed and already-queued callbacks`, () => {
        for (const action of ["pause", "stop", "ended"]) {
            const f = fixture(mode);
            try {
                f.healthy();
                f.event("waiting");
                const retired = f.presentationCallbacks();
                if (action === "pause") {
                    f.w.forcePlay = false;
                    f.current().paused = true;
                    f.event("pause");
                } else if (action === "ended") {
                    f.current().ended = true;
                    f.event("ended");
                } else f.api.stop();
                for (const callback of retired) callback();
                for (const name of [
                    "waiting",
                    "loadstart",
                    "playing",
                    "canplay",
                ])
                    f.event(name);
                f.advance(STALL_LIMIT + DISPLAY_DELAY);
                assert.equal(f.api.inactive(), true, action);
                assert.equal(f.busy(), false, action + " stays hidden");
                assert.doesNotMatch(f.text(), /Buffering|Connecting|ERROR/);
                assert.equal(f.timeouts().length, 0);
            } finally {
                f.close();
            }
        }
    });

    test(`1057 ${mode}: seek retires grace without treating the position jump as progress`, () => {
        const f = fixture(mode);
        try {
            f.healthy();
            f.event("waiting");
            const retired = f.presentationCallbacks();
            f.advance(100);
            f.current().seeking = true;
            f.event("seeking");
            assert.equal(
                f.busy(),
                true,
                "seek invalidates the progress proof, not the original deadline"
            );
            f.current().currentTime = 200;
            f.event("timeupdate");
            f.current().seeking = false;
            f.event("seeked");
            for (const callback of retired) callback();
            f.advance(DISPLAY_DELAY - 100);
            assert.equal(
                f.busy(),
                true,
                "retired grace cannot clear the actual wait"
            );
            f.event("waiting");
            assert.equal(
                f.busy(),
                true,
                "no new grace before post-seek progress"
            );
            f.advance(1000);
            f.current().currentTime += 1;
            f.event("timeupdate");
            assert.equal(f.busy(), false);
            assert.equal(f.api.visible(), false);
        } finally {
            f.close();
        }
    });

    test(`1057 ${mode}: new source begin cannot inherit delayed callbacks or progress proof`, () => {
        const f = fixture(mode);
        try {
            f.healthy();
            f.event("waiting");
            const retired = f.presentationCallbacks();
            f.advance(100);
            f.current().src = f.current().currentSrc =
                "https://example.test/replacement.mp4";
            f.current().currentTime = 0;
            f.api.begin();
            f.event("loadstart");
            for (const callback of retired) callback();
            assert.equal(f.busy(), true);
            assert.equal(f.text(), "Connecting...");
            f.advance(DISPLAY_DELAY);
            assert.equal(f.text(), "Connecting...");
            f.current().currentTime = 0.5;
            f.event("timeupdate");
            assert.equal(f.api.visible(), false);
            f.event("stalled");
            assert.equal(
                f.busy(),
                false,
                "replacement qualifies only after its own progress"
            );
        } finally {
            f.close();
        }
    });

    test(`1057 ${mode}: retired media events cannot control the replacement surface`, () => {
        const f = fixture(mode);
        try {
            f.healthy();
            f.event("waiting");
            const retired = f.presentationCallbacks();
            const old = f.replace();
            f.api.begin();
            f.event("loadstart");
            for (const callback of retired) callback();
            for (const name of [
                "waiting",
                "loadstart",
                "playing",
                "canplay",
                "timeupdate",
            ])
                f.event(name, old);
            assert.equal(f.busy(), true);
            assert.equal(f.text(), "Connecting...");
            f.advance(1000);
            f.current().currentTime = 1;
            f.event("timeupdate");
            assert.equal(f.api.visible(), false);
            f.event("waiting");
            assert.equal(f.busy(), false);
            f.event("waiting", old);
            f.event("loadstart", old);
            assert.equal(
                f.busy(),
                false,
                "retired core listener is not a legacy fallback"
            );
        } finally {
            f.close();
        }
    });

    test(`1057 ${mode}: recovery overlay release cannot reveal an unconfirmed stall`, () => {
        const f = fixture(mode);
        try {
            f.healthy();
            f.event("waiting");
            f.advance(100);
            f.api.setRecoveryOverlay(true);
            f.api.setRecoveryOverlay(false);
            assert.equal(f.busy(), false);
            assert.doesNotMatch(f.text(), /Buffering|Connecting|ERROR/);
            f.advance(DISPLAY_DELAY - 100);
            assert.equal(f.busy(), true);
            assert.equal(f.text(), "Buffering...");
            f.api.setRecoveryOverlay(true);
            assert.equal(f.busy(), false);
            f.api.setRecoveryOverlay(false);
            assert.equal(f.busy(), true, "confirmed stall is restored");
            f.advance(STALL_LIMIT - DISPLAY_DELAY);
            assert.equal(
                f.text(),
                "ERROR!",
                "overlay never extends the upstream deadline"
            );
        } finally {
            f.close();
        }
    });

    test(`1057 ${mode}: an unannounced source change cannot borrow old progress`, () => {
        const f = fixture(mode);
        try {
            f.healthy();
            f.event("waiting");
            f.advance(100);
            f.current().src = f.current().currentSrc =
                "https://example.test/other.mp4";
            f.current().currentTime = 0;
            f.advance(DISPLAY_DELAY - 100);
            assert.equal(
                f.busy(),
                false,
                "old source's delayed callback has no authority"
            );
            f.event("waiting");
            assert.equal(
                f.busy(),
                true,
                "new source has no confirmed progress to earn grace"
            );
            f.event("timeupdate");
            assert.equal(
                f.busy(),
                true,
                "new source sample alone is not progress"
            );
            f.advance(1000);
            f.current().currentTime = 1;
            f.event("timeupdate");
            assert.equal(f.busy(), false);
            f.event("waiting");
            assert.equal(
                f.busy(),
                false,
                "new source's own progress can earn grace"
            );
        } finally {
            f.close();
        }
    });
}

test("1057 stbInit: repeated initialization preserves one delayed decision", () => {
    const f = fixture("stbInit");
    try {
        f.w.stbInit();
        f.w.stbInit();
        f.healthy();
        f.event("waiting");
        assert.equal(f.busy(), false);
        assert.equal(
            f.timeouts().length,
            2,
            "one original deadline and one presentation decision"
        );
        f.advance(DISPLAY_DELAY);
        assert.equal(f.busy(), true);
        f.advance(STALL_LIMIT - DISPLAY_DELAY);
        assert.equal(f.text(), "ERROR!");
        assert.equal(f.timeouts().length, 0);
    } finally {
        f.close();
    }
});

test("1057 stbInit: absent and unbound feedback retain the current media legacy fallback", () => {
    for (const withFeedback of [false, true]) {
        const f = fixture("stbInit", withFeedback);
        try {
            if (withFeedback) {
                f.api.bind(f.w.document.createElement("video"));
                f.api.begin();
            }
            f.event("waiting");
            assert.equal(f.busy(), true);
            assert.equal(f.text(), "Connecting...");
            f.event("playing");
            assert.equal(f.busy(), false);
            f.event("loadstart");
            assert.equal(f.busy(), true);
            assert.equal(f.text(), "Loading...");
            f.event("canplay");
            assert.equal(f.busy(), false);
            assert.deepEqual(f.calls.preferences, [
                "aAspects",
                "aZooms",
                "aSubs",
                "aAudios",
            ]);
        } finally {
            f.close();
        }
    }
});

test("1057 stbInit: standby uses actual core teardown before late media callbacks", () => {
    const f = fixture("stbInit");
    try {
        f.healthy();
        f.event("waiting");
        const retired = f.presentationCallbacks();
        f.w.stbSetStandby(true);
        assert.equal(f.calls.stops, 1);
        assert.equal(f.api.inactive(), true);
        for (const callback of retired) callback();
        for (const name of ["waiting", "loadstart", "playing", "canplay"])
            f.event(name);
        f.advance(STALL_LIMIT + DISPLAY_DELAY);
        assert.equal(f.busy(), false);
        assert.doesNotMatch(f.text(), /Buffering|Connecting|ERROR/);
        assert.equal(f.timeouts().length, 0);
        f.w.stbSetStandby(false);
        f.healthy();
        f.event("waiting");
        assert.equal(
            f.busy(),
            false,
            "fresh post-wake progress has its own grace"
        );
    } finally {
        f.close();
    }
});

test("1057 stbInit: PiP indicators remain independent of main feedback ownership", () => {
    const f = fixture("stbInit");
    try {
        f.healthy();
        f.event("waiting");
        const pip = f.w.document.getElementById("videopip");
        pip.style.display = "block";
        f.event("loadstart", pip);
        assert.equal(f.busy("pip_buffering"), true);
        assert.equal(f.busy(), false);
        f.event("playing", pip);
        assert.equal(f.busy("pip_buffering"), false);
        assert.equal(f.busy(), false);
        f.advance(DISPLAY_DELAY);
        assert.equal(
            f.busy(),
            true,
            "PiP cannot acknowledge a main-source stall"
        );
    } finally {
        f.close();
    }
});
