const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");
const { JSDOM } = require("jsdom");
const { settingsSource } = require("./helpers/settings-source-fixture.cjs");
const { compatibilitySource } = require("./helpers/english-source-fixture.cjs");

const root = path.resolve(__dirname, "..");
function compile(file) {
    return ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
        },
    }).outputText;
}
function settingsFixture(stored = new Map()) {
    const dom = new JSDOM("<main></main>", {
        runScripts: "outside-only",
        url: "https://example.invalid/",
    });
    const w = dom.window;
    const effects = [];
    let provider = "one";
    require("./helpers/shared-core-runtime.cjs")(dom.getInternalVMContext());
    Object.assign(w, require("./load-wire.cjs")());
    w.eval(compatibilitySource);
    const storage = {
        del: (key) => stored.delete(key),
        get: (key) => stored.get(key) ?? null,
        getI: (key, fallback) => {
            const value = Number.parseInt(stored.get(key), 10);
            return Number.isNaN(value) ? fallback : value;
        },
        set: (key, value) => stored.set(key, String(value)),
        setI: (key, value) => stored.set(key, String(value)),
    };
    Object.assign(w, {
        _: (value) => value,
        ott_device: "pc",
        p_pref: provider,
        providerDelItem: (key) => storage.del(provider + ":" + key),
        providerGetItem: (key) => storage.get(provider + ":" + key),
        providerSetItem: (key, value) =>
            storage.set(provider + ":" + key, value),
        setInterfaceMode: () => effects.push("interface"),
        setPlayerMode: () => effects.push("player"),
        storage,
    });
    w.eval(settingsSource());
    w.loadSettings();
    return {
        dom,
        effects,
        provider(value) {
            provider = value;
            w.p_pref = value;
            w.loadProviderSettings(0);
        },
        stored,
        w,
    };
}

test("interface mode is opt-in and separate from the existing theme", () => {
    const f = settingsFixture();
    try {
        assert.equal(f.w.settings.interfaceMode, 0);
        assert.equal(f.w.settings.interfaceTheme, 2);
        assert.equal(f.stored.has("sInterfaceMode"), false);
        assert.equal(f.w.saveSettings({ interfaceMode: 1 }), true);
        assert.equal(f.w.settings.interfaceMode, 1);
        assert.equal(f.w.settings.interfaceTheme, 2);
        assert.deepEqual(f.effects, ["interface"]);
    } finally {
        f.dom.window.close();
    }
});

test("mode persists for this client across providers and a fresh session", () => {
    const stored = new Map();
    const f = settingsFixture(stored);
    try {
        assert.equal(f.w.saveSettings({ interfaceMode: 1 }), true);
        assert.equal(stored.get("sInterfaceMode"), "1");
        stored.set("two:sInterfaceMode", "0");
        f.provider("two");
        assert.equal(f.w.settings.interfaceMode, 1);
        assert.equal(f.w.sInterfaceMode, 1);
        assert.deepEqual(f.effects, ["interface"]);
    } finally {
        f.dom.window.close();
    }
    const next = settingsFixture(stored);
    try {
        assert.equal(next.w.settings.interfaceMode, 1);
        assert.equal(next.w.saveSettings({ interfaceMode: 0 }), true);
        next.provider("one");
        assert.equal(next.w.settings.interfaceMode, 0);
        assert.equal(stored.get("sInterfaceMode"), "0");
    } finally {
        next.dom.window.close();
    }
});

test("invalid modes cannot overwrite a valid setting or run effects", () => {
    const f = settingsFixture();
    try {
        assert.equal(f.w.saveSettings({ interfaceMode: 1 }), true);
        for (const value of [-1, 2, 0.5, NaN, null, "modern", {}, []]) {
            const effectsBefore = f.effects.length;
            assert.equal(f.w.saveSettings({ interfaceMode: value }), false);
            assert.equal(f.w.settings.interfaceMode, 1);
            assert.equal(f.stored.get("sInterfaceMode"), "1");
            assert.equal(f.effects.length, effectsBefore);
        }
    } finally {
        f.dom.window.close();
    }
});

function loaderFixture() {
    const dom = new JSDOM("<main></main>", {
        runScripts: "outside-only",
        url: "https://example.invalid/player/",
    });
    const w = dom.window;
    const timers = new Map();
    const notices = [];
    let sequence = 0;
    Object.assign(w, {
        __cv: "fixture version",
        clearTimeout: (id) => timers.delete(id),
        hostUrl: "https://example.invalid/player/",
        loadChannels: () => assert.fail("view mode must not reload the source"),
        setTimeout: (callback) => {
            const id = ++sequence;
            timers.set(id, callback);
            return id;
        },
        showPopup: (message) => notices.push(message),
        sInterfaceMode: 0,
        stopPlayer: () => assert.fail("view mode must not stop playback"),
    });
    w.eval(compile("src/ui/interface-mode.ts"));
    return {
        dom,
        notices,
        ready(refresh = () => {}) {
            w.__ottModernUi = { prepare() {}, refresh };
            const script = this.script();
            assert(script, "a module request must exist before completion");
            script.onload();
        },
        script: () => w.document.querySelector("script"),
        timers,
        w,
    };
}

test("Classic makes no optional request; concurrent Modern loads are coalesced", () => {
    const f = loaderFixture();
    try {
        assert.equal(f.script(), null);
        const results = [];
        f.w.__ottEnsureModernUi((value) => results.push(["first", value]));
        f.w.__ottEnsureModernUi((value) => results.push(["second", value]));
        assert.equal(f.w.document.querySelectorAll("script").length, 1);
        assert.equal(
            f.script().src,
            "https://example.invalid/player/dist/modern-interface.js?fixture%20version"
        );
        f.ready();
        assert.deepEqual(results, [
            ["first", true],
            ["second", true],
        ]);
        assert.equal(f.timers.size, 0);
        assert.equal(f.script(), null);
    } finally {
        f.dom.window.close();
    }
});

test("late optional load cannot undo a user's return to Classic", () => {
    const f = loaderFixture();
    let paints = 0;
    try {
        f.w.sInterfaceMode = 1;
        f.w.setInterfaceMode();
        assert.equal(f.w.__ottInterfaceModeState.status, "loading");
        f.w.sInterfaceMode = 0;
        f.w.setInterfaceMode();
        f.ready(() => paints++);
        assert.equal(f.w.__ottInterfaceModeState.status, "classic");
        assert.equal(f.w.__ottInterfaceModeState.effective, 0);
        assert.equal(
            f.w.document.body.classList.contains("interface-modern"),
            false
        );
        assert.equal(paints, 0);
    } finally {
        f.dom.window.close();
    }
});

for (const failure of [
    "error",
    "timeout",
    "incomplete-module",
    "unsupported",
]) {
    test(`${failure} keeps Classic usable and prevents retry storms`, () => {
        const f = loaderFixture();
        try {
            f.w.sInterfaceMode = 1;
            f.w.setInterfaceMode();
            if (failure === "timeout") [...f.timers.values()][0]();
            else if (failure === "error") f.script().onerror();
            else {
                if (failure === "unsupported")
                    f.w.__ottModernUi = {
                        prepare() {},
                        refresh() {
                            assert.fail("unsupported renderer cannot repaint");
                        },
                        supported: () => false,
                    };
                f.script().onload();
            }
            assert.equal(f.w.__ottInterfaceModeState.status, "fallback");
            assert.equal(f.w.__ottInterfaceModeState.effective, 0);
            assert.equal(
                f.w.document.body.classList.contains("interface-modern"),
                false
            );
            assert.equal(f.script(), null);
            assert.equal(f.timers.size, 0);
            f.w.setInterfaceMode();
            assert.equal(
                f.script(),
                null,
                "failure must not create a request loop"
            );
            f.w.sInterfaceMode = 0;
            f.w.setInterfaceMode();
            f.w.sInterfaceMode = 1;
            f.w.setInterfaceMode();
            assert(
                f.script(),
                "explicit Classic→Modern choice permits a retry"
            );
        } finally {
            f.dom.window.close();
        }
    });
}

test("successful mode changes only repaint and keep one renderer instance", () => {
    const f = loaderFixture();
    const paints = [];
    try {
        f.w.sInterfaceMode = 1;
        f.w.setInterfaceMode();
        f.ready(() => paints.push(f.w.__ottInterfaceModeState.effective));
        const renderer = f.w.__ottModernUi;
        assert.equal(f.w.__ottInterfaceModeState.status, "modern");
        assert.equal(
            f.w.document.body.classList.contains("interface-modern"),
            true
        );
        f.w.sInterfaceMode = 0;
        f.w.setInterfaceMode();
        f.w.sInterfaceMode = 1;
        f.w.setInterfaceMode();
        assert.deepEqual(paints, [1, 0, 1]);
        assert.equal(f.w.__ottModernUi, renderer);
        assert.equal(f.script(), null);
        assert.deepEqual(f.notices, []);
    } finally {
        f.dom.window.close();
    }
});

function rendererFixture() {
    const dom = new JSDOM(
        '<div id="listIn"></div><div id="listDetail"></div>',
        {
            runScripts: "outside-only",
            url: "https://example.invalid/",
        }
    );
    const w = dom.window;
    const container = w.document.getElementById("listIn");
    Object.defineProperties(container, {
        clientHeight: { value: 570 },
        clientWidth: { value: 760 },
    });
    Object.assign(w, {
        changeSelect(delta) {
            w.selIndex += delta;
        },
        changeVolume: () =>
            assert.fail("grid navigation must not adjust volume"),
        innerHeight: 720,
        innerWidth: 1280,
        isListVisible: true,
        loadChannels: () => assert.fail("renderer must not reload a source"),
        playChannel: () =>
            assert.fail("navigation must not activate a channel"),
        selIndex: 3450,
        settings: { interfaceMode: 1 },
        sUiFontScale: 100,
    });
    w.eval(compile("src/ui/modern-artwork.ts"));
    w.eval(compile("src/ui/modern.ts"));
    const ids = Array.from({ length: 10000 }, (_, index) => "item-" + index);
    let reads = 0;
    const formatter = () => "Classic row";
    formatter.__ottCatalog = {
        playing: (id) => id === ids[3450],
        row(id) {
            reads++;
            return {
                __ottMediaItem: {
                    __ottMediaCollection: "Library",
                    description: "Shared source metadata",
                    poster: "https://example.invalid/poster.jpg",
                },
                channel_name: "Film " + id,
            };
        },
    };
    return {
        api: w.__ottModernUi,
        container,
        dom,
        formatter,
        ids,
        reads: () => reads,
        w,
    };
}

