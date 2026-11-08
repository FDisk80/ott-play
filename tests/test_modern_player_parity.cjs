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

for (const change of [
    { after: true, before: false, track: "audio" },
    { after: false, before: true, track: "audio" },
    { after: true, before: false, track: "subtitle" },
    { after: false, before: true, track: "subtitle" },
]) {
    test(`Modern action focus survives ${change.track} becoming ${change.after ? "available" : "unavailable"}`, (t) => {
        const { api, calls, open, w } = fixture(t);
        let available = change.before;
        w.stbAudioTracksExists = () =>
            change.track === "audio" ? available : true;
        w.stbSubtitleExists = () =>
            change.track === "subtitle" ? Number(available) : 1;
        w.stbToggleAspectRatio = () => calls.push(["aspect"]);
        w.stbToggleAudioTrack = () => calls.push(["audio"]);
        w.stbToggleSubtitle = () => calls.push(["subtitle"]);
        w.channelsList = () => calls.push(["list"]);
        open();
        const action = (name) =>
            w.document.querySelector(`[data-modern-player-action="${name}"]`);
        action("aspect").focus();
        available = change.after;
        api.sync();
        assert.equal(w.document.activeElement, action("aspect"));
        assert.equal(api.handleKey({ keyCode: w.keys.ENTER }), true);
        assert.deepEqual(
            calls.filter(([name]) =>
                ["aspect", "audio", "subtitle", "list"].includes(name)
            ),
            [["aspect"]]
        );
        assert.equal(api.handleKey({ keyCode: w.keys.RIGHT }), true);
        assert.equal(w.document.activeElement, action("list"));
        api.handleKey({ keyCode: w.keys.ENTER });
        assert.equal(calls.at(-1)[0], "list");
    });
}

test("Modern action focus moves to a visible neighbor when its track disappears", (t) => {
    const { api, calls, open, w } = fixture(t);
    let available = true;
    w.stbAudioTracksExists = () => true;
    w.stbSubtitleExists = () => Number(available);
    w.stbToggleAspectRatio = () => calls.push(["aspect"]);
    open();
    w.document.querySelector('[data-modern-player-action="subtitle"]').focus();
    available = false;
    api.sync();
    assert.equal(
        w.document.activeElement.getAttribute("data-modern-player-action"),
        "aspect"
    );
    assert.equal(api.handleKey({ keyCode: w.keys.ENTER }), true);
    assert.deepEqual(
        calls.filter(([name]) => name === "aspect"),
        [["aspect"]]
    );
});

test("Modern seek visibility follows the shipped planner through live/finite transitions", (t) => {
    const { api, calls, open, w } = fixture(t);
    w.eval(
        fs.readFileSync(
            path.join(__dirname, "../vendor/ottplay-core.js"),
            "utf8"
        )
    );
    let kind = "vod",
        archiveAvailable = false;
    w.shiftArchive = (delta) => calls.push(["seek", delta]);
    w.__ottClassicPlayback.snapshot = () => ({
        generation: kind,
        phase: "playing",
        target: { channelId: "current", kind },
    });
    w.__ottClassicPlayback.context = () => ({
        isCurrent: () => true,
        previewOffset: (value) => ({
            plan: w.OttPlayCore.playbackSeekPlan(
                { channelId: "current", kind, sourceId: "source" },
                {
                    archiveAvailable,
                    duration: 600,
                    intent: "offset",
                    now: 1700000000,
                    position: 300,
                    value,
                }
            ),
        }),
    });
    open();
    const rewind = w.document.querySelector(
        '[data-modern-player-action="rewind"]'
    );
    const forward = w.document.querySelector(
        '[data-modern-player-action="forward"]'
    );
    assert.equal(rewind.hidden, false);
    rewind.click();
    assert.deepEqual(
        calls.filter(([name]) => name === "seek"),
        [["seek", -10]]
    );
    rewind.focus();
    kind = "live";
    w.playType = 0;
    api.sync();
    assert.equal(rewind.hidden, true);
    assert.equal(forward.hidden, true, "restart is not a seek capability");
    assert.equal(
        w.document.querySelector('[data-modern-player-action="play"]').hidden,
        true
    );
    assert.notEqual(w.document.activeElement, rewind);
    archiveAvailable = true;
    api.sync();
    assert.equal(rewind.hidden, false);
    assert.equal(
        forward.disabled,
        true,
        "live restart is not advertised as forward seeking"
    );
    assert.equal(
        w.document.querySelector('[data-modern-player-action="play"]').hidden,
        false
    );
    assert.equal(
        calls.filter(([name]) => name === "seek").length,
        1,
        "capability inspection never seeks"
    );
});

