import { isGlobalFavoriteSelector } from "../settings/global-favorites-bindings";
import {
    globalFavoriteCanonical,
    globalFavoriteChannelId,
    globalFavoriteProviderId,
} from "./global-favorites-identities";
import {
    globalFavoriteBuiltin,
    globalFavoriteBuiltinChoices,
    globalFavoriteBuiltinConfiguration,
    globalFavoriteBuiltinSlot,
} from "./global-favorites-providers";

/** Actual provider operations. Imported descriptors never supply a private slot. */
export function createGlobalFavoritesPlayer(w: any, ports: any): any {
    // MAIN supplies existing implementations; optional modules never import MAIN.
    var remoteCheckpoint = ports.remoteCheckpoint,
        handleRemoteProfiles = ports.handleRemoteProfiles,
        isProviderAllowed = ports.isProviderAllowed,
        selectProviderByIndex = ports.selectProviderByIndex;
    var read = w.stbGetItem;
    function localItemRelativePath(item: any): string | null {
        return typeof ports.localItemRelativePath === "function"
            ? ports.localItemRelativePath(item)
            : null;
    }
    function allowed(): boolean {
        return (
            read === w.stbGetItem &&
            ports.current() &&
            !w.__ottStandby?.blocked() &&
            !w.__ottKiosk?.enabled() &&
            !w.__ottParental?.needs("providers") &&
            !w.__ottParental?.needs("settings")
        );
    }
    function configuration(provider: string): any {
        var key =
            provider === "m3u"
                ? "m3um3uArr"
                : provider === "vportal"
                  ? "vportalprofiles"
                  : provider === "offline"
                    ? "offlineProfiles"
                    : provider === "plex"
                      ? "plexcfg"
                      : "";
        if (!key) return null;
        var raw = read.call(w, key);
        if (!raw)
            return provider === "offline" ? { active: -1, profiles: [] } : null;
        if (raw.length > 1048576) return null;
        try {
            return JSON.parse(raw);
        } catch (_) {
            return null;
        }
    }
    function selected(provider: string, slot: number | null): any {
        var cfg = configuration(provider);
        if (!cfg)
            return globalFavoriteBuiltinConfiguration(
                w,
                globalFavoriteBuiltin(w, provider),
                slot
            );
        if (provider === "plex") {
            if (slot !== null) return null;
            if (w.__ottPlex?.normalize) return w.__ottPlex.normalize(cfg);
            var plex: any = {
                address: String(cfg.address || cfg.server || "")
                    .trim()
                    .replace(/\/+$/, ""),
                playback:
                    cfg.playback === "original" || cfg.playback === "compatible"
                        ? cfg.playback
                        : "auto",
                token: typeof cfg.token === "string" ? cfg.token.trim() : "",
            };
            if (cfg.folders !== undefined) {
                plex.folders = cfg.folders;
                if (cfg.folderSelection === true) plex.folderSelection = true;
            }
            return plex;
        }
        if (provider === "offline" && slot === null)
            return {
                default: true,
                library: w.__ottLocalMedia?.libraryIdentity(),
            };
        var rows =
            provider === "m3u"
                ? cfg.M3Us
                : provider === "vportal"
                  ? cfg.portals
                  : cfg.profiles;
        var value =
            typeof slot === "number" &&
            isFinite(slot) &&
            Math.floor(slot) === slot &&
            slot >= 0 &&
            slot < 15 &&
            Array.isArray(rows)
                ? rows[slot!] || null
                : null;
        if (provider === "m3u" && value) {
            var normalized: any = {
                rechours:
                    typeof value.rechours === "string" ||
                    typeof value.rechours === "number"
                        ? value.rechours
                        : 0,
                www: typeof value.www === "string" ? value.www : "",
            };
            ["name", "medUrl", "medSourceId"].forEach(function (key) {
                if (typeof value[key] === "string")
                    normalized[key] = value[key];
            });
            return normalized;
        }
        if (provider === "vportal" && value)
            return {
                link: typeof value.link === "string" ? value.link : "",
                name: typeof value.name === "string" ? value.name : "",
                sections: Array.isArray(value.sections) ? value.sections : [],
            };
        if (provider === "offline" && value) {
            try {
                return /* biome-ignore assist/source/useSortedKeys: Preserve the captured profile before the external storage-reader callback. */ {
                    profile: value,
                    binding:
                        JSON.parse(
                            read.call(w, "offlineProfileBindings") || "{}"
                        )[value.binding_id] || null,
                };
            } catch (_) {
                return null;
            }
        }
        return value;
    }
    function activeSlot(provider: string): number | null {
        var cfg = configuration(provider);
        if (!cfg)
            return globalFavoriteBuiltinSlot(
                w,
                globalFavoriteBuiltin(w, provider) || {}
            );
        if (
            provider === "plex" ||
            (provider === "offline" && cfg && cfg.active < 0)
        )
            return null;
        var value = cfg && cfg.active;
        return typeof value === "number" &&
            Math.floor(value) === value &&
            value >= 0 &&
            value < 15
            ? value
            : provider === "offline"
              ? null
              : 0;
    }
    async function choices(providerName: string): Promise<any[]> {
        var provider = providerName === "local" ? "offline" : providerName;
        var builtin = globalFavoriteBuiltin(w, providerName);
        if (builtin) provider = builtin.id;
        var cfg = configuration(provider),
            result: any[] = [];
        if (!cfg) return globalFavoriteBuiltinChoices(w, builtin);
        if (provider === "offline") {
            try {
                var snapshot = w.__ottLocalMedia.favoriteSnapshot();
                var local = w.__ottLocalMedia;
                var sources =
                    snapshot && snapshot.current()
                        ? snapshot.catalog.sources
                        : (await local.remoteSources(false, undefined, allowed))
                              .sources;
                if (!allowed()) return [];
                sources.forEach(function (root: any) {
                    if (root.kind === "folder")
                        result.push({
                            alias: root.name,
                            label: "Local videos / " + root.name,
                            profile: "Local videos",
                            provider: provider,
                            root: { alias: root.name, id: root.id, key: "s0" },
                            slot: null,
                        });
                });
            } catch (_) {}
        }
        if (provider === "plex")
            return [
                {
                    label: "Plex",
                    profile: "Plex",
                    provider: provider,
                    slot: null,
                },
            ];
        var rows =
            provider === "m3u"
                ? cfg.M3Us
                : provider === "vportal"
                  ? cfg.portals
                  : cfg.profiles;
        (Array.isArray(rows) ? rows : []).slice(0, 15).forEach(function (
            row: any,
            slot: number
        ) {
            if (!row || !row.name) return;
            if (provider !== "offline") {
                if (
                    row.www ||
                    row.link ||
                    (provider === "m3u" &&
                        row.medUrl &&
                        w.__ottVPortal?.parse(row.medUrl))
                )
                    result.push({
                        alias: row.name,
                        label: row.name,
                        profile: row.name,
                        provider: provider,
                        slot: slot,
                    });
                return;
            }
            var value = selected(provider, slot);
            if (!value?.binding) return;
            row.sources.forEach(function (root: any) {
                var id = value.binding.sources[root.key];
                if (root.kind === "folder" && id)
                    result.push({
                        alias: root.name,
                        label: row.name + " / " + root.name,
                        profile: row.name,
                        provider: provider,
                        root: { alias: root.name, id: id, key: root.key },
                        slot: slot,
                    });
            });
        });
        return result;
    }
    async function choiceTarget(
        origin: any,
        choice: any,
        locator?: any
    ): Promise<any> {
        if (
            !allowed() ||
            !(await choices(origin.provider)).some(function (value) {
                return (
                    globalFavoriteCanonical(value) ===
                    globalFavoriteCanonical(choice)
                );
            })
        )
            return null;
        var value = selected(choice.provider, choice.slot),
            text = value && globalFavoriteCanonical(value);
        if (!text) return null;
        var selector: any =
            /* biome-ignore assist/source/useSortedKeys: Preserve captured selector reads before awaiting the digest callback. */ {
                kind: "global-playback-target",
                origin: origin,
                provider: choice.provider,
                slot: choice.slot,
                configurationDigest: await ports.sha256(text),
            };
        if (choice.root) {
            if (!locator || locator.kind !== "local-media") return null;
            selector.root = {
                alias: locator.rootAlias,
                id: choice.root.id,
                key: choice.root.key,
            };
        }
        if (!isGlobalFavoriteSelector(selector)) return null;
        return {
            current: function () {
                return (
                    allowed() &&
                    globalFavoriteCanonical(
                        selected(choice.provider, choice.slot)
                    ) === text
                );
            },
            ephemeral: true,
            locatorKind: locator?.kind,
            origin: origin,
            selector: selector,
        };
    }
    async function captureSelector(
        origin: any,
        slot: number | null,
        root?: any
    ): Promise<any> {
        var builtin = globalFavoriteBuiltin(w, origin.provider);
        var provider =
            origin.provider === "local"
                ? "offline"
                : builtin
                  ? builtin.id
                  : origin.provider;
        if (
            !allowed() ||
            w.__ottActiveProviderDriver?.id !== provider ||
            activeSlot(provider) !== slot
        )
            return null;
        var value = selected(provider, slot),
            text = value && globalFavoriteCanonical(value);
        if (!text) return null;
        if (provider === "plex") {
            var proof = w.__ottActiveProviderDriver.favoritesSource?.();
            if (!proof || !proof.current()) return null;
        }
        if (provider === "offline") {
            if (!root) return null;
            if (slot === null) {
                var view = w.__ottLocalMedia.favoriteSnapshot(),
                    catalog = view?.catalog;
                if (
                    !view ||
                    !view.current() ||
                    !allowed() ||
                    !catalog ||
                    !catalog.sources.some(function (item: any) {
                        return item.id === root.id && item.kind === "folder";
                    })
                )
                    return null;
            } else if (
                !value.binding ||
                value.binding.sources[root.key] !== root.id ||
                value.binding.library !== w.__ottLocalMedia?.libraryIdentity()
            )
                return null;
        }
        var digest = await ports.sha256(text);
        if (
            !allowed() ||
            activeSlot(provider) !== slot ||
            globalFavoriteCanonical(selected(provider, slot)) !== text
        )
            return null;
        var selector: any = {
            configurationDigest: digest,
            kind: "global-playback-target",
            origin: origin,
            provider: provider,
            slot: slot,
        };
        if (provider === "offline")
            selector.root = { alias: root.alias, id: root.id, key: root.key };
        return isGlobalFavoriteSelector(selector) ? selector : null;
    }
    async function targets(
        origin: any,
        current: () => boolean,
        locator?: any
    ): Promise<any[]> {
        if (!current() || !allowed()) return [];
        var snapshot = await ports.bindings.list(),
            found: any[] = [];
        for (var index = 0; index < snapshot.entries.length; index++) {
            var row = snapshot.entries[index];
            if (row.kind !== "source") continue;
            var bound: any;
            try {
                bound = ports.bindings.resolve(row.id);
            } catch (_) {
                continue;
            }
            var selector = bound.binding && bound.binding.selector;
            if (
                !isGlobalFavoriteSelector(selector) ||
                globalFavoriteCanonical(selector.origin) !==
                    globalFavoriteCanonical(origin)
            )
                continue;
            var value = selected(selector.provider, selector.slot),
                text = value && globalFavoriteCanonical(value);
            if (
                !text ||
                (await ports.sha256(text)) !== selector.configurationDigest
            )
                continue;
            if (
                !current() ||
                !allowed() ||
                globalFavoriteCanonical(
                    selected(selector.provider, selector.slot)
                ) !== text
            )
                return [];
            (function (
                selector: any,
                rowId: string,
                text: string,
                revision: number
            ) {
                function valid(): boolean {
                    try {
                        var now = ports.bindings.resolve(rowId);
                        return (
                            allowed() &&
                            now.revision === revision &&
                            globalFavoriteCanonical(now.binding.selector) ===
                                globalFavoriteCanonical(selector) &&
                            globalFavoriteCanonical(
                                selected(selector.provider, selector.slot)
                            ) === text
                        );
                    } catch (_) {
                        return false;
                    }
                }
                found.push({
                    current: valid,
                    locatorKind: locator?.kind,
                    origin: selector.origin,
                    selector: selector,
                });
            })(selector, row.id, text, bound.revision);
        }
        if (!found.length) {
            var available = await choices(origin.provider);
            for (var i = 0; i < available.length; i++) {
                var choice = available[i];
                if (
                    choice.profile !== origin.profile ||
                    (choice.subprofile !== undefined &&
                        choice.subprofile !== origin.subprofile) ||
                    (choice.alias !== origin.sourceAlias &&
                        !(
                            origin.provider === "plex" &&
                            locator?.serverId === origin.sourceAlias
                        ))
                )
                    continue;
                var candidate = await choiceTarget(origin, choice, locator);
                if (!current()) return [];
                if (candidate) found.push(candidate);
            }
        }
        return found;
    }
    function activate(target: any, current: () => boolean): Promise<any> {
        return new Promise(function (resolve, reject) {
            var marker: any = {},
                timer: any = null,
                driver: any = null,
                expectedLoad: any;
            var profileSelected = false,
                profilePending = false,
                settled = false,
                starting = true,
                ownLoad = !w.commandChannelsReady,
                source: string;
            var pendingOperations: any[] = [];
            if (
                w.__ottGlobalFavoritesHandoff?.current() ||
                !current() ||
                !target.current()
            ) {
                reject(new Error("changed"));
                return;
            }
            marker.current = function () {
                return (
                    w.__ottGlobalFavoritesHandoff === marker &&
                    !marker.cancelled &&
                    current() &&
                    target.current() &&
                    (!driver || driver === w.__ottActiveProviderDriver)
                );
            };
            var expectedDispatch: any = null,
                dispatchConsumed = false;
            var playbackItem: any = null;
            marker.accept = function (command: any): boolean {
                if (!marker.current() || !expectedDispatch || dispatchConsumed)
                    return false;
                var match = expectedDispatch.items
                    ? command.type === "vod" &&
                      command.sourceId === w.__ottSourceIdentity.media(w) &&
                      command.item?.request &&
                      globalFavoriteCanonical(command.item.request) ===
                          globalFavoriteCanonical(
                              expectedDispatch.items[0].request
                          ) &&
                      (command.item.plexSource ===
                          w.__ottSourceIdentity.media(w) ||
                          command.item.vportalSource ===
                              w.__ottSourceIdentity.media(w))
                    : (command.sourceId === undefined ||
                          command.sourceId === w.__ottSourceIdentity.media(w) ||
                          command.sourceId ===
                              w.__ottSourceIdentity.current(w)) &&
                      String(
                          command.channelSelection === undefined
                              ? command.channelId
                              : command.channelSelection
                      ) === String(expectedDispatch.id);
                if (!match) return false;
                dispatchConsumed = true;
                return true;
            };
            marker.blocks = function () {
                return (
                    w.__ottGlobalFavoritesHandoff === marker &&
                    ownLoad &&
                    (starting || expectedLoad === w.__ottCommandChannelLoad)
                );
            };
            remoteCheckpoint(w);
            if (!current() || !target.current()) {
                reject(new Error("changed"));
                return;
            }
            w.__ottGlobalFavoritesHandoff = marker;
            function close(success = false): void {
                if (timer !== null) w.clearTimeout(timer);
                timer = null;
                if (w.__ottGlobalFavoritesHandoff === marker) {
                    if (
                        !success &&
                        driver === w.__ottActiveProviderDriver &&
                        expectedLoad === w.__ottCommandChannelLoad
                    ) {
                        var loading = w.__ottCommandChannelCancel;
                        if (loading?.owner === expectedLoad) loading.cancel();
                        if (driver?.cancelConnection) driver.cancelConnection();
                        if (driver?.id === "offline")
                            w.__ottLocalMedia?.cancelScan();
                    }
                    marker.cancelled = true;
                    if (success || !marker.blocks())
                        w.__ottGlobalFavoritesHandoff = null;
                }
            }
            function fail(): void {
                if (!settled) {
                    settled = true;
                    close();
                    reject(new Error("unavailable"));
                }
            }
            function later(): void {
                timer = w.setTimeout(step, 50);
            }
            function owned(): boolean {
                return (
                    w.__ottGlobalFavoritesHandoff === marker &&
                    driver === w.__ottActiveProviderDriver &&
                    expectedLoad === w.__ottCommandChannelLoad
                );
            }
            function same(): boolean {
                return (
                    owned() &&
                    marker.current() &&
                    source === w.__ottSourceIdentity.current(w)
                );
            }
            function channel(id: any, locator: any): any {
                var group = w.__ottChannels.index("system:all");
                var members = group >= 0 && w.cats[w.catsArray[group]];
                var index = Array.isArray(members) ? members.indexOf(id) : -1;
                return index < 0
                    ? null
                    : {
                          available: true,
                          group: group,
                          id: id,
                          index: index,
                          locator: locator,
                      };
            }
            async function resolveItem(
                locator: any,
                guard: () => boolean
            ): Promise<any> {
                if (!same() || !guard()) return null;
                if (driver.id === "m3u" && locator.kind === "vportal-media") {
                    var embedded = w.__ottEmbeddedVPortal;
                    if (!embedded || !embedded.current()) return null;
                    var folder = target.origin.subprofile;
                    return new Promise(function (done) {
                        var cancel = embedded.client.playlist(
                            [
                                {
                                    __ottCategoryRoot: true,
                                    request: {},
                                    title: embedded.label,
                                },
                            ],
                            function (
                                items: any[],
                                complete: boolean,
                                error?: string
                            ) {
                                if (
                                    !same() ||
                                    !guard() ||
                                    !embedded.current()
                                ) {
                                    done(null);
                                    return;
                                }
                                if (!complete) return;
                                if (error) {
                                    done(null);
                                    return;
                                }
                                var found = items.filter(function (item: any) {
                                    return (
                                        item.vportalSource ===
                                            w.__ottSourceIdentity.media(w) &&
                                        item.__ottFavoriteId?.field ===
                                            locator.idField &&
                                        globalFavoriteProviderId(
                                            item.__ottFavoriteId.value
                                        ) === locator.id &&
                                        (folder === null ||
                                            (
                                                item.__ottMediaCategories || []
                                            ).some(function (category: any) {
                                                return category.name === folder;
                                            }))
                                    );
                                });
                                done(
                                    found.length === 1
                                        ? {
                                              available: true,
                                              items: found,
                                              locator: locator,
                                          }
                                        : null
                                );
                            }
                        );
                        if (typeof cancel === "function")
                            pendingOperations.push(function () {
                                cancel();
                                done(null);
                            });
                    });
                }
                if (locator.kind === "local-media") {
                    var local = w.__ottLocalMedia,
                        root = target.selector.root;
                    if (
                        !root ||
                        root.alias !== locator.rootAlias ||
                        !root.id ||
                        !local
                    )
                        return null;
                    var localProof =
                        locator.relativePath.indexOf("/") < 0
                            ? await ports.localFavoriteProof?.(
                                  target.selector,
                                  locator
                              )
                            : null;
                    if (
                        (locator.relativePath.indexOf("/") < 0 &&
                            !localProof) ||
                        !same() ||
                        !guard()
                    )
                        return null;
                    var localCurrent = function (): boolean {
                        return (
                            same() &&
                            guard() &&
                            (!localProof || localProof.current())
                        );
                    };
                    var localMatches = function (item: any): boolean {
                        return (
                            item.sourceId === root.id &&
                            localItemRelativePath(item) ===
                                locator.relativePath &&
                            item.available !== false &&
                            (!localProof ||
                                (item.id === localProof.itemId &&
                                    item.sourceId === localProof.sourceId &&
                                    item.relativePath ===
                                        localProof.relativePath))
                        );
                    };
                    if (!localCurrent()) return null;
                    var pending = local.remoteCatalog(
                        localCurrent,
                        root.id,
                        function (catalog: any) {
                            return (
                                localCurrent() &&
                                catalog.items.some(localMatches)
                            );
                        }
                    );
                    if (typeof pending.cancel === "function")
                        pendingOperations.push(function () {
                            pending.cancel();
                        });
                    var catalog = await pending;
                    if (!localCurrent() || catalog.cancelled) return null;
                    var rows = catalog.items.filter(localMatches);
                    if (rows.length !== 1) return null;
                    var resolved = channel("local-" + rows[0].id, locator);
                    if (resolved && localProof)
                        resolved.localProof = localProof;
                    return resolved;
                }
                // Stalker keys include the whole folder route, so a published leaf
                // can resolve immediately while unrelated branches keep loading.
                if (
                    driver.id === "stalker" &&
                    locator.kind === "channel" &&
                    /^stalker-media:/.test(locator.channelId)
                ) {
                    if (driver.startMedia) driver.startMedia();
                    var foundStalker = await new Promise<boolean>(
                        function (done) {
                            var wait: any = null,
                                deadline: any = null,
                                finished = false;
                            var expires = Date.now() + 120000;
                            function finish(value: boolean) {
                                if (finished) return;
                                finished = true;
                                if (wait !== null) w.clearTimeout(wait);
                                if (deadline !== null) w.clearTimeout(deadline);
                                done(value);
                            }
                            pendingOperations.push(function () {
                                finish(false);
                            });
                            function poll() {
                                wait = null;
                                if (
                                    !same() ||
                                    !guard() ||
                                    Date.now() >= expires
                                )
                                    return finish(false);
                                if (driver.hasMediaKey?.(locator.channelId))
                                    return finish(true);
                                if (!driver.catalogLoading?.())
                                    return finish(false);
                                wait = w.setTimeout(poll, 50);
                            }
                            deadline = w.setTimeout(function () {
                                finish(false);
                            }, 120000);
                            poll();
                        }
                    );
                    if (!foundStalker || !same() || !guard()) return null;
                }
                // The provider collector traverses nested folders and publishes prefixes.
                // Only its completed source catalog proves that an ID is unique.
                if (
                    locator.kind === "vportal-media" &&
                    driver.catalogLoading()
                ) {
                    var complete = await new Promise<boolean>(function (done) {
                        var wait: any = null,
                            finished = false;
                        function finish(value: boolean) {
                            if (finished) return;
                            finished = true;
                            if (wait !== null) w.clearTimeout(wait);
                            done(value);
                        }
                        pendingOperations.push(function () {
                            finish(false);
                        });
                        function poll() {
                            wait = null;
                            if (!same() || !guard()) {
                                finish(false);
                                return;
                            }
                            if (!driver.catalogLoading()) {
                                finish(!driver.catalogError());
                                return;
                            }
                            wait = w.setTimeout(poll, 50);
                        }
                        poll();
                    });
                    if (!complete || !same() || !guard()) return null;
                }
                if (locator.kind === "vportal-media" && driver.catalogError())
                    return null;
                var ids = (w.cList || []).filter(function (id: any) {
                    var value = w.channels[id],
                        payload = value && value.__ottMediaItem;
                    if (!value) return false;
                    if (locator.kind === "channel")
                        return (
                            globalFavoriteChannelId(driver.id, value) ===
                                locator.channelId &&
                            (driver.id !== "stalker" ||
                                !/^stalker-media:/.test(locator.channelId) ||
                                payload?.stalkerSource ===
                                    w.__ottSourceIdentity.media(w))
                        );
                    if (locator.kind === "channel-name")
                        return (
                            value.channel_name === locator.name &&
                            (locator.group === null ||
                                value.category?.name === locator.group)
                        );
                    if (locator.kind === "vportal-media")
                        return (
                            payload?.__ottFavoriteId?.field ===
                                locator.idField &&
                            globalFavoriteProviderId(
                                payload.__ottFavoriteId.value
                            ) === locator.id &&
                            (target.origin.subprofile === null ||
                                (payload.__ottMediaCategories || []).some(
                                    function (category: any) {
                                        return (
                                            category.name ===
                                            target.origin.subprofile
                                        );
                                    }
                                ))
                        );
                    return (
                        locator.kind === "plex-media" &&
                        payload &&
                        payload.request &&
                        payload.request.path ===
                            "/library/metadata/" + locator.ratingKey
                    );
                });
                if (locator.kind === "plex-media") {
                    var proof =
                        driver.favoritesSource && driver.favoritesSource();
                    if (
                        !proof ||
                        !proof.current() ||
                        proof.serverId !== locator.serverId
                    )
                        return null;
                }
                if (ids.length === 1) return channel(ids[0], locator);
                if (locator.kind !== "plex-media" || ids.length) return null;
                var client = driver.mediaClient && driver.mediaClient();
                if (!client || !client.queue) return null;
                return new Promise(function (done) {
                    client.queue([locator.ratingKey], function (items: any[]) {
                        if (
                            !same() ||
                            !guard() ||
                            !items ||
                            items.length !== 1
                        ) {
                            done(null);
                            return;
                        }
                        var proof = driver.favoritesSource(),
                            item = items[0];
                        if (
                            !proof ||
                            !proof.current() ||
                            proof.serverId !== locator.serverId ||
                            !item.request ||
                            item.request.path !==
                                "/library/metadata/" + locator.ratingKey
                        ) {
                            done(null);
                            return;
                        }
                        done({
                            available: true,
                            items: items,
                            locator: locator,
                        });
                    });
                });
            }
            function play(
                item: any,
                guard: () => boolean,
                preserveInfo = false
            ): Promise<boolean> {
                if (
                    !same() ||
                    !guard() ||
                    (item.localProof && !item.localProof.current())
                )
                    return Promise.resolve(false);
                expectedDispatch = playbackItem = item;
                if (item.items)
                    return new Promise(function (done) {
                        if (
                            !w.__ottMedia?.playOrderedQueue ||
                            (Number(item.items[0].adult) === 1 &&
                                w.__ottParental?.needs("channels"))
                        ) {
                            done(false);
                            return;
                        }
                        w.__ottMedia.playOrderedQueue(
                            item.items,
                            0,
                            "global-favorite",
                            null,
                            function () {
                                return same() && guard();
                            },
                            function () {
                                done(true);
                            },
                            function () {
                                done(false);
                            },
                            preserveInfo
                        );
                    });
                if (
                    w.hasParentalLock?.(item.id) &&
                    w.__ottParental?.needs("channels")
                )
                    return Promise.resolve(false);
                if (w.channels[item.id]?.__ottMediaItem)
                    return new Promise(function (done) {
                        var settled = false;
                        function finish(ok: boolean): void {
                            if (settled) return;
                            settled = true;
                            done(ok === true && same() && guard());
                        }
                        pendingOperations.push(function () {
                            finish(false);
                        });
                        var accepted = w.playChannel(
                            item.group,
                            item.index,
                            true,
                            function () {
                                return same() && guard();
                            },
                            undefined,
                            false,
                            false,
                            finish,
                            function () {
                                return same() && guard();
                            },
                            preserveInfo
                        );
                        if (accepted !== true) finish(false);
                    });
                return Promise.resolve(
                    w.playChannel(
                        item.group,
                        item.index,
                        true,
                        function () {
                            return same() && guard();
                        },
                        undefined,
                        false,
                        false,
                        undefined,
                        undefined,
                        preserveInfo
                    ) === true
                );
            }
            function capturePlayback(): any {
                var snapshot = w.__ottClassicPlayback?.snapshot(),
                    generation = snapshot?.generation;
                var playedTarget = snapshot?.target,
                    session = w._playSession;
                var targetGuard = target.current;
                if (!playedTarget || !playbackItem) return null;
                var playedSource = playedTarget.sourceId,
                    playedId = playedTarget.channelId;
                var expectedId = playbackItem.id,
                    hasItems = !!playbackItem.items;
                var locator = JSON.parse(JSON.stringify(playbackItem.locator));
                var localProof = playbackItem.localProof;
                var catalogPayload =
                    !hasItems && w.channels[expectedId]?.__ottMediaItem;
                var catalogRef = catalogPayload?.__ottMediaRef;
                var mediaCatalog =
                    !hasItems &&
                    (locator.kind === "plex-media" ||
                        locator.kind === "vportal-media" ||
                        (driver.id === "stalker" &&
                            locator.kind === "channel" &&
                            /^stalker-media:/.test(locator.channelId)));
                // Catalog records may precede describe(), which adds a ref only
                // to its copy. Bind the actual committed media, never a row index.
                var catalogMedia = mediaCatalog
                    ? w.__ottMedia?.current()
                    : null;
                var catalogSource = catalogMedia?.ref?.sourceId,
                    catalogId = catalogMedia?.ref?.itemId;
                var catalogHadRef = !!catalogRef;
                var expectedRequest = hasItems
                    ? globalFavoriteCanonical(playbackItem.items[0].request)
                    : mediaCatalog
                      ? globalFavoriteCanonical(catalogPayload?.request)
                      : "";
                var rootId = target.selector.root?.id,
                    rootAlias = target.selector.root?.alias;
                var subprofile = target.origin.subprofile;
                function contentCurrent(): boolean {
                    if (!hasItems) {
                        var id = String(playedId),
                            row = w.channels[expectedId];
                        if (!row) return false;
                        if (mediaCatalog) {
                            var livePayload = row.__ottMediaItem,
                                liveRef = livePayload?.__ottMediaRef,
                                liveMedia = w.__ottMedia?.current();
                            if (
                                typeof catalogId !== "string" ||
                                !catalogId ||
                                catalogSource !== playedSource ||
                                catalogId !== playedId ||
                                liveMedia?.ref?.sourceId !== catalogSource ||
                                liveMedia?.ref?.itemId !== catalogId ||
                                !!liveRef !== catalogHadRef ||
                                (catalogHadRef &&
                                    (liveRef.sourceId !== catalogSource ||
                                        liveRef.itemId !== catalogId)) ||
                                globalFavoriteCanonical(
                                    liveMedia?.payload?.request
                                ) !== expectedRequest ||
                                globalFavoriteCanonical(
                                    livePayload?.request
                                ) !== expectedRequest
                            )
                                return false;
                        } else if (
                            !(
                                id === String(expectedId) ||
                                id === "channel:" + expectedId ||
                                id === String(row.itemId)
                            )
                        )
                            return false;
                        if (locator.kind === "channel")
                            return (
                                globalFavoriteChannelId(driver.id, row) ===
                                    locator.channelId &&
                                (driver.id !== "stalker" ||
                                    !mediaCatalog ||
                                    (row.__ottMediaItem?.stalkerSource ===
                                        w.__ottSourceIdentity.media(w) &&
                                        w.__ottMedia?.current()?.payload
                                            ?.stalkerSource ===
                                            w.__ottSourceIdentity.media(w)))
                            );
                        if (locator.kind === "channel-name")
                            return (
                                row.channel_name === locator.name &&
                                (locator.group === null ||
                                    row.category?.name === locator.group)
                            );
                        if (locator.kind === "local-media") {
                            var view = w.__ottLocalMedia?.favoriteSnapshot();
                            return (
                                !!view &&
                                view.current() &&
                                rootAlias === locator.rootAlias &&
                                (locator.relativePath.indexOf("/") >= 0 ||
                                    !!localProof) &&
                                (!localProof || localProof.current()) &&
                                view.catalog.items.some(function (item: any) {
                                    return (
                                        "local-" + item.id ===
                                            String(expectedId) &&
                                        item.sourceId === rootId &&
                                        (!localProof ||
                                            (item.id === localProof.itemId &&
                                                item.sourceId ===
                                                    localProof.sourceId &&
                                                item.relativePath ===
                                                    localProof.relativePath)) &&
                                        localItemRelativePath(item) ===
                                            locator.relativePath &&
                                        item.available !== false
                                    );
                                })
                            );
                        }
                        var payload = row.__ottMediaItem;
                        if (locator.kind === "vportal-media")
                            return (
                                payload?.vportalSource ===
                                    w.__ottSourceIdentity.media(w) &&
                                payload.__ottFavoriteId?.field ===
                                    locator.idField &&
                                globalFavoriteProviderId(
                                    payload.__ottFavoriteId.value
                                ) === locator.id &&
                                (subprofile === null ||
                                    (payload.__ottMediaCategories || []).some(
                                        function (category: any) {
                                            return category.name === subprofile;
                                        }
                                    ))
                            );
                        if (locator.kind === "plex-media") {
                            var proof = driver.favoritesSource?.();
                            return (
                                !!proof &&
                                proof.current() &&
                                proof.serverId === locator.serverId &&
                                payload?.plexSource ===
                                    w.__ottSourceIdentity.media(w) &&
                                payload.request?.path ===
                                    "/library/metadata/" + locator.ratingKey
                            );
                        }
                        return false;
                    }
                    var media = w.__ottMedia?.current();
                    return (
                        !!media &&
                        media.ref.sourceId === playedSource &&
                        media.ref.itemId === playedId &&
                        globalFavoriteCanonical(media.payload?.request) ===
                            expectedRequest
                    );
                }
                function proofCurrent(endingGeneration?: number): boolean {
                    var now = w.__ottClassicPlayback?.snapshot();
                    var ending = endingGeneration !== undefined;
                    return (
                        driver === w.__ottActiveProviderDriver &&
                        expectedLoad === w.__ottCommandChannelLoad &&
                        targetGuard() &&
                        source === w.__ottSourceIdentity.current(w) &&
                        playedSource === now?.target?.sourceId &&
                        playedId === now?.target?.channelId &&
                        (ending
                            ? endingGeneration === generation + 1 &&
                              now?.generation === endingGeneration &&
                              now?.phase === "stopped"
                            : generation === now?.generation &&
                              now?.phase !== "idle" &&
                              now?.phase !== "stopped") &&
                        session === w._playSession &&
                        (playedSource === w.__ottSourceIdentity.current(w) ||
                            playedSource === w.__ottSourceIdentity.media(w)) &&
                        contentCurrent()
                    );
                }
                function current(): boolean {
                    return proofCurrent();
                }
                function prepareEnded(expectedGeneration: number): any {
                    if (expectedGeneration !== generation || !current())
                        return null;
                    // HTML5 can report pause immediately before its guarded EOF.
                    // Neither a manual Stop nor another generation can mint this proof.
                    var phase = w.__ottClassicPlayback?.snapshot()?.phase;
                    if (phase !== "playing" && phase !== "paused") return null;
                    return function () {
                        return proofCurrent(expectedGeneration + 1);
                    };
                }
                return current()
                    ? {
                          current: current,
                          matches: function (payload: any) {
                              if (!current()) return false;
                              if (payload?.__ottMediaRef)
                                  return (
                                      payload.__ottMediaRef.sourceId ===
                                          playedSource &&
                                      payload.__ottMediaRef.itemId === playedId
                                  );
                              if (!hasItems)
                                  return (
                                      payload?.__ottGlobalChannel !==
                                          undefined &&
                                      String(payload.__ottGlobalChannel) ===
                                          String(expectedId)
                                  );
                              return (
                                  !!payload?.request &&
                                  (payload.plexSource === playedSource ||
                                      payload.vportalSource === playedSource) &&
                                  globalFavoriteCanonical(payload.request) ===
                                      expectedRequest
                              );
                          },
                          prepareEnded: prepareEnded,
                      }
                    : null;
            }
            function step(): void {
                timer = null;
                if (!marker.current()) {
                    fail();
                    return;
                }
                if (profilePending) {
                    later();
                    return;
                }
                var active = w.__ottActiveProviderDriver;
                if (!active) {
                    later();
                    return;
                }
                if (active.id !== target.selector.provider) {
                    fail();
                    return;
                }
                if (!profileSelected) {
                    driver = active;
                    profileSelected = true;
                    if (activeSlot(driver.id) !== target.selector.slot) {
                        ownLoad = true;
                        if (
                            driver.id === "offline" &&
                            target.selector.slot === null
                        ) {
                            if (
                                !w.__ottOfflineProfiles?.useDefault(
                                    marker.current
                                )
                            ) {
                                fail();
                                return;
                            }
                            expectedLoad = w.__ottCommandChannelLoad;
                            later();
                            return;
                        }
                        if (
                            driver.id === "stalker" ||
                            driver.id === "kb-team" ||
                            driver.id === "edem"
                        ) {
                            if (!marker.current()) {
                                fail();
                                return;
                            }
                            var changed = false;
                            if (driver.id === "stalker") {
                                var cfg = driver.configuration();
                                cfg.active = target.selector.slot;
                                changed = driver.saveConfiguration(
                                    cfg,
                                    marker.current
                                );
                            } else if (driver.id === "edem") {
                                var cfg = driver.settings();
                                cfg.list = target.selector.slot;
                                changed = driver.saveSettings(
                                    cfg,
                                    marker.current
                                );
                            } else {
                                var cfg = driver.credentials();
                                cfg.playlist = String(target.selector.slot);
                                changed = driver.saveCredentials(
                                    cfg,
                                    marker.current
                                );
                            }
                            if (changed === false || !marker.current()) {
                                fail();
                                return;
                            }
                            w.loadChannels();
                            expectedLoad = w.__ottCommandChannelLoad;
                            later();
                            return;
                        }
                        profilePending = true;
                        var selectedProfile = function (value: any) {
                            profilePending = false;
                            if (
                                !marker.current() ||
                                !value ||
                                value.status !== "ok"
                            ) {
                                fail();
                                return;
                            }
                            expectedLoad = w.__ottCommandChannelLoad;
                        };
                        var config =
                            driver.id === "m3u" && driver.configuration();
                        if (
                            config &&
                            target.locatorKind === "vportal-media" &&
                            !config.M3Us[target.selector.slot].www.trim()
                        ) {
                            if (!ports.selectMediaProfile) {
                                fail();
                                return;
                            }
                            ports.selectMediaProfile(
                                driver,
                                JSON.stringify(config),
                                target.selector.slot,
                                selectedProfile,
                                marker.current
                            );
                        } else
                            handleRemoteProfiles(
                                {
                                    action: "profile",
                                    params: {
                                        number: target.selector.slot + 1,
                                    },
                                },
                                selectedProfile,
                                marker.current
                            );
                        if (profilePending) {
                            later();
                            return;
                        }
                    }
                    expectedLoad = w.__ottCommandChannelLoad;
                }
                if (
                    active !== driver ||
                    expectedLoad !== w.__ottCommandChannelLoad
                ) {
                    fail();
                    return;
                }
                if (!w.commandChannelsReady) {
                    later();
                    return;
                }
                if (
                    activeSlot(driver.id) !== target.selector.slot ||
                    !target.current()
                ) {
                    fail();
                    return;
                }
                source = w.__ottSourceIdentity.current(w);
                settled = true;
                resolve({
                    capturePlayback: capturePlayback,
                    complete: function () {
                        close(true);
                    },
                    current: same,
                    origin: target.origin,
                    play: play,
                    release: function () {
                        if (owned()) {
                            pendingOperations.forEach(function (cancel) {
                                try {
                                    cancel();
                                } catch (_) {}
                            });
                            if (driver.cancelConnection)
                                driver.cancelConnection();
                        }
                        close();
                    },
                    resolve: resolveItem,
                });
            }
            var provider = target.selector.provider;
            if (!isProviderAllowed(provider)) {
                fail();
                return;
            }
            if (
                !w.__ottActiveProviderDriver ||
                w.__ottActiveProviderDriver.id !== provider
            ) {
                ownLoad = true;
                var index = ports.providerIds().indexOf(provider);
                if (index < 0 || !selectProviderByIndex(index)) {
                    fail();
                    return;
                }
            }
            expectedLoad = w.__ottCommandChannelLoad;
            starting = false;
            step();
        });
    }
    return {
        activate: activate,
        allowed: allowed,
        captureSelector: captureSelector,
        choices: choices,
        choiceTarget: choiceTarget,
        localItemRelativePath: localItemRelativePath,
        selected: selected,
        targets: targets,
    };
}