test("10k catalogue renders a bounded window without cloning or traversing it", () => {
    const f = rendererFixture();
    try {
        const original = f.ids.slice();
        const layout = f.api.prepare(f.ids, f.formatter, f.container);
        assert.equal(layout.grid, true);
        assert(layout.cellWidth > 0);
        assert(layout.pageSize > 0 && layout.pageSize <= 30);
        assert(f.reads() <= 2, "layout must not read all source metadata");
        const start = 3450;
        for (let index = start; index < start + layout.pageSize; index++) {
            const item = f.w.document.createElement("div");
            item.className = "item";
            item.id = "it" + index;
            item.dataset.idx = index;
            item.innerHTML = f.api.render(f.ids[index], index);
            f.container.appendChild(item);
        }
        f.api.decorate(f.container, start, start + layout.pageSize);
        assert.equal(
            f.container.querySelectorAll(".modern-card").length,
            layout.pageSize
        );
        assert(f.reads() <= layout.pageSize * 3 + 2);
        assert.equal(f.w.document.querySelectorAll(".ott-playing").length, 1);
        assert.equal(
            f.w.document.querySelector(".modern-title").textContent,
            "Film item-3450"
        );
        assert.deepEqual(
            f.ids,
            original,
            "view must not reorder the shared catalogue"
        );
        assert.equal(f.w.selIndex, 3450);
    } finally {
        f.dom.window.close();
    }
});

test("grid owns directional input only for its current foreground catalogue", () => {
    const f = rendererFixture();
    try {
        const layout = f.api.prepare(f.ids, f.formatter, f.container);
        let foreground = true;
        const owner = {
            foreground: () => foreground,
            model: { render: f.formatter },
        };
        assert.equal(f.api.navigation({ id: "right" }, owner), true);
        assert.equal(f.w.selIndex, 3451);
        assert.equal(f.api.navigation({ id: "down" }, owner), true);
        assert.equal(f.w.selIndex, 3451 + layout.columns);
        const selected = f.w.selIndex;
        f.w.isListVisible = false;
        assert.equal(f.api.navigation({ id: "left" }, owner), false);
        f.w.isListVisible = true;
        foreground = false;
        assert.equal(f.api.navigation({ id: "left" }, owner), false);
        foreground = true;
        owner.model.render = () => "Other screen";
        assert.equal(f.api.navigation({ id: "left" }, owner), false);
        owner.model.render = f.formatter;
        f.w.settings.interfaceMode = 0;
        assert.equal(f.api.navigation({ id: "left" }, owner), false);
        assert.equal(f.w.selIndex, selected);
    } finally {
        f.dom.window.close();
    }
});

test("Classic and non-catalogue screens remove Modern layout without changing selection", () => {
    const f = rendererFixture();
    try {
        f.api.prepare(f.ids, f.formatter, f.container);
        assert(f.container.classList.contains("modern-grid"));
        const menu = f.api.prepare(f.ids, () => "Settings row", f.container);
        assert.equal(menu.menu, true);
        assert.equal(menu.grid, false);
        assert.equal(menu.columns, 1);
        assert(menu.pageSize <= 12);
        assert.equal(f.api.render(f.ids[0], 0), null);
        assert.equal(f.container.classList.contains("modern-catalog"), false);
        assert.equal(f.container.classList.contains("modern-options"), true);
        assert.equal(
            f.container.style.gridTemplateColumns,
            "repeat(1, minmax(0, 1fr))"
        );
        assert.equal(f.api.prepare(f.ids, f.formatter, null), null);
        f.w.settings.interfaceMode = 0;
        assert.equal(f.api.prepare(f.ids, f.formatter, f.container), null);
        assert.equal(f.api.render(f.ids[0], 0), null);
        assert.equal(f.w.selIndex, 3450);
    } finally {
        f.dom.window.close();
    }
});

test("a failed Modern render can use Classic while retaining the user's saved preference", () => {
    const f = rendererFixture();
    try {
        f.w.__ottInterfaceModeState = { effective: 1 };
        assert(f.api.prepare(f.ids, f.formatter, f.container));
        f.w.__ottInterfaceModeState.effective = 0;
        assert.equal(f.api.prepare(f.ids, f.formatter, f.container), null);
        assert.equal(f.api.render(f.ids[0], 0), null);
        assert.equal(f.container.classList.contains("modern-catalog"), false);
        assert.equal(f.w.settings.interfaceMode, 1);
    } finally {
        f.dom.window.close();
    }
});

test("metadata remains text and rejected artwork leaves a usable fallback", () => {
    const f = rendererFixture();
    try {
        f.w.selIndex = 0;
        f.formatter.__ottCatalog.row = () => ({
            __ottMediaItem: { poster: "javascript:alert(1)" },
            channel_name:
                'Movie <img src=x onerror="window.changed=1"> & title',
        });
        assert(f.api.prepare(["id"], f.formatter, f.container));
        f.container.innerHTML = f.api.render("id", 0);
        assert.equal(f.container.querySelectorAll("img,script").length, 0);
        assert.equal(
            f.container.querySelector(".modern-title").textContent,
            'Movie <img src=x onerror="window.changed=1"> & title'
        );
        assert.equal(
            f.container.querySelector(".modern-art-fallback").textContent,
            "M"
        );
        assert.equal(f.w.changed, undefined);
    } finally {
        f.dom.window.close();
    }
});

test("mixed Favorites keep one grid shape and source identity while focus moves between films and live channels", () => {
    const f = rendererFixture();
    try {
        f.formatter.__ottCatalog.kind = "mixed";
        f.formatter.__ottCatalog.row = (id) => ({
            __ottMediaItem: id === "live" ? null : { name: id },
            channel_name: id,
            modernMeta: id === "live" ? "M3U / Home" : "Plex / Films / " + id,
        });
        const rows = ["film", "live", "film-two"];
        for (let selected = 0; selected < rows.length; selected++) {
            f.w.selIndex = selected;
            const layout = f.api.prepare(rows, f.formatter, f.container);
            assert.equal(layout.grid, true);
            assert.equal(f.container.classList.contains("modern-live"), false);
            assert.equal(f.container.classList.contains("modern-grid"), true);
            f.container.innerHTML = f.api.render(rows[selected], selected);
            assert.equal(
                f.container.querySelector(".modern-meta").textContent,
                selected === 1
                    ? "M3U / Home"
                    : "Plex / Films / " + rows[selected]
            );
        }
    } finally {
        f.dom.window.close();
    }
});

test("live artwork comes from the same provider projection as the Classic list", () => {
    const f = rendererFixture();
    try {
        const requested = [];
        f.w.selIndex = 0;
        f.formatter.__ottCatalog.row = (id) => ({ channel_name: id });
        f.formatter.__ottCatalog.picon = (id) => {
            requested.push(id);
            return "https://example.invalid/provider-logo.png";
        };
        const layout = f.api.prepare(["station"], f.formatter, f.container);
        assert.equal(layout.grid, false);
        f.container.innerHTML = f.api.render("station", 0);
        f.api.decorate(f.container, 0, 1);
        assert.equal(
            f.container.querySelector("img").src,
            "https://example.invalid/provider-logo.png"
        );
        assert(requested.length > 0);
        assert.equal(
            requested.every((id) => id === "station"),
            true
        );
    } finally {
        f.dom.window.close();
    }
});

function shellFixture() {
    const f = rendererFixture();
    const doc = f.w.document;
    const list = doc.createElement("section");
    list.id = "list";
    doc.body.appendChild(list);
    list.appendChild(f.container);
    list.appendChild(doc.getElementById("listDetail"));
    const caption = list.appendChild(doc.createElement("header"));
    caption.id = "listCaption";
    caption.textContent = "My library";
    const footer = list.appendChild(doc.createElement("footer"));
    footer.id = "listPodval";
    footer.innerHTML =
        '<span data-ott-key="123" aria-label="Categories">Category</span>';
    let active = true;
    const owner = { foreground: () => active, model: { render: f.formatter } };
    const effects = [];
    Object.assign(f.w, {
        __ottClassicScreenPort: { listOwner: () => owner },
        __ottKiosk: { enabled: () => false, locked: () => false },
        __ottModernActions: () => [
            {
                id: "settings",
                label: "Settings",
                run: () => effects.push("settings"),
            },
        ],
        _doKey: (key) => effects.push(key),
    });
    return {
        ...f,
        doc,
        effects,
        foreground: (value) => {
            active = value;
        },
        list,
        owner,
    };
}

