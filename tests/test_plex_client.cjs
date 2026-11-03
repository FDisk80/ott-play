const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const ts = require("typescript");
const { sourceFunctions } = require("./test_port_vod.cjs");
const root = path.resolve(__dirname, "..");
const compiled = ts.transpileModule(
    ["plex-playback-policy.ts", "plex.ts"]
        .map((file) =>
            fs.readFileSync(path.join(root, "src/plugins", file), "utf8")
        )
        .join("\n"),
    {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
        },
    }
).outputText;
const xmlParser = new JSDOM().window.DOMParser;
const token = "fixture-private-plex-token";
const source = "plex:fixture-account";
const film = {
    plexSource: source,
    request: { path: "/library/metadata/42" },
    stream_url: "plex:request",
    title: "Fixture",
};
function metadata(overrides = {}) {
    return {
        MediaContainer: {
            Metadata: [
                {
                    Media: [
                        {
                            audioCodec: "aac",
                            container: "mp4",
                            height: 1080,
                            Part: [{ key: "/library/parts/1/file.mp4" }],
                            videoCodec: "h264",
                            width: 1920,
                            ...overrides,
                        },
                    ],
                    ratingKey: "42",
                    type: "movie",
                },
            ],
        },
    };
}
function fixture(config = {}, capabilities = {}) {
    const requests = [],
        events = new Map(),
        keepalive = [],
        messages = [],
        intervals = new Map(),
        timers = new Map(),
        timerDelays = [];
    let next = 0,
        clock = Date.now(),
        active = true;
    const host = {
        $: {
            ajax(options) {
                const request = {
                    abort() {
                        this.aborted = true;
                        options.error?.({}, "abort");
                        options.complete?.();
                    },
                    aborted: false,
                    fail(status = 0, kind = "error") {
                        options.error?.({ responseText: token, status }, kind);
                        options.complete?.();
                    },
                    options,
                    reply(data) {
                        options.success?.(data);
                        options.complete?.();
                    },
                };
                requests.push(request);
                return request;
            },
        },
        addEventListener(event, listener, capture) {
            events.set(event, listener);
            capabilities.eventTarget?.addEventListener(
                event,
                listener,
                capture
            );
        },
        clearInterval(id) {
            intervals.delete(id);
        },
        clearTimeout(id) {
            timers.delete(id);
        },
        DOMParser: xmlParser,
        document: {
            createElement: () => ({
                canPlayType: capabilities.native || (() => ""),
            }),
        },
        fetch(url, options) {
            keepalive.push({ options, url });
            return {
                then(resolve) {
                    resolve?.();
                },
            };
        },
        Hls: { isSupported: () => capabilities.hls !== false },
        infoBox(message) {
            messages.push(message);
        },
        MediaSource: { isTypeSupported: capabilities.mse || (() => false) },
        mediaName: "untouched",
        mediaRecords: ["untouched"],
        removeEventListener(event, listener, capture) {
            if (events.get(event) === listener) events.delete(event);
            capabilities.eventTarget?.removeEventListener(
                event,
                listener,
                capture
            );
        },
        setInterval(run, delay) {
            intervals.set(++next, { delay, run });
            return next;
        },
        setTimeout(run, delay) {
            timerDelays.push(delay);
            run.fixtureDelay = delay;
            timers.set(++next, run);
            return next;
        },
    };
    const helpers = vm.createContext({});
    vm.runInContext(
        sourceFunctions("src/utils/helpers.ts", ["metadataText"]),
        helpers
    );
    const context = {
        Date: { now: () => clock },
        exports: {},
        require: () => helpers,
        window: host,
    };
    vm.runInNewContext(compiled, context);
    const api = {
        createPlexClient: host.__ottPlex.create,
        normalizePlexConfig: host.__ottPlex.normalize,
    };
    const client = api.createPlexClient(
        { address: "https://plex.invalid", token, ...config },
        { isCurrent: () => active, sourceId: source }
    );
    return {
        advance(milliseconds) {
            clock += milliseconds;
        },
        api,
        client,
        events,
        host,
        intervals,
        keepalive,
        messages,
        requests,
        retire() {
            active = false;
        },
        tick(maxDelay = Infinity) {
            const pending = [...timers.entries()].filter(
                ([, run]) => run.fixtureDelay <= maxDelay
            );
            pending.forEach(([id]) => timers.delete(id));
            pending.forEach(([, run]) => run());
        },
        timerDelays,
        timers,
    };
}
let passed = 0;
function test(name, run) {
    run();
    console.log("PASS Plex client: " + name);
    passed++;
}
function last(f) {
    return f.requests.at(-1);
}
function parsed(f) {
    return new URL(last(f).options.url);
}

test("configuration is explicit, normalized and refuses embedded credentials or ambiguous addresses", () => {
    const f = fixture();
    for (const address of [
        "//plex.invalid",
        "file:///library",
        "http://user:password@plex.invalid",
        "http://plex.invalid?token=hidden",
        "http://plex.invalid/../admin",
        "http://plex.invalid/#fragment",
        "http://plex.invalid:0",
        "http://plex.invalid:65536",
        "http://[::1]:99999",
    ])
        assert.equal(f.api.normalizePlexConfig({ address, token }), null);
    assert.equal(
        f.api.normalizePlexConfig({
            address: "http://plex.invalid",
            token: "a\nb",
        }),
        null
    );
    assert.equal(
        f.api.normalizePlexConfig({
            server: " http://plex.invalid:32400/ ",
            token,
        }).address,
        "http://plex.invalid:32400"
    );
    assert.equal(
        f.api.normalizePlexConfig({
            address: "https://plex.invalid",
            playback: "unknown",
            token,
        }).playback,
        "auto"
    );
});

test("connect keeps transient startup failures pending, with bounded cancellable retries", () => {
    for (const status of [0, 408, 429, 503]) {
        const f = fixture();
        const results = [];
        f.client.connect((error) => results.push(error));
        last(f).fail(status);
        assert.deepEqual(results, []);
        f.tick();
        assert.equal(f.requests.length, 2);
        last(f).fail(status);
        f.tick();
        assert.equal(f.requests.length, 3);
        last(f).reply({ MediaContainer: { Directory: [] } });
        assert.deepEqual(results, [undefined]);
    }
    const f = fixture();
    const results = [];
    f.client.connect((error) => results.push(error));
    for (let attempt = 0; attempt < 3; attempt++) {
        last(f).fail(503);
        f.tick();
    }
    assert.deepEqual(results, ["Plex connection failed"]);
    assert.equal(f.requests.length, 3);
    for (const cancel of [() => f.client.cancel(), () => f.client.dispose()]) {
        f.client.connect(() => assert.fail("Cancelled startup cannot settle"));
        last(f).fail();
        const count = f.requests.length;
        cancel();
        f.tick();
        assert.equal(f.requests.length, count);
    }
});

test("connect reports rejected credentials without retrying", () => {
    for (const status of [401, 403]) {
        const f = fixture();
        let error;
        f.client.connect((value) => (error = value));
        last(f).fail(status);
        f.tick();
        assert.equal(error, "Plex connection failed");
        assert.equal(f.requests.length, 1);
    }
});

test("connect authenticates directly and cached sections do not mutate another catalog", () => {
    const f = fixture();
    let connected = false;
    f.client.connect((error) => {
        assert.equal(error, undefined);
        connected = true;
    });
    assert.equal(parsed(f).origin, "https://plex.invalid");
    assert.equal(parsed(f).pathname, "/library/sections");
    assert.equal(parsed(f).searchParams.get("X-Plex-Token"), token);
    last(f).reply(
        '<MediaContainer size="1"><Directory key="1" title="Fixture library" type="movie"/></MediaContainer>'
    );
    assert.equal(connected, true);
    assert.deepEqual(f.host.mediaRecords, ["untouched"]);
    f.client.load("", () => {});
    assert.equal(f.requests.length, 1);
    assert.equal(
        f.host.mediaRecords[0].playlist_url.path,
        "/library/sections/1/all"
    );
    assert(!JSON.stringify(f.host.mediaRecords).includes(token));
    const second = fixture({
        address: "http://other.invalid:32400",
        token: "different-private-token",
    });
    second.client.connect(() => {});
    assert.equal(parsed(second).origin, "http://other.invalid:32400");
    assert.equal(
        parsed(second).searchParams.get("X-Plex-Token"),
        "different-private-token"
    );
    assert.equal(parsed(f).origin, "https://plex.invalid");
});

test("JSON and XML folders recurse through Plex keys and shows/seasons retain stable IDs", () => {
    const f = fixture();
    f.client.load(
        { path: "/library/sections/1/all", plexSource: source },
        () => {}
    );
    last(f).reply({
        MediaContainer: {
            Directory: [
                { key: "/library/metadata/10", title: "Series", type: "show" },
            ],
        },
    });
    assert.equal(
        f.host.mediaRecords[0].playlist_url.path,
        "/library/sections/1/folder"
    );
    assert.equal(f.host.mediaRecords[0].title, "Browse folders");
    assert.equal(
        f.host.mediaRecords[1].playlist_url.path,
        "/library/metadata/10/children"
    );
    f.client.load(f.host.mediaRecords[0].playlist_url, () => {});
    last(f).reply({
        MediaContainer: {
            Metadata: [
                {
                    key: "/library/sections/1/folder?parent=17",
                    title: "Nested & folder",
                },
            ],
        },
    });
    f.client.load(f.host.mediaRecords[0].playlist_url, () => {});
    assert.equal(parsed(f).searchParams.get("parent"), "17");
    assert.equal(last(f).options.headers["X-Plex-Container-Start"], "0");
    last(f).reply(
        '<MediaContainer><Video ratingKey="42" title="Episode" summary="&lt;script&gt;not HTML&lt;/script&gt;" type="episode"/></MediaContainer>'
    );
    assert.equal(f.host.mediaRecords[0].request.path, "/library/metadata/42");
    assert.equal(f.host.mediaRecords[0].__ottMediaSequence, true);
    assert(!f.host.mediaRecords[0].description.includes("<script>"));
});

test("Plex resolves portrait and backdrop on access without serializing credentials", () => {
    const f = fixture();
    f.client.load(
        { path: "/library/sections/1/all", plexSource: source },
        () => {}
    );
    last(f).reply({
        MediaContainer: {
            Metadata: [
                {
                    art: "/library/metadata/42/art/9002",
                    Media: [{ Part: [{ key: "/library/parts/1/file.mp4" }] }],
                    ratingKey: "42",
                    thumb: "/library/metadata/42/thumb/9001",
                    title: "Film",
                    type: "movie",
                },
                {
                    Media: [{ Part: [{ key: "/library/parts/2/file.mp4" }] }],
                    ratingKey: "43",
                    thumb: "/library/metadata/43/thumb/9003",
                    title: "Poster only",
                    type: "movie",
                },
            ],
            size: 2,
            totalSize: 2,
        },
    });
    const row = f.host.mediaRecords.find(
        (record) => record.request?.path === "/library/metadata/42"
    );
    const thumbOnly = f.host.mediaRecords.find(
        (record) => record.request?.path === "/library/metadata/43"
    );
    const art = new URL(row.backdrop);
    assert.equal(art.origin, "https://plex.invalid");
    assert.equal(art.pathname, "/library/metadata/42/art/9002");
    assert.equal(art.searchParams.get("X-Plex-Token"), token);
    assert.equal(
        new URL(row.poster).pathname,
        "/library/metadata/42/thumb/9001"
    );
    const thumb = new URL(thumbOnly.poster);
    assert.equal(thumb.pathname, "/library/metadata/43/thumb/9003");
    const saved = f.client.persist(row);
    assert.equal(saved.poster, undefined);
    assert.equal(saved.backdrop, undefined);
    assert(!JSON.stringify(saved).includes(token));
    assert(!JSON.stringify(row).includes(token));
    assert.equal(Object.assign({}, row).poster, undefined);
    assert.equal(new URL(thumbOnly.backdrop).pathname, thumb.pathname);
    f.client.dispose();
    assert.equal(row.poster, "");
    assert.equal(row.backdrop, "");
});

test("catalog labels stay nonblank without exposing filesystem parents or changing paging", () => {
    const f = fixture();
    f.client.load(
        { path: "/library/sections/1/all", plexSource: source },
        () => {}
    );
    last(f).reply({
        MediaContainer: {
            Metadata: [
                {
                    name: " Name\t label ",
                    ratingKey: "1",
                    title: " \n ",
                    type: "movie",
                },
                {
                    originalTitle: " Original ",
                    ratingKey: "2",
                    titleSort: "Sort",
                    type: "movie",
                },
                { ratingKey: "3", titleSort: " Sort ", type: "movie" },
                {
                    Media: [{ Part: [{ file: "/private/parents/File.mp4" }] }],
                    ratingKey: "4",
                    type: "movie",
                },
                {
                    Media: [
                        { Part: [{ file: "C:\\private\\parents\\Other.mkv" }] },
                    ],
                    ratingKey: "5",
                    type: "movie",
                },
                {
                    Media: [
                        {
                            Part: [
                                { file: "https://host.invalid/private/token" },
                            ],
                        },
                    ],
                    ratingKey: "6",
                    type: "movie",
                },
                { key: "/library/sections/1/folder?parent=2", title: "\t" },
                { ratingKey: "7", title: "", type: "episode" },
            ],
            size: 8,
            totalSize: 9,
        },
    });
    assert.deepEqual(
        Array.from(f.host.mediaRecords, (row) => row.title),
        [
            "Browse folders",
            "Name label",
            "Original",
            "Sort",
            "File.mp4",
            "Other.mkv",
            "Untitled",
            "Untitled folder",
            "Untitled",
            "Next",
        ]
    );
    assert.equal(f.host.mediaRecords.at(-1).playlist_url.offset, 8);
    assert.equal(f.host.mediaRecords[0].__ottMediaLabel.key, "Browse folders");
    assert.equal(f.host.mediaRecords[6].__ottMediaLabel.key, "Untitled");
    assert.equal(f.host.mediaRecords[7].__ottMediaLabel.key, "Untitled folder");
    assert(
        f.host.mediaRecords.slice(1, 6).every((item) => !item.__ottMediaLabel)
    );
    assert.equal(
        f.host.mediaRecords[7].playlist_url.path,
        "/library/sections/1/folder?parent=2"
    );
    assert(!JSON.stringify(f.host.mediaRecords).includes("private"));
    f.client.load("", () => {});
    last(f).reply({
        MediaContainer: {
            Directory: [
                { key: "1", title: "  ", type: "movie" },
                { key: "2", title: "Untitled folder" },
            ],
        },
    });
    assert.equal(
        f.host.mediaRecords[0].title,
        "Untitled folder",
        "an unnamed movie library is a directory, not a playable movie"
    );
    assert.equal(f.host.mediaRecords[1].__ottMediaLabel, undefined);
    assert.equal(f.host.mediaRecords[1].title, "Untitled folder");
});