test("Favorites waits for the shared mutation and reflects confirmed membership", async (t) => {
    const { api, open, w } = fixture(t);
    let present = false,
        complete,
        admission,
        toggles = 0;
    const entry = {
        locator: { kind: "plex-media", ratingKey: "42", serverId: "server-1" },
        origin: {
            profile: "Plex",
            provider: "plex",
            sourceAlias: "server-1",
            subprofile: null,
        },
        title: "Movie",
    };
    const { createGlobalFavoritesPortableCodec } =
        require("./global-favorites-fixture.cjs").load(
            "src/settings/global-favorites-portable.ts"
        );
    w.__ottGlobalFavorites = {
        codec: createGlobalFavoritesPortableCodec(),
        currentItem: async () => ({ current: () => true, entry }),
        store: {
            snapshot: async () => ({
                current: () => true,
                entries: present ? [{ ...entry, id: "favorite-uuid" }] : [],
            }),
        },
        toggle: (_payload, current) => {
            toggles++;
            admission = current;
            return new Promise((resolve) => {
                complete = () => {
                    present = true;
                    resolve();
                };
            });
        },
    };
    open();
    await new Promise(setImmediate);
    const button = w.document.querySelector(
        '[data-modern-player-action="favorite"]'
    );
    assert.equal(button.getAttribute("aria-pressed"), "false");
    button.click();
    button.click();
    await new Promise(setImmediate);
    assert.equal(toggles, 1);
    assert.equal(button.disabled, true);
    assert.equal(admission(), true);
    complete();
    await new Promise(setImmediate);
    assert.equal(button.disabled, false);
    assert.equal(button.getAttribute("aria-pressed"), "true");
    api.sync();
    assert.equal(toggles, 1);
});

test("Favorites ignores a late membership result from the replaced playback target", async (t) => {
    const { api, open, w } = fixture(t);
    let item = "A";
    const pending = [];
    w.__ottClassicPlayback.snapshot = () => ({
        generation: item,
        target: { channelId: item, kind: "vod", sourceId: "provider" },
    });
    w.__ottGlobalFavorites = {
        codec: { identity: (value) => value.locator },
        currentItem: () =>
            new Promise((resolve) => pending.push({ item, resolve })),
        store: {
            snapshot: async () => ({
                current: () => true,
                entries: [{ locator: "A" }],
            }),
        },
        toggle: async () => {},
    };
    open();
    await new Promise(setImmediate);
    item = "B";
    api.sync();
    await new Promise(setImmediate);
    const button = w.document.querySelector(
        '[data-modern-player-action="favorite"]'
    );
    assert.equal(button.hasAttribute("aria-pressed"), false);
    pending
        .find((p) => p.item === "B")
        .resolve({ current: () => true, entry: { locator: "B" } });
    await new Promise(setImmediate);
    assert.equal(button.getAttribute("aria-pressed"), "false");
    pending
        .find((p) => p.item === "A")
        .resolve({ current: () => true, entry: { locator: "A" } });
    await new Promise(setImmediate);
    assert.equal(button.getAttribute("aria-pressed"), "false");
});

