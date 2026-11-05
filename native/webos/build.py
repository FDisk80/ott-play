#!/usr/bin/env python3
"""Build the separate, GPL-licensed native webOS Plex application.

No command installs or launches an application. Build outputs and native
dependency caches stay in the chosen work directory. Rust toolchains and the
Cargo registry use their normal user locations; Cargo configuration is isolated.
"""

from __future__ import annotations

from contextlib import contextmanager

import argparse
import hashlib
import importlib.util
import io
import json
import os
import platform
import posixpath
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
TARGET = "armv7-unknown-linux-gnueabi"
PRODUCT_CONFIG = "ci/ottplay-integration/release/product.json"
RELEASE_DOCUMENT_LIMIT = 64 * 1024
# Match the release verifier's maximum size for raw Cargo evidence.
CARGO_EVIDENCE_LIMIT = 8 * 1024 * 1024
# Unused upstream platform-modification implementation is never part of this
# product's source or binary distribution. The overlay removes its module.
EXCLUDED_SOURCE = "rust-modules/platform/src/webos/jail_repair.rs"

# Load exactly this tracked helper's source, without reading/writing bytecode.
_profile_path = HERE / "control_discovery_config.py"
_profile_spec = importlib.util.spec_from_file_location("control_discovery_config", _profile_path)
control_discovery_config = importlib.util.module_from_spec(_profile_spec)
exec(compile(_profile_path.read_bytes(), str(_profile_path), "exec"), control_discovery_config.__dict__)


def control_discovery_profile(args):
    url = getattr(args, "control_discovery_url", None)
    digest = getattr(args, "control_discovery_sha256", None)
    if (url is None) != (digest is None):
        fail("Control discovery requires both explicit build inputs")
    return control_discovery_config.profile(url, digest)


def fail(message: str):
    raise ValueError(message)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def manifest() -> dict:
    value = json.loads((HERE / "upstream.json").read_text())
    if value.get("schema") != 1 or not re.fullmatch(r"[0-9a-f]{40}", value.get("revision", "")):
        fail("Invalid pinned native source manifest")
    app = value["application"]
    if app["id"] != "com.openottplay.player.native" or not re.fullmatch(r"\d+\.\d+\.\d+", app["version"]):
        fail("Native application identity must remain separate from the web launcher")
    return value


def run(args, *, cwd=None, env=None, capture=False) -> str:
    result = subprocess.run(
        [str(x) for x in args], cwd=cwd, env=env, check=True, text=True, stdout=subprocess.PIPE if capture else None
    )
    return result.stdout.strip() if capture else ""


def release_product_config(spec):
    app = spec["application"]
    version = app["version"]
    if app["id"] != "com.openottplay.player.native" or not re.fullmatch(
        r"(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)", version
    ):
        fail("Invalid release product identity")
    return {
        "schema": 1,
        "product": "ottplay-native",
        "application_id": app["id"],
        "version": version,
        "notes": f"ci/ottplay-integration/release/notes/v{version}.md",
        "audit": f"ci/ottplay-integration/release/audits/v{version}.md",
        "notes_contract": "outer-publisher-verbatim-v1",
    }


def release_document_sources(spec):
    version = release_product_config(spec)["version"]
    return {"notes": HERE / f"releases/{version}.md", "audit": HERE / f"releases/{version}-audit.md"}


def release_document_bytes(path):
    if path.resolve() != path.absolute() or not path.is_file():
        fail("Release document must be a regular file without symlink ancestors")
    with path.open("rb") as stream:
        raw = stream.read(RELEASE_DOCUMENT_LIMIT + 1)
    if not raw or len(raw) > RELEASE_DOCUMENT_LIMIT or b"\0" in raw:
        fail("Release document is empty, oversized, or contains NUL")
    if not raw.decode("utf-8").strip():
        fail("Release document is empty")
    return raw


def stage_release_product(source, spec):
    config = release_product_config(spec)
    for role, path in release_document_sources(spec).items():
        raw = release_document_bytes(path)
        destination = source / config[role]
        if destination.resolve() != destination.absolute():
            fail("Prepared release destination must not traverse symlinks")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(raw)
    destination = source / PRODUCT_CONFIG
    if destination.resolve() != destination.absolute():
        fail("Prepared product configuration must not traverse symlinks")
    write_json(destination, config)
    return release_product_receipt(source, spec)


def release_product_receipt(source, spec):
    config = release_product_config(spec)
    raw_config = release_document_bytes(source / PRODUCT_CONFIG)
    if json.loads(raw_config) != config:
        fail("Prepared release product configuration changed")
    documents = {}
    for role, path in release_document_sources(spec).items():
        raw = release_document_bytes(path)
        if release_document_bytes(source / config[role]) != raw:
            fail("Prepared release document changed: " + role)
        documents[role] = hashlib.sha256(raw).hexdigest()
    return {
        "path": PRODUCT_CONFIG,
        "sha256": hashlib.sha256(raw_config).hexdigest(),
        "documents": documents,
        "audit_evidence": "authored_only",
    }


def integration_files() -> list[Path]:
    names = ("build.py", "control_discovery_config.py", "upstream.json", "README.md", "COPYING", "test_build.py")
    return sorted(
        [HERE / name for name in names]
        + list((HERE / "patches").glob("*.patch"))
        + list(release_document_sources(manifest()).values())
    )


def integration_digest() -> str:
    h = hashlib.sha256()
    for path in integration_files():
        h.update(path.relative_to(HERE).as_posix().encode() + b"\0")
        h.update(path.read_bytes())
    return h.hexdigest()


def source_dir(args) -> Path:
    return args.work_dir / "source"


def source_receipt(args) -> Path:
    return args.work_dir / "prepared.json"