test("Modern preserves artwork requests across source-owned formatter replacement and retires another source", async () => {
    const f = shellFixture();
    try {
        const calls = [],
            blobs = [];
        f.w.__TAURI__ = {
            core: {
                invoke: (command, args) =>
                    new Promise((resolve) =>
                        calls.push({ args, command, resolve })
                    ),
            },
        };
        f.w.URL.createObjectURL = (blob) => {
            blobs.push(blob);
            return "blob:fixture-" + blobs.length;
        };
        f.w.URL.revokeObjectURL = () => {};
        const tick = () => new Promise((resolve) => setImmediate(resolve));
        let currentSource;
        function snapshot(generation) {
            const value = {
                active: () => currentSource === value,
                generation,
                groups: [{ id: "system:all", members: f.ids, name: "All" }],
            };
            return value;
        }
        const source = snapshot(1);
        f.w.__ottChannels = { remoteCatalog: () => currentSource };
        f.w.channelsKeyHandler = () => {};
        f.w.listKeyHandler = f.owner.model.handler = f.w.channelsKeyHandler;
        f.w.cats = { All: f.ids };
        f.w.catsArray = ["All"];
        f.w.listCatIndex = 0;
        f.w.listArray = f.w.listDataArray = f.ids;
        f.owner.model.items = f.owner.model.rows = f.ids;
        function mount(identity, poster) {
            currentSource = identity;
            const render = () => "Classic";
            render.__ottCatalog = {
                categoryIndex: 0,
                channelSource: identity,
                row: () => ({
                    __ottMediaItem: { poster },
                    channel_name: "Film",
                }),
            };
            f.owner.model.render = render;
            f.w.getListItemFn = render;
            f.api.prepare(f.ids, render, f.container);
        }
        mount(source, "http://images.example/a.jpg");
        await tick();
        assert.equal(calls.length, 1);
        mount(source, "http://images.example/a.jpg");
        await tick();
        assert.equal(
            calls.length,
            1,
            "same source retains the pending request"
        );
        calls[0].resolve({ bodyBase64: "/9j/4A==", contentType: "image/jpeg" });
        await tick();
        assert.equal(blobs.length, 1);
        mount(source, "http://images.example/b.jpg");
        await tick();
        mount(source, "http://images.example/a.jpg");
        await tick();
        assert.equal(
            calls.length,
            2,
            "returning to an earlier card uses the bounded cache"
        );
        mount(snapshot(2), "http://images.example/b.jpg");
        await tick();
        assert.equal(
            calls.length,
            3,
            "another source cannot reuse retired work"
        );
        const before = blobs.length;
        calls[1].resolve({ bodyBase64: "/9j/4A==", contentType: "image/jpeg" });
        await tick();
        assert.equal(
            blobs.length,
            before,
            "retired source completion cannot paint"
        );
        calls[2].resolve({ bodyBase64: "/9j/4A==", contentType: "image/jpeg" });
        await tick();
        assert.equal(blobs.length, before + 1);
        const formatter = f.w.getListItemFn;
        currentSource = snapshot(2);
        f.api.prepare(f.ids, formatter, f.container);
        await tick();
        assert.equal(f.w.getListItemFn, formatter);
        assert.equal(
            calls.length,
            4,
            "republished normal snapshot retires artwork even with the same formatter"
        );
    } finally {
        f.api.hide();
        f.dom.window.close();
    }
});

test("Modern mounts one shared shell with typed selected-item information and removes it on Classic", () => {
    const f = shellFixture();
    try {
        f.api.prepare(f.ids, f.formatter, f.container);
        assert(f.list.classList.contains("modern-screen-grid"));
        assert.equal(f.doc.querySelectorAll("#modernRail").length, 1);
        assert.equal(
            f.doc.querySelector("#modernRail").getAttribute("aria-label"),
            "Menu"
        );
        assert.equal(
            f.doc.querySelector(".modern-hero-title").textContent,
            "Film item-3450"
        );
        assert.equal(
            f.doc.querySelector(".modern-hero-summary").textContent,
            "Shared source metadata"
        );
        assert.equal(
            f.doc.querySelector(".modern-library-count").textContent,
            "3451 / 10000"
        );
        f.w.selIndex = 6;
        f.api.detail();
        assert.equal(
            f.doc.querySelector(".modern-hero-title").textContent,
            "Film item-6"
        );
        assert.equal(
            f.doc.querySelector(".modern-library-count").textContent,
            "7 / 10000"
        );
        f.api.prepare(f.ids, f.formatter, f.container);
        assert.equal(f.doc.querySelectorAll("#modernShell").length, 1);
        f.w.settings.interfaceMode = 0;
        f.api.refresh();
        assert.equal(f.doc.querySelector("#modernShell"), null);
        assert(!f.list.classList.contains("modern-screen"));
        assert.equal(f.w.selIndex, 6);
    } finally {
        f.dom.window.close();
    }
});

test("Home and Library reuse the catalogue, selection and decoder with distinct bounded layouts", () => {
    const f = shellFixture();
    try {
        let paints = 0;
        let layout;
        f.w.__ottModernActions = () => [
            {
                id: "library",
                label: "Media Library",
                run: () =>
                    assert.fail("a local view switch must not route or reload"),
            },
        ];
        f.w.showPage = (retainDetail) => {
            assert.equal(retainDetail, true);
            paints++;
            layout = f.api.prepare(f.ids, f.formatter, f.container);
        };
        layout = f.api.prepare(f.ids, f.formatter, f.container);
        assert(f.list.classList.contains("modern-view-home"));
        assert.equal(layout.home, true);
        assert.equal(layout.pageSize, layout.columns);
        const originalIds = f.ids.slice();
        const library = f.doc.querySelector('[data-modern-action="library"]');
        library.focus();
        assert(library.classList.contains("modern-rail-selected"));
        library.click();
        assert(f.list.classList.contains("modern-view-library"));
        assert(!f.list.classList.contains("modern-view-home"));
        assert.equal(layout.home, false);
        assert(layout.pageSize <= layout.columns * 2);
        assert.equal(paints, 1);
        f.doc.querySelector('[data-modern-action="library"]').click();
        assert.equal(paints, 1, "reselecting the active view does not repaint");
        f.doc.querySelector('[data-modern-action="home"]').click();
        assert.equal(paints, 2);
        assert.equal(layout.pageSize, layout.columns);
        assert.equal(f.w.selIndex, 3450);
        assert.deepEqual(f.ids, originalIds);
        assert.equal(f.owner.model.render, f.formatter);
        const row = f.container.appendChild(f.doc.createElement("button"));
        row.id = "it" + f.w.selIndex;
        row.focus();
        assert.equal(f.doc.activeElement, row);
        assert.equal(
            f.doc
                .querySelector('[data-modern-action="home"]')
                .getAttribute("aria-current"),
            "page"
        );
        assert.equal(library.hasAttribute("aria-current"), false);
        assert.deepEqual(
            Array.from(
                f.doc.querySelectorAll(".modern-rail-selected"),
                (button) => button.getAttribute("data-modern-action")
            ),
            [],
            "switching views must not retain the previous rail focus highlight"
        );
    } finally {
        f.dom.window.close();
    }
});

test("Library fits natural portrait cards and enlarged captions in a narrow viewport", () => {
    const f = shellFixture();
    try {
        const container = f.doc.createElement("div");
        container.id = "listIn";
        container.style.fontSize = "28px";
        f.container.replaceWith(container);
        Object.defineProperties(container, {
            clientHeight: { value: 543 },
            clientWidth: { value: 361 },
        });
        f.w.innerWidth = 393;
        f.w.innerHeight = 851;
        f.w.sUiFontScale = 140;
        let layout;
        f.w.showPage = () => {
            layout = f.api.prepare(f.ids, f.formatter, container);
        };
        f.w.showPage();
        assert.equal(layout.home, true);
        f.doc.querySelector('[data-modern-action="library"]').click();
        assert.equal(layout.home, false);
        assert(
            layout.columns > 1,
            "one enlarged poster would clip its caption"
        );
        assert(layout.columns <= 8);
        const naturalHeight = (layout.cellWidth - 2) * 1.5 + 28 * 3.2 + 2;
        assert(naturalHeight <= layout.cellHeight + 1);
        assert(layout.cellHeight <= container.clientHeight);
        assert.equal(f.w.selIndex, 3450);
        assert.equal(f.effects.length, 0);
    } finally {
        f.dom.window.close();
    }
});

test("provider/settings controls and category selector keep host callbacks outside the top capsule", () => {
    const f = shellFixture();
    try {
        f.w.__ottModernActions = () =>
            ["favorites", "search", "categories", "providers", "settings"].map(
                (id) => ({
                    id,
                    label: id,
                    run: () => f.effects.push(id),
                })
            );
        f.api.prepare(f.ids, f.formatter, f.container);
        for (const id of ["home", "library", "favorites", "search"])
            assert(
                f.doc.querySelector(`#modernRail [data-modern-action="${id}"]`)
            );
        for (const id of ["providers", "settings"]) {
            const button = f.doc.querySelector(
                `.modern-account-actions [data-modern-action="${id}"]`
            );
            assert(button);
            assert(button.querySelector("svg"));
            button.click();
        }
        f.doc
            .querySelector(
                '.modern-library-actions [data-modern-action="categories"]'
            )
            .click();
        assert.deepEqual(f.effects, ["providers", "settings", "categories"]);
    } finally {
        f.dom.window.close();
    }
});

test("hero actions use selected-item contracts and reject stale selection, covered owners and kiosk", () => {
    const f = shellFixture();
    try {
        f.api.prepare(f.ids, f.formatter, f.container);
        assert.equal(f.doc.querySelectorAll(".modern-hero-action").length, 0);
        f.w.__ottModernSelectedActions = () => [
            {
                id: "play",
                label: "Play",
                run: () => f.effects.push("play:" + f.w.selIndex),
            },
            {
                id: "details",
                label: "Details",
                run: () => f.effects.push("details"),
            },
        ];
        f.api.detail();
        const stale = f.doc.querySelector('[data-modern-hero-action="play"]');
        f.w.selIndex = 4;
        stale.click();
        assert.deepEqual(f.effects, []);
        f.api.detail();
        const play = f.doc.querySelector('[data-modern-hero-action="play"]');
        f.foreground(false);
        play.click();
        f.foreground(true);
        f.w.__ottKiosk.enabled = () => true;
        play.click();
        assert.deepEqual(f.effects, []);
        f.w.__ottKiosk.enabled = () => false;
        play.click();
        assert.deepEqual(f.effects, ["play:4"]);
        f.doc.querySelector('[data-modern-action="library"]').click();
        play.click();
        assert.deepEqual(
            f.effects,
            ["play:4"],
            "hidden Library hero controls are stale"
        );
        assert.equal(f.doc.querySelectorAll(".modern-hero-action").length, 0);
    } finally {
        f.dom.window.close();
    }
});

