//! Isolated native window fixture. No installed player, profiles or network.
//! Build with cargo build --locked -p ottplay-tauri --example window_controls_smoke,
//! then run scripts/check-window-controls.py. Both paths use production IPC handlers.

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
mod smoke {
    use ottplay_tauri_lib::native_window_smoke_commands::{
        tauri_commands, window_aspect, window_controls,
    };
    use serde_json::{json, Value};
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicBool, AtomicI32, AtomicUsize, Ordering};
    use std::sync::{mpsc, OnceLock};
    use std::time::{Duration, Instant};
    use tauri::{Listener, Manager};

    #[cfg(target_os = "macos")]
    static MENU_ZOOM_EVENTS: AtomicUsize = AtomicUsize::new(0);

    static LOADED: AtomicUsize = AtomicUsize::new(0);
    static STARTED: AtomicBool = AtomicBool::new(false);
    static REQUEST: AtomicUsize = AtomicUsize::new(0);
    static EXIT_CODE: AtomicI32 = AtomicI32::new(1);
    static START_TIME: OnceLock<Instant> = OnceLock::new();
    static PHASE: AtomicUsize = AtomicUsize::new(0);

    // Startup allowance is independent of the unchanged exercise/cleanup budget.
    // It is a bounded fixture tolerance, not an assertion about the cause of a stall.
    #[cfg(target_os = "windows")]
    const STARTUP_BUDGET: Duration = Duration::from_secs(60);
    #[cfg(target_os = "windows")]
    const EXERCISE_BUDGET: Duration = Duration::from_secs(30);

    enum WatchdogEvent {
        ExerciseStarted(Instant),
        Finished(Instant),
    }

    fn phase_name() -> &'static str {
        match PHASE.load(Ordering::SeqCst) {
            1 => "building-main",
            2 => "building-pip",
            3 => "exercise",
            4 => "cleanup",
            5 => "report",
            6 => "exit-requested",
            7 => "event-loop-returned",
            8 => "awaiting-page-loads",
            _ => "startup",
        }
    }

    fn trace(event: &str, detail: Value) {
        eprintln!("WINDOW_CONTROLS_TRACE {}", json!({
            "event": event, "detail": detail, "phase": phase_name(),
            "elapsed_ms": START_TIME.get().map(|start| start.elapsed().as_millis()),
            "loaded_mask": LOADED.load(Ordering::SeqCst),
            "request_count": REQUEST.load(Ordering::SeqCst),
        }));
    }

    #[cfg(target_os = "windows")]
    fn wait_for_completion(
        receiver: mpsc::Receiver<WatchdogEvent>,
        started: Instant,
    ) -> Result<(), &'static str> {
        let startup_deadline = started + STARTUP_BUDGET;
        let ready = match receiver.recv_timeout(
            startup_deadline.saturating_duration_since(Instant::now()),
        ) {
            Ok(WatchdogEvent::ExerciseStarted(at)) if at <= startup_deadline => at,
            _ => return Err("startup did not complete within 60 seconds"),
        };
        // Use the event's original instant, not a renewed budget at dequeue.
        let exercise_deadline = ready + EXERCISE_BUDGET;
        match receiver.recv_timeout(
            exercise_deadline.saturating_duration_since(Instant::now()),
        ) {
            Ok(WatchdogEvent::Finished(at)) if at <= exercise_deadline => Ok(()),
            _ => Err("exercise and cleanup did not complete within 30 seconds"),
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn wait_for_completion(
        receiver: mpsc::Receiver<WatchdogEvent>,
        started: Instant,
    ) -> Result<(), &'static str> {
        // Telemetry must not renew the existing total Mac/Linux fixture budget.
        let deadline = started + Duration::from_secs(30);
        loop {
            match receiver.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
                Ok(WatchdogEvent::ExerciseStarted(at)) if at <= deadline => {},
                Ok(WatchdogEvent::Finished(at)) if at <= deadline => return Ok(()),
                _ => return Err("30-second internal deadline"),
            }
        }
    }

    #[cfg(target_os = "windows")]
    #[repr(C)]
    #[derive(Default)]
    struct Rect {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    #[cfg(target_os = "windows")]
    #[link(name = "user32")]
    extern "system" {
        fn GetWindowLongW(hwnd: *mut std::ffi::c_void, index: i32) -> i32;
        fn GetWindowRect(hwnd: *mut std::ffi::c_void, rect: *mut Rect) -> i32;
        fn GetWindowThreadProcessId(hwnd: *mut std::ffi::c_void, pid: *mut u32) -> u32;
    }
    #[cfg(target_os = "windows")]
    #[link(name = "kernel32")]
    extern "system" {
        fn SetLastError(code: u32);
        fn GetLastError() -> u32;
    }

    #[cfg(target_os = "windows")]
    #[derive(Clone, Debug, PartialEq, serde::Serialize)]
    struct Snapshot {
        fullscreen: bool,
        topmost: bool,
        win32_topmost: bool,
        rect: [i32; 4],
    }

    #[cfg(target_os = "windows")]
    fn snapshot(window: &tauri::WebviewWindow) -> Result<Snapshot, String> {
        trace("snapshot-start", json!({"window": window.label()}));
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as *mut std::ffi::c_void;
        let mut pid = 0;
        let mut rect = Rect::default();
        // SAFETY: hwnd comes from our live fixture, and both output pointers are valid.
        // Verify ownership before inspecting its native style or geometry.
        unsafe {
            if GetWindowThreadProcessId(hwnd, &mut pid) == 0 || pid != std::process::id() {
                return Err("Refusing to inspect a window outside this fixture process".into());
            }
            SetLastError(0);
            let style = GetWindowLongW(hwnd, -20); // GWL_EXSTYLE
            let error = GetLastError();
            if style == 0 && error != 0 {
                return Err(format!("GetWindowLongW failed: {error}"));
            }
            if GetWindowRect(hwnd, &mut rect) == 0 {
                return Err("GetWindowRect failed".into());
            }
            let state = Snapshot {
                fullscreen: window.is_fullscreen().map_err(|e| e.to_string())?,
                topmost: window.is_always_on_top().map_err(|e| e.to_string())?,
                win32_topmost: style & 0x8 != 0, // WS_EX_TOPMOST
                rect: [rect.left, rect.top, rect.right, rect.bottom],
            };
            trace("snapshot-finished", json!({"window": window.label()}));
            Ok(state)
        }
    }

    async fn invoke(
        window: &tauri::WebviewWindow,
        command: &str,
        args: Value,
    ) -> Result<Value, String> {
        trace("invoke", json!({"window": window.label(), "command": command}));
        let event = format!(
            "window-controls-smoke-{}",
            REQUEST.fetch_add(1, Ordering::SeqCst)
        );
        let (sender, receiver) = tokio::sync::oneshot::channel();
        let listener = window.once(event.clone(), move |reply| {
            let _ = sender.send(serde_json::from_str::<Value>(reply.payload()));
        });
        let script = format!(
            "window.runWindowControlsSmokeInvoke({}, {}, {}, {})",
            json!(event),
            json!(window.label()),
            json!(command),
            args
        );
        if let Err(error) = window.eval(script) {
            window.unlisten(listener);
            return Err(error.to_string());
        }
        trace("await-ipc", json!({"window": window.label(), "command": command}));
        let result = tokio::time::timeout(Duration::from_secs(4), receiver).await;
        window.unlisten(listener);
        let reply = result
            .map_err(|_| format!("{command}: IPC deadline"))?
            .map_err(|_| "IPC reply channel closed".to_string())?
            .map_err(|e| e.to_string())?;
        trace("ipc-reply", json!({"window": window.label(), "command": command, "ok": reply["ok"]}));
        // Keep IPC rejection structured: a timeout or script failure is never an ACL pass.
        if reply["ok"].is_boolean() {
            Ok(reply)
        } else {
            Err("Malformed IPC envelope".into())
        }
    }

    async fn allowed(
        window: &tauri::WebviewWindow,
        command: &str,
        args: Value,
    ) -> Result<Value, String> {
        let reply = invoke(window, command, args).await?;
        if reply["ok"] != true {
            return Err(format!("{command}: {}", reply["error"]));
        }
        Ok(reply["value"].clone())
    }

    #[cfg(target_os = "windows")]
    async fn denied(
        window: &tauri::WebviewWindow,
        command: &str,
        args: Value,
    ) -> Result<Value, String> {
        let before = snapshot(window)?;
        let reply = invoke(window, command, args).await?;
        let error = reply["error"].as_str().unwrap_or("");
        if reply["ok"] != false || !error.contains("not allowed") {
            return Err(format!(
                "Expected ACL rejection for {command}, received {reply}"
            ));
        }
        if snapshot(window)? != before {
            return Err(format!("Denied {command} changed native state"));
        }
        Ok(json!({"window": window.label(), "command": command, "error": error}))
    }

    // Style/geometry changes can finish after the command's cached state update.
    // Poll only our window for a bounded interval; never repeat the mutation.
    #[cfg(target_os = "windows")]
    async fn settled(
        window: &tauri::WebviewWindow,
        topmost: bool,
        fullscreen: bool,
        expected_rect: Option<[i32; 4]>,
    ) -> Result<Snapshot, String> {
        let start = Instant::now();
        loop {
            let state = snapshot(window)?;
            let geometry_matches =
                expected_rect
                    .map(|expected| {
                        state.rect.iter().zip(expected).all(|(actual, wanted)| {
                            (i64::from(*actual) - i64::from(wanted)).abs() <= 2
                        })
                    })
                    .unwrap_or(true);
            if state.topmost == topmost
                && state.win32_topmost == topmost
                && state.fullscreen == fullscreen
                && geometry_matches
            {
                return Ok(state);
            }
            if start.elapsed() >= Duration::from_secs(2) {
                return Err(format!("Native state did not settle: {state:?}; topmost={topmost}, fullscreen={fullscreen}, rect={expected_rect:?}"));
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    }

    async fn top(window: &tauri::WebviewWindow, value: bool) -> Result<(), String> {
        let reply = allowed(window, "set_always_on_top", json!({"alwaysOnTop": value})).await?;
        if reply != json!({"ok": true, "alwaysOnTop": value}) {
            return Err(format!("Bad topmost readback: {reply}"));
        }
        Ok(())
    }

    #[cfg(target_os = "windows")]
    #[repr(C)]
    #[derive(Default, Clone, Copy)]
    struct Point {
        x: i32,
        y: i32,
    }
    #[cfg(target_os = "windows")]
    #[repr(C)]
    #[derive(Default)]
    struct MinMax {
        reserved: Point,
        max_size: Point,
        max_position: Point,
        min_track: Point,
        max_track: Point,
    }
    #[cfg(target_os = "windows")]
    type Hwnd = *mut std::ffi::c_void;
    #[cfg(target_os = "windows")]
    type Subclass = unsafe extern "system" fn(Hwnd, u32, usize, isize, usize, usize) -> isize;
    #[cfg(target_os = "windows")]
    const PROBE_ID: usize = 0x4f545450;
    #[cfg(target_os = "windows")]
    #[link(name = "comctl32")]
    extern "system" {
        fn SetWindowSubclass(w: Hwnd, callback: Option<Subclass>, id: usize, data: usize) -> i32;
        fn RemoveWindowSubclass(w: Hwnd, callback: Option<Subclass>, id: usize) -> i32;
        fn DefSubclassProc(w: Hwnd, message: u32, wparam: usize, lparam: isize) -> isize;
    }
    #[cfg(target_os = "windows")]
    #[link(name = "user32")]
    extern "system" {
        fn GetClientRect(w: Hwnd, rect: *mut Rect) -> i32;
        fn SetWindowPos(
            w: Hwnd,
            after: Hwnd,
            x: i32,
            y: i32,
            width: i32,
            height: i32,
            flags: u32,
        ) -> i32;
        fn SendMessageW(w: Hwnd, message: u32, wparam: usize, lparam: isize) -> isize;
        fn DefWindowProcW(w: Hwnd, message: u32, wparam: usize, lparam: isize) -> isize;
    }
    #[cfg(target_os = "windows")]
    #[derive(Default)]
    struct Probe {
        captures: usize,
        limits: [i32; 4],
    }
    #[cfg(target_os = "windows")]
    unsafe extern "system" fn observe_bounds(
        w: Hwnd,
        message: u32,
        wp: usize,
        lp: isize,
        _id: usize,
        data: usize,
    ) -> isize {
        if message == 0x0046 && lp != 0 {
            // Tao consumes WM_WINDOWPOSCHANGING without default processing.
            // Only this temporary observer asks Windows to validate the actual
            // proposal, emitting an OS-initialized WM_GETMINMAXINFO through the
            // real subclass chain. Tao still applies its adjustments afterward.
            DefWindowProcW(w, message, wp, lp);
        }
        let result = DefSubclassProc(w, message, wp, lp);
        if message == 0x0024 && lp != 0 {
            let native = &*(lp as *const MinMax);
            let probe = &mut *(data as *mut Probe);
            probe.captures += 1;
            probe.limits = [
                native.min_track.x,
                native.min_track.y,
                native.max_track.x,
                native.max_track.y,
            ];
        }
        result
    }
    #[cfg(target_os = "windows")]
    struct ProbeGuard {
        hwnd: Hwnd,
        data: *mut Probe,
    }
    #[cfg(target_os = "windows")]
    impl ProbeGuard {
        unsafe fn finish(&mut self) -> Result<(), String> {
            if RemoveWindowSubclass(self.hwnd, Some(observe_bounds), PROBE_ID) == 0 {
                return Err("Cannot remove owned bounds observer".into());
            }
            drop(Box::from_raw(self.data));
            self.data = std::ptr::null_mut();
            Ok(())
        }
    }
    #[cfg(target_os = "windows")]
    impl Drop for ProbeGuard {
        fn drop(&mut self) {
            if !self.data.is_null() {
                unsafe {
                    // On removal failure retain the callback storage until this
                    // isolated process exits; never leave a dangling subclass pointer.
                    if RemoveWindowSubclass(self.hwnd, Some(observe_bounds), PROBE_ID) != 0 {
                        drop(Box::from_raw(self.data));
                    }
                }
            }
        }
    }
    #[cfg(target_os = "windows")]
    fn coordinates(rect: &Rect) -> [i32; 4] {
        [rect.left, rect.top, rect.right, rect.bottom]
    }

    // Real owned HWND dispatch, not a copy of production geometry. SetWindowPos
    // provokes OS-initialized tracking bounds; never send a fabricated MINMAXINFO.
    // WM_SIZING below is a deliberate message probe, not a claimed mouse gesture.
    #[cfg(target_os = "windows")]
    async fn sizing_probe(window: &tauri::WebviewWindow, enabled: bool) -> Result<Value, String> {
        let (sender, receiver) = tokio::sync::oneshot::channel();
        let target = window.clone();
        window
            .run_on_main_thread(move || {
                let result = (|| -> Result<Value, String> {
                    let hwnd = target.hwnd().map_err(|e| e.to_string())?.0 as Hwnd;
                    let mut pid = 0;
                    let mut original = Rect::default();
                    let mut client = Rect::default();
                    unsafe {
                        if GetWindowThreadProcessId(hwnd, &mut pid) == 0
                            || pid != std::process::id()
                            || GetWindowRect(hwnd, &mut original) == 0
                            || GetClientRect(hwnd, &mut client) == 0
                        {
                            return Err("Sizing probe requires the live owned HWND".into());
                        }
                        let width = original.right - original.left;
                        let height = original.bottom - original.top;
                        let insets = [
                            width - (client.right - client.left),
                            height - (client.bottom - client.top),
                        ];
                        let data = Box::into_raw(Box::new(Probe::default()));
                        if SetWindowSubclass(hwnd, Some(observe_bounds), PROBE_ID, data as usize)
                            == 0
                        {
                            drop(Box::from_raw(data));
                            return Err("Cannot install owned bounds observer".into());
                        }
                        let mut guard = ProbeGuard { hwnd, data };
                        SetLastError(0);
                        let style = GetWindowLongW(hwnd, -16) as u32; // GWL_STYLE
                        let style_error = GetLastError();
                        SetLastError(0);
                        let changed =
                            SetWindowPos(hwnd, std::ptr::null_mut(), 0, 0, width + 1, height, 0x16);
                        let change_error = (changed == 0).then(|| GetLastError());
                        let change_captures = (*data).captures;
                        // Always restore, even if the deliberate one-pixel proposal failed.
                        SetLastError(0);
                        let restored =
                            SetWindowPos(hwnd, std::ptr::null_mut(), 0, 0, width, height, 0x16);
                        let restore_error = (restored == 0).then(|| GetLastError());
                        let observation = json!({
                            "method": "temporary-default-windowpos-observer",
                            "style": style, "style_error": style_error,
                            "thickframe": style & 0x00040000 != 0,
                            "caption": style & 0x00c00000 == 0x00c00000,
                            "changed": changed, "change_error": change_error,
                            "change_captures": change_captures,
                            "restored": restored, "restore_error": restore_error,
                            "captures": (*data).captures, "limits": (*data).limits,
                        });
                        eprintln!("window-controls-sizing-probe {observation}");
                        if changed == 0 || restored == 0 || (*data).captures == 0 {
                            return Err(format!(
                                "OS did not supply real tracking bounds: {observation}"
                            ));
                        }
                        let limits = (*data).limits;
                        if insets.iter().any(|v| *v < 0)
                            || limits[0] <= 0
                            || limits[1] <= 0
                            || limits[2] < limits[0]
                            || limits[3] < limits[1]
                        {
                            return Err("OS tracking limits/insets are invalid".into());
                        }
                        let mut samples = Vec::new();
                        for edge in 1..=8 {
                            let mut proposed = Rect {
                                left: original.left,
                                top: original.top,
                                right: original.left + 843,
                                bottom: original.top + 527,
                            };
                            let input = coordinates(&proposed);
                            SendMessageW(hwnd, 0x0214, edge, (&mut proposed as *mut Rect) as isize);
                            let output = coordinates(&proposed);
                            if enabled {
                                let w = i64::from(proposed.right) - i64::from(proposed.left);
                                let h = i64::from(proposed.bottom) - i64::from(proposed.top);
                                if ((w - i64::from(insets[0])) * 9
                                    - (h - i64::from(insets[1])) * 16)
                                    .abs()
                                    > 4
                                    || w < i64::from(limits[0])
                                    || h < i64::from(limits[1])
                                    || w > i64::from(limits[2])
                                    || h > i64::from(limits[3])
                                {
                                    return Err(format!(
                                        "Native WM_SIZING edge {edge} violated ratio/bounds"
                                    ));
                                }
                            } else if input != output {
                                return Err(format!(
                                    "Disabled constraint changed WM_SIZING edge {edge}"
                                ));
                            }
                            samples.push(json!({"edge": edge, "input": input, "output": output}));
                        }
                        let report = json!({"kind": "owned-hwnd-message-probe", "enabled": enabled,
                        "os_bounds_captures": (*data).captures, "outer_limits": limits,
                        "client_insets": insets, "samples": samples, "bounds_probe": observation});
                        guard.finish()?;
                        Ok(report)
                    }
                })();
                let _ = sender.send(result);
            })
            .map_err(|e| e.to_string())?;
        tokio::time::timeout(Duration::from_secs(4), receiver)
            .await
            .map_err(|_| "Sizing probe deadline".to_owned())?
            .map_err(|_| "Sizing probe channel closed".to_owned())?
    }

    #[cfg(any(target_os = "windows", target_os = "macos"))]
    async fn aspect(
        window: &tauri::WebviewWindow,
        enabled: Option<bool>,
        active: bool,
    ) -> Result<Value, String> {
        let reply = if let Some(enabled) = enabled {
            allowed(
                window,
                "set_window_aspect_lock",
                json!({"enabled": enabled}),
            )
            .await?
        } else {
            allowed(window, "get_window_aspect_lock", json!({})).await?
        };
        let desired = enabled.unwrap_or(active);
        if reply != json!({"ok": true, "supported": true, "enabled": desired, "active": active}) {
            return Err(format!("Wrong native aspect response: {reply}"));
        }
        Ok(reply)
    }
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    async fn aspect_state(
        window: &tauri::WebviewWindow,
        enabled: bool,
        active: bool,
    ) -> Result<Value, String> {
        let reply = allowed(window, "get_window_aspect_lock", json!({})).await?;
        if reply != json!({"ok": true, "supported": true, "enabled": enabled, "active": active}) {
            return Err(format!("Wrong native aspect state: {reply}"));
        }
        Ok(reply)
    }

    #[cfg(target_os = "windows")]
    async fn exercise(main: tauri::WebviewWindow, missing: bool) -> Result<Value, String> {
        let aux = main
            .app_handle()
            .get_webview_window("pip")
            .ok_or("Auxiliary fixture missing")?;
        let baseline = settled(&main, false, false, None).await?;
        let aux_before = snapshot(&aux)?;
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
            return Ok(
                json!({"status": "pass", "mode": "missing-permission", "denials": denials, "initial": baseline}),
            );
        }
        denials.push(denied(&aux, "set_always_on_top", json!({"alwaysOnTop": true})).await?);
        denials.push(denied(&aux, "get_window_aspect_lock", json!({})).await?);
        denials.push(denied(&aux, "set_window_aspect_lock", json!({"enabled": true})).await?);
        let aspect_initial = aspect_state(&main, true, true).await?;
        let mut aspect_sequence = Vec::new();
        let mut aspect_geometry = Vec::new();
        for enabled in [true, true, false, false] {
            aspect_sequence.push(aspect(&main, Some(enabled), enabled).await?);
            aspect_geometry.push(settled(&main, false, false, Some(baseline.rect)).await?);
        }
        aspect(&main, Some(true), true).await?;
        let mut aspect_fullscreen = Vec::new();
        let mut states = Vec::new();
        for value in [true, true, false, false] {
            top(&main, value).await?;
            states.push(settled(&main, value, false, Some(baseline.rect)).await?);
        }
        let monitor = main
            .current_monitor()
            .map_err(|e| e.to_string())?
            .ok_or("No monitor for fixture")?;
        let p = monitor.position();
        let s = monitor.size();
        let fullscreen_rect = [p.x, p.y, p.x + s.width as i32, p.y + s.height as i32];
        let mut fullscreen_states = Vec::new();
        for pinned in [false, true] {
            top(&main, pinned).await?;
            settled(&main, pinned, false, Some(baseline.rect)).await?;
            for target in [true, false] {
                let reply = allowed(&main, "toggle_fullscreen", json!({})).await?;
                if reply != json!({"ok": true, "fullscreen": target}) {
                    return Err(format!("Bad toggle response: {reply}"));
                }
                let rect = if target {
                    fullscreen_rect
                } else {
                    baseline.rect
                };
                fullscreen_states.push(settled(&main, pinned, target, Some(rect)).await?);
                aspect_fullscreen.push(aspect_state(&main, true, !target).await?);
            }
        }
        // Escape uses explicit set, so exercise that production command as well.
        for target in [true, false] {
            let reply = allowed(&main, "set_fullscreen", json!({"fullscreen": target})).await?;
            if reply != json!({"ok": true, "fullscreen": target}) {
                return Err(format!("Bad set response: {reply}"));
            }
            settled(
                &main,
                true,
                target,
                Some(if target {
                    fullscreen_rect
                } else {
                    baseline.rect
                }),
            )
            .await?;
            aspect_fullscreen.push(aspect_state(&main, true, !target).await?);
        }
        let sizing_enabled = sizing_probe(&main, true).await?;
        settled(&main, true, false, Some(baseline.rect)).await?;
        aspect(&main, Some(false), false).await?;
        let sizing_disabled = sizing_probe(&main, false).await?;
        let aspect_final = aspect_state(&main, false, false).await?;
        top(&main, false).await?;
        let final_state = settled(&main, false, false, Some(baseline.rect)).await?;
        if snapshot(&aux)? != aux_before {
            return Err("Main operations changed auxiliary window".into());
        }
        Ok(
            json!({"status": "pass", "mode": "production-permissions", "implementation": "production handlers via WebView2 JavaScript IPC",
            "denials": denials, "topmost_sequence": states, "fullscreen_sequence": fullscreen_states,
            "initial": baseline, "final": final_state, "aux_unchanged": true,
            "aspect": {"initial": aspect_initial, "set_sequence": aspect_sequence, "set_geometry": aspect_geometry,
                "fullscreen_sequence": aspect_fullscreen, "sizing_enabled": sizing_enabled,
                "sizing_disabled": sizing_disabled, "final": aspect_final}}),
        )
    }

    #[derive(Clone, Copy)]
    enum PreferencePhase {
        Pin,
        Unpin,
        VerifyOff,
    }

    impl PreferencePhase {
        fn name(self) -> &'static str {
            match self {
                Self::Pin => "pin",
                Self::Unpin => "unpin",
                Self::VerifyOff => "verify-off",
            }
        }
    }

    #[cfg(target_os = "windows")]
    async fn exercise_preference(
        main: tauri::WebviewWindow,
        phase: PreferencePhase,
    ) -> Result<Value, String> {
        let aux = main
            .app_handle()
            .get_webview_window("pip")
            .ok_or("Auxiliary fixture missing")?;
        let aux_before = snapshot(&aux)?;
        // Inspect startup state before issuing any mutating IPC. Each phase is a
        // new process; only the parent-owned preference directory is reused.
        let initial = settled(&main, matches!(phase, PreferencePhase::Unpin), false, None).await?;
        let aspect_initial = aspect_state(
            &main,
            !matches!(phase, PreferencePhase::VerifyOff),
            !matches!(phase, PreferencePhase::VerifyOff),
        )
        .await?;
        let target = matches!(phase, PreferencePhase::Pin);
        if !matches!(phase, PreferencePhase::VerifyOff) {
            top(&main, target).await?;
            aspect(&main, Some(target), target).await?;
        }
        let aspect_final = aspect_state(&main, target, target).await?;
        let aspect_sizing = sizing_probe(&main, target).await?;
        let final_state = settled(&main, target, false, Some(initial.rect)).await?;
        if snapshot(&aux)? != aux_before {
            return Err("Preference restoration changed auxiliary window".into());
        }
        Ok(
            json!({"status": "pass", "mode": "preference-restoration", "phase": phase.name(),
            "initial": initial, "final": final_state, "aux_unchanged": true,
            "aspect_initial": aspect_initial, "aspect_final": aspect_final, "aspect_sizing": aspect_sizing}),
        )
    }

    #[cfg(target_os = "macos")]
    include!("window_controls_smoke/appkit.rs");
    #[cfg(target_os = "linux")]
    include!("window_controls_smoke/linux.rs");

    pub fn run() -> Result<i32, Box<dyn std::error::Error>> {
        let output = PathBuf::from(
            std::env::args()
                .nth(1)
                .ok_or("Supply an isolated output directory")?,
        );
        std::fs::create_dir_all(&output)?;
        // A fresh owner marker prevents accidental reuse of a profile or prior run.
        std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(output.join("fixture-owner"))?;
        let data = output.join("webview-data");
        let arguments: Vec<String> = std::env::args().skip(2).collect();
        let missing = arguments.iter().any(|a| a == "--without-permission");
        let phase = match arguments.as_slice() {
            [] => None,
            [flag] if flag == "--without-permission" => None,
            [flag, value] if flag == "--preference-phase" => Some(match value.as_str() {
                "pin" => PreferencePhase::Pin,
                "unpin" => PreferencePhase::Unpin,
                "verify-off" => PreferencePhase::VerifyOff,
                _ => return Err("Unknown preference phase".into()),
            }),
            _ => return Err("Unsupported fixture arguments".into()),
        };
        let started = Instant::now();
        let _ = START_TIME.set(started);
        trace("startup", json!({"missing_permission": missing}));
        let (done, deadline) = mpsc::channel();
        let exercise_started = done.clone();
        let deadline_output = output.clone();
        let watchdog = std::thread::spawn(move || {
            if let Err(error) = wait_for_completion(deadline, started) {
                let failure = json!({"status": "fail", "error": error,
                    "phase": phase_name(), "elapsed_ms": started.elapsed().as_millis(),
                    "loaded_mask": LOADED.load(Ordering::SeqCst),
                    "request_count": REQUEST.load(Ordering::SeqCst)});
                trace("watchdog", failure.clone());
                // Keep timeout evidence separate from any earlier assertion report.
                // The parent treats this marker as failure even if result.json says pass.
                let _ = std::fs::write(
                    deadline_output.join("watchdog.json"),
                    serde_json::to_vec_pretty(&failure).unwrap(),
                );
                // Exit only this isolated process; no installed player is targeted.
                // The parent runner subsequently removes its private WebView data.
                std::process::exit(1);
            }
        });
        let context = if missing {
            tauri::generate_context!(
                "examples/window-controls-smoke/without-permission/tauri.conf.json"
            )
        } else {
            tauri::generate_context!("examples/window-controls-smoke/tauri.conf.json")
        };
        let report_output = output.clone();
        let builder = tauri::Builder::default();
        #[cfg(target_os = "macos")]
        let builder = builder
            .menu(ottplay_tauri_lib::native_window_smoke_commands::build_native_menu)
            .on_menu_event(|app, event| {
                if event.id().as_ref() == "ott.window.zoom" {
                    MENU_ZOOM_EVENTS.fetch_add(1, Ordering::SeqCst);
                }
                ottplay_tauri_lib::native_window_smoke_commands::handle_native_menu(app, event);
            })
            .on_window_event(
                ottplay_tauri_lib::native_window_smoke_commands::native_menu_window_event,
            );
        let app = builder
            .manage(window_controls::AlwaysOnTopPersistence::default())
            .manage(window_aspect::WindowAspectLock::default())
            .invoke_handler(tauri::generate_handler![
                window_controls::set_always_on_top,
                window_aspect::get_window_aspect_lock,
                window_aspect::set_window_aspect_lock,
                tauri_commands::set_fullscreen,
                tauri_commands::toggle_fullscreen,
            ])
            .setup(move |app| {
                for label in ["main", "pip"] {
                    PHASE.store(if label == "main" { 1 } else { 2 }, Ordering::SeqCst);
                    trace("window-build-start", json!({"window": label}));
                    std::fs::create_dir_all(data.join(label))?;
                    let builder = tauri::WebviewWindowBuilder::new(
                        app,
                        label,
                        tauri::WebviewUrl::App("index.html".into()),
                    )
                    .title(format!("OttPlay isolated window controls: {label}"))
                    .inner_size(640.0, 400.0)
                    .position(40.0, 40.0)
                    .decorations(false)
                    .fullscreen(false)
                    .always_on_top(
                        label == "main" && window_controls::initial_always_on_top(app.handle()),
                    )
                    .visible(label == "main" || cfg!(target_os = "linux"))
                    .incognito(true)
                    .data_directory(data.join(label));
                    #[cfg(target_os = "linux")]
                    let builder = builder.min_inner_size(320.0, 180.0).max_inner_size(1600.0, 1000.0);
                    builder.build()?;
                    trace("window-build-finished", json!({"window": label}));
                }
                #[cfg(target_os = "macos")]
                appkit_prepare(app)?;
                if let Some(webview) = app.get_webview_window("main") {
                    let window = webview.as_ref().window();
                    let handle = app.handle().clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(error) = window_aspect::initialize(handle, window).await {
                            tracing::warn!(%error, "Fixture aspect restore failed");
                        }
                    });
                }
                // A page callback can already have admitted exercise; never overwrite it.
                let _ = PHASE.compare_exchange(2, 8, Ordering::SeqCst, Ordering::SeqCst);
                trace("setup-finished", json!({}));
                Ok(())
            })
            .on_page_load(move |view, payload| {
                if payload.event() != tauri::webview::PageLoadEvent::Finished {
                    return;
                }
                let bit = match view.label() {
                    "main" => 1,
                    "pip" => 2,
                    _ => return,
                };
                let loaded = LOADED.fetch_or(bit, Ordering::SeqCst) | bit;
                trace("page-finished", json!({"window": view.label()}));
                if loaded != 3 || STARTED.swap(true, Ordering::SeqCst) {
                    return;
                }
                let ready_at = Instant::now();
                PHASE.store(3, Ordering::SeqCst);
                trace("exercise-started", json!({}));
                let _ = exercise_started.send(WatchdogEvent::ExerciseStarted(ready_at));
                let handle = view.app_handle().clone();
                let main = handle
                    .get_webview_window("main")
                    .expect("owned main fixture");
                let output = report_output.clone();
                tauri::async_runtime::spawn(async move {
                    let result = if let Some(phase) = phase {
                        exercise_preference(main, phase).await
                    } else {
                        exercise(main, missing).await
                    };
                    trace("exercise-finished", json!({"ok": result.is_ok()}));
                    PHASE.store(4, Ordering::SeqCst);
                    let mut code = if result.is_ok() { 0 } else { 1 };
                    let mut report =
                        result.unwrap_or_else(|error| json!({"status": "fail", "error": error}));
                    let mut cleanup = Vec::new();
                    for label in ["pip", "main"] {
                        if let Some(window) = handle.get_webview_window(label) {
                            trace("window-destroy", json!({"window": label}));
                            if let Err(error) = window.destroy() {
                                cleanup.push(format!("{label}: {error}"));
                            }
                        }
                    }
                    if !cleanup.is_empty() {
                        code = 1;
                        report["status"] = json!("fail");
                    }
                    report["cleanup_errors"] = json!(cleanup);
                    report["owned_labels"] = json!(["main", "pip"]);
                    PHASE.store(5, Ordering::SeqCst);
                    trace("report", json!({"exit_code": code}));
                    if std::fs::write(
                        output.join("result.json"),
                        serde_json::to_vec_pretty(&report).unwrap(),
                    )
                    .is_err()
                    {
                        code = 1;
                    }
                    println!("{report}");
                    EXIT_CODE.store(code, Ordering::SeqCst);
                    PHASE.store(6, Ordering::SeqCst);
                    trace("exit-requested", json!({"exit_code": code}));
                    handle.exit(code);
                });
            })
            .build(context)?;
        app.run_return(|_, event| {
            if let tauri::RunEvent::ExitRequested {
                code: None, api, ..
            } = event
            {
                // Destroying the last fixture window must not outrun result/exit-code publication.
                api.prevent_exit();
            }
        });
        let finished_at = Instant::now();
        PHASE.store(7, Ordering::SeqCst);
        let code = EXIT_CODE.load(Ordering::SeqCst);
        trace("event-loop-returned", json!({"exit_code": code}));
        let _ = done.send(WatchdogEvent::Finished(finished_at));
        let _ = watchdog.join();
        Ok(code)
    }

    #[cfg(all(test, target_os = "windows"))]
    mod tests {
        use super::*;

        #[test]
        fn watchdog_uses_captured_phase_instants_without_renewing_queued_budget() {
            let now = Instant::now();
            let started = now - Duration::from_secs(100);
            let ready = started + Duration::from_secs(40);
            let (sender, receiver) = mpsc::channel();
            sender.send(WatchdogEvent::ExerciseStarted(ready)).unwrap();
            sender.send(WatchdogEvent::Finished(ready + Duration::from_secs(20))).unwrap();
            assert_eq!(wait_for_completion(receiver, started), Ok(()));
        }

        #[test]
        fn watchdog_rejects_late_start_even_with_a_queued_completion() {
            let started = Instant::now() - Duration::from_secs(100);
            let ready = started + Duration::from_secs(61);
            let (sender, receiver) = mpsc::channel();
            sender.send(WatchdogEvent::ExerciseStarted(ready)).unwrap();
            sender.send(WatchdogEvent::Finished(ready)).unwrap();
            assert_eq!(wait_for_completion(receiver, started),
                Err("startup did not complete within 60 seconds"));
        }

        #[test]
        fn watchdog_rejects_late_completion_after_timely_start() {
            let started = Instant::now() - Duration::from_secs(100);
            let ready = started + Duration::from_secs(59);
            let (sender, receiver) = mpsc::channel();
            sender.send(WatchdogEvent::ExerciseStarted(ready)).unwrap();
            sender.send(WatchdogEvent::Finished(ready + Duration::from_secs(31))).unwrap();
            assert_eq!(wait_for_completion(receiver, started),
                Err("exercise and cleanup did not complete within 30 seconds"));
        }

        #[test]
        fn watchdog_rejects_expired_startup_without_a_ready_event() {
            let started = Instant::now() - Duration::from_secs(61);
            let (_sender, receiver) = mpsc::channel();
            assert_eq!(wait_for_completion(receiver, started),
                Err("startup did not complete within 60 seconds"));
        }
    }
    #[cfg(all(test, not(target_os = "windows")))]
    mod total_deadline_tests {
        use super::*;

        #[test]
        fn captured_completion_within_original_total_deadline_is_accepted() {
            let started = Instant::now() - Duration::from_secs(100);
            let (sender, receiver) = mpsc::channel();
            sender.send(WatchdogEvent::ExerciseStarted(started + Duration::from_secs(20))).unwrap();
            sender.send(WatchdogEvent::Finished(started + Duration::from_secs(29))).unwrap();
            assert_eq!(wait_for_completion(receiver, started), Ok(()));
        }

        #[test]
        fn exercise_event_does_not_renew_original_total_deadline() {
            let started = Instant::now() - Duration::from_secs(100);
            let (sender, receiver) = mpsc::channel();
            sender.send(WatchdogEvent::ExerciseStarted(started + Duration::from_secs(20))).unwrap();
            sender.send(WatchdogEvent::Finished(started + Duration::from_secs(31))).unwrap();
            assert_eq!(wait_for_completion(receiver, started), Err("30-second internal deadline"));
        }
    }
}

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
fn main() {
    match smoke::run() {
        Ok(code) => std::process::exit(code),
        Err(error) => {
            eprintln!("Isolated window controls failed: {error}");
            std::process::exit(1);
        }
    }
}
#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn main() {
    eprintln!("This fixture requires Windows, macOS or Linux with X11.");
    std::process::exit(2);
}
