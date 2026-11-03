import { utf8Encode } from "../commands/favorites-document-json";
import { createGlobalFavoritesItems } from "../commands/global-favorites-items";
import { createGlobalFavoritesProtocol } from "../commands/global-favorites-protocol";
import { createFavoritesBindings } from "../settings/favorites-bindings";
import { createFavoritesRecoveryCodec } from "../settings/favorites-recovery-codec";
import { createGlobalFavoritesStore } from "../settings/global-favorites";
import { isGlobalFavoriteSelector } from "../settings/global-favorites-bindings";
import { createGlobalFavoritesFacade } from "../settings/global-favorites-facade";
import { createGlobalFavoritesPortableCodec } from "../settings/global-favorites-portable";
import { createGlobalFavoritesCommitter } from "../settings/global-favorites-receipts";
import { createGlobalFavoritesRecovery } from "../settings/global-favorites-recovery";
import { captureGlobalFavorite } from "./global-favorites-capture";
import { globalFavoriteCanonical } from "./global-favorites-identities";
import {
    captureGlobalFavoriteMigration,
    globalFavoriteMigrationSource,
} from "./global-favorites-migration";
import { createGlobalFavoritesNavigation } from "./global-favorites-navigation";
import { createGlobalFavoritesPlayer } from "./global-favorites-player";
import { createGlobalFavoritesRouter } from "./global-favorites-router";
import { createGlobalFavoritesView } from "./global-favorites-view";