for (const changed of ["item", "profile", "load"]) {
    test(`Favorites lazy completion cannot cross ${changed} replacement or escape kiosk`, async (t) => {
        const { api, open, w } = fixture(t);
        let item = "A",
            loaded,
            toggles = 0,
            source = "profile-A";
        w.__ottSourceIdentity = { current: () => source };
        w.__ottCommandChannelLoad = {};
        w.__ottClassicPlayback.snapshot = () => ({
            generation: item,
            target: { channelId: item, kind: "vod", sourceId: "provider" },
        });
        w.__ottEnsureGlobalFavorites = (done) => {
            loaded = done;
        };
        open();
        const button = w.document.querySelector(
            '[data-modern-player-action="favorite"]'
        );
        button.click();
        assert.equal(button.disabled, true);
        if (changed === "item") item = "B";
        else if (changed === "profile") source = "profile-B";
        else w.__ottCommandChannelLoad = {};
        w.__ottGlobalFavorites = {
            toggle: async () => {
                toggles++;
            },
        };
        loaded();
        await new Promise(setImmediate);
        api.sync();
        assert.equal(toggles, 0);
        assert.equal(button.disabled, false);
        w.__ottKiosk = { enabled: () => true };
        button.click();
        await new Promise(setImmediate);
        assert.equal(toggles, 0);
    });
}

function action(w, id) {
    return w.document.querySelector(`[data-modern-player-action="${id}"]`);
}

function mediaNavigation(t, sourceId = "plex@media-library") {
    const f = fixture(t);
    const sequence = {
        index: 0,
        items: ["a", "b", "c"].map((itemId) => ({
            ref: { itemId, sourceId },
        })),
        repeat: "off",
    };
    let generation = 1;
    const current = { ref: sequence.items[0].ref, sequence };
    const state = {
        generation,
        phase: "playing",
        target: { channelId: "a", kind: "vod", sourceId },
    };
    f.w.__ottClassicPlayback.snapshot = () => state;
    f.w.__ottSourceIdentity = { current: () => "plex@account" };
    f.w.__ottMedia = {
        current: () => current,
        skip: (direction) => {
            f.calls.push(["skip", direction, current.ref.itemId]);
            sequence.index =
                (sequence.index + direction + sequence.items.length) %
                sequence.items.length;
            current.ref = sequence.items[sequence.index].ref;
            state.target.channelId = current.ref.itemId;
            state.generation = ++generation;
        },
        sourceId: () => sourceId,
    };
    return { ...f, current, sequence, state };
}

for (const provider of ["plex", "local"]) {
    test(`Modern ${provider} temporary queue uses the shipped source identity while M3U remains configured`, (t) => {
        const sourceId = provider + "@temporary";
        const { calls, current, open, state, w } = mediaNavigation(t, sourceId);
        const file = "src/media/classic-adapter.ts";
        const parsed = ts.createSourceFile(
            file,
            fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
            ts.ScriptTarget.Latest,
            true
        );
        const sourceIdFunction = parsed.statements.find(
            (node) =>
                ts.isFunctionDeclaration(node) &&
                node.name?.text === "classicMediaSourceId"
        );
        w.eval(
            ts.transpileModule(
                "var mediaClassicContext = null;\n" +
                    sourceIdFunction.getText(parsed),
                { compilerOptions: { target: ts.ScriptTarget.ES5 } }
            ).outputText
        );
        w.mediaClassicContext = { sourceId };
        current.context = w.mediaClassicContext;
        w.__ottMedia.sourceId = w.classicMediaSourceId;
        w.p_pref = "m3u";
        const configured = { id: "m3u" };
        w.__ottActiveProviderDriver = configured;
        w.__ottSourceIdentity = {
            current: () => "m3u@configured",
            media: () => "m3u@configured",
        };
        open();
        assert.equal(w.__ottMedia.sourceId(), state.target.sourceId);
        assert.equal(action(w, "next").hidden, false);
        action(w, "next").click();
        assert.equal(state.target.channelId, "b");
        assert.equal(calls.filter(([name]) => name === "skip").length, 1);
        assert.equal(w.p_pref, "m3u");
        assert.equal(w.__ottActiveProviderDriver, configured);
    });
}

