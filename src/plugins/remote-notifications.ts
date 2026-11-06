import {
    createNotificationBanners,
    type NotificationBannerHandle,
} from "../ui/notification-banners";
import type {
    CommandServerRequest,
    CommandServerResponse,
} from "./command-server";
import {
    loadNotificationMedia,
    supportsNotificationMedia,
    validNotificationMedia,
} from "./notification-media";

var sessionSequence = 0;
interface NotificationBanner {
    diagnostic?: any;
    disposeMedia?: (() => void) | null;
    element: any;
    presentation: NotificationBannerHandle;
}

/** Optional, ephemeral banners. Failure must never interrupt remote control. */
export function createRemoteNotifications(
    w: any,
    send: (
        request: CommandServerRequest,
        complete: (response?: CommandServerResponse) => void
    ) => () => void
): any {
    var address = "";
    var token = "";
    var runtime = "";
    var receiveEnabled = true;
    var policyRevision = 0;
    var supportsEnabled = false;
    var supportsImages = false;
    var generation = 0;
    var activityEpoch = 0;
    var lastActive = false;
    var cancel: (() => void) | null = null;
    var pending = false;
    var nextPoll = 0;
    var seen: Record<string, boolean> = Object.create(null);
    var order: string[] = [];
    var banners: NotificationBanner[] = [];
    var mediaOwner: NotificationBanner | null = null;
    var renderer = createNotificationBanners(w);

    function diagnostic(media: any): any {
        try {
            return (
                w.__ottPerfSink &&
                w.__ottPerfSink.notification(media, function () {
                    return banners.length;
                })
            );
        } catch (_) {
            return null;
        }
    }
    function stage(trace: any, name: string, reason?: string): void {
        try {
            if (trace) trace.stage(name, reason);
        } catch (_) {}
    }
    function phase(trace: any, name: string, finished: boolean): void {
        try {
            if (trace) trace.phase(name, finished);
        } catch (_) {}
    }
    function clearMedia(banner: NotificationBanner): void {
        var dispose = banner.disposeMedia;
        banner.disposeMedia = null;
        if (mediaOwner === banner) mediaOwner = null;
        if (dispose) dispose();
    }
    function clearBanner(banner: NotificationBanner, reason = "hidden"): void {
        banner.presentation.remove(reason);
    }
    function clear(): void {
        banners.slice().forEach(function (banner) {
            clearBanner(banner, "stopped");
        });
    }
    function newSession(): void {
        // Not a secret: bind ephemeral server queues to this active viewing session.
        runtime =
            "n" +
            Date.now().toString(36) +
            "_" +
            ++sessionSequence +
            "_" +
            Math.random().toString(36).slice(2) +
            Math.random().toString(36).slice(2);
        seen = Object.create(null);
        order = [];
    }
    function suspend(): void {
        activityEpoch++;
        lastActive = false;
        // A quick sleep/wake can happen between heartbeats. Retire the server's
        // previous queue too, including events enqueued during that gap.
        newSession();
        clear();
    }
    function isActive(): boolean {
        try {
            var document = w.document;
            return !!(
                receiveEnabled &&
                document &&
                document.hidden !== true &&
                document.visibilityState !== "hidden" &&
                !(
                    document.body && document.body.classList.contains("booting")
                ) &&
                w.__ottScreenAwake !== false &&
                !(w.__ottStandby && w.__ottStandby.blocked()) &&
                !(typeof w.stbIsStandby === "function" && w.stbIsStandby())
            );
        } catch (_error) {
            return false;
        }
    }
    function stop(): void {
        generation++;
        var abort = cancel;
        cancel = null;
        pending = false;
        nextPoll = 0;
        clear();
        if (abort) {
            try {
                abort();
            } catch (_error) {}
        }
    }
    function setEnabled(next: boolean): void {
        if (typeof next !== "boolean") return;
        policyRevision++;
        if (next === receiveEnabled) return;
        receiveEnabled = next;
        activityEpoch++;
        lastActive = false;
        // Invalidate callbacks before cancellation can synchronously complete.
        stop();
        newSession();
    }
    function configure(nextAddress: string, nextToken: string): void {
        policyRevision++;
        if (nextAddress !== address || nextToken !== token) {
            supportsEnabled = false;
            supportsImages = false;
        }
        stop();
        newSession();
        lastActive = false;
        address = nextAddress;
        token = nextToken;
    }
    function integer(value: any, min: number, max: number): boolean {
        return (
            typeof value === "number" &&
            isFinite(value) &&
            Math.floor(value) === value &&
            value >= min &&
            value <= max
        );
    }
    function timestamp(value: any): boolean {
        return typeof value === "number" && isFinite(value) && value > 0;
    }
    function monotonic(): number | null {
        try {
            var value = w.performance && w.performance.now();
            return typeof value === "number" && isFinite(value) ? value : null;
        } catch (_error) {
            return null;
        }
    }
    function valid(item: any): boolean {
        return !!(
            item &&
            typeof item.id === "string" &&
            /^[a-f0-9]{32}$/.test(item.id) &&
            item.runtime === runtime &&
            typeof item.title === "string" &&
            item.title.length <= 128 &&
            typeof item.message === "string" &&
            item.message.length > 0 &&
            item.message.length <= 512 &&
            ["info", "warning", "critical"].indexOf(item.severity) !== -1 &&
            integer(item.duration_ms, 1000, 15000) &&
            timestamp(item.expires_at)
        );
    }
    function remember(id: string): void {
        seen[id] = true;
        order.push(id);
        while (order.length > 64) delete seen[order.shift()!];
    }
    function attachImage(
        banner: NotificationBanner,
        item: any,
        remaining: number,
        animate: (available: number) => boolean
    ): void {
        if (
            !supportsImages ||
            !validNotificationMedia(item.media) ||
            !supportsNotificationMedia(w) ||
            !receiveEnabled ||
            !isActive()
        ) {
            clearBanner(banner);
            return;
        }
        if (mediaOwner) clearBanner(mediaOwner, "superseded");
        mediaOwner = banner;
        var current = generation,
            activity = activityEpoch;
        var image = w.document.createElement("img");
        image.className = "remote-notify-image";
        image.alt = "";
        image.draggable = false;
        image.setAttribute("aria-hidden", "true");
        var disposed = false,
            abort: (() => void) | null = null;
        var result: any = null,
            expiry: any = null,
            receivedAt = 0,
            receivedMonotonic: number | null = null;
        function mediaRemaining(): number {
            var now = monotonic();
            var elapsed = Math.max(
                0,
                Date.now() - receivedAt,
                now !== null && receivedMonotonic !== null
                    ? now - receivedMonotonic
                    : 0
            );
            return result ? result.remainingMs - elapsed : remaining;
        }
        function valid(): boolean {
            return (
                mediaRemaining() > 0 &&
                !disposed &&
                current === generation &&
                activity === activityEpoch &&
                mediaOwner === banner &&
                receiveEnabled &&
                isActive() &&
                !!banner.element.parentNode
            );
        }
        function resize(): void {
            var font =
                parseFloat(w.getComputedStyle(banner.element).fontSize) || 14;
            banner.element.style.width =
                Math.min(
                    24 * font,
                    w.innerWidth - 24,
                    w.innerHeight * 0.4 * (result.width / result.height)
                ) + "px";
            stage(banner.diagnostic, "updated");
        }
        banner.disposeMedia = function () {
            if (disposed) return;
            disposed = true;
            w.clearTimeout(expiry);
            w.removeEventListener("resize", resize);
            if (abort) abort();
            image.onload = image.onerror = null;
            image.removeAttribute("src");
            if (image.parentNode) image.parentNode.removeChild(image);
            banner.element.classList.remove("remote-notify-with-image");
            if (result) result.dispose();
        };
        abort = loadNotificationMedia(
            w,
            {
                address: address,
                media: item.media,
                phase: banner.diagnostic
                    ? function (name, finished) {
                          phase(banner.diagnostic, name, finished);
                      }
                    : undefined,
                remainingMs: remaining,
                runtime: runtime,
                token: token,
            },
            function (loaded) {
                if (!loaded) {
                    stage(banner.diagnostic, "dropped", "media_error");
                    clearBanner(banner);
                    return;
                }
                if (!valid()) {
                    loaded.dispose();
                    return;
                }
                result = loaded;
                receivedAt = Date.now();
                receivedMonotonic = monotonic();
                expiry = w.setTimeout(function () {
                    clearBanner(banner, "expired");
                }, loaded.remainingMs);
                image.onload = function () {
                    phase(banner.diagnostic, "image_load_decode", true);
                    if (
                        !valid() ||
                        image.naturalWidth !== loaded.width ||
                        image.naturalHeight !== loaded.height
                    ) {
                        clearBanner(banner);
                        return;
                    }
                    stage(banner.diagnostic, "image_loaded");
                    if (!animate(mediaRemaining())) return;
                    banner.element.insertBefore(
                        image,
                        banner.element.lastChild
                    );
                    banner.element.classList.add("remote-notify-with-image");
                    banner.element.style.display = "block";
                    stage(banner.diagnostic, "shown");
                    resize();
                    w.addEventListener("resize", resize);
                };
                image.onerror = function () {
                    stage(banner.diagnostic, "dropped", "media_error");
                    clearBanner(banner);
                };
                phase(banner.diagnostic, "image_load_decode", false);
                image.src = loaded.url;
            }
        );
        if (disposed && abort) abort();
    }
    function show(item: any, remaining: number, trace: any): void {
        // Recheck at delivery: a screen can sleep while the request is in flight.
        if (!isActive()) {
            stage(trace, "dropped", "hidden");
            return;
        }
        var lifetime = Math.min(item.duration_ms, remaining);
        var media = validNotificationMedia(item.media);
        var banner: NotificationBanner;
        var presentation = renderer.create(
            {
                hidden: media,
                label: {
                    critical: "Alert",
                    info: "Home update",
                    warning: "Attention",
                }[item.severity as "info" | "warning" | "critical"],
                message: item.message,
                severity: item.severity,
                title: item.title,
            },
            lifetime,
            function (reason: string) {
                clearMedia(banner);
                var index = banners.indexOf(banner);
                if (index !== -1) banners.splice(index, 1);
                stage(trace, "hidden", reason);
            }
        );
        if (!presentation) {
            stage(trace, "dropped", "unsupported");
            return;
        }
        banner = {
            diagnostic: trace,
            element: presentation.element,
            presentation: presentation,
        };
        banners.push(banner);
        stage(trace, "dom_created");
        if (media) attachImage(banner, item, lifetime, presentation.animate);
        else {
            presentation.animate(lifetime);
            stage(trace, "shown");
        }
    }
    function poll(): void {
        var active = isActive();
        if (!active && lastActive) suspend();
        lastActive = active;
        if (!active) clear();
        if (
            !w.document ||
            !address ||
            !token ||
            pending ||
            Date.now() < nextPoll
        )
            return;
        var started = Date.now();
        var startedMonotonic = monotonic();
        var current = generation;
        var currentActivity = activityEpoch;
        var queryIndex = address.indexOf("?");
        var base = queryIndex < 0 ? address : address.slice(0, queryIndex);
        var query = queryIndex < 0 ? "?" : address.slice(queryIndex) + "&";
        var url =
            base.replace(/\/api\/webhook\/commands$/, "/api/notifications") +
            query +
            "runtime=" +
            encodeURIComponent(runtime) +
            "&active=" +
            String(active) +
            (supportsEnabled ? "&enabled=" + String(receiveEnabled) : "") +
            (supportsImages && supportsNotificationMedia(w)
                ? "&media=jpeg-v1"
                : "");
        var finished = false;
        pending = true;
        nextPoll = started + 5000;
        function complete(response?: CommandServerResponse): void {
            if (finished || current !== generation) return;
            finished = true;
            pending = false;
            cancel = null;
            // An older controller after a rollback must get a legacy retry.
            nextPoll = Date.now() + 60000;
            if (
                response &&
                (response.status === 400 || response.status === 404) &&
                (supportsEnabled || supportsImages)
            ) {
                supportsEnabled = supportsImages = false;
                nextPoll = Date.now() + 5000;
            }
            if (
                !response ||
                response.status !== 200 ||
                typeof response.body !== "string" ||
                response.body.length > 32768
            )
                return;
            try {
                var data = JSON.parse(response.body);
                if (
                    !data ||
                    data.version !== 1 ||
                    !timestamp(data.server_time) ||
                    !integer(data.poll_after_ms, 5000, 60000) ||
                    !Array.isArray(data.notifications) ||
                    data.notifications.length > 4
                )
                    return;
                nextPoll = Date.now() + data.poll_after_ms;
                supportsEnabled = !!(
                    data.capabilities && data.capabilities.enabled === true
                );
                supportsImages = !!(
                    data.capabilities &&
                    Array.isArray(data.capabilities.media) &&
                    data.capabilities.media.indexOf("jpeg-v1") !== -1
                );
                data.notifications.forEach(function (item: any) {
                    var trace = diagnostic(
                        item && validNotificationMedia(item.media)
                            ? item.media
                            : null
                    );
                    stage(trace, "received");
                    if (!receiveEnabled || !valid(item) || seen[item.id]) {
                        stage(
                            trace,
                            "dropped",
                            !receiveEnabled
                                ? "disabled"
                                : !valid(item)
                                  ? "invalid"
                                  : "duplicate"
                        );
                        return;
                    }
                    // Mark dropped/expired items too; waking must not replay a stale event.
                    remember(item.id);
                    var currentMonotonic = monotonic();
                    var elapsed = Math.max(
                        0,
                        Date.now() - started,
                        startedMonotonic !== null && currentMonotonic !== null
                            ? currentMonotonic - startedMonotonic
                            : 0
                    );
                    // Wire timestamps are seconds; local deadlines use milliseconds.
                    var remaining =
                        (item.expires_at - data.server_time) * 1000 - elapsed;
                    if (
                        active &&
                        currentActivity === activityEpoch &&
                        remaining > 0
                    )
                        show(item, remaining, trace);
                    else
                        stage(
                            trace,
                            "dropped",
                            remaining <= 0 ? "expired" : "hidden"
                        );
                });
            } catch (_error) {}
        }
        try {
            var abort = send(
                {
                    headers: { Authorization: "Bearer " + token },
                    method: "GET",
                    timeoutMs: 8000,
                    url: url,
                },
                complete
            );
            if (!finished && current === generation) cancel = abort;
        } catch (_error) {
            complete();
        }
    }
    if (w.document && typeof w.document.addEventListener === "function")
        w.document.addEventListener("visibilitychange", function () {
            if (!isActive()) suspend();
        });
    var api = {
        configure: configure,
        enabled: function () {
            return receiveEnabled;
        },
        policyRevision: function () {
            return policyRevision;
        },
        poll: poll,
        setEnabled: setEnabled,
        stop: stop,
        suspend: suspend,
    };
    w.__ottRemoteNotifications = api;
    return api;
}
