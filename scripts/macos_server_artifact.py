#!/usr/bin/env python3
"""Create and inspect the source-bound macOS ARM64 server delivery files.

Importing this module performs no I/O and requires only the standard library.
Validation proves file identity and the declared Mach-O format, not execution,
code signing, dependency availability, or permission to install the server.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import struct
import subprocess


TARGET = "aarch64-apple-darwin"
BINARY_NAME = "ottplay-server_" + TARGET
DEPENDENCIES_NAME = BINARY_NAME + ".dependencies.txt"
RECORD_NAME = BINARY_NAME + ".build.json"
ARTIFACT_NAMES = frozenset((BINARY_NAME, DEPENDENCIES_NAME, RECORD_NAME))
MAX_BINARY_BYTES = 512 * 1024 * 1024
MAX_DEPENDENCIES_BYTES = 1024 * 1024
MAX_RECORD_BYTES = 64 * 1024
MAX_LOAD_COMMAND_BYTES = 1024 * 1024
EXPECTED_KEYS = frozenset((
    "source", "tree", "target", "packageVersion", "planSha256", "planDigest",
    "runId", "runAttempt",
))
BUILD = {
    "package": "ottplay-server", "profile": "release",
    "features": "package defaults", "jobs": 1, "incremental": False,
}


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def _object(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        _require(key not in result, "Duplicate JSON field")
        result[key] = value
    return result


def _json(raw: bytes) -> dict:
    value = json.loads(raw, object_pairs_hook=_object)
    _require(type(value) is dict, "JSON record must be an object")
    return value


def _expected(value: dict) -> None:
    _require(type(value) is dict and set(value) == EXPECTED_KEYS,
             "Expected artifact identity fields differ")
    for key, length in (("source", 40), ("tree", 40), ("planSha256", 64), ("planDigest", 64)):
        _require(type(value[key]) is str and re.fullmatch(r"[0-9a-f]{%d}" % length, value[key]) is not None,
                 "Invalid expected " + key)
    _require(value["target"] == TARGET, "Unexpected server target")
    _require(type(value["packageVersion"]) is str and re.fullmatch(
        r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?",
        value["packageVersion"],
    ) is not None, "Invalid package version")
    for key in ("runId", "runAttempt"):
        _require(type(value[key]) is int and value[key] > 0, "Invalid expected " + key)


def _read(path: Path, limit: int, prefix_limit: int) -> tuple[dict, bytes]:
    """Hash a bounded regular file, keeping only the requested prefix in memory."""
    before = path.lstat()
    _require(stat.S_ISREG(before.st_mode), "Artifact must be a regular non-symlink file")
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0))
    with os.fdopen(descriptor, "rb") as stream:
        opened = os.fstat(stream.fileno())
        _require(stat.S_ISREG(opened.st_mode)
                 and (opened.st_dev, opened.st_ino) == (before.st_dev, before.st_ino),
                 "Artifact changed while opening")
        _require(0 < opened.st_size <= limit, "Artifact size is outside its bound")
        digest = hashlib.sha256()
        size = 0
        prefix = bytearray()
        while True:
            chunk = stream.read(min(1024 * 1024, limit + 1 - size))
            if not chunk:
                break
            size += len(chunk)
            _require(size <= limit, "Artifact grew beyond its bound")
            digest.update(chunk)
            prefix.extend(chunk[:max(0, prefix_limit - len(prefix))])
        after = os.fstat(stream.fileno())
        def fields(item):
            return (item.st_dev, item.st_ino, item.st_size, item.st_mtime_ns, item.st_ctime_ns)
        _require(size == opened.st_size and fields(opened) == fields(after)
                 and fields(after) == fields(path.lstat()), "Artifact changed while reading")
    return {"name": path.name, "size": size, "sha256": digest.hexdigest()}, bytes(prefix)


def _mach_o(header: bytes, size: int) -> None:
    _require(len(header) >= 32, "Truncated Mach-O header")
    magic, cpu, _subtype, kind, commands, command_bytes, _flags, reserved = struct.unpack("<8I", header[:32])
    _require(magic == 0xFEEDFACF and cpu == 0x0100000C and kind == 2 and reserved == 0,
             "Server must be thin little-endian ARM64 Mach-O MH_EXECUTE")
    _require(0 < commands <= 65535 and 8 * commands <= command_bytes <= MAX_LOAD_COMMAND_BYTES
             and 32 + command_bytes <= size and 32 + command_bytes <= len(header),
             "Invalid Mach-O load-command extent")
    offset = 32
    for _ in range(commands):
        _require(offset + 8 <= 32 + command_bytes, "Truncated Mach-O load command")
        _command, length = struct.unpack("<2I", header[offset:offset + 8])
        _require(length >= 8 and length % 8 == 0 and offset + length <= 32 + command_bytes,
                 "Invalid Mach-O load-command length")
        offset += length
    _require(offset == 32 + command_bytes, "Mach-O load-command count differs")


def _directory(directory: Path) -> Path:
    directory = Path(os.path.abspath(directory))
    _require(directory.resolve(strict=True) == directory and directory.is_dir(),
             "Artifact directory must not contain symlink aliases")
    related = {entry.name for entry in directory.iterdir()
               if entry.name.casefold().startswith(BINARY_NAME.casefold())}
    _require(related == ARTIFACT_NAMES, "Server artifact trio is missing or ambiguous")
    return directory


def validate_artifact_set(directory: Path, expected: dict) -> dict:
    """Validate the exact trio against independently authenticated producer facts.

    ``expected`` contains exactly EXPECTED_KEYS. planSha256 hashes the original
    plan bytes; planDigest is the official canonical plan digest. A promoted
    release must supply the original producer's facts, not its promotion run.
    Unrelated release payloads may share the directory. Supply a canonical
    directory path: symlink aliases in the directory or its parents are refused.
    """
    _expected(expected)
    directory = _directory(Path(directory))
    _, raw = _read(directory / RECORD_NAME, MAX_RECORD_BYTES, MAX_RECORD_BYTES)
    record = _json(raw)
    _require(set(record) == EXPECTED_KEYS | {"schema", "kind", "releaseAccepted", "binary", "dependencies", "build"},
             "Server record fields differ")
    _require(type(record["schema"]) is int and record["schema"] == 1
             and record["kind"] == "macos-server-build" and record["releaseAccepted"] is False,
             "Invalid server record kind or acceptance status")
    _expected({key: record[key] for key in EXPECTED_KEYS})
    _require(all(record[key] == expected[key] for key in EXPECTED_KEYS),
             "Server record differs from authenticated producer identity")
    _require(record["build"] == BUILD and type(record["build"].get("jobs")) is int
             and record["build"].get("incremental") is False, "Unexpected server build declaration")
    binary, header = _read(directory / BINARY_NAME, MAX_BINARY_BYTES, 32 + MAX_LOAD_COMMAND_BYTES)
    dependencies, text = _read(directory / DEPENDENCIES_NAME, MAX_DEPENDENCIES_BYTES, MAX_DEPENDENCIES_BYTES)
    for key, actual in (("binary", binary), ("dependencies", dependencies)):
        declared = record[key]
        _require(type(declared) is dict and set(declared) == {"name", "size", "sha256"}
                 and type(declared["size"]) is int and declared == actual,
                 "Server " + key + " identity differs")
    _mach_o(header, binary["size"])
    listing = text.decode("utf-8")
    lines = listing.splitlines()
    _require("\0" not in listing and bool(lines) and lines[0] == BINARY_NAME + ":",
             "Dependency listing must identify the delivered server")
    return record


def _owned_path(root: Path, value: Path) -> Path:
    path = value if value.is_absolute() else root / value
    relative = path.relative_to(root)
    _require(".." not in relative.parts, "Producer path escapes checkout")
    current = root
    for part in relative.parts:
        current = current / part
        _require(not current.is_symlink(), "Producer path contains a symlink")
    path.resolve(strict=True).relative_to(root)
    return path


def _verify_tracked_source(root: Path, policy: dict, plan: dict, version_plan) -> None:
    # Release sync intentionally overlays version fields on HEAD. Permit only
    # that exact transformation, never arbitrary edits in those same files.
    _require((root / ".git").exists(), "Producer root must be a Git checkout")
    def git_diff(*arguments):
        return subprocess.check_output(["git", "diff", *arguments, "HEAD", "--"],
                                       cwd=root, timeout=30)
    _require(not git_diff("--cached", "--name-only", "-z"),
             "Producer source has staged changes")
    _require(not git_diff("--summary", "--no-renames"),
             "Producer source has file mode, type, creation or deletion changes")
    changed = set(git_diff("--name-only", "--no-renames", "-z").split(b"\0")) - {b""}
    declared = {os.fsencode(item["path"]) for item in policy["versioning"]["files"]}
    _require(changed <= declared, "Producer source has undeclared tracked changes")
    version_plan.verify_checkout(root, policy, plan)


def create_artifact_set(binary: Path, directory: Path, plan_path: Path) -> dict:
    """CLI producer only: capture actual checkout, plan, Actions and otool facts."""
    # Official version logic is deliberately not an import-time dependency.
    import version_plan

    root = Path(__file__).resolve().parents[1]
    binary = _owned_path(root, binary)
    directory = _owned_path(root, directory)
    plan_path = _owned_path(root, plan_path)
    _require(directory.is_dir(), "Producer output must be an existing directory")
    _require(not any(entry.name.casefold().startswith(BINARY_NAME.casefold()) for entry in directory.iterdir()),
             "Producer output already contains server artifacts")
    source = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True, timeout=30).strip()
    tree = subprocess.check_output(["git", "rev-parse", "HEAD^{tree}"], cwd=root, text=True, timeout=30).strip()
    _require(os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("GITHUB_SHA") == source,
             "Producer must run at the exact Actions source")
    _, plan_raw = _read(plan_path, MAX_RECORD_BYTES, MAX_RECORD_BYTES)
    plan = _json(plan_raw)
    policy = _json((root / ".release-policy.json").read_bytes())
    version_plan.validate_plan(plan, policy, source)
    version_plan.sync_versions(root, policy, plan, check=True)
    _verify_tracked_source(root, policy, plan, version_plan)
    expected = {
        "source": source, "tree": tree, "target": TARGET,
        "packageVersion": version_plan.projections(plan)["package"],
        "planSha256": hashlib.sha256(plan_raw).hexdigest(),
        "planDigest": version_plan.plan_digest(plan),
        "runId": int(os.environ["GITHUB_RUN_ID"]),
        "runAttempt": int(os.environ["GITHUB_RUN_ATTEMPT"]),
    }
    _expected(expected)
    original, header = _read(binary, MAX_BINARY_BYTES, 32 + MAX_LOAD_COMMAND_BYTES)
    _mach_o(header, original["size"])
    created = []
    try:
        target = directory / BINARY_NAME
        with target.open("xb") as output:
            created.append(target)
            with binary.open("rb") as source_file:
                remaining = MAX_BINARY_BYTES + 1
                while remaining:
                    chunk = source_file.read(min(1024 * 1024, remaining))
                    if not chunk:
                        break
                    output.write(chunk)
                    remaining -= len(chunk)
        target.chmod(0o755)
        copied, _ = _read(target, MAX_BINARY_BYTES, 0)
        _require(copied == {**original, "name": BINARY_NAME}, "Server changed while copying")
        dependencies_path = directory / DEPENDENCIES_NAME
        with dependencies_path.open("xb") as output:
            created.append(dependencies_path)
            subprocess.run(["otool", "-L", BINARY_NAME], cwd=directory, stdout=output, check=True, timeout=30)
        dependencies, _ = _read(dependencies_path, MAX_DEPENDENCIES_BYTES, 0)
        record = {
            "schema": 1, "kind": "macos-server-build", "releaseAccepted": False,
            **expected, "binary": copied, "dependencies": dependencies, "build": dict(BUILD),
        }
        record_path = directory / RECORD_NAME
        with record_path.open("x", encoding="utf-8") as output:
            created.append(record_path)
            json.dump(record, output, sort_keys=True, indent=2)
            output.write("\n")
        return validate_artifact_set(directory, expected)
    except BaseException:
        for path in reversed(created):
            path.unlink()
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("create",))
    parser.add_argument("--binary", type=Path, required=True)
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--plan", type=Path, default=Path(".release-plan.json"))
    args = parser.parse_args()
    create_artifact_set(args.binary, args.directory, args.plan)


if __name__ == "__main__":
    main()
