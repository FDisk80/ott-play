const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const modules = new Map();
function load(relative) {
    const filename = path.join(root, relative);
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} };
    modules.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
        },
    }).outputText;
    require("acorn").parse(code, { ecmaVersion: 5 });
    vm.runInNewContext(
        code,
        {
            exports: module.exports,
            require(name) {
                const dependency =
                    path.resolve(path.dirname(filename), name) + ".ts";
                if (dependency === path.join(root, "src/storage/index.ts"))
                    return { storage: {} };
                return load(path.relative(root, dependency));
            },
        },
        { filename }
    );
    return module.exports;
}

const colors = load("src/settings/interface-colors.ts");
const { settingsSchema, defaultSettings } = load("src/settings/index.ts");
const { createSettingsStore } = load("src/settings/store.ts");
const schema = settingsSchema.filter((entry) =>
    ["uiColorConfig", "players", "interfaceTheme", "highlightColor"].includes(
        entry.id
    )
);
const colorEntry = schema.find((entry) => entry.id === "uiColorConfig");
const first = '{"version":1,"colors":{"accent":"#AABBCC"}}';
const second = '{"version":1,"colors":{"text":"#112233"}}';

function fixture(data = new Map()) {
    const f = {
        data,
        effects: [],
        reject: false,
        source: "provider-a",
        writes: [],
    };
    f.store = createSettingsStore(schema, {
        context: () => f.source,
        effect: (name) => f.effects.push(name),
        storage(entry) {
            const key =
                entry.scope === "provider"
                    ? f.source + ":" + entry.key
                    : entry.key;
            return {
                read: () => data.get(key) ?? null,
                remove() {
                    f.writes.push([key, null]);
                    if (!f.reject) data.delete(key);
                },
                write(value) {
                    f.writes.push([key, value]);
                    if (f.reject) return;
                    data.set(key, value);
                    if (f.afterWrite) f.afterWrite(key, value);
                },
            };
        },
    });
    f.store.reload();
    f.save = (value) => {
        const draft = f.store.begin();
        if (!draft.set("uiColorConfig", value)) {
            draft.cancel();
            return false;
        }
        return draft.commit();
    };
    return f;
}

test("empty config inherits every base color and leaves legacy defaults unchanged", () => {
    assert.equal(defaultSettings().uiColorConfig, "");
    assert.equal(defaultSettings().interfaceTheme, 2);
    assert.equal(defaultSettings().highlightColor, "50,85");
    assert.equal(defaultSettings().highlightColorSel, "240,25");
    assert.equal(defaultSettings().highlightColorB, "255,0");
    const base = Object.fromEntries(
        colors.interfaceColorRoles.map((role) => [role, "inherited-" + role])
    );
    Object.freeze(base);
    const resolved = colors.resolveInterfaceColors("", base);
    assert.deepEqual({ ...resolved }, base);
    assert.notEqual(resolved, base);
    assert.equal(
        colors.normalizeInterfaceColorConfig('{"version":1,"colors":{}}'),
        ""
    );
    assert.equal(colors.serializeInterfaceColors({}), "");
    assert.equal(colors.parseInterfaceColorConfig("").version, 1);
});

test("partial colors canonicalize casing and role order without changing the base", () => {
    const raw =
        '{"colors":{"accent":"#aAbBcC","background":"#010203"},"version":1}';
    const canonical =
        '{"version":1,"colors":{"background":"#010203","accent":"#AABBCC"}}';
    assert.equal(colors.normalizeInterfaceColorConfig(raw), canonical);
    assert.equal(
        colors.serializeInterfaceColors({
            accent: "#aabbcc",
            background: "#010203",
        }),
        canonical
    );
    const base = Object.freeze({ accent: "#000000", text: "#FFFFFF" });
    const resolved = colors.resolveInterfaceColors(raw, base);
    assert.deepEqual(
        { ...resolved },
        { accent: "#AABBCC", background: "#010203", text: "#FFFFFF" }
    );
    assert.equal(base.accent, "#000000");
    resolved.text = "#123456";
    assert.equal(base.text, "#FFFFFF");
});

