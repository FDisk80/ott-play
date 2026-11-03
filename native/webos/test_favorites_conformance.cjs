#!/usr/bin/env node
// biome-ignore-all assist/source/useSortedKeys: JSON insertion order is part of the frozen serialized conformance vectors, including the generated envelope.
"use strict";

// Build/check native fixtures with the actual browser codec and strict JSON
// boundary. No second implementation of the portable format lives in this test.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load } = require("../../tests/global-favorites-fixture.cjs");
const codec = load(
    "src/settings/global-favorites-portable.ts"
).createGlobalFavoritesPortableCodec();
const { parseFavoritesDocumentJson } = load(
    "src/commands/favorites-document-json.ts"
);
const fixtureRoot = path.resolve(
    __dirname,
    "../../tests/fixtures/global-favorites-portable"
);
const read = (name) =>
    JSON.parse(fs.readFileSync(path.join(fixtureRoot, name), "utf8"));
const copy = (value) => JSON.parse(JSON.stringify(value));
const baseline = {
    title: "News",
    origin: {
        provider: "m3u",
        profile: "Home",
        sourceAlias: "Home",
        subprofile: null,
    },
    locator: { kind: "channel", channelId: "m3u-epg:news" },
};
const cases = [];
function add(id, raw, expected) {
    let doc = null;
    try {
        doc = codec.document(
            parseFavoritesDocumentJson(Buffer.from(raw, "utf8"))
        );
    } catch (_) {
        /* Expected for invalid JSON/UTF-8 or duplicate keys. */
    }
    const accepted = !!doc;
    if (expected !== undefined) assert.equal(accepted, expected, id);
    const result = { id, json: raw, accepted };
    if (doc) {
        result.canonical = JSON.stringify(doc);
        result.identities = doc.entries.map((entry) => codec.identity(entry));
    }
    cases.push(result);
}
function entry(id, row, expected) {
    add(id, JSON.stringify({ version: 1, entries: [row] }), expected);
}
add("portable-example", JSON.stringify(read("example.json")), true);
for (const file of [
    "channel-name.fixtures.json",
    "nested-m3u-vportal.fixtures.json",
]) {
    for (const c of read(file).cases)
        entry(file + "/" + c.id, c.entry, c.valid);
}
for (const [i, c] of read("provider-id.fixtures.json").cases.entries()) {
    const row = copy(baseline);
    row.origin.provider = c.value;
    // Reserved media providers require their own locator; this fixture only
    // tests generic provider IDs, leaving those to the shared example.
    if (["plex", "local", "vportal"].includes(c.value)) continue;
    entry("provider-id/" + i, row, c.valid);
}
const textFixture = read("text-semantics.fixtures.json");
for (const c of textFixture.cases) {
    const row = copy(baseline);
    row.origin.profile = c.value;
    entry("text/" + c.id, row, c.expected);
}
for (const point of textFixture.trim_codepoints) {
    for (const side of ["before", "after"]) {
        const row = copy(baseline);
        const space = String.fromCodePoint(point);
        row.origin.sourceAlias =
            side === "before" ? space + "Root" : "Root" + space;
        entry("trim/" + point + "/" + side, row, false);
    }
}
for (const version of ["1", "1.0", "1e0", "1.000e+0"]) {
    add("version/" + version, '{"version":' + version + ',"entries":[]}', true);
}
for (const version of [
    '"1"',
    "true",
    "null",
    "0",
    "2",
    "1.1",
    "-1",
    "256",
    "0.99999999999999994",
]) {
    add(
        "version-invalid/" + version,
        '{"version":' + version + ',"entries":[]}',
        false
    );
}
add("duplicate-json-key", '{"version":1,"version":1,"entries":[]}', false);
add(
    "duplicate-escaped-json-key",
    '{"version":1,"\\u0076ersion":1,"entries":[]}',
    false
);
add("trailing-json", '{"version":1,"entries":[]} null', false);
add(
    "unknown-document-field",
    '{"version":1,"entries":[],"token":"synthetic"}',
    false
);
add("missing-document-version", '{"entries":[]}', false);
add("missing-document-entries", '{"version":1}', false);
add(
    "duplicate-entry",
    JSON.stringify({ version: 1, entries: [baseline, baseline] }),
    false
);
const renamed = copy(baseline);
renamed.title = "Renamed";
add(
    "duplicate-identity-renamed",
    JSON.stringify({ version: 1, entries: [baseline, renamed] }),
    false
);
const anotherProfile = copy(baseline);
anotherProfile.origin.profile = "Away";
anotherProfile.origin.sourceAlias = "Away";
add(
    "same-channel-distinct-profile",
    JSON.stringify({ version: 1, entries: [baseline, anotherProfile] }),
    true
);
for (const key of ["provider", "profile", "sourceAlias", "subprofile"]) {
    const row = copy(baseline);
    delete row.origin[key];
    entry("missing-origin/" + key, row, false);
}
for (const key of ["title", "origin", "locator"]) {
    const row = copy(baseline);
    delete row[key];
    entry("missing-entry/" + key, row, false);
}
for (const scope of ["entry", "origin", "locator"]) {
    const row = copy(baseline);
    (scope === "entry" ? row : row[scope]).url =
        "https://example.invalid/private";
    entry("unexpected-url/" + scope, row, false);
}
for (const relativePath of [
    "Films/Example.mkv",
    "../Example.mkv",
    "/Example.mkv",
    "C:/Example.mkv",
    "a//Example.mkv",
    "a/./Example.mkv",
    "a\\Example.mkv",
]) {
    const row = copy(baseline);
    row.origin = {
        provider: "local",
        profile: "Offline",
        sourceAlias: "Films",
        subprofile: null,
    };
    row.locator = { kind: "local-media", rootAlias: "Films", relativePath };
    entry(
        "local-path/" + relativePath,
        row,
        relativePath === "Films/Example.mkv"
    );
}
for (const provider of ["xtream", "stalker"]) {
    const row = copy(baseline);
    row.origin.provider = provider;
    row.locator = { kind: "channel-name", name: "Documentary", group: "Films" };
    entry("name-fallback/" + provider, row, true);
}
// Codec values originate in the VM test realm. Normalize prototypes before
// comparing the serialized interchange artifact with the freshly generated one.
const generated = JSON.parse(JSON.stringify({ version: 1, cases }));
const [mode, target] = process.argv.slice(2);
if (mode === "--write" && target) {
    fs.writeFileSync(target, JSON.stringify(generated, null, 2) + "\n");
} else if (mode === "--check" && target) {
    assert.deepEqual(
        JSON.parse(fs.readFileSync(target, "utf8")),
        generated,
        "Native fixtures no longer match the real browser codec"
    );
} else {
    throw new Error(
        "Usage: node native/webos/test_favorites_conformance.cjs --write|--check <native-fixture.json>"
    );
}
console.log("Favorites browser/native fixtures: " + cases.length + " passed");
