#!/usr/bin/env python3
"""Promote one verified native webOS candidate without rebuilding it.

An existing tag or release is an error, including a draft left by a failed
attempt. Recovery is an operator decision: this tool never deletes or replaces
release assets or refs. promotion.json is an internal handoff, not a release
asset or independent attestation. Publication re-downloads the source artifact.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import selectors
import stat
import struct
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
from urllib.parse import quote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import zipfile

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = "open-ott-play/ottplay-foss"
WORKFLOW = "webos-native.yml"
ARTIFACT = "ottplay-native-webos-candidate"
WORKER = "https://ottplay-webos.igw-2560801.workers.dev"
JSON_LIMIT = 8 * 1024 * 1024
ZIP_LIMIT = 1024 * 1024 * 1024
EXPANDED_LIMIT = 2 * ZIP_LIMIT
TRANSFER_SECONDS = 600
RECEIPT = "promotion.json"
NOTES_LIMIT = 64 * 1024
DEFAULT_RELEASE_BODY = "Experimental native webOS package with matching source. Device validation is not performed by this publication workflow."


class PromotionError(ValueError):
    """A promotion precondition could not be proved."""


def require(condition, message):
    if not condition:
        raise PromotionError(message)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate JSON key")
        result[key] = value
    return result


def decode(raw):
    require(len(raw) <= JSON_LIMIT, "JSON response exceeds limit")
    return json.loads(raw, object_pairs_hook=unique_object)


def positive(value):
    require(type(value) is int and value > 0, "Invalid GitHub numeric identity")
    return value


def validate_inputs(run_id, source_sha, version, tag):
    positive(run_id)
    require(isinstance(source_sha, str) and re.fullmatch(r"[0-9a-f]{40}", source_sha), "Invalid source SHA")
    require(isinstance(version, str) and re.fullmatch(r"(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)", version), "Invalid native version")
    require(isinstance(tag, str) and re.fullmatch(r"native-webos-v" + re.escape(version) + r"(?:-(?:beta|rc)\.[1-9]\d*)?", tag), "Native tag/version mismatch")
    return {"repository": REPOSITORY, "run_id": run_id, "source_sha": source_sha, "version": version, "tag": tag}


def release_body(inputs):
    """Read optional version notes from the verified commit, never the worktree."""
    checked = validate_inputs(inputs["run_id"], inputs["source_sha"], inputs["version"], inputs["tag"])
    path = "native/webos/releases/" + checked["version"] + ".md"

    def git(*arguments):
        result = subprocess.run(["git", "--no-replace-objects", *arguments], cwd=ROOT,
                                capture_output=True, timeout=30)
        require(result.returncode == 0, "Cannot read committed native release notes")
        return result.stdout

    entry = git("ls-tree", "-z", checked["source_sha"], "--", path)
    if not entry:
        return DEFAULT_RELEASE_BODY
    match = re.fullmatch(rb"(?:100644|100755) blob ([0-9a-f]{40})\t" + re.escape(path.encode()) + rb"\x00", entry)
    require(match is not None, "Native release notes must be a tracked regular file")
    oid = match[1].decode("ascii")
    raw_size = git("cat-file", "-s", oid)
    require(re.fullmatch(rb"[0-9]+\n", raw_size), "Invalid release notes object size")
    size = int(raw_size)
    require(0 < size <= NOTES_LIMIT, "Native release notes exceed size limit or are empty")
    raw = git("cat-file", "blob", oid)
    require(len(raw) == size, "Native release notes object size changed")
    try:
        body = raw.decode("utf-8").strip()
    except UnicodeDecodeError:
        raise PromotionError("Native release notes must be UTF-8") from None
    require(body and "\x00" not in body, "Native release notes are empty or contain NUL")
    return body


def candidate_names(version):
    stem = "ottplay-native-webos-" + version
    return tuple(stem + suffix for suffix in (
        ".ipk", ".json", ".sha256", "-source.tar.gz",
        "-source.tar.gz.release.json", "-runtime-source.tar.gz", "-source-set.json",
    )) + ("ottplay-native-webos-icon.png",)


def release_names(version):
    return candidate_names(version) + ("ottplay-native-webos-manifest.json", "ottplay-native-webos-repository.json")


def file_limit(name):
    if name.endswith(".ipk"):
        return 128 * 1024 * 1024
    return ZIP_LIMIT if name.endswith(".tar.gz") else JSON_LIMIT


def file_digest(path):
    require(not path.is_symlink() and path.is_file(), "Missing or nonregular bundle file: " + path.name)
    size = path.stat().st_size
    require(0 < size <= file_limit(path.name), "Bundle file size outside limit: " + path.name)
    with path.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    return {"sha256": digest, "bytes": size}


def inventory(directory, names, *, receipt=False):
    require(not directory.is_symlink() and directory.is_dir(), "Bundle directory must be regular")
    expected = set(names) | ({RECEIPT} if receipt else set())
    require({p.name for p in directory.iterdir()} == expected, "Bundle file inventory differs from allowlist")
    result = {name: file_digest(directory / name) for name in names}
    require(sum(row["bytes"] for row in result.values()) <= EXPANDED_LIMIT, "Bundle exceeds total size limit")
    return result


def check_environment(inputs, *, require_current_main=True):
    require(os.environ.get("GITHUB_REPOSITORY") == REPOSITORY, "Promotion must run in the fixed repository")
    require(os.environ.get("GITHUB_REF") == "refs/heads/main", "Promotion requires the main branch")
    require(os.environ.get("GITHUB_SHA") == inputs["source_sha"], "Execution SHA differs from candidate source")
    result = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, check=True, timeout=30)
    require(result.stdout.decode().strip() == inputs["source_sha"], "Checkout differs from execution SHA")
    result = subprocess.run(["git", "diff", "--quiet", "HEAD", "--"], cwd=ROOT, capture_output=True, timeout=30)
    require(result.returncode == 0, "Tracked checkout files have changed")
    if require_current_main:
        current = api_json(f"/repos/{REPOSITORY}/git/ref/heads/main")
        require(current.get("ref") == "refs/heads/main"
                and current.get("object", {}).get("type") == "commit"
                and current["object"].get("sha") == inputs["source_sha"],
                "Main advanced; prepare a candidate from current main")


def gh_to_file(arguments, destination, limit, *, allow_not_found=False):
    """Bound stdout and elapsed time; never echo authentication or stderr."""
    environment = {**os.environ, "GH_PROMPT_DISABLED": "1", "GH_PAGER": "cat", "GH_DEBUG": ""}
    with tempfile.TemporaryFile() as errors, destination.open("xb") as output:
        process = subprocess.Popen(["gh", *arguments], cwd=ROOT, env=environment, stdout=subprocess.PIPE, stderr=errors)
        deadline, count = time.monotonic() + TRANSFER_SECONDS, 0
        try:
            with selectors.DefaultSelector() as selector:
                selector.register(process.stdout, selectors.EVENT_READ)
                while True:
                    remaining = deadline - time.monotonic()
                    require(remaining > 0, "GitHub request timed out")
                    if not selector.select(min(remaining, 1)):
                        continue
                    chunk = os.read(process.stdout.fileno(), 1024 * 1024)
                    if not chunk:
                        break
                    count += len(chunk)
                    require(count <= limit, "GitHub response exceeds limit")
                    output.write(chunk)
            status = process.wait(timeout=max(0.1, deadline - time.monotonic()))
            if status != 0:
                errors.seek(0)
                error = errors.read(8192)
                if allow_not_found and re.search(rb"\(HTTP 404\)\s*$", error):
                    return False
                raise PromotionError("GitHub request failed; no publication precondition inferred")
            return True
        finally:
            if process.poll() is None:
                process.kill()
            process.wait()
            process.stdout.close()


def api_json(path, *, method="GET", payload=None, allow_not_found=False):
    require(path.startswith("/") and not path.startswith("//"), "GitHub API path must be relative")
    with tempfile.TemporaryDirectory(prefix="native-api-") as tmp:
        directory = Path(tmp)
        arguments = ["api", "--hostname", "github.com", "--method", method, path,
                     "-H", "Accept: application/vnd.github+json", "-H", "X-GitHub-Api-Version: 2022-11-28"]
        if payload is not None:
            body = directory / "request.json"
            body.write_text(json.dumps(payload), encoding="utf-8")
            arguments += ["--input", str(body)]
        output = directory / "response.json"
        if not gh_to_file(arguments, output, JSON_LIMIT, allow_not_found=allow_not_found):
            return None
        return decode(output.read_bytes())


def download_api(path, destination, limit):
    gh_to_file(["api", "--hostname", "github.com", path, "-H", "Accept: application/octet-stream"], destination, limit)


def upload_asset(release_id, name, path):
    positive(release_id)
    endpoint = f"https://uploads.github.com/repos/{REPOSITORY}/releases/{release_id}/assets?name={quote(name, safe='')}"
    with tempfile.TemporaryDirectory(prefix="native-upload-") as tmp:
        output = Path(tmp) / "response.json"
        gh_to_file(["api", "--hostname", "github.com", "--method", "POST", endpoint,
                    "-H", "Content-Type: application/octet-stream", "--input", str(path)], output, JSON_LIMIT)
        return decode(output.read_bytes())


def validate_run(run, workflow, inputs):
    require(isinstance(run, dict) and isinstance(workflow, dict), "Malformed workflow metadata")
    require(run.get("id") == inputs["run_id"], "Candidate run identity mismatch")
    require(run.get("repository", {}).get("full_name") == REPOSITORY
            and run.get("head_repository", {}).get("full_name") == REPOSITORY, "Candidate repository mismatch")
    require(run.get("event") == "workflow_dispatch" and run.get("head_branch") == "main"
            and run.get("head_sha") == inputs["source_sha"], "Candidate must be a direct dispatch on the exact main source")
    require(run.get("status") == "completed" and run.get("conclusion") == "success", "Candidate run has not succeeded")
    require(workflow.get("path") == ".github/workflows/" + WORKFLOW
            and run.get("workflow_id") == positive(workflow.get("id")), "Candidate workflow mismatch")
    require(run.get("path") == ".github/workflows/" + WORKFLOW, "Candidate did not directly execute the native workflow")


def select_artifact(payload, inputs):
    require(isinstance(payload, dict) and isinstance(payload.get("artifacts"), list), "Malformed artifact inventory")
    rows = payload["artifacts"]
    require(payload.get("total_count") == len(rows) and len(rows) <= 100, "Artifact inventory is incomplete")
    matches = [row for row in rows if row.get("name") == ARTIFACT]
    require(len(matches) == 1, "Candidate artifact must be unique")
    artifact = matches[0]
    positive(artifact.get("id"))
    require(artifact.get("expired") is False, "Candidate artifact expired")
    require(type(artifact.get("size_in_bytes")) is int and 0 < artifact["size_in_bytes"] <= ZIP_LIMIT, "Candidate ZIP exceeds size limit")
    require(re.fullmatch(r"sha256:[0-9a-f]{64}", artifact.get("digest", "")), "Candidate artifact lacks a SHA-256 digest")
    run = artifact.get("workflow_run", {})
    require(run.get("id") == inputs["run_id"] and run.get("head_sha") == inputs["source_sha"]
            and run.get("head_branch") == "main", "Artifact source binding mismatch")
    return artifact


def safe_extract(archive, output, version):
    """Only eight flat regular files, with bounded ZIP directory and payloads."""
    require(not archive.is_symlink() and archive.is_file() and archive.stat().st_size <= ZIP_LIMIT, "Unsafe candidate ZIP")
    size = archive.stat().st_size
    with archive.open("rb") as stream:
        stream.seek(max(0, size - 65557))
        tail = stream.read()
    position = tail.rfind(b"PK\x05\x06")
    require(position >= 0 and len(tail) - position >= 22, "Missing ZIP directory")
    _, disk, start_disk, count_disk, count, directory_size, offset, comment = struct.unpack("<4s4H2LH", tail[position:position + 22])
    require(disk == start_disk == 0 and count_disk == count == 8 and directory_size <= 65536,
            "ZIP directory exceeds allowed shape")
    require(position + 22 + comment == len(tail) and offset + directory_size == size - len(tail) + position,
            "ZIP layout is not a plain single archive")
    require(not output.is_symlink() and output.is_dir() and not any(output.iterdir()), "Extraction requires an empty directory")
    expected, total = set(candidate_names(version)), 0
    with zipfile.ZipFile(archive) as zipped:
        rows = zipped.infolist()
        require(len(rows) == 8 and {row.filename for row in rows} == expected, "ZIP inventory differs from candidate allowlist")
        for row in rows:
            kind = stat.S_IFMT(row.external_attr >> 16)
            require(kind in (0, stat.S_IFREG) and not row.is_dir() and not row.flag_bits & 1,
                    "ZIP contains a nonregular or encrypted member")
            require(row.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), "Unsupported ZIP compression")
            require(0 < row.file_size <= file_limit(row.filename), "ZIP member exceeds size limit")
            total += row.file_size
            require(total <= EXPANDED_LIMIT, "Expanded candidate exceeds size limit")
        for row in rows:
            count = 0
            with zipped.open(row) as source, (output / row.filename).open("xb") as target:
                while chunk := source.read(1024 * 1024):
                    count += len(chunk)
                    require(count <= row.file_size, "ZIP member exceeds declared length")
                    target.write(chunk)
            require(count == row.file_size, "Truncated ZIP member")


def fetch_candidate(inputs, directory):
    prefix = "/repos/" + REPOSITORY
    workflow = api_json(prefix + "/actions/workflows/" + WORKFLOW)
    run = api_json(prefix + "/actions/runs/" + str(inputs["run_id"]))
    validate_run(run, workflow, inputs)
    artifact = select_artifact(api_json(prefix + f"/actions/runs/{inputs['run_id']}/artifacts?per_page=100"), inputs)
    with tempfile.TemporaryDirectory(prefix="native-candidate-") as tmp:
        archive = Path(tmp) / "candidate.zip"
        download_api(prefix + f"/actions/artifacts/{artifact['id']}/zip", archive, ZIP_LIMIT)
        with archive.open("rb") as stream:
            digest = "sha256:" + hashlib.file_digest(stream, "sha256").hexdigest()
        require(digest == artifact["digest"], "Downloaded artifact digest mismatch")
        safe_extract(archive, directory, inputs["version"])
    return {"id": artifact["id"], "digest": artifact["digest"]}


def verifier_module():
    spec = importlib.util.spec_from_file_location("native_release_verifier", ROOT / "scripts/verify-webos-native-release.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def verify_bundle(directory, version, require_feed=True):
    return verifier_module().verify(directory / ("ottplay-native-webos-" + version + ".json"),
                                    require_feed=require_feed, check_checkout=True)


def write_feed(directory, inputs):
    module = verifier_module()
    stem = "ottplay-native-webos-" + inputs["version"]
    metadata = decode((directory / (stem + ".json")).read_bytes())
    require(metadata["application"]["version"] == inputs["version"], "Candidate version mismatch")
    module.build.feed(SimpleNamespace(output=directory,
        base_url=WORKER + "/v1/" + inputs["tag"],
        download_base_url=f"https://github.com/{REPOSITORY}/releases/download/{inputs['tag']}"),
        {"application": metadata["application"]}, metadata, stem + ".ipk")


def prepare(args):
    inputs = validate_inputs(args.run_id, args.source_sha, args.version, args.tag)
    check_environment(inputs)
    directory = Path(args.output)
    require(not directory.exists() and not directory.is_symlink(), "Output already exists; use a fresh directory")
    directory.mkdir(parents=True)
    artifact = fetch_candidate(inputs, directory)
    inventory(directory, candidate_names(inputs["version"]))
    verify_bundle(directory, inputs["version"], require_feed=False)
    write_feed(directory, inputs)
    verify_bundle(directory, inputs["version"])
    receipt = {"schema": 1, "inputs": inputs, "artifact": artifact,
               "files": inventory(directory, release_names(inputs["version"]))}
    (directory / RECEIPT).write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return receipt


def load_receipt(directory, *, require_current_main=True):
    file_digest(directory / RECEIPT)
    receipt = decode((directory / RECEIPT).read_bytes())
    require(isinstance(receipt, dict) and set(receipt) == {"schema", "inputs", "artifact", "files"}
            and receipt["schema"] == 1, "Invalid promotion receipt")
    raw = receipt["inputs"]
    require(isinstance(raw, dict) and set(raw) == {"repository", "run_id", "source_sha", "version", "tag"}, "Invalid receipt inputs")
    inputs = validate_inputs(raw["run_id"], raw["source_sha"], raw["version"], raw["tag"])
    require(raw == inputs, "Receipt repository mismatch")
    check_environment(inputs, require_current_main=require_current_main)
    require(inventory(directory, release_names(inputs["version"]), receipt=True) == receipt["files"], "Promotion bundle digest mismatch")
    verify_bundle(directory, inputs["version"])
    return receipt


def verify_source_receipt(receipt):
    """The receipt alone is not trusted: reproduce it from GitHub's artifact."""
    inputs = receipt["inputs"]
    with tempfile.TemporaryDirectory(prefix="native-recheck-") as tmp:
        directory = Path(tmp)
        require(fetch_candidate(inputs, directory) == receipt["artifact"], "Candidate artifact changed")
        write_feed(directory, inputs)
        require(inventory(directory, release_names(inputs["version"])) == receipt["files"], "Promotion differs from candidate and exact feed")


