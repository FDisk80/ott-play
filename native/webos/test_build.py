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
        self.root = Path(temporary.name).resolve()
        # The fixture exercises private Cargo-home setup without touching a user cache.
        cargo_home = patch.dict(build.os.environ, {"CARGO_HOME": str(self.root / "cargo-cache")})
        cargo_home.start()
        self.addCleanup(cargo_home.stop)
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

    def compile_fixture(self):
        target = self.source / 'rust-modules/target-release'
        archive = target / build.TARGET / 'release/libplxnative_modules.a'
        archive.parent.mkdir(parents=True, exist_ok=True)
        archive.write_bytes(b'fixture staticlib; never linked')
        artifact = {'reason': 'compiler-artifact', 'manifest_path': str(self.source / 'rust-modules/Cargo.toml'),
                    'target': {'name': 'plxnative_modules', 'kind': ['staticlib'], 'crate_types': ['staticlib'],
                               'src_path': str(self.source / 'rust-modules/src/lib.rs'), 'test': True},
                    'profile': {'opt_level': getattr(self.args, 'rust_opt_level', '2'), 'debuginfo': 0,
                                'debug_assertions': False, 'overflow_checks': False, 'test': False},
                    'features': [], 'filenames': [str(archive)], 'fresh': False}
        rows = [artifact, {'reason': 'build-finished', 'success': True}]
        (target / '.lib-artifacts.json').write_text('\n'.join(json.dumps(row) for row in rows) + '\n')

    def external_command(self, command, *, cwd=None, env=None, capture=False):
        if command[0] == "make":
            step = command[-1]
            self.assertEqual(command[:10], [
                "make", "-j2", "RELEASE=1", "FLAVOR=stable", "OTT_PRODUCT_CONFIG=" + build.PRODUCT_CONFIG,
                'ARM_PROFILE=release', 'RUST_TDIR=target-release', 'STORAGE_TDIR=target-release-storage',
                'RUST_TARGET=' + build.TARGET, 'RUST_TOOLCHAIN=1.99.1'
            ])
            self.assertEqual(env["REQUIRE_PACKAGE"], "1")
            cargo_home = Path(env["CARGO_HOME"])
            self.assertTrue(cargo_home.is_dir())
            self.assertTrue(cargo_home.name.startswith(".native-cargo-"))
            self.assertFalse((cargo_home / "config").exists())
            self.assertFalse((cargo_home / "config.toml").exists())
            self.assertEqual((cargo_home / "registry").resolve(), self.root / "cargo-cache/registry")
            self.assertEqual(cwd, self.source)
            if step == 'print-bench-config':
                self.assertTrue(capture)
                return ('RUST_TDIR=target-release\nRUST_TARGET=' + build.TARGET +
                        '\nRUST_LIB=rust-modules/target-release/' + build.TARGET + '/release/libplxnative_modules.a' +
                        '\nRUST_TOOLCHAIN=1.99.1\nRUST_FEATFLAGS=--no-default-features\n'
                        'ARM_PROFILE=release\nARM_PROFILE_FLAG=--release')
            if step == 'pkg/plxnative-storage':
                step = 'compile'
                self.assertEqual(command[10:12], ['-W', 'rust-modules/Cargo.toml'])
                self.assertNotIn('-W', command[12:])
                self.compile_fixture()
            if step == 'ipk-stage':
                self.assertEqual(command[10:-1], ['-W', 'rust-modules/target-release/' + build.TARGET + '/release/libplxnative_modules.a'])
        elif str(command[1]).endswith('check-build-budgets.py'):
            step = 'size'
            self.assertEqual(command[-1], self.staging / 'plxnative')
        elif str(command[1]).endswith('check-elf.sh'):
            step = 'elf'
        else:
            step = "companion-stage"
            self.assertFalse(any(key.startswith('CARGO_PROFILE_') for key in env))
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
            self.staging.mkdir(parents=True, exist_ok=True)
        elif step in ("ipk-pack", "ipk"):
            self.ipk.parent.mkdir(parents=True, exist_ok=True)
            self.ipk.write_bytes(self.payload)
        return ""

    def build_candidate(self):
        module = SimpleNamespace(checked_bundle=self.checked_bundle)
        with (
            # The compiler/SDK are fixtures, so their supported host must be too.
            patch.object(build, "sdk_host", return_value="linux-aarch64"),
            patch.object(build, "check_source", return_value=self.source),
            patch.object(build, "companion_builder", return_value=module),
            patch.object(build, "run", side_effect=self.external_command),
        ):
            build.build(self.args, self.spec)

    def test_stage_then_pack_records_exact_companion(self):
        self.build_candidate()
        self.assertEqual(self.steps, ["validate", "compile", "ipk-stage", "size", "elf", "companion-stage", "ipk-pack"])
        receipt = json.loads((self.root / "built.json").read_text())
        self.assertEqual(receipt["companion"], build.verify_ipk(self.ipk, self.spec)["companion"])
        self.assertEqual(receipt["companion"]["receipt_sha256"], build.sha256(self.bundle / "receipt.json"))
        self.assertEqual(receipt["ipk_sha256"], build.sha256(self.ipk))
        self.assertEqual(receipt["revision"], self.prepared["revision"])
        self.assertEqual(receipt["configuration"]["host"], "linux-aarch64")

    def test_no_bundle_still_checks_compilation_size_and_elf_before_pack(self):
        self.args.companion_bundle = None
        self.payload = fixture(self.spec)
        self.build_candidate()
        self.assertEqual(self.steps, ["compile", "ipk-stage", "size", "elf", "ipk-pack"])
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
        self.assertEqual(self.steps, ["validate", "compile", "ipk-stage", "size", "elf", "companion-stage"])
        self.assertFalse(self.ipk.exists())
        self.assertFalse((self.root / "built.json").exists())

    def test_failed_native_stage_never_invokes_companion(self):
        self.fail_at = "ipk-stage"
        with self.assertRaises(subprocess.CalledProcessError):
            self.build_candidate()
        self.assertEqual(self.steps, ["validate", "compile", "ipk-stage"])
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
        self.assertEqual(self.steps, ["compile", "ipk-stage", "size", "elf", "ipk-pack"])
        self.assertFalse((self.root / "built.json").exists())

    def test_selected_companion_must_reach_final_ipk(self):
        self.payload = fixture(self.spec)
        with self.assertRaisesRegex(ValueError, "explicitly selected bundle"):
            self.build_candidate()
        self.assertEqual(self.steps, ["validate", "compile", "ipk-stage", "size", "elf", "companion-stage", "ipk-pack"])
        self.assertFalse((self.root / "built.json").exists())

    def test_profile_switch_always_refreshes_cargo_and_relinks(self):
        for level in ('2', 's', '2'):
            self.args.rust_opt_level = level
            self.steps.clear()
            self.build_candidate()
            receipt = json.loads((self.root / 'built.json').read_text())
            self.assertEqual(receipt['configuration']['rust_opt_level'], level)
            evidence = receipt['compilation']
            self.assertEqual(evidence['cargo']['artifact']['profile']['opt_level'], level)
            self.assertEqual(build.sha256(self.root / evidence['cargo']['file']), evidence['cargo']['sha256'])
            self.assertEqual(self.steps, ['validate', 'compile', 'ipk-stage', 'size', 'elf', 'companion-stage', 'ipk-pack'])

    def test_invalid_cargo_evidence_never_reaches_link_or_package(self):
        original = self.compile_fixture
        def change(field, value):
            def mutate(rows):
                target = rows[0]
                for key in field[:-1]:
                    target = target[key]
                target[field[-1]] = value
                return rows
            return mutate
        mutations = [
            lambda rows: rows[:-1],
            lambda rows: rows + [rows[-1]],
            lambda rows: [rows[0], rows[0], rows[-1]],
            lambda rows: rows[:-1] + [{'reason': 'build-finished', 'success': False}],
            change(('profile', 'opt_level'), '3'), change(('profile', 'test'), True),
            change(('features',), ['devtriggers']), change(('target', 'kind'), ['rlib']),
            change(('manifest_path',), '/foreign/Cargo.toml'),
            change(('filenames',), ['/foreign/libplxnative_modules.a']),
        ]
        path = self.source / 'rust-modules/target-release/.lib-artifacts.json'
        for mutation in mutations:
            def fixture(mutation=mutation):
                original()
                rows = [json.loads(line) for line in path.read_text().splitlines()]
                path.write_text('\n'.join(json.dumps(row) for row in mutation(rows)) + '\n')
            self.compile_fixture = fixture
            self.steps.clear()
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                self.build_candidate()
            self.assertEqual(self.steps, ['validate', 'compile'])
            self.assertFalse((self.root / 'built.json').exists())
            self.assertFalse(self.ipk.exists())
        def malformed():
            original()
            path.write_text('{broken JSON\n')
        self.compile_fixture = malformed
        with self.assertRaisesRegex(ValueError, 'Malformed native Cargo'):
            self.build_candidate()

    def test_size_and_elf_failures_cannot_package(self):
        for gate in ('size', 'elf'):
            self.fail_at = gate
            self.steps.clear()
            with self.subTest(gate=gate), self.assertRaises(subprocess.CalledProcessError):
                self.build_candidate()
            self.assertNotIn('companion-stage', self.steps)
            self.assertNotIn('ipk-pack', self.steps)
            self.assertFalse((self.root / 'built.json').exists())

    def test_oversized_cargo_evidence_stops_before_native_link(self):
        original = self.compile_fixture
        def oversized():
            original()
            path = self.source / 'rust-modules/target-release/.lib-artifacts.json'
            with path.open('ab') as stream:
                stream.write(b' ' * (8 * 1024 * 1024 + 1 - path.stat().st_size))
        self.compile_fixture = oversized
        with self.assertRaisesRegex(ValueError, 'Cargo evidence.*8 MiB'):
            self.build_candidate()
        self.assertEqual(self.steps, ['validate', 'compile'])
        self.assertFalse(self.ipk.exists())
        self.assertFalse((self.root / 'built.json').exists())

    def test_cargo_evidence_at_verifier_limit_is_preserved(self):
        self.compile_fixture()
        path = self.source / 'rust-modules/target-release/.lib-artifacts.json'
        with path.open('ab') as stream:
            stream.write(b' ' * (8 * 1024 * 1024 - path.stat().st_size))
        result = build.native_compile_evidence(self.args, self.spec, self.source, 'fixture config')
        exported = self.root / result['cargo']['file']
        self.assertEqual(exported.stat().st_size, 8 * 1024 * 1024)
        self.assertEqual(build.sha256(exported), build.sha256(path))

    def test_archive_drift_during_link_is_rejected(self):
        original = self.external_command
        def drift(command, **kwargs):
            result = original(command, **kwargs)
            if command[-1] == 'ipk-stage':
                path = self.source / 'rust-modules/target-release' / build.TARGET / 'release/libplxnative_modules.a'
                path.write_bytes(b'unexpected replacement')
            return result
        self.external_command = drift
        with self.assertRaisesRegex(ValueError, 'changed during final link'):
            self.build_candidate()
        self.assertNotIn('ipk-pack', self.steps)

    def test_symlinked_cargo_evidence_outside_source_is_rejected(self):
        original = self.compile_fixture
        def escaped():
            original()
            path = self.source / 'rust-modules/target-release/.lib-artifacts.json'
            destination = self.root / 'outside.json'
            path.rename(destination)
            path.symlink_to(destination)
        self.compile_fixture = escaped
        with self.assertRaisesRegex(ValueError, 'inside its source tree'):
            self.build_candidate()
        self.assertNotIn('ipk-stage', self.steps)

    def test_symlinked_compile_destinations_do_not_write_either_file(self):
        name = build.output_name(self.spec)
        destinations = [self.root / (name + suffix) for suffix in
                        ('-cargo-artifacts.jsonl', '-build-config.txt')]
        for index in range(2):
            for dangling in (False, True):
                with self.subTest(destination=index, dangling=dangling):
                    for path in destinations:
                        path.unlink(missing_ok=True)
                    target = self.root / f'outside-{index}-{dangling}.txt'
                    if not dangling:
                        target.write_bytes(b'outside must not change')
                    destinations[index].symlink_to(target)
                    sibling = destinations[1 - index]
                    sibling.write_bytes(b'previous evidence must not change')
                    self.steps.clear()
                    with self.assertRaisesRegex(ValueError, 'evidence destination.*symlink'):
                        self.build_candidate()
                    self.assertTrue(destinations[index].is_symlink())
                    self.assertEqual(sibling.read_bytes(), b'previous evidence must not change')
                    if dangling:
                        self.assertFalse(target.exists())
                    else:
                        self.assertEqual(target.read_bytes(), b'outside must not change')
                    self.assertEqual(self.steps, ['validate', 'compile'])
                    self.assertFalse(self.ipk.exists())
                    self.assertFalse((self.root / 'built.json').exists())

    def test_compile_evidence_regular_destinations_are_refreshed(self):
        name = build.output_name(self.spec)
        cargo = self.root / (name + '-cargo-artifacts.jsonl')
        config = self.root / (name + '-build-config.txt')
        for path in (cargo, config):
            path.write_bytes(b'previous evidence')
        self.build_candidate()
        raw = self.source / 'rust-modules/target-release/.lib-artifacts.json'
        self.assertEqual(cargo.read_bytes(), raw.read_bytes())
        self.assertNotEqual(config.read_bytes(), b'previous evidence')
        self.assertIn('RUST_TARGET=' + build.TARGET, config.read_text())
        self.assertTrue(config.read_text().endswith('\n'))
        receipt = json.loads((self.root / 'built.json').read_text())
        self.assertEqual(receipt['compilation']['cargo']['sha256'], build.sha256(cargo))
        self.assertEqual(receipt['compilation']['make']['sha256'], build.sha256(config))
        self.assertEqual(self.steps, ['validate', 'compile', 'ipk-stage', 'size',
                                     'elf', 'companion-stage', 'ipk-pack'])

    def test_changed_compilation_evidence_cannot_be_packaged(self):
        self.build_candidate()
        self.args.output = self.root / 'dist'
        self.args.base_url = None
        receipt = json.loads((self.root / 'built.json').read_text())
        (self.root / receipt['compilation']['cargo']['file']).write_text('changed')
        with patch.object(build, 'check_source', return_value=self.source):
            with self.assertRaisesRegex(ValueError, 'compilation evidence changed'):
                build.package(self.args, self.spec)

    def test_package_preserves_raw_compile_evidence(self):
        self.build_candidate()
        self.args.output = self.root / 'dist'
        self.args.base_url = None
        (self.source / 'pkg/icon.png').write_bytes(b'fixture icon')
        with patch.object(build, 'check_source', return_value=self.source):
            build.package(self.args, self.spec)
        metadata = json.loads((self.args.output / (build.output_name(self.spec) + '.json')).read_text())
        for field in ('cargo', 'make'):
            evidence = metadata['build']['compilation'][field]
            self.assertEqual(build.sha256(self.args.output / evidence['file']), evidence['sha256'])

    def test_package_output_can_share_work_directory_without_recopied_evidence(self):
        self.build_candidate()
        self.args.base_url = None
        (self.source / 'pkg/icon.png').write_bytes(b'fixture icon')
        receipt = json.loads((self.root / 'built.json').read_text())
        evidence = [self.root / receipt['compilation'][field]['file'] for field in ('cargo', 'make')]
        before = [(path.read_bytes(), path.stat().st_ino, path.stat().st_mtime_ns) for path in evidence]
        alias = self.root / 'canonical-alias'
        alias.mkdir()
        for output in (self.root, alias / '..'):
            with self.subTest(output=output):
                self.args.output = output
                with patch.object(build, 'check_source', return_value=self.source):
                    build.package(self.args, self.spec)
                name = build.output_name(self.spec)
                metadata = json.loads((output / (name + '.json')).read_text())
                self.assertEqual(build.sha256(output / (name + '.ipk')), build.sha256(self.ipk))
                self.assertEqual(metadata['build']['compilation'], receipt['compilation'])
                for path, expected in zip(evidence, before):
                    self.assertEqual((path.read_bytes(), path.stat().st_ino, path.stat().st_mtime_ns), expected)

    def test_package_rejects_symlinked_outputs_before_writing_any_file(self):
        self.build_candidate()
        self.args.output = self.root / 'dist'
        self.args.output.mkdir()
        self.args.base_url = 'https://downloads.example.invalid/native'
        (self.source / 'pkg/icon.png').write_bytes(b'fixture icon')
        name = build.output_name(self.spec)
        names = [name + suffix for suffix in
                 ('-cargo-artifacts.jsonl', '-build-config.txt', '.ipk', '.json', '.sha256')]
        names += ['ottplay-native-webos-icon.png', 'ottplay-native-webos-manifest.json',
                  'ottplay-native-webos-repository.json']
        for index, filename in enumerate(names):
            for dangling in (False, True):
                with self.subTest(filename=filename, dangling=dangling):
                    for other in names:
                        path = self.args.output / other
                        path.unlink(missing_ok=True)
                        if other != filename:
                            path.write_bytes(b'previous package must not change')
                    target = self.root / f'outside-package-{index}-{dangling}'
                    if not dangling:
                        target.write_bytes(b'outside package must not change')
                    destination = self.args.output / filename
                    destination.symlink_to(target)
                    with (patch.object(build, 'check_source', return_value=self.source),
                          self.assertRaisesRegex(ValueError, 'package destination.*symlink')):
                        build.package(self.args, self.spec)
                    self.assertTrue(destination.is_symlink())
                    if dangling:
                        self.assertFalse(target.exists())
                    else:
                        self.assertEqual(target.read_bytes(), b'outside package must not change')
                    for other in names:
                        if other != filename:
                            self.assertEqual((self.args.output / other).read_bytes(),
                                             b'previous package must not change')

    def test_package_refreshes_regular_outputs(self):
        self.build_candidate()
        self.args.output = self.root / 'dist'
        self.args.output.mkdir()
        self.args.base_url = 'https://downloads.example.invalid/native'
        (self.source / 'pkg/icon.png').write_bytes(b'fixture icon')
        name = build.output_name(self.spec)
        names = [name + suffix for suffix in
                 ('-cargo-artifacts.jsonl', '-build-config.txt', '.ipk', '.json', '.sha256')]
        names += ['ottplay-native-webos-icon.png', 'ottplay-native-webos-manifest.json',
                  'ottplay-native-webos-repository.json']
        for filename in names:
            (self.args.output / filename).write_bytes(b'previous package')
        with patch.object(build, 'check_source', return_value=self.source):
            build.package(self.args, self.spec)
        for filename in names:
            self.assertNotEqual((self.args.output / filename).read_bytes(), b'previous package')
        self.assertEqual(build.sha256(self.args.output / (name + '.ipk')), build.sha256(self.ipk))

    def test_native_opt_cli_validates_before_prepare(self):
        argv = ['build.py', 'all', '--rust-opt-level', '3']
        with patch.object(build.sys, 'argv', argv), patch.object(build, 'prepare') as prepare:
            with self.assertRaises(SystemExit):
                build.main()
        prepare.assert_not_called()
        argv = ['build.py', 'build', '--rust-opt-level', 's']
        with patch.object(build.sys, 'argv', argv), patch.object(build, 'build') as run_build:
            build.main()
        self.assertEqual(run_build.call_args.args[0].rust_opt_level, 's')


