const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
function compile(file, names) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const input = names
        ? ast.statements
              .filter(
                  (n) =>
                      ts.isFunctionDeclaration(n) &&
                      names.includes(n.name?.text)
              )
              .map((n) => n.getText(ast))
              .join("\n")
        : text;
    const code = ts.transpileModule(input, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
        },
    }).outputText;
    require("acorn").parse(code, { ecmaVersion: 5 });
    return code;
}
function moduleSource(file) {
    const exports = {};
    vm.runInNewContext(compile(file), { exports });
    return exports;
}
const base = "https://library.test/offline-media/" + "t".repeat(32);
const sourceUrl = base + "/" + "a".repeat(32);
const prepareUrl = base + "/compat/" + "a".repeat(32) + "/prepare";
const clone = (value) => JSON.parse(JSON.stringify(value));
const flush = async () => {
    for (let n = 0; n < 30; n++) await Promise.resolve();
};
function deferred() {
    let resolve;
    const promise = new Promise((done) => {
        resolve = done;
    });
    return { promise, resolve };
}
function fixture(options = {}) {
    const calls = [],
        timers = new Map(),
        values = new Map([
            [
                "localMediaEndpoint",
                options.endpoint === undefined ? base : options.endpoint,
            ],
        ]);
    let leaseNumber = 0,
        blocked = false;
    const catalog = {
        compatibility: {
            available: true,
            formats: ["avi", "mkv"],
            modes: ["remux", "transcode"],
        },
        items: [
            {
                id: "mp4",
                name: "direct.mp4",
                sourceId: "folder",
                url: base + "/mp4",
            },
            {
                id: "a".repeat(32),
                name: "movie.avi",
                playback: {
                    mime: "application/vnd.apple.mpegurl",
                    mode: "compatibility",
                    prepareUrl,
                },
                sourceId: "folder",
                url: sourceUrl,
            },
        ],
        scanning: false,
        sources: [
            { available: true, id: "folder", kind: "folder", name: "Movies" },
        ],
    };
    function descriptor(extra = {}) {
        const lease = (++leaseNumber).toString(16).padStart(32, "0");
        return {
            duration: 7321.5,
            finite: true,
            lease,
            mime: "application/vnd.apple.mpegurl",
            mode: "transcode",
            timeline: "vod",
            timeOrigin: 0,
            url: prepareUrl.replace(/prepare$/, lease + "/index.m3u8"),
            ...extra,
        };
    }
    const native = {
        importFiles: () => {
            calls.push(["native-import"]);
            return Promise.resolve(clone(catalog));
        },
        list: async () => {
            calls.push(["native-list"]);
            return clone(catalog);
        },
        requestAccess: async () => {
            calls.push(["native-access"]);
            return clone(catalog);
        },
    };
    const w = {
        _: (v) => v,
        __ottStandby: { blocked: () => blocked },
        $: () => ({ hide() {} }),
        AbortController,
        closeList() {},
        fetch: async (url, init = {}) => {
            calls.push([url, init]);
            if (init.method === "POST") {
                if (url.endsWith("/cancel")) return { ok: true };
                if (options.prepare)
                    return options.prepare(url, init, descriptor);
                return { json: async () => descriptor(), ok: true };
            }
            if (options.read) {
                const response = options.read();
                if (response) return response;
            }
            return { json: async () => clone(catalog), ok: true };
        },
        indexedDB: {},
        keys: { ENTER: 13, EXIT: 8, RETURN: 27 },
        listCaption: {},
        listDetail: {},
        listFooter: {},
        optionsList() {},
        renderButtonHint: () => "",
        showEditKey() {},
        showPage() {},
        stbGetItem: (key) => values.get(key) || "",
        stbSetItem: (key, value) => values.set(key, value),
    };
    if (options.capacitor) w.Capacitor = { isNativePlatform: () => true };
    const exports = {};
    const requires = {
        "../commands/remote-feature": {
            loadRemoteFeature: (host, kind, done) => {
                if (options.loadFeature)
                    return options.loadFeature(host, kind, done, loadFeature);
                loadFeature(kind);
                done();
            },
        },
        "../offline/browser-local-media": {
            installBrowserLocalMedia: () => ({ suspend() {} }),
            installOfflineShell() {},
        },
        "../offline/local-media-progress": moduleSource(
            "src/offline/local-media-progress.ts"
        ),
        "../offline/playback-selection": moduleSource(
            "src/offline/playback-selection.ts"
        ),
        "../offline/profiles": { installOfflineProfiles() {} },
        "./native-bridge": { resolveNativePlugin: () => native },
    };
    function loadFeature(kind) {
        vm.runInNewContext(compile("src/plugins/" + kind + ".ts"), {
            clearTimeout: (id) => timers.delete(id),
            Promise,
            setTimeout: (fn, ms) => {
                const id = {};
                timers.set(id, { fn, ms });
                return id;
            },
            URL,
            window: w,
        });
        if (kind === "local-compatibility")
            vm.runInNewContext(
                compile("src/commands/remote-local-source-diagnostics.ts"),
                { window: w }
            );
    }
    if (!options.loadFeature) {
        loadFeature("local-media-ui");
        loadFeature("local-compatibility");
    }
    vm.runInNewContext(compile("src/plugins/local-media.ts"), {
        clearTimeout: (id) => timers.delete(id),
        exports,
        require: (name) => {
            assert(name in requires, name);
            return requires[name];
        },
        setTimeout: (fn, ms) => {
            const id = {};
            timers.set(id, { fn, ms });
            return id;
        },
        URL,
    });
    const api = exports.installLocalMedia(w);
    return {
        api,
        block: () => {
            blocked = true;
        },
        calls,
        catalog,
        descriptor,
        timers,
        values,
        w,
    };
}
test("shared direct Local preparation warms diagnostics without waiting or changing the source", async () => {
    let load, finish;
    const f = fixture({
        loadFeature: (w, kind, done, implementation) => {
            assert.equal(kind, "local-compatibility");
            load = () => implementation(kind);
            finish = done;
        },
    });
    await f.api.list();
    assert.equal(f.w.__ottLocalSourceDiagnostics, undefined);
    const direct = f.catalog.items[0].url;
    assert.equal(await f.api.preparePlayback(direct), direct);
    assert.equal(typeof load, "function");
    assert.equal(f.w.__ottLocalSourceDiagnostics, undefined);
    load();
    finish();
    assert.equal(typeof f.w.__ottLocalSourceDiagnostics, "function");
});

