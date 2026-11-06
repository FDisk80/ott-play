import { utf8Encode } from "../commands/favorites-document-json";

export interface GlobalFavoritesFacadePorts {
    /** Explicit current-item addition may require installation-private evidence. */
    addCurrent?(admission?: () => boolean): Promise<any>;
    capture(): Promise<{ value: any; current(): boolean }>;
    captureLegacy(): Promise<{ entry: any; value?: any; current(): boolean }>;
    caselessKey(value: string): string;
    current(): boolean;
    playEntry(
        id: string,
        current: () => boolean
    ): { result: Promise<any>; cancel(): void };
    playLegacy(
        entry: any,
        current: () => boolean
    ): { result: Promise<any>; cancel(): void };
    qualify?(): Promise<boolean>;
    store: any;
    uuid(): string;
}
function failure(code: string): never {
    throw new Error(code);
}
function publicLegacy(row: any): any {
    return {
        id: row.id,
        kind: row.kind,
        name: row.name,
        profile_name: row.profile_name,
        profile_number: row.profile_number,
        provider: row.provider,
        title: row.title,
    };
}
// MAIN and optional bundles keep the same v1 vocabulary without cross-bundle imports.
function globalFavoritesLegacyPlaybackError(value: any): string {
    var code =
        value && value.status === "rejected" && value.data && value.data.error;
    var allowed = [
        "invalid_request",
        "unsupported",
        "no_current_item",
        "unsupported_item",
        "profile_unavailable",
        "profile_changed",
        "item_unavailable",
        "ambiguous_favorite",
        "favorite_not_found",
        "too_many_favorites",
        "storage_unavailable",
        "policy_denied",
        "busy",
        "timeout",
        "cancelled",
        "context_changed",
        "playback_failed",
    ];
    return typeof code === "string" && allowed.indexOf(code) >= 0
        ? code
        : "playback_failed";
}
/** Shared facade: legacy writes never serialize a projected/limited list. */
export function createGlobalFavoritesFacade(ports: GlobalFavoritesFacadePorts) {
    var caselessKey = ports.caselessKey;
    function current(extra?: () => boolean): boolean {
        return ports.current() && (!extra || extra());
    }
    async function list(cursor: any = null, limit = 100) {
        if (Math.floor(limit) !== limit || limit < 1 || limit > 100)
            failure("invalid_request");
        var view = await ports.store.snapshot();
        if (!current() || !view.current()) failure("context_changed");
        var offset = cursor ? cursor.offset : 0;
        if (
            cursor &&
            (cursor.revision !== view.revision ||
                Math.floor(offset) !== offset ||
                offset < 0 ||
                offset > view.entries.length)
        )
            failure("revision_conflict");
        var end = Math.min(offset + limit, view.entries.length);
        function page() {
            return {
                entries: view.entries.slice(offset, end),
                next_cursor:
                    end < view.entries.length
                        ? { offset: end, revision: view.revision }
                        : null,
                revision: view.revision,
                total: view.entries.length,
                unresolved_legacy_count: view.unresolvedLegacy.length,
            };
        }
        while (
            end > offset &&
            utf8Encode(JSON.stringify(page())).length > 14000
        )
            end--;
        if (offset < view.entries.length && end === offset)
            failure("limits_exceeded");
        return page();
    }
    async function add(admission?: () => boolean) {
        if (ports.addCurrent) return ports.addCurrent(admission);
        if (ports.qualify) await ports.qualify();
        var captured = await ports.capture();
        if (!current(admission) || !captured.current())
            failure("context_changed");
        var view = await ports.store.snapshot();
        return ports.store.mutate(
            view.revision,
            { entries: [captured.value], op: "put" },
            function () {
                return current(admission) && captured.current();
            }
        );
    }
    async function remove(id: string, admission?: () => boolean) {
        if (ports.qualify) await ports.qualify();
        var view = await ports.store.snapshot();
        if (!current(admission) || !view.current()) failure("context_changed");
        return ports.store.mutate(
            view.revision,
            { ids: [id], op: "remove" },
            function () {
                return current(admission);
            }
        );
    }
    async function legacy(params: any, admission: () => boolean) {
        if (params.op !== "list" && params.op !== "play" && ports.qualify)
            await ports.qualify();
        var view = await ports.store.snapshot();
        if (!current(admission) || !view.current()) failure("context_changed");
        var privateView = view.privateLegacy(),
            rows = privateView.entries;
        if (params.op === "list") return { entries: rows.map(publicLegacy) };
        var selected: any;
        if (params.op !== "add") {
            var query = params.query && caselessKey(params.query.trim());
            var matches = rows.filter(function (row: any) {
                return params.id
                    ? row.id === params.id
                    : caselessKey(row.name) === query;
            });
            if (!matches.length && query)
                matches = rows.filter(function (row: any) {
                    return caselessKey(row.name).indexOf(query) >= 0;
                });
            if (matches.length !== 1)
                failure(
                    matches.length ? "ambiguous_favorite" : "favorite_not_found"
                );
            selected = matches[0];
        }
        if (params.op === "remove") {
            var removed = await ports.store.mutate(
                view.revision,
                { id: selected.id, op: "legacy-remove" },
                function () {
                    return current(admission);
                }
            );
            if (removed.outcome !== "verified") failure("storage_unavailable");
            return { entry: publicLegacy(selected), removed: true };
        }
        if (params.op === "add") {
            var captured = await ports.captureLegacy();
            if (!current(admission) || !captured.current())
                failure("context_changed");
            var entry = captured.entry;
            var previous = rows.filter(function (row: any) {
                return (
                    row.provider === entry.provider &&
                    row.profile_number === entry.profile_number &&
                    row.source === entry.source &&
                    row.kind === entry.kind &&
                    JSON.stringify(row.ref) === JSON.stringify(entry.ref)
                );
            })[0];
            entry.id = previous ? previous.id : "fav-" + ports.uuid();
            entry.name =
                params.name !== undefined
                    ? params.name.trim()
                    : previous
                      ? previous.name
                      : entry.name;
            if (!previous && rows.length >= 100) failure("too_many_favorites");
            var change: any = { entry: entry, op: "legacy-put" };
            if (captured.value) change.portable = captured.value;
            var added = await ports.store.mutate(
                view.revision,
                change,
                function () {
                    return current(admission) && captured.current();
                }
            );
            if (added.outcome !== "verified") failure("storage_unavailable");
            return { created: !previous, entry: publicLegacy(entry) };
        }
        if (params.op !== "play") failure("invalid_request");
        if (!current(admission) || !view.current()) failure("context_changed");
        var guard = function () {
            return current(admission) && view.current();
        };
        var action = privateView.aliases[selected.id]
            ? ports.playEntry(privateView.aliases[selected.id], guard)
            : ports.playLegacy(selected, guard);
        return {
            cancel: action.cancel,
            result: action.result.then(function (value: any) {
                if (
                    !value ||
                    (value.status !== "ok" && value.dispatched !== true)
                )
                    failure(globalFavoritesLegacyPlaybackError(value));
                return { dispatched: true, entry: publicLegacy(selected) };
            }),
        };
    }
    async function play(id: string, admission: () => boolean) {
        var view = await ports.store.snapshot();
        if (
            !current(admission) ||
            !view.current() ||
            !view.entries.some(function (row: any) {
                return row.id === id;
            })
        )
            failure("favorite_not_found");
        return ports.playEntry(id, function () {
            return current(admission) && view.current();
        });
    }
    async function exportSnapshot() {
        var view = await ports.store.snapshot();
        if (!current() || !view.current()) failure("context_changed");
        if (view.unresolvedLegacy.length) failure("unportable_export");
        return {
            current: view.current,
            document: {
                entries: view.entries.map(function (row: any) {
                    return {
                        locator: row.locator,
                        origin: row.origin,
                        title: row.title,
                    };
                }),
                version: 1,
            },
        };
    }
    return {
        add: add,
        current: ports.current,
        export: function () {
            return ports.store.portableSnapshot();
        },
        exportSnapshot: exportSnapshot,
        legacy: legacy,
        list: list,
        play: play,
        remove: remove,
    };
}
