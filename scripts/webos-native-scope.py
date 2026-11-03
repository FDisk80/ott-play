#!/usr/bin/env python3
"""Keep native ARM builds inside the required gate and scoped to their inputs."""

import os
import re
import subprocess
from pathlib import Path


PREFIXES = ("native/webos/", "scripts/webos-runtime-sources")
PATHS = {
    ".github/workflows/ci.yml",
    ".github/workflows/webos-native.yml",
    ".github/workflow-tests/test_webos_native_scope.py",
    "scripts/webos-native-scope.py",
    "tests/test_webos_runtime_sources.py",
    "scripts/verify-webos-native-release.py",
    "tests/test_webos_native_release.py",
}


def requires_build(event, base, head, diff):
    """Non-PR validation builds everything; malformed PR metadata never skips CI."""
    if event != "pull_request":
        return True
    if not all(re.fullmatch(r"[0-9a-f]{40}", sha or "") for sha in (base, head)):
        raise ValueError("Pull request base and head must be full commit SHAs")
    return any(path in PATHS or path.startswith(PREFIXES) for path in diff(base, head))


def changed_paths(base, head, *, cwd=None):
    result = subprocess.run(
        ["git", "diff", "--no-renames", "--name-only", "-z", base, head, "--"],
        check=True, stdout=subprocess.PIPE, cwd=cwd,
    )
    return result.stdout.decode("utf-8", errors="surrogateescape").split("\0")


def main():
    build = requires_build(
        os.environ.get("EVENT_NAME"), os.environ.get("BASE_SHA"),
        os.environ.get("HEAD_SHA"), changed_paths,
    )
    value = "true" if build else "false"
    with Path(os.environ["GITHUB_OUTPUT"]).open("a", encoding="utf-8") as output:
        output.write(f"build={value}\n")
    print(f"Native webOS candidate required: {value}")


if __name__ == "__main__":
    main()
