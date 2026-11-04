"""Offline promotion contracts: real bundles, bounded archives, fake GitHub only."""
import copy
import hashlib
import importlib.util
import io
import json
import os
import stat
import subprocess
import sys
import tempfile
import time
import unittest
import warnings
import zipfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


publish = load("native_publish_test_subject", ROOT / "scripts/publish-webos-native.py")
fixtures = load("native_publish_bundle_fixture", ROOT / "tests/test_webos_native_release.py")
SHA = "b" * 40
VERSION = "0.1.0"
TAG = "native-webos-v0.1.0-beta.1"


def inputs():
    return publish.validate_inputs(17, SHA, VERSION, TAG)


def workflow():
    return {"id": 23, "path": ".github/workflows/webos-native.yml"}


def run():
    return {
        "id": 17, "workflow_id": 23, "path": workflow()["path"],
        "repository": {"full_name": publish.REPOSITORY},
        "head_repository": {"full_name": publish.REPOSITORY},
        "event": "workflow_dispatch", "head_branch": "main", "head_sha": SHA,
        "status": "completed", "conclusion": "success",
    }


def artifact(raw=b"zip"):
    return {"id": 31, "name": publish.ARTIFACT, "expired": False,
            "size_in_bytes": len(raw), "digest": "sha256:" + hashlib.sha256(raw).hexdigest(),
            "workflow_run": {"id": 17, "head_sha": SHA, "head_branch": "main"}}


class ReleaseNotesTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.git("init", "--quiet")
        self.notes = self.root / "native/webos/releases/0.1.0.md"
        self.notes.parent.mkdir(parents=True)
        self.notes.write_text("# Native 0.1.0\n\nPlayback and résumé fixes.\n", encoding="utf-8")
        self.notes.with_name("0.2.0.md").write_text("Future version\n", encoding="utf-8")
        self.commit()

    def git(self, *args):
        environment = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
        environment.update(GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL=os.devnull, GIT_TERMINAL_PROMPT="0")
        return subprocess.run([
            "git", "-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false",
            "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", *args,
        ], cwd=self.root, env=environment, capture_output=True, check=True, timeout=30).stdout

    def commit(self):
        self.git("add", "native")
        self.git("commit", "--quiet", "-m", "Fixture release notes")
        self.sha = self.git("rev-parse", "HEAD").decode().strip()

    def body(self, version=VERSION):
        checked = publish.validate_inputs(17, self.sha, version, "native-webos-v" + version)
        with patch.object(publish, "ROOT", self.root):
            return publish.release_body(checked)

    def test_exact_version_uses_commit_bytes_not_changed_or_untracked_notes(self):
        expected = self.notes.read_text(encoding="utf-8").strip()
        self.notes.write_text("Changed checkout text\n", encoding="utf-8")
        self.assertEqual(self.body(), expected)
        self.assertEqual(self.body("0.2.0"), "Future version")
        self.notes.with_name("0.3.0.md").write_text("Untracked text\n", encoding="utf-8")
        self.assertEqual(self.body("0.3.0"), publish.DEFAULT_RELEASE_BODY)

    def test_missing_notes_keep_legacy_body(self):
        self.assertEqual(self.body("0.9.0"), publish.DEFAULT_RELEASE_BODY)

    def test_later_commit_and_replace_ref_cannot_change_verified_notes(self):
        expected = self.notes.read_text(encoding="utf-8").strip()
        original = self.sha
        self.notes.write_text("Later commit text\n", encoding="utf-8")
        self.commit()
        self.git("replace", original, self.sha)
        self.sha = original
        self.assertEqual(self.body(), expected)

    def test_exact_size_limit_is_accepted(self):
        self.notes.write_bytes(b"x" * (64 * 1024))
        self.commit()
        self.assertEqual(len(self.body()), 64 * 1024)

    def test_oversized_notes_are_rejected(self):
        self.notes.write_bytes(b"x" * (64 * 1024 + 1))
        self.commit()
        with self.assertRaises(publish.PromotionError):
            self.body()

    def test_empty_invalid_utf8_and_nul_notes_are_rejected(self):
        for raw in (b"", b" \n", b"\xff", b"text\x00text"):
            with self.subTest(raw=raw):
                self.notes.write_bytes(raw)
                self.commit()
                with self.assertRaises(publish.PromotionError):
                    self.body()

    def test_tracked_symlink_is_not_read_as_release_notes(self):
        self.notes.unlink()
        self.notes.symlink_to("0.2.0.md")
        self.commit()
        with self.assertRaises(publish.PromotionError):
            self.body()

    def test_tracked_directory_is_not_missing_notes(self):
        self.notes.unlink()
        self.notes.mkdir()
        (self.notes / "entry").write_text("Not a notes file", encoding="utf-8")
        self.commit()
        with self.assertRaises(publish.PromotionError):
            self.body()

    def test_git_failure_does_not_fall_back_to_generic_notes(self):
        failed = subprocess.CompletedProcess([], 1, b"", b"unavailable")
        with patch.object(publish.subprocess, "run", return_value=failed), self.assertRaises(publish.PromotionError):
            self.body()

    def test_invalid_version_or_source_cannot_construct_a_git_path(self):
        for change in ({"version": "../0.1.0"}, {"source_sha": "HEAD"}):
            with self.subTest(change=change), patch.object(publish.subprocess, "run") as execute:
                with self.assertRaises(publish.PromotionError):
                    publish.release_body(dict(inputs(), **change))
                execute.assert_not_called()


