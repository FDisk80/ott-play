"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const read = (file) =>
    JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const expected = {
    avi: "video/x-msvideo",
    m4v: "video/mp4",
    mkv: "video/x-matroska",
    mp4: "video/mp4",
    ogv: "video/ogg",
    webm: "video/webm",
};
function associations(platform) {
    const config = read("src-tauri/tauri." + platform + ".conf.json");
    assert.deepEqual(Object.keys(config).sort(), ["$schema", "bundle"]);
    assert.deepEqual(
        Object.keys(config.bundle).sort(),
        platform === "linux"
            ? ["fileAssociations", "linux"]
            : ["fileAssociations"]
    );
    const result = {};
    for (const association of config.bundle.fileAssociations) {
        assert.equal(association.role, "Viewer");
        assert.equal(association.rank, "Alternate");
        assert.ok(association.ext.length > 0);
        for (const extension of association.ext) {
            assert.equal(Object.hasOwn(result, extension), false);
            result[extension] = association.mimeType;
        }
    }
    return result;
}

test("macOS registers only native supported video types as an alternate viewer", () => {
    assert.deepEqual(associations("macos"), expected);
    const source = fs.readFileSync(
        path.join(root, "src-rs/core/src/offline_media.rs"),
        "utf8"
    );
    const admission = source.slice(
        source.indexOf("pub async fn transient_video(")
    );
    const list = admission.match(
        /if !matches!\(\s*extension\.as_str\(\),([\s\S]*?)\)\s*\{/
    );
    assert.ok(
        list,
        "read the actual native admission, not an unrelated media list"
    );
    const admitted = Array.from(
        list[1].matchAll(/"([a-z0-9]+)"/g),
        (match) => match[1]
    );
    assert.deepEqual(admitted.sort(), Object.keys(expected).sort());
});

test("Linux desktop associations use video MIME types without audio or playlist takeover", () => {
    assert.deepEqual(associations("linux"), expected);
});

test("global and Windows packaging do not opt into Tauri's default-assignment associations", () => {
    assert.equal(
        read("src-tauri/tauri.conf.json").bundle.fileAssociations,
        undefined
    );
    const windows = path.join(root, "src-tauri/tauri.windows.conf.json");
    if (fs.existsSync(windows)) {
        const value = JSON.parse(fs.readFileSync(windows, "utf8"));
        assert.equal((value.bundle?.fileAssociations || []).length, 0);
    }
});

// Tauri 2.12.4 AppImage uses debian::generate_data and its desktop template.
test("Linux DEB, RPM and AppImage desktop launch forwards file URLs", () => {
    const config = read("src-tauri/tauri.linux.conf.json");
    const linux = config.bundle.linux;
    assert.ok(
        linux,
        "Linux associations need an argument-forwarding desktop template"
    );
    assert.equal(linux.deb.desktopTemplate, linux.rpm.desktopTemplate);
    assert.equal(
        linux.appimage?.desktopTemplate,
        undefined,
        "not a Tauri AppImage option"
    );
    const template = fs.readFileSync(
        path.join(root, "src-tauri", linux.deb.desktopTemplate),
        "utf8"
    );
    const command = template
        .split(/\r?\n/)
        .filter((line) => line.startsWith("Exec="));
    assert.deepEqual(command, ["Exec={{exec}} %U"]);
    assert.ok(template.includes("MimeType={{mime_type}}"));
    assert.ok(template.includes("Name={{name}}"));
    assert.ok(template.includes("Icon={{icon}}"));
    assert.ok(template.includes("Terminal=false"));
    assert.equal(template.includes("sh -c"), false);
});
