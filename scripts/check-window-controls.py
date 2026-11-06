#!/usr/bin/env python3
"""Run the already-built Windows/macOS/X11 fixture; never launch installed players."""
import argparse
import json
import math
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time


# Only Windows uses the separately budgeted 60s startup plus 30s exercise.
WINDOWS_PROCESS_TIMEOUT_SECONDS = 100


def process_timeout_seconds(platform):
    return WINDOWS_PROCESS_TIMEOUT_SECONDS if platform == "windows" else 40


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def validate_common_evidence(report):
    require(report.get("status") == "pass", f"Native assertion failed: {report.get('error')}")
    require(report.get("owned_labels") == ["main", "pip"], "Wrong fixture window ownership")
    require(report.get("cleanup_errors") == [], "Native window cleanup failed")


def validate_aspect_state(value, enabled, active):
    expected = {"ok": True, "supported": True, "enabled": enabled, "active": active}
    require(isinstance(value, dict) and value.keys() == expected.keys()
            and all(type(value[key]) is bool and value[key] is target for key, target in expected.items()),
            "Wrong native aspect state")


def validate_sizing_probe(probe, enabled):
    require(probe.get("kind") == "owned-hwnd-message-probe" and probe.get("enabled") is enabled,
            "Wrong native sizing probe")
    require(type(probe.get("os_bounds_captures")) is int and probe["os_bounds_captures"] > 0,
            "Missing OS-initialized tracking bounds")
    limits, insets = probe.get("outer_limits"), probe.get("client_insets")
    require(isinstance(limits, list) and len(limits) == 4 and all(type(v) is int for v in limits)
            and 0 < limits[0] <= limits[2] and 0 < limits[1] <= limits[3], "Invalid tracking bounds")
    require(isinstance(insets, list) and len(insets) == 2 and all(type(v) is int and v >= 0 for v in insets),
            "Invalid client insets")
    samples = probe.get("samples", [])
    require(len(samples) == 8 and all(type(s.get("edge")) is int for s in samples)
            and [s.get("edge") for s in samples] == list(range(1, 9)),
            "Incomplete native sizing edges")
    for sample in samples:
        before, after = sample.get("input"), sample.get("output")
        require(all(isinstance(r, list) and len(r) == 4 and all(type(v) is int for v in r)
                    for r in [before, after]), "Malformed sizing rectangle")
        if not enabled:
            require(before == after, "Disabled constraint changed native sizing")
            continue
        width, height = after[2] - after[0], after[3] - after[1]
        require(limits[0] <= width <= limits[2] and limits[1] <= height <= limits[3],
                "Native sizing exceeded OS tracking limits")
        require(width > insets[0] and height > insets[1]
                and abs((width - insets[0]) * 9 - (height - insets[1]) * 16) <= 4,
                "Native sizing did not constrain content to 16:9")
        edge = sample["edge"]
        if edge in [1, 4, 7]:
            require(after[2] == before[2], "Opposite right edge moved")
        if edge in [2, 5, 8]:
            require(after[0] == before[0], "Opposite left edge moved")
        if edge in [3, 4, 5]:
            require(after[3] == before[3], "Opposite bottom edge moved")
        if edge in [6, 7, 8]:
            require(after[1] == before[1], "Opposite top edge moved")


def validate_windows_startup(report):
    snapshots = []
    for name in ["pre_initialize", "post_initialize"]:
        value = report.get(name)
        require(isinstance(value, dict), "Missing pre/post-initialize Windows geometry")
        rect, client = value.get("rect"), value.get("client_size")
        require(isinstance(rect, list) and len(rect) == 4
                and all(type(v) is int for v in rect)
                and rect[2] > rect[0] and rect[3] > rect[1],
                "Invalid startup Windows frame")
        require(isinstance(client, list) and len(client) == 2
                and all(type(v) is int and v > 0 for v in client)
                and client[0] <= rect[2] - rect[0] and client[1] <= rect[3] - rect[1],
                "Invalid startup Windows client size")
        snapshots.append(value)
    before, after = snapshots
    width, height = before["client_size"]
    require(abs(width * 9 - height * 16) > 4,
            "Windows fixture did not start with non-16:9 content")
    require(all(abs(a - b) <= 2 for key in ["rect", "client_size"]
                for a, b in zip(before[key], after[key])),
            "Aspect initialization changed native Windows geometry")


