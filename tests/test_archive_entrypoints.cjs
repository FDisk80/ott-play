const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const includeCore = require("./helpers/shared-core-runtime.cjs");
const sourcePath = path.resolve(__dirname, "../src/channels/index.ts");
const source = ts.createSourceFile(
    sourcePath,
    fs.readFileSync(sourcePath, "utf8"),
    ts.ScriptTarget.Latest,
    true
);
const names = ["selectEpg", "showPlaybackSeekDialog"];
const functions = source.statements.filter(
    (node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)
);
assert.equal(functions.length, names.length);
const code = ts
    .transpileModule(functions.map((node) => node.getText(source)).join("\n"), {
        compilerOptions: {
            module: ts.ModuleKind.ES2015,
            target: ts.ScriptTarget.ES5,
        },
    })
    .outputText.replace(/^export /gm, "");

function fixture(pin = false) {
    const calls = [],
        prompts = [],
        timers = [],
        stored = {};
    let now = 1000000;
    const row = {
        name: "Selected programme",
        time: now - 60,
        time_to: now + 60,
    };
    const chain = {
        hide() {
            calls.push(["hide"]);
            return chain;
        },
        html() {
            return chain;
        },
        show() {
            return chain;
        },
    };
    const c = {
        _: (value) => value,
        $: () => chain,
        catIndex: 0,
        cats: { All: [11, 22] },
        catsArray: ["All"],
        channels: { 11: { rec: 1 }, 22: { rec: 24 } },
        clearTimeout() {},
        closeList: () => calls.push(["close"]),
        console,
        Date: class extends Date {
            static now() {
                return now * 1000;
            }
        },
        document: { getElementById: () => ({ innerHTML: "" }) },
        epg_ch_id: 11,
        ifParentalAccessChId: (id, callback) => {
            if (pin) prompts.push(callback);
            return pin;
        },
        keys: { DOWN: 40, ENTER: 13, EXIT: 27, RETURN: 8, UP: 38 },
        listArray: [row],
        listCatIndex: 0,
        listChannel: 0,
        listEpgArray: [row],
        medHistory: [],
        p_pref: "archive-entrypoint",
        playArchive: (epoch) => calls.push(["archive", epoch]),
        playTime: 0,
        playType: 0,
        prevArr: [],
        primaryIndex: 0,
        providerGetItem: (key) => stored[key],
        providerSetItem: (key, value) => {
            stored[key] = value;
        },
        selIndex: 0,
        setCurrent: (category, index) =>
            calls.push(["select", category, index]),
        setTimeout: (callback, delay) => {
            timers.push({ callback, delay });
            return timers.length;
        },
        settings: { prevCount: 2 },
        shiftArchive: (delta) => calls.push(["seek", delta]),
        stbGetLen: () => 100,
        stbGetPosTime: () => 0,
    };
    c.curList = c.cats.All;
    c.window = c;
    vm.createContext(c);
    includeCore(c);
    vm.runInContext(code, c, { filename: sourcePath });
    require("./helpers/guide-runtime-fixture.cjs").install(c);
    c.getChannelEpg = (id, callback) => callback(id, [row]);
    c.metadataText = (value) => String(value || "");
    c.showPage = () => {};
    c.infoBox = () => {};
    c.epgList(0, 0, false);
    timers[0].callback();
    timers.length = 0;
    calls.length = 0;
    c.__ottClassicPlayback.command({ channelId: 11, type: "live" });
    c.__ottClassicPlayback.command({ type: "playing" });
    return {
        advance: (seconds) => {
            now += seconds;
        },
        c,
        calls,
        prompts,
        timers,
    };
}
function playbackCalls(f) {
    return f.calls.filter((row) => row[0] === "archive" || row[0] === "seek");
}
for (const pin of [false, true]) {
    const f = fixture(pin);
    f.c.selectEpg();
    if (pin) {
        assert.equal(f.prompts.length, 1);
        f.prompts[0]();
        f.prompts[0]();
    }
    assert.deepEqual(playbackCalls(f), [["archive", 999940]]);
    assert.deepEqual(
        f.calls.filter((row) => row[0] === "select"),
        [["select", 0, 0]]
    );
}
const mutations = {
    "channel revoked": (f) => {
        f.c.channels[11].rec = 0;
    },
    "explicit cancel": (f) => {
        f.c.__ottClassicPlayback.cancel();
    },
    "new row": (f) => {
        f.c.listArray = [{ time: 999930 }];
    },
    "new selection": (f) => {
        f.c.selIndex = 1;
    },
    "playing selection changed": (f) => {
        f.c.__ottClassicPlayback.command({ channelId: 22, type: "live" });
    },
    "programme expired": (f) => {
        f.advance(3600);
    },
    "same-ID catalog replacement": (f) => {
        f.c.channels = { 11: { rec: 1 } };
    },
    "source changed": (f) => {
        f.c.p_pref = "replacement";
    },
    "stopped session": (f) => {
        f.c.__ottClassicPlayback.command({ type: "stop" });
    },
};
// Compatibility projections and row reordering cannot change the accepted identity.
for (const mutate of [
    (f) => f.c.cats.All.reverse(),
    (f) => {
        f.c.listEpgArray = [];
    },
    (f) => {
        f.c.listArray[0].time--;
    },
]) {
    const f = fixture(true);
    f.c.selectEpg();
    mutate(f);
    f.prompts[0]();
    assert.deepEqual(playbackCalls(f), [["archive", 999940]]);
    assert.deepEqual(
        f.calls.filter((row) => row[0] === "select"),
        [["select", 0, f.c.cats.All.indexOf(11)]],
        "Re-resolve the authorized channel after projection changes"
    );
}
for (const [name, mutate] of Object.entries(mutations)) {
    const f = fixture(true);
    f.c.selectEpg();
    mutate(f);
    f.prompts[0]();
    assert.deepEqual(
        f.calls,
        [],
        "Retired PIN selection must be inert: " + name
    );
}
{
    const f = fixture();
    f.c.showPlaybackSeekDialog(10);
    const first = f.timers[0];
    f.c.dialogBoxKeyHandler(f.c.keys.UP);
    const last = f.timers.at(-1);
    assert.equal(last.delay, 3000);
    first.callback();
    assert.deepEqual(playbackCalls(f), [], "Cleared timer cannot submit early");
    last.callback();
    first.callback();
    assert.deepEqual(
        playbackCalls(f),
        [["seek", 70]],
        "Only one accumulated seek"
    );
}
for (const action of [
    "enter",
    "return",
    "stop",
    "cancel",
    "catalog",
    "source",
    "replacement dialog",
]) {
    const f = fixture();
    f.c.showPlaybackSeekDialog(10);
    const delayed = f.timers[0];
    if (action === "enter") f.c.dialogBoxKeyHandler(f.c.keys.ENTER);
    if (action === "return") f.c.dialogBoxKeyHandler(f.c.keys.RETURN);
    if (action === "stop") f.c.__ottClassicPlayback.command({ type: "stop" });
    if (action === "cancel") f.c.__ottClassicPlayback.cancel();
    if (action === "catalog") f.c.channels = { 11: { rec: 24 } };
    if (action === "source") f.c.p_pref = "replacement";
    if (action === "replacement dialog") f.c.dialogBoxKeyHandler = () => {};
    const hides = f.calls.filter((row) => row[0] === "hide").length;
    delayed.callback();
    assert.deepEqual(
        playbackCalls(f),
        action === "enter" ? [["seek", 10]] : [],
        action
    );
    if (["stop", "catalog", "source", "replacement dialog"].includes(action))
        assert.equal(
            f.calls.filter((row) => row[0] === "hide").length,
            hides,
            "No stale dialog mutation: " + action
        );
}
{
    const f = fixture();
    f.c.showPlaybackSeekDialog(10);
    const old = f.timers[0];
    f.c.showPlaybackSeekDialog(20);
    old.callback();
    assert.deepEqual(f.calls, [], "Old dialog cannot hide the replacement");
    f.timers.at(-1).callback();
    assert.deepEqual(playbackCalls(f), [["seek", 20]]);
}
console.log(
    "PASS archive entrypoints: captured PIN selection/expiry and one-shot source-bound seek dialogs (22 scenarios)"
);

