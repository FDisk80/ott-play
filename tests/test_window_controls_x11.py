#!/usr/bin/env python3
"""Exercise strict Linux evidence validation without a display or native process."""
import importlib.util
import json
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("window_controls_x11", ROOT / "scripts/check-window-controls.py")
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


def state(enabled=True, active=None):
    return {"ok": True, "supported": True, "enabled": enabled,
            "active": enabled if active is None else active}


def native(active=True, fullscreen=False, maximized=False, rect=None):
    return {"label": "main", "xid": 42, "pid": 123,
            "rect": list(rect or [40, 40, 640, 360]),
            "hints": 48 | (128 if active else 0), "min_size": [320, 180],
            "max_size": [1600, 1000], "min_aspect": [16, 9] if active else [0, 0],
            "max_aspect": [16, 9] if active else [0, 0], "fullscreen": fullscreen,
            "non_aspect_hints": [48, 0, 0, 0, 0, 320, 180, 1600, 1000, 0, 0, 0, 0, 0],
            "maximized": maximized, "above": False, "wm_present": True}


def drag_probe(enabled):
    samples = []
    for edge in range(1, 9):
        horizontal = edge in (1, 2, 4, 5, 7, 8)
        vertical = edge in (3, 4, 5, 6, 7, 8)
        width, height = (544, 306) if enabled else (544 if horizontal else 640,
                                                 299 if vertical else 360)
        left = 680 - width if edge in (1, 4, 7) else 40
        top = 400 - height if edge in (3, 4, 5) else 40
        x = 40 if edge in (1, 4, 7) else (679 if edge in (2, 5, 8) else 360)
        y = 40 if edge in (3, 4, 5) else (399 if edge in (6, 7, 8) else 220)
        dx = 96 if edge in (1, 4, 7) else (-96 if edge in (2, 5, 8) else 0)
        dy = 61 if edge in (3, 4, 5) else (-61 if edge in (6, 7, 8) else 0)
        samples.append({"edge": edge, "before": native(enabled),
                        "after": native(enabled, rect=[left, top, width, height]),
                        "input_start": [x, y], "input_end": [x + dx, y + dy]})
    return {"kind": "owned-x11-xtest-edge-drag", "enabled": enabled, "samples": samples}


def pending_resize(kind):
    initially_on = kind in ("control", "warm-off", "rapid-off-on")
    final_on = kind in ("control", "rapid-off-on")
    initial = [40, 40, 640, 400 if kind == "cold-off" else 360]
    layout = [960, 540] if final_on else [800, 500]
    return {"kind": kind, "request": [800, 450],
            "before": native(initially_on, rect=initial), "queued": native(initially_on, rect=initial),
            "queued_callbacks": 0, "during_off_callbacks": 0,
            "off_state": None if kind == "control" else [False, False],
            "immediate": native(kind == "control", rect=initial),
            "after_on": native(True, rect=[40, 40, 800, 450]) if kind == "rapid-off-on" else None,
            "settled": native(final_on, rect=[40, 40, 800, 450]), "layout_request": layout,
            "after_layout": native(final_on, rect=[40, 40] + layout)}


def evidence(missing=False):
    commands = ["set_always_on_top", "set_fullscreen", "toggle_fullscreen",
                "get_window_aspect_lock", "set_window_aspect_lock"]
    report = {"status": "pass", "platform": "linux-x11", "owned_labels": ["main", "pip"],
              "cleanup_errors": [], "mode": "missing-permission" if missing else "production-permissions",
              "denials": [{"window": "main" if missing else "pip", "command": name,
                           "error": "command not allowed"} for name in commands],
              "requested_content": [640, 400], "baseline": native()}
    if not missing:
        tight = native(); tight["min_size"] = [400, 225]; tight["max_size"] = [1280, 720]
        report.update({"aux_unchanged": True, "initial_state": state(),
                       "manual_enable": {"before": native(False, rect=[40, 40, 640, 400]),
                                         "after": native(), "state": state()},
                       "set_sequence": [{"requested": on, "state": state(on), "native": native(on)}
                                        for on in (True, True, False, False)],
                       "transitions": [{"kind": kind, "target": target, "state": state(True, not target),
                                        "native": native(not target, kind != "maximize" and target,
                                                         kind == "maximize" and target)}
                                       for kind in ("toggle_fullscreen", "set_fullscreen", "maximize")
                                       for target in (True, False)],
                       "bounds_updates": [tight, native()],
                       "sizing_enabled": drag_probe(True), "sizing_disabled": drag_probe(False),
                       "pending_resizes": [pending_resize(kind) for kind in
                                           ("control", "warm-off", "repeat-off", "rapid-off-on")],
                       "final": native(False), "final_state": state(False)})
    return report


