const {
    attachSourceAliases,
    sourceNames,
} = require("./helpers/english-source-fixture.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const acorn = require("acorn");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const adapter = read("providers/demo/provider.js");
const mediaBase = "https://liminal-sketch-vv8r.here.now/demo/";
acorn.parse(adapter, { ecmaVersion: 5 });

function declarations(file, names) {
    names = sourceNames(file, names);
    const ast = ts.createSourceFile(
        file,
        read(file),
        ts.ScriptTarget.Latest,
        true
    );
    const selected = new Map();
    function include(name) {
        if (selected.has(name)) return;
        let declaration;
        let text;
        for (const node of ast.statements) {
            if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
                declaration = node;
                text = node.getText(ast).replace(/^export\s+/, "");
            } else if (ts.isVariableStatement(node)) {
                for (const item of node.declarationList.declarations) {
                    if (item.name.getText(ast) === name) {
                        declaration = item;
                        text = "var " + item.getText(ast) + ";";
                    }
                }
            }
        }
        assert(declaration, `${file}: actual ${name} declaration`);
        selected.set(name, text);
        function visit(node) {
            if (ts.isIdentifier(node) && /^__ottReadImport\d+$/.test(node.text))
                include(node.text);
            ts.forEachChild(node, visit);
        }
        visit(declaration);
    }
    names.forEach(include);
    return ts.transpileModule([...selected.values()].join("\n"), {
        compilerOptions: {
            module: ts.ModuleKind.None,
            target: ts.ScriptTarget.ES5,
        },
    }).outputText;
}
const providerSource = process.argv.includes("--bundle")
    ? "dist/player.js"
    : "src/provider/index.ts";
const providerUi =
    (process.argv.includes("--bundle")
        ? declarations(providerSource, [
              "legacyPlayerBindings",
              "installEnglishPlayerAliases",
              "translate",
              "legacyPopupActionIds",
              "popupActionId",
          ])
        : "") +
    declarations(providerSource, [
        "providerDistribution",
        "isPlayDistribution",
        "isProviderAllowed",
        "arrayProvaiders",
        "provArray",
        "firstRun",
        "selectProvaider",
        "selectProviderByIndex",
    ]);
const providerLoad =
    (process.argv.includes("--bundle")
        ? declarations(providerSource, ["__spreadArray"])
        : "") +
    declarations(providerSource, [
        "desktopReady",
        "loadProv",
        "syncFromWindow",
    ]);

function storage() {
    return new Map([
        ["ottplayprov", "m3u"],
        [
            "m3um3uArr",
            '{"active":0,"M3Us":[{"www":"https://provider.invalid/private.m3u"}]}',
        ],
        ["m3usPlayers", "2"],
        ["stalkertoken", "saved-private-token"],
    ]);
}
function uiFixture(backing = storage()) {
    const saved = backing;
    const loaded = [];
    const scriptCallbacks = [];
    const media = [{ loop: true }, { loop: true }];
    const w = {
        _: (value) => value,
        __av: "fixture",
        __cv: "fixture",
        $: () => ({
            append() {
                return this;
            },
            attr() {
                return this;
            },
            css() {
                return this;
            },
            hide() {},
            is: () => true,
            on() {
                return this;
            },
        }),
        browserName: () => "browser",
        btnDiv: () => "",
        cancelMediaLoad() {},
        cancelPortChannelIdMigration() {},
        console: { error() {}, warn() {} },
        delOption() {},
        document: {
            createTextNode: (text) => text,
            getElementById: (id) => media[id === "video" ? 0 : 1],
        },
        edit_dealer() {},
        edit_dealer_remote() {},
        epgCash: 0,
        getScriptDOM: (url, ready, failed) => {
            loaded.push(url);
            scriptCallbacks.push({ failed, ready });
        },
        host: "https://player.invalid",
        invalidateEpgCache() {},
        keys: {
            BLUE: 406,
            ENTER: 13,
            GREEN: 402,
            RED: 401,
            RETURN: 27,
            YELLOW: 403,
        },
        launch_id: "#launch",
        listCaptionElement: {},
        listDetail: {},
        listPodval: {},
        loadChannels() {},
        loadOpt() {},
        loadProv: (id) => loaded.push(id),
        loadSettings() {},
        location: { search: "" },
        metadataText: String,
        nofun() {},
        noProvParam() {},
        optIndexOf: () => -1,
        optionsArr: [],
        optionsList() {},
        parentPIN: "*",
        popupActions: [],
        popupArray: [],
        popupDetail: [],
        restoreDemoMute() {},
        savedPopup: {
            popupActions: [() => {}],
            popupArray: ["Menu"],
            popupDetail: [""],
            ver: "fixture",
        },
        selectLang() {},
        showPage() {},
        sNoColorKeys: false,
        sNoNumbersKeys: false,
        sPSprovs: 0,
        stbGetItem: (key) => (saved.has(key) ? saved.get(key) : null),
        stbSetItem: (key, value) => saved.set(key, String(value)),
        strInfo: "",
        strRETURN: "",
        translations: {},
        useGraphicIcons: false,
    };
    w.window = w;
    vm.createContext(w);
    require("./helpers/screen-runtime.cjs")(w);
    require("./helpers/access-runtime.cjs")(w);
    require("./helpers/private-runtime.cjs")(w, "src/provider/runtime.ts");
    require("./helpers/private-runtime.cjs")(
        w,
        "src/provider/driver-profiles.ts"
    );
    require("./helpers/private-runtime.cjs")(
        w,
        "src/provider/stalker-driver.ts"
    );
    require("./helpers/private-runtime.cjs")(
        w,
        "src/provider/catalog-drivers.ts"
    );
    for (const module of [
        "catalog-xml",
        "media-catalog",
        "playlist-drivers",
        "edem-driver",
        "m3u-settings",
        "m3u-driver",
    ])
        require("./helpers/private-runtime.cjs")(
            w,
            "src/provider/" + module + ".ts"
        );
    require("./helpers/private-runtime.cjs")(w, "src/provider/drivers.ts");
    vm.runInContext(providerUi, w);
    if (process.argv.includes("--bundle")) w.installEnglishPlayerAliases(w);
    else attachSourceAliases(w);
    return { loaded, media, saved, scriptCallbacks, w };
}

let cases = 0;
function test(name, action) {
    action();
    cases++;
    console.log("PASS demo: " + name);
}

