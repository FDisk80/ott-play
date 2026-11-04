import { loadRemoteFeature } from "../commands/remote-feature";
import {
    installBrowserLocalMedia,
    installOfflineShell,
} from "../offline/browser-local-media";
import {
    formatLocalMediaProgress,
    localMediaProgressTimeout,
} from "../offline/local-media-progress";
import {
    createLocalPlaybackSelection,
    localSourceScan,
} from "../offline/playback-selection";
import { installOfflineProfiles } from "../offline/profiles";
import { resolveNativePlugin, tauriInvoke } from "./native-bridge";
/** Stable item IDs belong to storage; playback URLs are resolved anew each launch. */
export function installLocalMedia(w: any): any {
    if (w.__ottLocalMedia) return w.__ottLocalMedia;
    var browser = installBrowserLocalMedia(w);
    installOfflineShell(w);
    var native = resolveNativePlugin<any>("LocalMedia", function () {
        return browser;
    });
    var opened = false;
    var revision = 0;
    var handler: any = null;
    var owner: any = null;
    var loading: any = null;
    var progressState: any = null;
    var catalogRevision = 0;
    var activeNativeCancel: (() => void) | null = null;
    function cancelNativeList(): void {
        if (activeNativeCancel) activeNativeCancel();
    }
    var resuming = false;
    var last: any = null;
    var endpoint = "";
    var importedSelection = "";
    var nextImportSelection = "";
    var remoteHandoff: any = null;
    var remoteOrderCurrent: (() => boolean) | null = null;
    var remoteGeneration = 0;
    var nativeSourcePaths = false;
    var remoteLinkSequence = 0;
    var playbackSelection = createLocalPlaybackSelection(w, function () {
        var profiles = w.__ottOfflineProfiles;
        return (
            libraryIdentity() +
            ":" +
            (profiles?.namespace?.() || "offline") +
            ":" +
            (profiles?.current?.()?.binding_id || "")
        );
    });
    var pendingFileKey = "localMediaPendingFile";
    function playbackIntentContext(): string {
        var profiles = w.__ottOfflineProfiles;
        return JSON.stringify([
            libraryIdentity(),
            profiles?.namespace?.() || "offline",
            profiles?.current?.() || null,
            w.stbGetItem("offlineProfileBindings") || "",
        ]);
    }
    function retireRemotePlayback(): void {
        remoteGeneration++;
        remoteHandoff = null;
        remoteOrderCurrent = null;
        playbackSelection.ordered();
        nextImportSelection = "";
    }
    function libraryIdentity(): string {
        if (serverLibrary()) return "browser:" + remoteEndpoint();
        return isNative()
            ? "capacitor"
            : isTauri()
              ? "tauri"
              : "browser:" + remoteEndpoint();
    }
    function isNative(): boolean {
        return !!(
            w.Capacitor &&
            w.Capacitor.isNativePlatform &&
            w.Capacitor.isNativePlatform()
        );
    }
    function isTauri(): boolean {
        return !!(w.__TAURI__ || w.__TAURI_INTERNALS__);
    }
    function remoteEndpoint(): string {
        try {
            return String(
                w.stbGetItem ? w.stbGetItem("localMediaEndpoint") || "" : ""
            );
        } catch (_) {
            return "";
        }
    }
    function serverLibrary(): boolean {
        return !isTauri() && !!remoteEndpoint();
    }
    function nativeLibrary(): boolean {
        return isNative() && !serverLibrary();
    }
    function normalizePlayback(value: any): any {
        (value?.items || []).forEach(function (item: any) {
            if (item.playback?.mode === "unsupported") {
                item.available = false;
                item.url = "";
            }
        });
        return value;
    }
    function getEndpoint(
        refresh = false,
        preferredId?: string,
        sourceId?: string
    ): Promise<string> {
        if (isTauri())
            return tauriInvoke<any>("offline_media_endpoint", {
                ...(refresh ? { refresh: true } : {}),
                ...(preferredId ? { preferredId } : {}),
                ...(sourceId ? { sourceId } : {}),
            }).then(function (value) {
                endpoint = value.endpoint;
                return endpoint;
            });
        endpoint = remoteEndpoint().replace(/\/+$/, "");
        return Promise.resolve(endpoint);
    }
    function http(url: string, options?: any): Promise<any> {
        return w.fetch(url, options).then(function (response: any) {
            if (!response.ok)
                throw new Error(
                    "Local media request failed (" + response.status + ")"
                );
            return response.json().then(function (value: any) {
                normalizePlayback(value);
                if (value && Array.isArray(value.items))
                    value.items.forEach(function (item: any) {
                        if (item.url) item.url = new URL(item.url, url).href;
                    });
                if (value && value.uploadUrl)
                    value.uploadUrl = new URL(value.uploadUrl, url).href;
                return value;
            });
        });
    }
    var localText1 = "local-compatibility" as const,
        localText4 = "a",
        localText5 = "Local playback request cancelled";
    var compatibility: any = null,
        compatibilityEpoch = 0,
        loadingCompatibility: any[] = [];

    function loadLocalFeature(kind: "local-compatibility"): Promise<any> {
        return new Promise(function (resolve, reject) {
            function finish(error?: string): void {
                try {
                    if (
                        error ||
                        typeof w.__ottLocalCompatibilityFactory !== "function"
                    )
                        throw new Error(
                            "Local media feature could not be loaded"
                        );
                    if (!compatibility)
                        compatibility = w.__ottLocalCompatibilityFactory(w, {
                            get a() {
                                return catalogRevision;
                            },
                            get b() {
                                return last;
                            },
                            c: function () {
                                return (
                                    playbackIntentContext() +
                                    ":" +
                                    compatibilityEpoch
                                );
                            },
                        });
                    resolve(compatibility);
                } catch (error) {
                    reject(error);
                }
            }
            if (w.__ottLocalCompatibilityFactory) finish();
            else loadRemoteFeature(w, kind, finish);
        });
    }

    function localCall(
        owner: any,
        key: string,
        args: any[],
        flags: number
    ): any {
        if (flags & 1 && owner == null) return;
        var fn = owner[key];
        if (flags & 2 && fn == null) return;
        return fn.apply(owner, args);
    }
    function localField(owner: any, key: string): any {
        return owner == null ? undefined : owner[key];
    }
    function playbackItem(url: string): any {
        return compatibility
            ? compatibility.d(url)
            : last?.items.filter(function (item: any) {
                  return item.url === url;
              })[0];
    }
    function compatibilityPlayback(url: string): boolean {
        return (
            localField(localField(playbackItem(url), "playback"), "mode") ===
            "compatibility"
        );
    }
    function cancelPlayback(url?: string): void {
        loadingCompatibility.slice().forEach(function (pending: any) {
            if (!url || pending.url === url) pending.cancel();
        });
        if (!url) compatibilityEpoch++;
        localCall(compatibility, localText4, [url], 1);
    }
    function warmDiagnostics(url: string, current?: () => boolean): void {
        // Playback owns this warmup. Passive status requests must never load it.
        if (
            !w.__ottLocalSourceDiagnostics &&
            playbackItem(url) &&
            !localCall(w.__ottStandby, "blocked", [], 1) &&
            (!current || current())
        )
            loadLocalFeature(localText1).catch(function () {});
    }
    function preparePlayback(url: string, current?: () => boolean): any {
        if (!compatibility && w.__ottLocalCompatibilityFactory)
            loadLocalFeature(localText1).catch(function () {});
        if (compatibility) return compatibility.f(url, current);
        if (
            localField(localField(playbackItem(url), "playback"), "mode") ===
            "unsupported"
        )
            return Promise.reject(
                new Error(
                    "AVI/MKV compatibility is unavailable on this library"
                )
            );
        if (!compatibilityPlayback(url)) {
            warmDiagnostics(url, current);
            return Promise.resolve(url);
        }
        if (
            localCall(w.__ottStandby, "blocked", [], 1) ||
            (current && !current()) ||
            loadingCompatibility.length >= 2
        )
            return Promise.reject(new Error(localText5));
        var cancelled = false,
            inner: any = null,
            rejectPending: any,
            epoch = compatibilityEpoch,
            scan = catalogRevision,
            identity = playbackIntentContext();
        function admitted(): boolean {
            return (
                !cancelled &&
                epoch === compatibilityEpoch &&
                scan === catalogRevision &&
                identity === playbackIntentContext() &&
                !localCall(w.__ottStandby, "blocked", [], 1) &&
                (!current || current())
            );
        }
        function retire(): void {
            loadingCompatibility = loadingCompatibility.filter(function (
                entry: any
            ) {
                return entry !== pending;
            });
        }
        var pending: any = {
            cancel: function () {
                if (cancelled) return;
                cancelled = true;
                retire();
                if (localField(inner, "cancel")) inner.cancel();
                rejectPending(new Error(localText5));
            },
            url: url,
        };
        var result: any = new Promise(function (resolve, reject) {
            rejectPending = reject;
            loadingCompatibility.push(pending);
            loadLocalFeature(localText1)
                .then(function (owner: any) {
                    if (!admitted()) throw new Error(localText5);
                    inner = owner.f(url, admitted);
                    return inner;
                })
                .then(
                    function (value: any) {
                        retire();
                        if (admitted()) resolve(value);
                        else {
                            localCall(compatibility, localText4, [value], 1);
                            reject(new Error(localText5));
                        }
                    },
                    function (error: any) {
                        retire();
                        reject(error);
                    }
                );
        });
        result.cancel = pending.cancel;
        return result;
    }
    function boundedCatalogRequest(url: string, timeout: number): Promise<any> {
        return new Promise(function (resolve, reject) {
            var controller = w.AbortController ? new w.AbortController() : null;
            var settled = false;
            var timer = setTimeout(function () {
                if (settled) return;
                settled = true;
                if (controller) controller.abort();
                reject(new Error("Local media scan stopped responding"));
            }, timeout);
            function finish(error: any, value?: any): void {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                if (error) reject(error);
                else resolve(value);
            }
            // Include response.json() in the deadline: headers alone do not
            // establish progress when a local server stops sending its body.
            try {
                http(
                    url,
                    controller ? { signal: controller.signal } : undefined
                ).then(
                    function (value) {
                        finish(null, value);
                    },
                    function (error) {
                        finish(error);
                    }
                );
            } catch (error) {
                finish(error);
            }
        });
    }
    function remember(pending: Promise<any>): Promise<any> {
        var request = ++catalogRevision;
        return pending.then(function (value: any) {
            if (!value || !Array.isArray(value.items))
                throw new Error("Invalid local media catalog");
            if (request === catalogRevision) last = normalizePlayback(value);
            return value;
        });
    }
    function nativeList(
        progress: (value: any) => boolean,
        preferredId: string | undefined,
        request: number
    ): Promise<any> {
        cancelNativeList();
        var requestId = "local-" + request + "-" + Date.now();
        return new Promise(function (resolve, reject) {
            var listener: any = null;
            var settled = false;
            var started = false;
            function cleanup(): void {
                if (activeNativeCancel === cancel) activeNativeCancel = null;
                if (listener) {
                    var handle = listener;
                    listener = null;
                    try {
                        Promise.resolve(handle.remove()).catch(function () {});
                    } catch (_) {}
                }
            }
            function finish(error: any, value?: any): void {
                if (settled) return;
                settled = true;
                cleanup();
                if (error) reject(error);
                else resolve(value);
            }
            function cancel(): void {
                if (settled) return;
                if (started && typeof native.cancelList === "function") {
                    try {
                        Promise.resolve(
                            native.cancelList({ requestId: requestId })
                        ).catch(function () {});
                    } catch (_) {}
                }
                finish(null, { cancelled: true, items: [] });
            }
            activeNativeCancel = cancel;
            function start(): void {
                if (settled) return;
                if (request !== catalogRevision) {
                    cancel();
                    return;
                }
                started = true;
                try {
                    Promise.resolve(
                        native.list({
                            preferredId: preferredId,
                            requestId: requestId,
                        })
                    ).then(
                        function (value: any) {
                            finish(null, value);
                        },
                        function (error: any) {
                            finish(error);
                        }
                    );
                } catch (error) {
                    finish(error);
                }
            }
            if (typeof native.addListener !== "function") {
                start();
                return;
            }
            Promise.resolve(
                native.addListener("localMediaProgress", function (event: any) {
                    if (settled || !event || event.requestId !== requestId)
                        return;
                    if (request !== catalogRevision || !progress(event.catalog))
                        cancel();
                })
            ).then(function (handle: any) {
                listener = handle;
                if (settled) {
                    cleanup();
                    return;
                }
                start();
            }, start);
        });
    }
    function list(
        onProgress?: (value: any) => boolean | void,
        preferredId?: string,
        prioritySources?: string[],
        admitted?: () => boolean,
        sourceId?: string
    ): Promise<any> {
        if (w.__ottStandby?.blocked())
            return Promise.reject(w.__ottStandby.error());
        var initial: any = null;
        if (remoteHandoff) {
            var handoff = remoteHandoff;
            remoteHandoff = null;
            if (
                w.__ottActiveProviderDriver?.id === "offline" &&
                handoff.current()
            ) {
                handoff.bindCatalog();
                last = handoff.catalog;
                var scan = localSourceScan(handoff.catalog, sourceId || "");
                if (
                    scan ? scan.state === "complete" : !handoff.catalog.scanning
                )
                    return Promise.resolve(handoff.catalog);
                initial = handoff.catalog;
            } else {
                playbackSelection.ordered();
                remoteOrderCurrent = null;
            }
        }
        var request = ++catalogRevision;
        last = null;
        function accept(value: any): boolean {
            if (request !== catalogRevision) return false;
            if (!value || !Array.isArray(value.items))
                throw new Error("Invalid local media catalog");
            last = normalizePlayback(value);
            updateLoading(value);
            return !onProgress || onProgress(value) !== false;
        }
        // Publish the accepted prefix immediately. Continue the same native
        // scan so later discoveries extend the list without replacing playback.
        if (initial && !accept(initial))
            return Promise.resolve({ ...initial, cancelled: true });
        var initialScan =
            initial && sourceId ? localSourceScan(initial, sourceId) : null;
        var pending = nativeLibrary()
            ? boundedLocalRead(function (progress) {
                  return nativeList(progress, preferredId, request);
              })
            : boundedLocalRead(function () {
                  return getEndpoint(false, preferredId, sourceId);
              }).then(function (base) {
                  if (request !== catalogRevision)
                      return { cancelled: true, items: [] };
                  return base
                      ? pollCatalog(
                            base,
                            request,
                            accept,
                            !!onProgress,
                            preferredId,
                            admitted,
                            sourceId,
                            null,
                            initialScan && initialScan.generation
                        )
                      : boundedLocalRead(function (progress) {
                            return browser.list(
                                progress,
                                preferredId,
                                prioritySources
                            );
                        });
              });
        // Native bridges and browser filesystem reads cannot always be aborted.
        // Native and browser progress extend the idle deadline while actual
        // discovery advances. Late events remain bound to this catalog owner.
        // Retire ownership on expiry so late results cannot populate a completed
        // snapshot or revive a closed loading dialog.
        function boundedLocalRead(
            start: (progress: (value: any) => boolean) => Promise<any>
        ): Promise<any> {
            return new Promise(function (resolve, reject) {
                var timer: any = null;
                var settled = false;
                var signature = "";
                function clear(): void {
                    if (timer !== null) clearTimeout(timer);
                    timer = null;
                }
                function heartbeat(timeout = 60000): void {
                    clear();
                    timer = setTimeout(function () {
                        if (settled) return;
                        settled = true;
                        timer = null;
                        if (request === catalogRevision) {
                            catalogRevision++;
                            // Retain the saved source rows so a stalled read
                            // can be reconnected without deleting its identity.
                            if (last)
                                last = {
                                    ...last,
                                    reconnectRequired: true,
                                    scanning: false,
                                };
                            cancelNativeList();
                            browser.suspend();
                        }
                        reject(new Error("Local source did not respond"));
                    }, timeout);
                }
                function finish(error: any, value?: any): void {
                    if (settled) return;
                    settled = true;
                    clear();
                    if (error) {
                        cancelNativeList();
                        reject(error);
                    } else resolve(value);
                }
                heartbeat();
                try {
                    start(function (value) {
                        if (settled || request !== catalogRevision)
                            return false;
                        var admitted = accept(value);
                        var next = JSON.stringify([
                            value.scanned,
                            value.total,
                            value.items.length,
                            value.sources && value.sources.length,
                            value.phase,
                            value.scanning,
                        ]);
                        if (next !== signature) {
                            signature = next;
                            heartbeat(localMediaProgressTimeout(value));
                        }
                        return admitted;
                    }).then(
                        function (value) {
                            finish(null, value);
                        },
                        function (error) {
                            finish(error);
                        }
                    );
                } catch (error) {
                    finish(error);
                }
            });
        }
        return pending.then(function (value: any) {
            if (!value || !Array.isArray(value.items))
                throw new Error("Invalid local media catalog");
            if (request !== catalogRevision)
                return { ...value, cancelled: true };
            last = value;
            return value;
        });
    }
    // Poll snapshots of a native background scan. Reading the catalog never
    // starts a replacement scan, and unchanged snapshots are not progress.
    function pollCatalog(
        base: string,
        request: number | null,
        accept: (value: any) => boolean,
        progressive: boolean,
        preferredId?: string,
        admitted?: () => boolean,
        sourceId?: string,
        firstPlayable: ((value: any) => boolean) | null = null,
        generation = 0
    ): Promise<any> {
        var catalogUrl = base;
        var preferredSent = !preferredId || isTauri();
        var signature = "";
        var changedAt = Date.now();
        var sourceGeneration = generation;
        function read(): Promise<any> {
            if (admitted && !admitted())
                return Promise.resolve({ cancelled: true, items: [] });
            return boundedCatalogRequest(
                catalogUrl,
                Math.max(1, 60000 - (Date.now() - changedAt))
            ).then(function (value) {
                if (!value || !Array.isArray(value.items))
                    throw new Error("Invalid local media catalog");
                if (
                    (request !== null && request !== catalogRevision) ||
                    (admitted && !admitted())
                )
                    return { ...value, cancelled: true };
                if (!preferredSent && value.readOnly) {
                    var url = new URL(base);
                    url.searchParams.set("preferredId", preferredId!);
                    catalogUrl = url.href;
                    preferredSent = true;
                    return read();
                }
                var scan = sourceId ? localSourceScan(value, sourceId) : null;
                if (scan && scan.generation) {
                    if (
                        sourceGeneration &&
                        sourceGeneration !== scan.generation
                    )
                        throw {
                            localMediaCode: "runtime_changed",
                            message: "Local source changed while loading",
                        };
                    sourceGeneration = scan.generation;
                }
                if (
                    scan &&
                    !(value.sources || []).some(function (source: any) {
                        return (
                            source.id === sourceId &&
                            source.kind === "folder" &&
                            source.available !== false
                        );
                    })
                )
                    throw {
                        localMediaCode: "source_unavailable",
                        message: "The selected local source is unavailable",
                    };
                var sourceComplete = !!scan && scan.state === "complete";
                if (scan && scan.state === "error")
                    throw {
                        localMediaCode: "catalog_unavailable",
                        message:
                            "The selected local source could not be scanned",
                    };
                var next = JSON.stringify([
                    value.scanning,
                    value.scanned,
                    value.total,
                    value.items.length,
                    value.scanError,
                    value.preferred && value.preferred.id,
                    value.preferred && value.preferred.state,
                    scan && scan.generation,
                    scan && scan.state,
                ]);
                if (next !== signature) {
                    signature = next;
                    changedAt = Date.now();
                    if (!accept(value)) return { ...value, cancelled: true };
                }
                if (value.scanError && !(scan && scan.generation))
                    throw new Error(value.scanError);
                if (
                    sourceComplete ||
                    (!value.scanning && !scan) ||
                    (firstPlayable &&
                        scan &&
                        scan.generation > 0 &&
                        firstPlayable(value))
                )
                    return value;
                if (Date.now() - changedAt >= 60000)
                    throw new Error("Local media scan stopped responding");
                // A one-shot server catalog remains compatible. Only Tauri's
                // explicit background-scan protocol needs repeated requests.
                if (!isTauri() && !progressive) return value;
                return new Promise(function (resolve) {
                    setTimeout(resolve, 250);
                }).then(function () {
                    if (request !== null && request !== catalogRevision)
                        return { ...value, cancelled: true };
                    return read();
                });
            });
        }
        return read();
    }
    function title(): string {
        return w._ ? w._("Local videos") : "Local videos";
    }
    function locked(): boolean {
        return !!(w.__ottKiosk && w.__ottKiosk.locked());
    }
    function settingsLocked(): boolean {
        return !!(w.__ottParental && w.__ottParental.needs("settings"));
    }
    function current(): boolean {
        return (
            opened &&
            (!handler || w.listKeyHandler === handler) &&
            (!owner ||
                owner.foreground() ||
                (loading && loading.foreground() && owner.active()))
        );
    }
    function captureSettings(): () => boolean {
        var catalogue = catalogRevision,
            intent = revision;
        return function () {
            return (
                current() &&
                !locked() &&
                !settingsLocked() &&
                catalogue === catalogRevision &&
                intent === revision
            );
        };
    }
    function failureMessage(value: any): string {
        if (
            value?.items?.some(function (item: any) {
                return item.playback?.mode === "unsupported";
            })
        )
            return "Some AVI/MKV files need a compatible native or Server library backend. Direct formats remain available; originals are not uploaded.";
        var name = value && value.readErrorName;
        if (
            !/^(NotFoundError|NotAllowedError|SecurityError|NotReadableError|AbortError|InvalidStateError|QuotaExceededError|TimeoutError|TypeError|UnknownError|Error)$/.test(
                name
            )
        )
            return "";
        var stage = (
            {
                enumerating: "Reading folder entries",
                files: "Reading local files",
                metadata: "Reading file information",
                permission: "Checking folder permission",
                sources: "Reading saved sources",
            } as any
        )[value.readErrorPhase];
        if (typeof stage !== "string") stage = "Local source unavailable";
        return (w._ ? w._(stage) : stage) + ": " + name;
    }
    function updateLoading(value: any): void {
        progressState = value;
        if (!loading || !current()) return;
        var node =
            w.document && w.document.getElementById("local-media-progress");
        if (node) node.textContent = formatLocalMediaProgress(value, w._);
    }
    function finishLoading(active = loading): void {
        if (!active) return;
        if (loading === active) loading = null;
        active.close();
    }
    function close(): void {
        importedSelection = "";
        nextImportSelection = "";
        cancelNativeList();
        browser.suspend();
        finishLoading();
        opened = false;
        revision++;
        catalogRevision++;
        if (
            !locked() &&
            !settingsLocked() &&
            typeof w.optionsList === "function"
        )
            w.optionsList(w.popLocalMedia);
        else if (typeof w.closeList === "function") w.closeList();
    }
    function importFiles(folder = false): Promise<any> {
        if (locked() || settingsLocked())
            return Promise.reject(
                new Error(
                    "Unlock settings and kiosk mode to change local sources"
                )
            );
        function scanImported(result: any): Promise<any> {
            if (request !== catalogRevision)
                return Promise.resolve({
                    cancelled: true,
                    pickerCancelled: true,
                });
            if (result && result.pickerCancelled)
                return Promise.resolve({ pickerCancelled: true });
            playbackSelection.clear();
            var pending = list(
                function (value) {
                    updateLoading(value);
                    return !value.items.some(function (item: any) {
                        return item.available !== false && !!item.url;
                    });
                },
                undefined,
                result && result.sourceIds
            );
            var scanRequest = catalogRevision;
            return pending.then(function (value) {
                if (
                    scanRequest === catalogRevision &&
                    last === value &&
                    result &&
                    result.sourceIds
                ) {
                    var item = value.items.filter(function (item: any) {
                        return (
                            result.sourceIds.indexOf(item.sourceId) >= 0 &&
                            item.available !== false &&
                            !!item.url
                        );
                    })[0];
                    importedSelection = item ? "local-" + item.id : "";
                }
                return value;
            });
        }
        if (nativeLibrary())
            return remember(
                (folder ? native.importFolder() : native.importFiles()).then(
                    function (value: any) {
                        if (!value?.pickerCancelled) playbackSelection.clear();
                        return value;
                    }
                )
            );
        // A picker may outlive its screen. Its saved handle is still valid, but
        // its completion must not replace a newer catalog or start playback.
        var request = ++catalogRevision;
        importedSelection = "";
        nextImportSelection = "";
        if (isTauri())
            return tauriInvoke<any>(
                folder
                    ? "offline_media_import_folder"
                    : "offline_media_import_files",
                {}
            ).then(scanImported);
        if (remoteEndpoint())
            return Promise.reject(
                new Error(
                    "Connect folders on the server itself, or select this device's library."
                )
            );
        progressState = {
            items: [],
            phase: folder ? "picker-folder" : "picker-files",
        };
        return (
            folder
                ? browser.importFolder({ deferScan: true })
                : browser.importFiles(undefined, { deferScan: true })
        ).then(scanImported);
    }
    function removeSource(id: string): Promise<any> {
        if (locked() || settingsLocked())
            return Promise.reject(
                new Error("Unlock settings to disconnect sources")
            );
        function removed(value: any): any {
            if (playbackSelection.clearSource(id)) retireRemotePlayback();
            return value;
        }
        if (nativeLibrary())
            return remember(native.removeSource({ id: id }).then(removed));
        if (isTauri())
            return tauriInvoke<any>("offline_media_remove_source", {
                id: id,
            })
                .then(removed)
                .then(function () {
                    return list();
                });
        if (remoteEndpoint())
            return Promise.reject(
                new Error("Manage sources on the server itself.")
            );
        return remember(browser.removeSource(id).then(removed));
    }
    function reconnectSource(id: string): Promise<any> {
        if (locked() || settingsLocked())
            return Promise.reject(
                new Error("Unlock settings to reconnect sources")
            );
        if (isNative() || isTauri() || remoteEndpoint())
            return Promise.reject(
                new Error("Reconnect this folder on the device that owns it.")
            );
        var request = ++catalogRevision;
        progressState = { items: [], phase: "picker-folder" };
        // Invoke the picker synchronously inside the user's Enter/click action.
        return browser.reconnectSource(id).then(function (value: any) {
            if (request !== catalogRevision || value?.pickerCancelled)
                return value;
            if (value?.sourceReconnected && value.requiresReload) {
                // Old native filesystem reads cannot be aborted by JavaScript.
                // A fresh document uses the new handle without pretending that
                // those old reads have drained or freeing their safety budget.
                w.location.reload();
            }
            return value;
        });
    }
    function requestAccess(
        onProgress?: (value: any) => boolean | void
    ): Promise<any> {
        if (locked() || settingsLocked())
            return Promise.reject(new Error("Unlock settings to grant access"));
        if (nativeLibrary()) return remember(native.requestAccess());
        if (isTauri()) {
            var missing =
                last &&
                (last.sources || []).filter(function (source: any) {
                    return !source.available;
                })[0];
            return importFiles(!!missing && missing.kind === "folder");
        }
        if (remoteEndpoint()) return list(onProgress);
        var request = ++catalogRevision;
        return browser
            .requestAccess(
                onProgress
                    ? function (value: any) {
                          if (request !== catalogRevision) return false;
                          last = value;
                          return onProgress(value);
                      }
                    : undefined
            )
            .then(function (value: any) {
                if (request === catalogRevision)
                    last = normalizePlayback(value);
                return value;
            });
    }
    function remove(id: string): Promise<any> {
        if (locked())
            return Promise.reject(
                new Error("Unlock kiosk mode to change local files")
            );
        if (settingsLocked())
            return Promise.reject(
                new Error("Unlock settings to change local files")
            );
        if (nativeLibrary()) return remember(native.remove({ id: id }));
        return remember(
            getEndpoint().then(function (base) {
                return base
                    ? http(base + "/" + encodeURIComponent(id), {
                          method: "DELETE",
                      })
                    : browser.remove(id);
            })
        );
    }
    function finishSession(
        persist: boolean,
        extra?: { key: string; value: string },
        admitted?: () => boolean
    ): boolean {
        var session = w.ottpStorage?.localPlayback;
        if (admitted && !admitted()) return false;
        if (!session?.active()) return true;
        var current = session.capture();
        var driver = w.__ottActiveProviderDriver;
        var context = playbackIntentContext();
        if (w.__ottClassicPlayback) w.__ottClassicPlayback.checkpointNow();
        if (
            !current() ||
            (admitted && !admitted()) ||
            driver !== w.__ottActiveProviderDriver ||
            context !== playbackIntentContext()
        )
            return false;
        if (persist) return session.end(true, extra);
        if (w.__ottClassicPlayback) w.__ottClassicPlayback.cancel();
        w.__ottActiveProviderDriver = null;
        if (driver) driver.dispose();
        if ((!current() && session.active()) || w.__ottActiveProviderDriver)
            return false;
        retireRemotePlayback();
        if (!session.active()) return true;
        return session.end(false);
    }
    function activate(): void {
        if (locked()) return;
        if (!playable()) {
            open();
            return;
        }
        var selected = importedSelection;
        if (!finishSession(true))
            throw new Error("Could not save Local playback selection");
        finishLoading();
        opened = false;
        revision++;
        if (typeof w.closeList === "function") w.closeList();
        w.stbSetItem("ottplayprov", "offline");
        nextImportSelection = selected;
        importedSelection = "";
        w.loadProv("offline");
    }
    function playable(): boolean {
        return !!(
            last &&
            last.items.some(function (item: any) {
                return item.available !== false && !!item.url;
            })
        );
    }
    var localUi: any = null,
        uiIntent = 0;
    function localUiAction(name: string, args: any[]): any {
        var intent = ++uiIntent;
        function uiOwner(): any {
            if (!localUi) {
                if (typeof w.__ottLocalMediaUiFactory !== "function")
                    throw new Error("Local media feature could not be loaded");
                localUi = w.__ottLocalMediaUiFactory(w, {
                    activate: activate,
                    boundedCatalogRequest: boundedCatalogRequest,
                    browser: browser,
                    captureSettings: captureSettings,
                    get catalogRevision() {
                        return catalogRevision;
                    },
                    set catalogRevision(value: any) {
                        catalogRevision = value;
                    },
                    close: close,
                    current: current,
                    failureMessage: failureMessage,
                    finishLoading: finishLoading,
                    finishSession: finishSession,
                    formatLocalMediaProgress: formatLocalMediaProgress,
                    getEndpoint: getEndpoint,
                    get handler() {
                        return handler;
                    },
                    set handler(value: any) {
                        handler = value;
                    },
                    get importedSelection() {
                        return importedSelection;
                    },
                    set importedSelection(value: any) {
                        importedSelection = value;
                    },
                    importFiles: importFiles,
                    isNative: isNative,
                    isTauri: isTauri,
                    get last() {
                        return last;
                    },
                    set last(value: any) {
                        last = value;
                    },
                    list: list,
                    get loading() {
                        return loading;
                    },
                    set loading(value: any) {
                        loading = value;
                    },
                    locked: locked,
                    get opened() {
                        return opened;
                    },
                    set opened(value: any) {
                        opened = value;
                    },
                    get owner() {
                        return owner;
                    },
                    set owner(value: any) {
                        owner = value;
                    },
                    pendingFileKey: pendingFileKey,
                    playable: playable,
                    get progressState() {
                        return progressState;
                    },
                    set progressState(value: any) {
                        progressState = value;
                    },
                    reconnectSource: reconnectSource,
                    remoteEndpoint: remoteEndpoint,
                    remove: remove,
                    removeSource: removeSource,
                    requestAccess: requestAccess,
                    get resuming() {
                        return resuming;
                    },
                    set resuming(value: any) {
                        resuming = value;
                    },
                    get revision() {
                        return revision;
                    },
                    set revision(value: any) {
                        revision = value;
                    },
                    settingsLocked: settingsLocked,
                    title: title,
                });
            }
            return localUi;
        }
        if (localUi || w.__ottLocalMediaUiFactory)
            return uiOwner()[name].apply(localUi, args);
        var request = revision,
            scan = catalogRevision,
            input = w.listKeyHandler;
        var screen = w.__ottClassicScreenPort?.listOwner?.();
        var foreground = screen?.foreground?.();
        return new Promise(function (resolve, reject) {
            loadRemoteFeature(w, "local-media-ui", function (error?: string) {
                if (
                    intent !== uiIntent ||
                    (screen &&
                        (screen !== w.__ottClassicScreenPort?.listOwner?.() ||
                            (foreground && !screen.foreground()))) ||
                    request !== revision ||
                    scan !== catalogRevision ||
                    input !== w.listKeyHandler ||
                    w.__ottStandby?.blocked()
                ) {
                    reject(new Error("Local media request cancelled"));
                    return;
                }
                try {
                    if (error)
                        throw new Error(
                            "Local media feature could not be loaded"
                        );
                    resolve(uiOwner()[name].apply(localUi, args));
                } catch (error) {
                    reject(error);
                }
            });
        });
    }
    function open(...args: any[]): any {
        var result = localUiAction("open", args);
        if (result?.catch)
            return result.catch(function (error: any) {
                if (
                    error?.message !== "Local media request cancelled" &&
                    typeof w.showShift === "function"
                )
                    w.showShift(w._("Local source unavailable"));
            });
        return result;
    }
    var api = {
        activate: activate,
        available: function () {
            return isNative() || isTauri() || serverLibrary() || !!w.indexedDB;
        },
        bindPlaybackOwner: function (active: () => boolean): void {
            if (!remoteHandoff) return;
            if (remoteHandoff.current()) remoteHandoff.bindOwner(active);
            else retireRemotePlayback();
        },
        cancelNativeList: cancelNativeList,
        cancelPlayback: cancelPlayback,
        cancelScan: function () {
            catalogRevision++;
            cancelNativeList();
            browser.suspend();
        },
        compatibilityFailure: function () {
            if (typeof w.showShift === "function")
                w.showShift(w._("Local source unavailable"));
        },
        compatibilityPlayback: compatibilityPlayback,
        completedSources: function () {
            if (
                !last ||
                last.cancelled ||
                last.scanning ||
                last.scanError ||
                last.reconnectRequired
            )
                return null;
            return (last.sources || []).map(function (source: any) {
                return { id: source.id, kind: source.kind, name: source.name };
            });
        },
        didRestoreLibrary: function () {
            retireRemotePlayback();
            catalogRevision++;
            last = null;
        },
        failureMessage: failureMessage,
        favoriteSnapshot: function () {
            var captured = last,
                revision = catalogRevision,
                library = libraryIdentity();
            if (
                !captured ||
                captured.cancelled ||
                captured.scanError ||
                captured.reconnectRequired
            )
                return null;
            return {
                catalog: JSON.parse(JSON.stringify(captured)),
                current: function () {
                    return (
                        last === captured &&
                        catalogRevision === revision &&
                        libraryIdentity() === library
                    );
                },
            };
        },
        finishSession: finishSession,
        importFiles: importFiles,
        isPlaybackUrl: function (url: string) {
            if (localCall(compatibility, "c", [url], 1)) return true;
            return !!(
                last &&
                last.items.some(function (item: any) {
                    return item.url === url;
                })
            );
        },
        libraryIdentity: libraryIdentity,
        libraryWrite: function (identity: string) {
            if (isNative() && identity === "capacitor")
                return { key: "localMediaEndpoint", value: "" };
            if (
                isTauri() ||
                (isNative() && identity === "browser:") ||
                identity.indexOf("browser:") !== 0
            )
                throw new Error(
                    "This local library belongs to another platform"
                );
            var value = identity.slice(8);
            if (value) {
                var parsed = new URL(value);
                if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname)
                    throw new Error("Invalid saved server library URL");
            }
            return { key: "localMediaEndpoint", value: value };
        },
        list: list,
        open: open,
        playbackFilter: playbackSelection.filter,
        playbackList: function (
            onProgress?: (value: any) => boolean | void,
            preferredId?: string
        ): Promise<any> {
            return list(
                onProgress,
                preferredId,
                undefined,
                undefined,
                playbackSelection.source()
            );
        },
        playbackOrder: function () {
            if (remoteOrderCurrent && !remoteOrderCurrent()) {
                retireRemotePlayback();
            }
            return w.__ottActiveProviderDriver?.id === "offline" &&
                remoteOrderCurrent?.()
                ? playbackSelection.order()
                : null;
        },
        playbackOrdered: function () {
            playbackSelection.ordered();
            remoteOrderCurrent = null;
        },
        playbackSourceUrl: function (url: string) {
            return localCall(compatibility, "e", [url], 1) || url;
        },
        preferredState: function (id: string) {
            return last && last.preferred && last.preferred.id === id
                ? last.preferred.state
                : undefined;
        },
        preparePlayback: preparePlayback,
        progressText: function (value: any) {
            return formatLocalMediaProgress(value, w._);
        },
        progressTimeout: localMediaProgressTimeout,
        remoteActivate: function (
            source: string,
            ids: string[],
            catalog: any,
            admitted: () => boolean,
            seed: number | null = null
        ): void {
            var storage = w.ottpStorage;
            function storageCurrent(): boolean {
                return (
                    !!storage?.localPlayback &&
                    storage === w.ottpStorage &&
                    w.stbGetItem === storage.get &&
                    w.stbSetItem === storage.set &&
                    w.stbDelItem === storage.del
                );
            }
            if (
                !admitted() ||
                locked() ||
                settingsLocked() ||
                typeof w.loadProv !== "function" ||
                !storageCurrent()
            )
                throw { localMediaCode: "restricted" };
            var generation = ++remoteGeneration;
            var activating = true;
            var expectedLoad: any;
            var playbackOwner: (() => boolean) | null = null;
            var catalogLoad: any = null;
            var selectionContext = playbackIntentContext();
            function ownsActivation(): boolean {
                try {
                    return (
                        generation === remoteGeneration &&
                        storageCurrent() &&
                        admitted() &&
                        !w.__ottStandby?.blocked?.() &&
                        selectionContext === playbackIntentContext() &&
                        (playbackOwner
                            ? playbackOwner() &&
                              (!catalogLoad ||
                                  catalogLoad === w.__ottCommandChannelLoad)
                            : activating ||
                              expectedLoad === w.__ottCommandChannelLoad)
                    );
                } catch (_) {
                    return false;
                }
            }
            if (!ownsActivation()) throw { localMediaCode: "runtime_changed" };
            remoteOrderCurrent = ownsActivation;
            nextImportSelection = "local-" + ids[0];
            remoteHandoff = {
                bindCatalog: function () {
                    catalogLoad = w.__ottCommandChannelLoad;
                },
                bindOwner: function (active: () => boolean) {
                    playbackOwner = active;
                },
                catalog: catalog,
                current: ownsActivation,
            };
            finishLoading();
            opened = false;
            revision++;
            if (typeof w.closeList === "function") w.closeList();
            try {
                // Only the accepted provider handoff retires the previous
                // playback reader; waiting for another folder must not do so.
                catalogRevision++;
                w.loadProv("offline", function () {
                    if (!ownsActivation())
                        throw { localMediaCode: "runtime_changed" };
                    var rollback = storage.localPlayback.begin(
                        playbackIntentContext
                    );
                    try {
                        playbackSelection.select(source, ids, seed);
                        return rollback;
                    } catch (error) {
                        rollback();
                        throw error;
                    }
                });
            } finally {
                expectedLoad = w.__ottCommandChannelLoad;
                activating = false;
            }
        },
        remoteCapabilities: function () {
            if (!api.available()) return undefined;
            return {
                absolute_paths: nativeSourcePaths,
                max_items: 50000,
                max_sources: 32,
                operations: ["sources", "play", "shuffle", "connect"],
                version: 1,
            };
        },
        remoteProgressive: function () {
            // Only this backend consumes firstPlayable during remote selection.
            return isTauri() && nativeSourcePaths;
        },
        remoteCatalog: function (
            current?: () => boolean,
            sourceId?: string,
            firstPlayable: ((value: any) => boolean) | null = null
        ): Promise<any> {
            if (isTauri() && sourceId) {
                var owner = catalogRevision;
                var cancelled = false;
                var active = function (): boolean {
                    return (
                        !cancelled &&
                        owner === catalogRevision &&
                        (!current || current())
                    );
                };
                var selected: any = getEndpoint(false, undefined, sourceId)
                    .then(function (base) {
                        if (!active()) return { cancelled: true, items: [] };
                        return pollCatalog(
                            base,
                            null,
                            active,
                            true,
                            undefined,
                            active,
                            sourceId,
                            firstPlayable
                        );
                    })
                    .then(function (value) {
                        if (!active()) return { ...value, cancelled: true };
                        if (!value.cancelled) last = value;
                        return value;
                    });
                selected.cancel = function () {
                    cancelled = true;
                };
                return selected;
            }
            if (w.__ottActiveProviderDriver?.id === "offline" && last?.scanning)
                return Promise.reject({ localMediaCode: "catalog_loading" });
            var pending: any = list(
                function () {
                    return !current || current();
                },
                undefined,
                undefined,
                current,
                sourceId
            );
            var request = catalogRevision;
            pending.cancel = function () {
                if (request !== catalogRevision) return;
                catalogRevision++;
                last = null;
                cancelNativeList();
                browser.suspend();
            };
            return pending;
        },
        remoteConnect: function (
            path: string,
            current?: () => boolean,
            deadline?: number
        ): Promise<any> {
            if (!isTauri() || !nativeSourcePaths)
                return Promise.reject({ localMediaCode: "unsupported" });
            var request = catalogRevision;
            var requestId =
                "local-link-" + Date.now() + "-" + ++remoteLinkSequence;
            var cancelled = false;
            var settled = false;
            var pending: any = tauriInvoke<any>("local_media_link_folder", {
                path: path,
                requestId: requestId,
                ...(deadline === undefined
                    ? {}
                    : { deadlineMs: Math.floor(deadline) }),
            }).then(
                function (value) {
                    settled = true;
                    if (
                        !cancelled &&
                        request === catalogRevision &&
                        (!current || current())
                    )
                        last = null;
                    return value;
                },
                function (error) {
                    settled = true;
                    throw error;
                }
            );
            pending.cancel = function () {
                if (cancelled || settled) return;
                cancelled = true;
                try {
                    tauriInvoke("local_media_cancel_request", {
                        requestId: requestId,
                    }).catch(function () {});
                } catch (_) {
                    // Older native shells may not expose request cancellation.
                    // The response remains fenced by this request's lifetime.
                }
            };
            return pending;
        },
        remoteSources: function (
            includePaths = false,
            path?: string,
            current?: () => boolean,
            selection?: string
        ): Promise<any> {
            if (isTauri() && nativeSourcePaths)
                return tauriInvoke<any>("local_media_sources", {
                    includePaths: includePaths,
                    ...(path === undefined ? {} : { path: path }),
                    ...(selection === undefined
                        ? {}
                        : { selection: selection }),
                });
            if (includePaths || path)
                return Promise.reject(
                    new Error("Native source paths are unavailable")
                );
            if (last && !last.scanning && !last.cancelled)
                return Promise.resolve({ sources: last.sources || [] });
            if (w.__ottActiveProviderDriver?.id === "offline")
                return Promise.reject({ localMediaCode: "catalog_loading" });
            var pending: any = api.remoteCatalog(current);
            var result: any = pending.then(function (value: any) {
                return { sources: value.sources || [] };
            });
            result.cancel = pending.cancel;
            return result;
        },
        remove: remove,
        resume: function (skipScan = false, message = "") {
            // Backend exception text may contain private file paths. Keep only
            // our fixed timeout message or the sanitized filesystem error code.
            open(
                true,
                skipScan,
                message === "Local source did not respond"
                    ? message
                    : failureMessage(last)
            );
        },
        settingsRevision: function () {
            return catalogRevision;
        },
        snapshot: function () {
            // Profile operations must never replace the provider's active scan.
            // Only a completed catalog describes every connected source.
            if (
                !last ||
                last.cancelled ||
                last.scanning ||
                last.scanError ||
                last.reconnectRequired
            )
                return Promise.reject(
                    new Error(
                        "Wait for the local media scan to finish before saving or binding a profile"
                    )
                );
            return Promise.resolve(JSON.parse(JSON.stringify(last)));
        },
        startupSource: playbackSelection.source,
        suspend: function () {
            cancelPlayback();
            retireRemotePlayback();
            cancelNativeList();
            catalogRevision++;
            revision++;
            close();
        },
        takeImportSelection: function () {
            if (remoteHandoff && !remoteHandoff.current())
                retireRemotePlayback();
            var selected = nextImportSelection;
            nextImportSelection = "";
            try {
                var pending = w.stbGetItem(pendingFileKey);
                if (pending) {
                    var hint = JSON.parse(pending);
                    if (hint.namespace === w.__ottOfflineProfiles.namespace()) {
                        w.stbSetItem(pendingFileKey, "");
                        if (
                            !selected &&
                            typeof hint.id === "string" &&
                            hint.id.indexOf("local-") === 0
                        )
                            selected = hint.id;
                    }
                }
            } catch (_) {}
            return selected;
        },
        title: title,
        warmDiagnostics: warmDiagnostics,
    };
    w.__ottLocalMedia = api;
    if (isTauri())
        tauriInvoke<any>("local_media_capabilities", {}).then(
            function (value) {
                nativeSourcePaths = !!(
                    value &&
                    value.version === 1 &&
                    value.absolutePaths === true &&
                    value.sourcePaths === true
                );
            },
            function () {}
        );
    installOfflineProfiles(w, api);
    w.popLocalMedia = open;
    return api;
}