class GitHubDiagnosticsTests(unittest.TestCase):
    SECRET = "secret-token-do-not-print"

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        self.calls = 0

    def request(self, *, stderr=b"", status=1, arguments=None, allow_not_found=False,
                stdout=b"", limit=1024, timeout=None, start_error=None):
        self.calls += 1
        self.process = MagicMock()
        self.process.stdout.fileno.return_value = 99
        self.process.poll.return_value = None if timeout else status
        self.process.wait.return_value = status
        if timeout == "wait":
            self.process.wait.side_effect = [
                subprocess.TimeoutExpired([self.SECRET], 1, output=self.SECRET, stderr=self.SECRET), status,
            ]
        selector = MagicMock()
        selector.__enter__.return_value = selector
        selector.select.return_value = [(None, None)]

        def spawn(command, **kwargs):
            if start_error:
                raise start_error
            kwargs["stderr"].write(stderr)
            return self.process

        clock = [0, publish.TRANSFER_SECONDS + 1] if timeout == "read" else None
        arguments = arguments or ["api", "--hostname", "github.com", "--method", "GET",
                                  f"/repos/{publish.REPOSITORY}/actions/runs/17"]
        with patch.object(publish.subprocess, "Popen", side_effect=spawn) as execute, \
                patch.object(publish.selectors, "DefaultSelector", return_value=selector), \
                patch.object(publish.os, "read", side_effect=[stdout, b""]), \
                patch.object(publish.time, "monotonic", side_effect=clock, return_value=0):
            self.execute = execute
            return publish.gh_to_file(arguments, self.directory / (self.SECRET + str(self.calls)), limit,
                                      allow_not_found=allow_not_found)

    def failure(self, **kwargs):
        with self.assertRaises(publish.PromotionError) as caught:
            self.request(**kwargs)
        self.execute.assert_called_once()
        self.assertNotIn(self.SECRET, str(caught.exception))
        self.assertNotIn(str(self.directory), str(caught.exception))
        return str(caught.exception)

    def test_operation_labels_come_from_exact_known_request_paths(self):
        prefix = f"/repos/{publish.REPOSITORY}"
        requests = (
            ("GET", "/git/ref/heads/main", "main-ref"),
            ("GET", "/actions/workflows/webos-native.yml", "candidate-workflow"),
            ("GET", "/actions/runs/17", "candidate-run"),
            ("GET", "/actions/runs/17/artifacts?per_page=100", "artifact-inventory"),
            ("GET", "/actions/artifacts/31/zip", "artifact-download"),
            ("GET", "/releases/assets/42", "release-asset-download"),
            ("GET", "/releases/23/assets?per_page=100", "release-asset-inventory"),
            ("GET", "/releases/tags/" + TAG, "release-by-tag"),
            ("GET", "/git/ref/tags/" + TAG, "tag-ref"),
            ("POST", "/git/refs", "tag-create"),
            ("POST", "/releases", "release-create"),
            ("GET", "/releases/23", "release-read"),
            ("PATCH", "/releases/23", "release-publish"),
        )
        for method, path, label in requests:
            with self.subTest(label=label):
                message = self.failure(stderr=b"gh: denied (HTTP 403)\n", arguments=[
                    "api", "--hostname", "github.com", "--method", method, prefix + path,
                ])
                self.assertEqual(message, f"GitHub request failed [{label}; HTTP 403]; no publication precondition inferred")
        for path, label in ((prefix + "/actions/artifacts/31/zip", "artifact-download"),
                            (prefix + "/releases/assets/42", "release-asset-download")):
            message = self.failure(stderr=b"gh: denied (HTTP 403)", arguments=[
                "api", "--hostname", "github.com", path, "-H", "Accept: application/octet-stream",
            ])
            self.assertIn("[" + label + "; HTTP 403]", message)
        message = self.failure(stderr=b"gh: denied (HTTP 403)", arguments=[
            "api", "--hostname", "github.com", "--method", "POST",
            f"https://uploads.github.com/repos/{publish.REPOSITORY}/releases/23/assets?name=ottplay-native-webos-0.1.0.ipk",
            "--input", "/private/" + self.SECRET,
        ])
        self.assertIn("[release-asset-upload; HTTP 403]", message)

    def test_unknown_paths_and_hosts_never_become_diagnostic_text(self):
        for host, path in (("evil.invalid", f"/repos/{publish.REPOSITORY}/actions/runs/17"),
                           ("github.com", "/repos/private/" + self.SECRET),
                           ("github.com", f"/repos/{publish.REPOSITORY}/actions/runs/17?token=" + self.SECRET)):
            with self.subTest(host=host):
                message = self.failure(stderr=b"unknown", arguments=["api", "--hostname", host, path])
                self.assertEqual(message, "GitHub request failed [api-request; class=command-failed]; no publication precondition inferred")

    def test_http_diagnostics_never_echo_secrets_urls_or_response_bodies(self):
        for code in (401, 403, 404, 429, 500, 503):
            for template in ("gh: {secret} https://signed.invalid/file?token={secret} (HTTP {code})\n",
                             "HTTP {code}: {secret} (https://signed.invalid/file?token={secret})\n"):
                with self.subTest(code=code, template=template):
                    message = self.failure(stderr=template.format(secret=self.SECRET, code=code).encode())
                    self.assertEqual(message, f"GitHub request failed [candidate-run; HTTP {code}]; no publication precondition inferred")
                    self.assertNotIn("signed.invalid", message)

    def test_only_complete_unambiguous_404_is_not_found(self):
        self.assertFalse(self.request(stderr=b"gh: Not Found (HTTP 404)\n", allow_not_found=True))
        for stderr in (b"gh: denied (HTTP 403)", b'{"body":"(HTTP 404)"}',
                       b"gh: Not Found (HTTP 404)\nHTTP 503: unavailable", b"(HTTP 404)",
                       b"HTTP 404: Not Found (https://api.github.com/private)",
                       b"gh: Not Found (HTTP 404)" + b" " * 8192):
            with self.subTest(stderr=stderr[:40]):
                self.failure(stderr=stderr, allow_not_found=True)

    def test_bare_gh_http_status_is_diagnostic_only(self):
        for code in (403, 404, 415):
            with self.subTest(code=code):
                message = self.failure(stderr=f"gh: HTTP {code}\n".encode(), allow_not_found=True)
                self.assertEqual(message, f"GitHub request failed [candidate-run; HTTP {code}]; no publication precondition inferred")

    def test_multiple_http_markers_never_establish_absence(self):
        variants = (
            "gh: denied (HTTP 403) (HTTP 404)",
            "gh: HTTP 403 (HTTP 404)",
            "gh: denied (HTTP 404) (HTTP 404)",
            "HTTP 403: denied (HTTP 404)",
            f"gh: {self.SECRET} https://signed.invalid/?token={self.SECRET} HTTP 415 (HTTP 404)",
            "gh: denied (HTTP 403)\n(HTTP 404)",
        )
        for raw in variants:
            with self.subTest(raw=raw):
                message = self.failure(stderr=raw.encode(), allow_not_found=True)
                self.assertEqual(message, "GitHub request failed [candidate-run; class=ambiguous-http-status]; no publication precondition inferred")
                self.assertNotIn("signed.invalid", message)

    def test_known_transport_failures_are_static_classes(self):
        cases = (
            ("dial tcp: lookup private.invalid: no such host", "dns"),
            ("tls: failed to verify certificate: x509: unknown authority", "tls"),
            ("dial tcp 10.0.0.1:443: connect: connection refused", "connection"),
            ("context deadline exceeded", "timeout"),
        )
        for detail, expected in cases:
            with self.subTest(expected=expected):
                stderr = f'Get "https://signed.invalid/?token={self.SECRET}": {detail}\n'.encode()
                message = self.failure(stderr=stderr)
                self.assertIn("class=" + expected, message)
                self.assertNotIn("signed.invalid", message)
                self.assertNotIn("private.invalid", message)
        message = self.failure(stderr=b'error body: timeout DNS secret\xff\x1b[31m')
        self.assertIn("class=command-failed", message)

    def test_stream_and_wait_timeouts_are_redacted_and_terminate_child(self):
        for timeout in ("read", "wait"):
            with self.subTest(timeout=timeout):
                message = self.failure(timeout=timeout)
                self.assertIn("[candidate-run; class=timeout]", message)
                self.process.kill.assert_called_once()
                self.process.stdout.close.assert_called_once()

    def test_start_error_response_limit_and_truncated_stderr_are_safe(self):
        message = self.failure(start_error=OSError(self.SECRET))
        self.assertIn("class=process-start", message)
        message = self.failure(stdout=b"12345", limit=4)
        self.assertIn("class=response-limit", message)
        message = self.failure(stderr=b"gh: secret (HTTP 404)" + b"x" * 8192, allow_not_found=True)
        self.assertIn("class=stderr-limit", message)

    def test_success_remains_success_even_with_error_like_stderr(self):
        self.assertTrue(self.request(status=0, stderr=b"gh: Not Found (HTTP 404)", stdout=b"{}"))
        self.execute.assert_called_once()

    def test_cli_prints_only_safe_diagnostic_even_when_timeout_has_secret_arguments(self):
        error_output = io.StringIO()
        arguments = ["publisher", "prepare", "--run-id", "17", "--source-sha", SHA,
                     "--version", VERSION, "--tag", TAG, "--output", self.SECRET]
        with patch.object(publish.sys, "argv", arguments), patch.object(publish.sys, "stderr", error_output), \
                patch.object(publish, "prepare", side_effect=lambda args: self.request(timeout="wait")):
            self.assertEqual(publish.main(), 1)
        self.assertEqual(error_output.getvalue(),
                         "FAIL: GitHub request failed [candidate-run; class=timeout]; no publication precondition inferred\n")


