const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const ts = require("typescript");
const { chromium } = require("@playwright/test");
const source = ts.transpileModule(
    fs
        .readFileSync(
            require("node:path").join(
                __dirname,
                "../src/offline/browser-local-media.ts"
            ),
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
const profileSource = require("./helpers/offline-profile-source.cjs")();
require("acorn").parse(profileSource, { ecmaVersion: 5 });

// Keep the deadline active through teardown: an evaluate or close promise may
// otherwise hide its original failure until the CI step's ten-minute limit.
let phase = "initializing";
function checkpoint(value) {
    phase = value;
    console.log("[direct-media] " + phase);
}
const deadline = setTimeout(
    () => {
        console.error(
            "[direct-media] whole-test deadline exceeded during " + phase
        );
        process.exit(1);
    },
    process.argv.includes("--large-folder") ? 540000 : 120000
);
deadline.unref();

(async () => {
    const server = http.createServer((req, res) =>
        res.end("<script>" + source + profileSource + "</script>")
    );
    checkpoint("listen");
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    checkpoint("launch browser");
    const browser = await chromium.launch({ headless: true });
    try {
        checkpoint("initial context");
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto("http://127.0.0.1:" + server.address().port);
        checkpoint("read/import/refresh/permission fixture");
        const result = await page.evaluate(async () => {
            const root = await navigator.storage.getDirectory();
            const dir = await root.getDirectoryHandle("fixture", {
                create: true,
            });
            const nested = await dir.getDirectoryHandle("nested", {
                create: true,
            });
            async function put(folder, name, data) {
                const f = await folder.getFileHandle(name, { create: true });
                const out = await f.createWritable();
                await out.write(data);
                await out.close();
                return f;
            }
            await put(nested, "movie.mp4", "original");
            await put(dir, "notes.txt", "skip");
            window.showDirectoryPicker = () => Promise.resolve(dir);
            const api = installBrowserLocalMedia(window);
            const initial = await api.importFolder();
            const db = await new Promise((resolve, reject) => {
                const r = indexedDB.open("ott-local-media", 1);
                r.onsuccess = () => resolve(r.result);
                r.onerror = () => reject(r.error);
            });
            const stored = await new Promise((resolve, reject) => {
                const tx = db.transaction("files");
                const r = tx.objectStore("files").getAll();
                r.onsuccess = () => resolve(r.result);
                r.onerror = () => reject(r.error);
                tx.onerror = () => reject(tx.error);
                tx.onabort = () =>
                    reject(tx.error || new Error("Fixture read aborted"));
            });
            await put(nested, "movie.mp4", "replacement-is-longer");
            const updated = await api.list();
            const body = await (await fetch(updated.items[0].url)).text();
            await put(nested, "second.mp4", "second");
            const refreshed = await api.list();
            const originalQuery =
                FileSystemDirectoryHandle.prototype.queryPermission;
            FileSystemDirectoryHandle.prototype.queryPermission = () =>
                Promise.resolve("prompt");
            const locked = await api.list();
            FileSystemDirectoryHandle.prototype.queryPermission = originalQuery;
            const reconnected = await api.requestAccess();
            await api.removeSource(initial.sources[0].id);
            const preserved = await (
                await nested.getFileHandle("movie.mp4")
            ).getFile();
            await new Promise((resolve, reject) => {
                const tx = db.transaction("files", "readwrite");
                tx.objectStore("files").put({
                    blob: new Blob(["legacy"], { type: "video/mp4" }),
                    created: 1,
                    id: "legacy",
                    name: "legacy.mp4",
                });
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
                tx.onabort = () =>
                    reject(tx.error || new Error("Fixture write aborted"));
            });
            const legacy = await api.list();
            window.showDirectoryPicker = undefined;
            let unsupported = "";
            try {
                await api.importFolder();
            } catch (e) {
                unsupported = e.message;
            }
            return {
                body,
                initial,
                legacy,
                locked,
                preserved: preserved.size,
                reconnected,
                refreshed,
                stored: stored.map((r) => ({
                    hasBlob: !!r.blob,
                    hasHandle: !!r.handle,
                })),
                unsupported,
            };
        });
        assert.equal(result.initial.items.length, 1);
        assert.equal(result.initial.items[0].name, "nested/movie.mp4");
        assert.deepEqual(result.stored, [{ hasBlob: false, hasHandle: true }]);
        assert.equal(result.body, "replacement-is-longer");
        assert.equal(result.refreshed.items.length, 2);
        assert.equal(result.locked.items[0].access, "permission-required");
        assert.equal(result.locked.items[0].url, "");
        assert.equal(result.locked.items[0].relativePath, null);
        assert.equal(result.reconnected.items.length, 2);
        assert.ok(result.preserved > 0);
        assert.equal(result.legacy.items[0].source, "imported");
        assert.match(result.unsupported, /Direct folder access is unavailable/);
        await page.reload();
        checkpoint("legacy reload");
        const legacy = await page.evaluate(async () => {
            const list = await installBrowserLocalMedia(window).list();
            return (await fetch(list.items[0].url)).text();
        });
        assert.equal(legacy, "legacy");
        await page.evaluate(async () => {
            const root = await navigator.storage.getDirectory();
            const dir = await root.getDirectoryHandle("fixture");
            window.showDirectoryPicker = () => Promise.resolve(dir);
            await window.__ottBrowserLocalMedia.importFolder();
        });
        await page.reload();
        checkpoint("linked-source reload");
        const restored = await page.evaluate(async () => {
            const list = await installBrowserLocalMedia(window).list();
            return {
                linked: list.items.filter((i) => i.source === "linked").length,
                sources: list.sources.length,
            };
        });
        assert.equal(restored.linked, 2);
        assert.equal(restored.sources, 1);
        // Closing the page (rather than merely reloading it) destroys all
        // in-memory handles and object URLs. Only IndexedDB may restore them.
        const origin = "http://127.0.0.1:" + server.address().port;
        checkpoint("close original page");
        await page.close();
        const reopened = await context.newPage();
        await reopened.goto(origin);
        checkpoint("closed-page restoration and permission recovery");
        const resume = await reopened.evaluate(async () => {
            const api = installBrowserLocalMedia(window);
            const available = await api.list();
            const body = await (
                await fetch(
                    available.items.find((i) => i.name === "nested/movie.mp4")
                        .url
                )
            ).text();
            const root = await navigator.storage.getDirectory();
            const second = await root.getDirectoryHandle("second-source", {
                create: true,
            });
            window.showDirectoryPicker = () => Promise.resolve(second);
            await api.importFolder();
            const proto = FileSystemDirectoryHandle.prototype;
            const query = proto.queryPermission;
            const request = proto.requestPermission;
            let granted = false;
            let prompts = 0;
            proto.queryPermission = () =>
                Promise.resolve(granted ? "granted" : "prompt");
            proto.requestPermission = (options) => {
                if (options.mode !== "read")
                    throw new Error("Write access requested");
                prompts++;
                granted = true;
                return Promise.resolve("granted");
            };
            const locked = await api.list();
            const recovered = await api.requestAccess();
            await api.requestAccess();
            proto.queryPermission = query;
            proto.requestPermission = request;
            return {
                body,
                locked: locked.sources.map((s) => s.access),
                prompts,
                recovered: recovered.sources.map((s) => s.access),
            };
        });
        assert.equal(resume.body, "replacement-is-longer");
        assert.deepEqual(resume.locked, [
            "permission-required",
            "permission-required",
        ]);
        assert.equal(
            resume.prompts,
            1,
            "one click restores all shared grants without parallel prompts"
        );
        assert.deepEqual(resume.recovered, ["granted", "granted"]);
        checkpoint("profile context");
        const profileContext = await browser.newContext();
        // Keep real OPFS handles, IndexedDB, and page closure. Only model the
        // external-folder permission policy, as in the built-UI fixture.
        await profileContext.addInitScript(() => {
            const permission = {
                queries: 0,
                queriesRejected: 0,
                queriesResolved: 0,
                requests: 0,
                state: "granted",
            };
            const nativeQueryPermission =
                FileSystemHandle.prototype.queryPermission;
            window.__directMediaProfilePermission = permission;
            FileSystemHandle.prototype.queryPermission = function (options) {
                if (!options || options.mode !== "read")
                    throw new Error("Profile fixture requires read permission");
                permission.queries++;
                const state = permission.state;
                // Keep the browser's check on restored handles. The fixture
                // may restrict access, but must not grant it over native denial.
                return nativeQueryPermission.call(this, options).then(
                    (access) => {
                        permission.queriesResolved++;
                        return access === "granted" ? state : access;
                    },
                    (error) => {
                        permission.queriesRejected++;
                        throw error;
                    }
                );
            };
            FileSystemHandle.prototype.requestPermission = function (options) {
                if (!options || options.mode !== "read")
                    throw new Error("Profile fixture requires read permission");
                permission.requests++;
                permission.state = "granted";
                return Promise.resolve(permission.state);
            };
        });
        let profilePage = await profileContext.newPage();
        const address = "http://127.0.0.1:" + server.address().port;
        await profilePage.goto(address);
        checkpoint("profile save/export");
        const portable = await profilePage.evaluate(async () => {
            const root = await navigator.storage.getDirectory();
            const folder = await root.getDirectoryHandle("Profile cartoons", {
                create: true,
            });
            for (const name of ["first.mp4", "second.mp4"]) {
                const file = await folder.getFileHandle(name, { create: true });
                const out = await file.createWritable();
                await out.write(name);
                await out.close();
            }
            window.showDirectoryPicker = () => Promise.resolve(folder);
            const media = installBrowserLocalMedia(window);
            const catalog = await media.importFolder();
            const selected = catalog.items.find(
                (item) => item.name === "second.mp4"
            );
            window.stbDelItem = (key) => localStorage.removeItem(key);
            window.stbGetItem = (key) => localStorage.getItem(key);
            window.stbSetItem = (key, value) =>
                localStorage.setItem(key, value);
            window.__ottActiveProviderDriver = { id: "offline" };
            window.curList = ["local-" + selected.id];
            window.primaryIndex = 0;
            window.loadChannels = () => {};
            const profiles = installOfflineProfiles(window, {
                libraryIdentity: () => "browser:",
                snapshot: () => Promise.resolve(catalog),
            });
            const saved = await profiles.request({
                action: "profile_save",
                params: { name: "Kids", number: 1 },
            });
            if (saved.status !== "ok") throw new Error(JSON.stringify(saved));
            return (
                await profiles.request({
                    action: "profile_export",
                    params: { number: 1 },
                })
            ).data.profile;
        });
        assert.equal(portable.selected.name, "second.mp4");
        assert(!JSON.stringify(portable).includes("blob:"));
        checkpoint("close saved-profile page");
        await profilePage.close();
        profilePage = await profileContext.newPage();
        await profilePage.goto(address);
        checkpoint("profile import/load after reopen");
        const profilePhasePrefix = "[direct-media-profile] ";
        const profileConsole = (message) => {
            const text = message.text();
            if (text.startsWith(profilePhasePrefix))
                checkpoint(
                    "profile reopen: " + text.slice(profilePhasePrefix.length)
                );
        };
        profilePage.on("console", profileConsole);
        const profilePageError = () => checkpoint("profile reopen: pageerror");
        const profilePageCrash = () => checkpoint("profile reopen: pagecrash");
        profilePage.once("pageerror", profilePageError);
        profilePage.once("crash", profilePageCrash);
        const restoredProfile = await profilePage.evaluate(async (profile) => {
            window.stbDelItem = (key) => localStorage.removeItem(key);
            window.stbGetItem = (key) => localStorage.getItem(key);
            window.stbSetItem = (key, value) =>
                localStorage.setItem(key, value);
            window.__ottActiveProviderDriver = { id: "offline" };
            window.loadChannels = () => {};
            const media = installBrowserLocalMedia(window);
            const profiles = installOfflineProfiles(window, {
                libraryIdentity: () => "browser:",
                list: () => media.list(),
            });
            console.log("[direct-media-profile] import");
            const imported = await profiles.request({
                action: "profile_import",
                params: { number: 2, profile },
            });
            console.log("[direct-media-profile] load");
            const loaded = await profiles.request({
                action: "profile",
                params: { number: 2 },
            });
            // Observe the real browser boundary without replacing its iterator,
            // promises, fulfillment values, or rejection reasons.
            const directoryPrototype = FileSystemDirectoryHandle.prototype;
            const nativeValues = directoryPrototype.values;
            const started = performance.now();
            const reads = {
                nextCalls: 0,
                nextRejected: 0,
                nextResolved: 0,
                nextThrown: 0,
                valuesCalls: 0,
                valuesThrown: 0,
            };
            let diagnosticLines = 0;
            function diagnostic(event, eventLoopMs = 0) {
                if (!eventLoopMs && diagnosticLines >= 16) return;
                if (!eventLoopMs) diagnosticLines++;
                try {
                    console.log(
                        "[direct-media-profile] diagnostic " +
                            JSON.stringify({
                                ...reads,
                                elapsedMs: Math.floor(
                                    performance.now() - started
                                ),
                                event,
                                eventLoopMs,
                                focused: document.hasFocus(),
                                queries:
                                    window.__directMediaProfilePermission
                                        .queries,
                                queriesRejected:
                                    window.__directMediaProfilePermission
                                        .queriesRejected,
                                queriesResolved:
                                    window.__directMediaProfilePermission
                                        .queriesResolved,
                                visibility: document.visibilityState,
                            })
                    );
                } catch (_) {
                    // Diagnostic reporting cannot reject the native operation.
                }
            }
            directoryPrototype.values = function () {
                reads.valuesCalls++;
                diagnostic("values-call");
                let iterator;
                try {
                    iterator = nativeValues.apply(this, arguments);
                } catch (error) {
                    reads.valuesThrown++;
                    diagnostic("values-throw");
                    throw error;
                }
                const nativeNext = iterator.next;
                iterator.next = function () {
                    reads.nextCalls++;
                    diagnostic("next-call");
                    let pending;
                    try {
                        pending = nativeNext.apply(this, arguments);
                    } catch (error) {
                        reads.nextThrown++;
                        diagnostic("next-throw");
                        throw error;
                    }
                    // Observe settlement on a separate branch; return the exact
                    // native promise to the production consumer below.
                    Promise.prototype.then.call(
                        pending,
                        () => {
                            reads.nextResolved++;
                            diagnostic("next-resolved");
                        },
                        () => {
                            reads.nextRejected++;
                            diagnostic("next-rejected");
                        }
                    );
                    return pending;
                };
                diagnostic("values-return");
                return iterator;
            };
            // Four one-shot checkpoints prove whether page timers can still run
            // while a native read is pending. They never retry or cancel a read.
            const responsiveness = [1000, 10000, 30000, 60000].map((delay) =>
                setTimeout(() => diagnostic("event-loop", delay), delay)
            );
            console.log("[direct-media-profile] list");
            let lastProgress = "",
                progressLines = 0,
                progressBytes = 0,
                progressCapped = false;
            const catalogRead = media.list((value) => {
                // Diagnostics must never cancel or alter the catalog operation.
                try {
                    const phases = [
                        "sources",
                        "permission",
                        "files",
                        "enumerating",
                        "metadata",
                        "complete",
                    ];
                    const count = (number) =>
                        typeof number === "number" &&
                        Number.isFinite(number) &&
                        number >= 0
                            ? Math.floor(Math.min(number, 1000000000))
                            : 0;
                    const phase = value.phase;
                    const summary = JSON.stringify({
                        discovered: count(value.discovered),
                        items: count(
                            Array.isArray(value.items) ? value.items.length : 0
                        ),
                        phase: phases.includes(phase) ? phase : "unknown",
                        scanned: count(value.scanned),
                        sources: count(
                            Array.isArray(value.sources)
                                ? value.sources.length
                                : 0
                        ),
                    });
                    if (summary === lastProgress || progressCapped) return;
                    lastProgress = summary;
                    const line = "[direct-media-profile] list " + summary;
                    if (
                        progressLines >= 24 ||
                        progressBytes + line.length > 3840
                    ) {
                        progressCapped = true;
                        console.log(
                            '[direct-media-profile] list {"phase":"diagnostic-cap","omitted":1}'
                        );
                        return;
                    }
                    progressLines++;
                    progressBytes += line.length;
                    console.log(line);
                } catch (_) {
                    // A malformed diagnostic field cannot reject the real scan.
                }
            });
            const rawCatalog = await catalogRead.finally(() => {
                directoryPrototype.values = nativeValues;
                responsiveness.forEach((timer) => clearTimeout(timer));
            });
            console.log("[direct-media-profile] list-resolved");
            if (rawCatalog.scanning !== false || rawCatalog.cancelled !== false)
                throw new Error("Profile catalog did not complete");
            if (rawCatalog.readErrorName || rawCatalog.reconnectRequired) {
                const permission = window.__directMediaProfilePermission;
                const phase =
                    rawCatalog.readErrorPhase === "permission"
                        ? "permission"
                        : "source read";
                const reason =
                    rawCatalog.readErrorName === "TimeoutError"
                        ? "timed out"
                        : "failed";
                throw new Error(
                    "Profile catalog " +
                        phase +
                        " " +
                        reason +
                        "; native permission queries=" +
                        permission.queries +
                        ", resolved=" +
                        permission.queriesResolved +
                        ", rejected=" +
                        permission.queriesRejected
                );
            }
            if (
                !Array.isArray(rawCatalog.sources) ||
                !rawCatalog.sources.length ||
                rawCatalog.sources.some(
                    (source) => source.access !== "granted" || !source.available
                )
            )
                throw new Error(
                    "Profile catalog did not restore readable sources"
                );
            const catalog = profiles.filter(rawCatalog);
            const item = catalog.items.find(
                (item) => "local-" + item.id === profiles.selection()
            );
            if (!item)
                throw new Error(
                    "Profile catalog completed without the selected file"
                );
            if (
                item.available === false ||
                typeof item.url !== "string" ||
                !item.url
            )
                throw new Error("Profile selected file has no readable URL");
            console.log("[direct-media-profile] blob fetch");
            const response = await fetch(item.url);
            console.log("[direct-media-profile] blob body");
            const body = await response.text();
            console.log("[direct-media-profile] complete");
            return {
                body,
                count: catalog.items.length,
                imported,
                loaded,
                permission: window.__directMediaProfilePermission,
            };
        }, portable);
        profilePage.off("console", profileConsole);
        profilePage.off("pageerror", profilePageError);
        profilePage.off("crash", profilePageCrash);
        assert.equal(restoredProfile.imported.data.binding_required, false);
        assert.equal(restoredProfile.loaded.status, "ok");
        assert.equal(restoredProfile.body, "second.mp4");
        assert.equal(restoredProfile.count, 2);
        assert(
            restoredProfile.permission.queries > 0,
            "reopened profile reads permission through the modeled policy"
        );
        assert.equal(restoredProfile.permission.queriesRejected, 0);
        assert.equal(
            restoredProfile.permission.queriesResolved,
            restoredProfile.permission.queries
        );
        assert.equal(restoredProfile.permission.requests, 0);
        assert.equal(restoredProfile.permission.state, "granted");
        checkpoint("foreign profile context");
        const foreignContext = await browser.newContext();
        const foreignPage = await foreignContext.newPage();
        await foreignPage.goto(address);
        checkpoint("foreign profile binding");
        const foreign = await foreignPage.evaluate(async (profile) => {
            window.stbDelItem = (key) => localStorage.removeItem(key);
            window.stbGetItem = (key) => localStorage.getItem(key);
            window.stbSetItem = (key, value) =>
                localStorage.setItem(key, value);
            window.__ottActiveProviderDriver = { id: "offline" };
            window.loadChannels = () => {};
            const media = installBrowserLocalMedia(window);
            const profiles = installOfflineProfiles(window, {
                libraryIdentity: () => "browser:",
                list: () => media.list(),
            });
            const imported = await profiles.request({
                action: "profile_import",
                params: { number: 1, profile },
            });
            await profiles.request({
                action: "profile",
                params: { number: 1 },
            });
            return {
                count: profiles.filter(await media.list()).items.length,
                imported,
                selected: profiles.selection(),
            };
        }, portable);
        assert.equal(foreign.imported.data.binding_required, true);
        assert.equal(foreign.count, 0);
        assert.equal(foreign.selected, "");
        checkpoint("close foreign context");
        await foreignContext.close();
        checkpoint("close profile context");
        await profileContext.close();
        if (process.argv.includes("--large-folder")) {
            checkpoint("optional large-folder stress");
            await require("./helpers/browser-large-folder.cjs")(
                browser,
                "http://127.0.0.1:" + server.address().port
            );
        }
        console.log(
            "PASS offline profiles: real IndexedDB handles survive closed-page save/export/import/load; exact selected original read; foreign context requires binding"
        );
        console.log(
            "PASS direct browser sources: recursive read, handle-only storage, fresh file reads, refresh, permission status/reconnect, disconnect preserves originals, legacy blobs, unsupported browser, closed-page restoration, single read-only restore prompt"
        );
    } catch (error) {
        // Report before cleanup so a hung close cannot conceal the assertion.
        console.error("[direct-media] failed during " + phase, error);
        throw error;
    } finally {
        checkpoint("close browser");
        await browser.close();
        checkpoint("close HTTP server");
        await new Promise((r) => server.close(r));
    }
})().then(
    () => {
        clearTimeout(deadline);
    },
    (error) => {
        clearTimeout(deadline);
        console.error("[direct-media] failed during " + phase, error);
        process.exit(1);
    }
);
