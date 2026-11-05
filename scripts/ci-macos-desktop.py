#!/usr/bin/env python3
"""GitHub-hosted-only packaged macOS capture; never an automatic playback verdict."""
import argparse
from contextlib import ExitStack
import hashlib
import json
import os
import platform
from pathlib import Path
import plistlib
import re
import shutil
import signal
import subprocess
import sys
import time

FIXTURE_SHA = "866c273d576d3db09a0e62596f011793d66f6fbb54db727ff2045e5d744105bb"
EXTENSIONS = ["avi", "m4v", "mkv", "mp4", "ogv", "webm"]

def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def write(path, value):
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def manual_capture(event_name, preflight, capture):
    if event_name != "workflow_dispatch":
        return False
    require(not (preflight and capture), "choose either preflight or capture, not both")
    return capture is True


def host_architecture(machine):
    require(machine in ("arm64", "x86_64"), "unsupported hosted architecture")
    return machine


def validate_helper(value, action):
    require(isinstance(value, dict) and value.get("schema") == 1
            and value.get("action") == action and value.get("status") == "ok",
            "helper refused or returned mismatched action: " + action)
    if action == "preflight":
        facts = value.get("capabilities", {})
        require(all(facts.get(key) is True for key in (
            "accessibility", "post_events", "screen_capture", "on_console",
            "login_complete", "display_active")), "incomplete full-helper capabilities")
    return value


def validate_trace_contract(value):
    validate_helper(value, "trace-contract")
    for key, expected in (("routine_reads", 20000), ("routine_errors", 78),
                          ("slow_reads", 20), ("critical_events", 2), ("trace_limit", 1048576)):
        require(type(value.get(key)) is int and value[key] == expected,
                "trace contract lost counters: " + key)
    require(type(value.get("trace_bytes")) is int and 0 < value["trace_bytes"] <= 512 * 1024
            and value.get("trace_unavailable") is False,
            "trace contract exceeded its bounded output")
    return value


def fixture_files(root, output, *, create=False):
    """One hash-bound fixture set, prepared before build and reused without replacement."""
    fixture = root / "diagnostics/av-v1.mp4"
    require(sha(fixture) == FIXTURE_SHA, "synthetic fixture bytes changed")
    files = output / "fixtures"
    if create:
        files.mkdir()
    require(files.is_dir() and not files.is_symlink(), "fixture directory missing or replaced")
    first, second = files / "QA video Ω 01.mp4", files / "QA video Ω 02.mp4"
    for file in (first, second):
        if create:
            shutil.copyfile(fixture, file)
        require(file.is_file() and not file.is_symlink() and sha(file) == FIXTURE_SHA,
                "fixture copy missing or changed")
    return first, second


def validate_reveal(value, file):
    validate_helper(value, "finder-reveal")
    require(value.get("selected_file") == str(file)
            and value.get("route") == "finder_reveal_exact_selection",
            "missing exact Finder fixture-selection evidence")
    return value


def capture_image(runner, label, helper, app, image, expected_pid):
    require(type(expected_pid) is int and 0 < expected_pid <= 2147483647,
            "missing positive action PID before screenshot")
    result = runner.helper(label, helper, "screenshot", app, image, str(expected_pid), seconds=40)
    validate_helper(result, "screenshot")
    require(type(result.get("pid")) is int and result["pid"] == expected_pid,
            "screenshot changed action owner")
    evidence = result.get("native_window")
    require(isinstance(evidence, dict) and type(evidence.get("owner_pid")) is int
            and evidence["owner_pid"] == expected_pid and evidence.get("query_performed") is True
            and evidence.get("scope") == "owned_on_screen_windows",
            "missing original-owner native window observation")
    require(type(evidence.get("candidate_count")) is int and evidence["candidate_count"] == 1
            and type(evidence.get("owned_count")) is int and evidence["owned_count"] >= 1,
            "screenshot did not attest one native window")
    require(type(result.get("window_id")) is int and result["window_id"] > 0
            and type(evidence.get("selected_id")) is int
            and evidence["selected_id"] == result["window_id"], "screenshot window identity mismatch")
    records = evidence.get("records")
    require(isinstance(records, list) and len(records) <= 16
            and type(evidence.get("records_truncated")) is int
            and evidence["records_truncated"] == evidence["owned_count"] - len(records)
            and evidence["records_truncated"] >= 0, "invalid bounded native window evidence")
    require(image.is_file(), "screenshot image is absent")
    return result


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



