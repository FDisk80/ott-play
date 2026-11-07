// Real built player, storage and RPC handlers; only external controller/media are fixtures.
const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("../helpers/browser-test.cjs");
const TOKEN = "notification_persistence_" + "e".repeat(32);
const mediaRoot = path.join(__dirname, "../fixtures/media-runtime");
test.use({
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
});

async function setup(page, context, baseURL, legacy = false, options = {}) {
    const origin = new URL(baseURL).origin;
    const polls = [];
    const errors = [];
    let releaseImage;
    const imageReady = new Promise((resolve) => {
        releaseImage = resolve;
    });
    let imageRequests = 0;
    let sequence = 0;
    let message = "Before disabling";
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort("blockedbyclient");
        if (url.pathname === "/notification-fixture/list.m3u")
            return route.fulfill({
                body:
                    "#EXTM3U\n#EXTINF:-1,Notification fixture\n" +
                    origin +
                    "/notification-fixture/index.m3u8\n",
                contentType: "audio/x-mpegurl",
            });
        if (url.pathname.startsWith("/notification-fixture/")) {
            const segment = url.pathname.endsWith(".ts");
            return route.fulfill({
                body: fs.readFileSync(
                    path.join(
                        mediaRoot,
                        segment ? "segment00.ts" : "index.m3u8"
                    )
                ),
                contentType: segment
                    ? "video/mp2t"
                    : "application/vnd.apple.mpegurl",
            });
        }
        if (url.pathname.startsWith("/notification-control/")) {
            expect(route.request().headers().authorization).toBe(
                "Bearer " + TOKEN
            );
            if (url.pathname.endsWith("/api/notifications/media")) {
                imageRequests++;
                await imageReady;
                const now = Date.now() / 1000;
                return route.fulfill({
                    json: {
                        bytes: options.imageData.bytes,
                        content_type: "image/jpeg",
                        data_base64: options.imageData.data,
                        expires_at: now + (options.durationMs || 15000) / 1000,
                        height: 90,
                        id: "f".repeat(32),
                        runtime: url.searchParams.get("runtime"),
                        server_time: now,
                        version: 1,
                        width: 160,
                    },
                });
            }
            if (url.pathname.endsWith("/api/notifications")) {
                const runtime = url.searchParams.get("runtime");
                polls.push({
                    active: url.searchParams.get("active"),
                    enabled: url.searchParams.get("enabled"),
                    media: url.searchParams.get("media"),
                    runtime,
                });
                if (
                    legacy &&
                    (url.searchParams.has("enabled") ||
                        url.searchParams.has("media"))
                )
                    return route.fulfill({
                        json: { error: "unknown query" },
                        status: 400,
                    });
                const now = Date.now() / 1000;
                return route.fulfill({
                    json: {
                        poll_after_ms: 5000,
                        server_time: now,
                        version: 1,
                        ...(legacy
                            ? {}
                            : {
                                  capabilities: {
                                      enabled: true,
                                      media: options.image ? ["jpeg-v1"] : [],
                                  },
                              }),
                        notifications:
                            (options.once && sequence > 0) ||
                            url.searchParams.get("active") !== "true"
                                ? []
                                : [
                                      {
                                          duration_ms:
                                              options.durationMs || 15000,
                                          expires_at:
                                              now +
                                              (options.remainingMs ||
                                                  options.durationMs ||
                                                  15000) /
                                                  1000,
                                          id: (++sequence)
                                              .toString(16)
                                              .padStart(32, "0"),
                                          message,
                                          runtime,
                                          severity: "info",
                                          title: "Home Assistant",
                                          ...(options.image
                                              ? {
                                                    media: {
                                                        bytes: options.imageData
                                                            .bytes,
                                                        content_type:
                                                            "image/jpeg",
                                                        height: 90,
                                                        id: "f".repeat(32),
                                                        kind: "image",
                                                        width: 160,
                                                    },
                                                }
                                              : {}),
                                      },
                                  ],
                    },
                });
            }
            return route.fulfill({
                json: { commands: [], server_time: Date.now() / 1000 },
            });
        }
        return route.continue();
    });
    await context.routeWebSocket("**/*", (socket) => socket.close());
    await context.addInitScript(
        ({ origin, token, disabled }) => {
            const nativeGet = Storage.prototype.getItem;
            if (!localStorage.getItem("notificationFixtureSeeded")) {
                localStorage.setItem("notificationFixtureSeeded", "1");
                localStorage.setItem("ottplaylang", "_eng");
                localStorage.setItem("ottplayprov", "m3u");
                localStorage.setItem(
                    "m3um3uArr",
                    JSON.stringify({
                        active: 0,
                        M3Us: [
                            { www: origin + "/notification-fixture/list.m3u" },
                        ],
                    })
                );
                localStorage.setItem("m3usPlayers", "1");
                localStorage.setItem(
                    "commandServerAddress",
                    origin + "/notification-control/api/webhook/commands"
                );
                localStorage.setItem("commandServerEnabled", "1");
                localStorage.setItem("commandServerToken", token);
                if (disabled)
                    localStorage.setItem("sNotificationsEnabled", "0");
            }
            if (
                nativeGet.call(localStorage, "notificationFixtureBlockRead") ===
                "1"
            ) {
                Storage.prototype.getItem = function (key) {
                    if (key === "sNotificationsEnabled")
                        throw new Error("fixture blocked notification read");
                    return nativeGet.call(this, key);
                };
            }
            const play = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function () {
                this.muted = true;
                return play.call(this);
            };
        },
        { disabled: options.disabled, origin, token: TOKEN }
    );
    async function ready() {
        await page.waitForFunction(
            () =>
                window.commandChannelsReady === true &&
                window.__ottRemoteNotifications &&
                !document.body.classList.contains("booting")
        );
    }
    async function rpc(action, params = {}) {
        return page.evaluate(
            ({ action, params }) =>
                new Promise((resolve) =>
                    window.executeRemoteRequest({ action, params }, resolve)
                ),
            { action, params }
        );
    }
    async function policy(operation, enabled) {
        const runtime = (await rpc("capabilities")).data.player.runtime;
        return rpc("notifications", {
            operation,
            runtime,
            version: 1,
            ...(operation === "set" ? { enabled } : {}),
        });
    }
    await page.goto("/f/pc/");
    await ready();
    if (options.image)
        options.imageData = await page.evaluate(() => {
            const canvas = document.createElement("canvas");
            canvas.width = 160;
            canvas.height = 90;
            const paint = canvas.getContext("2d");
            paint.fillStyle = "#4a765b";
            paint.fillRect(0, 0, 160, 90);
            const data = canvas.toDataURL("image/jpeg").split(",")[1];
            return { bytes: atob(data).length, data };
        });
    return {
        errors,
        imageRequests: () => imageRequests,
        policy,
        polls,
        ready,
        releaseImage: () => releaseImage(),
        rpc,
        setMessage: (value) => (message = value),
    };
}

