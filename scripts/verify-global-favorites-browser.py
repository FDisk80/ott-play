#!/usr/bin/env python3
"""Verify saved mixed-Favorites browser evidence against the CI checkout/event."""
import argparse
import base64
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time

SPEC = "tests/browser/global-favorites-mixed.spec.cjs"
TITLES = (
    "M3U Local remembers a browsed Favorites category after quit and relaunch",
    "temporary Local shuffle retains global Favorites and can return to M3U",
    "temporary Local shuffle retains category Favorites and can return to M3U",
    "receiver with reordered profiles plays imported mixed Favorites through the real list",
    "mixed Favorites refuses fallback: missing-profile",
    "mixed Favorites refuses fallback: ambiguous-profile",
    "mixed Favorites refuses fallback: missing-local-root",
    "mixed Favorites refuses fallback: ambiguous-local-root",
)
SOURCE_FILES = (
    ".github/workflows/ci.yml", "scripts/verify-global-favorites-browser.py",
    "tests/test_global_favorites_browser_evidence.py",
    "tests/python-suites.json",
    "playwright.config.cjs", "package.json", SPEC,
    "tests/helpers/global-mixed-browser.cjs", "tests/fixtures/global-mixed-sequence.json",
)
OID = re.compile(r"[0-9a-f]{40}\Z")
MAX_JSON = 32 * 1024 * 1024


class EvidenceError(Exception):
    pass


def require(value, code):
    if not value:
        raise EvidenceError(code)


def object_pairs(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "duplicate_json_key")
        result[key] = value
    return result


def parse_json(raw):
    def nonfinite(_):
        raise EvidenceError("nonfinite_json")
    def finite_float(value):
        number = float(value)
        require(math.isfinite(number), "nonfinite_json")
        return number
    try:
        return json.loads(raw.decode("utf-8"), object_pairs_hook=object_pairs,
                          parse_constant=nonfinite, parse_float=finite_float)
    except EvidenceError:
        raise
    except (ValueError, UnicodeError, RecursionError):
        raise EvidenceError("invalid_json") from None


def read_bounded(path, limit=MAX_JSON):
    with Path(path).open("rb") as stream:
        raw = stream.read(limit + 1)
    require(len(raw) <= limit, "file_too_large")
    return raw


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def oid(value):
    require(type(value) is str and OID.fullmatch(value), "invalid_commit_id")
    return value


def field(env, key, limit=512):
    value = env.get(key)
    require(type(value) is str and 0 < len(value) <= limit
            and not any(ord(c) < 32 or ord(c) == 127 for c in value), "invalid_ci_identity")
    return value


def bind_revision(head, commit, event, env):
    """Read parent headers from the commit object, even in a shallow checkout."""
    head = oid(head)
    require(type(event) is dict, "invalid_event")
    require(head == oid(env.get("GITHUB_SHA")), "checkout_sha_mismatch")
    try:
        headers = commit.decode("utf-8").split("\n\n", 1)[0].splitlines()
    except UnicodeError:
        raise EvidenceError("invalid_commit_object") from None
    trees = [line[5:] for line in headers if line.startswith("tree ")]
    parents = [oid(line[7:]) for line in headers if line.startswith("parent ")]
    require(len(trees) == 1, "invalid_commit_object")
    event_name = field(env, "GITHUB_EVENT_NAME", 64)
    identity = {"head": head, "tree": oid(trees[0]), "parents": parents,
                "event_name": event_name, "event_binding": "checkout"}
    if "pull_request" in event:
        pr = event["pull_request"]
        require(type(pr) is dict and type(pr.get("base")) is dict
                and type(pr.get("head")) is dict, "invalid_pr_event")
        base, tip = oid(pr["base"].get("sha")), oid(pr["head"].get("sha"))
        require(parents == [base, tip], "pr_merge_parents_mismatch")
        number = event.get("number", pr.get("number"))
        require(type(number) is int and number > 0, "invalid_pr_event")
        identity.update(event_binding="pull_request_merge", pr_number=number,
                        base_sha=base, head_sha=tip)
    elif "merge_group" in event:
        group = event["merge_group"]
        require(type(group) is dict and oid(group.get("head_sha")) == head,
                "merge_group_sha_mismatch")
        identity["event_binding"] = "merge_group"
    else:
        require(event_name not in ("pull_request", "pull_request_target", "merge_group"),
                "missing_event_identity")
        if event_name == "push":
            require(oid(event.get("after")) == head, "push_sha_mismatch")
            identity["event_binding"] = "push"
    identity["run_id"] = field(env, "GITHUB_RUN_ID", 32)
    identity["run_attempt"] = field(env, "GITHUB_RUN_ATTEMPT", 16)
    require(re.fullmatch(r"[1-9][0-9]*", identity["run_id"])
            and re.fullmatch(r"[1-9][0-9]*", identity["run_attempt"]), "invalid_run_identity")
    for key in ("GITHUB_REPOSITORY", "GITHUB_WORKFLOW", "GITHUB_WORKFLOW_REF", "GITHUB_JOB"):
        identity[key.lower().removeprefix("github_")] = field(env, key)
    identity["workflow_sha"] = oid(env.get("GITHUB_WORKFLOW_SHA"))
    return identity


