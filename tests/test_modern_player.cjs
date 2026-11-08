const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "..");
function compile(file) {
    return ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES5 },
    }).outputText;
}

function fixture() {
    const dom = new JSDOM(
        `<!doctype html><body>
            <video id="video"></video>
            <div id="info1" style="display:none">
                <div id="descr"><div id="programm_name2"></div><div id="programm_descr"></div></div>
                <div id="picon"></div>
                <div id="channel">
                    <div id="channel_number">7</div>
                    <div id="channel_name">BBC One</div>
                    <div id="progress_div">
                        <div id="progress_r"></div>
                        <div id="progress" style="width:25%"></div>
                        <span id="progress_span"><span></span></span>
                    </div>
                    <div id="begin_time">20:00</div>
                    <div id="programm_name">Evening News</div>
                    <div id="end_time">+15</div>
                    <div id="nbegin_time">20:30</div>
                    <div id="nprogramm_name">Weather</div>
                </div>
                <div id="data"><div id="video_res"></div></div>
            </div>
            <div id="permanentTime"></div>
            <div id="list"></div>
        </body>`,
        { runScripts: "outside-only", url: "https://example.invalid/player/" }
    );
    const w = dom.window;
    const calls = [];
    const record =
        (name) =>
        (...args) =>
            calls.push([name, ...args]);
    Object.assign(w, {
        _: (value) => value,
        __ottClassicPlayback: {
            command: record("command"),
            context: () => ({
                isCurrent: () => true,
                previewOffset: () => ({ plan: { action: "seek" } }),
            }),
            snapshot: () => ({
                phase: "playing",
                target: { archiveStart: 0, channelId: "7", kind: "live" },
            }),
        },
        __ottClassicScreenPort: {
            screens: { current: () => null },
        },
        __ottInterfaceModeState: { effective: 1, status: "modern" },
        catIndex: 3,
        channelsList: record("channelsList"),
        clearInterval: w.clearInterval.bind(w),
        clearTimeout: w.clearTimeout.bind(w),
        forcePlay: true,
        infoBarHide: record("infoBarHide"),
        isListVisible: false,
        keys: {
            DOWN: 40,
            ENTER: 13,
            EXIT: 27,
            LEFT: 37,
            RETURN: 8,
            RIGHT: 39,
            UP: 38,
        },
        pauseLivePlayback: record("pauseLivePlayback"),
        playArchive: record("playArchive"),
        playChannel: record("playChannel"),
        playTime: 0,
        playType: 0,
        popupList: record("popupList"),
        primaryIndex: 2,
        s10resum: 0,
        setInterval: w.setInterval.bind(w),
        setTimeout: w.setTimeout.bind(w),
        settings: { interfaceMode: 1 },
        shiftArchive: record("shiftArchive"),
        showChannelInfo: record("showChannelInfo"),
        showShift: record("showShift"),
        sInterfaceMode: 1,
        stbAudioTracksExists: () => true,
        stbContinue: record("stbContinue"),
        stbGetLen: () => 600,
        stbGetPosTime: () => 120,
        stbIsPlaying: () => true,
        stbPause: record("stbPause"),
        stbSubtitleExists: () => 1,
        stbToFullScreen: record("stbToFullScreen"),
        stbToggleAspectRatio: record("stbToggleAspectRatio"),
        stbToggleAudioTrack: record("stbToggleAudioTrack"),
        stbToggleMute: record("stbToggleMute"),
        stbToggleSubtitle: record("stbToggleSubtitle"),
    });
    w.eval(compile("src/ui/modern-player.ts"));
    const api = w.__ottModernPlayerFactory(w);
    return {
        api,
        calls,
        dom,
        progress: w.document.getElementById("progress_div"),
        progressHome: w.document.getElementById("channel"),
        w,
    };
}

// Tab traversal is deliberate ownership; opening INFO or automatic focus is not.
function ownControls(f) {
    f.progress.blur();
    f.api.handleKey({ key: "Tab", target: f.w.document.body });
    f.progress.focus();
}

// Exercise native _doKey delivery as well as DOM events through the real shared
// handler: Android and remote controls do not dispatch a browser keydown.
test("Modern Tab traversal remains native before shared playback key cancellation", () => {
    const f = fixture();
    try {
        f.w.document.getElementById("info1").style.display = "block";
        f.api.refresh();
        let playbackKeys = 0;
        f.w.document.addEventListener("keydown", (event) => {
            playbackKeys++;
            event.preventDefault();
        });
        for (const shiftKey of [false, true]) {
            const event = new f.w.KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key: "Tab",
                shiftKey,
            });
            f.w.document.body.dispatchEvent(event);
            assert.equal(event.defaultPrevented, false);
            assert.equal(playbackKeys, 0);
        }
        f.w.document.body.dispatchEvent(
            new f.w.KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key: "q",
            })
        );
        assert.equal(playbackKeys, 1, "unrelated keys still reach playback");
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

function sharedInput(f, platform) {
    const { w, api, calls } = f;
    const file = "src/key-handler/index.ts";
    const source = ts.createSourceFile(
        file,
        fs.readFileSync(path.join(root, file), "utf8"),
        ts.ScriptTarget.Latest,
        true
    );
    const names = [
        "cancelNativeListInertia",
        "keyHandler",
        "dispatchKey",
        "handleMainKey",
        "toggleMainPlayback",
        "keyFun",
        "plusProg",
        "minusProg",
    ];
    w.eval(
        require("./helpers/numeric-key-state.cjs")() +
            ts
                .transpileModule(
                    source.statements
                        .filter(
                            (node) =>
                                ts.isFunctionDeclaration(node) &&
                                names.includes(node.name?.text)
                        )
                        .map((node) => node.getText(source))
                        .join("\n"),
                    {
                        compilerOptions: {
                            module: ts.ModuleKind.ES2015,
                            target: ts.ScriptTarget.ES5,
                        },
                    }
                )
                .outputText.replace(/^export /gm, "")
    );
    w.eval(compile("src/ui/input-router.ts"));
    const device = fs.readFileSync(
        path.join(root, `src/devices/${platform}/device.ts`),
        "utf8"
    );
    w.keys = w.eval(
        "(" + /var \w*Keys = (\{[\s\S]*?\});/.exec(device)[1] + ")"
    );
    const router = w.__ottInputRouter.create({ keys: () => w.keys });
    w.__ottClassicScreenPort.normalize = router.normalize;
    w.__ottClassicScreenPort.dispatch = (code, event, main) => main({ code });
    Object.assign(w, {
        __ottModernPlayer: api,
        curList: ["one", "two", "three"],
        nativeListInertia: null,
        ott_device: platform,
        primaryIndex: 0,
        settings: { ...w.settings, adFun: 16, auFun: 15 },
        shiftArchiveSelect: (...args) => calls.push(["seekDialog", ...args]),
        stbEventToKeyCode: (event) => event.keyCode,
    });
    w.addEventListener("keydown", w.keyHandler);
    return (name) => w.dispatchKey(w.keys[name]);
}

function actualFunctions(file, names) {
    const source = ts.createSourceFile(
        file,
        fs.readFileSync(path.join(root, file), "utf8"),
        ts.ScriptTarget.Latest,
        true
    );
    const functions = names.map((name) => {
        const node = source.statements.find(
            (entry) =>
                ts.isFunctionDeclaration(entry) && entry.name?.text === name
        );
        assert.ok(node, `actual ${name} exists`);
        return node.getText(source).replace(/^export /, "");
    });
    return ts.transpileModule(functions.join("\n"), {
        compilerOptions: { target: ts.ScriptTarget.ES5 },
    }).outputText;
}

