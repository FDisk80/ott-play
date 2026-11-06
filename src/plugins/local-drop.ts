import { createDroppedVideos } from "../offline/dropped-video";

/** Desktop file gestures use the same temporary Local playback as remote commands. */
export function installLocalDrop(w: any): any {
    if (w.__ottLocalDrop) return w.__ottLocalDrop;
    var disposed = false;
    var sequence = 0;
    var pending: any = null;
    var active: any = null;
    var unlisten: (() => void) | null = null;
    var subscribed = false;
    var readySent = false;
    var native = !!(w.__TAURI__ || w.__TAURI_INTERNALS__);

    function ready(): void {
        if (
            disposed ||
            !native ||
            !subscribed ||
            readySent ||
            !w.__ottDesktopOpenReady
        )
            return;
        readySent = true;
        invoke("local_media_drop_ready", {}).catch(function () {
            readySent = false;
        });
    }

    function allowed(): boolean {
        try {
            return (
                !disposed &&
                !!w.__ottLocalMedia?.playDroppedVideo &&
                !w.__ottStandby?.blocked?.() &&
                !w.__ottKiosk?.enabled?.() &&
                !w.__ottKiosk?.locked?.() &&
                !w.__ottParental?.needs?.("providers") &&
                !w.__ottParental?.needs?.("settings")
            );
        } catch (_) {
            return false;
        }
    }
    function message(text: string): void {
        if (!disposed && typeof w.showShift === "function") w.showShift(text);
    }
    function invoke(name: string, args: any): Promise<any> {
        var bridge = w.__TAURI__?.core || w.__TAURI__;
        try {
            if (!bridge?.invoke) throw new Error("Native playback unavailable");
            return Promise.resolve(bridge.invoke(name, args));
        } catch (error) {
            return Promise.reject(error);
        }
    }
    function release(lease: any): void {
        if (!lease || lease.released) return;
        lease.released = true;
        if (active === lease) active = null;
        try {
            lease.release();
        } catch (_) {}
    }
    function cancelPending(): void {
        sequence++;
        if (!pending) return;
        var old = pending;
        pending = null;
        w.clearTimeout(old.timer);
        release(old);
    }
    function play(lease: any): void {
        if (!allowed()) {
            release(lease);
            return;
        }
        var previous = active;
        active = lease;
        try {
            w.__ottLocalMedia.playDroppedVideo(
                lease.catalog,
                function () {
                    return active === lease && !lease.released && allowed();
                },
                function () {
                    release(lease);
                }
            );
        } catch (_) {
            release(lease);
            if (previous && !previous.released) active = previous;
            message(
                w._
                    ? w._("Local source unavailable")
                    : "Local source unavailable"
            );
        }
    }
    function hasFiles(event: any): boolean {
        var transfer = event.dataTransfer;
        if (!transfer) return false;
        if (transfer.files?.length) return true;
        var types = transfer.types || [];
        for (var i = 0; i < types.length; i++)
            if (types[i] === "Files") return true;
        return false;
    }
    function dragOver(event: any): void {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = allowed() ? "copy" : "none";
    }
    function drop(event: any): void {
        if (!hasFiles(event)) return;
        // Never let the browser navigate away to the dropped file.
        event.preventDefault();
        event.stopPropagation();
        if (native || !allowed()) return;
        var files = event.dataTransfer.files;
        var lease: any;
        try {
            // Capture every File synchronously while the gesture owns DataTransfer.
            lease = createDroppedVideos(w, files);
        } catch (_) {
            message(w._ ? w._("Unsupported source") : "Unsupported source");
            return;
        }
        cancelPending();
        play(lease);
    }
    function nativeDrop(event: any): void {
        var grant = event?.payload?.grant;
        if (typeof grant !== "string" || !/^[a-zA-Z0-9_-]{16,128}$/.test(grant))
            return;
        var lease: any = {
            release: function () {
                invoke("local_media_release_drop", { grant: grant }).catch(
                    function () {}
                );
            },
        };
        if (!allowed()) {
            release(lease);
            return;
        }
        cancelPending();
        var request = sequence;
        // Startup may mount its optional provider after ready() has delivered
        // the OS file. The command generation owns the intent, not that driver
        // instance; a real subsequent source selection replaces this token.
        var load = w.__ottCommandChannelLoad;
        pending = lease;
        lease.timer = w.setTimeout(function () {
            if (pending !== lease) return;
            cancelPending();
            message(
                w._
                    ? w._("Local source unavailable")
                    : "Local source unavailable"
            );
        }, 20000);
        invoke("local_media_take_drop", { grant: grant }).then(
            function (catalog) {
                if (
                    pending !== lease ||
                    request !== sequence ||
                    !allowed() ||
                    load !== w.__ottCommandChannelLoad
                ) {
                    if (pending === lease) {
                        pending = null;
                        w.clearTimeout(lease.timer);
                    }
                    release(lease);
                    return;
                }
                pending = null;
                w.clearTimeout(lease.timer);
                lease.catalog = catalog;
                play(lease);
            },
            function () {
                if (pending !== lease) return;
                pending = null;
                w.clearTimeout(lease.timer);
                release(lease);
                message(
                    w._
                        ? w._("Local source unavailable")
                        : "Local source unavailable"
                );
            }
        );
    }
    function dispose(): void {
        if (disposed) return;
        disposed = true;
        cancelPending();
        release(active);
        try {
            if (unlisten) unlisten();
        } catch (_) {}
        w.removeEventListener("dragover", dragOver, true);
        w.removeEventListener("drop", drop, true);
        w.removeEventListener("pagehide", pageHide);
        if (w.__ottLocalDrop === api) delete w.__ottLocalDrop;
    }
    function pageHide(event: any): void {
        dispose();
        if (event?.persisted) {
            var restore = function (): void {
                w.removeEventListener("pageshow", restore);
                installLocalDrop(w);
            };
            w.addEventListener("pageshow", restore);
        }
    }
    var api = { dispose: dispose, ready: ready };
    w.__ottLocalDrop = api;
    w.addEventListener("dragover", dragOver, true);
    w.addEventListener("drop", drop, true);
    w.addEventListener("pagehide", pageHide);
    if (native && w.__TAURI__?.event?.listen) {
        try {
            Promise.resolve(
                w.__TAURI__.event.listen("local-media-drop", nativeDrop)
            )
                .then(function (remove: () => void) {
                    if (disposed) remove();
                    else {
                        unlisten = remove;
                        subscribed = true;
                        ready();
                    }
                })
                .catch(function () {});
        } catch (_) {}
    }
    return api;
}

if (typeof window !== "undefined") installLocalDrop(window);