def source_tree(source: Path) -> str:
    return run(["git", "-C", source, "write-tree"], capture=True)


def prepare(args, spec):
    source = source_dir(args)
    receipt = source_receipt(args)
    expected = {"revision": spec["revision"], "integration_sha256": integration_digest()}
    if source.exists():
        if not receipt.is_file():
            fail("Source directory belongs to another or incomplete preparation; choose a new --work-dir")
        check_source(args, spec)
        return
    patches = sorted((HERE / "patches").glob("*.patch"))
    if not patches:
        fail("Native integration patch is missing; unmodified upstream must not be packaged")
    args.work_dir.mkdir(parents=True, exist_ok=True)
    if args.local_upstream:
        upstream = args.local_upstream.resolve()
        run(["git", "-C", upstream, "cat-file", "-e", spec["revision"] + "^{commit}"])
        run(["git", "clone", "--no-hardlinks", "--no-checkout", upstream, source])
    else:
        run(["git", "clone", "--filter=blob:none", "--no-checkout", spec["repository"], source])
    run(["git", "-C", source, "checkout", "--detach", spec["revision"]])
    (source / EXCLUDED_SOURCE).unlink(missing_ok=True)
    run(["git", "-C", source, "add", "-u", "--", EXCLUDED_SOURCE])
    for patch in patches:
        run(["git", "-C", source, "apply", "--index", patch])
    if (source / EXCLUDED_SOURCE).exists():
        fail("Integration must not restore excluded platform-modification code")
    integration = source / "ci/ottplay-integration"
    for path in integration_files():
        destination = integration / path.relative_to(HERE)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, destination)
    product = stage_release_product(source, spec)
    write_json(integration / "PROVENANCE.json", dict(expected, patches={p.name: sha256(p) for p in patches}))
    run(["git", "-C", source, "add", "ci/ottplay-integration"])
    write_json(receipt, dict(expected, tree=source_tree(source), product_release=product))
    check_source(args, spec)


def check_source(args, spec):
    source = source_dir(args)
    if not source_receipt(args).is_file():
        fail("Run prepare first")
    receipt = json.loads(source_receipt(args).read_text())
    expected = {"revision": spec["revision"], "integration_sha256": integration_digest()}
    if any(receipt.get(key) != value for key, value in expected.items()):
        fail("Integration changed after source preparation; use a new --work-dir")
    if run(["git", "-C", source, "rev-parse", "HEAD"], capture=True) != spec["revision"]:
        fail("Prepared source revision changed")
    if receipt.get("tree") != source_tree(source):
        fail("Prepared source index changed; rebuild from the reviewed overlay")
    run(["git", "-C", source, "diff", "--quiet"])
    app = json.loads((source / "pkg/appinfo.json").read_text())
    for field in ("id", "title", "version"):
        if app.get(field) != spec["application"][field]:
            fail("Native overlay did not set application " + field)
    if receipt.get("product_release") != release_product_receipt(source, spec):
        fail("Prepared release product receipt changed")
    if app.get("type") != "native":
        fail("Expected a native application, not a web launcher")
    if (source / "pkg/telemetry.local.json").exists():
        fail("Private upstream build settings are not permitted in this target")
    if (source / EXCLUDED_SOURCE).exists() or (source / "pkg/ottplay-profile.json").exists():
        fail("Prepared source contains excluded code or private profile settings")
    check_cargo_configs(source, receipt["tree"])
    return source


def check_cargo_configs(source: Path, tree: str):
    """Admit only regular config blobs from the already validated prepared tree."""
    source = source.absolute()
    if source.resolve() != source:
        fail("Native source ancestry must not traverse symlinks")
    cwd = source / "rust-modules"
    for directory in (cwd, *cwd.parents):
        for name in ("config", "config.toml"):
            path = directory / ".cargo" / name
            if not path.exists() and not path.is_symlink():
                continue
            if not path.is_relative_to(source):
                fail("External ancestor Cargo configuration is not permitted: " + str(path))
            if not path.is_file() or path.resolve() != path:
                fail("Prepared Cargo configuration must be a regular non-symlink file")
            relative = path.relative_to(source).as_posix()
            entry = run(["git", "-C", source, "ls-tree", tree, "--", relative], capture=True)
            expected = run(["git", "-C", source, "hash-object", "--no-filters", path], capture=True)
            if entry not in ("100644 blob " + expected + "\t" + relative,
                             "100755 blob " + expected + "\t" + relative):
                fail("Cargo configuration differs from the prepared source tree: " + relative)


@contextmanager
def cargo_environment(args):
    """Reuse caches and their locks, never the caller's Cargo configuration or credentials."""
    env = build_env(args)
    cache = Path(env.get("CARGO_HOME") or Path.home() / ".cargo").expanduser().resolve()
    cache.mkdir(parents=True, exist_ok=True)
    # Shared locks serialize access even when another Cargo process uses the original home.
    # Global usage tracking is private; do not alias a SQLite database and its journal paths.
    with tempfile.TemporaryDirectory(prefix=".native-cargo-", dir=args.work_dir) as directory:
        home = Path(directory)
        for name in ("registry", "git"):
            target = cache / name
            target.mkdir(exist_ok=True)
            (home / name).symlink_to(target.resolve(), target_is_directory=True)
        for name in (".package-cache", ".package-cache-mutate"):
            target = cache / name
            target.touch(exist_ok=True)
            if not target.is_file():
                fail("Cargo cache lock must be a regular file")
            (home / name).symlink_to(target.resolve())
        env["CARGO_HOME"] = str(home)
        yield env


def toolchain(source: Path) -> str:
    text = (source / "rust-modules/rust-toolchain.toml").read_text()
    match = re.search(r'^channel\s*=\s*"([0-9.]+)"', text, re.MULTILINE)
    if not match:
        fail("Missing exact Rust toolchain pin")
    return match.group(1)