test("durable notification OFF survives reload and ON receives only a new session", async ({
    page,
    context,
    baseURL,
}) => {
    const h = await setup(page, context, baseURL);
    await expect(page.locator(".remote-notify-message")).toHaveText(
        "Before disabling"
    );
    const originalRuntime = (await h.rpc("capabilities")).data.player.runtime;
    expect((await h.policy("get")).data).toMatchObject({
        enabled: true,
        persisted: true,
        version: 1,
    });
    expect((await h.policy("set", false)).data).toMatchObject({
        enabled: false,
        persisted: true,
    });
    await expect(page.locator(".remote-notify")).toHaveCount(0);
    expect(
        await page.evaluate(() => localStorage.getItem("sNotificationsEnabled"))
    ).toBe("0");
    const beforeReload = h.polls.length;
    await page.reload();
    await h.ready();
    await expect.poll(() => h.polls.length).toBeGreaterThan(beforeReload);
    expect(h.polls.slice(beforeReload).every((p) => p.active === "false")).toBe(
        true
    );
    expect((await h.policy("get")).data).toMatchObject({
        enabled: false,
        persisted: true,
    });
    expect(
        await h.rpc("notifications", {
            operation: "get",
            runtime: originalRuntime,
            version: 1,
        })
    ).toEqual({
        data: {
            error: "runtime_mismatch",
            operation: "get",
            runtime: originalRuntime,
            version: 1,
        },
        status: "rejected",
    });
    await expect(page.locator(".remote-notify")).toHaveCount(0);
    const disabledRuntime = h.polls.at(-1).runtime;
    h.setMessage("After enabling");
    expect((await h.policy("set", true)).data).toMatchObject({
        enabled: true,
        persisted: true,
    });
    await expect(page.locator(".remote-notify-message")).toHaveText(
        "After enabling"
    );
    expect(h.polls.at(-1).runtime).not.toBe(disabledRuntime);
    expect(h.errors).toEqual([]);
});