def validate_evidence(report, missing, *, platform="windows"):
    require(platform in {"windows", "macos", "linux"}, "Unsupported native fixture platform")
    if platform in {"macos", "linux"}:
        require(report.get("platform") == ("linux-x11" if platform == "linux" else "macos"), "Wrong native fixture platform")
    validate_common_evidence(report)
    denials = report.get("denials", [])
    expected = {"set_always_on_top", "set_fullscreen", "toggle_fullscreen",
                "get_window_aspect_lock", "set_window_aspect_lock"}
    require(len(denials) == len(expected), "Missing ACL denial evidence")
    require({entry.get("command") for entry in denials} == expected, "Wrong denied commands")
    require(all(entry.get("window") == ("main" if missing else "pip")
                and "not allowed" in entry.get("error", "") for entry in denials), "Not an ACL denial")
    require(report.get("mode") == ("missing-permission" if missing else "production-permissions"), "Wrong ACL mode")
    if missing:
        if platform == "linux":
            validate_x11_snapshot(report.get("baseline"), report.get("baseline"), active=True, startup=True)
        return
    if platform == "linux":
        return validate_x11_evidence(report)
    if platform == "macos":
        return validate_appkit_evidence(report)
    validate_windows_startup(report)
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

    aspect = report.get("aspect", {})
    validate_aspect_state(aspect.get("initial"), True, True)
    validate_aspect_state(aspect.get("final"), False, False)
    sequence = aspect.get("set_sequence", [])
    require(len(sequence) == 4, "Incomplete aspect idempotence sequence")
    for value, enabled in zip(sequence, [True, True, False, False]):
        validate_aspect_state(value, enabled, enabled)
    geometry = aspect.get("set_geometry", [])
    baseline = report.get("initial", {}).get("rect")
    require(isinstance(baseline, list) and len(baseline) == 4
            and all(type(v) is int for v in baseline), "Missing initial native geometry")
    require(len(geometry) == 4, "Incomplete aspect geometry sequence")
    for item in geometry:
        rect = item.get("rect")
        require(isinstance(rect, list) and len(rect) == 4 and all(type(v) is int for v in rect)
                and all(abs(a - b) <= 2 for a, b in zip(rect, baseline)),
                "Aspect toggle changed native geometry")
    full = aspect.get("fullscreen_sequence", [])
    require(len(full) == 6, "Incomplete aspect fullscreen sequence")
    for value, active in zip(full, [False, True, False, True, False, True]):
        validate_aspect_state(value, True, active)
    validate_sizing_probe(aspect.get("sizing_enabled", {}), True)
    validate_sizing_probe(aspect.get("sizing_disabled", {}), False)


def validate_restoration_evidence(report, phase, *, platform="windows"):
    if platform == "linux":
        return validate_x11_restoration(report, phase)
    if platform == "macos":
        return validate_appkit_restoration(report, phase)
    validate_common_evidence(report)
    validate_windows_startup(report)
    require(report.get("mode") == "preference-restoration" and report.get("phase") == phase,
            "Wrong preference restoration phase")
    require(report.get("aux_unchanged") is True, "Auxiliary window changed")
    for name, expected in [("initial", phase == "unpin"), ("final", phase == "pin")]:
        state = report.get(name, {})
        require(state.get("topmost") is expected and state.get("win32_topmost") is expected
                and state.get("fullscreen") is False, f"Wrong restored {name} native state")

    validate_aspect_state(report.get("aspect_initial"), phase != "verify-off", phase != "verify-off")
    validate_aspect_state(report.get("aspect_final"), phase == "pin", phase == "pin")
    validate_sizing_probe(report.get("aspect_sizing", {}), phase == "pin")


