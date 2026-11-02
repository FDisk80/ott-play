// Shipped bundles, authenticated controller delivery and real Chromium HLS EOS.
// All provider/controller traffic is synthetic and external traffic is blocked.
const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const PLEX = "https://plex-queue.fixture.invalid";
const PLAYLIST = "https://playlist-queue.fixture.invalid/channels.m3u";
const TOKEN = "synthetic-plex-queue-token";
const DEVICE_TOKEN = "synthetic_controller_" + "d".repeat(32);
const mediaRoot = path.resolve(__dirname, "../fixtures/media-runtime");
test.use({
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
});

test("authenticated relative VOD seek moves the paused decoder without replacing its queue", async ({
    page,
    context,
    baseURL,
}) => {
    test.setTimeout(90000);
    const local = new URL(baseURL).origin;
    const errors = [];
    const pending = [];
    const results = new Map();
    const streams = [];
    let sequence = 0;
    const playlist =
        "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-PLAYLIST-TYPE:VOD\n" +
        Array.from(
            { length: 24 },
            (_, index) =>
                (index ? "#EXT-X-DISCONTINUITY\n" : "") +
                "#EXTINF:2.000000,\nsegment00.ts?n=" +
                index +
                "\n"
        ).join("") +
        "#EXT-X-ENDLIST\n";
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (
            url.origin === local &&
            url.pathname.startsWith("/seek-controller/")
        ) {
            expect(request.headers().authorization).toBe(
                "Bearer " + DEVICE_TOKEN
            );
            if (url.pathname.endsWith("/api/responses")) {
                const result = request.postDataJSON();
                results.set(result.id, result);
                return route.fulfill({ json: { status: "ok" } });
            }
            if (url.pathname.endsWith("/api/webhook/commands")) {
                const now = Date.now() / 1000;
                const next = pending.shift();
                return route.fulfill({
                    json: {
                        commands: [],
                        requests: next
                            ? [{ ...next, expires_at: now + 40 }]
                            : [],
                        server_time: now,
                    },
                });
            }
            return route.fulfill({ json: {}, status: 404 });
        }
        if (request.url() === PLAYLIST)
            return route.fulfill({
                body: '#EXTM3U\n#EXTINF:-1 group-title="TV fixture",Fixture channel\nhttps://tv-queue.fixture.invalid/index.m3u8\n',
                contentType: "text/plain",
                headers: { "Access-Control-Allow-Origin": "*" },
            });
        if (url.origin === PLEX) {
            const headers = { "Access-Control-Allow-Origin": "*" };
            const json = (body) =>
                route.fulfill({ headers, json: { MediaContainer: body } });
            if (url.pathname === "/library/sections")
                return json({
                    Directory: [
                        { key: "1", title: "Synthetic films", type: "movie" },
                    ],
                });
            if (url.pathname === "/library/metadata/33") {
                expect(url.searchParams.get("X-Plex-Token")).toBe(TOKEN);
                return json({
                    Metadata: [
                        {
                            Media: [
                                {
                                    audioCodec: "mp3",
                                    container: "avi",
                                    Part: [
                                        { key: "/library/parts/33/file.avi" },
                                    ],
                                    videoCodec: "mpeg4",
                                },
                            ],
                            ratingKey: "33",
                            title: "Synthetic seek film",
                            type: "movie",
                        },
                    ],
                });
            }
            if (url.pathname.endsWith("/decision"))
                return json({
                    generalDecisionCode: 1001,
                    Metadata: [
                        { Media: [{ Part: [{ decision: "transcode" }] }] },
                    ],
                });
            if (url.pathname.endsWith("/start.m3u8")) {
                streams.push(url.searchParams.get("path"));
                return route.fulfill({
                    body: playlist,
                    contentType: "application/vnd.apple.mpegurl",
                    headers,
                });
            }
            if (url.pathname.endsWith(".ts"))
                return route.fulfill({
                    body: fs.readFileSync(path.join(mediaRoot, "segment00.ts")),
                    contentType: "video/mp2t",
                    headers,
                });
            if (
                url.pathname.endsWith("/stop") ||
                url.pathname.endsWith("/ping")
            )
                return route.fulfill({ body: "", headers });
            return route.fulfill({ headers, status: 404 });
        }
        return url.origin === local
            ? route.continue()
            : route.abort("blockedbyclient");
    });
    await context.routeWebSocket("**/*", (socket) => socket.close());
    await context.addInitScript(
        ({ plex, token, tv }) => {
            const play = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function () {
                this.muted = true;
                return play.call(this);
            };
            localStorage.setItem("ottplaylang", "_eng");
            localStorage.setItem("ottplayprov", "m3u");
            localStorage.setItem(
                "m3um3uArr",
                JSON.stringify({ active: 0, M3Us: [{ www: tv }] })
            );
            localStorage.setItem(
                "plexcfg",
                JSON.stringify({ address: plex, playback: "compatible", token })
            );
        },
        { plex: PLEX, token: TOKEN, tv: PLAYLIST }
    );
    await page.goto("/f/pc/");
    await page.waitForFunction(() => window.commandChannelsReady === true);
    await page.keyboard.press("Shift");
    await page.evaluate((token) => {
        window.stbStop();
        window.setPlayerMode(1);
        window.__ottCommandServer.configure({
            address: location.origin + "/seek-controller",
            enabled: true,
            token,
        });
    }, DEVICE_TOKEN);
    async function rpc(action, params = {}) {
        const id = String(++sequence).padStart(32, "0");
        pending.push({ action, id, params });
        await expect.poll(() => results.has(id)).toBe(true);
        const result = results.get(id);
        expect(result.status).toBe("ok");
        return result.data;
    }
    try {
        const initial = await rpc("capabilities");
        const runtime = initial.player.runtime;
        await rpc("plex_queue", { ids: ["33"], op: "play", runtime });
        await page.waitForFunction(() => {
            const video = document.getElementById("video");
            return (
                window.__ottClassicPlayback.snapshot().phase === "playing" &&
                video.currentTime > 0 &&
                video.readyState >= 2 &&
                video.duration > 40 &&
                video.seekable.length > 0
            );
        });
        await rpc("playback", { operation: "pause" });
        await page.waitForFunction(
            () =>
                document.getElementById("video").paused &&
                window.__ottClassicPlayback.snapshot().phase === "paused"
        );
        const original = await page.evaluate(() => {
            const video = document.getElementById("video");
            const state = window.__ottClassicPlayback.snapshot();
            window.__seekOwner = {
                element: video,
                handle: window.__ottCoreBackendPeek().current(),
            };
            window.__seekEnded = 0;
            video.addEventListener("ended", () => window.__seekEnded++);
            return { generation: state.generation, target: state.target };
        });
        expect((await rpc("capabilities")).playback_seek_relative).toEqual({
            version: 1,
        });
        async function settled(position) {
            await page.waitForFunction((target) => {
                const video = document.getElementById("video");
                return (
                    !video.seeking &&
                    video.readyState >= 2 &&
                    Math.abs(video.currentTime - target) < 0.15
                );
            }, position);
            const state = await page.evaluate(() => {
                const video = document.getElementById("video");
                const snapshot = window.__ottClassicPlayback.snapshot();
                return {
                    ended: window.__seekEnded,
                    generation: snapshot.generation,
                    paused: video.paused,
                    sameElement: video === window.__seekOwner.element,
                    sameHandle:
                        window.__ottCoreBackendPeek().current() ===
                        window.__seekOwner.handle,
                    target: snapshot.target,
                };
            });
            expect(state).toEqual({
                ended: 0,
                generation: original.generation,
                paused: true,
                sameElement: true,
                sameHandle: true,
                target: original.target,
            });
        }
        expect(
            await rpc("playback", { operation: "seek", position: 15 })
        ).toEqual({
            dispatched: true,
            operation: "seek",
            position: 15,
        });
        await settled(15);
        for (const offset of [10, -10, -1000, 1000]) {
            const before = await page.evaluate(() => {
                const video = document.getElementById("video");
                return {
                    duration: video.duration,
                    position: video.currentTime,
                };
            });
            const result = await rpc("playback", {
                offset,
                operation: "seek_relative",
            });
            expect(Object.keys(result).sort()).toEqual([
                "clamped",
                "dispatched",
                "from",
                "offset",
                "operation",
                "position",
            ]);
            expect(result).toMatchObject({
                clamped: Math.abs(offset) === 1000,
                dispatched: true,
                offset,
                operation: "seek_relative",
            });
            expect(result.from).toBeCloseTo(before.position, 6);
            if (offset === -1000) expect(result.position).toBe(0);
            else if (offset === 1000) {
                expect(result.position).toBeLessThan(before.duration);
                expect(before.duration - result.position).toBeCloseTo(0.001, 6);
            } else
                expect(result.position).toBeCloseTo(
                    before.position + offset,
                    6
                );
            await settled(result.position);
        }
        expect(
            await rpc("playback", { operation: "seek", position: 5 })
        ).toEqual({
            dispatched: true,
            operation: "seek",
            position: 5,
        });
        await settled(5);
        expect(
            await rpc("plex_queue", { op: "status", runtime })
        ).toMatchObject({
            active: true,
            ids: ["33"],
            index: 0,
            state: "paused",
        });
        expect(streams).toEqual(["/library/metadata/33"]);
        expect(errors).toEqual([]);
    } finally {
        await page.evaluate(() => {
            window.__ottCommandServer.configure({ enabled: false });
            window.stbStop();
        });
    }
});