test("Up from a later visible grid page reaches the capsule; Down restores its item", () => {
    const f = shellFixture();
    try {
        const layout = f.api.prepare(f.ids, f.formatter, f.container);
        f.w.selIndex = layout.pageSize * 3 + 1;
        const row = f.container.appendChild(f.doc.createElement("div"));
        row.id = "it" + f.w.selIndex;
        row.tabIndex = 0;
        const selected = f.w.selIndex;
        assert.equal(f.api.navigation({ id: "up" }, f.owner), true);
        assert.equal(f.doc.activeElement.dataset.modernAction, "home");
        assert.equal(f.api.navigation({ id: "down" }, f.owner), true);
        assert.equal(f.doc.activeElement, row);
        assert.equal(f.w.selIndex, selected);
        f.w.__ottKiosk.enabled = () => true;
        assert.equal(f.api.navigation({ id: "up" }, f.owner), false);
    } finally {
        f.dom.window.close();
    }
});

test("Home hero actions are reachable between the top capsule and media strip with D-pad", () => {
    const f = shellFixture();
    try {
        f.w.selIndex = 0;
        const row = f.container.appendChild(f.doc.createElement("div"));
        row.id = "it0";
        row.tabIndex = -1;
        f.w.__ottModernSelectedActions = () => [
            { id: "play", label: "Play", run: () => f.effects.push("play") },
            {
                id: "details",
                label: "Details",
                run: () => f.effects.push("details"),
            },
        ];
        f.api.prepare(f.ids, f.formatter, f.container);
        f.api.navigation({ id: "up" }, f.owner);
        assert.equal(f.doc.activeElement.dataset.modernHeroAction, "play");
        f.api.navigation({ id: "right" }, f.owner);
        assert.equal(f.doc.activeElement.dataset.modernHeroAction, "details");
        f.api.navigation({ id: "up" }, f.owner);
        assert.equal(f.doc.activeElement.dataset.modernAction, "home");
        assert.equal(f.doc.querySelectorAll(".modern-rail-selected").length, 1);
        f.api.navigation({ id: "down" }, f.owner);
        assert.equal(f.doc.activeElement.dataset.modernHeroAction, "play");
        assert.equal(f.doc.querySelectorAll(".modern-rail-selected").length, 0);
        assert.equal(f.list.classList.contains("modern-rail-focused"), false);
        f.api.navigation({ id: "down" }, f.owner);
        assert.equal(f.doc.activeElement, row);
        assert.equal(f.w.selIndex, 0);
        assert.deepEqual(f.effects, []);
    } finally {
        f.dom.window.close();
    }
});

test("Home hero direct focus clears the rail and stays clear through repeated prepare", () => {
    const f = shellFixture();
    try {
        f.w.selIndex = 0;
        const row = f.container.appendChild(f.doc.createElement("div"));
        row.id = "it0";
        row.tabIndex = -1;
        let rowFocus = 0;
        row.addEventListener("focus", () => rowFocus++);
        f.w.__ottModernSelectedActions = () => [
            { id: "play", label: "Play", run: () => f.effects.push("play") },
            {
                id: "details",
                label: "Details",
                run: () => f.effects.push("details"),
            },
        ];
        f.api.prepare(f.ids, f.formatter, f.container);
        const rail = f.doc.querySelector('[data-modern-action="home"]');
        for (const id of ["play", "details"]) {
            rail.focus();
            assert.equal(
                f.doc.querySelectorAll(".modern-rail-selected").length,
                1
            );
            assert.equal(
                f.list.classList.contains("modern-rail-focused"),
                true
            );
            const hero = f.doc.querySelector(
                `[data-modern-hero-action="${id}"]`
            );
            let heroFocus = 0;
            const onFocus = () => heroFocus++;
            hero.addEventListener("focus", onFocus);
            hero.focus();
            assert.equal(f.doc.activeElement, hero);
            assert.equal(
                f.doc.querySelectorAll(".modern-rail-selected").length,
                0
            );
            assert.equal(
                f.list.classList.contains("modern-rail-focused"),
                false
            );
            assert.equal(rail.tabIndex, 0);
            f.api.prepare(f.ids, f.formatter, f.container);
            assert.equal(f.doc.activeElement, hero);
            assert.equal(
                heroFocus,
                1,
                "retained active Hero needs no second focus event"
            );
            assert.equal(
                f.doc.querySelectorAll(".modern-rail-selected").length,
                0
            );
            assert.equal(
                f.list.classList.contains("modern-rail-focused"),
                false
            );
            hero.removeEventListener("focus", onFocus);
        }
        assert.equal(
            rowFocus,
            0,
            "Hero focus must not briefly focus a media row"
        );
        assert.equal(f.w.selIndex, 0);
        assert.deepEqual(f.effects, []);
    } finally {
        f.dom.window.close();
    }
});

test("option pages never focus a category control hidden with the catalog heading", () => {
    const f = shellFixture();
    try {
        const menu = () => "Settings";
        f.owner.model.render = menu;
        f.w.selIndex = 0;
        f.w.__ottModernActions = () => [
            {
                id: "library",
                label: "Library",
                run: () => f.effects.push("library"),
            },
            {
                id: "categories",
                label: "Categories",
                run: () => assert.fail("invisible category"),
            },
            {
                id: "settings",
                label: "Settings",
                run: () => f.effects.push("settings"),
            },
        ];
        f.api.prepare(["Settings"], menu, f.container);
        assert.equal(
            f.doc.querySelector('[data-modern-action="categories"]'),
            null
        );
        f.api.navigation({ id: "up" }, f.owner);
        f.api.navigation({ id: "right" }, f.owner);
        f.api.navigation({ id: "right" }, f.owner);
        assert.equal(f.doc.activeElement.dataset.modernAction, "settings");
        f.api.navigation({ id: "accept" }, f.owner);
        assert.deepEqual(f.effects, ["settings"]);
    } finally {
        f.dom.window.close();
    }
});

for (const type of ["live catalogue", "option list"]) {
    test(`Modern ${type} keeps Up linear across page boundaries`, () => {
        const f = shellFixture();
        try {
            const formatter = () => "Settings";
            if (type === "live catalogue")
                formatter.__ottCatalog = {
                    row: (id) => ({ channel_name: "Channel " + id }),
                };
            f.owner.model.render = formatter;
            f.w.selIndex = 0;
            const layout = f.api.prepare(f.ids, formatter, f.container);
            assert.equal(layout.grid, false);
            for (const index of [1, layout.pageSize, layout.pageSize * 2]) {
                f.w.selIndex = index;
                const row = f.container.appendChild(f.doc.createElement("div"));
                row.id = "it" + index;
                row.tabIndex = 0;
                row.focus();
                assert.equal(f.api.navigation({ id: "up" }, f.owner), false);
                assert.equal(f.doc.activeElement, row);
                assert.equal(f.w.selIndex, index);
                // The shared linear handler retains ownership of this step.
                f.w.changeSelect(-1);
                assert.equal(f.w.selIndex, index - 1);
            }
            f.w.selIndex = 0;
            assert.equal(f.api.navigation({ id: "up" }, f.owner), true);
            assert.equal(
                f.doc.activeElement.dataset.modernAction,
                type === "live catalogue" ? "library" : "browse"
            );
        } finally {
            f.dom.window.close();
        }
    });
}

test("Modern grid keeps top navigation available from a later page's first row", () => {
    const f = shellFixture();
    try {
        const layout = f.api.prepare(f.ids, f.formatter, f.container);
        assert.equal(layout.grid, true);
        const selected = layout.pageSize + layout.columns - 1;
        f.w.selIndex = selected;
        assert.equal(f.api.navigation({ id: "up" }, f.owner), true);
        assert.equal(f.doc.activeElement.dataset.modernAction, "home");
        assert.equal(f.w.selIndex, selected);
    } finally {
        f.dom.window.close();
    }
});

test("top navigation uses horizontal travel and Back returns to the same media item", () => {
    const f = shellFixture();
    try {
        f.w.selIndex = 0;
        const row = f.container.appendChild(f.doc.createElement("div"));
        row.id = "it0";
        row.tabIndex = 0;
        f.api.prepare(f.ids, f.formatter, f.container);
        assert.equal(f.api.navigation({ id: "up" }, f.owner), true);
        assert.equal(f.doc.activeElement.dataset.modernAction, "home");
        f.api.navigation({ id: "right" }, f.owner);
        assert.equal(f.doc.activeElement.dataset.modernAction, "library");
        f.api.navigation({ id: "right" }, f.owner);
        assert.equal(f.doc.activeElement.dataset.modernAction, "settings");
        f.api.navigation({ id: "accept" }, f.owner);
        assert.deepEqual(f.effects, ["settings"]);
        f.api.navigation({ id: "up" }, f.owner);
        assert.equal(f.api.navigation({ id: "back" }, f.owner), true);
        assert.equal(f.doc.activeElement, row);
        assert.equal(f.w.selIndex, 0);
        f.foreground(false);
        assert.equal(f.api.navigation({ id: "left" }, f.owner), false);
    } finally {
        f.dom.window.close();
    }
});

test("host navigation keeps contextual footer actions out of the rail", () => {
    const f = shellFixture();
    try {
        const footer = f.doc.getElementById("listPodval");
        f.api.prepare(f.ids, f.formatter, f.container);
        assert.equal(
            f.doc.querySelector('#modernRail [data-modern-action="key-123"]'),
            null
        );
        assert.equal(footer.querySelectorAll("[data-ott-key]").length, 1);
        delete f.w.__ottModernActions;
        f.api.syncScreen();
        const fallback = f.doc.querySelector(
            '#modernRail [data-modern-action="key-123"]'
        );
        assert(fallback);
        fallback.click();
        assert.deepEqual(f.effects, [123]);
    } finally {
        f.dom.window.close();
    }
});

