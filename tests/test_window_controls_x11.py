#!/usr/bin/env python3
"""Validate X11 evidence contracts without opening a display or starting native code."""
import copy
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


def state():
    return {"ok": True, "supported": False, "enabled": False, "active": False}


def rejection():
    return {"ok": False, "error": "Native aspect constraint is unavailable on this backend"}


def native(active=False, fullscreen=False, maximized=False):
    return {"label": "main", "xid": 42, "pid": 123, "rect": [40, 40, 640, 400],
            "hints": 48 | (128 if active else 0), "min_size": [320, 180],
            "max_size": [1600, 1000], "min_aspect": [16, 9] if active else [0, 0],
            "max_aspect": [16, 9] if active else [0, 0], "fullscreen": fullscreen,
            "maximized": maximized, "above": False, "wm_present": True}


def evidence(missing=False):
    commands = (["set_always_on_top", "set_fullscreen", "toggle_fullscreen"] if missing
                else ["set_always_on_top"]) + ["get_window_aspect_lock", "set_window_aspect_lock"]
    report = {"status": "pass", "platform": "linux-x11", "owned_labels": ["main", "pip"],
              "cleanup_errors": [], "mode": "missing-permission" if missing else "production-permissions",
              "denials": [{"window": "main" if missing else "pip", "command": name,
                           "error": "command not allowed"} for name in commands],
              "requested_content": [640, 400], "baseline": native()}
    if not missing:
        report.update({"aux_unchanged": True, "initial_state": state(),
                       "set_sequence": [{"requested": on, "rejection": rejection(),
                                         "state": state(), "native": native()}
                                        for on in (True, True, False, False)],
                       "transitions": [{"kind": kind, "target": target,
                                        "state": state(),
                                        "native": native(False, kind != "maximize" and target,
                                                         kind == "maximize" and target)}
                                       for kind in ("toggle_fullscreen", "set_fullscreen", "maximize")
                                       for target in (True, False)],
                       "final": native(), "final_state": state()})
    return report


def restoration(phase):
    return {"status": "pass", "platform": "linux-x11", "owned_labels": ["main", "pip"],
            "cleanup_errors": [], "mode": "preference-restoration", "phase": phase,
            "requested_content": [640, 400], "aux_unchanged": True,
            "initial": native(), "initial_state": state(),
            "final": native(), "final_state": state(),
            "set_rejection": None if phase == "verify-off" else rejection()}


