import {
    isProviderAllowed,
    providerIds,
    selectProviderByIndex,
} from "../provider";
import { captureFavoritesPhysicalStorage } from "../storage/index";
import { caselessKey } from "../utils/caseless";
import { metadataText } from "../utils/helpers";
import {
    captureLegacyCurrentFavorite,
    executeLegacyFavoriteTarget,
} from "./remote-favorites";
import { loadRemoteFeature } from "./remote-feature";
import {
    handleRemoteProfiles,
    selectGlobalMediaProfile,
} from "./remote-profiles";
import { remoteCheckpoint, remotePlayerInfo } from "./remote-restart";

var globalFavoriteIntent = 0;
/** Called only after the fixed optional bundle exists; constructing this facade writes nothing. */
export function initializeGlobalFavorites(): any {
    var w = window as any,
        runtime = remotePlayerInfo(w).runtime;
    if (!w.__ottGlobalFavoritesFactory) return null;
    if (
        w.__ottGlobalFavorites &&
        (w.__ottGlobalFavoritesRuntime !== runtime ||
            !w.__ottGlobalFavorites.facade.current())
    ) {
        w.__ottGlobalFavorites.dispose();
        w.__ottGlobalFavorites = null;
        w.__ottGlobalFavoritesFacade = null;
        w.__ottGlobalFavoritesPorts = null;
        w.__ottGlobalFavoritesProtocol = null;
        w.__ottGlobalFavoritesRecovery = null;
    }
    if (w.__ottGlobalFavorites) return w.__ottGlobalFavorites;
    function writable(): boolean {
        return (
            !w.__ottStandby?.blocked() &&
            !w.__ottKiosk?.enabled() &&
            !w.__ottParental?.needs("providers") &&
            !w.__ottParental?.needs("settings")
        );
    }
    var ports: any = {
        capture: captureFavoritesPhysicalStorage,
        captureLegacy: function () {
            return Promise.resolve(captureLegacyCurrentFavorite(w));
        },
        caselessKey: caselessKey,
        current: function () {
            return runtime === remotePlayerInfo(w).runtime;
        },
        favoriteRemoved: function (title: string) {
            if (runtime === remotePlayerInfo(w).runtime)
                w.showShift(w._("Favorites") + ": − " + metadataText(title));
        },
        favoriteToggled: function (title: string, added: boolean) {
            if (runtime === remotePlayerInfo(w).runtime)
                w.showShift(
                    w._("Favorites") +
                        ": " +
                        (added ? "+ " : "− ") +
                        metadataText(title)
                );
        },
        handleRemoteProfiles: handleRemoteProfiles,
        isProviderAllowed: isProviderAllowed,
        now: Date.now,
        playLegacy: function (entry: any, admission: () => boolean) {
            var cancel: any;
            var result = new Promise(function (done, reject) {
                if (!admission()) {
                    reject(new Error("context_changed"));
                    return;
                }
                cancel = executeLegacyFavoriteTarget(
                    w,
                    runtime,
                    {
                        action: "favorites",
                        expires_at: (Date.now() + 30000) / 1000,
                        params: { id: entry.id, op: "play", runtime: runtime },
                    },
                    done,
                    entry
                );
            });
            return {
                cancel: function () {
                    if (cancel) cancel();
                },
                result: result,
            };
        },
        providerIds: function () {
            return providerIds;
        },
        remoteCheckpoint: remoteCheckpoint,
        selectMediaProfile: selectGlobalMediaProfile,
        selectProviderByIndex: selectProviderByIndex,
        sha256: async function (text: string | Uint8Array) {
            var bytes: Uint8Array;
            if (typeof text === "string") {
                var encoded = unescape(encodeURIComponent(text));
                bytes = new Uint8Array(encoded.length);
                for (var i = 0; i < encoded.length; i++)
                    bytes[i] = encoded.charCodeAt(i);
            } else bytes = text;
            var digest = new Uint8Array(
                await w.crypto.subtle.digest("SHA-256", bytes)
            );
            return Array.prototype.map
                .call(digest, function (value: number) {
                    return ("0" + value.toString(16)).slice(-2);
                })
                .join("");
        },
        uuid: function () {
            if (!w.crypto?.getRandomValues) throw new Error("Unavailable");
            var bytes = new Uint8Array(16);
            w.crypto.getRandomValues(bytes);
            bytes[6] = (bytes[6] & 15) | 64;
            bytes[8] = (bytes[8] & 63) | 128;
            var hex = Array.prototype.map
                .call(bytes, function (value: number) {
                    return ("0" + value.toString(16)).slice(-2);
                })
                .join("");
            return (
                hex.slice(0, 8) +
                "-" +
                hex.slice(8, 12) +
                "-" +
                hex.slice(12, 16) +
                "-" +
                hex.slice(16, 20) +
                "-" +
                hex.slice(20)
            );
        },
    };
    ports.runtime = function () {
        return remotePlayerInfo(w).runtime;
    };
    ports.authorized = function (op: string) {
        return (
            [
                "describe",
                "export",
                "status",
                "abort",
                "list",
                "current",
                "inspect",
            ].indexOf(op) >= 0 || writable()
        );
    };
    ports.base64Encode = function (bytes: Uint8Array) {
        var text = "";
        for (var i = 0; i < bytes.length; i++)
            text += String.fromCharCode(bytes[i]);
        return w.btoa(text);
    };
    ports.base64Decode = function (text: string) {
        var value = w.atob(text),
            bytes = new Uint8Array(value.length);
        for (var i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i);
        return bytes;
    };
    var host = w.__ottGlobalFavoritesFactory.create(w, ports);
    if (!host.facade.current()) {
        host.dispose();
        return null;
    }
    w.__ottGlobalFavorites = host;
    w.__ottGlobalFavoritesRuntime = runtime;
    w.__ottGlobalFavoritesFacade = host.facade;
    w.__ottGlobalFavoritesProtocol = host.protocol;
    w.__ottGlobalFavoritesRecovery = host.recovery;
    w.__ottGlobalFavoritesPorts = {
        authorized: function (op: string) {
            return (
                [
                    "describe",
                    "export",
                    "status",
                    "abort",
                    "list",
                    "current",
                    "inspect",
                ].indexOf(op) >= 0 || writable()
            );
        },
        base64Decode: function (text: string) {
            var value = w.atob(text),
                bytes = new Uint8Array(value.length);
            for (var i = 0; i < value.length; i++)
                bytes[i] = value.charCodeAt(i);
            return bytes;
        },
        base64Encode: function (bytes: Uint8Array) {
            var text = "";
            for (var i = 0; i < bytes.length; i++)
                text += String.fromCharCode(bytes[i]);
            return w.btoa(text);
        },
        codec: host.codec,
        locatorKinds: [
            "channel",
            "channel-name",
            "local-media",
            "plex-media",
            "vportal-media",
        ],
        runtime: function () {
            return remotePlayerInfo(w).runtime;
        },
        sha256: ports.sha256,
        uuid: ports.uuid,
    };
    return host;
}
/** Fixed optional loader only; cancellation prevents late session initialization. */
export function ensureGlobalFavorites(
    done: (error?: string) => void
): () => void {
    var w = window as any,
        active = true,
        runtime = remotePlayerInfo(w).runtime;
    function ready(error?: string): void {
        if (!active || runtime !== remotePlayerInfo(w).runtime) return;
        active = false;
        var host: any = null;
        try {
            if (!error) host = initializeGlobalFavorites();
        } catch (_) {}
        done(host ? undefined : "unsupported");
    }
    if (w.__ottGlobalFavoritesFactory) ready();
    else
        loadRemoteFeature(w, "favorites-transfer", ready, "favorites-recovery");
    return function () {
        active = false;
    };
}
function globalFavoriteAction(
    action: "open" | "toggle" | "add" | "remove",
    payload?: any,
    current?: () => boolean
): boolean {
    // Unqualified backends keep the existing per-source UI; no global write or capability is claimed.
    if (!captureFavoritesPhysicalStorage()) return false;
    var w = window as any,
        intent = ++globalFavoriteIntent;
    if (action === "open")
        payload = {
            rememberCategory: w.__ottChannels?.captureCategorySelection?.(),
        };
    var driver = w.__ottActiveProviderDriver,
        load = w.__ottCommandChannelLoad;
    var generation = w.__ottClassicPlayback?.snapshot().generation,
        handler = w.listKeyHandlerFn;
    function admitted(): boolean {
        return (
            intent === globalFavoriteIntent &&
            (!current || current()) &&
            !w.__ottStandby?.blocked() &&
            !w.__ottKiosk?.enabled() &&
            !w.__ottParental?.needs("providers") &&
            !w.__ottParental?.needs("settings") &&
            (action === "open"
                ? handler === w.listKeyHandlerFn
                : driver === w.__ottActiveProviderDriver &&
                  load === w.__ottCommandChannelLoad &&
                  generation === w.__ottClassicPlayback?.snapshot().generation)
        );
    }
    function error(): void {
        if (admitted())
            w.showShift(w._("Favorites") + ": " + w._("Unavailable"));
    }
    function ready(failure?: string): void {
        if (!admitted()) return;
        try {
            var host = !failure && initializeGlobalFavorites();
            if (!host) {
                error();
                return;
            }
            if (admitted())
                Promise.resolve(host[action](payload, admitted)).catch(error);
        } catch (_) {
            error();
        }
    }
    if (!admitted()) return true;
    if (w.__ottGlobalFavoritesFactory) ready();
    else loadRemoteFeature(w, "favorites-transfer", ready);
    return true;
}
export function openGlobalFavorites(): boolean {
    return globalFavoriteAction("open");
}
export function toggleGlobalFavorite(
    payload?: any,
    current?: () => boolean
): boolean {
    return globalFavoriteAction("toggle", payload, current);
}
/** Explicit menu intent; repeating add/remove cannot invert membership. */
export function setGlobalFavorite(
    payload: any,
    present: boolean,
    current?: () => boolean
): boolean {
    return globalFavoriteAction(present ? "add" : "remove", payload, current);
}
/** Capture the exact TV row and keep PIN/source ownership through persistence. */
export function setGlobalChannelFavorite(
    channelId: any,
    present: boolean
): boolean {
    if (!captureFavoritesPhysicalStorage()) return false;
    var w = window as any,
        channels = w.channels,
        channel = channels && channels[channelId];
    if (!channel || w.sFavorites === -1) return true;
    if (!channel.__ottMediaItem) {
        var numeric = Number(channelId);
        if (
            String(numeric) !== String(channelId) ||
            !isFinite(numeric) ||
            Math.floor(numeric) !== numeric ||
            Math.abs(numeric) > 9007199254740991
        )
            return true;
        channelId = numeric;
    }
    var source = w.__ottSourceIdentity.current(w),
        driver = w.__ottActiveProviderDriver,
        load = w.__ottCommandChannelLoad,
        list = w.listArray,
        index = w.selIndex;
    function current(): boolean {
        return (
            channels === w.channels &&
            channel === channels[channelId] &&
            source === w.__ottSourceIdentity.current(w) &&
            driver === w.__ottActiveProviderDriver &&
            load === w.__ottCommandChannelLoad &&
            list === w.listArray &&
            index === w.selIndex &&
            w.sFavorites !== -1 &&
            !(
                w.hasParentalLock?.(channelId) &&
                (!w.__ottParental || w.__ottParental.needs("channels"))
            )
        );
    }
    if (!current()) return true;
    if (
        !setGlobalFavorite(
            channel.__ottMediaItem || { __ottGlobalChannel: channelId },
            present,
            current
        ) &&
        current()
    )
        w.showShift(w._("Favorites") + ": " + w._("Unavailable"));
    // A qualified global intent never falls back after backend loss.
    return true;
}
(window as any).setGlobalFavorite = setGlobalFavorite;
(window as any).setGlobalChannelFavorite = setGlobalChannelFavorite;
(window as any).openGlobalFavorites = openGlobalFavorites;
(window as any).toggleGlobalFavorite = toggleGlobalFavorite;
(window as any).__ottInitializeGlobalFavorites = initializeGlobalFavorites;

(window as any).__ottEnsureGlobalFavorites = ensureGlobalFavorites;
