const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("../helpers/browser-test.cjs");
const installShakaLifecycleDiagnostics = require("./shaka-lifecycle-diagnostics.cjs");
const observeAspectReadiness = require("../helpers/aspect-readiness-diagnostics.cjs");

// Serialized by Playwright: keep this predicate self-contained.
function aspectMediaReady({ engine, previous, target }) {
    const media = window.video;
    if (media?.error)
        throw new Error(
            "Decoder error " + media.error.code + ": " + media.error.message
        );
    if (window.__ottMedia?.current()?.ref.itemId !== target || !media)
        return false;
    let source;
    if (engine === "html5") source = media.currentSrc;
    else if (engine === "hls.js") {
        if (window.hlsInstance?.media !== media) return false;
        source = window.hlsInstance.url;
    } else if (engine === "shaka") {
        if (window.player?.getMediaElement() !== media) return false;
        source = window.player.getAssetUri();
    } else {
        const player = window.videojs?.getPlayer("video");
        if (player?.tech({ IWillNotUseThisInPlugins: true }).el() !== media)
            return false;
        source = player.currentSource()?.src;
    }
    const expectedPath = JSON.parse(target.slice("request:".length)).path;
    let requested;
    let attached;
    try {
        requested = new URL(source, window.location.href);
        attached = new URL(media.currentSrc, window.location.href);
    } catch (_) {
        return false;
    }
    const session = requested.searchParams.get("session");
    if (requested.searchParams.get("path") !== expectedPath || !session)
        return false;
    if (attached.protocol === "blob:") {
        // New MediaSource engines must not borrow the previous film's decoder.
        if (
            previous &&
            previous.target !== target &&
            previous.currentSrc === media.currentSrc
        )
            return false;
    } else if (
        attached.searchParams.get("path") !== expectedPath ||
        attached.searchParams.get("session") !== session
    )
        return false;
    return (
        media.videoWidth === 640 &&
        media.videoHeight === 360 &&
        media.readyState >= 2 &&
        media.currentTime > 0.1
    );
}

const plex = "https://plex.fixture";
const token = "fixture-plex-secret";
const mediaRoot = path.resolve(__dirname, "../fixtures/media-runtime");
test.use({
    launchOptions: async ({ browserName }, use) => {
        await use(
            browserName === "chromium"
                ? { args: ["--autoplay-policy=no-user-gesture-required"] }
                : {}
        );
    },
});

for (const language of ["_eng", "_rus"]) {
    test(
        "Plex shows a localized animated loader through slow startup and reload: " +
            language,
        async ({ page, context, baseURL }) => {
            const local = new URL(baseURL).origin;
            const pending = [];
            await context.route("**/*", async (route) => {
                const url = new URL(route.request().url());
                if (url.origin === local) return route.continue();
                if (
                    url.origin === plex &&
                    url.pathname === "/library/sections"
                ) {
                    pending.push(route);
                    return;
                }
                return route.abort();
            });
            await context.routeWebSocket("**/*", (socket) => socket.close());
            await context.addInitScript(
                ({ language, plex, token }) => {
                    localStorage.setItem("ottplaylang", language);
                    localStorage.setItem("ottplayprov", "plex");
                    localStorage.setItem(
                        "plexcfg",
                        JSON.stringify({ address: plex, token })
                    );
                },
                { language, plex, token }
            );
            await page.goto("/f/pc/");
            await expect.poll(() => pending.length).toBe(1);
            const dialog = page.locator("#dialogbox");
            const spinner = dialog.locator(".ott-spinner");
            const waitText =
                language === "_rus"
                    ? "Загрузка. Подождите…"
                    : "Loading… please wait…";
            const connectionText =
                language === "_rus"
                    ? "Подключение к Plex…"
                    : "Connecting to Plex…";
            const retryText =
                language === "_rus"
                    ? "Сервер недоступен. Повторяем автоматически; проверьте адрес и доступ к сети."
                    : "Server unavailable. Retrying automatically; check its address and network access.";
            const phase = dialog.locator("[data-load-phase]");
            async function expectSinglePhase(text) {
                await expect(phase).toHaveCount(1);
                await expect(phase).toHaveText(text);
                await expect(dialog).not.toContainText(waitText);
                await expect(
                    dialog.locator("[data-provider-loading-detail]")
                ).toHaveCount(0);
                expect(
                    await dialog.evaluate(
                        (element, value) =>
                            element.textContent.split(value).length - 1,
                        text
                    )
                ).toBe(1);
            }
            await expect(dialog).toBeVisible();
            await expectSinglePhase(connectionText);
            await expect(spinner).toBeVisible();
            await expect(page.locator("#launch")).toBeHidden();
            const transform = await spinner.evaluate(
                (element) => getComputedStyle(element).transform
            );
            await expect
                .poll(() =>
                    spinner.evaluate(
                        (element) => getComputedStyle(element).transform
                    )
                )
                .not.toBe(transform);
            // The provider can legitimately take longer than the legacy three-second fallback.
            await page.waitForTimeout(3500);
            await expect(spinner).toBeVisible();
            await page.screenshot({
                path: test.info().outputPath("plex-loading.png"),
            });
            await pending[0].fulfill({
                body: "Temporarily unavailable",
                headers: { "access-control-allow-origin": "*" },
                status: 503,
            });
            await expect(spinner).toBeVisible();
            await expectSinglePhase(retryText);
            await expect.poll(() => pending.length).toBe(2);
            await expect(spinner).toBeVisible();
            await pending[1].fulfill({
                headers: { "access-control-allow-origin": "*" },
                json: {
                    MediaContainer: {
                        Directory: [
                            { key: "7", title: "My library", type: "movie" },
                        ],
                    },
                },
            });
            // Startup discovers the catalog without entering folder selection.
            await expect.poll(() => pending.length).toBe(3);
            await pending[2].fulfill({
                headers: { "access-control-allow-origin": "*" },
                json: {
                    MediaContainer: { Directory: [], size: 0, totalSize: 0 },
                },
            });
            await expect(dialog).toBeHidden();
            await expect(page.locator("#listCaption")).not.toHaveText(
                "Folders"
            );
            await page.evaluate(() => window.loadChannels());
            await expect.poll(() => pending.length).toBe(4);
            await expect(spinner).toBeVisible();
            await expectSinglePhase(connectionText);
            await page.waitForTimeout(3500);
            await expect(spinner).toBeVisible();
            await pending[3].fulfill({
                body: "Unauthorized",
                headers: { "access-control-allow-origin": "*" },
                status: 401,
            });
            await expect(spinner).toBeHidden();
            const settingsText = await page.evaluate(() =>
                window._("Plex settings")
            );
            await expect(page.locator("#listCaption")).toHaveText(settingsText);
        }
    );
}

