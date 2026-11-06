const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const standby = ts.transpileModule(
    fs
        .readFileSync(path.join(__dirname, "../src/core/standby.ts"), "utf8")
        .replace(/^export /gm, ""),
    { compilerOptions: { target: ts.ScriptTarget.ES5 } }
).outputText;
const source = ts.transpileModule(
    fs
        .readFileSync(
            path.join(__dirname, "../src/offline/browser-local-media.ts"),
            "utf8"
        )
        .replace(/^export /gm, ""),
    {
        compilerOptions: {
            module: ts.ModuleKind.None,
            target: ts.ScriptTarget.ES5,
        },
    }
).outputText;
require("acorn").parse(source, { ecmaVersion: 5 });

function fixture(count, extension = "mp4", brokenIndex = -1, mime, waits = {}) {
    let reads = 0,
        iteratorReads = 0,
        iteratorCreations = 0,
        revoked = 0,
        nextUrl = 0,
        permissionRequests = 0,
        permissionQueries = 0,
        writes = 0;
    const files = Array.from({ length: count }, (_, index) => ({
        getFile: async () => {
            reads++;
            await waits.file;
            if (index === brokenIndex) {
                const error = new Error("File removed during scan");
                error.name = "NotFoundError";
                throw error;
            }
            return {
                lastModified: 1,
                name: "movie-" + index + "." + extension,
                size: index + 1,
                type:
                    mime || (extension === "mp4" ? "video/mp4" : "text/plain"),
            };
        },
        kind: "file",
        name: "movie-" + index + "." + extension,
    }));
    const folder = {
        getDirectoryHandle: async () => {
            await waits.directory;
            return folder;
        },
        getFileHandle: async (name) => {
            const file = files.find((file) => file.name === name);
            if (!file) {
                const error = new Error("Missing file");
                error.name = "NotFoundError";
                throw error;
            }
            return file;
        },
        kind: "directory",
        name: "Movies",
        queryPermission: async () => {
            permissionQueries++;
            await waits.permission;
            return "granted";
        },
        requestPermission: async () => {
            permissionRequests++;
            return "granted";
        },
        resolve: async (handle) =>
            files.includes(handle) ? [handle.name] : null,
        values: () => {
            iteratorCreations++;
            let index = 0;
            return {
                next: async () => {
                    iteratorReads++;
                    await waits.iterator;
                    return index < files.length
                        ? { done: false, value: files[index++] }
                        : { done: true };
                },
            };
        },
    };
    const saved = [
        { created: 1, handle: folder, id: "source-movies", name: folder.name },
    ];
    const db = {
        transaction: () => {
            const tx = { abort: () => queueMicrotask(() => tx.onabort()) };
            tx.objectStore = () => ({
                get: (id) => {
                    const request = {};
                    queueMicrotask(() => {
                        const record = saved.find((record) => record.id === id);
                        request.result = waits.readback
                            ? waits.readback(record)
                            : record;
                        request.onsuccess();
                    });
                    return request;
                },
                openCursor: () => {
                    const cursor = {};
                    let index = 0;
                    const advance = () =>
                        Promise.resolve(waits.records).then(() => {
                            let continued = false;
                            cursor.result =
                                index < saved.length
                                    ? {
                                          continue: () => {
                                              continued = true;
                                              advance();
                                          },
                                          value: saved[index++],
                                      }
                                    : null;
                            cursor.onsuccess();
                            if (!continued) tx.oncomplete();
                        });
                    advance();
                    return cursor;
                },
                put: (record) => {
                    const index = saved.findIndex(
                        (item) => item.id === record.id
                    );
                    assert.ok(
                        index >= 0,
                        "reconnect updates an existing source"
                    );
                    saved[index] = record;
                    writes++;
                    queueMicrotask(() => tx.oncomplete());
                },
            });
            return tx;
        },
    };
    const w = {
        addEventListener: () => {},
        clearTimeout,
        indexedDB: {
            open: () => {
                const request = {};
                queueMicrotask(() => {
                    request.result = db;
                    request.onsuccess();
                });
                return request;
            },
        },
        navigator: {},
        setTimeout,
        showDirectoryPicker: () => Promise.resolve(folder),
        URL: {
            createObjectURL: () => "blob:fixture-" + ++nextUrl,
            revokeObjectURL: () => revoked++,
        },
    };
    const context = vm.createContext({
        Array,
        Date,
        Error,
        Number,
        Object,
        Promise,
        RegExp,
        String,
    });
    vm.runInContext(source, context);
    vm.runInContext(standby, context);
    return {
        addSource: (id) =>
            saved.push({ created: 2, handle: folder, id, name: folder.name }),
        api: context.installBrowserLocalMedia(w),
        installStandby: () =>
            context.installStandby(
                w,
                () => "0",
                () => {}
            ),
        iteratorCreations: () => iteratorCreations,
        iteratorReads: () => iteratorReads,
        permissionQueries: () => permissionQueries,
        permissionRequests: () => permissionRequests,
        reads: () => reads,
        reinstall: () => {
            delete w.__ottBrowserLocalMedia;
            return context.installBrowserLocalMedia(w);
        },
        revoked: () => revoked,
        saved: () => saved,
        w,
        writes: () => writes,
    };
}
async function settle(pending) {
    let timer;
    const timeout = new Error("Pending directory regression did not complete");
    try {
        return await Promise.race([
            pending,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(timeout), 5000);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}
async function flushScans() {
    for (let i = 0; i < 150; i++) await Promise.resolve();
}

(async () => {
    const paths = fixture(0);
    const file = (name) => ({
        getFile: async () => ({
            lastModified: 1,
            name,
            size: 1,
            type: "video/mp4",
        }),
        kind: "file",
        name,
        queryPermission: async () => "granted",
    });
    const values = (entries) => () => {
        let index = 0;
        return {
            next: async () =>
                index < entries.length
                    ? { done: false, value: entries[index++] }
                    : { done: true },
        };
    };
    paths.saved()[0].handle.values = values([
        file("Clip.mp4"),
        {
            kind: "directory",
            name: "Season 1",
            values: values([file("Clip.mp4")]),
        },
        {
            kind: "directory",
            name: "Кино %20",
            values: values([file("Фильм.mp4")]),
        },
    ]);
    paths.saved().push({
        created: 2,
        handle: file("Picked.mp4"),
        id: "source-picked",
        name: "Picked.mp4",
    });
    paths.saved().push({
        blob: { lastModified: 1, size: 1, type: "video/mp4" },
        created: 3,
        id: "old-copy",
        name: "old/path.mp4",
    });
    const pathCatalog = await settle(paths.api.list());
    assert.deepEqual(
        Array.from(pathCatalog.items, (item) => [item.name, item.relativePath]),
        [
            ["Clip.mp4", "Clip.mp4"],
            ["Season 1/Clip.mp4", "Season 1/Clip.mp4"],
            ["Кино %20/Фильм.mp4", "Кино %20/Фильм.mp4"],
            ["Picked.mp4", null],
            ["old/path.mp4", null],
        ]
    );

    let releaseInitial;
    const sharedInitial = fixture(3, "mp4", -1, undefined, {
        iterator: new Promise((resolve) => {
            releaseInitial = resolve;
        }),
    });
    const firstOwner = sharedInitial.api.list();
    await flushScans();
    const secondOwner = sharedInitial.api.list();
    await flushScans();
    const lastOwner = sharedInitial.api.list();
    await flushScans();
    assert.equal(
        sharedInitial.iteratorCreations(),
        1,
        "rapid retries share only the unresolved first iterator"
    );
    assert.equal(
        sharedInitial.iteratorReads(),
        1,
        "rapid retries cannot queue another full native enumeration"
    );
    releaseInitial();
    const initialResults = await settle(
        Promise.all([firstOwner, secondOwner, lastOwner])
    );
    assert.equal(initialResults[0].cancelled, true);
    assert.equal(initialResults[1].cancelled, true);
    assert.equal(initialResults[0].items.length, 0);
    assert.equal(initialResults[1].items.length, 0);
    assert.equal(initialResults[2].items.length, 3);
    assert.equal(
        sharedInitial.iteratorReads(),
        4,
        "only newest owner advances the iterator after its shared first result"
    );
    assert.equal((await settle(sharedInitial.api.list())).items.length, 3);
    assert.equal(
        sharedInitial.iteratorCreations(),
        2,
        "a completed first result is never reused as an advanced iterator"
    );

    let releaseDeadDirectory;
    const deadDirectory = fixture(1, "mp4", -1, undefined, {
        iterator: new Promise((resolve) => {
            releaseDeadDirectory = resolve;
        }),
    });
    let directoryDeadline;
    deadDirectory.w.setTimeout = (fn, delay) => {
        if (delay === 2700000) {
            directoryDeadline = { fn };
            return directoryDeadline;
        }
        return setTimeout(fn, delay);
    };
    deadDirectory.w.clearTimeout = (timer) => {
        if (timer !== directoryDeadline) clearTimeout(timer);
    };
    const deadScan = deadDirectory.api.list();
    await flushScans();
    assert.ok(directoryDeadline, "initial enumeration has a finite deadline");
    directoryDeadline.fn();
    const timedOutDirectory = await settle(deadScan);
    assert.equal(timedOutDirectory.reconnectRequired, true);
    assert.equal(timedOutDirectory.sources[0].readErrorName, "TimeoutError");
    assert.equal(timedOutDirectory.sources[0].readErrorPhase, "enumerating");
    assert.equal(
        (await settle(deadDirectory.api.list())).reconnectRequired,
        true
    );
    assert.equal(
        deadDirectory.iteratorCreations(),
        1,
        "a timed-out browser call is not replaced with more uncancellable reads"
    );
    releaseDeadDirectory();
    await flushScans();
    assert.equal((await settle(deadDirectory.api.list())).items.length, 1);

    let releaseDeadFiles;
    const deadFiles = fixture(3, "mp4", -1, undefined, {
        file: new Promise((resolve) => {
            releaseDeadFiles = resolve;
        }),
    });
    const fileDeadlines = new Set();
    deadFiles.w.setTimeout = (fn, delay) => {
        if (delay === 10000) {
            const timer = { fn };
            fileDeadlines.add(timer);
            return timer;
        }
        return setTimeout(fn, delay);
    };
    deadFiles.w.clearTimeout = (timer) => {
        if (!fileDeadlines.delete(timer)) clearTimeout(timer);
    };
    const deadFileScan = deadFiles.api.list();
    for (let i = 0; i < 2; i++) {
        await flushScans();
        const timer = Array.from(fileDeadlines)[i];
        assert.ok(timer, "each native file read has a deadline");
        timer.fn();
    }
    const exhaustedFiles = await settle(deadFileScan);
    assert.equal(exhaustedFiles.reconnectRequired, true);
    assert.equal(
        deadFiles.reads(),
        2,
        "uncancellable file reads remain bounded"
    );
    assert.equal((await settle(deadFiles.api.list())).reconnectRequired, true);
    assert.equal(
        deadFiles.reads(),
        2,
        "ordinary retry does not hide native reads"
    );
    let releaseOtherPermission;
    let otherPermissionQueries = 0;
    deadFiles.saved().push({
        created: 3,
        handle: {
            kind: "directory",
            queryPermission: () => {
                otherPermissionQueries++;
                return new Promise((resolve) => {
                    releaseOtherPermission = resolve;
                });
            },
            values: () => assert.fail("timed-out permission cannot enumerate"),
        },
        id: "source-other-permission",
        name: "Other source",
    });
    const mixedReadScan = deadFiles.api.list();
    await flushScans();
    assert.equal(
        otherPermissionQueries,
        1,
        "two pending file reads do not consume the permission-call budget"
    );
    Array.from(fileDeadlines).at(-1).fn();
    await settle(mixedReadScan);
    releaseOtherPermission("granted");
    await flushScans();
    deadFiles.saved().pop();
    const remounted = {
        kind: "directory",
        name: "Remounted movies",
        queryPermission: async () => "granted",
        values() {
            let done = false;
            return {
                next: async () => {
                    if (done) return { done: true };
                    done = true;
                    return {
                        done: false,
                        value: {
                            getFile: async () => ({
                                lastModified: 2,
                                name: "fresh.mp4",
                                size: 10,
                                type: "video/mp4",
                            }),
                            kind: "file",
                            name: "fresh.mp4",
                        },
                    };
                },
            };
        },
    };
    let pickerCalled = false;
    const reconnectPickerOptions = [];
    deadFiles.w.showDirectoryPicker = (options) => {
        pickerCalled = true;
        reconnectPickerOptions.push(options);
        return Promise.resolve(remounted);
    };
    deadFiles.saved()[0].bootstrap = [{ handle: remounted, path: "old.mp4" }];
    const reconnect = deadFiles.api.reconnectSource("source-movies");
    assert.equal(
        pickerCalled,
        true,
        "picker opens within the click activation"
    );
    assert.equal((await reconnect).requiresReload, true);
    assert.equal(reconnectPickerOptions[0].mode, "read");
    assert.equal(reconnectPickerOptions[0].startIn, "documents");
    assert.match(reconnectPickerOptions[0].id, /^[A-Za-z0-9_-]{1,32}$/);
    assert.equal(
        deadFiles.saved().length,
        1,
        "reconnect never duplicates sources"
    );
    assert.equal(deadFiles.saved()[0].id, "source-movies");
    assert.equal(deadFiles.saved()[0].created, 1);
    assert.equal(deadFiles.saved()[0].handle, remounted);
    assert.equal(
        deadFiles.saved()[0].bootstrap,
        undefined,
        "reconnect drops stale bootstrap references"
    );
    assert.equal(deadFiles.reads(), 2, "reconnect does not scan or copy files");
    const reloaded = deadFiles.reinstall();
    const repaired = await settle(reloaded.list());
    assert.equal(repaired.items[0].id, "source-movies:fresh.mp4");
    await flushScans();
    const writesBeforeCancel = deadFiles.writes();
    deadFiles.w.showDirectoryPicker = (options) => {
        reconnectPickerOptions.push(options);
        return Promise.reject(
            Object.assign(new Error("cancelled"), { name: "AbortError" })
        );
    };
    assert.equal(
        (await reloaded.reconnectSource("source-movies")).pickerCancelled,
        true
    );
    assert.equal(
        deadFiles.writes(),
        writesBeforeCancel,
        "cancel preserves the existing grant"
    );
    assert.notEqual(
        reconnectPickerOptions[0].id,
        reconnectPickerOptions[1].id,
        "each reconnect bypasses the browser's remembered picker location"
    );
    let resolveLatePicker;
    deadFiles.w.showDirectoryPicker = () =>
        new Promise((resolve) => {
            resolveLatePicker = resolve;
        });
    const latePicker = reloaded.reconnectSource("source-movies");
    reloaded.suspend();
    resolveLatePicker(remounted);
    assert.equal((await latePicker).pickerCancelled, true);
    assert.equal(
        deadFiles.writes(),
        writesBeforeCancel,
        "a picker result arriving after Cancel never updates the source"
    );
    await assert.rejects(
        reloaded.reconnectSource("not-a-source"),
        /unavailable/
    );
    releaseDeadFiles();
    await flushScans();

    const reusedRootWaits = {};
    const reusedRoot = fixture(3, "mp4", -1, undefined, reusedRootWaits);
    const operationalRoot = reusedRoot.saved()[0].handle;
    const restoredRoots = [];
    reusedRootWaits.readback = (record) => {
        assert.equal(reusedRoot.permissionQueries(), 1);
        assert.ok(reusedRoot.iteratorReads() > 0);
        assert.ok(reusedRoot.reads() > 0);
        // IDB reads restore a distinct wrapper, unlike the default test store.
        const restoredRoot = { ...record.handle };
        restoredRoots.push(restoredRoot);
        return {
            ...record,
            created: 7,
            handle: restoredRoot,
            name: "Current stored name",
            userMetadata: "preserve this current value",
        };
    };
    await settle(reusedRoot.api.list());
    await flushScans();
    assert.equal(reusedRoot.writes(), 3);
    assert.equal(restoredRoots.length, 3);
    assert.ok(restoredRoots.every((handle) => handle !== operationalRoot));
    assert.equal(
        reusedRoot.saved()[0].handle,
        operationalRoot,
        "cache writes must retain the root that completed native use"
    );
    assert.equal(reusedRoot.saved()[0].created, 7);
    assert.equal(reusedRoot.saved()[0].name, "Current stored name");
    assert.equal(
        reusedRoot.saved()[0].userMetadata,
        "preserve this current value"
    );
    assert.equal(reusedRoot.saved()[0].bootstrap.length, 3);

    for (const mutation of ["reconnect", "remove"]) {
        const changedWaits = {};
        const changed = fixture(1, "mp4", -1, undefined, changedWaits);
        const replacementRoot = { ...changed.saved()[0].handle };
        changedWaits.readback = (record) => {
            // Model another context committing before this cache transaction.
            changed.saved().splice(0);
            if (mutation === "remove") return undefined;
            const replacement = {
                ...record,
                bootstrap: [],
                cacheEpoch: "new-root-generation",
                handle: replacementRoot,
            };
            changed.saved().push(replacement);
            return replacement;
        };
        const changedCatalog = await settle(changed.api.list());
        await flushScans();
        assert.equal(
            changed.writes(),
            0,
            mutation + " must reject stale cache writes"
        );
        assert.equal(
            changedCatalog.items.length,
            1,
            "optional cache refusal does not fail the live scan"
        );
        if (mutation === "reconnect") {
            assert.equal(changed.saved()[0].handle, replacementRoot);
            assert.equal(changed.saved()[0].cacheEpoch, "new-root-generation");
            assert.deepEqual(changed.saved()[0].bootstrap, []);
        } else assert.deepEqual(changed.saved(), []);
    }

    const priorityWaits = {};
    const priorityRoot = fixture(1, "mp4", -1, undefined, priorityWaits);
    const directOperationalRoot = priorityRoot.saved()[0].handle;
    await settle(priorityRoot.api.list((catalog) => !catalog.sources.length));
    priorityWaits.readback = (record) => ({
        ...record,
        handle: { ...record.handle },
    });
    const priorityResult = await settle(
        priorityRoot.api.bootstrapFile("source-movies", "movie-0.mp4")
    );
    assert.equal(priorityRoot.permissionQueries(), 0);
    assert.equal(priorityRoot.iteratorReads(), 0);
    assert.equal(
        priorityRoot.reads(),
        1,
        "priority selection completed a native file read"
    );
    assert.equal(priorityRoot.saved()[0].handle, directOperationalRoot);
    assert.equal(priorityRoot.saved()[0].bootstrap[0].path, "movie-0.mp4");
    assert.equal(priorityResult.items[0].id, "source-movies:movie-0.mp4");
    console.log(
        "PASS cache root reuse: distinct readback, current metadata, reconnect/remove refusal, priority selection"
    );

    const cachedWaits = {};
    const cachedSource = fixture(12, "mp4", -1, undefined, cachedWaits);
    await settle(cachedSource.api.list());
    await flushScans();
    const candidates = cachedSource.saved()[0].bootstrap;
    assert.equal(
        candidates.length,
        8,
        "bootstrap cache is bounded to eight references"
    );
    assert.deepEqual(Object.keys(candidates[0]).sort(), ["handle", "path"]);
    assert.equal(candidates[0].handle.kind, "file");
    candidates[0].handle.getFile = async () => {
        throw Object.assign(new Error("gone"), { name: "NotFoundError" });
    };
    candidates[1].handle.getFile = async () => {
        throw Object.assign(new Error("unreadable"), {
            name: "NotReadableError",
        });
    };
    cachedWaits.iterator = new Promise(() => {});
    const readsBeforeBootstrap = cachedSource.iteratorReads();
    const cachedRestart = cachedSource.reinstall();
    const bootstrapped = await settle(
        cachedRestart.list((catalog) => {
            if (catalog.items.length) return false;
        }, "source-movies:deleted-preferred.mp4")
    );
    assert.equal(bootstrapped.items.length, 1);
    assert.equal(bootstrapped.items[0].name, candidates[2].path);
    assert.equal(bootstrapped.items[0].relativePath, candidates[2].path);
    assert.equal(
        cachedSource.iteratorReads(),
        readsBeforeBootstrap,
        "missing preferred resumes a cached readable file before native enumeration"
    );
    assert.equal(bootstrapped.preferred.state, "missing");

    const movedCache = fixture(1);
    await settle(movedCache.api.list());
    await flushScans();
    const movedHandle = movedCache.saved()[0].bootstrap[0].handle;
    const movedRoot = movedCache.saved()[0].handle;
    movedRoot.resolve = async (handle) =>
        handle === movedHandle ? ["Moved", handle.name] : null;
    movedRoot.values = values([
        { kind: "directory", name: "Moved", values: values([movedHandle]) },
    ]);
    const movedSnapshots = [];
    const movedCatalog = await settle(
        movedCache.reinstall().list((catalog) => {
            movedSnapshots.push(...catalog.items);
        })
    );
    assert.equal(movedCatalog.items.length, 1);
    assert.equal(movedCatalog.items[0].relativePath, "Moved/movie-0.mp4");
    assert(
        movedSnapshots.every(
            (item) => item.relativePath === "Moved/movie-0.mp4"
        ),
        "a still-readable moved handle cannot publish its stale cached root path"
    );

    const unresolvedCache = fixture(1);
    await settle(unresolvedCache.api.list());
    await flushScans();
    delete unresolvedCache.saved()[0].handle.resolve;
    let firstUnproven;
    const unprovenCache = await settle(
        unresolvedCache.reinstall().list((catalog) => {
            if (catalog.items.length && !firstUnproven)
                firstUnproven = catalog.items[0];
        })
    );
    assert.equal(
        firstUnproven.relativePath,
        null,
        "cached playback without root resolve must not create path proof"
    );
    assert.equal(
        unprovenCache.items[0].relativePath,
        "movie-0.mp4",
        "the fresh walk upgrades the row without changing its earlier snapshot"
    );

    const directFile = fixture(3, "mp4", -1, undefined, {
        iterator: new Promise(() => {}),
    });
    const directRoot = directFile.saved()[0].handle;
    directRoot.getDirectoryHandle = async (name) => {
        assert.equal(name, "sub");
        return { getFileHandle: directRoot.getFileHandle };
    };
    directRoot.resolve = async (handle) => ["sub", handle.name];
    await settle(directFile.api.list((catalog) => !catalog.sources.length));
    const selectedFile = await settle(
        directFile.api.bootstrapFile("source-movies", "sub/movie-1.mp4")
    );
    assert.equal(selectedFile.items[0].id, "source-movies:sub/movie-1.mp4");
    assert.equal(selectedFile.items[0].directory, "sub");
    assert.equal(selectedFile.items[0].relativePath, "sub/movie-1.mp4");
    assert.equal(selectedFile.scanning, true);
    assert.equal(selectedFile.partial, true);
    assert.equal(selectedFile.preferred.state, "found");
    assert.equal(
        directFile.iteratorReads(),
        0,
        "known file starts without directory enumeration"
    );
    assert.equal(
        directFile.saved()[0].bootstrap[0].path,
        "sub/movie-1.mp4",
        "priority reference is persisted before activation"
    );
    assert.deepEqual(Object.keys(directFile.saved()[0].bootstrap[0]).sort(), [
        "handle",
        "path",
    ]);
    for (const invalid of [
        "",
        "/a.mp4",
        "../a.mp4",
        "a//b.mp4",
        "a/../b.mp4",
        "a/./b.mp4",
        "a\\b.mp4",
        "C:/a.mp4",
        "\0a.mp4",
    ]) {
        await assert.rejects(
            directFile.api.bootstrapFile("source-movies", invalid),
            /relative/
        );
    }
    await assert.rejects(
        directFile.api.bootstrapFile(
            "source-movies",
            "missing-private-name.mp4"
        ),
        (error) =>
            error.name === "NotFoundError" &&
            error.message === "Local file was not found"
    );
    assert.equal(directFile.iteratorReads(), 0);
    const directRestart = directFile.reinstall();
    const fromDirectCache = await settle(
        directRestart.list((catalog) => !catalog.items.length)
    );
    assert.equal(fromDirectCache.items[0].id, selectedFile.items[0].id);
    assert.equal(
        directFile.iteratorReads(),
        0,
        "next startup consumes the persisted reference before listing"
    );

    let releaseDirectFile;
    const cancelledDirect = fixture(1, "mp4", -1, undefined, {
        file: new Promise((resolve) => {
            releaseDirectFile = resolve;
        }),
    });
    await settle(
        cancelledDirect.api.list((catalog) => !catalog.sources.length)
    );
    const cancelledSelection = cancelledDirect.api.bootstrapFile(
        "source-movies",
        "movie-0.mp4"
    );
    await flushScans();
    cancelledDirect.api.suspend();
    releaseDirectFile();
    await assert.rejects(
        cancelledSelection,
        (error) => error.name === "AbortError"
    );
    assert.equal(
        cancelledDirect.writes(),
        0,
        "cancelled direct lookup cannot cache or select a file"
    );

    let failInitial;
    const failedWait = {
        iterator: new Promise((_, reject) => {
            failInitial = reject;
        }),
    };
    const failedInitial = fixture(2, "mp4", -1, undefined, failedWait);
    const failedScan = failedInitial.api.list();
    await flushScans();
    failInitial(
        Object.assign(new Error("fixture failure"), {
            name: "NotReadableError",
        })
    );
    assert.equal((await settle(failedScan)).items[0].available, false);
    failedWait.iterator = Promise.resolve();
    assert.equal((await settle(failedInitial.api.list())).items.length, 2);
    assert.equal(
        failedInitial.iteratorCreations(),
        2,
        "rejected first reads release their cache entry"
    );

    let releaseRoots;
    const roots = fixture(2, "mp4", -1, undefined, {
        iterator: new Promise((resolve) => {
            releaseRoots = resolve;
        }),
    });
    roots.addSource("source-second");
    const rootOne = roots.api.list();
    await flushScans();
    const rootTwo = roots.api.list(undefined, "source-second:movie-0.mp4");
    await flushScans();
    assert.equal(
        roots.iteratorCreations(),
        2,
        "different source roots never share a pending native enumeration"
    );
    releaseRoots();
    const rootResults = await settle(Promise.all([rootOne, rootTwo]));
    assert.equal(rootResults[0].items.length, 0);
    assert.equal(rootResults[1].items.length, 4);

    let releaseStandby;
    const initialStandby = fixture(2, "mp4", -1, undefined, {
        iterator: new Promise((resolve) => {
            releaseStandby = resolve;
        }),
    });
    const initialGate = initialStandby.installStandby();
    const sleepingInitial = initialStandby.api.list();
    await flushScans();
    initialGate.set(true);
    initialStandby.api.suspend();
    assert.equal(
        initialGate.snapshot().pending,
        2,
        "standby tracks the raw first read and its catalog separately"
    );
    initialGate.set(false);
    const wakingInitial = initialStandby.api.list();
    await flushScans();
    assert.equal(
        initialStandby.iteratorCreations(),
        1,
        "wake reuses a still-pending directory read"
    );
    releaseStandby();
    const wakeResults = await settle(
        Promise.all([sleepingInitial, wakingInitial])
    );
    assert.equal(wakeResults[0].items.length, 0);
    assert.equal(wakeResults[1].items.length, 2);
    await flushScans();
    assert.equal(initialGate.snapshot().pending, 0);

    let releaseFile;
    const sleeping = fixture(2, "mp4", -1, undefined, {
        file: new Promise((resolve) => {
            releaseFile = resolve;
        }),
    });
    const sleepingGate = sleeping.installStandby();
    const scan = sleeping.api.list();
    while (!sleeping.reads())
        await new Promise((resolve) => setImmediate(resolve));
    sleepingGate.set(true);
    sleeping.api.suspend();
    assert.equal(sleepingGate.snapshot().state, "suspending");
    assert.equal(sleepingGate.snapshot().pending, 2);
    releaseFile();
    const stoppedScan = await scan;
    await Promise.resolve();
    assert.equal(stoppedScan.cancelled, true);
    assert.equal(stoppedScan.items.length, 0);
    assert.equal(
        sleeping.reads(),
        1,
        "Standby prevents another filesystem read"
    );
    assert.equal(sleepingGate.snapshot().state, "suspended");
    let releaseDirectory;
    const preferredSleep = fixture(1, "mp4", -1, undefined, {
        directory: new Promise((resolve) => {
            releaseDirectory = resolve;
        }),
    });
    const preferredGate = preferredSleep.installStandby();
    const preferredScan = preferredSleep.api.list(
        undefined,
        "source-movies:sub/movie-0.mp4"
    );
    await new Promise((resolve) => setImmediate(resolve));
    preferredGate.set(true);
    preferredSleep.api.suspend();
    releaseDirectory();
    assert.equal((await preferredScan).cancelled, true);
    assert.equal(
        preferredSleep.reads(),
        0,
        "Retired preferred path cannot start a file read"
    );
    const stopped = fixture(10000);
    const stoppedResult = await stopped.api.list((snapshot) => {
        if (snapshot.items.length) stopped.api.suspend();
    });
    assert.equal(stoppedResult.cancelled, true);
    assert(
        stopped.reads() < 10000,
        "standby retires traversal before reading the remaining tree"
    );
    stopped.w.__ottStandby = {
        blocked: () => true,
        error: () => new Error("standby"),
    };
    await assert.rejects(stopped.api.list(), /standby/);
    const f = fixture(10000);
    let publications = 0,
        firstReads = 0,
        timerRan = false,
        immutable;
    setTimeout(() => {
        timerRan = true;
    }, 0);
    const full = await f.api.list((snapshot) => {
        publications++;
        assert.equal(snapshot.scanning, true);
        if (!firstReads && snapshot.items.length) {
            firstReads = f.reads();
            immutable = snapshot;
        }
    });
    assert.equal(
        full.items[0].directory,
        "Movies",
        "root item carries only its containing folder label"
    );
    assert.equal(
        firstReads,
        1,
        "first file is playable before reading the remaining 9,999"
    );
    assert.equal(
        immutable.items.length,
        1,
        "published arrays never grow behind consumers"
    );
    assert.equal(full.items.length, 10000);
    assert.equal(full.scanning, false);
    assert.ok(
        publications >= 150 && publications <= 165,
        "bounded batch publications, not one per file"
    );
    assert.equal(timerRan, true, "large traversals yield to browser tasks");
    const firstUrl = full.items[0].url;
    let preferredFirst;
    const resumed = await f.api.list((snapshot) => {
        if (snapshot.items.length) preferredFirst ||= snapshot.items[0].id;
    }, "source-movies:movie-9999.mp4");
    assert.equal(
        preferredFirst,
        "source-movies:movie-9999.mp4",
        "saved file resolves directly before traversal"
    );
    assert.equal(resumed.items[0].relativePath, "movie-9999.mp4");
    assert.equal(new Set(resumed.items.map((item) => item.id)).size, 10000);
    assert.equal(
        resumed.items.find((item) => item.id === full.items[0].id).url,
        firstUrl,
        "unchanged files keep playback URLs"
    );
    let missingFirst;
    const missing = await f.api.list((snapshot) => {
        if (snapshot.items.length && !missingFirst)
            missingFirst = {
                count: snapshot.items.length,
                preferred: snapshot.preferred,
                scanning: snapshot.scanning,
            };
    }, "source-movies:removed.mp4");
    assert.equal(missingFirst.count, 1);
    assert.equal(missingFirst.scanning, true);
    assert.deepEqual(JSON.parse(JSON.stringify(missingFirst.preferred)), {
        id: "source-movies:removed.mp4",
        state: "missing",
    });
    assert.equal(missing.items.length, 10000);
    const beforeCancel = f.reads();
    const cancelled = await f.api.list(() => false);
    assert.equal(cancelled.cancelled, true);
    assert.equal(
        f.reads() - beforeCancel,
        0,
        "consumer cancellation stops traversal"
    );
    assert.equal(
        f.revoked(),
        0,
        "cancellation never revokes active playback URLs"
    );
    const old = f.api.list();
    const newer = f.api.list();
    assert.equal((await old).cancelled, true, "superseded scan is cancelled");
    assert.equal((await newer).items.length, 10000);
    const text = fixture(10000, "txt");
    let heartbeats = 0;
    assert.equal(
        (
            await text.api.list(() => {
                heartbeats++;
            })
        ).items.length,
        0
    );
    assert.equal(
        text.reads(),
        0,
        "known nonmedia files do not require getFile"
    );
    assert.ok(heartbeats >= 150, "empty batches still publish progress");
    for (const [extension, mime] of [
        ["mkv", "video/x-matroska"],
        ["aac", "audio/aac"],
    ]) {
        const unknown = fixture(1, extension, -1, mime);
        assert.equal(
            (await unknown.api.list()).items.length,
            1,
            "unknown extension retains MIME-based media detection: " + extension
        );
        assert.equal(unknown.reads(), 1);
    }
    for (const extension of ["avi", "mkv"]) {
        const unsupported = fixture(
            1,
            extension,
            -1,
            extension === "avi" ? "video/x-msvideo" : "video/x-matroska"
        );
        const value = await unsupported.api.list();
        assert.equal(
            value.items.length,
            1,
            "unsupported reference remains identifiable"
        );
        assert.equal(value.items[0].available, false);
        assert.equal(value.items[0].url, "");
        assert.equal(value.items[0].playback.mode, "unsupported");
        assert.equal(unsupported.revoked(), 0);
    }
    const changed = await fixture(10000, "mp4", 17).api.list();
    assert.equal(
        changed.items.length,
        9999,
        "a disappearing file does not hide readable siblings"
    );
    assert.equal(changed.sources[0].available, true);
    let grantFirst;
    await f.api.requestAccess((snapshot) => {
        if (!snapshot.items.length) return;
        grantFirst = snapshot.items[0].id;
        return false;
    }, "source-movies:movie-9999.mp4");
    assert.equal(
        grantFirst,
        "source-movies:movie-9999.mp4",
        "permission recovery supports immediate preferred playback"
    );
    for (const [gateName, expectedPhase] of [
        ["records", "sources"],
        ["permission", "permission"],
        ["iterator", "files"],
    ]) {
        let release;
        const gate = new Promise((resolve) => {
            release = resolve;
        });
        const delayed = fixture(1, "mp4", -1, undefined, { [gateName]: gate });
        const phases = [];
        const pending = delayed.api.list((snapshot) => {
            phases.push(snapshot.phase);
        });
        await new Promise((resolve) => setTimeout(resolve, 1100));
        assert.equal(
            phases.filter((phase) => phase === expectedPhase).length,
            1,
            "one real phase transition, no artificial progress while awaiting " +
                gateName
        );
        assert.equal(delayed.reads(), 0);
        if (gateName === "permission") {
            const recovery = delayed.api.requestAccess(() => false);
            assert.equal(
                delayed.permissionRequests(),
                1,
                "unknown permission is requested synchronously on recovery click"
            );
            await recovery;
        } else await delayed.api.list(() => false);
        release();
        assert.equal((await pending).cancelled, true);
        assert.equal(delayed.revoked(), 0);
    }
    // Drive the real 10-second policy with a deterministic clock. The native
    // permission promise itself stays pending until explicitly released below.
    function permissionClock(target) {
        const timers = [];
        target.w.setTimeout = (callback, delay) => {
            if (delay !== 10000) return setTimeout(callback, delay);
            const timer = { active: true, callback };
            timers.push(timer);
            return timer;
        };
        target.w.clearTimeout = (timer) => {
            if (timer && typeof timer.active === "boolean")
                timer.active = false;
            else clearTimeout(timer);
        };
        return () => {
            const timer = timers.find((item) => item.active);
            assert.ok(timer, "a real permission deadline was scheduled");
            timer.active = false;
            timer.callback();
        };
    }
    let grantLate;
    const unresolvedPermission = new Promise((resolve) => {
        grantLate = resolve;
    });
    const stalledPermission = fixture(1, "mp4", -1, undefined, {
        permission: unresolvedPermission,
    });
    const expirePermission = permissionClock(stalledPermission);
    const beforePermissionTimeout = [];
    const permissionScan = stalledPermission.api.list((snapshot) =>
        beforePermissionTimeout.push(snapshot)
    );
    await new Promise(setImmediate);
    assert.equal(stalledPermission.permissionQueries(), 1);
    expirePermission();
    const permissionFailure = await settle(permissionScan);
    assert.equal(permissionFailure.scanning, false);
    assert.equal(permissionFailure.readErrorName, "TimeoutError");
    assert.equal(permissionFailure.readErrorPhase, "permission");
    assert.equal(permissionFailure.reconnectRequired, true);
    assert.equal(permissionFailure.sources[0].available, false);
    assert.equal(permissionFailure.items[0].url, "");
    assert.equal(permissionFailure.items[0].relativePath, null);
    assert.equal(stalledPermission.iteratorCreations(), 0);
    assert.equal(
        stalledPermission.permissionRequests(),
        0,
        "timeout never grants permission or opens a prompt"
    );
    const retriedPermission = await settle(stalledPermission.api.list());
    assert.equal(retriedPermission.reconnectRequired, true);
    assert.equal(
        stalledPermission.permissionQueries(),
        1,
        "retry reuses the unresolved native query"
    );
    const progressCount = beforePermissionTimeout.length;
    grantLate();
    await new Promise(setImmediate);
    assert.equal(
        beforePermissionTimeout.length,
        progressCount,
        "late grant cannot publish into the finished scan"
    );
    assert.equal(stalledPermission.iteratorCreations(), 0);
    const recoveredPermission = await settle(stalledPermission.api.list());
    assert.equal(recoveredPermission.items[0].available, true);
    assert.equal(
        stalledPermission.permissionQueries(),
        2,
        "a settled native call permits a fresh query"
    );

    const boundedPermissions = fixture(1, "mp4", -1, undefined, {
        permission: new Promise(() => {}),
    });
    boundedPermissions.addSource("source-second");
    boundedPermissions.addSource("source-third");
    const expireBounded = permissionClock(boundedPermissions);
    const boundedScan = boundedPermissions.api.list();
    await new Promise(setImmediate);
    expireBounded();
    await new Promise(setImmediate);
    expireBounded();
    const boundedFailure = await settle(boundedScan);
    assert.equal(
        boundedPermissions.permissionQueries(),
        2,
        "at most two native permission calls remain unresolved"
    );
    assert.equal(boundedFailure.sources.length, 3);
    assert.ok(
        boundedFailure.sources.every(
            (item) => !item.available && item.reconnectRequired
        )
    );
    await settle(boundedPermissions.api.list());
    assert.equal(
        boundedPermissions.permissionQueries(),
        2,
        "further scans cannot grow unresolved calls"
    );

    let finishCancelledPermission;
    const cancelledPermission = fixture(1, "mp4", -1, undefined, {
        permission: new Promise((resolve) => {
            finishCancelledPermission = resolve;
        }),
    });
    const cancelledScan = cancelledPermission.api.list();
    await new Promise(setImmediate);
    await cancelledPermission.api.list(() => false);
    finishCancelledPermission();
    const cancelledPermissionResult = await settle(cancelledScan);
    assert.equal(cancelledPermissionResult.cancelled, true);
    assert.equal(cancelledPermission.iteratorCreations(), 0);
    require("./helpers/browser-local-media-cli-contract.cjs")();
    await require("./helpers/browser-import-regression.cjs")();
    console.log(
        "PASS progressive local media: 10,000 entries, early playback, bounded immutable batches, yielding, direct saved-file lookup, stable URLs, cancellation, and nonmedia heartbeats"
    );
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
