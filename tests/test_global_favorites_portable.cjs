"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"),
    path = require("node:path"),
    vm = require("node:vm"),
    ts = require("typescript");
const file = path.join(
    __dirname,
    "../src/settings/global-favorites-portable.ts"
);
const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES5,
    },
});
const box = { encodeURIComponent, exports: {} };
vm.runInNewContext(compiled.outputText, box);
const codec = box.exports.createGlobalFavoritesPortableCodec();
function row(
    provider = "plex",
    locator = { kind: "plex-media", ratingKey: "42", serverId: "PMS_1" }
) {
    return {
        locator,
        origin: {
            profile: "Family",
            provider,
            sourceAlias: "Living room",
            subprofile: null,
        },
        title: "Фильм",
    };
}
let cases = 0;
function test(name, fn) {
    fn();
    cases++;
}
test("exact Plex shape canonical identity ignores title", () => {
    const a = row(),
        b = row();
    b.title = "Renamed";
    assert(codec.normalize(a));
    assert.equal(codec.identity(a), codec.identity(b));
    assert.equal(
        JSON.stringify(codec.normalize(codec.normalize(a))),
        JSON.stringify(codec.normalize(a))
    );
});
test("local strict relative raw path and root alias", () => {
    for (const relativePath of ["Films/Фильм 1.mkv", "Films/100% real.mp4"])
        assert(
            codec.normalize(
                row("local", {
                    kind: "local-media",
                    relativePath,
                    rootAlias: "Movies",
                })
            )
        );
    for (const relativePath of [
        "/etc/passwd",
        "../film",
        "a/../film",
        "a//b",
        "a\\b",
        "file://secret",
        "a/./b",
    ])
        assert.equal(
            codec.normalize(
                row("local", {
                    kind: "local-media",
                    relativePath,
                    rootAlias: "Movies",
                })
            ),
            null
        );
});
test("channel string IDs preserve leading zeros and wide integer strings", () => {
    for (const channelId of ["001", "9007199254740993", "bbc.one"])
        assert.equal(
            codec.normalize(row("m3u", { channelId, kind: "channel" })).locator
                .channelId,
            channelId
        );
});
test("all live provider ids may use channel locator", () => {
    for (const provider of ["stalker", "ottclub", "custom_live"])
        assert(
            codec.normalize(
                row(provider, { channelId: "123", kind: "channel" })
            )
        );
});
for (const provider of ["plex", "local", "vportal"]) {
    for (const locator of [
        { channelId: "m3u-epg:news", kind: "channel" },
        { group: "News", kind: "channel-name", name: "News" },
    ]) {
        test(
            "reserved provider rejects " + provider + "/" + locator.kind,
            () => {
                assert.equal(
                    codec.document({
                        entries: [row(provider, locator)],
                        version: 1,
                    }),
                    null
                );
            }
        );
    }
}
test("VPortal only provider ID field, not cmd/request/title occurrence", () => {
    assert(
        codec.normalize(
            row("vportal", {
                id: "s18-e1",
                idField: "episode_id",
                kind: "vportal-media",
            })
        )
    );
    for (const locator of [
        { id: "x", idField: "cmd", kind: "vportal-media" },
        { id: "https://private/token", idField: "id", kind: "vportal-media" },
        {
            id: "x",
            idField: "id",
            kind: "vportal-media",
            request: { token: "secret" },
        },
    ])
        assert.equal(codec.normalize(row("vportal", locator)), null);
});
test("Plex exact server/rating grammar", () => {
    for (const x of [
        { ratingKey: "1", serverId: ".bad" },
        { ratingKey: "1", serverId: "http://bad" },
        { ratingKey: "1", serverId: "a".repeat(257) },
        { ratingKey: "0", serverId: "ok" },
        { ratingKey: "01", serverId: "ok" },
        { ratingKey: "1\n", serverId: "ok" },
        { ratingKey: "1".repeat(21), serverId: "ok" },
    ])
        assert.equal(
            codec.normalize(row("plex", { kind: "plex-media", ...x })),
            null
        );
});
test("no provider kind crossover", () =>
    assert.equal(codec.normalize(row("local")), null));
