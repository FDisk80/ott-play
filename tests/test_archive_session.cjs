const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const sharedCore = require("./helpers/shared-core-runtime.cjs");
const { localizationRuntime } = require("./helpers/localization-runtime.cjs");
const localizationCode = localizationRuntime();
const root = path.resolve(__dirname, "..");
function include(c, names, file = "src/channels/index.ts") {
    names = require("./helpers/english-source-fixture.cjs").sourceNames(
        file,
        names
    );
    const ast = ts.createSourceFile(
        file,
        fs.readFileSync(path.join(root, file), "utf8"),
        ts.ScriptTarget.Latest,
        true
    );
    const selected = ast.statements.filter(
        (n) => ts.isFunctionDeclaration(n) && names.includes(n.name?.text)
    );
    assert.equal(selected.length, names.length);
    vm.runInContext(
        ts
            .transpileModule(selected.map((n) => n.getText(ast)).join("\n"), {
                compilerOptions: {
                    module: ts.ModuleKind.ES2015,
                    target: ts.ScriptTarget.ES5,
                },
            })
            .outputText.replace(/^export /gm, ""),
        c
    );
}
function fixture() {
    const effects = [],
        requests = [],
        prompts = [],
        elements = {},
        storage = {};
    const c = {
        _: (s) => s,
        $: () => ({ is: () => false }),
        catIndex: 0,
        cats: { All: [101, 202] },
        catsArray: ["All"],
        channels: {
            101: { channel_name: "First", rec: 24 },
            202: { channel_name: "Second", rec: 24 },
        },
        clearTimeout() {},
        console,
        curList: [101, 202],
        curProg: -1,
        Date: class extends Date {
            static now() {
                return 1000000000;
            }
        },
        document: {
            getElementById(id) {
                return (elements[id] ||= {
                    innerHTML: "",
                    style: {},
                    textContent: "",
                });
            },
        },
        epgArray: [
            { name: "One", time: 999000, time_to: 999100 },
            { name: "Two", time: 999100, time_to: 999200 },
        ],
        fileArchive: false,
        getArchiveUrl(id, start, end, programme) {
            effects.push(["resolve", id, start, end, programme]);
            return "archive:" + id + ":" + start;
        },
        getChannelEpgCached(id, done) {
            requests.push({ done, id });
        },
        getThumbnail: () => "",
        ifParentalAccessChId(_id, done) {
            if (!c.locked) return false;
            prompts.push(done);
            return true;
        },
        locked: false,
        medHistory: [],
        metadataCssUrl: (s) => s,
        metadataHtml: (s) => s || "",
        p_pref: "source-a",
        playTime: 0,
        playType: 0,
        prevArr: [],
        primaryIndex: 0,
        providerGetItem: (k) => storage[k],
        providerSetItem(k, v) {
            storage[k] = v;
        },
        setCurProg(id, rows) {
            effects.push(["guide", id, rows]);
        },
        setTimeout() {},
        settings: { prevCount: 2 },
        sFavorites: 0,
        showChannelInfo(n) {
            effects.push(["info", n]);
        },
        showShift(s) {
            effects.push(["message", s]);
        },
        stbGetLen: () => 600,
        stbGetPosTime: () => 0,
        stbIsPlaying: () => true,
        stbPause() {
            effects.push(["pause"]);
        },
        stbPlay(url, position) {
            effects.push(["open", url, position]);
            c.__ottClassicPlayback.command({ type: "playing" });
        },
        stbSetPosTime(position) {
            effects.push(["seek", position]);
            c.__ottClassicPlayback.command({ type: "playing" });
        },
        stbStop() {
            effects.push(["stop"]);
            c.__ottClassicPlayback.cancel();
            c.__ottClassicPlayback.command({ type: "stop" });
        },
        time2time: String,
    };
    c.window = c;
    vm.createContext(c);
    require("./helpers/english-source-fixture.cjs").attachSourceAliases(c);
    sharedCore(c);
    vm.runInContext(localizationCode, c);
    include(c, ["metadataText"], "src/utils/helpers.ts");
    c.__ottClassicPlayback.importLegacy(); // Explicit startup ingress for this retained-device fixture.
    include(c, [
        "playArchive",
        "timeShift",
        "liveStop",
        "updateArchiveInfo",
        "renderArchiveInfo",
        "setCurrent",
    ]);
    c.__ottRenderArchive = c.renderArchiveInfo;
    c.effects = effects;
    c.requests = requests;
    c.prompts = prompts;
    c.elements = elements;
    c.reply = (index, rows) => requests[index].done(requests[index].id, rows);
    c.opens = () => effects.filter((e) => e[0] === "open");
    return c;
}