def validate_appkit_snapshot(value, baseline, *, active, simple_fullscreen=False,
                             zoomed=False, original_geometry=True, target_frame=None):
    require(isinstance(value, dict) and value.get("label") == "main",
            "Missing owned AppKit main-window observation")
    require(type(value.get("window_number")) is int
            and value["window_number"] == baseline.get("window_number"),
            "AppKit observation changed native window identity")
    require(type(value.get("level")) is int, "Missing AppKit window level")
    for key, size in [("frame", 4), ("screen_frame", 4), ("content_size", 2), ("content_aspect", 2),
                      ("resize_increments", 2)]:
        items = value.get(key)
        require(isinstance(items, list) and len(items) == size
                and all(type(v) in (int, float) and math.isfinite(v) for v in items),
                f"Invalid AppKit {key}")
    require(all(v > 0 for v in value["frame"][2:] + value["screen_frame"][2:] + value["content_size"]),
            "Empty AppKit geometry")
    for key in ["fullscreen", "zoomed", "miniaturized", "movable"]:
        require(type(value.get(key)) is bool, f"Invalid AppKit {key}")
    require(value["fullscreen"] is False and value["miniaturized"] is False
            and (zoomed is None or value["zoomed"] is zoomed),
            "Wrong native AppKit window state")
    for key in ["style_mask", "presentation_options"]:
        require(type(value.get(key)) is int and value[key] >= 0, f"Invalid AppKit {key}")
    require(not value["style_mask"] & (1 << 14), "Unexpected AppKit Spaces fullscreen")
    if simple_fullscreen:
        # Tao removes Titled, Miniaturizable and Resizable; hides Dock/menu bar.
        require(value["style_mask"] == baseline["style_mask"] & ~(1 | 4 | 8)
                and value["presentation_options"] == (1 | 4) and value["movable"] is False,
                "Missing native simple-fullscreen style or presentation")
        require(all(abs(a - b) <= 2 for a, b in zip(value["frame"], value["screen_frame"]))
                and all(abs(a - b) <= 2 for a, b in zip(value["content_size"], value["screen_frame"][2:])),
                "Simple fullscreen did not fill the native screen")
    else:
        require(value["style_mask"] == baseline["style_mask"]
                and value["presentation_options"] == baseline["presentation_options"]
                and value["movable"] is baseline["movable"],
                "Original AppKit style or presentation was not restored")
    require(value["content_aspect"] == ([16, 9] if active else baseline["content_aspect"]),
            "Native AppKit aspect readback disagrees")
    if not active:
        require(value["resize_increments"] == baseline["resize_increments"],
                "Original AppKit resize increments were not restored")
    if target_frame is not None:
        require(isinstance(target_frame, list) and len(target_frame) == 4
                and all(type(v) in (int, float) and math.isfinite(v) for v in target_frame)
                and all(v > 0 for v in target_frame[2:]), "Invalid AppKit maximize target")
        require(all(abs(a - b) <= 2 for a, b in zip(value["frame"], target_frame)),
                "AppKit maximize did not reach the captured visible frame")
        require(all(abs(a - b) <= 2 for a, b in zip(value["content_size"], target_frame[2:])),
                "AppKit maximized content did not fill the borderless frame")
    if original_geometry:
        require(value["level"] == baseline["level"], "AppKit window level changed")
        require(all(abs(a - b) <= 2 for key in ["frame", "content_size"]
                    for a, b in zip(value[key], baseline[key])),
                "AppKit aspect operation changed original geometry")


def validate_appkit_baseline(report):
    baseline = report.get("baseline")
    require(isinstance(baseline, dict), "Missing pre-initialize AppKit baseline")
    validate_appkit_snapshot(baseline, baseline, active=False)
    require(baseline["content_aspect"] != [16, 9],
            "AppKit fixture already constrained before initialization")
    width, height = baseline["content_size"]
    require(abs(width * 9 - height * 16) > 4, "AppKit fixture did not start off-ratio")
    return baseline