function sessionFixture(backing) {
    const f = uiFixture(backing);
    vm.runInContext(
        declarations("src/storage/index.ts", [
            "createStorageAdapter",
            "installLocalPlaybackSession",
        ]),
        f.w
    );
    const raw = {
        clear: () => f.saved.clear(),
        del: (key) => f.saved.delete(key),
        dump: () => Object.fromEntries(f.saved),
        get: (key) => (f.saved.has(key) ? f.saved.get(key) : null),
        reset() {},
        set: (key, value) => f.saved.set(key, String(value)),
        transaction(writes, current) {
            if (
                !current() ||
                writes.some(
                    (x) =>
                        (f.saved.has(x.key) ? f.saved.get(x.key) : null) !==
                        x.before
                )
            )
                return false;
            const before = new Map(f.saved);
            for (const entry of writes) {
                if (entry.after === null) f.saved.delete(entry.key);
                else f.saved.set(entry.key, entry.after);
            }
            if (!current()) {
                f.saved.clear();
                before.forEach((v, k) => f.saved.set(k, v));
                return false;
            }
            return true;
        },
    };
    const adapter = f.w.installLocalPlaybackSession(raw);
    f.w.ottpStorage = adapter;
    f.w.stbGetItem = adapter.get;
    f.w.stbSetItem = adapter.set;
    f.w.stbDelItem = adapter.del;
    f.w.__ottLocalMedia = { bindPlaybackOwner() {} };
    vm.runInContext(providerLoad, f.w);
    return { ...f, adapter };
}
test("retained dropped video resumes before URL-pinned provider and explicit selection retires it", () => {
    const backing = storage();
    backing.set("ottplayprov", "m3u");
    const before = new Map(backing);
    const f = sessionFixture(backing);
    f.w.location.search = "?m3u";
    f.adapter.localPlayback.begin(() => "drop", { temporaryLibrary: true });
    let retained = true;
    f.w.__ottLocalMedia.hasDroppedVideo = () => retained;
    f.w.__ottLocalMedia.cancelDroppedVideo = () => {
        retained = false;
        f.adapter.localPlayback.end(false);
    };
    f.w.loadProv();
    assert.equal(f.w.__ottActiveProviderDriver.id, "offline");
    assert.deepEqual(f.saved, before);
    f.w.loadProv("m3u");
    assert.equal(retained, false);
    assert.equal(f.w.__ottActiveProviderDriver.id, "m3u");
    assert.deepEqual(f.saved, before);
});

test("one-off Local never replaces the startup provider, saved Local profile or playback intent", () => {
    for (const provider of ["m3u", "offline", "demo"]) {
        const backing = storage();
        backing.set("ottplayprov", provider);
        backing.set(
            "offlineProfiles",
            '{"active":2,"profiles":[null,null,{"name":"saved"}]}'
        );
        backing.set("localMediaPlaybackSelection", "saved-folder");
        backing.set("offlineplaybackJournal", "saved-bookmark");
        backing.set("offlineprimaryIndex", "9");
        const f = sessionFixture(backing);
        f.w.loadProv();
        assert.equal(f.w.__ottActiveProviderDriver.id, provider);
        const order = [];
        f.w.__ottClassicPlayback = {
            cancel() {
                order.push("cancel");
            },
            checkpointNow() {
                order.push("checkpoint");
            },
        };
        const prior = f.w.__ottActiveProviderDriver;
        const dispose = prior.dispose;
        prior.dispose = () => {
            order.push("dispose");
            dispose();
        };
        f.w.loadProv("offline", () => {
            assert.deepEqual(order.slice(0, 3), [
                "checkpoint",
                "cancel",
                "dispose",
            ]);
            f.adapter.localPlayback.begin(() => "profile2");
            f.w.stbSetItem("localMediaPlaybackSelection", "command-folder");
        });
        assert.equal(
            f.w.__ottActiveProviderDriver.id,
            "offline",
            "Demo cannot override explicit session entry"
        );
        f.w.stbSetItem("ottplayprov", "offline");
        f.w.stbSetItem("ottplayprovs", '["offline"]');
        f.w.providerSetItem("playbackJournal", "command-bookmark");
        f.w.providerSetItem("primaryIndex", "12");
        assert.equal(f.adapter.dump().ottplayprov, provider);
        assert.equal(
            f.adapter.dump().localMediaPlaybackSelection,
            "saved-folder"
        );
        const restart = sessionFixture(backing);
        restart.w.loadProv();
        assert.equal(restart.w.__ottActiveProviderDriver.id, provider);
        assert.equal(
            restart.w.stbGetItem("offlineProfiles"),
            backing.get("offlineProfiles")
        );
        assert.equal(
            restart.w.stbGetItem("localMediaPlaybackSelection"),
            "saved-folder"
        );
        assert.equal(
            restart.w.stbGetItem("offlineplaybackJournal"),
            "saved-bookmark"
        );
        assert.equal(restart.w.stbGetItem("offlineprimaryIndex"), "9");
        assert.equal(
            restart.adapter.localPlayback.active(),
            false,
            "command intent is not replayed on fresh runtime"
        );
    }
});

test("explicit provider choices discard a one-off or promote the same Local selection", () => {
    for (const target of ["m3u", "offline"])
        for (const entry of ["index", "menu"]) {
            const f = sessionFixture(storage());
            f.w.loadProv("offline", () =>
                f.adapter.localPlayback.begin(() => "profile")
            );
            f.w.stbSetItem("localMediaPlaybackSelection", "chosen-folder");
            const tree = ts.createSourceFile(
                "local-media.ts",
                read("src/plugins/local-media.ts"),
                ts.ScriptTarget.Latest,
                true
            );
            let actual, release;
            function visit(node) {
                if (
                    ts.isFunctionDeclaration(node) &&
                    node.name?.text === "finishSession"
                )
                    actual = node.getText(tree);
                if (
                    ts.isFunctionDeclaration(node) &&
                    node.name?.text === "releaseDrop"
                )
                    release = node.getText(tree);
                ts.forEachChild(node, visit);
            }
            visit(tree);
            assert(actual, "real Local session finish function");
            assert(release, "real dropped-file cleanup function");
            const factory = ts.transpileModule(
                "(function(w, retireRemotePlayback, playbackIntentContext) { " +
                    "var droppedPlayback = null; " +
                    release +
                    actual +
                    "; return finishSession; })",
                { compilerOptions: { target: ts.ScriptTarget.ES5 } }
            ).outputText;
            f.w.__ottLocalMedia.finishSession = vm.runInNewContext(factory)(
                f.w,
                () => {},
                () => "profile"
            );
            f.w.__ottLocalMedia.open = () => {};
            f.w.__ottClassicPlayback = { cancel() {}, checkpointNow() {} };
            if (entry === "index")
                assert.equal(
                    f.w.selectProviderByIndex(f.w.providerIds.indexOf(target)),
                    true
                );
            else {
                f.w.selectProvaider();
                f.w.selIndex = f.w.arrayProvaiders.indexOf(target);
                f.w.listKeyHandlerFn(f.w.keys.ENTER);
            }
            assert.equal(
                f.w.__ottActiveProviderDriver.id,
                target,
                "same restored storage value must not skip remount"
            );
            assert.equal(f.saved.get("ottplayprov"), target);
            assert.equal(
                f.saved.get("localMediaPlaybackSelection"),
                target === "offline" ? "chosen-folder" : undefined
            );
            assert.equal(f.adapter.localPlayback.active(), false);
        }
});

