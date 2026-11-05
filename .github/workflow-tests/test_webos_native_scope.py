"""The optional native build must never fall outside the required CI gate."""

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import types
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

    def test_native_jobs_do_not_persist_checkout_credentials(self):
        workflow = yaml.load((ROOT / ".github/workflows/webos-native.yml").read_text(),
                             Loader=yaml.BaseLoader)
        for name, job in workflow["jobs"].items():
            checkouts = [step for step in job["steps"]
                         if step.get("uses", "").startswith("actions/checkout@")]
            self.assertTrue(checkouts, name)
            for step in checkouts:
                with self.subTest(job=name):
                    self.assertEqual(step.get("with", {}).get("persist-credentials"), "false")

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
                      if step.get("uses", "").startswith("actions/upload-artifact@")
                      and step.get("with", {}).get("name") == "ottplay-native-webos-candidate")
        self.assertLess(collector, verifier)
        self.assertLess(verifier, upload)
        self.assertNotIn("continue-on-error", steps[verifier])
        self.assertNotIn("if", steps[verifier])
        self.assertNotIn("if", steps[upload])
        self.assertNotIn("continue-on-error", steps[upload])
        self.assertEqual(steps[upload]["with"]["if-no-files-found"], "error")
        self.assertIn('--metadata "build/native-webos/dist/ottplay-native-webos-${native_version}.json"',
                      steps[verifier]["run"])
        self.assertIn("--check-checkout", steps[verifier]["run"])
        self.assertEqual(steps[verifier]["id"], "bundle")
        self.assertIn('"$GITHUB_OUTPUT"', steps[verifier]["run"])
        stem = "build/native-webos/dist/ottplay-native-webos-${{ steps.bundle.outputs.version }}"
        expected = {stem + suffix for suffix in (
            ".ipk", ".json", ".sha256", "-source.tar.gz", "-source.tar.gz.release.json",
            "-runtime-source.tar.gz", "-source-set.json",
            "-cargo-artifacts.jsonl", "-build-config.txt",
        )}
        expected.add("build/native-webos/dist/ottplay-native-webos-icon.png")
        self.assertEqual(set(steps[upload]["with"]["path"].splitlines()), expected)

    def test_native_size_diagnostics_survive_failed_build_without_promoting_candidate(self):
        workflow = yaml.load((ROOT / ".github/workflows/webos-native.yml").read_text(),
                             Loader=yaml.BaseLoader)
        steps = workflow["jobs"]["native-candidate"]["steps"]
        matches = [step for step in steps
                   if step.get("name") == "Preserve native main size and link diagnostics"]
        self.assertEqual(len(matches), 1)
        diagnostics = matches[0]
        self.assertEqual(diagnostics["if"], "always()")
        self.assertEqual(diagnostics["timeout-minutes"], "5")
        self.assertNotIn("run", diagnostics)
        self.assertNotIn("continue-on-error", diagnostics)
        settings = diagnostics["with"]
        self.assertEqual(settings["name"],
                         "ottplay-native-size-diagnostics-${{ github.sha }}-${{ github.run_attempt }}")
        self.assertEqual(settings["if-no-files-found"], "warn")
        self.assertEqual(settings["retention-days"], "30")
        work = "build/native-webos/"
        expected = {work + path for path in (
            "prepared.json", "ottplay-native-webos-*-cargo-artifacts.jsonl",
            "ottplay-native-webos-*-build-config.txt", "source/rust-modules/rust-toolchain.toml",
            "source/ci/build-budgets.json", "source/pkg/plxnative",
            "source/ipkroot/data/usr/palm/applications/com.openottplay.player.native/plxnative",
        )}
        expected.update(work + prefix + suffix
                        for prefix in ("source/pkg/plxnative", "source/pkg/link-evidence/stable/plxnative")
                        for suffix in (".link.map", ".link.trace", ".link.json"))
        self.assertEqual(set(settings["path"].splitlines()), expected)
        candidate = next(step for step in steps
                         if step.get("with", {}).get("name") == "ottplay-native-webos-candidate")
        self.assertEqual(diagnostics["uses"], candidate["uses"])
        self.assertNotIn("if", candidate)
        self.assertNotIn("continue-on-error", candidate)
        self.assertEqual(candidate["with"]["if-no-files-found"], "error")
        build = next(i for i, step in enumerate(steps)
                     if "native/webos/build.py all" in step.get("run", ""))
        self.assertLess(build, steps.index(diagnostics))
        self.assertNotIn("if", steps[build])
        self.assertNotIn("continue-on-error", steps[build])

    def test_host_qualification_precedes_arm_and_preserves_failure_evidence(self):
        workflow = yaml.load((ROOT / ".github/workflows/webos-native.yml").read_text(),
                             Loader=yaml.BaseLoader)
        job = workflow["jobs"]["native-candidate"]
        self.assertEqual(job["runs-on"], "ubuntu-24.04-arm")
        self.assertEqual(job["timeout-minutes"], "90")
        self.assertNotIn("continue-on-error", job)
        self.assertEqual(job["env"]["JOBS"], "2")
        self.assertEqual(job["env"]["CARGO_BUILD_JOBS"], "2")
        self.assertFalse(any(key.startswith("CARGO_PROFILE_") for key in job["env"]))
        steps = job["steps"]
        commands = [step.get("run", "") for step in steps]
        markers = (
            "native/webos/build.py bootstrap", "rustup component add",
            "make check 2>&1",
            "make sim-linux", "python3 tests/replay_fixtures.py",
            "source-recheck.log", "native/webos/companion/prepare.py",
            '"native/webos/companion/build.py", "build"', "native/webos/build.py all",
        )
        indexes = [next(i for i, command in enumerate(commands) if marker in command)
                   for marker in markers]
        self.assertEqual(indexes, sorted(set(indexes)))
        for index in indexes:
            self.assertNotIn("if", steps[index])
            self.assertNotIn("continue-on-error", steps[index])
        for index in indexes[1:5]:
            step = steps[index]
            self.assertEqual(step["working-directory"], "build/native-webos/source")
            self.assertEqual(step["shell"], "bash")
            self.assertIn("set -euo pipefail", step["run"])
            self.assertIn("tee", step["run"])
            self.assertGreater(int(step["timeout-minutes"]), 0)
            for key, value in {"CARGO_INCREMENTAL": "0", "PLX_CARGO_SEED": "off",
                               "HOST_THREADS": "0", "RELEASE": "", "PLX_TEST_JOBS": "2"}.items():
                self.assertEqual(step["env"][key], value)
            self.assertFalse(any(key.startswith("CARGO_PROFILE_") for key in step["env"]))
        self.assertIn("rust-modules/rust-toolchain.toml", commands[indexes[1]])
        self.assertIn('clippy rustfmt', commands[indexes[1]])
        self.assertIn("make check-nodef", commands[indexes[2]])
        package_commands = commands[indexes[2]]
        selftest = "python3 ci/check-package.py --selftest"
        product_tests = "python3 ci/test_package_product_config.py"
        self.assertLess(package_commands.index(selftest), package_commands.index(product_tests))
        self.assertLess(package_commands.index(product_tests), package_commands.index("make check 2>&1"))
        self.assertIn("package-selftest.log", package_commands)
        self.assertIn("product-config-tests.log", package_commands)
        self.assertIn('make check 2>&1 | tee "$RUNNER_TEMP/native-host-verification/check.log"',
                      package_commands.splitlines())
        self.assertLess(package_commands.index("make check 2>&1"),
                        package_commands.index("make check-nodef"))
        self.assertEqual(sum(command.count("make check 2>&1") for command in commands), 1)
        for partial in ("make check-cargo-lint", "make check-cargo-unit-default",
                        "make check-cargo-unit-hostsim"):
            self.assertFalse(any(partial in command for command in commands), partial)
        self.assertIn('SIM_TDIR="$RUNNER_TEMP/native-sim-target"', commands[indexes[3]])
        replay = steps[indexes[4]]
        self.assertEqual(replay["env"]["LIBGL_ALWAYS_SOFTWARE"], "1")
        for argument in ("xvfb-run", '"$RUNNER_TEMP/native-sim-target/release/plxnative-sim"',
                         '--assets "$PWD/pkg"', "--jobs 1", "--timeout 300"):
            self.assertIn(argument, replay["run"])
        # The source bundle rejects untracked Cargo output under rust-modules.
        for command in (commands[indexes[3]], replay["run"]):
            self.assertNotIn("rust-modules/target-sim-ci", command)
        recheck = commands[indexes[5]]
        self.assertIn("native/webos/build.py prepare", recheck)
        self.assertIn("prepared-after.json", recheck)
        self.assertIn("--rust-opt-level s", commands[indexes[8]])
        dependencies = next(command for command in commands if "apt-get install" in command)
        for package in ("libsdl2-dev", "libsdl2-ttf-dev", "libgl1-mesa-dev",
                        "libgl1-mesa-dri", "xvfb", "xauth"):
            self.assertIn(package, dependencies.split())
        evidence = next(step for step in steps
                        if step.get("with", {}).get("name", "").startswith("ottplay-native-host-verification-"))
        self.assertTrue(evidence["uses"].startswith("actions/upload-artifact@"))
        self.assertEqual(evidence["if"], "always()")
        stem = "${{ runner.temp }}/native-host-verification/"
        self.assertEqual(set(evidence["with"]["path"].splitlines()), {
            stem + suffix for suffix in ("*.log", "*.json", "rust-toolchain.txt",
                                        "replay/**/plxnative-events.log", "replay/**/sim.out", "classic-ui/**")
        })

    def test_classic_ui_capture_is_mandatory_and_uses_the_qualified_renderer(self):
        workflow = yaml.load((ROOT / ".github/workflows/webos-native.yml").read_text(),
                             Loader=yaml.BaseLoader)
        job = workflow["jobs"]["native-candidate"]
        steps = job["steps"]
        matches = [step for step in steps if "python3 tests/ott_classic_ui.py" in step.get("run", "")]
        self.assertEqual(len(matches), 1)
        step = matches[0]
        self.assertEqual(step["name"], "Capture Classic UI through the Linux renderer")
        self.assertNotIn("if", step)
        self.assertNotIn("continue-on-error", step)
        self.assertEqual(step["timeout-minutes"], "7")
        self.assertLessEqual(int(step["timeout-minutes"]), int(job["timeout-minutes"]))
        self.assertEqual(step["working-directory"], "build/native-webos/source")
        self.assertEqual(step["shell"], "bash")
        replay = next(item for item in steps if "python3 tests/replay_fixtures.py" in item.get("run", ""))
        self.assertEqual(step["env"], replay["env"])
        self.assertEqual(step["env"]["LIBGL_ALWAYS_SOFTWARE"], "1")
        build = next(item for item in steps if "make sim-linux" in item.get("run", ""))
        recheck = next(item for item in steps if "source-recheck.log" in item.get("run", ""))
        arm = next(item for item in steps if "native/webos/build.py all" in item.get("run", ""))
        self.assertLess(steps.index(build), steps.index(replay))
        self.assertLess(steps.index(replay), steps.index(step))
        self.assertLess(steps.index(step), steps.index(recheck))
        self.assertLess(steps.index(recheck), steps.index(arm))
        self.assertEqual(step["run"], "\n".join((
            "set -euo pipefail",
            "xvfb-run -a -s '-screen 0 1920x1080x24' python3 tests/ott_classic_ui.py \\",
            '  --sim "$RUNNER_TEMP/native-sim-target/release/plxnative-sim" \\',
            '  --assets "$PWD/pkg" --output "$RUNNER_TEMP/native-host-verification/classic-ui" \\',
            '  --timeout 300 \\',
            '  2>&1 | tee "$RUNNER_TEMP/native-host-verification/classic-ui.log"',
            "",
        )))
        evidence = next(item for item in steps if item.get("with", {}).get("name", "").startswith(
            "ottplay-native-host-verification-"))
        self.assertEqual(evidence["if"], "always()")
        self.assertIn("${{ runner.temp }}/native-host-verification/classic-ui/**",
                      evidence["with"]["path"].splitlines())

    def schema_export_step(self):
        workflow = yaml.load((ROOT / ".github/workflows/webos-native.yml").read_text(),
                             Loader=yaml.BaseLoader)
        matches = [step for step in workflow["jobs"]["native-candidate"]["steps"]
                   if step.get("name") == "Export actual Native settings schema"]
        self.assertEqual(len(matches), 1)
        return matches[0]

    def test_schema_export_reuses_canonical_host_target_after_full_check(self):
        step = self.schema_export_step()
        workflow = yaml.load((ROOT / ".github/workflows/webos-native.yml").read_text(),
                             Loader=yaml.BaseLoader)
        steps = workflow["jobs"]["native-candidate"]["steps"]
        index = steps.index(step)
        self.assertIn("make check-nodef", steps[index - 1]["run"])
        self.assertEqual(steps[index + 1]["name"], "Build the native Linux renderer")
        self.assertEqual(step["timeout-minutes"], "5")
        self.assertNotIn("if", step)
        self.assertNotIn("continue-on-error", step)
        self.assertEqual(step["working-directory"], "build/native-webos/source")
        self.assertEqual(step["env"], {"CARGO_INCREMENTAL": "0", "PLX_CARGO_SEED": "off",
                                      "HOST_THREADS": "0", "RELEASE": "", "PLX_TEST_JOBS": "1"})
        evidence = next(item for item in steps
                        if item.get("with", {}).get("name", "").startswith("ottplay-native-host-verification-"))
        self.assertEqual(evidence["if"], "always()")
        for suffix in ("*.json", "*.log"):
            self.assertIn("${{ runner.temp }}/native-host-verification/" + suffix,
                          evidence["with"]["path"].splitlines())

    def test_schema_export_requires_actual_one_test_and_two_complete_pages(self):
        step = self.schema_export_step()
        code = compile(step["run"].split("python3 - <<'PY'\n", 1)[1].rsplit("\nPY", 1)[0],
                       "actual schema export workflow", "exec")
        for case in ("success", "zero", "missing-name", "failed", "missing-page", "duplicate-id",
                     "changed-context", "wrong-source", "source-changed", "cold-target"):
            with self.subTest(case=case):
                self.check_schema_export_case(code, case)

    def check_schema_export_case(self, code, case):
        import contextlib
        import io

        test = "app::ott_runtime::tests::settings_schema_contract::every_schema_page_obeys_controller_v1"
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            (source / "rust-modules").mkdir(parents=True)
            if case != "cold-target":
                (source / "rust-modules/target").mkdir()
            evidence = root / "native-host-verification"
            evidence.mkdir()
            (root / "prepared.json").write_text(json.dumps({"tree": "a" * 40}))
            files = ("Makefile", "rust-modules/Cargo.lock", "rust-modules/rust-toolchain.toml",
                     "tools/cargo-test-parallel.py", "rust-modules/src/app/ott_runtime_tests.rs",
                     "rust-modules/src/app/ott_runtime_tests/settings_schema_contract.rs",
                     "rust-modules/src/app/ott_settings.rs", "rust-modules/src/app/ott_settings_classic.rs")
            for name in files:
                path = source / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("fixture\n")
            context = {"token": "context", "provider": None, "profile": None}
            pages = [
                {"request": {"op": "schema", "runtime": "fixture"},
                 "data": {"context": context, "next_cursor": "context:20",
                          "settings": [{"id": f"setting{n}"} for n in range(20)]}},
                {"request": {"op": "schema", "runtime": "fixture", "cursor": "context:20"},
                 "data": {"context": dict(context), "next_cursor": None,
                          "settings": [{"id": f"setting{n}"} for n in range(20, 40)]}},
            ]
            if case == "missing-page":
                pages.pop()
            if case == "duplicate-id":
                pages[1]["data"]["settings"][0]["id"] = "setting0"
            if case == "changed-context":
                pages[1]["data"]["context"]["token"] = "changed"
            count = 0 if case == "zero" else 1
            name = "wrong::name" if case == "missing-name" else test
            log = (f"running {count} test\ntest {name} ... "
                   + "\n".join("SETTINGS_SCHEMA_V1 " + json.dumps(page) for page in pages)
                   + f"\nok\ntest result: ok. {count} passed; 0 failed; 0 ignored; 0 measured; 3 filtered out; finished in 0.01s\n")
            spawned = []

            def output(command, **_):
                if command == ["git", "write-tree"]:
                    return ("b" if case == "wrong-source" else "a") * 40 + "\n"
                if command == ["git", "diff", "--exit-code", "--quiet"]:
                    return b""
                if command == ["make", "-s", "print-cargo-env"]:
                    return "PLX_RELEASE=fixture\n"
                if command == ["make", "-s", "print-rust-toolchain"]:
                    return "1.99.1\n"
                if command == ["git", "-C", str(root), "rev-parse", "HEAD"]:
                    return "c" * 40 + "\n"
                self.fail(f"Unexpected process: {command}")

            def run(command, **kwargs):
                spawned.append(command)
                self.assertEqual(command[1:7], ["../tools/cargo-test-parallel.py", "--jobs", "1",
                                               "--require-match", "--filter", test])
                self.assertEqual(command[7:], ["--", "cargo", "+1.99.1", "test", "--locked", "--offline",
                                              "--jobs", "1", "--target-dir", "target", "--lib", "-p",
                                              "plxnative-modules", "--features", "hostsim", "--", "--exact",
                                              "--nocapture", "--test-threads=1"])
                self.assertEqual(kwargs["cwd"], source / "rust-modules")
                environment = kwargs["env"]
                self.assertNotIn("RUST_MIN_STACK", environment)
                self.assertNotIn("PLX_STALE", environment)
                self.assertEqual(environment["PLX_RELEASE"], "fixture")
                self.assertEqual(environment["CARGO_INCREMENTAL"], "0")
                self.assertEqual(environment["CARGO_BUILD_JOBS"], "1")
                self.assertTrue(Path(environment["PLXNATIVE_RUNTIME_DIR"]).is_dir())
                kwargs["stdout"].write(log.encode())
                if case == "source-changed":
                    (source / "Makefile").write_text("changed\n")
                return subprocess.CompletedProcess(command, 101 if case == "failed" else 0)

            environment = {"RUNNER_TEMP": str(root), "GITHUB_WORKSPACE": str(root), "GITHUB_SHA": "c" * 40,
                           "HOST_THREADS": "0", "PATH": "/fixture", "PLX_STALE": "bad", "RUST_MIN_STACK": "bad"}
            with mock.patch.dict(os.environ, environment, clear=True), \
                    mock.patch.object(Path, "cwd", return_value=source), \
                    mock.patch("subprocess.check_output", side_effect=output), \
                    mock.patch("subprocess.run", side_effect=run), contextlib.redirect_stdout(io.StringIO()):
                if case == "success":
                    # Execute only the workflow parser/orchestrator; every subprocess is mocked.
                    exec(code, {})  # noqa: S102
                else:
                    with self.assertRaises((RuntimeError, subprocess.CalledProcessError)):
                        exec(code, {})  # noqa: S102
            if case == "success":
                binding = json.loads((evidence / "schema-binding.json").read_text())
                self.assertEqual((binding["status"], binding["raw_exit"], binding["descriptor_count"], binding["page_count"]),
                                 ("PASS", 0, 40, 2))
                self.assertEqual(json.loads((evidence / "schema-pages.json").read_text()), pages)
            else:
                self.assertFalse((evidence / "schema-pages.json").exists())
            self.assertEqual(len(spawned), 0 if case in ("cold-target", "wrong-source") else 1)

    def test_companion_build_scrubs_inherited_cargo_configuration(self):
        workflow = yaml.load((ROOT / ".github/workflows/webos-native.yml").read_text(),
                             Loader=yaml.BaseLoader)
        run = next(step["run"] for step in workflow["jobs"]["native-candidate"]["steps"]
                   if '"native/webos/companion/build.py", "build"' in step.get("run", ""))
        code = compile(run.split("python3 - <<'PY'\n", 1)[1].rsplit("\nPY", 1)[0],
                       "actual companion workflow", "exec")
        inherited_overrides = {
            "CARGO_BUILD_RUSTC": "/wrong/rustc", "CARGO_BUILD_RUSTFLAGS": "--cfg wrong",
            "CARGO_BUILD_RUSTC_WRAPPER": "/wrong/wrapper",
            "CARGO_BUILD_RUSTC_WORKSPACE_WRAPPER": "/wrong/workspace",
            "CARGO_BUILD_RUSTDOCFLAGS": "--cfg wrong", "CARGO_BUILD_TARGET": "wrong-target",
            "CARGO_BUILD_TARGET_DIR": "/wrong/build", "CARGO_BUILD_INCREMENTAL": "1",
            "CARGO_TARGET_ARMV7_UNKNOWN_LINUX_GNUEABI_LINKER": "/wrong/linker",
            "CARGO_TARGET_ARMV7_UNKNOWN_LINUX_GNUEABI_RUNNER": "/wrong/runner",
            "CARGO_TARGET_ARMV7_UNKNOWN_LINUX_GNUEABI_RUSTFLAGS": "--cfg wrong",
            "CARGO_PROFILE_RELEASE_OPT_LEVEL": "s", "CARGO_PROFILE_DEV_DEBUG": "0",
            "RUSTC": "/wrong/rustc", "RUSTC_WRAPPER": "/wrong/wrapper",
            "RUSTC_WORKSPACE_WRAPPER": "/wrong/workspace", "RUSTFLAGS": "--cfg wrong",
            "CARGO_ENCODED_RUSTFLAGS": "--cfg\x1fwrong",
        }
        prepared_env = {"CARGO_HOME": "/fixture/cargo", "CARGO_TARGET_DIR": "/fixture/target",
                        "CARGO_BUILD_JOBS": "2", "CARGO_INCREMENTAL": "0",
                        "RUSTUP_TOOLCHAIN": "1.96.1", "CARGO_NET_OFFLINE": "true",
                        "LIBCLANG_PATH": "/fixture/clang"}
        with tempfile.TemporaryDirectory() as directory:
            prepared = {"environment": prepared_env, "target_dir": prepared_env["CARGO_TARGET_DIR"],
                        "libclang": prepared_env["LIBCLANG_PATH"], "rust_sysroot": "/fixture/rust",
                        "rust_source_archive": "/fixture/rust.tar.gz"}
            (Path(directory) / "companion-prepared.json").write_text(json.dumps(prepared))
            preserved = {"RUNNER_TEMP": directory, "PATH": "/usr/bin:/bin", "HOME": "/fixture/home",
                         "RUSTUP_HOME": "/fixture/rustup", "HTTPS_PROXY": "http://proxy.invalid",
                         "WEBOS_SDK": "/fixture/sdk", "WEBOS_SDK_ARCHIVE": "/fixture/sdk.tar.bz2"}
            inherited = {**preserved, **inherited_overrides,
                         **{name: "wrong" for name in prepared_env}, "RUSTUP_AUTO_INSTALL": "1"}
            with mock.patch.dict(os.environ, inherited, clear=True), mock.patch("subprocess.run") as calls:
                # Execute the actual workflow body; both external processes are mocked.
                exec(code, {})  # noqa: S102
                self.assertEqual(dict(os.environ), inherited)
            self.assertEqual(calls.call_count, 2)
            self.assertEqual(calls.call_args_list[0].args[0][1:3],
                             ["native/webos/companion/build.py", "build"])
            self.assertEqual(calls.call_args_list[1].args[0][1], "native/webos/companion/sources.py")
            expected = {**preserved, **prepared_env, "RUSTUP_AUTO_INSTALL": "0"}
            for call in calls.call_args_list:
                self.assertTrue(call.kwargs["check"])
                self.assertEqual(call.kwargs["env"], expected)

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

    def test_cold_prerequisites_are_installed_and_checked_before_host_gates(self):
        workflow = yaml.load((ROOT / ".github/workflows/webos-native.yml").read_text(),
                             Loader=yaml.BaseLoader)
        steps = workflow["jobs"]["native-candidate"]["steps"]
        install = next(i for i, step in enumerate(steps) if "apt-get install" in step.get("run", ""))
        probe = next(i for i, step in enumerate(steps) if "curl_version_info" in step.get("run", ""))
        lint = next(i for i, step in enumerate(steps) if "make check 2>&1" in step.get("run", ""))
        self.assertLess(install, probe)
        self.assertLess(probe, lint)
        command = steps[install]["run"]
        for package in ("openssl", "curl", "libcurl4t64", "libwayland-dev", "libglib2.0-dev"):
            self.assertIn(package, command.split())
        self.assertIn("--force-reinstall --require-hashes --only-binary=:all:", command)
        self.assertIn("Pillow==13.0.0", command)
        self.assertIn("--hash=sha256:8bf295fe459343bc6093c8e5e0df60bfa189e0fcb775a22e2c2488fdeccc6c0d", command)
        for index in (install, probe):
            self.assertNotIn("if", steps[index])
            self.assertNotIn("continue-on-error", steps[index])

    def test_cold_prerequisite_probe_fails_closed(self):
        workflow = yaml.load((ROOT / ".github/workflows/webos-native.yml").read_text(),
                             Loader=yaml.BaseLoader)
        run = next(step["run"] for step in workflow["jobs"]["native-candidate"]["steps"]
                   if "curl_version_info" in step.get("run", ""))
        code = run.split("python3 - <<'PY'\n", 1)[1].rsplit("\nPY", 1)[0]
        for case in ("ok", "no-curl", "no-http2", "no-tls", "no-alpn", "openssl-fails",
                     "no-pillow", "wrong-pillow", "bad-png"):
            with self.subTest(case=case):
                features = (1 << 2) | (1 << 16)
                if case == "no-http2":
                    features &= ~(1 << 16)
                if case == "no-tls":
                    features &= ~(1 << 2)
                library = mock.Mock()
                library.curl_version_info.return_value = types.SimpleNamespace(
                    contents=types.SimpleNamespace(features=features, version=b"fixture"))
                pil = types.ModuleType("PIL")
                pil.__version__ = "wrong" if case == "wrong-pillow" else "13.0.0"
                pil.Image = mock.MagicMock()
                if case == "bad-png":
                    pil.Image.open.side_effect = OSError("invalid PNG")
                with mock.patch("ctypes.CDLL", return_value=library) as load, \
                        mock.patch("ssl.HAS_ALPN", case != "no-alpn"), \
                        mock.patch("ssl.SSLContext") as context, \
                        mock.patch("subprocess.run") as execute, \
                        mock.patch.dict(sys.modules, {"PIL": None if case == "no-pillow" else pil}), \
                        mock.patch("builtins.print"):
                    if case == "no-curl":
                        load.side_effect = OSError("missing libcurl")
                    if case == "openssl-fails":
                        execute.side_effect = subprocess.CalledProcessError(1, ["openssl"])
                    if case == "ok":
                        exec(compile(code, "webos-native.yml prerequisites", "exec"), {})  # noqa: S102
                        load.assert_called_once_with("libcurl.so.4")
                        self.assertEqual(execute.call_args.args[0][:3], ["openssl", "req", "-x509"])
                        self.assertTrue(execute.call_args.kwargs["check"])
                        self.assertEqual(execute.call_args.kwargs["timeout"], 15)
                        context.return_value.set_alpn_protocols.assert_called_once_with(["h2"])
                        context.return_value.load_cert_chain.assert_called_once()
                        pil.Image.open.assert_called_once_with("build/native-webos/source/pkg/largeIcon.png")
                    else:
                        with self.assertRaises((RuntimeError, OSError, ImportError, subprocess.CalledProcessError)):
                            exec(compile(code, "webos-native.yml prerequisites", "exec"), {})  # noqa: S102

    def test_helper_build_and_sources_share_prepared_offline_environment(self):
        workflow = yaml.load((ROOT / ".github/workflows/webos-native.yml").read_text(),
                             Loader=yaml.BaseLoader)
        run = next(step["run"] for step in workflow["jobs"]["native-candidate"]["steps"]
                   if '"native/webos/companion/build.py", "build"' in step.get("run", ""))
        code = run.split("python3 - <<'PY'\n", 1)[1].rsplit("\nPY", 1)[0]
        with tempfile.TemporaryDirectory(prefix="companion workflow ") as directory:
            prepared = {
                "environment": {"CARGO_HOME": directory + "/cargo", "CARGO_NET_OFFLINE": "true",
                                "CARGO_INCREMENTAL": "0", "RUSTUP_TOOLCHAIN": "1.96.1"},
                "target_dir": directory + "/target", "libclang": directory + "/clang",
                "rust_sysroot": directory + "/rust", "rust_source_archive": directory + "/rust.tar.xz",
            }
            (Path(directory) / "companion-prepared.json").write_text(json.dumps(prepared))
            with mock.patch.dict(os.environ, {"RUNNER_TEMP": directory, "WEBOS_SDK": "/sdk fixture",
                                              "WEBOS_SDK_ARCHIVE": "/sdk fixture.tar.bz2",
                                              "CARGO_PROFILE_RELEASE_OPT_LEVEL": "s",
                                              "RUSTFLAGS": "--cfg wrong", "RUSTC_WRAPPER": "/wrong"}), \
                    mock.patch("subprocess.run") as execute:
                # Execute only the checked-in workflow body with process launches mocked.
                exec(compile(code, "webos-native.yml companion", "exec"), {})  # noqa: S102
            self.assertEqual(execute.call_count, 2)
            build, source = execute.call_args_list
            self.assertEqual(build.kwargs["env"], source.kwargs["env"])
            for call in (build, source):
                self.assertIs(call.kwargs["check"], True)
                self.assertFalse(any(key.startswith("CARGO_PROFILE_") for key in call.kwargs["env"]))
                self.assertNotIn("RUSTFLAGS", call.kwargs["env"])
                self.assertNotIn("RUSTC_WRAPPER", call.kwargs["env"])
                self.assertEqual(call.kwargs["env"]["RUSTUP_AUTO_INSTALL"], "0")
                for key, value in prepared["environment"].items():
                    self.assertEqual(call.kwargs["env"][key], value)
            build_args, source_args = build.args[0], source.args[0]
            self.assertEqual(build_args[build_args.index("--output") + 1],
                             source_args[source_args.index("--bundle") + 1])
            self.assertEqual(build_args[build_args.index("--sdk-archive") + 1], "/sdk fixture.tar.bz2")
            self.assertEqual(source_args[source_args.index("--rust-source-archive") + 1],
                             prepared["rust_source_archive"])



