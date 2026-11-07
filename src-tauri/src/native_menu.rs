//! Keep the native Window menu, but route Zoom through Tauri's borderless path.

use tauri::menu::{Menu, MenuEvent, MenuItem, WINDOW_SUBMENU_ID};
use tauri::{AppHandle, Manager, Runtime, Window, WindowEvent};

const ZOOM_ID: &str = "ott.window.zoom";

pub(crate) fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let menu = Menu::default(app)?;
    let invalid_menu = || std::io::Error::other("Default Window menu has no expected Zoom item");
    let window_item = menu.get(WINDOW_SUBMENU_ID).ok_or_else(invalid_menu)?;
    let window_menu = window_item.as_submenu().ok_or_else(invalid_menu)?;
    let items = window_menu.items()?;
    // Tauri 2.11's default Window menu is Minimize, Zoom, separator, Close.
    // Preserve its submenu identity and every other native role/accelerator.
    let zoom = items
        .get(1)
        .and_then(|item| item.as_predefined_menuitem())
        .ok_or_else(invalid_menu)?;
    let label = zoom.text()?;
    if label != "Zoom" {
        return Err(invalid_menu().into());
    }
    let replacement = MenuItem::with_id(app, ZOOM_ID, label, false, None::<&str>)?;
    window_menu.remove_at(1)?;
    window_menu.insert(&replacement, 1)?;
    Ok(menu)
}

#[derive(Clone, Copy, Debug)]
struct ZoomState {
    main: bool,
    focused: bool,
    visible: bool,
    minimized: bool,
    fullscreen: bool,
    resizable: bool,
    decorated: bool,
    maximizable: bool,
    maximized: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ZoomAction {
    Maximize,
    Restore,
}

impl ZoomState {
    fn action(self) -> Option<ZoomAction> {
        if !self.main
            || !self.focused
            || !self.visible
            || self.minimized
            || self.fullscreen
            || !self.resizable
        {
            None
        } else if self.maximized {
            Some(ZoomAction::Restore)
        } else if !self.decorated || self.maximizable {
            Some(ZoomAction::Maximize)
        } else {
            None
        }
    }
}

trait ZoomTarget {
    fn zoom_state(&self) -> tauri::Result<ZoomState>;
    fn apply_zoom(&self, action: ZoomAction) -> tauri::Result<()>;
}

impl<R: Runtime> ZoomTarget for Window<R> {
    fn zoom_state(&self) -> tauri::Result<ZoomState> {
        let decorated = self.is_decorated()?;
        Ok(ZoomState {
            main: self.label() == "main",
            focused: self.is_focused()?,
            visible: self.is_visible()?,
            minimized: self.is_minimized()?,
            fullscreen: self.is_fullscreen()?
                || crate::commands::tauri_commands::macos_simple_fullscreen_active(),
            resizable: self.is_resizable()?,
            decorated,
            // On macOS Tao's is_maximizable only observes the native zoom
            // button. Our borderless main has no button; its resizable policy
            // still permits the programmatic maximize path.
            maximizable: decorated && self.is_maximizable()?,
            maximized: self.is_maximized()?,
        })
    }

    fn apply_zoom(&self, action: ZoomAction) -> tauri::Result<()> {
        match action {
            ZoomAction::Maximize => self.maximize(),
            ZoomAction::Restore => self.unmaximize(),
        }
    }
}

fn dispatch(id: &str, target: &impl ZoomTarget) -> tauri::Result<()> {
    if id == ZOOM_ID {
        // Re-observe the target at activation: the enabled item may be stale
        // after focus moved to PiP or a fullscreen transition began.
        if let Some(action) = target.zoom_state()?.action() {
            target.apply_zoom(action)?;
        }
    }
    Ok(())
}

pub(crate) fn handle<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    if event.id().as_ref() != ZOOM_ID {
        return;
    }
    if let Some(webview) = app.get_webview_window("main") {
        let window: Window<R> = webview.as_ref().window();
        if let Err(error) = dispatch(ZOOM_ID, &window) {
            tracing::warn!(%error, "Native Window Zoom failed");
        }
    }
    refresh(app);
}

