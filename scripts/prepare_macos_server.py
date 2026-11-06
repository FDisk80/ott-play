#!/usr/bin/env python3
"""Prepare an independently accepted beta/RC server; never install or run it.

The two expected receipt/inventory digests are external trust inputs. This is
not a release verifier. Its static host checks do not prove runtime health.
"""
import argparse
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import stat
import struct
import subprocess

import macos_server_artifact


STEM = "ottplay-server_aarch64-apple-darwin"
TRIO = (STEM, STEM + ".dependencies.txt", STEM + ".build.json")
TARGET = "aarch64-apple-darwin"
PRODUCER = "release-inputs-desktop-macos-latest-aarch64-apple-darwin.json"
IMPLEMENTATION = {"verify_release.py", "candidate_pipeline.py", "transport.py",
                  "audited_beta_base.py", "pinned_helpers/__init__.py",
                  "macos_server_artifact.py"}
HEX = re.compile(r"[0-9a-f]{64}\Z")
COMMIT = re.compile(r"[0-9a-f]{40}\Z")
VERSION = re.compile(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)-(beta|rc)\.[1-9][0-9]*\Z")
MAX_BINARY = 512 * 1024**2


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def positive(value):
    return type(value) is int and value > 0


def sha(value):
    return isinstance(value, str) and HEX.fullmatch(value) is not None


def regular(path):
    path = Path(path)
    require(path.is_absolute() and path.resolve(strict=True) == path,
            "Input must have an absolute canonical path")
    require(stat.S_ISREG(path.lstat().st_mode), "Input must be a regular non-symlink file")
    return path


@contextmanager
def open_regular(path):
    path = regular(path)
    before = path.lstat()
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        opened = os.fstat(descriptor)
        def identity(item):
            return (item.st_dev, item.st_ino, item.st_mode, item.st_size,
                    item.st_mtime_ns, item.st_ctime_ns)
        require(stat.S_ISREG(opened.st_mode) and identity(opened) == identity(before),
                "Input changed while opening")
        stream = os.fdopen(descriptor, "rb")
        descriptor = None  # The stream now owns it, including on read failure.
        with stream:
            yield stream
            require(identity(opened) == identity(os.fstat(stream.fileno()))
                    == identity(path.lstat()), "Input changed while reading")
    finally:
        if descriptor is not None:
            os.close(descriptor)


def read(path, limit):
    with open_regular(path) as stream:
        raw = stream.read(limit + 1)
    require(len(raw) <= limit, "Input exceeds size bound")
    return raw


