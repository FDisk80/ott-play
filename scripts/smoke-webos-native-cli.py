#!/usr/bin/env python3
"""Read-only native webOS acceptance using the installed OTT CLI's own transport.

Position progress is not decoded-frame or physical-display evidence. The current
native protocol cannot complete display acceptance; a healthy observation exits 2.
"""

import argparse
import contextlib
import hashlib
import importlib.util
import io
import json
import math
import os
from pathlib import Path
import re
import shutil
import sys
import time

sys.dont_write_bytecode = True


APP_ID = "com.openottplay.player.native"
SETTING_IDS = ("uiFontScale", "players", "interfaceMode")
STATES = {"idle", "loading", "buffering", "error", "paused", "playing", "standby"}
REASONS = {"unsupported", "rejected", "controller_unavailable", "controller_http_error",
           "request_pending_timeout", "receipt_missing", "unauthorized", "rate_limited",
           "invalid_response", "deadline_exceeded", "unavailable"}


class Failure(Exception):
    """Only a closed reason, never remote text or a filesystem path, is emitted."""

    def __init__(self, reason):
        self.reason = reason


def check(condition, reason="invalid_response"):
    if not condition:
        raise Failure(reason)


def number(value):
    return type(value) in (int, float) and 0 <= value <= 1e15 and math.isfinite(value)


def verdict(status, reason):
    return {"status": status, "reason": reason}


def summarize(samples, expected_version):
    """Project native status samples; source identifiers never leave this function.

    Samples are live, separately correlated RPC results with local monotonic times.
    Even a plausible media clock cannot exclude an unobserved seek/restart, and no
    native playback generation is currently exposed by this wire contract.
    """
    result = {
        "identity": verdict("not_observed", "no_samples"),
        "control": verdict("not_observed", "no_samples"),
        "position": verdict("not_observed", "insufficient_samples"),
        "renderer": verdict("not_observed", "no_renderer_evidence_in_native_status"),
        "decoder": verdict("not_observed", "no_decoded_frame_evidence_in_native_status"),
        "physical_display": verdict("not_observed", "requires_device_observation"),
        "sample_count": len(samples),
    }
    if not samples:
        return result
    previous = None
    runtime = media = None
    reason = None
    positions = []
    try:
        for sample in samples:
            check(isinstance(sample, dict))
            start, end = sample.get("started_seconds"), sample.get("completed_seconds")
            check(number(start) and number(end) and end >= start)
            if previous:
                check(start > previous["completed_seconds"], "overlapping_samples")
            data = sample.get("data")
            check(isinstance(data, dict))
            player, playback = data.get("player"), data.get("playback")
            check(isinstance(player, dict) and isinstance(playback, dict))
            check(player.get("platform") == "webos-native", "wrong_platform")
            check(player.get("version") == expected_version, "wrong_version")
            current_runtime = player.get("runtime")
            check(isinstance(current_runtime, str) and bool(re.fullmatch(r"[a-z0-9-]{1,64}", current_runtime)))
            check(runtime is None or runtime == current_runtime, "runtime_changed")
            runtime = current_runtime
            check(type(player.get("standby")) is bool)
            phase = playback.get("state")
            check(isinstance(phase, str) and phase in STATES)
            if phase == "error":
                reason = "playback_error"
            elif phase != "playing" or player["standby"]:
                reason = reason or "playback_not_active"
            identity = playback.get("media_id")
            if not isinstance(identity, str) or not identity or len(identity) > 4096:
                reason = reason or "media_identity_unavailable"
            provider, kind = playback.get("provider"), playback.get("kind")
            check(provider is None or (isinstance(provider, str)
                                       and bool(re.fullmatch(r"[a-z0-9_-]{1,64}", provider))))
            check(kind is None or (isinstance(kind, str) and kind in {"none", "live", "archive", "vod", "unknown"}))
            if provider is None or kind in (None, "none", "unknown"):
                reason = reason or "source_identity_unavailable"
            source = (provider, kind, identity)
            if media is not None and source != media:
                reason = reason or "media_changed"
            media = source
            position = playback.get("position")
            if not number(position):
                reason = reason or "position_unavailable"
            else:
                positions.append(position)
            previous = sample
    except Failure as exc:
        result["identity"] = verdict("failed", exc.reason)
        return result
    result["identity"] = verdict("observed", "expected_native_runtime")
    result["control"] = verdict("observed", "live_status_replies")
    if reason:
        result["position"] = verdict("failed" if reason == "playback_error" else "not_observed", reason)
        return result
    if len(samples) < 2:
        return result
    for index in range(1, len(samples)):
        delta = positions[index] - positions[index - 1]
        maximum_elapsed = samples[index]["completed_seconds"] - samples[index - 1]["started_seconds"]
        if delta <= 0:
            result["position"] = verdict("not_observed", "position_stalled_or_reset")
            return result
        if delta > maximum_elapsed * 2 + 1:
            result["position"] = verdict("not_observed", "position_jump")
            return result
    result["position"] = verdict("observed", "reported_media_clock_advanced")
    result["position"]["delta_seconds"] = round(positions[-1] - positions[0], 3)
    return result


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    check(spec is not None and spec.loader is not None, "cli_incompatible")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_cli(path):
    # Resolve once: an atomic CLI upgrade must not mix revisions in one run.
    path = Path(path).resolve(strict=True)
    api = load_module("native_smoke_ott", path)
    settings = load_module("native_smoke_settings", path.with_name("player_settings.py"))
    workbench = load_module("native_smoke_workbench", path.with_name("workbench.py"))
    for attribute in ("Client", "capabilities_metadata", "read_json", "Error"):
        check(hasattr(api, attribute), "cli_incompatible")
    hashes = {name: hashlib.sha256(file.read_bytes()).hexdigest()
              for name, file in (("ott.py", path), ("player_settings.py", path.with_name("player_settings.py")),
                                 ("workbench.py", path.with_name("workbench.py")))}
    return api, settings, workbench, hashes