def build_env(args) -> dict:
    profile = control_discovery_profile(args)
    optimization = getattr(args, "rust_opt_level", "2")
    if optimization not in ("2", "s"):
        fail("Native Rust optimization must be 2 or s")
    env = dict(os.environ)
    for key in list(env):
        if key.startswith(("PLX_", "SENTRY_", "POSTHOG_", "OTTPLAY_", "CARGO_PROFILE_", "CARGO_TARGET_")) or key in {
            "RUSTFLAGS",
            "CARGO_BUILD_RUSTFLAGS", "CARGO_BUILD_TARGET", "CARGO_BUILD_TARGET_DIR", "CARGO_BUILD_RUSTC",
            "CARGO_BUILD_RUSTC_WRAPPER", "CARGO_BUILD_RUSTC_WORKSPACE_WRAPPER",
            "RUSTC", "RUSTC_WRAPPER", "RUSTC_WORKSPACE_WRAPPER", "RUSTUP_TOOLCHAIN",
            "CARGO_ENCODED_RUSTFLAGS",
            "MAKEFLAGS",
            "GNUMAKEFLAGS",
            "MAKEOVERRIDES",
            "MAKEFILES",
            "MFLAGS",
            "ARM_PROFILE", "DEBUG", "HOST", "HOSTSIM", "CAPLINTS", "WERROR",
            "CFLAGS", "CPPFLAGS", "CXXFLAGS", "LDFLAGS", "PKG_CONFIG_PATH",
            "STORAGE_TDIR", "FFMPEG_PREFIX", "SENTRY_NATIVE_PREFIX", "LIBASS_UNSTRIPPED",
            "LAB",
            "SYMBOLS",
            "RUST_FEATFLAGS",
            "RUST_DEBUGINFO", "RUST_CAPLINTS", "RUST_CODEGEN", "RUST_ENV", "RUST_REMAP", "RC",
            "RUST_TOOLCHAIN",
            "RUST_TARGET",
            "RUST_TDIR",
            "OTT_PRODUCT_CONFIG",
            "REQUIRE_PACKAGE",
        }:
            env.pop(key)
    env.update(
        {
            "WEBOS_SDK": str(args.sdk),
            "RELEASE": "1",
            "FLAVOR": "stable",
            # Link-time archives must remain beneath the recorded native source.
            "PLX_BUILD_CACHE": str(source_dir(args) / "vendor/build-cache"),
            "PLX_DEPS_CACHE": str(source_dir(args) / "vendor/downloads"),
            "PLX_CARGO_SEED": "off",
            "PLX_DISK_BUDGET_DONE": "1",
            "CARGO_INCREMENTAL": "0",
            "CARGO_PROFILE_RELEASE_OPT_LEVEL": optimization,
            "CARGO_TERM_VERBOSE": "true",
        }
    )
    if profile["configured"]:
        env[control_discovery_config.URL_ENV] = profile["url"]
        env[control_discovery_config.SHA256_ENV] = profile["sha256"]
    return env


def native_compile_evidence(args, spec, source, configuration):
    """Validate the actual Cargo result before the native linker can consume it."""
    target = source / "rust-modules/target-release"
    raw_path = target / ".lib-artifacts.json"
    archive = target / TARGET / "release/libplxnative_modules.a"
    for path in (raw_path, archive):
        if not path.is_file() or path.resolve() != path.absolute():
            fail("Native compilation evidence must remain inside its source tree")
    with raw_path.open("rb") as stream:
        raw = stream.read(CARGO_EVIDENCE_LIMIT + 1)
    if len(raw) > CARGO_EVIDENCE_LIMIT:
        fail("Native Cargo evidence exceeds the 8 MiB release limit")
    try:
        records = [json.loads(line) for line in raw.splitlines() if line.strip()]
    except ValueError:
        fail("Malformed native Cargo evidence")
    if not records or any(not isinstance(row, dict) for row in records):
        fail("Missing native Cargo evidence")
    finished = [row for row in records if row.get("reason") == "build-finished"]
    if len(finished) != 1 or finished[0].get("success") is not True or records[-1] != finished[0]:
        fail("Native Cargo evidence does not end in a successful build")
    artifacts = [row for row in records if row.get("reason") == "compiler-artifact"
                 and isinstance(row.get("target"), dict)
                 and row["target"].get("name") == "plxnative_modules"]
    if len(artifacts) != 1:
        fail("Expected exactly one native application Cargo artifact")
    artifact = artifacts[0]
    expected_profile = {"opt_level": getattr(args, "rust_opt_level", "2"), "debuginfo": 0,
                        "debug_assertions": False, "overflow_checks": False, "test": False}
    actual_profile = artifact.get("profile", {})
    if (artifact.get("manifest_path") != str(source / "rust-modules/Cargo.toml")
            or artifact["target"].get("src_path") != str(source / "rust-modules/src/lib.rs")
            or artifact["target"].get("kind") != ["staticlib"]
            or artifact["target"].get("crate_types") != ["staticlib"]
            or artifact.get("features") != []
            or any(type(actual_profile.get(key)) is not type(value) or actual_profile.get(key) != value
                   for key, value in expected_profile.items())
            or artifact.get("filenames") != [str(archive)]):
        fail("Native Cargo artifact differs from the selected release configuration")
    name = output_name(spec)
    cargo_file, config_file = name + "-cargo-artifacts.jsonl", name + "-build-config.txt"
    for evidence in (cargo_file, config_file):
        if (args.work_dir / evidence).is_symlink():
            fail("Native compilation evidence destination must not be a symlink")
    (args.work_dir / cargo_file).write_bytes(raw)
    (args.work_dir / config_file).write_text(configuration + "\n")
    return {"cargo": {"file": cargo_file, "sha256": sha256(args.work_dir / cargo_file),
                       "artifact": artifact},
            "make": {"file": config_file, "sha256": sha256(args.work_dir / config_file)},
            "archive": {"path": archive.relative_to(source).as_posix(), "sha256": sha256(archive)}}