def parse(raw):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, "Duplicate JSON member")
            result[key] = value
        return result
    value = json.loads(raw, object_pairs_hook=unique,
                       parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Non-finite JSON")))
    require(isinstance(value, dict), "JSON object required")
    return value


def file_identity(path, limit=MAX_BINARY):
    count, h = 0, hashlib.sha256()
    with open_regular(path) as stream:
        while block := stream.read(1024 * 1024):
            count += len(block)
            require(count <= limit, "File exceeds size bound")
            h.update(block)
    return {"bytes": count, "sha256": h.hexdigest()}


def accepted(args):
    require(COMMIT.fullmatch(args.source or "") and COMMIT.fullmatch(args.tree or ""),
            "Exact source and tree required")
    version = VERSION.fullmatch(args.version or "")
    require(version, "Only explicit beta/RC versions are supported")
    require(sha(args.acceptance_sha256) and sha(args.implementation_sha256), "Expected digests required")
    raw = read(args.acceptance, 2 * 1024**2)
    pins_raw = read(args.implementation, 65536)
    require(digest(raw) == args.acceptance_sha256, "Acceptance SHA mismatch")
    require(digest(pins_raw) == args.implementation_sha256, "Implementation inventory SHA mismatch")
    receipt, pins = parse(raw), parse(pins_raw)
    require(set(pins) == IMPLEMENTATION and all(sha(v) for v in pins.values()),
            "Reviewed full-verifier inventory required")
    require(digest(read(Path(macos_server_artifact.__file__).resolve(), 1024**2)) == pins["macos_server_artifact.py"],
            "Shared artifact validator differs from reviewed verifier")
    require(receipt.get("status") == "PASS_RELEASE_ARTIFACTS" and receipt.get("releaseAccepted") is True
            and receipt.get("sampleOnly") is False
            and receipt.get("scope") == "published artifacts, not installation"
            and receipt.get("repository") == "open-ott-play/ottplay-foss",
            "Full published-release acceptance required")
    require(receipt.get("implementationSha256") == pins
            and receipt.get("verifierSha256") == pins["verify_release.py"], "Verifier implementation mismatch")
    require(receipt.get("channel") == version.group(1) and receipt.get("tag") == "v" + args.version
            and "stable" not in receipt and receipt.get("mergeSha") == args.source
            and receipt.get("peeledTagSha") == args.source and receipt.get("mergedTree") == args.tree,
            "Accepted release source/version differs")
    for key in ("manifestSha256", "planSha256", "sourcePolicySha256", "configSha256", "evidenceArchiveSha256"):
        require(sha(receipt.get(key)), "Missing full acceptance digest: " + key)
    for key in ("runId", "runAttempt", "releaseId", "evidenceArtifactId", "assetCount",
                "payloadCount", "producerReceipts", "independentlyRehashedBytes"):
        require(positive(receipt.get(key)), "Missing full acceptance count: " + key)
    groups = receipt.get("payloadRehashes")
    require(isinstance(groups, list) and len(groups) == 1 and isinstance(groups[0], list)
            and len(groups[0]) == receipt["assetCount"] and 0 < len(groups[0]) <= 128,
            "One complete accepted payload set required")
    rows, ids, folded, total = {}, set(), set(), 0
    for row in groups[0]:
        require(isinstance(row, dict) and set(row) == {"name", "id", "bytes", "sha256", "method"},
                "Invalid accepted payload record")
        name = row["name"]
        require(isinstance(name, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._+-]{0,199}", name)
                and name.casefold() not in folded and positive(row["id"]) and row["id"] not in ids
                and positive(row["bytes"]) and row["bytes"] <= MAX_BINARY and sha(row["sha256"])
                and row["method"] in ("independent-stream-rehash", "independent-downloaded-metadata-rehash"),
                "Invalid or duplicate accepted payload")
        rows[name] = row
        folded.add(name.casefold())
        ids.add(row["id"])
        total += row["bytes"]
    producer_count = sum(n.startswith("release-inputs-") and n.endswith(".json") for n in rows)
    require(total == receipt["independentlyRehashedBytes"] and total <= 2 * 1024**3
            and producer_count == receipt["producerReceipts"]
            and receipt["payloadCount"] + producer_count + 1 == len(rows), "Incomplete acceptance counts")
    require("release-manifest.json" in rows and rows["release-manifest.json"]["sha256"] == receipt["manifestSha256"],
            "Accepted manifest payload missing")
    section = receipt.get("macosServer")
    fields = {"schema", "source", "tree", "target", "packageVersion", "planSha256", "planDigest",
              "runId", "runAttempt", "producerReceipt", "files"}
    require(isinstance(section, dict) and set(section) == fields and type(section["schema"]) is int
            and section["schema"] == 1, "Server acceptance section required")
    # The pinned full verifier validates the source policy's projection. RC
    # promote-bytes embeds the base version; a final-build policy can embed RC.
    # The installer identity below still identifies the requested release tag.
    package_version = section["packageVersion"]
    allowed_versions = {args.version}
    if version.group(1) == "rc":
        allowed_versions.add(args.version.rsplit("-rc.", 1)[0])
    require(isinstance(package_version, str) and package_version in allowed_versions,
            "Accepted package version contradicts requested release")
    expected = {"source": args.source, "tree": args.tree, "target": TARGET,
                "packageVersion": package_version, "planDigest": receipt["planSha256"],
                "runId": receipt["runId"], "runAttempt": receipt["runAttempt"]}
    require(all(section.get(k) == v for k, v in expected.items()), "Server acceptance identity mismatch")
    plan = receipt.get("planArtifact")
    require(isinstance(plan, dict) and positive(plan.get("id")) and sha(plan.get("sha256"))
            and positive(plan.get("memberBytes")) and plan["memberBytes"] <= 100000
            and sha(plan.get("rawPlanSha256")) and plan.get("canonicalPlanDigest") == receipt["planSha256"]
            and section["planSha256"] == plan["rawPlanSha256"], "Raw/canonical plan binding mismatch")
    producer = section["producerReceipt"]
    require(isinstance(producer, dict) and set(producer) == {"name", "sha256"}
            and producer.get("name") == PRODUCER and PRODUCER in rows
            and producer.get("sha256") == rows[PRODUCER]["sha256"], "Server producer receipt mismatch")
    require(isinstance(section["files"], dict) and set(section["files"]) == set(TRIO), "Exact server trio required")
    for name in TRIO:
        require(name in rows and section["files"][name] == {k: rows[name][k] for k in ("id", "bytes", "sha256")},
                "Server file not bound to complete acceptance")
    expected["planSha256"] = section["planSha256"]
    return receipt, expected, raw, pins_raw


def macho_requirements(binary):
    with open_regular(binary) as stream:
        header = stream.read(32)
        require(len(header) == 32, "Truncated Mach-O header")
        magic, cpu, _, kind, count, size, _, _ = struct.unpack("<8I", header)
        require(magic == 0xFEEDFACF and cpu == 0x0100000C and kind == 2,
                "Thin ARM64 Mach-O executable required")
        require(0 < count <= 65536 and 0 < size <= 8 * 1024**2, "Invalid load-command bounds")
        commands = stream.read(size)
    require(len(commands) == size, "Truncated Mach-O commands")
    offset, minimums, dependencies = 0, [], []
    signed = False
    for _ in range(count):
        require(offset + 8 <= size, "Truncated load command")
        command, length = struct.unpack_from("<II", commands, offset)
        require(length >= 8 and length % 8 == 0 and offset + length <= size, "Invalid load command")
        data = commands[offset:offset + length]
        if command == 0x32:  # LC_BUILD_VERSION
            require(length >= 24, "Invalid build version")
            platform_id, minimum, _, tools = struct.unpack_from("<4I", data, 8)
            require(platform_id == 1 and length == 24 + 8 * tools, "macOS build version required")
            minimums.append(minimum)
        elif command == 0x24:  # LC_VERSION_MIN_MACOSX
            require(length == 16, "Invalid minimum macOS command")
            minimums.append(struct.unpack_from("<I", data, 8)[0])
        elif command in (0xC, 0x80000018, 0x8000001F, 0x80000023, 0x20):
            require(length >= 24, "Invalid dylib command")
            start = struct.unpack_from("<I", data, 8)[0]
            require(24 <= start < length and b"\0" in data[start:], "Invalid dylib name")
            name = data[start:].split(b"\0", 1)[0].decode("utf-8", errors="strict")
            require(name.startswith(("/usr/lib/", "/System/Library/Frameworks/", "/System/Library/PrivateFrameworks/"))
                    and ".." not in Path(name).parts and str(Path(name)) == name,
                    "Non-system or relative dependency unsupported")
            dependencies.append(name)
        elif command == 0x8000001C:
            raise ValueError("Rpath dependencies unsupported for standalone server")
        elif command == 0x27:
            raise ValueError("Embedded dyld environment unsupported")
        elif command == 0xE:  # LC_LOAD_DYLINKER
            require(length >= 16, "Invalid dynamic-linker command")
            start = struct.unpack_from("<I", data, 8)[0]
            require(12 <= start < length and b"\0" in data[start:]
                    and data[start:].split(b"\0", 1)[0] == b"/usr/lib/dyld",
                    "Unexpected dynamic linker")
        elif command == 0x1D:
            require(length == 16, "Invalid code-signature command")
            signed = True
        offset += length
    require(offset == size and minimums and len(set(minimums)) == 1 and minimums[0] > 0
            and dependencies and signed, "Missing macOS/dependency/signature metadata")
    minimum = minimums[0]
    return (minimum >> 16, (minimum >> 8) & 255, minimum & 255), sorted(set(dependencies))


def in_shared_cache(name):
    # A path may exist only in the macOS dyld shared cache. Never dlopen it.
    from _ctypes import _dyld_shared_cache_contains_path
    return _dyld_shared_cache_contains_path(name)


def host_checks(binary):
    require(platform.system() == "Darwin" and platform.machine() == "arm64", "Native macOS ARM64 host required")
    minimum, dependencies = macho_requirements(binary)
    text = platform.mac_ver()[0]
    require(re.fullmatch(r"\d+\.\d+(?:\.\d+)?", text), "Cannot determine host macOS version")
    version = tuple(int(x) for x in text.split("."))
    version = version + (0,) * (3 - len(version))
    require(version >= minimum, "Host macOS is below binary minimum")
    for name in dependencies:
        require(Path(name).is_file() or in_shared_cache(name), "System dependency unavailable")
    # Discard output instead of buffering potentially unbounded diagnostics.
    result = subprocess.run(["/usr/bin/codesign", "--verify", "--strict", str(binary)],
                            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            timeout=15, check=False, env={"PATH": "/usr/bin:/bin"})
    require(result.returncode == 0, "Code signature verification failed")
    return {"signature": "verified; ad-hoc permitted", "minimumMacOS": list(minimum),
            "hostMacOS": list(version), "systemDependencies": dependencies,
            "compatibility": "static system-install-name and minimum-OS checks only", "serverExecuted": False}


def write_new(path, raw, owned, mode=0o600):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    owned.append(path)  # Exclusive creation succeeded; track before any write.
    try:
        stream = os.fdopen(descriptor, "wb")
    except BaseException:
        os.close(descriptor)
        raise
    with stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())


