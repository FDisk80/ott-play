const numericKeyState = require("./helpers/numeric-key-state.cjs");
// Desktop keys must keep their PC meaning when OTT starts a remote Plex queue.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "..");
const filename = "src/key-handler/index.ts";
const source = ts.createSourceFile(
    filename,
    fs.readFileSync(path.join(root, filename), "utf8"),
    ts.ScriptTarget.Latest,
    true
);
const names = new Set([
    "tryKeyboardSeek",
    "tryKeyboardRandom",
    "tryKeyboardFavorites",
    "toggleKeyboardFavorite",
    "installKeyboardSeek",
    "cancelNativeListInertia",
    "keyHandler",
    "handleMainKey",
    "keyFun",
    "plusProg",
    "minusProg",
]);
const code =
    numericKeyState() +
    ts
        .transpileModule(
            source.statements
                .filter(
                    (node) =>
                        ts.isFunctionDeclaration(node) &&
                        names.has(node.name?.text)
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
        .outputText.replace(/^export /gm, "");

function fixture(platform = "pc", phase = "playing", target = true) {
    const dom = new JSDOM('<body><video tabindex="0"></video><input></body>', {
        runScripts: "outside-only",
    });
    const w = dom.window;
    const calls = [];
    let screen = null;
    const map = { 37: "left", 38: "up", 39: "right", 40: "down" };
    Object.assign(w, {
        __ottClassicPlayback: {
            snapshot: () => ({
                phase,
                target: target ? { kind: "live" } : null,
            }),
        },
        __ottClassicScreenPort: {
            dispatch(code, event, main) {
                if (screen) calls.push(["screen", screen.kind, code]);
                else main({ code });
            },
            normalize: (code) => ({ code, id: map[code] }),
            reconcile() {},
            screens: { current: () => screen },
        },
        __ottInputRouter: {
            binding: (value) =>
                ({ 13: "volume.increase", 14: "volume.decrease" })[value],
        },
        __ottMedia: {
            current: () => ({ ref: { sourceId: "plex@remote" } }),
            skip: (delta) => calls.push(["skip", delta]),
        },
        __ottTauriNativeFs: true,
        $: () => ({ is: () => false }),
        changeVolume: (delta) => calls.push(["volume", delta]),
        keys: { DOWN: 40, LEFT: 37, RIGHT: 39, UP: 38 },
        nativeListInertia: null,
        ott_device: platform,
        playType: -1e11,
        setSleepTimeout() {},
        settings: { adFun: 18, alFun: 14, arFun: 13, auFun: 19 },
        shiftArchive: (delta) => calls.push(["seek", delta]),
        stbEventToKeyCode: (event) =>
            event.keyCode ||
            event.which ||
            { ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38 }[
                event.key
            ],
        sVolumeStep: 5,
    });
    w.eval(code);
    w.installKeyboardSeek();
    w.installKeyboardSeek();
    w.addEventListener("keydown", w.keyHandler);
    const video = w.document.querySelector("video");
    // WebKit's native video controls can consume the bubble phase.
    video.addEventListener("keydown", (event) => event.stopPropagation());
    return {
        calls,
        close: () => w.close(),
        screen: (value) => {
            screen = value;
        },
        send(key, destination = w.document.body, modifiers = {}) {
            const event = new w.KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                code: key,
                key,
                keyCode: {
                    ArrowDown: 40,
                    ArrowLeft: 37,
                    ArrowRight: 39,
                    ArrowUp: 38,
                }[key],
                ...modifiers,
            });
            destination.dispatchEvent(event);
            return event;
        },
        video,
        w,
    };
}

let checks = 0;
function test(name, run) {
    run();
    checks++;
    console.log("PASS desktop Plex arrows: " + name);
}