test("file labels and directory categories independently keep their first valid Part", () => {
    const f = fixture();
    f.client.load(
        { path: "/library/metadata/10/children", plexSource: source },
        () => {}
    );
    last(f).reply({
        MediaContainer: {
            Metadata: [
                {
                    Media: [
                        null,
                        "invalid",
                        {
                            Part: [
                                null,
                                { file: 5 },
                                {
                                    file: "https://host.invalid/ignored/Remote.mp4",
                                },
                            ],
                        },
                        {
                            Part: [
                                { file: "/private/First/.." },
                                {
                                    file: "C:\\private\\Second\\Visible\t File.mkv",
                                },
                                { file: "/private/Third/Too late.mp4" },
                            ],
                        },
                    ],
                    ratingKey: "1",
                    type: "movie",
                },
                {
                    Media: { Part: { file: "/private/First/another.mp4" } },
                    ratingKey: "2",
                    title: " Preferred\t title ",
                    type: "movie",
                },
                {
                    Media: {
                        Part: [
                            { file: "Filename.mp4" },
                            { file: "/private/Second/later.mp4" },
                        ],
                    },
                    ratingKey: "3",
                    type: "movie",
                },
            ],
            size: 3,
            totalSize: 3,
        },
    });
    const rows = f.host.mediaRecords;
    assert.deepEqual(
        Array.from(rows, (row) => row.title),
        ["Visible File.mkv", "Preferred title", "Filename.mp4"]
    );
    assert.deepEqual(
        Array.from(rows, (row) => row.__ottMediaFileDirectory.name),
        ["First", "First", "Second"]
    );
    assert.equal(
        rows[0].__ottMediaFileDirectory.id,
        rows[1].__ottMediaFileDirectory.id
    );
    assert(!JSON.stringify(rows).includes("private"));
    assert(!JSON.stringify(rows).includes("host.invalid"));
});

test("collection capability uses the same flat route contract as collection", () => {
    const f = fixture();
    for (const target of [
        "",
        null,
        undefined,
        { path: "/library/sections", plexSource: source },
        { offset: 200, path: "/library/sections/1/all", plexSource: source },
        { path: "/library/sections/1/folder?parent=17", plexSource: source },
        { path: "/library/metadata/42/children", plexSource: source },
    ]) {
        assert.equal(f.client.canCollect(target), true);
        const count = f.requests.length;
        let result;
        f.client.collect(target, (value) => (result = value));
        assert.equal(f.requests.length, count + 1);
        last(f).reply({ MediaContainer: { size: 0, totalSize: 0 } });
        assert.equal(result.error, undefined);
    }
    for (const target of [
        "plexsearch?search=film",
        { path: "/hubs/search", plexSource: source, query: "film" },
        { path: "/library/metadata/42", plexSource: source },
        { path: "/library/parts/1/file.mp4", plexSource: source },
        { path: "/library/sections/1/all", plexSource: "other" },
        {
            path: "/library/sections/1/all?X-Plex-Token=other",
            plexSource: source,
        },
    ]) {
        const count = f.requests.length;
        assert.equal(f.client.canCollect(target), false);
        let result;
        f.client.collect(target, (value) => (result = value));
        assert.equal(result.error, "Unable to load playlist");
        assert.equal(f.requests.length, count);
    }
});

test("movies and clips retain title filtering while episode and track sequence markers remain unchanged", () => {
    const rows = ["movie", "clip", "episode", "track"].map((type, index) => ({
        ratingKey: String(index + 1),
        title: type,
        type,
    }));
    for (const path of [
        "/library/sections/1/all",
        "/library/sections/1/folder?parent=17",
        "/library/metadata/42/children",
    ]) {
        const f = fixture();
        f.client.load({ path, plexSource: source }, () => {});
        last(f).reply({ MediaContainer: { Metadata: rows } });
        const playable = f.host.mediaRecords.filter((record) => record.request);
        assert.equal(playable.length, 4);
        assert.deepEqual(
            Array.from(playable, (record) => record.__ottMediaSequence),
            [false, false, true, true]
        );
    }
    for (const target of ["", "plexsearch?search=film"]) {
        const f = fixture();
        f.client.load(target, () => {});
        last(f).reply({ MediaContainer: { Metadata: rows } });
        const playable = f.host.mediaRecords.filter((record) => record.request);
        assert.equal(playable.length, 4);
        assert.deepEqual(
            Array.from(playable, (record) => record.__ottMediaSequence),
            [false, false, true, true]
        );
    }
});

test("collection starts at zero, deduplicates flat playable pages and does not disturb a visible load", () => {
    const f = fixture();
    f.client.load("", () => {});
    const navigation = last(f);
    const projection = f.host.mediaRecords;
    let result;
    f.client.collect(
        {
            offset: 400,
            path: "/library/sections/1/folder?parent=17",
            plexSource: source,
        },
        (value) => (result = value)
    );
    assert.equal(last(f).options.headers["X-Plex-Container-Start"], "0");
    assert.equal(parsed(f).searchParams.get("parent"), "17");
    assert.equal(navigation.aborted, false);
    last(f).reply({
        MediaContainer: {
            Metadata: [
                { ratingKey: "42", title: "Film", type: "movie" },
                { key: "/library/sections/1/folder?parent=18", title: "Child" },
                { ratingKey: "43", title: "Episode", type: "episode" },
            ],
            offset: 0,
            size: 3,
            totalSize: 5,
        },
    });
    assert.equal(result, undefined);
    assert.equal(f.host.mediaRecords, projection);
    f.tick();
    assert.equal(last(f).options.headers["X-Plex-Container-Start"], "3");
    last(f).reply({
        MediaContainer: {
            Metadata: [
                { ratingKey: "43", title: "Duplicate", type: "episode" },
                { ratingKey: "44", title: "Track", type: "track" },
            ],
            offset: 3,
            size: 2,
            totalSize: 5,
        },
    });
    assert.equal(result.error, undefined);
    assert.deepEqual(
        Array.from(result.items, (row) => row.request.path),
        ["/library/metadata/42", "/library/metadata/43", "/library/metadata/44"]
    );
    assert(
        result.items.every(
            (row) => row.stream_url === "plex:request" && !row.playlist_url
        )
    );
    assert.deepEqual(
        Array.from(result.records, (row) => row.title),
        ["Film", "Child", "Episode", "Track"]
    );
    assert.deepEqual(
        Array.from(result.items, (row) => row.__ottMediaSequence),
        [false, true, true]
    );
    assert.equal(
        result.records[1].playlist_url.path,
        "/library/sections/1/folder?parent=18"
    );
    assert.equal(
        f.requests.length,
        3,
        "does not recurse into the child directory"
    );
    navigation.reply({
        MediaContainer: {
            Directory: [{ key: "1", title: "Library", type: "movie" }],
        },
    });
    assert.equal(
        f.host.mediaRecords[0].title,
        "Library",
        "collection did not invalidate the navigation revision"
    );
});

test("complete catalog records retain deduplicated subfolders and omit synthetic navigation", () => {
    const f = fixture();
    const child = { key: "/library/metadata/10", title: "Child", type: "show" };
    let result;
    f.client.collect(
        { path: "/library/sections/1/all", plexSource: source },
        (value) => (result = value)
    );
    last(f).reply({
        MediaContainer: {
            Metadata: [
                { ratingKey: "42", title: "First", type: "movie" },
                child,
                { key: "/library/metadata/11", title: "Browse folders" },
            ],
            offset: 0,
            size: 3,
            totalSize: 6,
        },
    });
    assert.equal(result, undefined, "Never expose a partial folder");
    f.tick();
    last(f).reply({
        MediaContainer: {
            Metadata: [
                { ...child, title: "Duplicate child" },
                { ratingKey: "43", title: "Second", type: "clip" },
                { key: "/library/metadata/12", title: "Next" },
            ],
            offset: 3,
            size: 3,
            totalSize: 6,
        },
    });
    assert.equal(result.error, undefined);
    assert.deepEqual(
        Array.from(result.records, (record) => record.title),
        ["First", "Child", "Browse folders", "Second", "Next"],
        "Real folders with navigation-like titles must remain visible"
    );
    assert.deepEqual(
        Array.from(result.items, (record) => record.request.path),
        ["/library/metadata/42", "/library/metadata/43"]
    );
    const folders = result.records.filter((record) => record.playlist_url);
    assert.deepEqual(
        Array.from(folders, (record) => record.playlist_url.path),
        [
            "/library/metadata/10/children",
            "/library/metadata/11/children",
            "/library/metadata/12/children",
        ]
    );
    assert(folders.every((record) => record.playlist_url.offset === undefined));
    assert.equal(f.requests.length, 2, "Collection never visits child folders");
    assert(!JSON.stringify(result).includes(token));

    const root = fixture();
    root.client.collect("", (value) => (result = value));
    last(root).reply({
        MediaContainer: {
            Directory: [
                { key: "1", title: "Movies", type: "movie" },
                { key: "2", title: "Shows", type: "show" },
            ],
            size: 2,
            totalSize: 2,
        },
    });
    assert.equal(result.items.length, 0);
    assert.deepEqual(
        Array.from(result.records, (record) => record.title),
        ["Movies", "Shows"]
    );
    assert(
        result.records.every(
            (record) => typeof record.playlist_url === "object"
        )
    );
});

test("unknown totals require an empty terminal page and incomplete collections never return partial items", () => {
    const target = { path: "/library/sections/1/all", plexSource: source };
    const row = { ratingKey: "42", title: "Film", type: "movie" };
    const f = fixture();
    let result;
    f.client.collect(target, (value) => (result = value));
    last(f).reply({ MediaContainer: { Metadata: [row], size: 1 } });
    assert.equal(
        result,
        undefined,
        "short pages without a total do not prove completeness"
    );
    f.tick();
    assert.equal(last(f).options.headers["X-Plex-Container-Start"], "1");
    last(f).reply({ MediaContainer: { Metadata: [], size: 0 } });
    assert.equal(result.items.length, 1);
    for (const broken of [
        { Metadata: [row], offset: 0, size: 1, totalSize: 2 }, // repeated page/ignored offset
        { Metadata: [], offset: 1, size: 0, totalSize: 2 }, // promised data missing
        {
            Metadata: [{ ...row, ratingKey: "43" }],
            offset: 1,
            size: 1,
            totalSize: 3,
        }, // snapshot changes
        { Metadata: [row], offset: 1, size: 2, totalSize: 2 }, // inconsistent size
    ]) {
        const g = fixture();
        let failed;
        g.client.collect(target, (value) => (failed = value));
        last(g).reply({
            MediaContainer: {
                Metadata: [row],
                offset: 0,
                size: 1,
                totalSize: 2,
            },
        });
        g.tick();
        last(g).reply({ MediaContainer: broken });
        assert.equal(failed.error, "Unable to load playlist");
        assert.equal(failed.items.length, 0);
        assert.equal(failed.records.length, 0);
        assert.equal(g.timers.size, 0);
    }
    const g = fixture();
    let failed;
    g.client.collect(target, (value) => (failed = value));
    last(g).reply({
        MediaContainer: { Metadata: [row], size: 1, totalSize: 100001 },
    });
    assert.equal(failed.items.length, 0);
    assert.equal(failed.error, "Unable to load playlist");
});

test("collection cancellation, profile retirement and overlapping requests suppress late results", () => {
    const target = {
        path: "/library/metadata/10/children",
        plexSource: source,
    };
    const page = {
        MediaContainer: {
            Metadata: [{ ratingKey: "42", title: "Episode", type: "episode" }],
            size: 1,
            totalSize: 2,
        },
    };
    for (const method of [
        "returned",
        "dispose",
        "pagehide",
        "guard",
        "supersede",
    ]) {
        const f = fixture();
        let callbacks = 0,
            allowed = true;
        const cancel = f.client.collect(
            target,
            () => callbacks++,
            () => allowed
        );
        const request = last(f);
        if (method === "returned") cancel();
        if (method === "dispose") f.client.dispose();
        if (method === "pagehide") f.events.get("pagehide")();
        if (method === "guard") allowed = false;
        if (method === "supersede") f.client.collect(target, () => {});
        request.reply(page);
        f.tick();
        assert.equal(callbacks, 0, method);
        assert.equal(request.aborted, true, method);
    }
    const f = fixture();
    let callbacks = 0;
    const cancel = f.client.collect(target, () => callbacks++);
    last(f).reply(page);
    assert.equal(f.timers.size, 1);
    cancel();
    f.tick();
    assert.equal(f.requests.length, 1);
    assert.equal(callbacks, 0);
    assert.equal(f.host.mediaName, "untouched");
});

