const assert = require("node:assert/strict");
const {
    checkDependencies,
    readDependencies,
} = require("../scripts/check-tauri-dependencies.cjs");

const current = readDependencies();
checkDependencies(current);
let rejectedCases = 0;
function rejects(change, message) {
    const fixture = structuredClone(current);
    change(fixture);
    assert.throws(() => checkDependencies(fixture), message);
    rejectedCases += 1;
}

// Both direct updater updates and its transitive API updates can break the
// native protocol, even when npm installs successfully.
for (const name of ["@tauri-apps/plugin-updater", "@tauri-apps/api"]) {
    rejects((f) => {
        const location = Object.keys(f.npmLock.packages).find((key) =>
            key.endsWith(`node_modules/${name}`)
        );
        f.npmLock.packages[location].version = "2.99.0";
    }, /must match Rust/);
}
rejects((f) => {
    f.npmLock.packages["node_modules/nested/node_modules/@tauri-apps/api"] = {
        version: "2.99.0",
    };
}, /must match Rust/);
rejects((f) => {
    f.cargoLock = f.cargoLock.replace(
        /name = "tauri-plugin-updater"\nversion = "[^"]+"/,
        'name = "tauri-plugin-updater"\nversion = "2.99.0"'
    );
}, /must match Rust/);

for (const [name, version] of [
    ["wry", "0.55.1"],
    ["tao", "0.35.3"],
    ["glib", "0.18.5"],
    ["block", "0.1.6"],
    ["librqbit", "9.1.0"],
]) {
    const entry = `name = "${name}"\nversion = "${version}"`;
    // Keeping the patch stanza must not mask a registry-resolved package.
    rejects((f) => {
        f.cargoLock = f.cargoLock.replace(
            entry,
            entry +
                '\nsource = "registry+https://github.com/rust-lang/crates.io-index"'
        );
    }, /must resolve locally/);
    // Cargo can leave a retired path patch under [[patch.unused]]. It is not
    // a selected package, even if its name/version still appears in the lock.
    rejects((f) => {
        f.cargoLock = f.cargoLock.replace(
            `[[package]]\n${entry}`,
            `[[patch.unused]]\n${entry}`
        );
    }, /must have one resolved package/);
    rejects((f) => {
        f.cargoLock += `\n[[package]]\nname = "${name}"\nversion = "99.0.0"\n`;
    }, /must have one resolved package/);
    rejects((f) => {
        f.workspace = f.workspace.replace(
            `path = "vendor/${name}-${version}"`,
            `path = "../unreviewed/${name}"`
        );
    }, /reviewed vendor directory/);
    const declaration = `${name} = { path = "vendor/${name}-${version}" }`;
    rejects((f) => {
        f.workspace = f.workspace.replace(
            declaration,
            `# ${declaration}\n${name} = { path = "../unreviewed/${name}" }`
        );
    }, /reviewed vendor directory/);
    rejects((f) => {
        f.workspace = f.workspace.replace(
            declaration,
            `${name} = { path = "../unreviewed/${name}" } # ${declaration}`
        );
    }, /reviewed vendor directory/);
    rejects((f) => {
        f.workspace = f.workspace.replace(
            declaration,
            `${declaration}\n${declaration}`
        );
    }, /duplicate patch/);
}

rejects((f) => {
    f.workspace = f.workspace.replace(
        "[patch.crates-io]",
        "# [patch.crates-io]"
    );
}, /one active patch.crates-io table/);
rejects((f) => {
    f.workspace +=
        '\n[patch.crates-io]\nwry = { path = "../unreviewed/wry" }\n';
}, /one active patch.crates-io table/);
rejects((f) => {
    f.workspace = f.workspace
        .replace(
            "[patch.crates-io]",
            '# [patch.crates-io]\n# wry = { path = "vendor/wry-0.55.1" }\n[patch.crates-io]'
        )
        .replace(
            'wry = { path = "vendor/wry-0.55.1" }\ntao',
            'wry = { path = "../unreviewed/wry" }\ntao'
        );
}, /reviewed vendor directory/);
rejects((f) => {
    f.workspace = f.workspace.replace(
        'wry = { path = "vendor/wry-0.55.1" }',
        'wry = { path = "vendor/wry-0.55.1", path = "../unreviewed/wry" }'
    );
}, /single-line path-only declarations/);
for (const quote of ['"""', "'''"]) {
    rejects((f) => {
        f.workspace = `[workspace.metadata]\nnotes = ${quote}\n${f.workspace}\n${quote}\n`;
    }, /does not support multiline TOML strings/);
}
const commented = structuredClone(current);
commented.workspace = commented.workspace
    .replace(
        "[patch.crates-io]",
        "# [patch.crates-io]\n  [patch.crates-io] # active patches"
    )
    .replace(
        'wry = { path = "vendor/wry-0.55.1" }',
        '  wry={path="vendor/wry-0.55.1"} # reviewed patch'
    );
