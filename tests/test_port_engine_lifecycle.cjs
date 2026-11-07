const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const ActualHls = require("hls.js");
const root = path.resolve(__dirname, "..");
const source = [
    "src/core/standby.ts",
    "src/plugins/access-media.ts",
    "src/core/buffer-policy.ts",
    "src/core/native-hls.ts",
    "src/playback/stream-policy.ts",
    "src/core/index.ts",
    "src/core/shaka-tracks.ts",
]
    .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
    .join("\n");
const core = ts
    .transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.ES2015,
            target: ts.ScriptTarget.ES5,
        },
    })
    .outputText.replace(/^import .*\n/gm, "")
    .replace(/^export /gm, "");
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
    });
    promise.catch(() => {});
    return { promise, reject, resolve };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
function media() {
    const listeners = {};
    let src = "",
        time = 0;
    return {
        addEventListener(name, cb) {
            (listeners[name] ||= []).push(cb);
        },
        canPlayType() {
            return "probably";
        },
        get currentSrc() {
            return this.selectedResource;
        },
        get currentTime() {
            return time;
        },
        set currentTime(value) {
            this.seekWrites.push(value);
            if (this.blockEarlySeek && this.readyState === 0)
                throw new Error("InvalidStateError");
            time = value;
        },
        getAttribute(name) {
            return name === "src" ? src || null : null;
        },
        listeners,
        load() {
            this.loadCalls++;
            this.selectedResource = src;
            this.networkState = src ? 2 : 0;
        },
        loadCalls: 0,
        metadata() {
            this.readyState = 1;
            for (const cb of [...(listeners.loadedmetadata || [])]) cb();
        },
        networkState: 0,
        pause() {
            this.paused = true;
        },
        paused: true,
        play() {
            this.playCalls++;
            this.paused = false;
        },
        playCalls: 0,
        readyState: 0,
        removeAttribute(name) {
            if (name === "src") src = "";
        },
        removeEventListener(name, cb) {
            listeners[name] = (listeners[name] || []).filter((x) => x !== cb);
        },
        seekWrites: [],
        selectedResource: "",
        get src() {
            return src;
        },
        set src(value) {
            src = value;
            this.selectedResource = value;
            this.networkState = value ? 2 : 0;
            time = 0;
            this.readyState = 0;
        },
    };
}
function fixture() {
    const styles = {};
    const players = [],
        shakas = [],
        errors = [],
        boxes = [],
        hidden = [];
    function Hls(config) {
        this.config = config;
        this.hasEnoughToStart = false;
        this.events = {};
        this.levels = [];
        this.audioTracks = [{ name: "A" }];
        this.subtitleTracks = [];
        this.audioTrack = 0;
        this.destroyCalls = 0;
        this.startLoads = [];
        players.push(this);
    }
    Hls.Events = {
        AUDIO_TRACKS_UPDATED: "audio",
        ERROR: "error",
        MANIFEST_PARSED: "manifest",
        SUBTITLE_TRACKS_UPDATED: "subtitles",
    };
    Hls.ErrorTypes = { MEDIA_ERROR: "media", NETWORK_ERROR: "network" };
    Hls.isSupported = () => true;
    Hls.prototype.on = function (name, cb) {
        this.events[name] = cb;
    };
    Hls.prototype.loadSource = function (url) {
        this.url = url;
    };
    Hls.prototype.attachMedia = function (m) {
        this.media = m;
    };
    Hls.prototype.destroy = function () {
        this.destroyCalls++;
        if (this.media) this.media.src = "";
    };
    Hls.prototype.recoverMediaError = function () {};
    Hls.prototype.removeLevel = function (i) {
        this.removed = i;
    };
    Hls.prototype.startLoad = function (position) {
        this.startLoads.push(position);
        this.activeStartPosition = position;
    };
    function Shaka(m) {
        this.media = m;
        this.attached = deferred();
        this.loaded = deferred();
        this.destroyed = deferred();
        this.destroyCalls = 0;
        shakas.push(this);
    }
    Shaka.isBrowserSupported = () => true;
    Shaka.prototype.configure = function (config) {
        this.config = config;
    };
    Shaka.prototype.addEventListener = function (type, callback) {
        this.events ||= {};
        this.events[type] = callback;
    };
    Shaka.prototype.attach = function (media) {
        this.media = media;
        return this.attached.promise;
    };
    Shaka.prototype.getMediaElement = function () {
        return this.media;
    };
    Shaka.prototype.load = function (url, position) {
        this.url = url;
        this.position = position;
        return this.loaded.promise;
    };
    Shaka.prototype.destroy = function () {
        this.destroyCalls++;
        return this.destroyed.promise.then(() => {
            if (this.media) {
                this.media.removeAttribute("src");
                this.media.load();
                this.media = null;
            }
        });
    };
    const w = {
        _: (s) => s,
        $: (selector) => ({
            css(values) {
                Object.assign((styles[selector] ||= {}), values);
            },
            hide() {
                hidden.push(selector);
            },
            html() {},
            show() {},
        }),
        applyChannelPreference() {},
        clearInterval,
        clearTimeout,
        console: {
            error(...args) {
                errors.push(args);
            },
            log() {},
            warn() {},
        },
        document: { body: { style: {} } },
        Hls,
        innerHeight: 720,
        innerWidth: 1280,
        Map: undefined,
        // Mode A must still run without the ES2015 Promise constructor.
        Promise: undefined,
        Set: undefined,
        saveChannelPreference() {},
        setInterval,
        setTimeout,
        shaka: { Player: Shaka },
        showSelectBox(...args) {
            boxes.push(args);
        },
        showShift() {},
    };
    w.window = w;
    vm.createContext(w);
    require("./helpers/shared-core-runtime.cjs")(w);
    vm.runInContext(core, w);
    w.video = media();
    w.videoPip = media();
    return { boxes, errors, hidden, players, shakas, styles, w };
}
function useActualHlsRecovery(hls) {
    hls._media = hls.media;
    hls.started = true;
    hls.logger = { log() {} };
    hls.config.autoStartLoad = true;
    hls.detachMedia = function () {
        this.media.readyState = 0;
        this.hasEnoughToStart = false;
        this._media = null;
    };
    hls.attachMedia = function (media) {
        this._media = this.media = media;
    };
    hls.recoverMediaError = function () {
        ActualHls.prototype.recoverMediaError.call(this);
    };
}
const cases = [];
function test(name, fn) {
    cases.push([name, fn]);
}
test("asynchronous Shaka teardown stays pending through standby and reports failure", async () => {
    for (const fail of [false, true]) {
        const { w, shakas } = fixture();
        w.Promise = Promise;
        w.document.getElementById = () => null;
        w.installStandby(
            w,
            () => "0",
            () => {}
        );
        w.playerMode = 2;
        w.stbPlay("movie.mpd");
        shakas[0].attached.resolve();
        await tick();
        shakas[0].loaded.resolve();
        await tick();
        w.stbSetStandby(true);
        assert.equal(w.__ottStandby.snapshot().state, "suspending");
        assert.equal(w.__ottStandby.snapshot().pending, 1);
        if (fail)
            shakas[0].destroyed.reject(new Error("Decoder teardown failed"));
        else shakas[0].destroyed.resolve();
        await tick();
        assert.equal(w.__ottStandby.snapshot().pending, 0);
        assert.equal(
            w.__ottStandby.snapshot().state,
            fail ? "error" : "suspended"
        );
    }
});
for (const mode of [0, 1, 2]) {
    test(
        "screen suspension destroys the active transport: engine " + mode,
        async () => {
            const { w, players, shakas } = fixture();
            w.playerMode = mode;
            w.__ottNativeRuntime = true;
            w.stbPlay("camera.m3u8");
            if (mode === 1) players[0].events.manifest();
            if (mode === 2) {
                shakas[0].attached.resolve();
                await tick();
                shakas[0].loaded.resolve();
                await tick();
            }
            const handle = w.__ottCoreBackend().current();
            const before = w.video.loadCalls;
            handle.suspend();
            assert.equal(w.video.paused, true);
            assert.equal(w.video.src, "");
            assert.equal(
                w.video.selectedResource,
                "",
                "native resource is unloaded"
            );
            assert.equal(w.video.loadCalls, before + (mode === 2 ? 0 : 1));
            assert.equal(handle.snapshot().phase, "paused");
            if (mode === 1) assert.equal(players[0].destroyCalls, 1);
            if (mode === 2) assert.equal(shakas[0].destroyCalls, 1);
            const plays = w.video.playCalls;
            if (mode === 1) players[0].events.manifest();
            assert.equal(
                w.video.playCalls,
                plays,
                "late startup cannot revive the transport"
            );
            handle.suspend();
            assert.equal(
                w.video.loadCalls,
                before + (mode === 2 ? 0 : 1),
                "repeated sleep does not reset an owned Shaka resource or unload twice"
            );
            if (mode === 2) {
                shakas[0].destroyed.resolve();
                await tick();
                assert.equal(
                    w.video.loadCalls,
                    before + 1,
                    "Shaka owns its settled release reset"
                );
            }
        }
    );
}
test("standby cancels preview and Plex work and releases both media lanes", () => {
    for (const mode of [0, 1]) {
        const { w, players } = fixture();
        const cleared = [];
        w.clearTimeout = (timer) => cleared.push(timer);
        w.document.getElementById = () => null;
        w.playerMode = mode;
        w.stbPlay("main.m3u8");
        w.stbPlayPip("pip.m3u8");
        const main = w.__ottCoreBackend().current();
        const pip = w.__ottCoreBackend().current("pip");
        const timer = {};
        w.previewTimer = timer;
        w.previewChan = { ch_id: "preview" };
        w.pipIndex = 3;
        let restored = 0;
        w.closeList = (restorePip = true) => {
            if (restorePip || w.previewChan || w.pipIndex !== null) restored++;
        };
        let cancelled = 0;
        w.__ottPlexQueue = {
            stop() {
                assert.equal(w.stbIsStandby(), true);
                cancelled++;
            },
        };
        w.stbToggleStandby();
        assert.equal(w.stbIsStandby(), true);
        assert.equal(cancelled, 1);
        assert.equal(
            restored,
            0,
            "closing the overlay cannot restart a stream"
        );
        assert.ok(cleared.includes(timer), "preview timer is retired");
        assert.equal(main.active(), false);
        assert.equal(pip.active(), false);
        for (const video of [w.video, w.videoPip]) {
            assert.equal(video.paused, true);
            assert.equal(video.src, "");
            assert.equal(video.selectedResource, "");
            assert.ok(
                video.loadCalls > 0,
                "native resource selection is reset"
            );
        }
        for (const player of players) {
            assert.equal(player.destroyCalls, 1);
            player.events.manifest();
        }
        assert.equal(
            w.video.paused,
            true,
            "late HLS callbacks cannot resume main"
        );
        assert.equal(
            w.videoPip.paused,
            true,
            "late HLS callbacks cannot resume PiP"
        );
        let starts = 0;
        w.startPlayer = () => starts++;
        w.stbToggleStandby();
        assert.equal(starts, 1);
        assert.equal(w.stbIsStandby(), false);
    }
});
test("standby teardown continues after an overlay, queue or native cleanup failure", () => {
    for (const failure of [
        "overlay",
        "queue",
        "main-load",
        "pip-load",
        "device",
    ]) {
        const { w } = fixture();
        w.document.getElementById = () => null;
        w.playerMode = 0;
        w.stbPlay("main.mp4");
        w.stbPlayPip("pip.mp4");
        const fail = () => {
            throw new Error("Synthetic cleanup failure");
        };
        if (failure === "overlay") w.closeList = fail;
        if (failure === "queue") w.__ottPlexQueue = { stop: fail };
        if (failure === "main-load") w.video.load = fail;
        if (failure === "pip-load") w.videoPip.load = fail;
        if (failure === "device")
            w.__ottCoreTransport.configure({ standby: fail });
        assert.doesNotThrow(() => w.stbToggleStandby(), failure);
        assert.equal(w.stbIsStandby(), true, failure);
        for (const video of [w.video, w.videoPip]) {
            assert.equal(video.paused, true, failure);
            assert.equal(video.src, "", failure);
        }
        assert.equal(w.__ottCoreBackend().current(), null, failure);
        assert.equal(w.__ottCoreBackend().current("pip"), null, failure);
    }
});
test("standby blocks explicit playback until one idempotent wake", () => {
    const { w } = fixture();
    w.document.getElementById = () => null;
    w.playerMode = 0;
    let starts = 0;
    w.startPlayer = () => starts++;
    w.stbSetStandby(true);
    w.stbPlay("explicit-main.mp4");
    w.stbPlayPip("explicit-pip.mp4");
    assert.equal(w.stbIsStandby(), true);
    assert.equal(w.video.paused, true);
    assert.equal(w.videoPip.paused, true);
    assert.equal(w.__ottCoreBackend().open({ url: "bypass.mp4" }), null);
    w.stbSetStandby(true);
    assert.equal(starts, 0);
    assert.equal(w.stbIsStandby(), true);
    assert.equal(w.__ottCoreBackend().current(), null);
    assert.equal(w.__ottCoreBackend().current("pip"), null);
    assert.equal(w.video.selectedResource, "");
    assert.equal(w.videoPip.selectedResource, "");
    w.stbSetStandby(false);
    w.stbSetStandby(false);
    assert.equal(starts, 1, "repeated wake does not start the player twice");
});
test("HLS same-track restoration and unavailable native track APIs", () => {
    const { w, boxes } = fixture();
    w.playerMode = 1;
    w.stbPlay("a.m3u8");
    w.setAudioTrack(0);
    w.stbStop();
    w.setAudioTrack(0);
    w.setSubtitleTrack(0);
    assert.equal(w.stbSubtitleExists(), 0);
    w.stbToggleAudioTrack();
    assert.equal(boxes.at(-1)[1][0], "Not found");
    w.stbToggleSubtitle();
});
test("HLS restores late subtitle lists only for the current stream", () => {
    const { w, players } = fixture();
    let restorations = 0;
    w.applyChannelPreference = (name, callback) => {
        if (name === "aSubs") {
            restorations++;
            callback(2);
        }
    };
    w.playerMode = 1;
    w.stbPlay("a.m3u8");
    const old = players[0];
    old.subtitleTracks = [{ name: "A" }, { name: "B" }];
    old.events.subtitles();
    assert.equal(old.subtitleTrack, 1);
    w.stbPlay("b.m3u8");
    const count = restorations;
    old.events.subtitles();
    assert.equal(restorations, count);
    players[1].subtitleTracks = [{ name: "A" }, { name: "B" }];
    players[1].events.subtitles();
    assert.equal(restorations, count + 1);
    assert.equal(players[1].subtitleTrack, 1);
});
test("PiP track discovery reads its own native media element", () => {
    const { w } = fixture();
    w.video.audioTracks = [{ enabled: true, label: "Main audio" }];
    w.videoPip.audioTracks = [{ enabled: true, label: "Preview audio" }];
    w.videoPip.textTracks = [
        { kind: "captions", label: "Preview captions", mode: "showing" },
    ];
    w.stbPlayPip("preview.mp4");
    const pip = w.__ottCoreBackend().current("pip");
    assert.equal(pip.tracks("audio")[0].name, "Preview audio");
    assert.equal(pip.tracks("subtitle")[0].name, "Preview captions");
});
test("native PiP track discovery ignores the main HLS instance", () => {
    const { w, players } = fixture();
    w.playerMode = 1;
    w.stbPlay("main.m3u8");
    players[0].audioTracks = [{ name: "Main HLS audio" }];
    players[0].subtitleTracks = [{ name: "Main HLS captions" }];
    w.videoPip.audioTracks = [
        { enabled: true, label: "Preview native audio" },
        { enabled: false, label: "Alternative preview audio" },
    ];
    w.videoPip.textTracks = [
        { kind: "captions", label: "Preview native captions", mode: "showing" },
    ];
    w.playerMode = 0;
    w.stbPlayPip("preview.mp4");
    const pip = w.__ottCoreBackend().current("pip");
    assert.equal(pip.tracks("audio")[0].name, "Preview native audio");
    assert.equal(pip.tracks("subtitle")[0].name, "Preview native captions");
    const mainAudio = players[0].audioTrack;
    pip.selectTrack("audio", 1);
    assert.deepEqual(
        Array.from(w.videoPip.audioTracks, (t) => t.enabled),
        [false, true]
    );
    assert.equal(players[0].audioTrack, mainAudio);
    assert.equal(
        w.__ottCoreBackend().current().tracks("audio")[0].name,
        "Main HLS audio"
    );
});
test("HLS PiP track discovery uses its instance before media attachment", () => {
    const { w, players } = fixture();
    w.video.audioTracks = [{ enabled: true, label: "Main native audio" }];
    w.playerMode = 0;
    w.stbPlay("main.mp4");
    w.playerMode = 1;
    w.stbPlayPip("preview.m3u8");
    const hls = players[0];
    hls.audioTracks = [
        { name: "Preview HLS audio" },
        { name: "Alternative preview HLS audio" },
    ];
    hls.subtitleTracks = [{ name: "Preview HLS captions" }];
    hls.media = null; // The owned instance can exist before async attachment completes.
    const pip = w.__ottCoreBackend().current("pip");
    assert.equal(pip.tracks("audio")[0].name, "Preview HLS audio");
    assert.equal(pip.tracks("subtitle")[0].name, "Preview HLS captions");
    pip.selectTrack("audio", 1);
    assert.equal(hls.audioTrack, 1);
    assert.equal(w.video.audioTracks[0].enabled, true);
    assert.equal(
        w.__ottCoreBackend().current().tracks("audio")[0].name,
        "Main native audio"
    );
});
test("shared native track collection preserves audio index zero and does not alter captions", () => {
    const { w } = fixture();
    w.video.audioTracks = [
        { enabled: true, label: "A" },
        { enabled: false, label: "B" },
    ];
    w.video.textTracks = [{ kind: "captions", mode: "showing" }];
    w.stbPlay("tracks.mp4");
    assert.equal(w.stbAudioTracksExists(), true);
    w.setAudioTrack(1);
    assert.deepEqual(
        Array.from(w.video.audioTracks, (t) => t.enabled),
        [false, true]
    );
    w.setAudioTrack(0);
    assert.deepEqual(
        Array.from(w.video.audioTracks, (t) => t.enabled),
        [true, false]
    );
    assert.equal(w.video.textTracks[0].mode, "showing");
    for (const index of [-1, 2, 0.5, NaN, Infinity]) {
        w.setAudioTrack(index);
        assert.deepEqual(
            Array.from(w.video.audioTracks, (t) => t.enabled),
            [true, false],
            "invalid saved audio indices must preserve the active track"
        );
    }
});
test("anonymous active native captions stay selectable after Off without exposing placeholders", () => {
    const { w, boxes } = fixture();
    const placeholder = { cues: [], kind: "subtitles", mode: "hidden" };
    const caption = {
        activeCues: [{}],
        cues: [],
        kind: "captions",
        mode: "showing",
    };
    const metadata = { kind: "metadata", label: "Timing", mode: "hidden" };
    w.video.textTracks = [placeholder, metadata, caption];
    w.stbPlay("native.m3u8");
    const owner = w.__ottCoreBackend().current();
    assert.equal(w.stbSubtitleExists(), 1);
    assert.equal(
        owner.tracks("subtitle")[0].id,
        3,
        "raw native index survives filtering"
    );
    w.stbToggleSubtitle();
    const box = boxes.at(-1);
    assert.equal(box[1][0], "Off");
    box[2](0);
    assert.equal(caption.mode, "disabled");
    assert.equal(
        metadata.mode,
        "hidden",
        "metadata must not be changed by Off"
    );
    assert.equal(
        w.stbSubtitleExists(),
        1,
        "discovered captions remain available for re-enabling"
    );
    owner.selectTrack("subtitle", 3);
    assert.equal(caption.mode, "showing");
});
test("explicit Off survives late native changes without a channel preference target", () => {
    const { w, boxes } = fixture();
    const events = {};
    const tracks = [{ cues: [{}], kind: "captions", mode: "showing" }];
    tracks.addEventListener = (name, callback) => {
        events[name] = callback;
    };
    tracks.removeEventListener = (name, callback) => {
        if (events[name] === callback) delete events[name];
    };
    w.video.textTracks = tracks;
    w.applyChannelPreference = () => {}; // Local media has no channel storage target.
    w.stbPlay("local.mp4");
    w.stbToggleSubtitle();
    boxes.at(-1)[2](0);
    tracks[0].mode = "showing";
    events.change();
    assert.equal(tracks[0].mode, "disabled");
    tracks.push({ cues: [{}], kind: "captions", mode: "showing" });
    events.addtrack();
    assert.equal(tracks[1].mode, "disabled");
    const stale = events.change;
    w.stbStop();
    tracks[1].mode = "showing";
    stale();
    assert.equal(
        tracks[1].mode,
        "showing",
        "stopped lease cannot modify another source"
    );
});
test("all exposed caption services remain selectable even before receiving cues", () => {
    const { w } = fixture();
    w.video.textTracks = Array.from({ length: 4 }, (_, i) => ({
        cues: i ? [] : [{}],
        kind: "captions",
        mode: i ? "disabled" : "showing",
    }));
    w.stbPlay("services.m3u8");
    assert.equal(w.stbSubtitleExists(), 4);
    const owner = w.__ottCoreBackend().current();
    owner.selectTrack("subtitle", 4);
    assert.deepEqual(
        Array.from(w.video.textTracks, (t) => t.mode),
        ["disabled", "disabled", "disabled", "showing"]
    );
    owner.selectTrack("subtitle", 0);
    assert.ok(w.video.textTracks.every((t) => t.mode === "disabled"));
});
test("HLS picker includes in-band captions, de-duplicates manifest TextTracks and silences both", () => {
    const { w, players } = fixture();
    const duplicate = {
        kind: "subtitles",
        label: "English",
        language: "en",
        mode: "showing",
    };
    const caption = { cues: [{}], kind: "captions", mode: "showing" };
    w.video.textTracks = [duplicate, caption];
    w.playerMode = 1;
    w.stbPlay("captions.m3u8");
    const hls = players[0];
    const owner = w.__ottCoreBackend().current();
    assert.equal(
        w.stbSubtitleExists(),
        2,
        "native captions remain available with empty manifest"
    );
    hls.subtitleTracks = [
        { lang: "en", name: "English", trackNode: { track: duplicate } },
    ];
    hls.subtitleTrack = 0;
    assert.equal(
        w.stbSubtitleExists(),
        2,
        "manifest render track is not duplicated"
    );
    const ids = Array.from(owner.tracks("subtitle"), (t) => t.id);
    assert.deepEqual(ids, [1, 10002]);
    owner.selectTrack("subtitle", 0);
    assert.equal(hls.subtitleTrack, -1);
    assert.equal(hls.subtitleDisplay, false);
    assert.equal(caption.mode, "disabled");
    assert.equal(duplicate.mode, "disabled");
    owner.selectTrack("subtitle", 10002);
    assert.equal(caption.mode, "showing");
    assert.equal(hls.subtitleTrack, -1);
    owner.selectTrack("subtitle", 1);
    assert.equal(hls.subtitleTrack, 0);
    assert.equal(hls.subtitleDisplay, true);
    assert.equal(caption.mode, "disabled");
});
test("HLS manifest mirror restoration is idempotent and repairs external hiding", () => {
    const { w, players, boxes } = fixture();
    const events = {},
        queued = [];
    let mode = "disabled",
        writes = 0;
    const mirror = { kind: "subtitles", label: "English" };
    Object.defineProperty(mirror, "mode", {
        get: () => mode,
        set: (value) => {
            if (mode !== value) {
                mode = value;
                queued.push(() => events.change?.());
            }
        },
    });
    const tracks = [mirror];
    tracks.addEventListener = (name, callback) => {
        events[name] = callback;
    };
    tracks.removeEventListener = (name) => {
        delete events[name];
    };
    w.video.textTracks = tracks;
    w.playerMode = 1;
    w.stbPlay("mirror.m3u8");
    const hls = players[0];
    hls.subtitleTracks = [{ name: "English", trackNode: { track: mirror } }];
    let selected = -1,
        display = false;
    Object.defineProperty(hls, "subtitleTrack", {
        get: () => selected,
        set: (value) => {
            writes++;
            selected = value;
            mirror.mode = value === 0 ? "showing" : "disabled";
        },
    });
    Object.defineProperty(hls, "subtitleDisplay", {
        get: () => display,
        set: (value) => {
            writes++;
            display = value;
            mirror.mode = value && selected === 0 ? "showing" : "disabled";
        },
    });
    function drain() {
        let turns = 0;
        while (queued.length) {
            assert.ok(++turns < 10, "mode change restoration must settle");
            queued.shift()();
        }
    }
    w.stbToggleSubtitle();
    boxes.at(-1)[2](1);
    drain();
    assert.equal(mirror.mode, "showing");
    const stableWrites = writes;
    mirror.mode = "disabled";
    drain();
    assert.equal(
        mirror.mode,
        "showing",
        "same-index external hiding is repaired"
    );
    assert.equal(
        writes,
        stableWrites,
        "native repair does not churn HLS setters"
    );
});
test("native late-track listeners belong to their engine lease", () => {
    const { w } = fixture();
    const listeners = [];
    w.video.textTracks = {
        addEventListener(name, callback) {
            if (name === "addtrack") listeners.push(callback);
        },
        length: 0,
        removeEventListener(name, callback) {
            if (name === "addtrack")
                listeners.splice(listeners.indexOf(callback), 1);
        },
    };
    let restores = 0;
    w.applyChannelPreference = (name) => {
        if (name === "aSubs") restores++;
    };
    w.playerMode = 0;
    w.stbPlay("a.mp4");
    assert.equal(listeners.length, 1);
    const old = listeners[0];
    old();
    assert.equal(restores, 1);
    w.stbPlay("b.mp4");
    assert.equal(listeners.length, 1, "replacement removes old listener");
    old();
    assert.equal(restores, 1, "retained callback has no authority");
    listeners[0]();
    assert.equal(restores, 2);
    w.stbStop();
    assert.equal(listeners.length, 0);
});
test("subtitle appearance refresh follows main and preview geometry changes", () => {
    const { w, styles } = fixture();
    let refreshes = 0;
    w.document.getElementById = () => null;
    w.applySubtitleAppearance = () => {
        refreshes++;
    };
    w.applyAspectRatio();
    assert.equal(refreshes, 1);
    assert.ok(styles["#video"]);
    w.setPipPosition();
    assert.equal(refreshes, 2);
    assert.ok(styles["#videopip"]);
});
test("main engine restores aspect before metadata, including the next video", () => {
    const { w, styles } = fixture();
    w.document.getElementById = () => null;
    w.document.body.classList = { add() {}, remove() {} };
    let saved = 1;
    w.applyChannelPreference = (name, callback) => {
        if (name === "aAspects") callback(saved);
    };
    w.stbPlay("first.mp4");
    assert.equal(w.video.readyState, 0);
    assert.equal(styles["#video"]["object-fit"], "cover");
    saved = 0;
    w.stbPlay("second.mp4");
    assert.equal(w.video.readyState, 0);
    assert.equal(styles["#video"]["object-fit"], "contain");
    w.stbStop();
});
test("PiP starts after manifest and ignores callbacks after switch/stop", () => {
    const { w, players, hidden } = fixture();
    w.playerMode = 1;
    w.stbPlayPip("a.m3u8");
    assert.equal(
        w.videoPip.playCalls,
        0,
        "HLS PiP must wait for attachment/manifest"
    );
    players[0].events.manifest();
    assert.equal(w.videoPip.playCalls, 1);
    w.playerMode = 0;
    w.stbPlayPip("b.mp4");
    assert.equal(players[0].destroyCalls, 1);
    players[0].events.manifest();
    assert.equal(w.videoPip.playCalls, 2);
    w.stbStopPip();
    w.stbStopPip();
    assert.equal(players[0].destroyCalls, 1);
    assert.equal(w.videoPip.src, "");
    assert.ok(hidden.includes("#pip_buffering"));
});
test("native PiP fallback keeps source identity and uses the prepared transport", () => {
    const { w } = fixture();
    const source = "https://source.invalid/protected.m3u8";
    const local =
        "http://127.0.0.1:12345/access/" +
        "a".repeat(43) +
        "/fixture/media.m3u8";
    let original;
    w.playerMode = 0;
    w.__ottCoreTransport.configure({
        pip: {
            open(request, fallback) {
                original = request;
                return fallback(local);
            },
        },
    });
    w.stbPlayPip(source);
    assert.equal(original.url, source);
    assert.equal(w.videoPip.src, local);
    assert.equal(w.videoPip.playCalls, 1);
    w.stbStopPip();
    assert.equal(w.videoPip.src, "");
    assert.equal(w.videoPip.paused, true);
});
test("PiP loader stays compact and centered through size, corner and canvas changes", () => {
    const { w, styles } = fixture();
    const presets = [
        [256, 144],
        [384, 216],
        [512, 288],
    ];
    function rectangle(style) {
        const width = parseFloat(style.width);
        const height = parseFloat(style.height);
        assert.notEqual(style.left === "auto", style.right === "auto");
        assert.notEqual(style.top === "auto", style.bottom === "auto");
        return {
            height,
            width,
            x:
                style.left === "auto"
                    ? w.innerWidth - parseFloat(style.right) - width
                    : parseFloat(style.left),
            y:
                style.top === "auto"
                    ? w.innerHeight - parseFloat(style.bottom) - height
                    : parseFloat(style.top),
        };
    }
    function near(actual, expected, message) {
        assert.ok(Math.abs(actual - expected) < 0.000001, message);
    }
    w.playerMode = 0;
    w.stbPlayPip("preview.mp4");
    assert.equal(styles["#pip_buffering"].width, "30px");
    for (const [width, height] of [
        [1280, 720],
        [1920, 1080],
        [640, 360],
        [1024, 768],
        [720, 1280],
    ]) {
        w.innerWidth = width;
        w.innerHeight = height;
        const scale = Math.min(width / 1280, height / 720);
        for (let size = 0; size < presets.length; size++) {
            // Retain the prior CSS between opposite-corner transitions.
            for (const corner of [0, 2, 1, 3, 0]) {
                w.sPipSize = String(size);
                w.sPipPos = String(corner);
                w.setPipPosition();
                const videoStyle = styles["#videopip"];
                const loaderStyle = styles["#pip_buffering"];
                const videoRect = rectangle(videoStyle);
                const loaderRect = rectangle(loaderStyle);
                near(videoRect.width, presets[size][0] * scale, "PiP width");
                near(videoRect.height, presets[size][1] * scale, "PiP height");
                near(loaderRect.width, 30 * scale, "compact loader width");
                near(loaderRect.height, 30 * scale, "compact loader height");
                near(
                    loaderRect.x + loaderRect.width / 2,
                    videoRect.x + videoRect.width / 2,
                    "loader centered horizontally"
                );
                near(
                    loaderRect.y + loaderRect.height / 2,
                    videoRect.y + videoRect.height / 2,
                    "loader centered vertically"
                );
                for (const side of ["left", "right", "top", "bottom"])
                    assert.equal(
                        loaderStyle[side] === "auto",
                        videoStyle[side] === "auto",
                        "clear the opposite " + side + " edge"
                    );
            }
        }
    }
});
test("native Shaka awaits attach and ignores a stopped attachment", async () => {
    const { w, shakas } = fixture();
    w.__ottNativeRuntime = true;
    w.playerMode = 2;
    w.stbPlay("native.mpd", 12);
    assert.equal(shakas[0].media, w.video);
    assert.equal(shakas[0].url, undefined, "load waits for attach");
    shakas[0].attached.resolve();
    await tick();
    assert.equal(shakas[0].url, "native.mpd");
    assert.equal(shakas[0].position, 12);
    w.stbStop();
    shakas[0].loaded.resolve();
    shakas[0].destroyed.resolve();
    await tick();
    w.stbPlay("stopped.mpd");
    w.stbStop();
    shakas[1].attached.resolve();
    await tick();
    assert.equal(
        shakas[1].url,
        undefined,
        "late attach cannot revive stopped stream"
    );
    assert.equal(w.video.playCalls, 0);
});

