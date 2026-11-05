"""Inert fixtures for the CI verifier; never start a browser or invoke Git."""
import base64
import contextlib
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/verify-global-favorites-browser.py"
SPEC = importlib.util.spec_from_file_location("browser_evidence", SCRIPT)
verifier = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verifier)
HEAD, BASE, TIP, TREE = (digit * 40 for digit in "abcd")


def environment(event="pull_request"):
    return {
        "GITHUB_SHA": HEAD, "GITHUB_EVENT_NAME": event,
        "GITHUB_RUN_ID": "123456", "GITHUB_RUN_ATTEMPT": "2",
        "GITHUB_REPOSITORY": "example/player", "GITHUB_WORKFLOW": "CI",
        "GITHUB_WORKFLOW_REF": "example/player/.github/workflows/ci.yml@refs/pull/1/merge",
        "GITHUB_WORKFLOW_SHA": HEAD, "GITHUB_JOB": "build",
    }


def commit(parents=(BASE, TIP)):
    # These headers survive depth=1; a revision walk need not expose the parents.
    return ("tree " + TREE + "\n" + "".join("parent " + p + "\n" for p in parents)
            + "author Synthetic <test@example.invalid> 0 +0000\n\nmerge\n").encode()


def pr_event():
    return {"number": 1, "pull_request": {"base": {"sha": BASE}, "head": {"sha": TIP}}}


def report(root):
    # Shape emitted by Playwright 1.64.1 JSONReporter (one unnamed project).
    cases = []
    for index, title in enumerate(verifier.TITLES):
        cases.append({
            "title": title, "ok": True, "tags": [], "id": "case-" + str(index),
            "file": "global-favorites-mixed.spec.cjs", "line": index + 1, "column": 1,
            "tests": [{"timeout": 30000, "annotations": [], "expectedStatus": "passed",
                       "projectName": "", "projectId": "", "status": "expected",
                       "results": [{"workerIndex": 0, "parallelIndex": 0, "status": "passed",
                                    "duration": 50, "errors": [], "stdout": [], "stderr": [],
                                    "retry": 0, "startTime": "2026-10-29T00:00:00.000Z",
                                    "attachments": [], "annotations": []}]}],
        })
    return {
        "config": {"rootDir": str(root / "tests/browser"), "projects": [
            {"id": "", "name": "", "testDir": str(root / "tests/browser"),
             "repeatEach": 1, "retries": 0}]},
        "suites": [{"title": "global-favorites-mixed.spec.cjs", "specs": cases}],
        "errors": [], "stats": {"expected": len(cases), "unexpected": 0, "flaky": 0, "skipped": 0},
    }


class BrowserEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()

    def test_real_report_shape_and_nested_suites(self):
        value = report(self.root)
        value["suites"] = [{"title": "wrapper", "specs": [], "suites": value["suites"]}]
        result = verifier.validate_report(value, self.root)
        self.assertEqual([row["title"] for row in result], list(verifier.TITLES))

    def test_root_relative_paths_and_unrelated_cases_are_not_counted(self):
        value = report(self.root)
        value["config"]["rootDir"] = str(self.root)
        for case in value["suites"][0]["specs"]:
            case["file"] = verifier.SPEC
        value["suites"].append({"title": "unrelated", "specs": [
            {"file": "tests/browser/device-detection.spec.cjs", "title": "unrelated"}]})
        self.assertEqual(len(verifier.validate_report(value, self.root)), 8)

    def test_each_required_case_must_be_present(self):
        for index, title in enumerate(verifier.TITLES):
            with self.subTest(title=title):
                value = report(self.root)
                value["suites"][0]["specs"].pop(index)
                with self.assertRaisesRegex(verifier.EvidenceError, "exact_required_cases"):
                    verifier.validate_report(value, self.root)

    def test_exact_cases_reject_missing_extra_duplicate_or_renamed(self):
        for change in ("missing", "extra", "duplicate", "renamed"):
            with self.subTest(change=change):
                value = report(self.root)
                cases = value["suites"][0]["specs"]
                if change == "missing":
                    cases.pop()
                elif change == "extra":
                    cases.append(copy.deepcopy(cases[0]))
                elif change == "duplicate":
                    cases[-1] = copy.deepcopy(cases[0])
                else:
                    cases[-1]["title"] = "not the required negative"
                with self.assertRaisesRegex(verifier.EvidenceError, "exact_required_cases"):
                    verifier.validate_report(value, self.root)

    def test_failed_flaky_skipped_expected_failure_and_retries_are_rejected(self):
        mutations = (
            lambda case, test, result: test.update(status="flaky"),
            lambda case, test, result: test.update(status="skipped"),
            lambda case, test, result: test.update(expectedStatus="failed"),
            lambda case, test, result: result.update(status="failed"),
            lambda case, test, result: result.update(status="timedOut"),
            lambda case, test, result: result.update(status="interrupted"),
            lambda case, test, result: result.update(retry=1),
            lambda case, test, result: result.update(retry=False),
            lambda case, test, result: test["results"].append(copy.deepcopy(result)),
            lambda case, test, result: test.update(results=[]),
            lambda case, test, result: case.update(ok=False),
            lambda case, test, result: result.update(errors=[{"message": "private"}]),
            lambda case, test, result: result.update(error={"message": "private"}),
        )
        for index, mutate in enumerate(mutations):
            with self.subTest(index=index):
                value = report(self.root)
                case = value["suites"][0]["specs"][0]
                test = case["tests"][0]
                mutate(case, test, test["results"][0])
                with self.assertRaises(verifier.EvidenceError):
                    verifier.validate_report(value, self.root)

    def test_wrong_file_project_and_root_are_rejected(self):
        for change in ("file", "root", "project", "two_projects", "two_tests"):
            with self.subTest(change=change):
                value = report(self.root)
                case = value["suites"][0]["specs"][0]
                if change == "file":
                    case["file"] = "../other/global-favorites-mixed.spec.cjs"
                elif change == "root":
                    value["config"]["rootDir"] = str(self.root / "other")
                elif change == "project":
                    case["tests"][0]["projectId"] = "other"
                elif change == "two_projects":
                    value["config"]["projects"].append(copy.deepcopy(value["config"]["projects"][0]))
                else:
                    case["tests"].append(copy.deepcopy(case["tests"][0]))
                with self.assertRaises(verifier.EvidenceError):
                    verifier.validate_report(value, self.root)

    def test_reporter_errors_and_malformed_json_are_rejected(self):
        value = report(self.root)
        value["errors"] = [{"message": "setup failure"}]
        with self.assertRaisesRegex(verifier.EvidenceError, "report_errors"):
            verifier.validate_report(value, self.root)
        for raw in (b'{"a":1,"a":2}', b'{', b'\xff', b'{"a":NaN}', b'{"a":1e999}'):
            with self.subTest(raw=raw), self.assertRaises(verifier.EvidenceError):
                verifier.parse_json(raw)

    def test_pull_request_uses_raw_merge_parents_not_head_only(self):
        result = verifier.bind_revision(HEAD, commit(), pr_event(), environment())
        self.assertEqual(result["event_binding"], "pull_request_merge")
        self.assertEqual(result["parents"], [BASE, TIP])
        for parents in ((TIP,), (TIP, BASE), (BASE, HEAD), (BASE, TIP, TREE)):
            with self.subTest(parents=parents), self.assertRaises(verifier.EvidenceError):
                verifier.bind_revision(HEAD, commit(parents), pr_event(), environment())
        with self.assertRaisesRegex(verifier.EvidenceError, "checkout_sha_mismatch"):
            verifier.bind_revision(TIP, commit(), pr_event(), environment())

    def test_merge_group_binds_actual_checkout(self):
        env = environment("merge_group")
        result = verifier.bind_revision(HEAD, commit(), {"merge_group": {"head_sha": HEAD}}, env)
        self.assertEqual(result["event_binding"], "merge_group")
        with self.assertRaises(verifier.EvidenceError):
            verifier.bind_revision(HEAD, commit(), {"merge_group": {"head_sha": TIP}}, env)

    def test_original_non_pr_events_do_not_invent_pull_request(self):
        for name, event in (("push", {"after": HEAD}), ("workflow_dispatch", {}),
                            ("schedule", {}), ("workflow_call", {})):
            with self.subTest(name=name):
                result = verifier.bind_revision(HEAD, commit((BASE,)), event, environment(name))
                self.assertEqual(result["event_name"], name)
                self.assertNotIn("pr_number", result)
        # Reusable workflows normally retain the caller event; a PR payload stays bound.
        result = verifier.bind_revision(HEAD, commit(), pr_event(), environment("workflow_call"))
        self.assertEqual(result["event_binding"], "pull_request_merge")
        for name, event in (("push", {"after": TIP}), ("pull_request", {}), ("merge_group", {})):
            with self.subTest(name=name), self.assertRaises(verifier.EvidenceError):
                verifier.bind_revision(HEAD, commit(), event, environment(name))

    def test_collect_identity_reads_commit_object_and_hashes_exact_files(self):
        env = environment()
        event_path = self.root / "event.json"
        event_path.write_text(json.dumps(pr_event()), encoding="utf-8")
        env["GITHUB_EVENT_PATH"] = str(event_path)
        for name in verifier.SOURCE_FILES:
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes((name + "\n").encode())
        calls = []
        def fake_git(root, args, deadline):
            self.assertEqual(root, self.root)
            calls.append(args)
            if args == ["rev-parse", "--verify", "HEAD"]:
                return (HEAD + "\n").encode()
            if args == ["cat-file", "-p", HEAD]:
                return commit()
            self.assertIn(args[0], ("ls-files", "diff"))
            return b""
        with mock.patch.object(verifier, "run_git", side_effect=fake_git):
            identity = verifier.collect_identity(self.root, env, 100)
        self.assertEqual(len(calls), 4)
        self.assertFalse(any("rev-list" in args for args in calls))
        self.assertEqual(identity["source_sha256"][verifier.SPEC],
                         verifier.sha((verifier.SPEC + "\n").encode()))
        self.assertEqual(identity["event_sha256"], verifier.sha(event_path.read_bytes()))

    def capture_inputs(self, event_raw=None, raw_commit=None):
        env = environment()
        event_path = self.root / "event.json"
        event_path.write_bytes(event_raw if event_raw is not None else json.dumps(pr_event()).encode())
        env["GITHUB_EVENT_PATH"] = str(event_path)
        env["UNRELATED_SECRET"] = "not-for-provenance"
        raw_commit = commit() if raw_commit is None else raw_commit

        def git(_root, args, _deadline):
            if args == ["rev-parse", "--verify", "HEAD"]:
                return (HEAD + "\n").encode()
            if args == ["cat-file", "-p", HEAD]:
                return raw_commit
            self.fail("unexpected Git operation: " + repr(args))
        return env, git

    def test_early_capture_preserves_exact_event_commit_and_context_only(self):
        event_raw = (json.dumps(pr_event(), indent=2) + "\r\n").encode()
        raw_commit = commit() + b"\noriginal message\n"
        env, git = self.capture_inputs(event_raw, raw_commit)
        output = self.root / "nested" / "provenance.json"
        stdout = io.StringIO()
        with mock.patch.object(verifier, "run_git", side_effect=git), contextlib.redirect_stdout(stdout):
            code = verifier.capture_provenance(self.root, output, env)
        saved = json.loads(output.read_bytes())
        self.assertEqual(code, 0)
        self.assertEqual(saved["status"], "captured")
        self.assertNotIn("identity", saved)
        self.assertEqual(saved["observed"], {"head": HEAD, "tree": TREE, "parents": [BASE, TIP]})
        self.assertEqual(saved["expected_pr_parents"], [BASE, TIP])
        for name, raw in (("event", event_raw), ("commit", raw_commit)):
            self.assertEqual(base64.b64decode(saved["raw"][name]["base64"], validate=True), raw)
            self.assertEqual(saved["raw"][name]["sha256"], verifier.sha(raw))
            self.assertEqual(saved["raw"][name]["bytes"], len(raw))
        self.assertNotIn("UNRELATED_SECRET", saved["context"])
        self.assertNotIn("not-for-provenance", output.read_text() + stdout.getvalue())
        self.assertEqual(stdout.getvalue(), "Mixed Favorites provenance: captured\n")

    def test_capture_retains_old_event_base_but_final_guard_still_rejects(self):
        event = pr_event()
        event["pull_request"]["base"]["sha"] = "e" * 40
        env, git = self.capture_inputs(json.dumps(event).encode())
        output, verdict = self.root / "provenance.json", self.root / "verdict.json"
        with mock.patch.object(verifier, "run_git", side_effect=git), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(verifier.capture_provenance(self.root, output, env), 0)
            self.assertEqual(verifier.verify(self.root, self.root / "missing-report.json", verdict,
                                             "skipped", env), 1)
        saved = json.loads(output.read_bytes())
        self.assertEqual(saved["observed"]["parents"], [BASE, TIP])
        self.assertEqual(saved["expected_pr_parents"], ["e" * 40, TIP])
        rejected = json.loads(verdict.read_bytes())
        self.assertEqual(rejected["status"], "failed")
        self.assertEqual(rejected["code"], "pr_merge_parents_mismatch")
        self.assertNotIn("cases", rejected)

    def test_capture_malformed_or_oversized_event_fails_without_console_dump(self):
        for raw, expected in ((b'{"private": "opaque', "invalid_json"),
                              (b"x" * (4 * 1024 * 1024 + 1), "file_too_large")):
            with self.subTest(expected=expected):
                env, git = self.capture_inputs(raw)
                output = self.root / "provenance.json"
                output.write_text('{"status":"passed","stale":true}')
                stdout = io.StringIO()
                with mock.patch.object(verifier, "run_git", side_effect=git), contextlib.redirect_stdout(stdout):
                    self.assertEqual(verifier.capture_provenance(self.root, output, env), 1)
                saved = json.loads(output.read_bytes())
                self.assertEqual(saved["status"], "failed")
                self.assertEqual(saved["code"], expected)
                self.assertNotIn("stale", saved)
                self.assertNotIn("opaque", stdout.getvalue())
                if expected == "invalid_json":
                    self.assertEqual(base64.b64decode(saved["raw"]["event"]["base64"]), raw)
                else:
                    self.assertNotIn("raw", saved)

    def test_capture_write_error_is_not_success(self):
        env, git = self.capture_inputs()
        stdout = io.StringIO()
        with mock.patch.object(verifier, "run_git", side_effect=git), \
                mock.patch.object(verifier, "write_verdict", side_effect=OSError("private")), \
                contextlib.redirect_stdout(stdout):
            code = verifier.capture_provenance(self.root, self.root / "provenance.json", env)
        self.assertEqual(code, 1)
        self.assertEqual(stdout.getvalue(), "Mixed Favorites provenance: capture_write_failed\n")

    def run_verifier(self, raw, outcome="success", identity_error=None):
        path = self.root / "report.json"
        if raw is not None:
            path.write_bytes(raw)
        output = self.root / "saved/verdict.json"
        output.parent.mkdir(exist_ok=True)
        output.write_text('{"status":"passed","stale":true}', encoding="utf-8")
        stdout = io.StringIO()
        with mock.patch.object(verifier, "collect_identity", return_value={"head": HEAD},
                               side_effect=identity_error), contextlib.redirect_stdout(stdout):
            code = verifier.verify(self.root, path, output, outcome, environment())
        return code, json.loads(output.read_text(encoding="utf-8")), stdout.getvalue(), output

    def test_success_writes_durable_scoped_verdict(self):
        code, saved, stdout, output = self.run_verifier(json.dumps(report(self.root)).encode())
        self.assertEqual(code, 0)
        self.assertEqual(saved["status"], "passed")
        self.assertEqual(len(saved["cases"]), 8)
        self.assertFalse(saved["real_device_qualified"])
        self.assertEqual(saved["report_sha256"], verifier.sha((self.root / "report.json").read_bytes()))
        if os.name != "nt":
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
        self.assertIn("verified", stdout)
        self.assertEqual(list(output.parent.glob(".verdict-*")), [])

    def test_missing_truncated_and_step_failure_replace_stale_success(self):
        for raw, outcome in ((None, "success"), (b'{', "success"),
                             (json.dumps(report(self.root)).encode(), "failure"),
                             (json.dumps(report(self.root)).encode(), "cancelled")):
            with self.subTest(raw=raw, outcome=outcome):
                (self.root / "report.json").unlink(missing_ok=True)
                code, saved, _, _ = self.run_verifier(raw, outcome)
                self.assertEqual(code, 1)
                self.assertEqual(saved["status"], "failed")
                self.assertNotIn("stale", saved)

    def test_failure_does_not_copy_private_error_strings(self):
        secret = "https://private.invalid/?token=SECRET"
        code, saved, stdout, _ = self.run_verifier(None, identity_error=OSError(secret))
        self.assertEqual(code, 1)
        self.assertNotIn(secret, json.dumps(saved) + stdout)
        self.assertEqual(saved["code"], "evidence_unavailable_or_malformed")

    def test_verdict_write_failure_cannot_report_success(self):
        with mock.patch.object(verifier, "write_verdict", side_effect=OSError("private")):
            code, _, stdout, _ = self.run_verifier(json.dumps(report(self.root)).encode())
        self.assertEqual(code, 1)
        self.assertEqual(stdout.strip(), "Mixed Favorites evidence: verdict_write_failed")

    def test_windows_syncs_file_before_replace_without_opening_directory(self):
        output = self.root / "verdict.json"
        real_open, real_fsync, real_replace = os.open, os.fsync, os.replace
        events = []
        def open_file(path, flags, *args, **kwargs):
            self.assertNotEqual(os.fspath(path), os.fspath(output.parent))
            return real_open(path, flags, *args, **kwargs)
        def sync_file(fd):
            events.append("file_sync")
            return real_fsync(fd)
        def replace(source, destination):
            events.append("replace")
            return real_replace(source, destination)
        with mock.patch.object(verifier.os, "name", "nt"), \
                mock.patch.object(verifier.os, "open", side_effect=open_file), \
                mock.patch.object(verifier.os, "fsync", side_effect=sync_file), \
                mock.patch.object(verifier.os, "replace", side_effect=replace):
            verifier.write_verdict(output, {"status": "passed"})
        self.assertEqual(events, ["file_sync", "replace"])
        self.assertEqual(json.loads(output.read_text()), {"status": "passed"})

    def test_windows_file_sync_failure_is_not_suppressed(self):
        output = self.root / "verdict.json"
        output.write_bytes(b"previous")
        with mock.patch.object(verifier.os, "name", "nt"), \
                mock.patch.object(verifier.os, "fsync", side_effect=OSError("sync failed")), \
                mock.patch.object(verifier.os, "replace") as replace:
            with self.assertRaises(OSError):
                verifier.write_verdict(output, {"status": "passed"})
        replace.assert_not_called()
        self.assertEqual(output.read_bytes(), b"previous")
        self.assertEqual(list(self.root.glob(".verdict-*")), [])

    def test_posix_directory_sync_failure_is_propagated_and_descriptor_closed(self):
        output = self.root / "verdict.json"
        real_open, real_fsync, real_close = os.open, os.fsync, os.close
        directory_fd = 987654321
        events = []
        def open_file_or_directory(path, flags, *args, **kwargs):
            if os.fspath(path) == os.fspath(output.parent):
                events.append("directory_open")
                return directory_fd
            return real_open(path, flags, *args, **kwargs)
        def sync(fd):
            if fd == directory_fd:
                events.append("directory_sync")
                raise OSError("directory sync failed")
            events.append("file_sync")
            return real_fsync(fd)
        def close(fd):
            if fd == directory_fd:
                events.append("directory_close")
                return
            return real_close(fd)
        with mock.patch.object(verifier.os, "name", "posix"), \
                mock.patch.object(verifier.os, "open", side_effect=open_file_or_directory), \
                mock.patch.object(verifier.os, "fsync", side_effect=sync), \
                mock.patch.object(verifier.os, "close", side_effect=close):
            with self.assertRaisesRegex(OSError, "directory sync failed"):
                verifier.write_verdict(output, {"status": "passed"})
        self.assertEqual(events, ["file_sync", "directory_open", "directory_sync", "directory_close"])
        # Replacement already occurred, but the failed durability barrier is not success.
        self.assertEqual(json.loads(output.read_text()), {"status": "passed"})


if __name__ == "__main__":
    unittest.main()