test("failed diagnostic asset warmup does not reject direct Local playback", async () => {
    const f = fixture({
        loadFeature: (_w, _kind, done) => done("unsupported"),
    });
    await f.api.list();
    const direct = f.catalog.items[0].url;
    assert.equal(await f.api.preparePlayback(direct), direct);
    assert.equal(f.w.__ottLocalSourceDiagnostics, undefined);
});

function startDirectCore(f, url) {
    const started = [],
        w = f.w;
    Object.assign(w, {
        _corePauseRevision: 0,
        _coreSeekRevision: 0,
        _coreShakaTeardown: null,
        _playSession: 0,
        cancelCoreAutoPlayback() {},
        cancelCoreCompat() {},
        cancelCoreNativeHls() {},
        cancelCoreSeek() {},
        cancelCoreSourcePreparation() {},
        cancelCoreStreamAttempt() {},
        clearPlayTimeInterval() {},
        clearTimeout() {},
        coreDeviceEffects: {},
        coreNormalizedTimeout: () => 0,
        corePlexPlaybackHint: () => "",
        createCoreStreamAttempt: () => null,
        destroyCoreShaka() {},
        hlsInstance: null,
        releaseCoreCompanion() {},
        setCoreDemoMute() {},
        setTimeout: () => 1,
        startCorePlayback: (...args) => started.push(args),
        video: {
            addEventListener() {},
            currentTime: 0,
            removeEventListener() {},
        },
    });
    w.window = w;
    vm.createContext(w);
    vm.runInContext(
        compile("src/core/index.ts", [
            "startCoreEngine",
            "coreCompat",
            "coreCall",
        ]),
        w
    );
    w.startCoreEngine(url);
    return started;
}

