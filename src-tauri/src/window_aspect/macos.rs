use objc2::{rc::Retained, MainThreadMarker};
use objc2_app_kit::{NSWindow, NSWindowStyleMask};
use objc2_foundation::NSSize;
use std::{cell::RefCell, collections::HashMap};
#[derive(Clone)]
struct State {
    native: Retained<NSWindow>,
    previous: NSSize,
    increments: NSSize,
    enabled: bool,
    active: bool,
}
thread_local! { static WINDOWS:RefCell<HashMap<usize,State>>=RefCell::new(HashMap::new()); }
fn refresh(key: usize) -> Result<(bool, bool), String> {
    MainThreadMarker::new().ok_or("Aspect constraint requires the AppKit thread")?;
    let state = WINDOWS
        .with(|all| all.borrow().get(&key).cloned())
        .ok_or("Aspect window unavailable")?;
    // Retain the NSWindow until Destroyed; queued state callbacks cannot dereference a released pointer.
    let native = &state.native;
    let active = state.enabled
        && !native.isZoomed()
        && !native.isMiniaturized()
        && !native.styleMask().contains(NSWindowStyleMask::FullScreen);
    if active != state.active {
        if active {
            native.setContentAspectRatio(NSSize::new(16.0, 9.0));
        } else {
            native.setContentAspectRatio(NSSize::new(0.0, 0.0));
            native.setContentResizeIncrements(state.increments);
            if state.previous.width > 0.0 && state.previous.height > 0.0 {
                native.setContentAspectRatio(state.previous);
            }
        }
    }
    let actual = native.contentAspectRatio();
    let expected = if active {
        NSSize::new(16.0, 9.0)
    } else {
        state.previous
    };
    if actual.width != expected.width || actual.height != expected.height {
        return Err("AppKit aspect constraint readback failed".into());
    }
    WINDOWS.with(|all| {
        if let Some(value) = all.borrow_mut().get_mut(&key) {
            value.active = active;
        }
    });
    Ok((state.enabled, active))
}
pub fn apply(window: &tauri::Window, enabled: Option<bool>) -> Result<(bool, bool), String> {
    MainThreadMarker::new().ok_or("Aspect constraint requires the AppKit thread")?;
    let key = window.ns_window().map_err(|e| e.to_string())? as usize;
    if key == 0 {
        return Err("Native window unavailable".into());
    }
    let fresh = WINDOWS.with(|all| !all.borrow().contains_key(&key));
    if fresh {
        let native =
            unsafe { Retained::retain(key as *mut NSWindow) }.ok_or("Native window unavailable")?;
        WINDOWS.with(|all| {
            all.borrow_mut().insert(
                key,
                State {
                    previous: native.contentAspectRatio(),
                    increments: native.contentResizeIncrements(),
                    native,
                    enabled: false,
                    active: false,
                },
            )
        });
        let dispatcher = window.clone();
        window.on_window_event(move |event| {
            let destroyed = matches!(event, tauri::WindowEvent::Destroyed);
            let _ = dispatcher.run_on_main_thread(move || {
                if destroyed {
                    WINDOWS.with(|all| all.borrow_mut().remove(&key));
                } else if let Err(error) = refresh(key) {
                    tracing::warn!(%error,"Aspect constraint refresh failed");
                }
            });
        });
    }
    if let Some(enabled) = enabled {
        WINDOWS.with(|all| all.borrow_mut().get_mut(&key).unwrap().enabled = enabled);
    }
    refresh(key)
}
