export interface NotificationBannerHandle {
    animate: (available: number) => boolean;
    element: any;
    remove: (reason?: string) => void;
}

interface BannerOptions {
    hidden?: boolean;
    label?: string;
    local?: boolean;
    message?: string;
    seek?: boolean;
    severity?: string;
    title?: string;
}

/** One small display service shared by local feedback and remote notifications. */
export function createNotificationBanners(w: any): any {
    if (w.__ottNotificationBanners) return w.__ottNotificationBanners;
    var entries: any[] = [];

    function active(): boolean {
        try {
            return !!(
                w.document &&
                !w.document.hidden &&
                w.document.visibilityState !== "hidden" &&
                w.__ottScreenAwake !== false &&
                !(
                    w.__ottStandby &&
                    typeof w.__ottStandby.blocked === "function" &&
                    w.__ottStandby.blocked()
                ) &&
                !(typeof w.stbIsStandby === "function" && w.stbIsStandby())
            );
        } catch (_) {
            return false;
        }
    }

    function monotonic(): number | null {
        try {
            var value =
                w.performance && typeof w.performance.now === "function"
                    ? w.performance.now()
                    : null;
            return typeof value === "number" && isFinite(value) ? value : null;
        } catch (_) {
            return null;
        }
    }

    function clear(localOnly: boolean): void {
        entries.slice().forEach(function (entry) {
            if (!localOnly || entry.local) entry.handle.remove("stopped");
        });
    }

    function create(
        options: BannerOptions,
        lifetime: number,
        removed?: (reason: string) => void
    ): NotificationBannerHandle | null {
        var document = w.document;
        var container = document && document.getElementById("notifications");
        if (!container || !isFinite(lifetime) || lifetime <= 0) return null;
        if (options.local) clear(true);
        if (entries.length >= 3) {
            var victim = entries[0];
            if (options.local) {
                victim = null;
                for (var i = 0; i < entries.length; i++) {
                    if (entries[i].severity !== "critical") {
                        victim = entries[i];
                        break;
                    }
                }
            }
            if (!victim) return null;
            victim.handle.remove("capacity");
        }
        var severity =
            ["info", "warning", "critical"].indexOf(options.severity || "") < 0
                ? "info"
                : options.severity;
        var element = document.createElement("div");
        element.className = "notify remote-notify remote-notify-" + severity;
        if (options.local) element.classList.add("remote-notify-local");
        if (options.seek) element.classList.add("remote-notify-seek");
        var navigator = w.navigator || {};
        if (
            (navigator.deviceMemory > 0 && navigator.deviceMemory <= 2) ||
            (navigator.hardwareConcurrency > 0 &&
                navigator.hardwareConcurrency <= 2)
        )
            element.classList.add("remote-notify-lite");
        element.dir = "auto";
        element.style.top = Math.floor(Math.random() * 6) + "px";
        element.setAttribute("role", "status");

        function part(kind: string, value: string, parent: any): any {
            var child = document.createElement("div");
            child.className = "remote-notify-" + kind;
            child.dir = "auto";
            child.textContent = value;
            parent.appendChild(child);
            return child;
        }

        var heading: any = null,
            headingBody: any = null,
            message: any = null;
        if (options.hidden) element.style.display = "none";
        else {
            part("icon", "", element).setAttribute("aria-hidden", "true");
            var content = part("content", "", element);
            if (options.label || options.title) {
                heading = part("heading", "", content);
                headingBody = part("heading-body", "", heading);
                if (options.label) part("label", options.label, headingBody);
                if (options.title) part("title", options.title, headingBody);
            }
            message = part("message", options.message || "", content);
        }
        container.appendChild(element);
        var timer: any = null,
            exitTimer: any = null,
            closed = false;
        var createdAt = Date.now(),
            createdMonotonic = monotonic();

        function measureHeading(): void {
            if (!headingBody || closed) return;
            var height = Math.max(
                headingBody.scrollHeight,
                headingBody.getBoundingClientRect().height
            );
            if (height > 0) {
                // Clip a fixed, measured block. Animating line-clamped text's
                // max-height removes whole lines in steps on older WebKit.
                heading.style.height = height + "px";
                heading.classList.add("remote-notify-foldable");
            }
        }

        function elapsed(): number {
            var now = monotonic();
            return Math.max(
                0,
                Date.now() - createdAt,
                now !== null && createdMonotonic !== null
                    ? now - createdMonotonic
                    : 0
            );
        }
        function expire(after: number): void {
            w.clearTimeout(timer);
            timer = w.setTimeout(function () {
                handle.remove("expired");
            }, after);
        }
        var entry: any = {
            local: !!options.local,
            refresh: function (text: string, duration: number): void {
                if (closed) return;
                message.textContent = text;
                var age = elapsed();
                lifetime = age + duration;
                // Retain the card and its original entrance. Move only its fade
                // deadline forward when the same seek gesture is updated.
                if (element.classList.contains("remote-notify-out")) {
                    element.style.animationName = "none";
                    element.classList.remove("remote-notify-out");
                }
                element.style.setProperty(
                    "--ott-notify-fade-delay",
                    age + 980 + "ms"
                );
                expire(duration);
                handle.animate(duration);
            },
            seek: !!options.seek,
            severity: severity,
        };
        var handle: NotificationBannerHandle = {
            animate: function (available) {
                var left = Math.min(available, lifetime - elapsed());
                if (closed || left <= 0) {
                    handle.remove("expired");
                    return false;
                }
                var fadeDuration = Math.max(1, left - 980) + "ms";
                element.style.animationDuration = "480ms," + fadeDuration;
                measureHeading();
                element.classList.add("remote-notify-running");
                w.clearTimeout(exitTimer);
                exitTimer = w.setTimeout(
                    function () {
                        element.style.animationName = "";
                        element.style.animationDuration =
                            "320ms," + fadeDuration;
                        element.classList.add("remote-notify-out");
                    },
                    Math.max(0, left - 320)
                );
                return true;
            },
            element: element,
            remove: function (reason) {
                if (closed) return;
                closed = true;
                w.clearTimeout(timer);
                w.clearTimeout(exitTimer);
                w.removeEventListener("resize", measureHeading);
                if (element.parentNode) element.parentNode.removeChild(element);
                var index = entries.indexOf(entry);
                if (index !== -1) entries.splice(index, 1);
                if (removed) removed(reason || "hidden");
            },
        };
        entry.handle = handle;
        entries.push(entry);
        expire(lifetime);
        w.addEventListener("resize", measureHeading);
        return handle;
    }

    var api = {
        clearLocal: function () {
            clear(true);
        },
        create: create,
        showLocal: function (message: string, durationMs = 3000, seek = false) {
            if (!active() || typeof message !== "string" || !message)
                return null;
            if (seek && w.sShowSeekNotifications === 0) {
                entries.slice().forEach(function (entry) {
                    if (entry.seek) entry.handle.remove("disabled");
                });
                return null;
            }
            var lifetime =
                typeof durationMs === "number" &&
                isFinite(durationMs) &&
                durationMs > 0
                    ? Math.min(3600000, durationMs)
                    : 3000;
            if (seek)
                for (var i = 0; i < entries.length; i++)
                    if (entries[i].seek) {
                        entries[i].refresh(message, lifetime);
                        return entries[i].handle;
                    }
            var banner = create(
                { local: true, message: message, seek: seek },
                lifetime
            );
            if (banner) banner.animate(lifetime);
            return banner;
        },
        suspend: function () {
            clear(false);
        },
    };
    if (w.document && typeof w.document.addEventListener === "function")
        w.document.addEventListener("visibilitychange", function () {
            if (!active()) clear(false);
        });
    w.__ottNotificationBanners = api;
    return api;
}
