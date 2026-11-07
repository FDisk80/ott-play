const numericKeyState = require("./helpers/numeric-key-state.cjs");
const assert = require("node:assert/strict");
const { fixture, sourceFunctions } = require("./test_port_vod.cjs");
const vm = require("node:vm");

function setup(provider = "plex") {
    const c = fixture();
    const pending = [];
    c.p_pref = provider;
    c.__ottActiveProviderDriver = {
        capabilities: { mediaPlaylist: true },
        id: provider,
    };
    c.channels = {};
    c.cats = { All: [101, 102, 103] };
    c.catsArray = ["All"];
    c.curList = c.cats.All;
    c.cList = c.curList;
    c.__ottChannels = {
        capture: () => ({
            active: () => c.__ottActiveProviderDriver.id === provider,
            category: () => c.catsArray.indexOf("All"),
            members: () => c.cats.All.slice(),
        }),
        group: () => "system:all",
        index: (group) => (group === "system:all" ? 0 : -1),
        select() {},
    };
    for (const id of c.cats.All)
        c.channels[id] = {
            __ottMediaItem: {
                id,
                request: { id },
                title: "Film " + id,
            },
            channel_name: "Film " + id,
        };
    c.ifParentalAccessChId = () => false;
    c.getChannelUrl = () => "";
    c.channelsList = () => c.calls.push(["channels"]);
    c.playChannel = c._playChannel;
    c.stbPlay = (url, position) => {
        c.calls.push(["play", url, position]);
        c.__ottClassicPlayback.command({ type: "playing" });
    };
    c.providerMediaClient = {
        cancel() {},
        cancelAutomatic() {},
        resolve(item, done) {
            pending.push({ done, item });
        },
        stableRequests: true,
    };
    function resolve(index = pending.length - 1) {
        const { item, done } = pending[index];
        done({ ...item, stream_url: "film-" + item.id + ".mp4" });
    }
    function end() {
        c.__ottClassicPlayback.command({ type: "stop" });
        c.__ottMedia.ended(c.__ottClassicPlayback.snapshot().generation);
    }
    return { c, end, pending, resolve };
}

// Channel-list reselection is an explicit live choice while playing archive.
// Run the real list handler, transport entrypoint and shared playback owner.
function selectCurrentChannel(c, category = 0, index = 0) {
    vm.runInContext(
        sourceFunctions("src/channels/index.ts", ["channelsKeyHandler"]),
        c
    );
    c.listCatIndex = category;
    c.listArray = c.cats[c.catsArray[category]];
    c.selIndex = index;
    assert.equal(c.channelsKeyHandler(c.keys.ENTER), true);
}
function setupPlainChannels(provider = "m3u") {
    const { c } = setup(provider);
    c.__ottActiveProviderDriver.capabilities = {};
    c.channels = Object.fromEntries(
        c.cats.All.map((id) => [id, { channel_name: "Channel " + id, rec: 24 }])
    );
    c.cats.Repeated = [103, 101];
    c.catsArray.push("Repeated");
    c.getChannelUrl = (id) => "live-channel-" + id + ".m3u8";
    c.checkMedia = () => {};
    c.updateChannelInfo = (id) => c.calls.push(["channel-info", id]);
    c._playChannel(0, 0);
    return c;
}
for (const paused of [false, true]) {
    for (const repeatedCategory of [false, true]) {
        const c = setupPlainChannels();
        c.__ottClassicPlayback.command({
            archiveStart: 1700000000,
            channelId: 101,
            type: "archive",
        });
        c.__ottClassicPlayback.command({ type: "playing" });
        if (paused) c.__ottClassicPlayback.command({ type: "pause" });
        assert.equal(c.__ottClassicPlayback.snapshot().target.kind, "archive");
        assert(c.playType > 0);
        const before = c.calls.filter(([kind]) => kind === "play").length;
        selectCurrentChannel(
            c,
            repeatedCategory ? 1 : 0,
            repeatedCategory ? 1 : 0
        );
        const state = c.__ottClassicPlayback.snapshot();
        assert.equal(
            state.target.kind,
            "live",
            "Selecting the archived channel returns to live"
        );
        assert.equal(state.target.channelId, "101");
        assert.equal(state.phase, "playing");
        assert.equal(c.playType, 0);
        assert.equal(c.catIndex, repeatedCategory ? 1 : 0);
        assert.equal(c.primaryIndex, repeatedCategory ? 1 : 0);
        assert.deepEqual(
            c.calls.filter(([kind]) => kind === "play").slice(before),
            [["play", "live-channel-101.m3u8", undefined]]
        );
    }
}
for (const mode of ["live", "vod", "offline"]) {
    const c = setupPlainChannels(mode === "offline" ? "offline" : "m3u");
    if (mode === "vod")
        c.__ottClassicPlayback.command({
            channelId: 101,
            type: "finite-channel",
        });
    const before = c.__ottClassicPlayback.snapshot();
    const plays = c.calls.filter(([kind]) => kind === "play").length;
    selectCurrentChannel(c);
    assert.equal(
        c.calls.filter(([kind]) => kind === "play").length,
        plays,
        "Same " + mode + " channel does not restart"
    );
    assert.equal(
        c.__ottClassicPlayback.snapshot().generation,
        before.generation
    );
    assert.equal(
        c.__ottClassicPlayback.snapshot().target.kind,
        mode === "live" ? "live" : "vod"
    );
}
for (const paused of [false, true]) {
    const { c, pending, resolve } = setup("plex");
    c._playChannel(0, 0);
    resolve();
    if (paused) c.__ottClassicPlayback.command({ type: "pause" });
    const owner = c.__ottMedia.current();
    const before = c.__ottClassicPlayback.snapshot();
    const plays = c.calls.filter(([kind]) => kind === "play").length;
    const requests = pending.length;
    assert(c.playType < 0);
    selectCurrentChannel(c);
    assert.equal(c.calls.filter(([kind]) => kind === "play").length, plays);
    assert.equal(
        pending.length,
        requests,
        "Same Plex item does not resolve again"
    );
    assert.equal(c.__ottMedia.current(), owner);
    assert.equal(
        c.__ottClassicPlayback.snapshot().generation,
        before.generation
    );
    assert.equal(
        c.__ottClassicPlayback.snapshot().phase,
        paused ? "paused" : "playing"
    );
}
console.log(
    "PASS channel reselection: archive returns live; live/VOD/Local/Plex continuity retained"
);

// Every ordinary Plex library entry uses the current category/channel list.
{
    const { c } = setup("plex");
    c.catIndex = 3;
    c.primaryIndex = 7;
    const shown = [];
    c.channelsList = (...args) => shown.push(args);
    c.getMediaArray = () =>
        assert.fail("Flat Plex browsing must not fetch a legacy folder tree");
    c.mediaList(null);
    c.__ottMedia.open({ path: "/library/sections", title: "Plex" });
    assert.deepEqual(shown, [
        [3, 7],
        [3, 7],
    ]);
    assert.equal(
        c.listArray.some((row) => row.__ottMediaFilter),
        false
    );
    assert(
        !c.elements["#listDetail"]?.innerHTML.includes("mediaPlaybackControls")
    );
    for (const [target, kind] of [
        [-1, "history"],
        [-2, "favorites"],
    ]) {
        c.__ottMedia.open(target);
        assert.equal(c.__ottMedia.snapshot().frame.route.kind, kind);
        assert.equal(shown.length, 2, "Explicit collections remain accessible");
    }
}
{
    const c = fixture();
    c.p_pref = "plex";
    c.__ottActiveProviderDriver = {
        capabilities: { mediaPlaylist: false },
        id: "plex",
    };
    let late;
    c.getMediaArray = (_target, done) => {
        late = done;
    };
    c.mediaList(null);
    assert.equal(typeof late, "function");
    const selected = [{ channel_name: "Film channel" }];
    c.channelsList = () => {
        c.listArray = selected;
        c.elements["#listDetail"].innerHTML = "Channel details";
    };
    c.__ottActiveProviderDriver.capabilities.mediaPlaylist = true;
    c.mediaList(null);
    c.mediaRecords = [
        { stream_url: "retired.mp4", title: "Retired folder reply" },
    ];
    late();
    assert.equal(
        c.listArray,
        selected,
        "Retired folder completion cannot replace the channel list"
    );
    assert.equal(c.elements["#listDetail"].innerHTML, "Channel details");
}