test("profile import and local backup cannot overwrite the installation opt-out", async ({
    page,
    context,
    baseURL,
}) => {
    const h = await setup(page, context, baseURL);
    await h.policy("set", false);
    await page.evaluate(() => {
        const snapshot = JSON.parse(window.exportSettings());
        snapshot.settings.sNotificationsEnabled = "1";
        snapshot.settings.notificationsEnabled = 1;
        localStorage.removeItem("notificationFixtureImportResult");
        window.importSettings(JSON.stringify(snapshot), (ok) =>
            localStorage.setItem("notificationFixtureImportResult", String(ok))
        );
    });
    await expect(page.locator("#dialogbox")).toBeVisible();
    const reloaded = page.waitForEvent("domcontentloaded");
    await page.keyboard.press("Enter");
    await reloaded;
    await h.ready();
    expect(
        await page.evaluate(() =>
            localStorage.getItem("notificationFixtureImportResult")
        )
    ).toBe("true");
    expect(
        await page.evaluate(() => localStorage.getItem("sNotificationsEnabled"))
    ).toBe("0");
    await page.evaluate(() => {
        window.saveAllOptions();
        const snapshot = JSON.parse(
            localStorage.getItem("stb_settings_backup")
        );
        window.__notificationBackupExcluded =
            !Object.prototype.hasOwnProperty.call(
                snapshot,
                "sNotificationsEnabled"
            );
        snapshot.sNotificationsEnabled = "1";
        snapshot.notificationFixtureRestored = "yes";
        localStorage.setItem("stb_settings_backup", JSON.stringify(snapshot));
        window.loadAllOptions();
    });
    expect(await page.evaluate(() => window.__notificationBackupExcluded)).toBe(
        true
    );
    expect(
        await page.evaluate(() =>
            localStorage.getItem("notificationFixtureRestored")
        )
    ).toBe("yes");
    expect(
        await page.evaluate(() => localStorage.getItem("sNotificationsEnabled"))
    ).toBe("0");
    expect((await h.policy("get")).data.enabled).toBe(false);
    await expect(page.locator(".remote-notify")).toHaveCount(0);
    expect(h.errors).toEqual([]);
});

test("unreadable saved OFF on restart fails closed instead of becoming default ON", async ({
    page,
    context,
    baseURL,
}) => {
    const h = await setup(page, context, baseURL);
    await h.policy("set", false);
    await page.evaluate(() =>
        localStorage.setItem("notificationFixtureBlockRead", "1")
    );
    const beforeReload = h.polls.length;
    await page.reload();
    await h.ready();
    await expect.poll(() => h.polls.length).toBeGreaterThan(beforeReload);
    expect(h.polls.slice(beforeReload).every((p) => p.active === "false")).toBe(
        true
    );
    expect((await h.policy("get")).data.error).toBe("storage_unavailable");
    await expect(page.locator(".remote-notify")).toHaveCount(0);
    expect(h.errors).toEqual([]);
});