for (const format of ["JSON", "XML"]) {
    test(
        "Plex account sign-in selects a server without retaining the account token: " +
            format,
        async ({ page, context, baseURL }) => {
            const local = new URL(baseURL).origin;
            const accountToken = "fixture-account-access";
            const serverToken = "fixture-server-access";
            await context.route("**/*", async (route) => {
                const url = new URL(route.request().url());
                const headers = { "access-control-allow-origin": "*" };
                if (url.origin === local) return route.continue();
                if (
                    url.origin === "https://plex.tv" ||
                    url.origin === "https://clients.plex.tv"
                ) {
                    if (url.pathname === "/api/v2/pins")
                        return route.fulfill({
                            headers,
                            json: { code: "ABCD", expiresIn: 900, id: 7 },
                        });
                    if (url.pathname === "/api/v2/pins/7")
                        return route.fulfill({
                            headers,
                            json: {
                                authToken: accountToken,
                                code: "ABCD",
                                expiresIn: 900,
                                id: 7,
                            },
                        });
                    if (url.pathname === "/api/v2/resources")
                        return route.fulfill({
                            headers,
                            json: [
                                {
                                    accessToken: serverToken,
                                    clientIdentifier: "fixture-server",
                                    connections: [
                                        {
                                            local: false,
                                            relay: false,
                                            uri: plex,
                                        },
                                    ],
                                    name: "Fixture server",
                                    owned: true,
                                    provides: "server",
                                },
                            ],
                        });
                }
                if (url.origin === plex) {
                    if (url.pathname === "/library/sections/7/all")
                        return route.fulfill({
                            headers,
                            json: {
                                MediaContainer: {
                                    Metadata: [],
                                    size: 0,
                                    totalSize: 0,
                                },
                            },
                        });
                    if (url.pathname === "/identity") {
                        expect(url.searchParams.get("X-Plex-Token")).toBeNull();
                        expect(
                            route.request().headers()["x-plex-token"]
                        ).toBeUndefined();
                        return route.fulfill({
                            headers,
                            ...(format === "XML"
                                ? {
                                      body: '<MediaContainer machineIdentifier="fixture-server"/>',
                                      contentType: "application/xml",
                                  }
                                : {
                                      json: {
                                          MediaContainer: {
                                              machineIdentifier:
                                                  "fixture-server",
                                          },
                                      },
                                  }),
                        });
                    }
                    if (url.pathname === "/library/sections")
                        return route.fulfill({
                            headers,
                            ...(format === "XML"
                                ? {
                                      body: '<MediaContainer size="1"><Directory key="7" title="Account library" type="movie"/></MediaContainer>',
                                      contentType: "application/xml",
                                  }
                                : {
                                      json: {
                                          MediaContainer: {
                                              Directory: [
                                                  {
                                                      key: "7",
                                                      title: "Account library",
                                                      type: "movie",
                                                  },
                                              ],
                                          },
                                      },
                                  }),
                        });
                }
                return route.abort();
            });
            await context.routeWebSocket("**/*", (socket) => socket.close());
            await context.addInitScript(() => {
                localStorage.setItem("ottplaylang", "_eng");
                localStorage.setItem("ottplayprov", "plex");
            });
            await page.goto("/f/pc/");
            await expect(page.locator("body")).toContainText(
                "Sign in with Plex"
            );
            await page.evaluate(() => {
                window.selIndex = 0;
                window.listKeyHandler(window.keys.ENTER);
            });
            await page.waitForFunction(() =>
                window.listArray?.some((row) =>
                    String(row).includes("Fixture server")
                )
            );
            await page.evaluate(() => {
                window.selIndex = window.listArray.findIndex((row) =>
                    String(row).includes("Fixture server")
                );
                window.listKeyHandler(window.keys.ENTER);
            });
            await page.waitForFunction(() =>
                window.__ottActiveProviderDriver?.libraryReady()
            );
            const stored = await page.evaluate(() =>
                Object.fromEntries(
                    Object.keys(localStorage).map((key) => [
                        key,
                        localStorage.getItem(key),
                    ])
                )
            );
            expect(JSON.parse(stored.plexcfg)).toMatchObject({
                address: plex,
                token: serverToken,
            });
            expect(JSON.stringify(stored)).not.toContain(accountToken);
        }
    );
}

// Exercise the actual channel-style provider UI, including production routing.
async function openPlexChannels(page) {
    await page.waitForFunction(
        () =>
            window.__ottActiveProviderDriver?.libraryReady() &&
            window.providerMediaClient &&
            !window.__ottActiveProviderDriver.catalogLoading()
    );
    await page.evaluate(() => {
        window.stbStop();
        window.closeList();
        window.__ottMedia.useSource(null);
        window.__ottMedia.open(null);
    });
    await expect(page.locator("#listCaption")).toContainText(
        await page.evaluate(() => window._("Channel list. Category: "))
    );
    await expect(page.locator("#mediaPlaybackControls")).toHaveCount(0);
    await expect(page.locator("#listPodval")).not.toContainText("Filter");
}

async function selectPlexChannel(page, title) {
    await page.waitForFunction(
        (title) =>
            window.listArray?.some((id) => {
                const row = window.channels[id];
                return (
                    row &&
                    (row.channel_name === title ||
                        row.__ottMediaItem?.title === title)
                );
            }),
        title
    );
    const index = await page.evaluate((title) => {
        const index = window.listArray.findIndex((id) => {
            const row = window.channels[id];
            return (
                row &&
                (row.channel_name === title ||
                    row.__ottMediaItem?.title === title)
            );
        });
        if (window.selIndex !== index) window.setSelect(index);
        return index;
    }, title);
    await page.locator("#it" + index).focus();
    await page.keyboard.press("Enter");
}

