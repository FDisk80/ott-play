// Actual bundled keyboard dispatcher and provider/media adapters. Only network
// sources are synthetic; selection, PIN/kiosk policy and decoding run normally.
const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("../helpers/browser-test.cjs");

const mediaRoot = path.resolve(__dirname, "../fixtures/media-runtime");
test.use({
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
});

async function boot(page, context, baseURL, media = false) {
    const origin = new URL(baseURL).origin;
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === "/random-fixture/channels.m3u")
            return route.fulfill({
                body:
                    '#EXTM3U\n#EXTINF:-1 group-title="Selected group",Fixture One\n' +
                    origin +
                    "/random-fixture/index.m3u8?id=one\n" +
                    '#EXTINF:-1 group-title="Selected group",Fixture Two\n' +
                    origin +
                    "/random-fixture/index.m3u8?id=two\n" +
                    '#EXTINF:-1 group-title="Other group",Outside\n' +
                    origin +
                    "/random-fixture/index.m3u8?id=outside\n" +
                    "#EXTINF:-1,Protected fixture\n#EXTGRP:взрослые\n" +
                    origin +
                    "/random-fixture/index.m3u8?id=adult\n" +
                    '#EXTINF:-1 group-title="Other group",Fixture [AceStream]\n' +
                    origin +
                    "/random-fixture/index.m3u8?id=ace\n",
                contentType: "application/vnd.apple.mpegurl",
            });
        if (url.pathname.endsWith("/vportal/api")) {
            const body = route.request().postDataJSON();
            expect(body.url).toBe("https://portal.fixture/api/");
            expect(body.params.key).toBe("RANDOM_FIXTURE_KEY");
            const request = body.params;
            return route.fulfill({
                json:
                    request.cmd === "play"
                        ? {
                              type: "stream",
                              url:
                                  origin +
                                  "/random-fixture/index.m3u8?id=" +
                                  request.id,
                          }
                        : {
                              items: [1, 2].map((id) => ({
                                  request: { cmd: "play", id: "film:" + id },
                                  title: "Film " + id,
                                  type: "stream",
                              })),
                              title: "Random media fixture",
                              type: "multistream",
                          },
            });
        }
        if (url.origin !== origin) return route.abort("blockedbyclient");
        if (url.pathname.startsWith("/random-fixture/")) {
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
        return route.continue();
    });
    await context.routeWebSocket("**/*", (socket) => socket.close());
    await context.addInitScript(
        ({ origin, media }) => {
            localStorage.setItem("ottplaylang", "_eng");
            localStorage.setItem("ottplayprov", media ? "vportal" : "m3u");
            if (media)
                localStorage.setItem(
                    "vportalprofiles",
                    JSON.stringify({
                        active: 0,
                        portals: [
                            {
                                link: "portal::[key:RANDOM_FIXTURE_KEY]https://portal.fixture/api/",
                                name: "Random media fixture",
                                sections: [],
                            },
                        ],
                    })
                );
            localStorage.setItem(
                media ? "vportalsPlayers" : "m3usPlayers",
                "1"
            );
            localStorage.setItem(
                "m3um3uArr",
                JSON.stringify({
                    active: 0,
                    M3Us: [{ www: origin + "/random-fixture/channels.m3u" }],
                })
            );
            const play = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function () {
                this.muted = true;
                return play.call(this);
            };
        },
        { media, origin }
    );
    await page.goto("/f/pc/");
    await page.waitForFunction(() => window.commandChannelsReady === true);
    if (media) {
        await page.evaluate(() =>
            window.__ottMenuRegistry.open(window).invoke("media.open")
        );
        return errors;
    }
    await page.evaluate(() => {
        const group = window.catsArray.indexOf("Selected group");
        if (group < 0) throw new Error("Fixture group was not loaded");
        window.playChannel(group, 0, true);
    });
    await page.waitForFunction(() => window.video.currentTime > 0.1);
    return errors;
}

async function channelState(page) {
    return page.evaluate(() => ({
        category: window.catsArray[window.catIndex],
        id: window.curList[window.primaryIndex],
        order: window.curList.slice(),
    }));
}

