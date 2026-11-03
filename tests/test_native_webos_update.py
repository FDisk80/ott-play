"""Offline update regressions; no television, credentials or release download."""

import hashlib
import importlib.util
import io
import json
import os
import shlex
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "native_webos_update_test_subject", ROOT / "scripts/update-webos-native.py"
)
update = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = update
SPEC.loader.exec_module(update)

APP_ID = "com.openottplay.player.native"
HOSTED_ID = "com.openottplay.player"
APP_DIR = "/media/developer/apps/usr/palm/applications/" + APP_ID
BANNER = "\x1b[32m[Info] Set target device : TEST_TV\x1b[0m\n"


class InstalledApplicationParsingTests(unittest.TestCase):
    def test_listfull_keeps_native_identity_separate_from_hosted(self):
        applications = update.parse_installed(
            "id : " + HOSTED_ID + "\n"
            "version : 1.1.61\n"
            "folderPath : /media/developer/apps/usr/palm/applications/" + HOSTED_ID + "\n\n"
            "id : " + APP_ID + "\n"
            "version : 0.1.0\n"
            "type : native\n"
            "folderPath : " + APP_DIR + "\n"
        )
        native = [app for app in applications if app["id"] == APP_ID]
        self.assertEqual(len(native), 1)
        self.assertEqual(native[0]["version"], "0.1.0")
        self.assertEqual(native[0]["folderPath"], APP_DIR)
        self.assertEqual([app["id"] for app in applications], [HOSTED_ID, APP_ID])

    def test_listfull_accepts_banner_but_not_nested_identity_as_application(self):
        applications = update.parse_installed(
            BANNER + "id : " + APP_ID + "\nversion : 0.2.0\ntype : native\n"
            "folderPath : " + APP_DIR + "\nhandles\n-id : nested-handler\n"
        )
        self.assertEqual([app["id"] for app in applications], [APP_ID])
        self.assertEqual(applications[0]["version"], "0.2.0")

    def test_ambiguous_native_identity_or_version_is_rejected(self):
        block = "id : " + APP_ID + "\nversion : 0.2.0\nfolderPath : " + APP_DIR + "\n"
        for text in (
            block + "\n" + block,
            block + "version : 0.1.0\n",
            "id : " + APP_ID + "\nfolderPath : " + APP_DIR + "\n",
        ):
            with self.subTest(text=text), self.assertRaises(update.UpdateError):
                update.parse_installed(text)

    def test_running_accepts_cli_display_suffix_and_empty_success(self):
        self.assertEqual(update.parse_running(""), set())
        self.assertEqual(update.parse_running(APP_ID + "\n"), {APP_ID})
        self.assertEqual(update.parse_running(BANNER), set())
        self.assertEqual(
            update.parse_running(BANNER + APP_ID + " - display 0\n" + HOSTED_ID + " - display 1\n"),
            {APP_ID, HOSTED_ID},
        )

    def test_system_info_parses_named_fields_without_executing_device_commands(self):
        result = update.parse_system_info(
            BANNER + "modelName : FIXTURE_MODEL\nsdkVersion : 6.1.0\n"
            "firmwareVersion : 00.00.00\nboardType : FIXTURE_BOARD\notaId : FIXTURE_OTA\n"
        )
        self.assertEqual(result["modelName"], "FIXTURE_MODEL")
        self.assertEqual(result["sdkVersion"], "6.1.0")
        self.assertEqual(result["firmwareVersion"], "00.00.00")

    def test_partial_or_ambiguous_system_info_is_not_identity_evidence(self):
        for text in (
            "", BANNER, "modelName : FIXTURE_MODEL\n", "modelName : FIXTURE_MODEL\nsdkVersion : 6.1.0\n",
            "modelName : ONE\nmodelName : TWO\nsdkVersion : 6.1.0\nfirmwareVersion : 00.00.00\n",
        ):
            with self.subTest(text=text), self.assertRaises(update.UpdateError):
                update.parse_system_info(text)

    def test_running_does_not_treat_error_text_as_an_app(self):
        for text in ("Connection refused", "ares-launch ERR! expired session", "not an app id !"):
            with self.subTest(text=text), self.assertRaises(update.UpdateError):
                update.parse_running(text)


class OfficialReleaseValidationTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        spec = importlib.util.spec_from_file_location("native_update_ipk_fixtures", ROOT / "native/webos/test_build.py")
        self.fixtures = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.fixtures)
        self.native_spec = self.fixtures.build.manifest()
        self.native_spec["application"]["version"] = "0.2.0"
        self.tag = "native-webos-v0.2.0-beta.1"
        self.stem = "ottplay-native-webos-0.2.0"
        self.ipk = self.root / (self.stem + ".ipk")
        self.ipk.write_bytes(self.fixtures.fixture(self.native_spec))
        self.metadata = self.fixtures.build.verify_ipk(self.ipk, self.native_spec)
        self.metadata["build"] = {"ipk_sha256": self.metadata["sha256"]}
        self.metadata["corresponding_source"] = {
            "file": self.stem + "-source.tar.gz", "sha256": "a" * 64,
            "snapshot_sha256": "e" * 64,
        }
        self.write_metadata()
        self.release_info = {
            "id": 123, "tag_name": self.tag, "draft": False,
            "html_url": f"https://github.com/{update.REPOSITORY}/releases/tag/{self.tag}",
        }
        self.ref_info = {"ref": "refs/tags/" + self.tag, "object": {"type": "commit", "sha": "d" * 40}}
        self.sync_official_assets()

    def write_metadata(self):
        (self.root / (self.stem + ".json")).write_text(json.dumps(self.metadata))
        (self.root / (self.stem + ".sha256")).write_text(self.metadata["sha256"] + "  " + self.ipk.name + "\n")
        self.source_set = {
            "schema": 1, "ipk": {"file": self.ipk.name, "sha256": self.metadata["sha256"]},
            "source_archives": [self.metadata["corresponding_source"],
                                {"file": self.stem + "-runtime-source.tar.gz", "sha256": "b" * 64}],
        }
        (self.root / (self.stem + "-source-set.json")).write_text(json.dumps(self.source_set))

    def sync_official_assets(self):
        self.release_info["assets"] = [
            {
                "id": index + 1, "name": path.name, "state": "uploaded", "size": path.stat().st_size,
                "digest": "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest(),
                "browser_download_url": f"https://github.com/{update.REPOSITORY}/releases/download/{self.tag}/{path.name}",
            }
            for index, path in enumerate(self.root / (self.stem + suffix)
                                         for suffix in (".ipk", ".json", ".sha256", "-source-set.json"))
        ]

    def verify(self):
        return update.verify_release_files(self.root, self.tag, self.release_info, self.ref_info)

    def test_real_ipk_and_official_asset_hashes_are_accepted(self):
        result = self.verify()
        self.assertEqual(result["version"], "0.2.0")
        self.assertEqual(result["sha256"], hashlib.sha256(self.ipk.read_bytes()).hexdigest())
        self.assertEqual(result["source_sha"], "d" * 40)

    def test_same_size_modified_ipk_fails_official_hash(self):
        payload = bytearray(self.ipk.read_bytes())
        payload[-1] ^= 1
        self.ipk.write_bytes(payload)
        with self.assertRaises(update.UpdateError) as caught:
            self.verify()
        self.assertEqual(caught.exception.code, "release_asset_hash_mismatch")

    def test_rewriting_adjacent_checksums_cannot_replace_official_hashes(self):
        self.metadata["sha256"] = "f" * 64
        self.metadata["build"]["ipk_sha256"] = "f" * 64
        self.write_metadata()
        with self.assertRaises(update.UpdateError):
            self.verify()

    def test_official_metadata_for_hosted_app_is_rejected(self):
        self.metadata["application"]["id"] = HOSTED_ID
        self.write_metadata()
        self.sync_official_assets()
        with self.assertRaises(update.UpdateError) as caught:
            self.verify()
        self.assertEqual(caught.exception.code, "release_identity_mismatch")

    def test_internal_ipk_version_must_match_official_metadata(self):
        self.native_spec["application"]["version"] = "0.1.0"
        self.ipk.write_bytes(self.fixtures.fixture(self.native_spec))
        self.metadata["sha256"] = hashlib.sha256(self.ipk.read_bytes()).hexdigest()
        self.metadata["size"] = self.ipk.stat().st_size
        self.metadata["build"]["ipk_sha256"] = self.metadata["sha256"]
        self.metadata["application"]["version"] = "0.2.0"
        self.write_metadata()
        self.sync_official_assets()
        with self.assertRaises(update.UpdateError):
            self.verify()

    def test_release_must_belong_to_fixed_repository_and_not_be_draft(self):
        for field, value in (("draft", True), ("html_url", "https://github.com/other/project/releases/tag/" + self.tag)):
            with self.subTest(field=field):
                original = self.release_info[field]
                self.release_info[field] = value
                with self.assertRaises(update.UpdateError):
                    self.verify()
                self.release_info[field] = original

    def test_missing_official_digest_is_not_downgraded_to_local_checksums(self):
        self.release_info["assets"][0].pop("digest")
        with self.assertRaises(update.UpdateError):
            self.verify()

    def test_source_set_must_bind_the_package_and_primary_source(self):
        for field in ("ipk", "source_archives"):
            with self.subTest(field=field):
                self.write_metadata()
                if field == "ipk":
                    self.source_set["ipk"]["sha256"] = "f" * 64
                else:
                    self.source_set["source_archives"][0] = {"file": "another-source.tar.gz", "sha256": "f" * 64}
                (self.root / (self.stem + "-source-set.json")).write_text(json.dumps(self.source_set))
                self.sync_official_assets()
                with self.assertRaises(update.UpdateError):
                    self.verify()

    def test_source_set_schema_and_primary_snapshot_must_match(self):
        for changed in ("schema", "snapshot"):
            with self.subTest(changed=changed):
                self.write_metadata()
                source_set = json.loads((self.root / (self.stem + "-source-set.json")).read_text())
                if changed == "schema":
                    source_set["schema"] = 99
                else:
                    source_set["source_archives"][0]["snapshot_sha256"] = "f" * 64
                (self.root / (self.stem + "-source-set.json")).write_text(json.dumps(source_set))
                self.sync_official_assets()
                with self.assertRaises(update.UpdateError):
                    self.verify()

    def test_symlink_cached_package_is_rejected(self):
        original = self.ipk.with_suffix(".saved")
        self.ipk.rename(original)
        self.ipk.symlink_to(original)
        with self.assertRaises(update.UpdateError):
            self.verify()


