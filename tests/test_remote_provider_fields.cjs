"use strict";
const assert = require("node:assert/strict");
const { fixture } = require("./helpers/provider-driver-fixture.cjs");
const privateRuntime = require("./helpers/private-runtime.cjs");
const clone = (value) => JSON.parse(JSON.stringify(value));
let passed = 0;
function test(name, run) {
    run();
    passed++;
    console.log("PASS provider fields: " + name);
}
function setup(id, storage = {}) {
    const f = fixture(storage),
        driver = f.mount(id);
    privateRuntime(f.host, "src/plugins/remote-provider-fields.ts");
    const api = f.host.__ottRemoteProviderFields.create(f.host, driver);
    return {
        ...f,
        api,
        driver,
        set(name, value) {
            return api.save(
                name,
                value,
                api.capture(name),
                () => f.host.__ottActiveProviderDriver === driver
            );
        },
    };
}
test("real M3U codec preserves other slots and applies media configuration", () => {
    const f = setup("m3u", {
        m3um3uArr: JSON.stringify({
            active: 0,
            M3Us: [
                { name: "Home", rechours: 48, www: "https://playlist.test/a" },
                { name: "Other", rechours: 0, www: "https://other.test/b" },
            ],
        }),
    });
    assert(f.api.schema.some((row) => row.id === "m3uMediaUrl"));
    assert.equal(f.set("m3uHistoryHours", 72).capture.value, 72);
    assert.equal(f.set("providerName", "New Home").capture.value, "New Home");
    const saved = JSON.parse(f.saved.get("m3um3uArr"));
    assert.equal(saved.M3Us[1].name, "Other");
    assert.equal(saved.M3Us[0].rechours, 72);
    assert.equal(f.reloads, 0);
});
test("real Plex codec retains folders when only changing mode", () => {
    const folders = [{ path: "/library/sections/2/all", title: "Films" }];
    const f = setup("plex", {
        plexcfg: JSON.stringify({
            address: "https://plex.test",
            folders,
            playback: "auto",
            token: "private-token",
        }),
    });
    const result = f.set("plexPlayback", "compatible");
    assert.equal(result.capture.value, "compatible");
    const saved = JSON.parse(f.saved.get("plexcfg"));
    assert.deepEqual(saved.folders, folders);
    assert.equal(saved.token, "private-token");
    assert.equal(f.requests.length, 0);
});
test("Plex server replacement clears old folder roots and rejects their prior receipt", () => {
    const folders = [
        { path: "/library/sections/2/all", title: "Old server films" },
    ];
    const f = setup("plex", {
        plexcfg: JSON.stringify({
            address: "https://old-plex.test",
            folderSelection: true,
            folders,
            playback: "auto",
            token: "private-token",
        }),
    });
    const old = f.api.folderSnapshot();
    f.set("providerPassword", "replacement-token");
    assert.deepEqual(JSON.parse(f.saved.get("plexcfg")).folders, folders);
    f.set("providerServer", "https://old-plex.test/");
    assert.deepEqual(JSON.parse(f.saved.get("plexcfg")).folders, folders);
    f.set("providerServer", "https://new-plex.test/");
    assert.equal(
        JSON.parse(f.saved.get("plexcfg")).address,
        "https://new-plex.test"
    );
    assert.deepEqual(clone(f.api.folderSnapshot().items), []);
    assert.equal(JSON.parse(f.saved.get("plexcfg")).folderSelection, undefined);
    assert.equal(old.capture.current(), false);
    assert.throws(
        () => f.api.saveFolders(folders, old.capture, () => true),
        /revision_conflict/
    );
    assert.equal(f.requests.length, 0);
});
test("legacy Plex roots are inactive until explicit selection saves atomically", () => {
    const folders = [
        { path: "/library/sections/2/all", title: "Legacy films" },
    ];
    const original = JSON.stringify({
        address: "https://plex.test",
        folders,
        playback: "auto",
        token: "private-token",
    });
    const f = setup("plex", { plexcfg: original });
    assert.deepEqual(clone(f.api.folderSnapshot().items), []);
    assert.equal(f.saved.get("plexcfg"), original);
    const write = f.host.stbSetItem;
    f.host.stbSetItem = () => {};
    const failed = f.host.__ottRemoteProviderFields.create(f.host, f.driver);
    const before = failed.folderSnapshot().capture;
    assert.throws(
        () => failed.saveFolders(folders, before, () => true),
        /storage_failed/
    );
    assert.equal(f.saved.get("plexcfg"), original);
    f.host.stbSetItem = write;
    f.api.saveFolders(folders, f.api.folderSnapshot().capture, () => true);
    assert.equal(JSON.parse(f.saved.get("plexcfg")).folderSelection, true);
    assert.deepEqual(clone(f.api.folderSnapshot().items), folders);
    f.set("plexPlayback", "compatible");
    assert.equal(JSON.parse(f.saved.get("plexcfg")).folderSelection, true);
    f.api.saveFolders([], f.api.folderSnapshot().capture, () => true);
    assert.deepEqual(clone(f.api.folderSnapshot().items), []);
    assert.equal(JSON.parse(f.saved.get("plexcfg")).folderSelection, true);
});
test("real Edem transaction changes one key and confirms actual storage", () => {
    const f = setup("edem", {
        ededcdn: "cdn.example.test",
        edkey: "private",
        edlist: "0",
        edvpurl: "",
    });
    assert.equal(f.set("edemList", 3).capture.value, 3);
    assert.equal(f.saved.get("edlist"), "3");
    assert.equal(f.saved.get("edkey"), "private");
    assert.equal(
        f.api.schema.some((row) => row.id === "edemCdn"),
        false,
        "the stream endpoint is owned by player code, not remote settings"
    );
    assert.equal(f.requests.length, 0);
    assert.equal(f.set("edemList", 3).capture.value, 3);
});
test("current typed credentials cover named, catalog and generic provider codecs", () => {
    for (const [id, storage, name, value, key, expected] of [
        [
            "xtream",
            {
                xtreamxtream_data: JSON.stringify({
                    password: "b",
                    server: "https://xc.test",
                    username: "a",
                }),
            },
            "providerUsername",
            "new",
            "xtreamxtream_data",
            null,
        ],
        [
            "only4",
            { o4token: "token", o4ts_hls: "0" },
            "providerMode",
            2,
            "o4ts_hls",
            "2",
        ],
        [
            "ottclub",
            { ottkey: "key", ottwww: "ott.example" },
            "providerUsername",
            "new",
            "ottkey",
            "new",
        ],
        [
            "antifriz",
            { azkey: "12345678", azmpeg: "0" },
            "providerMode",
            1,
            "azmpeg",
            "1",
        ],
        [
            "all4you",
            {
                all4youcfg: JSON.stringify({
                    m3u: "",
                    pass: "p",
                    server: "https://all.test",
                    user: "u",
                }),
            },
            "providerUsername",
            "new",
            "all4youcfg",
            null,
        ],
    ]) {
        const f = setup(id, storage);
        assert(f.api, id);
        assert.equal(f.set(name, value).capture.value, value, id);
        if (expected !== null) assert.equal(f.saved.get(key), expected, id);
        assert.equal(f.requests.length, 0, id);
    }
});
test("captured revisions reject local ABA, source replacement and unrelated saved-byte edits", () => {
    const f = setup("xtream", {
        xtreamxtream_data: JSON.stringify({
            password: "b",
            server: "https://xc.test",
            username: "a",
        }),
    });
    const before = f.api.capture("providerUsername"),
        original = f.driver.credentials();
    f.driver.saveCredentials({ ...original, username: "other" });
    f.driver.saveCredentials(original);
    assert.equal(before.current(), false);
    assert.throws(
        () => f.api.save("providerUsername", "new", before, () => true),
        /revision_conflict/
    );
    const current = f.api.capture("providerUsername");
    f.saved.set(
        "xtreamxtream_data",
        JSON.stringify({ ...original, password: "different" })
    );
    assert.equal(current.current(), false);
});
test("rejected persistence performs no catalogue teardown", () => {
    const f = setup("xtream", {
        xtreamxtream_data: JSON.stringify({
            password: "b",
            server: "https://xc.test",
            username: "a",
        }),
    });
    f.driver.load(() => {});
    assert.equal(f.requests.length, 1);
    const before = f.saved.get("xtreamxtream_data");
    f.host.stbSetItem = (key, value) => {};
    const port = f.host.__ottRemoteProviderFields.create(f.host, f.driver);
    assert.throws(
        () =>
            port.save(
                "providerUsername",
                "new",
                port.capture("providerUsername"),
                () => true
            ),
        /storage_failed/
    );
    assert.equal(f.saved.get("xtreamxtream_data"), before);
    assert.equal(f.requests[0].aborts, 0);
});
test("full player_settings wire preserves own context and redacts provider secrets", () => {
    const f = setup("plex", {
        plexcfg: JSON.stringify({
            address: "https://plex.test",
            playback: "auto",
            token: "private-token",
        }),
    });
    f.host.__ottPlayerSettingsHost = {
        schema: [],
        source: () => "plex",
        store: {},
    };
    privateRuntime(f.host, "src/plugins/remote-settings.ts");
    const api = f.host.__ottPlayerSettingsFactory.create(
        f.host,
        () => "runtime-1"
    );
    function request(params) {
        let response;
        api.request(
            { params: { runtime: "runtime-1", ...params } },
            (value) => (response = clone(value))
        );
        return response;
    }
    const read = request({ id: "plexPlayback", op: "get" });
    assert.equal(read.status, "ok");
    assert.equal(read.data.setting.value, "auto");
    const saved = request({
        context: read.data.context.token,
        id: "plexPlayback",
        op: "set",
        revision: read.data.setting.revision,
        value: "original",
    });
    assert.equal(saved.status, "ok", JSON.stringify(saved));
    assert.equal(saved.data.context.token, read.data.context.token);
    assert.equal(saved.data.setting.persisted_value, "original");
    assert.deepEqual(saved.data.application, {
        reason: "next_stream",
        state: "deferred",
    });
    const secret = request({ id: "providerPassword", op: "get" });
    assert.equal(secret.data.setting.redacted, true);
    assert(!JSON.stringify(secret).includes("private-token"));
    const duplicate = request({
        context: read.data.context.token,
        id: "plexPlayback",
        op: "set",
        revision: read.data.setting.revision,
        value: "compatible",
    });
    assert.equal(duplicate.data.reason, "revision_conflict");
});
test("invalid saved scalar values are not confirmed as valid persistence", () => {
    const f = setup("only4", { o4token: "", o4ts_hls: "bad" });
    const invalid = f.api.capture("providerMode");
    assert.equal(invalid.valid, false);
    assert.equal(invalid.value, 0);
    assert.equal(f.api.capture("providerUsername").configured, false);
    assert.equal(f.set("providerMode", 2).capture.stored, 2);
});
test("remote persistence invalidates an already-open local credentials draft", () => {
    const f = setup("xtream", {
        xtreamxtream_data: JSON.stringify({
            password: "b",
            server: "https://xc.test",
            username: "a",
        }),
    });
    f.host.duneAddSettings(0);
    f.host.popupActions[0]();
    const stale = f.host.listKeyHandler;
    f.set("providerUsername", "remote-value");
    const before = f.saved.get("xtreamxtream_data");
    f.host.selIndex = 4;
    stale(f.host.keys.ENTER);
    assert.equal(f.saved.get("xtreamxtream_data"), before);
    assert.equal(f.reloads, 0);
});
test("partial Edem persistence rolls back all fields before any cancellation", () => {
    const f = setup("edem", {
        ededcdn: "cdn.example.test",
        edkey: "private",
        edlist: "0",
        edvpurl: "",
    });
    f.driver.load(() => {});
    const pending = f.requests[0],
        before = Array.from(f.saved);
    const original = f.host.stbSetItem;
    f.host.stbSetItem = (key, value) => {
        if (key !== "edlist") original(key, value);
    };
    const api = f.host.__ottRemoteProviderFields.create(f.host, f.driver);
    assert.throws(
        () => api.save("edemList", 3, api.capture("edemList"), () => true),
        /storage_failed/
    );
    assert.deepEqual(Array.from(f.saved), before);
    assert.equal(pending.aborts, 0);
});
test("real dotted provider identifiers and KBC slots survive typed context serialization", () => {
    for (const id of [
        "all4you",
        "iptv-ott.ru",
        "shara.club",
        "d/maxtv",
        "kb-team",
    ]) {
        const f = setup(id, { kbc1v_list: "1", kbcv_list: "1" });
        f.host.__ottPlayerSettingsHost = {
            schema: [],
            source: () => id,
            store: {},
        };
        privateRuntime(f.host, "src/plugins/remote-settings.ts");
        const api = f.host.__ottPlayerSettingsFactory.create(
            f.host,
            () => "runtime-1"
        );
        let result;
        api.request(
            { params: { op: "schema", runtime: "runtime-1" } },
            (reply) => (result = clone(reply))
        );
        assert.equal(result.status, "ok", id);
        assert.equal(result.data.context.provider, id, id);
        if (id === "kb-team") assert.equal(result.data.context.profile, 2);
    }
});
test("invalid provider values cannot mutate storage and deferred modes explain next-stream application", () => {
    const f = setup("only4", { o4token: "1234567890", o4ts_hls: "0" });
    const before = Array.from(f.saved);
    for (const value of ["too-short", "12345678901", "bad\nvalue"]) {
        assert.throws(() => f.set("providerUsername", value), /invalid_value/);
        assert.deepEqual(Array.from(f.saved), before);
    }
    const mode = f.api.schema.find(
        (row) => row.id === "providerMode"
    ).descriptor;
    assert.equal(mode.apply, "next_stream");
    assert(mode.description.includes("next provider stream"));
});
test("after-save effect reentry cannot falsely confirm an ABA configuration", () => {
    const f = setup("xtream", {
        xtreamxtream_data: JSON.stringify({
            password: "b",
            server: "https://xc.test",
            username: "a",
        }),
    });
    f.driver.settingsChanged = () => {
        const value = f.driver.credentials();
        f.driver.saveCredentials({ ...value, username: "other" });
        f.driver.saveCredentials(value);
        throw new Error("effect failed");
    };
    assert.throws(() => f.set("providerUsername", "new"), /source_changed/);
});
test("retired-owner persistence rejects the old receipt and preserves the newer owner's bytes", () => {
    const originalConfig = {
        password: "secret",
        server: "https://xc.test",
        username: "old",
    };
    const newerConfig = { ...originalConfig, username: "newer-owner" };
    const f = setup("xtream", {
        xtreamxtream_data: JSON.stringify(originalConfig),
    });
    const setItem = f.host.stbSetItem;
    let changed = false;
    f.host.stbSetItem = (key, value) => {
        setItem(key, value);
        if (!changed && key === "xtreamxtream_data") {
            changed = true;
            f.saved.set(key, JSON.stringify(newerConfig));
            f.mount("xtream");
        }
    };
    f.host.__ottPlayerSettingsHost = {
        schema: [],
        source: () => "xtream",
        store: {},
    };
    privateRuntime(f.host, "src/plugins/remote-settings.ts");
    const api = f.host.__ottPlayerSettingsFactory.create(
        f.host,
        () => "runtime-1"
    );
    function request(params) {
        let result;
        api.request(
            { params: { runtime: "runtime-1", ...params } },
            (reply) => (result = clone(reply))
        );
        return result;
    }
    const before = request({ id: "providerUsername", op: "get" });
    const result = request({
        context: before.data.context.token,
        id: "providerUsername",
        op: "set",
        revision: before.data.setting.revision,
        value: "old-owner-write",
    });
    assert.equal(changed, true);
    assert.equal(result.status, "rejected");
    assert.notEqual(result.data.application?.state, "completed");
    assert.notEqual(result.data.persisted, true);
    assert.deepEqual(JSON.parse(f.saved.get("xtreamxtream_data")), newerConfig);
    assert.equal(
        f.host.__ottActiveProviderDriver.credentials().username,
        "newer-owner"
    );
});
console.log("PASS " + passed + " real provider field scenarios");
