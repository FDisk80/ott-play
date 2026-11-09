import {
    parseTorrentCatalog,
    torrentUtf8,
} from "../provider/torrent-catalog-codec";
/** Read-only projections of the built-in registry's existing physical settings. */
export function globalFavoriteProviderName(id: string): string {
    return id === "offline" ? "local" : id;
}
export function globalFavoriteBuiltin(w: any, name: string): any {
    var profiles = w.__ottProviderDriverProfiles || [];
    var exact = profiles.filter(function (row: any) {
        return row.id === name;
    });
    var publicName =
        exact.length === 1 ? globalFavoriteProviderName(exact[0].id) : name;
    var rows = profiles.filter(function (row: any) {
        return globalFavoriteProviderName(row.id) === publicName;
    });
    return rows.length === 1 ? rows[0] : null;
}
function parsed(w: any, key: string): any {
    try {
        var raw = w.stbGetItem(key);
        return raw && raw.length <= 1048576 ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
}
export function globalFavoriteBuiltinSlot(w: any, row: any): number | null {
    if (row.kind === "stalker")
        return parsed(w, row.prefix + "stalker_data")?.active || 0;
    if (row.id === "kb-team") return Number(w.stbGetItem("kbcv_list") || 0);
    if (row.kind === "edem")
        return Number(w.stbGetItem(row.prefix + "list") || 0);
    return null;
}
export function globalFavoriteBuiltinConfiguration(
    w: any,
    row: any,
    slot: number | null
): any {
    if (!row || !w.stbGetItem) return null;
    if (row.kind === "stalker") {
        var config = parsed(w, row.prefix + "stalker_data"),
            value =
                config?.portals?.[slot!] ||
                (slot === 0 && !config?.portals ? config : null);
        return value && value.portal ? value : null;
    }
    var keys: string[],
        prefix = row.prefix;
    if (row.kind === "xtream") keys = ["xtream_data"];
    else if (row.kind === "torrent") {
        var catalog;
        try {
            catalog = parseTorrentCatalog(
                torrentUtf8(w.stbGetItem(row.prefix + "cfg"))
            );
        } catch (_) {
            return null;
        }
        return catalog &&
            catalog.schema === 1 &&
            typeof catalog.id === "string" &&
            /^[A-Za-z0-9_-]{1,64}$/.test(catalog.id) &&
            Array.isArray(catalog.entries)
            ? { name: row.title, slot: null, values: [catalog.id] }
            : null;
    } else if (row.kind === "operator" || row.kind === "xtream-fallback")
        keys = ["cfg"];
    else if (row.kind === "named-playlist")
        keys = [
            "ts_hls",
            row.id === "1ott" ? "pin" : "pass",
            row.id === "1ott" ? "id" : row.id === "only4" ? "token" : "login",
            ...(row.id === "tvteam" ? ["www"] : []),
        ];
    else if (row.kind === "catalog")
        keys = [
            "mpeg",
            row.id === "ottclub" ? "ottkey" : "key",
            ...(row.id === "ottclub"
                ? ["ottwww"]
                : row.id === "shura"
                  ? ["server"]
                  : []),
        ];
    else if (row.kind === "playlist") {
        prefix = row.id === "kb-team" ? "kbc" + slot : row.prefix;
        keys = ["key", "mpeg"];
    } else if (row.kind === "edem") keys = ["key", "vpurl"];
    else if (row.kind === "demo")
        return { name: row.title, slot: null, values: [] };
    else return null;
    var values = keys.map(function (key) {
        return w.stbGetItem(prefix + key);
    });
    if (row.id === "kb-team") {
        var mac = w.stbGetItem("mac");
        try {
            var native =
                w.AndroidInterface?.getMac?.() || w.stb?.getMacAddress?.();
            if (native && native !== "02:00:00:00:00:00") mac = String(native);
        } catch (_) {}
        values.push(mac);
    }
    if (
        !values.some(function (value) {
            return value !== null && value !== "";
        })
    )
        return null;
    return { name: row.title, slot: slot, values: values };
}
export function globalFavoriteBuiltinChoices(w: any, row: any): any[] {
    if (!row) return [];
    var slots: any[] =
        row.kind === "stalker"
            ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
            : row.id === "kb-team"
              ? [0, 1, 2]
              : row.kind === "edem"
                ? [0, 1]
                : [null];
    return slots
        .map(function (slot) {
            var value = globalFavoriteBuiltinConfiguration(w, row, slot);
            if (!value) return null;
            var name =
                row.kind === "stalker" ? value.name || row.title : row.title;
            return {
                alias: name,
                label:
                    name +
                    (slot !== null && row.kind !== "stalker"
                        ? " / Playlist " + (slot + 1)
                        : ""),
                profile: name,
                provider: row.id,
                slot: slot,
                subprofile:
                    slot !== null && row.kind !== "stalker"
                        ? "Playlist " + (slot + 1)
                        : null,
            };
        })
        .filter(Boolean);
}