test("Shaka owns load position, respects late pause and releases before the next engine", async () => {
    const { w, shakas } = fixture();
    w.playerMode = 2;
    w.stbPlay("a.mpd", 43);
    assert.equal(shakas[0].position, 43);
    assert.equal(w.video.playCalls, 0);
    w.stbPause();
    shakas[0].loaded.resolve();
    await tick();
    assert.equal(w.video.playCalls, 0);
    w.stbContinue();
    assert.equal(w.video.playCalls, 1);
    w.playerMode = 0;
    w.stbPlay("b.mp4");
    assert.equal(shakas[0].destroyCalls, 1);
    assert.notEqual(w.video.src, "b.mp4", "await asynchronous Shaka detach");
    assert.equal(
        w.video.listeners.playing.length,
        0,
        "replacement must not observe the retiring decoder"
    );
    const pending = w.__ottCoreBackend().current();
    assert.equal(pending.snapshot().phase, "loading");
    w.stbPlay("c.mp4");
    shakas[0].destroyed.resolve();
    await tick();
    assert.equal(w.video.src, "c.mp4");
    assert.equal(
        w.video.listeners.playing.length,
        1,
        "only the attached replacement owns observations"
    );
    assert.equal(pending.active(), false);
    assert.equal(w.video.playCalls, 2);
});
test("Shaka late load/rejection cannot resurrect stopped playback", async () => {
    const { w, shakas, errors } = fixture();
    w.playerMode = 2;
    w.stbPlay("a.mpd");
    w.stbStop();
    assert.equal(shakas[0].destroyCalls, 1);
    shakas[0].loaded.resolve();
    shakas[0].destroyed.resolve();
    await tick();
    assert.equal(w.video.playCalls, 0);
    w.stbPlay("bad.mpd");
    shakas[1].loaded.reject(new Error("manifest failed"));
    await tick();
    assert.equal(w.video.playCalls, 0);
    assert.equal(errors.length, 1);
});
for (const mode of [0, 1, 2]) {
    for (const deferredSource of [false, true]) {
        test(
            "paused restart permits first native Play: engine " +
                mode +
                ", deferred source " +
                deferredSource,
            async () => {
                const { w, players, shakas } = fixture();
                const prepared = [];
                const state = {
                    generation: 1,
                    position: 8,
                    target: { kind: "vod" },
                };
                w.__ottClassicPlayback = {
                    command(value) {
                        if (value.type === "position")
                            state.position = value.position;
                    },
                    context: () => ({
                        isCurrentBackend: () => true,
                        isCurrentSource: () => true,
                    }),
                    snapshot: () => state,
                };
                w.playerMode = mode;
                w.__ottNativeRuntime = true;
                if (deferredSource)
                    w.__ottCoreTransport.configure({
                        prepareSource(_url, ready) {
                            prepared.push(ready);
                            return () => {};
                        },
                    });
                async function finishStartup(index) {
                    if (mode === 2 && index) {
                        shakas[index - 1].destroyed.resolve();
                        await tick();
                    }
                    if (deferredSource) prepared[index]("prepared.mp4");
                    if (mode === 1) players[index].events.manifest();
                    if (mode === 2) {
                        shakas[index].attached.resolve();
                        await tick();
                        shakas[index].loaded.resolve();
                        await tick();
                    }
                }
                function nativePlay() {
                    w.video.play();
                    for (const listener of [...w.video.listeners.playing])
                        listener();
                }
                const backend = w.__ottCoreBackend();
                backend.open({ url: "movie.mp4" });
                await finishStartup(0);
                w.video.readyState = 2;
                w.video.currentTime = 8;
                for (const listener of [...w.video.listeners.playing])
                    listener();
                backend.current().pause();
                const plays = w.video.playCalls;
                w.video.autoplay = true;
                assert.equal(backend.restart().paused, true);
                assert.equal(
                    w.forcePlay,
                    false,
                    "pause intent precedes asynchronous startup"
                );
                assert.equal(
                    w.video.autoplay,
                    false,
                    "the reflected native autoplay attribute is disabled"
                );
                await finishStartup(1);
                w.video.metadata();
                w.video.readyState = 2;
                assert.equal(w.video.paused, true);
                assert.equal(
                    w.video.playCalls,
                    plays,
                    "neither source preparation nor decoder ready may play"
                );
                assert.equal(backend.current().snapshot().phase, "paused");
                nativePlay();
                assert.equal(
                    w.video.paused,
                    false,
                    "first native Play is not mistaken for delayed autoplay"
                );
                assert.equal(backend.current().snapshot().phase, "playing");
                backend.current().pause();
                backend.current().resume();
                assert.equal(
                    w.forcePlay,
                    true,
                    "explicit backend resume still owns autoplay intent"
                );
                assert.equal(w.video.paused, false);
                backend.dispose();
                shakas.forEach((player) => player.destroyed.resolve());
            }
        );
    }
}
test("local startup offset waits for metadata and resets only when beyond the new file end", () => {
    const { w } = fixture();
    w.__ottActiveProviderDriver = { id: "offline" };
    w.video.blockEarlySeek = true;
    w.stbPlay("local.mp4", 37);
    assert.equal(w.video.currentTime, 0);
    w.video.duration = 100;
    w.video.metadata();
    assert.equal(w.video.currentTime, 37);
    w.video.readyState = 0;
    w.video.duration = NaN;
    w.stbPlay("replaced-local.mp4", 137);
    w.video.duration = 100;
    w.video.metadata();
    assert.equal(w.video.currentTime, 0);
});

