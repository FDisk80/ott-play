const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Module = require("node:module");
const ts = require("typescript");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
const fixturePath = path.join(__dirname, "test_vportal.cjs");
const original = fs.readFileSync(fixturePath, "utf8");
const boundary = original.indexOf("\n{\n    const f = fixture();");
assert(boundary > 0);
const fixtureModule = new Module(fixturePath, module);
fixtureModule.filename = fixturePath;
fixtureModule.paths = Module._nodeModulePaths(__dirname);
fixtureModule._compile(
    original.slice(0, boundary) + "\nmodule.exports={fixture};",
    fixturePath
);
const { fixture } = fixtureModule.exports;
const synopsis =
    "О владельцах не слишком успешного ирландского паба в южной Филадельфии. " +
    "Полное описание сохраняется. ".repeat(30) +
    "КОНЕЦ ОПИСАНИЯ";
function collect(item, parent = {}, portalLink) {
    const f = fixture({}, {}, { link: portalLink });
    let result;
    f.client.playlist(
        [{ __ottCategoryRoot: true, request: {}, title: "Portal" }],
        (items, complete, error) => {
            result = { complete, error, items };
        }
    );
    f.requests[0].receive({
        type: "category",
        ...parent,
        items: [
            {
                request: { cmd: "play", id: "exact" },
                title: "Episode",
                type: "stream",
                ...item,
            },
        ],
    });
    assert.equal(result.error, undefined);
    return result.items[0];
}
const record = collect({
    description: synopsis,
    img: "../posters/episode.jpg",
});
assert(record.description.endsWith("КОНЕЦ ОПИСАНИЯ"));
assert.equal(
    record.description.slice(record.__ottMediaSynopsisOffset),
    synopsis
);
assert.equal(record.__ottMediaDescription, undefined);
assert.equal(
    record.logo_30x30,
    "http://portal.example/api/posters/episode.jpg"
);
assert.equal(record.request.id, "exact");
assert.equal(record.request.cmd, "play");
for (const [item, parent, expected, plot] of [
    [
        {
            __ottMediaSynopsisOffset: "untrusted",
            agelimit: 18,
            description: "Same & <plot>\nSecond 😀",
            duration: "1 < 2",
            title: "Same & <plot>",
            year: 2026,
        },
        { description: "Unused parent synopsis" },
        "<b>Same &amp; &lt;plot&gt;</b><br>2026<br>1 &lt; 2<br>18<br>Same &amp; &lt;plot&gt;\nSecond 😀",
        "Same &amp; &lt;plot&gt;\nSecond 😀",
    ],
    [
        { description: "" },
        { description: "Parent 'plot'\r\nSecond \"line\"", year: 2024 },
        "<b>Episode</b><br>2024<br>Parent &#39;plot&#39;\r\nSecond &quot;line&quot;",
        "Parent &#39;plot&#39;\r\nSecond &quot;line&quot;",
    ],
    [{ year: 2026 }, {}, "<b>Episode</b><br>2026", null],
    [{ description: "" }, { description: "" }, "<b>Episode</b>", null],
    [{ description: [] }, {}, "<b>Episode</b><br>", null],
]) {
    const row = collect(item, parent);
    assert.equal(row.description, expected, "full description stays unchanged");
    const offset = row.__ottMediaSynopsisOffset;
    assert(Number.isSafeInteger(offset));
    if (plot === null) assert.equal(offset, -1);
    else {
        assert(offset >= 0 && offset < row.description.length);
        assert.equal(offset, expected.length - plot.length);
        assert.equal(row.description.slice(offset), plot);
    }
    assert.equal(row.__ottMediaDescription, undefined);
}
assert.equal(
    collect({ imglr: "javascript:bad()" }, { img: "/covers/parent.jpg" })
        .logo_30x30,
    "http://portal.example/covers/parent.jpg"
);
assert.equal(
    collect({ img: "//images.example/poster.jpg" }).logo_30x30,
    "http://images.example/poster.jpg"
);
assert.equal(
    collect({ img: "data:image/png;base64,AA==" }).logo_30x30,
    "data:image/png;base64,AA=="
);
assert.equal(collect({ img: "javascript:bad()" }).logo_30x30, "");
// Standards-based URL semantics, including credentials in query strings versus authority.
const fileBase =
    "portal::[key:fixture-private-key]https://portal.example/api/entry?auth=BASE_ONLY";
for (const [image, expected] of [
    ["?poster=1", "https://portal.example/api/entry?poster=1"],
    ["#poster", "https://portal.example/api/entry?auth=BASE_ONLY#poster"],
    ["//cdn.example/poster.png", "https://cdn.example/poster.png"],
    [
        "../covers/a.png?token=opaque%2Fimage",
        "https://portal.example/covers/a.png?token=opaque%2Fimage",
    ],
    ["/root.png", "https://portal.example/root.png"],
])
    assert.equal(collect({ img: image }, {}, fileBase).logo_30x30, expected);
assert.equal(
    collect(
        { img: "cover.png" },
        {},
        "portal::[key:fixture-private-key]https://portal.example?auth=BASE_ONLY"
    ).logo_30x30,
    "https://portal.example/cover.png"
);
assert.equal(
    collect(
        { img: "https://user:password@images.example/private.png" },
        { img: "/fallback.png" },
        fileBase
    ).logo_30x30,
    "https://portal.example/fallback.png"
);
const helperSource = fs.readFileSync(
    path.join(root, "src/utils/helpers.ts"),
    "utf8"
);
function declaration(source, name) {
    const ast = ts.createSourceFile(
        "actual.ts",
        source,
        ts.ScriptTarget.Latest,
        true
    );
    let found;
    function visit(node) {
        if (ts.isFunctionDeclaration(node) && node.name?.text === name)
            found = node.getText(ast).replace(/^export\s+/, "");
        else ts.forEachChild(node, visit);
    }
    visit(ast);
    assert(found, name);
    return found;
}
const compile = (text) =>
    ts.transpileModule(text, {
        compilerOptions: {
            module: ts.ModuleKind.None,
            target: ts.ScriptTarget.ES5,
        },
    }).outputText;