test("parser rejects unknown versions, fields, malformed roles and unsafe CSS as one unit", () => {
    for (const raw of [
        null,
        1,
        {},
        " ",
        "{",
        "null",
        "[]",
        "true",
        "1",
        '{"version":2,"colors":{}}',
        '{"version":"1","colors":{}}',
        '{"version":1}',
        '{"colors":{}}',
        '{"version":1,"colors":{},"extra":1}',
        '{"version":1,"colors":null}',
        '{"version":1,"colors":[]}',
        '{"version":1,"colors":{"unknown":"#112233"}}',
        '{"version":1,"colors":{"__proto__":"#112233"}}',
        '{"version":1,"colors":{"text":"red"}}',
        '{"version":1,"colors":{"text":"#abc"}}',
        '{"version":1,"colors":{"text":"#11223344"}}',
        '{"version":1,"colors":{"text":"#112233;display:none"}}',
        '{"version":1,"colors":{"text":"url(https://invalid.test/)"}}',
        '{"version":1,"colors":{"text":112233}}',
        '{"version":1,"colors":{"accent":"#112233","text":"invalid"}}',
    ]) {
        assert.equal(colors.parseInterfaceColorConfig(raw), null, String(raw));
        assert.equal(
            colors.normalizeInterfaceColorConfig(raw),
            null,
            String(raw)
        );
        assert.deepEqual(
            { ...colors.resolveInterfaceColors(raw, { accent: "#FFFFFF" }) },
            { accent: "#FFFFFF" }
        );
    }
    assert.equal(
        colors.serializeInterfaceColors({
            text: "#112233",
            unknown: undefined,
        }),
        null
    );
    assert.equal(
        colors.serializeInterfaceColors({
            text: "#112233",
            toJSON: () => ({ text: "#112233" }),
        }),
        null
    );
});

test("raw input is bounded before parsing and all nine roles roundtrip", () => {
    const full = Object.fromEntries(
        colors.interfaceColorRoles.map((role) => [role, "#aabbcc"])
    );
    const raw = colors.serializeInterfaceColors(full);
    assert.equal(
        Object.keys(colors.parseInterfaceColorConfig(raw).colors).length,
        9
    );
    assert.equal(colors.normalizeInterfaceColorConfig(raw), raw);
    const padded = first.padEnd(2048, " ");
    assert.equal(colors.normalizeInterfaceColorConfig(padded), first);
    assert.equal(colors.normalizeInterfaceColorConfig(padded + " "), null);
});

test("real schema is client-scoped and reapplies colors after mode changes", () => {
    assert.equal(colorEntry.key, "sUiColorConfig");
    assert.equal(colorEntry.defaultValue, "");
    assert.equal(colorEntry.scope, "application");
    assert.equal(colorEntry.rules.maxUtf8Bytes, 2048);
    assert.deepEqual(Array.from(colorEntry.effects), ["setColor"]);
    assert.deepEqual(
        Array.from(
            settingsSchema.find((entry) => entry.id === "interfaceMode").effects
        ),
        ["setInterfaceMode", "setColor"]
    );
    const f = fixture();
    assert.equal(f.save(first), true);
    assert.equal(f.data.get("sUiColorConfig"), first);
    assert.deepEqual(f.effects, ["setColor"]);
    f.source = "provider-b";
    f.store.reload("provider");
    assert.equal(f.store.get("uiColorConfig"), first);
    assert.equal(f.data.has("provider-a:sUiColorConfig"), false);
    assert.equal(f.data.has("provider-b:sUiColorConfig"), false);
    assert.equal(f.store.get("interfaceTheme"), 2);
    assert.equal(f.store.get("highlightColor"), "50,85");
});