for (const platform of ["pc", "pc2"]) {
    for (const phase of [
        "playing",
        "paused",
        "loading",
        "buffering",
        "stopped",
        "idle",
        "error",
    ]) {
        for (const focusedVideo of [false, true]) {
            test(
                platform +
                    " " +
                    phase +
                    (focusedVideo ? " video focus" : " document focus"),
                () => {
                    const f = fixture(platform, phase);
                    try {
                        const destination = focusedVideo
                            ? f.video
                            : f.w.document.body;
                        assert.equal(
                            f.send("ArrowLeft", destination).defaultPrevented,
                            true,
                            "native controls must not also seek"
                        );
                        assert.equal(
                            f.send("ArrowRight", destination).defaultPrevented,
                            true,
                            "native controls must not also seek"
                        );
                        assert.deepEqual(
                            f.calls,
                            [
                                ["volume", -5],
                                ["volume", 5],
                            ],
                            "plain arrows never seek or skip the Plex queue"
                        );
                    } finally {
                        f.close();
                    }
                }
            );
        }
    }
    test(
        platform + " missing primary target uses desktop main fallback",
        () => {
            const f = fixture(platform, "idle", false);
            try {
                f.send("ArrowLeft");
                f.send("ArrowRight");
                assert.deepEqual(f.calls, [
                    ["volume", -5],
                    ["volume", 5],
                ]);
            } finally {
                f.close();
            }
        }
    );
    test(platform + " legacy which dispatch keeps remote Plex volume", () => {
        const f = fixture(platform, "loading", false);
        try {
            for (const which of [37, 39]) {
                f.w.keyHandler({
                    preventDefault() {},
                    stopPropagation() {},
                    which,
                });
            }
            assert.deepEqual(f.calls, [
                ["volume", -5],
                ["volume", 5],
            ]);
        } finally {
            f.close();
        }
    });
    test(
        platform + " no media or target preserves configured arrow actions",
        () => {
            const f = fixture(platform, "idle", false);
            try {
                f.w.__ottMedia.current = () => null;
                f.w.__ottInputRouter.binding = (value) =>
                    ({
                        13: "archive.minute-forward",
                        14: "archive.minute-back",
                    })[value];
                f.send("ArrowLeft");
                f.send("ArrowRight");
                assert.deepEqual(f.calls, [
                    ["seek", -60],
                    ["seek", 60],
                ]);
            } finally {
                f.close();
            }
        }
    );
    test(
        platform + " modifier seeks and queue navigation keep their meanings",
        () => {
            const f = fixture(platform);
            try {
                for (const modifier of ["altKey", "ctrlKey", "metaKey"]) {
                    f.send("ArrowLeft", f.video, { [modifier]: true });
                    f.send("ArrowRight", f.video, { [modifier]: true });
                }
                assert.deepEqual(f.calls.splice(0), [
                    ["seek", -10],
                    ["seek", 10],
                    ["seek", -10],
                    ["seek", 10],
                    ["seek", -10],
                    ["seek", 10],
                ]);
                f.send("ArrowUp");
                f.send("ArrowDown");
                assert.deepEqual(f.calls, [
                    ["skip", 1],
                    ["skip", -1],
                ]);
            } finally {
                f.close();
            }
        }
    );
    test(
        platform + " open menus and native text input retain their arrows",
        () => {
            const f = fixture(platform);
            try {
                f.screen({ kind: "list" });
                f.send("ArrowLeft");
                f.send("ArrowRight");
                assert.deepEqual(f.calls.splice(0), [
                    ["screen", "list", 37],
                    ["screen", "list", 39],
                ]);
                f.screen(null);
                const input = f.w.document.querySelector("input");
                input.focus();
                assert.equal(
                    f.send("ArrowLeft", input).defaultPrevented,
                    false
                );
                assert.deepEqual(f.calls, []);
            } finally {
                f.close();
            }
        }
    );
}

function localFixture(
    platform = "pc",
    phase = "playing",
    provider = "offline"
) {
    const f = fixture(platform, phase);
    Object.assign(f.w, {
        __ottActiveProviderDriver: { id: provider },
        __ottMedia: { current: () => null },
        catIndex: 2,
        curList: [103, 101, 102],
        p_pref: provider,
        playChannel(category, index) {
            f.calls.push(["file", category, index, this.curList[index]]);
            this.primaryIndex = index;
        },
        primaryIndex: 1,
        settings: { ...f.w.settings, adFun: 16, auFun: 15 },
    });
    f.w.__ottInputRouter.binding = (value) =>
        ({
            13: "volume.increase",
            14: "volume.decrease",
            15: "navigation.forward",
            16: "navigation.backward",
            18: "archive.minute-back",
            19: "archive.minute-forward",
        })[value];
    f.w.__ottClassicPlayback.snapshot = () => ({
        historyTarget: {
            channelId: "101",
            kind: "live",
            sourceId: "offline@folder",
        },
        phase,
        target: {
            channelId: "channel:101",
            kind: "vod",
            sourceId: "offline@folder",
        },
    });
    Object.defineProperty(f.w.document, "fullscreenElement", {
        value: f.video,
    });
    return f;
}

