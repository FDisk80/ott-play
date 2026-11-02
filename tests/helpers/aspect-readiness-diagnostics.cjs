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
    const report = (event) => {
        if (reported) return;
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
                        phase: ["initial", "replay", "next", "reload"].includes(
                            labels.phase
                        )
                            ? labels.phase
                            : "unknown",
                    })
            );
        } catch (_) {
            // Diagnostic failures must not alter the operation's result.
        }
    };
    page.on("crash", onCrash);
    const timer = setTimeout(() => report("pending"), 15000);
    timer.unref();
    try {
        return await operation();
    } catch (error) {
        report("rejected");
        throw error;
    } finally {
        clearTimeout(timer);
        page.off("crash", onCrash);
    }
};
