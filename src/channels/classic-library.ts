/** Numeric positions and localized labels exist only in this renderer adapter. */
var channelLibraryInstance: any = null;
var channelLibraryView: any[] = [];
var channelLibraryGeneration = 0;
var channelLibraryBrowseTransient = false;
var channelLibraryBrowseIntent = 0;
var channelLibraryFavoritesSelectionKey = "globalFavoritesSelection";
var channelRemoteCatalog: any = null;
var channelPreferenceKinds: any = {
    aAspects: "aspect",
    aAudios: "audio",
    aSubs: "subtitle",
    aZooms: "zoom",
};

function channelLibraryIndex(id: string): number {
    for (var i = 0; i < channelLibraryView.length; i++)
        if (channelLibraryView[i].id === id) return i;
    return -1;
}

function channelLibraryBrowsingIndex(host: any): number {
    var preference = channelLibraryFavoritesSelection(host);
    var id = channelLibraryInstance?.browsedGroup?.();
    if (preference === "1") id = "system:favorites";
    else if (preference === "0" && id === "system:favorites") id = "system:all";
    var index = id ? channelLibraryIndex(id) : host.catIndex;
    return typeof index === "number" && index >= 0 && channelLibraryView[index]
        ? index
        : channelLibraryIndex("system:all");
}

function channelLibraryFavoritesSelection(host: any): string | null {
    try {
        var get = host.stbGetPersistedItem || host.stbGetItem;
        return typeof get === "function"
            ? get.call(host, channelLibraryFavoritesSelectionKey)
            : null;
    } catch (_) {
        return null;
    }
}

function captureChannelLibraryCategoryOwner(host: any): () => boolean {
    var library = channelLibraryInstance;
    var generation = channelLibraryGeneration;
    var sourcePort = host.__ottSourceIdentity;
    var sourceCurrent = sourcePort?.current;
    var source: any;
    var valid = true;
    try {
        if (typeof sourceCurrent === "function")
            source = sourceCurrent.call(sourcePort, host);
    } catch (_) {
        valid = false;
    }
    return function (): boolean {
        try {
            return !!(
                valid &&
                generation === channelLibraryGeneration &&
                library === channelLibraryInstance &&
                (!library || library.active()) &&
                sourcePort === host.__ottSourceIdentity &&
                sourceCurrent === host.__ottSourceIdentity?.current &&
                (typeof sourceCurrent !== "function" ||
                    source === sourceCurrent.call(sourcePort, host))
            );
        } catch (_) {
            return false;
        }
    };
}

function rememberChannelLibraryCategory(host: any, groupId: string): boolean {
    var intent = ++channelLibraryBrowseIntent;
    var library = channelLibraryInstance;
    var owner = captureChannelLibraryCategoryOwner(host);
    if (
        !owner() ||
        (!library && groupId !== "system:favorites" && groupId !== "system:all")
    )
        return false;
    var get = host.stbGetItem;
    var set = host.stbSetItem;
    var persisted = host.stbGetPersistedItem;
    var remove = host.stbDelItem;
    // Legacy hosts without global storage retain their per-source category.
    if (typeof get !== "function" || typeof set !== "function")
        return !!library && library.browse(groupId);
    var key = channelLibraryFavoritesSelectionKey;
    var value = groupId === "system:favorites" ? "1" : "0";
    var prior: string | null;
    var changed = false;
    function current(): boolean {
        return (
            intent === channelLibraryBrowseIntent &&
            owner() &&
            get === host.stbGetItem &&
            set === host.stbSetItem &&
            persisted === host.stbGetPersistedItem &&
            remove === host.stbDelItem
        );
    }
    function rollback(): void {
        try {
            if (!changed || !current()) return;
            if (get.call(host, key) === value) {
                if (prior === null) remove?.call(host, key);
                else set.call(host, key, prior);
            }
        } catch (_) {}
        // A failed or memory-only rollback must not look like a restored
        // category. Re-read both views even if the rollback writer threw.
        try {
            if (!current()) return;
            var live = get.call(host, key);
            var durable =
                typeof persisted === "function"
                    ? persisted.call(host, key)
                    : live;
            if (live === prior && durable === prior) return;
        } catch (_) {}
        try {
            if (current())
                host.showShift?.(
                    host._("Favorites") + ": " + host._("Unavailable")
                );
        } catch (_) {}
    }
    try {
        prior = get.call(host, key);
        if (
            !current() ||
            (typeof persisted === "function" &&
                persisted.call(host, key) !== prior) ||
            !current() ||
            (prior === null && typeof remove !== "function")
        )
            return false;
        if (prior !== value) {
            changed = true;
            // This installation-wide key is never provider-prefixed or part
            // of a temporary Local playback overlay.
            set.call(host, key, value);
        }
        if (
            !current() ||
            get.call(host, key) !== value ||
            (typeof persisted === "function" &&
                persisted.call(host, key) !== value) ||
            !current() ||
            (library &&
                !library.browse(
                    groupId,
                    typeof host.providerGetPersistedItem === "function"
                ))
        ) {
            rollback();
            return false;
        }
        return true;
    } catch (_) {
        rollback();
        return false;
    }
}