def assets_for(release_id, receipt):
    rows = api_json(f"/repos/{REPOSITORY}/releases/{positive(release_id)}/assets?per_page=100")
    require(isinstance(rows, list) and len(rows) == 10
            and {row.get("name") for row in rows} == set(receipt["files"]), "Release asset inventory mismatch")
    require(len({row.get("id") for row in rows}) == len(rows), "Duplicate release asset identity")
    for row in rows:
        positive(row.get("id"))
        require(row.get("state") == "uploaded" and row.get("size") == receipt["files"][row["name"]]["bytes"], "Release asset size/state mismatch")
    return rows


def compare_assets(release_id, receipt, directory):
    for row in assets_for(release_id, receipt):
        destination = directory / row["name"]
        download_api(f"/repos/{REPOSITORY}/releases/assets/{row['id']}", destination, file_limit(row["name"]))
        require(file_digest(destination) == receipt["files"][row["name"]], "Release asset bytes differ: " + row["name"])
    verify_bundle(directory, receipt["inputs"]["version"])


def verify_tag(inputs):
    ref = api_json(f"/repos/{REPOSITORY}/git/ref/tags/{inputs['tag']}")
    require(ref.get("ref") == "refs/tags/" + inputs["tag"]
            and ref.get("object", {}).get("type") == "commit"
            and ref["object"].get("sha") == inputs["source_sha"], "Native tag target mismatch")


