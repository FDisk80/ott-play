"use strict";
// Isolated source fixture: small real File objects, mocked object-URL ownership.
// No browser, network, media decoder or persistent storage is used.
const assert = require("node:assert/strict");
const { File } = require("node:buffer");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const vm = require("node:vm");

function fixture(options = {}) {
    const exports = {};
    const created = [],
        revoked = [],
        probes = [];
    let serial = 0;
    const forbidden = () => {
        throw new Error(
            "Unexpected file read, persistent write or external API"
        );
    };
    const host = {
        _: (text) => "translated:" + text,
        document: {
            createElement(tag) {
                assert.equal(tag, "video");
                return {
                    canPlayType(type) {
                        probes.push(type);
                        if (options.probeFailure)
                            throw new Error("probe failed");
                        return options.canPlayType || "";
                    },
                };
            },
        },
        File,
        fetch: forbidden,
        loadProv: forbidden,
        showDirectoryPicker: forbidden,
        showOpenFilePicker: forbidden,
        stbDelItem: forbidden,
        stbSetItem: forbidden,
        URL: {
            createObjectURL(file) {
                created.push(file);
                if (options.createFailure) throw new Error("private-path");
                return "blob:fixture/" + ++serial;
            },
            revokeObjectURL(url) {
                revoked.push(url);
                if (options.revokeFailure) throw new Error("already detached");
            },
        },
    };
    for (const key of [
        "indexedDB",
        "localStorage",
        "sessionStorage",
        "FileReader",
        "ottpStorage",
    ])
        Object.defineProperty(host, key, { get: forbidden });
    const source = fs.readFileSync(
        path.join(__dirname, "../src/offline/dropped-video.ts"),
        "utf8"
    );
    vm.runInNewContext(
        ts.transpileModule(source, {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES5,
            },
        }).outputText,
        { exports }
    );
    function file(
        name = "movie.mp4",
        type = "video/mp4",
        bytes = "tiny fixture"
    ) {
        const result = new File([bytes], name, { type });
        for (const key of ["arrayBuffer", "text", "stream", "slice"])
            Object.defineProperty(result, key, { value: forbidden });
        return result;
    }
    return {
        create: (file) => exports.createDroppedVideo(host, file),
        created,
        file,
        host,
        probes,
        revoked,
    };
}

test("one direct video uses the exact File without reading, copying, activation or storage", () => {
    const f = fixture();
    const file = f.file("<b>Movie</b>.mp4");
    const lease = f.create(file);
    assert.equal(f.created.length, 1);
    assert.equal(f.created[0], file);
    assert.equal(lease.catalog.items.length, 1);
    assert.equal(lease.catalog.sources.length, 1);
    const item = lease.catalog.items[0],
        source = lease.catalog.sources[0];
    assert.equal(item.id, lease.itemId);
    assert.equal(item.sourceId, lease.sourceId);
    assert.equal(source.id, lease.sourceId);
    assert.equal(item.name, file.name);
    assert.equal(item.size, file.size);
    assert.equal(item.url, "blob:fixture/1");
    assert.equal(item.available, true);
    assert.equal(item.access, "granted");
    assert.equal(item.relativePath, null);
    assert.equal(source.kind, "file");
    assert.equal(source.available, true);
    assert.equal(lease.catalog.persistent, false);
    assert.equal(lease.catalog.storage, "browser");
    assert.equal(lease.catalog.scanning, false);
    assert.equal(lease.catalog.phase, "complete");
    assert.equal(lease.catalog.scanned, 1);
    assert.deepEqual(f.revoked, []);
    lease.release();
    assert.deepEqual(f.revoked, [item.url]);
});

test("direct extension handling is case insensitive and permits absent MIME metadata", () => {
    const f = fixture();
    for (const name of ["clip.MP4", "clip.m4v", "clip.webm", "clip.mov"]) {
        const lease = f.create(f.file(name, ""));
        assert.equal(lease.catalog.items[0].name, name);
        lease.release();
    }
    assert.equal(f.created.length, 4);
    assert.equal(f.revoked.length, 4);
});

