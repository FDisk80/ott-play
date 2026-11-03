"""Host-only acceptance checks; no CLI installation, network or device is used."""

import contextlib
import copy
import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "webos_native_cli_smoke", ROOT / "scripts/smoke-webos-native-cli.py"
)
smoke = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(smoke)

DEVICE = "dev-fixture"
SECRET = "private-source-must-not-appear"


def status(position=20):
    return {
        "uuid": DEVICE,
        "player": {
            "platform": "webos-native", "version": "0.2.0",
            "runtime": "runtime-a", "standby": False,
        },
        "playback": {
            "state": "playing", "kind": "vod", "provider": "offline",
            "media_id": "media-a", "position": position, "duration": 300,
        },
    }


def samples():
    return [
        {"data": status(20 + 2 * i), "started_seconds": 2 * i,
         "completed_seconds": 2 * i + 0.05}
        for i in range(3)
    ]


class Clock:
    def __init__(self):
        self.now = 100.0

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


class CliError(Exception):
    pass


class FakeSettings:
    def __init__(self):
        self.validated = []

    def metadata(self, api, data, params):
        self.validated.append(copy.deepcopy(params))
        return data


class FakeClient:
    def __init__(self, clock):
        self.clock = clock
        self.timeout = 10
        self.calls = []
        self.status_count = 0
        self.change = lambda data, index: data
        self.repeat_receipt = False
        self.error = None
        self.context = "synthetic-context"
        self.descriptors = [{"id": key} for key in smoke.SETTING_IDS]

    def device(self, alias):
        return DEVICE

    def call_receipt(self, device, action, params):
        self.calls.append((device, action, copy.deepcopy(params)))
        self.clock.advance(0.05)
        if self.error:
            raise self.error
        if action == "capabilities":
            data = {"player": status()["player"], "player_settings": {"version": 1}}
        elif action == "status":
            data = self.change(status(20 + self.status_count * 2), self.status_count)
            self.status_count += 1
        elif action == "player_settings" and params.get("op") == "schema":
            data = {"context": self.context, "settings": self.descriptors, "next_cursor": None}
        elif action == "player_settings" and params.get("op") == "get":
            data = {"context": self.context, "descriptor": {"id": params["id"]}, "value": 1}
        else:
            raise AssertionError("Unexpected command in read-only observation")
        number = 1 if self.repeat_receipt else len(self.calls)
        return {"status": "ok", "request_id": f"{number:032x}", "data": data}


class Harness:
    def __init__(self):
        self.clock = Clock()
        self.client = FakeClient(self.clock)
        self.settings = FakeSettings()
        self.capabilities = []

        def capabilities_metadata(data):
            self.capabilities.append(copy.deepcopy(data))
            return data

        self.api = SimpleNamespace(
            Error=CliError, capabilities_metadata=capabilities_metadata,
            Client=lambda config, timeout: self.client, read_json=lambda path: {},
        )
        self.workbench = SimpleNamespace(
            Workbench=lambda *args: SimpleNamespace(reason=lambda exc: str(exc))
        )
        self.args = SimpleNamespace(
            timeout=10, budget=90, expected_version="0.2.0",
            tv_status=False, samples=3, interval=2,
        )

    def collect(self):
        return smoke.collect(
            self.api, self.settings, self.workbench, self.client, DEVICE, self.args,
            clock=self.clock, sleep=self.clock.advance,
        )