def sdk_host() -> str:
    system, machine = platform.system().lower(), platform.machine().lower()
    if system == "darwin" and machine in {"arm64", "x86_64"}:
        return system + "-" + machine
    if system == "linux" and machine in {"aarch64", "arm64"}:
        return "linux-aarch64"
    fail("Pinned SDK supports macOS arm64/x86_64 and Linux aarch64; use an ARM Linux CI runner")


def sdk_extract_filter(member, destination, sdk_directory):
    """Keep target absolute symlinks inside the extracted target sysroot."""
    name = PurePosixPath(safe_name(member.name))
    if member.issym() and PurePosixPath(member.linkname).is_absolute():
        sysroot = PurePosixPath(sdk_directory) / "arm-webos-linux-gnueabi/sysroot"
        if not name.is_relative_to(sysroot):
            fail("Absolute SDK link is outside its target sysroot: " + member.name)
        target = sysroot / safe_name(member.linkname.lstrip("/"))
        root = Path(destination).resolve()
        boundary = root.joinpath(*sysroot.parts)
        if (
            boundary.resolve() != boundary
            or not root.joinpath(*name.parent.parts).resolve().is_relative_to(boundary)
            or not root.joinpath(*target.parts).resolve().is_relative_to(boundary)
        ):
            fail("SDK symlink target or ancestor leaves its target sysroot: " + member.name)
        member = member.replace(linkname=posixpath.relpath(str(target), str(name.parent)))
    return tarfile.data_filter(member, destination)


def bootstrap(args, spec):
    source = check_source(args, spec)
    env = build_env(args)
    compiler = args.sdk / "bin/arm-webos-linux-gnueabi-gcc"
    if not compiler.is_file():
        if args.sdk.exists():
            fail("SDK directory exists without its compiler; choose an empty SDK destination")
        host = sdk_host()
        dependencies = json.loads((source / "ci/dependencies.json").read_text())
        sdk = next(row for row in dependencies if row["id"] == "webos-ndk")
        asset = sdk["assets"][host]
        if sdk["version"] != spec["sdk"]["version"] or asset["sha256"] != spec["sdk"]["assets"][host]["sha256"]:
            fail("Pinned upstream SDK does not match reviewed integration manifest")
        args.sdk.parent.mkdir(parents=True, exist_ok=True)
        archive = Path(
            run(
                [
                    sys.executable,
                    source / "ci/deps.py",
                    "fetch",
                    "webos-ndk",
                    "--asset",
                    host,
                    "--into",
                    args.work_dir / "downloads",
                ],
                cwd=source,
                env=env,
                capture=True,
            ).splitlines()[-1]
        )
        if sha256(archive) != asset["sha256"]:
            fail("SDK checksum mismatch")
        # The archive has been authenticated before extraction. Refuse path traversal
        # even for pinned inputs, while preserving the SDK's intentional symlinks.
        with tempfile.TemporaryDirectory(prefix="sdk-extract-", dir=args.sdk.parent) as staging:
            with tarfile.open(archive) as tar:
                for entry in tar.getmembers():
                    safe_name(entry.name)
                tar.extractall(
                    staging,
                    filter=lambda member, destination: sdk_extract_filter(
                        member, destination, spec["sdk"]["directory"]
                    ),
                )
            canonical = Path(staging) / spec["sdk"]["directory"]
            canonical.rename(args.sdk)
        run(["sh", "./relocate-sdk.sh"], cwd=args.sdk, env=env)
    run(
        [
            "rustup",
            "toolchain",
            "install",
            "--no-self-update",
            toolchain(source),
            "--profile",
            "minimal",
            "--component",
            "rust-src",
            "--target",
            TARGET,
        ],
        env=env,
    )
    run([compiler, "--version"], env=env)


def build(args, spec):
    control_discovery_profile(args)
    source = check_source(args, spec)
    with cargo_environment(args) as environment:
        build_with_environment(args, spec, source, environment)


