#!/usr/bin/env python3
"""Build a same-ID diagnostic IPK; never create a release/promotion manifest.

The shipping build.py remains authoritative for shipping. This entry point reuses
its prepared source, SDK, isolated environment, package and companion checks,
but deliberately requests the established devtriggers + separated-symbol recipe.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tarfile

_path = Path(__file__).with_name("build.py")
_spec = importlib.util.spec_from_file_location("native_shipping_build", _path)
native = importlib.util.module_from_spec(_spec)
exec(compile(_path.read_bytes(), str(_path), "exec"), native.__dict__)

_verifier_path = native.ROOT / "scripts/verify-webos-native-release.py"
_verifier_spec = importlib.util.spec_from_file_location("native_package_verifier", _verifier_path)
release_verifier = importlib.util.module_from_spec(_verifier_spec)
exec(compile(_verifier_path.read_bytes(), str(_verifier_path), "exec"), release_verifier.__dict__)

FEATURES = "--no-default-features --features devtriggers"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def source_identity(expected):
    require(re.fullmatch(r"[0-9a-f]{40}", expected) is not None, "Expected a full source SHA")
    actual = native.run(["git", "rev-parse", "HEAD"], cwd=native.ROOT, capture=True)
    require(actual == expected, "Checkout differs from selected source")
    require(not native.run(["git", "status", "--porcelain", "--untracked-files=no"],
                           cwd=native.ROOT, capture=True), "Tracked source changed")
    return {"commit": actual, "tree": native.run(["git", "rev-parse", "HEAD^{tree}"],
                                                 cwd=native.ROOT, capture=True)}


def cargo_artifact(raw, source, archive):
    require(len(raw) <= native.CARGO_EVIDENCE_LIMIT, "Cargo evidence exceeds limit")
    rows = [json.loads(line) for line in raw.splitlines() if line.strip()]
    require(rows and all(isinstance(row, dict) for row in rows), "Missing Cargo records")
    finished = [row for row in rows if row.get("reason") == "build-finished"]
    require(len(finished) == 1 and finished[0].get("success") is True
            and rows[-1] == finished[0], "Cargo did not finish successfully")
    app = [row for row in rows if row.get("reason") == "compiler-artifact"
           and row.get("target", {}).get("name") == "plxnative_modules"]
    require(len(app) == 1, "Expected exactly one native staticlib")
    row = app[0]
    profile = {"opt_level": "2", "debuginfo": 0, "debug_assertions": False,
               "overflow_checks": False, "test": False}
    # Cargo's profile remains debuginfo=0; Make adds -C debuginfo=2 through
    # RUSTFLAGS. The effective flags AND actual ELF DWARF are checked separately.
    require(row.get("features") == ["devtriggers"]
            and row.get("manifest_path") == str(source / "rust-modules/Cargo.toml")
            and row["target"].get("src_path") == str(source / "rust-modules/src/lib.rs")
            and row["target"].get("kind") == ["staticlib"]
            and row["target"].get("crate_types") == ["staticlib"]
            and row.get("filenames") == [str(archive)]
            and all(type(row.get("profile", {}).get(key)) is type(value)
                    and row["profile"][key] == value for key, value in profile.items()),
            "Cargo artifact differs from diagnostic configuration")
    return row


def build_id(readelf, path):
    output = native.run([readelf, "-n", path], capture=True)
    ids = re.findall(r"Build ID: ([0-9a-f]+)", output)
    require(len(ids) == 1 and len(ids[0]) == 40, "Missing/ambiguous GNU build ID")
    return ids[0]


def elf_metadata_valid(member, app_id):
    prefix = "usr/palm/applications/" + app_id + "/"
    executables = {prefix + "plxnative", prefix + "sentry-crash", prefix + "bin/ottplay-companion",
                   "usr/palm/services/" + app_id + ".storage/plxnative-storage"}
    name = native.safe_name(member.name)
    if name in executables:
        mode = 0o755
    elif name.startswith(prefix) and re.fullmatch(r"lib(?:avcodec|avformat|avutil|ass)-plx\.so\.[0-9]+",
                                                name[len(prefix):]):
        mode = 0o644
    else:
        return False
    return member.isfile() and member.mode == mode and member.uid == member.gid == 0


def verify_diagnostic_package(ipk, spec):
    release_verifier.regular(ipk, release_verifier.IPK_LIMIT)
    members = native.ar_members(ipk.read_bytes())
    # Refuse expansion, malformed members and private paths before the smaller
    # structural verifier materializes the decompressed payload in memory.
    rows, _ = release_verifier.index_archive(native.io.BytesIO(members["data.tar.gz"]),
                                              total_limit=512 * 1024 * 1024, regular_only=False)
    release_verifier.index_archive(native.io.BytesIO(members["control.tar.gz"]),
                                   total_limit=release_verifier.JSON_LIMIT, regular_only=False)
    release_verifier.check_private_paths(rows)
    verified = native.verify_ipk(ipk, spec)
    # Reuse the full bounded archive/private-path/artwork admission without
    # claiming (or relaxing) the separate shipping build-configuration contract.
    release_verifier.check_package(ipk, {**verified, "build": {"companion": verified.get("companion")}})
    return verified


def build(args):
    source_before = source_identity(args.source_sha)
    require(os.environ.get("GITHUB_ACTIONS") == "true", "Diagnostic build runs on GitHub workers")
    require(os.environ.get("GITHUB_REPOSITORY") == "open-ott-play/ottplay-foss",
            "Unexpected diagnostic repository")
    require(native.sdk_host() == "linux-aarch64", "Expected Linux ARM worker")
    spec = native.manifest()
    source = native.check_source(args, spec)
    prepared = native.source_receipt(args).read_bytes()
    require(native.sha256(args.sdk_archive) == spec["sdk"]["assets"]["linux-aarch64"]["sha256"],
            "SDK archive identity differs")
    require(not args.output.exists(), "Diagnostic output must be new")
    readelf = args.sdk / "bin/arm-webos-linux-gnueabi-readelf"
    native.companion_builder().checked_bundle(args.companion_bundle, readelf)
    companion_sha = native.sha256(args.companion_bundle / "receipt.json")
    archive_rel = "rust-modules/target-release/" + native.TARGET + "/release/libplxnative_modules.a"
    archive = source / archive_rel
    make = ["make", "-j" + str(args.jobs), "RELEASE=1", "FLAVOR=stable", "SYMBOLS=1",
            "ALLOW_DEV_ON_STABLE=1", "OTT_PRODUCT_CONFIG=" + native.PRODUCT_CONFIG,
            "ARM_PROFILE=release", "RUST_TDIR=target-release", "STORAGE_TDIR=target-release-storage",
            "RUST_TARGET=" + native.TARGET, "RUST_TOOLCHAIN=" + native.toolchain(source),
            "RUST_FEATFLAGS=" + FEATURES]
    with native.cargo_environment(args) as environment:
        environment.update(CARGO_BUILD_JOBS=str(args.jobs), CARGO_PROFILE_RELEASE_LTO="fat",
                           CARGO_PROFILE_RELEASE_CODEGEN_UNITS="1")
        configuration = native.run(make + ["-s", "print-bench-config"], cwd=source,
                                   env=environment, capture=True)
        settings = dict(line.split("=", 1) for line in configuration.splitlines() if "=" in line)
        for key, value in {"RUST_TDIR": "target-release", "RUST_TARGET": native.TARGET,
                           "ARM_PROFILE": "release", "ARM_PROFILE_FLAG": "--release",
                           "RUST_LIB": archive_rel, "RUST_FEATFLAGS": FEATURES,
                           "RUST_TOOLCHAIN": native.toolchain(source)}.items():
            require(settings.get(key) == value, "Unexpected Make setting: " + key)
        require("-C debuginfo=2" in settings.get("RUST_ENV", ""), "Missing effective symbols flag")
        native.run(make + ["-W", "rust-modules/Cargo.toml", archive_rel], cwd=source, env=environment)
        raw = (source / "rust-modules/target-release/.lib-artifacts.json").read_bytes()
        artifact = cargo_artifact(raw, source, archive)
        archive_sha = native.sha256(archive)
        native.run(make + ["-W", "rust-modules/Cargo.toml", "pkg/plxnative-storage"],
                   cwd=source, env=environment)
        native.run(make + ["-W", archive_rel, "ipk-stage", "symbols"], cwd=source, env=environment)
        require(native.sha256(archive) == archive_sha
                and (source / "rust-modules/target-release/.lib-artifacts.json").read_bytes() == raw,
                "Application archive/evidence changed during linking")
        stamp = (source / "pkg/.build-config").read_text()
        require(stamp.startswith("features:" + FEATURES + "+symbols+"), "Wrong final build stamp")
        stage = source / "ipkroot/data/usr/palm/applications" / spec["application"]["id"]
        native.run(["bash", source / "ci/check-elf.sh", source / "pkg/plxnative"],
                   cwd=source, env=environment)
        companion_env = {k: v for k, v in environment.items() if not k.startswith("CARGO_PROFILE_")}
        native.run([sys.executable, native.HERE / "companion/build.py", "stage",
                    "--bundle", args.companion_bundle, "--readelf", readelf,
                    "--destination", stage, "--link-evidence", source / "pkg/link-evidence/stable"],
                   cwd=native.ROOT, env=companion_env)
        # The existing packager is shared. ipk-pack/check-package are SHIPPING
        # gates and intentionally reject this requested same-ID devtriggers build.
        # Do not weaken those gates or generate a shipping built.json/manifest.
        native.run([sys.executable, source / "ci/mkipk.py"], cwd=source, env=environment)
        storage = source / "ipkroot/data/usr/palm/services" / (spec["application"]["id"] + ".storage/plxnative-storage")
        native.run([sys.executable, source / "ci/stage-link-evidence.py", source / "pkg/plxnative-storage",
                    storage, "--evidence-base", source / "pkg/link-evidence/stable/plxnative-storage"],
                   cwd=source, env=environment)
        ipk = source / "pkg" / (spec["application"]["id"] + "_" + spec["application"]["version"] + "_arm.ipk")
        verified = verify_diagnostic_package(ipk, spec)
        require(verified.get("companion", {}).get("receipt_sha256") == companion_sha,
                "Packaged companion differs")
        native.run([sys.executable, source / "ci/check-packaged-elf.py", ipk,
                    source / "pkg/link-evidence/stable"], cwd=source, env=environment)
        symbols = source / "pkg/plxnative.debug"
        main_id = build_id(readelf, stage / "plxnative")
        require(main_id == build_id(readelf, symbols), "Symbols belong to another executable")
        sections = native.run([readelf, "-SW", symbols], capture=True)
        require(".debug_info " in sections and ".debug_line " in sections, "Empty diagnostic symbols")
        members = native.ar_members(ipk.read_bytes())
        files = native.tar_files(members["data.tar.gz"])
        prefix = "usr/palm/applications/" + spec["application"]["id"] + "/"
        for name, expected in [(prefix + "plxnative", stage / "plxnative"),
                               ("usr/palm/services/" + spec["application"]["id"] + ".storage/plxnative-storage",
                                source / "pkg/plxnative-storage")]:
            require(files[name] == expected.read_bytes(), "Packaged executable differs from stage")
        require(all(json.loads(blob).get("title") == "OTTPlay" for name, blob in files.items()
                    if name.startswith(prefix + "resources/") and name.endswith("/appinfo.json")),
                "Localized title differs")
        with tarfile.open(fileobj=native.io.BytesIO(members["data.tar.gz"]), mode="r:gz") as tar:
            for member in tar:
                if member.isfile() and files[native.safe_name(member.name)].startswith(b"\x7fELF"):
                    require(elf_metadata_valid(member, spec["application"]["id"]),
                            "ELF metadata differs from its normalized role")
        native.check_source(args, spec)
        require(native.source_receipt(args).read_bytes() == prepared
                and source_identity(args.source_sha) == source_before, "Source changed during build")
        args.output.mkdir(parents=True)
        shutil.copyfile(ipk, args.output / "ottplay-native-diagnostic.ipk")
        shutil.copyfile(symbols, args.output / "plxnative.debug")
        (args.output / "prepared.json").write_bytes(prepared)
        (args.output / "cargo-artifacts.jsonl").write_bytes(raw)
        (args.output / "build-config.txt").write_text(configuration + "\n" + stamp + "\n")
        shutil.copytree(source / "pkg/link-evidence/stable", args.output / "link-evidence")
        payload = {p.relative_to(args.output).as_posix(): {"sha256": native.sha256(p), "bytes": p.stat().st_size}
                   for p in sorted(args.output.rglob("*")) if p.is_file()}
        receipt = {"schema": 1, "kind": "ottplay-native-diagnostic", "build_mode": args.build_mode,
                   "status": "BUILT_AND_PACKAGE_VERIFIED", "official_release": False,
                   "device_executed": False, "full_suite_executed": False,
                   "complete_corresponding_source": False, "foss": source_before,
                   "native": json.loads(prepared), "application": spec["application"],
                   "toolchain": {"rust": native.toolchain(source),
                                 "sdk_archive_sha256": native.sha256(args.sdk_archive),
                                 "sdk_compiler_sha256": native.sha256(args.sdk / "bin/arm-webos-linux-gnueabi-gcc.br_real")},
                   "github": {key: os.environ.get("GITHUB_" + key.upper()) for key in
                              ("repository", "run_id", "run_attempt", "event_name", "sha", "workflow_ref")},
                   "configuration": {"flavor": "stable", "symbols": True, "features": ["devtriggers"],
                                     "opt_level": "2", "lto": "fat", "codegen_units": 1, "jobs": args.jobs},
                   "compilation": {"archive_sha256": archive_sha, "artifact": artifact},
                   "main": {"sha256": native.sha256(stage / "plxnative"), "build_id": main_id},
                   "package": verified, "files": payload}
        native.write_json(args.output / "diagnostic.json", receipt)
        print("Diagnostic package verified; NOT a shipping/release candidate")


def main():
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument("--build-mode", choices=["debug"], required=True)
    parser.add_argument("--source-sha", required=True)
    parser.add_argument("--work-dir", type=Path, default=native.ROOT / "build/native-webos")
    parser.add_argument("--sdk", type=Path, required=True)
    parser.add_argument("--sdk-archive", type=Path, required=True)
    parser.add_argument("--companion-bundle", type=Path, required=True)
    parser.add_argument("--jobs", type=int, choices=[1, 2], default=2)
    parser.add_argument("--control-discovery-url")
    parser.add_argument("--control-discovery-sha256")
    args = parser.parse_args()
    args.rust_opt_level = "2"
    for key in ("work_dir", "sdk", "sdk_archive", "companion_bundle"):
        setattr(args, key, getattr(args, key).resolve(strict=True))
    args.output = args.work_dir / "diagnostic"
    build(args)


if __name__ == "__main__":
    main()