def publish(args):
    directory = Path(args.bundle)
    receipt = load_receipt(directory)
    inputs = receipt["inputs"]
    verify_source_receipt(receipt)
    prefix, tag = "/repos/" + REPOSITORY, inputs["tag"]
    require(api_json(prefix + "/releases/tags/" + tag, allow_not_found=True) is None, "Release already exists; operator recovery required")
    require(api_json(prefix + "/git/ref/tags/" + tag, allow_not_found=True) is None, "Tag already exists; operator recovery required")
    body = release_body(inputs)
    check_environment(inputs)
    # Atomic ref creation prevents racing another publisher and pins the source.
    api_json(prefix + "/git/refs", method="POST", payload={"ref": "refs/tags/" + tag, "sha": inputs["source_sha"]})
    verify_tag(inputs)
    release = api_json(prefix + "/releases", method="POST", payload={
        "tag_name": tag, "target_commitish": inputs["source_sha"], "name": "OTTPlay Native " + tag,
        "body": body,
        "draft": True, "prerelease": "-beta." in tag or "-rc." in tag, "make_latest": "false",
    })
    release_id = positive(release.get("id"))
    require(release.get("draft") is True and release.get("tag_name") == tag, "GitHub did not create the requested draft")
    for name in release_names(inputs["version"]):
        require(file_digest(directory / name) == receipt["files"][name], "Bundle changed during upload")
        upload_asset(release_id, name, directory / name)
    with tempfile.TemporaryDirectory(prefix="native-draft-check-") as tmp:
        compare_assets(release_id, receipt, Path(tmp))
    verify_tag(inputs)
    check_environment(inputs)
    current = api_json(prefix + f"/releases/{release_id}")
    require(current.get("draft") is True and current.get("tag_name") == tag, "Draft state changed before publication")
    require(current.get("body") == body, "Draft release notes changed before publication")
    published = api_json(prefix + f"/releases/{release_id}", method="PATCH", payload={"draft": False, "make_latest": "false", "body": body})
    require(published.get("draft") is False and published.get("tag_name") == tag, "Release publication did not complete")
    require(published.get("body") == body, "Published release notes differ from verified text")
    return {"release_id": release_id, "tag": tag, "published": True}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, _request, _fp, _code, _msg, _headers, _newurl):
        raise PromotionError("Metadata endpoint redirected instead of serving verified bytes")


