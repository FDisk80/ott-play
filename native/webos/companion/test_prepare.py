import hashlib
import importlib.util
import io
import json
import os
import tempfile
import unittest
import urllib.request
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

LOADER = importlib.util.spec_from_file_location("companion_prepare", Path(__file__).with_name("prepare.py"))
prepare = importlib.util.module_from_spec(LOADER)
LOADER.loader.exec_module(prepare)


class PreparationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()

    def tearDown(self):
        self.temp.cleanup()

    def test_verified_archive_cache_does_not_download(self):
        archive = self.root / "rust-src-1.96.1.tar.xz"
        archive.write_bytes(b"fixture")
        opener = Mock()
        with patch.object(prepare, "RUST_SOURCE_SHA256", hashlib.sha256(b"fixture").hexdigest()):
            self.assertEqual(prepare.source_archive(self.root, opener), archive)
        opener.open.assert_not_called()

    def test_corrupt_cache_is_not_silently_replaced(self):
        archive = self.root / "rust-src-1.96.1.tar.xz"
        archive.write_bytes(b"corrupt")
        opener = Mock()
        with self.assertRaisesRegex(ValueError, "Cached Rust source digest"):
            prepare.source_archive(self.root, opener)
        self.assertEqual(archive.read_bytes(), b"corrupt")
        opener.open.assert_not_called()

    def test_download_is_pinned_and_verified_before_publication(self):
        opener = Mock()
        opener.open.return_value = io.BytesIO(b"fixture")
        with patch.object(prepare, "RUST_SOURCE_SHA256", hashlib.sha256(b"fixture").hexdigest()):
            archive = prepare.source_archive(self.root, opener)
        opener.open.assert_called_once_with(prepare.RUST_SOURCE_URL, timeout=60)
        self.assertEqual(archive.read_bytes(), b"fixture")
        self.assertFalse(list(self.root.glob("*.partial")))

    def test_bad_download_removes_only_its_partial_file(self):
        opener = Mock()
        opener.open.return_value = io.BytesIO(b"bad")
        unrelated = self.root / "unrelated"
        unrelated.write_text("keep")
        with self.assertRaisesRegex(ValueError, "Downloaded Rust source digest"):
            prepare.source_archive(self.root, opener)
        self.assertEqual(list(self.root.iterdir()), [unrelated])

    def test_download_size_bound(self):
        opener = Mock()
        opener.open.return_value = io.BytesIO(b"too large")
        with patch.object(prepare, "SOURCE_LIMIT", 1), self.assertRaisesRegex(ValueError, "download bound"):
            prepare.source_archive(self.root, opener)
        self.assertFalse(list(self.root.iterdir()))

    def test_redirect_rejects_http_other_hosts_and_credentials(self):
        handler = prepare.PinnedRedirect()
        request = urllib.request.Request(prepare.RUST_SOURCE_URL)
        for url in (
            "http://static.rust-lang.org/file",
            "https://example.org/file",
            "https://user@static.rust-lang.org/file",
        ):
            with self.subTest(url=url), self.assertRaisesRegex(ValueError, "pinned HTTPS host"):
                handler.redirect_request(request, None, 302, "redirect", {}, url)

    def test_libclang_selects_explicit_directory_and_probes_it(self):
        library = self.root / "libclang.so"
        library.touch()
        with patch.object(prepare, "probe_libclang") as probe, patch.object(prepare.sys, "platform", "linux"):
            self.assertEqual(prepare.find_libclang(self.root), library)
        probe.assert_called_once_with(library)

    def test_libclang_rejects_arbitrary_and_cpp_filenames(self):
        for name in ("custom-compiler.so", "libclang-cpp.so.18"):
            library = self.root / name
            library.touch()
            with (
                patch.object(prepare, "probe_libclang") as probe,
                patch.object(prepare.sys, "platform", "linux"),
                self.assertRaisesRegex(ValueError, "not discoverable"),
            ):
                prepare.find_libclang(library)
            probe.assert_not_called()

    def test_libclang_preserves_ubuntu_and_macos_symlink_aliases(self):
        for host, alias, target in (
            ("linux", "libclang.so", "libclang-18.so.18.1.3"),
            ("darwin", "libclang.dylib", "libclang.18.dylib"),
        ):
            with self.subTest(host=host):
                actual = self.root / target
                actual.touch()
                selected = self.root / alias
                selected.symlink_to(actual)
                with patch.object(prepare, "probe_libclang") as probe, patch.object(prepare.sys, "platform", host):
                    self.assertEqual(prepare.find_libclang(selected), selected)
                probe.assert_called_once_with(actual)

    def test_explicit_versioned_linux_library_is_not_replaced_by_sibling(self):
        selected = self.root / "libclang-18.so.18.1.3"
        selected.touch()
        (self.root / "libclang.so").touch()
        with patch.object(prepare, "probe_libclang") as probe, patch.object(prepare.sys, "platform", "linux"):
            self.assertEqual(prepare.find_libclang(selected), selected)
        probe.assert_called_once_with(selected)

    def test_libclang_missing_is_clear(self):
        with self.assertRaisesRegex(ValueError, "libclang-18-dev"):
            prepare.find_libclang(self.root)

    def rust_fixture(self):
        sysroot = self.root / "toolchain"
        rustlib = sysroot / "lib/rustlib"
        std = rustlib / "armv7-unknown-linux-gnueabi/lib"
        std.mkdir(parents=True)
        (std / "libstd-test.rlib").touch()
        version = prepare.RUST_VERSION + " (" + prepare.RUST_COMMIT[:9] + " 2026-06-26)"
        manifest = "\n".join(
            "[pkg." + package + "]\nversion=" + json.dumps(version) for package in ("rustc", "rust-src", "rust-std")
        )
        manifest += (
            '\n[pkg.rust-src.target."*"]\nxz_url='
            + json.dumps(prepare.RUST_SOURCE_URL)
            + "\nxz_hash="
            + json.dumps(prepare.RUST_SOURCE_SHA256)
            + "\n"
        )
        (rustlib / "multirust-channel-manifest.toml").write_text(manifest)
        identity = "rustc " + version + "\nrelease: " + prepare.RUST_VERSION + "\ncommit-hash: " + prepare.RUST_COMMIT
        return sysroot, identity

    def test_rust_exact_commit_and_target(self):
        sysroot, identity = self.rust_fixture()
        prepare.verify_rust(identity, sysroot, "armv7-unknown-linux-gnueabi")
        with self.assertRaisesRegex(ValueError, "release/commit"):
            prepare.verify_rust(identity.replace(prepare.RUST_COMMIT, "a" * 40), sysroot, "armv7-unknown-linux-gnueabi")
        with self.assertRaisesRegex(ValueError, "standard library"):
            prepare.verify_rust(identity, sysroot, "missing-target")

    def test_rust_manifest_source_pin_must_match(self):
        sysroot, identity = self.rust_fixture()
        manifest = sysroot / "lib/rustlib/multirust-channel-manifest.toml"
        manifest.write_text(manifest.read_text().replace(prepare.RUST_SOURCE_SHA256, "0" * 64))
        with self.assertRaisesRegex(ValueError, "pinned source archive"):
            prepare.verify_rust(identity, sysroot, "armv7-unknown-linux-gnueabi")

    def test_preparation_emits_isolated_environment_and_fetches_all_locked_targets(self):
        sysroot, identity = self.rust_fixture()
        source = self.root / "repo"
        source.mkdir()
        (source / "Cargo.toml").write_text("[workspace]\n")
        (source / "Cargo.lock").write_text(
            'version=3\n[[package]]\nname="example"\nversion="1.0.0"\nsource="registry+https://example.invalid"\n'
        )
        library = self.root / "libclang.so"
        library.touch()
        archive = self.root / "rust-src.tar.xz"
        archive.write_text("fixture")
        args = SimpleNamespace(
            root=source, cache_dir=self.root / "cache", target_dir=self.root / "target", libclang=library, output=None
        )
        calls = []

        def run(command, env):
            calls.append((command, env.copy()))
            if command[-2:] == ["--print", "sysroot"]:
                return str(sysroot)
            if command[-2:] == ["--version", "--verbose"]:
                return identity
            return ""

        with (
            patch.object(prepare.shutil, "which", return_value="/test/rustup"),
            patch.object(prepare, "probe_libclang"),
            patch.object(prepare, "run", side_effect=run),
            patch.object(prepare, "source_archive", return_value=archive),
            patch.object(prepare.sys, "platform", "linux"),
            patch("builtins.print"),
            patch.dict(
                os.environ,
                {"CARGO_HOME": "/ambient", "RUSTUP_DIST_SERVER": "http://bad.invalid", "RUSTFLAGS": "ambient"},
            ),
        ):
            result = prepare.prepare(args)
        self.assertFalse(result["compiled"])
        self.assertEqual(result["locked_external_packages"], 1)
        self.assertEqual(result["environment"]["CARGO_HOME"], str(args.cache_dir / "cargo"))
        self.assertEqual(result["environment"]["CARGO_BUILD_JOBS"], "2")
        self.assertEqual(result["environment"]["CARGO_NET_OFFLINE"], "true")
        self.assertEqual(result["environment"]["LIBCLANG_PATH"], str(library))
        self.assertEqual(result["libclang"], str(library))
        fetch = next(command for command, _ in calls if "fetch" in command)
        self.assertIn("--locked", fetch)
        self.assertNotIn("--target", fetch)
        self.assertFalse(any("build" in command or "default" in command for command, _ in calls))
        self.assertTrue(all("RUSTUP_DIST_SERVER" not in env and "RUSTFLAGS" not in env for _, env in calls))
        self.assertEqual(json.loads((args.cache_dir / "prepare.json").read_text()), result)


if __name__ == "__main__":
    unittest.main()
