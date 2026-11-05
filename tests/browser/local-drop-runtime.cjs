"use strict";
// Bounded, real Chromium decoder test. Requires an already assembled private
// runtime site and a synthetic local video; never builds or downloads assets.
// Example (run only after the browser slot is approved):
// NODE_PATH=/path/to/node_modules node tests/browser/local-drop-runtime.cjs \
//   --site /private/staged-site --video /private/synthetic-12s.mp4 \
//   --output /private/new-result --engine 1
// Default success permits an explicitly recorded Play-key recovery from a
// proven NotAllowedError. --require-autoplay makes that outcome fail instead.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function options(argv) {
    const result = { engine: 1, requireAutoplay: false };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--require-autoplay") result.requireAutoplay = true;
        else if (
            ["--site", "--video", "--output", "--engine"].includes(argv[i])
        ) {
            const key = argv[i].slice(2),
                value = argv[++i];
            assert.ok(value && !value.startsWith("--"), "Missing " + key);
            result[key] =
                key === "engine" ? Number(value) : path.resolve(value);
        } else throw new Error("Unknown argument: " + argv[i]);
    }
    for (const key of ["site", "video", "output"])
        assert.ok(result[key], "Required --" + key);
    assert.ok(
        [0, 1, 2, 3].includes(result.engine),
        "Engine must be 0, 1, 2 or 3"
    );
    assert.ok(
        /\.(mp4|m4v|webm|mov)$/i.test(result.video),
        "Use a direct synthetic video fixture"
    );
    const size = fs.statSync(result.video).size;
    assert.ok(
        size > 0 && size <= 64 * 1024 * 1024,
        "Synthetic video must be 1 byte..64 MiB"
    );
    return result;
}

function serverFor(site, requests) {
    const types = {
        ".css": "text/css",
        ".html": "text/html",
        ".ico": "image/x-icon",
        ".js": "application/javascript",
        ".json": "application/json",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".ttf": "font/ttf",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
    };
    return http.createServer((req, res) => {
        let pathname;
        try {
            pathname = decodeURIComponent(
                new URL(req.url, "http://localhost").pathname
            );
        } catch (_) {
            res.writeHead(400).end();
            return;
        }
        requests.push({ method: req.method, path: pathname });
        if (req.method !== "GET" && req.method !== "HEAD") {
            res.writeHead(405).end();
            return;
        }
        if (pathname === "/fixture-empty.m3u") {
            res.writeHead(200, {
                "Cache-Control": "no-store",
                "Content-Type": "application/x-mpegurl",
            });
            res.end("#EXTM3U\n");
            return;
        }
        let relative;
        if (
            pathname === "/f/pc/" ||
            pathname === "/" ||
            pathname === "/index.html"
        )
            relative = "index.html";
        else if (/^\/dist\/[A-Za-z0-9_-]+\.js$/.test(pathname)) {
            relative = pathname.slice(1);
            if (!fs.existsSync(path.join(site, relative)))
                relative = path.basename(relative);
        } else if (
            /^\/(fonts|js|devices|providers|styles|images|locales)\//.test(
                pathname
            ) ||
            pathname === "/favicon.ico"
        )
            relative = pathname.slice(1);
        else {
            res.writeHead(404).end();
            return;
        }
        const file = path.resolve(site, relative);
        if (!file.startsWith(site + path.sep)) {
            res.writeHead(403).end();
            return;
        }
        fs.readFile(file, (error, bytes) => {
            if (error) {
                res.writeHead(404).end();
                return;
            }
            res.writeHead(200, {
                "Cache-Control": "no-store",
                "Content-Type":
                    types[path.extname(file)] || "application/octet-stream",
            });
            res.end(req.method === "HEAD" ? undefined : bytes);
        });
    });
}

