/** Bounded playback feedback; transport retries remain owned by the engine. */
(function (host: any): void {
    var media: HTMLVideoElement | null = null;
    var active = false;
    var expired = false;
    var timer: ReturnType<typeof setTimeout> | null = null;
    var armed = false;
    var confirmedProgress = false;
    var observation: {
        generation: number;
        media: HTMLVideoElement;
        source: string;
        timer: ReturnType<typeof setTimeout> | null;
    } | null = null;
    var preparing = false;
    var recoveryOverlay = false;
    var lastMessage = "";
    var source = "";
    var position = 0;
    var sampledAt = 0;
    var generation = 0;
    var failure: any = null;
    var detailsOwner: any = null;
    var refreshInfo: (() => void) | undefined;
    function closeDetails(): void {
        var owner = detailsOwner;
        detailsOwner = null;
        var port = host.__ottClassicScreenPort;
        if (owner && port && port.owner("dialog") === owner)
            port.close("dialog");
    }
    function clearFailure(): void {
        failure = null;
        closeDetails();
    }
    function failureMessage(kind?: string, status?: number): string {
        if (status === 401 || status === 403 || kind === "auth")
            return host._("Source sign-in required");
        if (status === 404) return host._("Not found");
        if (status === 429) return host._("Source is busy. Try again later.");
        if (kind === "quality")
            return host._("No stream meets the quality limits");
        if (kind === "drm")
            return host._("This protected stream could not be played");
        if (kind === "decode" || kind === "parse")
            return host._("The stream format could not be played");
        if (kind === "network") return host._("The stream connection failed");
        return host._("Stream could not be played");
    }
    function captureFailure(message: string): any {
        var expected = generation,
            expectedSource = sourceKey(),
            playback = host.__ottClassicPlayback,
            state = playback && playback.snapshot(),
            context = playback && playback.context(),
            backend = host.__ottCoreBackendPeek && host.__ottCoreBackendPeek(),
            handle = backend && backend.current();
        function current(): boolean {
            if (
                expected !== generation ||
                expectedSource !== sourceKey() ||
                !active ||
                !expired
            )
                return false;
            if (!state || !context) return true;
            return (
                playback === host.__ottClassicPlayback &&
                state.generation === playback.snapshot().generation &&
                context.isCurrentBackend() &&
                (!handle ||
                    (host.__ottCoreBackendPeek() === backend &&
                        backend.current() === handle &&
                        handle.active()))
            );
        }
        function restartable(): boolean {
            var latest = playback && playback.snapshot(),
                target = latest && latest.target,
                original = state && state.target;
            if (
                !current() ||
                !target ||
                !original ||
                target.kind !== "live" ||
                target.sourceId !== original.sourceId ||
                target.channelId !== original.channelId ||
                latest.phase === "paused" ||
                !handle ||
                typeof handle.restart !== "function" ||
                !host.__ottCoreTransport ||
                host.stbPlay !== host.__ottCoreTransport.play ||
                host.forcePlay === false ||
                (host.__ottKiosk && host.__ottKiosk.enabled()) ||
                (host.__ottStandby && host.__ottStandby.blocked())
            )
                return false;
            // The playback identity is a string; the retained TV PIN list uses numbers.
            var channelId = Number(target.channelId);
            if (
                !isFinite(channelId) ||
                Math.floor(channelId) !== channelId ||
                Math.abs(channelId) > 9007199254740991 ||
                String(channelId) !== String(target.channelId)
            )
                return false;
            if (
                host.hasParentalLock &&
                host.hasParentalLock(channelId) &&
                (!host.__ottParental || host.__ottParental.needs("channels"))
            )
                return false;
            return current();
        }
        return {
            current: current,
            message: message,
            restart: function () {
                return restartable() ? handle.restart() : null;
            },
            restartable: restartable,
        };
    }
    function details(): boolean {
        var issue = failure,
            port = host.__ottClassicScreenPort,
            root = host.document.getElementById("dialogbox");
        if (
            !issue ||
            !issue.current() ||
            !port ||
            port.screens.current() ||
            !root ||
            !host.renderButtonHint ||
            !host.$ ||
            (host.__ottKiosk && host.__ottKiosk.enabled()) ||
            (host.__ottStandby && host.__ottStandby.blocked())
        )
            return false;
        var retry = issue.restartable(),
            message = host.document.createElement("div"),
            buttons = host.document.createElement("div");
        message.id = "dialogMessage";
        message.textContent = issue.message;
        buttons.innerHTML =
            (retry
                ? host.renderButtonHint(host.keys.ENTER, host.strENTER, "Retry")
                : "") +
            host.renderButtonHint(host.keys.RETURN, host.strRETURN, "Close");
        var handler = port.setOwnedCallback("dialog", function (code: number) {
            var event = port.keyEvent && port.keyEvent();
            if (event && event.repeat) return;
            if (
                code !== host.keys.ENTER &&
                code !== host.keys.RETURN &&
                code !== host.keys.EXIT
            )
                return;
            closeDetails();
            if (code === host.keys.ENTER && retry && failure === issue)
                issue.restart();
        });
        detailsOwner = handler.owner;
        if (!detailsOwner || !detailsOwner.foreground() || !issue.current()) {
            closeDetails();
            return false;
        }
        root.textContent = "";
        root.appendChild(message);
        root.appendChild(host.document.createElement("br"));
        root.appendChild(buttons);
        host.$(root).show();
        return true;
    }
    function sourceKey(): string {
        return media ? media.currentSrc || media.src : "";
    }
    function sample(): void {
        source = sourceKey();
        position = media ? media.currentTime : 0;
        sampledAt = Date.now();
    }
    function progressing(): boolean {
        if (!active || !media || preparing) return false;
        if (source !== sourceKey()) {
            confirmedProgress = false;
            cancelObservation();
            armed = true;
            sample();
            return false;
        }
        var next = media.currentTime;
        var elapsed = (Date.now() - sampledAt) / 1000;
        var delta = next - position;
        var rate = media.playbackRate || 1;
        var advanced =
            armed &&
            !media.seeking &&
            !media.paused &&
            !media.ended &&
            delta > 0 &&
            delta <= elapsed * rate + 2;
        sample();
        return advanced;
    }
    function observe(): void {
        if (progressing()) {
            confirmedProgress = true;
            if (timer || expired) {
                var held = !!observation;
                clear();
                expired = false;
                clearFailure();
                // No DOM was changed during the hold; keep healthy metadata intact.
                if (held) lastMessage = "";
                else render("");
            }
        }
    }
    function cancelObservation(): void {
        if (observation) clearTimeout(observation.timer!);
        observation = null;
    }
    function observeBuffering(): void {
        var pending = {
            generation: generation,
            media: media!,
            source: sourceKey(),
            timer: null as ReturnType<typeof setTimeout> | null,
        };
        observation = pending;
        // A single short presentation window, not a renewable stall deadline.
        pending.timer = setTimeout(function () {
            if (observation !== pending) return;
            if (
                pending.generation !== generation ||
                pending.media !== media ||
                pending.source !== sourceKey()
            ) {
                confirmedProgress = false;
                cancelObservation();
                return;
            }
            // Some devices move currentTime without delivering timeupdate here.
            observe();
            if (observation === pending) {
                cancelObservation();
                render(lastMessage);
            }
        }, 500);
    }
    function resetProgress(): void {
        confirmedProgress = false;
        var held = !!observation;
        cancelObservation();
        sample();
        // A seek cannot earn recovery or extend the existing failure deadline.
        if (held) render(lastMessage);
    }
    function clear(): void {
        cancelObservation();
        clearTimeout(timer!);
        timer = null;
    }
    function render(message: string): void {
        lastMessage = message;
        // Retain the existing metadata as well as the hidden spinner until qualified.
        if (observation) return;
        // The live watchdog owns presentation only; retain this controller's
        // original deadline and terminal state while its OSD is visible.
        if (recoveryOverlay) message = "";
        // Keep status inside the existing metadata column. Its normal footer
        // timeout owns visibility; media events must not reopen the footer.
        var spinner = document.getElementById("buffering");
        var label = document.getElementById("video_res");
        if (spinner)
            spinner.style.display = message && !expired ? "block" : "none";
        if (!label) return;
        if (!(label as any).__ottFailureBound) {
            (label as any).__ottFailureBound = true;
            function activate(event: any): void {
                if (
                    event.type === "keydown" &&
                    event.keyCode !== 13 &&
                    event.keyCode !== 32
                )
                    return;
                if (!event.repeat && details()) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            }
            label.addEventListener("click", activate, true);
            label.addEventListener("keydown", activate, true);
        }
        label.className = message ? "playback-feedback" : "";
        label.textContent = message && expired ? host._("ERROR!") : message;
        label.title = message;
        if (message && expired) {
            label.setAttribute("role", "button");
            label.setAttribute("tabindex", "0");
        } else {
            label.removeAttribute("role");
            label.removeAttribute("tabindex");
        }
        if (message) label.setAttribute("aria-label", message);
        else label.removeAttribute("aria-label");
        if (!message && refreshInfo) refreshInfo();
    }
    function fail(message?: string): void {
        clear();
        closeDetails();
        preparing = false;
        expired = true;
        failure = captureFailure(
            message || host._("Stream timed out. Select the channel to retry.")
        );
        render(failure.message);
    }
    function waiting(
        message: string,
        deadline: number,
        buffering = false
    ): void {
        if (!buffering) cancelObservation();
        if (!active) {
            render("");
            return;
        }
        if (expired) {
            render(failure ? failure.message : lastMessage);
            return;
        }
        // Source resolvers have their own bounded preparation deadline. Old
        // decoder events must neither time them out nor acknowledge playback.
        if (preparing) {
            render(host._("Connecting..."));
            return;
        }
        if (
            buffering &&
            confirmedProgress &&
            !timer &&
            !observation &&
            media &&
            source === sourceKey() &&
            !media.paused &&
            !media.seeking &&
            !media.ended
        )
            observeBuffering();
        render(message);
        // Repeated progress/waiting/retry events must not extend the deadline.
        if (!timer) {
            sample();
            timer = setTimeout(function () {
                observe();
                if (timer) fail();
            }, deadline);
        }
    }
    function begin(
        paused?: boolean,
        resuming?: boolean,
        timeout?: number,
        preparation = false
    ): void {
        clear();
        generation++;
        confirmedProgress = false;
        clearFailure();
        active = !paused;
        expired = false;
        preparing = preparation;
        // begin runs before the previous source is detached. Its remaining
        // frames cannot acknowledge the replacement source's startup.
        armed = !!resuming;
        if (active) waiting(host._("Connecting..."), timeout || 30000);
        else render("");
    }
    function stop(): void {
        begin(true);
    }
    host.__ottPlaybackFeedback = {
        begin: begin,
        bind: function (next: HTMLVideoElement, refresh?: () => void): void {
            if (media === next) return;
            confirmedProgress = false;
            cancelObservation();
            media = next;
            sample();
            refreshInfo = refresh;
            function on(name: string, action: () => void): void {
                next.addEventListener(name, function () {
                    if (media === next) action();
                });
            }
            on("loadstart", function () {
                confirmedProgress = false;
                armed = true;
                sample();
                waiting(host._("Connecting..."), 30000);
            });
            function buffering(): void {
                waiting(host._("Buffering..."), 45000, true);
            }
            on("waiting", buffering);
            on("stalled", buffering);
            on("timeupdate", observe);
            on("seeking", resetProgress);
            on("seeked", resetProgress);
            on("pause", function () {
                // Engine preparation also pauses media: only explicit pause intent
                // cancels feedback. A late preparation event cannot cancel startup.
                if (host.forcePlay === false) stop();
            });
            on("play", function () {
                if (!active && host.forcePlay !== false) begin(false, true);
            });
            on("ended", stop);
        },
        details: details,
        fail: function (kind?: string, status?: number): void {
            if (active) fail(failureMessage(kind, status));
        },
        inactive: function (): boolean {
            return !active;
        },
        ownsMedia: function (next: HTMLVideoElement): boolean {
            return media === next;
        },
        prepare: function (paused?: boolean): void {
            begin(paused, false, undefined, true);
        },
        retry: function (): void {
            waiting(host._("Retrying..."), 30000);
        },
        setRecoveryOverlay: function (visible: boolean): void {
            if (recoveryOverlay === visible) return;
            recoveryOverlay = visible;
            render(lastMessage);
        },
        stop: stop,
        visible: function (): boolean {
            return !!(timer || expired || (active && preparing));
        },
    };
})(window as any);
