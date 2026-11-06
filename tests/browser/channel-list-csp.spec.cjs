const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { JSDOM } = require("jsdom");
const { readDictionary } = require("../../scripts/localization-catalog.cjs");

const root = path.resolve(__dirname, "../..");
const origin = "http://127.0.0.1:4198";
const nonce = "ottplay-channel-fixture";
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function nativePolicy() {
    const security = JSON.parse(read("src-tauri/tauri.conf.json")).app.security;
    const disabled = security.dangerousDisableAssetCspModification;
    assert.notEqual(
        disabled,
        true,
        "Native CSP modification must remain enabled"
    );
    for (const directive of ["script-src", "style-src"]) {
        assert(
            !Array.isArray(disabled) || !disabled.includes(directive),
            directive + " must retain Tauri's nonce protection"
        );
    }
    // Tauri codegen 2.6.3 adds nonces to embedded script/style tags; Tauri
    // 2.11.5 appends those nonces to the effective CSP. A config-only policy
    // misses this regression: nonce sources make unsafe-inline ineffective.
    return security.csp
        .split(";")
        .map((part) => {
            const directive = part.trim();
            return /^(script-src|style-src)\s/.test(directive)
                ? directive + " 'nonce-" + nonce + "'"
                : directive;
        })
        .join("; ");
}

function initializeFixture(native, capacitor) {
    window.ott_device = "pc";
    window.__fixtureViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
        window.__fixtureViolations.push(event.effectiveDirective);
    });
    const background = (window.__fixtureBackground = {
        probes: 0,
        standby: false,
    });
    const snapshot = () => ({
        pending: 0,
        quiescent: background.standby,
        standby: background.standby,
    });
    const status = async () => {
        background.probes++;
        return snapshot();
    };
    const setStandby = async ({ standby }) => {
        background.standby = standby;
        return snapshot();
    };
    if (capacitor) {
        // The renderer uses real startup admission; model its native status
        // rather than letting a missing bridge put the fixture into standby.
        window.Capacitor = {
            getPlatform: () => "ios",
            isNativePlatform: () => true,
            Plugins: { NativeBackground: { setStandby, status } },
        };
    } else if (native) {
        window.__TAURI__ = {
            core: {
                invoke: async (command, args) => {
                    if (command === "background_standby_status")
                        return status();
                    if (command === "set_background_standby")
                        return setStandby(args);
                    return command === "plugin:updater|check"
                        ? null
                        : { ok: true };
                },
            },
        };
    }
}

function renderFixture(initialSettings, channelDescription) {
    document.body.classList.remove("booting");
    document.getElementById("launch").remove();
    uiInit();
    listDetail = document.getElementById("listDetail");
    listPodval = document.getElementById("listPodval");
    const now = Date.now() / 1000;
    const logo =
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="blue"/></svg>'
        );
    catsArray = ["Fixture"];
    cats = { Fixture: ["one", "two"] };
    channels = {
        one: {
            channel_name: "News",
            descr:
                channelDescription === undefined
                    ? '<b>Trusted description text</b><span style="color:red" data-ott-key="13" onclick="window.__metadataExecuted=true">Metadata text</span><script>window.__metadataExecuted=true</script>'
                    : channelDescription,
            icon: logo,
            name: "Current bulletin",
            nextpr: [{ name: "Next bulletin", time: now + 1800 }],
            rec: 1,
            time: now - 1800,
            time_to: now + 1800,
        },
        two: {
            channel_name: "Films",
            descr: "Second description",
            name: "Current film",
            rec: 0,
            time: now - 1800,
            time_to: now + 1800,
        },
    };
    for (let number = 3; number <= 40; number++) {
        const id = "fixture" + number;
        cats.Fixture.push(id);
        channels[id] = {
            channel_name: "Fixture channel " + number,
            descr: "Fixture description " + number,
            name: "Programme " + number,
            rec: 1,
            time: now - 1800,
            time_to: now + 1800,
        };
    }
    channels.fixture3.name = "";
    channels.fixture3.time = channels.fixture3.time_to = 0;
    window.channels = window.chanels = channels;
    getCurProgData = () => true;
    getChannelPicon = () => logo;
    settings.pageSize = 25;
    settings.interfaceTheme = 0;
    settings.noSmall = 1;
    window.sNoSmall = 1;
    settings.showScroll = window.sShowScroll = 1;
    sShowNum =
        sShowName =
        sShowPikon =
        sShowProgress =
        sShowProgram =
        sShowArchive =
            1;
    sShowDescr = 1;
    sThumbnail = window.sThumbnail = 1;
    sNextCountL = 1;
    sPreview = 0;
    sPSchannels = 0;
    parentPIN = "";
    parentalArray = [];
    sSHLcolor = "120,100";
    sSHLcolSel = "240,100";
    sSHLcolorB = "255,0";
    window.sSHLcolor = sSHLcolor;
    window.sSHLcolSel = sSHLcolSel;
    window.sSHLcolorB = sSHLcolorB;
    if (initialSettings) {
        loadSettings();
        Object.keys(initialSettings).forEach((key) => {
            settings[key] = initialSettings[key];
        });
    }
    bodyColor = "#f0f0f0";
    setColor();
    setFontSize();
    setListPos();
    _channelsList(0, 0);
    window.__fixtureReady = true;
}

async function fixturePage(
    browser,
    profile,
    initialSettings,
    language,
    channelDescription
) {
    const capacitor = profile === "capacitor";
    const native = profile === "tauri" || capacitor;
    const stage = capacitor
        ? "dist-mobile/"
        : native
          ? "src-tauri/frontend/"
          : "";
    const html = read(native ? stage + "index.html" : "dist/index.html");
    const parsed = new JSDOM(html);
    const document = parsed.window.document;
    const viewport =
        document.querySelector('meta[name="viewport"]')?.outerHTML || "";
    for (const script of document.querySelectorAll("script")) script.remove();
    const body = document.body.outerHTML;
    const styles = Array.from(document.querySelectorAll("style"), (style) => {
        style.setAttribute("nonce", nonce);
        return style.outerHTML;
    });
    parsed.window.close();
    const scripts = [
        "/fixture-init.js",
        "/js/runtime-polyfills.js",
        ...(native ? ["/js/native-environment.js"] : []),
        native ? "/js/jquery.min.js" : "/js/jquery-1.11.1.min.js",
        "/js/ottplay-core.js",
        "/dist/player.js",
        ...(language ? ["/locales/" + language + ".js"] : []),
        "/fixture-render.js",
    ];
    const assets = new Map([
        [
            "/fixture-init.js",
            "(" +
                initializeFixture.toString() +
                ")(" +
                native +
                "," +
                capacitor +
                ");",
        ],
        [
            "/fixture-render.js",
            "(" +
                renderFixture.toString() +
                ")(" +
                JSON.stringify(initialSettings) +
                "," +
                JSON.stringify(channelDescription) +
                ");",
        ],
        ["/js/runtime-polyfills.js", read(stage + "js/runtime-polyfills.js")],
        ["/js/ottplay-core.js", read(stage + "js/ottplay-core.js")],
        ["/dist/player.js", read(stage + "dist/player.js")],
        ["/dist/modern-interface.js", read(stage + "dist/modern-interface.js")],
        ["/dist/provider-plex.js", read(stage + "dist/provider-plex.js")],
        ["/dist/provider-m3u.js", read(stage + "dist/provider-m3u.js")],
        ["/providers/m3u/about.html", read("providers/m3u/about.html")],
        [
            "/providers/m3u/logo.png",
            fs.readFileSync(path.join(root, "providers/m3u/logo.png")),
        ],
        [
            "/dist/subtitle-appearance.js",
            read(stage + "dist/subtitle-appearance.js"),
        ],
        ["/dist/color-appearance.js", read(stage + "dist/color-appearance.js")],
        ["/styles/player.css", read(stage + "styles/player.css")],
    ]);
    for (const file of scripts.filter((file) =>
        /jquery|native-environment|\/locales\//.test(file)
    ))
        assets.set(file, read(stage + file.slice(1)));
    if (!native) {
        for (const file of fs.readdirSync(path.join(root, "fonts"))) {
            if (/\.(woff2?|ttf|eot|svg)$/.test(file))
                assets.set(
                    "/fonts/" + file,
                    fs.readFileSync(path.join(root, "fonts", file))
                );
        }
    }
    const context = await browser.newContext({
        hasTouch: capacitor,
        isMobile: capacitor,
        serviceWorkers: "block",
        viewport: { height: 720, width: 1280 },
    });
    const page = await context.newPage();
    const errors = [];
    const unexpectedRequests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
        if (
            message.type() === "error" &&
            message.text().startsWith("[window.onerror]")
        )
            errors.push(message.text());
    });
    await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) {
            unexpectedRequests.push(url.origin + url.pathname);
            return route.abort("blockedbyclient");
        }
        if (url.pathname === "/") {
            return route.fulfill({
                body:
                    '<!doctype html><html><head><meta charset="utf-8">' +
                    viewport +
                    styles.join("\n") +
                    '<link rel="stylesheet" href="/styles/player.css"></head>' +
                    body.replace(
                        /<\/body>/i,
                        scripts
                            .map(
                                (src) =>
                                    '<script nonce="' +
                                    nonce +
                                    '" src="' +
                                    src +
                                    '"></script>'
                            )
                            .join("\n") + "</body>"
                    ) +
                    "</html>",
                contentType: "text/html; charset=utf-8",
                headers:
                    profile === "tauri"
                        ? { "Content-Security-Policy": nativePolicy() }
                        : {},
                status: 200,
            });
        }
        if (!assets.has(url.pathname)) {
            unexpectedRequests.push(url.pathname);
            return route.abort("blockedbyclient");
        }
        return route.fulfill({
            body: assets.get(url.pathname),
            contentType: url.pathname.endsWith(".css")
                ? "text/css"
                : url.pathname.endsWith(".html")
                  ? "text/html"
                  : url.pathname.endsWith(".png")
                    ? "image/png"
                    : url.pathname.startsWith("/fonts/")
                      ? "application/octet-stream"
                      : "text/javascript",
            status: 200,
        });
    });
    await page.goto(origin + "/");
    await expect
        .poll(() => page.evaluate(() => window.__fixtureReady), {
            message:
                profile +
                " fixture must finish the actual channel renderer: " +
                errors.join("; "),
        })
        .toBe(true);
    if (native) {
        await expect
            .poll(() => page.evaluate(() => window.__fixtureBackground.probes))
            .toBeGreaterThan(0);
        await expect
            .poll(() =>
                page.evaluate(() => window.__ottStandby.snapshot().state)
            )
            .toBe("running");
    }
    await expect(page.locator("#_name")).toContainText("Current bulletin");
    expect(errors).toEqual([]);
    expect(unexpectedRequests).toEqual([]);
    return { close: () => context.close(), errors, page, unexpectedRequests };
}

for (const colorProfile of ["server", "tauri", "capacitor"]) {
    for (const colorMode of [0, 1]) {
        test(`${colorProfile}: color draft survives Save, Q and a fresh document in mode ${colorMode}`, async ({
            browser,
        }) => {
            // An empty settings override makes every fresh document load the
            // real storage adapter, without reseeding the saved color bytes.
            // Hostile metadata has its own security cases. Inert parsing can
            // report its inline attributes as CSP violations before sanitizing.
            const fixture = await fixturePage(
                browser,
                colorProfile,
                {},
                undefined,
                "<b>Trusted description text</b><span>Metadata text</span>"
            );
            const context = fixture.page.context();
            let page = fixture.page;
            let primaryFailed = false;
            async function openColors() {
                await page.evaluate(() => window.settingsInterface());
                await page.waitForFunction(() =>
                    window.listArray.some(
                        (row) => row.settingId === "uiColorConfig"
                    )
                );
                await page.evaluate(() => {
                    const row = window.listArray.find(
                        (item) => item.settingId === "uiColorConfig"
                    );
                    row.values();
                });
                await expect(
                    page.locator("[data-ott-color-appearance]")
                ).toBeVisible();
            }
            async function saveOuterSettings() {
                // Invoke the real outer Save action, not a direct storage write.
                await page.evaluate(() => {
                    const row = window.listArray.find(
                        (item) =>
                            typeof item.name === "string" &&
                            item.name.includes("Save Settings")
                    );
                    if (!row || typeof row.values !== "function")
                        throw new Error("Missing outer Save");
                    row.values();
                });
            }
            async function renderSavedChannels() {
                await page.evaluate(() => {
                    window.setInterfaceMode();
                    window._channelsList(0, 0);
                });
                await expect
                    .poll(() =>
                        page.evaluate(() =>
                            document.body.classList.contains("interface-modern")
                                ? 1
                                : 0
                        )
                    )
                    .toBe(colorMode);
            }
            async function renderedPalette() {
                return page.evaluate(() => {
                    let time = document.getElementById("color-late-epg");
                    if (!time) {
                        time = document.createElement("span");
                        time.id = "color-late-epg";
                        time.className = "ott-epg-time";
                        document.getElementById("listDetail").appendChild(time);
                    }
                    // A late guide update must not retain a stale inline tint.
                    // Inherited mode measures the actual theme cascade instead.
                    time.style.color = window.settings.uiColorConfig
                        ? "rgb(1, 2, 3)"
                        : "";
                    const css = (selector, key) =>
                        getComputedStyle(document.querySelector(selector))[key];
                    return {
                        accent: css("#progress", "backgroundColor"),
                        background: css("#_t", "backgroundColor"),
                        border: css("#listCaption", "borderBottomColor"),
                        epgTime: css("#color-late-epg", "color"),
                        muted: css("#listTime", "color"),
                        selection: css(
                            "#listIn .item.ott-selected",
                            "backgroundColor"
                        ),
                        selectionText: css(
                            "#listIn .item.ott-selected",
                            "color"
                        ),
                        surface: css("#listCaption", "backgroundColor"),
                        text: css("body", "color"),
                    };
                });
            }
            async function inheritedSettings() {
                return page.evaluate(() => ({
                    backgroundHighlight: window.settings.highlightColorB,
                    epgTime: window.settings.epgTimeColor,
                    mode: window.settings.interfaceMode,
                    selectionHighlight: window.settings.highlightColorSel,
                    textHighlight: window.settings.highlightColor,
                    theme: window.settings.interfaceTheme,
                }));
            }
            const ocean = {
                accent: "rgb(94, 234, 212)",
                background: "rgb(6, 24, 38)",
                border: "rgb(59, 108, 131)",
                epgTime: "rgb(94, 234, 212)",
                muted: "rgb(163, 196, 213)",
                selection: "rgb(21, 94, 117)",
                selectionText: "rgb(255, 255, 255)",
                surface: "rgb(12, 41, 61)",
                text: "rgb(239, 250, 255)",
            };
            try {
                // An existing unrelated preference must survive color edits.
                await page.evaluate((mode) => {
                    window.stbSetItem("sOsdOpacity", "4");
                    window.stbSetItem("sInterfaceMode", String(mode));
                    window.loadSettings();
                    window.setColor();
                }, colorMode);
                await renderSavedChannels();
                const inheritedPalette = await renderedPalette();
                const inheritedValues = await inheritedSettings();
                await openColors();
                await page.locator('[data-color-action="scheme-3"]').click();
                await page.locator('[data-color-action="cancel"]').click();
                expect(
                    await page.evaluate(() =>
                        window.__ottSettingsEditor.get("uiColorConfig")
                    )
                ).toBe("");
                expect(
                    await page.evaluate(() =>
                        window.stbGetItem("sUiColorConfig")
                    )
                ).toBeNull();
                // Reopen within the same parent draft, choose a scheme and
                // prove Apply alone does not mutate live or persisted settings.
                await page.evaluate(() =>
                    window.listArray
                        .find((row) => row.settingId === "uiColorConfig")
                        .values()
                );
                await expect(
                    page.locator("[data-ott-color-appearance]")
                ).toBeVisible();
                await page.locator('[data-color-action="scheme-1"]').click();
                await page.locator('[data-color-action="apply"]').click();
                const saved = await page.evaluate((mode) => {
                    if (!window.__ottSettingsEditor.set("interfaceMode", mode))
                        throw new Error("Mode draft rejected");
                    return window.__ottSettingsEditor.get("uiColorConfig");
                }, colorMode);
                expect(JSON.parse(saved).colors.selection).toBe("#155E75");
                expect(
                    await page.evaluate(() => window.settings.uiColorConfig)
                ).toBe("");
                expect(
                    await page.evaluate(() =>
                        window.stbGetItem("sUiColorConfig")
                    )
                ).toBeNull();
                await saveOuterSettings();
                expect(
                    await page.evaluate(() =>
                        window.stbGetItem("sUiColorConfig")
                    )
                ).toBe(saved);
                await renderSavedChannels();
                expect(await renderedPalette()).toEqual(ocean);
                expect(
                    await page.evaluate(() => window.settings.osdOpacity)
                ).toBe(4);
                await page.evaluate(() => {
                    // This renderer fixture bypasses stbInit. Bind the real
                    // global handler before delivering a physical Q key.
                    window.stbBindKeyHandler();
                    window.stbExit = () => {
                        window.__colorQuit = true;
                    };
                    if (document.activeElement && document.activeElement.blur)
                        document.activeElement.blur();
                });
                await page.keyboard.press("q");
                await page.waitForFunction(() => window.__colorQuit === true);
                await page.close({ runBeforeUnload: true });
                page = await context.newPage();
                page.on("pageerror", (error) =>
                    fixture.errors.push(error.message)
                );
                await page.goto(origin + "/");
                await page.waitForFunction(() => window.__fixtureReady);
                expect(
                    await page.evaluate(() => window.settings.uiColorConfig)
                ).toBe(saved);
                expect(
                    await page.evaluate(() =>
                        window.stbGetItem("sUiColorConfig")
                    )
                ).toBe(saved);
                await renderSavedChannels();
                expect(await renderedPalette()).toEqual(ocean);
                expect(
                    await page.evaluate(() => window.settings.osdOpacity)
                ).toBe(4);
                expect(
                    await page.evaluate(() => window.__fixtureViolations)
                ).toEqual([]);
                await openColors();
                await page.locator('[data-color-action="scheme-3"]').click();
                await page.locator('[data-color-action="cancel"]').click();
                expect(
                    await page.evaluate(() =>
                        window.__ottSettingsEditor.get("uiColorConfig")
                    )
                ).toBe(saved);
                expect(
                    await page.evaluate(() => window.settings.uiColorConfig)
                ).toBe(saved);
                expect(
                    await page.evaluate(() =>
                        window.stbGetItem("sUiColorConfig")
                    )
                ).toBe(saved);
                await renderSavedChannels();
                expect(await renderedPalette()).toEqual(ocean);
                await openColors();
                await page.locator('[data-color-action="reset"]').click();
                await page.locator('[data-color-action="apply"]').click();
                expect(
                    await page.evaluate(() =>
                        window.stbGetItem("sUiColorConfig")
                    )
                ).toBe(saved);
                await saveOuterSettings();
                expect(
                    await page.evaluate(() =>
                        window.stbGetItem("sUiColorConfig")
                    )
                ).toBe("");
                await page.reload();
                await page.waitForFunction(() => window.__fixtureReady);
                expect(
                    await page.evaluate(() => window.settings.uiColorConfig)
                ).toBe("");
                expect(
                    await page.evaluate(() => window.settings.osdOpacity)
                ).toBe(4);
                await renderSavedChannels();
                expect(await inheritedSettings()).toEqual(inheritedValues);
                expect(await renderedPalette()).toEqual(inheritedPalette);
                expect(
                    await page.evaluate(() => ({
                        marker: document.body.classList.contains(
                            "ott-custom-colors"
                        ),
                        style:
                            document.getElementById(
                                "ott-interface-colors-style"
                            ) !== null,
                    }))
                ).toEqual({ marker: false, style: false });
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
                expect(
                    await page.evaluate(() => window.__fixtureViolations)
                ).toEqual([]);
            } catch (error) {
                primaryFailed = true;
                throw error;
            } finally {
                try {
                    await fixture.close();
                } catch (error) {
                    // A failed teardown must not hide the original assertion
                    // or timeout; a teardown-only failure still fails the test.
                    if (!primaryFailed) throw error;
                }
            }
        });
    }
}

// Runs once in each configured browser project. A persistent context owns its
// browser process, so closing it exercises disk persistence rather than merely
// creating another document in an existing in-memory BrowserContext.
test("server: saved colors survive a browser-process restart and stay profile-local", async ({
    playwright,
    browserName,
}) => {
    test.setTimeout(120000);
    const userDataRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "ottplay-color-restart-")
    );
    const savedProfile = path.join(userDataRoot, "saved");
    const freshProfile = path.join(userDataRoot, "fresh");
    let context;
    async function openProfile(userDataDir) {
        // Reuse all fixture routing/CSP/error checks. {} calls loadSettings()
        // without supplying any palette or exported storage state.
        return fixturePage(
            {
                async newContext(options) {
                    assert.equal(
                        context,
                        undefined,
                        "Close the previous browser before reopening its profile"
                    );
                    context = await playwright[
                        browserName
                    ].launchPersistentContext(userDataDir, {
                        ...options,
                        headless: true,
                        timeout: 15000,
                    });
                    context.setDefaultTimeout(10000);
                    context.setDefaultNavigationTimeout(10000);
                    return context;
                },
            },
            "server",
            {}
        );
    }
    async function closeProfile(fixture) {
        expect(fixture.errors).toEqual([]);
        expect(fixture.unexpectedRequests).toEqual([]);
        expect(
            await fixture.page.evaluate(() => window.__fixtureViolations)
        ).toEqual([]);
        const processBrowser = context.browser();
        expect(processBrowser).not.toBeNull();
        expect(processBrowser.isConnected()).toBe(true);
        await context.close();
        await expect.poll(() => processBrowser.isConnected()).toBe(false);
        context = undefined;
    }
    async function activateSetting(page, settingId) {
        const index = await page.evaluate((id) => {
            const target = window.listArray.findIndex((row) =>
                id === "save"
                    ? typeof row.name === "string" &&
                      row.name.includes("Save Settings")
                    : row.settingId === id
            );
            if (target < 0) throw new Error("Missing settings row: " + id);
            window.changeSelect(target - window.selIndex);
            return target;
        }, settingId);
        const row = page.locator("#it" + index);
        await expect(row).toHaveClass(/ott-selected/);
        await row.focus();
        // Exercise the current list owner and real Save callback via keyboard,
        // never assign settings or write storage from the test.
        await page.keyboard.press("Enter");
    }
    async function renderedPalette(page) {
        return page.evaluate(() => {
            let time = document.getElementById("color-restart-epg");
            if (!time) {
                time = document.createElement("span");
                time.id = "color-restart-epg";
                time.className = "ott-epg-time";
                document.getElementById("listDetail").appendChild(time);
            }
            const css = (selector, key) =>
                getComputedStyle(document.querySelector(selector))[key];
            return {
                accent: css("#progress", "backgroundColor"),
                background: css("#_t", "backgroundColor"),
                border: css("#listCaption", "borderBottomColor"),
                epgTime: css("#color-restart-epg", "color"),
                muted: css("#listTime", "color"),
                selection: css("#listIn .item.ott-selected", "backgroundColor"),
                selectionText: css("#listIn .item.ott-selected", "color"),
                surface: css("#listCaption", "backgroundColor"),
                text: css("body", "color"),
            };
        });
    }
    const ocean = {
        accent: "rgb(94, 234, 212)",
        background: "rgb(6, 24, 38)",
        border: "rgb(59, 108, 131)",
        epgTime: "rgb(94, 234, 212)",
        muted: "rgb(163, 196, 213)",
        selection: "rgb(21, 94, 117)",
        selectionText: "rgb(255, 255, 255)",
        surface: "rgb(12, 41, 61)",
        text: "rgb(239, 250, 255)",
    };
    try {
        const first = await openProfile(savedProfile);
        expect(
            await first.page.evaluate(() => window.settings.uiColorConfig)
        ).toBe("");
        expect(
            await first.page.evaluate(() => window.stbGetItem("sUiColorConfig"))
        ).toBeNull();
        const inherited = await renderedPalette(first.page);
        await first.page.evaluate(() => window.settingsInterface());
        await first.page.waitForFunction(() =>
            window.listArray.some((row) => row.settingId === "uiColorConfig")
        );
        await activateSetting(first.page, "uiColorConfig");
        await expect(
            first.page.locator("[data-ott-color-appearance]")
        ).toBeVisible();
        await first.page.locator('[data-color-action="scheme-1"]').click();
        await first.page.locator('[data-color-action="apply"]').click();
        const saved = await first.page.evaluate(() =>
            window.__ottSettingsEditor.get("uiColorConfig")
        );
        expect(JSON.parse(saved).colors.selection).toBe("#155E75");
        expect(
            await first.page.evaluate(() => window.settings.uiColorConfig)
        ).toBe("");
        expect(
            await first.page.evaluate(() => window.stbGetItem("sUiColorConfig"))
        ).toBeNull();
        await activateSetting(first.page, "save");
        expect(
            await first.page.evaluate(() => window.stbGetItem("sUiColorConfig"))
        ).toBe(saved);
        await first.page.evaluate(() => window._channelsList(0, 0));
        expect(await renderedPalette(first.page)).toEqual(ocean);
        await closeProfile(first);

        const restarted = await openProfile(savedProfile);
        expect(
            await restarted.page.evaluate(() => window.settings.uiColorConfig)
        ).toBe(saved);
        expect(
            await restarted.page.evaluate(() =>
                window.stbGetItem("sUiColorConfig")
            )
        ).toBe(saved);
        expect(await renderedPalette(restarted.page)).toEqual(ocean);
        await closeProfile(restarted);

        const fresh = await openProfile(freshProfile);
        expect(
            await fresh.page.evaluate(() => window.settings.uiColorConfig)
        ).toBe("");
        expect(
            await fresh.page.evaluate(() => window.stbGetItem("sUiColorConfig"))
        ).toBeNull();
        expect(await renderedPalette(fresh.page)).toEqual(inherited);
        expect(
            await fresh.page.evaluate(() => ({
                marker: document.body.classList.contains("ott-custom-colors"),
                style:
                    document.getElementById("ott-interface-colors-style") !==
                    null,
            }))
        ).toEqual({ marker: false, style: false });
        await closeProfile(fresh);
    } finally {
        try {
            if (context) await context.close();
        } finally {
            fs.rmSync(userDataRoot, { force: true, recursive: true });
        }
    }
});

async function listTouchFixture(browser, native = true) {
    const fixture = await fixturePage(browser, "server");
    // Gesture timings must be deliberate: IPC latency is not finger velocity.
    const clockStart = Date.now();
    await fixture.page.clock.install({ time: clockStart });
    await fixture.page.clock.pauseAt(clockStart + 1000);
    await fixture.page.evaluate((native) => {
        if (native) window.Capacitor = {};
        window.__touchClicks = [];
        window.__touchPlayed = [];
        window.playChannel = (...args) => window.__touchPlayed.push(args);
        const clicks = new WeakSet();
        const recordClick = (event) => {
            if (clicks.has(event)) return;
            clicks.add(event);
            window.__touchClicks.push(event.target.id);
        };
        window.addEventListener("click", recordClick, true);
        window.__touchBegin = (index, fingers = 1) => {
            const target =
                typeof index === "number"
                    ? document.getElementById("it" + index)
                    : index;
            if (!target) throw new Error("Touch target must be mounted");
            const rect = target.getBoundingClientRect();
            window.__touchGesture = {
                height: window.__ottListRowH,
                owner: window.__ottClassicScreenPort.listOwner(),
                target,
                x: rect.left + 20,
                y: rect.top + rect.height / 2,
            };
            // Detached rows no longer bubble to window after showPage replaces
            // innerHTML. Observe accidental clicks there as well as live rows.
            target.addEventListener("click", recordClick, true);
            return window.__touchSend("touchstart", 0, 0, false, fingers);
        };
        window.__touchSend = (
            type,
            rows = 0,
            dx = 0,
            fixedScreen = false,
            fingers = 1
        ) => {
            const gesture = window.__touchGesture;
            const x = gesture.x + dx;
            const y = gesture.y + rows * gesture.height;
            const touch = {
                clientX: x,
                clientY: y,
                identifier: 7,
                screenX: fixedScreen ? 0 : x,
                screenY: fixedScreen ? 0 : y,
                target: gesture.target,
            };
            const event = new Event(type, { bubbles: true, cancelable: true });
            const ended = type === "touchend" || type === "touchcancel";
            const touches = Array.from({ length: fingers }, (_, finger) => ({
                ...touch,
                identifier: touch.identifier + finger,
            }));
            Object.defineProperties(event, {
                changedTouches: { value: touches },
                targetTouches: { value: ended ? [] : touches },
                touches: { value: ended ? [] : touches },
            });
            // Keep the original target, including after it has been detached.
            gesture.target.dispatchEvent(event);
            return {
                connected: gesture.target.isConnected,
                index: window.selIndex,
                prevented: event.defaultPrevented,
            };
        };
    }, native);
    return fixture;
}

