import { caselessKey } from "../utils/caseless";
import { metadataImageUrl, metadataText } from "../utils/helpers";

export interface VPortalLink {
    key: string;
    url: string;
}

/** Decode only the bracket syntax; URL escapes and the opaque key stay intact. */
export function parseVPortalLink(value: unknown): VPortalLink | null {
    if (typeof value !== "string") return null;
    var link = value.trim();
    if (/[\u0000-\u001f\u007f]/.test(link)) return null;
    var match =
        /^portal::(?:\[|%5b)key:([^\[\]\s<>"\\]{1,1024}?)(?:\]|%5d)(https?:\/\/[^\s<>"\\]+)$/i.exec(
            link
        );
    if (!match) return null;
    var endpoint = match[2];
    // Credentials, fragments and ambiguous authorities have no place in an API URL.
    if (
        !/^https?:\/\/(?:\[[0-9a-f:.]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::[0-9]{1,5})?(?:[/?][^#]*)?$/i.test(
            endpoint
        )
    )
        return null;
    return { key: match[1], url: endpoint };
}

/** A hosted installation publishes exact provider routes, never an open relay. */
export function hostedVPortalRoute(
    endpoint: string,
    profile: any
): string | null {
    if (
        !profile ||
        profile.version !== 1 ||
        !profile.vportal ||
        !Array.isArray(profile.vportal.routes)
    )
        return null;
    var selected: string | null = null;
    for (var index = 0; index < profile.vportal.routes.length; index++) {
        var route = profile.vportal.routes[index];
        if (!route || route.upstream !== endpoint) continue;
        if (
            selected !== null ||
            typeof route.path !== "string" ||
            !/^\/vportal\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route.path)
        )
            return null;
        selected = route.path;
    }
    return selected;
}

interface VPortalCompletion {
    isCurrent?: () => boolean;
    (): void;
}

interface VPortalOptions {
    isCurrent?: () => boolean;
    sourceId?: string;
    title?: string;
}

export interface VPortalSection {
    __ottCategoryRoot?: boolean;
    adult?: boolean;
    request: Record<string, any>;
    sequence?: boolean;
    title: string;
}

export interface VPortalClient {
    cancel(): void;
    cancelAutomatic(): void;
    dispose(): void;
    load(target: any, callback: VPortalCompletion): void;
    page(
        target: any,
        done: (result: { items: any[]; error?: string }) => void
    ): () => void;
    play(item: any): void;
    playlist(
        sections: VPortalSection[],
        done: (
            items: any[],
            complete: boolean,
            error?: string,
            scanned?: number
        ) => void
    ): () => void;
    resolve(item: any, done: (item: any) => void, automatic?: boolean): void;
    scanDiagnostics(): Record<string, any>;
    search(
        query: string,
        done: (result: { items: any[]; error?: string }) => void,
        isCurrent?: () => boolean
    ): () => void;
    sections(
        done: (result: { items: VPortalSection[]; error?: string }) => void
    ): () => void;
    stop(url?: string): void;
}

interface VPortalRequestLane {
    pending: any;
    revision: number;
}

/** The provider owns this instance, so replacing its settings invalidates all work. */
export function createVPortalClient(
    link: string,
    options: VPortalOptions = {}
): VPortalClient | null {
    var parsed = parseVPortalLink(link);
    if (!parsed) return null;
    var portal = parsed;
    var w = window as any;
    var jq = w.jQuery || w.$;
    var native = Boolean(
        w.__TAURI__ ||
            (w.Capacitor &&
                (typeof w.Capacitor.isNativePlatform !== "function" ||
                    w.Capacitor.isNativePlatform()))
    );
    var foreground: VPortalRequestLane = { pending: null, revision: 0 };
    var background: VPortalRequestLane = { pending: null, revision: 0 };
    var searchLane: VPortalRequestLane = { pending: null, revision: 0 };
    var pageLane: VPortalRequestLane = { pending: null, revision: 0 };
    var catalogLane: VPortalRequestLane = { pending: null, revision: 0 };
    var stopCatalog: (() => void) | null = null;
    var catalogDiagnostic: Record<string, any> = {};
    var stopSearch: (() => void) | null = null;
    var stopPage: (() => void) | null = null;
    var disposed = false;
    var dialogHandler: any = null;
    var previousDialogHandler: any = null;
    var qualityHandler: any = null;
    var preferredQuality = "";
    function translate(text: string): string {
        return typeof w._ === "function" ? w._(text) : text;
    }

    function isCurrent(
        token: number,
        lane: VPortalRequestLane = foreground
    ): boolean {
        return (
            !disposed &&
            token === lane.revision &&
            (!options.isCurrent || options.isCurrent())
        );
    }

    function hideBusy(): void {
        var handler = dialogHandler;
        var previous = previousDialogHandler;
        dialogHandler = null;
        previousDialogHandler = null;
        if (handler && w.dialogBoxKeyHandler === handler) {
            w.dialogBoxKeyHandler = previous;
            jq("#dialogbox").hide();
        }
    }

    function cancelAutomatic(): void {
        ++background.revision;
        var request = background.pending;
        background.pending = null;
        if (request && typeof request.abort === "function") request.abort();
    }

    function cancel(): void {
        var token = ++foreground.revision;
        var request = foreground.pending;
        foreground.pending = null;
        // Invalidate all lanes before abort callbacks can start newer work.
        if (stopSearch) stopSearch();
        cancelAutomatic();
        if (request && typeof request.abort === "function") request.abort();
        if (token !== foreground.revision) return;
        hideBusy();
        if (token !== foreground.revision) return;
        var picker = qualityHandler;
        qualityHandler = null;
        if (picker && w.selectBoxKeyHandler === picker) {
            w.selectBoxKeyHandler = null;
            jq("#numprog").hide();
        }
    }

    function showBusy(): void {
        previousDialogHandler = w.dialogBoxKeyHandler;
        dialogHandler = function (code: number): void {
            var keys = w.keys || {};
            if (
                code !== keys.RETURN &&
                code !== keys.EXIT &&
                code !== keys.STOP
            )
                return;
            cancel();
            if (typeof w.closeList === "function") w.closeList();
            if (code === keys.STOP && typeof w.stbStop === "function")
                w.stbStop();
        };
        w.dialogBoxKeyHandler = dialogHandler;
        jq("#dialogbox")
            .html(metadataText(translate("Download! Wait ...")))
            .show();
    }

    function reportError(automatic = false): void {
        // API errors can echo the request key. Never display or log their bodies.
        var notify = automatic ? w.showShift : w.alert;
        if (typeof notify === "function")
            notify.call(w, translate("VPortal request failed"));
    }

    function copyRequest(value: any): any {
        var result: any = {};
        if (value && typeof value === "object" && !Array.isArray(value)) {
            Object.keys(value).forEach(function (key) {
                if (
                    key !== "__proto__" &&
                    key !== "constructor" &&
                    key !== "prototype" &&
                    key !== "app" &&
                    key !== "key"
                )
                    result[key] = value[key];
            });
        }
        return result;
    }

    function sourceTarget(target: any): any {
        if (options.sourceId) target.vportalSource = options.sourceId;
        return target;
    }

    function request(
        params: any,
        token: number,
        accept: (data: any) => void,
        complete: () => void,
        guard: () => boolean,
        lane: VPortalRequestLane = foreground,
        failed?: (status?: string) => void
    ): void {
        var body = copyRequest(params);
        body.app = "ott-play";
        body.key = portal.key;
        var hosted = !native && w.__OTTPLAY_HOSTED__ !== undefined;
        var endpoint: string | null =
            String(w.host || "").replace(/\/$/, "") + "/vportal/api";
        if (native) endpoint = portal.url;
        else if (hosted)
            endpoint = hostedVPortalRoute(portal.url, w.__OTTPLAY_HOSTED__);
        var finished = false;
        var automatic = lane === background;
        var visible = lane === foreground;
        if (visible) showBusy();
        try {
            if (!endpoint)
                throw new Error("VPortal endpoint is not configured");
            var xhr = jq.ajax({
                complete: function (): void {
                    if (finished) return;
                    finished = true;
                    if (
                        (lane === searchLane ||
                            lane === pageLane ||
                            lane === catalogLane) &&
                        !guard()
                    )
                        return;
                    if (!isCurrent(token, lane)) return;
                    lane.pending = null;
                    if (visible) hideBusy();
                    complete();
                },
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify(
                    native || hosted ? body : { params: body, url: portal.url }
                ),
                dataType: "json",
                error: function (_xhr: any, status: string): void {
                    if (
                        !finished &&
                        lane === catalogLane &&
                        isCurrent(token, lane) &&
                        guard() &&
                        failed
                    )
                        failed(status);
                    if (
                        !finished &&
                        lane !== searchLane &&
                        lane !== pageLane &&
                        lane !== catalogLane &&
                        isCurrent(token, lane) &&
                        guard() &&
                        status !== "abort"
                    ) {
                        if (failed) failed();
                        else reportError(automatic);
                    }
                },
                success: function (data: any): void {
                    if (!finished && isCurrent(token, lane) && guard())
                        accept(data);
                },
                timeout: 30000,
                type: "POST",
                url: endpoint,
                vportalRequest: true,
            });
            if (!finished && isCurrent(token, lane) && guard())
                lane.pending = xhr;
            else if (
                !finished &&
                (lane === pageLane || lane === catalogLane) &&
                xhr &&
                typeof xhr.abort === "function"
            )
                xhr.abort();
        } catch (_error) {
            if (!isCurrent(token, lane)) return;
            finished = true;
            if (visible) hideBusy();
            if (
                lane !== searchLane &&
                lane !== pageLane &&
                lane !== catalogLane &&
                guard()
            ) {
                if (failed) failed();
                else reportError(automatic);
            }
            complete();
        }
    }

    function description(item: any, parent: any, record: any): string {
        var html = "<b>" + metadataText(item.title || "") + "</b>";
        record.__ottMediaSynopsisOffset = -1;
        ["year", "duration", "agelimit", "description"].forEach(
            function (field) {
                var value = item[field] || (parent && parent[field]);
                if (value != null && value !== "") {
                    var text = metadataText(value);
                    if (field === "description" && text)
                        record.__ottMediaSynopsisOffset = html.length + 4;
                    html += "<br>" + text;
                }
            }
        );
        return html;
    }

    function artwork(item: any, parent: any): string {
        var values = [
            item.imglr,
            item.img,
            parent && parent.imglr,
            parent && parent.img,
        ];
        for (var i = 0; i < values.length; i++) {
            if (typeof values[i] !== "string") continue;
            var value = metadataImageUrl(values[i]);
            if (!value || /\\/.test(value)) continue;
            if (/^data:/i.test(value)) return value;
            try {
                var Resolver = w.URL || (typeof URL === "function" && URL);
                if (!Resolver) {
                    // Old clients may display already-absolute artwork without URL resolution.
                    if (
                        /^https?:\/\//i.test(value) &&
                        !/^https?:\/\/[^/?#]*@/i.test(value)
                    )
                        return value;
                    continue;
                }
                var base = new Resolver(
                    portal.url,
                    w.location && w.location.href
                );
                var resolved = new Resolver(value, base.href);
                if (
                    !/^https?:$/.test(resolved.protocol) ||
                    resolved.username ||
                    resolved.password
                )
                    continue;
                return resolved.href;
            } catch (_) {}
        }
        return "";
    }

    function media(item: any, parent: any): any {
        if (!item || typeof item !== "object") return null;
        if (
            item.type !== "stream" &&
            item.type !== "category" &&
            item.type !== "multistream"
        )
            return null;
        var title = String(item.title || "");
        if (parent && parent.type === "multistream" && parent.title)
            title = String(parent.title) + " - " + title;
        var record: any = {
            logo_30x30: artwork(item, parent),
            title: title,
        };
        record.description = description(item, parent, record);
        if (item.type === "multistream") record.__ottMediaFilterable = true;
        sourceTarget(record);
        // Portable identity is attested here, before raw provider fields are discarded.
        var identitySource = item;
        var identity = directProviderId(identitySource);
        if (!identity && item.request && typeof item.request === "object") {
            identitySource = item.request;
            identity = directProviderId(identitySource);
        }
        if (identity) {
            var rawId = identitySource[identity.field];
            if (
                (typeof rawId === "string" ||
                    (typeof rawId === "number" &&
                        isFinite(rawId) &&
                        rawId >= 0 &&
                        Math.floor(rawId) === rawId &&
                        rawId <= 9007199254740991)) &&
                /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(identity.value)
            )
                record.__ottFavoriteId = identity;
        }
        if (item.adult || (parent && parent.adult)) record.adult = 1;
        if (item.type === "stream") {
            if (parent && parent.type === "multistream")
                record.__ottMediaSequence = true;
            if (item.request && typeof item.request === "object")
                record.request = copyRequest(item.request);
            record.stream_url = validStream(item.url)
                ? item.url
                : record.request
                  ? "vportal:request"
                  : "";
        } else
            record.playlist_url = sourceTarget({
                __ottVPortalContext: mediaContext(item, parent),
                mediaName: title,
                request: copyRequest(item.request),
            });
        return record;
    }

    function mediaContext(item: any, parent?: any): any {
        var context: any = {};
        [
            "title",
            "year",
            "duration",
            "agelimit",
            "description",
            "imglr",
            "img",
        ].forEach(function (key) {
            context[key] = item[key] || (parent && parent[key]);
        });
        context.type =
            item.type === "multistream" ||
            (parent && parent.type === "multistream")
                ? "multistream"
                : "category";
        if (
            parent &&
            parent.type === "multistream" &&
            parent.title &&
            item.title
        )
            context.title = parent.title + " - " + item.title;
        if (item.adult || (parent && parent.adult)) context.adult = 1;
        return context;
    }

    function validStream(value: any): boolean {
        return (
            typeof value === "string" && /^https?:\/\/[^\s<>]+$/i.test(value)
        );
    }

    function directProviderId(item: any): any {
        var fields = [
            "id",
            "fid",
            "stream_id",
            "itemId",
            "media_id",
            "episode_id",
        ];
        for (var index = 0; index < fields.length; index++) {
            var value = item[fields[index]];
            if (
                (typeof value === "string" && value) ||
                (typeof value === "number" && isFinite(value))
            )
                return { field: fields[index], value: String(value) };
        }
        return null;
    }

    function search(
        query: string,
        done: (result: { items: any[]; error?: string }) => void,
        guard?: () => boolean
    ): () => void {
        if (stopSearch) stopSearch();
        query = String(query || "").trim();
        var token = ++searchLane.revision;
        var active = true;
        var timer: any = null;
        var deadline = Date.now() + 25000;
        var folded = caselessKey(query);
        // Keep exact queues inside the existing query transport so older
        // controllers can deliver them without learning a new command shape.
        var exact: string[] | null = null;
        var exactKeys: string[] = [];
        if (query.slice(0, 6) === "exact:") {
            try {
                var selection: unknown = JSON.parse(query.slice(6));
                if (
                    !Array.isArray(selection) ||
                    !selection.length ||
                    selection.length > 20
                )
                    throw new Error();
                exact = selection.map(function (title: unknown): string {
                    if (typeof title !== "string" || !title.trim())
                        throw new Error();
                    var normalized = caselessKey(title.trim());
                    if (exactKeys.indexOf(normalized) !== -1) throw new Error();
                    exactKeys.push(normalized);
                    return title.trim();
                });
            } catch (_) {
                done({
                    error: "Invalid exact VPortal titles",
                    items: [],
                });
                return function () {};
            }
        }
        var items: any[] = [];
        var tasks: any[] = [];
        var requests: { [key: string]: boolean } = Object.create(null);
        var folders: { [key: string]: boolean } = Object.create(null);
        var playables: { [key: string]: boolean } = Object.create(null);
        var pageCount = 0;
        var rowCount = 0;
        var canonicalBytes = 0;

        function cancelSearch(): void {
            if (!active) return;
            active = false;
            if (timer !== null) w.clearTimeout(timer);
            tasks = [];
            if (stopSearch === cancelSearch) stopSearch = null;
            if (token !== searchLane.revision) return;
            ++searchLane.revision;
            var pending = searchLane.pending;
            searchLane.pending = null;
            if (pending && typeof pending.abort === "function") pending.abort();
        }

        function current(): boolean {
            if (!active) return false;
            if (!isCurrent(token, searchLane) || (guard && !guard())) {
                cancelSearch();
                return false;
            }
            return true;
        }

        function finish(error?: string): void {
            if (!current()) return;
            if (!error && exact) {
                var ordered: any[] = [];
                for (var i = 0; i < exactKeys.length; i++) {
                    var matches = items.filter(function (item) {
                        return (
                            caselessKey(String(item.title || "")) ===
                            exactKeys[i]
                        );
                    });
                    if (matches.length !== 1) {
                        error = "Missing or ambiguous VPortal title";
                        break;
                    }
                    ordered.push(matches[0]);
                }
                if (!error) items = ordered;
            }
            var result = error ? { error: error, items: [] } : { items: items };
            cancelSearch();
            done(result);
        }

        function fail(): void {
            finish("VPortal search could not collect a complete result");
        }

        // Sorted request keys detect cycles even if the provider reorders JSON keys.
        function key(value: any, limit = 65536): string {
            function ordered(input: any, depth: number): any {
                if (depth > 12) throw new Error();
                if (!input || typeof input !== "object") return input;
                if (Array.isArray(input))
                    return input.map(function (part: any) {
                        return ordered(part, depth + 1);
                    });
                var result = Object.create(null);
                Object.keys(input)
                    .sort()
                    .forEach(function (name) {
                        result[name] = ordered(input[name], depth + 1);
                    });
                return result;
            }
            var valueKey = JSON.stringify(ordered(value, 0));
            // Reserve UTF-16 storage across all identity maps and page signatures.
            // Charge repeated keys too, keeping the bound conservative on old TVs.
            canonicalBytes += valueKey ? valueKey.length * 2 : 0;
            if (
                !valueKey ||
                valueKey.length > limit ||
                canonicalBytes > 2097152
            )
                throw new Error();
            return valueKey;
        }

        function folderContext(item: any, parent: any): any {
            var context: any = { type: "multistream" };
            [
                "title",
                "year",
                "duration",
                "agelimit",
                "description",
                "imglr",
                "img",
            ].forEach(function (field) {
                context[field] = item[field] || (parent && parent[field]);
            });
            if (parent && parent.title && item.title)
                context.title = parent.title + " - " + item.title;
            if (item.adult || (parent && parent.adult)) context.adult = 1;
            return context;
        }

        function collection(
            params: any,
            parent: any,
            ancestors: string[]
        ): any {
            if (!params || typeof params !== "object" || Array.isArray(params))
                throw new Error();
            var copied = copyRequest(params);
            if (!Object.keys(copied).length) throw new Error();
            copied.limit = 300;
            var identity = key(copied);
            if (ancestors.indexOf(identity) !== -1) throw new Error();
            if (folders[identity]) return null;
            folders[identity] = true;
            return {
                ancestors: ancestors.concat([identity]),
                pages: Object.create(null),
                params: copied,
                parent: parent,
            };
        }

        function next(): void {
            if (!current()) return;
            if (Date.now() >= deadline) {
                finish(
                    "VPortal search timed out before collecting all results"
                );
                return;
            }
            try {
                while (tasks.length) {
                    if (Date.now() >= deadline) {
                        finish(
                            "VPortal search timed out before collecting all results"
                        );
                        return;
                    }
                    var task = tasks.pop();
                    if (task.item) {
                        var item = task.item;
                        if (
                            !task.parent &&
                            (exact
                                ? item.type !== "stream" ||
                                  exactKeys.indexOf(
                                      caselessKey(String(item.title || ""))
                                  ) === -1
                                : caselessKey(String(item.title || "")).indexOf(
                                      folded
                                  ) === -1)
                        )
                            continue;
                        if (item.type === "stream") {
                            var record = media(item, task.context);
                            if (
                                !record ||
                                !record.stream_url ||
                                (record.request &&
                                    !Object.keys(record.request).length)
                            )
                                throw new Error();
                            var identity = key(
                                record.request || record.stream_url
                            );
                            if (playables[identity]) continue;
                            playables[identity] = true;
                            if (items.length >= 2000) throw new Error();
                            var title = task.parent
                                ? task.parent.title
                                : "[" + query + "]";
                            record.__ottMediaOrigin = {
                                kind: "catalog",
                                target: sourceTarget({
                                    mediaName: title,
                                    request: copyRequest(task.params),
                                }),
                                title: title,
                            };
                            if (!record.request)
                                record.__ottVPortalDirect = {
                                    id: directProviderId(item),
                                    occurrence: task.occurrence,
                                    title: String(item.title || ""),
                                };
                            items.push(record);
                        } else if (
                            item.type === "multistream" ||
                            (task.parent && item.type === "category")
                        ) {
                            var child = collection(
                                item.request,
                                folderContext(item, task.context),
                                task.ancestors
                            );
                            if (child) tasks.push(child);
                        }
                        continue;
                    }
                    var requestKey = key(task.params);
                    if (requests[requestKey] || ++pageCount > 100)
                        throw new Error();
                    requests[requestKey] = true;
                    var response: any = null;
                    request(
                        task.params,
                        token,
                        function (data): void {
                            if (current()) response = data;
                        },
                        function (): void {
                            if (!current()) return;
                            try {
                                acceptPage(task, response);
                            } catch (_error) {
                                fail();
                                return;
                            }
                            next();
                        },
                        current,
                        searchLane
                    );
                    return;
                }
                finish();
            } catch (_error) {
                fail();
            }
        }

        function acceptPage(task: any, data: any): void {
            if (
                !data ||
                ["videoportal", "category", "multistream"].indexOf(
                    data.type
                ) === -1 ||
                !Array.isArray(data.items) ||
                data.truncated
            )
                throw new Error();
            rowCount += data.items.length;
            if (rowCount > 10000) throw new Error();
            var rows: any[] = [];
            var nextPage: any = null;
            data.items.forEach(function (item: any) {
                if (!item || typeof item !== "object") throw new Error();
                if (item.type === "next") {
                    if (nextPage) throw new Error();
                    nextPage = item;
                } else rows.push(item);
            });
            var signature = key(
                rows.map(function (item) {
                    return [item.type, item.title, item.request, item.url];
                }),
                2000000
            );
            if (rows.length && task.pages[signature]) throw new Error();
            task.pages[signature] = true;
            var context = folderContext(task.parent || {}, data);
            context.type = task.parent ? "multistream" : "category";
            // Response metadata can add an adult flag, but cannot replace the
            // matched series title or discard metadata from an earlier page.
            context.title = task.parent ? task.parent.title : "";
            if (nextPage) {
                var params = copyRequest(task.params);
                var supplied = copyRequest(nextPage.request);
                Object.keys(supplied).forEach(function (name) {
                    params[name] = supplied[name];
                });
                if (supplied.offset === undefined)
                    params.offset =
                        Math.max(0, Number(task.params.offset) || 0) +
                        rows.length;
                params.limit = 300;
                var offset = Number(params.offset);
                if (
                    params.cmd !== task.params.cmd ||
                    params.query !== task.params.query ||
                    !isFinite(offset) ||
                    Math.floor(offset) !== offset ||
                    offset <= (Number(task.params.offset) || 0)
                )
                    throw new Error();
                tasks.push({
                    ancestors: task.ancestors,
                    pages: task.pages,
                    params: params,
                    parent: task.parent ? context : null,
                });
            } else if (
                data.has_more ||
                data.hasMore ||
                (typeof data.total === "number" &&
                    data.total >
                        (Number(task.params.offset) || 0) + rows.length)
            ) {
                throw new Error();
            }
            var occurrences: { [key: string]: number } = Object.create(null);
            var rowOccurrences: number[] = [];
            rows.forEach(function (item) {
                var title = String(item.title || "");
                var occurrence = occurrences[title] || 0;
                rowOccurrences.push(occurrence);
                if (item.type === "stream") occurrences[title] = occurrence + 1;
            });
            for (var index = rows.length - 1; index >= 0; index--)
                tasks.push({
                    ancestors: task.ancestors,
                    context: context,
                    item: rows[index],
                    occurrence: rowOccurrences[index],
                    params: task.params,
                    parent: task.parent ? context : null,
                });
        }

        stopSearch = cancelSearch;
        if (!current()) return cancelSearch;
        if (!folded || query.length > 1024) {
            finish("VPortal search requires a title filter");
            return cancelSearch;
        }
        timer = w.setTimeout(function () {
            finish("VPortal search timed out before collecting all results");
        }, 25000);
        var queries = exact || [query];
        for (var i = queries.length - 1; i >= 0; i--)
            tasks.push(
                collection({ cmd: "search", query: queries[i] }, null, [])
            );
        next();
        return cancelSearch;
    }

    function catalogRecords(
        data: any,
        params: any,
        name: string,
        retainDirect = false,
        inherited?: any
    ): any[] {
        if (
            !data ||
            (data.type !== "videoportal" &&
                data.type !== "category" &&
                data.type !== "multistream") ||
            !Array.isArray(data.items)
        )
            throw new Error();
        var context = inherited ? mediaContext(data, inherited) : data;
        if (inherited && inherited.type === "multistream" && inherited.title)
            context.title = inherited.title;
        var records: any[] = [];
        var next: any = null;
        var occurrences: Record<string, number> = Object.create(null);
        data.items.forEach(function (item: any): void {
            if (item && item.type === "next") next = item;
            else {
                var record = media(item, context);
                if (retainDirect && record && item.type === "stream") {
                    var title = String(item.title || "");
                    var occurrence = occurrences[title] || 0;
                    occurrences[title] = occurrence + 1;
                    if (record.stream_url && !record.request) {
                        record.__ottMediaOrigin = {
                            kind: "catalog",
                            target: sourceTarget({
                                mediaName: name,
                                request: copyRequest(params),
                            }),
                            title: name,
                        };
                        record.__ottVPortalDirect = {
                            id: directProviderId(item),
                            occurrence: occurrence,
                            title: title,
                        };
                    }
                }
                if (record) records.push(record);
            }
        });
        if (next) {
            var page = copyRequest(params);
            var supplied = copyRequest(next.request);
            Object.keys(supplied).forEach(function (key) {
                page[key] = supplied[key];
            });
            if (supplied.offset === undefined)
                page.offset =
                    Math.max(0, Number(params.offset) || 0) +
                    data.items.filter(function (item: any) {
                        return item && item.type !== "next";
                    }).length;
            if (
                page.offset > (Number(params.offset) || 0) ||
                Object.keys(supplied).some(function (key) {
                    return page[key] !== params[key];
                })
            ) {
                var target = sourceTarget({ mediaName: name, request: page });
                if (inherited) target.__ottVPortalContext = context;
                records.push({
                    __ottMediaLabel: { key: "Next", value: translate("Next") },
                    __ottMediaNext: true,
                    playlist_url: target,
                    title: translate("Next"),
                });
            }
        }
        if (data.controls && data.controls.search)
            records.push({
                __ottMediaLabel: { key: "Search", value: translate("Search") },
                playlist_url: "search",
                search_on: 1,
                title: translate("Search"),
            });
        if (data.controls && Array.isArray(data.controls.filters))
            records.push({
                __ottMediaLabel: {
                    key: "Filters",
                    value: translate("Filters"),
                },
                playlist_url: sourceTarget({
                    a: "filters",
                    filters: data.controls.filters,
                    mediaName: translate("Filters"),
                }),
                title: translate("Filters"),
            });
        return records;
    }

    /** Cursor fetching has its own quiet lane and never replaces the visible page. */
    function page(
        target: any,
        done: (result: { items: any[]; error?: string }) => void
    ): () => void {
        var token = ++pageLane.revision;
        if (stopPage) stopPage();
        if (token !== pageLane.revision) return function () {};
        var ended = false;
        var pendingPage: any = null;
        function active(): boolean {
            return !ended && isCurrent(token, pageLane);
        }
        function cancelOwned(): void {
            ended = true;
            if (stopPage === cancelOwned) stopPage = null;
            var xhr = pendingPage;
            pendingPage = null;
            if (pageLane.pending === xhr) pageLane.pending = null;
            if (xhr && typeof xhr.abort === "function") xhr.abort();
        }
        function finish(items?: any[]): void {
            if (!active()) return;
            ended = true;
            pendingPage = null;
            if (stopPage === cancelOwned) stopPage = null;
            done(
                items
                    ? { items: items }
                    : { error: translate("VPortal request failed"), items: [] }
            );
        }
        stopPage = cancelOwned;
        if (!active()) {
            cancelOwned();
            return cancelOwned;
        }
        if (
            !target ||
            typeof target !== "object" ||
            !target.request ||
            typeof target.request !== "object" ||
            (options.sourceId && target.vportalSource !== options.sourceId)
        ) {
            finish();
            return cancelOwned;
        }
        var params = copyRequest(target.request);
        params.limit = Math.max(
            1,
            Math.min(1000, Number(w.sPageSize) * 10 || 300)
        );
        var records: any[] | undefined;
        request(
            params,
            token,
            function (data) {
                try {
                    if (
                        JSON.stringify(data).length > 8 * 1024 * 1024 ||
                        !Array.isArray(data.items) ||
                        data.items.length > 1001
                    )
                        throw new Error();
                    records = catalogRecords(
                        data,
                        params,
                        target.mediaName || options.title || "VPortal",
                        false,
                        target.__ottVPortalContext || {}
                    );
                } catch (_) {
                    records = undefined;
                }
            },
            function () {
                finish(records);
            },
            active,
            pageLane
        );
        if (active()) pendingPage = pageLane.pending;
        return cancelOwned;
    }
    /** Flatten portal leaves while retaining their category ancestry for TV lists. */
    function collect(
        roots: VPortalSection[],
        recursive: boolean,
        done: (
            items: any[],
            complete: boolean,
            error?: string,
            scanned?: number
        ) => void
    ): () => void {
        var token = ++catalogLane.revision;
        if (stopCatalog) stopCatalog();
        if (token !== catalogLane.revision) return function () {};
        var active = true;
        var tasks: any[] = [];
        var visited: Record<string, boolean> = Object.create(null);
        var known: Record<string, any> = Object.create(null);
        var result: any[] = [];
        var pages = 0;
        var rows = 0;
        var bytes = 0;
        var keyBytes = 0;
        var retainedBytes = 0;
        var descriptionsOmitted = false;
        var sizes: Record<string, number> = Object.create(null);
        var whole =
            recursive &&
            roots.some(function (root) {
                return root.__ottCategoryRoot === true;
            });
        var maxRows = whole ? 200000 : 20000;
        var maxPages = whole ? 10000 : 500;
        var duration = 120000;
        var containers = 0;
        var started = Date.now();
        var watchdog: any = null;
        catalogDiagnostic = {
            mode: whole ? "whole" : "scoped",
            state: "loading",
        };
        var categoryKeys: Record<string, string> = Object.create(null);
        var pendingOwned: any = null;
        var timer: any = null;
        var deadline = whole ? Infinity : started + duration;
        function diagnostic(state: string, code?: string): void {
            catalogDiagnostic = {
                bytes: bytes,
                code: code || "",
                containers: containers,
                descriptionsOmitted: descriptionsOmitted,
                elapsedMs: Date.now() - started,
                items: result.length,
                mode: whole ? "whole" : "scoped",
                pages: pages,
                retainedBytes: retainedBytes,
                rows: rows,
                state: state,
            };
        }
        function utf8Size(value: any): number {
            var text = JSON.stringify(value);
            var length = text.length;
            for (var i = 0; i < text.length; i++) {
                var code = text.charCodeAt(i);
                if (code >= 128) {
                    length += code < 2048 ? 1 : 2;
                    if (
                        (code & 0xfc00) === 0xd800 &&
                        (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00
                    )
                        i++;
                }
            }
            return length;
        }
        function retain(key: string, record: any): void {
            if (!whole) return;
            if (descriptionsOmitted) {
                delete record.description;
                delete record.__ottMediaSynopsisOffset;
            }
            var size = utf8Size(record);
            var nextSize = retainedBytes - (sizes[key] || 0) + size;
            if (nextSize > 67108864 && !descriptionsOmitted) {
                descriptionsOmitted = true;
                retainedBytes = 0;
                Object.keys(sizes).forEach(function (retainedKey) {
                    var retained = known[retainedKey];
                    delete retained.description;
                    delete retained.__ottMediaSynopsisOffset;
                    sizes[retainedKey] = utf8Size(retained);
                    retainedBytes += sizes[retainedKey];
                });
                delete record.description;
                delete record.__ottMediaSynopsisOffset;
                size = utf8Size(record);
                nextSize = retainedBytes - (sizes[key] || 0) + size;
            }
            if (nextSize > 67108864) throw new Error("metadata_limit");
            sizes[key] = size;
            retainedBytes = nextSize;
        }
        function armWatchdog(): void {
            if (!whole || typeof w.setTimeout !== "function") return;
            if (watchdog !== null) w.clearTimeout(watchdog);
            watchdog = w.setTimeout(function () {
                finish(translate("VPortal request failed"), "inactive_timeout");
            }, 60000);
        }
        function identity(value: any): string {
            function order(input: any, depth: number): any {
                if (depth > 12) throw new Error();
                if (!input || typeof input !== "object") return input;
                if (Array.isArray(input))
                    return input.map(function (part) {
                        return order(part, depth + 1);
                    });
                var copy = Object.create(null);
                Object.keys(input)
                    .sort()
                    .forEach(function (key) {
                        copy[key] = order(input[key], depth + 1);
                    });
                return copy;
            }
            var key = JSON.stringify(order(value, 0));
            keyBytes += key ? key.length * 2 : 0;
            if (
                !key ||
                key.length > 65536 ||
                keyBytes > (whole ? 33554432 : 8388608)
            )
                throw new Error("identity_limit");
            return key;
        }
        function categoryId(value: any): string {
            var key = identity(value);
            var first = 2166136261;
            var second = 5381;
            for (var index = 0; index < key.length; index++) {
                var code = key.charCodeAt(index);
                first ^= code;
                first +=
                    (first << 1) +
                    (first << 4) +
                    (first << 7) +
                    (first << 8) +
                    (first << 24);
                second = ((second << 5) + second) ^ code;
            }
            var id =
                "vportal-category:" +
                ("00000000" + (first >>> 0).toString(16)).slice(-8) +
                ("00000000" + (second >>> 0).toString(16)).slice(-8);
            if (categoryKeys[id] && categoryKeys[id] !== key) throw new Error();
            categoryKeys[id] = key;
            return id;
        }
        function current(): boolean {
            return active && isCurrent(token, catalogLane);
        }
        function cancelOwned(): void {
            if (!active) return;
            active = false;
            tasks = [];
            if (stopCatalog === cancelOwned) stopCatalog = null;
            if (timer !== null) w.clearTimeout(timer);
            if (watchdog !== null) w.clearTimeout(watchdog);
            if (catalogDiagnostic.state === "loading") diagnostic("cancelled");
            if (token === catalogLane.revision) ++catalogLane.revision;
            var pending = pendingOwned;
            pendingOwned = null;
            if (catalogLane.pending === pending) catalogLane.pending = null;
            if (pending && typeof pending.abort === "function") pending.abort();
        }
        function finish(error?: string, code?: string): void {
            if (!current()) return;
            diagnostic(error ? "error" : "complete", code);
            if (
                error &&
                whole &&
                w.console &&
                typeof w.console.warn === "function"
            )
                w.console.warn("VPortal catalog", catalogDiagnostic);
            cancelOwned();
            done(result.slice(), true, error, rows);
        }
        function enqueue(
            target: any,
            ancestors: any[] = [],
            pagination = false
        ): void {
            var params = copyRequest(target.request);
            params.limit = 300;
            var key = identity(params);
            if (visited[key]) return;
            if (!pagination && ++containers > maxPages)
                throw new Error("container_limit");
            visited[key] = true;
            var categories = ancestors.slice();
            var categoryName = target.title || target.mediaName;
            if (!pagination && !target.__ottCategoryRoot && categoryName) {
                var categoryRequest = copyRequest(target.request);
                delete categoryRequest.offset;
                delete categoryRequest.limit;
                categories.push({
                    id: categoryId(categoryRequest),
                    name:
                        (categories.length
                            ? categories[categories.length - 1].name + " / "
                            : "") + String(categoryName),
                });
            }
            tasks.push({
                categories: categories,
                parent: target.__ottVPortalContext || {
                    adult: target.adult ? 1 : 0,
                    title: target.title || target.mediaName || "",
                    type: target.sequence ? "multistream" : "category",
                },
                request: params,
                title: target.title || target.mediaName || "",
            });
        }
        function next(retryTask?: any): void {
            if (!current()) return;
            if (!retryTask && !tasks.length) {
                finish();
                return;
            }
            if ((!retryTask && ++pages > maxPages) || Date.now() >= deadline) {
                finish(
                    translate("VPortal request failed"),
                    pages > maxPages ? "page_limit" : "overall_timeout"
                );
                return;
            }
            var task = retryTask || tasks.shift();
            var data: any = null;
            var requestStatus = "";
            request(
                task.request,
                token,
                function (value) {
                    data = value;
                },
                function () {
                    if (!current()) return;
                    pendingOwned = null;
                    if (!data && requestStatus === "timeout") {
                        if (whole && !task.retried) {
                            task.retried = true;
                            next(task);
                            return;
                        }
                        finish(
                            translate("VPortal request failed"),
                            "transport_timeout"
                        );
                        return;
                    }
                    try {
                        if (
                            !data ||
                            data.truncated ||
                            !Array.isArray(data.items) ||
                            data.items.length > 1001
                        )
                            throw new Error("invalid_response");
                        var responseBytes = whole
                            ? utf8Size(data)
                            : JSON.stringify(data).length * 2;
                        bytes += responseBytes;
                        if (whole ? responseBytes > 8388608 : bytes > 33554432)
                            throw new Error("response_limit");
                        rows += data.items.length;
                        if (rows > maxRows) throw new Error("row_limit");
                        var context = mediaContext(data, task.parent);
                        if (
                            task.parent.type === "multistream" &&
                            task.parent.title
                        )
                            context.title = task.parent.title;
                        var catalogData = copyRequest(data);
                        Object.keys(context).forEach(function (key) {
                            catalogData[key] = context[key];
                        });
                        var records = catalogRecords(
                            catalogData,
                            task.request,
                            task.title,
                            recursive
                        );
                        var hasNext = false;
                        records.forEach(function (record) {
                            if (record.__ottMediaNext) {
                                hasNext = true;
                                var cursor = record.playlist_url;
                                var previousParams = copyRequest(task.request);
                                var nextParams = copyRequest(cursor.request);
                                // The client fixes every outgoing page to 300.
                                // Portals may return limit:0 as a default sentinel.
                                cursor.request.limit = nextParams.limit = 300;
                                var nextOffset = Number(nextParams.offset);
                                delete previousParams.offset;
                                delete nextParams.offset;
                                if (
                                    !isFinite(nextOffset) ||
                                    Math.floor(nextOffset) !== nextOffset ||
                                    nextOffset <=
                                        (Number(task.request.offset) || 0) ||
                                    identity(previousParams) !==
                                        identity(nextParams)
                                )
                                    throw new Error();
                                cursor.__ottVPortalContext = context;
                                cursor.mediaName = task.title;
                                if (visited[identity(cursor.request)])
                                    throw new Error();
                                enqueue(cursor, task.categories, true);
                            } else if (record.stream_url) {
                                if (!recursive) {
                                    if (!known.root) {
                                        known.root = true;
                                        result.push({
                                            request: {},
                                            title: options.title || "VPortal",
                                        });
                                    }
                                    return;
                                }
                                var direct = record.__ottVPortalDirect;
                                var key = identity(
                                    record.request ||
                                        (direct
                                            ? [
                                                  record.__ottMediaOrigin.target
                                                      .request,
                                                  direct.id || [
                                                      direct.title,
                                                      direct.occurrence,
                                                  ],
                                              ]
                                            : record.stream_url)
                                );
                                if (known[key]) {
                                    var existing = known[key];
                                    // Stage membership changes until the retained metadata budget passes.
                                    var merged = Object.assign({}, existing);
                                    merged.__ottMediaCategories =
                                        existing.__ottMediaCategories.slice();
                                    if (Number(record.adult) === 1)
                                        merged.adult = 1;
                                    task.categories.forEach(function (
                                        category: any
                                    ) {
                                        if (
                                            !merged.__ottMediaCategories.some(
                                                function (value: any) {
                                                    return (
                                                        value.id === category.id
                                                    );
                                                }
                                            )
                                        )
                                            merged.__ottMediaCategories.push(
                                                category
                                            );
                                    });
                                    retain(key, merged);
                                    if (Number(record.adult) === 1)
                                        existing.adult = 1;
                                    task.categories.forEach(function (
                                        category: any
                                    ) {
                                        if (
                                            !existing.__ottMediaCategories.some(
                                                function (value: any) {
                                                    return (
                                                        value.id === category.id
                                                    );
                                                }
                                            )
                                        )
                                            existing.__ottMediaCategories.push(
                                                category
                                            );
                                    });
                                    return;
                                }
                                known[key] = record;
                                record.__ottPlaylistId = key;
                                // Request-backed entries resolve a fresh playback URL on play.
                                if (whole && record.request)
                                    delete record.stream_url;
                                record.__ottMediaCategories =
                                    task.categories.slice();
                                if (!whole)
                                    record.__ottMediaCategory =
                                        task.categories[
                                            task.categories.length - 1
                                        ];
                                record.__ottMediaCollection =
                                    task.title ||
                                    context.title ||
                                    options.title ||
                                    "VPortal";
                                if (direct && options.sourceId)
                                    record.__ottMediaRef = {
                                        itemId: "direct:" + key,
                                        sourceId: options.sourceId,
                                    };
                                retain(key, record);
                                result.push(record);
                            } else if (
                                record.playlist_url &&
                                typeof record.playlist_url === "object" &&
                                record.playlist_url.request
                            ) {
                                var target = record.playlist_url;
                                if (recursive) enqueue(target, task.categories);
                                else {
                                    var key = identity(target.request);
                                    if (known[key]) return;
                                    known[key] = true;
                                    result.push({
                                        adult: !!record.adult,
                                        request: copyRequest(target.request),
                                        sequence: !!record.__ottMediaFilterable,
                                        title: record.title,
                                    });
                                }
                            }
                        });
                        if (
                            !hasNext &&
                            (data.items.some(function (item: any) {
                                return item && item.type === "next";
                            }) ||
                                data.has_more ||
                                data.hasMore ||
                                (typeof data.total === "number" &&
                                    data.total >
                                        (Number(task.request.offset) || 0) +
                                            data.items.length))
                        )
                            throw new Error();
                        armWatchdog();
                        diagnostic("loading");
                        if (recursive)
                            done(result.slice(), false, undefined, rows);
                        next();
                    } catch (error) {
                        var code =
                            error instanceof Error &&
                            /^(identity|metadata|response|row|container)_limit$/.test(
                                error.message
                            )
                                ? error.message
                                : "invalid_response";
                        finish(translate("VPortal request failed"), code);
                    }
                },
                current,
                catalogLane,
                function (status) {
                    requestStatus = status || "";
                }
            );
            if (current()) pendingOwned = catalogLane.pending;
        }
        stopCatalog = cancelOwned;
        try {
            if (!whole && typeof w.setTimeout === "function")
                timer = w.setTimeout(function () {
                    finish(
                        translate("VPortal request failed"),
                        "overall_timeout"
                    );
                }, duration);
            armWatchdog();
            roots.forEach(function (root) {
                enqueue(root);
            });
            next();
        } catch (_) {
            finish(translate("VPortal request failed"), "invalid_root");
        }
        return cancelOwned;
    }

    function pagehide(): void {
        if (stopPage) stopPage();
        if (stopCatalog) stopCatalog();
    }
    if (typeof w.addEventListener === "function")
        w.addEventListener("pagehide", pagehide);

    function load(target: any, callback: VPortalCompletion): void {
        var token = foreground.revision + 1;
        cancel();
        if (!isCurrent(token)) return;
        var view = w._mediaLoadState;
        function current(): boolean {
            return (
                isCurrent(token) &&
                view === w._mediaLoadState &&
                (!callback.isCurrent || callback.isCurrent())
            );
        }
        if (!current()) return;
        var name = options.title || "VPortal";
        if (target === "" || target == null)
            target = sourceTarget({ mediaName: name, request: {} });
        else if (typeof target === "string" && /^search(?:\?|$)/.test(target)) {
            var query = target.slice(target.indexOf("=") + 1);
            try {
                query = decodeURIComponent(query);
            } catch (_error) {
                /* Legacy literal percent escapes remain searchable. */
            }
            target = sourceTarget({
                mediaName: "[" + query + "]",
                request: { cmd: "search", query: query },
            });
        }
        if (
            !target ||
            typeof target !== "object" ||
            (options.sourceId && target.vportalSource !== options.sourceId)
        ) {
            w.mediaRecords = [];
            reportError();
            callback();
            return;
        }
        name = target.mediaName || name;
        if (target.a === "filters" || target.a === "filter") {
            var values = target.a === "filters" ? target.filters : target.items;
            w.mediaRecords = [];
            if (Array.isArray(values))
                values.forEach(function (value: any): void {
                    if (!value || typeof value !== "object") return;
                    w.mediaRecords.push({
                        description: metadataText(value.title),
                        playlist_url: sourceTarget(
                            target.a === "filters"
                                ? {
                                      a: "filter",
                                      items: value.items,
                                      mediaName: value.title,
                                  }
                                : {
                                      mediaName: value.title,
                                      request: copyRequest(value.request),
                                  }
                        ),
                        title: String(value.title || ""),
                    });
                });
            w.mediaName = name;
            callback();
            return;
        }
        var params = copyRequest(target.request);
        params.limit = Math.max(
            1,
            Math.min(1000, Number(w.sPageSize) * 10 || 300)
        );
        var records: any[] = [];
        request(
            params,
            token,
            function (data): void {
                if (!current()) return;
                try {
                    records = catalogRecords(
                        data,
                        params,
                        name,
                        false,
                        target.__ottVPortalContext || {}
                    );
                } catch (_) {
                    reportError();
                }
            },
            function (): void {
                if (!current()) return;
                w.mediaRecords = records;
                w.mediaName = name;
                callback();
            },
            current
        );
    }

    function play(
        item: any,
        resolved?: (item: any) => void,
        automatic = false
    ): void {
        var lane = automatic ? background : foreground;
        var token = lane.revision + 1;
        if (automatic) cancelAutomatic();
        else cancel();
        var view = w._mediaLoadState;
        var finished = false;
        function current(): boolean {
            return (
                isCurrent(token, lane) &&
                (automatic || view === w._mediaLoadState) &&
                (!resolved ||
                    !(resolved as any).isCurrent ||
                    (resolved as any).isCurrent())
            );
        }
        function fail(): void {
            if (finished || !current()) return;
            finished = true;
            // Retire only this launch's wait before displaying its error.
            var beforeError = resolved && (resolved as any).beforeError;
            if (typeof beforeError === "function") beforeError();
            if (!current()) return;
            reportError(automatic);
            if (current() && resolved) resolved(null);
        }
        if (!current()) return;
        if (
            !item ||
            (options.sourceId &&
                (item.request || item.vportalSource) &&
                item.vportalSource !== options.sourceId)
        ) {
            fail();
            return;
        }
        if (!resolved) w.__ottSetInfoInteraction?.(false);
        var result: any = null;
        function start(url: string): void {
            if (finished || !current()) return;
            if (!validStream(url)) {
                if (resolved) fail();
                return;
            }
            finished = true;
            // History may hold the selected object itself. The core must compare
            // its previous URL with the newly resolved URL before updating it.
            var playable = copyRequest(item);
            playable.stream_url = url;
            if (resolved) resolved(playable);
            else w._playMedia(playable, false, true);
        }
        if (!current()) return;
        if (!item.request || typeof item.request !== "object") {
            if (
                (automatic && item.__ottVPortalQueue) ||
                item.__ottVPortalDirect
            ) {
                var direct = item.__ottVPortalDirect;
                var origin = item.__ottMediaOrigin;
                var target = origin && origin.target;
                if (
                    !direct ||
                    !target ||
                    !target.request ||
                    typeof target.request !== "object" ||
                    Array.isArray(target.request) ||
                    !Object.keys(target.request).length ||
                    (options.sourceId &&
                        target.vportalSource !== options.sourceId)
                ) {
                    fail();
                    return;
                }
                var page: any = null;
                request(
                    target.request,
                    token,
                    function (data): void {
                        if (current()) {
                            page = data;
                        }
                    },
                    function (): void {
                        if (!current()) return;
                        if (!page) {
                            fail();
                            return;
                        }
                        if (
                            ["videoportal", "category", "multistream"].indexOf(
                                page.type
                            ) === -1 ||
                            !Array.isArray(page.items) ||
                            page.items.length > 10000 ||
                            page.truncated
                        ) {
                            fail();
                            return;
                        }
                        var matches: any[] = [];
                        var occurrence = 0;
                        page.items.forEach(function (candidate: any): void {
                            if (!candidate || candidate.type !== "stream")
                                return;
                            if (direct.id) {
                                var id = candidate[direct.id.field];
                                if (
                                    (typeof id === "string" ||
                                        typeof id === "number") &&
                                    String(id) === direct.id.value
                                )
                                    matches.push(candidate);
                            } else if (
                                String(candidate.title || "") === direct.title
                            ) {
                                if (occurrence++ === direct.occurrence)
                                    matches.push(candidate);
                            }
                        });
                        var fresh = matches.length === 1 ? matches[0] : null;
                        if (
                            !fresh ||
                            (fresh.request &&
                                typeof fresh.request === "object") ||
                            !validStream(fresh.url)
                        ) {
                            fail();
                            return;
                        }
                        start(fresh.url);
                    },
                    current,
                    lane,
                    fail
                );
                return;
            }
            start(item.stream_url);
            return;
        }
        request(
            item.request,
            token,
            function (data): void {
                if (current()) result = data;
            },
            function (): void {
                if (!current()) return;
                if (!result || result.type === "error") {
                    fail();
                    return;
                }
                var variants = result.variants;
                var names =
                    variants && typeof variants === "object"
                        ? Object.keys(variants).filter(function (name) {
                              return validStream(variants[name]);
                          })
                        : [];
                var url = validStream(result.url)
                    ? result.url
                    : names.length
                      ? variants[names[0]]
                      : "";
                if (!url) {
                    fail();
                    return;
                }
                if (
                    automatic ||
                    names.length < 2 ||
                    typeof w.showSelectBox !== "function"
                ) {
                    if (automatic && names.indexOf(preferredQuality) !== -1)
                        url = variants[preferredQuality];
                    start(url);
                    return;
                }
                var selected = 0;
                names.forEach(function (name, index) {
                    if (variants[name] === url) selected = index;
                });
                w.showSelectBox(
                    selected,
                    names.map(metadataText),
                    function (index: number) {
                        if (current() && index >= 0 && index < names.length) {
                            preferredQuality = names[index];
                            start(variants[names[index]]);
                        }
                    },
                    -1,
                    !!resolved
                );
                // showSelectBox closes the old list, which deliberately cancels pending work.
                token = foreground.revision;
                view = w._mediaLoadState;
                var picker = w.selectBoxKeyHandler;
                qualityHandler = function (code: number): boolean {
                    if (!current()) {
                        cancel();
                        return true;
                    }
                    var keys = w.keys || {};
                    if (code === keys.STOP) {
                        cancel();
                        if (typeof w.stbStop === "function") w.stbStop();
                        return true;
                    }
                    var handled =
                        typeof picker === "function" ? picker(code) : false;
                    if (code === keys.RETURN || code === keys.EXIT) cancel();
                    return handled;
                };
                var screen = w.__ottClassicScreenPort;
                if (
                    screen &&
                    typeof screen.decorateOwnedCallback === "function"
                )
                    qualityHandler = screen.decorateOwnedCallback(
                        "picker",
                        picker,
                        qualityHandler
                    );
                else w.selectBoxKeyHandler = qualityHandler;
            },
            current,
            lane,
            fail
        );
    }

    return {
        cancel: cancel,
        cancelAutomatic: cancelAutomatic,
        dispose: function (): void {
            disposed = true;
            if (stopPage) stopPage();
            if (stopCatalog) stopCatalog();
            if (typeof w.removeEventListener === "function")
                w.removeEventListener("pagehide", pagehide);
            cancel();
        },
        load: load,
        page: page,
        play: play,
        playlist: function (sections, done) {
            return collect(sections, true, done);
        },
        resolve: function (
            item: any,
            done: (item: any) => void,
            automatic?: boolean
        ) {
            play(item, done, automatic);
        },
        scanDiagnostics: function () {
            return Object.assign({}, catalogDiagnostic);
        },
        search: search,
        sections: function (done) {
            return collect(
                [{ request: {}, title: options.title || "VPortal" }],
                false,
                function (items, _complete, error) {
                    done({ error: error, items: items });
                }
            );
        },
        // The shared media adapter calls this hook; ordinary VPortal streams
        // have no external playback session to release.
        stop: function () {},
    };
}

(window as any).parseVPortalLink = parseVPortalLink;
(window as any).createVPortalClient = createVPortalClient;

(window as any).__ottVPortal = {
    create: createVPortalClient,
    parse: parseVPortalLink,
};