/** One lazy UI host; MAIN passes its existing physical adapter, never a new storage instance. */
export function createGlobalFavoritesHost(w: any, ports: any): any {
    var mainNames = [
        "caselessKey",
        "remoteCheckpoint",
        "handleRemoteProfiles",
        "isProviderAllowed",
        "providerIds",
        "selectProviderByIndex",
        "selectMediaProfile",
    ];
    if (!ports || typeof ports.current !== "function")
        throw new Error("unsupported");
    var mainCurrent = ports.current,
        main: any = {};
    mainNames.forEach(function (name) {
        if (typeof ports[name] !== "function") throw new Error("unsupported");
        main[name] = ports[name];
    });
    if (!mainCurrent()) throw new Error("context_changed");
    var codec = createGlobalFavoritesPortableCodec(),
        disposed = false;
    var protocol: any = null,
        committer: any = null,
        navigation: any = null;
    var prepared: any = Object.create(null),
        writing: any = null,
        mappings: any = Object.create(null);
    var toggleCurrent: (() => boolean) | null = null;
    var migrationGuards: any = Object.create(null),
        migrationPending: any[] = [];
    var registryKey = "favorites-bindings.v1",
        grant = ports.capture();
    function current(): boolean {
        return (
            !disposed &&
            ports.current === mainCurrent &&
            mainCurrent() &&
            mainNames.every(function (name) {
                return ports[name] === main[name];
            }) &&
            (!toggleCurrent || toggleCurrent()) &&
            !!grant &&
            grant.current()
        );
    }
    function mainCall(name: string, args: any[], fallback?: any): any {
        if (!current()) return fallback;
        return main[name].apply(undefined, args);
    }
    function mainAdmission(admission?: () => boolean): () => boolean {
        return function () {
            return current() && (!admission || admission());
        };
    }
    function readRegistry(): string | null {
        if (!current()) throw new Error("storage_unavailable");
        var raw = grant.read(registryKey);
        if (raw !== null && (typeof raw !== "string" || raw.length > 524288))
            throw new Error("storage_unavailable");
        return raw;
    }
    function permitted(): boolean {
        return (
            current() &&
            !w.__ottStandby?.blocked() &&
            !w.__ottKiosk?.enabled() &&
            !w.__ottParental?.needs("providers") &&
            !w.__ottParental?.needs("settings")
        );
    }
    function isPrepared(selector: any): boolean {
        var value = prepared[globalFavoriteCanonical(selector)];
        return permitted() && !!value && value.current();
    }
    function legacySelector(kind: string, value: any): boolean {
        return (
            !!value &&
            value.kind === kind &&
            Object.keys(value).sort().join(",") ===
                "channelSourceId,kind,mediaKey,mediaSourceId,serverId,tvKey"
        );
    }
    var registry = createFavoritesBindings({
        compareAndSwap: function (before, after) {
            if (!writing || !writing.current()) return "conflict";
            return grant.compareAndSwap(
                registryKey,
                before,
                after,
                writing.current
            );
        },
        current: function (_entry, value) {
            return (
                isGlobalFavoriteSelector(value.selector) &&
                isPrepared(value.selector)
            );
        },
        persistedRead: readRegistry,
        read: readRegistry,
        uuid: ports.uuid,
        validateSelector: function (kind, selector) {
            return (
                isGlobalFavoriteSelector(selector) ||
                legacySelector(kind, selector)
            );
        },
    });
    var player: any;
    async function prepareSelector(selector: any): Promise<void> {
        var row = player.selected(selector.provider, selector.slot),
            text = row && globalFavoriteCanonical(row);
        if (
            !text ||
            (await ports.sha256(text)) !== selector.configurationDigest
        )
            return;
        if (
            !current() ||
            globalFavoriteCanonical(
                player.selected(selector.provider, selector.slot)
            ) !== text
        )
            return;
        prepared[globalFavoriteCanonical(selector)] = {
            current: function () {
                return (
                    current() &&
                    globalFavoriteCanonical(
                        player.selected(selector.provider, selector.slot)
                    ) === text
                );
            },
        };
    }
    var bindings = {
        list: async function () {
            var before = readRegistry(),
                list = registry.list();
            var raw = before === null ? { entries: [] } : JSON.parse(before);
            for (var index = 0; index < raw.entries.length; index++) {
                var selector = raw.entries[index].binding?.selector;
                if (isGlobalFavoriteSelector(selector))
                    await prepareSelector(selector);
            }
            if (!current() || readRegistry() !== before)
                throw new Error("changed");
            return list;
        },
        resolve: function (id: string) {
            return registry.resolve(id);
        },
    };
    player = createGlobalFavoritesPlayer(w, {
        bindings: bindings,
        current: current,
        handleRemoteProfiles: function (
            request: any,
            done: any,
            admission?: () => boolean
        ) {
            return mainCall(
                "handleRemoteProfiles",
                [request, done, mainAdmission(admission)],
                false
            );
        },
        isProviderAllowed: function (id: string) {
            return mainCall("isProviderAllowed", [id], false);
        },
        providerIds: function () {
            return mainCall("providerIds", [], []);
        },
        remoteCheckpoint: function (target: any) {
            return mainCall("remoteCheckpoint", [target]);
        },
        selectMediaProfile: function (
            driver: any,
            value: string,
            index: number,
            done: any,
            admission?: () => boolean
        ) {
            return mainCall(
                "selectMediaProfile",
                [driver, value, index, done, mainAdmission(admission)],
                false
            );
        },
        selectProviderByIndex: function (index: number) {
            return mainCall("selectProviderByIndex", [index], false);
        },
        sha256: ports.sha256,
    });
    var canonicalBindings: any = null;
    player.canonicalizeFavorite = async function (captured: any): Promise<any> {
        var selector = captured.selector,
            raw = readRegistry();
        var key = globalFavoriteCanonical([
            selector.provider,
            selector.slot,
            selector.configurationDigest,
        ]);
        if (
            !canonicalBindings ||
            canonicalBindings.raw !== raw ||
            canonicalBindings.key !== key
        ) {
            var listed = await bindings.list(),
                rows: any[] = [];
            listed.entries.forEach(function (row: any) {
                if (row.kind !== "source") return;
                try {
                    var selected = bindings.resolve(row.id).binding.selector;
                    if (isGlobalFavoriteSelector(selected)) rows.push(selected);
                } catch (_) {}
            });
            if (!captured.current() || readRegistry() !== raw) return null;
            canonicalBindings = { key: key, raw: raw, rows: rows };
        }
        var matches = canonicalBindings.rows.filter(function (bound: any) {
            return (
                bound.provider === selector.provider &&
                bound.slot === selector.slot &&
                bound.configurationDigest === selector.configurationDigest &&
                bound.origin.subprofile === selector.origin.subprofile &&
                (bound.root || selector.root
                    ? !!bound.root &&
                      !!selector.root &&
                      bound.root.id === selector.root.id &&
                      bound.root.key === selector.root.key
                    : true) &&
                isPrepared(bound)
            );
        });
        var unique: any = Object.create(null);
        matches = matches.filter(function (bound: any) {
            var id = globalFavoriteCanonical(bound.origin);
            if (unique[id]) return false;
            unique[id] = true;
            return true;
        });
        if (matches.length > 1) return null;
        var previous = captured.current;
        captured.pairCurrent = previous;
        captured.registryBefore = raw;
        captured.current = function () {
            return previous() && readRegistry() === raw;
        };
        if (!matches.length) return captured;
        var bound = matches[0];
        var value = JSON.parse(JSON.stringify(captured.value));
        value.origin = bound.origin;
        if (value.locator.kind === "local-media")
            value.locator.rootAlias = bound.root.alias;
        value = codec.normalize(value);
        if (!value) return null;
        captured.value = value;
        captured.selector = bound;
        captured.root = bound.root;
        captured.bound = true;
        captured.current = function () {
            return previous() && readRegistry() === raw && isPrepared(bound);
        };
        return captured.current() ? captured : null;
    };
    var store = createGlobalFavoritesStore({
        canWrite: function () {
            return !!committer && committer.canWrite();
        },
        capture: ports.capture,
        codec: codec,
        current: current,
        migrationCurrent: function (id: string) {
            return !!migrationGuards[id] && migrationGuards[id]();
        },
        sha256: ports.sha256,
        uuid: ports.uuid,
    });
    var router = createGlobalFavoritesRouter({
        activate: async function (target: any, guard: () => boolean) {
            var session = await player.activate(target, guard);
            if (target.ephemeral) {
                var resolve = session.resolve;
                session.resolve = async function (
                    locator: any,
                    current: () => boolean
                ) {
                    var result = await resolve(locator, current);
                    if (!result || !current()) return result;
                    await pair(
                        target.origin,
                        target.selector.slot,
                        target.selector.root,
                        current
                    );
                    var bound = await bindings.list(),
                        matches = bound.entries.filter(function (row: any) {
                            if (row.kind !== "source") return false;
                            try {
                                return (
                                    globalFavoriteCanonical(
                                        bindings.resolve(row.id).binding
                                            .selector
                                    ) ===
                                    globalFavoriteCanonical(target.selector)
                                );
                            } catch (_) {
                                return false;
                            }
                        });
                    if (matches.length !== 1 || !current()) return null;
                    var raw = readRegistry(),
                        prior = target.current;
                    target.current = function () {
                        try {
                            return prior() && readRegistry() === raw;
                        } catch (_) {
                            return false;
                        }
                    };
                    return current() ? result : null;
                };
            }
            return session;
        },
        allowed: player.allowed,
        changed: function (state: any) {
            if (navigation) navigation.routeState(state);
            ports.changed?.(state);
        },
        clearTimer: w.clearTimeout.bind(w),
        codec: codec,
        current: current,
        now: ports.now,
        onSelect: function () {
            if (permitted()) w.__ottSetInfoInteraction?.(false);
        },
        setTimer: w.setTimeout.bind(w),
        snapshot: store.snapshot,
        targets: function (origin: any, guard: () => boolean, locator: any) {
            var mapped = mappings[globalFavoriteCanonical(origin)];
            return mapped && mapped.current()
                ? [mapped]
                : player.targets(origin, guard, locator);
        },
    });
    navigation = createGlobalFavoritesNavigation({
        allowed: permitted,
        cancel: router.cancel,
        capture: function () {
            return router.captureCurrent();
        },
        captureEnding: function (generation: number) {
            return router.captureEnding(generation);
        },
        current: current,
        failed: function () {
            if (current()) w.showShift(w._("Unavailable"));
        },
        identity: function (entry: any) {
            return codec.identity({
                locator: entry.locator,
                origin: entry.origin,
                title: entry.title,
            });
        },
        onMove: function () {
            w.__ottSetInfoInteraction?.(false);
        },
        select: router.select,
        snapshot: store.snapshot,
    });
    var view = createGlobalFavoritesView({
        canFavorite: function () {
            return permitted() && w.sFavorites !== -1;
        },
        captureScreen: function () {
            var handler = w.listKeyHandlerFn,
                screen = w.__ottClassicScreenPort?.screens.current();
            var category = w.__ottChannels?.captureCategoryCurrent?.();
            return function () {
                return (
                    handler === w.listKeyHandlerFn &&
                    screen === w.__ottClassicScreenPort?.screens.current() &&
                    (!category || category())
                );
            };
        },
        current: current,
        describe: function (origin: any) {
            return [
                origin.provider,
                origin.profile,
                origin.subprofile,
                origin.sourceAlias,
            ]
                .filter(Boolean)
                .join(" / ");
        },
        error: function (reason: string, id?: string) {
            w.showShift(
                w._("Favorites") +
                    ": " +
                    w._(
                        reason === "ambiguous"
                            ? "Choose a profile"
                            : "Unavailable"
                    )
            );
            if (id && (reason === "missing" || reason === "ambiguous"))
                void chooseMapping(id).catch(function () {
                    if (current()) w.showShift(w._("Unavailable"));
                });
        },
        navigation: navigation,
        pendingMigration: function () {
            return migrationPending;
        },
        playLegacy: function (id: string) {
            var active = true,
                child: any = null;
            var result = Promise.resolve()
                .then(function () {
                    return facade.legacy({ id: id, op: "play" }, function () {
                        return active && permitted();
                    });
                })
                .then(function (value: any) {
                    child = value;
                    if (!active) {
                        child.cancel();
                        return { status: "cancelled" };
                    }
                    return child.result;
                });
            return {
                cancel: function () {
                    active = false;
                    if (child) child.cancel();
                },
                result: result,
            };
        },
        remove: async function (id: string, admitted: () => boolean) {
            if (!(await committer.qualify()) || !admitted())
                throw new Error("reconciliation_required");
            var raw = grant.read("favorites-receipts.v1");
            var receipt = await createFavoritesRecoveryCodec({
                sha256: ports.sha256,
            }).snapshot(raw);
            if (
                !admitted() ||
                receipt.records.some(function (row: any) {
                    return !row.acknowledgement;
                })
            )
                throw new Error("reconciliation_required");
            return facade.remove(id, function () {
                return (
                    admitted() && grant.read("favorites-receipts.v1") === raw
                );
            });
        },
        removed: ports.favoriteRemoved,
        router: router,
        selected: function () {
            return w.selIndex;
        },
        show: function (list: any) {
            var rows: any = Object.create(null);
            list.rows.forEach(function (row: any) {
                rows[row.id] = {
                    channel_name: row.label + " — " + row.detail,
                    logo: "",
                    modernMeta: row.detail,
                    modernTitle: row.label,
                };
            });
            w.__ottChannelListView.show(
                /* biome-ignore assist/source/useSortedKeys: Preserve list state reads around permission and translation callbacks. */ {
                    id: list.id,
                    rememberCategory: false,
                    rows: list.rows.map(function (row: any) {
                        return row.id;
                    }),
                    categoryName: list.title,
                    actions:
                        permitted() && w.sFavorites !== -1
                            ? w._("Favorites") + ": −"
                            : false,
                    selected: Math.max(
                        0,
                        list.rows
                            .map(function (row: any) {
                                return row.id;
                            })
                            .indexOf(list.selected)
                    ),
                    channel: function (id: string) {
                        return rows[id];
                    },
                    picon: function () {
                        return "";
                    },
                    playing: list.playing,
                    locked: function () {
                        return false;
                    },
                    detail: function () {},
                    key: function (key: number) {
                        var backward = key === w.keys.RW || key === w.keys.PREV;
                        var forward = key === w.keys.FF || key === w.keys.NEXT;
                        var mode =
                            key === w.keys.RW || key === w.keys.FF
                                ? w.sRewFun
                                : backward || forward
                                  ? w.sPNFun
                                  : 0;
                        var categories =
                            key === w.keys.BLUE ||
                            key === w.keys.PLAY ||
                            key === w.keys.PAUSE ||
                            (key === w.keys.LEFT && w.sArrowFun === 2) ||
                            (backward && mode === 1);
                        if (
                            categories ||
                            ((backward || forward) && mode === 2)
                        ) {
                            // Global row UUIDs are not provider channel IDs. Only
                            // share category navigation with the ordinary list.
                            var category =
                                w.__ottChannels?.index("system:favorites");
                            if (!(category >= 0)) category = 0;
                            if (categories) {
                                if (typeof w.bucketsList === "function") {
                                    list.close();
                                    w.bucketsList(category);
                                }
                            } else if (
                                w.catsArray?.length &&
                                typeof w.channelsList === "function"
                            ) {
                                category =
                                    (category +
                                        (backward ? -1 : 1) +
                                        w.catsArray.length) %
                                    w.catsArray.length;
                                list.close();
                                w.channelsList(
                                    category,
                                    w.catIndex === category ? w.primaryIndex : 0
                                );
                            }
                            return true;
                        }
                        if (
                            key === w.keys.YELLOW ||
                            key === w.keys.TOOLS ||
                            key === w.keys.N0
                        )
                            return list.remove();
                        if (key === w.keys.ENTER) {
                            var row = list.rows[w.selIndex];
                            if (row) list.select(row.id);
                            return true;
                        }
                        if (key === w.keys.RETURN || key === w.keys.EXIT) {
                            list.close();
                            w.closeList(false);
                            return true;
                        }
                        return false;
                    },
                }
            );
            var handler = w.listKeyHandlerFn,
                screen = w.__ottClassicScreenPort?.screens.current();
            return function () {
                return (
                    handler === w.listKeyHandlerFn &&
                    screen === w.__ottClassicScreenPort?.screens.current()
                );
            };
        },
        store: store,
        translate: w._,
    });
    async function chooseMapping(id: string): Promise<void> {
        var snapshot = await store.snapshot();
        var entries = snapshot.entries.filter(function (row: any) {
            return row.id === id;
        });
        if (entries.length !== 1 || !snapshot.current() || !permitted()) return;
        var entry = entries[0],
            choices = await player.choices(entry.origin.provider);
        if (!choices.length) return;
        w.__ottCategoryListView.show({
            key: function (key: number) {
                if (!snapshot.current() || !permitted()) return true;
                if (key === w.keys.RETURN || key === w.keys.EXIT) {
                    void view.open();
                    return true;
                }
                if (key !== w.keys.ENTER || !choices[w.selIndex]) return false;
                var choice = choices[w.selIndex];
                void player
                    .choiceTarget(entry.origin, choice, entry.locator)
                    .then(function (target: any) {
                        if (!target || !snapshot.current() || !permitted())
                            return;
                        mappings[globalFavoriteCanonical(entry.origin)] =
                            target;
                        router.select(id);
                    });
                return true;
            },
            labels: choices.map(function (row: any) {
                return row.label;
            }),
            selected: 0,
        });
    }
    async function pair(
        origin: any,
        slot: number | null,
        root?: any,
        admission?: () => boolean,
        expectedRegistry?: { raw: string | null }
    ): Promise<any> {
        if (!committer || !committer.canWrite())
            throw new Error("reconciliation_required");
        var selector = await player.captureSelector(origin, slot, root);
        if (!selector || !permitted() || (admission && !admission()))
            throw new Error("unavailable");
        await prepareSelector(selector);
        var before = readRegistry(),
            revision = registry.list().revision;
        if (expectedRegistry && expectedRegistry.raw !== before)
            throw new Error("changed");
        return grant.exclusive(async function (locked: any) {
            function admitted(): boolean {
                return (
                    locked === grant &&
                    permitted() &&
                    committer.canWrite() &&
                    (!admission || admission()) &&
                    isPrepared(selector)
                );
            }
            var ledger = grant.read("favorites-receipts.v1"),
                parsed = await createFavoritesRecoveryCodec({
                    sha256: ports.sha256,
                }).snapshot(ledger);
            if (
                !admitted() ||
                readRegistry() !== before ||
                grant.read("favorites-receipts.v1") !== ledger ||
                parsed.records.some(function (row: any) {
                    return !row.acknowledgement;
                })
            )
                throw new Error("reconciliation_required");
            writing = {
                current: function () {
                    return (
                        admitted() &&
                        grant.read("favorites-receipts.v1") === ledger
                    );
                },
            };
            try {
                var binding = {
                    owner: "global:" + selector.configurationDigest,
                    selector: selector,
                };
                return registry.provisionPlayback(
                    {
                        profile: binding,
                        provider: selector.provider,
                        source: binding,
                    },
                    revision
                );
            } finally {
                writing = null;
            }
        });
    }
    function membershipToken(source: string, entry: any): Promise<string> {
        return ports.sha256(
            JSON.stringify([
                "global-favorites-membership-entry-v1",
                source,
                codec.identity(entry),
            ])
        );
    }
    async function toggle(
        payload?: any,
        externalCurrent?: () => boolean,
        present?: boolean
    ): Promise<any> {
        if (toggleCurrent) throw new Error("busy");
        toggleCurrent =
            externalCurrent ||
            function () {
                return true;
            };
        router.cancel();
        try {
            if (
                !committer ||
                !(await committer.qualify()) ||
                !committer.canWrite()
            )
                throw new Error("reconciliation_required");
            var capture =
                router.captureCurrent(payload) ||
                (await captureGlobalFavorite(w, player, codec, payload));
            if (!capture) throw new Error("unavailable");
            if (!capture.bound) {
                await pair(
                    capture.value.origin,
                    capture.slot,
                    capture.root,
                    capture.pairCurrent || capture.current,
                    capture.registryBefore !== undefined
                        ? { raw: capture.registryBefore }
                        : undefined
                );
                capture = await captureGlobalFavorite(
                    w,
                    player,
                    codec,
                    payload
                );
                if (!capture) throw new Error("changed");
            }
            if (!capture.current()) throw new Error("changed");
            var before = await store.snapshot(),
                identity = codec.identity(capture.value);
            var found = before.entries.filter(function (entry: any) {
                return (
                    codec.identity({
                        locator: entry.locator,
                        origin: entry.origin,
                        title: entry.title,
                    }) === identity
                );
            });
            if (!before.current() || !capture.current())
                throw new Error("changed");
            var receiptRaw = grant.read("favorites-receipts.v1");
            var receipt = await createFavoritesRecoveryCodec({
                sha256: ports.sha256,
            }).snapshot(receiptRaw);
            if (
                !capture.current() ||
                receipt.records.some(function (row: any) {
                    return !row.acknowledgement;
                })
            )
                throw new Error("reconciliation_required");
            var removing = present === undefined ? found.length > 0 : !present;
            if (!removing && found.length) {
                if (!before.current()) throw new Error("revision_conflict");
                return {
                    changed: false,
                    outcome: "verified",
                    revision: before.revision,
                };
            }
            var local = removing
                ? await captureGlobalFavorite(w, player, codec, payload)
                : null;
            if (removing && (!local || !local.current()))
                throw new Error("unavailable");
            var tokens: string[] = [];
            if (removing) {
                var namespace = globalFavoriteMigrationSource(w);
                tokens.push(await membershipToken(namespace, capture.value));
                var localToken = await membershipToken(namespace, local.value);
                if (tokens.indexOf(localToken) < 0) tokens.push(localToken);
                if (!capture.current() || !local.current())
                    throw new Error("changed");
            }
            var result = await store.mutate(
                before.revision,
                removing
                    ? {
                          ids: found.map(function (entry: any) {
                              return entry.id;
                          }),
                          op: "forget-membership",
                          tokens: tokens,
                      }
                    : { entries: [capture.value], op: "put" },
                function () {
                    return (
                        capture.current() &&
                        (!local || local.current()) &&
                        grant.read("favorites-receipts.v1") === receiptRaw
                    );
                }
            );
            if (result.outcome !== "verified")
                throw new Error("storage_unavailable");
            if (result.changed && (!removing || found.length))
                ports.favoriteToggled(capture.value.title, !removing);
            return result;
        } finally {
            toggleCurrent = null;
        }
    }
    async function capture() {
        var captured =
            router.captureCurrent() ||
            (await captureGlobalFavorite(w, player, codec));
        if (!captured) throw new Error("unavailable");
        if (!captured.current()) throw new Error("changed");
        return captured;
    }
    var facade = createGlobalFavoritesFacade({
        capture: capture,
        captureLegacy: ports.captureLegacy,
        caselessKey: function (value: string) {
            if (!current()) throw new Error("context_changed");
            return main.caselessKey(value);
        },
        codec: codec,
        current: current,
        locatorKinds: [
            "channel",
            "channel-name",
            "local-media",
            "plex-media",
            "vportal-media",
        ],
        playEntry: function (id: string, admission: () => boolean) {
            return router.select(id, admission);
        },
        playLegacy: ports.playLegacy,
        qualify: function () {
            return committer && committer.qualify();
        },
        sha256: ports.sha256,
        store: store,
        uuid: ports.uuid,
    });
    async function captureContext(): Promise<any> {
        var read = w.stbGetItem;
        var keys = [
            registryKey,
            "m3um3uArr",
            "vportalprofiles",
            "plexcfg",
            "offlineProfiles",
            "offlineProfileBindings",
            "localMediaEndpoint",
        ];
        var values = keys.map(function (key) {
            var value = read.call(w, key);
            if (
                value !== null &&
                (typeof value !== "string" || value.length > 1048576)
            )
                throw new Error("context_changed");
            return value;
        });
        function policy() {
            return [
                !!w.__ottKiosk?.enabled(),
                !!w.__ottParental?.needs("providers"),
                !!w.__ottParental?.needs("settings"),
                !!w.__ottStandby?.blocked(),
            ];
        }
        var flags = globalFavoriteCanonical(policy());
        function valid(): boolean {
            return (
                current() &&
                w.stbGetItem === read &&
                flags === globalFavoriteCanonical(policy()) &&
                keys.every(function (key, index) {
                    return read.call(w, key) === values[index];
                })
            );
        }
        var revision = await ports.sha256(
            globalFavoriteCanonical([
                "global-favorites-context-v1",
                grant.origin,
                values,
                flags,
            ])
        );
        if (!valid()) throw new Error("context_changed");
        return { current: valid, revision: revision };
    }
    committer = createGlobalFavoritesCommitter({
        authorizedOperation: function () {
            return current() && ports.authorized("status");
        },
        capture: ports.capture,
        captureContext: captureContext,
        codec: codec,
        contextRevision: async function () {
            return (await captureContext()).revision;
        },
        current: current,
        freshAdmission: function (id: string, hash: string) {
            return !!protocol && protocol.freshAdmission(id, hash);
        },
        now: ports.now,
        sha256: ports.sha256,
        store: store,
    });
    protocol = createGlobalFavoritesProtocol({
        authorized: ports.authorized,
        base64Decode: ports.base64Decode,
        base64Encode: ports.base64Encode,
        captureContext: captureContext,
        clearTimer: w.clearTimeout.bind(w),
        codec: codec,
        committer: committer,
        contextRevision: async function () {
            return (await captureContext()).revision;
        },
        current: current,
        facade: facade,
        locatorKinds: [
            "channel",
            "channel-name",
            "local-media",
            "plex-media",
            "vportal-media",
        ],
        now: ports.now,
        resolve: async function (entries: any[]) {
            var states: string[] = [];
            for (var i = 0; i < entries.length; i++) {
                var candidates = await player.targets(
                    entries[i].origin,
                    current,
                    entries[i].locator
                );
                states.push(
                    candidates.length === 1
                        ? "resolved"
                        : candidates.length > 1
                          ? "ambiguous"
                          : "missing"
                );
            }
            return states;
        },
        runtime: ports.runtime,
        setTimer: w.setTimeout.bind(w),
        sha256: ports.sha256,
        store: store,
        uuid: ports.uuid,
    });
    async function currentItem(): Promise<any> {
        var context = await captureContext(),
            snapshot = await store.snapshot();
        var captured =
            router.captureCurrent() ||
            (await captureGlobalFavorite(w, player, codec));
        if (
            !context.current() ||
            !snapshot.current() ||
            (captured && !captured.current())
        )
            throw new Error("context_changed");
        return {
            context_revision: context.revision,
            current: function () {
                return (
                    context.current() &&
                    snapshot.current() &&
                    (!captured || captured.current())
                );
            },
            entry: captured ? captured.value : null,
            revision: snapshot.revision,
            unavailable_reason: captured
                ? null
                : w.__ottStandby?.blocked()
                  ? "standby"
                  : "no_portable_current_item",
        };
    }
    function playUUID(
        id: string,
        revision: string,
        contextRevision: string,
        admitted: () => boolean
    ): any {
        var active = true,
            inner: any = null;
        var result = (async function () {
            var context = await captureContext(),
                snapshot = await store.snapshot();
            if (
                !active ||
                !admitted() ||
                !context.current() ||
                !snapshot.current()
            )
                throw new Error("context_changed");
            if (snapshot.revision !== revision)
                throw new Error("revision_conflict");
            if (context.revision !== contextRevision)
                throw new Error("context_changed");
            if (
                !snapshot.entries.some(function (entry: any) {
                    return entry.id === id;
                })
            )
                throw new Error("favorite_not_found");
            // Active-profile writes belong to this handoff. The router pins target configuration,
            // while the immutable Favorites snapshot and request owner remain required throughout.
            inner = router.select(id, function () {
                return active && admitted() && snapshot.current();
            });
            return inner.result.then(function (value: any) {
                var errors: any = {
                    ambiguous: "ambiguous_source",
                    blocked: "policy_denied",
                    changed: "context_changed",
                    missing: "source_unavailable",
                    timeout: "expired",
                    unavailable: "item_unavailable",
                    unsupported: "unsupported_item",
                };
                return { id: id, status: errors[value.status] || value.status };
            });
        })();
        return {
            cancel: function () {
                active = false;
                if (inner) inner.cancel();
            },
            result: result,
        };
    }
    async function open(
        _payload?: any,
        admitted: () => boolean = function () {
            return true;
        }
    ) {
        if (!permitted() || !admitted()) throw new Error("policy_denied");
        var remember =
            _payload?.rememberCategory ||
            w.__ottChannels?.captureCategorySelection?.();
        try {
            var captured = await captureGlobalFavoriteMigration(
                w,
                player,
                codec
            );
            if (!permitted() || !admitted()) return;
            migrationPending = captured ? captured.pending : [];
            if (captured && captured.current() && (await committer.qualify())) {
                var id = await ports.sha256(captured.identity),
                    entries: any[] = [];
                for (var index = 0; index < captured.entries.length; index++) {
                    var entry = captured.entries[index];
                    var token = await membershipToken(captured.identity, entry);
                    if (!captured.current() || !admitted())
                        throw new Error("context_changed");
                    entries.push({ entry: entry, token: token });
                }
                var before = await store.snapshot();
                if (!captured.current() || !before.current() || !admitted())
                    throw new Error("context_changed");
                var owned = function () {
                    return captured.current() && admitted();
                };
                migrationGuards[id] = owned;
                try {
                    if (entries.length)
                        await store.mutate(
                            before.revision,
                            {
                                entries: entries,
                                migrationId: id,
                                op: "migrate-membership",
                            },
                            owned
                        );
                } finally {
                    delete migrationGuards[id];
                }
            }
        } catch (_) {
            if (permitted() && admitted())
                migrationPending = [
                    { reason: "unresolved", title: w._("Favorites") },
                ];
        }
        if (
            permitted() &&
            admitted() &&
            (!remember?.current || remember.current())
        ) {
            if (remember?.("system:favorites") === false)
                throw new Error("category_save_failed");
            if (!remember?.current || remember.current()) return view.open();
        }
    }
    var recovery = createGlobalFavoritesRecovery({
        authorized: ports.authorized,
        capture: ports.capture,
        captureContext: captureContext,
        current: current,
        now: ports.now,
        runtime: ports.runtime,
        sha256: ports.sha256,
    });
    return {
        add: function (payload: any, current?: () => boolean) {
            return toggle(payload, current, true);
        },
        capture: capture,
        captureContext: captureContext,
        codec: codec,
        committer: committer,
        createItems: function () {
            return createGlobalFavoritesItems({
                authorized: ports.authorized,
                base64Decode: ports.base64Decode,
                base64Encode: ports.base64Encode,
                codec: codec,
                current: current,
                host: {
                    captureContext: captureContext,
                    currentItem: currentItem,
                    playUUID: playUUID,
                    store: store,
                },
                now: ports.now,
                runtime: ports.runtime,
            });
        },
        currentItem: currentItem,
        dispose: function () {
            navigation.retire();
            disposed = true;
            view.close();
            router.cancel();
            protocol.dispose();
        },
        facade: facade,
        favoriteSelected: function (owner: any) {
            return (
                owner === w.__ottClassicScreenPort?.screens.current() &&
                view.favoriteSelected()
            );
        },
        navigation: navigation,
        open: open,
        pair: pair,
        playEntry: function (id: string, admission: () => boolean) {
            return router.select(id, admission);
        },
        playUUID: playUUID,
        protocol: protocol,
        recovery: recovery,
        remove: function (payload: any, current?: () => boolean) {
            return toggle(payload, current, false);
        },
        requestBytes: function (request: any): number {
            return utf8Encode(JSON.stringify(request)).length;
        },
        router: router,
        store: store,
        toggle: toggle,
    };
}
(window as any).__ottGlobalFavoritesFactory = {
    create: createGlobalFavoritesHost,
};
