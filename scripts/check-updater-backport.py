#!/usr/bin/env python3
"""Verify the exact published updater source and its ZIP and strict TLS patches."""

import difflib
import hashlib
import json
from pathlib import Path
import tomllib

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "vendor"
SOURCE = VENDOR / "tauri-plugin-updater-2.12.0"
MANIFEST = json.loads((VENDOR / "tauri-plugin-updater-2.12.0.provenance.json").read_text(encoding="utf-8"))
ZIP_VERSION = "9.1.3"
ZIP_CHECKSUM = "1156b39d142a34b999c2310a50455e0cb3760bf7efad0122f796d813bee26ccb"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise SystemExit(message)


def main():
    require(MANIFEST["archiveSha256"] == "7a5cad8ed5948d988e1018ecd31e27cacedbf72ce3fb972940c3e4bf51639e4b", "unexpected published crate")
    require(set(MANIFEST["omittedFiles"]) == {"Cargo.lock"}, "only upstream's unused development lock may be omitted")
    require(set(MANIFEST["patchedFiles"]) == {"Cargo.toml", "Cargo.toml.orig", "src/updater.rs"}, "unexpected patched source")
    actual = set()
    for path in SOURCE.rglob("*"):
        require(not path.is_symlink(), f"unexpected symlink: {path}")
        if path.is_dir():
            continue
        require(path.is_file(), f"unexpected file type: {path}")
        relative = path.relative_to(SOURCE).as_posix()
        actual.add(relative)
        expected = MANIFEST["patchedFiles"].get(relative, MANIFEST["files"].get(relative))
        require(digest(path.read_bytes()) == expected, f"source hash mismatch: {relative}")
    require(actual == set(MANIFEST["files"]) - set(MANIFEST["omittedFiles"]), "published source inventory mismatch")

    patch = ""
    replacements = {
        "Cargo.toml": ('[target.\'cfg(target_os = "windows")\'.dependencies.zip]\nversion = "9"', '[target.\'cfg(target_os = "windows")\'.dependencies.zip]\nversion = "4"'),
        "Cargo.toml.orig": ('zip = { version = "9",', 'zip = { version = "4",'),
    }
    for filename, (changed, original) in replacements.items():
        content = (SOURCE / filename).read_text(encoding="utf-8")
        require(content.count(changed) == 1, f"ZIP constraint mismatch: {filename}")
        restored = content.replace(changed, original)
        require(digest(restored.encode()) == MANIFEST["files"][filename], f"undocumented change: {filename}")
        patch += "".join(difflib.unified_diff(restored.splitlines(True), content.splitlines(True), fromfile="a/" + filename, tofile="b/" + filename))
    require(patch == (VENDOR / "tauri-plugin-updater-2.12.0-zip9.patch").read_text(encoding="utf-8"), "patch receipt mismatch")
    updater = (SOURCE / "src/updater.rs").read_text(encoding="utf-8")
    helper = """// OTTPlay policy: updater metadata and artifacts always require valid TLS.
// Apply this after callbacks. Preconfigured connectors may carry a custom
// verifier, so restore the supported backend before enforcing both flags.
fn enforce_tls_verification(builder: ClientBuilder) -> ClientBuilder {
    #[cfg(feature = "rustls-tls")]
    let builder = builder.tls_backend_rustls();
    #[cfg(all(
        not(feature = "rustls-tls"),
        any(feature = "native-tls", feature = "native-tls-vendored")
    ))]
    let builder = builder.tls_backend_native();
    builder
        .danger_accept_invalid_certs(false)
        .danger_accept_invalid_hostnames(false)
}

"""
    require(updater.count(helper) == 1, "strict TLS helper mismatch")
    restored = updater.replace(helper, "")
    for indent in ("            ", "        "):
        callback = f"{indent}if let Some(ref configure_client) = self.context.configure_client {{\n{indent}    request = configure_client(request);\n{indent}}}"
        hardened = callback + f"\n{indent}request = enforce_tls_verification(request);"
        require(restored.count(hardened) == 1, "TLS verification must follow each callback")
        restored = restored.replace(hardened, callback)
        initial = f"\n{indent}let mut request = ClientBuilder::new().user_agent(UPDATER_USER_AGENT);\n"
        original_options = f"""{indent}if self.context.config.dangerous_accept_invalid_certs {{
{indent}    request = request.danger_accept_invalid_certs(true);
{indent}}}
{indent}if self.context.config.dangerous_accept_invalid_hostnames {{
{indent}    request = request.danger_accept_invalid_hostnames(true);
{indent}}}
"""
        require(restored.count(initial) == 1, "upstream client construction mismatch")
        restored = restored.replace(initial, initial + original_options)
    require(digest(restored.encode()) == MANIFEST["files"]["src/updater.rs"], "undocumented updater source change")
    tls_patch = "".join(difflib.unified_diff(restored.splitlines(True), updater.splitlines(True), fromfile="a/src/updater.rs", tofile="b/src/updater.rs"))
    require(tls_patch == (VENDOR / "tauri-plugin-updater-2.12.0-tls.patch").read_text(encoding="utf-8"), "TLS patch receipt mismatch")
    cargo = tomllib.loads((ROOT / "Cargo.toml").read_text(encoding="utf-8"))
    require(cargo["patch"]["crates-io"]["tauri-plugin-updater"] == {"path": "vendor/tauri-plugin-updater-2.12.0"}, "missing workspace override")
    packages = tomllib.loads((ROOT / "Cargo.lock").read_text(encoding="utf-8"))["package"]
    updater = [p for p in packages if p["name"] == "tauri-plugin-updater"]
    require(len(updater) == 1 and updater[0]["version"] == "2.12.0" and "source" not in updater[0] and "checksum" not in updater[0], "workspace updater must resolve to reviewed local source")
    regression = ROOT / "tests/updater-zip-regression"
    regression_manifest = tomllib.loads((regression / "Cargo.toml").read_text(encoding="utf-8"))
    require(regression_manifest["dev-dependencies"]["zip"] == {"version": "=" + ZIP_VERSION, "default-features": False}, "unexpected regression ZIP pin or features")
    for lock in (ROOT / "Cargo.lock", regression / "Cargo.lock"):
        zip_packages = [p for p in tomllib.loads(lock.read_text(encoding="utf-8"))["package"] if p["name"] == "zip"]
        require(len(zip_packages) == 1 and zip_packages[0]["version"] == ZIP_VERSION and zip_packages[0]["checksum"] == ZIP_CHECKSUM, f"unexpected ZIP lock: {lock}")
    print(f"PASS: updater 2.12.0 published inventory, licenses, ZIP {ZIP_VERSION} and strict TLS patches, and locked graphs")


if __name__ == "__main__":
    main()
