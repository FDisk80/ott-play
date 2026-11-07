// Real DOM mutations from the actual core renderer and footer-opening path.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { JSDOM } = require("jsdom");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
function functions(file, names) {
    const ast = ts.createSourceFile(
        file,
        fs.readFileSync(path.join(root, file), "utf8"),
        ts.ScriptTarget.Latest,
        true
    );
    return ts.transpileModule(
        names
            .map((name) => {
                const node = ast.statements.find(
                    (entry) =>
                        ts.isFunctionDeclaration(entry) &&
                        entry.name.text === name
                );
                assert.ok(node, `Actual ${name} exists`);
                return node.getText(ast).replace(/^export /, "");
            })
            .join("\n"),
        { compilerOptions: { target: ts.ScriptTarget.ES5 } }
    ).outputText;
}
const core = functions("src/core/index.ts", [
    "coreField",
    "coreCall",
    "updateCoreVideoInfo",
]);
const ui = functions("src/ui/index.ts", [
    "setInfoInteraction",
    "showChannelInfo",
    "infoBarHide",
]);

function fixture() {
    const dom = new JSDOM(
        '<div id="info1" style="display:none"><div id="video_res"></div>' +
            '<div id="descr"><div id="programm_descr"></div></div></div>',
        { runScripts: "outside-only" }
    );
    const w = dom.window;
    w.eval(fs.readFileSync(path.join(root, "js/jquery-1.11.1.min.js"), "utf8"));
    // jsdom has no layout. Preserve the footer's real inline visibility state.
    w.$.expr.filters.visible = (element) => element.style.display !== "none";
    const shown = [];
    const show = w.$.fn.show;
    w.$.fn.show = function (_duration, complete) {
        show.call(this);
        if (this[0]?.id === "info1")
            shown.push(w.document.getElementById("video_res").textContent);
        if (typeof complete === "function") complete.call(this[0]);
        return this;
    };
    w.$.fn.slideDown = w.$.fn.show;
    w.$.fn.slideUp = w.$.fn.hide;
    let mbps = 8;
    Object.assign(w, {
        _coreHlsBitrate: { mbps: () => mbps },
        _coreNativeHls: null,
        _coreNativeMbps: 0,
        $infoBar: w.$("#info1"),
        detailScrollTimer: 0,
        detailTimer: 0,
        hideInfoBarWhenReady() {},
        hlsInstance: {},
        infoTimeout: 0,
        prevDecodedBytes: -1,
        prevDecodedMediaTime: -1,
        refreshAudioBadge() {},
        setTimeout: () => 1,
        video: {
            currentTime: 0,
            seeking: false,
            videoHeight: 1080,
            videoWidth: 1920,
        },
    });
    w.eval(core);
    w.eval(ui);
    const label = w.document.getElementById("video_res");
    const observer = new w.MutationObserver(() => {});
    observer.observe(label, { childList: true, subtree: true });
    return {
        close: () => dom.window.close(),
        label,
        mutations: () => observer.takeRecords().length,
        rate: (next) => {
            mbps = next;
        },
        shown,
        w,
    };
}

test("ten-minute footer workload only mutates metadata on visible changes", () => {
    const f = fixture();
    try {
        // Five minutes with the footer hidden and a changing HLS bitrate.
        for (let tick = 0; tick < 300; tick++) {
            f.rate(tick % 2 ? 8 : 12);
            f.w.updateCoreVideoInfo();
        }
        const hidden = f.mutations();
        f.w.showChannelInfo(5);
        const opening = f.mutations();
        // Five visible minutes: stable metadata, one bitrate and one size change.
        for (let tick = 0; tick < 300; tick++) {
            if (tick === 100) f.rate(16);
            if (tick === 200) {
                f.w.video.videoWidth = 1280;
                f.w.video.videoHeight = 720;
            }
            f.w.updateCoreVideoInfo();
        }
        const visible = f.mutations();
        console.log(JSON.stringify({ hidden, opening, visible }));
        assert.deepEqual(
            { hidden, opening, visible },
            { hidden: 0, opening: 1, visible: 2 }
        );
        assert.equal(f.shown[0], "1920x10808 Mbps");
        assert.equal(f.label.innerHTML, "<br>1280x720<br>16 Mbps");
    } finally {
        f.close();
    }
});

