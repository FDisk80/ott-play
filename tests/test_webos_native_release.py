"""Offline native release checks exercise real archives, never a toolchain or TV."""

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
import zlib
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


def png_chunk(kind, data=b""):
    return len(data).to_bytes(4, "big") + kind + data + zlib.crc32(kind + data).to_bytes(4, "big")


def png_bytes(pixel=b"\x10\x20\x30"):
    """A genuine 1x1 RGB PNG with one unfiltered, losslessly compressed row."""
    header = (1).to_bytes(4, "big") * 2 + bytes((8, 2, 0, 0, 0))
    return (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", header)
        + png_chunk(b"IDAT", zlib.compress(b"\x00" + pixel))
        + png_chunk(b"IEND")
    )


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


class PngArchiveTests(unittest.TestCase):
    header = (1).to_bytes(4, "big") * 2 + bytes((8, 2, 0, 0, 0))
    image = zlib.compress(b"\x00\x10\x20\x30")

    def png(self, *chunks):
        return b"\x89PNG\r\n\x1a\n" + b"".join(png_chunk(kind, data) for kind, data in chunks)

    def accepted(self, data):
        rows, content = release.index_archive(io.BytesIO(tar_bytes({"art.png": data})))
        self.assertEqual(content, {})
        return rows["art.png"]["png"]

    def test_generated_fixture_has_real_compressed_pixel_and_crc(self):
        data = png_bytes()
        offset, pixels = 8, b""
        while offset < len(data):
            size = int.from_bytes(data[offset : offset + 4], "big")
            kind, body = data[offset + 4 : offset + 8], data[offset + 8 : offset + 8 + size]
            self.assertEqual(
                int.from_bytes(data[offset + 8 + size : offset + 12 + size], "big"), zlib.crc32(kind + body)
            )
            if kind == b"IDAT":
                pixels += body
            offset += 12 + size
        self.assertEqual(zlib.decompress(pixels), b"\x00\x10\x20\x30")
        self.assertTrue(self.accepted(data))

    def test_truncation_at_every_byte_is_rejected(self):
        data = png_bytes()
        for size in range(len(data)):
            with self.subTest(size=size):
                self.assertFalse(self.accepted(data[:size]))

    def test_crc_is_checked_for_every_chunk(self):
        for kind in (b"IHDR", b"IDAT", b"IEND"):
            data = bytearray(png_bytes())
            offset = data.index(kind) - 4
            size = int.from_bytes(data[offset : offset + 4], "big")
            data[offset + 8 + size] ^= 1
            with self.subTest(kind=kind):
                self.assertFalse(self.accepted(bytes(data)))
        ancillary = bytearray(self.png((b"IHDR", self.header), (b"tEXt", b"key\0value")))
        ancillary[-1] ^= 1
        self.assertFalse(self.accepted(bytes(ancillary) + png_chunk(b"IDAT", self.image) + png_chunk(b"IEND")))

    def test_declared_chunk_lengths_cannot_escape_member(self):
        for size in (14, 2**31, 2**32 - 1):
            data = bytearray(png_bytes())
            data[8:12] = size.to_bytes(4, "big")
            with self.subTest(size=size):
                self.assertFalse(self.accepted(bytes(data)))

    def test_ihdr_length_dimensions_and_pixel_format_are_checked(self):
        headers = [self.header[:12], self.header + b"\x00"]
        for field in (0, 4):
            for dimension in (0, 16385):
                header = bytearray(self.header)
                header[field : field + 4] = dimension.to_bytes(4, "big")
                headers.append(bytes(header))
        for field, value in ((8, 1), (9, 1), (10, 1), (11, 1), (12, 2)):
            header = bytearray(self.header)
            header[field] = value
            headers.append(bytes(header))
        for header in headers:
            with self.subTest(header=header):
                self.assertFalse(self.accepted(self.png((b"IHDR", header), (b"IDAT", self.image), (b"IEND", b""))))

    def test_critical_chunk_order_and_nonempty_image_are_required(self):
        ihdr, idat, iend = (b"IHDR", self.header), (b"IDAT", self.image), (b"IEND", b"")
        empty, text = (b"IDAT", b""), (b"tEXt", b"key\0value")
        variants = (
            (idat, ihdr, iend),
            (ihdr, ihdr, idat, iend),
            (ihdr, iend),
            (ihdr, empty, iend),
            (ihdr, idat),
            (ihdr, idat, (b"IEND", b"x")),
            (ihdr, idat, iend, iend),
            (ihdr, idat, text, idat, iend),
            (ihdr, empty, text, idat, iend),
            (ihdr, (b"ABCD", b"unknown critical"), idat, iend),
            (ihdr, (b"tExt", b"reserved bit"), idat, iend),
            (ihdr, (b"1234", b"invalid type"), idat, iend),
        )
        for chunks in variants:
            with self.subTest(kinds=[kind for kind, _ in chunks]):
                self.assertFalse(self.accepted(self.png(*chunks)))
        self.assertFalse(self.accepted(png_bytes() + b"garbage"))

    def test_ancillary_chunks_and_consecutive_idat_are_supported(self):
        self.assertTrue(
            self.accepted(
                self.png(
                    (b"IHDR", self.header),
                    (b"tEXt", b"key\0value"),
                    (b"IDAT", b""),
                    (b"IDAT", self.image[:4]),
                    (b"IDAT", self.image[4:]),
                    (b"IDAT", b""),
                    (b"tEXt", b"after\0value"),
                    (b"IEND", b""),
                )
            )
        )

    def test_palette_constraints_and_order_are_checked(self):
        indexed = self.header[:8] + bytes((1, 3, 0, 0, 0))
        ihdr, idat, iend = (b"IHDR", indexed), (b"IDAT", zlib.compress(b"\0\0")), (b"IEND", b"")
        palette = (b"PLTE", b"\x10\x20\x30")
        self.assertTrue(self.accepted(self.png(ihdr, palette, idat, iend)))
        for chunks in (
            (ihdr, idat, iend),
            (ihdr, palette, palette, idat, iend),
            (ihdr, (b"PLTE", b""), idat, iend),
            (ihdr, (b"PLTE", b"xx"), idat, iend),
            (ihdr, (b"PLTE", b"\0" * 9), idat, iend),
            ((b"IHDR", self.header), (b"IDAT", b""), palette, idat, iend),
            ((b"IHDR", self.header[:9] + b"\0" + self.header[10:]), palette, idat, iend),
        ):
            with self.subTest(chunks=chunks):
                self.assertFalse(self.accepted(self.png(*chunks)))

    def test_png_capture_and_spooling_preserve_gzip_and_plain_tar(self):
        data = png_bytes()
        files = {"art.png": data, "ordinary": b"x" * (1024 * 1024 + 17)}
        gzip_data = tar_bytes(files)
        for compression, archive in (("gz", gzip_data), ("", gzip.decompress(gzip_data))):
            for captures in ((), ("art.png",)):
                with self.subTest(compression=compression, captures=captures):
                    sinks = {key: io.BytesIO() for key in files}
                    rows, content = release.index_archive(
                        io.BytesIO(archive), captures=captures, spools=sinks, compression=compression
                    )
                    self.assertEqual(content, {"art.png": data} if captures else {})
                    self.assertTrue(rows["art.png"]["png"])
                    self.assertFalse(rows["ordinary"]["png"])
                    for key, value in files.items():
                        self.assertEqual(rows[key]["sha256"], digest(value))
                        self.assertEqual(sinks[key].getvalue(), value)

    def test_oversized_png_is_not_collected_or_accepted(self):
        data = png_bytes()
        with (
            patch.object(release, "JSON_LIMIT", len(data) - 1),
            patch.object(
                release, "png_container", side_effect=AssertionError("oversized PNG must not be collected")
            ) as validator,
        ):
            self.assertFalse(self.accepted(data))
            validator.assert_not_called()