// Remote archive selection must open the selected programme with the real
// playback coordinator, including when a different live channel is active.
for (const channelId of [101, 202]) {
    const c = fixture();
    c.getChannelPicon = (id) => "logo:" + id;
    include(c, ["handleRemoteArchive"], "src/commands/remote-archive.ts");
    c.sStopPlay = 1;
    c.__ottClassicPlayback.command({ type: "playing" });
    c.parentalArray = [];
    let resolutions = 0;
    c.getArchiveUrl = (id, start, end) => {
        resolutions++;
        return resolutions === 1
            ? `https://archive.example/${id}?start=${start}&end=${end}`
            : "https://live.example/changed-provider-result";
    };
    let reply;
    c.handleRemoteArchive(
        c,
        {
            action: "play_archive_catalog",
            params: { end: 999100, start: 999000, title: "Selected programme" },
        },
        { id: String(channelId) },
        () => true,
        (data) => {
            reply = data;
        },
        (message) => assert.fail(message)
    );
    assert.equal(reply?.dispatched, true);
    assert.equal(reply.mode, "archive");
    assert.equal(resolutions, 1, "dispatch uses the URL that was validated");
    assert.deepEqual(c.opens(), [
        [
            "open",
            `https://archive.example/${channelId}?start=999000&end=999100`,
            0,
        ],
    ]);
    const state = c.__ottClassicPlayback.snapshot();
    assert.equal(state.target.kind, "archive");
    assert.equal(state.target.channelId, String(channelId));
    assert.equal(
        c.elements.channel_name.textContent,
        c.channels[channelId].channel_name
    );
    assert.equal(
        c.elements.picon.style.backgroundImage,
        `url("logo:${channelId}")`
    );
    assert.equal(state.target.archiveStart, 999000);
}

// A refusal must not be reported as a dispatch or revive later after a PIN
// callback. Keep the prior live decoder untouched in both cases.
for (const refusal of [
    "kiosk",
    "authorization",
    "source-change",
    "mode-veto",
]) {
    const c = fixture();
    include(c, ["handleRemoteArchive"], "src/commands/remote-archive.ts");
    c.sStopPlay = 1;
    c.__ottClassicPlayback.command({ type: "playing" });
    c.parentalArray = [];
    c.getArchiveUrl = () => "https://archive.example/selected";
    let checks = 0;
    let allowed;
    c.ifParentalAccessChId = (_id, callback) => {
        checks++;
        if (checks > 1 && refusal === "authorization") {
            allowed = callback;
            return true;
        }
        if (checks > 1 && refusal === "source-change") c.p_pref = "source-b";
        return false;
    };
    if (refusal === "kiosk") c.__ottKiosk = { enabled: () => true };
    if (refusal === "mode-veto") {
        const command = c.__ottClassicPlayback.command;
        c.__ottClassicPlayback.command = (request) =>
            request.type === "archive" ? false : command(request);
    }
    let rejected;
    c.handleRemoteArchive(
        c,
        {
            action: "play_archive_catalog",
            params: { end: 999100, start: 999000, title: "Selected programme" },
        },
        { id: "202" },
        () => true,
        () => assert.fail("An unopened archive must not be acknowledged"),
        (message) => {
            rejected = message;
        }
    );
    assert.equal(rejected, "Archive dispatch cancelled.");
    if (allowed) allowed();
    assert.deepEqual(c.opens(), []);
    assert.equal(c.effects.filter((effect) => effect[0] === "stop").length, 0);
    assert.equal(c.__ottClassicPlayback.snapshot().target.kind, "live");
    assert.equal(c.__ottClassicPlayback.snapshot().phase, "playing");
}

// A live now/next subscription survives entering archive. Archive ticks and
// late guide replies must not repaint its footer with the wall-clock programme.
{
    const c = fixture();
    const callbacks = new Map();
    let nextTimer = 0;
    c.setTimeout = (fn, delay) => {
        const id = ++nextTimer;
        if (!delay) callbacks.set(id, fn);
        return id;
    };
    c.clearTimeout = (id) => callbacks.delete(id);
    const flush = () => {
        for (let turns = 0; callbacks.size; turns++) {
            assert(turns < 20, "Guide repaint callbacks converge");
            const pending = [...callbacks.values()];
            callbacks.clear();
            pending.forEach((fn) => fn());
        }
    };
    require("./helpers/guide-runtime-fixture.cjs").install(c);
    c.epgCacheCapacity = 10;
    c.$infoBar = { is: () => false };
    c.formatProgramDateTime = String;
    vm.runInContext(
        require("./test_port_vod.cjs").sourceFunctions("src/ui/index.ts", [
            "updateChannelInfo",
        ]) +
            require("./test_port_vod.cjs").sourceFunctions(
                "src/utils/helpers.ts",
                ["virtualTimeshiftProg"]
            ),
        c
    );
    c.epgArray = [
        { name: "Archive", time: 999000, time_to: 999200 },
        { name: "Archive next", time: 999200, time_to: 999400 },
        { name: "Live", time: 999940, time_to: 1000040 },
    ];
    c.__ottClassicGuide.seed(101, c.epgArray);
    c.updateChannelInfo(101);
    assert.equal(c.elements.programm_name.textContent, "Live");
    assert.equal(c.elements.progress.style.width, "60%");
    let publications = 0;
    const publish = c.__ottClassicGuide.publish;
    c.__ottClassicGuide.publish = (...args) => {
        publications++;
        return publish(...args);
    };
    c.sInfoChange = true;
    c.playArchive(999060);
    flush();
    assert.equal(c.elements.programm_name.textContent, "Archive");
    assert.equal(c.elements.progress.style.width, "30%");
    assert.equal(c._prog100.name, "Archive");
    assert.equal(c._prog100.time, 999000);
    const opened = c.effects.filter((e) => e[0] === "info").length;
    for (const position of [999061, 999062, 999063]) {
        c.updateArchiveInfo(position);
        flush();
        assert.equal(c.elements.programm_name.textContent, "Archive");
        assert.equal(
            c.elements.progress.style.width,
            (position - 999000) / 2 + "%"
        );
    }
    assert.equal(
        publications,
        1,
        "Position ticks do not republish the same schedule"
    );
    assert.equal(c.effects.filter((e) => e[0] === "info").length, opened);
    // A real schedule refresh can still notify the retained live subscriber.
    c.__ottClassicGuide.publish(101, c.epgArray);
    flush();
    assert.equal(c.elements.programm_name.textContent, "Archive");
    assert.equal(c.elements.progress.style.width, "31.5%");
    assert.equal(c._prog100.time, 999000);
    c.updateArchiveInfo(999220);
    flush();
    assert.equal(c.elements.programm_name.textContent, "Archive next");
    assert.equal(c.elements.progress.style.width, "10%");
    assert.equal(c.effects.filter((e) => e[0] === "info").length, opened + 1);
    c.updateArchiveInfo(999222);
    flush();
    assert.equal(c.effects.filter((e) => e[0] === "info").length, opened + 1);
    c.__ottClassicPlayback.command({ channelId: 101, type: "live" });
    c.updateChannelInfo(101);
    assert.equal(c.elements.programm_name.textContent, "Live");
    assert.equal(c.elements.progress.style.width, "60%");
    const liveOpened = c.effects.filter((e) => e[0] === "info").length;
    c.updateChannelInfo(101);
    c.updateChannelInfo(101);
    c.__ottClassicGuide.publish(101, c.epgArray);
    flush();
    assert.equal(
        c.effects.filter((e) => e[0] === "info").length,
        liveOpened,
        "Periodic live repaints and identical guide replies do not reopen the bar"
    );
    c.__ottClassicGuide.publish(101, [
        { name: "Corrected live title", time: 999940, time_to: 1000100 },
    ]);
    flush();
    assert.equal(c.elements.programm_name.textContent, "Corrected live title");
    assert.equal(c.effects.filter((e) => e[0] === "info").length, liveOpened);
    c.__ottClassicGuide.publish(101, []);
    flush();
    c.__ottClassicGuide.publish(101, [
        { name: "Corrected live title", time: 999940, time_to: 1000100 },
    ]);
    flush();
    assert.equal(c.effects.filter((e) => e[0] === "info").length, liveOpened);
    c.__ottClassicGuide.publish(101, [
        { name: "New live programme", time: 999980, time_to: 1000200 },
    ]);
    flush();
    assert.equal(c.elements.programm_name.textContent, "New live programme");
    assert.equal(
        c.effects.filter((e) => e[0] === "info").length,
        liveOpened + 1
    );
    c.updateChannelInfo(101);
    assert.equal(
        c.effects.filter((e) => e[0] === "info").length,
        liveOpened + 1
    );
}