// Actual retained-budget function drops the one optional description.
const ctx = {
    descriptionsOmitted: false,
    known: {},
    retainedBytes: 0,
    sizes: {},
    utf8Size: (r) => (r.description ? 67108865 : JSON.stringify(r).length),
    whole: true,
};
vm.createContext(ctx);
vm.runInContext(
    compile(
        declaration(
            fs.readFileSync(path.join(root, "src/plugins/vportal.ts"), "utf8"),
            "retain"
        ) + ";this.retain=retain;"
    ),
    ctx
);
const bounded = {
    __ottMediaSynopsisOffset: 0,
    description: "full",
    request: { id: "stable" },
};
ctx.known.key = bounded;
ctx.retain("key", bounded);
assert.equal(bounded.description, undefined);
assert.equal(bounded.__ottMediaSynopsisOffset, undefined);
assert.equal(bounded.__ottMediaDescription, undefined);
assert.equal(bounded.request.id, "stable");
assert(ctx.retainedBytes < 67108864);
const subsequent = { __ottMediaSynopsisOffset: 0, description: "next" };
ctx.retain("next", subsequent);
assert.equal(subsequent.description, undefined);
assert.equal(subsequent.__ottMediaSynopsisOffset, undefined);
const helperNames = [
    "metadataText",
    "metadataImageUrl",
    "metadataCssUrl",
    "metadataHtml",
];
const detail = declaration(
    fs.readFileSync(path.join(root, "src/provider/index.ts"), "utf8"),
    "detailProg"
);
const getDescr = declaration(
    fs.readFileSync(path.join(root, "src/channels/index.ts"), "utf8"),
    "getMediaDescr"
);
{
    const dom = new JSDOM('<div id="listDetail"></div>');
    const w = dom.window;
    w.settings = { nextCountList: 1, preview: 0, showDescription: 1 };
    w.sThumbnail = 1;
    const context = {
        _: (s) => s,
        channels: {},
        curColor: "gold",
        document: w.document,
        getViewportHeightScale: () => 1,
        getViewportWidthScale: () => 1,
        listArray: ["selected"],
        listDetail: w.document.getElementById("listDetail"),
        scrollUp: () => {},
        selIndex: 0,
        time2time: () => "time",
        window: w,
    };
    context.$ = (selector) => ({
        css: (styles) => {
            w.document
                .querySelectorAll(selector)
                .forEach((el) => Object.assign(el.style, styles));
        },
        height: () => (selector === "#_prd" ? 500 : 300),
        outerHeight: () => 40,
    });
    vm.createContext(context);
    vm.runInContext(
        compile(
            helperNames.map((n) => declaration(helperSource, n)).join("\n") +
                "\n" +
                detail +
                "\n" +
                getDescr +
                "\nthis.detailProg=detailProg;this.getMediaDescr=getMediaDescr;"
        ),
        context
    );
    let iconCalls = 0;
    const originalIcon = context.metadataCssUrl;
    context.metadataCssUrl = (value) => {
        iconCalls++;
        return originalIcon(value);
    };
    for (const provider of ["vportal", "plex", "local"]) {
        const item =
            provider === "vportal"
                ? record
                : {
                      description: synopsis,
                      logo_30x30: "https://images.example/movie.png",
                      title: "Movie",
                  };
        iconCalls = 0;
        context.detailProg({
            __ottMediaItem: item,
            __ottMediaProvider: provider,
            channel_name: item.title,
        });
        assert(
            w.document
                .getElementById("listDetail")
                .textContent.endsWith("КОНЕЦ ОПИСАНИЯ"),
            "shared source/" + provider
        );
        assert.equal(iconCalls, 1, "selected artwork is sanitized once");
        const image = w.document.querySelector(".ott-channel-thumbnail");
        assert.equal(image.tagName, "IMG");
        assert.equal(image.getAttribute("src"), item.logo_30x30);
        image.dispatchEvent(new w.Event("error"));
        assert.equal(image.style.display, "none");
        assert.equal(
            w.document.querySelector(".ott-channel-detail-time"),
            null
        );
        assert(context.getMediaDescr(item).includes("КОНЕЦ ОПИСАНИЯ"));
    }
    iconCalls = 0;
    context.detailProg({
        descr: "TV programme",
        icon: "https://images.example/tv.png",
        name: "Live programme",
        nextpr: [],
        time: Date.now() / 1000 - 30,
        time_to: Date.now() / 1000 + 600,
    });
    assert.equal(
        w.document.querySelector(".ott-channel-thumbnail").tagName,
        "DIV"
    );
    assert.equal(iconCalls, 1, "live artwork is sanitized once");
    assert(w.document.querySelector(".ott-channel-detail-time"));
    assert(
        w.document
            .getElementById("listDetail")
            .textContent.includes("Live programme")
    );
}
console.log(
    "PASS full selected description, bounded fallback, provider-relative artwork, failed-image collapse; VPortal/Plex/Local and live TV in the shared actual-source DOM fixture"
);