function showChannelLibraryGroup(
    host: any,
    category: number,
    index: number,
    remember: boolean
): void {
    var transient = channelLibraryBrowseTransient;
    channelLibraryBrowseTransient = !remember;
    try {
        host.channelsList(category, index);
    } finally {
        channelLibraryBrowseTransient = transient;
    }
}

function channelLibraryPublish(host: any): void {
    if (!channelLibraryInstance || !channelLibraryInstance.active()) return;
    var previousId = host.curList && host.curList[host.primaryIndex];
    var previousGroup = channelLibraryView[host.catIndex];
    var library = channelLibraryInstance;
    var snapshot = library.snapshot();
    var all = { id: "system:all", label: host._("All"), members: snapshot.all };
    channelLibraryView = [all].concat(snapshot.groups);
    {
        // Global Favorites remains accessible independently of per-source edit mode.
        var available: any = Object.create(null);
        var added: any = Object.create(null);
        var members: any[] = [];
        function key(id: any): string | null {
            return typeof id === "string" ||
                (typeof id === "number" && id === id)
                ? typeof id + ":" + String(id)
                : null;
        }
        snapshot.all.forEach(function (id: any) {
            var value = key(id);
            if (value !== null) available[value] = true;
        });
        function include(id: any): void {
            var value = key(id);
            if (value !== null && available[value] && !added[value]) {
                added[value] = true;
                members.push(id);
            }
        }
        (host.favoritesArray || []).forEach(include);
        var media =
            host.__ottMedia?.categoryMembers?.(snapshot.all, host.channels) ||
            [];
        media.forEach(include);
        if (channelLibraryInstance !== library || !library.active()) return;
        var favorites = {
            id: "system:favorites",
            label: host._("Favorites"),
            members: members,
        };
        if (host.sFavorites === 1) channelLibraryView.unshift(favorites);
        else channelLibraryView.push(favorites);
    }
    var categories: Record<string, number[]> = Object.create(null);
    var labels: string[] = [];
    channelLibraryView.forEach(function (group) {
        var label = group.label;
        // Provider names can coincide with translated virtual names. Keep both accessible.
        while (Object.prototype.hasOwnProperty.call(categories, label))
            label += " ";
        labels.push(label);
        categories[label] = group.members.slice();
    });
    host.catsArray = labels;
    host.cats = categories;
    host.parentalArray = snapshot.locks;
    var libraryOwner = channelLibraryInstance;
    var remote: any = {
        active: function () {
            return (
                channelRemoteCatalog === remote &&
                channelLibraryInstance === libraryOwner &&
                libraryOwner.active()
            );
        },
        all: snapshot.all.slice(),
        canonicalIds: (host.cList || []).slice(),
        generation: channelLibraryGeneration,
        groups: channelLibraryView.map(function (group) {
            return {
                id: group.id,
                members: group.members.slice(),
                name: group.label,
            };
        }),
    };
    channelRemoteCatalog = remote;
    var selected = snapshot.selected;
    var wantedGroup = selected
        ? selected.groupId
        : previousGroup && previousGroup.id;
    var category = channelLibraryIndex(wantedGroup);
    if (category < 0) category = host.sFavorites === 1 ? 1 : 0;
    var list = categories[labels[category]] || [];
    var index = -1;
    if (selected) {
        for (var i = 0; i < list.length; i++)
            if (channelLibraryInstance.itemId(list[i]) === selected.itemId) {
                index = i;
                break;
            }
    } else index = list.indexOf(previousId);
    host.catIndex = category;
    host.curList = list;
    host.primaryIndex = index < 0 ? 0 : index;
}