class NativeControlDiscoveryConfigTests(unittest.TestCase):
    """Exercise the shared validator and real direct-Make stamp entry point."""

    URL = "https://catalog.example.invalid/local/control-discovery.json"
    DIGEST = "a" * 64

    def test_discovery_profile_rejects_one_missing_input_including_empty(self):
        profile = build.control_discovery_config.profile
        for pair in ((None, None), ("", "")):
            with self.subTest(pair=pair):
                self.assertEqual(profile(*pair), {"configured": False, "fingerprint": "none"})
        self.assertTrue(profile(self.URL, self.DIGEST)["configured"])
        for pair in (("", None), (None, ""), (self.URL, None), (None, self.DIGEST)):
            with self.subTest(pair=pair), self.assertRaisesRegex(ValueError, "requires both"):
                profile(*pair)

    def test_discovery_stamp_rejects_partial_environment_without_stdout(self):
        module = build.control_discovery_config
        helper = build.HERE / "control_discovery_config.py"
        configured = module.profile(self.URL, self.DIGEST)["fingerprint"]
        cases = [(None, None, "none"), ("", "", "none"),
                 (self.URL, self.DIGEST, configured), ("", None, None),
                 (None, "", None), (self.URL, None, None), (None, self.DIGEST, None)]
        for url, digest, expected in cases:
            with self.subTest(url=url, digest=digest):
                env = dict(build.os.environ)
                for name, value in ((module.URL_ENV, url), (module.SHA256_ENV, digest)):
                    env.pop(name, None)
                    if value is not None:
                        env[name] = value
                result = subprocess.run(
                    [build.sys.executable, "-B", str(helper), "stamp"],
                    env=env, capture_output=True, text=True, timeout=5,
                )
                if expected is None:
                    self.assertEqual(result.returncode, 1)
                    self.assertEqual(result.stdout, "")
                    self.assertEqual(result.stderr, "Invalid control discovery build inputs\n")
                else:
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual(result.stdout, expected + "\n")
                    self.assertEqual(result.stderr, "")