class Runner:
    def __init__(self, output, seconds):
        self.output = output
        self.deadline = time.monotonic() + seconds
        commands = output / "commands.json"
        self.commands = json.loads(commands.read_text()) if commands.exists() else []

    def run(self, name, argv, cwd=None, env=None, seconds=30, cleanup=False, capture_stderr=False):
        require(re.fullmatch(r"[a-z0-9-]+", name), "invalid command label")
        limit = seconds if cleanup else min(seconds, self.deadline - time.monotonic())
        require(limit > 0, "attempt deadline exceeded")
        log = self.output / (name + ".log")
        stderr_log = self.output / (name + ".stderr.log") if capture_stderr else None
        item = {"name": name, "argv": [str(x) for x in argv], "status": "starting"}
        self.commands.append(item)
        proc = None
        failed = None
        start = time.monotonic()
        forced = False
        try:
            with ExitStack() as stack:
                stream = stack.enter_context(log.open("xb"))
                errors = stack.enter_context(stderr_log.open("xb")) if stderr_log else subprocess.STDOUT
                proc = subprocess.Popen(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                        stdout=stream, stderr=errors, start_new_session=True)
                item["pid"] = proc.pid
                while proc.poll() is None:
                    require(time.monotonic() - start < limit, name + ": deadline exceeded")
                    require(log.stat().st_size <= 32 * 1024 * 1024, name + ": output budget exceeded")
                    if stderr_log is not None:
                        require(stderr_log.stat().st_size <= 2 * 1024 * 1024, name + ": stderr budget exceeded")
                    time.sleep(.1)
                item["exit_code"] = proc.returncode
                if proc.returncode != 0:
                    failed = RuntimeError(name + ": command failed; see its log")
                elif log.stat().st_size > 32 * 1024 * 1024:
                    failed = RuntimeError(name + ": output budget exceeded")
                elif stderr_log is not None and stderr_log.stat().st_size > 2 * 1024 * 1024:
                    failed = RuntimeError(name + ": stderr budget exceeded")
        except BaseException as error:
            failed = error
        finally:
            if proc is not None:
                try:
                    forced = stop_owned(proc)
                except BaseException as error:
                    item["cleanup_error"] = type(error).__name__ + ": " + str(error)
                    if failed is None:
                        failed = error
            item["forced_cleanup"] = forced
            item["elapsed_seconds"] = round(time.monotonic() - start, 3)
            item["log_sha256"] = sha(log) if log.exists() else None
            if stderr_log is not None:
                item["stderr_log"] = stderr_log.name
                item["stderr_sha256"] = sha(stderr_log) if stderr_log.exists() else None
                item["stderr_bytes"] = stderr_log.stat().st_size if stderr_log.exists() else None
            if failed is not None:
                item["error"] = type(failed).__name__ + ": " + str(failed)
            item["status"] = "failed" if failed or forced or item.get("exit_code") != 0 else "completed"
            write(self.output / "commands.json", self.commands)
        if failed is not None:
            raise failed
        require(not forced, name + ": child left its process group running")
        require(item.get("exit_code") == 0, name + ": command failed; see its log")
        require(log.stat().st_size <= 32 * 1024 * 1024, name + ": output budget exceeded")
        if stderr_log is not None:
            require(stderr_log.stat().st_size <= 2 * 1024 * 1024, name + ": stderr budget exceeded")
        return log.read_text(encoding="utf-8", errors="replace")

    def helper(self, name, helper, action, *args, seconds=30, cleanup=False):
        text = self.run(name, [str(helper), action, *map(str, args)], seconds=seconds,
                        cleanup=cleanup, capture_stderr=True)
        result = json.loads(text)
        return validate_helper(result, action)


def collect_failure_evidence(receipt, runner, helper):
    """One read-only observation. Its failure never replaces the primary failure."""
    if receipt.get("status") != "FAILED":
        return
    try:
        receipt["finder_diagnostic"] = runner.helper(
            "finder-failure-state", helper, "finder-diagnostic", seconds=12, cleanup=True)
    except BaseException as error:
        receipt["finder_diagnostic_error"] = type(error).__name__ + ": " + str(error)


def clean_source(runner, root, name):
    runner.run(name, ["git", "diff", "--exit-code", "HEAD", "--"], cwd=root)


def inventory(root):
    rows = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            rows.append({"path": path.relative_to(root).as_posix(), "symlink": os.readlink(path)})
        elif path.is_file():
            rows.append({"path": path.relative_to(root).as_posix(), "sha256": sha(path),
                         "mode": path.stat().st_mode & 0o777})
    return rows