function mountChannelLibrary(host: any): void {
    var generation = ++channelLibraryGeneration;
    var source = host.__ottSourceIdentity.current(host);
    var get = host.providerGetItem;
    var getPersisted = host.providerGetPersistedItem;
    var set = host.providerSetItem;
    var rows: any[] = [];
    (host.cList || []).forEach(function (id: number) {
        var channel = host.channels[id];
        if (!channel) return;
        var category = channel.category || {};
        rows.push({
            groupId: String(
                channel.groupId || "provider:" + (category.name || "Other")
            ),
            groupLabel: String(category.name || "Other"),
            groups: Array.isArray(channel.__ottMediaCategories)
                ? channel.__ottMediaCategories.map(function (group: any) {
                      return { id: group.id, label: group.name };
                  })
                : undefined,
            id: id,
            itemId: String(channel.itemId || "channel:" + id),
            label: String(channel.channel_name || ""),
            legacyId: channel.legacyChannelId,
            locked: !!(
                channel.adult ||
                (host.parental && host.parental.test(category.name || ""))
            ),
        });
    });
    channelLibraryInstance = host.__ottChannelLibrary.create(
        {
            current: function () {
                return (
                    generation === channelLibraryGeneration &&
                    source === host.__ottSourceIdentity.current(host) &&
                    get === host.providerGetItem &&
                    getPersisted === host.providerGetPersistedItem &&
                    set === host.providerSetItem
                );
            },
            get: function (key: string) {
                return get.call(host, key);
            },
            getPersisted: function (key: string) {
                return typeof getPersisted === "function"
                    ? getPersisted.call(host, key)
                    : null;
            },
            legacySelection: {
                category: host.catIndex,
                favorites: host.sFavorites ? host.favoritesArray : null,
                index: host.primaryIndex,
                virtualLabels: [host._("All"), host._("Favorites")],
            },
            set: function (key: string, value: string) {
                set.call(host, key, value);
            },
            sourceId: source,
        },
        rows
    );
    var local =
        host.__ottActiveProviderDriver?.id === "offline" &&
        host.__ottLocalMedia;
    var pendingOrder = local?.playbackOrder?.();
    if (pendingOrder) {
        if (!channelLibraryInstance.adoptPlaybackOrder(pendingOrder))
            throw new Error("The local playback order could not be saved");
        local.playbackOrdered();
    }
    channelLibraryInstance.persist();
    channelLibraryView = [];
    channelLibraryPublish(host);
    host.listCatIndex = channelLibraryBrowsingIndex(host);
}

/** Retain the live list model so progressive data cannot replace its overlays. */
function captureChannelAppendView(host: any): (() => void) | null {
    var library = channelLibraryInstance;
    var port = host.__ottClassicScreenPort;
    var owner = port && port.listOwner();
    var group = channelLibraryView[host.listCatIndex];
    var rows = group && host.cats[host.catsArray[host.listCatIndex]];
    function current(): boolean {
        return !!(
            library === channelLibraryInstance &&
            library &&
            library.active() &&
            port === host.__ottClassicScreenPort &&
            owner &&
            owner.active() &&
            owner === port.listOwner() &&
            host.isListVisible &&
            rows &&
            host.listArray === rows &&
            host.listDataArray === rows &&
            owner.model.items === rows &&
            owner.model.rows === rows &&
            typeof host.channelsKeyHandler === "function" &&
            owner.model.handler === host.channelsKeyHandler &&
            host.listKeyHandler === host.channelsKeyHandler
        );
    }
    if (!current()) return null;
    var focused = rows[host.selIndex];
    return function () {
        if (!current()) return;
        var category = channelLibraryIndex(group.id);
        if (category < 0) return;
        var label = host.catsArray[category];
        var next = host.cats[label];
        var changed = rows.length !== next.length;
        for (var i = 0; i < next.length; i++) {
            if (rows[i] !== next[i]) changed = true;
            rows[i] = next[i];
        }
        rows.length = next.length;
        host.cats[label] = rows;
        if (host.curList === next) host.curList = rows;
        host.listCatIndex = category;
        host.selIndex = Math.max(0, rows.indexOf(focused));
        if (
            changed &&
            owner.foreground() &&
            typeof host.showPage === "function"
        )
            host.showPage();
    };
}