// Real VPortal resolution must settle the bridge's owned loading transaction.
function setupVPortal() {
    const { c } = setup("vportal");
    vm.runInContext(
        sourceFunctions("src/plugins/vportal.ts", [
            "parseVPortalLink",
            "hostedVPortalRoute",
            "createVPortalClient",
        ]),
        c
    );
    const requests = [];
    c.$.ajax = (options) => {
        const request = {
            abort() {
                options.error({}, "abort");
                options.complete();
            },
            fail() {
                options.error({}, "error");
                options.complete();
            },
            receive(value) {
                options.success(value);
                options.complete();
            },
        };
        requests.push(request);
        return request;
    };
    c.providerMediaClient = c.createVPortalClient(
        "portal::[key:fixture]https://portal.example/api/"
    );
    c.alert = () => assert.fail("Channel playback reports a nonmodal failure");
    c.showShift = (text) => {
        assert.equal(
            c.elements["#dialogbox"].style.display,
            "none",
            "owned loading closes before showing a resolution error"
        );
        c.calls.push(["shift", text]);
    };
    return { c, requests };
}
for (const direct of [false, true]) {
    for (const failure of [
        "network",
        "throw",
        "null",
        "malformed",
        "missing",
    ]) {
        const { c, requests } = setupVPortal();
        if (direct)
            c.channels[101].__ottMediaItem = {
                __ottMediaOrigin: {
                    target: { request: { cmd: "season", id: 3 } },
                },
                __ottVPortalDirect: { id: { field: "id", value: "101" } },
                id: 101,
                stream_url: "https://cdn.example/expired.mp4",
                title: "Film 101",
            };
        const ajax = c.$.ajax;
        if (failure === "throw")
            c.$.ajax = () => {
                throw Error("fixture-private-key");
            };
        c._playChannel(0, 0);
        if (failure !== "throw") {
            assert.match(c.elements["#dialogbox"].innerHTML, /ott-spinner/);
            assert.equal(c.elements["#dialogbox"].style.display, "");
            if (failure === "network") requests[0].fail();
            else
                requests[0].receive(
                    failure === "null"
                        ? null
                        : {
                              items: [],
                              type:
                                  failure === "missing"
                                      ? "category"
                                      : "invalid",
                          }
                );
        }
        assert.equal(c.elements["#dialogbox"].style.display, "none");
        assert.equal(c.calls.filter(([kind]) => kind === "shift").length, 1);
        assert.equal(c.calls.filter(([kind]) => kind === "channels").length, 1);
        assert.equal(c.calls.filter(([kind]) => kind === "play").length, 0);
        c.$.ajax = ajax;
        c._playChannel(0, 0);
        const retry = requests.at(-1);
        if (requests.length > 1) {
            requests[0].fail();
            requests[0].receive({ url: "https://cdn.example/stale.mp4" });
            assert.equal(
                c.calls.filter(([kind]) => kind === "shift").length,
                1
            );
            assert.equal(c.elements["#dialogbox"].style.display, "");
        }
        retry.receive(
            direct
                ? {
                      items: [
                          {
                              id: 101,
                              type: "stream",
                              url: "https://cdn.example/retry.mp4",
                          },
                      ],
                      type: "category",
                  }
                : { url: "https://cdn.example/retry.mp4" }
        );
        assert.equal(c.elements["#dialogbox"].style.display, "none");
        assert.equal(c.calls.filter(([kind]) => kind === "play").length, 1);
        assert.equal(
            c.__ottMedia.current().payload.stream_url,
            "https://cdn.example/retry.mp4"
        );
    }
}
{
    const { c, requests } = setupVPortal();
    c._playChannel(0, 0);
    c.dialogBoxKeyHandler(c.keys.RETURN);
    c._playChannel(0, 1);
    requests[0].fail();
    requests[0].receive({ url: "https://cdn.example/cancelled.mp4" });
    assert.equal(c.calls.filter(([kind]) => kind === "shift").length, 0);
    assert.equal(c.calls.filter(([kind]) => kind === "play").length, 0);
    assert.equal(c.elements["#dialogbox"].style.display, "");
    requests[1].receive({ url: "https://cdn.example/current.mp4" });
    assert.equal(c.__ottMedia.current().payload.id, 102);
}
console.log(
    "PASS VPortal resolution failures close owned loading, retry, and ignore stale callbacks"
);

for (const provider of ["plex", "vportal"]) {
    const { c, pending, resolve, end } = setup(provider);
    assert.equal(c._playChannel(0, 1), true);
    assert.equal(pending.length, 1);
    assert.match(c.elements["#dialogbox"].innerHTML, /ott-spinner/);
    assert.equal(c.calls.filter(([kind]) => kind === "play").length, 0);
    resolve();
    assert.equal(c.elements["#dialogbox"].style.display, "none");
    assert.equal(c.primaryIndex, 1);
    assert.equal(c.curList[c.primaryIndex], 102);
    const state = c.__ottClassicPlayback.snapshot();
    assert.equal(state.target.kind, "vod");
    assert.equal(state.target.channelId, "provider:102");
    assert.equal(state.historyTarget.kind, "live");
    assert.equal(state.historyTarget.channelId, "102");
    assert.equal(c.playType, -99999999999);
    assert.equal(c.__ottMedia.kioskSelection(), null);
    vm.runInContext(
        numericKeyState() +
            sourceFunctions("src/key-handler/index.ts", [
                "handleMainKey",
                "keyFun",
                "toggleMainPlayback",
            ]),
        c
    );
    const seeks = [];
    c.shiftArchive = (seconds) => seeks.push(seconds);
    c.settings.alFun = 14;
    c.settings.arFun = 13;
    for (const key of [c.keys.LEFT, c.keys.RIGHT])
        c.handleMainKey(key, { preventDefault() {}, stopPropagation() {} });
    assert.deepEqual(seeks, [-10, 10]);

    // The same list owns reshuffling and incrementally published entries.
    c.cats.All = [102, 103, 101, 104];
    c.curList = c.cats.All;
    c.primaryIndex = 0;
    c.channels[104] = {
        __ottMediaItem: { id: 104, request: { id: 104 }, title: "Added film" },
    };
    c.handleMainKey(c.keys.UP, { preventDefault() {}, stopPropagation() {} });
    assert.equal(pending.at(-1).item.id, 103);
    resolve();
    assert.equal(c.primaryIndex, 1);
    c.handleMainKey(c.keys.DOWN, { preventDefault() {}, stopPropagation() {} });
    assert.equal(pending.at(-1).item.id, 102);
    resolve();
    c._playChannel(0, 2);
    resolve();
    c.isListVisible = true;
    const closes = c.calls.filter(([kind]) => kind === "close").length;
    end();
    assert.equal(
        c.calls.filter(([kind]) => kind === "close").length,
        closes,
        "natural completion leaves a reopened channel list open"
    );
    c.isListVisible = false;
    assert.equal(
        pending.at(-1).item.id,
        104,
        "EOS observes newly appended rows"
    );
    resolve();
    end();
    assert.equal(pending.at(-1).item.id, 102, "repeat all wraps current order");
    resolve();
    c.__ottMedia.cycleRepeat();
    assert.equal(c.__ottMedia.repeatMode(), "one");
    end();
    assert.equal(pending.at(-1).item.id, 102);
    resolve();
    c.__ottMedia.cycleRepeat();
    assert.equal(c.__ottMedia.repeatMode(), "off");
    c._playChannel(0, 3);
    resolve();
    const count = pending.length;
    end();
    assert.equal(pending.length, count, "repeat off stops at final row");
    console.log(
        "PASS " +
            provider +
            " channel playback, loading, selection, dynamic order and repeat"
    );
}

for (const provider of ["plex", "vportal"]) {
    for (const mode of ["all", "one", "off"]) {
        const { c, pending, resolve, end } = setup(provider);
        while (c.__ottMedia.repeatMode() !== mode) c.__ottMedia.cycleRepeat();
        c._playChannel(0, mode === "one" ? 2 : 0);
        resolve();
        c.isListVisible = true;
        const handler = () => {};
        const owner = c.__ottClassicScreenPort.setOwnedCallback(
            "dialog",
            handler
        ).owner;
        const ownedHandler = c.dialogBoxKeyHandler;
        c.$("#dialogbox").html("Actions").show();
        const closes = c.calls.filter(([kind]) => kind === "close").length;
        end();
        assert.equal(pending.length, 2);
        c.__ottMedia.cycleRepeat();
        assert.equal(
            pending.length,
            mode === "one" ? 2 : 3,
            "Repeat restarts pending EOS with its new mode, except Off at the final file"
        );
        resolve(1);
        assert.equal(
            c.calls.filter(([kind]) => kind === "play").length,
            1,
            "The cancelled pre-change resolver cannot start its old choice"
        );
        if (mode !== "one") {
            assert.equal(pending[2].item.id, mode === "all" ? 101 : 102);
            resolve(2);
            assert.equal(c.calls.filter(([kind]) => kind === "play").length, 2);
            assert.equal(
                c.__ottMedia.current().payload.id,
                mode === "all" ? 101 : 102
            );
        } else assert.equal(c.__ottClassicPlayback.snapshot().phase, "stopped");
        assert(
            owner.active() && owner.foreground(),
            "Actions keeps screen ownership"
        );
        assert.equal(c.dialogBoxKeyHandler, ownedHandler);
        assert.equal(c.elements["#dialogbox"].innerHTML, "Actions");
        assert.equal(
            c.calls.filter(([kind]) => kind === "close").length,
            closes
        );
    }
    console.log(
        "PASS " +
            provider +
            " repeat changes re-admit pending channel EOS without replacing Actions"
    );
}
for (const retire of ["cancel", "source", "manual"]) {
    const { c, pending, resolve, end } = setup();
    c._playChannel(0, 0);
    resolve();
    end();
    if (retire === "cancel") c.__ottMedia.cancelAuto();
    else if (retire === "manual") c._playChannel(0, 2);
    else
        c.providerMediaClient.cancelAutomatic = () => {
            c.p_pref = "changed";
            c.__ottActiveProviderDriver = { capabilities: {}, id: "changed" };
        };
    const count = pending.length;
    c.__ottMedia.cycleRepeat();
    assert.equal(
        pending.length,
        count,
        "A repeat change cannot re-admit a cancelled, replaced or foreign-source transition"
    );
    for (let index = 1; index < pending.length; index++) resolve(index);
    assert.equal(c.calls.filter(([kind]) => kind === "play").length, 1);
}
console.log(
    "PASS repeat changes preserve cancellation, source and manual-selection ownership"
);

