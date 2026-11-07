"use strict";

// Use the actual selector, screen ownership, responsive geometry and stylesheet.
// Only the surrounding playback page is replaced; no player bundle or media runs.
const { test, expect } = require("../helpers/browser-test.cjs");
const { declarations, read } = require("../helpers/localized-keyboard.cjs");
const ts = require("typescript");

const selectorCode =
    declarations("src/utils/helpers.ts", [
        "getViewportHeightScale",
        "listPreviewRect",
        "metadataText",
        "metadataHtml",
    ]) +
    declarations("src/localization/assets.ts", ["languageNames"]) +
    declarations("src/index.ts", ["setListPos"]) +
    declarations("src/ui/index.ts", [
        "_curVal",
        "clickVal",
        "selectValue",
        "saveListPanelState",
        "restoreListPanelState",
        "renderButtonHint",
        "strRETURN",
        "strENTER",
    ]);

async function setup(page, { width = 1280, height = 720, fontScale = 1 } = {}) {
    await page.setViewportSize({ height, width });
    await page.route("**/*", (route) => route.abort("blockedbyclient"));
    await page.setContent(
        "<style>" +
            read("styles/player.css") +
            "</style>" +
            '<div id="list"><div id="listCaption">Original settings</div>' +
            '<div id="listDetail"><strong>Original detail</strong></div>' +
            '<div id="listPodval">Original footer</div><div id="listAbout"></div></div>' +
            '<span id="testFont" style="position:absolute;visibility:hidden"></span>'
    );
    await page.addScriptTag({ content: read("js/jquery-1.11.1.min.js") });
    await page.evaluate(
        ({ height, fontScale }) => {
            window.keys = {
                DOWN: 40,
                ENTER: 13,
                EXIT: 88,
                LEFT: 37,
                RETURN: 27,
                RIGHT: 39,
                UP: 38,
            };
            window.settings = {
                interfaceTheme: 0,
                listPosition: 0,
                noSmall: false,
                pageSize: 25,
            };
            window._ = (text) => text;
            window.curColor = "#ffffff";
            window.curColorB = "#123456";
            window.listCaptionElement = document.getElementById("listCaption");
            window.listFooterElement = document.getElementById("listPodval");
            window.listDetailElement = document.getElementById("listDetail");
            window.showPageCalls = 0;
            window.showPage = () => {
                window.showPageCalls++;
            };
            // Match index.html's page background behind the real stylesheet.
            document.body.style.background = "#111";
            document.body.style.fontSize =
                ((22 * height) / 720) * fontScale + "px";
        },
        { fontScale, height }
    );
    for (const module of [
        "screen-controller",
        "input-router",
        "classic-screen-port",
    ]) {
        await page.addScriptTag({
            content:
                "(function(){" +
                ts.transpileModule(read("src/ui/" + module + ".ts"), {
                    compilerOptions: {
                        module: ts.ModuleKind.None,
                        target: ts.ScriptTarget.ES5,
                    },
                }).outputText +
                "})();",
        });
    }
    await page.addScriptTag({ content: selectorCode });
    await page.evaluate(() => {
        setListPos();
        document.addEventListener("keydown", (event) => {
            __ottClassicScreenPort.dispatch(event.keyCode, event, () => {});
        });
    });
}

async function open(page, values = null, selected = 0) {
    return page.evaluate(
        ({ values, selected }) => {
            window.fixtureItem = {
                name: "Language",
                val: selected,
                values:
                    values ||
                    Object.keys(languageNames).map((id) => languageNames[id]),
            };
            window.fixturePanelStyle = document
                .getElementById("listAbout")
                .getAttribute("style");
            selectValue(fixtureItem);
            return fixtureItem.values;
        },
        { selected, values }
    );
}

async function focus(page) {
    return page.evaluate(() => _curVal);
}