function appendChannelLibrary(host: any, ids: any[]): void {
    if (!channelLibraryInstance || !channelLibraryInstance.active()) return;
    var updateView = captureChannelAppendView(host);
    channelLibraryInstance.append(
        ids.map(function (id: any) {
            var channel = host.channels[id];
            var category = channel.category || {};
            return {
                groupId: String(
                    channel.groupId || "provider:" + (category.name || "Other")
                ),
                groupLabel: String(category.name || "Other"),
                groups: Array.isArray(channel.__ottMediaCategories)
                    ? channel.__ottMediaCategories.map(function (group: any) {
                          return { id: group.id, label: group.name };
                      })
                    : undefined,
                id: id,
                itemId: String(channel.itemId || "channel:" + id),
                label: String(channel.channel_name || ""),
                locked: !!(
                    channel.adult ||
                    (host.parental && host.parental.test(category.name || ""))
                ),
            };
        })
    );
    channelLibraryPublish(host);
    if (updateView) updateView();
}

function channelLibraryChange(action: string, value?: any, extra?: any): any {
    var host = window as any;
    var library = channelLibraryInstance;
    if (!library || !library.active()) return false;
    var result: any = false;
    if (action === "create") result = library.createGroup(value, extra);
    if (action === "rename") result = library.renameGroup(value, extra);
    if (action === "remove") result = library.removeGroup(value);
    if (action === "move") result = library.moveGroup(value, extra);
    if (action === "member")
        result = library.changeMember(
            value.groupId,
            value.channelId,
            value.action,
            value.delta
        );
    if (action === "lock") result = library.lock(value, extra);
    if (action === "shuffle") result = library.shuffleGroup(value);
    if (action === "resetShuffle") result = library.resetShuffle(value);
    if (result) channelLibraryPublish(host);
    return result;
}