test("native and HLS recovery preserve seek on engines rejecting pre-metadata currentTime", () => {
    const { w, players } = fixture();
    w.video.blockEarlySeek = true;
    w.stbPlay("archive.mp4", 37);
    w.stbPause();
    w.video.metadata();
    assert.equal(w.video.currentTime, 37);
    assert.equal(w.video.paused, true);
    w.playerMode = 1;
    w.stbPlay("archive.m3u8", 54);
    players[0].events.manifest();
    w.video.metadata();
    assert.equal(players[0].config.startPosition, 54);
    w.video.currentTime = 73;
    players[0].hasEnoughToStart = true;
    w.stbPause();
    const fatal = { details: "bufferAppendError", fatal: true, type: "media" };
    players[0].events.error(null, fatal);
    players[0].events.error(null, fatal);
    w.video.metadata();
    assert.equal(w.video.currentTime, 73);
    assert.equal(w.video.paused, true);
    w.playerMode = 0;
    w.stbPlay("old.mp4", 88);
    const stale = [...w.video.listeners.loadedmetadata];
    w.stbPlay("new.mp4", 12);
    for (const cb of stale) cb();
    w.video.metadata();
    assert.equal(w.video.currentTime, 12);
});
test("HLS resumes through its buffered-start position without early DOM seeks", () => {
    const { w, players } = fixture();
    w.playerMode = 1;
    const position = 0.114871958;
    w.stbPlay("resume.m3u8", position);
    assert.equal(players[0].config.startPosition, position);
    assert.deepEqual(w.video.seekWrites, []);
    players[0].events.manifest();
    w.video.metadata();
    assert.equal(w.video.playCalls, 1);
    assert.deepEqual(
        w.video.seekWrites,
        [],
        "manifest and metadata leave the initial seek to the HLS engine"
    );
    assert.equal(w._corePendingSeek, null);
    w.stbPlay("replacement.m3u8", 0.25);
    players[0].events.manifest();
    assert.equal(
        w.video.playCalls,
        1,
        "retired manifest cannot resume playback"
    );
    players[1].events.manifest();
    w.video.metadata();
    assert.equal(players[1].config.startPosition, 0.25);
    assert.equal(w.video.playCalls, 2);
    assert.deepEqual(w.video.seekWrites, []);
    w.stbStop();
});
test("HLS retains its default start policy unless a finite positive resume exists", () => {
    for (const position of [undefined, 0, -1, NaN, Infinity]) {
        const { w, players } = fixture();
        w.playerMode = 1;
        w.stbPlay("live.m3u8", position);
        assert.equal(players[0].config.startPosition, undefined);
        players[0].events.manifest();
        w.video.metadata();
        assert.deepEqual(w.video.seekWrites, []);
        w.stbStop();
    }
});
test("HLS failure before its first frame preserves requested native fallback resume", () => {
    const { w, players } = fixture();
    w.playerMode = 1;
    w.video.blockEarlySeek = true;
    w.stbPlay("resume.m3u8", 54);
    players[0].events.manifest();
    assert.equal(w.video.currentTime, 0);
    const fatal = { details: "bufferAppendError", fatal: true, type: "media" };
    players[0].events.error(null, fatal);
    players[0].events.error(null, fatal);
    w.video.metadata();
    assert.equal(w.video.currentTime, 54);
    w.stbStop();
});
test("HLS recovery preserves an explicit seek to zero through native fallback", () => {
    const { w, players } = fixture();
    w.playerMode = 1;
    w.video.blockEarlySeek = true;
    w.stbPlay("resume.m3u8", 35);
    const hls = players[0];
    hls.events.manifest();
    w.video.metadata();
    w.video.currentTime = 35;
    hls.hasEnoughToStart = true;
    w.stbSetPosTime(0);
    w.video.seekWrites.length = 0;
    hls.recoverMediaError = function () {
        assert.equal(
            this.config.startPosition,
            0,
            "HLS reattachment must not restore the original resume position"
        );
        this.media.src = "blob:recovered";
        this.hasEnoughToStart = false;
    };
    const fatal = { details: "bufferAppendError", fatal: true, type: "media" };
    hls.events.error(null, fatal);
    assert.equal(w.video.readyState, 0);
    hls.events.error(null, fatal);
    assert.equal(w.video.src, "resume.m3u8");
    w.video.metadata();
    assert.equal(w.video.currentTime, 0);
    assert.deepEqual(w.video.seekWrites, []);
    w.stbStop();
});
test("explicit seeks survive actual HLS recovery before metadata without reviving old positions", () => {
    for (const phase of ["startup", "before-recovery", "during-recovery"]) {
        for (const position of [0, 12]) {
            const { w, players } = fixture();
            w.playerMode = 1;
            w.video.blockEarlySeek = true;
            w.stbPlay("resume.m3u8", 35);
            const hls = players[0];
            hls.events.manifest();
            const fatal = {
                details: "bufferAppendError",
                fatal: true,
                type: "media",
            };
            if (phase !== "startup") {
                w.video.metadata();
                w.video.currentTime = 50;
                hls.hasEnoughToStart = true;
            }
            useActualHlsRecovery(hls);
            if (phase === "during-recovery") hls.events.error(null, fatal);
            w.video.readyState = 0;
            w.stbSetPosTime(position);
            assert.equal(hls.config.startPosition, position, phase);
            assert.equal(hls.activeStartPosition, position, phase);
            if (phase === "before-recovery")
                assert.ok(
                    w._corePendingSeek,
                    "the rejected DOM seek is pending"
                );
            else {
                assert.equal(w._corePendingSeek, null);
                assert.equal(
                    w.video.seekWrites.length,
                    phase === "startup" ? 0 : 1
                );
            }
            assert.equal(w.video.currentTime, phase === "startup" ? 0 : 50);
            if (phase !== "during-recovery") hls.events.error(null, fatal);
            assert.equal(hls.config.startPosition, position, phase);
            assert.equal(hls.activeStartPosition, position, phase);
            if (phase === "before-recovery")
                assert.deepEqual(
                    hls.startLoads.slice(-2),
                    [50, position],
                    "the requested target overrides actual HLS recovery's stale currentTime"
                );
            assert.equal(
                w._corePendingSeek,
                null,
                "HLS owns the recovery seek"
            );
            const writes = w.video.seekWrites.length;
            w.video.metadata();
            assert.equal(
                w.video.seekWrites.length,
                writes,
                "metadata cannot replay an early DOM seek"
            );
            hls.events.error(null, fatal);
            assert.equal(w.video.src, "resume.m3u8");
            w.video.metadata();
            assert.equal(w.video.currentTime, position, phase);
            assert.equal(w._corePendingSeek, null);
            w.stbStop();
        }
    }
});
test("stale and invalid seek requests preserve the active pending seek", () => {
    const { w, players } = fixture();
    w.playerMode = 0;
    w.video.blockEarlySeek = true;
    w.stbPlay("resume.m3u8", 35);
    w.stbSetPosTime(12);
    const pending = w._corePendingSeek;
    assert.ok(pending);
    w.seekCoreMedia(77, w._playSession - 1);
    for (const position of [-1, NaN, Infinity])
        w.seekCoreMedia(position, w._playSession);
    assert.equal(w._corePendingSeek, pending);
    assert.equal(players.length, 0);
    w.video.metadata();
    assert.equal(w.video.currentTime, 12);
    assert.equal(w._corePendingSeek, null);
    w.stbStop();
});
test("buffered HLS seeks use the DOM even while waiting for data", () => {
    const { w, players } = fixture();
    w.playerMode = 1;
    w.stbPlay("resume.m3u8", 35);
    const hls = players[0];
    hls.hasEnoughToStart = true;
    w.video.readyState = 1;
    w.stbSetPosTime(12);
    assert.equal(w.video.currentTime, 12);
    assert.deepEqual(
        hls.startLoads,
        [],
        "a normal seek must not restart loading"
    );
    assert.equal(w._corePendingSeek, null);
    w.stbStop();
});
test("HLS startup seeks wait for buffering instead of replaying at metadata", () => {
    const { w, players } = fixture();
    w.playerMode = 1;
    w.video.blockEarlySeek = true;
    w.stbPlay("resume.m3u8", 35);
    const hls = players[0];
    w.stbSetPosTime(12);
    w.stbSetPosTime(0);
    w.seekCoreMedia(77, w._playSession - 1);
    w.seekCoreMedia(NaN, w._playSession);
    assert.deepEqual(hls.startLoads, [12, 0]);
    assert.equal(hls.activeStartPosition, 0);
    w.video.metadata();
    assert.deepEqual(w.video.seekWrites, []);
    assert.equal(w._corePendingSeek, null);
    hls.hasEnoughToStart = true;
    w.video.readyState = 2;
    w.video.currentTime = hls.activeStartPosition;
    assert.equal(w.video.currentTime, 0);
    w.stbStop();
});
test("HLS recovery cannot restart a retired instance after synchronous reentry", () => {
    for (const action of ["stop", "replace"]) {
        const { w, players } = fixture();
        w.playerMode = 1;
        w.stbPlay("resume.m3u8", 35);
        const hls = players[0];
        hls.recoverMediaError = function () {
            if (action === "stop") w.stbStop();
            else w.stbPlay("replacement.m3u8", 12);
        };
        hls.events.error(null, { fatal: true, type: "media" });
        assert.deepEqual(hls.startLoads, []);
        if (action === "replace") assert.deepEqual(players[1].startLoads, []);
        w.stbStop();
    }
});
test("a synchronous HLS load error observes the pending explicit seek", () => {
    const { w, players } = fixture();
    w.playerMode = 1;
    w.video.blockEarlySeek = true;
    w.stbPlay("resume.m3u8", 35);
    const hls = players[0];
    w.video.metadata();
    w.video.currentTime = 50;
    w.video.readyState = 0;
    hls.hasEnoughToStart = true;
    useActualHlsRecovery(hls);
    const startLoad = hls.startLoad;
    let first = true;
    hls.startLoad = function (position) {
        startLoad.call(this, position);
        if (first) {
            first = false;
            this.events.error(null, { fatal: true, type: "media" });
        }
    };
    w.stbSetPosTime(0);
    assert.equal(hls.config.startPosition, 0);
    assert.equal(hls.activeStartPosition, 0);
    assert.deepEqual(hls.startLoads, [0, 50, 0]);
    assert.equal(w._corePendingSeek, null);
    const writes = w.video.seekWrites.length;
    w.video.metadata();
    assert.equal(w.video.seekWrites.length, writes);
    w.stbStop();
});
test("HLS retries preserve startup and pending seeks while healthy playback uses its default position", () => {
    for (const route of ["network", "drop-level"]) {
        for (const phase of ["startup", "started-pending", "healthy"]) {
            for (const position of [0, 12]) {
                const { w, players } = fixture();
                w.playerMode = 1;
                w.video.blockEarlySeek = true;
                w.stbPlay("resume.m3u8", 35);
                const hls = players[0];
                if (phase !== "startup") {
                    w.video.metadata();
                    w.video.currentTime = 50;
                    hls.hasEnoughToStart = true;
                }
                if (phase === "started-pending") w.video.readyState = 0;
                if (phase !== "healthy") w.stbSetPosTime(position);
                assert.equal(!!w._corePendingSeek, phase === "started-pending");
                // The controller may sample stale decoder time before retry.
                hls.activeStartPosition = 50;
                hls.recoverMediaError = () =>
                    assert.fail("retry should not reattach media");
                if (route === "drop-level") hls.levels = [{}, {}];
                hls.events.error(null, {
                    details:
                        route === "network"
                            ? "fragLoadError"
                            : "bufferAppendError",
                    fatal: true,
                    level: 1,
                    type: route === "network" ? "network" : "media",
                });
                const expected = phase === "healthy" ? -1 : position;
                assert.equal(
                    hls.activeStartPosition,
                    expected,
                    `${route}/${phase}`
                );
                assert.equal(
                    hls.startLoads.at(-1),
                    expected,
                    `${route}/${phase}`
                );
                w.video.metadata();
                if (phase === "startup") {
                    assert.deepEqual(w.video.seekWrites, []);
                    assert.equal(w.video.currentTime, 0);
                } else {
                    assert.equal(
                        w.video.currentTime,
                        phase === "healthy" ? 50 : position
                    );
                }
                assert.equal(w._corePendingSeek, null);
                w.stbStop();
            }
        }
    }
});
test("iOS source login cannot replace a newer channel or revive stopped playback", async () => {
    const { w } = fixture();
    const first = deferred(),
        second = deferred(),
        stopped = deferred();
    const pending = [first, second, stopped];
    const prepared = [],
        cancelled = [];
    w.__ottCoreTransport.configure({ prepareSource: w.prepareAccessMedia });
    w.Capacitor = {
        getPlatform: () => "ios",
        Plugins: {
            AccessMedia: {
                cancelPrepare: ({ requestId }) => {
                    cancelled.push(requestId);
                    return Promise.resolve();
                },
                prepare: ({ requestId }) => {
                    prepared.push(requestId);
                    return pending.shift().promise;
                },
            },
        },
    };
    const local =
        "http://127.0.0.1:12345/access/" +
        "a".repeat(43) +
        "/fixture/media.m3u8";
    w.stbPlay("https://source.invalid/old.m3u8");
    w.stbPlay("https://source.invalid/new.m3u8", 12);
    assert.deepEqual(cancelled, [prepared[0]]);
    assert.notEqual(prepared[0], prepared[1]);
    first.resolve({ url: local + "old" });
    await tick();
    assert.equal(w.video.playCalls, 0);
    second.resolve({ url: local });
    await tick();
    assert.equal(w.video.src, local);
    assert.equal(w.video.playCalls, 1);
    w.stbPlay("https://source.invalid/stopped.m3u8");
    w.stbStop();
    assert.deepEqual(
        cancelled,
        [prepared[0], prepared[2]],
        "only unfinished preparation is cancelled"
    );
    stopped.resolve({ url: local });
    await tick();
    assert.equal(w.video.playCalls, 1);
});
for (const behavior of [
    "missing",
    "nonfunction",
    "throw",
    "empty",
    "reject",
    "getter",
]) {
    test(`iOS source cancellation tolerates ${behavior} optional bridge`, async () => {
        for (const settled of [false, true]) {
            const { w } = fixture();
            const pending = deferred();
            let calls = 0;
            let ready = 0;
            let failed = 0;
            const plugin = { prepare: () => pending.promise };
            if (behavior === "getter")
                Object.defineProperty(plugin, "cancelPrepare", {
                    get() {
                        throw new Error("bridge unavailable");
                    },
                });
            else if (behavior === "nonfunction") plugin.cancelPrepare = true;
            else if (behavior !== "missing")
                plugin.cancelPrepare = function () {
                    assert.equal(this, plugin);
                    calls++;
                    if (behavior === "throw")
                        throw new Error("bridge unavailable");
                    if (behavior === "reject")
                        return Promise.reject(new Error("unsupported"));
                };
            w.Capacitor = {
                getPlatform: () => "ios",
                Plugins: { AccessMedia: plugin },
            };
            const source = "https://source.invalid/live.m3u8";
            const cancel = w.prepareAccessMedia(
                source,
                () => ready++,
                () => failed++
            );
            assert.equal(typeof cancel, "function");
            if (settled) {
                pending.resolve({ url: source });
                await tick();
            }
            assert.doesNotThrow(() => {
                cancel();
                cancel();
            });
            pending.resolve({ url: source });
            await tick();
            assert.equal(ready, settled ? 1 : 0);
            assert.equal(failed, 0);
            assert.equal(
                calls,
                !settled && ["throw", "empty", "reject"].includes(behavior)
                    ? 1
                    : 0
            );
        }
    });
}
test("iOS HLS reconnect prepares the original source again, not a stale loopback URL", async () => {
    const { w, players } = fixture();
    const prepared = [];
    const timers = [];
    const source = "https://source.invalid/live.m3u8";
    const local =
        "http://127.0.0.1:12345/access/" +
        "a".repeat(43) +
        "/fixture/media.m3u8";
    w.playerMode = 1;
    w.setTimeout = (callback) => {
        timers.push(callback);
        return timers.length;
    };
    w.clearTimeout = () => {};
    w.__ottCoreTransport.configure({ prepareSource: w.prepareAccessMedia });
    w.Capacitor = {
        getPlatform: () => "ios",
        Plugins: {
            AccessMedia: {
                prepare: ({ url }) => {
                    prepared.push(url);
                    return Promise.resolve({ url: local });
                },
            },
        },
    };
    w.stbPlay(source);
    await tick();
    players[0].events.error(null, {
        details: "manifestParsingError",
        fatal: true,
        type: "network",
    });
    assert.equal(timers.length, 1);
    timers[0]();
    await tick();
    assert.deepEqual(prepared, [source, source]);
    assert.equal(players.length, 2);
    w.stbStop();
});