test("actual core direct Local path starts immediately and warms its diagnostic observer", async () => {
    let finish;
    const f = fixture({
        loadFeature: (_w, kind, done, implementation) => {
            assert.equal(kind, "local-compatibility");
            finish = () => {
                implementation(kind);
                done();
            };
        },
    });
    await f.api.list();
    const direct = f.catalog.items[0].url;
    const started = startDirectCore(f, direct);
    assert.equal(started.length, 1);
    assert.equal(started[0][0], direct);
    assert.equal(f.w.__ottLocalSourceDiagnostics, undefined);
    assert.equal(typeof finish, "function");
    finish();
    assert.equal(typeof f.w.__ottLocalSourceDiagnostics, "function");
    assert.equal(started.length, 1);
});

test("actual core direct Local playback survives failed diagnostic loading", async () => {
    const f = fixture({
        loadFeature: (_w, _kind, done) => done("unavailable"),
    });
    await f.api.list();
    const direct = f.catalog.items[0].url;
    assert.equal(startDirectCore(f, direct)[0][0], direct);
    await flush();
    assert.equal(f.w.__ottLocalSourceDiagnostics, undefined);
});

test("registered diagnostics prove cached direct and compatibility identities without storage reads", async () => {
    const f = fixture();
    const sourceId = "b".repeat(32);
    f.catalog.sources[0].id = sourceId;
    f.catalog.items.forEach((item) => {
        item.sourceId = sourceId;
    });
    await f.api.list();
    const prepared = await f.api.preparePlayback(sourceUrl);
    assert.equal(typeof f.api.diagnosticSource, "function");
    f.w.stbGetItem = () => assert.fail("diagnostics must not read storage");
    const direct = clone(f.api.diagnosticSource(sourceUrl));
    const compatibility = clone(f.api.diagnosticSource(prepared));
    assert.deepEqual(direct, {
        itemId: "a".repeat(32),
        revision: direct.revision,
        sourceId,
    });
    assert.deepEqual(compatibility, direct);
    assert.equal(f.api.diagnosticSource(prepared + "/other"), null);
    f.api.didRestoreLibrary();
    assert.equal(f.api.diagnosticSource(sourceUrl), null);
    assert.equal(f.api.diagnosticSource(prepared), null);
});
test("finite prepare maps scoped URL to the stable source ID and cancels only its lease", async () => {
    const f = fixture();
    await f.api.list();
    const url = await f.api.preparePlayback(sourceUrl);
    assert.match(url, /[a-f0-9]{32}\/index\.m3u8$/);
    assert.equal(f.api.isPlaybackUrl(url), true);
    assert.equal(f.api.playbackSourceUrl(url), sourceUrl);
    assert.equal(f.api.compatibilityPlayback(url), true);
    assert.equal((await f.api.snapshot()).items[1].id, "a".repeat(32));
    assert.equal(
        (await f.api.snapshot()).items[1].url,
        sourceUrl,
        "runtime leases never replace persistent item identity"
    );
    f.api.cancelPlayback(url);
    await flush();
    const cancel = f.calls.find((c) => c[0].endsWith?.("/cancel"));
    assert.equal(cancel[0], prepareUrl.replace(/prepare$/, "cancel"));
    assert.match(cancel[1].headers["X-OTT-Playback-Lease"], /^[a-f0-9]{32}$/);
    assert.equal(cancel[1].body, undefined);
    assert.equal(f.timers.size, 0);
});
for (const invalid of [
    { finite: false },
    { timeline: "live" },
    { timeOrigin: 5 },
    { duration: 0 },
    { duration: Infinity },
    { mode: "copy" },
    { mime: "video/mp4" },
    { lease: "UPPERCASE" },
    { url: "https://other.test/stolen.m3u8" },
])
    test(
        "invalid finite/lease descriptor fails closed: " +
            JSON.stringify(invalid),
        async () => {
            const f = fixture({
                prepare: async (_url, _init, descriptor) => ({
                    json: async () => descriptor(invalid),
                    ok: true,
                }),
            });
            await f.api.list();
            await assert.rejects(
                f.api.preparePlayback(sourceUrl),
                /could not be prepared/
            );
            assert.equal(f.timers.size, 0);
        }
    );
