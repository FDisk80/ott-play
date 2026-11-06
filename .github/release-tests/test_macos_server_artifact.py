"""Source/byte contracts for the macOS server trio; never execute a payload."""

import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "macos_server_artifact", ROOT / "scripts/macos_server_artifact.py"
)
artifact = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(artifact)


class MacOSServerArtifactTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name).resolve()
        self.expected = {
            "source": "1" * 40, "tree": "2" * 40,
            "target": "aarch64-apple-darwin", "packageVersion": "1.2.3-beta.4",
            "planSha256": "3" * 64, "planDigest": "4" * 64,
            "runId": 123, "runAttempt": 2,
        }
        # Synthetic header/load command, deliberately not runnable media/server.
        self.binary = struct.pack("<8I", 0xFEEDFACF, 0x0100000C, 0, 2, 1, 24, 0, 0)
        self.binary += struct.pack("<IIQQ", 0x80000028, 24, 0, 0)
        self.dependencies = (
            "ottplay-server_aarch64-apple-darwin:\n"
            "\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1.0.0)\n"
        ).encode()
        self.record = {
            "schema": 1, "kind": "macos-server-build", "releaseAccepted": False,
            **self.expected,
            "binary": self.identity(artifact.BINARY_NAME, self.binary),
            "dependencies": self.identity(artifact.DEPENDENCIES_NAME, self.dependencies),
            "build": {"package": "ottplay-server", "profile": "release",
                      "features": "package defaults", "jobs": 1, "incremental": False},
        }
        (self.directory / artifact.BINARY_NAME).write_bytes(self.binary)
        (self.directory / artifact.DEPENDENCIES_NAME).write_bytes(self.dependencies)
        self.save_record()

    @staticmethod
    def identity(name, payload):
        return {"name": name, "size": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}

    def save_record(self):
        (self.directory / artifact.RECORD_NAME).write_text(json.dumps(self.record), encoding="utf-8")

    def validate(self):
        return artifact.validate_artifact_set(self.directory, self.expected)

    def test_valid_trio_coexists_with_other_release_assets_without_executing(self):
        (self.directory / "desktop.zip").write_bytes(b"unrelated fixture")
        with mock.patch.object(artifact.subprocess, "run", side_effect=AssertionError("no process")), \
             mock.patch.object(artifact.subprocess, "check_output", side_effect=AssertionError("no process")):
            self.assertEqual(self.validate(), self.record)

    def test_every_producer_field_is_compared_and_raw_plan_is_distinct(self):
        original = copy.deepcopy(self.record)
        for key in self.expected:
            with self.subTest(key=key):
                self.record = copy.deepcopy(original)
                self.record[key] = self.record[key] + 1 if type(self.record[key]) is int else "9" + self.record[key][1:]
                self.save_record()
                with self.assertRaises(ValueError):
                    self.validate()
        self.record = copy.deepcopy(original)
        self.record["planSha256"] = self.expected["planDigest"]
        self.save_record()
        with self.assertRaises(ValueError):
            self.validate()

    def test_strict_schema_acceptance_and_numeric_types(self):
        original = copy.deepcopy(self.record)
        for key, value in (("schema", True), ("kind", "other"), ("releaseAccepted", True),
                           ("releaseAccepted", 0), ("runId", True), ("runAttempt", 0)):
            with self.subTest(key=key, value=value):
                self.record = copy.deepcopy(original)
                self.record[key] = value
                self.save_record()
                with self.assertRaises(ValueError):
                    self.validate()

    def test_unknown_missing_and_duplicate_record_fields_are_rejected(self):
        self.record["unknown"] = 1
        self.save_record()
        with self.assertRaises(ValueError):
            self.validate()
        del self.record["unknown"]
        del self.record["dependencies"]
        self.save_record()
        with self.assertRaises(ValueError):
            self.validate()
        (self.directory / artifact.RECORD_NAME).write_text('{"schema":1,"schema":1}', encoding="utf-8")
        with self.assertRaises(ValueError):
            self.validate()

    def test_missing_extra_and_case_colliding_server_files_are_rejected(self):
        dependency = self.directory / artifact.DEPENDENCIES_NAME
        dependency.unlink()
        with self.assertRaises(ValueError):
            self.validate()
        dependency.write_bytes(self.dependencies)
        for name in (artifact.BINARY_NAME + ".extra", artifact.BINARY_NAME.upper()):
            with self.subTest(name=name):
                extra = self.directory / name
                extra.write_bytes(b"unexpected")
                with self.assertRaises(ValueError):
                    self.validate()
                extra.unlink()

    def test_symlink_and_nonregular_payload_are_rejected(self):
        payload = self.directory / artifact.BINARY_NAME
        original = self.directory / "original"
        payload.rename(original)
        payload.symlink_to(original)
        with self.assertRaises(ValueError):
            self.validate()
        payload.unlink()
        payload.mkdir()
        with self.assertRaises(ValueError):
            self.validate()

    def test_all_three_file_size_bounds_are_enforced(self):
        for key in ("MAX_BINARY_BYTES", "MAX_DEPENDENCIES_BYTES", "MAX_RECORD_BYTES"):
            with self.subTest(key=key), mock.patch.object(artifact, key, 1):
                with self.assertRaises(ValueError):
                    self.validate()

    def test_directory_ancestor_symlink_is_rejected(self):
        alias = self.directory / "alias"
        nested = self.directory / "nested"
        nested.mkdir()
        for name in artifact.ARTIFACT_NAMES:
            (nested / name).write_bytes((self.directory / name).read_bytes())
        self.assertEqual(artifact.validate_artifact_set(nested, self.expected), self.record)
        alias.symlink_to(self.directory, target_is_directory=True)
        with self.assertRaises(ValueError):
            artifact.validate_artifact_set(alias / "nested", self.expected)

    def test_tampered_payload_and_sidecar_fail_the_record_digest(self):
        for name in (artifact.BINARY_NAME, artifact.DEPENDENCIES_NAME):
            with self.subTest(name=name):
                path = self.directory / name
                original = path.read_bytes()
                path.write_bytes(original + b"changed")
                with self.assertRaises(ValueError):
                    self.validate()
                path.write_bytes(original)

    def test_identity_names_sizes_and_hashes_are_exact(self):
        original = copy.deepcopy(self.record)
        for key in ("binary", "dependencies"):
            for field, value in (("name", "../other"), ("size", True), ("sha256", "0" * 64)):
                with self.subTest(key=key, field=field):
                    self.record = copy.deepcopy(original)
                    self.record[key][field] = value
                    self.save_record()
                    with self.assertRaises(ValueError):
                        self.validate()

    def test_wrong_arch_fat_dylib_and_broken_commands_fail_even_with_matching_hash(self):
        variants = [b"\xca\xfe\xba\xbe" + self.binary[4:], self.binary[:20]]
        for index, value in ((1, 0x01000007), (3, 6), (4, 2), (5, 0x7FFFFFFF)):
            header = list(struct.unpack("<8I", self.binary[:32]))
            header[index] = value
            variants.append(struct.pack("<8I", *header) + self.binary[32:])
        variants.append(self.binary[:36] + struct.pack("<I", 7) + self.binary[40:])
        for binary in variants:
            with self.subTest(header=binary[:32].hex()):
                (self.directory / artifact.BINARY_NAME).write_bytes(binary)
                self.record["binary"] = self.identity(artifact.BINARY_NAME, binary)
                self.save_record()
                with self.assertRaises(ValueError):
                    self.validate()

    def test_dependency_listing_names_the_delivered_binary(self):
        wrong = b"other-binary:\n\t/usr/lib/libSystem.B.dylib\n"
        (self.directory / artifact.DEPENDENCIES_NAME).write_bytes(wrong)
        self.record["dependencies"] = self.identity(artifact.DEPENDENCIES_NAME, wrong)
        self.save_record()
        with self.assertRaises(ValueError):
            self.validate()

    def producer_fixture(self):
        root = self.directory / "checkout"
        (root / "scripts").mkdir(parents=True)
        (root / ".git").mkdir()
        (root / "target").mkdir()
        (root / "tauri-artifacts").mkdir()
        (root / "target/server").write_bytes(self.binary)
        (root / ".release-policy.json").write_text('{"versioning":{"files":[]}}', encoding="utf-8")
        raw = b'{"source_sha":"' + self.expected["source"].encode() + b'"}\n'
        (root / ".release-plan.json").write_bytes(raw)
        official = SimpleNamespace(
            validate_plan=mock.Mock(), sync_versions=mock.Mock(), verify_checkout=mock.Mock(),
            projections=mock.Mock(return_value={"package": self.expected["packageVersion"]}),
            plan_digest=mock.Mock(return_value=self.expected["planDigest"]),
        )
        return root, raw, official

    def test_producer_uses_actual_source_plan_and_dependency_output_before_validation(self):
        root, raw, official = self.producer_fixture()

        def otool(command, **kwargs):
            self.assertEqual(command, ["otool", "-L", artifact.BINARY_NAME])
            self.assertEqual(kwargs["cwd"], root / "tauri-artifacts")
            self.assertEqual(kwargs["timeout"], 30)
            self.assertIs(kwargs["check"], True)
            kwargs["stdout"].write(self.dependencies)

        environment = {"GITHUB_ACTIONS": "true", "GITHUB_SHA": self.expected["source"],
                       "GITHUB_RUN_ID": "123", "GITHUB_RUN_ATTEMPT": "2"}
        with mock.patch.dict(sys.modules, {"version_plan": official}), \
             mock.patch.object(artifact, "__file__", str(root / "scripts/macos_server_artifact.py")), \
             mock.patch.dict(artifact.os.environ, environment), \
             mock.patch.object(artifact.subprocess, "check_output", side_effect=[self.expected["source"], self.expected["tree"], b"", b"", b""]), \
             mock.patch.object(artifact.subprocess, "run", side_effect=otool):
            record = artifact.create_artifact_set(Path("target/server"), Path("tauri-artifacts"), Path(".release-plan.json"))
        expected = {**self.expected, "planSha256": hashlib.sha256(raw).hexdigest()}
        self.assertEqual(artifact.validate_artifact_set(root / "tauri-artifacts", expected), record)
        self.assertEqual(record["binary"], self.identity(artifact.BINARY_NAME, self.binary))
        self.assertEqual(record["dependencies"], self.identity(artifact.DEPENDENCIES_NAME, self.dependencies))
        policy = {"versioning": {"files": []}}
        official.validate_plan.assert_called_once_with(json.loads(raw), policy, self.expected["source"])
        official.sync_versions.assert_called_once_with(root, policy, json.loads(raw), check=True)
        official.verify_checkout.assert_called_once_with(root, policy, json.loads(raw))

    def test_producer_refuses_foreign_actions_source_before_writing(self):
        root, _raw, official = self.producer_fixture()
        with mock.patch.dict(sys.modules, {"version_plan": official}), \
             mock.patch.object(artifact, "__file__", str(root / "scripts/macos_server_artifact.py")), \
             mock.patch.dict(artifact.os.environ, {"GITHUB_ACTIONS": "true", "GITHUB_SHA": "f" * 40}), \
             mock.patch.object(artifact.subprocess, "check_output", side_effect=[self.expected["source"], self.expected["tree"], b"", b"", b""]):
            with self.assertRaises(ValueError):
                artifact.create_artifact_set(Path("target/server"), Path("tauri-artifacts"), Path(".release-plan.json"))
        self.assertEqual(list((root / "tauri-artifacts").iterdir()), [])

    def test_producer_rolls_back_only_created_trio_after_otool_or_validation_failure(self):
        root, _raw, official = self.producer_fixture()
        unrelated = root / "tauri-artifacts/desktop.zip"
        unrelated.write_bytes(b"preserve existing desktop payload")
        environment = {"GITHUB_ACTIONS": "true", "GITHUB_SHA": self.expected["source"],
                       "GITHUB_RUN_ID": "123", "GITHUB_RUN_ATTEMPT": "2"}
        for fail_otool in (True, False):
            with self.subTest(fail_otool=fail_otool):
                def otool(_command, **kwargs):
                    kwargs["stdout"].write(self.dependencies)
                    if fail_otool:
                        raise artifact.subprocess.CalledProcessError(1, "otool")

                with mock.patch.dict(sys.modules, {"version_plan": official}), \
                     mock.patch.object(artifact, "__file__", str(root / "scripts/macos_server_artifact.py")), \
                     mock.patch.dict(artifact.os.environ, environment), \
                     mock.patch.object(artifact.subprocess, "check_output", side_effect=[self.expected["source"], self.expected["tree"], b"", b"", b""]), \
                     mock.patch.object(artifact.subprocess, "run", side_effect=otool), \
                     mock.patch.object(artifact, "validate_artifact_set", side_effect=ValueError("invalid record")) as validate:
                    with self.assertRaises((ValueError, artifact.subprocess.CalledProcessError)):
                        artifact.create_artifact_set(Path("target/server"), Path("tauri-artifacts"), Path(".release-plan.json"))
                    self.assertEqual(validate.call_count, 0 if fail_otool else 1)
                self.assertEqual(list((root / "tauri-artifacts").iterdir()), [unrelated])
                self.assertEqual(unrelated.read_bytes(), b"preserve existing desktop payload")

    def test_producer_rejects_staged_metadata_and_other_tracked_changes_before_output(self):
        root, _raw, official = self.producer_fixture()
        environment = {"GITHUB_ACTIONS": "true", "GITHUB_SHA": self.expected["source"],
                       "GITHUB_RUN_ID": "123", "GITHUB_RUN_ATTEMPT": "2"}
        cases = ([b"src/main.rs\0"],  # staged, even if worktree was restored
                 [b"", b" mode change 100644 => 100755 src/main.rs\n"],
                 [b"", b" delete mode 100644 src/main.rs\n"],
                 [b"", b"", b"src/main.rs\0"])
        for index, changes in enumerate(cases):
            directory = root / ("output-" + str(index))
            directory.mkdir()
            def otool(_command, **kwargs):
                kwargs["stdout"].write(self.dependencies)
            with self.subTest(changes=changes), \
                 mock.patch.dict(sys.modules, {"version_plan": official}), \
                 mock.patch.object(artifact, "__file__", str(root / "scripts/macos_server_artifact.py")), \
                 mock.patch.dict(artifact.os.environ, environment), \
                 mock.patch.object(artifact.subprocess, "check_output", side_effect=[
                     self.expected["source"], self.expected["tree"], *changes]), \
                 mock.patch.object(artifact.subprocess, "run", side_effect=otool) as command:
                with self.assertRaisesRegex(ValueError, "Producer source"):
                    artifact.create_artifact_set(Path("target/server"), directory, Path(".release-plan.json"))
                command.assert_not_called()
                official.verify_checkout.assert_not_called()
                self.assertEqual(list(directory.iterdir()), [])

    def test_only_exact_official_version_overlay_is_allowed_in_tracked_version_file(self):
        # Use the real existing version adapter, not a filename-only whitelist.
        with mock.patch.object(sys, "path", [str(ROOT / "scripts"), *sys.path]):
            import version_plan
        root, _raw, _official = self.producer_fixture()
        original = b'{"version":"1.2.3","name":"fixture"}\n'
        expected = original.replace(b'"1.2.3"', b'"1.2.3-beta.4"')
        policy = {"versioning": {"files": [{"path": "package.json", "format": "json", "field": "version"}]}}
        plan = {"source_sha": self.expected["source"], "base_version": "1.2.3",
                "version": "1.2.3-beta.4", "channel": "beta", "sequence": 4,
                "build_number": None, "promotion": "promote-bytes"}

        def git(command, **kwargs):
            if command[:2] == ["git", "diff"]:
                self.assertEqual(kwargs["cwd"], root)
                self.assertEqual(kwargs["timeout"], 30)
                return b"package.json\0" if command[2:5] == ["--name-only", "--no-renames", "-z"] else b""
            if command[-2:] == ["rev-parse", "HEAD"]:
                return self.expected["source"]
            self.assertEqual(command[-1], self.expected["source"] + ":package.json")
            return original

        (root / "package.json").write_bytes(expected)
        with mock.patch.object(artifact.subprocess, "check_output", side_effect=git):
            artifact._verify_tracked_source(root, policy, plan, version_plan)
            (root / "package.json").write_bytes(expected.replace(b'"fixture"', b'"tampered"'))
            with self.assertRaisesRegex(ValueError, "Undeclared changes in version input"):
                artifact._verify_tracked_source(root, policy, plan, version_plan)

    def test_policy_requires_record_version_and_workflow_validates_before_staging(self):
        policy = json.loads((ROOT / ".release-policy.json").read_text(encoding="utf-8"))
        self.assertIn({"path": artifact.RECORD_NAME, "format": "json", "value": "package",
                       "field": "packageVersion"}, policy["versioning"]["artifacts"])
        workflow = (ROOT / ".github/workflows/release-build.yml").read_text(encoding="utf-8")
        step = workflow.split("      - name: Build macOS ARM64 server from frozen release inputs\n", 1)[1].split("      - name:", 1)[0]
        self.assertIn("if: matrix.platform == 'macos-latest' && matrix.target == 'aarch64-apple-darwin'", step)
        self.assertIn('CARGO_BUILD_JOBS: "1"', step)
        self.assertIn('CARGO_INCREMENTAL: "0"', step)
        self.assertIn("timeout-minutes: 30", step)
        self.assertLess(step.index("cargo build --locked --release --target aarch64-apple-darwin -p ottplay-server --bin ottplay-server"),
                        step.index("python3 scripts/macos_server_artifact.py create"))
        self.assertNotIn("continue-on-error", step)
        self.assertLess(workflow.index("python3 scripts/macos_server_artifact.py create"),
                        workflow.index('run: python3 scripts/stage_release_assets.py --target "$RELEASE_ASSET_TARGET" --pattern "$RELEASE_ASSET_PATTERN_0"'))


if __name__ == "__main__":
    unittest.main()
