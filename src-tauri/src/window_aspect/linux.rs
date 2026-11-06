pub fn apply(
    window: &tauri::Window,
    enabled: Option<bool>,
) -> Result<Option<(bool, bool)>, String> {
    if window.label() != "main" {
        return Err("Aspect control is restricted to the main window".into());
    }
    let gtk_window = window.gtk_window().map_err(|error| error.to_string())?;
    // Tao owns the complete GTK hints, including subsequent min/max changes.
    // Initial size normalization is intentional; Wayland stays unsupported.
    tao::platform::unix::gtk_window_aspect_lock(&gtk_window, enabled)
}
