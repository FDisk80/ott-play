//! Main-window native interactive resize constraint. This makes no explicit
//! current-window resize request and does not alter video geometry or PiP.
#[cfg(any(target_os = "windows", test))]
mod geometry;
#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

#[derive(Default)]
pub struct WindowAspectLock(tokio::sync::Mutex<bool>);

/// `active` means the native interactive constraint is armed in the current
/// native state. It does not assert that the current/restored pixels are 16:9.
#[derive(Debug, PartialEq, serde::Serialize)]
pub struct AspectState {
    pub ok: bool,
    pub supported: bool,
    pub enabled: bool,
    pub active: bool,
}

fn main_only(label: &str) -> Result<(), String> {
    if label != "main" {
        return Err("Aspect control is restricted to the main window".into());
    }
    Ok(())
}

fn state(value: Option<(bool, bool)>) -> AspectState {
    let (enabled, active) = value.unwrap_or((false, false));
    AspectState {
        ok: true,
        supported: value.is_some(),
        enabled,
        active,
    }
}

async fn native(window: &tauri::Window, enabled: Option<bool>) -> Result<AspectState, String> {
    main_only(window.label())?;
    let (sender, receiver) = tokio::sync::oneshot::channel();
    let target = window.clone();
    window
        .run_on_main_thread(move || {
            #[cfg(target_os = "macos")]
            let result = macos::apply(&target, enabled).map(Some);
            #[cfg(target_os = "windows")]
            let result = windows::apply(&target, enabled).map(Some);
            #[cfg(target_os = "linux")]
            let result = linux::apply(&target, enabled);
            #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
            let result: Result<Option<(bool, bool)>, String> = {
                let _ = (target, enabled);
                Ok(None)
            };
            let _ = sender.send(result.map(state));
        })
        .map_err(|error| error.to_string())?;
    receiver
        .await
        .map_err(|_| "Native aspect operation unavailable".to_owned())?
}

async fn restore(
    app: &tauri::AppHandle,
    window: &tauri::Window,
    initialized: &mut bool,
) -> Result<(), String> {
    if !*initialized {
        main_only(window.label())?;
        let enabled = crate::instance::app_data_dir(app)
            .map_err(std::io::Error::other)
            .and_then(|root| crate::window_preferences::read_aspect_lock(&root))
            .unwrap_or_else(|_| {
                tracing::warn!("Aspect preference unavailable; using normal window state");
                false
            });
        native(window, Some(enabled)).await?;
        *initialized = true;
    }
    Ok(())
}

/// Called after the main window and the window-state plugin's restore exist.
pub async fn initialize(app: tauri::AppHandle, window: tauri::Window) -> Result<(), String> {
    use tauri::Manager;
    let persistence = app.state::<WindowAspectLock>();
    let mut initialized = persistence.0.lock().await;
    restore(&app, &window, &mut initialized).await
}

/// Reconcile only an already initialized main-window constraint after the
/// fullscreen owner's native style/geometry barriers. Never load or save a
/// preference here. The normal caller is the async fullscreen command thread.
#[cfg(target_os = "macos")]
pub(crate) fn reconcile_initialized_after_fullscreen(window: &tauri::Window) -> Result<(), String> {
    if window.label() != "main" {
        return Ok(());
    }
    if objc2::MainThreadMarker::new().is_some() {
        return macos::reconcile_initialized(window);
    }
    let target = window.clone();
    let mut result = Ok(());
    let result_slot = &mut result;
    dispatch2::DispatchQueue::main().exec_sync(move || {
        *result_slot = macos::reconcile_initialized(&target);
    });
    result
}

#[tauri::command]
pub async fn get_window_aspect_lock(
    app: tauri::AppHandle,
    window: tauri::Window,
    persistence: tauri::State<'_, WindowAspectLock>,
) -> Result<AspectState, String> {
    main_only(window.label())?;
    let mut initialized = persistence.0.lock().await;
    restore(&app, &window, &mut initialized).await?;
    native(&window, None).await
}

fn persist_confirmed(
    result: AspectState,
    requested: bool,
    persist: impl FnOnce(bool) -> Result<(), String>,
) -> Result<AspectState, String> {
    if !result.supported {
        return Err("Native aspect constraint is unavailable on this backend".into());
    }
    if !result.ok || result.enabled != requested {
        return Err("Native aspect constraint did not confirm the requested state".into());
    }
    persist(result.enabled)?;
    Ok(result)
}

#[tauri::command]
pub async fn set_window_aspect_lock(
    app: tauri::AppHandle,
    window: tauri::Window,
    persistence: tauri::State<'_, WindowAspectLock>,
    enabled: bool,
) -> Result<AspectState, String> {
    main_only(window.label())?;
    let mut initialized = persistence.0.lock().await;
    restore(&app, &window, &mut initialized).await?;
    let root = crate::instance::app_data_dir(&app)?;
    let result = native(&window, Some(enabled)).await?;
    persist_confirmed(result, enabled, |confirmed| {
        crate::window_preferences::write_aspect_lock(&root, confirmed).map_err(|_| {
            "The native constraint changed, but its preference could not be saved".into()
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_main_can_reach_native_or_preference_operations() {
        assert!(main_only("main").is_ok());
        for label in ["pip", "", "MAIN", "main/child", "other"] {
            assert!(main_only(label).is_err());
        }
    }
    #[test]
    fn unsupported_or_unconfirmed_state_never_persists() {
        for value in [None, Some((false, false))] {
            assert!(persist_confirmed(state(value), true, |_| panic!("must not persist")).is_err());
        }
    }
    #[test]
    fn suspended_constraint_retains_enabled_preference_and_exact_wire_state() {
        let result = persist_confirmed(state(Some((true, false))), true, |value| {
            assert!(value);
            Ok(())
        })
        .unwrap();
        assert_eq!(
            serde_json::to_value(result).unwrap(),
            serde_json::json!({
                "ok": true, "supported": true, "enabled": true, "active": false
            })
        );
        assert_eq!(
            serde_json::to_value(state(None)).unwrap(),
            serde_json::json!({
                "ok": true, "supported": false, "enabled": false, "active": false
            })
        );
    }
    #[test]
    fn persistence_failure_is_not_a_confirmed_success() {
        assert_eq!(
            persist_confirmed(state(Some((true, true))), true, |_| Err(
                "disk failure".into()
            ))
            .unwrap_err(),
            "disk failure"
        );
    }
}