def validate_appkit_evidence(report):
    baseline = validate_appkit_baseline(report)
    require(report.get("aux_unchanged") is True, "Auxiliary AppKit window changed")
    validate_aspect_state(report.get("initial_state"), True, True)
    validate_appkit_snapshot(report.get("initial"), baseline, active=True)
    denials = report.get("denials", [])
    expected_denials = {"set_always_on_top", "set_fullscreen", "toggle_fullscreen",
                        "get_window_aspect_lock", "set_window_aspect_lock"}
    require(len(denials) == len(expected_denials)
            and all(isinstance(item, dict) for item in denials)
            and {item.get("command") for item in denials} == expected_denials,
            "Incomplete AppKit PiP denials")
    for item in denials:
        require(item.get("window") == "pip" and "not allowed" in item.get("error", ""),
                "Missing AppKit PiP ACL rejection")
        for key in ["main_before", "main_after", "main_after_get"]:
            validate_appkit_snapshot(item.get(key), baseline, active=True)
            require(item[key] == report["initial"],
                    "Denied PiP command or getter changed the main AppKit window")
        for key in ["main_state_before", "main_state_after"]:
            validate_aspect_state(item.get(key), True, True)
    sequence = report.get("set_sequence", [])
    require(len(sequence) == 4, "Incomplete AppKit idempotence sequence")
    for item, enabled in zip(sequence, [True, True, False, False]):
        validate_aspect_state(item.get("state"), enabled, enabled)
        validate_appkit_snapshot(item.get("native"), baseline, active=enabled)
    transitions = report.get("transitions", [])
    expected = [(kind, target) for kind in ["toggle_fullscreen", "set_fullscreen", "maximize"]
                for target in [True, False]]
    require(len(transitions) == len(expected), "Incomplete AppKit native transitions")
    for item, (kind, target) in zip(transitions, expected):
        require(item.get("kind") == kind and item.get("target") is target,
                "Wrong AppKit transition order")
        validate_aspect_state(item.get("state"), True, not target)
        if kind == "maximize":
            require(item.get("target_visible_frame") is not None,
                    "Missing AppKit maximize target")
            require(item.get("target_visible_frame") == transitions[4].get("target_visible_frame"),
                    "AppKit maximize target changed between transitions")
        validate_appkit_snapshot(item.get("native"), baseline, active=not target,
                                 simple_fullscreen=target if kind != "maximize" else False,
                                 zoomed=(None if target else False) if kind != "maximize" else None,
                                 original_geometry=not target,
                                 target_frame=item.get("target_visible_frame") if kind == "maximize" and target else None)
        if kind == "maximize":
            require(item.get("native_after_get") == item.get("native"),
                    "Aspect getter changed settled AppKit maximize state")
    menu_transitions = report.get("menu_transitions", [])
    require(report.get("native_menu_activations") == 4 and len(menu_transitions) == 2,
            "Incomplete native Window menu activations")
    for index, (item, target) in enumerate(zip(menu_transitions, [True, False]), 1):
        require(item.get("kind") == "native_menu_zoom" and item.get("menu_id") == "ott.window.zoom"
                and item.get("target") is target and type(item.get("event_count")) is int
                and item.get("event_count") == index,
                "Wrong native Window menu event or transition order")
        target_frame = item.get("target_visible_frame")
        require(target_frame is not None
                and target_frame == menu_transitions[0].get("target_visible_frame"),
                "Missing or changed native Window menu target")
        validate_aspect_state(item.get("state"), True, not target)
        validate_appkit_snapshot(item.get("native"), baseline, active=not target,
                                 zoomed=None, original_geometry=not target,
                                 target_frame=target_frame if target else None)
        require(item.get("native_after_get") == item.get("native"),
                "Aspect getter changed settled native Window menu state")
    mixed = report.get("mixed_transitions", [])
    expected_mixed = [("native_menu_zoom", True), ("set_fullscreen", True),
                      ("set_fullscreen", False), ("native_menu_zoom", False)]
    require(len(mixed) == len(expected_mixed), "Incomplete mixed AppKit transitions")
    for index, (item, (kind, target)) in enumerate(zip(mixed, expected_mixed)):
        restored = index == 3
        require(item.get("kind") == kind and item.get("target") is target
                and item.get("menu_id") == ("ott.window.zoom" if kind == "native_menu_zoom" else None)
                and type(item.get("event_count")) is int
                and item["event_count"] == (4 if restored else 3),
                "Wrong mixed AppKit transition or native menu event")
        target_frame = item.get("target_visible_frame")
        require(target_frame == menu_transitions[0].get("target_visible_frame"),
                "Mixed AppKit native menu target changed")
        validate_aspect_state(item.get("state"), True, restored)
        validate_appkit_snapshot(item.get("native"), baseline, active=restored,
                                 simple_fullscreen=index == 1, zoomed=False if restored else None,
                                 original_geometry=restored,
                                 target_frame=target_frame if index in [0, 2] else None)
        require(item.get("native_after_get") == item.get("native"),
                "Aspect getter changed mixed AppKit native state")
    validate_aspect_state(report.get("final_state"), False, False)
    validate_appkit_snapshot(report.get("final"), baseline, active=False)


def validate_appkit_restoration(report, phase):
    require(report.get("platform") == "macos", "Wrong native fixture platform")
    validate_common_evidence(report)
    require(report.get("mode") == "preference-restoration" and report.get("phase") == phase,
            "Wrong AppKit preference phase")
    require(report.get("aux_unchanged") is True, "Auxiliary AppKit window changed")
    baseline = validate_appkit_baseline(report)
    for name, enabled in [("initial", phase != "verify-off"), ("final", phase == "pin")]:
        validate_aspect_state(report.get(name + "_state"), enabled, enabled)
        validate_appkit_snapshot(report.get(name), baseline, active=enabled)