test("Modern media Previous/Next dispatch once through the current queue and honor repeat-off bounds", (t) => {
    const { api, calls, open, sequence, state, w } = mediaNavigation(t);
    open();
    const previous = action(w, "previous");
    const next = action(w, "next");
    assert.equal(previous.hidden, false);
    assert.equal(previous.disabled, true);
    assert.equal(next.disabled, false);
    assert.equal(next.getAttribute("tabindex"), "0");
    previous.click();
    assert.equal(calls.length, 0);
    next.click();
    assert.deepEqual(
        calls.filter(([name]) => name === "skip"),
        [["skip", 1, "a"]]
    );
    assert.equal(state.target.channelId, "b");
    api.sync();
    assert.equal(previous.disabled, false);
    next.click();
    api.sync();
    assert.equal(state.target.channelId, "c");
    assert.equal(next.disabled, true);
    next.click();
    assert.equal(calls.filter(([name]) => name === "skip").length, 2);
    sequence.repeat = "all";
    api.sync();
    next.click();
    api.sync();
    assert.equal(state.target.channelId, "a");
    previous.click();
    assert.equal(state.target.channelId, "c");
    assert.equal(calls.filter(([name]) => name === "skip").length, 4);
});

for (const changed of [
    "item",
    "source",
    "driver",
    "load",
    "kiosk",
    "screen",
    "standby",
    "queue",
]) {
    test(`Modern navigation rechecks ${changed} ownership before dispatch`, (t) => {
        const { calls, current, open, state, w } = mediaNavigation(t);
        open();
        const next = action(w, "next");
        assert.equal(next.hidden, false);
        if (changed === "item") state.target.channelId = "unrelated";
        else if (changed === "source") state.target.sourceId = "other";
        else if (changed === "driver") w.__ottActiveProviderDriver = {};
        else if (changed === "load") w.__ottCommandChannelLoad = {};
        else if (changed === "kiosk") w.__ottKiosk = { enabled: () => true };
        else if (changed === "screen") w.isListVisible = true;
        else if (changed === "standby")
            w.__ottStandby = { blocked: () => true };
        else current.sequence = null;
        next.click();
        assert.equal(calls.filter(([name]) => name === "skip").length, 0);
    });
}

for (const unavailable of [
    "absent",
    "placeholder",
    "stale-index",
    "stale-source",
]) {
    test(`Modern hides navigation with an ${unavailable} media queue`, (t) => {
        const { current, open, sequence, w } = mediaNavigation(t);
        if (unavailable === "absent") current.sequence = null;
        else if (unavailable === "placeholder") sequence.placeholder = true;
        else if (unavailable === "stale-index") sequence.index = 1;
        else w.__ottMedia.sourceId = () => "other-library";
        open();
        assert.equal(action(w, "previous").hidden, true);
        assert.equal(action(w, "next").hidden, true);
    });
}