async function geometry(page) {
    return page.evaluate(() => {
        const panel = document.getElementById("listAbout");
        const grid = panel.firstElementChild;
        const p = panel.getBoundingClientRect();
        const rows = Array.from(panel.querySelectorAll(".osk-key")).map(
            (node) => {
                const rect = node.getBoundingClientRect();
                const range = document.createRange();
                range.selectNodeContents(node);
                const text = Array.from(range.getClientRects()).filter(
                    (r) => r.width && r.height
                );
                return {
                    bottom: rect.bottom,
                    clientWidth: node.clientWidth,
                    id: Number(node.id.slice(2)),
                    left: rect.left,
                    lines: new Set(text.map((r) => Math.round(r.top))).size,
                    right: rect.right,
                    scrollWidth: node.scrollWidth,
                    text: node.textContent,
                    textInside: text.every(
                        (r) =>
                            r.left >= rect.left - 1 &&
                            r.right <= rect.right + 1 &&
                            r.top >= rect.top - 1 &&
                            r.bottom <= rect.bottom + 1
                    ),
                    top: rect.top,
                    width: rect.width,
                };
            }
        );
        return {
            horizontalOverflow: grid.scrollWidth > grid.clientWidth,
            panel: {
                bottom: p.bottom,
                left: p.left,
                right: p.right,
                top: p.top,
            },
            rows,
            selected: _curVal,
            viewport: { height: innerHeight, width: innerWidth },
        };
    });
}

async function expectFocusedVisible(page) {
    await expect
        .poll(async () => {
            const g = await geometry(page);
            const row = g.rows.find((row) => row.id === g.selected);
            return (
                !!row &&
                !g.horizontalOverflow &&
                row.top >= g.panel.top - 1 &&
                row.bottom <= g.panel.bottom + 1
            );
        })
        .toBe(true);
}

for (const viewport of [
    { height: 720, width: 1280 },
    { height: 540, width: 960 },
    { height: 360, width: 640 },
]) {
    test(`full language labels fit the Classic selector at ${viewport.width}x${viewport.height}`, async ({
        page,
    }, testInfo) => {
        await setup(page, viewport);
        const labels = await open(page);
        expect(labels.length).toBeGreaterThan(80);
        const g = await geometry(page);
        expect(g.panel.left).toBeGreaterThanOrEqual(0);
        expect(g.panel.right).toBeLessThanOrEqual(g.viewport.width);
        expect(g.panel.bottom).toBeLessThanOrEqual(g.viewport.height);
        expect(g.rows.map((row) => row.text)).toEqual(labels);
        expect(
            g.rows
                .filter(
                    (row) =>
                        row.lines !== 1 ||
                        !row.textInside ||
                        row.scrollWidth > row.clientWidth + 1
                )
                .map((row) => row.text),
            "complete language names must not become vertical or clipped columns"
        ).toEqual([]);
        expect(
            g.rows.every(
                (row) =>
                    row.left >= g.panel.left - 1 &&
                    row.right <= g.panel.right + 1
            )
        ).toBe(true);
        await page.screenshot({
            path: testInfo.outputPath("language-selector.png"),
        });
    });

    test(`selected last language scrolls into view at ${viewport.width}x${viewport.height}`, async ({
        page,
    }) => {
        await setup(page, viewport);
        await page.evaluate(() => {
            window.fixtureItem = {
                name: "Language",
                val: Object.keys(languageNames).length - 1,
                values: Object.values(languageNames),
            };
            selectValue(fixtureItem);
        });
        await expectFocusedVisible(page);
        expect(await page.locator("#listDetail").textContent()).toBe(
            "Zulu - isiZulu"
        );
    });
}

test("arrows wrap actual rows, preserve focus visibility, and Enter commits the original value index", async ({
    page,
}) => {
    await setup(page);
    const labels = await open(page);
    const g = await geometry(page);
    const first = g.rows.filter((row) => Math.abs(row.top - g.rows[0].top) < 1);
    const columns = first.length;
    await page.keyboard.press("ArrowLeft");
    expect(await focus(page)).toBe(columns - 1);
    await page.keyboard.press("ArrowRight");
    expect(await focus(page)).toBe(0);
    await page.keyboard.press("ArrowDown");
    expect(await focus(page)).toBe(columns);
    await page.keyboard.press("ArrowUp");
    expect(await focus(page)).toBe(0);
    await page.keyboard.press("ArrowUp");
    expect(await focus(page)).toBe(
        Math.floor((labels.length - 1) / columns) * columns
    );
    await expectFocusedVisible(page);
    await page.keyboard.press("ArrowDown");
    expect(await focus(page)).toBe(0);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => fixtureItem.val)).toBe(columns);
    await expect(page.locator("#listAbout")).toBeHidden();
    await expect(page.locator("#listCaption")).toHaveText("Original settings");
    await expect(page.locator("#listDetail strong")).toHaveText(
        "Original detail"
    );
    expect(await page.evaluate(() => showPageCalls)).toBe(1);
});

