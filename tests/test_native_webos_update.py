"""Offline update regressions; no television, credentials or release download."""

import hashlib
import importlib.util
import io
import json
import os
import shlex
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
        self.assertTrue(all("set -C" in command for command, _ in writes))
        self.assertTrue(all("rm " not in command for command, _ in calls))

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
        return {"alias": "fixture-tv", "fingerprint": "f" * 64, "model": "fixture-model"}

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
