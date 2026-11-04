import {
    isProviderAllowed,
    providerIds,
    providerLabels,
    selectProviderByIndex,
} from "../provider";
import { caselessKey } from "../utils/caseless";
import { handleCommand } from "./index";
import { readPlayerState } from "./player-state";
import { randomChannels } from "./random-channel";
import { executeRemoteAppUpdate } from "./remote-app-update";
import { handleRemoteArchive } from "./remote-archive";
import { executeRemoteFavorites } from "./remote-favorites";
import {
    executeGlobalFavorites,
    globalFavoritesCapability,
    legacyFavoritesCapability,
} from "./remote-favorites-global";
import {
    executeGlobalFavoritesItems,
    globalFavoritesItemsCapability,
} from "./remote-favorites-global-items";
import {
    executeGlobalFavoritesRecovery,
    globalFavoritesRecoveryCapability,
} from "./remote-favorites-global-recovery";
import {
    executeRemoteFavoritesTransfer,
    remoteFavoritesTransferCapability,
} from "./remote-favorites-transfer";
import { executeRemoteLocalMedia } from "./remote-local-media";
import { executeRemotePerformance } from "./remote-perf";
import { remotePlexQueue } from "./remote-plex";
import { handleRemoteProfiles } from "./remote-profiles";
import {
    companionDiagnosticsSnapshot,
    providerDiagnosticsSnapshot,
} from "./remote-provider-diagnostics";
import {
    executeRemoteControl,
    executeRemoteRestart,
    remotePlayerInfo,
} from "./remote-restart";
import { executeRemoteScreenshot } from "./remote-screenshot";
import { executeRemoteSettings } from "./remote-settings";
import {
    executeRemoteTorrentCatalog,
    executeRemoteTorrentIndexer,
} from "./remote-torrent-catalog";

// Keep the source and catalogue fingerprint on the player; only an opaque
// receipt crosses the control transport. It authorizes no additional access.
var remoteEpgCatalog: any = null;