test("rail buttons reject stale renderers, covered screens and kiosk restrictions", () => {
    const f = shellFixture();
    try {
        f.api.prepare(f.ids, f.formatter, f.container);
        const old = f.doc.querySelector('[data-modern-action="settings"]');
        const staleHandler = old.onclick;
        f.api.syncScreen();
        assert.equal(
            f.doc.querySelector('[data-modern-action="settings"]'),
            old
        );
        staleHandler(new f.w.MouseEvent("click"));
        assert.deepEqual(f.effects, []);
        const current = () =>
            f.doc.querySelector('[data-modern-action="settings"]');
        f.foreground(false);
        current().click();
        assert.deepEqual(f.effects, []);
        f.foreground(true);
        f.w.__ottKiosk.locked = () => true;
        current().click();
        assert.deepEqual(f.effects, []);
        f.w.__ottKiosk.locked = () => false;
        current().click();
        assert.deepEqual(f.effects, ["settings"]);
        f.owner.model.render = () => "Other";
        current().click();
        assert.deepEqual(f.effects, ["settings"]);
    } finally {
        f.dom.window.close();
    }
});

test("rail repaint preserves nested targets and refreshes descriptors but replaces changed owners and routes", () => {
    const f = shellFixture();
    try {
        let revision = 0;
        let disabled = false;
        let active = false;
        let ids = ["settings", "providers"];
        f.w.__ottModernActions = () =>
            ids.map((id) => ({
                active,
                disabled,
                id,
                label: id + revision,
                run: () => f.effects.push(id + revision),
            }));
        f.api.prepare(f.ids, f.formatter, f.container);
        const selector = '[data-modern-action="settings"]';
        const old = f.doc.querySelector(selector);
        const image = old.firstElementChild;
        const caption = old.lastElementChild;
        const graphic = image.firstElementChild;
        old.focus();
        f.api.syncScreen();
        assert.equal(f.doc.querySelector(selector), old);
        assert.equal(old.firstElementChild, image);
        assert.equal(image.firstElementChild, graphic);
        assert.equal(old.lastElementChild, caption);
        assert.equal(f.doc.activeElement, old);
        revision++;
        disabled = active = true;
        f.api.syncScreen();
        assert.equal(f.doc.querySelector(selector), old);
        assert.equal(old.getAttribute("aria-label"), "settings1");
        assert.equal(old.title, "settings1");
        assert.equal(caption.textContent, "settings1");
        assert.equal(old.getAttribute("aria-current"), "page");
        assert.equal(old.disabled, true);
        old.click();
        assert.deepEqual(f.effects, []);
        disabled = active = false;
        f.api.syncScreen();
        assert.equal(old.hasAttribute("aria-current"), false);
        old.click();
        assert.deepEqual(f.effects, ["settings1"]);
        ids.reverse();
        f.api.syncScreen();
        assert.equal(old.isConnected, false);
        old.click();
        assert.deepEqual(f.effects, ["settings1"]);
        const beforeOwner = f.doc.querySelector(selector);
        const nextOwner = {
            foreground: () => true,
            model: { render: f.formatter },
        };
        f.w.__ottClassicScreenPort.listOwner = () => nextOwner;
        f.api.syncScreen();
        assert.equal(beforeOwner.isConnected, false);
        beforeOwner.click();
        assert.deepEqual(f.effects, ["settings1"]);
        const removed = f.doc.querySelector(selector);
        ids = ["providers"];
        f.api.syncScreen();
        assert.equal(f.doc.querySelector(selector), null);
        removed.click();
        assert.deepEqual(f.effects, ["settings1"]);
    } finally {
        f.dom.window.close();
    }
});

test("hero repaint preserves nested targets only for the same selected item and renderer", () => {
    const f = shellFixture();
    try {
        let label = "Play";
        f.w.__ottModernSelectedActions = () => [
            {
                id: "play",
                label,
                run: () => f.effects.push(label),
            },
        ];
        f.api.prepare(f.ids, f.formatter, f.container);
        const selector = '[data-modern-hero-action="play"]';
        const old = f.doc.querySelector(selector);
        const image = old.firstElementChild;
        const caption = old.lastElementChild;
        old.focus();
        f.api.detail();
        assert.equal(f.doc.querySelector(selector), old);
        assert.equal(old.firstElementChild, image);
        assert.equal(old.lastElementChild, caption);
        assert.equal(f.doc.activeElement, old);
        label = "Open";
        f.api.detail();
        assert.equal(f.doc.querySelector(selector), old);
        assert.equal(old.getAttribute("aria-label"), label);
        assert.equal(caption.textContent, label);
        old.click();
        assert.deepEqual(f.effects, ["Open"]);
        f.w.selIndex++;
        f.api.detail();
        assert.equal(old.isConnected, false);
        old.click();
        assert.deepEqual(f.effects, ["Open"]);
        const beforeRender = f.doc.querySelector(selector);
        const render = Object.assign(() => "item", {
            __ottCatalog: f.formatter.__ottCatalog,
        });
        f.owner.model.render = render;
        f.api.prepare(f.ids, render, f.container);
        assert.equal(beforeRender.isConnected, false);
        beforeRender.click();
        assert.deepEqual(f.effects, ["Open"]);
    } finally {
        f.dom.window.close();
    }
});

test("settings and empty catalogues retain Modern navigation without stale selected media", () => {
    const f = shellFixture();
    try {
        f.api.prepare(f.ids, f.formatter, f.container);
        const render = () => "Settings";
        f.owner.model.render = render;
        f.api.prepare([{ name: "First setting" }], render, f.container);
        assert(f.list.classList.contains("modern-screen-menu"));
        assert(!f.list.classList.contains("modern-screen-grid"));
        assert.equal(f.doc.getElementById("modernHero").hidden, true);
        f.owner.model.render = f.formatter;
        f.api.prepare([], f.formatter, f.container);
        assert.equal(f.doc.getElementById("modernHero").hidden, true);
        assert.equal(
            f.doc.querySelector(".modern-library-count").textContent,
            ""
        );
    } finally {
        f.dom.window.close();
    }
});

test("empty or unprojectable catalogues expose the original status detail until media arrives", () => {
    const f = shellFixture();
    try {
        const detail = f.doc.getElementById("listDetail");
        const message = detail.appendChild(f.doc.createElement("p"));
        const retry = detail.appendChild(f.doc.createElement("button"));
        let retried = 0;
        retry.onclick = () => retried++;
        for (const status of [
            "Loading...",
            "Not found",
            "Failed to load!",
            "Not configured",
        ]) {
            message.textContent = status;
            f.api.prepare([], f.formatter, f.container);
            assert(f.list.classList.contains("modern-empty"));
            assert.equal(f.doc.getElementById("modernHero").hidden, true);
            assert.equal(detail.firstChild, message);
            assert.equal(detail.textContent, status);
            assert.equal(detail.lastChild, retry);
        }
        retry.click();
        assert.equal(retried, 1);
        const row = f.formatter.__ottCatalog.row;
        f.formatter.__ottCatalog.row = () => null;
        f.w.selIndex = 0;
        f.api.prepare(["unavailable"], f.formatter, f.container);
        assert(f.list.classList.contains("modern-empty"));
        f.formatter.__ottCatalog.row = row;
        f.api.prepare(f.ids, f.formatter, f.container);
        assert(!f.list.classList.contains("modern-empty"));
        assert.equal(f.doc.getElementById("modernHero").hidden, false);
        f.api.prepare([], f.formatter, f.container);
        const menu = () => "Settings";
        f.owner.model.render = menu;
        f.api.prepare([], menu, f.container);
        assert(!f.list.classList.contains("modern-empty"));
        f.owner.model.render = f.formatter;
        f.api.prepare([], f.formatter, f.container);
        f.w.settings.interfaceMode = 0;
        f.api.refresh();
        assert(!f.list.classList.contains("modern-empty"));
    } finally {
        f.dom.window.close();
    }
});

test("existing media controls keep their callbacks and are exposed without copying their DOM", () => {
    const f = shellFixture();
    try {
        f.api.prepare(f.ids, f.formatter, f.container);
        const detail = f.doc.getElementById("listDetail");
        const controls = detail.appendChild(f.doc.createElement("div"));
        controls.id = "mediaPlaybackControls";
        const button = controls.appendChild(f.doc.createElement("span"));
        button.setAttribute("data-ott-key", "13");
        let calls = 0;
        button.onclick = () => calls++;
        f.api.detail();
        assert(f.list.classList.contains("modern-has-controls"));
        assert.equal(
            f.doc.querySelectorAll("#mediaPlaybackControls").length,
            1
        );
        assert.equal(controls.parentNode, detail);
        button.click();
        assert.equal(calls, 1);
        controls.remove();
        f.api.detail();
        assert(!f.list.classList.contains("modern-has-controls"));
    } finally {
        f.dom.window.close();
    }
});

test("menu Library action uses the host route and cannot double fire on keyboard Enter", () => {
    const f = shellFixture();
    try {
        f.w.__ottModernActions = () => [
            {
                id: "library",
                label: "Library",
                run: () => f.effects.push("library"),
            },
        ];
        const menu = () => "Settings";
        f.owner.model.render = menu;
        f.api.prepare(["Settings"], menu, f.container);
        assert.equal(
            f.doc.querySelector('[data-modern-action="browse"]'),
            null
        );
        const button = f.doc.querySelector('[data-modern-action="library"]');
        const event = new f.w.KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key: "Enter",
        });
        button.dispatchEvent(event);
        assert.equal(event.defaultPrevented, true);
        assert.deepEqual(f.effects, ["library"]);
    } finally {
        f.dom.window.close();
    }
});

