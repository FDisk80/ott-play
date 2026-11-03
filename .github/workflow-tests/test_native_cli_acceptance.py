"""Native CLI conformance stays in the required CI graph, without devices."""
from pathlib import Path
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[2]


class NativeCliAcceptanceWorkflow(unittest.TestCase):
    def test_required_ci_calls_the_reusable_validator(self):
        load = lambda name: yaml.load(
            (ROOT / ".github/workflows" / name).read_text(), Loader=yaml.BaseLoader)
        ci = load("ci.yml")
        caller = ci["jobs"]["native-cli-acceptance"]
        self.assertEqual(caller, {"uses": "./.github/workflows/native-cli-acceptance.yml"})
        workflow = load("native-cli-acceptance.yml")
        self.assertEqual(workflow["on"], {"workflow_call": {}})
        self.assertEqual(workflow["permissions"], {"contents": "read"})
        job = workflow["jobs"]["read-only-contract"]
        self.assertLessEqual(int(job["timeout-minutes"]), 5)
        checkouts = [step for step in job["steps"]
                     if step.get("uses", "").startswith("actions/checkout@")]
        self.assertEqual(len(checkouts), 2)
        self.assertTrue(all(step["with"]["persist-credentials"] == "false" for step in checkouts))
        external = checkouts[1]["with"]
        self.assertEqual(external["repository"], "open-ott-play/ottplay-control-server")
        self.assertRegex(external["ref"], r"^[0-9a-f]{40}$")
        self.assertEqual([step["run"] for step in job["steps"] if "run" in step], [
            "python3 -m unittest discover -s tests -p test_webos_native_cli_smoke.py -v",
            "python3 scripts/check-native-cli-settings.py --cli .native-cli-control/cli/ott.py",
            "python3 scripts/check-native-cli-transport.py --cli .native-cli-control/cli/ott.py",
        ])


if __name__ == "__main__":
    unittest.main()
