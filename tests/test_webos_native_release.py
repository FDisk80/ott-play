"""Offline native release checks exercise real archives, never a toolchain or TV."""

import base64
import gzip
import hashlib
import importlib.util
import io
import json
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/verify-webos-native-release.py"
SPEC = importlib.util.spec_from_file_location("native_release", SCRIPT)
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)


def encoded(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def digest(value):
    return hashlib.sha256(value).hexdigest()


def tar_bytes(files, modes=None, extra=None):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:gz") as archive:
        for name, data in files.items():
            item = tarfile.TarInfo(name)
            item.size = len(data)
            item.mode = (modes or {}).get(name, 0o644)
            archive.addfile(item, io.BytesIO(data))
        if extra:
            archive.addfile(extra)
    return output.getvalue()


def pax_bytes(headers, *, global_header=False, data=b"fixture"):
    output = io.BytesIO()
    with tarfile.open(
        fileobj=output, mode="w:gz", format=tarfile.PAX_FORMAT, pax_headers=headers if global_header else None
    ) as archive:
        item = tarfile.TarInfo("fixture")
        item.size, item.mode = len(data), 0o644
        if not global_header:
            item.pax_headers = headers
        archive.addfile(item, io.BytesIO(data))
    return output.getvalue()


def ar_bytes(files):
    output = bytearray(b"!<arch>\n")
    for name, value in files.items():
        output.extend((f"{name + '/':<16}{0:<12}{0:<6}{0:<6}{'100644':<8}{len(value):<10}`\n").encode())
        output.extend(value)
        if len(value) % 2:
            output.extend(b"\n")
    return bytes(output)


class Bundle:
    """Small internally coherent release, with real IPK/tar and hash receipts."""

    def __init__(self, root):
        self.root = root
        self.stem = "ottplay-native-webos-0.1.0"
        self.metadata_path = root / (self.stem + ".json")
        self.app = {"id": release.APP_ID, "title": "OTTPlay Native", "version": "0.1.0", "channel": "experimental"}
        self.prefix = "usr/palm/applications/" + release.APP_ID + "/"
        service_id = release.APP_ID + ".storage"
        self.service = "usr/palm/services/" + service_id + "/"
        self.descriptor = dict(
            self.app,
            type="native",
            main="plxnative",
            icon="icon.png",
            largeIcon="largeIcon.png",
            splashBackground="splash.png",
        )
        binary = bytearray(52)
        binary[:6] = b"\x7fELF\x01\x01"
        binary[18:20] = (40).to_bytes(2, "little")
        png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII="
        )
        license_text = (release.ROOT / "native/webos/COPYING").read_bytes()
        self.package = {
            self.prefix + "appinfo.json": encoded(self.descriptor),
            self.prefix + "plxnative": bytes(binary),
            self.prefix + "libavformat-fixture.so": bytes(binary),
            self.prefix + "licenses/LICENSE": license_text,
            self.prefix + "THIRD-PARTY-NOTICES.md": b"Fixture notices",
            self.service + "plxnative-storage": bytes(binary),
            self.service + "services.json": encoded(
                {
                    "id": service_id,
                    "engine": "native",
                    "executable": "plxnative-storage",
                    "services": [{"name": service_id, "commands": []}],
                }
            ),
            "usr/palm/packages/" + release.APP_ID + "/packageinfo.json": encoded(
                {
                    "id": release.APP_ID,
                    "app": release.APP_ID,
                    "version": "0.1.0",
                    "services": [service_id],
                    "package_format_version": 2,
                    "requiredPermissions": ["database.operation", "securitykey.operation"],
                }
            ),
        }
        self.package.update({self.prefix + name: png for name in ("icon.png", "largeIcon.png", "splash.png")})
        self.modes = {self.prefix + "plxnative": 0o755, self.service + "plxnative-storage": 0o755}
        self.controls = {
            "control": (
                "Package: " + release.APP_ID + "\nVersion: 0.1.0\nLicense: GPL-3.0-or-later\n"
                "Architecture: arm\nwebOS-Package-Format-Version: 2\n"
            ).encode()
        }
        self.upstream = {
            "application": self.app,
            "revision": "a" * 40,
            "repository": "https://example.test/upstream.git",
            "sdk": {"version": "fixture-sdk", "assets": {"test": {"sha256": "b" * 64}}},
        }
        self.source = {
            "LICENSE": license_text,
            "LICENSING.md": b"Fixture licensing",
            "THIRD-PARTY-NOTICES.md": b"Fixture notices",
            "Makefile": b"all:\n\t@false\n",
            "rust-modules/Cargo.toml": b"# Fixture",
            "rust-modules/Cargo.lock": b"# Fixture",
            "pkg/appinfo.json": encoded(self.descriptor),
            "ci/dependencies.json": encoded([{"id": "ffmpeg", "bundled": True}]),
            "ci/ottplay-integration/upstream.json": encoded(self.upstream),
            "ci/ottplay-integration/patches/0001-fixture.patch": b"fixture patch",
            "ci/ottplay-integration/PROVENANCE.json": encoded(
                {
                    "revision": "a" * 40,
                    "integration_sha256": "c" * 64,
                    "patches": {"0001-fixture.patch": digest(b"fixture patch")},
                }
            ),
        }
        for filename in ("build.py", "README.md", "test_build.py"):
            self.source[release.INTEGRATION_PREFIX + filename] = ("fixture " + filename).encode()
        self.source[release.INTEGRATION_PREFIX + "COPYING"] = license_text
        integration = hashlib.sha256()
        for filename in sorted(release.INTEGRATION_FILES | {"patches/0001-fixture.patch"}):
            integration.update(filename.encode() + b"\0")
            integration.update(self.source[release.INTEGRATION_PREFIX + filename])
        self.integration_hash = integration.hexdigest()
        provenance_path = release.INTEGRATION_PREFIX + "PROVENANCE.json"
        provenance = json.loads(self.source[provenance_path])
        provenance["integration_sha256"] = self.integration_hash
        self.source[provenance_path] = encoded(provenance)
        for filename in ("icon.png", "largeIcon.png", "splash.png"):
            self.source["pkg/" + filename] = png
        self.source_manifest = {
            "schema": 1,
            "license": "GPL-3.0-or-later",
            "git_commit": "a" * 40,
            "dependencies": [],
            "rebuild_status": "NOT_RUN",
            "build_environment": {
                "rust_target": release.build.TARGET,
                "ndk": {"gcc_sha256": "f" * 64},
                "configuration": {"FLAVOR": "stable", "RELEASE": "1"},
            },
        }
        for dep in ("ffmpeg", "cargo-vendor", "rust-runtime"):
            path = "sources/" + dep + ".tar.gz"
            self.source[path] = tar_bytes({"LICENSE": b"Fixture source license", "source": dep.encode()})
            self.source_manifest["dependencies"].append(
                {"id": dep, "sources": [{"path": path, "sha256": digest(self.source[path])}]}
            )
        self.source_manifest["files"] = {
            name: {"sha256": digest(value), "mode": 0o644} for name, value in self.source.items()
        }
        self.source_manifest["snapshot_sha256"] = digest(encoded(self.source_manifest["files"]))
        self.source["SOURCE-MANIFEST.json"] = encoded(self.source_manifest)
        self.runtime = {}
        runtime_recipe = {"schema": 1, "inputs": []}
        source_inputs = []
        for dep in ("gcc-runtime", "glibc-runtime", "buildroot-recipes"):
            filename = dep + ".tar.gz"
            data = tar_bytes({"COPYING": b"fixture", "code": dep.encode()})
            self.runtime["sources/" + filename] = data
            self.runtime["licenses/" + dep + "/COPYING"] = b"fixture"
            item = {"id": dep, "file": filename, "licenses": ["COPYING"], "sha256": digest(data)}
            runtime_recipe["inputs"].append(item)
            source_inputs.append(dict(item, bytes=len(data)))
        self.runtime["tools/webos-runtime-sources.json"] = encoded(runtime_recipe)
        self.runtime_manifest = {
            "schema": 1,
            "source_inputs": source_inputs,
            "runtime_source_coverage": "PASS",
            "link_evidence_binding": "PASS",
            "independent_rebuild": "NOT_RUN",
            "bit_identical_rebuild": "NOT_PROVEN",
            "sdk_attestation": {
                "version": "fixture-sdk",
                "host": "test",
                "archive_sha256": "b" * 64,
                "runtime_archive_match": "PASS",
                "runtime_files_sha256": {"lib/libgcc.a": "d" * 64},
            },
            "shipped_elfs": {},
        }
        for path, value in self.package.items():
            if value.startswith(b"\x7fELF"):
                elf = Path(path).name
                entry = {
                    "elf_sha256": digest(value),
                    "archive_excluded": True,
                    "runtime_inputs": [{"source": "gcc-runtime", "sdk_path": "lib/libgcc.a"}],
                }
                for suffix in ("map", "trace"):
                    data = ("fixture " + elf + suffix).encode()
                    self.runtime["evidence/" + elf + ".link." + suffix] = data
                    entry["distributed_" + suffix + "_sha256"] = digest(data)
                self.runtime["evidence/" + elf + ".readelf.txt"] = b"fixture ELF inspection"
                self.runtime_manifest["shipped_elfs"][elf] = entry
        self.metadata = {
            "application": self.app,
            "architecture": "arm",
            "type": "native",
            "rootRequired": False,
            "device_validation": "not_performed",
            "integration_sha256": self.integration_hash,
            "upstream": {key: self.upstream[key] for key in ("repository", "revision")},
            "build": {
                "revision": "a" * 40,
                "tree": "e" * 40,
                "integration_sha256": self.integration_hash,
                "sdk_compiler_sha256": "f" * 64,
                "rust_toolchain": "fixture",
                "configuration": {"FLAVOR": "stable", "RELEASE": "1", "target": release.build.TARGET},
            },
        }
        self.write()

    def write(self, *, source_extra=None, package_extra=None):
        """Refresh outer receipts after mutation, leaving inner evidence untouched."""
        ipk = ar_bytes(
            {
                "debian-binary": b"2.0\n",
                "control.tar.gz": tar_bytes(self.controls),
                "data.tar.gz": tar_bytes(self.package, self.modes, package_extra),
            }
        )
        self.metadata.update(sha256=digest(ipk), size=len(ipk), payload_bytes=sum(map(len, self.package.values())))
        self.metadata["build"]["ipk_sha256"] = digest(ipk)
        self.ipk_path = self.root / (self.stem + ".ipk")
        self.ipk_path.write_bytes(ipk)
        (self.root / (self.stem + ".sha256")).write_text(digest(ipk) + "  " + self.ipk_path.name + "\n")
        (self.root / "ottplay-native-webos-icon.png").write_bytes(self.package[self.prefix + "icon.png"])
        primary = tar_bytes(self.source, extra=source_extra)
        self.primary_path = self.root / (self.stem + "-source.tar.gz")
        self.primary_path.write_bytes(primary)
        source_row = {
            "file": self.primary_path.name,
            "sha256": digest(primary),
            "snapshot_sha256": self.source_manifest["snapshot_sha256"],
        }
        self.metadata["corresponding_source"] = dict(source_row, rebuild_validation="not_performed")
        self.runtime_manifest.update(
            ipk={"file": self.ipk_path.name, "sha256": digest(ipk)},
            primary_source=source_row,
            application_build=self.metadata["build"],
        )
        self.runtime["RUNTIME-SOURCE-MANIFEST.json"] = encoded(self.runtime_manifest)
        runtime = tar_bytes(self.runtime)
        self.runtime_path = self.root / (self.stem + "-runtime-source.tar.gz")
        self.runtime_path.write_bytes(runtime)
        self.source_set = {
            "schema": 1,
            "ipk": {"file": self.ipk_path.name, "sha256": digest(ipk)},
            "runtime_source_coverage": "PASS",
            "link_evidence_binding": "PASS",
            "independent_rebuild": "NOT_RUN",
            "source_archives": [source_row, {"file": self.runtime_path.name, "sha256": digest(runtime)}],
        }
        (self.root / (self.stem + "-source-set.json")).write_bytes(encoded(self.source_set))
        receipt = {
            "schema": 1,
            "source_archive_sha256": digest(primary),
            "source_snapshot_sha256": source_row["snapshot_sha256"],
            "binaries": {self.ipk_path.name: {"sha256": digest(ipk)}},
            "correspondence_status": "NOT_PROVEN",
            "rebuild_status": "NOT_RUN",
        }
        (self.root / (self.primary_path.name + ".release.json")).write_bytes(encoded(receipt))
        self.save_metadata()

    def save_metadata(self):
        self.metadata_path.write_bytes(encoded(self.metadata))

    def feed(self):
        base = "https://example.test/native/"
        manifest = {key: self.app[key] for key in ("id", "title", "version")}
        manifest.update(
            type="native",
            rootRequired=False,
            ipkHash={"sha256": self.metadata["sha256"]},
            ipkSize=self.metadata["size"],
            installedSize=self.metadata["payload_bytes"],
            ipkUrl=base + self.ipk_path.name,
            sourceUrl=base + self.stem + "-source-set.json",
            iconUri=base + "ottplay-native-webos-icon.png",
            sourceArchiveUrls=[base + self.primary_path.name, base + self.runtime_path.name],
        )
        path = self.root / "ottplay-native-webos-manifest.json"
        path.write_bytes(encoded(manifest))
        row = {key: manifest[key] for key in ("id", "title", "version", "iconUri")}
        row["manifestUrl"] = base + path.name
        (self.root / "ottplay-native-webos-repository.json").write_bytes(encoded({"packages": [row]}))
        return manifest


class NativeReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.bundle = Bundle(Path(self.temporary.name))

    def verify(self, **kwargs):
        return release.verify(self.bundle.metadata_path, **kwargs)

    def fails(self, message):
        with self.assertRaisesRegex((ValueError, KeyError), message):
            self.verify()

    def test_valid_bundle_is_evidence_check_not_rebuild_or_device_validation(self):
        result = self.verify()
        self.assertEqual(result["bundle_validation"], "PASS")
        self.assertEqual(result["independent_rebuild"], "NOT_RUN")
        self.assertEqual(result["binary_correspondence"], "NOT_PROVEN")
        self.assertEqual(result["device_validation"], "not_performed")
        self.assertFalse(result["homebrew_validated"])

    def test_valid_optional_homebrew_pair(self):
        self.bundle.feed()
        self.assertTrue(self.verify(require_feed=True)["homebrew_validated"])

    def test_missing_required_feed_and_one_missing_pair_member(self):
        with self.assertRaisesRegex(ValueError, "Missing"):
            self.verify(require_feed=True)
        self.bundle.feed()
        (self.bundle.root / "ottplay-native-webos-repository.json").unlink()
        self.fails("Missing")

    def test_wrong_feed_version_hash_and_url_are_rejected(self):
        for key, value in (
            ("version", "9.9.9"),
            ("ipkHash", {"sha256": "0" * 64}),
            ("ipkUrl", "https://example.test/other.ipk"),
            ("iconUri", "http://example.test/icon.png"),
        ):
            with self.subTest(field=key):
                feed = self.bundle.feed()
                feed[key] = value
                (self.bundle.root / "ottplay-native-webos-manifest.json").write_bytes(encoded(feed))
                self.fails("Homebrew")

    def test_cli_runs_without_external_commands_or_source_checkout(self):
        process = subprocess.run(
            [sys.executable, str(SCRIPT), "--metadata", str(self.bundle.metadata_path)],
            capture_output=True,
            text=True,
            timeout=10,
            cwd=self.bundle.root,
            check=False,
        )
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertEqual(json.loads(process.stdout)["bundle_validation"], "PASS")

    def test_corrupt_outer_artifacts(self):
        for path in (self.bundle.ipk_path, self.bundle.primary_path, self.bundle.runtime_path):
            with self.subTest(file=path.name):
                old = path.read_bytes()
                path.write_bytes(old + b"tampered")
                self.fails("digest mismatch")
                path.write_bytes(old)

    def test_checksum_receipt_is_required_and_exact(self):
        (self.bundle.root / (self.bundle.stem + ".sha256")).write_text("0" * 64 + "  other.ipk\n")
        self.fails("checksum file")

    def test_source_member_tampering_even_with_updated_outer_hash(self):
        self.bundle.source["Makefile"] += b"tampered"
        self.bundle.write()
        self.fails("Source file set/hash/mode")

    def test_missing_source_is_rejected(self):
        del self.bundle.source["rust-modules/Cargo.lock"]
        self.bundle.write()
        self.fails("Source file set/hash/mode")

    def test_runtime_evidence_and_source_tampering_with_updated_outer_hash(self):
        for path in ("evidence/plxnative.link.map", "sources/gcc-runtime.tar.gz"):
            with self.subTest(file=path):
                old = self.bundle.runtime[path]
                self.bundle.runtime[path] += b"changed"
                self.bundle.write()
                self.fails("Source member digest mismatch")
                self.bundle.runtime[path] = old

    def test_missing_elf_evidence_is_rejected(self):
        del self.bundle.runtime_manifest["shipped_elfs"]["plxnative"]
        self.bundle.write()
        self.fails("every packaged ELF")

    def test_wrong_sdk_attestation(self):
        self.bundle.runtime_manifest["sdk_attestation"]["archive_sha256"] = "0" * 64
        self.bundle.write()
        self.fails("SDK attestation")

    def test_private_runtime_files_cannot_enter_package(self):
        for name in (
            "ottplay-control.json",
            "ottplay-profile.json",
            "ott-state.json",
            "ott-state/record",
            "session.json",
            "consent.json",
            "state.json",
            "rendezvous.json",
            "storage.sock",
        ):
            with self.subTest(name=name):
                path = self.bundle.prefix + name
                self.bundle.package[path] = b"private fixture"
                self.bundle.write()
                self.fails("Private configuration/state")
                del self.bundle.package[path]

    def test_invalid_artwork_is_rejected(self):
        self.bundle.package[self.bundle.prefix + "splash.png"] = b"not png"
        self.bundle.write()
        self.fails("PNG artwork")

    def test_distributed_icon_matches_actual_package(self):
        (self.bundle.root / "ottplay-native-webos-icon.png").write_bytes(b"another icon")
        self.fails("digest mismatch")

    def test_main_and_service_are_executable_but_shared_library_may_be_644(self):
        self.verify()
        for path in (self.bundle.prefix + "plxnative", self.bundle.service + "plxnative-storage"):
            with self.subTest(path=path):
                self.bundle.modes[path] = 0o644
                self.bundle.write()
                self.fails("executable permissions")
                self.bundle.modes[path] = 0o755

    def test_source_path_escape_and_duplicate_are_rejected(self):
        for name in ("../escaped", "/absolute", "a\\b", "./Makefile"):
            with self.subTest(name=name):
                self.bundle.source[name] = b"fixture"
                self.bundle.write()
                self.fails("Unsafe archive member|Duplicate archive member")
                del self.bundle.source[name]

    def test_source_symlink_is_never_followed(self):
        link = tarfile.TarInfo("escape")
        link.type, link.linkname = tarfile.SYMTYPE, "/etc/passwd"
        self.bundle.write(source_extra=link)
        self.fails("Nonregular archive")

    def test_package_symlink_is_rejected(self):
        link = tarfile.TarInfo(self.bundle.prefix + "linked")
        link.type, link.linkname = tarfile.SYMTYPE, "/etc/passwd"
        self.bundle.write(package_extra=link)
        self.fails("Nonregular archive")

    def test_top_level_symlink_and_reference_escape_are_rejected(self):
        path = self.bundle.primary_path
        old = path.with_suffix(".saved")
        path.rename(old)
        path.symlink_to(old)
        self.fails("nonregular artifact")
        path.unlink()
        old.rename(path)
        self.bundle.metadata["corresponding_source"]["file"] = "../outside.tar.gz"
        self.bundle.save_metadata()
        self.fails("safe filename")

    def test_broken_optional_feed_symlink_is_not_silently_ignored(self):
        (self.bundle.root / "ottplay-native-webos-manifest.json").symlink_to("absent")
        self.fails("nonregular artifact")

    def test_bounded_compressed_and_expanded_input(self):
        with patch.object(release, "IPK_LIMIT", 10):
            self.fails("size limit")
        with self.assertRaisesRegex(ValueError, "size limit"):
            release.index_archive(io.BytesIO(tar_bytes({"large": b"x" * 1024})), total_limit=100)

    def test_gzip_trailer_and_trailing_garbage_are_checked(self):
        raw = tar_bytes({"fixture": b"small archive"})
        bad_crc = bytearray(raw)
        bad_crc[-8] ^= 1
        bad_size = bytearray(raw)
        bad_size[-4] ^= 1
        variants = {"crc": bad_crc, "isize": bad_size, "truncated": raw[:-1], "garbage": raw + b"garbage"}
        for label, data in variants.items():
            with self.subTest(label=label), self.assertRaises((OSError, EOFError, tarfile.TarError, ValueError)):
                release.index_archive(io.BytesIO(data))

    def test_tar_end_cannot_hide_data_or_unbounded_padding(self):
        raw = gzip.decompress(tar_bytes({"fixture": b"small archive"}))
        variants = {
            "nonzero": gzip.compress(raw + b"hidden payload"),
            "extra member": gzip.compress(raw) + gzip.compress(b"hidden payload"),
            "padding": gzip.compress(raw + bytes(tarfile.RECORDSIZE * 2)),
        }
        for label, data in variants.items():
            with self.subTest(label=label), self.assertRaisesRegex(ValueError, "archive trailer"):
                release.index_archive(io.BytesIO(data))

    def test_gzip_members_may_split_one_valid_tar_stream(self):
        raw = gzip.decompress(tar_bytes({"fixture": b"small archive"}))
        stream = io.BytesIO(gzip.compress(raw[:700]) + gzip.compress(raw[700:]))
        rows, content = release.index_archive(stream, captures={"fixture"})
        self.assertEqual(set(rows), {"fixture"})
        self.assertEqual(content, {"fixture": b"small archive"})
        self.assertFalse(stream.closed)

    def test_pax_header_size_is_bounded_before_read(self):
        item = tarfile.TarInfo("././@PaxHeader")
        item.type, item.size = tarfile.XHDTYPE, release.JSON_LIMIT + 1
        archive = gzip.compress(item.tobuf())
        with self.assertRaisesRegex(ValueError, "header exceeds size limit"):
            release.index_archive(io.BytesIO(archive))

    def test_sparse_pax_variants_are_rejected_before_stdlib_sparse_parser(self):
        variants = (
            (
                "00",
                {
                    "GNU.sparse.size": "1",
                    "GNU.sparse.numblocks": "1",
                    "GNU.sparse.offset": "0",
                    "GNU.sparse.numbytes": "1",
                },
            ),
            ("01", {"GNU.sparse.map": "0,1", "GNU.sparse.size": "1"}),
            ("10", {"GNU.sparse.major": "1", "GNU.sparse.minor": "0", "GNU.sparse.realsize": "1"}),
        )
        for version, headers in variants:
            for global_header in (False, True):
                with self.subTest(version=version, global_header=global_header):
                    # Tiny payload only. The mocked parser raises before any
                    # attempted allocation even if early rejection regresses.
                    raw = pax_bytes(headers, global_header=global_header, data=b"999999999999999999999\n")
                    self.assertLess(len(raw), 1024)
                    with (
                        patch.object(
                            tarfile.TarInfo,
                            "_proc_gnusparse_" + version,
                            side_effect=AssertionError("stdlib sparse parser must not run"),
                        ) as parser,
                        self.assertRaisesRegex(ValueError, "Sparse archive entries are unsupported"),
                    ):
                        release.index_archive(io.BytesIO(raw))
                    parser.assert_not_called()

    def test_unknown_and_incomplete_sparse_pax_metadata_are_rejected(self):
        for headers in ({"GNU.sparse.realsize": "1"}, {"GNU.sparse.future": "fixture"}):
            for global_header in (False, True):
                with self.subTest(headers=headers, global_header=global_header):
                    raw = pax_bytes(headers, global_header=global_header)
                    with self.assertRaisesRegex(ValueError, "Sparse archive entries are unsupported"):
                        release.index_archive(io.BytesIO(raw))

    def test_ordinary_local_and_global_pax_metadata_still_work(self):
        path = "directory/" + "x" * 150
        for global_header in (False, True):
            with self.subTest(global_header=global_header):
                raw = pax_bytes(
                    {"path": path, "comment": "ordinary value mentioning GNU.sparse.map"}, global_header=global_header
                )
                rows, content = release.index_archive(io.BytesIO(raw), captures={path})
                self.assertEqual(set(rows), {path})
                self.assertEqual(content[path], b"fixture")

    def test_old_gnu_sparse_header_is_rejected_before_stdlib_sparse_parser(self):
        item = tarfile.TarInfo("fixture")
        item.type = tarfile.GNUTYPE_SPARSE
        raw = gzip.compress(item.tobuf(format=tarfile.GNU_FORMAT))
        with (
            patch.object(
                tarfile.TarInfo, "_proc_sparse", side_effect=AssertionError("sparse parser must not run")
            ) as parser,
            self.assertRaisesRegex(ValueError, "Sparse archive entries are unsupported"),
        ):
            release.index_archive(io.BytesIO(raw))
        parser.assert_not_called()

    def test_private_source_file_is_rejected(self):
        self.bundle.source["pkg/ottplay-control.json"] = b"private fixture"
        self.bundle.write()
        self.fails("Private configuration/state")

    def test_private_runtime_archive_file_is_rejected(self):
        self.bundle.runtime["ottplay-control.json"] = b"private fixture"
        self.bundle.write()
        self.fails("Private configuration/state")

    def test_source_compiler_must_match_build_receipt(self):
        self.bundle.source_manifest["build_environment"]["ndk"]["gcc_sha256"] = "0" * 64
        self.bundle.source["SOURCE-MANIFEST.json"] = encoded(self.bundle.source_manifest)
        self.bundle.write()
        self.fails("compiler binding")

    def test_packaged_libavformat_requires_ffmpeg_despite_source_declaration(self):
        for declared in ([], [{"id": "ffmpeg", "bundled": False}]):
            with self.subTest(declared=declared):
                source, manifest = self.bundle.source, self.bundle.source_manifest
                source["ci/dependencies.json"] = encoded(declared)
                source.pop("sources/ffmpeg.tar.gz", None)
                manifest["dependencies"] = [row for row in manifest["dependencies"] if row["id"] != "ffmpeg"]
                manifest["files"] = {
                    name: {"sha256": digest(data), "mode": 0o644}
                    for name, data in source.items()
                    if name != "SOURCE-MANIFEST.json"
                }
                manifest["snapshot_sha256"] = digest(encoded(manifest["files"]))
                source["SOURCE-MANIFEST.json"] = encoded(manifest)
                self.bundle.write()
                self.fails("Missing bundled dependency source")

    def test_package_artwork_must_match_distributed_source(self):
        self.bundle.package[self.bundle.prefix + "largeIcon.png"] += b"modified"
        self.bundle.write()
        self.fails("Source member digest mismatch: pkg/largeIcon.png")

    def test_integration_hash_is_recomputed_not_trusted(self):
        key = release.INTEGRATION_PREFIX + "build.py"
        self.bundle.source[key] += b"changed"
        manifest = self.bundle.source_manifest
        manifest["files"][key]["sha256"] = digest(self.bundle.source[key])
        manifest["snapshot_sha256"] = digest(encoded(manifest["files"]))
        self.bundle.source["SOURCE-MANIFEST.json"] = encoded(manifest)
        self.bundle.write()
        self.fails("Embedded integration digest")

    def test_mixed_release_directories_are_rejected(self):
        feed = self.bundle.feed()
        feed["sourceArchiveUrls"][0] = feed["sourceArchiveUrls"][0].replace("/native/", "/different-beta/")
        (self.bundle.root / "ottplay-native-webos-manifest.json").write_bytes(encoded(feed))
        self.fails("release directory")

    def test_downloads_and_metadata_may_have_separate_coherent_directories(self):
        feed = self.bundle.feed()
        for key in ("ipkUrl", "sourceUrl"):
            feed[key] = feed[key].replace("/native/", "/downloads/")
        feed["sourceArchiveUrls"] = [url.replace("/native/", "/downloads/") for url in feed["sourceArchiveUrls"]]
        (self.bundle.root / "ottplay-native-webos-manifest.json").write_bytes(encoded(feed))
        self.assertTrue(self.verify()["homebrew_validated"])

    def test_homebrew_rejects_localhost_and_non_global_ip_literals(self):
        hosts = (
            "localhost",
            "LOCALHOST.",
            "sub.localhost",
            "127.0.0.1",
            "127.1",
            "2130706433",
            "0x7f000001",
            "0177.0.0.1",
            "127.0x0.0.1",
            "010.010.010.010",
            "10.0.0.1",
            "172.16.0.1",
            "192.168.1.1",
            "100.64.0.1",
            "169.254.1.1",
            "192.0.2.1",
            "0.0.0.0",
            "224.0.0.1",
            "[::1]",
            "[::]",
            "[fc00::1]",
            "[fe80::1]",
            "[ff02::1]",
            "[::ffff:127.0.0.1]",
        )
        for host in hosts:
            with self.subTest(host=host), self.assertRaisesRegex(ValueError, "public HTTPS"):
                release.artifact_url("https://" + host + "/release/file.ipk", "file.ipk")

    def test_homebrew_accepts_public_dns_and_global_ip_literals_without_dns_lookup(self):
        for host in ("github.com", "8.8.8.8", "[2001:4860:4860::8888]"):
            with self.subTest(host=host):
                result = release.artifact_url("https://" + host + "/release/file.ipk", "file.ipk")
                self.assertEqual(result, ("https", host, "/release"))

    def test_duplicate_json_keys_and_false_device_claims(self):
        with self.assertRaisesRegex(ValueError, "Duplicate JSON key"):
            release.decode(b'{"schema":1,"schema":2}')
        self.bundle.metadata["device_validation"] = "PASS"
        self.bundle.save_metadata()
        self.fails("device validation claim")

    def test_false_rebuild_claim_is_not_promoted(self):
        self.bundle.runtime_manifest["bit_identical_rebuild"] = "PASS"
        self.bundle.write()
        self.fails("rebuild claim")

    def test_optional_current_checkout_binding(self):
        with (
            patch.object(release.build, "manifest", return_value=self.bundle.upstream),
            patch.object(release.build, "integration_digest", return_value=self.bundle.integration_hash),
        ):
            self.assertTrue(self.verify(check_checkout=True)["checkout_validated"])
        with (
            patch.object(release.build, "manifest", return_value=self.bundle.upstream),
            patch.object(release.build, "integration_digest", return_value="d" * 64),
            self.assertRaisesRegex(ValueError, "current checkout"),
        ):
            self.verify(check_checkout=True)


if __name__ == "__main__":
    unittest.main()
