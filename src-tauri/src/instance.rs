//! Multi-instance data isolation for desktop Tauri shells.
//!
//! macOS WKWebView ignores `$HOME` overrides and always keys the default
//! `WKWebsiteDataStore` / `NSSearchPath` dirs off the real home + bundle id
//! (`com.ottplay.foss`). Queue ports already isolate via `OTTPLAY_QUEUE_PORT`.
//!
//! Prefer `OTTPLAY_DATA_DIR` (absolute). Else `OTTPLAY_INSTANCE` (e.g. `2`)
//! → `~/Library/Application Support/com.ottplay.foss.<instance>` (and the
//! matching webview data directory under that tree). Unset → identical to
//! stock Tauri paths.
//!
//! Webview remote state (localStorage / cookies): `data_directory` on
//! Win/Linux; on macOS 14+ also a stable `data_store_identifier` UUID derived
//! from the data dir (WKWebView has no path-based store API).

#[cfg(any(target_os = "windows", test))]
use std::fs;
use std::path::{Path, PathBuf};

use tauri::{Manager, Runtime, WebviewWindowBuilder};

/// Bundle identifier from `tauri.conf.json` — keep in sync when renaming.
pub const BUNDLE_ID: &str = "com.ottplay.foss";

/// Resolve the isolated app-data root, if either env var is set.
///
/// - `OTTPLAY_DATA_DIR` (absolute) wins when set.
/// - else `OTTPLAY_INSTANCE` → `<platform data dir>/{BUNDLE_ID}.<instance>`.
/// - else `None` (callers keep stock `app.path().app_data_dir()`).
pub fn resolve_data_dir() -> Option<PathBuf> {
    if let Ok(raw) = std::env::var("OTTPLAY_DATA_DIR") {
        let trimmed = raw.trim();
        if !trimmed.is_empty() {
            let path = PathBuf::from(trimmed);
            if path.is_absolute() {
                return Some(path);
            }
            tracing::warn!(
                "OTTPLAY_DATA_DIR must be an absolute path, ignoring: {}",
                path.display()
            );
        }
    }

    if let Ok(raw) = std::env::var("OTTPLAY_INSTANCE") {
        let inst = raw.trim();
        if inst.is_empty()
            || inst.contains("..")
            || inst.contains('/')
            || inst.contains('\\')
            || inst.contains('\0')
        {
            tracing::warn!("invalid OTTPLAY_INSTANCE={raw:?}; ignoring");
            return None;
        }
        return platform_data_dir().map(|base| base.join(format!("{BUNDLE_ID}.{inst}")));
    }

    None
}

/// Slug for window-state filename / logs when isolation is active.
pub fn isolation_slug() -> Option<String> {
    if let Ok(raw) = std::env::var("OTTPLAY_DATA_DIR") {
        let trimmed = raw.trim();
        if !trimmed.is_empty() && Path::new(trimmed).is_absolute() {
            let digest = md5::compute(trimmed.as_bytes());
            let hex = format!("{:x}", digest);
            return Some(format!("dir{}", &hex[..10]));
        }
    }
    if let Ok(raw) = std::env::var("OTTPLAY_INSTANCE") {
        let inst = raw.trim();
        if !inst.is_empty()
            && !inst.contains("..")
            && !inst.contains('/')
            && !inst.contains('\\')
            && !inst.contains('\0')
        {
            return Some(format!("inst{inst}"));
        }
    }
    None
}

/// Window-state plugin filename so instances do not clobber geometry.
pub fn window_state_filename() -> Option<String> {
    isolation_slug().map(|s| format!(".window-state.{s}.json"))
}

/// Return whether the window-state plugin has a complete, nonzero geometry for
/// this window. Missing state is normal on first launch; restoring the plugin's
/// default zero-sized record onto the hidden startup window would make it unusable.
#[cfg(any(target_os = "windows", test))]
pub fn saved_window_geometry(config_dir: &Path, filename: &str, label: &str) -> Option<bool> {
    #[derive(serde::Deserialize)]
    #[allow(dead_code)]
    struct SavedWindowState {
        width: u32,
        height: u32,
        x: i32,
        y: i32,
        prev_x: i32,
        prev_y: i32,
        maximized: bool,
        visible: bool,
        decorated: bool,
        fullscreen: bool,
    }

    let states: std::collections::HashMap<String, SavedWindowState> =
        serde_json::from_slice(&fs::read(config_dir.join(filename)).ok()?).ok()?;
    let state = states.get(label)?;
    Some(state.width > 0 && state.height > 0)
}

/// Webview profile directory under the instance data root.
pub fn webview_data_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("webview")
}

/// Stable 16-byte WKWebsiteDataStore id derived from the data dir path.
pub fn data_store_identifier(data_dir: &Path) -> [u8; 16] {
    let key = format!("ottplay-foss:webview:{}", data_dir.display());
    *md5::compute(key.as_bytes())
}