test("Modern option pages fit larger measured rows while preserving the original formatter and controls", () => {
    const f = shellFixture();
    try {
        const render = () => '<span class="original">Setting value</span>';
        f.owner.model.render = render;
        const rows = Array.from({ length: 30 }, (_, index) => ({
            name: "Setting " + index,
        }));
        const layout = f.api.prepare(rows, render, f.container);
        assert.equal(layout.menu, true);
        assert.equal(layout.columns, 1);
        assert(layout.pageSize > 0 && layout.pageSize <= 12);
        assert(layout.cellHeight >= 50);
        const row = f.container.appendChild(f.doc.createElement("div"));
        row.id = "it0";
        const button = row.appendChild(f.doc.createElement("button"));
        button.textContent = "Original action";
        let calls = 0;
        button.onclick = () => calls++;
        f.api.decorate(f.container, 0, 1);
        assert(row.classList.contains("modern-option"));
        assert.equal(f.api.render(rows[0], 0), null);
        assert.equal(row.firstChild, button);
        button.click();
        assert.equal(calls, 1);
        assert.equal(f.api.navigation({ id: "down" }, f.owner), false);
        assert.equal(f.doc.getElementById("modernHero").hidden, true);
    } finally {
        f.dom.window.close();
    }
});

test("Modern host navigation uses shared routing and rejects stale or covered actions", () => {
    const output = ts.transpileModule(
        fs.readFileSync(path.join(root, "src/ui/modern-actions.ts"), "utf8"),
        { compilerOptions: { module: ts.ModuleKind.CommonJS } }
    ).outputText;
    const context = { exports: {} };
    require("node:vm").runInNewContext(output, context);
    const calls = [];
    let foreground = true;
    let locked = false;
    let providers = true;
    let owner = { foreground: () => foreground };
    const host = {
        _: (value) => value,
        __ottActiveProviderDriver: {
            catalogBrowser: {
                restore: () => {
                    calls.push("library");
                    return true;
                },
            },
        },
        __ottChannelSearch: { open: () => calls.push("search") },
        __ottChannels: { browsingIndex: () => 3 },
        __ottClassicScreenPort: { listOwner: () => owner },
        __ottKiosk: { locked: () => locked },
        bucketsList: (index) => calls.push("category:" + index),
        openGlobalFavorites: () => calls.push("favorites"),
    };
    const get = context.exports.createModernActions(host, {
        providers: () => calls.push("providers"),
        providersAvailable: () => providers,
        settings: () => calls.push("settings"),
    });
    const actions = get();
    assert.equal(host.__ottGlobalFavorites, undefined);
    assert(actions.some((action) => action.id === "favorites"));
    for (const action of actions) action.run();
    assert.deepEqual(calls, [
        "library",
        "favorites",
        "category:3",
        "search",
        "providers",
        "settings",
    ]);
    calls.length = 0;
    foreground = false;
    for (const action of actions) action.run();
    assert.equal(get().length, 0);
    foreground = true;
    owner = { foreground: () => true };
    for (const action of actions) action.run();
    assert.deepEqual(calls, []);
    providers = false;
    assert.equal(
        get().some((action) => action.id === "providers"),
        false
    );
    locked = true;
    assert.equal(get().length, 0);
});

function installSharedMetadataRenderer(w) {
    const declarations = [];
    for (const [file, names] of [
        [
            "src/utils/helpers.ts",
            ["metadataText", "metadataImageUrl", "metadataHtml"],
        ],
        ["src/channels/index.ts", ["getMediaDescr"]],
    ]) {
        const source = ts.createSourceFile(
            file,
            fs.readFileSync(path.join(root, file), "utf8"),
            ts.ScriptTarget.Latest,
            true
        );
        for (const name of names) {
            const declaration = source.statements.find(
                (node) =>
                    ts.isFunctionDeclaration(node) && node.name?.text === name
            );
            assert(declaration, name);
            declarations.push(
                declaration.getText(source).replace(/^export\s+/, "")
            );
        }
    }
    w.eval(
        ts.transpileModule(declarations.join("\n"), {
            compilerOptions: {
                module: ts.ModuleKind.None,
                target: ts.ScriptTarget.ES5,
            },
        }).outputText
    );
}

test("Modern shows the source-owned synopsis while keeping full metadata intact", () => {
    const f = shellFixture();
    try {
        installSharedMetadataRenderer(f.w);
        const prefix = "<b>Film</b><br>2026<br>118<br>";
        const plot = "The actual plot &amp; its next sentence. &lt;literal&gt;";
        const media = {
            __ottMediaSynopsisOffset: prefix.length,
            description: prefix + plot,
        };
        f.w.selIndex = 0;
        f.formatter.__ottCatalog.row = () => ({
            __ottMediaItem: media,
            channel_name: "Film",
        });
        f.api.prepare(["film"], f.formatter, f.container);
        const summary = f.doc.querySelector(".modern-hero-summary");
        assert.equal(
            summary.textContent,
            "The actual plot & its next sentence. <literal>"
        );
        assert.equal(
            media.description,
            prefix + plot,
            "Details still has the entire source description"
        );
        media.__ottMediaSynopsisOffset = -1;
        f.api.detail();
        assert.equal(
            summary.textContent,
            "",
            "missing synopsis does not repeat title/year/duration"
        );
        for (const invalid of [
            -2,
            0.5,
            Infinity,
            media.description.length + 1,
        ]) {
            media.__ottMediaSynopsisOffset = invalid;
            f.api.detail();
            assert(
                summary.textContent.startsWith("Film2026118"),
                "invalid metadata preserves the safe full-description fallback"
            );
        }
    } finally {
        f.dom.window.close();
    }
});

test("Modern VPortal descriptions preserve shared safe formatting and entities", () => {
    const f = shellFixture();
    try {
        installSharedMetadataRenderer(f.w);
        f.w.selIndex = 0;
        f.formatter.__ottCatalog.row = () => ({
            __ottMediaItem: {
                description:
                    '<b onclick="window.changed=1">A &amp; B</b><br>2025<br/>118<br />A complete description. &lt;literal&gt;<script>window.changed=1</script><style>body{display:none}</style><img src="javascript:alert(1)" onerror="window.changed=1">',
            },
            channel_name: "A film",
        });
        f.api.prepare(["film"], f.formatter, f.container);
        const summary = f.doc.querySelector(".modern-hero-summary");
        assert.equal(summary.querySelector("b").textContent, "A & B");
        assert.equal(summary.querySelectorAll("br").length, 3);
        assert(
            summary.textContent.includes("A complete description. <literal>")
        );
        assert(!summary.textContent.includes("<br"));
        assert.equal(
            summary.querySelectorAll("script,style,img,[onclick],[onerror]")
                .length,
            0
        );
        assert.equal(f.w.changed, undefined);
        const first = summary.firstChild;
        f.api.detail();
        assert.equal(
            summary.firstChild,
            first,
            "unchanged metadata must not rebuild its DOM"
        );
    } finally {
        f.dom.window.close();
    }
});

test("Modern resolves lazy descriptions only for the selected hero, not every rendered card", () => {
    const f = shellFixture();
    try {
        installSharedMetadataRenderer(f.w);
        let calls = 0;
        f.w.selIndex = 0;
        f.formatter.__ottCatalog.row = () => ({
            __ottMediaItem: {
                description: () => {
                    calls++;
                    return "<b>First</b><br>Second";
                },
            },
            channel_name: "Film",
        });
        f.api.prepare(["first", "second"], f.formatter, f.container);
        assert.equal(
            f.doc.querySelector(".modern-hero-summary b").textContent,
            "First"
        );
        assert(calls > 0);
        const selectedCalls = calls;
        f.api.render("first", 0);
        f.api.render("second", 1);
        assert.equal(calls, selectedCalls);
    } finally {
        f.dom.window.close();
    }
});

test("Modern metadata without the shared renderer remains safely escaped", () => {
    const f = shellFixture();
    try {
        delete f.w.getMediaDescr;
        f.w.selIndex = 0;
        f.formatter.__ottCatalog.row = () => ({
            __ottMediaItem: {
                description: '<img src=x onerror="window.changed=1">',
            },
            channel_name: "Film",
        });
        f.api.prepare(["film"], f.formatter, f.container);
        const summary = f.doc.querySelector(".modern-hero-summary");
        assert.equal(summary.querySelector("img"), null);
        assert.equal(
            summary.textContent,
            '<img src=x onerror="window.changed=1">'
        );
        assert.equal(f.w.changed, undefined);
    } finally {
        f.dom.window.close();
    }
});

test("Modern fallback summary keeps quoted untrusted text and its text node across refresh", () => {
    const f = shellFixture();
    try {
        delete f.w.getMediaDescr;
        f.w.selIndex = 0;
        const description =
            'A "quoted" plot & <img src=x onerror="window.changed=1">';
        f.formatter.__ottCatalog.row = () => ({
            __ottMediaItem: { description },
            channel_name: "Film",
        });
        f.api.prepare(["film"], f.formatter, f.container);
        const summary = f.doc.querySelector(".modern-hero-summary");
        const originalText = summary.firstChild;
        assert.equal(summary.textContent, description);
        assert.equal(originalText.nodeType, f.w.Node.TEXT_NODE);
        for (let index = 0; index < 3; index++) {
            f.api.refresh();
            assert.equal(summary.firstChild, originalText);
        }
        assert.equal(summary.querySelector("img"), null);
        assert.equal(f.w.changed, undefined);
    } finally {
        f.dom.window.close();
    }
});