test("collection retries transient reads at the same offset without accepting stale pages", () => {
    for (const status of [0, 408, 429, 500, 503, 599]) {
        const f = fixture();
        const results = [];
        const row = { ratingKey: "42", title: "Film", type: "movie" };
        f.client.collect(
            { path: "/library/sections/1/all", plexSource: source },
            (value) => results.push(value)
        );
        const first = last(f);
        first.fail(status);
        first.fail(status);
        first.reply({
            MediaContainer: { Metadata: [row], size: 1, totalSize: 1 },
        });
        assert.equal(results.length, 0);
        assert.equal(f.timers.size, 1);
        f.tick();
        assert.equal(last(f).options.url, first.options.url);
        last(f).fail(status);
        f.tick();
        assert.deepEqual(f.timerDelays, [500, 1000]);
        last(f).reply({
            MediaContainer: { Metadata: [row], size: 1, totalSize: 3 },
        });
        f.tick();
        const second = last(f);
        assert.equal(second.options.headers["X-Plex-Container-Start"], "1");
        second.fail(status);
        f.tick();
        assert.equal(last(f).options.url, second.options.url);
        last(f).reply({
            MediaContainer: {
                Metadata: [row, { ...row, ratingKey: "43" }],
                offset: 1,
                size: 2,
                totalSize: 3,
            },
        });
        assert.equal(results.length, 1);
        assert.deepEqual(
            Array.from(results[0].items, (item) => item.request.path),
            ["/library/metadata/42", "/library/metadata/43"]
        );
        assert.equal(f.requests.length, 5);
        assert.equal(f.timers.size, 0);
    }
});

test("collection retry exhaustion returns no partial queue and semantic failures are terminal", () => {
    const target = { path: "/library/sections/1/all", plexSource: source };
    const f = fixture();
    const results = [];
    f.client.collect(target, (value) => results.push(value));
    last(f).reply({
        MediaContainer: {
            Metadata: [{ ratingKey: "42", title: "Film", type: "movie" }],
            size: 1,
            totalSize: 2,
        },
    });
    f.tick();
    for (let attempt = 0; attempt < 3; attempt++) {
        last(f).fail(503);
        f.tick();
    }
    assert.equal(f.requests.length, 4);
    assert.equal(results.length, 1);
    assert.equal(results[0].error, "Unable to load playlist");
    assert.equal(results[0].items.length, 0);
    for (const status of [400, 401, 403, 404, 422]) {
        const g = fixture();
        let result;
        g.client.collect(target, (value) => (result = value));
        last(g).fail(status);
        g.tick();
        assert.equal(g.requests.length, 1);
        assert.equal(result.error, "Unable to load playlist");
    }
    for (const fail of [
        (r) => r.reply("<broken"),
        (r) => r.fail(503, "parsererror"),
    ]) {
        const g = fixture();
        let result;
        g.client.collect(target, (value) => (result = value));
        fail(last(g));
        g.tick();
        assert.equal(g.requests.length, 1);
        assert.equal(result.error, "Unable to load playlist");
    }
});

test("collection cancellation owns retry timers and preserves the original deadline", () => {
    const target = { path: "/library/sections/1/all", plexSource: source };
    for (const method of [
        "returned",
        "dispose",
        "pagehide",
        "guard",
        "retire",
        "supersede",
    ]) {
        const f = fixture();
        let callbacks = 0,
            allowed = true;
        const cancel = f.client.collect(
            target,
            () => callbacks++,
            () => allowed
        );
        const first = last(f);
        first.fail(0);
        const retry = [...f.timers.values()][0];
        if (method === "returned") cancel();
        if (method === "dispose") f.client.dispose();
        if (method === "pagehide") f.events.get("pagehide")();
        if (method === "guard") allowed = false;
        if (method === "retire") f.retire();
        if (method === "supersede") f.client.collect(target, () => {});
        const count = f.requests.length;
        retry();
        first.abort();
        first.reply({ MediaContainer: { size: 0, totalSize: 0 } });
        f.tick();
        assert.equal(f.requests.length, count, method);
        assert.equal(callbacks, 0, method);
    }
    const f = fixture();
    let result;
    f.client.collect(target, (value) => (result = value));
    f.advance(118500);
    last(f).fail(0);
    f.advance(500);
    f.tick();
    assert.equal(last(f).options.timeout, 1000);
    f.advance(800);
    last(f).fail(0);
    assert.equal(f.timerDelays.at(-1), 200);
    f.advance(200);
    f.tick();
    assert.equal(result.error, "Unable to load playlist");
    assert.equal(f.requests.length, 2);
    assert.equal(f.timers.size, 0);
});

test("collection transport errors and unsupported targets fail safely without partial queues", () => {
    const f = fixture();
    let result;
    f.client.collect(
        { path: "/library/sections/1/all", plexSource: source },
        (value) => (result = value)
    );
    last(f).fail(400);
    assert.equal(result.error, "Unable to load playlist");
    assert.equal(result.items.length, 0);
    assert(!JSON.stringify(result).includes(token));
    for (const target of [
        "plexsearch?search=film",
        { path: "/hubs/search", plexSource: source, query: "film" },
        { path: "/library/parts/1/file", plexSource: source },
        { path: "/library/sections/1/all", plexSource: "other" },
    ]) {
        const count = f.requests.length;
        f.client.collect(target, (value) => (result = value));
        assert.equal(result.error, "Unable to load playlist");
        assert.equal(f.requests.length, count);
    }
});

test("collection time, page and retained data budgets fail closed", () => {
    const target = { path: "/library/sections/1/all", plexSource: source };
    const timed = fixture();
    let expired;
    timed.client.collect(target, (value) => (expired = value));
    assert.equal(last(timed).options.timeout, 30000);
    timed.advance(120001);
    last(timed).reply({ MediaContainer: { size: 0, totalSize: 0 } });
    assert.equal(expired.error, "Unable to load playlist");
    assert.equal(expired.items.length, 0);

    const paged = fixture();
    let limited;
    paged.client.collect(target, (value) => (limited = value));
    for (let attempt = 0; attempt < 2; attempt++) {
        last(paged).fail(503);
        paged.tick();
    }
    for (let index = 0; index < 1000; index++) {
        last(paged).reply({
            MediaContainer: {
                Directory: [
                    { key: "/library/metadata/" + index, title: "Folder" },
                ],
                offset: index,
                size: 1,
                totalSize: 1001,
            },
        });
        paged.tick();
    }
    assert.equal(limited.error, "Unable to load playlist");
    assert.equal(limited.items.length, 0);
    assert.equal(paged.requests.length, 1002);

    const large = fixture();
    let overflow;
    large.client.collect(target, (value) => (overflow = value));
    for (let index = 0; index < 2; index++) {
        last(large).reply({
            MediaContainer: {
                Metadata: [
                    {
                        ratingKey: String(index + 1),
                        summary: "x".repeat(5 * 1024 * 1024),
                        title: "Film",
                        type: "movie",
                    },
                ],
                offset: index,
                size: 1,
                totalSize: 2,
            },
        });
        large.tick();
    }
    assert.equal(overflow.error, "Unable to load playlist");
    assert.equal(overflow.items.length, 0);
    assert.equal(overflow.records.length, 0);
});

test("retained folder metadata shares the collection byte budget and never escapes as a partial catalog", () => {
    const f = fixture();
    let result;
    f.client.collect(
        { path: "/library/sections/1/folder?parent=17", plexSource: source },
        (value) => (result = value)
    );
    for (let index = 0; index < 2; index++) {
        last(f).reply({
            MediaContainer: {
                Directory: [
                    {
                        key:
                            "/library/sections/1/folder?parent=" + (index + 18),
                        summary: "x".repeat(5 * 1024 * 1024),
                        title: "Child " + index,
                    },
                ],
                offset: index,
                size: 1,
                totalSize: 2,
            },
        });
        f.tick();
    }
    assert.equal(result.error, "Unable to load playlist");
    assert.equal(result.records.length, 0);
    assert.equal(result.items.length, 0);
    assert.equal(f.timers.size, 0);
});

test("synchronous collection responses yield between pages and navigation cancellation stays separate", () => {
    const f = fixture();
    const pages = [];
    f.host.$.ajax = (options) => {
        const offset = Number(options.headers["X-Plex-Container-Start"]);
        pages.push(offset);
        options.success({
            MediaContainer: {
                Metadata: [
                    {
                        ratingKey: String(offset + 1),
                        title: "Film",
                        type: "movie",
                    },
                ],
                offset,
                size: 1,
                totalSize: 2,
            },
        });
        return {
            abort: () => assert.fail("completed request must not be aborted"),
        };
    };
    let result;
    f.client.collect(
        { path: "/library/sections/1/all", plexSource: source },
        (value) => (result = value)
    );
    assert.deepEqual(pages, [0]);
    f.client.cancel();
    f.tick();
    assert.deepEqual(pages, [0, 1]);
    assert.equal(result.items.length, 2);
    assert.equal(f.host.mediaName, "untouched");
});

test("search pages flattened hub media locally and metadata uses PMS pagination headers", () => {
    const f = fixture();
    f.client.load("plexsearch?search=two%20words", () => {});
    assert.equal(parsed(f).searchParams.get("query"), "two words");
    assert.equal(parsed(f).searchParams.get("limit"), "200");
    assert.equal(last(f).options.headers["X-Plex-Container-Start"], "0");
    assert.equal(last(f).options.headers["X-Plex-Container-Size"], "1000");
    last(f).reply({
        MediaContainer: {
            Hub: [
                {
                    Metadata: Array.from({ length: 200 }, (_, index) => ({
                        ratingKey: String(index + 1),
                        title: "Fixture",
                        type: "movie",
                    })),
                },
                {
                    Metadata: [
                        { ratingKey: "201", title: "Last", type: "movie" },
                    ],
                },
            ],
            size: 2,
            totalSize: 2,
        },
    });
    assert.equal(f.host.mediaRecords.length, 201);
    const next = f.host.mediaRecords.at(-1).playlist_url;
    assert.equal(next.offset, 200);
    assert.equal(next.query, "two words");
    f.client.load(next, () => {});
    assert.equal(
        f.requests.length,
        1,
        "next search page reuses one bounded hub snapshot"
    );
    assert.equal(f.host.mediaRecords.length, 1);
    assert.equal(f.host.mediaRecords[0].request.path, "/library/metadata/201");
    f.client.load(
        { offset: 200, path: "/library/sections/1/all", plexSource: source },
        () => {}
    );
    assert.equal(last(f).options.headers["X-Plex-Container-Start"], "200");
    assert.equal(last(f).options.headers["X-Plex-Container-Size"], "200");
    last(f).reply({
        MediaContainer: {
            Metadata: [{ ratingKey: "202", title: "Last", type: "movie" }],
            size: 1,
            totalSize: 202,
        },
    });
    assert.equal(f.host.mediaRecords[0].request.path, "/library/metadata/202");
    assert.equal(f.host.mediaRecords.at(-1).playlist_url.offset, 201);
});

test("stale loads, retired profiles, unsafe keys and XML failures cannot publish or leak errors", () => {
    const f = fixture();
    let completed = 0;
    f.client.load("", () => completed++);
    const stale = last(f);
    f.client.load(
        { path: "/library/sections/1/all", plexSource: source },
        () => completed++
    );
    stale.reply({
        MediaContainer: { Directory: [{ key: "1", title: "stale" }] },
    });
    assert.equal(completed, 0);
    last(f).reply("<!DOCTYPE MediaContainer><MediaContainer/>");
    assert.equal(completed, 1);
    assert(!JSON.stringify(f.messages).includes(token));
    for (const path of [
        "//attacker.invalid/library/metadata/1",
        "/library/metadata/../admin",
        "/library/metadata/%2e%2e/admin",
        "/library/metadata/42?X-Plex-Token=leaked",
    ])
        f.client.load({ path, plexSource: source }, () => {});
    assert.equal(f.requests.length, 2);
    f.client.load("", () => completed++);
    f.retire();
    last(f).reply({ MediaContainer: {} });
    assert.equal(completed, 1);
});

test("metadata resolution retries transient reads once per attempt and preserves request ownership", () => {
    for (const status of [0, 408, 429, 500, 503, 599]) {
        const f = fixture({ playback: "original" });
        const results = [];
        f.client.resolve(film, (value) => results.push(value));
        const first = last(f);
        first.fail(status);
        first.fail(status);
        first.reply(metadata());
        assert.equal(results.length, 0);
        assert.equal(f.timers.size, 1);
        f.tick();
        assert.equal(last(f).options.url, first.options.url);
        last(f).fail(status);
        f.tick();
        assert.deepEqual(f.timerDelays, [500, 1000]);
        const final = last(f);
        final.reply(metadata());
        final.fail(status);
        final.reply(metadata());
        assert.equal(f.requests.length, 3);
        assert.equal(results.length, 1);
        assert.equal(results[0].__ottNativeFile, true);
        assert.equal(f.messages.length, 0);
        assert.equal(f.timers.size, 0);
    }
    const nested = fixture();
    nested.client.resolve(film, () =>
        assert.fail("Cancelled decision cannot resolve")
    );
    last(nested).fail(0);
    nested.tick();
    last(nested).reply(metadata());
    const decision = last(nested);
    nested.client.cancel();
    assert.equal(decision.aborted, true);
});

test("metadata retry exhaustion reports one error while authentication and parse errors never retry", () => {
    const f = fixture();
    const results = [];
    f.client.resolve(film, (value) => results.push(value));
    for (let attempt = 0; attempt < 3; attempt++) {
        last(f).fail(503);
        f.tick();
    }
    assert.equal(f.requests.length, 3);
    assert.deepEqual(results, [null]);
    assert.deepEqual(f.messages, ["Plex connection failed"]);
    for (const fail of [
        ...[400, 401, 403, 404, 422].map((status) => (r) => r.fail(status)),
        (r) => r.fail(503, "parsererror"),
        (r) => r.reply("<broken"),
    ]) {
        const g = fixture();
        const outcomes = [];
        g.client.resolve(film, (value) => outcomes.push(value));
        fail(last(g));
        g.tick();
        assert.equal(g.requests.length, 1);
        assert.deepEqual(outcomes, [null]);
        assert.deepEqual(g.messages, ["Plex connection failed"]);
    }
});

