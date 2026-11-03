#!/usr/bin/env python3
"""Exercise native read-only smoke through a trusted CLI and loopback HTTP only."""
import argparse
import copy
from http.server import BaseHTTPRequestHandler, HTTPServer
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

sys.dont_write_bytecode = True
DEVICE = "fixture-native-device"
TOKEN = "fixture-only-control-token"


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def load_smoke():
    path = Path(__file__).with_name("smoke-webos-native-cli.py")
    spec = importlib.util.spec_from_file_location("native_transport_smoke", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Controller(HTTPServer):
    def __init__(self, fixture):
        super().__init__(("127.0.0.1", 0), Handler)
        self.fixture, self.mode = fixture, "success"
        self.requests, self.polls, self.errors = [], [], []


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def reply(self, status, value):
        body = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def query(self):
        url = urlsplit(self.path)
        query = parse_qs(url.query)
        require(url.path == "/api/requests", "unexpected_route")
        require(query.get("device_id") == [DEVICE], "unexpected_device")
        require(self.headers.get("Authorization") == "Bearer " + TOKEN, "wrong_fixture_auth")
        return query

    def do_POST(self):
        try:
            require(set(self.query()) == {"device_id"}, "unexpected_enqueue_query")
            length = int(self.headers.get("Content-Length", "0"))
            require(0 < length <= 16384, "invalid_fixture_body")
            request = json.loads(self.rfile.read(length))
            require(set(request) == {"action", "params"}, "unexpected_envelope")
            identifier = format(len(self.server.requests) + 1, "032x")
            self.server.requests.append((identifier, request))
            self.reply(202, {"id": identifier, "receipt_wait_ms": 1})
        except (ValueError, KeyError, TypeError):
            self.server.errors.append("enqueue_rejected")
            self.reply(400, {"error": "invalid fixture request"})

    def do_GET(self):
        try:
            query = self.query()
            require(set(query) <= {"device_id", "id", "wait_ms"}, "unexpected_receipt_query")
            identifier = query["id"][0]
            request = next(row for key, row in self.server.requests if key == identifier)
            self.server.polls.append(identifier)
            if self.server.mode == "pending":
                self.reply(202, {"status": "pending"})
                return
            status, data = "ok", self.data(request)
            if self.server.mode == "unsupported":
                status, data = "unsupported", {"error": "Unsupported fixture capability"}
            self.reply(200, {"id": identifier, "status": status, "data": data})
        except (ValueError, KeyError, TypeError, StopIteration):
            self.server.errors.append("receipt_rejected")
            self.reply(400, {"error": "invalid fixture receipt"})

    def data(self, request):
        action, params, fixture = request["action"], request["params"], self.server.fixture
        if action == "capabilities" and params == {}:
            return fixture["capabilities"]
        if action == "status" and params == {}:
            count = sum(row["action"] == "status" for _, row in self.server.requests)
            return {"uuid": DEVICE, "player": copy.deepcopy(fixture["capabilities"]["player"]),
                    "playback": {"state": "playing", "provider": "m3u", "kind": "live",
                                 "media_id": "fixture-media", "position": 10 + count / 10}}
        require(action == "player_settings", "unexpected_action")
        require(params.get("runtime") == fixture["schema"]["runtime"], "wrong_runtime")
        if params == {"op": "schema", "runtime": fixture["schema"]["runtime"], "limit": 20}:
            return fixture["schema"]
        require(set(params) == {"op", "runtime", "id"} and params["op"] == "get", "mutation_requested")
        return next(row for row in fixture["gets"] if row["setting"]["id"] == params["id"])


def exercise(smoke, modules, controller, config_path):
    api, settings, workbench, hashes = modules
    args = SimpleNamespace(timeout=1, budget=5, samples=2, interval=0.03,
                           expected_version=controller.fixture["capabilities"]["player"]["version"],
                           tv_status=False)
    outcomes = {}
    for mode in ("success", "unsupported", "pending"):
        controller.mode = mode
        start = len(controller.requests)
        client = api.Client(api.read_json(str(config_path)), args.timeout)
        report = smoke.collect(api, settings, workbench, client, DEVICE, args)
        require(report["acceptance"] == "incomplete", "acceptance_overclaimed")
        require(report["physical_display_verified"] is False, "physical_display_overclaimed")
        for kind in ("renderer", "decoder"):
            require(report["checks"][kind]["status"] == "not_observed", kind + "_overclaimed")
        requests = [row for _, row in controller.requests[start:]]
        if mode == "success":
            expected = [{"action": "capabilities", "params": {}},
                        {"action": "player_settings", "params": {"op": "schema",
                         "runtime": controller.fixture["schema"]["runtime"], "limit": 20}}]
            expected += [{"action": "player_settings", "params": {"op": "get",
                          "runtime": controller.fixture["schema"]["runtime"], "id": key}}
                         for key in smoke.SETTING_IDS]
            expected += [{"action": "status", "params": {}}] * args.samples
            require(requests == expected, "non_read_only_request_sequence")
            receipts = [row.get("request_id") for row in report["requests"]]
            require(len(receipts) == len(expected) == len(set(receipts)) and None not in receipts,
                    "missing_or_repeated_receipt")
            require(report["settings"]["status"] == "observed", "settings_not_verified")
            require(report["checks"]["position"]["status"] == "observed", "position_not_sampled")
            outcomes[mode] = "incomplete_with_distinct_read_only_receipts"
        else:
            reason = "unsupported" if mode == "unsupported" else "request_pending_timeout"
            require(report.get("error") == reason, "incorrect_negative_classification")
            require(requests == [{"action": "capabilities", "params": {}}], "failed_request_repeated")
            outcomes[mode] = reason
    require(not controller.errors, "fixture_rejected_transport")
    return {"status": "passed", "outcomes": outcomes, "cli_sha256": hashes}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cli", type=Path, required=True, help="Explicitly trusted installed ott.py")
    args = parser.parse_args()
    smoke = load_smoke()
    modules = smoke.load_cli(args.cli)
    fixture = json.loads((Path(__file__).resolve().parents[1]
                          / "tests/fixtures/native-cli-settings.json").read_text(encoding="utf-8"))
    controller = Controller(fixture)
    worker = threading.Thread(target=controller.serve_forever, kwargs={"poll_interval": 0.02})
    worker.start()
    try:
        with tempfile.TemporaryDirectory(prefix="native-cli-transport-") as folder, \
                patch.dict(os.environ, {"NO_PROXY": "127.0.0.1", "no_proxy": "127.0.0.1"}):
            credentials, config = Path(folder) / "credentials.json", Path(folder) / "cli.json"
            credentials.write_text(json.dumps({"admin_token": TOKEN, "devices": [{"id": DEVICE}]}))
            config.write_text(json.dumps({"server": "http://127.0.0.1:" + str(controller.server_port),
                                         "server_config": str(credentials), "players": {"fixture": DEVICE}}))
            credentials.chmod(0o600)
            config.chmod(0o600)
            result = exercise(smoke, modules, controller, config)
    finally:
        controller.shutdown()
        controller.server_close()
        worker.join(timeout=2)
    require(not worker.is_alive(), "controller_did_not_stop")
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"status": "failed", "error_type": type(error).__name__}), file=sys.stderr)
        sys.exit(1)
