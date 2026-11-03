#!/usr/bin/env python3
"""Link with the webOS SDK and retain real, byte-bound final-link evidence.

This driver is intentionally project-local. It does not edit the SDK or invent
an input trace from an ELF or map. GCC/ld emits the trace during the actual link.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

SUFFIXES = (".link.map", ".link.trace", ".link.json")
FORBIDDEN = re.compile(rb"libglibc[_-]polyfills(?:\.a)?|_getauxval_polyfill|glibc_polyfills_init", re.IGNORECASE)


def check_embedded_paths(binary):
    """Refuse host user paths in shipped ELF bytes, including macro strings."""
    tail = b""
    with Path(binary).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            data = tail + block
            if b"/Users" in data or b"/home" in data:
                raise ValueError("Companion ELF contains private host paths; rebuild with compiler path remapping")
            tail = data[-5:]


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def compiler_digests(compiler):
    """Bind the SDK's dispatch wrapper and the backend selected by its basename."""
    compiler = Path(compiler).absolute()
    paths = {"compiler_sha256": compiler,
             "compiler_backend_sha256": compiler.with_name(compiler.name + ".br_real")}
    digests = {}
    for key, path in paths.items():
        target = path.resolve(strict=True)
        if not target.is_file():
            raise ValueError("SDK compiler or backend is not a regular file")
        before = target.stat()
        digests[key] = sha(target)
        after = target.stat()
        if (before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_ino, after.st_size, after.st_mtime_ns):
            raise ValueError("SDK compiler or backend changed during digest capture")
    return digests


def sidecar(base, suffix):
    return Path(str(base) + suffix)


def check_inputs(link_map, trace):
    if not link_map.strip() or not trace.strip():
        raise ValueError("Missing linker map or actual input trace")
    if FORBIDDEN.search(link_map) or FORBIDDEN.search(trace):
        raise ValueError("Forbidden glibc-polyfills archive or member in final link")
    if b"LOAD " not in link_map:
        raise ValueError("Not a GNU linker input map")


def archive_paths(link_map, trace, build_root, reject_symlinks=False):
    """Extract actual archive inputs, including rustc's temporary rewritten rlibs."""
    names = set()
    for data, is_map in ((link_map, True), (trace, False)):
        for raw in data.decode("utf-8", errors="strict").splitlines():
            line = raw.strip()
            if is_map and line.startswith("LOAD "):
                name = line[5:].strip()
                if name.endswith((".a", ".rlib")):
                    names.add(name)
            elif not is_map and line.endswith((".a", ".rlib")):
                names.add(line)
            if not is_map:
                member = re.fullmatch(r"\((.+\.(?:a|rlib))\).+", line)
                if member:
                    names.add(member[1])
            # Archive-member lines in the map can have section addresses before
            # the absolute filename. LOAD/trace also cover relative filenames.
            names.update(re.findall(r"(?<!\S)(/[^\n]*?\.(?:a|rlib))\([^()\n]*\)", line))
    paths = set()
    for name in names:
        path = Path(name)
        if not path.is_absolute():
            path = Path(build_root) / path
        if reject_symlinks and any(part.is_symlink() for part in (path, *path.parents)):
            raise ValueError("Symlink in archive input: " + str(path))
        # resolve(strict=False) retains vanished rustc temporary names for later
        # map-to-inventory comparison while normalizing SDK /bin/../lib paths.
        paths.add(str(path.resolve()))
    return sorted(paths)


def ephemeral_archive(path, build_target):
    try:
        relative = Path(path).relative_to(build_target).as_posix()
    except ValueError:
        return False
    return Path(path).suffix == ".rlib" and re.search(r"(?:^|/)deps/rustc[^/]+/", relative) is not None


def capture_archives(link_map, trace, build_root, build_target):
    rows = []
    for name in archive_paths(link_map, trace, build_root, reject_symlinks=True):
        path = Path(name)
        if path.is_symlink() or not path.is_file():
            raise ValueError("Link input is not a regular archive: " + name)
        before = path.stat()
        digest = sha(path)
        after = path.stat()
        if (before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_ino, after.st_size, after.st_mtime_ns):
            raise ValueError("Archive changed during link evidence capture: " + name)
        rows.append({"path": name, "sha256": digest, "bytes": after.st_size,
                     "observed_at_link": True,
                     "validation": "link_time_only_ephemeral" if ephemeral_archive(path, build_target) else "link_time_and_current"})
    return rows