class NativeBuildBenchWorkflowTests(unittest.TestCase):
    def workflow(self):
        return yaml.load((ROOT / ".github/workflows/webos-native.yml").read_text(),
                         Loader=yaml.BaseLoader)

    def bench_code(self):
        steps = self.workflow()["jobs"]["native-build-bench"]["steps"]
        run = next(step["run"] for step in steps if "<<'PYBENCH'" in step.get("run", ""))
        return run.split("python3 - <<'PYBENCH'\n", 1)[1].rsplit("\nPYBENCH", 1)[0]

    def diagnostic_fixture(self, root):
        import hashlib

        target = root / "tools/build-bench.py"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("# synthetic benchmark target; never executed\n")
        hook = root / "external-hook/sitecustomize.py"
        hook.parent.mkdir()
        hook.write_bytes((ROOT / "scripts/webos-native-bench-diagnostics/sitecustomize.py").read_bytes())
        return target, hook, hashlib.sha256(target.read_bytes()).hexdigest(), hashlib.sha256(hook.read_bytes()).hexdigest()

    def mocked_bench_activation(self, environment):
        """The mocked make process publishes its child-observer receipt."""
        import hashlib

        context = json.loads(environment["OTT_NATIVE_BENCH_DIAGNOSTICS"])
        hook = Path(environment["PYTHONPATH"].split(os.pathsep)[0]) / "sitecustomize.py"
        target = Path(context["target"]).resolve()
        receipt = {"schema": 1, "target": str(target),
                   "target_sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                   "hook_sha256": hashlib.sha256(hook.read_bytes()).hexdigest()}
        (Path(context["output"]) / "activation.json").write_text(json.dumps(receipt))

    def test_bench_is_explicit_dispatch_only_and_read_only(self):
        workflow = self.workflow()
        inputs = workflow["on"]["workflow_dispatch"]["inputs"]
        self.assertEqual(inputs["build_bench"]["type"], "boolean")
        self.assertEqual(inputs["build_bench"]["default"], "false")
        for name in ("bench_base_ref", "bench_base_tree", "bench_head_ref", "bench_head_tree"):
            with self.subTest(input=name):
                self.assertEqual(inputs[name]["type"], "string")
                # Ordinary dispatch remains usable without benchmark-only pins.
                self.assertEqual(inputs[name]["required"], "false")
                self.assertNotIn("default", inputs[name])
        self.assertEqual(workflow["permissions"], {"contents": "read"})
        self.assertEqual(workflow["jobs"]["native-build-bench"].get("cache-mode"), "none")
        predicate = "github.event_name == 'workflow_dispatch' && inputs.build_bench"
        self.assertEqual(workflow["jobs"]["native-build-bench"]["if"], "${{ " + predicate + " }}")
        self.assertEqual(workflow["jobs"]["contracts"]["if"], "${{ !(" + predicate + ") }}")

    def test_bench_does_not_change_normal_gate_dependency_or_limits(self):
        jobs = self.workflow()["jobs"]
        self.assertEqual(jobs["native-candidate"]["needs"], "contracts")
        self.assertEqual(jobs["native-candidate"]["if"], "${{ needs.contracts.outputs.build == 'true' }}")
        self.assertEqual(jobs["native-candidate"]["timeout-minutes"], "90")
        self.assertEqual(jobs["contracts"]["timeout-minutes"], "5")
        self.assertNotIn("continue-on-error", jobs["native-build-bench"])
        self.assertNotIn("needs", jobs["native-build-bench"])
        self.assertEqual(jobs["native-build-bench"]["runs-on"], "ubuntu-24.04-arm")
        for job in jobs.values():
            self.assertNotIn("permissions", job)  # inherit the read-only workflow grant

    def test_bench_concurrency_cannot_cancel_ordinary_ci(self):
        group = self.workflow()["concurrency"]["group"]
        self.assertEqual(group, "webos-native-${{ github.event_name == 'workflow_dispatch' && inputs.build_bench && 'bench-' || '' }}${{ github.event.pull_request.number || github.ref }}")
        ref = "refs/heads/fixture"
        ordinary = "webos-native-" + ref
        benchmark = "webos-native-bench-" + ref
        self.assertNotEqual(ordinary, benchmark)

    def test_bench_binds_exact_base_and_dispatch_head_tree(self):
        job = self.workflow()["jobs"]["native-build-bench"]
        checkouts = [step for step in job["steps"] if step.get("uses", "").startswith("actions/checkout@")]
        self.assertEqual(len(checkouts), 2)
        self.assertNotIn("ref", checkouts[0]["with"])
        self.assertEqual(checkouts[1]["with"]["ref"], "${{ inputs.bench_base_ref }}")
        self.assertEqual(checkouts[1]["with"]["path"], "benchmark-before")
        preflight = next(step for step in job["steps"]
                         if step.get("name") == "Require the reviewed comparison pins")
        self.assertLess(job["steps"].index(preflight), job["steps"].index(checkouts[1]))
        self.assertEqual(preflight["shell"], "bash")
        self.assertIn("set -euo pipefail", preflight["run"])
        self.assertIn('for pin in "$BENCH_BASE_REF" "$BENCH_BASE_TREE" "$BENCH_HEAD_REF" "$BENCH_HEAD_TREE";', preflight["run"])
        self.assertIn('[[ "$pin" =~ ^[0-9a-f]{40}$ ]]', preflight["run"])
        self.assertIn('test "$BENCH_HEAD_REF" = "$GITHUB_SHA"', preflight["run"])
        self.assertIn('test "$BENCH_BASE_REF" != "$BENCH_HEAD_REF"', preflight["run"])
        for field in ("base_ref", "base_tree", "head_ref", "head_tree"):
            self.assertEqual(job["env"]["BENCH_" + field.upper()], "${{ inputs.bench_" + field + " }}")
        code = self.bench_code()
        self.assertIn("if prepared['tree'] != expected_tree:", code)
        self.assertIn("if git(outer, 'rev-parse', 'HEAD') != outer_sha:", code)
        self.assertIn("builder_sha256=digest(mod_path)", code)

    def test_bench_selected_base_and_shared_helpers_are_bound_before_phases(self):
        import ast

        body = ast.parse(self.bench_code()).body
        end = next(i for i, node in enumerate(body) if isinstance(node, ast.For)
                   and isinstance(node.target, ast.Tuple) and node.target.elts[0].id == "label")
        # Retain actual preflight/phase construction; replace only the file-import adapter.
        prefix = [node for node in body[:end] if not (
            isinstance(node, ast.FunctionDef) and node.name == "load_builder")]
        code = compile(ast.Module(body=prefix, type_ignores=[]), "benchmark phase preflight", "exec")
        for missing in (None, "cargo_environment", "check_cargo_configs"):
            for malformed in (False, True) if missing else (False,):
                with self.subTest(missing=missing, malformed=malformed), tempfile.TemporaryDirectory() as directory:
                    root = Path(directory).resolve()
                    source = root / "native/webos/build.py"
                    source.parent.mkdir(parents=True)
                    source.write_text("# synthetic helper identity\n")
                    hook = root / "scripts/webos-native-bench-diagnostics/sitecustomize.py"
                    hook.parent.mkdir(parents=True)
                    hook.write_bytes((ROOT / "scripts/webos-native-bench-diagnostics/sitecustomize.py").read_bytes())
                    helpers = {name: mock.Mock() for name in ("cargo_environment", "check_cargo_configs")}
                    if missing:
                        if malformed:
                            helpers[missing] = "not callable"
                        else:
                            del helpers[missing]
                    owner = types.SimpleNamespace(**helpers)
                    load = mock.Mock(return_value=owner)
                    scope = {"load_builder": load}
                    environment = {"GITHUB_WORKSPACE": str(root), "RUNNER_TEMP": str(root),
                                   "BENCH_BASE_REF": "a" * 40, "BENCH_BASE_TREE": "b" * 40,
                                   "BENCH_HEAD_REF": "c" * 40, "BENCH_HEAD_TREE": "d" * 40,
                                   "GITHUB_SHA": "c" * 40}
                    with mock.patch.dict(os.environ, environment, clear=True), \
                            mock.patch("subprocess.run") as run, \
                            mock.patch("subprocess.check_output", return_value="c" * 40 + "\n") as output:
                        if missing:
                            with self.assertRaises(ValueError):
                                exec(code, scope)  # noqa: S102 - Actual preflight, import adapter mocked.
                        else:
                            exec(code, scope)  # noqa: S102
                            self.assertEqual(scope["phases"], [
                                ("before", root / "benchmark-before", "a" * 40, "b" * 40),
                                ("after", root, "c" * 40, "d" * 40)])
                            self.assertIs(scope["environment_builder"], owner)
                        load.assert_called_once_with(root)
                        run.assert_not_called()
                        output.assert_called_once_with(["git", "-C", str(root), "rev-parse", "HEAD"], text=True)

    def test_invalid_bench_pins_refuse_before_any_process(self):
        code = compile(self.bench_code(), "webos-native.yml benchmark", "exec")
        valid = {"BENCH_BASE_REF": "a" * 40, "BENCH_BASE_TREE": "b" * 40,
                 "BENCH_HEAD_REF": "c" * 40, "BENCH_HEAD_TREE": "d" * 40,
                 "GITHUB_SHA": "c" * 40}
        cases = [(key + ":" + value, {key: value}) for key in valid if key != "GITHUB_SHA"
                 for value in ("", "main", "B" * 40, "a" * 39, "a" * 41)]
        cases += [("head-mismatch", {"GITHUB_SHA": "e" * 40}),
                  ("same-base-and-head", {"BENCH_BASE_REF": "c" * 40})]
        for name, changed in cases:
            with self.subTest(case=name), tempfile.TemporaryDirectory() as directory:
                environment = dict(valid, GITHUB_WORKSPACE=directory, RUNNER_TEMP=directory, **changed)
                with mock.patch.dict(os.environ, environment, clear=True), \
                        mock.patch("subprocess.run") as run, \
                        mock.patch("subprocess.check_output") as output:
                    reason = "must be full object IDs"
                    if name == "head-mismatch":
                        reason = "Dispatch commit differs from the reviewed head"
                    elif name == "same-base-and-head":
                        reason = "Before and after must be different outer commits"
                    with self.assertRaisesRegex(ValueError, reason):
                        # Invalid-input preflight; process APIs are mocked.
                        exec(code, {})  # noqa: S102
                    run.assert_not_called()
                    output.assert_not_called()

    def test_bench_result_predicate_rejects_partial_failed_or_zero_samples(self):
        import ast
        import copy
        import math
        node = next(node for node in ast.parse(self.bench_code()).body
                    if isinstance(node, ast.FunctionDef) and node.name == "checked_document")
        scope = {"json": json, "math": math}
        exec(compile(ast.Module(body=[node], type_ignores=[]), "benchmark result predicate", "exec"), scope)  # noqa: S102
        good = {"failure": None, "red": [], "restored_clean": True, "via_make": True, "runs": 3,
                "sizes": {"dirs": [{"dir": "target", "mb": 1.5}], "count": 1, "total_mb": 1.5},
                "scenarios": [{"id": "noop", "status": "ok", "samples": [
                    {"seconds": 1.0, "app_rebuilt": False} for _ in range(3)]},
                    {"id": "sizes", "status": "ok", "samples": []}]}
        for case in ("good", "missing", "extra", "duplicate", "failed", "skipped", "short", "zero",
                     "nonfinite", "failure", "red", "not-restored", "not-make", "wrong-runs", "dirty-noop"):
            doc = copy.deepcopy(good)
            if case == "missing": doc["scenarios"].pop()
            if case == "extra": doc["scenarios"].append({"id": "arm", "status": "ok", "samples": []})
            if case == "duplicate": doc["scenarios"].append(copy.deepcopy(doc["scenarios"][0]))
            if case in ("failed", "skipped"): doc["scenarios"][0]["status"] = case
            if case == "short": doc["scenarios"][0]["samples"].pop()
            if case == "zero": doc["scenarios"][0]["samples"] = []
            if case == "nonfinite": doc["scenarios"][0]["samples"][0]["seconds"] = float("nan")
            if case == "failure": doc["failure"] = "synthetic failure"
            if case == "red": doc["red"] = ["noop"]
            if case == "not-restored": doc["restored_clean"] = False
            if case == "not-make": doc["via_make"] = False
            if case == "wrong-runs": doc["runs"] = 1
            if case == "dirty-noop": doc["scenarios"][0]["samples"][0]["app_rebuilt"] = True
            with self.subTest(case=case), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "result.json"
                path.write_text(json.dumps(doc))
                if case == "good":
                    self.assertEqual(scope["checked_document"](path, ["noop", "sizes"], 3), doc)
                else:
                    with self.assertRaises(ValueError):
                        scope["checked_document"](path, ["noop", "sizes"], 3)

    def test_bench_sizes_requires_positive_finite_typed_measurement(self):
        import ast
        import math

        node = next(node for node in ast.parse(self.bench_code()).body
                    if isinstance(node, ast.FunctionDef) and node.name == "checked_document")
        scope = {"json": json, "math": math}
        # Execute only the workflow's pure result predicate, never its benchmark body.
        exec(compile(ast.Module(body=[node], type_ignores=[]), "benchmark sizes predicate", "exec"), scope)  # noqa: S102
        invalid = [None, [], True, {}, {"count": 1}, {"total_mb": 1.5}]
        invalid += [{"count": count, "total_mb": 1.5} for count in (0, -1, True, False, 1.0, "1")]
        invalid += [{"count": 1, "total_mb": total} for total in
                    (0, -1, True, False, "1.5", None, float("nan"), float("inf"), -float("inf"))]
        cases = [("absent", False, None, False)]
        cases += [(f"invalid-{index}", True, value, False) for index, value in enumerate(invalid)]
        cases += [("integer", True, {"count": 1, "total_mb": 1}, True),
                  ("fractional", True, {"count": 2, "total_mb": 1.5}, True)]
        for name, present, sizes, accepted in cases:
            with self.subTest(case=name), tempfile.TemporaryDirectory() as directory:
                doc = {"failure": None, "red": [], "restored_clean": True, "via_make": True,
                       "runs": 3, "scenarios": [{"id": "sizes", "status": "ok", "samples": []}]}
                if present:
                    doc["sizes"] = sizes
                path = Path(directory) / "result.json"
                path.write_text(json.dumps(doc))
                if accepted:
                    self.assertEqual(scope["checked_document"](path, ["sizes"], 3), doc)
                else:
                    with self.assertRaisesRegex(ValueError, "sizes measurement"):
                        scope["checked_document"](path, ["sizes"], 3)
        # The separate check-only document does not request or measure target sizes.
        with tempfile.TemporaryDirectory() as directory:
            doc = {"failure": None, "red": [], "restored_clean": True, "via_make": True,
                   "runs": 1, "sizes": None,
                   "scenarios": [{"id": "check", "status": "ok", "samples": [{"seconds": 1.0}]}]}
            path = Path(directory) / "result.json"
            path.write_text(json.dumps(doc))
            self.assertEqual(scope["checked_document"](path, ["check"], 1), doc)

    def test_bench_scrubs_overrides_at_both_measured_commands(self):
        import ast
        from contextlib import nullcontext

        node = next(node for node in ast.walk(ast.parse(self.bench_code()))
                    if isinstance(node, ast.With) and any(
                        isinstance(item.context_expr, ast.Call)
                        and isinstance(item.context_expr.func, ast.Attribute)
                        and item.context_expr.func.attr == "cargo_environment"
                        for item in node.items))
        code = compile(ast.Module(body=[node], type_ignores=[]), "actual measured commands", "exec")
        overrides = {
            "RUSTFLAGS": "--cfg wrong", "CARGO_ENCODED_RUSTFLAGS": "--cfg\x1fwrong",
            "RUSTDOCFLAGS": "--cfg wrong", "CARGO_ENCODED_RUSTDOCFLAGS": "--cfg\x1fwrong",
            "RUSTC": "/wrong/rustc", "RUSTDOC": "/wrong/rustdoc",
            "RUSTC_WRAPPER": "/wrong/wrapper", "RUSTC_WORKSPACE_WRAPPER": "/wrong/workspace",
            "RUSTC_BOOTSTRAP": "1", "RUSTUP_TOOLCHAIN": "wrong-toolchain",
            "CARGO_PROFILE_DEV_OPT_LEVEL": "3", "CARGO_PROFILE_TEST_DEBUG": "0",
            "CARGO_PROFILE_RELEASE_OPT_LEVEL": "s", "CARGO_PROFILE_BENCH_LTO": "fat",
            "CARGO_BUILD_RUSTFLAGS": "--cfg wrong", "CARGO_BUILD_RUSTDOCFLAGS": "--cfg wrong",
            "CARGO_BUILD_RUSTC": "/wrong/rustc", "CARGO_BUILD_RUSTC_WRAPPER": "/wrong/wrapper",
            "CARGO_BUILD_RUSTC_WORKSPACE_WRAPPER": "/wrong/workspace",
            "CARGO_BUILD_TARGET": "wrong-target", "CARGO_BUILD_TARGET_DIR": "/wrong/build",
            "CARGO_BUILD_INCREMENTAL": "1", "CARGO_TARGET_DIR": "/wrong/target",
            "CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_RUSTFLAGS": "--cfg wrong",
            "CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER": "/wrong/linker",
            "CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_RUNNER": "/wrong/runner",
            "RUST_TOOLCHAIN": "wrong-toolchain", "RUST_TARGET": "wrong-target",
            "RUST_TDIR": "/wrong/target", "RUST_FEATFLAGS": "--features wrong",
            "RUST_ENV": "RUSTFLAGS=wrong", "RUST_CODEGEN": "wrong",
            "RUST_DEBUGINFO": "wrong", "RUST_CAPLINTS": "wrong", "RUST_REMAP": "wrong",
            "MAKEFLAGS": "-e RUSTFLAGS=wrong", "GNUMAKEFLAGS": "-e",
            "MAKEOVERRIDES": "RUSTFLAGS=wrong", "MAKEFILES": "/wrong/Makefile",
            "MFLAGS": "-e", "MAKELEVEL": "9", "CARGO_MAKEFLAGS": "--jobserver-auth=90,91",
        }
        preserved = {"PATH": "/usr/bin:/bin", "HOME": "/fixture/home",
                     "RUSTUP_HOME": "/fixture/toolchains", "HTTPS_PROXY": "http://proxy.invalid",
                     "CARGO_NET_OFFLINE": "true"}
        explicit = {"CARGO_HOME": "/fixture/isolated", "CARGO_INCREMENTAL": "0",
                    "PLX_CARGO_SEED": "off", "HOST_THREADS": "0", "RELEASE": "",
                    "PLX_TEST_JOBS": "2", "JOBS": "2", "CARGO_BUILD_JOBS": "2"}
        for label in ("before", "after"):
            with self.subTest(label=label), tempfile.TemporaryDirectory() as directory:
                inherited = dict(preserved, **overrides, **{key: "wrong" for key in explicit})
                original = dict(inherited)
                # The ARM producer's settings must not become host benchmark overrides.
                isolated = {"CARGO_HOME": explicit["CARGO_HOME"], "RELEASE": "1",
                            "CARGO_PROFILE_RELEASE_OPT_LEVEL": "s", "ARM_PROFILE": "release"}
                environment_builder = types.SimpleNamespace(cargo_environment=mock.Mock(return_value=nullcontext(isolated)))
                document = {"git_sha": "a" * 12, "tree_dirty": False, "toolchain": "pinned",
                            "host": "same", "runner": "same"}
                binding = {"documents": {}}
                _, diagnostic_hook, tool_hash, diagnostic_hash = self.diagnostic_fixture(Path(directory))
                scope = {"builder": types.SimpleNamespace(), "environment_builder": environment_builder,
                         "args": object(), "os": os,
                         "subprocess": subprocess, "evidence": Path(directory), "label": label,
                         "rows": "noop,sizes", "source": Path(directory), "bench_commit": "a" * 40,
                         "checked_document": mock.Mock(return_value=document), "binding": binding,
                         "digest": lambda path: "f" * 64, "json": json, "sys": sys,
                         "diagnostic_hook": diagnostic_hook.parent, "tool_hash": tool_hash,
                         "diagnostic_hash": diagnostic_hash}
                with mock.patch.dict(os.environ, inherited, clear=True), mock.patch("subprocess.run") as run:
                    run.side_effect = lambda *args, **kwargs: self.mocked_bench_activation(kwargs["env"])
                    exec(code, scope)  # noqa: S102 - Actual workflow AST; process execution is mocked.
                    self.assertEqual(dict(os.environ), original)
                environment_builder.cargo_environment.assert_called_once_with(scope["args"])
                self.assertEqual(run.call_count, 2)
                for call, suffix, count, selected in zip(run.call_args_list,
                                                        ("rows", "check"), (3, 1), ("noop,sizes", "check")):
                    self.assertEqual(call.args[0], ["make", "build-bench",
                        f"ARGS=--runs {count} --only {selected} --json {Path(directory) / (label+'-'+suffix+'.json')}"])
                    self.assertTrue(call.kwargs["check"])
                    environment = call.kwargs["env"]
                    for key in overrides:
                        with self.subTest(label=label, suffix=suffix, removed=key):
                            self.assertNotIn(key, environment)
                    for key, value in dict(preserved, **explicit).items():
                        self.assertEqual(environment[key], value, key)
                    self.assertNotIn("ARM_PROFILE", environment)
                self.assertEqual(set(binding["documents"]), {"rows", "check"})

    def test_bench_observer_retains_failed_cargo_evidence_for_both_phases(self):
        for label in ("before", "after"):
            for suffix in ("rows", "check"):
                with self.subTest(label=label, suffix=suffix):
                    self._check_diagnostic_workflow(label, suffix, "valid", failed=True, observe=True)

    def test_bench_success_requires_valid_observer_activation(self):
        for label in ("before", "after"):
            for suffix in ("rows", "check"):
                for receipt in ("missing", "malformed", "mismatch"):
                    with self.subTest(label=label, suffix=suffix, receipt=receipt):
                        self._check_diagnostic_workflow(label, suffix, receipt, failed=False)

    def test_bench_activation_failure_preserves_original_make_failure(self):
        for label in ("before", "after"):
            for suffix in ("rows", "check"):
                for receipt in ("missing", "malformed", "mismatch"):
                    with self.subTest(label=label, suffix=suffix, receipt=receipt):
                        self._check_diagnostic_workflow(label, suffix, receipt, failed=True)

    def _check_diagnostic_workflow(self, label, suffix, receipt, *, failed, observe=False):
        import ast
        import hashlib
        import io
        from contextlib import nullcontext

        node = next(node for node in ast.walk(ast.parse(self.bench_code()))
                    if isinstance(node, ast.With) and any(
                        isinstance(item.context_expr, ast.Call)
                        and isinstance(item.context_expr.func, ast.Attribute)
                        and item.context_expr.func.attr == "cargo_environment"
                        for item in node.items))
        code = compile(ast.Module(body=[node], type_ignores=[]), "actual diagnostic measurement loop", "exec")
        with tempfile.TemporaryDirectory() as directory:
            # Match the resolved target/hook receipt paths; macOS /var is a symlink.
            root = Path(directory).resolve()
            target, hook, tool_hash, hook_hash = self.diagnostic_fixture(root / "source")
            original_target = target.read_bytes()
            evidence = root / "evidence"
            evidence.mkdir()
            binding = {"documents": {}}
            doc = {"git_sha": "a" * 12, "tree_dirty": False,
                   "toolchain": "pinned", "host": "same", "runner": "same"}
            checked = mock.Mock(return_value=doc)
            scope = {"environment_builder": types.SimpleNamespace(
                         cargo_environment=mock.Mock(return_value=nullcontext({"CARGO_HOME": "/unused"}))),
                     "args": object(), "os": os, "sys": sys, "json": json,
                     "subprocess": subprocess, "evidence": evidence, "label": label,
                     "rows": "noop,sizes", "source": target.parent.parent,
                     "bench_commit": "a" * 40, "binding": binding, "checked_document": checked,
                     "digest": lambda path: "f" * 64, "diagnostic_hook": hook.parent,
                     "tool_hash": tool_hash, "diagnostic_hash": hook_hash}
            make_failure = subprocess.CalledProcessError(2, ["make", "build-bench"])
            cargo_stdout = '{"reason":"compiler-message","message":{"rendered":"full error"}}\n' * 40
            cargo_stderr = "first diagnostic\n" + "tail" * 300
            expected_calls = 1 if suffix == "rows" else 2

            def make(*args, **kwargs):
                self.assertEqual(args[0][:2], ["make", "build-bench"])
                self.assertTrue(kwargs["check"])
                context = json.loads(kwargs["env"]["OTT_NATIVE_BENCH_DIAGNOSTICS"])
                destination = Path(context["output"])
                self.assertEqual(context["target"], str(target))
                self.assertEqual(context["pythonpath"], "/original/pythonpath")
                self.assertEqual(kwargs["env"]["PYTHONPATH"], str(hook.parent) + os.pathsep + "/original/pythonpath")
                current = "rows" if destination.name.endswith("-rows-diagnostics") else "check"
                self.assertEqual(destination, evidence / (label + "-" + current + "-diagnostics"))
                self.assertIn(f"--runs {3 if current == 'rows' else 1}", args[0][2])
                kwargs["stdout"].write(b"synthetic make log\n")
                if current != suffix:
                    self.mocked_bench_activation(kwargs["env"])
                    return subprocess.CompletedProcess(args[0], 0)
                if observe:
                    # Run the real injected observer in-process, with its only process adapter
                    # mocked. This models Python startup, not a Cargo/toolchain execution.
                    cargo_argv = ["cargo", "+pinned", "build", "--message-format=json"]
                    result = subprocess.CompletedProcess(cargo_argv, 101, cargo_stdout, cargo_stderr)
                    with mock.patch.dict(os.environ, kwargs["env"], clear=True), \
                            mock.patch.object(sys, "argv", [str(target)]), \
                            mock.patch.object(sys, "path", [str(hook.parent), *sys.path]), \
                            mock.patch("subprocess.run", return_value=result) as child:
                        exec(compile(hook.read_bytes(), str(hook), "exec"),
                             {"__file__": str(hook), "__name__": "sitecustomize"})  # noqa: S102
                        self.assertNotIn("OTT_NATIVE_BENCH_DIAGNOSTICS", os.environ)
                        self.assertEqual(os.environ["PYTHONPATH"], "/original/pythonpath")
                        self.assertNotIn(str(hook.parent), sys.path)
                        self.assertIs(subprocess.run(cargo_argv, capture_output=True, text=True), result)
                        child.assert_called_once_with(cargo_argv, capture_output=True, text=True)
                elif receipt != "missing":
                    self.mocked_bench_activation(kwargs["env"])
                    activation = destination / "activation.json"
                    if receipt == "malformed":
                        activation.write_text("not JSON")
                    elif receipt == "mismatch":
                        value = json.loads(activation.read_text())
                        value["target_sha256"] = "0" * 64
                        activation.write_text(json.dumps(value))
                if failed:
                    raise make_failure
                return subprocess.CompletedProcess(args[0], 0)

            original_env = {"PATH": "/usr/bin:/bin", "PYTHONPATH": "/original/pythonpath"}
            with mock.patch.dict(os.environ, original_env, clear=True), \
                    mock.patch("subprocess.run", side_effect=make) as process, \
                    mock.patch("subprocess.check_output") as output, \
                    mock.patch("sys.stderr", new_callable=io.StringIO) as errors:
                expected_error = subprocess.CalledProcessError if failed else (
                    FileNotFoundError if receipt == "missing" else ValueError)
                with self.assertRaises(expected_error) as caught:
                    exec(code, scope)  # noqa: S102 - Actual workflow, make and Cargo mocked.
                if failed:
                    self.assertIs(caught.exception, make_failure)
                self.assertEqual(dict(os.environ), original_env)
                self.assertEqual(process.call_count, expected_calls)
                output.assert_not_called()
                self.assertEqual("Benchmark diagnostics unavailable:" in errors.getvalue(),
                                 failed and receipt != "valid")
            self.assertEqual(checked.call_count, expected_calls - 1)
            self.assertEqual(set(binding["documents"]), set() if suffix == "rows" else {"rows"})
            self.assertEqual(target.read_bytes(), original_target)
            self.assertFalse((evidence / "complete-pair.json").exists())
            self.assertEqual((evidence / (label + "-" + suffix + ".log")).read_bytes(), b"synthetic make log\n")
            if observe:
                destination = evidence / (label + "-" + suffix + "-diagnostics")
                activation = json.loads((destination / "activation.json").read_text())
                self.assertEqual(activation, {"schema": 1, "target": str(target.resolve()),
                                             "target_sha256": tool_hash, "hook_sha256": hook_hash})
                failures = list(destination.glob("cargo-*/result.json"))
                self.assertEqual(len(failures), 1)
                failure = json.loads(failures[0].read_text())
                self.assertEqual(failure["returncode"], 101)
                self.assertEqual(failure["command"], ["cargo", "+pinned", "build", "--message-format=json"])
                for stream, text in (("stdout", cargo_stdout), ("stderr", cargo_stderr)):
                    raw = text.encode("utf-8")
                    self.assertEqual((failures[0].parent / stream).read_bytes(), raw)
                    self.assertEqual(failure["streams"][stream], {
                        "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw), "text": True})

    def test_bench_keeps_exact_tree_snapshot_and_restores_in_finally(self):
        import ast
        code = self.bench_code()
        nodes = list(ast.walk(ast.parse(code)))
        final = next(node.finalbody for node in nodes if isinstance(node, ast.Try) and node.finalbody)
        self.assertIn("git(source, 'update-ref', '--no-deref', 'HEAD', upstream, bench_commit)",
                      ast.unparse(final))
        self.assertIn("builder.check_source(args, manifest)", ast.unparse(final))
        self.assertIn("environment_builder.check_cargo_configs(source, expected_tree)", ast.unparse(final))
        self.assertIn("git(source, 'commit-tree', measured_tree, '-p', upstream", code)
        self.assertIn("'update-ref', '--no-deref', 'HEAD', bench_commit, upstream", code)
        self.assertIn("with environment_builder.cargo_environment(args) as isolated:", code)
        self.assertIn("synthetic_benchmark_commit=bench_commit", code)
        self.assertIn("original_prepared_tree=expected_tree, measured_tree=measured_tree", code)
        self.assertIn("measured_tree = expected_tree", code)
        self.assertNotIn("reset --hard", code)
        self.assertNotIn("git push", code)

    def test_bench_never_overlays_or_rewrites_the_selected_source_tree(self):
        import ast

        code = self.bench_code()
        self.assertNotIn("fpflags-fixture.patch", code)
        self.assertNotIn("tests/test_harness.py", code)
        self.assertNotIn("fixture_correction", code)
        calls = [node for node in ast.walk(ast.parse(code)) if isinstance(node, ast.Call)
                 and isinstance(node.func, ast.Name) and node.func.id == "git"]
        commands = [node.args[1].value for node in calls if len(node.args) > 1
                    and isinstance(node.args[1], ast.Constant)]
        self.assertTrue(commands)
        self.assertFalse(set(commands) & {"apply", "restore", "write-tree", "reset", "checkout"})

    def test_bench_each_phase_uses_its_own_producer_without_new_environment_methods(self):
        import ast

        phase = next(node for node in ast.parse(self.bench_code()).body if isinstance(node, ast.For)
                     and isinstance(node.target, ast.Tuple) and node.target.elts[0].id == "label")
        end = next(i for i, node in enumerate(phase.body) if isinstance(node, ast.Expr)
                   and isinstance(node.value, ast.Call) and isinstance(node.value.func, ast.Attribute)
                   and node.value.func.attr == "bootstrap")
        loop = ast.For(target=phase.target, iter=phase.iter, body=phase.body[:end + 1], orelse=[])
        code = compile(ast.fix_missing_locations(ast.Module(body=[loop], type_ignores=[])),
                       "benchmark phase producers", "exec")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            phases, builders = [], {}
            for label, ref, tree in (("before", "a" * 40, "b" * 40), ("after", "c" * 40, "d" * 40)):
                outer, source = root / label, root / (label + "-source")
                outer.mkdir()
                source.mkdir()
                prepared = outer / "prepared.json"
                prepared.write_text(json.dumps({"tree": tree}))
                manifest = {"sdk": {"directory": "same-sdk"}}
                builders[outer] = types.SimpleNamespace(
                    manifest=mock.Mock(return_value=manifest), prepare=mock.Mock(),
                    check_source=mock.Mock(return_value=source),
                    source_receipt=mock.Mock(return_value=prepared), bootstrap=mock.Mock())
                phases.append((label, outer, ref, tree))
            load = mock.Mock(side_effect=lambda outer: builders[outer])
            helper = types.SimpleNamespace(check_cargo_configs=mock.Mock())
            refs = {outer: ref for _, outer, ref, _ in phases}
            git = mock.Mock(side_effect=lambda outer, *args: refs[outer])
            scope = {"phases": phases, "load_builder": load, "git": git, "work": root / "work",
                     "sdk_contract": None, "environment_builder": helper,
                     "SimpleNamespace": types.SimpleNamespace, "json": json}
            with mock.patch("subprocess.run") as run, mock.patch("subprocess.check_output") as output:
                exec(code, scope)  # noqa: S102 - Only actual phase setup, every producer/process adapter mocked.
                run.assert_not_called()
                output.assert_not_called()
            self.assertEqual(load.call_args_list, [mock.call(phase[1]) for phase in phases])
            for label, outer, _, tree in phases:
                producer = builders[outer]
                self.assertFalse(hasattr(producer, "cargo_environment"))
                self.assertFalse(hasattr(producer, "check_cargo_configs"))
                producer.manifest.assert_called_once_with()
                arguments, manifest = producer.prepare.call_args.args
                self.assertEqual(arguments.work_dir, root / "work" / label)
                producer.prepare.assert_called_once_with(arguments, manifest)
                producer.check_source.assert_called_once_with(arguments, manifest)
                producer.bootstrap.assert_called_once_with(arguments, manifest)
                helper.check_cargo_configs.assert_any_call(producer.check_source.return_value, tree)

    def test_bench_is_sequential_supported_make_subset_with_raw_evidence(self):
        code = self.bench_code()
        self.assertIn("rows = 'noop,leaf,machine,platform,gfx,net,ui,plex,telemetry,data,session,media,appkit,screens,app,hub,sizes'", code)
        self.assertIn("for label, outer, outer_sha, expected_tree in phases:", code)
        self.assertIn("[('rows', rows, 3), ('check', 'check', 1)]", code)
        self.assertIn("['make', 'build-bench'", code)
        self.assertIn("stderr=subprocess.STDOUT, check=True", code)
        self.assertIn("if benchmark_hash is not None and benchmark_hash != tool_hash:", code)
        self.assertIn("('toolchain','host','runner')", code)
        self.assertIn("'complete-pair.json'", code)
        job = self.workflow()["jobs"]["native-build-bench"]
        self.assertNotIn("strategy", job)
        upload = job["steps"][-1]
        self.assertEqual(upload["if"], "always()")
        self.assertEqual(upload["with"]["if-no-files-found"], "error")
        self.assertEqual(upload["with"]["name"], "native-build-bench-${{ github.sha }}")


    def test_bench_requires_the_edited_crate_to_rebuild(self):
        import ast
        import copy
        import math
        node = next(node for node in ast.parse(self.bench_code()).body
                    if isinstance(node, ast.FunctionDef) and node.name == "checked_document")
        scope = {"json": json, "math": math}
        exec(compile(ast.Module(body=[node], type_ignores=[]), "benchmark result predicate", "exec"), scope)  # noqa: S102
        # Existing build-bench edit targets and Cargo's owning-crate evidence.
        # UI's hub must rebuild UI; it need not rebuild every downstream crate.
        targets = (("app", "app_rebuilt"), ("leaf", "base_rebuilt"),
                   ("machine", "machine_rebuilt"), ("platform", "platform_rebuilt"),
                   ("gfx", "gfx_rebuilt"), ("net", "net_rebuilt"), ("ui", "ui_rebuilt"),
                   ("telemetry", "telemetry_rebuilt"),
                   ("plex", "plex_rebuilt"), ("data", "data_rebuilt"),
                   ("session", "session_rebuilt"), ("media", "media_rebuilt"),
                   ("appkit", "appkit_rebuilt"), ("screens", "screens_rebuilt"),
                   ("hub", "ui_rebuilt"))
        for row_id, flag in targets:
            good = {"failure": None, "red": [], "restored_clean": True,
                    "via_make": True, "runs": 3, "scenarios": [{
                        "id": row_id, "status": "ok", "samples": [
                            {"seconds": 1.0, flag: True} for _ in range(3)]}]}
            for outcome in ("rebuilt", "one-not-rebuilt", "missing", "not-a-boolean"):
                doc = copy.deepcopy(good)
                if outcome == "one-not-rebuilt":
                    doc["scenarios"][0]["samples"][1][flag] = False
                if outcome == "missing":
                    doc["scenarios"][0]["samples"][1].pop(flag)
                if outcome == "not-a-boolean":
                    doc["scenarios"][0]["samples"][1][flag] = "true"
                with self.subTest(row=row_id, outcome=outcome), tempfile.TemporaryDirectory() as directory:
                    path = Path(directory) / "result.json"
                    path.write_text(json.dumps(doc))
                    if outcome == "rebuilt":
                        self.assertEqual(scope["checked_document"](path, [row_id], 3), doc)
                    else:
                        with self.assertRaises(ValueError):
                            scope["checked_document"](path, [row_id], 3)

    def test_bench_restores_snapshot_after_binding_failure(self):
        import ast
        tree = ast.parse(self.bench_code())
        phase = next(node for node in tree.body if isinstance(node, ast.For)
                     and isinstance(node.target, ast.Tuple)
                     and node.target.elts[0].id == "label")
        start = next(i for i, node in enumerate(phase.body) if isinstance(node, ast.Assign)
                     and any(isinstance(t, ast.Name) and t.id == "prepared_sha256" for t in node.targets))
        end = next(i for i in range(start, len(phase.body)) if isinstance(phase.body[i], ast.Try))
        # Execute the actual snapshot transaction with no Git or build process.
        code = compile(ast.Module(body=phase.body[start:end + 1], type_ignores=[]),
                       "benchmark snapshot transaction", "exec")
        cases = [(label, point) for label in ("before", "after") for point in (
            "success", "commit", "swap", "binding-digest", "binding-write", "benchmark-entry",
            "benchmark-failure", "document-failure", "head-restore", "source-recheck",
            "config-recheck", "receipt-changed")]
        for label, point in cases:
            with self.subTest(label=label, point=point):
                self._check_benchmark_transaction_case(code, label, point)

    def _check_benchmark_transaction_case(self, code, label, point):
        from contextlib import nullcontext

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _, diagnostic_hook, tool_hash, diagnostic_hash = self.diagnostic_fixture(root / "source")
            prepared_path = root / "prepared.json"
            prepared_path.write_text("{}\n")
            upstream, snapshot, expected_tree = "a" * 40, "b" * 40, "c" * 40
            current = {"head": upstream, "index": expected_tree}
            calls, checks = [], []
            failure = OSError("injected " + point)
            receipt_digests = 0

            def git(source, *args, **kwargs):
                calls.append(args)
                if args[0] == "commit-tree":
                    self.assertEqual(args[1], current["index"])
                    if point == "commit":
                        raise failure
                    return snapshot
                if args[:3] == ("update-ref", "--no-deref", "HEAD"):
                    new, old = args[3:]
                    self.assertEqual(current["head"], old)  # Real CAS semantics.
                    if (new == snapshot and point == "swap") or (new == upstream and point == "head-restore"):
                        raise failure
                    current["head"] = new
                    return ""
                self.fail("Unexpected Git command: " + repr(args))

            def digest(path):
                nonlocal receipt_digests
                if point == "binding-digest" and path.name == "Makefile":
                    raise failure
                if path == prepared_path:
                    receipt_digests += 1
                    if point == "receipt-changed" and receipt_digests > 1:
                        return "0" * 64
                return "f" * 64

            def check_source(*_):
                self.assertEqual(current, {"head": upstream, "index": expected_tree})
                self.assertEqual(prepared_path.read_bytes(), b"{}\n")
                checks.append("source")
                if point == "source-recheck":
                    raise failure

            def check_cargo_configs(source, tree):
                self.assertEqual(checks, ["source"])
                self.assertEqual(source, root / "source")
                self.assertEqual(tree, expected_tree)
                checks.append("configs")
                if point == "config-recheck":
                    raise failure

            original_write = Path.write_text
            def write_text(path, *args, **kwargs):
                if point == "binding-write" and path.name == label + "-binding-before.json":
                    raise failure
                return original_write(path, *args, **kwargs)

            def checked_document(*_):
                if point == "document-failure":
                    raise failure
                return {"git_sha": snapshot[:12], "tree_dirty": False,
                        "toolchain": "pinned", "host": "same", "runner": "same"}

            # An old phase producer need not expose the current environment API.
            builder = types.SimpleNamespace(check_source=mock.Mock(side_effect=check_source))
            environment_builder = types.SimpleNamespace(
                check_cargo_configs=mock.Mock(side_effect=check_cargo_configs),
                cargo_environment=mock.Mock(return_value=nullcontext({"CARGO_HOME": "/unused"})))
            if point == "benchmark-entry":
                environment_builder.cargo_environment.side_effect = failure
            scope = {
                "git": git, "digest": digest, "builder": builder, "source": root / "source",
                "environment_builder": environment_builder, "environment_builder_sha256": "9" * 64,
                "upstream": upstream, "label": label, "expected_tree": expected_tree, "identity": {},
                "outer_sha": "d" * 40, "prepared": {}, "prepared_path": prepared_path,
                "provenance": root / "PROVENANCE.json", "tool_hash": tool_hash,
                "diagnostic_hook": diagnostic_hook.parent, "diagnostic_hash": diagnostic_hash, "sys": sys,
                "mod_path": root / "build.py", "evidence": root, "args": object(),
                "manifest": {}, "json": json, "os": os, "subprocess": subprocess,
                "rows": "noop,sizes", "checked_document": checked_document,
            }
            with mock.patch.object(Path, "write_text", new=write_text), \
                    mock.patch("subprocess.run") as run, \
                    mock.patch("subprocess.check_output") as output:
                def benchmark(*args, **kwargs):
                    self.mocked_bench_activation(kwargs["env"])
                    if point == "benchmark-failure":
                        raise failure
                run.side_effect = benchmark
                if point == "success":
                    # Real transaction; process adapters are mocked.
                    exec(code, scope)  # noqa: S102
                else:
                    expected = ValueError if point == "receipt-changed" else OSError
                    with self.assertRaises(expected) as caught:
                        exec(code, scope)  # noqa: S102
                    if expected is OSError:
                        self.assertIs(caught.exception, failure)
                output.assert_not_called()
            self.assertEqual(current["index"], expected_tree)
            if point == "head-restore":
                self.assertEqual(current["head"], snapshot)
                builder.check_source.assert_not_called()
                environment_builder.check_cargo_configs.assert_not_called()
            else:
                self.assertEqual(current["head"], upstream)
                builder.check_source.assert_called_once()
                if point == "source-recheck":
                    environment_builder.check_cargo_configs.assert_not_called()
                else:
                    environment_builder.check_cargo_configs.assert_called_once()
            self.assertFalse(any(call[0] in ("apply", "restore", "write-tree") for call in calls))
            if point == "success":
                binding = json.loads((root / (label + "-binding-after.json")).read_text())
                self.assertEqual(binding["original_prepared_tree"], expected_tree)
                self.assertEqual(binding["measured_tree"], expected_tree)
                self.assertEqual(binding["environment_builder_sha256"], "9" * 64)
                self.assertNotIn("fixture_correction", binding)
            elif point in ("head-restore", "source-recheck", "config-recheck", "receipt-changed"):
                self.assertFalse((root / (label + "-binding-after.json")).exists())
            self.assertFalse((root / "complete-pair.json").exists())


if __name__ == "__main__":
    unittest.main()