def encoded(value):
    return (json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + "\n").encode()


def prepare(args):
    directory, output = Path(args.artifacts), Path(args.output)
    require(directory.is_absolute() and directory.resolve(strict=True) == directory and directory.is_dir(),
            "Canonical artifact directory required")
    require(output.is_absolute() and output.parent.resolve(strict=True) == output.parent
            and not output.exists() and not output.is_symlink(), "Fresh output directory required")
    require(output != directory and directory not in output.parents and output not in directory.parents,
            "Output must not overlap artifact directory")
    receipt, expected, raw, pins_raw = accepted(args)
    macos_server_artifact.validate_artifact_set(directory, expected)
    files = receipt["macosServer"]["files"]
    for name in TRIO:
        require(file_identity(directory / name) == {k: files[name][k] for k in ("bytes", "sha256")},
                "Retained artifact differs from acceptance")
    output.mkdir(mode=0o700)
    owned = []
    try:
        binary = output / "ottplay-server"
        descriptor = os.open(binary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o700)
        owned.append(binary)
        count, h = 0, hashlib.sha256()
        with os.fdopen(descriptor, "wb") as target, open_regular(directory / STEM) as source:
            while block := source.read(1024 * 1024):
                count += len(block)
                require(count <= files[STEM]["bytes"], "Candidate grew during preparation")
                target.write(block)
                h.update(block)
            target.flush()
            os.fchmod(target.fileno(), 0o755)
            os.fsync(target.fileno())
        require(count == files[STEM]["bytes"] and h.hexdigest() == files[STEM]["sha256"]
                and file_identity(binary) == {"bytes": count, "sha256": h.hexdigest()}
                and stat.S_IMODE(binary.stat().st_mode) == 0o755, "Prepared binary differs")
        # Inspect the exact executable candidate, not its downloaded predecessor.
        checks = host_checks(binary)
        require(file_identity(binary) == {"bytes": count, "sha256": h.hexdigest()}
                and stat.S_IMODE(binary.stat().st_mode) == 0o755,
                "Prepared binary changed during inspection")
        # Keep external trust inputs and retained payloads bound after inspection.
        require(read(args.acceptance, 2 * 1024**2) == raw and read(args.implementation, 65536) == pins_raw,
                "Acceptance inputs changed")
        macos_server_artifact.validate_artifact_set(directory, expected)
        for name in TRIO:
            require(file_identity(directory / name) == {k: files[name][k] for k in ("bytes", "sha256")},
                    "Retained artifact changed during inspection")
        identity = {"schema": 1, "source": args.source, "version": args.version, "target": TARGET,
                    "provenance": "official-release", "binary_sha256": h.hexdigest()}
        identity_raw = encoded(identity)
        evidence = {"schema": 1, "status": "PREPARED_ACCEPTED_SERVER", "installed": False,
                    "acceptanceSha256": digest(raw), "implementationInventorySha256": digest(pins_raw),
                    "implementationSha256": receipt["implementationSha256"],
                    "identitySha256": digest(identity_raw), "macosServer": receipt["macosServer"],
                    "binary": {"name": binary.name, "bytes": count, "sha256": h.hexdigest(), "mode": "0755"},
                    "staticChecks": checks, "runtimeHealth": "NOT_RUN; delegated to existing installer",
                    "downgradePolicy": "explicit caller-selected beta/RC; no installed-version comparison"}
        for name, data in (("identity.json", identity_raw), ("acceptance.json", raw),
                           ("implementation.json", pins_raw), ("preparation.json", encoded(evidence))):
            path = output / name
            write_new(path, data, owned)
        return evidence
    except BaseException:
        for path in reversed(owned):
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass
        try:
            output.rmdir()
        except OSError:
            pass  # Leave unknown/partial files; never recursively remove them.
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("artifacts", "acceptance", "implementation", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    for name in ("acceptance-sha256", "implementation-sha256", "source", "tree", "version"):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    os.umask(0o077)
    try:
        print(json.dumps(prepare(args), allow_nan=False))
    except (ValueError, OSError, subprocess.SubprocessError, ImportError, NotImplementedError) as error:
        parser.exit(1, "Server preparation refused: " + str(error) + "\n")


if __name__ == "__main__":
    main()