test("remote random uses the bundled dispatcher, current metadata and parental admission", async ({
    page,
    context,
    baseURL,
}) => {
    const errors = await boot(page, context, baseURL);
    const call = (action, params = {}) =>
        page.evaluate(
            ({ action, params }) =>
                new Promise((resolve) => {
                    window.executeRemoteRequest({ action, params }, resolve);
                }),
            { action, params }
        );
    expect((await call("capabilities")).data.random).toEqual({ version: 1 });
    const { data: catalog } = await call("epg_catalog");
    const adult = catalog.channels.find(
        (row) => row.name === "Protected fixture"
    );
    const ace = catalog.channels.find((row) =>
        row.name.includes("[AceStream]")
    );
    const target = catalog.channels.find((row) => row.name === "Fixture Two");
    expect(adult).toBeTruthy();
    expect(ace).toBeTruthy();
    for (const row of [adult, ace]) {
        expect(
            (
                await call("play_catalog", {
                    catalog: catalog.catalog,
                    random: { range: [row.number, row.number] },
                })
            ).status
        ).toBe("rejected");
    }
    await page.evaluate(() =>
        window.channelsList(window.catIndex, window.primaryIndex)
    );
    await expect(page.locator("#list")).toBeVisible();
    const reply = await call("play_catalog", {
        catalog: catalog.catalog,
        random: { range: [target.number, target.number] },
    });
    expect(reply).toEqual({
        data: {
            channel: {
                id: target.id,
                name: target.name,
                number: target.number,
            },
            dispatched: true,
        },
        status: "ok",
    });
    await expect(page.locator("#list")).not.toBeVisible();
    await page.waitForFunction(() => window.video.currentTime > 0.1);

    // No entered PIN and no continuation: effective parental locks still deny the adult selector.
    await page.evaluate(() => {
        window.settings.psChannels = 1;
        window.parentPIN = "1234";
    });
    expect(
        (
            await call("play_catalog", {
                catalog: catalog.catalog,
                random: { mode: "adult" },
            })
        ).status
    ).toBe("rejected");
    await expect(page.locator("#dialogbox")).not.toBeVisible();
    await page.evaluate(() => {
        window.parentPIN = "*";
    });
    expect(
        (
            await call("play_catalog", {
                catalog: catalog.catalog,
                random: { mode: "adult" },
            })
        ).data.channel.id
    ).toBe(adult.id);
    expect(
        (
            await call("play_catalog", {
                catalog: catalog.catalog,
                random: { range: [adult.number, adult.number] },
            })
        ).status
    ).toBe("rejected");
    await page.evaluate(() => {
        window.__ottCommandChannelLoad++;
    });
    expect(
        (await call("play_catalog", { catalog: catalog.catalog, random: {} }))
            .status
    ).toBe("rejected");
    expect(errors).toEqual([]);
});