def private_tar(entries, *, uid=0, gid=0):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w") as archive:
        for name, data in entries.items():
            item = tarfile.TarInfo(name)
            item.uid, item.gid = uid, gid
            item.mode = 0o700 if data is None else 0o600
            if data is None:
                item.type = tarfile.DIRTYPE
            else:
                item.size = len(data)
            archive.addfile(item, None if data is None else io.BytesIO(data))
    return buffer.getvalue()


@unittest.skipUnless(os.name == "posix", "Ares transport requires macOS or Linux")
class PrivateStateTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.entries = {"ott-state": None, "ott-state/OttState": b"private-encrypted-fixture",
                        "ottplay-profile.json": b"private-managed-fixture"}
        self.archive = private_tar(self.entries)
        self.rows, self.content = update.state_archive(self.archive)
        path = self.root / "state.tar"
        path.write_bytes(self.archive)
        self.snapshot = {"path": str(path), "sha256": hashlib.sha256(self.archive).hexdigest(), "files": self.rows}
        self.ares = update.Ares("fixture-tv", runner=self.no_device_command)

    def no_device_command(self, *args, **kwargs):
        raise AssertionError("a private-state unit test attempted a real device command")

    def test_private_archive_accepts_only_expected_roots_and_preserves_bytes(self):
        self.assertEqual(set(self.rows), set(self.entries))
        self.assertEqual(self.content["ott-state/OttState"], self.entries["ott-state/OttState"])
        self.assertEqual(self.rows["ott-state/OttState"]["mode"], 0o600)

    def test_owner_is_part_of_state_identity(self):
        other, _ = update.state_archive(private_tar(self.entries, uid=123, gid=456))
        self.assertNotEqual(self.rows, other)
        self.assertEqual(other["ott-state/OttState"]["uid"], 123)
        self.assertEqual(other["ott-state/OttState"]["gid"], 456)

    def test_traversal_and_other_application_files_are_rejected(self):
        for name in ("../ottplay-profile.json", "/ott-state/OttState", "ott-state/../../outside", "appinfo.json"):
            with self.subTest(name=name), self.assertRaises(update.UpdateError):
                update.state_archive(private_tar({name: b"fixture"}))

    def test_changed_existing_state_is_not_overwritten(self):
        current, _ = update.state_archive(private_tar({"ott-state": None, "ott-state/OttState": b"new-state"}))
        with patch.object(self.ares, "capture", return_value=(current, {}, b"")), \
                patch.object(self.ares, "remote") as remote, self.assertRaises(update.UpdateError) as caught:
            self.ares.restore(self.snapshot)
        self.assertEqual(caught.exception.code, "private_state_changed_after_install")
        remote.assert_not_called()

    def test_identical_bytes_with_changed_owner_are_not_silently_accepted(self):
        current, _ = update.state_archive(private_tar(self.entries, uid=123, gid=456))
        with patch.object(self.ares, "capture", return_value=(current, self.content, b"")), \
                patch.object(self.ares, "remote") as remote, self.assertRaises(update.UpdateError) as caught:
            self.ares.restore(self.snapshot)
        self.assertEqual(caught.exception.code, "private_state_changed_after_install")
        remote.assert_not_called()

    def test_unchanged_state_needs_no_remote_writes(self):
        with patch.object(self.ares, "capture", return_value=(self.rows, self.content, self.archive)), \
                patch.object(self.ares, "remote") as remote:
            self.ares.restore(self.snapshot)
        remote.assert_not_called()

    def test_missing_state_is_restored_without_clobbering_existing_paths(self):
        calls = []
        def remote(command, *, data=None):
            calls.append((command, data))
            return b"0\n0\n" if command == "id -u; id -g" else b""
        with patch.object(self.ares, "capture", side_effect=[({}, {}, b""), (self.rows, self.content, self.archive)]), \
                patch.object(self.ares, "remote", side_effect=remote):
            self.ares.restore(self.snapshot)
        writes = [(command, data) for command, data in calls if data is not None]
        self.assertEqual({data for _, data in writes}, {value for value in self.entries.values() if value is not None})
        self.assertEqual(len(writes), len(self.content) - 1)

    def test_modified_private_backup_fails_before_any_device_request(self):
        Path(self.snapshot["path"]).write_bytes(self.archive + b"changed")
        with patch.object(self.ares, "capture") as capture, self.assertRaises(update.UpdateError):
            self.ares.restore(self.snapshot)
        capture.assert_not_called()

    def fake_process_read(self, command, *, data=None):
        self.assertIsNone(data)
        self.assertIn("/proc/[0-9]*", command)
        local = command.replace("/proc/[0-9]*", shlex.quote(str(self.root / "proc")) + "/[0-9]*")
        result = subprocess.run(["sh", "-c", local], capture_output=True, timeout=5, check=False)
        if result.returncode:
            raise update.UpdateError("private_state_failed")
        return result.stdout

    def test_deleted_executable_still_counts_as_running_native_process(self):
        process = self.root / "proc/123"
        process.mkdir(parents=True)
        (process / "comm").write_text("plxnative\n")
        (process / "exe").symlink_to(APP_DIR + "/plxnative (deleted)")
        with patch.object(self.ares, "remote", side_effect=self.fake_process_read):
            self.assertTrue(self.ares.native_process())

    def test_unreadable_native_executable_is_not_proof_of_stopped_process(self):
        process = self.root / "proc/123"
        process.mkdir(parents=True)
        (process / "comm").write_text("plxnative\n")
        (process / "exe").write_text("not-a-readable-symlink")
        with patch.object(self.ares, "remote", side_effect=self.fake_process_read), self.assertRaises(update.UpdateError):
            self.ares.native_process()

    def test_snapshot_refuses_ownership_the_existing_alias_cannot_restore(self):
        def remote(command, *, data=None):
            return b"123\n456\n" if command == "id -u; id -g" else b""
        destination = self.root / "snapshot"
        with patch.object(self.ares, "capture", return_value=(self.rows, self.content, self.archive)), \
                patch.object(self.ares, "remote", side_effect=remote), self.assertRaises(update.UpdateError) as caught:
            self.ares.snapshot(destination)
        self.assertEqual(caught.exception.code, "private_owner_not_restorable")
        self.assertFalse((destination / "state.tar").exists())


