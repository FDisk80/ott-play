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
}
thread_local! { static WINDOWS:RefCell<HashMap<usize,State>>=RefCell::new(HashMap::new()); }
fn same_size(left: NSSize, right: NSSize) -> bool {
    left.width == right.width && left.height == right.height
}
fn maximized(native: &NSWindow) -> bool {
    // Match Tao's borderless maximize path; raw AppKit zoom depends on aspect.
    let required = NSWindowStyleMask::Titled | NSWindowStyleMask::Resizable;
    if !native.styleMask().contains(required) {
        if let Some(screen) = native.screen() {
            let frame = native.frame();
            let visible = screen.visibleFrame();
            return (frame.size.width - visible.size.width).abs() < 1.0
                && (frame.size.height - visible.size.height).abs() < 1.0;
        }
    }
    native.isZoomed()
}
fn refresh(key: usize) -> Result<(bool, bool), String> {
    MainThreadMarker::new().ok_or("Aspect constraint requires the AppKit thread")?;
    let state = WINDOWS
        .with(|all| all.borrow().get(&key).cloned())
        .ok_or("Aspect window unavailable")?;
    // Retain the NSWindow until Destroyed; queued state callbacks cannot dereference a released pointer.
    let native = &state.native;
    let active = state.enabled
        && !crate::commands::tauri_commands::macos_simple_fullscreen_active()
        && !maximized(native)
        && !native.isMiniaturized()
        && !native.styleMask().contains(NSWindowStyleMask::FullScreen);
    let expected = if active {
        NSSize::new(16.0, 9.0)
    } else {
        state.previous
    };
    // Style changes can clear native constraints without changing our requested
    // state. Reconcile the actual constraint, not a cached active bit.
    if !same_size(native.contentAspectRatio(), expected)
        || (!active && !same_size(native.contentResizeIncrements(), state.increments))
    {
        if active {
            native.setContentAspectRatio(NSSize::new(16.0, 9.0));
        } else {
            // Increment mode clears the aspect constraint without installing a zero ratio.
            native.setContentResizeIncrements(state.increments);
            if state.previous.width > 0.0 && state.previous.height > 0.0 {
                native.setContentAspectRatio(state.previous);
            }
        }
    }
    if !same_size(native.contentAspectRatio(), expected)
        || (!active && !same_size(native.contentResizeIncrements(), state.increments))
    {
        return Err("AppKit aspect constraint readback failed".into());
    }
    Ok((state.enabled, active))
}
pub(super) fn reconcile_initialized(window: &tauri::Window) -> Result<(), String> {
    MainThreadMarker::new().ok_or("Aspect constraint requires the AppKit thread")?;
    if WINDOWS.with(|all| all.borrow().is_empty()) {
        return Ok(());
    }
    let key = window.ns_window().map_err(|e| e.to_string())? as usize;
    if WINDOWS.with(|all| all.borrow().contains_key(&key)) {
        refresh(key)?;
    }
    Ok(())
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
                },
            )
        });
        window.on_window_event(move |event| {
            let destroyed = matches!(event, tauri::WindowEvent::Destroyed);
            // Tauri runs main-thread tasks inline. Defer native state observation
            // until the current callback returns instead of refreshing inside it.
            dispatch2::DispatchQueue::main().exec_async(move || {
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
