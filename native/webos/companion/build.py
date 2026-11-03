#!/usr/bin/env python3
"""Build, attest and stage the existing loopback companion for native webOS."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import importlib.util
import io
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path, PurePosixPath

import tomllib

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SPEC = json.loads((HERE / "manifest.json").read_text())
LINKER_SPEC = importlib.util.spec_from_file_location("ott_companion_webos_link", ROOT / "src-rs/companion/webos_link.py")
linker = importlib.util.module_from_spec(LINKER_SPEC)
LINKER_SPEC.loader.exec_module(linker)


def fail(message):
    raise ValueError(message)


def canonical(value):
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode()


def sha(path):
    value = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for data in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(data)
    return value.hexdigest()


def safe_relative(value):
    path = PurePosixPath(value)
    if not value or path.is_absolute() or ".." in path.parts or "\\" in value:
        fail("Unsafe relative source or install path")
    return path.as_posix()


def run(command, **kwargs):
    return subprocess.run(command, check=True, capture_output=True, text=True, **kwargs).stdout


def version(value):
    return tuple(int(part) for part in value.split("."))


def validate_rust_identity(identity, spec=SPEC):
    """Validate the full toolchain pin at every build/source entry point."""
    commit = spec.get("rust_commit", "")
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        fail("Missing full Rust compiler commit in build policy")
    fields = {}
    for line in identity.splitlines()[1:]:
        name, separator, value = line.partition(": ")
        if separator:
            if name in fields:
                fail("Duplicate Rust compiler identity field")
            fields[name] = value
    if (not identity.startswith("rustc " + spec["rust_toolchain"] + " ")
            or fields.get("release") != spec["rust_toolchain"] or fields.get("commit-hash") != commit):
        fail("Unexpected Rust toolchain release or commit")


def inspect_elf(binary, report, spec=SPEC):
    """Inspect actual ELF headers; readelf supplies symbols/dynamic information."""
    linker.check_embedded_paths(binary)
    data = Path(binary).read_bytes()
    if len(data) < 52 or data[:7] != b"\x7fELF\x01\x01\x01":
        fail("Companion must be a little-endian ELF32 executable")
    fields = struct.unpack_from("<HHIIIIIHHHHHH", data, 16)
    kind, machine, elf_version, _, phoff, _, flags, ehsize, phsize, phnum, _, _, _ = fields
    if kind not in (2, 3) or machine != 40 or elf_version != 1 or ehsize != 52:
        fail("Companion is not an ARM executable")
    if flags >> 24 != 5 or flags & 0x400 or not flags & 0x200:
        fail("Companion must use ARM EABI5 soft-float, not hard-float")
    if phsize != 32 or not phnum or phoff < 52 or phoff + phsize * phnum > len(data):
        fail("Malformed ELF program headers")
    interpreters, stacks = [], []
    for offset in range(phoff, phoff + phsize * phnum, phsize):
        ptype, start, _, _, size, _, pflags, _ = struct.unpack_from("<IIIIIIII", data, offset)
        if start + size > len(data):
            fail("ELF segment extends outside executable")
        if ptype == 3:
            segment = data[start : start + size]
            if not segment.endswith(b"\0"):
                fail("Unterminated ELF interpreter")
            interpreters.append(segment[:-1].decode("ascii"))
        if ptype == 0x6474E551:
            stacks.append(pflags)
        if ptype == 1 and pflags & 3 == 3:
            fail("Executable has a writable executable LOAD segment")
    if interpreters != [spec["elf"]["interpreter"]]:
        fail("Unexpected ELF program interpreter")
    if len(stacks) != 1 or stacks[0] & 1:
        fail("Executable stack or missing GNU_STACK declaration")
    needed = sorted(re.findall(r"\(NEEDED\).*?\[([^\]]+)\]", report))
    if not needed or "libc.so.6" not in needed or set(needed) - set(spec["elf"]["needed"]):
        fail("Unexpected or missing dynamic library dependencies")
    if re.search(r"\((?:RPATH|RUNPATH|TEXTREL)\)", report):
        fail("Unexpected runtime search path or text relocation")
    symbols = sorted(set(re.findall(r"\b(?:GLIBC|GCC)_[A-Za-z0-9_.]+", report)))
    for prefix, maximum in (("GLIBC", "max_glibc"), ("GCC", "max_gcc")):
        versions = [s.split("_", 1)[1] for s in symbols if s.startswith(prefix + "_")]
        if prefix == "GLIBC" and not versions:
            fail("No glibc version evidence")
        if any(not re.fullmatch(r"\d+(?:\.\d+)+", v) or version(v) > version(spec["elf"][maximum]) for v in versions):
            fail("Unsupported " + prefix + " symbol requirement")
    if re.search(r"\bUND\b[^\n]*\bgetauxval(?:@|\s|$)", report):
        fail("getauxval must be supplied by the legacy compatibility module")
    return {"sha256": sha(binary), "bytes": len(data), "machine": "ARM", "class": 32,
            "eabi": 5, "float_abi": "soft", "interpreter": interpreters[0],
            "needed": needed, "symbol_versions": symbols, "device_executed": False}


def elf_report(binary, readelf):
    return run([str(readelf), "--wide", "--file-header", "--program-headers", "--dynamic",
                "--version-info", "--dyn-syms", str(binary)], env={**os.environ, "LC_ALL": "C"})


def source_inventory(root=ROOT, spec=SPEC):
    """Track relevant source, including uncommitted additions, never ignored output."""
    names = run(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--",
                 *spec["source_roots"]], cwd=root).split("\0")
    result = []
    for name in sorted(set(names) - {""}):
        name = safe_relative(name)
        path = root / name
        if path.is_symlink() or any(parent.is_symlink() for parent in path.parents if parent != root and root in parent.parents):
            fail("Symlink not allowed in companion source: " + name)
        if not path.is_file():
            fail("Tracked companion input missing: " + name)
        result.append({"path": name, "sha256": sha(path), "bytes": path.stat().st_size,
                       "mode": 0o755 if path.stat().st_mode & 0o111 else 0o644})
    available = {row["path"] for row in result}
    if set(spec["required_source_files"]) - available:
        fail("Required companion source is absent from source inventory")
    return result


def source_receipt(inventory, root=ROOT):
    lock = tomllib.loads((root / "Cargo.lock").read_text())
    external = [{key: p[key] for key in ("name", "version", "source", "checksum") if key in p}
                for p in lock["package"] if "source" in p]
    return {"schema": 1, "local_inputs_sha256": hashlib.sha256(canonical(inventory)).hexdigest(),
            "local_inputs": inventory, "cargo_lock_dependencies": external,
            "dependency_scope": "Entire workspace lock, including dependencies not linked into this helper",
            "release_source_requirements": SPEC["release_source_requirements"],
            "complete_corresponding_source": False,
            "note": "Local source receipt only; release source collector must include locked external dependencies, Rust and linked SDK runtime sources."}


def assert_sources(receipt, root=ROOT):
    if source_inventory(root) != receipt["local_inputs"]:
        fail("Companion source changed after build; rebuild before packaging")


def local_source_archive(destination, source, root=ROOT):
    """Deterministic local-source archive; dependency/license completion is external."""
    assert_sources(source, root)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as temporary:
        pending = Path(temporary.name)
    try:
        with (pending.open("wb") as output,
              gzip.GzipFile(filename="", fileobj=output, mode="wb", mtime=0) as compressed,
              tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as archive):
            for row in source["local_inputs"]:
                content = (root / row["path"]).read_bytes()
                if hashlib.sha256(content).hexdigest() != row["sha256"]:
                    fail("Source changed during archive creation")
                info = tarfile.TarInfo("source/" + safe_relative(row["path"]))
                info.size, info.mode, info.mtime = len(content), row["mode"], 0
                archive.addfile(info, io.BytesIO(content))
            content = canonical(source)
            info = tarfile.TarInfo("source-receipt.json")
            info.size, info.mode, info.mtime = len(content), 0o644, 0
            archive.addfile(info, io.BytesIO(content))
        assert_sources(source, root)
        pending.replace(destination)
    finally:
        pending.unlink(missing_ok=True)


def sdk_tools(sdk):
    sdk = sdk.resolve(strict=True)
    names = ("gcc", "g++", "ar", "readelf")
    paths = {name: sdk / ("bin/arm-webos-linux-gnueabi-" + name) for name in names}
    for path in paths.values():
        if not path.is_file():
            fail("Missing SDK executable: " + path.name)
    return paths


def attest_sdk(sdk, archive):
    """Archive pin is required; extracted SDK input hashes detect local changes."""
    spec = json.loads((HERE.parent / "upstream.json").read_text())["sdk"]
    archive_hash = sha(archive)
    matches = [host for host, row in spec["assets"].items() if row["sha256"] == archive_hash]
    if len(matches) != 1:
        fail("SDK archive does not match a pinned webOS SDK")
    # Record what is actually used; archive pin alone does not prove extraction.
    tools = sdk_tools(sdk)
    compiler = linker.compiler_digests(tools["gcc"])
    return {"version": spec["version"], "archive_sha256": archive_hash, "host": matches[0],
            "executables": {**{name: sha(path.resolve()) for name, path in tools.items()},
                            "gcc_backend": compiler["compiler_backend_sha256"]},
            "extracted_tree_attested": False,
            "note": "Release runtime-source collector must verify used SDK inputs against the pinned archive."}


def build(args):
    if args.jobs < 1 or args.jobs > 2:
        fail("Use one or two build jobs")
    output = args.output.resolve()
    if output.exists() and any(output.iterdir()):
        fail("Use an empty companion bundle output directory")
    target = args.target_dir.resolve()
    target.mkdir(parents=True, exist_ok=True)
    tools = sdk_tools(args.sdk)
    sdk = attest_sdk(args.sdk, args.sdk_archive)
    environment = {**os.environ, "RUSTUP_TOOLCHAIN": SPEC["rust_toolchain"],
                   "CARGO_BUILD_JOBS": str(args.jobs), "CARGO_INCREMENTAL": "0", "LC_ALL": "C"}
    for name in ("RUSTC", "RUSTC_WRAPPER", "RUSTC_WORKSPACE_WRAPPER", "RUSTFLAGS",
                 "CARGO_ENCODED_RUSTFLAGS", "CARGO_BUILD_RUSTC_WRAPPER", "CARGO_BUILD_RUSTC_WORKSPACE_WRAPPER"):
        environment.pop(name, None)
    rustc = run(["rustc", "--version", "--verbose"], env=environment).strip()
    validate_rust_identity(rustc)
    inventory = source_inventory()
    source = source_receipt(inventory)
    command = [sys.executable, str(ROOT / "src-rs/companion/build-webos.py"),
               "--sdk", str(args.sdk.resolve()), "--target-dir", str(target)]
    if args.libclang:
        libclang = args.libclang.expanduser().absolute()
        if not (libclang.is_file() or libclang.is_dir()):
            fail("Host libclang path is missing or unsupported")
        # clang-sys matches the supplied basename; keep an accepted symlink name.
        command.extend(["--libclang", str(libclang)])
    subprocess.run(command, cwd=ROOT, env=environment, check=True)
    assert_sources(source)
    binary = target / SPEC["target"] / "release" / SPEC["package"]
    link_record = linker.check_evidence(binary, compiler=tools["gcc"])
    if (link_record["compiler_sha256"] != sdk["executables"]["gcc"]
            or link_record["compiler_backend_sha256"] != sdk["executables"]["gcc_backend"]):
        fail("SDK compiler or backend changed after build preparation")
    elf = inspect_elf(binary, elf_report(binary, tools["readelf"]))
    output.mkdir(parents=True, exist_ok=True)
    local_source_archive(output / "local-source.tar.gz", source)
    (output / "source-receipt.json").write_bytes(canonical(source))
    shutil.copyfile(binary, output / "ottplay-companion")
    (output / "ottplay-companion").chmod(0o755)
    # Preserve actual linker evidence for the release runtime-source collector,
    # never reconstruct an input trace from the ELF or put private paths in IPK.
    for suffix in linker.SUFFIXES:
        shutil.copyfile(linker.sidecar(binary, suffix), linker.sidecar(output / SPEC["package"], suffix))
    receipt = {"schema": 1, "package": SPEC["package"], "target": SPEC["target"],
               "features": SPEC["features"], "manifest_sha256": sha(HERE / "manifest.json"),
               "rustc": rustc, "sdk": sdk, "elf": elf, "device_executed": False,
               "source_receipt_sha256": sha(output / "source-receipt.json"),
               "local_inputs_sha256": source["local_inputs_sha256"],
               "local_source_archive_sha256": sha(output / "local-source.tar.gz"),
               "link_map_sha256": sha(output / "ottplay-companion.link.map"),
               "link_trace_sha256": sha(output / "ottplay-companion.link.trace"),
               "link_receipt_sha256": sha(output / "ottplay-companion.link.json"),
               "sdk_glibc_polyfills_linked": False}
    (output / "receipt.json").write_bytes(canonical(receipt))
    print(json.dumps({"output": str(output), "sha256": elf["sha256"], "device_executed": False}))


def checked_bundle(bundle, readelf, root=ROOT):
    receipt = json.loads((bundle / "receipt.json").read_text())
    for name, key in (("source-receipt.json", "source_receipt_sha256"),
                      ("local-source.tar.gz", "local_source_archive_sha256"),
                      ("ottplay-companion.link.map", "link_map_sha256"),
                      ("ottplay-companion.link.trace", "link_trace_sha256"),
                      ("ottplay-companion.link.json", "link_receipt_sha256")):
        if sha(bundle / name) != receipt[key]:
            fail("Bundle checksum mismatch: " + name)
    if receipt["manifest_sha256"] != sha(HERE / "manifest.json"):
        fail("Build policy changed after companion build")
    validate_rust_identity(receipt["rustc"])
    source = json.loads((bundle / "source-receipt.json").read_text())
    assert_sources(source, root)
    compiler = Path(readelf).with_name("arm-webos-linux-gnueabi-gcc")
    link_record = linker.check_evidence(bundle / SPEC["package"], compiler=compiler)
    if (link_record["compiler_sha256"] != receipt["sdk"]["executables"]["gcc"]
            or link_record["compiler_backend_sha256"] != receipt["sdk"]["executables"]["gcc_backend"]):
        fail("Bundle compiler or backend digest differs from link evidence")
    elf = inspect_elf(bundle / "ottplay-companion", elf_report(bundle / "ottplay-companion", readelf))
    if elf != receipt["elf"] or "libglibc_polyfills" in (bundle / "ottplay-companion.link.map").read_text():
        fail("Companion changed after build or links prohibited SDK polyfills")
    return receipt, source


def stage(args):
    receipt, source = checked_bundle(args.bundle.resolve(), args.readelf)
    destination = args.destination.resolve()
    # Only own these two new paths. Never replace another packager's output.
    binary = destination / safe_relative(SPEC["install_path"])
    metadata = destination / "companion"
    evidence = getattr(args, "link_evidence", None)
    if evidence is not None:
        evidence = evidence.resolve()
        if evidence == destination or destination in evidence.parents:
            fail("Private linker evidence must be outside the staged application")
        if any(linker.sidecar(evidence / SPEC["package"], suffix).exists() for suffix in linker.SUFFIXES):
            fail("Linker evidence already staged; use a fresh evidence directory")
    if binary.exists() or binary.is_symlink() or metadata.exists() or metadata.is_symlink():
        fail("Companion already staged; use a fresh package directory")
    destination.mkdir(parents=True, exist_ok=True)
    for parent in (binary.parent, metadata):
        if parent.is_symlink():
            fail("Package destination contains symlink")
        parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(args.bundle / "ottplay-companion", binary)
    binary.chmod(0o755)
    shutil.copyfile(HERE / "manifest.json", metadata / "manifest.json")
    (metadata / "receipt.json").write_bytes(canonical(receipt))
    # Avoid duplicating thousands of source paths into device metadata.
    (metadata / "source.json").write_bytes(canonical({
        "schema": 1, "local_inputs_sha256": source["local_inputs_sha256"],
        "local_source_archive_sha256": receipt["local_source_archive_sha256"],
        "release_source_requirements": SPEC["release_source_requirements"],
        "complete_corresponding_source": False}))
    notices = metadata / "licenses"
    notices.mkdir()
    for name in SPEC["notice_files"]:
        path = notices / name
        path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, path)
    if sha(binary) != receipt["elf"]["sha256"]:
        fail("Staged binary checksum mismatch")
    assert_sources(source)
    if evidence is not None:
        evidence.mkdir(parents=True, exist_ok=True)
        for suffix in linker.SUFFIXES:
            shutil.copyfile(linker.sidecar(args.bundle / SPEC["package"], suffix),
                            linker.sidecar(evidence / SPEC["package"], suffix))
        linker.check_evidence(binary, evidence / SPEC["package"])
    print(json.dumps({"binary": str(binary), "sha256": sha(binary), "device_executed": False}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    inspect = commands.add_parser("inspect", help="Check an existing ELF without claiming source provenance")
    inspect.add_argument("--binary", type=Path, required=True)
    inspect.add_argument("--readelf", type=Path, required=True)
    compile_command = commands.add_parser("build", help="Build and create checksum-bound local source evidence")
    compile_command.add_argument("--sdk", type=Path, required=True)
    compile_command.add_argument("--sdk-archive", type=Path, required=True)
    compile_command.add_argument("--libclang", type=Path)
    compile_command.add_argument("--target-dir", type=Path, required=True)
    compile_command.add_argument("--output", type=Path, required=True)
    compile_command.add_argument("--jobs", type=int, default=2)
    install = commands.add_parser("stage", help="Stage a verified bundle in a fresh IPK application directory")
    install.add_argument("--bundle", type=Path, required=True)
    install.add_argument("--readelf", type=Path, required=True)
    install.add_argument("--destination", type=Path, required=True)
    install.add_argument("--link-evidence", type=Path,
                         help="Private collector directory outside the staged application (for example pkg/link-evidence/stable)")
    args = parser.parse_args()
    try:
        if args.command == "build":
            build(args)
        elif args.command == "stage":
            stage(args)
        else:
            print(json.dumps(inspect_elf(args.binary, elf_report(args.binary, args.readelf)), indent=2))
    except (ValueError, TypeError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, "Companion verification failed: " + str(error) + "\n")


if __name__ == "__main__":
    main()