// Receipts share the producer's immutable snapshot; no receipt copies its rows.
// Retain only the current snapshot and a bounded number of small query bindings.
var remoteMediaCatalogs: any[] = [];
var remoteMediaCatalogSequence = 0;
function remoteMediaText(value: any, limit: number): boolean {
    if (
        typeof value !== "string" ||
        !value.trim() ||
        /[\x00-\x1f\x7f-\x9f]/.test(value)
    )
        return false;
    try {
        return (
            encodeURIComponent(value).replace(/%[0-9A-F]{2}/g, "x").length <=
            limit
        );
    } catch (_) {
        return false;
    }
}
/** Project only a category's display label; never serialize its provider request. */
function remoteMediaCategoryName(value: any): string | null {
    if (
        typeof value !== "string" ||
        !value.trim() ||
        /[\x00-\x1f\x7f-\x9f]/.test(value)
    )
        return null;
    var bytes = 0;
    var prefixBytes = 0;
    var prefix = "";
    var collecting = true;
    for (var index = 0; index < value.length; index++) {
        var code = value.charCodeAt(index);
        var width = 1;
        var size = code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
        if (code >= 0xd800 && code <= 0xdbff) {
            var low = value.charCodeAt(index + 1);
            if (!(low >= 0xdc00 && low <= 0xdfff)) return null;
            width = 2;
            size = 4;
        } else if (code >= 0xdc00 && code <= 0xdfff) return null;
        bytes += size;
        // Reserve the three UTF-8 bytes of the ellipsis before keeping a code point.
        if (collecting && prefixBytes + size <= 509) {
            prefix += value.slice(index, index + width);
            prefixBytes += size;
        } else collecting = false;
        index += width - 1;
    }
    return bytes <= 512 ? value : prefix + "…";
}
function remoteMediaInteger(value: any, maximum: number): boolean {
    return (
        typeof value === "number" &&
        isFinite(value) &&
        Math.floor(value) === value &&
        value >= 0 &&
        value <= maximum
    );
}
function remoteMediaKeys(
    value: any,
    required: string[],
    optional: string[] = []
): boolean {
    return (
        !!value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        required.every(function (key) {
            return Object.prototype.hasOwnProperty.call(value, key);
        }) &&
        Object.keys(value).every(function (key) {
            return required.indexOf(key) >= 0 || optional.indexOf(key) >= 0;
        })
    );
}
function remoteMediaId(value: string): string {
    return value === "system:all" ? "all" : value;
}
function remoteMediaIncomplete(w: any): boolean {
    var driver = w.__ottActiveProviderDriver;
    try {
        return !!(
            driver &&
            typeof driver.catalogError === "function" &&
            driver.catalogError() === true
        );
    } catch (_) {
        // A failed completeness check cannot authorize a complete-catalogue claim.
        return true;
    }
}
function remoteMediaRead(w: any): any {
    var provider =
        w.__ottActiveProviderDriver && w.__ottActiveProviderDriver.id;
    var channels = w.__ottChannels;
    if (
        (provider !== "plex" && provider !== "vportal") ||
        !channels ||
        typeof channels.remoteCatalog !== "function"
    )
        return null;
    try {
        var snapshot = channels.remoteCatalog();
        if (
            !snapshot ||
            typeof snapshot.active !== "function" ||
            !snapshot.active() ||
            !Array.isArray(snapshot.all) ||
            !Array.isArray(snapshot.canonicalIds) ||
            !Array.isArray(snapshot.groups) ||
            snapshot.all.length > 1000000 ||
            snapshot.canonicalIds.length > 1000000 ||
            snapshot.groups.length >= 1000000
        )
            return null;
        return snapshot;
    } catch (_) {
        return null;
    }
}
function remoteMediaPrune(snapshot: any): void {
    remoteMediaCatalogs = remoteMediaCatalogs.filter(function (entry) {
        return (
            entry.snapshot === snapshot &&
            entry.expires > Date.now() &&
            entry.snapshot.active()
        );
    });
}
function remoteMediaReceipt(
    snapshot: any,
    runtime: string,
    provider: string,
    category?: string,
    search?: string
): any {
    remoteMediaPrune(snapshot);
    var entry = {
        category: category,
        expires: Date.now() + 120000,
        provider: provider,
        runtime: runtime,
        search: search,
        snapshot: snapshot,
        token:
            "media-" +
            Date.now().toString(36) +
            "-" +
            (++remoteMediaCatalogSequence).toString(36) +
            "-" +
            Math.random().toString(36).slice(2),
    };
    if (remoteMediaCatalogs.length >= 32) remoteMediaCatalogs.shift();
    remoteMediaCatalogs.push(entry);
    return entry;
}
function remoteMediaFind(
    token: any,
    snapshot: any,
    runtime: string,
    provider: string
): any {
    remoteMediaPrune(snapshot);
    return remoteMediaCatalogs.filter(function (entry) {
        return (
            entry.token === token &&
            entry.runtime === runtime &&
            entry.provider === provider
        );
    })[0];
}
// Only a fully validated page read extends the receipt's inactivity window.
function remoteMediaRenew(w: any, entry: any): boolean {
    if (
        !entry.snapshot.active() ||
        remotePlayerInfo(w).runtime !== entry.runtime ||
        !w.__ottActiveProviderDriver ||
        w.__ottActiveProviderDriver.id !== entry.provider
    )
        return false;
    entry.expires = Date.now() + 120000;
    return true;
}
function remoteMediaGroup(snapshot: any, category: string): any {
    if (category === "all")
        return { id: "all", members: snapshot.all, name: "All" };
    return snapshot.groups.filter(function (group: any) {
        return remoteMediaId(group.id) === category;
    })[0];
}
function remoteMediaSelected(w: any, snapshot: any): string {
    var selected =
        typeof w.__ottChannels.browsingGroup === "function"
            ? w.__ottChannels.browsingGroup()
            : typeof w.__ottChannels.group === "function"
              ? w.__ottChannels.group(w.listCatIndex)
              : null;
    selected = typeof selected === "string" ? remoteMediaId(selected) : "all";
    return remoteMediaGroup(snapshot, selected) ? selected : "all";
}
function remoteMediaRows(
    w: any,
    snapshot: any,
    group: any,
    search: string,
    offset: number,
    limit: number,
    wanted?: string
): any {
    var members: Record<string, boolean> = Object.create(null);
    var seen: Record<string, boolean> = Object.create(null);
    var result: any = { channels: [], selected: null, total: 0 };
    var valid = true;
    if (!group || !Array.isArray(group.members)) return null;
    group.members.forEach(function (key: any) {
        members[String(key)] = true;
    });
    var folded = caselessKey(search);
    snapshot.canonicalIds.forEach(function (key: any, index: number) {
        var channel = (w.channels || {})[key];
        if (!channel) {
            valid = false;
            return;
        }
        var id = String(channel.itemId || key);
        var name =
            typeof channel.channel_name === "string"
                ? channel.channel_name
                : "";
        if (
            !remoteMediaText(id, 2048) ||
            !remoteMediaText(name, 512) ||
            seen[id]
        ) {
            valid = false;
            return;
        }
        seen[id] = true;
        if (
            !members[String(key)] ||
            (folded && caselessKey(name).indexOf(folded) < 0)
        )
            return;
        var row = { id: id, name: name, number: index + 1 };
        if (result.total >= offset && result.channels.length < limit)
            result.channels.push(row);
        if (id === wanted) result.selected = { key: key, row: row };
        result.total++;
    });
    return valid && snapshot.active() ? result : null;
}
function remoteMediaRestricted(
    w: any,
    channels = true,
    loadingOwner?: any
): boolean {
    try {
        if (
            (w.__ottKiosk && w.__ottKiosk.enabled()) ||
            (typeof w.stbIsStandby === "function" && w.stbIsStandby()) ||
            (w.__ottParental
                ? w.__ottParental.needs("providers") ||
                  w.__ottParental.needs("settings") ||
                  (channels && w.__ottParental.needs("channels"))
                : (w.sPSprovs || w.sPSoptions || (channels && w.sPSchannels)) &&
                  w.parentPIN !== "*" &&
                  !w.parentAccess)
        )
            return true;
        var port = w.__ottClassicScreenPort;
        if (
            !port ||
            !port.screens ||
            typeof port.screens.current !== "function"
        )
            return true;
        var owner = port.screens.current();
        var ownedLoading =
            !!loadingOwner &&
            owner === loadingOwner &&
            loadingOwner.kind === "dialog" &&
            loadingOwner.active() &&
            loadingOwner.foreground() &&
            typeof port.owner === "function" &&
            port.owner("dialog") === loadingOwner;
        var list = port.listOwner && port.listOwner();
        if (
            (owner &&
                ((owner.kind !== "list" && !ownedLoading) ||
                    (owner.model && owner.model.localOnlyInput))) ||
            (list && list.model && list.model.localOnlyInput)
        )
            return true;
        if (
            w.$ &&
            w
                .$(
                    "#pin, #remoteDiagnosticsToggle, #remoteDiagnosticsTrust, #remoteScreenshotToggle, #listAbout, #listEdit, #numprog" +
                        (ownedLoading ? "" : ", #dialogbox")
                )
                .is(":visible")
        )
            return true;
        return !!(
            w.isListVisible &&
            (w.listArray || []).some(function (row: any) {
                return (
                    row &&
                    (row.editorAction === "parentalEnabled" ||
                        /^(psChannels|psOptions|requirePinForProviderSelection)$/.test(
                            row.settingId
                        ))
                );
            })
        );
    } catch (_) {
        return true;
    }
}

/** Read only producer-owned, allowlisted snapshots; never raw diagnostics or logs. */
function remoteSnapshot(read: any): any {
    if (typeof read !== "function") return { available: false };
    try {
        var value = read();
        if (
            value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            value.available === true &&
            typeof value.enabled === "boolean"
        )
            return value;
    } catch (_) {}
    return { available: true, enabled: null };
}

