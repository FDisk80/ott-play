/* The retired server library must not be discovered, mounted, or migrated. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const { fixture, sourceFunctions } = require("./test_port_vod.cjs");
const root = path.resolve(__dirname, "..");

function setup() {
    const c = fixture();
    const requests = [];
    c.location = { host: "player.test", protocol: "https:" };
    c.$.ajax = (options) => {
        requests.push(options);
        return { abort() {} };
    };
    vm.runInContext(
        ts
            .transpileModule(
                fs.readFileSync(
                    path.join(root, "src/plugins/vportal.ts"),
                    "utf8"
                ),
                {
                    compilerOptions: {
                        module: ts.ModuleKind.ES2015,
                        target: ts.ScriptTarget.ES5,
                    },
                }
            )
            .outputText.replace(/^import .*$/gm, "")
            .replace(/^export /gm, ""),
        c
    );
    return { c, requests };
}

test("actual startup no longer discovers a server library or changes saved profiles", () => {
    const { c, requests } = setup();
    const calls = [];
    const unchanged = {
        "installation:mediaJournal.v1:synology:old-library":
            '{"favorites":[{"title":"Saved"}]}',
        m3um3uArr: '{"active":0,"M3Us":[]}',
        plexprofiles: '{"active":0,"servers":[]}',
        vportalprofiles:
            '{"active":0,"portals":[{"name":"Personal portal","link":"portal::[key:fixture]https://portal.test/api"}]}',
    };
    Object.assign(c.stored, unchanged);
    Object.assign(c, {
        __ottCommandServer: { configure() {} },
        __ottControlDiscovery: { start() {} },
        __ottKiosk: { init() {} },
        __ottLocalHttpRemote: { init() {} },
        __ottRemoteDiagnostics: {},
        __ottRemoteNotifications: { setEnabled() {} },
        __ottStandby: { blocked: () => false, ready: (run) => run() },
        installLocalMedia: () => calls.push("local"),
        installMediaCompanion: () => calls.push("companion"),
        installSettingsFacade() {},
        loadSettings() {},
        loadStartupLanguage: () => calls.push("provider-startup"),
        popupActions: [],
        popupArray: [],
        popupDetail: [],
        readNotificationsEnabled: () => true,
        savedPopup: { popupActions: [] },
        settings: {},
        startupError(_element, _stage, error) {
            throw error;
        },
        TMDb: null,
        version: "fixture",
    });
    for (const name of [
        "initUIReferences",
        "setTimezone",
        "setFontSize",
        "setListPos",
        "setColor",
        "setEditor",
        "setPipPosBuf",
        "setSleepTimeout",
        "closeList",
    ])
        c[name] = () => {};
    vm.runInContext(sourceFunctions("src/index.ts", ["onStbReady"]), c);
    c.onStbReady();
    assert.deepEqual(calls, ["local", "companion", "provider-startup"]);
    assert.deepEqual(
        requests,
        [],
        "Startup must not request the removed /nas/config endpoint"
    );
    assert.equal(c.__ottNasLibrary, undefined);
    assert.equal(c.popNasMedia, undefined);
    assert.deepEqual(c.stored, unchanged);
});

test("actual menu ignores retired library globals and retains ordinary media navigation", () => {
    const { c, requests } = setup();
    c.popupActions = [];
    c.popupArray = [];
    c.popupDetail = [];
    c.__ottNasLibrary = {
        available: () => true,
        title: () => "Obsolete library",
    };
    c.popNasMedia = () =>
        assert.fail("Removed integration must not be invoked");
    assert.deepEqual(Array.from(c.__ottMenuRegistry.open(c).rows), []);
    let opens = 0;
    c.popMedia = () => opens++;
    c.getMediaArray = () => {};
    c.popupActions = [c.popMedia];
    c.popupArray = ["Show Media Library"];
    c.sHideMenus = ["media.nas"];
    const menu = c.__ottMenuRegistry.open(c);
    assert.deepEqual(
        Array.from(menu.rows, (row) => row.id),
        ["media.open"]
    );
    menu.invoke("media.open");
    assert.equal(opens, 1);
    assert.deepEqual(requests, []);
    assert.deepEqual(
        c.sHideMenus,
        ["media.nas"],
        "Retired preferences are inert, not rewritten"
    );
});

test("the removed keyless transport cannot bypass a normal VPortal profile", () => {
    const { c, requests } = setup();
    assert.equal(
        c.createVPortalClient("", { directEndpoint: "/nas/api" }),
        null
    );
    assert.deepEqual(requests, []);
    const client = c.createVPortalClient(
        "portal::[key:fixture-key]https://portal.test/api",
        {
            sourceId: "vportal:personal",
        }
    );
    let completed = 0;
    client.load(null, () => completed++);
    assert.equal(requests.length, 1);
    assert.equal(
        requests[0].url,
        (c.host || "").replace(/\/$/, "") + "/vportal/api"
    );
    assert.equal(JSON.parse(requests[0].data).params.key, "fixture-key");
    client.stop("https://media.test/film.mp4");
    assert.equal(
        requests.length,
        1,
        "Stopping ordinary VPortal must not send a NAS release request"
    );
    requests[0].success({
        items: [
            {
                request: { cmd: "play", id: "film:1" },
                title: "Personal film",
                type: "stream",
            },
        ],
        type: "videoportal",
    });
    requests[0].complete();
    assert.equal(completed, 1);
    assert.equal(c.mediaRecords[0].title, "Personal film");
    client.dispose();
});
