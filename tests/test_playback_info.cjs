const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const ts = require("typescript");

const moduleContext = {};
vm.runInNewContext(
    ts.transpileModule(
        fs.readFileSync(
            path.join(__dirname, "../src/ui/playback-info.ts"),
            "utf8"
        ),
        {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES5,
            },
        }
    ).outputText,
    moduleContext
);
const { showModernPlaybackInfo: showPlaybackInfo } = moduleContext;
const core = require("./helpers/shared-core-runtime.cjs")(
    vm.createContext({}),
    { vendorOnly: true }
);

function fixture(t) {
    const dom = new JSDOM(
        `<!doctype html><body>
      <div id="programm_name">Playing programme</div>
      <div id="channel_name">Playing channel</div>
      <div id="programm_descr">Playing description</div>
      <div id="listDetail"><div id="_name">Old catalogue selection</div>
        <div id="_descr">Old catalogue description<img src="https://example.invalid/old.jpg"></div></div>
      <div id="dialogbox" style="display:none"></div></body>`,
        { pretendToBeVisual: true, url: "https://example.invalid/" }
    );
    t.after(() => dom.window.close());
    const host = dom.window;
    const calls = [];
    const bubbled = [];
    host.document.body.addEventListener("click", (event) => {
        bubbled.push(event.target.className);
    });
    let generation = 0;
    const port = {
        registrations: 0,
        setOwnedCallback(kind, callback) {
            assert.equal(kind, "dialog");
            const admitted = ++generation;
            const guarded = (...args) => {
                if (
                    admitted === generation &&
                    host.dialogBoxKeyHandler === guarded
                )
                    return callback(...args);
            };
            guarded.owner = { foreground: () => admitted === generation };
            host.dialogBoxKeyHandler = guarded;
            port.registrations++;
            return guarded;
        },
    };
    Object.assign(host, {
        _: (value) => "translated:" + value,
        __ottClassicScreenPort: port,
        dialogBoxKeyHandler: null,
        keys: {
            DOWN: 40,
            ENTER: 13,
            EXIT: 27,
            LEFT: 37,
            RETURN: 8,
            RIGHT: 39,
            UP: 38,
        },
        showChannelInfo: (...args) => calls.push(args),
    });
    return {
        bubbled,
        calls,
        dialog: host.document.getElementById("dialogbox"),
        host,
        open: (onClose) => showPlaybackInfo(host, onClose),
        port,
    };
}

test("playback Info reads current programme metadata instead of the last catalogue selection", (t) => {
    const f = fixture(t);
    assert.equal(f.open(), true);
    assert.equal(f.dialog.querySelector("h2").textContent, "Playing programme");
    assert.equal(
        f.dialog.querySelector("p").textContent,
        "Playing description"
    );
    assert.equal(f.dialog.textContent.includes("Old catalogue"), false);
    assert.equal(f.dialog.querySelector("img"), null);
    assert.equal(
        f.host.document.activeElement,
        f.dialog.querySelector(".playback-info-copy")
    );
    assert.equal(
        f.dialog.querySelector("button").textContent,
        "translated:Close"
    );
});

test("playback Info renders markup-shaped title and description as text", (t) => {
    const f = fixture(t);
    const title = '<img src=x onerror="window.executed=true">';
    const description =
        '<script>window.executed=true</script><a href="javascript:alert(1)">Text</a>';
    f.host.document.getElementById("programm_name").textContent = title;
    f.host.document.getElementById("programm_descr").textContent = description;
    assert.equal(f.open(), true);
    assert.equal(f.dialog.querySelector("h2").textContent, title);
    assert.equal(f.dialog.querySelector("p").textContent, description);
    assert.equal(f.dialog.querySelector("script,img,a"), null);
    assert.equal(f.host.executed, undefined);
});