test("iOS source login failure does not fall back to an unprotected URL", async () => {
    const { w } = fixture();
    const messages = [];
    w.showShift = (message) => messages.push(message);
    w.__ottCoreTransport.configure({ prepareSource: w.prepareAccessMedia });
    w.Capacitor = {
        getPlatform: () => "ios",
        Plugins: {
            AccessMedia: {
                prepare: () => Promise.reject(new Error("cancelled")),
            },
        },
    };
    w.stbPlay("https://source.invalid/blocked.m3u8");
    await tick();
    assert.equal(w.video.playCalls, 0);
    assert.deepEqual(messages, ["Source sign-in required"]);
});
test("HLS level zero is never confused with current higher level", () => {
    const { w, players } = fixture();
    w.playerMode = 1;
    w.stbPlay("live.m3u8");
    players[0].levels = [{}, {}, {}];
    players[0].currentLevel = 2;
    players[0].events.error(null, {
        fatal: true,
        frag: { level: 0 },
        type: "media",
    });
    assert.equal(players[0].removed, undefined);
});
test("Shaka retries are bounded across player recreation and retain VOD position", async () => {
    const { w, shakas } = fixture();
    const timers = new Map(),
        messages = [];
    let serial = 0;
    w.setTimeout = (callback) => {
        timers.set(++serial, callback);
        return serial;
    };
    w.clearTimeout = (id) => timers.delete(id);
    w.showShift = (message) => messages.push(message);
    w.playerMode = 2;
    w.stbPlay("https://source.invalid/movie.mpd", 20);
    for (let i = 0; i < 3; i++) {
        const player = shakas[i];
        player.attached.resolve();
        await tick();
        if (i) assert.equal(player.position, 37);
        w.video.currentTime = 37;
        w.video.readyState = 3;
        player.loaded.reject({
            category: 1,
            code: 1001,
            data: ["secret URL", 503],
        });
        await tick();
        if (i < 2) {
            assert.equal(timers.size, 1);
            const [id, run] = timers.entries().next().value;
            timers.delete(id);
            run();
            assert.equal(player.destroyCalls, 1);
            assert.equal(
                shakas.length,
                i + 1,
                "must await destroy before attaching retry"
            );
            player.destroyed.resolve();
            await tick();
        }
    }
    assert.equal(timers.size, 0);
    assert.equal(messages.pop(), "Stream could not be played");
    assert.equal(w.__ottStreamPolicy.snapshot().attempts, 2);
    w.stbStop();
    shakas[2].destroyed.resolve();
    await tick();
});
test("Shaka error event deduplicates load rejection and Stop cancels its retry", async () => {
    const { w, shakas } = fixture();
    const timers = new Map();
    let serial = 0;
    w.setTimeout = (callback) => {
        timers.set(++serial, callback);
        return serial;
    };
    w.clearTimeout = (id) => timers.delete(id);
    w.playerMode = 2;
    w.stbPlay("https://source.invalid/live.mpd");
    shakas[0].attached.resolve();
    await tick();
    const error = { category: 1, code: 1003, severity: 2 };
    shakas[0].events.error({ detail: error });
    shakas[0].loaded.reject(error);
    await tick();
    assert.equal(timers.size, 1);
    const stale = [...timers.values()][0];
    w.stbStop();
    shakas[0].destroyed.resolve();
    await tick();
    stale();
    await tick();
    assert.equal(timers.size, 0);
    assert.equal(shakas.length, 1);
});
test("Shaka enforces user restrictions and reports an impossible ceiling without retries", async () => {
    const { w, shakas } = fixture();
    const messages = [];
    w.showShift = (message) => messages.push(message);
    w.sStreamMaxHeight = 720;
    w.sStreamMaxBitrate = 4000000;
    w.playerMode = 2;
    w.stbPlay("https://source.invalid/live.mpd");
    assert.equal(shakas[0].config.restrictions.maxHeight, 720);
    assert.equal(shakas[0].config.restrictions.maxBandwidth, 4000000);
    shakas[0].attached.resolve();
    await tick();
    shakas[0].loaded.reject({ category: 4, code: 4012 });
    await tick();
    assert.equal(messages.pop(), "No stream meets the quality limits");
    assert.equal(w.__ottStreamPolicy.snapshot().attempts, 0);
    w.stbStop();
    shakas[0].destroyed.resolve();
    await tick();
});
for (const terminal of [
    { category: 1, code: 1001, data: ["upstream", 401], severity: 2 },
    { category: 1, code: 1001, data: ["upstream", 403], severity: 2 },
    { category: 6, code: 6001, severity: 2 },
    { category: 4, code: 4012, severity: 2 },
])
    test(
        "Shaka terminal error cancels an already queued transient retry: " +
            JSON.stringify(terminal),
        async () => {
            const { w, shakas } = fixture();
            const timers = new Map();
            let serial = 0;
            w.setTimeout = (callback) => {
                timers.set(++serial, callback);
                return serial;
            };
            w.clearTimeout = (id) => timers.delete(id);
            w.playerMode = 2;
            w.stbPlay("https://source.invalid/live.mpd");
            const first = shakas[0];
            first.attached.resolve();
            await tick();
            const transient = { category: 1, code: 1003, severity: 2 };
            first.events.error({ detail: transient });
            assert.equal(timers.size, 1);
            const stale = [...timers.values()][0];
            first.events.error({ detail: terminal });
            assert.equal(
                timers.size,
                0,
                "terminal failure must remove the pending timer"
            );
            assert.equal(
                w.__ottStreamPolicy.snapshot().state,
                terminal.category === 1 ? "access-denied" : "failed"
            );
            // The same failure can arrive through both the event and load rejection.
            first.loaded.reject(transient);
            stale();
            await tick();
            assert.equal(
                shakas.length,
                1,
                "stale timer cannot recreate the failed decoder"
            );
            assert.equal(w.__ottStreamPolicy.snapshot().attempts, 0);
            assert.equal(timers.size, 0);
            w.stbStop();
            first.destroyed.resolve();
            await tick();
        }
    );
