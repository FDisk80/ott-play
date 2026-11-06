"use strict";
// Diagnostic-only. Installed before the fixture's query wrapper; inert until a
// completed catalog reports its original native permission TimeoutError.
function installTimeoutProbes(w, nativeQueryPermission) {
    const storage = w.navigator && w.navigator.storage;
    const nativeRoot = storage && storage.getDirectory;
    const indexedDB = w.indexedDB;
    const nativeOpen = indexedDB && indexedDB.open;
    const nativeDelete = indexedDB && indexedDB.deleteDatabase;
    const nativeClone = w.structuredClone;
    const nativeSameEntry =
        w.FileSystemHandle && w.FileSystemHandle.prototype.isSameEntry;
    const nativeFolder =
        w.FileSystemDirectoryHandle &&
        w.FileSystemDirectoryHandle.prototype.getDirectoryHandle;
    let used = false,
        ordinal = 0;
    const origin = w.performance.now();
    function emit(event, probe = "none", stage = "none", detail = {}) {
        if (ordinal >= 64) return;
        try {
            w.console.log(
                "[direct-media-probe] " +
                    JSON.stringify({
                        elapsedMs: Math.max(0, w.performance.now() - origin),
                        event,
                        ordinal: ++ordinal,
                        probe,
                        stage,
                        ...detail,
                    })
            );
        } catch (_) {
            /* Reporting cannot alter the original failure. */
        }
    }
    function errorName(error) {
        return [
            "Error",
            "TypeError",
            "AbortError",
            "NotFoundError",
            "NotAllowedError",
            "SecurityError",
            "InvalidStateError",
            "DataError",
            "DataCloneError",
            "VersionError",
        ].includes(error && error.name)
            ? error.name
            : "OtherError";
    }
    function qualifies(catalog) {
        return (
            catalog &&
            catalog.scanning === false &&
            catalog.cancelled === false &&
            catalog.readErrorPhase === "permission" &&
            catalog.readErrorName === "TimeoutError"
        );
    }
    function validSource(catalog) {
        const sources = catalog.sources;
        return (
            Array.isArray(sources) &&
            sources.length === 1 &&
            sources[0] &&
            sources[0].kind === "folder" &&
            sources[0].name === "Profile cartoons" &&
            typeof sources[0].id === "string" &&
            sources[0].id.length <= 256 &&
            /^source-[a-z0-9]+-[0-9]+-[a-z0-9]+$/.test(sources[0].id)
        );
    }
    async function query(handle, step) {
        const access = await step("native-query", () => {
            if (
                !handle ||
                handle.kind !== "directory" ||
                typeof nativeQueryPermission !== "function"
            )
                throw new TypeError("Probe handle unavailable");
            // Bypass only the fixture's observer/policy wrapper, not the
            // native permission decision. Never request or grant access.
            return nativeQueryPermission.call(handle, { mode: "read" });
        });
        if (!["granted", "denied", "prompt"].includes(access))
            throw new TypeError("Unexpected native permission result");
        return { access };
    }
    function probe(name, acquire, inspect = query) {
        return new Promise((resolve) => {
            let active = true,
                stage = "none",
                close = () => {};
            const deadline = w.performance.now() + 10000;
            const stopped = {};
            const timer = w.setTimeout(() => finish("timeout"), 10000);
            function finish(event, detail = {}) {
                if (!active) return;
                active = false;
                w.clearTimeout(timer);
                try {
                    close();
                } catch (_) {}
                emit(event, name, stage, detail);
                resolve();
            }
            function setClose(fn) {
                close = fn;
                if (!active) {
                    try {
                        close();
                    } catch (_) {}
                }
            }
            function alive() {
                if (active && w.performance.now() >= deadline)
                    finish("timeout");
                return active;
            }
            async function step(next, operation) {
                if (!alive()) throw stopped;
                stage = next;
                emit("phase", name, next);
                let pending;
                try {
                    pending = operation();
                    emit("returned", name, next);
                } catch (error) {
                    throw error;
                }
                return Promise.resolve(pending).then(
                    (value) => {
                        if (!alive()) {
                            emit("late-resolved", name, next);
                            throw stopped;
                        }
                        emit("resolved", name, next);
                        return value;
                    },
                    (error) => {
                        if (!alive())
                            emit("late-rejected", name, next, {
                                error: errorName(error),
                            });
                        throw error;
                    }
                );
            }
            Promise.resolve()
                .then(async () => {
                    const handle = await acquire(step, setClose, alive);
                    const detail = await inspect(handle, step);
                    if (!alive()) throw stopped;
                    finish("complete", detail);
                })
                .catch((error) => {
                    if (active) finish("rejected", { error: errorName(error) });
                });
        });
    }
    async function run(catalog) {
        if (!qualifies(catalog)) return;
        if (used) {
            emit("skipped");
            return;
        }
        used = true;
        emit("trigger");
        if (!validSource(catalog)) {
            emit("invalid-source");
            return;
        }
        const sourceId = catalog.sources[0].id;
        let restoredHandle, freshHandle;
        await probe("idb", async (step, setClose, alive) => {
            const db = await step(
                "idb-open",
                () =>
                    new Promise((resolve, reject) => {
                        if (typeof nativeOpen !== "function") {
                            reject(new TypeError("IDB unavailable"));
                            return;
                        }
                        const request = nativeOpen.call(
                            indexedDB,
                            "ott-local-media",
                            1
                        );
                        request.onupgradeneeded = () => {
                            // Never create/upgrade a database in this read-only probe.
                            try {
                                request.transaction.abort();
                            } catch (_) {}
                            reject(new Error("Unexpected IDB upgrade"));
                        };
                        request.onblocked = () =>
                            reject(new Error("IDB blocked"));
                        request.onerror = () => reject(request.error);
                        request.onsuccess = () => {
                            const opened = request.result;
                            setClose(() => opened.close());
                            if (!alive()) {
                                resolve(opened);
                                return;
                            }
                            resolve(opened);
                        };
                    })
            );
            restoredHandle = await step(
                "idb-read",
                () =>
                    new Promise((resolve, reject) => {
                        const tx = db.transaction("files", "readonly");
                        const request = tx.objectStore("files").get(sourceId);
                        let record;
                        request.onsuccess = () => {
                            record = request.result;
                        };
                        request.onerror = () => reject(request.error);
                        tx.onerror = tx.onabort = () =>
                            reject(tx.error || new Error("IDB read failed"));
                        tx.oncomplete = () => {
                            if (
                                !record ||
                                record.id !== sourceId ||
                                record.name !== "Profile cartoons" ||
                                !record.handle ||
                                record.handle.kind !== "directory"
                            ) {
                                reject(
                                    new TypeError("Source identity mismatch")
                                );
                                return;
                            }
                            resolve(record.handle);
                        };
                    })
            );
            return restoredHandle;
        });
        await probe("opfs", async (step) => {
            const root = await step("opfs-root", () => {
                if (typeof nativeRoot !== "function")
                    throw new TypeError("OPFS unavailable");
                return nativeRoot.call(storage);
            });
            freshHandle = await step("opfs-folder", () => {
                if (typeof nativeFolder !== "function")
                    throw new TypeError("OPFS folder unavailable");
                return nativeFolder.call(root, "Profile cartoons", {
                    create: false,
                });
            });
            return freshHandle;
        });
        await probe(
            "identity",
            async () => restoredHandle,
            async (handle, step) => {
                const sameEntry = await step("native-same-entry", () => {
                    if (
                        !handle ||
                        handle.kind !== "directory" ||
                        !freshHandle ||
                        freshHandle.kind !== "directory" ||
                        typeof nativeSameEntry !== "function"
                    )
                        throw new TypeError("Probe identity unavailable");
                    return nativeSameEntry.call(handle, freshHandle);
                });
                if (typeof sameEntry !== "boolean")
                    throw new TypeError("Unexpected native identity result");
                return { sameEntry };
            }
        );
        await probe("clone", (step) =>
            step("structured-clone", () => {
                if (!freshHandle || typeof nativeClone !== "function")
                    throw new TypeError("Probe clone unavailable");
                return nativeClone.call(w, freshHandle);
            })
        );
        await probe(
            "roundtrip",
            async (step, setClose, alive) => {
                // A unique disposable database isolates serialization from the app's
                // records and cache writes. The original database remains read-only.
                let db, tx, databaseName, deletion;
                function cleanup() {
                    try {
                        if (tx) tx.abort();
                    } catch (_) {}
                    if (db) db.close();
                    if (!databaseName) return;
                    if (!deletion) {
                        deletion = new Promise((resolve, reject) => {
                            const request = nativeDelete.call(
                                indexedDB,
                                databaseName
                            );
                            request.onsuccess = () => resolve();
                            request.onerror = () => reject(request.error);
                            // A blocked deletion stays subject to this probe's deadline.
                        });
                    }
                    return deletion;
                }
                setClose(() => {
                    // Also close/abort late openings after timeout. No cleanup wait
                    // can extend the probe or replace the original test failure.
                    Promise.resolve(cleanup()).catch(() => {});
                });
                await step(
                    "isolated-open",
                    () =>
                        new Promise((resolve, reject) => {
                            if (
                                !freshHandle ||
                                typeof nativeOpen !== "function" ||
                                typeof nativeDelete !== "function"
                            )
                                throw new TypeError(
                                    "Probe roundtrip unavailable"
                                );
                            databaseName =
                                "ott-direct-media-permission-probe-" +
                                w.crypto.randomUUID();
                            const request = nativeOpen.call(
                                indexedDB,
                                databaseName,
                                1
                            );
                            request.onupgradeneeded = () => {
                                if (!alive()) {
                                    request.transaction.abort();
                                    return;
                                }
                                request.result.createObjectStore("handles");
                            };
                            request.onblocked = () =>
                                reject(new Error("IDB blocked"));
                            request.onerror = () => reject(request.error);
                            request.onsuccess = () => {
                                db = request.result;
                                if (!alive())
                                    Promise.resolve(cleanup()).catch(() => {});
                                resolve();
                            };
                        })
                );
                await step(
                    "isolated-write",
                    () =>
                        new Promise((resolve, reject) => {
                            tx = db.transaction("handles", "readwrite");
                            tx.objectStore("handles").put(freshHandle, "fresh");
                            tx.oncomplete = () => {
                                tx = null;
                                resolve();
                            };
                            tx.onerror = tx.onabort = () =>
                                reject(
                                    tx.error || new Error("IDB write failed")
                                );
                        })
                );
                const handle = await step(
                    "isolated-read",
                    () =>
                        new Promise((resolve, reject) => {
                            tx = db.transaction("handles", "readonly");
                            const request = tx
                                .objectStore("handles")
                                .get("fresh");
                            let result;
                            request.onsuccess = () => {
                                result = request.result;
                            };
                            request.onerror = () => reject(request.error);
                            tx.onerror = tx.onabort = () =>
                                reject(
                                    tx.error || new Error("IDB read failed")
                                );
                            tx.oncomplete = () => {
                                tx = null;
                                resolve(result);
                            };
                        })
                );
                return { cleanup, handle };
            },
            async ({ handle, cleanup }, step) => {
                // Query while the database still exists: deleting it first would
                // conflate serialization with the handle's deletion lifetime.
                const detail = await query(handle, step);
                await step("isolated-delete", cleanup);
                return detail;
            }
        );
    }
    w.__directMediaTimeoutProbes = run;
}
function parseProbeEvent(text) {
    if (text.length > 2048) throw new Error("PROBE_EVENT_BOUND");
    const row = JSON.parse(text);
    const keys = [
        "event",
        "probe",
        "stage",
        "ordinal",
        "elapsedMs",
        "access",
        "error",
        "sameEntry",
    ];
    if (
        !row ||
        Array.isArray(row) ||
        Object.keys(row).some((k) => !keys.includes(k)) ||
        ![
            "trigger",
            "skipped",
            "invalid-source",
            "phase",
            "returned",
            "resolved",
            "late-resolved",
            "late-rejected",
            "timeout",
            "rejected",
            "complete",
        ].includes(row.event) ||
        !["none", "idb", "opfs", "identity", "clone", "roundtrip"].includes(
            row.probe
        ) ||
        ![
            "none",
            "idb-open",
            "idb-read",
            "opfs-root",
            "opfs-folder",
            "native-query",
            "native-same-entry",
            "structured-clone",
            "isolated-open",
            "isolated-write",
            "isolated-read",
            "isolated-delete",
        ].includes(row.stage) ||
        !Number.isInteger(row.ordinal) ||
        row.ordinal < 1 ||
        row.ordinal > 64 ||
        !Number.isFinite(row.elapsedMs) ||
        row.elapsedMs < 0 ||
        row.elapsedMs > 120000 ||
        ("sameEntry" in row && typeof row.sameEntry !== "boolean") ||
        ("access" in row &&
            !["granted", "denied", "prompt"].includes(row.access)) ||
        ("error" in row &&
            ![
                "Error",
                "TypeError",
                "AbortError",
                "NotFoundError",
                "NotAllowedError",
                "SecurityError",
                "InvalidStateError",
                "DataError",
                "DataCloneError",
                "VersionError",
                "OtherError",
            ].includes(row.error))
    )
        throw new Error("PROBE_EVENT_SHAPE");
    return row;
}
module.exports = { installTimeoutProbes, parseProbeEvent };
