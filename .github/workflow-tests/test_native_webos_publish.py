"""Native publication is explicit, immutable and isolated from build permissions."""

import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]


class NativePublishWorkflowTests(unittest.TestCase):
    def workflow(self):
        return yaml.load(
            (ROOT / ".github/workflows/native-webos-release.yml").read_text(),
            Loader=yaml.BaseLoader,
        )

    def test_only_explicit_main_dispatch_can_reach_publication(self):
        workflow = self.workflow()
        self.assertEqual(set(workflow["on"]), {"workflow_dispatch"})
        inputs = workflow["on"]["workflow_dispatch"]["inputs"]
        self.assertEqual(set(inputs), {"candidate_run_id", "source_sha", "version", "tag"})
        self.assertTrue(all(value["required"] == "true" for value in inputs.values()))
        self.assertEqual(workflow["jobs"]["publish"]["if"],
                         "${{ github.ref == 'refs/heads/main' && inputs.source_sha == github.sha }}")
        self.assertEqual(workflow["jobs"]["publish"]["needs"], "prepare")
        self.assertEqual(workflow["jobs"]["verify-public"]["needs"], ["prepare", "publish"])
        self.assertEqual(workflow["concurrency"]["cancel-in-progress"], "false")

    def test_wrong_dispatch_context_fails_instead_of_silently_skipping(self):
        guard = self.workflow()["jobs"]["prepare"]["steps"][0]["run"]
        for ref, expected, current, success in (
            ("refs/heads/main", "a" * 40, "a" * 40, True),
            ("refs/heads/topic", "a" * 40, "a" * 40, False),
            ("refs/heads/main", "b" * 40, "a" * 40, False),
        ):
            with self.subTest(ref=ref, expected=expected):
                result = subprocess.run(
                    ["bash", "-c", guard], capture_output=True,
                    env={**os.environ, "GITHUB_REF": ref, "NATIVE_SOURCE_SHA": expected,
                         "GITHUB_SHA": current},
                )
                self.assertEqual(result.returncode == 0, success)

    def test_only_publisher_has_write_permission_and_no_persisted_git_token(self):
        workflow = self.workflow()
        self.assertEqual(workflow["permissions"], {"contents": "read", "actions": "read"})
        for name, job in workflow["jobs"].items():
            permissions = job.get("permissions", workflow["permissions"])
            self.assertEqual(permissions,
                             {"contents": "write" if name == "publish" else "read", "actions": "read"})
            for step in job["steps"]:
                self.assertNotIn("continue-on-error", step)
                self.assertNotIn("always()", step.get("if", ""))
                if "uses" in step:
                    self.assertRegex(step["uses"], r"^[\w/-]+@[0-9a-f]{40}$")
                if step.get("uses", "").startswith("actions/checkout@"):
                    self.assertEqual(step["with"]["ref"], "${{ github.sha }}")
                    self.assertEqual(step["with"]["persist-credentials"], "false")

    def test_bundle_handoff_and_untrusted_inputs_are_explicit(self):
        workflow = self.workflow()
        artifact_names = []
        for job in workflow["jobs"].values():
            for step in job["steps"]:
                if re.match(r"actions/(upload|download)-artifact@", step.get("uses", "")):
                    artifact_names.append(step["with"]["name"])
                self.assertNotIn("${{ inputs.", step.get("run", ""))
        self.assertEqual(artifact_names, ["${{ steps.bundle-identity.outputs.name }}",
                         "${{ needs.prepare.outputs.bundle-name }}",
                         "${{ needs.prepare.outputs.bundle-name }}"])
        commands = [step.get("run", "") for job in workflow["jobs"].values() for step in job["steps"]]
        for operation in ("prepare", "publish", "verify-public"):
            self.assertTrue(any("scripts/publish-webos-native.py " + operation in cmd for cmd in commands))

    def test_failed_job_retry_reuses_the_preparing_attempt_artifact(self):
        jobs = self.workflow()["jobs"]
        self.assertEqual(jobs["prepare"]["outputs"]["bundle-name"],
                         "${{ steps.bundle-identity.outputs.name }}")
        producer = next(step for step in jobs["prepare"]["steps"]
                        if step.get("id") == "bundle-identity")
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "outputs"
            subprocess.run(["bash", "-c", producer["run"]], check=True,
                           env={**os.environ, "GITHUB_RUN_ID": "456", "GITHUB_RUN_ATTEMPT": "1",
                                "GITHUB_OUTPUT": str(output)})
            self.assertEqual(output.read_text(), "name=native-release-456-1\n")
        for name in ("publish", "verify-public"):
            download = next(step for step in jobs[name]["steps"]
                            if step.get("uses", "").startswith("actions/download-artifact@"))
            # On attempt 2, the successful prepare job is not rerun. Both
            # consumers must use its saved output instead of their attempt.
            self.assertEqual(download["with"]["name"], "${{ needs.prepare.outputs.bundle-name }}")
            self.assertNotIn("run_attempt", download["with"]["name"])

    def test_promotion_contract_suite(self):
        # Included in the existing required workflow-test gate without modifying
        # shared suite manifests or invoking a native compiler.
        subprocess.run(
            [sys.executable, "-m", "unittest", "discover", "-s", "tests",
             "-p", "test_native_webos_publish.py", "-v"],
            cwd=ROOT, check=True,
        )


if __name__ == "__main__":
    unittest.main()