function seekPreviewFixture(kind = "archive", duration = 600) {
    const f = fixture();
    const { c } = f;
    const { JSDOM } = require("jsdom");
    const root = path.resolve(__dirname, "..");
    const dom = new JSDOM(
        fs.readFileSync(path.join(root, "index.html"), "utf8"),
        {
            runScripts: "outside-only",
        }
    );
    dom.window.eval(
        fs.readFileSync(path.join(root, "js/jquery-1.11.1.min.js"), "utf8")
    );
    const uiSource = ts.createSourceFile(
        "ui.ts",
        ["src/ui/index.ts", "src/utils/helpers.ts"]
            .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
            .join("\n"),
        ts.ScriptTarget.Latest,
        true
    );
    vm.runInContext(
        ts.transpileModule(
            uiSource.statements
                .filter(
                    (node) =>
                        ts.isFunctionDeclaration(node) &&
                        [
                            "_t2",
                            "formatClockTime",
                            "formatPlaybackTime",
                            "formatTwoDigits",
                            "formatSeekOffset",
                            "virtualTimeshiftProg",
                            "initBackgroundIntervals",
                            "infoBarHide",
                        ].includes(node.name?.text)
                )
                .map((node) => node.getText(uiSource).replace(/^export /, ""))
                .join("\n"),
            {
                compilerOptions: { target: ts.ScriptTarget.ES5 },
            }
        ).outputText,
        c
    );
    let position = 300;
    let tick;
    Object.assign(c, {
        _prog100: { time: 999000, time_to: 1000200 },
        $: dom.window.$,
        $infoBar: dom.window.$("#info1"),
        addEventListener: dom.window.addEventListener.bind(dom.window),
        clearInterval() {},
        document: dom.window.document,
        getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
        infoTimeout: null,
        innerWidth: 1000,
        removeEventListener: dom.window.removeEventListener.bind(dom.window),
        setInfoInteraction() {},
        setInterval(callback, delay) {
            if (delay === 1000) tick = callback;
            return delay;
        },
        showChannelInfo: () => c.$("#info1").show(),
        sInfoRew: 1,
        stbGetLen: () => duration,
        stbGetPosTime: () => position,
        stbSetPosTime: (value) => f.calls.push(["seek", value]),
    });
    Object.assign(c.keys, { LEFT: 37, RIGHT: 39 });
    c.shiftArchive = (delta) => {
        f.calls.push(["request", delta]);
        c.__ottClassicPlayback.shift(delta);
    };
    c.__ottClassicPlayback.command(
        kind === "vod"
            ? { channelId: 11, type: "finite-channel" }
            : kind === "archive"
              ? { archiveStart: 999000, channelId: 11, type: "archive" }
              : { channelId: 11, type: "live" }
    );
    c.__ottClassicPlayback.command({ type: "playing" });
    c.__ottClassicPlayback.command({ duration, position, type: "position" });
    c.$("#progress").css("width", "50%");
    const bar = c.document.getElementById("progress_div");
    const marker = c.document.getElementById("progress_span");
    const label = marker.querySelector("span");
    let visible = true;
    let left = 100;
    let width = 800;
    bar.getBoundingClientRect = () => ({
        bottom: 608,
        height: visible ? 8 : 0,
        left,
        right: left + width,
        top: 600,
        width: visible ? width : 0,
    });
    Object.defineProperty(marker, "offsetWidth", { value: 18 });
    label.getBoundingClientRect = () => ({
        left: parseFloat(marker.style.left) || 0,
        right: (parseFloat(marker.style.left) || 0) + 90,
    });
    f.calls.length = 0;
    f.timers.length = 0;
    c.initBackgroundIntervals();
    return {
        ...f,
        bar,
        dom,
        hide: () => {
            visible = false;
        },
        label,
        marker,
        move: (nextLeft, nextWidth) => {
            left = nextLeft;
            width = nextWidth;
            dom.window.dispatchEvent(new dom.window.Event("resize"));
        },
        position: (value) => {
            position = value;
            c.__ottClassicPlayback.command({
                duration,
                position,
                type: "position",
            });
        },
        show: () => {
            visible = true;
            c.$("#info1").show();
        },
        text: () => label.textContent,
        tick,
    };
}