test("legacy controller keeps text notifications without new query parameters", async ({
    page,
    context,
    baseURL,
}) => {
    const h = await setup(page, context, baseURL, true);
    await expect(page.locator(".remote-notify-message")).toHaveText(
        "Before disabling"
    );
    await h.policy("set", false);
    await expect(page.locator(".remote-notify")).toHaveCount(0);
    h.setMessage("Legacy after enabling");
    await h.policy("set", true);
    await expect(page.locator(".remote-notify-message")).toHaveText(
        "Legacy after enabling"
    );
    expect(h.polls.every((p) => p.enabled === null && p.media === null)).toBe(
        true
    );
    expect(h.errors).toEqual([]);
});

async function timedBanner(page, context, baseURL, options = {}) {
    const h = await setup(page, context, baseURL, false, {
        disabled: true,
        durationMs: 5000,
        once: true,
        ...options,
    });
    await page.clock.install();
    await page.clock.pauseAt(Date.now() + 100);
    await page.evaluate(() => {
        document.documentElement.style.setProperty(
            "--ott-notify-alpha",
            "0.37"
        );
    });
    await h.policy("set", true);
    await page.evaluate(() => window.__ottRemoteNotifications.poll());
    const banner = page.locator(".remote-notify");
    await expect(banner).toHaveCount(1);
    return { ...h, banner };
}

async function animationStyle(banner, time) {
    return banner.evaluate((element, time) => {
        for (const animation of element.getAnimations({ subtree: true })) {
            animation.pause();
            animation.currentTime = time;
        }
        const style = getComputedStyle(element);
        const surface = getComputedStyle(element, "::before");
        return {
            background: surface.backgroundColor,
            clip: style.clipPath,
            iconOpacity: element.querySelector(".remote-notify-icon")
                ? Number(
                      getComputedStyle(
                          element.querySelector(".remote-notify-icon")
                      ).opacity
                  )
                : null,
            names: element
                .getAnimations({ subtree: true })
                .map((animation) => animation.animationName)
                .filter(
                    (name) =>
                        !["remoteNotifyFold", "remoteNotifyHeadingUp"].includes(
                            name
                        )
                ),
            opacity: Number(style.opacity),
            surfaceOpacity: Number(surface.opacity),
            textOpacity: Number(
                getComputedStyle(
                    element.querySelector(".remote-notify-content") ||
                        element.querySelector("img")
                ).opacity
            ),
            width: element.offsetWidth,
            x: new DOMMatrix(style.transform).m41,
        };
    }, time);
}

test("seek banner stays compact and updates without replaying its entrance", async ({
    page,
    context,
    baseURL,
}) => {
    await page.clock.install();
    const h = await setup(page, context, baseURL, false, { disabled: true });
    await page.clock.pauseAt(Date.now() + 100);
    await page.evaluate(() => {
        window.__ottNotificationBanners.create(
            { message: "Remote notification" },
            10000
        );
        window.showShift("+10 seconds", true);
        const card = document.querySelector(".remote-notify-seek");
        window.__seekCard = card;
        window.__seekEntrance = card
            .getAnimations()
            .find((animation) =>
                ["remoteNotifyIn", "remoteNotifySimpleIn"].includes(
                    animation.animationName
                )
            );
        if (!window.__seekEntrance)
            throw new Error("Seek entrance animation is missing");
    });
    const seek = page.locator(".remote-notify-seek");
    await expect(seek).toHaveCount(1);
    const widths = await page.evaluate(() => ({
        ordinary: document.querySelector(
            ".remote-notify:not(.remote-notify-seek)"
        ).offsetWidth,
        seek: window.__seekCard.offsetWidth,
    }));
    expect(widths.seek).toBeLessThan(widths.ordinary * 0.75);
    await page.clock.runFor(200);
    const refreshed = await page.evaluate(() => {
        window.__seekEntrance.pause();
        window.__seekEntrance.currentTime = 200;
        window.showShift("+20 seconds", true);
        const card = document.querySelector(".remote-notify-seek");
        return {
            contentDelay: getComputedStyle(
                card.querySelector(".remote-notify-content")
            ).animationDelay,
            entranceTime: window.__seekEntrance.currentTime,
            iconDelay: getComputedStyle(
                card.querySelector(".remote-notify-icon")
            ).animationDelay,
            sameCard: card === window.__seekCard,
            sameEntrance: card.getAnimations().includes(window.__seekEntrance),
            surfaceDelay: getComputedStyle(card, "::before").animationDelay,
        };
    });
    expect(refreshed.sameCard).toBe(true);
    expect(refreshed.sameEntrance).toBe(true);
    expect(refreshed.entranceTime).toBe(200);
    expect(refreshed.surfaceDelay).toBe(refreshed.contentDelay);
    expect(refreshed.surfaceDelay).toBe(refreshed.iconDelay);
    expect(refreshed.surfaceDelay).toBe("0s, 1.18s");
    await expect(seek.locator(".remote-notify-message")).toHaveText(
        "+20 seconds"
    );
    await page.clock.runFor(2999);
    await expect(seek).toHaveCount(1);
    await page.clock.runFor(1);
    await expect(seek).toHaveCount(0);
    await page.evaluate(() => {
        window.sShowSeekNotifications = 0;
        window.showShift("+30 seconds", true);
        window.showShift("Pause");
    });
    await expect(seek).toHaveCount(0);
    await expect(
        page.locator(".remote-notify-local .remote-notify-message")
    ).toHaveText("Pause");
    await expect(
        page.locator(".remote-notify:not(.remote-notify-local)")
    ).toHaveCount(1);
    expect(h.errors).toEqual([]);
});

