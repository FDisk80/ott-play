//! Explicit controls for the calling main desktop window.

#[derive(Default)]
pub struct AlwaysOnTopPersistence(tokio::sync::Mutex<()>);

#[derive(Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlwaysOnTopResult {
    pub ok: bool,
    pub always_on_top: bool,
}

trait TopmostWindow {
    fn label(&self) -> &str;
    fn set_always_on_top(&self, enabled: bool) -> Result<(), String>;
    fn is_always_on_top(&self) -> Result<bool, String>;
}

impl TopmostWindow for tauri::Window {
    fn label(&self) -> &str {
        tauri::Window::label(self)
    }

    fn set_always_on_top(&self, enabled: bool) -> Result<(), String> {
        tauri::Window::set_always_on_top(self, enabled).map_err(|error| error.to_string())
    }

    fn is_always_on_top(&self) -> Result<bool, String> {
        tauri::Window::is_always_on_top(self).map_err(|error| error.to_string())
    }
}

fn apply_always_on_top(
    window: &impl TopmostWindow,
    enabled: bool,
) -> Result<AlwaysOnTopResult, String> {
    if window.label() != "main" {
        return Err("Always-on-top control is restricted to the main window".into());
    }
    window.set_always_on_top(enabled)?;
    // The getter waits for the native window queue. Do not report the requested
    // value as if it were confirmed, or cache an unverified state in the shell.
    let actual = window.is_always_on_top()?;
    if actual != enabled {
        return Err("The native window did not apply the requested always-on-top state".into());
    }
    Ok(AlwaysOnTopResult {
        ok: true,
        always_on_top: actual,
    })
}

fn apply_and_persist_always_on_top(
    window: &impl TopmostWindow,
    enabled: bool,
    persist: impl FnOnce(bool) -> Result<(), String>,
) -> Result<AlwaysOnTopResult, String> {
    let result = apply_always_on_top(window, enabled)?;
    persist(result.always_on_top)?;
    Ok(result)
}

/// Initial state for the main window, using the same instance root as the setter.
/// Kept here so the isolated native fixture exercises the production startup loader.
pub fn initial_always_on_top(app: &tauri::AppHandle) -> bool {
    crate::instance::app_data_dir(app)
        .map_err(std::io::Error::other)
        .and_then(|root| crate::window_preferences::read_always_on_top(&root))
        .unwrap_or_else(|_| {
            tracing::warn!("Always-on-top preference unavailable; using normal window state");
            false
        })
}