class ProvenanceTests(unittest.TestCase):
    def test_exact_run_workflow_and_artifact_are_accepted(self):
        publish.validate_run(run(), workflow(), inputs())
        value = artifact()
        self.assertEqual(publish.select_artifact({"total_count": 1, "artifacts": [value]}, inputs()), value)

    def test_invalid_input_cannot_reach_github(self):
        for args in ((0, SHA, VERSION, TAG), (True, SHA, VERSION, TAG),
                     (17, "b" * 39, VERSION, TAG), (17, "B" * 40, VERSION, TAG),
                     (17, SHA, "01.0.0", TAG), (17, SHA, VERSION, "v0.1.0"),
                     (17, SHA, VERSION, "native-webos-v0.2.0-beta.1"),
                     (17, SHA, VERSION, "native-webos-v0.1.0-beta.0")):
            with self.subTest(args=args), self.assertRaises(publish.PromotionError):
                publish.validate_inputs(*args)

    def test_run_must_be_direct_successful_same_repository_and_source(self):
        changes = {"id": 18, "workflow_id": 24, "event": "pull_request", "head_branch": "feature",
                   "head_sha": "c" * 40, "status": "in_progress", "conclusion": "failure",
                   "path": ".github/workflows/ci.yml", "repository": {"full_name": "fork/repo"},
                   "head_repository": {"full_name": "fork/repo"}}
        for key, value in changes.items():
            with self.subTest(key=key), self.assertRaises(publish.PromotionError):
                publish.validate_run(dict(run(), **{key: value}), workflow(), inputs())
        for event in ("pull_request_target", "workflow_call", "workflow_run", "push"):
            with self.subTest(event=event), self.assertRaises(publish.PromotionError):
                publish.validate_run(dict(run(), event=event), workflow(), inputs())
        with self.assertRaises(publish.PromotionError):
            publish.validate_run(run(), dict(workflow(), path=".github/workflows/ci.yml"), inputs())

    def test_missing_multiple_expired_or_unbound_artifacts_are_rejected(self):
        bad = [[], [artifact(), artifact()]]
        for changes in ({"expired": True}, {"id": 0}, {"size_in_bytes": 0},
                        {"size_in_bytes": publish.ZIP_LIMIT + 1}, {"digest": None},
                        {"digest": "sha256:bad"}, {"name": "other"},
                        {"workflow_run": {"id": 17, "head_sha": "c" * 40, "head_branch": "main"}},
                        {"workflow_run": {"id": 18, "head_sha": SHA, "head_branch": "main"}}):
            bad.append([dict(artifact(), **changes)])
        for rows in bad:
            with self.subTest(rows=rows), self.assertRaises((publish.PromotionError, TypeError)):
                publish.select_artifact({"total_count": len(rows), "artifacts": rows}, inputs())
        with self.assertRaises(publish.PromotionError):
            publish.select_artifact({"total_count": 101, "artifacts": [artifact()]}, inputs())

    def test_duplicate_json_keys_are_not_last_value_wins(self):
        with self.assertRaises(publish.PromotionError):
            publish.decode(b'{"source_sha":"a","source_sha":"b"}')

    def test_environment_rejects_wrong_repo_ref_sha_checkout_and_dirty_tree(self):
        env = {"GITHUB_REPOSITORY": publish.REPOSITORY, "GITHUB_REF": "refs/heads/main", "GITHUB_SHA": SHA}
        head = subprocess.CompletedProcess([], 0, (SHA + "\n").encode(), b"")
        clean = subprocess.CompletedProcess([], 0, b"", b"")
        for key, value in {"GITHUB_REPOSITORY": "fork/repo", "GITHUB_REF": "refs/heads/topic", "GITHUB_SHA": "c" * 40}.items():
            with self.subTest(key=key), patch.dict(os.environ, dict(env, **{key: value}), clear=True), \
                    patch.object(publish.subprocess, "run", side_effect=[head, clean]), \
                    patch.object(publish, "api_json", return_value={"object": {"sha": SHA, "type": "commit"}, "ref": "refs/heads/main"}), \
                    self.assertRaises(publish.PromotionError):
                publish.check_environment(inputs())
        for replies in ([subprocess.CompletedProcess([], 0, b"wrong\n", b"")],
                        [head, subprocess.CompletedProcess([], 1, b"", b"")]):
            with patch.dict(os.environ, env, clear=True), patch.object(publish.subprocess, "run", side_effect=replies), \
                    patch.object(publish, "api_json", return_value={"object": {"sha": SHA, "type": "commit"}, "ref": "refs/heads/main"}), \
                    self.assertRaises(publish.PromotionError):
                publish.check_environment(inputs())


    def test_current_main_must_still_match_candidate_at_publication(self):
        env = {"GITHUB_REPOSITORY": publish.REPOSITORY, "GITHUB_REF": "refs/heads/main", "GITHUB_SHA": SHA}
        replies = [subprocess.CompletedProcess([], 0, (SHA + "\n").encode(), b""),
                   subprocess.CompletedProcess([], 0, b"", b"")]
        with patch.dict(os.environ, env, clear=True), patch.object(publish.subprocess, "run", side_effect=replies), \
                patch.object(publish, "api_json", return_value={"ref": "refs/heads/main", "object": {"type": "commit", "sha": "c" * 40}}), \
                self.assertRaises(publish.PromotionError):
            publish.check_environment(inputs())


    def test_immutable_verification_can_allow_moved_main_but_still_binds_checkout(self):
        env = {"GITHUB_REPOSITORY": publish.REPOSITORY, "GITHUB_REF": "refs/heads/main", "GITHUB_SHA": SHA}
        for head_sha in (SHA, "c" * 40):
            replies = [subprocess.CompletedProcess([], 0, (head_sha + "\n").encode(), b""),
                       subprocess.CompletedProcess([], 0, b"", b"")]
            with self.subTest(head=head_sha), patch.dict(os.environ, env, clear=True), \
                    patch.object(publish.subprocess, "run", side_effect=replies), \
                    patch.object(publish, "api_json") as api:
                if head_sha == SHA:
                    publish.check_environment(inputs(), require_current_main=False)
                else:
                    with self.assertRaises(publish.PromotionError):
                        publish.check_environment(inputs(), require_current_main=False)
                api.assert_not_called()


