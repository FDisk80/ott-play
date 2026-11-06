"""Prevent an older generator from skipping main-branch release qualification."""

import importlib.util
import json
import shutil
import subprocess
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]


def scope_classifier(workflow: dict):
    """Select the real classifier step instead of a copied shell fixture."""
    steps = workflow["jobs"]["scope"]["steps"]
    classifiers = [step for step in steps if step.get("id") == "scope"]
    if len(classifiers) != 1:
        message = "Expected one release change classifier"
        raise ValueError(message)
    return classifiers[0]


def require_classifier_arguments(classifier: dict, force_full: str):
    """Execute the workflow shell with only a recording python3 on PATH."""
    shell = shutil.which("bash")
    if shell is None:
        raise RuntimeError("Workflow command contract requires bash")
    configured = classifier["env"]
    with tempfile.TemporaryDirectory(prefix="release scope ") as directory:
        root = Path(directory)
        captured = root / "arguments"
        recorder = root / "python3"
        recorder.write_text('#!/bin/sh\nprintf "%s\\0" "$@" >> "$CAPTURE_ARGS"\n')
        recorder.chmod(0o700)
        environment = {
            "PATH": str(root),
            "CAPTURE_ARGS": str(captured),
            "FORCE_FULL": force_full,
            "DOCUMENTATION_PATHS": configured["DOCUMENTATION_PATHS"],
            "REQUIRED_PATHS": configured["REQUIRED_PATHS"],
        }
        subprocess.run(
            [shell, "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", classifier["run"]],
            cwd=root,
            env=environment,
            check=True,
            capture_output=True,
            timeout=5,
        )
        raw = captured.read_bytes() if captured.exists() else b""
        actual = [part.decode() for part in raw.split(b"\0")[:-1]]
    expected = ["scripts/change_scope.py"]
    if force_full == "true":
        expected.append("--force")
    expected += [
        "--documentation-paths-json", configured["DOCUMENTATION_PATHS"],
        "--required-paths-json", configured["REQUIRED_PATHS"],
    ]
    if not raw.endswith(b"\0") or actual != expected:
        raise ValueError("Classifier shell must forward the exact configured arguments")
    return actual


def require_full_release(workflow: dict):
    """Require both unconditional release scope and its actual shell forwarding."""
    classifier = scope_classifier(workflow)
    value = classifier.get("env", {}).get("FORCE_FULL")
    if value is not True and value != "true":
        message = "Main-branch release qualification must always run in full"
        raise ValueError(message)
    command = classifier.get("run", "")
    if (
        "args+=(--force)" not in command
        or 'scripts/change_scope.py "${args[@]}"' not in command
    ):
        message = "Release classifier must forward the force-full argument"
        raise ValueError(message)
    require_classifier_arguments(classifier, "true")