def validate_x11_snapshot(value, baseline, *, active, fullscreen=False,
                          maximized=False, original_geometry=True, startup=False,
                          min_size=(320, 180), max_size=(1600, 1000)):
    require(isinstance(value, dict) and isinstance(baseline, dict), "Missing X11 native observation")
    require(value.get("label") == "main" and all(type(value.get(k)) is int and value[k] > 0
            for k in ("xid", "pid")) and value["xid"] == baseline.get("xid")
            and value["pid"] == baseline.get("pid"), "X11 window ownership changed")
    require(value.get("wm_present") is True and value.get("above") is False
            and value.get("fullscreen") is fullscreen and value.get("maximized") is maximized,
            "Wrong native X11 window state or missing WM")
    for key, length in (("rect", 4), ("min_size", 2), ("max_size", 2), ("min_aspect", 2), ("max_aspect", 2)):
        require(isinstance(value.get(key), list) and len(value[key]) == length
                and all(type(x) is int for x in value[key]), "Malformed X11 " + key)
    width, height = value["rect"][2:]
    require(width > 0 and height > 0, "Empty X11 client geometry")
    hints = value.get("hints")
    require(type(hints) is int and hints >= 0 and hints & 48 == 48
            and value["min_size"] == list(min_size) and value["max_size"] == list(max_size),
            "X11 min/max hints were lost")
    if not fullscreen and not maximized:
        require(min_size[0] <= width <= max_size[0] and min_size[1] <= height <= max_size[1],
                "X11 geometry exceeded native bounds")
    require(bool(hints & 128) is active, "X11 native aspect hint disagrees")
    if active:
        require(all(pair[0] > 0 and pair[1] > 0 and pair[0] * 9 == pair[1] * 16
                    for pair in (value["min_aspect"], value["max_aspect"])), "X11 ratio is not 16:9")
        # One native integer-pixel rounding step; not a broad layout tolerance.
        require(abs(width * 9 - height * 16) <= 16, "X11 content is not constrained to 16:9")
    if original_geometry:
        require(isinstance(baseline.get("rect"), list) and len(baseline["rect"]) == 4
                and all(type(x) is int for x in baseline["rect"])
                and all(abs(a - b) <= 2 for a, b in zip(value["rect"], baseline["rect"])),
                "X11 operation changed the expected restored geometry")
    if startup and not active:
        require(all(abs(a - b) <= 2 for a, b in zip(value["rect"][2:], [640, 400])),
                "X11 disabled startup changed requested content size")


def validate_unsupported_aspect_state(value):
    expected = {"ok": True, "supported": False, "enabled": False, "active": False}
    require(isinstance(value, dict) and value.keys() == expected.keys()
            and all(type(value[key]) is bool and value[key] is target for key, target in expected.items()),
            "Wrong unsupported aspect capability")


def validate_unsupported_aspect_rejection(value):
    require(isinstance(value, dict) and value.keys() == {"ok", "error"}
            and value["ok"] is False
            and value["error"] == "Native aspect constraint is unavailable on this backend",
            "Missing explicit unsupported aspect mutation rejection")


def validate_x11_drag_probe(probe, enabled, baseline):
    require(isinstance(probe, dict) and probe.get("kind") == "owned-x11-xtest-edge-drag"
            and probe.get("enabled") is enabled, "Wrong X11 native drag probe")
    samples = probe.get("samples", [])
    require(len(samples) == 8 and all(type(x.get("edge")) is int for x in samples)
            and [x["edge"] for x in samples] == list(range(1, 9)), "Incomplete X11 drag edges")
    for sample in samples:
        before, after = sample.get("before"), sample.get("after")
        validate_x11_snapshot(before, baseline, active=enabled)
        validate_x11_snapshot(after, baseline, active=enabled, original_geometry=False)
        start, end = sample.get("input_start"), sample.get("input_end")
        require(all(isinstance(v, list) and len(v) == 2 and all(type(x) is int for x in v)
                    for v in (start, end)) and start != end, "Missing X11 pointer movement")
        left, top, width, height = before["rect"]
        point_x, point_y = start
        require(left <= point_x <= left + width and top <= point_y <= top + height,
                "X11 drag did not start on the owned window")
        edge = sample["edge"]
        if edge in (1, 4, 7):
            require(point_x - left <= 5, "X11 left drag started at the wrong edge")
        if edge in (2, 5, 8):
            require(left + width - point_x <= 5, "X11 right drag started at the wrong edge")
        if edge in (3, 4, 5):
            require(point_y - top <= 5, "X11 top drag started at the wrong edge")
        if edge in (6, 7, 8):
            require(top + height - point_y <= 5, "X11 bottom drag started at the wrong edge")
        old, new = before["rect"], after["rect"]
        require(old[2:] != new[2:], "X11 native drag did not change size")
        horizontal = edge in (1, 2, 4, 5, 7, 8)
        vertical = edge in (3, 4, 5, 6, 7, 8)
        require((not horizontal or new[2] < old[2] - 2)
                and (not vertical or new[3] < old[3] - 2),
                "X11 inward drag did not resize the selected axis")
        if not enabled:
            require(abs(new[2] * 9 - new[3] * 16) > 16,
                    "Disabled X11 drag retained the aspect constraint")
            require((not horizontal or vertical or abs(new[3] - old[3]) <= 2)
                    and (not vertical or horizontal or abs(new[2] - old[2]) <= 2),
                    "Disabled X11 single-edge drag changed the other axis")
        if edge in (1, 4, 7):
            require(abs(new[0] + new[2] - old[0] - old[2]) <= 2, "X11 opposite right edge moved")
        if edge in (2, 5, 8):
            require(abs(new[0] - old[0]) <= 2, "X11 opposite left edge moved")
        if edge in (3, 4, 5):
            require(abs(new[1] + new[3] - old[1] - old[3]) <= 2, "X11 opposite bottom edge moved")
        if edge in (6, 7, 8):
            require(abs(new[1] - old[1]) <= 2, "X11 opposite top edge moved")


