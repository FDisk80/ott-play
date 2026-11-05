/**
 * Watch a native HLS attempt without changing working video playback.
 * WKWebView can accept HEVC in MPEG-TS as audio-only without raising an error.
 * A single prefetched HLS fragment distinguishes that case from actual radio.
 * Tauri also recovers sustained native frame loss without fetching a probe.
 */
export function watchAutoNativePlayback(
    media: HTMLVideoElement,
    url: string,
    HlsRef: any,
    options: {
        loadHls?: (ready: (hls: any) => void) => void;
        active: () => boolean;
        fallback: () => void;
        monitorDroppedFrames?: boolean;
        monitorInitialStall?: boolean;
        /** Pause command revision; null permanently excludes an explicit seek. */
        recoveryRevision?: () => number | null;
        restore: () => void;
    }
): ((restoreNative?: boolean) => void) & { pending: () => boolean } {
    var disposed = false;
    var decided = false;
    var probing = false;
    var loadingHls = false;
    var probe: any = null;
    // Browser timer IDs are positive; zero denotes no pending timer.
    var checkTimer: ReturnType<typeof setTimeout> | 0 = 0;
    var probeTimer: ReturnType<typeof setTimeout> | 0 = 0;
    var actionTimer: ReturnType<typeof setTimeout> | 0 = 0;
    var cancelFrameWatch: (() => void) | null = null;
    var detectDrops = !!options.monitorDroppedFrames;
    // 0: disabled; 1: observing initial playback; 2: finished, retaining source ownership.
    var initialState: 0 | 1 | 2 = options.monitorInitialStall ? 1 : 0;
    var initialPosition: number | null = null;
    var initialSource = media.src;
    var events = [
        "playing",
        "timeupdate",
        "loadedmetadata",
        "loadeddata",
        "resize",
    ];

    /** Keep listener identity and ordering identical for registration and retirement. */
    function setEventListeners(
        target: EventTarget,
        events: string[],
        handler: () => void,
        enabled: boolean
    ): void {
        var method: "addEventListener" | "removeEventListener" = enabled
            ? "addEventListener"
            : "removeEventListener";
        for (var i = 0; i < events.length; i++)
            target[method](events[i], handler);
    }

    function listen(enabled: boolean): void {
        setEventListeners(media, events, inspect, enabled);
        setEventListeners(media, ["error"], onNativeError, enabled);
    }

    function clearWaits(): void {
        clearTimeout(checkTimer);
        clearTimeout(probeTimer);
        checkTimer = probeTimer = 0;
    }

    function stopProbe(): void {
        var previous = probe;
        probe = null;
        probing = false;
        if (previous) {
            try {
                previous.destroy();
            } catch (_destroyError) {}
        }
    }

    function stopFrameWatch(): void {
        if (cancelFrameWatch) cancelFrameWatch();
        cancelFrameWatch = null;
    }

    function cancel(restoreNative?: boolean): void {
        if (disposed) return;
        // Changing engine preference can cancel a probe without replacing the
        // current stream. Renew that native session even when a probe result
        // was already queued; stop/channel-switch cancellation never renews it.
        var renewNative = restoreNative === true && probing && options.active();
        disposed = true;
        stopFrameWatch();
        listen(false);
        clearWaits();
        clearTimeout(actionTimer);
        actionTimer = 0;
        stopProbe();
        if (renewNative) options.restore();
    }

    function active(): boolean {
        return (
            !disposed &&
            options.active() &&
            (!initialState || media.src === initialSource)
        );
    }

    function current(): boolean {
        if (active()) return true;
        if (disposed) return false;
        // A stale HLS event can arrive before its caller disposes the watcher.
        // Its controller must finish emitting before we destroy that probe.
        if (!actionTimer) {
            actionTimer = setTimeout(function () {
                actionTimer = 0;
                cancel();
            }, 0);
        }
        return false;
    }

    function finish(useFallback: boolean, initialGuard?: () => boolean): void {
        if (!current() || decided) return;
        decided = true;
        listen(false);
        clearWaits();
        // The transmuxer still uses its controllers after emitting track data.
        // Destroying it or replacing playback inside that event is reentrant.
        actionTimer = setTimeout(function () {
            actionTimer = 0;
            // Test source ownership independently of the timing guard, which
            // can already have been reset by an event on the replacement.
            if (!active()) {
                cancel();
                return;
            }
            if (initialGuard && !initialGuard()) {
                // Pause, new frames or a changed source may arrive between the
                // last sample and this deferred action. Do not reload playback.
                decided = false;
                listen(true);
                startFrameWatch();
                onNativeError();
                inspect();
                return;
            }
            // Native video may finish loading during the probe or just after
            // its track event. Keep that now-working engine; renewing src is
            // still necessary for proxies that replaced their session.
            var restoredVideo =
                probing &&
                !media.error &&
                ((media as any).videoTracks
                    ? (media as any).videoTracks.length > 0
                    : media.videoWidth > 0);
            if (restoredVideo) useFallback = false;
            if (!useFallback && (detectDrops || restoredVideo)) {
                // A late video track only resolves the audio-only probe. It
                // does not prove that the native decoder displays its frames.
                // Retire the previous observation before restoring the native source.
                if (initialState === 1) initialState = 2;
                stopProbe();
                stopFrameWatch();
            } else cancel();
            if (useFallback) options.fallback();
            else {
                options.restore();
                // The restored source must prove its own progress. A real radio
                // or unknown probe outcome does not enable another initial wait.
                if (restoredVideo) {
                    initialState = 1;
                    initialPosition = null;
                }
                if (current()) startFrameWatch();
            }
        }, 0);
    }

    function audioWithoutVideo(): boolean {
        var tracks = media as any;
        // WKWebView may report nonzero dimensions while it has decoded only
        // audio. An available videoTracks list is stronger
        // evidence than those dimensions; no track API means no speculation.
        return (
            !media.paused &&
            media.readyState >= 2 &&
            !!tracks.audioTracks &&
            tracks.audioTracks.length > 0 &&
            !!tracks.videoTracks &&
            tracks.videoTracks.length === 0
        );
    }

    function startProbe(): void {
        if (!current() || decided || probing || !audioWithoutVideo()) return;
        if (!HlsRef && options.loadHls && !loadingHls) {
            loadingHls = true;
            options.loadHls(function (loaded) {
                if (!current()) return;
                HlsRef = loaded;
                // Only one attempt per watcher; a new playback may retry download.
                if (HlsRef) startProbe();
            });
            return;
        }
        if (!HlsRef || !HlsRef.isSupported || !HlsRef.isSupported()) return;
        probing = true;
        // Local HLS proxies may replace their playback session on every master
        // request. Always renew native src on an unknown result, radio, error or
        // timeout; leaving its old src would break radio. Keep native playing
        // while probing so play/pause controls still represent the user's intent.
        try {
            probe = new HlsRef({
                backBufferLength: 0,
                enableWorker: true,
                lowLatencyMode: false,
                maxBufferLength: 1,
                maxMaxBufferLength: 1,
                startFragPrefetch: true,
                startLevel: 0,
                testBandwidth: false,
            });
            probe.on(
                HlsRef.Events.FRAG_PARSING_INIT_SEGMENT,
                function (_event: any, data: any): void {
                    if (!current() || decided || !data || data.id !== "main")
                        return;
                    var tracks = data.tracks || {};
                    var track = tracks.video || tracks.audiovideo;
                    var metadata = track && track.metadata;
                    var hasVideo = !!(
                        track &&
                        (/(?:hvc1|hev1)(?:\.|$)/i.test(track.codec || "") ||
                            (metadata &&
                                metadata.width > 0 &&
                                metadata.height > 0))
                    );
                    // Real audio-only channels keep the native engine. A
                    // missing/unknown video track is not evidence of HEVC.
                    finish(hasVideo);
                }
            );
            probe.on(HlsRef.Events.ERROR, function (): void {
                finish(false);
            });
            probeTimer = setTimeout(function () {
                finish(false);
            }, 8000);
            // startFragPrefetch transmuxes the first fragment without attaching
            // any media element or opening another audible/visible decoder.
            probe.loadSource(url);
        } catch (_probeError) {
            finish(false);
        }
    }

    function inspect(): void {
        if (!current() || decided || probing) return;
        if (!audioWithoutVideo()) {
            clearTimeout(checkTimer);
            checkTimer = 0;
            return;
        }
        if (!!checkTimer) return;
        checkTimer = setTimeout(function () {
            checkTimer = 0;
            startProbe();
        }, 1500);
    }

    function onNativeError(): void {
        if (!current() || decided || probing) return;
        var error = media.error;
        // Network errors and stalled playback do not prove codec mismatch.
        if (error && (error.code === 3 || error.code === 4)) finish(true);
    }

    function canObserve(): boolean {
        return current() && !probing && !actionTimer;
    }

    function startFrameWatch(): void {
        stopFrameWatch();
        if (detectDrops || initialState === 1)
            cancelFrameWatch = watchNativeFrameDrops(function (
                guard?: () => boolean
            ): void {
                if (!canObserve()) return;
                decided = false;
                finish(true, guard);
            });
    }

    listen(true);
    startFrameWatch();
    // PiP can load the HLS library after native playback has already emitted
    // metadata or failed. Inspect that state as well as subsequent events.
    onNativeError();
    inspect();
    var watcher = cancel as typeof cancel & { pending: () => boolean };
    watcher.pending = function (): boolean {
        return !disposed && (probing || !!actionTimer);
    };
    return watcher;

    /** One sampler for bounded initial startup and the established frame-drop policy. */
    function watchNativeFrameDrops(
        failed: (guard?: () => boolean) => void
    ): () => void {
        var recoveryRevision = options.recoveryRevision;
        var target = media as any;
        if (
            !initialState &&
            typeof target.getVideoPlaybackQuality !== "function" &&
            typeof target.webkitDecodedFrameCount !== "number"
        )
            return function (): void {};
        var doc = media.ownerDocument || document;
        var disposed = false;
        var timer: ReturnType<typeof setTimeout> | 0 = 0;
        var lastSample = 0;
        var revision = recoveryRevision ? recoveryRevision() : 0;
        var now = 0,
            position = 0,
            total = 0,
            dropped = 0;
        var baselineTime: number | null = null;
        var baselinePosition = 0,
            baselineTotal = 0,
            baselineDropped = 0;
        // -1 is the warmup window; nonnegative values count consecutive bad windows.
        var badWindows = -1;
        var resetEvents = [
            "pause",
            "seeking",
            "waiting",
            "emptied",
            "ratechange",
        ];

        function resetInitial(): void {
            if (initialState === 1) reset();
        }
        function reset(): void {
            baselineTime = null;
            badWindows = -1;
        }
        function cancel(): void {
            disposed = true;
            clearTimeout(timer);
            listen(false);
        }
        function listen(enabled: boolean): void {
            setEventListeners(media, resetEvents, reset, enabled);
            if (initialState)
                setEventListeners(
                    media,
                    ["play", "seeked"],
                    resetInitial,
                    enabled
                );
            setEventListeners(doc, ["visibilitychange"], reset, enabled);
        }

        function markBaseline(): void {
            baselineTime = now;
            baselinePosition = position;
            baselineTotal = total;
            baselineDropped = dropped;
        }

        function validCounter(value: any): boolean {
            return typeof value === "number" && isFinite(value) && value >= 0;
        }

        function readSample(): boolean {
            position = media.currentTime;
            var quality =
                typeof target.getVideoPlaybackQuality === "function"
                    ? target.getVideoPlaybackQuality()
                    : null;
            total = quality
                ? quality.totalVideoFrames
                : target.webkitDecodedFrameCount;
            var knownTotal = validCounter(total);
            if (initialState === 1) {
                var nextRevision = recoveryRevision ? recoveryRevision() : 0;
                if (nextRevision !== revision) {
                    revision = nextRevision;
                    reset();
                }
                if (
                    nextRevision === null ||
                    (knownTotal && total > 0) ||
                    (initialPosition !== null && position !== initialPosition)
                ) {
                    initialState = 2;
                    reset();
                    if (!detectDrops) cancel();
                }
            }
            if (
                media.paused ||
                media.seeking ||
                media.ended ||
                media.error ||
                media.readyState < 2 ||
                media.playbackRate !== 1 ||
                !media.videoWidth ||
                !media.videoHeight ||
                (target.videoTracks && !target.videoTracks.length) ||
                doc.visibilityState !== "visible" ||
                !isFinite(position) ||
                !knownTotal
            )
                return false;
            var buffered = media.buffered;
            for (var i = 0; i < buffered.length; i++)
                if (
                    buffered.start(i) <= position &&
                    buffered.end(i) - position >= 2
                ) {
                    dropped = quality
                        ? quality.droppedVideoFrames
                        : target.webkitDroppedFrameCount;
                    now = Date.now();
                    return true;
                }
            return false;
        }

        function initialReady(): boolean {
            try {
                if (disposed || !canObserve()) return false;
                return !!(
                    readSample() &&
                    initialState === 1 &&
                    baselineTime !== null &&
                    now - lastSample <= 2000 &&
                    now - baselineTime >= 30000
                );
            } catch (_sampleError) {
                return false;
            }
        }

        function check(): void {
            if (disposed) return;
            timer = setTimeout(check, 1000);
            try {
                if (!canObserve() || !readSample()) {
                    reset();
                    return;
                }
                if (initialState === 1) {
                    if (initialPosition === null) initialPosition = position;
                    // The same sample window is used for initial waiting and, after
                    // progress, normal frame-loss measurement. Never count a timer gap.
                    if (
                        baselineTime === null ||
                        now <= lastSample ||
                        now - lastSample > 2000
                    )
                        markBaseline();
                    lastSample = now;
                    if (now - baselineTime! >= 30000) {
                        clearTimeout(timer);
                        failed(initialReady);
                    }
                    return;
                }
                if (
                    !detectDrops ||
                    media.readyState < 3 ||
                    !validCounter(dropped) ||
                    total < dropped
                ) {
                    reset();
                    return;
                }
                if (baselineTime === null) {
                    markBaseline();
                    return;
                }
                var elapsed = (now - baselineTime!) / 1000;
                var played = position - baselinePosition;
                var decoded = total - baselineTotal;
                var lost = dropped - baselineDropped;
                // Preserve the existing frame-drop warmup and reset conditions.
                if (
                    elapsed <= 0 ||
                    elapsed > 6 ||
                    decoded < 0 ||
                    lost < 0 ||
                    lost > decoded ||
                    played < elapsed * 0.75 ||
                    played > elapsed * 1.25
                ) {
                    reset();
                    return;
                }
                if (elapsed < 4) return;
                markBaseline();
                if (badWindows < 0) {
                    badWindows = 0;
                    return;
                }
                badWindows =
                    decoded >= played * 10 &&
                    lost >= decoded * 0.8 &&
                    decoded - lost <= played * 3
                        ? badWindows + 1
                        : 0;
                if (badWindows >= 2) {
                    cancel();
                    failed();
                }
            } catch (_qualityError) {
                reset();
            }
        }
        listen(true);
        timer = setTimeout(check, 1000);
        return cancel;
    }
}
