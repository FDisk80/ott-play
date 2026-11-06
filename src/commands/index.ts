import {
    translate as _,
    formatLocaleNumber,
    normalizeSearchText,
} from "../localization";
import { checkProviderUrl, selectProviderByIndex } from "../provider";
import { type Command, validPlayerCommand } from "../shared/wire-contracts";
import { createNotificationBanners } from "../ui/notification-banners";
import { randomChannels } from "./random-channel";

export type { Command } from "../shared/wire-contracts";

/**
 * Command handler — dispatches push commands received via webhook poll.
 *
 * Commands are JSON objects with a "command" field. The player polls the
 * central server (Variant 1) or a local proxy (Variant 2) and calls
 * handleCommand() for each received object.
 *
 * Supported commands:
 *   popup_message          — show notification popup (top-right, configurable duration)
 *   channel_by_number      — switch to channel by its number in the list
 *   channel_by_name        — fuzzy-match channel name (first substring hit)
 *   random_channel         — switch to a random channel (optional range)
 *   change_provider        — switch IPTV provider by index
 *   change_provider_settings — update provider config (JSON string)
 *   change_playlist        — load a new M3U playlist URL
 */

// ─── External declarations (set by other modules at runtime) ───────────────────

declare let $: any;
declare let window: any;

// ─── Command interface ─────────────────────────────────────────────────────────

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Show plain text through the shared local/remote banner renderer. */
export function showPopup(text: string, durationSec = 5) {
    if (!text) return;
    createNotificationBanners(window).showLocal(text, durationSec * 1000);
}

/**
 * Find the category index and channel index for a given channel ID.
 * Searches through all categories in window.catsArray / window.cats.
 *
 * @param chId - Channel ID to find.
 * @returns [catIdx, chIdx] or [-1, -1] if not found.
 */
function findChannelIndices(chId: number): [number, number] {
    var w = window;
    for (var ci = 0; w.catsArray && w.cats && ci < w.catsArray.length; ci++) {
        var cat = w.catsArray[ci];
        var list = w.cats[cat] || [];
        for (var i = 0; i < list.length; i++) {
            if (list[i] === chId) return [ci, i];
        }
    }
    return [-1, -1];
}

/** Numbered commands retain their existing category lookup and feedback. */
function playListedChannel(index: number): void {
    var w = window;
    var chId = w.curList[index];
    var indices = findChannelIndices(chId);
    if (indices[0] === -1) {
        showPopup(
            _("Channel #%1 not in any category", formatLocaleNumber(index + 1))
        );
        return;
    }
    if (typeof w.playChannel === "function") {
        w.playChannel(indices[0], indices[1], true);
    }
    var chName =
        w.channels && w.channels[chId] ? w.channels[chId].channel_name : "";
    showPopup(
        _("Channel #%1", formatLocaleNumber(index + 1)) +
            (chName ? ": " + chName : "")
    );
}

// ─── Command implementations ───────────────────────────────────────────────────

/**
 * Switch to a channel by its position number in the current list.
 * Uses window.curList which is the flat list of channel IDs.
 *
 * @param num - 1-based channel number.
 */
function channelByNumber(num: number): void {
    var w = window;
    if (!(w.curList && w.curList.length)) {
        showPopup(_("No channels loaded"));
        return;
    }
    // Channel numbers are 1-based
    var idx = num - 1;
    if (idx < 0 || idx >= w.curList.length) {
        showPopup(
            _(
                "Channel #%1 not found (total: %2)",
                formatLocaleNumber(num),
                formatLocaleNumber(w.curList.length)
            )
        );
        return;
    }
    playListedChannel(idx);
}

/**
 * Switch to a channel by (partial) name match.
 * Case-insensitive substring search. First match wins.
 *
 * @param name - Channel name or partial name to search for.
 */
function channelByName(name: string): void {
    if (!name) return;
    var w = window;
    var needle = normalizeSearchText(name);

    // Search all categories
    for (var ci = 0; w.catsArray && w.cats && ci < w.catsArray.length; ci++) {
        var cat = w.catsArray[ci];
        var list = w.cats[cat] || [];
        for (var i = 0; i < list.length; i++) {
            var chId = list[i];
            var ch = w.channels && w.channels[chId];
            if (
                ch &&
                ch.channel_name &&
                normalizeSearchText(ch.channel_name).indexOf(needle) !== -1
            ) {
                // Preserve the legacy null-ID sentinel; channel IDs are strings/numbers.
                if (chId === null) break;
                if (typeof w.playChannel === "function") {
                    w.playChannel(ci, i, true);
                }
                var chName =
                    w.channels && w.channels[chId]
                        ? w.channels[chId].channel_name
                        : "";
                showPopup(_("Playing: %1", chName));
                return;
            }
        }
    }
    showPopup(_('Channel "%1" not found', name));
}

/**
 * Switch to a random channel.
 * If range is provided ([start, end]), picks from that 1-based range.
 * Otherwise picks from all channels in curList.
 *
 * @param rangeStart - Optional 1-based start of range.
 * @param rangeEnd   - Optional 1-based end of range.
 */
function randomChannel(rangeStart?: number, rangeEnd?: number): boolean {
    var w = window;
    if (!(w.curList && w.curList.length)) {
        showPopup(_("No channels loaded"));
        return false;
    }

    var ids = w.curList,
        channels = w.channels,
        load = w.__ottCommandChannelLoad;
    return !!randomChannels.play(
        w,
        ids,
        rangeStart === undefined ? {} : { range: [rangeStart, rangeEnd] },
        function () {
            return true;
        },
        function () {
            return (
                w.curList === ids &&
                w.channels === channels &&
                w.__ottCommandChannelLoad === load
            );
        }
    );
}

