// Included only by the owned Linux/X11 smoke fixture. No production hooks.
use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use tao::platform::unix::x11::ffi as x11;

#[derive(Clone, Debug, PartialEq, serde::Serialize)]
struct X11Snapshot {
    label: String,
    xid: u64,
    pid: u32,
    rect: [i32; 4],
    hints: i64,
    min_size: [i32; 2],
    max_size: [i32; 2],
    min_aspect: [i32; 2],
    max_aspect: [i32; 2],
    fullscreen: bool,
    maximized: bool,
    above: bool,
    wm_present: bool,
}

// The ABI and dynamic symbols are the same existing x11-dl exports used by Tao.
// All calls stay on the UI thread. The XID is borrowed from a live owned window;
// this query connection owns and closes its display instead of requesting a
// non-owning Tao raw display handle (which opens a fresh connection).
struct X11Connection {
    api: x11::Xlib,
    display: *mut x11::Display,
}
impl X11Connection {
    fn open() -> Result<Self, String> {
        let api = x11::Xlib::open().map_err(|e| e.to_string())?;
        let display = unsafe { (api.XOpenDisplay)(std::ptr::null()) };
        if display.is_null() { return Err("Cannot open fixture X11 display".into()); }
        Ok(Self { api, display })
    }
}
impl Drop for X11Connection {
    fn drop(&mut self) { unsafe { (self.api.XCloseDisplay)(self.display); } }
}
unsafe fn x11_property(
    api: &x11::Xlib, display: *mut x11::Display, window: x11::Window,
    name: &[u8], expected_type: x11::Atom,
) -> Result<Vec<libc::c_ulong>, String> {
    let atom = (api.XInternAtom)(display, name.as_ptr().cast(), 1);
    if atom == 0 { return Ok(Vec::new()); }
    let mut actual_type = 0;
    let mut format = 0;
    let mut count = 0;
    let mut remaining = 0;
    let mut data = std::ptr::null_mut();
    let status = (api.XGetWindowProperty)(display, window, atom, 0, 32, 0,
        expected_type, &mut actual_type, &mut format, &mut count, &mut remaining, &mut data);
    let valid = status == 0 && remaining == 0 && count <= 32
        && (count == 0 || (actual_type == expected_type && format == 32 && !data.is_null()));
    let result = if valid {
        if count == 0 { Ok(Vec::new()) }
        else { Ok(std::slice::from_raw_parts(data.cast::<libc::c_ulong>(), count as usize).to_vec()) }
    } else { Err("Malformed or oversized owned X11 property".into()) };
    if !data.is_null() { (api.XFree)(data.cast()); }
    result
}

fn x11_snapshot_now(window: &tauri::WebviewWindow) -> Result<X11Snapshot, String> {
    if !matches!(window.label(), "main" | "pip") {
        return Err("X11 observation requires an owned fixture window".into());
    }
    let native = window.window_handle().map_err(|e| e.to_string())?;
    let RawWindowHandle::Xlib(native) = native.as_raw() else {
        return Err("This acceptance requires the X11 backend, not Wayland".into());
    };
    let connection = X11Connection::open()?;
    let api = &connection.api;
    let display = connection.display;
    // SAFETY: the XID remains borrowed from the live fixture on its UI thread;
    // the query connection owns this display and output storage uses x11-dl ABI.
    // No foreign window is mutated, and all returns close the connection.
    unsafe {
        (api.XSync)(display, 0);
        let pid = x11_property(api, display, native.window, b"_NET_WM_PID\0", x11::XA_CARDINAL)?;
        if pid.as_slice() != [std::process::id() as libc::c_ulong] {
            return Err("X11 PID does not match this fixture process".into());
        }
        let mut root = 0;
        let (mut x, mut y) = (0, 0);
        let (mut width, mut height, mut border, mut depth) = (0, 0, 0, 0);
        if (api.XGetGeometry)(display, native.window, &mut root, &mut x, &mut y,
            &mut width, &mut height, &mut border, &mut depth) == 0 {
            return Err("Owned X11 geometry unavailable".into());
        }
        let mut child = 0;
        if (api.XTranslateCoordinates)(display, native.window, root, 0, 0, &mut x, &mut y, &mut child) == 0
            || width == 0 || height == 0 || width > i32::MAX as u32 || height > i32::MAX as u32 {
            return Err("Invalid owned X11 client geometry".into());
        }
        let mut hints: x11::XSizeHints = std::mem::zeroed();
        let mut supplied = 0;
        if (api.XGetWMNormalHints)(display, native.window, &mut hints, &mut supplied) == 0 {
            return Err("Owned X11 WM_NORMAL_HINTS unavailable".into());
        }
        let states = x11_property(api, display, native.window, b"_NET_WM_STATE\0", x11::XA_ATOM)?;
        let has = |name: &[u8]| {
            let atom = (api.XInternAtom)(display, name.as_ptr().cast(), 1);
            atom != 0 && states.contains(&atom)
        };
        let manager = x11_property(api, display, root, b"_NET_SUPPORTING_WM_CHECK\0", x11::XA_WINDOW)?;
        Ok(X11Snapshot {
            label: window.label().to_owned(), xid: native.window as u64, pid: pid[0] as u32,
            rect: [x, y, width as i32, height as i32], hints: hints.flags as i64,
            min_size: [hints.min_width, hints.min_height], max_size: [hints.max_width, hints.max_height],
            min_aspect: [hints.min_aspect.x, hints.min_aspect.y],
            max_aspect: [hints.max_aspect.x, hints.max_aspect.y],
            fullscreen: has(b"_NET_WM_STATE_FULLSCREEN\0"),
            maximized: has(b"_NET_WM_STATE_MAXIMIZED_HORZ\0") && has(b"_NET_WM_STATE_MAXIMIZED_VERT\0"),
            above: has(b"_NET_WM_STATE_ABOVE\0"),
            wm_present: manager.len() == 1 && manager[0] != 0,
        })
    }
}