test("missing tools keeps direct MP4 playable and unsupported identity visible without Loading", async () => {
    const f = fixture();
    f.catalog.compatibility.available = false;
    f.catalog.compatibility.reason = "tools_unavailable";
    f.catalog.items[1].url = "";
    f.catalog.items[1].available = false;
    f.catalog.items[1].playback = {
        mode: "unsupported",
        reason: "compatibility_unavailable",
    };
    await f.api.list();
    assert.equal(await f.api.preparePlayback(base + "/mp4"), base + "/mp4");
    await assert.rejects(
        f.api.preparePlayback(""),
        /compatibility is unavailable/
    );
    const snapshot = await f.api.snapshot();
    assert.equal(snapshot.items.length, 2);
    assert.equal(snapshot.items[1].id, "a".repeat(32));
    assert.match(f.api.failureMessage(snapshot), /native or Server library/);
    let failure;
    f.w._ = (key) => "translated: " + key;
    f.w.showShift = (message) => {
        failure = message;
    };
    f.api.compatibilityFailure();
    assert.equal(failure, "translated: Local source unavailable");
    f.api.open(false, true);
    assert(
        f.w.listArray.some((row) => row.id === "unsupported-" + "a".repeat(32))
    );
    assert.equal(f.timers.size, 0);
});
test("verified lease keeps its source through empty and partial refresh and renews after cancellation", async () => {
    let reading;
    const f = fixture({ read: () => reading?.promise });
    await f.api.list();
    const first = await f.api.preparePlayback(sourceUrl);
    reading = deferred();
    const refresh = f.api.list(() => false);
    assert.equal(
        f.api.compatibilityPlayback(first),
        true,
        "last=null keeps the owned descriptor"
    );
    assert.equal(f.api.isPlaybackUrl(first), true);
    assert.equal(f.api.playbackSourceUrl(first), sourceUrl);
    f.api.cancelPlayback(first);
    const second = await f.api.preparePlayback(first);
    assert.notEqual(second, first);
    assert.equal(f.api.playbackSourceUrl(second), sourceUrl);
    const partial = clone(f.catalog);
    partial.scanning = true;
    partial.sourceScans = [
        { generation: 1, sourceId: "folder", state: "scanning" },
    ];
    partial.items = partial.items.slice(0, 1);
    reading.resolve({ json: async () => partial, ok: true });
    await refresh;
    assert.equal(
        f.api.compatibilityPlayback(second),
        true,
        "a prefix may omit the active item"
    );
    f.api.cancelPlayback(second);
    const third = await f.api.preparePlayback(second);
    assert.equal(f.api.playbackSourceUrl(third), sourceUrl);
    assert.equal(f.calls.filter((c) => c[0] === prepareUrl).length, 3);
    assert.equal(f.timers.size, 0);
});

for (const kind of [
    "removed",
    "source-complete",
    "source-unavailable",
    "source-removed",
    "item-unavailable",
    "source-mismatch",
    "id-mismatch",
    "unsupported",
]) {
    test("lease snapshot fails closed after " + kind, async () => {
        const f = fixture();
        await f.api.list();
        const lease = await f.api.preparePlayback(sourceUrl);
        if (kind === "item-unavailable") f.catalog.items[1].available = false;
        else if (kind === "unsupported")
            f.catalog.items[1].playback.mode = "unsupported";
        else if (kind === "source-mismatch")
            f.catalog.items[1].sourceId = "other";
        else if (kind === "id-mismatch") f.catalog.items[1].id = "b".repeat(32);
        else f.catalog.items = f.catalog.items.slice(0, 1);
        if (kind === "source-unavailable") {
            f.catalog.scanning = true;
            f.catalog.sources[0].available = false;
        }
        if (kind === "source-removed") {
            f.catalog.scanning = true;
            f.catalog.sources = [];
        }
        if (kind === "source-complete") {
            f.catalog.scanning = true;
            f.catalog.sourceScans = [
                { generation: 1, sourceId: "folder", state: "complete" },
            ];
        }
        await f.api.list(() => false);
        assert.equal(f.api.isPlaybackUrl(lease), false);
        assert.equal(f.api.compatibilityPlayback(lease), false);
        await assert.rejects(f.api.preparePlayback(lease));
        await assert.rejects(f.api.preparePlayback(sourceUrl));
        assert.equal(f.calls.filter((c) => c[0] === prepareUrl).length, 1);
        assert.equal(f.timers.size, 0);
    });
}

