/**
 * Optional Modern playback overlay. It presents the shared playback state and
 * controls; transport, EPG, decoder and provider ownership stay in their
 * existing modules. Classic never loads this asset.
 */
function createModernPlayer(w: any) {
    var root: HTMLElement | null = null;
    var panel: HTMLElement | null = null;
    var titleElement: HTMLElement | null = null;
    var kickerElement: HTMLElement | null = null;
    var metaElement: HTMLElement | null = null;
    var summaryElement: HTMLElement | null = null;
    var nextElement: HTMLElement | null = null;
    var statusElement: HTMLElement | null = null;
    var elapsedElement: HTMLElement | null = null;
    var remainingElement: HTMLElement | null = null;
    var trackSlot: HTMLElement | null = null;
    var timelineElement: HTMLElement | null = null;
    var rail: HTMLElement | null = null;
    var actions: any[] = [];
    var progress: HTMLElement | null = null;
    var progressMarker: Comment | null = null;
    var active = false;
    var opened = false;
    var interactive = w.__ottInfoInteractive !== false;
    var group = "timeline";
    var railFocus = 0;
    var observer: MutationObserver | null = null;
    var ticker: any = null;
    var scheduled: any = null;
    var iconCache: { [key: string]: string } = {};

    var ICONS: { [key: string]: string } = {
        aspect: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15l3-4 2 2 3-4 2 6"/>',
        audio: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 8a6 6 0 0 1 0 8"/>',
        close: '<path d="M6 6l12 12M18 6L6 18"/>',
        details:
            '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>',
        forward:
            '<path d="M4 12a8 8 0 1 0 2.34-5.66"/><path d="M4 4v5h5"/><text x="10" y="16">10</text>',
        list: '<rect x="4" y="5" width="16" height="4" rx="1"/><rect x="4" y="11" width="16" height="4" rx="1"/><rect x="4" y="17" width="16" height="3" rx="1"/>',
        menu: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
        mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
        pause: '<rect x="7" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
        play: '<path d="M8 5l11 7-11 7z"/>',
        rewind: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/><text x="8" y="16">10</text>',
        subtitles:
            '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6 14h4M13 14h5M6 10h5M14 10h4"/>',
        volume: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
    };

    function translate(value: string): string {
        return typeof w._ === "function" ? w._(value) : value;
    }
    function text(node: any): string {
        return String(node == null ? "" : node.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
    }
    function field(id: string): string {
        var element = w.document.getElementById(id);
        return element ? text(element) : "";
    }
    function kioskBlocked(): boolean {
        return !!(
            w.__ottKiosk &&
            ((typeof w.__ottKiosk.enabled === "function" &&
                w.__ottKiosk.enabled()) ||
                (typeof w.__ottKiosk.locked === "function" &&
                    w.__ottKiosk.locked()) ||
                (typeof w.__ottKiosk.strict === "function" &&
                    w.__ottKiosk.strict()))
        );
    }
    function enabled(): boolean {
        return !!(
            Number(w.settings ? w.settings.interfaceMode : w.sInterfaceMode) ===
                1 &&
            (!w.__ottInterfaceModeState ||
                w.__ottInterfaceModeState.effective === 1)
        );
    }
    function screenOpen(): boolean {
        var port = w.__ottClassicScreenPort;
        return !!(
            w.isListVisible ||
            (port &&
                port.screens &&
                typeof port.screens.current === "function" &&
                port.screens.current())
        );
    }
    function playbackKind(): string {
        var playback = w.__ottClassicPlayback;
        var state =
            playback && typeof playback.snapshot === "function"
                ? playback.snapshot()
                : null;
        if (state && state.target && state.target.kind)
            return String(state.target.kind);
        if (!Number(w.playType)) return "live";
        return Number(w.playType) < 0 ? "vod" : "archive";
    }
    function playing(): boolean {
        return !!(w.stbIsPlaying && w.stbIsPlaying());
    }
    function formatDuration(value: any): string {
        var numeric = Number(value);
        if (!isFinite(numeric)) return "";
        var total = Math.max(0, Math.floor(numeric));
        var hours = Math.floor(total / 3600);
        var minutes = Math.floor((total % 3600) / 60);
        var seconds = total % 60;
        function pad(number: number): string {
            return number < 10 ? "0" + number : String(number);
        }
        return (
            (hours ? hours + ":" + pad(minutes) : String(minutes)) +
            ":" +
            pad(seconds)
        );
    }
    function video(): HTMLVideoElement | null {
        return w.document.getElementById("video") as HTMLVideoElement | null;
    }
    function createButton(id: string, icon: string, label: string): any {
        var button = w.document.createElement("button");
        button.type = "button";
        button.className = "modern-player-action";
        button.setAttribute("data-modern-player-action", id);
        button.setAttribute("aria-label", label);
        button.setAttribute("title", label);
        var glyph = w.document.createElement("span");
        glyph.className = "modern-player-action-icon";
        glyph.setAttribute("aria-hidden", "true");
        button.appendChild(glyph);
        var caption = w.document.createElement("span");
        caption.className = "modern-player-action-label";
        button.appendChild(caption);
        caption.textContent = label;
        button.onclick = function (event: Event): void {
            event.preventDefault();
            event.stopPropagation();
            if (!opened) return;
            invoke(id);
        };
        return { button: button, glyph: glyph, label: caption };
    }
    function paintIcon(entry: any, name: string): void {
        if (
            iconCache[
                entry.button.getAttribute("data-modern-player-action")
            ] === name
        )
            return;
        iconCache[
            entry.button.getAttribute("data-modern-player-action") as string
        ] = name;
        entry.glyph.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            (ICONS[name] || "") +
            "</svg>";
    }
    function actionSpecs(): any[] {
        var isPlaying = playing();
        var kind = playbackKind();
        var volume = video();
        var muted = !!(volume && (volume.muted || !volume.volume));
        var tracks = !!(w.stbAudioTracksExists && w.stbAudioTracksExists());
        var subtitles =
            typeof w.stbSubtitleExists === "function"
                ? Number(w.stbSubtitleExists()) > 0
                : false;
        var details = w.document.getElementById("video_res");
        var canDetails = !!(
            details &&
            details.getAttribute("role") === "button" &&
            text(details)
        );
        return [
            {
                icon: isPlaying ? "pause" : "play",
                id: "play",
                label: translate(isPlaying ? "Pause" : "Play"),
                primary: true,
                run: togglePlayback,
            },
            {
                icon: "rewind",
                id: "rewind",
                label: translate("Rewind"),
                run: function (): void {
                    seek(-10);
                },
            },
            {
                icon: "forward",
                id: "forward",
                label: translate("10 Seconds"),
                run: function (): void {
                    seek(10);
                },
            },
            {
                icon: muted ? "mute" : "volume",
                id: "mute",
                label: translate("volume"),
                run: function (): void {
                    if (typeof w.stbToggleMute === "function")
                        w.stbToggleMute();
                    keepAlive();
                },
            },
            {
                hidden: !tracks,
                icon: "audio",
                id: "audio",
                label: translate("Audio"),
                run: function (): void {
                    if (typeof w.stbToggleAudioTrack === "function")
                        w.stbToggleAudioTrack();
                    keepAlive();
                },
            },
            {
                hidden: !subtitles,
                icon: "subtitles",
                id: "subtitle",
                label: translate("Subtitle"),
                run: function (): void {
                    if (typeof w.stbToggleSubtitle === "function")
                        w.stbToggleSubtitle();
                    keepAlive();
                },
            },
            {
                icon: "aspect",
                id: "aspect",
                label: translate("Aspect"),
                run: function (): void {
                    if (typeof w.stbToggleAspectRatio === "function")
                        w.stbToggleAspectRatio();
                    keepAlive();
                },
            },
            {
                hidden: !canDetails,
                icon: "details",
                id: "details",
                label: translate("Info"),
                run: function (): void {
                    var details = w.document.getElementById("video_res");
                    close();
                    if (details) (details as HTMLElement).click();
                },
            },
            {
                icon: "list",
                id: "list",
                label: translate("Channel list"),
                run: openChannels,
            },
            {
                icon: "menu",
                id: "menu",
                label: translate("Menu"),
                run: function (): void {
                    close();
                    if (typeof w.popupList === "function") w.popupList();
                },
            },
            {
                icon: "close",
                id: "close",
                label: translate("Back"),
                run: close,
            },
        ];
    }
    function buildPanel(): void {
        var node = w.document.createElement("div");
        root = node;
        node.id = "modernPlayer";
        node.className = "modern-player";
        node.setAttribute("hidden", "hidden");
        node.setAttribute("aria-hidden", "true");
        node.innerHTML =
            '<div class="modern-player-scrim"></div>' +
            '<section class="modern-player-panel" role="region">' +
            '  <div class="modern-player-head">' +
            '    <div class="modern-player-heading">' +
            '      <span class="modern-player-kicker"></span>' +
            '      <h1 class="modern-player-title" id="modernPlayerTitle"></h1>' +
            '      <span class="modern-player-meta"></span>' +
            "    </div>" +
            '    <div class="modern-player-actions" role="toolbar"></div>' +
            "  </div>" +
            '  <p class="modern-player-summary"></p>' +
            '  <div class="modern-player-timeline">' +
            '    <span class="modern-player-elapsed"></span>' +
            '    <div class="modern-player-track"></div>' +
            '    <span class="modern-player-remaining"></span>' +
            "  </div>" +
            '  <div class="modern-player-next"></div>' +
            '  <div class="modern-player-status" role="status"></div>' +
            "</section>";
        panel = node.querySelector(
            ".modern-player-panel"
        ) as HTMLElement | null;
        kickerElement = node.querySelector(
            ".modern-player-kicker"
        ) as HTMLElement;
        titleElement = node.querySelector(
            ".modern-player-title"
        ) as HTMLElement;
        metaElement = node.querySelector(".modern-player-meta") as HTMLElement;
        summaryElement = node.querySelector(
            ".modern-player-summary"
        ) as HTMLElement;
        nextElement = node.querySelector(".modern-player-next") as HTMLElement;
        statusElement = node.querySelector(
            ".modern-player-status"
        ) as HTMLElement;
        elapsedElement = node.querySelector(
            ".modern-player-elapsed"
        ) as HTMLElement;
        remainingElement = node.querySelector(
            ".modern-player-remaining"
        ) as HTMLElement;
        timelineElement = node.querySelector(
            ".modern-player-timeline"
        ) as HTMLElement;
        trackSlot = node.querySelector(".modern-player-track") as HTMLElement;
        rail = node.querySelector(".modern-player-actions") as HTMLElement;
        var scrim = node.querySelector(".modern-player-scrim") as HTMLElement;
        scrim.onclick = function (event: Event): void {
            event.preventDefault();
            event.stopPropagation();
            close();
        };
        if (statusElement) {
            statusElement.onclick = function (event: Event): void {
                if (!statusElement) return;
                event.preventDefault();
                event.stopPropagation();
                if (
                    statusElement.classList.contains(
                        "modern-player-status-action"
                    )
                ) {
                    var details = w.document.getElementById("video_res");
                    close();
                    if (details) (details as HTMLElement).click();
                }
            };
        }
        node.addEventListener(
            "touchstart",
            function (event: Event): void {
                event.stopPropagation();
                keepAlive();
            },
            true
        );
        node.addEventListener(
            "mousedown",
            function (): void {
                keepAlive();
            },
            true
        );
        node.addEventListener("focusin", function (event: FocusEvent): void {
            if (!opened) return;
            var promote = !interactive;
            var target = event.target;
            var visible = visibleActions();
            for (var i = 0; i < visible.length; i++) {
                if (visible[i].entry.button === target) {
                    group = "actions";
                    railFocus = i;
                }
            }
            if (target === progress) group = "timeline";
            if (target === statusElement) group = "status";
            node.classList.toggle(
                "modern-player-actions-focus",
                group === "actions"
            );
            setInteractive(true);
            if (promote) keepAlive();
        });
        node.addEventListener("touchmove", function (event: Event): void {
            event.stopPropagation();
        });
        actions = actionSpecs();
        actions.forEach(function (action: any): void {
            var entry = createButton(action.id, action.icon, action.label);
            action.entry = entry;
            if (action.primary)
                entry.button.classList.add("modern-player-primary");
            entry.button.hidden = !!action.hidden;
            paintIcon(entry, action.icon);
            rail!.appendChild(entry.button);
        });
        var target = w.document.getElementById("list");
        if (target && target.parentNode)
            target.parentNode.insertBefore(node, target);
        else (w.document.body || w.document.documentElement).appendChild(node);
        mountProgress();
    }
    function mountProgress(): void {
        var element = w.document.getElementById("progress_div");
        if (!element || !trackSlot) return;
        if (progress && progress.parentNode === trackSlot) {
            progress.classList.add("modern-player-progress");
            return;
        }
        if (!progressMarker && element.parentNode) {
            progressMarker = w.document.createComment(
                "modern-player-timeline-origin"
            );
            element.parentNode.insertBefore(progressMarker, element);
        }
        var target: HTMLElement = element;
        progress = target;
        target.classList.add("modern-player-progress");
        target.setAttribute("role", "slider");
        target.setAttribute("aria-labelledby", "modernPlayerTitle");
        target.setAttribute("aria-valuemin", "0");
        target.setAttribute("aria-valuemax", "100");
        target.tabIndex = 0;
        trackSlot.appendChild(target);
    }
    function restoreProgress(): void {
        if (progress && progressMarker && progressMarker.parentNode) {
            progressMarker.parentNode.insertBefore(progress, progressMarker);
            progress.classList.remove("modern-player-progress");
            progress.removeAttribute("role");
            progress.removeAttribute("aria-labelledby");
            progress.removeAttribute("aria-valuemin");
            progress.removeAttribute("aria-valuemax");
            progress.removeAttribute("aria-valuenow");
            progress.removeAttribute("aria-valuetext");
            progress.removeAttribute("tabindex");
        }
        if (progressMarker && progressMarker.parentNode)
            progressMarker.parentNode.removeChild(progressMarker);
        progress = null;
        progressMarker = null;
    }
    function close(): void {
        if (typeof w.infoBarHide === "function") w.infoBarHide();
    }
    function setInteractive(value: boolean | null): void {
        if (value === null) return;
        var changed = interactive !== value;
        interactive = w.__ottInfoInteractive = value;
        if (!root) return;
        var focused = w.document.activeElement;
        if (!value) {
            group = "timeline";
            root.classList.remove("modern-player-actions-focus");
            if (focused && root.contains(focused)) focused.blur();
        } else if (
            changed &&
            opened &&
            !editingTarget(focused) &&
            !screenOpen() &&
            !modalOpen()
        ) {
            setGroup(root.contains(focused) ? group : "timeline");
        }
    }
    function keepAlive(): void {
        if (!opened) return;
        if (typeof w.showChannelInfo === "function") w.showChannelInfo(1);
    }
    function togglePlayback(): void {
        var kind = playbackKind();
        if (kind === "live") {
            if (typeof w.pauseLivePlayback === "function")
                w.pauseLivePlayback();
            keepAlive();
            return;
        }
        if (playing()) {
            w.forcePlay = false;
            if (typeof w.showShift === "function")
                w.showShift(translate("Pause"));
            if (typeof w.showChannelInfo === "function") w.showChannelInfo(2);
            var paused = w.__ottClassicPlayback;
            if (paused && typeof paused.command === "function")
                paused.command({ type: "pause" });
            if (typeof w.stbPause === "function") w.stbPause();
            return;
        }
        w.forcePlay = true;
        if (typeof w.showShift === "function") w.showShift(translate("Play"));
        if (w.$i1 && typeof w.$i1.hide === "function") w.$i1.hide();
        else if (typeof w.infoBarHide === "function") w.infoBarHide();
        if (kind === "vod" || w.fileArchive) {
            var playback = w.__ottClassicPlayback;
            if (playback && typeof playback.command === "function")
                playback.command({ type: "resume" });
            if (typeof w.stbContinue === "function") w.stbContinue();
        } else if (typeof w.playArchive === "function") {
            var state =
                w.__ottClassicPlayback &&
                typeof w.__ottClassicPlayback.snapshot === "function"
                    ? w.__ottClassicPlayback.snapshot()
                    : null;
            var epoch =
                state && state.target ? state.target.archiveStart : w.playType;
            var position =
                state && state.target ? state.target.position : w.playTime || 0;
            w.playArchive(epoch + position - (w.s10resum ? 10 : 0));
        }
    }
    function seek(delta: number): void {
        if (typeof w.shiftArchive === "function") w.shiftArchive(delta);
        keepAlive();
    }
    function openChannels(): void {
        close();
        if (w.__ottActiveProviderDriver?.catalogBrowser?.restore()) return;
        if (w.__ottChannels?.restoreBrowsing?.()) return;
        if (typeof w.channelsList === "function")
            w.channelsList(w.catIndex, w.primaryIndex);
    }
    function invoke(id: string): void {
        var action = actions.filter(function (candidate: any): boolean {
            return candidate.id === id;
        })[0];
        if (!action || action.entry.button.hidden) return;
        group = "actions";
        var visible = visibleActions();
        var index = visible.indexOf(action);
        if (index >= 0) railFocus = index;
        if (typeof action.run === "function") action.run();
    }
    function visibleActions(): any[] {
        return actions.filter(function (action: any): boolean {
            return !action.entry.button.hidden;
        });
    }
    function setGroup(next: string): void {
        group = next;
        if (!root) return;
        root.classList.toggle(
            "modern-player-actions-focus",
            next === "actions"
        );
        if (next === "actions") {
            var visible = visibleActions();
            if (!visible.length) return;
            railFocus = Math.max(0, Math.min(visible.length - 1, railFocus));
            var button = visible[railFocus].entry.button;
            button.focus();
            if (rail && typeof rail.getBoundingClientRect === "function") {
                var railBounds = rail.getBoundingClientRect();
                var buttonBounds = button.getBoundingClientRect();
                var safeLeft = railBounds.left + 8;
                var safeRight = railBounds.right - 8;
                if (buttonBounds.left < safeLeft)
                    rail.scrollLeft = Math.max(
                        0,
                        rail.scrollLeft - (safeLeft - buttonBounds.left)
                    );
                else if (buttonBounds.right > safeRight)
                    rail.scrollLeft += buttonBounds.right - safeRight;
            }
        } else if (next === "status" && statusElement) {
            statusElement.focus();
        } else if (progress) {
            progress.focus();
        }
    }
    function moveRail(direction: number): void {
        var visible = visibleActions();
        if (!visible.length) return;
        railFocus = (railFocus + direction + visible.length) % visible.length;
        setGroup("actions");
    }
    function activateRail(): void {
        var visible = visibleActions();
        var action = visible[railFocus];
        if (action && !action.entry.button.disabled)
            action.entry.button.click();
    }
    function keyId(event: any): string {
        var name = event.key || "";
        if (name === "ArrowLeft" || name === "Left") return "left";
        if (name === "ArrowRight" || name === "Right") return "right";
        if (name === "ArrowUp" || name === "Up") return "up";
        if (name === "ArrowDown" || name === "Down") return "down";
        if (name === "Enter" || name === "Select") return "accept";
        if (
            name === "Escape" ||
            name === "Backspace" ||
            name === "GoBack" ||
            name === "BrowserBack"
        )
            return "back";
        var code = Number(event.keyCode || event.which || 0);
        if (typeof w.__ottDevice?.eventToKeyCode === "function") {
            try {
                code = Number(w.__ottDevice.eventToKeyCode(event)) || code;
            } catch (_) {}
        }
        var keys = w.keys || {};
        if (code === keys.LEFT) return "left";
        if (code === keys.RIGHT) return "right";
        if (code === keys.UP) return "up";
        if (code === keys.DOWN) return "down";
        if (code === keys.ENTER) return "accept";
        if (code === keys.RETURN || code === keys.EXIT) return "back";
        return "";
    }
    function onKeydown(event: any): boolean {
        if (
            !event ||
            event.defaultPrevented ||
            !active ||
            kioskBlocked() ||
            screenOpen()
        )
            return false;
        if (editingTarget(event.target) || modalOpen()) {
            syncVisibility();
            return false;
        }
        var statusSpace =
            group === "status" &&
            statusElement === w.document.activeElement &&
            (event.key === " " ||
                event.key === "Spacebar" ||
                Number(event.keyCode || event.which) === 32);
        var id = statusSpace ? "accept" : keyId(event);
        if (!id) return false;
        // Synthetic native keys have no DOM target. Keep an unowned input
        // focused instead of falling through to background channel navigation.
        if (editingTarget(w.document.activeElement)) return !event.target;
        if (!opened) return false;
        if (!interactive) {
            if (id !== "accept") return false;
            setInteractive(true);
            keepAlive();
            if (event.preventDefault) event.preventDefault();
            if (event.stopPropagation) event.stopPropagation();
            if (event.stopImmediatePropagation)
                event.stopImmediatePropagation();
            return true;
        }
        if (event.preventDefault) event.preventDefault();
        if (event.stopPropagation) event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        if (id === "back") close();
        else if (id === "up" || id === "down") {
            if ((id === "up") === (group === "timeline")) close();
            else {
                setGroup(id === "up" ? "timeline" : "actions");
                keepAlive();
            }
        } else if (id === "left" || id === "right") {
            var direction = id === "left" ? -1 : 1;
            if (group === "timeline") seek(direction * 10);
            else {
                moveRail(direction);
                keepAlive();
            }
        } else if (id === "accept") {
            if (group === "timeline") togglePlayback();
            else if (group === "status" && statusElement) statusElement.click();
            else activateRail();
        }
        return true;
    }

    function videoTarget(target: any): boolean {
        if (!target || target.nodeType !== 1) return false;
        if (root && root.contains(target)) return false;
        if (typeof target.closest !== "function") return false;
        if (target.closest("#list,#listIn,#listEdit,#listAbout,#dialogbox"))
            return false;
        return !!(
            target.tagName === "VIDEO" || target.closest("#video,#vdiv,#launch")
        );
    }
    function onClick(event: any): void {
        if (
            !active ||
            (opened && interactive) ||
            kioskBlocked() ||
            screenOpen()
        )
            return;
        if (modalOpen()) return;
        if (w.__ottTauriSuppressClick || w.__ottInfoBandFromMouseUp) return;
        if (!videoTarget(event.target)) return;
        if (event.preventDefault) event.preventDefault();
        if (event.stopPropagation) event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        if (typeof w.showChannelInfo === "function") w.showChannelInfo();
    }
    function elementShown(id: string): boolean {
        var element = w.document.getElementById(id);
        if (!element) return false;
        var inline = String((element.style && element.style.display) || "");
        if (inline === "none") return false;
        if (inline) return true;
        try {
            var computed = w.getComputedStyle
                ? w.getComputedStyle(element)
                : null;
            return !!(computed && computed.display !== "none");
        } catch (_) {
            return false;
        }
    }
    // Dialogs, number entry and popups own input while they are open. The
    // overlay steps aside so their key handler still receives every press.
    function modalOpen(): boolean {
        return !!(
            w.dialogBoxKeyHandler ||
            elementShown("dialogbox") ||
            elementShown("numprog") ||
            elementShown("listPopUp")
        );
    }
    function editingTarget(target: any): boolean {
        if (!target || target.nodeType !== 1) return false;
        for (
            var ancestor = target;
            ancestor;
            ancestor = ancestor.parentElement
        ) {
            if (
                ancestor.hidden ||
                ancestor.style?.display === "none" ||
                ancestor.style?.visibility === "hidden"
            )
                return false;
        }
        var tag = String(target.tagName || "").toUpperCase();
        return (
            tag === "INPUT" ||
            tag === "TEXTAREA" ||
            tag === "SELECT" ||
            target.isContentEditable === true
        );
    }
    function infoVisible(): boolean {
        var element = w.document.getElementById("info1");
        if (!element) return false;
        var display = String(element.style.display || "");
        if (display === "none") return false;
        if (display) return true;
        try {
            // Display is owned by the classic show/hide calls. Never treat the
            // Modern-only visibility:hidden rule as a closed footer.
            var computed = w.getComputedStyle
                ? w.getComputedStyle(element)
                : null;
            return !(computed && computed.display === "none");
        } catch (_) {
            return false;
        }
    }
    function render(): void {
        if (!active || !root || !opened) return;
        var kind = playbackKind();
        var channel = field("channel_name");
        var number = field("channel_number");
        var programme = field("programm_name");
        var title = programme || channel;
        var meta: string[] = [];
        if (channel && channel !== title) meta.push(channel);
        if (number) meta.push("#" + number);
        var kicker =
            kind === "live"
                ? translate("Live")
                : kind === "archive"
                  ? translate("Archive")
                  : translate("Media Library");
        if (kickerElement) kickerElement.textContent = kicker;
        if (titleElement) titleElement.textContent = title;
        if (metaElement) {
            metaElement.textContent = meta.join(" · ");
            metaElement.hidden = !meta.length;
        }
        var summary = field("programm_descr");
        if (summaryElement) {
            summaryElement.textContent = summary;
            summaryElement.hidden = !summary;
        }
        var next = field("nprogramm_name");
        var nextTime = field("nbegin_time");
        if (nextElement) {
            nextElement.textContent = next
                ? (nextTime ? nextTime + " · " : "") + next
                : "";
            nextElement.hidden = !next;
        }
        updateTimeline(kind);
        updateActions();
        updateStatus();
    }
    function progressPercent(kind: string): number {
        var percent: number | null = null;
        if (kind === "live" && w._prog100 && w._prog100.time_to) {
            var span = Number(w._prog100.time_to) - Number(w._prog100.time);
            if (span > 0 && isFinite(span))
                percent =
                    ((Date.now() / 1000 - Number(w._prog100.time)) / span) *
                    100;
        } else if (kind !== "live") {
            var duration = 0;
            var position = 0;
            if (kind === "archive" && w._prog100) {
                position = Number(w.playType || 0) + Number(w.playTime || 0);
                duration = Number(w._prog100.time_to) - Number(w._prog100.time);
                position -= Number(w._prog100.time);
            } else {
                var media = video();
                position = media ? Number(media.currentTime) : NaN;
                duration = media ? Number(media.duration) || 0 : 0;
                if (!duration && typeof w.stbGetLen === "function")
                    duration = Number(w.stbGetLen()) || 0;
            }
            if (duration > 0 && isFinite(duration) && isFinite(position))
                percent = (position / duration) * 100;
        }
        if (percent !== null && !isFinite(percent)) percent = null;
        // Zero is a measured position, including the first frame after a seek.
        // Keep the shared footer fallback only until timing is available.
        if (percent === null && progress) {
            var fill = progress.querySelector("#progress") as HTMLElement;
            percent = parseFloat((fill && fill.style.width) || "0") || 0;
        }
        return Math.max(0, Math.min(100, percent === null ? 0 : percent));
    }
    function updateTimeline(kind: string): void {
        var percent = progressPercent(kind);
        var fill = progress
            ? (progress.querySelector("#progress") as HTMLElement)
            : null;
        if (fill) fill.style.width = percent + "%";
        var left = "";
        var right = "";
        if (kind === "live") {
            left = field("begin_time");
            right = field("end_time");
            if (/^\+\d+$/.test(right)) right += " " + translate("min");
        } else if (kind === "archive" && w._prog100) {
            var span = Number(w._prog100.time_to) - Number(w._prog100.time);
            var pos =
                Number(w.playType || 0) +
                Number(w.playTime || 0) -
                Number(w._prog100.time);
            left = formatDuration(pos);
            right = formatDuration(span - pos);
        } else {
            var media = video();
            var position = media ? Number(media.currentTime) || 0 : 0;
            var duration = media ? Number(media.duration) || 0 : 0;
            if (!duration && typeof w.stbGetLen === "function")
                duration = Number(w.stbGetLen()) || 0;
            if (!position && typeof w.stbGetPosTime === "function")
                position = Number(w.stbGetPosTime()) || 0;
            left = formatDuration(position);
            right = duration > 0 ? formatDuration(duration - position) : "";
        }
        if (kind !== "live" && right) right = "-" + right;
        if (elapsedElement) {
            elapsedElement.textContent = left;
            elapsedElement.hidden = !left;
        }
        if (remainingElement) {
            remainingElement.textContent = right;
            remainingElement.hidden = !right;
        }
        // Live streams without guide data have no meaningful position. Keep
        // the live badge and actions, but do not show an empty scrubber.
        if (timelineElement)
            timelineElement.hidden = !(
                kind !== "live" ||
                left ||
                right ||
                (w._prog100 && w._prog100.time_to)
            );
        if (progress) {
            progress.setAttribute("aria-valuenow", String(Math.round(percent)));
            progress.setAttribute(
                "aria-valuetext",
                (left || formatDuration(0)) +
                    (right ? " / " + right.replace(/^-/, "") : "")
            );
        }
        if (panel) {
            panel.classList.toggle("modern-player-live", kind === "live");
            panel.classList.toggle("modern-player-finite", kind !== "live");
        }
    }
    function updateActions(): void {
        var specs = actionSpecs();
        var specById: { [id: string]: any } = {};
        specs.forEach(function (spec: any): void {
            specById[spec.id] = spec;
        });
        actions.forEach(function (action: any): void {
            var spec = specById[action.id] || action;
            action.entry.button.hidden = !!spec.hidden;
            if (action.entry.button.hidden) return;
            paintIcon(action.entry, spec.icon || action.icon);
            if (action.entry.label.textContent !== (spec.label || action.label))
                action.entry.label.textContent = spec.label || action.label;
            action.entry.button.setAttribute(
                "aria-label",
                spec.label || action.label
            );
            action.entry.button.setAttribute(
                "title",
                spec.label || action.label
            );
            action.entry.button.classList.toggle(
                "modern-player-primary",
                !!spec.primary
            );
        });
        if (group === "actions") {
            var visible = visibleActions();
            if (!visible.length) {
                setGroup("timeline");
            } else {
                for (var i = 0; i < visible.length; i++) {
                    if (visible[i].entry.button === w.document.activeElement) {
                        railFocus = i;
                        return;
                    }
                }
                railFocus = Math.min(railFocus, visible.length - 1);
                visible[railFocus].entry.button.focus();
            }
        }
    }
    function updateStatus(): void {
        if (!statusElement) return;
        var hadFocus = statusElement === w.document.activeElement;
        var source = w.document.getElementById("video_res");
        var message = source ? text(source) : "";
        statusElement.textContent = message;
        statusElement.hidden = !message;
        var interactive = !!(
            message &&
            source &&
            source.getAttribute("role") === "button"
        );
        statusElement.classList.toggle(
            "modern-player-status-action",
            interactive
        );
        if (interactive) {
            statusElement.setAttribute("role", "button");
            statusElement.tabIndex = 0;
        } else {
            statusElement.removeAttribute("role");
            statusElement.removeAttribute("tabindex");
        }
        if (group === "status" && !interactive) {
            group = "timeline";
            if (hadFocus) setGroup("actions");
        }
    }
    function syncVisibility(): void {
        if (!active) return;
        var visible = infoVisible() && !screenOpen() && !modalOpen();
        if (visible === opened) {
            if (opened) render();
            return;
        }
        opened = visible;
        if (!root) return;
        if (visible) {
            root.removeAttribute("hidden");
            root.setAttribute("aria-hidden", "false");
            (w.document.body || w.document.documentElement).classList.add(
                "modern-player-open"
            );
            mountProgress();
            render();
            if (interactive && !editingTarget(w.document.activeElement))
                setGroup("timeline");
            if (!ticker)
                ticker = w.setInterval(function (): void {
                    if (opened) render();
                }, 500);
        } else {
            root.setAttribute("hidden", "hidden");
            root.setAttribute("aria-hidden", "true");
            (w.document.body || w.document.documentElement).classList.remove(
                "modern-player-open"
            );
            if (ticker) w.clearInterval(ticker);
            ticker = null;
            if (
                w.document.activeElement &&
                root.contains(w.document.activeElement)
            )
                (w.document.activeElement as HTMLElement).blur();
        }
    }
    function schedule(): void {
        if (!active || scheduled) return;
        scheduled = w.setTimeout(function (): void {
            scheduled = null;
            syncVisibility();
        }, 0);
    }
    function observe(): void {
        if (observer || !w.MutationObserver) {
            if (!observer) {
                // Older engines cannot observe the shared footer; the ticker
                // still repaints while it is visible.
                schedule();
            }
            return;
        }
        var next = new w.MutationObserver(function (): void {
            schedule();
        });
        observer = next;
        ["info1", "dialogbox", "numprog", "listPopUp"].forEach(function (
            id: string
        ): void {
            var element = w.document.getElementById(id);
            if (element)
                next.observe(element, {
                    attributes: true,
                    characterData: true,
                    childList: true,
                    subtree: true,
                });
        });
    }
    function activate(): void {
        if (active) return;
        active = true;
        buildPanel();
        (w.document.body || w.document.documentElement).classList.add(
            "modern-player-ready"
        );
        observe();
        w.addEventListener("keydown", onKeydown, true);
        w.addEventListener("click", onClick, true);
        mountProgress();
        syncVisibility();
    }
    function deactivate(): void {
        if (!active) return;
        active = false;
        opened = false;
        if (scheduled) w.clearTimeout(scheduled);
        scheduled = null;
        if (ticker) w.clearInterval(ticker);
        ticker = null;
        if (observer) observer.disconnect();
        observer = null;
        w.removeEventListener("keydown", onKeydown, true);
        w.removeEventListener("click", onClick, true);
        restoreProgress();
        if (root && root.parentNode) root.parentNode.removeChild(root);
        var body = w.document.body || w.document.documentElement;
        if (body) {
            body.classList.remove("modern-player-ready", "modern-player-open");
        }
        root = panel = null;
        titleElement =
            kickerElement =
            metaElement =
            summaryElement =
            nextElement =
            statusElement =
            elapsedElement =
            remainingElement =
            trackSlot =
            timelineElement =
            rail =
                null;
        actions = [];
        iconCache = {};
    }
    function refresh(): void {
        var wanted = enabled() && !kioskBlocked();
        if (wanted && !active) activate();
        else if (!wanted && active) deactivate();
        else if (active) syncVisibility();
    }
    return {
        destroy: deactivate,
        handleKey: onKeydown,
        refresh: refresh,
        setInteractive: setInteractive,
        state: function (): any {
            return {
                active: active,
                group: group,
                interactive: interactive,
                open: opened,
                railFocus: railFocus,
            };
        },
        sync: function (): void {
            syncVisibility();
            if (opened) render();
        },
    };
}
(window as any).__ottModernPlayerFactory = createModernPlayer;
