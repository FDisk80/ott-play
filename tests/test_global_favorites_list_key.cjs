"use strict";
const realCaselessKey =
    require("./helpers/global-favorites-main-ports.cjs").actualModule(
        "src/utils/caseless.ts",
        {}
    ).caselessKey;
const assert = require("node:assert/strict"),
    fs = require("node:fs"),
    path = require("node:path"),
    vm = require("node:vm"),
    ts = require("typescript");
const { load, fixture, row } = require("./global-favorites-fixture.cjs");
const root = path.resolve(__dirname, "..");
function extract(file, predicate) {
    const source = ts.createSourceFile(
        file,
        fs.readFileSync(path.join(root, file), "utf8"),
        ts.ScriptTarget.Latest,
        true
    );
    let found;
    function visit(n) {
        if (!found && predicate(n)) found = n;
        ts.forEachChild(n, visit);
    }
    visit(source);
    assert(found, file);
    return found.getText(source);
}
function fn(text, context) {
    vm.runInNewContext(
        ts.transpileModule("var actual=" + text.replace(/^export\s+/, ""), {
            compilerOptions: { target: ts.ScriptTarget.ES5 },
        }).outputText,
        context
    );
    return context.actual;
}
function ui(w) {
    for (const file of [
        "screen-controller",
        "input-router",
        "classic-screen-port",
    ])
        vm.runInNewContext(
            ts.transpileModule(
                fs.readFileSync(
                    path.join(root, "src/ui/" + file + ".ts"),
                    "utf8"
                ),
                { compilerOptions: { target: ts.ScriptTarget.ES5 } }
            ).outputText,
            { window: w }
        );
}
const turn = () => new Promise((r) => setImmediate(r));
async function settle() {
    for (let i = 0; i < 8; i++) await turn();
}
async function setup(outcome) {
    const f = fixture();
    let initial = await f.store.snapshot();
    await f.store.mutate(initial.revision, {
        entries: [row("A <name> & B")],
        op: "put",
    });
    const w = {
        channels: new Proxy(
            {},
            {
                get() {
                    throw Error("Global UUID must never use provider channels");
                },
            }
        ),
        keys: { FAVORITES: 70 },
        ott_device: "pc",
        selIndex: 0,
        sFavorites: 0,
    };
    ui(w);
    const owner = w.__ottClassicScreenPort.screens.open({
        handle: () => {},
        kind: "list",
    });
    const banners = [],
        errors = [];
    let selectedScreen = true,
        removedCalls = 0,
        shown;
    const metadataText = fn(
        extract(
            "src/utils/helpers.ts",
            (n) =>
                ts.isFunctionDeclaration(n) && n.name?.text === "metadataText"
        ),
        {}
    );
    const removed = fn(
        extract(
            "src/commands/global-favorites.ts",
            (n) =>
                ts.isPropertyAssignment(n) &&
                n.name.getText() === "favoriteRemoved"
        ).replace(/^favoriteRemoved:\s*/, ""),
        {
            metadataText,
            remotePlayerInfo: () => ({ runtime: "runtime" }),
            runtime: "runtime",
            w: { _: (x) => x, showShift: (x) => banners.push(x) },
        }
    );
    const facade = load(
        "src/settings/global-favorites-facade.ts"
    ).createGlobalFavoritesFacade({
        caselessKey: realCaselessKey,
        codec: f.codec,
        current: () => true,
        qualify: () => f.committer.qualify(),
        store: f.store,
    });
    const hostRemove = fn(
        extract(
            "src/media/global-favorites-host.ts",
            (n) => ts.isPropertyAssignment(n) && n.name.getText() === "remove"
        ).replace(/^remove:\s*/, ""),
        {
            committer: f.committer,
            createFavoritesRecoveryCodec: load(
                "src/settings/favorites-recovery-codec.ts"
            ).createFavoritesRecoveryCodec,
            facade,
            grant: f.grant,
            ports: {
                sha256: async (x) =>
                    require("./global-favorites-fixture.cjs").hash(x),
            },
        }
    );
    const view = load(
        "src/media/global-favorites-view.ts"
    ).createGlobalFavoritesView({
        canFavorite: () => w.sFavorites !== -1 && !w.__ottStandby?.blocked(),
        captureScreen: () => () => true,
        current: () => true,
        describe: () => "",
        error: (e) => errors.push(e),
        navigation: { currentId: () => null, isPlaying: () => false },
        remove: async (id, admitted) => {
            removedCalls++;
            if (outcome) return { outcome };
            return hostRemove(id, admitted);
        },
        removed,
        router: {
            select: () => {
                throw Error("Remove must not play");
            },
        },
        selected: () => w.selIndex,
        show: (v) => {
            shown = v;
            return () => selectedScreen;
        },
        store: f.store,
        translate: (x) => x,
    });
    w.__ottGlobalFavorites = {
        favoriteSelected: (captured) =>
            captured === owner && view.favoriteSelected(),
    };
    w.__ottToggleKeyboardFavorite = () =>
        fn(
            extract(
                "src/key-handler/index.ts",
                (n) =>
                    ts.isFunctionDeclaration(n) &&
                    n.name?.text === "toggleKeyboardFavorite"
            ),
            {}
        )(w);
    const doc = { activeElement: null };
    const key = fn(
        extract(
            "src/key-handler/index.ts",
            (n) =>
                ts.isFunctionDeclaration(n) &&
                n.name?.text === "tryKeyboardFavorites"
        ),
        { document: doc, window: w }
    );
    await view.open();
    function press(extra = {}) {
        const event = {
            code: "KeyF",
            key: "f",
            keyCode: 70,
            preventDefault() {
                this.prevented = true;
            },
            stopImmediatePropagation() {},
            stopPropagation() {},
            target: null,
            ...extra,
        };
        return key(event);
    }
    return {
        banners,
        doc,
        errors,
        f,
        press,
        get removedCalls() {
            return removedCalls;
        },
        selectScreen: (value) => {
            selectedScreen = value;
        },
        get shown() {
            return shown;
        },
        view,
        w,
    };
}
function notificationBoundary() {
    const hostText = fs.readFileSync(
        path.join(root, "src/media/global-favorites-host.ts"),
        "utf8"
    );
    assert.doesNotMatch(hostText, /from ["']\.\.\/utils\/helpers["']/);
    assert.match(hostText, /removed: ports\.favoriteRemoved/);
    let active = "a";
    const banners = [],
        w = { _: (x) => x, showShift: (x) => banners.push(x) };
    const metadataText = fn(
        extract(
            "src/utils/helpers.ts",
            (n) =>
                ts.isFunctionDeclaration(n) && n.name?.text === "metadataText"
        ),
        {}
    );
    const notify = fn(
        extract(
            "src/commands/global-favorites.ts",
            (n) =>
                ts.isPropertyAssignment(n) &&
                n.name.getText() === "favoriteRemoved"
        ).replace(/^favoriteRemoved:\s*/, ""),
        {
            metadataText,
            remotePlayerInfo: () => ({ runtime: active }),
            runtime: "a",
            w,
        }
    );
    notify("<A> & B");
    assert.deepEqual(banners, ["Favorites: − &lt;A&gt; &amp; B"]);
    const toggle = fn(
        extract(
            "src/commands/global-favorites.ts",
            (n) =>
                ts.isPropertyAssignment(n) &&
                n.name.getText() === "favoriteToggled"
        ).replace(/^favoriteToggled:\s*/, ""),
        {
            metadataText,
            remotePlayerInfo: () => ({ runtime: active }),
            runtime: "a",
            w,
        }
    );
    toggle("<b>A & B</b> &amp;", true);
    toggle("<b>A & B</b> &amp;", false);
    assert.deepEqual(banners.slice(1), [
        "Favorites: + &lt;b&gt;A &amp; B&lt;/b&gt; &amp;amp;",
        "Favorites: − &lt;b&gt;A &amp; B&lt;/b&gt; &amp;amp;",
    ]);
    active = "b";
    notify("stale");
    toggle("stale", true);
    assert.equal(banners.length, 3);
    console.log(
        "PASS MAIN-owned escaped notification port and stale-runtime suppression; no optional helper import"
    );
}
async function categoryFixture(count, device = "pc") {
    const events = [],
        footer = [],
        elements = {};
    let complete,
        renders = 0;
    const keys = fn(
        extract(
            `src/devices/${device}/device.ts`,
            (n) => ts.isVariableDeclaration(n) && /Keys$/.test(n.name.getText())
        ).replace(/^\w+\s*=\s*/, ""),
        {}
    );
    keys.PLAYPAUSE = 10252;
    const w = {
        _: (value) => value,
        __ottChannels: {
            group: (index) => ["system:all", "news", "system:favorites"][index],
            index: (id) => (id === "system:favorites" ? 2 : -1),
            refresh() {},
            rememberCategory() {},
        },
        $: () => ({ hide() {}, html() {}, is: () => false }),
        catIndex: 0,
        cats: { All: [7, 8], Favorites: [], News: [7] },
        catsArray: ["All", "News", "Favorites"],
        changeSelect: (delta) => events.push(["page", delta]),
        changeVolume: (delta) => events.push(["volume", delta]),
        channels: new Proxy(
            {},
            {
                get() {
                    throw Error("No provider UUID lookup");
                },
            }
        ),
        channelsList: (category, selected) =>
            events.push(["channels", category, selected]),
        closeList() {
            w.__ottClassicScreenPort.closeList();
        },
        document: { getElementById: (id) => (elements[id] ||= {}) },
        getViewportHeightScale: () => 1,
        getViewportWidthScale: () => 1,
        innerHeight: 720,
        keys,
        listCaptionElement: {},
        listDetail: {},
        listFooter: {},
        primaryIndex: 1,
        renderButtonHint: (key, _icon, title) => {
            footer.push({ key, title });
            return title;
        },
        sArrowFun: 0,
        settings: { pageSize: 10 },
        sFavorites: 0,
        showPage() {
            renders++;
            w.__ottClassicScreenPort.commitList();
        },
        sPNFun: 0,
        sRewFun: 0,
        strEPG: "EPG",
        strInfo: "Info",
        strPlayPause: "Play/Pause",
        strTools: "Tools",
    };
    w.window = w;
    ui(w);
    function actual(file, name) {
        return fn(
            extract(
                file,
                (n) => ts.isFunctionDeclaration(n) && n.name?.text === name
            ),
            w
        );
    }
    const channels = actual("src/provider/index.ts", "_channelsList");
    w.__ottChannelListView = {
        show: (view) => channels(0, view.selected, view),
    };
    w.playingChannelIdxInCategory = actual(
        "src/channels/index.ts",
        "playingChannelIdxInCategory"
    );
    require("./helpers/category-selector-runtime.cjs")(w);
    w.bucketsKeyHandler = actual("src/channels/index.ts", "bucketsKeyHandler");
    w.bucketsList = actual("src/channels/index.ts", "bucketsList");
    const show = fn(
        extract(
            "src/media/global-favorites-host.ts",
            (n) => ts.isPropertyAssignment(n) && n.name.getText() === "show"
        ).replace(/^show:\s*/, ""),
        { permitted: () => true, w }
    );
    const entries = count
        ? [
              {
                  id: "00000000-0000-4000-8000-000000000001",
                  origin: {},
                  title: "Saved channel",
              },
          ]
        : [];
    const view = load(
        "src/media/global-favorites-view.ts"
    ).createGlobalFavoritesView({
        canFavorite: () => true,
        captureScreen: () => () => true,
        current: () => true,
        describe: () => "Profile",
        error: (reason) => events.push(["error", reason]),
        navigation: { currentId: () => null, isPlaying: () => false },
        remove: async () => {
            throw Error("Navigation must not remove Favorites");
        },
        removed() {},
        router: {
            select: (id) => {
                events.push(["select", id]);
                return {
                    cancel: () => events.push(["cancel"]),
                    result: new Promise((resolve) => {
                        complete = resolve;
                    }),
                };
            },
        },
        selected: () => w.selIndex,
        show,
        store: { snapshot: async () => ({ current: () => true, entries }) },
        translate: (value) => value,
    });
    await view.open();
    events.length = 0;
    return {
        complete: (result) => complete(result),
        elements,
        events,
        footer,
        press: (code) =>
            w.__ottClassicScreenPort.dispatch(code, {}, () =>
                events.push(["main"])
            ),
        renders: () => renders,
        view,
        w,
    };
}
async function categoryNavigation() {
    for (const count of [0, 1]) {
        for (const device of ["pc", "lg/webos"]) {
            for (const name of ["BLUE", "PLAY", "PAUSE", "PLAYPAUSE"]) {
                const f = await categoryFixture(count, device);
                const oldOwner = f.w.__ottClassicScreenPort.listOwner();
                assert.equal(
                    f.w.listCatIndex,
                    0,
                    "global view uses a virtual index"
                );
                assert(
                    f.footer.some(
                        (item) =>
                            item.title === "Category" &&
                            item.key === f.w.keys.BLUE
                    )
                );
                f.press(f.w.keys[name]);
                assert.equal(
                    f.elements.listCaption?.innerHTML,
                    "Category selection",
                    `${device}/${count}/${name}`
                );
                assert.equal(
                    f.w.selIndex,
                    2,
                    "picker highlights actual Favorites, not virtual index zero"
                );
                assert.equal(oldOwner.active(), false);
                assert.equal(
                    f.events.length,
                    0,
                    "opening categories neither plays nor mutates Favorites"
                );
                f.w.selIndex = 0;
                f.press(f.w.keys.ENTER);
                assert.deepEqual(
                    f.events,
                    [["channels", 0, 1]],
                    "All opens with the playing selection"
                );
            }
        }
        for (const [name, setting] of [
            ["LEFT", "sArrowFun"],
            ["RW", "sRewFun"],
            ["PREV", "sPNFun"],
        ]) {
            const f = await categoryFixture(count);
            f.w[setting] = name === "LEFT" ? 2 : 1;
            f.press(f.w.keys[name]);
            assert.equal(
                f.elements.listCaption?.innerHTML,
                "Category selection"
            );
            assert.equal(f.w.selIndex, 2);
        }
        for (const name of ["RW", "PREV", "FF", "NEXT"]) {
            const f = await categoryFixture(count);
            f.w.sRewFun = f.w.sPNFun = 2;
            f.press(f.w.keys[name]);
            const backward = /^(RW|PREV)$/.test(name);
            assert.deepEqual(f.events, [
                ["channels", backward ? 1 : 0, backward ? 0 : 1],
            ]);
        }
        const select = await categoryFixture(count);
        select.press(select.w.keys.ENTER);
        assert.equal(
            select.events.length,
            count,
            "Enter selects one row and is safe on an empty list"
        );
        if (count) assert.equal(select.events[0][0], "select");
        const back = await categoryFixture(count);
        back.press(back.w.keys.RETURN);
        assert.equal(back.w.__ottClassicScreenPort.listOwner(), null);
    }
    const pending = await categoryFixture(1);
    pending.press(pending.w.keys.ENTER);
    pending.press(pending.w.keys.BLUE);
    assert.deepEqual(
        pending.events.map((event) => event[0]),
        ["select", "cancel"]
    );
    const rendered = pending.renders();
    pending.complete({ status: "ok" });
    await settle();
    assert.equal(
        pending.renders(),
        rendered,
        "late completion cannot reopen Favorites over categories"
    );
    for (const mode of ["volume", "page", "modal"]) {
        const f = await categoryFixture(1);
        if (mode === "volume") f.w.sArrowFun = 1;
        if (mode === "modal")
            f.w.__ottClassicScreenPort.screens.open({
                handle: () => f.events.push(["modal"]),
                kind: "dialog",
                priority: 10,
            });
        f.press(f.w.keys[mode === "modal" ? "BLUE" : "LEFT"]);
        assert.equal(f.events[0][0], mode);
        assert.equal(f.elements.listCaption, undefined);
    }
    console.log(
        "PASS real empty/populated Favorites renderer and router: desktop/TV Category keys, configured navigation, Enter, Back, modal ownership and cancellation"
    );
}
async function duneCategoryNavigation() {
    for (const device of ["pc", "pc2", "lg/webos"]) {
        for (const mode of [0, 1, 2, 3]) {
            for (const name of ["RIGHT", "LEFT", "ENTER"]) {
                const f = await categoryFixture(1, device);
                f.w.sArrowFun = mode;
                f.w.listPageSize = 10;
                f.w.popupList = () => f.events.push(["popup"]);
                f.w.bucketsList(1);
                f.press(f.w.keys[name]);
                const direction = name === "LEFT" ? -1 : 1;
                const expected =
                    name === "ENTER" || (mode === 2 && name === "RIGHT")
                        ? ["channels", 1, 0]
                        : mode === 2
                          ? ["popup"]
                          : [
                                mode === 1 ? "volume" : "page",
                                direction * (mode === 1 ? 5 : 10),
                            ];
                assert.deepEqual(
                    f.events,
                    [expected],
                    `${device} category ${name} preserves arrow mode ${mode}`
                );
            }
        }
        const projected = await categoryFixture(1, device);
        projected.w.sArrowFun = 2;
        projected.w.sShowAllCategory = projected.w.sShowFavoritesCategory = 0;
        projected.w.bucketsList(1);
        assert.equal(projected.w.selIndex, 0);
        assert.deepEqual(Array.from(projected.w.listArray), ["News"]);
        projected.press(projected.w.keys.RIGHT);
        assert.deepEqual(
            projected.events,
            [["channels", 1, 0]],
            "Dune Right uses projected category identity, not visible row zero"
        );

        const favorites = await categoryFixture(1, device);
        favorites.w.sArrowFun = 2;
        favorites.w.sShowAllCategory = 0;
        favorites.w.openGlobalFavorites = () => {
            favorites.events.push(["favorites"]);
            return true;
        };
        favorites.w.bucketsList(2);
        assert.equal(favorites.w.selIndex, 1);
        favorites.press(favorites.w.keys.RIGHT);
        assert.deepEqual(
            favorites.events,
            [["favorites"]],
            "Dune Right retains the global Favorites route"
        );

        const stale = await categoryFixture(1, device);
        stale.w.sArrowFun = 2;
        stale.w.bucketsList(1);
        stale.w.selIndex = 99;
        stale.press(stale.w.keys.RIGHT);
        assert.deepEqual(
            stale.events,
            [],
            "invalid category never pages or opens"
        );

        const fallback = await categoryFixture(1, device);
        fallback.w.sArrowFun = 2;
        fallback.w.bucketsList(1);
        fallback.press(fallback.w.keys.LEFT);
        assert.equal(fallback.w.__ottClassicScreenPort.listOwner(), null);
        assert.deepEqual(
            fallback.events,
            [],
            "Dune Left retains close fallback"
        );

        const modal = await categoryFixture(1, device);
        modal.w.sArrowFun = 2;
        modal.w.bucketsList(1);
        modal.w.__ottClassicScreenPort.screens.open({
            handle: (command) => modal.events.push(["modal", command.id]),
            kind: "dialog",
            priority: 10,
        });
        modal.press(modal.w.keys.LEFT);
        modal.press(modal.w.keys.RIGHT);
        assert.deepEqual(modal.events, [
            ["modal", "left"],
            ["modal", "right"],
        ]);

        const popup = await categoryFixture(1, device);
        popup.w.sArrowFun = 2;
        popup.w.bucketsList(1);
        popup.w.popupList = () => popup.events.push(["popup"]);
        const query = popup.w.$;
        popup.w.$ = (selector) =>
            selector === "#listPopUp" ? { is: () => true } : query(selector);
        popup.press(popup.w.keys.LEFT);
        popup.press(popup.w.keys.RIGHT);
        assert.deepEqual(
            popup.events,
            [],
            "category management popup consumes arrows before Dune navigation"
        );
        assert(popup.w.__ottClassicScreenPort.listOwner());

        const provider = await categoryFixture(1, device);
        provider.w.sArrowFun = 2;
        provider.w.bucketsList(0, undefined, {
            key: (code) => {
                provider.events.push(["provider", code]);
                return true;
            },
            labels: ["Provider category"],
        });
        provider.press(provider.w.keys.LEFT);
        provider.press(provider.w.keys.RIGHT);
        assert.deepEqual(provider.events, [
            ["provider", provider.w.keys.LEFT],
            ["provider", provider.w.keys.RIGHT],
        ]);
    }
    console.log(
        "PASS Dune category arrows: focused/projected/Favorites routes, other modes, Enter, Back, popup, modal and provider ownership"
    );
}
async function main() {
    await duneCategoryNavigation();
    await categoryNavigation();
    notificationBoundary();
    const good = await setup();
    assert(good.press());
    assert(good.press({ repeat: true }));
    await settle();
    assert.equal((await good.f.store.snapshot()).entries.length, 0);
    assert.equal(good.removedCalls, 1);
    assert.equal(good.banners.length, 1);
    assert.match(good.banners[0], /Favorites: − A &lt;name&gt; &amp; B/);
    console.log(
        "PASS actual F capture -> input router -> screen global callback -> UUID store removal and one literal-name banner"
    );
    for (const outcome of ["not_applied", "unknown", "verified"]) {
        const failed = await setup(outcome);
        failed.press();
        await settle();
        assert.equal(failed.banners.length, 0);
        assert.equal((await failed.f.store.snapshot()).entries.length, 1);
        assert.deepEqual(failed.errors, ["storage_unavailable"]);
    }
    console.log(
        "PASS refused/uncertain storage never announces successful removal"
    );
    for (const extra of [
        { ctrlKey: true },
        { metaKey: true },
        { altKey: true },
        { shiftKey: true },
        { repeat: true },
        { target: { tagName: "INPUT" } },
        { target: { isContentEditable: true } },
    ]) {
        const guarded = await setup();
        guarded.press(extra);
        await settle();
        assert.equal(guarded.removedCalls, 0);
        assert.equal(guarded.banners.length, 0);
    }
    console.log(
        "PASS modifiers, text editing and held-repeat retain existing F guards"
    );
    for (const mode of ["kiosk", "dialog", "standby", "disabled", "stale"]) {
        const guarded = await setup();
        if (mode === "kiosk") guarded.w.__ottKiosk = { enabled: () => true };
        if (mode === "dialog")
            guarded.w.__ottClassicScreenPort.screens.open({
                handle: () => {},
                kind: "dialog",
                priority: 10,
            });
        if (mode === "standby")
            guarded.w.__ottStandby = { blocked: () => true };
        if (mode === "disabled") guarded.w.sFavorites = -1;
        if (mode === "stale") guarded.selectScreen(false);
        guarded.press();
        await settle();
        assert.equal(guarded.removedCalls, 0);
        assert.equal(guarded.banners.length, 0);
    }
    console.log("PASS modal/kiosk/standby/disabled/stale-owner refusal");
    const lost = await setup();
    lost.press();
    lost.selectScreen(false);
    await settle();
    assert.equal(lost.removedCalls, 0);
    assert.equal(lost.banners.length, 0);
    console.log("PASS owner loss before async removal writes nothing");
    const missing = await setup();
    missing.w.selIndex = 9;
    missing.press();
    await settle();
    assert.equal(missing.removedCalls, 0);
    assert.deepEqual(missing.errors, ["unavailable"]);
    console.log(
        "PASS missing/nonportable selection never falls through to provider UUID lookup"
    );
}
main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
