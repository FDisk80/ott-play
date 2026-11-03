const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");
const { JSDOM } = require("jsdom");

const source = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/ui/modern-player.ts"), "utf8"),
    { compilerOptions: { target: ts.ScriptTarget.ES5 } }
).outputText;

function fixture(t, kind = "vod") {
    const dom = new JSDOM(
        `<!doctype html><body><video id="video"></video>
        <div id="info1" style="display:none">
          <div id="channel"><div id="channel_name">Test video</div>
            <div id="progress_div"><div id="progress" style="width:25%"></div></div>
            <div id="begin_time"></div><div id="end_time"></div>
          </div><div id="video_res"></div>
        </div><div id="list"></div></body>`,
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
            snapshot: () => ({ phase: "playing", target: { kind } }),
        },
        __ottClassicScreenPort: { screens: { current: () => null } },
        __ottInterfaceModeState: { effective: 1, status: "modern" },
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
        playType: kind === "vod" ? -1 : 0,
        settings: { interfaceMode: 1 },
        showChannelInfo: record("showChannelInfo"),
        showShift: record("showShift"),
        sInterfaceMode: 1,
        stbIsPlaying: () => true,
        stbPause: record("stbPause"),
    });
    const video = w.document.getElementById("video");
    Object.defineProperty(video, "duration", {
        configurable: true,
        value: 600,
    });
    video.currentTime = 300;
    w.eval(source);
    const api = w.__ottModernPlayerFactory(w);
    t.after(() => {
        api.destroy();
        dom.window.close();
    });
    function open() {
        api.refresh();
        w.document.getElementById("info1").style.display = "block";
        api.sync();
    }
    return { api, calls, open, video, w };
}

test("Modern finite timeline resets to zero when playback seeks to the start", (t) => {
    const { api, open, video, w } = fixture(t);
    open();
    const fill = w.document.getElementById("progress");
    const slider = w.document.getElementById("progress_div");
    assert.equal(fill.style.width, "50%");
    video.currentTime = 0;
    api.sync();
    assert.equal(fill.style.width, "0%");
    assert.equal(slider.getAttribute("aria-valuenow"), "0");
});

test("Modern uses shared progress only until finite timing becomes available", (t) => {
    const { api, open, video, w } = fixture(t);
    Object.defineProperty(video, "duration", { value: NaN });
    video.currentTime = 0;
    open();
    const fill = w.document.getElementById("progress");
    assert.equal(fill.style.width, "25%");
    Object.defineProperty(video, "duration", { value: 600 });
    api.sync();
    assert.equal(fill.style.width, "0%");
    assert.equal(
        w.document.getElementById("progress_div").getAttribute("aria-valuenow"),
        "0"
    );
});

for (const timing of [
    { duration: Infinity, position: 120 },
    { duration: 600, position: Infinity },
    { duration: 600, position: NaN },
]) {
    test(`Modern keeps shared progress for unavailable timing ${timing.position}/${timing.duration}`, (t) => {
        const { open, video, w } = fixture(t);
        Object.defineProperties(video, {
            currentTime: { value: timing.position },
            duration: { value: timing.duration },
        });
        open();
        assert.equal(w.document.getElementById("progress").style.width, "25%");
        assert.equal(
            w.document
                .getElementById("progress_div")
                .getAttribute("aria-valuenow"),
            "25"
        );
    });
}

for (const kind of ["archive", "live"]) {
    test(`Modern keeps shared progress for an unbounded ${kind} interval`, (t) => {
        const { open, w } = fixture(t, kind);
        w._prog100 = { time: 1000, time_to: Infinity };
        w.playType = 1120;
        open();
        assert.equal(w.document.getElementById("progress").style.width, "25%");
    });
}

for (const kind of ["vod", "archive"]) {
    test(`Modern ${kind} hides unknown remaining time until duration is available`, (t) => {
        const { api, open, video, w } = fixture(t, kind);
        video.currentTime = 120;
        Object.defineProperty(video, "duration", { value: Infinity });
        w._prog100 = { time: 1000, time_to: Infinity };
        w.playType = kind === "archive" ? 1120 : -1;
        open();
        const elapsed = w.document.querySelector(".modern-player-elapsed");
        const remaining = w.document.querySelector(".modern-player-remaining");
        const slider = w.document.getElementById("progress_div");
        assert.equal(elapsed.textContent, "2:00");
        assert.equal(remaining.textContent, "");
        assert.equal(remaining.hidden, true);
        assert.equal(slider.getAttribute("aria-valuetext"), "2:00");
        Object.defineProperty(video, "duration", { value: 600 });
        w._prog100.time_to = 1600;
        api.sync();
        assert.equal(remaining.textContent, "-8:00");
        assert.equal(remaining.hidden, false);
        assert.equal(slider.getAttribute("aria-valuetext"), "2:00 / 8:00");
    });
}