class IntegrationPatchSpoolTests(unittest.TestCase):
    def test_spooled_patches_hash_raw_bytes_in_canonical_not_archive_order(self):
        prefix = release.INTEGRATION_PREFIX
        # Deliberately reverse canonical order and cross several read blocks.
        files = {
            prefix + "patches/z.patch": b"z" * (1024 * 1024 + 17),
            prefix + "upstream.json": b"{}",
            prefix + "patches/a.patch": b"a\0b\xff\n",
        }
        reads = []
        with tempfile.TemporaryFile() as stream:
            class BoundedReader:
                def tell(self):
                    return stream.tell()

                def write(self, data):
                    return stream.write(data)

                def seek(self, offset):
                    return stream.seek(offset)

                def read(self, size):
                    self_test.assertGreater(size, 0)
                    self_test.assertLessEqual(size, 1024 * 1024)
                    reads.append(size)
                    return stream.read(size)

            self_test = self
            spool = release.IntegrationPatchSpool(BoundedReader())
            rows, content = release.index_archive(
                io.BytesIO(tar_bytes(files)), captures={prefix + "upstream.json"}, spools=spool
            )
            self.assertEqual(content, {prefix + "upstream.json": b"{}"})
            self.assertEqual(set(spool.offsets), {key for key in files if "/patches/" in key})
            self.assertEqual(stream.tell(), sum(len(files[key]) for key in spool.offsets))
            actual, expected = hashlib.sha256(), hashlib.sha256()
            for key in sorted(files):
                name = key.removeprefix(prefix).encode() + b"\0"
                actual.update(name)
                expected.update(name + files[key])
                if key in spool.offsets:
                    spool.update(actual, key, rows[key]["bytes"])
                else:
                    actual.update(content[key])
            self.assertEqual(actual.digest(), expected.digest())
            self.assertGreater(len(reads), len(spool.offsets))
        self.assertTrue(stream.closed)

    def test_spooling_preserves_member_total_count_and_path_guards(self):
        key = release.INTEGRATION_PREFIX + "patches/fixture.patch"
        cases = (
            ({key: b"1234"}, {"MEMBER_LIMIT": 3}, {}, "Expanded archive"),
            ({key: b"1234"}, {}, {"total_limit": 3}, "Expanded archive"),
            ({key: b"x", key + "2": b"y"}, {"FILE_COUNT_LIMIT": 1}, {}, "Too many archive"),
            ({release.INTEGRATION_PREFIX + "patches/../escape": b"x"}, {}, {}, "Unsafe archive member"),
        )
        for files, limits, arguments, message in cases:
            with self.subTest(message=message, limits=limits), tempfile.TemporaryFile() as stream:
                spool = release.IntegrationPatchSpool(stream)
                with patch.dict(vars(release), limits):
                    with self.assertRaisesRegex(ValueError, message):
                        release.index_archive(io.BytesIO(tar_bytes(files)), spools=spool, **arguments)
                self.assertLessEqual(stream.tell(), 1)

    def test_short_patch_spool_cannot_satisfy_indexed_size(self):
        key = release.INTEGRATION_PREFIX + "patches/fixture.patch"
        with tempfile.TemporaryFile() as stream:
            spool = release.IntegrationPatchSpool(stream)
            rows, _ = release.index_archive(io.BytesIO(tar_bytes({key: b"four"})), spools=spool)
            stream.truncate(3)
            with self.assertRaisesRegex(ValueError, "Truncated integration patch spool"):
                spool.update(hashlib.sha256(), key, rows[key]["bytes"])


class Bundle:
    """Small internally coherent release, with real IPK/tar and hash receipts."""

    def __init__(self, root, version="0.1.0"):
        self.root = root
        self.stem = "ottplay-native-webos-" + version
        self.metadata_path = root / (self.stem + ".json")
        self.app = {"id": release.APP_ID, "title": "OTTPlay", "version": version, "channel": "experimental"}
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
        png = png_bytes()
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
                    "version": version,
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
                "Package: " + release.APP_ID + "\nVersion: " + version + "\nLicense: GPL-3.0-or-later\n"
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