def run_git(root, args, deadline):
    remaining = deadline - time.monotonic()
    require(remaining > 0, "verifier_deadline")
    try:
        result = subprocess.run(["git", "-C", str(root), *args], capture_output=True,
                                timeout=min(5, remaining), check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise EvidenceError("git_unavailable") from None
    require(result.returncode == 0 and len(result.stdout) <= 1024 * 1024, "git_identity_failed")
    return result.stdout


def collect_identity(root, env, deadline):
    head = run_git(root, ["rev-parse", "--verify", "HEAD"], deadline).decode("ascii").strip()
    commit = run_git(root, ["cat-file", "-p", oid(head)], deadline)
    event_raw = read_bounded(field(env, "GITHUB_EVENT_PATH", 4096), 4 * 1024 * 1024)
    identity = bind_revision(head, commit, parse_json(event_raw), env)
    identity["event_sha256"] = sha(event_raw)
    run_git(root, ["ls-files", "--error-unmatch", "--", *SOURCE_FILES], deadline)
    run_git(root, ["diff", "--quiet", head, "--", *SOURCE_FILES], deadline)
    identity["source_sha256"] = {
        name: sha(read_bounded(root / name, 2 * 1024 * 1024)) for name in SOURCE_FILES
    }
    return identity


def capture_provenance(root, output, env):
    """Save original observations before tests, without certifying acceptance."""
    receipt = {"version": 1, "status": "failed", "code": "capture_unavailable",
               "scope": "raw checkout/event observations, not browser qualification"}
    deadline = time.monotonic() + 30
    try:
        head = oid(run_git(root, ["rev-parse", "--verify", "HEAD"], deadline)
                   .decode("ascii").strip())
        commit = run_git(root, ["cat-file", "-p", head], deadline)
        event_raw = read_bounded(field(env, "GITHUB_EVENT_PATH", 4096), 4 * 1024 * 1024)
        # Base64 retains the exact bytes, including whitespace and line endings.
        # Keep them in the artifact only, never in the console or the verdict.
        receipt["raw"] = {
            "commit": {"sha256": sha(commit), "bytes": len(commit),
                       "base64": base64.b64encode(commit).decode("ascii")},
            "event": {"sha256": sha(event_raw), "bytes": len(event_raw),
                      "base64": base64.b64encode(event_raw).decode("ascii")},
        }
        receipt["context"] = {
            key: field(env, key) for key in (
                "GITHUB_SHA", "GITHUB_EVENT_NAME", "GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT",
                "GITHUB_REPOSITORY", "GITHUB_WORKFLOW", "GITHUB_WORKFLOW_REF",
                "GITHUB_WORKFLOW_SHA", "GITHUB_JOB",
            )
        }
        headers = commit.decode("utf-8").split("\n\n", 1)[0].splitlines()
        trees = [oid(line[5:]) for line in headers if line.startswith("tree ")]
        parents = [oid(line[7:]) for line in headers if line.startswith("parent ")]
        require(len(trees) == 1, "invalid_commit_object")
        receipt["observed"] = {"head": head, "tree": trees[0], "parents": parents}
        event = parse_json(event_raw)
        require(type(event) is dict, "invalid_event")
        if "pull_request" in event:
            pr = event["pull_request"]
            require(type(pr) is dict and type(pr.get("base")) is dict
                    and type(pr.get("head")) is dict, "invalid_pr_event")
            receipt["expected_pr_parents"] = [
                oid(pr["base"].get("sha")), oid(pr["head"].get("sha")),
            ]
        # Deliberately do not bind_revision here: retain a mismatch and let the
        # final unchanged verifier reject it after the browser step.
        require(time.monotonic() < deadline, "capture_deadline")
        receipt.update(status="captured", code="captured")
    except EvidenceError as error:
        receipt["code"] = str(error)
    except (OSError, ValueError, TypeError, KeyError, RecursionError):
        receipt["code"] = "capture_unavailable_or_malformed"
    try:
        write_verdict(output, receipt)
    except OSError:
        print("Mixed Favorites provenance: capture_write_failed", flush=True)
        return 1
    print("Mixed Favorites provenance: " + receipt["code"], flush=True)
    return 0 if receipt["status"] == "captured" else 1


def validate_report(report, root):
    require(type(report) is dict and report.get("errors") == [], "report_errors")
    config = report.get("config")
    require(type(config) is dict and type(config.get("rootDir")) is str, "report_root")
    directory = Path(config["rootDir"])
    require(directory.is_absolute() and directory.resolve() in (root, root / "tests/browser"),
            "report_root")
    projects = config.get("projects")
    require(type(projects) is list and len(projects) == 1
            and type(projects[0]) is dict, "report_project")
    project = projects[0]
    require(type(project.get("id")) is str and len(project["id"]) <= 256
            and project.get("name") == "" and type(project.get("repeatEach")) is int
            and project["repeatEach"] == 1 and type(project.get("retries")) is int
            and project["retries"] == 0, "report_project")
    require(type(project.get("testDir")) is str
            and Path(project["testDir"]).resolve() == root / "tests/browser", "report_project")
    suites = report.get("suites")
    require(type(suites) is list, "report_structure")
    selected, stack, seen = [], list(suites), 0
    while stack:
        suite = stack.pop()
        seen += 1
        require(seen <= 10000 and type(suite) is dict, "report_structure")
        children, specs = suite.get("suites", []), suite.get("specs", [])
        require(type(children) is list and type(specs) is list, "report_structure")
        stack.extend(children)
        for spec in specs:
            seen += 1
            require(seen <= 10000 and type(spec) is dict and type(spec.get("file")) is str,
                    "report_structure")
            file = Path(spec["file"])
            if file.name != Path(SPEC).name:
                continue
            actual = file if file.is_absolute() else directory / file
            require(actual.resolve() == root / SPEC, "spec_path_mismatch")
            selected.append(spec)
    require(len(selected) == len(TITLES) and
            sorted(s.get("title", "") for s in selected) == sorted(TITLES), "exact_required_cases")
    for spec in selected:
        require(spec.get("ok") is True and type(spec.get("tests")) is list
                and len(spec["tests"]) == 1, "case_not_passed")
        test = spec["tests"][0]
        require(type(test) is dict and test.get("expectedStatus") == "passed"
                and test.get("status") == "expected", "case_not_passed")
        require(test.get("projectId") == project["id"]
                and test.get("projectName") == project["name"], "case_project_mismatch")
        results = test.get("results")
        require(type(results) is list and len(results) == 1, "case_retried_or_missing")
        result = results[0]
        require(type(result) is dict and result.get("status") == "passed"
                and type(result.get("retry")) is int and result["retry"] == 0
                and result.get("errors") == [] and result.get("error") is None, "case_not_passed")
    return [{"file": SPEC, "title": title, "status": "passed", "retry": 0} for title in TITLES]


def write_verdict(path, verdict):
    """Atomically persist both positive and negative verdicts before returning."""
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = (json.dumps(verdict, sort_keys=True, indent=2) + "\n").encode()
    fd, temporary = tempfile.mkstemp(prefix=".verdict-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        # Windows does not support this directory-open/fsync interface. The
        # file is still synced before atomic replacement on every platform.
        if os.name != "nt":
            parent = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(parent)
            finally:
                os.close(parent)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def verify(root, report_path, output, browser_outcome, env):
    verdict = {"version": 1, "status": "failed", "code": "unverified",
               "scope": "eight synthetic mixed-Favorites browser cases", "real_device_qualified": False}
    deadline = time.monotonic() + 30
    try:
        verdict["identity"] = collect_identity(root, env, deadline)
        raw = read_bounded(report_path)
        verdict["report_sha256"] = sha(raw)
        verdict["cases"] = validate_report(parse_json(raw), root)
        require(browser_outcome == "success", "browser_step_not_successful")
        require(time.monotonic() < deadline, "verifier_deadline")
        verdict.update(status="passed", code="verified")
    except EvidenceError as error:
        verdict["code"] = str(error)
    except (OSError, ValueError, TypeError, KeyError, RecursionError):
        verdict["code"] = "evidence_unavailable_or_malformed"
    try:
        write_verdict(output, verdict)
    except OSError:
        print("Mixed Favorites evidence: verdict_write_failed", flush=True)
        return 1
    print("Mixed Favorites evidence: " + verdict["code"], flush=True)
    return 0 if verdict["status"] == "passed" else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture-provenance", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--browser-outcome")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    if args.capture_provenance is not None:
        if any(value is not None for value in (args.report, args.output, args.browser_outcome)):
            parser.error("capture and verification arguments cannot be combined")
        return capture_provenance(root, args.capture_provenance, os.environ)
    if any(value is None for value in (args.report, args.output, args.browser_outcome)):
        parser.error("verification requires --report, --output and --browser-outcome")
    return verify(root, args.report, args.output, args.browser_outcome, os.environ)


if __name__ == "__main__":
    sys.exit(main())