class NativeControlDiscoveryBuildTests(NativeCompanionBuildTests):
    """All external commands are intercepted by the existing build fixture."""

    URL = "https://catalog.example.invalid/local/control-discovery.json"
    DIGEST = "a" * 64

    def configured(self, url=URL, digest=DIGEST):
        self.args.control_discovery_url = url
        self.args.control_discovery_sha256 = digest

    def test_discovery_absent_scrubs_inherited_profile(self):
        with patch.dict(build.os.environ, {
            "PLX_CONTROL_DISCOVERY_URL": self.URL,
            "PLX_CONTROL_DISCOVERY_SHA256": self.DIGEST,
        }):
            env = build.build_env(self.args)
        self.assertNotIn("PLX_CONTROL_DISCOVERY_URL", env)
        self.assertNotIn("PLX_CONTROL_DISCOVERY_SHA256", env)

    def test_discovery_explicit_pair_overrides_inherited_values_after_scrub(self):
        self.configured()
        with patch.dict(build.os.environ, {
            "PLX_CONTROL_DISCOVERY_URL": "$(shell never-execute)",
            "PLX_CONTROL_DISCOVERY_SHA256": "unreviewed",
        }):
            env = build.build_env(self.args)
        self.assertEqual(env.get("PLX_CONTROL_DISCOVERY_URL"), self.URL)
        self.assertEqual(env.get("PLX_CONTROL_DISCOVERY_SHA256"), self.DIGEST)

    def test_discovery_invalid_inputs_refuse_before_any_build_command(self):
        invalid = [
            (self.URL, None), (None, self.DIGEST), ("", None), ("", self.DIGEST),
            (self.URL, "a" * 63), (self.URL, "G" * 64),
            ("http://catalog.example.invalid/list.json", self.DIGEST),
            ("https://user@catalog.example.invalid/list.json", self.DIGEST),
            (self.URL + "?query=1", self.DIGEST), (self.URL + "#part", self.DIGEST),
            ("https://catalog.example.invalid/../list.json", self.DIGEST),
            ("https://catalog.example.invalid/%2e/list.json", self.DIGEST),
            ("https://catalog.example.invalid/a//b", self.DIGEST),
            ("https://catalog.example.invalid:0/list.json", self.DIGEST),
            ("https://catalog.example.invalid:65536/list.json", self.DIGEST),
            ("https://127.00.0.1/list.json", self.DIGEST),
            ("https://1.2.3/list.json", self.DIGEST),
            ("https://catalog.example.invalid/" + "x" * 2048, self.DIGEST),
        ]
        invalid += [(self.URL + suffix, self.DIGEST) for suffix in (
            "'", '"', "`never-execute`", "$(never-execute)", ";never-execute",
            "\nnever-execute", "\\segment", " space", "&never-execute",
        )]
        for url, digest in invalid:
            with self.subTest(url=url, digest=digest):
                self.configured(url, digest)
                with self.assertRaises(ValueError):
                    self.build_candidate()
                self.assertEqual(self.steps, [])
                self.assertFalse((self.root / "built.json").exists())

    def test_discovery_pair_reaches_every_stage_without_command_interpolation(self):
        self.configured()
        observed = []
        original = self.external_command
        def inspect(command, *, cwd=None, env=None, capture=False):
            self.assertEqual(env.get("PLX_CONTROL_DISCOVERY_URL"), self.URL)
            self.assertEqual(env.get("PLX_CONTROL_DISCOVERY_SHA256"), self.DIGEST)
            self.assertFalse(any(self.URL in str(arg) for arg in command))
            observed.append(command[-1])
            return original(command, cwd=cwd, env=env, capture=capture)
        self.external_command = inspect
        self.build_candidate()
        self.assertEqual(observed[0], "print-bench-config")
        self.assertEqual(observed[-1], "ipk-pack")
        config = json.loads((self.root / "built.json").read_text())["configuration"]
        self.assertEqual(config["control_discovery"]["url"], self.URL)
        self.assertEqual(config["control_discovery"]["sha256"], self.DIGEST)
        self.assertIs(config["control_discovery"]["configured"], True)

    def test_discovery_configuration_identity_changes_and_removes(self):
        self.args.companion_bundle = None
        self.payload = fixture(self.spec)
        fingerprints = []
        for url, digest in ((self.URL, self.DIGEST), (self.URL + "2", self.DIGEST),
                            (self.URL + "2", "b" * 64), (None, None)):
            self.configured(url, digest)
            self.build_candidate()
            config = json.loads((self.root / "built.json").read_text())["configuration"]
            profile = config["control_discovery"]
            fingerprints.append(profile["fingerprint"])
            self.assertEqual(profile["configured"], url is not None)
            self.assertEqual(profile.get("url"), url)
            self.assertEqual(profile.get("sha256"), digest)
        self.assertEqual(len(set(fingerprints)), 4)
        self.assertEqual(fingerprints[-1], "none")

    def test_discovery_cli_pair_is_explicit_and_retained(self):
        argv = ["build.py", "build", "--work-dir", str(self.root), "--sdk", str(self.args.sdk),
                "--control-discovery-url", self.URL, "--control-discovery-sha256", self.DIGEST]
        with patch.object(build.sys, "argv", argv), patch.object(build, "build") as run_build:
            build.main()
        args, _ = run_build.call_args.args
        self.assertEqual(args.control_discovery_url, self.URL)
        self.assertEqual(args.control_discovery_sha256, self.DIGEST)

    def test_discovery_validator_and_make_share_the_receipt_fingerprint(self):
        """Check exported Make wiring; full prepared-source replay is a separate gate."""
        self.configured()
        self.args.companion_bundle = None
        self.payload = fixture(self.spec)
        self.build_candidate()
        recorded = json.loads((self.root / "built.json").read_text())["configuration"]["control_discovery"]
        module = build.control_discovery_config
        self.assertEqual(recorded, module.profile(self.URL, self.DIGEST))
        self.assertEqual(module.profile("", ""), {"configured": False, "fingerprint": "none"})
        helper = build.HERE / "control_discovery_config.py"
        self.assertIn(helper, build.integration_files(), "prepare must copy and hash the actual validator")
        overlay = build.HERE / "patches/0006-native-control-discovery.patch"
        self.assertIn(overlay, build.integration_files(), "prepare must carry the Make wiring overlay")
        lines = overlay.read_text().splitlines()
        headers = [i for i, line in enumerate(lines) if line.startswith("diff --git ")]
        matches = [i for i in headers if lines[i] == "diff --git a/Makefile b/Makefile"]
        self.assertEqual(len(matches), 1, "the overlay must contain exactly one native Makefile section")
        start = matches[0]
        end = next((i for i in headers if i > start), len(lines))
        section = lines[start + 1:end]
        self.assertEqual(section.count("--- a/Makefile"), 1)
        self.assertEqual(section.count("+++ b/Makefile"), 1)
        hunks = [i for i, line in enumerate(section) if line.startswith("@@ ")]
        self.assertTrue(hunks, "native Makefile section must contain source hunks")
        self.assertLess(section.index("--- a/Makefile"), section.index("+++ b/Makefile"))
        self.assertLess(section.index("+++ b/Makefile"), hunks[0])
        # Context and additions form the exported postimage fragments in hunk
        # order. Removed lines and diff metadata are not proposed Make source.
        make = "\n".join(line[1:] for line in section[hunks[0] + 1:]
                         if line.startswith((" ", "+")))
        self.assertIn("CONTROL_DISCOVERY_CFG := $(shell python3 -B ci/ottplay-integration/control_discovery_config.py stamp)", make)
        self.assertIn("+control:$(CONTROL_DISCOVERY_CFG)", make)
        self.assertLess(make.index("override PLX_CONTROL_DISCOVERY_URL := $(value PLX_CONTROL_DISCOVERY_URL)"),
                        make.index("CONTROL_DISCOVERY_CFG :="))
        self.assertNotIn("'$(PLX_CONTROL_DISCOVERY_URL)'", make)
        self.assertNotIn("'$(PLX_CONTROL_DISCOVERY_SHA256)'", make)

    def test_discovery_cli_invalid_pair_cannot_start_preparation(self):
        argv = ["build.py", "all", "--control-discovery-url", self.URL]
        with patch.object(build.sys, "argv", argv), patch.object(build, "prepare") as prepare:
            with self.assertRaises(ValueError):
                build.main()
        prepare.assert_not_called()