for (const kind of ["library", "profile", "bindings", "cancel-all"]) {
    test("lease snapshots cannot cross " + kind + " ownership", async () => {
        let reading,
            profile = "old";
        const f = fixture({ read: () => reading?.promise });
        f.w.__ottOfflineProfiles = {
            current: () => ({ id: profile }),
            namespace: () => "offline",
        };
        await f.api.list();
        const lease = await f.api.preparePlayback(sourceUrl);
        reading = deferred();
        const refresh = f.api.list(() => false);
        if (kind === "library")
            f.values.set("localMediaEndpoint", "https://other.test/library");
        if (kind === "profile") profile = "new";
        if (kind === "bindings") f.values.set("offlineProfileBindings", "new");
        if (kind === "cancel-all") f.api.cancelPlayback();
        assert.equal(f.api.isPlaybackUrl(lease), false);
        await assert.rejects(f.api.preparePlayback(lease));
        await assert.rejects(f.api.preparePlayback(sourceUrl));
        assert.equal(f.calls.filter((c) => c[0] === prepareUrl).length, 1);
        reading.resolve({ json: async () => clone(f.catalog), ok: true });
        await refresh;
        if (kind !== "library") {
            const next = await f.api.preparePlayback(sourceUrl);
            assert.notEqual(
                next,
                lease,
                "fresh accepted metadata can prepare under the new owner"
            );
        }
        assert.equal(f.timers.size, 0);
    });
}