{
    const { c, pending, resolve } = setup();
    c._playChannel(0, 0);
    c.dialogBoxKeyHandler(c.keys.RETURN);
    resolve();
    assert.equal(c.calls.filter(([kind]) => kind === "play").length, 0);
    assert(c.calls.some(([kind]) => kind === "channels"));
    c._playChannel(0, 1);
    c._playChannel(0, 2);
    resolve(1);
    assert.equal(c.calls.filter(([kind]) => kind === "play").length, 0);
    resolve(2);
    assert.equal(c.calls.filter(([kind]) => kind === "play").length, 1);
    assert.equal(c.__ottMedia.current().payload.id, 103);
    assert.equal(pending.length, 3);
    console.log(
        "PASS channel cancellation and replacement reject stale resolvers"
    );
}

{
    const { c, pending, resolve, end } = setup();
    c._playChannel(0, 0);
    resolve();
    c._playChannel(0, 1);
    end();
    assert.equal(
        pending.length,
        2,
        "old EOS does not replace pending selection"
    );
    resolve();
    assert.equal(c.__ottMedia.current().payload.id, 102);
    assert.equal(c.__ottClassicPlayback.snapshot().phase, "playing");
    console.log("PASS old decoder EOS preserves selected pending channel");
}

{
    const { c, resolve, pending } = setup();
    c.parentalArray = [];
    const priorIndex = c.primaryIndex;
    const parental = c.__ottParental;
    assert.equal(typeof parental.needs, "function");
    assert.equal(parental.needs("channels"), true);
    c.__ottParental = undefined;
    assert.equal(c.__ottParental, undefined);
    assert.equal(
        c._playChannel(0, 1, true, () => c.primaryIndex === priorIndex),
        false,
        "missing parental runtime must reject relative admission"
    );
    assert.equal(pending.length, 0);
    assert.equal(c.primaryIndex, priorIndex);
    c.__ottParental = parental;
    assert.equal(c.__ottParental, parental);
    assert.equal(c.__ottParental.needs("channels"), true);
    c.parentalArray = [102];
    assert.equal(
        c._playChannel(0, 1, true, () => c.primaryIndex === priorIndex),
        false,
        "relative admission cannot leave a protected-channel PIN continuation"
    );
    assert.equal(pending.length, 0);
    c.parentalArray = [];
    assert.equal(
        c._playChannel(0, 1, true, () => c.primaryIndex === priorIndex),
        true
    );
    resolve();
    assert.equal(
        c.__ottMedia.current().payload.id,
        102,
        "relative command admission applies before committing its new selection"
    );
    console.log(
        "PASS relative channel admission is not reused after selection commits"
    );
}

{
    const { c, resolve } = setup();
    for (const file of [
        "src/provider/source-identity.ts",
        "src/access/session.ts",
        "src/access/classic-adapter.ts",
    ])
        require("./helpers/private-runtime.cjs")(c, file);
    c.parentalArray = [];
    const prior = c.primaryIndex;
    assert.equal(
        c._playChannel(0, 1, true, () => c.primaryIndex === prior),
        true
    );
    // The actual library resolves captured categories by identity, not index.
    // Its adapter may observe the same chosen ID at a different cursor.
    const members = c.cats.All;
    members.splice(0, members.length, 102, 101, 103);
    c.cats.Other = [];
    c.catsArray = ["Other", "All"];
    c.curList = members;
    c.catIndex = 1;
    c.primaryIndex = 0;
    resolve();
    assert.equal(c.__ottMedia.current().payload.id, 102);
    assert.equal(c.catIndex, 1);
    assert.equal(c.primaryIndex, 0);
}

// Real controller tickets and backend stop emission protect owned teardown.
// An older core keeps its ordinary Stop behavior but cannot authorize a new proof.
{
    const { c, pending } = setup();
    for (const file of [
        "src/provider/source-identity.ts",
        "src/access/session.ts",
        "src/access/classic-adapter.ts",
    ])
        require("./helpers/private-runtime.cjs")(c, file);
    c.parentalArray = [];
    c.settings.stopPlay = 1;
    assert.equal(
        c.settings.stopPlay,
        1,
        "actual settings facade enables Stop before selection"
    );
    let stops = 0;
    c.stbStop = () => {
        stops++;
    };
    assert.equal(
        c._playChannel(
            0,
            1,
            true,
            () => true,
            undefined,
            false,
            false,
            undefined,
            () => true
        ),
        false
    );
    assert.equal(stops, 1);
    assert.equal(pending.length, 0);
}

for (const change of [
    "none",
    "nested-stop",
    "replace",
    "cancel",
    "throw",
    "archive-cancel",
    "retire-cancel",
    "auto-cancel",
]) {
    const { c, pending, resolve } = setup();
    for (const file of [
        "src/provider/source-identity.ts",
        "src/access/session.ts",
        "src/access/classic-adapter.ts",
        "src/device/media-backend.ts",
    ])
        require("./helpers/private-runtime.cjs")(c, file);
    c.parentalArray = [];
    c._playChannel(0, 0);
    resolve();
    let onDispose = null;
    let emittedTicket = null;
    let engineEvent;
    const backend = c.__ottMediaBackend.create({
        clearInterval() {},
        context: () => {
            const state = c.__ottClassicPlayback.snapshot();
            return state.target
                ? { ...state.target, generation: state.generation }
                : null;
        },
        emit(context, type, position, duration, sourceStop) {
            if (sourceStop) emittedTicket = sourceStop;
            c.__ottClassicPlayback.command({
                duration,
                generation: context.generation,
                position,
                sourceStop,
                type,
            });
        },
        open(_request, event) {
            engineEvent = event;
            return {
                dispose() {
                    if (onDispose) {
                        const hook = onDispose;
                        onDispose = null;
                        hook();
                    }
                },
                pause() {},
                resume() {},
                sample: () => ({
                    duration: 100,
                    paused: false,
                    position: 0,
                    ready: 3,
                }),
                seek() {},
            };
        },
        setInterval: () => 1,
    });
    c.getCoreMediaBackend = () => backend;
    vm.runInContext(
        sourceFunctions("src/core/index.ts", [
            "stbStop",
            "stopCorePlayback",
            "stopCoreForSelection",
        ]),
        c
    );
    c.__ottCoreTransport = { stopForSelection: c.stopCoreForSelection };
    backend.open({ url: "fixture-old" });
    engineEvent("playing");
    c.settings.stopPlay = 1;
    assert.equal(
        c.settings.stopPlay,
        1,
        "actual settings facade enables Stop before selection"
    );
    if (change === "archive-cancel")
        c.__ottClassicArchive = {
            cancel() {
                c.__ottClassicArchive = null;
                c.__ottClassicPlayback.cancel();
            },
        };
    if (change === "retire-cancel")
        c.__ottGlobalFavorites = {
            navigation: { retire: () => c.__ottClassicPlayback.cancel() },
        };
    if (change === "auto-cancel")
        c.__ottMedia.cancelAuto = () => c.__ottClassicPlayback.cancel();
    const before = c.__ottClassicPlayback.snapshot();
    let phases = [];
    let active = true;
    onDispose = () => {
        if (change === "nested-stop") c.stbStop();
        if (change === "replace") c._playChannel(0, 2);
        if (change === "cancel") {
            active = false;
            c.__ottClassicPlayback.cancel();
        }
        if (change === "throw") throw new Error("teardown fixture");
    };
    const select = () =>
        c._playChannel(
            0,
            1,
            true,
            () =>
                c.__ottClassicPlayback.snapshot().generation ===
                before.generation,
            undefined,
            false,
            false,
            undefined,
            (_owner, selected = true) => {
                phases.push(selected);
                return active;
            }
        );
    if (change === "throw") assert.throws(select, /teardown fixture/);
    else assert.equal(select(), change === "none");
    if (change === "none") {
        assert(phases.includes(false));
        assert(phases.includes(true));
        assert.equal(emittedTicket.used, true);
        resolve(pending.length - 1);
        assert.equal(c.__ottMedia.current().payload.id, 102);
    } else assert.notEqual(c.curList[c.primaryIndex], 102);
    if (["archive-cancel", "retire-cancel", "auto-cancel"].includes(change)) {
        assert.equal(
            emittedTicket,
            null,
            "cleanup cancellation prevents backend stop"
        );
        assert(
            backend.current(),
            "the replacement owner's backend was not stopped"
        );
    }
    if (emittedTicket) {
        c.__ottClassicPlayback.command({
            sourceStop: emittedTicket,
            type: "stop",
        });
        assert.equal(
            emittedTicket.current(),
            false,
            "retired/replayed token cannot skip cancellation"
        );
    }
}
{
    const { c } = setup();
    require("./helpers/private-runtime.cjs")(
        c,
        "src/provider/source-identity.ts"
    );
    const backend = { current: () => null, stop() {} };
    c.getCoreMediaBackend = () => backend;
    vm.runInContext(
        sourceFunctions("src/core/index.ts", ["stopCoreForSelection"]),
        c
    );
    const proof = c.stopCoreForSelection();
    assert.equal(
        typeof proof,
        "function",
        "idle no-context stop retains bounded ownership"
    );
    assert.equal(proof(), true);
    c.__ottClassicPlayback.cancel();
    assert.equal(proof(), false);
}