test("playback Info preserves description line, paragraph and list boundaries as plain text", (t) => {
    const f = fixture(t);
    f.host.document.getElementById("programm_descr").innerHTML =
        "<p><b>Year:</b> 2026<br>Duration: 90 min</p><p>Synopsis line.</p>" +
        "<ul><li>First cast member</li><li>Second cast member</li></ul>" +
        "<script>window.executed=true</script><style>body{display:none}</style>";
    assert.equal(f.open(), true);
    const paragraph = f.dialog.querySelector("p");
    assert.deepEqual(paragraph.textContent.split(/\n+/), [
        "Year: 2026",
        "Duration: 90 min",
        "Synopsis line.",
        "First cast member",
        "Second cast member",
    ]);
    assert.equal(paragraph.childElementCount, 0);
    assert.equal(f.dialog.querySelector("script,style,ul,li,b,br"), null);
    assert.equal(f.host.executed, undefined);
});

test("playback Info keeps table rows and cells readable without importing the table DOM", (t) => {
    const f = fixture(t);
    f.host.document.getElementById("programm_descr").innerHTML =
        "<table><tr><th>Director</th><td>Alex Example</td></tr>" +
        "<tr><th>Year</th><td>2026</td></tr></table>";
    f.open();
    const paragraph = f.dialog.querySelector("p");
    assert.deepEqual(
        paragraph.textContent.split(/\n+/).map((row) => row.trim()),
        ["Director\tAlex Example", "Year\t2026"]
    );
    assert.equal(paragraph.childElementCount, 0);
});

test("playback Info copies only the current poster source and owns its image failure handlers", (t) => {
    const f = fixture(t);
    const source = f.host.document.createElement("img");
    source.src = "https://example.invalid/current.jpg";
    source.setAttribute("onerror", "window.executed=true");
    source.setAttribute("onclick", "window.executed=true");
    source.setAttribute("style", "position:fixed;inset:0");
    source.alt = "Untrusted poster caption";
    f.host.document.getElementById("programm_descr").appendChild(source);
    assert.equal(f.open(), true);
    const art = f.dialog.querySelector(".playback-info-art");
    assert.notEqual(art, source);
    assert.equal(art.src, source.src);
    assert.equal(art.alt, "");
    for (const attribute of ["onerror", "onclick", "style"])
        assert.equal(art.hasAttribute(attribute), false);
    art.dispatchEvent(new f.host.Event("error"));
    assert.equal(art.hidden, true);
    art.dispatchEvent(new f.host.Event("load"));
    assert.equal(art.hidden, false);
    assert.equal(f.host.executed, undefined);
});

test("playback Info preserves the current CSS thumbnail without copying its source layout or events", (t) => {
    const f = fixture(t);
    const source = f.host.document.createElement("div");
    source.className = "img";
    source.style.backgroundImage =
        'url("https://example.invalid/current-guide.jpg")';
    source.style.width = "133px";
    source.style.height = "200px";
    source.style.cssFloat = "left";
    source.setAttribute("onclick", "window.executed=true");
    f.host.document.getElementById("programm_descr").appendChild(source);
    assert.equal(f.open(), true);
    const art = f.dialog.querySelector(".playback-info-thumbnail");
    assert.ok(art);
    assert.notEqual(art, source);
    assert.equal(art.style.backgroundImage, source.style.backgroundImage);
    assert.equal(art.getAttribute("aria-hidden"), "true");
    assert.equal(art.hasAttribute("onclick"), false);
    assert.equal(art.style.width, "");
    assert.equal(art.style.height, "");
    assert.equal(art.style.cssFloat, "");
    assert.equal(
        f.dialog.querySelector("img"),
        null,
        "the old catalogue poster is not reused"
    );
    assert.equal(source.parentNode.id, "programm_descr");
    assert.equal(
        f.dialog.querySelector("p").textContent,
        "Playing description"
    );
    assert.equal(f.host.executed, undefined);
});

test("playback Info scrolls a long description with Up/Down without dismissing", (t) => {
    const f = fixture(t);
    f.host.document.getElementById("programm_descr").textContent =
        "Long paragraph. ".repeat(100);
    f.open();
    const copy = f.dialog.querySelector(".playback-info-copy");
    Object.defineProperty(copy, "clientHeight", { value: 120 });
    const handler = f.host.dialogBoxKeyHandler;
    assert.equal(handler(f.host.keys.DOWN), true);
    assert.equal(copy.scrollTop, 72);
    assert.equal(handler(f.host.keys.UP), true);
    assert.equal(copy.scrollTop, 0);
    assert.equal(handler(65), false);
    assert.equal(f.dialog.style.display, "block");
    assert.equal(f.host.dialogBoxKeyHandler, handler);
    assert.deepEqual(f.calls, []);
});

