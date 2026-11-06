interface ScreenMenuRecord {
    action: () => void;
    color?: string;
    detail: string;
    hint?: string;
    id: string;
    legacyId: string;
    number?: string;
    sourceIndex: number;
    title: string;
}

/** Native window controls use confirmed IPC results, independently of video layout. */
function createDesktopWindowControls(host: any) {
    var pending = false;
    function api(): any {
        try {
            var tauri = host.__TAURI__;
            if (!tauri || host.Capacitor) return null;
            var ua = String((host.navigator && host.navigator.userAgent) || "");
            if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return null;
            var windows = tauri.window;
            var current =
                windows && typeof windows.getCurrentWindow === "function"
                    ? windows.getCurrentWindow()
                    : null;
            if (!current || current.label !== "main") return null;
            var owner = tauri.core;
            if (!owner || typeof owner.invoke !== "function")
                owner = host.__TAURI_INTERNALS__;
            if (!owner || typeof owner.invoke !== "function") return null;
            return { current: current, owner: owner };
        } catch (_) {
            return null;
        }
    }
    function admitted(context: any): boolean {
        try {
            return !!(
                context.owner &&
                host.__ottClassicScreenPort.listOwner() === context.owner &&
                context.owner.foreground() &&
                !(host.__ottKiosk && host.__ottKiosk.locked())
            );
        } catch (_) {
            return false;
        }
    }
    function title(kind: string): string {
        var key =
            kind === "aspectLock"
                ? "Lock window to 16:9"
                : kind === "fullscreen"
                  ? "Full screen"
                  : "Always on top";
        return host._ ? host._(key) : key;
    }
    function notify(kind: string, state: boolean | "unsupported" | null): void {
        try {
            var statusKey =
                state === "unsupported"
                    ? "Unavailable"
                    : state === null
                      ? "ERROR!"
                      : state
                        ? "On"
                        : "Off";
            var status = host._
                ? host._(statusKey)
                : state === null
                  ? "Error!"
                  : statusKey;
            if (typeof host.showPopup === "function")
                host.showPopup(title(kind) + ": " + status);
        } catch (_) {}
    }
    function read(
        native: any,
        kind: string,
        context: any
    ): Promise<boolean | "unsupported" | null> {
        return Promise.resolve().then(function () {
            if (!admitted(context)) return null;
            if (kind === "aspectLock") {
                return Promise.resolve(
                    native.owner.invoke("get_window_aspect_lock")
                ).then(function (state: any) {
                    if (
                        !state ||
                        state.ok !== true ||
                        typeof state.supported !== "boolean" ||
                        typeof state.enabled !== "boolean" ||
                        typeof state.active !== "boolean" ||
                        (!state.supported && state.active)
                    )
                        throw new Error();
                    return state.supported ? state.enabled : "unsupported";
                });
            }
            return Promise.resolve(native.current.isAlwaysOnTop()).then(
                function (state: any) {
                    if (typeof state !== "boolean") throw new Error();
                    return state;
                }
            );
        });
    }
    function changed(context: any, kind: string, state: any): void {
        if (!context.states || !admitted(context)) return;
        context.states[kind] = state;
        try {
            if (typeof host.showPage === "function") host.showPage();
        } catch (_) {}
    }
    function refresh(context: any, kinds: string[]): Promise<void> {
        var native = api(),
            owner = context.owner;
        if (!native || !admitted(context)) return Promise.resolve();
        return Promise.all(
            kinds.map(function (kind) {
                var revision = context.revisions[kind] || 0;
                function accept(state: any) {
                    if (
                        context.owner === owner &&
                        revision === (context.revisions[kind] || 0)
                    )
                        changed(context, kind, state);
                }
                return read(native, kind, context).then(accept, function () {
                    accept("error");
                });
            })
        ).then(function () {});
    }
    function run(kind: string, context: any): Promise<void> {
        if (pending || !admitted(context)) return Promise.resolve();
        var native = api();
        if (!native) {
            notify(kind, null);
            return Promise.resolve();
        }
        pending = true;
        if (context.revisions)
            context.revisions[kind] = (context.revisions[kind] || 0) + 1;
        var fullscreenEpoch = 0;
        // One owner and one mutating call: rejected acknowledgements are never retried.
        var task = Promise.resolve().then(function (): any {
            if (!admitted(context)) return null;
            if (kind === "fullscreen") {
                fullscreenEpoch = host.__ottTauriFsEpoch =
                    (host.__ottTauriFsEpoch || 0) + 1;
                return Promise.resolve(
                    native.owner.invoke("toggle_fullscreen")
                ).then(function (result: any) {
                    if (
                        !result ||
                        result.ok !== true ||
                        typeof result.fullscreen !== "boolean"
                    )
                        throw new Error();
                    return result.fullscreen;
                });
            }
            if (kind === "aspectLock") {
                return read(native, kind, context).then(function (
                    current: any
                ) {
                    if (!admitted(context)) return null;
                    if (current === "unsupported") return current;
                    var desired = !current;
                    return Promise.resolve(
                        native.owner.invoke("set_window_aspect_lock", {
                            enabled: desired,
                        })
                    ).then(function (result: any) {
                        if (
                            !result ||
                            result.ok !== true ||
                            result.supported !== true ||
                            result.enabled !== desired ||
                            typeof result.active !== "boolean"
                        )
                            throw new Error();
                        return result.enabled;
                    });
                });
            }
            if (typeof native.current.isAlwaysOnTop !== "function")
                throw new Error();
            return read(native, kind, context).then(function (current: any) {
                if (!admitted(context)) return null;
                var desired = !current;
                return Promise.resolve(
                    native.owner.invoke("set_always_on_top", {
                        alwaysOnTop: desired,
                    })
                ).then(function (result: any) {
                    if (
                        !result ||
                        result.ok !== true ||
                        result.alwaysOnTop !== desired
                    )
                        throw new Error();
                    return result.alwaysOnTop;
                });
            });
        });
        return task.then(
            function (state: any) {
                pending = false;
                if (state === null) return;
                if (kind === "fullscreen") {
                    if (host.__ottTauriFsEpoch !== fullscreenEpoch) return;
                    host.__ottTauriNativeFs = state;
                }
                // A reply may update known native state, but cannot close or repaint
                // a newer screen. The row never displays an optimistic checked state.
                if (!admitted(context)) return;
                changed(context, kind, state);
                notify(kind, state);
                if (state === "unsupported") return;
                try {
                    if (
                        !context.keepOpen &&
                        typeof host.closeList === "function"
                    )
                        host.closeList();
                } catch (_) {}
            },
            function () {
                pending = false;
                if (
                    admitted(context) &&
                    (kind !== "fullscreen" ||
                        !fullscreenEpoch ||
                        host.__ottTauriFsEpoch === fullscreenEpoch)
                ) {
                    changed(context, kind, "error");
                    notify(kind, null);
                }
            }
        );
    }
    return {
        available: function (kind: string): boolean {
            var native = api();
            return !!(
                native &&
                (kind === "fullscreen" ||
                    kind === "aspectLock" ||
                    typeof native.current.isAlwaysOnTop === "function")
            );
        },
        refresh: refresh,
        run: run,
        title: title,
    };
}
/** Stable command identities are independent of translated labels and function names. */
var screenMenuDefinitions: Array<
    [string, string, string, string?, string?, string?, string?]