// Direct VOD dispatch consumes the same owned stop proof, not a second void stop.
for (const change of ["none", "source", "nested-stop"]) {
    const { c, resolve } = setup();
    c._playChannel(0, 0);
    resolve();
    require("./helpers/private-runtime.cjs")(c, "src/device/media-backend.ts");
    let dispose;
    const backend = c.__ottMediaBackend.create({
        clearInterval() {},
        context: () => {
            const state = c.__ottClassicPlayback.snapshot();
            return state.target
                ? { ...state.target, generation: state.generation }
                : null;
        },
        emit(context, type, position, duration, sourceStop) {
            c.__ottClassicPlayback.command({
                duration,
                generation: context.generation,
                position,
                sourceStop,
                type,
            });
        },
        open() {
            return {
                dispose() {
                    if (dispose) {
                        const callback = dispose;
                        dispose = null;
                        callback();
                    }
                },
                pause() {},
                resume() {},
                sample: () => ({
                    duration: 100,
                    paused: false,
                    position: 0,
                    ready: 3,
                }),
                seek() {},
            };
        },
        setInterval: () => 1,
    });
    c.getCoreMediaBackend = () => backend;
    vm.runInContext(
        sourceFunctions("src/core/index.ts", [
            "stbStop",
            "stopCorePlayback",
            "stopCoreForSelection",
        ]),
        c
    );
    c.__ottCoreTransport = { stopForSelection: c.stopCoreForSelection };
    backend.open({ url: "old-direct" });
    c.settings.stopPlay = 1;
    assert.equal(
        c.settings.stopPlay,
        1,
        "actual settings facade enables Stop before selection"
    );
    dispose = () => {
        if (change === "source") c.p_pref = "replacement-source";
        if (change === "nested-stop") c.stbStop();
    };
    const before = c.calls.filter(([kind]) => kind === "play").length;
    c._playMedia({ id: "direct", stream_url: "direct.mp4", title: "Direct" });
    assert.equal(
        c.calls.filter(([kind]) => kind === "play").length,
        before + (change === "none" ? 1 : 0),
        change
    );
}

for (const change of ["cancel", "standby", "catalog", "replacement"]) {
    const { c, pending, resolve } = setup();
    for (const file of [
        "src/provider/source-identity.ts",
        "src/access/session.ts",
        "src/access/classic-adapter.ts",
    ])
        require("./helpers/private-runtime.cjs")(c, file);
    c.parentalArray = [];
    const prior = c.primaryIndex;
    let active = true;
    let loadingOwner = null;
    assert.equal(
        c._playChannel(
            0,
            1,
            true,
            () => c.primaryIndex === prior,
            undefined,
            false,
            false,
            undefined,
            (owner) => {
                if (owner) {
                    assert.equal(
                        owner,
                        c.__ottClassicScreenPort.owner("dialog")
                    );
                    loadingOwner = owner;
                }
                return active;
            }
        ),
        true
    );
    assert.equal(pending.length, 1);
    assert(
        loadingOwner,
        "actual media adapter passes its owned loading dialog"
    );
    if (change === "cancel") active = false;
    if (change === "standby") c.__ottStandby = { blocked: () => true };
    if (change === "catalog") c.channels[102] = { ...c.channels[102] };
    if (change === "replacement") c._playChannel(0, 2);
    resolve(0);
    assert.equal(
        c.calls.filter(([kind]) => kind === "play").length,
        0,
        change + " rejects the stale finite-channel resolver"
    );
    if (change === "replacement") {
        resolve(1);
        assert.equal(c.__ottMedia.current().payload.id, 103);
    }
}

{
    const { c, resolve, end, pending } = setup();
    c.__ottKiosk = {
        admit: (id) => id === 102,
        allowed: (id) => id === 102,
        allowedMedia: () => false,
        enabled: () => true,
        locked: () => true,
    };
    assert.equal(c._playChannel(0, 1), true);
    resolve();
    assert.equal(c.__ottMedia.current().payload.id, 102);
    assert.equal(c._playChannel(0, 0), undefined);
    end();
    assert.equal(
        pending.at(-1).item.id,
        102,
        "pinned channel loops without attempting another file"
    );
    resolve();
    assert.equal(c.__ottClassicPlayback.snapshot().phase, "playing");
    console.log("PASS channel kiosk admission and immediate pinned replay");
}

for (const provider of ["plex", "vportal"]) {
    const seed = setup(provider);
    let clock = 1700000000000;
    seed.c.Date = class extends Date {
        static now() {
            return clock;
        }
    };
    const positions = [137.25, 248.5, 369.75];
    for (let index = 0; index < positions.length; index++) {
        seed.c._playChannel(0, index);
        seed.resolve();
        clock += 5001;
        seed.c.__ottClassicPlayback.command({
            position: positions[index],
            type: "position",
        });
        const journal = JSON.parse(
            seed.c.stored["mediaJournal.v1:" + seed.c.__ottMedia.sourceId()]
        );
        assert.equal(
            journal.history[0].position,
            positions[index],
            "ordinary decoder samples persist channel-backed media without a shutdown callback"
        );
        const navigation = JSON.parse(seed.c.stored.playbackJournal).bookmark;
        assert.equal(navigation.kind, "live");
        assert.equal(
            navigation.channelId,
            String(seed.c.cats.All[index]),
            "media checkpoints preserve the independent channel navigation identity"
        );
    }
    const cold = setup(provider);
    Object.assign(cold.c.stored, seed.c.stored);
    cold.c.commandChannelsReady = false;
    cold.c._playChannel(0, 1);
    cold.resolve();
    assert.equal(
        cold.c.calls.filter(([kind]) => kind === "play").at(-1)[2],
        positions[1],
        "startup resumes the selected file at its exact persisted position"
    );
    assert.equal(cold.c.calls.filter(([kind]) => kind === "confirm").length, 0);

    const kiosk = setup(provider);
    Object.assign(kiosk.c.stored, seed.c.stored);
    kiosk.c.commandChannelsReady = true;
    kiosk.c.__ottKiosk = {
        admit: (id) => id === 102,
        allowed: (id) => id === 102,
        allowedMedia: () => false,
        enabled: () => true,
        locked: () => true,
    };
    kiosk.c._playChannel(0, 1);
    kiosk.resolve();
    assert.equal(
        kiosk.c.calls.filter(([kind]) => kind === "play").at(-1)[2],
        positions[1],
        "kiosk recovery resumes its pinned file at the exact saved position"
    );
    assert.equal(
        kiosk.c.calls.filter(([kind]) => kind === "confirm").length,
        0
    );
    kiosk.end();
    kiosk.resolve();
    assert.equal(
        kiosk.c.calls.filter(([kind]) => kind === "play").at(-1)[2],
        0,
        "natural kiosk replay starts at zero instead of restoring position"
    );
    assert.equal(
        kiosk.c.calls.filter(([kind]) => kind === "confirm").length,
        0
    );

    const manual = setup(provider);
    Object.assign(manual.c.stored, seed.c.stored);
    manual.c.commandChannelsReady = true;
    let confirm;
    let prompts = 0;
    manual.c.confirmBox = (_message, yes) => {
        confirm = yes;
        prompts++;
    };
    manual.c._playChannel(0, 1);
    manual.resolve();
    assert.equal(prompts, 1, "ordinary selection retains Continue watching");
    confirm();
    assert.equal(
        manual.c.calls.filter(([kind]) => kind === "seek").at(-1)[1],
        manual.c.OttPlayCore.mediaResumePosition(positions[1], 60)
    );
    manual.c.__ottMedia.skip(1);
    manual.resolve();
    assert.equal(prompts, 1, "next file never opens a resume prompt");
    assert.equal(
        manual.c.calls.filter(([kind]) => kind === "play").at(-1)[2],
        0,
        "next file starts at zero despite its saved history"
    );
    manual.end();
    manual.resolve();
    assert.equal(prompts, 1, "natural completion never opens a resume prompt");
    assert.equal(
        manual.c.calls.filter(([kind]) => kind === "play").at(-1)[2],
        0
    );

    for (const natural of [true, false]) {
        const locked = setup(provider);
        Object.assign(locked.c.stored, seed.c.stored);
        locked.c.commandChannelsReady = false;
        locked.c._playChannel(0, 0);
        locked.resolve();
        locked.c.commandChannelsReady = true;
        locked.c.isListVisible = true;
        let unlock;
        locked.c.ifParentalAccessChId = (_id, next) => {
            unlock = next;
            return true;
        };
        const closes = locked.c.calls.filter(
            ([kind]) => kind === "close"
        ).length;
        if (natural) locked.end();
        else locked.c.__ottMedia.skip(1);
        assert.equal(locked.pending.length, 1, "PIN defers the next file");
        assert.equal(typeof unlock, "function");
        locked.c.ifParentalAccessChId = () => false;
        unlock();
        assert.equal(locked.pending.at(-1).item.id, 102);
        locked.resolve();
        assert.equal(
            locked.c.calls.filter(([kind]) => kind === "play").at(-1)[2],
            0,
            "PIN continuation preserves start-at-zero for the next file"
        );
        assert.equal(
            locked.c.calls.filter(([kind]) => kind === "confirm").length,
            0,
            "PIN continuation must not turn an advance into a resume prompt"
        );
        const after = locked.c.calls.filter(
            ([kind]) => kind === "close"
        ).length;
        if (natural)
            assert.equal(
                after,
                closes,
                "background advance keeps the list open after PIN"
            );
        else assert(after > closes, "arrow advance opens fullscreen after PIN");
    }
    console.log(
        "PASS " +
            provider +
            " exact startup resume, manual resume prompt, and fresh automatic/arrow playback"
    );
}