@unittest.skipUnless(os.name == "posix" and shutil.which("sha256sum"),
                     "Local shell fixtures require POSIX and sha256sum")
class LocalRestoreAndPayloadTests(unittest.TestCase):
    """Run emitted shell only against isolated local files, never a device."""

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.application = self.root / "application"
        self.service = self.root / "service"
        self.application.mkdir()
        self.service.mkdir()
        self.ares = update.Ares("fixture-tv", runner=lambda *args, **kwargs: self.fail("device request"))
        self.ares.remote = self.local_remote
        self.shell_prefix = ""
        self.transfer = lambda data: data
        self.before_transfer = lambda: None
        self.profile = b"private-profile-with-complete-contents"
        archive = private_tar({"ottplay-profile.json": self.profile}, uid=os.getuid(), gid=os.getgid())
        path = self.root / "state.tar"
        path.write_bytes(archive)
        rows, _ = update.state_archive(archive)
        self.snapshot = {"path": str(path), "sha256": hashlib.sha256(archive).hexdigest(), "files": rows}

    def local_remote(self, command, *, data=None):
        service_dir = "/media/developer/apps/usr/palm/services/" + APP_ID + ".storage"
        self.assertTrue(APP_DIR in command or service_dir in command or command == "id -u; id -g")
        local = command.replace(APP_DIR, str(self.application)).replace(service_dir, str(self.service))
        self.assertNotIn("/media/developer/", local)
        local = self.shell_prefix + "\n" + local
        if data is not None:
            self.before_transfer()
            data = self.transfer(data)
            data = data.replace(APP_DIR.encode(), str(self.application).encode())
            data = data.replace(service_dir.encode(), str(self.service).encode())
        result = subprocess.run(
            ["sh", "-c", local], input=data, capture_output=True, timeout=5, check=False,
            env={**os.environ, "COPYFILE_DISABLE": "1"},
        )
        if result.returncode:
            raise update.UpdateError("private_state_failed")
        return result.stdout.replace(str(self.application).encode(), APP_DIR.encode()).replace(
            str(self.service).encode(), service_dir.encode()
        )

    def test_complete_transfer_publishes_exact_bytes_with_private_mode(self):
        self.ares.restore(self.snapshot)
        target = self.application / "ottplay-profile.json"
        self.assertEqual(target.read_bytes(), self.profile)
        self.assertEqual(target.stat().st_mode & 0o777, 0o600)
        self.assertEqual(list(self.application.iterdir()), [target])

    def test_interrupted_transfer_does_not_publish_partial_file_and_can_retry(self):
        self.transfer = lambda data: data[:5]
        with self.assertRaises(update.UpdateError):
            self.ares.restore(self.snapshot)
        self.assertFalse((self.application / "ottplay-profile.json").exists())
        self.assertEqual(list(self.application.iterdir()), [])
        self.transfer = lambda data: data
        self.ares.restore(self.snapshot)
        self.assertEqual((self.application / "ottplay-profile.json").read_bytes(), self.profile)

    def test_destination_created_during_transfer_is_never_overwritten(self):
        target = self.application / "ottplay-profile.json"
        self.before_transfer = lambda: target.write_bytes(b"newer-private-configuration")
        with self.assertRaises(update.UpdateError):
            self.ares.restore(self.snapshot)
        self.assertEqual(target.read_bytes(), b"newer-private-configuration")
        self.assertEqual(list(self.application.iterdir()), [target])

    def test_directory_at_destination_does_not_receive_staged_file(self):
        target = self.application / "ottplay-profile.json"
        self.before_transfer = lambda: target.mkdir()
        with self.assertRaises(update.UpdateError):
            self.ares.restore(self.snapshot)
        self.assertTrue(target.is_dir())
        self.assertEqual(list(target.iterdir()), [])
        self.assertEqual(list(self.application.iterdir()), [target])

    def test_wrong_or_unreadable_staged_owner_prevents_publication(self):
        for prefix in ("stat() { printf '999999:999999\\n'; }", "stat() { return 1; }"):
            with self.subTest(prefix=prefix):
                self.shell_prefix = prefix
                with self.assertRaises(update.UpdateError):
                    self.ares.restore(self.snapshot)
                self.assertEqual(list(self.application.iterdir()), [])

    def test_setgid_parent_with_wrong_group_prevents_directory_creation(self):
        self.application.chmod(0o2700)
        self.assertTrue(self.application.stat().st_mode & 0o2000)
        self.shell_prefix = "stat() { printf '999999\\n'; }"
        archive = private_tar({"ott-state": None}, uid=os.getuid(), gid=os.getgid())
        path = Path(self.snapshot["path"])
        path.write_bytes(archive)
        rows, _ = update.state_archive(archive)
        self.snapshot = {"path": str(path), "sha256": hashlib.sha256(archive).hexdigest(), "files": rows}
        with self.assertRaises(update.UpdateError):
            self.ares.restore(self.snapshot)
        self.assertFalse((self.application / "ott-state").exists())
        self.assertEqual(list(self.application.iterdir()), [])

    def payload_fixture(self):
        files = {"app/plxnative": b"native-program", "app/appinfo.json": b"package-identity",
                 "service/plxnative-storage": b"storage-program"}
        for name, data in files.items():
            kind, relative = name.split("/", 1)
            root = self.application if kind == "app" else self.service
            (root / relative).write_bytes(data)
        return {name: hashlib.sha256(data).hexdigest() for name, data in files.items()}

    def test_real_payload_match_and_changed_service_hash(self):
        payload = self.payload_fixture()
        self.assertTrue(self.ares.payload_matches(payload))
        (self.service / "plxnative-storage").write_bytes(b"different-storage-program")
        self.assertFalse(self.ares.payload_matches(payload))

    def test_missing_or_symlink_payload_is_not_accepted(self):
        payload = self.payload_fixture()
        target = self.application / "plxnative"
        target.unlink()
        self.assertFalse(self.ares.payload_matches(payload))
        outside = self.root / "same-bytes-elsewhere"
        outside.write_bytes(b"native-program")
        target.symlink_to(outside)
        self.assertFalse(self.ares.payload_matches(payload))

    def test_ambiguous_payload_readback_is_not_success(self):
        payload = self.payload_fixture()
        for reply in (b"", b"OTT_PAYLOAD_MATCH\nOTT_PAYLOAD_MATCH\n",
                      b"OTT_PAYLOAD_MATCH\nOTT_PAYLOAD_MISMATCH\n", b"unknown-output\n"):
            with self.subTest(reply=reply), patch.object(self.ares, "remote", return_value=reply), \
                    self.assertRaises(update.UpdateError) as caught:
                self.ares.payload_matches(payload)
            self.assertEqual(caught.exception.code, "invalid_payload_readback")

    def test_direct_hash_readback_requires_each_exact_path_once(self):
        payload = self.payload_fixture()
        roots = {"app": APP_DIR, "service": "/media/developer/apps/usr/palm/services/" + APP_ID + ".storage"}
        lines = []
        for name, checksum in payload.items():
            kind, relative = name.split("/", 1)
            lines.append(checksum + "  " + roots[kind] + "/" + relative + "\n")
        with patch.object(self.ares, "remote", return_value=(BANNER + "".join(reversed(lines))).encode()) as remote:
            self.assertTrue(self.ares.payload_matches(payload))
            self.assertEqual(remote.call_args.kwargs, {})
        for reply in (
            "".join(lines + [lines[0]]), "".join(lines[:-1]),
            "".join(lines).replace("/plxnative\n", "/unexpected\n", 1),
            "".join(lines).replace("  ", " ", 1),
            "\\" + "".join(lines),
        ):
            with self.subTest(reply=reply), patch.object(self.ares, "remote", return_value=reply.encode()), \
                    self.assertRaises(update.UpdateError) as caught:
                self.ares.payload_matches(payload)
            self.assertEqual(caught.exception.code, "invalid_payload_readback")