/// Create app-data + webview dirs (and a WebKit-sidecar folder on macOS).
pub fn ensure_dirs(data_dir: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(data_dir)?;
    std::fs::create_dir_all(webview_data_dir(data_dir))?;
    #[cfg(target_os = "macos")]
    {
        if let Some(webkit) = webkit_sidecar_dir(data_dir) {
            std::fs::create_dir_all(&webkit)?;
        }
    }
    Ok(())
}

/// macOS: `~/Library/WebKit/com.ottplay.foss.<instance>` marker/sidecar path.
///
/// Actual WK persistent state for non-default stores lives under WebKit's
/// UUID-based WebsiteDataStore tree; this sibling dir makes instance layout
/// discoverable next to Application Support and holds optional extras.
#[cfg(target_os = "macos")]
pub fn webkit_sidecar_dir(data_dir: &Path) -> Option<PathBuf> {
    let name = data_dir.file_name()?.to_str()?;
    if !name.starts_with(BUNDLE_ID) {
        // OTTPLAY_DATA_DIR custom root: still place a WebKit folder named after
        // a stable hash so instances stay distinct.
        let digest = md5::compute(data_dir.display().to_string().as_bytes());
        let hashed = format!("{BUNDLE_ID}.{}", &format!("{:x}", digest)[..8]);
        return std::env::var_os("HOME")
            .map(|h| PathBuf::from(h).join("Library/WebKit").join(hashed));
    }
    std::env::var_os("HOME").map(|h| PathBuf::from(h).join("Library/WebKit").join(name))
}

/// Apply wry/Tauri webview isolation (path + macOS data-store UUID).
pub fn apply_isolation<'a, R: Runtime, M: tauri::Manager<R>>(
    builder: WebviewWindowBuilder<'a, R, M>,
    data_dir: &Path,
) -> WebviewWindowBuilder<'a, R, M> {
    let webview_dir = webview_data_dir(data_dir);
    let store_id = data_store_identifier(data_dir);
    builder
        .data_directory(webview_dir)
        .data_store_identifier(store_id)
}

fn platform_data_dir() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        return std::env::var_os("HOME")
            .map(|h| PathBuf::from(h).join("Library/Application Support"));
    }
    #[cfg(target_os = "windows")]
    {
        return std::env::var_os("APPDATA").map(PathBuf::from);
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        if let Some(xdg) = std::env::var_os("XDG_DATA_HOME") {
            return Some(PathBuf::from(xdg));
        }
        return std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/share"));
    }
}

/// App data dir for feedback / callers: isolated root or stock Tauri path.
pub fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Some(dir) = resolve_data_dir() {
        ensure_dirs(&dir).map_err(|e| format!("Failed to create instance data dir: {e}"))?;
        return Ok(dir);
    }
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))
}

#[cfg(test)]
mod window_geometry_tests {
    use super::saved_window_geometry;
    use std::{
        fs,
        path::PathBuf,
        sync::atomic::{AtomicU64, Ordering},
    };

    static NEXT_TEMP: AtomicU64 = AtomicU64::new(0);

    struct TempDir(PathBuf);

    impl TempDir {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "ott-window-geometry-{}-{}",
                std::process::id(),
                NEXT_TEMP.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[test]
    fn saved_geometry_requires_a_complete_nonzero_record_for_the_window() {
        let dir = TempDir::new();
        fs::write(
            dir.0.join("state.json"),
            br#"{"main":{"width":1280,"height":720,"x":14,"y":22,"prev_x":14,"prev_y":22,"maximized":false,"visible":false,"decorated":false,"fullscreen":false},"pip":{"width":640,"height":360,"x":4,"y":8,"prev_x":4,"prev_y":8,"maximized":false,"visible":true,"decorated":true,"fullscreen":false}}"#,
        )
        .unwrap();
        assert_eq!(
            saved_window_geometry(&dir.0, "state.json", "main"),
            Some(true)
        );
        assert_eq!(
            saved_window_geometry(&dir.0, "state.json", "pip"),
            Some(true)
        );
        assert_eq!(saved_window_geometry(&dir.0, "state.json", "missing"), None);

        fs::write(
            dir.0.join("zero.json"),
            br#"{"main":{"width":0,"height":720,"x":0,"y":0,"prev_x":0,"prev_y":0,"maximized":false,"visible":false,"decorated":false,"fullscreen":false}}"#,
        )
        .unwrap();
        assert_eq!(
            saved_window_geometry(&dir.0, "zero.json", "main"),
            Some(false)
        );
    }

    #[test]
    fn missing_or_incomplete_geometry_is_unavailable() {
        let dir = TempDir::new();
        assert_eq!(saved_window_geometry(&dir.0, "missing.json", "main"), None);
        fs::write(dir.0.join("malformed.json"), b"not json").unwrap();
        assert_eq!(
            saved_window_geometry(&dir.0, "malformed.json", "main"),
            None
        );
        fs::write(
            dir.0.join("incomplete.json"),
            br#"{"main":{"width":1280,"height":720}}"#,
        )
        .unwrap();
        assert_eq!(
            saved_window_geometry(&dir.0, "incomplete.json", "main"),
            None
        );
    }
}