for (const provider of ["plex", "vportal"]) {
    const { c, resolve, end } = setup(provider);
    let clock = 1700000000000;
    c.Date = class extends Date {
        static now() {
            return clock;
        }
    };
    let position = 100;
    c.stbGetPosTime = () => position;
    const journal = () =>
        JSON.parse(c.stored["mediaJournal.v1:" + c.__ottMedia.sourceId()]);
    c._playChannel(0, 0);
    resolve();
    const first = c.__ottMedia.current().ref.itemId;
    const generation = c.__ottClassicPlayback.snapshot().generation;
    clock += 5001;
    c.__ottClassicPlayback.command({ position, type: "position" });
    assert.equal(journal().history[0].position, 100);
    position = 101;
    clock += 100;
    c.__ottClassicPlayback.command({ position, type: "position" });
    assert.equal(
        journal().history[0].position,
        100,
        "periodic writes are bounded"
    );
    c.__ottClassicPlayback.command({ type: "pause" });
    assert.equal(
        journal().history[0].position,
        101,
        "pause flushes the latest sample"
    );
    c.__ottClassicPlayback.command({ type: "resume" });
    position = 102;
    c.__ottClassicPlayback.command({ position, type: "position" });
    c.__ottClassicPlayback.command({ type: "stop" });
    assert.equal(
        journal().history[0].position,
        102,
        "stop flushes without waiting five seconds"
    );
    c._playChannel(0, 1);
    resolve();
    const beforeStale = c.stored["mediaJournal.v1:" + c.__ottMedia.sourceId()];
    c.__ottClassicPlayback.command({
        generation,
        position: 999,
        type: "position",
    });
    assert.equal(
        c.stored["mediaJournal.v1:" + c.__ottMedia.sourceId()],
        beforeStale
    );
    assert.equal(
        journal().history.find((item) => item.itemId === first).position,
        102
    );
    clock += 5001;
    c.__ottClassicPlayback.command({ position: 400, type: "position" });
    const second = c.__ottMedia.current().ref.itemId;
    end();
    assert.equal(
        journal().history.find((item) => item.itemId === second).position,
        0
    );
    console.log(
        "PASS " +
            provider +
            " bounded samples, forced flush, stale decoder and completion checkpoints"
    );
}