test("late session asset failure rolls RAM back once and cannot undo a later explicit provider choice", () => {
    for (const superseded of [false, true]) {
        const f = sessionFixture(storage());
        const requests = [];
        let failed = 0;
        f.w.alert = () => {};
        f.w.firstRun = () => failed++;
        f.w.__ottProviderAssets = {
            classic: {
                ensure(_kind, _host, _version, _owner, ready, error) {
                    requests.push({ error, ready });
                },
            },
        };
        f.w.loadProv("offline", () => {
            const rollback = f.adapter.localPlayback.begin(() => "profile");
            f.adapter.set("localMediaPlaybackSelection", "one-off");
            return rollback;
        });
        assert.equal(f.adapter.get("ottplayprov"), "offline");
        assert.equal(requests.length, 1);
        if (superseded) {
            f.adapter.localPlayback.end(false);
            f.w.stbSetItem("ottplayprov", "demo");
            f.w.loadProv("demo");
            assert.equal(requests.length, 2);
            requests[1].ready();
            assert.equal(f.w.__ottActiveProviderDriver.id, "demo");
        }
        requests[0].error(new Error("delayed fixture asset failure"));
        assert.equal(f.adapter.localPlayback.active(), false);
        assert.equal(f.adapter.get("ottplayprov"), superseded ? "demo" : "m3u");
        assert.equal(f.adapter.get("localMediaPlaybackSelection"), null);
        assert.equal(failed, superseded ? 0 : 1);
        requests[0].error(new Error("duplicate stale failure"));
        assert.equal(f.adapter.get("ottplayprov"), superseded ? "demo" : "m3u");
        if (superseded) assert.equal(f.w.__ottActiveProviderDriver.id, "demo");
    }
});

test("throwing Local handoff recovers its current owner synchronously and after a deferred script", () => {
    for (const deferred of [false, true])
        for (const superseded of ["none", "command", "session"]) {
            const f = sessionFixture(storage());
            f.w.loadProv();
            const previous = f.w.__ottActiveProviderDriver;
            const dispose = previous.dispose;
            let disposals = 0,
                recoveries = 0,
                release,
                calls = 0;
            previous.dispose = () => {
                disposals++;
                dispose();
            };
            f.w.firstRun = () => recoveries++;
            const alerts = [];
            f.w.alert = (message) => alerts.push(message);
            const runtime = f.w.__ottProviderRuntime.classic;
            if (deferred) {
                let legacy;
                runtime.replace((session) => {
                    legacy = session;
                }, true);
                runtime.loadScript(
                    legacy,
                    (_url, ready) => {
                        release = ready;
                    },
                    "fixture",
                    () => {},
                    () => {}
                );
            }
            let replacement;
            assert.doesNotThrow(() =>
                f.w.loadProv("offline", () => {
                    calls++;
                    f.w.s = undefined;
                    if (superseded !== "none") {
                        replacement = {
                            dispose() {
                                throw Error("must retain replacement");
                            },
                            id: "new-owner",
                        };
                        f.w.__ottActiveProviderDriver = replacement;
                        f.w._pendingProvId = "new-owner";
                        f.adapter.localPlayback.begin(() => "new-session");
                        f.adapter.set(
                            "localMediaPlaybackSelection",
                            "new-selection"
                        );
                        if (superseded === "command")
                            f.w.__ottCommandChannelLoad = {};
                        else runtime.replace(() => {}, true);
                    }
                    throw new Error("runtime_changed");
                })
            );
            assert.equal(calls, deferred ? 0 : 1);
            if (deferred) assert.doesNotThrow(() => release());
            assert.equal(calls, 1);
            assert.equal(disposals, 1);
            assert.equal(recoveries, superseded === "none" ? 1 : 0);
            assert.deepEqual(
                alerts,
                superseded === "none" ? ["Failed to load!"] : []
            );
            assert.equal(f.w.__ottActiveProviderDriver, replacement || null);
            assert.equal(f.w.commandChannelsReady, false);
            if (superseded !== "none") {
                assert.equal(f.w._pendingProvId, "new-owner");
                assert.equal(f.adapter.localPlayback.active(), true);
                assert.equal(
                    f.adapter.get("localMediaPlaybackSelection"),
                    "new-selection"
                );
            } else {
                assert.equal(f.w._pendingProvId, "");
                assert.equal(f.adapter.localPlayback.active(), false);
            }
            assert.equal(f.saved.get("ottplayprov"), "m3u");
            assert.equal(f.saved.get("localMediaPlaybackSelection"), undefined);
        }
});

test("first-run action explicitly selects demo without rewriting saved profiles", () => {
    const { w, saved, loaded } = uiFixture();
    const original = new Map(saved);
    w.firstRun();
    assert.deepEqual(
        [...saved],
        [...original],
        "rendering setup writes nothing"
    );
    assert.equal(w.listArray[0].name, "Try demo");
    w.listKeyHandlerFn(w.keys.ENTER);
    assert.equal(saved.get("ottplayprov"), "demo");
    assert.deepEqual(loaded, ["demo"]);
    for (const [key, value] of original)
        if (key !== "ottplayprov") assert.equal(saved.get(key), value);
    assert(w.listArray.some((item) => item.action === w.loadOpt));
    assert(w.listArray.some((item) => item.action === w.selectProvaider));
});

test("later selection and recent-provider reordering retain the demo ID/name pair", () => {
    const { w, saved, loaded } = uiFixture();
    saved.set("ottplayprovs", JSON.stringify(["ottclub", "demo"]));
    w.selectProvaider();
    const demo = w.arrayProvaiders.indexOf("demo");
    assert.equal(w.listArray[demo], "Demo — moving test pattern");
    assert.equal(w.arrayProvaiders[0], "m3u");
    assert.equal(w.arrayProvaiders[1], "stalker");
    assert.equal(w.arrayProvaiders[2], "xtream");
    assert.equal(w.arrayProvaiders[3], "plex");
    assert.equal(w.arrayProvaiders[4], "vportal");
    assert.equal(w.arrayProvaiders[5], "demo");
    assert.equal(w.arrayProvaiders[6], "offline");
    assert.equal(w.arrayProvaiders[7], "");
    w.selIndex = demo;
    w.listKeyHandlerFn(w.keys.ENTER);
    assert.deepEqual(loaded, ["demo"]);
    w.selectProvaider();
    w.selIndex = w.arrayProvaiders.indexOf("m3u");
    w.listKeyHandlerFn(w.keys.ENTER);
    assert.equal(saved.get("ottplayprov"), "m3u");
    assert.equal(saved.get("m3um3uArr"), storage().get("m3um3uArr"));
});

