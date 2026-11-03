const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const { JSDOM } = require("jsdom");
const ts = require("typescript");

const moduleContext = { window: {} };
vm.runInNewContext(
    ts.transpileModule(
        fs.readFileSync(path.join(__dirname, "../src/ui/modern.ts"), "utf8"),
        { compilerOptions: { module: ts.ModuleKind.CommonJS } }
    ).outputText,
    moduleContext
);
const { createModernSelectedActions } = moduleContext;

function fixture(media = false) {
    const dom = new JSDOM('<footer id="listPodval"></footer>');
    const render = () => "";
    if (media) render.__ottMediaRows = true;
    else render.__ottCatalog = { row: () => ({ channel_name: "One" }) };
    const model = {
        focus: 0,
        items: [media ? { title: "One" } : "one"],
        render,
    };
    model.rows = model.items;
    const state = { enabled: false, foreground: true, locked: false };
    const owner = { foreground: () => state.foreground, model };
    state.owner = owner;
    const calls = [];
    const host = {
        _: (value) => "translated:" + value,
        __ottClassicScreenPort: { listOwner: () => state.owner },
        __ottKiosk: {
            enabled: () => state.enabled,
            locked: () => state.locked,
        },
        _doKey: (key) => calls.push(key),
        document: dom.window.document,
        keys: { ENTER: 13, INFO: 457, N2: 50 },
    };
    return {
        actions: createModernSelectedActions(host),
        calls,
        dom,
        hint(key) {
            host.document.getElementById("listPodval").innerHTML =
                `<span data-ott-key="${key}">Description</span>`;
        },
        host,
        model,
        state,
    };
}

test("selected actions use owned model without legacy window aliases", () => {
    const f = fixture();
    try {
        f.hint(50);
        const actions = f.actions();
        assert.deepEqual(
            Array.from(actions, (action) => action.id),
            ["play", "details"]
        );
        assert.equal(actions[0].label, "translated:Play");
        assert.equal(actions[1].label, "translated:Description");
        for (const action of actions) action.run();
        assert.deepEqual(f.calls, [13, 50]);
        assert.equal(f.host.selIndex, undefined);
        assert.equal(f.host.getListItemFn, undefined);
    } finally {
        f.dom.window.close();
    }
});

test("folders open through ENTER and details require an advertised exact key", () => {
    const f = fixture(true);
    try {
        f.model.items[0].playlist_url = { path: "/children" };
        f.hint(51);
        let actions = f.actions();
        assert.equal(actions.length, 1);
        assert.equal(actions[0].label, "translated:Open");
        actions[0].run();
        f.hint(457);
        actions = f.actions();
        actions[1].run();
        f.hint(50);
        actions[1].run(); // A stale advertised action is no longer valid.
        assert.deepEqual(f.calls, [13, 457]);
    } finally {
        f.dom.window.close();
    }
});

for (const [name, invalidate] of [
    [
        "covered screen",
        (f) => {
            f.state.foreground = false;
        },
    ],
    [
        "replaced owner",
        (f) => {
            f.state.owner = { foreground: () => true, model: f.model };
        },
    ],
    [
        "changed selection",
        (f) => {
            f.model.focus = 1;
        },
    ],
    [
        "replaced rows",
        (f) => {
            f.model.rows = f.model.items.slice();
        },
    ],
    [
        "replaced selected item",
        (f) => {
            f.model.items[0] = "replacement";
        },
    ],
    [
        "replaced renderer",
        (f) => {
            f.model.render = () => "";
        },
    ],
    [
        "locked kiosk",
        (f) => {
            f.state.locked = true;
        },
    ],
    [
        "enabled kiosk",
        (f) => {
            f.state.enabled = true;
        },
    ],
]) {
    test(`captured actions reject ${name}`, () => {
        const f = fixture();
        try {
            f.hint(50);
            const actions = f.actions();
            invalidate(f);
            for (const action of actions) action.run();
            assert.deepEqual(f.calls, []);
        } finally {
            f.dom.window.close();
        }
    });
}

test("menus, empty catalogues and invalid selection expose no selected actions", () => {
    const f = fixture();
    try {
        for (const index of [-1, 1, 0.5, NaN, "0", undefined]) {
            f.model.focus = index;
            assert.equal(f.actions().length, 0);
        }
        f.model.focus = 0;
        delete f.model.render.__ottCatalog;
        assert.equal(f.actions().length, 0);
        f.model.render.__ottMediaRows = true;
        f.model.items.length = 0;
        assert.equal(f.actions().length, 0);
    } finally {
        f.dom.window.close();
    }
});