class NativeStatusAcceptance(unittest.TestCase):
    def assert_unobserved_display(self, report):
        for key in ("renderer", "decoder", "physical_display"):
            self.assertEqual(report[key]["status"], "not_observed", key)

    def test_healthy_media_clock_does_not_claim_decoding_or_display(self):
        report = smoke.summarize(samples(), "0.2.0")
        self.assertEqual(report["identity"]["status"], "observed")
        self.assertEqual(report["control"]["status"], "observed")
        self.assertEqual(report["position"]["reason"], "reported_media_clock_advanced")
        self.assertEqual(report["position"]["delta_seconds"], 4)
        self.assert_unobserved_display(report)

    def test_no_samples_or_one_sample_cannot_establish_progress(self):
        for data in ([], samples()[:1]):
            with self.subTest(count=len(data)):
                report = smoke.summarize(data, "0.2.0")
                self.assertEqual(report["position"]["status"], "not_observed")
                self.assert_unobserved_display(report)

    def test_wrong_platform_version_or_runtime_fails_identity(self):
        cases = (("platform", "tauri", "wrong_platform"),
                 ("version", "0.1.0", "wrong_version"),
                 ("runtime", "runtime-b", "runtime_changed"))
        for field, value, reason in cases:
            with self.subTest(field=field):
                data = samples()
                data[1]["data"]["player"][field] = value
                report = smoke.summarize(data, "0.2.0")
                self.assertEqual(report["identity"], {"status": "failed", "reason": reason})
                self.assertNotEqual(report["position"]["status"], "observed")

    def test_missing_or_changed_media_cannot_establish_progress(self):
        for value in (None, "", "media-b"):
            with self.subTest(value=value):
                data = samples()
                data[1]["data"]["playback"]["media_id"] = value
                report = smoke.summarize(data, "0.2.0")
                self.assertEqual(report["position"]["status"], "not_observed")

    def test_same_media_id_from_different_provider_is_not_continuous(self):
        data = samples()
        data[1]["data"]["playback"]["provider"] = "plex"
        report = smoke.summarize(data, "0.2.0")
        self.assertEqual(report["position"]["status"], "not_observed")

    def test_missing_source_fields_cannot_establish_progress(self):
        for field in ("provider", "kind"):
            for missing in (True, False):
                with self.subTest(field=field, missing=missing):
                    data = samples()
                    for row in data:
                        if missing:
                            row["data"]["playback"].pop(field)
                        else:
                            row["data"]["playback"][field] = None
                    report = smoke.summarize(data, "0.2.0")
                    self.assertEqual(report["position"]["status"], "not_observed")

    def test_invalid_source_field_types_fail_identity_validation(self):
        for field in ("provider", "kind"):
            for value in ([], {}, True, 7):
                with self.subTest(field=field, value=value):
                    data = samples()
                    for row in data:
                        row["data"]["playback"][field] = value
                    report = smoke.summarize(data, "0.2.0")
                    self.assertEqual(report["identity"],
                                     {"status": "failed", "reason": "invalid_response"})
                    self.assertNotEqual(report["position"]["status"], "observed")

    def test_paused_standby_and_error_override_advancing_position(self):
        for phase in ("paused", "standby", "loading", "error"):
            with self.subTest(phase=phase):
                data = samples()
                data[1]["data"]["playback"]["state"] = phase
                report = smoke.summarize(data, "0.2.0")
                self.assertEqual(report["position"]["status"],
                                 "failed" if phase == "error" else "not_observed")
        data = samples()
        data[1]["data"]["player"]["standby"] = True
        self.assertEqual(smoke.summarize(data, "0.2.0")["position"]["status"], "not_observed")

    def test_frozen_reset_and_seek_jump_are_not_progress(self):
        for positions in ([20, 20, 20], [20, 0, 2], [20, 200, 202]):
            with self.subTest(positions=positions):
                data = samples()
                for row, position in zip(data, positions):
                    row["data"]["playback"]["position"] = position
                self.assertEqual(smoke.summarize(data, "0.2.0")["position"]["status"], "not_observed")

    def test_nonfinite_boolean_and_negative_positions_are_not_progress(self):
        for position in (float("nan"), float("inf"), -1, True, "22", 10 ** 1000):
            with self.subTest(position=position):
                data = samples()
                data[1]["data"]["playback"]["position"] = position
                report = smoke.summarize(data, "0.2.0")
                self.assertEqual(report["position"]["status"], "not_observed")
                json.dumps(report, allow_nan=False)

    def test_invalid_and_overlapping_sample_times_fail_closed(self):
        for field, value in (("started_seconds", float("nan")),
                             ("completed_seconds", float("inf")),
                             ("completed_seconds", 1), ("started_seconds", -1),
                             ("started_seconds", 0), ("started_seconds", True)):
            with self.subTest(field=field, value=value):
                data = samples()
                data[1][field] = value
                report = smoke.summarize(data, "0.2.0")
                self.assertEqual(report["identity"]["status"], "failed")
                self.assertNotEqual(report["position"]["status"], "observed")

    def test_remote_identity_titles_and_extra_fields_never_leave_projection(self):
        data = samples()
        for row in data:
            row["data"]["playback"].update(
                media_id=SECRET, title=SECRET, url="https://secret.invalid/" + SECRET,
            )
            row["data"]["extra"] = {"token": SECRET, "decoder_frames": 10000}
        report = smoke.summarize(data, "0.2.0")
        self.assertNotIn(SECRET, json.dumps(report))
        self.assert_unobserved_display(report)


