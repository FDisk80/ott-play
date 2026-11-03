"""Offline regression checks for identity and native-package validation."""

import importlib.util
import io
import json
import tarfile
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("native_webos_build", Path(__file__).with_name("build.py"))
build = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(build)


def tar_bytes(files):
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w:gz") as tar:
        for name, data in files.items():
            member = tarfile.TarInfo(name)
            member.size = len(data)
            tar.addfile(member, io.BytesIO(data))
    return raw.getvalue()


def ar_bytes(files):
    data = bytearray(b"!<arch>\n")
    for name, content in files.items():
        data.extend((f"{name + '/':<16}{0:<12}{0:<6}{0:<6}{'100644':<8}{len(content):<10}`\n").encode())
        data.extend(content)
        if len(content) % 2:
            data.extend(b"\n")
    return bytes(data)


def fixture(spec, *, kind="native", arm=True, service=True):
    app = spec["application"]
    prefix = "usr/palm/applications/" + app["id"] + "/"
    binary = bytearray(52)
    binary[:6] = b"\x7fELF\x01\x01"
    binary[18:20] = (40 if arm else 62).to_bytes(2, "little")
    files = {
        prefix + "appinfo.json": json.dumps(dict(app, type=kind, main="plxnative")).encode(),
        prefix + "plxnative": bytes(binary),
        prefix + "libavformat-plx.so.63": b"fixture",
        prefix + "licenses/LICENSE": (Path(__file__).with_name("COPYING")).read_bytes(),
        prefix + "THIRD-PARTY-NOTICES.md": b"Fixture dependency notices",
    }
    if service:
        files["usr/palm/services/" + app["id"] + ".storage/plxnative-storage"] = bytes(binary)
    service_id = app["id"] + ".storage"
    files["usr/palm/services/" + service_id + "/services.json"] = json.dumps(
        {
            "id": service_id,
            "engine": "native",
            "executable": "plxnative-storage",
            "services": [{"name": service_id, "commands": []}],
        }
    ).encode()
    files["usr/palm/packages/" + app["id"] + "/packageinfo.json"] = json.dumps(
        {
            "id": app["id"],
            "app": app["id"],
            "version": app["version"],
            "services": [service_id],
            "package_format_version": 2,
            "requiredPermissions": ["database.operation", "securitykey.operation"],
        }
    ).encode()
    control = f"Package: {app['id']}\nVersion: {app['version']}\nLicense: GPL-3.0-or-later\nArchitecture: arm\nwebOS-Package-Format-Version: 2\n".encode()
    return ar_bytes(
        {"debian-binary": b"2.0\n", "control.tar.gz": tar_bytes({"control": control}), "data.tar.gz": tar_bytes(files)}
    )


