"""Black-box lifecycle checks for a prebuilt standalone companion, without Cargo.

OTTPLAY_COMPANION_BIN=/absolute/path/to/ottplay-companion \\
    python3 tests/native_companion/standalone_smoke.py

The fixture never admits a torrent or contacts a tracker. Each child gets a new
private directory, a random token, and a kernel-selected loopback port. All
children are reaped, including after failed assertions. No TV is contacted.

For a constrained build, OTT_COMPANION_TEST_ENV may contain a JSON object of
explicit helper environment overrides. OTT_COMPANION_TEST_EXPECT_LIMITS may
contain expected capabilities, e.g. {"cacheBytes":134217728,"maxSessions":1}.
These are opt-in: ambient OTT_* settings are never inherited by the child.
"""

from contextlib import contextmanager
import http.client
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import tempfile
import time
import unittest


ROOT = Path(__file__).resolve().parents[2]
BINARY = Path(os.environ.get("OTTPLAY_COMPANION_BIN", ROOT / "target/debug/ottplay-companion")).resolve()
READY = re.compile(rb"^ottplay-companion: http://127\.0\.0\.1:([0-9]{1,5})$", re.MULTILINE)
DEADLINE = 15
MAX_RESPONSE = 1024 * 1024


def json_environment(name):
    value = json.loads(os.environ.get(name, "{}"))
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be a JSON object")
    return value


OVERRIDES = json_environment("OTT_COMPANION_TEST_ENV")
EXPECTED = json_environment("OTT_COMPANION_TEST_EXPECT_LIMITS")
if any(not isinstance(k, str) or not k.startswith("OTT_COMPANION_")
       or not isinstance(v, str) for k, v in OVERRIDES.items()):
    raise ValueError("OTT_COMPANION_TEST_ENV requires OTT_COMPANION_* string values")
if set(OVERRIDES) & {"OTT_COMPANION_DIR", "OTT_COMPANION_TOKEN", "OTT_COMPANION_PORT",
                      "OTT_COMPANION_HOST", "OTT_COMPANION_ALLOW_REMOTE", "OTT_COMPANION_PLUGIN_DIR"}:
    raise ValueError("Test overrides cannot change fixture ownership, networking, or plugins")


def request(port, path):
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
    try:
        connection.request("GET", path)
        response = connection.getresponse()
        body = response.read(MAX_RESPONSE + 1)
        if len(body) > MAX_RESPONSE:
            raise AssertionError("Companion response exceeded the fixture limit")
        return response.status, body
    finally:
        connection.close()


class Child:
    def __init__(self, directory, overrides=None):
        self.token = secrets.token_hex(32)
        self.port = None
        self.log = tempfile.TemporaryFile()
        environment = {k: v for k, v in os.environ.items() if not k.startswith("OTT_")}
        environment.update(OVERRIDES)
        environment.update({
            "OTT_COMPANION_DIR": str(directory),
            "OTT_COMPANION_TOKEN": self.token,
            "OTT_COMPANION_PORT": "0",
            "OTT_COMPANION_HOST": "127.0.0.1",
            "OTT_COMPANION_ALLOW_REMOTE": "0",
        })
        for key, value in (overrides or {}).items():
            if value is None:
                environment.pop(key, None)
            else:
                environment[key] = value
        try:
            self.process = subprocess.Popen(
                [str(BINARY)], cwd=ROOT, env=environment,
                stdin=subprocess.DEVNULL, stdout=self.log, stderr=subprocess.STDOUT,
            )
        except BaseException:
            self.log.close()
            raise

    def output(self):
        # The child inherited this descriptor's open-file description. Do not
        # seek its shared offset while it writes a readiness/error message.
        output = os.pread(self.log.fileno(), 65537, 0)
        if len(output) > 65536:
            raise AssertionError("Unexpected excessive helper output")
        return output

    def safe_output(self):
        return self.output().replace(self.token.encode(), b"<redacted>").decode(errors="replace")

    def path(self, token=None):
        return f"/companion/{token or self.token}/v1/capabilities"

    def ready(self):
        deadline = time.monotonic() + DEADLINE
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                raise AssertionError("Helper exited before readiness: " + self.safe_output())
            match = READY.search(self.output())
            if match:
                self.port = int(match.group(1))
                if not 0 < self.port <= 65535:
                    raise AssertionError("Invalid ephemeral port")
                try:
                    status, body = request(self.port, self.path())
                    if status == 200:
                        return json.loads(body)
                except (OSError, http.client.HTTPException):
                    pass
            time.sleep(0.025)
        raise AssertionError("Helper readiness deadline exceeded: " + self.safe_output())

    def terminate(self):
        self.process.terminate()
        return self.process.wait(timeout=DEADLINE)

    def close(self):
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=DEADLINE)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
        else:
            self.process.wait()
        self.log.close()