class NativeReadOnlyCollection(unittest.TestCase):
    def test_healthy_collection_uses_cli_validators_and_remains_incomplete(self):
        h = Harness()
        report = h.collect()
        self.assertEqual(report["acceptance"], "incomplete")
        self.assertFalse(report["physical_display_verified"])
        self.assertEqual(report["settings"]["status"], "observed")
        self.assertEqual(report["checks"]["position"]["status"], "observed")
        self.assertEqual(len(h.capabilities), 1)
        self.assertEqual(len(h.settings.validated), 4)
        self.assertEqual([action for _, action, _ in h.client.calls],
                         ["capabilities"] + ["player_settings"] * 4 + ["status"] * 3)
        self.assertTrue(all(device == DEVICE for device, _, _ in h.client.calls))
        for _, action, params in h.client.calls:
            self.assertTrue(action in ("capabilities", "status") or params["op"] in ("schema", "get"))

    def test_read_fence_refuses_mutations_before_calling_transport(self):
        h = Harness()
        reader = smoke.Reader(h.api, h.client, h.workbench, DEVICE, 10, 90, h.clock)
        for action, params in (("wake", {}), ("restart_stream", {}), ("play", {}),
                               ("status", {"unexpected": True}),
                               ("player_settings", {"op": "set", "id": "uiFontScale", "value": 1}),
                               ("player_settings", {"op": "get", "runtime": "runtime-a", "id": "secret"})):
            with self.subTest(action=action, params=params):
                with self.assertRaises(smoke.Failure) as caught:
                    reader.read(action, params)
                self.assertEqual(caught.exception.reason, "mutation_refused")
        self.assertEqual(h.client.calls, [])

    def test_duplicate_receipt_cannot_stand_in_for_another_read(self):
        h = Harness()
        h.client.repeat_receipt = True
        report = h.collect()
        self.assertEqual(report["acceptance"], "failed")
        self.assertEqual(report["error"], "repeated_receipt")

    def test_invalid_receipt_never_becomes_control_evidence(self):
        for field, value in (("request_id", SECRET), ("request_id", None),
                             ("status", "pending"), ("data", [SECRET])):
            with self.subTest(field=field, value=value):
                h = Harness()
                original = h.client.call_receipt
                def corrupt(device, action, params):
                    receipt = original(device, action, params)
                    receipt[field] = value
                    return receipt
                h.client.call_receipt = corrupt
                report = h.collect()
                self.assertEqual(report["acceptance"], "failed")
                self.assertEqual(report["checks"]["control"]["status"], "not_observed")
                self.assertNotIn(SECRET, json.dumps(report))

    def test_wrong_device_and_runtime_cannot_supply_progress(self):
        for mutation, reason in ((lambda data: data.update(uuid="wrong-device"), "device_mismatch"),
                                 (lambda data: data["player"].update(runtime="runtime-b"), "runtime_changed")):
            with self.subTest(reason=reason):
                h = Harness()
                def change(data, index):
                    if index == 1:
                        mutation(data)
                    return data
                h.client.change = change
                report = h.collect()
                self.assertEqual(report["error"], reason)
                self.assertNotEqual(report["checks"]["position"]["status"], "observed")

    def test_report_does_not_serialize_remote_titles_or_raw_error_text(self):
        h = Harness()
        def change(data, index):
            data["playback"].update(media_id=SECRET, title=SECRET)
            data["credentials"] = {"token": SECRET}
            return data
        h.client.change = change
        self.assertNotIn(SECRET, json.dumps(h.collect(), allow_nan=False))
        h = Harness()
        h.client.error = CliError(SECRET)
        report = h.collect()
        self.assertEqual(report["error"], "unavailable")
        self.assertNotIn(SECRET, json.dumps(report))

    def test_deadline_ends_observation_without_retrying_or_waking(self):
        h = Harness()
        h.args.budget = 1
        report = h.collect()
        self.assertEqual(report["error"], "deadline_exceeded")
        self.assertEqual(report["acceptance"], "incomplete")
        self.assertEqual(h.client.status_count, 1)
        self.assertAlmostEqual(h.clock.now, 100.3)

    def test_late_tv_reply_cannot_establish_foreground_observation(self):
        h = Harness()
        def delayed_status(*args):
            h.clock.advance(11)
            print(json.dumps({"outcome": "confirmed", "state": {
                "power": "on", "app_id": smoke.APP_ID,
            }}))
            return 0
        h.api.television_module = lambda: SimpleNamespace(run=delayed_status)
        with self.assertRaises(smoke.Failure) as caught:
            smoke.television_probe(h.api, h.client, DEVICE, 10, clock=h.clock)
        self.assertEqual(caught.exception.reason, "deadline_exceeded")
        self.assertEqual(h.client.calls, [])

    def test_tv_deadline_exhausting_budget_prevents_further_requests(self):
        h = Harness()
        h.args.tv_status = True
        h.args.budget = 5
        def delayed_status(*args):
            h.clock.advance(6)
            print(json.dumps({"outcome": "confirmed", "state": {
                "power": "on", "app_id": smoke.APP_ID,
            }}))
            return 0
        h.api.television_module = lambda: SimpleNamespace(run=delayed_status)
        report = h.collect()
        self.assertEqual(report["launch"],
                         {"status": "not_observed", "reason": "deadline_exceeded"})
        self.assertEqual(report["error"], "deadline_exceeded")
        self.assertEqual(report["acceptance"], "incomplete")
        self.assertEqual(report["checks"]["control"]["status"], "not_observed")
        self.assertEqual(h.client.calls, [])

    def test_settings_pagination_is_bounded(self):
        h = Harness()
        original = h.client.call_receipt
        pages = []
        def page_forever(device, action, params):
            receipt = original(device, action, params)
            if action == "player_settings" and params["op"] == "schema":
                pages.append(params)
                receipt["data"].update(settings=[], next_cursor=f"page-{len(pages)}")
            return receipt
        h.client.call_receipt = page_forever
        report = h.collect()
        self.assertEqual(report["error"], "settings_page_limit")
        self.assertEqual(len(pages), 8)
        self.assertEqual(h.client.status_count, 0)

    def test_settings_context_change_is_not_accepted(self):
        h = Harness()
        original = h.client.call_receipt
        def changed_context(device, action, params):
            receipt = original(device, action, params)
            if action == "player_settings" and params["op"] == "get":
                receipt["data"]["context"] = "new-context"
            return receipt
        h.client.call_receipt = changed_context
        report = h.collect()
        self.assertEqual(report["error"], "settings_context_changed")
        self.assertNotEqual(report.get("settings", {}).get("status"), "observed")

    def test_malformed_remote_status_becomes_failure_not_exception(self):
        for field, value in (("player", "bad-player"), ("state", []), ("state", {})):
            with self.subTest(field=field):
                h = Harness()
                def change(data, index):
                    if field == "player":
                        data["player"] = value
                    else:
                        data["playback"][field] = value
                    return data
                h.client.change = change
                report = h.collect()
                self.assertEqual(report["acceptance"], "failed")
                self.assertNotEqual(report["checks"]["position"]["status"], "observed")

    def test_main_returns_two_for_healthy_partial_evidence(self):
        h = Harness()
        report = h.collect()
        output = io.StringIO()
        with patch.object(smoke, "load_cli", return_value=(h.api, h.settings, h.workbench, {})), \
                patch.object(smoke, "collect", return_value=report), \
                contextlib.redirect_stdout(output):
            code = smoke.main(["--player", "fixture", "--expected-version", "0.2.0", "--cli", "fixture"])
        self.assertEqual(code, 2)
        emitted = json.loads(output.getvalue())
        self.assertEqual(emitted["acceptance"], "incomplete")
        self.assertEqual(emitted["checks"]["decoder"]["status"], "not_observed")

    def test_invalid_cli_bounds_fail_before_loading_cli_or_contacting_device(self):
        for option, value in (("--samples", "1000000"), ("--interval", "nan"),
                              ("--timeout", "inf"), ("--budget", "0")):
            with self.subTest(option=option):
                output = io.StringIO()
                with patch.object(smoke, "load_cli") as load, contextlib.redirect_stdout(output):
                    code = smoke.main(["--player", "fixture", "--expected-version", "0.2.0",
                                       "--cli", "fixture", option, value])
                self.assertEqual(code, 1)
                load.assert_not_called()
                self.assertEqual(json.loads(output.getvalue())["error"], "invalid_arguments")


if __name__ == "__main__":
    unittest.main()