test("blob playback receives a video MIME when File metadata is empty or generic", () => {
    const f = fixture({ canPlayType: "probably" });
    for (const [name, expected] of [
        ["clip.MP4", "video/mp4"],
        ["clip.m4v", "video/mp4"],
        ["clip.webm", "video/webm"],
        ["clip.mov", "video/quicktime"],
        ["clip.mkv", "video/x-matroska"],
    ]) {
        for (const type of ["", "application/octet-stream"]) {
            const file = f.file(name, type),
                lease = f.create(file);
            assert.equal(lease.catalog.items[0].mime, expected);
            assert.equal(f.created.at(-1), file);
            lease.release();
        }
    }
    const matroska = f.create(f.file("clip.mkv", "application/x-matroska"));
    assert.equal(matroska.catalog.items[0].mime, "video/x-matroska");
    matroska.release();
    const explicit = f.create(f.file("clip.m4v", "video/x-m4v"));
    assert.equal(explicit.catalog.items[0].mime, "video/x-m4v");
    explicit.release();
    assert.equal(f.created.length, f.revoked.length);
});

test("invalid, empty, nonvideo and unsupported files allocate no URL", () => {
    const f = fixture();
    for (const file of [
        null,
        {},
        { name: "fake.mp4", size: 1, type: "video/mp4" },
        f.file("empty.mp4", "video/mp4", ""),
        f.file("song.mp3", "audio/mpeg"),
        f.file("renamed.mp4", "audio/mpeg"),
        f.file("note.txt", "text/plain"),
        f.file("media.unknown", "video/mp4"),
        f.file("movie.avi", "video/x-msvideo"),
    ]) {
        assert.throws(() => f.create(file), /Choose a supported video file/);
    }
    assert.equal(f.created.length, 0);
    assert.equal(f.revoked.length, 0);
});

test("Matroska keeps existing direct-browser capability boundary", () => {
    for (const options of [{}, { probeFailure: true }]) {
        const f = fixture(options);
        assert.throws(
            () => f.create(f.file("clip.mkv", "")),
            /Choose a supported video file/
        );
        assert.equal(f.created.length, 0);
        assert.deepEqual(f.probes, ["video/x-matroska"]);
    }
    const f = fixture({ canPlayType: "maybe" });
    const lease = f.create(f.file("clip.mkv", "video/x-matroska"));
    assert.equal(lease.catalog.items[0].available, true);
    assert.equal(f.created.length, 1);
    lease.release();
    assert.equal(f.revoked.length, 1);
    // AVI remains unsupported by the existing browser Local policy.
    assert.throws(
        () => f.create(f.file("clip.avi", "video/x-msvideo")),
        /supported video/
    );
    assert.equal(f.created.length, 1);
});

test("two same-named files have distinct ownership; old release cannot retire new URL", () => {
    const f = fixture();
    const first = f.create(f.file()),
        second = f.create(f.file());
    assert.notEqual(first.sourceId, second.sourceId);
    assert.notEqual(first.itemId, second.itemId);
    for (const id of [
        first.sourceId,
        first.itemId,
        second.sourceId,
        second.itemId,
    ]) {
        assert.match(id, /^[A-Za-z0-9_-]+$/);
        assert.ok(id.length <= 80);
    }
    first.release();
    first.release();
    assert.deepEqual(f.revoked, [first.catalog.items[0].url]);
    assert.equal(second.catalog.items[0].url, "blob:fixture/2");
    second.release();
    second.release();
    assert.deepEqual(f.revoked, ["blob:fixture/1", "blob:fixture/2"]);
});

test("cleanup attempts exact captured URL once even if revocation throws", () => {
    const f = fixture({ revokeFailure: true });
    const lease = f.create(f.file());
    lease.catalog.items[0].url = "blob:some-other-owner";
    assert.doesNotThrow(() => lease.release());
    assert.doesNotThrow(() => lease.release());
    assert.deepEqual(f.revoked, ["blob:fixture/1"]);
});

test("unavailable URL support and allocation failure return safe errors", () => {
    const f = fixture();
    delete f.host.URL.revokeObjectURL;
    assert.throws(() => f.create(f.file()), /Dropped video is unavailable/);
    assert.equal(f.created.length, 0);
    const broken = fixture({ createFailure: true });
    assert.throws(
        () => broken.create(broken.file()),
        (error) => error.message === "Dropped video could not be opened"
    );
    assert.equal(broken.created.length, 1);
    assert.equal(broken.revoked.length, 0);
});