for (const kind of ["live", "archive", "vod"]) {
    test(`Modern ${kind} channel navigation uses the current shared list despite stale media`, (t) => {
        const { api, calls, open, w } = fixture(t, kind);
        const sourceId = "m3u@current";
        let generation = 1;
        let owned = true;
        Object.assign(w, {
            __ottChannels: {
                capture: () => ({
                    active: () => owned,
                    category: () => w.catIndex,
                    neighbours: () => ({
                        id: w.curList[w.primaryIndex],
                        index: w.primaryIndex,
                        length: w.curList.length,
                    }),
                }),
            },
            __ottMedia: {
                current: () => ({
                    ref: { itemId: "old-movie", sourceId: "plex@old" },
                }),
                skip: () => calls.push(["stale-media"]),
                sourceId: () => "plex@old",
            },
            __ottSourceIdentity: { current: () => sourceId },
            catIndex: 2,
            channels: { 7: {}, 8: {}, 9: {} },
            curList: [7, 8, 9],
            playChannel: (category, index) => {
                calls.push(["channel", category, index]);
                w.primaryIndex = index;
                generation++;
            },
            primaryIndex: 0,
        });
        w.catsArray = ["Unused", "Favorites", "All"];
        w.cats = { All: w.curList };
        w.__ottClassicPlayback.snapshot = () => ({
            generation,
            phase: "playing",
            target: {
                channelId:
                    (kind === "vod" ? "channel:" : "") +
                    w.curList[w.primaryIndex],
                kind,
                sourceId,
            },
        });
        const file = "src/key-handler/index.ts";
        const parsed = ts.createSourceFile(
            file,
            fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
            ts.ScriptTarget.Latest,
            true
        );
        const functions = parsed.statements.filter(
            (node) =>
                ts.isFunctionDeclaration(node) &&
                ["plusProg", "minusProg"].includes(node.name?.text)
        );
        w.eval(
            ts.transpileModule(
                functions
                    .map((node) =>
                        node.getText(parsed).replace(/^export\s+/, "")
                    )
                    .join("\n"),
                { compilerOptions: { target: ts.ScriptTarget.ES5 } }
            ).outputText
        );
        open();
        assert.equal(action(w, "next").hidden, false);
        action(w, "next").click();
        assert.deepEqual(
            calls.filter(([name]) => name === "channel"),
            [["channel", 2, 1]]
        );
        api.sync();
        action(w, "previous").click();
        api.sync();
        action(w, "previous").click();
        assert.equal(
            w.primaryIndex,
            2,
            "manual channel Previous wraps the shared list"
        );
        assert.equal(
            calls.some(([name]) => name === "stale-media"),
            false
        );
        api.sync();
        owned = false;
        action(w, "next").click();
        assert.equal(w.primaryIndex, 2, "a retired list cannot dispatch");
        api.sync();
        assert.equal(action(w, "next").hidden, true);
    });
}

for (const channelMedia of [false, true]) {
    test(`Modern ${channelMedia ? "channel-backed media" : "TV"} repaint reads only the current slot of a large live order`, (t) => {
        const { api, calls, open, w } = fixture(
            t,
            channelMedia ? "vod" : "live"
        );
        let reads = 0;
        const rows = Array.from({ length: 20000 }, (_, index) => index + 1);
        const order = new Proxy(rows, {
            get(target, property, receiver) {
                if (/^\d+$/.test(String(property))) {
                    reads++;
                    assert(
                        reads < 200,
                        "repaint must not scan the full channel list"
                    );
                }
                return Reflect.get(target, property, receiver);
            },
        });
        Object.assign(w, {
            __ottSourceIdentity: { current: () => "m3u@current" },
            catIndex: 0,
            cats: { All: order },
            catsArray: ["All"],
            channelLibraryIndex: (id) => (id === "system:all" ? 0 : -1),
            channelLibraryInstance: { active: () => true },
            channelLibraryView: [{ id: "system:all" }],
            channels: { 10001: {} },
            curList: order,
            minusProg: () => calls.push(["channel", -1]),
            plusProg: () => calls.push(["channel", 1]),
            primaryIndex: 10000,
        });
        // Exercise the shipped neighbours() implementation, including its
        // primaryIndex fast path and otherwise linear fallback.
        const file = "src/channels/classic-library.ts";
        const parsed = ts.createSourceFile(
            file,
            fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
            ts.ScriptTarget.Latest,
            true
        );
        const assignment = parsed.statements.find(
            (node) =>
                ts.isExpressionStatement(node) &&
                ts.isBinaryExpression(node.expression) &&
                node.expression.left.getText(parsed).includes(".__ottChannels")
        ).expression;
        const capture = assignment.right.properties.find(
            (node) => node.name?.getText(parsed) === "capture"
        );
        w.eval(
            ts.transpileModule(
                "window.__ottChannels = { capture: " +
                    capture.initializer.getText(parsed) +
                    " };",
                { compilerOptions: { target: ts.ScriptTarget.ES5 } }
            ).outputText
        );
        const originalCapture = w.__ottChannels.capture;
        w.__ottChannels.capture = (category) => {
            const captured = originalCapture(category);
            captured.members = () =>
                assert.fail("repaint must not copy channel members");
            return captured;
        };
        const sourceId = "m3u@current";
        const itemId = channelMedia ? "media:10001" : "10001";
        w.__ottClassicPlayback.snapshot = () => ({
            generation: 1,
            phase: "playing",
            target: {
                channelId: itemId,
                kind: channelMedia ? "vod" : "live",
                sourceId,
            },
        });
        if (channelMedia) {
            const current = {
                ref: { itemId, sourceId },
                sequence: {
                    channel: { id: 10001, list: w.__ottChannels.capture(0) },
                },
            };
            w.__ottMedia = {
                current: () => current,
                skip: (direction) => calls.push(["skip", direction]),
                sourceId: () => sourceId,
            };
        }
        open();
        for (let i = 0; i < 6; i++) api.sync();
        assert.equal(action(w, "next").hidden, false);
        action(w, "next").click();
        assert.equal(
            calls.filter(
                ([name]) => name === (channelMedia ? "skip" : "channel")
            ).length,
            1
        );
        // An equal-looking copy is not the currently published order.
        w.curList = rows.slice();
        api.sync();
        assert.equal(action(w, "next").hidden, true);
        w.curList = order;
        w.primaryIndex = 0;
        api.sync();
        assert.equal(
            action(w, "next").hidden,
            true,
            "a stale index never enters neighbours' scan fallback"
        );
        assert(reads < 200);
    });
}