def build_with_environment(args, spec, source, environment):
    profile = control_discovery_profile(args)
    if not (args.sdk / "bin/arm-webos-linux-gnueabi-gcc").is_file():
        fail("SDK is missing; run bootstrap or supply --sdk")
    # Source overlay removes upstream device-repair and automatic cleanup entry
    # points. No make target accepting a TV address is ever invoked here.
    make = ["make", "-j" + str(args.jobs), "RELEASE=1", "FLAVOR=stable", "OTT_PRODUCT_CONFIG=" + PRODUCT_CONFIG,
            "ARM_PROFILE=release", "RUST_TDIR=target-release", "STORAGE_TDIR=target-release-storage",
            "RUST_TARGET=" + TARGET, "RUST_TOOLCHAIN=" + toolchain(source)]
    environment["REQUIRE_PACKAGE"] = "1"
    (args.work_dir / "built.json").unlink(missing_ok=True)
    companion = getattr(args, "companion_bundle", None)
    expected_companion = None
    if companion is not None:
        companion = companion.resolve(strict=True)
        module = companion_builder()
        # Fail before native compilation if the supplied helper or its inputs
        # changed. The stage command repeats this check after compilation.
        module.checked_bundle(companion, args.sdk / "bin/arm-webos-linux-gnueabi-readelf")
        expected_companion = sha256(companion / "receipt.json")
    configuration = run(make + ["-s", "print-bench-config"], cwd=source, env=environment, capture=True)
    settings = dict(line.split("=", 1) for line in configuration.splitlines() if "=" in line)
    archive = "rust-modules/target-release/" + TARGET + "/release/libplxnative_modules.a"
    for key, value in {"RUST_TDIR": "target-release", "RUST_TARGET": TARGET,
                       "ARM_PROFILE": "release", "ARM_PROFILE_FLAG": "--release",
                       "RUST_LIB": archive,
                       "RUST_FEATFLAGS": "--no-default-features", "RUST_TOOLCHAIN": toolchain(source)}.items():
        if settings.get(key) != value:
            fail("Unexpected effective native Make configuration: " + key)
    # Separate invocations: marking the archive itself new in the Cargo pass can
    # suppress its rebuild. The second pass forces the final link even for a
    # Cargo-fresh archive whose mtime predates the previous executable.
    run(make + ["-W", "rust-modules/Cargo.toml", archive, "pkg/plxnative-storage"], cwd=source, env=environment)
    compilation = native_compile_evidence(args, spec, source, configuration)
    run(make + ["-W", archive, "ipk-stage"], cwd=source, env=environment)
    if (sha256(source / archive) != compilation["archive"]["sha256"]
            or sha256(source / "rust-modules/target-release/.lib-artifacts.json") != compilation["cargo"]["sha256"]):
        fail("Native compilation inputs changed during final link")
    stage = source / "ipkroot/data/usr/palm/applications" / spec["application"]["id"]
    if not stage.is_dir() or stage.is_symlink():
        fail("Native application staging directory is missing or unsafe")
    run([sys.executable, source / "ci/check-build-budgets.py", "--binary", stage / "plxnative"], cwd=source, env=environment)
    run(["bash", source / "ci/check-elf.sh", source / "pkg/plxnative"], cwd=source, env=environment)
    if companion is not None:
        companion_environment = {key: value for key, value in environment.items() if not key.startswith("CARGO_PROFILE_")}
        run(
            [
                sys.executable,
                HERE / "companion/build.py",
                "stage",
                "--bundle",
                companion,
                "--readelf",
                args.sdk / "bin/arm-webos-linux-gnueabi-readelf",
                "--destination",
                stage,
                "--link-evidence",
                source / "pkg/link-evidence/stable",
            ],
            cwd=ROOT,
            env=companion_environment,
        )
    run(make + ["ipk-pack"], cwd=source, env=environment)
    check_source(args, spec)
    app = spec["application"]
    binary = source / "pkg" / (app["id"] + "_" + app["version"] + "_arm.ipk")
    verified = verify_ipk(binary, spec)
    actual_companion = verified.get("companion", {}).get("receipt_sha256")
    if actual_companion != expected_companion:
        fail("Packaged companion does not match the explicitly selected bundle")
    receipt = json.loads(source_receipt(args).read_text())
    receipt.update(
        {
            "ipk_sha256": sha256(binary),
            "rust_toolchain": toolchain(source),
            "sdk_compiler_sha256": sha256(args.sdk / "bin/arm-webos-linux-gnueabi-gcc.br_real"),
            "compilation": compilation,
            "configuration": {"RELEASE": "1", "FLAVOR": "stable", "target": TARGET, "ARM_PROFILE": "release",
                              "rust_opt_level": environment["CARGO_PROFILE_RELEASE_OPT_LEVEL"], "symbols": False,
                              "host": sdk_host(),
                              "control_discovery": profile},
        }
    )
    if "companion" in verified:
        receipt["companion"] = verified["companion"]
    write_json(args.work_dir / "built.json", receipt)