// Include the real channel/media launch and footer functions: a stub that only
// records playChannel misses the automatic banner which originally stole Up.
function automaticInfoFixture(platform = "pc", animations = false) {
    const f = fixture();
    const { w, calls } = f;
    const nativeKey = sharedInput(f, platform);
    w.eval(fs.readFileSync(path.join(root, "js/jquery-1.11.1.min.js"), "utf8"));
    w.$.expr.filters.visible = (element) => element.style.display !== "none";
    if (!animations) {
        const show = w.$.fn.show;
        w.$.fn.show = function (_duration, complete) {
            show.call(this);
            if (typeof complete === "function") complete.call(this[0]);
            return this;
        };
        w.$.fn.slideDown = w.$.fn.show;
        w.$.fn.slideUp = w.$.fn.hide;
    }
    const timers = new Map();
    let nextTimer = 100000;
    let now = 0;
    const immediate = w.setTimeout.bind(w);
    const clearImmediate = w.clearTimeout.bind(w);
    w.setTimeout = (callback, delay) => {
        if (!delay) return immediate(callback, 0);
        const id = nextTimer++;
        timers.set(id, { callback, delay, due: now + delay });
        return id;
    };
    w.clearTimeout = (id) => {
        if (!timers.delete(id)) clearImmediate(id);
    };
    Object.assign(w, {
        $infoBar: w.$("#info1"),
        cats: { All: ["one", "two", "three"] },
        catsArray: ["unused0", "unused1", "unused2", "All"],
        changeVolume: (delta) => calls.push(["changeVolume", delta]),
        channels: { one: {}, three: {}, two: {} },
        checkMedia() {},
        detailScrollTimer: 0,
        detailTimer: 0,
        getChannelUrl: (id) => `https://media.invalid/${id}.m3u8`,
        getMediaDescr: () => "A local test film",
        ifParentalAccessChId: () => false,
        infoTimeout: 0,
        mediaCheckTimer: 0,
        metadataCssUrl: (value) => value || "",
        refreshAudioBadge() {},
        setCurrent: (category, index) => {
            w.catIndex = category;
            w.curList = w.cats[w.catsArray[category]];
            w.primaryIndex = index;
        },
        settings: {
            ...w.settings,
            alFun: 14,
            arFun: 13,
            infoSwitch: true,
            infoTimeout: 5,
            stopPlay: false,
        },
        stbPlay: (...args) => calls.push(["stbPlay", ...args]),
        sVolumeStep: 5,
        updateChannelInfo: (id) => {
            w.document.getElementById("channel_name").textContent = id;
        },
        updateCoreVideoInfo() {},
    });
    w.eval(
        actualFunctions("src/ui/index.ts", [
            "hideInfoBarWhenReady",
            "infoBarHide",
            "showChannelInfo",
            "setInfoInteraction",
        ])
    );
    w.__ottSetInfoInteraction = w.setInfoInteraction;
    w.eval(
        actualFunctions("src/index.ts", [
            "stopSourcePlayback",
            "_playChannel",
            "_playMedia",
        ])
    );
    w.playChannel = (...args) => {
        calls.push(["playChannel", ...args]);
        return w._playChannel(...args);
    };
    const dialog = w.document.createElement("div");
    dialog.id = "dialogbox";
    dialog.style.display = "none";
    w.document.body.appendChild(dialog);
    f.api.refresh();
    return {
        ...f,
        advance(milliseconds) {
            const deadline = now + milliseconds;
            for (let count = 0; count < 100; count++) {
                const next = [...timers.entries()]
                    .filter(([, timer]) => timer.due <= deadline)
                    .sort((a, b) => a[1].due - b[1].due)[0];
                if (!next) {
                    now = deadline;
                    return;
                }
                timers.delete(next[0]);
                now = next[1].due;
                next[1].callback();
            }
            assert.fail("unexpected recursive timer scheduling");
        },
        domKey(name, target = w.document.body) {
            target.dispatchEvent(
                new w.KeyboardEvent("keydown", {
                    bubbles: true,
                    cancelable: true,
                    keyCode: w.keys[name],
                })
            );
        },
        nativeKey,
        async settle() {
            // MutationObserver queues the Modern sync on a zero-delay timer.
            await new Promise((resolve) => setTimeout(resolve, 0));
            await new Promise((resolve) => setTimeout(resolve, 0));
        },
        timers,
    };
}

for (const platform of ["pc", "android"]) {
    for (const delivery of ["nativeKey", "domKey"]) {
        test(`${platform} ${delivery}: automatic channel info never takes repeated Up/Up/Down`, async () => {
            const f = automaticInfoFixture(platform);
            try {
                for (const name of ["UP", "UP", "DOWN"]) {
                    f[delivery](name);
                    await f.settle();
                }
                assert.deepEqual(
                    f.calls.filter(([name]) => name === "playChannel"),
                    [
                        ["playChannel", 3, 1],
                        ["playChannel", 3, 2],
                        ["playChannel", 3, 1],
                    ]
                );
                assert.deepEqual(
                    f.calls
                        .filter(([name]) => name === "stbPlay")
                        .map((row) => row[1]),
                    [
                        "https://media.invalid/two.m3u8",
                        "https://media.invalid/three.m3u8",
                        "https://media.invalid/two.m3u8",
                    ]
                );
                assert.equal(
                    f.calls.some(([name]) => name === "shiftArchive"),
                    false
                );
                assert.equal(f.api.state().open, true);
                assert.equal(f.api.state().interactive, false);
                assert.notEqual(f.w.document.activeElement, f.progress);
            } finally {
                f.api.destroy();
                f.dom.window.close();
            }
        });
    }
}

for (const delivery of ["nativeKey", "domKey"]) {
    test(`PC ${delivery}: passive banner leaves Left/Right as volume`, async () => {
        const f = automaticInfoFixture();
        try {
            f.nativeKey("UP");
            await f.settle();
            f.calls.length = 0;
            f[delivery]("LEFT");
            f[delivery]("RIGHT");
            await f.settle();
            assert.deepEqual(f.calls, [
                ["changeVolume", -5],
                ["changeVolume", 5],
            ]);
            assert.equal(f.api.state().interactive, false);
        } finally {
            f.api.destroy();
            f.dom.window.close();
        }
    });
}