def check_archive_inventory(record, link_map, trace):
    for key in ("build_root", "build_target", "rust_sysroot"):
        path = record.get(key)
        if not isinstance(path, str) or not Path(path).is_absolute() or Path(path) == Path("/"):
            raise ValueError("Invalid private build root in link evidence")
    rows = record.get("archive_inputs")
    if not isinstance(rows, list):
        raise TypeError("Missing or invalid link-time archive inventory")
    names = []
    for row in rows:
        if (not isinstance(row, dict) or set(row) != {"path", "sha256", "bytes", "observed_at_link", "validation"}
                or not isinstance(row["path"], str) or not Path(row["path"]).is_absolute()
                or not re.fullmatch(r"[a-f0-9]{64}", row["sha256"])
                or type(row["bytes"]) is not int or row["bytes"] <= 0 or row["observed_at_link"] is not True):
            raise ValueError("Invalid link-time archive record")
        temporary = ephemeral_archive(row["path"], record["build_target"])
        if row["validation"] != ("link_time_only_ephemeral" if temporary else "link_time_and_current"):
            raise ValueError("Invalid archive validation scope")
        path = Path(row["path"])
        if (not temporary or path.exists()) and (path.is_symlink() or not path.is_file()
                or path.stat().st_size != row["bytes"] or sha(path) != row["sha256"]):
            raise ValueError("Persistent archive missing or changed: " + row["path"])
        names.append(row["path"])
    if len(set(names)) != len(names) or sorted(names) != archive_paths(link_map, trace, record["build_root"]):
        raise ValueError("Archive inventory differs from observed linker inputs")


def check_evidence(binary, base=None, compiler=None):
    binary = Path(binary)
    base = Path(base) if base is not None else binary
    link_map, trace = (sidecar(base, suffix).read_bytes() for suffix in SUFFIXES[:2])
    record = json.loads(sidecar(base, SUFFIXES[2]).read_text())
    check_inputs(link_map, trace)
    check_archive_inventory(record, link_map, trace)
    with binary.open("rb") as stream:
        if stream.read(4) != b"\x7fELF":
            raise ValueError("Link output is not ELF")
    if record.get("schema") != 1 or record.get("archive_excluded") is not True:
        raise ValueError("Missing verified archive exclusion")
    for name, digest in (("elf_sha256", sha(binary)),
                         ("map_sha256", hashlib.sha256(link_map).hexdigest()),
                         ("trace_sha256", hashlib.sha256(trace).hexdigest())):
        if record.get(name) != digest:
            raise ValueError("Link evidence changed: " + name)
    for key in ("compiler_sha256", "compiler_backend_sha256"):
        if not re.fullmatch(r"[a-f0-9]{64}", record.get(key, "")):
            raise ValueError("Missing compiler digest: " + key)
    if compiler is not None:
        for key, value in compiler_digests(compiler).items():
            if record[key] != value:
                raise ValueError("Link evidence uses a different compiler: " + key)
    return record


def stage_evidence(binary, destination=None, compiler=None):
    """Find cargo's internal final link by content, then preserve its real sidecars.

    Cargo copies the linked executable out of deps/ (and some build-std layouts
    use build/.../out), so its public filename need not have adjacent sidecars.
    A same-name stale receipt is insufficient: every candidate is byte-checked.
    """
    binary = Path(binary).resolve(strict=True)
    destination = Path(destination) if destination is not None else binary
    root = binary.parent
    while root.name not in ("release", "debug", "tvdev") and root.parent != root:
        root = root.parent
    if root.name not in ("release", "debug", "tvdev"):
        root = binary.parent
    stem = binary.name.replace("-", "_")
    candidates = [binary]
    for name in sorted({stem, binary.name}):
        candidates.extend(Path(str(path)[:-len(SUFFIXES[2])]) for pattern in
                          (name + SUFFIXES[2], name + "-*" + SUFFIXES[2])
                          for path in sorted(root.glob("**/" + pattern)))
    digest = sha(binary)
    for candidate in dict.fromkeys(candidates):
        try:
            record = check_evidence(candidate, compiler=compiler)
        except (OSError, ValueError, TypeError):
            continue
        if record["elf_sha256"] != digest:
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        for suffix in SUFFIXES:
            source, target = sidecar(candidate, suffix), sidecar(destination, suffix)
            if source.resolve() != target.resolve():
                shutil.copyfile(source, target)
        return check_evidence(binary, destination, compiler)
    raise ValueError("No matching real linker evidence; relink ottplay-companion with webos_link.py")


