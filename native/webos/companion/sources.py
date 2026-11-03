#!/usr/bin/env python3
"""Collect the companion's locked source closure without rebuilding or downloading.

The result deliberately excludes SDK sources: the native release collector must
attest the helper's final linker inputs and supply its shared runtime supplement.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import importlib.util
import json
import os
import re
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path, PurePosixPath

import tomllib

HERE = Path(__file__).resolve().parent
LOADER = importlib.util.spec_from_file_location("companion_source_build", HERE / "build.py")
build = importlib.util.module_from_spec(LOADER)
LOADER.loader.exec_module(build)
MAX_FILE = 512 * 1024 * 1024
MAX_TOTAL = 4 * 1024 * 1024 * 1024


def fail(message):
    raise ValueError(message)


def safe_name(name):
    path = PurePosixPath(name)
    if (
        not name
        or path.is_absolute()
        or path.as_posix() != name
        or any(p in (".", "..") for p in name.split("/"))
        or "\\" in name
    ):
        fail("Unsafe source path")
    return name


def regular(path):
    if path.is_symlink() or not path.is_file():
        fail("Expected regular source file: " + path.name)
    return path


def tree_files(root):
    result = {}
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            fail("Source symlink is not allowed: " + path.name)
        if path.is_dir():
            continue
        regular(path)
        result[safe_name(path.relative_to(root).as_posix())] = path
    return result


def write_archive(destination, files):
    """Stream deterministic regular members; do not hold a vendor tree in memory."""
    total = 0
    with (
        destination.open("xb") as raw,
        gzip.GzipFile(filename="", fileobj=raw, mode="wb", mtime=0) as zipped,
        tarfile.open(fileobj=zipped, mode="w|") as archive,
    ):
        for name, path in sorted(files.items()):
            safe_name(name)
            size = regular(path).stat().st_size
            total += size
            if size > MAX_FILE or total > MAX_TOTAL:
                fail("Source archive exceeds limits")
            member = tarfile.TarInfo(name)
            member.size, member.mode, member.mtime = size, 0o755 if path.stat().st_mode & 0o111 else 0o644, 0
            with path.open("rb") as content:
                archive.addfile(member, content)


def extract_local(path, source, destination):
    expected = {"source/" + safe_name(row["path"]): row for row in source["local_inputs"]}
    if len(expected) != len(source["local_inputs"]):
        fail("Duplicate source inventory path")
    if hashlib.sha256(build.canonical(source["local_inputs"])).hexdigest() != source["local_inputs_sha256"]:
        fail("Source inventory digest mismatch")
    seen, total = set(), 0
    with tarfile.open(path, "r|gz") as archive:
        for member in archive:
            safe_name(member.name)
            total += member.size
            if not member.isfile() or member.name in seen or member.size > MAX_FILE or total > MAX_TOTAL:
                fail("Invalid local source archive member")
            seen.add(member.name)
            content = archive.extractfile(member)
            if member.name == "source-receipt.json":
                if member.size > 16 * 1024 * 1024 or json.load(content) != source:
                    fail("Embedded source receipt mismatch")
                continue
            row = expected.get(member.name)
            if (
                row is None
                or member.size != row["bytes"]
                or member.mode != row["mode"]
                or member.mode not in (0o644, 0o755)
            ):
                fail("Unexpected local source archive member")
            target = destination / member.name.removeprefix("source/")
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("xb") as output:
                shutil.copyfileobj(content, output)
            target.chmod(member.mode)
            if build.sha(target) != row["sha256"]:
                fail("Local source bytes differ from build inventory")
    if seen != set(expected) | {"source-receipt.json"}:
        fail("Local source archive is incomplete")


def checked_bundle(bundle, source_root, readelf):
    receipt = json.loads(regular(bundle / "receipt.json").read_text())
    source = json.loads(regular(bundle / "source-receipt.json").read_text())
    if receipt.get("schema") != 1 or source.get("schema") != 1:
        fail("Unsupported companion receipt schema")
    names = {
        "local-source.tar.gz": "local_source_archive_sha256",
        "source-receipt.json": "source_receipt_sha256",
        "ottplay-companion.link.map": "link_map_sha256",
    }
    for name, key in names.items():
        if build.sha(regular(bundle / name)) != receipt[key]:
            fail("Companion bundle digest mismatch: " + name)
    extract_local(bundle / "local-source.tar.gz", source, source_root)
    manifest_path = source_root / "native/webos/companion/manifest.json"
    spec = json.loads(manifest_path.read_text())
    if set(spec["required_source_files"]) - {row["path"] for row in source["local_inputs"]}:
        fail("Required companion source file is missing")
    if build.sha(manifest_path) != receipt["manifest_sha256"]:
        fail("Archived build policy digest mismatch")
    if any(receipt[key] != spec[key] for key in ("package", "target", "features")):
        fail("Companion build policy mismatch")
    binary = regular(bundle / "ottplay-companion")
    if build.inspect_elf(binary, build.elf_report(binary, readelf), spec) != receipt["elf"]:
        fail("Companion ELF differs from build receipt")
    if "libglibc_polyfills" in (bundle / "ottplay-companion.link.map").read_text():
        fail("Prohibited SDK runtime archive linked")
    # New bundles carry a real link trace, not a synthesized substitute for it.
    linkage = {
        "elf_sha256": receipt["elf"]["sha256"],
        "map_sha256": receipt["link_map_sha256"],
        "trace_available": False,
    }
    if "link_trace_sha256" in receipt or "link_receipt_sha256" in receipt:
        for name, key in (
            ("ottplay-companion.link.trace", "link_trace_sha256"),
            ("ottplay-companion.link.json", "link_receipt_sha256"),
        ):
            if build.sha(regular(bundle / name)) != receipt.get(key):
                fail("Companion linker evidence digest mismatch")
        record = json.loads((bundle / "ottplay-companion.link.json").read_text())
        for key, value in (
            ("elf_sha256", receipt["elf"]["sha256"]),
            ("map_sha256", receipt["link_map_sha256"]),
            ("trace_sha256", receipt["link_trace_sha256"]),
        ):
            if record.get(key) != value:
                fail("Companion linker receipt mismatch")
        if not record.get("archive_excluded"):
            fail("Companion linker exclusion was not attested")
        build.linker.check_evidence(binary, compiler=readelf.with_name("arm-webos-linux-gnueabi-gcc"))
        sdk = receipt.get("sdk")
        executables = sdk.get("executables") if isinstance(sdk, dict) else None
        if not isinstance(executables, dict):
            fail("Companion SDK compiler hashes are missing from build receipt")
        for outer_key, link_key in (("gcc", "compiler_sha256"), ("gcc_backend", "compiler_backend_sha256")):
            value = executables.get(outer_key)
            if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{64}", value) or record.get(link_key) != value:
                fail("Companion SDK compiler differs from build receipt: " + outer_key)
        linkage.update(
            trace_available=True,
            trace_sha256=receipt["link_trace_sha256"],
            receipt_sha256=receipt["link_receipt_sha256"],
            compiler_sha256=record["compiler_sha256"],
            compiler_backend_sha256=record["compiler_backend_sha256"],
        )
    return receipt, source, spec, linkage


def lock_packages(lock, source):
    external = [
        {k: p[k] for k in ("name", "version", "source", "checksum") if k in p}
        for p in tomllib.loads(lock.read_text())["package"]
        if "source" in p
    ]
    if external != source["cargo_lock_dependencies"]:
        fail("Archived Cargo.lock differs from dependency receipt")
    if any(not row["source"].startswith(("registry+", "git+")) for row in external):
        fail("Unsupported locked dependency source")
    return external


def verify_vendor(vendor, packages):
    """Require exact lock coordinates, Cargo package checksums and every file hash."""
    remaining = list(packages)
    result = []
    for folder in sorted(vendor.iterdir()):
        if folder.is_symlink() or not folder.is_dir():
            fail("Invalid vendored package directory")
        files = tree_files(folder)
        manifest = tomllib.loads((folder / "Cargo.toml").read_text())["package"]
        checksum = json.loads((folder / ".cargo-checksum.json").read_text())
        candidates = [
            row
            for row in remaining
            if row["name"] == manifest["name"]
            and row["version"] == manifest["version"]
            and row.get("checksum") == checksum["package"]
        ]
        if len(candidates) != 1:
            fail("Vendored package does not uniquely match Cargo.lock")
        package = candidates[0]
        if package["source"].startswith("git+") and not re.search(r"#[0-9a-f]{40}$", package["source"]):
            fail("Git source lacks an exact locked commit")
        expected = checksum["files"]
        if set(files) != set(expected) | {".cargo-checksum.json"}:
            fail("Vendored package file set differs from checksum manifest")
        for name, digest in expected.items():
            safe_name(name)
            if build.sha(files[name]) != digest:
                fail("Vendored package file checksum mismatch")
        remaining.remove(package)
        result.append(
            {
                **package,
                "directory": folder.name,
                "license": manifest.get("license"),
                "license_file": manifest.get("license-file"),
                "checksum_manifest_sha256": build.sha(folder / ".cargo-checksum.json"),
                "files": len(expected),
            }
        )
    if remaining:
        fail("Missing locked vendored packages: " + ", ".join(row["name"] for row in remaining[:12]))
    return result


def vendor_config(text, vendor):
    config = tomllib.loads(text)
    replaced = False
    for row in config.get("source", {}).values():
        if "directory" in row:
            if Path(row["directory"]).resolve() != vendor.resolve():
                fail("Unexpected Cargo vendor directory")
            replaced = True
    if not replaced:
        fail("Cargo did not provide source replacement configuration")
    # Cargo prints TOML quoting for paths, including backslash escapes.
    text = text.replace(json.dumps(str(vendor)), '"cargo-vendor"')
    if str(vendor) in text:
        fail("Absolute vendor path was not normalized")
    return text


def rust_sources(sysroot, archive, receipt, spec):
    identity = build.run([str(sysroot / "bin/rustc"), "--version", "--verbose"]).strip()
    if identity != receipt["rustc"]:
        fail("Rust compiler differs from companion build")
    build.validate_rust_identity(identity, spec)
    commit = re.search(r"^commit-hash: ([0-9a-f]{40})$", identity, re.MULTILINE)
    if not commit:
        fail("Rust compiler commit is missing")
    manifest_file = regular(sysroot / "lib/rustlib/multirust-channel-manifest.toml")
    manifest = tomllib.loads(manifest_file.read_text())
    for name in ("rustc", "rust-src", "rust-std"):
        version = manifest["pkg"][name]["version"]
        if not version.startswith(spec["rust_toolchain"] + " (" + commit[1][:9] + " "):
            fail("Rust channel manifest does not match build commit")
    pinned = manifest["pkg"]["rust-src"]["target"]["*"]
    digest = build.sha(regular(archive))
    if digest not in (pinned["hash"], pinned.get("xz_hash")):
        fail("Rust source archive checksum differs from channel manifest")
    # Hash verification attests the actual component archive, not only the
    # mutable installed rust-src tree. Also check the expected source layout.
    marker = "rust-src-" + spec["rust_toolchain"] + "/rust-src/lib/rustlib/src/rust/library/Cargo.lock"
    with tarfile.open(archive, "r:*") as content:
        if not any(member.name == marker and member.isfile() for member in content):
            fail("Rust source component layout is incomplete")
    notices = tree_files(sysroot / "share/doc/rust/licenses")
    if not notices:
        fail("Rust license files are missing")
    files = {"licenses/" + name: path for name, path in notices.items()}
    for name in ("COPYRIGHT.html", "COPYRIGHT-library.html"):
        files[name] = regular(sysroot / "share/doc/rust" / name)
    files["channel-manifest.toml"] = manifest_file
    return {
        "toolchain": spec["rust_toolchain"],
        "commit": commit[1],
        "archive_sha256": digest,
        "channel_manifest_sha256": build.sha(manifest_file),
        "source_archive_hash_verified": True,
    }, files


README = """Companion source supplement