(window as any).__ottChannels = {
    append: function (ids: any[]): void {
        appendChannelLibrary(window, ids);
    },
    browse: function (groupId: string, remember = true) {
        var host = window as any;
        var index = channelLibraryIndex(groupId);
        if (
            index < 0 ||
            !channelLibraryInstance ||
            !channelLibraryInstance.active() ||
            host.__ottKiosk?.locked() ||
            typeof host.channelsList !== "function"
        )
            return false;
        showChannelLibraryGroup(host, index, 0, remember);
        return true;
    },
    browsingGroup: function () {
        var host = window as any;
        var index =
            typeof host.listCatIndex === "number"
                ? host.listCatIndex
                : host.catIndex;
        return channelLibraryView[index] && channelLibraryView[index].id;
    },
    browsingIndex: function () {
        return channelLibraryBrowsingIndex(window);
    },
    capture: function (category: number) {
        var host = window as any;
        var library = channelLibraryInstance;
        var catalog = host.channels;
        var group = channelLibraryView[category];
        function active(): boolean {
            return !!(
                library &&
                library === channelLibraryInstance &&
                library.active() &&
                catalog === host.channels
            );
        }
        function locate(): number {
            return active() && group ? channelLibraryIndex(group.id) : -1;
        }
        if (!group || !active()) return null;
        return {
            active: active,
            category: locate,
            members: function () {
                var category = locate();
                return category < 0
                    ? []
                    : (host.cats[host.catsArray[category]] || []).slice();
            },
            neighbours: function (id: string | number) {
                var category = locate();
                if (category < 0) return null;
                var members = host.cats[host.catsArray[category]] || [];
                var index = host.primaryIndex;
                if (String(members[index]) !== String(id)) {
                    index = -1;
                    for (var i = 0; i < members.length; i++)
                        if (String(members[i]) === String(id)) {
                            index = i;
                            break;
                        }
                }
                return index < 0
                    ? null
                    : {
                          id: members[index],
                          index: index,
                          length: members.length,
                          nextId: members[(index + 1) % members.length],
                      };
            },
            position: function (id: number) {
                var category = locate();
                var row = catalog[id];
                if (
                    category < 0 ||
                    !row ||
                    library.itemId(id) !== String(row.itemId || "channel:" + id)
                )
                    return null;
                var index = (host.cats[host.catsArray[category]] || []).indexOf(
                    id
                );
                return index < 0 ? null : [category, index];
            },
        };
    },
    captureCategoryCurrent: function () {
        var owner = captureChannelLibraryCategoryOwner(window);
        var intent = channelLibraryBrowseIntent;
        return function (): boolean {
            return owner() && intent === channelLibraryBrowseIntent;
        };
    },
    captureCategorySelection: function () {
        var owner = captureChannelLibraryCategoryOwner(window);
        var remember = !channelLibraryBrowseTransient;
        var intent = remember
            ? ++channelLibraryBrowseIntent
            : channelLibraryBrowseIntent;
        var consumed = false;
        var selection: any = function (groupId: string): boolean {
            if (consumed || !selection.current()) return false;
            consumed = true;
            if (!remember) return true;
            intent++;
            return rememberChannelLibraryCategory(window, groupId);
        };
        selection.current = function (): boolean {
            return owner() && intent === channelLibraryBrowseIntent;
        };
        return selection;
    },
    capturePreference: function (name: string, channelId: number | null) {
        var host = window as any;
        var library = channelLibraryInstance;
        var catalog = host.channels;
        var kind = channelPreferenceKinds[name];
        function active(): boolean {
            return !!(
                kind &&
                library &&
                library === channelLibraryInstance &&
                library.active() &&
                catalog === host.channels &&
                (channelId === null || library.itemId(channelId))
            );
        }
        if (!active()) return null;
        return {
            active: active,
            get: function () {
                return active()
                    ? library.preference(kind, channelId)
                    : undefined;
            },
            saved: function () {
                return active()
                    ? library.savedPreference(kind, channelId)
                    : undefined;
            },
            set: function (value: number) {
                return (
                    active() &&
                    library.setPreference(kind, channelId, value, true)
                );
            },
        };
    },
    change: channelLibraryChange,
    document: function () {
        return channelLibraryInstance
            ? channelLibraryInstance.document()
            : null;
    },
    group: function (index: number) {
        return channelLibraryView[index] && channelLibraryView[index].id;
    },
    index: channelLibraryIndex,
    mount: mountChannelLibrary,
    preference: function (name: string, channelId: number | null) {
        var kind = channelPreferenceKinds[name];
        return channelLibraryInstance && channelLibraryInstance.active() && kind
            ? channelLibraryInstance.preference(kind, channelId)
            : undefined;
    },
    refresh: function () {
        channelLibraryPublish(window as any);
    },
    rememberCategory: function (category: number | string): boolean {
        if (channelLibraryBrowseTransient) return false;
        if (
            !channelLibraryInstance &&
            (category === "system:favorites" || category === "system:all")
        )
            return rememberChannelLibraryCategory(window, category);
        var index =
            typeof category === "string"
                ? channelLibraryIndex(category)
                : category;
        var group = channelLibraryView[index];
        return !!(group && rememberChannelLibraryCategory(window, group.id));
    },
    remoteCatalog: function () {
        return channelRemoteCatalog && channelRemoteCatalog.active()
            ? channelRemoteCatalog
            : null;
    },
    reset: function () {
        channelRemoteCatalog = null;
        channelLibraryGeneration++;
        channelLibraryInstance = null;
        channelLibraryView = [];
    },
    restoreBrowsing: function (): boolean {
        var host = window as any;
        var library = channelLibraryInstance;
        if (
            !library?.active() ||
            (!library.browsedGroup() &&
                channelLibraryFavoritesSelection(host) !== "1") ||
            host.__ottStandby?.blocked() ||
            host.__ottKiosk?.enabled() ||
            typeof host.channelsList !== "function"
        )
            return false;
        var port = host.__ottClassicScreenPort;
        port?.reconcile?.();
        if (
            library !== channelLibraryInstance ||
            !library.active() ||
            port !== host.__ottClassicScreenPort ||
            port?.screens.current()
        )
            return false;
        var category = channelLibraryBrowsingIndex(host);
        if (category < 0) return false;
        var list = host.cats[host.catsArray[category]] || [];
        var current = host.curList && host.curList[host.primaryIndex];
        showChannelLibraryGroup(
            host,
            category,
            Math.max(0, list.indexOf(current)),
            false
        );
        return true;
    },
    select: function (category: number, id: number) {
        var group = channelLibraryView[category];
        return (
            !!group &&
            !!channelLibraryInstance &&
            channelLibraryInstance.select(group.id, id)
        );
    },
    setPreference: function (
        name: string,
        channelId: number | null,
        value: number | null | undefined
    ) {
        var kind = channelPreferenceKinds[name];
        return channelLibraryInstance && kind
            ? channelLibraryInstance.setPreference(kind, channelId, value)
            : false;
    },
};