test("Plex load failure preserves a restored strict kiosk until remote unlock", async ({
    page,
    context,
    baseURL,
}) => {
    const local = new URL(baseURL).origin;
    const pending = [],
        replies = [],
        errors = [];
    let failLoad = false,
        failedLoads = 0,
        sequence = 0;
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/*", (route) => {
        const request = route.request(),
            url = new URL(request.url());
        if (url.origin !== local) return route.abort();
        if (url.pathname.startsWith("/fixture-control/")) {
            // This legacy controller does not implement notification delivery.
            if (url.pathname.endsWith("/api/notifications"))
                return route.fulfill({ status: 404 });
            if (request.method() === "POST") {
                if (url.pathname.endsWith("/responses"))
                    replies.push(request.postDataJSON());
                return route.fulfill({ json: { status: "ok" } });
            }
            const next = pending.shift(),
                now = Date.now() / 1000;
            return route.fulfill({
                json: {
                    commands: [],
                    requests: next
                        ? [
                              {
                                  ...next,
                                  expires_at: now + 40,
                                  id: String(++sequence).padStart(32, "0"),
                              },
                          ]
                        : [],
                    server_time: now,
                },
            });
        }
        const json = (body) =>
            route.fulfill({ json: { MediaContainer: body } });
        if (url.pathname === "/library/sections") {
            if (failLoad) {
                failedLoads++;
                return route.fulfill({ body: "Unauthorized", status: 401 });
            }
            return json({
                Directory: [
                    { key: "7", title: "Kiosk library", type: "movie" },
                ],
            });
        }
        if (url.pathname === "/library/sections/7/all")
            return json({
                Metadata: [
                    { ratingKey: "42", title: "Kiosk film", type: "movie" },
                ],
                size: 1,
                totalSize: 1,
            });
        if (url.pathname === "/library/sections/7/folder")
            return json({
                Metadata: [
                    { ratingKey: "42", title: "Kiosk film", type: "movie" },
                ],
                offset: 0,
                size: 1,
                totalSize: 1,
            });
        if (url.pathname === "/library/metadata/42")
            return json({
                Metadata: [
                    {
                        Media: [
                            {
                                audioCodec: "aac",
                                container: "mpegts",
                                Part: [{ key: "/library/parts/42/file.ts" }],
                                videoCodec: "h264",
                            },
                        ],
                        ratingKey: "42",
                        title: "Kiosk film",
                        type: "movie",
                    },
                ],
            });
        if (url.pathname.endsWith("/decision"))
            return json({
                generalDecisionCode: 1001,
                Metadata: [{ Media: [{ Part: [{ decision: "transcode" }] }] }],
            });
        if (url.pathname.endsWith("/stop") || url.pathname.endsWith("/ping"))
            return route.fulfill({ body: "" });
        return route.continue();
    });
    await context.routeWebSocket("**/*", (socket) => socket.close());
    await context.addInitScript(
        ({ local }) => {
            if (!localStorage.getItem("ottplayprov")) {
                localStorage.setItem("ottplaylang", "_eng");
                localStorage.setItem("ottplayprov", "plex");
                localStorage.setItem(
                    "plexcfg",
                    JSON.stringify({
                        address: local,
                        folders: [
                            {
                                path: "/library/sections/7/folder",
                                title: "Kiosk library",
                            },
                        ],
                        playback: "compatible",
                        token: "synthetic-kiosk-token",
                    })
                );
            }
            const play = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function () {
                this.muted = true;
                this.loop = true;
                return play.call(this);
            };
        },
        { local }
    );
    await page.goto("/f/pc/");
    await page.keyboard.press("Shift");
    await openPlexChannels(page);
    await selectPlexChannel(page, "Kiosk film");
    await page.waitForFunction(
        () =>
            window.__ottClassicPlayback.snapshot().phase === "playing" &&
            window.video.currentTime > 0.2
    );
    await page.evaluate(() =>
        window.__ottCommandServer.configure({
            address: location.origin + "/fixture-control",
            enabled: true,
            token: "SYNTHETIC_COMMAND_TOKEN_0123456789abcdef",
        })
    );
    async function kiosk(params) {
        const count = replies.length;
        pending.push({ action: "kiosk", params });
        await expect.poll(() => replies.length).toBe(count + 1);
        expect(replies[count].status).toBe("ok");
        return replies[count].data;
    }
    expect(
        await kiosk({ mode: "on", query: "Kiosk film", strict: true })
    ).toMatchObject({
        channel: { id: "plex-42" },
        provider: "plex",
        state: "locked",
        strict: true,
    });
    const saved = await page.evaluate(() => ({
        credentials: window.stbGetPersistedItem("plexcfg"),
        policy: window.stbGetPersistedItem("__ottKioskV1"),
    }));
    expect(JSON.parse(saved.policy)).toMatchObject({
        provider: "plex",
        strict: true,
    });
    failLoad = true;
    await page.reload();
    await expect.poll(() => failedLoads).toBe(1);
    expect(await kiosk({ mode: "status" })).toMatchObject({
        channel: { id: "plex-42" },
        provider: "plex",
        state: "locked",
        strict: true,
    });
    await expect(page.locator("html")).toHaveClass(/ott-kiosk-strict/);
    await expect(page.locator("#dialogbox")).toBeHidden();
    await expect(page.locator("#list_window")).toBeHidden();
    expect(await page.evaluate(() => window.commandChannelsReady)).toBe(false);
    expect(await page.evaluate(() => window.__ottEditProvider())).toBe(false);
    await expect(page.locator("#list_window")).toBeHidden();
    expect(
        await page.evaluate(() => ({
            credentials: window.stbGetPersistedItem("plexcfg"),
            policy: window.stbGetPersistedItem("__ottKioskV1"),
        }))
    ).toEqual(saved);
    expect(await kiosk({ mode: "off" })).toMatchObject({
        state: "off",
        strict: false,
    });
    await expect(page.locator("html")).not.toHaveClass(/ott-kiosk-strict/);
    expect(await page.evaluate(() => window.__ottEditProvider())).toBe(true);
    await expect(page.locator("#listCaption")).toHaveText("Plex settings");
    await expect(page.locator("#list_window")).toBeVisible();
    await expect(page.locator("#dialogbox")).toBeHidden();
    expect(errors).toEqual([]);
});

const touchTest = test.extend({ hasTouch: true });