> = [
    [
        "video.aspect",
        "toggleAspectRatio",
        "Toggle Aspect Ratio",
        "",
        "",
        "",
        "strAspect",
    ],
    ["video.zoom", "toggleZoom", "Toggle Zoom Mode", "", "", "", "strZoom"],
    [
        "audio.track",
        "toggleAudioTrack",
        "Switch sound track",
        "",
        "1",
        "",
        "strAudio",
    ],
    [
        "subtitle.track",
        "toggleSubtitle",
        "Switch subtitle",
        "",
        "",
        "",
        "strSubt",
    ],
    [
        "channel.previous",
        "popPrevProg",
        "Return to previous channel",
        "",
        "3",
        "",
        "strPRECH",
    ],
    ["playback.toggle", "popPause", "Pause/Play", "", "", "", "strPlayPause"],
    [
        "playback.live",
        "popStop",
        "Restart stream / Live",
        "",
        "7",
        "",
        "strSTOP",
    ],
    ["archive.seek", "popShift", "Rewind", "Show rewind window", "4"],
    [
        "pip.toggle",
        "popTogglePip",
        "Call PiP / PiP exchange",
        "",
        "5",
        "",
        "strPip",
    ],
    ["pip.close", "popStopPip", "Close PiP", "", "6"],
    ["channels.categories", "popBuckets", "Category selection", "", "", "blue"],
    ["guide.open", "popEpg", "Show EPG and archive for channel", "", "", "red"],
    [
        "archive.records",
        "popRecords",
        "Show list of channel archive records",
        "Show list of channel archive records without duplication",
        "",
        "green",
    ],
    ["media.open", "popMedia", "Show Media Library", "", "", "yellow"],
    ["provider.unlock", "toggleProviderSettingsVisibility", ""],
    ["provider.settings", "noop", ""],
    ["settings.open", "optionsList", "Settings", "", "9", "", "strTools"],
    ["app.restart", "restart", "Restart player", "", "8"],
    ["app.exit", "exitPortal", "Exit player", "", "0"],
    ["information.open", "infoList", "Information", "", "2", "", "strInfo"],
    ["favorites.open", "popFavLists", "Favorite lists"],
];
function createScreenMenuRegistry() {
    var nativeHosts: any[] = [];
    var nativeControls: any[] = [];
    function desktopControls(host: any): any {
        var index = nativeHosts.indexOf(host);
        if (index < 0) {
            index = nativeHosts.length;
            nativeHosts.push(host);
            nativeControls.push(createDesktopWindowControls(host));
        }
        return nativeControls[index];
    }
    function windowSettings(host: any) {
        var context: any = {
            keepOpen: true,
            owner: null,
            revisions: {},
            states: {},
        };
        var controls = desktopControls(host);
        return {
            bindOwner: function () {
                var port = host.__ottClassicScreenPort;
                context.owner = port && port.listOwner();
                return controls.refresh(
                    context,
                    ["alwaysOnTop", "aspectLock"].filter(function (kind) {
                        return controls.available(kind);
                    })
                );
            },
            rows: ["alwaysOnTop", "aspectLock"]
                .filter(function (kind) {
                    return controls.available(kind);
                })
                .map(function (kind) {
                    return {
                        get cur() {
                            var state = context.states[kind];
                            if (typeof state === "boolean") {
                                return host._
                                    ? host._(state ? "yes" : "off")
                                    : '<span class="fontello">&#x' +
                                          (state ? "f205" : "f204") +
                                          ";</span>";
                            }
                            return state === undefined
                                ? "…"
                                : host._
                                  ? host._("Unavailable")
                                  : "Unavailable";
                        },
                        id: "window." + kind,
                        name: controls.title(kind),
                        val: 0,
                        values: function () {
                            return controls.run(kind, context);
                        },
                    };
                }),
        };
    }
    var bindings: Array<[string, string]> = [
        ["ZOOM", "video.zoom"],
        ["ASPECT", "video.aspect"],
        ["N0", "app.exit"],
        ["N1", "audio.track"],
        ["AUDIO", "audio.track"],
        ["N2", "information.open"],
        ["N3", "channel.previous"],
        ["N4", "archive.seek"],
        ["N5", "pip.toggle"],
        ["N6", "pip.close"],
        ["N7", "playback.live"],
        ["N8", "app.restart"],
        ["N9", "settings.open"],
        ["TOOLS", "settings.open"],
        ["SUBTITLE", "subtitle.track"],
        ["EPG", "guide.open"],
        ["RED", "guide.open"],
        ["GREEN", "archive.records"],
        ["YELLOW", "media.open"],
        ["BLUE", "channels.categories"],
        ["PREV", "channels.categories"],
    ];
    function defaults(host: any) {
        return {
            actions: screenMenuDefinitions.map(function (record) {
                return host[record[1]];
            }),
            details: screenMenuDefinitions.map(function (record) {
                return record[3] || null;
            }),
            labels: screenMenuDefinitions.map(function (record) {
                return record[2];
            }),
        };
    }
    var legacyNames: any = {
        "provider.settings": "nofun",
        "provider.unlock": "noProvParam",
    };
    function importClassic(host: any): ScreenMenuRecord[] {
        // Existing provider codecs are an explicit input codec, never menu policy.
        var records: ScreenMenuRecord[] = [];
        (host.popupActions || []).forEach(function (
            action: any,
            index: number
        ) {
            if (typeof action !== "function") return;
            var definition: any = null;
            screenMenuDefinitions.some(function (candidate) {
                if (host[candidate[1]] !== action) return false;
                definition = candidate;
                return true;
            });
            // Provider captions may include mutable account/playlist metadata.
            // Resolve their translated pieces when opening the menu, just like
            // the static command keys, without translating user-supplied names.
            var title = String(
                typeof action.menuTitle === "function"
                    ? action.menuTitle()
                    : (host.popupArray || [])[index] || ""
            );
            var detail = String(
                typeof action.menuDetail === "function"
                    ? action.menuDetail()
                    : (host.popupDetail || [])[index] || title
            );

            var legacyId = host.popupActionId
                ? host.popupActionId(action)
                : definition
                  ? legacyNames[definition[0]] || definition[1]
                  : action.name || "";
            records.push({
                action: action,
                color: definition && definition[5],
                detail: detail,
                hint: definition && host[definition[6]],
                id: definition
                    ? definition[0]
                    : "provider:" + String(host.p_pref || "") + ":" + index,
                legacyId: legacyId,
                number: definition && definition[4],
                sourceIndex: index,
                title: title,
            });
        });
        var nas = host.__ottNasLibrary;
        if (nas && nas.available() && typeof host.popNasMedia === "function")
            records.push({
                action: host.popNasMedia,
                detail: nas.title(),
                id: "media.nas",
                legacyId: "popNasMedia",
                sourceIndex: -1,
                title: nas.title(),
            });
        return records;
    }
    function available(record: ScreenMenuRecord, host: any): boolean {
        var channelId = (host.curList || [])[host.primaryIndex];
        var channel = (host.channels || {})[channelId];
        switch (record.id) {
            case "archive.records":
            case "archive.seek":
            case "playback.toggle":
                return (
                    host.playType < 0 || !channelId || !channel || !!channel.rec
                );
            case "audio.track":
                return !!(
                    channelId &&
                    host.stbAudioTracksExists &&
                    host.stbAudioTracksExists()
                );
            case "subtitle.track":
                return !!(
                    channelId &&
                    host.stbSubtitleExists &&
                    host.stbSubtitleExists()
                );
            case "media.open":
                return (
                    typeof host.getMediaArray === "function" &&
                    !(
                        host.__ottActiveProviderDriver &&
                        (host.__ottActiveProviderDriver.id === "plex" ||
                            host.__ottActiveProviderDriver.id === "vportal")
                    )
                );
            case "pip.close":
                return host.pipIndex != null;
            default:
                return true;
        }
    }
    function open(host: any, selected: any) {
        // Resolve labels when opening, after the active language has loaded.
        // Keep the imported titles intact so later language changes can reuse them.
        function translate(text: string): string {
            return typeof host._ === "function" ? host._(text) : text;
        }
        var records = importClassic(host);
        var context: any = { owner: null };
        var controls = desktopControls(host);
        ["fullscreen"].forEach(function (kind, index) {
            if (!controls.available(kind)) return;
            records.push({
                action: function () {
                    return controls.run(kind, context);
                },
                detail: controls.title(kind),
                hint: kind === "fullscreen" ? "L" : undefined,
                id: "window." + kind,
                legacyId: "window." + kind,
                sourceIndex: -2 - index,
                title: controls.title(kind),
            });
        });
        var hidden = host.sHideMenus || [];
        var focus = 0;
        var rows = records
            .filter(function (record) {
                return (
                    hidden.indexOf(record.id) < 0 &&
                    hidden.indexOf(record.legacyId) < 0 &&
                    available(record, host)
                );
            })
            .map(function (record, index) {
                if (
                    selected === record.id ||
                    selected === record.action ||
                    selected == record.sourceIndex
                )
                    focus = index;
                var name = record.title;
                var toggled =
                    record.id === "pip.toggle"
                        ? host.pipIndex != null
                        : record.id === "playback.live"
                          ? !!host.playType
                          : record.id === "playback.toggle"
                            ? !!(host.stbIsPlaying && host.stbIsPlaying())
                            : undefined;
                if (toggled !== undefined && name.indexOf("/") >= 0)
                    name = name.split("/")[toggled ? 1 : 0].trim();
                name = translate(name);
                if (!host.sNoNumbersKeys && record.number)
                    name =
                        '<div class="btn">' + record.number + "</div> " + name;
                if (!host.sNoColorKeys && record.color)
                    name =
                        '<div class="btn ' +
                        record.color +
                        '">&nbsp;</div> ' +
                        name;
                if (record.hint)
                    name = '<div class="btn">' + record.hint + "</div> " + name;
                return {
                    action: record.action,
                    desc: translate(record.detail),
                    id: record.id,
                    name: name,
                };
            });
        return {
            bindOwner: function () {
                var port = host.__ottClassicScreenPort;
                context.owner = port && port.listOwner();
            },
            command: function (code: number) {
                var keys = host.keys;

                for (var i = 0; i < bindings.length; i++)
                    if (keys[bindings[i][0]] && code === keys[bindings[i][0]])
                        return bindings[i][1];
                return "";
            },
            focus: focus,
            invoke: function (id: string) {
                for (var i = 0; i < records.length; i++)
                    if (records[i].id === id) {
                        records[i].action();
                        return;
                    }
            },
            records: records,
            rows: rows,
        };
    }
    return {
        defaults: defaults,
        importClassic: importClassic,
        open: open,
        windowSettings: windowSettings,
    };
}
(window as any).__ottMenuRegistry = createScreenMenuRegistry();