class WorkerTests(unittest.TestCase):
    class Response(io.BytesIO):
        status = 200
        headers = {"Access-Control-Allow-Origin": "*"}

    def test_metadata_request_is_public_null_origin_and_bounded(self):
        response = self.Response(b"metadata")
        opener = SimpleNamespace(open=lambda request, timeout: response)
        with patch.object(publish, "build_opener", return_value=opener):
            self.assertEqual(publish.fetch_worker(publish.WORKER + "/v1/" + TAG + "/manifest.json", 8), b"metadata")
        def opened(request, timeout):
            self.assertEqual(request.get_header("Origin"), "null")
            self.assertIsNone(request.get_header("Authorization"))
            return self.Response(b"more than limit")
        with patch.object(publish, "build_opener", return_value=SimpleNamespace(open=opened)), \
                self.assertRaises(publish.PromotionError):
            publish.fetch_worker(publish.WORKER + "/v1/" + TAG + "/manifest.json", 4)

    def test_missing_cors_and_redirects_are_rejected(self):
        response = self.Response(b"metadata")
        response.headers = {}
        with patch.object(publish, "build_opener", return_value=SimpleNamespace(open=lambda *a, **kw: response)), \
                self.assertRaises(publish.PromotionError):
            publish.fetch_worker(publish.WORKER + "/v1/" + TAG + "/manifest.json", 8)
        with self.assertRaises(publish.PromotionError):
            publish.NoRedirect().redirect_request(None, None, 302, "redirect", {}, "https://elsewhere.invalid")


class UpdaterAssetDownloadTests(unittest.TestCase):
    def test_updater_supplies_official_digest_and_size_before_cache_commit(self):
        module = load("native_update_download_fixtures", ROOT / "tests/test_native_webos_update.py")
        fixture = module.OfficialReleaseValidationTests()
        fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        payloads = {row["name"]: (fixture.root / row["name"]).read_bytes()
                    for row in fixture.release_info["assets"]}
        loader = module.update.load_module
        def load_dependency(name):
            return publish if name == "publish-webos-native.py" else loader(name)
        def response(request, timeout):
            return WorkerTests.Response(payloads[request.full_url.rsplit("/", 1)[1]])
        def api(path):
            if "/git/ref/" in path:
                return fixture.ref_info
            return fixture.release_info
        with patch.object(module.update, "load_module", side_effect=load_dependency), \
                patch.object(publish, "api_json", side_effect=api), \
                patch.object(publish, "build_opener", return_value=SimpleNamespace(open=response)):
            cache = fixture.root / "cache"
            result = module.update.official_release(fixture.tag, cache)
            self.assertEqual(result["sha256"], fixture.metadata["sha256"])
            self.assertEqual(len(list(cache.iterdir())), 4)
            # Same-size corruption must not create the final IPK cache entry.
            name = fixture.stem + ".ipk"
            original = payloads[name]
            payloads[name] = bytes([original[0] ^ 1]) + original[1:]
            corrupt_cache = fixture.root / "corrupt-cache"
            with self.assertRaises(module.update.UpdateError):
                module.update.official_release(fixture.tag, corrupt_cache)
            self.assertFalse((corrupt_cache / name).exists())
            self.assertEqual(list(corrupt_cache.iterdir()), [])