def validate_x11_pending_resize(row, kind, baseline):
    require(isinstance(row, dict) and row.get("kind") == kind, "Missing pending GTK resize probe")
    initially_on = kind in ("control", "warm-off", "rapid-off-on")
    final_on = kind in ("control", "rapid-off-on")
    before, queued, immediate = (row.get(key) for key in ("before", "queued", "immediate"))
    validate_x11_snapshot(before, baseline, active=initially_on)
    require(row.get("request") == [800, 450] and before["rect"][2:] != [800, 450],
            "Pending resize must request a different real size")
    require(queued == before, "Resize must still be pending before OFF")
    require(type(row.get("queued_callbacks")) is int and row["queued_callbacks"] == 0
            and type(row.get("during_off_callbacks")) is int and row["during_off_callbacks"] == 0,
            "OFF must not synchronously emit GTK check-resize")
    validate_x11_snapshot(immediate, before, active=kind == "control")
    require(immediate["rect"] == before["rect"], "OFF changed the immediate native frame")
    hints = before.get("non_aspect_hints")
    require(isinstance(hints, list) and len(hints) in (11, 14)
            and all(type(value) is int and 0 <= value <= 0xffffffff for value in hints)
            and hints[0] & 1023 == before["hints"] & ~128 & 1023
            and immediate.get("non_aspect_hints") == hints
            and immediate["hints"] & ~128 & 1023 == hints[0] & 1023,
            "OFF changed non-aspect native hints")
    off_state = row.get("off_state")
    require(off_state is None if kind == "control" else
            isinstance(off_state, list) and len(off_state) == 2 and all(value is False for value in off_state),
            "OFF did not return confirmed disabled native state")
    if kind == "rapid-off-on":
        validate_x11_snapshot(row.get("after_on"), before, active=True, original_geometry=False)
    else:
        require(row.get("after_on") is None, "Unexpected ON in OFF/control probe")
    settled = row.get("settled")
    validate_x11_snapshot(settled, before, active=final_on, original_geometry=False)
    require(settled["rect"] == before["rect"][:2] + [800, 450],
            "Normal event loop did not apply the pending user resize")
    target = [960, 540] if final_on else [800, 500]
    require(row.get("layout_request") == target, "Missing later layout request")
    later = row.get("after_layout")
    validate_x11_snapshot(later, before, active=final_on, original_geometry=False)
    require(later["rect"] == before["rect"][:2] + target,
            "Later layout lost/restored the wrong native aspect hint")


def validate_x11_evidence(report):
    require(report.get("requested_content") == [640, 400], "Wrong X11 setup geometry")
    startup = report.get("baseline")
    validate_x11_snapshot(startup, startup, active=True, startup=True)
    validate_aspect_state(report.get("initial_state"), True, True)
    require(report.get("aux_unchanged") is True, "Auxiliary X11 window changed")
    manual = report.get("manual_enable", {})
    before, after = manual.get("before"), manual.get("after")
    validate_x11_snapshot(before, startup, active=False, startup=True, original_geometry=False)
    validate_x11_snapshot(after, startup, active=True, original_geometry=False)
    require(before["rect"][2:] != after["rect"][2:], "Manual enable did not normalize off-ratio content")
    validate_aspect_state(manual.get("state"), True, True)
    baseline = startup
    sequence = report.get("set_sequence", [])
    require(len(sequence) == 4, "Incomplete X11 on/off sequence")
    for row, enabled in zip(sequence, [True, True, False, False]):
        require(row.get("requested") is enabled, "Wrong X11 mutation request")
        validate_aspect_state(row.get("state"), enabled, enabled)
        validate_x11_snapshot(row.get("native"), baseline, active=enabled)
    transitions = report.get("transitions", [])
    expected = [(kind, target) for kind in ("toggle_fullscreen", "set_fullscreen", "maximize")
                for target in (True, False)]
    require(len(transitions) == len(expected), "Incomplete X11 transition sequence")
    for row, (kind, target) in zip(transitions, expected):
        require(row.get("kind") == kind and row.get("target") is target, "Wrong X11 transition")
        validate_aspect_state(row.get("state"), True, not target)
        validate_x11_snapshot(row.get("native"), baseline, active=not target,
                              fullscreen=kind != "maximize" and target,
                              maximized=kind == "maximize" and target, original_geometry=not target)
    updates = report.get("bounds_updates", [])
    require(len(updates) == 2, "Missing X11 live min/max updates")
    validate_x11_snapshot(updates[0], baseline, active=True, min_size=(400, 225), max_size=(1280, 720))
    validate_x11_snapshot(updates[1], baseline, active=True)
    validate_x11_drag_probe(report.get("sizing_enabled"), True, baseline)
    validate_x11_drag_probe(report.get("sizing_disabled"), False, baseline)
    pending = report.get("pending_resizes")
    require(isinstance(pending, list) and len(pending) == 4, "All pending GTK resize probes are required")
    for row, kind in zip(pending, ("control", "warm-off", "repeat-off", "rapid-off-on")):
        validate_x11_pending_resize(row, kind, baseline)
    require(pending[0]["before"] == pending[1]["before"],
            "Control and OFF must start with identical native state and queued request")
    validate_aspect_state(report.get("final_state"), False, False)
    validate_x11_snapshot(report.get("final"), baseline, active=False)