test("pointer focuses once and commits twice; hidden sentinel retains original indices and markup", async ({
    page,
}) => {
    await setup(page);
    const values = [
        "English",
        "@@@",
        "<strong>Portuguese</strong> - Português",
        "Zulu - isiZulu",
    ];
    await open(page, values, 0);
    await expect(page.locator("#listAbout .osk-key")).toHaveCount(3);
    await page.locator("#ik1").click();
    expect(await focus(page)).toBe(1);
    expect(await page.evaluate(() => fixtureItem.val)).toBe(0);
    await expect(page.locator("#listDetail strong")).toHaveText("Portuguese");
    await page.locator("#ik1").click();
    expect(await page.evaluate(() => fixtureItem.val)).toBe(2);
    await expect(page.locator("#listAbout")).toBeHidden();
});

for (const key of ["Escape", "x"]) {
    test(`${key} cancels without changing the setting or leaking selector scroll styles`, async ({
        page,
    }) => {
        await setup(page);
        await open(
            page,
            ["English", "French - Français", "German - Deutsch"],
            1
        );
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press(key);
        expect(await page.evaluate(() => fixtureItem.val)).toBe(1);
        await expect(page.locator("#listAbout")).toBeHidden();
        await expect(page.locator("#listDetail strong")).toHaveText(
            "Original detail"
        );
        const overflow = await page.evaluate(() => {
            const panel = $("#listAbout")
                .html("Unrelated information")
                .show()[0];
            return [
                getComputedStyle(panel).overflowX,
                getComputedStyle(panel).overflowY,
            ];
        });
        expect(overflow).toEqual(["hidden", "hidden"]);
    });
}

test("single choice stays visible, accepts Enter and short choices remain usable", async ({
    page,
}) => {
    await setup(page, { height: 360, width: 640 });
    await open(page, ["Only choice"], 0);
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
        await page.keyboard.press(key);
        expect(await focus(page)).toBe(0);
    }
    await expectFocusedVisible(page);
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => fixtureItem.val)).toBe(0);
    await open(page, ["Off", "On"], 0);
    await page.locator("#ik1").click();
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => fixtureItem.val)).toBe(1);
});

test("an empty or entirely filtered list does not replace the current screen", async ({
    page,
}) => {
    await setup(page);
    const before = await page.evaluate(() => {
        window.parentInputs = [];
        window.parentOwner = __ottClassicScreenPort.screens.open({
            handle(command) {
                parentInputs.push(command.id);
            },
            kind: "settings",
        });
        _curVal = 42;
        return document.getElementById("list").outerHTML;
    });
    for (const values of [[], ["@@@"]]) {
        await open(page, values);
        expect(await focus(page)).toBe(42);
        expect(await page.evaluate(() => fixtureItem.val)).toBe(0);
        expect(
            await page.evaluate(() => document.getElementById("list").outerHTML)
        ).toBe(before);
        await expect(page.locator("#listAbout")).toBeHidden();
        await expect(page.locator("#listCaption")).toHaveText(
            "Original settings"
        );
        await expect(page.locator("#listDetail strong")).toHaveText(
            "Original detail"
        );
        expect(
            await page.evaluate(() => __ottClassicScreenPort.owner("about"))
        ).toBeFalsy();
        expect(
            await page.evaluate(
                () =>
                    __ottClassicScreenPort.screens.current() === parentOwner &&
                    parentOwner.foreground()
            )
        ).toBe(true);
    }
    await page.keyboard.press("ArrowDown");
    expect(await page.evaluate(() => parentInputs)).toEqual(["down"]);
    expect(await page.evaluate(() => showPageCalls)).toBe(0);
});