test("animated and strict footer openings immediately show current metadata", () => {
    for (const mode of ["animated", "strict"]) {
        const f = fixture();
        try {
            f.w.sInfoSlide = mode === "animated";
            f.w.__ottKiosk = { strict: () => mode === "strict" };
            f.rate(4);
            f.w.showChannelInfo(5);
            assert.equal(f.shown[0], "1920x10804 Mbps");
            f.w.infoBarHide();
            f.rate(6);
            f.w.video.videoWidth = 1280;
            f.w.video.videoHeight = 720;
            f.w.updateCoreVideoInfo();
            assert.equal(f.label.textContent, "1920x10804 Mbps");
            f.w.showChannelInfo(5);
            assert.equal(f.shown[1], "1280x7206 Mbps");
        } finally {
            f.close();
        }
    }
});

test("info completions retain late method lookup for both surfaces and animation modes", () => {
    for (const animated of [false, true]) {
        for (const surface of ["info1", "descr"]) {
            const f = fixture();
            try {
                const pending = [];
                const calls = [];
                f.w.sInfoSlide = animated;
                f.w.$.fn.show = function (duration, complete) {
                    this.css("display", "block");
                    if (complete)
                        pending.push({
                            complete,
                            duration,
                            id: this[0].id,
                            mode: "show",
                        });
                    return this;
                };
                f.w.$.fn.slideDown = function (duration, complete) {
                    this.css("display", "block");
                    pending.push({
                        complete,
                        duration,
                        id: this[0].id,
                        mode: "slideDown",
                    });
                    return this;
                };
                f.w.document.getElementById("programm_descr").textContent =
                    "Programme details";
                f.w.document.getElementById("descr").style.display = "none";
                f.w.document.getElementById("info1").style.display =
                    surface === "descr" ? "block" : "none";
                f.w.scrollUpDescr = () => calls.push("old");
                f.w.showChannelInfo(0);
                assert.equal(pending.length, 1);
                assert.equal(pending[0].id, surface);
                assert.equal(pending[0].mode, animated ? "slideDown" : "show");
                assert.equal(pending[0].duration, animated ? 400 : 0);
                assert.deepEqual(
                    calls,
                    [],
                    "The method runs only on completion"
                );
                f.w.scrollUpDescr = function () {
                    assert.equal(this, f.w);
                    calls.push("new");
                };
                pending[0].complete.call(f.w.document.getElementById(surface));
                assert.deepEqual(
                    calls,
                    ["new"],
                    "Completion reads the current Window method"
                );
                delete f.w.scrollUpDescr;
                assert.doesNotThrow(() => pending[0].complete());
            } finally {
                f.close();
            }
        }
    }
});

test("strict gesture keepalive preserves metadata until the normal refresh", () => {
    const f = fixture();
    try {
        f.w.__ottKiosk = { strict: () => true };
        const scheduled = [];
        const cleared = [];
        f.w.setTimeout = (callback, delay) => {
            scheduled.push({ callback, delay });
            return scheduled.length;
        };
        f.w.clearTimeout = (timer) => cleared.push(timer);
        f.rate(0);
        f.w.showChannelInfo(5);
        assert.equal(f.label.innerHTML, "<br>1920x1080");
        assert.equal(f.mutations(), 1);
        // A segment can finish after the seek is ready but before touchstart.
        // Adding its bitrate line inside the gesture would move the seek bar.
        f.rate(4);
        const first = f.label.firstChild;
        f.w.showChannelInfo(5);
        assert.equal(f.mutations(), 0);
        assert.equal(f.label.firstChild, first);
        assert.equal(f.label.innerHTML, "<br>1920x1080");
        assert.equal(f.w.$infoBar.is(":visible"), true);
        assert.ok(cleared.includes(1));
        assert.equal(f.w.infoTimeout, 2);
        assert.equal(scheduled[1].callback, f.w.infoBarHide);
        assert.equal(scheduled[1].delay, 5000);
        f.w.updateCoreVideoInfo();
        assert.equal(f.mutations(), 1);
        assert.equal(f.label.innerHTML, "<br>1920x1080<br>4 Mbps");
    } finally {
        f.close();
    }
});