checkDependencies(commented);
console.log(
    `PASS Tauri dependency guard: ${rejectedCases} rejected regressions`
);

// Exercise the real CLI from an unrelated cwd: its source root must come from
// __dirname, and provenance must validate both reviewed patches together.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const repository = path.resolve(__dirname, "..");
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ott-backport-"));
const checker = "scripts/check-macos-drag-backport.cjs";
const taoRoot = "vendor/tao-0.35.3/";
const taoManifest = "vendor/tao-0.35.3.provenance.json";
const aspectPatch = "vendor/tao-0.35.3-window-aspect.patch";
const aspectSource = "src/platform/unix.rs";
const digest = (data) => crypto.createHash("sha256").update(data).digest("hex");
let rejectedBackports = 0;

function invokeBackport() {
    const result = spawnSync(
        process.execPath,
        [path.join(fixtureRoot, checker)],
        {
            cwd: os.tmpdir(),
            encoding: "utf8",
            maxBuffer: 128 * 1024,
            timeout: 10000,
        }
    );
    assert.ifError(result.error);
    assert.equal(result.signal, null, "backport checker must exit normally");
    return result;
}

function rejectsBackport(label, change, pattern = /AssertionError/) {
    const backups = new Map();
    function remember(relative) {
        const file = path.join(fixtureRoot, relative);
        if (!backups.has(file))
            backups.set(
                file,
                fs.existsSync(file) ? fs.readFileSync(file) : null
            );
        return file;
    }
    const io = {
        edit(relative, transform) {
            const file = remember(relative);
            fs.writeFileSync(file, transform(fs.readFileSync(file, "utf8")));
        },
        link(relative, target) {
            // Directory junctions also work without symlink privileges on Windows.
            fs.symlinkSync(
                path.join(fixtureRoot, target),
                remember(relative),
                "junction"
            );
        },
        put(relative, value) {
            fs.writeFileSync(remember(relative), value);
        },
        remove(relative) {
            fs.unlinkSync(remember(relative));
        },
    };
    try {
        change(io);
        const result = invokeBackport();
        assert.equal(
            result.status,
            1,
            label + " must be rejected\n" + result.stderr
        );
        assert.match(result.stderr, pattern, label);
        rejectedBackports += 1;
    } finally {
        for (const [file, original] of [...backups].reverse()) {
            fs.rmSync(file, { force: true, recursive: true });
            if (original !== null) fs.writeFileSync(file, original);
        }
    }
}

function editTaoManifest(io, transform) {
    io.edit(taoManifest, (text) => {
        const manifest = JSON.parse(text);
        transform(manifest);
        return JSON.stringify(manifest, null, 2) + "\n";
    });
}

function editAspectPatch(io, transform) {
    let modified;
    io.edit(aspectPatch, (text) => {
        modified = transform(text);
        assert.notEqual(
            modified,
            text,
            "negative patch fixture must change bytes"
        );
        return modified;
    });
    editTaoManifest(io, (manifest) => {
        manifest.aspectPatchSha256 = digest(modified);
    });
}

