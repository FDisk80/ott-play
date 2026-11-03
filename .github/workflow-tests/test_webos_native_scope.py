"""The optional native build must never fall outside the required CI gate."""

import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import yaml

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("webos_scope", ROOT / "scripts/webos-native-scope.py")
SCOPE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SCOPE)
BASE, HEAD = "a" * 40, "b" * 40


class NativeScopeTests(unittest.TestCase):
    def test_native_inputs_require_build(self):
        for path in (*SCOPE.PATHS, "native/webos/build.py", "native/webos/patches/fix.patch",
                     "scripts/webos-runtime-sources.json", "scripts/webos-runtime-sources.py",
                     "scripts/verify-webos-native-release.py", "tests/test_webos_native_release.py"):
            with self.subTest(path=path):
                self.assertTrue(SCOPE.requires_build("pull_request", BASE, HEAD, lambda *_, path=path: [path]))

    def test_unrelated_pr_keeps_only_fast_contracts(self):
        self.assertFalse(SCOPE.requires_build("pull_request", BASE, HEAD,
                         lambda *_: ["README.md", "src/plugins/plex.ts", ""]))

    def test_all_companion_source_roots_require_build(self):
        manifest = json.loads((ROOT / "native/webos/companion/manifest.json").read_text())
        for path in manifest["source_roots"]:
            candidate = path + "/example.rs" if (ROOT / path).is_dir() else path
            with self.subTest(path=candidate):
                self.assertTrue(SCOPE.requires_build("pull_request", BASE, HEAD,
                                                    lambda *_, candidate=candidate: [candidate]))

    def test_non_pr_builds_without_git_metadata(self):
        for event in ("workflow_dispatch", "push", "merge_group"):
            with self.subTest(event=event):
                self.assertTrue(SCOPE.requires_build(event, "", "", lambda *_: self.fail("unexpected diff")))

    def test_bad_pr_metadata_cannot_skip_build(self):
        for base, head in (("", HEAD), (BASE, "--help"), (BASE, "main")):
            with self.subTest(base=base, head=head), self.assertRaises(ValueError):
                SCOPE.requires_build("pull_request", base, head, lambda *_: [])

    def test_diff_error_cannot_skip_build(self):
        def fail(*_):
            raise RuntimeError("missing commit")
        with self.assertRaises(RuntimeError):
            SCOPE.requires_build("pull_request", BASE, HEAD, fail)

    def test_moving_source_out_of_native_still_requires_build(self):
        with tempfile.TemporaryDirectory() as directory:
            def git(*args):
                return subprocess.check_output(["git", *args], cwd=directory).decode().strip()
            git("init", "--quiet")
            git("config", "user.name", "Workflow Fixture")
            git("config", "user.email", "fixture@example.invalid")
            original = Path(directory) / "native/webos/example"
            original.parent.mkdir(parents=True)
            original.write_text("native build input\n")
            git("add", ".")
            git("-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "base")
            base = git("rev-parse", "HEAD")
            original.rename(Path(directory) / "README.md")
            git("add", "-A")
            git("-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "move")
            head = git("rev-parse", "HEAD")
            self.assertTrue(SCOPE.requires_build("pull_request", base, head,
                            lambda a, b: SCOPE.changed_paths(a, b, cwd=directory)))

    def test_reusable_workflow_is_nested_in_required_ci(self):
        def load(name):
            return yaml.load((ROOT / ".github/workflows" / name).read_text(), Loader=yaml.BaseLoader)
        ci, native = load("ci.yml"), load("webos-native.yml")
        self.assertEqual(ci["jobs"]["native-webos"]["uses"], "./.github/workflows/webos-native.yml")
        self.assertEqual(set(native["on"]), {"workflow_call", "workflow_dispatch"})
        contracts = native["jobs"]["contracts"]
        self.assertEqual(contracts["timeout-minutes"], "5")
        self.assertEqual(contracts["outputs"]["build"], "${{ steps.scope.outputs.build }}")
        self.assertEqual(contracts["steps"][0]["with"]["fetch-depth"], "0")
        self.assertEqual(native["jobs"]["native-candidate"]["needs"], "contracts")
        self.assertEqual(native["jobs"]["native-candidate"]["if"],
                         "${{ needs.contracts.outputs.build == 'true' }}")

    def test_complete_bundle_is_verified_before_upload(self):
        workflow = yaml.load((ROOT / ".github/workflows/webos-native.yml").read_text(),
                             Loader=yaml.BaseLoader)
        contracts = workflow["jobs"]["contracts"]["steps"]
        self.assertTrue(any("test_webos_native_release.py" in step.get("run", "")
                            for step in contracts))
        steps = workflow["jobs"]["native-candidate"]["steps"]
        collector = next(i for i, step in enumerate(steps)
                         if "scripts/webos-runtime-sources.py" in step.get("run", ""))
        verifier = next(i for i, step in enumerate(steps)
                        if "scripts/verify-webos-native-release.py" in step.get("run", ""))
        upload = next(i for i, step in enumerate(steps)
                      if step.get("uses", "").startswith("actions/upload-artifact@"))
        self.assertLess(collector, verifier)
        self.assertLess(verifier, upload)
        self.assertNotIn("continue-on-error", steps[verifier])
        self.assertNotIn("if", steps[verifier])
        self.assertIn('--metadata "build/native-webos/dist/ottplay-native-webos-${native_version}.json"',
                      steps[verifier]["run"])
        self.assertIn("--check-checkout", steps[verifier]["run"])
        self.assertEqual(steps[verifier]["id"], "bundle")
        self.assertIn('"$GITHUB_OUTPUT"', steps[verifier]["run"])
        stem = "build/native-webos/dist/ottplay-native-webos-${{ steps.bundle.outputs.version }}"
        expected = {stem + suffix for suffix in (
            ".ipk", ".json", ".sha256", "-source.tar.gz", "-source.tar.gz.release.json",
            "-runtime-source.tar.gz", "-source-set.json",
        )}
        expected.add("build/native-webos/dist/ottplay-native-webos-icon.png")
        self.assertEqual(set(steps[upload]["with"]["path"].splitlines()), expected)

    def test_complete_candidate_requires_companion_before_packaging(self):
        workflow = yaml.load((ROOT / ".github/workflows/webos-native.yml").read_text(),
                             Loader=yaml.BaseLoader)
        contracts = workflow["jobs"]["contracts"]["steps"]
        self.assertTrue(any("-s native/webos/companion" in step.get("run", "")
                            for step in contracts))
        steps = workflow["jobs"]["native-candidate"]["steps"]
        commands = [step.get("run", "") for step in steps]
        indexes = [next(i for i, command in enumerate(commands) if marker in command)
                   for marker in ("native/webos/build.py bootstrap",
                                  "native/webos/companion/prepare.py",
                                  '"native/webos/companion/build.py", "build"',
                                  "native/webos/build.py all",
                                  "scripts/webos-runtime-sources.py")]
        self.assertEqual(indexes, sorted(set(indexes)))
        for index in indexes:
            self.assertNotIn("if", steps[index])
            self.assertNotIn("continue-on-error", steps[index])
        self.assertIn('--companion-bundle "$RUNNER_TEMP/companion-bundle"', commands[indexes[3]])
        self.assertIn('--companion-bundle "$RUNNER_TEMP/companion-bundle"', commands[indexes[4]])
        self.assertIn('--companion-sources "$RUNNER_TEMP/companion-source"', commands[indexes[4]])
        self.assertIn('--sdk-archive "$WEBOS_SDK_ARCHIVE"', commands[indexes[4]])

    def test_helper_build_and_sources_share_prepared_offline_environment(self):
        workflow = yaml.load((ROOT / ".github/workflows/webos-native.yml").read_text(),
                             Loader=yaml.BaseLoader)
        run = next(step["run"] for step in workflow["jobs"]["native-candidate"]["steps"]
                   if '"native/webos/companion/build.py", "build"' in step.get("run", ""))
        code = run.split("python3 - <<'PY'\n", 1)[1].rsplit("\nPY", 1)[0]
        with tempfile.TemporaryDirectory(prefix="companion workflow ") as directory:
            prepared = {
                "environment": {"CARGO_HOME": directory + "/cargo", "CARGO_NET_OFFLINE": "true",
                                "RUSTUP_TOOLCHAIN": "pinned-fixture"},
                "target_dir": directory + "/target", "libclang": directory + "/clang",
                "rust_sysroot": directory + "/rust", "rust_source_archive": directory + "/rust.tar.xz",
            }
            (Path(directory) / "companion-prepared.json").write_text(json.dumps(prepared))
            with mock.patch.dict(os.environ, {"RUNNER_TEMP": directory, "WEBOS_SDK": "/sdk fixture",
                                              "WEBOS_SDK_ARCHIVE": "/sdk fixture.tar.bz2"}), \
                    mock.patch("subprocess.run") as execute:
                # Execute only the checked-in workflow body with process launches mocked.
                exec(compile(code, "webos-native.yml companion", "exec"), {})  # noqa: S102
            self.assertEqual(execute.call_count, 2)
            build, source = execute.call_args_list
            self.assertEqual(build.kwargs["env"], source.kwargs["env"])
            for call in (build, source):
                self.assertIs(call.kwargs["check"], True)
                for key, value in prepared["environment"].items():
                    self.assertEqual(call.kwargs["env"][key], value)
            build_args, source_args = build.args[0], source.args[0]
            self.assertEqual(build_args[build_args.index("--output") + 1],
                             source_args[source_args.index("--bundle") + 1])
            self.assertEqual(build_args[build_args.index("--sdk-archive") + 1], "/sdk fixture.tar.bz2")
            self.assertEqual(source_args[source_args.index("--rust-source-archive") + 1],
                             prepared["rust_source_archive"])


if __name__ == "__main__":
    unittest.main()