test("metadata retry timers cannot revive cancelled or superseded playback", () => {
    for (const action of [
        "cancel",
        "replace",
        "retire",
        "dispose",
        "pagehide",
    ]) {
        const f = fixture({ playback: "original" });
        let callbacks = 0;
        f.client.resolve(film, () => callbacks++);
        const first = last(f);
        first.fail(0);
        const retry = [...f.timers.values()][0];
        if (action === "replace") f.client.resolve(film, () => {});
        else if (action === "retire") f.retire();
        else if (action === "pagehide") f.events.get("pagehide")();
        else f.client[action]();
        const count = f.requests.length;
        retry();
        first.abort();
        first.reply(metadata());
        f.tick();
        assert.equal(f.requests.length, count, action);
        assert.equal(callbacks, 0, action);
        assert.equal(f.messages.length, 0, action);
    }
});

test("native original admission resolves a fresh authenticated stream and persists only stable metadata", () => {
    const f = fixture({}, { native: () => "probably" });
    let played;
    f.client.resolve(film, (value) => (played = value));
    last(f).reply(metadata());
    assert.equal(f.requests.length, 1);
    assert.equal(played.__ottPlexPlayback.type, "file");
    assert.equal(played.__ottNativeFile, true);
    assert.equal(
        new URL(played.stream_url).searchParams.get("X-Plex-Token"),
        token
    );
    const saved = f.client.persist({
        ...played,
        nested: { artwork: played.stream_url, safe: "metadata" },
    });
    assert.equal(saved.stream_url, undefined);
    assert.equal(saved.__ottPlexPlayback, undefined);
    assert.equal(saved.request.path, film.request.path);
    assert.equal(saved.nested.safe, "metadata");
    assert(!JSON.stringify(saved).includes(token));
    f.client.resolve(saved, (value) => (played = value));
    last(f).reply(
        metadata({ Part: [{ key: "/library/parts/2/renewed.mp4" }] })
    );
    assert.equal(
        new URL(played.stream_url).pathname,
        "/library/parts/2/renewed.mp4"
    );
});

test("Automatic picks a supported single-file version before starting a Plex encoder", () => {
    const f = fixture(
        {},
        { native: (mime) => (mime.startsWith("video/mp4") ? "probably" : "") }
    );
    const response = metadata({ container: "mkv", videoCodec: "hevc" });
    const alternate = metadata().MediaContainer.Metadata[0].Media[0];
    alternate.Part[0].key = "/library/parts/2/compatible.mp4";
    response.MediaContainer.Metadata[0].Media.push(alternate);
    const before = JSON.stringify(response);
    let played;
    f.client.resolve(film, (value) => (played = value));
    last(f).reply(response);
    assert.equal(
        f.requests.length,
        1,
        "no conversion needed for a supported version"
    );
    assert.equal(
        new URL(played.stream_url).pathname,
        "/library/parts/2/compatible.mp4"
    );
    assert.equal(played.__ottPlexPlayback.type, "file");
    assert.equal(
        JSON.stringify(response),
        before,
        "planning does not rewrite server metadata"
    );
});

test("explicit playback modes keep the default version even when another version is playable", () => {
    for (const playback of ["original", "compatible"]) {
        const f = fixture({ playback }, { native: () => "probably" });
        const response = metadata({ container: "mkv" });
        response.MediaContainer.Metadata[0].Media.push(
            metadata().MediaContainer.Metadata[0].Media[0]
        );
        let played;
        f.client.resolve(film, (value) => (played = value));
        last(f).reply(response);
        if (playback === "compatible") {
            assert.equal(parsed(f).searchParams.get("mediaIndex"), "0");
            assert.equal(parsed(f).searchParams.get("partIndex"), "0");
            last(f).reply({ MediaContainer: { transcodeDecisionCode: 1001 } });
        }
        assert.equal(
            played.__ottPlexPlayback.type,
            playback === "original" ? "file" : "hls"
        );
    }
});

test("unavailable first version negotiates the actual alternate index and never skips within a split movie", () => {
    const f = fixture();
    const response = metadata({ Part: [] });
    response.MediaContainer.Metadata[0].Media.push(
        metadata().MediaContainer.Metadata[0].Media[0]
    );
    let played;
    f.client.resolve(film, (value) => (played = value));
    last(f).reply(response);
    assert.equal(parsed(f).searchParams.get("mediaIndex"), "1");
    assert.equal(parsed(f).searchParams.get("partIndex"), "0");
    last(f).reply({ MediaContainer: { transcodeDecisionCode: 1001 } });
    const url = new URL(played.stream_url);
    assert.equal(url.searchParams.get("mediaIndex"), "1");
    assert.equal(url.searchParams.get("partIndex"), "0");

    const split = fixture({ playback: "original" });
    const splitResponse = metadata({
        Part: [
            { key: "https://foreign.invalid/part-one" },
            { key: "/library/parts/2/part-two.mp4" },
        ],
    });
    let rejected;
    split.client.resolve(film, (value) => (rejected = value));
    last(split).reply(splitResponse);
    assert.equal(
        rejected,
        null,
        "the second half of a movie is not an alternate version"
    );
    assert.equal(split.requests.length, 1);
});

test("version optimization does not replace or select a multipart presentation", () => {
    for (const splitIndex of [0, 1]) {
        const f = fixture({}, { native: () => "probably" });
        const response = metadata({ container: "mkv" });
        response.MediaContainer.Metadata[0].Media.push(
            metadata().MediaContainer.Metadata[0].Media[0]
        );
        response.MediaContainer.Metadata[0].Media[splitIndex].Part.push({
            key: "/library/parts/3/second-half.mp4",
        });
        f.client.resolve(film, () => {});
        last(f).reply(response);
        assert.equal(
            parsed(f).pathname,
            "/video/:/transcode/universal/decision"
        );
        assert.equal(parsed(f).searchParams.get("mediaIndex"), "0");
        assert.equal(parsed(f).searchParams.get("partIndex"), "0");
    }
});

test("pure playback policy stays conservative for unknown probes, incomplete alternates and large version lists", () => {
    const f = fixture();
    const policy = f.host.__ottPlexPlaybackPolicy;
    const variant = metadata().MediaContainer.Metadata[0].Media[0];
    const unsupported = { ...variant, container: "mkv" };
    const ports = { canPlayType: () => "probably", path: (key) => key || "" };
    assert.equal(
        policy.plan([unsupported, { Part: variant.Part }], "auto", ports)
            .mediaIndex,
        0
    );
    assert.equal(
        policy.plan(
            [unsupported, { ...variant, videoProfile: "High 10" }],
            "auto",
            ports
        ).mediaIndex,
        0
    );
    assert.equal(
        policy.plan([variant], "auto", {
            ...ports,
            canPlayType: () => {
                throw new Error("unknown decoder");
            },
        }).direct,
        false
    );
    assert.equal(
        policy.plan(Array(32).fill(unsupported).concat(variant), "auto", ports)
            .mediaIndex,
        0
    );
    assert.equal(f.requests.length, 0, "policy makes no transport requests");
});

test("Automatic sends known high-bit-depth AVC through Plex compatibility negotiation", () => {
    for (const [label, overrides] of [
        [
            "numeric video bit depth",
            {
                Part: [
                    {
                        key: "/library/parts/1/file.mp4",
                        Stream: [{ bitDepth: 10, streamType: 1 }],
                    },
                ],
            },
        ],
        [
            "string video bit depth",
            {
                Part: [
                    {
                        key: "/library/parts/1/file.mp4",
                        Stream: [{ bitDepth: "10", streamType: "1" }],
                    },
                ],
            },
        ],
        ["media High 10 profile", { videoProfile: "high 10" }],
        [
            "video High 10 profile without bit depth",
            {
                Part: [
                    {
                        key: "/library/parts/1/file.mp4",
                        Stream: [{ profile: "High 10 Intra", streamType: 1 }],
                    },
                ],
            },
        ],
    ]) {
        const queries = [];
        const f = fixture(
            {},
            {
                native(mime) {
                    queries.push(mime);
                    return mime.includes("avc1.42E01E") ? "probably" : "";
                },
            }
        );
        let played;
        f.client.resolve(film, (value) => (played = value));
        last(f).reply(metadata(overrides));
        assert.equal(
            parsed(f).pathname,
            "/video/:/transcode/universal/decision",
            label
        );
        assert.equal(played, undefined, label);
        assert(!queries.some((mime) => mime.includes("avc1.42E01E")), label);
        last(f).reply({ MediaContainer: { transcodeDecisionCode: 1001 } });
        assert.equal(played.__ottPlexPlayback.type, "hls", label);
        assert.equal(played.__ottNativeFile, undefined, label);
    }
});

test("XML High 10 metadata uses the same Automatic compatibility path", () => {
    const f = fixture({}, { native: () => "probably" });
    let played;
    f.client.resolve(film, (value) => (played = value));
    last(f).reply(
        '<MediaContainer><Video ratingKey="42" type="movie"><Media videoCodec="h264" audioCodec="aac" container="mp4"><Part key="/library/parts/1/file.mp4"><Stream streamType="1" bitDepth="10" profile="high 10"/></Part></Media></Video></MediaContainer>'
    );
    assert.equal(parsed(f).pathname, "/video/:/transcode/universal/decision");
    assert.equal(played, undefined);
    last(f).reply({ MediaContainer: { transcodeDecisionCode: 1001 } });
    assert.equal(played.__ottPlexPlayback.type, "hls");
});

test("ordinary and incomplete AVC metadata retain native Automatic admission", () => {
    for (const overrides of [
        {},
        { videoProfile: "baseline" },
        {
            Part: [
                {
                    key: "/library/parts/1/file.mp4",
                    Stream: [{ bitDepth: 8, level: 42, streamType: 1 }],
                },
            ],
            videoProfile: "high",
        },
        { videoProfile: "unknown" },
        {
            Part: [
                {
                    key: "/library/parts/1/file.mp4",
                    Stream: [
                        { bitDepth: 24, streamType: 2 },
                        { streamType: 1 },
                    ],
                },
            ],
        },
    ]) {
        const f = fixture({}, { native: () => "probably" });
        let played;
        f.client.resolve(film, (value) => (played = value));
        last(f).reply(metadata(overrides));
        assert.equal(f.requests.length, 1);
        assert.equal(played.__ottPlexPlayback.type, "file");
    }
    const original = fixture({ playback: "original" });
    let played;
    original.client.resolve(film, (value) => (played = value));
    last(original).reply(metadata({ videoProfile: "high 10" }));
    assert.equal(original.requests.length, 1);
    assert.equal(played.__ottPlexPlayback.type, "file");
});

test("unknown native codec falls back to negotiated HLS and cancellation owns the nested decision request", () => {
    const f = fixture();
    let played = false;
    f.client.resolve(film, () => (played = true));
    last(f).reply(metadata());
    const decision = last(f);
    assert.equal(parsed(f).pathname, "/video/:/transcode/universal/decision");
    f.client.cancel();
    assert.equal(
        decision.aborted,
        true,
        "metadata completion must not clear its nested request owner"
    );
    decision.reply({ MediaContainer: { transcodeDecisionCode: 1001 } });
    assert.equal(played, false);
    assert.equal(f.intervals.size, 0);
    assert.equal(parsed(f).pathname, "/video/:/transcode/universal/stop");
});

test("resolution failures return null once so cold restore can fall back to its catalog", () => {
    const cases = [
        { item: null },
        { item: { ...film, plexSource: "another-account" } },
        { item: { ...film, request: { path: "/library/metadata/../admin" } } },
        { reply: { MediaContainer: {} } },
        { reply: metadata({ Part: [] }) },
        {
            reply: metadata({
                Part: [{ key: "https://foreign.invalid/file" }],
            }),
        },
        { reply: "<!DOCTYPE MediaContainer><MediaContainer/>" },
        { fail: true },
        { decision: { MediaContainer: { transcodeDecisionCode: 2001 } } },
        { decision: "<broken" },
        { decisionFail: true },
    ];
    for (const scenario of cases) {
        const f = fixture();
        const resolved = [];
        f.client.resolve(
            Object.hasOwn(scenario, "item") ? scenario.item : film,
            (value) => resolved.push(value)
        );
        if (Object.hasOwn(scenario, "item")) {
            assert.equal(f.requests.length, 0);
        } else {
            const metadataRequest = last(f);
            if (scenario.fail) metadataRequest.fail(401);
            else if (scenario.decision || scenario.decisionFail) {
                metadataRequest.reply(metadata());
                const decision = last(f);
                if (scenario.decisionFail) decision.fail();
                else decision.reply(scenario.decision);
                assert.equal(
                    parsed(f).pathname,
                    "/video/:/transcode/universal/stop"
                );
                decision.fail();
                decision.reply({
                    MediaContainer: { transcodeDecisionCode: 1001 },
                });
            } else metadataRequest.reply(scenario.reply);
            metadataRequest.fail();
            metadataRequest.reply(metadata());
        }
        assert.deepEqual(resolved, [null]);
        assert.deepEqual(f.messages, ["Plex connection failed"]);
        assert.equal(f.intervals.size, 0);
        assert(!JSON.stringify(f.messages).includes(token));
        assert.equal(f.host.mediaName, "untouched");
        assert.deepEqual(f.host.mediaRecords, ["untouched"]);
    }
});