// Position ticks reuse the full schedule projection while still updating the footer.
{
    const c = fixture();
    let mappings = 0,
        mappedRows = 0;
    const create = c.__ottArchiveSession.create;
    c.__ottArchiveSession.create = (core, ports) => {
        const publish = ports.publish;
        ports.publish = (model) => {
            const map = model.rows.map;
            model.rows.map = function (callback) {
                mappings++;
                mappedRows += this.length;
                return map.call(this, callback);
            };
            try {
                return publish(model);
            } finally {
                delete model.rows.map;
            }
        };
        return create(core, ports);
    };
    c.epgArray = Array.from({ length: 1000 }, (_, index) => ({
        name: "Programme " + index,
        time: 900000 + index * 100,
        time_to: 900100 + index * 100,
    }));
    c.playArchive(999060);
    const schedule = c.epgArray;
    assert.equal(mappings, 1, "One full conversion when adopting a schedule");
    assert.equal(mappedRows, 1000);
    assert.equal(c.elements.programm_name.textContent, "Programme 990");
    assert.equal(c.elements.progress.style.width, "60%");
    mappings = mappedRows = 0;
    for (const position of [999061, 999062, 999063]) {
        c.updateArchiveInfo(position);
        assert.equal(c.epgArray, schedule);
        assert.equal(c.curProg, 990);
        assert.equal(c.elements.programm_name.textContent, "Programme 990");
        assert.equal(c.elements.progress.style.width, position - 999000 + "%");
    }
    assert.equal(mappings, 0, "Position ticks allocate no schedule arrays");
    assert.equal(
        mappedRows,
        0,
        "Position ticks traverse no schedule for encoding"
    );
    c.updateArchiveInfo(999120);
    assert.equal(
        c.epgArray,
        schedule,
        "A programme boundary keeps the schedule"
    );
    assert.equal(c.curProg, 991);
    assert.equal(c.elements.programm_name.textContent, "Programme 991");
    assert.equal(c.elements.progress.style.width, "20%");
    c.epgArray = [{ name: "Foreign view", time: 999100, time_to: 999200 }];
    c.updateArchiveInfo(999121);
    assert.equal(c.epgArray, schedule, "A tick restores its owned projection");
    assert.equal(mappings, 0);

    // Explicit selections may replace the schedule, and late refills may correct it.
    c.epgArray = [{ name: "Corrected", time: 999100, time_to: 999300 }];
    c.playArchive(999150);
    const corrected = c.epgArray;
    assert.notEqual(corrected, schedule);
    assert.equal(mappings, 1);
    assert.equal(mappedRows, 1);
    assert.equal(c.curProg, 0);
    assert.equal(c.elements.programm_name.textContent, "Corrected");
    assert.equal(c.elements.progress.style.width, "25%");
    c.updateArchiveInfo(999151);
    assert.equal(c.epgArray, corrected);
    assert.equal(c.requests.length, 1);
    c.__ottClassicPlayback.command({ position: 1, type: "position" });
    c.reply(0, [
        { name: "Refilled", time: 999100, time_to: 999400 },
        { name: "Refilled next", time: 999400, time_to: 1000000 },
    ]);
    const refilled = c.epgArray;
    assert.notEqual(refilled, corrected);
    assert.equal(mappings, 2, "A changed schedule is encoded once");
    assert.equal(mappedRows, 3);
    assert.equal(c.elements.programm_name.textContent, "Refilled");
    assert.equal(c.elements.nprogramm_name.textContent, "Refilled next");
    assert.equal(c.elements.progress.style.width, "17%");
    c.updateArchiveInfo(999152);
    assert.equal(c.epgArray, refilled);
    assert.equal(mappings, 2);
    assert.equal(
        c.opens().length,
        2,
        "Refilling the guide does not reopen media"
    );
}