class Reader:
    """Fence the existing CLI transport to this device and read-only requests."""

    def __init__(self, api, client, workbench, device, timeout, budget, clock=time.monotonic):
        self.api, self.client, self.device = api, client, device
        self.clock, self.timeout = clock, timeout
        self.origin = clock()
        self.deadline = self.origin + budget
        self.receipts = []
        self.classifier = workbench.Workbench(api, client, device, timeout)

    def remaining(self):
        left = min(self.timeout, self.deadline - self.clock())
        check(left > 0, "deadline_exceeded")
        return left

    def read(self, action, params):
        permitted = action in ("capabilities", "status") and params == {}
        if action == "player_settings" and isinstance(params, dict):
            permitted = (params.get("op") == "schema" and set(params) <= {"op", "runtime", "limit", "cursor"}
                         and params.get("limit") == 20) or (
                params.get("op") == "get" and set(params) == {"op", "runtime", "id"}
                and params["id"] in SETTING_IDS)
        check(permitted, "mutation_refused")
        start = self.clock() - self.origin
        record = {"action": action, "status": "unknown"}
        try:
            self.client.timeout = self.remaining()
            deadline = self.clock() + self.client.timeout
            receipt = self.client.call_receipt(self.device, action, params)
            check(self.clock() < min(self.deadline, deadline), "deadline_exceeded")
            check(isinstance(receipt, dict) and receipt.get("status") == "ok")
            request_id = receipt.get("request_id")
            check(isinstance(request_id, str) and bool(re.fullmatch(r"[0-9a-f]{32}", request_id)))
            check(all(row.get("request_id") != request_id for row in self.receipts), "repeated_receipt")
            record.update(status="ok", request_id=request_id)
            check(isinstance(receipt.get("data"), dict))
            return {"data": receipt["data"], "started_seconds": start,
                    "completed_seconds": self.clock() - self.origin}
        except Failure:
            raise
        except self.api.Error as exc:
            reason = self.classifier.reason(exc)
            reason = reason if reason in REASONS else "unavailable"
            record.update(status="unknown", reason=reason)
            raise Failure(reason) from None
        finally:
            self.receipts.append(record)


def settings_probe(reader, settings, runtime):
    params = {"op": "schema", "runtime": runtime, "limit": 20}
    ids, cursors, context = set(), set(), None
    descriptors = {}
    for _ in range(8):
        data = settings.metadata(reader.api, reader.read("player_settings", params)["data"], params)
        check(context is None or data["context"] == context, "settings_context_changed")
        context = data["context"]
        for row in data["settings"]:
            check(row["id"] not in ids)
            ids.add(row["id"])
            descriptors[row["id"]] = row
        cursor = data["next_cursor"]
        if cursor is None:
            break
        check(cursor not in cursors)
        cursors.add(cursor)
        params = {**params, "cursor": cursor}
    else:
        raise Failure("settings_page_limit")
    check(set(SETTING_IDS) <= ids, "native_settings_missing")
    for identifier in SETTING_IDS:
        params = {"op": "get", "runtime": runtime, "id": identifier}
        data = settings.metadata(reader.api, reader.read("player_settings", params)["data"], params)
        check(data["context"] == context, "settings_context_changed")
        check(data["descriptor"] == descriptors[identifier], "settings_descriptor_changed")
    return verdict("observed", "cli_validated_schema_and_get")


def television_probe(api, client, device, timeout, clock=time.monotonic):
    """Run the CLI's existing television status implementation, never launch/go."""
    deadline = clock() + timeout
    module = api.television_module()
    with contextlib.redirect_stdout(io.StringIO()) as output, contextlib.redirect_stderr(io.StringIO()):
        code = module.run(api, client, device, "device", ["status"], timeout, True)
    check(clock() < deadline, "deadline_exceeded")
    result = json.loads(output.getvalue())
    state = result.get("state", {})
    if code == 0 and result.get("outcome") == "confirmed" and state.get("power") == "on" and state.get("app_id") == APP_ID:
        return verdict("observed", "native_app_reported_foreground_by_tv")
    return verdict("not_observed", "tv_did_not_confirm_native_foreground")