{
    const f = seekPreviewFixture();
    const { c, marker } = f;
    const programme = c._prog100;
    c.showPlaybackSeekDialog(-60);
    assert.equal(
        marker.style.display,
        "block",
        "Keyboard seek displays the shared target marker"
    );
    assert.equal(f.text(), c.formatClockTime(999240));
    assert.equal(marker.style.left, "251px");
    assert.deepEqual(
        f.calls,
        [],
        "Preview does not seek, open a source, or enqueue transport"
    );
    assert.equal(c.playTime, 300);
    assert.equal(
        c._prog100,
        programme,
        "Preview cannot replace the guide window"
    );
    assert.equal(
        c.$("#progress")[0].style.width,
        "50%",
        "Actual progress stays unchanged"
    );
    c.dialogBoxKeyHandler(c.keys.UP);
    assert.notEqual(
        marker.style.display,
        "block",
        "Zero offset is a no-op target"
    );
    c.dialogBoxKeyHandler(c.keys.LEFT);
    assert.equal(f.text(), c.formatClockTime(999290));
    c.dialogBoxKeyHandler(c.keys.ENTER);
    assert.notEqual(marker.style.display, "block");
    assert.deepEqual(
        f.calls,
        [["request", -10]],
        "Only Enter submits the accumulated offset"
    );
    assert.equal(
        f.timers.at(-1).delay,
        500,
        "Existing transport debounce is preserved"
    );
    f.timers.at(-1).callback();
    assert.deepEqual(playbackCalls(f), [["archive", 999290]]);
    f.dom.window.close();
}
for (const kind of ["live", "archive", "vod"]) {
    const f = seekPreviewFixture(kind);
    f.c.showPlaybackSeekDialog(-60);
    assert.equal(
        f.text(),
        kind === "vod"
            ? "04:00"
            : f.c.formatClockTime(kind === "live" ? 999940 : 999240)
    );
    f.position(320);
    f.c.dialogBoxKeyHandler(f.c.keys.RIGHT);
    assert.equal(
        f.text(),
        kind === "vod"
            ? "04:30"
            : f.c.formatClockTime(kind === "live" ? 999950 : 999270)
    );
    assert.deepEqual(f.calls, []);
    f.timers.at(-1).callback();
    assert.notEqual(
        f.marker.style.display,
        "block",
        "Timeout removes the pending target"
    );
    assert.deepEqual(f.calls, [["request", -50]]);
    f.dom.window.close();
}
for (const [duration, delta, expected] of [
    [600, -1000, "00:00"],
    [600, 1000, null],
    [0, 10, null],
]) {
    const f = seekPreviewFixture("vod", duration);
    f.c.showPlaybackSeekDialog(delta);
    if (expected) assert.equal(f.text(), expected);
    else
        assert.notEqual(
            f.marker.style.display,
            "block",
            "No marker for unavailable or rejected finite target"
        );
    assert.deepEqual(f.calls, []);
    f.dom.window.close();
}
{
    const f = seekPreviewFixture();
    f.c.showPlaybackSeekDialog(-999999);
    assert.equal(
        f.text(),
        f.c.formatClockTime(996400),
        "Archive retention clamps the preview via shared policy"
    );
    assert.equal(
        f.marker.style.left,
        "100px",
        "Off-window target clamps marker, retaining true timestamp"
    );
    f.c.dialogBoxKeyHandler(f.c.keys.RETURN);
    assert.notEqual(f.marker.style.display, "block");
    assert.deepEqual(playbackCalls(f), []);
    f.c.showPlaybackSeekDialog(999999);
    assert.equal(
        f.text(),
        f.c.formatClockTime(1000000),
        "Past-live target previews live edge"
    );
    f.c.dialogBoxKeyHandler(f.c.keys.EXIT);
    assert.notEqual(f.marker.style.display, "block");
    f.dom.window.close();
}
{
    const f = seekPreviewFixture();
    delete f.c._prog100;
    f.c.showPlaybackSeekDialog(-60);
    assert.equal(f.text(), f.c.formatClockTime(999240));
    assert.equal(
        f.c._prog100,
        undefined,
        "Virtual preview does not publish fake guide state"
    );
    assert.ok(Number.isFinite(parseFloat(f.marker.style.left)));
    f.move(200, 400);
    assert.ok(
        parseFloat(f.marker.style.left) >= 200 &&
            parseFloat(f.marker.style.left) <= 582
    );
    f.dom.window.close();
}
for (const action of [
    "cancel",
    "stop",
    "source",
    "catalog",
    "hidden footer",
    "replacement dialog",
]) {
    const f = seekPreviewFixture();
    f.c.showPlaybackSeekDialog(-60);
    const timer = f.timers.at(-1);
    if (action === "cancel") f.c.__ottClassicPlayback.cancel();
    if (action === "stop") f.c.__ottClassicPlayback.command({ type: "stop" });
    if (action === "source") f.c.p_pref = "other-source";
    if (action === "catalog") f.c.channels = { 11: { rec: 1 } };
    if (action === "hidden footer") f.hide();
    if (action === "replacement dialog") f.c.dialogBoxKeyHandler = () => {};
    f.tick(); // Execute the real normal UI clock callback after retirement.
    assert.notEqual(f.marker.style.display, "block", action);
    assert.equal(f.marker.__ottSeekPreviewOwner, undefined, action);
    if (action !== "hidden footer") {
        timer.callback();
        assert.deepEqual(
            playbackCalls(f),
            [],
            "Retired preview cannot commit: " + action
        );
    }
    f.dom.window.close();
}
{
    const f = seekPreviewFixture();
    f.c.showPlaybackSeekDialog(-60);
    const old = f.timers.at(-1);
    f.c.showPlaybackSeekDialog(-120);
    const owner = f.marker.__ottSeekPreviewOwner;
    old.callback();
    assert.equal(f.marker.__ottSeekPreviewOwner, owner);
    assert.equal(f.marker.style.display, "block");
    assert.equal(f.text(), f.c.formatClockTime(999180));
    // Hover has its own target; an old keyboard owner's cleanup cannot hide it.
    delete f.marker.__ottSeekPreviewOwner;
    f.label.textContent = "hover target";
    // An old timeout must leave a newer mouse-owned target alone.
    f.c.dialogBoxKeyHandler = () => {};
    f.timers.at(-1).callback();
    assert.equal(f.marker.style.display, "block");
    assert.equal(f.text(), "hover target");
    f.dom.window.close();
}
console.log(
    "PASS seek target preview: archive/live/VOD policy, delayed commit, cancel/reset ownership, virtual timeline and resize"
);
{
    const f = seekPreviewFixture("vod");
    f.c.__ottClassicPlayback.command({ type: "pause" });
    f.c.showPlaybackSeekDialog(10);
    f.advance(20);
    f.tick();
    assert.equal(
        f.text(),
        "05:10",
        "Paused VOD target does not advance with wall clock"
    );
    f.c.infoBarHide();
    assert.notEqual(f.marker.style.display, "block");
    assert.equal(f.marker.__ottSeekPreviewOwner, undefined);
    f.dom.window.close();
}
{
    const f = seekPreviewFixture();
    f.c.sInfoRew = 0;
    f.hide();
    f.c.showPlaybackSeekDialog(-60);
    assert.notEqual(
        f.marker.style.display,
        "block",
        "Hidden footer cannot leave a detached marker"
    );
    f.dom.window.close();
}
{
    const f = seekPreviewFixture("live");
    f.c.channels[11].rec = 0;
    f.c.showPlaybackSeekDialog(-60);
    assert.notEqual(
        f.marker.style.display,
        "block",
        "Live without archive has no seek preview"
    );
    assert.deepEqual(f.calls, []);
    f.dom.window.close();
}
{
    const f = seekPreviewFixture();
    const modern = f.c.document.createElement("div");
    modern.id = "modernPlayer";
    f.c.document.body.appendChild(modern);
    modern.appendChild(f.bar);
    f.c.$("#info1").hide();
    f.c.sInfoRew = 0;
    f.c.showPlaybackSeekDialog(-60);
    assert.equal(
        f.marker.style.display,
        "block",
        "Moved Modern timeline remains eligible without Classic footer"
    );
    f.dom.window.close();
}