test("resolution fallback cannot run after cancellation, replacement, retirement or reentrant navigation", () => {
    for (const decisionStage of [false, true]) {
        for (const action of [
            "cancel",
            "replace",
            "retire",
            "dispose",
            "pagehide",
        ]) {
            const f = fixture();
            let callbacks = 0;
            f.client.resolve(film, () => callbacks++);
            if (decisionStage) last(f).reply(metadata());
            const pending = last(f);
            if (action === "replace") f.client.load("", () => {});
            else if (action === "retire") f.retire();
            else if (action === "pagehide") f.events.get("pagehide")();
            else f.client[action]();
            pending.fail();
            pending.reply(
                decisionStage
                    ? { MediaContainer: { transcodeDecisionCode: 2001 } }
                    : { MediaContainer: {} }
            );
            assert.equal(callbacks, 0, action);
            assert.equal(f.messages.length, 0, action);
            assert.equal(f.intervals.size, 0, action);
        }
    }
    const f = fixture();
    let callbacks = 0;
    f.host.infoBox = () => f.retire();
    f.client.resolve(film, () => callbacks++);
    last(f).fail(401);
    assert.equal(
        callbacks,
        0,
        "the visible failure retired the source before fallback"
    );
});

test("resolution failure releases its owned wait before the error and retains cancellation guards", () => {
    for (const cancel of [false, true]) {
        const f = fixture(),
            events = [];
        const done = (value) => events.push(value);
        done.beforeError = () => {
            events.push("release wait");
            if (cancel) f.client.cancel();
        };
        f.host.infoBox = () => events.push("visible error");
        f.client.resolve(film, done);
        last(f).fail(401);
        assert.deepEqual(
            events,
            cancel ? ["release wait"] : ["release wait", "visible error", null]
        );
    }
});

test("HEVC HLS preserves source resolution only when the actual MSE codec is supported", () => {
    for (const [supported, hls] of [
        [false, true],
        [true, false],
        [true, true],
    ]) {
        const f = fixture({}, { hls, mse: () => supported });
        let played;
        f.client.resolve(film, (value) => {
            played = value;
        });
        last(f).reply(
            metadata({
                audioCodec: "opus",
                container: "mkv",
                height: 2160,
                videoCodec: "hevc",
                width: 3840,
            })
        );
        assert.equal(
            parsed(f).searchParams.get("videoResolution"),
            supported && hls ? "3840x2160" : "1920x1080"
        );
        assert.equal(
            parsed(f).searchParams.has("X-Plex-Client-Profile-Extra"),
            supported && hls
        );
        if (supported && hls)
            assert.equal(
                parsed(f).searchParams.get("X-Plex-Client-Profile-Extra"),
                "add-transcode-target(type=videoProfile&context=streaming&protocol=hls&container=mp4&videoCodec=h264,hevc&audioCodec=aac&replace=true)"
            );
        last(f).reply({ MediaContainer: { transcodeDecisionCode: 1001 } });
        assert.equal(
            played.__ottPlexPlayback.engine,
            supported && hls ? "mse" : undefined
        );
        f.client.dispose();
    }
});

test("first HEVC resolution lazily loads HLS before negotiating and ignores a retired resolve", () => {
    for (const cancel of [false, true]) {
        const f = fixture({}, { mse: () => true });
        delete f.host.Hls;
        const loads = [];
        f.host.__ottLoadMediaEngine = (engine, done) =>
            loads.push({ done, engine });
        let played;
        f.client.resolve(film, (value) => {
            played = value;
        });
        last(f).reply(
            metadata({
                audioCodec: "opus",
                container: "mkv",
                height: 2160,
                videoCodec: "hevc",
                width: 3840,
            })
        );
        assert.equal(loads.length, 1);
        assert.equal(loads[0].engine, "hls");
        assert.equal(
            f.requests.length,
            1,
            "No server negotiation precedes the required codec decision"
        );
        if (cancel) f.client.cancel();
        f.host.Hls = { isSupported: () => true };
        loads[0].done(true);
        if (cancel) {
            assert.equal(f.requests.length, 1);
            assert.equal(played, undefined);
        } else {
            assert.equal(
                parsed(f).searchParams.get("videoResolution"),
                "3840x2160"
            );
            assert(parsed(f).searchParams.has("X-Plex-Client-Profile-Extra"));
        }
        f.client.dispose();
    }
});

test("HEVC loader failure keeps compatible transcoding and non-HEVC never loads HLS", () => {
    const f = fixture({}, { mse: () => true });
    delete f.host.Hls;
    let done;
    f.host.__ottLoadMediaEngine = (_engine, callback) => {
        done = callback;
    };
    f.client.resolve(film, () => {});
    last(f).reply(
        metadata({ audioCodec: "opus", container: "mkv", videoCodec: "hevc" })
    );
    done(false);
    assert(!parsed(f).searchParams.has("X-Plex-Client-Profile-Extra"));
    f.client.dispose();
    const ordinary = fixture();
    delete ordinary.host.Hls;
    ordinary.host.__ottLoadMediaEngine = () => {
        throw new Error("Unexpected engine download");
    };
    ordinary.client.resolve(film, () => {});
    last(ordinary).reply(metadata());
    assert.equal(
        parsed(ordinary).pathname,
        "/video/:/transcode/universal/decision"
    );
    ordinary.client.dispose();
});

test("HLS heartbeat survives browsing, never overlaps, stops on replacement and cannot revive disposed playback", () => {
    const f = fixture();
    let played;
    f.client.resolve(film, (item) => (played = item));
    last(f).reply(metadata());
    const id = parsed(f).searchParams.get("session");
    last(f).reply({ MediaContainer: { transcodeDecisionCode: 1001 } });
    assert.equal(played.__ottPlexPlayback.type, "hls");
    assert.equal(new URL(played.stream_url).searchParams.get("session"), id);
    const timer = [...f.intervals.values()][0];
    assert.equal(timer.delay, 30000);
    f.client.load("", () => {});
    last(f).reply({ MediaContainer: {} });
    timer.run();
    const ping = last(f);
    const count = f.requests.length;
    timer.run();
    assert.equal(f.requests.length, count);
    f.client.stop("https://unrelated.invalid/video");
    assert.equal(f.intervals.size, 1);
    f.client.resolve(film, () => {});
    assert.equal(ping.aborted, true);
    assert.equal(f.intervals.size, 0);
    assert.equal(parsed(f).pathname, "/video/:/transcode/universal/stop");
    assert.equal(parsed(f).searchParams.get("session"), id);
    last(f).reply("");
    assert.equal(parsed(f).pathname, "/library/metadata/42");
    f.client.dispose();
    const disposed = f.requests.length;
    timer.run();
    assert.equal(f.requests.length, disposed);
});

test("explicit Original bypasses uncertain probes and connection failures expose fixed text only", () => {
    const f = fixture({ playback: "original" });
    let played;
    f.client.resolve(film, (item) => (played = item));
    last(f).reply(
        metadata({ audioCodec: "opus", container: "mkv", videoCodec: "hevc" })
    );
    assert.equal(played.__ottPlexPlayback.mime, "video/x-matroska");
    assert.equal(f.requests.length, 1);
    let error;
    f.client.connect((message) => (error = message));
    last(f).fail(401);
    assert.equal(error, "Plex connection failed");
    assert(!JSON.stringify(f.messages).includes(token));
});

test("pagehide releases only its owned session with a credential-free keepalive GET and dispose removes handler", () => {
    const f = fixture();
    f.client.resolve(film, () => {});
    last(f).reply(metadata());
    const session = parsed(f).searchParams.get("session");
    last(f).reply({ MediaContainer: { transcodeDecisionCode: 1001 } });
    const before = f.requests.length;
    f.events.get("pagehide")();
    assert.equal(f.intervals.size, 0);
    assert.equal(f.requests.length, before);
    assert.equal(f.keepalive.length, 1);
    assert.equal(
        new URL(f.keepalive[0].url).pathname,
        "/video/:/transcode/universal/stop"
    );
    assert.equal(
        new URL(f.keepalive[0].url).searchParams.get("session"),
        session
    );
    assert.equal(f.keepalive[0].options.credentials, "omit");
    assert.equal(f.keepalive[0].options.keepalive, true);
    assert.equal(f.keepalive[0].options.method, "GET");
    f.events.get("pagehide")();
    assert.equal(f.keepalive.length, 1);
    f.client.dispose();
    assert.equal(f.events.has("pagehide"), false);
});
test("pagehide releases Plex before an earlier queue stop listener and removes the same capture listener", () => {
    const dom = new JSDOM();
    const target = dom.window;
    let f;
    target.addEventListener("pagehide", () => f.client.stop());
    let handler;
    let calls = 0;
    const eventTarget = {
        addEventListener(event, listener, capture) {
            handler = () => {
                calls++;
                listener();
            };
            target.addEventListener(event, handler, capture);
        },
        removeEventListener(event, _listener, capture) {
            target.removeEventListener(event, handler, capture);
        },
    };
    f = fixture({}, { eventTarget });
    f.client.resolve(film, () => {});
    last(f).reply(metadata());
    last(f).reply({ MediaContainer: { transcodeDecisionCode: 1001 } });
    const before = f.requests.length;
    target.dispatchEvent(new target.Event("pagehide"));
    assert.equal(f.keepalive.length, 1);
    assert.equal(f.requests.length, before, "No unload stop XHR is issued");
    assert.equal(f.intervals.size, 0);
    target.dispatchEvent(new target.Event("pagehide"));
    assert.equal(
        f.keepalive.length,
        1,
        "The released session cannot stop twice"
    );
    assert.equal(calls, 2);
    f.client.dispose();
    target.dispatchEvent(new target.Event("pagehide"));
    assert.equal(calls, 2, "Dispose removes the capture listener");
    dom.window.close();
});

test("cursor rows are explicit and selected folder titles override generic server labels", () => {
    const f = fixture();
    f.client.load(
        {
            path: "/library/sections/1/folder?parent=9",
            plexSource: source,
            title: "Actual folder",
        },
        () => {}
    );
    last(f).reply({
        MediaContainer: {
            Directory: [
                { key: "/library/sections/1/folder?parent=10", title: "Next" },
            ],
            size: 1,
            title1: "Folder",
            title2: "Folder",
            totalSize: 2,
        },
    });
    assert.equal(f.host.mediaName, "Actual folder");
    assert.equal(f.host.mediaRecords[0].__ottMediaNext, undefined);
    const next = f.host.mediaRecords[1];
    assert.equal(next.__ottMediaNext, true);
    assert.equal(next.playlist_url.title, "Actual folder");
    let following;
    f.client.page(next.playlist_url, (value) => (following = value));
    last(f).reply({
        MediaContainer: {
            Directory: [
                {
                    key: "/library/sections/1/folder?parent=11",
                    title: "Same name",
                },
                {
                    key: "/library/sections/1/folder?parent=12",
                    title: "Same name",
                },
            ],
            offset: 1,
            size: 2,
            totalSize: 3,
        },
    });
    assert.equal(following.items.length, 2);
    assert.notEqual(
        following.items[0].playlist_url.path,
        following.items[1].playlist_url.path
    );
    assert(!following.items.some((row) => row.__ottMediaNext));
    f.client.collect(
        { path: "/library/sections/1/all", plexSource: source },
        (value) => {
            assert(!value.records.some((row) => row.__ottMediaNext));
        }
    );
    last(f).reply({
        MediaContainer: {
            Metadata: [{ ratingKey: "1", title: "Film", type: "movie" }],
            size: 1,
            totalSize: 1,
        },
    });
});

test("unknown catalog totals retain quiet pagination through full pages and stop at short or empty pages", () => {
    for (const total of [200, 403]) {
        const f = fixture();
        const route = {
            path: "/library/metadata/10/children",
            plexSource: source,
            title: "Episodes",
        };
        function reply(offset) {
            last(f).reply({
                MediaContainer: {
                    Metadata: Array.from(
                        { length: Math.min(200, total - offset) },
                        (_, i) => ({
                            ratingKey: String(offset + i + 1),
                            title: "Episode " + (offset + i + 1),
                            type: "episode",
                        })
                    ),
                    offset,
                },
            });
        }
        f.client.load(route, () => {});
        reply(0);
        let rows = f.host.mediaRecords;
        const initial = JSON.stringify(rows);
        const ids = [];
        for (let step = 0; step < 4; step++) {
            ids.push(
                ...rows
                    .filter((row) => row.request)
                    .map((row) => row.request.path)
            );
            const cursor = rows.find((row) => row.__ottMediaNext);
            if (!cursor) break;
            assert.equal(cursor.playlist_url.offset, ids.length);
            f.client.page(cursor.playlist_url, (result) => {
                assert.equal(result.error, undefined);
                rows = result.items;
            });
            reply(cursor.playlist_url.offset);
        }
        assert.equal(ids.length, total);
        assert.equal(new Set(ids).size, total);
        assert.equal(
            rows.some((row) => row.__ottMediaNext),
            false
        );
        assert.equal(f.requests.length, Math.floor(total / 200) + 1);
        assert.equal(JSON.stringify(f.host.mediaRecords), initial);
    }
});

test("unknown-total cursors preserve offset and size guards and cannot grow beyond the catalog bound", () => {
    const route = {
        offset: 200,
        path: "/library/metadata/10/children",
        plexSource: source,
    };
    const rows = Array.from({ length: 200 }, (_, i) => ({
        ratingKey: String(i + 1),
        title: "Episode " + i,
        type: "episode",
    }));
    for (const response of [
        { Metadata: rows, offset: 0 },
        { Metadata: rows.concat(rows[0]), offset: 200 },
    ]) {
        const f = fixture();
        let result;
        f.client.page(route, (value) => (result = value));
        last(f).reply({ MediaContainer: response });
        assert(result.error);
        assert.equal(result.items.length, 0);
    }
    for (const response of [
        { Metadata: rows, offset: 200, size: 0 },
        { Metadata: rows, offset: 200, size: 201 },
        { Metadata: rows, offset: 99800 },
    ]) {
        const f = fixture();
        let result;
        f.client.page(
            { ...route, offset: response.offset },
            (value) => (result = value)
        );
        last(f).reply({ MediaContainer: response });
        assert.equal(
            result.items.some((row) => row.__ottMediaNext),
            false
        );
    }
});