def collect(api, settings, workbench, client, device, args, clock=time.monotonic, sleep=time.sleep):
    reader = Reader(api, client, workbench, device, args.timeout, args.budget, clock)
    report = {"version": 1, "read_only": True, "acceptance": "incomplete",
              "physical_display_verified": False, "expected_version": args.expected_version,
              "launch": verdict("not_observed", "tv_status_not_requested")}
    samples = []
    try:
        if args.tv_status:
            try:
                report["launch"] = television_probe(api, client, device, reader.remaining(), clock)
            except Failure as exc:
                report["launch"] = verdict("not_observed", exc.reason)
            except (api.Error, ValueError, TypeError, KeyError):
                report["launch"] = verdict("not_observed", "tv_status_unavailable")
        caps = api.capabilities_metadata(reader.read("capabilities", {})["data"])
        player = caps["player"]
        check(player["platform"] == "webos-native", "wrong_platform")
        check(player["version"] == args.expected_version, "wrong_version")
        report["inspect_advertised"] = "inspect" in caps
        if "player_settings" in caps:
            report["settings"] = settings_probe(reader, settings, player["runtime"])
        else:
            report["settings"] = verdict("failed", "native_settings_not_advertised")
        for _ in range(args.samples):
            if samples:
                check(reader.deadline - clock() > args.interval, "deadline_exceeded")
                sleep(args.interval)
            sample = reader.read("status", {})
            data = sample["data"]
            check(data.get("uuid") == device, "device_mismatch")
            check(isinstance(data.get("player"), dict))
            check(data["player"].get("runtime") == player["runtime"], "runtime_changed")
            samples.append(sample)
        report["checks"] = summarize(samples, args.expected_version)
    except Failure as exc:
        report["error"] = exc.reason
    except (api.Error, ValueError, TypeError, KeyError, OverflowError, RecursionError):
        report["error"] = "invalid_response"
    if "checks" not in report:
        report["checks"] = summarize(samples, args.expected_version)
    report["requests"] = reader.receipts
    failures = {"wrong_platform", "wrong_version", "device_mismatch", "invalid_response",
                "native_settings_missing", "repeated_receipt", "mutation_refused"}
    if (report.get("error") in failures or report.get("settings", {}).get("status") == "failed"
            or any(row.get("status") == "failed" for row in report["checks"].values() if isinstance(row, dict))):
        report["acceptance"] = "failed"
    return report


class Parser(argparse.ArgumentParser):
    def error(self, _message):
        raise Failure("invalid_arguments")


def main(argv=None):
    parser = Parser(description=__doc__)
    parser.add_argument("--player", required=True, help="One configured player alias or device ID")
    parser.add_argument("--expected-version", required=True, help="Exact native application version")
    parser.add_argument("--cli", default=shutil.which("ott"), help="Trusted installed OTT Python CLI")
    parser.add_argument("--config", default=os.environ.get("OTT_CONFIG", str(Path.home() / ".config/ottplay-control/cli.json")))
    parser.add_argument("--samples", type=int, default=3)
    parser.add_argument("--interval", type=float, default=2)
    parser.add_argument("--timeout", type=float, default=10)
    parser.add_argument("--budget", type=float, default=90)
    parser.add_argument("--tv-status", action="store_true", help="Also read television power and foreground app")
    try:
        args = parser.parse_args(argv)
        check(args.cli is not None, "cli_unavailable")
        check(bool(re.fullmatch(r"[A-Za-z0-9_.+\-]{1,64}", args.expected_version)), "invalid_arguments")
        check(bool(args.player) and "," not in args.player, "invalid_arguments")
        check(2 <= args.samples <= 6 and number(args.interval) and 1 <= args.interval <= 10
              and number(args.timeout) and 1 <= args.timeout <= 15
              and number(args.budget) and 5 <= args.budget <= 180, "invalid_arguments")
        api, settings, workbench, hashes = load_cli(args.cli)
        try:
            client = api.Client(api.read_json(args.config), args.timeout)
            device = client.device(args.player)
        except (api.Error, OSError, KeyError, TypeError, ValueError):
            raise Failure("cli_configuration_unavailable") from None
        report = collect(api, settings, workbench, client, device, args)
        report["cli_sha256"] = hashes
    except Failure as exc:
        report = {"version": 1, "acceptance": "failed", "read_only": True, "error": exc.reason,
                  "physical_display_verified": False}
    except (OSError, ImportError, ValueError, TypeError, AttributeError):
        report = {"version": 1, "acceptance": "failed", "read_only": True, "error": "cli_incompatible",
                  "physical_display_verified": False}
    except KeyboardInterrupt:
        print(json.dumps({"version": 1, "acceptance": "incomplete", "error": "interrupted"}))
        return 130
    print(json.dumps(report, indent=2, sort_keys=True, allow_nan=False))
    return 1 if report["acceptance"] == "failed" else 2


if __name__ == "__main__":
    sys.exit(main())