/**
 * Switch IPTV provider by index in the provider array.
 *
 * @param providerIdx - Index in window.providerIds.
 */
function changeProvider(providerIdx: number): void {
    if (selectProviderByIndex(providerIdx)) {
        showPopup(_("Switching provider..."));
    } else {
        showPopup(_("Provider switching not available"));
    }
}

/** Provider configuration schemas differ; no generic remote replacement is supported. */
function changeProviderSettings(): string {
    showPopup(
        _(
            "Remote provider settings are not supported. Use the player's provider settings."
        )
    );
    return "unsupported";
}

/** Update only the active M3U entry through the provider's existing persistence/reload contract. */
function changePlaylist(url: string): string {
    var w = window;
    if (
        w.p_pref !== "m3u" ||
        typeof w.providerSetItem !== "function" ||
        typeof w.loadPlaylist !== "function" ||
        !w.m3uArr ||
        !Array.isArray(w.m3uArr.M3Us)
    ) {
        showPopup(_("Remote playlist changes require the M3U provider."));
        return "unsupported";
    }
    if (
        (w.sPSprovs || w.sPSoptions) &&
        w.parentPIN !== "*" &&
        !w.parentAccess
    ) {
        showPopup(
            _("Unlock the player's settings before changing its playlist.")
        );
        return "rejected";
    }
    try {
        var parsed = new URL(url);
        if (
            !/^https?:$/.test(parsed.protocol) ||
            !parsed.hostname ||
            !checkProviderUrl(url)
        )
            return "rejected";
        var active = Number(w.m3uArr.active);
        if (
            !isFinite(active) ||
            active < 0 ||
            Math.floor(active) !== active ||
            !w.m3uArr.M3Us[active]
        )
            return "rejected";
        var next = JSON.parse(JSON.stringify(w.m3uArr));
        next.M3Us[active].www = url;
        w.providerSetItem("m3uArr", JSON.stringify(next));
        w.loadPlaylist();
        showPopup(_("Loading the new playlist..."));
        return "accepted";
    } catch (_error) {
        showPopup(_("Could not change the playlist."));
        return "rejected";
    }
}

/**
 * Set or adjust volume.
 * Supports absolute level (0-100) via `volume` or relative step via `volume_step`.
 * Gracefully ignored if the client doesn't support volume control.
 *
 * @param level - Absolute volume 0-100.
 * @param step  - Relative change, e.g. +10 or -5.
 */
function setVolume(level?: number, step?: number): void {
    var w = window;
    var supported =
        typeof w.stbSetVolume === "function" &&
        typeof w.stbGetVolume === "function";
    if (!supported) return; // silently ignore on clients without volume control

    var next: number;
    if (level !== undefined) next = level;
    else {
        if (step === undefined) return;
        var current = w.stbGetVolume();
        if (current === undefined || current === null) return;
        next = current + step;
    }
    next = Math.max(0, Math.min(100, next));
    w.stbSetVolume(next);
    showPopup(_("volume") + ": " + formatLocaleNumber(next) + "%");
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

/**
 * Dispatch a command object to the appropriate handler.
 * Called by the webhook poller for each received command.
 *
 * @param cmd - Command object with a "command" field.
 */
export function handleCommand(cmd: Command): string {
    if (!validPlayerCommand(cmd)) return "rejected";
    if (
        cmd.command === "channel_by_name" &&
        cmd.channel_name &&
        !cmd.channel_name.trim()
    )
        return "rejected";
    if (
        window.__ottKiosk &&
        window.__ottKiosk.enabled() &&
        cmd.command !== "set_volume" &&
        cmd.command !== "popup_message"
    )
        return "rejected";

    if (
        cmd.command === "channel_by_number" ||
        cmd.command === "channel_by_name" ||
        cmd.command === "random_channel"
    ) {
        var w = window;
        if (typeof w.stbIsStandby === "function" && w.stbIsStandby())
            return "rejected";
        if (
            w.commandChannelsReady === false ||
            (w.commandChannelsReady !== true &&
                !(
                    w.catsArray &&
                    w.catsArray.length &&
                    w.curList &&
                    w.curList.length
                ))
        )
            return "deferred";
    }
    switch (cmd.command) {
        case "popup_message":
            showPopup(cmd.message || "", cmd.popup_duration || 5);
            break;

        case "channel_by_number":
            if (cmd.channel_number !== undefined) {
                channelByNumber(cmd.channel_number);
            }
            break;

        case "channel_by_name":
            if (cmd.channel_name) {
                channelByName(cmd.channel_name);
            }
            break;

        case "random_channel":
            if (
                !(cmd.random_range
                    ? randomChannel(cmd.random_range[0], cmd.random_range[1])
                    : randomChannel())
            )
                return "rejected";
            break;

        case "change_provider":
            if (cmd.provider !== undefined) {
                changeProvider(cmd.provider);
            }
            break;

        case "change_provider_settings":
            if (cmd.provider_settings) {
                return changeProviderSettings();
            }
            break;

        case "change_playlist":
            if (cmd.playlist) {
                return changePlaylist(cmd.playlist);
            }
            break;

        case "set_volume":
            setVolume(cmd.volume, cmd.volume_step);
            break;

        case "exit_player":
            // Only the modern request/result lane can acknowledge an unloading effect.
            return "unsupported";

        default:
            showPopup(_("This remote command is not supported by the player."));
            return "unsupported";
    }
    return "accepted";
}