// Native/Browser Local sources use plain finite channels, without a media queue.
for (const mode of ["all", "one", "off"]) {
    const { c, end } = setup("offline");
    c.checkMedia = () => {};
    c.channels = Object.fromEntries(
        c.cats.All.map((id) => [id, { channel_name: "Local " + id }])
    );
    while (c.__ottMedia.repeatMode() !== mode) c.__ottMedia.cycleRepeat();
    c._playChannel(0, 2);
    const moves = [];
    c.playChannel = (...args) => moves.push(args);
    end();
    assert.equal(moves.length, mode === "off" ? 0 : 1);
    end();
    assert.equal(
        moves.length,
        mode === "off" ? 0 : 1,
        "duplicate EOF cannot advance twice"
    );
    if (moves.length) {
        assert.equal(moves[0][0], 0);
        assert.equal(moves[0][1], mode === "one" ? 2 : 0);
        assert.equal(
            moves[0][2],
            false,
            "natural completion keeps the list open"
        );
        assert.equal(moves[0][5], true);
        assert.equal(moves[0][6], true, "next Local file starts at zero");
        assert.equal(moves[0][3](), true, "current completion may start");
        c.__ottClassicPlayback.command({ channelId: 102, type: "live" });
        assert.equal(
            moves[0][3](),
            false,
            "late PIN completion cannot override a manual selection"
        );
    }
}
{
    const { c, end } = setup("offline");
    c.checkMedia = () => {};
    c.channels = Object.fromEntries(
        c.cats.All.map((id) => [id, { channel_name: "Local " + id }])
    );
    c._playChannel(0, 1);
    c.__ottKiosk = { allowed: (id) => id === 102, locked: () => true };
    const moves = [];
    c.playChannel = (...args) => moves.push(args);
    end();
    assert.equal(moves.length, 1);
    assert.equal(moves[0][1], 1, "pinned Local file loops itself");
}
console.log(
    "PASS Local finite-channel completion, repeat, kiosk and stale guards"
);
// Exercise the Local completion policy with a batch's ordered identities, not names.
for (const mode of ["off", "all", "one"]) {
    const { c, end } = setup("offline");
    c.parentalArray = [];
    c.__ottParental = { needs: () => false };
    const ids = ["local-z", "local-a", "local-m"];
    c.cats.All = ids.slice();
    c.curList = c.cList = c.cats.All;
    c.channels = Object.fromEntries(
        ids.map((id) => [id, { channel_name: "Same filename.mp4" }])
    );
    c.getChannelUrl = (id) => "file-" + id + ".mp4";
    c.checkMedia = () => {};
    while (c.__ottMedia.repeatMode() !== mode) c.__ottMedia.cycleRepeat();
    c._playChannel(0, 0);
    const played = () =>
        c.calls.filter(([kind]) => kind === "play").map((call) => call[1]);
    const expected = ["file-local-z.mp4"];
    for (let index = 0; index < ids.length; index++) {
        const generation = c.__ottClassicPlayback.snapshot().generation;
        end();
        if (mode === "one") expected.push("file-local-z.mp4");
        else if (index + 1 < ids.length || mode === "all")
            expected.push("file-" + ids[(index + 1) % ids.length] + ".mp4");
        assert.deepEqual(
            played(),
            expected,
            mode + " follows batch identity order"
        );
        c.__ottMedia.ended(generation);
        assert.deepEqual(
            played(),
            expected,
            "duplicate completion cannot skip a file"
        );
    }
    const state = c.__ottClassicPlayback.snapshot();
    assert.equal(state.phase, mode === "off" ? "stopped" : "playing");
    assert.equal(
        state.historyTarget.channelId,
        mode === "off" ? ids[2] : ids[0],
        "final stop, wrap and repeat retain the expected identity despite equal names"
    );
}
{
    const { c, end } = setup("offline");
    c.parentalArray = [];
    c.__ottParental = { needs: () => false };
    c.checkMedia = () => {};
    c.getChannelUrl = (id) => "file-" + id + ".mp4";
    c.channels = Object.fromEntries(
        c.cats.All.map((id) => [id, { channel_name: "Same filename.mp4" }])
    );
    c._playChannel(0, 0);
    const generation = c.__ottClassicPlayback.snapshot().generation;
    const pending = [];
    c.playChannel = (...args) => pending.push(args);
    end();
    assert.equal(pending.length, 1);
    assert.equal(pending[0][1], 1);
    assert.equal(pending[0][3](), true);

    // A replacement batch is a new playing generation even within Local.
    c.cats.All = ["local-new-z", "local-new-a", "local-new-m"];
    c.curList = c.cList = c.cats.All;
    c.channels = Object.fromEntries(
        c.cats.All.map((id) => [id, { channel_name: "Same filename.mp4" }])
    );
    c._playChannel(0, 0);
    const replacement = c.__ottClassicPlayback.snapshot();
    const plays = c.calls.filter(([kind]) => kind === "play").length;
    assert.notEqual(replacement.generation, generation);
    assert.equal(replacement.historyTarget.channelId, "local-new-z");
    assert.equal(
        pending[0][3](),
        false,
        "old delayed admission cannot enter a new batch"
    );
    for (let repeat = 0; repeat < 2; repeat++) c.__ottMedia.ended(generation);
    assert.equal(
        pending.length,
        1,
        "stale and duplicate EOF cannot enqueue into replacement"
    );
    assert.equal(c.calls.filter(([kind]) => kind === "play").length, plays);
    assert.equal(
        c.__ottClassicPlayback.snapshot().generation,
        replacement.generation
    );
    assert.equal(
        c.__ottClassicPlayback.snapshot().historyTarget.channelId,
        "local-new-z"
    );
    c.playChannel = c._playChannel;
    end();
    assert.equal(
        c.__ottClassicPlayback.snapshot().historyTarget.channelId,
        "local-new-a",
        "the replacement batch still advances on its own completion"
    );
}
console.log(
    "PASS Local batch identity order, repeat policy and replacement EOF isolation"
);
// Use the real library: numeric category positions can move during playback.
for (const action of [
    "move",
    "remove",
    "shuffle",
    "manual",
    "legacy",
    "unknown",
    "removed-channel",
]) {
    const c = fixture();
    c.p_pref = "offline";
    c.__ottActiveProviderDriver = { id: "offline" };
    c.channels = {
        101: { category: { name: "A" }, channel_name: "A1" },
        102: { category: { name: "A" }, channel_name: "A2" },
        103: { category: { name: "B" }, channel_name: "B1" },
    };
    c.cList = [101, 102, 103];
    c.__ottChannels.mount(c);
    c.__ottChannels.change("member", {
        action: "add",
        channelId: 101,
        groupId: "provider:B",
    });
    if (c.__ottChannels.index("provider:A") !== 1)
        assert(c.__ottChannels.change("move", "provider:A", -1));
    c.__ottParental = { needs: () => false };
    c.ifParentalAccessChId = () => false;
    c.getChannelUrl = (id) => "file-" + id + ".mp4";
    c.checkMedia = () => {};
    c.playChannel = c._playChannel;
    const category = c.__ottChannels.index("provider:A");
    assert.equal(category, 1);
    c._playChannel(category, 0);
    const capturedGroup = JSON.parse(
        JSON.stringify(c.__ottClassicPlayback.snapshot())
    ).historyTarget.payload.groupId;
    if (action === "move")
        assert(c.__ottChannels.change("move", "provider:A", 1));
    if (action === "remove")
        assert(c.__ottChannels.change("remove", "provider:A"));
    if (action === "move") {
        c.__ottClassicPlayback.checkpoint(
            c.__ottClassicPlayback.snapshot(),
            true
        );
        const journal = JSON.parse(c.stored.playbackJournal);
        assert.equal(
            journal.bookmark.groupId,
            "provider:A",
            "checkpoint retains group after reorder"
        );
    }
    if (action === "shuffle") {
        vm.runInContext("Math.random = function () { return 0; };", c);
        assert(c.__ottChannels.change("shuffle", "provider:A"));
    }
    c.__ottClassicPlayback.command({ type: "stop" });
    const generation = c.__ottClassicPlayback.snapshot().generation;
    if (action === "manual")
        c._playChannel(c.__ottChannels.index("provider:B"), 0);
    if (action === "removed-channel") delete c.channels[101];
    if (action === "legacy" || action === "unknown") {
        const snapshot = c.__ottClassicPlayback.snapshot;
        c.__ottClassicPlayback.snapshot = () => {
            const state = JSON.parse(JSON.stringify(snapshot()));
            if (action === "legacy") delete state.historyTarget.payload.groupId;
            else state.historyTarget.payload.groupId = "removed:unknown";
            return state;
        };
    }
    const programme = c.__ottClassicPlayback.programme();
    if (action === "removed-channel") assert.equal(programme, null);
    else if (action !== "manual") {
        assert.equal(
            programme.title,
            "A1",
            action + " retains the current file"
        );
        assert.equal(
            programme.collection,
            "A",
            action + " retains the containing folder"
        );
        assert.equal(
            programme.nextTitle,
            action === "move" || action === "shuffle" ? "A2" : "",
            action + " never guesses a successor from another group"
        );
    }
    const before = c.calls.filter(([kind]) => kind === "play").length;
    c.__ottMedia.ended(generation);
    const plays = c.calls.filter(([kind]) => kind === "play");
    if (action === "move" || action === "shuffle") {
        assert.equal(plays.length, before + 1);
        assert.equal(
            plays[plays.length - 1][1],
            "file-102.mp4",
            action + " retains the playing group instead of its old index"
        );
    } else {
        assert.equal(
            plays.length,
            before,
            action + " cannot redirect the completed group's playback"
        );
    }
    c.__ottMedia.ended(generation);
    assert.equal(
        c.calls.filter(([kind]) => kind === "play").length,
        plays.length,
        "duplicate EOF remains stale after " + action
    );
    assert.equal(
        capturedGroup,
        "provider:A",
        "Local playback captures serializable group identity at start"
    );
    if (action === "move") {
        const journal = JSON.parse(c.stored.playbackJournal);
        assert.equal(
            journal.history.find((entry) => entry.channelId === "101").groupId,
            "provider:A",
            "history serialization retains departing group"
        );
        c.__ottClassicPlayback.hydrate();
        const previous = c.prevArr.find((entry) => String(entry.ci) === "101");
        assert.equal(
            previous.groupId,
            "provider:A",
            "hydration preserves stable group on previous entry"
        );
        assert(c.__ottChannels.change("move", "provider:A", -1));
        vm.runInContext(
            sourceFunctions("src/key-handler/index.ts", ["onPrevSelect"]),
            c
        );
        c.onPrevSelect(c.prevArr.indexOf(previous));
        assert.equal(
            c.catIndex,
            c.__ottChannels.index("provider:A"),
            "manual previous uses stable group after another reorder"
        );
        assert.equal(c.curList[c.primaryIndex], 101);
    }
}
console.log("PASS Local EOF retains group identity across library edits");
{
    const { c, end } = setup("offline");
    c.checkMedia = () => {};
    c.channels = Object.fromEntries(
        c.cats.All.map((id) => [id, { channel_name: "Local " + id }])
    );
    c.sStopPlay = 1;
    c.parentalArray = [];
    c.__ottParental = { needs: () => false };
    const backend = c.__ottMediaBackend.create({
        clearInterval() {},
        context: () => {
            const state = c.__ottClassicPlayback.snapshot();
            return state.target
                ? { ...state.target, generation: state.generation }
                : null;
        },
        emit(context, type, position, duration, sourceStop) {
            c.__ottClassicPlayback.command({
                duration,
                generation: context.generation,
                position,
                sourceStop,
                type,
            });
        },
        open() {
            return {
                dispose() {},
                pause() {},
                resume() {},
                sample: () => ({
                    duration: 100,
                    paused: false,
                    position: 0,
                    ready: 3,
                }),
                seek() {},
            };
        },
        setInterval: () => 1,
    });
    let stops = 0;
    const stop = backend.stop;
    backend.stop = (...args) => {
        stops++;
        return stop(...args);
    };
    c.getCoreMediaBackend = () => backend;
    vm.runInContext(
        sourceFunctions("src/core/index.ts", ["stopCoreForSelection"]),
        c
    );
    c.__ottCoreTransport = { stopForSelection: c.stopCoreForSelection };
    assert.equal(c.settings.stopPlay, 1);
    c._playChannel(0, 0);
    assert.equal(stops, 1, "manual selection performs its real owned Stop");
    const before = stops;
    end();
    assert.equal(
        stops,
        before,
        "EOF does not redundantly stop the retired decoder"
    );
    assert.equal(
        c.primaryIndex,
        1,
        "real channel transition survives stop-before-play"
    );
    assert.equal(c.__ottClassicPlayback.snapshot().phase, "playing");
}