function categoryShelfFixture(large = false, normal = false, options = {}) {
    const f = shellFixture();
    const groups = [
        {
            id: "first",
            members: Array.from(
                { length: large ? 10000 : 8 },
                (_, i) => "first-" + i
            ),
            name: "First category",
        },
        { id: "empty", members: [], name: "Empty category" },
        { id: "short", members: ["first-0"], name: "Short category" },
        {
            id: "third",
            members: Array.from({ length: 6 }, (_, i) => "third-" + i),
            name: "Third category",
        },
    ];
    const state = {
        covered: false,
        focus: [],
        formatter: null,
        layout: null,
        memberReads: 0,
        metadataReads: 0,
        now: 1000,
        owner: null,
        selected: "first",
        source: {},
    };
    if (normal) {
        const source = { active: () => state.source === source, groups };
        state.source = source;
        f.w.channelsKeyHandler = () => {};
        f.w.__ottChannels = {
            index: (id) => groups.findIndex((group) => group.id === id),
            remoteCatalog: () => state.source,
        };
        f.w.catsArray = groups.map((group) => group.name);
        f.w.cats = Object.fromEntries(
            groups.map((group) => [group.name, group.members])
        );
        f.w.channelsList = (index, position) => {
            state.focus.push([groups[index].id, position]);
            mount(groups[index].id, position);
        };
    }
    if (large)
        groups[0].members = new Proxy(groups[0].members, {
            get(target, key, receiver) {
                if (typeof key === "string" && /^\d+$/.test(key))
                    state.memberReads++;
                return Reflect.get(target, key, receiver);
            },
        });
    f.w.Date.now = () => state.now;
    f.w.keys = { ENTER: 13 };
    f.w.__ottClassicScreenPort.listOwner = () => state.owner;
    f.w._doKey = (key) =>
        f.effects.push([
            key,
            state.selected,
            f.w.selIndex,
            f.w.listArray[f.w.selIndex],
        ]);
    function repaint() {
        f.container.textContent = "";
        state.layout = f.api.prepare(
            f.w.listArray,
            state.formatter,
            f.container
        );
        if (state.layout?.shelves) f.api.paintShelves(f.container, state.owner);
    }
    function mount(groupId, index) {
        const group = groups.find((entry) => entry.id === groupId);
        const owner = {
            foreground: () => state.owner === owner && !state.covered,
            model: {},
        };
        const formatter = (id, index) =>
            options.format ? options.format(id, index, f.w) : "Classic item";
        state.owner = owner;
        state.formatter = formatter;
        state.selected = groupId;
        formatter.__ottCatalog = {
            kind: "catalog",
            row(id) {
                state.metadataReads++;
                if (options.row) return options.row(id);
                return {
                    __ottMediaItem: {
                        description: "Shared description",
                        name: id,
                    },
                    channel_name: id,
                };
            },
            shelves: {
                focus(id, position) {
                    if (!owner.foreground() || state.formatter !== formatter)
                        return false;
                    state.focus.push([id, position]);
                    mount(id, position);
                    return true;
                },
                groups,
                selected: groupId,
                source: state.source,
            },
        };
        if (normal) {
            formatter.__ottCatalog.categoryIndex = groups.indexOf(group);
            formatter.__ottCatalog.channelSource = state.source;
            delete formatter.__ottCatalog.shelves;
        }
        owner.model.render = formatter;
        if (normal) {
            owner.model.items = owner.model.rows = group.members;
            owner.model.handler = f.w.listKeyHandler = f.w.channelsKeyHandler;
            f.w.listCatIndex = groups.indexOf(group);
        }
        f.w.getListItemFn = formatter;
        f.w.listArray = f.w.listDataArray = group.members;
        f.w.selIndex = index;
        repaint();
    }
    f.w.showPage = repaint;
    mount("first", 0);
    return {
        ...f,
        groups,
        key: (id, owner = state.owner) => f.api.navigation({ id }, owner),
        mount,
        pointer(groupId, position, activate = false) {
            const card = f.container.querySelector(
                '[data-modern-shelf="' +
                    groupId +
                    '"][data-modern-position="' +
                    position +
                    '"]'
            );
            assert(card, "the requested shelf occurrence is mounted");
            const event = new f.w.MouseEvent("click", { cancelable: true });
            Object.defineProperty(event, "target", {
                value: card.querySelector(".modern-title") || card,
            });
            assert.equal(f.api.shelfPointer(event, activate), true);
            assert.equal(event.defaultPrevented, true);
            return card;
        },
        repaint,
        state,
        wheel(deltaY, extras = {}) {
            state.now += 200;
            const event = new f.w.WheelEvent("wheel", {
                cancelable: true,
                deltaY,
                ...extras,
            });
            const handled = f.api.shelfWheel(event);
            return { handled, prevented: event.defaultPrevented };
        },
    };
}

test("category shelves mark every playing occurrence including inactive rows and clear on repaint", () => {
    const f = categoryShelfFixture();
    try {
        let playing = "first-0";
        f.state.formatter.__ottCatalog.playing = (id) => id === playing;
        f.repaint();
        const playingCards = () => [
            ...f.container.querySelectorAll(".ott-playing"),
        ];
        assert.deepEqual(
            playingCards().map((card) =>
                card.getAttribute("data-modern-shelf")
            ),
            ["first", "short"]
        );
        assert.equal(playingCards()[1].classList.contains("item"), false);
        playing = "first-1";
        f.repaint();
        assert.equal(playingCards().length, 1);
        assert.equal(
            playingCards()[0].getAttribute("data-modern-position"),
            "1"
        );
        playing = null;
        f.repaint();
        assert.equal(playingCards().length, 0);
        assert.deepEqual(f.effects, []);
    } finally {
        f.dom.window.close();
    }
});

function liveShelfFixture() {
    const channels = Object.fromEntries(
        Array.from({ length: 8 }, (_, index) => {
            const id = "first-" + index;
            return [
                id,
                index === 1
                    ? { channel_name: "Live station" }
                    : { __ottMediaItem: { name: id }, channel_name: id },
            ];
        })
    );
    const formatted = [],
        details = [];
    const f = categoryShelfFixture(false, false, {
        format(id, index, host) {
            formatted.push([id, index]);
            if (!channels[id]?.__ottMediaItem)
                host.__ottClassicGuide?.current(id, host.updateChannelListRow);
            return "Host row";
        },
        row: (id) => channels[id],
    });
    f.groups[2].members[0] = "first-1";
    const timers = new Map(),
        requests = [];
    let nextTimer = 0;
    f.state.now = 100000;
    Object.assign(f.w, {
        channels,
        clearTimeout: (id) => timers.delete(id),
        epgCacheCapacity: 8,
        fetchChannelGuide(id, done) {
            requests.push({ done, id });
            return () => {};
        },
        p_pref: "mixed-source",
        setTimeout(callback, delay) {
            const id = ++nextTimer;
            timers.set(id, { at: f.state.now + delay, callback });
            return id;
        },
        updateChannelListRow: (id) => details.push(id),
    });
    require("./helpers/shared-core-runtime.cjs")(f.dom.getInternalVMContext(), {
        vendorOnly: true,
    });
    const runtime = require("./helpers/private-runtime.cjs");
    runtime(f.dom.getInternalVMContext(), "src/guide/service.ts");
    runtime(f.dom.getInternalVMContext(), "src/guide/classic-service.ts");
    f.repaint();
    return {
        ...f,
        channels,
        details,
        flush() {
            for (let count = 0; count < 100; count++) {
                const due = [...timers].find(
                    ([, timer]) => timer.at <= f.state.now
                );
                if (!due) return;
                timers.delete(due[0]);
                due[1].callback();
            }
            assert.fail("guide callbacks did not settle");
        },
        formatted,
        programme: () => [...f.container.querySelectorAll(".modern-programme")],
        publish(name = 'News <img src=x onerror="window.changed=1">') {
            f.w.__ottClassicGuide.publish("first-1", [
                { name, time: 90, time_to: 110 },
            ]);
        },
        requests,
    };
}

test("live shelf cards retain the host formatter and update duplicate occurrences through the real guide", () => {
    const f = liveShelfFixture();
    try {
        f.flush();
        assert.equal(
            f.requests.length,
            1,
            "duplicate live cards share one owned guide request"
        );
        assert.equal(f.requests[0].id, "first-1");
        assert.equal(f.programme().length, 2);
        assert.equal(
            new Set(
                [...f.container.querySelectorAll("[id]")].map((node) => node.id)
            ).size,
            f.container.querySelectorAll("[id]").length
        );
        assert(
            f.formatted.some(([id]) => id === "first-0"),
            "mounted media still uses the host formatter contract"
        );
        f.details.length = 0;
        f.publish();
        f.flush();
        assert.deepEqual(
            f.programme().map((node) => node.textContent),
            [
                'News <img src=x onerror="window.changed=1">',
                'News <img src=x onerror="window.changed=1">',
            ]
        );
        assert.deepEqual(
            [...f.container.querySelectorAll(".modern-progress > span")].map(
                (node) => node.style.width
            ),
            ["50%", "50%"]
        );
        assert.deepEqual(
            f.details,
            ["first-1"],
            "one host detail refresh per shared guide publication"
        );
        assert.equal(f.container.querySelector(".modern-programme img"), null);
        assert.equal(f.w.changed, undefined);
        const old = f.programme();
        f.w.__ottClassicGuide.cancelConsumers();
        f.repaint();
        f.publish("Updated programme");
        f.flush();
        assert.deepEqual(
            f.programme().map((node) => node.textContent),
            ["Updated programme", "Updated programme"]
        );
        assert(
            old.every(
                (node) =>
                    !node.isConnected && node.textContent.startsWith("News")
            )
        );
        assert.equal(
            f.requests.length,
            1,
            "warm repaint does not refetch the same schedule"
        );
        f.w._ = (value) =>
            value === "no epg at current time" ? "No current schedule" : value;
        f.w.__ottClassicGuide.publish("first-1", []);
        f.flush();
        assert.deepEqual(
            f.programme().map((node) => node.textContent),
            ["No current schedule", "No current schedule"]
        );
        assert.deepEqual(
            [...f.container.querySelectorAll(".modern-progress > span")].map(
                (node) => node.style.width
            ),
            ["0%", "0%"]
        );
        assert.deepEqual(f.effects, []);
    } finally {
        f.dom.window.close();
    }
});