test("unchanged rounded bitrate preserves nodes and unavailable bitrate is removed", () => {
    const f = fixture();
    try {
        f.w.showChannelInfo(5);
        f.mutations();
        const first = f.label.firstChild;
        f.rate(8.001);
        f.w.updateCoreVideoInfo();
        assert.equal(f.mutations(), 0);
        assert.equal(f.label.firstChild, first);
        f.rate(0);
        f.w.updateCoreVideoInfo();
        assert.equal(f.mutations(), 1);
        assert.equal(f.label.innerHTML, "<br>1920x1080");
        f.rate(4);
        f.w.updateCoreVideoInfo();
        assert.equal(f.label.innerHTML, "<br>1920x1080<br>4 Mbps");
    } finally {
        f.close();
    }
});

test("feedback owns the label, and normal rendering recovers after replacement", () => {
    const f = fixture();
    try {
        let feedback = true;
        f.w.__ottPlaybackFeedback = { visible: () => feedback };
        f.label.textContent = "Buffering...";
        f.w.showChannelInfo(5);
        assert.equal(f.label.textContent, "Buffering...");
        feedback = false;
        f.w.updateCoreVideoInfo();
        assert.equal(f.label.textContent, "1920x10808 Mbps");
        f.label.textContent = "";
        f.w.updateCoreVideoInfo();
        assert.equal(f.label.textContent, "1920x10808 Mbps");
        const replacement = f.w.document.createElement("div");
        replacement.id = "video_res";
        f.label.replaceWith(replacement);
        f.w.updateCoreVideoInfo();
        assert.equal(replacement.textContent, "1920x10808 Mbps");
    } finally {
        f.close();
    }
});

test("hidden native sampling and transport polling continue without DOM work", () => {
    const f = fixture();
    try {
        let polls = 0;
        f.w.hlsInstance = null;
        f.w._coreNativeHls = { mbps: () => 0, poll: () => polls++ };
        for (let tick = 1; tick <= 3; tick++) {
            f.w.video.currentTime = tick;
            f.w.video.webkitVideoDecodedByteCount = tick * 1e6;
            f.w.updateCoreVideoInfo();
        }
        assert.equal(polls, 3);
        assert.equal(f.mutations(), 0);
        f.w.showChannelInfo(5);
        assert.equal(f.shown[0], "1920x10808 Mbps");
    } finally {
        f.close();
    }
});

const footerLayout = functions("src/index.ts", ["setFontSize"]);
const audioBadge = functions("src/ui/index.ts", ["refreshAudioBadge"]);

function footerLayoutFixture() {
    const dom = new JSDOM(
        fs.readFileSync(path.join(root, "index.html"), "utf8"),
        {
            runScripts: "outside-only",
        }
    );
    const w = dom.window;
    w.eval(fs.readFileSync(path.join(root, "js/jquery-1.11.1.min.js"), "utf8"));
    let hasAudio = false;
    let scale = 1;
    let proportional = false;
    let unavailableMetrics = false;
    const errors = [];
    // jsdom has no layout. Supply font measurements only; the real setFontSize
    // owns every width, font size and padding written to the actual footer DOM.
    const width = w.$.fn.width;
    const glyphWidth = (text, px) =>
        Array.from(text).reduce((total, glyph) => {
            const em =
                glyph === ":"
                    ? 0.3
                    : glyph === " "
                      ? 0.25
                      : proportional && glyph !== "9"
                        ? 0.8
                        : 0.55;
            return total + em * px;
        }, 0);
    const badgeWidth = (px) => px * (proportional ? 1.9 : 1.5);
    w.$.fn.width = function (...args) {
        if (args.length || this[0]?.id !== "testFont")
            return width.apply(this, args);
        if (unavailableMetrics) return 0;
        const px = parseFloat(this[0].style.fontSize);
        if (this[0].children.length) {
            const badge = this[0].firstElementChild;
            assert.equal(badge.className, "btn");
            assert.equal(badge.style.display, "inline-block");
            assert.equal(
                badge.id,
                "",
                "The measurement must not duplicate an ID"
            );
            return badgeWidth(px);
        }
        return glyphWidth(this.text(), px);
    };
    Object.assign(w, {
        _: (value) => value,
        $i1: w.$("#info1"),
        console: { error: (error) => errors.push(error) },
        fontFamilyList: [""],
        isListVisible: false,
        loadSubtitleAppearance() {},
        setListPos() {},
        settings: {
            fontShift: 0,
            fontSize: 0,
            osdOpacity: 5,
            pageSize: 15,
            permanentTime: 0,
        },
        stbAudioTracksExists: () => hasAudio,
        stbSetOsdOpacity() {},
        tooltip: null,
        uiFontScale: () => scale,
    });
    w.eval(footerLayout + "\n" + audioBadge);
    return {
        close: () => dom.window.close(),
        errors,
        layout(viewport, fontScale, wideFont, missingMetrics = false) {
            w.innerWidth = viewport[0];
            w.innerHeight = viewport[1];
            scale = fontScale;
            proportional = wideFont;
            unavailableMetrics = missingMetrics;
            w.setFontSize();
        },
        requiredWidth() {
            const px = parseFloat(w.$("#data").css("font-size"));
            const secondsPx = parseFloat(w.$("#current_s").css("font-size"));
            return (
                badgeWidth(px) +
                glyphWidth(" 23:58", px) +
                glyphWidth(":58", secondsPx)
            );
        },
        tracks(available) {
            hasAudio = available;
            w.refreshAudioBadge();
        },
        w,
    };
}