test("remote banner slides and reveals, holds then fades without restarting or extending expiry", async ({
    page,
    context,
    baseURL,
}) => {
    const h = await timedBanner(page, context, baseURL);
    const start = await animationStyle(h.banner, 0);
    expect(start.names.sort()).toEqual([
        "remoteNotifyFade",
        "remoteNotifyFade",
        "remoteNotifyFade",
        "remoteNotifyIn",
        "remoteNotifySurfaceIn",
        "remoteNotifySurfaceIn",
        "remoteNotifySurfaceIn",
    ]);
    expect(start.x).toBeGreaterThan(start.width);
    expect(start.clip).toContain("46%");
    expect(start.surfaceOpacity).toBeLessThanOrEqual(0.05);
    expect(start.iconOpacity).toBeCloseTo(start.surfaceOpacity, 3);
    expect(start.opacity).toBe(1);
    expect(start.textOpacity).toBeCloseTo(start.surfaceOpacity, 3);
    expect(start.background).toBe("rgba(22, 28, 39, 0.37)");

    const shown = await animationStyle(h.banner, 480);
    expect(shown.x).toBeCloseTo(0, 3);
    expect(shown.clip).not.toContain("46%");
    expect(shown.surfaceOpacity).toBeCloseTo(1, 3);
    expect(shown.iconOpacity).toBeCloseTo(shown.surfaceOpacity, 3);
    expect(shown.opacity).toBe(1);
    expect(shown.textOpacity).toBe(1);
    expect((await animationStyle(h.banner, 979)).surfaceOpacity).toBeCloseTo(
        1,
        3
    );
    const fading = await animationStyle(h.banner, 2500);
    expect(fading.surfaceOpacity).toBeLessThan(0.9);
    expect(fading.surfaceOpacity).toBeGreaterThan(0.4);
    expect(fading.iconOpacity).toBeCloseTo(fading.surfaceOpacity, 3);
    expect(fading.opacity).toBe(1);
    expect(fading.textOpacity).toBeCloseTo(fading.surfaceOpacity, 3);
    await h.banner.evaluate((element) => {
        element.__fixtureFade = element
            .getAnimations({ subtree: true })
            .find(
                (animation) => animation.animationName === "remoteNotifyFade"
            );
    });

    await page.clock.runFor(4679);
    await expect(h.banner).not.toHaveClass(/remote-notify-out/);
    await page.clock.runFor(1);
    await expect(h.banner).toHaveClass(/remote-notify-out/);
    const exiting = await h.banner.evaluate((element) => {
        const fade = element
            .getAnimations({ subtree: true })
            .find(
                (animation) => animation.animationName === "remoteNotifyFade"
            );
        const exit = element
            .getAnimations({ subtree: true })
            .find((animation) => animation.animationName === "remoteNotifyOut");
        exit.pause();
        exit.currentTime = 160;
        const style = getComputedStyle(element);
        return {
            background: getComputedStyle(element, "::before").backgroundColor,
            fadeTime: fade.currentTime,
            opacity: Number(style.opacity),
            sameFade: fade === element.__fixtureFade,
            surfaceOpacity: Number(
                getComputedStyle(element, "::before").opacity
            ),
            textOpacity: Number(
                getComputedStyle(
                    element.querySelector(".remote-notify-content")
                ).opacity
            ),
            x: new DOMMatrix(style.transform).m41,
        };
    });
    expect(exiting.sameFade).toBe(true);
    expect(exiting.fadeTime).toBeCloseTo(2500, 1);
    expect(exiting.surfaceOpacity).toBeCloseTo(fading.surfaceOpacity, 3);
    expect(exiting.opacity).toBe(1);
    expect(exiting.textOpacity).toBeCloseTo(fading.surfaceOpacity, 3);
    expect(exiting.x).toBeGreaterThan(0);
    expect(exiting.background).toBe(start.background);
    await page.clock.runFor(319);
    await expect(h.banner).toHaveCount(1);
    await page.clock.runFor(1);
    await expect(h.banner).toHaveCount(0);
    expect(h.errors).toEqual([]);
});