touchTest(
    "Plex native channel selection shows an owned wait, cancels and retries resolution",
    async ({ page, context, baseURL }) => {
        const local = new URL(baseURL).origin;
        const title = "Винни-Пух <тест>";
        const rows = [
            { ratingKey: "42", title, type: "movie" },
            { ratingKey: "43", title: "Following film", type: "movie" },
        ];
        const collections = [],
            metadata = [],
            errors = [];
        let hold = false;
        page.on("pageerror", (error) => errors.push(error.message));
        const headers = { "access-control-allow-origin": "*" };
        const folder = (route) =>
            route.fulfill({
                headers,
                json: {
                    MediaContainer: {
                        Metadata: rows,
                        offset: 0,
                        size: 2,
                        totalSize: 2,
                    },
                },
            });
        await context.route("**/*", (route) => {
            const url = new URL(route.request().url());
            if (url.origin === local) return route.continue();
            if (url.origin !== plex) return route.abort();
            if (url.pathname === "/library/sections")
                return route.fulfill({
                    headers,
                    json: {
                        MediaContainer: {
                            Directory: [
                                {
                                    key: "7",
                                    title: "My library",
                                    type: "movie",
                                },
                            ],
                        },
                    },
                });
            if (url.pathname === "/library/sections/7/all")
                return route.fulfill({
                    headers,
                    json: {
                        MediaContainer: {
                            Metadata: rows,
                            size: 2,
                            totalSize: 2,
                        },
                    },
                });
            if (url.pathname === "/library/sections/7/folder") {
                if (hold) {
                    collections.push(route);
                    return;
                }
                return folder(route);
            }
            if (/^\/library\/metadata\/\d+$/.test(url.pathname)) {
                if (hold) {
                    metadata.push(route);
                    return;
                }
                return route.fulfill({
                    headers,
                    json: {
                        MediaContainer: {
                            Metadata: [
                                {
                                    ...rows[0],
                                    Media: [
                                        {
                                            audioCodec: "mp3",
                                            container: "avi",
                                            Part: [
                                                {
                                                    key: "/library/parts/42/file.avi",
                                                },
                                            ],
                                            videoCodec: "mpeg4",
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                });
            }
            if (url.pathname.endsWith("/decision"))
                return route.fulfill({
                    headers,
                    json: {
                        MediaContainer: {
                            generalDecisionCode: 1001,
                            Metadata: [
                                {
                                    Media: [
                                        { Part: [{ decision: "transcode" }] },
                                    ],
                                },
                            ],
                        },
                    },
                });
            if (url.pathname.endsWith("/start.m3u8"))
                return route.fulfill({
                    body:
                        "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-PLAYLIST-TYPE:VOD\n" +
                        Array.from(
                            { length: 15 },
                            (_, index) =>
                                (index ? "#EXT-X-DISCONTINUITY\n" : "") +
                                "#EXTINF:2.000000,\nsegment00.ts?n=" +
                                index +
                                "\n"
                        ).join("") +
                        "#EXT-X-ENDLIST\n",
                    contentType: "application/vnd.apple.mpegurl",
                    headers,
                });
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
                return route.fulfill({ body: "", headers, status: 200 });
            return route.fulfill({
                body: "missing fixture route",
                headers,
                status: 404,
            });
        });
        await context.routeWebSocket("**/*", (socket) => socket.close());
        await context.addInitScript(
            ({ plex, token }) => {
                localStorage.setItem("ottplaylang", "_rus");
                localStorage.setItem("ottplayprov", "plex");
                localStorage.setItem(
                    "plexcfg",
                    JSON.stringify({
                        address: plex,
                        playback: "compatible",
                        token,
                    })
                );
                const play = HTMLMediaElement.prototype.play;
                HTMLMediaElement.prototype.play = function () {
                    this.muted = true;
                    return play.call(this);
                };
            },
            { plex, token }
        );
        await page.goto("/f/pc/");
        await page.keyboard.press("Shift");
        await openPlexChannels(page);
        await expect(page.locator("#list")).toContainText(title);
        const beforeCancelled = await page.evaluate(() => ({
            generation: window.__ottClassicPlayback.snapshot().generation,
            phase: window.__ottClassicPlayback.snapshot().phase,
            ref: window.__ottMedia.current()?.ref,
        }));
        hold = true;
        await selectPlexChannel(page, title);
        await expect.poll(() => metadata.length).toBe(1);
        const dialog = page.locator("#dialogbox");
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText("Загрузка. Подождите…");
        await expect(dialog.locator(".ott-spinner")).toBeVisible();
        await expect(dialog).toBeFocused();
        const selected = await page.evaluate(() => window.selIndex);
        for (const key of ["ArrowDown", "ArrowUp", "Enter"])
            await page.keyboard.press(key);
        await expect(dialog).toBeVisible();
        await expect(page.locator("#list_window")).toBeHidden();
        expect(await page.evaluate(() => window.selIndex)).toBe(selected);
        expect(metadata).toHaveLength(1);
        await expect(page.locator("#mediaPlaybackControls")).toHaveCount(0);
        await page.keyboard.press("Backspace");
        await expect(dialog).toBeHidden();
        await metadata[0].fulfill({ headers, json: { MediaContainer: {} } });
        expect(
            await page.evaluate(() => ({
                generation: window.__ottClassicPlayback.snapshot().generation,
                phase: window.__ottClassicPlayback.snapshot().phase,
                ref: window.__ottMedia.current()?.ref,
            }))
        ).toEqual(beforeCancelled);
        await selectPlexChannel(page, title);
        for (let attempt = 0; attempt < 3; attempt++) {
            await expect.poll(() => metadata.length).toBe(attempt + 2);
            await expect(dialog.locator(".ott-spinner")).toBeVisible();
            await metadata[attempt + 1].fulfill({
                body: "Unavailable",
                headers,
                status: 503,
            });
        }
        await expect(dialog).toContainText(
            await page.evaluate(() => window._("Plex connection failed"))
        );
        await expect(dialog.locator(".ott-spinner")).toHaveCount(0);
        await page.keyboard.press("Enter");
        await expect(dialog).toBeHidden();
        await selectPlexChannel(page, title);
        await expect.poll(() => metadata.length).toBe(5);
        await metadata[4].fulfill({
            headers,
            json: {
                MediaContainer: {
                    Metadata: [
                        {
                            ...rows[0],
                            Media: [
                                {
                                    audioCodec: "mp3",
                                    container: "avi",
                                    Part: [
                                        { key: "/library/parts/42/file.avi" },
                                    ],
                                    videoCodec: "mpeg4",
                                },
                            ],
                        },
                    ],
                },
            },
        });
        await page.waitForFunction(
            () =>
                window.__ottClassicPlayback.snapshot().phase === "playing" &&
                window.video.currentTime > 0.2 &&
                !window.video.error
        );
        await expect(dialog).toBeHidden();
        await expect(page.locator("#buffering")).toBeHidden();
        await expect(page.locator("#list_window")).toBeHidden();
        expect(collections).toHaveLength(0);
        expect(errors).toEqual([]);
    }
);

test("Plex native channels preserve seek, resume, Actions order and access URL privacy", async ({
    page,
    context,
    baseURL,
}) => {
    const local = new URL(baseURL).origin;
    const requests = [];
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === local) return route.continue();
        if (url.origin !== plex) return route.abort();
        requests.push(url.pathname);
        const headers = { "access-control-allow-origin": "*" };
        const json = (body) =>
            route.fulfill({ headers, json: { MediaContainer: body } });
        if (url.pathname === "/library/sections")
            return json({
                Directory: [{ key: "7", title: "My library", type: "movie" }],
            });
        if (url.pathname === "/library/sections/7/all")
            return json({
                Metadata: [
                    {
                        ratingKey: "42",
                        title: "  ",
                        titleSort: "Test film",
                        type: "movie",
                    },
                    { ratingKey: "43", title: "Following film", type: "movie" },
                ],
                size: 2,
                totalSize: 2,
            });
        if (/^\/library\/metadata\/(42|43)$/.test(url.pathname))
            return json({
                Metadata: [
                    {
                        Media: [
                            {
                                audioCodec: "mp3",
                                container: "avi",
                                Part: [{ key: "/library/parts/42/file.avi" }],
                                videoCodec: "mpeg4",
                            },
                        ],
                        ratingKey: url.pathname.split("/").pop(),
                        type: "movie",
                    },
                ],
            });
        if (url.pathname.endsWith("/decision")) {
            return json({
                generalDecisionCode: 1001,
                Metadata: [{ Media: [{ Part: [{ decision: "transcode" }] }] }],
            });
        }
        if (url.pathname.endsWith("/start.m3u8"))
            return route.fulfill({
                body:
                    "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-PLAYLIST-TYPE:VOD\n" +
                    Array.from(
                        { length: 30 },
                        (_, index) =>
                            (index ? "#EXT-X-DISCONTINUITY\n" : "") +
                            "#EXTINF:2.000000,\nsegment00.ts?segment=" +
                            index +
                            "\n"
                    ).join("") +
                    "#EXT-X-ENDLIST\n",
                contentType: "application/vnd.apple.mpegurl",
                headers,
            });
        if (url.pathname.endsWith(".ts"))
            return route.fulfill({
                body: fs.readFileSync(path.join(mediaRoot, "segment00.ts")),
                contentType: "video/mp2t",
                headers,
            });
        if (url.pathname.endsWith("/stop") || url.pathname.endsWith("/ping"))
            return route.fulfill({ body: "", headers, status: 200 });
        return route.fulfill({
            body: "missing fixture route",
            headers,
            status: 404,
        });
    });
    await context.routeWebSocket("**/*", (socket) => socket.close());
    await context.addInitScript(
        ({ plex, token }) => {
            // Silent AAC can stall Chromium's audio clock without OS output.
            // Muting each attempt also covers the real page reload below.
            const play = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function () {
                this.muted = true;
                return play.call(this);
            };
            localStorage.setItem("ottplaylang", "_eng");
            localStorage.setItem("ottplayprov", "plex");
            localStorage.setItem(
                "plexcfg",
                JSON.stringify({ address: plex, playback: "compatible", token })
            );
        },
        { plex, token }
    );
    await page.goto("/f/pc/");
    await page.keyboard.press("Shift");
    await openPlexChannels(page);
    expect(
        await page.locator("#listIn .ott-channel-number").allTextContents()
    ).toEqual(["1", "2"]);
    await expect(page.locator("#listIn")).toContainText("Test film");
    const original = await page.evaluate(() => window.listArray.slice());
    await page.getByRole("button", { exact: true, name: "Actions" }).click();
    await page.getByRole("button", { exact: true, name: /Shuffle/ }).click();
    expect(
        (await page.evaluate(() => window.listArray.slice())).sort()
    ).toEqual(original.slice().sort());
    await expect(page.locator("#listPopUp")).toBeVisible();
    await page
        .getByRole("button", { exact: true, name: /Reset order/ })
        .click();
    expect(await page.evaluate(() => window.listArray.slice())).toEqual(
        original
    );
    await page.getByRole("button", { exact: true, name: "Actions" }).click();
    await selectPlexChannel(page, "Test film");
    await page.waitForFunction(
        () =>
            window.__ottClassicPlayback.snapshot().phase === "playing" &&
            window.video.currentTime > 0.2 &&
            !window.video.error
    );
    const state = await page.evaluate(() => ({
        current: window.__ottMedia.current()?.payload.__ottPlexPlayback.type,
        journals: Object.keys(localStorage)
            .filter((key) => key.includes("mediaJournal.v1:"))
            .map((key) => localStorage.getItem(key)),
        provider: localStorage.getItem("ottplayprov"),
    }));
    expect(state.provider).toBe("plex");
    expect(state.current).toBe("hls");
    expect(state.journals.length).toBeGreaterThan(0);
    expect(JSON.stringify(state.journals)).not.toContain(token);
    expect(JSON.stringify(state.journals)).not.toContain("start.m3u8");
    expect(requests).toContain("/video/:/transcode/universal/decision");
    // Desktop modifier arrows seek even with saved volume bindings; plain
    // arrows remain available to menus and dialogs. Exercise the real router.
    const arrow = (key, keyCode, altKey = false) =>
        page.evaluate(
            ({ key, keyCode, altKey }) =>
                document.dispatchEvent(
                    new KeyboardEvent("keydown", {
                        altKey,
                        bubbles: true,
                        cancelable: true,
                        code: key,
                        key,
                        keyCode,
                        which: keyCode,
                    })
                ),
            { altKey, key, keyCode }
        );
    const playbackIdentity = () =>
        page.evaluate(() => ({
            generation: window.__ottClassicPlayback.snapshot().generation,
            ref: window.__ottMedia.current().ref,
            trail: window.__ottMedia
                .snapshot()
                .frames.map((frame) => frame.route.title),
            volume: document.querySelector("video").volume,
        }));
    const savedBindings = await page.evaluate(() => {
        const saved = [window.sALfun, window.sARfun, window.sArrowFun];
        window.sALfun = 14;
        window.sARfun = 13;
        window.sArrowFun = 0;
        window.closeList();
        document.querySelector("video").volume = 0.42;
        return saved;
    });
    const beforeSeek = await playbackIdentity();
    for (const [key, keyCode, position] of [
        ["ArrowLeft", 37, 15],
        ["ArrowRight", 39, 35],
    ]) {
        await page.evaluate(() => {
            const video = document.querySelector("video");
            video.pause();
            video.currentTime = 25;
        });
        await page.waitForFunction(() => {
            const video = document.querySelector("video");
            return !video.seeking && Math.abs(video.currentTime - 25) < 0.05;
        });
        await arrow(key, keyCode, true);
        expect(await playbackIdentity()).toEqual(beforeSeek);
        await page.waitForFunction((position) => {
            const video = document.querySelector("video");
            return (
                !video.seeking && Math.abs(video.currentTime - position) < 0.2
            );
        }, position);
        expect(await playbackIdentity()).toEqual(beforeSeek);
        await expect(page.locator("#list")).toBeHidden();
        await expect(page.locator("#dialogbox")).toBeHidden();
        await expect(page.locator("#listPopUp")).toBeHidden();
    }
    // Visible list/dialog owners still receive arrows without seeking the
    // underlying paused movie or falling through to the volume bindings.
    await page.evaluate(() => window.__ottMedia.open(null));
    await expect(page.locator("#listCaption")).toContainText("Channel list");
    for (const [key, keyCode] of [
        ["ArrowLeft", 37],
        ["ArrowRight", 39],
    ])
        await arrow(key, keyCode);
    await expect(page.locator("#list")).toBeVisible();
    expect(await playbackIdentity()).toEqual(beforeSeek);
    expect(
        await page.evaluate(() => document.querySelector("video").currentTime)
    ).toBeCloseTo(35, 1);
    await page.evaluate(() => {
        window.closeList();
        window.showPlaybackSeekDialog(0);
    });
    await expect(page.locator("#dialogbox")).toBeVisible();
    await arrow("ArrowRight", 39);
    await expect(page.locator("#step")).toContainText("10");
    expect(
        await page.evaluate(() => document.querySelector("video").currentTime)
    ).toBeCloseTo(35, 1);
    await arrow("ArrowLeft", 37);
    await page.keyboard.press("Escape");
    await expect(page.locator("#dialogbox")).toBeHidden();
    expect(await playbackIdentity()).toEqual(beforeSeek);
    expect(
        await page.evaluate(() => document.querySelector("video").currentTime)
    ).toBeCloseTo(35, 1);
    await page.evaluate(([left, right, listArrows]) => {
        window.sALfun = left;
        window.sARfun = right;
        window.sArrowFun = listArrows;
    }, savedBindings);
    await page.evaluate(() => {
        const video = document.querySelector("video");
        video.pause();
        video.currentTime = 12.375;
    });
    await page.waitForFunction(() => {
        const video = document.querySelector("video");
        return !video.seeking && Math.abs(video.currentTime - 12.375) < 0.05;
    });
    const bookmark = await page.evaluate(() => {
        window.body_onUnload();
        const key = Object.keys(localStorage).find((key) =>
            key.includes("mediaJournal.v1:")
        );
        return JSON.parse(localStorage.getItem(key)).history[0];
    });
    expect(bookmark.position).toBeCloseTo(12.375, 2);
    const resolvesBeforeReload = requests.filter(
        (path) => path === "/library/metadata/42"
    ).length;
    await page.reload();
    await page.keyboard.press("Shift");
    await page.waitForFunction(
        () =>
            window.__ottMedia?.current()?.payload.request.path ===
                "/library/metadata/42" &&
            window.video.currentTime >= 12.375 &&
            !window.video.error
    );
    expect(
        requests.filter((path) => path === "/library/metadata/42").length
    ).toBeGreaterThan(resolvesBeforeReload);
    await page.evaluate(() => window.closeList());
    await page.keyboard.press("ArrowUp");
    await page.waitForFunction(
        () =>
            window.__ottMedia.current()?.payload.request.path ===
                "/library/metadata/43" && window.video.currentTime > 0.2
    );
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(
        () =>
            window.__ottMedia.current()?.payload.request.path ===
                "/library/metadata/42" && window.video.currentTime > 0.2
    );
    const stopsBefore = requests.filter((path) =>
        path.endsWith("/stop")
    ).length;
    await page.evaluate(() => window.stbStop());
    await expect
        .poll(() => requests.filter((path) => path.endsWith("/stop")).length)
        .toBe(stopsBefore + 1);
    expect(errors).toEqual([]);
});

test("Plex appends native catalog pages without changing highlighted channel or category", async ({
    page,
    context,
    baseURL,
}, testInfo) => {
    const local = new URL(baseURL).origin;
    const errors = [];
    const requests = [];
    const pending = [];
    const rows = Array.from({ length: 20 }, (_, index) => ({
        ratingKey: String(100 + index),
        title: "Film " + String(index + 1).padStart(2, "0"),
        type: "movie",
    }));
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin === local) return route.continue();
        if (url.origin !== plex) return route.abort();
        const headers = { "access-control-allow-origin": "*" };
        const json = (body) =>
            route.fulfill({ headers, json: { MediaContainer: body } });
        if (url.pathname === "/library/sections")
            return json({
                Directory: [{ key: "7", title: "My library", type: "movie" }],
            });
        if (url.pathname === "/library/sections/7/all") {
            const offset = Number(
                request.headers()["x-plex-container-start"] || 0
            );
            expect(
                Number(url.searchParams.get("X-Plex-Container-Start") || 0)
            ).toBe(offset);
            requests.push(offset);
            const response = {
                Metadata: rows.slice(offset, offset + (offset ? 4 : 8)),
                offset,
                size: offset ? 4 : 8,
                title2: "Folder",
                totalSize: rows.length,
            };
            if (!offset) return json(response);
            const status = await new Promise((release) =>
                pending.push({ offset, release })
            );
            try {
                if (status === 503)
                    return await route.fulfill({
                        body: "Fixture unavailable",
                        headers,
                        status,
                    });
                return await json(response);
            } catch (error) {
                if (!request.failure()) throw error;
            }
        }
        return route.fulfill({
            body: "Unexpected fixture request",
            headers,
            status: 404,
        });
    });
    await context.routeWebSocket("**/*", (socket) => socket.close());
    await context.addInitScript(
        ({ plex, token }) => {
            localStorage.setItem("ottplaylang", "_eng");
            localStorage.setItem("ottplayprov", "plex");
            localStorage.setItem(
                "plexcfg",
                JSON.stringify({ address: plex, token })
            );
        },
        { plex, token }
    );

    async function release(offset) {
        await expect
            .poll(() => pending.some((row) => row.offset === offset))
            .toBe(true);
        const index = pending.findIndex((row) => row.offset === offset);
        pending.splice(index, 1)[0].release(200);
    }
    await page.goto("/f/pc/");
    await page.keyboard.press("Shift");
    await page.waitForFunction(() => window.cList?.length === 8);
    await page.evaluate(() => {
        window.stbStop();
        window.closeList();
        window.__ottMedia.open(null);
        window.setSelect(6);
    });
    await expect(page.locator("#it6")).toHaveClass(/ott-selected/);
    expect(
        await page.locator("#listIn .ott-channel-number").allTextContents()
    ).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
    const highlighted = await page.evaluate(
        () => window.listArray[window.selIndex]
    );
    expect(highlighted).toBe("plex-106");
    await expect.poll(() => requests).toEqual([0, 8]);
    await release(8);
    await page.waitForFunction(() => window.cList.length === 12);
    expect(await page.evaluate(() => window.listArray[window.selIndex])).toBe(
        highlighted
    );
    await page.getByRole("button", { exact: true, name: "Category" }).click();
    const library = page
        .locator("#listIn .item")
        .filter({ hasText: "My library" });
    await library.click();
    await page.keyboard.press("Enter");
    await expect(page.locator("#listCaption")).toContainText("My library");
    await page.evaluate(() => window.setSelect(6));
    for (const offset of [12, 16]) {
        await release(offset);
        await page.waitForFunction(
            (length) => window.cList.length === length,
            offset + 4
        );
        expect(
            await page.evaluate(() => window.listArray[window.selIndex])
        ).toBe(highlighted);
        await expect(page.locator("#listCaption")).toContainText("My library");
    }
    await page.waitForFunction(
        () => !window.__ottActiveProviderDriver.catalogLoading()
    );
    expect(requests).toEqual([0, 8, 12, 16]);
    expect(await page.evaluate(() => window.listArray.slice())).toEqual(
        rows.map((row) => "plex-" + row.ratingKey)
    );
    await expect(page.locator("#mediaPlaybackControls")).toHaveCount(0);
    await expect(page.locator("#listIn")).not.toContainText("Next");
    await expect(page.locator("#listPodval")).not.toContainText("Filter");
    await testInfo.attach("plex-native-catalog-complete", {
        body: await page.screenshot(),
        contentType: "image/png",
    });
    expect(errors).toEqual([]);
});