for (const probe of ["missing", "zero width"]) {
    test(`a ${probe} global font probe does not affect the selector`, async ({
        page,
    }) => {
        await setup(page, { height: 360, width: 640 });
        await open(page);
        const before = await geometry(page);
        await page.keyboard.press("Escape");
        await page.evaluate((probe) => {
            const node = document.getElementById("testFont");
            if (probe === "missing") node.remove();
            else {
                node.style.display = "inline-block";
                node.style.width = "0px";
                node.textContent = "Unrelated measurement";
            }
        }, probe);
        await open(page);
        expect(await geometry(page)).toEqual(before);
        await expectFocusedVisible(page);
        if (probe === "zero width")
            await expect(page.locator("#testFont")).toHaveText(
                "Unrelated measurement"
            );
        await expect(page.locator("#listAbout > div > span")).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(page.locator("#listCaption")).toHaveText(
            "Original settings"
        );
    });
}
test("an unmeasurable local probe preserves usable fallback selection and original indices", async ({
    page,
}) => {
    await setup(page, { height: 360, width: 640 });
    await page.addStyleTag({
        content:
            "#listAbout > div > span { display: inline-block; width: 0 !important; }",
    });
    const values = [
        "One",
        "@@@",
        "Two",
        "Three",
        "Four",
        "Five",
        "Six",
        "Seven",
    ];
    await open(page, values, 7);
    await expectFocusedVisible(page);
    const g = await geometry(page);
    expect(
        g.rows.filter((row) => Math.abs(row.top - g.rows[0].top) < 1)
    ).toHaveLength(6);
    expect(
        g.rows.every(
            (row) =>
                row.left >= g.panel.left - 1 && row.right <= g.panel.right + 1
        )
    ).toBe(true);
    await page.keyboard.press("ArrowUp");
    expect(await focus(page)).toBe(0);
    await page.keyboard.press("ArrowRight");
    expect(await focus(page)).toBe(1);
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => fixtureItem.val)).toBe(2);
    await expect(page.locator("#listAbout")).toBeHidden();
    await expect(page.locator("#listDetail strong")).toHaveText(
        "Original detail"
    );
    await open(page, values, 7);
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => fixtureItem.val)).toBe(7);
    await expect(page.locator("#listCaption")).toHaveText("Original settings");
});

test("an overlay owning input prevents covered value clicks from changing selection", async ({
    page,
}) => {
    await setup(page);
    await open(page, ["English", "French - Français", "German - Deutsch"], 0);
    await page.evaluate(() => {
        window.coverOwner = __ottClassicScreenPort.screens.open({
            handle() {},
            kind: "cover",
            priority: 1000,
        });
    });
    await page.locator("#ik1").click();
    expect(await focus(page)).toBe(0);
    expect(await page.evaluate(() => fixtureItem.val)).toBe(0);
    await page.evaluate(() => coverOwner.close());
    await page.locator("#ik1").click();
    expect(await focus(page)).toBe(1);
});

test("a large font keeps oversized choices on one row and preserves their full detail", async ({
    page,
}) => {
    await setup(page, { fontScale: 2 });
    const longLabel =
        "Portuguese - Português / " + "extended language label ".repeat(8);
    await open(page, ["English", longLabel, "French - Français"], 1);
    const g = await geometry(page);
    expect(g.rows.every((row) => row.lines === 1)).toBe(true);
    expect(
        g.rows.every(
            (row) =>
                row.left >= g.panel.left - 1 && row.right <= g.panel.right + 1
        )
    ).toBe(true);
    await expect(page.locator("#ik1")).toHaveCSS("text-overflow", "ellipsis");
    await expect(page.locator("#listDetail")).toHaveText(longLabel);
    await expectFocusedVisible(page);
});

test("vertical wrap stays in its column when the last row is incomplete", async ({
    page,
}) => {
    await setup(page);
    await open(
        page,
        Array.from(
            { length: 5 },
            (_, index) => "Portuguese - Português / " + (index + 1)
        )
    );
    const g = await geometry(page);
    const columns = g.rows.filter(
        (row) => Math.abs(row.top - g.rows[0].top) < 1
    ).length;
    expect(
        columns,
        "fixture must exercise two columns with one item in the final row"
    ).toBe(2);
    await page.keyboard.press("ArrowRight");
    expect(await focus(page)).toBe(1);
    await page.keyboard.press("ArrowUp");
    expect(await focus(page)).toBe(3);
    await page.keyboard.press("ArrowDown");
    expect(await focus(page)).toBe(1);
    await page.locator("#ik4").click();
    await page.keyboard.press("ArrowRight");
    expect(await focus(page)).toBe(4);
    await page.keyboard.press("ArrowLeft");
    expect(await focus(page)).toBe(4);
});