def validate_x11_restoration(report, phase):
    require(report.get("platform") == "linux-x11", "Wrong X11 restoration platform")
    validate_common_evidence(report)
    require(report.get("mode") == "preference-restoration" and report.get("phase") == phase,
            "Wrong X11 preference phase")
    if phase == "cold-pending-off":
        initial = report.get("initial")
        validate_x11_snapshot(initial, initial, active=False, startup=True)
        require(report.get("requested_content") == [640, 400] and report.get("aux_unchanged") is True
                and report.get("initial_state") is None and report.get("startup_initialization_skipped") is True
                and report.get("first_native_aspect_call") == "OFF"
                and report.get("first_command") == "set_window_aspect_lock", "Cold pending OFF was not isolated")
        validate_x11_pending_resize(report.get("pending_resize"), "cold-off", initial)
        validate_aspect_state(report.get("first_set"), False, False)
        validate_aspect_state(report.get("final_state"), False, False)
        final = report.get("final")
        validate_x11_snapshot(final, initial, active=False, original_geometry=False)
        require(final["rect"] == initial["rect"][:2] + [800, 500], "Cold pending OFF geometry was lost")
        return
    require(report.get("requested_content") == [640, 400] and report.get("aux_unchanged") is True,
            "Wrong X11 requested geometry or changed PiP")
    initial = report.get("initial")
    enabled = phase in ("pin", "unpin")
    validate_x11_snapshot(initial, initial, active=enabled, startup=True)
    if phase == "cold-off":
        require(report.get("first_command") == "set_window_aspect_lock"
                and report.get("startup_initialization_skipped") is True,
                "Cold OFF did not precede initialization and GET")
        require(report.get("initial_state") is None, "Cold OFF queried before its mutation")
        validate_aspect_state(report.get("first_set"), False, False)
    else:
        validate_aspect_state(report.get("initial_state"), enabled, enabled)
    final_enabled = phase == "pin"
    if phase == "verify-off":
        require(report.get("first_set") is None, "Saved OFF verification unexpectedly mutated state")
    else:
        validate_aspect_state(report.get("first_set"), final_enabled, final_enabled)
    validate_aspect_state(report.get("final_state"), final_enabled, final_enabled)
    validate_x11_snapshot(report.get("final"), initial, active=final_enabled)


def stop_owned_process(process, *, platform="windows"):
    """PID comes only from this runner's Popen. Never terminate by image name."""
    if process.poll() is not None:
        return
    if platform in {"macos", "linux"}:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait(timeout=5)
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