test("remote banner clips its heading upward and retains its message", async ({
    page,
    context,
    baseURL,
}) => {
    const h = await timedBanner(page, context, baseURL);
    async function stage(time) {
        return h.banner.evaluate((element, time) => {
            for (const animation of element.getAnimations({ subtree: true })) {
                animation.pause();
                animation.currentTime = time;
            }
            const clip = element
                .querySelector(".remote-notify-heading")
                .getBoundingClientRect();
            const label = element
                .querySelector(".remote-notify-label")
                .getBoundingClientRect();
            const title = element
                .querySelector(".remote-notify-title")
                .getBoundingClientRect();
            const message = element.querySelector(".remote-notify-message");
            const visible = (rect) =>
                Math.max(
                    0,
                    Math.min(rect.bottom, clip.bottom) -
                        Math.max(rect.top, clip.top)
                );
            return {
                headingHeight: clip.height,
                labelHeight: label.height,
                labelVisible: visible(label),
                messageHeight: message.getBoundingClientRect().height,
                messageText: message.textContent,
                messageY: message.getBoundingClientRect().y,
                titleHeight: title.height,
                titleVisible: visible(title),
            };
        }, time);
    }
    const full = await stage(979);
    const partial = await stage(1220);
    expect(partial.headingHeight).toBeGreaterThan(0);
    expect(partial.headingHeight).toBeLessThan(full.headingHeight);
    expect(partial.labelVisible).toBeLessThan(full.labelVisible);
    expect(partial.labelHeight).toBeCloseTo(full.labelHeight, 2);
    expect(partial.titleHeight).toBeCloseTo(full.titleHeight, 2);
    const labelGone = await stage(1460);
    expect(labelGone.labelVisible).toBe(0);
    expect(labelGone.titleVisible).toBeGreaterThan(0);
    expect(labelGone.messageY).toBeLessThan(full.messageY);
    const compact = await stage(1940);
    expect(compact.headingHeight).toBe(0);
    expect(compact.labelVisible).toBe(0);
    expect(compact.titleVisible).toBe(0);
    expect(compact.messageY).toBeLessThan(labelGone.messageY);
    expect(compact.messageHeight).toBeCloseTo(full.messageHeight, 2);
    expect(compact.messageText).toBe("Before disabling");
    expect(await stage(4500)).toEqual(compact);
    await page.clock.runFor(5000);
    await expect(h.banner).toHaveCount(0);
    expect(h.errors).toEqual([]);
});