/** Queries expose metadata only: never URLs, credentials or the settings store. */
export function executeRemoteRequest(
    request: any,
    done: (result: any) => void,
    afterReply?: (effect: () => void) => void
): (() => void) | void {
    var w = window as any;
    var params = request.params || {};
    var companion = w.__ottMediaCompanion;
    if (
        (request.action === "providers" ||
            request.action === "provider" ||
            request.action === "capabilities") &&
        companion?.nativePending()
    ) {
        var pending = true,
            providerLoad = w.__ottCommandChannelLoad,
            cancelProviderRequest: (() => void) | void;
        companion.capabilities().then(function () {
            if (!pending) return;
            pending = false;
            if (
                providerLoad !== w.__ottCommandChannelLoad ||
                (request.expires_at !== undefined &&
                    !(request.expires_at > Date.now() / 1000))
            ) {
                done({
                    data: {
                        error: "Provider request expired or the source changed.",
                    },
                    status: "rejected",
                });
                return;
            }
            cancelProviderRequest = executeRemoteRequest(
                request,
                done,
                afterReply
            );
        });
        return function () {
            pending = false;
            if (cancelProviderRequest) cancelProviderRequest();
        };
    }
    if (request.action === "torrent_indexer")
        return executeRemoteTorrentIndexer(w, request, done);
    if (request.action === "torrent_catalog")
        return executeRemoteTorrentCatalog(w, request, done);
    if (request.action === "favorites_transfer")
        return executeRemoteFavoritesTransfer(
            w,
            function () {
                return remotePlayerInfo(w).runtime;
            },
            request,
            done
        );
    if (request.action === "perf_capture")
        return executeRemotePerformance(w, request, done);
    if (request.action === "local_media")
        return executeRemoteLocalMedia(w, params, done, request.expires_at);
    if (
        [
            "player_settings",
            "player_settings_patch",
            "provider_settings",
            "settings_compare",
            "plex_folders",
            "playback_handoff_export",
            "playback_handoff_import",
            "notifications",
        ].indexOf(request.action) >= 0
    )
        return executeRemoteSettings(w, request, done, afterReply);
    if (request.action === "inspect" && w.__ottRemoteInspect)
        return w.__ottRemoteInspect.request(request, done);
    if (request.action === "favorites_global_items")
        return executeGlobalFavoritesItems(
            w,
            remotePlayerInfo(w).runtime,
            request,
            done
        );
    if (request.action === "favorites_global_recovery")
        return executeGlobalFavoritesRecovery(
            w,
            remotePlayerInfo(w).runtime,
            request,
            done
        );
    if (request.action === "favorites_global")
        return executeGlobalFavorites(
            w,
            remotePlayerInfo(w).runtime,
            request,
            done
        );
    if (request.action === "favorites")
        return executeRemoteFavorites(
            w,
            remotePlayerInfo(w).runtime,
            request,
            done
        );
    if (request.action === "plex_queue" || request.action === "plex_library")
        return remotePlexQueue(w, remotePlayerInfo(w).runtime).execute(
            request,
            done
        );
    if (
        w.__ottKiosk &&
        w.__ottKiosk.enabled() &&
        [
            "app_update",
            "status",
            "screenshot",
            "channels",
            "categories",
            "providers",
            "profiles",
            "settings_compare",
            "programs",
            "epg_catalog",
            "restart",
            "command",
            "capabilities",
            "lifecycle",
            "input",
            "playback",
            "aspect",
        ].indexOf(request.action) < 0
    ) {
        done({
            data: {
                error: "Kiosk mode is enabled. Use kiosk set CHANNEL or kiosk off.",
            },
            status: "rejected",
        });
        return;
    }
    function reply(data: any): void {
        done({ data: data, status: "ok" });
    }
    function reject(message: string, matches?: any[]): void {
        done({
            data: { error: message, matches: matches || [] },
            status: "rejected",
        });
    }
    function randomReply(
        ids: any[],
        include: (id: any) => boolean,
        current: () => boolean,
        media = false,
        group = -1
    ): void {
        var selected = randomChannels.play(
            w,
            ids,
            params.random,
            include,
            function (loadingOwner?: any) {
                return (
                    current() &&
                    !remoteMediaRestricted(w, false, loadingOwner) &&
                    (request.expires_at === undefined ||
                        request.expires_at > Date.now() / 1000)
                );
            },
            media,
            group
        );
        if (selected) reply({ channel: selected, dispatched: true });
        else
            reject(
                "No eligible channels are available, or playback is restricted by the player."
            );
    }
    function volume(): number | null {
        var value =
            typeof w.stbGetVolume === "function" ? w.stbGetVolume() : null;
        return typeof value === "number" &&
            isFinite(value) &&
            value >= 0 &&
            value <= 100
            ? value
            : null;
    }
    function activeProvider(): string {
        return w.__ottActiveProviderDriver
            ? w.__ottActiveProviderDriver.id
            : String(w.stbGetItem("ottplayprov") || "");
    }
    function channels(): any[] {
        var ids = w.cList || w.curList || [];
        var seen: Record<string, boolean> = Object.create(null);
        return ids
            .filter(function (id: any) {
                if (seen[String(id)] || !(w.channels || {})[id]) return false;
                seen[String(id)] = true;
                return true;
            })
            .map(function (id: any, index: number) {
                return {
                    id: id,
                    name: String(w.channels[id].channel_name || ""),
                    number: index + 1,
                };
            });
    }
    function includes(value: string, search: string): boolean {
        return !search || caselessKey(value).indexOf(search) !== -1;
    }
    function providers(): any[] {
        return providerIds
            .map(function (id, index) {
                return {
                    active: id === activeProvider(),
                    id: id,
                    index: index,
                    name: (providerLabels && providerLabels[index]) || id,
                };
            })
            .filter(function (row) {
                return row.id && isProviderAllowed(row.id);
            });
    }
    var modernChannels =
        request.action === "channels" &&
        ["runtime", "catalog", "category", "offset", "limit"].some(
            function (key) {
                return Object.prototype.hasOwnProperty.call(params, key);
            }
        );
    if (request.action === "categories" || modernChannels) {
        var runtime = remotePlayerInfo(w).runtime;
        var operation = modernChannels
            ? "channels"
            : params.op === "select"
              ? "select"
              : "list";
        var mediaFailure = function (error: string): void {
            done({
                data: {
                    error: error,
                    op: operation,
                    runtime:
                        typeof params.runtime === "string" &&
                        /^[a-z0-9-]{1,64}$/.test(params.runtime)
                            ? params.runtime
                            : runtime,
                    state: "error",
                    version: 1,
                },
                status: error === "unsupported" ? "unsupported" : "rejected",
            });
        };
        var listing = operation === "list";
        var selecting = operation === "select";
        var valid = modernChannels
            ? remoteMediaKeys(
                  params,
                  ["runtime", "catalog", "category", "offset", "limit"],
                  ["search"]
              )
            : selecting
              ? remoteMediaKeys(params, [
                    "op",
                    "runtime",
                    "catalog",
                    "category",
                ])
              : remoteMediaKeys(
                    params,
                    ["op", "runtime", "offset", "limit"],
                    ["catalog"]
                ) && params.op === "list";
        if (
            !valid ||
            typeof params.runtime !== "string" ||
            !/^[a-z0-9-]{1,64}$/.test(params.runtime) ||
            (!selecting &&
                (!remoteMediaInteger(params.offset, 1000000) ||
                    !remoteMediaInteger(params.limit, 200) ||
                    params.limit < 1)) ||
            ((params.catalog !== undefined ||
                selecting ||
                modernChannels ||
                params.offset > 0) &&
                (typeof params.catalog !== "string" ||
                    !/^[A-Za-z0-9_.:-]{1,128}$/.test(params.catalog))) ||
            (!listing && !remoteMediaText(params.category, 1024)) ||
            (params.search !== undefined &&
                (typeof params.search !== "string" ||
                    (params.search !== "" &&
                        !remoteMediaText(params.search, 1024))))
        ) {
            mediaFailure("invalid_request");
            return;
        }
        if (params.runtime !== runtime) {
            mediaFailure("runtime_mismatch");
            return;
        }
        if (activeProvider() !== "plex" && activeProvider() !== "vportal") {
            mediaFailure("unsupported");
            return;
        }
        if (remoteMediaIncomplete(w)) {
            remoteMediaPrune(null);
            mediaFailure("catalog_incomplete");
            return;
        }
        var mediaSnapshot = remoteMediaRead(w);
        if (!mediaSnapshot) {
            remoteMediaPrune(null);
            mediaFailure("unavailable");
            return;
        }
        var provider = activeProvider();
        var receipt =
            params.catalog === undefined
                ? null
                : remoteMediaFind(
                      params.catalog,
                      mediaSnapshot,
                      runtime,
                      provider
                  );
        if (params.catalog !== undefined && !receipt) {
            mediaFailure("catalog_changed");
            return;
        }
        if (receipt && listing && receipt.category !== undefined) {
            mediaFailure("catalog_changed");
            return;
        }
        var loading = false;
        try {
            loading = !!(
                w.__ottActiveProviderDriver &&
                typeof w.__ottActiveProviderDriver.catalogLoading ===
                    "function" &&
                w.__ottActiveProviderDriver.catalogLoading()
            );
        } catch (_) {
            mediaFailure("unavailable");
            return;
        }
        if (listing) {
            var categoryRows: any[] = [];
            var categorySeen: Record<string, boolean> = Object.create(null);
            var categoryValid = true;
            [
                {
                    id: "system:all",
                    members: mediaSnapshot.all,
                    name:
                        (
                            mediaSnapshot.groups.filter(function (group: any) {
                                return group.id === "system:all";
                            })[0] || {}
                        ).name || "All",
                },
            ]
                .concat(
                    mediaSnapshot.groups.filter(function (group: any) {
                        return group.id !== "system:all";
                    })
                )
                .forEach(function (group: any) {
                    var id =
                        typeof group.id === "string"
                            ? remoteMediaId(group.id)
                            : "";
                    var categoryName = remoteMediaCategoryName(group.name);
                    if (
                        !remoteMediaText(id, 1024) ||
                        categoryName === null ||
                        categorySeen[id] ||
                        !Array.isArray(group.members) ||
                        group.members.length > 1000000
                    ) {
                        categoryValid = false;
                        return;
                    }
                    categorySeen[id] = true;
                    categoryRows.push({
                        count: group.members.length,
                        id: id,
                        name: categoryName,
                    });
                });
            if (!categoryValid) {
                mediaFailure("unavailable");
                return;
            }
            if (params.offset > categoryRows.length) {
                mediaFailure("invalid_request");
                return;
            }
            var mediaSelected = remoteMediaSelected(w, mediaSnapshot);
            if (!receipt)
                receipt = remoteMediaReceipt(mediaSnapshot, runtime, provider);
            if (!remoteMediaRenew(w, receipt)) {
                mediaFailure("catalog_changed");
                return;
            }
            reply({
                catalog: receipt.token,
                categories: categoryRows.slice(
                    params.offset,
                    params.offset + params.limit
                ),
                has_more: params.offset + params.limit < categoryRows.length,
                loading: loading,
                offset: params.offset,
                op: "list",
                provider: provider,
                runtime: runtime,
                selected: mediaSelected,
                total: categoryRows.length,
                version: 1,
            });
            return;
        }
        var mediaGroup = remoteMediaGroup(mediaSnapshot, params.category);
        if (!mediaGroup) {
            mediaFailure("category_not_found");
            return;
        }
        if (selecting) {
            if (remoteMediaRestricted(w)) {
                mediaFailure("restricted");
                return;
            }
            if (
                !w.__ottChannels ||
                typeof w.__ottChannels.browse !== "function"
            ) {
                mediaFailure("unavailable");
                return;
            }
            try {
                if (
                    !mediaSnapshot.active() ||
                    w.__ottChannels.browse(
                        params.category === "all"
                            ? "system:all"
                            : params.category
                    ) !== true ||
                    remoteMediaSelected(w, mediaSnapshot) !== params.category
                ) {
                    mediaFailure("unavailable");
                    return;
                }
            } catch (_) {
                mediaFailure("unavailable");
                return;
            }
            reply({
                catalog: receipt.token,
                dispatched: true,
                op: "select",
                provider: provider,
                runtime: runtime,
                selected: params.category,
                version: 1,
            });
            return;
        }
        var mediaSearch = params.search || "";
        if (
            receipt.category !== undefined &&
            (receipt.category !== params.category ||
                receipt.search !== mediaSearch)
        ) {
            mediaFailure("catalog_changed");
            return;
        }
        var page = remoteMediaRows(
            w,
            mediaSnapshot,
            mediaGroup,
            mediaSearch,
            params.offset,
            params.limit
        );
        if (!page) {
            mediaFailure("unavailable");
            return;
        }
        if (params.offset > page.total) {
            mediaFailure("invalid_request");
            return;
        }
        if (receipt.category === undefined) {
            if (params.offset !== 0) {
                mediaFailure("catalog_changed");
                return;
            }
            receipt = remoteMediaReceipt(
                mediaSnapshot,
                runtime,
                provider,
                params.category,
                mediaSearch
            );
        }
        if (!remoteMediaRenew(w, receipt)) {
            mediaFailure("catalog_changed");
            return;
        }
        reply({
            catalog: receipt.token,
            category: params.category,
            channels: page.channels,
            has_more: params.offset + page.channels.length < page.total,
            loading: loading,
            offset: params.offset,
            runtime: runtime,
            total: page.total,
            version: 1,
        });
        return;
    }
    if (
        request.action === "play_catalog" &&
        typeof params.catalog === "string" &&
        params.catalog.indexOf("media-") === 0
    ) {
        if (remoteMediaIncomplete(w)) {
            remoteMediaPrune(null);
            reject(
                "The media catalogue scan failed. Reload the catalogue before playing."
            );
            return;
        }
        var playRuntime = remotePlayerInfo(w).runtime;
        var playSnapshot = remoteMediaRead(w);
        var playReceipt =
            playSnapshot &&
            remoteMediaFind(
                params.catalog,
                playSnapshot,
                playRuntime,
                activeProvider()
            );
        if (params.random !== undefined) {
            var randomGroup =
                playReceipt &&
                remoteMediaGroup(playSnapshot, playReceipt.category || "all");
            var driver = w.__ottActiveProviderDriver;
            if (
                !remoteMediaKeys(params, ["catalog", "random"]) ||
                !randomChannels.valid(params.random) ||
                !randomGroup ||
                w.commandChannelsReady !== true ||
                !remoteMediaRows(w, playSnapshot, randomGroup, "", 0, 0) ||
                (driver &&
                    typeof driver.catalogLoading === "function" &&
                    driver.catalogLoading())
            ) {
                reject(
                    "The complete random-selection catalogue is unavailable."
                );
                return;
            }
            var randomMembers: Record<string, boolean> = Object.create(null);
            randomGroup.members.forEach(function (id: any) {
                randomMembers[String(id)] = true;
            });
            var boundSearch = caselessKey(playReceipt.search || "");
            randomReply(
                playSnapshot.canonicalIds,
                function (id) {
                    return (
                        !!randomMembers[String(id)] &&
                        includes(
                            String(
                                (w.channels[id] &&
                                    w.channels[id].channel_name) ||
                                    ""
                            ),
                            boundSearch
                        )
                    );
                },
                function () {
                    return (
                        playSnapshot.active() &&
                        playReceipt.expires > Date.now() &&
                        !!remoteMediaRows(
                            w,
                            playSnapshot,
                            randomGroup,
                            "",
                            0,
                            0
                        ) &&
                        playReceipt.runtime === remotePlayerInfo(w).runtime &&
                        w.__ottActiveProviderDriver === driver &&
                        !remoteMediaIncomplete(w) &&
                        !(
                            driver &&
                            typeof driver.catalogLoading === "function" &&
                            driver.catalogLoading()
                        )
                    );
                },
                true,
                w.__ottChannels.index(
                    playReceipt.category && playReceipt.category !== "all"
                        ? playReceipt.category
                        : "system:all"
                )
            );
            return;
        }
        if (
            !remoteMediaKeys(params, ["catalog", "id"]) ||
            !remoteMediaText(params.id, 2048) ||
            !playReceipt ||
            playReceipt.category === undefined ||
            !playSnapshot.active()
        ) {
            reject(
                "Media catalogue changed. List the category again before playing."
            );
            return;
        }
        if (remoteMediaRestricted(w)) {
            reject("Media playback is restricted by the player.");
            return;
        }
        if (w.commandChannelsReady !== true) {
            reject("Media catalogue is unavailable.");
            return;
        }
        var playGroup = remoteMediaGroup(playSnapshot, playReceipt.category);
        var playPage =
            playGroup &&
            remoteMediaRows(
                w,
                playSnapshot,
                playGroup,
                playReceipt.search,
                0,
                0,
                params.id
            );
        if (!playPage || !playPage.selected) {
            reject("The selected media item is no longer available.");
            return;
        }
        var groupIndex = w.__ottChannels.index(
            playReceipt.category === "all" ? "system:all" : playReceipt.category
        );
        var members = groupIndex >= 0 && w.cats[w.catsArray[groupIndex]];
        var memberIndex = Array.isArray(members)
            ? members.map(String).indexOf(String(playPage.selected.key))
            : -1;
        if (
            memberIndex < 0 ||
            typeof w.playChannel !== "function" ||
            !playSnapshot.active()
        ) {
            reject("The selected media item is no longer available.");
            return;
        }
        if (w.playChannel(groupIndex, memberIndex, true) === false) {
            reject("Playback was rejected by the player.");
            return;
        }
        reply({ channel: playPage.selected.row, dispatched: true });
        return;
    }
    if (
        request.action === "profile_save" ||
        request.action === "profile_export" ||
        request.action === "profile_import" ||
        request.action === "profiles" ||
        request.action === "profile" ||
        request.action === "profile_settings"
    ) {
        handleRemoteProfiles(request, done);
        return;
    }
    if (request.action === "app_update") {
        return executeRemoteAppUpdate(w, params, done, afterReply);
    }
    if (request.action === "screenshot") {
        return executeRemoteScreenshot(w, params, done);
    }
    if (request.action === "restart") {
        executeRemoteRestart(w, params, done, afterReply);
        return;
    }
    if (
        ["capabilities", "lifecycle", "input", "playback", "aspect"].indexOf(
            request.action
        ) >= 0
    ) {
        var controlCancelled = false;
        var controlRuntime = remotePlayerInfo(w).runtime;
        var controlDeadline =
            request.expires_at === undefined
                ? Infinity
                : Math.floor(request.expires_at * 1000);
        var controlCurrent = function (): boolean {
            return (
                !controlCancelled &&
                remotePlayerInfo(w).runtime === controlRuntime &&
                Date.now() < controlDeadline
            );
        };
        var cancelCapability: (() => void) | undefined;
        var cancelControl = executeRemoteControl(
            w,
            request.action,
            params,
            request.action === "capabilities"
                ? function (result: any) {
                      if (controlCancelled) return;
                      if (!controlCurrent()) {
                          done(result);
                          return;
                      }
                      if (result.status === "ok" && result.data)
                          result.data.notifications = {
                              operations: ["get", "set"],
                              version: 1,
                          };
                      if (result.status === "ok" && result.data)
                          result.data.random = { version: 1 };
                      if (
                          result.status === "ok" &&
                          result.data &&
                          (activeProvider() === "plex" ||
                              activeProvider() === "vportal") &&
                          w.__ottChannels &&
                          typeof w.__ottChannels.remoteCatalog === "function" &&
                          typeof w.__ottChannels.browse === "function"
                      ) {
                          result.data.categories = {
                              maxPageSize: 200,
                              operations: ["list", "select"],
                              version: 1,
                          };
                      }
                      if (result.status === "ok" && result.data)
                          cancelCapability = remoteFavoritesTransferCapability(
                              w,
                              function () {
                                  return remotePlayerInfo(w).runtime;
                              },
                              function (capability, recoveryCapability) {
                                  if (controlCancelled) return;
                                  if (!controlCurrent()) {
                                      done(result);
                                      return;
                                  }
                                  var globalFavorites =
                                      globalFavoritesCapability(w);
                                  if (globalFavorites)
                                      result.data.favorites_global =
                                          globalFavorites;
                                  var globalItems =
                                      globalFavoritesItemsCapability(w);
                                  if (globalItems)
                                      result.data.favorites_global_items =
                                          globalItems;
                                  var globalRecovery =
                                      globalFavoritesRecoveryCapability(w);
                                  if (globalRecovery)
                                      result.data.favorites_global_recovery =
                                          globalRecovery;
                                  result.data.favorites =
                                      legacyFavoritesCapability(w);
                                  if (capability)
                                      result.data.favorites_transfer =
                                          capability;
                                  if (recoveryCapability)
                                      result.data.favorites_transfer_recovery =
                                          recoveryCapability;
                                  done(result);
                              },
                              request.expires_at
                          );
                      else done(result);
                  }
                : done,
            afterReply,
            request.expires_at
        );
        if (request.action !== "capabilities") return cancelControl;
        return function () {
            controlCancelled = true;
            if (cancelControl) cancelControl();
            if (cancelCapability) cancelCapability();
        };
    }
    if (request.action === "status") {
        var player = remotePlayerInfo(w);
        // Capture the established provider schema before consulting other producers.
        var providerDiagnostics = providerDiagnosticsSnapshot(
            w,
            player.runtime
        );
        var statusResult: any = {
            channels: channels().length,
            playback: readPlayerState(w, player).playback,
            player: player,
            ...(w.__ottKiosk ? { kiosk: w.__ottKiosk.snapshot() } : {}),
            diagnostics: {
                companion: companionDiagnosticsSnapshot(w, player.runtime),
                epg: remoteSnapshot(
                    w.__ottHostedEpg && w.__ottHostedEpg.remoteSnapshot
                ),
                input: remoteSnapshot(w.__ottDebugInputSnapshot),
                provider: providerDiagnostics,
                version: 1,
            },
            provider: activeProvider(),
            ready: w.commandChannelsReady === true,
            uuid: w.deviceUUID || "",
            volume: volume(),
        };
        if (typeof w.__ottLocalSourceDiagnostics === "function") {
            return w.__ottLocalSourceDiagnostics(
                w,
                function () {
                    return remotePlayerInfo(w).runtime;
                },
                statusResult,
                reply
            );
        }
        reply(statusResult);
        return;
    }
    if (request.action === "providers") {
        reply({ providers: providers() });
        return;
    }
    if (
        request.action === "vportal" ||
        request.action === "vportal_search" ||
        request.action === "vportal_random"
    ) {
        var randomQueue = request.action === "vportal_random";
        var queryText =
            typeof params.query === "string" ? params.query.trim() : "";
        try {
            if (
                Object.keys(params).length !== 1 ||
                !queryText ||
                encodeURIComponent(queryText).replace(/%[0-9A-F]{2}/g, "x")
                    .length > 1024
            )
                throw new Error();
        } catch (_) {
            reject("Use a VPortal title filter of 1 to 1024 UTF-8 bytes.");
            return;
        }
        var media = w.__ottMedia;
        var client = w.providerMediaClient;
        var playback = w.__ottClassicPlayback;
        if (
            !media ||
            !playback ||
            !client ||
            typeof client.search !== "function" ||
            typeof client.resolve !== "function" ||
            typeof media.playQueue !== "function" ||
            typeof media.captureAuto !== "function" ||
            typeof media.sourceId !== "function" ||
            typeof playback.snapshot !== "function" ||
            typeof w._playMedia !== "function"
        ) {
            done({
                data: {
                    error: "Configure VPortal on a player that supports remote media queues.",
                },
                status: "unsupported",
            });
            return;
        }
        var mediaSource = media.sourceId();
        // Establish the legacy transport's current generation before guarding
        // asynchronous search; the eventual VOD handoff reconciles it too.
        if (typeof playback.reconcile === "function") playback.reconcile();
        var playbackGeneration = playback.snapshot().generation;
        var searchCurrent = media.captureAuto();
        var collecting = true;
        var complete = false;
        var cancelSearch: (() => void) | void;
        var cancelStart: (() => void) | void;
        var mediaCurrent = function (): boolean {
            return (
                !complete &&
                (!collecting || searchCurrent()) &&
                w.providerMediaClient === client &&
                media.sourceId() === mediaSource &&
                playback.snapshot().generation === playbackGeneration
            );
        };
        var cancelMediaRequest = function (): void {
            if (complete) return;
            complete = true;
            w.clearTimeout(mediaTimer);
            if (cancelSearch) cancelSearch();
            if (cancelStart) cancelStart();
        };
        var finishMedia = function (data: any, error?: string): void {
            if (complete) return;
            cancelMediaRequest();
            if (error) reject(error);
            else reply(data);
        };
        var mediaTimer = w.setTimeout(function () {
            finishMedia(null, "VPortal search or playback did not complete.");
        }, 35000);
        cancelSearch = client.search(
            queryText,
            function (result: any) {
                if (!mediaCurrent()) return;
                if (!result || result.error || !Array.isArray(result.items)) {
                    finishMedia(
                        null,
                        "Could not load the complete VPortal search results."
                    );
                    return;
                }
                var records = result.items;
                if (randomQueue) {
                    // Shuffle once; the queue repeats this complete permutation.
                    // Provider-owned results keep their original catalogue order.
                    records = records.slice();
                    for (
                        var shuffleIndex = records.length - 1;
                        shuffleIndex > 0;
                        shuffleIndex--
                    ) {
                        var selectedIndex = Math.floor(
                            Math.random() * (shuffleIndex + 1)
                        );
                        var shuffledRecord = records[shuffleIndex];
                        records[shuffleIndex] = records[selectedIndex];
                        records[selectedIndex] = shuffledRecord;
                    }
                }
                var data: any = {
                    items: records.map(function (item: any, index: number) {
                        return {
                            number: index + 1,
                            title: String(item.title || ""),
                        };
                    }),
                    total: records.length,
                };
                // Bound metadata before dispatch so a huge provider title cannot
                // turn a successful playback change into an unreadable receipt.
                if (JSON.stringify(data).length > 500000) {
                    finishMedia(
                        null,
                        "VPortal results are too large. Use a more specific title filter."
                    );
                    return;
                }
                if (request.action === "vportal_search") {
                    finishMedia(data);
                    return;
                }
                if (!records.length) {
                    finishMedia(null, "No matching VPortal titles found.");
                    return;
                }
                if (
                    w.sPSchannels &&
                    w.parentPIN !== "*" &&
                    !w.parentAccess &&
                    records.some(function (item: any) {
                        return Number(item.adult) === 1;
                    })
                ) {
                    finishMedia(
                        null,
                        "Unlock parental access on the player before starting this queue."
                    );
                    return;
                }
                // The queue takes over automatic cancellation from the search.
                collecting = false;
                cancelStart = media.playQueue(
                    records,
                    queryText,
                    mediaCurrent,
                    function () {
                        data.dispatched = true;
                        data.loop = true;
                        if (randomQueue) data.shuffled = true;
                        finishMedia(data);
                    }
                );
            },
            mediaCurrent
        );
        if (complete && cancelSearch) cancelSearch();
        return cancelMediaRequest;
    }
    if (request.action === "provider") {
        var query = String(params.query).toLowerCase();
        if (query === "local") query = "offline";
        var providerSearch = caselessKey(query);
        var all = providers();
        var found = all.filter(function (row) {
            return (
                row.id.toLowerCase() === query || String(row.index) === query
            );
        });
        if (!found.length)
            found = all.filter(function (row) {
                return includes(row.name, providerSearch);
            });
        if (found.length !== 1) {
            reject("Choose one provider by ID or index.", found);
            return;
        }
        if (!selectProviderByIndex(found[0].index)) {
            reject(
                "Provider switch rejected; check parental access and platform policy."
            );
            return;
        }
        reply({ dispatched: true, provider: found[0].id });
        return;
    }
    if (request.action === "command") {
        if (params.command === "exit_player") {
            if (Object.keys(params).length !== 1) {
                reject("Exit accepts no additional parameters.");
                return;
            }
            executeRemoteControl(
                w,
                "lifecycle",
                { operation: "exit_app" },
                done,
                afterReply
            );
            return;
        }
        var outcome = handleCommand(params);
        if (outcome !== "accepted") {
            reject(
                "Command " + outcome + ". Check the player state and settings."
            );
            return;
        }
        reply({
            dispatched: true,
            volume: params.command === "set_volume" ? volume() : undefined,
        });
        return;
    }
    if (w.commandChannelsReady !== true) {
        reject("Channels are still loading. Try again shortly.");
        return;
    }
    var rows = channels();
    if (
        request.action === "epg_catalog" ||
        request.action === "play_catalog" ||
        request.action === "resolve_archive" ||
        request.action === "play_archive_catalog"
    ) {
        var identity = w.__ottSourceIdentity;
        if (!identity || typeof identity.current !== "function") {
            done({
                data: {
                    error: "Update the player for server EPG queries.",
                },
                status: "unsupported",
            });
            return;
        }
        var catalogSource = identity.current(w);
        var catalogLoad = w.__ottCommandChannelLoad;
        // Provider-internal IDs can collide with unrelated public XMLTV IDs.
        var xmltvMetadata = activeProvider() === "m3u";
        var metadata: any[];
        var catalogSignature: string;
        try {
            if (rows.length > 10000) throw new Error();
            metadata = rows.map(function (row: any) {
                var channel = w.channels[row.id];
                var shift = Number(channel.ts) || 0;
                var entry = {
                    archiveHours: Math.min(
                        144,
                        Math.max(0, Math.floor(Number(channel.rec) || 0))
                    ),
                    id: String(row.id),
                    name: row.name,
                    number: row.number,
                    shift: shift,
                    tvgId: xmltvMetadata ? String(channel.epg || "") : "",
                    tvgName: xmltvMetadata ? String(channel.tn || "") : "",
                };
                if (
                    !entry.id ||
                    !isFinite(shift) ||
                    Math.floor(shift) !== shift ||
                    Math.abs(shift) > 86400 ||
                    [entry.id, entry.name, entry.tvgId, entry.tvgName].some(
                        function (value) {
                            return value.length > 512;
                        }
                    )
                )
                    throw new Error();
                return entry;
            });
            catalogSignature = JSON.stringify(metadata);
            // Leave room for the response envelope under the controller's 2 MiB limit.
            if (
                encodeURIComponent(catalogSignature).replace(
                    /%[A-F\d]{2}/g,
                    "x"
                ).length > 1800000
            )
                throw new Error();
        } catch (_) {
            reject("Channel metadata exceeds the server EPG limits.");
            return;
        }
        var catalogCurrent = function (): boolean {
            return (
                w.commandChannelsReady === true &&
                catalogLoad === w.__ottCommandChannelLoad &&
                catalogSource === identity.current(w)
            );
        };
        var receiptCurrent = function (): boolean {
            return (
                catalogCurrent() &&
                remoteEpgCatalog &&
                remoteEpgCatalog.source === catalogSource &&
                remoteEpgCatalog.load === catalogLoad &&
                remoteEpgCatalog.signature === catalogSignature &&
                remoteEpgCatalog.expires > Date.now()
            );
        };
        if (request.action === "epg_catalog") {
            if (Object.keys(params).length || !catalogCurrent()) {
                reject("Channels or provider changed. Retry the EPG query.");
                return;
            }
            if (!receiptCurrent()) {
                var revision =
                    remoteEpgCatalog &&
                    remoteEpgCatalog.source === catalogSource &&
                    remoteEpgCatalog.load === catalogLoad &&
                    remoteEpgCatalog.signature === catalogSignature
                        ? remoteEpgCatalog.revision
                        : Date.now().toString(36) +
                          "-" +
                          Math.random().toString(36).slice(2);
                remoteEpgCatalog = {
                    load: catalogLoad,
                    revision: revision,
                    signature: catalogSignature,
                    source: catalogSource,
                    token:
                        Date.now().toString(36) +
                        "-" +
                        Math.random().toString(36).slice(2),
                };
            }
            // A successful read grants a full lease for subsequent playback.
            remoteEpgCatalog.expires = Date.now() + 120000;
            reply({
                archive: {
                    revision: remoteEpgCatalog.revision,
                    version: 1,
                },
                catalog: remoteEpgCatalog.token,
                channels: metadata,
            });
            return;
        }
        if (request.action === "play_catalog" && params.random !== undefined) {
            if (
                !remoteMediaKeys(params, ["catalog", "random"]) ||
                !randomChannels.valid(params.random) ||
                !receiptCurrent() ||
                params.catalog !== remoteEpgCatalog.token
            ) {
                reject(
                    "Channels or provider changed. Retry the random selection."
                );
                return;
            }
            randomReply(
                rows.map(function (row) {
                    return row.id;
                }),
                function () {
                    return true;
                },
                receiptCurrent,
                false,
                w.__ottChannels ? w.__ottChannels.index("system:all") : -1
            );
            return;
        }
        if (
            Object.keys(params).length !==
                (request.action === "play_catalog" ? 2 : 5) ||
            typeof params.catalog !== "string" ||
            typeof params.id !== "string" ||
            !receiptCurrent() ||
            params.catalog !== remoteEpgCatalog.token
        ) {
            reject(
                "Channels or provider changed. Retry the EPG query before playing."
            );
            return;
        }
        var selected = rows.filter(function (row: any) {
            return String(row.id) === params.id;
        });
        if (selected.length !== 1) {
            reject("The selected EPG channel is no longer available.");
            return;
        }
        selected[0].id = params.id;
        if (request.action !== "play_catalog") {
            handleRemoteArchive(
                w,
                request,
                selected[0],
                receiptCurrent,
                reply,
                reject
            );
            return;
        }
        // Reuse channel admission/category handling, after binding the request to
        // the exact ordered catalogue that the remote EPG result described.
        request = {
            action: "play",
            params: { query: String(selected[0].number) },
        };
        params = request.params;
    }
    if (request.action === "channels") {
        var channelSearch = caselessKey(String(params.search || ""));
        reply({
            channels: rows.filter(function (row) {
                return includes(row.name, channelSearch);
            }),
        });
        return;
    }
    if (request.action === "play") {
        var text = String(params.query).trim();
        var playSearch = caselessKey(text);
        var matches = /^\d+$/.test(text)
            ? rows.filter(function (row) {
                  return row.number === Number(text);
              })
            : rows.filter(function (row) {
                  return caselessKey(row.name) === playSearch;
              });
        if (!matches.length && !/^\d+$/.test(text))
            matches = rows.filter(function (row) {
                return includes(row.name, playSearch);
            });
        if (matches.length !== 1) {
            reject(
                matches.length
                    ? "Several channels match. Use a channel number."
                    : "Channel not found.",
                matches
            );
            return;
        }
        var categoryOrder = (w.catsArray || []).map(function (
            _value: any,
            index: number
        ) {
            return index;
        });
        var numericSnapshot = /^\d+$/.test(text) && remoteMediaRead(w);
        if (numericSnapshot) {
            var browsed = remoteMediaSelected(w, numericSnapshot);
            var preferred = w.__ottChannels.index(
                browsed === "all" ? "system:all" : browsed
            );
            if (preferred >= 0)
                categoryOrder = [preferred].concat(
                    categoryOrder.filter(function (index: number) {
                        return index !== preferred;
                    })
                );
        }
        for (var position = 0; position < categoryOrder.length; position++) {
            var c = categoryOrder[position];
            var list = w.cats[w.catsArray[c]] || [];
            for (var i = 0; i < list.length; i++) {
                if (String(list[i]) === String(matches[0].id)) {
                    if (typeof w.playChannel !== "function") {
                        reject("Playback is unavailable.");
                        return;
                    }
                    if (w.playChannel(c, i, true) === false) {
                        reject("Playback was rejected by the player.");
                        return;
                    }
                    reply({ channel: matches[0], dispatched: true });
                    return;
                }
            }
        }
        reject("Channel is unavailable in the current categories.");
        return;
    }
    if (request.action !== "programs") {
        done({
            data: { error: "Unsupported request." },
            status: "unsupported",
        });
        return;
    }
    var guide = w.__ottClassicGuide;
    if (!guide) {
        done({
            data: { error: "This player has no EPG query service." },
            status: "unsupported",
        });
        return;
    }
    var source = guide.source();
    var channelLoad = w.__ottCommandChannelLoad;
    var asOf = Date.now() / 1000;
    var programSearch = caselessKey(String(params.search || ""));
    var programs: any[] = [];
    var position = 0,
        running = 0,
        checked = 0;
    var stopped = false;
    var pumpTimer: any = null;
    var cancels: Array<() => void> = [];
    function cancel(): void {
        stopped = true;
        w.clearTimeout(timer);
        w.clearTimeout(pumpTimer);
        pumpTimer = null;
        cancels.forEach(function (fn) {
            fn();
        });
    }
    function changed(): boolean {
        return (
            source !== guide.source() ||
            channelLoad !== w.__ottCommandChannelLoad ||
            w.commandChannelsReady !== true
        );
    }
    function finish(): void {
        if (stopped) return;
        var stale = changed();
        cancel();
        if (stale || changed()) {
            reject("Channels or provider changed while reading EPG. Retry.");
            return;
        }
        reply({
            as_of: asOf,
            checked: checked,
            partial: checked < rows.length,
            programs: programs.sort(function (a, b) {
                return a.number - b.number;
            }),
            total: rows.length,
        });
    }
    var timer = w.setTimeout(finish, 25000);
    function consume(row: any, entries: any): void {
        checked++;
        if (!entries || !entries.length) return;
        var current = w.OttPlayCore.guideScheduleSelection(
            entries.map(function (entry: any) {
                return {
                    end: entry.time_to,
                    row: entry,
                    start: entry.time,
                };
            }),
            asOf,
            0
        ).current;
        if (!current || !current.row.name) return;
        var entry = current.row;
        if (includes(String(entry.name), programSearch))
            programs.push({
                channel: row.name,
                end: entry.time_to,
                number: row.number,
                start: entry.time,
                title: String(entry.name),
            });
    }
    function schedulePump(): void {
        if (stopped || pumpTimer !== null) return;
        pumpTimer = w.setTimeout(function () {
            pumpTimer = null;
            pump();
        }, 0);
    }
    // Yield between batches even when cached callbacks complete synchronously.
    function pump(): void {
        if (stopped) return;
        if (changed()) {
            finish();
            return;
        }
        var batch = 0;
        while (
            !stopped &&
            running < 4 &&
            position < rows.length &&
            batch++ < 64
        ) {
            (function (row) {
                var cached = guide.peek(row.id);
                if (cached && cached.length) {
                    consume(row, cached);
                    return;
                }
                running++;
                var completed = false;
                var release = guide.request(
                    row.id,
                    function (_id: any, entries: any) {
                        if (completed || stopped) return;
                        completed = true;
                        running--;
                        consume(row, entries);
                        schedulePump();
                    }
                );
                cancels.push(release);
            })(rows[position++]);
        }
        if (!running && position === rows.length) finish();
        else if (running < 4 && position < rows.length) schedulePump();
    }
    pump();
    return cancel;
}
