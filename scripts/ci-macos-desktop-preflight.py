#!/usr/bin/env python3
"""Hosted-only GUI preflight. Does not build or launch OTTPlay, alter TCC or defaults."""
import hashlib
import json
import os
import platform
from pathlib import Path
import re
import signal
import subprocess
import sys
import time


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, value):
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def swift_target(machine):
    require(machine in ("arm64", "x86_64"), "unsupported hosted architecture")
    return machine + "-apple-macosx14.0"


def stop_owned(proc):
    """Only this Popen's private process group; never a name or discovered PID."""
    forced = False
    try:
        os.killpg(proc.pid, 0)
    except ProcessLookupError:
        proc.wait(timeout=1)
        return forced
    forced = True
    os.killpg(proc.pid, signal.SIGTERM)
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        pass
    try:
        os.killpg(proc.pid, 0)
    except ProcessLookupError:
        return forced
    os.killpg(proc.pid, signal.SIGKILL)
    proc.wait(timeout=3)
    end = time.monotonic() + 2
    while time.monotonic() < end:
        try:
            os.killpg(proc.pid, 0)
        except ProcessLookupError:
            return forced
        time.sleep(.05)
    raise RuntimeError("owned process group did not exit")


def run_owned(argv, log, seconds, accepted_codes=(0,)):
    proc = None
    failed = None
    code = None
    forced = False
    start = time.monotonic()
    try:
        with log.open("xb") as stream:
            proc = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=stream,
                                    stderr=subprocess.STDOUT, start_new_session=True)
            end = start + seconds
            while proc.poll() is None:
                require(time.monotonic() < end, "child deadline exceeded")
                require(log.stat().st_size <= 2 * 1024 * 1024, "child output budget exceeded")
                time.sleep(.1)
            code = proc.returncode
    except BaseException as error:
        failed = error
    finally:
        if proc is not None:
            try:
                forced = stop_owned(proc)
            except BaseException as error:
                if failed is None:
                    failed = error
        evidence = {"argv": list(map(str, argv)), "pid": proc.pid if proc else None,
                    "exit_code": code, "forced_cleanup": forced,
                    "elapsed_seconds": round(time.monotonic() - start, 3),
                    "log_sha256": sha(log) if log.exists() else None}
        if failed is not None:
            evidence["error"] = type(failed).__name__ + ": " + str(failed)
        write(log.with_suffix(".json"), evidence)
    if failed is not None:
        raise failed
    require(code in accepted_codes, "child failed; inspect " + log.name)
    require(not forced, "child left an owned process group running")
    require(log.stat().st_size <= 2 * 1024 * 1024, "child output budget exceeded")
    return log.read_text(encoding="utf-8")


def validate_capabilities(value):
    require(isinstance(value, dict) and value.get("schema") == 1
            and value.get("action") == "preflight" and value.get("status") == "ok",
            "GUI preflight refused or incomplete")
    required = ("usage", "macos_14_or_later", "accessibility", "post_events", "screen_capture",
                "on_console", "login_complete", "display_active", "finder_running",
                "finder_ax_menu")
    require(value.get("missing") == [] and isinstance(value.get("capabilities"), dict)
            and all(value["capabilities"].get(key) is True for key in required),
            "GUI capability evidence is incomplete")
    return value


def main():
    require(sys.platform == "darwin", "macOS is required")
    require(os.environ.get("GITHUB_ACTIONS") == "true"
            and os.environ.get("RUNNER_ENVIRONMENT") == "github-hosted",
            "GitHub-hosted runner required")
    root = Path(__file__).resolve().parents[1]
    temp = Path(os.environ["RUNNER_TEMP"]).resolve()
    output = temp / "ott-desktop-preflight"
    output.mkdir(mode=0o700, exist_ok=False)
    helper_source = root / "tests/macos-desktop/preflight.swift"
    helper = output / "macos-desktop-helper"
    receipt = {"schema": 1, "status": "FAILED", "purpose": "GUI_CAPABILITY_ONLY",
               "builds": 0, "player_launches": 0, "playback_accepted": False,
               "source_commit": os.environ.get("GITHUB_SHA"),
               "run_id": os.environ.get("GITHUB_RUN_ID"),
               "run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
               "helper_source_sha256": sha(helper_source),
               "controller_sha256": sha(Path(__file__))}
    try:
        commit = run_owned(["git", "-C", str(root), "rev-parse", "HEAD"],
                           output / "head.log", 10).strip()
        require(re.fullmatch(r"[0-9a-f]{40}", commit) and commit == receipt["source_commit"],
                "checkout differs from GITHUB_SHA")
        run_owned(["git", "-C", str(root), "diff", "--exit-code", "HEAD", "--"],
                  output / "source-before.log", 15)
        # This is the small external observation helper, not an OTTPlay build.
        run_owned(["/usr/bin/xcrun", "swiftc", "-swift-version", "5",
                   "-target", swift_target(platform.machine()), str(helper_source),
                   "-o", str(helper)], output / "compile-helper.log", 90)
        receipt["helper_binary_sha256"] = sha(helper)
        result = run_owned([str(helper), "preflight"], output / "capabilities.log", 40, (0, 2))
        receipt["capabilities"] = json.loads(result)
        validate_capabilities(receipt["capabilities"])
        run_owned(["git", "-C", str(root), "diff", "--exit-code", "HEAD", "--"],
                  output / "source-after.log", 15)
        require(sha(helper_source) == receipt["helper_source_sha256"], "helper source changed")
        receipt["status"] = "GUI_CAPABILITY_READY_NOT_PLAYBACK_ACCEPTANCE"
    except BaseException as error:
        receipt["error"] = type(error).__name__ + ": " + str(error)
    finally:
        write(output / "receipt.json", receipt)
        print(json.dumps(receipt, indent=2))
    return 0 if receipt["status"] == "GUI_CAPABILITY_READY_NOT_PLAYBACK_ACCEPTANCE" else 1


if __name__ == "__main__":
    def interrupted(signum, frame):
        raise KeyboardInterrupt("signal " + str(signum))
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    raise SystemExit(main())