test("new remote banners keep a bounded independent downward offset", async ({
    page,
    context,
    baseURL,
}) => {
    await page.addInitScript(() => {
        Math.random = () => 0.99;
    });
    const h = await timedBanner(page, context, baseURL, {
        durationMs: 15000,
        once: false,
    });
    expect(
        await h.banner.evaluate((element) => getComputedStyle(element).top)
    ).toBe("5px");
    await page.evaluate(() => {
        Math.random = () => 0;
    });
    await page.clock.runFor(5000);
    await page.evaluate(() => window.__ottRemoteNotifications.poll());
    await expect(h.banner).toHaveCount(2);
    expect(
        await h.banner
            .first()
            .evaluate((element) => getComputedStyle(element).top)
    ).toBe("5px");
    expect(
        await h.banner
            .last()
            .evaluate((element) => getComputedStyle(element).top)
    ).toBe("0px");
    expect(h.errors).toEqual([]);
});

test("remote banner reduced motion keeps configured alpha and the original expiry", async ({
    page,
    context,
    baseURL,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const h = await timedBanner(page, context, baseURL, { durationMs: 1000 });
    const style = await h.banner.evaluate((element) => ({
        animations: element.getAnimations({ subtree: true }).length,
        background: getComputedStyle(element, "::before").backgroundColor,
        opacity: getComputedStyle(element).opacity,
    }));
    expect(style).toEqual({
        animations: 0,
        background: "rgba(22, 28, 39, 0.37)",
        opacity: "1",
    });
    await page.clock.runFor(680);
    await expect(h.banner).toHaveClass(/remote-notify-out/);
    expect(
        await h.banner.evaluate(
            (element) => element.getAnimations({ subtree: true }).length
        )
    ).toBe(0);
    await page.clock.runFor(319);
    await expect(h.banner).toHaveCount(1);
    await page.clock.runFor(1);
    await expect(h.banner).toHaveCount(0);
    expect(h.errors).toEqual([]);
});

test("short remaining notification TTL wins over entrance, hold and fade", async ({
    page,
    context,
    baseURL,
}) => {
    const h = await timedBanner(page, context, baseURL, {
        durationMs: 1000,
        remainingMs: 250,
    });
    await page.clock.runFor(249);
    await expect(h.banner).toHaveCount(1);
    await page.clock.runFor(1);
    await expect(h.banner).toHaveCount(0);
    expect(h.errors).toEqual([]);
});

test("delayed image banner fits its fade and exit inside the original privacy deadline", async ({
    page,
    context,
    baseURL,
}) => {
    const h = await timedBanner(page, context, baseURL, { image: true });
    await expect.poll(h.imageRequests).toBe(1);
    await expect(h.banner).toBeHidden();
    await page.clock.runFor(2000);
    h.releaseImage();
    await expect(h.banner.locator("img")).toBeVisible();
    const durations = await h.banner.evaluate((element) =>
        element
            .getAnimations({ subtree: true })
            .map((animation) => [
                animation.animationName,
                animation.effect.getTiming().duration,
            ])
    );
    expect(durations).toContainEqual(["remoteNotifyIn", 480]);
    expect(durations).toContainEqual(["remoteNotifyFade", 2020]);
    expect((await animationStyle(h.banner, 480)).opacity).toBeCloseTo(1, 3);
    expect((await animationStyle(h.banner, 979)).opacity).toBeCloseTo(1, 3);
    const imageFaded = await animationStyle(h.banner, 3000);
    expect(imageFaded.surfaceOpacity).toBeCloseTo(0.18, 3);
    expect(imageFaded.textOpacity).toBeCloseTo(0.18, 3);
    expect(imageFaded.opacity).toBe(1);
    await page.clock.runFor(2679);
    await expect(h.banner).not.toHaveClass(/remote-notify-out/);
    await page.clock.runFor(1);
    await expect(h.banner).toHaveClass(/remote-notify-out/);
    await page.clock.runFor(319);
    await expect(h.banner).toHaveCount(1);
    await page.clock.runFor(1);
    await expect(h.banner).toHaveCount(0);
    expect(h.errors).toEqual([]);
});
