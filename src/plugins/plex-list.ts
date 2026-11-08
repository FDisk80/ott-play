/** Optional Plex presentation; all playback and ownership stay in its source runtime. */
function createPlexList(ports: any): any {
    var w = ports.host;
    var plexCategoryId = "system:all";
    function isPlex(): boolean {
        return /^plex(?:@|$)/.test(ports.source);
    }
    function remember(payload: any): void {
        var driver = w.__ottActiveProviderDriver;
        if (
            driver &&
            driver.id === "plex" &&
            typeof driver.rememberPlayback === "function"
        ) {
            try {
                driver.rememberPlayback(payload);
            } catch (_) {
                // A failed optional cursor write cannot prevent playback.
            }
        }
    }
    function playOrderedQueue(
        records: any[],
        index: number,
        queueId: string,
        resolved: any,
        guard: () => boolean,
        dispatched: () => void,
        failed: () => void,
        preserveInfo = false
    ) {
        var items = ports.describe(records, {
            kind: "catalog",
            target: "",
            title: "Plex",
        });
        if (!items[index] || !ports.current() || !guard()) return failed();
        ports.api.cancelAuto();
        if (!ports.current() || !guard()) return failed();
        if (!preserveInfo) w.__ottSetInfoInteraction?.(false);
        ports.resolve(
            items[index],
            {
                explicit: true,
                index: index,
                items: items,
                onError: failed,
                queueId: queueId,
                repeat: "off",
                replace: true,
            },
            true,
            guard,
            dispatched,
            { position: 0, resolved: resolved, unavailable: failed },
            function (started) {
                if (!started) failed();
            }
        );
        return function () {
            ports.api.cancelAuto();
        };
    }

    var restored = false;
    var startupLoading: ScreenOwner | null = null;
    function finishStartupLoading(): void {
        var owner = startupLoading;
        startupLoading = null;
        if (owner) owner.close();
    }
    function restoreLast(onUnavailable?: () => void) {
        if (!ports.current() || restored) return false;
        restored = true;
        if (
            w.sFavorites === -1 ||
            !ports.limit() ||
            !ports.mediaClient ||
            !ports.mediaClient.stableRequests ||
            typeof ports.mediaClient.resolve !== "function" ||
            (ports.playback() && ports.playback().runtime === ports.api)
        )
            return false;
        var saved = ports.journal.read();
        var row = saved.document.history[0];
        if (
            !ports.current() ||
            !saved.writable ||
            !row ||
            row.sourceId !== ports.source ||
            !isFinite(row.position) ||
            row.position <= 0 ||
            !row.payload.request
        )
            return false;
        var payload = ports.copy(row.payload);
        payload.__ottMediaRef = { itemId: row.itemId, sourceId: ports.source };
        payload.__ottMediaRefresh = true;
        var item = ports.describe([payload], { kind: "history", title: "" })[0];
        if (!ports.playable(item)) return false;
        var admitted = ports.library.capture();
        var revision = ports.generation() + 1;
        ports.api.cancelAuto();
        if (!ports.current() || !admitted() || revision !== ports.generation())
            return true;
        if (typeof w.__ottClassicPlayback.reconcile === "function")
            w.__ottClassicPlayback.reconcile();
        var generation = w.__ottClassicPlayback.snapshot().generation;
        function valid() {
            return (
                ports.current() &&
                ports.mediaClient === ports.client() &&
                admitted() &&
                revision === ports.generation() &&
                w.__ottClassicPlayback.snapshot().generation === generation
            );
        }
        function unavailable() {
            if (!valid()) return;
            finishStartupLoading();
            if (onUnavailable) onUnavailable();
        }
        ports.authorize(item, function () {
            if (!valid()) return;
            w.__ottSetInfoInteraction?.(false);
            var loading = ports.showLoading(function () {
                if (!valid()) return;
                ports.api.cancelAuto();
                if (ports.current() && onUnavailable) onUnavailable();
            });
            startupLoading = loading;
            loading.own(function () {
                if (startupLoading === loading) ports.api.cancelAuto();
            });
            try {
                ports.collectFolder(item, valid, function (folder) {
                    if (!valid()) return;
                    if (folder) {
                        if (!ports.restoreFolder(item, folder)) return;
                        admitted = ports.library.capture();
                    }
                    if (valid())
                        ports.resolve(
                            item,
                            folder
                                ? folder.sequence
                                : ports.sequenceFor(item, folder !== false),
                            true,
                            valid,
                            undefined,
                            {
                                position: row.position,
                                unavailable: unavailable,
                            }
                        );
                });
            } catch (_) {
                if (valid()) {
                    ports.clearAutomatic();
                    unavailable();
                }
            }
        });
        return true;
    }

    function active(): boolean {
        return ports.current() && isPlex();
    }
    function paintOwned(show: () => void): any {
        var previous = ports.rendering(true);
        try {
            show();
        } finally {
            ports.rendering(previous);
        }
        var owner = w.__ottClassicScreenPort.listOwner();
        ports.bindScreen();
        return owner;
    }
    function playing(index: number, ref: MediaRef) {
        var playing = ports.playback();
        return !!(
            playing &&
            playing.runtime === ports.api &&
            (playing.sequence && playing.sequence.explicit
                ? playing.sequence.index === index
                : playing.ref.itemId === ref.itemId)
        );
    }
    function selectOwned(
        index: number,
        ref: MediaRef,
        catalog: boolean,
        close: () => void
    ) {
        var playing = ports.playback();
        var sequence =
            playing && playing.runtime === ports.api && playing.sequence;
        if (catalog && sequence && sequence.explicit) {
            var candidate = sequence.items[index];
            if (
                !candidate ||
                candidate.ref.sourceId !== ref.sourceId ||
                candidate.ref.itemId !== ref.itemId
            )
                return;
            var phase = w.__ottClassicPlayback.snapshot().phase;
            var retry =
                phase === "idle" || phase === "stopped" || phase === "error";
            if (index === sequence.index && !retry) close();
            else ports.skip(index - sequence.index, close, retry);
        } else ports.api.select(index);
    }
    function open(target: any): boolean {
        if (!isPlex()) return false;
        var driver = w.__ottActiveProviderDriver;
        var targetIsCatalog =
            target !== -1 &&
            target !== -2 &&
            target !== "submenu" &&
            !(typeof target === "string" && /^(cmd:info|alert)/.test(target));
        if (
            targetIsCatalog &&
            !ports.context &&
            driver &&
            driver.id === "plex" &&
            driver.capabilities &&
            driver.capabilities.mediaPlaylist &&
            typeof w.channelsList === "function"
        ) {
            // Retire pending legacy responses before the channel screen
            // takes ownership, so they cannot repaint its list later.
            ports.api.cancel();
            if (ports.current()) w.channelsList(w.catIndex, w.primaryIndex);
            return true;
        }
        if (!ports.beforeOpen()) return true;
        if (
            ports.context &&
            ports.context.catalog &&
            isPlex() &&
            targetIsCatalog
        ) {
            var records = ports.context.catalog();
            if (
                !ports.current() ||
                !Array.isArray(records) ||
                !records.length ||
                records.length > 500
            )
                return true;
            var frame = ports.library.snapshot("none").frame;
            if (target === null && frame) {
                var playing = ports.playback();
                if (
                    frame.route.kind === "catalog" &&
                    playing &&
                    playing.runtime === ports.api &&
                    playing.sequence &&
                    playing.sequence.explicit
                ) {
                    // Preserve the selected occurrence when a queue repeats an ID.
                    ports.library.highlight(playing.sequence.index);
                    ports.library.show();
                    return true;
                }
                return false;
            }
            ports.navigate(
                { kind: "catalog", target: "", title: ports.context.title },
                true
            );
            return true;
        }
        return false;
    }
    function load(done: any): boolean {
        if (
            ports.current() &&
            ports.context &&
            ports.context.catalog &&
            isPlex()
        ) {
            var records = ports.context.catalog();
            done(
                Array.isArray(records) && records.length <= 500
                    ? ports.copy(records)
                    : [],
                ports.context.title
            );
            return true;
        }
        return false;
    }
    function render(view: MediaLibraryView): boolean {
        var native = w.__ottChannelListView;
        var categories = w.__ottCategoryListView;
        var frame = view.frame;
        if (
            !active() ||
            !frame ||
            frame.route.kind === "variants" ||
            !native ||
            typeof native.show !== "function" ||
            !categories
        )
            return false;
        var rows: any = Object.create(null);
        var entries: any = Object.create(null);
        var all: string[] = [];
        var groups: any[] = [
            { id: "system:all", members: all, name: w._("All") },
        ];
        var byGroup: any = Object.create(null);
        byGroup["system:all"] = groups[0];
        var favoriteIds: any = Object.create(null);
        {
            // Global Favorites is a cross-source view, including when local edits are disabled.
            var saved = ports.journal.peek();
            if (!active()) return true;
            if (saved.document)
                saved.document.favorites.forEach(function (row: any) {
                    if (row.sourceId === ports.source)
                        favoriteIds[row.itemId] = true;
                });
            groups.push(
                (byGroup["system:favorites"] = {
                    id: "system:favorites",
                    members: [],
                    name: w._("Favorites"),
                })
            );
        }
        frame.items.forEach(function (item: MediaLibraryItem, index: number) {
            if (!ports.playable(item)) return;
            var id = "plex-row-" + index;
            var payload = item.payload;
            all.push(id);
            rows[id] = {
                __ottMediaItem: payload,
                channel_name: ports.title(payload),
                logo: payload.logo_30x30 || "",
                rec: 0,
            };
            entries[id] = { index: index, item: item };
            if (
                byGroup["system:favorites"] &&
                item.ref.sourceId === ports.source &&
                favoriteIds[item.ref.itemId]
            )
                byGroup["system:favorites"].members.push(id);
            var memberships = Array.isArray(payload.__ottMediaCategories)
                ? payload.__ottMediaCategories
                : [];
            if (!memberships.length && payload.__ottMediaCollection)
                memberships = [
                    {
                        id: "collection:" + payload.__ottMediaCollection,
                        name: payload.__ottMediaCollection,
                    },
                ];
            var seen: any = Object.create(null);
            memberships.forEach(function (group: any) {
                if (
                    !group ||
                    typeof group.id !== "string" ||
                    !group.id ||
                    typeof group.name !== "string" ||
                    !group.name
                )
                    return;
                var key = "folder:" + group.id;
                if (seen[key]) return;
                seen[key] = true;
                var target = byGroup[key];
                if (!target) {
                    target = byGroup[key] = {
                        id: key,
                        members: [],
                        name: group.name,
                    };
                    groups.push(target);
                }
                target.members.push(id);
            });
        });
        var groupIndex = 0;
        groups.forEach(function (group, index) {
            if (group.id === plexCategoryId) groupIndex = index;
        });
        plexCategoryId = groups[groupIndex].id;
        var revision = view.revision;
        var selectedFrameIndex = frame.selected;
        var screenToken = 0;
        var owner: any = null;
        function valid(token?: number): boolean {
            return (
                active() &&
                (token === undefined || token === screenToken) &&
                revision === ports.library.revision() &&
                !!owner &&
                owner.foreground()
            );
        }
        function paint(show: () => void): void {
            owner = paintOwned(show);
        }
        function selected(): any {
            return entries[groups[groupIndex].members[w.selIndex]];
        }
        function detail(): void {
            if (!valid()) return;
            var entry = selected();
            if (entry) {
                ports.library.highlight(entry.index);
                selectedFrameIndex = entry.index;
                if (typeof native.detail === "function")
                    native.detail(rows["plex-row-" + entry.index]);
            }
        }
        function close(): void {
            if (typeof w.closeList === "function") w.closeList(false);
        }
        function select(): void {
            var entry = selected();
            if (!entry) return;
            ports.library.highlight(entry.index);
            selectedFrameIndex = entry.index;
            selectOwned(
                entry.index,
                entry.item.ref,
                frame!.route.kind === "catalog",
                close
            );
        }
        function showChannels(focusedIndex?: number): void {
            if (
                groups[groupIndex].id === "system:favorites" &&
                w.openGlobalFavorites &&
                w.openGlobalFavorites() !== false
            )
                return;
            var token = ++screenToken;
            var members = groups[groupIndex].members;
            var index =
                focusedIndex === undefined
                    ? members.indexOf("plex-row-" + selectedFrameIndex)
                    : focusedIndex;
            paint(function () {
                native.show({
                    categoryName: groups[groupIndex].name,
                    channel: function (id: string) {
                        return rows[id];
                    },
                    detail: function () {
                        if (valid(token)) detail();
                    },
                    key: function (key: number): boolean {
                        if (!valid(token)) return true;
                        var keys = w.keys;
                        if (
                            key === keys.RETURN ||
                            key === keys.EXIT ||
                            key === keys.PRECH
                        ) {
                            close();
                            return true;
                        }
                        if (key === keys.ENTER) {
                            select();
                            return true;
                        }
                        if (w.sArrowFun === 2 && key === keys.LEFT) {
                            showCategories();
                            return true;
                        }
                        if (w.sArrowFun === 2 && key === keys.RIGHT) {
                            detail();
                            return true;
                        }
                        if (
                            key === keys.RW ||
                            key === keys.PREV ||
                            key === keys.FF ||
                            key === keys.NEXT
                        ) {
                            var backward = key === keys.RW || key === keys.PREV;
                            var action =
                                key === keys.RW || key === keys.FF
                                    ? w.sRewFun
                                    : w.sPNFun;
                            if (action === 1) {
                                if (backward) showCategories();
                                else detail();
                                return true;
                            }
                            if (action === 2) {
                                groupIndex =
                                    (groupIndex +
                                        (backward ? groups.length - 1 : 1)) %
                                    groups.length;
                                plexCategoryId = groups[groupIndex].id;
                                showChannels();
                                return true;
                            }
                        }
                        if (
                            key === keys.BLUE ||
                            key === keys.PLAY ||
                            key === keys.PAUSE
                        ) {
                            showCategories();
                            return true;
                        }
                        if (
                            key === keys.RED ||
                            key === keys.INFO ||
                            key === keys.N2
                        ) {
                            detail();
                            return true;
                        }
                        return false;
                    },
                    locked: function (id: string) {
                        return Number(rows[id].__ottMediaItem.adult) === 1;
                    },
                    picon: function (id: string) {
                        return rows[id].logo;
                    },
                    playing: function (id: string) {
                        return playing(entries[id].index, entries[id].item.ref);
                    },
                    rows: members,
                    selected: Math.max(0, index),
                    shelves: {
                        focus: function (
                            groupId: string,
                            index: number
                        ): boolean {
                            var group = byGroup[groupId];
                            if (
                                !group ||
                                groupId === "system:favorites" ||
                                typeof index !== "number" ||
                                index % 1 !== 0 ||
                                index < 0 ||
                                index >= group.members.length
                            )
                                return false;
                            var members = group.members,
                                id = members[index],
                                entry = entries[id];
                            if (
                                !entry ||
                                !valid(token) ||
                                w.__ottKiosk?.enabled?.() ||
                                w.__ottKiosk?.locked?.() ||
                                group.members !== members ||
                                members[index] !== id ||
                                frame!.items[entry.index] !== entry.item
                            )
                                return false;
                            groupIndex = groups.indexOf(group);
                            if (groupIndex < 0) return false;
                            plexCategoryId = group.id;
                            selectedFrameIndex = entry.index;
                            showChannels(index);
                            return true;
                        },
                        groups: groups,
                        selected: groups[groupIndex].id,
                        source: frame,
                    },
                });
            });
            detail();
        }
        function showCategories(): void {
            // Capture a cursor move even before its detail debounce fires.
            detail();
            var token = ++screenToken;
            paint(function () {
                categories.show({
                    key: function (key: number): boolean {
                        if (!valid(token)) return true;
                        var keys = w.keys;
                        if (
                            key === keys.RETURN ||
                            key === keys.EXIT ||
                            key === keys.RED ||
                            key === keys.PRECH
                        ) {
                            showChannels();
                            return true;
                        }
                        var index =
                            key === keys.ENTER
                                ? w.selIndex
                                : key >= keys.N1 && key <= keys.N9
                                  ? key - keys.N1
                                  : -1;
                        if (index >= 0 && index < groups.length) {
                            if (
                                groups[index].id === "system:favorites" &&
                                w.openGlobalFavorites &&
                                w.openGlobalFavorites() !== false
                            )
                                return true;
                            groupIndex = index;
                            plexCategoryId = groups[index].id;
                            showChannels();
                            return true;
                        }
                        return false;
                    },
                    labels: groups.map(function (group) {
                        return group.name;
                    }),
                    selected: groupIndex,
                });
            });
        }
        showChannels();
        return true;
    }
    return {
        finishStartup: finishStartupLoading,
        isPlex: isPlex,
        load: load,
        open: open,
        playOrderedQueue: playOrderedQueue,
        remember: remember,
        render: render,
        restoreLast: restoreLast,
    };
}
(window as any).__ottPlexList = { create: createPlexList };
