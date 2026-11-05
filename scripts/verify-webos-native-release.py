#!/usr/bin/env python3
"""Verify a downloaded native webOS release bundle without building or installing.

This checks the consistency of bytes and recorded evidence, not the authenticity
of the publisher, an independent rebuild, or playback on a television. Nested
archives may be spooled to bounded anonymous temporary files. Archive member
names never become filesystem output paths, and archive-supplied code is never
executed.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import importlib.util
import io
import ipaddress
import json
import lzma
import posixpath
import re
import sys
import tarfile
import tempfile
import zlib
from contextlib import ExitStack
from pathlib import Path, PurePosixPath
from urllib.parse import parse_qsl, unquote, urlsplit

import tomllib

ROOT = Path(__file__).resolve().parents[1]
BUILD_SPEC = importlib.util.spec_from_file_location("native_webos_build", ROOT / "native/webos/build.py")
build = importlib.util.module_from_spec(BUILD_SPEC)
BUILD_SPEC.loader.exec_module(build)

JSON_LIMIT = 8 * 1024 * 1024
IPK_LIMIT = 128 * 1024 * 1024
ARCHIVE_LIMIT = 2 * 1024 * 1024 * 1024
EXPANDED_LIMIT = 8 * 1024 * 1024 * 1024
MEMBER_LIMIT = 2 * 1024 * 1024 * 1024
FILE_COUNT_LIMIT = 100_000
XZ_MEMORY_LIMIT = 256 * 1024 * 1024
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
APP_ID = "com.openottplay.player.native"
PRIVATE_NAMES = {
    "ottplay-profile.json",
    "ottplay-control.json",
    "ottplay-native.json",
    "ott-control.json",
    "ott-state.json",
    "auth.json",
    "telemetry.local.json",
    "lab.json",
    "config.local.h",
    "session.json",
    "consent.json",
    "state.json",
    "rendezvous.json",
    "storage.sock",
}
INTEGRATION_FILES = {"build.py", "upstream.json", "README.md", "COPYING", "test_build.py"}
INTEGRATION_PREFIX = "ci/ottplay-integration/"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate JSON key")
        result[key] = value
    return result


def decode(data):
    require(len(data) <= JSON_LIMIT, "JSON document exceeds size limit")
    return json.loads(data, object_pairs_hook=unique_object)


def regular(path, limit):
    require(not path.is_symlink() and path.is_file(), "Missing or nonregular artifact: " + path.name)
    require(path.stat().st_size <= limit, "Artifact exceeds size limit: " + path.name)
    return path


def file_json(path):
    return decode(regular(path, JSON_LIMIT).read_bytes())


def name(value):
    require(
        isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", value) and value not in {".", ".."},
        "Artifact reference must be a single safe filename",
    )
    return value


def cargo_vendor_directory(value):
    # Cargo's versioned vendor names retain SemVer build metadata (for example
    # ndk-sys-0.6.0+11769913). This is one archive directory component, not an
    # external artifact filename; keep the latter's stricter name() policy.
    require(
        isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._+-]*", value) and value not in {".", ".."},
        "Cargo vendor directory must be a single safe component",
    )
    return value


def member_name(value):
    require(isinstance(value, str) and value and "\\" not in value and "\x00" not in value, "Unsafe archive member")
    path = PurePosixPath(value)
    require(not path.is_absolute() and ".." not in path.parts, "Unsafe archive member")
    return path.as_posix()


def checksum(value):
    require(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value), "Invalid SHA-256")
    return value


def hash_file(path, expected, limit=ARCHIVE_LIMIT):
    actual = build.sha256(regular(path, limit))
    require(actual == checksum(expected), "Artifact digest mismatch: " + path.name)
    return actual


class BoundedTarInfo(tarfile.TarInfo):
    def _reject_sparse(self, *_args):
        raise ValueError("Sparse archive entries are unsupported")

    # _proc_pax dispatches here before index_archive sees the member. In
    # particular, GNU sparse 1.0 reads its map from the payload at this point.
    # Reject at dispatch rather than letting the stdlib parse any sparse map.
    _proc_gnusparse_00 = _reject_sparse
    _proc_gnusparse_01 = _reject_sparse
    _proc_gnusparse_10 = _reject_sparse

    def _apply_pax_info(self, pax_headers, encoding, errors):
        # Also reject incomplete/unknown GNU sparse variants and global PAX
        # metadata, which need not enter one of the known sparse handlers.
        require(not any(key.startswith("GNU.sparse.") for key in pax_headers), "Sparse archive entries are unsupported")
        return super()._apply_pax_info(pax_headers, encoding, errors)

    def _proc_member(self, archive):
        # Tarfile consumes extended headers before yielding an entry to the
        # caller. Bound those allocations too, including malicious PAX input.
        headers = (
            tarfile.GNUTYPE_LONGNAME,
            tarfile.GNUTYPE_LONGLINK,
            tarfile.XHDTYPE,
            tarfile.XGLTYPE,
            tarfile.SOLARIS_XHDTYPE,
        )
        archive.release_headers = getattr(archive, "release_headers", 0) + 1
        require(archive.release_headers <= FILE_COUNT_LIMIT * 3, "Too many archive headers")
        require(self.type != tarfile.GNUTYPE_SPARSE, "Sparse archive entries are unsupported")
        require(self.type not in headers or 0 <= self.size <= JSON_LIMIT, "Extended archive header exceeds size limit")
        return super()._proc_member(archive)


def png_container(data):
    """Check a bounded PNG container and CRCs, not decompressed pixel content."""
    if len(data) > JSON_LIMIT or not data.startswith(PNG_SIGNATURE):
        return False
    view = memoryview(data)
    offset, colour, depth, palette = 8, None, None, False
    image_bytes, image_started, image_end = 0, False, False
    while offset < len(data):
        if len(data) - offset < 12:
            return False
        size = int.from_bytes(view[offset : offset + 4], "big")
        end = offset + 12 + size
        if end > len(data):
            return False
        kind = data[offset + 4 : offset + 8]
        if not re.fullmatch(b"[A-Za-z]{2}[A-Z][A-Za-z]", kind):
            return False
        expected = int.from_bytes(view[end - 4 : end], "big")
        if zlib.crc32(view[offset + 4 : end - 4]) != expected:
            return False
        body = view[offset + 8 : end - 4]
        if offset == 8:
            if kind != b"IHDR" or size != 13:
                return False
            width, height = int.from_bytes(body[:4], "big"), int.from_bytes(body[4:8], "big")
            depth, colour, compression, filtering, interlace = body[8:13]
            depths = {0: (1, 2, 4, 8, 16), 2: (8, 16), 3: (1, 2, 4, 8), 4: (8, 16), 6: (8, 16)}
            if (
                not 0 < width <= 16384
                or not 0 < height <= 16384
                or depth not in depths.get(colour, ())
                or compression != 0
                or filtering != 0
                or interlace not in (0, 1)
            ):
                return False
        elif kind == b"IHDR":
            return False
        elif kind == b"PLTE":
            if palette or image_started or colour in (0, 4) or not 0 < size <= 768 or size % 3:
                return False
            if colour == 3 and size // 3 > 1 << depth:
                return False
            palette = True
        elif kind == b"IDAT":
            if image_end or (colour == 3 and not palette):
                return False
            image_started = True
            image_bytes += size
        elif kind == b"IEND":
            return size == 0 and image_bytes > 0 and end == len(data)
        elif kind[0] < ord("a"):
            # An unknown critical chunk cannot be safely interpreted as PNG.
            return False
        if kind != b"IDAT" and image_started:
            image_end = True
        offset = end
    return False


def index_archive(source, captures=(), *, total_limit=EXPANDED_LIMIT, regular_only=True, spools=None, compression="gz"):
    """Index a tar in bounded memory, hashing each member as it is consumed."""
    rows, content, total, captured = {}, {}, 0, 0
    kwargs = {"fileobj": source} if hasattr(source, "read") else {"name": source}
    with ExitStack() as stack:
        if compression == "gz":
            # The tar streaming decoder does not validate CRC/ISIZE. Keep
            # gzip responsible for the complete stream, including its trailer.
            gzip_kwargs = {"fileobj": source} if hasattr(source, "read") else {"filename": source}
            decoded = stack.enter_context(gzip.GzipFile(mode="rb", **gzip_kwargs))
            kwargs, compression = {"fileobj": decoded}, ""
        archive = stack.enter_context(tarfile.open(mode="r|" + compression, tarinfo=BoundedTarInfo, **kwargs))
        for item in archive:
            key = member_name(item.name)
            require(key not in rows, "Duplicate archive member: " + key)
            require(len(rows) < FILE_COUNT_LIMIT, "Too many archive members")
            if item.isdir() and not regular_only:
                rows[key] = {"directory": True}
                continue
            require(item.isfile() and not item.issparse(), "Nonregular archive member: " + key)
            require(item.mode in {0o644, 0o755}, "Unexpected archive permissions: " + key)
            total += item.size
            require(0 <= item.size <= MEMBER_LIMIT and total <= total_limit, "Expanded archive exceeds size limit")
            keep = captures(key) if callable(captures) else key in captures
            require(not keep or item.size <= JSON_LIMIT, "Captured member exceeds size limit")
            captured += item.size if keep else 0
            require(captured <= JSON_LIMIT * 4, "Captured archive content exceeds size limit")
            h, h512, prefix, parts, count = hashlib.sha256(), hashlib.sha512(), b"", [], 0
            collect_png = False
            png_data = None
            stream = archive.extractfile(item)
            sink = (spools or {}).get(key)
            while block := stream.read(1024 * 1024):
                count += len(block)
                require(count <= item.size, "Archive member size mismatch")
                h.update(block)
                h512.update(block)
                if len(prefix) < 52:
                    prefix += block[: 52 - len(prefix)]
                    # Source members can be gigabytes. Only small PNG candidates
                    # need a complete container; all others remain streamed.
                    collect_png = item.size <= JSON_LIMIT and prefix.startswith(PNG_SIGNATURE)
                    if collect_png and not keep:
                        png_data = bytearray(item.size)
                if keep:
                    parts.append(block)
                elif collect_png:
                    png_data[count - len(block) : count] = block
                if sink is not None:
                    sink.write(block)
            require(count == item.size, "Truncated archive member")
            # PNG-only inspection uses one fixed-size buffer, without retaining
            # blocks and allocating another full image when joining them.
            data = b"".join(parts) if keep else png_data
            rows[key] = {
                "sha256": h.hexdigest(),
                "sha512": h512.hexdigest(),
                "mode": item.mode,
                "bytes": item.size,
                "elf": prefix.startswith(b"\x7fELF"),
                "arm": build.elf_arm(prefix),
                "png": collect_png and png_container(data),
            }
            if keep:
                content[key] = data
        # Read through the tar stream so its buffered bytes cannot hide data
        # after the end marker. Only one bounded zero padding record is valid.
        padding = 0
        while trailer := archive.fileobj.read(tarfile.RECORDSIZE):
            padding += len(trailer)
            require(
                padding <= tarfile.RECORDSIZE and not trailer.strip(b"\0"),
                "Unexpected or oversized archive trailer",
            )
    return rows, content


def recorded_file(rows, path, expected):
    path = member_name(path)
    require(path in rows and rows[path].get("sha256") == checksum(expected), "Source member digest mismatch: " + path)


def check_private_paths(rows, *, source=False):
    for path in rows:
        parts = PurePosixPath(path).parts
        private = set(parts) & PRIVATE_NAMES
        if source and path.startswith("tests/fixtures/"):
            private -= {"session.json", "consent.json"}
        require(not private and "ott-state" not in parts, "Private configuration/state must not be packaged: " + path)


def check_package(ipk, metadata):
    regular(ipk, IPK_LIMIT)
    members = build.ar_members(ipk.read_bytes())
    prefix = "usr/palm/applications/" + APP_ID + "/"
    captures = {prefix + "appinfo.json"} | {
        prefix + "companion/" + name for name in ("manifest.json", "receipt.json", "source.json")
    }
    rows, content = index_archive(
        io.BytesIO(members["data.tar.gz"]), captures, total_limit=512 * 1024 * 1024, regular_only=False
    )
    index_archive(io.BytesIO(members["control.tar.gz"]), total_limit=JSON_LIMIT, regular_only=False)
    check_private_paths(rows)
    for path, row in rows.items():
        if row.get("elf"):
            require(row["arm"], "Native ELF architecture mismatch: " + path)
    for executable in (prefix + "plxnative", "usr/palm/services/" + APP_ID + ".storage/plxnative-storage"):
        require(rows.get(executable, {}).get("mode") == 0o755, "Native executable permissions mismatch: " + executable)
    spec = {"application": metadata["application"]}
    verified = build.verify_ipk(ipk, spec)
    for key in ("application", "size", "sha256", "architecture", "type", "rootRequired", "payload_bytes"):
        require(verified[key] == metadata.get(key), "Package metadata mismatch: " + key)
    require(
        verified.get("companion") == metadata.get("companion") == metadata["build"].get("companion"),
        "Companion package/build metadata mismatch",
    )
    descriptor = decode(content[prefix + "appinfo.json"])
    for key in ("icon", "largeIcon", "splashBackground"):
        asset = prefix + member_name(descriptor.get(key))
        require(asset in rows and rows[asset].get("png"), "Packaged PNG artwork missing or invalid: " + key)
    return rows, descriptor, content


class IntegrationPatchSpool:
    """One anonymous file for raw patch bytes, indexed after archive admission."""

    def __init__(self, stream):
        self.stream = stream
        self.offsets = {}

    def get(self, key):
        # index_archive calls this only after its path, type and size guards.
        if not key.startswith(INTEGRATION_PREFIX + "patches/"):
            return None
        self.offsets[key] = self.stream.tell()
        return self.stream

    def update(self, digest, key, size):
        self.stream.seek(self.offsets[key])
        remaining = size
        while remaining:
            block = self.stream.read(min(remaining, 1024 * 1024))
            require(block, "Truncated integration patch spool")
            digest.update(block)
            remaining -= len(block)


def check_primary(path, metadata, receipt, package_rows, descriptor):
    with tempfile.TemporaryFile() as stream:
        return _check_primary_spooled(path, metadata, receipt, package_rows, descriptor,
                                      IntegrationPatchSpool(stream))


def _check_primary_spooled(path, metadata, receipt, package_rows, descriptor, patches):
    captures = {
        "SOURCE-MANIFEST.json",
        "ci/dependencies.json",
        "ci/ottplay-integration/upstream.json",
        "ci/ottplay-integration/PROVENANCE.json",
        "pkg/appinfo.json",
        "rust-modules/rust-toolchain.toml",
    }
    rows, content = index_archive(
        path,
        lambda key: key in captures or (key.startswith(INTEGRATION_PREFIX)
                                       and not key.startswith(INTEGRATION_PREFIX + "patches/")),
        spools=patches,
    )
    check_private_paths(rows, source=True)
    manifest = decode(content["SOURCE-MANIFEST.json"])
    require(
        manifest.get("schema") == 1 and manifest.get("license") == "GPL-3.0-or-later", "Source schema/license mismatch"
    )
    environment = manifest["build_environment"]
    rust_channel = None
    if "compilation" in metadata["build"]:
        toolchain = tomllib.loads(content.get("rust-modules/rust-toolchain.toml", b"").decode("utf-8"))
        require(toolchain.get("toolchain", {}).get("channel") == metadata["build"]["rust_toolchain"],
                "Native compilation source toolchain mismatch")
        rust_channel = toolchain["toolchain"]["channel"]
    require(
        manifest["rebuild_status"] == "NOT_RUN"
        and environment["rust_target"] == build.TARGET
        and environment["ndk"]["gcc_sha256"] == metadata["build"]["sdk_compiler_sha256"]
        and all(
            environment["configuration"].get(key) == value
            for key, value in {"FLAVOR": "stable", "RELEASE": "1"}.items()
        ),
        "Source build configuration/compiler binding mismatch",
    )
    actual = {
        key: {"sha256": row["sha256"], "mode": row["mode"]}
        for key, row in rows.items()
        if key != "SOURCE-MANIFEST.json"
    }
    require(actual == manifest["files"], "Source file set/hash/mode mismatch")
    # This is the published source snapshot format, not a Git tree or a rebuild.
    snapshot = hashlib.sha256(json.dumps(actual, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    require(
        snapshot
        == manifest["snapshot_sha256"]
        == metadata["corresponding_source"]["snapshot_sha256"]
        == receipt["source_snapshot_sha256"],
        "Source snapshot mismatch",
    )
    require(manifest["git_commit"] == metadata["upstream"]["revision"], "Source upstream revision mismatch")
    recorded_file(rows, "LICENSE", build.sha256(ROOT / "native/webos/COPYING"))
    for required in (
        "LICENSING.md",
        "THIRD-PARTY-NOTICES.md",
        "Makefile",
        "rust-modules/Cargo.toml",
        "rust-modules/Cargo.lock",
    ):
        require(required in rows, "Missing required source: " + required)
    require(build.EXCLUDED_SOURCE not in rows, "Excluded platform code in source archive")
    upstream = decode(content["ci/ottplay-integration/upstream.json"])
    require(
        upstream["application"] == metadata["application"]
        and upstream["revision"] == metadata["upstream"]["revision"]
        and upstream["repository"] == metadata["upstream"]["repository"],
        "Embedded source pin/identity mismatch",
    )
    provenance = decode(content["ci/ottplay-integration/PROVENANCE.json"])
    require(
        provenance["revision"] == upstream["revision"]
        and provenance["integration_sha256"] == metadata["integration_sha256"],
        "Embedded integration provenance mismatch",
    )
    for patch, digest in provenance["patches"].items():
        recorded_file(rows, "ci/ottplay-integration/patches/" + name(patch), digest)
    integration_names = INTEGRATION_FILES | {"patches/" + name(patch) for patch in provenance["patches"]}
    generated_names = {"PROVENANCE.json"}
    if "control_discovery" in metadata["build"]["configuration"]:
        version = metadata["application"]["version"]
        product = build.release_product_config(upstream)
        product_path = build.PRODUCT_CONFIG
        require(decode(content.get(product_path, b"{}")) == product, "Embedded release product mismatch")
        documents = {}
        for role, suffix in (("notes", ".md"), ("audit", "-audit.md")):
            source_name = "releases/" + version + suffix
            raw = content.get(INTEGRATION_PREFIX + source_name, b"")
            require(0 < len(raw) <= build.RELEASE_DOCUMENT_LIMIT and b"\0" not in raw
                    and raw.decode("utf-8").strip() and content.get(product[role]) == raw,
                    "Embedded release document mismatch")
            documents[role] = hashlib.sha256(raw).hexdigest()
            integration_names.add(source_name)
            generated_names.add(product[role].removeprefix(INTEGRATION_PREFIX))
        integration_names.add("control_discovery_config.py")
        generated_names.add(product_path.removeprefix(INTEGRATION_PREFIX))
        expected_product = {"path": product_path, "sha256": hashlib.sha256(content[product_path]).hexdigest(),
                            "documents": documents, "audit_evidence": "authored_only"}
        require(metadata["build"].get("product_release") == expected_product,
                "Release product receipt mismatch")
    else:
        require("product_release" not in metadata["build"], "Unexpected release product receipt")
    actual_names = {key.removeprefix(INTEGRATION_PREFIX) for key in rows if key.startswith(INTEGRATION_PREFIX)}
    require(actual_names == integration_names | generated_names, "Embedded integration file set mismatch")
    integration_hash = hashlib.sha256()
    for key in sorted(integration_names):
        integration_hash.update(key.encode() + b"\0")
        member = INTEGRATION_PREFIX + key
        if key.startswith("patches/"):
            patches.update(integration_hash, member, rows[member]["bytes"])
        else:
            integration_hash.update(content[member])
    require(integration_hash.hexdigest() == metadata["integration_sha256"], "Embedded integration digest mismatch")
    app = decode(content["pkg/appinfo.json"])
    require(
        all(app.get(k) == metadata["application"][k] for k in ("id", "title", "version"))
        and app.get("type") == "native",
        "Source application identity mismatch",
    )
    package_prefix = "usr/palm/applications/" + APP_ID + "/"
    for key in ("icon", "largeIcon", "splashBackground"):
        require(app.get(key) == descriptor[key], "Source/package artwork path mismatch")
        asset = member_name(app[key])
        recorded_file(rows, "pkg/" + asset, package_rows[package_prefix + asset]["sha256"])
    recorded_file(rows, "THIRD-PARTY-NOTICES.md", package_rows[package_prefix + "THIRD-PARTY-NOTICES.md"]["sha256"])
    declared = decode(content["ci/dependencies.json"])
    required = {row["id"] for row in declared if row.get("bundled")} | {"cargo-vendor", "rust-runtime"}
    if any(key.startswith(package_prefix + "libavformat") for key in package_rows):
        required.add("ffmpeg")
    dependencies = manifest["dependencies"]
    require(len({row["id"] for row in dependencies}) == len(dependencies), "Duplicate source dependency")
    by_id = {row["id"]: row for row in dependencies}
    require(required <= by_id.keys(), "Missing bundled dependency source")
    for dep_id in required:
        require(by_id[dep_id].get("sources"), "Dependency sources are not included")
        for item in by_id[dep_id]["sources"]:
            recorded_file(rows, item["path"], item["sha256"])
    return upstream, {"source_commit": by_id["rust-runtime"].get("version"), "channel": rust_channel}


def companion_canonical(value):
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode()


def nested_index(archive, captures=(), **kwargs):
    archive.seek(0)
    return index_archive(archive, captures, **kwargs)


def check_companion_local(archive, source, spec, manifest, packaged, package_rows):
    captures = {"source-receipt.json", "source/Cargo.lock", "source/native/webos/companion/manifest.json"}
    rows, content = nested_index(archive, captures)
    check_private_paths(rows, source=True)
    inventory = source["local_inputs"]
    require(
        hashlib.sha256(companion_canonical(inventory)).hexdigest()
        == packaged["local_inputs_sha256"]
        == source["local_inputs_sha256"],
        "Companion local inventory digest mismatch",
    )
    expected = {"source/" + member_name(row["path"]): row for row in inventory}
    require(
        len(expected) == len(inventory) and set(rows) == set(expected) | {"source-receipt.json"},
        "Companion local source inventory mismatch",
    )
    require(decode(content["source-receipt.json"]) == source, "Companion embedded source receipt mismatch")
    recorded_file(rows, "source-receipt.json", packaged["source_receipt_sha256"])
    for path, row in expected.items():
        recorded_file(rows, path, row["sha256"])
        require(
            rows[path]["mode"] == row["mode"] and rows[path]["bytes"] == row["bytes"],
            "Companion local source size/mode mismatch",
        )
    policy_path = "source/native/webos/companion/manifest.json"
    require(decode(content[policy_path]) == spec, "Companion archived build policy mismatch")
    recorded_file(rows, policy_path, packaged["manifest_sha256"])
    for path in spec["required_source_files"]:
        require("source/" + member_name(path) in rows, "Companion required local source is missing")
    for path in spec["notice_files"]:
        source_path = "source/" + member_name(path)
        package_path = "usr/palm/applications/" + APP_ID + "/companion/licenses/" + member_name(path)
        require(package_path in package_rows, "Companion packaged license notice missing")
        recorded_file(rows, source_path, package_rows[package_path]["sha256"])
    recorded_file(rows, "source/Cargo.lock", manifest["cargo_lock_sha256"])
    lock = tomllib.loads(content["source/Cargo.lock"].decode())
    packages = [
        {key: item[key] for key in ("name", "version", "source", "checksum") if key in item}
        for item in lock["package"]
        if "source" in item
    ]
    require(packages == source["cargo_lock_dependencies"], "Companion Cargo.lock dependency receipt mismatch")
    require(
        len({(row["name"], row["version"], row["source"]) for row in packages}) == len(packages),
        "Duplicate locked companion dependency",
    )
    for package in packages:
        origin = package["source"]
        if origin.startswith(("registry+", "sparse+")):
            checksum(package.get("checksum"))
        else:
            require(
                origin.startswith("git+") and re.search(r"#[0-9a-f]{40}$", origin),
                "Companion dependency lacks a durable source identity",
            )
    return packages


def check_companion_vendor(archive, packages, components):
    rows, content = nested_index(archive, lambda path: path.endswith(("/Cargo.toml", "/.cargo-checksum.json")))
    check_private_paths(rows, source=True)
    require(
        all(path.startswith("cargo-vendor/") and len(PurePosixPath(path).parts) >= 3 for path in rows),
        "Companion vendor archive path mismatch",
    )
    directories = {PurePosixPath(path).parts[1] for path in rows}
    require(
        len(components) == len(packages) == len(directories)
        and {row["directory"] for row in components} == directories,
        "Companion vendor/lock component set mismatch",
    )
    remaining = list(packages)
    for component in components:
        prefix = "cargo-vendor/" + cargo_vendor_directory(component["directory"]) + "/"
        checksum_path = prefix + ".cargo-checksum.json"
        recorded_file(rows, checksum_path, component["checksum_manifest_sha256"])
        cargo = tomllib.loads(content[prefix + "Cargo.toml"].decode())["package"]
        sums = decode(content[checksum_path])
        candidates = [
            row
            for row in remaining
            if row["name"] == cargo["name"]
            and row["version"] == cargo["version"]
            and row.get("checksum") == sums["package"]
        ]
        require(len(candidates) == 1, "Companion vendored package differs from Cargo.lock")
        package = candidates[0]
        require(
            all(component.get(key) == package.get(key) for key in ("name", "version", "source", "checksum"))
            and component["files"] == len(sums["files"]),
            "Companion vendor component identity mismatch",
        )
        remaining.remove(package)
        expected = {prefix + member_name(path) for path in sums["files"]} | {checksum_path}
        require({path for path in rows if path.startswith(prefix)} == expected, "Companion vendor file set mismatch")
        for path, digest in sums["files"].items():
            recorded_file(rows, prefix + member_name(path), digest)
    require(not remaining, "Companion locked dependencies are missing")


def cargo_registry_identity(url):
    # Cargo treats both built-in index protocols as crates.io. Other sparse
    # registries retain their prefix in both Cargo.lock and vendor output.
    if url in {"https://github.com/rust-lang/crates.io-index", "sparse+https://index.crates.io/"}:
        return ("registry", "crates-io")
    return ("registry", url)


def cargo_locked_identity(origin):
    if origin.startswith("registry+"):
        return cargo_registry_identity(origin.removeprefix("registry+"))
    if origin.startswith("sparse+"):
        return cargo_registry_identity(origin)
    require(origin.startswith("git+"), "Companion Cargo source kind is unsupported")
    url = urlsplit(origin.removeprefix("git+"))
    reference = parse_qsl(url.query, keep_blank_values=True)
    require(
        len(reference) <= 1 and all(key in {"branch", "tag", "rev"} and value for key, value in reference),
        "Companion Cargo Git reference is ambiguous",
    )
    return ("git", url._replace(query="", fragment="").geturl(), tuple(reference))


def check_companion_cargo_config(config, packages):
    """Follow every locked origin to the exported directory, without Cargo or network access."""
    sources = config.get("source", {})
    require(isinstance(sources, dict) and sources, "Companion Cargo source mappings missing")
    identities = {}
    directories = []
    for alias, item in sources.items():
        require(isinstance(item, dict), "Companion Cargo source must be a table")
        kinds = [key for key in ("registry", "git", "directory", "local-registry") if key in item]
        require(
            len(kinds) == 1 or (not kinds and alias == "crates-io"),
            "Companion Cargo source kind is missing or ambiguous",
        )
        require(
            all(isinstance(value, str) and value for value in item.values()),
            "Companion Cargo source values must be nonempty strings",
        )
        references = tuple((key, item[key]) for key in ("branch", "tag", "rev") if key in item)
        require(
            len(references) <= 1 and (not references or "git" in item),
            "Companion Cargo Git reference is ambiguous",
        )
        identity = None
        if not kinds:
            identity = ("registry", "crates-io")
        elif "registry" in item:
            identity = cargo_registry_identity(item["registry"])
        elif "git" in item:
            url = urlsplit(item["git"])
            require(not url.query and not url.fragment, "Companion Cargo Git URL contains an embedded reference")
            identity = ("git", url.geturl(), references)
        elif "directory" in item:
            directories.append(item["directory"])
        if alias == "crates-io":
            require(identity == ("registry", "crates-io"), "Companion Cargo crates.io source identity mismatch")
        if identity is not None:
            require(identity not in identities, "Companion Cargo source identity is ambiguous")
            identities[identity] = alias
    require(
        directories and all(path == "cargo-vendor" for path in directories),
        "Companion Cargo source replacement path mismatch",
    )
    for origin in {package["source"] for package in packages}:
        identity = cargo_locked_identity(origin)
        require(identity in identities, "Companion Cargo locked source mapping missing")
        alias = identities[identity]
        visited = set()
        while True:
            require(alias not in visited, "Companion Cargo source replacement cycle")
            require(alias in sources, "Companion Cargo source replacement target missing")
            visited.add(alias)
            item = sources[alias]
            if "replace-with" not in item:
                require(
                    item.get("directory") == "cargo-vendor",
                    "Companion Cargo source replacement does not end at cargo-vendor",
                )
                break
            alias = item["replace-with"]


def xz_source_index(archive):
    """Limit both LZMA dictionary allocation and output before opening its tar."""
    archive.seek(0)
    decoder = lzma.LZMADecompressor(memlimit=XZ_MEMORY_LIMIT)
    total = 0
    with tempfile.TemporaryFile() as decoded:
        while not decoder.eof:
            block = archive.read(64 * 1024) if decoder.needs_input else b""
            require(block or not decoder.needs_input, "Truncated companion Rust source archive")
            output = decoder.decompress(block, max_length=1024 * 1024)
            total += len(output)
            require(total <= EXPANDED_LIMIT, "Expanded companion Rust source exceeds size limit")
            decoded.write(output)
        require(not decoder.unused_data and not archive.read(1), "Unexpected trailing Rust source archive data")
        return nested_index(decoded, regular_only=False, compression="")


def check_companion_rust(spools, rows, rust, spec, receipt):
    toolchain = spec["rust_toolchain"]
    require(
        re.fullmatch(r"\d+\.\d+\.\d+", toolchain) and rust["toolchain"] == toolchain,
        "Companion Rust toolchain mismatch",
    )
    pinned_commit = spec.get("rust_commit", "")
    require(re.fullmatch(r"[0-9a-f]{40}", pinned_commit), "Companion Rust policy requires a full commit pin")
    commits = re.findall(r"^commit-hash: (.*)$", receipt["rustc"], re.MULTILINE)
    require(
        commits == [pinned_commit] and rust["commit"] == pinned_commit and rust["source_archive_hash_verified"] is True,
        "Companion Rust compiler/source commit mismatch",
    )
    require(
        receipt["rustc"].startswith("rustc " + toolchain + " ")
        and re.findall(r"^release: (.*)$", receipt["rustc"], re.MULTILINE) == [toolchain],
        "Companion Rust compiler version mismatch",
    )
    notices, content = nested_index(spools["rust-notices.tar.gz"], {"channel-manifest.toml"})
    check_private_paths(notices, source=True)
    recorded_file(notices, "channel-manifest.toml", rust["channel_manifest_sha256"])
    require(
        {"COPYRIGHT.html", "COPYRIGHT-library.html"} <= notices.keys()
        and any(path.startswith("licenses/") for path in notices),
        "Companion Rust license notices missing",
    )
    channel = tomllib.loads(content["channel-manifest.toml"].decode())
    for package in ("rustc", "rust-src", "rust-std"):
        require(
            channel["pkg"][package]["version"].startswith(toolchain + " (" + pinned_commit[:9] + " "),
            "Companion Rust channel/source identity mismatch",
        )
    pinned = channel["pkg"]["rust-src"]["target"]["*"]
    candidates = [path for path in rows if path.startswith("rust-src-")]
    require(
        len(candidates) == 1
        and candidates[0] in {"rust-src-" + toolchain + extension for extension in (".tar.gz", ".tar.xz")},
        "Companion Rust source component missing or ambiguous",
    )
    path = candidates[0]
    recorded_file(rows, path, rust["archive_sha256"])
    require(
        rust["archive_sha256"] in (pinned.get("hash"), pinned.get("xz_hash")),
        "Companion Rust source differs from pinned channel checksum",
    )
    archive_rows, _ = (
        xz_source_index(spools[path]) if path.endswith(".xz") else nested_index(spools[path], regular_only=False)
    )
    check_private_paths(archive_rows, source=True)
    library = "rust-src-" + toolchain + "/rust-src/lib/rustlib/src/rust/library/"
    for path in ("Cargo.lock", "Cargo.toml", "core/src/lib.rs", "alloc/src/lib.rs", "std/src/lib.rs"):
        row = archive_rows.get(library + path, {})
        require(
            not row.get("directory") and row.get("bytes", 0) > 0,
            "Companion Rust library source missing or empty: " + path,
        )


def check_companion_compilers(linkage, evidence, receipt, attestation):
    compilers = attestation.get("companion_compiler")
    require(
        isinstance(compilers, dict)
        and set(compilers) == {"compiler", "backend", "archive_match"}
        and compilers["archive_match"] == "PASS",
        "Companion compiler SDK archive attestation missing or incomplete",
    )
    paths = set()
    for descriptor, key, executable in (
        ("compiler", "compiler_sha256", "gcc"),
        ("backend", "compiler_backend_sha256", "gcc_backend"),
    ):
        item = compilers[descriptor]
        require(
            isinstance(item, dict) and set(item) == {"sdk_path", "sha256"},
            "Companion compiler SDK descriptor mismatch",
        )
        path = member_name(item["sdk_path"])
        require(
            path == item["sdk_path"] and path != "." and path not in paths,
            "Companion compiler SDK paths must be canonical, distinct files",
        )
        paths.add(path)
        checksum(item["sha256"])
        require(
            item["sha256"] == linkage.get(key) == evidence.get(key) == receipt["sdk"]["executables"].get(executable),
            "Companion compiler SDK/link evidence mismatch: " + descriptor,
        )


def check_companion_link_inventory(evidence, link_streams, attestation):
    # Reuse the collector's pure name parser; do not resolve public build paths
    # against this machine or rehash somebody else's build directory.
    loader = importlib.util.spec_from_file_location("native_runtime_sources", ROOT / "scripts/webos-runtime-sources.py")
    runtime_sources = importlib.util.module_from_spec(loader)
    loader.loader.exec_module(runtime_sources)

    def lines(stream):
        stream.seek(0)
        while line := stream.readline(1024 * 1024):
            require(len(line) < 1024 * 1024 or line.endswith(b"\n"), "Companion linker line exceeds size limit")
            yield line

    roots = {
        "build_root": "/build/ottplay-companion",
        "build_target": "/build/companion-target",
        "rust_sysroot": "/build/companion-rust",
    }
    require(
        all(evidence.get(key) == value for key, value in roots.items())
        and evidence.get("archive_inputs_capture") == "during-final-link",
        "Companion link-time archive inventory roots/capture mismatch",
    )
    allowed = {PurePosixPath(path) for path in (*roots.values(), "/build/ottplay-native", "/build/webos-sdk")}
    inventory = evidence.get("archive_inputs")
    require(
        isinstance(inventory, list) and 0 < len(inventory) <= FILE_COUNT_LIMIT,
        "Companion link-time archive inventory missing",
    )
    declared = set()
    for row in inventory:
        require(
            isinstance(row, dict) and set(row) == {"path", "sha256", "bytes", "observed_at_link", "validation"},
            "Companion archive input fields mismatch",
        )
        path = PurePosixPath(row["path"])
        require(
            path.is_absolute()
            and ".." not in path.parts
            and "\\" not in row["path"]
            and path.as_posix() == row["path"]
            and any(path.is_relative_to(root) for root in allowed)
            and row["path"] not in declared
            and row["observed_at_link"] is True
            and type(row["bytes"]) is int
            and row["bytes"] > 0,
            "Companion archive input identity/scope mismatch",
        )
        checksum(row["sha256"])
        declared.add(row["path"])
        target = PurePosixPath(roots["build_target"])
        relative = path.relative_to(target).as_posix() if path.is_relative_to(target) else ""
        ephemeral = path.suffix == ".rlib" and re.search(r"(?:^|/)deps/rustc[^/]+/", relative) is not None
        require(
            row["validation"] == ("link_time_only_ephemeral" if ephemeral else "link_time_and_current"),
            "Companion archive validation scope mismatch",
        )
        if path.is_relative_to(PurePosixPath("/build/webos-sdk")):
            sdk_path = path.relative_to(PurePosixPath("/build/webos-sdk")).as_posix()
            require(
                attestation["runtime_files_sha256"].get(sdk_path) == row["sha256"],
                "Companion SDK archive digest mismatch",
            )
    names = runtime_sources.observed_archive_names(lines(link_streams[0]), lines(link_streams[1]))
    observed = {posixpath.normpath(posixpath.join(roots["build_root"], path)) for path in names}
    require(observed == declared, "Companion archive inventory differs from published linker inputs")


def check_companion(archive, rows, content, metadata, runtime, package_rows, package_content, link_streams):
    companion = metadata.get("companion")
    optional_paths = {path for path in rows if path.startswith("companion/")}
    if companion is None:
        require(
            "companion" not in runtime and not optional_paths, "Unexpected companion source without packaged helper"
        )
        return
    require(
        optional_paths
        == {"companion/companion-source.tar.gz", "companion/source-closure.json", "companion/SOURCE-MANIFEST.json"},
        "Companion runtime source set is incomplete",
    )
    binding = runtime["companion"]
    closure = decode(content["companion/source-closure.json"])
    manifest_bytes = content["companion/SOURCE-MANIFEST.json"]
    manifest = decode(manifest_bytes)
    archive_row = rows["companion/companion-source.tar.gz"]
    require(
        binding["packaged"] == companion
        and binding["source_closure"] == closure
        and binding["sdk_runtime_source_coverage"] == "PASS"
        and binding["archive"]
        == {"file": "companion/companion-source.tar.gz", "sha256": archive_row["sha256"], "bytes": archive_row["bytes"]}
        and closure["source_archive"]
        == {"file": "companion-source.tar.gz", "sha256": archive_row["sha256"], "bytes": archive_row["bytes"]},
        "Companion runtime archive binding mismatch",
    )
    recorded_file(rows, "companion/SOURCE-MANIFEST.json", closure["source_manifest_sha256"])
    for value in (closure, manifest):
        require(
            value["schema"] == 1
            and value["complete_corresponding_source"] is False
            and value["sdk_runtime_source_coverage"] == "PENDING_ENCLOSING_RELEASE"
            and value["rebuild_validation"] == "NOT_RUN",
            "Companion source coverage is missing or overclaimed",
        )
    require(
        closure["locked_source_coverage"] == "PASS" and manifest["bit_identical_rebuild"] == "NOT_PROVEN",
        "Companion locked source or rebuild status mismatch",
    )
    for key in (
        "cargo_lock_sha256",
        "dependency_count",
        "rust",
        "sdk_linkage",
        "sdk_archive_sha256",
        "local_inputs_sha256",
    ):
        require(closure[key] == manifest[key], "Companion closure/manifest mismatch: " + key)
    for key in ("elf_sha256", "source_receipt_sha256", "local_source_archive_sha256", "local_inputs_sha256"):
        require(closure[key] == companion[key], "Companion closure/package mismatch: " + key)
    prefix = "usr/palm/applications/" + APP_ID + "/companion/"
    spec = decode(package_content[prefix + "manifest.json"])
    receipt = decode(package_content[prefix + "receipt.json"])
    with ExitStack() as stack:
        toolchain = manifest["rust"]["toolchain"]
        require(
            isinstance(toolchain, str) and re.fullmatch(r"\d+\.\d+\.\d+", toolchain), "Invalid companion Rust version"
        )
        spool_names = {"local-source.tar.gz", "cargo-vendor.tar.gz", "rust-notices.tar.gz"}
        spool_names |= {"rust-src-" + toolchain + ext for ext in (".tar.gz", ".tar.xz")}
        spools = {path: stack.enter_context(tempfile.TemporaryFile()) for path in spool_names}
        captures = {
            "SOURCE-MANIFEST.json",
            "build-receipt.json",
            "source-receipt.json",
            "cargo-components.json",
            "cargo-config.toml",
        }
        inner, data = nested_index(archive, captures, spools=spools)
        check_private_paths(inner, source=True)
        require(
            {
                path: {key: row[key] for key in ("sha256", "bytes")}
                for path, row in inner.items()
                if path != "SOURCE-MANIFEST.json"
            }
            == manifest["files"]
            and data["SOURCE-MANIFEST.json"] == manifest_bytes,
            "Companion source manifest file set/hash mismatch",
        )
        require(
            data["build-receipt.json"] == package_content[prefix + "receipt.json"],
            "Companion source/build receipt mismatch",
        )
        for path, key in (
            ("build-receipt.json", "receipt_sha256"),
            ("source-receipt.json", "source_receipt_sha256"),
            ("local-source.tar.gz", "local_source_archive_sha256"),
        ):
            recorded_file(inner, path, companion[key])
        source = decode(data["source-receipt.json"])
        require(
            source["schema"] == 1
            and source["complete_corresponding_source"] is False
            and source["release_source_requirements"] == spec["release_source_requirements"]
            and source["dependency_scope"] == manifest["dependency_scope"],
            "Companion local source declaration mismatch",
        )
        require(
            manifest["package"] == receipt["package"] == spec["package"] == "ottplay-companion"
            and manifest["target"] == receipt["target"] == spec["target"] == build.TARGET
            and manifest["features"] == receipt["features"] == spec["features"]
            and receipt["device_executed"] is False
            and receipt["elf"]["device_executed"] is False,
            "Companion identity or device claim mismatch",
        )
        packages = check_companion_local(spools["local-source.tar.gz"], source, spec, manifest, companion, package_rows)
        components = decode(data["cargo-components.json"])
        require(len(components) == manifest["dependency_count"], "Companion dependency count mismatch")
        check_companion_vendor(spools["cargo-vendor.tar.gz"], packages, components)
        config = tomllib.loads(data["cargo-config.toml"].decode())
        check_companion_cargo_config(config, packages)
        check_companion_rust(spools, inner, manifest["rust"], spec, receipt)
    linkage = closure["sdk_linkage"]
    evidence = runtime["shipped_elfs"]["ottplay-companion"]
    require(
        linkage["trace_available"] is True
        and linkage["elf_sha256"] == companion["elf_sha256"]
        and linkage["map_sha256"] == receipt["link_map_sha256"] == evidence["map_sha256"]
        and linkage["trace_sha256"] == receipt["link_trace_sha256"] == evidence["trace_sha256"]
        and linkage["receipt_sha256"] == receipt["link_receipt_sha256"] == evidence["link_receipt_sha256"]
        and closure["sdk_archive_sha256"]
        == receipt["sdk"]["archive_sha256"]
        == runtime["sdk_attestation"]["archive_sha256"],
        "Companion SDK/link evidence mismatch",
    )
    require(
        all(receipt["sdk"].get(key) == runtime["sdk_attestation"][key] for key in ("host", "version")),
        "Companion SDK host/version mismatch",
    )
    check_companion_compilers(linkage, evidence, receipt, runtime["sdk_attestation"])
    check_companion_link_inventory(evidence, link_streams, runtime["sdk_attestation"])


def check_native_rust_archives(evidence, link_streams):
    # Use the collector's pure parser, as for companion inputs. Public paths
    # are evidence identities; never resolve them or query a local toolchain.
    loader = importlib.util.spec_from_file_location("native_runtime_sources", ROOT / "scripts/webos-runtime-sources.py")
    runtime_sources = importlib.util.module_from_spec(loader)
    loader.loader.exec_module(runtime_sources)

    def lines(stream):
        stream.seek(0)
        while line := stream.readline(1024 * 1024 + 1):
            require(len(line) <= 1024 * 1024, "Native Rust archive linker line exceeds size limit")
            yield line

    observed = {path for path in runtime_sources.observed_archive_names(
        lines(link_streams[0]), lines(link_streams[1])) if path.endswith(".rlib")}
    if "native_rust_runtime" not in evidence:
        require(not observed, "Native Rust archive inputs have no binding")
        return
    binding = evidence["native_rust_runtime"]
    require(binding.get("sysroot") == "/build/native-rust", "Native Rust archive sysroot mismatch")
    inventory = binding.get("archives")
    require(isinstance(inventory, list) and 0 < len(inventory) <= FILE_COUNT_LIMIT,
            "Native Rust archive inventory missing or empty")
    declared = set()
    for row in inventory:
        require(isinstance(row, dict) and set(row) == {"path", "sha256", "bytes", "validation"},
                "Native Rust archive fields mismatch")
        path = row["path"]
        require(isinstance(path, str) and re.fullmatch(
                    r"/build/native-rust/lib/rustlib/armv7-unknown-linux-gnueabi/lib/"
                    r"libcompiler_builtins-[0-9a-f]{16}\.rlib", path)
                and path not in declared and type(row["bytes"]) is int and row["bytes"] > 0
                and row["validation"] == "collection-time",
                "Native Rust archive identity or validation scope mismatch")
        # These are collection-time observations, not historical link-time hashes.
        checksum(row["sha256"])
        declared.add(path)
    require(observed == declared, "Native Rust archive inventory differs from this ELF's linker inputs")


def check_runtime(path, metadata, source_set, primary, package_rows, upstream, package_content, native_rust):
    captures = {
        "RUNTIME-SOURCE-MANIFEST.json",
        "tools/webos-runtime-sources.json",
        "companion/source-closure.json",
        "companion/SOURCE-MANIFEST.json",
    }
    with ExitStack() as stack:
        native_elfs = sorted({PurePosixPath(path).name for path, row in package_rows.items()
                              if row.get("elf") and PurePosixPath(path).name != "ottplay-companion"})
        names = (
            "companion/companion-source.tar.gz",
            "evidence/ottplay-companion.link.map",
            "evidence/ottplay-companion.link.trace",
            *("evidence/" + elf + ".link." + role for elf in native_elfs for role in ("map", "trace")),
        )
        spools = {name: stack.enter_context(tempfile.TemporaryFile()) for name in names}
        rows, content = index_archive(path, captures, spools=spools)
        runtime = check_runtime_evidence(rows, content, metadata, source_set, primary, package_rows, upstream)
        for entry in runtime["shipped_elfs"].values():
            if "native_rust_runtime" not in entry:
                continue
            binding = entry["native_rust_runtime"]
            require(isinstance(binding, dict) and binding.get("source") == "rust-runtime"
                    and isinstance(binding.get("source_commit"), str)
                    and re.fullmatch(r"[0-9a-f]{40}", binding["source_commit"])
                    and binding["source_commit"] == native_rust["source_commit"],
                    "Native Rust runtime source binding mismatch")
            identity = binding.get("rustc")
            require(isinstance(identity, str)
                    and re.findall(r"^commit-hash: ([0-9a-f]{40})$", identity, re.MULTILINE)
                    == [binding["source_commit"]]
                    and (native_rust["channel"] is None
                         or re.findall(r"^release: (.+)$", identity, re.MULTILINE) == [native_rust["channel"]]),
                    "Native Rust runtime compiler binding mismatch")
        for elf in native_elfs:
            check_native_rust_archives(runtime["shipped_elfs"][elf],
                (spools["evidence/" + elf + ".link.map"], spools["evidence/" + elf + ".link.trace"]))
        if "ottplay-companion" in runtime["shipped_elfs"]:
            require("native_rust_runtime" not in runtime["shipped_elfs"]["ottplay-companion"],
                    "Native Rust archive binding cannot replace companion inventory")
        if "compilation" in metadata["build"]:
            archive = metadata["build"]["compilation"]["archive"]["path"].encode("utf-8")
            expected = {archive, b"/build/ottplay-native/" + archive}
            for label, stream in (("map", spools["evidence/plxnative.link.map"]),
                                  ("trace", spools["evidence/plxnative.link.trace"])):
                stream.seek(0)
                found = False
                while line := stream.readline(1024 * 1024 + 1):
                    require(len(line) <= 1024 * 1024, "Native linker evidence line exceeds size limit")
                    value = line.strip()
                    if label == "map":
                        if not value.startswith(b"LOAD "):
                            continue
                        value = value[5:].strip()
                    found |= value in expected
                require(found, "Native compilation archive missing from final " + label)
        check_companion(
            spools[names[0]],
            rows,
            content,
            metadata,
            runtime,
            package_rows,
            package_content,
            (spools[names[1]], spools[names[2]]),
        )


def check_runtime_evidence(rows, content, metadata, source_set, primary, package_rows, upstream):
    check_private_paths(rows, source=True)
    manifest = decode(content["RUNTIME-SOURCE-MANIFEST.json"])
    require(
        manifest["schema"] == 1
        and manifest["ipk"] == source_set["ipk"]
        and manifest["primary_source"] == primary
        and manifest["application_build"] == metadata["build"],
        "Runtime source binding mismatch",
    )
    for key in ("runtime_source_coverage", "link_evidence_binding"):
        require(manifest[key] == source_set[key] == "PASS", "Runtime evidence is incomplete: " + key)
    require(
        manifest["independent_rebuild"] == "NOT_RUN" and manifest["bit_identical_rebuild"] == "NOT_PROVEN",
        "Unsupported runtime rebuild claim",
    )
    elf_rows = {}
    for package_path, row in package_rows.items():
        if row.get("elf"):
            base = PurePosixPath(package_path).name
            require(base not in elf_rows, "Ambiguous packaged ELF basename")
            elf_rows[base] = row
    evidence = manifest["shipped_elfs"]
    require(elf_rows.keys() == evidence.keys(), "Runtime evidence does not cover every packaged ELF")
    for elf, row in elf_rows.items():
        entry = evidence[elf]
        require(
            entry["elf_sha256"] == row["sha256"] and entry.get("archive_excluded") is True,
            "Runtime ELF binding mismatch: " + elf,
        )
        for suffix in ("map", "trace"):
            recorded_file(rows, "evidence/" + elf + ".link." + suffix, entry["distributed_" + suffix + "_sha256"])
        require("evidence/" + elf + ".readelf.txt" in rows, "Missing runtime ELF inspection")
    spec = decode(content["tools/webos-runtime-sources.json"])
    sources = manifest["source_inputs"]
    require(len({row["id"] for row in sources}) == len(sources), "Duplicate runtime source")
    by_id = {row["id"]: row for row in sources}
    require(by_id.keys() == {row["id"] for row in spec["inputs"]}, "Runtime source set differs from its recipe")
    for item in spec["inputs"]:
        src = by_id[item["id"]]
        require(src["file"] == item["file"], "Runtime source filename mismatch")
        source_name = "sources/" + name(src["file"])
        recorded_file(rows, source_name, src["sha256"])
        for algorithm in ("sha256", "sha512"):
            if algorithm in item:
                require(rows[source_name][algorithm] == item[algorithm], "Runtime source recipe digest mismatch")
        require(rows[source_name]["bytes"] == src["bytes"], "Runtime source size mismatch")
        for license_name in item["licenses"]:
            require("licenses/" + item["id"] + "/" + member_name(license_name) in rows, "Runtime license missing")
    attestation = manifest["sdk_attestation"]
    sdk = upstream["sdk"]
    configured_host = metadata["build"]["configuration"].get("host")
    require(configured_host is None or configured_host == attestation["host"], "Native build host binding mismatch")
    require(
        attestation["version"] == sdk["version"]
        and attestation["runtime_archive_match"] == "PASS"
        and sdk["assets"].get(attestation["host"], {}).get("sha256") == attestation["archive_sha256"],
        "Runtime SDK attestation mismatch",
    )
    for entry in evidence.values():
        for item in entry["runtime_inputs"]:
            require(item["source"] in by_id, "Runtime input has no distributed source")
            checksum(attestation["runtime_files_sha256"].get(item["sdk_path"]))
    return manifest


def public_artifact_host(host):
    # Offline validation cannot establish DNS reachability, but can reject
    # explicitly local names and non-global IP literals without a resolver.
    if not host:
        return False
    host = host.rstrip(".").lower()
    if not host or host == "localhost" or host.endswith(".localhost") or "%" in host:
        return False
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        # Some URL clients interpret abbreviated, octal or hexadecimal IPv4.
        return not all(re.fullmatch(r"(?:0x[0-9a-f]+|[0-9]+)", part) for part in host.split("."))
    return address.is_global and not address.is_multicast


def artifact_url(value, expected):
    require(isinstance(value, str), "Missing Homebrew URL")
    parsed = urlsplit(value)
    require(
        parsed.scheme == "https"
        and public_artifact_host(parsed.hostname)
        and not parsed.username
        and not parsed.password
        and not parsed.query
        and not parsed.fragment,
        "Homebrew URLs must be public HTTPS artifact URLs",
    )
    require(unquote(parsed.path.rsplit("/", 1)[-1]) == expected, "Homebrew artifact URL filename mismatch")
    return parsed.scheme, parsed.netloc, parsed.path.rsplit("/", 1)[0]


def check_feed(directory, metadata, stem, require_feed):
    manifest_path = directory / "ottplay-native-webos-manifest.json"
    repository_path = directory / "ottplay-native-webos-repository.json"
    present = any(path.exists() or path.is_symlink() for path in (manifest_path, repository_path))
    if not present and not require_feed:
        return False
    manifest, repository = file_json(manifest_path), file_json(repository_path)
    for field in ("id", "title", "version"):
        require(manifest.get(field) == metadata["application"][field], "Homebrew identity mismatch")
    require(
        manifest.get("type") == "native"
        and manifest.get("rootRequired") is False
        and manifest.get("ipkHash") == {"sha256": metadata["sha256"]}
        and manifest.get("ipkSize") == metadata["size"]
        and manifest.get("installedSize") == metadata["payload_bytes"],
        "Homebrew package evidence mismatch",
    )
    download_base = artifact_url(manifest.get("ipkUrl"), stem + ".ipk")
    require(
        artifact_url(manifest.get("sourceUrl"), stem + "-source-set.json") == download_base,
        "Homebrew package and sources must use the same release directory",
    )
    metadata_base = artifact_url(manifest.get("iconUri"), "ottplay-native-webos-icon.png")
    urls = manifest.get("sourceArchiveUrls", [])
    require(isinstance(urls, list) and len(urls) == 2, "Homebrew must name both source archives")
    for url, suffix in zip(urls, ("-source.tar.gz", "-runtime-source.tar.gz")):
        require(artifact_url(url, stem + suffix) == download_base, "Homebrew source archive release directory mismatch")
    packages = repository.get("packages", [])
    require(len(packages) == 1, "Expected one native Homebrew package")
    row = packages[0]
    require(
        all(row.get(k) == manifest[k] for k in ("id", "title", "version", "iconUri")),
        "Homebrew repository entry mismatch",
    )
    require(
        artifact_url(row.get("manifestUrl"), manifest_path.name) == metadata_base,
        "Homebrew manifest and icon directory mismatch",
    )
    return True


def check_build_configuration(metadata, directory, stem, *, require_current=False):
    """Accept only the three published producer shapes; never execute evidence."""
    recorded = metadata["build"]
    config = recorded["configuration"]
    base = {"FLAVOR": "stable", "RELEASE": "1", "target": build.TARGET}
    require(isinstance(config, dict), "Native release configuration mismatch")
    keys = set(config)
    legacy = set(base)
    discovery = legacy | {"control_discovery"}
    compiled = discovery | {"ARM_PROFILE", "rust_opt_level", "symbols", "host"}
    require(keys in (legacy, discovery, compiled), "Native release configuration mismatch")
    require(not require_current or keys == compiled, "Current checkout requires native compilation evidence")
    require(all(config.get(key) == value for key, value in base.items()), "Native release configuration mismatch")
    if keys != legacy:
        profile = config["control_discovery"]
        require(isinstance(profile, dict), "Native control discovery configuration mismatch")
        require(type(profile.get("configured")) is bool, "Native control discovery configuration mismatch")
        expected = build.control_discovery_config.profile(profile.get("url"), profile.get("sha256"))
        require(profile == expected, "Native control discovery configuration mismatch")
    if keys != compiled:
        require("compilation" not in recorded, "Unexpected native compilation evidence")
        return
    require(config["ARM_PROFILE"] == "release" and config["rust_opt_level"] in ("2", "s")
            and config["symbols"] is False
            and config["host"] in ("darwin-arm64", "darwin-x86_64", "linux-aarch64"),
            "Native release configuration mismatch")
    evidence = recorded.get("compilation")
    require(isinstance(evidence, dict) and set(evidence) == {"cargo", "make", "archive"},
            "Native compilation evidence mismatch")
    archive = "rust-modules/target-release/" + build.TARGET + "/release/libplxnative_modules.a"
    require(isinstance(evidence["archive"], dict) and set(evidence["archive"]) == {"path", "sha256"}
            and evidence["archive"]["path"] == archive, "Native compilation archive mismatch")
    checksum(evidence["archive"]["sha256"])
    documents = {}
    for role, suffix, fields in (("cargo", "-cargo-artifacts.jsonl", {"file", "sha256", "artifact"}),
                                 ("make", "-build-config.txt", {"file", "sha256"})):
        item = evidence[role]
        require(isinstance(item, dict) and set(item) == fields and item["file"] == stem + suffix,
                "Native compilation evidence file mismatch")
        path = directory / item["file"]
        hash_file(path, item["sha256"], JSON_LIMIT)
        documents[role] = regular(path, JSON_LIMIT).read_bytes()
    rows = [decode(line) for line in documents["cargo"].splitlines() if line.strip()]
    require(rows and all(isinstance(row, dict) for row in rows), "Native Cargo evidence malformed")
    finished = [row for row in rows if row.get("reason") == "build-finished"]
    require(len(finished) == 1 and finished[0].get("success") is True and rows[-1] == finished[0],
            "Native Cargo evidence is not a completed build")
    artifacts = [row for row in rows if row.get("reason") == "compiler-artifact"
                 and isinstance(row.get("target"), dict) and row["target"].get("name") == "plxnative_modules"]
    require(len(artifacts) == 1 and artifacts[0] == evidence["cargo"]["artifact"],
            "Native Cargo artifact binding mismatch")
    artifact = artifacts[0]
    manifest = artifact.get("manifest_path")
    require(isinstance(manifest, str) and manifest.endswith("/rust-modules/Cargo.toml")
            and PurePosixPath(manifest).is_absolute() and PurePosixPath(manifest).as_posix() == manifest
            and ".." not in PurePosixPath(manifest).parts and "\\" not in manifest
            and all(ord(char) >= 32 and ord(char) != 127 for char in manifest),
            "Native Cargo source path mismatch")
    root = manifest.removesuffix("/rust-modules/Cargo.toml")
    target = artifact["target"]
    profile = artifact.get("profile")
    expected = {"opt_level": config["rust_opt_level"], "debuginfo": 0,
                "debug_assertions": False, "overflow_checks": False, "test": False}
    require(isinstance(profile, dict) and all(type(profile.get(key)) is type(value)
            and profile[key] == value for key, value in expected.items())
            and target.get("src_path") == root + "/rust-modules/src/lib.rs"
            and target.get("kind") == ["staticlib"] and target.get("crate_types") == ["staticlib"]
            and artifact.get("features") == [] and artifact.get("filenames") == [root + "/" + archive],
            "Native Cargo release profile/path mismatch")
    settings = {}
    for line in documents["make"].decode("utf-8").splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            require(key not in settings, "Duplicate native Make configuration")
            settings[key] = value
    expected_make = {"RUST_TDIR": "target-release", "RUST_TARGET": build.TARGET,
                     "ARM_PROFILE": "release", "ARM_PROFILE_FLAG": "--release", "RUST_LIB": archive,
                     "RUST_FEATFLAGS": "--no-default-features", "RUST_TOOLCHAIN": recorded["rust_toolchain"]}
    require(all(settings.get(key) == value for key, value in expected_make.items()),
            "Native Make configuration mismatch")


def verify(metadata_path, *, require_feed=False, check_checkout=False):
    metadata_path = Path(metadata_path)
    metadata = file_json(metadata_path)
    directory, app = metadata_path.parent, metadata["application"]
    require(
        app.get("id") == APP_ID
        and isinstance(app.get("version"), str)
        and re.fullmatch(r"\d+\.\d+\.\d+", app["version"]),
        "Invalid native application identity",
    )
    stem = "ottplay-native-webos-" + app["version"]
    require(metadata_path.name == stem + ".json", "Metadata filename/version mismatch")
    require(
        metadata.get("device_validation") == "not_performed", "Unsupported device validation claim in build metadata"
    )
    check_build_configuration(metadata, directory, stem, require_current=check_checkout)
    require(
        metadata["build"]["ipk_sha256"] == metadata["sha256"]
        and metadata["build"]["revision"] == metadata["upstream"]["revision"]
        and metadata["build"]["integration_sha256"] == checksum(metadata["integration_sha256"]),
        "Build receipt binding mismatch",
    )
    require(
        re.fullmatch(r"[0-9a-f]{40}", metadata["upstream"]["revision"])
        and re.fullmatch(r"[0-9a-f]{40}", metadata["build"]["tree"]),
        "Invalid source build identity",
    )
    checksum(metadata["build"]["sdk_compiler_sha256"])
    ipk = directory / (stem + ".ipk")
    hash_file(ipk, metadata["sha256"], IPK_LIMIT)
    sum_path = regular(directory / (stem + ".sha256"), JSON_LIMIT)
    require(sum_path.read_text() == metadata["sha256"] + "  " + ipk.name + "\n", "Package checksum file mismatch")
    package_rows, descriptor, package_content = check_package(ipk, metadata)
    icon = directory / "ottplay-native-webos-icon.png"
    hash_file(icon, package_rows["usr/palm/applications/" + APP_ID + "/" + descriptor["icon"]]["sha256"], JSON_LIMIT)
    corresponding = metadata["corresponding_source"]
    require(
        name(corresponding["file"]) == stem + "-source.tar.gz"
        and corresponding["rebuild_validation"] == "not_performed",
        "Primary source declaration mismatch",
    )
    primary_path = directory / corresponding["file"]
    hash_file(primary_path, corresponding["sha256"])
    primary = {k: corresponding[k] for k in ("file", "sha256", "snapshot_sha256")}
    source_set = file_json(directory / (stem + "-source-set.json"))
    require(
        source_set.get("schema") == 1
        and source_set["ipk"] == {"file": ipk.name, "sha256": metadata["sha256"]}
        and source_set["independent_rebuild"] == "NOT_RUN",
        "Source set package/rebuild mismatch",
    )
    archives = source_set["source_archives"]
    require(
        isinstance(archives, list)
        and len(archives) == 2
        and archives[0] == primary
        and name(archives[1]["file"]) == stem + "-runtime-source.tar.gz",
        "Source archive set mismatch",
    )
    runtime_path = directory / archives[1]["file"]
    hash_file(runtime_path, archives[1]["sha256"])
    receipt = file_json(directory / (primary_path.name + ".release.json"))
    require(
        receipt.get("schema") == 1
        and receipt["source_archive_sha256"] == corresponding["sha256"]
        and receipt["binaries"] == {ipk.name: {"sha256": metadata["sha256"]}}
        and receipt["correspondence_status"] == "NOT_PROVEN"
        and receipt["rebuild_status"] == "NOT_RUN",
        "Primary release receipt mismatch",
    )
    upstream, native_rust = check_primary(primary_path, metadata, receipt, package_rows, descriptor)
    check_runtime(runtime_path, metadata, source_set, primary, package_rows, upstream, package_content, native_rust)
    feed = check_feed(directory, metadata, stem, require_feed)
    if check_checkout:
        current = build.manifest()
        require(
            current["application"] == app
            and current["revision"] == metadata["upstream"]["revision"]
            and build.integration_digest() == metadata["integration_sha256"],
            "Release does not match current checkout",
        )
    return {
        "bundle_validation": "PASS",
        "application": app,
        "ipk_sha256": metadata["sha256"],
        "source_archive_sha256": corresponding["sha256"],
        "homebrew_validated": feed,
        "checkout_validated": check_checkout,
        "independent_rebuild": "NOT_RUN",
        "binary_correspondence": "NOT_PROVEN",
        "device_validation": "not_performed",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--metadata", required=True, type=Path)
    parser.add_argument("--require-feed", action="store_true", help="Require and validate both Homebrew JSON documents")
    parser.add_argument(
        "--check-checkout", action="store_true", help="Also require the current integration pin and overlay digest"
    )
    args = parser.parse_args()
    try:
        result = verify(args.metadata, require_feed=args.require_feed, check_checkout=args.check_checkout)
    except (
        ValueError,
        KeyError,
        TypeError,
        AttributeError,
        OSError,
        EOFError,
        RecursionError,
        tarfile.TarError,
        lzma.LZMAError,
    ) as error:
        print("FAIL: " + str(error), file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