pub(crate) fn refresh<R: Runtime>(app: &AppHandle<R>) {
    let enabled = app
        .get_webview_window("main")
        .and_then(|webview| {
            let window: Window<R> = webview.as_ref().window();
            window.zoom_state().ok()
        })
        .and_then(ZoomState::action)
        .is_some();
    let Some(menu) = app.menu() else { return };
    let Some(window_item) = menu.get(WINDOW_SUBMENU_ID) else {
        return;
    };
    let Some(window_menu) = window_item.as_submenu() else {
        return;
    };
    if let Some(item) = window_menu.get(ZOOM_ID) {
        if let Some(item) = item.as_menuitem() {
            if let Err(error) = item.set_enabled(enabled) {
                tracing::warn!(%error, "Native Window Zoom availability update failed");
            }
        }
    }
}

// Called after fullscreen intent and native style/focus have committed. Keep
// the final menu refresh after constraint reconciliation, even when restoring
// the same frame and focus produces no further window event.
pub(crate) fn finish_fullscreen_transition(
    reconcile: impl FnOnce() -> Result<(), String>,
    refresh_menu: impl FnOnce(),
) -> Result<(), String> {
    reconcile()?;
    refresh_menu();
    Ok(())
}

pub(crate) fn on_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if matches!(
        event,
        WindowEvent::Focused(_)
            | WindowEvent::Resized(_)
            | WindowEvent::Moved(_)
            | WindowEvent::Destroyed
    ) {
        let app = window.app_handle().clone();
        // Read after AppKit has committed the focus/geometry transition.
        dispatch2::Queue::main().exec_async(move || refresh(&app));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::{Cell, RefCell};

    struct Target {
        state: Cell<ZoomState>,
        reads: Cell<usize>,
        actions: RefCell<Vec<ZoomAction>>,
        fail_read: Cell<bool>,
        fail_action: Cell<bool>,
    }

    impl Target {
        fn new() -> Self {
            Self {
                state: Cell::new(ZoomState {
                    main: true,
                    focused: true,
                    visible: true,
                    minimized: false,
                    fullscreen: false,
                    resizable: true,
                    decorated: false,
                    maximizable: false,
                    maximized: false,
                }),
                reads: Cell::new(0),
                actions: RefCell::new(Vec::new()),
                fail_read: Cell::new(false),
                fail_action: Cell::new(false),
            }
        }
    }

    impl ZoomTarget for Target {
        fn zoom_state(&self) -> tauri::Result<ZoomState> {
            self.reads.set(self.reads.get() + 1);
            if self.fail_read.get() {
                return Err(std::io::Error::other("read failed").into());
            }
            Ok(self.state.get())
        }

        fn apply_zoom(&self, action: ZoomAction) -> tauri::Result<()> {
            if self.fail_action.get() {
                return Err(std::io::Error::other("mutation failed").into());
            }
            self.actions.borrow_mut().push(action);
            let mut state = self.state.get();
            state.maximized = action == ZoomAction::Maximize;
            self.state.set(state);
            Ok(())
        }
    }

    #[test]
    fn zoom_reobserves_and_restores_instead_of_repeating_maximize() {
        let target = Target::new();
        dispatch(ZOOM_ID, &target).unwrap();
        // Restore stays available even if maximizing has since been disabled.
        let mut state = target.state.get();
        state.decorated = true;
        state.maximizable = false;
        target.state.set(state);
        dispatch(ZOOM_ID, &target).unwrap();
        assert_eq!(target.reads.get(), 2);
        assert_eq!(
            *target.actions.borrow(),
            [ZoomAction::Maximize, ZoomAction::Restore]
        );
    }

    #[test]
    fn stale_enabled_menu_cannot_mutate_an_ineligible_window() {
        let target = Target::new();
        let enabled_state = target.state.get();
        assert_eq!(enabled_state.action(), Some(ZoomAction::Maximize));
        for state in [
            ZoomState {
                main: false,
                ..enabled_state
            },
            ZoomState {
                focused: false,
                ..enabled_state
            },
            ZoomState {
                visible: false,
                ..enabled_state
            },
            ZoomState {
                minimized: true,
                ..enabled_state
            },
            ZoomState {
                fullscreen: true,
                ..enabled_state
            },
            ZoomState {
                resizable: false,
                ..enabled_state
            },
            ZoomState {
                decorated: true,
                maximizable: false,
                ..enabled_state
            },
        ] {
            target.state.set(state);
            dispatch(ZOOM_ID, &target).unwrap();
        }
        assert_eq!(target.reads.get(), 7);
        assert!(target.actions.borrow().is_empty());
    }

    #[test]
    fn borderless_main_does_not_require_a_native_zoom_button() {
        let borderless = Target::new();
        assert!(!borderless.state.get().decorated);
        assert!(!borderless.state.get().maximizable);
        dispatch(ZOOM_ID, &borderless).unwrap();
        assert_eq!(*borderless.actions.borrow(), [ZoomAction::Maximize]);

        let decorated = Target::new();
        let mut state = decorated.state.get();
        state.decorated = true;
        decorated.state.set(state);
        dispatch(ZOOM_ID, &decorated).unwrap();
        assert!(decorated.actions.borrow().is_empty());
        state.maximizable = true;
        decorated.state.set(state);
        dispatch(ZOOM_ID, &decorated).unwrap();
        assert_eq!(*decorated.actions.borrow(), [ZoomAction::Maximize]);
    }

    #[test]
    fn fullscreen_commit_refreshes_stale_eligibility_without_another_window_event() {
        let target = Target::new();
        let mut state = target.state.get();
        state.fullscreen = true;
        state.resizable = false;
        target.state.set(state);
        let cached_enabled = Cell::new(false);
        let refresh_menu = || cached_enabled.set(target.zoom_state().unwrap().action().is_some());

        // The last window-event refresh ran before fullscreen exit committed.
        refresh_menu();
        assert!(!cached_enabled.get());
        state.fullscreen = false;
        state.resizable = true;
        target.state.set(state);

        finish_fullscreen_transition(
            || {
                // Constraint reconciliation must complete before availability
                // is published, with no extra focus or resize event required.
                assert!(!cached_enabled.get());
                Ok(())
            },
            refresh_menu,
        )
        .unwrap();

        assert!(cached_enabled.get());
        assert_eq!(target.reads.get(), 2);
        assert!(target.actions.borrow().is_empty());
    }

    #[test]
    fn failed_fullscreen_reconciliation_does_not_publish_menu_completion() {
        let target = Target::new();
        let cached_enabled = Cell::new(false);
        let result = finish_fullscreen_transition(
            || Err("constraint reconciliation failed".to_owned()),
            || cached_enabled.set(target.zoom_state().unwrap().action().is_some()),
        );
        assert_eq!(result, Err("constraint reconciliation failed".to_owned()));
        assert!(!cached_enabled.get());
        assert_eq!(target.reads.get(), 0);
    }

    #[test]
    fn unrelated_native_menu_roles_are_not_dispatched() {
        let target = Target::new();
        dispatch("close", &target).unwrap();
        assert_eq!(target.reads.get(), 0);
        assert!(target.actions.borrow().is_empty());
    }

    #[test]
    fn failed_queries_and_mutations_do_not_report_success() {
        let target = Target::new();
        target.fail_read.set(true);
        assert!(dispatch(ZOOM_ID, &target).is_err());
        assert!(target.actions.borrow().is_empty());
        target.fail_read.set(false);
        target.fail_action.set(true);
        assert!(dispatch(ZOOM_ID, &target).is_err());
        assert!(target.actions.borrow().is_empty());
    }
}