test("explicit info preserves PC arrows until deliberate control focus", async () => {
    const f = automaticInfoFixture();
    try {
        f.nativeKey("UP");
        await f.settle();
        f.nativeKey("INFO");
        assert.equal(f.api.state().interactive, true);
        f.calls.length = 0;
        f.nativeKey("RIGHT");
        assert.deepEqual(f.calls, [["changeVolume", 5]]);
        assert.equal(f.w.document.activeElement, f.progress);
        ownControls(f);
        f.calls.length = 0;
        f.nativeKey("RIGHT");
        assert.deepEqual(f.calls, [["shiftArchive", 10]]);
        f.nativeKey("UP");
        assert.equal(f.api.state().group, "actions");
        await f.settle();
        assert.equal(f.api.state().interactive, true);
        assert.equal(f.api.state().group, "actions");
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

test("passive preserve and batched hide/show do not revive an old controls owner", async () => {
    const f = automaticInfoFixture();
    try {
        f.w.showChannelInfo(5, false);
        await f.settle();
        f.w.showChannelInfo(1, null);
        await f.settle();
        assert.equal(
            f.api.state().interactive,
            false,
            "a seek/metadata refresh stays passive"
        );
        f.w.showChannelInfo(1, true);
        ownControls(f);
        f.nativeKey("UP");
        assert.equal(f.api.state().group, "actions");
        f.w.showChannelInfo(1, null);
        await f.settle();
        assert.equal(
            f.api.state().interactive,
            true,
            "a refresh preserves explicit ownership"
        );
        assert.equal(f.api.state().group, "actions");
        f.w.infoBarHide();
        f.w.showChannelInfo(5, false);
        await f.settle();
        assert.equal(f.api.state().open, true);
        assert.equal(f.api.state().interactive, false);
        assert.notEqual(f.w.document.activeElement, f.progress);
        assert.equal(f.w.document.activeElement.closest("#modernPlayer"), null);
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

for (const gesture of ["video", "timeline", "focus", "enter"]) {
    test(`${gesture} explicitly activates controls over a passive banner`, async () => {
        const f = automaticInfoFixture();
        try {
            f.w.showChannelInfo(5, false);
            await f.settle();
            if (gesture === "video")
                f.w.document.getElementById("video").click();
            else if (gesture === "timeline")
                f.progress.dispatchEvent(
                    new f.w.MouseEvent("mousedown", { bubbles: true })
                );
            else if (gesture === "focus") f.progress.focus();
            else f.nativeKey("ENTER");
            assert.equal(f.api.state().interactive, true);
            f.calls.length = 0;
            f.nativeKey("RIGHT");
            assert.deepEqual(
                f.calls,
                gesture === "timeline"
                    ? [["shiftArchive", 10]]
                    : [["changeVolume", 5]]
            );
        } finally {
            f.api.destroy();
            f.dom.window.close();
        }
    });
}

test("accepted navigation releases only Modern focus; rejected navigation keeps controls", async () => {
    const f = automaticInfoFixture();
    try {
        f.w.showChannelInfo(5);
        await f.settle();
        ownControls(f);
        f.nativeKey("UP");
        const action = f.w.document.activeElement;
        assert.ok(action.matches("[data-modern-player-action]"));
        f.w.ifParentalAccessChId = () => true;
        f.w.playChannel(3, 2);
        assert.equal(f.api.state().interactive, true);
        assert.equal(f.w.document.activeElement, action);
        f.w.ifParentalAccessChId = () => false;
        f.w.playChannel(3, 2);
        await f.settle();
        assert.equal(f.api.state().interactive, false);
        assert.equal(f.w.document.activeElement.closest("#modernPlayer"), null);
        f.calls.length = 0;
        f.nativeKey("UP");
        assert.deepEqual(
            f.calls.filter(([name]) => name === "playChannel"),
            [["playChannel", 3, 0]]
        );

        const input = f.w.document.createElement("input");
        f.w.document.body.appendChild(input);
        input.focus();
        f.w.setInfoInteraction(false);
        assert.equal(
            f.w.document.activeElement,
            input,
            "reset never blurs an external editor"
        );
        f.calls.length = 0;
        f.nativeKey("DOWN");
        f.domKey("DOWN", input);
        assert.deepEqual(f.calls, [], "both delivery paths protect the editor");
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

test("closed passive controls leave Enter to the channel list", async () => {
    const f = automaticInfoFixture();
    try {
        f.w.showChannelInfo(5, false);
        await f.settle();
        f.w.infoBarHide();
        await f.settle();
        f.nativeKey("ENTER");
        assert.deepEqual(f.calls, [["channelsList", 3, 0]]);
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

test("explicit INFO replaces the passive hide timer and preserves intent under a dialog", async () => {
    const f = automaticInfoFixture();
    try {
        f.w.showChannelInfo(5, false);
        await f.settle();
        const passiveTimer = f.w.infoTimeout;
        assert.ok(f.timers.has(passiveTimer));
        f.nativeKey("INFO");
        assert.equal(f.timers.has(passiveTimer), false);
        const explicitTimer = f.w.infoTimeout;
        assert.ok(f.timers.has(explicitTimer));
        const dialog = f.w.document.getElementById("dialogbox");
        dialog.style.display = "block";
        await f.settle();
        assert.equal(f.api.state().open, false);
        f.calls.length = 0;
        assert.equal(f.api.handleKey({ keyCode: f.w.keys.RIGHT }), false);
        assert.deepEqual(f.calls, []);
        dialog.style.display = "none";
        await f.settle();
        assert.equal(f.api.state().open, true);
        assert.equal(f.api.state().interactive, true);
        f.w.infoBarHide();
        assert.equal(f.timers.has(explicitTimer), false);
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

for (const target of ["timeline", "action"]) {
    test(`Tab to ${target} near passive expiry grants a fresh explicit control lifetime`, async () => {
        const f = automaticInfoFixture();
        try {
            f.w.showChannelInfo(5, false);
            await f.settle();
            f.advance(4500);
            let focusEvents = 0;
            const element =
                target === "timeline"
                    ? f.progress
                    : f.w.document.querySelector(
                          '[data-modern-player-action="play"]'
                      );
            element.addEventListener("focusin", () => focusEvents++);
            element.focus();
            assert.equal(
                focusEvents,
                1,
                "promotion must not recurse through focus"
            );
            assert.equal(f.api.state().interactive, true);
            f.advance(500);
            await f.settle();
            assert.equal(
                f.api.state().open,
                true,
                "the old passive deadline cannot close explicit controls"
            );
            assert.equal(f.api.state().interactive, true);
            f.advance(4500);
            await f.settle();
            assert.equal(
                f.api.state().open,
                false,
                "the renewed deadline still closes idle controls"
            );
            assert.equal(focusEvents, 1);
        } finally {
            f.api.destroy();
            f.dom.window.close();
        }
    });
}

test("repeated Tab and Shift+Tab traversal renews an already interactive HUD", async () => {
    const f = automaticInfoFixture();
    try {
        const { w } = f;
        w.showChannelInfo(5);
        await f.settle();
        const play = w.document.querySelector(
            '[data-modern-player-action="play"]'
        );
        const mute = w.document.querySelector(
            '[data-modern-player-action="mute"]'
        );
        let focusEvents = 0;
        for (const element of [play, mute])
            element.addEventListener("focusin", () => focusEvents++);
        function tabTo(element, shiftKey) {
            const event = new w.KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key: "Tab",
                keyCode: 9,
                shiftKey,
            });
            w.document.activeElement.dispatchEvent(event);
            assert.equal(event.defaultPrevented, false);
            // JSDOM has no native tab traversal; move to its next control.
            element.focus();
            assert.equal(w.document.activeElement, element);
        }
        f.advance(4500);
        tabTo(mute, false);
        f.advance(4500);
        await f.settle();
        assert.equal(f.api.state().open, true);
        tabTo(play, true);
        f.advance(500);
        await f.settle();
        assert.equal(
            f.api.state().open,
            true,
            "the previous Tab deadline was renewed"
        );
        assert.equal(
            w.document.activeElement,
            play,
            "renewal preserves deliberate focus"
        );
        assert.equal(focusEvents, 2, "neither renewal refocuses the control");
        f.advance(4500);
        await f.settle();
        assert.equal(f.api.state().open, false, "idle controls still expire");
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

test("late resolved media preserves INFO opened during its asynchronous load", async () => {
    const f = automaticInfoFixture();
    try {
        let state = { generation: 1, phase: "playing", target: null };
        const item = {
            name: "Movie",
            stream_url: "https://media.invalid/movie.mp4",
        };
        const ref = { itemId: "movie", sourceId: "plex@local" };
        f.w.__ottMedia = {
            channelLaunch: () => "two",
            prepare: () => ({ item, ref, resume: 0, valid: () => true }),
            title: () => "Movie",
        };
        f.w.__ottClassicPlayback = {
            command: (command) => {
                state = {
                    generation: state.generation + 1,
                    phase: "playing",
                    target: {
                        ...ref,
                        channelId: command.channelId,
                        kind: "vod",
                    },
                };
                return true;
            },
            snapshot: () => state,
        };
        f.w.setInfoInteraction(false);
        f.w.showChannelInfo(5, false);
        await f.settle();
        f.w.showChannelInfo();
        ownControls(f);
        f.nativeKey("UP");
        const focused = f.w.document.activeElement;
        f.w._playMedia(item, true, true);
        await f.settle();
        assert.equal(f.api.state().interactive, true);
        assert.equal(f.api.state().group, "actions");
        assert.equal(f.w.document.activeElement, focused);
        assert.deepEqual(
            f.calls.filter(([name]) => name === "stbPlay"),
            [["stbPlay", item.stream_url, undefined]]
        );
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

test("a queued real jQuery slide hide cannot erase newly explicit INFO intent", async () => {
    const f = automaticInfoFixture("pc", true);
    try {
        f.w.showChannelInfo(5, false);
        await f.settle();
        f.w.sInfoSlide = 1;
        f.w.infoBarHide();
        await new Promise((resolve) => setTimeout(resolve, 35));
        f.nativeKey("INFO");
        assert.equal(f.api.state().interactive, true);
        await new Promise((resolve) => setTimeout(resolve, 900));
        assert.equal(f.api.state().open, true);
        assert.equal(f.api.state().interactive, true);
        f.calls.length = 0;
        f.nativeKey("RIGHT");
        assert.deepEqual(f.calls, [["changeVolume", 5]]);
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

for (const step of ["plusProg", "minusProg"]) {
    test(`${step}: busy Favorites navigation does not revoke newly opened INFO`, async () => {
        const f = automaticInfoFixture();
        let nav;
        try {
            f.w.eval(
                actualFunctions("src/media/global-favorites-navigation.ts", [
                    "createGlobalFavoritesNavigation",
                ])
            );
            const snapshot = new Promise(() => {});
            nav = f.w.createGlobalFavoritesNavigation({
                allowed: () => true,
                cancel() {},
                capture: () => ({
                    current: () => true,
                    id: "first",
                    value: { id: "first" },
                }),
                current: () => true,
                failed: () => assert.fail("pending navigation must not fail"),
                identity: (row) => row.id,
                onMove: () => f.w.setInfoInteraction(false),
                snapshot: () => snapshot,
            });
            nav.routeState({ id: "first", phase: "playing" });
            f.w.__ottGlobalFavorites = { navigation: nav };
            f.w.showChannelInfo(5);
            await f.settle();
            f.w[step]();
            assert.equal(
                f.api.state().interactive,
                false,
                "the first accepted move resets controls"
            );
            f.nativeKey("INFO");
            assert.equal(f.api.state().interactive, true);
            f.w[step]();
            await f.settle();
            assert.equal(
                f.api.state().interactive,
                true,
                "a consumed busy repeat is not a new selection"
            );
            assert.equal(
                f.calls.some(([name]) => name === "playChannel"),
                false
            );
        } finally {
            if (nav) nav.retire();
            f.api.destroy();
            f.dom.window.close();
        }
    });
}

function mediaIntentFixture() {
    const c = require("./test_port_vod.cjs").fixture();
    const pending = [];
    c.p_pref = "plex";
    c.__ottActiveProviderDriver = {
        capabilities: { mediaPlaylist: true },
        id: "plex",
    };
    c.catsArray = ["All"];
    c.cats = { All: [101, 102] };
    c.curList = c.cList = c.cats.All;
    c.channels = Object.fromEntries(
        c.curList.map((id) => [
            id,
            {
                __ottMediaItem: { id, request: { id }, title: "Film " + id },
                channel_name: "Film " + id,
            },
        ])
    );
    c.__ottChannels = {
        capture: () => ({
            active: () => true,
            category: () => 0,
            members: () => c.cats.All.slice(),
        }),
        group: () => "system:all",
        index: () => 0,
        select() {},
    };
    c.ifParentalAccessChId = () => false;
    c.parentalArray = [];
    c.__ottParental = { needs: () => false };
    c.__ottSetInfoInteraction = c.setInfoInteraction;
    c.providerMediaClient = {
        cancel() {},
        cancelAutomatic() {},
        resolve(item, done) {
            pending.push({ done, item });
        },
        stableRequests: true,
    };
    c.playChannel = c._playChannel;
    c.__ottClassicPlayback.reconcile();
    return {
        c,
        pending,
        resolve() {
            const { item, done } = pending[pending.length - 1];
            done({ ...item, stream_url: "https://media.invalid/film.mp4" });
        },
    };
}

for (const entry of ["playOrderedQueue", "playQueue", "playItem"]) {
    test(`new ${entry} resets prior controls once, then preserves INFO during resolution`, () => {
        const f = mediaIntentFixture();
        const item = { id: 201, request: { id: 201 }, title: "New film" };
        let dispatched = 0;
        const started = () => dispatched++;
        const rejected = () => assert.fail("valid new media must be accepted");
        f.c.setInfoInteraction(true);
        if (entry === "playOrderedQueue")
            f.c.__ottMedia.playOrderedQueue(
                [item],
                0,
                "queue",
                null,
                () => true,
                started,
                rejected
            );
        else if (entry === "playQueue")
            f.c.__ottMedia.playQueue([item], "New queue", () => true, started);
        else f.c.__ottMedia.playItem(item, () => true, started, rejected);
        assert.equal(
            f.pending.length,
            1,
            "the real media adapter started resolution"
        );
        assert.equal(
            f.c.__ottInfoInteractive,
            false,
            "a newly accepted request resets prior controls"
        );
        f.c.setInfoInteraction(true);
        f.resolve();
        assert.equal(dispatched, 1);
        assert.equal(
            f.c.__ottInfoInteractive,
            true,
            "completion preserves INFO opened while waiting"
        );
        assert.ok(f.c.calls.some(([name]) => name === "play"));
    });
    test(`rejected ${entry} preserves existing explicit controls`, () => {
        const f = mediaIntentFixture();
        const item = {
            id: 201,
            request: { id: 201 },
            title: "Unaccepted film",
        };
        const unexpected = () => assert.fail("rejected media cannot start");
        f.c.setInfoInteraction(true);
        if (entry === "playOrderedQueue")
            f.c.__ottMedia.playOrderedQueue(
                [item],
                0,
                "queue",
                null,
                () => false,
                unexpected,
                () => {}
            );
        else if (entry === "playQueue")
            f.c.__ottMedia.playQueue(
                [item],
                "New queue",
                () => false,
                unexpected
            );
        else
            f.c.__ottMedia.playItem(
                item,
                () => false,
                unexpected,
                () => {}
            );
        assert.equal(f.pending.length, 0);
        assert.equal(f.c.__ottInfoInteractive, true);
    });
}

test("old EOF cannot demote INFO opened during an already admitted media skip", () => {
    const f = mediaIntentFixture();
    const records = [201, 202, 203].map((id) => ({
        id,
        request: { id },
        title: "Film " + id,
    }));
    f.c.__ottMedia.playOrderedQueue(
        records,
        0,
        "queue",
        null,
        () => true,
        () => {},
        () => assert.fail("valid queue")
    );
    f.resolve();
    f.c.__ottMedia.skip(1);
    assert.equal(f.pending.length, 2);
    f.c.setInfoInteraction(true);
    f.c.__ottClassicPlayback.command({ type: "stop" });
    f.c.__ottMedia.ended(f.c.__ottClassicPlayback.snapshot().generation);
    assert.equal(
        f.pending.length,
        3,
        "EOF re-admits the pending skip against its new generation"
    );
    assert.equal(f.c.__ottInfoInteractive, true);
    f.resolve();
    assert.equal(f.c.__ottInfoInteractive, true);
});

function deferredFavoriteRoute(host, provider, play) {
    const { load } = require("./global-favorites-fixture.cjs");
    const createNavigation = load(
        "src/media/global-favorites-navigation.ts"
    ).createGlobalFavoritesNavigation;
    const createRouter = load(
        "src/media/global-favorites-router.ts"
    ).createGlobalFavoritesRouter;
    const codec = load(
        "src/settings/global-favorites-portable.ts"
    ).createGlobalFavoritesPortableCodec();
    const origin = {
        profile: "Local",
        provider,
        sourceAlias: "Local",
        subprofile: null,
    };
    const entries = ["first", "second"].map((id, index) => ({
        id,
        locator:
            provider === "m3u"
                ? { channelId: index ? "two" : "one", kind: "channel" }
                : {
                      kind: "plex-media",
                      ratingKey: String(101 + index),
                      serverId: "server",
                  },
        origin,
        title: id,
    }));
    let release, nav, route;
    const snapshot = new Promise((resolve) => {
        release = resolve;
    });
    const initial = { current: () => true, id: "first", value: entries[0] };
    const reset = () => host.setInfoInteraction(false);
    const router = createRouter({
        activate: async () => ({
            capturePlayback: () => ({
                current: () => true,
                matches: () => true,
            }),
            complete() {},
            current: () => true,
            origin,
            play: (_resolved, guard, preserveInfo) => play(guard, preserveInfo),
            release() {},
            resolve: async (locator) => ({ available: true, locator }),
        }),
        allowed: () => true,
        changed: (state) => nav.routeState(state),
        clearTimer() {},
        codec,
        current: () => true,
        now: () => 0,
        onSelect: reset,
        setTimer: () => 1,
        snapshot: () => snapshot,
        targets: async () => [{ current: () => true, origin }],
    });
    nav = createNavigation({
        allowed: () => true,
        cancel: router.cancel,
        capture: () => router.captureCurrent() || initial,
        current: () => true,
        failed: (reason) => assert.fail("favorite route failed: " + reason),
        identity: (row) =>
            codec.identity({
                locator: row.locator,
                origin: row.origin,
                title: row.title,
            }),
        onMove: reset,
        select: (...args) => {
            route = router.select(...args);
            return route;
        },
        snapshot: () => snapshot,
    });
    nav.routeState({ id: "first", phase: "playing" });
    return {
        nav,
        release: () => release({ current: () => true, entries }),
        result: () => route.result,
    };
}

test("completed M3U Favorite preserves INFO opened while its snapshot was pending", async () => {
    const f = automaticInfoFixture();
    let route;
    try {
        f.w.parentalArray = [];
        f.w.__ottParental = { needs: () => false };
        route = deferredFavoriteRoute(f.w, "m3u", (guard, preserveInfo) =>
            f.w._playChannel(
                3,
                1,
                true,
                guard,
                undefined,
                false,
                false,
                undefined,
                undefined,
                preserveInfo
            )
        );
        route.nav.move(1);
        f.w.showChannelInfo(5);
        await f.settle();
        route.release();
        await f.settle();
        assert.equal((await route.result()).status, "ok");
        assert.equal(f.api.state().interactive, true);
        assert.ok(
            f.calls.some(
                ([name, url]) =>
                    name === "stbPlay" &&
                    url === "https://media.invalid/two.m3u8"
            )
        );
        f.w._playChannel(3, 2);
        assert.equal(
            f.api.state().interactive,
            false,
            "a later independent selection still resets controls"
        );
    } finally {
        if (route) route.nav.retire();
        f.api.destroy();
        f.dom.window.close();
    }
});

test("completed catalog Favorite preserves INFO across router and media resolution", async () => {
    const f = mediaIntentFixture();
    const route = deferredFavoriteRoute(
        f.c,
        "plex",
        (guard, preserveInfo) =>
            new Promise((done) => {
                const accepted = f.c._playChannel(
                    0,
                    1,
                    true,
                    guard,
                    undefined,
                    false,
                    false,
                    done,
                    guard,
                    preserveInfo
                );
                if (accepted !== true) done(false);
            })
    );
    try {
        route.nav.move(1);
        f.c.setInfoInteraction(true);
        route.release();
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(f.pending.length, 1);
        assert.equal(
            f.c.__ottInfoInteractive,
            true,
            "catalog resolution must preserve the already accepted route intent"
        );
        f.resolve();
        assert.equal((await route.result()).status, "ok");
        assert.equal(f.c.__ottInfoInteractive, true);
        f.c._playChannel(0, 0);
        assert.equal(
            f.c.__ottInfoInteractive,
            false,
            "an unrelated catalog choice is a new request"
        );
    } finally {
        route.nav.retire();
    }
});

for (const platform of ["pc", "android"]) {
    for (const mode of [0, 1700000000, -1e11]) {
        test(`${platform} shared native arrows switch with Modern closed; focused controls retain ownership (${mode})`, () => {
            const f = fixture();
            try {
                const key = sharedInput(f, platform);
                f.w.playType = mode;
                f.api.refresh();
                const closedInput = f.w.document.createElement("input");
                f.w.document.body.appendChild(closedInput);
                closedInput.focus();
                assert.equal(
                    f.api.handleKey({ keyCode: f.w.keys.VOL_UP }),
                    false,
                    "input focus leaves global volume commands available"
                );
                key("UP");
                assert.deepEqual(
                    f.calls,
                    [],
                    "closed Modern panel still protects focused native input"
                );
                closedInput.remove();
                key("UP");
                key("DOWN");
                assert.deepEqual(f.calls.splice(0), [
                    ["playChannel", 3, 1],
                    ["playChannel", 3, 2],
                ]);

                f.w.document.getElementById("info1").style.display = "block";
                f.api.sync();
                ownControls(f);
                key("UP");
                assert.equal(f.api.state().group, "actions");
                key("DOWN");
                assert.equal(f.w.document.activeElement, f.progress);
                key("RIGHT");
                assert.deepEqual(f.calls.splice(0), [
                    ["showChannelInfo", 1],
                    ["showChannelInfo", 1],
                    ["showChannelInfo", 1],
                    ["shiftArchive", 10],
                    ["showChannelInfo", 1],
                ]);
                const input = f.w.document.createElement("input");
                f.w.document.body.appendChild(input);
                input.focus();
                assert.equal(
                    f.api.handleKey({ keyCode: f.w.keys.DOWN }),
                    true,
                    "native editing focus is consumed without a playback action"
                );
                key("DOWN");
                assert.deepEqual(
                    f.calls,
                    [],
                    "native input focus also blocks background channel navigation"
                );
                input.blur();
                key("RETURN");
                assert.deepEqual(f.calls.splice(0), [["infoBarHide"]]);
                f.w.document.getElementById("info1").style.display = "none";
                f.api.sync();
                f.w.document.body.dispatchEvent(
                    new f.w.KeyboardEvent("keydown", {
                        bubbles: true,
                        keyCode: f.w.keys.UP,
                    })
                );
                assert.deepEqual(
                    f.calls,
                    [["playChannel", 3, 1]],
                    "closing the panel returns DOM keys to shared navigation"
                );
            } finally {
                f.api.destroy();
                f.dom.window.close();
            }
        });
    }
}

test("Classic keeps the shared footer and creates no overlay", () => {
    const f = fixture();
    try {
        f.w.settings.interfaceMode = 0;
        f.w.sInterfaceMode = 0;
        f.w.__ottInterfaceModeState.effective = 0;
        f.api.refresh();
        assert.equal(f.api.state().active, false);
        assert.equal(f.w.document.getElementById("modernPlayer"), null);
        assert.equal(f.progress.parentNode, f.progressHome);
        assert.equal(
            f.w.document.body.classList.contains("modern-player-ready"),
            false
        );
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

test("Modern moves the shared scrubber and mirrors live programme state", () => {
    const f = fixture();
    try {
        f.api.refresh();
        assert.equal(f.api.state().active, true);
        assert(f.w.document.body.classList.contains("modern-player-ready"));
        assert.equal(f.progress.parentNode.className, "modern-player-track");
        assert.equal(f.progress.getAttribute("role"), "slider");
        const overlay = f.w.document.getElementById("modernPlayer");
        assert(overlay);
        assert.equal(overlay.hidden, true);

        f.w.document.getElementById("info1").style.display = "block";
        f.api.sync();
        assert.equal(overlay.hidden, false);
        assert.equal(f.api.state().open, true);
        assert.equal(
            f.w.document.querySelector(".modern-player-kicker").textContent,
            "Live"
        );
        assert.equal(
            f.w.document.querySelector(".modern-player-title").textContent,
            "Evening News"
        );
        assert.equal(
            f.w.document.querySelector(".modern-player-meta").textContent,
            "BBC One · #7"
        );
        assert.equal(
            f.w.document.querySelector(".modern-player-next").textContent,
            "20:30 · Weather"
        );
        assert.equal(
            f.w.document.querySelector(".modern-player-elapsed").textContent,
            "20:00"
        );
        assert.equal(
            f.w.document.querySelector(".modern-player-remaining").textContent,
            "+15 min"
        );
        assert.equal(f.progress.getAttribute("aria-valuenow"), "25");
        assert.equal(
            f.w.document
                .querySelector('[data-modern-player-action="play"]')
                .getAttribute("aria-label"),
            "Pause"
        );
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

test("transport buttons call the shared playback boundaries", () => {
    const f = fixture();
    try {
        f.api.refresh();
        f.w.document.getElementById("info1").style.display = "block";
        f.api.sync();
        const click = (id) =>
            f.w.document
                .querySelector(`[data-modern-player-action="${id}"]`)
                .click();
        click("rewind");
        click("forward");
        click("mute");
        click("audio");
        click("subtitle");
        click("aspect");
        click("list");
        assert.deepEqual(
            f.calls.filter(([name]) =>
                [
                    "shiftArchive",
                    "stbToggleMute",
                    "stbToggleAudioTrack",
                    "stbToggleSubtitle",
                    "stbToggleAspectRatio",
                    "channelsList",
                    "infoBarHide",
                ].includes(name)
            ),
            [
                ["shiftArchive", -10],
                ["shiftArchive", 10],
                ["stbToggleMute"],
                ["stbToggleAudioTrack"],
                ["stbToggleSubtitle"],
                ["stbToggleAspectRatio"],
                ["infoBarHide"],
                ["channelsList", 3, 2],
            ]
        );
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

test("play/pause preserves live and finite playback ownership", () => {
    const f = fixture();
    try {
        f.api.refresh();
        f.w.document.getElementById("info1").style.display = "block";
        f.api.sync();
        f.w.document
            .querySelector('[data-modern-player-action="play"]')
            .click();
        assert.deepEqual(f.calls, [
            ["pauseLivePlayback"],
            ["showChannelInfo", 1],
        ]);

        f.calls.length = 0;
        f.w.playType = 1000;
        f.w.__ottClassicPlayback.snapshot = () => ({
            phase: "playing",
            position: 90,
            target: {
                archiveStart: 1000,
                channelId: "7",
                kind: "archive",
            },
        });
        f.api.sync();
        f.w.document
            .querySelector('[data-modern-player-action="play"]')
            .click();
        assert.deepEqual(f.calls.slice(0, 2), [
            ["showShift", "Pause"],
            ["showChannelInfo", 2],
        ]);
        assert.equal(f.calls[2][0], "command");
        assert.equal(f.calls[2][1].type, "pause");
        assert.deepEqual(f.calls[3], ["stbPause"]);

        f.calls.length = 0;
        f.w.stbIsPlaying = () => false;
        f.api.sync();
        f.w.document
            .querySelector('[data-modern-player-action="play"]')
            .click();
        assert.deepEqual(f.calls, [
            ["showShift", "Play"],
            ["infoBarHide"],
            ["playArchive", 1090],
        ]);
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

test("D-pad walks the scrubber and action rail without losing the shared keys", () => {
    const f = fixture();
    try {
        f.api.refresh();
        f.w.document.getElementById("info1").style.display = "block";
        f.api.sync();
        const rail = f.w.document.querySelector(".modern-player-actions");
        const play = f.w.document.querySelector(
            '[data-modern-player-action="play"]'
        );
        const rewind = f.w.document.querySelector(
            '[data-modern-player-action="rewind"]'
        );
        rail.getBoundingClientRect = () => ({ left: 0, right: 100 });
        play.getBoundingClientRect = () => ({ left: 75, right: 140 });
        rewind.getBoundingClientRect = () => ({ left: -20, right: 20 });
        const key = (name) =>
            f.w.dispatchEvent(
                new f.w.KeyboardEvent("keydown", { bubbles: true, key: name })
            );
        key("ArrowLeft");
        assert.deepEqual(f.calls, [
            ["shiftArchive", -10],
            ["showChannelInfo", 1],
        ]);
        // The timeline consumes the seek, not the Classic volume shortcut.
        assert.equal(f.progress, f.w.document.activeElement);

        f.calls.length = 0;
        key("ArrowUp");
        assert.equal(
            f.w.document.activeElement.getAttribute(
                "data-modern-player-action"
            ),
            "play"
        );
        assert.equal(
            rail.scrollLeft,
            48,
            "expanded Play stays inside the rail"
        );
        key("ArrowRight");
        assert.equal(
            f.w.document.activeElement.getAttribute(
                "data-modern-player-action"
            ),
            "rewind"
        );
        assert.equal(
            rail.scrollLeft,
            20,
            "focus moving left reveals the next action"
        );
        key("Enter");
        assert.deepEqual(f.calls, [
            ["showChannelInfo", 1],
            ["showChannelInfo", 1],
            ["shiftArchive", -10],
            ["showChannelInfo", 1],
        ]);

        f.calls.length = 0;
        key("ArrowDown");
        assert.equal(f.progress, f.w.document.activeElement);
        key("Escape");
        assert.deepEqual(f.calls, [["showChannelInfo", 1], ["infoBarHide"]]);
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

test("focused actions reveal only overflow and preserve visible positions", () => {
    const cases = [
        {
            expected: 100,
            left: 20,
            name: "already visible",
            right: 60,
            start: 100,
        },
        {
            expected: 72,
            left: -20,
            name: "left overflow",
            right: 20,
            start: 100,
        },
        {
            expected: 48,
            left: 75,
            name: "right overflow",
            right: 140,
            start: 0,
        },
        {
            expected: 72,
            left: -20,
            name: "left takes precedence",
            right: 140,
            start: 100,
        },
        {
            expected: 0,
            left: -20,
            name: "left origin clamp",
            right: 20,
            start: 5,
        },
        { expected: 100, left: 8, name: "exact inset", right: 92, start: 100 },
    ];
    for (const item of cases) {
        const f = fixture();
        try {
            f.api.refresh();
            f.w.document.getElementById("info1").style.display = "block";
            f.api.sync();
            const rail = f.w.document.querySelector(".modern-player-actions");
            const play = f.w.document.querySelector(
                '[data-modern-player-action="play"]'
            );
            rail.scrollLeft = item.start;
            rail.getBoundingClientRect = () => ({ left: 0, right: 100 });
            play.getBoundingClientRect = () => ({
                left: item.left - (rail.scrollLeft - item.start),
                right: item.right - (rail.scrollLeft - item.start),
            });
            const key = (name) =>
                f.w.dispatchEvent(
                    new f.w.KeyboardEvent("keydown", {
                        bubbles: true,
                        key: name,
                    })
                );
            key("ArrowUp");
            assert.equal(rail.scrollLeft, item.expected, item.name);
            if (item.name !== "left takes precedence") {
                key("ArrowDown");
                key("ArrowUp");
                assert.equal(
                    rail.scrollLeft,
                    item.expected,
                    item.name + " repeated focus"
                );
            }
        } finally {
            f.api.destroy();
            f.dom.window.close();
        }
    }
});

test("live tabs, status and next programme stay text-safe", () => {
    const f = fixture();
    try {
        f.w.document.getElementById("programm_descr").textContent =
            "Shared description";
        f.w.document.getElementById("video_res").textContent =
            "Stream connection failed";
        f.w.document.getElementById("video_res").setAttribute("role", "button");
        f.api.refresh();
        f.w.document.getElementById("info1").style.display = "block";
        f.api.sync();
        assert.equal(
            f.w.document.querySelector(".modern-player-summary").textContent,
            "Shared description"
        );
        const status = f.w.document.querySelector(".modern-player-status");
        assert.equal(status.textContent, "Stream connection failed");
        assert(status.classList.contains("modern-player-status-action"));
        assert.equal(status.hidden, false);
        const details = f.w.document.querySelector(
            '[data-modern-player-action="details"]'
        );
        assert.equal(details.hidden, false);
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

test("dialogs and number entry own input above the overlay", () => {
    const f = fixture();
    try {
        f.api.refresh();
        f.w.document.getElementById("info1").style.display = "block";
        f.api.sync();
        assert.equal(f.api.state().open, true);
        const dialog = f.w.document.createElement("div");
        dialog.id = "dialogbox";
        dialog.style.display = "block";
        f.w.document.body.appendChild(dialog);

        f.api.sync();
        assert.equal(f.api.state().open, false);
        assert.equal(f.w.document.getElementById("modernPlayer").hidden, true);
        f.calls.length = 0;
        f.w.dispatchEvent(
            new f.w.KeyboardEvent("keydown", {
                bubbles: true,
                key: "ArrowLeft",
            })
        );
        assert.deepEqual(f.calls, []);

        dialog.style.display = "none";
        f.api.sync();
        assert.equal(f.api.state().open, true);
        assert.equal(f.w.document.getElementById("modernPlayer").hidden, false);
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

test("a live stream without guide data does not show an empty scrubber", () => {
    const f = fixture();
    try {
        f.api.refresh();
        f.w.document.getElementById("begin_time").textContent = "";
        f.w.document.getElementById("end_time").textContent = "";
        f.w._prog100 = null;
        f.w.document.getElementById("info1").style.display = "block";
        f.api.sync();
        const timeline = f.w.document.querySelector(".modern-player-timeline");
        assert.equal(timeline.hidden, true);

        f.w.document.getElementById("begin_time").textContent = "20:00";
        f.w.document.getElementById("end_time").textContent = "+15";
        f.w._prog100 = {
            time: Date.now() / 1000 - 600,
            time_to: Date.now() / 1000 + 900,
        };
        f.api.sync();
        assert.equal(timeline.hidden, false);
        assert.equal(
            f.w.document.querySelector(".modern-player-elapsed").textContent,
            "20:00"
        );
        assert.equal(
            f.w.document.querySelector(".modern-player-remaining").textContent,
            "+15 min"
        );
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

test("leaving Modern restores the Classic footer and clears listeners", () => {
    const f = fixture();
    try {
        f.api.refresh();
        assert.equal(f.progress.parentNode.className, "modern-player-track");
        f.w.settings.interfaceMode = 0;
        f.w.sInterfaceMode = 0;
        f.w.__ottInterfaceModeState.effective = 0;
        f.api.refresh();
        assert.equal(f.api.state().active, false);
        assert.equal(f.w.document.getElementById("modernPlayer"), null);
        assert.equal(f.progress.parentNode, f.progressHome);
        assert.equal(f.progress.hasAttribute("role"), false);
        assert.equal(
            f.w.document.body.classList.contains("modern-player-ready"),
            false
        );
        // A later Classic key event is no longer swallowed by the overlay.
        f.w.document.getElementById("info1").style.display = "block";
        f.w.dispatchEvent(
            new f.w.KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
        );
        assert.deepEqual(f.calls, []);
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

for (const platform of ["pc", "pc2"]) {
    test(`${platform} real keyboard pipeline keeps INFO passive and modifier seeks single`, async () => {
        const f = automaticInfoFixture();
        try {
            const { w } = f;
            w.ott_device = platform;
            w.__ottClassicScreenPort.reconcile = () => {};
            w.tryKeyboardFavorites = () => false;
            w.tryKeyboardRandom = () => false;
            w.eval(
                actualFunctions("src/key-handler/index.ts", [
                    "keyboardElementIsEditable",
                    "tryKeyboardSeek",
                    "installKeyboardSeek",
                ])
            );
            w.installKeyboardSeek();
            const send = (key, extra = {}, target = w.document.activeElement) =>
                target.dispatchEvent(
                    new w.KeyboardEvent("keydown", {
                        bubbles: true,
                        cancelable: true,
                        code: key,
                        key,
                        keyCode: {
                            ArrowDown: 40,
                            ArrowLeft: 37,
                            ArrowRight: 39,
                            ArrowUp: 38,
                            Tab: 9,
                        }[key],
                        ...extra,
                    })
                );
            w.showChannelInfo(5);
            await f.settle();
            assert.equal(w.document.activeElement, f.progress);
            assert.equal(f.api.state().desktopControls, false);
            f.calls.length = 0;
            send("ArrowLeft");
            send("ArrowRight");
            send("ArrowUp");
            send("ArrowDown");
            assert.deepEqual(
                f.calls.filter(([name]) => name === "changeVolume"),
                [
                    ["changeVolume", -5],
                    ["changeVolume", 5],
                ]
            );
            assert.equal(
                f.calls.filter(([name]) => name === "playChannel").length,
                2
            );
            w.showChannelInfo(5);
            await f.settle();
            ownControls(f);
            send("ArrowUp");
            const action = w.document.activeElement;
            assert.equal(action.dataset.modernPlayerAction, "play");
            f.calls.length = 0;
            for (const modifier of ["altKey", "ctrlKey", "metaKey"])
                send("ArrowRight", { [modifier]: true });
            assert.deepEqual(
                f.calls.filter(([name]) => name === "shiftArchive"),
                [
                    ["shiftArchive", 10],
                    ["shiftArchive", 10],
                    ["shiftArchive", 10],
                ]
            );
            assert.equal(w.document.activeElement, action);
            send("ArrowRight");
            assert.equal(
                w.document.activeElement.dataset.modernPlayerAction,
                "rewind"
            );
            const input = w.document.createElement("input");
            w.document.body.appendChild(input);
            input.focus();
            f.calls.length = 0;
            send("ArrowRight", { altKey: true });
            assert.deepEqual(f.calls, []);
            input.remove();
            const prior = w.__ottClassicPlayback.snapshot();
            w.__ottClassicPlayback.snapshot = () => ({
                ...prior,
                generation: 100,
                target: { ...prior.target, channelId: "new" },
            });
            f.api.sync();
            assert.equal(f.api.state().desktopControls, false);
            f.calls.length = 0;
            send("ArrowRight");
            assert.deepEqual(f.calls, [["changeVolume", 5]]);
        } finally {
            f.api.destroy();
            f.dom.window.close();
        }
    });
}

for (const id of ["mute", "favorite", "info"]) {
    test(`PC Space activates focused ${id} once before shared key cancellation`, async () => {
        const f = fixture();
        try {
            const { w } = f;
            sharedInput(f, "pc");
            w.showPlaybackInfo = () => f.calls.push(["info"]);
            w.__ottGlobalFavorites = {
                toggle: async () => f.calls.push(["favorite"]),
            };
            f.api.refresh();
            w.document.getElementById("info1").style.display = "block";
            f.api.sync();
            const button = w.document.querySelector(
                `[data-modern-player-action="${id}"]`
            );
            f.api.handleKey({ key: "Tab", target: w.document.body });
            button.focus();
            assert.equal(f.api.state().desktopControls, true);
            f.calls.length = 0;
            const event = new w.KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key: " ",
                keyCode: 32,
            });
            button.dispatchEvent(event);
            button.dispatchEvent(
                new w.KeyboardEvent("keydown", {
                    bubbles: true,
                    cancelable: true,
                    key: " ",
                    keyCode: 32,
                    repeat: true,
                })
            );
            button.dispatchEvent(
                new w.KeyboardEvent("keyup", {
                    bubbles: true,
                    cancelable: true,
                    key: " ",
                    keyCode: 32,
                })
            );
            await new Promise(setImmediate);
            assert.equal(event.defaultPrevented, true);
            const name = id === "mute" ? "stbToggleMute" : id;
            assert.equal(
                f.calls.filter(([called]) => called === name).length,
                1
            );
            assert.equal(
                f.calls.some(
                    ([called]) =>
                        called === "stbPause" || called === "playChannel"
                ),
                false
            );
        } finally {
            f.api.destroy();
            f.dom.window.close();
        }
    });
}

test("native action/timeline/Info navigation uses the shared current-description helper", () => {
    const f = fixture();
    try {
        f.w.showPlaybackInfo = () => f.calls.push(["showPlaybackInfo"]);
        f.api.refresh();
        f.w.document.getElementById("info1").style.display = "block";
        f.api.sync();
        const key = (key) => f.api.handleKey({ key });
        key("ArrowUp");
        assert.equal(f.api.state().group, "actions");
        const first = f.w.document.activeElement;
        key("ArrowLeft");
        assert.equal(f.w.document.activeElement, first, "left edge clamps");
        const rail = [
            ...f.w.document.querySelectorAll(".modern-player-actions button"),
        ].filter((button) => !button.hidden && !button.disabled);
        for (let i = 0; i < rail.length + 2; i++) key("ArrowRight");
        assert.equal(
            f.w.document.activeElement,
            rail.at(-1),
            "right edge clamps"
        );
        key("ArrowDown");
        assert.equal(f.api.state().group, "timeline");
        key("ArrowDown");
        assert.equal(f.api.state().group, "info");
        assert.equal(
            f.w.document.activeElement.closest(".modern-player-tabs") !== null,
            true
        );
        key("ArrowDown");
        assert.equal(
            f.api.state().group,
            "info",
            "the lower tab edge retains focus"
        );
        assert.equal(
            f.calls.some(([name]) => name === "infoBarHide"),
            false
        );
        key("Enter");
        assert.deepEqual(f.calls.at(-1), ["showPlaybackInfo"]);
        key("ArrowUp");
        assert.equal(f.api.state().group, "timeline");
        key("ArrowUp");
        assert.equal(f.api.state().group, "actions");
        key("ArrowUp");
        assert.deepEqual(f.calls.at(-1), ["infoBarHide"]);
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

test("native Down reaches Info when a live stream has no timeline", () => {
    const f = fixture();
    try {
        f.w.ott_device = "webos";
        f.w.showPlaybackInfo = () => f.calls.push(["showPlaybackInfo"]);
        f.w.__ottClassicPlayback.context = () => ({
            isCurrent: () => true,
            previewOffset: () => ({ plan: { action: "restart" } }),
        });
        for (const id of [
            "begin_time",
            "end_time",
            "programm_name",
            "programm_descr",
        ])
            f.w.document.getElementById(id).textContent = "";
        f.w._prog100 = null;
        f.api.refresh();
        f.w.document.getElementById("info1").style.display = "block";
        f.api.sync();
        const key = (name) => f.api.handleKey({ keyCode: f.w.keys[name] });
        const info = f.w.document.querySelector(
            '[data-modern-player-action="info"]'
        );
        assert.equal(
            f.w.document.querySelector(".modern-player-timeline").hidden,
            true
        );
        assert.equal(info.hidden, false, "channel metadata still offers Info");
        assert.equal(f.api.state().group, "actions");
        key("DOWN");
        assert.equal(f.api.state().group, "info");
        assert.equal(f.w.document.activeElement, info);
        key("DOWN");
        assert.equal(
            f.w.document.activeElement,
            info,
            "the lower tab edge retains focus"
        );
        key("ENTER");
        assert.equal(
            f.calls.filter(([name]) => name === "showPlaybackInfo").length,
            1
        );
        key("UP");
        assert.equal(f.api.state().group, "actions");
        assert.equal(
            f.w.document.activeElement.closest(".modern-player-actions") !==
                null,
            true
        );
        assert.equal(
            f.calls.some(([name]) => name === "infoBarHide"),
            false
        );
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

test("library return restores the active global Favorites before provider browsing", () => {
    const f = fixture();
    try {
        f.w.__ottGlobalFavorites = { navigation: { active: () => true } };
        f.w.openGlobalFavorites = () => f.calls.push(["favorites"]);
        f.w.__ottActiveProviderDriver = {
            catalogBrowser: {
                restore: () => {
                    f.calls.push(["provider"]);
                    return true;
                },
            },
        };
        f.api.refresh();
        f.w.document.getElementById("info1").style.display = "block";
        f.api.sync();
        f.w.document
            .querySelector('[data-modern-player-action="list"]')
            .click();
        assert.deepEqual(f.calls, [["infoBarHide"], ["favorites"]]);
        f.w.__ottGlobalFavorites.navigation.active = () => false;
        f.w.document
            .querySelector('[data-modern-player-action="list"]')
            .click();
        assert.deepEqual(f.calls.slice(-2), [["infoBarHide"], ["provider"]]);
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

test("closing shared playback Info restores its deliberate desktop opener", async () => {
    const f = automaticInfoFixture();
    try {
        const { w } = f;
        w.__ottClassicScreenPort.setOwnedCallback = (_kind, callback) => {
            w.dialogBoxKeyHandler = callback;
            return callback;
        };
        // Optional modules use the assembler's private IIFE scope.
        w.eval(
            "(function () {" +
                compile("src/ui/playback-info.ts") +
                "}).call(this);"
        );
        w.showChannelInfo(5);
        await f.settle();
        ownControls(f);
        f.nativeKey("DOWN");
        const info = w.document.activeElement;
        assert.equal(info.dataset.modernPlayerAction, "info");
        f.nativeKey("ENTER");
        f.api.sync();
        assert.equal(f.api.state().open, false);
        assert.equal(f.api.state().desktopControls, false);
        w.dialogBoxKeyHandler(w.keys.RETURN);
        await f.settle();
        assert.equal(f.api.state().open, true);
        assert.equal(w.document.activeElement, info);
        assert.equal(f.api.state().desktopControls, true);
        f.nativeKey("UP");
        f.calls.length = 0;
        f.nativeKey("RIGHT");
        assert.deepEqual(f.calls, [["shiftArchive", 10]]);
    } finally {
        f.api.destroy();
        f.dom.window.close();
    }
});

for (const replacement of ["source", "mode", "dismiss", "load"]) {
    test(`late Info return cannot restore controls after ${replacement} replacement`, () => {
        const f = fixture();
        try {
            let returned;
            f.w.ott_device = "pc";
            f.w.showPlaybackInfo = (done) => {
                returned = done;
                return true;
            };
            f.api.refresh();
            f.w.document.getElementById("info1").style.display = "block";
            f.api.sync();
            ownControls(f);
            f.api.handleKey({ key: "ArrowDown" });
            f.api.handleKey({ key: "Enter" });
            if (replacement === "source") {
                f.w.__ottClassicPlayback.snapshot = () => ({
                    generation: "new",
                    target: { channelId: "new", kind: "vod" },
                });
            } else if (replacement === "mode") {
                f.w.settings.interfaceMode = 0;
                f.api.refresh();
                f.w.settings.interfaceMode = 1;
                f.api.refresh();
            } else if (replacement === "load") f.w.__ottCommandChannelLoad = {};
            else f.api.setInteractive(false);
            f.api.sync();
            returned();
            assert.equal(f.api.state().desktopControls, false);
        } finally {
            f.api.destroy();
            f.dom.window.close();
        }
    });
}