test("cancelled late prepare cannot start playback and its returned lease is cancelled", async () => {
    const waiting = deferred();
    const f = fixture({
        prepare: async () => ({ json: () => waiting.promise, ok: true }),
    });
    await f.api.list();
    const pending = f.api.preparePlayback(sourceUrl);
    const rejected = assert.rejects(pending, /cancelled/);
    pending.cancel();
    await rejected;
    waiting.resolve(f.descriptor());
    await flush();
    assert(f.calls.some((call) => call[0].endsWith?.("/cancel")));
    assert.equal(f.timers.size, 0);
});
test("standby rejects preparation and cancels current lease without source copies", async () => {
    const f = fixture();
    await f.api.list();
    const url = await f.api.preparePlayback(sourceUrl);
    f.block();
    f.api.suspend();
    await assert.rejects(f.api.preparePlayback(sourceUrl), /cancelled/);
    await flush();
    assert(
        f.calls.some(
            (call) =>
                call[0].endsWith?.("/cancel") &&
                url.includes(call[1].headers["X-OTT-Playback-Lease"])
        )
    );
    assert(f.calls.every((call) => call[1]?.body === undefined));
});
test("lease history is bounded while retaining the current engine's source mapping", async () => {
    const f = fixture();
    await f.api.list();
    const first = await f.api.preparePlayback(sourceUrl);
    f.w.__ottCoreCompatibilityUrl = first;
    f.api.cancelPlayback(first);
    let removed, latest;
    for (let n = 0; n < 40; n++) {
        latest = await f.api.preparePlayback(sourceUrl);
        if (n === 0) removed = latest;
        f.api.cancelPlayback(latest);
    }
    assert.equal(f.api.isPlaybackUrl(first), true);
    assert.equal(f.api.isPlaybackUrl(removed), false);
    assert.equal(f.api.isPlaybackUrl(latest), true);
});
test("Capacitor explicitly selects Server library and returns to unchanged native handles", async () => {
    const f = fixture({ capacitor: true });
    await f.api.list();
    assert.equal(f.api.libraryIdentity(), "browser:" + base);
    assert(!f.calls.some((c) => c[0] === "native-list"));
    assert.deepEqual(clone(f.api.libraryWrite("capacitor")), {
        key: "localMediaEndpoint",
        value: "",
    });
    f.values.set("localMediaEndpoint", "");
    await f.api.list();
    assert.equal(f.api.libraryIdentity(), "capacitor");
    assert(f.calls.some((c) => c[0] === "native-list"));
    const setting = f.api.libraryWrite("browser:" + base);
    assert.equal(setting.value, base);
    f.api.open(false, true);
    assert(f.w.listArray.some((row) => row.id === "server-library"));
});
function seekFixture(paused = false) {
    const calls = [],
        waiting = [];
    const w = {
        __ottCoreCompatibilityUrl: "https://library.test/old/index.m3u8",
        __ottLocalMedia: {
            cancelPlayback: (url) => calls.push(["cancel", url]),
            compatibilityPlayback: () => true,
            playbackSourceUrl: () => sourceUrl,
            preparePlayback: () => {
                const pending = deferred();
                pending.promise.cancel = () => calls.push(["cancel-pending"]);
                waiting.push(pending);
                return pending.promise;
            },
        },
        forcePlay: !paused,
    };
    w.window = w;
    Object.assign(w, {
        _corePendingSeek: null,
        _corePendingSeekPosition: null,
        _coreSeekRevision: 0,
        _playSession: 7,
        coreNativeAttached: true,
        coreStreamFailure: (...args) => calls.push(["failed", ...args]),
        destroyCoreShaka() {},
        hlsInstance: {
            config: {},
            destroy: () => calls.push(["destroy"]),
            stopLoad: () => calls.push(["stop-load"]),
        },
        initialHlsBufferPolicy: {},
        startCorePlayback: (...args) => calls.push(["start", ...args]),
        video: {
            currentTime: 120,
            duration: 7321.5,
            pause() {
                calls.push(["pause"]);
                this.paused = true;
            },
            paused,
            removeAttribute: (name) => calls.push(["remove", name]),
        },
    });
    vm.createContext(w);
    vm.runInContext(
        compile("src/core/index.ts", [
            "cancelCoreSeek",
            "seekCoreMedia",
            "coreField",
            "coreCall",
        ]),
        w
    );
    return { calls, w, waiting };
}
test("compatibility seek keeps source time, retires old lease and waits before attaching the new VOD", async () => {
    const f = seekFixture();
    f.w.seekCoreMedia(3600, 7);
    assert.equal(f.w._corePendingSeekPosition, 3600);
    assert(!f.calls.some((c) => c[0] === "start"));
    f.waiting[0].resolve("https://library.test/new/index.m3u8");
    await flush();
    assert.deepEqual(
        f.calls.find((c) => c[0] === "start"),
        [
            "start",
            "https://library.test/new/index.m3u8",
            3600,
            7,
            sourceUrl,
            false,
            true,
        ]
    );
    assert.equal(f.w.forcePlay, true);
    assert.equal(f.w._corePendingSeekPosition, null);
});
test("paused compatibility seek stays paused and a superseded seek cannot attach late", async () => {
    const f = seekFixture(true);
    f.w.seekCoreMedia(1000, 7);
    f.w.seekCoreMedia(2000, 7);
    f.waiting[0].resolve("https://library.test/stale/index.m3u8");
    await flush();
    assert(!f.calls.some((c) => c[0] === "start"));
    f.waiting[1].resolve("https://library.test/current/index.m3u8");
    await flush();
    assert.equal(f.calls.filter((c) => c[0] === "start").length, 1);
    assert.equal(f.calls.find((c) => c[0] === "start")[2], 2000);
    assert.equal(f.w.forcePlay, false);
});
test("standby/session change fences late compatibility seek completion", async () => {
    const f = seekFixture();
    f.w.seekCoreMedia(300, 7);
    f.w._playSession++;
    f.w.cancelCoreSeek();
    f.waiting[0].resolve("https://library.test/stale/index.m3u8");
    await flush();
    assert(!f.calls.some((c) => c[0] === "start"));
    assert.equal(f.w._corePendingSeekPosition, null);
});
test("offline driver resolves asynchronously and disposal fences a late prepare", async () => {
    const waiting = deferred();
    const f = fixture({
        prepare: async () => ({ json: () => waiting.promise, ok: true }),
    });
    await f.api.list();
    const context = { Promise, window: f.w };
    vm.createContext(context);
    vm.runInContext(
        compile("src/provider/drivers.ts", [
            "emptyDriverCatalog",
            "createOfflineDriver",
            "driverField",
        ]),
        context
    );
    const driver = context.createOfflineDriver(
        {},
        { active: () => true, own: () => () => {} }
    );
    const ready = [];
    driver.resolveStream(sourceUrl, (url) => ready.push(url));
    driver.dispose();
    waiting.resolve(f.descriptor());
    await flush();
    assert.deepEqual(ready, []);
    assert(f.calls.some((c) => c[0].endsWith?.("/cancel")));
});
test("offline driver delivers a direct MP4 while the optional diagnostic asset is still loading", async () => {
    let finish;
    const f = fixture({
        loadFeature(_w, kind, done, load) {
            assert.equal(kind, "local-compatibility");
            finish = () => {
                load(kind);
                done();
            };
        },
    });
    await f.api.list();
    const context = { Promise, window: f.w };
    vm.createContext(context);
    vm.runInContext(
        compile("src/provider/drivers.ts", [
            "emptyDriverCatalog",
            "createOfflineDriver",
            "driverField",
        ]),
        context
    );
    const driver = context.createOfflineDriver(
        {},
        { active: () => true, own: () => () => {} }
    );
    const ready = [];
    const direct = f.catalog.items[0].url;
    driver.resolveStream(direct, (url) => ready.push(url));
    await flush();
    assert.deepEqual(ready, [direct]);
    assert.equal(f.w.__ottLocalSourceDiagnostics, undefined);
    finish();
    assert.equal(typeof f.w.__ottLocalSourceDiagnostics, "function");
    assert.equal(typeof f.api.diagnosticSource, "function");
    driver.dispose();
});
test("latest user pause/resume intent wins while compatibility seek is preparing", async () => {
    for (const paused of [false, true]) {
        const f = seekFixture(paused);
        f.w.seekCoreMedia(800, 7);
        f.w.forcePlay = paused;
        f.waiting[0].resolve("https://library.test/current/index.m3u8");
        await flush();
        assert.equal(f.w.forcePlay, paused);
    }
});
test("prepare deadline allows the server's 30-second budget then settles without late playback", async () => {
    const waiting = deferred();
    const f = fixture({
        prepare: async () => ({ json: () => waiting.promise, ok: true }),
    });
    await f.api.list();
    const pending = f.api.preparePlayback(sourceUrl);
    const rejected = assert.rejects(pending, /cancelled/);
    const deadline = [...f.timers.values()].find((timer) => timer.ms === 35000);
    assert(deadline);
    deadline.fn();
    await rejected;
    waiting.resolve(f.descriptor());
    await flush();
    assert(f.calls.some((c) => c[0].endsWith?.("/cancel")));
    assert.equal(f.timers.size, 0);
});
test("only two compatibility preparations can be pending and cancellation releases the budget", async () => {
    const waiting = deferred();
    const f = fixture({
        prepare: async () => ({ json: () => waiting.promise, ok: true }),
    });
    await f.api.list();
    const a = f.api.preparePlayback(sourceUrl),
        b = f.api.preparePlayback(sourceUrl);
    const rejected = [
        assert.rejects(a, /cancelled/),
        assert.rejects(b, /cancelled/),
    ];
    await assert.rejects(f.api.preparePlayback(sourceUrl), /Too many/);
    f.api.cancelPlayback();
    await Promise.all(rejected);
    waiting.resolve(f.descriptor());
    await flush();
    assert.equal(f.timers.size, 0);
});
test("a changed Server library cannot receive a late lease from its predecessor", async () => {
    const waiting = deferred();
    const f = fixture({
        prepare: async () => ({ json: () => waiting.promise, ok: true }),
    });
    await f.api.list();
    const pending = f.api.preparePlayback(sourceUrl);
    const rejected = assert.rejects(pending, /cancelled/);
    f.values.set("localMediaEndpoint", "https://new-server.test/library");
    waiting.resolve(f.descriptor());
    await rejected;
    await flush();
    assert(
        f.calls.some((c) => c[0] === prepareUrl.replace(/prepare$/, "cancel"))
    );
});