async fn x11_snapshot(window: &tauri::WebviewWindow) -> Result<X11Snapshot, String> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    let target = window.clone();
    window.run_on_main_thread(move || { let _ = sender.send(x11_snapshot_now(&target)); })
        .map_err(|e| e.to_string())?;
    tokio::time::timeout(Duration::from_secs(4), receiver).await
        .map_err(|_| "X11 observation deadline".to_owned())?
        .map_err(|_| "X11 observation channel closed".to_owned())?
}

fn x11_hints_match(value: &X11Snapshot, active: bool) -> bool {
    let mask = (x11::PMinSize | x11::PMaxSize) as i64;
    let ratio = |pair: [i32; 2]| pair[0] > 0 && pair[1] > 0
        && i64::from(pair[0]) * 9 == i64::from(pair[1]) * 16;
    value.wm_present && value.hints & mask == mask
        && value.min_size == [320, 180] && value.max_size == [1600, 1000]
        && ((value.hints & x11::PAspect as i64 != 0) == active)
        && (!active || (ratio(value.min_aspect) && ratio(value.max_aspect)))
}

async fn x11_settled(window: &tauri::WebviewWindow, active: bool,
    fullscreen: bool, maximized: bool, geometry: Option<[i32; 4]>, startup: bool,
) -> Result<X11Snapshot, String> {
    let start = Instant::now();
    let mut previous = None;
    let mut stable = 0;
    loop {
        // Observe actual X11 state before GET; GET must not supply the evidence.
        let value = x11_snapshot(window).await?;
        let position_matches = geometry.map(|rect| value.rect.iter().zip(rect)
            .all(|(a, b)| (i64::from(*a) - i64::from(b)).abs() <= 2)).unwrap_or(true);
        let requested_size = !startup || (value.rect[2] - 640).abs() <= 2 && (value.rect[3] - 400).abs() <= 2;
        if x11_hints_match(&value, active) && value.fullscreen == fullscreen
            && value.maximized == maximized && position_matches && requested_size {
            if previous.as_ref() == Some(&value) { stable += 1; } else { stable = 0; }
            if stable >= 2 { return Ok(value); }
            previous = Some(value.clone());
        } else { stable = 0; previous = None; }
        if start.elapsed() >= Duration::from_secs(4) {
            return Err(format!("X11 native state did not settle: {value:?}"));
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

async fn denied(window: &tauri::WebviewWindow, command: &str, args: Value) -> Result<Value, String> {
    let before = x11_snapshot(window).await?;
    let reply = invoke(window, command, args).await?;
    let error = reply["error"].as_str().unwrap_or("");
    if reply["ok"] != false || !error.contains("not allowed") {
        return Err(format!("Expected ACL rejection for {command}, received {reply}"));
    }
    if x11_snapshot(window).await? != before { return Err(format!("Denied {command} changed X11 state")); }
    Ok(json!({"window": window.label(), "command": command, "error": error}))
}

// Unsupported is a successful capability query, not a successful mutation.
// Never call the shared supported-platform helper or accept an IPC timeout here.
async fn unsupported_state(window: &tauri::WebviewWindow) -> Result<Value, String> {
    let reply = allowed(window, "get_window_aspect_lock", json!({})).await?;
    if reply != json!({"ok": true, "supported": false, "enabled": false, "active": false}) {
        return Err(format!("Wrong unsupported X11 capability: {reply}"));
    }
    Ok(reply)
}

async fn unsupported_set(window: &tauri::WebviewWindow, enabled: bool) -> Result<Value, String> {
    let reply = invoke(window, "set_window_aspect_lock", json!({"enabled": enabled})).await?;
    if reply != json!({"ok": false, "error": "Native aspect constraint is unavailable on this backend"}) {
        return Err(format!("Expected explicit unsupported X11 mutation: {reply}"));
    }
    Ok(reply)
}

async fn exercise(main: tauri::WebviewWindow, missing: bool) -> Result<Value, String> {
    let baseline = x11_settled(&main, false, false, false, None, true).await?;
    let aux = main.app_handle().get_webview_window("pip").ok_or("Auxiliary fixture missing")?;
    let aux_before = x11_settled(&aux, false, false, false, None, true).await?;
    let mut denials = Vec::new();
    if missing {
        for (command, args) in [("set_always_on_top", json!({"alwaysOnTop": true})),
            ("set_fullscreen", json!({"fullscreen": true})), ("toggle_fullscreen", json!({})),
            ("get_window_aspect_lock", json!({})), ("set_window_aspect_lock", json!({"enabled": true}))] {
            denials.push(denied(&main, command, args).await?);
        }
        return Ok(json!({"status": "pass", "platform": "linux-x11", "mode": "missing-permission",
            "denials": denials, "baseline": baseline, "requested_content": [640,400]}));
    }
    for (command, args) in [("set_always_on_top", json!({"alwaysOnTop": true})),
        ("get_window_aspect_lock", json!({})), ("set_window_aspect_lock", json!({"enabled": true}))] {
        denials.push(denied(&aux, command, args).await?);
    }
    let initial_state = unsupported_state(&main).await?;
    let mut sequence = Vec::new();
    for enabled in [true, true, false, false] {
        let rejection = unsupported_set(&main, enabled).await?;
        let native = x11_settled(&main, false, false, false, Some(baseline.rect), false).await?;
        let state = unsupported_state(&main).await?;
        sequence.push(json!({"requested": enabled, "rejection": rejection, "state": state, "native": native}));
    }
    let mut transitions = Vec::new();
    for explicit in [false, true] {
        for target in [true, false] {
            let reply = if explicit { allowed(&main, "set_fullscreen", json!({"fullscreen": target})).await? }
                else { allowed(&main, "toggle_fullscreen", json!({})).await? };
            if reply != json!({"ok": true, "fullscreen": target}) { return Err("Unconfirmed fullscreen transition".into()); }
            let native = x11_settled(&main, false, target, false,
                if target { None } else { Some(baseline.rect) }, false).await?;
            let state = unsupported_state(&main).await?;
            transitions.push(json!({"kind": if explicit { "set_fullscreen" } else { "toggle_fullscreen" },
                "target": target, "native": native, "state": state}));
        }
    }
    for target in [true, false] {
        (if target { main.maximize() } else { main.unmaximize() }).map_err(|e| e.to_string())?;
        let native = x11_settled(&main, false, false, target,
            if target { None } else { Some(baseline.rect) }, false).await?;
        let state = unsupported_state(&main).await?;
        transitions.push(json!({"kind": "maximize", "target": target, "native": native, "state": state}));
    }
    let final_native = x11_settled(&main, false, false, false, Some(baseline.rect), false).await?;
    let final_state = unsupported_state(&main).await?;
    if x11_snapshot(&aux).await? != aux_before { return Err("Main changes altered the auxiliary X11 window".into()); }
    Ok(json!({"status": "pass", "platform": "linux-x11", "mode": "production-permissions",
        "requested_content": [640,400], "baseline": baseline, "initial_state": initial_state,
        "set_sequence": sequence, "transitions": transitions, "final": final_native,
        "final_state": final_state, "denials": denials, "aux_unchanged": true,
        "observation": "unsupported aspect capability; owned X11 geometry and WM_NORMAL_HINTS remain unconstrained"}))
}

async fn exercise_preference(main: tauri::WebviewWindow, phase: PreferencePhase) -> Result<Value, String> {
    // The parent seeds both saved-on and saved-off in its private directory.
    // Production initialize must neither apply them nor alter their bytes.
    let initial = x11_settled(&main, false, false, false, None, true).await?;
    let aux = main.app_handle().get_webview_window("pip").ok_or("Auxiliary fixture missing")?;
    let aux_before = x11_settled(&aux, false, false, false, None, true).await?;
    let initial_state = unsupported_state(&main).await?;
    let rejection = if matches!(phase, PreferencePhase::VerifyOff) { None }
        else { Some(unsupported_set(&main, matches!(phase, PreferencePhase::Pin)).await?) };
    let final_native = x11_settled(&main, false, false, false, Some(initial.rect), false).await?;
    let final_state = unsupported_state(&main).await?;
    if x11_snapshot(&aux).await? != aux_before { return Err("Saved state altered auxiliary X11 window".into()); }
    Ok(json!({"status": "pass", "platform": "linux-x11", "mode": "preference-restoration",
        "phase": phase.name(), "requested_content": [640,400], "initial": initial,
        "initial_state": initial_state, "final": final_native, "final_state": final_state,
        "set_rejection": rejection, "aux_unchanged": true}))
}