// Footer is an observation of the playing source, never the open browser view.
{
    const { c, resolve } = setup("plex");
    c.channels[101].__ottMediaCollection = "Selected collection";
    c._playChannel(0, 0);
    resolve();
    let programme = c.__ottClassicPlayback.programme();
    assert.equal(programme.collection, "Selected collection");
    assert.equal(programme.title, "Film 101");
    assert.equal(programme.nextTitle, "Film 102");
    c.cats.All = [101, 103, 102];
    assert.equal(
        c.__ottClassicPlayback.programme().nextTitle,
        "Film 103",
        "shuffle uses the live list"
    );
    c.__ottMedia.cycleRepeat();
    assert.equal(
        c.__ottClassicPlayback.programme().nextTitle,
        "Film 101",
        "repeat one projects itself"
    );
    c.__ottMedia.cycleRepeat();
    c.cats.All = [102, 103, 101];
    assert.equal(
        c.__ottClassicPlayback.programme().nextTitle,
        "",
        "repeat off has no next item at the end"
    );
}
{
    const { c } = setup("offline");
    c.checkMedia = () => {};
    c.channels = Object.fromEntries(
        c.cats.All.map((id) => [
            id,
            {
                __ottMediaCollection: "Actual nested folder",
                channel_name: "Local " + id,
            },
        ])
    );
    let clock = 1000000;
    c.Date = class extends Date {
        static now() {
            return clock;
        }
    };
    c._playChannel(0, 0);
    c.__ottClassicPlayback.command({
        duration: 17.25,
        position: 2,
        type: "position",
    });
    let programme = c.__ottClassicPlayback.programme();
    assert.equal(programme.collection, "Actual nested folder");
    assert.equal(programme.title, "Local 101");
    assert.equal(programme.nextTitle, "Local 102");
    assert.equal(programme.startedAt, 1000);
    assert.equal(
        programme.nextStartedAt,
        1017.25,
        "uses full precise duration"
    );
    clock += 5000;
    c.__ottClassicPlayback.command({ type: "pause" });
    c.__ottClassicPlayback.command({ position: 12, type: "position" });
    c.__ottClassicPlayback.command({ type: "playing" });
    assert.equal(
        c.__ottClassicPlayback.programme().startedAt,
        1000,
        "pause, seek and recovery do not shift the clock"
    );
    const oldGeneration = c.__ottClassicPlayback.snapshot().generation;
    c.__ottClassicPlayback.command({ channelId: 101, type: "live" });
    c.__ottClassicPlayback.command({
        generation: oldGeneration,
        type: "playing",
    });
    assert.equal(
        c.__ottClassicPlayback.programme().startedAt,
        null,
        "stale playing cannot stamp a new file"
    );
    c.__ottClassicPlayback.command({ type: "playing" });
    assert.equal(c.__ottClassicPlayback.programme().startedAt, 1005);
    c._playChannel(0, 0);
    assert.equal(
        c.__ottClassicPlayback.programme().startedAt,
        1005,
        "a real restart of same file owns a new start clock"
    );
    assert.equal(
        c.__ottClassicPlayback.programme().nextStartedAt,
        null,
        "unknown new duration has no invented next clock"
    );
    c.primaryIndex = 1;
    c.__ottClassicPlayback.reconcile();
    assert.equal(
        c.__ottClassicPlayback.programme().startedAt,
        null,
        "reconciled source selection cannot inherit another file start clock"
    );
    c.__ottClassicPlayback.command({ type: "playing" });
    c.__ottKiosk = { allowed: () => true, locked: () => true };
    assert.equal(
        c.__ottClassicPlayback.programme().nextTitle,
        "",
        "legacy reconciliation without a captured group cannot guess a kiosk successor"
    );
}
console.log(
    "PASS finite programme collection, next-item ownership and anchored start clock"
);
{
    const { c, resolve } = setup("vportal");
    c.__ottClassicPlayback.reconcile();
    c.__ottMedia.playQueue(
        [
            { id: 201, request: { id: 201 }, title: "Queue first" },
            { id: 202, request: { id: 202 }, title: "Queue second" },
        ],
        "Remote collection",
        () => true,
        () => {}
    );
    resolve();
    const programme = c.__ottClassicPlayback.programme();
    assert.equal(programme.collection, "Remote collection");
    assert.equal(programme.title, "Queue first");
    assert.equal(
        programme.nextTitle,
        "Queue second",
        "remote queue uses its own successor, not channel list"
    );
    c.__ottMedia.open("", "Unrelated browser folder");
    assert.equal(
        c.__ottClassicPlayback.programme().collection,
        "Remote collection",
        "browsing cannot rename playing collection"
    );
}
{
    const { c, resolve } = setup("vportal");
    c.__ottClassicPlayback.reconcile();
    c.__ottMedia.playQueue(
        [
            {
                __ottMediaLabel: { key: "Untitled", value: "Untitled" },
                id: 301,
                request: { id: 301 },
                title: "Untitled",
            },
            {
                __ottMediaLabel: { key: "Untitled", value: "Untitled" },
                id: 302,
                request: { id: 302 },
                title: "Untitled",
            },
            { id: 303, request: { id: 303 }, title: "User filename.mp4" },
        ],
        "Collection",
        () => true,
        () => {}
    );
    resolve();
    c._ = (value) => (value === "Untitled" ? "Translated untitled" : value);
    let programme = c.__ottClassicPlayback.programme();
    assert.equal(programme.title, "Translated untitled");
    assert.equal(programme.nextTitle, "Translated untitled");
    c.__ottClassicPlayback.command({ type: "stop" });
    c.__ottMedia.ended(c.__ottClassicPlayback.snapshot().generation);
    resolve();
    programme = c.__ottClassicPlayback.programme();
    assert.equal(programme.title, "Translated untitled");
    assert.equal(
        programme.nextTitle,
        "User filename.mp4",
        "user supplied names are not translated"
    );
}
{
    const { c, end } = setup("offline");
    c.checkMedia = () => {};
    c.channels = Object.fromEntries(
        c.cats.All.map((id) => [id, { channel_name: "Local " + id }])
    );
    c._playChannel(0, 2);
    c.__ottKiosk = {
        allowed: (id) => id === 101 || id === 103,
        folderLoop: () => true,
        folderNext: (id) => (id === 103 ? 101 : 103),
        locked: () => true,
    };
    const moves = [];
    c.playChannel = (...args) => moves.push(args);
    end();
    assert.equal(moves.length, 1);
    assert.equal(moves[0][1], 0, "folder kiosk wraps from last file to first");
    assert.equal(moves[0][5], true);
    assert.equal(moves[0][6], true, "folder successor starts at zero");
}
console.log(
    "PASS Local folder kiosk natural completion wraps within the folder"
);
for (const folder of [false, true]) {
    const { c, end } = setup("offline");
    c.checkMedia = () => {};
    c.channels = Object.fromEntries(
        c.cats.All.map((id) => [id, { channel_name: "Local " + id }])
    );
    c._playChannel(0, 0);
    let asleep = true,
        deferred;
    c.__ottKiosk = {
        allowed: () => true,
        deferScreenEnd: (fn) => {
            deferred = fn;
        },
        folderLoop: () => folder,
        folderNext: () => 103,
        locked: () => folder,
        screenBlocked: () => asleep,
    };
    const moves = [];
    c.playChannel = (...args) => moves.push(args);
    end();
    assert.equal(
        moves.length,
        0,
        "screen-off EOF never opens another local file"
    );
    assert.equal(typeof deferred, "function");
    asleep = false;
    deferred();
    assert.equal(moves.length, 1, "wake advances deferred completion once");
    assert.equal(moves[0][1], folder ? 2 : 1);
    c.__ottMedia.ended(c.__ottClassicPlayback.snapshot().generation);
    assert.equal(moves.length, 1, "duplicate EOF cannot advance twice");
}
{
    const { c, end } = setup("offline");
    c.checkMedia = () => {};
    c.channels = Object.fromEntries(
        c.cats.All.map((id) => [id, { channel_name: "Local " + id }])
    );
    c._playChannel(0, 0);
    let asleep = false,
        deferred;
    c.__ottKiosk = {
        allowed: () => true,
        deferScreenEnd: (fn) => {
            deferred = fn;
        },
        locked: () => false,
        screenBlocked: () => asleep,
    };
    const moves = [];
    c.playChannel = (...args) => moves.push(args);
    end();
    assert.equal(moves.length, 1);
    asleep = true;
    assert.equal(
        moves[0][3](),
        false,
        "late async local admission blocked by screen off"
    );
    asleep = false;
    deferred();
    assert.equal(moves.length, 2);
    assert.equal(moves[1][3](), true, "wake retries the retired admission");
}
console.log(
    "PASS local EOF and delayed admission wait for screen wake with or without kiosk"
);
{
    const { c, end } = setup("offline");
    c.checkMedia = () => {};
    c.channels = Object.fromEntries(
        c.cats.All.map((id) => [id, { channel_name: "Local " + id }])
    );
    c._playChannel(0, 0);
    let asleep = true,
        deferred;
    c.__ottKiosk = {
        allowed: () => true,
        deferScreenEnd: (fn) => {
            deferred = fn;
        },
        locked: () => false,
        screenBlocked: () => asleep,
    };
    const moves = [];
    c.playChannel = (...args) => moves.push(args);
    end();
    c.__ottMedia.cancelAuto();
    asleep = false;
    deferred();
    assert.equal(
        moves.length,
        0,
        "cancelled EOF must not replace a newer navigation on wake"
    );
}
{
    const { c } = setup("offline");
    c.checkMedia = () => {};
    c.channels = Object.fromEntries(
        c.cats.All.map((id) => [id, { channel_name: "Local " + id }])
    );
    c._playChannel(0, 0);
    c.__ottKiosk = {
        allowed: (id) => id !== 102,
        folderLoop: () => true,
        folderNext: () => 103,
        locked: () => true,
    };
    c.__ottMedia.cycleRepeat();
    assert.equal(
        c.__ottClassicPlayback.programme().nextTitle,
        "Local 103",
        "folder footer skips unrelated file even with Repeat One saved"
    );
}

