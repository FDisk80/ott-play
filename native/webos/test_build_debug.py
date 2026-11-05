"""Small diagnostic provenance contracts; no compiler, network or device."""
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import zlib

import build_debug as diagnostic
import test_build as package_fixtures


class DiagnosticEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.source = Path("/fixture/source")
        self.archive = self.source / "rust-modules/target-release/armv7-unknown-linux-gnueabi/release/libplxnative_modules.a"
        self.row = {
            "reason": "compiler-artifact", "features": ["devtriggers"],
            "manifest_path": str(self.source / "rust-modules/Cargo.toml"),
            "filenames": [str(self.archive)],
            "target": {"name": "plxnative_modules", "kind": ["staticlib"],
                       "crate_types": ["staticlib"], "src_path": str(self.source / "rust-modules/src/lib.rs")},
            "profile": {"opt_level": "2", "debuginfo": 0, "debug_assertions": False,
                        "overflow_checks": False, "test": False},
        }

    def raw(self, *rows):
        return "\n".join(json.dumps(row) for row in rows).encode()

    def check(self, row):
        return diagnostic.cargo_artifact(self.raw(row, {"reason": "build-finished", "success": True}),
                                         self.source, self.archive)

    def test_actual_diagnostic_profile_accepts_make_dwarf_override(self):
        self.assertEqual(self.check(self.row), self.row)

    def test_shipping_or_additional_features_cannot_claim_diagnostic(self):
        for features in ([], ["devtriggers", "hostsim"]):
            with self.subTest(features=features), self.assertRaises(ValueError):
                self.check(dict(self.row, features=features))

    def test_wrong_source_archive_profile_and_boolean_types_refused(self):
        for update in ({"manifest_path": "/another/Cargo.toml"}, {"filenames": ["/another/lib.a"]},
                       {"profile": dict(self.row["profile"], opt_level="s")},
                       {"profile": dict(self.row["profile"], test=0)}):
            with self.subTest(update=update), self.assertRaises(ValueError):
                self.check(dict(self.row, **update))

    def test_failed_duplicate_or_trailing_cargo_output_refused(self):
        done = {"reason": "build-finished", "success": True}
        for rows in ([self.row], [self.row, dict(done, success=False)], [self.row, self.row, done],
                     [self.row, done, {"reason": "build-script-executed"}]):
            with self.subTest(rows=len(rows)), self.assertRaises(ValueError):
                diagnostic.cargo_artifact(self.raw(*rows), self.source, self.archive)

    def test_source_mismatch_or_tracked_drift_refused(self):
        sha = "a" * 40
        for outputs in (["b" * 40], [sha, " M native/webos/build.py"]):
            with patch.object(diagnostic.native, "run", side_effect=outputs), self.assertRaises(ValueError):
                diagnostic.source_identity(sha)
        with self.assertRaises(ValueError):
            diagnostic.source_identity("main; echo invalid")

    def test_build_id_missing_or_ambiguous_refused(self):
        for output in ("", "Build ID: abc", "Build ID: " + "a" * 40 + "\nBuild ID: " + "b" * 40):
            with patch.object(diagnostic.native, "run", return_value=output), self.assertRaises(ValueError):
                diagnostic.build_id(Path("/sdk/readelf"), Path("/fixture/binary"))

    def test_library_and_executable_modes_match_packager_roles(self):
        app = "com.openottplay.player.native"
        prefix = "usr/palm/applications/" + app + "/"
        for name, mode in ((prefix + "plxnative", 0o755),
                           (prefix + "bin/ottplay-companion", 0o755),
                           (prefix + "libavformat-plx.so.63", 0o644),
                           (prefix + "libass-plx.so.0", 0o644),
                           ("usr/palm/services/" + app + ".storage/plxnative-storage", 0o755)):
            member = tarfile.TarInfo(name)
            member.mode = mode
            with self.subTest(name=name):
                self.assertTrue(diagnostic.elf_metadata_valid(member, app))
                member.mode = 0o777
                self.assertFalse(diagnostic.elf_metadata_valid(member, app))
                member.mode, member.uid = mode, 1
                self.assertFalse(diagnostic.elf_metadata_valid(member, app))
                member.uid, member.type = 0, tarfile.SYMTYPE
                self.assertFalse(diagnostic.elf_metadata_valid(member, app))
        unknown = tarfile.TarInfo(prefix + "unexpected")
        unknown.mode = 0o755
        self.assertFalse(diagnostic.elf_metadata_valid(unknown, app))


class DiagnosticPackageTests(unittest.TestCase):
    def package(self, extra=None):
        spec = diagnostic.native.manifest()
        members = diagnostic.native.ar_members(package_fixtures.fixture(spec))
        files = diagnostic.native.tar_files(members["data.tar.gz"])
        prefix = "usr/palm/applications/" + spec["application"]["id"] + "/"
        descriptor = json.loads(files[prefix + "appinfo.json"])
        descriptor.update(icon="icon.png", largeIcon="icon.png", splashBackground="icon.png")
        files[prefix + "appinfo.json"] = json.dumps(descriptor).encode()
        def chunk(kind, data):
            return len(data).to_bytes(4, "big") + kind + data + zlib.crc32(kind + data).to_bytes(4, "big")
        header = (1).to_bytes(4, "big") * 2 + bytes((8, 2, 0, 0, 0))
        files[prefix + "icon.png"] = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
                                       + chunk(b"IDAT", zlib.compress(b"\x00\x10\x20\x30"))
                                       + chunk(b"IEND", b""))
        if extra:
            files[prefix + extra] = b"synthetic-private-fixture"
        modes = {prefix + "plxnative": 0o755,
                 "usr/palm/services/" + spec["application"]["id"] + ".storage/plxnative-storage": 0o755}
        members["data.tar.gz"] = package_fixtures.tar_bytes(files, modes=modes)
        return package_fixtures.ar_bytes(members), spec

    def test_package_admission_needs_no_shipping_build_configuration(self):
        data, spec = self.package()
        with tempfile.TemporaryDirectory() as directory:
            ipk = Path(directory) / "diagnostic.ipk"
            ipk.write_bytes(data)
            self.assertEqual(diagnostic.verify_diagnostic_package(ipk, spec)["application"], spec["application"])

    def test_full_private_path_policy_rejects_structurally_valid_ipk(self):
        for private in ("lab.json", "ott-control.json", "config.local.h", "nested/lab.json"):
            with self.subTest(private=private), tempfile.TemporaryDirectory() as directory:
                data, spec = self.package(private)
                ipk = Path(directory) / "diagnostic.ipk"
                ipk.write_bytes(data)
                # Exercise the actual gap: the smaller structural verifier
                # accepts these paths; diagnostic admission must still reject.
                diagnostic.native.verify_ipk(ipk, spec)
                with self.assertRaisesRegex(ValueError, "Private configuration/state must not be packaged"):
                    diagnostic.verify_diagnostic_package(ipk, spec)

    def test_rejected_archive_never_reaches_eager_verifier(self):
        data, spec = self.package("nested/lab.json")
        with tempfile.TemporaryDirectory() as directory:
            ipk = Path(directory) / "diagnostic.ipk"
            ipk.write_bytes(data)
            with patch.object(diagnostic.native, "verify_ipk") as eager:
                with self.assertRaisesRegex(ValueError, "Private configuration/state must not be packaged"):
                    diagnostic.verify_diagnostic_package(ipk, spec)
                eager.assert_not_called()


if __name__ == "__main__":
    unittest.main()