class NativeCargoConfigurationTests(unittest.TestCase):
    """Filesystem/Git contracts only; no Cargo, compiler, linker or SDK is executed."""

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.source = self.root / "work/source"
        self.source.mkdir(parents=True)
        self.args = SimpleNamespace(work_dir=self.source.parent, sdk=self.root / "sdk")
        self.cache = self.root / "cache"
        environment = patch.dict(build.os.environ, {"CARGO_HOME": str(self.cache)})
        environment.start()
        self.addCleanup(environment.stop)
        self.git("init", "-q")
        self.config = self.source / "rust-modules/.cargo/config.toml"
        self.config.parent.mkdir(parents=True)
        self.config.write_text('[target.armv7-unknown-linux-gnueabi]\nrustflags = ["-C", "target-cpu=cortex-a9"]\n')
        self.tree = self.record_tree()

    def git(self, *argv):
        return subprocess.check_output(["git", "-C", str(self.source), *argv], text=True).strip()

    def record_tree(self):
        self.git("add", ".")
        return self.git("write-tree")

    def test_caller_config_and_credentials_are_not_inherited_but_offline_caches_are(self):
        self.cache.mkdir()
        for name in ("config", "config.toml", "credentials.toml"):
            (self.cache / name).write_text('[build]\nrustc-wrapper = "/unreviewed"\n')
        for name in ("registry", "git"):
            (self.cache / name).mkdir()
            (self.cache / name / "cached").write_bytes(b"offline input")
        with patch.dict(build.os.environ, {"RUSTUP_HOME": str(self.root / "toolchains"), "CARGO_NET_OFFLINE": "true"}):
            with build.cargo_environment(self.args) as env:
                home = Path(env["CARGO_HOME"])
                self.assertNotEqual(home, self.cache)
                self.assertEqual(set(p.name for p in home.iterdir()),
                                 {"registry", "git", ".package-cache", ".package-cache-mutate"})
                for name in ("registry", "git"):
                    self.assertEqual((home / name).resolve(), self.cache / name)
                    self.assertEqual((home / name / "cached").read_bytes(), b"offline input")
                    (home / name / "new").write_bytes(b"retained input")
                for name in (".package-cache", ".package-cache-mutate"):
                    self.assertEqual((home / name).stat().st_ino, (self.cache / name).stat().st_ino)
                self.assertEqual(env["RUSTUP_HOME"], str(self.root / "toolchains"))
                self.assertEqual(env["CARGO_NET_OFFLINE"], "true")
                self.assertEqual(env["WEBOS_SDK"], str(self.args.sdk))
        self.assertFalse(home.exists())
        self.assertEqual((self.cache / "registry/new").read_bytes(), b"retained input")
        self.assertTrue((self.cache / "config.toml").is_file())

    def test_unset_cargo_home_uses_default_cache_and_each_call_gets_fresh_configuration(self):
        with patch.dict(build.os.environ, {"HOME": str(self.root / "home")}):
            build.os.environ.pop("CARGO_HOME", None)
            with build.cargo_environment(self.args) as env:
                first = Path(env["CARGO_HOME"])
                self.assertEqual((first / "registry").resolve(), self.root / "home/.cargo/registry")
                (first / "config.toml").write_text('[build]\nrustflags = ["--cfg", "injected"]\n')
            with build.cargo_environment(self.args) as env:
                second = Path(env["CARGO_HOME"])
                self.assertNotEqual(first, second)
                self.assertFalse((second / "config.toml").exists())
            self.assertFalse(first.exists())
            self.assertFalse(second.exists())

    def test_exception_cleans_private_home_without_removing_shared_cache(self):
        with self.assertRaisesRegex(RuntimeError, "fixture abort"):
            with build.cargo_environment(self.args) as env:
                home = Path(env["CARGO_HOME"])
                (home / "registry/kept").write_bytes(b"cache")
                raise RuntimeError("fixture abort")
        self.assertFalse(home.exists())
        self.assertEqual((self.cache / "registry/kept").read_bytes(), b"cache")

    def test_cache_entry_must_be_directory(self):
        self.cache.mkdir()
        (self.cache / "registry").write_text("not a directory")
        with self.assertRaises(OSError):
            with build.cargo_environment(self.args):
                self.fail("invalid cache must not reach a build")
        self.assertEqual(list(self.args.work_dir.glob(".native-cargo-*")), [])

    def test_regular_configs_from_exact_prepared_tree_are_allowed(self):
        (self.source / ".cargo").mkdir()
        (self.source / ".cargo/config").write_text('[net]\noffline = true\n')
        # A reviewed source replacement remains part of source closure; no blanket stripping.
        with self.config.open("a") as f:
            f.write('[source.crates-io]\nreplace-with = "bundled"\n[source.bundled]\ndirectory = "cargo-vendor"\n')
        tree = self.record_tree()
        build.check_cargo_configs(self.source, tree)

    def test_modified_staged_config_does_not_match_original_prepared_tree(self):
        self.config.write_text('[build]\nrustc-wrapper = "/unreviewed"\n')
        self.record_tree()
        with self.assertRaisesRegex(ValueError, "differs from the prepared source tree"):
            build.check_cargo_configs(self.source, self.tree)

    def test_assume_unchanged_does_not_hide_config_mutation(self):
        self.git("update-index", "--assume-unchanged", str(self.config.relative_to(self.source)))
        self.config.write_text('[build]\nrustflags = ["--cfg", "injected"]\n')
        with self.assertRaisesRegex(ValueError, "differs from the prepared source tree"):
            build.check_cargo_configs(self.source, self.tree)

    def test_untracked_source_config_is_rejected_for_both_spellings(self):
        for name in ("config", "config.toml"):
            path = self.source / ".cargo" / name
            path.parent.mkdir(exist_ok=True)
            path.write_text('[build]\nrustc-wrapper = "/unreviewed"\n')
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, "differs from the prepared source tree"):
                build.check_cargo_configs(self.source, self.tree)
            path.unlink()

    def test_external_ancestor_config_is_rejected_for_both_spellings(self):
        for name in ("config", "config.toml"):
            path = self.args.work_dir / ".cargo" / name
            path.parent.mkdir(exist_ok=True)
            path.write_text('[build]\nrustc-wrapper = "/unreviewed"\n')
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, "External ancestor Cargo configuration"):
                build.check_cargo_configs(self.source, self.tree)
            path.unlink()

    def test_tracked_symlink_config_and_symlinked_config_parent_are_rejected(self):
        target = self.root / "external.toml"
        target.write_text(self.config.read_text())
        self.config.unlink()
        self.config.symlink_to(target)
        tree = self.record_tree()
        with self.assertRaisesRegex(ValueError, "regular non-symlink"):
            build.check_cargo_configs(self.source, tree)
        self.config.unlink()
        self.config.parent.rmdir()
        external = self.root / "external-cargo"
        external.mkdir()
        (external / "config.toml").write_text(target.read_text())
        self.config.parent.symlink_to(external, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "regular non-symlink"):
            build.check_cargo_configs(self.source, self.tree)

    def test_dangling_ancestor_config_is_not_silently_ignored(self):
        path = self.args.work_dir / ".cargo/config"
        path.parent.mkdir()
        path.symlink_to(self.root / "missing")
        with self.assertRaisesRegex(ValueError, "External ancestor Cargo configuration"):
            build.check_cargo_configs(self.source, self.tree)

    def test_source_collection_uses_same_isolated_caches(self):
        with patch.object(build, "check_source", return_value=self.source), \
                patch.object(build, "sources_with_environment") as collect:
            build.sources(self.args, {})
        env = collect.call_args.args[3]
        self.assertNotEqual(env["CARGO_HOME"], str(self.cache))
        self.assertFalse(Path(env["CARGO_HOME"]).exists())


