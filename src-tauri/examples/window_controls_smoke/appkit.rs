// Included only on macOS by the existing window-controls fixture.
// Native snapshots use AppKit points and constraints, not video geometry or
// an assertion that a physical interactive drag occurred.
use objc2::{rc::Retained, MainThreadMarker};
use objc2_app_kit::{NSApp, NSApplicationPresentationOptions, NSScreen, NSWindow, NSWindowStyleMask};

#[derive(Clone, Debug, PartialEq, serde::Serialize)]
struct AppKitSnapshot {
    label: String,
    window_number: isize,
    level: isize,
    frame: [f64; 4],
    screen_frame: [f64; 4],
    style_mask: usize,
    presentation_options: usize,
    movable: bool,
    content_size: [f64; 2],
    content_aspect: [f64; 2],
    resize_increments: [f64; 2],
    fullscreen: bool,
    zoomed: bool,
    miniaturized: bool,
}

struct AppKitBaseline(AppKitSnapshot);

fn appkit_native(window: &tauri::WebviewWindow) -> Result<Retained<NSWindow>, String> {
    MainThreadMarker::new().ok_or("AppKit observation requires the main thread")?;
    if !matches!(window.label(), "main" | "pip") {
        return Err("AppKit observation requires an owned fixture window".into());
    }
    let pointer = window.ns_window().map_err(|e| e.to_string())?;
    // The pointer comes only from this live fixture WebviewWindow. Retain it
    // through the synchronous observation; never discover windows by title.
    unsafe { Retained::retain(pointer as *mut NSWindow) }
        .ok_or_else(|| "Owned AppKit window unavailable".into())
}

fn appkit_snapshot_now(window: &tauri::WebviewWindow) -> Result<AppKitSnapshot, String> {
    let mtm = MainThreadMarker::new().ok_or("AppKit observation requires the main thread")?;
    let native = appkit_native(window)?;
    let frame = native.frame();
    let screen = native.screen().ok_or("Owned AppKit window has no screen")?;
    let screen_frame = screen.frame();
    let content = native.contentRectForFrameRect(frame);
    let aspect = native.contentAspectRatio();
    let increments = native.contentResizeIncrements();
    Ok(AppKitSnapshot {
        label: window.label().to_owned(),
        window_number: native.windowNumber(),
        level: native.level(),
        frame: [frame.origin.x, frame.origin.y, frame.size.width, frame.size.height],
        screen_frame: [screen_frame.origin.x, screen_frame.origin.y, screen_frame.size.width, screen_frame.size.height],
        style_mask: native.styleMask().bits(),
        presentation_options: NSApp(mtm).presentationOptions().bits(),
        movable: native.isMovable(),
        content_size: [content.size.width, content.size.height],
        content_aspect: [aspect.width, aspect.height],
        resize_increments: [increments.width, increments.height],
        fullscreen: native.styleMask().contains(NSWindowStyleMask::FullScreen),
        zoomed: native.isZoomed(),
        miniaturized: native.isMiniaturized(),
    })
}

fn appkit_prepare(app: &mut tauri::App) -> Result<(), String> {
    let main = app.get_webview_window("main").ok_or("Owned main missing")?;
    // Capture before production initialize can install the saved constraint.
    app.manage(AppKitBaseline(appkit_snapshot_now(&main)?));
    Ok(())
}

async fn appkit_snapshot(window: &tauri::WebviewWindow) -> Result<AppKitSnapshot, String> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    let target = window.clone();
    window.run_on_main_thread(move || {
        let _ = sender.send(appkit_snapshot_now(&target));
    }).map_err(|e| e.to_string())?;
    tokio::time::timeout(Duration::from_secs(4), receiver).await
        .map_err(|_| "AppKit observation deadline".to_owned())?
        .map_err(|_| "AppKit observation channel closed".to_owned())?
}

fn appkit_geometry_equal(actual: &AppKitSnapshot, expected: &AppKitSnapshot) -> bool {
    actual.frame.iter().zip(expected.frame).all(|(a, b)| (a - b).abs() <= 2.0)
        && actual.content_size.iter().zip(expected.content_size).all(|(a, b)| (a - b).abs() <= 2.0)
}