@unittest.skipUnless(os.name == "posix" and shutil.which("node") and shutil.which("sha256sum"),
                     "Delayed CLI fixture requires POSIX, Node and sha256sum")
class DelayedCliStdinTests(unittest.TestCase):
    """Model the eager CLI stdin listener before its delayed SSH stream attach."""

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        cli = self.root / "cli"
        (cli / "bin").mkdir(parents=True)
        (cli / "lib/base").mkdir(parents=True)
        (cli / "package.json").write_text('{"name":"@webos-tools/cli","version":"3.2.6"}')
        (cli / "lib/base/novacom.js").write_text('''"use strict";
const {spawn} = require("node:child_process");
class Session {
  run(command, input, output, errors, next) {
    const child = spawn("sh", ["-c", command], {
      env: {...process.env, COPYFILE_DISABLE: "1"}
    });
    child.stdin.on("error", () => {});
    if (input.readableEnded) child.stdin.end();
    else input.pipe(child.stdin);
    child.stdout.pipe(output);
    child.stderr.pipe(errors);
    child.on("exit", code => next(code === 0 ? null : new Error("fixture command failed")));
  }
}
module.exports = {Session};
''')
        self.entry = cli / "bin/ares-novacom.js"
        self.entry.write_text('''"use strict";
const {Session} = require("../lib/base/novacom.js");
const index = process.argv.indexOf("--run");
if (index < 0 || index !== process.argv.length - 2) process.exit(91);
process.stdin.on("data", chunk => {
  if (chunk.toString().trim() === "@ARES-CLOSE@") process.exit(0);
});
setTimeout(() => {
  new Session().run(process.argv[index + 1], process.stdin, process.stdout,
    process.stderr, error => process.exit(error ? 92 : 0));
}, 100);
''')
        wrapper = self.root / "native/webos/ares-compat.cjs"
        wrapper.parent.mkdir(parents=True)
        # Only exact-package validation is replaced; the production input
        # bootstrap and Python subprocess transport run unchanged.
        wrapper.write_text('''"use strict";
const path = require("node:path");
function validateCli(root, tool) {
  if (tool !== "ares-novacom") throw new Error("fixture tool mismatch");
  return {entry: path.join(root, "bin/ares-novacom.js"),
          novacom: path.join(root, "lib/base/novacom.js")};
}
function run(args) {
  const {entry} = validateCli(args[0], args[1]);
  process.argv = [process.execPath, entry, ...args.slice(2)];
  require(entry);
}
module.exports = {validateCli, run};
''')
        self.application = self.root / "application"
        self.service = self.root / "service"
        self.application.mkdir()
        self.service.mkdir()
        self.calls = []
        self.ares = update.Ares("fixture-tv", cli, runner=self.runner)
        original_command = self.ares.command

        def fixture_command(*args, **kwargs):
            with patch.object(update, "ROOT", self.root):
                return original_command(*args, **kwargs)

        self.ares.command = fixture_command

    def runner(self, command, **kwargs):
        if command[1] == "-e":
            self.assertEqual(command[2], update.PRIVATE_INPUT_BOOTSTRAP)
            self.assertTrue(kwargs.get("private_input"))
        else:
            self.assertEqual(Path(command[1]), self.entry)
        run_index = command.index("--run")
        self.assertEqual(command[run_index - 2:run_index], ["--device", "fixture-tv"])
        self.calls.append((command[-1], kwargs.get("data")))
        service_dir = "/media/developer/apps/usr/palm/services/" + APP_ID + ".storage"
        translated = command[-1].replace(APP_DIR, str(self.application)).replace(service_dir, str(self.service))
        self.assertNotIn("/media/developer/", translated)
        kwargs["timeout"] = min(kwargs.get("timeout", 3), 3)
        result = update.run_command([*command[:-1], translated], **kwargs)
        return result.replace(str(self.application).encode(), APP_DIR.encode()).replace(
            str(self.service).encode(), service_dir.encode()
        )

    def test_fixture_reproduces_loss_of_prefed_stdin_before_stream_attach(self):
        result = update.run_command(
            [shutil.which("node"), str(self.entry), "--run", "cat"],
            operation="fixture", timeout=3, data=b"bytes-sent-before-remote-is-ready",
        )
        self.assertEqual(result, b"")

    def test_remote_uses_private_stream_and_transfers_binary_without_cli_control_exit(self):
        for payload in (b"@ARES-CLOSE@", bytes(range(256)) * 512):
            with self.subTest(size=len(payload)):
                self.assertEqual(self.ares.remote("cat", data=payload), payload)
        self.ares.compatibility = True
        self.assertEqual(self.ares.remote("cat", data=b"@ARES-CLOSE@"), b"@ARES-CLOSE@")

    def test_payload_verification_does_not_depend_on_cli_stdin(self):
        executable = self.application / "plxnative"
        executable.write_bytes(b"native-payload")
        payload = {"app/plxnative": hashlib.sha256(executable.read_bytes()).hexdigest()}
        self.assertTrue(self.ares.payload_matches(payload))
        self.assertTrue(all(data is None for _, data in self.calls))
        executable.write_bytes(b"modified-payload")
        self.assertFalse(self.ares.payload_matches(payload))

    def test_nonempty_private_restore_survives_delayed_cli_stream_attach(self):
        contents = b"@ARES-CLOSE@\x00private-config\xff\n"
        archive = private_tar({"ottplay-profile.json": contents}, uid=os.getuid(), gid=os.getgid())
        path = self.root / "state.tar"
        path.write_bytes(archive)
        rows, _ = update.state_archive(archive)
        snapshot = {"path": str(path), "sha256": hashlib.sha256(archive).hexdigest(), "files": rows}
        self.ares.restore(snapshot)
        self.assertEqual((self.application / "ottplay-profile.json").read_bytes(), contents)
        self.assertEqual((self.application / "ottplay-profile.json").stat().st_mode & 0o777, 0o600)