for (const readOnly of [false, true]) {
    test(`Modern Favorites navigation follows the real shared mixed-source order once per move (read-only ${readOnly})`, async (t) => {
        const { api, calls, open, w } = fixture(t);
        w.sFavorites = readOnly ? -1 : 0;
        const { load } = require("./global-favorites-fixture.cjs");
        const codec = load(
            "src/settings/global-favorites-portable.ts"
        ).createGlobalFavoritesPortableCodec();
        const createNavigation = load(
            "src/media/global-favorites-navigation.ts"
        ).createGlobalFavoritesNavigation;
        const rows = [
            { locator: { channelId: "7", kind: "channel" }, provider: "m3u" },
            {
                locator: {
                    kind: "plex-media",
                    ratingKey: "42",
                    serverId: "pms",
                },
                provider: "plex",
            },
            {
                locator: {
                    kind: "local-media",
                    relativePath: "movie.mp4",
                    rootAlias: "Files",
                },
                provider: "local",
            },
        ].map(({ locator, provider }, index) => ({
            id: "favorite-" + index,
            locator,
            origin: {
                profile: provider,
                provider,
                sourceAlias: provider,
                subprofile: null,
            },
            title: "Item " + index,
        }));
        let selected = rows[0];
        let generation = 1;
        let revision = 1;
        let valid = true;
        const value = (row) => ({
            locator: row.locator,
            origin: row.origin,
            title: row.title,
        });
        const snapshot = async () => {
            const captured = revision;
            return {
                current: () => valid && captured === revision,
                entries: rows,
            };
        };
        const capture = () => {
            const row = selected;
            const captured = generation;
            return {
                current: () => valid && captured === generation,
                id: row.id,
                value: value(row),
            };
        };
        const navigation = createNavigation({
            allowed: () => valid,
            cancel: () => {},
            capture,
            current: () => valid,
            failed: (reason) => calls.push(["failed", reason]),
            identity: (row) => codec.identity(value(row)),
            select: (id) => {
                calls.push(["favorite-next", selected.origin.provider, id]);
                selected = rows.find((row) => row.id === id);
                generation++;
                return { result: Promise.resolve({ status: "ok" }) };
            },
            snapshot,
        });
        navigation.routeState({ id: selected.id, phase: "playing" });
        w.__ottClassicPlayback.snapshot = () => ({
            generation,
            phase: "playing",
            target: {
                channelId: selected.id,
                kind: selected.origin.provider === "m3u" ? "live" : "vod",
                sourceId: selected.origin.provider,
            },
        });
        w.__ottSourceIdentity = { current: () => selected.origin.provider };
        w.__ottMedia = {
            current: () => null,
            skip: () => calls.push(["media-skip"]),
        };
        w.plusProg = w.minusProg = () => calls.push(["channel-skip"]);
        w.__ottGlobalFavorites = {
            codec,
            currentItem: async () => {
                const captured = capture();
                return { current: captured.current, entry: captured.value };
            },
            navigation,
            store: { snapshot },
            toggle: async () => {},
        };
        async function settle() {
            for (let i = 0; i < 3; i++) await new Promise(setImmediate);
            api.sync();
            for (let i = 0; i < 3; i++) await new Promise(setImmediate);
        }
        open();
        assert.equal(
            action(w, "next").hidden,
            true,
            "waits for actual current membership"
        );
        await settle();
        assert.equal(action(w, "next").hidden, false);
        assert.equal(action(w, "favorite").hidden, readOnly);
        action(w, "next").click();
        action(w, "next").click();
        await settle();
        assert.equal(selected.origin.provider, "plex");
        assert.equal(
            calls.filter(([name]) => name === "favorite-next").length,
            1,
            "pending move does not dispatch twice"
        );
        action(w, "next").click();
        await settle();
        assert.equal(selected.origin.provider, "local");
        action(w, "previous").click();
        await settle();
        assert.equal(selected.origin.provider, "plex");
        assert.equal(
            calls.filter(([name]) => name === "favorite-next").length,
            3
        );
        revision++;
        action(w, "next").click();
        await settle();
        assert.equal(
            calls.filter(([name]) => name === "favorite-next").length,
            3,
            "invalidated Favorites snapshot cannot dispatch"
        );
        valid = false;
        api.sync();
        assert.equal(action(w, "next").hidden, true);
        assert.equal(
            calls.some(([name]) =>
                /^(media-skip|channel-skip|failed)$/.test(name)
            ),
            false
        );
    });
}

