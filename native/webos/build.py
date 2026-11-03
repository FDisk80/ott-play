#!/usr/bin/env python3
"""Build the separate, GPL-licensed native webOS Plex application.

No command installs or launches an application. Build outputs and native
dependency caches stay in the chosen work directory. Rust toolchains and the
Cargo registry use their normal user locations.
"""

from __future__ import annotations

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
# Unused upstream platform-modification implementation is never part of this
# product's source or binary distribution. The overlay removes its module.
EXCLUDED_SOURCE = "rust-modules/platform/src/webos/jail_repair.rs"


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


def integration_files() -> list[Path]:
    names = ("build.py", "upstream.json", "README.md", "COPYING", "test_build.py")
    return sorted([HERE / name for name in names] + list((HERE / "patches").glob("*.patch")))


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
    write_json(integration / "PROVENANCE.json", dict(expected, patches={p.name: sha256(p) for p in patches}))
    run(["git", "-C", source, "add", "ci/ottplay-integration"])
    write_json(receipt, dict(expected, tree=source_tree(source)))
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
    if app.get("type") != "native":
        fail("Expected a native application, not a web launcher")
    if (source / "pkg/telemetry.local.json").exists():
        fail("Private upstream build settings are not permitted in this target")
    if (source / EXCLUDED_SOURCE).exists() or (source / "pkg/ottplay-profile.json").exists():
        fail("Prepared source contains excluded code or private profile settings")
    return source


def toolchain(source: Path) -> str:
    text = (source / "rust-modules/rust-toolchain.toml").read_text()
    match = re.search(r'^channel\s*=\s*"([0-9.]+)"', text, re.MULTILINE)
    if not match:
        fail("Missing exact Rust toolchain pin")
    return match.group(1)


def build_env(args) -> dict:
    env = dict(os.environ)
    for key in list(env):
        if key.startswith(("PLX_", "SENTRY_", "POSTHOG_", "OTTPLAY_")) or key in {
            "RUSTFLAGS",
            "CARGO_ENCODED_RUSTFLAGS",
            "MAKEFLAGS",
            "MFLAGS",
            "LAB",
            "SYMBOLS",
            "RUST_FEATFLAGS",
            "RUST_TOOLCHAIN",
            "RUST_TARGET",
            "RUST_TDIR",
        }:
            env.pop(key)
    env.update(
        {
            "WEBOS_SDK": str(args.sdk),
            "RELEASE": "1",
            "FLAVOR": "stable",
            "PLX_BUILD_CACHE": str(args.work_dir / "cache"),
            "PLX_DEPS_CACHE": str(source_dir(args) / "vendor/downloads"),
            "PLX_DISK_BUDGET_DONE": "1",
            "CARGO_INCREMENTAL": "0",
        }
    )
    return env


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
    source = check_source(args, spec)
    if not (args.sdk / "bin/arm-webos-linux-gnueabi-gcc").is_file():
        fail("SDK is missing; run bootstrap or supply --sdk")
    # Source overlay removes upstream device-repair and automatic cleanup entry
    # points. No make target accepting a TV address is ever invoked here.
    make = ["make", "-j" + str(args.jobs), "RELEASE=1", "FLAVOR=stable"]
    environment = build_env(args)
    companion = getattr(args, "companion_bundle", None)
    expected_companion = None
    if companion is not None:
        companion = companion.resolve(strict=True)
        module = companion_builder()
        # Fail before native compilation if the supplied helper or its inputs
        # changed. The stage command repeats this check after compilation.
        module.checked_bundle(companion, args.sdk / "bin/arm-webos-linux-gnueabi-readelf")
        expected_companion = sha256(companion / "receipt.json")
        run(make + ["ipk-stage"], cwd=source, env=environment)
        stage = source / "ipkroot/data/usr/palm/applications" / spec["application"]["id"]
        if not stage.is_dir() or stage.is_symlink():
            fail("Native application staging directory is missing or unsafe")
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
            env=environment,
        )
        run(make + ["ipk-pack"], cwd=source, env=environment)
    else:
        run(make + ["ipk"], cwd=source, env=environment)
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
            "configuration": {"RELEASE": "1", "FLAVOR": "stable", "target": TARGET},
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
    env = build_env(args)
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
    parser = argparse.ArgumentParser(description=__doc__)
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
    args = parser.parse_args()
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