for (const guard of ["source", "owner", "formatter", "channel", "classic"]) {
    test("live shelf guide callback rejects retired " + guard, () => {
        const f = liveShelfFixture();
        try {
            f.flush();
            f.publish("Before retirement");
            f.flush();
            f.details.length = 0;
            f.publish("Queued after retirement");
            if (guard === "source")
                f.state.formatter.__ottCatalog.shelves.source = {};
            else if (guard === "owner") f.state.covered = true;
            else if (guard === "formatter")
                f.state.owner.model.render = () => "Replacement";
            else if (guard === "channel")
                f.channels["first-1"] = { channel_name: "Replacement" };
            else f.w.settings.interfaceMode = 0;
            f.flush();
            assert.deepEqual(
                f.programme().map((node) => node.textContent),
                ["Before retirement", "Before retirement"]
            );
            assert.deepEqual(f.details, []);
        } finally {
            f.dom.window.close();
        }
    });
}

test("channel shelves resolve the captured category index before filtering empty groups", () => {
    const f = categoryShelfFixture(false, true);
    try {
        assert.equal(f.state.layout.shelves, true);
        assert.equal(f.state.formatter.__ottCatalog.categoryIndex, 0);
        assert.equal(f.key("down"), true);
        assert.equal(f.state.selected, "short");
        assert.equal(f.state.formatter.__ottCatalog.categoryIndex, 2);
        assert.equal(f.key("down"), true);
        assert.equal(f.state.selected, "third");
        assert.equal(f.state.formatter.__ottCatalog.categoryIndex, 3);
        assert.deepEqual(
            f.effects,
            [],
            "category focus does not start playback"
        );
    } finally {
        f.dom.window.close();
    }
});

test("category shelves traverse actual groups and restore each row cursor across replaced owners", () => {
    const f = categoryShelfFixture();
    try {
        assert.equal(f.state.layout.shelves, true);
        assert(!f.container.textContent.includes("Empty category"));
        const initialOwner = f.state.owner;
        for (let i = 0; i < 7; i++) assert.equal(f.key("right"), true);
        assert.equal(f.w.selIndex, 7);
        assert.equal(f.key("right"), true);
        assert.equal(
            f.w.selIndex,
            7,
            "Right clamps without crossing categories"
        );
        assert.equal(f.key("down"), true);
        assert.equal(f.state.selected, "short");
        assert.equal(f.w.selIndex, 0);
        assert.notEqual(f.state.owner, initialOwner);
        f.key("right");
        assert.equal(f.w.selIndex, 0, "a one-item row cannot wrap");
        f.key("next");
        assert.equal(f.state.selected, "third");
        f.key("right");
        f.key("right");
        f.key("down");
        assert.equal(
            f.state.selected,
            "third",
            "bottom navigation is consumed"
        );
        assert.equal(f.w.selIndex, 2);
        f.key("previous");
        f.key("up");
        assert.equal(f.state.selected, "first");
        assert.equal(f.w.selIndex, 7);
        f.key("down");
        f.key("down");
        assert.equal(f.w.selIndex, 2, "each category retains its own cursor");
        assert.equal(f.key("left", initialOwner), false);
        assert.equal(
            f.w.selIndex,
            2,
            "retired owners cannot move the current row"
        );
        assert.deepEqual(f.effects, [], "navigation never activates playback");
        assert.equal(f.doc.activeElement.id, "it2");
    } finally {
        f.dom.window.close();
    }
});

test("category shelves bound 10000-item DOM and metadata reads without copying memberships", () => {
    const f = categoryShelfFixture(true);
    try {
        const members = f.groups[0].members;
        assert.equal(f.w.listArray, members);
        f.state.metadataReads = 0;
        f.state.memberReads = 0;
        f.repaint();
        const cards = f.container.querySelectorAll(".modern-card").length;
        assert(cards > 0 && cards <= 24);
        assert(
            f.state.metadataReads <= 32,
            "repaint only projects mounted cards and the hero"
        );
        assert(
            f.state.memberReads <= 64,
            "repaint cannot copy or scan all category members"
        );
        assert.equal(f.w.listArray, members);
        assert.equal(members.length, 10000);
        assert.equal(
            new Set(
                Array.from(
                    f.container.querySelectorAll("[id]"),
                    (node) => node.id
                )
            ).size,
            f.container.querySelectorAll("[id]").length
        );
        f.mount("first", 9999);
        assert(f.container.querySelector("#it9999"));
        assert(f.container.querySelectorAll(".modern-card").length <= 24);
        assert.equal(f.key("right"), true);
        assert.equal(f.w.selIndex, 9999);
    } finally {
        f.dom.window.close();
    }
});

test("category shelf wheel moves rows, accumulates small deltas and consumes boundaries", () => {
    const f = categoryShelfFixture();
    try {
        assert.deepEqual(f.wheel(-120), { handled: true, prevented: true });
        assert.equal(f.state.selected, "first");
        f.state.now += 10000;
        assert.deepEqual(f.wheel(10), { handled: true, prevented: true });
        f.wheel(10);
        assert.equal(f.state.selected, "first");
        f.wheel(10);
        assert.equal(f.state.selected, "short");
        const immediate = new f.w.WheelEvent("wheel", {
            cancelable: true,
            deltaY: 120,
        });
        assert.equal(f.api.shelfWheel(immediate), true);
        assert.equal(
            f.state.selected,
            "short",
            "one wheel burst cannot skip rows"
        );
        f.wheel(2, { deltaMode: 1 });
        assert.equal(f.state.selected, "third");
        f.wheel(120);
        assert.equal(f.state.selected, "third");
        f.wheel(-120);
        assert.equal(f.state.selected, "short");
        assert.deepEqual(f.effects, []);
    } finally {
        f.dom.window.close();
    }
});

test("category shelf pointer selects the exact duplicate occurrence and Enter activates it once", () => {
    const f = categoryShelfFixture();
    try {
        const old = f.pointer("short", 0);
        assert.equal(f.state.selected, "short");
        assert.equal(f.w.listArray[0], "first-0");
        assert.deepEqual(f.effects, [], "first desktop click only selects");
        assert.equal(old.isConnected, false);
        const stale = new f.w.MouseEvent("click", { cancelable: true });
        Object.defineProperty(stale, "target", { value: old });
        assert.equal(f.api.shelfPointer(stale, true), true);
        assert.deepEqual(f.effects, [], "detached occurrence cannot activate");
        f.pointer("short", 0, true);
        assert.deepEqual(f.effects, [[13, "short", 0, "first-0"]]);
        assert.equal(f.doc.activeElement.id, "it0");
    } finally {
        f.dom.window.close();
    }
});

for (const guard of ["modal", "locked", "enabled", "source", "formatter"]) {
    test(
        "category shelf pointer and wheel reject " + guard + " ownership",
        () => {
            const f = categoryShelfFixture();
            try {
                if (guard === "modal") f.state.covered = true;
                else if (guard === "source")
                    f.state.formatter.__ottCatalog.shelves.source = {};
                else if (guard === "formatter")
                    f.state.owner.model.render = () => "replacement";
                else f.w.__ottKiosk[guard] = () => true;
                f.pointer("short", 0, true);
                assert.deepEqual(f.wheel(120), {
                    handled: true,
                    prevented: true,
                });
                assert.equal(f.state.selected, "first");
                assert.equal(f.w.selIndex, 0);
                assert.deepEqual(f.state.focus, []);
                assert.deepEqual(f.effects, []);
            } finally {
                f.dom.window.close();
            }
        }
    );
}

test("category shelves restore their selection through Library and Classic without host routing", () => {
    const f = categoryShelfFixture();
    try {
        f.key("right");
        f.key("right");
        const members = f.w.listArray;
        const owner = f.state.owner;
        const focused = f.state.focus.length;
        f.doc.querySelector('[data-modern-action="library"]').click();
        assert.equal(f.state.layout.shelves, false);
        assert.equal(f.api.paintShelves(f.container, owner), false);
        assert.equal(f.api.shelfWheel(new f.w.WheelEvent("wheel")), false);
        f.doc.querySelector('[data-modern-action="home"]').click();
        assert.equal(f.state.layout.shelves, true);
        assert(f.container.querySelector("#it2"));
        assert.equal(f.w.listArray, members);
        assert.equal(f.state.owner, owner);
        assert.equal(f.state.focus.length, focused);
        f.w.settings.interfaceMode = 0;
        f.api.refresh();
        assert.equal(f.api.shelfWheel(new f.w.WheelEvent("wheel")), false);
        assert.equal(f.doc.getElementById("modernShell"), null);
        assert.equal(f.w.selIndex, 2);
        assert.equal(f.w.listArray, members);
        assert.equal(f.state.focus.length, focused);
        assert.deepEqual(f.effects, []);
    } finally {
        f.dom.window.close();
    }
});

test("category shelf capture precedes Classic row input and detaches when Classic returns", () => {
    const f = categoryShelfFixture();
    try {
        let legacy = 0;
        const count = () => legacy++;
        f.container.addEventListener("click", count, true);
        f.container.addEventListener("keydown", count, true);
        f.w.ott_device = "lg/webos";
        f.container.querySelector('[data-modern-shelf="short"]').click();
        assert.deepEqual(f.effects, [[13, "short", 0, "first-0"]]);
        assert.equal(
            legacy,
            0,
            "LG pointer activation cannot reach Classic capture"
        );
        f.w.ott_device = "pc";
        f.doc.getElementById("it0").dispatchEvent(
            new f.w.KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key: "Enter",
                keyCode: 13,
            })
        );
        assert.equal(f.effects.length, 2, "Enter dispatches exactly once");
        assert.equal(legacy, 0);
        f.w.settings.interfaceMode = 0;
        f.api.refresh();
        f.container.appendChild(f.doc.createElement("button")).click();
        assert.equal(legacy, 1, "Classic input keeps its original route");
    } finally {
        f.dom.window.close();
    }
});