test("saved colors survive new runtime creation and remain isolated between clients", () => {
    const client = fixture();
    assert.equal(client.save(first), true);
    const reopened = fixture(client.data);
    assert.equal(reopened.store.get("uiColorConfig"), first);
    assert.equal(fixture().store.get("uiColorConfig"), "");
    assert.equal(reopened.save(""), true);
    assert.equal(fixture(client.data).store.get("uiColorConfig"), "");
});

test("cancel and invalid whole configs never publish or persist partial colors", () => {
    const f = fixture(new Map([["sUiColorConfig", first]]));
    const draft = f.store.begin();
    assert.equal(draft.set("uiColorConfig", second), true);
    assert.equal(f.store.get("uiColorConfig"), first);
    draft.cancel();
    assert.equal(draft.commit(), false);
    assert.equal(
        f.save('{"version":1,"colors":{"text":"#112233","accent":"bad"}}'),
        false
    );
    assert.equal(f.save('{"version":1,"colors":{"accent":"#aabbcc"}}'), false);
    assert.equal(f.save('{"colors":{"accent":"#AABBCC"},"version":1}'), false);
    assert.equal(f.save('{"version":1,"colors":{}}'), false);
    assert.equal(
        f.save(
            '{"version":1,"colors":{"accent":"#000000","accent":"#AABBCC"}}'
        ),
        false
    );
    assert.equal(
        f.save('{"version":1,"colors":{"\\u0061ccent":"#AABBCC"}}'),
        false
    );
    assert.equal(f.save(first + " "), false);
    assert.equal(f.save(null), false);
    assert.equal(f.data.get("sUiColorConfig"), first);
    assert.equal(f.store.get("uiColorConfig"), first);
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.effects, []);
});

test("malformed persisted configs inherit without repairing bytes or altering old preferences", () => {
    const invalid = '{"version":9,"colors":{"text":"#112233"}}';
    const f = fixture(
        new Map([
            ["sUiColorConfig", invalid],
            ["sInterfaceTheme", "1"],
            ["sSHLcolor", "12,34"],
        ])
    );
    assert.equal(f.store.get("uiColorConfig"), "");
    assert.equal(f.store.get("interfaceTheme"), 1);
    assert.equal(f.store.get("highlightColor"), "12,34");
    assert.equal(f.data.get("sUiColorConfig"), invalid);
    assert.deepEqual(f.writes, []);
    const noncanonical = '{"version":1,"colors":{"accent":"#aabbcc"}}';
    const restored = fixture(new Map([["sUiColorConfig", noncanonical]]));
    assert.equal(restored.store.get("uiColorConfig"), first);
    assert.equal(restored.data.get("sUiColorConfig"), noncanonical);
    assert.deepEqual(restored.writes, []);
});

test("conflicting editors and a provider change reject stale commits", () => {
    const f = fixture(new Map([["sUiColorConfig", first]]));
    const old = f.store.begin();
    assert.equal(old.set("uiColorConfig", second), true);
    assert.equal(f.save(""), true);
    assert.equal(old.commit(), false);
    assert.equal(old.errorCode(), "concurrent_edit");
    assert.equal(f.data.get("sUiColorConfig"), "");
    const stale = f.store.begin();
    assert.equal(stale.set("uiColorConfig", second), true);
    f.source = "provider-b";
    assert.equal(stale.commit(), false);
    assert.equal(f.data.get("sUiColorConfig"), "");
});

test("storage failure never publishes colors and a changed-then-throw write rolls back", () => {
    for (const afterMutation of [false, true]) {
        const f = fixture(new Map([["sUiColorConfig", first]]));
        if (afterMutation)
            f.afterWrite = () => {
                throw Error("write failed");
            };
        else f.reject = true;
        assert.equal(f.save(second), false);
        assert.equal(f.data.get("sUiColorConfig"), first);
        assert.equal(f.store.get("uiColorConfig"), first);
        assert.deepEqual(f.effects, []);
    }
});