// Real entrypoints use resource bounds, never the renderer's mutable programme index.
{
    const c = fixture();
    c.fileArchive = true;
    c.playArchive(999050);
    assert.deepEqual(c.opens(), [["open", "archive:101:999050", 50]]);
    assert.equal(c.elements.programm_name.textContent, "One");
    c.curProg = 999;
    c.playArchive(999060);
    assert.equal(c.opens().length, 1);
    assert.deepEqual(
        c.effects.filter((e) => e[0] === "seek"),
        [["seek", 60]]
    );
    c.curProg = 0;
    c.playArchive(999120);
    assert.equal(
        c.opens().length,
        2,
        "Different programme reopens even if classic index was reused"
    );
    assert.equal(c.opens()[1][2], 20);
    c.primaryIndex = 1;
    c.curList = c.cats.All;
    c.playArchive(999130);
    assert.equal(
        c.opens().length,
        3,
        "Different channel cannot reuse the previous resource"
    );
    c.p_pref = "source-b";
    c.playArchive(999140);
    assert.equal(
        c.opens().length,
        4,
        "Same IDs in another source cannot reuse the resource"
    );
}

// Archive history labels follow the selected programme, not the outgoing live projection.
{
    const c = fixture();
    c._prog100 = { name: "Outgoing live" };
    c.epgArray = [
        { name: "Older", time: 999000, time_to: 999100 },
        { name: "Current", time: 999100, time_to: 1001000 },
    ];
    c.playArchive(999150);
    assert.equal(c.__ottClassicPlayback.snapshot().target.payload.e, "Current");
    c.playArchive(999050);
    assert.equal(c.__ottClassicPlayback.snapshot().target.payload.e, "Older");
    c.setCurrent(0, 1);
    assert.equal(c.prevArr[0].e, "Older");
}

// Stream-style catchup reopens; unknown guide windows stay positive and synthetic files never alias index -1.
{
    const c = fixture();
    c.epgArray = [];
    c.fileArchive = true;
    c.playArchive(999050);
    c.playArchive(999060);
    assert.equal(c.opens().length, 2);
    assert(
        c.effects.filter((e) => e[0] === "resolve").every((e) => e[3] > e[2])
    );
    assert.equal(c.elements.progress.style.width, "80%");
    const before = c.opens().length;
    c.playArchive(0);
    c.playArchive(NaN);
    c.playArchive(Infinity);
    assert.equal(c.opens().length, before);
}
{
    const c = fixture();
    c.playArchive(999050);
    c.playArchive(999060);
    assert.equal(c.opens().length, 2);
    assert(c.opens().every((e) => e[2] === 0));
}

// Live rewind, programme start and live pause share a scoped guide request.
{
    const c = fixture();
    include(c, ["formatSeekOffset"], "src/ui/index.ts");
    for (const [input, expected] of [
        [-60.0009999275207519531, "<< 1 m "],
        [60.0009999275207519531, ">> 1 m "],
        [-61.001, "<< 1 m 1 s"],
        [59.999, ">> 1 m "],
        [-0.5, "<< 1 s"],
        [0, "&nbsp;"],
    ])
        assert.equal(c.formatSeekOffset(input), expected);
}
for (const announce of [false, true]) {
    const c = fixture();
    include(c, ["formatSeekOffset"], "src/ui/index.ts");
    const offset = 60.0009999275207519531;
    c.replayFromLiveOffset(offset, announce);
    c.locked = true;
    c.reply(0, [{ name: "Current", time: 999000, time_to: 1001000 }]);
    assert.equal(c.opens().length, 0);
    c.locked = false;
    c.prompts[0]();
    assert.equal(c.opens().length, 1);
    assert.equal(
        c.__ottClassicPlayback.snapshot().target.archiveStart,
        Math.floor(1000000 - offset),
        "presentation rounding does not alter the target epoch"
    );
    assert.deepEqual(
        c.effects.filter((e) => e[0] === "message"),
        announce ? [["message", "<< 1 m "]] : [],
        "the request owns its feedback choice across guide and PIN callbacks"
    );
}
for (const announce of [false, true]) {
    const c = fixture();
    c.replayFromLiveOffset(60, !announce);
    c.replayFromLiveOffset(30, announce);
    c.reply(0, [{ name: "Current", time: 999000, time_to: 1001000 }]);
    assert.equal(
        c.opens().length,
        0,
        "superseded guide cannot announce or open"
    );
    c.reply(1, [{ name: "Current", time: 999000, time_to: 1001000 }]);
    assert.equal(c.opens().length, 1);
    assert.deepEqual(
        c.effects.filter((e) => e[0] === "message"),
        announce ? [["message", "-30"]] : [],
        "a suppressed request does not change the next request's feedback"
    );
}
{
    const c = fixture();
    c.timeShift(30);
    assert.equal(c.opens().length, 0);
    c.reply(0, [{ name: "Current", time: 999000, time_to: 1001000 }]);
    c.reply(0, []);
    assert.deepEqual(c.opens(), [["open", "archive:101:999970", 0]]);
    assert.equal(c.__ottClassicPlayback.snapshot().target.archiveStart, 999970);
    assert.equal(c.prevArr[0].ci, 101);
}
{
    const c = fixture();
    c.timeShift(0);
    c.reply(0, []);
    assert.equal(
        c.opens().length,
        0,
        "Begin without a current programme is a safe no-op"
    );
    c.timeShift(0);
    c.reply(1, [{ name: "Current", time: 999100, time_to: 1000100 }]);
    assert.equal(c.opens()[0][1], "archive:101:999100");
}
{
    const c = fixture();
    c.liveStop();
    c.reply(0, []);
    assert.equal(c.__ottClassicPlayback.snapshot().phase, "paused");
    assert.equal(
        c.__ottClassicPlayback.snapshot().target.archiveStart,
        1000000
    );
    assert.equal(c.effects.filter((e) => e[0] === "pause").length, 1);
    assert.equal(c.opens().length, 0);
}
for (const change of [
    (c) => c.__ottClassicPlayback.cancel(),
    (c) => c.__ottClassicPlayback.command({ type: "stop" }),
    (c) => {
        c.p_pref = "replacement";
    },
    (c) => {
        c.primaryIndex = 1;
    },
    (c) => {
        c.channels = { ...c.channels };
    },
    (c) => {
        c.cats.All = [101, 202];
    },
]) {
    for (const action of ["timeShift", "liveStop"]) {
        const c = fixture();
        c[action](30);
        change(c);
        c.reply(0, c.epgArray);
        assert.equal(c.opens().length, 0);
        assert.equal(
            c.effects.filter((e) => e[0] === "pause" || e[0] === "guide")
                .length,
            0
        );
    }
}