test("HLS quality restriction is applied before fragment loading", () => {
    const { w, players } = fixture();
    w.sStreamMaxHeight = 720;
    w.playerMode = 1;
    w.stbPlay("https://source.invalid/live.m3u8");
    const player = players[0];
    assert.equal(player.config.autoStartLoad, false);
    player.levels = [{ height: 480 }, { height: 720 }, { height: 1080 }];
    player.removeLevel = function (index) {
        this.levels.splice(index, 1);
    };
    player.events.manifest();
    assert.deepEqual(
        player.levels.map((level) => level.height),
        [480, 720]
    );
    assert.equal(player.startLoads.length, 1);
    assert.equal(player.autoLevelCapping, 1);
    w.stbStop();
});
test("HLS quality-limited startup preserves finite positive resume positions and otherwise uses live edge", () => {
    for (const limits of [
        { sStreamMaxHeight: 720 },
        { sStreamMaxBitrate: 4000000 },
        { sStreamMaxBitrate: 4000000, sStreamMaxHeight: 720 },
    ]) {
        for (const position of [
            undefined,
            0,
            -1,
            -20,
            NaN,
            Infinity,
            -Infinity,
            0.25,
            37,
        ]) {
            const { w, players } = fixture();
            Object.assign(w, limits);
            w.playerMode = 1;
            w.stbPlay("https://source.invalid/stream.m3u8", position);
            const player = players[0];
            const expected =
                Number.isFinite(position) && position > 0 ? position : -1;
            assert.equal(player.config.autoStartLoad, false);
            assert.equal(player.config.startPosition ?? -1, expected);
            assert.deepEqual(player.startLoads, []);
            player.levels = [{ bitrate: 2000000, height: 720 }];
            player.events.manifest();
            assert.deepEqual(
                player.startLoads,
                [expected],
                `quality-limited start position ${String(position)}`
            );
            w.stbStop();
        }
    }
});
function archiveFailureFixture() {
    const f = fixture();
    const { w } = f;
    const timers = new Map();
    let sequence = 0;
    w.setTimeout = (fn) => {
        timers.set(++sequence, fn);
        return sequence;
    };
    w.clearTimeout = (id) => timers.delete(id);
    w.setInterval = () => ++sequence;
    w.clearInterval = () => {};
    const state = {
        generation: 1,
        phase: "loading",
        position: 120,
        target: { channelId: "channel", kind: "archive", sourceId: "source" },
    };
    const commands = [];
    w.__ottClassicPlayback = {
        cancel() {},
        command(command) {
            commands.push(command);
            if (command.type === "position") state.position = command.position;
            else if (command.type === "stop") {
                state.phase = "stopped";
                state.generation++;
            } else state.phase = command.type;
        },
        context() {
            const generation = state.generation;
            const active = () =>
                generation === state.generation && state.phase !== "stopped";
            return { isCurrentBackend: active, isCurrentSource: active };
        },
        importLegacy() {},
        snapshot: () => state,
    };
    w.playerMode = 1;
    const url = "https://source.invalid/archive.m3u8?start=1234&duration=1800";
    w.stbPlay(url, 100);
    function playing(time) {
        Object.assign(w.video, {
            currentTime: time,
            duration: 500,
            paused: false,
            readyState: 4,
        });
        f.players.at(-1).hasEnoughToStart = true;
        for (const callback of [...w.video.listeners.playing]) callback();
    }
    playing(100);
    return { ...f, commands, playing, state, timers, url };
}
test("archive HLS failures without DOM errors preserve time, recover once and then stop truthfully", () => {
    for (const type of ["network", "other"]) {
        const { w, players, playing, state, timers, url } =
            archiveFailureFixture();
        const backend = w.__ottCoreBackend();
        const handle = backend.current();
        w.video.currentTime = 107.5;
        const fatal = { details: "manifestParsingError", fatal: true, type };
        players[0].events.error(null, fatal);
        assert.equal(
            state.phase,
            "loading",
            "internal HLS error is authoritative without a DOM error"
        );
        assert.equal(handle.snapshot().position, 127.5);
        assert.equal(
            w.video.currentTime,
            0,
            "destroy cleared the decoder clock"
        );
        assert.equal(timers.size, 1, "one bounded outer retry");
        const [id, retry] = timers.entries().next().value;
        timers.delete(id);
        retry();
        assert.equal(
            players[1].url,
            url,
            "retry stays on the same archive window"
        );
        assert.equal(players[1].config.startPosition, 107.5);
        playing(107.5);
        assert.equal(state.phase, "playing");
        w.video.currentTime = 109;
        players[1].events.error(null, fatal);
        assert.equal(
            timers.size,
            0,
            "exhausted parse/decode budget cannot loop"
        );
        assert.equal(state.phase, "stopped");
        assert.equal(state.position, 129);
        assert.equal(backend.current(), null);
        assert.equal(handle.snapshot().phase, "stopped");
        assert.equal(backend.lastAttempt().reason, "failed");
        assert.equal(backend.lastAttempt().fatalErrors, 2);
        assert.equal(backend.lastAttempt().streamRetries, 1);
        assert.equal(w.__ottStreamPolicy.snapshot().state, "failed");
        retry();
        assert.equal(
            players.length,
            2,
            "late retry cannot revive terminated archive"
        );
    }
});
test("archive access denial stops without retry and preserves the failure reason", () => {
    const { w, players, state, timers } = archiveFailureFixture();
    w.video.currentTime = 111;
    players[0].events.error(null, {
        fatal: true,
        response: { code: 403 },
        type: "network",
    });
    assert.equal(state.phase, "stopped");
    assert.equal(state.position, 131);
    assert.equal(w.__ottCoreBackend().current(), null);
    assert.equal(w.__ottStreamPolicy.snapshot().state, "access-denied");
    assert.equal(timers.size, 0);
});
for (const trigger of ["observation", "feedback"]) {
    test(
        "archive failure reentry through " +
            trigger +
            " cannot clear the replacement HLS",
        () => {
            const { w, players, state, timers } = archiveFailureFixture();
            let replaced = false;
            const replace = () => {
                if (replaced) return;
                replaced = true;
                state.generation++;
                state.phase = "loading";
                w.stbPlay("https://source.invalid/replacement.m3u8", 220);
            };
            if (trigger === "observation")
                w.__ottCoreBackend().subscribe((event) => {
                    if (event.type === "error") replace();
                });
            else w.showShift = replace;
            players[0].events.error(null, {
                fatal: true,
                response: { code: 403 },
                type: "network",
            });
            assert.equal(players.length, 2);
            assert.equal(players[0].destroyCalls, 1);
            assert.equal(players[1].destroyCalls, 0);
            assert.equal(w.hlsInstance, players[1]);
            assert.equal(timers.size, 0);
            w.stbStop();
        }
    );
}
for (const trigger of ["nativeFallbacks", "engineStarts", "policy"]) {
    test(
        "native fallback " + trigger + " reentry preserves replacement media",
        () => {
            const { w, players, state, timers } = archiveFailureFixture();
            let replaced = false,
                replacementSource;
            const replace = () => {
                if (replaced) return;
                replaced = true;
                state.generation++;
                state.phase = "loading";
                w.stbPlay("https://source.invalid/replacement.m3u8", 220);
                replacementSource = w.video.src;
            };
            if (trigger === "policy") {
                const begin = w.__ottStreamPolicy.begin;
                w.__ottStreamPolicy.begin = function (...args) {
                    const result = begin.apply(this, args);
                    if (args[0] === "html5") replace();
                    return result;
                };
            } else {
                w.__ottPerfSink = {
                    changed() {},
                    recovery(key) {
                        if (key === trigger) replace();
                    },
                };
            }
            const failed = players[0];
            const error = {
                details: "bufferAppendError",
                fatal: true,
                type: "media",
            };
            failed.events.error(null, error);
            failed.events.error(null, error);
            assert(replaced, "native fallback must reach the callback");
            assert.equal(players.length, 2);
            assert.equal(failed.destroyCalls, 1);
            assert.equal(players[1].destroyCalls, 0);
            assert.equal(w.hlsInstance, players[1]);
            assert.equal(
                w.video.src,
                replacementSource,
                "obsolete native fallback must not overwrite the new resource"
            );
            assert.equal(
                w.__ottCoreBackend().current().diagnosticEngine(),
                "hls.js"
            );
            assert.equal(w.__ottStreamPolicy.snapshot().engine, "hls.js");
            assert.equal(timers.size, 0);
            w.stbStop();
        }
    );
}
for (const detail of ["manifestLoadError", "manifestLoadTimeOut"]) {
    test(
        "HLS startup " + detail + " schedules a real bounded source retry",
        () => {
            const { w, players } = fixture();
            const timers = new Map();
            let sequence = 0;
            w.setTimeout = (callback) => {
                timers.set(++sequence, callback);
                return sequence;
            };
            w.clearTimeout = (id) => timers.delete(id);
            w.playerMode = 1;
            w.stbPlay("https://source.invalid/movie.m3u8", 37);
            for (let attempt = 0; attempt < 3; attempt++) {
                const player = players.at(-1);
                assert.equal(player.url, "https://source.invalid/movie.m3u8");
                assert.equal(player.config.startPosition, 37);
                assert.equal(player.levels.length, 0);
                player.events.error(null, {
                    details: detail,
                    fatal: true,
                    type: "network",
                });
                assert.equal(
                    player.destroyCalls,
                    1,
                    "a failed initial manifest must leave the stalled engine"
                );
                assert.deepEqual(
                    player.startLoads,
                    [],
                    "startLoad has no playlist to resume before the manifest loads"
                );
                if (attempt === 2) {
                    assert.equal(
                        timers.size,
                        0,
                        "source retry budget is finite"
                    );
                } else {
                    assert.equal(timers.size, 1);
                    const [id, retry] = timers.entries().next().value;
                    timers.delete(id);
                    retry();
                    assert.equal(players.length, attempt + 2);
                }
            }
            w.stbStop();
        }
    );
}
test("HLS outer recovery samples the VOD position before destroy resets the media", () => {
    const { w, players } = fixture();
    let retry;
    w.setTimeout = (callback) => {
        retry = callback;
        return 1;
    };
    w.clearTimeout = () => {};
    w.playerMode = 1;
    w.stbPlay("https://source.invalid/movie.m3u8", 20);
    w.video.currentTime = 37;
    w.video.readyState = 3;
    players[0].hasEnoughToStart = true;
    players[0].events.error(null, {
        details: "manifestParsingError",
        fatal: true,
        type: "network",
    });
    assert.equal(
        w.video.currentTime,
        0,
        "fixture models destroy resetting the media"
    );
    retry();
    assert.equal(players[1].config.startPosition, 37);
    w.stbStop();
});
for (const details of [
    ["manifestParsingError", "manifestParsingError"],
    ["levelParsingError", "levelParsingError"],
    ["manifestLoadError", "manifestLoadError", "manifestLoadError"],
    ["manifestParsingError", "manifestLoadError", "manifestParsingError"],
    ["manifestLoadError", "levelParsingError", "levelParsingError"],
    ["manifestLoadError", "manifestLoadError", "levelParsingError"],
]) {
    test(
        "HLS shares its outer retry budget without repeating parse recovery: " +
            details.join(", "),
        () => {
            const { w, players } = fixture();
            const timers = new Map();
            let sequence = 0;
            w.setTimeout = (callback) => {
                timers.set(++sequence, callback);
                return sequence;
            };
            w.clearTimeout = (id) => timers.delete(id);
            w.playerMode = 1;
            w.stbPlay("https://source.invalid/live.m3u8");
            for (let attempt = 0; attempt < details.length; attempt++) {
                const player = players.at(-1);
                // A successful manifest must not replenish the request's budget.
                player.events.manifest();
                const detail = details[attempt];
                const inEngineAttempts = detail.includes("Parsing") ? 1 : 3;
                for (let failure = 0; failure < inEngineAttempts; failure++) {
                    player.events.error(null, {
                        details: detail,
                        fatal: true,
                        type: "network",
                    });
                }
                assert.equal(player.destroyCalls, 1);
                if (attempt === details.length - 1) {
                    assert.equal(
                        timers.size,
                        0,
                        "exhausted request cannot reconnect"
                    );
                } else {
                    assert.equal(timers.size, 1);
                    const [id, callback] = timers.entries().next().value;
                    timers.delete(id);
                    callback();
                    assert.equal(players.length, attempt + 2);
                }
            }
            assert.equal(players.length, details.length);
            w.stbStop();
        }
    );
}
test("explicit A/V diagnostic forces the MP4 decoder and restores mute after end", () => {
    const { w, players, shakas } = fixture();
    w.playerMode = 2;
    w.sStreamMaxHeight = 360;
    w.video.muted = true;
    assert.equal(
        w.video.src,
        "",
        "No diagnostic request before explicit start"
    );
    assert.equal(w.__ottAvTest.start(), true);
    assert.equal(
        w.video.src,
        "https://mantra-basin-76mq.here.now/diagnostics/av-v1.mp4"
    );
    assert.equal(
        new URL(w.video.src, "https://player.test/f/lg/webos/").href,
        w.video.src,
        "Device entry routes must preserve the hosted HTTPS fixture"
    );
    assert.equal(w.video.muted, false);
    assert.equal(
        w.stbIsPlaying(),
        false,
        "diagnostic playback must not enter live catch-up on Pause"
    );
    assert.equal(w.playerMode, 2);
    assert.equal(players.length, 0);
    assert.equal(shakas.length, 0);
    for (const callback of [...w.video.listeners.ended]) callback();
    assert.equal(w.video.muted, true);
    assert.equal(w.__ottCoreBackend().current(), null);
});
test("hosted A/V network failure closes the diagnostic and restores mute", () => {
    const { w } = fixture();
    const messages = [];
    w.showShift = (text) => messages.push(text);
    w.video.muted = true;
    assert.equal(w.__ottAvTest.start(), true);
    w.video.error = { code: 2 };
    for (const callback of [...w.video.listeners.error]) callback();
    assert.equal(w.__ottCoreBackend().current(), null);
    assert.equal(w.video.muted, true);
    assert(messages.includes("Stream could not be played"));
});
test("A/V diagnostic Stop cannot restart and its deadline cannot replace a new channel", () => {
    const { w } = fixture();
    let deadline;
    w.setTimeout = (callback) => {
        deadline = callback;
        return 1;
    };
    w.clearTimeout = () => {};
    assert.equal(w.__ottAvTest.start(), true);
    const stale = deadline;
    w.stbStop();
    stale();
    assert.equal(w.__ottCoreBackend().current(), null);
    assert.equal(w.__ottAvTest.start(), true);
    const replaced = deadline;
    w.stbPlay("new-channel.mp4");
    replaced();
    assert.equal(w.video.src, "new-channel.mp4");
    w.stbStop();
});
test("A/V diagnostic is unavailable on an optional native engine without taking its decoder", () => {
    const { w } = fixture();
    w.__ottCoreTransport.configure({
        engine: () => assert.fail("should not open a test engine"),
    });
    assert.equal(w.__ottAvTest.start(), false);
});
test("A/V diagnostic does not persist the demo's temporary mute as the user's choice", () => {
    const { w } = fixture();
    w.ottplayDemoActive = true;
    w.video.muted = true;
    w._coreDemoMute = { media: w.video, muted: false };
    assert.equal(w.__ottAvTest.start(), true);
    w.__ottAvTest.stop();
    assert.equal(w.video.muted, false);
});
test("A/V diagnostic keeps normal mute and resume controls while Demo is selected", () => {
    const { w } = fixture();
    w.ottplayDemoActive = true;
    w.video.muted = true;
    w._coreDemoMute = { media: w.video, muted: false };
    assert.equal(w.__ottAvTest.start(), true);
    assert.equal(w.video.muted, false);
    assert.equal(
        w._coreDemoMute,
        null,
        "the transient decoder is not a silent demo"
    );
    w.stbPause();
    w.stbResume();
    assert.equal(
        w.video.muted,
        false,
        "resuming the diagnostic retains audible output"
    );
    w.stbToggleMute();
    assert.equal(w.video.muted, true);
    w.stbToggleMute();
    assert.equal(w.video.muted, false, "the user can unmute the diagnostic");
    w.__ottAvTest.stop();
    assert.equal(
        w.video.muted,
        false,
        "idle retains the original user mute choice"
    );
    w.stbPlay("https://demo.invalid/demo/pattern.mp4");
    assert.equal(w.video.muted, true, "ordinary demo playback is still silent");
    w.stbStop();
    assert.equal(w.video.muted, false);
});
test("Shaka DRM capability failure is terminal without claiming provider login is required", async () => {
    const { w, shakas } = fixture();
    const messages = [];
    w.showShift = (text) => messages.push(text);
    w.playerMode = 2;
    w.stbPlay("https://source.invalid/protected.mpd");
    shakas[0].attached.resolve();
    await tick();
    shakas[0].loaded.reject({ category: 6, code: 6001 });
    await tick();
    assert.equal(messages.pop(), "Stream could not be played");
    assert.equal(w.__ottStreamPolicy.snapshot().attempts, 0);
    w.stbStop();
    shakas[0].destroyed.resolve();
    await tick();
});
test("engine diagnostics identify attached ownership, not a mode preference", () => {
    const { w, players } = fixture();
    w.playerMode = 1;
    w.stbPlay("first.m3u8");
    const first = w.__ottCoreBackend().current();
    assert.equal(first.diagnosticEngine(), "hls.js");
    players[0].media = null;
    assert.equal(first.diagnosticEngine(), null, "detached HLS is unavailable");
    players[0].media = w.video;
    const fatal = { fatal: true, type: "media" };
    players[0].events.error(null, fatal);
    players[0].events.error(null, fatal);
    assert.equal(w.playerMode, 1, "saved HLS preference is unchanged");
    assert.equal(
        first.diagnosticEngine(),
        "html5",
        "actual fallback is visible"
    );
    w.stbPlay("replacement.m3u8");
    assert.equal(first.diagnosticEngine(), null);
    const replacement = w.__ottCoreBackend().current();
    assert.equal(replacement.diagnosticEngine(), "hls.js");
    replacement.suspend();
    assert.equal(replacement.diagnosticEngine(), null);
    replacement.resume();
    assert.equal(replacement.diagnosticEngine(), "hls.js");
    w.stbStop();
    assert.equal(replacement.diagnosticEngine(), null);
    w.Hls.isSupported = () => false;
    w.stbPlay("native.m3u8");
    assert.equal(w.__ottCoreBackend().current().diagnosticEngine(), "html5");
    w.stbStop();
});
test("HLS diagnostics precede fatal teardown and ignore retired callbacks", () => {
    const { w, players } = fixture();
    w.playerMode = 1;
    w.stbPlay("https://source.invalid/live.m3u8");
    const player = players[0];
    const observations = [];
    const fatal = { fatal: true, response: { code: 403 }, type: "network" };
    w.__ottPerfSink = {
        changed() {},
        hlsError(hls, data) {
            observations.push([hls, data, hls.destroyCalls]);
        },
        recovery() {},
    };
    assert.equal(player.__ottPerfErrors, true);
    player.events.error(null, fatal);
    assert.deepEqual(observations, [[player, fatal, 0]]);
    assert.equal(player.destroyCalls, 1);
    player.events.error(null, fatal);
    assert.equal(observations.length, 1);
    w.stbStop();
});
test("throwing or reentrant diagnostic sinks cannot break HLS ownership", () => {
    for (const replace of [false, true]) {
        const { w, players } = fixture();
        w.playerMode = 1;
        w.stbPlay("https://source.invalid/live.m3u8");
        w.__ottPerfSink = {
            changed() {},
            hlsError() {
                if (replace)
                    w.stbPlay("https://source.invalid/replacement.m3u8");
                else throw Error("diagnostic failure");
            },
            recovery() {},
        };
        players[0].events.error(null, {
            fatal: true,
            response: { code: 403 },
            type: "network",
        });
        assert.equal(players[0].destroyCalls, 1);
        if (replace) {
            assert.equal(players[1].destroyCalls, 0);
            assert.equal(
                w.__ottCoreBackend().current().diagnosticAttempt().fatalErrors,
                0
            );
        }
        w.stbStop();
    }
});
test("HLS level callbacks cannot recover or restart a replaced owner", () => {
    for (const hook of ["autoLevelCapping", "removeLevel", "currentLevel"]) {
        const { w, players } = fixture();
        w.playerMode = 1;
        w.stbPlay("https://source.invalid/live.m3u8");
        const old = players[0];
        old.levels = [{}, {}];
        let removed = 0;
        let recovered = 0;
        const replace = () =>
            w.stbPlay("https://source.invalid/replacement.m3u8");
        old.removeLevel = () => {
            removed++;
            if (hook === "removeLevel") replace();
        };
        old.recoverMediaError = () => recovered++;
        if (hook === "currentLevel") old.removeLevel = undefined;
        if (hook !== "removeLevel")
            Object.defineProperty(old, hook, { set: replace });
        const loads = old.startLoads.length;
        old.events.error(null, { fatal: true, level: 1, type: "media" });
        assert.equal(players.length, 2, hook);
        assert.equal(old.destroyCalls, 1, hook);
        assert.equal(old.startLoads.length, loads, hook);
        assert.equal(recovered, 0, hook);
        assert.equal(removed, hook === "removeLevel" ? 1 : 0, hook);
        assert.equal(players[1].destroyCalls, 0, hook);
        assert.equal(
            w.__ottCoreBackend().current().diagnosticAttempt().fatalErrors,
            0,
            hook
        );
        w.stbStop();
    }
});
test("attempt diagnostics retain fallback and retry history on the same handle", () => {
    const { w, players } = fixture();
    const timers = new Map();
    let serial = 0;
    w.setTimeout = (callback) => {
        timers.set(++serial, callback);
        return serial;
    };
    w.clearTimeout = (id) => timers.delete(id);
    w.playerMode = 1;
    w.stbPlay("https://source.invalid/live.m3u8");
    const handle = w.__ottCoreBackend().current();
    const initial = JSON.parse(JSON.stringify(handle.diagnosticAttempt()));
    assert.equal(initial.engineStarts, 1);
    assert.equal(initial.streamRetries, 0);
    assert.equal(initial.nativeFallbacks, 0);
    assert.equal(initial.fatalErrors, 0);
    const fatal = { fatal: true, type: "media" };
    players[0].events.error(null, fatal);
    players[0].events.error(null, fatal);
    assert.equal(handle.diagnosticEngine(), "html5");
    w.video.error = { code: 2 };
    for (const callback of w.video.listeners.error) callback();
    for (let i = 0; i < 2; i++) {
        assert.equal(timers.size, 1);
        const [id, callback] = timers.entries().next().value;
        timers.delete(id);
        callback();
    }
    assert.equal(w.__ottCoreBackend().current(), handle);
    assert.equal(handle.diagnosticEngine(), "hls.js");
    const after = JSON.parse(JSON.stringify(handle.diagnosticAttempt()));
    assert.deepEqual(after, {
        attachment: initial.attachment,
        engineStarts: 3,
        fatalErrors: 2,
        nativeFallbacks: 1,
        streamRetries: 1,
    });
    after.engineStarts = 0;
    assert.equal(
        handle.diagnosticAttempt().engineStarts,
        3,
        "snapshot is a copy"
    );
    handle.suspend();
    assert.equal(handle.diagnosticAttempt(), null);
    handle.resume();
    const resumed = handle.diagnosticAttempt();
    assert(
        resumed.attachment > initial.attachment,
        "same handle reattachment is visible"
    );
    assert.equal(resumed.engineStarts, 1);
    players[0].events.error(null, fatal);
    assert.equal(
        handle.diagnosticAttempt().fatalErrors,
        0,
        "stale callback cannot affect replacement"
    );
    w.stbPlay("https://source.invalid/next.m3u8");
    assert.equal(handle.diagnosticAttempt(), null);
    assert.equal(
        w.__ottCoreBackend().current().diagnosticAttempt().engineStarts,
        1
    );
    w.stbStop();
});
test("fallback and return between samples remain visible after EOF", () => {
    const { w, players } = fixture();
    const timers = new Map();
    let serial = 0;
    w.setTimeout = (callback) => {
        timers.set(++serial, callback);
        return serial;
    };
    w.clearTimeout = (id) => timers.delete(id);
    w.playerMode = 1;
    w.stbPlay("https://source.invalid/live.m3u8");
    const backend = w.__ottCoreBackend(),
        handle = backend.current();
    const initial = handle.diagnosticAttempt();
    // No diagnostic read is made between the first frame and final EOF.
    for (let i = 0; i < 2; i++)
        players[0].events.error(null, { fatal: true, type: "media" });
    w.video.error = { code: 2 };
    for (const callback of w.video.listeners.error) callback();
    for (let i = 0; i < 2; i++) {
        const [id, callback] = timers.entries().next().value;
        timers.delete(id);
        callback();
    }
    w.video.error = null;
    w.video.readyState = 4;
    w.video.paused = false;
    for (const callback of w.video.listeners.playing) callback();
    for (const callback of w.video.listeners.ended) callback();
    const final = backend.lastAttempt();
    assert.equal(final.handleId, handle.id);
    assert.equal(final.attachment, initial.attachment);
    assert.equal(final.reason, "ended");
    assert.equal(final.engineStarts, 3);
    assert.equal(final.streamRetries, 1);
    assert.equal(final.nativeFallbacks, 1);
    assert.equal(final.fatalErrors, 2);
    w.stbStop();
    assert.equal(backend.lastAttempt().reason, "ended");
});
test("unattached and failed engines never borrow a prior native identity", async () => {
    const { w, players, shakas } = fixture();
    w.stbPlay("first.mp4");
    let ready;
    w.__ottCoreTransport.configure({
        prepareSource(_url, callback) {
            ready = callback;
            return () => {};
        },
    });
    w.stbPlay("pending.m3u8");
    const pending = w.__ottCoreBackend().current();
    assert.equal(pending.diagnosticEngine(), null);
    w.stbStop();
    ready("stale.mp4");
    assert.equal(pending.diagnosticEngine(), null);
    w.__ottCoreTransport.configure({ prepareSource: null });
    w.playerMode = 1;
    w.stbPlay("fatal.m3u8");
    const failed = w.__ottCoreBackend().current();
    players[0].events.error(null, { fatal: true, type: "other" });
    assert.equal(failed.diagnosticEngine(), null);
    assert.equal(failed.snapshot().phase, "stopped");
    assert.equal(w.__ottCoreBackend().current(), null);
    w.playerMode = 2;
    w.__ottNativeRuntime = true;
    w.shaka.Player.prototype.attach = function (media) {
        return this.attached.promise.then(() => {
            this.media = media;
        });
    };
    w.stbPlay("pending.mpd");
    const shaka = w.__ottCoreBackend().current();
    assert.equal(
        shaka.diagnosticEngine(),
        null,
        "construction is not attachment"
    );
    shakas[0].attached.resolve();
    await tick();
    assert.equal(shaka.diagnosticEngine(), "shaka");
    w.stbStop();
    assert.equal(shaka.diagnosticEngine(), null);
});
test("native retry clears engine ownership while the next source is unresolved", () => {
    const { w } = fixture();
    const timers = new Map();
    let serial = 0,
        ready;
    w.setTimeout = (callback) => {
        timers.set(++serial, callback);
        return serial;
    };
    w.clearTimeout = (id) => timers.delete(id);
    w.playerMode = 0;
    w.stbPlay("https://source.invalid/live.mp4");
    const handle = w.__ottCoreBackend().current();
    assert.equal(handle.diagnosticEngine(), "html5");
    w.__ottCoreTransport.configure({
        prepareSource(_url, callback) {
            ready = callback;
            return () => {};
        },
    });
    w.video.error = { code: 2 };
    for (const callback of w.video.listeners.error) callback();
    // The first task classifies the native failure; the second starts the retry.
    for (let i = 0; i < 2; i++) {
        assert.equal(timers.size, 1);
        const [id, callback] = timers.entries().next().value;
        timers.delete(id);
        callback();
    }
    assert.equal(w.__ottCoreBackend().current(), handle);
    assert.equal(w.__ottStreamPolicy.snapshot().attempts, 1);
    assert.equal(w.video.src, "");
    assert.equal(
        handle.diagnosticEngine(),
        null,
        "detached native is not active"
    );
    w.video.error = null;
    ready("https://source.invalid/recovered.mp4");
    assert.equal(handle.diagnosticEngine(), "html5");
    w.stbStop();
});
test("screen suspension cancels a queued stream retry before resuming a fresh lease", () => {
    const { w, players } = fixture();
    const timers = new Map();
    let serial = 0;
    w.setTimeout = (callback) => {
        timers.set(++serial, callback);
        return serial;
    };
    w.clearTimeout = (id) => timers.delete(id);
    w.playerMode = 1;
    w.stbPlay("https://source.invalid/live.m3u8");
    const handle = w.__ottCoreBackend().current();
    players[0].events.error(null, {
        details: "manifestParsingError",
        fatal: true,
        type: "network",
    });
    assert.equal(timers.size, 1);
    const stale = timers.values().next().value;
    handle.suspend();
    assert.equal(timers.size, 0);
    assert.equal(handle.diagnosticEngine(), null);
    stale();
    assert.equal(players.length, 1, "suspended transport cannot be recreated");
    handle.resume();
    assert.equal(players.length, 2);
    assert.equal(handle.diagnosticEngine(), "hls.js");
    stale();
    assert.equal(
        players.length,
        2,
        "old recovery cannot replace the new lease"
    );
    w.stbStop();
});
test("lazy PiP keeps its owning lease through engine readiness and releases the decoder", () => {
    const { w, players } = fixture();
    const callbacks = [];
    w.playerMode = 1;
    w.__ottLoadMediaEngine = (engine, callback) => callbacks.push(callback);
    w.stbPlayPip("https://fixture.test/pip.m3u8");
    const handle = w.__ottCoreBackend().current("pip");
    assert.equal(callbacks.length, 1);
    callbacks[0](true);
    assert.equal(
        handle.diagnosticEngine(),
        "hls.js",
        "loaded engine still belongs to original PiP lease"
    );
    players[0].events.manifest();
    assert.equal(w.videoPip.paused, false);
    w.stbStopPip();
    assert.equal(players[0].destroyCalls, 1);
    assert.equal(w.videoPip.paused, true);
    assert.equal(w.videoPip.src, "");
    assert.equal(w.videoPip.loadCalls, 1);
    callbacks[0](true);
    assert.equal(
        players.length,
        1,
        "late readiness cannot restore stopped PiP"
    );
});
test("stopping pending lazy PiP invalidates readiness before engine construction", () => {
    const { w, players } = fixture();
    let ready;
    w.playerMode = 1;
    w.__ottLoadMediaEngine = (_engine, callback) => {
        ready = callback;
    };
    w.stbPlayPip("https://fixture.test/pip.m3u8");
    w.stbStopPip();
    ready(true);
    assert.equal(players.length, 0);
    assert.equal(w.videoPip.paused, true);
    assert.equal(w.videoPip.src, "");
});

