"""Offline regression checks for identity and native-package validation."""

import hashlib
import importlib.util
import io
import json
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("native_webos_build", Path(__file__).with_name("build.py"))
build = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(build)


def tar_bytes(files, *, modes=None):
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w:gz") as tar:
        for name, data in files.items():
            member = tarfile.TarInfo(name)
            member.size = len(data)
            if modes and name in modes:
                member.mode = modes[name]
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


def json_bytes(value):
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode()


def companion_fixture(spec, *, change=None, mode=0o755):
    """Small real IPK; no cross compiler, SDK, device or external process."""
    members = build.ar_members(fixture(spec))
    files = build.tar_files(members["data.tar.gz"])
    prefix = "usr/palm/applications/" + spec["application"]["id"] + "/"
    binary_name = prefix + "bin/ottplay-companion"
    binary = files[prefix + "plxnative"] + b"companion fixture"
    manifest = (build.HERE / "companion/manifest.json").read_bytes()
    source = {
        "schema": 1,
        "local_inputs_sha256": "1" * 64,
        "local_source_archive_sha256": "2" * 64,
        "release_source_requirements": json.loads(manifest)["release_source_requirements"],
        "complete_corresponding_source": False,
    }
    receipt = {
        "schema": 1,
        "package": "ottplay-companion",
        "target": build.TARGET,
        "elf": {"sha256": hashlib.sha256(binary).hexdigest(), "bytes": len(binary)},
        "manifest_sha256": hashlib.sha256(manifest).hexdigest(),
        "source_receipt_sha256": "3" * 64,
        "local_inputs_sha256": source["local_inputs_sha256"],
        "local_source_archive_sha256": source["local_source_archive_sha256"],
        "link_map_sha256": "4" * 64,
        "link_trace_sha256": "5" * 64,
        "link_receipt_sha256": "6" * 64,
        "device_executed": False,
    }
    files.update(
        {
            binary_name: binary,
            prefix + "companion/manifest.json": manifest,
            prefix + "companion/receipt.json": json_bytes(receipt),
            prefix + "companion/source.json": json_bytes(source),
        }
    )
    if change:
        change(files, prefix)
    members["data.tar.gz"] = tar_bytes(files, modes={binary_name: mode})
    return ar_bytes(members)


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