// PIN completion and a permission expiring while the guide loads cannot admit abandoned work.
{
    const c = fixture();
    c.locked = true;
    c.timeShift(30);
    assert.equal(c.requests.length, 0);
    c.__ottClassicPlayback.cancel();
    c.locked = false;
    c.prompts[0]();
    assert.equal(c.requests.length, 0);
}
{
    const c = fixture();
    c.timeShift(30);
    c.locked = true;
    c.reply(0, c.epgArray);
    assert.equal(c.opens().length, 0);
    assert.equal(c.prompts.length, 1);
    c.primaryIndex = 1;
    c.locked = false;
    c.prompts[0]();
    assert.equal(c.opens().length, 0);
}

// Refill belongs to the displayed session; no renderer fetches or old callbacks can publish.
for (const change of [
    (c) => c.__ottClassicPlayback.cancel(),
    (c) => c.__ottClassicPlayback.command({ channelId: 101, type: "live" }),
    (c) => {
        c.p_pref = "replacement";
    },
]) {
    const c = fixture();
    c.playArchive(999050);
    c.updateArchiveInfo(999120);
    assert.equal(c.requests.length, 1);
    change(c);
    const before = c.effects.filter((e) => e[0] === "guide").length;
    c.reply(0, [{ name: "Stale", time: 999100, time_to: 1000200 }]);
    assert.equal(c.effects.filter((e) => e[0] === "guide").length, before);
    assert.notEqual(c.elements.programm_name.textContent, "Stale");
}
{
    const c = fixture();
    c.playArchive(999050);
    c.updateArchiveInfo(999120);
    c.__ottClassicPlayback.command({ position: 70, type: "position" });
    c.reply(0, [
        { name: "Fresh", time: 999100, time_to: 1000200 },
        { name: "Next", time: 1000200, time_to: 1001000 },
    ]);
    assert.equal(c.elements.programm_name.textContent, "Fresh");
    assert.equal(
        c.elements.nprogramm_name.textContent,
        "Next",
        "Final next entry is no longer hidden by a length-1 condition"
    );
    assert.equal(c.opens().length, 1, "Guide refresh never reloads a stream");
}
{
    const c = fixture();
    c.sStopPlay = 1;
    c.playArchive(999050);
    assert.equal(
        c.opens().length,
        1,
        "Coordinator-owned backend replacement is not external cancellation"
    );
    assert.equal(c.__ottClassicPlayback.snapshot().target.kind, "archive");
    assert.equal(c.__ottClassicPlayback.snapshot().phase, "playing");
}
// A synchronous stop callback may replace the source or selection. Never open
// the previously admitted archive over that newer choice.
for (const [change, phase] of [
    [
        (c) => {
            c.p_pref = "source-b";
        },
        "stopped",
    ],
    [
        (c) => {
            c.primaryIndex = 1;
        },
        "stopped",
    ],
    [
        (c) => c.__ottClassicPlayback.command({ channelId: 101, type: "live" }),
        "loading",
    ],
    [
        (c) =>
            c.__ottClassicPlayback.command({
                archiveStart: 998050,
                channelId: 101,
                type: "archive",
            }),
        "loading",
    ],
]) {
    const c = fixture();
    c.sStopPlay = 1;
    const stop = c.stbStop;
    const play = c.stbPlay;
    let decoder = { url: "previous-live" };
    let replacementState;
    c.stbPlay = (url, position) => {
        decoder = { position, url };
        play(url, position);
    };
    c.stbStop = () => {
        decoder = null;
        stop();
        change(c);
        replacementState = JSON.stringify(c.__ottClassicPlayback.snapshot());
    };
    assert.equal(
        c.__ottClassicArchive.open(999050, "https://archive.example/selected"),
        false
    );
    assert.deepEqual(c.opens(), []);
    assert.equal(
        decoder,
        null,
        "retired archive cannot start an unadmitted source"
    );
    assert.equal(c.__ottClassicPlayback.snapshot().phase, phase);
    assert.equal(
        JSON.stringify(c.__ottClassicPlayback.snapshot()),
        replacementState,
        "pending replacement retains its own state and startup authority"
    );
}
for (const type of ["live", "archive"]) {
    const c = fixture();
    c.sStopPlay = 1;
    const stop = c.stbStop;
    const play = c.stbPlay;
    let decoder = { url: "previous-live" };
    let replacementState;
    const url = "https://replacement.example/" + type;
    c.stbPlay = (url, position) => {
        decoder = { position, url };
        play(url, position);
    };
    c.stbStop = () => {
        decoder = null;
        stop();
        c.__ottClassicPlayback.command({
            archiveStart: 998050,
            channelId: 101,
            type,
        });
        c.stbPlay(url, 37);
        replacementState = JSON.stringify(c.__ottClassicPlayback.snapshot());
    };
    assert.equal(
        c.__ottClassicArchive.open(999050, "https://archive.example/retired"),
        false
    );
    assert.deepEqual(decoder, { position: 37, url });
    assert.deepEqual(
        c.opens(),
        [["open", url, 37]],
        "replacement is neither restarted nor overwritten"
    );
    assert.equal(c.__ottClassicPlayback.snapshot().phase, "playing");
    assert.equal(
        JSON.stringify(c.__ottClassicPlayback.snapshot()),
        replacementState
    );
}
// First display of a missing/terminal programme refreshes independently of renderer changes.
for (const empty of [false, true]) {
    const c = fixture();
    if (empty) c.epgArray = [];
    c.playArchive(999120);
    assert.equal(
        c.requests.length,
        0,
        "Opening is not blocked by an optional guide refresh"
    );
    c.updateArchiveInfo(999120);
    c.updateArchiveInfo(999121);
    assert.equal(
        c.requests.length,
        1,
        "One missing-window request is enough while pending"
    );
    c.reply(0, []);
    c.updateArchiveInfo(999122);
    assert.equal(c.requests.length, 1);
    c.Date = class extends Date {
        static now() {
            return 1000060000;
        }
    };
    c.updateArchiveInfo(999180);
    assert.equal(
        c.requests.length,
        2,
        "Empty schedules can recover after the bounded retry delay"
    );
}