class ReleaseScopeTests(unittest.TestCase):
    def setUp(self):
        self.workflow = yaml.safe_load(
            (ROOT / ".github/workflows/release-pipeline.yml").read_text()
        )

    def test_release_qualification_never_skips_documentation(self):
        require_full_release(self.workflow)

    def test_channel_specific_release_validation_also_stays_full(self):
        wrapper = yaml.safe_load(
            (ROOT / ".github/workflows/release-quality-gate.yml").read_text()
        )
        require_full_release(wrapper)

    def test_channel_wrapper_rejects_documentation_skip(self):
        wrapper = yaml.safe_load(
            (ROOT / ".github/workflows/release-quality-gate.yml").read_text()
        )
        (classifier,) = [
            step
            for step in wrapper["jobs"]["scope"]["steps"]
            if step.get("id") == "scope"
        ]
        classifier["env"]["FORCE_FULL"] = "false"
        try:
            require_full_release(wrapper)
        except ValueError as error:
            if "always run in full" not in str(error):
                raise
        else:
            self.fail("Invalid channel-wrapper force-full value was accepted")

    def test_real_classifier_commands_preserve_force_and_json_arguments(self):
        for name in ("quality-gate", "release-pipeline", "release-quality-gate"):
            workflow = yaml.safe_load((ROOT / f".github/workflows/{name}.yml").read_text())
            for force in ("true", "false"):
                with self.subTest(workflow=name, force=force):
                    require_classifier_arguments(scope_classifier(workflow), force)

    def test_inverted_force_condition_is_rejected(self):
        workflow = deepcopy(self.workflow)
        classifier = scope_classifier(workflow)
        original = classifier["run"]
        classifier["run"] = original.replace('"$FORCE_FULL" == true', '"$FORCE_FULL" != true')
        self.assertNotEqual(classifier["run"], original)
        with self.assertRaisesRegex(ValueError, "exact configured arguments"):
            require_full_release(workflow)

    def test_substituted_required_paths_are_rejected(self):
        classifier = deepcopy(scope_classifier(self.workflow))
        original = classifier["run"]
        classifier["run"] = original.replace('"$REQUIRED_PATHS"', '"$DOCUMENTATION_PATHS"')
        self.assertNotEqual(classifier["run"], original)
        with self.assertRaisesRegex(ValueError, "exact configured arguments"):
            require_classifier_arguments(classifier, "true")

    def test_changelog_uses_forwarded_policy_required_paths(self):
        quality = yaml.safe_load((ROOT / ".github/workflows/quality-gate.yml").read_text())
        classifier = scope_classifier(quality)
        policy = json.loads((ROOT / ".release-policy.json").read_text())
        expected = policy["change_scope"]["required_paths"]
        self.assertIn("docs/privacy-policy.md", expected)
        self.assertIn("CHANGELOG.md", expected)
        self.assertIn(policy["release_notes"], expected)
        self.assertEqual(json.loads(classifier["env"]["REQUIRED_PATHS"]), expected)
        args = require_classifier_arguments(classifier, "false")
        required = json.loads(args[args.index("--required-paths-json") + 1])
        explicit = json.loads(args[args.index("--documentation-paths-json") + 1])
        spec = importlib.util.spec_from_file_location("release_scope_classifier", ROOT / "scripts/change_scope.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        record = b":100644 100644 " + b"a" * 40 + b" " + b"b" * 40 + b" M\0CHANGELOG.md\0"
        self.assertEqual(module.classify_diff(record, explicit, required), {
            "run": True, "reason": "required-path-change",
        })
        self.assertEqual(module.classify_diff(record, explicit, []), {
            "run": False, "reason": "documentation-only",
        })

    def test_existing_documentation_validator_runs_before_heavy_ci(self):
        quality = yaml.safe_load((ROOT / ".github/workflows/quality-gate.yml").read_text())
        contracts = quality["jobs"]["workflow-contracts"]
        self.assertNotIn("if", contracts)
        step = next(
            step for step in contracts["steps"] if step.get("name") == "Validate documentation with the locked compiler"
        )
        self.assertNotIn("if", step)
        self.assertNotIn("continue-on-error", step)
        self.assertIn("node tests/test_readme_docs.cjs", step["run"])
        self.assertIn("npm ci --ignore-scripts", step["run"])
        self.assertIn('NODE_PATH="$RUNNER_TEMP/ottplay-docs-validation/node_modules"', step["run"])
        self.assertIn("workflow-contracts", quality["jobs"]["gate"]["needs"])
        lock = json.loads((ROOT / "package-lock.json").read_text())
        self.assertIn("integrity", lock["packages"]["node_modules/typescript"])

    def test_old_generator_documentation_skip_is_rejected(self):
        workflow = deepcopy(self.workflow)
        (classifier,) = [
            step
            for step in workflow["jobs"]["scope"]["steps"]
            if step.get("id") == "scope"
        ]
        for value in ("false", False, None, 1, "TRUE", ""):
            with self.subTest(force_full=value):
                classifier["env"]["FORCE_FULL"] = value
                try:
                    require_full_release(workflow)
                except ValueError as error:
                    if "always run in full" not in str(error):
                        raise
                else:
                    self.fail("Invalid force-full value was accepted")


if __name__ == "__main__":
    unittest.main()