// Keep the ordinary browser input path while matching the portrait Family Hub.
// Other fixtures retain their desktop/native viewport and touch configuration.
function pcTouchListFixture(browser) {
    return listTouchFixture(
        {
            newContext: (options) =>
                browser.newContext({
                    ...options,
                    hasTouch: true,
                    isMobile: false,
                    viewport: { height: 1280, width: 721 },
                }),
        },
        false
    );
}

for (const direction of [-1, 1]) {
    test(`native fast flick coasts across several pages (${direction})`, async ({
        browser,
    }) => {
        const fixture = await listTouchFixture(browser);
        const page = fixture.page;
        try {
            await page.evaluate(() => {
                for (let number = 41; number <= 500; number++) {
                    const id = "fixture" + number;
                    cats.Fixture.push(id);
                    channels[id] = {
                        channel_name: "Fixture channel " + number,
                        rec: 0,
                    };
                }
                _channelsList(0, 250);
                window.__touchBegin(250);
            });
            for (const rows of [5.25, 10.25]) {
                await page.clock.runFor(30);
                await page.evaluate(
                    (rows) => window.__touchSend("touchmove", rows),
                    rows * direction
                );
            }
            const release = await page.evaluate((direction) => {
                window.__touchSend("touchend", 10.25 * direction);
                return {
                    index: window.selIndex,
                    pageSize: window.listPageSize,
                };
            }, direction);
            expect(release.index).toBe(250 - 10 * direction);
            await page.clock.runFor(1600);
            const end = await page.evaluate(() => window.selIndex);
            expect((release.index - end) * direction).toBeGreaterThanOrEqual(
                release.pageSize * 2
            );
            await expect(page.locator("#it" + end)).toBeVisible();
            expect(await page.evaluate(() => window.__touchClicks)).toEqual([]);
            expect(await page.evaluate(() => window.__touchPlayed)).toEqual([]);

            // A slow drag keeps its exact finger distance, without a tail.
            await page.evaluate(() => window.__touchBegin(window.selIndex));
            for (let step = 1; step <= 8; step++) {
                await page.clock.runFor(100);
                await page.evaluate(
                    (rows) => window.__touchSend("touchmove", rows),
                    (step * direction) / 2
                );
            }
            await page.evaluate(
                (rows) => window.__touchSend("touchend", rows),
                4.25 * direction
            );
            const slow = await page.evaluate(() => window.selIndex);
            expect(slow).toBe(end - 4 * direction);
            await page.clock.runFor(1600);
            expect(await page.evaluate(() => window.selIndex)).toBe(slow);
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    });
}

test("native list swipe continues across replaced pages and clamps both ends", async ({
    browser,
}) => {
    const fixture = await listTouchFixture(browser);
    const page = fixture.page;
    try {
        await page.evaluate(() => {
            window.changeSelect(21);
            window.__touchBegin(21);
        });
        // Vertical dominance still scrolls with substantial horizontal drift.
        // Screen coordinates deliberately differ: this path uses client pixels.
        const crossed = await page.evaluate(() =>
            window.__touchSend("touchmove", -9.25, 30, true)
        );
        expect(crossed).toEqual({
            connected: false,
            index: 30,
            prevented: true,
        });
        await expect(page.locator("#it30")).toBeVisible();
        expect(
            await page.evaluate(() =>
                window.__touchSend("touchmove", -13.25, 35, true)
            )
        ).toMatchObject({ connected: false, index: 34, prevented: true });
        expect(
            await page.evaluate(() => window.__touchSend("touchmove", -80))
        ).toMatchObject({ index: 39 });
        // Overscroll must not have to be unwound before reversing direction.
        expect(
            await page.evaluate(() => window.__touchSend("touchmove", -77.75))
        ).toMatchObject({ index: 37 });
        expect(
            await page.evaluate(() => window.__touchSend("touchmove", 80))
        ).toMatchObject({ index: 0 });
        expect(
            await page.evaluate(() => window.__touchSend("touchmove", 90))
        ).toMatchObject({ index: 0 });
        await page.evaluate(() => window.__touchSend("touchend", 90));
        await expect(page.locator("#it0")).toBeVisible();
        expect(await page.evaluate(() => window.__touchClicks)).toEqual([]);
        expect(await page.evaluate(() => window.__touchPlayed)).toEqual([]);
        expect(fixture.errors).toEqual([]);
        expect(fixture.unexpectedRequests).toEqual([]);
    } finally {
        await fixture.close();
    }
});

test("native list swipe never becomes a tap after reversal or a coalesced end", async ({
    browser,
}) => {
    const fixture = await listTouchFixture(browser);
    const page = fixture.page;
    try {
        const reversed = await page.evaluate(() => {
            window.changeSelect(10);
            window.__touchBegin(10);
            window.__touchSend("touchmove", -3.25);
            window.__touchSend("touchmove", 0);
            return window.__touchSend("touchend", 0);
        });
        expect(reversed.index).toBe(10);
        expect(await page.evaluate(() => window.__touchClicks)).toEqual([]);
        const ended = await page.evaluate(() => {
            window.__touchBegin(10);
            return window.__touchSend("touchend", -4.25);
        });
        expect(ended.index).toBe(14);
        expect(await page.evaluate(() => window.__touchClicks)).toEqual([]);
        await expect(page.locator("#it14")).toBeVisible();

        // The next stationary native tap activates its row immediately;
        // a drag must not poison the next gesture or activate its final row.
        await page.evaluate(() => {
            window.__touchBegin(8);
            window.__touchSend("touchend");
        });
        expect(await page.evaluate(() => window.selIndex)).toBe(8);
        expect(await page.evaluate(() => window.__touchClicks)).toEqual([
            "it8",
        ]);
        expect(await page.evaluate(() => window.__touchPlayed)).toEqual([
            [0, 8],
        ]);
        expect(await page.evaluate(() => window.isListVisible)).toBe(false);
        expect(fixture.errors).toEqual([]);
        expect(fixture.unexpectedRequests).toEqual([]);
    } finally {
        await fixture.close();
    }
});

test("native list taps activate selected and nested unfocused rows exactly once", async ({
    browser,
}) => {
    for (const index of [0, 8]) {
        const fixture = await listTouchFixture(browser);
        const page = fixture.page;
        try {
            await page.evaluate((index) => {
                const row = document.getElementById("it" + index);
                const target = row.querySelector("span");
                if (!target)
                    throw new Error("Rendered row must have a nested target");
                window.__touchBegin(target);
                // Ordinary finger jitter is a tap, not a list scroll.
                window.__touchSend("touchend", 0.1, 2);
            }, index);
            expect(await page.evaluate(() => window.selIndex)).toBe(index);
            expect(await page.evaluate(() => window.__touchPlayed)).toEqual([
                [0, index],
            ]);
            expect(await page.evaluate(() => window.__touchClicks.length)).toBe(
                1
            );
            expect(await page.evaluate(() => window.isListVisible)).toBe(false);
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    }
});

test("native mouse and remote keys and browser touch retain focus before activation", async ({
    browser,
}) => {
    for (const input of ["mouse", "remote", "browser-touch"]) {
        const fixture = await listTouchFixture(
            browser,
            input !== "browser-touch"
        );
        const page = fixture.page;
        try {
            if (input === "mouse") await page.locator("#it1").click();
            else if (input === "remote")
                await page.evaluate(() => window._doKey(window.keys.DOWN));
            else
                await page.evaluate(() => {
                    window.__touchBegin(1);
                    window.__touchSend("touchend");
                });
            expect(await page.evaluate(() => window.selIndex)).toBe(1);
            expect(await page.evaluate(() => window.__touchPlayed)).toEqual([]);
            expect(await page.evaluate(() => window.isListVisible)).toBe(true);
            if (input === "mouse") await page.locator("#it1").click();
            else if (input === "remote")
                await page.evaluate(() => window._doKey(window.keys.ENTER));
            else
                await page.evaluate(() => {
                    window.__touchBegin(1);
                    window.__touchSend("touchend");
                });
            expect(await page.evaluate(() => window.__touchPlayed)).toEqual([
                [0, 1],
            ]);
            expect(await page.evaluate(() => window.isListVisible)).toBe(false);
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    }
});

test("native list swipe cancellation and departed owners cannot operate another screen", async ({
    browser,
}) => {
    const fixture = await listTouchFixture(browser);
    const page = fixture.page;
    try {
        expect(
            await page.evaluate(() => {
                window.changeSelect(24);
                window.__touchBegin(24);
                window.__touchSend("touchmove", -3.25);
                window.__touchSend("touchcancel", -3.25);
                window.__touchSend("touchmove", -6.25);
                return window.__touchSend("touchend", -6.25).index;
            })
        ).toBe(27);
        const replaced = await page.evaluate(() => {
            window.__touchBegin(27);
            window.listArray = window.listArray.slice();
            window.listDataArray = window.listArray;
            window.selIndex = 0;
            window.showPage();
            window.__touchSend("touchmove", -5);
            window.__touchSend("touchend", -5);
            return {
                index: window.selIndex,
                oldActive: window.__touchGesture.owner.active(),
            };
        });
        expect(replaced).toEqual({ index: 0, oldActive: false });
        await page.evaluate(() => {
            window.__touchBegin(0);
            window.__touchAnswers = [];
            window.confirmBox(
                "Keep this dialog open?",
                () => window.__touchAnswers.push("yes"),
                () => window.__touchAnswers.push("no")
            );
            window.__touchSend("touchmove", -5);
            window.__touchSend("touchend", 0);
        });
        await expect(page.locator("#dialogbox")).toBeVisible();
        expect(await page.evaluate(() => window.selIndex)).toBe(0);
        expect(await page.evaluate(() => window.__touchAnswers)).toEqual([]);
        expect(await page.evaluate(() => window.__touchClicks)).toEqual([]);
        expect(await page.evaluate(() => window.__touchPlayed)).toEqual([]);
        expect(fixture.errors).toEqual([]);
        expect(fixture.unexpectedRequests).toEqual([]);
    } finally {
        await fixture.close();
    }
});

test("native list swipe leaves editor defaults and multifinger shortcuts intact", async ({
    browser,
}) => {
    const fixture = await listTouchFixture(browser);
    try {
        const result = await fixture.page.evaluate(() => {
            const host = document.createElement("div");
            host.innerHTML =
                '<input id="touch-input"><textarea id="touch-textarea"></textarea>' +
                '<select id="touch-select"><option id="touch-option">Choice</option></select>' +
                '<label for="touch-input"><span id="touch-label">Label</span></label>' +
                '<div contenteditable="true"><span id="touch-editable">Text</span></div>';
            document.getElementById("listIn").appendChild(host);
            const editorDefaults = [];
            for (const id of [
                "touch-input",
                "touch-textarea",
                "touch-select",
                "touch-option",
                "touch-label",
                "touch-editable",
            ]) {
                editorDefaults.push(
                    window.__touchBegin(document.getElementById(id)).prevented,
                    window.__touchSend("touchmove", -5).prevented,
                    window.__touchSend("touchend", -5).prevented
                );
            }
            host.remove();
            const keys = [];
            const alerts = [];
            window._doKey = (key) => keys.push(key);
            window.alert = (message) => alerts.push(message);
            for (const fingers of [2, 3]) {
                window.__touchBegin(0, fingers);
                window.__touchSend("touchend", 0, 0, false, fingers);
            }
            window.__touchBegin(0, 4);
            window.__touchSend("touchend", 0, 0, false, 4);
            window.__touchBegin(0);
            window.__touchSend("touchmove", -10);
            window.__touchSend("touchend", -10);
            const lockedIndex = window.selIndex;
            window.__touchBegin(0, 4);
            window.__touchSend("touchend", 0, 0, false, 4);
            window.__touchBegin(0);
            window.__touchSend("touchend", -3.25);
            return {
                alerts,
                clicks: window.__touchClicks,
                editorDefaults,
                expectedAlerts: [
                    window._("Touchscreen locked"),
                    window._("Touchscreen unlocked"),
                ],
                expectedKeys: [window.keys.ENTER, window.keys.SETUP],
                index: window.selIndex,
                keys,
                lockedIndex,
                played: window.__touchPlayed,
            };
        });
        expect(result.editorDefaults).toEqual(Array(18).fill(false));
        expect(result.keys).toEqual(result.expectedKeys);
        expect(result.alerts).toEqual(result.expectedAlerts);
        expect(result.lockedIndex).toBe(0);
        expect(result.index).toBe(3);
        expect(result.clicks).toEqual([]);
        expect(result.played).toEqual([]);
        expect(fixture.errors).toEqual([]);
        expect(fixture.unexpectedRequests).toEqual([]);
    } finally {
        await fixture.close();
    }
});

test("native list swipe cancels an added finger after paging in either lift order", async ({
    browser,
}) => {
    const fixture = await listTouchFixture(browser);
    try {
        for (const firstLift of ["original", "added"]) {
            const result = await fixture.page.evaluate((firstLift) => {
                const keys = [];
                window._doKey = (key) => keys.push(key);
                window.changeSelect(24 - window.selIndex);
                window.__touchBegin(24);
                window.__touchSend("touchmove", -3.25);
                const gesture = window.__touchGesture;
                const original = {
                    clientX: gesture.x,
                    clientY: gesture.y - 3.25 * gesture.height,
                    identifier: 7,
                    target: gesture.target,
                };
                const target = document.getElementById("it27");
                const box = target.getBoundingClientRect();
                const added = {
                    clientX: box.left + 30,
                    clientY: box.top + box.height / 2,
                    identifier: 8,
                    target,
                };
                for (const touch of [original, added]) {
                    touch.screenX = touch.clientX;
                    touch.screenY = touch.clientY;
                }
                function send(type, changed, touches) {
                    const event = new Event(type, {
                        bubbles: true,
                        cancelable: true,
                    });
                    Object.defineProperties(event, {
                        changedTouches: { value: [changed] },
                        targetTouches: {
                            value: touches.filter(
                                (touch) => touch.target === changed.target
                            ),
                        },
                        touches: { value: touches },
                    });
                    changed.target.dispatchEvent(event);
                    return event.defaultPrevented;
                }
                const prevented = [
                    send("touchstart", added, [original, added]),
                ];
                const first = firstLift === "original" ? original : added;
                const last = firstLift === "original" ? added : original;
                prevented.push(send("touchend", first, [last]));
                last.clientY -= 5 * gesture.height;
                last.screenY = last.clientY;
                prevented.push(send("touchmove", last, [last]));
                prevented.push(send("touchend", last, []));
                const index = window.selIndex;
                // The detached target must lose its temporary listeners after
                // the last lift, not retain a callback into another gesture.
                const released = !send("touchmove", original, [original]);
                window.__touchBegin(27);
                window.__touchSend("touchend", -3.25);
                return {
                    clicks: window.__touchClicks,
                    detached: !original.target.isConnected,
                    index,
                    keys,
                    nextIndex: window.selIndex,
                    prevented,
                    released,
                };
            }, firstLift);
            expect(result, firstLift).toEqual({
                clicks: [],
                detached: true,
                index: 27,
                keys: [],
                nextIndex: 30,
                prevented: [true, true, true, true],
                released: true,
            });
        }
        expect(fixture.errors).toEqual([]);
        expect(fixture.unexpectedRequests).toEqual([]);
    } finally {
        await fixture.close();
    }
});

test("browser list swipe follows row distance without activating a channel", async ({
    browser,
}) => {
    const fixture = await pcTouchListFixture(browser);
    try {
        const result = await fixture.page.evaluate(() => {
            window.changeSelect(10);
            window.__touchBegin(10);
            window.__touchSend("touchmove", -10);
            return window.__touchSend("touchend", -10);
        });
        expect(result.index).toBe(20);
        expect(await fixture.page.evaluate(() => window.__touchClicks)).toEqual(
            []
        );
        expect(await fixture.page.evaluate(() => window.__touchPlayed)).toEqual(
            []
        );
        expect(fixture.errors).toEqual([]);
        expect(fixture.unexpectedRequests).toEqual([]);
    } finally {
        await fixture.close();
    }
});

test("browser trusted touch crosses replaced channel pages and cancels cleanly", async ({
    browser,
    browserName,
}) => {
    test.skip(
        browserName !== "chromium",
        "CDP provides trusted touch movement"
    );
    const fixture = await pcTouchListFixture(browser);
    const page = fixture.page;
    try {
        const start = await page.evaluate(() => {
            _channelsList(0, 20);
            const target = document.getElementById("it20");
            window.__pcTouchTarget = target;
            window.__pcDetachedClicks = 0;
            window.__pcTrustedTouchSeen = false;
            target.addEventListener(
                "touchstart",
                (event) => {
                    window.__pcTrustedTouchSeen = event.isTrusted;
                },
                { once: true }
            );
            target.addEventListener("click", () => window.__pcDetachedClicks++);
            const rect = target.getBoundingClientRect();
            return {
                capacitor: typeof window.Capacitor,
                height: window.__ottListRowH,
                touch: navigator.maxTouchPoints,
                viewport: [innerWidth, innerHeight],
                x: rect.left + 20,
                y: rect.top + rect.height / 2,
            };
        });
        expect(start).toMatchObject({
            capacitor: "undefined",
            touch: 1,
            viewport: [721, 1280],
        });
        const cdp = await page.context().newCDPSession(page);
        const touch = (type, y) =>
            cdp.send("Input.dispatchTouchEvent", {
                touchPoints:
                    type === "touchEnd" || type === "touchCancel"
                        ? []
                        : [{ id: 1, x: start.x, y }],
                type,
            });
        await touch("touchStart", start.y);
        expect(await page.evaluate(() => window.__pcTrustedTouchSeen)).toBe(
            true
        );
        for (let step = 1; step <= 8; step++) {
            // A slow drag has no inertia: the row distance is deterministic.
            await page.clock.runFor(150);
            await touch("touchMove", start.y - step * start.height);
            expect(await page.evaluate(() => window.selIndex)).toBe(20 + step);
            if (step >= 5)
                expect(
                    await page.evaluate(
                        () => window.__pcTouchTarget.isConnected
                    )
                ).toBe(false);
        }
        await touch("touchEnd");
        await page.clock.runFor(1600);
        expect(await page.evaluate(() => window.selIndex)).toBe(28);
        await expect(page.locator("#it28")).toBeVisible();

        // A cancelled gesture must not coast or activate its final row; a fresh
        // gesture afterwards must still work, including back across a page.
        const rect = await page.locator("#it28").boundingBox();
        const nextY = rect.y + rect.height / 2;
        await touch("touchStart", nextY);
        await page.clock.runFor(150);
        await touch("touchMove", nextY - 3 * start.height);
        expect(await page.evaluate(() => window.selIndex)).toBe(31);
        await touch("touchCancel");
        await page.clock.runFor(1600);
        expect(await page.evaluate(() => window.selIndex)).toBe(31);
        const reset = await page.locator("#it31").boundingBox();
        const resetY = reset.y + reset.height / 2;
        await touch("touchStart", resetY);
        for (let step = 1; step <= 8; step++) {
            await page.clock.runFor(150);
            await touch("touchMove", resetY + step * start.height);
        }
        await touch("touchEnd");
        await page.clock.runFor(1600);
        expect(await page.evaluate(() => window.selIndex)).toBe(23);
        await expect(page.locator("#it23")).toBeVisible();
        expect(await page.evaluate(() => window.__pcDetachedClicks)).toBe(0);
        expect(await page.evaluate(() => window.__touchClicks)).toEqual([]);
        expect(await page.evaluate(() => window.__touchPlayed)).toEqual([]);
        expect(await page.evaluate(() => window.isListVisible)).toBe(true);
        expect(fixture.errors).toEqual([]);
        expect(fixture.unexpectedRequests).toEqual([]);
    } finally {
        await fixture.close();
    }
});

test("browser portrait touch keeps tap mouse keyboard and wheel selection policy", async ({
    browser,
}) => {
    for (const input of ["touch", "mouse", "keyboard"]) {
        const fixture = await pcTouchListFixture(browser);
        const page = fixture.page;
        try {
            await page.evaluate(() => {
                window.stbBindKeyHandler();
                window.changeSelect(4);
            });
            await page.locator("#it4").hover();
            await page.mouse.wheel(0, -120);
            await expect
                .poll(() => page.evaluate(() => window.selIndex))
                .toBe(3);
            await page.mouse.wheel(0, 120);
            await expect
                .poll(() => page.evaluate(() => window.selIndex))
                .toBe(4);
            if (input === "touch") await page.locator("#it5").tap();
            else if (input === "mouse") await page.locator("#it5").click();
            else await page.keyboard.press("ArrowDown");
            expect(await page.evaluate(() => window.selIndex)).toBe(5);
            expect(await page.evaluate(() => window.__touchPlayed)).toEqual([]);
            expect(await page.evaluate(() => window.isListVisible)).toBe(true);
            if (input === "touch") await page.locator("#it5").tap();
            else if (input === "mouse") await page.locator("#it5").click();
            else await page.keyboard.press("Enter");
            expect(await page.evaluate(() => window.__touchPlayed)).toEqual([
                [0, 5],
            ]);
            expect(await page.evaluate(() => window.isListVisible)).toBe(false);
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    }
});

async function seedModernMovies(page, count, selected) {
    await page.evaluate(
        ({ count, selected }) => {
            const titles = [
                "Northern Passage",
                "Under City Lights",
                "Ocean of Silence",
                "Beyond the Signal",
            ];
            const colors = [
                ["#0b2942", "#36b8af"],
                ["#301846", "#df8a63"],
                ["#082e44", "#49a7cd"],
                ["#20243e", "#e5be70"],
            ];
            const posters = colors.map(
                ([sky, light]) =>
                    "data:image/svg+xml;charset=utf-8," +
                    encodeURIComponent(
                        `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="${light}"/></linearGradient></defs><path fill="url(#sky)" d="M0 0h360v480H0z"/><circle fill="${light}" opacity=".8" cx="248" cy="140" r="66"/><path fill="#142a35" opacity=".65" d="M0 310L88 181 175 285 280 218 360 322V480H0z"/><path fill="#091b29" d="M0 387L121 280 241 354 360 286V480H0z"/><path fill="#eff9e8" opacity=".16" d="M110 480l132-144-92 144z"/></svg>`
                    )
            );
            const description =
                "A quiet journey through changing landscapes brings four strangers together. Each must choose what to leave behind before the final crossing. An original fixture story with a complete, readable description.";
            const ids = [];
            for (let index = 0; index < count; index++) {
                const id = "movie-" + index;
                const title = titles[index % titles.length];
                ids.push(id);
                channels[id] = {
                    __ottMediaItem: {
                        __ottMediaCollection: "Movies",
                        description,
                        name: title,
                        poster: posters[index % posters.length],
                    },
                    channel_name: title,
                    descr: description,
                    icon: posters[index % posters.length],
                    name: title,
                };
            }
            catsArray[0] = "Movies";
            cats.Movies = ids;
            _channelsList(0, selected);
            saveSettings({ interfaceMode: 1 });
        },
        { count, selected }
    );
}

async function saveModernScreenshot(page, profile, view) {
    const directory = process.env.OTTP_MODERN_SCREENSHOTS;
    if (!directory) return;
    fs.mkdirSync(directory, { recursive: true });
    await page.evaluate(async () => {
        const art = document.querySelector(".ott-selected .modern-art img");
        if (!art) return;
        const left = document
            .getElementById("_l")
            .getBoundingClientRect().right;
        const top = document
            .getElementById("_t")
            .getBoundingClientRect().bottom;
        const right = document
            .getElementById("_r")
            .getBoundingClientRect().left;
        const bottom = document
            .getElementById("_b")
            .getBoundingClientRect().top;
        if (right <= left || bottom <= top) return;
        // Local synthetic frame in the fixture's otherwise empty video plane.
        // The actual compiled UI, including its preview masks, stays untouched.
        const frame = document.createElement("img");
        frame.id = "modern-fixture-frame";
        frame.setAttribute("aria-hidden", "true");
        frame.src = art.src;
        Object.assign(frame.style, {
            height: bottom - top + "px",
            left: left + "px",
            objectFit: "cover",
            pointerEvents: "none",
            position: "fixed",
            top: top + "px",
            width: right - left + "px",
            zIndex: "0",
        });
        document.body.insertBefore(frame, document.body.firstChild);
        if (frame.decode) await frame.decode().catch(() => {});
    });
    await page.screenshot({
        fullPage: true,
        path: path.join(
            directory,
            `${profile}-${test.info().project.name}-${view}.png`
        ),
    });
    await page.evaluate(() =>
        document.getElementById("modern-fixture-frame")?.remove()
    );
}

for (const profile of ["server", "tauri", "capacitor"]) {
    test(
        profile + " remote channel selection closes the list after admission",
        async ({ browser }) => {
            // Hostile metadata is tested by the rich-channel security case.
            // New Chromium reports CSP even during inert parsing; this case
            // requires no application-generated inline event handlers.
            const fixture = await fixturePage(
                browser,
                profile,
                undefined,
                undefined,
                "<b>Trusted description text</b><span>Metadata text</span>"
            );
            const page = fixture.page;
            try {
                await page.evaluate(() => {
                    window.channelsList = window._channelsList;
                    window.curList = window.cList = window.cats.Fixture;
                    window.catIndex = window.primaryIndex = 0;
                    window.commandChannelsReady = true;
                    window.settings.stopPlay = 0;
                    window.settings.infoSwitch = 0;
                    window.__remotePlayed = [];
                    // Keep command admission, selection and overlays real; only
                    // replace provider/decoder boundaries in this offline fixture.
                    window.getChannelUrl = (id) => "fixture:" + id;
                    window.stbPlay = (url) => window.__remotePlayed.push(url);
                    window.setPlayer = () => {};
                    window.checkMedia = () => {};
                    window.providerGetItem = () => null;
                    window.providerSetItem = () => {};
                });
                const list = page.locator("#list");
                const play = (query, pendingPreview) =>
                    page.evaluate(
                        ({ query, pendingPreview }) =>
                            new Promise((resolve) => {
                                if (pendingPreview)
                                    window.previewChId(pendingPreview);
                                executeRemoteRequest(
                                    { action: "play", params: { query } },
                                    resolve
                                );
                            }),
                        { pendingPreview, query }
                    );
                const openList = () =>
                    page.evaluate(() => {
                        window.__remotePlayed = [];
                        window.channelsList(
                            window.catIndex,
                            window.primaryIndex
                        );
                    });
                const playback = () =>
                    page.evaluate(() => ({
                        channel: window.curList[window.primaryIndex],
                        played: window.__remotePlayed,
                        preview: window.previewChan,
                        visible: window.isListVisible,
                    }));

                if (profile !== "server") {
                    // A pending native probe must reject admission without
                    // claiming playback or closing the user's current list.
                    await page.evaluate(() => {
                        window.__ottStandby.native(
                            window.__ottNativeStandby,
                            () =>
                                new Promise((resolve) => {
                                    window.__finishFixtureProbe = resolve;
                                })
                        );
                    });
                    await expect
                        .poll(() =>
                            page.evaluate(
                                () =>
                                    typeof window.__finishFixtureProbe ===
                                        "function" &&
                                    window.__ottStandby.blocked()
                            )
                        )
                        .toBe(true);
                    const beforeBlocked = await playback();
                    expect(await play("2")).toMatchObject({
                        data: { error: "Playback was rejected by the player." },
                        status: "rejected",
                    });
                    await expect(list).toBeVisible();
                    expect(await playback()).toEqual(beforeBlocked);
                    for (const command of [
                        { channel_number: 2, command: "channel_by_number" },
                        { channel_name: "Films", command: "channel_by_name" },
                        { command: "random_channel", random_range: [1, 1] },
                    ]) {
                        expect(
                            await page.evaluate(
                                (value) => window.handleCommand(value),
                                command
                            )
                        ).toBe("rejected");
                    }
                    expect(await playback()).toEqual(beforeBlocked);
                    await page.evaluate(() =>
                        window.__finishFixtureProbe({
                            pending: 0,
                            quiescent: false,
                            standby: false,
                        })
                    );
                    await expect
                        .poll(() =>
                            page.evaluate(
                                () => window.__ottStandby.snapshot().state
                            )
                        )
                        .toBe("running");
                }

                // The actual ott request handler must enter fullscreen even
                // when the requested channel is already playing.
                for (const query of ["2", "2"]) {
                    await openList();
                    await expect(list).toBeVisible();
                    expect((await play(query)).status).toBe("ok");
                    await expect(list).toBeHidden();
                    expect(await playback()).toMatchObject({
                        channel: "two",
                        played: ["fixture:two"],
                        visible: false,
                    });
                }

                // Legacy remote commands share the same production admission.
                for (const command of [
                    { channel_number: 1, command: "channel_by_number" },
                    { channel_name: "Films", command: "channel_by_name" },
                    { command: "random_channel", random_range: [1, 1] },
                ]) {
                    await openList();
                    await expect(list).toBeVisible();
                    await page.evaluate(
                        (command) => window.handleCommand(command),
                        command
                    );
                    await expect(list).toBeHidden();
                    expect(await playback()).toMatchObject({
                        channel:
                            command.command === "channel_by_name"
                                ? "two"
                                : "one",
                        played: [
                            command.command === "channel_by_name"
                                ? "fixture:two"
                                : "fixture:one",
                        ],
                        visible: false,
                    });
                }

                // Closing an active preview must not restore the old stream;
                // a pending preview must not replace the remote choice later.
                await page.evaluate(() => {
                    window.sPreview = 1;
                });
                for (const previewStarted of [true, false]) {
                    await openList();
                    if (previewStarted) {
                        await page.evaluate(() =>
                            window.previewChId("fixture3")
                        );
                        await expect
                            .poll(() =>
                                page.evaluate(() => window.__remotePlayed)
                            )
                            .toEqual(["fixture:fixture3"]);
                        await page.evaluate(() => {
                            window.__remotePlayed = [];
                        });
                    }
                    expect(
                        (
                            await play(
                                "2",
                                previewStarted ? undefined : "fixture3"
                            )
                        ).status
                    ).toBe("ok");
                    await expect(list).toBeHidden();
                    await page.waitForTimeout(650);
                    expect(await playback()).toEqual({
                        channel: "two",
                        played: ["fixture:two"],
                        preview: null,
                        visible: false,
                    });
                }

                await page.evaluate(() => {
                    window.sPreview = 0;
                    window.settings.psChannels = window.sPSchannels = 1;
                    // Exercise the real protected-record verifier, not a legacy plaintext fixture.
                    window.parentPIN = window.__ottPinSecurity.prepare("1234");
                    window.parentalArray = ["one"];
                    window.__ottParental.revoke();
                });
                await openList();
                expect((await play("9999")).status).toBe("rejected");
                await expect(list).toBeVisible();
                expect((await playback()).played).toEqual([]);

                // A remote request may dispatch a PIN challenge, but cannot
                // dismiss the list or start media until the real PIN succeeds.
                expect((await play("1")).status).toBe("ok");
                const dialog = page.locator("#dialogbox");
                await expect(dialog).toBeVisible();
                await expect(list).toBeVisible();
                expect((await playback()).played).toEqual([]);
                expect((await play("9999")).status).toBe("rejected");
                await expect(dialog).toBeVisible();
                for (let digit = 0; digit < 4; digit++)
                    await page.locator("#k0 .btn").click();
                await expect(dialog).toBeHidden();
                await expect(list).toBeVisible();
                expect((await playback()).played).toEqual([]);

                expect((await play("1")).status).toBe("ok");
                await expect(dialog).toBeVisible();
                for (const digit of [1, 2, 3, 4])
                    await page.locator("#k" + digit + " .btn").click();
                await expect(dialog).toBeHidden();
                await expect(list).toBeHidden();
                expect(await playback()).toMatchObject({
                    channel: "one",
                    played: ["fixture:one"],
                    visible: false,
                });
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
                expect(
                    await page.evaluate(() =>
                        window.__fixtureViolations.filter((directive) =>
                            directive.startsWith("script-src")
                        )
                    )
                ).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );
}

for (const profile of ["server", "tauri"]) {
    test(
        profile +
            " settings value grid works under CSP and retains draft semantics",
        async ({ browser }) => {
            const fixture = await fixturePage(browser, profile);
            const page = fixture.page;
            try {
                await page.evaluate(() => settingsInterface());
                await page.waitForFunction(() =>
                    listArray.some((row) => row.settingId === "interfaceTheme")
                );
                await page.evaluate(() => {
                    window.__valueRow = listArray.find(
                        (row) => row.settingId === "interfaceTheme"
                    );
                    window.__originalTheme = __valueRow.val;
                    __valueRow.val = 0;
                });
                await page.evaluate(
                    () =>
                        new Promise((resolve) =>
                            requestAnimationFrame(() =>
                                requestAnimationFrame(resolve)
                            )
                        )
                );
                await page.evaluate(() => {
                    window.__fixtureViolations = [];
                    selectValue(__valueRow);
                });
                const choice = page.locator("#ik1");
                await expect(choice).toHaveCSS("line-height", "32px");
                const widths = await page
                    .locator("#listAbout .osk-key")
                    .evaluateAll((rows) =>
                        rows.map((row) => row.getBoundingClientRect().width)
                    );
                expect(widths).toHaveLength(3);
                expect(widths[0]).toBeGreaterThan(200);
                expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(
                    1
                );
                await choice.click();
                expect(await page.evaluate(() => __valueRow.val)).toBe(0);
                await expect(page.locator("#listDetail")).toHaveText("PLi-HD");
                await expect(page.locator("#listAbout")).toBeVisible();
                expect(await page.evaluate(() => __fixtureViolations)).toEqual(
                    []
                );
                await choice.click();
                expect(await page.evaluate(() => __valueRow.val)).toBe(1);
                await expect(page.locator("#listAbout")).toBeHidden();
                // The value picker updates the draft; cancelling Settings keeps saved state.
                await page.evaluate(() => _doKey(keys.RETURN));
                await page.evaluate(() => settingsInterface());
                await page.waitForFunction(() =>
                    listArray.some((row) => row.settingId === "interfaceTheme")
                );
                expect(
                    await page.evaluate(
                        () =>
                            listArray.find(
                                (row) => row.settingId === "interfaceTheme"
                            ).val === __originalTheme
                    )
                ).toBe(true);
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );
    test(
        profile + " a newer notification keeps its full visible lifetime",
        async ({ browser }) => {
            const fixture = await fixturePage(browser, profile);
            const page = fixture.page;
            try {
                // install() keeps wall time running until explicitly paused.
                await page.clock.install({ time: 0 });
                await page.clock.pauseAt(60000);
                const local = page.locator(
                    "#notifications .remote-notify-local"
                );
                await page.evaluate(() => showShift("Previous notification"));
                await page.clock.runFor(2500);
                await page.evaluate(() => showShift("Settings saved"));
                await page.clock.runFor(500);
                await expect(local).toBeVisible();
                await expect(local).toHaveText("Settings saved");
                await page.clock.runFor(2499);
                await expect(local).toBeVisible();
                await page.clock.runFor(1);
                await expect(local).toHaveCount(0);
                await page.evaluate(() => showShift("Detached notification"));
                await page.clock.runFor(2500);
                await page.evaluate(() => {
                    const oldContainer =
                        document.getElementById("notifications");
                    oldContainer.replaceWith(oldContainer.cloneNode(false));
                    showShift("Replacement node");
                });
                await page.clock.runFor(500);
                await expect(local).toBeVisible();
                await expect(local).toHaveText("Replacement node");
                await page.clock.runFor(2499);
                await expect(local).toBeVisible();
                await page.clock.runFor(1);
                await expect(local).toHaveCount(0);
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );
    test(
        profile + " confirmation buttons keep their meaning under CSP",
        async ({ browser }) => {
            const fixture = await fixturePage(browser, profile);
            const page = fixture.page;
            try {
                await page.evaluate(() => {
                    // Reinitialization must not bind another activation handler.
                    window.uiInit();
                    window.uiInit();
                    window.stbBindKeyHandler();
                    window.closeList();
                });
                for (const answer of ["No", "Yes"]) {
                    for (const action of ["click", "Enter", "Space"]) {
                        await page.evaluate(() => {
                            window.__fixtureViolations = [];
                            window.__dialogAnswers = [];
                            window.confirmBox(
                                "Continue watching?",
                                () => window.__dialogAnswers.push("Yes"),
                                () => window.__dialogAnswers.push("No")
                            );
                        });
                        const button = page
                            .locator("#dialogbox")
                            .getByRole("button", { exact: true, name: answer });
                        if (action === "click")
                            await button.locator(".btn").click();
                        else {
                            await button.focus();
                            await page.keyboard.press(action);
                        }
                        await expect(page.locator("#dialogbox")).toBeHidden();
                        await expect(page.locator("#list_window")).toBeHidden();
                        expect(
                            await page.evaluate(() => window.__dialogAnswers)
                        ).toEqual([answer]);
                        expect(
                            await page.evaluate(
                                () => window.__fixtureViolations
                            )
                        ).toEqual([]);
                    }
                }
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );
    test(
        profile + " quality picker consumes clicks and preserves resume input",
        async ({ browser }) => {
            const fixture = await fixturePage(browser, profile);
            const page = fixture.page;
            try {
                await page.evaluate(() => {
                    window.stbBindKeyHandler();
                    window.__qualityChosen = [];
                    window.__qualityResumed = 0;
                    window.curColor = "#ffffff";
                    window.curColorB = "#345678";
                    window.__openQuality = () => {
                        window.__fixtureViolations = [];
                        window.showSelectBox(
                            0,
                            ["480", "720", "1080", "auto"],
                            (index) => {
                                window.__qualityChosen.push(index);
                                window.closeList();
                                window.confirmBox("Continue watching?", () => {
                                    window.__qualityResumed++;
                                });
                            },
                            -1,
                            true
                        );
                    };
                    window.__openQuality();
                });
                const picker = page.locator("#numprog");
                const selected = picker.getByRole("button", {
                    exact: true,
                    name: "480",
                });
                const fullHd = picker.getByRole("button", {
                    exact: true,
                    name: "1080",
                });
                await expect(selected).toHaveAttribute("aria-pressed", "true");
                await expect(selected).toHaveCSS(
                    "background-color",
                    "rgb(52, 86, 120)"
                );
                await fullHd.click();
                await expect(fullHd).toHaveAttribute("aria-pressed", "true");
                await expect(fullHd).toHaveCSS(
                    "background-color",
                    "rgb(52, 86, 120)"
                );
                await expect(page.locator("#list_window")).toBeHidden();
                expect(
                    await page.evaluate(() => window.__qualityChosen)
                ).toEqual([]);
                await fullHd.click();
                await expect(picker).toBeHidden();
                await expect(page.locator("#dialogbox")).toContainText(
                    "Continue watching?"
                );
                expect(
                    await page.evaluate(() => window.__qualityChosen)
                ).toEqual([2]);
                expect(await page.evaluate(() => window.__qualityResumed)).toBe(
                    0
                );
                await page.keyboard.press("Enter");
                await expect(page.locator("#dialogbox")).toBeHidden();
                await expect(page.locator("#list_window")).toBeHidden();
                expect(await page.evaluate(() => window.__qualityResumed)).toBe(
                    1
                );

                await page.evaluate(() => window.__openQuality());
                await page.keyboard.press("ArrowDown");
                await page.keyboard.press("ArrowDown");
                await expect(fullHd).toHaveAttribute("aria-pressed", "true");
                await page.keyboard.press("Enter");
                await expect(page.locator("#dialogbox")).toBeVisible();
                expect(
                    await page.evaluate(() => window.__qualityChosen)
                ).toEqual([2, 2]);
                expect(await page.evaluate(() => window.__qualityResumed)).toBe(
                    1
                );
                await page.keyboard.press("Enter");
                await expect(page.locator("#dialogbox")).toBeHidden();
                await expect(page.locator("#list_window")).toBeHidden();
                expect(await page.evaluate(() => window.__qualityResumed)).toBe(
                    2
                );

                await page.evaluate(() => window.__openQuality());
                await selected.focus();
                await page.keyboard.press("Space");
                await expect(page.locator("#dialogbox")).toBeVisible();
                expect(
                    await page.evaluate(() => window.__qualityChosen)
                ).toEqual([2, 2, 0]);
                expect(await page.evaluate(() => window.__qualityResumed)).toBe(
                    2
                );
                expect(
                    await page.evaluate(() => window.__fixtureViolations)
                ).toEqual([]);
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );
    test(
        profile +
            " archive confirmation preserves translated lines and choices",
        async ({ browser }) => {
            for (const [language, title, age, yes, no] of [
                [
                    "english",
                    "Resume from archive?",
                    "Bookmark age (days): 0",
                    "Yes",
                    "No",
                ],
                [
                    "russian",
                    "Продолжить из архива?",
                    "Давность закладки (дни): 0",
                    "Да",
                    "Нет",
                ],
            ]) {
                const fixture = await fixturePage(
                    browser,
                    profile,
                    undefined,
                    language
                );
                const page = fixture.page;
                try {
                    const archiveStart = await page.evaluate(() => {
                        // Provider startup normally installs numeric channel
                        // IDs and the production keyboard listener.
                        window.channels[101] = window.channels.one;
                        window.cats.Fixture = [101];
                        window.curList = window.cats.Fixture;
                        window.catIndex = window.primaryIndex = 0;
                        window.stbBindKeyHandler();
                        const start = Math.floor(Date.now() / 1000) - 3600;
                        const stored = new Map([
                            [
                                "continueWatch",
                                JSON.stringify({
                                    catIndex: 0,
                                    channelId: 101,
                                    mode: "archive",
                                    playTime: 25,
                                    playType: start,
                                    updatedAt: Date.now(),
                                    v: 1,
                                }),
                            ],
                        ]);
                        window.providerGetItem = (key) =>
                            stored.get(key) ?? null;
                        window.providerSetItem = (key, value) =>
                            stored.set(key, value);
                        window.__confirmationChoices = [];
                        window.playArchive = (time) =>
                            window.__confirmationChoices.push([
                                "archive",
                                time,
                            ]);
                        window.playChannel = (category, index) =>
                            window.__confirmationChoices.push([
                                "live",
                                category,
                                index,
                            ]);
                        window.stbIsPlaying = () => false;
                        return start;
                    });
                    const dialog = page.locator("#dialogbox");
                    for (const accept of [true, false]) {
                        expect(
                            await page.evaluate(() => restoreContinueWatch())
                        ).toBe(true);
                        await expect(dialog).toBeVisible();
                        await expect(dialog).toContainText(title);
                        await expect(dialog).toContainText(age);
                        await expect(dialog).not.toContainText(
                            /<br\s*\/?\s*>/i
                        );
                        await expect(
                            dialog.locator(".localized-text > br")
                        ).toHaveCount(2);
                        await expect(dialog.locator("center > br")).toHaveCount(
                            2
                        );
                        const lines = await dialog.evaluate((element) => {
                            const nodes = [
                                ...element.querySelector(".localized-text")
                                    .childNodes,
                            ].filter(
                                (node) =>
                                    node.nodeType === Node.TEXT_NODE &&
                                    node.textContent.trim()
                            );
                            return nodes.slice(0, 2).map((node) => {
                                const range = document.createRange();
                                range.selectNodeContents(node);
                                const rect = range.getBoundingClientRect();
                                return { height: rect.height, top: rect.top };
                            });
                        });
                        expect(lines).toHaveLength(2);
                        expect(lines[1].top - lines[0].top).toBeGreaterThan(
                            lines[0].height * 1.5
                        );
                        await expect(
                            dialog.getByRole("button", {
                                exact: true,
                                name: yes,
                            })
                        ).toBeVisible();
                        await expect(
                            dialog.getByRole("button", {
                                exact: true,
                                name: no,
                            })
                        ).toBeVisible();
                        if (accept) await page.keyboard.press("Enter");
                        else if (profile === "tauri")
                            await page.keyboard.press("Backspace");
                        else
                            await dialog
                                .getByRole("button", { exact: true, name: no })
                                .click();
                        await expect(dialog).toBeHidden();
                    }
                    expect(
                        await page.evaluate(() => window.__confirmationChoices)
                    ).toEqual([
                        ["archive", archiveStart],
                        ["live", 0, 0],
                    ]);
                    expect(fixture.errors).toEqual([]);
                    expect(fixture.unexpectedRequests).toEqual([]);
                } finally {
                    await fixture.close();
                }
            }
        }
    );

    test(
        profile +
            " confirmation allows only plain breaks and keeps markup inert",
        async ({ browser }) => {
            const fixture = await fixturePage(browser, profile);
            const page = fixture.page;
            try {
                const markup =
                    '<img src="/injected" onerror="window.__confirmationInjected=true"><svg onload="window.__confirmationInjected=true"></svg><script>window.__confirmationInjected=true</script><br onclick="window.__confirmationInjected=true">&lt;br&gt;';
                await page.evaluate((untrusted) => {
                    window.stbBindKeyHandler();
                    window.__confirmationChoices = [];
                    confirmBox(
                        "Title<br>A<br/>B<BR />C\r\nD\rE\nF" + untrusted,
                        () => window.__confirmationChoices.push("yes"),
                        () => window.__confirmationChoices.push("no")
                    );
                }, markup);
                const dialog = page.locator("#dialogbox");
                await expect(dialog).toBeVisible();
                await expect(dialog.locator("center > br")).toHaveCount(2);
                await expect(
                    dialog.locator(".localized-text > br")
                ).toHaveCount(6);
                await expect(
                    dialog.locator("img, svg, script, br[onclick]")
                ).toHaveCount(0);
                await expect(dialog).toContainText(markup);
                expect(
                    await page.evaluate(() => window.__confirmationInjected)
                ).toBeUndefined();
                await page.keyboard.press("Backspace");
                await expect(dialog).toBeHidden();
                expect(
                    await page.evaluate(() => window.__confirmationChoices)
                ).toEqual(["no"]);
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );
}

for (const profile of ["server", "tauri", "capacitor"]) {
    test(
        profile +
            " new script catalogs preserve native IME composition and RTL text",
        async ({ browser }) => {
            const fixture = await fixturePage(
                browser,
                profile,
                undefined,
                "arabic"
            );
            const page = fixture.page;
            try {
                await page.evaluate(() => {
                    window.stbBindKeyHandler();
                    window.__languageInputSaves = [];
                });
                const stage =
                    profile === "capacitor"
                        ? "dist-mobile/"
                        : profile === "tauri"
                          ? "src-tauri/frontend/"
                          : "";
                const languageCases = [
                    ["_ara", "arabic", "أخبار ١٢ العربية"],
                    ["_per", "persian", "می\u200cروم فارسی"],
                    ["_hin", "hindi", "हिन्दी समाचार"],
                    ["_mal", "malayalam", "മലയാളം വാർത്തകൾ"],
                    ["_chi", "chinese", "中文新闻𠀀"],
                    ["_jpn", "japanese", "ニュース東京"],
                    ["_kor", "korean", "한글한"],
                    ["_geo", "georgian", "ქართული ამბები"],
                    ["_amh", "amharic", "አማርኛ ዜና"],
                    ["_lao", "lao", "ຂ່າວ\u200bລາວ"],
                    ["_ori", "odia", "ଓଡ଼ିଆ ସମ୍ବାଦ"],
                    ["_asm", "assamese", "অসমীয়া বাতৰি"],
                    ["_snd", "sindhi", "سنڌي خبرون"],
                    ["_yor", "yoruba", "Ìròyìn Yorùbá ẹ́"],
                    ["_ibo", "igbo", "Akụkọ Igbo ụ̀"],
                ];
                for (const [code, name, value] of languageCases) {
                    const dictionary = readDictionary(
                        path.join(root, stage, "locales", name + ".js")
                    );
                    await page.evaluate(
                        ({ code, dictionary }) => {
                            window.keyStrings = dictionary;
                            stbSetItem("ottplaylang", code);
                            window.editCaption = dictionary.Search;
                            window.editvar = "";
                            window.setEdit = () =>
                                window.__languageInputSaves.push(
                                    window.editvar
                                );
                            showEditKey1();
                        },
                        { code, dictionary }
                    );
                    const input = page.locator("#editvar");
                    await expect(input).toBeFocused();
                    await expect(input).toHaveAttribute("dir", "auto");
                    await expect(page.locator("#editRemoteInput")).toHaveText(
                        dictionary["Remote text entry"]
                    );
                    await expect(
                        page.locator('#listEdit [data-ott-key="13"]')
                    ).toContainText(dictionary.Set);
                    await expect(
                        page.locator('#listEdit [data-ott-key="27"]')
                    ).toContainText(dictionary.Cancel);
                    await input.dispatchEvent("compositionstart", { data: "" });
                    await input.fill(value);
                    for (const key of ["Enter", "Escape", "ArrowDown"])
                        await input.dispatchEvent("keydown", {
                            key,
                            keyCode:
                                key === "Enter"
                                    ? 13
                                    : key === "Escape"
                                      ? 27
                                      : 40,
                        });
                    await expect(input).toBeVisible();
                    await expect(input).toBeFocused();
                    await input.dispatchEvent("compositionend", {
                        data: value,
                    });
                    await input.dispatchEvent("keydown", {
                        key: "Enter",
                        keyCode: 229,
                    });
                    await expect(input).toBeVisible();
                    await input.press("Enter");
                    await expect(input).toBeVisible();
                    const save = page.locator('#listEdit [data-ott-key="13"]');
                    await input.press("ArrowUp");
                    await expect(save).toBeFocused();
                    await save.press("ArrowUp");
                    await expect(
                        page.locator("#editRemoteInput")
                    ).toBeFocused();
                    await page.locator("#editRemoteInput").press("ArrowUp");
                    await expect(input).toBeFocused();
                    await input.press("ArrowDown");
                    await page.locator("#editRemoteInput").press("ArrowDown");
                    await expect(save).toBeFocused();
                    if (code === "_ara") {
                        await input.focus();
                        await save.dispatchEvent("click");
                    } else await save.press("Enter");
                    await expect(page.locator("#listEdit")).toBeHidden();
                    expect(
                        await page.evaluate(() =>
                            window.__languageInputSaves.at(-1)
                        )
                    ).toBe(value);
                }
                expect(
                    await page.evaluate(
                        () => window.__languageInputSaves.length
                    )
                ).toBe(languageCases.length);
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );
}

for (const profile of ["server", "tauri", "capacitor"]) {
    test(
        profile + " native editor hint buttons save and cancel settings",
        async ({ browser }) => {
            const fixture = await fixturePage(browser, profile);
            const page = fixture.page;
            try {
                if (profile === "tauri")
                    await attachModernRuntimeIdentity(page, browser);
                await page.evaluate(() => {
                    uiInit();
                    uiInit();
                    saveSettings({
                        swopBaseUrl: "https://example.invalid/old",
                    });
                    settingsCommands();
                    window.__editorHintKeys = [];
                    const dispatch = window._doKey;
                    window._doKey = (key, event) => {
                        window.__editorHintKeys.push(key);
                        dispatch(key, event);
                    };
                });
                const saved = "https://example.invalid/swop?text=Привет&x=1";
                for (const save of [true, false]) {
                    await page.evaluate(() => aboutKeyHandler(keys.N2));
                    await page
                        .locator("#editvar")
                        .fill(save ? saved : "discard");
                    await page
                        .locator("#listEdit [data-ott-key]")
                        .filter({
                            hasText: save ? "Set" : "Cancel",
                        })
                        .click();
                    await expect(page.locator("#listEdit")).toBeHidden();
                    await expect(page.locator("#listAbout")).toContainText(
                        saved
                    );
                    expect(
                        await page.evaluate(() => ({
                            current: settings.swopBaseUrl,
                            facade: window.sSwopBaseUrl,
                            persisted: stbGetItem("sSwopBaseUrl"),
                        }))
                    ).toEqual({
                        current: saved,
                        facade: saved,
                        persisted: saved,
                    });
                }
                expect(
                    await page.evaluate(() => ({
                        actual: window.__editorHintKeys,
                        expected: [keys.ENTER, keys.EXIT],
                    }))
                ).toEqual({ actual: [13, 27], expected: [13, 27] });
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );
    test(
        profile + " Actions popup stays above programme details in every theme",
        async ({ browser }) => {
            const fixture = await fixturePage(browser, profile);
            const page = fixture.page;
            try {
                // Exercise phone-sized landscape geometry without a native
                // bridge, provider, saved profile or physical-device claim.
                await page.setViewportSize({ height: 430, width: 932 });
                await page.evaluate(() => {
                    window.sNoNumbersKeys = 0;
                    window.cList = Object.keys(channels);
                    window.providerGetItem = () => null;
                    window.providerSetItem = () => {};
                    window.favoritesArray = [];
                    channels.one.descr =
                        "Synthetic programme description over the Actions area. ".repeat(
                            60
                        );
                    window.__ottChannels.mount(window);
                    setEditor();
                });
                for (const theme of [0, 1, 2]) {
                    for (const position of [0, 1]) {
                        await page.evaluate(
                            ({ theme, position }) => {
                                settings.interfaceTheme = theme;
                                settings.listPosition = position;
                                setColor();
                                setFontSize();
                                setListPos();
                                _channelsList(0, 0);
                            },
                            { position, theme }
                        );
                        await expect(page.locator("#_prd")).toContainText(
                            "Synthetic programme description"
                        );
                        await page
                            .locator("#listPodval [data-ott-key]")
                            .filter({ hasText: "Actions" })
                            .click();
                        const popup = page.locator("#listPopUp");
                        await expect(popup).toBeVisible();
                        const targets = await popup
                            .locator("[data-ott-key]")
                            .evaluateAll((buttons) =>
                                buttons.map((button) => {
                                    const rect = button.getBoundingClientRect();
                                    const hit = document.elementFromPoint(
                                        rect.left + rect.width / 2,
                                        rect.top + rect.height / 2
                                    );
                                    return {
                                        label: button.textContent.trim(),
                                        receivesPoint: button.contains(hit),
                                    };
                                })
                            );
                        expect(targets.length).toBeGreaterThan(0);
                        expect(
                            targets.filter((target) => !target.receivesPoint),
                            `theme=${theme} position=${position}`
                        ).toEqual([]);
                        // A real coordinate click must reach Search through
                        // the long description and open its editor.
                        await popup
                            .locator("[data-ott-key]")
                            .filter({ hasText: "Search" })
                            .click();
                        await expect(page.locator("#listEdit")).toBeVisible();
                        await expect(popup).toBeHidden();
                        await page.evaluate(() => _doKey(keys.RETURN));
                        await expect(page.locator("#listEdit")).toBeHidden();
                    }
                }
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );
    test(
        profile +
            " Actions popup dispatches once and ignores covered or stale controls",
        async ({ browser }) => {
            const fixture = await fixturePage(browser, profile);
            const page = fixture.page;
            try {
                await page.evaluate(() => {
                    uiInit();
                    uiInit();
                    _channelsList(0, 0);
                    $("#listPopUp").show();
                    window.__popupDispatches = [];
                    window._doKey = (key) => window.__popupDispatches.push(key);
                    window.__sendPopupInput = () => {
                        const button = document.querySelector(
                            '#listPopUp [data-ott-key="' + keys.N6 + '"]'
                        );
                        button.click();
                        for (const keyCode of [13, 32])
                            button.dispatchEvent(
                                new KeyboardEvent("keydown", {
                                    bubbles: true,
                                    cancelable: true,
                                    keyCode,
                                })
                            );
                    };
                    window.__sendPopupInput();
                });
                const expected = await page.evaluate(() => [
                    keys.N6,
                    keys.N6,
                    keys.N6,
                ]);
                expect(
                    await page.evaluate(() => window.__popupDispatches)
                ).toEqual(expected);
                await page.evaluate(() => {
                    confirmBox("Cover the list", () => {});
                    window.__sendPopupInput();
                });
                await expect(page.locator("#dialogbox")).toBeVisible();
                expect(
                    await page.evaluate(() => window.__popupDispatches)
                ).toEqual(expected);
                await page.evaluate(() => {
                    window.__ottClassicScreenPort.close("dialog");
                    $("#dialogbox, #listPopUp").hide();
                    window.__sendPopupInput();
                    closeList();
                    // Even a stale visible DOM subtree cannot dispatch after
                    // its list owner has been retired.
                    $("#list, #listPopUp").show();
                });
                await expect(page.locator("#listPopUp")).toBeVisible();
                await page.evaluate(() => window.__sendPopupInput());
                expect(
                    await page.evaluate(() => window.__popupDispatches)
                ).toEqual(expected);
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );

    test(
        profile +
            " Actions dialog Search keeps its editor through input, save and cancel",
        async ({ browser }) => {
            const fixture = await fixturePage(browser, profile);
            const page = fixture.page;
            try {
                await page.evaluate(() => {
                    window.sNoNumbersKeys = 1;
                    window.cList = Object.keys(channels);
                    window.providerGetItem = () => null;
                    window.providerSetItem = () => {};
                    window.favoritesArray = [];
                    window.__ottChannels.mount(window);
                    setEditor();
                });
                for (const save of [true, false]) {
                    await page.evaluate(() => _channelsList(0, 0));
                    await page
                        .locator("#listPodval [data-ott-key]")
                        .filter({ hasText: "Actions" })
                        .click();
                    await expect(page.locator("#dialogbox")).toBeVisible();
                    await page
                        .locator("#dialogbox [data-ott-key]")
                        .filter({ hasText: "Search" })
                        .click();
                    await expect(page.locator("#listEdit")).toBeVisible();
                    await expect(page.locator("#dialogbox")).toBeHidden();
                    expect(
                        await page.evaluate(() => {
                            const port = window.__ottClassicScreenPort;
                            const dialog = port.owner("dialog");
                            return {
                                dialogActive: !!(dialog && dialog.active()),
                                editorForeground: port
                                    .owner("editor")
                                    .foreground(),
                            };
                        })
                    ).toEqual({ dialogActive: false, editorForeground: true });
                    await page.evaluate(() => _doKey(keys.DOWN));
                    await expect(page.locator("#listEdit")).toBeVisible();
                    await page.locator("#editvar").fill("News");
                    await page.evaluate(
                        (save) => _doKey(save ? keys.ENTER : keys.RETURN),
                        save
                    );
                    await expect(page.locator("#listEdit")).toBeHidden();
                    if (save) {
                        await expect(page.locator("#listIn .item")).toHaveCount(
                            1
                        );
                        await expect(page.locator("#it0")).toContainText(
                            "News"
                        );
                    } else {
                        await expect(
                            page.locator("#listCaption")
                        ).toContainText("Channel list");
                        await expect(page.locator("#listIn .item")).toHaveCount(
                            25
                        );
                    }
                }
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );
}

async function snapshot(page) {
    return page.evaluate(async () => {
        await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
        const row = document.getElementById("it0");
        const picon = row.querySelector(".img");
        const progress = document.getElementById("prone");
        const archive = picon.previousElementSibling;
        const programme = document.getElementById("pnone");
        const scrollbar = document.querySelector(".list-scroll");
        const size = (element) => {
            const rect = element.getBoundingClientRect();
            return {
                height: Math.round(rect.height),
                width: Math.round(rect.width),
            };
        };
        return {
            archive: size(archive),
            archiveColor: getComputedStyle(archive).backgroundColor,
            detailAccent: getComputedStyle(
                document.querySelector("#_name > div")
            ).color,
            nextAccent: getComputedStyle(
                document.querySelector("#_nextpr span")
            ).color,
            picon: size(picon),
            piconImage: getComputedStyle(picon).backgroundImage,
            programmeAccent: getComputedStyle(programme).color,
            progress: size(progress.parentElement),
            progressColor: getComputedStyle(progress).backgroundColor,
            rowHeight: Math.round(row.getBoundingClientRect().height),
            scrollbar: size(scrollbar),
            scrollThumb: size(scrollbar.children[1]),
            scrollThumbColor: getComputedStyle(scrollbar.children[1])
                .backgroundColor,
            selection: getComputedStyle(row).backgroundColor,
            thumbnail: size(document.querySelector("#_prd .img")),
            titleColor: getComputedStyle(programme.parentElement).color,
        };
    });
}

test("PLi-HD switches the shipped UI and restores custom Classic colours", async ({
    browser,
}, testInfo) => {
    for (const profile of ["server", "tauri"]) {
        const fixture = await fixturePage(browser, profile);
        const page = fixture.page;
        try {
            const classic = await snapshot(page);
            await page.screenshot({
                path: testInfo.outputPath(profile + "-classic.png"),
            });
            const saved = await page.evaluate(() => {
                const saved = saveSettings({ interfaceTheme: 1 });
                _channelsList(0, 0);
                return saved;
            });
            expect(saved).toBe(true);
            await expect(page.locator("body")).toHaveClass(/theme-pli-hd/);
            await expect(page.locator("#_name")).toContainText(
                "Current bulletin"
            );
            const pli = await snapshot(page);
            expect(pli.selection).toBe("rgb(48, 50, 64)");
            expect(pli.programmeAccent).toBe("rgb(252, 192, 0)");
            expect(pli.detailAccent).toBe("rgb(252, 192, 0)");
            expect(pli.progressColor).toBe("rgb(252, 192, 0)");
            expect(pli.rowHeight).toBe(20);
            expect(pli.picon.height).toBeLessThanOrEqual(pli.rowHeight);
            expect(
                await page.evaluate(() => {
                    const clock = document.getElementById("listTime");
                    clock.textContent = "18:30:00";
                    const rect = clock.getBoundingClientRect();
                    return clock.contains(
                        document.elementFromPoint(
                            rect.x + rect.width / 2,
                            rect.y + rect.height / 2
                        )
                    );
                })
            ).toBe(true);
            await expect(page.locator("#listCaption")).toHaveCSS(
                "background-color",
                "rgb(36, 36, 36)"
            );
            await expect(page.locator("#it0")).toHaveCSS(
                "border-radius",
                "0px"
            );
            await expect(page.locator("#dialogbox")).toHaveCSS(
                "border-radius",
                "0px"
            );
            await expect(page.locator("#listIn .item")).toHaveCount(25);
            await page.screenshot({
                path: testInfo.outputPath(profile + "-pli-hd.png"),
            });
            await page.locator("#it1").click();
            await expect(page.locator("#it1")).toHaveCSS(
                "background-color",
                "rgb(48, 50, 64)"
            );
            await expect(page.locator("#_name")).toContainText("Current film");
            expect(
                await page.evaluate(() => {
                    const saved = saveSettings({ interfaceTheme: 0 });
                    _channelsList(0, 0);
                    return saved;
                })
            ).toBe(true);
            await expect(page.locator("body")).not.toHaveClass(/theme-pli-hd/);
            await expect(page.locator("#_name")).toContainText(
                "Current bulletin"
            );
            expect(await snapshot(page)).toEqual(classic);
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    }
});

test("PLi-HD keeps preview, mask and list aligned after mirroring and resize", async ({
    browser,
}) => {
    for (const profile of ["server", "tauri"]) {
        const fixture = await fixturePage(browser, profile);
        const page = fixture.page;
        try {
            await page.evaluate(() => {
                const videoBox = document.createElement("div");
                videoBox.id = "vdiv";
                document.body.prepend(videoBox);
            });
            for (const viewport of [
                { height: 720, width: 1280 },
                { height: 1080, width: 1920 },
                { height: 540, width: 960 },
            ]) {
                await page.setViewportSize(viewport);
                for (const side of [0, 1]) {
                    for (const noSmall of [0, 1]) {
                        const boxes = await page.evaluate(
                            ({ side, noSmall }) => {
                                saveSettings({
                                    interfaceTheme: 1,
                                    listPosition: side,
                                    noSmall,
                                });
                                setFontSize();
                                _channelsList(0, 0);
                                const rect = (id) => {
                                    const r = document
                                        .getElementById(id)
                                        .getBoundingClientRect();
                                    return {
                                        bottom: r.bottom,
                                        height: r.height,
                                        right: r.right,
                                        width: r.width,
                                        x: r.x,
                                        y: r.y,
                                    };
                                };
                                return {
                                    bottom: rect("_b"),
                                    detail: rect("listDetail"),
                                    last: rect("it24"),
                                    left: rect("_l"),
                                    list: rect("listIn"),
                                    preview: rect("vdiv"),
                                    right: rect("_r"),
                                    top: rect("_t"),
                                };
                            },
                            { noSmall, side }
                        );
                        const x = viewport.width / 1280;
                        const y = viewport.height / 720;
                        expect(boxes.list.x).toBeCloseTo(
                            (side ? 60 : 530) * x,
                            0
                        );
                        expect(boxes.list.y).toBeCloseTo(110 * y, 0);
                        expect(boxes.list.width).toBeCloseTo(690 * x, 0);
                        expect(boxes.list.height).toBeCloseTo(510 * y, 0);
                        expect(boxes.last.bottom).toBeLessThanOrEqual(
                            boxes.list.bottom + 0.5
                        );
                        expect(boxes.detail.x).toBeCloseTo(
                            (side ? 778 : 85) * x,
                            0
                        );
                        expect(boxes.detail.y).toBeCloseTo(
                            (noSmall ? 110 : 360) * y,
                            0
                        );
                        if (!noSmall) {
                            expect(boxes.preview.x).toBeCloseTo(
                                (side ? 778 : 85) * x,
                                0
                            );
                            expect(boxes.preview.y).toBeCloseTo(110 * y, 0);
                            expect(boxes.preview.width).toBeCloseTo(417 * x, 0);
                            expect(boxes.preview.height).toBeCloseTo(
                                243 * y,
                                0
                            );
                            expect(boxes.top.bottom).toBeCloseTo(
                                boxes.preview.y,
                                0
                            );
                            expect(boxes.left.right).toBeCloseTo(
                                boxes.preview.x,
                                0
                            );
                            expect(boxes.right.x).toBeCloseTo(
                                boxes.preview.right,
                                0
                            );
                            expect(boxes.bottom.y).toBeCloseTo(
                                boxes.preview.bottom,
                                0
                            );
                        }
                    }
                }
            }
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    }
});

for (const language of ["english", "russian"]) {
    test(`${language} credits controls retain readable English attribution offline`, async ({
        browser,
    }) => {
        const fixture = await fixturePage(
            browser,
            "tauri",
            undefined,
            language
        );
        const page = fixture.page;
        try {
            const title = await page.locator("#listCaption").textContent();
            await page.evaluate(() => {
                infoArr
                    .find((entry) => entry.name === "Interface credits")
                    .action();
            });
            const credits = page.locator("#listAbout .interface-credits");
            await expect(credits.locator("div[lang=en]")).toBeVisible();
            await expect(credits.locator(".credits-title")).toHaveText(
                language === "russian"
                    ? "Авторы интерфейса"
                    : "Interface credits"
            );
            await expect(credits.locator(".credits-language")).toHaveText(
                language === "russian"
                    ? "Оригинальный текст: Английский"
                    : "Original text: English"
            );
            await expect(credits.locator(".credits-navigation")).toHaveText(
                language === "russian"
                    ? "Прокрутка — вверх и вниз. Назад — закрыть."
                    : "Use Up / Down to scroll. Back to close."
            );
            await expect(credits).toContainText("Vali (2009–2010)");
            await expect(credits).toContainText("VU+NL, Milo");
            await expect(credits).toContainText("alex_qr");
            await expect(credits.locator("a").first()).toHaveAttribute(
                "href",
                "https://github.com/littlesat/skin-PLiHD"
            );
            expect(
                await page.evaluate(() => {
                    aboutKeyHandler(keys.DOWN);
                    return document.querySelector(
                        "#listAbout .interface-credits"
                    ).scrollTop;
                })
            ).toBeGreaterThan(0);
            await page.evaluate(() => aboutKeyHandler(keys.RETURN));
            await expect(credits).toHaveCount(0);
            await expect(page.locator("#listCaption")).toHaveText(title);
            await expect(page.locator("#it0")).toBeVisible();
            await page.evaluate(() => {
                infoArr
                    .find((entry) => entry.name === "Interface credits")
                    .action();
            });
            await page.locator('#listPodval [role="button"]').click();
            await expect(credits).toHaveCount(0);
            await expect(page.locator("#it0")).toBeVisible();
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    });
}

for (const profile of ["server", "tauri", "capacitor"]) {
    test(`${profile} Plex libraries use the native numbered channel selector without mutating TV`, async ({
        browser,
    }) => {
        const fixture = await fixturePage(browser, profile, {
            showNumber: true,
        });
        const page = fixture.page;
        try {
            expect(await page.evaluate(() => !!window.__ottPlexList)).toBe(
                false
            );
            await page.evaluate(
                () =>
                    new Promise((resolve, reject) => {
                        window.__ottProviderAssets.classic.ensure(
                            "plex",
                            "",
                            "fixture",
                            { active: () => true, own: () => () => {} },
                            resolve,
                            reject
                        );
                    })
            );
            expect(
                await page.evaluate(() => typeof window.__ottPlexList.create)
            ).toBe("function");
            await page.evaluate(() => {
                // Provider startup wires this alias; the offline fixture calls
                // the private renderer directly during its initial boot.
                window.channelsList = window._channelsList;
                window.catIndex = window.primaryIndex = 0;
                window.curList = window.cList = window.cats.Fixture;
                const fields = [
                    "channels",
                    "chanels",
                    "cats",
                    "catsArray",
                    "cList",
                    "curList",
                    "settings",
                ];
                window.__plexAmbient = {
                    fields: Object.fromEntries(
                        fields.map((key) => [key, window[key]])
                    ),
                    values: {
                        catIndex: window.catIndex,
                        p_pref: window.p_pref,
                        primaryIndex: window.primaryIndex,
                        settings: JSON.stringify(window.settings),
                    },
                };
                window.__plexSelections = [];
                window.__plexPlays = [];
                window.__plexTVPlays = 0;
                window.playChannel = () => window.__plexTVPlays++;
                window.stbBindKeyHandler();
                const records = [
                    {
                        __ottMediaCategories: [{ id: "films", name: "Films" }],
                        id: 1,
                        stream_url: "fixture-1.mp4",
                        title: "First film",
                    },
                    {
                        __ottMediaCategories: [
                            { id: "cartoons", name: "Cartoons" },
                        ],
                        id: 2,
                        stream_url: "fixture-2.mp4",
                        title: "Episode two",
                    },
                    {
                        __ottMediaCategories: [
                            { id: "cartoons", name: "Cartoons" },
                        ],
                        id: 3,
                        stream_url: "fixture-3.mp4",
                        title: "Episode three",
                    },
                ];
                window.stbPlay = (url) => {
                    window.__plexPlays.push(url);
                    window.__ottClassicPlayback.command({ type: "playing" });
                };
                window.__ottMedia.useSource({
                    catalog: () => records.slice(),
                    client: {
                        cancel() {},
                        load(_target, done) {
                            window.mediaRecords = records;
                            window.mediaName = "Plex";
                            done();
                        },
                        resolve(item, done) {
                            window.__plexSelections.push(item.id);
                            done(item);
                        },
                    },
                    library: { id: "library-7", title: "Plex library" },
                    read: () => null,
                    sourceId: "plex@fixture",
                    title: "Plex",
                    write() {},
                });
                window.__ottMedia.open(null);
            });
            const numbers = () =>
                page.locator("#listIn .ott-channel-number").allTextContents();
            const labels = () =>
                page.locator("#listIn .ott-channel-label").allTextContents();
            const expectAmbient = async () => {
                expect(
                    await page.evaluate(() => {
                        const saved = window.__plexAmbient;
                        return (
                            Object.keys(saved.fields).every(
                                (key) => window[key] === saved.fields[key]
                            ) &&
                            window.catIndex === saved.values.catIndex &&
                            window.primaryIndex === saved.values.primaryIndex &&
                            window.p_pref === saved.values.p_pref &&
                            JSON.stringify(window.settings) ===
                                saved.values.settings
                        );
                    })
                ).toBe(true);
            };
            await expect(page.locator("#list")).toBeVisible();
            await expect(page.locator("#listCaption")).toContainText(
                "Channel list"
            );
            expect(await numbers()).toEqual(["1", "2", "3"]);
            expect((await labels()).map((text) => text.trim())).toEqual([
                "First film",
                "Episode two",
                "Episode three",
            ]);
            await page.keyboard.press("ArrowDown");
            await expect(page.locator("#it1")).toHaveClass(/ott-selected/);
            await page.keyboard.press("ArrowUp");
            await expect(page.locator("#it0")).toHaveClass(/ott-selected/);
            await expect(page.locator("#mediaPlaybackControls")).toHaveCount(0);
            await expect(page.locator("#listPodval")).not.toContainText(
                "Filter"
            );
            expect(
                await page.evaluate(() =>
                    window.listArray.some((row) => row && row.__ottMediaFilter)
                )
            ).toBe(false);
            await expectAmbient();
            await page
                .getByRole("button", { exact: true, name: "Category" })
                .click();
            await expect(page.locator("#listCaption")).toHaveText(
                "Category selection"
            );
            const cartoons = page
                .locator("#listIn .item")
                .filter({ hasText: "Cartoons" });
            await cartoons.click();
            await expect(cartoons).toHaveClass(/ott-selected/);
            await page.keyboard.press("Enter");
            await expect(page.locator("#listCaption")).toContainText(
                "Cartoons"
            );
            expect(await numbers()).toEqual(["1", "2"]);
            expect((await labels()).map((text) => text.trim())).toEqual([
                "Episode two",
                "Episode three",
            ]);
            await expectAmbient();
            await page.keyboard.press("ArrowDown");
            await expect(page.locator("#it1")).toHaveClass(/ott-selected/);
            await page.keyboard.press("Enter");
            expect(await page.evaluate(() => window.__plexTVPlays)).toBe(0);
            expect(await page.evaluate(() => window.__plexSelections)).toEqual([
                3,
            ]);
            expect(await page.evaluate(() => window.__plexPlays)).toEqual([
                "fixture-3.mp4",
            ]);
            expect(
                await page.evaluate(
                    () => window.__ottMedia.current().payload.id
                )
            ).toBe(3);
            await expectAmbient();
            await page.evaluate(() => window.__ottMedia.open(null));
            await expect(page.locator("#it1")).toHaveClass(/ott-selected/);
            expect((await labels()).map((text) => text.trim())).toEqual([
                "Episode two",
                "Episode three",
            ]);
            await expectAmbient();
            await page.evaluate(() => {
                window.closeList();
                window.__ottMedia.useSource(null);
                window.channelsList(window.catIndex, window.primaryIndex);
            });
            await expect(page.locator("#it0")).toContainText("News");
            await expectAmbient();

            // An active Plex provider opens that same TV selector directly.
            await page.evaluate(() => {
                window.p_pref = "plex";
                window.__ottActiveProviderDriver = {
                    capabilities: { mediaPlaylist: true },
                    id: "plex",
                };
                window.catIndex = 0;
                window.primaryIndex = 1;
                window.getMediaArray = () => {
                    throw Error("Obsolete Plex folder tree requested");
                };
                window.__ottChannels.mount(window);
                window.mediaList(null);
            });
            await expect(page.locator("#listCaption")).toContainText(
                "Channel list"
            );
            await expect(page.locator("#it1")).toContainText("Films");
            await expect(page.locator("#it1")).toHaveClass(/ott-selected/);
            await expect(page.locator("#mediaPlaybackControls")).toHaveCount(0);
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    });
}

for (const profile of ["tauri", "capacitor"]) {
    test(`${profile} media controls dispatch without inline handlers`, async ({
        browser,
    }) => {
        const fixture = await fixturePage(browser, profile);
        const page = fixture.page;
        try {
            await page.evaluate(() => {
                const saved = {};
                window.__fixtureViolations = [];
                window.__fixtureShuffles = 0;
                window.__ottMedia.useSource({
                    client: {
                        cancel() {},
                        load(_target, done) {
                            window.mediaRecords = [
                                {
                                    description: "Fixture media description",
                                    id: 1,
                                    stream_url: "fixture.mp4",
                                    title: "Film",
                                },
                            ];
                            window.mediaName = "Library";
                            done();
                        },
                    },
                    read: (key) => saved[key] || null,
                    sourceId: "fixture-media-controls",
                    title: "Library",
                    write: (key, value) => {
                        saved[key] = value;
                    },
                });
                window.__ottMedia.open(null);
                window.__ottMedia.toggleShuffle = () =>
                    window.__fixtureShuffles++;
            });
            const controls = page.locator("#mediaPlaybackControls");
            await controls.getByRole("button", { name: "Repeat: All" }).click();
            await controls
                .getByRole("button", { name: "Repeat: One" })
                .press("Space");
            await expect(
                controls.getByRole("button", { name: "Repeat: Off" })
            ).toBeVisible();
            await expect(
                controls.getByRole("button", { name: "Repeat: Off" })
            ).toBeFocused();
            // The debounced detail renderer replaces this container's contents.
            // Wait for its real output before inserting the forged control.
            await expect(page.locator("#listDetail > #_prd")).toHaveText(
                "Fixture media description"
            );
            await page.evaluate(() => {
                const forged = document.createElement("div");
                forged.id = "mediaPlaybackControls";
                forged.innerHTML =
                    '<span role="button" data-ott-key="' +
                    window.keys.N5 +
                    '">Metadata action</span>';
                forged.addEventListener("click", (event) =>
                    event.stopPropagation()
                );
                document.getElementById("_prd").appendChild(forged);
            });
            await page.getByRole("button", { name: "Metadata action" }).click();
            expect(await page.evaluate(() => window.__fixtureShuffles)).toBe(0);
            await controls
                .getByRole("button", { name: "Shuffle: Off" })
                .click();
            expect(await page.evaluate(() => window.__fixtureShuffles)).toBe(1);
            expect(
                await page.evaluate(() =>
                    window.__fixtureViolations.filter((directive) =>
                        directive.startsWith("script-src")
                    )
                )
            ).toEqual([]);
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    });
}

test("active Tauri CSP reproduces the former inline-style failure", async ({
    browser,
}) => {
    const fixture = await fixturePage(browser, "tauri");
    try {
        const result = await fixture.page.evaluate(async () => {
            window.__fixtureViolations.length = 0;
            const example = document.createElement("div");
            example.innerHTML =
                '<span id="old-accent" style="color:rgb(1,2,3)">Old programme</span><div id="old-picon" style="width:24px;height:24px"></div>';
            document.body.appendChild(example);
            const trusted = document.createElement("span");
            trusted.style.color = "rgb(1, 2, 3)";
            example.appendChild(trusted);
            await new Promise((resolve) => setTimeout(resolve, 20));
            return {
                attrColor: getComputedStyle(
                    document.getElementById("old-accent")
                ).color,
                attrHeight: document
                    .getElementById("old-picon")
                    .getBoundingClientRect().height,
                propertyColor: getComputedStyle(trusted).color,
                violations: window.__fixtureViolations,
            };
        });
        expect(result.attrColor).not.toBe("rgb(1, 2, 3)");
        expect(result.attrHeight).toBe(0);
        expect(result.propertyColor).toBe("rgb(1, 2, 3)");
        expect(
            result.violations.some((directive) =>
                directive.startsWith("style-src")
            )
        ).toBe(true);
    } finally {
        await fixture.close();
    }
});

test("server and Tauri retain rich channel formatting under the native CSP", async ({
    browser,
}) => {
    const server = await fixturePage(browser, "server");
    const native = await fixturePage(browser, "tauri");
    try {
        const expected = await snapshot(server.page);
        const actual = await snapshot(native.page);
        for (const state of [expected, actual]) {
            expect(state.programmeAccent).toBe("rgb(0, 255, 0)");
            expect(state.detailAccent).toBe("rgb(0, 255, 0)");
            expect(state.nextAccent).toBe("rgb(0, 255, 0)");
            expect(state.titleColor).toBe("rgb(240, 240, 240)");
            expect(state.selection).toBe("rgb(0, 0, 128)");
            expect(state.archiveColor).toBe("rgb(0, 255, 0)");
            expect(state.progressColor).toBe("rgb(0, 255, 0)");
            expect(state.picon.width).toBeGreaterThan(10);
            expect(state.picon.height).toBeGreaterThan(10);
            expect(state.piconImage).toContain("data:image/svg+xml");
            expect(state.archive.height).toBeGreaterThan(0);
            expect(state.progress.width).toBe(40);
            expect(state.progress.height).toBeGreaterThan(0);
            expect(state.scrollbar.width).toBeGreaterThan(0);
            expect(state.scrollbar.height).toBeGreaterThan(0);
            expect(state.scrollThumb.height).toBeGreaterThan(0);
            expect(state.scrollThumb.height).toBeLessThan(
                state.scrollbar.height
            );
            expect(state.scrollThumbColor).toBe("rgba(180, 180, 200, 0.85)");
            expect(state.thumbnail).toEqual({ height: 200, width: 133 });
        }
        // OS fonts intentionally differ, so compare box geometry and colors,
        // not glyph widths or platform-specific rasterized text.
        expect(actual).toEqual(expected);
        for (const fixture of [server, native]) {
            const page = fixture.page;
            expect(await page.locator("#_prd b").textContent()).toBe(
                "Trusted description text"
            );
            expect(
                await page.locator("#_prd span").getAttribute("style")
            ).toBeNull();
            expect(
                await page.locator("#_prd span").getAttribute("onclick")
            ).toBeNull();
            expect(
                await page.locator("#_prd span").getAttribute("data-ott-key")
            ).toBeNull();
            expect(await page.locator("#_prd script").count()).toBe(0);
            expect(
                await page.evaluate(() => window.__metadataExecuted)
            ).toBeUndefined();
            await page.evaluate(() => {
                const valid = getChannelPicon("two");
                getChannelPicon = (id) =>
                    id === "one" ? { toString: null } : valid;
                _channelsList(0, 0);
            });
            await expect(page.locator("#it0 .img")).toHaveCSS(
                "background-image",
                "none"
            );
            await expect(page.locator("#it1 .img")).toHaveCSS(
                "background-image",
                /data:image\/svg\+xml/
            );
            await expect(page.locator("#pntwo")).toHaveCSS(
                "color",
                "rgb(0, 255, 0)"
            );
            await page.evaluate(() => {
                const valid = getChannelPicon("two");
                getChannelPicon = () => valid;
                _channelsList(0, 0);
            });
            await expect(page.locator("#pnfixture3")).toHaveText("");
            await page.evaluate(async () => {
                await new Promise((resolve) => setTimeout(resolve, 0));
                const channel = channels.fixture3;
                channel.name = "Arrived programme";
                channel.time = Date.now() / 1000 - 1800;
                channel.time_to = channel.time + 3600;
                updateChanelList("fixture3");
            });
            await expect(page.locator("#pnfixture3")).toHaveText(
                "Arrived programme"
            );
            await expect(page.locator("#pnfixture3")).toHaveCSS(
                "color",
                "rgb(0, 255, 0)"
            );
            expect(
                await page
                    .locator("#prfixture3")
                    .evaluate(
                        (element) => element.getBoundingClientRect().width
                    )
            ).toBeGreaterThan(0);
            await page.evaluate(() => {
                window.sThumbnail = 0;
                updateChanelList("one");
            });
            await expect(page.locator("#_prd .img")).toHaveCount(0);
            await page.locator("#it1").click();
            await expect(page.locator("#_name")).toContainText("Current film");
            await expect(page.locator("#it1")).toHaveCSS(
                "background-color",
                "rgb(0, 0, 128)"
            );
            await expect(page.locator("#it0")).not.toHaveCSS(
                "background-color",
                "rgb(0, 0, 128)"
            );
            await expect(page.locator("#listIn .item")).toHaveCount(25);
            await page.locator(".list-scroll-thumb").click();
            await expect(page.locator("#_name")).toContainText("Programme 27");
            await expect(page.locator("#listIn .item")).toHaveCount(15);
            await expect(page.locator("#it26")).toHaveCSS(
                "background-color",
                "rgb(0, 0, 128)"
            );
            const secondPage = await page.evaluate(() => {
                const scroll = document.querySelector(".list-scroll");
                const list = document
                    .getElementById("listIn")
                    .getBoundingClientRect();
                const selected = document
                    .getElementById("it26")
                    .getBoundingClientRect();
                return {
                    beforeHeight:
                        scroll.children[0].getBoundingClientRect().height,
                    piconWidth: document
                        .querySelector("#it26 .img")
                        .getBoundingClientRect().width,
                    programmeColor: getComputedStyle(
                        document.getElementById("pnfixture27")
                    ).color,
                    selectedVisible:
                        selected.top >= list.top &&
                        selected.bottom <= list.bottom,
                    thumbHeight:
                        scroll.children[1].getBoundingClientRect().height,
                };
            });
            expect(secondPage.beforeHeight).toBeGreaterThan(0);
            expect(secondPage.thumbHeight).toBeGreaterThan(0);
            expect(secondPage.piconWidth).toBeGreaterThan(10);
            expect(secondPage.programmeColor).toBe("rgb(0, 255, 0)");
            expect(secondPage.selectedVisible).toBe(true);
            await page.locator(".list-scroll-before").click();
            await expect(page.locator("#_name")).toContainText("Current film");
            await expect(page.locator("#it1")).toHaveCSS(
                "background-color",
                "rgb(0, 0, 128)"
            );
            await page.evaluate(() => {
                window.sShowPikon =
                    window.sShowProgress =
                    window.sShowArchive =
                    window.sShowProgram =
                        0;
                _channelsList(0, 0);
            });
            await expect(
                page.locator(
                    "#listIn .img, #listIn .progress_div, #listIn .ott-channel-archive, #pnone"
                )
            ).toHaveCount(0);
            await page.evaluate(() => bucketsList(0));
            await expect(page.locator("#it0")).toContainText("Fixture");
            await expect(
                page.locator(
                    "#listIn .ott-channel-label, #listIn .ott-channel-archive, #listIn .progress_div"
                )
            ).toHaveCount(0);
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        }
        const scriptSecurity = await native.page.evaluate(async () => {
            window.__fixtureViolations.length = 0;
            const script = document.createElement("script");
            script.textContent = "window.__untrustedScriptExecuted = true";
            document.body.appendChild(script);
            await new Promise((resolve) => setTimeout(resolve, 20));
            return {
                executed: window.__untrustedScriptExecuted === true,
                violations: window.__fixtureViolations,
            };
        });
        expect(scriptSecurity.executed).toBe(false);
        expect(
            scriptSecurity.violations.some((directive) =>
                directive.startsWith("script-src")
            )
        ).toBe(true);
    } finally {
        await server.close();
        await native.close();
    }
});

for (const profile of ["server", "tauri"]) {
    test(
        profile + ": category picker arrows respect paging, Dune and volume",
        async ({ browser }) => {
            test.setTimeout(90000);
            const fixture = await fixturePage(browser, profile, {});
            const page = fixture.page;
            try {
                await page.evaluate(() => {
                    // The fixture skips provider boot, which normally installs
                    // these production entry points and the keyboard listener.
                    window.channelsList = window._channelsList;
                    window.stbBindKeyHandler();
                    window.__categoryVolumeCalls = [];
                    window.changeVolume = (delta) =>
                        window.__categoryVolumeCalls.push(delta);
                });
                for (const pageSize of [10, 25, 30]) {
                    const total = 2 * pageSize + 7;
                    await page.evaluate((count) => {
                        const channel =
                            window.channels[
                                window.cats[window.catsArray[0]][0]
                            ];
                        window.catsArray = [];
                        window.cats = {};
                        window.channels = window.chanels = {};
                        for (let index = 0; index < count; index++) {
                            const category = "Paging category " + index;
                            const id = "paging-member-" + index;
                            window.catsArray.push(category);
                            window.cats[category] = [id];
                            window.channels[id] = Object.assign({}, channel, {
                                channel_name: "Member of category " + index,
                            });
                        }
                        window.catIndex = window.primaryIndex = 0;
                        window.curList = window.cats[window.catsArray[0]];
                    }, total);
                    const assertCategory = async (index) => {
                        await expect(page.locator("#list")).toBeVisible();
                        await expect(page.locator("#listCaption")).toHaveText(
                            "Category selection"
                        );
                        const selected = page.locator("#listIn .ott-selected");
                        await expect(selected).toHaveCount(1);
                        await expect(selected).toHaveAttribute(
                            "id",
                            "it" + index
                        );
                        await expect(selected).toContainText(
                            "Paging category " + index
                        );
                        const start = Math.floor(index / pageSize) * pageSize;
                        expect(
                            await page
                                .locator("#listIn .item")
                                .evaluateAll((items) =>
                                    items.map((item) => item.id)
                                )
                        ).toEqual(
                            Array.from(
                                { length: Math.min(pageSize, total - start) },
                                (_, offset) => "it" + (start + offset)
                            )
                        );
                        await expect
                            .poll(() =>
                                selected.evaluate((item) => {
                                    const row = item.getBoundingClientRect();
                                    const list = document
                                        .getElementById("listIn")
                                        .getBoundingClientRect();
                                    return {
                                        highlighted:
                                            getComputedStyle(item)
                                                .backgroundColor !==
                                            "rgba(0, 0, 0, 0)",
                                        index: window.selIndex,
                                        pageSize: window.listPageSize,
                                        visible:
                                            row.height > 0 &&
                                            row.top >= list.top - 1 &&
                                            row.bottom <= list.bottom + 1,
                                    };
                                })
                            )
                            .toEqual({
                                highlighted: true,
                                index,
                                pageSize,
                                visible: true,
                            });
                        await expect(
                            page.locator("#listIn .ott-channel-label")
                        ).toHaveCount(0);
                    };
                    for (const arrowFun of [0, 3]) {
                        expect(
                            await page.evaluate(
                                (input) => {
                                    const saved = saveSettings(input);
                                    bucketsList(3);
                                    document.activeElement.blur();
                                    return saved;
                                },
                                { arrowFun, pageSize, volumeStep: 7 }
                            )
                        ).toBe(true);
                        await assertCategory(3);
                        // Real key events exercise screen ownership, the
                        // category callback, shared paging and DOM rendering.
                        for (const [key, index] of [
                            ["ArrowLeft", 0],
                            ["ArrowLeft", 0],
                            ["ArrowRight", pageSize],
                            ["ArrowRight", 2 * pageSize],
                            ["ArrowRight", total - 1],
                            ["ArrowRight", total - 1],
                            ["ArrowLeft", pageSize + 6],
                            ["ArrowLeft", 6],
                            ["ArrowLeft", 0],
                            ["ArrowRight", pageSize],
                        ]) {
                            await page.keyboard.press(key);
                            await assertCategory(index);
                        }
                        await page.keyboard.press("Enter");
                        await expect(page.locator("#listCaption")).toHaveText(
                            "Channel list. Category: Paging category " +
                                pageSize
                        );
                        await expect(
                            page.locator("#listIn .ott-channel-label")
                        ).toHaveAttribute(
                            "data-channel-id",
                            "paging-member-" + pageSize
                        );
                        await expect(
                            page.locator("#listIn .ott-channel-label")
                        ).toContainText("Member of category " + pageSize);
                        await page.evaluate(
                            (index) => bucketsList(index),
                            pageSize
                        );
                        await page.keyboard.press("Backspace");
                        await expect(page.locator("#list")).toBeHidden();
                        expect(
                            await page.evaluate(() => window.isListVisible)
                        ).toBe(false);
                        expect(
                            await page.evaluate(
                                () => window.__categoryVolumeCalls
                            )
                        ).toEqual([]);
                    }
                    expect(
                        await page.evaluate((size) => {
                            const saved = saveSettings({
                                arrowFun: 2,
                                pageSize: size,
                                volumeStep: 7,
                            });
                            bucketsList(3);
                            document.activeElement.blur();
                            return saved;
                        }, pageSize)
                    ).toBe(true);
                    await assertCategory(3);
                    await page.keyboard.press("ArrowRight");
                    await expect(page.locator("#listCaption")).toHaveText(
                        "Channel list. Category: Paging category 3"
                    );
                    await expect(
                        page.locator("#listIn .ott-channel-label")
                    ).toHaveAttribute("data-channel-id", "paging-member-3");
                    await expect(
                        page.locator("#listIn .ott-channel-label")
                    ).toContainText("Member of category 3");
                    await page.keyboard.press("ArrowLeft");
                    await assertCategory(3);
                    await page.keyboard.press("ArrowLeft");
                    await expect(page.locator("#list")).toBeVisible();
                    await expect(page.locator("#listCaption")).toHaveText(
                        "Menu"
                    );
                    await page.keyboard.press("Backspace");
                    await expect(page.locator("#list")).toBeHidden();
                    expect(
                        await page.evaluate(() => window.isListVisible)
                    ).toBe(false);
                    expect(
                        await page.evaluate(() => window.__categoryVolumeCalls)
                    ).toEqual([]);
                    expect(
                        await page.evaluate((size) => {
                            window.__categoryVolumeCalls = [];
                            const saved = saveSettings({
                                arrowFun: 1,
                                pageSize: size,
                                volumeStep: 7,
                            });
                            bucketsList(3);
                            return saved;
                        }, pageSize)
                    ).toBe(true);
                    await page.keyboard.press("ArrowRight");
                    await assertCategory(3);
                    await page.keyboard.press("ArrowLeft");
                    await assertCategory(3);
                    expect(
                        await page.evaluate(() => {
                            const calls = window.__categoryVolumeCalls;
                            window.__categoryVolumeCalls = [];
                            return calls;
                        })
                    ).toEqual([7, -7]);
                }
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );

    test(
        profile + ": Studio defaults and focus survive paging and EPG updates",
        async ({ browser }, testInfo) => {
            const fixture = await fixturePage(browser, profile, {});
            const page = fixture.page;
            try {
                await expect(page.locator("body")).toHaveClass(/theme-studio/);
                await expect(page.locator("#listIn .item")).toHaveCount(25);
                await expect(page.locator("#it0")).toHaveCSS(
                    "background-color",
                    "rgb(231, 241, 235)"
                );
                await expect(page.locator("#it0 .ott-channel-label")).toHaveCSS(
                    "color",
                    "rgb(17, 33, 25)"
                );
                await expect(
                    page.locator("#it0 .ott-channel-programme")
                ).toHaveCSS("color", "rgb(74, 98, 85)");
                expect(
                    await page.evaluate(
                        () =>
                            parseFloat(
                                getComputedStyle(
                                    document.getElementById("list")
                                ).fontSize
                            ) <= document.getElementById("it0").offsetHeight
                    )
                ).toBe(true);
                await page.screenshot({
                    path: testInfo.outputPath(
                        profile + "-studio-2026-default.png"
                    ),
                });
                await page.evaluate(() => {
                    changeSelect(1);
                    updateChannelListRow("two");
                });
                await expect(page.locator("#it0")).not.toHaveClass(
                    /ott-selected/
                );
                await expect(page.locator("#it1 .ott-channel-label")).toHaveCSS(
                    "color",
                    "rgb(17, 33, 25)"
                );
                await page.evaluate(() => changeSelect(24));
                await expect(page.locator("#listIn .item")).toHaveCount(15);
                await expect(page.locator("#it25")).toHaveClass(/ott-selected/);
                await page.evaluate(() => changeSelect(-1));
                await expect(page.locator("#it24")).toHaveClass(/ott-selected/);
                await page.evaluate(() => {
                    channels[101] = channels.one;
                    cats.Fixture[0] = 101;
                    curList = [101];
                    primaryIndex = 0;
                    _channelsList(0, 0);
                    changeSelect(1);
                });
                await expect(page.locator("#it0")).toHaveClass(/ott-playing/);
                await expect(page.locator("#it1")).not.toHaveClass(
                    /ott-playing/
                );
                await page.evaluate(() => changeSelect(1));
                await expect(page.locator("#_name")).toHaveCount(0);
                await page.evaluate(() => settingsInterface());
                await page.waitForFunction(() =>
                    listArray.some((row) => row.settingId === "interfaceTheme")
                );
                await expect(page.locator("#listIn .ott-selected")).toHaveCSS(
                    "color",
                    "rgb(17, 33, 25)"
                );
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );

    test(
        profile +
            ": all themes honor row count, list side and video mode across resolutions",
        async ({ browser }) => {
            test.setTimeout(120000);
            const fixture = await fixturePage(browser, profile);
            const page = fixture.page;
            try {
                await page.evaluate(() => {
                    const videoBox = document.createElement("div");
                    videoBox.id = "vdiv";
                    document.body.prepend(videoBox);
                });
                for (const viewport of [
                    { height: 506, width: 900 },
                    { height: 720, width: 1280 },
                    { height: 1080, width: 1920 },
                    { height: 2160, width: 3840 },
                ]) {
                    await page.setViewportSize(viewport);
                    for (const theme of [0, 1, 2]) {
                        for (const pageSize of [10, 25, 30]) {
                            for (const side of [0, 1]) {
                                for (const noSmall of [0, 1]) {
                                    const result = await page.evaluate(
                                        (input) => {
                                            const saved = saveSettings(input);
                                            _channelsList(0, 0);
                                            const rect = (id) => {
                                                const r = document
                                                    .getElementById(id)
                                                    .getBoundingClientRect();
                                                return {
                                                    bottom: r.bottom,
                                                    height: r.height,
                                                    right: r.right,
                                                    x: r.x,
                                                    y: r.y,
                                                };
                                            };
                                            const row =
                                                document.getElementById("it0");
                                            return {
                                                bottom: rect("_b"),
                                                caption: rect("listCaption"),
                                                count: document.querySelectorAll(
                                                    "#listIn .item"
                                                ).length,
                                                detail: rect("listDetail"),
                                                last: rect(
                                                    "it" + (input.pageSize - 1)
                                                ),
                                                left: rect("_l"),
                                                list: rect("listIn"),
                                                osdVisible:
                                                    $("#list_osd").is(
                                                        ":visible"
                                                    ),
                                                piconHeight:
                                                    row.querySelector(".img")
                                                        .offsetHeight,
                                                preview: rect("vdiv"),
                                                right: rect("_r"),
                                                rowHeight: row.offsetHeight,
                                                saved,
                                                top: rect("_t"),
                                                windowVisible:
                                                    $("#list_window").is(
                                                        ":visible"
                                                    ),
                                            };
                                        },
                                        {
                                            interfaceTheme: theme,
                                            listPosition: side,
                                            noSmall,
                                            pageSize,
                                        }
                                    );
                                    expect(result.saved).toBe(true);
                                    expect(result.count).toBe(pageSize);
                                    expect(
                                        result.last.bottom
                                    ).toBeLessThanOrEqual(
                                        result.list.bottom + 0.5
                                    );
                                    expect(
                                        result.last.right
                                    ).toBeLessThanOrEqual(
                                        result.list.right + 0.5
                                    );
                                    expect(
                                        result.piconHeight
                                    ).toBeLessThanOrEqual(result.rowHeight);
                                    expect(result.windowVisible).toBe(!noSmall);
                                    expect(result.osdVisible).toBe(!!noSmall);
                                    expect(
                                        result.detail.y
                                    ).toBeGreaterThanOrEqual(
                                        result.caption.bottom
                                    );
                                    expect(
                                        side
                                            ? result.list.x < result.detail.x
                                            : result.list.x > result.detail.x
                                    ).toBe(true);
                                    if (!noSmall) {
                                        expect(result.top.bottom).toBeCloseTo(
                                            result.preview.y,
                                            0
                                        );
                                        expect(result.left.right).toBeCloseTo(
                                            result.preview.x,
                                            0
                                        );
                                        expect(result.right.x).toBeCloseTo(
                                            result.preview.right,
                                            0
                                        );
                                        expect(result.bottom.y).toBeCloseTo(
                                            result.preview.bottom,
                                            0
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
                // Resize an already mounted channel formatter, without reopening it.
                await page.setViewportSize({ height: 360, width: 640 });
                await expect
                    .poll(() =>
                        page.evaluate(() => {
                            const row = document.getElementById("it0");
                            return (
                                row.querySelector(".img").offsetHeight <=
                                row.offsetHeight
                            );
                        })
                    )
                    .toBe(true);
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );

    test(
        profile +
            ": display switches, fonts, clock and opacity apply from saved settings",
        async ({ browser }) => {
            const fixture = await fixturePage(browser, profile, {});
            const page = fixture.page;
            try {
                for (const theme of [0, 1, 2]) {
                    for (const enabled of [0, 1]) {
                        expect(
                            await page.evaluate(
                                ({ theme, enabled }) => {
                                    const saved = saveSettings({
                                        channelLogoMode: enabled * 2,
                                        interfaceTheme: theme,
                                        nextCountList: enabled,
                                        showArchive: enabled,
                                        showDescription: enabled,
                                        showName: enabled,
                                        showNumber: enabled,
                                        showProgram: enabled,
                                        showProgress: enabled,
                                        showScroll: enabled,
                                        thumbnail: enabled,
                                    });
                                    _channelsList(0, 0);
                                    return saved;
                                },
                                { enabled, theme }
                            )
                        ).toBe(true);
                        for (const selector of [
                            ".ott-channel-number",
                            ".ott-channel-picon",
                            ".ott-channel-programme",
                            ".ott-channel-progress",
                            ".ott-channel-archive",
                        ])
                            await expect(
                                page.locator("#it0 " + selector)
                            ).toHaveCount(enabled);
                        await expect(page.locator(".list-scroll")).toHaveCount(
                            enabled
                        );
                        await expect
                            .poll(() =>
                                page
                                    .locator("#_descr")
                                    .evaluate((el) => el.offsetHeight > 0)
                            )
                            .toBe(!!enabled);
                        await expect(
                            page.locator(".ott-channel-thumbnail")
                        ).toHaveCount(enabled);
                        await expect(page.locator("#_nextpr span")).toHaveCount(
                            enabled
                        );
                        expect(
                            (await page.locator("#it0").textContent()).includes(
                                "News"
                            )
                        ).toBe(!!enabled);
                    }
                }
                for (const fontSize of [0, 1, 2, 3, 4, 5, 6]) {
                    const sizes = [];
                    for (const fontShift of [0, 30]) {
                        sizes.push(
                            await page.evaluate(
                                ({ fontSize, fontShift }) => {
                                    saveSettings({
                                        fontShift,
                                        fontSize,
                                        pageSize: 10,
                                    });
                                    _channelsList(0, 0);
                                    return {
                                        family: getComputedStyle(document.body)
                                            .fontFamily,
                                        size: parseFloat(
                                            getComputedStyle(
                                                document.getElementById("list")
                                            ).fontSize
                                        ),
                                    };
                                },
                                { fontShift, fontSize }
                            )
                        );
                    }
                    expect(sizes[0].family).not.toContain("undefined");
                    expect(sizes[0].size).toBeGreaterThan(sizes[1].size);
                }
                for (const count of [0, 1, 20]) {
                    await page.evaluate((nextCountList) => {
                        const now = Date.now() / 1000;
                        channels.one.nextpr = Array.from(
                            { length: 20 },
                            (_, i) => ({
                                name: "Upcoming " + i,
                                time: now + 1800 * (i + 1),
                            })
                        );
                        saveSettings({
                            fontShift: 0,
                            nextCountList,
                            pageSize: 30,
                        });
                        _channelsList(0, 0);
                    }, count);
                    await expect(page.locator("#_nextpr span")).toHaveCount(
                        count
                    );
                    if (count) {
                        expect(
                            await page.evaluate(
                                () =>
                                    document
                                        .getElementById("_nextpr")
                                        .getBoundingClientRect().top >=
                                    document
                                        .getElementById("_name")
                                        .getBoundingClientRect().bottom
                            )
                        ).toBe(true);
                    }
                }
                for (const preview of [0, 1, 2]) {
                    await page.evaluate((preview) => {
                        window.__previewCalls = 0;
                        window.previewChId = () => window.__previewCalls++;
                        saveSettings({ preview });
                        _channelsList(0, 0);
                    }, preview);
                    await expect
                        .poll(() => page.locator("#_name").count())
                        .toBe(1);
                    // Flush the renderer's deferred detail callback.
                    await page.evaluate(
                        () => new Promise((resolve) => setTimeout(resolve, 250))
                    );
                    expect(
                        await page.evaluate(() => window.__previewCalls > 0)
                    ).toBe(preview === 1);
                }
                await page.evaluate(() => {
                    saveSettings({ preview: 0 });
                    closeList();
                });
                for (const opacity of [0, 3, 10]) {
                    await page.evaluate(
                        (osdOpacity) =>
                            saveSettings({ osdOpacity, permanentTime: 1 }),
                        opacity
                    );
                    await expect(page.locator("#permanentTime")).toBeVisible();
                    const alpha = await page
                        .locator("#permanentTime")
                        .evaluate((el) => {
                            const parts =
                                getComputedStyle(el).backgroundColor.match(
                                    /[\d.]+/g
                                );
                            return parts.length === 4 ? Number(parts[3]) : 1;
                        });
                    expect(alpha).toBe(opacity / 10);
                }
                await page.evaluate(() => saveSettings({ permanentTime: 2 }));
                await expect(page.locator("#permanentTime")).not.toHaveClass(
                    /osd/
                );
                await expect(page.locator("#permanentTime")).toHaveCSS(
                    "background-color",
                    "rgba(0, 0, 0, 0)"
                );
                await page.evaluate(() => {
                    saveSettings({ osdOpacity: 3, permanentTime: 1 });
                    saveSettings({ fontShift: 4 });
                });
                await expect(page.locator("#permanentTime")).toHaveCSS(
                    "background-color",
                    "rgba(14, 17, 20, 0.3)"
                );
                await page.evaluate(() => saveSettings({ permanentTime: 0 }));
                await expect(page.locator("#permanentTime")).toBeHidden();
                for (const enabled of [1, 0]) {
                    const label = await page.evaluate(
                        (useGraphicalIndicators) => {
                            saveSettings({ useGraphicalIndicators });
                            return _("yes");
                        },
                        enabled
                    );
                    expect(label.includes("<span")).toBe(!!enabled);
                }
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );
}

test("portrait player settings keep Save visible and persist the selected engine", async ({
    browser,
}) => {
    // Start at the final size so a delayed resize cannot redraw Save mid-click.
    const fixture = await fixturePage(
        {
            newContext: (options) =>
                browser.newContext({
                    ...options,
                    viewport: { height: 1230, width: 722 },
                }),
        },
        "server"
    );
    const { page } = fixture;
    try {
        await page.evaluate(() => {
            (function installPortraitSettingsDiagnostics() {
                const trace = [];
                const identities = new WeakMap();
                let serial = 0;
                function id(value) {
                    if (!value || typeof value !== "object") return null;
                    if (!identities.has(value)) identities.set(value, ++serial);
                    return identities.get(value);
                }
                window.__portraitSettingsRecord = (stage, event) => {
                    try {
                        const editor = window.__ottSettingsEditor;
                        const owner =
                            window.__ottClassicScreenPort?.listOwner();
                        const row = window.listArray?.[window.selIndex];
                        const target = event?.target?.closest?.(".item");
                        trace.push({
                            at: performance.now(),
                            detail: event?.detail ?? null,
                            draftPlayers: editor?.get("players") ?? null,
                            editor: id(editor),
                            editorActive: editor?.active() ?? null,
                            notice: (
                                document.getElementById("info")?.textContent ||
                                ""
                            ).slice(0, 512),
                            owner: id(owner),
                            ownerActive: owner?.active() ?? null,
                            ownerForeground: owner?.foreground() ?? null,
                            playerMode: window.playerMode,
                            row: row?.settingId || null,
                            rowValue: row?.val ?? null,
                            savedPlayers:
                                window.providerGetItem?.("sPlayers") ?? null,
                            selection: window.selIndex,
                            sPlayers: window.sPlayers,
                            stage,
                            target: target?.id || null,
                        });
                        if (trace.length > 32) trace.shift();
                    } catch (error) {
                        trace.push({
                            diagnosticError: String(error).slice(0, 256),
                            stage,
                        });
                        if (trace.length > 32) trace.shift();
                    }
                };
                window.__portraitSettingsTrace = trace;
                for (const type of ["click", "dblclick"]) {
                    document.addEventListener(
                        type,
                        (event) => {
                            window.__portraitSettingsRecord(
                                type + ":capture",
                                event
                            );
                            Promise.resolve().then(() =>
                                window.__portraitSettingsRecord(
                                    type + ":microtask",
                                    event
                                )
                            );
                        },
                        true
                    );
                }
            })();

            window.setFontSize();
            window.stbOptions();
            window.selIndex = window.listArray.findIndex(
                (row) => row.settingId === "players"
            );
            window.listKeyHandlerFn(window.keys.RIGHT);
            window.__portraitSettingsRecord("after-right");
        });
        const save = page
            .locator("#listIn .btn")
            .filter({ hasText: "Save Settings" });
        await expect(save).toBeVisible();
        // A layout update can replace the visible Save node between the
        // locator lookup and boundingBox's layout read.
        await expect(async () => {
            const bounds = await save.boundingBox();
            expect(bounds).not.toBeNull();
            expect(bounds.y).toBeGreaterThanOrEqual(0);
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(1230);
        }).toPass();
        expect(
            await page.locator("#list").evaluate((node) => {
                window.__portraitSettingsRecord("before-save");
                return parseFloat(getComputedStyle(node).fontSize);
            })
        ).toBeLessThanOrEqual(29);
        await save.click();
        await expect(page.locator("#listIn .item.ott-selected")).toContainText(
            "Save Settings"
        );
        await save.click();
        expect(
            await page.evaluate(() => {
                window.__portraitSettingsRecord("after-save");
                return window.sPlayers;
            })
        ).toBe(1);
        expect(await page.evaluate(() => window.playerMode)).toBe(1);
        expect(
            await page.evaluate(() => window.providerGetItem("sPlayers"))
        ).toBe("1");
        expect(fixture.errors).toEqual([]);
    } catch (error) {
        try {
            const trace = await page.evaluate(() => {
                window.__portraitSettingsRecord?.("failure");
                return window.__portraitSettingsTrace || [];
            });
            await test.info().attach("portrait-settings-state", {
                body: JSON.stringify(trace, null, 2),
                contentType: "application/json",
            });
        } catch (diagnosticError) {
            console.error(
                "Portrait settings diagnostics unavailable:",
                diagnosticError
            );
        }
        throw error;
    } finally {
        await fixture.close();
    }
});

for (const profile of ["server", "tauri", "capacitor"]) {
    test(
        profile +
            ": UI font scaling is proportional, reversible and keeps settings reachable",
        async ({ browser }) => {
            const fixture = await fixturePage(browser, profile, {});
            const { page } = fixture;
            try {
                for (const viewport of [
                    { height: 720, width: 1280 },
                    { height: 1230, width: 722 },
                    { height: 800, width: 360 },
                ]) {
                    await page.setViewportSize(viewport);
                    for (const theme of [0, 1, 2]) {
                        await page.evaluate((theme) => {
                            saveSettings({
                                interfaceTheme: theme,
                                uiFontScale: 100,
                            });
                            window.setFontSize();
                            _channelsList(0, 0);
                            if (!document.getElementById("font-scale-static")) {
                                const probe = document.createElement("span");
                                probe.id = "font-scale-static";
                                probe.className = "epg-time";
                                probe.textContent = "12:34";
                                document.body.appendChild(probe);
                                const notification =
                                    document.createElement("span");
                                notification.id = "font-scale-notify";
                                notification.className = "notify remote-notify";
                                notification.style.visibility = "hidden";
                                document.body.appendChild(notification);
                            }
                        }, theme);
                        const measure = () =>
                            page.evaluate(() => {
                                const result = {};
                                for (const id of [
                                    "list",
                                    "listCaption",
                                    "listPodval",
                                    "dialogbox",
                                    "info1",
                                    "listTime",
                                    "font-scale-static",
                                    "font-scale-notify",
                                ]) {
                                    result[id] = parseFloat(
                                        getComputedStyle(
                                            document.getElementById(id)
                                        ).fontSize
                                    );
                                }
                                return result;
                            });
                        const baseline = await measure();
                        for (const percent of [
                            20, 200, 20, 100, 23, 150, 100,
                        ]) {
                            expect(
                                await page.evaluate(
                                    (percent) =>
                                        saveSettings({ uiFontScale: percent }),
                                    percent
                                )
                            ).toBe(true);
                            await expect
                                .poll(() =>
                                    page.evaluate(
                                        () =>
                                            !!window.__ottSubtitleAppearance
                                                ?.scaleFonts
                                    )
                                )
                                .toBe(true);
                            const actual = await measure();
                            for (const id of Object.keys(baseline)) {
                                expect(
                                    actual[id],
                                    profile + ": " + id + " at " + percent
                                ).toBeCloseTo(
                                    (baseline[id] * percent) / 100,
                                    0
                                );
                            }
                            await page.evaluate(() => {
                                window.stbOptions();
                                window.selIndex = window.listArray.length - 1;
                                window.showPage();
                            });
                            const save = page
                                .locator("#listIn .btn")
                                .filter({ hasText: "Save Settings" });
                            await expect(save).toBeVisible();
                            await expect
                                .poll(async () => {
                                    const bounds = await save.boundingBox();
                                    return (
                                        !!bounds &&
                                        bounds.y >= 0 &&
                                        bounds.y + bounds.height <=
                                            viewport.height
                                    );
                                })
                                .toBe(true);
                            await page.evaluate(() => _channelsList(0, 0));
                        }
                    }
                }
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );
}

for (const profile of ["server", "tauri", "capacitor"]) {
    test(
        profile +
            ": 20% interface font survives reload and provider settings refresh",
        async ({ browser }) => {
            const fixture = await fixturePage(browser, profile, {});
            const { page } = fixture;
            try {
                await page.setViewportSize({ height: 800, width: 360 });
                const fontSize = () =>
                    page
                        .locator("#list")
                        .evaluate((node) =>
                            parseFloat(getComputedStyle(node).fontSize)
                        );
                for (const theme of [0, 1, 2]) {
                    await page.evaluate((theme) => {
                        saveSettings({
                            interfaceTheme: theme,
                            uiFontScale: 100,
                        });
                        setFontSize();
                        _channelsList(0, 0);
                    }, theme);
                    const baseline = await fontSize();
                    await page.evaluate(() => window.settingsInterface());
                    await expect
                        .poll(() =>
                            page.evaluate(() =>
                                window.listArray.some(
                                    (row) => row.settingId === "uiFontScale"
                                )
                            )
                        )
                        .toBe(true);
                    expect(
                        await page.evaluate(() => {
                            const row = window.listArray.find(
                                (row) => row.settingId === "uiFontScale"
                            );
                            window.selectValue(row);
                            return row.settingValues.slice(0, 3);
                        })
                    ).toEqual([20, 30, 40]);
                    const choice = page
                        .locator("#listAbout .osk-key")
                        .filter({ hasText: /^20%$/ });
                    await expect(choice).toBeVisible();
                    await choice.click();
                    await choice.click();
                    await page
                        .locator("#listPodval [data-ott-key]")
                        .filter({ hasText: "Save Settings" })
                        .click();
                    await page.evaluate(() => _channelsList(0, 0));
                    await expect.poll(fontSize).toBeCloseTo(baseline * 0.2, 1);
                    expect(
                        await page.evaluate(() => ({
                            stored: Number(stbGetItem("sUiFontScale")),
                            value: window.sUiFontScale,
                        }))
                    ).toEqual({ stored: 20, value: 20 });

                    // Reload only provider-scoped settings through the actual
                    // settings store, then recreate the page with its storage.
                    expect(
                        await page.evaluate(() => {
                            window.__ottPlayerSettingsHost.store.reload(
                                "provider"
                            );
                            return window.sUiFontScale;
                        })
                    ).toBe(20);
                    await page.reload();
                    await expect
                        .poll(() => page.evaluate(() => window.__fixtureReady))
                        .toBe(true);
                    await expect.poll(fontSize).toBeCloseTo(baseline * 0.2, 1);
                    expect(
                        await page.evaluate(() => ({
                            theme: window.settings.interfaceTheme,
                            value: window.sUiFontScale,
                        }))
                    ).toEqual({ theme, value: 20 });
                    for (const action of ["Close", "Save Settings"]) {
                        await page.evaluate(() => window.settingsInterface());
                        await expect
                            .poll(() =>
                                page.evaluate(() =>
                                    window.listArray.some(
                                        (row) => row.settingId === "uiFontScale"
                                    )
                                )
                            )
                            .toBe(true);
                        await page.evaluate(() =>
                            window.selectValue(
                                window.listArray.find(
                                    (row) => row.settingId === "uiFontScale"
                                )
                            )
                        );
                        const reset = page
                            .locator("#listAbout .osk-key")
                            .filter({ hasText: /^100%$/ });
                        await expect(reset).toBeVisible();
                        await reset.click();
                        await reset.click();
                        // Both cancel and save remain genuine hit targets
                        // while the saved font scale is still only 20%.
                        await page
                            .locator("#listPodval [data-ott-key]")
                            .filter({ hasText: action })
                            .click();
                        await page.evaluate(() => _channelsList(0, 0));
                        const expected = action === "Close" ? 20 : 100;
                        await expect
                            .poll(fontSize)
                            .toBeCloseTo((baseline * expected) / 100, 1);
                        expect(
                            await page.evaluate(() =>
                                Number(stbGetItem("sUiFontScale"))
                            )
                        ).toBe(expected);
                    }
                }
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );
}

test("buffer seconds remain mapped and readable in a narrow settings picker", async ({
    browser,
}) => {
    const fixture = await fixturePage(browser, "server");
    const { page } = fixture;
    try {
        await page.setViewportSize({ height: 800, width: 360 });
        await page.evaluate(() => {
            saveSettings({ bufSize: 30 });
            setFontSize();
            stbOptions();
            window.__bufferRow = listArray.find(
                (row) => row.settingId === "bufSize"
            );
            selectValue(__bufferRow);
        });
        await expect(page.locator("#listDetail")).toHaveText("30");
        const choice = page
            .locator("#listAbout .osk-key")
            .filter({ hasText: /^45$/ });
        await expect(choice).toBeVisible();
        const bounds = await choice.evaluate((node) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            const text = range.getBoundingClientRect();
            const cell = node.getBoundingClientRect();
            return {
                left: cell.left,
                right: cell.right,
                textWidth: text.width,
                width: cell.width,
            };
        });
        expect(bounds.left).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeLessThanOrEqual(360);
        expect(bounds.textWidth).toBeLessThan(bounds.width);
        await choice.click();
        await choice.click();
        expect(
            await page.evaluate(
                () => __bufferRow.settingValues[__bufferRow.val]
            )
        ).toBe(45);
        await page.evaluate(() => _doKey(keys.RETURN));
        expect(await page.evaluate(() => Number(stbGetItem("sBufSize")))).toBe(
            30
        );
        expect(fixture.errors).toEqual([]);
        expect(fixture.unexpectedRequests).toEqual([]);
    } finally {
        await fixture.close();
    }
});

for (const profile of ["server", "tauri", "capacitor"]) {
    test(`Modern mode repaints the owned channel list without restarting media (${profile})`, async ({
        browser,
    }) => {
        const fixture = await fixturePage(browser, profile, {
            interfaceTheme: 2,
        });
        const { page } = fixture;
        try {
            if (profile === "tauri")
                await attachModernRuntimeIdentity(page, browser);
            await expect(page.locator("#listIn .modern-channel")).toHaveCount(
                0
            );
            const before = await page.evaluate(() => {
                changeSelect(23);
                document.getElementById("it23").focus();
                window.__modernBeforeOwner = __ottClassicScreenPort.listOwner();
                window.__modernEffects = [];
                for (const name of [
                    "stbStop",
                    "stbPlay",
                    "loadChannels",
                    "getChannelsArray",
                    "stbSetWindow",
                    "stbToFullScreen",
                ])
                    window[name] = () => __modernEffects.push(name);
                return {
                    category: listCatIndex,
                    selected: listArray[selIndex],
                };
            });
            await page.evaluate(() => saveSettings({ interfaceMode: 1 }));
            await expect(page.locator("#listIn")).toHaveClass(/modern-live/);
            await expect(page.locator("#it23.modern-channel")).toBeVisible();
            await expect(page.locator("#it23")).toBeFocused();
            await saveModernScreenshot(page, profile, "live");
            expect(
                await page.evaluate(() => ({
                    category: listCatIndex,
                    effects: __modernEffects,
                    ownerSame:
                        __modernBeforeOwner ===
                        __ottClassicScreenPort.listOwner(),
                    selected: listArray[selIndex],
                }))
            ).toEqual({ ...before, effects: [], ownerSame: true });
            await page.evaluate(() => saveSettings({ interfaceMode: 0 }));
            await expect(page.locator("#listIn")).not.toHaveClass(
                /modern-catalog/
            );
            await expect(
                page.locator("#listIn .modern-channel, #listIn .modern-card")
            ).toHaveCount(0);
            await expect(page.locator("#it23")).toBeFocused();
            expect(
                await page.evaluate(() => ({
                    category: listCatIndex,
                    effects: __modernEffects,
                    selected: listArray[selIndex],
                }))
            ).toEqual({ ...before, effects: [] });
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    });

    test(`Modern live list crosses a page boundary before Up enters navigation (${profile})`, async ({
        browser,
    }) => {
        const fixture = await fixturePage(browser, profile, {
            interfaceTheme: 2,
        });
        const { page } = fixture;
        try {
            await page.evaluate(() => {
                saveSettings({ interfaceMode: 1 });
                stbBindKeyHandler();
            });
            await expect(page.locator("#listIn")).toHaveClass(/modern-live/);
            const boundary = await page.evaluate(() => {
                const boundary = Number(listPageSize);
                if (!(boundary > 0 && boundary < listArray.length))
                    throw new Error("Live fixture must have a second page");
                changeSelect(boundary - selIndex);
                document.getElementById("it" + selIndex).focus();
                return boundary;
            });
            await page.keyboard.press("ArrowUp");
            expect(await page.evaluate(() => selIndex)).toBe(boundary - 1);
            await expect(page.locator("#it" + (boundary - 1))).toBeFocused();
            await page.screenshot({
                path: test.info().outputPath("modern-live-previous-page.png"),
            });
            await page.evaluate(() => {
                changeSelect(-selIndex);
                document.getElementById("it0").focus();
            });
            await page.keyboard.press("ArrowUp");
            expect(
                await page.evaluate(
                    () => !!document.activeElement.closest("#modernRail")
                )
            ).toBe(true);
            expect(await page.evaluate(() => selIndex)).toBe(0);
            await page.keyboard.press("ArrowDown");
            await expect(page.locator("#it0")).toBeFocused();
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    });

    test(`Modern grid stays bounded at 10000 files and respects modal ownership (${profile})`, async ({
        browser,
    }) => {
        const fixture = await fixturePage(browser, profile, {
            interfaceTheme: 2,
        });
        const { page } = fixture;
        try {
            await seedModernMovies(page, 10000, 3450);
            await expect(page.locator("#listIn")).toHaveClass(/modern-grid/);
            await expect(page.locator("#it3450.modern-card")).toBeVisible();
            await expect(page.locator("#_name")).toContainText(
                "Ocean of Silence"
            );
            await saveModernScreenshot(page, profile, "grid");
            const cardGeometry = await page.evaluate(() => {
                const art = document
                    .querySelector("#it3450 .modern-art")
                    .getBoundingClientRect();
                const number = document.querySelector("#it3450 .modern-number");
                return {
                    artRatio: art.width / art.height,
                    numberDisplay: number
                        ? getComputedStyle(number).display
                        : "none",
                };
            });
            expect(cardGeometry.artRatio).toBeGreaterThan(1.7);
            expect(cardGeometry.artRatio).toBeLessThan(1.85);
            expect(cardGeometry.numberDisplay).toBe("none");
            const size = await page.locator("#listIn .item").count();
            expect(size).toBeGreaterThan(0);
            expect(size).toBeLessThanOrEqual(30);
            expect(await page.evaluate(() => listArray.length)).toBe(10000);
            await page.evaluate(() => {
                window.__gridEffects = [];
                window.sArrowFun = 1;
                window.changeVolume = () => __gridEffects.push("volume");
                window.playChannel = () => __gridEffects.push("play");
                _doKey(keys.RIGHT);
            });
            expect(await page.evaluate(() => selIndex)).toBe(3451);
            expect(await page.evaluate(() => __gridEffects)).toEqual([]);
            await page.evaluate(() => {
                document.getElementById("it" + selIndex).focus();
                confirmBox("Keep the current selection?", () => {});
            });
            await expect(page.locator("#dialogbox")).toBeVisible();
            await page.keyboard.press("Tab");
            expect(
                await page.evaluate(() =>
                    document
                        .getElementById("dialogbox")
                        .contains(document.activeElement)
                )
            ).toBe(true);
            await page.evaluate(() => _doKey(keys.DOWN));
            expect(await page.evaluate(() => selIndex)).toBe(3451);
            await page.evaluate(() => {
                __ottClassicScreenPort.close("dialog");
                $("#dialogbox").hide();
            });
            await expect(page.locator("#dialogbox")).toBeHidden();
            await expect(page.locator("#it3451")).toBeFocused();
            await page.evaluate(() => {
                closeList();
                _doKey(keys.RIGHT);
            });
            expect(await page.evaluate(() => __gridEffects)).toEqual([
                "volume",
            ]);
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    });
}

test("Modern and Classic retain the same mixed Favorites view and stable selection", async ({
    browser,
}) => {
    const fixture = await fixturePage(browser, "server");
    const { page } = fixture;
    try {
        await page.evaluate(() => {
            const rows = [
                "favorite-local",
                "favorite-m3u",
                "favorite-plex",
                "favorite-vportal",
            ];
            const items = {};
            rows.forEach((id) => {
                items[id] = {
                    channel_name: id,
                    descr: "From the shared Favorites view",
                    name: id,
                };
                if (id !== "favorite-m3u")
                    items[id].__ottMediaItem = {
                        __ottMediaCollection: "Favorites",
                        name: id,
                    };
            });
            window.__favoriteChoices = [];
            __ottChannelListView.show({
                categoryName: "Favorites",
                channel: (id) => items[id],
                detail: () => {},
                id: "system:global-favorites",
                key: (code) => {
                    if (code === keys.ENTER) {
                        __favoriteChoices.push(listArray[selIndex]);
                        return true;
                    }
                    return false;
                },
                locked: () => false,
                picon: () => "",
                playing: (id) => id === rows[0],
                rows,
                selected: 2,
            });
            window.__favoriteRows = listArray;
            saveSettings({ interfaceMode: 1 });
        });
        await expect(page.locator("#listIn")).toHaveClass(/modern-grid/);
        await expect(page.locator("#listCaption")).toContainText("Favorites");
        await expect(page.locator("#it2")).toContainText("favorite-plex");
        await page.evaluate(() => changeSelect(-1));
        await expect(page.locator("#listIn")).toHaveClass(/modern-grid/);
        await page.evaluate(() => changeSelect(1));
        await page.evaluate(() => _doKey(keys.ENTER));
        await page.evaluate(() => saveSettings({ interfaceMode: 0 }));
        await expect(page.locator("#listIn")).not.toHaveClass(/modern-catalog/);
        await page.evaluate(() => _doKey(keys.ENTER));
        expect(
            await page.evaluate(() => ({
                choices: __favoriteChoices,
                same: listArray === __favoriteRows,
                selected: listArray[selIndex],
            }))
        ).toEqual({
            choices: ["favorite-plex", "favorite-plex"],
            same: true,
            selected: "favorite-plex",
        });
        expect(fixture.errors).toEqual([]);
        expect(fixture.unexpectedRequests).toEqual([]);
    } finally {
        await fixture.close();
    }
});

async function waitForModernTouchLayout(page) {
    await page.evaluate(async () => {
        if (document.fonts) await document.fonts.ready;
    });
    let previous;
    let stableFrames = 0;
    let geometry;
    await expect
        .poll(
            async () => {
                // The fixture clock is paused. Advance animation frames so the
                // real renderer can complete pending layout work before touch.
                await page.clock.runFor(32);
                geometry = await page.evaluate(() => {
                    const owner = __ottClassicScreenPort.listOwner();
                    const metrics = __ottModernUi.touchMetrics(owner);
                    const list = document.getElementById("listIn");
                    const row = document.getElementById("it" + selIndex);
                    if (!metrics || !row) return null;
                    const css = getComputedStyle(list);
                    const box = list.getBoundingClientRect();
                    return {
                        columns: css.gridTemplateColumns.trim().split(/\s+/)
                            .length,
                        fontsReady:
                            !document.fonts ||
                            document.fonts.status === "loaded",
                        height:
                            row.getBoundingClientRect().height +
                            parseFloat(css.rowGap),
                        listHeight: box.height,
                        listWidth: box.width,
                        metrics,
                        paint: owner.model.paintRevision,
                        selected: selIndex,
                    };
                });
                const valid =
                    geometry &&
                    geometry.fontsReady &&
                    geometry.listWidth > 0 &&
                    geometry.listHeight > 0 &&
                    geometry.columns === geometry.metrics.stride &&
                    Math.abs(geometry.height - geometry.metrics.height) < 2;
                const signature = valid ? JSON.stringify(geometry) : null;
                stableFrames =
                    signature && signature === previous ? stableFrames + 1 : 0;
                previous = signature;
                return stableFrames;
            },
            {
                intervals: [0],
                message:
                    "Modern touch geometry must settle across animation frames",
            }
        )
        .toBeGreaterThanOrEqual(3);
    return geometry;
}

for (const width of [1280, 360]) {
    test(`Modern touch moves by visual rows and cancels after a mode change (${width}px)`, async ({
        browser,
    }) => {
        // Set the final viewport before startup. Resizing after installing the
        // paused clock can deliver WebKit's real resize event late and schedule
        // its debounce inside an otherwise stationary gesture.
        const fixture = await listTouchFixture({
            newContext: (options) =>
                browser.newContext({
                    ...options,
                    viewport: { height: 800, width },
                }),
        });
        const { page } = fixture;
        try {
            await page.evaluate(() => {
                cats.Fixture.forEach((id) => {
                    channels[id].__ottMediaItem = {
                        __ottMediaCollection: "Movies",
                        name: channels[id].channel_name,
                    };
                });
                _channelsList(0, 8);
                saveSettings({ interfaceMode: 1 });
            });
            await expect(page.locator("#listIn")).toHaveClass(/modern-grid/);
            const geometry = await waitForModernTouchLayout(page);
            if (width === 360) {
                // The full-width mobile shell can fit two readable cards.
                expect(geometry.columns).toBeGreaterThanOrEqual(1);
                expect(geometry.columns).toBeLessThanOrEqual(2);
            } else expect(geometry.columns).toBeGreaterThan(1);
            await page.evaluate((height) => {
                const metrics = __ottModernUi.touchMetrics;
                window.__touchMetricsTrace = [];
                __ottModernUi.touchMetrics = (owner) => {
                    const value = metrics(owner);
                    __touchMetricsTrace.push({
                        foreground: owner && owner.foreground(),
                        value,
                        visible: isListVisible,
                    });
                    return value;
                };
                __touchBegin(selIndex);
                __touchGesture.height = height;
            }, geometry.height);
            await page.clock.runFor(130);
            await page.evaluate(() => __touchSend("touchmove", -1.2));
            expect(
                await page.evaluate(() => selIndex),
                JSON.stringify(await page.evaluate(() => __touchMetricsTrace))
            ).toBe(geometry.selected + geometry.columns);
            await page.evaluate(() => __touchSend("touchend", -1.2));
            expect(await page.evaluate(() => __touchPlayed)).toEqual([]);
            expect(await page.evaluate(() => __touchClicks)).toEqual([]);
            const selected = await page.evaluate((height) => {
                __touchBegin(selIndex);
                __touchGesture.height = height;
                const selected = selIndex;
                saveSettings({ interfaceMode: 0 });
                return selected;
            }, geometry.height);
            await page.evaluate(() => {
                __touchSend("touchmove", -2.2);
                __touchSend("touchend", -2.2);
            });
            expect(await page.evaluate(() => selIndex)).toBe(selected);
            expect(await page.evaluate(() => __touchPlayed)).toEqual([]);
            expect(await page.evaluate(() => __touchClicks)).toEqual([]);
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    });
}

test("Modern Classic-palette grid fits padded bounds and gap clicks do not choose a card", async ({
    browser,
}) => {
    const fixture = await fixturePage(browser, "tauri", { interfaceTheme: 0 });
    const { page } = fixture;
    try {
        await seedModernMovies(page, 40, 2);
        await expect(page.locator("#listIn")).toHaveClass(/modern-grid/);
        const bounds = await page.evaluate(() => {
            const list = document.getElementById("listIn");
            const box = list.getBoundingClientRect();
            const css = getComputedStyle(list);
            const cards = Array.from(list.querySelectorAll(".item"), (card) =>
                card.getBoundingClientRect()
            );
            window.__gapChoices = [];
            window.playChannel = (...args) => __gapChoices.push(args);
            return {
                bottom: box.bottom - parseFloat(css.paddingBottom),
                last: Math.max(...cards.map((card) => card.bottom)),
                selected: selIndex,
                x: (cards[0].right + cards[1].left) / 2,
                y: cards[0].top + cards[0].height / 2,
            };
        });
        expect(bounds.last).toBeLessThanOrEqual(bounds.bottom + 1);
        const revisions = await page.evaluate(async () => {
            const frames = () =>
                new Promise((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(resolve))
                );
            await frames();
            const first =
                __ottClassicScreenPort.listOwner().model.paintRevision;
            await frames();
            await frames();
            return [
                first,
                __ottClassicScreenPort.listOwner().model.paintRevision,
            ];
        });
        expect(revisions[1]).toBe(revisions[0]);
        await page.mouse.click(bounds.x, bounds.y);
        expect(await page.evaluate(() => selIndex)).toBe(bounds.selected);
        expect(await page.evaluate(() => __gapChoices)).toEqual([]);
        expect(fixture.errors).toEqual([]);
        expect(fixture.unexpectedRequests).toEqual([]);
    } finally {
        await fixture.close();
    }
});

test("Modern narrow layout keeps long RTL titles inside the viewport", async ({
    browser,
}) => {
    const fixture = await fixturePage(browser, "tauri", {
        interfaceTheme: 2,
        uiFontScale: 120,
    });
    const { page } = fixture;
    try {
        await page.setViewportSize({ height: 851, width: 393 });
        await seedModernMovies(page, 40, 0);
        await expect(page.locator("#listIn")).toHaveClass(/modern-grid/);
        await page.evaluate(() => {
            document.documentElement.dir = "rtl";
            channels["movie-0"].channel_name =
                "الرحلة الطويلة عبر الصحراء والبحر";
            channels["movie-0"].__ottMediaItem.name =
                channels["movie-0"].channel_name;
            showPage(true);
        });
        await expect(page.locator("#it0 .modern-title")).toHaveText(
            "الرحلة الطويلة عبر الصحراء والبحر"
        );
        await expect
            .poll(() =>
                page
                    .locator("#listIn")
                    .evaluate((node) => node.getBoundingClientRect().width)
            )
            .toBeGreaterThan(100);
        const layout = await page.evaluate(() => {
            const list = document
                .getElementById("listIn")
                .getBoundingClientRect();
            const card = document.getElementById("it0").getBoundingClientRect();
            const title = document
                .querySelector("#it0 .modern-title")
                .getBoundingClientRect();
            return {
                left: card.left,
                listLeft: list.left,
                listRight: list.right,
                right: card.right,
                titleLeft: title.left,
                titleRight: title.right,
            };
        });
        expect(layout.left).toBeGreaterThanOrEqual(layout.listLeft - 1);
        expect(layout.right).toBeLessThanOrEqual(
            Math.min(393, layout.listRight) + 1
        );
        expect(layout.titleLeft).toBeGreaterThanOrEqual(layout.left - 1);
        expect(layout.titleRight).toBeLessThanOrEqual(layout.right + 1);
        await saveModernScreenshot(page, "tauri", "narrow-rtl");
        expect(fixture.errors).toEqual([]);
        expect(fixture.unexpectedRequests).toEqual([]);
    } finally {
        await fixture.close();
    }
});

test("Modern long media details stay within the hero through selection and mode changes", async ({
    browser,
}) => {
    const fixture = await fixturePage(browser, "tauri", {
        interfaceTheme: 2,
        uiFontScale: 140,
    });
    const { page } = fixture;
    try {
        await seedModernMovies(page, 40, 0);
        await page.evaluate(() => {
            const title =
                "Northern Passage — a journey across the distant mountains, the silent ocean and the long road home";
            channels["movie-0"].channel_name = title;
            channels["movie-0"].name = title;
            channels["movie-0"].__ottMediaItem.name = title;
            channels["movie-0"].descr =
                "A complete description follows the travellers through unfamiliar landscapes. ".repeat(
                    50
                );
            channels["movie-0"].__ottMediaItem.description =
                channels["movie-0"].descr;
            _channelsList(0, 0);
        });
        await expect(
            page.locator("#modernHero .modern-hero-title")
        ).toContainText("a journey across");
        await expect(
            page.locator("#modernHero .modern-hero-summary")
        ).toBeVisible();
        await page.evaluate(() => {
            window.__detailModeEffects = [];
            for (const name of [
                "stbStop",
                "stbPlay",
                "loadChannels",
                "getChannelsArray",
                "stbSetWindow",
                "stbToFullScreen",
            ])
                window[name] = () => __detailModeEffects.push(name);
        });
        for (const mode of [1, 0, 1]) {
            await page.evaluate(
                (mode) => saveSettings({ interfaceMode: mode }),
                mode
            );
            const selector = mode
                ? "#modernHero .modern-hero-summary"
                : "#_descr";
            await expect(page.locator(selector)).toBeVisible();
            const bounds = await page.evaluate((mode) => {
                const panel = document
                    .getElementById(mode ? "modernHero" : "listDetail")
                    .getBoundingClientRect();
                const text = document
                    .querySelector(
                        mode ? "#modernHero .modern-hero-summary" : "#_descr"
                    )
                    .getBoundingClientRect();
                return {
                    panelBottom: panel.bottom,
                    textBottom: text.bottom,
                    textHeight: text.height,
                };
            }, mode);
            expect(bounds.textHeight).toBeGreaterThan(0);
            expect(bounds.textBottom).toBeLessThanOrEqual(
                bounds.panelBottom + 1
            );
        }
        expect(await page.evaluate(() => __detailModeEffects)).toEqual([]);
        await saveModernScreenshot(page, "tauri", "long-details");
        expect(fixture.errors).toEqual([]);
        expect(fixture.unexpectedRequests).toEqual([]);
    } finally {
        await fixture.close();
    }
});

async function expectVisibleControlsWithinViewport(page, selector) {
    const controls = page.locator(selector);
    const count = await controls.count();
    expect(count, "The surface must expose its controls").toBeGreaterThan(0);
    for (const control of await controls.all())
        await expect(control).toBeVisible();
    // Resize handlers can move controls between protocol calls. Compare all
    // rectangles and hit targets from one synchronous layout snapshot.
    const snapshots = await controls.evaluateAll((elements) =>
        elements.map((element) => {
            const rect = element.getBoundingClientRect();
            const target = document.elementFromPoint(
                rect.left + rect.width / 2,
                rect.top + rect.height / 2
            );
            return {
                bottom: rect.bottom,
                height: rect.height,
                hit:
                    !!target &&
                    (element === target || element.contains(target)),
                label: element.textContent.trim(),
                left: rect.left,
                right: rect.right,
                top: rect.top,
                viewportHeight: innerHeight,
                viewportWidth: innerWidth,
                width: rect.width,
            };
        })
    );
    expect(snapshots.length).toBe(count);
    const rectangles = [];
    for (const bounds of snapshots) {
        expect(bounds.width).toBeGreaterThan(0);
        expect(bounds.height).toBeGreaterThan(0);
        expect(bounds.left).toBeGreaterThanOrEqual(-1);
        expect(bounds.top).toBeGreaterThanOrEqual(-1);
        expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
        expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight + 1);
        expect(
            bounds.hit,
            "Visible controls must be reachable, not covered by a shell"
        ).toBe(true);
        for (const other of rectangles) {
            const overlapWidth =
                Math.min(bounds.right, other.right) -
                Math.max(bounds.left, other.left);
            const overlapHeight =
                Math.min(bounds.bottom, other.bottom) -
                Math.max(bounds.top, other.top);
            expect(
                overlapWidth > 1 && overlapHeight > 1,
                `Controls must not overlap: ${bounds.label} / ${other.label}`
            ).toBe(false);
        }
        rectangles.push(bounds);
    }
}

async function attachModernRuntimeIdentity(page, browser) {
    await test.info().attach("loaded runtime identity", {
        body: JSON.stringify({
            browser: browser.version(),
            build: await page.evaluate(
                () => __ottRemoteInspect.snapshot().build
            ),
        }),
        contentType: "application/json",
    });
}

for (const profile of ["server", "tauri", "capacitor"]) {
    test(`Modern Home and Library share selection with horizontal navigation (${profile})`, async ({
        browser,
    }) => {
        const fixture = await fixturePage(browser, profile, {
            interfaceTheme: 2,
        });
        const { page } = fixture;
        try {
            await seedModernMovies(page, 10000, 0);
            await attachModernRuntimeIdentity(page, browser);
            const rail = page.locator('#modernRail[aria-label="Menu"]');
            await expect(rail).toBeVisible();
            await expect(page.locator("#list")).toHaveClass(/modern-view-home/);
            await expect(
                page.locator('[data-modern-action="home"]')
            ).toHaveAttribute("aria-current", "page");
            await expect(page.locator("#modernHero")).toBeVisible();
            await expect(
                page.locator("#modernHero .modern-hero-title")
            ).toHaveText("Northern Passage");
            await expect(page.locator("#modernLibraryHeading")).toContainText(
                "Movies"
            );
            await expect(page.locator("#modernLibraryHeading")).toContainText(
                "10000"
            );
            const geometry = await page.evaluate(() => {
                const list = document
                    .getElementById("listIn")
                    .getBoundingClientRect();
                const hero = document
                    .getElementById("modernHero")
                    .getBoundingClientRect();
                const nav = document
                    .getElementById("modernRail")
                    .getBoundingClientRect();
                return {
                    cardCount: document.querySelectorAll("#listIn .modern-card")
                        .length,
                    heroWidth: hero.width,
                    left: list.left,
                    navBottom: nav.bottom,
                    right: list.right,
                    rowTops: Array.from(
                        document.querySelectorAll("#listIn .modern-card")
                    ).map((card) =>
                        Math.round(card.getBoundingClientRect().top)
                    ),
                    top: list.top,
                    width: list.width,
                };
            });
            expect(geometry.cardCount).toBeGreaterThan(0);
            expect(geometry.cardCount).toBeLessThanOrEqual(64);
            expect(geometry.width).toBeGreaterThan(1280 * 0.65);
            expect(geometry.heroWidth).toBeGreaterThan(1280 * 0.5);
            expect(geometry.left).toBeGreaterThanOrEqual(0);
            expect(geometry.top).toBeGreaterThanOrEqual(geometry.navBottom - 1);
            expect(geometry.right).toBeLessThanOrEqual(1281);
            expect(new Set(geometry.rowTops).size).toBe(1);
            await expectVisibleControlsWithinViewport(
                page,
                "#modernRail [data-modern-action], .modern-account-actions [data-modern-action]"
            );
            await page.evaluate(() => {
                stbBindKeyHandler();
                window.__modernRailEffects = [];
                window.stbPlay = () => __modernRailEffects.push("play");
                window.stbStop = () => __modernRailEffects.push("stop");
                document.getElementById("it0").focus();
            });
            await page.keyboard.press("ArrowUp");
            await expect(
                page.locator('#modernHero [data-modern-hero-action="play"]')
            ).toBeFocused();
            await page.keyboard.press("ArrowUp");
            expect(
                await page.evaluate(
                    () => !!document.activeElement.closest("#modernRail")
                )
            ).toBe(true);
            await expect(page.locator(".modern-rail-selected")).toHaveCount(1);
            await page.keyboard.press("ArrowDown");
            await expect(
                page.locator('#modernHero [data-modern-hero-action="play"]')
            ).toBeFocused();
            await expect(page.locator(".modern-rail-selected")).toHaveCount(0);
            await expect(page.locator("#list")).not.toHaveClass(
                /modern-rail-focused/
            );
            await page.keyboard.press("ArrowDown");
            await expect(page.locator("#it0")).toBeFocused();
            expect(await page.evaluate(() => listArray[selIndex])).toBe(
                "movie-0"
            );
            await page.locator('[data-modern-action="library"]').click();
            await expect(page.locator("#list")).toHaveClass(
                /modern-view-library/
            );
            await expect(
                page.locator('[data-modern-action="library"]')
            ).toHaveAttribute("aria-current", "page");
            const library = await page.evaluate(() => {
                const art = document
                    .querySelector("#it0 .modern-art")
                    .getBoundingClientRect();
                return {
                    ratio: art.width / art.height,
                    rows: new Set(
                        Array.from(
                            document.querySelectorAll("#listIn .modern-card")
                        ).map((card) =>
                            Math.round(card.getBoundingClientRect().top)
                        )
                    ).size,
                    selected: listArray[selIndex],
                };
            });
            expect(library.ratio).toBeGreaterThan(0.64);
            expect(library.ratio).toBeLessThan(0.69);
            expect(library.selected).toBe("movie-0");
            // A short viewport can fit only one natural-height poster row.
            expect(library.rows).toBeGreaterThanOrEqual(1);
            expect(library.rows).toBeLessThanOrEqual(2);
            await page.setViewportSize({ height: 851, width: 393 });
            await page.evaluate(() => saveSettings({ uiFontScale: 140 }));
            await expect
                .poll(async () =>
                    page.evaluate(() => {
                        const card = document.getElementById("it0");
                        const box = card.getBoundingClientRect();
                        const art = card
                            .querySelector(".modern-art")
                            .getBoundingClientRect();
                        const copy = card
                            .querySelector(".modern-copy")
                            .getBoundingClientRect();
                        const ratio = art.width / art.height;
                        return (
                            box.width > 120 &&
                            ratio > 0.64 &&
                            ratio < 0.69 &&
                            copy.bottom <= box.bottom + 1 &&
                            box.right <= innerWidth &&
                            box.bottom <= innerHeight
                        );
                    })
                )
                .toBe(true);
            await page.evaluate(() => saveSettings({ uiFontScale: 100 }));
            await page.setViewportSize({ height: 720, width: 1280 });
            await page.locator('[data-modern-action="home"]').click();
            await expect(page.locator("#list")).toHaveClass(/modern-view-home/);
            expect(await page.evaluate(() => listArray[selIndex])).toBe(
                "movie-0"
            );
            await page.evaluate(() => document.getElementById("it0").focus());
            await expect(
                page.locator('[data-modern-action="home"]')
            ).toHaveAttribute("aria-current", "page");
            await expect(
                page.locator("#modernRail .modern-rail-selected")
            ).toHaveCount(0);
            await page.screenshot({
                path: test.info().outputPath("modern-library-shell.png"),
            });
            await page.evaluate(() => saveSettings({ interfaceMode: 0 }));
            await expect(rail).toHaveCount(0);
            await expect(page.locator("#modernHero")).toHaveCount(0);
            await expect(page.locator("#it0")).toBeFocused();
            expect(await page.evaluate(() => listArray[selIndex])).toBe(
                "movie-0"
            );
            expect(await page.evaluate(() => __modernRailEffects)).toEqual([]);
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    });
}

for (const profile of ["server", "tauri", "capacitor"]) {
    test(`Modern pointer activation survives a same-screen repaint (${profile})`, async ({
        browser,
    }) => {
        const fixture = await fixturePage(browser, profile, {
            interfaceTheme: 2,
        });
        const { page } = fixture;
        try {
            await seedModernMovies(page, 80, 5);
            await attachModernRuntimeIdentity(page, browser);
            await page.evaluate(() => {
                window.__repaintPlays = [];
                window.__repaintClicks = [];
                document.addEventListener(
                    "click",
                    (event) => {
                        const target = event.target.closest("button");
                        const action =
                            target?.getAttribute("data-modern-action") ||
                            target?.getAttribute("data-modern-hero-action");
                        if (action) __repaintClicks.push(action);
                    },
                    true
                );
                window.playChannel = (category, index) =>
                    __repaintPlays.push([category, listArray[index]]);
            });
            await page.locator('[data-modern-action="library"]').click();
            await expect(page.locator("#list")).toHaveClass(
                /modern-view-library/
            );
            await page.evaluate(() => {
                __repaintClicks.length = 0;
            });
            for (const selector of [
                '[data-modern-action="home"]',
                '[data-modern-hero-action="play"]',
            ]) {
                const button = page.locator(selector);
                const pressed = await button.elementHandle();
                const caption = await button
                    .locator("span")
                    .last()
                    .elementHandle();
                const box = await caption.boundingBox();
                await page.mouse.move(
                    box.x + box.width / 2,
                    box.y + box.height / 2
                );
                await page.mouse.down();
                // Exercise the actual resize repaint path inside a real press,
                // without relying on a particular browser's debounce timing.
                const retained = await pressed.evaluate((element) => {
                    window.showPage(true);
                    return element.isConnected;
                });
                const captionRetained = await caption.evaluate(
                    (element) => element.isConnected
                );
                await page.mouse.up();
                const state = await page.evaluate(() => ({
                    clicks: __repaintClicks.slice(),
                    home: document
                        .getElementById("list")
                        .classList.contains("modern-view-home"),
                    plays: __repaintPlays.slice(),
                }));
                await test.info().attach("repaint pointer result", {
                    body: JSON.stringify({
                        captionRetained,
                        retained,
                        selector,
                        state,
                    }),
                    contentType: "application/json",
                });
                if (selector.includes("modern-action")) {
                    expect({ captionRetained, retained, ...state }).toEqual({
                        captionRetained: true,
                        clicks: ["home"],
                        home: true,
                        plays: [],
                        retained: true,
                    });
                } else {
                    expect(retained && captionRetained).toBe(true);
                    expect(state.clicks).toEqual(["home", "play"]);
                    expect(state.plays).toEqual([[0, "movie-5"]]);
                    await expect(page.locator("#list")).toBeHidden();
                }
                await pressed.dispose();
                await caption.dispose();
            }
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    });
}

for (const profile of ["server", "tauri", "capacitor"]) {
    test(`Modern hero uses the selected item's shared Play and Description commands (${profile})`, async ({
        browser,
    }) => {
        const fixture = await fixturePage(browser, profile, {
            interfaceTheme: 2,
        });
        const { page } = fixture;
        try {
            await seedModernMovies(page, 80, 5);
            await attachModernRuntimeIdentity(page, browser);
            await page.evaluate(() => {
                stbBindKeyHandler();
                window.__heroPlays = [];
                window.playChannel = (category, index) =>
                    __heroPlays.push([category, listArray[index]]);
            });
            const hero = page.locator("#modernHero");
            const buttons = await hero
                .locator(".modern-hero-action")
                .evaluateAll((items) =>
                    items.map((item) => {
                        const icon = item
                            .querySelector("svg")
                            .getBoundingClientRect();
                        return {
                            height: item.getBoundingClientRect().height,
                            iconHeight: icon.height,
                            iconWidth: icon.width,
                            textSize: parseFloat(
                                getComputedStyle(item).fontSize
                            ),
                        };
                    })
                );
            expect(buttons.length).toBe(2);
            expect(
                Math.abs(buttons[0].height - buttons[1].height)
            ).toBeLessThan(2);
            for (const button of buttons) {
                expect(button.iconHeight).toBeLessThanOrEqual(
                    button.textSize * 1.5
                );
                expect(button.iconWidth).toBeLessThanOrEqual(
                    button.textSize * 1.5
                );
            }
            await hero
                .getByRole("button", { exact: true, name: "Description" })
                .click();
            await expect(page.locator("#listAbout")).toBeVisible();
            await expect(page.locator("#listAbout")).toContainText(
                "Under City Lights"
            );
            expect(await page.evaluate(() => __heroPlays)).toEqual([]);
            await page.evaluate(() => _doKey(keys.RETURN));
            await expect(page.locator("#listAbout")).toBeHidden();
            expect(await page.evaluate(() => listArray[selIndex])).toBe(
                "movie-5"
            );

            await page.evaluate(() => changeSelect(1));
            await expect(hero.locator(".modern-hero-title")).toHaveText(
                "Ocean of Silence"
            );
            await hero
                .getByRole("button", { exact: true, name: "Play" })
                .click();
            expect(await page.evaluate(() => __heroPlays)).toEqual([
                [0, "movie-6"],
            ]);
            await expect(page.locator("#list")).toBeHidden();
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    });
}

for (const viewport of [
    { height: 720, width: 1280 },
    { height: 851, width: 393 },
]) {
    test(`Modern editor and dialog keep reachable exit controls at ${viewport.width}px`, async ({
        browser,
    }) => {
        const fixture = await fixturePage(browser, "tauri", {
            interfaceTheme: 2,
            uiFontScale: 140,
        });
        const { page } = fixture;
        try {
            if (viewport.width === 393)
                await attachModernRuntimeIdentity(page, browser);
            await page.setViewportSize(viewport);
            await seedModernMovies(page, 100, 17);
            await expect(page.locator("#it17.modern-card")).toBeVisible();
            await page.evaluate(() => {
                stbBindKeyHandler();
                window.__modernEditorSaved = [];
                window.editCaption =
                    "Search movies, programmes and local library files";
                window.editvar = "Northern Passage";
                window.setEdit = () =>
                    window.__modernEditorSaved.push(window.editvar);
                document.getElementById("it17").focus();
                showEditKey1();
            });
            const input = page.locator("#editvar");
            await expect(input).toBeFocused();
            await input.fill("Uncommitted search");
            await expectVisibleControlsWithinViewport(
                page,
                '#editRemoteInput, #listEdit [data-ott-key="13"], #listEdit [data-ott-key="27"]'
            );
            const saveButton = page.locator('#listEdit [data-ott-key="13"]');
            await saveButton.scrollIntoViewIfNeeded();
            const visibleSave = await saveButton.evaluate((element) => {
                const button = element.getBoundingClientRect();
                const editor = document
                    .getElementById("listEdit")
                    .getBoundingClientRect();
                return {
                    bottom: button.bottom,
                    editorBottom: editor.bottom,
                    editorTop: editor.top,
                    top: button.top,
                };
            });
            expect(visibleSave.top).toBeGreaterThanOrEqual(
                visibleSave.editorTop
            );
            expect(visibleSave.bottom).toBeLessThanOrEqual(
                visibleSave.editorBottom
            );
            await page.screenshot({
                path: test.info().outputPath("modern-editor.png"),
            });
            await page.locator('#listEdit [data-ott-key="27"]').click();
            await expect(page.locator("#listEdit")).toBeHidden();
            expect(await page.evaluate(() => __modernEditorSaved)).toEqual([]);
            expect(await page.evaluate(() => listArray[selIndex])).toBe(
                "movie-17"
            );
            await expect(page.locator("#it17")).toBeFocused();

            await page.evaluate(() => {
                window.__modernDialogChoice = [];
                confirmBox(
                    "The source is unavailable. Keep the current library and try again later?",
                    () => __modernDialogChoice.push("yes"),
                    () => __modernDialogChoice.push("no")
                );
            });
            await expect(page.locator("#dialogbox")).toBeVisible();
            await expectVisibleControlsWithinViewport(
                page,
                "#dialogbox [data-ott-key]"
            );
            await page.keyboard.press("Tab");
            expect(
                await page.evaluate(() =>
                    document
                        .getElementById("dialogbox")
                        .contains(document.activeElement)
                )
            ).toBe(true);
            await page.screenshot({
                path: test.info().outputPath("modern-dialog.png"),
            });
            await page.keyboard.press("Backspace");
            await expect(page.locator("#dialogbox")).toBeHidden();
            expect(await page.evaluate(() => __modernDialogChoice)).toEqual([
                "no",
            ]);
            expect(await page.evaluate(() => listArray[selIndex])).toBe(
                "movie-17"
            );
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    });
}

for (const mode of [0, 1]) {
    test(`Editor cancellation restores focus and deferred cleanup preserves a replacement editor (mode ${mode})`, async ({
        browser,
    }) => {
        const fixture = await fixturePage(browser, "tauri");
        const { page } = fixture;
        try {
            await seedModernMovies(page, 40, 2);
            await page.evaluate((mode) => {
                saveSettings({ interfaceMode: mode });
                stbBindKeyHandler();
                document.getElementById("it2").focus();
                window.editCaption = "Source address";
                window.editvar = "https://example.invalid/library";
                window.setEdit = () => {};
                showEditKey1();
            }, mode);
            await expect(page.locator("#editvar")).toBeFocused();
            await page.locator('#listEdit [data-ott-key="27"]').click();
            await expect(page.locator("#listEdit")).toBeHidden();
            await expect(page.locator("#it2")).toBeFocused();
            await expect(page.locator("#listEdit input")).toHaveCount(0);

            await page.evaluate(() => {
                window.editCaption = "First value";
                window.editvar = "first";
                window.setEdit = () => {
                    window.editCaption = "Second value";
                    window.editvar = "replacement survives";
                    window.setEdit = () => {};
                    showEditKey1();
                };
                showEditKey1();
            });
            await page.locator('#listEdit [data-ott-key="13"]').click();
            await expect(page.locator("#editvar")).toHaveValue(
                "replacement survives"
            );
            // Let the previous owner's deferred teardown run before checking
            // the replacement's control and current focus again.
            await page.evaluate(
                () =>
                    new Promise((resolve) =>
                        requestAnimationFrame(() =>
                            requestAnimationFrame(resolve)
                        )
                    )
            );
            await expect(page.locator("#editvar")).toHaveValue(
                "replacement survives"
            );
            await expect(page.locator("#editvar")).toBeFocused();
            await page.locator('#listEdit [data-ott-key="27"]').click();
            await expect(page.locator("#listEdit")).toBeHidden();
            await expect(page.locator("#listEdit input")).toHaveCount(0);
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    });
}

test("Modern navigation keeps library, categories, settings and search in the same shell", async ({
    browser,
}) => {
    const fixture = await fixturePage(browser, "tauri", {
        interfaceTheme: 2,
    });
    const { page } = fixture;
    try {
        await attachModernRuntimeIdentity(page, browser);
        await seedModernMovies(page, 80, 5);
        // The global Favorites store is lazy, but its entrypoint must be
        // available before a user has opened it in this session.
        expect(await page.evaluate(() => !!window.__ottGlobalFavorites)).toBe(
            false
        );
        await expect(
            page.locator('#modernRail [data-modern-action="favorites"]')
        ).toBeVisible();
        await page.evaluate(() => {
            // Provider startup normally installs this real channel renderer;
            // the isolated fixture deliberately skips the network bootstrap.
            window.channelsList = window._channelsList;
            window.providerGetItem = () => null;
            window.providerSetItem = () => {};
            window.favoritesArray = [];
            window.cList = cats.Movies.slice();
            cList.forEach((id) => {
                channels[id].category = { name: "Movies" };
            });
            window.catIndex = 0;
            window.primaryIndex = 5;
            window.curList = cats.Movies;
            window.__ottChannels.mount(window);
            const movies = window.__ottChannels.index("provider:Movies");
            if (movies < 0)
                throw new Error("Fixture Movies library was not mounted");
            window.catIndex = movies;
            window.curList = cats[catsArray[movies]];
            _channelsList(movies, 5);
            stbBindKeyHandler();
        });
        const action = (name) =>
            page.locator(`#modernShell [data-modern-action="${name}"]`);
        await expect(action("library")).toBeVisible();
        await action("categories").click();
        await expect(page.locator("#listCaption")).toHaveText(
            "Category selection"
        );
        await expect(page.locator("#list")).toHaveClass(/modern-screen-menu/);
        await expect(page.locator("#modernRail")).toBeVisible();
        await page.screenshot({
            path: test.info().outputPath("modern-categories.png"),
        });
        await action("library").click();
        await expect(page.locator("#listIn")).toHaveClass(/modern-grid/);
        expect(await page.evaluate(() => listArray[selIndex])).toBe("movie-5");
        await action("settings").click();
        await expect(page.locator("#listCaption")).toHaveText("Settings");
        await expect(page.locator("#list")).toHaveClass(/modern-screen-menu/);
        await expect(page.locator("#listIn .item").first()).toBeVisible();
        await expectVisibleControlsWithinViewport(
            page,
            '#modernRail [data-modern-action="library"]'
        );
        await action("library").focus();
        for (let step = 0; step < 10; step++) {
            await page.keyboard.press("ArrowRight");
            await expect(
                page.locator("#modernShell button:focus")
            ).toBeVisible();
        }
        await expect(page.locator("#listCaption")).toHaveText("Settings");
        await page.screenshot({
            path: test.info().outputPath("modern-settings.png"),
        });
        await action("library").click();
        await expect(page.locator("#listIn")).toHaveClass(/modern-grid/);
        expect(await page.evaluate(() => listArray[selIndex])).toBe("movie-5");
        await action("search").click();
        await expect(page.locator("#editvar")).toBeVisible();
        await page.locator("#editvar").fill("Not committed");
        await page.locator('#listEdit [data-ott-key="27"]').click();
        await expect(page.locator("#listEdit")).toBeHidden();
        await expect(page.locator("#listIn")).toHaveClass(/modern-grid/);
        expect(await page.evaluate(() => listArray[selIndex])).toBe("movie-5");
        expect(fixture.errors).toEqual([]);
        expect(fixture.unexpectedRequests).toEqual([]);
    } finally {
        await fixture.close();
    }
});

for (const mode of [0, 1]) {
    test(`Editor opened from keyboard without prior row focus returns to its list (mode ${mode})`, async ({
        browser,
    }) => {
        const fixture = await fixturePage(browser, "tauri");
        const { page } = fixture;
        try {
            await page.evaluate((mode) => {
                window.__bodyEditorEntries = 0;
                __ottChannelListView.show({
                    categoryName: "Editable library",
                    channel: () => ({
                        channel_name: "Edit source",
                        name: "Edit source",
                    }),
                    detail: () => {},
                    id: "fixture:editable-library",
                    key: (code) => {
                        if (code !== keys.ENTER) return false;
                        __bodyEditorEntries++;
                        window.editCaption = "Source address";
                        window.editvar = "https://example.invalid/library";
                        window.setEdit = () => {};
                        showEditKey1();
                        return true;
                    },
                    locked: () => false,
                    picon: () => "",
                    playing: () => false,
                    rows: ["source"],
                    selected: 0,
                });
                saveSettings({ interfaceMode: mode });
                stbBindKeyHandler();
                document.activeElement.blur();
            }, mode);
            expect(
                await page.evaluate(
                    () => document.activeElement === document.body
                )
            ).toBe(true);
            await page.keyboard.press("Enter");
            await expect(page.locator("#editvar")).toBeFocused();
            await page.locator('#listEdit [data-ott-key="27"]').click();
            await expect(page.locator("#listEdit")).toBeHidden();
            await expect(page.locator("#it0")).toBeFocused();
            await page.keyboard.press("Enter");
            await expect(page.locator("#editvar")).toBeFocused();
            expect(await page.evaluate(() => __bodyEditorEntries)).toBe(2);
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    });
}

test("Modern fullscreen timeline and audio picker preserve the playback owner", async ({
    browser,
}) => {
    const fixture = await fixturePage(browser, "tauri", { interfaceTheme: 2 });
    const { page } = fixture;
    try {
        await page.evaluate(() => {
            window.__modernMediaEffects = [];
            window.__modernSeeks = [];
            window.__modernTrackChoices = [];
            window.catIndex = 0;
            window.primaryIndex = 0;
            window.curList = cats.Fixture;
            window.__modernPlaybackOwner = {
                active: () => true,
                selectTrack: (kind, id) =>
                    __modernTrackChoices.push([kind, id]),
                snapshot: () => ({
                    duration: 1000,
                    phase: "playing",
                    position: 250,
                }),
                tracks: () => [
                    { id: 0, language: "eng", name: "English", selected: true },
                    { id: 1, language: "fra", name: "French", selected: false },
                    {
                        id: 2,
                        language: "spa",
                        name: "Spanish",
                        selected: false,
                    },
                ],
            };
            __ottCoreBackend().current = () => __modernPlaybackOwner;
            for (const name of ["stbPlay", "stbStop", "stbPause", "stbResume"])
                window[name] = () => __modernMediaEffects.push(name);
            window.stbGetLen = () => 1000;
            window.stbGetPosTime = () => 250;
            window.stbSetPosTime = (value) => __modernSeeks.push(value);
            window.__ottClassicPlayback.command({
                channelId: "one",
                type: "live",
            });
            window.__ottClassicPlayback.command({
                duration: 1000,
                type: "finite-channel",
            });
            saveSettings({ interfaceMode: 1 });
            stbBindKeyHandler();
            closeList();
            // Supply the read-only programme view without a network decoder.
            window.__ottClassicPlayback.programme = () => ({
                collection: "Fixture movies",
                duration: 1000,
                nextStartedAt: 1700001000,
                nextTitle: "Ocean of Silence",
                position: 250,
                startedAt: 1700000000,
                title: "Northern Passage",
            });
            window.__ottClassicPlayback.command({ type: "playing" });
            updateMediaInfo();
            showChannelInfo(10);
            $("#info1").finish();
        });
        await expect(page.locator("#modernPlayer")).toBeVisible();
        await expect(page.locator("#modernPlayerTitle")).toHaveText(
            "Northern Passage"
        );
        await expect(page.locator("#info1")).toBeHidden();
        const clockBounds = await page.evaluate(() => ({
            channelRight: document
                .getElementById("channel")
                .getBoundingClientRect().right,
            endRight: document
                .getElementById("end_time")
                .getBoundingClientRect().right,
        }));
        expect(clockBounds.endRight).toBeLessThanOrEqual(
            clockBounds.channelRight
        );
        await expect(page.locator("#progress_div")).toBeVisible();
        const progress = await page.locator("#progress_div").boundingBox();
        expect(progress.width).toBeGreaterThan(100);
        expect(progress.x).toBeGreaterThanOrEqual(0);
        expect(progress.y + progress.height).toBeLessThanOrEqual(720);
        await page.mouse.click(
            progress.x + progress.width / 4,
            progress.y - progress.height / 2 + 0.5
        );
        await expect
            .poll(() => page.evaluate(() => __modernSeeks.length))
            .toBe(1);
        const position = await page.evaluate(() => __modernSeeks[0]);
        // Mouse coordinates are rounded to device pixels on some engines.
        expect(Math.abs(position - 250)).toBeLessThanOrEqual(
            Math.ceil(1000 / progress.width)
        );
        await expect(page.locator("#descr")).toBeHidden();
        await page.screenshot({
            path: test.info().outputPath("modern-fullscreen-osd.png"),
        });
        await page.evaluate(() => stbToggleAudioTrack());
        await expect(page.locator("#numprog")).toBeVisible();
        await expect(page.locator('#numprog [role="button"]')).toHaveCount(3);
        await expectVisibleControlsWithinViewport(
            page,
            '#numprog [role="button"]'
        );
        await page.screenshot({
            path: test.info().outputPath("modern-audio-picker.png"),
        });
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await expect(page.locator("#numprog")).toBeHidden();
        expect(await page.evaluate(() => __modernTrackChoices)).toEqual([
            ["audio", 1],
        ]);
        expect(
            await page.evaluate(
                () => __ottCoreBackend().current() === __modernPlaybackOwner
            )
        ).toBe(true);
        await page.evaluate(() => {
            // The decoder reports an actual zero after rewind. A stale shared
            // footer fill must not be mistaken for a newer timing sample.
            // This fixture replaces stbPlay and never starts a decoder. Supply
            // its timing element at the same #video boundary used by the UI.
            let video = document.getElementById("video");
            if (!video) {
                video = document.createElement("video");
                video.id = "video";
                video.hidden = true;
                document.body.appendChild(video);
            }
            Object.defineProperty(video, "currentTime", {
                configurable: true,
                value: 0,
            });
            Object.defineProperty(video, "duration", {
                configurable: true,
                value: 1000,
            });
            window.stbGetPosTime = () => 0;
            showChannelInfo(30);
            $("#info1").finish();
            document.getElementById("progress").style.width = "65%";
            __ottModernPlayer.sync();
        });
        await expect(page.locator("#modernPlayer")).toBeVisible();
        expect(
            await page
                .locator("#progress")
                .evaluate((element) => element.style.width)
        ).toBe("0%");
        await expect(page.locator(".modern-player-elapsed")).toHaveText("0:00");

        await page.evaluate(() => {
            window.__modernStatusChoices = 0;
            const source = document.getElementById("video_res");
            source.textContent = "Playback details";
            source.setAttribute("role", "button");
            source.onclick = () => {
                window.__modernStatusChoices++;
            };
            __ottModernPlayer.sync();
        });
        const status = page.locator(".modern-player-status");
        for (const key of ["Enter", "Space"]) {
            await page.evaluate(() => {
                showChannelInfo(30);
                $("#info1").finish();
                __ottModernPlayer.sync();
            });
            await expect(status).toHaveAttribute("role", "button");
            await status.focus();
            await page.keyboard.press(key);
            await expect(page.locator("#modernPlayer")).toBeHidden();
        }
        expect(await page.evaluate(() => __modernStatusChoices)).toBe(2);
        await page.evaluate(() => {
            showChannelInfo(30);
            $("#info1").finish();
            __ottModernPlayer.sync();
        });
        await status.focus();
        await page.evaluate(() => {
            document.getElementById("video_res").textContent = "";
            __ottModernPlayer.sync();
        });
        await expect(status).toBeHidden();
        await expect(status).not.toHaveAttribute("tabindex", "0");
        await expect(
            page.locator(".modern-player-actions button:focus")
        ).toBeVisible();
        await page.screenshot({
            path: test.info().outputPath("modern-fullscreen-zero-position.png"),
        });
        expect(await page.evaluate(() => __modernMediaEffects)).toEqual([]);
        expect(fixture.errors).toEqual([]);
        expect(fixture.unexpectedRequests).toEqual([]);
    } finally {
        await fixture.close();
    }
});

for (const profile of ["server", "tauri", "capacitor"]) {
    test(`Modern dynamic tracks preserve the focused Aspect action (${profile})`, async ({
        browser,
    }) => {
        const fixture = await fixturePage(browser, profile, {
            interfaceTheme: 2,
        });
        const { page } = fixture;
        try {
            await attachModernRuntimeIdentity(page, browser);
            await page.evaluate(() => {
                // Model decoder track discovery on the actual core video element.
                // Keyboard ownership, track discovery and actions stay production code.
                stbInit();
                window.__dynamicAudio = [];
                window.__dynamicSubtitles = [];
                const media = document.getElementById("video");
                Object.defineProperties(media, {
                    audioTracks: {
                        configurable: true,
                        get: () => __dynamicAudio,
                    },
                    currentTime: { configurable: true, get: () => 250 },
                    duration: { configurable: true, get: () => 1000 },
                    paused: { configurable: true, get: () => false },
                    textTracks: {
                        configurable: true,
                        get: () => __dynamicSubtitles,
                    },
                });
                window.catIndex = 0;
                window.primaryIndex = 0;
                window.curList = cats.Fixture;
                __ottClassicPlayback.command({
                    channelId: "one",
                    type: "live",
                });
                __ottClassicPlayback.command({
                    duration: 1000,
                    type: "finite-channel",
                });
                saveSettings({ interfaceMode: 1 });
                closeList();
                __ottClassicPlayback.command({ type: "playing" });
                updateMediaInfo();
            });
            const aspect = page.locator('[data-modern-player-action="aspect"]');
            for (const availability of [
                { audio: true, label: "audio-appears", subtitle: false },
                { audio: false, label: "audio-disappears", subtitle: false },
                { audio: false, label: "subtitles-appear", subtitle: true },
                { audio: false, label: "subtitles-disappear", subtitle: false },
            ]) {
                await page.evaluate(() => {
                    showChannelInfo(30);
                    $("#info1").finish();
                });
                await expect(aspect).toBeVisible();
                if (
                    await page.evaluate(
                        () => __ottModernPlayer.state().group !== "timeline"
                    )
                )
                    await page.keyboard.press("ArrowUp");
                await page.keyboard.press("ArrowDown");
                for (let step = 0; step < 12; step++) {
                    if (
                        await aspect.evaluate(
                            (button) => button === document.activeElement
                        )
                    )
                        break;
                    await page.keyboard.press("ArrowRight");
                }
                await expect(aspect).toBeFocused();
                await page.evaluate(({ audio, subtitle }) => {
                    window.__dynamicAudio = audio
                        ? [
                              {
                                  enabled: true,
                                  label: "English",
                                  language: "eng",
                              },
                              {
                                  enabled: false,
                                  label: "French",
                                  language: "fra",
                              },
                          ]
                        : [];
                    window.__dynamicSubtitles = subtitle
                        ? [
                              {
                                  kind: "captions",
                                  label: "English",
                                  language: "eng",
                                  mode: "disabled",
                              },
                          ]
                        : [];
                    __ottModernPlayer.sync();
                }, availability);
                await expect(
                    page.locator('[data-modern-player-action="audio"]')
                )[availability.audio ? "toBeVisible" : "toBeHidden"]();
                await expect(
                    page.locator('[data-modern-player-action="subtitle"]')
                )[availability.subtitle ? "toBeVisible" : "toBeHidden"]();
                await expect(aspect).toBeFocused();
                await page.screenshot({
                    path: test.info().outputPath(availability.label + ".png"),
                });
                await page.keyboard.press("Enter");
                const picker = page.locator("#numprog");
                await expect(picker).toBeVisible();
                // This is the actual Aspect callback, not an audio/subtitle/list callback.
                await expect(picker.getByRole("button")).toHaveText([
                    "Fit to screen",
                    "Fill screen",
                ]);
                await picker
                    .getByRole("button", {
                        exact: true,
                        name:
                            availability.audio || availability.subtitle
                                ? "Fill screen"
                                : "Fit to screen",
                    })
                    .click();
                await expect(picker).toBeHidden();
                await expect(page.locator("#video")).toHaveCSS(
                    "object-fit",
                    availability.audio || availability.subtitle
                        ? "cover"
                        : "contain"
                );
            }
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    });
}

for (const initialMode of [0, 1]) {
    test(`Graphical editor accepts L and l across Classic and Modern (initial ${initialMode})`, async ({
        browser,
    }) => {
        const fixture = await fixturePage(browser, "server", {
            interfaceTheme: 2,
        });
        const { page } = fixture;
        try {
            await attachModernRuntimeIdentity(page, browser);
            await page.evaluate(() => {
                // Desktop/native shells intentionally choose HTML input. Exercise the
                // real non-native STB graphical path without changing its dispatcher.
                window.ott_device = "lg-webos";
                stbSetItem("ottplaylang", "_eng");
                saveSettings({ editor: 0 });
                setEditor();
                stbBindKeyHandler();
                window.__graphicalSaves = [];
                window.__graphicalFullscreenEvents = 0;
                document.addEventListener(
                    "fullscreenchange",
                    () => __graphicalFullscreenEvents++
                );
                document.addEventListener(
                    "webkitfullscreenchange",
                    () => __graphicalFullscreenEvents++
                );
            });
            for (const mode of [initialMode, 1 - initialMode]) {
                await page.evaluate((mode) => {
                    saveSettings({ interfaceMode: mode });
                    window.editCaption = "Fixture label";
                    window.editvar = "";
                    window.setEdit = () => __graphicalSaves.push(editvar);
                    showEditKey1();
                }, mode);
                const editor = page.locator("#listEdit");
                await expect(editor.locator(".osk-grid")).toBeVisible();
                await expect(
                    editor.locator("input, textarea, [contenteditable=true]")
                ).toHaveCount(0);
                expect(
                    await page.evaluate(() => {
                        const owner = __ottClassicScreenPort.owner("editor");
                        return (
                            owner.foreground() &&
                            owner.model.nativeInputSecret === undefined
                        );
                    })
                ).toBe(true);
                await page.keyboard.press("l");
                await page.keyboard.press("L");
                await expect
                    .poll(() => page.evaluate(() => editvar))
                    .toBe("lL");
                await expect(page.locator("#ee")).toHaveText("lL");
                expect(
                    await page.evaluate(
                        () =>
                            !!(
                                document.fullscreenElement ||
                                document.webkitFullscreenElement
                            )
                    )
                ).toBe(false);
                expect(
                    await page.evaluate(() => __graphicalFullscreenEvents)
                ).toBe(0);
                const keys = await page.evaluate(() => ({
                    cancel: window.keys.RETURN,
                    save: window.keys.BLUE,
                }));
                await expectVisibleControlsWithinViewport(
                    page,
                    `#listPodval [data-ott-key="${keys.save}"], #listPodval [data-ott-key="${keys.cancel}"]`
                );
                await page.screenshot({
                    path: test
                        .info()
                        .outputPath(`graphical-editor-mode-${mode}.png`),
                });
                await page
                    .locator(`#listPodval [data-ott-key="${keys.save}"]`)
                    .click();
                await expect(editor).toBeHidden();
                expect(await page.evaluate(() => __graphicalSaves.length)).toBe(
                    mode === initialMode ? 1 : 2
                );
                await page.evaluate(() => {
                    window.editvar = "saved";
                    showEditKey1();
                });
                await page.keyboard.press("l");
                await page.keyboard.press("L");
                await expect
                    .poll(() => page.evaluate(() => editvar))
                    .toBe("savedlL");
                await page
                    .locator(`#listPodval [data-ott-key="${keys.cancel}"]`)
                    .click();
                await expect(editor).toBeHidden();
                expect(await page.evaluate(() => __graphicalSaves)).toEqual(
                    mode === initialMode ? ["lL"] : ["lL", "lL"]
                );
            }
            expect(fixture.errors).toEqual([]);
            expect(fixture.unexpectedRequests).toEqual([]);
        } finally {
            await fixture.close();
        }
    });
}

async function activateOwnedFixtureRow(page, row) {
    await expect(row).toHaveCount(1);
    const id = await row.getAttribute("id");
    expect(id).toMatch(/^it\d+$/);
    const target = Number(id.slice(2));
    const selected = await page.evaluate(() => window.selIndex);
    expect(Number.isInteger(selected)).toBe(true);
    expect(Math.abs(target - selected)).toBeLessThan(80);
    for (let index = selected; index < target; index++)
        await page.keyboard.press("ArrowDown");
    for (let index = selected; index > target; index--)
        await page.keyboard.press("ArrowUp");
    await expect(row).toHaveClass(/ott-selected/);
    await page.keyboard.press("Enter");
}

test("Modern M3U provider and profile screens preserve editor Save and Cancel", async ({
    browser,
}) => {
    const fixture = await fixturePage(browser, "server", { interfaceTheme: 2 });
    const { page } = fixture;
    try {
        await attachModernRuntimeIdentity(page, browser);
        await page.evaluate(() => {
            // A configured empty slot opens production settings without downloading
            // a playlist. All subsequent navigation and storage edits use real UI.
            stbSetItem("ottplaylang", "_eng");
            stbSetItem("ottplayprov", "m3u");
            stbSetItem(
                "m3um3uArr",
                JSON.stringify({
                    active: 0,
                    M3Us: [{ name: "Fixture profile", rechours: 0, www: "" }],
                })
            );
            saveSettings({ interfaceMode: 1 });
            stbBindKeyHandler();
            loadProv();
        });
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        window.__ottActiveProviderDriver &&
                        __ottActiveProviderDriver.id
                )
            )
            .toBe("m3u");
        await expect(page.locator("#listCaption")).toHaveText(
            "Edit playlist data"
        );
        await page
            .locator('#modernShell [data-modern-action="providers"]')
            .click();
        const provider = page
            .locator("#listIn .item")
            .filter({ hasText: "m3u-m3u8 playlists" });
        await expect(provider).toHaveCount(1);
        await activateOwnedFixtureRow(page, provider);
        await expect(page.locator("#listCaption")).toHaveText("Settings");
        await page.keyboard.press("Backspace");
        await expect(page.locator("#listCaption")).toHaveText("Menu");
        await activateOwnedFixtureRow(
            page,
            page
                .locator("#listIn .item")
                .filter({ hasText: "Select playlist: 1 - Fixture profile" })
        );
        await expect(page.locator("#listCaption")).toHaveText(
            "Select playlist"
        );
        await activateOwnedFixtureRow(page, page.locator("#it0"));
        await expect(page.locator("#listCaption")).toHaveText(
            "Edit playlist data"
        );
        const nameRow = () =>
            page.locator("#listIn .item").filter({ hasText: "Playlist Name:" });
        await activateOwnedFixtureRow(page, nameRow());
        await expect(page.locator("#editvar")).toBeFocused();
        await page.locator("#editvar").fill("Discarded label");
        await page.locator('#listEdit [data-ott-key="27"]').click();
        await expect(page.locator("#listEdit")).toBeHidden();
        await expect(nameRow()).toContainText("Fixture profile");
        expect(
            await page.evaluate(
                () => JSON.parse(stbGetItem("m3um3uArr")).M3Us[0].name
            )
        ).toBe("Fixture profile");
        await activateOwnedFixtureRow(page, nameRow());
        await page.locator("#editvar").fill("Saved fixture profile");
        await expectVisibleControlsWithinViewport(
            page,
            '#listEdit [data-ott-key="13"], #listEdit [data-ott-key="27"]'
        );
        await page.screenshot({
            path: test.info().outputPath("m3u-profile-editor.png"),
        });
        await page.locator('#listEdit [data-ott-key="13"]').click();
        await expect(page.locator("#listEdit")).toBeHidden();
        await expect(nameRow()).toContainText("Saved fixture profile");
        expect(
            await page.evaluate(
                () => JSON.parse(stbGetItem("m3um3uArr")).M3Us[0].name
            )
        ).toBe("Saved fixture profile");
        await page.keyboard.press("Backspace");
        await expect(page.locator("#listCaption")).toHaveText(
            "Select playlist"
        );
        await expect(page.locator("#it0")).toContainText(
            "Saved fixture profile"
        );
        expect(fixture.errors).toEqual([]);
        expect(fixture.unexpectedRequests).toEqual([]);
    } finally {
        await fixture.close();
    }
});

async function prepareEpgFixtureInput(page) {
    // This fixture boots the renderer directly. Complete its initial paint,
    // then observe CSP and bind the same keyboard entry point as normal boot.
    await page.evaluate(async () => {
        await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
        window.__fixtureViolations = [];
        window.stbBindKeyHandler();
    });
}

for (const profile of ["server", "tauri", "capacitor"]) {
    test(
        profile + " EPG calendar and appearance preserve real row selection",
        async ({ browser }) => {
            const fixture = await fixturePage(
                browser,
                profile,
                {
                    epgArchiveLabel: 0,
                    epgTimeColor: 3,
                    interfaceTheme: 2,
                },
                "arabic"
            );
            const { page } = fixture;
            try {
                await prepareEpgFixtureInput(page);
                const expected = await page.evaluate(() => {
                    Date.setTimezoneOffset(0);
                    window.__ottInterfaceLanguage = "_ara";
                    const start =
                        Math.floor(Date.now() / 86400000) * 86400 -
                        259200 +
                        36000;
                    const rows = [0, 1].map((index) => ({
                        name: "برنامج طويل ".repeat(15),
                        providerId: "calendar-" + index,
                        time: start + index * 86400,
                        time_to: start + index * 86400 + (index ? 52200 : 1800),
                    }));
                    window.channels.one.rec = 168;
                    window.p_pref = "epg-calendar-fixture";
                    window.epgArray = [];
                    window.sPrevCount = 10;
                    window.__epgPresentationSelection = [];
                    window.fetchChannelGuide = (id, complete) =>
                        complete(id, rows);
                    window.setCurrent = (category, index) =>
                        window.__epgPresentationSelection.push({
                            category,
                            index,
                        });
                    window.playArchive = (time) =>
                        window.__epgPresentationSelection.push({ time });
                    window.epgList(0, 0, false);
                    const date = new Intl.DateTimeFormat("ar", {
                        day: "2-digit",
                        month: "2-digit",
                        timeZone: "UTC",
                        weekday: "short",
                    });
                    return {
                        dates: rows.map((row) =>
                            date.format(new Date(row.time * 1000))
                        ),
                        endingDate: date.format(
                            new Date(rows[1].time_to * 1000)
                        ),
                        start,
                    };
                });
                await expect(page.locator("#listIn .item")).toHaveCount(2);
                expect(expected.dates[0]).not.toBe(expected.dates[1]);
                for (let index = 0; index < 2; index++) {
                    const row = page.locator("#it" + index);
                    await expect(row).toContainText(expected.dates[index]);
                    await expect(row).toContainText(
                        index
                            ? "10:00 - " + expected.endingDate + " 00:30"
                            : "10:00 - 10:30"
                    );
                    await expect(row.locator('span[dir="auto"]')).toHaveCSS(
                        "color",
                        index === 0 ? "rgb(17, 33, 25)" : "rgb(0, 255, 255)"
                    );
                    await expect(row.locator(".epg-archive-tag")).toHaveCount(
                        0
                    );
                    await expect(
                        row.locator('.btn.green[role="img"]')
                    ).toBeVisible();
                    expect(
                        await row
                            .locator(".btn.green")
                            .getAttribute("aria-label")
                    ).toBeTruthy();
                    expect(
                        await row.evaluate((element) => {
                            const rect = element.getBoundingClientRect();
                            return (
                                rect.height > 0 &&
                                document
                                    .elementFromPoint(
                                        rect.left + 8,
                                        rect.top + rect.height / 2
                                    )
                                    ?.closest(".item") === element
                            );
                        })
                    ).toBe(true);
                }
                // Studio keeps selected text dark on its light highlight;
                // the configured time colour returns when focus leaves a row.
                const first = page.locator("#it0");
                const second = page.locator("#it1");
                const timeLabel = (row) => row.locator('span[dir="auto"]');
                await expect(page.locator("body")).toHaveClass(/theme-studio/);
                await expect(first).toHaveClass(/ott-selected/);
                await page.keyboard.press("ArrowDown");
                await expect(second).toHaveClass(/ott-selected/);
                await expect(timeLabel(first)).toHaveCSS(
                    "color",
                    "rgb(0, 255, 255)"
                );
                await expect(timeLabel(second)).toHaveCSS(
                    "color",
                    "rgb(17, 33, 25)"
                );
                await page.keyboard.press("ArrowUp");
                await expect(first).toHaveClass(/ott-selected/);
                await expect(timeLabel(first)).toHaveCSS(
                    "color",
                    "rgb(17, 33, 25)"
                );
                await expect(timeLabel(second)).toHaveCSS(
                    "color",
                    "rgb(0, 255, 255)"
                );
                const wideRowWidths = [];
                for (const width of [1280, 960]) {
                    await page.setViewportSize({
                        height: (width * 9) / 16,
                        width,
                    });
                    for (let index = 0; index < 2; index++) {
                        const row = page.locator("#it" + index);
                        const title = row.locator(".ott-channel-label");
                        await expect(title).toContainText("برنامج طويل");
                        await expect(title).toHaveCSS(
                            "text-overflow",
                            "ellipsis"
                        );
                        await expect
                            .poll(() =>
                                row.evaluate((element, wideWidth) => {
                                    const bounds =
                                        element.getBoundingClientRect();
                                    const time = element
                                        .querySelector('span[dir="auto"]')
                                        .getBoundingClientRect();
                                    const title =
                                        element.querySelector(
                                            ".ott-channel-label"
                                        );
                                    const label = title.getBoundingClientRect();
                                    return (
                                        bounds.left >= 0 &&
                                        bounds.right <= window.innerWidth &&
                                        (!wideWidth ||
                                            bounds.width < wideWidth) &&
                                        time.left >= bounds.left &&
                                        time.right <= bounds.right &&
                                        label.width > 0 &&
                                        label.left >= bounds.left &&
                                        label.right <= bounds.right &&
                                        title.scrollWidth > title.clientWidth
                                    );
                                }, wideRowWidths[index] || 0)
                            )
                            .toBe(true);
                        if (width === 1280)
                            wideRowWidths[index] = await row.evaluate(
                                (element) =>
                                    element.getBoundingClientRect().width
                            );
                    }
                }
                const identity = await page.evaluate(() =>
                    window.listArray.map(
                        ({ programmeId, providerId, time }) => ({
                            programmeId,
                            providerId,
                            time,
                        })
                    )
                );
                expect(identity.map((row) => row.providerId)).toEqual([
                    "calendar-0",
                    "calendar-1",
                ]);
                expect(identity.map((row) => row.time)).toEqual([
                    expected.start,
                    expected.start + 86400,
                ]);
                expect(
                    identity.every(
                        (row) =>
                            typeof row.programmeId === "string" &&
                            row.programmeId.length > 0
                    )
                ).toBe(true);
                expect(
                    new Set(identity.map((row) => row.programmeId)).size
                ).toBe(2);
                await activateOwnedFixtureRow(page, page.locator("#it0"));
                await expect
                    .poll(() =>
                        page.evaluate(() => window.__epgPresentationSelection)
                    )
                    .toEqual([
                        { category: 0, index: 0 },
                        { time: expected.start },
                    ]);
                expect(
                    await page.evaluate(() =>
                        window.epgArray.map(
                            ({ programmeId, providerId, time }) => ({
                                programmeId,
                                providerId,
                                time,
                            })
                        )
                    )
                ).toEqual(identity);
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
                expect(
                    await page.evaluate(() => window.__fixtureViolations)
                ).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );
}

for (const profile of ["server", "tauri", "capacitor"]) {
    test(
        profile + " EPG current title follows theme changes under CSP",
        async ({ browser }) => {
            const fixture = await fixturePage(browser, profile, {
                epgTimeColor: 3,
                interfaceTheme: 2,
            });
            const { page } = fixture;
            try {
                await prepareEpgFixtureInput(page);
                await page.evaluate(() => {
                    const now = Math.floor(Date.now() / 1000);
                    const rows = [
                        {
                            name: "Earlier programme",
                            providerId: "earlier",
                            time: now - 1800,
                            time_to: now - 600,
                        },
                        {
                            name: "Current programme",
                            providerId: "current",
                            time: now - 600,
                            time_to: now + 1800,
                        },
                    ];
                    window.channels.one.rec = 168;
                    window.p_pref = "epg-current-theme-fixture";
                    window.epgArray = [];
                    window.sPrevCount = 10;
                    window.fetchChannelGuide = (id, complete) =>
                        complete(id, rows);
                    window.epgList(0, 0, false);
                });
                await expect(page.locator("#listIn .item")).toHaveCount(2);
                const current = page.locator("#it1");
                const currentTitle = current.locator(".ott-epg-current-title");
                await expect(current).toHaveClass(/ott-selected/);
                await expect(currentTitle).toHaveText("Current programme");
                await expect(currentTitle).toHaveCSS(
                    "color",
                    "rgb(17, 33, 25)"
                );
                await page.keyboard.press("ArrowUp");
                await expect(page.locator("#it0")).toHaveClass(/ott-selected/);
                await expect(currentTitle).toHaveCSS(
                    "color",
                    "rgb(139, 221, 184)"
                );
                await expect(page.locator(".ott-epg-detail-title")).toHaveCSS(
                    "color",
                    "rgb(139, 221, 184)"
                );
                await page.evaluate(() => {
                    settings.interfaceTheme = 1;
                    setColor();
                });
                await expect(page.locator("body")).toHaveClass(/theme-pli-hd/);
                await expect(currentTitle).toHaveCSS(
                    "color",
                    "rgb(252, 192, 0)"
                );
                await expect(page.locator(".ott-epg-detail-title")).toHaveCSS(
                    "color",
                    "rgb(252, 192, 0)"
                );
                await expect(current.locator('span[dir="auto"]')).toHaveCSS(
                    "color",
                    "rgb(0, 255, 255)"
                );
                expect(fixture.errors).toEqual([]);
                expect(fixture.unexpectedRequests).toEqual([]);
                expect(
                    await page.evaluate(() => window.__fixtureViolations)
                ).toEqual([]);
            } finally {
                await fixture.close();
            }
        }
    );
}
