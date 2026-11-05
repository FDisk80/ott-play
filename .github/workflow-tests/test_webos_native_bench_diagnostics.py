"""Observer contracts; process mocks plus one hermetic Python/fake-Cargo smoke."""
import ast
from contextlib import contextmanager
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest import mock

import yaml

ROOT = Path(__file__).resolve().parents[2]
HOOK = ROOT / "scripts/webos-native-bench-diagnostics/sitecustomize.py"
CONTEXT = "OTT_NATIVE_BENCH_DIAGNOSTICS"


class NativeBenchmarkDiagnosticsTests(unittest.TestCase):
    @contextmanager
    def activated(self, original_path=None, matching=True, phase="before"):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / phase / "tools/build-bench.py"
            target.parent.mkdir(parents=True)
            target.write_text("# Synthetic target identity; never executed.\n")
            output = root / "diagnostics"
            output.mkdir()
            injected_path = str(HOOK.parent) + (
                os.pathsep + original_path if original_path is not None else "")
            environment = {
                "PATH": "/synthetic/bin", "SYNTHETIC_PRESERVED": "yes",
                "PYTHONPATH": injected_path,
                CONTEXT: json.dumps({"target": str(target), "output": str(output),
                                     "pythonpath": original_path}),
            }
            argv = [str(target if matching else target.with_name("check-lock.py"))]
            before = {target: target.read_bytes(), HOOK: HOOK.read_bytes()}
            with mock.patch.dict(os.environ, environment, clear=True), \
                    mock.patch.object(sys, "argv", argv), \
                    mock.patch.object(sys, "path", [str(HOOK.parent), "/synthetic/site-packages"]), \
                    mock.patch("subprocess.run") as original:
                scope = {"__file__": str(HOOK), "__name__": "benchmark_observer_test"}
                exec(compile(before[HOOK], str(HOOK), "exec"), scope)
                yield types.SimpleNamespace(original=original, output=output, target=target,
                                            environment=environment, scope=scope)
                for path, contents in before.items():
                    self.assertEqual(path.read_bytes(), contents)

    def failure(self, output):
        directories = list(output.glob("cargo-*"))
        self.assertEqual(len(directories), 1)
        directory = directories[0]
        return directory, json.loads((directory / "result.json").read_text())

    def test_both_phases_capture_complete_json_stdout_stderr_and_exit_code(self):
        stdout = '{"reason":"compiler-message","message":{"rendered":"synthetic error"}}\n' * 80
        stderr = "first useful compiler detail\n" + "x" * 1200 + "\nlast detail\n"
        command = ["cargo", "+pinned", "test", "--lib", "--no-run", "--message-format=json"]
        for phase in ("before", "after"):
            with self.subTest(phase=phase), self.activated(phase=phase) as state:
                result = subprocess.CompletedProcess(command, 101, stdout, stderr)
                state.original.return_value = result
                environment = dict(os.environ)
                returned = subprocess.run(command, capture_output=True, text=True, env=environment)
                self.assertIs(returned, result)
                state.original.assert_called_once_with(command, capture_output=True, text=True, env=environment)
                self.assertIs(state.original.call_args.args[0], command)
                self.assertIs(state.original.call_args.kwargs["env"], environment)
                directory, metadata = self.failure(state.output)
                self.assertEqual(metadata["returncode"], 101)
                self.assertEqual(metadata["command"], command)
                for name, value in (("stdout", stdout), ("stderr", stderr)):
                    data = value.encode("utf-8")
                    self.assertEqual((directory / name).read_bytes(), data)
                    self.assertEqual(metadata["streams"][name], {
                        "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "text": True})
                self.assertNotIn("SYNTHETIC_PRESERVED", json.dumps(metadata))

    def test_check_true_keeps_same_exception_and_binary_streams(self):
        command = ["/synthetic/bin/cargo", "check"]
        error = subprocess.CalledProcessError(17, command, output=b"json\x00\xff", stderr=b"stderr\xfe")
        with self.activated() as state:
            state.original.side_effect = error
            with self.assertRaises(subprocess.CalledProcessError) as caught:
                subprocess.run(command, check=True, capture_output=True)
            self.assertIs(caught.exception, error)
            state.original.assert_called_once_with(command, check=True, capture_output=True)
            directory, metadata = self.failure(state.output)
            self.assertEqual(metadata["returncode"], 17)
            self.assertEqual((directory / "stdout").read_bytes(), error.stdout)
            self.assertEqual((directory / "stderr").read_bytes(), error.stderr)
            self.assertFalse(metadata["streams"]["stdout"]["text"])

    def test_success_has_no_diagnostic_io_and_preserves_result(self):
        with self.activated() as state:
            command = ["cargo", "test", "--no-run", "--message-format=json"]
            result = subprocess.CompletedProcess(command, 0, "success JSON", "warning")
            state.original.return_value = result
            with mock.patch("tempfile.mkdtemp", side_effect=AssertionError("success diagnostic I/O")), \
                    mock.patch.object(Path, "write_bytes", side_effect=AssertionError("success write")), \
                    mock.patch.object(Path, "write_text", side_effect=AssertionError("success write")), \
                    mock.patch.object(Path, "open", side_effect=AssertionError("success open")):
                self.assertIs(subprocess.run(command, capture_output=True, text=True), result)
            self.assertEqual([p.name for p in state.output.iterdir()], ["activation.json"])

    def test_wrong_target_keeps_parent_injection_but_does_not_install_observer(self):
        with self.activated(matching=False) as state:
            self.assertIs(subprocess.run, state.original)
            self.assertEqual(dict(os.environ), state.environment)
            self.assertIn(str(HOOK.parent), sys.path)
            self.assertEqual(list(state.output.iterdir()), [])

    def test_unset_empty_and_set_pythonpath_are_restored_before_child_snapshot(self):
        for original in (None, "", "/synthetic/first" + os.pathsep + "/synthetic/second"):
            with self.subTest(original=original), self.activated(original_path=original) as state:
                if original is None:
                    self.assertNotIn("PYTHONPATH", os.environ)
                else:
                    self.assertEqual(os.environ["PYTHONPATH"], original)
                self.assertNotIn(CONTEXT, os.environ)
                self.assertEqual(sys.path, ["/synthetic/site-packages"])
                command = ["cargo", "check"]
                state.original.return_value = subprocess.CompletedProcess(command, 0, "", "")
                child = dict(os.environ)
                subprocess.run(command, env=child)
                self.assertEqual(state.original.call_args.kwargs["env"], child)
                self.assertEqual(child.get("PYTHONPATH"), original)
                self.assertNotIn(CONTEXT, child)
                self.assertEqual(child["SYNTHETIC_PRESERVED"], "yes")

    def test_activation_binds_unchanged_target_and_common_hook_bytes(self):
        with self.activated() as state:
            receipt = json.loads((state.output / "activation.json").read_text())
            self.assertEqual(receipt, {
                "schema": 1, "target": str(state.target.resolve()),
                "target_sha256": hashlib.sha256(state.target.read_bytes()).hexdigest(),
                "hook_sha256": hashlib.sha256(HOOK.read_bytes()).hexdigest(),
            })
            # Repeated imports after environment restoration cannot wrap run twice.
            run = subprocess.run
            state.scope["_activate"]()
            self.assertIs(subprocess.run, run)

    def test_diagnostic_io_failure_cannot_mask_original_failure(self):
        command = ["cargo", "check"]
        for raised, warning_fails in ((False, False), (True, False), (False, True), (True, True)):
            with self.subTest(raised=raised, warning_fails=warning_fails), self.activated() as state:
                error = subprocess.CalledProcessError(101, command, output="original stdout", stderr="original stderr")
                result = subprocess.CompletedProcess(command, 101, error.stdout, error.stderr)
                if raised:
                    state.original.side_effect = error
                else:
                    state.original.return_value = result
                output = (mock.Mock(write=mock.Mock(side_effect=BrokenPipeError("synthetic closed log")))
                          if warning_fails else io.StringIO())
                with mock.patch("tempfile.mkdtemp", side_effect=OSError("synthetic disk full")), \
                        mock.patch.object(sys, "stderr", output):
                    if raised:
                        with self.assertRaises(subprocess.CalledProcessError) as caught:
                            subprocess.run(command, check=True, capture_output=True)
                        self.assertIs(caught.exception, error)
                    else:
                        self.assertIs(subprocess.run(command, capture_output=True), result)
                if not warning_fails:
                    self.assertIn("could not save Cargo diagnostics", output.getvalue())

    def test_non_cargo_failures_are_outside_observer_scope(self):
        with self.activated() as state:
            result = subprocess.CompletedProcess(["make", "check"], 2, "make output", "make error")
            state.original.return_value = result
            self.assertIs(subprocess.run(result.args, capture_output=True), result)
            self.assertEqual(list(state.output.glob("cargo-*")), [])

    @unittest.skipUnless(os.name == "posix", "synthetic executable uses a POSIX shebang")
    def test_real_python_startup_observes_only_synthetic_cargo_and_cleans_child_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "tools/build-bench.py"
            target.parent.mkdir()
            cargo = root / "cargo"
            cargo.write_text("#!" + sys.executable + "\n" +
                             "import json, os, sys\n"
                             "print(json.dumps({'reason': 'compiler-message', 'synthetic': True,\n"
                             "    'context_present': 'OTT_NATIVE_BENCH_DIAGNOSTICS' in os.environ,\n"
                             "    'pythonpath_present': 'PYTHONPATH' in os.environ}))\n"
                             "sys.stderr.write('synthetic compiler detail\\n' + 'x' * 800 + '\\n')\n"
                             "sys.exit(101)\n")
            cargo.chmod(0o700)
            target.write_text("import subprocess, sys\n"
                              "result = subprocess.run([sys.argv[1]], capture_output=True, text=True)\n"
                              "sys.stdout.write(result.stdout)\n"
                              "sys.stderr.write(result.stderr[-600:])\n"
                              "sys.exit(result.returncode)\n")
            output = root / "diagnostics"
            output.mkdir()
            before = {path: path.read_bytes() for path in (target, cargo, HOOK)}
            environment = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", PYTHONPATH=str(HOOK.parent))
            environment[CONTEXT] = json.dumps({
                "target": str(target), "output": str(output), "pythonpath": None})
            # These are the only real children in this suite: Python and this exact
            # temporary script named cargo, which prints fixed text and exits.
            result = subprocess.run([sys.executable, str(target), str(cargo)],
                                    cwd=root, env=environment, capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 101)
            self.assertEqual(json.loads(result.stdout), {
                "reason": "compiler-message", "synthetic": True,
                "context_present": False, "pythonpath_present": False})
            activation = json.loads((output / "activation.json").read_text())
            self.assertEqual(activation["target_sha256"], hashlib.sha256(before[target]).hexdigest())
            self.assertEqual(activation["hook_sha256"], hashlib.sha256(before[HOOK]).hexdigest())
            captured, metadata = self.failure(output)
            self.assertEqual(metadata["returncode"], 101)
            self.assertEqual(metadata["command"], [str(cargo)])
            self.assertEqual((captured / "stdout").read_text(), result.stdout)
            self.assertEqual((captured / "stderr").read_text(), "synthetic compiler detail\n" + "x" * 800 + "\n")
            self.assertNotIn("synthetic compiler detail", result.stderr)
            for path, contents in before.items():
                self.assertEqual(path.read_bytes(), contents)


class NativeBenchmarkDiagnosticWiringTests(unittest.TestCase):
    def code(self):
        workflow = yaml.load((ROOT / ".github/workflows/webos-native.yml").read_text(), Loader=yaml.BaseLoader)
        run = next(s["run"] for s in workflow["jobs"]["native-build-bench"]["steps"]
                   if "<<'PYBENCH'" in s.get("run", ""))
        return run.split("python3 - <<'PYBENCH'\n", 1)[1].rsplit("\nPYBENCH", 1)[0]

    def test_one_common_external_hook_is_bound_in_each_phase(self):
        code = self.code()
        tree = ast.parse(code)
        phase = next(n for n in tree.body if isinstance(n, ast.For) and isinstance(n.target, ast.Tuple)
                     and n.target.elts[0].id == "label")
        hook_write = next(n for n in tree.body if isinstance(n, ast.Expr)
                          and "(diagnostic_hook / 'sitecustomize.py').write_bytes(hook_bytes)" == ast.unparse(n))
        self.assertLess(hook_write.lineno, phase.lineno)
        self.assertIn("diagnostic_hook = work / 'diagnostic-hook'", code)
        self.assertIn("(evidence / 'diagnostic-hook.py').write_bytes(hook_bytes)", code)
        self.assertIn("diagnostic_hook_sha256=diagnostic_hash", code)
        self.assertIn("benchmark_sha256=tool_hash", code)

    def test_actual_measured_loop_scopes_each_observer_and_keeps_failed_exit(self):
        tree = ast.parse(self.code())
        loop = next(n for n in ast.walk(tree) if isinstance(n, ast.For) and isinstance(n.target, ast.Tuple)
                    and n.target.elts[0].id == "suffix")
        end = next(i for i, n in enumerate(loop.body) if isinstance(n, ast.Try))
        selected = ast.For(target=loop.target, iter=loop.iter, body=loop.body[:end + 1], orelse=[])
        code = compile(ast.fix_missing_locations(ast.Module(body=[selected], type_ignores=[])),
                       "actual observer wiring", "exec")
        for label in ("before", "after"):
            for fail, activation in ((False, "valid"), (True, "valid"),
                                     (False, "missing"), (True, "missing"),
                                     (False, "mismatch"), (True, "mismatch")):
                with self.subTest(label=label, fail=fail, activation=activation), tempfile.TemporaryDirectory() as directory:
                    root = Path(directory)
                    source, evidence, hook = root / "source", root / "evidence", root / "hook"
                    for path in (source, evidence, hook):
                        path.mkdir()
                    environment = {"PATH": "/synthetic/bin", "PYTHONPATH": ""}
                    original_environment = dict(environment)
                    error = subprocess.CalledProcessError(2, ["make", "build-bench"])
                    calls = []

                    def run(command, **kwargs):
                        calls.append((command, kwargs))
                        self.assertEqual(command[:2], ["make", "build-bench"])
                        self.assertTrue(kwargs["check"])
                        self.assertEqual(kwargs["cwd"], source)
                        injected = kwargs["env"]
                        self.assertIsNot(injected, environment)
                        context = json.loads(injected[CONTEXT])
                        self.assertEqual(context["target"], str(source / "tools/build-bench.py"))
                        self.assertEqual(context["pythonpath"], "")
                        self.assertEqual(injected["PYTHONPATH"], str(hook) + os.pathsep)
                        output = Path(context["output"])
                        self.assertTrue(output.name.startswith(label + "-"))
                        if activation != "missing":
                            (output / "activation.json").write_text(json.dumps({
                                "schema": 1, "target": str((source / "tools/build-bench.py").resolve()),
                                "target_sha256": "tool-hash",
                                "hook_sha256": "hook-hash" if activation == "valid" else "wrong-hash"}))
                        if fail:
                            raise error
                        return subprocess.CompletedProcess(command, 0)

                    scope = {"rows": "noop,sizes", "label": label, "evidence": evidence,
                             "source": source, "environment": environment, "diagnostic_hook": hook,
                             "diagnostic_hash": "hook-hash", "tool_hash": "tool-hash",
                             "json": json, "os": os, "sys": sys, "subprocess": types.SimpleNamespace(
                                 run=mock.Mock(side_effect=run), STDOUT=subprocess.STDOUT)}
                    diagnostic_messages = io.StringIO()
                    with mock.patch.object(sys, "stderr", diagnostic_messages):
                        if fail:
                            with self.assertRaises(subprocess.CalledProcessError) as caught:
                                exec(code, scope)
                            self.assertIs(caught.exception, error)
                            if activation != "valid":
                                self.assertIn("Benchmark diagnostics unavailable", diagnostic_messages.getvalue())
                        elif activation == "missing":
                            with self.assertRaises(FileNotFoundError):
                                exec(code, scope)
                        elif activation == "mismatch":
                            with self.assertRaises(ValueError):
                                exec(code, scope)
                        else:
                            exec(code, scope)
                    self.assertEqual(environment, original_environment)
                    self.assertEqual(len(calls), 2 if not fail and activation == "valid" else 1)


if __name__ == "__main__":
    unittest.main()