test("quiet pages do not mutate navigation or cancel resolve and full collection", () => {
    const f = fixture({ playback: "original" });
    const target = {
        offset: 200,
        path: "/library/sections/1/all",
        plexSource: source,
        title: "Chosen folder",
    };
    let paged, played, collected;
    f.client.page(target, (value) => (paged = value));
    const page = last(f);
    assert.equal(page.options.headers["X-Plex-Container-Start"], "200");
    assert.equal(page.options.headers["X-Plex-Container-Size"], "200");
    f.client.resolve(film, (value) => (played = value));
    const resolve = last(f);
    f.client.collect({ ...target, offset: 0 }, (value) => (collected = value));
    const collect = last(f);
    page.reply({
        MediaContainer: {
            Metadata: [{ ratingKey: "43", title: "Following", type: "movie" }],
            offset: 200,
            size: 1,
            title2: "Folder",
            totalSize: 202,
        },
    });
    resolve.reply(metadata());
    collect.reply({ MediaContainer: { Metadata: [], size: 0, totalSize: 0 } });
    assert.equal(paged.items[0].request.path, "/library/metadata/43");
    assert.equal(paged.items[1].__ottMediaNext, true);
    assert.equal(paged.items[1].playlist_url.title, "Chosen folder");
    assert(played.stream_url);
    assert.equal(collected.items.length, 0);
    assert(!page.aborted && !resolve.aborted && !collect.aborted);
    assert.deepEqual(f.host.mediaRecords, ["untouched"]);
    assert.equal(f.host.mediaName, "untouched");
    assert.deepEqual(f.messages, []);
});

test("page errors are terminal and sanitized while cancellation or source retirement suppress late callbacks", () => {
    const target = {
        offset: 200,
        path: "/library/sections/1/all",
        plexSource: source,
    };
    for (const action of [
        "cancel",
        "supersede",
        "dispose",
        "pagehide",
        "retire",
    ]) {
        const f = fixture();
        let callbacks = 0;
        const cancel = f.client.page(target, () => callbacks++);
        const pending = last(f);
        if (action === "cancel") cancel();
        if (action === "supersede") f.client.page(target, () => {});
        if (action === "dispose") f.client.dispose();
        if (action === "pagehide") f.events.get("pagehide")();
        if (action === "retire") f.retire();
        pending.reply({ MediaContainer: {} });
        pending.fail();
        assert.equal(callbacks, 0, action);
        if (action !== "retire") assert(pending.aborted, action);
        assert.deepEqual(f.messages, []);
    }
    for (const reply of [
        null,
        "invalid " + token,
        { MediaContainer: { Metadata: [], offset: 0 } },
    ]) {
        const f = fixture();
        const values = [];
        f.client.page(target, (value) => values.push(value));
        if (reply === null) last(f).fail();
        else last(f).reply(reply);
        last(f).fail();
        assert.equal(values.length, 1);
        assert.equal(values[0].items.length, 0);
        assert(values[0].error);
        assert(!JSON.stringify(values).includes(token));
        assert.deepEqual(f.messages, []);
    }
    const retired = fixture();
    retired.client.dispose();
    retired.client.page(target, () => assert.fail("disposed page callback"));
    assert.equal(retired.requests.length, 0);
});

test("independent search paging reuses the flattened snapshot without publishing globals", () => {
    const f = fixture();
    f.client.load("plexsearch?search=Find", () => {});
    last(f).reply({
        MediaContainer: {
            Hub: [
                {
                    Metadata: Array.from({ length: 205 }, (_, i) => ({
                        ratingKey: String(i),
                        title: "Found " + i,
                        type: "movie",
                    })),
                },
            ],
        },
    });
    const before = JSON.stringify(f.host.mediaRecords);
    const cursor = f.host.mediaRecords.find(
        (row) => row.__ottMediaNext
    ).playlist_url;
    let result;
    f.client.page(cursor, (value) => (result = value));
    assert.equal(result.items.length, 5);
    assert(!result.items.some((row) => row.__ottMediaNext));
    assert.equal(f.requests.length, 1);
    assert.equal(JSON.stringify(f.host.mediaRecords), before);
});

test("page abort reentry preserves the newer page and never dispatches the interrupted request", () => {
    const f = fixture();
    const target = {
        offset: 200,
        path: "/library/sections/1/all",
        plexSource: source,
    };
    f.client.page(target, () => assert.fail("old page"));
    const old = last(f);
    const abort = old.abort.bind(old);
    let latest;
    old.abort = () => {
        abort();
        f.client.page({ ...target, offset: 600 }, (value) => (latest = value));
    };
    f.client.page({ ...target, offset: 400 }, () =>
        assert.fail("interrupted page")
    );
    assert.equal(f.requests.length, 2);
    assert.equal(parsed(f).searchParams.get("X-Plex-Container-Start"), "600");
    last(f).reply({ MediaContainer: { offset: 600, size: 0, totalSize: 600 } });
    assert.equal(latest.items.length, 0);
});

test("profile folders reject unsafe roots and normalize duplicate selections", () => {
    const f = fixture();
    const base = { address: "https://plex.invalid", token };
    for (const path of [
        "/library/sections",
        "https://other.invalid/x",
        "/library/parts/1/file",
        "/library/sections/1/all?X-Plex-Token=secret",
        "/library/sections/1/all?type=11",
        "/library/sections/1/all?type=100",
        "/library/sections/1/folder?parent=../2",
        "/library/metadata/4",
    ]) {
        assert.equal(
            f.api.normalizePlexConfig({
                ...base,
                folders: [{ path, title: "A" }],
            }),
            null
        );
    }
    const root = { path: "/library/sections/1/all?type=4", title: " A\nB " };
    const normalized = f.api.normalizePlexConfig({
        ...base,
        folders: [root, root],
    });
    assert.deepEqual(JSON.parse(JSON.stringify(normalized.folders)), [
        { ...root, title: "A B" },
    ]);
    for (const type of [1, 3, 4, 10]) {
        const path = "/library/sections/1/all?type=" + type;
        assert.equal(
            f.api.normalizePlexConfig({
                ...base,
                folders: [{ path, title: "Selected" }],
            }).folders[0].path,
            path
        );
    }
    assert.equal(f.api.normalizePlexConfig({ ...base, folders: "all" }), null);
});

function scanRow(id, title = "Film " + id) {
    return { ratingKey: String(id), title, type: "episode" };
}

test("selected folders publish before traversal finishes, flatten descendants and deduplicate overlapping roots", () => {
    const f = fixture(),
        batches = [],
        errors = [];
    f.client.scanFolders(
        [
            { path: "/library/sections/1/folder?parent=10", title: "Selected" },
            {
                path: "/library/metadata/20/children",
                title: "Overlapping child",
            },
        ],
        (rows, scanned) => batches.push({ rows, scanned }),
        (error) => errors.push(error)
    );
    assert.equal(parsed(f).pathname, "/library/sections/1/folder");
    last(f).reply({
        MediaContainer: {
            Metadata: [
                { ...scanRow(1), adult: "1" },
                {
                    key: "/library/metadata/20/children",
                    title: "Child",
                    type: "season",
                },
            ],
            size: 2,
            totalSize: 2,
        },
    });
    assert.equal(batches.length, 1);
    assert.equal(batches[0].rows[0].request.path, "/library/metadata/1");
    assert.equal(batches[0].rows[0].adult, 1);
    assert.equal(
        errors.length,
        0,
        "first playable file is available while descendants are pending"
    );
    f.tick(5000);
    assert.equal(parsed(f).pathname, "/library/metadata/20/children");
    last(f).reply({
        MediaContainer: {
            Metadata: [scanRow(1), scanRow(2)],
            size: 2,
            totalSize: 2,
        },
    });
    f.tick(5000);
    assert.equal(
        f.requests.length,
        2,
        "overlapping selected child is fetched once"
    );
    assert.deepEqual(
        batches.flatMap((batch) =>
            Array.from(batch.rows, (row) => row.request.path)
        ),
        ["/library/metadata/1", "/library/metadata/1", "/library/metadata/2"]
    );
    assert.deepEqual(errors, [undefined]);
    assert.equal(batches[1].rows[1].adult, 0);
    assert.equal(
        batches[1].rows[0].adult,
        1,
        "a duplicate cannot downgrade adult admission"
    );
    assert.deepEqual(
        Array.from(
            batches[1].rows[0].__ottMediaCategories,
            (category) => category.id
        ),
        [
            "plex:/library/sections/1/folder?parent=10",
            "plex:/library/metadata/20/children",
        ]
    );
    assert(
        !f.requests.some(
            (request) =>
                new URL(request.options.url).pathname === "/library/sections"
        ),
        "unselected libraries are never enumerated"
    );
});

test("profile scan pagination and playback resolution have independent ownership", () => {
    const f = fixture({ playback: "original" }),
        rows = [],
        complete = [];
    f.client.scanFolders(
        [{ path: "/library/sections/1/all?type=4", title: "Shows" }],
        (items) => rows.push(...items),
        (error) => complete.push(error)
    );
    const scan = last(f);
    let playback;
    f.client.resolve(film, (result) => (playback = result));
    const resolution = last(f);
    assert.equal(scan.aborted, false);
    scan.reply({
        MediaContainer: {
            Metadata: Array.from({ length: 200 }, (_, index) =>
                scanRow(index + 1)
            ),
            size: 200,
            totalSize: 201,
        },
    });
    assert.equal(rows.length, 200);
    assert.equal(resolution.aborted, false);
    resolution.reply(metadata());
    assert(playback.stream_url);
    f.tick(5000);
    assert.equal(parsed(f).searchParams.get("X-Plex-Container-Start"), "200");
    last(f).reply({
        MediaContainer: {
            Metadata: [scanRow(201)],
            offset: 200,
            size: 1,
            totalSize: 201,
        },
    });
    f.tick(5000);
    assert.equal(rows.length, 201);
    assert.deepEqual(complete, [undefined]);
});

test("missing roots and malformed repeated pages surface errors without admitting unselected content", () => {
    const f = fixture(),
        rows = [],
        errors = [];
    f.client.scanFolders(
        [{ path: "/library/sections/9/all?type=1", title: "Deleted" }],
        (batch) => rows.push(...batch),
        (error) => errors.push(error)
    );
    last(f).fail(404);
    assert.deepEqual(errors, ["Plex connection failed"]);
    assert.equal(rows.length, 0);
    f.client.scanFolders(
        [{ path: "/library/sections/1/all?type=4", title: "A" }],
        (batch) => rows.push(...batch),
        (error) => errors.push(error)
    );
    const page = Array.from({ length: 200 }, (_, index) => scanRow(index + 1));
    last(f).reply({ MediaContainer: { Metadata: page, size: 200 } });
    f.tick(5000);
    last(f).reply({
        MediaContainer: { Metadata: page, offset: 200, size: 200 },
    });
    assert.equal(rows.length, 200);
    assert.equal(errors.at(-1), "Invalid Plex response");
});

test("profile scan replacement, disposal, retirement and retry cancellation suppress old batches", () => {
    for (const action of ["replace", "dispose", "retire", "cancel"]) {
        const f = fixture();
        let calls = 0;
        const args = [
            [{ path: "/library/sections/1/all?type=4", title: "A" }],
            () => calls++,
            () => calls++,
        ];
        const cancel = f.client.scanFolders(...args);
        const pending = last(f);
        if (action === "replace") f.client.scanFolders(...args);
        else if (action === "dispose") f.client.dispose();
        else if (action === "retire") f.retire();
        else cancel();
        pending.reply({ MediaContainer: { Metadata: [scanRow(1)], size: 1 } });
        assert.equal(calls, 0, action);
    }
    const f = fixture();
    let calls = 0;
    const cancel = f.client.scanFolders(
        [{ path: "/library/sections/1/all?type=4", title: "A" }],
        () => calls++,
        () => calls++
    );
    last(f).fail(503);
    cancel();
    f.tick(5000);
    assert.equal(f.requests.length, 1);
    assert.equal(calls, 0);
});

test("profile folder picker separates selecting a library from browsing its filesystem roots", () => {
    const f = fixture();
    f.client.connect(() => {});
    last(f).reply({
        MediaContainer: {
            Directory: [
                { key: "1", title: "Shows", type: "show" },
                { key: "2", title: "Movies", type: "movie" },
            ],
        },
    });
    let result;
    f.client.folderChoices(null, (value) => (result = value));
    if (!result)
        last(f).reply({
            MediaContainer: {
                Directory: [
                    { key: "1", title: "Shows", type: "show" },
                    { key: "2", title: "Movies", type: "movie" },
                ],
            },
        });
    assert.equal(result.items[0].path, "/library/sections/1/all?type=4");
    assert.equal(result.items[0].browse.path, "/library/sections/1/folder");
    assert.equal(result.items[1].path, "/library/sections/2/all?type=1");
    assert.equal(
        result.items.length,
        2,
        "search is supplied by the standard channel Actions menu"
    );
});

test("selecting an artist library saves a track root and scans playable tracks in JSON and XML", () => {
    for (const response of [
        {
            MediaContainer: {
                Metadata: [{ ratingKey: "42", title: "Song", type: "track" }],
                size: 1,
                totalSize: 1,
            },
        },
        '<MediaContainer size="1" totalSize="1"><Track ratingKey="42" title="Song" type="track"/></MediaContainer>',
    ]) {
        const f = fixture();
        const libraries = {
            MediaContainer: {
                Directory: [{ key: "3", title: "Music", type: "artist" }],
            },
        };
        f.client.connect(() => {});
        last(f).reply(libraries);
        let choice;
        f.client.folderChoices(null, (result) => (choice = result.items[0]));
        if (!choice) last(f).reply(libraries);
        assert.equal(choice.path, "/library/sections/3/all?type=10");
        assert.equal(choice.browse.path, "/library/sections/3/folder");
        const config = f.api.normalizePlexConfig({
            address: "https://plex.invalid",
            folders: [choice],
            token,
        });
        assert(
            config,
            "a selected music library must survive profile validation"
        );
        const tracks = [],
            completions = [];
        f.client.scanFolders(
            config.folders,
            (rows) => tracks.push(...rows),
            (error) => completions.push(error)
        );
        assert.equal(parsed(f).pathname, "/library/sections/3/all");
        assert.equal(parsed(f).searchParams.get("type"), "10");
        last(f).reply(response);
        f.tick(5000);
        assert.deepEqual(completions, [undefined]);
        assert.equal(tracks.length, 1);
        assert.equal(tracks[0].request.path, "/library/metadata/42");
        assert.equal(tracks[0].stream_url, "plex:request");
        assert.equal(tracks[0].__ottMediaSequence, true);
        assert.equal(tracks[0].title, "Song");
    }
});