class NativePackageTests(unittest.TestCase):
    def changed(self, change, *, control=False):
        members = build.ar_members(fixture(build.manifest()))
        key = "control.tar.gz" if control else "data.tar.gz"
        files = build.tar_files(members[key])
        change(files)
        members[key] = tar_bytes(files)
        archive = ar_bytes(members)
        return archive

    def verify(self, data):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "candidate.ipk"
            path.write_bytes(data)
            return build.verify_ipk(path, build.manifest())

    def test_native_arm_package_has_distinct_identity(self):
        result = self.verify(fixture(build.manifest()))
        self.assertEqual(result["application"]["id"], "com.openottplay.player.native")
        self.assertFalse(result["rootRequired"])
        self.assertEqual(len(result["sha256"]), 64)

    def test_web_launcher_cannot_masquerade_as_native(self):
        with self.assertRaisesRegex(ValueError, "identity"):
            self.verify(fixture(build.manifest(), kind="web"))

    def test_host_binary_cannot_be_packaged_as_arm(self):
        with self.assertRaisesRegex(ValueError, "ELF32 ARM"):
            self.verify(fixture(build.manifest(), arm=False))

    def test_native_storage_service_is_required(self):
        with self.assertRaises(KeyError):
            self.verify(fixture(build.manifest(), service=False))

    def test_truncated_ipk_is_rejected(self):
        with self.assertRaises(ValueError):
            self.verify(fixture(build.manifest())[:-17])

    def test_tar_traversal_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unsafe"):
            build.tar_files(tar_bytes({"../escape": b"bad"}))

    def test_empty_and_absolute_archive_names_are_rejected(self):
        for name in ("", "/absolute", "a/../../bad", "a\\bad"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                build.safe_name(name)

    def test_symlink_payload_is_rejected(self):
        raw = io.BytesIO()
        with tarfile.open(fileobj=raw, mode="w:gz") as tar:
            member = tarfile.TarInfo("runtime")
            member.type = tarfile.SYMTYPE
            member.linkname = "/tmp/runtime"
            tar.addfile(member)
        with self.assertRaisesRegex(ValueError, "Unsupported"):
            build.tar_files(raw.getvalue())

    def test_package_descriptor_is_required(self):
        key = "usr/palm/packages/com.openottplay.player.native/packageinfo.json"
        with self.assertRaises(KeyError):
            self.verify(self.changed(lambda files: files.pop(key)))

    def test_package_cannot_claim_a_foreign_service(self):
        key = "usr/palm/packages/com.openottplay.player.native/packageinfo.json"

        def change(files):
            value = json.loads(files[key])
            value["services"] = ["other.service"]
            files[key] = json.dumps(value).encode()

        with self.assertRaisesRegex(ValueError, "ownership"):
            self.verify(self.changed(change))

    def test_service_executable_must_be_the_owned_native_helper(self):
        key = "usr/palm/services/com.openottplay.player.native.storage/services.json"

        def change(files):
            value = json.loads(files[key])
            value["executable"] = "/bin/sh"
            files[key] = json.dumps(value).encode()

        with self.assertRaisesRegex(ValueError, "activation"):
            self.verify(self.changed(change))

    def test_foreign_service_payload_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unexpected package path"):
            self.verify(self.changed(lambda files: files.update({"usr/palm/services/other/runtime": b"fixture"})))

    def test_private_profiles_and_state_are_rejected(self):
        prefix = "usr/palm/applications/" + build.manifest()["application"]["id"] + "/"
        for path in (
            "ottplay-profile.json",
            "ottplay-control.json",
            "ott-state.json",
            "nested/ott-state.json",
            "ott-state/OttControl",
            "ott-state/OttState",
            "nested/ottplay-control.json",
            "nested/ott-state/record",
        ):
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, "Private profiles"):
                self.verify(self.changed(lambda files, path=path: files.update({prefix + path: b"private fixture"})))

    def test_installer_hook_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unexpected package path"):
            self.verify(self.changed(lambda files: files.update({"postinst": b"fixture"}), control=True))

    def test_duplicate_control_identity_is_rejected(self):
        def change(files):
            files["control"] += b"Package: different.application\n"

        with self.assertRaisesRegex(ValueError, "duplicate IPK control"):
            self.verify(self.changed(change, control=True))