{
    const f = seekPreviewFixture("vod");
    f.c.stbGetPosTime = () => {
        f.c.__ottClassicPlayback.cancel();
        return 300;
    };
    f.c.showPlaybackSeekDialog(-60);
    assert.notEqual(
        f.marker.style.display,
        "block",
        "Reentrant sampling cancellation cannot paint a retired target"
    );
    assert.equal(f.marker.__ottSeekPreviewOwner, undefined);
    assert.equal(
        f.timers.length,
        0,
        "Retired refresh cannot arm a new submit timer"
    );
    assert.deepEqual(playbackCalls(f), []);
    f.dom.window.close();
}

{
    const f = seekPreviewFixture("vod");
    const replacement = () => {};
    f.c.stbGetPosTime = () => {
        f.c.dialogBoxKeyHandler = replacement;
        return 300;
    };
    f.c.showPlaybackSeekDialog(-60);
    assert.equal(f.c.dialogBoxKeyHandler, replacement);
    assert.notEqual(
        f.marker.style.display,
        "block",
        "Sampling cannot paint after another dialog takes ownership"
    );
    assert.equal(f.marker.__ottSeekPreviewOwner, undefined);
    assert.equal(f.timers.length, 0);
    assert.deepEqual(playbackCalls(f), []);
    f.dom.window.close();
}