def run_case(binary, output, missing, *, phase=None, preferences=None, platform="windows"):
    require(phase in {None, "pin", "unpin", "verify-off", "cold-off", "cold-pending-off"}
            and (phase not in {"cold-off", "cold-pending-off"} or platform == "linux"), "Unknown preference phase")
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
        if phase in {"cold-off", "cold-pending-off"}:
            # These isolated cases skip fixture startup initialization. Neither
            # first explicit OFF may activate the saved ON.
            aspect_stored = preferences / "window-aspect-lock"
            require(not aspect_stored.is_symlink(), "Invalid fixture preference seed path")
            aspect_stored.write_bytes(b"1\n")
            result["seeded_aspect_preference"] = True
        with (output / f"{name}.log").open("w", encoding="utf-8") as log:
            platform_options = {"start_new_session": True} if platform in {"macos", "linux"} else {}
            process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, env=environment, **platform_options)
            result["pid"] = process.pid
            try:
                result["exit_code"] = process.wait(timeout=process_timeout_seconds(platform))
            finally:
                stop_owned_process(process, platform=platform)
        native = directory / "result.json"
        require(native.is_file(), "Native fixture produced no evidence")
        result["native"] = json.loads(native.read_text(encoding="utf-8"))
        require(result["exit_code"] == 0, f"Fixture exited {result['exit_code']}")
        if phase:
            validate_restoration_evidence(result["native"], phase, platform=platform)
            if platform == "windows":
                stored = preferences / "window-always-on-top"
                require(stored.is_file() and not stored.is_symlink(), "Preference file is missing or invalid")
                with stored.open("rb") as stream:
                    require(stream.read(3) == (b"1\n" if phase == "pin" else b"0\n"),
                            "Confirmed preference bytes were not retained")
            aspect_stored = preferences / "window-aspect-lock"
            require(aspect_stored.is_file() and not aspect_stored.is_symlink(), "Aspect preference file is missing or invalid")
            expected_aspect = phase == "pin"
            with aspect_stored.open("rb") as stream:
                require(stream.read(3) == (b"1\n" if expected_aspect else b"0\n"),
                        "Confirmed aspect preference bytes were not retained")
            if platform == "windows":
                result["saved_preference"] = phase == "pin"
            result["saved_aspect_preference"] = expected_aspect
        else:
            validate_evidence(result["native"], missing, platform=platform)
            if platform == "linux":
                aspect_stored = directory / "preferences" / "window-aspect-lock"
                if missing:
                    require(not aspect_stored.exists() and not aspect_stored.is_symlink(),
                            "Denied aspect operation created a saved preference")
                else:
                    require(aspect_stored.is_file() and not aspect_stored.is_symlink()
                            and aspect_stored.read_bytes() == b"0\n",
                            "Final explicit OFF was not persisted")
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
                stop_owned_process(process, platform=platform)
            watchdog = directory / "watchdog.json"
            if watchdog.is_file():
                result["status"] = "fail"
                result["error"] = "Native watchdog terminated the fixture"
                try:
                    result["watchdog"] = json.loads(watchdog.read_text(encoding="utf-8"))
                except (OSError, ValueError) as error:
                    result["watchdog_error"] = str(error)
            remove_private_data(directory)
            result["private_data_removed"] = True
        except Exception as error:
            result["status"] = "fail"
            result["cleanup_error"] = str(error)
        (output / f"{name}.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result


def run_restoration_sequence(binary, output, *, platform="windows"):
    preferences = Path(tempfile.mkdtemp(prefix="ott-window-preferences-"))
    summary = {"status": "fail", "runs": []}
    try:
        phases = ["pin", "unpin", "verify-off"] + (["cold-off"] if platform == "linux" else [])
        for phase in phases:
            result = run_case(binary, output, False, phase=phase, preferences=preferences,
                              **({"platform": platform} if platform != "windows" else {}))
            summary["runs"].append(result)
            require(result["status"] == "pass", f"Preference phase failed: {phase}")
        if platform == "linux":
            # Fresh process AND a distinct owned directory: do not change the
            # original cold-off first-IPC or sequential persistence contract.
            cold_preferences = preferences / "cold-pending-off"
            cold_preferences.mkdir()
            result = run_case(binary, output, False, phase="cold-pending-off",
                              preferences=cold_preferences, platform=platform)
            summary["runs"].append(result)
            require(result["status"] == "pass", "Cold pending OFF phase failed")
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
    platform = "macos" if sys.platform == "darwin" else ("linux" if sys.platform == "linux" else "windows")
    require(sys.platform in {"darwin", "linux"} or os.name == "nt", "Native window fixture requires Windows, macOS or Linux")
    if platform == "linux":
        require(os.environ.get("GDK_BACKEND") == "x11" and os.environ.get("DISPLAY"), "X11 acceptance requires explicit GDK_BACKEND=x11 and DISPLAY")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, default=Path("target/debug/examples/window_controls_smoke" + (".exe" if platform == "windows" else "")))
    parser.add_argument("--output", type=Path, default=Path("build/" + platform + "-window-controls-report"))
    args = parser.parse_args()
    binary = args.binary.resolve()
    require(binary.is_file(), "Build window_controls_smoke before running the fixture")
    args.output.mkdir(parents=True, exist_ok=True)
    reports = [run_case(binary, args.output, missing, platform=platform) for missing in [True, False]]
    restoration = run_restoration_sequence(binary, args.output, platform=platform)
    passed = all(item["status"] == "pass" for item in reports) and restoration["status"] == "pass"
    summary = {"status": "pass" if passed else "fail", "runs": reports, "restoration": restoration}
    (args.output / "result.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0 if summary["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