def generate_config(output, commit):
    identity = "qa" + os.environ["GITHUB_RUN_ID"] + "a" + os.environ["GITHUB_RUN_ATTEMPT"]
    require(re.fullmatch(r"qa[0-9]+a[0-9]+", identity), "invalid run identity")
    data = output / "runtime-data"
    require(not data.exists(), "runtime data already exists")
    env = {"OTTPLAY_DATA_DIR": str(data), "OTTPLAY_INSTANCE": identity,
           "OTTPLAY_MANAGED_INSTANCE": "1", "OTTPLAY_QUEUE_PORT": "18764", "OTTPLAY_WEB_URL": ""}
    info = output / "Info.qa.plist"
    info.write_bytes(plistlib.dumps({"LSEnvironment": env}))
    config = {"identifier": "com.ottplay.foss." + identity, "productName": "OttPlay Desktop QA",
              "build": {"beforeBuildCommand": "npm run build && python3 scripts/write_web_build_metadata.py src-tauri/frontend"},
              "bundle": {"macOS": {"signingIdentity": "-", "infoPlist": str(info)}}}
    write(output / "tauri.qa.json", config)
    write(output / "binding.json", {"commit": commit, "bundle_id": config["identifier"],
                                    "environment": env, "release_equivalent": False})
    return config, env