test("PC R changes only the current channel list and respects keyboard owners", async ({
    page,
    context,
    baseURL,
}) => {
    const errors = await boot(page, context, baseURL);
    const first = await channelState(page);
    await page.keyboard.press("l");
    await page.waitForFunction(() => !!document.fullscreenElement);
    await page.locator("#video").focus();
    await page.keyboard.press("r");
    await expect
        .poll(async () => (await channelState(page)).id)
        .not.toBe(first.id);
    const second = await channelState(page);
    expect(second.category).toBe("Selected group");
    expect(second.order).toEqual(first.order);

    // Hold/repeat must not select again. Keyup followed by keydown is a new action.
    await page.keyboard.down("r");
    const held = await channelState(page);
    await page.keyboard.down("r");
    expect(await channelState(page)).toEqual(held);
    await page.keyboard.up("r");

    await page.evaluate(() =>
        window.channelsList(window.catIndex, window.primaryIndex)
    );
    const listed = await channelState(page);
    await page.keyboard.press("r");
    await expect
        .poll(async () => (await channelState(page)).id)
        .not.toBe(listed.id);
    expect((await channelState(page)).order).toEqual(first.order);

    await page.evaluate(() => {
        window.channelsList(window.catIndex, window.primaryIndex);
        window.__ottChannelSearch.open();
    });
    await page.locator("#editvar").fill("Fixture");
    await page.locator("#editvar").press("Enter");
    await expect(page.locator("#listIn")).toContainText("Fixture One");
    await expect(page.locator("#listIn")).not.toContainText("Outside");
    const beforeSearch = await channelState(page);
    await page.keyboard.press("r");
    await expect
        .poll(async () => (await channelState(page)).id)
        .not.toBe(beforeSearch.id);
    expect((await channelState(page)).category).toBe("Selected group");

    await page.evaluate(() => {
        window.popupList();
        window.editCaption = "Playlist name";
        window.editvar = "";
        window.editKey = window.editKey2;
        window.setEdit = function () {};
        window.showEditKey2();
    });
    const beforeEdit = await channelState(page);
    await page.locator("#editvar").press("r");
    await expect(page.locator("#editvar")).toHaveValue("r");
    expect(await channelState(page)).toEqual(beforeEdit);
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.closeList());

    const locked = await page.evaluate(
        () =>
            new Promise((resolve) =>
                window.__ottKiosk.request(
                    { mode: "on", query: "Fixture One", strict: true },
                    resolve
                )
            )
    );
    expect(locked.status).toBe("ok");
    await page.waitForFunction(() => window.__ottKiosk.strict());
    const beforeLock = await channelState(page);
    await page.keyboard.press("r");
    expect(await channelState(page)).toEqual(beforeLock);
    await page.evaluate(
        () =>
            new Promise((resolve) =>
                window.__ottKiosk.request({ mode: "off" }, resolve)
            )
    );
    expect(errors).toEqual([]);
});

test("PC R selects a media item without shuffling the displayed folder", async ({
    page,
    context,
    baseURL,
}) => {
    const errors = await boot(page, context, baseURL, true);
    await expect(page.locator("#listIn")).toContainText("Film 1");
    // VPortal exposes its flat films through the channel list, not a legacy
    // MediaLibrary frame. Capture both identities and labels from that list.
    const initial = await channelState(page);
    const order = initial.order;
    expect(
        await page.evaluate(() =>
            window.curList.map((id) => window.channels[id].channel_name)
        )
    ).toEqual([
        "Random media fixture - Film 1",
        "Random media fixture - Film 2",
    ]);
    expect(await page.evaluate(() => window.listArray.slice())).toEqual(order);
    await page.keyboard.press("r");
    await expect
        .poll(async () => (await channelState(page)).id)
        .not.toBe(initial.id);
    await expect
        .poll(() =>
            page.evaluate(() => window.__ottClassicPlayback.programme()?.title)
        )
        .toMatch(/Film [12]$/);
    await page.waitForFunction(() => window.video.currentTime > 0.1);
    const title = await page.evaluate(
        () => window.__ottClassicPlayback.programme().title
    );
    expect(await channelState(page)).toMatchObject({
        category: initial.category,
        order,
    });
    await page.keyboard.press("l");
    await page.waitForFunction(() => !!document.fullscreenElement);
    await page.locator("#video").focus();
    await page.keyboard.press("r");
    await expect
        .poll(() =>
            page.evaluate(() => window.__ottClassicPlayback.programme()?.title)
        )
        .not.toBe(title);
    expect(await channelState(page)).toMatchObject({
        category: initial.category,
        order,
    });
    await page.evaluate(() =>
        window.channelsList(window.catIndex, window.primaryIndex)
    );
    expect(await page.evaluate(() => window.listArray.slice())).toEqual(order);
    await expect(page.locator("#listIn")).toContainText("Film 1");
    await expect(page.locator("#listIn")).toContainText("Film 2");
    expect(errors).toEqual([]);
});

