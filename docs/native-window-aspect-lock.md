# Native window aspect constraint

The main-window constraint requests 16:9 **content dimensions during interactive resizing**. It is independent of video aspect/zoom, topmost state, and the separate PiP window. The preference defaults on for a new instance and is saved in the instance data directory as `window-aspect-lock`; an explicitly saved off value remains off. Window position/size restoration keeps its existing owner.

In Classic and Modern, use **Settings → Interface → Lock window to 16:9** in the Tauri main window. The adjacent **Always on top** action is independent; **Full screen** stays in Menu. These are immediate native actions rather than draft preferences: Save Settings is not required, the Interface page remains open, and Cancel does not undo a confirmed native change. Browser, TV, mobile and PiP players do not expose these main-window actions.

The native commands are `get_window_aspect_lock` and `set_window_aspect_lock({enabled})`. Their confirmed result is `{ok, supported, enabled, active}`. `enabled` is the requested preference; `active` means the native interactive constraint is armed/applicable now, not that current pixels are already 16:9. Fullscreen/maximize suspension retains the requested preference. Unsupported SET and native or persistence failures reject. A successful native mutation followed by a persistence failure is not silently rolled back. Main-only command authorization does not grant control over PiP or another window. The custom `set_fullscreen` and `toggle_fullscreen` commands also require the main window, both in capability permissions and in their native handlers; PiP cannot change the main window's fullscreen restore state.

Windows edits the native `WM_SIZING` proposal, keeping the opposite anchor and respecting real OS-initialized `WM_GETMINMAXINFO` bounds after Tao overrides. DPI/display changes invalidate cached bounds; no valid fresh bounds means ordinary OS handling. Content/frame insets are current physical pixels. Snap remains OS-owned. macOS uses AppKit content aspect constraints and restores prior aspect/increment settings when disabled.