// Explicit programme selection imports a new schedule revision without relying on its old index.
{
    const c = fixture();
    c.fileArchive = true;
    c.playArchive(999050);
    c.epgArray = [
        {
            id: "different-resource",
            name: "Updated",
            time: 999100,
            time_to: 999900,
        },
    ];
    c.curProg = 0;
    c.playArchive(999120);
    assert.equal(c.opens().length, 2);
    assert.equal(c.effects.filter((e) => e[0] === "resolve").at(-1)[3], 999900);
    assert.equal(c.elements.programm_name.textContent, "Updated");
}
// Retention and permission are checked against the final clock/capabilities, not request time.
for (const change of [
    (c) => {
        c.Date = class extends Date {
            static now() {
                return 1000002000;
            }
        };
    },
    (c) => {
        c.channels[101].rec = 0;
    },
]) {
    const c = fixture();
    c.locked = true;
    c.playArchive(913601);
    change(c);
    c.locked = false;
    c.prompts[0]();
    assert.equal(c.opens().length, 0);
    assert.equal(c.effects.filter((e) => e[0] === "resolve").length, 0);
}
// The independent controller admits one owned resolver completion and needs no classic globals.
{
    const c = fixture(),
        events = [];
    const context = {
        channelId: "x",
        file: false,
        isCurrent: () => true,
        retention: 1000,
        schedule: [],
        sourceId: "s",
    };
    let reply;
    const controller = c.__ottArchiveSession.create(c.OttPlayCore, {
        authorize: () => false,
        capture: () => context,
        epoch: () => 100,
        guide: (_c, done) => done([]),
        now: () => 200,
        open: (_c, _v, url) => {
            events.push(url);
            return context;
        },
        pause: () => context,
        publish: () => {},
        resolve: (_c, _v, done) => {
            reply = done;
        },
        seek: () => context,
    });
    controller.open(100);
    const old = reply;
    controller.cancel();
    old("abandoned");
    assert.deepEqual(events, []);
    controller.open(101);
    reply("current");
    reply("duplicate");
    assert.deepEqual(events, ["current"]);
    const pure = fs.readFileSync(
        path.join(root, "src/playback/archive.ts"),
        "utf8"
    );
    assert(
        !/\b(document|curProg|epgArray|playType|playTime|stbPlay|setCurrent)\b/.test(
            pure
        )
    );
}
// A corrected programme can retain its ID but map to a different file origin.
{
    const c = fixture(),
        effects = [];
    const context = {
        channelId: "x",
        file: true,
        isCurrent: () => true,
        retention: 1000,
        schedule: [{ end: 150, key: "same-id", payload: {}, start: 90 }],
        sourceId: "s",
    };
    const controller = c.__ottArchiveSession.create(c.OttPlayCore, {
        authorize: () => false,
        capture: () => context,
        epoch: () => 100,
        guide: (_c, done) => done([]),
        now: () => 200,
        open: (_c, model) => {
            effects.push(["open", model.window.start]);
            return context;
        },
        pause: () => context,
        publish: () => {},
        resolve: (_c, _v, done) => done("file"),
        seek: (_c, _v, offset) => {
            effects.push(["seek", offset]);
            return context;
        },
    });
    controller.open(100);
    context.schedule = [{ end: 155, key: "same-id", payload: {}, start: 95 }];
    controller.open(110);
    assert.deepEqual(effects, [
        ["open", 90],
        ["open", 95],
    ]);
}
console.log(
    "PASS archive coordinator: real entrypoints, file identity, scoped guide/PIN/refill, synthetic windows and independent rendering"
);

