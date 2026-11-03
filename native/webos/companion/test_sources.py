import hashlib
import importlib.util
import io
import json
import shutil
import tarfile
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

LOADER = importlib.util.spec_from_file_location("companion_sources", Path(__file__).with_name("sources.py"))
sources = importlib.util.module_from_spec(LOADER)
LOADER.loader.exec_module(sources)


def digest(data):
    return hashlib.sha256(data).hexdigest()


class SourceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def local(self, changes=None, extra=None):
        content = b"exact source\n"
        row = {"path": "Cargo.toml", "sha256": digest(content), "bytes": len(content), "mode": 0o644}
        receipt = {"local_inputs": [row], "local_inputs_sha256": digest(sources.build.canonical([row]))}
        path = self.root / "local.tar.gz"
        with tarfile.open(path, "w:gz") as archive:
            for name, data in [
                ("source/Cargo.toml", content),
                ("source-receipt.json", sources.build.canonical(receipt)),
            ]:
                info = tarfile.TarInfo(name)
                info.mode, info.size = 0o644, len(data)
                if changes:
                    changes(info)
                archive.addfile(info, io.BytesIO(data))
            if extra:
                info = tarfile.TarInfo(extra)
                archive.addfile(info, io.BytesIO(b""))
        return path, receipt

    def extract(self, path, receipt):
        destination = self.root / "extracted"
        destination.mkdir()
        sources.extract_local(path, receipt, destination)
        return destination

    def package(self, package_hash="a" * 64):
        vendor = self.root / "vendor"
        folder = vendor / "demo-1.0.0"
        folder.mkdir(parents=True)
        files = {
            "Cargo.toml": b'[package]\nname="demo"\nversion="1.0.0"\nlicense="MIT"\n',
            "LICENSE": b"MIT example fixture\n",
            "src/lib.rs": b"pub fn example() {}\n",
        }
        for name, data in files.items():
            path = folder / name
            path.parent.mkdir(exist_ok=True)
            path.write_bytes(data)
        checksums = {"package": package_hash, "files": {name: digest(data) for name, data in files.items()}}
        (folder / ".cargo-checksum.json").write_text(json.dumps(checksums))
        package = {
            "name": "demo",
            "version": "1.0.0",
            "source": "registry+https://github.com/rust-lang/crates.io-index",
            "checksum": package_hash,
        }
        return vendor, folder, package

    def test_paths_reject_traversal_and_noncanonical_names(self):
        for name in ("", "/absolute", "../a", "a/../b", "a//b", "a/./b", "a\\b", "."):
            with self.subTest(name=name), self.assertRaises(ValueError):
                sources.safe_name(name)

    def test_extracts_only_exact_recorded_source(self):
        path, receipt = self.local()
        destination = self.extract(path, receipt)
        self.assertEqual((destination / "Cargo.toml").read_bytes(), b"exact source\n")

    def test_unknown_and_duplicate_members_are_rejected(self):
        for extra in ("source/unknown", "source/Cargo.toml"):
            with self.subTest(extra=extra):
                path, receipt = self.local(extra=extra)
                with self.assertRaises(ValueError):
                    sources.extract_local(path, receipt, self.root / extra.replace("/", "-"))

    def test_archive_links_and_privileged_modes_are_rejected(self):
        for change in (lambda m: setattr(m, "type", tarfile.SYMTYPE), lambda m: setattr(m, "mode", 0o4755)):
            path, receipt = self.local(changes=change)
            with self.assertRaises(ValueError):
                sources.extract_local(path, receipt, self.root / "out")

    def test_inventory_digest_corruption_is_rejected(self):
        path, receipt = self.local()
        receipt["local_inputs_sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "inventory digest"):
            self.extract(path, receipt)

    def test_changed_source_bytes_are_rejected(self):
        path, receipt = self.local()
        receipt["local_inputs"][0]["sha256"] = "0" * 64
        receipt["local_inputs_sha256"] = digest(sources.build.canonical(receipt["local_inputs"]))
        with self.assertRaisesRegex(ValueError, "bytes differ"):
            self.extract(path, receipt)

    def test_locked_vendor_files_are_verified(self):
        vendor, _, package = self.package()
        result = sources.verify_vendor(vendor, [package])
        self.assertEqual(result[0]["files"], 3)
        self.assertEqual(result[0]["checksum"], package["checksum"])

    def test_modified_vendor_file_is_rejected(self):
        vendor, folder, package = self.package()
        (folder / "src/lib.rs").write_text("modified")
        with self.assertRaisesRegex(ValueError, "file checksum"):
            sources.verify_vendor(vendor, [package])

    def test_extra_vendor_file_is_rejected(self):
        vendor, folder, package = self.package()
        (folder / "unexpected").touch()
        with self.assertRaisesRegex(ValueError, "file set"):
            sources.verify_vendor(vendor, [package])

    def test_vendor_symlink_is_rejected(self):
        vendor, folder, package = self.package()
        (folder / "src/lib.rs").unlink()
        (folder / "src/lib.rs").symlink_to(folder / "LICENSE")
        with self.assertRaisesRegex(ValueError, "symlink"):
            sources.verify_vendor(vendor, [package])

    def test_wrong_package_checksum_and_missing_package_are_rejected(self):
        vendor, _, package = self.package()
        wrong = dict(package, checksum="0" * 64)
        with self.assertRaisesRegex(ValueError, "uniquely match"):
            sources.verify_vendor(vendor, [wrong])
        with self.assertRaisesRegex(ValueError, "Missing locked"):
            sources.verify_vendor(vendor, [package, dict(package, name="missing")])

    def test_git_coordinates_require_full_commit(self):
        vendor, _, package = self.package(None)
        package.pop("checksum")
        package["source"] = "git+https://example.invalid/repo#" + "a" * 40
        self.assertEqual(sources.verify_vendor(vendor, [package])[0]["source"], package["source"])
        package["source"] = "git+https://example.invalid/repo#main"
        with self.assertRaisesRegex(ValueError, "exact locked commit"):
            sources.verify_vendor(vendor, [package])

    def test_normalizes_vendor_configuration(self):
        vendor = self.root / "vendor"
        text = (
            '[source.crates-io]\nreplace-with="vendored-sources"\n[source.vendored-sources]\ndirectory='
            + json.dumps(str(vendor))
            + "\n"
        )
        result = sources.vendor_config(text, vendor)
        self.assertIn('directory="cargo-vendor"', result)
        self.assertNotIn(str(self.root), result)
        with self.assertRaises(ValueError):
            sources.vendor_config(text, self.root / "other")

    def test_archive_is_deterministic_and_has_no_links(self):
        file = self.root / "file"
        file.write_text("fixture")
        first, second = self.root / "1.tar.gz", self.root / "2.tar.gz"
        sources.write_archive(first, {"path/file": file})
        sources.write_archive(second, {"path/file": file})
        self.assertEqual(first.read_bytes(), second.read_bytes())
        with tarfile.open(first) as archive:
            self.assertEqual(archive.getmembers()[0].mtime, 0)

    def rust_fixture(self):
        sysroot = self.root / "rust"
        library = sysroot / "lib/rustlib"
        library.mkdir(parents=True)
        notices = sysroot / "share/doc/rust"
        (notices / "licenses").mkdir(parents=True)
        for name in ("COPYRIGHT.html", "COPYRIGHT-library.html", "licenses/MIT.txt"):
            (notices / name).write_text("public fixture license")
        commit = sources.build.SPEC["rust_commit"]
        version = "1.96.1 (" + commit[:9] + " 2026-06-26)"
        identity = "rustc " + version + "\nrelease: 1.96.1\ncommit-hash: " + commit
        path = self.root / "rust-src.tar.xz"
        with tarfile.open(path, "w:xz") as archive:
            info = tarfile.TarInfo("rust-src-1.96.1/rust-src/lib/rustlib/src/rust/library/Cargo.lock")
            archive.addfile(info, io.BytesIO(b""))
        manifest = "\n".join(
            "[pkg." + p + "]\nversion=" + json.dumps(version) for p in ("rustc", "rust-std", "rust-src")
        )
        manifest += '\n[pkg.rust-src.target."*"]\nhash="' + sources.build.sha(path) + '"\n'
        (library / "multirust-channel-manifest.toml").write_text(manifest)
        return sysroot, path, {"rustc": identity}, {"rust_toolchain": "1.96.1", "rust_commit": commit}

    def test_rust_archive_and_compiler_commit_are_verified(self):
        sysroot, archive, receipt, spec = self.rust_fixture()
        with patch.object(sources.build, "run", return_value=receipt["rustc"]):
            result, notices = sources.rust_sources(sysroot, archive, receipt, spec)
        self.assertTrue(result["source_archive_hash_verified"])
        self.assertIn("COPYRIGHT-library.html", notices)
        self.assertEqual(result["commit"], spec["rust_commit"])

    def test_rust_commit_suffix_mismatch_fails_even_with_matching_build_receipt(self):
        sysroot, archive, receipt, spec = self.rust_fixture()
        wrong = spec["rust_commit"][:-1] + ("0" if spec["rust_commit"][-1] != "0" else "1")
        receipt["rustc"] = receipt["rustc"].replace(spec["rust_commit"], wrong)
        with patch.object(sources.build, "run", return_value=receipt["rustc"]), self.assertRaises(ValueError):
            sources.rust_sources(sysroot, archive, receipt, spec)

    def linkage_fixture(self):
        bundle = self.root / "bundle"
        root = self.root / "source"
        bundle.mkdir()
        manifest_path = root / "native/webos/companion/manifest.json"
        manifest_path.parent.mkdir(parents=True)
        spec = {
            "package": "ottplay-companion",
            "target": "armv7-unknown-linux-gnueabi",
            "features": [],
            "required_source_files": [],
        }
        manifest_path.write_text(json.dumps(spec))
        (bundle / "source-receipt.json").write_text(json.dumps({"schema": 1, "local_inputs": []}))
        for name in (
            "local-source.tar.gz",
            "ottplay-companion",
            "ottplay-companion.link.map",
            "ottplay-companion.link.trace",
        ):
            (bundle / name).write_bytes(b"fixture")
        file_hash = sources.build.sha(bundle / "ottplay-companion")
        record = {
            "elf_sha256": file_hash,
            "map_sha256": file_hash,
            "trace_sha256": file_hash,
            "archive_excluded": True,
            "compiler_sha256": "c" * 64,
            "compiler_backend_sha256": "b" * 64,
        }
        (bundle / "ottplay-companion.link.json").write_text(json.dumps(record))
        receipt = {
            "schema": 1,
            "package": spec["package"],
            "target": spec["target"],
            "features": [],
            "elf": {"sha256": file_hash},
            "manifest_sha256": sources.build.sha(manifest_path),
            "sdk": {
                "archive_sha256": "d" * 64,
                "executables": {
                    "gcc": "c" * 64,
                    "gcc_backend": "b" * 64,
                    "g++": "e" * 64,
                    "ar": "a" * 64,
                    "readelf": "f" * 64,
                },
            },
        }
        for name, key in (
            ("local-source.tar.gz", "local_source_archive_sha256"),
            ("source-receipt.json", "source_receipt_sha256"),
            ("ottplay-companion.link.map", "link_map_sha256"),
            ("ottplay-companion.link.trace", "link_trace_sha256"),
            ("ottplay-companion.link.json", "link_receipt_sha256"),
        ):
            receipt[key] = sources.build.sha(bundle / name)
        (bundle / "receipt.json").write_text(json.dumps(receipt))
        readelf = self.root / "sdk/bin/arm-webos-linux-gnueabi-readelf"
        return bundle, root, readelf, receipt

    def check_linkage(self, bundle, root, readelf, receipt):
        (bundle / "receipt.json").write_text(json.dumps(receipt))
        with (
            patch.object(sources, "extract_local"),
            patch.object(sources.build, "elf_report"),
            patch.object(sources.build, "inspect_elf", return_value=receipt["elf"]),
            patch.object(sources.build.linker, "check_evidence") as check,
        ):
            result = sources.checked_bundle(bundle, root, readelf)
        check.assert_called_once_with(
            bundle / "ottplay-companion", compiler=readelf.with_name("arm-webos-linux-gnueabi-gcc")
        )
        return result

    def test_linkage_verifies_sdk_compiler_and_preserves_backend_digest(self):
        result = self.check_linkage(*self.linkage_fixture())
        self.assertEqual(result[3]["compiler_backend_sha256"], "b" * 64)

    def test_linkage_rejects_only_outer_backend_digest_changed(self):
        bundle, root, readelf, receipt = self.linkage_fixture()
        receipt["sdk"]["executables"]["gcc_backend"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "compiler differs.*gcc_backend"):
            self.check_linkage(bundle, root, readelf, receipt)

    def test_linkage_rejects_only_outer_wrapper_digest_changed(self):
        bundle, root, readelf, receipt = self.linkage_fixture()
        receipt["sdk"]["executables"]["gcc"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "compiler differs.*gcc"):
            self.check_linkage(bundle, root, readelf, receipt)

    def test_linkage_requires_outer_compiler_hash_fields(self):
        bundle, root, readelf, original = self.linkage_fixture()
        for missing in ("sdk", "executables", "gcc", "gcc_backend"):
            with self.subTest(missing=missing):
                receipt = json.loads(json.dumps(original))
                if missing == "sdk":
                    receipt.pop("sdk")
                elif missing == "executables":
                    receipt["sdk"].pop("executables")
                else:
                    receipt["sdk"]["executables"].pop(missing)
                with self.assertRaisesRegex(ValueError, "compiler"):
                    self.check_linkage(bundle, root, readelf, receipt)

    def test_linkage_rejects_malformed_outer_compiler_hashes(self):
        bundle, root, readelf, original = self.linkage_fixture()
        for field in ("gcc", "gcc_backend"):
            for bad in (None, "", "not-a-sha256", 1):
                with self.subTest(field=field, value=bad):
                    receipt = json.loads(json.dumps(original))
                    receipt["sdk"]["executables"][field] = bad
                    with self.assertRaisesRegex(ValueError, "compiler"):
                        self.check_linkage(bundle, root, readelf, receipt)

    def test_wrong_rust_compiler_and_archive_are_rejected(self):
        sysroot, archive, receipt, spec = self.rust_fixture()
        with (
            patch.object(sources.build, "run", return_value="different"),
            self.assertRaisesRegex(ValueError, "compiler differs"),
        ):
            sources.rust_sources(sysroot, archive, receipt, spec)
        archive.write_bytes(b"wrong")
        with (
            patch.object(sources.build, "run", return_value=receipt["rustc"]),
            self.assertRaisesRegex(ValueError, "archive checksum"),
        ):
            sources.rust_sources(sysroot, archive, receipt, spec)

    def test_missing_rust_notices_are_rejected(self):
        sysroot, archive, receipt, spec = self.rust_fixture()
        (sysroot / "share/doc/rust/COPYRIGHT-library.html").unlink()
        with (
            patch.object(sources.build, "run", return_value=receipt["rustc"]),
            self.assertRaisesRegex(ValueError, "regular source"),
        ):
            sources.rust_sources(sysroot, archive, receipt, spec)

    def test_existing_output_is_never_overwritten(self):
        with self.assertRaisesRegex(ValueError, "new source output"):
            sources.collect(SimpleNamespace(output=self.root))

    def test_complete_collection_keeps_sdk_gate_pending_and_cleans_temporary_files(self):
        vendor_fixture, _, package = self.package()
        bundle = self.root / "bundle"
        bundle.mkdir()
        for name in ("local-source.tar.gz", "receipt.json", "source-receipt.json", "rust-src.tar.xz"):
            (bundle / name).write_bytes(b"fixture")
        receipt = {
            "elf": {"sha256": "e" * 64},
            "sdk": {"archive_sha256": "d" * 64},
            "local_source_archive_sha256": sources.build.sha(bundle / "local-source.tar.gz"),
            "source_receipt_sha256": sources.build.sha(bundle / "source-receipt.json"),
        }
        local = {"local_inputs_sha256": "a" * 64, "dependency_scope": "entire workspace"}
        spec = {
            "package": "ottplay-companion",
            "target": "armv7-unknown-linux-gnueabi",
            "features": [],
            "rust_toolchain": "1.96.1",
        }

        def checked(_bundle, root, _readelf):
            (root / "Cargo.toml").write_text("[workspace]\n")
            (root / "Cargo.lock").write_text("version=3\n")
            return receipt, local, spec, {"elf_sha256": "e" * 64, "trace_available": False}

        def run(command, **kwargs):
            self.assertIn("--offline", command)
            self.assertIn("--locked", command)
            self.assertEqual(kwargs["env"]["CARGO_NET_OFFLINE"], "true")
            vendor = Path(command[-1])
            shutil.copytree(vendor_fixture, vendor)
            return (
                '[source.crates-io]\nreplace-with="vendored-sources"\n[source.vendored-sources]\ndirectory='
                + json.dumps(str(vendor))
                + "\n"
            )

        args = SimpleNamespace(
            output=self.root / "output",
            bundle=bundle,
            readelf=self.root / "readelf",
            rust_sysroot=self.root / "compiler",
            rust_source_archive=bundle / "rust-src.tar.xz",
        )
        with (
            patch.object(sources, "checked_bundle", side_effect=checked),
            patch.object(sources, "lock_packages", return_value=[package]),
            patch.object(
                sources, "rust_sources", return_value=({"toolchain": "1.96.1"}, {"COPYRIGHT": bundle / "receipt.json"})
            ),
            patch.object(sources.build, "run", side_effect=run),
            patch("builtins.print"),
        ):
            sources.collect(args)
        closure = json.loads((args.output / "source-closure.json").read_text())
        self.assertFalse(closure["complete_corresponding_source"])
        self.assertEqual(closure["sdk_runtime_source_coverage"], "PENDING_ENCLOSING_RELEASE")
        self.assertEqual(closure["dependency_count"], 1)
        self.assertEqual(closure["local_source_archive_sha256"], receipt["local_source_archive_sha256"])
        self.assertEqual(closure["source_receipt_sha256"], receipt["source_receipt_sha256"])
        archive_path = args.output / "companion-source.tar.gz"
        self.assertEqual(closure["source_archive"]["sha256"], sources.build.sha(archive_path))
        with tarfile.open(archive_path) as archive:
            manifest = json.load(archive.extractfile("SOURCE-MANIFEST.json"))
            for name, row in manifest["files"].items():
                self.assertEqual(digest(archive.extractfile(name).read()), row["sha256"])
            self.assertIn("local-source.tar.gz", manifest["files"])
            self.assertNotIn("sdk", " ".join(manifest["files"]))
        self.assertFalse(list(self.root.glob("companion-sources-*")))


if __name__ == "__main__":
    unittest.main()