On Linux X11, the window manager uses a native 16:9 geometry hint. Enabling it
may immediately adjust the current window size, including when restoring the
saved or default-on preference at startup. This follows
[GDK's geometry-hint contract](https://docs.gtk.org/gdk3/method.Window.set_geometry_hints.html).
Disabling it removes the aspect constraint without requesting a new window
size. An explicit first disable request does not apply the saved on value first.
The same per-window Tao geometry owner composes current minimum and maximum sizes
and scale changes. Explicit setters update the GTK policy and publish only the
aspect bit and ratio words in the native `WM_NORMAL_HINTS` property, preserving
its other words and flag bits. This bounded path accepts the 15-word and 18-word
32-bit `WM_SIZE_HINTS` layouts and verifies the complete updated property. There
is no JavaScript resize loop or separate geometry owner.

An externally supplied GTK window without Tao's geometry owner is unsupported,
including a window adopted through `new_from_gtk_window` without that state.
The aspect helper does not infer or replace its existing constraints. It returns
the same unsupported result as an unsupported backend; GET does not write the
saved preference, and SET rejects before persistence.

The X11 constraint is suspended for fullscreen, maximized, tiled and nonresizable
windows. Application-owned fullscreen and maximize transitions suspend it before
the native request. If the window manager ignores or coalesces that request
without confirming the state change, the constraint remains inactive until a
matching native transition is observed. `enabled:true, active:false` describes
that state without claiming that resizing is constrained. A successful setter
requires native hint readback; actual behavior still depends on the window manager.
Enabling and pre-transition suspension may flush GTK's composed layout. Disabling
and failed-set rollback leave GTK layout queued and publish aspect hints without
requesting a resize. Rollback restores the prior requested policy and merges the
original aspect bit and ratios into freshly read native hints, preserving newer
non-aspect fields; failure to confirm restoration remains an error. Native state
and property callbacks also retain GTK's queued layout instead of forcing a
resize inside the signal, so fullscreen/maximize restoration can consume the
window manager's restored geometry before applying layout.

Wayland reports `{ok:true, supported:false, enabled:false, active:false}`. SET
rejects with `Native aspect constraint is unavailable on this backend` and does
not write preferences. The saved preference is retained for a supported backend;
the false response fields do not describe or overwrite its stored value. GTK 3's
Wayland fixed-state configure handling needs a separate implementation before
this backend can expose the control.

## Existing Windows smoke gate

The existing `window_controls_smoke` executable and `scripts/check-window-controls.py` exercise production handlers through WebView2 JavaScript IPC. They use only owned main/PiP fixture HWNDs, isolated data directories, the Windows 60-second startup and 30-second exercise/cleanup budgets with a 100-second parent deadline, and PID-scoped cleanup. No installed player, user profile, or network endpoint is used.

The fixture captures native frame and client geometry before initialization and
starts with a non-16:9 client area. It checks default-on state without resizing
that geometry; repeated true/true/false/false SET; unchanged geometry; production
versus missing permissions; denied PiP aspect, topmost and fullscreen commands;
six native fullscreen/restore transitions; and three fresh-process preference
phases, including restoration of explicitly saved off. The post-initialization
capture follows the first getter: it verifies geometry preservation through
startup and readback, rather than proving eager initialization independently of
that getter. The runner requires exact confirmed replies and saved preference
bytes, so incomplete native evidence cannot be reported as a pass.

The sizing probe observes real OS `WM_GETMINMAXINFO` traffic from a bounded owned-window size/restore, then dispatches `WM_SIZING` to the actual subclass for all eight edges. It verifies ratio, current bounds, opposite anchors, and disabled passthrough. This is an **owned-HWND native message probe**, not a human drag gesture or multi-monitor/DPI acceptance. The observer is removed before fixture completion; removal failure fails the probe.

Existing Windows Native Shells steps build the fixture, validate its manifest, run the Python parent, and upload `build/windows-window-controls-report/`. The additional `cargo test --locked -p ottplay-tauri window_aspect::` step executes geometry and IPC-contract unit tests; existing preference tests and the macOS full crate test remain enabled. The same commands can be used by an authorized native acceptance runner:

```text
cargo test --locked -p ottplay-tauri window_aspect::
cargo test --locked -p ottplay-tauri window_preferences::tests
python tests/test_window_controls_smoke.py
cargo build --locked -p ottplay-tauri --example window_controls_smoke
python scripts/check-windows-manifest.py --binary target/debug/examples/window_controls_smoke.exe --output build/windows-window-controls-report/fixture-manifest.json
python scripts/check-window-controls.py
```

The commands above are a gate definition, not an assertion that they ran. Windows real drag edges, maximize/restore, fractional DPI and monitor transfer; macOS native transitions; X11 behavior; and any future Wayland support still need execution evidence. No new workflow or duplicate fixture launcher is added.

## macOS Window menu

**Window → Zoom** uses the same Tauri maximize/unmaximize API as the borderless
main window. It is available only while that window is focused, visible,
resizable, not minimized and outside native/simple fullscreen. It never targets
PiP or another window. Activation rechecks those conditions rather than relying
on the last enabled menu state. The other default macOS menu items are retained.
The action does not change the saved 16:9 preference; the existing constraint
backend suspends it while maximized and rearms it after restore. Simple fullscreen saves its own frame separately from the normal frame saved by Zoom, so entering and leaving fullscreen while maximized preserves the later Zoom restore size.

The native menu route needs its own packaged-app acceptance: activate Zoom
twice, require the captured visible frame and content size on maximize and the
original frame/content size on restore, and repeat with the constraint enabled.
The hosted fixture below exercises native-menu delivery through the production menu builder and event handler. It does not replace a packaged-app or physical pointer acceptance check.

## Hosted macOS constraint smoke

The same window_controls_smoke example and Python checker now have a macOS
branch. Build and run it only in the approved disposable GitHub-hosted macOS job:

```text
cargo build --locked -p ottplay-tauri --example window_controls_smoke
python3 scripts/check-window-controls.py --output build/macos-window-controls-report
```

The existing borderless main/PiP fixture, bundled local page, production IPC
handlers, permission configurations, 30-second child deadline, 40-second parent
deadline, and three fresh preference processes are reused. No installed player,
Finder, Accessibility input, TCC edit, user profile or network origin is involved.

The macOS observer captures the initial native frame, content size, aspect and
resize increments before production preference initialization. It then requires
native AppKit readback for repeated on/on/off/off requests, unchanged initial
geometry, fullscreen/restore via both production commands, Tauri maximize/unmaximize, native Window → Zoom twice, denied
main/PiP commands, restoration of original constraints, and eager saved-state
restoration before the first getter. Native transition observations precede GET,
so a getter's lazy refresh cannot supply missing callback evidence. Geometry is
reported in AppKit points with a two-point tolerance. The parent requires the
complete native report, retained preference bytes and owned-process cleanup.

For the borderless main window, maximize uses Tauri's production API and its
Tao visible-frame geometry, rather than raw `NSWindow.zoom`. The observer checks
the captured target's origin and size before GET, unchanged native state after
GET, and the original frame/content size after unmaximize. Raw `isZoomed` remains
diagnostic data: changing AppKit constraint mode can change that derived value
without changing the frame. Separate raw-zoom crash diagnostics are not evidence
that this production path passed or that raw `NSWindow.zoom` has been repaired.

The two menu transitions use the owned AppKit Window menu's native action and
require exactly one production menu event per activation, enabled item state,
the captured target frame/content size, original geometry after restore and
unchanged snapshots across the aspect getter. They do not call the Zoom handler
directly or synthesize a successful menu event. A separate mixed sequence enters Zoom, enters and exits simple fullscreen, then activates Zoom again. It requires the maximized frame after fullscreen exit and the original frame/content size with the constraint active after the final Zoom. PiP fullscreen denials also retain before/after observations of the main window; a denial cannot hide a change to its native state.

This is constraint and native-transition evidence, not a physical
drag, multi-monitor or pixel acceptance result. The macOS runner uses its own
process session for bounded cleanup; Windows retains the owned-PID tree cleanup
and its existing message-probe assertions. Linux has separate native hint,
geometry, preference and permission checks. A successful macOS or Windows run
does not establish Linux support; X11 evidence does not establish Wayland support.

## Hosted Linux X11 constraint smoke

The existing Linux Native Shells job runs the same fixture in a disposable
GitHub-hosted Xvfb/Openbox session with `GDK_BACKEND=x11`. It retains the
30-second child, 40-second parent and 240-second session deadlines. The job
records the source commit, host, unchanged binary hash and native JSON reports;
no installed player or user display is used.

The gate requires native aspect and current minimum/maximum hint readback,
allowed size normalization when enabling, unconstrained geometry after
disabling, fullscreen and maximize suspension/restore, and live bound changes.
An XTEST input driver drags all eight edges/corners of the owned main window,
both enabled and disabled. Geometry restoration between samples is setup, not
drag evidence. Each sample must change the requested axes, retain the opposite
anchor, respect bounds and have the expected constrained or free aspect.

Pending-resize probes queue a GTK size request and call the native setter in
the same main-thread callback, without processing the event loop between them.
A matched control, OFF, repeated OFF and immediate OFF-to-ON sequence verify
that OFF emits no synchronous `check-resize`, leaves the frame and all unrelated
hint words unchanged, and removes native `PAspect`. Normal event processing must
then apply the queued size, and a later layout must retain the intended aspect
state.

The production run requires all five main-window commands to be denied from
PiP without native state changes; the missing-permission run denies the same
commands from main. Four fresh preference
processes check saved on, saved off, off restoration, and an explicit first
SET(false) against a saved-on preference before startup initialization or GET.
The last case must leave the original unconstrained geometry unchanged. A fifth
process, with a separate preference directory, checks pending resize before the
first native OFF call; it does not replace or pre-initialize the original
first-IPC case. The parent verifies saved bytes and removes its private data and
owned processes.

These assertions describe the acceptance gate, not a completed run of this
revision. Passing Openbox/Xvfb evidence does not establish behavior on every
window manager, fractional scale, multiple monitors or Wayland.