class CompanionBundle:
    """A source-complete tiny helper using the real optional release schema."""

    def __init__(self, bundle, registry_name="fixture", registry_version="1.0.0"):
        self.bundle = bundle
        self.prefix = bundle.prefix + "companion/"
        self.spec = {
            "schema": 1,
            "package": "ottplay-companion",
            "target": release.build.TARGET,
            "rust_toolchain": "1.96.1",
            "rust_commit": "31fca3adb283cc9dfd56b49cdee9a96eb9c96ffd",
            "features": ["webos-legacy-glibc"],
            "install_path": "bin/ottplay-companion",
            "required_source_files": ["Cargo.lock", "src/main.rs"],
            "notice_files": ["LICENSE"],
            "release_source_requirements": [
                "local_source_archive",
                "locked_registry_and_git_dependencies",
                "rust_standard_library_sources",
                "linked_sdk_runtime_sources",
            ],
        }
        self.packages = [
            {
                "name": registry_name,
                "version": registry_version,
                "source": "registry+https://example.test/registry",
                "checksum": "1" * 64,
            },
            {"name": "fixture-git", "version": "2.0.0", "source": "git+https://example.test/dep#" + "2" * 40},
        ]
        self.local = {
            "Cargo.lock": (
                "version = 3\n"
                + "".join(
                    "\n[[package]]\n" + "".join(key + " = " + json.dumps(value) + "\n" for key, value in row.items())
                    for row in self.packages
                )
            ).encode(),
            "src/main.rs": b"fn main() {}\n",
            "LICENSE": b"Companion license fixture",
            "native/webos/companion/manifest.json": release.companion_canonical(self.spec),
        }
        self.source = {
            "schema": 1,
            "cargo_lock_dependencies": self.packages,
            "dependency_scope": "Entire workspace lock, including dependencies not linked into this helper",
            "release_source_requirements": self.spec["release_source_requirements"],
            "complete_corresponding_source": False,
        }
        self.refresh_inventory()
        self.vendor, self.components = {}, []
        for row in self.packages:
            directory = row["name"] + "-" + row["version"]
            files = {
                "Cargo.toml": (
                    "[package]\nname="
                    + json.dumps(row["name"])
                    + "\nversion="
                    + json.dumps(row["version"])
                    + '\nlicense="MIT"\n'
                ).encode(),
                "src/lib.rs": b"pub fn fixture() {}\n",
                "LICENSE": b"Fixture license",
            }
            sums = {"package": row.get("checksum"), "files": {path: digest(data) for path, data in files.items()}}
            sums_bytes = release.companion_canonical(sums)
            self.vendor.update({"cargo-vendor/" + directory + "/" + path: data for path, data in files.items()})
            self.vendor["cargo-vendor/" + directory + "/.cargo-checksum.json"] = sums_bytes
            self.components.append(
                dict(
                    row,
                    directory=directory,
                    checksum_manifest_sha256=digest(sums_bytes),
                    files=len(files),
                    license="MIT",
                    license_file=None,
                )
            )
        self.commit = self.spec["rust_commit"]
        self.rust_path = "rust-src-1.96.1.tar.xz"
        # Structural fixture only: it does not claim to compile a Rust library.
        self.rust_files = {
            "Cargo.lock": b"version = 4\n",
            "Cargo.toml": b'[workspace]\nmembers = ["core", "alloc", "std"]\n',
            "core/src/lib.rs": b"#![no_std]\n",
            "alloc/src/lib.rs": b"#![no_std]\n",
            "std/src/lib.rs": b"pub use core::*;\n",
        }
        self.refresh_rust_archive()
        binary = bundle.package[bundle.prefix + "plxnative"] + b"helper"
        bundle.package[bundle.prefix + "bin/ottplay-companion"] = binary
        bundle.modes[bundle.prefix + "bin/ottplay-companion"] = 0o755
        archive_inputs = [
            {
                "path": "/build/companion-target/release/deps/libfixture.rlib",
                "sha256": "5" * 64,
                "bytes": 100,
                "observed_at_link": True,
                "validation": "link_time_and_current",
            },
            {
                "path": "/build/webos-sdk/lib/libgcc.a",
                "sha256": "d" * 64,
                "bytes": 100,
                "observed_at_link": True,
                "validation": "link_time_and_current",
            },
        ]
        link_map = "".join("LOAD " + row["path"] + "\n" for row in archive_inputs).encode()
        link_trace = "".join(row["path"] + "\n" for row in archive_inputs).encode()
        self.receipt = {
            "schema": 1,
            "package": "ottplay-companion",
            "target": release.build.TARGET,
            "features": self.spec["features"],
            "manifest_sha256": digest(release.companion_canonical(self.spec)),
            "elf": {"sha256": digest(binary), "bytes": len(binary), "device_executed": False},
            "device_executed": False,
            "rustc": "rustc 1.96.1 ("
            + self.commit[:9]
            + " 2026-01-01)\ncommit-hash: "
            + self.commit
            + "\nrelease: 1.96.1",
            "sdk": {
                "archive_sha256": "b" * 64,
                "executables": {"gcc": "f" * 64, "gcc_backend": "6" * 64},
                "host": "test",
                "version": "fixture-sdk",
            },
            "link_map_sha256": digest(link_map),
            "link_trace_sha256": digest(link_trace),
            "link_receipt_sha256": "4" * 64,
        }
        self.linkage = {
            "elf_sha256": digest(binary),
            "map_sha256": self.receipt["link_map_sha256"],
            "trace_sha256": self.receipt["link_trace_sha256"],
            "receipt_sha256": "4" * 64,
            "trace_available": True,
            "compiler_sha256": "f" * 64,
            "compiler_backend_sha256": "6" * 64,
        }
        bundle.runtime_manifest["shipped_elfs"]["ottplay-companion"] = {
            "elf_sha256": digest(binary),
            "archive_excluded": True,
            "compiler_sha256": "f" * 64,
            "compiler_backend_sha256": "6" * 64,
            "map_sha256": self.receipt["link_map_sha256"],
            "trace_sha256": self.receipt["link_trace_sha256"],
            "link_receipt_sha256": self.receipt["link_receipt_sha256"],
            "distributed_map_sha256": digest(link_map),
            "distributed_trace_sha256": digest(link_trace),
            "runtime_inputs": [{"source": "gcc-runtime", "sdk_path": "lib/libgcc.a"}],
            "build_root": "/build/ottplay-companion",
            "build_target": "/build/companion-target",
            "rust_sysroot": "/build/companion-rust",
            "archive_inputs_capture": "during-final-link",
            "archive_inputs": archive_inputs,
        }
        bundle.runtime_manifest["sdk_attestation"]["companion_compiler"] = {
            "compiler": {"sdk_path": "bin/toolchain-wrapper", "sha256": "f" * 64},
            "backend": {"sdk_path": "bin/arm-webos-linux-gnueabi-gcc.br_real", "sha256": "6" * 64},
            "archive_match": "PASS",
        }
        bundle.runtime.update(
            {
                "evidence/ottplay-companion.link.map": link_map,
                "evidence/ottplay-companion.link.trace": link_trace,
                "evidence/ottplay-companion.readelf.txt": b"Fixture ELF inspection",
            }
        )
        self.local_override = None
        self.write()

    def refresh_rust_archive(self, *, extra=None):
        output = io.BytesIO()
        with tarfile.open(fileobj=output, mode="w:xz") as archive:
            for path, data in self.rust_files.items():
                member = tarfile.TarInfo("rust-src-1.96.1/rust-src/lib/rustlib/src/rust/library/" + path)
                member.mode, member.size = 0o644, len(data)
                archive.addfile(member, io.BytesIO(data))
            if extra:
                archive.addfile(extra)
        self.rust_archive = output.getvalue()
        self.channel = (
            "\n".join(
                "[pkg." + name + "]\nversion=" + json.dumps("1.96.1 (" + self.commit[:9] + " 2026-01-01)")
                for name in ("rustc", "rust-src", "rust-std")
            )
            + '\n[pkg.rust-src.target."*"]\nhash="'
            + digest(self.rust_archive)
            + '"\n'
        ).encode()
        self.rust = {
            "toolchain": "1.96.1",
            "commit": self.commit,
            "archive_sha256": digest(self.rust_archive),
            "channel_manifest_sha256": digest(self.channel),
            "source_archive_hash_verified": True,
        }

    def refresh_inventory(self):
        self.source["local_inputs"] = [
            {"path": path, "sha256": digest(data), "bytes": len(data), "mode": 0o644}
            for path, data in sorted(self.local.items())
        ]
        self.source["local_inputs_sha256"] = digest(release.companion_canonical(self.source["local_inputs"]))

    def refresh_policy(self):
        policy = release.companion_canonical(self.spec)
        self.local["native/webos/companion/manifest.json"] = policy
        self.receipt["manifest_sha256"] = digest(policy)
        self.refresh_inventory()

    def write(self):
        source_bytes = release.companion_canonical(self.source)
        local = self.local_override or tar_bytes(
            {**{"source/" + path: data for path, data in self.local.items()}, "source-receipt.json": source_bytes}
        )
        self.receipt.update(
            local_source_archive_sha256=digest(local),
            source_receipt_sha256=digest(source_bytes),
            local_inputs_sha256=self.source["local_inputs_sha256"],
        )
        receipt_bytes = release.companion_canonical(self.receipt)
        self.packaged = {
            key: self.receipt[key]
            for key in (
                "manifest_sha256",
                "source_receipt_sha256",
                "local_source_archive_sha256",
                "local_inputs_sha256",
            )
        }
        self.packaged.update(elf_sha256=self.receipt["elf"]["sha256"], receipt_sha256=digest(receipt_bytes))
        self.bundle.metadata["companion"] = self.packaged
        self.bundle.metadata["build"]["companion"] = self.packaged
        self.bundle.package.update(
            {
                self.prefix + "manifest.json": release.companion_canonical(self.spec),
                self.prefix + "receipt.json": receipt_bytes,
                self.prefix + "source.json": release.companion_canonical(
                    {
                        "schema": 1,
                        "complete_corresponding_source": False,
                        "local_source_archive_sha256": digest(local),
                        "local_inputs_sha256": self.source["local_inputs_sha256"],
                        "release_source_requirements": self.spec["release_source_requirements"],
                    }
                ),
                self.prefix + "licenses/LICENSE": self.local["LICENSE"],
            }
        )
        self.payload = {
            "local-source.tar.gz": local,
            "source-receipt.json": source_bytes,
            "build-receipt.json": receipt_bytes,
            "cargo-vendor.tar.gz": tar_bytes(self.vendor),
            "cargo-components.json": release.companion_canonical(self.components),
            "cargo-config.toml": (
                b'[source."registry+https://example.test/registry"]\n'
                b'registry="https://example.test/registry"\nreplace-with="vendored-sources"\n'
                b'[source."git+https://example.test/dep"]\n'
                b'git="https://example.test/dep"\nreplace-with="vendored-sources"\n'
                b'[source.vendored-sources]\ndirectory="cargo-vendor"\n'
            ),
            "rust-notices.tar.gz": tar_bytes(
                {
                    "channel-manifest.toml": self.channel,
                    "COPYRIGHT.html": b"Fixture copyright",
                    "COPYRIGHT-library.html": b"Fixture copyright",
                    "licenses/MIT.txt": b"Fixture license",
                }
            ),
            self.rust_path: self.rust_archive,
        }
        self.manifest = {
            "schema": 1,
            "package": "ottplay-companion",
            "target": release.build.TARGET,
            "features": self.spec["features"],
            "local_inputs_sha256": self.source["local_inputs_sha256"],
            "cargo_lock_sha256": digest(self.local["Cargo.lock"]),
            "dependency_scope": self.source["dependency_scope"],
            "dependency_count": len(self.components),
            "rust": self.rust,
            "sdk_linkage": self.linkage,
            "sdk_archive_sha256": "b" * 64,
            "complete_corresponding_source": False,
            "sdk_runtime_source_coverage": "PENDING_ENCLOSING_RELEASE",
            "rebuild_validation": "NOT_RUN",
            "bit_identical_rebuild": "NOT_PROVEN",
        }
        self.write_archive()

    def write_archive(self, *, refresh_manifest=True):
        if refresh_manifest:
            self.manifest["files"] = {
                path: {"sha256": digest(data), "bytes": len(data)} for path, data in self.payload.items()
            }
        manifest_bytes = release.companion_canonical(self.manifest)
        archive = tar_bytes({**self.payload, "SOURCE-MANIFEST.json": manifest_bytes})
        self.closure = {
            key: self.manifest[key]
            for key in (
                "local_inputs_sha256",
                "cargo_lock_sha256",
                "dependency_count",
                "rust",
                "sdk_linkage",
                "sdk_archive_sha256",
                "complete_corresponding_source",
                "sdk_runtime_source_coverage",
                "rebuild_validation",
            )
        }
        self.closure.update(
            schema=1,
            source_archive={"file": "companion-source.tar.gz", "sha256": digest(archive), "bytes": len(archive)},
            source_manifest_sha256=digest(manifest_bytes),
            locked_source_coverage="PASS",
            elf_sha256=self.packaged["elf_sha256"],
            source_receipt_sha256=self.packaged["source_receipt_sha256"],
            local_source_archive_sha256=self.packaged["local_source_archive_sha256"],
        )
        self.bundle.runtime_manifest["companion"] = {
            "archive": {"file": "companion/companion-source.tar.gz", "sha256": digest(archive), "bytes": len(archive)},
            "source_closure": self.closure,
            "packaged": self.packaged,
            "sdk_runtime_source_coverage": "PASS",
        }
        self.bundle.runtime.update(
            {
                "companion/companion-source.tar.gz": archive,
                "companion/SOURCE-MANIFEST.json": manifest_bytes,
                "companion/source-closure.json": release.companion_canonical(self.closure),
            }
        )
        self.bundle.write()


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

    def test_truncated_png_header_is_not_packaged_artwork(self):
        self.bundle.package[self.bundle.prefix + "splash.png"] = png_bytes()[:24]
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
        self.bundle.package[self.bundle.prefix + "largeIcon.png"] = png_bytes(b"\x80\x90\xa0")
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

    def test_legacy_bundle_cannot_claim_current_checkout_binding(self):
        with (
            patch.object(release.build, "manifest", return_value=self.bundle.upstream),
            patch.object(release.build, "integration_digest", return_value=self.bundle.integration_hash),
        ):
            self.assertEqual(self.verify()["bundle_validation"], "PASS")
            with self.assertRaisesRegex(ValueError, "Current checkout requires native compilation evidence"):
                self.verify(check_checkout=True)