test("remote Plex loads lazily, ends its exact queue and restores a current favorite after reload", async ({
    page,
    context,
    baseURL,
}) => {
    test.setTimeout(90000);
    const local = new URL(baseURL).origin;
    const errors = [];
    const bundles = [];
    const streams = [];
    const metadataRequests = [];
    const pending = [];
    const results = new Map();
    let releaseFirstManifest;
    const firstManifest = new Promise((resolve) => {
        releaseFirstManifest = resolve;
    });
    let sequence = 0;
    page.on("pageerror", (error) => errors.push(error.message));
    const item = (id) => ({
        Media: [
            {
                audioCodec: "mp3",
                container: "avi",
                Part: [{ key: "/library/parts/" + id + "/file.avi" }],
                videoCodec: "mpeg4",
            },
        ],
        ratingKey: id,
        title: "Synthetic film " + id,
        type: "movie",
    });
    await context.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (
            url.origin === local &&
            url.pathname.startsWith("/queue-controller/")
        ) {
            expect(request.headers().authorization).toBe(
                "Bearer " + DEVICE_TOKEN
            );
            if (url.pathname.endsWith("/api/responses")) {
                const result = request.postDataJSON();
                results.set(result.id, result);
                return route.fulfill({ json: { status: "ok" } });
            }
            if (url.pathname.endsWith("/api/webhook/commands")) {
                const now = Date.now() / 1000;
                const next = pending.shift();
                return route.fulfill({
                    json: {
                        commands: [],
                        requests: next
                            ? [{ ...next, expires_at: now + 40 }]
                            : [],
                        server_time: now,
                    },
                });
            }
            return route.fulfill({ json: {}, status: 404 });
        }
        if (request.url() === PLAYLIST)
            return route.fulfill({
                body: '#EXTM3U\n#EXTINF:-1 group-title="TV fixture",Fixture channel\nhttps://tv-queue.fixture.invalid/index.m3u8\n',
                contentType: "text/plain",
                headers: { "Access-Control-Allow-Origin": "*" },
            });
        if (url.origin === PLEX) {
            const headers = { "Access-Control-Allow-Origin": "*" };
            const json = (body) =>
                route.fulfill({ headers, json: { MediaContainer: body } });
            if (url.pathname === "/library/sections")
                return json({
                    Directory: [
                        { key: "1", title: "Synthetic films", type: "movie" },
                    ],
                });
            if (url.pathname.startsWith("/library/metadata/")) {
                metadataRequests.push(url.pathname);
                expect(url.searchParams.get("X-Plex-Token")).toBe(TOKEN);
                // Plex response order is deliberately different from requested order.
                return json({
                    Metadata: url.pathname
                        .split("/")
                        .pop()
                        .split(",")
                        .reverse()
                        .map(item),
                });
            }
            if (url.pathname.endsWith("/decision"))
                return json({
                    generalDecisionCode: 1001,
                    Metadata: [
                        { Media: [{ Part: [{ decision: "transcode" }] }] },
                    ],
                });
            if (url.pathname.endsWith("/start.m3u8")) {
                streams.push(url.searchParams.get("path"));
                if (streams.length === 1) await firstManifest;
                return route.fulfill({
                    body: fs.readFileSync(path.join(mediaRoot, "index.m3u8")),
                    contentType: "application/vnd.apple.mpegurl",
                    headers,
                });
            }
            if (url.pathname.endsWith(".ts"))
                return route.fulfill({
                    body: fs.readFileSync(path.join(mediaRoot, "segment00.ts")),
                    contentType: "video/mp2t",
                    headers,
                });
            if (
                url.pathname.endsWith("/stop") ||
                url.pathname.endsWith("/ping")
            )
                return route.fulfill({ body: "", headers });
            return route.fulfill({
                body: "Unknown synthetic Plex route",
                headers,
                status: 404,
            });
        }
        if (url.origin === local) {
            if (/\/dist\/provider-.*\.js$/.test(url.pathname))
                bundles.push(url.pathname);
            return route.continue();
        }
        return route.abort("blockedbyclient");
    });
    await context.routeWebSocket("**/*", (socket) => socket.close());
    await context.addInitScript(
        ({ plex, playlist, token }) => {
            const play = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function () {
                this.muted = true;
                return play.call(this);
            };
            localStorage.setItem("ottplaylang", "_eng");
            localStorage.setItem("ottplayprov", "m3u");
            localStorage.setItem(
                "m3um3uArr",
                JSON.stringify({ active: 0, M3Us: [{ www: playlist }] })
            );
            localStorage.setItem(
                "plexcfg",
                JSON.stringify({ address: plex, playback: "compatible", token })
            );
            window.__queueEnded = [];
            document.addEventListener(
                "ended",
                (event) => {
                    const media = window.__ottMedia?.current();
                    if (media?.sequence?.explicit)
                        window.__queueEnded.push({
                            index: media.sequence.index,
                            trusted: event.isTrusted,
                        });
                },
                true
            );
        },
        { playlist: PLAYLIST, plex: PLEX, token: TOKEN }
    );
    await page.goto("/f/pc/");
    await page.waitForFunction(
        () =>
            window.commandChannelsReady === true &&
            window.__ottActiveProviderDriver?.id === "m3u"
    );
    await page.keyboard.press("Shift");
    await page.evaluate((token) => {
        window.stbStop();
        window.__queueOriginalProvider = window.__ottActiveProviderDriver;
        window.__ottCommandServer.configure({
            address: location.origin + "/queue-controller",
            enabled: true,
            token,
        });
    }, DEVICE_TOKEN);
    const settings = () =>
        page.evaluate(() =>
            Object.fromEntries(
                ["ottplayprov", "m3um3uArr", "plexcfg"].map((key) => [
                    key,
                    localStorage.getItem(key),
                ])
            )
        );
    const before = await settings();
    async function rpc(action, params = {}) {
        const id = String(++sequence).padStart(32, "0");
        pending.push({ action, id, params });
        await expect.poll(() => results.has(id)).toBe(true);
        return results.get(id);
    }
    const caps = await rpc("capabilities");
    expect(caps.status).toBe("ok");
    expect(caps.data.plex_queue.operations).toContain("preview");
    expect(bundles).toEqual(["/dist/provider-m3u.js"]);
    let runtime = caps.data.player.runtime;
    const ids = ["33", "11", "22"];
    const preview = await rpc("plex_queue", { ids, op: "preview", runtime });
    expect(preview.status).toBe("ok");
    expect(preview.data).toMatchObject({
        ids,
        order: "listed",
        state: "ready",
        titles: ids.map((id) => "Synthetic film " + id),
    });
    expect(bundles).toEqual([
        "/dist/provider-m3u.js",
        "/dist/provider-plex.js",
    ]);
    expect(streams).toEqual([]);
    expect(await settings()).toEqual(before);
    await page.evaluate(() =>
        window._channelsList(window.catsArray.indexOf("TV fixture"), 0)
    );
    await expect(page.locator("#list_window")).toBeVisible();
    await page.evaluate(() => {
        // A previously previewed TV channel must not be restored by closeList.
        // Keep the standard parental defaults: no PIN bypass is needed for films.
        window.sPreview = 1;
        window.sStopPlay = 1;
        window.previewChan = { c: 0, ch_id: "stale-tv-preview", i: 0 };
        window.__stalePreviewFired = false;
        window.__stalePreviewScheduledAt = Date.now();
        window.previewTimer = setTimeout(() => {
            window.__stalePreviewFired = true;
        }, 5000);
    });
    const play = await rpc("plex_queue", { ids, op: "play", runtime });
    expect(play.status).toBe("ok");
    await expect(page.locator("#list_window")).toBeHidden();
    try {
        await expect.poll(() => streams.length).toBe(1);
        await expect
            .poll(() =>
                page.evaluate(
                    () => window.__ottClassicPlayback.snapshot().phase
                )
            )
            .toBe("loading");
        const volume = await page.evaluate(() => {
            window.stbSetVolume(50);
            window.__queueSeeks = [];
            const seek = window.shiftArchive;
            window.shiftArchive = function (delta) {
                window.__queueSeeks.push(delta);
                return seek.apply(this, arguments);
            };
            const video = document.querySelector("video");
            video.tabIndex = 0;
            video.focus();
            return { current: window.stbGetVolume(), step: window.sVolumeStep };
        });
        await page.keyboard.press("ArrowRight");
        expect(await page.evaluate(() => window.stbGetVolume())).toBeCloseTo(
            volume.current + volume.step,
            8
        );
        await page.keyboard.press("ArrowLeft");
        expect(await page.evaluate(() => window.stbGetVolume())).toBeCloseTo(
            volume.current,
            8
        );
        expect(await page.evaluate(() => window.__queueSeeks)).toEqual([]);
        expect(
            await page.evaluate(
                () => window.__ottMedia.current().sequence.index
            )
        ).toBe(0);
        expect(streams).toEqual(["/library/metadata/33"]);
    } finally {
        releaseFirstManifest();
    }
    await expect
        .poll(() => page.evaluate(() => window.__queueEnded), {
            timeout: 20000,
        })
        .toEqual([
            { index: 0, trusted: true },
            { index: 1, trusted: true },
            { index: 2, trusted: true },
        ]);
    const final = await rpc("plex_queue", { op: "status", runtime });
    expect(final.data).toMatchObject({
        active: true,
        ids,
        index: 2,
        order: "listed",
        repeat: "none",
        state: "ended",
    });
    expect(streams).toEqual(ids.map((id) => "/library/metadata/" + id));
    await page.waitForFunction(
        () => Date.now() - window.__stalePreviewScheduledAt >= 5100
    );
    expect(await page.evaluate(() => window.previewChan)).toBeNull();
    expect(await page.evaluate(() => window.__stalePreviewFired)).toBe(false);
    expect((await rpc("playback", { operation: "next_channel" })).status).toBe(
        "rejected"
    );
    expect(streams).toHaveLength(3);
    expect(await settings()).toEqual(before);
    expect(
        await page.evaluate(
            () =>
                window.__ottActiveProviderDriver ===
                    window.__queueOriginalProvider && window.p_pref === "m3u"
        )
    ).toBe(true);
    expect(
        (await rpc("plex_queue", { op: "stop", runtime })).data
    ).toMatchObject({ active: false, state: "idle" });
    // Keep the short fixture playing while polling add/list across a reload.
    await page.evaluate(() => {
        document.querySelector("video").loop = true;
    });
    expect(
        (await rpc("plex_queue", { ids: ["33"], op: "play", runtime })).status
    ).toBe("ok");
    const saved = await rpc("favorites", {
        name: "Saved Plex film",
        op: "add",
        runtime,
    });
    expect(saved.status).toBe("ok");
    expect(saved.data.entry).toMatchObject({
        kind: "vod",
        profile_number: 1,
        provider: "m3u",
        title: "Synthetic film 33",
    });
    await page.reload();
    await page.waitForFunction(() => window.commandChannelsReady === true);
    const restartedCaps = await rpc("capabilities");
    expect(restartedCaps.data.player.runtime).not.toBe(runtime);
    runtime = restartedCaps.data.player.runtime;
    const favorites = await rpc("favorites", { op: "list", runtime });
    expect(favorites.data.entries).toEqual([saved.data.entry]);
    const requestsBeforeReplay = metadataRequests.length;
    const streamsBeforeReplay = streams.length;
    const replay = await rpc("favorites", {
        id: saved.data.entry.id,
        op: "play",
        runtime,
    });
    expect(replay.status).toBe("ok");
    expect(replay.data.dispatched).toBe(true);
    await expect
        .poll(() => streams.length)
        .toBeGreaterThan(streamsBeforeReplay);
    expect(streams.at(-1)).toBe("/library/metadata/33");
    expect(metadataRequests.length).toBeGreaterThan(requestsBeforeReplay);
    expect(metadataRequests.at(-1)).toBe("/library/metadata/33");
    expect(await settings()).toEqual(before);
    expect(errors).toEqual([]);
    await page.evaluate(() =>
        window.__ottCommandServer.configure({ enabled: false })
    );
});