// Production uses Tao simple fullscreen, not the Spaces FullScreen style bit.
// Observe the native effects independently of the command acknowledgement.
fn appkit_native_mode_matches(
    value: &AppKitSnapshot,
    baseline: &AppKitSnapshot,
    simple_fullscreen: bool,
) -> bool {
    if value.fullscreen {
        return false;
    }
    if simple_fullscreen {
        let removed = NSWindowStyleMask::Titled
            | NSWindowStyleMask::Miniaturizable | NSWindowStyleMask::Resizable;
        let presentation = NSApplicationPresentationOptions::AutoHideDock
            | NSApplicationPresentationOptions::AutoHideMenuBar;
        value.style_mask == (baseline.style_mask & !removed.bits())
            && value.presentation_options == presentation.bits()
            && !value.movable
            && value.frame.iter().zip(value.screen_frame).all(|(a, b)| (a - b).abs() <= 2.0)
            && value.content_size.iter().zip(value.screen_frame[2..].iter())
                .all(|(a, b)| (a - b).abs() <= 2.0)
    } else {
        value.style_mask == baseline.style_mask
            && value.presentation_options == baseline.presentation_options
            && value.movable == baseline.movable
    }
}

async fn appkit_settled(
    window: &tauri::WebviewWindow,
    baseline: &AppKitSnapshot,
    active: bool,
    simple_fullscreen: bool,
    zoomed: Option<bool>,
    original_geometry: bool,
    target_frame: Option<[f64; 4]>,
) -> Result<AppKitSnapshot, String> {
    let start = Instant::now();
    let mut previous: Option<AppKitSnapshot> = None;
    loop {
        // Do not issue GET here: its lazy refresh must not mask a missing native
        // state callback. Observe the native constraint before confirming IPC.
        let value = appkit_snapshot(window).await?;
        let expected_aspect = if active { [16.0, 9.0] } else { baseline.content_aspect };
        let restored_increments = active || value.resize_increments == baseline.resize_increments;
        if value.content_aspect == expected_aspect && restored_increments
            && appkit_native_mode_matches(&value, baseline, simple_fullscreen)
            && !value.miniaturized
            && zoomed.map(|expected| value.zoomed == expected).unwrap_or(true)
            && (!original_geometry || appkit_geometry_equal(&value, baseline))
            && target_frame.map(|frame| {
                value.frame.iter().zip(frame).all(|(actual, expected)| (actual - expected).abs() <= 2.0)
                    && value.content_size.iter().zip(frame[2..].iter())
                        .all(|(actual, expected)| (actual - expected).abs() <= 2.0)
            }).unwrap_or(true)
        {
            if previous.as_ref() == Some(&value) {
                return Ok(value);
            }
            previous = Some(value.clone());
        } else {
            previous = None;
        }
        if start.elapsed() >= Duration::from_secs(4) {
            return Err(format!("AppKit native state did not settle (simple_fullscreen={simple_fullscreen}, active={active}, zoomed={zoomed:?}, original_geometry={original_geometry}, target_frame={target_frame:?}): {value:?}"));
        }
        tokio::time::sleep(Duration::from_millis(25)).await;
    }
}

async fn appkit_maximize_target(window: &tauri::WebviewWindow) -> Result<[f64; 4], String> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    window.run_on_main_thread(move || {
        let result = MainThreadMarker::new().ok_or("AppKit target requires main thread".to_owned())
            .and_then(|mtm| NSScreen::mainScreen(mtm).ok_or("AppKit main screen unavailable".to_owned()))
            .map(|screen| {
                // Independent observation of the target used by Tao set_maximized_async.
                let frame = screen.visibleFrame();
                [frame.origin.x, frame.origin.y, frame.size.width, frame.size.height]
            });
        let _ = sender.send(result);
    }).map_err(|e| e.to_string())?;
    tokio::time::timeout(Duration::from_secs(4), receiver).await
        .map_err(|_| "AppKit target deadline".to_owned())?
        .map_err(|_| "AppKit target channel closed".to_owned())?
}

async fn denied(
    window: &tauri::WebviewWindow,
    command: &str,
    args: Value,
) -> Result<Value, String> {
    let before = appkit_snapshot(window).await?;
    let reply = invoke(window, command, args).await?;
    let error = reply["error"].as_str().unwrap_or("");
    if reply["ok"] != false || !error.contains("not allowed") {
        return Err(format!("Expected ACL rejection for {command}, received {reply}"));
    }
    if appkit_snapshot(window).await? != before {
        return Err(format!("Denied {command} changed native state"));
    }
    Ok(json!({"window": window.label(), "command": command, "error": error}))
}