test("protocols and local sources stay above TV services despite old history", () => {
    const { w, saved, loaded } = uiFixture();
    const history = JSON.stringify([
        "plex",
        "demo",
        "m3u",
        "stalker",
        "xtream",
        "offline",
        "torrent",
    ]);
    saved.set("ottplayprovs", history);
    for (const torrentAvailable of [false, true, false, true, false]) {
        w.__ottMediaCompanion = {
            nativePending: () => false,
            providerAvailable: () => torrentAvailable,
        };
        w.selectProvaider();
        const sources = [
            "m3u",
            "stalker",
            "xtream",
            "plex",
            "vportal",
            "demo",
            "offline",
            ...(torrentAvailable ? ["torrent"] : []),
        ];
        const divider = sources.length;
        assert.deepEqual(Array.from(w.arrayProvaiders.slice(0, divider + 1)), [
            ...sources,
            "",
        ]);
        assert.equal(w.arrayProvaiders[divider + 1], "ottclub");
        assert.equal(
            w.arrayProvaiders.filter((id) => id === "torrent").length,
            torrentAvailable ? 1 : 0
        );
        assert.equal(
            w.listArray[3],
            '<div class="btn blue">&nbsp;</div>&nbsp;Plex'
        );
        assert.equal(w.listArray[4], "VPortal");
        assert.equal(w.listArray[5], "Demo — moving test pattern");
        assert.equal(w.listArray[6], "Local videos");
        if (torrentAvailable) assert.equal(w.listArray[7], "Torrent");
        assert.equal(w.listArray[divider], "");
        assert.doesNotMatch(w.getListItemFn(w.listArray[3], 3), /class="btn"/);
        assert.doesNotMatch(w.getListItemFn(w.listArray[4], 4), /class="btn"/);
        assert.doesNotMatch(w.getListItemFn(w.listArray[5], 5), /class="btn"/);
        assert.doesNotMatch(w.getListItemFn(w.listArray[6], 6), /class="btn"/);
        assert.doesNotMatch(
            w.getListItemFn(w.listArray[divider], divider),
            /class="btn"/
        );
        assert.match(
            w.getListItemFn(w.listArray[divider + 1], divider + 1),
            /class="btn">1</
        );
    }
    w.selIndex = 3;
    w.listKeyHandlerFn(w.keys.ENTER);
    assert.equal(saved.get("ottplayprov"), "plex");
    assert.equal(saved.get("ottplayprovs"), history);
    let edited = 0;
    w.__ottEditProvider = () => {
        edited++;
        return true;
    };
    w.selectProvaider();
    w.listKeyHandlerFn(w.keys.ENTER);
    assert.equal(edited, 1, "Reselecting Plex still opens its settings");
    assert.equal(loaded.length, 1);
    saved.set("ottplayprov", "m3u");
    assert.equal(w.selectProviderByIndex(3), true);
    assert.equal(saved.get("ottplayprov"), "plex");
    assert.equal(saved.get("ottplayprovs"), history);
    w.keys.N1 = 49;
    w.listKeyHandlerFn(w.keys.N1);
    assert.equal(
        saved.get("ottplayprov"),
        "ottclub",
        "Number one selects the first TV service after the divider"
    );
});

test("Plex blue shortcut uses every shipped device mapping in both distributions", () => {
    const adapters = fs
        .readdirSync(path.join(root, "devices"), { recursive: true })
        .filter((file) => path.basename(file) === "device.js")
        .sort();
    assert(adapters.length > 0);
    for (const adapter of adapters) {
        const deviceKeys = declarations("devices/" + adapter, ["keys"]);
        for (const distribution of ["full", "play"]) {
            const { w, saved, loaded } = uiFixture();
            vm.runInContext(deviceKeys, w);
            assert(w.keys.BLUE > 0, adapter + " defines BLUE");
            w.providerDistribution = distribution;
            const history = JSON.stringify(["demo"]);
            saved.set("ottplayprovs", history);
            w.selectProvaider();
            const plex = w.arrayProvaiders.indexOf("plex");
            assert.match(w.listArray[plex], /class="btn blue"/);
            w.selIndex = w.arrayProvaiders.indexOf("demo");
            assert.equal(w.listKeyHandlerFn(w.keys.BLUE), true, adapter);
            assert.equal(saved.get("ottplayprov"), "plex", adapter);
            assert.equal(loaded.length, 1);
            assert.equal(saved.get("ottplayprovs"), history);

            let edited = 0;
            w.__ottEditProvider = () => {
                edited++;
                return true;
            };
            w.selectProvaider();
            w.selIndex = w.arrayProvaiders.indexOf("m3u");
            assert.equal(w.listKeyHandlerFn(w.keys.BLUE), true, adapter);
            assert.equal(edited, 1, adapter + " reopens active Plex settings");
            assert.equal(loaded.length, 1, "No redundant provider load");
        }
    }
});

test("service numbering and all nine shortcuts respect the provider-group boundary", () => {
    for (let number = 1; number <= 9; number++) {
        const { w, saved, loaded } = uiFixture();
        saved.set("ottplayprovs", JSON.stringify(["edem", "demo", "ottclub"]));
        w.keys["N" + number] = 48 + number;
        w.selectProvaider();
        const divider = w.arrayProvaiders.indexOf("");
        assert(divider >= 0);
        assert.equal(w.arrayProvaiders[divider + 1], "ottclub");
        assert.equal(w.arrayProvaiders[divider + 2], "edem");
        const index = divider + number;
        const expected = w.arrayProvaiders[index];
        assert.match(
            w.getListItemFn(w.listArray[index], index),
            new RegExp('class="btn">' + number + "<")
        );
        assert.doesNotMatch(
            w.getListItemFn(w.listArray[divider + 10], divider + 10),
            /class="btn">10</
        );
        w.listKeyHandlerFn(48 + number);
        assert.equal(saved.get("ottplayprov"), expected);
        assert.equal(loaded.length, 1);
    }
});

test("malformed recent history keeps the default service order", () => {
    const { w, saved } = uiFixture();
    saved.set("ottplayprovs", "{");
    assert.doesNotThrow(() => w.selectProvaider());
    const firstService = w.arrayProvaiders.indexOf("") + 1;
    assert.equal(w.arrayProvaiders[firstService], "ottclub");
    assert.match(
        w.getListItemFn(w.listArray[firstService], firstService),
        /class="btn">1</
    );
});