PUBLIC_HOSTS = {"github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"}


def validate_public_url(url):
    parsed = urlsplit(url)
    require(parsed.scheme == "https" and parsed.hostname in PUBLIC_HOSTS
            and parsed.port in (None, 443) and parsed.username is None and parsed.password is None
            and not parsed.fragment, "Public asset redirected outside approved HTTPS hosts")


class PublicRedirect(HTTPRedirectHandler):
    def __init__(self):
        super().__init__()
        self.redirects = 0

    def redirect_request(self, request, fp, code, msg, headers, newurl):
        self.redirects += 1
        require(self.redirects <= 5, "Too many public asset redirects")
        validate_public_url(newurl)
        redirected = super().redirect_request(request, fp, code, msg, headers, newurl)
        # Never carry credentials across a public download redirect.
        if redirected is not None:
            for name in ("Authorization", "Cookie", "Proxy-Authorization"):
                redirected.remove_header(name)
        return redirected


def fetch_public_asset(url, destination, limit):
    """Download as an anonymous user, independently of gh's authentication."""
    validate_public_url(url)
    require(urlsplit(url).hostname == "github.com", "Public asset must begin at the release download URL")
    request = Request(url, headers={"Accept-Encoding": "identity", "User-Agent": "OTTPlay-native-release-check"})
    deadline = time.monotonic() + TRANSFER_SECONDS
    with build_opener(PublicRedirect()).open(request, timeout=10) as response, destination.open("xb") as target:
        require(response.status == 200, "Public asset request failed")
        count = 0
        while chunk := response.read1(1024 * 1024):
            count += len(chunk)
            require(count <= limit and time.monotonic() < deadline, "Public asset response exceeds bound")
            target.write(chunk)