class NativeSdkTests(unittest.TestCase):
    def test_sdk_host_accepts_supported_platforms_and_arm_aliases(self):
        for system, machine, expected in (
            ("Darwin", "arm64", "darwin-arm64"),
            ("Darwin", "x86_64", "darwin-x86_64"),
            ("Linux", "aarch64", "linux-aarch64"),
            ("Linux", "arm64", "linux-aarch64"),
            ("LINUX", "ARM64", "linux-aarch64"),
        ):
            with self.subTest(system=system, machine=machine), \
                    patch.object(build.platform, "system", return_value=system), \
                    patch.object(build.platform, "machine", return_value=machine):
                self.assertEqual(build.sdk_host(), expected)

    def test_sdk_host_rejects_unsupported_platforms(self):
        for system, machine in (
            ("Linux", "x86_64"), ("Linux", "amd64"), ("Linux", "armv7l"),
            ("Darwin", "i386"), ("Windows", "ARM64"), ("FreeBSD", "aarch64"),
        ):
            with self.subTest(system=system, machine=machine), \
                    patch.object(build.platform, "system", return_value=system), \
                    patch.object(build.platform, "machine", return_value=machine), \
                    self.assertRaisesRegex(ValueError, "Pinned SDK supports"):
                build.sdk_host()

    def test_native_opt_is_explicit_and_scrubs_inherited_profile_settings(self):
        args = SimpleNamespace(work_dir=Path('/fixture/work'), sdk=Path('/fixture/sdk'), rust_opt_level='s')
        inherited = {'CARGO_PROFILE_RELEASE_OPT_LEVEL': '3', 'CARGO_PROFILE_RELEASE_LTO': 'off',
                     'CARGO_TARGET_DIR': '/outside', 'CARGO_BUILD_RUSTFLAGS': '-C panic=abort',
                     'ARM_PROFILE': 'tvdev', 'RUSTC_WRAPPER': '/unreviewed', 'GNUMAKEFLAGS': '-e'}
        with patch.dict(build.os.environ, inherited):
            env = build.build_env(args)
        self.assertEqual(env['CARGO_PROFILE_RELEASE_OPT_LEVEL'], 's')
        for key in inherited.keys() - {'CARGO_PROFILE_RELEASE_OPT_LEVEL'}:
            self.assertNotIn(key, env)

    def test_native_opt_default_and_restricted_values(self):
        args = SimpleNamespace(work_dir=Path('/fixture/work'), sdk=Path('/fixture/sdk'))
        self.assertEqual(build.build_env(args).get('CARGO_PROFILE_RELEASE_OPT_LEVEL'), '2')
        for value in ('0', '3', 'z', '', 's -C panic=abort'):
            args.rust_opt_level = value
            with self.subTest(value=value), self.assertRaises(ValueError):
                build.build_env(args)

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