/// Set, rather than toggle, so retrying the same request is idempotent.
/// The injected caller window prevents selecting a different window by label.
#[tauri::command]
pub async fn set_always_on_top(
    app: tauri::AppHandle,
    window: tauri::Window,
    persistence: tauri::State<'_, AlwaysOnTopPersistence>,
    always_on_top: bool,
) -> Result<AlwaysOnTopResult, String> {
    if window.label() != "main" {
        return Err("Always-on-top control is restricted to the main window".into());
    }
    let _transition = persistence.0.lock().await;
    let root = crate::instance::app_data_dir(&app)?;
    apply_and_persist_always_on_top(&window, always_on_top, |confirmed| {
        crate::window_preferences::write_always_on_top(&root, confirmed).map_err(|_| {
            "The window changed, but its always-on-top preference could not be saved".into()
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::{Cell, RefCell};

    struct TestWindow {
        label: &'static str,
        state: Cell<bool>,
        calls: RefCell<Vec<String>>,
        set_error: Option<&'static str>,
        read_error: Option<&'static str>,
        ignore_set: bool,
    }

    impl TestWindow {
        fn new(label: &'static str, state: bool) -> Self {
            Self {
                label,
                state: Cell::new(state),
                calls: RefCell::new(Vec::new()),
                set_error: None,
                read_error: None,
                ignore_set: false,
            }
        }
    }

    impl TopmostWindow for TestWindow {
        fn label(&self) -> &str {
            self.label
        }

        fn set_always_on_top(&self, enabled: bool) -> Result<(), String> {
            self.calls.borrow_mut().push(format!("set:{enabled}"));
            if let Some(error) = self.set_error {
                return Err(error.into());
            }
            if !self.ignore_set {
                self.state.set(enabled);
            }
            Ok(())
        }

        fn is_always_on_top(&self) -> Result<bool, String> {
            self.calls.borrow_mut().push("read".into());
            if let Some(error) = self.read_error {
                return Err(error.into());
            }
            Ok(self.state.get())
        }
    }

    #[test]
    fn repeated_explicit_requests_do_not_toggle_the_window() {
        let window = TestWindow::new("main", false);
        for enabled in [true, true, false, false] {
            assert_eq!(
                apply_always_on_top(&window, enabled).unwrap(),
                AlwaysOnTopResult {
                    ok: true,
                    always_on_top: enabled,
                }
            );
            assert_eq!(window.state.get(), enabled);
        }
        assert_eq!(
            *window.calls.borrow(),
            [
                "set:true",
                "read",
                "set:true",
                "read",
                "set:false",
                "read",
                "set:false",
                "read"
            ]
        );
    }

    #[test]
    fn non_main_callers_are_rejected_before_any_native_access() {
        for label in ["pip", "", "MAIN", "main/child", "other"] {
            let window = TestWindow::new(label, true);
            assert!(apply_always_on_top(&window, false).is_err());
            assert!(window.calls.borrow().is_empty());
            assert!(window.state.get());
        }
    }

    #[test]
    fn setter_error_does_not_read_or_report_success() {
        let mut window = TestWindow::new("main", false);
        window.set_error = Some("native setter failed");
        assert_eq!(
            apply_always_on_top(&window, true).unwrap_err(),
            "native setter failed"
        );
        assert_eq!(*window.calls.borrow(), ["set:true"]);
        assert!(!window.state.get());
    }

    #[test]
    fn readback_error_is_not_replaced_with_the_requested_value() {
        let mut window = TestWindow::new("main", false);
        window.read_error = Some("native readback failed");
        assert_eq!(
            apply_always_on_top(&window, true).unwrap_err(),
            "native readback failed"
        );
        assert_eq!(*window.calls.borrow(), ["set:true", "read"]);
        // A failed read does not imply that the earlier native setter rolled back.
        assert!(window.state.get());
    }

    #[test]
    fn unchanged_native_state_cannot_be_reported_as_success() {
        for enabled in [true, false] {
            let mut window = TestWindow::new("main", !enabled);
            window.ignore_set = true;
            assert!(apply_always_on_top(&window, enabled).is_err());
            assert_eq!(window.state.get(), !enabled);
            assert_eq!(window.calls.borrow().last().unwrap(), "read");
        }
    }

    #[test]
    fn response_contains_the_confirmed_state_in_the_wire_format() {
        for enabled in [false, true] {
            let window = TestWindow::new("main", !enabled);
            let result = apply_always_on_top(&window, enabled).unwrap();
            assert_eq!(
                serde_json::to_value(result).unwrap(),
                serde_json::json!({"ok": true, "alwaysOnTop": enabled})
            );
        }
    }

    #[test]
    fn preferences_are_written_only_after_confirmed_native_changes() {
        let window = TestWindow::new("main", false);
        let stored = Cell::new(false);
        for enabled in [true, false] {
            apply_and_persist_always_on_top(&window, enabled, |confirmed| {
                assert_eq!(window.state.get(), confirmed);
                assert_eq!(window.calls.borrow().last().unwrap(), "read");
                stored.set(confirmed);
                Ok(())
            })
            .unwrap();
            assert_eq!(stored.get(), enabled);
        }
    }

    #[test]
    fn denied_or_unconfirmed_changes_do_not_write_preferences() {
        for failure in ["caller", "setter", "readback", "mismatch"] {
            let mut window = TestWindow::new("main", false);
            match failure {
                "caller" => window.label = "pip",
                "setter" => window.set_error = Some("setter failed"),
                "readback" => window.read_error = Some("readback failed"),
                "mismatch" => window.ignore_set = true,
                _ => unreachable!(),
            }
            let written = Cell::new(false);
            assert!(apply_and_persist_always_on_top(&window, true, |_| {
                written.set(true);
                Ok(())
            })
            .is_err());
            assert!(!written.get(), "{failure}");
        }
    }

    #[test]
    fn persistence_error_is_not_reported_as_success() {
        let window = TestWindow::new("main", false);
        let result = apply_and_persist_always_on_top(&window, true, |_| {
            Err("preference write failed".into())
        });
        assert_eq!(result.unwrap_err(), "preference write failed");
        // Persistence failure does not pretend to roll back the native setter.
        assert!(window.state.get());
    }

    #[test]
    fn capability_is_main_only_and_does_not_expand_allowed_origins() {
        let controls: serde_json::Value =
            serde_json::from_str(include_str!("../../capabilities/main-window-controls.json"))
                .unwrap();
        let default: serde_json::Value =
            serde_json::from_str(include_str!("../../capabilities/default.json")).unwrap();
        assert_eq!(controls["windows"], serde_json::json!(["main"]));
        assert_eq!(
            controls["platforms"],
            serde_json::json!(["linux", "macOS", "windows"])
        );
        assert_eq!(
            controls["permissions"],
            serde_json::json!([
                "allow-set-always-on-top",
                "allow-set-fullscreen",
                "allow-toggle-fullscreen",
                "allow-window-aspect-lock"
            ])
        );
        assert_eq!(controls["remote"], default["remote"]);
        assert!(controls.get("webviews").is_none());
        assert!(!default["permissions"]
            .as_array()
            .unwrap()
            .iter()
            .any(|permission| {
                permission == "allow-window-aspect-lock"
                    || permission == "allow-set-always-on-top"
                    || permission == "allow-set-fullscreen"
                    || permission == "allow-toggle-fullscreen"
                    || permission == "core:window:allow-set-always-on-top"
            }));
    }
}