for (const { engine, strict } of [
    { engine: "html5", strict: false },
    { engine: "hls.js", strict: false },
    { engine: "shaka", strict: false },
    { engine: "video.js", strict: false },
    { engine: "hls.js", strict: true },
]) {
    test(
        "Plex aspect persists through media changes and " +
            (strict ? "strict kiosk natural episode end and " : "") +
            "reload: " +
            engine,
        async ({ page, context, baseURL, browserName }) => {
            test.skip(
                engine === "html5" && browserName !== "webkit",
                "Native HLS requires WebKit"
            );
            test.setTimeout(60000);
            if (engine === "shaka")
                await context.addInitScript(installShakaLifecycleDiagnostics);
            const local = new URL(baseURL).origin;
            const errors = [];
            const films = [
                { ratingKey: "42", title: "First aspect film", type: "movie" },
                { ratingKey: "43", title: "Next aspect film", type: "movie" },
            ].map((item, index) =>
                strict
                    ? {
                          ...item,
                          grandparentTitle: "Aspect series",
                          index: index + 1,
                          parentIndex: 1,
                          title: "Aspect episode " + (index + 1),
                          type: "episode",
                      }
                    : item
            );
            page.on("pageerror", (error) => errors.push(error.message));
            await context.route("**/*", (route) => {
                const url = new URL(route.request().url());
                if (url.origin !== local) return route.abort();
                const json = (body) =>
                    route.fulfill({ json: { MediaContainer: body } });
                if (url.pathname === "/library/sections")
                    return json({
                        Directory: [
                            {
                                key: "7",
                                title: "Aspect library",
                                type: strict ? "show" : "movie",
                            },
                        ],
                    });
                if (url.pathname === "/library/sections/7/all")
                    return json({
                        Metadata: films,
                        offset: 0,
                        size: 2,
                        totalSize: 2,
                    });
                if (url.pathname === "/library/sections/7/folder")
                    return json({
                        Metadata: films,
                        offset: 0,
                        size: 2,
                        totalSize: 2,
                    });
                if (url.pathname.endsWith("/decision"))
                    return json({
                        generalDecisionCode: 1001,
                        Metadata: [
                            { Media: [{ Part: [{ decision: "transcode" }] }] },
                        ],
                    });
                if (
                    url.pathname.endsWith("/stop") ||
                    url.pathname.endsWith("/ping")
                )
                    return route.fulfill({ body: "" });
                if (/^\/library\/metadata\/(42|43)$/.test(url.pathname)) {
                    const id = url.pathname.split("/").pop();
                    return json({
                        Metadata: [
                            {
                                ...films.find((film) => film.ratingKey === id),
                                Media: [
                                    {
                                        audioCodec: "aac",
                                        container: "mpegts",
                                        Part: [
                                            {
                                                key:
                                                    "/library/parts/" +
                                                    id +
                                                    "/file.ts",
                                            },
                                        ],
                                        videoCodec: "h264",
                                    },
                                ],
                            },
                        ],
                    });
                }
                return route.continue();
            });
            await context.routeWebSocket("**/*", (socket) => socket.close());
            await context.addInitScript(
                ({ local, engine, strict }) => {
                    const play = HTMLMediaElement.prototype.play;
                    HTMLMediaElement.prototype.play = function () {
                        this.muted = true;
                        this.loop = !window.__aspectNaturalEnd;
                        return play.call(this);
                    };
                    localStorage.setItem("ottplaylang", "_eng");
                    localStorage.setItem("ottplayprov", "plex");
                    localStorage.setItem(
                        "plexsPlayers",
                        engine === "shaka"
                            ? "2"
                            : engine === "html5"
                              ? "0"
                              : "1"
                    );
                    localStorage.setItem(
                        "plexcfg",
                        JSON.stringify({
                            address: local,
                            folders: strict
                                ? [
                                      {
                                          path: "/library/sections/7/folder",
                                          title: "Aspect library",
                                      },
                                  ]
                                : undefined,
                            playback: "compatible",
                            token: "synthetic-aspect-token",
                        })
                    );
                },
                { engine, local, strict }
            );
            await page.setViewportSize({ height: 720, width: 960 });
            await page.goto(engine === "video.js" ? "/f/pc2/" : "/f/pc/");
            await page.keyboard.press("Shift");
            await openPlexChannels(page);
            await selectPlexChannel(page, films[0].title);
            let previousReadySource = null;
            async function ready(id, phase) {
                const target =
                    "request:" +
                    JSON.stringify({ path: "/library/metadata/" + id });
                return observeAspectReadiness(
                    page,
                    { engine, phase },
                    async () => {
                        await page.waitForFunction(
                            aspectMediaReady,
                            { engine, previous: previousReadySource, target },
                            { timeout: 15000 }
                        );
                        previousReadySource = await page.evaluate(
                            (target) => ({
                                currentSrc: window.video.currentSrc,
                                target,
                            }),
                            target
                        );
                        expect(
                            await page.evaluate(() => ({
                                aspect: !!window.captureAspectTarget?.(),
                                target: window.__ottMedia?.current()?.ref
                                    .itemId,
                            }))
                        ).toEqual({
                            aspect: true,
                            target,
                        });
                        await page.evaluate(() => {
                            window.stbPause();
                            window.stbToFullScreen();
                        });
                    }
                );
            }
            async function aspect() {
                return page.evaluate(() => {
                    const target = window.captureAspectTarget();
                    return (
                        target && {
                            mode: target.mode,
                            savedMode: target.savedMode,
                        }
                    );
                });
            }
            async function geometry(mode) {
                const value = await page.evaluate(() => {
                    const media = window.video;
                    const box = media.getBoundingClientRect();
                    const wrapper = document
                        .getElementById("video")
                        .getBoundingClientRect();
                    return {
                        box: {
                            height: box.height,
                            width: box.width,
                            x: box.x,
                            y: box.y,
                        },
                        height: window.innerHeight,
                        width: window.innerWidth,
                        wrapper: {
                            height: wrapper.height,
                            width: wrapper.width,
                            x: wrapper.x,
                            y: wrapper.y,
                        },
                    };
                });
                const scale = (mode === "fit" ? Math.min : Math.max)(
                    value.width / 640,
                    value.height / 360
                );
                const expected = {
                    height: Math.round(360 * scale),
                    width: Math.round(640 * scale),
                };
                expected.x = Math.round((value.width - expected.width) / 2);
                expected.y = Math.round((value.height - expected.height) / 2);
                for (const box of [value.box, value.wrapper])
                    for (const property of ["width", "height", "x", "y"])
                        expect(
                            Math.abs(box[property] - expected[property]),
                            property + " uses centered " + mode
                        ).toBeLessThanOrEqual(1);
            }
            await ready("42", "initial");
            expect(await page.evaluate(() => window.playerMode)).toBe(
                engine === "shaka" ? 2 : engine === "html5" ? 0 : 1
            );
            if (engine === "video.js")
                expect(
                    await page.evaluate(
                        () =>
                            window.videojs
                                .getPlayer("video")
                                .tech({ IWillNotUseThisInPlugins: true })
                                .el() === window.video
                    )
                ).toBe(true);
            else {
                expect(
                    await page.evaluate(() => window._corePlaybackMode)
                ).toBe(engine === "shaka" ? 2 : engine === "html5" ? 0 : 1);
                if (engine === "hls.js")
                    expect(
                        await page.evaluate(
                            () => window.hlsInstance.media === window.video
                        )
                    ).toBe(true);
                if (engine === "shaka")
                    expect(
                        await page.evaluate(
                            () =>
                                window.player.getMediaElement() === window.video
                        )
                    ).toBe(true);
            }
            // Native Plex channels use the same media aspect preferences.
            expect(await page.evaluate(() => window.cList.length)).toBe(2);
            await page.evaluate(() => window.stbToggleAspectRatio());
            await page
                .getByRole("button", { exact: true, name: "Fill screen" })
                .click();
            expect(await aspect()).toEqual({ mode: "fill", savedMode: "fill" });
            await geometry("fill");
            for (const viewport of [
                { height: 720, width: 960 },
                { height: 960, width: 720 },
            ]) {
                await page.setViewportSize(viewport);
                for (const mode of ["fit", "fill"]) {
                    expect(
                        await page.evaluate(
                            (mode) => window.captureAspectTarget().set(mode),
                            mode
                        )
                    ).toBe(true);
                    expect(await aspect()).toEqual({ mode, savedMode: mode });
                    await geometry(mode);
                }
            }
            if (strict) {
                const kiosk = await page.evaluate(
                    () =>
                        new Promise((resolve) =>
                            window.__ottKiosk.request(
                                {
                                    mode: "on",
                                    query: "Aspect episode 1",
                                    strict: true,
                                },
                                resolve
                            )
                        )
                );
                expect(kiosk.status).toBe("ok");
                expect(kiosk.data).toMatchObject({
                    channel: { id: "plex-42" },
                    strict: true,
                });
                expect(await aspect()).toEqual({
                    mode: "fill",
                    savedMode: "fill",
                });
                await page.waitForFunction(
                    () =>
                        window.__ottClassicPlayback.snapshot().phase ===
                            "playing" &&
                        Number.isFinite(window.video.duration) &&
                        window.video.duration > 0.5 &&
                        window.video.currentTime > 0.1
                );
                // Observe the real decoder event before the application's target
                // listener replays the pinned channel. Only the current attempt
                // reaches its end; the restarted attempt loops for later assertions.
                const ending = await page.evaluate(() => {
                    const media = window.video;
                    const duration = media.duration;
                    if (!Number.isFinite(duration) || duration <= 0.5)
                        throw new Error("Expected finite episode duration");
                    window.__aspectNaturalEnd = true;
                    document.addEventListener(
                        "ended",
                        function ended(event) {
                            if (event.target !== media) return;
                            document.removeEventListener("ended", ended, true);
                            const target = window.captureAspectTarget();
                            window.__aspectEnded = {
                                aspect: target && {
                                    mode: target.mode,
                                    savedMode: target.savedMode,
                                },
                                duration: media.duration,
                                ended: media.ended,
                                isTrusted: event.isTrusted,
                                itemId: window.__ottMedia.current().ref.itemId,
                                position: media.currentTime,
                                strict: window.__ottKiosk.strict(),
                            };
                            window.__aspectNaturalEnd = false;
                        },
                        true
                    );
                    media.loop = false;
                    media.currentTime = duration - 0.3;
                    window.stbResume();
                    return { duration, loop: media.loop };
                });
                expect(ending.loop).toBe(false);
                await page.waitForFunction(
                    () =>
                        window.__aspectEnded &&
                        window.__ottClassicPlayback.snapshot().phase ===
                            "playing" &&
                        window.video.currentTime < window.video.duration - 1
                );
                await ready("42", "replay");
                const ended = await page.evaluate(() => window.__aspectEnded);
                expect(ended).toMatchObject({
                    aspect: { mode: "fill", savedMode: "fill" },
                    ended: true,
                    isTrusted: true,
                    itemId: 'request:{"path":"/library/metadata/42"}',
                    strict: true,
                });
                expect(ended.position).toBeCloseTo(ending.duration, 1);
                expect(ended.duration).toBe(ending.duration);
                await test.info().attach("decoder-ended", {
                    body: JSON.stringify(ended, null, 2),
                    contentType: "application/json",
                });
                // Check the real durable pinned-channel policy before testing
                // fresh-page restoration.
                await page.waitForFunction(() => {
                    const saved = JSON.parse(
                        window.stbGetPersistedItem("__ottKioskV1") || "null"
                    );
                    return (
                        saved?.strict === true &&
                        saved.channel?.id === "plex-42"
                    );
                });
            } else {
                await page.evaluate(() => window.__ottMedia.open(null));
                await selectPlexChannel(page, films[1].title);
                await ready("43", "next");
            }
            expect(await page.evaluate(() => window.__ottKiosk.strict())).toBe(
                strict
            );
            expect(await aspect()).toEqual({ mode: "fill", savedMode: "fill" });
            await geometry("fill");
            await page.reload();
            // The TV model restores the most recently played item directly;
            // an old Media tree must not be reopened to make resume work.
            if (!strict)
                await page.waitForFunction(
                    () => window.curList?.[window.primaryIndex] === "plex-43"
                );
            await ready(strict ? "42" : "43", "reload");
            expect(await page.evaluate(() => window.__ottKiosk.strict())).toBe(
                strict
            );
            expect(await aspect()).toEqual({ mode: "fill", savedMode: "fill" });
            await geometry("fill");
            expect(errors).toEqual([]);
        }
    );
}

