"""Capture failed host-benchmark Cargo output without editing either source tree.

Loaded through a private PYTHONPATH by the benchmark workflow. Only the exact
selected benchmark process activates; its children receive the original path.
Successful calls retain their result and do no diagnostic I/O. This observes
direct Cargo calls, not Cargo hidden inside a shell or a nested make process.
"""

import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


CONTEXT = "OTT_NATIVE_BENCH_DIAGNOSTICS"


def _activate():
    raw = os.environ.get(CONTEXT)
    if not raw:
        return
    context = json.loads(raw)
    target = Path(context["target"]).resolve()
    if not sys.argv or Path(sys.argv[0]).resolve() != target:
        return

    # Do this before the benchmark snapshots os.environ for Cargo. The parent
    # check-lock process keeps the injection, but timed child processes do not.
    del os.environ[CONTEXT]
    original_path = context["pythonpath"]
    if original_path is None:
        os.environ.pop("PYTHONPATH", None)
    else:
        os.environ["PYTHONPATH"] = original_path
    hook_dir = str(Path(__file__).resolve().parent)
    if hook_dir in sys.path:
        sys.path.remove(hook_dir)

    output = Path(context["output"])
    original_run = subprocess.run

    def save_failure(command, returncode, stdout, stderr):
        try:
            if (not isinstance(command, (list, tuple)) or not command
                    or Path(os.fsdecode(command[0])).name != "cargo"):
                return
            directory = Path(tempfile.mkdtemp(prefix="cargo-", dir=output))
            streams = {}
            for name, value in (("stdout", stdout), ("stderr", stderr)):
                data = value.encode("utf-8") if isinstance(value, str) else (value or b"")
                (directory / name).write_bytes(data)
                streams[name] = {"sha256": hashlib.sha256(data).hexdigest(),
                                 "bytes": len(data), "text": isinstance(value, str)}
            (directory / "result.json").write_text(json.dumps({
                "command": [os.fsdecode(arg) for arg in command],
                "returncode": returncode, "streams": streams,
            }, indent=2) + "\n")
        except Exception as error:
            # Evidence I/O must never turn a genuine compiler failure into a
            # different exception or make a failed command appear successful.
            try:
                print("native benchmark: could not save Cargo diagnostics: " + str(error),
                      file=sys.stderr, flush=True)
            except Exception:
                pass

    def observed_run(*args, **kwargs):
        try:
            result = original_run(*args, **kwargs)
        except subprocess.CalledProcessError as error:
            save_failure(error.cmd, error.returncode, error.stdout, error.stderr)
            raise
        if result.returncode:
            save_failure(result.args, result.returncode, result.stdout, result.stderr)
        return result

    # A receipt is required by the workflow even when sitecustomize import
    # errors would otherwise be ignored by Python at startup.
    with (output / "activation.json").open("x") as stream:
        json.dump({"schema": 1, "target": str(target),
                   "target_sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                   "hook_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
                  stream, indent=2)
        stream.write("\n")
    subprocess.run = observed_run


_activate()