This archive contains the exact local source archive recorded by the helper
build, all external packages in its complete workspace Cargo.lock, the matching
Rust source component, license notices, and build/source receipts. The vendor
tree intentionally includes dependencies for other targets and optional features.

To restore: extract local-source.tar.gz, then extract cargo-vendor.tar.gz into
the resulting source/ workspace. Save cargo-config.toml as source/.cargo/config.toml
(merge explicitly if a configuration already exists). Use the Rust version and
ARM target in SOURCE-MANIFEST.json with the matching webOS SDK, then run
src-rs/companion/build-webos.py with --sdk and --target-dir. The source archive
supplies Rust runtime sources; building uses that release's prebuilt ARM std.
No private Cargo cache, tokens, live settings, or SDK binaries are included.

This supplement is NOT by itself complete corresponding source. The enclosing
native release MUST bind this helper's ELF/map/trace hashes to the final IPK,
verify every linked SDK input against the pinned SDK archive, and supply its
shared GCC/glibc/Buildroot runtime source supplement. No rebuild or bit-identical
reproducibility is claimed. Keep this supplement and the enclosing source set
together. Review the individual LICENSE/COPYING files; no new license is granted.
"""


def collect(args):
    output = args.output.resolve()
    if output.exists():
        fail("Use a new source output directory")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="companion-sources-", dir=output.parent) as temporary:
        work = Path(temporary)
        root = work / "source"
        root.mkdir()
        receipt, source, spec, linkage = checked_bundle(args.bundle.resolve(), root, args.readelf)
        packages = lock_packages(root / "Cargo.lock", source)
        sysroot = args.rust_sysroot
        if sysroot is None:
            sysroot = Path(build.run(["rustc", "+" + spec["rust_toolchain"], "--print", "sysroot"]).strip())
        rust, notices = rust_sources(sysroot.resolve(), args.rust_source_archive, receipt, spec)
        vendor = work / "vendor"
        env = {
            **os.environ,
            "CARGO_NET_OFFLINE": "true",
            "RUSTUP_AUTO_INSTALL": "0",
            "CARGO_INCREMENTAL": "0",
            "RUSTUP_TOOLCHAIN": spec["rust_toolchain"],
            "RUSTC": str(sysroot / "bin/rustc"),
        }
        # No build is invoked. --offline prohibits downloading missing packages.
        command = [
            str(sysroot / "bin/cargo"),
            "vendor",
            "--offline",
            "--locked",
            "--versioned-dirs",
            "--manifest-path",
            str(root / "Cargo.toml"),
            str(vendor),
        ]
        config = vendor_config(build.run(command, cwd=root, env=env), vendor)
        components = verify_vendor(vendor, packages)
        staging = work / "output"
        staging.mkdir()
        write_archive(
            staging / "cargo-vendor.tar.gz", {"cargo-vendor/" + name: path for name, path in tree_files(vendor).items()}
        )
        write_archive(staging / "rust-notices.tar.gz", notices)
        with args.rust_source_archive.open("rb") as content:
            rust_name = (
                "rust-src-" + spec["rust_toolchain"] + (".tar.xz" if content.read(6) == b"\xfd7zXZ\x00" else ".tar.gz")
            )
        payload = {
            "local-source.tar.gz": args.bundle / "local-source.tar.gz",
            "build-receipt.json": args.bundle / "receipt.json",
            "source-receipt.json": args.bundle / "source-receipt.json",
            rust_name: args.rust_source_archive,
            "cargo-vendor.tar.gz": staging / "cargo-vendor.tar.gz",
            "rust-notices.tar.gz": staging / "rust-notices.tar.gz",
            "collector/native/webos/companion/sources.py": Path(__file__),
            "collector/native/webos/companion/build.py": HERE / "build.py",
            "collector/native/webos/companion/manifest.json": HERE / "manifest.json",
            "collector/src-rs/companion/webos_link.py": build.ROOT / "src-rs/companion/webos_link.py",
        }
        for name, data in (
            ("cargo-config.toml", config.encode()),
            ("cargo-components.json", build.canonical(components)),
            ("README.txt", README.encode()),
        ):
            path = staging / name
            path.write_bytes(data)
            payload[name] = path
        manifest = {
            "schema": 1,
            "package": spec["package"],
            "target": spec["target"],
            "features": spec["features"],
            "local_inputs_sha256": source["local_inputs_sha256"],
            "cargo_lock_sha256": build.sha(root / "Cargo.lock"),
            "dependency_scope": source["dependency_scope"],
            "dependency_count": len(components),
            "rust": rust,
            "files": {
                name: {"sha256": build.sha(path), "bytes": path.stat().st_size}
                for name, path in sorted(payload.items())
            },
            "sdk_linkage": linkage,
            "sdk_archive_sha256": receipt["sdk"]["archive_sha256"],
            "complete_corresponding_source": False,
            "sdk_runtime_source_coverage": "PENDING_ENCLOSING_RELEASE",
            "rebuild_validation": "NOT_RUN",
            "bit_identical_rebuild": "NOT_PROVEN",
        }
        (staging / "SOURCE-MANIFEST.json").write_bytes(build.canonical(manifest))
        payload["SOURCE-MANIFEST.json"] = staging / "SOURCE-MANIFEST.json"
        archive = staging / "companion-source.tar.gz"
        write_archive(archive, payload)
        external = {
            "schema": 1,
            "source_archive": {"file": archive.name, "sha256": build.sha(archive), "bytes": archive.stat().st_size},
            "source_manifest_sha256": build.sha(staging / "SOURCE-MANIFEST.json"),
            "local_source_archive_sha256": receipt["local_source_archive_sha256"],
            "source_receipt_sha256": receipt["source_receipt_sha256"],
            "elf_sha256": receipt["elf"]["sha256"],
            "local_inputs_sha256": source["local_inputs_sha256"],
            "cargo_lock_sha256": manifest["cargo_lock_sha256"],
            "dependency_count": len(components),
            "rust": rust,
            "sdk_linkage": linkage,
            "sdk_archive_sha256": manifest["sdk_archive_sha256"],
            "locked_source_coverage": "PASS",
            "sdk_runtime_source_coverage": "PENDING_ENCLOSING_RELEASE",
            "complete_corresponding_source": False,
            "rebuild_validation": "NOT_RUN",
        }
        delivery = work / "delivery"
        delivery.mkdir()
        shutil.move(archive, delivery / archive.name)
        (delivery / "source-closure.json").write_bytes(build.canonical(external))
        shutil.move(staging / "SOURCE-MANIFEST.json", delivery / "SOURCE-MANIFEST.json")
        delivery.rename(output)
    print(
        json.dumps(
            {
                "output": str(output),
                "source_archive_sha256": external["source_archive"]["sha256"],
                "complete_corresponding_source": False,
            }
        )
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path, help="New directory; parent holds temporary source files")
    parser.add_argument("--readelf", required=True, type=Path)
    parser.add_argument(
        "--rust-source-archive",
        required=True,
        type=Path,
        help="Exact rust-src component archive; never downloaded here",
    )
    parser.add_argument("--rust-sysroot", type=Path)
    args = parser.parse_args()
    try:
        collect(args)
    except (ValueError, OSError, KeyError, subprocess.CalledProcessError) as error:
        parser.exit(1, "Companion source collection failed: " + str(error) + "\n")


if __name__ == "__main__":
    main()