// These calls explicitly avoid granting browser user activation. Using the
// usual page.evaluate/waitForFunction before the drop could mask autoplay.
async function inspect(cdp, expression) {
    const value = await cdp.send("Runtime.evaluate", {
        awaitPromise: true,
        expression,
        returnByValue: true,
        userGesture: false,
    });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.text);
    return value.result.value;
}
const snapshotExpression = `(() => {
    const media = document.getElementById('video');
    const handle = window.__ottCoreBackendPeek?.()?.current?.();
    return {
        ready: !!window.__ottLocalDrop && !!window.__ottLocalMedia?.hasDroppedVideo,
        drop: window.__dropRuntimeObservation || null,
        revocations: window.__dropRuntimeRevocations || [],
        activation: {active:navigator.userActivation.isActive, ever:navigator.userActivation.hasBeenActive},
        retained: window.__ottLocalMedia?.hasDroppedVideo?.() || false,
        driver: window.__ottActiveProviderDriver?.id || null,
        provider: window.stbGetItem?.('ottplayprov') || null,
        storedProvider: window.stbGetPersistedItem?.('ottplayprov') || null,
        enginePreference: window.settings?.players ?? window.sPlayers,
        engine: handle?.diagnosticEngine?.() || null,
        localUrl: !!media && !!window.__ottLocalMedia?.isPlaybackUrl?.(media.currentSrc || media.src),
        stored: Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])),
        media: !media ? null : {
            source: media.currentSrc || media.src, time:media.currentTime,
            duration:Number.isFinite(media.duration)?media.duration:null,
            paused:media.paused, ended:media.ended, ready:media.readyState,
            width:media.videoWidth,height:media.videoHeight,muted:media.muted,volume:media.volume,
            frames:media.getVideoPlaybackQuality?.().totalVideoFrames || 0,
            error:media.error ? {code:media.error.code,message:media.error.message} : null
        }
    };
})()`;
async function waitFor(cdp, predicate, ms, deadline) {
    const end = Math.min(Date.now() + ms, deadline);
    let latest;
    do {
        latest = await inspect(cdp, snapshotExpression);
        if (predicate(latest)) return latest;
        await pause(100);
    } while (Date.now() < end);
    const error = new Error("Timed out waiting for real browser state");
    error.snapshot = latest;
    throw error;
}
async function advancing(cdp, deadline, ms = 6000) {
    const first = await waitFor(
        cdp,
        (s) =>
            s.media &&
            s.media.width > 0 &&
            s.media.height > 0 &&
            s.media.ready >= 2 &&
            !s.media.paused &&
            !s.media.error &&
            s.media.frames > 0,
        ms,
        deadline
    );
    const next = await waitFor(
        cdp,
        (s) =>
            s.media &&
            s.media.source === first.media.source &&
            !s.media.error &&
            !s.media.paused &&
            s.media.time > first.media.time + 0.2 &&
            s.media.frames > first.media.frames,
        ms,
        deadline
    );
    return { first, next };
}