for (const platform of ["pc", "pc2"]) {
    for (const phase of ["playing", "paused", "loading"]) {
        for (const videoFocus of [false, true]) {
            test(`${platform} Local ${phase} ${videoFocus ? "video" : "document"} arrows switch once`, () => {
                const f = localFixture(platform, phase);
                try {
                    const target = videoFocus ? f.video : f.w.document.body;
                    if (videoFocus) f.video.focus();
                    assert.equal(
                        f.send("ArrowUp", target).defaultPrevented,
                        true
                    );
                    assert.equal(
                        f.send("ArrowDown", target).defaultPrevented,
                        true
                    );
                    assert.deepEqual(f.calls, [
                        ["file", 2, 2, 102],
                        ["file", 2, 1, 101],
                    ]);
                } finally {
                    f.close();
                }
            });
        }
    }
    test(`${platform} restored Local category wraps in its shuffled order`, () => {
        const f = localFixture(platform, "playing", "local");
        try {
            f.w.primaryIndex = 2;
            f.send("ArrowUp", f.video);
            f.send("ArrowDown", f.video);
            assert.deepEqual(f.calls, [
                ["file", 2, 0, 103],
                ["file", 2, 2, 102],
            ]);
        } finally {
            f.close();
        }
    });
    test(`${platform} Local keeps volume and modified horizontal seek`, () => {
        const f = localFixture(platform);
        try {
            f.send("ArrowLeft", f.video);
            f.send("ArrowRight", f.video);
            for (const key of ["altKey", "ctrlKey", "metaKey"]) {
                f.send("ArrowLeft", f.video, { [key]: true });
                f.send("ArrowRight", f.video, { [key]: true });
            }
            assert.deepEqual(f.calls, [
                ["volume", -5],
                ["volume", 5],
                ["seek", -10],
                ["seek", 10],
                ["seek", -10],
                ["seek", 10],
                ["seek", -10],
                ["seek", 10],
            ]);
        } finally {
            f.close();
        }
    });
    test(`${platform} Local vertical modifiers and editable focus are not captured`, () => {
        const f = localFixture(platform);
        try {
            for (const key of ["altKey", "ctrlKey", "metaKey", "shiftKey"]) {
                assert.equal(
                    f.send("ArrowUp", f.video, { [key]: true })
                        .defaultPrevented,
                    false
                );
                assert.equal(
                    f.send("ArrowDown", f.video, { [key]: true })
                        .defaultPrevented,
                    false
                );
            }
            f.w.document.querySelector("input").focus();
            assert.equal(f.send("ArrowUp", f.video).defaultPrevented, false);
            assert.deepEqual(f.calls, []);
        } finally {
            f.close();
        }
    });
    for (const mode of [
        "list",
        "dialog",
        "standby",
        "screen",
        "locked",
        "strict",
        "foreign",
    ]) {
        test(`${platform} Local ${mode} retains input ownership`, () => {
            const f = localFixture(platform);
            try {
                if (mode === "list" || mode === "dialog")
                    f.screen({ kind: mode });
                else if (mode === "standby")
                    f.w.__ottStandby = { blocked: () => true };
                else if (mode === "screen")
                    f.w.__ottKiosk = { screenBlocked: () => true };
                else if (mode === "locked")
                    f.w.__ottKiosk = { locked: () => true };
                else if (mode === "strict")
                    f.w.__ottKiosk = { strict: () => true };
                else if (mode === "foreign")
                    f.w.__ottClassicPlayback.snapshot = () => ({
                        historyTarget: {
                            channelId: "102",
                            kind: "live",
                            sourceId: "offline@old",
                        },
                        phase: "playing",
                        target: {
                            channelId: "channel:101",
                            kind: "vod",
                            sourceId: "offline@folder",
                        },
                    });
                assert.equal(
                    f.send("ArrowUp", f.video).defaultPrevented,
                    false
                );
                assert.equal(
                    f.send("ArrowDown", f.video).defaultPrevented,
                    false
                );
                assert.deepEqual(f.calls, []);
            } finally {
                f.close();
            }
        });
    }
}
for (const platform of ["pc", "pc2"]) {
    for (const provider of [
        "m3u",
        "vportal",
        "plex",
        "stalker",
        "torrent",
        "offline",
    ]) {
        for (const kind of ["live", "archive", "vod"]) {
            test(`${platform} ${provider} ${kind} video-focused navigation uses current order`, () => {
                const f = localFixture(platform, "playing", provider);
                try {
                    f.w.playType =
                        kind === "archive"
                            ? 1700000000
                            : kind === "vod"
                              ? -1e11
                              : 0;
                    if (provider !== "offline" || kind !== "vod")
                        f.w.__ottClassicPlayback.snapshot = () => ({
                            phase: "playing",
                            target: { kind },
                        });
                    f.video.focus();
                    f.send("ArrowUp", f.video);
                    f.send("ArrowDown", f.video);
                    assert.deepEqual(f.calls, [
                        ["file", 2, 2, 102],
                        ["file", 2, 1, 101],
                    ]);
                } finally {
                    f.close();
                }
            });
        }
    }
    test(`${platform} video-focused remote Plex queue stays with queue`, () => {
        const f = fixture(platform);
        try {
            f.video.focus();
            f.send("ArrowUp", f.video);
            f.send("ArrowDown", f.video);
            assert.deepEqual(f.calls, [
                ["skip", 1],
                ["skip", -1],
            ]);
        } finally {
            f.close();
        }
    });
    test(`${platform} video-focused custom navigation and explicit seek are preserved`, () => {
        const f = localFixture(platform, "playing", "m3u");
        try {
            f.w.settings.auFun = 16;
            f.w.settings.adFun = 15;
            f.send("ArrowUp", f.video);
            f.send("ArrowDown", f.video);
            assert.deepEqual(f.calls.splice(0), [
                ["file", 2, 0, 103],
                ["file", 2, 1, 101],
            ]);
            f.w.settings.auFun = 18;
            f.w.settings.adFun = 19;
            f.send("ArrowUp", f.video);
            f.send("ArrowDown", f.video);
            assert.deepEqual(f.calls, [
                ["seek", -60],
                ["seek", 60],
            ]);
        } finally {
            f.close();
        }
    });
}
test("Local TV vertical keys retain the configured remote mapping", () => {
    const f = localFixture("lg/webos");
    try {
        assert.equal(f.send("ArrowUp", f.video).defaultPrevented, false);
        assert.deepEqual(f.calls, []);
    } finally {
        f.close();
    }
});