for (const variant of ["pc", "generic"]) {
    test(
        "Plex TV categories show all videos, then filter by library and show: " +
            variant,
        async ({ page, context, baseURL }) => {
            const local = new URL(baseURL).origin;
            const headers = { "access-control-allow-origin": "*" };
            let remaining;
            const errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            await context.route("**/*", (route) => {
                const url = new URL(route.request().url());
                if (url.origin === local) return route.continue();
                if (url.origin !== plex) return route.abort();
                const json = (container) =>
                    route.fulfill({
                        headers,
                        json: { MediaContainer: container },
                    });
                if (url.pathname === "/library/sections")
                    return json({
                        Directory: [
                            { key: "1", title: "Films", type: "movie" },
                            { key: "2", title: "Cartoons", type: "show" },
                        ],
                        size: 2,
                        totalSize: 2,
                    });
                if (url.pathname === "/library/sections/1/all")
                    return json({
                        Metadata: [
                            {
                                ratingKey: "11",
                                title: "First film",
                                type: "movie",
                            },
                        ],
                        size: 1,
                        totalSize: 1,
                    });
                if (url.pathname === "/library/sections/2/all")
                    return json({
                        Metadata: [
                            {
                                key: "/library/metadata/20/children",
                                title: "Tom and Jerry",
                                type: "show",
                            },
                        ],
                        size: 1,
                        totalSize: 1,
                    });
                if (url.pathname === "/library/metadata/20/children") {
                    remaining = route;
                    return;
                }
                if (/^\/library\/metadata\/\d+$/.test(url.pathname))
                    return json({
                        Metadata: [
                            {
                                Media: [
                                    {
                                        audioCodec: "aac",
                                        container: "mpegts",
                                        Part: [
                                            { key: "/library/parts/1/file.ts" },
                                        ],
                                        videoCodec: "h264",
                                    },
                                ],
                                ratingKey: url.pathname.split("/").pop(),
                                title: "Fixture",
                                type: "movie",
                            },
                        ],
                    });
                if (url.pathname.endsWith("/decision"))
                    return json({
                        generalDecisionCode: 1001,
                        Metadata: [
                            { Media: [{ Part: [{ decision: "transcode" }] }] },
                        ],
                    });
                if (url.pathname.endsWith("/start.m3u8"))
                    return route.fulfill({
                        body:
                            "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-PLAYLIST-TYPE:VOD\n" +
                            Array.from(
                                { length: 60 },
                                (_, i) =>
                                    "#EXT-X-DISCONTINUITY\n#EXTINF:2,\nsegment00.ts?n=" +
                                    i +
                                    "\n"
                            ).join("") +
                            "#EXT-X-ENDLIST\n",
                        contentType: "application/vnd.apple.mpegurl",
                        headers,
                    });
                if (url.pathname.endsWith(".ts"))
                    return route.fulfill({
                        body: fs.readFileSync(
                            path.join(mediaRoot, "segment00.ts")
                        ),
                        contentType: "video/mp2t",
                        headers,
                    });
                if (
                    url.pathname.endsWith("/stop") ||
                    url.pathname.endsWith("/ping")
                )
                    return route.fulfill({ body: "", headers });
                return route.abort();
            });
            await context.routeWebSocket("**/*", (socket) => socket.close());
            await context.addInitScript(
                ({ plex, token }) => {
                    localStorage.setItem("ottplaylang", "_eng");
                    localStorage.setItem("ottplayprov", "plex");
                    localStorage.setItem(
                        "plexcfg",
                        JSON.stringify({
                            address: plex,
                            folders: [
                                {
                                    path: "/library/sections/99/all",
                                    title: "Obsolete selection",
                                },
                            ],
                            playback: "compatible",
                            token,
                        })
                    );
                    const play = HTMLMediaElement.prototype.play;
                    HTMLMediaElement.prototype.play = function () {
                        this.muted = true;
                        return play.call(this);
                    };
                },
                { plex, token }
            );
            await page.goto(variant === "pc" ? "/f/pc/" : "/f/");
            await page.waitForFunction(() => window.cList?.includes("plex-11"));
            await expect.poll(() => !!remaining).toBe(true);
            expect(
                await page.evaluate(() =>
                    window.__ottActiveProviderDriver.catalogLoading()
                )
            ).toBe(true);
            await page.waitForFunction(
                () => window.curList?.[window.primaryIndex] === "plex-11"
            );
            const before = await page.evaluate(
                () => window.curList?.[window.primaryIndex]
            );
            await remaining.fulfill({
                headers,
                json: {
                    MediaContainer: {
                        Metadata: [
                            {
                                ratingKey: "22",
                                title: "Second cartoon",
                                type: "episode",
                            },
                        ],
                        size: 1,
                        totalSize: 1,
                    },
                },
            });
            await page.waitForFunction(() => window.cList?.includes("plex-22"));
            await expect
                .poll(() =>
                    page.evaluate(() =>
                        window.__ottActiveProviderDriver.catalogLoading()
                    )
                )
                .toBe(false);
            expect(
                await page.evaluate(() => window.curList?.[window.primaryIndex])
            ).toBe(before);
            expect(await page.evaluate(() => window.cList.slice())).toEqual([
                "plex-11",
                "plex-22",
            ]);
            await page.evaluate(() => window.bucketsList(0));
            await expect(page.locator("#listCaption")).toHaveText(
                "Category selection"
            );
            await expect(page.locator("#listIn")).toContainText("All");
            await expect(page.locator("#listIn")).toContainText(
                "Cartoons / Tom and Jerry"
            );
            await page.evaluate(() => {
                window.selIndex = window.listArray.findIndex(
                    (x) => String(x).trim() === "Cartoons / Tom and Jerry"
                );
                window.listKeyHandler(window.keys.ENTER);
            });
            await expect(page.locator("#listIn")).toContainText(
                "Second cartoon"
            );
            await expect(page.locator("#listIn")).not.toContainText(
                "First film"
            );
            await page.evaluate(() => window.bucketsList(0));
            await page.evaluate(() => {
                window.selIndex = window.listArray.findIndex(
                    (x) => String(x).trim() === "All"
                );
                window.listKeyHandler(window.keys.ENTER);
            });
            await expect(page.locator("#listIn")).toContainText("First film");
            await expect(page.locator("#listIn")).toContainText(
                "Second cartoon"
            );
            await page.screenshot({
                path: test
                    .info()
                    .outputPath("plex-tv-categories-" + variant + ".png"),
            });
            expect(errors).toEqual([]);
        }
    );
}
