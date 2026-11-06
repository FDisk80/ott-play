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