// A discovery choice is admitted without inserting metadata into live channels.
for (const mode of ["play", "cancel", "guard", "kiosk", "missing"]) {
    const { c, pending, resolve } = setup("torrent");
    let active = true,
        started = 0,
        failed = 0;
    c.__ottKiosk = {
        allowedMedia: () => mode !== "kiosk",
        enabled: () => mode === "kiosk",
    };
    const before = JSON.stringify(c.channels);
    const cancel = c.__ottMedia.playItem(
        {
            id: "discovery-film",
            request: {
                kind: "torrent-discovery",
                movieId: "imdb:movie:tt1254207",
                sourceId: "selected",
            },
            title: "Film",
        },
        () => active,
        () => started++,
        () => failed++
    );
    if (mode === "kiosk") {
        assert.equal(pending.length, 0);
        assert.equal(failed, 1);
        continue;
    }
    assert.equal(pending.length, 1);
    assert.equal(pending[0].item.__ottVPortalQueue, undefined);
    if (mode === "cancel") cancel();
    if (mode === "guard") active = false;
    if (mode === "missing") pending[0].done(null);
    else resolve();
    assert.equal(started, mode === "play" ? 1 : 0, mode);
    assert.equal(failed, mode === "missing" ? 1 : 0, mode);
    assert.equal(JSON.stringify(c.channels), before);
}
console.log(
    "PASS single discovery item admission, cancellation, guards and unavailable source"
);

for (const action of [
    "append",
    "complete",
    "pause",
    "seek",
    "stop",
    "replace",
]) {
    const { c, end } = setup("offline");
    c.parentalArray = [];
    c.__ottParental = { needs: () => false };
    c.checkMedia = () => {};
    c.cats.All = [101];
    c.curList = c.cList = c.cats.All;
    c.channels = { 101: { __ottLocalSource: "folder", channel_name: "first" } };
    c.getChannelUrl = (id) => "file-" + id + ".mp4";
    while (c.__ottMedia.repeatMode() !== "off") c.__ottMedia.cycleRepeat();
    let resume,
        pending = true;
    c.__ottLocalMedia = {
        cancelQueueEnd() {
            resume = null;
        },
        deferQueueEnd(source, callback) {
            assert.equal(source, "folder");
            if (!pending) return false;
            resume = callback;
            return true;
        },
    };
    c._playChannel(0, 0);
    const moves = [];
    c.playChannel = (...args) => moves.push(args);
    end();
    assert.equal(moves.length, 0, action + " waits at an incomplete queue end");
    assert.equal(typeof resume, "function");
    if (["pause", "stop"].includes(action))
        c.__ottClassicPlayback.command({ type: action });
    if (action === "seek") c.__ottClassicPlayback.beforeSeek(1);
    if (action === "replace")
        c.__ottClassicPlayback.command({ channelId: 102, type: "live" });
    if (action !== "complete") {
        c.cats.All.push(102);
        c.channels[102] = {
            __ottLocalSource: "folder",
            channel_name: "second",
        };
    }
    pending = false;
    if (resume) resume();
    assert.equal(
        moves.length,
        action === "append" ? 1 : 0,
        action + " respects EOF ownership"
    );
    if (moves.length) assert.equal(moves[0][1], 1);
}
console.log(
    "PASS partial Local queue EOF waits for append and respects cancelled playback intent"
);

// Load the real policy: a folder lock allows every member, including the
// current item, and therefore must not be mistaken for a single-file pin.
const kioskPolicyCode = [
    ["src/plugins/kiosk-video-progress.ts", "createKioskVideoProgress"],
    ["src/plugins/strict-kiosk-input.ts", "createStrictKioskInput"],
    ["src/plugins/kiosk.ts", "createKiosk"],
]
    .map(([file, name]) => sourceFunctions(file, [name]))
    .join("\n");
function restoreLocalKiosk(c, folder) {
    vm.runInContext(kioskPolicyCode, c);
    const saved = {
        __ottKioskV1: JSON.stringify({
            channel: { id: "101", name: "first" },
            ...(folder ? { folder: { id: "folder", name: "Folder" } } : {}),
            provider: "offline",
            source: c.__ottSourceIdentity.current(c),
            strict: true,
        }),
    };
    c.stbGetItem = (key) => saved[key];
    c.stbSetItem = (key, value) => (saved[key] = value);
    c.__ottKiosk = c.createKiosk(c);
    c.__ottKiosk.init();
    assert.equal(c.__ottKiosk.locked(), true);
    assert.equal(c.__ottKiosk.allowed(101), true);
    assert.equal(c.__ottKiosk.folderLoop(), folder);
}
for (const repeat of ["off", "all", "one"]) {
    for (const action of [
        "append",
        "complete",
        "pause",
        "seek",
        "stop",
        "replace",
    ]) {
        const { c, end } = setup("offline");
        c.parentalArray = [];
        c.__ottParental = { needs: () => false };
        c.checkMedia = () => {};
        c.cats.All = [101, 102];
        c.curList = c.cList = c.cats.All;
        c.channels = {
            101: { __ottLocalSource: "folder", channel_name: "first" },
            102: { __ottLocalSource: "other", channel_name: "unrelated" },
        };
        c.getChannelUrl = (id) => "file-" + id + ".mp4";
        while (c.__ottMedia.repeatMode() !== repeat) c.__ottMedia.cycleRepeat();
        restoreLocalKiosk(c, true);
        assert.equal(c.__ottKiosk.allowed(102), false);
        let resume,
            pending = true;
        c.__ottLocalMedia = {
            cancelQueueEnd() {
                resume = null;
            },
            deferQueueEnd(source, callback) {
                assert.equal(source, "folder");
                if (!pending) return false;
                resume = callback;
                return true;
            },
        };
        c._playChannel(0, 0);
        const moves = [];
        c.playChannel = (...args) => moves.push(args);
        end();
        assert.equal(
            moves.length,
            0,
            repeat + ": folder lock waits before wrapping an incomplete scan"
        );
        assert.equal(typeof resume, "function");
        // An unrelated append must leave the folder's pending EOF deferred.
        c.cats.All.push(103);
        c.channels[103] = {
            __ottLocalSource: "other",
            channel_name: "unrelated append",
        };
        resume();
        assert.equal(moves.length, 0);
        if (["pause", "stop"].includes(action))
            c.__ottClassicPlayback.command({ type: action });
        if (action === "seek") c.__ottClassicPlayback.beforeSeek(1);
        if (action === "replace")
            c.__ottClassicPlayback.command({ channelId: 102, type: "live" });
        if (action !== "complete") {
            c.cats.All.push(104);
            c.channels[104] = {
                __ottLocalSource: "folder",
                channel_name: "second",
            };
        }
        pending = false;
        if (resume) resume();
        assert.equal(
            moves.length,
            ["append", "complete"].includes(action) ? 1 : 0,
            repeat + ": " + action + " respects folder EOF ownership"
        );
        if (moves.length) {
            assert.equal(moves[0][1], action === "append" ? 3 : 0);
            assert.equal(moves[0][5], true);
            assert.equal(moves[0][6], true);
            c.__ottMedia.ended(c.__ottClassicPlayback.snapshot().generation);
            assert.equal(moves.length, 1, "duplicate EOF cannot advance again");
        }
    }
}
{
    const { c, end } = setup("offline");
    c.parentalArray = [];
    c.__ottParental = { needs: () => false };
    c.checkMedia = () => {};
    c.channels = {
        101: { __ottLocalSource: "folder", channel_name: "first" },
    };
    c.getChannelUrl = (id) => "file-" + id + ".mp4";
    restoreLocalKiosk(c, false);
    c.__ottLocalMedia = {
        deferQueueEnd() {
            assert.fail("single-file pin must replay without waiting for scan");
        },
    };
    c._playChannel(0, 0);
    const moves = [];
    c.playChannel = (...args) => moves.push(args);
    end();
    assert.equal(moves.length, 1);
    assert.equal(moves[0][1], 0);
}
console.log(
    "PASS real folder kiosk EOF waits across repeat modes and keeps single-file pin behavior"
);