class NativeCompanionTests(unittest.TestCase):
    def verify(self, data):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "candidate.ipk"
            path.write_bytes(data)
            return build.verify_ipk(path, build.manifest())

    def change_json(self, path, update):
        def change(files, prefix):
            name = prefix + "companion/" + path
            value = json.loads(files[name])
            update(value)
            files[name] = json_bytes(value)

        return change

    def test_valid_companion_is_bound_to_packaged_bytes(self):
        payload = companion_fixture(build.manifest())
        files = build.tar_files(build.ar_members(payload)["data.tar.gz"])
        prefix = "usr/palm/applications/" + build.manifest()["application"]["id"] + "/"
        result = self.verify(payload)["companion"]
        for key, path in (
            ("elf_sha256", "bin/ottplay-companion"),
            ("receipt_sha256", "companion/receipt.json"),
            ("manifest_sha256", "companion/manifest.json"),
        ):
            self.assertEqual(result[key], hashlib.sha256(files[prefix + path]).hexdigest())
        self.assertEqual(result["local_source_archive_sha256"], "2" * 64)
        self.assertEqual(result["local_inputs_sha256"], "1" * 64)

    def test_existing_package_without_companion_is_compatible(self):
        self.assertNotIn("companion", self.verify(fixture(build.manifest())))

    def test_altered_companion_binary_is_rejected(self):
        def change(files, prefix):
            files[prefix + "bin/ottplay-companion"] += b"tampered"

        with self.assertRaisesRegex(ValueError, "companion"):
            self.verify(companion_fixture(build.manifest(), change=change))

    def test_manifest_bytes_must_match_recorded_hash(self):
        change = self.change_json("manifest.json", lambda value: value.update(rust_toolchain="0.0.0"))
        with self.assertRaisesRegex(ValueError, "companion"):
            self.verify(companion_fixture(build.manifest(), change=change))

    def test_companion_receipt_identity_and_size_cannot_change(self):
        updates = (
            lambda value: value.update(package="another-package"),
            lambda value: value.update(target="x86_64-unknown-linux-gnu"),
            lambda value: value["elf"].update(bytes=1),
            lambda value: value.update(device_executed=True),
        )
        for index, update in enumerate(updates):
            with self.subTest(case=index), self.assertRaisesRegex(ValueError, "companion"):
                self.verify(companion_fixture(build.manifest(), change=self.change_json("receipt.json", update)))

    def test_source_metadata_cannot_claim_different_source_or_validation(self):
        for field, value in (
            ("local_inputs_sha256", "e" * 64),
            ("local_source_archive_sha256", "f" * 64),
            ("complete_corresponding_source", True),
            ("release_source_requirements", []),
            ("schema", 2),
        ):
            change = self.change_json("source.json", lambda data, field=field, value=value: data.update({field: value}))
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, "companion"):
                self.verify(companion_fixture(build.manifest(), change=change))

    def test_required_source_and_linker_hashes_cannot_be_omitted(self):
        for field in (
            "manifest_sha256",
            "source_receipt_sha256",
            "local_inputs_sha256",
            "local_source_archive_sha256",
            "link_map_sha256",
            "link_trace_sha256",
            "link_receipt_sha256",
        ):
            change = self.change_json("receipt.json", lambda value, field=field: value.pop(field))
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, "companion"):
                self.verify(companion_fixture(build.manifest(), change=change))

    def test_partial_companion_payload_is_rejected(self):
        paths = ("bin/ottplay-companion", "companion/manifest.json", "companion/receipt.json", "companion/source.json")
        for path in paths:

            def remove_one(files, prefix, path=path):
                files.pop(prefix + path)

            def keep_one(files, prefix, path=path):
                for other in paths:
                    if other != path:
                        files.pop(prefix + other)

            for change in (remove_one, keep_one):
                with self.subTest(path=path, change=change.__name__), self.assertRaisesRegex(ValueError, "Incomplete"):
                    self.verify(companion_fixture(build.manifest(), change=change))

    def test_companion_requires_exact_executable_permissions(self):
        for mode in (0o644, 0o700, 0o777, 0o4755):
            with self.subTest(mode=oct(mode)), self.assertRaisesRegex(ValueError, "0755"):
                self.verify(companion_fixture(build.manifest(), mode=mode))

    def test_companion_does_not_allow_private_profile_or_state(self):
        for path in ("ottplay-profile.json", "ottplay-control.json", "ott-state/OttState"):

            def change(files, prefix, path=path):
                files[prefix + "companion/" + path] = b"private fixture"

            with self.subTest(path=path), self.assertRaisesRegex(ValueError, "Private profiles"):
                self.verify(companion_fixture(build.manifest(), change=change))


class NativeCompanionBuildTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.spec = build.manifest()
        self.source = self.root / "source"
        (self.source / "rust-modules").mkdir(parents=True)
        (self.source / "rust-modules/rust-toolchain.toml").write_text('[toolchain]\nchannel = "1.99.1"\n')
        sdk = self.root / "sdk"
        (sdk / "bin").mkdir(parents=True)
        for name in ("arm-webos-linux-gnueabi-gcc", "arm-webos-linux-gnueabi-gcc.br_real"):
            (sdk / "bin" / name).write_bytes(b"fixture compiler; never executed")
        self.bundle = self.root / "companion-bundle"
        self.bundle.mkdir()
        self.payload = companion_fixture(self.spec)
        self.prefix = "usr/palm/applications/" + self.spec["application"]["id"]
        self.staging = self.source / "ipkroot/data" / self.prefix
        files = build.tar_files(build.ar_members(self.payload)["data.tar.gz"])
        (self.bundle / "receipt.json").write_bytes(files[self.prefix + "/companion/receipt.json"])
        self.prepared = {"revision": self.spec["revision"], "integration_sha256": "a" * 64}
        (self.root / "prepared.json").write_bytes(json_bytes(self.prepared))
        self.args = SimpleNamespace(work_dir=self.root, sdk=sdk, jobs=2, companion_bundle=self.bundle)
        app = self.spec["application"]
        self.ipk = self.source / "pkg" / (app["id"] + "_" + app["version"] + "_arm.ipk")
        self.steps = []
        self.fail_at = None

    def checked_bundle(self, bundle, readelf):
        self.steps.append("validate")
        self.assertEqual(bundle, self.bundle.resolve())
        self.assertEqual(readelf, self.args.sdk / "bin/arm-webos-linux-gnueabi-readelf")
        if self.fail_at == "validate":
            raise ValueError("fixture bundle invalid")

    def external_command(self, command, *, cwd=None, env=None):
        if command[0] == "make":
            step = command[-1]
            self.assertEqual(command[:-1], ["make", "-j2", "RELEASE=1", "FLAVOR=stable"])
            self.assertEqual(cwd, self.source)
        else:
            step = "companion-stage"
            self.assertEqual(
                command,
                [
                    build.sys.executable,
                    build.HERE / "companion/build.py",
                    "stage",
                    "--bundle",
                    self.bundle.resolve(),
                    "--readelf",
                    self.args.sdk / "bin/arm-webos-linux-gnueabi-readelf",
                    "--destination",
                    self.staging,
                    "--link-evidence",
                    self.source / "pkg/link-evidence/stable",
                ],
            )
            self.assertEqual(cwd, build.ROOT)
        self.assertEqual(env["RELEASE"], "1")
        self.assertEqual(env["FLAVOR"], "stable")
        self.steps.append(step)
        if step == self.fail_at:
            raise subprocess.CalledProcessError(1, command)
        if step == "ipk-stage":
            self.staging.mkdir(parents=True)
        elif step in ("ipk-pack", "ipk"):
            self.ipk.parent.mkdir(parents=True, exist_ok=True)
            self.ipk.write_bytes(self.payload)
        return ""

    def build_candidate(self):
        module = SimpleNamespace(checked_bundle=self.checked_bundle)
        with (
            patch.object(build, "check_source", return_value=self.source),
            patch.object(build, "companion_builder", return_value=module),
            patch.object(build, "run", side_effect=self.external_command),
        ):
            build.build(self.args, self.spec)

    def test_stage_then_pack_records_exact_companion(self):
        self.build_candidate()
        self.assertEqual(self.steps, ["validate", "ipk-stage", "companion-stage", "ipk-pack"])
        receipt = json.loads((self.root / "built.json").read_text())
        self.assertEqual(receipt["companion"], build.verify_ipk(self.ipk, self.spec)["companion"])
        self.assertEqual(receipt["companion"]["receipt_sha256"], build.sha256(self.bundle / "receipt.json"))
        self.assertEqual(receipt["ipk_sha256"], build.sha256(self.ipk))
        self.assertEqual(receipt["revision"], self.prepared["revision"])

    def test_no_bundle_keeps_existing_single_make_target(self):
        self.args.companion_bundle = None
        self.payload = fixture(self.spec)
        self.build_candidate()
        self.assertEqual(self.steps, ["ipk"])
        self.assertNotIn("companion", json.loads((self.root / "built.json").read_text()))

    def test_invalid_bundle_prevents_native_compilation(self):
        self.fail_at = "validate"
        with self.assertRaisesRegex(ValueError, "fixture bundle invalid"):
            self.build_candidate()
        self.assertEqual(self.steps, ["validate"])
        self.assertFalse(self.ipk.exists())
        self.assertFalse((self.root / "built.json").exists())

    def test_failed_companion_stage_never_packages_or_records_build(self):
        self.fail_at = "companion-stage"
        with self.assertRaises(subprocess.CalledProcessError):
            self.build_candidate()
        self.assertEqual(self.steps, ["validate", "ipk-stage", "companion-stage"])
        self.assertFalse(self.ipk.exists())
        self.assertFalse((self.root / "built.json").exists())

    def test_failed_native_stage_never_invokes_companion(self):
        self.fail_at = "ipk-stage"
        with self.assertRaises(subprocess.CalledProcessError):
            self.build_candidate()
        self.assertEqual(self.steps, ["validate", "ipk-stage"])
        self.assertFalse(self.ipk.exists())
        self.assertFalse((self.root / "built.json").exists())

    def test_different_companion_bundle_cannot_be_recorded(self):
        receipt = json.loads((self.bundle / "receipt.json").read_text())
        receipt["link_map_sha256"] = "f" * 64
        (self.bundle / "receipt.json").write_bytes(json_bytes(receipt))
        with self.assertRaisesRegex(ValueError, "explicitly selected bundle"):
            self.build_candidate()
        self.assertFalse((self.root / "built.json").exists())

    def test_unrequested_companion_is_rejected(self):
        self.args.companion_bundle = None
        with self.assertRaisesRegex(ValueError, "explicitly selected bundle"):
            self.build_candidate()
        self.assertEqual(self.steps, ["ipk"])
        self.assertFalse((self.root / "built.json").exists())

    def test_selected_companion_must_reach_final_ipk(self):
        self.payload = fixture(self.spec)
        with self.assertRaisesRegex(ValueError, "explicitly selected bundle"):
            self.build_candidate()
        self.assertEqual(self.steps, ["validate", "ipk-stage", "companion-stage", "ipk-pack"])
        self.assertFalse((self.root / "built.json").exists())


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
