"""Pure hosted-preflight contracts; no Cocoa, player or compiler is executed."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("desktop_preflight", ROOT / "scripts/ci-macos-desktop-preflight.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class DesktopPreflightContracts(unittest.TestCase):
    def test_only_explicit_manual_request_can_suppress_existing_native_jobs(self):
        workflow = (ROOT / ".github/workflows/native-parity.yml").read_text()
        guard = "if: \u0024{{ !(github.event_name == 'workflow_dispatch' && (inputs.desktop_preflight_only == true || inputs.desktop_acceptance == true)) }}"
        for job in ("shared-guide", "windows-installers", "android", "apple", "favorites-native"):
            self.assertIn("  " + job + ":\n    " + guard, workflow)
        self.assertIn("if: \u0024{{ github.event_name == 'workflow_dispatch' && inputs.desktop_preflight_only == true }}",
                      workflow)
        self.assertIn("type: boolean\n        default: false", workflow)

    def test_refused_or_incomplete_capability_is_not_success(self):
        for value in ({}, {"schema": 1, "action": "preflight", "status": "refused"},
                      {"schema": 1, "action": "snapshot", "status": "ok"}):
            with self.assertRaises(RuntimeError):
                MODULE.validate_capabilities(value)
        good = {"schema": 1, "action": "preflight", "status": "ok", "missing": [],
                "capabilities": dict.fromkeys(("usage", "macos_14_or_later", "accessibility",
                    "post_events", "screen_capture", "on_console", "login_complete", "display_active",
                    "finder_running", "finder_ax_menu"), True)}
        self.assertIs(MODULE.validate_capabilities(good), good)
        # Finder AppleEvent permission is observed, not used by the AX/Workspace route.
        good["capabilities"]["finder_automation"] = False
        good["capabilities"]["finder_automation_status"] = -1743
        self.assertIs(MODULE.validate_capabilities(good), good)
        good["capabilities"]["finder_ax_menu"] = False
        with self.assertRaises(RuntimeError):
            MODULE.validate_capabilities(good)

    def test_swift_target_uses_host_architecture_and_explicit_deployment(self):
        for arch in ("arm64", "x86_64"):
            self.assertEqual(MODULE.swift_target(arch), arch + "-apple-macosx14.0")
        with self.assertRaises(RuntimeError):
            MODULE.swift_target("unsupported")

    def test_child_failure_keeps_nonzero_and_is_not_retried(self):
        with tempfile.TemporaryDirectory() as directory:
            proc = Mock(pid=123, returncode=17)
            proc.poll.return_value = 17
            with patch.object(MODULE.subprocess, "Popen", return_value=proc) as spawn, \
                 patch.object(MODULE, "stop_owned", return_value=False):
                with self.assertRaises(RuntimeError):
                    MODULE.run_owned(["synthetic"], Path(directory) / "child.log", 1)
            spawn.assert_called_once()
            evidence = json.loads((Path(directory) / "child.json").read_text())
            self.assertEqual(evidence["exit_code"], 17)

    def test_timeout_still_stops_only_owned_child(self):
        with tempfile.TemporaryDirectory() as directory:
            proc = Mock(pid=123, returncode=None)
            proc.poll.return_value = None
            with patch.object(MODULE.subprocess, "Popen", return_value=proc), \
                 patch.object(MODULE, "stop_owned", return_value=True) as stop, \
                 patch.object(MODULE.time, "monotonic", side_effect=[0, 2, 3]):
                with self.assertRaisesRegex(RuntimeError, "deadline"):
                    MODULE.run_owned(["synthetic"], Path(directory) / "child.log", 1)
            stop.assert_called_once_with(proc)

    def test_orphan_cleanup_cannot_turn_success_into_pass(self):
        with tempfile.TemporaryDirectory() as directory:
            proc = Mock(pid=123, returncode=0)
            proc.poll.return_value = 0
            with patch.object(MODULE.subprocess, "Popen", return_value=proc), \
                 patch.object(MODULE, "stop_owned", return_value=True):
                with self.assertRaisesRegex(RuntimeError, "left an owned"):
                    MODULE.run_owned(["synthetic"], Path(directory) / "child.log", 1)


if __name__ == "__main__":
    unittest.main()