for (const method of ["button", "RETURN", "EXIT", "ENTER"]) {
    test(`playback Info ${method} closes its owned dialog and returns to the HUD`, (t) => {
        const f = fixture(t);
        for (let cycle = 1; cycle <= 2; cycle++) {
            assert.equal(f.open(), true);
            const callback = f.host.dialogBoxKeyHandler;
            if (method === "button") f.dialog.querySelector("button").click();
            else assert.equal(callback(f.host.keys[method]), true);
            assert.equal(f.dialog.style.display, "none");
            assert.equal(f.dialog.childElementCount, 0);
            assert.equal(f.host.dialogBoxKeyHandler, null);
            assert.deepEqual(
                f.calls,
                Array.from({ length: cycle }, () => [1, true])
            );
            assert.deepEqual(
                f.bubbled,
                [],
                "Close cannot reach background click handlers"
            );
            callback(f.host.keys.RETURN);
            assert.equal(
                f.calls.length,
                cycle,
                "a closed owner cannot reopen the HUD again"
            );
        }
    });
}

test("playback Info refuses duplicate admission without replacing the active card", (t) => {
    const f = fixture(t);
    f.open();
    const card = f.dialog.firstChild;
    const handler = f.host.dialogBoxKeyHandler;
    assert.equal(f.open(), false);
    assert.equal(f.dialog.firstChild, card);
    assert.equal(f.host.dialogBoxKeyHandler, handler);
    assert.equal(f.port.registrations, 1);
});

for (const policy of ["enabled", "locked", "strict"]) {
    test(`playback Info refuses ${policy} kiosk input ownership`, (t) => {
        const f = fixture(t);
        f.host.__ottKiosk = { [policy]: () => true };
        assert.equal(f.open(), false);
        assert.equal(f.dialog.childElementCount, 0);
        assert.equal(f.port.registrations, 0);
    });
}

test("playback Info refuses empty current metadata even when a catalogue item exists", (t) => {
    const f = fixture(t);
    for (const id of ["programm_name", "channel_name", "programm_descr"])
        f.host.document.getElementById(id).textContent = " \n ";
    assert.equal(f.open(), false);
    assert.equal(f.port.registrations, 0);
    assert.equal(f.dialog.style.display, "none");
});

test("a stale playback Info Close click cannot dismiss a replacement owned dialog", (t) => {
    const f = fixture(t);
    f.open();
    const oldClose = f.dialog.querySelector("button");
    const replacementCalls = [];
    const replacement = f.port.setOwnedCallback("dialog", (key) =>
        replacementCalls.push(key)
    );
    f.dialog.textContent = "Replacement dialog";
    oldClose.click();
    assert.equal(f.dialog.style.display, "block");
    assert.equal(f.dialog.textContent, "Replacement dialog");
    assert.equal(f.host.dialogBoxKeyHandler, replacement);
    assert.deepEqual(replacementCalls, []);
    assert.deepEqual(f.calls, []);
});

function attachPlaybackPlan(f, kind) {
    const state = { current: true };
    const target = { channelId: "current", kind, sourceId: "source" };
    if (kind === "archive") target.archiveStart = 1699999700;
    const observation = {
        archiveAvailable: kind === "archive",
        archiveEarliest: kind === "archive" ? 1699999000 : undefined,
        duration: 600,
        now: 1700000000,
        position: 150,
        target,
    };
    const context = {
        isCurrent: () => state.current,
        previewOffset(value) {
            const request = { ...observation, intent: "offset", value };
            return { ...request, plan: core.playbackSeekPlan(target, request) };
        },
    };
    const effects = [];
    f.host.OttPlayCore = core;
    f.host.__ottClassicPlayback = { context: () => context };
    f.host.shiftArchive = (value) => effects.push(value);
    return { effects, observation, state, target };
}