async fn appkit_activate_zoom(window: &tauri::WebviewWindow) -> Result<(), String> {
    window.set_focus().map_err(|e| e.to_string())?;
    let deadline = Instant::now() + Duration::from_secs(4);
    loop {
        let menu_ready = window.app_handle().menu()
            .and_then(|menu| menu.get(tauri::menu::WINDOW_SUBMENU_ID))
            .and_then(|item| item.as_submenu().and_then(|menu| menu.get("ott.window.zoom")))
            .and_then(|item| item.as_menuitem().and_then(|item| item.is_enabled().ok()))
            == Some(true);
        if window.is_focused().map_err(|e| e.to_string())? && menu_ready {
            break;
        }
        if Instant::now() >= deadline {
            return Err("Native Window Zoom did not become available for the focused main window".into());
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    let (sender, receiver) = tokio::sync::oneshot::channel();
    let target = window.clone();
    window.run_on_main_thread(move || {
        let result = (|| {
            let mtm = MainThreadMarker::new().ok_or("Menu activation requires the main thread")?;
            let native = appkit_native(&target)?;
            if !native.isKeyWindow() || !native.isMainWindow() {
                return Err("Owned main window lost native focus before menu activation".to_owned());
            }
            let menu = NSApp(mtm).windowsMenu().ok_or("Native Window menu is missing")?;
            if menu.numberOfItems() < 2 {
                return Err("Native Window menu is incomplete".to_owned());
            }
            let item = menu.itemAtIndex(1).ok_or("Native Window Zoom is missing")?;
            if item.title().to_string() != "Zoom" || !item.isEnabled() {
                return Err("Native Window Zoom is not the expected enabled item".to_owned());
            }
            // Exercise Muda's real AppKit action -> Tauri MenuEvent -> production
            // handler. Never invoke the Rust Zoom handler or send MenuEvent here.
            menu.performActionForItemAtIndex(1);
            Ok(())
        })();
        let _ = sender.send(result);
    }).map_err(|e| e.to_string())?;
    tokio::time::timeout(Duration::from_secs(4), receiver).await
        .map_err(|_| "Native Window Zoom activation deadline".to_owned())?
        .map_err(|_| "Native Window Zoom activation channel closed".to_owned())?
}

async fn exercise(main: tauri::WebviewWindow, missing: bool) -> Result<Value, String> {
    let aux = main.app_handle().get_webview_window("pip").ok_or("Auxiliary fixture missing")?;
    let baseline = main.state::<AppKitBaseline>().0.clone();
    let aux_before = appkit_snapshot(&aux).await?;
    let mut denials = Vec::new();
    if missing {
        for (command, args) in [
            ("set_always_on_top", json!({"alwaysOnTop": true})),
            ("set_fullscreen", json!({"fullscreen": true})),
            ("toggle_fullscreen", json!({})),
            ("get_window_aspect_lock", json!({})),
            ("set_window_aspect_lock", json!({"enabled": true})),
        ] {
            denials.push(denied(&main, command, args).await?);
        }
        return Ok(json!({"status": "pass", "platform": "macos", "mode": "missing-permission",
            "denials": denials, "baseline": baseline}));
    }
    for (command, args) in [
        ("set_always_on_top", json!({"alwaysOnTop": true})),
        ("get_window_aspect_lock", json!({})),
        ("set_window_aspect_lock", json!({"enabled": true})),
    ] {
        denials.push(denied(&aux, command, args).await?);
    }
    let initial = appkit_settled(&main, &baseline, false, false, Some(false), true, None).await?;
    if (initial.content_size[0] * 9.0 - initial.content_size[1] * 16.0).abs() <= 4.0 {
        return Err("AppKit fixture must start with non-16:9 content".into());
    }
    let initial_state = aspect_state(&main, false, false).await?;
    let mut sequence = Vec::new();
    for enabled in [true, true, false, false] {
        let state = aspect(&main, Some(enabled), enabled).await?;
        let native = appkit_settled(&main, &baseline, enabled, false, Some(false), true, None).await?;
        sequence.push(json!({"state": state, "native": native}));
    }
    aspect(&main, Some(true), true).await?;
    let mut transitions = Vec::new();
    // Exercise production toggle and explicit set paths, with native observation
    // before GET. This does not claim a physical mouse drag or multiple displays.
    for explicit in [false, true] {
        for target in [true, false] {
            let reply = if explicit {
                allowed(&main, "set_fullscreen", json!({"fullscreen": target})).await?
            } else {
                allowed(&main, "toggle_fullscreen", json!({})).await?
            };
            if reply != json!({"ok": true, "fullscreen": target}) {
                return Err(format!("Unconfirmed fullscreen transition: {reply}"));
            }
            let native = appkit_settled(&main, &baseline, !target, target,
                if target { None } else { Some(false) }, !target, None).await?;
            let state = aspect_state(&main, true, !target).await?;
            transitions.push(json!({"kind": if explicit { "set_fullscreen" } else { "toggle_fullscreen" },
                "target": target, "native": native, "state": state}));
        }
    }
    let target_visible_frame = appkit_maximize_target(&main).await?;
    for target in [true, false] {
        // Use the production API used by Tauri's drag-region maximize handler.
        let request = if target { main.maximize() } else { main.unmaximize() };
        request.map_err(|e| e.to_string())?;
        let native = appkit_settled(&main, &baseline, !target, false, None, !target,
            if target { Some(target_visible_frame) } else { None }).await?;
        let state = aspect_state(&main, true, !target).await?;
        let native_after_get = appkit_snapshot(&main).await?;
        if native_after_get != native {
            return Err("Aspect getter changed settled AppKit maximize state".into());
        }
        transitions.push(json!({"kind": "maximize", "target": target, "native": native,
            "state": state, "target_visible_frame": target_visible_frame, "native_after_get": native_after_get}));
    }
    let menu_target = appkit_maximize_target(&main).await?;
    let mut menu_transitions = Vec::new();
    for (index, target) in [true, false].into_iter().enumerate() {
        appkit_activate_zoom(&main).await?;
        let native = appkit_settled(&main, &baseline, !target, false, None, !target,
            if target { Some(menu_target) } else { None }).await?;
        let event_count = MENU_ZOOM_EVENTS.load(Ordering::SeqCst);
        if event_count != index + 1 {
            return Err(format!("Expected one native Zoom event per activation, got {event_count}"));
        }
        let state = aspect_state(&main, true, !target).await?;
        let native_after_get = appkit_snapshot(&main).await?;
        if native_after_get != native {
            return Err("Aspect getter changed settled native menu Zoom state".into());
        }
        menu_transitions.push(json!({"kind": "native_menu_zoom", "menu_id": "ott.window.zoom",
            "target": target, "event_count": event_count, "native": native, "state": state,
            "target_visible_frame": menu_target, "native_after_get": native_after_get}));
    }
    let final_state = aspect(&main, Some(false), false).await?;
    let final_native = appkit_settled(&main, &baseline, false, false, Some(false), true, None).await?;
    if appkit_snapshot(&aux).await? != aux_before {
        return Err("Main aspect operations changed the auxiliary AppKit window".into());
    }
    Ok(json!({"status": "pass", "platform": "macos", "mode": "production-permissions",
        "implementation": "production handlers via WKWebView JavaScript IPC",
        "observation": "owned AppKit constraint readback; geometry in points; no physical drag claim",
        "baseline": baseline, "initial": initial, "initial_state": initial_state,
        "set_sequence": sequence, "transitions": transitions, "menu_transitions": menu_transitions,
        "native_menu_activations": MENU_ZOOM_EVENTS.load(Ordering::SeqCst), "final": final_native,
        "final_state": final_state, "denials": denials, "aux_unchanged": true}))
}

async fn exercise_preference(
    main: tauri::WebviewWindow,
    phase: PreferencePhase,
) -> Result<Value, String> {
    let baseline = main.state::<AppKitBaseline>().0.clone();
    let aux = main.app_handle().get_webview_window("pip").ok_or("Auxiliary fixture missing")?;
    let aux_before = appkit_snapshot(&aux).await?;
    let enabled = matches!(phase, PreferencePhase::Unpin);
    // First observe eager initialization, before GET could perform lazy restore.
    let initial = appkit_settled(&main, &baseline, enabled, false, Some(false), true, None).await?;
    let initial_state = aspect_state(&main, enabled, enabled).await?;
    let target = matches!(phase, PreferencePhase::Pin);
    if !matches!(phase, PreferencePhase::VerifyOff) {
        aspect(&main, Some(target), target).await?;
    }
    let final_native = appkit_settled(&main, &baseline, target, false, Some(false), true, None).await?;
    let final_state = aspect_state(&main, target, target).await?;
    if appkit_snapshot(&aux).await? != aux_before {
        return Err("Aspect preference restoration changed the auxiliary AppKit window".into());
    }
    Ok(json!({"status": "pass", "platform": "macos", "mode": "preference-restoration",
        "phase": phase.name(), "baseline": baseline, "initial": initial,
        "initial_state": initial_state, "final": final_native, "final_state": final_state,
        "aux_unchanged": true}))
}
