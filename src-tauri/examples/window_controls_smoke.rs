//! Isolated Windows WebView2 fixture. No installed player, profiles or network.
//! Build with cargo build --locked -p ottplay-tauri --example window_controls_smoke,
//! then run scripts/check-window-controls.py. Both paths use production IPC handlers.

#[cfg(target_os = "windows")]
mod smoke {
    use ottplay_tauri_lib::native_window_smoke_commands::{tauri_commands, window_controls};
    use serde_json::{json, Value};
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicBool, AtomicI32, AtomicUsize, Ordering};
    use std::time::{Duration, Instant};
    use tauri::{Listener, Manager};

    static LOADED: AtomicUsize = AtomicUsize::new(0);
    static STARTED: AtomicBool = AtomicBool::new(false);
    static REQUEST: AtomicUsize = AtomicUsize::new(0);
    static EXIT_CODE: AtomicI32 = AtomicI32::new(1);

    #[repr(C)]
    #[derive(Default)]
    struct Rect {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    #[link(name = "user32")]
    extern "system" {
        fn GetWindowLongW(hwnd: *mut std::ffi::c_void, index: i32) -> i32;
        fn GetWindowRect(hwnd: *mut std::ffi::c_void, rect: *mut Rect) -> i32;
        fn GetWindowThreadProcessId(hwnd: *mut std::ffi::c_void, pid: *mut u32) -> u32;
    }
    #[link(name = "kernel32")]
    extern "system" {
        fn SetLastError(code: u32);
        fn GetLastError() -> u32;
    }

    #[derive(Clone, Debug, PartialEq, serde::Serialize)]
    struct Snapshot {
        fullscreen: bool,
        topmost: bool,
        win32_topmost: bool,
        rect: [i32; 4],
    }

    fn snapshot(window: &tauri::WebviewWindow) -> Result<Snapshot, String> {
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
            Ok(Snapshot {
                fullscreen: window.is_fullscreen().map_err(|e| e.to_string())?,
                topmost: window.is_always_on_top().map_err(|e| e.to_string())?,
                win32_topmost: style & 0x8 != 0, // WS_EX_TOPMOST
                rect: [rect.left, rect.top, rect.right, rect.bottom],
            })
        }
    }

    async fn invoke(
        window: &tauri::WebviewWindow,
        command: &str,
        args: Value,
    ) -> Result<Value, String> {
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
        let result = tokio::time::timeout(Duration::from_secs(4), receiver).await;
        window.unlisten(listener);
        let reply = result
            .map_err(|_| format!("{command}: IPC deadline"))?
            .map_err(|_| "IPC reply channel closed".to_string())?
            .map_err(|e| e.to_string())?;
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
            ] {
                denials.push(denied(&main, command, args).await?);
            }
            return Ok(
                json!({"status": "pass", "mode": "missing-permission", "denials": denials, "initial": baseline}),
            );
        }
        denials.push(denied(&aux, "set_always_on_top", json!({"alwaysOnTop": true})).await?);
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
        }
        top(&main, false).await?;
        let final_state = settled(&main, false, false, Some(baseline.rect)).await?;
        if snapshot(&aux)? != aux_before {
            return Err("Main operations changed auxiliary window".into());
        }
        Ok(
            json!({"status": "pass", "mode": "production-permissions", "implementation": "production handlers via WebView2 JavaScript IPC",
            "denials": denials, "topmost_sequence": states, "fullscreen_sequence": fullscreen_states,
            "initial": baseline, "final": final_state, "aux_unchanged": true}),
        )
    }

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
        let missing = std::env::args().any(|a| a == "--without-permission");
        let (done, deadline) = std::sync::mpsc::channel();
        let deadline_output = output.clone();
        let watchdog = std::thread::spawn(move || {
            if deadline.recv_timeout(Duration::from_secs(30)).is_err() {
                let _ = std::fs::write(
                    deadline_output.join("result.json"),
                    "{\"status\":\"fail\",\"error\":\"30-second internal deadline\"}",
                );
                // Exit only this isolated process. Windows destroys its owned HWNDs.
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
        let app = tauri::Builder::default()
            .invoke_handler(tauri::generate_handler![
                window_controls::set_always_on_top,
                tauri_commands::set_fullscreen,
                tauri_commands::toggle_fullscreen,
            ])
            .setup(move |app| {
                for label in ["main", "pip"] {
                    std::fs::create_dir_all(data.join(label))?;
                    tauri::WebviewWindowBuilder::new(
                        app,
                        label,
                        tauri::WebviewUrl::App("index.html".into()),
                    )
                    .title(format!("OttPlay isolated window controls: {label}"))
                    .inner_size(640.0, 360.0)
                    .position(40.0, 40.0)
                    .decorations(false)
                    .fullscreen(false)
                    .always_on_top(false)
                    .visible(label == "main")
                    .incognito(true)
                    .data_directory(data.join(label))
                    .build()?;
                }
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
                if LOADED.fetch_or(bit, Ordering::SeqCst) | bit != 3
                    || STARTED.swap(true, Ordering::SeqCst)
                {
                    return;
                }
                let handle = view.app_handle().clone();
                let main = handle
                    .get_webview_window("main")
                    .expect("owned main fixture");
                let output = report_output.clone();
                tauri::async_runtime::spawn(async move {
                    let result = exercise(main, missing).await;
                    let mut code = if result.is_ok() { 0 } else { 1 };
                    let mut report =
                        result.unwrap_or_else(|error| json!({"status": "fail", "error": error}));
                    let mut cleanup = Vec::new();
                    for label in ["pip", "main"] {
                        if let Some(window) = handle.get_webview_window(label) {
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
        let code = EXIT_CODE.load(Ordering::SeqCst);
        let _ = done.send(());
        let _ = watchdog.join();
        Ok(code)
    }
}

#[cfg(target_os = "windows")]
fn main() {
    match smoke::run() {
        Ok(code) => std::process::exit(code),
        Err(error) => {
            eprintln!("Isolated window controls failed: {error}");
            std::process::exit(1);
        }
    }
}
#[cfg(not(target_os = "windows"))]
fn main() {
    eprintln!("This fixture requires Windows with WebView2.");
    std::process::exit(2);
}