test("profile scan follows capped short pages without totals until an empty terminal page", () => {
    const f = fixture(),
        rows = [],
        completions = [];
    f.client.scanFolders(
        [{ path: "/library/sections/1/all?type=4", title: "A" }],
        (batch) => rows.push(...batch),
        (error) => completions.push(error)
    );
    last(f).reply({
        MediaContainer: { Metadata: [scanRow(1), scanRow(2)], size: 2 },
    });
    f.tick(5000);
    assert.equal(parsed(f).searchParams.get("X-Plex-Container-Start"), "2");
    last(f).reply({ MediaContainer: { Metadata: [scanRow(3)], size: 1 } });
    assert.equal(completions.length, 0);
    f.tick(5000);
    assert.equal(parsed(f).searchParams.get("X-Plex-Container-Start"), "3");
    last(f).reply({ MediaContainer: { Metadata: [], size: 0 } });
    f.tick(5000);
    assert.equal(rows.length, 3);
    assert.deepEqual(completions, [undefined]);
});

test("profile scan watchdog aborts a stalled transport and late responses cannot revive it", () => {
    const f = fixture();
    let batches = 0;
    const errors = [];
    f.client.scanFolders(
        [{ path: "/library/sections/1/all?type=4", title: "A" }],
        () => batches++,
        (error) => errors.push(error)
    );
    const pending = last(f);
    f.tick(60000);
    assert.equal(pending.aborted, true);
    assert.deepEqual(errors, ["Plex source did not respond"]);
    pending.reply({ MediaContainer: { Metadata: [scanRow(1)], size: 1 } });
    assert.equal(batches, 0);
});

test("whole-library scan discovers video and music sections with stable categories and no folder selection", () => {
    const f = fixture(),
        batches = [],
        done = [];
    f.client.scanFolders(
        [],
        (rows, scanned) => batches.push({ rows, scanned }),
        (error) => done.push(error)
    );
    assert.equal(parsed(f).pathname, "/library/sections");
    last(f).reply({
        MediaContainer: {
            Directory: [
                { key: "1", title: "Cartoons", type: "movie" },
                { key: "2", title: "Cartoons", type: "show" },
                { key: "3", title: "Music", type: "artist" },
                { key: "4", title: "Photos", type: "photo" },
            ],
        },
    });
    f.tick(5000);
    assert.equal(parsed(f).pathname, "/library/sections/1/all");
    last(f).reply({
        MediaContainer: { Metadata: [scanRow(11)], size: 1, totalSize: 1 },
    });
    const first = batches.flatMap((batch) => Array.from(batch.rows))[0];
    assert.equal(first.__ottMediaCollection, "Cartoons");
    assert.deepEqual(JSON.parse(JSON.stringify(first.__ottMediaCategories)), [
        { id: "plex:/library/sections/1/all", name: "Cartoons" },
    ]);
    assert.equal(done.length, 0, "starts before remaining section discovery");
    f.tick(5000);
    assert.equal(parsed(f).pathname, "/library/sections/2/all");
    last(f).reply({
        MediaContainer: {
            Metadata: [
                {
                    key: "/library/metadata/20/children",
                    title: "Tom and Jerry",
                    type: "show",
                },
            ],
            size: 1,
            totalSize: 1,
        },
    });
    f.tick(5000);
    assert.equal(parsed(f).pathname, "/library/sections/3/all");
    last(f).reply({
        MediaContainer: {
            Metadata: [{ ratingKey: "33", title: "Song", type: "track" }],
            size: 1,
            totalSize: 1,
        },
    });
    const track = batches
        .flatMap((batch) => Array.from(batch.rows))
        .find((row) => row.request.path === "/library/metadata/33");
    assert.equal(track.__ottMediaSequence, true);
    assert.equal(track.__ottMediaCollection, "Music");
    assert.equal(
        track.__ottMediaCategories[0].id,
        "plex:/library/sections/3/all"
    );
    f.tick(5000);
    assert.equal(parsed(f).pathname, "/library/metadata/20/children");
    last(f).reply({
        MediaContainer: { Metadata: [scanRow(22)], size: 1, totalSize: 1 },
    });
    f.tick(5000);
    const second = batches.flatMap((batch) => Array.from(batch.rows)).at(-1);
    assert.equal(second.__ottMediaCollection, "Cartoons / Tom and Jerry");
    assert.deepEqual(JSON.parse(JSON.stringify(second.__ottMediaCategories)), [
        { id: "plex:/library/sections/2/all", name: "Cartoons" },
        {
            id: "plex:/library/metadata/20/children",
            name: "Cartoons / Tom and Jerry",
        },
    ]);
    assert.notEqual(
        first.__ottMediaCategories[0].id,
        second.__ottMediaCategories[0].id
    );
    assert(
        !f.requests.some((request) =>
            new URL(request.options.url).pathname.includes("/sections/4/")
        )
    );
    assert.deepEqual(done, [undefined]);
});

test("movie file directories become stable categories without publishing server paths", () => {
    const f = fixture(),
        batches = [];
    f.client.scanFolders(
        [{ path: "/library/sections/1/all", title: "Films" }],
        (rows) => batches.push(...rows),
        () => {}
    );
    last(f).reply({
        MediaContainer: {
            Metadata: [
                {
                    ...scanRow(1),
                    Media: [
                        {
                            Part: [
                                { file: "/private/media/Cartoons/first.mp4" },
                            ],
                        },
                    ],
                    type: "movie",
                },
                {
                    ...scanRow(2),
                    Media: [
                        {
                            Part: [
                                { file: "/other/media/Cartoons/second.mp4" },
                            ],
                        },
                    ],
                    type: "movie",
                },
            ],
            size: 2,
            totalSize: 2,
        },
    });
    f.tick(5000);
    assert.equal(batches[0].__ottMediaCollection, "Films / Cartoons");
    assert.equal(batches[1].__ottMediaCollection, "Films / Cartoons");
    assert.notEqual(
        batches[0].__ottMediaCategories[1].id,
        batches[1].__ottMediaCategories[1].id
    );
    assert(!JSON.stringify(batches).includes("/private/media"));
    assert(!JSON.stringify(batches).includes("/other/media"));
});

test("later duplicate adult metadata upgrades a retained item even without new categories", () => {
    const f = fixture(),
        batches = [];
    f.client.scanFolders(
        [{ path: "/library/sections/1/all", title: "Films" }],
        (rows) => batches.push(rows),
        () => {}
    );
    last(f).reply({
        MediaContainer: {
            Metadata: [scanRow(1)],
            offset: 0,
            size: 1,
            totalSize: 3,
        },
    });
    assert.equal(batches[0][0].adult, 0);
    f.tick(5000);
    last(f).reply({
        MediaContainer: {
            Metadata: [{ ...scanRow(1), adult: 1 }, scanRow(2)],
            offset: 1,
            size: 2,
            totalSize: 3,
        },
    });
    assert.equal(batches[1][0].adult, 1);
    assert.equal(batches[1][0].__ottMediaCategories.length, 1);
});

test("whole catalog compacts previews and completes beyond the old 8 MiB selected-folder limit", () => {
    const f = fixture(),
        done = [];
    let count = 0;
    f.client.scanFolders(
        [],
        (batch) => {
            count += batch.length;
            for (const row of batch) {
                assert(row.description.length <= 1024);
                assert(row.title.length <= 1024);
            }
        },
        (error) => done.push(error)
    );
    last(f).reply({
        MediaContainer: {
            Directory: [
                { key: "1", title: "Small", type: "movie" },
                { key: "2", title: "Films", type: "movie" },
            ],
            size: 2,
        },
    });
    f.tick(0);
    last(f).reply({
        MediaContainer: {
            Metadata: Array.from({ length: 165 }, (_, i) => ({
                ratingKey: String(20000 + i),
                title: "Short " + i,
                type: "movie",
            })),
            size: 165,
            totalSize: 165,
        },
    });
    f.tick(0);
    for (let offset = 0; offset < 9000; offset += 200) {
        const rows = Array.from(
            { length: Math.min(200, 9000 - offset) },
            (_, i) => ({
                Media: [
                    {
                        Part: [
                            { file: "/private/source/collection/movie.mp4" },
                        ],
                    },
                ],
                ratingKey: String(offset + i + 1),
                summary: "x".repeat(2000),
                title: "Film " + (offset + i),
                type: "movie",
            })
        );
        last(f).reply({
            MediaContainer: {
                Metadata: rows,
                offset,
                size: rows.length,
                totalSize: 9000,
            },
        });
        f.tick(0);
    }
    assert.equal(count, 9165);
    assert.deepEqual(done, [undefined]);
    const status = f.client.scanDiagnostics();
    assert.equal(status.state, "complete");
    assert(status.bytes > 8 * 1024 * 1024);
    assert(status.bytes < 64 * 1024 * 1024);
    assert.equal(status.items, 9165);
    assert.equal(status.maxBytes, 64 * 1024 * 1024);
});

test("automatic music catalog uses a flat track query beyond one thousand artists", () => {
    const f = fixture(),
        done = [];
    let count = 0;
    f.client.scanFolders(
        [],
        (batch) => (count += batch.length),
        (error) => done.push(error)
    );
    last(f).reply({
        MediaContainer: {
            Directory: [{ key: "3", title: "Music", type: "artist" }],
            size: 1,
        },
    });
    f.tick(0);
    for (let offset = 0; offset < 1200; offset += 200) {
        assert.equal(parsed(f).pathname, "/library/sections/3/all");
        assert.equal(parsed(f).searchParams.get("type"), "10");
        last(f).reply({
            MediaContainer: {
                Metadata: Array.from({ length: 200 }, (_, i) => ({
                    ratingKey: String(offset + i + 1),
                    title: "Track " + (offset + i),
                    type: "track",
                })),
                offset,
                size: 200,
                totalSize: 1200,
            },
        });
        f.tick(0);
    }
    assert.equal(count, 1200);
    assert.deepEqual(done, [undefined]);
    assert.equal(f.requests.length, 7);
    assert.equal(f.client.scanDiagnostics().containers, 2);
    assert(
        !f.requests.some((request) =>
            new URL(request.options.url).pathname.endsWith("/children")
        )
    );
});

test("whole catalog keeps oversized previews bounded and reports only safe failure counters", () => {
    const f = fixture(),
        done = [],
        warnings = [];
    f.host.console = { warn: (value) => warnings.push(value) };
    f.client.scanFolders(
        [],
        (batch) => {
            if (!batch.length) return;
            assert.equal(batch[0].title.length, 512);
            assert(batch[0].description.length <= 1024);
            assert(!/&[^;]*$/.test(batch[0].description));
        },
        (error) => done.push(error)
    );
    last(f).reply({
        MediaContainer: {
            Directory: [{ key: "1", title: "Films", type: "movie" }],
            size: 1,
        },
    });
    f.tick(0);
    last(f).reply({
        MediaContainer: {
            Metadata: [
                {
                    ratingKey: "1",
                    summary: "<&".repeat(5000),
                    title: "n".repeat(5000),
                    type: "movie",
                },
            ],
            size: 1,
            totalSize: 2,
        },
    });
    f.tick(0);
    last(f).reply({
        MediaContainer: { Metadata: [], offset: 1, size: 0, totalSize: 2 },
    });
    assert.deepEqual(done, ["Invalid Plex response"]);
    const status = f.client.scanDiagnostics();
    assert.equal(status.state, "failed");
    assert.equal(status.code, "invalid_response");
    assert.equal(status.items, 1);
    assert.equal(warnings.length, 1);
    assert(!warnings[0].includes("https:"));
    assert(!warnings[0].includes("Films"));
    assert(!warnings[0].includes(token));
});

test("repeated membership cannot grow one catalog record beyond its hard limit", () => {
    const f = fixture(),
        done = [];
    const roots = Array.from({ length: 100 }, (_, i) => ({
        path: "/library/sections/" + (i + 1) + "/all",
        title: "Category " + i + " " + "x".repeat(1000),
    }));
    f.client.scanFolders(
        roots,
        (batch) => {
            for (const item of batch)
                assert(Buffer.byteLength(JSON.stringify(item)) <= 64 * 1024);
        },
        (error) => done.push(error)
    );
    for (let i = 0; i < roots.length && !done.length; i++) {
        last(f).reply({
            MediaContainer: {
                Metadata: [
                    { ratingKey: "1", title: "Same item", type: "movie" },
                ],
                size: 1,
                totalSize: 1,
            },
        });
        f.tick(0);
    }
    assert.deepEqual(done, ["Plex playlist is too large"]);
    assert.equal(f.client.scanDiagnostics().code, "record_limit");
});