def restoration(phase):
    active = phase in ("pin", "unpin")
    rect = [40, 40, 640, 360 if active else 400]
    report = {"status": "pass", "platform": "linux-x11", "owned_labels": ["main", "pip"],
              "cleanup_errors": [], "mode": "preference-restoration", "phase": phase,
              "requested_content": [640, 400], "aux_unchanged": True,
              "initial": native(active, rect=rect),
              "initial_state": state(active),
              "first_set": None if phase == "verify-off" else state(phase == "pin"),
              "final": native(phase == "pin", rect=rect), "final_state": state(phase == "pin")}
    if phase == "cold-off":
        report.update({"initial_state": None, "first_command": "set_window_aspect_lock",
                       "first_set": state(False), "startup_initialization_skipped": True})
    if phase == "cold-pending-off":
        report.update({"initial_state": None, "first_command": "set_window_aspect_lock",
                       "first_native_aspect_call": "OFF", "startup_initialization_skipped": True,
                       "pending_resize": pending_resize("cold-off"),
                       "final": native(False, rect=[40, 40, 800, 500])})
    return report


class X11WindowEvidenceTests(unittest.TestCase):
    def test_raw_non_aspect_hint_words_preserve_inactive_and_unknown_values(self):
        for length in (11, 14):
            row = pending_resize("warm-off")
            for step in ("before", "queued", "immediate"):
                row[step]["non_aspect_hints"] = row[step]["non_aspect_hints"][:length]
                row[step]["non_aspect_hints"][0] |= 1 << 30
                row[step]["non_aspect_hints"][1] = 0xffffffff
            runner.validate_x11_pending_resize(row, "warm-off", native())
            for index, value in ((0, 48), (1, 0), (1, 1 << 32)):
                changed = json.loads(json.dumps(row))
                changed["immediate"]["non_aspect_hints"][index] = value
                with self.subTest(length=length, index=index, value=value), self.assertRaises(RuntimeError):
                    runner.validate_x11_pending_resize(changed, "warm-off", native())

    def test_pending_off_requires_unflushed_callback_and_native_invariants(self):
        for index in range(4):
            for key, value in (("queued_callbacks", 1), ("during_off_callbacks", 1),
                               ("during_off_callbacks", False), ("request", [640, 360])):
                report = evidence(); report["pending_resizes"][index][key] = value
                with self.subTest(index=index, key=key), self.assertRaises(RuntimeError):
                    runner.validate_evidence(report, False, platform="linux")
        for index in (1, 2):
            for step, key, value in (("queued", "rect", [40, 40, 800, 450]),
                                      ("immediate", "rect", [40, 40, 800, 450]),
                                      ("immediate", "hints", 176),
                                      ("immediate", "min_size", [300, 180]),
                                      ("immediate", "non_aspect_hints", [0] * 14),
                                      ("immediate", "xid", 43),
                                      ("settled", "rect", [40, 40, 640, 360]),
                                      ("after_layout", "hints", 176)):
                report = evidence(); report["pending_resizes"][index][step][key] = value
                with self.subTest(index=index, step=step, key=key), self.assertRaises(RuntimeError):
                    runner.validate_evidence(report, False, platform="linux")

    def test_pending_resize_requires_matched_control_and_rapid_on_hint_survival(self):
        report = evidence(); report["pending_resizes"].pop()
        with self.assertRaises(RuntimeError): runner.validate_evidence(report, False, platform="linux")
        report = evidence(); report["pending_resizes"][0]["before"]["non_aspect_hints"][13] = 1
        with self.assertRaises(RuntimeError): runner.validate_evidence(report, False, platform="linux")
        for step in ("after_on", "settled", "after_layout"):
            report = evidence(); report["pending_resizes"][3][step]["hints"] = 48
            with self.subTest(step=step), self.assertRaises(RuntimeError):
                runner.validate_evidence(report, False, platform="linux")

    def test_cold_pending_off_has_its_own_uninitialized_native_boundary(self):
        runner.validate_restoration_evidence(restoration("cold-pending-off"), "cold-pending-off", platform="linux")
        for key, value in (("startup_initialization_skipped", False), ("initial_state", state()),
                           ("first_native_aspect_call", "GET"), ("first_set", state(True))):
            report = restoration("cold-pending-off"); report[key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                runner.validate_restoration_evidence(report, "cold-pending-off", platform="linux")
        for key, value in (("during_off_callbacks", 1), ("off_state", [True, True]), ("off_state", [0, 0])):
            report = restoration("cold-pending-off"); report["pending_resize"][key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                runner.validate_restoration_evidence(report, "cold-pending-off", platform="linux")

    def test_cold_pending_off_uses_separate_owned_preference_directory(self):
        observed = []
        def run_case(binary, output, missing, *, phase, preferences, platform):
            observed.append((phase, preferences))
            self.assertTrue(preferences.is_dir())
            return {"status": "pass"}
        with tempfile.TemporaryDirectory() as tmp, patch.object(runner, "run_case", run_case):
            result = runner.run_restoration_sequence(Path("fixture"), Path(tmp), platform="linux")
        self.assertEqual(result["status"], "pass", result)
        self.assertEqual([phase for phase, _ in observed],
                         ["pin", "unpin", "verify-off", "cold-off", "cold-pending-off"])
        self.assertEqual(len({directory for _, directory in observed[:4]}), 1)
        self.assertNotEqual(observed[3][1], observed[4][1])
        self.assertTrue(result["preferences_removed"])

    def test_complete_native_acl_drag_bounds_and_preference_evidence(self):
        for missing in (True, False):
            runner.validate_evidence(evidence(missing), missing, platform="linux")
        for phase in ("pin", "unpin", "verify-off", "cold-off"):
            runner.validate_restoration_evidence(restoration(phase), phase, platform="linux")

    def test_normalization_is_allowed_only_when_active_and_ratio_is_real(self):
        report = evidence(); report["manual_enable"]["after"]["rect"] = [40, 40, 704, 396]
        runner.validate_evidence(report, False, platform="linux")
        report = evidence(); report["baseline"]["rect"][3] = 400
        with self.assertRaises(RuntimeError): runner.validate_evidence(report, False, platform="linux")
        report = evidence(); report["manual_enable"]["after"]["rect"][3] = 400
        with self.assertRaises(RuntimeError): runner.validate_evidence(report, False, platform="linux")
        for index in (1, 2, 3):
            report = evidence(); report["set_sequence"][index]["native"]["rect"][0] += 10
            with self.assertRaises(RuntimeError): runner.validate_evidence(report, False, platform="linux")
        for phase in ("verify-off", "cold-off"):
            report = restoration(phase); report["initial"]["rect"][3] = 360
            with self.assertRaises(RuntimeError): runner.validate_restoration_evidence(report, phase, platform="linux")

    def test_lost_bounds_wrong_hint_wrong_ratio_and_live_update_are_rejected(self):
        for key, value in (("hints", 128), ("min_size", [1, 1]), ("max_size", [999, 999]),
                           ("hints", 48), ("min_aspect", [4, 3])):
            report = evidence(); report["set_sequence"][0]["native"][key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                runner.validate_evidence(report, False, platform="linux")
        for index, key, value in ((0, "hints", 48), (0, "min_size", [320, 180]),
                                  (1, "max_size", [1280, 720])):
            report = evidence(); report["bounds_updates"][index][key] = value
            with self.assertRaises(RuntimeError): runner.validate_evidence(report, False, platform="linux")
        report = evidence(); report["final"]["hints"] |= 128
        with self.assertRaises(RuntimeError): runner.validate_evidence(report, False, platform="linux")

    def test_foreign_identity_missing_wm_changed_pip_and_wrong_backend_refuse(self):
        for key, value in (("xid", 99), ("pid", 999), ("wm_present", False)):
            report = evidence(); report["set_sequence"][0]["native"][key] = value
            with self.assertRaises(RuntimeError): runner.validate_evidence(report, False, platform="linux")
        for key, value in (("aux_unchanged", False), ("platform", "wayland")):
            report = evidence(); report[key] = value
            with self.assertRaises(RuntimeError): runner.validate_evidence(report, False, platform="linux")

    def test_missing_transition_stale_active_hint_and_failed_restore_refuse(self):
        cases = []
        report = evidence(); report["transitions"].pop(); cases.append(report)
        for index, key, value in ((0, "hints", 176), (0, "fullscreen", False),
                                  (4, "maximized", False), (5, "rect", [40, 40, 800, 450])):
            report = evidence(); report["transitions"][index]["native"][key] = value; cases.append(report)
        for report in cases:
            with self.assertRaises(RuntimeError): runner.validate_evidence(report, False, platform="linux")

    def test_all_eight_actual_drag_movements_and_anchors_are_required(self):
        report = evidence(); report["sizing_enabled"]["samples"].pop()
        with self.assertRaises(RuntimeError): runner.validate_evidence(report, False, platform="linux")
        for probe in ("sizing_enabled", "sizing_disabled"):
            for key, value in (("after", native(probe == "sizing_enabled")),
                               ("input_end", [40, 220])):
                report = evidence(); report[probe]["samples"][0][key] = value
                with self.assertRaises(RuntimeError): runner.validate_evidence(report, False, platform="linux")
        report = evidence(); report["sizing_enabled"]["samples"][0]["after"]["rect"][0] += 10
        with self.assertRaises(RuntimeError): runner.validate_evidence(report, False, platform="linux")
        report = evidence(); report["sizing_enabled"]["samples"][0]["after"]["rect"][2] = 2000
        with self.assertRaises(RuntimeError): runner.validate_evidence(report, False, platform="linux")
        for index, key, value in ((0, "input_start", [679, 220]),
                                  (3, "input_start", [40, 220]),
                                  (0, "after", native(False, rect=[136, 40, 544, 299])),
                                  (2, "after", native(False, rect=[40, 101, 544, 299])),
                                  (3, "after", native(False, rect=[40, 101, 640, 299])),
                                  (0, "after", native(False, rect=[0, 40, 680, 360]))):
            report = evidence(); report["sizing_disabled"]["samples"][index][key] = value
            with self.subTest(index=index, key=key), self.assertRaises(RuntimeError):
                runner.validate_evidence(report, False, platform="linux")

    def test_cold_off_must_precede_get_and_leave_initial_geometry_unchanged(self):
        for key, value in (("first_command", "get_window_aspect_lock"), ("initial_state", state()),
                           ("startup_initialization_skipped", False), ("first_set", state(True))):
            report = restoration("cold-off"); report[key] = value
            with self.assertRaises(RuntimeError): runner.validate_restoration_evidence(report, "cold-off", platform="linux")
        report = restoration("cold-off"); report["final"]["rect"][3] = 360
        with self.assertRaises(RuntimeError): runner.validate_restoration_evidence(report, "cold-off", platform="linux")

    def test_saved_on_needs_constraint_and_acl_errors_must_not_be_transport_failures(self):
        for phase in ("pin", "unpin", "verify-off"):
            report = restoration(phase); report["first_set"] = state(phase != "pin")
            with self.subTest(phase=phase), self.assertRaises(RuntimeError):
                runner.validate_restoration_evidence(report, phase, platform="linux")
        report = restoration("unpin"); report["initial"]["hints"] = 48
        with self.assertRaises(RuntimeError): runner.validate_restoration_evidence(report, "unpin", platform="linux")
        report = evidence(True); report["denials"][0]["error"] = "IPC timed out"
        with self.assertRaises(RuntimeError): runner.validate_evidence(report, True, platform="linux")
        report = evidence(); report["denials"].pop()
        with self.assertRaises(RuntimeError): runner.validate_evidence(report, False, platform="linux")

    def test_unsupported_cannot_be_reported_as_working_supported_x11(self):
        unsupported = {"ok": True, "supported": False, "enabled": False, "active": False}
        runner.validate_unsupported_aspect_state(unsupported)
        runner.validate_unsupported_aspect_rejection({"ok": False, "error": "Native aspect constraint is unavailable on this backend"})
        for value in ({"ok": True}, {"ok": False, "error": "IPC deadline"},
                      {"ok": False, "error": "command not allowed"}, None):
            with self.assertRaises(RuntimeError): runner.validate_unsupported_aspect_rejection(value)
        for value in (unsupported, {"ok": True, "supported": True, "enabled": 1, "active": True}):
            report = evidence(); report["initial_state"] = value
            with self.assertRaises(RuntimeError): runner.validate_evidence(report, False, platform="linux")

    def test_sequential_preferences_and_cold_off_seed_are_verified(self):
        for phase in ("pin", "unpin", "verify-off", "cold-off", "cold-pending-off"):
            for corrupt in (False, True):
                observed = []
                class Process:
                    pid = 45687
                    def __init__(self, command, **kwargs):
                        stored = Path(kwargs["env"]["OTTPLAY_DATA_DIR"]) / "window-aspect-lock"
                        observed.append(stored.read_bytes() if stored.exists() else None)
                        target = b"1\n" if phase == "pin" else b"0\n"
                        stored.write_bytes((b"0\n" if target == b"1\n" else b"1\n") if corrupt else target)
                        (Path(command[1]) / "result.json").write_text(json.dumps(restoration(phase)))
                    def wait(self, timeout): return 0
                    def poll(self): return 0
                with self.subTest(phase=phase, corrupt=corrupt), tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp); private = root / "preferences"; private.mkdir()
                    if phase != "pin":
                        (private / "window-aspect-lock").write_bytes(b"1\n" if phase == "unpin" else b"0\n")
                    with patch.object(runner.subprocess, "Popen", Process):
                        result = runner.run_case(Path("fixture"), root, False, phase=phase,
                                                 preferences=private, platform="linux")
                    expected_initial = None if phase == "pin" else (b"0\n" if phase == "verify-off" else b"1\n")
                    self.assertEqual(observed, [expected_initial])
                    self.assertEqual(result["status"], "fail" if corrupt else "pass", result)
                    if not corrupt: self.assertEqual(result["saved_aspect_preference"], phase == "pin")

    def test_denial_cannot_create_preference_and_success_must_persist_off(self):
        for missing, create in ((True, False), (True, True), (False, False), (False, True)):
            class Process:
                pid = 45688
                def __init__(self, command, **kwargs):
                    if create:
                        private = Path(kwargs["env"]["OTTPLAY_DATA_DIR"]); private.mkdir()
                        (private / "window-aspect-lock").write_bytes(b"0\n")
                    (Path(command[1]) / "result.json").write_text(json.dumps(evidence(missing)))
                def wait(self, timeout): return 0
                def poll(self): return 0
            with self.subTest(missing=missing, create=create), tempfile.TemporaryDirectory() as tmp:
                with patch.object(runner.subprocess, "Popen", Process):
                    result = runner.run_case(Path("fixture"), Path(tmp), missing, platform="linux")
                self.assertEqual(result["status"], "pass" if create != missing else "fail", result)


if __name__ == "__main__":
    unittest.main()