test("PiP diagnostics use their own attached engine and clear on stop", () => {
    const { w } = fixture();
    w.playerMode = 1;
    w.stbPlay("main.m3u8");
    w.playerMode = 0;
    w.stbPlayPip("pip.mp4");
    const main = w.__ottCoreBackend().current();
    const pip = w.__ottCoreBackend().current("pip");
    assert.equal(main.diagnosticEngine(), "hls.js");
    assert.equal(pip.diagnosticEngine(), "html5");
    w.stbStopPip();
    assert.equal(pip.diagnosticEngine(), null);
    assert.equal(main.diagnosticEngine(), "hls.js");
    w.stbStop();
});

test("shared HLS policy uses measured RAM, source identity and saved seconds without changing retries", () => {
    const { w, players } = fixture();
    w.navigator = { deviceMemory: 2, userAgent: "Android" };
    w.playerMode = 1;
    w.stbGetItem = (key) => (key === "sBufSize" ? "7" : null);
    w.stbPlay("https://engine/ace/manifest.m3u8?id=abc");
    const config = players[0].config;
    assert.equal(config.maxBufferLength, 7);
    assert.equal(config.maxBufferSize, 32000000);
    assert.equal(config.backBufferLength, 15);
    assert.equal(config.maxMaxBufferLength, 120);
    assert.equal(config.fragLoadingMaxRetry, undefined);
    assert.equal(w.__ottBufferPolicy.profile, "low-memory/acestream");
    assert.equal(JSON.stringify(w.__ottBufferPolicy).includes("abc"), false);
    w.stbStop();
});
test("main and in-page HLS PiP use the same saved buffer preference on each new stream", () => {
    for (const [stored, expected] of [
        ["7", 7],
        ["120", 120],
        ["0", 30],
        [null, 30],
        ["300", 30],
        ["invalid", 30],
    ]) {
        const { w, players } = fixture();
        w.playerMode = 1;
        w.stbGetItem = (key) => (key === "sBufSize" ? stored : null);
        w.stbPlay("https://fixture.invalid/main.m3u8");
        w.stbPlayPip("https://fixture.invalid/pip.m3u8");
        assert.equal(players.length, 2);
        assert.equal(
            players[0].config.maxBufferLength,
            expected,
            String(stored)
        );
        assert.equal(
            players[1].config.maxBufferLength,
            expected,
            String(stored)
        );
        assert.equal(players[1].config.backBufferLength, 0);
        w.stbStopPip();
        w.stbStop();
    }
});
test("in-page HLS PiP reads changed saved seconds and tolerates unavailable storage", () => {
    const { w, players } = fixture();
    w.playerMode = 1;
    let stored = "7";
    w.stbGetItem = (key) => (key === "sBufSize" ? stored : null);
    w.stbPlayPip("https://fixture.invalid/first.m3u8");
    assert.equal(players[0].config.maxBufferLength, 7);
    w.stbStopPip();
    stored = "0";
    w.stbPlayPip("https://fixture.invalid/second.m3u8");
    assert.equal(players[1].config.maxBufferLength, 30);
    w.stbStopPip();
    w.stbGetItem = () => {
        throw new Error("unavailable");
    };
    w.stbPlayPip("https://fixture.invalid/third.m3u8");
    assert.equal(players[2].config.maxBufferLength, 30);
    w.stbStopPip();
    delete w.stbGetItem;
    w.stbPlayPip("https://fixture.invalid/fourth.m3u8");
    assert.equal(players[3].config.maxBufferLength, 30);
    w.stbStopPip();
});
test("shared Shaka policy applies on Android with no RAM hint and preserves quality settings", () => {
    const { w, shakas } = fixture();
    w.ott_device = "android";
    w.playerMode = 2;
    w.sStreamMaxHeight = 720;
    w.stbPlay("https://media/live.mpd");
    assert.equal(shakas[0].config.streaming.bufferingGoal, 30);
    assert.equal(shakas[0].config.streaming.bufferBehind, 30);
    assert.equal(shakas[0].config.streaming.rebufferingGoal, 2);
    assert.equal(shakas[0].config.restrictions.maxHeight, 720);
    w.stbStop();
});

test("repeated Play on ready media does not create a feedback deadline; pause and resume does", () => {
    const { w } = fixture();
    const timers = new Map();
    let serial = 0;
    const label = {
            addEventListener() {},
            removeAttribute() {},
            removeEventListener() {},
            setAttribute() {},
            style: {},
            textContent: "",
        },
        spinner = { style: {} };
    w.document.getElementById = (id) =>
        ({ buffering: spinner, video_res: label })[id] || null;
    w.setTimeout = (fn, ms) => {
        timers.set(++serial, { fn, ms });
        return serial;
    };
    w.clearTimeout = (id) => timers.delete(id);
    vm.runInContext(
        ts.transpileModule(
            fs.readFileSync(
                path.join(root, "src/core/playback-feedback.ts"),
                "utf8"
            ),
            {
                compilerOptions: { target: ts.ScriptTarget.ES5 },
            }
        ).outputText,
        w
    );
    w.__ottPlaybackFeedback.bind(w.video);
    w.playerMode = 0;
    w.stbPlay("https://fixture.test/film.mp4");
    w.video.readyState = 4;
    w.video.paused = false;
    w.video.currentTime = 0;
    for (const callback of w.video.listeners.loadstart) callback();
    w.video.currentTime = 1;
    for (const callback of w.video.listeners.timeupdate) callback();
    assert.equal(timers.size, 0);
    w.stbResume();
    w.stbResume();
    assert.equal(
        timers.size,
        0,
        "ready Play must not await a playing event that will not fire"
    );
    assert.equal(label.textContent, "");
    w.stbPause();
    w.stbResume();
    assert.equal(
        [...timers.values()].filter((timer) => timer.ms >= 30000).length,
        1,
        "a real pause/resume arms one startup deadline"
    );
    const deadline = [...timers.keys()];
    w.stbResume();
    assert.deepEqual(
        [...timers.keys()],
        deadline,
        "pending wait is not extended by repeated Play"
    );
    w.stbStop();
    assert.equal(timers.size, 0);
});