for (const pending of ["initialization", "mutation"]) {
    test(`Favorites releases its ${pending} busy state after parental authorization expires`, async (t) => {
        const { api, open, w } = fixture(t);
        let authorized = true;
        let ready;
        let complete;
        let toggles = 0;
        w.__ottParental = { needs: () => !authorized };
        const host = {
            toggle: (_payload, admitted) => {
                toggles++;
                return new Promise((resolve) => {
                    complete = () => {
                        assert.equal(admitted(), false);
                        resolve();
                    };
                });
            },
        };
        if (pending === "initialization")
            w.__ottEnsureGlobalFavorites = (done) => {
                ready = done;
            };
        else w.__ottGlobalFavorites = host;
        open();
        const button = action(w, "favorite");
        button.click();
        await new Promise(setImmediate);
        assert.equal(button.getAttribute("aria-busy"), "true");
        authorized = false;
        if (pending === "initialization") {
            w.__ottGlobalFavorites = host;
            ready();
        } else complete();
        await new Promise(setImmediate);
        assert.equal(button.getAttribute("aria-busy"), "false");
        assert.equal(button.hidden, true);
        assert.equal(toggles, pending === "mutation" ? 1 : 0);
        authorized = true;
        api.sync();
        assert.equal(button.hidden, false);
        assert.equal(button.disabled, false);
        host.toggle = async () => {
            toggles++;
        };
        button.click();
        await new Promise(setImmediate);
        assert.equal(toggles, pending === "mutation" ? 2 : 1);
    });
}