test("terminal record errors cannot mutate a previously published record later in the batch", () => {
    const f = fixture(),
        done = [],
        published = [];
    f.client.scanFolders(
        [{ path: "/library/sections/1/all", title: "Films" }],
        (batch) => published.push(...batch),
        (error) => done.push(error)
    );
    last(f).reply({
        MediaContainer: {
            Metadata: [{ ratingKey: "1", title: "Kept", type: "movie" }],
            offset: 0,
            size: 1,
            totalSize: 3,
        },
    });
    f.tick(0);
    const before = JSON.stringify(published[0]);
    last(f).reply({
        MediaContainer: {
            Metadata: [
                {
                    ratingKey: "2",
                    summary: "x".repeat(70000),
                    title: "Too much",
                    type: "movie",
                },
                { adult: 1, ratingKey: "1", title: "Kept", type: "movie" },
            ],
            offset: 1,
            size: 2,
            totalSize: 3,
        },
    });
    assert.deepEqual(done, ["Plex playlist is too large"]);
    assert.equal(f.client.scanDiagnostics().code, "record_limit");
    assert.equal(JSON.stringify(published[0]), before);
    assert.equal(published.length, 1);
});

test("cancellation has an explicit diagnostic without replacing completion or failure", () => {
    const f = fixture();
    const cancel = f.client.scanFolders(
        [],
        () => {},
        () => {}
    );
    cancel();
    assert.equal(f.client.scanDiagnostics().state, "cancelled");
    assert.equal(f.client.scanDiagnostics().code, "cancelled");
    const g = fixture();
    const finish = g.client.scanFolders(
        [],
        () => {},
        () => {}
    );
    last(g).reply({ MediaContainer: { Directory: [], size: 0 } });
    g.tick(0);
    finish();
    assert.equal(g.client.scanDiagnostics().state, "complete");
});

test("whole catalog bounds UTF8 titles and never cuts surrogate pairs in labels or previews", () => {
    const f = fixture(),
        rows = [];
    f.client.scanFolders(
        [],
        (batch) => rows.push(...batch),
        () => {}
    );
    last(f).reply({
        MediaContainer: {
            Directory: [
                { key: "1", title: "x".repeat(4095) + "😀", type: "movie" },
            ],
            size: 1,
        },
    });
    f.tick(0);
    last(f).reply({
        MediaContainer: {
            Metadata: [
                {
                    ratingKey: "12345678901234567890",
                    summary: "a".repeat(1023) + "😀",
                    title: "é".repeat(255) + "😀tail",
                    type: "movie",
                },
            ],
            size: 1,
            totalSize: 1,
        },
    });
    f.tick(0);
    assert.equal(rows.length, 1);
    assert.equal(
        rows[0].request.path,
        "/library/metadata/12345678901234567890"
    );
    assert(Buffer.byteLength(rows[0].title) <= 512);
    assert.equal(rows[0].title, "é".repeat(255));
    assert.equal(rows[0].description, "a".repeat(1023));
    assert.equal(rows[0].__ottMediaCategories[0].name, "x".repeat(4095));
    for (const text of [
        rows[0].title,
        rows[0].description,
        rows[0].__ottMediaCategories[0].name,
    ])
        assert.doesNotThrow(() => encodeURIComponent(text));
});

test("flat music retains library artist and album category identities", () => {
    const f = fixture(),
        rows = [];
    f.client.scanFolders(
        [],
        (batch) => rows.push(...batch),
        () => {}
    );
    last(f).reply({
        MediaContainer: {
            Directory: [{ key: "3", title: "Music", type: "artist" }],
            size: 1,
        },
    });
    f.tick(0);
    const song = (id, artist, album) => ({
        grandparentRatingKey: String(artist),
        grandparentTitle: "Artist " + artist,
        Media: [{ Part: [{ file: "/media/all-music/file" + id + ".mp3" }] }],
        parentRatingKey: String(album),
        parentTitle: "Album " + album,
        ratingKey: String(id),
        title: "Track " + id,
        type: "track",
    });
    last(f).reply({
        MediaContainer: {
            Metadata: [song(1, 10, 20), song(2, 11, 21)],
            size: 2,
            totalSize: 2,
        },
    });
    f.tick(0);
    assert.equal(f.requests.length, 2);
    assert.equal(
        new URL(f.requests[1].options.url).searchParams.get("type"),
        "10"
    );
    assert.deepEqual(
        Array.from(rows[0].__ottMediaCategories.slice(0, 3), (category) => ({
            id: category.id,
            name: category.name,
        })),
        [
            { id: "plex:/library/sections/3/all", name: "Music" },
            {
                id: "plex:/library/metadata/10/children",
                name: "Music / Artist 10",
            },
            {
                id: "plex:/library/metadata/20/children",
                name: "Music / Artist 10 / Album 20",
            },
        ]
    );
    assert(
        rows[1].__ottMediaCategories.some(
            (category) => category.id === "plex:/library/metadata/11/children"
        )
    );
    assert(
        !rows[1].__ottMediaCategories.some(
            (category) => category.id === "plex:/library/metadata/10/children"
        )
    );
});

test("show discovery excludes repeated allLeaves navigation from wire pagination and traversal", () => {
    for (const count of [10, 201]) {
        const f = fixture(),
            done = [],
            batches = [];
        const path = "/library/metadata/29875/children";
        f.client.scanFolders(
            [{ path, title: "Series" }],
            (rows, scanned) => batches.push({ rows, scanned }),
            (error) => done.push(error)
        );
        for (let offset = 0; offset < count; offset += 200) {
            const length = Math.min(200, count - offset);
            assert.equal(parsed(f).pathname, path);
            assert.equal(
                parsed(f).searchParams.get("X-Plex-Container-Start"),
                String(offset)
            );
            last(f).reply({
                MediaContainer: {
                    Directory: [
                        {
                            key: "/library/metadata/29875/allLeaves",
                            leafCount: 194,
                            title: "All episodes",
                        },
                    ],
                    Metadata: Array.from({ length }, (_, i) => ({
                        key:
                            "/library/metadata/" +
                            (40000 + offset + i) +
                            "/children",
                        ratingKey: String(40000 + offset + i),
                        title: "Season " + (offset + i),
                        type: "season",
                    })),
                    offset,
                    size: length + 1,
                    totalSize: count,
                },
            });
            f.tick(0);
        }
        for (let i = 0; i < count; i++) {
            assert.equal(
                parsed(f).pathname,
                "/library/metadata/" + (40000 + i) + "/children"
            );
            last(f).reply({
                MediaContainer: {
                    Metadata: [scanRow(50000 + i)],
                    size: 1,
                    totalSize: 1,
                },
            });
            f.tick(0);
        }
        assert.deepEqual(done, [undefined]);
        assert.equal(batches.flatMap((batch) => batch.rows).length, count);
        assert.equal(batches.at(-1).scanned, count * 2);
        assert(
            !f.requests.some((request) =>
                request.options.url.includes("allLeaves")
            )
        );
    }
});

test("allLeaves normalization never relaxes wire sizes or unrelated row totals", () => {
    const nav = {
        key: "/library/metadata/29875/allLeaves",
        leafCount: 194,
        title: "All episodes",
    };
    for (const variant of [
        "wire-size",
        "wrong-parent",
        "typed",
        "rated",
        "media",
        "duplicate",
        "metadata",
    ]) {
        const f = fixture(),
            done = [];
        f.client.scanFolders(
            [{ path: "/library/metadata/29875/children", title: "Series" }],
            () => assert.fail("invalid response must not publish"),
            (error) => done.push(error)
        );
        let directory = { ...nav };
        if (variant === "wrong-parent")
            directory.key = "/library/metadata/999/allLeaves";
        if (variant === "typed") directory.type = "season";
        if (variant === "rated") directory.ratingKey = "999";
        if (variant === "media") directory.Media = [];
        const rows = [scanRow(1)];
        const directories =
            variant === "duplicate"
                ? [directory, { ...directory }]
                : [directory];
        const container = {
            Directory: directories,
            Metadata: rows,
            size: 1 + directories.length,
            totalSize: 1,
        };
        if (variant === "wire-size") container.size = 1;
        if (variant === "metadata") {
            container.Metadata.push(directory);
            container.Directory = [];
        }
        last(f).reply({ MediaContainer: container });
        assert.equal(done.length, 1, variant);
        assert(done[0], variant);
        assert.equal(
            f.client.scanDiagnostics().code,
            "invalid_response",
            variant
        );
    }
});

test("duplicate allLeaves navigation on short pages cannot skip a real catalog row", () => {
    const f = fixture(),
        done = [];
    f.client.scanFolders(
        [{ path: "/library/metadata/29875/children", title: "Series" }],
        () => assert.fail("duplicate navigation must fail before publication"),
        (error) => done.push(error)
    );
    const nav = { key: "/library/metadata/29875/allLeaves", leafCount: 194 };
    last(f).reply({
        MediaContainer: {
            Directory: [nav, { ...nav }],
            Metadata: Array.from({ length: 100 }, (_, i) => scanRow(i + 1)),
            offset: 0,
            size: 102,
            totalSize: 201,
        },
    });
    f.tick(0);
    assert.equal(done.length, 1);
    assert(done[0]);
    assert.equal(
        f.requests.length,
        1,
        "must never request the incorrect offset 101"
    );
    assert.equal(f.client.scanDiagnostics().code, "invalid_response");
});

test("allLeaves leafCount accepts only finite nonnegative numbers or decimal digit strings", () => {
    for (const leafCount of [
        null,
        false,
        true,
        [],
        [1],
        {},
        { toString: "invalid" },
        { toString: "invalid", valueOf: "invalid" },
        "",
        " ",
        "1.5",
        "-1",
        "Infinity",
        "1e2",
        NaN,
        Infinity,
        -1,
        1.5,
        undefined,
    ]) {
        const f = fixture(),
            done = [];
        f.client.scanFolders(
            [{ path: "/library/metadata/29875/children", title: "Series" }],
            () =>
                assert.fail(
                    "malformed navigation must fail before publication"
                ),
            (error) => done.push(error)
        );
        last(f).reply({
            MediaContainer: {
                Directory: [
                    { key: "/library/metadata/29875/allLeaves", leafCount },
                ],
                Metadata: [scanRow(1)],
                size: 2,
                totalSize: 201,
            },
        });
        f.tick(0);
        assert.equal(done.length, 1, JSON.stringify(leafCount));
        assert(done[0]);
        assert.equal(f.client.scanDiagnostics().code, "invalid_response");
        assert.equal(f.requests.length, 1);
    }
    for (const leafCount of [0, 194, "0", "194"]) {
        const f = fixture(),
            done = [];
        f.client.scanFolders(
            [{ path: "/library/metadata/29875/children", title: "Series" }],
            () => {},
            (error) => done.push(error)
        );
        last(f).reply({
            MediaContainer: {
                Directory: [
                    { key: "/library/metadata/29875/allLeaves", leafCount },
                ],
                Metadata: [scanRow(1)],
                size: 2,
                totalSize: 1,
            },
        });
        f.tick(0);
        assert.deepEqual(done, [undefined]);
    }
});

test("whole catalog sanitizes C1 titles and category labels without changing identity", () => {
    const f = fixture(),
        rows = [],
        done = [];
    f.client.scanFolders(
        [],
        (batch) => rows.push(...batch),
        (error) => done.push(error)
    );
    last(f).reply({
        MediaContainer: {
            Directory: [{ key: "1", title: "Movies\u0085One", type: "movie" }],
            size: 1,
        },
    });
    f.tick(0);
    last(f).reply({
        MediaContainer: {
            Metadata: [
                {
                    ratingKey: "18420",
                    summary: "Safe\u0085preview",
                    title: "Episode\u0080\u0094One",
                    type: "movie",
                },
            ],
            size: 1,
            totalSize: 1,
        },
    });
    f.tick(0);
    assert.deepEqual(done, [undefined]);
    assert.equal(rows[0].request.path, "/library/metadata/18420");
    assert.equal(rows[0].title, "Episode One");
    assert(!/[\u0000-\u001f\u007f-\u009f]/.test(rows[0].description));
    assert(
        rows[0].__ottMediaCategories.every(
            (group) => !/[\u0000-\u001f\u007f-\u009f]/.test(group.name)
        )
    );
    assert.equal(
        rows[0].__ottMediaCategories[0].id,
        "plex:/library/sections/1/all"
    );
});

for (const automatic of [false, true])
    test(`resolver accepts the shared adapter automatic=${automatic} argument`, () => {
        const f = fixture({ playback: "original" });
        const resolved = [];
        f.client.resolve(film, (value) => resolved.push(value), automatic);
        assert.equal(f.requests.length, 1);
        assert.equal(parsed(f).pathname, "/library/metadata/42");
        last(f).reply(metadata());
        assert.equal(resolved.length, 1);
        assert.equal(
            new URL(resolved[0].stream_url).pathname,
            "/library/parts/1/file.mp4"
        );
    });

test("legacy play resets accepted controls before resolution and preserves newer INFO on completion", () => {
    const f = fixture({ playback: "original" });
    const calls = [];
    let interactive = true;
    f.host.__ottSetInfoInteraction = (value) => {
        calls.push(["intent", value]);
        assert.equal(f.requests.length, 0, "reset precedes the HTTP request");
        interactive = value;
    };
    f.host._playMedia = (...args) => calls.push(["play", ...args]);
    f.client.play(film);
    assert.deepEqual(calls, [["intent", false]]);
    assert.equal(interactive, false);
    assert.equal(f.requests.length, 1);
    interactive = true; // The user opens INFO while Plex metadata is pending.
    const response = last(f);
    response.reply(metadata());
    response.reply(metadata());
    assert.equal(
        calls.length,
        2,
        "one accepted reset and one playback dispatch"
    );
    assert.equal(calls[1][0], "play");
    assert.equal(calls[1][2], false);
    assert.equal(
        calls[1][3],
        true,
        "late playback preserves the current intent"
    );
    assert.equal(interactive, true);
});

test("invalid legacy play does not reset explicit controls", () => {
    const f = fixture();
    const intents = [];
    f.host.__ottSetInfoInteraction = (value) => intents.push(value);
    f.host._playMedia = () => {};
    f.client.play({ ...film, plexSource: "plex:another-account" });
    assert.deepEqual(intents, []);
    assert.equal(f.requests.length, 0);
});

console.log(`PASS Plex client (${passed} scenarios)`);