test("Modern does not expose non-finite calculated archive times", (t) => {
    const { open, w } = fixture(t, "archive");
    w._prog100 = { time: NaN, time_to: 1600 };
    w.playType = 1120;
    open();
    for (const label of ["elapsed", "remaining"]) {
        const element = w.document.querySelector(".modern-player-" + label);
        assert.equal(element.textContent, "");
        assert.equal(element.hidden, true);
    }
    assert.equal(
        w.document
            .getElementById("progress_div")
            .getAttribute("aria-valuetext"),
        "0:00"
    );
});

test("Modern archive progress reaches zero at the programme start", (t) => {
    const { api, open, w } = fixture(t, "archive");
    w._prog100 = { time: 1000, time_to: 1600 };
    w.playType = 1300;
    open();
    const fill = w.document.getElementById("progress");
    assert.equal(fill.style.width, "50%");
    w.playType = 1000;
    api.sync();
    assert.equal(fill.style.width, "0%");
});

test("Modern live progress starts at zero when the programme changes", (t) => {
    const { api, open, w } = fixture(t, "live");
    w.Date.now = () => 1300000;
    w._prog100 = { time: 1000, time_to: 1600 };
    open();
    const fill = w.document.getElementById("progress");
    assert.equal(fill.style.width, "50%");
    w._prog100 = { time: 1300, time_to: 1900 };
    api.sync();
    assert.equal(fill.style.width, "0%");
});

function statusFixture(t) {
    const f = fixture(t);
    const { open, w } = f;
    const details = w.document.getElementById("video_res");
    details.textContent = "Playback diagnostics";
    details.setAttribute("role", "button");
    let opened = 0;
    details.addEventListener("click", () => opened++);
    open();
    return {
        ...f,
        details,
        opened: () => opened,
        status: w.document.querySelector(".modern-player-status"),
    };
}

for (const key of ["Enter", " ", "Spacebar"]) {
    test(`Modern focused playback status opens details on ${JSON.stringify(key)}`, (t) => {
        const { calls, opened, status, w } = statusFixture(t);
        status.focus();
        assert.equal(w.document.activeElement, status);
        const event = new w.KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key,
        });
        status.dispatchEvent(event);
        assert.equal(event.defaultPrevented, true);
        assert.equal(opened(), 1, "focused status opens playback details");
        assert.equal(
            calls.some(([name]) => name === "stbPause"),
            false
        );
    });
}

test("Modern focused playback status accepts native remote Enter", (t) => {
    const { api, calls, opened, status } = statusFixture(t);
    status.focus();
    assert.equal(api.handleKey({ keyCode: 13 }), true);
    assert.equal(opened(), 1);
    assert.equal(
        calls.some(([name]) => name === "stbPause"),
        false
    );
});

for (const owner of ["dialog", "kiosk"]) {
    test(`Modern status keys retain ${owner} input priority`, (t) => {
        const { api, calls, opened, status, w } = statusFixture(t);
        status.focus();
        if (owner === "dialog") w.dialogBoxKeyHandler = () => {};
        else w.__ottKiosk = { locked: () => true };
        for (const key of ["Enter", " "]) {
            assert.equal(api.handleKey({ key }), false);
        }
        assert.equal(opened(), 0);
        assert.deepEqual(calls, []);
    });
}

test("Modern refresh preserves status focus after leaving the action rail", (t) => {
    const { api, status, w } = statusFixture(t);
    w.document.querySelector('[data-modern-player-action="play"]').focus();
    assert.equal(api.state().group, "actions");
    status.focus();
    api.sync();
    assert.equal(w.document.activeElement, status);
    assert.equal(api.state().group, "status");
});

for (const update of ["removed", "informational"]) {
    test(`Modern returns focus to visible controls when status is ${update}`, (t) => {
        const { api, details, status, w } = statusFixture(t);
        status.focus();
        if (update === "removed") details.textContent = "";
        else details.removeAttribute("role");
        api.sync();
        assert.equal(
            w.document.activeElement.getAttribute("data-modern-player-action"),
            "play"
        );
        assert.equal(api.state().group, "actions");
    });
}

test("Modern status focus promotes passive information without moving to the scrubber", (t) => {
    const { api, status, w } = statusFixture(t);
    api.setInteractive(false);
    status.focus();
    assert.equal(api.state().interactive, true);
    assert.equal(api.state().group, "status");
    assert.equal(w.document.activeElement, status);
});

test("Modern leaves Space on the scrubber to existing playback shortcuts", (t) => {
    const { api, calls, open, w } = fixture(t);
    open();
    const status = w.document.querySelector(".modern-player-status");
    assert.notEqual(w.document.activeElement, status);
    const event = new w.KeyboardEvent("keydown", {
        cancelable: true,
        key: " ",
    });
    assert.equal(api.handleKey(event), false);
    assert.equal(event.defaultPrevented, false);
    assert.deepEqual(calls, []);
});