def qualify(runner, root, output, config, env):
    built = root / "target/release/bundle/macos/OttPlay Desktop QA.app"
    require(built.is_dir() and not built.is_symlink(), "packaged application missing")
    info = plistlib.loads((built / "Contents/Info.plist").read_bytes())
    require(info["CFBundleIdentifier"] == config["identifier"], "wrong bundle identity")
    require(info.get("LSEnvironment") == env, "wrong launch environment")
    associations = info.get("CFBundleDocumentTypes", [])
    require(sorted(x for a in associations for x in a.get("CFBundleTypeExtensions", [])) == EXTENSIONS,
            "wrong packaged associations")
    require(all(a.get("CFBundleTypeRole") == "Viewer" and a.get("LSHandlerRank") == "Alternate"
                for a in associations), "file association changed default role")
    runner.run("codesign-built", ["/usr/bin/codesign", "--verify", "--deep", "--strict", str(built)])
    original = inventory(built)
    app = output / built.name
    runner.run("stage-app", ["/usr/bin/ditto", str(built), str(app)], seconds=60)
    require(inventory(app) == original, "staging changed application bytes")
    write(output / "app-files.json", original)
    exe = app / "Contents/MacOS" / info["CFBundleExecutable"]
    architecture = runner.run("architecture", ["/usr/bin/lipo", "-archs", str(exe)]).strip()
    require(architecture == host_architecture(platform.machine()), "package does not match hosted architecture")
    frontend = root / "src-tauri/frontend"
    metadata = json.loads((frontend / "build-info.json").read_text())
    for entry in metadata["files"]:
        path = (frontend / entry["path"]).resolve()
        require(path.is_relative_to(frontend.resolve()) and sha(path) == entry["sha256"], "frontend digest mismatch")
    write(output / "package.json", {"bundle_id": info["CFBundleIdentifier"], "architecture": architecture,
                                    "executable_sha256": sha(exe), "plist_sha256": sha(app / "Contents/Info.plist"),
                                    "frontend_metadata_sha256": sha(frontend / "build-info.json"),
                                    "app_inventory_sha256": sha(output / "app-files.json"),
                                    "release_equivalent": False})
    return app


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("phase", choices=["preflight", "capture"])
    ap.add_argument("--output", type=Path)
    args = ap.parse_args()
    root = Path(__file__).resolve().parents[1]
    require(manual_capture(os.environ.get("GITHUB_EVENT_NAME"),
                           os.environ.get("DESKTOP_PREFLIGHT_ONLY") == "true",
                           os.environ.get("DESKTOP_ACCEPTANCE") == "true"),
            "explicit manual desktop acceptance required")
    require(sys.platform == "darwin" and os.environ.get("GITHUB_ACTIONS") == "true", "GitHub-hosted macOS only")
    require(os.environ.get("RUNNER_ENVIRONMENT") == "github-hosted", "self-hosted execution is not allowed")
    output = args.output.resolve() if args.output else Path(os.environ["RUNNER_TEMP"]) / "ott-desktop-qa"
    require(output.is_relative_to(Path(os.environ["RUNNER_TEMP"]).resolve()), "output must be within RUNNER_TEMP")
    if args.phase == "preflight":
        output.mkdir(parents=True, exist_ok=False)
    else:
        require(output.is_dir(), "preflight output is missing")
    runner = Runner(output, 150 if args.phase == "preflight" else 3300)
    helper = output / "macos-desktop-helper"
    helper_source = root / "tests/macos-desktop/desktop-helper.swift"
    receipt = {"phase": args.phase, "status": "FAILED", "playback_accepted": False,
               "visual_review": "NOT_REVIEWED", "source_commit": os.environ.get("GITHUB_SHA"),
               "helper_source_sha256": sha(helper_source), "controller_sha256": sha(Path(__file__)),
               "run_id": os.environ.get("GITHUB_RUN_ID"), "run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT")}
    app = None
    registered = False
    gui_attempted = False
    ls = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
    try:
        commit = runner.run(args.phase + "-head", ["git", "rev-parse", "HEAD"], cwd=root).strip()
        require(commit == os.environ["GITHUB_SHA"] and re.fullmatch(r"[0-9a-f]{40}", commit), "checkout is not exact GITHUB_SHA")
        clean_source(runner, root, args.phase + "-source-before")
        if args.phase == "preflight":
            runner.run("compile-gui-helper", ["/usr/bin/xcrun", "swiftc", "-swift-version", "5",
                                             "-target", host_architecture(platform.machine()) + "-apple-macosx14.0",
                                             str(helper_source),
                                             "-o", str(helper)], seconds=90)
            contract = runner.helper("trace-contract", helper, "trace-contract", seconds=40)
            receipt["trace_contract"] = validate_trace_contract(contract)
            value = runner.helper("gui-preflight", helper, "preflight", seconds=40)
            receipt.update(helper_sha256=sha(helper), capabilities=value)
            first, second = fixture_files(root, output, create=True)
            receipt["fixture"] = {"sha256": FIXTURE_SHA, "two_names_same_bytes": True, "duration_seconds": 8}
            gui_attempted = True
            selection = runner.helper("finder-reveal", helper, "finder-reveal", first, seconds=40)
            receipt["finder_reveal"] = validate_reveal(selection, first)
            receipt["finder_reveal_scope"] = "Exact Finder selection only; no Open With, application launch or playback acceptance"
            receipt["status"] = "PREFLIGHT_READY"
        else:
            previous = json.loads((output / "preflight.json").read_text())
            require(previous["status"] == "PREFLIGHT_READY" and previous["source_commit"] == commit
                    and previous["helper_sha256"] == sha(helper)
                    and previous["helper_source_sha256"] == sha(helper_source)
                    and previous["controller_sha256"] == sha(Path(__file__)), "preflight binding changed")
            validate_trace_contract(previous.get("trace_contract"))
            first, second = fixture_files(root, output)
            validate_reveal(previous.get("finder_reveal"), first)
            require(previous.get("fixture", {}).get("sha256") == FIXTURE_SHA,
                    "preflight fixture binding changed")
            receipt["fixture"] = previous["fixture"]
            runner.helper("gui-recheck", helper, "preflight")
            config, env = generate_config(output, commit)
            receipt["cold_store_absent_before_build"] = not Path(env["OTTPLAY_DATA_DIR"]).exists()
            build_env = {k: v for k, v in os.environ.items() if not k.startswith(("OTTPLAY_", "APPLE_", "TAURI_SIGNING_"))}
            build_env.update(CSC_IDENTITY_AUTO_DISCOVERY="false", CARGO_BUILD_JOBS="2",
                             CARGO_TARGET_DIR=str(root / "target"), CARGO_TERM_COLOR="never")
            runner.run("build-package", ["npx", "--no-install", "tauri", "build", "--ci", "--bundles", "app",
                                         "--config", str(output / "tauri.qa.json"), "--", "--locked", "--jobs", "2"],
                       cwd=root, env=build_env, seconds=2700)
            app = qualify(runner, root, output, config, env)
            # Detect changes during the build without silently replacing the probed files.
            fixture_files(root, output)
            original_handler = runner.helper("handler-before", helper, "handler", first)
            receipt["handler_before"] = original_handler
            registered = True  # Also unregister a partially successful registration.
            runner.run("register-qa", [ls, "-f", str(app)])
            # OS events, never JavaScript dispatchEvent or a replacement of the app's resolver.
            receipt["steps"] = []
            before = runner.helper("before-cold", helper, "apps", app)
            require(before.get("apps") == [], "cold case found a running QA instance")
            require(not Path(env["OTTPLAY_DATA_DIR"]).exists(), "cold store was created before first launch")
            owned_pid = None
            for index, (kind, file) in enumerate((("finder-open", first), ("finder-open", second), ("finder-drop", first))):
                label = ["cold-open", "warm-open", "window-drop"][index]
                started = time.monotonic()
                gui_attempted = True
                action = runner.helper(label, helper, kind, app, file, seconds=40)
                delivered = time.monotonic()
                require(action.get("selected_file") == str(file) and action.get("delivery_only") is True,
                        "missing exact file delivery evidence")
                if kind == "finder-open":
                    require(action.get("route") == "finder_file_open_with_other"
                            and action.get("selected_application") == str(app)
                            and action.get("default_checkbox") is False
                            and action.get("was_running") is (index != 0), "wrong Finder Open With path")
                else:
                    require(action.get("route") == "finder_selected_file_cgevent_drag", "not a Finder CG drag")
                require(type(action.get("pid")) is int and action["pid"] > 0, "missing exact app PID")
                if owned_pid is None:
                    owned_pid = action["pid"]
                require(action["pid"] == owned_pid, "warm/drop did not target the same app process")
                require(action.get("bundle_id") == config["identifier"] and action.get("path") == str(app), "wrong app identity")
                step = {"name": label, "action": action,
                        "action_elapsed_seconds": round(delivered - started, 3), "samples": []}
                receipt["steps"].append(step)
                for sample in range(3):
                    # Capture pixels first: the short fixture may already be playing.
                    image = output / (label + "-" + str(sample) + ".png")
                    image_result = capture_image(runner, label + "-image-" + str(sample), helper, app,
                                                 image, owned_pid)
                    snapshot = runner.helper(label + "-ax-" + str(sample), helper, "snapshot", app, seconds=40)
                    require(snapshot.get("pid") == owned_pid, "snapshot changed app owner")
                    write(output / (label + "-ax-" + str(sample) + ".json"), snapshot)
                    step["samples"].append({"png": image.name, "sha256": sha(image),
                                            "after_delivery_seconds": round(time.monotonic() - delivered, 3),
                                            "window_id": image_result.get("window_id"),
                                            "native_window": image_result["native_window"]})
                    if sample < 2:
                        time.sleep(.35)
                if index < 2:
                    # Avoid overlapping the 30-second single-use grant horizon.
                    # This is not an admission or playback-readiness assertion.
                    remaining = 31 - (time.monotonic() - delivered)
                    if remaining > 0:
                        require(time.monotonic() + remaining < runner.deadline, "inter-case deadline")
                        time.sleep(remaining)
            receipt["status"] = "CAPTURED_REQUIRES_VISUAL_REVIEW"
            receipt["limits"] = ["OS interaction completion is not media admission or decoding proof",
                                 "No Finder default application changes", "No persisted profile was seeded or saved; fresh default/demo state is observed as rendered",
                                 "Inter-case wait avoids overlapping grants but is not frontend readiness proof",
                                 "Warm and drop fixture names differ, their media bytes are identical",
                                 "No #1045 aspect-lock qualification in this #1042 stage"]
        clean_source(runner, root, args.phase + "-source-after")
        require(sha(helper_source) == receipt["helper_source_sha256"]
                and sha(Path(__file__)) == receipt["controller_sha256"], "driver source changed")
    except BaseException as error:
        receipt["status"] = "FAILED"
        receipt["error"] = type(error).__name__ + ": " + str(error)
    finally:
        if gui_attempted and receipt["status"] == "FAILED":
            collect_failure_evidence(receipt, runner, helper)
        if app is not None:
            try:
                receipt["app_cleanup"] = runner.helper("quit-qa", helper, "quit", app, cleanup=True, seconds=15)
            except BaseException as error:
                receipt["status"] = "FAILED"
                receipt["cleanup_error"] = type(error).__name__ + ": " + str(error)
        if registered:
            try:
                runner.run("unregister-qa", [ls, "-u", str(app)], cleanup=True, seconds=10)
                receipt["unregistered"] = True
                final_handler = runner.helper("handler-after", helper, "handler", first, cleanup=True, seconds=15)
                receipt["handler_after"] = final_handler
                require(final_handler.get("application_path") == original_handler.get("application_path"),
                        "effective MP4 handler changed")
            except BaseException as error:
                receipt["status"] = "FAILED"
                receipt["unregister_error"] = type(error).__name__ + ": " + str(error)
        receipt["commands_sha256"] = sha(output / "commands.json") if (output / "commands.json").exists() else None
        write(output / (args.phase + ".json"), receipt)
        print(json.dumps(receipt, indent=2))
    return 0 if receipt["status"] in {"PREFLIGHT_READY", "CAPTURED_REQUIRES_VISUAL_REVIEW"} else 1


if __name__ == "__main__":
    def interrupted(signum, frame):
        raise KeyboardInterrupt("signal " + str(signum))
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    raise SystemExit(main())
