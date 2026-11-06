"""Keep independent transport scenarios observable without hiding failures."""

import importlib.util
import unittest
from collections import Counter
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("contracts", ROOT / "scripts/workflow_contracts.py")
CONTRACTS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CONTRACTS)


class RemoteIntegrationCI(unittest.TestCase):
    def setUp(self):
        workflow = yaml.load(
            (ROOT / ".github/workflows/ci.yml").read_text(),
            Loader=CONTRACTS.UniqueKeyLoader,
        )
        self.job = workflow["jobs"]["remote-integration"]
        self.steps = self.job["steps"]
        self.named = {step["name"]: step for step in self.steps if "name" in step}
        self.ids = {step["id"]: step for step in self.steps if "id" in step}

    def assert_dependency(self, step, prerequisite):
        # The explicit status function allows later scenarios after a failure,
        # but cancellation or a failed/skipped build must not launch them.
        self.assertEqual(
            step["if"],
            "${{ !cancelled() && steps." + prerequisite + ".outcome == 'success' }}",
        )
        self.assertLess(self.steps.index(self.ids[prerequisite]), self.steps.index(step))

    def test_builds_and_scenarios_keep_failures_and_cancellation_visible(self):
        self.assertNotIn("continue-on-error", self.job)
        self.assertNotIn("if", self.job)
        self.assertEqual(self.job["timeout-minutes"], "15")
        for step in self.steps:
            self.assertNotIn("continue-on-error", step)
        assets = self.ids["runtime-assets"]
        self.assertEqual(assets["run"], "npm run build")
        self.assertNotIn("if", assets)
        for build in ("legacy-server", "current-server", "global-server"):
            self.assert_dependency(self.ids[build], "runtime-assets")
        dependencies = {
            "Exercise real HTTPS diagnostics": "legacy-server",
            "Exercise legacy repairs with the current CLI": "legacy-server",
            "Exercise the legacy workbench": "legacy-server",
            "Exercise local profiles with the current controller": "current-server",
            "Keep the legacy CLI compatible with the current server": "current-server",
            "Reject engine inspection on the legacy server without downgrading": "legacy-server",
            "Exercise explicit engine inspection and default legacy payloads": "current-server",
            "Exercise roadmap with the current controller": "runtime-assets",
            "Exercise global Favorites through real CLI and HTTP transport": "global-server",
        }
        for name, prerequisite in dependencies.items():
            with self.subTest(name=name):
                self.assert_dependency(self.named[name], prerequisite)

    def test_all_nine_scenarios_are_separate_unmasked_commands(self):
        commands = [step["run"] for step in self.steps if "smoke" in step.get("run", "")]
        self.assertEqual(Counter(commands), Counter({
            "node scripts/smoke-diagnostics.cjs": 1,
            "node scripts/smoke-remote-cli.cjs": 1,
            "node scripts/smoke-workbench.cjs": 4,
            "node scripts/smoke-remote-cli.cjs --offline-profiles-only": 1,
            "node .control-current/scripts/smoke_foss_roadmap.cjs .": 1,
            "node scripts/smoke-remote-cli.cjs --global-favorites-only": 1,
        }))

    def test_old_current_and_global_controller_contracts_are_not_interchanged(self):
        checkouts = {
            step.get("with", {}).get("path"): step["with"]["ref"]
            for step in self.steps if "ref" in step.get("with", {})
        }
        self.assertEqual(checkouts, {
            ".control-integration": "9b28c08eefca3948c78336e7e16a45e6fc492e31",
            ".control-current": "477d2d4adfeb4ce3fa007a443ea9388d41c85447",
            ".control-global": "27d1abc81de025fa93e3ac7dc6fbcc67eb6de130",
        })
        for build, folder, binary in (
            ("legacy-server", ".control-integration", "ottplay-control-server"),
            ("current-server", ".control-current", "ottplay-control-server-current"),
            ("global-server", ".control-global", "ottplay-control-server-global"),
        ):
            step = self.ids[build]
            self.assertEqual(step["working-directory"], folder)
            self.assertEqual(step["run"], 'go build -o "$RUNNER_TEMP/' + binary + '" ./cmd/ottplay-control-server')
        initial = self.named["Exercise real HTTPS diagnostics"]["env"]
        self.assertEqual(initial, {
            "OTT_OFFLINE_PROFILES": "unsupported-controller",
            "OTT_CONTROL_BINARY": "${{ runner.temp }}/ottplay-control-server",
            "OTT_DIAGNOSTICS_CLI": "${{ github.workspace }}/.control-integration/cli/diagnostics.py",
            "OTT_CLI": "${{ github.workspace }}/.control-integration/cli/ott.py",
        })
        self.assertEqual(self.named["Exercise the legacy workbench"]["env"], initial)
        self.assertEqual(self.named["Exercise legacy repairs with the current CLI"]["env"], {
            **initial, "OTT_CLI": "${{ github.workspace }}/.control-current/cli/ott.py",
        })
        for name, flag in (
            ("Reject engine inspection on the legacy server without downgrading", "unsupported-controller"),
            ("Exercise explicit engine inspection and default legacy payloads", "1"),
        ):
            env = self.named[name]["env"]
            self.assertEqual(env["OTT_DEBUG_ENGINE_V2"], flag)
            self.assertEqual(env["OTT_PERF_CAPTURE"], flag)
        global_env = self.named["Exercise global Favorites through real CLI and HTTP transport"]["env"]
        self.assertEqual(global_env["OTT_CONTROL_BINARY"], "${{ runner.temp }}/ottplay-control-server-global")
        self.assertEqual(global_env["OTT_CLI"], "${{ github.workspace }}/.control-global/cli/ott.py")
        self.assertEqual(global_env["OTT_GLOBAL_CONTROL_REVISION"], checkouts[".control-global"])


if __name__ == "__main__":
    unittest.main()