def companion_builder():
    spec = importlib.util.spec_from_file_location("native_companion_build", HERE / "companion/build.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def verify_companion(files, prefix, data_archive):
    binary_name = prefix + "bin/ottplay-companion"
    metadata_prefix = prefix + "companion/"
    if binary_name not in files and not any(name.startswith(metadata_prefix) for name in files):
        return None
    required = [binary_name] + [metadata_prefix + name for name in ("manifest.json", "receipt.json", "source.json")]
    if any(name not in files for name in required):
        fail("Incomplete native companion payload")
    binary = files[binary_name]
    manifest = json.loads(files[metadata_prefix + "manifest.json"])
    receipt = json.loads(files[metadata_prefix + "receipt.json"])
    source = json.loads(files[metadata_prefix + "source.json"])
    if (
        not elf_arm(binary)
        or manifest.get("schema") != 1
        or receipt.get("schema") != 1
        or manifest.get("package") != "ottplay-companion"
        or manifest.get("target") != TARGET
        or manifest.get("install_path") != "bin/ottplay-companion"
        or receipt.get("package") != manifest["package"]
        or receipt.get("target") != TARGET
        or receipt.get("elf", {}).get("sha256") != hashlib.sha256(binary).hexdigest()
        or receipt.get("elf", {}).get("bytes") != len(binary)
        or receipt.get("manifest_sha256") != hashlib.sha256(files[metadata_prefix + "manifest.json"]).hexdigest()
    ):
        fail("Native companion identity or binary receipt mismatch")
    if (
        source.get("schema") != 1
        or source.get("local_source_archive_sha256") != receipt.get("local_source_archive_sha256")
        or source.get("complete_corresponding_source") is not False
        or source.get("release_source_requirements") != manifest.get("release_source_requirements")
        or receipt.get("device_executed") is not False
        or source.get("local_inputs_sha256") != receipt.get("local_inputs_sha256")
    ):
        fail("Native companion source or validation receipt mismatch")
    for value in (
        receipt.get("manifest_sha256"),
        receipt.get("source_receipt_sha256"),
        receipt.get("local_source_archive_sha256"),
        source.get("local_inputs_sha256"),
        receipt.get("local_inputs_sha256"),
        receipt.get("link_map_sha256"),
        receipt.get("link_trace_sha256"),
        receipt.get("link_receipt_sha256"),
    ):
        if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{64}", value):
            fail("Native companion receipt is missing a source or linker digest")
    with tarfile.open(fileobj=io.BytesIO(data_archive), mode="r:gz") as archive:
        member = next(item for item in archive if item.name.removeprefix("./") == binary_name)
        if member.mode != 0o755:
            fail("Native companion must be executable with mode 0755")
    return {
        "elf_sha256": hashlib.sha256(binary).hexdigest(),
        "receipt_sha256": hashlib.sha256(files[metadata_prefix + "receipt.json"]).hexdigest(),
        "manifest_sha256": receipt["manifest_sha256"],
        "source_receipt_sha256": receipt["source_receipt_sha256"],
        "local_source_archive_sha256": receipt["local_source_archive_sha256"],
        "local_inputs_sha256": source["local_inputs_sha256"],
    }


def safe_name(value: str) -> str:
    path = PurePosixPath(value)
    if not value or path.is_absolute() or ".." in path.parts or "\\" in value:
        fail("Unsafe archive member: " + value)
    return str(path)


def ar_members(data: bytes) -> dict[str, bytes]:
    if not data.startswith(b"!<arch>\n"):
        fail("Not an IPK/ar archive")
    result, offset = {}, 8
    while offset < len(data):
        header = data[offset : offset + 60]
        if len(header) != 60 or header[58:] != b"`\n":
            fail("Malformed IPK member header")
        name = safe_name(header[:16].decode("ascii").strip().rstrip("/"))
        size = int(header[48:58].decode("ascii").strip())
        if name in result or size < 0 or offset + 60 + size > len(data):
            fail("Duplicate or truncated IPK member")
        result[name] = data[offset + 60 : offset + 60 + size]
        offset += 60 + size + size % 2
    if offset != len(data) or set(result) != {"debian-binary", "control.tar.gz", "data.tar.gz"}:
        fail("Unexpected IPK structure")
    if result["debian-binary"] != b"2.0\n":
        fail("Unsupported IPK format")
    return result


def tar_files(data: bytes, allowed=None) -> dict[str, bytes]:
    result = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        for member in tar:
            name = safe_name(member.name)
            if allowed is not None and not allowed(name):
                fail("Unexpected package path: " + name)
            if member.isdir():
                continue
            if not member.isfile() or name in result or member.size > 512 * 1024 * 1024:
                fail("Unsupported/duplicate IPK payload member: " + name)
            result[name] = tar.extractfile(member).read()
    return result


def elf_arm(data: bytes) -> bool:
    return len(data) >= 52 and data[:6] == b"\x7fELF\x01\x01" and int.from_bytes(data[18:20], "little") == 40


def verify_ipk(path: Path, spec) -> dict:
    members = ar_members(path.read_bytes())
    app = spec["application"]
    prefix = "usr/palm/applications/" + app["id"] + "/"
    service_id = app["id"] + ".storage"
    service_prefix = "usr/palm/services/" + service_id + "/"
    package_prefix = "usr/palm/packages/" + app["id"] + "/"
    directories = {
        ".",
        "usr",
        "usr/palm",
        "usr/palm/applications",
        prefix.rstrip("/"),
        "usr/palm/services",
        service_prefix.rstrip("/"),
        "usr/palm/packages",
        package_prefix.rstrip("/"),
    }
    auxiliary = {
        service_prefix + "plxnative-storage",
        service_prefix + "services.json",
        package_prefix + "packageinfo.json",
    }
    files = tar_files(
        members["data.tar.gz"], lambda name: name in directories or name in auxiliary or name.startswith(prefix)
    )
    controls = tar_files(members["control.tar.gz"], lambda name: name in {".", "control"})
    if set(controls) != {"control"}:
        fail("Only package control metadata is permitted; installer hooks are forbidden")
    control = {}
    for line in controls["control"].decode().splitlines():
        if not line:
            continue
        field, separator, value = line.partition(":")
        field = field.lower()
        if not separator or field in control:
            fail("Malformed or duplicate IPK control field")
        control[field] = value.strip()
    descriptor = json.loads(files[prefix + "appinfo.json"])
    if any(descriptor.get(key) != app[key] for key in ("id", "title", "version")) or descriptor.get("type") != "native":
        fail("Packaged native identity mismatch")
    if (
        control.get("package") != app["id"]
        or control.get("version") != app["version"]
        or control.get("architecture") != "arm"
        or control.get("webos-package-format-version") != "2"
    ):
        fail("IPK control identity mismatch")
    if control.get("license") != "GPL-3.0-or-later":
        fail("GPL native package license missing")
    license_bytes = files.get(prefix + "licenses/LICENSE", b"")
    if hashlib.sha256(license_bytes).hexdigest() != sha256(HERE / "COPYING"):
        fail("Complete native GPL license text missing")
    if prefix + "THIRD-PARTY-NOTICES.md" not in files:
        fail("Native dependency notices missing")
    private_names = {"ottplay-profile.json", "ottplay-control.json", "ott-state", "ott-state.json"}
    if any(private_names.intersection(name.split("/")) for name in files):
        fail("Private profiles, control credentials and state must never be distributed in the IPK")
    if descriptor.get("main") != "plxnative":
        fail("Unexpected native application entry point")
    binary = files[prefix + descriptor["main"]]
    if not elf_arm(binary):
        fail("Native application must be a little-endian ELF32 ARM executable")
    storage = service_prefix + "plxnative-storage"
    if not elf_arm(files[storage]):
        fail("Native storage service missing or wrong architecture")
    service = json.loads(files[service_prefix + "services.json"])
    if (
        service.get("id") != service_id
        or service.get("engine") != "native"
        or service.get("executable") != "plxnative-storage"
        or service.get("services") != [{"name": service_id, "commands": []}]
    ):
        fail("Storage service identity or activation scope mismatch")
    package_info = json.loads(files[package_prefix + "packageinfo.json"])
    if (
        any(package_info.get(key) != app[key] for key in ("id", "version"))
        or package_info.get("app") != app["id"]
        or package_info.get("services") != [service_id]
        or package_info.get("package_format_version") != 2
    ):
        fail("Package descriptor app/service ownership mismatch")
    if package_info.get("requiredPermissions") != ["database.operation", "securitykey.operation"]:
        fail("Unexpected native service permission scope")
    if not any(name.startswith(prefix + "libavformat") for name in files):
        fail("Bundled native demuxer missing")
    if any(name.startswith("usr/palm/applications/") and not name.startswith(prefix) for name in files):
        fail("Package would install another application")
    result = {
        "application": app,
        "size": path.stat().st_size,
        "sha256": sha256(path),
        "architecture": "arm",
        "type": "native",
        "rootRequired": False,
        "payload_bytes": sum(len(data) for data in files.values()),
    }
    companion = verify_companion(files, prefix, members["data.tar.gz"])
    if companion is not None:
        result["companion"] = companion
    return result


def output_name(spec) -> str:
    return "ottplay-native-webos-" + spec["application"]["version"]


def package(args, spec):
    source = check_source(args, spec)
    app = spec["application"]
    built = source / "pkg" / (app["id"] + "_" + app["version"] + "_arm.ipk")
    verified = verify_ipk(built, spec)
    receipt_path = args.work_dir / "built.json"
    if not receipt_path.is_file():
        fail("Run build through this integration before packaging")
    receipt = json.loads(receipt_path.read_text())
    prepared = json.loads(source_receipt(args).read_text())
    if (
        any(receipt.get(key) != value for key, value in prepared.items())
        or receipt.get("ipk_sha256") != verified["sha256"]
        or receipt.get("companion") != verified.get("companion")
    ):
        fail("Native binary does not match its recorded source build")
    args.output.mkdir(parents=True, exist_ok=True)
    evidence_files = []
    for item in (receipt["compilation"]["cargo"], receipt["compilation"]["make"]):
        evidence = args.work_dir / item["file"]
        if Path(item["file"]).name != item["file"] or sha256(evidence) != item["sha256"]:
            fail("Native compilation evidence changed before packaging")
        evidence_files.append(evidence)
    destinations = [path.name for path in evidence_files]
    destinations.extend(output_name(spec) + suffix for suffix in (".ipk", ".json", ".sha256"))
    destinations.append("ottplay-native-webos-icon.png")
    if args.base_url:
        destinations.extend(("ottplay-native-webos-manifest.json", "ottplay-native-webos-repository.json"))
    for filename in destinations:
        if (args.output / filename).is_symlink():
            fail("Native package destination must not be a symlink")
    for evidence in evidence_files:
        target = args.output / evidence.name
        if evidence.resolve() != target.resolve():
            shutil.copy2(evidence, target)
    destination = args.output / (output_name(spec) + ".ipk")
    shutil.copy2(built, destination)
    shutil.copy2(source / "pkg/icon.png", args.output / "ottplay-native-webos-icon.png")
    verified.update(
        {
            "upstream": {"repository": spec["repository"], "revision": spec["revision"]},
            "integration_sha256": integration_digest(),
            "device_validation": "not_performed",
            "build": receipt,
        }
    )
    write_json(args.output / (output_name(spec) + ".json"), verified)
    (args.output / (output_name(spec) + ".sha256")).write_text(verified["sha256"] + "  " + destination.name + "\n")
    if args.base_url:
        feed(args, spec, verified, destination.name)
    print("Verified native IPK: " + str(destination))


def publication_base(value):
    base = value.rstrip("/")
    parsed = urlparse(base)
    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        fail("Homebrew publication base must be a plain HTTPS directory URL")
    return base


def feed(args, spec, verified, filename):
    base = publication_base(args.base_url)
    downloads = publication_base(getattr(args, "download_base_url", None) or base)
    app = spec["application"]
    item = {
        "id": app["id"],
        "version": app["version"],
        "type": "native",
        "title": app["title"],
        "appDescription": "Experimental native OTTPlay for TV channels, local videos and Plex. Separate installation.",
        "iconUri": base + "/ottplay-native-webos-icon.png",
        "ipkUrl": downloads + "/" + filename,
        "ipkHash": {"sha256": verified["sha256"]},
        "rootRequired": False,
        "installedSize": verified["payload_bytes"],
        "ipkSize": verified["size"],
        "sourceUrl": downloads + "/" + output_name(spec) + "-source-set.json",
        "sourceArchiveUrls": [
            downloads + "/" + output_name(spec) + "-source.tar.gz",
            downloads + "/" + output_name(spec) + "-runtime-source.tar.gz",
        ],
    }
    write_json(args.output / "ottplay-native-webos-manifest.json", item)
    write_json(
        args.output / "ottplay-native-webos-repository.json",
        {
            "packages": [
                {
                    "id": app["id"],
                    "title": app["title"],
                    "version": app["version"],
                    "iconUri": item["iconUri"],
                    "manifestUrl": base + "/ottplay-native-webos-manifest.json",
                }
            ]
        },
    )


def sources(args, spec):
    source = check_source(args, spec)
    with cargo_environment(args) as env:
        sources_with_environment(args, spec, source, env)


def sources_with_environment(args, spec, source, env):
    binary = args.output / (output_name(spec) + ".ipk")
    verify_ipk(binary, spec)
    recorded = json.loads((args.output / (output_name(spec) + ".json")).read_text())
    prepared = json.loads(source_receipt(args).read_text())
    if recorded.get("sha256") != sha256(binary) or any(
        recorded.get("build", {}).get(key) != value for key, value in prepared.items()
    ):
        fail("Package does not match the source build being archived")
    rust = toolchain(source)
    run(["rustup", "component", "add", "rust-src", "--toolchain", rust], env=env)
    run(
        ["cargo", "+" + rust, "fetch", "--locked", "--manifest-path", source / "rust-modules/Cargo.toml"],
        cwd=source,
        env=env,
    )
    # Upstream collector reads only declared, hash-verified dependency inputs;
    # it never archives the caller's whole Cargo cache or environment.
    private_values = args.work_dir / "private-values.json"
    write_json(private_values, [])
    output = args.output / (output_name(spec) + "-source.tar.gz")
    run(
        [
            sys.executable,
            source / "ci/prepare-source-release.py",
            "--inputs",
            args.work_dir / "source-inputs",
            "--output",
            output,
            "--binary",
            binary,
            "--private-values",
            private_values,
        ],
        cwd=source,
        env=env,
    )
    receipt_path = args.output / (output_name(spec) + ".json")
    receipt = json.loads(receipt_path.read_text())
    source_manifest = verify_source_archive(output, source, spec)
    receipt["corresponding_source"] = {
        "file": output.name,
        "sha256": sha256(output),
        "rebuild_validation": "not_performed",
        "snapshot_sha256": source_manifest["snapshot_sha256"],
    }
    write_json(receipt_path, receipt)
    print("Verified corresponding source archive: " + str(output))


def verify_source_archive(output: Path, source: Path, spec) -> dict:
    names, value = set(), None
    with tarfile.open(output, "r|gz") as archive:
        for member in archive:
            names.add(member.name)
            if member.name == "SOURCE-MANIFEST.json":
                value = json.load(archive.extractfile(member))
    if value is None:
        fail("Corresponding source manifest missing")
    dependencies = {row["id"]: row for row in value["dependencies"]}
    declared = json.loads((source / "ci/dependencies.json").read_text())
    required = {row["id"] for row in declared if row.get("bundled")} | {"cargo-vendor", "rust-runtime"}
    if not required <= dependencies.keys():
        fail("Corresponding source is missing bundled dependency inputs")
    for dependency in required:
        inputs = dependencies[dependency].get("sources", [])
        if not inputs or any(row["path"] not in names for row in inputs):
            fail("Dependency source must be included as bytes, not only a URL: " + dependency)
    if EXCLUDED_SOURCE in names:
        fail("Excluded platform-modification code entered the source distribution")
    if value.get("git_commit") != spec["revision"]:
        fail("Source archive records another upstream revision")
    for patch in (HERE / "patches").glob("*.patch"):
        name = "ci/ottplay-integration/patches/" + patch.name
        if value["files"].get(name, {}).get("sha256") != sha256(patch):
            fail("Source archive does not include the exact native overlay")
    report = json.loads(output.with_name(output.name + ".release.json").read_text())
    if report["source_archive_sha256"] != sha256(output):
        fail("Source archive validation receipt mismatch")
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument("command", choices=("prepare", "bootstrap", "build", "package", "source", "verify", "all"))
    parser.add_argument("--work-dir", type=Path, default=ROOT / "build/native-webos")
    parser.add_argument(
        "--sdk", type=Path, default=Path(os.environ["WEBOS_SDK"]) if os.environ.get("WEBOS_SDK") else None
    )
    parser.add_argument("--output", type=Path)
    parser.add_argument("--local-upstream", type=Path, help="Optional local clone containing the exact upstream pin")
    parser.add_argument(
        "--companion-bundle", type=Path, help="Explicit verified companion bundle to stage before IPK creation"
    )
    parser.add_argument(
        "--base-url", help="Exact HTTPS publication directory; emits Homebrew metadata without publishing"
    )
    parser.add_argument(
        "--download-base-url", help="Optional HTTPS directory for IPK and source downloads, separate from metadata"
    )
    parser.add_argument("--jobs", type=int, default=2)
    parser.add_argument("--rust-opt-level", choices=("2", "s"), default="2",
                        help="Native release optimization only; companion settings remain independent")
    parser.add_argument("--control-discovery-url", help="Explicit public HTTPS catalog URL (build/all only)")
    parser.add_argument("--control-discovery-sha256", help="Reviewed raw catalog SHA-256 (build/all only)")
    args = parser.parse_args()
    control_discovery_profile(args)
    if (args.control_discovery_url is not None or args.control_discovery_sha256 is not None) and args.command not in ("build", "all"):
        fail("Control discovery inputs are only accepted by build or all")
    args.work_dir = args.work_dir.expanduser().resolve()
    args.output = (args.output or args.work_dir / "dist").expanduser().resolve()
    if args.companion_bundle is not None:
        args.companion_bundle = args.companion_bundle.expanduser().resolve(strict=True)
    spec = manifest()
    args.sdk = (args.sdk or args.work_dir / "toolchain" / spec["sdk"]["directory"]).expanduser().resolve()
    if args.jobs < 1 or args.jobs > 32:
        fail("--jobs must be between 1 and 32")
    commands = {"prepare": prepare, "bootstrap": bootstrap, "build": build, "package": package, "source": sources}
    if args.command == "all":
        for command in commands.values():
            command(args, spec)
    elif args.command == "verify":
        print(json.dumps(verify_ipk(args.output / (output_name(spec) + ".ipk"), spec), indent=2))
    else:
        commands[args.command](args, spec)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError, tarfile.TarError, subprocess.CalledProcessError) as error:
        print("Native webOS build failed: " + str(error), file=sys.stderr)
        sys.exit(1)
