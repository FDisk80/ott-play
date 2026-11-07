const { performance } = require("node:perf_hooks");

// Observe a stalled browser from the host. Never ask the page for diagnostics
// after failure: the same browser process may no longer answer protocol calls.
module.exports = async function observeAspectReadiness(
    page,
    labels,
    operation
) {
    const started = performance.now();
    let crashed = false;
    let reported = false;
    const onCrash = () => {
        crashed = true;
    };
    const transition = [];
    const observeTransition = labels.phase === "open-channels";
    const onConsole = (message) => {
        try {
            if (transition.length >= 8) return;
            const text = message.text();
            const prefix = "Plex channel transition: ";
            if (
                typeof text !== "string" ||
                text.length > 1024 ||
                !text.startsWith(prefix) ||
                Buffer.byteLength(text, "utf8") > 1024
            )
                return;
            const value = JSON.parse(text.slice(prefix.length));
            const step = value?.step;
            if (
                !Number.isInteger(step) ||
                step < 0 ||
                step > 7 ||
                (transition.length && step <= transition.at(-1).step)
            )
                return;
            let media = null;
            const input = value.media;
            if (input && typeof input === "object" && !Array.isArray(input)) {
                const integer = (value, max) =>
                    Number.isInteger(value) && value >= 0 && value <= max
                        ? value
                        : null;
                const seconds = (value) =>
                    Number.isFinite(value) && Math.abs(value) <= 1e9
                        ? Math.round(value * 1000) / 1000
                        : null;
                const boolean = (value) =>
                    typeof value === "boolean" ? value : null;
                media = {
                    bufferedRangeCount: integer(
                        input.bufferedRangeCount,
                        100000
                    ),
                    currentTime: seconds(input.currentTime),
                    duration: seconds(input.duration),
                    ended: boolean(input.ended),
                    errorCode: integer(input.errorCode, 4),
                    lastBufferEnd: seconds(input.lastBufferEnd),
                    networkState: integer(input.networkState, 3),
                    paused: boolean(input.paused),
                    readyState: integer(input.readyState, 4),
                    sourcePresent: boolean(input.sourcePresent),
                };
            }
            transition.push({ media, step });
        } catch (_) {
            // Ignore malformed or inaccessible console data, including raw errors.
        }
    };
    const report = (event) => {
        // A pending snapshot must not hide later successful transition events.
        if (reported && event !== "resolved") return;
        reported = true;
        try {
            const browser = page.context().browser();
            console.error(
                "Aspect readiness host state: " +
                    JSON.stringify({
                        browserConnected: browser
                            ? browser.isConnected()
                            : null,
                        crashed,
                        elapsedMs: Math.round(performance.now() - started),
                        engine: [
                            "html5",
                            "hls.js",
                            "shaka",
                            "video.js",
                        ].includes(labels.engine)
                            ? labels.engine
                            : "unknown",
                        event,
                        pageClosed: page.isClosed(),
                        phase: [
                            "initial",
                            "replay",
                            "next",
                            "reload",
                            "open-channels",
                        ].includes(labels.phase)
                            ? labels.phase
                            : "unknown",
                        ...(observeTransition ? { transition } : {}),
                    })
            );
        } catch (_) {
            // Diagnostic failures must not alter the operation's result.
        }
    };
    try {
        page.on("crash", onCrash);
    } catch (_) {}
    if (observeTransition)
        try {
            page.on("console", onConsole);
        } catch (_) {}
    const timer = setTimeout(() => report("pending"), 15000);
    timer.unref();
    try {
        const result = await operation();
        // Retain the existing scalar observations after the evaluate returns.
        if (observeTransition && labels.engine === "video.js")
            report("resolved");
        return result;
    } catch (error) {
        report("rejected");
        throw error;
    } finally {
        clearTimeout(timer);
        try {
            page.off("crash", onCrash);
        } catch (_) {}
        if (observeTransition)
            try {
                page.off("console", onConsole);
            } catch (_) {}
    }
};
