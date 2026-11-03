#!/usr/bin/env python3
"""Verify a downloaded native webOS release bundle without building or installing.

This checks the consistency of bytes and recorded evidence, not the authenticity
of the publisher, an independent rebuild, or playback on a television. Nothing
from a source archive is extracted or executed.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import importlib.util
import io
import ipaddress
import json
import re
import sys
import tarfile
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit

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


def index_archive(source, captures=(), *, total_limit=EXPANDED_LIMIT, regular_only=True):
    """Index a tar in bounded memory, hashing each member as it is consumed."""
    rows, content, total, captured = {}, {}, 0, 0
    kwargs = {"fileobj": source} if hasattr(source, "read") else {"filename": source}
    # tarfile's streaming gzip reader does not validate CRC/ISIZE. Let gzip
    # validate the complete compressed stream, including after the tar EOF.
    with (
        gzip.GzipFile(mode="rb", **kwargs) as decoded,
        tarfile.open(fileobj=decoded, mode="r|", tarinfo=BoundedTarInfo) as archive,
    ):
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
            stream = archive.extractfile(item)
            while block := stream.read(1024 * 1024):
                count += len(block)
                require(count <= item.size, "Archive member size mismatch")
                h.update(block)
                h512.update(block)
                if len(prefix) < 52:
                    prefix += block[: 52 - len(prefix)]
                if keep:
                    parts.append(block)
            require(count == item.size, "Truncated archive member")
            rows[key] = {
                "sha256": h.hexdigest(),
                "sha512": h512.hexdigest(),
                "mode": item.mode,
                "bytes": item.size,
                "elf": prefix.startswith(b"\x7fELF"),
                "arm": build.elf_arm(prefix),
                "png": prefix.startswith(b"\x89PNG\r\n\x1a\n")
                and prefix[12:16] == b"IHDR"
                and len(prefix) >= 24
                and 0 < int.from_bytes(prefix[16:20], "big") <= 16384
                and 0 < int.from_bytes(prefix[20:24], "big") <= 16384,
            }
            if keep:
                content[key] = b"".join(parts)
        # Drain through the tar reader so already-buffered bytes are checked
        # too. Only bounded zero record padding may follow the tar end marker.
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
    captures = {prefix + "appinfo.json"}
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
    descriptor = decode(content[prefix + "appinfo.json"])
    for key in ("icon", "largeIcon", "splashBackground"):
        asset = prefix + member_name(descriptor.get(key))
        require(asset in rows and rows[asset].get("png"), "Packaged PNG artwork missing or invalid: " + key)
    return rows, descriptor


def check_primary(path, metadata, receipt, package_rows, descriptor):
    captures = {
        "SOURCE-MANIFEST.json",
        "ci/dependencies.json",
        "ci/ottplay-integration/upstream.json",
        "ci/ottplay-integration/PROVENANCE.json",
        "pkg/appinfo.json",
    }
    rows, content = index_archive(path, lambda key: key in captures or key.startswith(INTEGRATION_PREFIX))
    check_private_paths(rows, source=True)
    manifest = decode(content["SOURCE-MANIFEST.json"])
    require(
        manifest.get("schema") == 1 and manifest.get("license") == "GPL-3.0-or-later", "Source schema/license mismatch"
    )
    environment = manifest["build_environment"]
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
    actual_names = {key.removeprefix(INTEGRATION_PREFIX) for key in rows if key.startswith(INTEGRATION_PREFIX)}
    require(actual_names == integration_names | {"PROVENANCE.json"}, "Embedded integration file set mismatch")
    integration_hash = hashlib.sha256()
    for key in sorted(integration_names):
        integration_hash.update(key.encode() + b"\0")
        integration_hash.update(content[INTEGRATION_PREFIX + key])
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
    return upstream


def check_runtime(path, metadata, source_set, primary, package_rows, upstream):
    captures = {"RUNTIME-SOURCE-MANIFEST.json", "tools/webos-runtime-sources.json"}
    rows, content = index_archive(path, captures)
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


def public_artifact_host(host):
    # Offline checks cannot prove DNS reachability, but must reject explicitly
    # local names and non-global IP literals without querying any resolver.
    if not host:
        return False
    host = host.rstrip(".").lower()
    if not host or host == "localhost" or host.endswith(".localhost") or "%" in host:
        return False
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        # URL clients can interpret legacy numeric forms (127.1, 2130706433,
        # 0x7f000001, 0177.0.0.1) as IPv4. Do not mistake those for DNS names.
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
    require(
        metadata["build"]["configuration"] == {"FLAVOR": "stable", "RELEASE": "1", "target": build.TARGET},
        "Native release configuration mismatch",
    )
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
    package_rows, descriptor = check_package(ipk, metadata)
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
    upstream = check_primary(primary_path, metadata, receipt, package_rows, descriptor)
    check_runtime(runtime_path, metadata, source_set, primary, package_rows, upstream)
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
    ) as error:
        print("FAIL: " + str(error), file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
