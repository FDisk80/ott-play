/** Existing Local UI owner; feature rows share the same data APIs. */
function createLocalMediaUi(w: any, p: any): any {
    function startWithFile(sourceId: string): void {
        if (p.locked() || p.settingsLocked()) return;
        p.finishLoading();
        p.revision++;
        w.editCaption = w._("Start with file");
        w.editvar = "";
        w.setEdit = function () {
            if (!p.current() || p.locked() || p.settingsLocked()) return;
            var path = String(w.editvar || "").trim();
            if (!path) {
                render("Enter a file path relative to this folder.");
                return;
            }
            run(function () {
                var request = ++p.catalogRevision;
                p.importedSelection = "";
                var namespace = w.__ottOfflineProfiles.namespace();
                return p.browser.bootstrapFile(sourceId, path).then(
                    function (value: any) {
                        if (request !== p.catalogRevision)
                            return { cancelled: true, items: [] };
                        p.last = value;
                        var item = value.items.filter(function (entry: any) {
                            return entry.available !== false && !!entry.url;
                        })[0];
                        p.importedSelection = item ? "local-" + item.id : "";
                        return value;
                    },
                    function (error: any) {
                        if (
                            request === p.catalogRevision &&
                            p.current() &&
                            !p.locked() &&
                            !p.settingsLocked() &&
                            error?.name === "TimeoutError" &&
                            namespace === w.__ottOfflineProfiles.namespace()
                        ) {
                            w.stbSetItem(
                                p.pendingFileKey,
                                JSON.stringify({
                                    id: "local-" + sourceId + ":" + path,
                                    namespace: namespace,
                                })
                            );
                            throw new Error(
                                "The file is remembered. Restart Chrome completely, then reopen the player."
                            );
                        }
                        throw error;
                    }
                );
            }, true);
        };
        w.showEditKey(null);
    }
    function text(value: any): string {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
    function editServer(): void {
        if (p.locked() || p.settingsLocked()) return;
        p.finishLoading();
        p.revision++;
        w.editCaption = w._("Media Library URL");
        w.editvar = p.remoteEndpoint();
        var admitted = p.captureSettings();
        w.setEdit = function () {
            if (!admitted()) return;
            var value = String(w.editvar || "")
                .trim()
                .replace(/\/+$/, "");
            if (value) {
                try {
                    var parsed = new URL(value);
                    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname)
                        throw new Error("Invalid server URL");
                } catch (_) {
                    render("Use a complete HTTP or HTTPS URL.");
                    return;
                }
            }
            if (!p.finishSession(false, undefined, admitted) || !admitted())
                return;
            w.stbSetItem("localMediaEndpoint", value);
            p.catalogRevision++;
            run(p.list);
        };
        w.showEditKey(null);
    }
    function restorePlayback(): void {
        run(function () {
            var request = p.revision,
                owner = p.owner;
            function resume(): boolean {
                if (
                    request === p.revision &&
                    owner === p.owner &&
                    p.resuming &&
                    p.current()
                ) {
                    if (!p.playable()) return true;
                    p.activate();
                }
                return false;
            }
            return p.requestAccess(resume).then(function (value) {
                if (!(value && (value.cancelled || value.pickerCancelled)))
                    resume();
                return value;
            });
        });
    }
    function browserFolder(source: any): boolean {
        return (
            source.kind === "folder" &&
            !p.isNative() &&
            !p.isTauri() &&
            !p.remoteEndpoint()
        );
    }
    function render(message?: string): void {
        if (!p.current()) return;
        if (p.locked() || p.settingsLocked()) {
            p.close();
            return;
        }
        if (p.last?.reconnectRequired && !p.isNative() && !p.isTauri())
            message =
                (message ? message + " " : "") +
                "Reconnect the saved folder to renew its access after a drive or network change.";
        var readOnly = p.remoteEndpoint() && p.last?.readOnly;
        var selected = w.selIndex || 0;
        var rows: any[] = [];
        function row(
            id: string,
            name: string,
            description: string,
            action: () => void
        ): void {
            rows.push({
                action: action,
                description: description,
                id: id,
                name: name,
            });
        }
        if (p.resuming)
            row(
                "resume",
                "Continue playback",
                p.last &&
                    (p.last.sources || []).some(function (source: any) {
                        return source.access === "permission-required";
                    })
                    ? "Chrome needs permission to read your saved folder again. Choose Allow on every visit in its prompt to resume automatically on later visits. No video files are copied."
                    : "Reconnect the original folder or drive, then continue playback. The saved source and video selection are preserved.",
                restorePlayback
            );
        if (!readOnly) {
            row(
                "add-folder",
                "Add folder",
                !p.isNative() && !p.isTauri()
                    ? "Chrome may ask to view and copy files. This grants read access; OTT plays the originals without storing another media copy."
                    : "Play files directly from the selected folder without copying them.",
                function () {
                    run(function () {
                        return p.importFiles(true);
                    }, !p.isNative());
                }
            );
            row(
                "add-files",
                "Add files",
                "Play selected files directly without copying them.",
                function () {
                    run(function () {
                        return p.importFiles();
                    }, !p.isNative());
                }
            );
        }
        if (
            !readOnly &&
            p.last &&
            (p.last.sources || []).some(function (source: any) {
                return !source.available;
            })
        )
            row(
                "grant-access",
                "Grant access",
                "Allow access to previously connected sources.",
                function () {
                    if (p.resuming) restorePlayback();
                    else run(p.requestAccess);
                }
            );
        var profiles = w.__ottOfflineProfiles;
        if (profiles && profiles.current())
            row(
                "bind-profile",
                "Bind loaded profile to connected sources",
                "Explicitly match this profile's source names and saved video to folders connected on this device. Ambiguous or missing sources are rejected.",
                function () {
                    run(function () {
                        return profiles.bindCurrent();
                    });
                }
            );
        row("refresh", "Refresh", "Read connected folders again.", function () {
            run(function () {
                if (readOnly) {
                    var request = ++p.catalogRevision;
                    var url = new URL(p.remoteEndpoint());
                    url.searchParams.set("refresh", "true");
                    return p
                        .boundedCatalogRequest(url.href, 60000)
                        .then(function () {
                            return request === p.catalogRevision
                                ? p.list()
                                : { cancelled: true, items: [] };
                        });
                }
                return p.isTauri()
                    ? p.getEndpoint(true).then(function () {
                          return p.list();
                      })
                    : p.list();
            });
        });
        row(
            "play",
            "Play local videos",
            p.playable()
                ? "Open the local video channel list."
                : "No playable local videos. Add a folder or grant access to a connected source.",
            function () {
                if (p.playable()) p.activate();
            }
        );
        ((p.last && p.last.sources) || []).forEach(function (source: any) {
            if (readOnly) {
                row(
                    "readonly-source",
                    source.name,
                    "Read-only source. Manage folders in the helper configuration.",
                    function () {}
                );
                return;
            }
            if (
                browserFolder(source) &&
                typeof p.browser.reconnectSource === "function"
            )
                row(
                    "reconnect-source",
                    "Reconnect: " + source.name,
                    "Choose the same folder again after reconnecting the drive or NAS. The player reloads with renewed access; saved profiles and file references are preserved.",
                    function () {
                        run(function () {
                            return p.reconnectSource(source.id);
                        });
                    }
                );
            if (
                browserFolder(source) &&
                typeof p.browser.bootstrapFile === "function"
            )
                row(
                    "start-with-file",
                    "Start with file…: " + source.name,
                    "Enter a known video path inside this folder, for example Movies/video.mp4. Play it without waiting for the full folder scan; no files are copied.",
                    function () {
                        startWithFile(source.id);
                    }
                );
            row(
                "disconnect-source",
                "Disconnect: " + source.name,
                (source.available
                    ? "Connected. "
                    : source.access === "permission-required"
                      ? "Read permission is needed again; the source is still saved. "
                      : "Source unavailable. ") +
                    "Disconnecting leaves the original files untouched.",
                function () {
                    run(function () {
                        return p.removeSource(source.id);
                    });
                }
            );
        });
        ((p.last && p.last.items) || []).forEach(function (item: any) {
            var playback = item.playback;
            if (playback && playback.mode === "unsupported") {
                row(
                    "unsupported-" + item.id,
                    "Unavailable: " + item.name,
                    "Native/server compatibility required; no uploads.",
                    function () {}
                );
                return;
            }
            if (readOnly || item.source === "linked") return;
            row(
                "remove-copy",
                "Remove copy: " + item.name,
                "Remove this previously imported copy from the library.",
                function () {
                    run(function () {
                        return p.remove(item.id);
                    });
                }
            );
        });
        if (!p.isTauri())
            row(
                "server-library",
                "Server library…",
                p.remoteEndpoint()
                    ? "A server library is selected. Clear its URL to use files on this device."
                    : "Optional: use compatible playback from your Server library without uploading originals. Network access is required.",
                editServer
            );
        row("close", "Close", "Return to player settings.", p.close);
        w.listArray = rows;
        w.listDataArray = rows;
        w.selIndex = Math.min(selected, rows.length - 1);
        w.getListItem = function (item: any) {
            return (
                '&nbsp;&nbsp;<span data-local-media-action="' +
                item.id +
                '">' +
                text(w._ ? w._(item.name) : item.name) +
                "</span>"
            );
        };
        w.detailListAction = function () {
            var item = rows[w.selIndex];
            w.listDetail.innerHTML = text(
                message || (item && item.description) || ""
            );
            w.listFooter.innerHTML =
                w.renderButtonHint(w.keys.RETURN, w.strRETURN, "Close") +
                w.renderButtonHint(w.keys.ENTER, w.strENTER, "Ok");
        };
        p.handler = function (key: number) {
            if (!p.current()) return false;
            if (key === w.keys.RETURN || key === w.keys.EXIT) {
                p.close();
                return true;
            }
            if (key !== w.keys.ENTER) return false;
            if (p.locked() || p.settingsLocked()) {
                p.close();
                return true;
            }
            var item = rows[w.selIndex];
            if (item) item.action();
            return true;
        };
        w.listKeyHandler = p.handler;
        w.listCaption.innerHTML = text(p.title());
        w.$("#listPopUp").hide();
        w.showPage();
        p.owner = w.__ottClassicScreenPort
            ? w.__ottClassicScreenPort.listOwner()
            : null;
        if (p.owner && p.owner.model) p.owner.model.localOnlyInput = true;
    }
    function run(action: () => Promise<any>, startPlayback = false): void {
        var request = ++p.revision;
        p.finishLoading();
        p.progressState = null;
        // Start the picker inside the user gesture, before rendering or awaiting.
        var pending: Promise<any>;
        try {
            pending = action();
        } catch (error: any) {
            render(error.message || String(error));
            return;
        }
        // Use the same owned loading dialog as provider/media loading. Its
        // parent list automatically disposes it when another screen replaces us.
        var active: any = null;
        if (p.current() && w.__ottClassicScreenPort) {
            active = w.__ottClassicScreenPort.setOwnedCallback(
                "dialog",
                function (key: number) {
                    if (key === w.keys.RETURN || key === w.keys.EXIT) p.close();
                }
            ).owner;
            p.loading = active;
            active.model = active.model || {};
            active.model.cancelOnPower = p.close;
            w.$("#dialogbox")
                .html(
                    '<center><div class="ott-spinner" aria-hidden="true"><span class="blob"></span><span class="blob"></span><span class="blob"></span><span class="blob"></span></div></center><br/>' +
                        text(w._("Loading. Please wait...")) +
                        '<div id="local-media-progress">' +
                        text(
                            p.formatLocalMediaProgress(
                                p.progressState || { items: [] },
                                w._
                            )
                        ) +
                        "</div><br/><br/>" +
                        w.renderButtonHint(w.keys.RETURN, w.strRETURN, "Cancel")
                )
                .show();
        }
        pending.then(
            function (value) {
                p.finishLoading(active);
                if (request === p.revision) {
                    if (
                        startPlayback &&
                        !(value && value.pickerCancelled) &&
                        p.current() &&
                        p.playable()
                    )
                        p.activate();
                    else render();
                }
            },
            function (error) {
                p.finishLoading(active);
                if (request === p.revision)
                    render(error.message || String(error));
            }
        );
    }
    function open(recovery = false, skipScan = false, message = ""): void {
        if (p.locked()) return;
        if (p.settingsLocked()) {
            if (typeof w.enterPinAndSetAccess === "function")
                w.enterPinAndSetAccess(open);
            return;
        }
        p.finishLoading();
        p.resuming = recovery;
        p.opened = true;
        p.handler = null;
        p.owner = null;
        w.selIndex = 0;
        if (skipScan) p.catalogRevision++;
        render(message || p.failureMessage(p.last));
        if (!skipScan) run(p.list);
    }

    return { open };
}
(window as any).__ottLocalMediaUiFactory = createLocalMediaUi;
