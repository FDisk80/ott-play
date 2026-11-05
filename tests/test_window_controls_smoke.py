#!/usr/bin/env python3
"""Validate the smoke runner without opening windows or launching native code."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("window_smoke_runner", ROOT / "scripts/check-window-controls.py")
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


def aspect_state(enabled=False, active=None):
    return {"ok": True, "supported": True, "enabled": enabled,
            "active": enabled if active is None else active}


def sizing_evidence(enabled):
    outputs = [[43, 38, 843, 488], [0, 38, 800, 488], [21, 77, 821, 527],
               [43, 77, 843, 527], [0, 77, 800, 527], [21, 0, 821, 450],
               [43, 0, 843, 450], [0, 0, 800, 450]]
    return {"kind": "owned-hwnd-message-probe", "enabled": enabled, "os_bounds_captures": 2,
            "outer_limits": [160, 90, 3840, 2160], "client_insets": [0, 0],
            "samples": [{"edge": edge, "input": [0, 0, 843, 527],
                         "output": outputs[edge - 1] if enabled else [0, 0, 843, 527]}
                        for edge in range(1, 9)]}


def evidence(missing=False):
    def state(top=False, full=False):
        return {"topmost": top, "win32_topmost": top, "fullscreen": full, "rect": [0, 0, 640, 360]}
    commands = (["set_always_on_top", "set_fullscreen", "toggle_fullscreen"] if missing else ["set_always_on_top"]) + ["get_window_aspect_lock", "set_window_aspect_lock"]
    return {"status": "pass", "owned_labels": ["main", "pip"], "cleanup_errors": [],
            "mode": "missing-permission" if missing else "production-permissions",
            "denials": [{"command": command, "window": "main" if missing else "pip", "error": "command not allowed"} for command in commands],
            "aux_unchanged": True, "initial": state(), "final": state(),
            "topmost_sequence": [state(top=top) for top in [True, True, False, False]],
            "fullscreen_sequence": [state(top, full) for top, full in [(False, True), (False, False), (True, True), (True, False)]],
            "aspect": {"initial": aspect_state(), "final": aspect_state(),
                       "set_sequence": [aspect_state(v) for v in [True, True, False, False]],
                       "set_geometry": [state() for _ in range(4)],
                       "fullscreen_sequence": [aspect_state(True, v) for v in [False, True] * 3],
                       "sizing_enabled": sizing_evidence(True), "sizing_disabled": sizing_evidence(False)}}


class EvidenceTests(unittest.TestCase):
    def test_complete_native_results_are_required_in_both_modes(self):
        for missing in [False, True]:
            runner.validate_evidence(evidence(missing), missing)

    def test_aspect_state_and_fullscreen_suspension_cannot_be_omitted_or_faked(self):
        mutations = [lambda r: r.pop("aspect"),
                     lambda r: r["aspect"]["set_sequence"].pop(),
                     lambda r: r["aspect"]["set_geometry"][0].update(rect=[0, 0, 800, 450]),
                     lambda r: r["aspect"]["initial"].update(supported=False),
                     lambda r: r["aspect"]["initial"].update(enabled=0),
                     lambda r: r["aspect"]["fullscreen_sequence"][0].update(active=True),
                     lambda r: r["aspect"]["fullscreen_sequence"][0].update(enabled=False)]
        for mutate in mutations:
            report = evidence()
            mutate(report)
            with self.assertRaises(RuntimeError):
                runner.validate_evidence(report, False)

    def test_sizing_receipt_requires_real_bounds_all_edges_and_disabled_passthrough(self):
        mutations = [lambda r: r.update(os_bounds_captures=0),
                     lambda r: r.update(outer_limits=[0, 0, 2147483647, 2147483647]),
                     lambda r: r["samples"].pop(),
                     lambda r: r["samples"][0].update(output=[0, 0, 843, 527]),
                     lambda r: r["samples"][0].update(output=[44, 38, 844, 488])]
        for mutate in mutations:
            report = sizing_evidence(True)
            mutate(report)
            with self.assertRaises(RuntimeError):
                runner.validate_sizing_probe(report, True)
        report = sizing_evidence(False)
        report["samples"][0]["output"][2] += 1
        with self.assertRaises(RuntimeError):
            runner.validate_sizing_probe(report, False)

    def test_transport_timeout_is_not_an_acl_success(self):
        report = evidence(True)
        report["denials"][0]["error"] = "IPC deadline"
        with self.assertRaises(RuntimeError):
            runner.validate_evidence(report, True)

    def test_missing_phases_wrong_native_bits_and_cleanup_failures_fail(self):
        for mutate in [lambda r: r.update(aux_unchanged=False),
                       lambda r: r.update(cleanup_errors=["destroy failed"]),
                       lambda r: r["topmost_sequence"].pop(),
                       lambda r: r["fullscreen_sequence"][0].update(win32_topmost=True),
                       lambda r: r["final"].update(fullscreen=True),
                       lambda r: r.update(status="fail")]:
            report = evidence()
            mutate(report)
            with self.assertRaises(RuntimeError):
                runner.validate_evidence(report, False)

    def test_denied_command_set_cannot_be_shortened(self):
        report = evidence(True)
        report["denials"].pop()
        with self.assertRaises(RuntimeError):
            runner.validate_evidence(report, True)

    def test_only_owned_process_tree_is_terminated_on_timeout(self):
        class Process:
            pid = 45678
            done = False
            def poll(self):
                return -9 if self.done else None
            def wait(self, timeout):
                self.done = True
                return -9
        process = Process()
        with patch.object(runner.subprocess, "run") as kill:
            runner.stop_owned_process(process)
            self.assertEqual(kill.call_args.args[0], ["taskkill.exe", "/PID", "45678", "/T", "/F"])
            runner.stop_owned_process(process)
            self.assertEqual(kill.call_count, 1)

    def test_success_preserves_report_and_removes_only_private_data(self):
        captured = []
        class Process:
            pid = 45679
            def __init__(self, command, **kwargs):
                directory = Path(command[1]); captured.append(directory)
                (directory / "result.json").write_text(json.dumps(evidence(True)))
            def wait(self, timeout):
                return 0
            def poll(self):
                return 0
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            sentinel = output / "keep.txt"; sentinel.write_text("keep")
            with patch.object(runner.subprocess, "Popen", Process), patch.object(runner.subprocess, "run") as kill:
                result = runner.run_case(Path("fixture.exe"), output, True)
            self.assertEqual(result["status"], "pass")
            self.assertTrue(result["private_data_removed"])
            self.assertFalse(captured[0].exists())
            self.assertEqual(sentinel.read_text(), "keep")
            self.assertTrue((output / "missing-permission.json").exists())
            kill.assert_not_called()

    def test_preferences_are_isolated_from_inherited_user_paths(self):
        captured = []
        class Process:
            pid = 45681
            def __init__(self, command, **kwargs):
                directory = Path(command[1])
                environment = kwargs["env"]
                captured.append((directory, environment))
                (directory / "result.json").write_text(json.dumps(evidence(True)))
            def wait(self, timeout):
                return 0
            def poll(self):
                return 0
        with tempfile.TemporaryDirectory() as output:
            with patch.dict(runner.os.environ, {"OTTPLAY_DATA_DIR": "outside-user-data", "OTTPLAY_INSTANCE": "outside-instance"}):
                with patch.object(runner.subprocess, "Popen", Process):
                    result = runner.run_case(Path("fixture.exe"), Path(output), True)
                self.assertEqual(runner.os.environ["OTTPLAY_DATA_DIR"], "outside-user-data")
                self.assertEqual(runner.os.environ["OTTPLAY_INSTANCE"], "outside-instance")
            self.assertEqual(result["status"], "pass")
            directory, environment = captured[0]
            self.assertEqual(Path(environment["OTTPLAY_DATA_DIR"]), directory / "preferences")
            self.assertNotIn("OTTPLAY_INSTANCE", environment)
            self.assertFalse(directory.exists())

    def test_external_deadline_is_failure_and_cleans_private_directory(self):
        captured = []
        class Process:
            pid = 45680
            done = False
            def __init__(self, command, **kwargs):
                captured.append(Path(command[1]))
            def wait(self, timeout):
                if timeout == runner.WINDOWS_PROCESS_TIMEOUT_SECONDS:
                    raise subprocess.TimeoutExpired("fixture.exe", timeout)
                self.done = True
                return -9
            def poll(self):
                return -9 if self.done else None
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(runner.subprocess, "Popen", Process), patch.object(runner.subprocess, "run") as kill:
                result = runner.run_case(Path("fixture.exe"), Path(directory), False)
            self.assertEqual(result["status"], "fail")
            self.assertTrue(result["private_data_removed"])
            self.assertFalse(captured[0].exists())
            self.assertEqual(kill.call_args.args[0], ["taskkill.exe", "/PID", "45680", "/T", "/F"])

    def test_watchdog_marker_overrides_a_pass_report_and_survives_private_cleanup(self):
        for marker in [json.dumps({"status": "fail", "phase": "exit-requested"}), "incomplete-json"]:
            with self.subTest(marker=marker), tempfile.TemporaryDirectory() as directory:
                captured = []
                class Process:
                    pid = 45683
                    def __init__(self, command, **kwargs):
                        private = Path(command[1])
                        captured.append(private)
                        (private / "result.json").write_text(json.dumps(evidence(True)))
                        (private / "watchdog.json").write_text(marker)
                    def wait(self, timeout):
                        return 0
                    def poll(self):
                        return 0
                with patch.object(runner.subprocess, "Popen", Process):
                    result = runner.run_case(Path("fixture.exe"), Path(directory), True)
                self.assertEqual(result["status"], "fail")
                self.assertEqual(result["native"]["status"], "pass")
                if marker != "incomplete-json":
                    self.assertEqual(result["watchdog"]["phase"], "exit-requested")
                else:
                    self.assertIn("watchdog_error", result)
                self.assertFalse(captured[0].exists())
                saved = json.loads((Path(directory) / "missing-permission.json").read_text())
                self.assertEqual(saved, result)

    def test_outer_deadline_retains_native_phase_and_log_evidence(self):
        captured = []
        class Process:
            pid = 45684
            done = False
            def __init__(self, command, **kwargs):
                private = Path(command[1])
                captured.append(private)
                (private / "result.json").write_text(json.dumps({"status": "fail", "phase": "building-main"}))
                kwargs["stdout"].write('WINDOW_CONTROLS_TRACE {"event":"window-build-start"}\n')
            def wait(self, timeout):
                if timeout == runner.WINDOWS_PROCESS_TIMEOUT_SECONDS:
                    raise subprocess.TimeoutExpired("fixture.exe", timeout)
                self.done = True
                return -9
            def poll(self):
                return -9 if self.done else None
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            with patch.object(runner.subprocess, "Popen", Process), patch.object(runner.subprocess, "run") as kill:
                result = runner.run_case(Path("fixture.exe"), output, True)
            self.assertEqual(runner.WINDOWS_PROCESS_TIMEOUT_SECONDS, 100)
            self.assertEqual(result["status"], "fail")
            self.assertEqual(result["native"]["phase"], "building-main")
            self.assertIn("window-build-start", (output / "missing-permission.log").read_text())
            self.assertFalse(captured[0].exists())
            self.assertEqual(kill.call_args.args[0], ["taskkill.exe", "/PID", "45684", "/T", "/F"])

    def test_windows_extended_parent_budget_does_not_change_other_platforms(self):
        for platform, expected in [("windows", 100), ("macos", 40), ("linux", 40)]:
            waits = []
            class Process:
                pid = 45685
                def __init__(self, command, **kwargs):
                    # No native report: this test covers only actual runner timeout dispatch.
                    pass
                def wait(self, timeout):
                    waits.append(timeout)
                    return 1
                def poll(self):
                    return 1
            with self.subTest(platform=platform), tempfile.TemporaryDirectory() as directory:
                with patch.object(runner.subprocess, "Popen", Process):
                    result = runner.run_case(Path("fixture"), Path(directory), True, platform=platform)
                self.assertEqual(waits, [expected])
                self.assertEqual(result["status"], "fail")
                self.assertTrue(result["private_data_removed"])

    def test_spawn_failure_is_recorded_without_termination(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(runner.subprocess, "Popen", side_effect=OSError("cannot start")), patch.object(runner.subprocess, "run") as kill:
                result = runner.run_case(Path("fixture.exe"), Path(directory), False)
            self.assertEqual(result["status"], "fail")
            self.assertTrue(result["private_data_removed"])
            kill.assert_not_called()


def restoration_evidence(phase, initial, final):
    def state(value):
        return {"topmost": value, "win32_topmost": value, "fullscreen": False}
    return {
        "status": "pass", "mode": "preference-restoration", "phase": phase,
        "owned_labels": ["main", "pip"], "cleanup_errors": [], "aux_unchanged": True,
        "initial": state(initial), "final": state(final),
        "aspect_initial": aspect_state(initial), "aspect_final": aspect_state(final),
        "aspect_sizing": sizing_evidence(final),
    }


def restoration_process(captured, *, wrong_initial=None, skip_write=None, timeout=None, skip_aspect_write=None):
    class Process:
        pid = 45682
        done = False

        def __init__(self, command, **kwargs):
            self.directory = Path(command[1])
            self.phase = command[3]
            self.preferences = Path(kwargs["env"]["OTTPLAY_DATA_DIR"])
            captured.append((self.directory, self.preferences, self.phase, kwargs["env"]))
            self.stored = self.preferences / "window-always-on-top"
            self.initial = self.stored.exists() and self.stored.read_bytes() == b"1\n"
            self.aspect_stored = self.preferences / "window-aspect-lock"
            self.aspect_initial = self.aspect_stored.exists() and self.aspect_stored.read_bytes() == b"1\n"

        def wait(self, timeout):
            if self.phase == timeout_phase and timeout == runner.WINDOWS_PROCESS_TIMEOUT_SECONDS:
                raise subprocess.TimeoutExpired("fixture.exe", timeout)
            self.done = True
            final = self.phase == "pin"
            if self.phase not in {"verify-off", skip_write}:
                self.stored.write_bytes(b"1\n" if final else b"0\n")
            if self.phase not in {"verify-off", skip_aspect_write}:
                self.aspect_stored.write_bytes(b"1\n" if final else b"0\n")
            initial = not self.initial if self.phase == wrong_initial else self.initial
            report = restoration_evidence(self.phase, initial, final)
            report["aspect_initial"] = aspect_state(self.aspect_initial)
            (self.directory / "result.json").write_text(json.dumps(report))
            return 0

        def poll(self):
            return 0 if self.done else None

    timeout_phase = timeout
    return Process


class RestorationTests(unittest.TestCase):
    def test_three_fresh_processes_share_only_owned_preferences_and_cleanup(self):
        captured = []
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            sentinel = output / "keep.txt"
            sentinel.write_text("keep")
            with patch.dict(runner.os.environ, {"OTTPLAY_DATA_DIR": "outside", "OTTPLAY_INSTANCE": "other"}):
                with patch.object(runner.subprocess, "Popen", restoration_process(captured)):
                    result = runner.run_restoration_sequence(Path("fixture.exe"), output)
                self.assertEqual(runner.os.environ["OTTPLAY_DATA_DIR"], "outside")
                self.assertEqual(runner.os.environ["OTTPLAY_INSTANCE"], "other")
            self.assertEqual(result["status"], "pass")
            self.assertTrue(result["preferences_removed"])
            self.assertEqual([item[2] for item in captured], ["pin", "unpin", "verify-off"])
            self.assertEqual(len({item[0] for item in captured}), 3)
            self.assertEqual(len({item[1] for item in captured}), 1)
            self.assertEqual([item["native"]["initial"]["win32_topmost"] for item in result["runs"]], [False, True, False])
            for webview, preferences, _, environment in captured:
                self.assertFalse(webview.exists())
                self.assertFalse(preferences.exists())
                self.assertNotIn("OTTPLAY_INSTANCE", environment)
            self.assertEqual(sentinel.read_text(), "keep")
            self.assertTrue((output / "restoration.json").is_file())

    def test_wrong_native_startup_state_stops_before_next_process(self):
        captured = []
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(runner.subprocess, "Popen", restoration_process(captured, wrong_initial="unpin")),
        ):
            result = runner.run_restoration_sequence(Path("fixture.exe"), Path(directory))
        self.assertEqual(result["status"], "fail")
        self.assertEqual(len(captured), 2)
        self.assertIn("Wrong restored initial native state", result["runs"][-1]["error"])
        self.assertTrue(result["preferences_removed"])

    def test_native_success_cannot_hide_missing_confirmed_saved_bytes(self):
        captured = []
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(runner.subprocess, "Popen", restoration_process(captured, skip_write="unpin")),
        ):
            result = runner.run_restoration_sequence(Path("fixture.exe"), Path(directory))
        self.assertEqual(result["status"], "fail")
        self.assertEqual(len(captured), 2)
        self.assertIn("preference bytes were not retained", result["runs"][-1]["error"])
        self.assertTrue(result["preferences_removed"])

    def test_native_success_cannot_hide_missing_saved_aspect_bytes(self):
        captured = []
        with (tempfile.TemporaryDirectory() as directory,
              patch.object(runner.subprocess, "Popen", restoration_process(captured, skip_aspect_write="unpin"))):
            result = runner.run_restoration_sequence(Path("fixture.exe"), Path(directory))
        self.assertEqual(result["status"], "fail")
        self.assertEqual(len(captured), 2)
        self.assertIn("aspect preference bytes were not retained", result["runs"][-1]["error"])
        self.assertTrue(result["preferences_removed"])

    def test_second_process_timeout_stops_and_removes_shared_preferences(self):
        captured = []
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(runner.subprocess, "Popen", restoration_process(captured, timeout="unpin")),
            patch.object(runner.subprocess, "run") as kill,
        ):
            result = runner.run_restoration_sequence(Path("fixture.exe"), Path(directory))
        self.assertEqual(result["status"], "fail")
        self.assertEqual(len(captured), 2)
        self.assertTrue(result["preferences_removed"])
        self.assertFalse(captured[0][1].exists())
        self.assertEqual(kill.call_count, 1)
        self.assertEqual(kill.call_args.args[0], ["taskkill.exe", "/PID", "45682", "/T", "/F"])

    def test_restoration_requires_both_native_bits_correct_phase_and_cleanup(self):
        mutations = [
            lambda report: report.update(phase="pin"),
            lambda report: report["initial"].update(win32_topmost=False),
            lambda report: report["final"].update(topmost=True),
            lambda report: report.update(aux_unchanged=False),
            lambda report: report.update(cleanup_errors=["failed"]),
        ]
        for mutate in mutations:
            report = restoration_evidence("unpin", True, False)
            mutate(report)
            with self.assertRaises(RuntimeError):
                runner.validate_restoration_evidence(report, "unpin")



def appkit_native(active=False, *, full=False, zoom=False):
    return {"label": "main", "window_number": 42, "level": 0,
            "frame": [0.0, 0.0, 1024.0, 768.0] if full else [40.0, 40.0, 640.0, 428.0],
            "screen_frame": [0.0, 0.0, 1024.0, 768.0],
            "style_mask": 0 if full else 13, "presentation_options": 5 if full else 0,
            "movable": not full, "content_size": [1024.0, 768.0] if full else [640.0, 400.0],
            "content_aspect": [16.0, 9.0] if active else [0.0, 0.0],
            "resize_increments": [1.0, 1.0], "fullscreen": False,
            "zoomed": full or zoom, "miniaturized": False}


def appkit_evidence(missing=False):
    commands = (["set_always_on_top", "set_fullscreen", "toggle_fullscreen"] if missing
                else ["set_always_on_top"]) + ["get_window_aspect_lock", "set_window_aspect_lock"]
    return {"status": "pass", "platform": "macos", "owned_labels": ["main", "pip"],
            "cleanup_errors": [], "mode": "missing-permission" if missing else "production-permissions",
            "denials": [{"command": command, "window": "main" if missing else "pip",
                        "error": "command not allowed"} for command in commands],
            "aux_unchanged": True, "baseline": appkit_native(), "initial": appkit_native(),
            "initial_state": aspect_state(), "final": appkit_native(), "final_state": aspect_state(),
            "set_sequence": [{"state": aspect_state(v), "native": appkit_native(v)}
                             for v in [True, True, False, False]],
            "transitions": [{"kind": kind, "target": target, "state": aspect_state(True, not target),
                             "native": appkit_native(not target,
                                                     full=kind != "zoom" and target,
                                                     zoom=kind == "zoom" and target)}
                            for kind in ["toggle_fullscreen", "set_fullscreen", "zoom"]
                            for target in [True, False]]}


def appkit_restoration(phase, initial):
    final = phase == "pin"
    return {"status": "pass", "platform": "macos", "owned_labels": ["main", "pip"],
            "cleanup_errors": [], "mode": "preference-restoration", "phase": phase,
            "aux_unchanged": True, "baseline": appkit_native(),
            "initial": appkit_native(initial), "initial_state": aspect_state(initial),
            "final": appkit_native(final), "final_state": aspect_state(final)}


class AppKitEvidenceTests(unittest.TestCase):
    def test_appkit_native_evidence_requires_all_states_and_original_constraint(self):
        for missing in [False, True]:
            runner.validate_evidence(appkit_evidence(missing), missing, platform="macos")
        mutations = [
            lambda r: r["set_sequence"].pop(),
            lambda r: r["set_sequence"][0]["native"].update(content_aspect=[0, 0]),
            lambda r: r["set_sequence"][0]["native"].update(frame=[40, 40, 800, 450]),
            lambda r: r["transitions"].pop(),
            lambda r: r["transitions"][0]["state"].update(active=True),
            lambda r: r["transitions"][0]["native"].update(fullscreen=True),
            lambda r: r["transitions"][4]["native"].update(zoomed=False),
            lambda r: r["final"].update(resize_increments=[2, 2]),
            lambda r: r["final"].update(window_number=43),
            lambda r: r["final"].update(fullscreen=0),
            lambda r: r["final"].update(content_aspect=[float("nan"), 0]),
            lambda r: r.update(aux_unchanged=False),
            lambda r: r.update(platform="windows"),
        ]
        for mutate in mutations:
            report = appkit_evidence()
            mutate(report)
            with self.assertRaises(RuntimeError):
                runner.validate_evidence(report, False, platform="macos")
        report = appkit_evidence(True)
        report["denials"][0]["error"] = "IPC deadline"
        with self.assertRaises(RuntimeError):
            runner.validate_evidence(report, True, platform="macos")

    def test_simple_fullscreen_requires_native_geometry_style_and_presentation(self):
        mutations = [
            lambda n: n.update(frame=[40, 40, 640, 400]),
            lambda n: n.update(content_size=[640, 400]),
            lambda n: n.update(style_mask=13),
            lambda n: n.update(style_mask=1 << 14),
            lambda n: n.update(movable=True),
            lambda n: n.update(presentation_options=0),
            lambda n: n.update(screen_frame=[0, 0, float("nan"), 768]),
        ]
        for mutate in mutations:
            report = appkit_evidence()
            mutate(report["transitions"][0]["native"])
            with self.subTest(mutate=mutate), self.assertRaises(RuntimeError):
                runner.validate_evidence(report, False, platform="macos")
        # A maximized screen-sized window with normal presentation is not proof
        # of simple fullscreen, even when its raw isZoomed property is true.
        report = appkit_evidence()
        report["transitions"][0]["native"].update(style_mask=13, movable=True, presentation_options=0)
        with self.assertRaises(RuntimeError):
            runner.validate_evidence(report, False, platform="macos")

    def test_simple_fullscreen_exit_and_zoom_preserve_native_window_policy(self):
        for index in [1, 3, 4, 5]:
            for change in [{"style_mask": 0}, {"movable": False}, {"presentation_options": 5}]:
                report = appkit_evidence()
                report["transitions"][index]["native"].update(change)
                with self.subTest(index=index, change=change), self.assertRaises(RuntimeError):
                    runner.validate_evidence(report, False, platform="macos")
        report = appkit_evidence()
        report["final"].update(presentation_options=5)
        with self.assertRaises(RuntimeError):
            runner.validate_evidence(report, False, platform="macos")

    def test_appkit_restoration_is_fresh_native_evidence_not_a_requested_value(self):
        for phase in ["pin", "unpin", "verify-off"]:
            report = appkit_restoration(phase, phase == "unpin")
            runner.validate_restoration_evidence(report, phase, platform="macos")
            report["initial"]["content_aspect"] = [99, 1]
            with self.assertRaises(RuntimeError):
                runner.validate_restoration_evidence(report, phase, platform="macos")

    def test_appkit_processes_use_private_sessions_and_actual_saved_bytes(self):
        for skip_write in [None, "unpin"]:
            captured = []
            class Process:
                pid = 45683
                done = False
                def __init__(self, command, **kwargs):
                    self.directory = Path(command[1])
                    self.phase = command[3]
                    self.preferences = Path(kwargs["env"]["OTTPLAY_DATA_DIR"])
                    self.stored = self.preferences / "window-aspect-lock"
                    self.initial = self.stored.exists() and self.stored.read_bytes() == b"1\n"
                    captured.append((self.directory, self.preferences, self.phase, kwargs))
                def wait(self, timeout):
                    self.done = True
                    if self.phase not in {"verify-off", skip_write}:
                        self.stored.write_bytes(b"1\n" if self.phase == "pin" else b"0\n")
                    (self.directory / "result.json").write_text(
                        json.dumps(appkit_restoration(self.phase, self.initial)))
                    return 0
                def poll(self):
                    return 0 if self.done else None
            with tempfile.TemporaryDirectory() as directory:
                with patch.object(runner.subprocess, "Popen", Process):
                    result = runner.run_restoration_sequence(Path("fixture"), Path(directory), platform="macos")
                self.assertEqual(result["status"], "pass" if skip_write is None else "fail")
                if skip_write:
                    self.assertIn("aspect preference bytes were not retained", result["runs"][-1]["error"])
                self.assertTrue(result["preferences_removed"])
                self.assertEqual(len(captured), 3 if skip_write is None else 2)
                self.assertEqual(len({item[1] for item in captured}), 1)
                for data, preferences, phase, kwargs in captured:
                    self.assertTrue(kwargs["start_new_session"])
                    self.assertNotIn("OTTPLAY_INSTANCE", kwargs["env"])
                    self.assertFalse(data.exists())
                    self.assertFalse(preferences.exists())

    def test_appkit_deadline_signals_only_the_owned_process_group(self):
        class Process:
            pid = 45684
            waits = 0
            done = False
            def poll(self):
                return 0 if self.done else None
            def wait(self, timeout):
                self.waits += 1
                if self.waits == 1:
                    raise subprocess.TimeoutExpired("fixture", timeout)
                self.done = True
                return -9
        process = Process()
        with (patch.object(runner.os, "killpg", create=True) as kill,
              patch.object(runner.signal, "SIGKILL", 9, create=True),
              patch.object(runner.subprocess, "run") as windows_kill):
            runner.stop_owned_process(process, platform="macos")
            runner.stop_owned_process(process, platform="macos")
            self.assertEqual(kill.call_args_list,
                             [unittest.mock.call(45684, runner.signal.SIGTERM),
                              unittest.mock.call(45684, 9)])
            windows_kill.assert_not_called()


if __name__ == "__main__":
    unittest.main()