{
    const f = seekPreviewFixture("vod");
    const replacement = () => {};
    const guard = f.c.__ottClassicPlayback.guard;
    f.c.__ottClassicPlayback.guard = (callback) => {
        const submit = guard(callback);
        const current = submit.current;
        let reads = 0;
        submit.current = () => {
            if (++reads === 3) f.c.dialogBoxKeyHandler = replacement;
            return current();
        };
        return submit;
    };
    f.c.showPlaybackSeekDialog(-60);
    assert.equal(f.c.dialogBoxKeyHandler, replacement);
    assert.notEqual(
        f.marker.style.display,
        "block",
        "Final liveness read cannot repaint a replacement dialog's marker"
    );
    assert.equal(f.marker.__ottSeekPreviewOwner, undefined);
    assert.equal(f.timers.length, 0);
    f.dom.window.close();
}

{
    const f = seekPreviewFixture("vod");
    f.c.showPlaybackSeekDialog(10);
    const pending = f.c.__ottSeekPreview;
    f.hide();
    f.c.infoBarHide();
    f.tick();
    assert.notEqual(f.marker.style.display, "block");
    assert.equal(f.marker.__ottSeekPreviewOwner, undefined);
    assert.equal(
        f.c.__ottSeekPreview,
        pending,
        "Hiding does not retire the pending seek"
    );
    f.position(360);
    f.show();
    f.tick();
    assert.equal(f.marker.style.display, "block");
    assert.equal(
        f.text(),
        "06:10",
        "Reopened timeline refreshes the latest pending target"
    );
    assert.deepEqual(playbackCalls(f), []);
    f.c.dialogBoxKeyHandler(f.c.keys.ENTER);
    assert.equal(f.c.__ottSeekPreview, undefined);
    assert.deepEqual(
        f.calls.filter((call) => call[0] === "request"),
        [["request", 10]]
    );
    f.dom.window.close();
}
{
    const f = seekPreviewFixture("vod");
    f.c.showPlaybackSeekDialog(10);
    const timer = f.timers.at(-1);
    // These are the actual uiInit mousemove ownership effects, tested there too.
    f.c.__ottSeekPreview.suspended = true;
    delete f.marker.__ottSeekPreviewOwner;
    f.label.textContent = "pointer target";
    f.move(200, 400);
    f.tick();
    assert.equal(
        f.text(),
        "pointer target",
        "Resize and clock preserve pointer priority"
    );
    assert.equal(f.marker.style.display, "block");
    timer.callback();
    assert.equal(
        f.text(),
        "pointer target",
        "Keyboard commit does not erase the pointer label"
    );
    assert.equal(f.marker.style.display, "block");
    assert.equal(f.marker.__ottSeekPreviewOwner, undefined);
    assert.equal(f.c.__ottSeekPreview, undefined);
    assert.deepEqual(
        f.calls.filter((call) => call[0] === "request"),
        [["request", 10]]
    );
    f.dom.window.close();
}
{
    const f = seekPreviewFixture("vod");
    f.c.showPlaybackSeekDialog(10);
    f.c.__ottSeekPreview.suspended = true;
    delete f.marker.__ottSeekPreviewOwner;
    f.label.textContent = "pointer target";
    f.c.dialogBoxKeyHandler(f.c.keys.RIGHT);
    assert.equal(
        f.text(),
        "05:20",
        "An explicit key reclaims the pending target"
    );
    assert.equal(f.marker.__ottSeekPreviewOwner, f.c.__ottSeekPreview);
    f.c.dialogBoxKeyHandler(f.c.keys.RETURN);
    assert.equal(f.c.__ottSeekPreview, undefined);
    assert.deepEqual(playbackCalls(f), []);
    f.dom.window.close();
}
console.log(
    "PASS seek preview lifecycle: hide/reopen, pointer resize/timeout priority and explicit keyboard reclaim"
);