for (const [kind, action] of [
    ["vod", "seek"],
    ["archive", "open-archive"],
    ["live", "noop"],
]) {
    test(`playback Info beginning action follows the shipped ${kind} seek plan`, (t) => {
        const f = fixture(t);
        const playback = attachPlaybackPlan(f, kind);
        assert.equal(
            core.playbackSeekPlan(playback.target, {
                ...playback.observation,
                intent: "begin",
            }).action,
            action
        );
        f.open();
        const restart = f.dialog.querySelector(".playback-info-restart");
        assert.equal(!!restart, action !== "noop");
        assert.deepEqual(
            playback.effects,
            [],
            "capability discovery must not seek"
        );
        if (restart) {
            restart.click();
            assert.deepEqual(playback.effects, [-6e6]);
            assert.deepEqual(
                f.bubbled,
                [],
                "Restart cannot reach background click handlers"
            );
            assert.equal(f.dialog.style.display, "none");
            assert.deepEqual(f.calls, [[1, true]]);
            restart.click();
            assert.deepEqual(
                playback.effects,
                [-6e6],
                "a retired owner cannot restart twice"
            );
        }
    });
}

for (const invalidation of ["source", "owner", "kiosk"]) {
    test(`playback Info beginning cannot seek after its ${invalidation} changes`, (t) => {
        const f = fixture(t);
        const playback = attachPlaybackPlan(f, "vod");
        f.open();
        const restart = f.dialog.querySelector(".playback-info-restart");
        assert.ok(restart);
        if (invalidation === "source") playback.state.current = false;
        else if (invalidation === "kiosk")
            f.host.__ottKiosk = { enabled: () => true };
        else {
            f.port.setOwnedCallback("dialog", () =>
                assert.fail("replacement owner must not receive stale action")
            );
            f.dialog.textContent = "Replacement dialog";
        }
        restart.click();
        assert.deepEqual(playback.effects, []);
        assert.deepEqual(f.calls, []);
        assert.equal(f.dialog.style.display, "block");
    });
}

test("playback Info reports owned closure after revealing the HUD, only once", (t) => {
    const f = fixture(t);
    let closed = 0;
    f.open(() => {
        assert.equal(f.dialog.style.display, "none");
        assert.equal(f.host.dialogBoxKeyHandler, null);
        assert.deepEqual(f.calls, [[1, true]]);
        closed++;
    });
    const close = f.dialog.querySelector(".playback-info-close");
    close.click();
    close.click();
    assert.equal(closed, 1);
});

for (const stale of [false, true]) {
    test(`playback Info native D-pad reaches beginning and Enter ${stale ? "rejects a changed source" : "seeks once"}`, (t) => {
        const f = fixture(t);
        const playback = attachPlaybackPlan(f, "vod");
        f.open();
        const handler = f.host.dialogBoxKeyHandler;
        const restart = f.dialog.querySelector(".playback-info-restart");
        const close = f.dialog.querySelector(".playback-info-close");
        const copy = f.dialog.querySelector(".playback-info-copy");
        assert.equal(handler(f.host.keys.RIGHT), true);
        assert.equal(f.host.document.activeElement, restart);
        assert.equal(handler(f.host.keys.DOWN), true);
        assert.equal(f.host.document.activeElement, close);
        assert.equal(handler(f.host.keys.UP), true);
        assert.equal(f.host.document.activeElement, restart);
        assert.equal(handler(f.host.keys.LEFT), true);
        assert.equal(f.host.document.activeElement, copy);
        handler(f.host.keys.RIGHT);
        playback.state.current = !stale;
        assert.equal(handler(f.host.keys.ENTER), true);
        assert.deepEqual(playback.effects, stale ? [] : [-6e6]);
        assert.equal(f.dialog.style.display, stale ? "block" : "none");
        assert.deepEqual(f.calls, stale ? [] : [[1, true]]);
        handler(f.host.keys.ENTER);
        assert.deepEqual(playback.effects, stale ? [] : [-6e6]);
    });
}