test("constructor buffer policy is captured before source loading and isolated per HLS lane", () => {
    const { w, players } = fixture();
    w.playerMode = 1;
    const load = w.Hls.prototype.loadSource;
    w.Hls.prototype.loadSource = function (url) {
        this.config.maxMaxBufferLength = 5.005;
        load.call(this, url);
    };
    w.stbPlay("main.m3u8");
    w.stbPlayPip("pip.m3u8");
    const backend = w.__ottCoreBackend();
    const main = backend.current(),
        pip = backend.current("pip");
    const mainSnapshot = main.diagnosticMedia();
    const pipSnapshot = pip.diagnosticMedia();
    assert.equal(mainSnapshot.hls, players[0]);
    assert.equal(pipSnapshot.hls, players[1]);
    assert.equal(mainSnapshot.hls.config.maxMaxBufferLength, 5.005);
    assert.equal(pipSnapshot.hls.config.maxMaxBufferLength, 5.005);
    assert(
        mainSnapshot.initialHlsBufferPolicy.max_max_buffer_length_seconds >
            5.005
    );
    assert(
        pipSnapshot.initialHlsBufferPolicy.max_max_buffer_length_seconds > 5.005
    );
    mainSnapshot.initialHlsBufferPolicy.max_max_buffer_length_seconds = 999;
    assert.notEqual(
        main.diagnosticMedia().initialHlsBufferPolicy
            .max_max_buffer_length_seconds,
        999
    );
    assert.notEqual(
        pip.diagnosticMedia().initialHlsBufferPolicy
            .max_max_buffer_length_seconds,
        999
    );
    pip.suspend();
    assert.equal(pip.diagnosticMedia(), null);
    assert.equal(main.diagnosticMedia().hls, players[0]);
    main.suspend();
    assert.equal(main.diagnosticMedia(), null);
    main.resume();
    const replacement = main.diagnosticMedia();
    assert.notEqual(replacement.hls, players[0]);
    assert(
        replacement.initialHlsBufferPolicy.max_max_buffer_length_seconds > 5.005
    );
});

test("pending Shaka sourceopen retains its media resource until owned teardown settles", async () => {
    for (const modern of [false, true]) {
        const { w, shakas } = fixture();
        w.playerMode = 2;
        if (modern) w.__ottNativeRuntime = true;
        w.shaka.Player.prototype.load = function (url, position) {
            this.sourceOpened = deferred();
            this.url = url;
            this.position = position;
            this.resource = "blob:owned-" + shakas.length;
            this.media.src = this.resource;
            return this.sourceOpened.promise;
        };
        w.shaka.Player.prototype.destroy = function () {
            this.destroyCalls++;
            return this.sourceOpened.promise.then(() => {
                this.media.removeAttribute("src");
                this.media.load();
                this.media = null;
            });
        };
        w.stbPlay("https://synthetic.invalid/first.mpd");
        if (modern) {
            shakas[0].attached.resolve();
            await tick();
        }
        const old = shakas[0],
            resource = old.resource,
            loads = w.video.loadCalls;
        w.stbStop();
        assert.equal(w.video.paused, true);
        assert.equal(old.destroyCalls, 1);
        assert.equal(
            w.video.src,
            resource,
            "Stop must not detach pending Shaka MediaSource before sourceopen"
        );
        assert.equal(
            w.video.loadCalls,
            loads,
            "Stop must not invoke HTML reset while Shaka owns pending resource"
        );
        w.stbPlay("https://synthetic.invalid/superseded.mpd", 5);
        w.stbPlay("https://synthetic.invalid/latest.mpd", 17);
        assert.equal(
            shakas.length,
            1,
            "no new engine may attach before old release"
        );
        old.sourceOpened.resolve();
        await tick();
        await tick();
        assert.equal(
            shakas.length,
            2,
            "only latest queued source starts after old destroy settles"
        );
        const current = shakas[1];
        if (modern) {
            current.attached.resolve();
            await tick();
        }
        assert.equal(current.url, "https://synthetic.invalid/latest.mpd");
        assert.equal(current.position, 17);
        assert.equal(w.player, current);
        assert.equal(
            w.video.playCalls,
            0,
            "obsolete load resolution cannot play"
        );
        assert.equal(
            w.video.loadCalls,
            loads + 1,
            "old Shaka owns exactly one release reset"
        );
        current.sourceOpened.resolve();
        await tick();
        assert.equal(w.video.playCalls, 1);
        w.stbStop();
        await tick();
        console.log(
            "PASS pending Shaka sourceopen ownership/stop/latest generation/position/stale-load fence modern=" +
                modern
        );
    }
});

for (const modern of [false, true]) {
    for (const release of [false, true]) {
        test(
            "rejected Shaka retirement gates replacement until proven release modern=" +
                modern +
                " release=" +
                release,
            async () => {
                const { w, shakas, errors } = fixture();
                w.playerMode = 2;
                if (modern) w.__ottNativeRuntime = true;
                w.shaka.Player.prototype.load = function (url) {
                    this.url = url;
                    this.media.src = "blob:owned-" + shakas.length;
                    return this.loaded.promise;
                };
                w.stbPlay("https://synthetic.invalid/old.mpd");
                const old = shakas[0],
                    media = w.video;
                if (modern) {
                    old.attached.resolve();
                    await tick();
                }
                old.loaded.resolve();
                await tick();
                const resource = media.src,
                    loads = media.loadCalls;
                w.stbStop();
                w.stbPlay("https://synthetic.invalid/superseded.mpd", 5);
                w.stbPlay("https://synthetic.invalid/latest.mpd", 17);
                assert.equal(shakas.length, 1);
                assert.equal(media.src, resource);
                assert.equal(media.loadCalls, loads);
                if (release) old.media = null;
                const failure = new Error("Actual rejected teardown");
                old.destroyed.reject(failure);
                await tick();
                await tick();
                assert.equal(
                    old.destroyCalls,
                    1,
                    "DESTROYED player is never retried"
                );
                assert(
                    errors.some((row) => row.includes(failure)),
                    "original error retained"
                );
                if (!release) {
                    assert.equal(
                        shakas.length,
                        1,
                        "owned media blocks queued replacement"
                    );
                    assert.equal(media.src, resource);
                    assert.equal(media.loadCalls, loads);
                    assert.equal(w._coreShakaTeardown.error, failure);
                    w.stbPlay("https://synthetic.invalid/another.mpd");
                    w.stbStop();
                    assert.equal(shakas.length, 1);
                    assert.equal(old.destroyCalls, 1);
                    assert.equal(media.src, resource);
                } else {
                    assert.equal(
                        shakas.length,
                        2,
                        "only latest queued source starts"
                    );
                    assert.equal(
                        media.loadCalls,
                        loads + 1,
                        "released residual resource reset once"
                    );
                    const next = shakas[1];
                    if (modern) {
                        next.attached.resolve();
                        await tick();
                    }
                    assert.equal(
                        next.url,
                        "https://synthetic.invalid/latest.mpd"
                    );
                    assert.equal(w.player, next);
                    assert.equal(media.src, "blob:owned-2");
                    assert.equal(w._coreShakaTeardown, null);
                    assert.equal(
                        media.playCalls,
                        1,
                        "new load does not play early"
                    );
                    next.loaded.resolve();
                    await tick();
                    assert.equal(media.playCalls, 2);
                    assert.equal(
                        media.src,
                        "blob:owned-2",
                        "late old callback cannot clear replacement"
                    );
                }
            }
        );
    }
}
for (const problem of [
    "unknown-owner",
    "foreign-source",
    "reset-failure",
    "attribute-cleared",
]) {
    test("rejected Shaka retirement preserves " + problem, async () => {
        const { w, shakas } = fixture();
        w.playerMode = 2;
        w.shaka.Player.prototype.load = function () {
            this.media.src = "blob:retired";
            return this.loaded.promise;
        };
        w.stbPlay("https://synthetic.invalid/old.mpd");
        const old = shakas[0],
            media = w.video;
        old.loaded.resolve();
        await tick();
        w.stbStop();
        w.stbPlay("https://synthetic.invalid/new.mpd");
        if (problem === "unknown-owner")
            old.getMediaElement = () => {
                throw new Error("owner unknown");
            };
        else old.media = null;
        if (problem === "foreign-source") media.src = "blob:foreign";
        if (problem === "reset-failure")
            media.load = () => {
                throw new Error("reset failed");
            };
        if (problem === "attribute-cleared") media.removeAttribute("src");
        const before = media.src;
        old.destroyed.reject(new Error("destroy failed"));
        await tick();
        await tick();
        assert.equal(shakas.length, problem === "attribute-cleared" ? 2 : 1);
        assert.equal(!!w._coreShakaTeardown, problem !== "attribute-cleared");
        assert.equal(old.destroyCalls, 1);
        if (problem === "attribute-cleared") assert.equal(media.loadCalls, 1);
        else if (problem !== "reset-failure") assert.equal(media.src, before);
    });
}
test("synchronous destroy reentry cannot attach before retirement admission", async () => {
    const { w, shakas } = fixture();
    w.playerMode = 2;
    w.shaka.Player.prototype.load = function (url) {
        this.url = url;
        this.media.src = "blob:sync-" + shakas.length;
        return this.loaded.promise;
    };
    w.stbPlay("https://synthetic.invalid/old.mpd");
    const old = shakas[0];
    old.loaded.resolve();
    await tick();
    old.destroy = function () {
        this.destroyCalls++;
        w.stbPlay("https://synthetic.invalid/reentrant.mpd");
        assert.equal(shakas.length, 1);
        return this.destroyed.promise;
    };
    w.stbStop();
    assert.equal(shakas.length, 1);
    old.media = null;
    old.destroyed.reject(new Error("released after reentry"));
    await tick();
    await tick();
    assert.equal(shakas.length, 2);
    assert.equal(shakas[1].url, "https://synthetic.invalid/reentrant.mpd");
    assert.equal(old.destroyCalls, 1);
});

test("synchronous replacement during destroy retains the newer queued generation", async () => {
    const { w, shakas } = fixture();
    w.playerMode = 2;
    w.shaka.Player.prototype.load = function (url) {
        this.url = url;
        this.media.src = "blob:generation-" + shakas.length;
        return this.loaded.promise;
    };
    w.stbPlay("https://synthetic.invalid/old.mpd");
    const old = shakas[0];
    old.loaded.resolve();
    await tick();
    old.destroy = function () {
        this.destroyCalls++;
        w.stbPlay("https://synthetic.invalid/newer.mpd");
        return this.destroyed.promise;
    };
    w.stbPlay("https://synthetic.invalid/obsolete.mpd");
    assert.equal(shakas.length, 1);
    old.media = null;
    old.destroyed.reject(new Error("release"));
    await tick();
    await tick();
    assert.equal(shakas.length, 2);
    assert.equal(shakas[1].url, "https://synthetic.invalid/newer.mpd");
});

test("synchronous destroy failure remains blocked even with a detached getter", async () => {
    const { w, shakas } = fixture();
    w.playerMode = 2;
    w.shaka.Player.prototype.load = function () {
        this.media.src = "blob:sync-failure";
        return this.loaded.promise;
    };
    w.stbPlay("https://synthetic.invalid/old.mpd");
    const old = shakas[0],
        media = w.video;
    old.loaded.resolve();
    await tick();
    const failure = new Error("synchronous failure");
    old.destroy = function () {
        this.destroyCalls++;
        this.media = null;
        throw failure;
    };
    w.stbStop();
    w.stbPlay("https://synthetic.invalid/new.mpd");
    assert.equal(old.destroyCalls, 1);
    assert.equal(shakas.length, 1);
    assert.equal(media.src, "blob:sync-failure");
    assert.equal(media.loadCalls, 0);
    assert.equal(w._coreShakaTeardown.error, failure);
});

for (const outcome of ["fulfilled", "rejected"]) {
    for (const timing of ["delayed", "persistent"]) {
        test(
            "released Shaka tolerates " +
                timing +
                " reported old URL after " +
                outcome +
                " reset",
            async () => {
                const { w, shakas } = fixture();
                w.playerMode = 2;
                w.shaka.Player.prototype.load = function (url) {
                    this.url = url;
                    this.media.src = "blob:resource-" + shakas.length;
                    return this.loaded.promise;
                };
                w.stbPlay("https://synthetic.invalid/old.mpd");
                const old = shakas[0],
                    media = w.video;
                old.loaded.resolve();
                await tick();
                const resource = media.currentSrc;
                let clearReported;
                media.load = function () {
                    this.loadCalls++;
                    this.networkState = 0;
                    assert.equal(this.getAttribute("src"), null);
                    // WebKit may report this URL even though there is no resource.
                    this.selectedResource = resource;
                    if (timing === "delayed")
                        clearReported = () => {
                            if (this.selectedResource === resource)
                                this.selectedResource = "";
                        };
                };
                w.stbStop();
                if (outcome === "fulfilled") old.destroyed.resolve();
                else {
                    old.media = null;
                    old.destroyed.reject(new Error("released before failure"));
                }
                await tick();
                await tick();
                assert.equal(media.getAttribute("src"), null);
                assert.equal(media.networkState, 0);
                assert.equal(media.currentSrc, resource);
                assert.equal(
                    w._coreShakaTeardown,
                    null,
                    "reported URL is not ownership"
                );
                assert.equal(
                    media.loadCalls,
                    1,
                    "completed reset is not repeated"
                );
                w.stbPlay("https://synthetic.invalid/next.mpd");
                assert.equal(shakas.length, 2);
                assert.equal(
                    shakas[1].url,
                    "https://synthetic.invalid/next.mpd"
                );
                if (clearReported) clearReported();
                assert.equal(media.currentSrc, "blob:resource-2");
            }
        );
    }
}
test("released Shaka rejects a foreign reported URL after reset", async () => {
    const { w, shakas } = fixture();
    w.playerMode = 2;
    w.shaka.Player.prototype.load = function () {
        this.media.src = "blob:original";
        return this.loaded.promise;
    };
    w.stbPlay("https://synthetic.invalid/old.mpd");
    const old = shakas[0],
        media = w.video;
    old.loaded.resolve();
    await tick();
    w.stbStop();
    old.media = null;
    media.load = function () {
        this.loadCalls++;
        this.networkState = 0;
        this.selectedResource = "blob:foreign";
    };
    w.stbPlay("https://synthetic.invalid/new.mpd");
    old.destroyed.reject(new Error("released"));
    await tick();
    await tick();
    assert.equal(shakas.length, 1);
    assert(w._coreShakaTeardown);
    assert.equal(media.currentSrc, "blob:foreign");
});
function installShakaTracks(player, modern = true) {
    player.audios = [
        { active: true, id: 10, label: "English", language: "en", roles: [] },
        { active: false, id: 20, label: "French", language: "fr", roles: [] },
    ];
    player.texts = [
        { active: true, id: 50, label: "English", language: "en" },
        { active: false, id: 60, label: "French", language: "fr" },
    ];
    player.trackWrites = [];
    player.visible = true;
    player.getTextTracks = () => player.texts;
    player.selectTextTrack = (track) => {
        player.trackWrites.push(["text", track?.id ?? null]);
        player.texts.forEach((item) => {
            item.active = item === track;
        });
        player.events.textchanged?.();
    };
    const selectAudio = (track) => {
        player.trackWrites.push(["audio", track.language]);
        player.audios.forEach((item) => {
            item.active = modern
                ? item === track
                : item.language === track.language;
        });
        // Shaka may automatically enable forced subtitles on an audio change.
        player.texts[0].active = true;
        player.events.variantchanged?.();
    };
    if (modern) {
        player.getAudioTracks = () => player.audios;
        player.selectAudioTrack = selectAudio;
    } else {
        player.getVariantTracks = () => player.audios;
        player.selectAudioLanguage = (language) =>
            selectAudio(
                player.audios.find((track) => track.language === language)
            );
        player.isTextTrackVisible = () => player.visible;
        player.setTextTrackVisibility = (value) => {
            player.visible = value;
            player.trackWrites.push(["visible", value]);
            player.events.texttrackvisibility?.();
        };
    }
    player.selectVariantTrack = () => {
        throw new Error("must preserve video quality and ABR");
    };
}
for (const [modern, nativeIds] of [
    [true, true],
    [true, false],
    [false, true],
]) {
    test(
        "Shaka tracks preserve explicit Off/audio and owner lifetime: modern=" +
            modern +
            " nativeIds=" +
            nativeIds,
        async () => {
            const { w, shakas, boxes } = fixture();
            const preferences = [];
            w.applyChannelPreference = (key, callback) => {
                if (key === "aAudios" || key === "aSubs")
                    preferences.push([key, callback]);
            };
            w.playerMode = 2;
            w.__ottNativeRuntime = modern;
            w.stbPlay("tracks.mpd");
            const player = shakas[0];
            installShakaTracks(player, modern);
            if (!nativeIds)
                player.audios.forEach((track) => {
                    delete track.id;
                });
            if (modern) {
                player.attached.resolve();
                await tick();
            }
            if (!modern) {
                // The first quality is inactive; the active duplicate must still select English.
                player.audios.unshift({
                    ...player.audios[0],
                    active: false,
                    height: 360,
                    id: 11,
                });
            }
            player.loaded.resolve();
            await tick();
            const owner = w.getCoreMediaBackend().current();
            assert.equal(owner.tracks("audio").length, 2);
            assert.equal(
                owner.tracks("audio").filter((track) => track.selected).length,
                1
            );
            assert.equal(w.stbAudioTracksExists(), true);
            w.stbToggleSubtitle();
            boxes.at(-1)[2](0);
            assert.equal(
                modern
                    ? player.texts.some((track) => track.active)
                    : player.visible,
                false
            );
            w.stbToggleAudioTrack();
            boxes.at(-1)[2](1);
            assert.equal(owner.__ottExplicitTracks.audio, 2);
            assert.equal(
                player.audios.find((track) => track.language === "fr").active,
                true
            );
            assert.equal(
                modern
                    ? player.texts.some((track) => track.active)
                    : player.visible,
                false
            );
            // Reordering/late additions retain stable menu IDs and an explicit audio index of 1.
            player.audios.reverse();
            player.events.trackschanged();
            for (const [key, callback] of preferences)
                callback(key === "aAudios" ? 0 : 1);
            assert.equal(
                player.audios.find((track) => track.language === "fr").active,
                true
            );
            assert.equal(
                modern
                    ? player.texts.some((track) => track.active)
                    : player.visible,
                false
            );
            const writes = player.trackWrites.length;
            player.events.trackschanged();
            assert.equal(
                player.trackWrites.length,
                writes,
                "restoration is idempotent"
            );
            w.stbToggleSubtitle();
            boxes.at(-1)[2](2);
            assert.equal(player.texts[1].active, true);
            if (!modern) assert.equal(player.visible, true);
            player.texts.reverse();
            player.events.trackschanged();
            assert.equal(
                player.texts.find((track) => track.language === "fr").active,
                true,
                "text IDs survive track-list reordering"
            );
            w.stbToggleAudioTrack();
            const audioRows = owner.tracks("audio");
            const englishRow = audioRows.findIndex(
                (track) => track.language === "en"
            );
            boxes.at(-1)[2](englishRow);
            assert.equal(
                owner.__ottExplicitTracks.audio,
                1,
                "audio zero remains an explicit choice"
            );
            assert.equal(
                player.audios.find((track) => track.language === "en").active,
                true
            );
            const oldRestore = player.events.trackschanged;
            const finalWrites = player.trackWrites.length;
            w.stbStop();
            oldRestore();
            for (const [, callback] of preferences) callback(0);
            assert.equal(player.trackWrites.length, finalWrites);
            oldRestore();
            assert.equal(
                player.trackWrites.length,
                finalWrites,
                "stale callbacks have no authority"
            );
            player.destroyed.resolve();
        }
    );
}

