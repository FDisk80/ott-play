const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const baseline = "b3c8cc072e92f14c8e352a223157788f24ca4dce";
const capture = process.argv.includes("--capture");
const sourceText = capture
    ? execFileSync("git", ["show", baseline + ":src/channels/index.ts"], {
          cwd: root,
          encoding: "utf8",
      })
    : fs.readFileSync(path.join(root, "src/channels/index.ts"), "utf8");
const source = ts.createSourceFile(
    "channels.ts",
    sourceText,
    ts.ScriptTarget.Latest,
    true
);
const selected = new Set(["nextChannel", "prevChannel"]);
const functions = source.statements
    .filter((n) => ts.isFunctionDeclaration(n) && selected.has(n.name?.text))
    .map((n) => n.getText(source))
    .join("\n");
const code = ts
    .transpileModule(functions, {
        compilerOptions: {
            module: ts.ModuleKind.ES2015,
            target: ts.ScriptTarget.ES5,
        },
    })
    .outputText.replace(/^export /gm, "");
let calls = [];
const context = vm.createContext({
    catIndex: 4,
    curList: [],
    primaryIndex: 0,
    window: { playChannel: (category, index) => calls.push([category, index]) },
});
vm.runInContext(
    fs.readFileSync(path.join(root, "vendor/ottplay-core.js"), "utf8"),
    context
);
context.window.OttPlayCore = context.OttPlayCore;
vm.runInContext(code, context);
const observed = [];
for (const count of [0, 1, 2, 5, 20])
    for (const current of [-2, -1, 0, 1, 4, 12, 1.5]) {
        context.curList = Array(count);
        context.primaryIndex = current;
        calls = [];
        context.nextChannel();
        context.prevChannel();
        observed.push({ calls, count, current });
    }
const target = path.join(
    __dirname,
    "fixtures/playback-policy/channels-before-core.json"
);
if (capture) {
    assert(!fs.existsSync(target));
    fs.writeFileSync(
        target,
        JSON.stringify({ baseline, observed }, null, 2) + "\n"
    );
} else {
    assert.deepEqual(
        observed,
        JSON.parse(fs.readFileSync(target, "utf8")).observed
    );
    console.log("PASS 35 captured classic channel movement boundary profiles");
}

const categoryFunctions = new Set([
    "isCategorySelectionList",
    "categoryRowIndex",
    "setCategoryRows",
    "bucketsList",
    "bucketsKeyHandler",
    "playingChannelIdxInCategory",
    "moveSelectedChannelOrCategory",
]);
const categoryCode = source.statements
    .filter(
        (node) =>
            (ts.isFunctionDeclaration(node) &&
                categoryFunctions.has(node.name?.text)) ||
            (ts.isVariableStatement(node) &&
                node.declarationList.declarations.some(
                    (item) =>
                        item.name.getText(source) === "categoryRowsProjection"
                ))
    )
    .map((node) => node.getText(source))
    .join("\n");