test("footer clock and late audio badge remain inside the panel after scaling and resize", async ({
    page,
}) => {
    const errors = [];
    const requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
    });
    await page.route("**/*", (route) => {
        requests.push(route.request().url());
        return route.abort("blockedbyclient");
    });
    await page.setContent("<!doctype html><body></body>");
    await page.addStyleTag({ content: read("styles/player.css") });
    // Import only the real footer and measurement node; no startup scripts,
    // video element, provider, bundled player or external fonts are loaded.
    await page.evaluate((html) => {
        const source = new DOMParser().parseFromString(html, "text/html");
        for (const id of ["info1", "testFont"])
            document.body.appendChild(
                document.importNode(source.getElementById(id), true)
            );
    }, read("index.html"));
    await page.addScriptTag({ content: read("js/jquery-1.11.1.min.js") });
    await page.evaluate(() => {
        Object.assign(window, {
            _: (value) => value,
            $i1: $("#info1"),
            fontFamilyList: [""],
            isListVisible: false,
            loadSubtitleAppearance() {},
            setListPos() {},
            settings: {
                fontShift: 0,
                fontSize: 0,
                osdOpacity: 5,
                pageSize: 15,
                permanentTime: 0,
            },
            stbAudioTracksExists: () => window.footerHasAudio,
            stbSetOsdOpacity() {},
            tooltip: null,
        });
        $("#info1").show();
        $("#channel_name").text("Fixture channel");
        $("#current_t").text("23:58");
        $("#current_s").text(":59");
    });
    await page.addScriptTag({
        content:
            declarations("src/utils/helpers.ts", ["uiFontScale"]) +
            declarations("src/index.ts", ["setFontSize"]) +
            declarations("src/ui/index.ts", ["refreshAudioBadge"]),
    });
    const measure = () =>
        page.evaluate(() => {
            const bounds = (id) => {
                const { bottom, height, left, right, top, width } = document
                    .getElementById(id)
                    .getBoundingClientRect();
                return { bottom, height, left, right, top, width };
            };
            const panel = document.getElementById("info1");
            const style = getComputedStyle(panel);
            return {
                badge: bounds("audio_badge"),
                clock: bounds("current_t"),
                data: bounds("data"),
                left:
                    panel.getBoundingClientRect().left +
                    parseFloat(style.paddingLeft),
                panel: bounds("info1"),
                right:
                    panel.getBoundingClientRect().right -
                    parseFloat(style.paddingRight),
                seconds: bounds("current_s"),
            };
        });
    for (const [width, height, fontScale] of [
        [1280, 720, 100],
        [1920, 1080, 200],
        [640, 360, 150],
        [360, 800, 200],
        [3840, 2160, 100],
        [1280, 720, 100],
    ]) {
        await page.setViewportSize({ height, width });
        await page.evaluate((scale) => {
            window.sUiFontScale = scale;
            window.footerHasAudio = false;
            refreshAudioBadge();
            setFontSize();
        }, fontScale);
        const before = await measure();
        expect(before.badge.width).toBe(0);
        // Track discovery must fit without another setFontSize or resize.
        await page.evaluate(() => {
            window.footerHasAudio = true;
            refreshAudioBadge();
        });
        const after = await measure();
        for (const rect of [after.badge, after.clock, after.seconds]) {
            expect(rect.width).toBeGreaterThan(0);
            expect(rect.height).toBeGreaterThan(0);
            expect(rect.left).toBeGreaterThanOrEqual(
                Math.max(after.data.left, after.left) - 0.5
            );
            expect(rect.right).toBeLessThanOrEqual(
                Math.min(after.data.right, after.right, width) + 0.5
            );
            expect(rect.top).toBeGreaterThanOrEqual(after.panel.top - 0.5);
            expect(rect.bottom).toBeLessThanOrEqual(after.panel.bottom + 0.5);
        }
        expect(after.badge.right).toBeLessThanOrEqual(after.clock.left + 0.5);
        expect(after.clock.right).toBeLessThanOrEqual(after.seconds.left + 0.5);
        expect(
            Math.abs(after.seconds.right - before.seconds.right)
        ).toBeLessThanOrEqual(0.5);
        await page.evaluate(() => {
            window.footerHasAudio = false;
            refreshAudioBadge();
        });
        expect(
            Math.abs((await measure()).seconds.right - before.seconds.right)
        ).toBeLessThanOrEqual(0.5);
    }
    expect(errors).toEqual([]);
    expect(requests).toEqual([]);
});