test("TV remote Plex arrows keep seeking", () => {
    const f = fixture("lg/webos", "loading");
    try {
        f.send("ArrowLeft");
        f.send("ArrowRight");
        assert.deepEqual(f.calls, [
            ["seek", -10],
            ["seek", 10],
        ]);
    } finally {
        f.close();
    }
});
console.log(checks + " desktop Plex keyboard scenarios passed");

// The desktop playback contract must also be truthful in Buttons settings.
const settingsSource = ts.createSourceFile(
    "src/index.ts",
    fs.readFileSync(path.join(root, "src/index.ts"), "utf8"),
    ts.ScriptTarget.Latest,
    true
);
const settingsCode = ts.transpileModule(
    settingsSource.statements
        .filter(
            (node) =>
                (ts.isFunctionDeclaration(node) &&
                    ["createSettingsPage", "setListArrays"].includes(
                        node.name?.text
                    )) ||
                (ts.isExpressionStatement(node) &&
                    ts.isBinaryExpression(node.expression) &&
                    ["window.settingsButtons", "window._setSetup"].includes(
                        node.expression.left.getText(settingsSource)
                    ))
        )
        .map((node) => node.getText(settingsSource))
        .join("\n"),
    {
        compilerOptions: {
            module: ts.ModuleKind.ES2015,
            target: ts.ScriptTarget.ES5,
        },
    }
).outputText;
const editorCode = ts
    .transpileModule(
        fs.readFileSync(path.join(root, "src/settings/editor.ts"), "utf8"),
        {
            compilerOptions: {
                module: ts.ModuleKind.ES2015,
                target: ts.ScriptTarget.ES5,
            },
        }
    )
    .outputText.replace(/^import .*$/gm, "")
    .replace(/^export /gm, "");