for (const nativeIds of [true, false]) {
    test(
        "modern Shaka keeps distinct audio identities with equal labels: nativeIds=" +
            nativeIds,
        async () => {
            const { w, shakas, boxes } = fixture();
            w.playerMode = 2;
            w.__ottNativeRuntime = true;
            w.stbPlay("same-labels.mpd");
            const player = shakas[0];
            installShakaTracks(player);
            player.audios[1] = { ...player.audios[0], active: false, id: 20 };
            if (!nativeIds) {
                player.audios.forEach((track) => {
                    delete track.id;
                });
                player.audios[1].accessibilityPurpose = "visually-impaired";
            }
            player.attached.resolve();
            await tick();
            player.loaded.resolve();
            await tick();
            const owner = w.getCoreMediaBackend().current();
            const rows = () => owner.tracks("audio");
            assert.equal(rows().length, 2);
            assert.deepEqual(
                Array.from(rows(), (track) => track.id),
                [0, 1]
            );
            assert.deepEqual(
                Array.from(rows(), (track) => track.selected),
                [true, false]
            );
            assert.equal(w.stbAudioTracksExists(), true);
            for (const index of [1, 0, 1]) {
                w.stbToggleAudioTrack();
                boxes.at(-1)[2](index);
                assert.deepEqual(
                    player.audios.map((track) => track.active),
                    [index === 0, index === 1]
                );
                assert.deepEqual(
                    Array.from(rows(), (track) => track.selected),
                    [index === 0, index === 1]
                );
            }
            player.audios.reverse();
            if (nativeIds) player.audios[0].label = "Updated label";
            player.events.trackschanged();
            assert.equal(
                rows().find((track) => track.selected).id,
                1,
                "identity survives reorder and native metadata updates"
            );
            w.stbStop();
            player.destroyed.resolve();
            await tick();
        }
    );
}

test("relative engine seek samples actual media, preserves pause and rejects retired/nonseekable owners", () => {
    for (const paused of [false, true]) {
        const { w } = fixture();
        w.playerMode = 0;
        const lease = w.openCoreEngineLease({ url: "relative.mp4" }, () => {});
        Object.assign(w.video, {
            currentTime: 15,
            duration: 90,
            paused,
            readyState: 3,
            seekable: { end: () => 90, length: 1, start: () => 0 },
        });
        w._corePendingSeekPosition = 60;
        assert.equal(
            lease.sample().position,
            60,
            "existing pending-cursor observation is unchanged"
        );
        assert.equal(
            lease.relativeSample().position,
            15,
            "relative path reads the actual decoder"
        );
        assert.equal(lease.relativeSeek(25, paused), true);
        assert.equal(w.video.currentTime, 25);
        assert.equal(w.video.paused, paused);
        assert.equal(w.forcePlay, !paused);
        assert.equal(lease.relativeSeek(91, paused), false);
        w.video.seeking = true;
        assert.equal(lease.relativeSample(), null);
        assert.equal(lease.relativeSeek(30, paused), false);
        w.video.seeking = false;
        w._corePendingSeek = () => {};
        assert.equal(lease.relativeSeek(30, paused), false);
        w._corePendingSeek = null;
        const next = w.openCoreEngineLease({ url: "next.mp4" }, () => {});
        assert.equal(lease.relativeSample(), null);
        assert.equal(lease.relativeSeek(30, paused), false);
        next.dispose();
    }
});

test("relative seek keeps paused compatibility playback paused after asynchronous restart", async () => {
    const { w, players } = fixture();
    w.playerMode = 0;
    const lease = w.openCoreEngineLease({ url: "relative.mp4" }, () => {});
    Object.assign(w.video, {
        currentTime: 15,
        duration: 90,
        paused: true,
        readyState: 3,
        seekable: { end: () => 90, length: 1, start: () => 0 },
    });
    const prepared = deferred();
    w.__ottCoreCompatibilityUrl = "compatibility-owner";
    w.__ottLocalMedia = {
        cancelPlayback() {},
        compatibilityPlayback: () => true,
        playbackSourceUrl: () => "original-file",
        preparePlayback: () => prepared.promise,
    };
    assert.equal(lease.relativeSeek(25, true), true);
    prepared.resolve("next.m3u8");
    await tick();
    players.at(-1).events.manifest();
    assert.equal(w.forcePlay, false);
    assert.equal(w.video.paused, true);
    assert.equal(w.video.playCalls, 1, "only initial playback called play");
    lease.dispose();
});

test("local retry budget requires ten continuous wall-clock seconds of healthy playback", () => {
    for (const mode of [
        "brief",
        "healthy",
        "fast",
        "pause",
        "seek",
        "clock-gap",
        "short-pause",
        "short-seek",
        "native-pause",
        "native-seek",
        "native-waiting",
        "native-waiting-stall",
        "resumed-healthy",
    ]) {
        const { w } = fixture();
        const timers = new Map();
        let now = 100000,
            serial = 0;
        w.Date = class extends Date {
            static now() {
                return now;
            }
        };
        w.setTimeout = (fn, delay) => {
            timers.set(++serial, { at: now + delay, fn });
            return serial;
        };
        w.clearTimeout = (id) => timers.delete(id);
        w.setInterval = () => 0;
        w.clearInterval = () => {};
        w.__ottLocalMedia = {
            isPlaybackUrl: (url) => url === "https://local.invalid/movie.mp4",
        };
        w.playerMode = 0;
        w.stbPlay("https://local.invalid/movie.mp4");
        const observedEvents = [
            "play",
            "seeking",
            "seeked",
            "waiting",
            "stalled",
        ];
        const listenerCounts = observedEvents.map(
            (name) => (w.video.listeners[name] || []).length
        );
        function ready() {
            w.video.readyState = 4;
            w.video.paused = false;
            w.video.seeking = false;
        }
        function advance(ms, movement = 0) {
            now += ms;
            w.video.currentTime += movement;
            const due = [...timers.entries()].filter(
                ([, job]) => job.at <= now
            );
            for (const [id, job] of due) {
                if (!timers.delete(id)) continue;
                job.fn();
            }
        }
        function play(seconds, rate = 1) {
            w.video.playbackRate = rate;
            for (let i = 0; i < seconds; i++) advance(1000, rate);
        }
        function emit(name) {
            for (const fn of [...(w.video.listeners[name] || [])]) fn();
        }
        function retry() {
            w.coreStreamFailure("network", 503);
            assert.equal(w.coreStreamAttempt.state().pending, true, mode);
            advance(2000);
            ready();
        }
        const attempt = w.coreStreamAttempt;
        ready();
        retry();
        retry();
        assert.deepEqual(
            observedEvents.map(
                (name) => (w.video.listeners[name] || []).length
            ),
            listenerCounts,
            "transport retries replace the local interruption listeners"
        );
        if (mode === "healthy") play(10);
        else if (mode === "fast") play(5, 2);
        else if (mode === "brief") play(2);
        else {
            play(9);
            if (mode === "pause") {
                w.video.paused = true;
                advance(1000);
                ready();
            }
            if (mode === "seek") advance(1000, 120);
            if (mode === "clock-gap") advance(60000, 60);
            if (mode === "short-pause" || mode === "resumed-healthy") {
                advance(100);
                w.stbPause();
                advance(100);
                w.stbResume();
            }
            if (mode === "short-seek") {
                advance(100);
                w.stbSetPosTime(w.video.currentTime + 0.1);
            }
            if (mode === "native-pause") {
                advance(100);
                w.video.pause();
                emit("pause");
                advance(100);
                w.video.play();
                emit("play");
            }
            if (mode === "native-seek") {
                advance(100);
                w.video.seeking = true;
                emit("seeking");
                w.video.currentTime += 0.1;
                advance(100);
                w.video.seeking = false;
                emit("seeked");
            }
            if (mode === "native-waiting") {
                advance(100);
                emit("waiting");
            }
            if (mode === "native-waiting-stall") {
                for (let i = 0; i < 30; i++) {
                    emit("waiting");
                    advance(1000);
                }
                assert.equal(
                    attempt.state().terminal,
                    true,
                    "waiting events cannot postpone the stall deadline"
                );
            }
            play(1);
            if (mode === "resumed-healthy") play(10);
        }
        w.coreStreamFailure("network", 503);
        const recovered = mode === "healthy" || mode === "resumed-healthy";
        assert.equal(attempt.state().terminal, !recovered, mode);
        assert.equal(attempt.state().pending, recovered, mode);
        if (!recovered) {
            assert.equal(
                w.coreStreamAttempt,
                null,
                "failed attempt is retired"
            );
            assert.equal(
                w.__ottCoreBackend().current(),
                null,
                "failed decoder is released"
            );
        }
        w.stbStop();
        assert.deepEqual(
            observedEvents.map(
                (name) => (w.video.listeners[name] || []).length
            ),
            observedEvents.map(() => 0),
            "Stop removes the local interruption listeners"
        );
    }
});

// A download can resume during the delay before a local transport retry.
// The cancelled retry must not leave its earlier loading notification latched.
function localRetryClockFixture() {
    const { w } = fixture();
    w.document.getElementById = () => null;
    const timers = new Map();
    let now = 100000,
        serial = 0;
    w.Date = class extends Date {
        static now() {
            return now;
        }
    };
    w.setTimeout = (fn, delay) => {
        timers.set(++serial, { at: now + delay, fn });
        return serial;
    };
    w.clearTimeout = (id) => timers.delete(id);
    w.setInterval = () => 0;
    w.clearInterval = () => {};
    const state = {
        generation: 1,
        phase: "loading",
        position: 0,
        target: { channelId: "file", kind: "vod", sourceId: "local" },
    };
    const commands = [];
    w.__ottClassicPlayback = {
        cancel() {},
        command(command) {
            commands.push(command);
            if (command.type === "position") state.position = command.position;
            else if (command.type === "stop") {
                state.phase = "stopped";
                state.generation++;
            } else state.phase = command.type;
        },
        context() {
            const generation = state.generation,
                source = state.target.sourceId;
            const current = () =>
                generation === state.generation &&
                source === state.target.sourceId &&
                state.phase !== "stopped";
            return { isCurrentBackend: current, isCurrentSource: current };
        },
        importLegacy() {},
        snapshot: () => state,
    };
    w.__ottLocalMedia = {
        isPlaybackUrl: (url) => url === "https://local.invalid/movie.mp4",
    };
    w.playerMode = 0;
    w.stbPlay("https://local.invalid/movie.mp4");
    Object.assign(w.video, {
        duration: 500,
        ended: false,
        paused: false,
        playbackRate: 1,
        readyState: 4,
        seeking: false,
    });
    for (const callback of w.video.listeners.playing) callback();
    const handle = w.__ottCoreBackend().current();
    function advance(ms, movement = 0) {
        now += ms;
        w.video.currentTime += movement;
        const due = [...timers].filter(([, job]) => job.at <= now);
        for (const [id, job] of due) {
            if (timers.delete(id)) job.fn();
        }
    }
    advance(1000, 1);
    for (let i = 0; i < 30; i++) advance(1000);
    assert.equal(w.coreStreamAttempt.state().pending, true);
    assert.equal(handle.snapshot().phase, "loading");
    return { advance, commands, handle, state, w };
}
test("local progress before a queued retry restores the same decoder status", () => {
    const f = localRetryClockFixture();
    const attempt = f.w.coreStreamAttempt;
    f.advance(200, 0.2);
    f.advance(400, 0.4);
    assert.equal(
        attempt.state().pending,
        false,
        "clock change cancels stale retry intent"
    );
    assert.equal(f.w.__ottCoreBackend().current(), f.handle);
    assert.equal(f.handle.diagnosticAttempt().engineStarts, 1);
    assert.equal(f.handle.diagnosticAttempt().streamRetries, 0);
    f.advance(400, 0.4);
    assert.equal(
        f.handle.snapshot().phase,
        "playing",
        "cancelled local retry must retire its loading notification after real progress"
    );
    assert(f.handle.snapshot().position >= 1.9);
    const count = f.commands.filter((c) => c.type === "playing").length;
    f.advance(1000, 1);
    assert.equal(
        f.commands.filter((c) => c.type === "playing").length,
        count,
        "recovery notification is emitted once"
    );
    f.w.stbStop();
});
for (const change of [
    "pause",
    "seek",
    "stop",
    "replace",
    "standby",
    "suspend",
    "dispose",
    "generation",
    "source",
]) {
    test(
        "cancelled local retry does not restore playing after " + change,
        () => {
            const f = localRetryClockFixture();
            if (change === "pause") f.w.stbPause();
            else if (change === "seek") {
                f.w.video.seeking = true;
                for (const callback of f.w.video.listeners.seeking || [])
                    callback();
                f.w.stbSetPosTime(90);
            } else if (change === "stop") f.w.stbStop();
            else if (change === "replace")
                f.w.stbPlay("https://other.invalid/movie.mp4");
            else if (change === "standby") f.w.stbSetStandby(true);
            else if (change === "suspend") f.handle.suspend();
            else if (change === "dispose") f.handle.dispose();
            else if (change === "generation") f.state.generation++;
            else f.state.target.sourceId = "replacement";
            if (change === "replace") {
                // The next decoder may already move; the retired watcher still has no authority.
                Object.assign(f.w.video, {
                    paused: false,
                    readyState: 4,
                    seeking: false,
                });
            }
            const count = f.commands.filter((c) => c.type === "playing").length;
            f.advance(200, 0.2);
            f.advance(400, 0.4);
            f.advance(400, 0.4);
            assert.equal(
                f.commands.filter((c) => c.type === "playing").length,
                count
            );
            f.w.stbStop();
        }
    );
}

(async () => {
    let failures = 0;
    for (const [name, fn] of cases) {
        try {
            await fn();
            console.log("PASS " + name);
        } catch (error) {
            failures++;
            console.error("FAIL " + name + "\n" + error.stack);
        }
    }
    if (failures) process.exitCode = 1;
})();