test("optional compatibility download is cancellable before any prepare POST", async () => {
    let ready;
    const f = fixture({
        loadFeature(host, kind, done, load) {
            ready = () => {
                load(kind);
                done();
            };
        },
    });
    await f.api.list();
    assert.equal(await f.api.preparePlayback(base + "/mp4"), base + "/mp4");
    assert.equal(
        typeof ready,
        "function",
        "direct playback warms the passive observer without waiting"
    );
    const pending = f.api.preparePlayback(sourceUrl);
    const rejected = assert.rejects(pending, /cancelled/);
    pending.cancel();
    await rejected;
    ready();
    await flush();
    assert(!f.calls.some((c) => c[1]?.method === "POST"));
});

test("optional compatibility load failure permits a fresh retry", async () => {
    let attempts = 0;
    const f = fixture({
        loadFeature(host, kind, done, load) {
            if (++attempts === 1) done("unsupported");
            else {
                load(kind);
                done();
            }
        },
    });
    await f.api.list();
    await assert.rejects(
        f.api.preparePlayback(sourceUrl),
        /could not be loaded/
    );
    const url = await f.api.preparePlayback(sourceUrl);
    assert(f.api.isPlaybackUrl(url));
    assert.equal(attempts, 2);
});

test("standby fences an optional module completing after cancellation", async () => {
    let ready;
    const f = fixture({
        loadFeature(host, kind, done, load) {
            ready = () => {
                load(kind);
                done();
            };
        },
    });
    await f.api.list();
    const pending = f.api.preparePlayback(sourceUrl),
        rejected = assert.rejects(pending, /cancelled/);
    f.block();
    f.api.suspend();
    await rejected;
    ready();
    await flush();
    assert(!f.calls.some((c) => c[1]?.method === "POST"));
});