def expanded_args(args, depth=0):
    if depth > 8:
        raise ValueError("Nested linker response files exceed limit")
    result = []
    for value in args:
        if value.startswith("@"):
            data = Path(value[1:]).read_bytes()
            if len(data) > 16 * 1024 * 1024:
                raise ValueError("Linker response file exceeds limit")
            result.extend(expanded_args(shlex.split(data.decode()), depth + 1))
        else:
            result.append(value)
    return result


def link_output(args):
    expanded = expanded_args(args)
    if any(flag in expanded for flag in ("-c", "-S", "-E")):
        return None
    outputs = []
    index = 0
    while index < len(expanded):
        value = expanded[index]
        if value == "-o":
            index += 1
            if index == len(expanded):
                raise ValueError("Link output argument is missing")
            outputs.append(expanded[index])
        elif value.startswith("-o") and len(value) > 2:
            outputs.append(value[2:])
        index += 1
    if len(outputs) > 1:
        raise ValueError("Ambiguous link output")
    return Path(outputs[0]).absolute() if outputs else None


def main(args=None):
    args = sys.argv[1:] if args is None else args
    # The SDK's gcc is a symlink to a multicall wrapper which chooses its
    # .br_real executable from argv[0]. Preserve the gcc basename for execution;
    # resolve only for validation and the exact executable byte hash.
    real = Path(os.environ["OTT_COMPANION_CC"]).absolute()
    compiler_file = real.resolve(strict=True)
    if not compiler_file.is_file():
        raise ValueError("SDK compiler is not a regular file")
    output = link_output(args)
    if output is None:
        return subprocess.call([str(real), *args])
    output = output.resolve()
    build_root = Path(os.environ["OTT_COMPANION_BUILD_ROOT"]).resolve(strict=True)
    build_target = Path(os.environ["OTT_COMPANION_BUILD_TARGET"]).resolve(strict=True)
    rust_sysroot = Path(os.environ["OTT_COMPANION_RUST_SYSROOT"]).resolve(strict=True)
    if build_root == Path("/") or build_target == Path("/") or not output.is_relative_to(build_target):
        raise ValueError("Link output is outside the explicit build target")
    for suffix in SUFFIXES:
        sidecar(output, suffix).unlink(missing_ok=True)
    compiler_before = compiler_digests(real)
    # Separate -Xlinker arguments preserve spaces and commas in the output path.
    command = [str(real), *args, "-tno-glibc-polyfill", "-Xlinker", "-Map",
               "-Xlinker", str(sidecar(output, SUFFIXES[0])), "-Xlinker", "--cref",
               "-Xlinker", "-t"]
    result = subprocess.run(command, capture_output=True, check=False)
    sys.stdout.buffer.write(result.stdout)
    sys.stderr.buffer.write(result.stderr)
    sidecar(output, SUFFIXES[1]).write_bytes(result.stdout + result.stderr)
    if result.returncode:
        return result.returncode
    if compiler_digests(real) != compiler_before:
        raise ValueError("SDK compiler or backend changed during final link")
    link_map, trace = (sidecar(output, suffix).read_bytes() for suffix in SUFFIXES[:2])
    check_inputs(link_map, trace)
    archives = capture_archives(link_map, trace, build_root, build_target)
    with output.open("rb") as stream:
        if stream.read(4) != b"\x7fELF":
            raise ValueError("Link output is not ELF")
    record = {"schema": 1, "elf_sha256": sha(output),
              "map_sha256": sha(sidecar(output, SUFFIXES[0])),
              "trace_sha256": sha(sidecar(output, SUFFIXES[1])),
              **compiler_before, "archive_excluded": True,
              "build_root": str(build_root), "build_target": str(build_target),
              "rust_sysroot": str(rust_sysroot),
              "archive_inputs": archives, "archive_inputs_capture": "during-final-link"}
    sidecar(output, SUFFIXES[2]).write_text(json.dumps(record, indent=2, sort_keys=True) + "\n")
    check_evidence(output, compiler=real)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, TypeError, KeyError) as error:
        print("webos-link: " + str(error), file=sys.stderr)
        sys.exit(1)