// Remote archive offsets use broadcast time, never decoder seconds.
for (const file of [false, true]) {
    for (const paused of [false, true]) {
        for (const [offset, from, destination, clamped] of [
            [60, 999020.75, 999080, false],
            [-10, 999020.75, 999010, false],
            [180, 999020.75, 999200, false], // crosses programme into a guide gap
            [0.5, 999020.75, 999021, false],
            [-0.5, 999020.75, 999020, false],
            [-9007199254740991, 999020.75, 913600, true],
            [9007199254740991, 999020.75, 999999, true],
        ]) {
            const c = fixture();
            c.fileArchive = file;
            c.parentalArray = [];
            assert.equal(c.__ottClassicArchive.open(999020), true);
            c.__ottClassicPlayback.command({
                position: from - 999020,
                type: "position",
            });
            if (paused) c.__ottClassicPlayback.command({ type: "pause" });
            const requests = [];
            c.__ottCoreBackendPeek = () => ({
                open(request) {
                    requests.push(request);
                    c.__ottClassicPlayback.command({
                        type: request.paused ? "pause" : "playing",
                    });
                    return { active: () => true };
                },
            });
            assert.equal(c.__ottClassicArchive.canSeekRelative(), true);
            const captured = c.__ottClassicPlayback.context();
            const result = c.__ottClassicArchive.seekRelative(
                offset,
                captured.isCurrent,
                paused
            );
            assert.deepEqual(JSON.parse(JSON.stringify(result)), {
                clamped,
                earliest: 913600,
                from,
                latest: 999999,
                position: destination,
                timeline: "archive",
            });
            assert.equal(requests.length, 1);
            assert.equal(
                requests[0].paused,
                paused,
                "pause is bound to the new lease before startup"
            );
            const state = c.__ottClassicPlayback.snapshot();
            assert.equal(state.target.kind, "archive");
            assert.equal(state.target.archiveStart, destination);
            assert.equal(state.phase, paused ? "paused" : "playing");
            assert.equal(
                requests[0].position,
                file
                    ? destination -
                          (destination < 999100 && destination >= 999000
                              ? 999000
                              : destination < 999200 && destination >= 999100
                                ? 999100
                                : destination - 3600)
                    : 0
            );
        }
    }
}

// A rejected synchronous offset cannot revive from async provider/PIN callbacks.
for (const deferred of [
    "resolve",
    "authorize",
    "expired",
    "changed",
    "retention",
]) {
    const c = fixture();
    let now = 1000000.25,
        epoch = 999020.75,
        current = true,
        callback,
        permitted = true;
    const effects = [];
    const capture = () => ({
        channelId: "1",
        file: false,
        isCurrent: () => current,
        retention: 86400,
        schedule: [],
        sourceId: "a",
    });
    const ports = {
        authorize(_context, done) {
            if (deferred === "authorize") {
                callback = done;
                return true;
            }
            return false;
        },
        capture,
        epoch: () => epoch,
        guide() {},
        now: () => now,
        open(_context, model) {
            effects.push(model.position);
            epoch = model.position;
            return capture();
        },
        pause() {},
        publish() {},
        resolve(_context, _model, done) {
            if (deferred === "resolve") {
                callback = () => done("archive");
                return;
            }
            if (deferred === "expired") permitted = false;
            if (deferred === "changed") current = false;
            if (deferred === "retention") now += 2;
            done("archive");
        },
        seek() {
            assert.fail("remote offset must reopen with bound pause intent");
        },
    };
    const controller = c.__ottArchiveSession.create(c.OttPlayCore, ports);
    const offset = deferred === "retention" ? -9007199254740991 : 60;
    assert.equal(
        controller.seekRelative(offset, () => permitted && current, false),
        null,
        deferred
    );
    if (callback) callback();
    assert.deepEqual(
        effects,
        [],
        deferred + " must have no later playback effect"
    );
}

// Pausing at the oldest retained instant must not disable the next seek when
// the retention window advances. Only the destination must remain available.
for (const file of [false, true]) {
    for (const offset of [60, -10, -9007199254740991, 9007199254740991]) {
        const c = fixture(),
            opened = [];
        let now = 1000000.25,
            epoch = Math.ceil(now - 86400),
            current = true;
        const context = {
            channelId: "1",
            file,
            isCurrent: () => current,
            retention: 86400,
            schedule: [],
            sourceId: "a",
        };
        const controller = c.__ottArchiveSession.create(c.OttPlayCore, {
            authorize: () => false,
            capture: () => context,
            epoch: () => epoch,
            guide() {},
            now: () => now,
            open(_context, model) {
                opened.push({ paused: model.paused, position: model.position });
                return context;
            },
            pause() {},
            publish() {},
            resolve(_context, _model, done) {
                done("archive");
            },
            seek() {
                assert.fail(
                    "a paused archive seek must reopen the destination"
                );
            },
        });
        assert.equal(controller.canSeekRelative(), true);
        now += 2;
        assert.equal(controller.canSeekRelative(), true);
        const result = controller.seekRelative(offset, () => current, true);
        const requested = Math.floor(epoch + offset),
            earliest = Math.ceil(now - context.retention),
            latest = Math.floor(now) - 1,
            position = Math.max(earliest, Math.min(latest, requested));
        assert.deepEqual(JSON.parse(JSON.stringify(result)), {
            clamped: position !== requested,
            earliest,
            from: epoch,
            latest,
            position,
            timeline: "archive",
        });
        assert.deepEqual(opened, [{ paused: true, position }]);
        current = false;
        assert.equal(controller.canSeekRelative(), false);
        current = true;
        for (const invalid of [0, -1, NaN, Infinity, now + 1]) {
            epoch = invalid;
            assert.equal(controller.canSeekRelative(), false);
        }
    }
}