try {
    for (const relative of [
        checker,
        "Cargo.toml",
        "Cargo.lock",
        "vendor/wry-0.55.1",
        "vendor/wry-0.55.1.provenance.json",
        "vendor/wry-0.55.1-macos-drag-pasteboard.patch",
        "vendor/tao-0.35.3",
        taoManifest,
        "vendor/tao-0.35.3-macos-drag-pasteboard.patch",
        aspectPatch,
    ]) {
        const destination = path.join(fixtureRoot, relative);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.cpSync(path.join(repository, relative), destination, {
            recursive: true,
        });
    }
    const accepted = invokeBackport();
    assert.equal(accepted.status, 0, accepted.stderr);
    for (const crate of ["wry-0.55.1", "tao-0.35.3"])
        assert(
            accepted.stdout.includes("OK: " + crate),
            crate + " was checked"
        );

    for (const relative of [
        "vendor/wry-0.55.1/src/wkwebview/drag_drop.rs",
        taoRoot + "src/platform_impl/macos/window_delegate.rs",
        taoRoot + aspectSource,
        taoRoot + "Cargo.toml",
    ])
        rejectsBackport(
            "source bytes: " + relative,
            (io) => {
                io.edit(relative, (text) => text + "\n// unreviewed source\n");
            },
            /must match its published or patched hash/
        );

    rejectsBackport("extra published file", (io) => {
        io.put(taoRoot + "unreviewed.rs", "// unreviewed\n");
    });
    rejectsBackport("missing published file", (io) => {
        io.remove(taoRoot + "Cargo.toml");
    });
    try {
        rejectsBackport(
            "source symlink",
            (io) => {
                io.link(taoRoot + "unreviewed-link", "vendor/wry-0.55.1");
            },
            /vendored source cannot use symlinks/
        );
    } catch (error) {
        if (
            process.platform !== "win32" ||
            !["EPERM", "EACCES"].includes(error.code) ||
            error.syscall !== "symlink"
        )
            throw error;
        console.log(
            "SKIP source symlink: Windows denied fixture link creation (" +
                error.code +
                ")"
        );
    }
    rejectsBackport("missing aspect patchedFile", (io) => {
        editTaoManifest(io, (manifest) => {
            delete manifest.patchedFiles[aspectSource];
        });
    });
    rejectsBackport("extra aspect patchedFile", (io) => {
        editTaoManifest(io, (manifest) => {
            manifest.patchedFiles["Cargo.toml"] = manifest.files["Cargo.toml"];
        });
    });
    for (const relative of [
        "vendor/tao-0.35.3-macos-drag-pasteboard.patch",
        aspectPatch,
    ])
        rejectsBackport("unbound patch bytes: " + relative, (io) => {
            io.edit(relative, (text) => text + "\n");
        });

    for (const [label, transform] of [
        ["duplicate aspect chunk", (chunks) => [...chunks, chunks[0]]],
        ["omitted aspect chunk", (chunks) => chunks.slice(1)],
        [
            "unknown aspect chunk",
            (chunks) => [
                chunks[0].replaceAll(aspectSource, "src/unreviewed.rs"),
                ...chunks.slice(1),
            ],
        ],
    ])
        rejectsBackport(label, (io) => {
            editAspectPatch(io, (text) => {
                const chunks = text.split(/(?=^--- a\/)/m).filter(Boolean);
                assert.equal(chunks.length, 5);
                return transform(chunks).join("");
            });
        });

    {
        const text = fs.readFileSync(
            path.join(fixtureRoot, aspectPatch),
            "utf8"
        );
        const header = /^@@ -(\d+),(\d+) (\+\d+,\d+ @@)$/m.exec(text);
        assert(header, "negative fixture needs an actual aspect hunk header");
        const count = Number(header[2]);
        const invalidHeader = `@@ -${header[1]},${count + 1} ${header[3]}`;
        rejectsBackport(
            "bad aspect hunk count with updated patch hash",
            (io) => {
                editAspectPatch(io, (current) => {
                    assert.equal(current, text, "mutate the inspected patch");
                    return current.replace(header[0], invalidHeader);
                });
            },
            new RegExp(`${count} !== ${count + 1}[\\s\\S]*at originalSource`)
        );
    }
    rejectsBackport("reverse context with updated patchedFile hash", (io) => {
        let modified;
        io.edit(taoRoot + aspectSource, (text) => {
            modified = text.replace(
                "use self::x11::xdisplay::XConnection;",
                "use self::x11::xdisplay::XConnection; // changed context"
            );
            assert.notEqual(modified, text);
            return modified;
        });
        editTaoManifest(io, (manifest) => {
            manifest.patchedFiles[aspectSource] = digest(modified);
        });
    });
    rejectsBackport(
        "original hash with updated patchedFile hash",
        (io) => {
            let modified;
            io.edit(taoRoot + aspectSource, (text) => {
                modified = text + "\n// unreviewed original tail\n";
                return modified;
            });
            editTaoManifest(io, (manifest) => {
                manifest.patchedFiles[aspectSource] = digest(modified);
            });
        },
        /aspect patch must recover the published source/
    );
    rejectsBackport(
        "changed removed line with updated patch hash",
        (io) => {
            editAspectPatch(io, (text) =>
                text.replace(
                    "-  traits::{GtkWindowExt, WidgetExt},",
                    "-  traits::{GtkWindowExt, WidgetExt, UnreviewedTrait},"
                )
            );
        },
        /aspect patch must recover the published source/
    );

    rejectsBackport(
        "GTK namespace regression with updated patchedFile hash",
        (io) => {
            const source = "src/platform_impl/linux/util.rs";
            let modified;
            io.edit(taoRoot + source, (text) => {
                assert.equal(
                    (text.match(/gdk_x11_sys::/g) || []).length,
                    6,
                    "fixture must contain all six corrected GTK references"
                );
                modified = text.replaceAll("gdk_x11_sys::", "gdkx11_sys::");
                return modified;
            });
            editTaoManifest(io, (manifest) => {
                manifest.patchedFiles[source] = digest(modified);
            });
        },
        /gdk_x11_sys::/
    );

    const restored = invokeBackport();
    assert.equal(restored.status, 0, "fixture restoration\n" + restored.stderr);
    console.log(
        `PASS backport CLI: valid fixture and ${rejectedBackports} rejected regressions`
    );
} finally {
    fs.rmSync(fixtureRoot, { force: true, recursive: true });
}