test("cold data imports retain their synchronous picker before optional UI is loaded", async () => {
    let loads = 0;
    const f = fixture({
        capacitor: true,
        endpoint: "",
        loadFeature() {
            loads++;
        },
    });
    const pending = f.api.importFiles();
    assert(f.calls.some((c) => c[0] === "native-import"));
    assert.equal(loads, 0);
    await pending;
});

test("a replaced screen cannot reopen after its optional UI download", async () => {
    let ready;
    const f = fixture({
        loadFeature(host, kind, done, load) {
            ready = () => {
                load(kind);
                done();
            };
        },
    });
    const pending = f.api.open(false, true);
    f.w.listKeyHandler = () => false;
    ready();
    await pending;
    assert.equal(f.w.listArray, undefined);
    assert(!f.calls.some((c) => c[0] === "native-import"));
});

test("internal endpoint/lease/finite failures keep the exact public error and safe cancellation", async () => {
    const message = "Local compatibility playback could not be prepared";
    for (const kind of ["endpoint", "lease", "finite"]) {
        const f = fixture({
            prepare: async (url, init, descriptor) => ({
                json: async () =>
                    descriptor(
                        kind === "lease"
                            ? { lease: "INVALID" }
                            : kind === "finite"
                              ? { finite: false }
                              : {}
                    ),
                ok: true,
            }),
        });
        if (kind === "endpoint")
            f.catalog.items[1].playback.prepareUrl =
                "https://other.test/prepare";
        await f.api.list();
        await assert.rejects(f.api.preparePlayback(sourceUrl), { message });
        await flush();
        const cancels = f.calls.filter((c) => c[0].endsWith?.("/cancel"));
        // A rejected endpoint/lease is never trusted enough to form a cancel.
        // A validated lease rejected for its finite descriptor is retired.
        assert.equal(cancels.length, kind === "finite" ? 1 : 0, kind);
    }
});

test("lease capacity failure retires only the new lease and retains the same public error", async () => {
    const f = fixture();
    await f.api.list();
    const active = [];
    for (let n = 0; n < 32; n++)
        active.push(await f.api.preparePlayback(sourceUrl));
    await assert.rejects(f.api.preparePlayback(sourceUrl), {
        message: "Local compatibility playback could not be prepared",
    });
    await flush();
    const cancels = f.calls.filter((c) => c[0].endsWith?.("/cancel"));
    assert.equal(cancels.length, 1);
    const retired = cancels[0][1].headers["X-OTT-Playback-Lease"];
    assert(active.every((url) => !url.includes("/" + retired + "/")));
    assert(active.every((url) => f.api.isPlaybackUrl(url)));
});