test("no private fields/accessor invocation", () => {
    let calls = 0;
    const x = row();
    Object.defineProperty(x, "title", {
        enumerable: true,
        get() {
            calls++;
            return "secret";
        },
    });
    assert.equal(codec.normalize(x), null);
    assert.equal(calls, 0);
    const y = row();
    y.token = "secret";
    assert.equal(codec.normalize(y), null);
});
test("origin exact public descriptors and subprofiles", () => {
    const x = row();
    x.origin.subprofile = "Kids";
    assert(codec.normalize(x));
    x.origin.profile = "https://user:password@example/";
    assert.equal(codec.normalize(x), null);
    x.origin.profile = 3;
    assert.equal(codec.normalize(x), null);
});
test("document preserves order and rejects duplicate portable identity", () => {
    const a = row(),
        b = row("m3u", { channelId: "001", kind: "channel" });
    const d = codec.document({ entries: [b, a], version: 1 });
    assert.equal(d.entries[0].locator.channelId, "001");
    assert.equal(codec.document({ entries: [a, a], version: 1 }), null);
});
test("document no local UUID/legacy/migration metadata", () => {
    assert.equal(
        codec.document({
            entries: [{ ...row(), id: "local-uuid" }],
            version: 1,
        }),
        null
    );
    assert.equal(codec.document({ entries: [], legacy: [], version: 1 }), null);
});
test("bounded complete or refuse, Unicode byte size", () => {
    assert.equal(
        codec.document({ entries: Array(1001).fill(row()), version: 1 }),
        null
    );
    const entries = Array.from({ length: 900 }, (_, i) => ({
        ...row("m3u", { channelId: String(i), kind: "channel" }),
        title: "я".repeat(1024),
    }));
    assert.equal(codec.document({ entries, version: 1 }), null);
    assert(codec.document({ entries: [], version: 1 }));
});
test("unknown provider preserved portable but unresolved locally", () => {
    const x = row("future_plugin", { channelId: "001", kind: "channel" });
    assert(codec.document({ entries: [x], version: 1 }));
    assert.equal(
        codec.match(
            x,
            [],
            () => true,
            () => true
        ).status,
        "missing"
    );
});
test("analogous profiles resolve independently of local UUID or slot", () => {
    const x = row();
    const candidate = {
        origin: x.origin,
        slot: 97,
        uuid: "different-local-uuid",
    };
    const r = codec.match(
        x,
        [candidate],
        (c, l) => c === candidate && l.serverId === "PMS_1",
        () => true
    );
    assert.equal(r.status, "matched");
    assert.equal(r.candidate, candidate);
});
test("duplicate profile descriptors never choose first", () => {
    const x = row();
    let calls = 0;
    assert.equal(
        codec.match(
            x,
            [{ origin: x.origin }, { origin: x.origin }],
            () => {
                calls++;
                return true;
            },
            () => true
        ).status,
        "ambiguous"
    );
    assert.equal(calls, 0);
});
test("subprofile/source mismatch is missing not fallback", () => {
    const x = row();
    assert.equal(
        codec.match(
            x,
            [{ origin: { ...x.origin, subprofile: "Kids" } }],
            () => true,
            () => true
        ).status,
        "missing"
    );
    assert.equal(
        codec.match(
            x,
            [{ origin: { ...x.origin, sourceAlias: "Bedroom" } }],
            () => true,
            () => true
        ).status,
        "missing"
    );
});
test("adapter provenance denial and stale ownership cannot match", () => {
    const x = row(),
        candidate = { origin: x.origin };
    assert.equal(
        codec.match(
            x,
            [candidate],
            () => false,
            () => true
        ).status,
        "unresolved"
    );
    let current = true;
    assert.equal(
        codec.match(
            x,
            [candidate],
            () => {
                current = false;
                return true;
            },
            () => current
        ).status,
        "stale"
    );
});
test("no title fallback or URL/secret export", () => {
    const x = row("m3u", { channelId: "http://secret", kind: "channel" });
    assert.equal(codec.normalize(x), null);
    assert.equal(
        codec.match(
            x,
            [{ origin: row().origin, title: "Фильм" }],
            () => true,
            () => true
        ).status,
        "invalid"
    );
});
test("published example is a complete accepted document", () => {
    const example = JSON.parse(
        fs.readFileSync(
            path.join(
                __dirname,
                "fixtures/global-favorites-portable/example.json"
            ),
            "utf8"
        )
    );
    assert(codec.document(example));
});
test("shared exact trim and UTF16 wellformed fixtures", () => {
    const fixtures = JSON.parse(
        fs.readFileSync(
            path.join(
                __dirname,
                "fixtures/global-favorites-portable/text-semantics.fixtures.json"
            ),
            "utf8"
        )
    );
    for (const f of fixtures.cases) {
        const x = row();
        x.origin.profile = f.value;
        assert.equal(!!codec.normalize(x), f.expected, f.id);
        assert.equal(f.value.length, f.utf16_units, f.id);
        assert.equal(codec.identity(x) !== "", f.expected, f.id);
    }
});
test("lone surrogates cannot hide behind JSON escapes", () => {
    const x = row();
    x.title = "\ud800";
    assert.doesNotThrow(() => encodeURIComponent(JSON.stringify(x)));
    assert.equal(codec.normalize(x), null);
    assert.equal(codec.document({ entries: [x], version: 1 }), null);
    assert.equal(codec.identity(x), "");
});
test("provider JSON numbers require lossless safe integers", () => {
    for (const value of [
        NaN,
        Infinity,
        -1,
        1.5,
        9007199254740992,
        JSON.parse("9007199254740993"),
    ])
        assert.equal(codec.providerId(value), null);
    assert.equal(codec.providerId(9007199254740991), "9007199254740991");
    assert.equal(codec.providerId("9007199254740993"), "9007199254740993");
    assert.equal(codec.providerId("001"), "001");
});
test("channel ordinal fallback is not a portable channel id", () => {
    assert.equal(
        codec.normalize(
            row("m3u", { channelId: "channel:42", kind: "channel" })
        ),
        null
    );
    assert(codec.normalize(row("m3u", { channelId: "42", kind: "channel" })));
});
test("explicit channel-name keeps exact name and nullable group", () => {
    const a = row("m3u", {
        group: null,
        kind: "channel-name",
        name: "News HD",
    });
    const b = row("m3u", {
        group: "News",
        kind: "channel-name",
        name: "News HD",
    });
    assert(codec.normalize(a));
    assert(codec.normalize(b));
    assert.notEqual(codec.identity(a), codec.identity(b));
    assert.notEqual(
        codec.identity(a),
        codec.identity(
            row("m3u", { group: null, kind: "channel-name", name: "news hd" })
        )
    );
});
test("channel-name missing group malformed Unicode and foreign kinds refuse", () => {
    for (const locator of [
        { kind: "channel-name", name: "News" },
        { group: "", kind: "channel-name", name: "News" },
        { group: null, kind: "channel-name", name: "\ud800" },
        { group: null, index: 4, kind: "channel-name", name: "News" },
    ])
        assert.equal(codec.normalize(row("m3u", locator)), null);
    for (const provider of ["plex", "local", "vportal"])
        assert.equal(
            codec.normalize(
                row(provider, {
                    group: null,
                    kind: "channel-name",
                    name: "News",
                })
            ),
            null
        );
});
test("receiver must explicitly support the additive kind", () => {
    const doc = {
        entries: [
            row("m3u", { group: null, kind: "channel-name", name: "News" }),
        ],
        version: 1,
    };
    assert.equal(codec.supports(doc, undefined), false);
    assert.equal(codec.supports(doc, ["channel", "plex-media"]), false);
    assert.equal(codec.supports(doc, ["channel-name"]), true);
    assert.equal(codec.supports(doc, ["channel-name", "channel-name"]), false);
    assert.equal(
        JSON.stringify(codec.requiredLocatorKinds(doc)),
        JSON.stringify(["channel-name"])
    );
});
test("name fallback cannot bypass the adapter verifier or origin ambiguity", () => {
    const a = row("m3u", {
        group: "World",
        kind: "channel-name",
        name: "News",
    });
    const current = { origin: a.origin };
    assert.equal(
        codec.match(
            a,
            [current],
            () => false,
            () => true
        ).status,
        "unresolved"
    );
    assert.equal(
        codec.match(
            a,
            [],
            () => true,
            () => true
        ).status,
        "missing"
    );
    assert.equal(
        codec.match(
            a,
            [current, current],
            () => true,
            () => true
        ).status,
        "ambiguous"
    );
});
test("shared channel-name wire fixtures", () => {
    const fixtures = JSON.parse(
        fs.readFileSync(
            path.join(
                __dirname,
                "fixtures/global-favorites-portable/channel-name.fixtures.json"
            ),
            "utf8"
        )
    );
    for (const f of fixtures.cases)
        assert.equal(!!codec.normalize(f.entry), f.valid, f.id);
});
test("nested M3U portal root and actual folder preserve outer origin", () => {
    const fixtures = JSON.parse(
        fs.readFileSync(
            path.join(
                __dirname,
                "fixtures/global-favorites-portable/nested-m3u-vportal.fixtures.json"
            ),
            "utf8"
        )
    );
    for (const f of fixtures.cases) {
        const value = codec.normalize(f.entry);
        assert.equal(!!value, f.valid, f.id);
        if (value) {
            assert.equal(value.origin.provider, "m3u");
            assert.equal(value.origin.subprofile, f.entry.origin.subprofile);
        }
    }
});
test("nested portal does not broaden other provider combinations", () => {
    const locator = { id: "42", idField: "id", kind: "vportal-media" };
    assert(codec.normalize(row("vportal", locator)));
    for (const provider of ["plex", "local", "stalker"])
        assert.equal(codec.normalize(row(provider, locator)), null);
    const doc = { entries: [row("m3u", locator)], version: 1 };
    assert.equal(codec.supports(doc, ["channel"]), false);
    assert.equal(codec.supports(doc, ["vportal-media"]), true);
});
test("exact builtin provider IDs roundtrip and malformed references reject", () => {
    const fixtures = JSON.parse(
        fs.readFileSync(
            path.join(
                __dirname,
                "fixtures/global-favorites-portable/provider-id.fixtures.json"
            ),
            "utf8"
        )
    );
    for (const f of fixtures.cases) {
        let item = row(f.value, { channelId: "stable", kind: "channel" });
        if (f.value === "plex") item = row();
        if (f.value === "local")
            item = row("local", {
                kind: "local-media",
                relativePath: "film.mp4",
                rootAlias: "Movies",
            });
        if (f.value === "vportal")
            item = row("vportal", {
                id: "42",
                idField: "id",
                kind: "vportal-media",
            });
        const value = codec.normalize(item);
        assert.equal(!!value, f.valid, JSON.stringify(f.value));
        if (value) assert.equal(value.origin.provider, f.canonical);
    }
    for (const [left, right] of fixtures.distinct_pairs)
        assert.notEqual(
            codec.identity(row(left, { channelId: "same", kind: "channel" })),
            codec.identity(row(right, { channelId: "same", kind: "channel" }))
        );
});
test("unknown safe registry ID stays portable but is not activated by matching", () => {
    const item = row("unknown/plugin", { channelId: "42", kind: "channel" });
    assert(codec.normalize(item));
    assert.equal(
        codec.match(
            item,
            [],
            () => {
                throw Error("must not load plugin");
            },
            () => true
        ).status,
        "missing"
    );
});
console.log(
    "PASS " +
        cases +
        " pure portable codec cases (no storage, network, browser, build or activation)"
);