// Integer retention lower edge is rounded inward; invalid inputs do not resolve.
{
    const c = fixture();
    let resolves = 0;
    const context = {
        channelId: "1",
        file: false,
        isCurrent: () => true,
        retention: 86400,
        schedule: [],
        sourceId: "a",
    };
    const controller = c.__ottArchiveSession.create(c.OttPlayCore, {
        authorize: () => false,
        capture: () => context,
        epoch: () => 999020.75,
        guide() {},
        now: () => 1000000.25,
        open: () => context,
        pause() {},
        publish() {},
        resolve(_context, _model, done) {
            resolves++;
            done("archive");
        },
        seek() {},
    });
    for (const value of [0, NaN, Infinity, "1", true, 9007199254740992])
        assert.equal(
            controller.seekRelative(value, () => true, false),
            null
        );
    assert.equal(resolves, 0);
    const result = controller.seekRelative(
        -9007199254740991,
        () => true,
        false
    );
    assert.equal(result.earliest, 913601);
    assert.equal(result.position, 913601);
}

// The real archive controller and media backend agree across a delayed decoder
// attachment, including paused starts and retirement by a replacement source.
for (const file of [false, true])
    for (const paused of [false, true])
        for (const stop of [false, true])
            for (const stale of [false, true]) {
                const c = fixture(),
                    leases = [],
                    pending = [];
                let deferred = false;
                const playback = c.__ottClassicPlayback;
                const backend = c.__ottMediaBackend.create({
                    admitted: () => true,
                    clearInterval() {},
                    context() {
                        const state = playback.snapshot(),
                            owner = playback.context();
                        return state.target
                            ? {
                                  active: owner.isCurrentBackend,
                                  generation: state.generation,
                                  kind: state.target.kind,
                                  position: state.position,
                                  sourceActive: owner.isCurrentSource,
                              }
                            : null;
                    },
                    emit(context, type, position, duration) {
                        playback.command({
                            duration,
                            generation: context.generation,
                            position,
                            type,
                        });
                    },
                    open(request, event) {
                        const sample = {
                            duration: NaN,
                            paused: request.paused === true,
                            position: request.position || 0,
                            ready: 4,
                        };
                        leases.push({ event, request, sample });
                        if (!sample.paused) event("playing");
                        return {
                            dispose() {},
                            pause() {
                                sample.paused = true;
                                event("pause");
                            },
                            resume() {
                                sample.paused = false;
                                event("playing");
                            },
                            sample: () => sample,
                            seek(value) {
                                sample.position = value;
                            },
                            supportsPausedStart: true,
                        };
                    },
                    resolve(url, done) {
                        if (deferred) pending.push(() => done(url));
                        else done(url);
                        return () => {};
                    },
                    setInterval() {
                        return 1;
                    },
                });
                try {
                    c.stbPlay = (url, position) =>
                        backend.open({ position, url });
                    c.__ottCoreTransport = { play: c.stbPlay };
                    c.stbStop = () => {
                        playback.cancel();
                        backend.stop();
                    };
                    c.__ottCoreBackendPeek = () => backend;
                    c.fileArchive = file;
                    c.sStopPlay = stop;
                    c.parentalArray = [];
                    assert.equal(c.__ottClassicArchive.open(999020), true);
                    const old = backend.current();
                    leases[0].sample.position += 0.75;
                    old.sample();
                    if (paused) old.pause();
                    const before = playback.snapshot(),
                        captured = playback.context();
                    deferred = true;
                    const result = c.__ottClassicArchive.seekRelative(
                        60,
                        () =>
                            old.active() &&
                            captured.isCurrent() &&
                            playback.snapshot().generation ===
                                before.generation,
                        paused
                    );
                    assert.ok(
                        result,
                        JSON.stringify({ file, paused, stale, stop })
                    );
                    assert.equal(result.position, 999080);
                    assert.equal(pending.length, 1);
                    assert.equal(leases.length, 1);
                    if (stale) {
                        playback.command({ channelId: "202", type: "live" });
                        pending[0]();
                        assert.equal(leases.length, 1);
                    } else {
                        pending[0]();
                        assert.equal(leases.length, 2);
                        assert.equal(leases[1].request.paused, paused);
                        assert.equal(
                            backend.current().snapshot().phase,
                            paused ? "paused" : "playing"
                        );
                        assert.equal(leases[1].request.position, file ? 80 : 0);
                        assert.equal(
                            playback.snapshot().target.archiveStart +
                                playback.snapshot().position,
                            999080
                        );
                        if (paused) backend.current().resume();
                        leases[1].sample.position += 1;
                        backend.current().sample();
                        assert.equal(
                            playback.snapshot().target.archiveStart +
                                playback.snapshot().position,
                            999081
                        );
                    }
                } finally {
                    backend.dispose();
                }
            }