class JournalRecoveryTests(unittest.TestCase):
    def test_stale_temporary_file_does_not_block_future_durable_receipts(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            stale = root / "update.next.json"
            stale.write_text("interrupted-legacy-receipt")
            journal = root / "update.json"
            update.save_journal(journal, {"outcome": "closing"})
            update.save_journal(journal, {"outcome": "needs-review"})
            self.assertEqual(json.loads(journal.read_text()), {"outcome": "needs-review"})
            self.assertEqual(stale.read_text(), "interrupted-legacy-receipt")

    def test_failed_atomic_replace_keeps_prior_receipt_and_retry_succeeds(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            journal = root / "update.json"
            update.save_journal(journal, {"outcome": "closing"})
            with patch.object(update.os, "replace", side_effect=OSError("fixture replace failure")), \
                    self.assertRaises((OSError, update.UpdateError)):
                update.save_journal(journal, {"outcome": "installing"})
            self.assertEqual(json.loads(journal.read_text()), {"outcome": "closing"})
            self.assertEqual(list(root.iterdir()), [journal])
            update.save_journal(journal, {"outcome": "installing"})
            self.assertEqual(json.loads(journal.read_text()), {"outcome": "installing"})


class AccessFailureTests(unittest.TestCase):
    def test_error_categories_do_not_expose_credentials_or_infer_expiry_from_auth(self):
        sentinel = b" secret-token https://private.invalid/?secret=fixture"
        cases = (
            (b"Developer Mode session has expired", "developer_mode_expired_or_disabled"),
            (b"Key Server not running", "key_server_unavailable"),
            (b"Permission denied (publickey)", "authentication_required"),
            (b"Connection refused", "device_unavailable"),
        )
        for message, expected in cases:
            with self.subTest(expected=expected):
                result = update.command_error(message + sentinel)
                self.assertEqual(result, expected)
                self.assertNotIn("secret", result)

    @unittest.skipUnless(os.name == "posix", "Ares transport requires macOS or Linux")
    def test_failed_alias_check_does_not_run_key_acquisition_or_setup(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "package.json").write_text('{"name":"@webos-tools/cli","version":"3.2.6"}')
            calls = []
            def runner(command, **kwargs):
                calls.append(command)
                raise update.UpdateError("authentication_required")
            ares = update.Ares("fixture-tv", root, runner=runner)
            with self.assertRaises(update.UpdateError):
                ares.identity()
            self.assertEqual(len(calls), 1)
            self.assertEqual(calls[0][-1], "--listfull")
            self.assertFalse({"--getkey", "--add", "--remove", "--modify"}.intersection(calls[0]))


@unittest.skipUnless(os.name == "posix", "Ares transport requires macOS or Linux")
class DeviceIdentityTests(unittest.TestCase):
    UUID = "abcdef01-2345-4678-9abc-def012345678"

    def identity(self, response=None, error=None):
        ares = update.Ares("fixture-tv", runner=lambda *args, **kwargs: self.fail("device request"))
        inventory = [{"name": "fixture-tv", "profile": "tv", "deviceinfo": {
            "user": "prisoner", "port": 9922, "ip": "fixture.invalid", "uid": "fixture-alias-id",
        }}]
        system = b"modelName : FIXTURE_MODEL\nsdkVersion : 6.1.0\nfirmwareVersion : 00.00.00\n"
        if response is None:
            response = {"returnValue": True, "idList": [{"idType": "LGUDID", "idValue": self.UUID}]}
        encoded = response if isinstance(response, bytes) else json.dumps(response).encode()
        with patch.object(ares, "command", return_value=json.dumps(inventory).encode()) as command, \
                patch.object(ares, "device", return_value=system) as device, \
                patch.object(ares, "remote", return_value=encoded, side_effect=error) as remote:
            result = ares.identity()
            command.assert_called_once_with("ares-setup-device", "--listfull")
            device.assert_called_once_with("ares-device", "--system-info")
            remote.assert_called_once_with(update.DEVICE_ID_COMMAND)
        return result

    def test_identifier_is_hashed_and_not_retained_in_returned_identity(self):
        result = self.identity()
        self.assertEqual(result["binding"], "lgudid-v1")
        self.assertRegex(result["device_id_sha256"], r"^[0-9a-f]{64}$")
        self.assertNotIn(self.UUID, json.dumps(result))
        upper = {"returnValue": True, "idList": [{"idType": "LGUDID", "idValue": self.UUID.upper()}]}
        self.assertEqual(result, self.identity(upper))

    def test_different_device_cannot_match_same_model_alias_and_endpoint(self):
        first = self.identity()
        second = self.identity({"returnValue": True, "idList": [
            {"idType": "LGUDID", "idValue": "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"},
        ]})
        self.assertNotEqual(first["fingerprint"], second["fingerprint"])
        self.assertNotEqual(first["device_id_sha256"], second["device_id_sha256"])

    def test_missing_malformed_or_ambiguous_identifier_never_falls_back_to_model(self):
        valid = {"idType": "LGUDID", "idValue": self.UUID}
        for response in (
            {"returnValue": False, "idList": [valid]},
            {"returnValue": True}, {"returnValue": True, "idList": []},
            {"returnValue": True, "idList": [valid, valid]},
            {"returnValue": True, "idList": [{"idType": "OTHER", "idValue": self.UUID}]},
            {"returnValue": True, "idList": [{"idType": "LGUDID", "idValue": ""}]},
            {"returnValue": True, "idList": [{"idType": "LGUDID", "idValue": "00000000-0000-0000-0000-000000000000"}]},
            {"returnValue": True, "idList": [{"idType": "LGUDID", "idValue": self.UUID.replace("-", "")}]},
            b'{"returnValue":true,"returnValue":false}', b"invalid response", b"\xff",
        ):
            with self.subTest(response=response), self.assertRaises(update.UpdateError) as caught:
                self.identity(response)
            self.assertEqual(caught.exception.code, "device_identity_unavailable")

    def test_identity_query_error_does_not_expose_sensitive_output(self):
        with self.assertRaises(update.UpdateError) as caught:
            self.identity(error=update.UpdateError("fixture-sensitive-output"))
        self.assertEqual(str(caught.exception), "device_identity_unavailable")


@unittest.skipUnless(os.name == "posix", "Real Ares subprocess transport requires POSIX")
class BoundedCommandTests(unittest.TestCase):
    def test_timeout_reaps_parent_and_stops_its_local_descendant(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            ready, survived = root / "ready", root / "survived"
            descendant = (
                "import pathlib,sys,time; pathlib.Path(sys.argv[1]).write_text('ready'); "
                "time.sleep(1.2); pathlib.Path(sys.argv[2]).write_text('not-stopped')"
            )
            parent = (
                "import subprocess,sys,time; "
                "subprocess.Popen([sys.executable,'-c',sys.argv[1],sys.argv[2],sys.argv[3]]); "
                "time.sleep(10)"
            )
            original_popen = subprocess.Popen
            processes = []

            def start(*args, **kwargs):
                process = original_popen(*args, **kwargs)
                processes.append(process)
                return process

            try:
                with patch.object(update.subprocess, "Popen", side_effect=start), \
                        self.assertRaises(update.UpdateError) as caught:
                    update.run_command(
                        [sys.executable, "-c", parent, descendant, str(ready), str(survived)],
                        operation="install", timeout=1,
                    )
                self.assertEqual(caught.exception.code, "install_timeout")
                self.assertEqual(len(processes), 1)
                self.assertIsNotNone(processes[0].poll())
                self.assertTrue(ready.exists(), "local descendant did not start before deadline")
                time.sleep(0.5)
                self.assertFalse(survived.exists(), "timeout left the process-group descendant running")
            finally:
                for process in processes:
                    try:
                        os.killpg(process.pid, 9)
                    except ProcessLookupError:
                        pass

    def test_live_stdout_and_stderr_limits_terminate_the_child(self):
        original_popen = subprocess.Popen
        for descriptor, size in ((1, 4096), (2, 2 * 1024 * 1024)):
            with self.subTest(descriptor=descriptor):
                processes = []

                def start(*args, captured=processes, **kwargs):
                    process = original_popen(*args, **kwargs)
                    captured.append(process)
                    return process

                command = [sys.executable, "-c", "import os,time; os.write(" + str(descriptor)
                           + ",b'x'*" + str(size) + "); time.sleep(10)"]
                started = time.monotonic()
                with patch.object(update, "OUTPUT_LIMIT", 1024), \
                        patch.object(update.subprocess, "Popen", side_effect=start), \
                        self.assertRaises(update.UpdateError) as caught:
                    update.run_command(command, operation="preflight", timeout=5)
                self.assertEqual(caught.exception.code, "ares_output_limit")
                self.assertLess(time.monotonic() - started, 3)
                self.assertEqual(len(processes), 1)
                self.assertIsNotNone(processes[0].poll())


class FakeAres:
    """Mutable device model. Any install/removal/auth command must be explicit."""

    def __init__(self, version="0.1.0"):
        self.app = {"id": APP_ID, "version": version, "type": "native", "folderPath": APP_DIR}
        self.active = {APP_ID}
        self.process_active = True
        self.payload_valid = True
        self.calls = []
        self.files = {
            "ott-state/OttState": b"encrypted-state-fixture",
            "ott-state/OttControl": b"encrypted-control-fixture",
            "ottplay-profile.json": b"private-profile-fixture",
            "ottplay-control.json": b"private-provisioning-fixture",
        }
        self.initial_files = dict(self.files)
        self.snapshots = {}

    def identity(self):
        self.calls.append("identity")
        return {"alias": "fixture-tv", "fingerprint": "f" * 64, "model": "fixture-model",
                "binding": "lgudid-v1", "device_id_sha256": "d" * 64}

    def installed(self):
        self.calls.append("installed")
        return dict(self.app) if self.app is not None else None

    def running(self):
        self.calls.append("running")
        return set(self.active)

    def native_process(self):
        self.calls.append("native_process")
        return self.process_active

    def payload_matches(self, payload):
        self.calls.append("payload_matches")
        return self.payload_valid

    def close(self):
        self.calls.append("close")
        self.active.discard(APP_ID)
        self.process_active = False

    def snapshot(self, destination):
        self.calls.append("snapshot")
        if APP_ID in self.active:
            raise AssertionError("state must be captured after confirmed close")
        destination.mkdir(parents=True, exist_ok=True)
        archive = private_tar({"ott-state": None, **self.files})
        path = destination / "state.tar"
        path.write_bytes(archive)
        rows, _ = update.state_archive(archive)
        snapshot = {"path": str(path), "sha256": hashlib.sha256(archive).hexdigest(), "files": rows}
        (destination / "manifest.json").write_text(json.dumps(snapshot))
        self.snapshots[str(path)] = dict(self.files)
        return snapshot

    def restore(self, snapshot):
        self.calls.append("restore")
        if APP_ID in self.active:
            raise AssertionError("state must be restored before launch")
        self.files = dict(self.snapshots[snapshot["path"]])

    def install(self, ipk):
        self.calls.append("install")
        if APP_ID in self.active:
            raise AssertionError("install must not replace a running native application")
        self.app["version"] = "0.2.0"
        self.files.clear()

    def launch(self):
        self.calls.append("launch")
        if self.files != self.initial_files:
            raise AssertionError("launch before preserving state")
        self.active.add(APP_ID)
        self.process_active = True


class UpdateSequenceTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.ipk = self.root / "fixture.ipk"
        self.ipk.write_bytes(b"already-verified-by-release-loader")
        self.release = {
            "tag": "native-webos-v0.2.0-beta.1", "version": "0.2.0",
            "sha256": hashlib.sha256(self.ipk.read_bytes()).hexdigest(), "ipk": self.ipk,
            "payload": {"app/plxnative": "c" * 64}, "source_sha": "d" * 40,
            "source_set_sha256": "e" * 64, "release_id": 123,
        }

    def perform(self, ares, *, apply=False, preflight=False, reconcile=False):
        return update.update_device(
            ares, self.release, apply=apply, preflight=preflight, reconcile=reconcile,
            state_dir=self.root / "state", attempts=1, poll_interval=0,
        )

    def test_default_dry_run_makes_no_device_requests(self):
        ares = FakeAres()
        receipt = self.perform(ares)
        self.assertEqual(ares.calls, [])
        self.assertEqual(ares.files, ares.initial_files)
        self.assertEqual(ares.app["version"], "0.1.0")
        for field in ("source_sha", "source_set_sha256", "release_id"):
            self.assertEqual(receipt[field], self.release[field])

    def test_concurrent_update_and_recovery_refuse_before_device_access(self):
        ares = FakeAres()
        with update.update_lock(self.root):
            for mode in ({"apply": True}, {"reconcile": True}):
                with self.subTest(mode=mode), self.assertRaises(update.UpdateError) as caught:
                    self.perform(ares, **mode)
                self.assertEqual(caught.exception.code, "update_in_progress")
            self.perform(ares)
        self.assertEqual(ares.calls, [])
        self.assertEqual(self.perform(ares, apply=True)["outcome"], "complete")

    def test_failed_update_releases_lock_for_subsequent_read_only_diagnosis(self):
        ares = FakeAres()
        ares.app["type"] = "web"
        with self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        with update.update_lock(self.root):
            pass
        ares.app["type"] = "native"
        self.assertEqual(self.perform(ares, preflight=True)["outcome"], "preflight")

    def test_preflight_reads_identity_but_never_modifies_the_device(self):
        ares = FakeAres()
        self.perform(ares, preflight=True)
        self.assertIn("identity", ares.calls)
        self.assertIn("installed", ares.calls)
        self.assertTrue(set(ares.calls) <= {"identity", "installed", "running", "native_process", "payload_matches"})
        self.assertEqual(ares.files, ares.initial_files)
        self.assertEqual(ares.app["version"], "0.1.0")

    def test_current_version_is_idempotent_without_state_mutations(self):
        ares = FakeAres(version="0.2.0")
        self.perform(ares, apply=True)
        self.assertTrue(set(ares.calls) <= {"identity", "installed", "running", "native_process", "payload_matches"})
        self.assertEqual(ares.files, ares.initial_files)

    def test_wrong_application_identity_is_rejected_before_changes(self):
        ares = FakeAres()
        ares.app["id"] = HOSTED_ID
        with self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        self.assertTrue(set(ares.calls) <= {"identity", "installed", "running", "native_process"})

    def test_missing_install_is_not_silently_treated_as_an_update(self):
        ares = FakeAres()
        ares.app = None
        with self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        self.assertTrue(set(ares.calls) <= {"identity", "installed", "running", "native_process"})

    def test_success_preserves_every_private_file_before_launch(self):
        ares = FakeAres()
        self.perform(ares, apply=True)
        mutations = [call for call in ares.calls if call in {"close", "snapshot", "install", "restore", "launch"}]
        self.assertEqual(mutations, ["close", "snapshot", "install", "restore", "launch"])
        self.assertEqual(ares.files, ares.initial_files)
        self.assertEqual(ares.app["version"], "0.2.0")
        self.assertIn(APP_ID, ares.active)

    def test_repeating_completed_update_does_not_install_or_copy_state_again(self):
        ares = FakeAres()
        self.perform(ares, apply=True)
        self.perform(ares, apply=True)
        self.assertEqual(ares.calls.count("install"), 1)
        self.assertEqual(ares.calls.count("snapshot"), 1)
        self.assertEqual(ares.calls.count("restore"), 1)
        self.assertEqual(ares.calls.count("launch"), 1)
        self.assertTrue(ares.process_active)
        self.assertEqual(ares.files, ares.initial_files)

    def test_same_version_with_different_payload_is_not_treated_as_current(self):
        ares = FakeAres(version="0.2.0")
        ares.payload_valid = False
        with self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        self.assertNotIn("install", ares.calls)
        self.assertNotIn("snapshot", ares.calls)
        self.assertNotIn("close", ares.calls)

    def test_wrong_installed_payload_prevents_state_restore_and_launch(self):
        class DifferentPayload(FakeAres):
            def install(self, ipk):
                super().install(ipk)
                self.payload_valid = False
        ares = DifferentPayload()
        with self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        self.assertNotIn("restore", ares.calls)
        self.assertNotIn("launch", ares.calls)

    def test_newer_installed_version_is_not_automatically_downgraded(self):
        ares = FakeAres(version="0.3.0")
        with self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        self.assertTrue(set(ares.calls) <= {"identity", "installed", "running", "native_process"})

    def test_hosted_type_cannot_use_the_native_update_path(self):
        ares = FakeAres()
        ares.app["type"] = "web"
        with self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        self.assertTrue(set(ares.calls) <= {"identity", "installed", "running", "native_process"})

    def test_close_ack_without_stopped_process_cannot_lead_to_snapshot(self):
        class StillRunning(FakeAres):
            def close(self):
                self.calls.append("close")
        ares = StillRunning()
        with self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        self.assertNotIn("snapshot", ares.calls)
        self.assertNotIn("install", ares.calls)

    def test_snapshot_failure_prevents_install(self):
        class UnreadableState(FakeAres):
            def snapshot(self, destination):
                self.calls.append("snapshot")
                raise update.UpdateError("snapshot_unavailable")
        ares = UnreadableState()
        with self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        self.assertNotIn("install", ares.calls)
        self.assertNotIn("restore", ares.calls)
        self.assertEqual(ares.files, ares.initial_files)

    def test_proven_preinstall_failure_can_retry_without_discarding_state(self):
        ares = FakeAres()
        with patch.object(ares, "snapshot", side_effect=update.UpdateError("snapshot_unavailable")), \
                self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        journal = json.loads((self.root / "state/update.json").read_text())
        self.assertIs(journal["install_started"], False)
        self.assertNotIn("install", ares.calls)
        result = self.perform(ares, apply=True)
        self.assertEqual(result["outcome"], "complete")
        self.assertEqual(ares.calls.count("install"), 1)
        self.assertEqual(ares.files, ares.initial_files)

    def test_preinstall_retry_retains_prior_local_snapshot_and_rechecks_package(self):
        original = self.ipk.read_bytes()
        ares = FakeAres()
        original_snapshot = ares.snapshot

        def changed_package(destination):
            result = original_snapshot(destination)
            self.ipk.write_bytes(b"changed-before-install")
            return result

        with patch.object(ares, "snapshot", side_effect=changed_package), self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        old_snapshot = (self.root / "state/snapshot/state.tar").read_bytes()
        journal = json.loads((self.root / "state/update.json").read_text())
        self.assertIs(journal["install_started"], False)
        self.assertNotIn("install", ares.calls)
        self.ipk.write_bytes(original)
        self.assertEqual(self.perform(ares, apply=True)["outcome"], "complete")
        retained = list((self.root / "state").glob("prior-attempt-*/snapshot/state.tar"))
        self.assertEqual(len(retained), 1)
        self.assertEqual(retained[0].read_bytes(), old_snapshot)
        self.assertEqual(ares.calls.count("install"), 1)

    def test_preinstall_retry_refuses_changed_release_or_device(self):
        ares = FakeAres()
        with patch.object(ares, "snapshot", side_effect=update.UpdateError("snapshot_unavailable")), \
                self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        for field, changed in (("sha256", "f" * 64), ("source_sha", "f" * 40),
                               ("source_set_sha256", "f" * 64), ("release_id", 999)):
            with self.subTest(field=field):
                original = self.release[field]
                self.release[field] = changed
                before = list(ares.calls)
                try:
                    with self.assertRaises(update.UpdateError):
                        self.perform(ares, apply=True)
                    self.assertEqual(ares.calls, before)
                finally:
                    self.release[field] = original
        with patch.object(ares, "identity", return_value={"alias": "other", "fingerprint": "e" * 64}), \
                self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        self.assertNotIn("install", ares.calls)

    def test_missing_or_started_install_marker_never_allows_automatic_retry(self):
        ares = self.timed_out(completed=False)
        self.perform(ares, apply=True)
        path = self.root / "state/update.json"
        journal = json.loads(path.read_text())
        self.assertIs(journal["install_started"], True)
        for marker in (None, True):
            with self.subTest(marker=marker):
                modified = {**journal, "outcome": "needs-review"}
                if marker is None:
                    modified.pop("install_started")
                path.write_text(json.dumps(modified))
                before = list(ares.calls)
                with self.assertRaises(update.UpdateError) as caught:
                    self.perform(ares, apply=True)
                self.assertEqual(caught.exception.code, "pending_update")
                self.assertEqual(ares.calls, before)
        self.assertEqual(ares.calls.count("install"), 1)

    def test_package_changed_after_verification_cannot_be_installed(self):
        ipk = self.ipk
        class PackageChanged(FakeAres):
            def snapshot(self, destination):
                result = super().snapshot(destination)
                ipk.write_bytes(b"replacement-after-release-verification")
                return result
        ares = PackageChanged()
        with self.assertRaises(update.UpdateError) as caught:
            self.perform(ares, apply=True)
        self.assertEqual(caught.exception.code, "release_file_changed")
        self.assertNotIn("install", ares.calls)

    def test_absent_sam_entry_is_not_proof_native_process_stopped(self):
        class ProcessStillAlive(FakeAres):
            def close(self):
                self.calls.append("close")
                self.active.clear()
        ares = ProcessStillAlive()
        with self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        self.assertNotIn("snapshot", ares.calls)
        self.assertNotIn("install", ares.calls)

    def test_launch_ack_without_native_process_is_not_success(self):
        class ProcessAbsent(FakeAres):
            def launch(self):
                self.calls.append("launch")
                self.active.add(APP_ID)
        ares = ProcessAbsent()
        with self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        self.assertEqual(ares.calls.count("install"), 1)
        self.assertEqual(ares.files, ares.initial_files)

    def test_restore_conflict_prevents_launch_and_keeps_backup(self):
        class Conflict(FakeAres):
            def restore(self, snapshot):
                self.calls.append("restore")
                self.files["ott-state/OttState"] = b"new-state-must-not-be-overwritten"
                raise update.UpdateError("state_conflict")
        ares = Conflict()
        with self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        self.assertNotIn("launch", ares.calls)
        self.assertEqual(ares.files["ott-state/OttState"], b"new-state-must-not-be-overwritten")
        self.assertTrue(ares.snapshots)

    def test_expired_or_key_server_error_never_reacquires_credentials(self):
        class AccessUnavailable(FakeAres):
            def identity(self):
                self.calls.append("identity")
                raise update.UpdateError("device_access_unavailable")
        ares = AccessUnavailable()
        with self.assertRaises(update.UpdateError):
            self.perform(ares, preflight=True)
        self.assertEqual(ares.calls, ["identity"])
        self.assertEqual(ares.files, ares.initial_files)

    def timed_out(self, completed):
        class TimeoutAres(FakeAres):
            def install(self, ipk):
                if completed:
                    super().install(ipk)
                else:
                    self.calls.append("install")
                raise update.UpdateError("install_timeout")
        return TimeoutAres()

    def test_install_timeout_with_target_version_stays_pending_without_launch(self):
        ares = self.timed_out(completed=True)
        receipt = self.perform(ares, apply=True)
        self.assertEqual(receipt["outcome"], "install-indeterminate")
        self.assertEqual(receipt["observed_version"], "0.2.0")
        self.assertEqual(ares.app["version"], "0.2.0")
        self.assertEqual(ares.calls.count("install"), 1)
        self.assertNotIn("restore", ares.calls)
        self.assertNotIn("launch", ares.calls)
        self.assertTrue(ares.snapshots)

    def test_install_timeout_with_old_version_is_not_automatically_retried(self):
        ares = self.timed_out(completed=False)
        receipt = self.perform(ares, apply=True)
        self.assertEqual(receipt["outcome"], "install-indeterminate")
        self.assertEqual(receipt["observed_version"], "0.1.0")
        self.assertEqual(ares.app["version"], "0.1.0")
        self.assertEqual(ares.calls.count("install"), 1)
        self.assertNotIn("restore", ares.calls)
        self.assertNotIn("launch", ares.calls)

    def test_pending_update_precedes_same_version_idempotency(self):
        ares = self.timed_out(completed=True)
        first = self.perform(ares, apply=True)
        self.assertEqual(first["outcome"], "install-indeterminate")
        self.assertFalse(ares.files)
        before = list(ares.calls)
        with self.assertRaises(update.UpdateError) as caught:
            self.perform(ares, apply=True)
        self.assertEqual(caught.exception.code, "pending_update")
        self.assertEqual(ares.calls, before)
        self.assertEqual(ares.calls.count("install"), 1)
        self.assertEqual(ares.calls.count("snapshot"), 1)

    def test_pending_update_still_allows_read_only_preflight(self):
        ares = self.timed_out(completed=True)
        self.perform(ares, apply=True)
        before = list(ares.calls)
        receipt = self.perform(ares, preflight=True)
        self.assertEqual(receipt["outcome"], "preflight")
        self.assertTrue(set(ares.calls[len(before):]) <= {"identity", "installed", "running", "native_process", "payload_matches"})
        self.assertEqual(ares.calls.count("install"), 1)
        self.assertEqual(ares.calls.count("snapshot"), 1)

    def test_reconcile_completed_install_restores_state_without_another_install(self):
        ares = self.timed_out(completed=True)
        self.perform(ares, apply=True)
        self.assertFalse(ares.files)
        result = self.perform(ares, reconcile=True)
        self.assertEqual(result["outcome"], "complete")
        self.assertTrue(result["reconciled"])
        self.assertEqual(ares.files, ares.initial_files)
        self.assertEqual(ares.calls.count("install"), 1)
        self.assertEqual(ares.calls.count("snapshot"), 1)
        self.assertEqual(ares.calls.count("restore"), 1)
        self.assertEqual(ares.calls.count("launch"), 1)
        self.assertTrue(ares.process_active)
        self.perform(ares, apply=True)
        self.assertEqual(ares.calls.count("install"), 1)
        self.assertEqual(ares.calls.count("restore"), 1)

    def test_reconcile_rechecks_device_after_close_before_restoring(self):
        ares = self.timed_out(completed=True)
        self.perform(ares, apply=True)
        original_identity = ares.identity()
        with patch.object(ares, "identity", side_effect=[original_identity, {"fingerprint": "changed-device"}]), \
                self.assertRaises(update.UpdateError) as caught:
            self.perform(ares, reconcile=True)
        self.assertEqual(caught.exception.code, "device_identity_changed")
        self.assertNotIn("restore", ares.calls)
        self.assertNotIn("launch", ares.calls)

    def test_update_rechecks_device_after_install_before_restoring(self):
        class ChangedAfterInstall(FakeAres):
            changed = False

            def install(self, ipk):
                super().install(ipk)
                self.changed = True

            def identity(self):
                result = super().identity()
                if self.changed:
                    result["fingerprint"] = "e" * 64
                return result

        ares = ChangedAfterInstall()
        with self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        self.assertNotIn("restore", ares.calls)
        self.assertNotIn("launch", ares.calls)
        self.assertEqual(ares.calls.count("install"), 1)

    def test_reconcile_close_timeout_continues_only_after_confirmed_stop(self):
        ares = self.timed_out(completed=True)
        self.perform(ares, apply=True)
        ares.active.add(APP_ID)
        ares.process_active = True
        original_close = ares.close

        def closed_but_timed_out():
            original_close()
            raise update.UpdateError("close_timeout")

        with patch.object(ares, "close", side_effect=closed_but_timed_out):
            result = self.perform(ares, reconcile=True)
        self.assertEqual(result["outcome"], "complete")
        self.assertEqual(ares.calls.count("install"), 1)
        self.assertEqual(ares.files, ares.initial_files)

    def test_reconcile_close_timeout_with_live_process_does_not_restore_or_launch(self):
        ares = self.timed_out(completed=True)
        self.perform(ares, apply=True)
        ares.active.add(APP_ID)
        ares.process_active = True
        with patch.object(ares, "close", side_effect=update.UpdateError("close_timeout")), \
                self.assertRaises(update.UpdateError) as caught:
            self.perform(ares, reconcile=True)
        self.assertEqual(caught.exception.code, "native_app_did_not_stop")
        self.assertNotIn("restore", ares.calls)
        self.assertNotIn("launch", ares.calls)
        self.assertEqual(ares.calls.count("install"), 1)

    def test_completed_journal_cannot_restore_stale_state_again(self):
        ares = self.timed_out(completed=True)
        self.perform(ares, apply=True)
        self.perform(ares, reconcile=True)
        ares.files["ott-state/OttState"] = b"user-changed-settings-after-success"
        before = list(ares.calls)
        with self.assertRaises(update.UpdateError) as caught:
            self.perform(ares, reconcile=True)
        self.assertEqual(caught.exception.code, "no_pending_update")
        self.assertEqual(ares.calls, before)
        self.assertEqual(ares.files["ott-state/OttState"], b"user-changed-settings-after-success")

    def test_reconcile_refuses_old_version_without_retrying_install(self):
        ares = self.timed_out(completed=False)
        self.perform(ares, apply=True)
        with self.assertRaises(update.UpdateError) as caught:
            self.perform(ares, reconcile=True)
        self.assertEqual(caught.exception.code, "recovery_target_not_installed")
        self.assertEqual(ares.calls.count("install"), 1)
        self.assertNotIn("restore", ares.calls)
        self.assertNotIn("launch", ares.calls)

    def test_reconcile_requires_the_same_device_and_payload_before_any_write(self):
        for changed in ("identity", "payload"):
            with self.subTest(changed=changed), tempfile.TemporaryDirectory() as temporary:
                self.root = Path(temporary)
                ares = self.timed_out(completed=True)
                self.perform(ares, apply=True)
                before = len(ares.calls)
                if changed == "identity":
                    ares.identity = lambda: {"alias": "different-tv", "fingerprint": "e" * 64}
                else:
                    ares.payload_valid = False
                with self.assertRaises(update.UpdateError):
                    self.perform(ares, reconcile=True)
                self.assertTrue(set(ares.calls[before:]) <= {"identity", "installed", "payload_matches"})

    def test_reconcile_missing_journal_does_not_contact_device(self):
        ares = FakeAres()
        with self.assertRaises(update.UpdateError) as caught:
            self.perform(ares, reconcile=True)
        self.assertEqual(caught.exception.code, "missing_update_journal")
        self.assertEqual(ares.calls, [])

    def test_reconcile_cannot_adopt_a_manual_install_after_preinstall_failure(self):
        ares = FakeAres()
        original_snapshot = ares.snapshot

        def change_package_after_snapshot(destination):
            snapshot = original_snapshot(destination)
            self.ipk.write_bytes(b"invalid-before-install")
            return snapshot

        with patch.object(ares, "snapshot", side_effect=change_package_after_snapshot), \
                self.assertRaises(update.UpdateError):
            self.perform(ares, apply=True)
        path = self.root / "state/update.json"
        saved = json.loads(path.read_text())
        self.assertTrue(saved["snapshot"])
        self.assertEqual(saved["outcome"], "needs-review")
        self.assertIs(saved["install_started"], False)
        self.assertNotIn("install", ares.calls)
        ares.app["version"] = "0.2.0"  # A separate manual install cannot authorize old-state restoration.
        for marker in (False, None):
            with self.subTest(marker=marker):
                journal = dict(saved)
                if marker is None:
                    journal.pop("install_started")
                path.write_text(json.dumps(journal))
                before = list(ares.calls)
                with self.assertRaises(update.UpdateError) as caught:
                    self.perform(ares, reconcile=True)
                self.assertEqual(caught.exception.code, "installation_not_started")
                self.assertEqual(ares.calls, before)
                self.assertEqual(ares.files, ares.initial_files)

    def test_legacy_alias_only_journal_cannot_authorize_recovery(self):
        ares = self.timed_out(completed=True)
        self.perform(ares, apply=True)
        path = self.root / "state/update.json"
        journal = json.loads(path.read_text())
        journal["device"].pop("binding")
        journal["device"].pop("device_id_sha256")
        path.write_text(json.dumps(journal))
        before = list(ares.calls)
        with self.assertRaises(update.UpdateError) as caught:
            self.perform(ares, reconcile=True)
        self.assertEqual(caught.exception.code, "journal_device_binding_missing")
        self.assertEqual(ares.calls, before)

    def test_reconcile_different_release_cannot_reuse_the_saved_snapshot(self):
        ares = self.timed_out(completed=True)
        self.perform(ares, apply=True)
        before = list(ares.calls)
        for field, changed in (("sha256", "f" * 64), ("source_sha", "f" * 40),
                               ("source_set_sha256", "f" * 64), ("release_id", 999)):
            with self.subTest(field=field):
                original = self.release[field]
                self.release[field] = changed
                try:
                    with self.assertRaises(update.UpdateError) as caught:
                        self.perform(ares, reconcile=True)
                    self.assertEqual(caught.exception.code, "journal_release_mismatch")
                    self.assertEqual(ares.calls, before)
                finally:
                    self.release[field] = original

    @unittest.skipUnless(os.name == "posix", "Ares transport requires macOS or Linux")
    def test_reconcile_conflicting_state_is_retained_and_never_launched(self):
        ares = self.timed_out(completed=True)
        self.perform(ares, apply=True)
        ares.files["ott-state/OttState"] = b"state-created-after-installer"
        real_adapter = update.Ares("fixture-tv", runner=lambda *args, **kwargs: self.fail("device request"))
        current_archive = private_tar({"ott-state": None, **ares.files})
        current_rows, current_content = update.state_archive(current_archive)
        ares.restore = real_adapter.restore
        with patch.object(real_adapter, "capture", return_value=(current_rows, current_content, current_archive)), \
                patch.object(real_adapter, "remote") as remote, self.assertRaises(update.UpdateError) as caught:
            self.perform(ares, reconcile=True)
        self.assertEqual(caught.exception.code, "private_state_changed_after_install")
        remote.assert_not_called()
        self.assertEqual(ares.files["ott-state/OttState"], b"state-created-after-installer")
        self.assertNotIn("launch", ares.calls)
        journal = json.loads((self.root / "state/update.json").read_text())
        self.assertEqual(journal["outcome"], "needs-review")
        self.assertTrue((self.root / "state/snapshot/state.tar").is_file())

    @unittest.skipUnless(os.name == "posix", "Ares transport requires macOS or Linux")
    def test_reconcile_tampered_snapshot_is_rejected_without_state_writes(self):
        ares = self.timed_out(completed=True)
        self.perform(ares, apply=True)
        (self.root / "state/snapshot/state.tar").write_bytes(b"changed-private-backup")
        real_adapter = update.Ares("fixture-tv", runner=lambda *args, **kwargs: self.fail("device request"))
        ares.restore = real_adapter.restore
        with patch.object(real_adapter, "capture") as capture, self.assertRaises(update.UpdateError):
            self.perform(ares, reconcile=True)
        capture.assert_not_called()
        self.assertNotIn("launch", ares.calls)
        self.assertEqual(ares.calls.count("install"), 1)


if __name__ == "__main__":
    unittest.main()
