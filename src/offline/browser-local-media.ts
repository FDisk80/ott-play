/** Direct local sources: new entries store handles, never copied media bytes. */
export function installBrowserLocalMedia(w: any): any {
    var sourceUnavailableMessage = "Local folder source is unavailable";
    if (w.__ottBrowserLocalMedia) return w.__ottBrowserLocalMedia;
    var dbPromise: Promise<any> | null = null;
    var urls: any = {};
    var knownSources: any[] = [];
    var scanGeneration = 0;
    var reconnectTransactions: any[] = [];
    var pendingReads: any = Object.create(null);
    var pendingReadCounts = [0, 0];
    var fileTimeoutMessage = "Local file did not respond";
    var pendingDirectories: any = Object.create(null);
    var cacheWrites = Promise.resolve();
    var urlApi = w.URL || w.webkitURL;
    var available = !!(w.indexedDB && urlApi && urlApi.createObjectURL);

    function retireScans(): number {
        scanGeneration++;
        // The native picker cannot be cancelled from JavaScript. A transaction
        // that has not committed yet can, so discard its eventual selection.
        reconnectTransactions.slice().forEach(function (tx) {
            try {
                tx.abort();
            } catch (_) {}
        });
        return scanGeneration;
    }

    function open(): Promise<any> {
        if (!available)
            return Promise.reject(
                new Error("Local media storage is unavailable in this browser")
            );
        if (!dbPromise)
            dbPromise = new Promise(function (resolve, reject) {
                var request = w.indexedDB.open("ott-local-media", 1);
                request.onupgradeneeded = function () {
                    request.result.createObjectStore("files", {
                        keyPath: "id",
                    });
                };
                request.onsuccess = function () {
                    var db = request.result;
                    db.onversionchange = function () {
                        db.close();
                        dbPromise = null;
                    };
                    resolve(db);
                };
                request.onerror = function () {
                    dbPromise = null;
                    reject(new Error("Could not open local media storage"));
                };
                request.onblocked = function () {
                    dbPromise = null;
                    reject(
                        new Error(
                            "Close other player tabs to update local media storage"
                        )
                    );
                };
            });
        return dbPromise;
    }
    function records(
        onRecord?: (record: any, count: number) => boolean
    ): Promise<any[]> {
        return open().then(function (db) {
            return new Promise<any[]>(function (resolve, reject) {
                var result: any[] = [],
                    tx = db.transaction("files", "readonly"),
                    cursor = tx.objectStore("files").openCursor();
                cursor.onsuccess = function () {
                    var c = cursor.result;
                    if (c) {
                        result.push(c.value);
                        if (!onRecord || onRecord(c.value, result.length))
                            c.continue();
                    }
                };
                tx.oncomplete = function () {
                    resolve(
                        result.sort(function (a, b) {
                            return (
                                a.created - b.created ||
                                a.id.localeCompare(b.id)
                            );
                        })
                    );
                };
                tx.onerror = tx.onabort = function () {
                    reject(new Error("Could not read local media sources"));
                };
            });
        });
    }
    function media(file: any): boolean {
        return (
            /^(video|audio)\//i.test(file.type || "") ||
            /\.(mp4|m4v|webm|mp3|m4a|ogg|wav|mov|avi|mkv)$/i.test(
                file.name || ""
            )
        );
    }
    function readTimeout(permission?: boolean, limit?: boolean): Error {
        var error: any = new Error(
            permission
                ? "Local source permission did not respond"
                : fileTimeoutMessage
        );
        error.name = "TimeoutError";
        error.localMediaLimit = !!limit;
        error.localMediaReconnectRequired = true;
        return error;
    }
    function observeRead(read: () => any): Promise<any> {
        var pending: Promise<any>;
        try {
            pending = Promise.resolve(read());
        } catch (error) {
            pending = Promise.reject(error);
        }
        if (w.__ottStandby) w.__ottStandby.observe(pending);
        return pending;
    }
    function readHandle(
        id: string,
        handle: any,
        permission?: boolean
    ): Promise<any> {
        // Neither browser call can be cancelled. Keep independent file and
        // permission limits across scans until the native calls really settle.
        var kind = permission ? 1 : 0;
        var key = kind + ":" + id;
        var old = pendingReads[key];
        if (old)
            return old.timedOut
                ? Promise.reject(readTimeout(permission))
                : old.result;
        if (pendingReadCounts[kind] >= 2)
            return Promise.reject(readTimeout(permission, true));
        var entry: any = {};
        pendingReads[key] = entry;
        pendingReadCounts[kind]++;
        entry.result = new Promise(function (resolve, reject) {
            var timer = w.setTimeout(function () {
                entry.timedOut = true;
                reject(readTimeout(permission));
            }, 10000);
            var pending = observeRead(function () {
                return permission
                    ? handle.queryPermission({ mode: "read" })
                    : handle.getFile();
            });
            function finish(error: any, value?: any): void {
                delete pendingReads[key];
                pendingReadCounts[kind]--;
                w.clearTimeout(timer);
                if (entry.timedOut) return;
                if (error) reject(error);
                else resolve(value);
            }
            pending.then(
                function (value) {
                    finish(null, value);
                },
                function (error) {
                    finish(error);
                }
            );
        });
        return entry.result;
    }
    function firstDirectoryRead(id: string, handle: any): any {
        if (pendingDirectories[id]) return pendingDirectories[id];
        var entry: any = {};
        pendingDirectories[id] = entry;
        entry.pending = new Promise(function (resolve, reject) {
            var timedOut = false;
            // Chrome may enumerate an entire network directory before returning
            // its first entry. Keep that allowance, but do not share a dead read
            // forever after a mount disappears and comes back.
            var timer = w.setTimeout(function () {
                timedOut = true;
                var error: any = new Error("Local folder did not respond");
                error.name = "TimeoutError";
                error.localMediaReconnectRequired = true;
                reject(error);
            }, 2700000);
            var pending = observeRead(function () {
                entry.iterator = handle.values();
                return entry.iterator.next();
            });
            function finish(error: any, value?: any): void {
                if (pendingDirectories[id] === entry)
                    delete pendingDirectories[id];
                w.clearTimeout(timer);
                if (timedOut) return;
                if (error) reject(error);
                else resolve(value);
            }
            pending.then(
                function (value) {
                    finish(null, value);
                },
                function (error) {
                    finish(error);
                }
            );
        });
        // A timed-out promise stays cached until the browser call really settles.
        // Retrying reports recovery immediately instead of queuing native reads.
        return entry;
    }
    // Cache a handful of successful references, never File objects or media
    // bytes. They let the next launch start playback before Chrome finishes
    // statting every entry in a large network directory.
    function remember(
        sourceId: string,
        path: string,
        handle: any,
        priority = false,
        generation?: number
    ): Promise<void> {
        var record = knownSources.filter(function (source) {
            return source.id === sourceId;
        })[0];
        if (!record || record.handle.kind !== "directory") return cacheWrites;
        var candidates = (record.bootstrap || []).slice(0, 8);
        if (
            !priority &&
            (candidates.length >= 8 ||
                candidates.some(function (candidate: any) {
                    return candidate.path === path;
                }))
        )
            return cacheWrites;
        if (priority) {
            candidates = candidates.filter(function (candidate: any) {
                return candidate.path !== path;
            });
            candidates.unshift({ handle: handle, path: path });
            candidates = candidates.slice(0, 8);
        } else candidates.push({ handle: handle, path: path });
        if (!priority) record.bootstrap = candidates;
        var cacheEpoch = record.cacheEpoch;
        // Only this small reference cache is serialized. Playback and traversal
        // do not wait for storage, and a failure leaves the live source usable.
        var write = cacheWrites.then(function () {
            return open().then(function (db) {
                return new Promise<void>(function (resolve, reject) {
                    if (priority && generation !== scanGeneration) {
                        reject();
                        return;
                    }
                    var tx = db.transaction("files", "readwrite");
                    if (priority) reconnectTransactions.push(tx);
                    function forget(): void {
                        reconnectTransactions = reconnectTransactions.filter(
                            function (pending) {
                                return pending !== tx;
                            }
                        );
                    }
                    var store = tx.objectStore("files");
                    var request = store.get(sourceId);
                    request.onsuccess = function () {
                        if (priority && generation !== scanGeneration) {
                            tx.abort();
                            return;
                        }
                        var current = request.result;
                        if (!current) {
                            reject(new Error(sourceUnavailableMessage));
                            return;
                        }
                        // Reconnect/remove invalidate all old references.
                        // Their completion advances this cache generation.
                        if (current.cacheEpoch !== cacheEpoch) {
                            reject(
                                new Error("Local folder source has changed")
                            );
                            return;
                        }
                        store.put(
                            Object.assign({}, current, {
                                bootstrap: candidates,
                            })
                        );
                    };
                    tx.oncomplete = function () {
                        forget();
                        if (priority) record.bootstrap = candidates;
                        resolve();
                    };
                    tx.onerror = tx.onabort = function () {
                        forget();
                        reject();
                    };
                });
            });
        });
        cacheWrites = write.catch(function () {});
        return priority ? write : cacheWrites;
    }
    function item(
        id: string,
        file: any,
        name: string,
        sourceId: string,
        live: any,
        relativePath: string | null
    ): any {
        live[id] = true;
        var signature = file.size + ":" + file.lastModified;
        if (urls[id] && (urls[id] as any).signature !== signature) {
            urlApi.revokeObjectURL((urls[id] as any).url);
            delete urls[id];
        }
        var unsupported = /\.avi$/i.test(name);
        if (/\.mkv$/i.test(name)) {
            try {
                unsupported = !w.document
                    ?.createElement("video")
                    .canPlayType(file.type || "video/x-matroska");
            } catch (_) {
                unsupported = true;
            }
        }
        if (unsupported && urls[id]) {
            urlApi.revokeObjectURL((urls[id] as any).url);
            delete urls[id];
        }
        if (!unsupported && !urls[id])
            (urls as any)[id] = {
                signature: signature,
                url: urlApi.createObjectURL(file),
            };
        return {
            access: "granted",
            available: !unsupported,
            ...(unsupported
                ? {
                      playback: {
                          mode: "unsupported",
                          reason: "compatibility_unavailable",
                      },
                  }
                : {}),
            directory:
                name.indexOf("/") >= 0
                    ? name.split("/").slice(-2)[0]
                    : knownSources.filter(function (source) {
                          return (
                              source.id === sourceId &&
                              source.handle?.kind === "directory"
                          );
                      })[0]?.name || "",
            id: id,
            mime: file.type || "application/octet-stream",
            name: name,
            relativePath: relativePath,
            size: file.size,
            source: sourceId.indexOf("source-") === 0 ? "linked" : "imported",
            sourceId: sourceId,
            url: unsupported ? "" : (urls[id] as any).url,
        };
    }
    // Snapshots are cumulative. A false callback or newer scan cancels traversal;
    // cancelling never prunes URLs that the current player may still be using.
    function list(
        onProgress?: (catalog: any) => boolean | void,
        preferredId?: string,
        prioritySources?: string[]
    ): Promise<any> {
        if (w.__ottStandby?.blocked())
            return Promise.reject(w.__ottStandby.error());
        var pending = scan(onProgress, preferredId, prioritySources);
        if (w.__ottStandby) w.__ottStandby.observe(pending);
        return pending;
    }
    function scan(
        onProgress?: (catalog: any) => boolean | void,
        preferredId?: string,
        prioritySources?: string[]
    ): Promise<any> {
        if (typeof onProgress !== "function") onProgress = undefined;
        var generation = retireScans();
        var items: any[] = [],
            sources: any[] = [],
            live: any = {},
            unprovenItems: any = Object.create(null);
        var scanned = 0,
            discovered = 0,
            published = 0,
            lastPublish = Date.now();
        var stopped = false,
            firstPlayable = false;
        var phase = "sources";
        var preferredResult = preferredId
            ? { id: preferredId, state: "pending" }
            : undefined;
        var readErrorName = "";
        var readErrorPhase = "";
        var reconnectRequired = false;
        function readFailure(error: any): void {
            if (error && error.localMediaReconnectRequired)
                reconnectRequired = true;
            readErrorName =
                /^(NotFoundError|NotAllowedError|SecurityError|NotReadableError|AbortError|InvalidStateError|QuotaExceededError|TimeoutError|TypeError|UnknownError)$/.test(
                    error && error.name
                )
                    ? error.name
                    : "Error";
            readErrorPhase = phase;
        }
        function active(): boolean {
            return !stopped && generation === scanGeneration;
        }
        function catalog(scanning: boolean): any {
            return {
                available: available,
                cancelled: !active(),
                directSources: !!w.showDirectoryPicker,
                discovered: discovered,
                items: items.slice(),
                offlineReady: !!(
                    w.navigator.serviceWorker &&
                    w.navigator.serviceWorker.controller &&
                    /\/offline-worker\.js(?:[?#]|$)/.test(
                        w.navigator.serviceWorker.controller.scriptURL
                    )
                ),
                persistent: false,
                ...(preferredResult
                    ? { preferred: Object.assign({}, preferredResult) }
                    : {}),
                phase: scanning ? phase : "complete",
                readErrorName: readErrorName,
                readErrorPhase: readErrorPhase,
                reconnectRequired: reconnectRequired,
                scanned: scanned,
                scanning: scanning,
                sources: sources.map(function (source) {
                    return Object.assign({}, source);
                }),
                storage: "browser",
            };
        }
        function progress(force = false): void {
            if (!active() || !onProgress) return;
            if (
                !force &&
                scanned - published < 64 &&
                Date.now() - lastPublish < 100
            )
                return;
            published = scanned;
            lastPublish = Date.now();
            if (onProgress(catalog(true)) === false) stopped = true;
        }
        function add(
            id: string,
            file: any,
            name: string,
            sourceId: string,
            relativePath: string | null
        ): void {
            if (!active()) return;
            if (live[id]) {
                var pending = unprovenItems[id];
                if (relativePath !== null && pending !== undefined) {
                    // Replace the row; older published snapshots must retain
                    // their unproven state until the real walk reaches it.
                    items[pending] = item(
                        id,
                        file,
                        name,
                        sourceId,
                        live,
                        relativePath
                    );
                    delete unprovenItems[id];
                    progress(true);
                }
                return;
            }
            var added = item(id, file, name, sourceId, live, relativePath);
            if (relativePath === null && id !== sourceId)
                unprovenItems[id] = items.length;
            items.push(added);
            if (!firstPlayable && added.available !== false && added.url) {
                firstPlayable = true;
                progress(true);
            }
        }
        function visit(force = false): Promise<void> {
            scanned++;
            progress(force);
            return scanned % 64 === 0
                ? new Promise(function (resolve) {
                      w.setTimeout(resolve, 0);
                  })
                : Promise.resolve();
        }
        function readPhase(
            name: string,
            read: () => any,
            force = false
        ): Promise<any> {
            phase = name;
            progress(force);
            if (!active()) return Promise.resolve(null);
            // Fast reads keep batch publication cheap. A pending browser call
            // exposes its real phase once, without inventing scan progress.
            var timer = w.setTimeout(function () {
                progress(true);
            }, 100);
            return Promise.resolve()
                .then(function () {
                    return active() ? read() : null;
                })
                .then(
                    function (value) {
                        w.clearTimeout(timer);
                        return value;
                    },
                    function (error) {
                        w.clearTimeout(timer);
                        throw error;
                    }
                );
        }
        // Manual async iteration keeps legacy ES5 bundles compatible. Push into
        // one result array instead of copying a growing array for every file.
        function walk(
            handle: any,
            prefix: string,
            sourceId: string
        ): Promise<void> {
            if (!active()) return Promise.resolve();
            phase = "enumerating";
            var opening: any = null;
            function next(): Promise<void> {
                if (!active()) return Promise.resolve();
                return readPhase(
                    "enumerating",
                    function () {
                        if (!opening) {
                            opening = firstDirectoryRead(
                                sourceId + ":" + prefix,
                                handle
                            );
                            return opening.pending;
                        }
                        return opening.iterator.next();
                    },
                    discovered === 0
                ).then(function (step) {
                    if (!step || step.done || !active()) return;
                    var child = step.value,
                        name = prefix + child.name;
                    discovered++;
                    var visited = visit(discovered === 1);
                    var work: Promise<any>;
                    if (child.kind === "directory")
                        work = visited.then(function () {
                            return walk(child, name + "/", sourceId);
                        });
                    // A known non-media extension cannot become playable by
                    // reading its bytes. Unknown extensions still use MIME.
                    else if (
                        /\.(txt|json|xml|csv|log|md|srt|vtt|jpg|jpeg|png|gif|webp|pdf|zip|rar)$/i.test(
                            child.name
                        )
                    )
                        work = visited;
                    else
                        work = visited
                            .then(function () {
                                return readPhase("metadata", function () {
                                    return active()
                                        ? readHandle(
                                              sourceId + ":" + name,
                                              child
                                          )
                                        : null;
                                });
                            })
                            .then(function (file) {
                                if (active() && file && media(file)) {
                                    remember(sourceId, name, child);
                                    add(
                                        sourceId + ":" + name,
                                        file,
                                        name,
                                        sourceId,
                                        name
                                    );
                                }
                            });
                    return work
                        .catch(function (error) {
                            if (active()) readFailure(error);
                            // Files can disappear or have narrower permissions than
                            // their parent. Keep scanning readable siblings.
                            if (
                                !error ||
                                error.localMediaLimit ||
                                !/^(NotFoundError|NotAllowedError|SecurityError|NotReadableError|TimeoutError)$/.test(
                                    error.name
                                )
                            )
                                throw error;
                        })
                        .then(next);
                });
            }
            return next();
        }
        function preferred(record: any): Promise<void> {
            var prefix = record.id + ":";
            if (
                !preferredId ||
                preferredId.indexOf(prefix) !== 0 ||
                record.handle.kind !== "directory"
            )
                return Promise.resolve();
            var path = preferredId.slice(prefix.length),
                parts = path.split("/");
            if (/(^|\/)\.{0,2}(\/|$)/.test(path)) return Promise.resolve();
            var handle = Promise.resolve(record.handle);
            parts.slice(0, -1).forEach(function (part) {
                handle = handle.then(function (directory) {
                    return active()
                        ? readPhase("metadata", function () {
                              return directory.getDirectoryHandle(part);
                          })
                        : Promise.reject();
                });
            });
            return handle
                .then(function (directory) {
                    return active()
                        ? readPhase("metadata", function () {
                              return directory.getFileHandle(
                                  parts[parts.length - 1]
                              );
                          })
                        : Promise.reject();
                })
                .then(function (fileHandle) {
                    return active() && fileHandle
                        ? readPhase("metadata", function () {
                              return readHandle(preferredId!, fileHandle);
                          })
                        : Promise.reject();
                })
                .then(function (file) {
                    if (!active()) return;
                    if (preferredResult)
                        preferredResult.state =
                            file && media(file) ? "found" : "missing";
                    if (file && media(file))
                        add(preferredId!, file, path, record.id, path);
                    else progress(true);
                })
                .catch(function (error) {
                    // Only a definitive missing path permits another file to
                    // replace the saved selection before enumeration finishes.
                    if (
                        active() &&
                        error &&
                        error.name === "NotFoundError" &&
                        preferredResult
                    ) {
                        preferredResult.state = "missing";
                        progress(true);
                    }
                });
        }
        function bootstrap(record: any): Promise<void> {
            if (
                firstPlayable ||
                (preferredResult && preferredResult.state !== "missing")
            )
                return Promise.resolve();
            var candidates = (record.bootstrap || []).slice(0, 8);
            var chain = Promise.resolve();
            candidates.forEach(function (candidate: any) {
                chain = chain.then(function () {
                    if (!active() || firstPlayable || !candidate.handle) return;
                    // A cached handle can survive a move. Re-resolve it against
                    // its selected root before treating the old path as proof.
                    return readPhase("metadata", function () {
                        return typeof record.handle.resolve === "function"
                            ? readHandle(
                                  "resolve:" + record.id + ":" + candidate.path,
                                  {
                                      getFile: function () {
                                          return record.handle.resolve(
                                              candidate.handle
                                          );
                                      },
                                  }
                              )
                            : null;
                    })
                        .then(function (parts: any) {
                            if (!active()) return;
                            if (
                                typeof record.handle.resolve === "function" &&
                                (!Array.isArray(parts) ||
                                    parts.join("/") !== candidate.path)
                            )
                                return;
                            return readPhase("metadata", function () {
                                return readHandle(
                                    record.id + ":" + candidate.path,
                                    candidate.handle
                                );
                            }).then(function (file) {
                                if (active() && file && media(file))
                                    add(
                                        record.id + ":" + candidate.path,
                                        file,
                                        candidate.path,
                                        record.id,
                                        Array.isArray(parts)
                                            ? candidate.path
                                            : null
                                    );
                            });
                        })
                        .catch(function (error) {
                            if (error && error.name === "NotFoundError")
                                record.bootstrap = (
                                    record.bootstrap || []
                                ).filter(function (entry: any) {
                                    return entry.path !== candidate.path;
                                });
                            if (error?.localMediaLimit) throw error;
                        });
                });
            });
            return chain;
        }
        if (!available) return Promise.resolve(catalog(false));
        progress(true);
        if (!active()) {
            return Promise.resolve(catalog(false));
        }
        knownSources = [];
        return records(function (record, count) {
            scanned++;
            if (record.handle) knownSources.push(record);
            progress(count % 64 === 0);
            return active();
        })
            .then(function (saved) {
                if (!active()) return;
                knownSources = saved.filter(function (record) {
                    return !!record.handle;
                });
                if (
                    preferredResult &&
                    !saved.some(function (record) {
                        return (
                            preferredId === record.id ||
                            preferredId!.indexOf(record.id + ":") === 0
                        );
                    })
                )
                    preferredResult.state = "missing";
                // Resolve the saved item before enumeration, even in a later source.
                if (preferredId)
                    saved.sort(function (a, b) {
                        return (
                            Number(
                                preferredId === b.id ||
                                    preferredId!.indexOf(b.id + ":") === 0
                            ) -
                            Number(
                                preferredId === a.id ||
                                    preferredId!.indexOf(a.id + ":") === 0
                            )
                        );
                    });
                if (prioritySources?.length)
                    saved.sort(function (a, b) {
                        var left = prioritySources!.indexOf(a.id),
                            right = prioritySources!.indexOf(b.id);
                        return (
                            (left < 0 ? prioritySources!.length : left) -
                            (right < 0 ? prioritySources!.length : right)
                        );
                    });
                var chain = Promise.resolve();
                saved.forEach(function (record) {
                    chain = chain.then(function () {
                        if (!active()) return;
                        if (record.blob) {
                            add(
                                record.id,
                                record.blob,
                                record.name,
                                record.id,
                                null
                            );
                            return visit();
                        }
                        var source = {
                            access: "unknown",
                            available: false,
                            id: record.id,
                            kind:
                                record.handle.kind === "directory"
                                    ? "folder"
                                    : "file",
                            name: record.name,
                        };
                        sources.push(source);
                        phase = "permission";
                        record.access = "unknown";
                        progress(true);
                        if (!active()) return;
                        return readHandle(record.id, record.handle, true)
                            .then(function (access) {
                                if (!active()) return;
                                if (access !== "granted") {
                                    source.access = "permission-required";
                                    return;
                                }
                                source.access = "granted";
                                source.available = true;
                                record.access = "granted";
                                phase = "files";
                                progress(true);
                                if (!active()) return;
                                if (record.handle.kind === "directory")
                                    return preferred(record)
                                        .then(function () {
                                            return bootstrap(record);
                                        })
                                        .then(function () {
                                            return walk(
                                                record.handle,
                                                "",
                                                record.id
                                            );
                                        });
                                discovered++;
                                return readPhase(
                                    "metadata",
                                    function () {
                                        return readHandle(
                                            record.id,
                                            record.handle
                                        );
                                    },
                                    true
                                ).then(function (file) {
                                    if (
                                        active() &&
                                        preferredResult &&
                                        preferredId === record.id
                                    )
                                        preferredResult.state =
                                            file && media(file)
                                                ? "found"
                                                : "missing";
                                    if (active() && file && media(file))
                                        add(
                                            record.id,
                                            file,
                                            file.name,
                                            record.id,
                                            null
                                        );
                                });
                            })
                            .catch(function (error) {
                                if (!active()) return;
                                readFailure(error);
                                if (
                                    preferredResult &&
                                    preferredId === record.id &&
                                    error &&
                                    error.name === "NotFoundError"
                                )
                                    preferredResult.state = "missing";
                                (source as any).readErrorName = readErrorName;
                                (source as any).readErrorPhase = readErrorPhase;
                                (source as any).reconnectRequired =
                                    !!error?.localMediaReconnectRequired;
                                source.access =
                                    error && error.name === "NotAllowedError"
                                        ? "permission-required"
                                        : "missing";
                            })
                            .then(function () {
                                source.available = source.access === "granted";
                                record.access = source.access;
                                if (!source.available && active())
                                    items.push({
                                        access: source.access,
                                        available: false,
                                        id: record.id,
                                        name: record.name,
                                        relativePath: null,
                                        size: 0,
                                        source: "linked",
                                        sourceId: record.id,
                                        url: "",
                                    });
                                return visit();
                            });
                    });
                });
                return chain;
            })
            .then(function () {
                if (active())
                    Object.keys(urls).forEach(function (id) {
                        if (!live[id]) {
                            urlApi.revokeObjectURL((urls[id] as any).url);
                            delete urls[id];
                        }
                    });
                return catalog(false);
            });
    }
    function save(handles: any[], deferScan = false): Promise<any> {
        var sourceIds: string[] = [];
        return open()
            .then(function (db) {
                return new Promise(function (resolve, reject) {
                    var tx = db.transaction("files", "readwrite");
                    handles.forEach(function (handle, index) {
                        var id =
                            "source-" +
                            Date.now().toString(36) +
                            "-" +
                            index +
                            "-" +
                            Math.random().toString(36).slice(2);
                        sourceIds.push(id);
                        tx.objectStore("files").add({
                            created: Date.now(),
                            handle: handle,
                            id: id,
                            name: handle.name,
                        });
                    });
                    tx.oncomplete = function () {
                        resolve(null);
                    };
                    tx.onerror = tx.onabort = function () {
                        reject(
                            new Error("Could not save local source permissions")
                        );
                    };
                });
            })
            .then(function () {
                // The picker UI owns a bounded, progressive scan after saving.
                // Do not enumerate the entire directory before it can begin.
                return deferScan
                    ? { sourceIds: sourceIds, sourceSaved: true }
                    : list();
            });
    }
    function cancelled(error: any, deferScan = false): Promise<any> {
        if (error && error.name === "AbortError")
            return deferScan
                ? Promise.resolve({ pickerCancelled: true })
                : list();
        return Promise.reject(error);
    }
    function importFiles(
        files?: any,
        options?: { deferScan?: boolean }
    ): Promise<any> {
        if (files)
            return Promise.reject(
                new Error(
                    "Direct sources require the file picker; media copying is disabled"
                )
            );
        if (!w.showOpenFilePicker)
            return Promise.reject(
                new Error(
                    "Direct file access is unavailable in this browser. Use Chrome or Edge on desktop, or the Android app."
                )
            );
        return w
            .showOpenFilePicker({
                multiple: true,
                types: [
                    {
                        accept: {
                            "audio/*": [".mp3", ".m4a", ".ogg", ".wav"],
                            "video/*": [
                                ".mp4",
                                ".m4v",
                                ".webm",
                                ".mov",
                                ".avi",
                                ".mkv",
                            ],
                        },
                        description: "Video and audio",
                    },
                ],
            })
            .then(function (handles: any[]) {
                // File reads belong to the progressive scan as well: even one
                // selected file can wait on a disconnected drive or cloud mount.
                if (options?.deferScan) return handles;
                return Promise.all(
                    handles.map(function (handle) {
                        return handle.getFile().then(function (file) {
                            if (!media(file))
                                throw new Error(
                                    "Choose supported video or audio files"
                                );
                            return handle;
                        });
                    })
                );
            })
            .then(function (handles) {
                return save(handles, !!options?.deferScan);
            })
            .catch(function (error) {
                return cancelled(error, !!options?.deferScan);
            });
    }
    function importFolder(options?: { deferScan?: boolean }): Promise<any> {
        if (!w.showDirectoryPicker)
            return Promise.reject(
                new Error(
                    "Direct folder access is unavailable in this browser. Use Chrome or Edge on desktop, or the Android app."
                )
            );
        return w
            .showDirectoryPicker({ mode: "read" })
            .then(function (handle) {
                return save([handle], !!options?.deferScan);
            })
            .catch(function (error) {
                return cancelled(error, !!options?.deferScan);
            });
    }
    function reconnectSource(id: string): Promise<any> {
        var source = knownSources.filter(function (record) {
            return record.id === id;
        })[0];
        if (!source || source.handle.kind !== "directory")
            return Promise.reject(new Error(sourceUnavailableMessage));
        if (!w.showDirectoryPicker)
            return Promise.reject(
                new Error("Direct folder access is unavailable")
            );
        var generation = scanGeneration;
        var picked: Promise<any>;
        try {
            // Open synchronously in the user gesture. Reading IndexedDB first
            // can lose the activation required by the browser's native picker.
            // A remembered picker directory may itself be a stale NAS mount.
            // A fresh picker ID avoids that saved location taking precedence
            // over the safe start directory on a later reconnect attempt.
            picked = w.showDirectoryPicker({
                id:
                    "ott-reconnect-" +
                    Date.now().toString(36) +
                    "-" +
                    Math.random().toString(36).slice(2, 8),
                mode: "read",
                startIn: "documents",
            });
        } catch (error) {
            return cancelled(error, true);
        }
        return Promise.resolve(picked).then(
            function (handle) {
                if (generation !== scanGeneration)
                    return { pickerCancelled: true };
                if (!handle || handle.kind !== "directory")
                    throw new Error("Choose a local folder");
                return open().then(function (db) {
                    if (generation !== scanGeneration)
                        return { pickerCancelled: true };
                    return new Promise(function (resolve, reject) {
                        var tx = db.transaction("files", "readwrite");
                        reconnectTransactions.push(tx);
                        function forget(): void {
                            reconnectTransactions =
                                reconnectTransactions.filter(
                                    function (pending) {
                                        return pending !== tx;
                                    }
                                );
                        }
                        var store = tx.objectStore("files");
                        var request = store.get(id);
                        var replacement: any = null;
                        request.onsuccess = function () {
                            if (generation !== scanGeneration) {
                                tx.abort();
                                return;
                            }
                            var record = request.result;
                            if (
                                !record ||
                                !record.handle ||
                                record.handle.kind !== "directory"
                            ) {
                                tx.abort();
                                return;
                            }
                            replacement = Object.assign({}, record, {
                                cacheEpoch:
                                    Date.now().toString(36) +
                                    Math.random().toString(36),
                                handle: handle,
                                name: handle.name,
                            });
                            delete replacement.access;
                            delete replacement.bootstrap;
                            store.put(replacement);
                        };
                        tx.oncomplete = function () {
                            forget();
                            if (generation !== scanGeneration) {
                                resolve({ pickerCancelled: true });
                                return;
                            }
                            retireScans();
                            knownSources = knownSources.map(function (record) {
                                return record.id === id ? replacement : record;
                            });
                            // Reload starts a fresh browsing context for native reads
                            // still pending on the previous, disconnected mount. Do
                            // not pretend that those browser calls were cancelled.
                            resolve({
                                requiresReload: true,
                                sourceIds: [id],
                                sourceReconnected: true,
                            });
                        };
                        tx.onerror = tx.onabort = function () {
                            forget();
                            if (generation !== scanGeneration) {
                                resolve({ pickerCancelled: true });
                                return;
                            }
                            reject(
                                new Error("Could not reconnect local folder")
                            );
                        };
                    });
                });
            },
            function (error) {
                if (generation !== scanGeneration)
                    return { pickerCancelled: true };
                return cancelled(error, true);
            }
        );
    }
    function requestAccess(
        onProgress?: (catalog: any) => boolean | void,
        preferredId?: string
    ): Promise<any> {
        function resume(): Promise<any> {
            return list(onProgress, preferredId);
        }
        // A restored Chrome grant can cover all previously connected handles.
        // Request just one in this click: parallel prompts can consume activation
        // and dismiss each other. list() then observes the grant on every source.
        var pending = knownSources.filter(function (record) {
            return record.access !== "granted";
        });
        if (!pending.length) return resume();
        try {
            return Promise.resolve(
                pending[0].handle.requestPermission({ mode: "read" })
            ).then(resume, resume);
        } catch (_) {
            return resume();
        }
    }
    function bootstrapFile(sourceId: string, path: string): Promise<any> {
        if (w.__ottStandby?.blocked())
            return Promise.reject(w.__ottStandby.error());
        var parts = typeof path === "string" ? path.split("/") : [];
        if (
            !parts.length ||
            /[\\\0]/.test(path) ||
            /^[a-z]:/i.test(path) ||
            /(^|\/)\.{0,2}(\/|$)/.test(path)
        )
            return Promise.reject(
                new Error("Enter a file path relative to this folder")
            );
        var source = knownSources.filter(function (record) {
            return (
                record.id === sourceId && record.handle?.kind === "directory"
            );
        })[0];
        if (!source) return Promise.reject(new Error(sourceUnavailableMessage));
        var generation = retireScans();
        function current(): void {
            if (generation !== scanGeneration) {
                var error = new Error("Local file selection was cancelled");
                error.name = "AbortError";
                throw error;
            }
        }
        // File-handle lookup can itself wait on a NAS. Share the same bounded
        // native-operation budget as getFile, without enumerating the folder.
        return readHandle("lookup:" + sourceId + ":" + path, {
            getFile: function () {
                var lookup = Promise.resolve(source.handle);
                parts.slice(0, -1).forEach(function (part) {
                    lookup = lookup.then(function (directory) {
                        current();
                        return directory.getDirectoryHandle(part);
                    });
                });
                return lookup.then(function (directory) {
                    current();
                    return directory.getFileHandle(parts[parts.length - 1]);
                });
            },
        })
            .then(function (handle) {
                current();
                return readHandle(sourceId + ":" + path, handle).then(
                    function (file) {
                        current();
                        if (!media(file))
                            throw new Error(
                                "Choose supported video or audio files"
                            );
                        return remember(
                            sourceId,
                            path,
                            handle,
                            true,
                            generation
                        ).then(function () {
                            current();
                            var id = sourceId + ":" + path;
                            return {
                                available: available,
                                directSources: !!w.showDirectoryPicker,
                                discovered: 1,
                                items: [
                                    item(id, file, path, sourceId, {}, path),
                                ],
                                partial: true,
                                persistent: false,
                                phase: "metadata",
                                preferred: { id: id, state: "found" },
                                scanned: 1,
                                scanning: true,
                                sourceIds: [sourceId],
                                sources: knownSources.map(function (record) {
                                    return {
                                        access:
                                            record.id === sourceId
                                                ? "granted"
                                                : record.access || "unknown",
                                        available:
                                            record.id === sourceId ||
                                            record.access === "granted",
                                        id: record.id,
                                        kind:
                                            record.handle.kind === "directory"
                                                ? "folder"
                                                : "file",
                                        name: record.name,
                                    };
                                }),
                                storage: "browser",
                            };
                        });
                    }
                );
            })
            .catch(function (error) {
                current();
                var name = error && error.name;
                var safe: any = new Error(
                    name === "AbortError"
                        ? "Local file selection was cancelled"
                        : name === "NotFoundError"
                          ? "Local file was not found"
                          : name === "NotAllowedError"
                            ? "Folder permission is required"
                            : name === "TimeoutError"
                              ? fileTimeoutMessage
                              : "Local file could not be opened"
                );
                safe.name =
                    /^(AbortError|NotFoundError|NotAllowedError|TimeoutError|NotReadableError)$/.test(
                        name
                    )
                        ? name
                        : "Error";
                throw safe;
            });
    }
    function remove(id: string): Promise<any> {
        return open()
            .then(function (db) {
                return new Promise(function (resolve, reject) {
                    var tx = db.transaction("files", "readwrite");
                    tx.objectStore("files").delete(id);
                    tx.oncomplete = function () {
                        resolve(null);
                    };
                    tx.onerror = tx.onabort = function () {
                        reject(new Error("Could not remove local media file"));
                    };
                });
            })
            .then(list);
    }
    var api = {
        bootstrapFile: bootstrapFile,
        importFiles: importFiles,
        importFolder: importFolder,
        list: list,
        reconnectSource: reconnectSource,
        remove: remove,
        removeSource: remove,
        requestAccess: requestAccess,
        suspend: function () {
            retireScans();
        },
    };
    w.__ottBrowserLocalMedia = api;
    w.addEventListener("unload", function () {
        Object.keys(urls).forEach(function (id) {
            urlApi.revokeObjectURL((urls[id] as any).url);
        });
    });
    return api;
}

/** Native shells already bundle their UI. Only HTTPS/localhost web builds install a worker. */
export function installOfflineShell(w: any): Promise<any> {
    if (
        w.__ottStandby?.blocked() ||
        !w.navigator.serviceWorker ||
        !w.isSecureContext ||
        w.Capacitor ||
        w.__TAURI_INTERNALS__
    )
        return Promise.resolve(null);
    if (
        w.location.protocol !== "https:" &&
        !/^localhost$|^127\.0\.0\.1$|^\[::1\]$/.test(w.location.hostname)
    )
        return Promise.resolve(null);
    // Player routes such as /f/pc/ still load the shared assets from the origin root.
    var worker = new w.URL("/offline-worker.js", w.location.href);
    return w.navigator.serviceWorker
        .register(worker.href, { scope: new w.URL("/", worker).href })
        .catch(function () {
            return null;
        });
}
