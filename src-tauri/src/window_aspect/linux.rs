pub fn apply(
    _window: &tauri::Window,
    _enabled: Option<bool>,
) -> Result<Option<(bool, bool)>, String> {
    // GTK/X11 aspect hints can resize the current window when enabled. Neither
    // GTK backend has a qualified interactive-only constraint path, so preserve
    // current/restored geometry and leave any saved preference untouched.
    Ok(None)
}