@contextmanager
def child(directory, overrides=None):
    running = Child(directory, overrides)
    try:
        yield running
    finally:
        running.close()


class StandaloneCompanionSmoke(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not BINARY.is_file() or not os.access(BINARY, os.X_OK):
            raise RuntimeError("Set OTTPLAY_COMPANION_BIN to a prebuilt executable; this test never builds it")

    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="ott-standalone-smoke-")
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name) / "private"

    def assert_no_token(self, running):
        self.assertNotIn(running.token.encode(), running.output(), "Helper leaked the endpoint token")

    def test_ephemeral_listener_is_authenticated_and_has_no_player_routes(self):
        with child(self.directory) as running:
            capabilities = running.ready()
            self.assertEqual(capabilities["schema"], 1)
            self.assertIs(capabilities["torrent"], True)
            self.assertIs(capabilities["inboundPeerListener"], False)
            for name, value in EXPECTED.items():
                self.assertEqual(capabilities.get(name), value, name)
            self.assertEqual(request(running.port, running.path("wrong-token"))[0], 401)
            self.assertEqual(request(running.port, "/health")[0], 401)
            self.assertEqual(request(running.port, "/")[0], 401)
            self.assert_no_token(running)

    def test_shutdown_releases_listener_and_cache_owner_without_deleting_other_data(self):
        with child(self.directory) as running:
            running.ready()
            sentinel = self.directory / "unrelated-state"
            sentinel.write_text("keep", encoding="utf-8")
            port = running.port
            self.assertEqual(running.terminate(), 0)
            self.assert_no_token(running)
            with socket.socket() as probe:
                probe.settimeout(1)
                self.assertNotEqual(probe.connect_ex(("127.0.0.1", port)), 0)
        with child(self.directory) as restarted:
            restarted.ready()
            self.assertEqual(sentinel.read_text(encoding="utf-8"), "keep")
            self.assertEqual(restarted.terminate(), 0)
            self.assert_no_token(restarted)

    def test_two_helpers_cannot_own_the_same_cache(self):
        with child(self.directory) as first:
            first.ready()
            with child(self.directory) as second:
                self.assertNotEqual(second.process.wait(timeout=DEADLINE), 0)
                self.assertIsNone(READY.search(second.output()))
                self.assert_no_token(second)
            self.assertEqual(request(first.port, first.path())[0], 200)

    def test_constrained_limits_reach_the_service_capabilities(self):
        limits = {
            "OTT_COMPANION_CACHE_BYTES": str(64 * 1024 * 1024),
            "OTT_COMPANION_MAX_SESSIONS": "1",
            "OTT_COMPANION_MAX_STREAMS": "2",
        }
        with child(self.directory, limits) as running:
            capabilities = running.ready()
            self.assertEqual(capabilities["cacheBytes"], 64 * 1024 * 1024)
            self.assertEqual(capabilities["maxSessions"], 1)
            self.assertEqual(capabilities["maxStreams"], 2)
            self.assert_no_token(running)

    def test_invalid_or_remote_configuration_fails_without_ready_or_token_leak(self):
        invalid = [
            {"OTT_COMPANION_HOST": "0.0.0.0"},
            {"OTT_COMPANION_ALLOW_REMOTE": "1"},
            {"OTT_COMPANION_PORT": "65536"},
            {"OTT_COMPANION_DIR": "relative"},
            {"OTT_COMPANION_DIR": None},
            {"OTT_COMPANION_CACHE_BYTES": "0"},
            {"OTT_COMPANION_MAX_SESSIONS": "3"},
            {"OTT_COMPANION_MAX_STREAMS": "0"},
        ]
        for overrides in invalid:
            with self.subTest(overrides=overrides), child(self.directory, overrides) as running:
                self.assertNotEqual(running.process.wait(timeout=DEADLINE), 0)
                self.assertIsNone(READY.search(running.output()))
                self.assert_no_token(running)


if __name__ == "__main__":
    unittest.main(verbosity=2)