function categoryFixture(showAll = 1, showFavorites = 1, ordinary = true) {
    let labels = ordinary
        ? ["All", "All ", "Favorites ", "Favorites"]
        : ["All", "Favorites"];
    let ids = ordinary
        ? ["system:all", "provider:a", "provider:b", "system:favorites"]
        : ["system:all", "system:favorites"];
    let popup = false;
    const events = [];
    const elements = new Map();
    const keys = {
        ENTER: 13,
        EXIT: 27,
        FF: 70,
        NEXT: 78,
        PAUSE: 80,
        PLAY: 81,
        PRECH: 82,
        PREV: 83,
        RED: 84,
        RETURN: 8,
        RW: 85,
        TOOLS: 86,
        YELLOW: 87,
    };
    for (let n = 0; n <= 9; n++) keys["N" + n] = 48 + n;
    const w = {
        _: (value) => value,
        channelsList: (category, index) =>
            events.push(["open", category, index]),
        closeList: () => events.push(["close"]),
        keys,
        openSelectedChannelRecordings: (category) =>
            events.push(["recordings", category]),
        renderButtonHint: () => "",
        showPage() {},
        sShowAllCategory: showAll,
        sShowFavoritesCategory: showFavorites,
    };
    const context = vm.createContext({
        $: () => ({
            hide() {
                popup = false;
            },
            html() {},
            is: () => popup,
            toggle() {
                popup = !popup;
            },
        }),
        catIndex: 0,
        cats: Object.fromEntries(labels.map((label, i) => [label, [i + 1]])),
        catsArray: labels,
        confirm: () => true,
        document: {
            getElementById(id) {
                if (!elements.has(id)) elements.set(id, {});
                return elements.get(id);
            },
        },
        metadataText: (value) => value,
        openGlobalFavorites: () => {
            events.push(["favorites"]);
            return true;
        },
        primaryIndex: 0,
        prompt: () => "New category",
        saveChannelsCats: () => events.push(["save"]),
        settings: {},
        sFavorites: 0,
        strPlayPause: "Play",
        window: w,
    });
    w.catsArray = labels;
    w.__ottChannels = {
        change(...args) {
            events.push(["change", ...args]);
            const [action, value, extra] = args;
            const at = ids.indexOf(value);
            if (action === "create") {
                const id = "user:created";
                ids.splice(ids.length - 1, 0, id);
                labels.splice(labels.length - 1, 0, value);
                return id;
            }
            if (action === "rename") labels[at] = extra;
            if (action === "remove") {
                ids.splice(at, 1);
                labels.splice(at, 1);
            }
            if (action === "move") {
                const next = Math.max(1, Math.min(ids.length - 2, at + extra));
                ids.splice(next, 0, ids.splice(at, 1)[0]);
                labels.splice(next, 0, labels.splice(at, 1)[0]);
            }
            return true;
        },
        group: (index) => ids[index],
        index: (id) => ids.indexOf(id),
        refresh() {},
    };
    vm.runInContext(
        ts
            .transpileModule(categoryCode, {
                compilerOptions: {
                    module: ts.ModuleKind.ES2015,
                    target: ts.ScriptTarget.ES5,
                },
            })
            .outputText.replace(/^export /gm, ""),
        context
    );
    return {
        context,
        events,
        ids,
        labels,
        popup: () => {
            popup = true;
        },
        press: (key) => context.bucketsKeyHandler(key),
        replace() {
            labels = labels.slice();
            context.catsArray = labels;
            w.catsArray = labels;
        },
        show: (selected = 0) => context.bucketsList(selected),
        w,
    };
}
for (const all of [0, 1])
    for (const favorites of [0, 1]) {
        const f = categoryFixture(all, favorites);
        const before = JSON.stringify([f.labels, f.ids]);
        f.show();
        const expected = f.ids
            .map((id, index) => ({ id, index }))
            .filter(
                ({ id }) =>
                    (id !== "system:all" || all) &&
                    (id !== "system:favorites" || favorites)
            );
        assert.deepEqual(
            Array.from(f.w.listArray),
            expected.map(({ index }) => f.labels[index])
        );
        if (all && favorites)
            assert.equal(
                f.w.listArray,
                f.labels,
                "default view keeps original identity"
            );
        for (let row = 0; row < expected.length; row++) {
            f.events.length = 0;
            f.w.selIndex = row;
            f.press(f.w.keys.ENTER);
            assert.equal(
                f.events[0][0],
                expected[row].id === "system:favorites" ? "favorites" : "open"
            );
            if (f.events[0][0] === "open")
                assert.equal(f.events[0][1], expected[row].index);
            f.events.length = 0;
            f.press(f.w.keys.N1 + row);
            if (f.events[0][0] === "open")
                assert.equal(f.events[0][1], expected[row].index);
            f.events.length = 0;
            f.press(f.w.keys.RED);
            assert.deepEqual(f.events[0], ["recordings", expected[row].index]);
        }
        assert.equal(
            JSON.stringify([f.labels, f.ids]),
            before,
            "visibility never rewrites catalog or IDs"
        );
    }
{
    const f = categoryFixture(0, 0);
    f.show(0);
    assert.equal(
        f.w.selIndex,
        0,
        "hidden current category selects first visible row"
    );
    assert.deepEqual(
        Array.from(f.w.listArray),
        ["All ", "Favorites "],
        "provider name collisions are retained"
    );
    f.w.selIndex = 1;
    f.press(f.w.keys.NEXT);
    assert.equal(
        f.events[0][1],
        1,
        "next wraps through visible canonical rows"
    );
    f.events.length = 0;
    f.replace();
    f.press(f.w.keys.ENTER);
    assert.equal(
        f.events.length,
        0,
        "stale projection cannot select a replaced catalog"
    );
}
{
    const f = categoryFixture(0, 0, false);
    f.show();
    assert.equal(f.w.listArray.length, 0);
    for (const key of [
        f.w.keys.ENTER,
        f.w.keys.N1,
        f.w.keys.NEXT,
        f.w.keys.RED,
    ])
        f.press(key);
    assert.equal(
        f.events.length,
        0,
        "empty selector never opens an unintended category"
    );
    f.press(f.w.keys.RETURN);
    assert.deepEqual(f.events, [["close"]]);
}
for (const [key, action] of [
    ["N6", "rename"],
    ["N9", "create"],
    ["N8", "remove"],
    ["N1", "move"],
]) {
    const f = categoryFixture(0, 0);
    f.show();
    f.w.selIndex = 1;
    f.popup();
    f.press(f.w.keys[key]);
    const change = f.events.find((event) => event[0] === "change");
    assert.equal(change[1], action);
    assert.equal(
        change[action === "create" ? 3 : 2],
        "provider:b",
        "editing uses canonical identity behind visible row"
    );
    const selected = f.context.categoryRowIndex(f.w.selIndex);
    assert.equal(
        f.ids[selected],
        action === "create"
            ? "user:created"
            : action === "remove"
              ? "provider:a"
              : "provider:b",
        "post-edit selection follows the correct canonical row"
    );
    assert.equal(
        f.w.listArray.includes("Favorites"),
        false,
        "rebuilding after edits keeps the virtual row hidden"
    );
}
{
    const f = categoryFixture(0, 0, false);
    f.show();
    f.popup();
    f.press(f.w.keys.N3);
    assert.deepEqual(Array.from(f.w.listArray), ["New category"]);
    assert.equal(
        f.ids[f.context.categoryRowIndex(f.w.selIndex)],
        "user:created",
        "creating in an empty view selects the new category"
    );
}
{
    const f = categoryFixture(0, 0);
    f.show();
    const labels = ["All", "Favorites"],
        key = () => true;
    f.context.bucketsList(0, undefined, { key, labels });
    assert.equal(
        f.w.listArray,
        labels,
        "custom provider views keep their own semantics"
    );
    assert.equal(f.w.listKeyHandlerFn, key);
}
console.log(
    "PASS virtual category visibility, canonical navigation/editing, empty/stale/default/custom views"
);