test("footer reserves audio badge and complete clock across fonts, scales and resizes", () => {
    const f = footerLayoutFixture();
    try {
        const { w } = f;
        const badge = w.document.getElementById("audio_badge");
        w.$("#current_t").text("23:58");
        w.$("#current_s").text(":58");
        for (const modern of [false, true]) {
            w.document.body.className = modern ? "interface-modern" : "";
            for (const viewport of [
                [640, 360],
                [1024, 768],
                [1280, 720],
                [1920, 1080],
                [3840, 2160],
                [722, 1230],
                [360, 800],
            ]) {
                for (const scale of [0.2, 1, 1.5, 2, 1]) {
                    for (const wideFont of [false, true]) {
                        f.tracks(false);
                        f.layout(viewport, scale, wideFont);
                        const dataWidth = w.$("#data").width();
                        assert.ok(
                            dataWidth >= f.requiredWidth(),
                            `Complete A/HH:MM:SS row fits: ${viewport}, ${scale}, ${wideFont}`
                        );
                        const occupied =
                            w.$("#picon").width() +
                            w.$("#channel").width() +
                            parseFloat(w.$("#channel").css("padding-left")) +
                            dataWidth +
                            parseFloat(w.$("#info1").css("padding-left")) +
                            parseFloat(w.$("#info1").css("padding-right"));
                        assert.ok(
                            occupied <= viewport[0],
                            "All footer columns fit inside the viewport"
                        );
                        assert.ok(w.$("#channel").width() > 0);
                        assert.ok(
                            w.$("#picon").width() <= w.$("#listTime").width(),
                            "A narrow screen may shrink the picon without changing the list clock"
                        );
                        if (viewport[0] >= viewport[1])
                            assert.equal(
                                w.$("#picon").width(),
                                w.$("#listTime").width()
                            );
                        assert.equal(
                            badge.style.display,
                            "none",
                            "Measuring cannot show the real badge"
                        );
                        f.tracks(true);
                        assert.equal(badge.style.display, "inline-block");
                        assert.equal(badge.title, "Switch sound track (S)");
                        assert.equal(
                            w.$("#data").width(),
                            dataWidth,
                            "Late audio tracks fit without another resize"
                        );
                        assert.equal(
                            w.$("#current_t").text() + w.$("#current_s").text(),
                            "23:58:58"
                        );
                        f.tracks(false);
                        assert.equal(
                            w.$("#data").width(),
                            dataWidth,
                            "Returning to single audio does not move the clock"
                        );
                        assert.equal(w.$("#testFont").text(), "");
                        assert.equal(
                            w.document.querySelectorAll("#audio_badge").length,
                            1
                        );
                    }
                }
            }
        }
        assert.deepEqual(f.errors, []);
    } finally {
        f.close();
    }
});

test("footer keeps a scaled badge reserve when font measurement is unavailable", () => {
    const f = footerLayoutFixture();
    try {
        for (const scale of [0.2, 1, 2]) {
            f.layout([1280, 720], scale, false, true);
            f.tracks(true);
            assert.ok(f.w.$("#data").width() >= f.requiredWidth());
            assert.ok(f.w.$("#channel").width() > 0);
        }
        assert.deepEqual(f.errors, []);
    } finally {
        f.close();
    }
});