class X11WindowEvidenceTests(unittest.TestCase):
    def test_complete_native_acl_and_preference_evidence(self):
        for missing in (True, False):
            runner.validate_evidence(evidence(missing), missing, platform="linux")
        for phase in ("pin", "unpin", "verify-off"):
            runner.validate_restoration_evidence(restoration(phase), phase, platform="linux")

    def test_initial_toggle_and_saved_on_geometry_jump_are_rejected(self):
        for key in ("baseline", "final"):
            report = evidence()
            report[key]["rect"][3] = 360
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                runner.validate_evidence(report, False, platform="linux")
        report = evidence()
        report["set_sequence"][0]["native"]["rect"][0] += 10
        with self.assertRaises(RuntimeError):
            runner.validate_evidence(report, False, platform="linux")
        report = restoration("unpin")
        report["initial"]["rect"][3] = 360
        with self.assertRaises(RuntimeError):
            runner.validate_restoration_evidence(report, "unpin", platform="linux")

    def test_lost_bounds_and_any_active_aspect_hint_are_rejected(self):
        for key, value in (("hints", 128), ("min_size", [1, 1]),
                           ("max_size", [999, 999]), ("hints", 176)):
            report = evidence()
            report["set_sequence"][0]["native"][key] = value
            with self.subTest(key=key, value=value), self.assertRaises(RuntimeError):
                runner.validate_evidence(report, False, platform="linux")
        report = evidence()
        report["final"]["hints"] |= 128
        with self.assertRaises(RuntimeError):
            runner.validate_evidence(report, False, platform="linux")

    def test_foreign_identity_missing_wm_changed_pip_and_wrong_backend_refuse(self):
        for key, value in (("xid", 99), ("pid", 999), ("wm_present", False)):
            report = evidence()
            report["set_sequence"][0]["native"][key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                runner.validate_evidence(report, False, platform="linux")
        for key, value in (("aux_unchanged", False), ("platform", "wayland")):
            report = evidence()
            report[key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                runner.validate_evidence(report, False, platform="linux")
        report = evidence()
        report["initial_state"]["supported"] = True
        with self.assertRaises(RuntimeError):
            runner.validate_evidence(report, False, platform="linux")

    def test_missing_or_unrestored_native_transition_is_rejected(self):
        base = evidence()
        cases = []
        report = copy.deepcopy(base)
        report["transitions"].pop()
        cases.append(report)
        for index, key, value in ((0, "hints", 176), (0, "fullscreen", False),
                                  (4, "maximized", False), (5, "rect", [40, 40, 800, 600])):
            report = copy.deepcopy(base)
            report["transitions"][index]["native"][key] = value
            cases.append(report)
        for report in cases:
            with self.subTest(report=report), self.assertRaises(RuntimeError):
                runner.validate_evidence(report, False, platform="linux")

    def test_saved_on_must_not_apply_native_hint_and_denial_requires_acl(self):
        report = restoration("unpin")
        report["initial"]["hints"] |= 128
        with self.assertRaises(RuntimeError):
            runner.validate_restoration_evidence(report, "unpin", platform="linux")
        report = evidence(True)
        report["denials"][0]["error"] = "IPC timed out"
        with self.assertRaises(RuntimeError):
            runner.validate_evidence(report, True, platform="linux")

    def test_unsupported_is_explicit_and_cannot_hide_transport_or_success(self):
        for value in ({"ok": True}, {"ok": False, "error": "IPC deadline"},
                      {"ok": False, "error": "command not allowed"}, None):
            report = evidence()
            report["set_sequence"][0]["rejection"] = value
            with self.subTest(value=value), self.assertRaises(RuntimeError):
                runner.validate_evidence(report, False, platform="linux")
        for key, value in (("supported", True), ("enabled", True), ("active", True),
                           ("supported", 0)):
            report = evidence()
            report["set_sequence"][0]["state"][key] = value
            with self.subTest(key=key, value=value), self.assertRaises(RuntimeError):
                runner.validate_evidence(report, False, platform="linux")
        report = evidence()
        report["set_sequence"][0]["requested"] = False
        with self.assertRaises(RuntimeError):
            runner.validate_evidence(report, False, platform="linux")

    def test_saved_preferences_are_seeded_before_start_and_retained_exactly(self):
        for phase in ("pin", "unpin", "verify-off"):
            expected = b"1\n" if phase == "unpin" else b"0\n"
            for corrupt in (False, True):
                observed = []
                class Process:
                    pid = 45687
                    def __init__(self, command, **kwargs):
                        private = Path(kwargs["env"]["OTTPLAY_DATA_DIR"])
                        stored = private / "window-aspect-lock"
                        observed.append(stored.read_bytes())
                        if corrupt:
                            stored.write_bytes(b"0\n" if phase == "unpin" else b"1\n")
                        (Path(command[1]) / "result.json").write_text(json.dumps(restoration(phase)))
                    def wait(self, timeout):
                        return 0
                    def poll(self):
                        return 0
                with self.subTest(phase=phase, corrupt=corrupt), tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp)
                    private = root / "preferences"
                    private.mkdir()
                    with patch.object(runner.subprocess, "Popen", Process):
                        result = runner.run_case(Path("fixture"), root, False, phase=phase,
                                                 preferences=private, platform="linux")
                    self.assertEqual(observed, [expected])
                    self.assertEqual(result["status"], "fail" if corrupt else "pass")
                    if not corrupt:
                        self.assertEqual((private / "window-aspect-lock").read_bytes(), expected)
                        self.assertEqual(result["seeded_aspect_preference"], phase == "unpin")
                        self.assertEqual(result["saved_aspect_preference"], phase == "unpin")
                    else:
                        self.assertIn("preference bytes", result["error"])

    def test_unsupported_mutation_cannot_create_new_preference(self):
        for create in (False, True):
            class Process:
                pid = 45688
                def __init__(self, command, **kwargs):
                    if create:
                        private = Path(kwargs["env"]["OTTPLAY_DATA_DIR"])
                        private.mkdir()
                        (private / "window-aspect-lock").write_bytes(b"0\n")
                    (Path(command[1]) / "result.json").write_text(json.dumps(evidence()))
                def wait(self, timeout):
                    return 0
                def poll(self):
                    return 0
            with self.subTest(create=create), tempfile.TemporaryDirectory() as tmp:
                with patch.object(runner.subprocess, "Popen", Process):
                    result = runner.run_case(Path("fixture"), Path(tmp), False, platform="linux")
                self.assertEqual(result["status"], "fail" if create else "pass")
                if create:
                    self.assertIn("created a saved preference", result["error"])


if __name__ == "__main__":
    unittest.main()