class CurrentNativeReleaseTests(unittest.TestCase):
    """The real offline consumer receives current producer-shaped archives."""

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.bundle = Bundle(Path(temporary.name), version="0.3.0")
        self.current(compilation=True)

    def refresh_source(self):
        b = self.bundle
        prefix = release.INTEGRATION_PREFIX
        names = release.INTEGRATION_FILES | {"control_discovery_config.py", "patches/0001-fixture.patch",
                                            "releases/0.3.0.md", "releases/0.3.0-audit.md"}
        h = hashlib.sha256()
        for name in sorted(names):
            if prefix + name in b.source:
                h.update(name.encode() + b"\0" + b.source[prefix + name])
        b.integration_hash = h.hexdigest()
        b.metadata["integration_sha256"] = b.integration_hash
        b.metadata["build"]["integration_sha256"] = b.integration_hash
        prov = json.loads(b.source[prefix + "PROVENANCE.json"])
        prov["integration_sha256"] = b.integration_hash
        b.source[prefix + "PROVENANCE.json"] = encoded(prov)
        b.source_manifest["files"] = {n: {"sha256": digest(v), "mode": 0o644}
                                      for n, v in b.source.items() if n != "SOURCE-MANIFEST.json"}
        b.source_manifest["snapshot_sha256"] = digest(encoded(b.source_manifest["files"]))
        b.source["SOURCE-MANIFEST.json"] = encoded(b.source_manifest)
        b.write()

    def current(self, *, compilation, configured=False, opt="s"):
        b = self.bundle
        prefix = release.INTEGRATION_PREFIX
        b.source[prefix + "control_discovery_config.py"] = b"raise RuntimeError('must never execute archived code')"
        config = release.build.release_product_config(b.upstream)
        b.source[release.build.PRODUCT_CONFIG] = encoded(config)
        documents = {}
        for role, suffix in (("notes", ".md"), ("audit", "-audit.md")):
            text = ("Fixture " + role + ": authored only, device validation not performed").encode()
            b.source[prefix + "releases/0.3.0" + suffix] = text
            b.source[config[role]] = text
            documents[role] = digest(text)
        b.metadata["build"]["product_release"] = {
            "path": release.build.PRODUCT_CONFIG, "sha256": digest(encoded(config)),
            "documents": documents, "audit_evidence": "authored_only"}
        profile = release.build.control_discovery_config.profile(
            "https://catalog.example.test/servers.json" if configured else None, "a" * 64 if configured else None)
        b.metadata["build"]["configuration"] = {
            "FLAVOR": "stable", "RELEASE": "1", "target": release.build.TARGET, "control_discovery": profile}
        if compilation:
            b.metadata["build"]["configuration"].update(
                ARM_PROFILE="release", rust_opt_level=opt, symbols=False, host="linux-aarch64")
            b.metadata["build"]["rust_toolchain"] = "1.99.1"
            b.upstream["sdk"]["assets"] = {"linux-aarch64": {"sha256": "b" * 64}}
            b.source[prefix + "upstream.json"] = encoded(b.upstream)
            b.runtime_manifest["sdk_attestation"]["host"] = "linux-aarch64"
            b.source["rust-modules/rust-toolchain.toml"] = b'[toolchain]\nchannel = "1.99.1"\n'
            archive = "rust-modules/target-release/" + release.build.TARGET + "/release/libplxnative_modules.a"
            root = "/build/native-source"
            self.artifact = {"reason": "compiler-artifact", "manifest_path": root + "/rust-modules/Cargo.toml",
                "target": {"name": "plxnative_modules", "src_path": root + "/rust-modules/src/lib.rs",
                           "kind": ["staticlib"], "crate_types": ["staticlib"]},
                "profile": {"opt_level": opt, "debuginfo": 0, "debug_assertions": False,
                            "overflow_checks": False, "test": False},
                "features": [], "filenames": [root + "/" + archive]}
            self.records = [self.artifact, {"reason": "build-finished", "success": True}]
            self.make = {"RUST_TDIR": "target-release", "RUST_TARGET": release.build.TARGET,
                         "ARM_PROFILE": "release", "ARM_PROFILE_FLAG": "--release", "RUST_LIB": archive,
                         "RUST_FEATFLAGS": "--no-default-features", "RUST_TOOLCHAIN": "1.99.1"}
            b.metadata["build"]["compilation"] = {"cargo": {}, "make": {},
                                                   "archive": {"path": archive, "sha256": "c" * 64}}
            self.write_compilation()
            self.link_archive(archive)
        else:
            b.metadata["build"].pop("compilation", None)
        self.refresh_source()

    def link_archive(self, archive):
        for role, data in (("map", ("LOAD " + archive + "\n").encode()),
                           ("trace", (archive + "\n").encode())):
            self.bundle.runtime["evidence/plxnative.link." + role] = data
            self.bundle.runtime_manifest["shipped_elfs"]["plxnative"]["distributed_" + role + "_sha256"] = digest(data)

    def write_compilation(self):
        b = self.bundle
        evidence = b.metadata["build"]["compilation"]
        for role, suffix, data in (
            ("cargo", "-cargo-artifacts.jsonl", b"\n".join(encoded(row) for row in self.records) + b"\n"),
            ("make", "-build-config.txt", ("\n".join(k + "=" + v for k,v in self.make.items()) + "\n").encode())):
            filename = b.stem + suffix
            (b.root / filename).write_bytes(data)
            evidence[role] = {"file": filename, "sha256": digest(data)}
        evidence["cargo"]["artifact"] = json.loads(encoded(self.artifact))

    def verify(self, **kwargs):
        self.bundle.write()
        return release.verify(self.bundle.metadata_path, **kwargs)

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

    def large_integration_patch(self):
        b = self.bundle
        prefix = release.INTEGRATION_PREFIX
        key = prefix + "patches/0001-fixture.patch"
        b.source[key] = b"x" * (release.JSON_LIMIT + 17)
        provenance = json.loads(b.source[prefix + "PROVENANCE.json"])
        provenance["patches"]["0001-fixture.patch"] = digest(b.source[key])
        b.source[prefix + "PROVENANCE.json"] = encoded(provenance)
        self.refresh_source()
        return key

    def test_large_integration_patch_passes_current_checkout_with_unchanged_raw_digest(self):
        self.large_integration_patch()
        before = self.bundle.integration_hash
        with (
            patch.object(release.build, "manifest", return_value=self.bundle.upstream),
            patch.object(release.build, "integration_digest", return_value=before),
        ):
            result = self.verify(check_checkout=True)
        self.assertEqual(result["bundle_validation"], "PASS")
        self.assertTrue(result["checkout_validated"])
        self.assertEqual(self.bundle.integration_hash, before)

    def test_large_patch_tamper_still_fails_raw_integration_digest(self):
        key = self.large_integration_patch()
        b = self.bundle
        b.source[key] = b.source[key][:-1] + b"y"
        provenance_key = release.INTEGRATION_PREFIX + "PROVENANCE.json"
        provenance = json.loads(b.source[provenance_key])
        provenance["patches"]["0001-fixture.patch"] = digest(b.source[key])
        b.source[provenance_key] = encoded(provenance)
        # Update the per-file envelope but retain the old raw integration digest.
        for path in (key, provenance_key):
            b.source_manifest["files"][path]["sha256"] = digest(b.source[path])
        b.source_manifest["snapshot_sha256"] = digest(encoded(b.source_manifest["files"]))
        b.source["SOURCE-MANIFEST.json"] = encoded(b.source_manifest)
        with self.assertRaisesRegex(ValueError, "Embedded integration digest mismatch"):
            self.verify()

    def test_actual_json_remains_bounded_and_malformed_json_is_not_spooled(self):
        cases = (
            (encoded({"padding": "x" * release.JSON_LIMIT}), "Captured member exceeds size limit"),
            (b"{", "Expecting property name"),
        )
        create = tempfile.TemporaryFile
        for data, message in cases:
            with self.subTest(message=message):
                opened = []

                def tracked_file(*args, **kwargs):
                    stream = create(*args, **kwargs)
                    opened.append(stream)
                    return stream

                self.bundle.source["SOURCE-MANIFEST.json"] = data
                with patch.object(release.tempfile, "TemporaryFile", side_effect=tracked_file):
                    with self.assertRaisesRegex(ValueError, message):
                        self.verify()
                self.assertEqual(len(opened), 1, "one anonymous patch spool, never one file per member")
                self.assertTrue(opened[0].closed, "failure must close the patch spool")


    def test_current_checkout_rejects_discovery_shape_downgrade(self):
        b = self.bundle
        before_source = dict(b.source)
        before_product = json.loads(encoded(b.metadata["build"]["product_release"]))
        before_integration = b.integration_hash
        with (
            patch.object(release.build, "manifest", return_value=b.upstream),
            patch.object(release.build, "integration_digest", return_value=b.integration_hash),
        ):
            self.assertTrue(self.verify(check_checkout=True)["checkout_validated"])
            for key in ("ARM_PROFILE", "rust_opt_level", "symbols", "host"):
                del b.metadata["build"]["configuration"][key]
            del b.metadata["build"]["compilation"]
            self.assertEqual(self.verify()["bundle_validation"], "PASS")
            with self.assertRaisesRegex(ValueError, "Current checkout requires native compilation evidence"):
                self.verify(check_checkout=True)
        self.assertEqual(b.source, before_source)
        self.assertEqual(b.metadata["build"]["product_release"], before_product)
        self.assertEqual(b.integration_hash, before_integration)

    def test_current_full_bundle_accepts_both_optimization_and_discovery_profiles(self):
        for opt in ("2", "s"):
            for configured in (False, True):
                with self.subTest(opt=opt, configured=configured):
                    self.current(compilation=True, configured=configured, opt=opt)
                    self.assertEqual(self.verify()["bundle_validation"], "PASS")

    def test_current_full_bundle_with_companion_passes_the_same_consumer(self):
        companion = CompanionBundle(self.bundle)
        companion.receipt["sdk"]["host"] = "linux-aarch64"
        companion.write()
        self.assertEqual(self.verify()["bundle_validation"], "PASS")

    def test_compilation_shape_and_filename_are_closed(self):
        b = self.bundle
        for role in ("cargo", "make", "archive"):
            self.current(compilation=True)
            b.metadata["build"]["compilation"][role]["unexpected"] = True
            with self.subTest(role=role), self.assertRaisesRegex(ValueError, "Native compilation"):
                self.verify()
        self.current(compilation=True)
        b.metadata["build"]["compilation"]["cargo"]["file"] = "../outside.jsonl"
        with self.assertRaisesRegex(ValueError, "evidence file"):
            self.verify()
        self.current(compilation=True)
        del b.metadata["build"]["compilation"]
        with self.assertRaisesRegex(ValueError, "compilation evidence"):
            self.verify()

    def test_discovery_only_published_bundle_remains_supported(self):
        self.current(compilation=False)
        self.assertEqual(self.verify()["bundle_validation"], "PASS")

    def test_current_configuration_rejects_missing_extra_wrong_typed_or_forged_values(self):
        good = json.loads(encoded(self.bundle.metadata["build"]["configuration"]))
        invalid = [dict(good, extra="ignored"), {k:v for k,v in good.items() if k != "symbols"},
                   dict(good, symbols=0), dict(good, rust_opt_level="3"), dict(good, ARM_PROFILE="tvdev"),
                   dict(good, host="test"), dict(good, target="host"), dict(good, RELEASE="0")]
        for value in invalid:
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "configuration mismatch"):
                self.bundle.metadata["build"]["configuration"] = value
                self.verify()
        self.bundle.metadata["build"]["configuration"] = good

    def test_discovery_rejects_extra_fields_forged_digest_and_boolean_confusion(self):
        self.current(compilation=True, configured=True)
        config = self.bundle.metadata["build"]["configuration"]
        good = config["control_discovery"]
        for value in (dict(good, fingerprint="f" * 64), dict(good, ignored=True), dict(good, configured=1),
                      dict(good, url="http://catalog.example.test/servers.json"),
                      {"configured": False, "fingerprint": "none", "url": None}, [], None):
            with self.subTest(value=value), self.assertRaises(ValueError):
                config["control_discovery"] = value
                self.verify()
        config["control_discovery"] = good

    def test_compilation_requires_matching_profile_path_and_completed_cargo_stream(self):
        mutations = (lambda: self.artifact["profile"].update(opt_level="2"),
                     lambda: self.artifact["profile"].update(debuginfo=False),
                     lambda: self.artifact.update(filenames=["/different/archive.a"]),
                     lambda: self.artifact["target"].update(src_path="/different/lib.rs"),
                     lambda: self.artifact.update(features=["dev"]),
                     lambda: self.records[-1].update(success=False),
                     lambda: self.records.append(dict(self.artifact)))
        for mutate in mutations:
            self.current(compilation=True)
            mutate()
            self.write_compilation()
            with self.subTest(mutation=mutate), self.assertRaisesRegex(ValueError, "Native Cargo"):
                self.verify()

    def test_compilation_rejects_unbound_files_receipt_and_make_profile(self):
        b = self.bundle
        for role in ("cargo", "make"):
            self.current(compilation=True)
            (b.root / b.metadata["build"]["compilation"][role]["file"]).write_bytes(b"changed")
            with self.subTest(role=role), self.assertRaisesRegex(ValueError, "digest mismatch"):
                self.verify()
        self.current(compilation=True)
        b.metadata["build"]["compilation"]["cargo"]["artifact"]["features"] = ["forged"]
        with self.assertRaisesRegex(ValueError, "artifact binding"):
            self.verify()
        self.current(compilation=True)
        self.make["ARM_PROFILE"] = "tvdev"
        self.write_compilation()
        with self.assertRaisesRegex(ValueError, "Make configuration"):
            self.verify()

    def test_current_release_artifacts_must_match_and_unknown_files_are_rejected(self):
        b = self.bundle
        path = release.INTEGRATION_PREFIX + "release/notes/v0.3.0.md"
        b.source[path] = b"different notes"
        self.refresh_source()
        with self.assertRaisesRegex(ValueError, "release document"):
            self.verify()
        self.current(compilation=True)
        b.source[release.INTEGRATION_PREFIX + "unlisted.py"] = b"unexpected"
        self.refresh_source()
        with self.assertRaisesRegex(ValueError, "integration file set"):
            self.verify()

    def test_current_release_missing_document_and_forged_receipt_are_rejected(self):
        b = self.bundle
        del b.source[release.INTEGRATION_PREFIX + "releases/0.3.0-audit.md"]
        self.refresh_source()
        with self.assertRaisesRegex(ValueError, "release document"):
            self.verify()
        self.current(compilation=True)
        b.metadata["build"]["product_release"]["audit_evidence"] = "device_verified"
        with self.assertRaisesRegex(ValueError, "product receipt"):
            self.verify()

    def test_current_source_toolchain_and_final_link_must_match_compilation(self):
        b = self.bundle
        b.source["rust-modules/rust-toolchain.toml"] = b'[toolchain]\nchannel = "1.98.0"\n'
        self.refresh_source()
        with self.assertRaisesRegex(ValueError, "source toolchain"):
            self.verify()
        self.current(compilation=True)
        for role in ("map", "trace"):
            data = b"LOAD unrelated/libplxnative_modules.a\n" if role == "map" else b"unrelated/libplxnative_modules.a\n"
            b.runtime["evidence/plxnative.link." + role] = data
            b.runtime_manifest["shipped_elfs"]["plxnative"]["distributed_" + role + "_sha256"] = digest(data)
            with self.subTest(role=role), self.assertRaisesRegex(ValueError, "archive missing from final"):
                self.verify()
            self.current(compilation=True)

    def native_rust_binding(self, elf="plxnative-storage"):
        b = self.bundle
        commit = "a" * 40
        identity = ("rustc 1.99.1 (aaaaaaaaa 2026-09-01)\n"
                    "commit-hash: " + commit + "\nrelease: 1.99.1\n")
        next(row for row in b.source_manifest["dependencies"]
             if row["id"] == "rust-runtime")["version"] = commit
        b.source_manifest["build_environment"]["rustc"] = identity
        binding = {"source": "rust-runtime", "source_commit": commit, "rustc": identity,
                   "sysroot": "/build/native-rust", "archives": [{
                       "path": "/build/native-rust/lib/rustlib/armv7-unknown-linux-gnueabi/lib/"
                               "libcompiler_builtins-0123456789abcdef.rlib",
                       "sha256": "b" * 64, "bytes": 100, "validation": "collection-time"}]}
        b.runtime_manifest["shipped_elfs"][elf]["native_rust_runtime"] = binding
        path = binding["archives"][0]["path"]
        self.native_rust_link(elf, "LOAD " + path + "\n", path + "\n")
        self.refresh_source()
        return binding

    def native_rust_link(self, elf, link_map, trace):
        for role, text in (("map", link_map), ("trace", trace)):
            key = "evidence/" + elf + ".link." + role
            # Keep the existing native compilation archive and all other inputs.
            original = self.bundle.runtime[key].decode()
            original = "\n".join(line for line in original.splitlines()
                                  if "compiler_builtins-" not in line)
            value = (original + "\n" + text).encode()
            self.bundle.runtime[key] = value
            self.bundle.runtime_manifest["shipped_elfs"][elf]["distributed_" + role + "_sha256"] = digest(value)

    def test_native_rust_binding_accepts_matching_offline_evidence(self):
        self.native_rust_binding()
        with (patch("subprocess.run", side_effect=AssertionError("external command forbidden")),
              patch("subprocess.check_output", side_effect=AssertionError("external command forbidden"))):
            result = self.verify()
        self.assertEqual(result["bundle_validation"], "PASS")
        self.assertEqual(result["binary_correspondence"], "NOT_PROVEN")
        self.assertEqual(result["device_validation"], "not_performed")

    def test_native_rust_binding_source_commit_matches_distributed_dependency(self):
        for elf in ("plxnative", "plxnative-storage"):
            for value in ("b" * 40, None, 123):
                with self.subTest(elf=elf, source_commit=value):
                    binding = self.native_rust_binding()
                    binding["source_commit"] = value
                    entries = self.bundle.runtime_manifest["shipped_elfs"]
                    entries[elf]["native_rust_runtime"] = binding
                    with self.assertRaisesRegex(ValueError, "Native Rust runtime source binding"):
                        self.verify()
                    entries[elf].pop("native_rust_runtime", None)

    def test_native_rust_binding_uses_own_single_release_not_build_environment(self):
        identities = ("release: 1.98.0\n", "", "release: 1.99.1\nrelease: 1.99.1\n", None)
        for identity in identities:
            with self.subTest(identity=identity):
                binding = self.native_rust_binding()
                binding["rustc"] = ("commit-hash: " + "a" * 40 + "\n" + identity
                                    if isinstance(identity, str) else identity)
                with self.assertRaisesRegex(ValueError, "Native Rust runtime compiler binding"):
                    self.verify()

    def test_native_rust_binding_compiler_commit_matches_source_commit(self):
        for identity in ("commit-hash: " + "b" * 40 + "\nrelease: 1.99.1\n",
                         "release: 1.99.1\n"):
            with self.subTest(identity=identity):
                binding = self.native_rust_binding()
                binding["rustc"] = identity
                with self.assertRaisesRegex(ValueError, "Native Rust runtime compiler binding"):
                    self.verify()

    def test_native_rust_binding_legacy_checks_commit_without_compilation_release_pin(self):
        self.current(compilation=False)
        binding = self.native_rust_binding()
        binding["rustc"] = binding["rustc"].replace("1.99.1", "1.98.0")
        self.assertEqual(self.verify()["bundle_validation"], "PASS")
        binding["source_commit"] = "b" * 40
        with self.assertRaisesRegex(ValueError, "Native Rust runtime source binding"):
            self.verify()

    def test_native_rust_archive_inputs_match_each_native_elf_without_tools(self):
        for elf in ("plxnative", "plxnative-storage"):
            for form in ("load-and-bare", "map-member-only", "trace-member-only"):
                with self.subTest(elf=elf, form=form):
                    binding = self.native_rust_binding(elf)
                    path = binding["archives"][0]["path"]
                    link_map, trace = {
                        "load-and-bare": ("LOAD " + path + "\n", path + "\n"),
                        "map-member-only": (path + "(builtins.o)\n", ""),
                        "trace-member-only": ("", "(" + path + ")builtins.o\n"),
                    }[form]
                    self.native_rust_link(elf, link_map, trace)
                    with (patch("subprocess.run", side_effect=AssertionError("external command forbidden")),
                          patch("subprocess.check_output", side_effect=AssertionError("external command forbidden"))):
                        self.assertEqual(self.verify()["bundle_validation"], "PASS")

    def test_native_rust_archive_rejects_unobserved_or_unlisted_inputs(self):
        for elf in ("plxnative", "plxnative-storage"):
            for case in ("missing-both", "different-map", "extra-trace"):
                with self.subTest(elf=elf, case=case):
                    binding = self.native_rust_binding(elf)
                    path = binding["archives"][0]["path"]
                    other = path.replace("0123456789abcdef", "fedcba9876543210")
                    link_map, trace = {
                        "missing-both": ("", ""),
                        "different-map": ("LOAD " + other + "\n", ""),
                        "extra-trace": ("LOAD " + path + "\n", path + "\n" + other + "\n"),
                    }[case]
                    self.native_rust_link(elf, link_map, trace)
                    with self.assertRaisesRegex(ValueError, "Native Rust archive"):
                        self.verify()
                    self.native_rust_link(elf, "LOAD " + path + "\n", path + "\n")

    def test_native_rust_archive_rejects_missing_binding(self):
        for elf in ("plxnative", "plxnative-storage"):
            with self.subTest(elf=elf):
                self.native_rust_binding(elf)
                del self.bundle.runtime_manifest["shipped_elfs"][elf]["native_rust_runtime"]
                with self.assertRaisesRegex(ValueError, "Native Rust archive"):
                    self.verify()
                self.native_rust_link(elf, "", "")

    def test_native_rust_archive_rejects_empty_duplicate_and_noncanonical_inventory(self):
        paths = (
            "relative/compiler_builtins.rlib",
            "/build/native-rust/lib/rustlib/armv7-unknown-linux-gnueabi/lib/../lib/libcompiler_builtins-0123456789abcdef.rlib",
            "/build/native-rust/lib/rustlib/armv7-unknown-linux-gnueabi/lib//libcompiler_builtins-0123456789abcdef.rlib",
            "/build/native-rust/lib/rustlib/x86_64-unknown-linux-gnu/lib/libcompiler_builtins-0123456789abcdef.rlib",
            "/outside/libcompiler_builtins-0123456789abcdef.rlib",
            "/build/native-rust/lib/rustlib/armv7-unknown-linux-gnueabi/lib/libunknown-0123456789abcdef.rlib",
        )
        for case in ("empty", "duplicate", "wrong-root", *paths):
            with self.subTest(case=case):
                binding = self.native_rust_binding()
                if case == "empty":
                    binding["archives"] = []
                elif case == "duplicate":
                    binding["archives"] *= 2
                elif case == "wrong-root":
                    binding["sysroot"] = "/outside"
                else:
                    binding["archives"][0]["path"] = case
                    self.native_rust_link("plxnative-storage", "LOAD " + case + "\n", case + "\n")
                with self.assertRaisesRegex(ValueError, "Native Rust archive"):
                    self.verify()

    def test_native_rust_archive_preserves_collection_time_evidence_scope(self):
        for key, value in (("sha256", "bad"), ("bytes", 0), ("bytes", -1),
                           ("bytes", True), ("validation", "during-final-link")):
            with self.subTest(key=key, value=value):
                binding = self.native_rust_binding()
                binding["archives"][0][key] = value
                with self.assertRaises(ValueError):
                    self.verify()

    def test_native_rust_archive_cannot_borrow_another_elfs_inputs(self):
        binding = self.native_rust_binding("plxnative-storage")
        self.bundle.runtime_manifest["shipped_elfs"]["plxnative"]["native_rust_runtime"] = binding
        with self.assertRaisesRegex(ValueError, "Native Rust archive"):
            self.verify()

    def test_native_rust_archive_legacy_no_binding_and_no_rlib_stays_valid(self):
        self.current(compilation=False)
        self.assertEqual(self.verify()["bundle_validation"], "PASS")

    def test_current_runtime_host_must_match_compilation(self):
        self.bundle.metadata["build"]["configuration"]["host"] = "darwin-arm64"
        with self.assertRaisesRegex(ValueError, "host binding"):
            self.verify()