// Exercise actual fullscreen key capture and the bundled seek controller. The
// decoder observation intentionally lags to model asynchronous native seeks.
test("PC modifier seeks accumulate across debounce flushes without reapplying the HUD total", async ({
    page,
    context,
    baseURL,
}) => {
    const errors = await boot(page, context, baseURL);
    await page.keyboard.press("l");
    await page.waitForFunction(() => !!document.fullscreenElement);
    await page.evaluate(() => {
        window.video.pause();
        window.__ottClassicPlayback.command({
            duration: 1000,
            type: "finite-channel",
        });
        window.__ottClassicPlayback.command({ type: "pause" });
        window.__seekPositions = [];
        // Keep the owned finite-media path while its decoder sample lags.
        window.__ottCoreBackend = () => ({
            current: () => ({
                sample: () =>
                    window.__ottClassicPlayback.command({
                        duration: 1000,
                        position: 100,
                        type: "position",
                    }),
            }),
        });
        window.stbGetPosTime = () => 100;
        window.stbGetLen = () => 1000;
        window.stbSetPosTime = (position) =>
            window.__seekPositions.push(position);
    });
    await page.locator("#video").focus();
    for (let index = 0; index < 4; index++) {
        await page.keyboard.press(
            index % 2 ? "Control+ArrowRight" : "Alt+ArrowRight"
        );
        await expect(
            page.locator("#notifications .remote-notify-local")
        ).toContainText(String((index + 1) * 10) + " s");
        await expect
            .poll(() => page.evaluate(() => window.__seekPositions.length))
            .toBe(index + 1);
        // Native local catalog publication replaces these containers without
        // changing the playing row, selected category, or decoder generation.
        await page.evaluate(() => {
            window.channels = { ...window.channels };
            window.catsArray = window.catsArray.slice();
            const category = window.catsArray[window.catIndex];
            const selected = window.cats[category][window.primaryIndex];
            const list = window.cats[category].slice().reverse();
            window.cats = { ...window.cats, [category]: list };
            window.curList = list;
            window.primaryIndex = list.indexOf(selected);
        });
    }
    expect(await page.evaluate(() => window.__seekPositions)).toEqual([
        110, 120, 130, 140,
    ]);
    await page.keyboard.press("Alt+ArrowLeft");
    await expect(
        page.locator("#notifications .remote-notify-local")
    ).toContainText("30 s");
    await expect
        .poll(() => page.evaluate(() => window.__seekPositions.at(-1)))
        .toBe(130);
    expect(errors).toEqual([]);
});

test.describe("Footer timeline hit area", () => {
    test.use({ hasTouch: true });
    test("mouse and touch above the painted bar seek without expanding info", async ({
        page,
        context,
        baseURL,
    }) => {
        const errors = await boot(page, context, baseURL);
        await page.evaluate(() => {
            window.video.pause();
            window.__ottClassicPlayback.command({
                duration: 1000,
                type: "finite-channel",
            });
            window.__ottClassicPlayback.command({ type: "pause" });
            window.stbGetLen = () => 1000;
            window.__timelineSeeks = [];
            window.stbSetPosTime = (value) =>
                window.__timelineSeeks.push(value);
            const show = window.showChannelInfo;
            window.__timelineInfo = 0;
            window.showChannelInfo = function () {
                window.__timelineInfo++;
                return show.apply(this, arguments);
            };
        });
        for (const touch of [false, true]) {
            await page.evaluate(() => {
                window.showChannelInfo(1);
                window.$("#info1").finish();
                window.__timelineInfo = 0;
                window.__timelineSeeks = [];
            });
            await expect(page.locator("#progress_div")).toBeVisible();
            const bar = await page.locator("#progress_div").boundingBox();
            expect(bar).not.toBeNull();
            const x = bar.x + bar.width / 4;
            const y = bar.y - bar.height / 2 + 0.5;
            if (touch) await page.touchscreen.tap(x, y);
            else await page.mouse.click(x, y);
            await expect
                .poll(() => page.evaluate(() => window.__timelineSeeks))
                .toEqual([250]);
            expect(await page.evaluate(() => window.__timelineInfo)).toBe(0);
            await expect(page.locator("#descr")).toBeHidden();
        }
        expect(errors).toEqual([]);
    });
});