for (const platform of ["pc", "pc2", "lg/webos"]) {
    test(`${platform} Buttons settings preserves TV mappings and describes playback arrows`, () => {
        const f = fixture(platform);
        try {
            const committed = { alFun: 9, arFun: 10, arrowFun: 2 };
            let writes = [];
            Object.assign(f.w, {
                _: (text, ...args) =>
                    text.replace(/%([1-9])/g, (_, n) => args[Number(n) - 1]),
                beginSettingsDraft() {
                    const draft = { ...committed };
                    f.w.settingsSchema = f.w.listArray
                        .filter((row) => row.settingId)
                        .map((row) => ({ id: row.settingId }));
                    return {
                        active: () => true,
                        cancel() {},
                        commit() {
                            Object.assign(committed, draft);
                            return true;
                        },
                        get: (id) => draft[id] ?? 0,
                        set(id, value) {
                            writes.push(id);
                            draft[id] = value;
                            return true;
                        },
                    };
                },
                closeList() {},
                noop() {},
                normalizeSeekDuration: (value, fallback) => value || fallback,
                optionsList() {},
                renderButtonHint: () => "",
                sALfun: 9,
                sARfun: 10,
                sArrowFun: 2,
                showPage() {},
                showShift() {},
                strLEFT: "LEFT",
                strRIGHT: "RIGHT",
            });
            Object.assign(f.w.keys, {
                ENTER: 13,
                GREEN: 71,
                N0: 48,
                PAUSE: 81,
                PLAY: 80,
                PREV: 83,
                RETURN: 27,
                RW: 82,
            });
            f.w.eval(editorCode + "\n" + settingsCode);
            f.w.settingsButtons();
            const rows = f.w.listArray.filter((row) =>
                /Button.*(?:LEFT|RIGHT).*function when viewing/.test(row.name)
            );
            assert.equal(rows.length, 2);
            if (platform === "lg/webos") {
                assert.deepEqual(
                    Array.from(rows, (row) => row.settingId),
                    ["alFun", "arFun"]
                );
                assert.equal(rows[0].val, 9);
                assert.equal(rows[1].val, 10);
                rows[0].val = 1;
                rows[1].val = 4;
                assert.deepEqual(writes, ["alFun", "arFun"]);
            } else {
                assert.deepEqual(
                    Array.from(rows, (row) => row.cur),
                    ["volume (V−)", "volume (V+)"]
                );
                for (const row of rows) {
                    assert.equal(row.settingId, undefined);
                    f.w.selIndex = f.w.listArray.indexOf(row);
                    for (const key of [
                        f.w.keys.ENTER,
                        f.w.keys.LEFT,
                        f.w.keys.RIGHT,
                    ])
                        f.w.listKeyHandlerFn(key);
                }
                assert.deepEqual(writes, []);
            }
            const navigation = f.w.listArray.find(
                (row) => row.settingId === "arrowFun"
            );
            assert(navigation, "list navigation remains configurable");
            navigation.val = 1;
            assert.deepEqual(
                writes,
                platform === "lg/webos"
                    ? ["alFun", "arFun", "arrowFun"]
                    : ["arrowFun"]
            );
            f.w.listKeyHandlerFn(f.w.keys.GREEN);
            assert.deepEqual(
                committed,
                platform === "lg/webos"
                    ? { alFun: 1, arFun: 4, arrowFun: 1 }
                    : { alFun: 9, arFun: 10, arrowFun: 1 }
            );
            writes = [];
            f.w.settingsButtons();
            f.w.listKeyHandlerFn(f.w.keys.RETURN);
            assert.deepEqual(
                writes,
                [],
                "cancel does not rewrite either mapping"
            );
        } finally {
            f.close();
        }
    });
}