class PublicAssetTransportTests(unittest.TestCase):
    def fetch(self, path, payload=b"new", limit=20, url="https://github.com/fixture/asset"):
        return publish.fetch_public_asset(url, path, limit,
                                          expected_sha256=hashlib.sha256(payload).hexdigest(),
                                          expected_size=len(payload))

    def test_public_download_sends_no_token_and_obeys_size_bound(self):
        url = "https://github.com/" + publish.REPOSITORY + "/releases/download/" + TAG + "/fixture.ipk"
        def opened(request, timeout):
            self.assertEqual(request.full_url, url)
            self.assertIsNone(request.get_header("Authorization"))
            self.assertIsNone(request.get_header("Cookie"))
            self.assertEqual(timeout, 10)
            return WorkerTests.Response(b"payload")
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {"GH_TOKEN": "must-not-be-sent"}), \
                patch.object(publish, "build_opener", return_value=SimpleNamespace(open=opened)):
            path = Path(tmp) / "asset"
            self.fetch(path, b"payload", 7, url)
            self.assertEqual(path.read_bytes(), b"payload")
            with self.assertRaises(publish.PromotionError):
                self.fetch(Path(tmp) / "too-large", b"payload", 6, url)
            self.assertFalse((Path(tmp) / "too-large").exists())
            self.assertEqual(list(Path(tmp).glob("*.part")), [])

    def test_interrupted_download_cleans_staging_and_can_retry(self):
        failure = OSError("synthetic interrupted stream")
        class Interrupted(WorkerTests.Response):
            def read1(self, size):
                if self.tell():
                    raise failure
                return super().read1(2)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "asset"
            opener = SimpleNamespace(open=lambda *args, **kwargs: Interrupted(b"partial"))
            with patch.object(publish, "build_opener", return_value=opener), self.assertRaises(OSError) as caught:
                self.fetch(path, b"partial")
            self.assertIs(caught.exception, failure)
            self.assertFalse(path.exists())
            self.assertEqual(list(Path(tmp).iterdir()), [])
            opener.open = lambda *args, **kwargs: WorkerTests.Response(b"complete")
            with patch.object(publish, "build_opener", return_value=opener):
                self.fetch(path, b"complete")
            self.assertEqual(path.read_bytes(), b"complete")

    def test_existing_and_concurrent_destination_are_never_removed_or_overwritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "asset"
            path.write_bytes(b"existing")
            opener = SimpleNamespace(open=lambda *args, **kwargs: WorkerTests.Response(b"new"))
            with patch.object(publish, "build_opener", return_value=opener), self.assertRaises(FileExistsError):
                self.fetch(path)
            self.assertEqual(path.read_bytes(), b"existing")
            path.unlink()
            for interrupt in (False, True):
                class Replaced(WorkerTests.Response):
                    def read1(self, size, should_interrupt=interrupt):
                        if not self.tell():
                            path.write_bytes(b"replacement")
                            if should_interrupt:
                                raise OSError("synthetic replacement during transfer")
                        return super().read1(size)
                opener.open = lambda *args, **kwargs: Replaced(b"new")
                with self.subTest(interrupt=interrupt), patch.object(publish, "build_opener", return_value=opener), \
                        self.assertRaises(OSError):
                    self.fetch(path)
                self.assertEqual(path.read_bytes(), b"replacement")
                path.unlink()
            path.symlink_to(Path(tmp) / "missing")
            with patch.object(publish, "build_opener", return_value=opener), self.assertRaises(FileExistsError):
                self.fetch(path)
            self.assertTrue(path.is_symlink())

    def test_fstat_failure_after_creation_leaves_no_final_and_retry_succeeds(self):
        failure = OSError("synthetic fstat failure")
        original_fstat = os.fstat
        failed = False
        def fail_once(fd):
            nonlocal failed
            if not failed:
                failed = True
                raise failure
            return original_fstat(fd)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "asset"
            opener = SimpleNamespace(open=lambda *args, **kwargs: WorkerTests.Response(b"new"))
            with patch.object(publish, "build_opener", return_value=opener), \
                    patch.object(publish.os, "fstat", side_effect=fail_once), self.assertRaises(OSError) as caught:
                self.fetch(path)
            self.assertIs(caught.exception, failure)
            self.assertFalse(path.exists())
            self.assertEqual(list(Path(tmp).iterdir()), [])
            with patch.object(publish, "build_opener", return_value=opener):
                self.fetch(path)
            self.assertEqual(path.read_bytes(), b"new")

    def test_fstat_failure_preserves_a_concurrent_final_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "asset"
            original_fstat = os.fstat
            failed = False
            def failed_stat(fd):
                nonlocal failed
                if not failed:
                    failed = True
                    path.write_bytes(b"replacement")
                    raise OSError("synthetic fstat failure")
                return original_fstat(fd)
            opener = SimpleNamespace(open=lambda *args, **kwargs: WorkerTests.Response(b"new"))
            with patch.object(publish, "build_opener", return_value=opener), \
                    patch.object(publish.os, "fstat", side_effect=failed_stat), self.assertRaises(OSError):
                self.fetch(path)
            self.assertEqual(path.read_bytes(), b"replacement")
            self.assertEqual(list(Path(tmp).iterdir()), [path])

    def test_unverified_or_changed_bytes_are_never_published(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "asset"
            for actual in (b"bad", b"ne", b"new-extra"):
                opener = SimpleNamespace(open=lambda *args, body=actual, **kwargs: WorkerTests.Response(body))
                with self.subTest(actual=actual), patch.object(publish, "build_opener", return_value=opener), \
                        self.assertRaises(publish.PromotionError):
                    self.fetch(path)
                self.assertFalse(path.exists())
                self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_verified_closed_file_is_committed_with_no_overwrite_link(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "asset"
            opener = SimpleNamespace(open=lambda *args, **kwargs: WorkerTests.Response(b"new"))
            link = publish.os.link
            def commit(source, destination, **kwargs):
                self.assertFalse(path.exists())
                self.assertEqual(source.read_bytes(), b"new")
                self.assertEqual(destination, path)
                self.assertEqual(kwargs, {"follow_symlinks": False})
                return link(source, destination, **kwargs)
            with patch.object(publish, "build_opener", return_value=opener), \
                    patch.object(publish.os, "link", side_effect=commit):
                self.fetch(path)
            self.assertEqual(path.read_bytes(), b"new")
            self.assertEqual(list(Path(tmp).iterdir()), [path])

    def test_cleanup_failure_preserves_primary_error(self):
        failure = OSError("synthetic stream failure")
        pending = []
        original_cleanup = tempfile.TemporaryDirectory.cleanup
        def failed_cleanup(staging):
            pending.append(staging)
            raise OSError("synthetic cleanup failure")
        class Interrupted(WorkerTests.Response):
            def read1(self, size):
                raise failure
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "asset"
            opener = SimpleNamespace(open=lambda *args, **kwargs: Interrupted(b"new"))
            with patch.object(publish, "build_opener", return_value=opener), \
                    patch.object(publish.tempfile.TemporaryDirectory, "cleanup", new=failed_cleanup), \
                    self.assertRaises(OSError) as caught:
                self.fetch(path)
            for staging in pending:
                original_cleanup(staging)
            self.assertIs(caught.exception, failure)
            self.assertIn("incomplete asset staging", caught.exception.__notes__[0])
            self.assertFalse(path.exists())

    def test_response_close_failure_does_not_publish_asset(self):
        class BadClose(WorkerTests.Response):
            def __exit__(self, *args):
                super().__exit__(*args)
                raise OSError("synthetic response close failure")
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "asset"
            opener = SimpleNamespace(open=lambda *args, **kwargs: BadClose(b"new"))
            with patch.object(publish, "build_opener", return_value=opener), self.assertRaises(OSError):
                self.fetch(path)
            self.assertFalse(path.exists())
            self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_killed_download_leaves_no_final_and_retry_succeeds(self):
        # Kill only our synthetic child, after its first partial write. No
        # network, SDK, external process name, or user file is involved.
        code = """
import hashlib, importlib.util, io, sys
from pathlib import Path
from types import SimpleNamespace
spec = importlib.util.spec_from_file_location('child_download', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class Response(io.BytesIO):
    status = 200
    def read1(self, size):
        if self.tell():
            Path(sys.argv[3]).write_text('ready')
            sys.stdin.buffer.read(1)
        return super().read1(2)
module.build_opener = lambda *args: SimpleNamespace(open=lambda *args, **kwargs: Response(b'new'))
module.fetch_public_asset('https://github.com/fixture/asset', Path(sys.argv[2]), 20,
                          expected_sha256=hashlib.sha256(b'new').hexdigest(), expected_size=3)
"""
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "asset"
            ready = Path(tmp) / "ready"
            env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
            child = subprocess.Popen([sys.executable, "-c", code, str(ROOT / "scripts/publish-webos-native.py"),
                                      str(path), str(ready)], stdin=subprocess.PIPE,
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
            try:
                deadline = time.monotonic() + 5
                while not ready.exists() and child.poll() is None and time.monotonic() < deadline:
                    time.sleep(0.01)
                self.assertTrue(ready.exists(), "synthetic child did not reach partial write")
                self.assertIsNone(child.poll())
                child.kill()
                child.communicate(timeout=5)
            finally:
                if child.poll() is None:
                    child.kill()
                child.communicate(timeout=5)
            self.assertFalse(path.exists())
            opener = SimpleNamespace(open=lambda *args, **kwargs: WorkerTests.Response(b"new"))
            with patch.object(publish, "build_opener", return_value=opener):
                self.fetch(path)
            self.assertEqual(path.read_bytes(), b"new")

    def test_redirect_restricts_hosts_protocol_credentials_and_count(self):
        safe = "https://release-assets.githubusercontent.com/fixture?signature=example"
        request = publish.Request("https://github.com/example", headers={
            "Authorization": "secret", "Cookie": "session=value", "Proxy-Authorization": "proxy"})
        redirect = publish.PublicRedirect()
        redirected = redirect.redirect_request(request, None, 302, "Found", {}, safe)
        for header in ("Authorization", "Cookie", "Proxy-Authorization"):
            self.assertIsNone(redirected.get_header(header))
        for url in ("http://github.com/file", "https://github.com.evil.invalid/file",
                    "https://user:secret@github.com/file", "https://@github.com/file", "https://github.com:444/file",
                    "https://127.0.0.1/file", "https://objects.githubusercontent.com/file#fragment"):
            with self.subTest(url=url), self.assertRaises(publish.PromotionError):
                publish.PublicRedirect().redirect_request(request, None, 302, "Found", {}, url)
        for _ in range(4):
            redirect.redirect_request(request, None, 302, "Found", {}, safe)
        with self.assertRaises(publish.PromotionError):
            redirect.redirect_request(request, None, 302, "Found", {}, safe)


class ZipTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.output = self.root / "output"
        self.output.mkdir()
        self.archive = self.root / "candidate.zip"

    def write(self, names=None, special=None):
        with warnings.catch_warnings(), zipfile.ZipFile(self.archive, "w", zipfile.ZIP_DEFLATED) as archive:
            warnings.simplefilter("ignore", UserWarning)
            for name in names or publish.candidate_names(VERSION):
                info = zipfile.ZipInfo(name)
                info.create_system = 3
                info.external_attr = ((stat.S_IFLNK if name == special else stat.S_IFREG) | 0o644) << 16
                archive.writestr(info, b"fixture")

    def test_exact_flat_regular_archive(self):
        self.write()
        publish.safe_extract(self.archive, self.output, VERSION)
        self.assertEqual({p.name for p in self.output.iterdir()}, set(publish.candidate_names(VERSION)))

    def test_traversal_nested_absolute_duplicate_and_unknown_are_rejected_before_writing(self):
        names = list(publish.candidate_names(VERSION))
        for replacement in ("../escape", "/tmp/escape", "folder/" + names[0], names[1], "unknown.txt"):
            self.write([replacement] + names[1:])
            with self.subTest(replacement=replacement), self.assertRaises(publish.PromotionError):
                publish.safe_extract(self.archive, self.output, VERSION)
            self.assertEqual(list(self.output.iterdir()), [])

    def test_symlink_extra_missing_and_empty_members_rejected(self):
        names = list(publish.candidate_names(VERSION))
        for case in ("symlink", "extra", "missing", "empty"):
            if case == "empty":
                with zipfile.ZipFile(self.archive, "w") as archive:
                    for name in names:
                        archive.writestr(name, b"" if name == names[0] else b"fixture")
            else:
                self.write(names + ["extra"] if case == "extra" else names[:-1] if case == "missing" else names,
                           names[0] if case == "symlink" else None)
            with self.subTest(case=case), self.assertRaises(publish.PromotionError):
                publish.safe_extract(self.archive, self.output, VERSION)
            self.assertEqual(list(self.output.iterdir()), [])

    def test_existing_output_and_archive_symlink_rejected(self):
        self.write()
        (self.output / "keep").write_bytes(b"original")
        with self.assertRaises(publish.PromotionError):
            publish.safe_extract(self.archive, self.output, VERSION)
        self.assertEqual((self.output / "keep").read_bytes(), b"original")
        link = self.root / "link.zip"
        link.symlink_to(self.archive)
        with self.assertRaises(publish.PromotionError):
            publish.safe_extract(link, self.output, VERSION)

    def test_expansion_and_trailing_data_rejected(self):
        self.write()
        with patch.object(publish, "EXPANDED_LIMIT", 10), self.assertRaises(publish.PromotionError):
            publish.safe_extract(self.archive, self.output, VERSION)
        self.archive.write_bytes(self.archive.read_bytes() + b"trailing")
        with self.assertRaises(publish.PromotionError):
            publish.safe_extract(self.archive, self.output, VERSION)


class FakeGitHub:
    """Only the exact repository API exists; unexpected calls fail the test."""
    def __init__(self, archive):
        self.archive = archive
        self.events = []
        self.assets = {}
        self.tag = None
        self.release = None
        self.corrupt = None
        self.tag_moves = False
        self.artifact = artifact(archive)

    def api(self, path, *, method="GET", payload=None, allow_not_found=False):
        self.events.append((method, path, copy.deepcopy(payload)))
        prefix = "/repos/" + publish.REPOSITORY
        if path == prefix + "/actions/workflows/webos-native.yml":
            return workflow()
        if path == prefix + "/actions/runs/17":
            return run()
        if path == prefix + "/actions/runs/17/artifacts?per_page=100":
            return {"total_count": 1, "artifacts": [self.artifact]}
        if path == prefix + "/git/ref/heads/main":
            return {"ref": "refs/heads/main", "object": {"type": "commit", "sha": SHA}}
        if path == prefix + "/git/ref/tags/" + TAG:
            return self.tag
        if path == prefix + "/git/refs" and method == "POST":
            if self.tag is not None:
                raise publish.PromotionError("ref already exists")
            self.tag = {"ref": payload["ref"], "object": {"type": "commit", "sha": payload["sha"]}}
            return self.tag
        if path == prefix + "/releases/tags/" + TAG:
            return self.release
        if path == prefix + "/releases" and method == "POST":
            self.release = dict(payload, id=55)
            return copy.deepcopy(self.release)
        if path == prefix + "/releases/55/assets?per_page=100":
            return [{"id": 100 + index, "name": name, "state": "uploaded", "size": len(data)}
                    for index, (name, data) in enumerate(self.assets.items())]
        if path == prefix + "/releases/55":
            if method == "PATCH":
                self.release.update(payload)
            return copy.deepcopy(self.release)
        raise AssertionError((method, path, payload, allow_not_found))

    def download(self, path, destination, limit, *, accept="application/octet-stream"):
        self.events.append(("DOWNLOAD", path, None))
        if path.endswith("/actions/artifacts/31/zip"):
            data = self.archive
        else:
            index = int(path.rsplit("/", 1)[1]) - 100
            name, data = list(self.assets.items())[index]
            if name == self.corrupt:
                data = bytes([data[0] ^ 0xFF]) + data[1:]
            if self.tag_moves:
                self.tag = {"ref": "refs/tags/" + TAG, "object": {"type": "commit", "sha": "c" * 40}}
        assert len(data) <= limit
        destination.write_bytes(data)

    def public_download(self, url, destination, limit, *, expected_sha256, expected_size):
        prefix = "https://github.com/" + publish.REPOSITORY + "/releases/download/" + TAG + "/"
        assert url.startswith(prefix) and self.release["draft"] is False
        name = url[len(prefix):]
        self.events.append(("PUBLIC_DOWNLOAD", url, None))
        data = self.assets[name]
        assert len(data) <= limit
        assert len(data) == expected_size
        assert hashlib.sha256(data).hexdigest() == expected_sha256
        destination.write_bytes(data)

    def upload(self, release_id, name, path):
        assert release_id == 55 and self.release["draft"] is True and name not in self.assets
        self.events.append(("UPLOAD", name, None))
        self.assets[name] = path.read_bytes()
        return {"id": 100 + len(self.assets) - 1, "name": name}


class PromotionPipelineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        source = self.root / "source"
        source.mkdir()
        self.fixture = fixtures.Bundle(source)
        raw = io.BytesIO()
        with zipfile.ZipFile(raw, "w", zipfile.ZIP_DEFLATED) as archive:
            for name in publish.candidate_names(VERSION):
                archive.writestr(name, (source / name).read_bytes())
        self.gh = FakeGitHub(raw.getvalue())
        self.directory = self.root / "prepared"
        self.args = SimpleNamespace(**{key: value for key, value in inputs().items() if key != "repository"}, output=self.directory)
        self.environment = self.start(patch.object(publish, "check_environment"))
        self.notes = self.start(patch.object(publish, "release_body", return_value=publish.DEFAULT_RELEASE_BODY))
        self.real_download_api = publish.download_api
        self.start(patch.object(publish, "api_json", side_effect=self.gh.api))
        self.start(patch.object(publish, "download_api", side_effect=self.gh.download))
        self.start(patch.object(publish, "upload_asset", side_effect=self.gh.upload))
        self.start(patch.object(publish, "fetch_public_asset", side_effect=self.gh.public_download))
        self.start(patch.object(publish, "verifier_module", return_value=fixtures.release))
        # Only checkout facts are synthetic: IPK, source archives, receipts and
        # generated feeds pass through the complete production verifier.
        self.start(patch.object(fixtures.release.build, "manifest", return_value={"application": self.fixture.app, "revision": "a" * 40}))
        self.start(patch.object(fixtures.release.build, "integration_digest", return_value=self.fixture.integration_hash))

    def start(self, patcher):
        value = patcher.start()
        self.addCleanup(patcher.stop)
        return value

    def test_actions_and_release_asset_downloads_use_their_required_accept_types(self):
        requests = []

        def transfer(arguments, destination, limit):
            self.assertEqual(arguments[:3], ["api", "--hostname", "github.com"])
            path = arguments[3]
            header = arguments[arguments.index("-H") + 1]
            if "/actions/artifacts/" in path:
                self.assertEqual(header, "Accept: application/vnd.github+json",
                                 "Actions archive API rejects octet-stream with HTTP 415")
            else:
                self.assertIn("/releases/assets/", path)
                self.assertEqual(header, "Accept: application/octet-stream",
                                 "Release assets require binary content, not JSON metadata")
            requests.append((path, header))
            self.gh.download(path, destination, limit)
            return True

        with patch.object(publish, "download_api", side_effect=self.real_download_api), \
                patch.object(publish, "gh_to_file", side_effect=transfer):
            self.prepare()
            self.do_publish()
        self.assertEqual(sum("/actions/artifacts/" in path for path, _header in requests), 2)
        self.assertEqual(sum("/releases/assets/" in path for path, _header in requests), 10)

    def prepare(self):
        return publish.prepare(self.args)

    def do_publish(self):
        return publish.publish(SimpleNamespace(bundle=self.directory))

    def test_prepare_full_verifier_generates_feed_bound_to_exact_tag(self):
        receipt = self.prepare()
        self.assertEqual(set(receipt["files"]), set(publish.release_names(VERSION)))
        self.assertEqual(receipt["artifact"], {key: self.gh.artifact[key] for key in ("id", "digest")})
        report = publish.verify_bundle(self.directory, VERSION)
        self.assertEqual(report["bundle_validation"], "PASS")
        self.assertTrue(report["checkout_validated"] and report["homebrew_validated"])
        feed = json.loads((self.directory / "ottplay-native-webos-manifest.json").read_text())
        self.assertIn("/releases/download/" + TAG + "/", feed["ipkUrl"])
        self.assertIn("/v1/" + TAG + "/", feed["iconUri"])

    def test_candidate_digest_tamper_rejected_before_extraction(self):
        self.gh.artifact["digest"] = "sha256:" + "0" * 64
        with self.assertRaisesRegex(publish.PromotionError, "digest"):
            self.prepare()
        self.assertFalse((self.directory / publish.RECEIPT).exists())

    def test_invalid_source_archive_fails_complete_verifier(self):
        raw = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(self.gh.archive)) as original, zipfile.ZipFile(raw, "w") as changed:
            for name in original.namelist():
                changed.writestr(name, b"broken" if name.endswith("-runtime-source.tar.gz") else original.read(name))
        self.gh.archive = raw.getvalue()
        self.gh.artifact = artifact(self.gh.archive)
        with self.assertRaises(ValueError):
            self.prepare()
        self.assertFalse((self.directory / publish.RECEIPT).exists())

    def test_publish_downloads_and_checks_every_draft_asset_before_visibility(self):
        self.prepare()
        result = self.do_publish()
        self.assertTrue(result["published"])
        self.assertFalse(self.gh.release["draft"])
        self.assertEqual(set(self.gh.assets), set(publish.release_names(VERSION)))
        public = next(i for i, event in enumerate(self.gh.events) if event[0] == "PATCH")
        downloads = [i for i, event in enumerate(self.gh.events) if event[0] == "DOWNLOAD" and "/releases/assets/" in event[1]]
        self.assertEqual(len(downloads), 10)
        self.assertLess(max(downloads), public)
        self.assertEqual(sum(event[0] == "DOWNLOAD" and event[1].endswith("/zip") for event in self.gh.events), 2)
        self.assertFalse(any(event[0] == "DELETE" for event in self.gh.events))

    def test_version_notes_are_published_with_the_verified_bundle(self):
        self.prepare()
        self.notes.return_value = "# Native changes\n\nVerified package notes."
        self.do_publish()
        self.assertEqual(self.gh.release["body"], self.notes.return_value)
        self.notes.assert_called_once_with(inputs())

    def test_invalid_notes_fail_before_tag_or_release_mutation(self):
        self.prepare()
        self.notes.side_effect = publish.PromotionError("Invalid notes fixture")
        with self.assertRaises(publish.PromotionError):
            self.do_publish()
        self.assertIsNone(self.gh.tag)
        self.assertIsNone(self.gh.release)
        self.assertFalse(any(event[0] in ("POST", "PATCH", "UPLOAD") for event in self.gh.events))

    def test_draft_notes_changed_during_asset_checks_are_not_published(self):
        self.prepare()
        compare = publish.compare_assets

        def edited(*args):
            compare(*args)
            self.gh.release["body"] = "Changed draft text"

        with patch.object(publish, "compare_assets", side_effect=edited), self.assertRaisesRegex(publish.PromotionError, "notes changed"):
            self.do_publish()
        self.assertTrue(self.gh.release["draft"])
        self.assertFalse(any(event[0] == "PATCH" for event in self.gh.events))

    def test_draft_edit_after_final_read_cannot_replace_verified_notes(self):
        self.prepare()
        self.notes.return_value = "# Verified version notes\n\nPackage changes."
        edits = []

        def edit_before_patch(path, **kwargs):
            if kwargs.get("method") == "PATCH":
                self.gh.release["body"] = "Concurrent unverified edit"
                edits.append(path)
            return self.gh.api(path, **kwargs)

        with patch.object(publish, "api_json", side_effect=edit_before_patch):
            result = self.do_publish()
        self.assertTrue(result["published"])
        self.assertEqual(len(edits), 1)
        self.assertFalse(self.gh.release["draft"])
        self.assertEqual(self.gh.release["body"], self.notes.return_value)

    def test_unexpected_published_notes_are_not_reported_as_success(self):
        self.prepare()

        def changed_response(path, **kwargs):
            response = self.gh.api(path, **kwargs)
            if kwargs.get("method") == "PATCH":
                response["body"] = "Unexpected published text"
            return response

        with patch.object(publish, "api_json", side_effect=changed_response), \
                self.assertRaisesRegex(publish.PromotionError, "Published release notes differ"):
            self.do_publish()

    def test_existing_release_or_tag_is_never_overwritten(self):
        self.prepare()
        for kind in ("release", "tag"):
            self.gh.release = {"id": 55, "draft": True, "tag_name": TAG} if kind == "release" else None
            self.gh.tag = {"ref": "refs/tags/" + TAG, "object": {"type": "commit", "sha": SHA}} if kind == "tag" else None
            self.gh.events.clear()
            with self.subTest(kind=kind), self.assertRaises(publish.PromotionError):
                self.do_publish()
            self.assertFalse(any(event[0] in ("POST", "PATCH", "UPLOAD", "DELETE") for event in self.gh.events))

    def test_replaced_candidate_artifact_cannot_be_promoted_from_old_receipt(self):
        self.prepare()
        self.gh.artifact["id"] = 32
        # The changed identity is enough; keep fake download bytes constant.
        download = self.gh.download
        def current_download(path, destination, limit, **kwargs):
            download(path.replace("/artifacts/32/", "/artifacts/31/"), destination, limit, **kwargs)
        with patch.object(publish, "download_api", side_effect=current_download), \
                self.assertRaisesRegex(publish.PromotionError, "artifact changed"):
            self.do_publish()
        self.assertFalse(any(event[0] in ("POST", "PATCH", "UPLOAD") for event in self.gh.events))

    def test_corrupt_uploaded_bytes_leave_release_draft(self):
        self.prepare()
        self.gh.corrupt = publish.candidate_names(VERSION)[0]
        with self.assertRaisesRegex(publish.PromotionError, "bytes differ"):
            self.do_publish()
        self.assertTrue(self.gh.release["draft"])
        self.assertFalse(any(event[0] == "PATCH" for event in self.gh.events))

    def test_tag_move_before_visibility_leaves_release_draft(self):
        self.prepare()
        self.gh.tag_moves = True
        with self.assertRaisesRegex(publish.PromotionError, "tag target"):
            self.do_publish()
        self.assertTrue(self.gh.release["draft"])

    def test_modified_local_bundle_and_forged_receipt_cannot_replace_candidate(self):
        receipt = self.prepare()
        name = "ottplay-native-webos-icon.png"
        (self.directory / name).write_bytes(b"forged")
        with self.assertRaisesRegex(publish.PromotionError, "digest"):
            self.do_publish()
        receipt["files"][name] = publish.file_digest(self.directory / name)
        (self.directory / publish.RECEIPT).write_text(json.dumps(receipt))
        with self.assertRaises(ValueError):
            self.do_publish()
        self.assertFalse(any(event[0] in ("POST", "PATCH", "UPLOAD") for event in self.gh.events))

    def test_forged_feed_with_consistent_receipt_is_rejected_by_source_recheck(self):
        receipt = self.prepare()
        name = "ottplay-native-webos-manifest.json"
        path = self.directory / name
        feed = json.loads(path.read_text())
        feed["ipkUrl"] = feed["ipkUrl"].replace(TAG, "native-webos-v0.1.0-beta.9")
        for key in ("sourceUrl",):
            feed[key] = feed[key].replace(TAG, "native-webos-v0.1.0-beta.9")
        feed["sourceArchiveUrls"] = [url.replace(TAG, "native-webos-v0.1.0-beta.9") for url in feed["sourceArchiveUrls"]]
        path.write_text(json.dumps(feed))
        receipt["files"][name] = publish.file_digest(path)
        (self.directory / publish.RECEIPT).write_text(json.dumps(receipt))
        with self.assertRaisesRegex(publish.PromotionError, "exact feed"):
            self.do_publish()
        self.assertIsNone(self.gh.release)

    def test_public_verification_cannot_pass_when_only_authenticated_download_works(self):
        self.prepare()
        self.do_publish()
        # The authenticated asset API remains healthy; only the public path fails.
        with patch.object(publish, "fetch_public_asset", side_effect=publish.PromotionError("anonymous download unavailable")), \
                patch.object(publish, "fetch_worker", side_effect=lambda url, limit: self.gh.assets[url.rsplit("/", 1)[1]]), \
                self.assertRaisesRegex(publish.PromotionError, "anonymous download unavailable"):
            publish.verify_public(SimpleNamespace(bundle=self.directory))

    def test_only_public_verification_relaxes_the_current_main_requirement(self):
        self.prepare()
        self.do_publish()
        self.assertTrue(self.environment.call_args_list)
        self.assertTrue(all(call.kwargs.get("require_current_main", True) for call in self.environment.call_args_list))
        self.environment.reset_mock()
        self.gh.events.clear()
        with patch.object(publish, "fetch_worker", side_effect=lambda url, limit: self.gh.assets[url.rsplit("/", 1)[1]]):
            publish.verify_public(SimpleNamespace(bundle=self.directory))
        self.environment.assert_called_once_with(inputs(), require_current_main=False)
        anonymous = [event for event in self.gh.events if event[0] == "PUBLIC_DOWNLOAD"]
        self.assertEqual(len(anonymous), 10)
        self.assertFalse(any(event[0] == "DOWNLOAD" for event in self.gh.events),
                         "public validation must not substitute authenticated asset bytes")

    def test_public_verification_compares_assets_and_worker_metadata(self):
        self.prepare()
        self.do_publish()
        def worker(url, limit):
            self.assertTrue(url.startswith(publish.WORKER + "/v1/" + TAG + "/"))
            return self.gh.assets[url.rsplit("/", 1)[1]]
        with patch.object(publish, "fetch_worker", side_effect=worker):
            self.assertEqual(publish.verify_public(SimpleNamespace(bundle=self.directory))["public_assets"], "PASS")
        with patch.object(publish, "fetch_worker", return_value=b"stale"), self.assertRaisesRegex(publish.PromotionError, "worker bytes"):
            publish.verify_public(SimpleNamespace(bundle=self.directory))


if __name__ == "__main__":
    unittest.main()
