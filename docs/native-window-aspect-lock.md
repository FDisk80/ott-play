# Native window aspect constraint

The optional main-window constraint requests 16:9 **content dimensions during interactive resizing**. It is independent of video aspect/zoom, topmost state, and the separate PiP window. The preference defaults off and is saved in the instance data directory as `window-aspect-lock`; window position/size restoration keeps its existing owner.

In Classic and Modern, use **Settings → Interface → Lock window to 16:9** in the Tauri main window. The adjacent **Always on top** action is independent; **Full screen** stays in Menu. These are immediate native actions rather than draft preferences: Save Settings is not required, the Interface page remains open, and Cancel does not undo a confirmed native change. Browser, TV, mobile and PiP players do not expose these main-window actions.

The native commands are `get_window_aspect_lock` and `set_window_aspect_lock({enabled})`. Their confirmed result is `{ok, supported, enabled, active}`. `enabled` is the requested preference; `active` means the native interactive constraint is armed/applicable now, not that current pixels are already 16:9. Fullscreen/maximize suspension retains the requested preference. Unsupported SET and native or persistence failures reject. A successful native mutation followed by a persistence failure is not silently rolled back. Main-only command authorization does not grant control over PiP or another window.

Windows edits the native `WM_SIZING` proposal, keeping the opposite anchor and respecting real OS-initialized `WM_GETMINMAXINFO` bounds after Tao overrides. DPI/display changes invalidate cached bounds; no valid fresh bounds means ordinary OS handling. Content/frame insets are current physical pixels. Snap remains OS-owned. macOS uses AppKit content aspect constraints and restores prior aspect/increment settings when disabled.

Linux X11 and Wayland report `{ok:true, supported:false, enabled:false, active:false}`. SET rejects with `Native aspect constraint is unavailable on this backend` and does not write preferences. Startup may read an existing preference, but does not apply hints or change the restored geometry. The saved preference is retained for a supported backend; the false response fields do not describe or overwrite its stored value.

The no-initial-resize requirement is intentional. In hosted run [42078664064](https://github.com/open-ott-play/ottplay-foss/actions/runs/42078664064), the X11 fixture on GTK 3.24.41 / Openbox 3.6.1 observed its 640×400 client area become 640×360 after the first successful enable request. The exact tested source was merge `a28258b3079ee1008ee0f88a709413bf47703a80`. Both production-permission and preference-pin cases failed the unchanged-geometry assertion; the aspect hint itself was the correct 16:9 ratio.

This is consistent with [GDK's geometry-hint contract](https://docs.gtk.org/gdk3/method.Window.set_geometry_hints.html), which also permits constraining the current size. Replacing the GTK setter with a direct GDK hint does not establish interactive-only behavior. The existing Tao resize entry points delegate to the window manager, without a qualified per-proposal constraint and completion boundary. Linux support requires a separately verified native path that preserves current/restored geometry, including on enable and fixed-state transitions. Resizing back after a snap or accepting the snapped initial size would not satisfy this contract.

## Existing Windows smoke gate

The existing `window_controls_smoke` executable and `scripts/check-window-controls.py` exercise production handlers through WebView2 JavaScript IPC. They use only owned main/PiP fixture HWNDs, isolated data directories, the Windows 60-second startup and 30-second exercise/cleanup budgets with a 100-second parent deadline, and PID-scoped cleanup. No installed player, user profile, or network endpoint is used.

The fixture starts with non-16:9 geometry and checks default-off state; repeated true/true/false/false SET; unchanged geometry; production versus missing permissions; denied PiP GET/SET; six native fullscreen/restore transitions; and three fresh-process preference phases. The runner requires exact confirmed replies and saved preference bytes, so incomplete native evidence cannot be reported as a pass.

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
backend suspends it while maximized and rearms it after restore.

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
directly or synthesize a successful menu event.

This is constraint and native-transition evidence, not a physical
drag, multi-monitor or pixel acceptance result. The macOS runner uses its own
process session for bounded cleanup; Windows retains the owned-PID tree cleanup
and its existing message-probe assertions. The Linux branch of this same fixture checks the unsupported capability,
unchanged native client geometry and existing size hints, permission and PiP
isolation, and preservation of a pre-existing saved preference. It does not claim
interactive aspect-lock support. A successful macOS run does not establish Linux
support.