class NativeSdkTests(unittest.TestCase):
    def test_bootstrap_does_not_update_global_rustup_manager(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            sdk = root / "sdk"
            (sdk / "bin").mkdir(parents=True)
            (sdk / "bin/arm-webos-linux-gnueabi-gcc").write_text("fixture")
            source = root / "source"
            (source / "rust-modules").mkdir(parents=True)
            (source / "rust-modules/rust-toolchain.toml").write_text('[toolchain]\nchannel = "1.99.1"\n')
            args = SimpleNamespace(work_dir=root, sdk=sdk)
            with patch.object(build, "check_source", return_value=source), patch.object(build, "run") as run:
                build.bootstrap(args, build.manifest())
            command = run.call_args_list[0].args[0]
            self.assertEqual(command[:3], ["rustup", "toolchain", "install"])
            self.assertIn("--no-self-update", command)
            self.assertIn("1.99.1", command)

    def symlink(self, name, target):
        member = tarfile.TarInfo(name)
        member.type = tarfile.SYMTYPE
        member.linkname = target
        return member

    def test_absolute_target_sysroot_link_is_relocated_inside_sdk(self):
        with tempfile.TemporaryDirectory() as directory:
            member = self.symlink("sdk/arm-webos-linux-gnueabi/sysroot/sbin/udevadm", "/bin/udevadm")
            result = build.sdk_extract_filter(member, directory, "sdk")
            self.assertEqual(result.linkname, "../bin/udevadm")
            self.assertEqual(member.linkname, "/bin/udevadm")

    def test_absolute_host_link_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            member = self.symlink("sdk/bin/compiler", "/usr/bin/compiler")
            with self.assertRaisesRegex(ValueError, "outside its target sysroot"):
                build.sdk_extract_filter(member, directory, "sdk")

    def test_absolute_link_cannot_traverse_or_follow_ancestor_out_of_sysroot(self):
        with tempfile.TemporaryDirectory() as directory:
            member = self.symlink("sdk/arm-webos-linux-gnueabi/sysroot/sbin/udevadm", "/../escape")
            with self.assertRaisesRegex(ValueError, "Unsafe archive"):
                build.sdk_extract_filter(member, directory, "sdk")
            sysroot = Path(directory) / "sdk/arm-webos-linux-gnueabi/sysroot"
            sysroot.mkdir(parents=True)
            (sysroot / "sbin").symlink_to(Path(directory), target_is_directory=True)
            member.linkname = "/bin/udevadm"
            with self.assertRaisesRegex(ValueError, "ancestor leaves"):
                build.sdk_extract_filter(member, directory, "sdk")

    def test_relative_link_cannot_escape_the_destination(self):
        with tempfile.TemporaryDirectory() as directory:
            member = self.symlink("sdk/bin/compiler", "../../../outside")
            with self.assertRaises(tarfile.LinkOutsideDestinationError):
                build.sdk_extract_filter(member, directory, "sdk")


class NativeFeedTests(unittest.TestCase):
    def test_metadata_and_download_origins_can_be_separate(self):
        with tempfile.TemporaryDirectory() as directory:
            args = SimpleNamespace(
                output=Path(directory),
                base_url="https://metadata.example/native",
                download_base_url="https://downloads.example/release",
            )
            build.feed(args, build.manifest(), {"sha256": "fixture", "payload_bytes": 10, "size": 12}, "native.ipk")
            result = json.loads((args.output / "ottplay-native-webos-manifest.json").read_text())
            self.assertEqual(result["ipkUrl"], "https://downloads.example/release/native.ipk")
            self.assertTrue(result["iconUri"].startswith("https://metadata.example/"))
            self.assertTrue(result["sourceUrl"].endswith("-source-set.json"))
            self.assertEqual(len(result["sourceArchiveUrls"]), 2)

    def test_same_origin_is_default_and_unsafe_download_origin_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            args = SimpleNamespace(output=Path(directory), base_url="https://metadata.example/native")
            verified = {"sha256": "fixture", "payload_bytes": 10, "size": 12}
            build.feed(args, build.manifest(), verified, "native.ipk")
            result = json.loads((args.output / "ottplay-native-webos-manifest.json").read_text())
            self.assertEqual(result["ipkUrl"], "https://metadata.example/native/native.ipk")
            for value in (
                "http://downloads.example",
                "https://user:pass@downloads.example",
                "https://example.org/?token=x",
            ):
                args.download_base_url = value
                with self.assertRaisesRegex(ValueError, "plain HTTPS"):
                    build.feed(args, build.manifest(), verified, "native.ipk")


class NativeSourceTests(unittest.TestCase):
    def verify(self, *, omit=None, url_only=False, excluded=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "ci").mkdir()
            (root / "ci/dependencies.json").write_text(json.dumps([{"id": "ffmpeg", "bundled": True}]))
            entries, files, dependencies = {}, {}, []
            for name in ("ffmpeg", "cargo-vendor", "rust-runtime"):
                if name == omit:
                    continue
                path = "dependencies/" + name + "/source.tar.gz"
                entries[path] = b"synthetic source fixture"
                dependencies.append({"id": name, "sources": [] if url_only else [{"path": path}]})
            for patch in (build.HERE / "patches").glob("*.patch"):
                name = "ci/ottplay-integration/patches/" + patch.name
                entries[name] = patch.read_bytes()
                files[name] = {"sha256": build.sha256(patch)}
            if excluded:
                entries[build.EXCLUDED_SOURCE] = b"excluded test fixture"
            source_manifest = {
                "git_commit": build.manifest()["revision"],
                "files": files,
                "dependencies": dependencies,
                "snapshot_sha256": "fixture",
            }
            entries["SOURCE-MANIFEST.json"] = json.dumps(source_manifest).encode()
            archive = root / "source.tar.gz"
            archive.write_bytes(tar_bytes(entries))
            archive.with_name(archive.name + ".release.json").write_text(
                json.dumps({"source_archive_sha256": build.sha256(archive)})
            )
            return build.verify_source_archive(archive, root, build.manifest())

    def test_dependency_source_bytes_are_present(self):
        self.assertEqual(self.verify()["snapshot_sha256"], "fixture")

    def test_missing_cargo_source_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "missing bundled dependency"):
            self.verify(omit="cargo-vendor")

    def test_urls_cannot_replace_source_bytes(self):
        with self.assertRaisesRegex(ValueError, "not only a URL"):
            self.verify(url_only=True)

    def test_excluded_implementation_cannot_enter_source_bundle(self):
        with self.assertRaisesRegex(ValueError, "Excluded"):
            self.verify(excluded=True)


if __name__ == "__main__":
    unittest.main()
