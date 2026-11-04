#!/usr/bin/env python3
"""Run the already-built Windows fixture; never launch installed players."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def validate_common_evidence(report):
    require(report.get("status") == "pass", f"Native assertion failed: {report.get('error')}")
    require(report.get("owned_labels") == ["main", "pip"], "Wrong fixture window ownership")
    require(report.get("cleanup_errors") == [], "Native window cleanup failed")


def validate_evidence(report, missing):
    validate_common_evidence(report)
    denials = report.get("denials", [])
    expected = {"set_always_on_top", "set_fullscreen", "toggle_fullscreen"} if missing else {"set_always_on_top"}
    require(len(denials) == len(expected), "Missing ACL denial evidence")
    require({entry.get("command") for entry in denials} == expected, "Wrong denied commands")
    require(all(entry.get("window") == ("main" if missing else "pip")
                and "not allowed" in entry.get("error", "") for entry in denials), "Not an ACL denial")
    require(report.get("mode") == ("missing-permission" if missing else "production-permissions"), "Wrong ACL mode")
    if missing:
        return
    require(report.get("aux_unchanged") is True, "Auxiliary window changed")
    top = report.get("topmost_sequence", [])
    full = report.get("fullscreen_sequence", [])
    require(len(top) == 4 and len(full) == 4, "Incomplete native state sequence")
    for state, expected_top in zip(top, [True, True, False, False]):
        require(state.get("topmost") is expected_top and state.get("win32_topmost") is expected_top
                and state.get("fullscreen") is False, "Topmost native readback disagrees")
    for state, expected_top, expected_full in zip(full, [False, False, True, True], [True, False, True, False]):
        require(state.get("topmost") is expected_top and state.get("win32_topmost") is expected_top
                and state.get("fullscreen") is expected_full, "Fullscreen native readback disagrees")
    for name in ["initial", "final"]:
        state = report.get(name, {})
        require(all(state.get(key) is False for key in ["topmost", "win32_topmost", "fullscreen"]),
                f"Wrong {name} native state")


def validate_restoration_evidence(report, phase):
    validate_common_evidence(report)
    require(report.get("mode") == "preference-restoration" and report.get("phase") == phase,
            "Wrong preference restoration phase")
    require(report.get("aux_unchanged") is True, "Auxiliary window changed")
    for name, expected in [("initial", phase == "unpin"), ("final", phase == "pin")]:
        state = report.get(name, {})
        require(state.get("topmost") is expected and state.get("win32_topmost") is expected
                and state.get("fullscreen") is False, f"Wrong restored {name} native state")


def stop_owned_process(process):
    """PID comes only from this runner's Popen. Never terminate by image name."""
    if process.poll() is not None:
        return
    subprocess.run(["taskkill.exe", "/PID", str(process.pid), "/T", "/F"],
                   check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
    process.wait(timeout=5)


def remove_private_data(directory):
    deadline = time.monotonic() + 5
    while True:
        try:
            shutil.rmtree(directory)
            return
        except OSError:
            if time.monotonic() >= deadline:
                raise
            time.sleep(0.1)


def run_case(binary, output, missing, *, phase=None, preferences=None):
    require(phase in {None, "pin", "unpin", "verify-off"}, "Unknown preference phase")
    require((phase is None) == (preferences is None), "Preference phases need an owned shared directory")
    require(phase is None or not missing, "Preference phases require production permissions")
    name = f"restore-{phase}" if phase else ("missing-permission" if missing else "production-permissions")
    directory = Path(tempfile.mkdtemp(prefix="ott-window-controls-"))
    result = {"mode": name, "status": "fail"}
    process = None
    try:
        command = [str(binary), str(directory)] + (["--without-permission"] if missing else [])
        if phase:
            command += ["--preference-phase", phase]
        environment = os.environ.copy()
        environment["OTTPLAY_DATA_DIR"] = str(preferences if phase else directory / "preferences")
        environment.pop("OTTPLAY_INSTANCE", None)
        with (output / f"{name}.log").open("w", encoding="utf-8") as log:
            process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, env=environment)
            result["pid"] = process.pid
            try:
                result["exit_code"] = process.wait(timeout=40)
            finally:
                stop_owned_process(process)
        native = directory / "result.json"
        require(native.is_file(), "Native fixture produced no evidence")
        result["native"] = json.loads(native.read_text(encoding="utf-8"))
        require(result["exit_code"] == 0, f"Fixture exited {result['exit_code']}")
        if phase:
            validate_restoration_evidence(result["native"], phase)
            stored = preferences / "window-always-on-top"
            require(stored.is_file() and not stored.is_symlink(), "Preference file is missing or invalid")
            with stored.open("rb") as stream:
                require(stream.read(3) == (b"1\n" if phase == "pin" else b"0\n"),
                        "Confirmed preference bytes were not retained")
            result["saved_preference"] = phase == "pin"
        else:
            validate_evidence(result["native"], missing)
        result["status"] = "pass"
    except Exception as error:
        result["error"] = str(error)
        native = directory / "result.json"
        if native.is_file() and "native" not in result:
            try:
                result["native"] = json.loads(native.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                pass
    finally:
        try:
            if process is not None:
                stop_owned_process(process)
            remove_private_data(directory)
            result["private_data_removed"] = True
        except Exception as error:
            result["status"] = "fail"
            result["cleanup_error"] = str(error)
        (output / f"{name}.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result


def run_restoration_sequence(binary, output):
    preferences = Path(tempfile.mkdtemp(prefix="ott-window-preferences-"))
    summary = {"status": "fail", "runs": []}
    try:
        for phase in ["pin", "unpin", "verify-off"]:
            result = run_case(binary, output, False, phase=phase, preferences=preferences)
            summary["runs"].append(result)
            require(result["status"] == "pass", f"Preference phase failed: {phase}")
        summary["status"] = "pass"
    except (OSError, RuntimeError) as error:
        summary["error"] = str(error)
    finally:
        try:
            remove_private_data(preferences)
            summary["preferences_removed"] = True
        except OSError as error:
            summary["status"] = "fail"
            summary["cleanup_error"] = str(error)
        (output / "restoration.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, default=Path("target/debug/examples/window_controls_smoke.exe"))
    parser.add_argument("--output", type=Path, default=Path("build/windows-window-controls-report"))
    args = parser.parse_args()
    require(os.name == "nt", "Native window fixture requires Windows")
    binary = args.binary.resolve()
    require(binary.is_file(), "Build window_controls_smoke before running the fixture")
    args.output.mkdir(parents=True, exist_ok=True)
    reports = [run_case(binary, args.output, missing) for missing in [True, False]]
    restoration = run_restoration_sequence(binary, args.output)
    passed = all(item["status"] == "pass" for item in reports) and restoration["status"] == "pass"
    summary = {"status": "pass" if passed else "fail", "runs": reports, "restoration": restoration}
    (args.output / "result.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0 if summary["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
