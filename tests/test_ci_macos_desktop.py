"""Pure and mocked capture contracts. Never starts Cocoa, a compiler or a player."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("desktop_capture", ROOT / "scripts/ci-macos-desktop.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class DesktopCaptureContracts(unittest.TestCase):
    def test_capture_is_explicit_manual_only_and_conflicting_modes_fail(self):
        for event in ("pull_request", "push", "merge_group", "workflow_call"):
            self.assertFalse(MODULE.manual_capture(event, False, True))
        self.assertFalse(MODULE.manual_capture("workflow_dispatch", False, False))
        self.assertFalse(MODULE.manual_capture("workflow_dispatch", True, False))
        self.assertTrue(MODULE.manual_capture("workflow_dispatch", False, True))
        with self.assertRaises(RuntimeError):
            MODULE.manual_capture("workflow_dispatch", True, True)
        workflow = (ROOT / ".github/workflows/native-parity.yml").read_text()
        self.assertIn("inputs.desktop_acceptance == true && inputs.desktop_preflight_only != true", workflow)
        self.assertLess(workflow.index("python3 scripts/ci-macos-desktop.py preflight"),
                        workflow.index("python3 scripts/ci-macos-desktop.py capture"))
        self.assertIn('run: test "$DESKTOP_ACCEPTANCE" != true', workflow)

    def test_helper_result_must_match_requested_action(self):
        value = {"schema": 1, "action": "snapshot", "status": "ok"}
        self.assertIs(MODULE.validate_helper(value, "snapshot"), value)
        for action in ("finder-open", "finder-drop", "preflight"):
            with self.assertRaises(RuntimeError):
                MODULE.validate_helper(value, action)
        value["status"] = "refused"
        with self.assertRaises(RuntimeError):
            MODULE.validate_helper(value, "snapshot")

    def test_full_helper_requires_capabilities_but_not_appleevents(self):
        facts = dict.fromkeys(("accessibility", "post_events", "screen_capture",
                               "on_console", "login_complete", "display_active"), True)
        facts["finder_automation_status"] = -1743
        value = {"schema": 1, "action": "preflight", "status": "ok", "capabilities": facts}
        self.assertIs(MODULE.validate_helper(value, "preflight"), value)
        facts["screen_capture"] = False
        with self.assertRaises(RuntimeError):
            MODULE.validate_helper(value, "preflight")

    def test_architecture_is_actual_supported_host(self):
        for arch in ("arm64", "x86_64"):
            self.assertEqual(MODULE.host_architecture(arch), arch)
        with self.assertRaises(RuntimeError):
            MODULE.host_architecture("unknown")

    def test_config_uses_new_private_store_without_seeding_it(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {
                "GITHUB_RUN_ID": "123", "GITHUB_RUN_ATTEMPT": "1"}):
            output = Path(directory)
            config, environment = MODULE.generate_config(output, "a" * 40)
            self.assertEqual(config["identifier"], "com.ottplay.foss.qa123a1")
            self.assertEqual(environment["OTTPLAY_DATA_DIR"], str(output / "runtime-data"))
            self.assertFalse((output / "runtime-data").exists())
            self.assertEqual(environment["OTTPLAY_WEB_URL"], "")
            self.assertEqual(config["bundle"]["macOS"]["signingIdentity"], "-")
            (output / "runtime-data").mkdir()
            with self.assertRaises(RuntimeError):
                MODULE.generate_config(output, "a" * 40)

    def test_failed_child_keeps_failure_without_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            runner = MODULE.Runner(Path(directory), 10)
            proc = Mock(pid=123, returncode=7)
            proc.poll.return_value = 7
            with patch.object(MODULE.subprocess, "Popen", return_value=proc) as spawn, \
                 patch.object(MODULE, "stop_owned", return_value=False):
                with self.assertRaises(RuntimeError):
                    runner.run("synthetic", ["not-executed"])
            spawn.assert_called_once()
            self.assertEqual(runner.commands[0]["exit_code"], 7)

    def test_timeout_stops_owned_group_and_retains_error(self):
        with tempfile.TemporaryDirectory() as directory:
            runner = MODULE.Runner(Path(directory), 10)
            proc = Mock(pid=123, returncode=None)
            proc.poll.return_value = None
            with patch.object(MODULE.subprocess, "Popen", return_value=proc), \
                 patch.object(MODULE, "stop_owned", return_value=True) as stop, \
                 patch.object(MODULE.time, "monotonic", side_effect=[0, 0, 11, 12]):
                with self.assertRaisesRegex(RuntimeError, "deadline"):
                    runner.run("synthetic", ["not-executed"], seconds=1)
            stop.assert_called_once_with(proc)

    def test_lingering_owned_group_is_not_success(self):
        with tempfile.TemporaryDirectory() as directory:
            runner = MODULE.Runner(Path(directory), 10)
            proc = Mock(pid=123, returncode=0)
            proc.poll.return_value = 0
            with patch.object(MODULE.subprocess, "Popen", return_value=proc), \
                 patch.object(MODULE, "stop_owned", return_value=True):
                with self.assertRaisesRegex(RuntimeError, "left its process group"):
                    runner.run("synthetic", ["not-executed"])


    def test_helper_breadcrumbs_stay_separate_from_single_json_stdout(self):
        with tempfile.TemporaryDirectory() as directory:
            runner = MODULE.Runner(Path(directory), 10)
            proc = Mock(pid=123, returncode=0)
            proc.poll.return_value = 0
            def fake_spawn(argv, *, stdout, stderr, **kwargs):
                self.assertIsNot(stdout, stderr)
                stdout.write(b'{"schema":1,"action":"snapshot","status":"ok"}\n')
                stderr.write(b'{"phase":"synthetic","state":"before"}\n')
                return proc
            with patch.object(MODULE.subprocess, "Popen", side_effect=fake_spawn), \
                 patch.object(MODULE, "stop_owned", return_value=False):
                result = runner.helper("synthetic", Path("unused"), "snapshot")
            self.assertEqual(result["action"], "snapshot")
            self.assertIn('"phase":"synthetic"', (Path(directory) / "synthetic.stderr.log").read_text())
            self.assertEqual(runner.commands[0]["stderr_sha256"],
                             MODULE.sha(Path(directory) / "synthetic.stderr.log"))

    def test_helper_still_rejects_multiple_stdout_documents(self):
        with tempfile.TemporaryDirectory() as directory:
            runner = MODULE.Runner(Path(directory), 10)
            with patch.object(runner, "run", return_value='{}\n{}\n'):
                with self.assertRaises(json.JSONDecodeError):
                    runner.helper("synthetic", Path("unused"), "snapshot")

    def test_helper_stderr_budget_failure_remains_failed(self):
        with tempfile.TemporaryDirectory() as directory:
            runner = MODULE.Runner(Path(directory), 10)
            proc = Mock(pid=123, returncode=0)
            proc.poll.return_value = 0
            def fake_spawn(argv, *, stdout, stderr, **kwargs):
                stderr.seek(2 * 1024 * 1024)
                stderr.write(b'x')
                stderr.flush()
                return proc
            with patch.object(MODULE.subprocess, "Popen", side_effect=fake_spawn), \
                 patch.object(MODULE, "stop_owned", return_value=False) as stop:
                with self.assertRaisesRegex(RuntimeError, "stderr budget"):
                    runner.helper("synthetic", Path("unused"), "snapshot")
            stop.assert_called_once_with(proc)
            self.assertEqual(runner.commands[0]["status"], "failed")

    def test_one_readonly_failure_diagnostic_preserves_primary_failure(self):
        receipt = {"status": "FAILED", "error": "primary cold-open deadline"}
        runner = Mock()
        runner.helper.side_effect = RuntimeError("diagnostic unavailable")
        MODULE.collect_failure_evidence(receipt, runner, Path("unused"))
        runner.helper.assert_called_once_with("finder-failure-state", Path("unused"),
                                              "finder-diagnostic", seconds=12, cleanup=True)
        self.assertEqual(receipt["error"], "primary cold-open deadline")
        self.assertEqual(receipt["status"], "FAILED")
        self.assertIn("diagnostic unavailable", receipt["finder_diagnostic_error"])

    def test_success_does_not_trigger_failure_diagnostic(self):
        runner = Mock()
        receipt = {"status": "CAPTURED_REQUIRES_VISUAL_REVIEW"}
        MODULE.collect_failure_evidence(receipt, runner, Path("unused"))
        runner.helper.assert_not_called()

    def test_original_child_failure_survives_cleanup_error(self):
        with tempfile.TemporaryDirectory() as directory:
            runner = MODULE.Runner(Path(directory), 10)
            proc = Mock(pid=123, returncode=7)
            proc.poll.return_value = 7
            with patch.object(MODULE.subprocess, "Popen", return_value=proc), \
                 patch.object(MODULE, "stop_owned", side_effect=RuntimeError("cleanup failed")):
                with self.assertRaisesRegex(RuntimeError, "command failed"):
                    runner.run("synthetic", ["not-executed"])
            self.assertEqual(runner.commands[0]["exit_code"], 7)
            self.assertIn("cleanup failed", runner.commands[0]["cleanup_error"])


    def test_fixture_is_prepared_once_and_changed_reuse_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            output = Path(directory) / "owned"
            (root / "diagnostics").mkdir(parents=True)
            output.mkdir()
            fixture = b"synthetic hash-bound fixture bytes"
            (root / "diagnostics/av-v1.mp4").write_bytes(fixture)
            with patch.object(MODULE, "FIXTURE_SHA", MODULE.hashlib.sha256(fixture).hexdigest()):
                first, second = MODULE.fixture_files(root, output, create=True)
                self.assertEqual(first.read_bytes(), fixture)
                self.assertEqual(second.read_bytes(), fixture)
                with patch.object(MODULE.shutil, "copyfile") as copy:
                    self.assertEqual(MODULE.fixture_files(root, output), (first, second))
                    copy.assert_not_called()
                    first.write_bytes(b"changed after reveal")
                    with self.assertRaisesRegex(RuntimeError, "missing or changed"):
                        MODULE.fixture_files(root, output)
                    copy.assert_not_called()
                self.assertEqual(first.read_bytes(), b"changed after reveal")

    def test_reveal_gate_requires_exact_path_action_and_route(self):
        file = Path("/owned/fixtures/QA video Ω 01.mp4")
        value = {"schema": 1, "action": "finder-reveal", "status": "ok",
                 "selected_file": str(file), "route": "finder_reveal_exact_selection"}
        self.assertIs(MODULE.validate_reveal(value, file), value)
        for field, wrong in (("selected_file", "/other/QA video Ω 01.mp4"),
                             ("route", "launchservices"), ("action", "finder-open"),
                             ("status", "refused")):
            with self.subTest(field=field), self.assertRaises(RuntimeError):
                MODULE.validate_reveal(dict(value, **{field: wrong}), file)
        with self.assertRaises(RuntimeError):
            MODULE.validate_reveal(None, file)

    def _mocked_preflight(self, fail_reveal, fail_trace=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            (root / "scripts").mkdir(parents=True)
            script = root / "scripts/ci-macos-desktop.py"
            script.write_text("synthetic controller")
            (root / "tests/macos-desktop").mkdir(parents=True)
            (root / "tests/macos-desktop/desktop-helper.swift").write_text("synthetic helper")
            (root / "diagnostics").mkdir()
            fixture = b"synthetic hash-bound fixture bytes"
            (root / "diagnostics/av-v1.mp4").write_bytes(fixture)
            temp = Path(directory) / "runner"
            output = temp / "owned"
            runner = Mock()
            calls = []
            def run(name, argv, **kwargs):
                calls.append((name, argv, kwargs))
                if name == "preflight-head":
                    return "a" * 40
                if name == "compile-gui-helper":
                    (output / "macos-desktop-helper").write_bytes(b"synthetic binary")
                return ""
            def helper(name, executable, action, *args, **kwargs):
                calls.append((name, action, kwargs))
                if action == "trace-contract":
                    if fail_trace:
                        raise RuntimeError("synthetic trace contract failure")
                    return self._trace_contract_result()
                if action == "preflight":
                    return {"schema": 1, "action": action, "status": "ok"}
                if action == "finder-reveal":
                    self.assertEqual(args[0].read_bytes(), fixture)
                    if fail_reveal:
                        raise RuntimeError("synthetic reveal deadline")
                    return {"schema": 1, "action": action, "status": "ok",
                            "selected_file": str(args[0]), "route": "finder_reveal_exact_selection"}
                self.assertEqual(action, "finder-diagnostic")
                return {"schema": 1, "action": action, "status": "ok", "traversal_exhausted": False}
            runner.run.side_effect = run
            runner.helper.side_effect = helper
            environment = {"GITHUB_EVENT_NAME": "workflow_dispatch", "DESKTOP_ACCEPTANCE": "true",
                           "GITHUB_ACTIONS": "true", "RUNNER_ENVIRONMENT": "github-hosted",
                           "RUNNER_TEMP": str(temp), "GITHUB_SHA": "a" * 40,
                           "GITHUB_RUN_ID": "123", "GITHUB_RUN_ATTEMPT": "1"}
            with patch.object(MODULE, "__file__", str(script)), \
                 patch.object(MODULE, "Runner", return_value=runner), \
                 patch.object(MODULE, "FIXTURE_SHA", MODULE.hashlib.sha256(fixture).hexdigest()), \
                 patch.object(MODULE.platform, "machine", return_value="arm64"), \
                 patch.object(MODULE.sys, "platform", "darwin"), \
                 patch.object(MODULE.sys, "argv", [str(script), "preflight", "--output", str(output)]), \
                 patch.dict(os.environ, environment, clear=True), patch("builtins.print"):
                result = MODULE.main()
            return result, json.loads((output / "preflight.json").read_text()), calls

    def test_early_reveal_failure_blocks_ready_without_build_or_retry(self):
        result, receipt, calls = self._mocked_preflight(True)
        self.assertEqual(result, 1)
        self.assertEqual(receipt["status"], "FAILED")
        self.assertIn("synthetic reveal deadline", receipt["error"])
        names = [call[0] for call in calls]
        self.assertEqual(names.count("finder-reveal"), 1)
        self.assertEqual(names.count("finder-failure-state"), 1)
        self.assertNotIn("build-package", names)
        self.assertNotIn("finder_reveal", receipt)
        self.assertFalse(receipt["playback_accepted"])
        reveal = next(call for call in calls if call[0] == "finder-reveal")
        self.assertEqual(reveal[2]["seconds"], 40)
        diagnostic = next(call for call in calls if call[0] == "finder-failure-state")
        self.assertEqual(diagnostic[2], {"seconds": 12, "cleanup": True})

    def test_early_reveal_success_is_selection_evidence_only(self):
        result, receipt, calls = self._mocked_preflight(False)
        self.assertEqual(result, 0)
        self.assertEqual(receipt["status"], "PREFLIGHT_READY")
        self.assertEqual(receipt["finder_reveal"]["route"], "finder_reveal_exact_selection")
        self.assertFalse(receipt["playback_accepted"])
        self.assertIn("no Open With", receipt["finder_reveal_scope"])
        names = [call[0] for call in calls]
        self.assertLess(names.index("trace-contract"), names.index("gui-preflight"))
        self.assertLess(names.index("gui-preflight"), names.index("finder-reveal"))
        self.assertNotIn("finder-failure-state", names)
        self.assertNotIn("build-package", names)


    def _trace_contract_result(self):
        return {"schema": 1, "action": "trace-contract", "status": "ok",
                "routine_reads": 20000, "routine_errors": 78, "slow_reads": 20,
                "critical_events": 2, "trace_limit": 1048576,
                "trace_bytes": 100000, "trace_unavailable": False}

    def test_trace_contract_requires_complete_counts_and_bounded_output(self):
        valid = self._trace_contract_result()
        self.assertIs(MODULE.validate_trace_contract(valid), valid)
        for key, wrong in (("routine_reads", 19999), ("routine_errors", 77),
                           ("slow_reads", 19), ("critical_events", 1),
                           ("trace_limit", 2097152), ("trace_bytes", 524289),
                           ("trace_bytes", False), ("trace_unavailable", True)):
            with self.subTest(key=key, wrong=wrong), self.assertRaises(RuntimeError):
                MODULE.validate_trace_contract(dict(valid, **{key: wrong}))
        with self.assertRaises(RuntimeError):
            MODULE.validate_trace_contract(None)

    def test_failed_trace_contract_stops_before_gui_and_finder(self):
        result, receipt, calls = self._mocked_preflight(False, fail_trace=True)
        self.assertEqual(result, 1)
        self.assertEqual(receipt["status"], "FAILED")
        self.assertIn("synthetic trace contract failure", receipt["error"])
        names = [call[0] for call in calls]
        self.assertEqual(names.count("trace-contract"), 1)
        for skipped in ("gui-preflight", "finder-reveal", "finder-failure-state", "build-package"):
            self.assertNotIn(skipped, names)
        self.assertNotIn("fixture", receipt)
        self.assertFalse(receipt["playback_accepted"])


    def _screenshot_result(self):
        return {"schema": 1, "action": "screenshot", "status": "ok", "pid": 123,
                "window_id": 77, "native_window": {"owner_pid": 123,
                    "scope": "owned_on_screen_windows", "query_performed": True,
                    "candidate_count": 1, "owned_count": 1, "selected_id": 77,
                    "records": [{"window_id": 77, "on_screen": True, "candidate": True,
                                 "layer": 0, "width": 1200, "height": 720}], "records_truncated": 0}}

    def test_capture_image_forwards_action_pid_and_keeps_window_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / "owned.png"
            # File presence only: these mocked bytes are not pixel or PNG evidence.
            image.write_bytes(b"synthetic image placeholder")
            runner = Mock()
            expected = self._screenshot_result()
            runner.helper.return_value = expected
            result = MODULE.capture_image(runner, "cold-image", Path("helper"), Path("QA.app"), image, 123)
            runner.helper.assert_called_once_with("cold-image", Path("helper"), "screenshot",
                                                  Path("QA.app"), image, "123", seconds=40)
            self.assertIs(result, expected)
            self.assertEqual(result["native_window"]["selected_id"], result["window_id"])

    def test_capture_image_rejects_changed_owner_or_incomplete_window_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / "owned.png"
            image.write_bytes(b"synthetic image placeholder")
            mutations = [("pid", 124), ("pid", True), ("window_id", 78),
                         ("native_window", None), ("owner_pid", 124),
                         ("query_performed", False), ("scope", "all_windows"),
                         ("candidate_count", 0), ("candidate_count", 2),
                         ("candidate_count", True), ("owned_count", 0),
                         ("selected_id", 78), ("records", []), ("records_truncated", -1)]
            for field, wrong in mutations:
                with self.subTest(field=field, wrong=wrong):
                    value = self._screenshot_result()
                    if field in ("pid", "window_id", "native_window"):
                        value[field] = wrong
                    else:
                        value["native_window"][field] = wrong
                    runner = Mock()
                    runner.helper.return_value = value
                    with self.assertRaises(RuntimeError):
                        MODULE.capture_image(runner, "cold-image", Path("helper"), Path("QA.app"), image, 123)
                    runner.helper.assert_called_once()

    def test_capture_image_rejects_bad_action_pid_and_never_retries_refusal(self):
        runner = Mock()
        for pid in (None, False, 0, -1, 2147483648):
            with self.subTest(pid=pid), self.assertRaises(RuntimeError):
                MODULE.capture_image(runner, "cold-image", Path("helper"), Path("QA.app"), Path("unused.png"), pid)
        runner.helper.assert_not_called()
        runner.helper.side_effect = RuntimeError("native_window_ambiguity")
        with self.assertRaisesRegex(RuntimeError, "native_window_ambiguity"):
            MODULE.capture_image(runner, "cold-image", Path("helper"), Path("QA.app"), Path("unused.png"), 123)
        runner.helper.assert_called_once()


if __name__ == "__main__":
    unittest.main()
