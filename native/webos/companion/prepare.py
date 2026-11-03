#!/usr/bin/env python3
"""Prepare pinned native-companion CI inputs; emit JSON and never compile.

Requires Python 3.11+, rustup and a host libclang. On Ubuntu 24.04 install
libclang-18-dev before running. See PREPARATION.md for sequential build commands.
"""

from __future__ import annotations

import argparse
import ctypes
import fnmatch
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import tomllib

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
RUST_VERSION = "1.96.1"
RUST_COMMIT = json.loads((HERE / "manifest.json").read_text())["rust_commit"]
RUST_SOURCE_URL = "https://static.rust-lang.org/dist/2026-06-30/rust-src-1.96.1.tar.xz"
RUST_SOURCE_SHA256 = "b343b6553bc772225f6a2b5be5055017f29794dcf4e08020366b27a0a40fc1c2"
SOURCE_LIMIT = 64 * 1024 * 1024
LIBCLANG_DIRS = (Path("/usr/lib/llvm-18/lib"), Path("/opt/homebrew/opt/llvm/lib"))


def fail(message):
    raise ValueError(message)


def sha(path):
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def run(command, env):
    result = subprocess.run(command, env=env, text=True, stdout=subprocess.PIPE, stderr=sys.stderr, check=True)
    return result.stdout.strip()


class PinnedRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        url = urllib.parse.urlsplit(newurl)
        if url.scheme != "https" or url.hostname != "static.rust-lang.org" or url.username or url.password:
            fail("Rust source download redirected outside the pinned HTTPS host")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def source_archive(cache, opener=None):
    destination = cache / "rust-src-1.96.1.tar.xz"
    if destination.is_symlink():
        fail("Rust source cache entry must not be a symlink")
    if destination.exists():
        if not destination.is_file() or sha(destination) != RUST_SOURCE_SHA256:
            fail("Cached Rust source digest mismatch; remove the corrupt entry explicitly")
        return destination
    cache.mkdir(parents=True, exist_ok=True)
    opener = opener or urllib.request.build_opener(PinnedRedirect())
    with tempfile.NamedTemporaryFile(prefix="rust-src-", suffix=".partial", dir=cache, delete=False) as stream:
        temporary = Path(stream.name)
        try:
            with opener.open(RUST_SOURCE_URL, timeout=60) as response:
                total = 0
                for block in iter(lambda: response.read(1024 * 1024), b""):
                    total += len(block)
                    if total > SOURCE_LIMIT:
                        fail("Rust source response exceeds the download bound")
                    stream.write(block)
            stream.flush()
            if sha(temporary) != RUST_SOURCE_SHA256:
                fail("Downloaded Rust source digest mismatch")
            temporary.replace(destination)
        finally:
            temporary.unlink(missing_ok=True)
    return destination


def probe_libclang(path):
    """Load the host library and create/dispose an index; no source is compiled."""
    library = ctypes.CDLL(str(path))
    library.clang_createIndex.argtypes = [ctypes.c_int, ctypes.c_int]
    library.clang_createIndex.restype = ctypes.c_void_p
    library.clang_disposeIndex.argtypes = [ctypes.c_void_p]
    library.clang_disposeIndex.restype = None
    index = library.clang_createIndex(0, 0)
    if not index:
        fail("libclang could not create an index")
    library.clang_disposeIndex(index)


def find_libclang(explicit=None):
    # clang-sys 1.9.1 also applies filename patterns to an explicit file, and
    # excludes libclang-cpp. Match its runtime discovery for supported hosts.
    patterns = {
        "darwin": ("libclang.dylib",),
        "win32": ("clang.dll", "libclang.dll"),
    }.get(sys.platform, ("libclang.so", "libclang-*.so", "libclang.so.*", "libclang-*.so.*"))
    paths = [explicit] if explicit else list(LIBCLANG_DIRS)
    for path in paths:
        candidates = (
            [path] if path.is_file() else [path / name for name in ("libclang.so", "libclang.so.1", "libclang.dylib")]
        )
        for candidate in candidates:
            if not candidate.is_file():
                continue
            if "-cpp." in candidate.name or not any(
                fnmatch.fnmatchcase(candidate.name, pattern) for pattern in patterns
            ):
                if path.is_file():
                    fail("Selected libclang filename is not discoverable by clang-sys")
                continue
            # Preserve a valid distro alias even when its target has another
            # basename. All later build stages must use this exact path.
            candidate = candidate.absolute()
            probe_libclang(candidate.resolve(strict=True))
            return candidate
    fail(
        "Host libclang not found; on Ubuntu 24.04 install libclang-18-dev, or pass --libclang /path/to/library-or-directory"
    )


def verify_rust(identity, sysroot, target):
    values = dict(line.split(": ", 1) for line in identity.splitlines() if ": " in line)
    if values.get("release") != RUST_VERSION or values.get("commit-hash") != RUST_COMMIT:
        fail("Installed Rust compiler differs from the pinned release/commit")
    manifest_path = sysroot / "lib/rustlib/multirust-channel-manifest.toml"
    manifest = tomllib.loads(manifest_path.read_text())
    expected = RUST_VERSION + " (" + RUST_COMMIT[:9] + " "
    for package in ("rustc", "rust-src", "rust-std"):
        if not manifest["pkg"][package]["version"].startswith(expected):
            fail("Installed Rust manifest differs from the pinned commit")
    source = manifest["pkg"]["rust-src"]["target"]["*"]
    if source.get("xz_url") != RUST_SOURCE_URL or source.get("xz_hash") != RUST_SOURCE_SHA256:
        fail("Installed Rust manifest differs from the pinned source archive")
    if not list((sysroot / "lib/rustlib" / target / "lib").glob("libstd-*.rlib")):
        fail("Pinned ARM Rust standard library is missing")