test("Plex hides its blue hint when color hints are disabled and remains selectable", () => {
    const { w, saved } = uiFixture();
    w.sNoColorKeys = true;
    w.selectProvaider();
    const plex = w.arrayProvaiders.indexOf("plex");
    assert.equal(w.listArray[plex], "Plex");
    assert.doesNotMatch(w.getListItemFn(w.listArray[plex], plex), /class="btn/);
    w.selIndex = plex;
    assert.equal(w.listKeyHandlerFn(w.keys.ENTER), true);
    assert.equal(saved.get("ottplayprov"), "plex");
});

test("reselecting Stalker opens its current settings without a reload or bypassing hidden settings", () => {
    const { w, saved, loaded } = uiFixture();
    saved.set("ottplayprov", "stalker");
    w.listCaption = {};
    w.listFooter = {};
    w.renderButtonHint = () => "";
    saved.set(
        "stalkerstalker_data",
        JSON.stringify({
            mac: "02:00:00:00:00:01",
            portal: "https://portal.test/c/",
        })
    );
    const registry = w.__ottProviderRuntime.createRegistry();
    const owner = registry.activate("stalker");
    w.__ottProviderDrivers.mount(w, "stalker", owner);
    let options = 0;
    w.optionsList = () => options++;
    for (const key of [w.keys.ENTER, w.keys.GREEN]) {
        w.selectProvaider();
        w.selIndex = w.arrayProvaiders.indexOf("stalker");
        w.listKeyHandlerFn(key);
        assert.equal(w.listCaption.innerHTML, "Select Stalker portal");
        assert.equal(w.listArray.length, 15);
        w.listKeyHandlerFn(w.keys.ENTER);
        assert.equal(w.listCaption.innerHTML, "Stalker Portal Provider");
        assert.equal(w.listArray[0], "Portal URL: https://portal.test/c/");
        assert.equal(w.listArray[1], "MAC address: 02:00:00:00:00:01");
        assert.equal(options, 0);
        assert.deepEqual(loaded, []);
    }
    saved.set("noProvParam", "1");
    w.selectProvaider();
    w.listKeyHandlerFn(w.keys.GREEN);
    assert.equal(options, 1);
    saved.delete("noProvParam");
    registry.dispose();
    w.selectProvaider();
    w.listKeyHandlerFn(w.keys.GREEN);
    assert.equal(options, 2, "retired settings cannot re-open");
});

test("provider switch clears both loop flags and retires demo before loading", () => {
    const { w, media, loaded } = uiFixture();
    vm.runInContext(providerLoad, w);
    if (!process.argv.includes("--bundle")) attachSourceAliases(w);
    w.ottplayDemoActive = true;
    w.loadProv();
    assert.equal(w.ottplayDemoActive, false);
    assert(media.every((item) => item.loop === false));
    assert.deepEqual(loaded, []);
    assert.equal(w.__ottActiveProviderDriver.id, "m3u");
});

test("provider reload revokes channel readiness before its script completes", () => {
    const { w } = uiFixture();
    vm.runInContext(providerLoad, w);
    if (!process.argv.includes("--bundle")) attachSourceAliases(w);
    const previous = {};
    w.__ottCommandChannelLoad = previous;
    w.commandChannelsReady = true;
    w.loadProv();
    assert.equal(w.commandChannelsReady, false);
    assert.notEqual(w.__ottCommandChannelLoad, previous);
});

test("retained Full dealer extension rejects older script completion", () => {
    const { w, saved } = menuFixture(0, 0);
    // A dealer may append a Full extension outside the managed inventory.
    // Built-in providers always require their registered driver.
    w.arrayProvaiders.push("custom/dealer");
    saved.set("ottplayprov", "custom/dealer");
    assert.equal(w.__ottProviderDrivers.registry.has("custom/dealer"), false);
    const scripts = [];
    let channelLoads = 0;
    let fallbackScreens = 0;
    w.loadChannels = () => channelLoads++;
    w.firstRun = () => fallbackScreens++;
    w.getScriptDOM = (url, ready, failed) =>
        scripts.push({ failed, ready, url });
    w.loadProv();
    w.loadProv();
    assert.equal(scripts.length, 1, "replacement waits for the older script");
    assert.equal(
        scripts[0].url,
        "https://player.invalid/prov/custom/dealer/prov.js?fixture"
    );
    scripts[0].ready();
    assert.equal(scripts.length, 2);
    assert.equal(scripts[1].url, scripts[0].url);
    assert.equal(channelLoads, 0);
    scripts[0].failed(new Error("Retired provider"));
    assert.equal(
        fallbackScreens,
        0,
        "stale error cannot replace the current setup"
    );
    assert.equal(w.commandChannelsReady, false);
    // Reuse the checked-in historical adapter to publish real extension hooks.
    vm.runInContext(adapter, w);
    scripts[1].ready();
    assert.equal(channelLoads, 1);
});

test("provider script failure messages follow the selected language", () => {
    const { w, saved } = menuFixture(0, 0);
    w.arrayProvaiders.push("custom/dealer");
    saved.set("ottplayprov", "custom/dealer");
    const alerts = [],
        scripts = [];
    w._ = (key) => "localized:" + key;
    w.alert = (message) => alerts.push(message);
    w.firstRun = () => {};
    w.getScriptDOM = (url, ready, failed) =>
        scripts.push({ failed, ready, url });
    w.loadProv();
    scripts[0].failed(new Error("offline"));
    assert.deepEqual(alerts, ["localized:Failed to load! (custom/dealer)"]);
});

test("Try demo can recover from a failed URL-pinned provider", () => {
    const { w, loaded } = uiFixture();
    vm.runInContext(providerLoad, w);
    if (!process.argv.includes("--bundle")) attachSourceAliases(w);
    w.location.search = "?m3u";
    w.firstRun();
    w.listKeyHandlerFn(w.keys.ENTER);
    assert.deepEqual(
        loaded,
        [],
        "demo starts without executable provider scripts"
    );
    assert.equal(w.__ottActiveProviderDriver.id, "demo");
});

test("leaving demo stops the shell PiP once before retiring its active flag", () => {
    const { w, loaded } = uiFixture();
    vm.runInContext(providerLoad, w);
    if (!process.argv.includes("--bundle")) attachSourceAliases(w);
    const stops = [];
    w.ottplayDemoActive = true;
    w.pipIndex = 0;
    w.stbStopPip = () => stops.push(w.ottplayDemoActive);
    w.loadProv();
    assert.deepEqual(stops, [true]);
    assert.equal(w.pipIndex, null);
    assert.equal(w.ottplayDemoActive, false);
    assert.deepEqual(loaded, []);
    assert.equal(w.__ottActiveProviderDriver.id, "m3u");
    w.loadProv();
    assert.deepEqual(stops, [true], "normal provider reload does not stop PiP");
});

test("demo retirement continues when a shell PiP stop throws", () => {
    const { w, loaded } = uiFixture();
    vm.runInContext(providerLoad, w);
    if (!process.argv.includes("--bundle")) attachSourceAliases(w);
    w.ottplayDemoActive = true;
    w.pipIndex = 0;
    w.stbStopPip = () => {
        throw new Error("shell unavailable");
    };
    w.loadProv();
    assert.equal(w.pipIndex, null);
    assert.equal(w.ottplayDemoActive, false);
    assert.deepEqual(loaded, []);
    assert.equal(w.__ottActiveProviderDriver.id, "m3u");
});

test("provider switch retires an older demo channel-loader callback", () => {
    const { w, loaded } = uiFixture();
    vm.runInContext(providerLoad + adapter, w);
    if (!process.argv.includes("--bundle")) attachSourceAliases(w);
    w.cList = [];
    w.chanels = {};
    const retiredLoad = w.getChanelsArray;
    let completed = 0;
    w.loadProv();
    retiredLoad(() => completed++);
    assert.equal(completed, 0);
    assert.equal(w.cList.length, 0);
    assert.equal(w.ottplayDemoActive, false);
    assert.deepEqual(loaded, []);
    assert.equal(w.__ottActiveProviderDriver.id, "m3u");
});

test("saved demo survives restart of a URL-pinned player and can return to its provider", () => {
    const { w, saved, loaded } = uiFixture();
    vm.runInContext(providerLoad, w);
    if (!process.argv.includes("--bundle")) attachSourceAliases(w);
    w.location.search = "?m3u";
    w.firstRun();
    w.listKeyHandlerFn(w.keys.ENTER);
    w.loadProv();
    assert.equal(
        loaded.length,
        0,
        "demo reloads never request provider scripts"
    );
    assert.equal(saved.get("ottplayprov"), "demo");
    assert.equal(w.__ottActiveProviderDriver.id, "demo");
    w.selectProvaider();
    w.selIndex = w.arrayProvaiders.indexOf("m3u");
    w.listKeyHandlerFn(w.keys.ENTER);
    w.loadProv();
    assert.deepEqual(loaded, []);
    assert.equal(w.__ottActiveProviderDriver.id, "m3u");
    assert.equal(saved.get("ottplayprov"), "m3u");
    assert.deepEqual(loaded, []);
    assert.equal(saved.get("m3um3uArr"), storage().get("m3um3uArr"));
});

test("clear URL still resets a saved demo", () => {
    const { w, saved, loaded } = uiFixture();
    vm.runInContext(providerLoad, w);
    if (!process.argv.includes("--bundle")) attachSourceAliases(w);
    saved.set("ottplayprov", "demo");
    w.location.search = "?clear";
    w.loadProv();
    assert.equal(saved.get("ottplayprov"), "");
    assert.equal(saved.get("noSelProv"), "0");
    assert.deepEqual(loaded, []);
    assert.equal(w.listArray[0].name, "Try demo");
});

test("URL provider keeps its existing priority over other saved providers", () => {
    const { w, saved, loaded } = uiFixture();
    vm.runInContext(providerLoad, w);
    if (!process.argv.includes("--bundle")) attachSourceAliases(w);
    saved.set("ottplayprov", "stalker");
    w.location.search = "?m3u";
    w.loadProv();
    assert.equal(saved.get("ottplayprov"), "stalker");
    assert.deepEqual(loaded, []);
    assert.equal(w.__ottActiveProviderDriver.id, "m3u");
});

function menuFixture(noSelProv, noProvParam, query = "") {
    const f = uiFixture();
    const { w, saved, loaded } = f;
    const errors = [];
    w.console = { error: (error) => errors.push(error), log() {}, warn() {} };
    w.$ = (selector) => {
        const chain = {
            append() {
                return chain;
            },
            attr() {
                return chain;
            },
            css() {
                return chain;
            },
            hide() {
                return chain;
            },
            html() {
                return chain;
            },
            is: () => selector === "#launch",
            on() {
                return chain;
            },
            show() {
                return chain;
            },
        };
        return chain;
    };
    w.__av = "fixture";
    w.curList = [];
    w.primaryIndex = 0;
    w.listPodvalElement = {};
    w.listDetailElement = {};
    w.strTools = "Tools";
    w.sPSoptions = 0;
    w.noProvParam = function noProvParam() {};
    w.optionsArr = [];
    vm.runInContext(
        declarations(
            process.argv.includes("--bundle") ? providerSource : "src/index.ts",
            ["indexOfAction", "optIndexOf", "delOption", "addBtn2menu"]
        ) +
            declarations(providerSource, ["optionsList", "syncFromWindow"]) +
            declarations(
                process.argv.includes("--bundle")
                    ? providerSource
                    : "src/ui/index.ts",
                ["popupList"]
            ) +
            providerLoad,
        w
    );
    if (!process.argv.includes("--bundle")) attachSourceAliases(w);
    w.optionsArr.push({ action: w.selectProvaider, name: "Change provider" });
    w.savedPopup = {
        popupActions: [w.noProvParam, w.nofun, w.optionsList],
        popupArray: ["", "", "Settings"],
        popupDetail: ["", "", "Settings"],
        ver: "fixture",
    };
    w.epgCash = 0;
    w.loadChannels = () => {};
    w.getScriptDOM = (url, ready) => {
        loaded.push(url);
        if (url.includes("/providers/demo/")) vm.runInContext(adapter, w);
        else {
            w.getEPGchanel = () => {};
            w.duneAddSettings = (index) => {
                w.popupActions.splice(
                    index,
                    0,
                    function realProviderSettings() {}
                );
                w.popupArray.splice(index, 0, "Real provider settings");
                w.popupDetail.splice(index, 0, "Real provider settings");
            };
        }
        ready();
    };
    saved.set("ottplayprov", "demo");
    saved.set("noSelProv", String(noSelProv));
    saved.set("noProvParam", String(noProvParam));
    w.location.search = query;
    return { ...f, errors };
}

test("actual source reload revokes old menu and modal ownership", () => {
    const { w } = menuFixture(0, 0, "");
    w.loadProv();
    w.popupList();
    const list = w.__ottClassicScreenPort.listOwner();
    let callbacks = 0;
    const stale = w.__ottClassicScreenPort.setOwnedCallback(
        "dialog",
        () => callbacks++
    );
    w.loadProv();
    stale(w.keys.ENTER);
    assert.equal(list.active(), false);
    assert.equal(callbacks, 0);
});

for (const [noSel, noParams, query] of [
    [0, 0, ""],
    [1, 0, ""],
    [0, 1, ""],
    [1, 1, "?m3u"],
])
    test(`Demo main menu and Settings expose Change provider with locks ${noSel}/${noParams} ${query}`, () => {
        const { w, saved, errors } = menuFixture(noSel, noParams, query);
        const before = new Map(saved);
        w.loadProv();
        assert.deepEqual(errors, [], "actual provider callback completes");
        w.popupList();
        const index = w.listArray.findIndex(
            (row) => row.action === w.selectProvaider
        );
        assert(index >= 0, "main popup has an actionable exit");
        assert.equal(w.listArray[index].name, "Change provider");
        w.selIndex = index;
        w.listKeyHandlerFn(w.keys.ENTER);
        assert.equal(w.listCaptionElement.innerHTML, "Choose provider");
        w.optionsList();
        assert(w.optionsArr.some((row) => row.action === w.selectProvaider));
        assert(w.listArray.some((label) => label.includes("Change provider")));
        w.loadProv();
        assert.equal(
            w.popupActions.filter((action) => action === w.selectProvaider)
                .length,
            1
        );
        assert.equal(
            w.optionsArr.filter((row) => row.action === w.selectProvaider)
                .length,
            1
        );
        assert.deepEqual(
            [...saved],
            [...before],
            "menu availability does not rewrite locks or profiles"
        );
    });

test("explicit provider chosen from pinned Demo loads once, then normal reload obeys the original pin", () => {
    const { w, saved, loaded, errors } = menuFixture(1, 1, "?m3u");
    w.loadProv();
    w.popupList();
    w.selIndex = w.listArray.findIndex(
        (row) => row.action === w.selectProvaider
    );
    w.listKeyHandlerFn(w.keys.ENTER);
    w.selIndex = w.arrayProvaiders.indexOf("stalker");
    w.listKeyHandlerFn(w.keys.ENTER);
    assert.equal(
        loaded.some((url) => url.includes("/providers/stalker/provider.js")),
        false
    );
    assert.equal(w.__ottActiveProviderDriver.id, "stalker");
    assert.equal(saved.get("ottplayprov"), "stalker");
    assert.equal(w.ottplayDemoActive, false);
    assert.equal(w.popupActions.indexOf(w.selectProvaider), -1);
    assert.equal(w.optIndexOf(w.selectProvaider), -1);
    assert.equal(
        w.popupArray.indexOf("Real provider settings"),
        -1,
        "ordinary noProvParam restriction is retained"
    );
    w.loadProv();
    assert.deepEqual(loaded, []);
    assert.equal(w.__ottActiveProviderDriver.id, "m3u");
    assert.equal(saved.get("noSelProv"), "1");
    assert.equal(saved.get("noProvParam"), "1");
    assert.equal(saved.get("m3um3uArr"), storage().get("m3um3uArr"));
    assert.deepEqual(errors, []);
});

test("Demo menu preserves provider parental PIN enforcement", () => {
    const { w } = menuFixture(1, 1);
    const gates = [];
    w.loadProv();
    w.sPSprovs = 1;
    w.parentPIN = "1234";
    w.enterPinAndSetAccess = (action) => gates.push(action);
    w.popupList();
    w.selIndex = w.listArray.findIndex(
        (row) => row.action === w.selectProvaider
    );
    assert(w.selIndex >= 0);
    w.listKeyHandlerFn(w.keys.ENTER);
    assert.deepEqual(gates, [w.selectProvaider]);
    assert.equal(w.listCaptionElement.innerHTML, "Menu");
});

test("Demo exit is removed even when a provider falls back to the live popup snapshot", () => {
    const { w, saved } = menuFixture(1, 1);
    w.loadProv();
    w.savedPopup.popupActions = [];
    saved.set("ottplayprov", "m3u");
    w.loadProv();
    assert.equal(w.popupActions.indexOf(w.selectProvaider), -1);
    assert.equal(w.optIndexOf(w.selectProvaider), -1);
});

function adapterFixture(url, capacitor) {
    const dom = new JSDOM(
        "<!doctype html><video id=video></video><video id=videopip></video>",
        { runScripts: "outside-only", url }
    );
    const w = dom.window;
    const saved = storage();
    w.URL = undefined;
    w.Promise = undefined;
    w.Capacitor = capacitor;
    w.cList = [];
    w.chanels = w.channels = {};
    w.stbGetItem = (key) => (saved.has(key) ? saved.get(key) : null);
    w.stbSetItem = (key, value) => saved.set(key, String(value));
    w.stbDelItem = (key) => saved.delete(key);
    w.eval("function getChannelUrl() { return 'previous-provider'; }");
    if (!process.argv.includes("--bundle")) attachSourceAliases(w);
    w.eval(adapter);
    if (!process.argv.includes("--bundle")) attachSourceAliases(w);
    return { dom, saved, w };
}

for (const page of [
    "https://player.example/index.html?m3u#one",
    "http://localhost:8080/",
    "https://player.example/nested/index.html",
    "https://player.example/f/mag/",
    "http://player.example:8080/f/lg/webos/",
    "tauri://localhost/index.html",
    "capacitor://localhost/index.html",
    "https://localhost/index.html",
])
    test(
        "shared HTTPS MP4 and HLS work independently of the player origin: " +
            page,
        () => {
            const { dom, w, saved } = adapterFixture(
                page,
                /^(?:capacitor:|https:\/\/localhost\/)/.test(page)
                    ? { isNativePlatform: () => true }
                    : undefined
            );
            try {
                const before = new Map(saved);
                let completed = 0;
                w.getChanelsArray(() => completed++);
                assert.equal(completed, 1);
                assert.equal(w.cList.length, 2);
                assert.equal(
                    w.getChannelUrl(w.cList[0]),
                    mediaBase + "pattern.mp4"
                );
                assert.equal(
                    w.getChannelUrl(w.cList[1]),
                    mediaBase + "pattern.m3u8"
                );
                assert.equal(w.chanels[w.cList[0]].rec, 0);
                assert.deepEqual([...saved], [...before]);
                w.providerSetItem("sPlayers", "1");
                assert.equal(saved.get("demosPlayers"), "1");
                assert.equal(saved.get("m3usPlayers"), "2");
                let epg;
                w.getEPGchanel(w.cList[0], (id, data) => {
                    epg = { id, length: data.length };
                });
                assert.deepEqual(epg, { id: w.cList[0], length: 0 });
            } finally {
                dom.window.close();
            }
        }
    );

test("demo neither discovers a local service nor derives media from script or provider hosts", () => {
    const { dom, w } = adapterFixture("tauri://localhost/");
    try {
        w.ottplayGetDemoBaseUrl = () => {
            throw new Error("obsolete local transport invoked");
        };
        w.host = "http://infrastructure.invalid:8080";
        const script = w.document.createElement("script");
        script.src = "https://cdn.invalid/player/dist/player.js";
        w.document.head.appendChild(script);
        w.getChanelsArray(() => {});
        assert.equal(w.getChannelUrl(w.cList[0]), mediaBase + "pattern.mp4");
        assert.equal(w.getChannelUrl(w.cList[1]), mediaBase + "pattern.m3u8");
    } finally {
        dom.window.close();
    }
});

test("channel reload is idempotent and retains demo storage", () => {
    const { dom, w, saved } = adapterFixture("https://player.example/");
    try {
        let completed = 0;
        w.providerSetItem("primaryIndex", "1");
        w.getChanelsArray(() => completed++);
        w.getChanelsArray(() => completed++);
        assert.equal(completed, 2);
        assert.equal(w.cList.length, 2);
        assert.equal(saved.get("demoprimaryIndex"), "1");
        assert.equal(saved.get("m3um3uArr"), storage().get("m3um3uArr"));
    } finally {
        dom.window.close();
    }
});

for (const action of ["switch", "reload"])
    test("retired demo loader cannot revive channel state: " + action, () => {
        const { dom, w } = adapterFixture("tauri://localhost/");
        try {
            const retiredLoad = w.getChanelsArray;
            let completed = 0;
            if (action === "switch") w.ottplayDemoActive = false;
            else w.eval(adapter);
            retiredLoad(() => completed++);
            assert.equal(completed, 0);
            assert.equal(w.cList.length, 0);
        } finally {
            dom.window.close();
        }
    });

const core = ts
    .transpileModule(
        [
            "src/core/buffer-policy.ts",
            "src/core/native-hls.ts",
            "src/core/index.ts",
        ]
            .map(read)
            .join("\n"),
        {
            compilerOptions: {
                module: ts.ModuleKind.ES2015,
                target: ts.ScriptTarget.ES5,
            },
        }
    )
    .outputText.replace(/^import .*\n/gm, "")
    .replace(/^export /gm, "");
function media() {
    return {
        loop: false,
        muted: false,
        mutedAtPlay: [],
        pause() {
            this.paused = true;
        },
        paused: true,
        play() {
            this.mutedAtPlay.push(this.muted);
            this.paused = false;
            this.playCalls++;
        },
        playCalls: 0,
        removeAttribute(key) {
            if (key === "src") this.src = "";
        },
        src: "",
    };
}
function coreFixture() {
    const hls = [];
    const shaka = [];
    function Hls() {
        this.events = {};
        hls.push(this);
    }
    Hls.isSupported = () => true;
    Hls.Events = {
        AUDIO_TRACKS_UPDATED: "audio",
        ERROR: "error",
        MANIFEST_PARSED: "manifest",
    };
    Hls.prototype.on = function (event, action) {
        this.events[event] = action;
    };
    Hls.prototype.loadSource = function (url) {
        this.url = url;
    };
    Hls.prototype.attachMedia = function (video) {
        this.video = video;
    };
    Hls.prototype.destroy = function () {
        this.destroyed = true;
    };
    function Shaka(video) {
        this.video = video;
        shaka.push(this);
    }
    Shaka.isBrowserSupported = () => true;
    Shaka.prototype.load = function (url) {
        this.url = url;
    };
    Shaka.prototype.destroy = function () {};
    const w = {
        $: () => ({ css() {}, hide() {}, show() {} }),
        clearInterval() {},
        clearTimeout() {},
        close() {},
        console: { error() {}, log() {}, warn() {} },
        document: { body: { style: {} } },
        execCHarr() {},
        Hls,
        innerHeight: 720,
        innerWidth: 1280,
        Map: undefined,
        Promise: undefined,
        Set: undefined,
        setInterval() {
            return 1;
        },
        setTimeout() {
            return 1;
        },
        shaka: { Player: Shaka },
        URL: undefined,
    };
    w.window = w;
    vm.createContext(w);
    require("./helpers/screen-runtime.cjs")(w);
    require("./helpers/shared-core-runtime.cjs")(w);
    vm.runInContext(core, w);
    attachSourceAliases(w);
    w.video = media();
    w.videoPip = media();
    return { hls, shaka, w };
}
for (const mode of [0, 1, 2])
    test(
        "demo MP4 loops in main + CSS PiP without changing engine preference " +
            mode,
        () => {
            const { w, hls, shaka } = coreFixture();
            const url = mediaBase + "pattern.mp4";
            w.playerMode = mode;
            w.ottplayDemoActive = true;
            w.stbPlay(url);
            w.stbPlayPip(url);
            assert.equal(w.video.src, url);
            assert.equal(w.videoPip.src, url);
            assert.equal(w.video.loop, true);
            assert.equal(w.videoPip.loop, true);
            assert.equal(w.video.playCalls, 1);
            assert.equal(w.videoPip.playCalls, 1);
            assert.equal(hls.length, 0);
            assert.equal(shaka.length, 0);
            assert.equal(w.playerMode, mode);
            w.stbStop();
            w.stbStopPip();
            assert.equal(w.video.loop, false);
            assert.equal(w.videoPip.loop, false);
        }
    );

test("HLS demo retains manifest-gated playback and loops both video elements", () => {
    const { w, hls } = coreFixture();
    w.playerMode = 1;
    w.ottplayDemoActive = true;
    w.stbPlay(mediaBase + "pattern.m3u8");
    w.stbPlayPip(mediaBase + "pattern.m3u8");
    assert.equal(hls.length, 2);
    assert.equal(w.video.playCalls, 0);
    assert.equal(w.videoPip.playCalls, 0);
    hls[0].events.manifest("manifest", {});
    hls[1].events.manifest();
    assert.equal(w.video.playCalls, 1);
    assert.equal(w.videoPip.playCalls, 1);
    assert.equal(w.video.loop, true);
    assert.equal(w.videoPip.loop, true);
});

test("returning to real provider clears loops and keeps its HLS path", () => {
    const { w, hls } = coreFixture();
    w.playerMode = 1;
    w.ottplayDemoActive = true;
    w.stbPlay(mediaBase + "pattern.mp4");
    w.stbPlayPip(mediaBase + "pattern.mp4");
    w.ottplayDemoActive = false;
    // Even an identically named path is ordinary provider media after switching.
    w.stbPlay("https://provider.example/demo/pattern.mp4");
    w.stbPlayPip("https://provider.example/demo/pattern.mp4");
    assert.equal(w.video.loop, false);
    assert.equal(w.videoPip.loop, false);
    assert.equal(hls.length, 2);
});

for (const initiallyMuted of [false, true]) {
    test(
        "demo autoplay mutes before play, retains the original choice across restart and restores on stop: " +
            initiallyMuted,
        () => {
            const { w } = coreFixture();
            w.video.muted = initiallyMuted;
            w.video.defaultMuted = initiallyMuted;
            w.video.volume = 0.37;
            w.ottplayDemoActive = true;
            w.stbPlay(mediaBase + "pattern.mp4");
            w.stbPlay(mediaBase + "pattern.mp4");
            assert.deepEqual(w.video.mutedAtPlay, [true, true]);
            assert.equal(w.video.muted, true);
            assert.equal(w.video.defaultMuted, initiallyMuted);
            assert.equal(w.video.volume, 0.37);
            w.stbToggleMute();
            assert.equal(
                w.video.muted,
                true,
                "demo cannot opt out of autoplay mute"
            );
            w.stbPause();
            w.stbContinue();
            assert.deepEqual(w.video.mutedAtPlay, [true, true, true]);
            w.stbStop();
            assert.equal(w.video.muted, initiallyMuted);
            assert.equal(w.video.defaultMuted, initiallyMuted);
            assert.equal(w.video.volume, 0.37);
            w.stbStop();
            assert.equal(
                w.video.muted,
                initiallyMuted,
                "repeated stop cannot restore the temporary demo value"
            );
            w.stbPlay(mediaBase + "pattern.mp4");
            assert.equal(w.video.muted, true);
            w.stbStop();
            assert.equal(w.video.muted, initiallyMuted);
        }
    );

    test(
        "normal stream after demo restores mute before play without requiring stop: " +
            initiallyMuted,
        () => {
            const { w } = coreFixture();
            w.video.muted = initiallyMuted;
            w.ottplayDemoActive = true;
            w.stbPlay(mediaBase + "pattern.mp4");
            w.ottplayDemoActive = false;
            w.stbPlay("https://provider.invalid/movie.mp4");
            assert.deepEqual(w.video.mutedAtPlay, [true, initiallyMuted]);
            assert.equal(w.video.muted, initiallyMuted);
            w.stbToggleMute();
            assert.equal(w.video.muted, !initiallyMuted);
            w.stbStop();
            w.stbPlay("https://provider.invalid/next.mp4");
            assert.equal(
                w.video.muted,
                !initiallyMuted,
                "normal mute choice survives stop and channel change"
            );
        }
    );

    test(
        "shared exit and unload restore the previous mute choice: " +
            initiallyMuted,
        () => {
            const { w } = coreFixture();
            w.video.muted = initiallyMuted;
            w.ottplayDemoActive = true;
            w.stbPlay(mediaBase + "pattern.mp4");
            let mutedWhenClosed;
            w.close = () => {
                mutedWhenClosed = w.video.muted;
            };
            w.stbExit();
            assert.equal(mutedWhenClosed, initiallyMuted);
            w.stbPlay(mediaBase + "pattern.mp4");
            w.unload();
            assert.equal(w.video.muted, initiallyMuted);
        }
    );

    test(
        "provider exit restores paused demo before loading its replacement: " +
            initiallyMuted,
        () => {
            const { w, loaded } = uiFixture();
            w.console.log = () => {};
            require("./helpers/shared-core-runtime.cjs")(w);
            vm.runInContext(core + providerLoad, w);
            attachSourceAliases(w);
            w.video = media();
            w.videoPip = media();
            w.video.muted = initiallyMuted;
            w.ottplayDemoActive = true;
            w.stbPlay(mediaBase + "pattern.mp4");
            w.stbPause();
            assert.equal(w.video.muted, true);
            w.loadProv();
            assert.equal(w.video.paused, true);
            assert.equal(w.video.muted, initiallyMuted);
            assert.equal(w.ottplayDemoActive, false);
            assert.deepEqual(loaded, []);
            assert.equal(w.__ottActiveProviderDriver.id, "m3u");
        }
    );
}

test("HLS demo mutes before its delayed manifest callback without changing PiP mute", () => {
    const { w, hls } = coreFixture();
    w.video.muted = false;
    w.videoPip.muted = true;
    w.playerMode = 1;
    w.ottplayDemoActive = true;
    w.stbPlay(mediaBase + "pattern.m3u8");
    assert.equal(w.video.muted, true);
    assert.deepEqual(w.video.mutedAtPlay, []);
    hls[0].events.manifest("manifest", {});
    assert.deepEqual(w.video.mutedAtPlay, [true]);
    w.stbStop();
    assert.equal(w.video.muted, false);
    assert.equal(w.videoPip.muted, true);
    hls[0].events.manifest("manifest", {});
    assert.equal(
        w.video.muted,
        false,
        "retired HLS callback cannot reapply demo mute"
    );
});

console.log(
    "PASS demo provider/core contract: " +
        cases +
        " scenarios; no native decoder claim"
);