test("a settled old Favorites operation cannot clear a newer operation's busy state", async (t) => {
    const { api, open, w } = fixture(t);
    let item = "A";
    const completions = [];
    w.__ottClassicPlayback.snapshot = () => ({
        generation: item,
        target: { channelId: item, kind: "vod", sourceId: "provider" },
    });
    w.__ottGlobalFavorites = {
        toggle: () => new Promise((resolve) => completions.push(resolve)),
    };
    open();
    const button = action(w, "favorite");
    button.click();
    await new Promise(setImmediate);
    item = "B";
    api.sync();
    button.click();
    await new Promise(setImmediate);
    assert.equal(completions.length, 2);
    completions[0]();
    await new Promise(setImmediate);
    assert.equal(button.getAttribute("aria-busy"), "true");
    completions[1]();
    await new Promise(setImmediate);
    assert.equal(button.getAttribute("aria-busy"), "false");
});

for (const trigger of ["click", "pointer", "keyboard"]) {
    test(`Favorites rejects a stale rendered owner through ${trigger} activation`, async (t) => {
        const { api, open, w } = fixture(t);
        let item = "A";
        const toggled = [];
        w.__ottClassicPlayback.snapshot = () => ({
            generation: item,
            target: { channelId: item, kind: "vod", sourceId: "provider" },
        });
        w.__ottGlobalFavorites = {
            toggle: async (_payload, admitted) => {
                if (admitted()) toggled.push(item);
            },
        };
        const channel = w.document.getElementById("channel_name");
        channel.textContent = "A";
        open();
        const button = action(w, "favorite");
        button.focus();
        item = "B";
        channel.textContent = "B";
        assert.equal(
            w.document.querySelector(".modern-player-title").textContent,
            "A"
        );
        if (trigger === "pointer")
            button.dispatchEvent(
                new w.MouseEvent("mousedown", { bubbles: true })
            );
        if (trigger === "keyboard") api.handleKey({ key: "Enter" });
        else button.click();
        await new Promise(setImmediate);
        assert.deepEqual(toggled, []);
        assert.equal(
            w.document.querySelector(".modern-player-title").textContent,
            "B"
        );
        button.click();
        await new Promise(setImmediate);
        assert.deepEqual(
            toggled,
            ["B"],
            "the current rendered item can still be toggled"
        );
    });
}

for (const kind of ["live", "vod"]) {
    test(`Modern restores visible ${kind} focus when programme Info disappears`, (t) => {
        const { api, open, w } = fixture(t, kind);
        w.showPlaybackInfo = () => true;
        open();
        const info = action(w, "info");
        info.focus();
        api.sync();
        assert.equal(
            w.document.activeElement,
            info,
            "ordinary refresh preserves visible Info focus"
        );
        w.document.getElementById("channel_name").textContent = " \n\t ";
        api.sync();
        assert.equal(info.hidden, true);
        assert.notEqual(w.document.activeElement, info);
        assert.equal(
            api.state().group,
            kind === "live" ? "actions" : "timeline"
        );
        if (kind === "live")
            assert.equal(
                w.document.activeElement.closest(".modern-player-actions") !==
                    null,
                true
            );
        else assert.equal(w.document.activeElement.id, "progress_div");
    });
}

test("disappearing Info does not steal focus from an active editor", (t) => {
    const { api, open, w } = fixture(t, "live");
    w.showPlaybackInfo = () => true;
    open();
    action(w, "info").focus();
    const editor = w.document.createElement("input");
    w.document.body.appendChild(editor);
    editor.focus();
    w.document.getElementById("channel_name").textContent = " ";
    api.sync();
    assert.equal(action(w, "info").hidden, true);
    assert.equal(api.state().group, "actions");
    assert.equal(w.document.activeElement, editor);
});

test("Modern distinguishes technical playback information from programme Info", (t) => {
    const { open, w } = fixture(t);
    const details = w.document.getElementById("video_res");
    details.setAttribute("role", "button");
    details.textContent = "1920 × 1080";
    w.showPlaybackInfo = () => true;
    open();
    assert.equal(
        action(w, "details").getAttribute("aria-label"),
        "Playback · Information"
    );
    assert.equal(action(w, "info").getAttribute("aria-label"), "Info");
});