def prepare(args):
    spec = json.loads((HERE / "manifest.json").read_text())
    if spec["rust_toolchain"] != RUST_VERSION or spec["rust_commit"] != RUST_COMMIT:
        fail("Companion Rust pin changed; review preparation commit/source pins before use")
    root = args.root.resolve(strict=True)
    lock = root / "Cargo.lock"
    lock_hash = sha(lock)
    dependencies = [package for package in tomllib.loads(lock.read_text())["package"] if "source" in package]
    cache, target = args.cache_dir.resolve(), args.target_dir.resolve()
    if cache == Path("/") or target == Path("/") or cache == target:
        fail("Use distinct explicit cache and target directories")
    rustup = shutil.which("rustup")
    if not rustup:
        fail("rustup must already be installed; preparation does not execute a remote installer")
    libclang = find_libclang(args.libclang)
    cargo_home = cache / "cargo"
    cargo_home.mkdir(parents=True, exist_ok=True)
    target.mkdir(parents=True, exist_ok=True)
    env = {
        **os.environ,
        "CARGO_HOME": str(cargo_home),
        "CARGO_TARGET_DIR": str(target),
        "CARGO_BUILD_JOBS": "2",
        "CARGO_INCREMENTAL": "0",
        "RUSTUP_TOOLCHAIN": RUST_VERSION,
        "CARGO_NET_OFFLINE": "false",
        "LIBCLANG_PATH": str(libclang),
    }
    for name in (
        "RUSTC",
        "RUSTC_WRAPPER",
        "RUSTC_WORKSPACE_WRAPPER",
        "RUSTFLAGS",
        "CARGO_ENCODED_RUSTFLAGS",
        "CARGO_BUILD_RUSTC_WRAPPER",
        "CARGO_BUILD_RUSTC_WORKSPACE_WRAPPER",
        "RUSTUP_DIST_SERVER",
        "RUSTUP_UPDATE_ROOT",
    ):
        env.pop(name, None)
    # Do not change the default toolchain or add repository overrides. rustup's
    # exact-version install is idempotent and may populate its normal cache.
    run([rustup, "toolchain", "install", RUST_VERSION, "--profile", "minimal", "--target", spec["target"]], env)
    identity = run([rustup, "run", RUST_VERSION, "rustc", "--version", "--verbose"], env)
    sysroot = Path(run([rustup, "run", RUST_VERSION, "rustc", "--print", "sysroot"], env)).resolve(strict=True)
    verify_rust(identity, sysroot, spec["target"])
    # No --target: the source collector vendors the ENTIRE workspace lock,
    # including other platforms and optional/dev dependencies.
    run([rustup, "run", RUST_VERSION, "cargo", "fetch", "--locked", "--manifest-path", str(root / "Cargo.toml")], env)
    if sha(lock) != lock_hash:
        fail("Cargo.lock changed during preparation")
    archive = source_archive(cache / "rust")
    environment = {
        name: env[name]
        for name in (
            "CARGO_HOME",
            "CARGO_TARGET_DIR",
            "CARGO_BUILD_JOBS",
            "CARGO_INCREMENTAL",
            "RUSTUP_TOOLCHAIN",
            "LIBCLANG_PATH",
        )
    }
    environment["CARGO_NET_OFFLINE"] = "true"
    result = {
        "schema": 1,
        "status": "ready",
        "root": str(root),
        "package": spec["package"],
        "target": spec["target"],
        "features": spec["features"],
        "rust_toolchain": RUST_VERSION,
        "rust_commit": RUST_COMMIT,
        "rust_sysroot": str(sysroot),
        "cargo_lock_sha256": lock_hash,
        "locked_external_packages": len(dependencies),
        "cargo_fetch_scope": "entire_workspace_lock",
        "cache_dir": str(cache),
        "cargo_home": str(cargo_home),
        "target_dir": str(target),
        "libclang": str(libclang),
        "libclang_library": str(libclang),
        "rust_source_archive": str(archive),
        "rust_source_archive_sha256": RUST_SOURCE_SHA256,
        "environment": environment,
        "compiled": False,
    }
    output = args.output or cache / "prepare.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        prefix="prepare-", suffix=".json", dir=output.parent, mode="w", delete=False
    ) as stream:
        temporary = Path(stream.name)
        try:
            json.dump(result, stream, indent=2, sort_keys=True)
            stream.write("\n")
            stream.flush()
            temporary.replace(output)
        finally:
            temporary.unlink(missing_ok=True)
    print(json.dumps(result, sort_keys=True))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument(
        "--cache-dir", type=Path, required=True, help="Task-owned cache; contains cargo/, rust/ and prepare.json"
    )
    parser.add_argument("--target-dir", type=Path, required=True, help="Explicit target directory for the later build")
    parser.add_argument(
        "--libclang", type=Path, help="Host library or its directory; Ubuntu default is /usr/lib/llvm-18/lib"
    )
    parser.add_argument("--output", type=Path, help="JSON receipt path; default <cache-dir>/prepare.json")
    args = parser.parse_args()
    try:
        prepare(args)
    except (ValueError, OSError, KeyError, subprocess.CalledProcessError, urllib.error.URLError) as error:
        parser.exit(1, "Companion preparation failed: " + str(error) + "\n")


if __name__ == "__main__":
    main()