test("authenticated archive offsets rebuild broadcast URLs and preserve pause", async ({
    page,
    context,
    baseURL,
}) => {
    test.setTimeout(90000);
    const local = new URL(baseURL).origin;
    const archiveOrigin = "https://archive-seek.fixture.invalid";
    const pending = [],
        results = new Map(),
        urls = [],
        errors = [];
    let sequence = 0;
    const playlist =
        '#EXTM3U catchup-days="3" catchup="append" catchup-source="?utc=${start}"\n' +
        '#EXTINF:-1 group-title="Test",Archive channel\n' +
        archiveOrigin +
        "/index.m3u8\n";
    // An open-ended HLS archive has no finite duration; native VOD seeking is
    // not the mechanism being exercised here.
    const stream =
        "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-PLAYLIST-TYPE:EVENT\n" +
        Array.from(
            { length: 24 },
            (_, i) =>
                (i ? "#EXT-X-DISCONTINUITY\n" : "") +
                "#EXTINF:2.000000,\nsegment00.ts?n=" +
                i +
                "\n"
        ).join("");
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/*", async (route) => {
        const request = route.request(),
            url = new URL(request.url());
        if (
            url.origin === local &&
            url.pathname.startsWith("/archive-controller/")
        ) {
            expect(request.headers().authorization).toBe(
                "Bearer " + DEVICE_TOKEN
            );
            if (url.pathname.endsWith("/api/responses")) {
                const result = request.postDataJSON();
                results.set(result.id, result);
                return route.fulfill({ json: { status: "ok" } });
            }
            if (url.pathname.endsWith("/api/webhook/commands")) {
                const now = Date.now() / 1000,
                    next = pending.shift();
                return route.fulfill({
                    json: {
                        commands: [],
                        requests: next
                            ? [{ ...next, expires_at: now + 40 }]
                            : [],
                        server_time: now,
                    },
                });
            }
            return route.fulfill({ json: {}, status: 404 });
        }
        if (request.url() === PLAYLIST)
            return route.fulfill({
                body: playlist,
                contentType: "text/plain",
                headers: { "Access-Control-Allow-Origin": "*" },
            });
        if (url.origin === archiveOrigin) {
            const headers = { "Access-Control-Allow-Origin": "*" };
            if (url.pathname.endsWith(".m3u8")) {
                if (url.searchParams.has("utc"))
                    urls.push(Number(url.searchParams.get("utc")));
                return route.fulfill({
                    body: stream,
                    contentType: "application/vnd.apple.mpegurl",
                    headers,
                });
            }
            return route.fulfill({
                body: fs.readFileSync(path.join(mediaRoot, "segment00.ts")),
                contentType: "video/mp2t",
                headers,
            });
        }
        return url.origin === local
            ? route.continue()
            : route.abort("blockedbyclient");
    });
    await context.routeWebSocket("**/*", (socket) => socket.close());
    await context.addInitScript((tv) => {
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () {
            this.muted = true;
            return play.call(this);
        };
        localStorage.setItem("ottplaylang", "_eng");
        localStorage.setItem("ottplayprov", "m3u");
        localStorage.setItem(
            "m3um3uArr",
            JSON.stringify({ active: 0, M3Us: [{ www: tv }] })
        );
    }, PLAYLIST);
    await page.goto("/f/pc/");
    await page.waitForFunction(() => window.commandChannelsReady === true);
    await page.keyboard.press("Shift");
    await page.evaluate((token) => {
        window.stbStop();
        window.setPlayerMode(1);
        const start = Math.floor(Date.now() / 1000) - 10800;
        window.epgArray = [
            { name: "First programme", time: start, time_to: start + 120 },
            { name: "Next programme", time: start + 120, time_to: start + 240 },
        ];
        if (!window.__ottClassicArchive.open(start))
            throw Error("Archive fixture did not open");
        window.__ottCommandServer.configure({
            address: location.origin + "/archive-controller",
            enabled: true,
            token,
        });
    }, DEVICE_TOKEN);
    async function rpc(action, params = {}) {
        const id = String(++sequence).padStart(32, "0");
        pending.push({ action, id, params });
        await expect.poll(() => results.has(id)).toBe(true);
        const result = results.get(id);
        expect(result.status).toBe("ok");
        return result.data;
    }
    try {
        await page.waitForFunction(
            () =>
                window.__ottClassicPlayback.snapshot().phase === "playing" &&
                document.getElementById("video").currentTime > 0
        );
        await rpc("playback", { operation: "pause" });
        await page.waitForFunction(
            () =>
                document.getElementById("video").paused &&
                window.__ottClassicPlayback.snapshot().phase === "paused"
        );
        const caps = await rpc("capabilities");
        expect(caps.playback_seek_relative).toBeUndefined();
        expect(caps.playback_seek_archive_relative).toEqual({ version: 1 });
        for (const offset of [
            60, -10, 180, 0.5, -9007199254740991, 9007199254740991,
        ]) {
            const result = await rpc("playback", {
                offset,
                operation: "seek_relative",
                timeline: "archive",
            });
            expect(result.timeline).toBe("archive");
            const rounded = Math.floor(result.from + offset);
            expect(result.position).toBe(
                Math.max(result.earliest, Math.min(result.latest, rounded))
            );
            expect(result.clamped).toBe(result.position !== rounded);
            await expect.poll(() => urls.includes(result.position)).toBe(true);
            await page.waitForFunction((epoch) => {
                const state = window.__ottClassicPlayback.snapshot(),
                    video = document.getElementById("video");
                return (
                    state.target.kind === "archive" &&
                    state.target.archiveStart === epoch &&
                    state.phase === "paused" &&
                    video.paused &&
                    video.readyState >= 2
                );
            }, result.position);
        }
        expect(errors).toEqual([]);
    } finally {
        await page.evaluate(() => {
            window.__ottCommandServer.configure({ enabled: false });
            window.stbStop();
        });
    }
});