class CargoSourceConfigTests(unittest.TestCase):
    def check(self, sources, origins):
        release.check_companion_cargo_config({"source": sources}, [{"source": value} for value in origins])

    def test_crates_io_default_vendor_output(self):
        self.check(
            {
                "crates-io": {"replace-with": "vendored-sources"},
                "vendored-sources": {"directory": "cargo-vendor"},
            },
            ["registry+https://github.com/rust-lang/crates.io-index", "sparse+https://index.crates.io/"],
        )

    def test_alternate_registry_and_git_vendor_output(self):
        for registry in ("https://example.test/index", "sparse+https://example.test/index/"):
            origin = registry if registry.startswith("sparse+") else "registry+" + registry
            for query, reference in (
                ("", {}),
                ("?branch=release%2Fnext", {"branch": "release/next"}),
                ("?tag=v1.2", {"tag": "v1.2"}),
                ("?rev=abc123", {"rev": "abc123"}),
            ):
                with self.subTest(registry=registry, query=query):
                    self.check(
                        {
                            origin: {"registry": registry, "replace-with": "vendored-sources"},
                            "git+https://example.test/dep" + query: {
                                "git": "https://example.test/dep",
                                **reference,
                                "replace-with": "vendored-sources",
                            },
                            "vendored-sources": {"directory": "cargo-vendor"},
                        },
                        [origin, "git+https://example.test/dep" + query + "#" + "a" * 40],
                    )

    def test_source_alias_is_not_the_source_identity(self):
        self.check(
            {
                "original": {"registry": "https://example.test/index", "replace-with": "mirror"},
                "mirror": {"registry": "https://mirror.test/index", "replace-with": "local"},
                "local": {"directory": "cargo-vendor"},
            },
            ["registry+https://example.test/index"],
        )

    def test_unused_vendor_directory_does_not_cover_a_locked_origin(self):
        with self.assertRaisesRegex(ValueError, "locked source mapping missing"):
            self.check({"unused": {"directory": "cargo-vendor"}}, ["registry+https://example.test/index"])

    def test_replacement_chain_must_reach_the_exported_directory(self):
        for target, entry, message in (
            ("missing", None, "target missing"),
            ("crates-io", None, "replacement cycle"),
            ("mirror", {"registry": "https://example.test/index"}, "does not end"),
            ("mirror", {"git": "https://example.test/dep"}, "does not end"),
            ("mirror", {"local-registry": "somewhere"}, "does not end"),
            ("mirror", {"registry": "https://example.test/index", "replace-with": "crates-io"}, "cycle"),
            ("mirror", {"directory": "../cargo-vendor"}, "path mismatch"),
            ("mirror", {"directory": "/cargo-vendor"}, "path mismatch"),
        ):
            with self.subTest(target=target, entry=entry):
                sources = {"crates-io": {"replace-with": target}, "unused": {"directory": "cargo-vendor"}}
                if entry is not None:
                    sources[target] = entry
                with self.assertRaisesRegex(ValueError, message):
                    self.check(sources, ["registry+https://github.com/rust-lang/crates.io-index"])

    def test_malformed_or_ambiguous_source_definitions_are_rejected(self):
        for sources, message in (
            ([], "source mappings missing"),
            ({"bad": "value"}, "must be a table"),
            ({"bad": {"replace-with": "vendor"}}, "kind is missing"),
            ({"bad": {"registry": "https://example.test", "directory": "cargo-vendor"}}, "ambiguous"),
            ({"crates-io": {"replace-with": 42}}, "nonempty strings"),
            ({"crates-io": {"replace-with": ""}}, "nonempty strings"),
            ({"crates-io": {"registry": "https://example.test/index"}}, "identity mismatch"),
            ({"bad": {"git": "https://example.test/dep", "branch": "a", "rev": "b"}}, "ambiguous"),
            ({"bad": {"git": "https://example.test/dep?branch=next"}}, "embedded reference"),
            ({"bad": {"registry": "https://example.test/index", "tag": "next"}}, "ambiguous"),
            (
                {"one": {"registry": "https://example.test/index"}, "two": {"registry": "https://example.test/index"}},
                "identity is ambiguous",
            ),
        ):
            with self.subTest(sources=sources), self.assertRaisesRegex(ValueError, message):
                self.check(sources, ["registry+https://example.test/index"])

    def test_git_url_and_reference_must_match_the_lock(self):
        sources = {
            "dep": {"git": "https://example.test/dep", "branch": "next", "replace-with": "vendor"},
            "vendor": {"directory": "cargo-vendor"},
        }
        for locked in (
            "https://other.test/dep?branch=next",
            "https://example.test/dep",
            "https://example.test/dep?tag=next",
        ):
            with self.subTest(locked=locked), self.assertRaisesRegex(ValueError, "locked source mapping missing"):
                self.check(sources, ["git+" + locked + "#" + "a" * 40])
        for query in ("branch=next&rev=abc", "branch=next&branch=other", "unknown=next", "branch="):
            with self.subTest(query=query), self.assertRaisesRegex(ValueError, "Git reference is ambiguous"):
                self.check(sources, ["git+https://example.test/dep?" + query + "#" + "a" * 40])


class CompanionReleaseTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.bundle = Bundle(Path(temporary.name))
        self.companion = CompanionBundle(self.bundle)

    def verify(self):
        return release.verify(self.bundle.metadata_path)

    def fails(self, message):
        with self.assertRaisesRegex((ValueError, KeyError), message):
            self.verify()

    def test_optional_companion_closure_passes_without_build_or_device_claim(self):
        result = self.verify()
        self.assertEqual(result["bundle_validation"], "PASS")
        self.assertEqual(result["independent_rebuild"], "NOT_RUN")
        self.assertEqual(result["device_validation"], "not_performed")

    def test_cargo_vendor_semver_build_metadata_passes_full_bundle_validation(self):
        with tempfile.TemporaryDirectory() as directory:
            bundle = Bundle(Path(directory))
            CompanionBundle(bundle, registry_name="ndk-sys", registry_version="0.6.0+11769913")
            self.assertEqual(release.verify(bundle.metadata_path)["bundle_validation"], "PASS")

    def test_cargo_vendor_directory_rejects_unsafe_components(self):
        for directory in (
            "",
            ".",
            "..",
            "../crate",
            "crate/child",
            "crate\\child",
            "/crate",
            "crate name",
            "crate\tname",
            "crate\nname",
            "crate\x00name",
            "crate\x1fname",
            "crate%2fchild",
            "crate%2e%2e",
            "crate:stream",
            None,
            7,
        ):
            with self.subTest(directory=directory), self.assertRaisesRegex(ValueError, "single safe component"):
                release.cargo_vendor_directory(directory)

    def test_cargo_build_metadata_does_not_relax_external_artifact_names(self):
        with self.assertRaisesRegex(ValueError, "single safe filename"):
            release.name("source-0.6.0+11769913.tar.gz")

    def test_packaged_companion_requires_exported_metadata_binding(self):
        del self.bundle.metadata["companion"]
        self.bundle.save_metadata()
        self.fails("Companion package/build metadata")

    def test_packaged_companion_requires_nested_source(self):
        del self.bundle.runtime["companion/companion-source.tar.gz"]
        self.bundle.write()
        self.fails("runtime source set is incomplete")

    def test_unpaired_companion_source_is_rejected(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        plain = Bundle(Path(temporary.name))
        plain.runtime["companion/source-closure.json"] = b"{}"
        plain.write()
        with self.assertRaisesRegex(ValueError, "Unexpected companion source"):
            release.verify(plain.metadata_path)

    def test_companion_binary_requires_executable_mode(self):
        self.bundle.modes[self.bundle.prefix + "bin/ottplay-companion"] = 0o644
        self.bundle.write()
        self.fails("mode 0755")

    def test_nested_manifest_hashes_are_checked_after_outer_hash_refresh(self):
        self.companion.payload["cargo-config.toml"] += b"# changed\n"
        self.companion.write_archive(refresh_manifest=False)
        self.fails("manifest file set/hash")

    def test_rehashed_cargo_config_must_map_every_locked_origin(self):
        original = self.companion.payload["cargo-config.toml"]
        for config in (
            b'[source.unused]\ndirectory="cargo-vendor"\n',
            original.replace(b'git="https://example.test/dep"', b'git="https://other.test/dep"'),
        ):
            with self.subTest(config=config):
                self.companion.payload["cargo-config.toml"] = config
                self.companion.write_archive()
                self.fails("locked source mapping missing")

    def test_local_source_inventory_rejects_missing_file(self):
        del self.companion.local["src/main.rs"]
        self.companion.write()
        self.fails("local source inventory mismatch")

    def test_local_source_inventory_rejects_changed_bytes(self):
        self.companion.local["src/main.rs"] += b"// changed\n"
        self.companion.write()
        self.fails("Source member digest mismatch")

    def test_private_file_in_nested_local_source_is_rejected(self):
        self.companion.local["ottplay-control.json"] = b"private fixture"
        self.companion.refresh_inventory()
        self.companion.write()
        self.fails("Private configuration/state")

    def test_nested_traversal_and_symlink_are_rejected(self):
        self.companion.local["../outside"] = b"fixture"
        self.companion.write()
        self.fails("Unsafe archive member")
        link = tarfile.TarInfo("escape")
        link.type, link.linkname = tarfile.SYMTYPE, "/etc/passwd"
        self.companion.local_override = tar_bytes({}, extra=link)
        self.companion.write()
        self.fails("Nonregular archive")

    def test_nested_sparse_parser_cannot_run(self):
        self.companion.local_override = pax_bytes({"GNU.sparse.major": "1", "GNU.sparse.minor": "0"}, data=b"1\n")
        self.companion.write()
        with patch.object(
            tarfile.TarInfo, "_proc_gnusparse_10", side_effect=AssertionError("must not parse")
        ) as parser:
            self.fails("Sparse archive")
        parser.assert_not_called()

    def test_cargo_lock_and_dependency_receipt_must_match(self):
        self.companion.local["Cargo.lock"] = self.companion.local["Cargo.lock"].replace(
            b'version = "1.0.0"', b'version = "9.0.0"'
        )
        self.companion.refresh_inventory()
        self.companion.write()
        self.fails("Cargo.lock dependency receipt")

    def test_vendored_file_checksums_are_checked(self):
        self.companion.vendor["cargo-vendor/fixture-1.0.0/src/lib.rs"] += b"// changed\n"
        self.companion.write()
        self.fails("Source member digest mismatch")

    def test_vendored_package_cannot_be_missing(self):
        self.companion.vendor = {
            path: data for path, data in self.companion.vendor.items() if "fixture-git-" not in path
        }
        self.companion.write()
        self.fails("vendor/lock component set")

    def test_vendored_git_identity_must_match_locked_commit(self):
        self.companion.components[1]["source"] = "git+https://example.test/dep#" + "9" * 40
        self.companion.write()
        self.fails("vendor component identity")

    def test_rust_compiler_commit_is_checked(self):
        self.companion.receipt["rustc"] = self.companion.receipt["rustc"].replace(self.companion.commit, "9" * 40)
        self.companion.write()
        self.fails("Rust compiler/source commit")

    def test_rust_full_archived_policy_pin_is_required(self):
        for pin in (None, self.companion.commit[:9], "g" * 40):
            with self.subTest(pin=pin):
                if pin is None:
                    del self.companion.spec["rust_commit"]
                else:
                    self.companion.spec["rust_commit"] = pin
                self.companion.refresh_policy()
                self.companion.write()
                self.fails("Rust policy requires a full commit pin")

    def test_matching_rust_compiler_and_sources_cannot_override_archived_pin(self):
        # Same nine-character version prefix is insufficient: the full pin matters.
        self.companion.spec["rust_commit"] = self.companion.commit[:9] + "9" * 31
        self.companion.refresh_policy()
        self.companion.write()
        self.fails("Rust compiler/source commit")

    def test_rust_compiler_identity_cannot_have_duplicate_commit_or_release(self):
        original = self.companion.receipt["rustc"]
        for field, message in (("commit-hash: " + self.companion.commit, "commit"), ("release: 1.96.1", "version")):
            with self.subTest(field=field):
                self.companion.receipt["rustc"] = original + "\n" + field
                self.companion.write()
                self.fails("Rust compiler.*" + message)

    def test_rust_source_checksum_is_checked(self):
        self.companion.rust_archive += b"modified"
        self.companion.write()
        self.fails("Source member digest mismatch")

    def test_rust_source_xz_dictionary_allocation_is_bounded(self):
        with patch.object(release, "XZ_MEMORY_LIMIT", 1024), self.assertRaises(release.lzma.LZMAError):
            self.verify()

    def test_rehashed_rust_archive_with_only_lock_marker_is_rejected(self):
        self.companion.rust_files = {"Cargo.lock": b"version = 4\n"}
        self.companion.refresh_rust_archive()
        self.companion.write()
        self.fails("Rust library source missing or empty: Cargo.toml")

    def test_rehashed_rust_archive_requires_nonempty_regular_library_inputs(self):
        original = self.companion.rust_files.copy()
        for path in original:
            for kind in ("missing", "empty", "directory"):
                with self.subTest(path=path, kind=kind):
                    self.companion.rust_files = original.copy()
                    del self.companion.rust_files[path]
                    extra = None
                    if kind == "empty":
                        self.companion.rust_files[path] = b""
                    elif kind == "directory":
                        extra = tarfile.TarInfo("rust-src-1.96.1/rust-src/lib/rustlib/src/rust/library/" + path)
                        extra.type = tarfile.DIRTYPE
                    self.companion.refresh_rust_archive(extra=extra)
                    self.companion.write()
                    self.fails("Rust library source missing or empty")

    def test_companion_sdk_linkage_cannot_point_to_another_receipt(self):
        self.bundle.runtime_manifest["shipped_elfs"]["ottplay-companion"]["link_receipt_sha256"] = "9" * 64
        self.bundle.write()
        self.fails("SDK/link evidence")

    def test_companion_backend_hash_is_required_and_bound_at_each_stage(self):
        stages = (
            (self.companion.linkage, "compiler_backend_sha256"),
            (self.companion.receipt["sdk"]["executables"], "gcc_backend"),
            (self.bundle.runtime_manifest["shipped_elfs"]["ottplay-companion"], "compiler_backend_sha256"),
        )
        for stage, key in stages:
            original = stage[key]
            for value in (None, "9" * 64):
                with self.subTest(key=key, value=value):
                    if value is None:
                        stage.pop(key)
                    else:
                        stage[key] = value
                    self.companion.write()
                    self.fails("compiler SDK/link evidence mismatch: backend")
            stage[key] = original

    def test_companion_requires_compiler_attestation_against_pinned_sdk_archive(self):
        sdk = self.bundle.runtime_manifest["sdk_attestation"]
        original = sdk.pop("companion_compiler")
        self.bundle.write()
        self.fails("compiler SDK archive attestation")
        sdk["companion_compiler"] = original
        original["archive_match"] = "NOT_RUN"
        self.bundle.write()
        self.fails("compiler SDK archive attestation")

    def test_companion_compiler_archive_hashes_bind_wrapper_and_backend(self):
        compilers = self.bundle.runtime_manifest["sdk_attestation"]["companion_compiler"]
        for name in ("compiler", "backend"):
            with self.subTest(name=name):
                original = compilers[name]["sha256"]
                compilers[name]["sha256"] = "9" * 64
                self.bundle.write()
                self.fails("compiler SDK/link evidence mismatch: " + name)
                compilers[name]["sha256"] = original

    def test_companion_compiler_sdk_paths_are_safe_distinct_files(self):
        compilers = self.bundle.runtime_manifest["sdk_attestation"]["companion_compiler"]
        for path in ("/tmp/compiler", "../compiler", "./bin/compiler", ".", compilers["compiler"]["sdk_path"]):
            with self.subTest(path=path):
                compilers["backend"]["sdk_path"] = path
                self.bundle.write()
                self.fails("Unsafe archive member|compiler SDK paths")

    def test_companion_backend_digest_must_be_valid_even_if_every_receipt_agrees(self):
        self.companion.linkage["compiler_backend_sha256"] = "invalid"
        self.companion.receipt["sdk"]["executables"]["gcc_backend"] = "invalid"
        self.bundle.runtime_manifest["shipped_elfs"]["ottplay-companion"]["compiler_backend_sha256"] = "invalid"
        self.bundle.runtime_manifest["sdk_attestation"]["companion_compiler"]["backend"]["sha256"] = "invalid"
        self.companion.write()
        self.fails("Invalid SHA-256")

    def test_companion_link_archive_inventory_is_required(self):
        del self.bundle.runtime_manifest["shipped_elfs"]["ottplay-companion"]["archive_inputs"]
        self.bundle.write()
        self.fails("archive inventory missing")

    def test_companion_link_archive_inventory_matches_published_linker_inputs(self):
        self.bundle.runtime_manifest["shipped_elfs"]["ottplay-companion"]["archive_inputs"].pop(0)
        self.bundle.write()
        self.fails("differs from published linker inputs")

    def test_companion_link_archive_inventory_does_not_claim_current_ephemeral_files(self):
        row = self.bundle.runtime_manifest["shipped_elfs"]["ottplay-companion"]["archive_inputs"][0]
        row["validation"] = "link_time_only_ephemeral"
        self.bundle.write()
        self.fails("archive validation scope")

    def test_companion_link_archive_inventory_sdk_hash_matches_attestation(self):
        row = self.bundle.runtime_manifest["shipped_elfs"]["ottplay-companion"]["archive_inputs"][1]
        row["sha256"] = "9" * 64
        self.bundle.write()
        self.fails("SDK archive digest")

    def test_companion_rebuild_claim_cannot_be_promoted(self):
        self.companion.manifest["bit_identical_rebuild"] = "PASS"
        self.companion.write_archive()
        self.fails("locked source or rebuild status")

    def test_packaged_companion_notices_must_match_local_sources(self):
        self.bundle.package[self.companion.prefix + "licenses/LICENSE"] += b"changed"
        self.bundle.write()
        self.fails("Source member digest mismatch")


if __name__ == "__main__":
    unittest.main()