async function main() {
    const config = options(process.argv.slice(2));
    // Require a new output directory; preserve earlier evidence on reruns.
    fs.mkdirSync(config.output);
    const deadline = Date.now() + 120000;
    const report = {
        assets: {},
        blockedExternal: [],
        console: [],
        errors: [],
        evidenceScope:
            "Chromium CDP file drag, actual Local/provider/backend and decoder; not an OS Finder gesture, Tauri or audible-output proof",
        fixture: {
            bytes: fs.statSync(config.video).size,
            name: path.basename(config.video),
            sha256: sha(fs.readFileSync(config.video)),
        },
        requestedEngine: config.engine,
        requests: [],
        requireAutoplay: config.requireAutoplay,
        schema: 1,
        started: new Date().toISOString(),
        status: "running",
        testSha256: sha(fs.readFileSync(__filename)),
    };
    let browser, server, page, watchdog;
    try {
        for (const name of [
            "index.html",
            "player.js",
            "local-drop.js",
            "provider-m3u.js",
        ]) {
            const file =
                name.endsWith(".js") &&
                fs.existsSync(path.join(config.site, "dist", name))
                    ? path.join(config.site, "dist", name)
                    : path.join(config.site, name);
            report.assets[name] = sha(fs.readFileSync(file));
        }
        server = serverFor(config.site, report.requests);
        await new Promise((resolve, reject) => {
            server.once("error", reject);
            server.listen(0, "127.0.0.1", resolve);
        });
        const origin = "http://127.0.0.1:" + server.address().port;
        browser = await chromium.launch({
            args: ["--autoplay-policy=document-user-activation-required"],
            headless: true,
            timeout: 20000,
        });
        watchdog = setTimeout(
            () => {
                void browser.close().catch(() => {});
            },
            Math.max(1, deadline - Date.now())
        );
        report.chromium = browser.version();
        const context = await browser.newContext({
            serviceWorkers: "block",
            viewport: { height: 720, width: 1280 },
        });
        await context.route("**/*", (route) => {
            const url = new URL(route.request().url());
            if (
                url.origin === origin ||
                ["blob:", "data:"].includes(url.protocol)
            )
                return route.continue();
            report.blockedExternal.push(url.origin);
            return route.abort();
        });
        await context.routeWebSocket("**/*", (socket) => socket.close());
        await context.addInitScript(
            ({ origin, engine }) => {
                localStorage.setItem("ottplaylang", "_eng");
                localStorage.setItem("ottplayprov", "m3u");
                localStorage.setItem(
                    "m3um3uArr",
                    JSON.stringify({
                        active: 0,
                        M3Us: [
                            {
                                name: "Synthetic retained profile",
                                www: origin + "/fixture-empty.m3u",
                            },
                        ],
                    })
                );
                localStorage.setItem("m3usPlayers", String(engine));
                localStorage.setItem("offlinesPlayers", String(engine));
                // Observe the real URL API without substituting its effect. The
                // post-replacement fetch below independently proves invalidation.
                window.__dropRuntimeRevocations = [];
                const revoke = URL.revokeObjectURL;
                URL.revokeObjectURL = function (url) {
                    window.__dropRuntimeRevocations.push(String(url));
                    return revoke.call(this, url);
                };
                window.addEventListener(
                    "drop",
                    (event) => {
                        window.__dropRuntimeObservation = {
                            active: navigator.userActivation.isActive,
                            bytes: event.dataTransfer?.files[0]?.size,
                            count: event.dataTransfer?.files.length,
                            ever: navigator.userActivation.hasBeenActive,
                            name: event.dataTransfer?.files[0]?.name,
                            trusted: event.isTrusted,
                        };
                    },
                    true
                );
            },
            { engine: config.engine, origin }
        );
        page = await context.newPage();
        page.setDefaultTimeout(10000);
        page.on("pageerror", (error) => report.errors.push(error.message));
        page.on("console", (message) =>
            report.console.push(message.text().slice(0, 1500))
        );
        const cdp = await context.newCDPSession(page);
        await page.goto(origin + "/f/pc/?m3u", {
            timeout: 20000,
            waitUntil: "domcontentloaded",
        });
        report.before = await waitFor(
            cdp,
            (s) => s.ready && s.storedProvider === "m3u",
            20000,
            deadline
        );
        assert.equal(
            report.before.activation.ever,
            false,
            "No prior browser user activation may mask fresh-drop autoplay"
        );
        const data = {
            dragOperationsMask: 1,
            files: [config.video],
            items: [],
        };
        for (const type of ["dragEnter", "dragOver", "drop"])
            await cdp.send("Input.dispatchDragEvent", {
                data,
                type,
                x: 640,
                y: 360,
            });
        report.admitted = await waitFor(
            cdp,
            (s) => s.retained && s.driver === "offline" && s.localUrl,
            15000,
            deadline
        );
        assert.equal(
            report.admitted.drop?.trusted,
            true,
            "CDP must deliver a trusted browser drop"
        );
        assert.equal(report.admitted.drop?.count, 1);
        assert.equal(report.admitted.drop?.bytes, report.fixture.bytes);
        assert.match(report.admitted.media.source, /^blob:/);
        assert.equal(
            report.admitted.enginePreference,
            config.engine,
            "Selected engine preference is retained"
        );
        assert.equal(
            report.admitted.engine,
            "html5",
            "Local file must bypass TV HLS/Shaka preference"
        );
        try {
            report.playback = await advancing(cdp, deadline);
            report.autoplay = "started_without_extra_gesture";
        } catch (error) {
            report.autoplaySnapshot =
                error.snapshot || (await inspect(cdp, snapshotExpression));
            assert.equal(
                report.autoplaySnapshot.media?.error,
                null,
                "A decoder error is not autoplay refusal"
            );
            assert.ok(
                report.console.some((line) =>
                    /NotAllowedError|user didn't interact|user gesture|user.*interact/i.test(
                        line
                    )
                ),
                "Do not relabel an unexplained decode/stall failure as autoplay policy"
            );
            report.autoplay = "policy_blocked";
            await page.keyboard.press("Space");
            report.playback = await advancing(cdp, deadline);
            report.recovery = "real_space_key_then_advancing_frames";
        }
        const firstUrl = report.playback.next.media.source;
        for (const type of ["dragEnter", "dragOver", "drop"])
            await cdp.send("Input.dispatchDragEvent", {
                data,
                type,
                x: 640,
                y: 360,
            });
        const replacement = await waitFor(
            cdp,
            (s) =>
                s.retained &&
                s.driver === "offline" &&
                s.localUrl &&
                s.media.source !== firstUrl,
            15000,
            deadline
        );
        assert.equal(replacement.drop?.trusted, true);
        assert.equal(replacement.drop?.bytes, report.fixture.bytes);
        assert.equal(replacement.engine, "html5");
        assert.equal(
            replacement.revocations.filter((url) => url === firstUrl).length,
            1,
            "Accepted replacement must revoke the old blob exactly once"
        );
        report.replacement = {
            admitted: replacement,
            playback: await advancing(cdp, deadline),
        };
        report.replacement.oldUrlRejected = await inspect(
            cdp,
            `fetch(${JSON.stringify(firstUrl)}).then(response => {
                response.body?.cancel(); return false;
            }, () => true)`
        );
        assert.equal(
            report.replacement.oldUrlRejected,
            true,
            "The old browser object URL must actually be unreadable after replacement"
        );
        report.after = await inspect(cdp, snapshotExpression);
        assert.equal(
            report.after.revocations.filter((url) => url === firstUrl).length,
            1
        );
        assert.equal(
            report.after.revocations.includes(report.after.media.source),
            false,
            "The playing replacement keeps its own live blob lease"
        );
        assert.equal(
            report.after.media.muted,
            false,
            "Do not bypass autoplay by muting the file"
        );
        assert.ok(
            report.after.media.volume > 0,
            "Audio output must remain enabled"
        );
        for (const key of [
            "ottplayprov",
            "m3um3uArr",
            "m3usPlayers",
            "offlinesPlayers",
        ])
            assert.equal(
                report.after.stored[key],
                report.before.stored[key],
                "Persisted setting unchanged: " + key
            );
        assert.equal(report.after.storedProvider, "m3u");
        assert.equal(report.after.provider, "offline");
        assert.ok(
            Object.values(report.after.stored).every(
                (value) =>
                    !/blob:|dropped-[a-z0-9]+-(?:source|item)/.test(value)
            ),
            "No dropped identity or blob may reach persistent storage"
        );
        assert.ok(
            !report.requests.some(
                (request) => !["GET", "HEAD"].includes(request.method)
            ),
            "No media upload"
        );
        await page.screenshot({
            path: path.join(config.output, "playback.png"),
        });
        if (config.requireAutoplay)
            assert.equal(report.autoplay, "started_without_extra_gesture");
        report.status = "passed";
    } catch (error) {
        report.status = "failed";
        report.failure = {
            message: error.message,
            snapshot: error.snapshot || null,
        };
        if (page && !page.isClosed())
            await page
                .screenshot({ path: path.join(config.output, "failure.png") })
                .catch(() => {});
        process.exitCode = 1;
    } finally {
        clearTimeout(watchdog);
        if (browser)
            await browser.close().catch((error) => {
                report.status = "failed";
                report.cleanupError = error.message;
                process.exitCode = 1;
            });
        if (server) {
            server.closeAllConnections();
            await new Promise((resolve) => server.close(resolve));
        }
        report.finished = new Date().toISOString();
        fs.writeFileSync(
            path.join(config.output, "result.json"),
            JSON.stringify(report, null, 2) + "\n",
            { flag: "wx" }
        );
        console.log(
            JSON.stringify({
                autoplay: report.autoplay,
                output: config.output,
                recovery: report.recovery || null,
                status: report.status,
            })
        );
    }
}
if (require.main === module)
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