def fetch_worker(url, limit):
    require(url.startswith(WORKER + "/v1/"), "Invalid metadata worker URL")
    # urllib receives no GitHub environment token or Authorization header.
    request = Request(url, headers={"Origin": "null", "Accept-Encoding": "identity", "User-Agent": "OTTPlay-native-release-check"})
    deadline = time.monotonic() + 30
    with build_opener(NoRedirect()).open(request, timeout=10) as response:
        require(response.status == 200 and response.headers.get("Access-Control-Allow-Origin") == "*", "Metadata endpoint lacks public null-origin CORS")
        blocks, count = [], 0
        # read1 returns after one socket read; a slow trickle must not hold a
        # large buffered read open past the absolute deadline.
        while chunk := response.read1(min(65536, limit + 1 - count)):
            count += len(chunk)
            require(count <= limit and time.monotonic() < deadline, "Metadata response exceeds bound")
            blocks.append(chunk)
        return b"".join(blocks)


def verify_public(args):
    directory = Path(args.bundle)
    # A published immutable release remains verifiable after main advances.
    receipt = load_receipt(directory, require_current_main=False)
    inputs = receipt["inputs"]
    verify_tag(inputs)
    release = api_json(f"/repos/{REPOSITORY}/releases/tags/{inputs['tag']}")
    require(release.get("draft") is False and release.get("tag_name") == inputs["tag"], "Release is not public")
    with tempfile.TemporaryDirectory(prefix="native-public-check-") as tmp:
        downloaded = Path(tmp)
        for row in assets_for(positive(release.get("id")), receipt):
            name = row["name"]
            fetch_public_asset(f"https://github.com/{REPOSITORY}/releases/download/{inputs['tag']}/{name}",
                               downloaded / name, file_limit(name))
            require(file_digest(downloaded / name) == receipt["files"][name], "Public asset bytes differ: " + name)
        verify_bundle(downloaded, inputs["version"])
    for name in ("ottplay-native-webos-repository.json", "ottplay-native-webos-manifest.json", "ottplay-native-webos-icon.png"):
        raw = fetch_worker(WORKER + "/v1/" + inputs["tag"] + "/" + name, JSON_LIMIT)
        require(raw == (directory / name).read_bytes(), "Metadata worker bytes differ: " + name)
    return {"tag": inputs["tag"], "public_assets": "PASS", "metadata_cors": "PASS"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    preparation = sub.add_parser("prepare")
    preparation.add_argument("--run-id", required=True, type=int)
    preparation.add_argument("--source-sha", required=True)
    preparation.add_argument("--version", required=True)
    preparation.add_argument("--tag", required=True)
    preparation.add_argument("--output", required=True, type=Path)
    preparation.set_defaults(handler=prepare)
    for command, handler in (("publish", publish), ("verify-public", verify_public)):
        child = sub.add_parser(command)
        child.add_argument("--bundle", required=True, type=Path)
        child.set_defaults(handler=handler)
    args = parser.parse_args()
    try:
        result = args.handler(args)
        print(json.dumps({"command": args.command, "result": result}, sort_keys=True))
    except (ValueError, KeyError, TypeError, AttributeError, OSError, subprocess.SubprocessError, zipfile.BadZipFile) as error:
        # Do not print subprocess output, API response bodies, tokens or URLs.
        print("FAIL: " + (str(error) if isinstance(error, PromotionError) else type(error).__name__), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
