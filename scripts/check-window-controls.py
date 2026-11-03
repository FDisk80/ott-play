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


def validate_evidence(report, missing):
    require(report.get("status") == "pass", f"Native assertion failed: {report.get('error')}")
    require(report.get("owned_labels") == ["main", "pip"], "Wrong fixture window ownership")
    require(report.get("cleanup_errors") == [], "Native window cleanup failed")
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


def run_case(binary, output, missing):
    name = "missing-permission" if missing else "production-permissions"
    directory = Path(tempfile.mkdtemp(prefix="ott-window-controls-"))
    result = {"mode": name, "status": "fail"}
    process = None
    try:
        command = [str(binary), str(directory)] + (["--without-permission"] if missing else [])
        with (output / f"{name}.log").open("w", encoding="utf-8") as log:
            process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT)
            result["pid"] = process.pid
            try:
                result["exit_code"] = process.wait(timeout=40)
            finally:
                stop_owned_process(process)
        native = directory / "result.json"
        require(native.is_file(), "Native fixture produced no evidence")
        result["native"] = json.loads(native.read_text(encoding="utf-8"))
        require(result["exit_code"] == 0, f"Fixture exited {result['exit_code']}")
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
    summary = {"status": "pass" if all(item["status"] == "pass" for item in reports) else "fail", "runs": reports}
    (args.output / "result.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0 if summary["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
