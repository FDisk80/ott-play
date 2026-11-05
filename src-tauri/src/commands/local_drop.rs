//! OS-owned single-file drop capabilities. No command accepts a filesystem path.
use super::offline_media::{self, OfflineMediaState};
use ottplay_core::offline_media::{Catalog, TransientVideo};
use serde::Serialize;
#[cfg(any(target_os = "windows", target_os = "linux", test))]
use std::ffi::OsString;
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager, State};

const DROP_LIFETIME: Duration = Duration::from_secs(30);
const STALE: &str = "Local drop expired or was already consumed";

struct Pending {
    grant: String,
    path: PathBuf,
    page: u64,
    expires: Instant,
    ready: bool,
}
struct Slots<T> {
    page: u64,
    page_ready: bool,
    queued: Option<PathBuf>,
    pending: Option<Pending>,
    issued: HashMap<String, T>,
    // A cancelled page/released pending grant cannot start more filesystem work
    // until its previous operation drains. This is independent of UI ownership.
    flight: Option<String>,
}
impl<T> Default for Slots<T> {
    fn default() -> Self {
        Self {
            page: 1,
            page_ready: false,
            queued: None,
            pending: None,
            issued: HashMap::new(),
            flight: None,
        }
    }
}
impl<T> Slots<T> {
    fn accept(&mut self, paths: &[PathBuf], now: Instant) -> Option<String> {
        let [path] = paths else {
            return None;
        };
        if !supported_path(path)
            || self.page == 0
            || self.flight.is_some()
            || self.issued.len() >= 2
        {
            return None;
        }
        if !self.page_ready {
            // Keep the latest valid OS intent across initial navigation. No
            // filesystem probe starts until the page listener and its startup
            // provider generation are ready; malformed input cannot replace it.
            self.queued = Some(path.clone());
            return None;
        }
        self.reserve(paths, now)
    }
    fn page_ready(&mut self) -> Option<PathBuf> {
        if self.page == 0 {
            return None;
        }
        self.page_ready = true;
        self.queued.take()
    }
    fn reserve(&mut self, paths: &[PathBuf], now: Instant) -> Option<String> {
        let [path] = paths else {
            return None;
        };
        if self.page == 0
            || self.flight.is_some()
            || self.issued.len() >= 2
            || !supported_path(path)
            || self.pending.as_ref().is_some_and(|p| now < p.expires)
        {
            return None;
        }
        let grant = format!(
            "{}{}",
            uuid::Uuid::new_v4().simple(),
            uuid::Uuid::new_v4().simple()
        );
        self.pending = Some(Pending {
            grant: grant.clone(),
            path: path.clone(),
            page: self.page,
            expires: now + DROP_LIFETIME,
            ready: false,
        });
        self.flight = Some(grant.clone());
        Some(grant)
    }
    fn ready(&mut self, grant: &str, now: Instant) -> bool {
        if self.flight.as_deref() != Some(grant) {
            return false;
        }
        self.flight = None;
        if let Some(p) = self.pending.as_mut() {
            if p.grant == grant && p.page == self.page && now < p.expires {
                p.ready = true;
                return true;
            }
        }
        self.reject(grant);
        false
    }
    fn start(&mut self, grant: &str, now: Instant) -> Result<PathBuf, &'static str> {
        if self.flight.is_some() {
            return Err(STALE);
        }
        let p = self.pending.as_ref().ok_or(STALE)?;
        if !p.ready || p.grant != grant || p.page != self.page || now >= p.expires {
            return Err(STALE);
        }
        self.flight = Some(grant.into());
        Ok(p.path.clone())
    }
    fn finish(&mut self, grant: &str, value: T, now: Instant) -> Result<(), &'static str> {
        let valid = self.flight.as_deref() == Some(grant)
            && self
                .pending
                .as_ref()
                .is_some_and(|p| p.grant == grant && p.page == self.page && now < p.expires);
        if !valid || self.issued.len() >= 2 {
            return Err(STALE);
        }
        self.flight = None;
        self.pending = None;
        self.issued.insert(grant.into(), value);
        Ok(())
    }
    fn reject(&mut self, grant: &str) {
        if self.flight.as_deref() == Some(grant) {
            self.flight = None;
        }
        if self.pending.as_ref().is_some_and(|p| p.grant == grant) {
            self.pending = None;
        }
    }
    fn release(&mut self, grant: &str) -> Option<T> {
        if self.pending.as_ref().is_some_and(|p| p.grant == grant) {
            self.pending = None;
        }
        // Keep flight latched until the outstanding filesystem operation drains.
        self.issued.remove(grant)
    }
    fn advance_page(&mut self) -> Vec<T> {
        self.page = self.page.checked_add(1).unwrap_or(0);
        self.page_ready = false;
        self.pending = None;
        self.issued.drain().map(|(_, value)| value).collect()
    }
}
#[derive(Default)]
pub struct LocalDropState(Mutex<Slots<TransientVideo>>);
impl LocalDropState {
    pub fn advance_page(&self) {
        let old = self
            .0
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .advance_page();
        drop(old);
    }
}
struct Flight<'a> {
    state: &'a LocalDropState,
    grant: &'a str,
    armed: bool,
}
impl<'a> Flight<'a> {
    fn new(state: &'a LocalDropState, grant: &'a str) -> Self {
        Self {
            state,
            grant,
            armed: true,
        }
    }
    fn publish_ready(&mut self, now: Instant) -> bool {
        let mut slots = self.state.0.lock().unwrap_or_else(|e| e.into_inner());
        // Validation and consumption use the same grant, but own separate
        // flights. Retire this cleanup before consumption becomes admissible.
        self.armed = false;
        slots.ready(self.grant, now)
    }
}
impl Drop for Flight<'_> {
    fn drop(&mut self) {
        if !self.armed {
            return;
        }
        let mut slots = self.state.0.lock().unwrap_or_else(|e| e.into_inner());
        if slots.flight.as_deref() == Some(self.grant) {
            slots.reject(self.grant);
        }
    }
}
#[derive(Clone, Serialize)]
struct DropEvent {
    grant: String,
}

fn supported_path(path: &std::path::Path) -> bool {
    path.is_absolute()
        && path.as_os_str().len() <= 4096
        && path
            .to_str()
            .is_some_and(|p| !p.chars().any(char::is_control))
        && path.extension().and_then(|v| v.to_str()).is_some_and(|v| {
            matches!(
                v.to_ascii_lowercase().as_str(),
                "mp4" | "m4v" | "webm" | "avi" | "mkv" | "ogv"
            )
        })
}
#[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux", test))]
fn opened_path(urls: &[url::Url]) -> Option<PathBuf> {
    let [url] = urls else {
        return None;
    };
    if url.scheme() != "file"
        || url.query().is_some()
        || url.fragment().is_some()
        || url.host_str().is_some_and(|host| host != "localhost")
    {
        return None;
    }
    let path = url.to_file_path().ok()?;
    supported_path(&path).then_some(path)
}
#[cfg(any(target_os = "windows", target_os = "linux", test))]
fn argument_path(args: &[OsString], cwd: &std::path::Path) -> Option<PathBuf> {
    let (raw, literal) = match args {
        [one] => (one, false),
        [separator, one] if separator == "--" => (one, true),
        _ => return None,
    };
    let text = raw.to_str()?;
    if !literal && text.starts_with('-') {
        return None;
    }
    let path = PathBuf::from(raw);
    // Desktop launchers may supply local file URLs (%U). They share the same
    // local-only validation as macOS Opened; other schemes are not paths.
    // Absolute native paths (including Windows drive paths) retain host syntax.
    if !path.is_absolute() && text.contains(':') {
        return opened_path(&[url::Url::parse(text).ok()?]);
    }
    if !path.is_absolute() && !cwd.is_absolute() {
        return None;
    }
    let path = if path.is_absolute() {
        path
    } else {
        cwd.join(path)
    };
    supported_path(&path).then_some(path)
}

/// Finder/Open With delivers local file URLs on both cold and warm macOS opens.
#[cfg(target_os = "macos")]
pub fn opened(app: &AppHandle, urls: &[url::Url]) {
    if let Some(path) = opened_path(urls) {
        offer(app, "main", &[path]);
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }
}
/// This is process argv, never renderer IPC. No singleton/global lock is added.
#[cfg(any(target_os = "windows", target_os = "linux"))]
pub fn initial_arguments(app: &AppHandle) {
    let args: Vec<_> = std::env::args_os().skip(1).take(3).collect();
    if let Ok(cwd) = std::env::current_dir() {
        if let Some(path) = argument_path(&args, &cwd) {
            offer(app, "main", &[path]);
        }
    }
}

fn require_main(label: &str) -> Result<(), &'static str> {
    if label == "main" {
        Ok(())
    } else {
        Err("Local drops require the main player window")
    }
}
fn valid_grant(grant: &str) -> bool {
    grant.len() == 64 && grant.bytes().all(|c| c.is_ascii_hexdigit())
}

/// Called only from Rust OS file gestures/launch arguments, never with a
/// renderer-supplied filesystem path.
pub fn offer(app: &AppHandle, label: &str, paths: &[PathBuf]) {
    if require_main(label).is_err() {
        return;
    }
    let background = app.state::<ottplay_core::background_work::BackgroundWork>();
    let Ok(work) = background.enter() else {
        return;
    };
    let state = app.state::<LocalDropState>();
    let grant = state
        .0
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .accept(paths, Instant::now());
    let Some(grant) = grant else {
        return;
    };
    let path = paths[0].clone();
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let state = app.state::<LocalDropState>();
        let mut flight = Flight::new(&state, &grant);
        // Do not synchronously probe a potentially slow filesystem on the UI
        // event thread, and do not expose directories/symlinks as video grants.
        if ottplay_core::offline_media::validate_dropped_file(path, &work)
            .await
            .is_err()
        {
            return;
        }
        let _ = work.publish(|| {
            let ready = flight.publish_ready(Instant::now());
            if ready
                && app
                    .emit_to(
                        "main",
                        "local-media-drop",
                        DropEvent {
                            grant: grant.clone(),
                        },
                    )
                    .is_err()
            {
                state
                    .0
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .reject(&grant);
            }
        });
    });
}

/// The frontend calls this after registering its opaque-grant listener and
/// starting its initial provider generation, so startup cannot replace the file.
#[tauri::command]
pub fn local_media_drop_ready(
    app: AppHandle,
    window: tauri::WebviewWindow,
    state: State<'_, LocalDropState>,
) -> Result<(), String> {
    require_main(window.label()).map_err(str::to_string)?;
    let queued = state
        .0
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .page_ready();
    if let Some(path) = queued {
        offer(&app, "main", &[path]);
    }
    Ok(())
}

#[tauri::command]
pub async fn local_media_take_drop(
    app: AppHandle,
    window: tauri::WebviewWindow,
    state: State<'_, LocalDropState>,
    media: State<'_, OfflineMediaState>,
    grant: String,
) -> Result<Catalog, String> {
    require_main(window.label()).map_err(str::to_string)?;
    if !valid_grant(&grant) {
        return Err(STALE.into());
    }
    let path = state
        .0
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .start(&grant, Instant::now())
        .map_err(str::to_string)?;
    let _flight = Flight::new(&state, &grant);
    let background = app.state::<ottplay_core::background_work::BackgroundWork>();
    let work = background.enter().map_err(str::to_string)?;
    // No catalog discovery, scanning, import, copy or persistent registration.
    let runtime = offline_media::runtime(&app, &media, None, false, false).await?;
    let video = runtime
        .library
        .transient_video(path)
        .await
        .map_err(str::to_string)?;
    let catalog = video.catalog(&runtime.endpoint).map_err(str::to_string)?;
    work.publish(|| {
        state
            .0
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .finish(&grant, video, Instant::now())
    })
    .map_err(str::to_string)?
    .map_err(str::to_string)?;
    // A successful take is not yet a successful GUI handoff. Retain the old
    // issued capability until JS releases it after accepting the replacement;
    // a post-await policy rejection releases only this newly issued grant.
    Ok(catalog)
}

#[tauri::command]
pub fn local_media_release_drop(
    window: tauri::WebviewWindow,
    state: State<'_, LocalDropState>,
    grant: String,
) -> Result<(), String> {
    require_main(window.label()).map_err(str::to_string)?;
    if !valid_grant(&grant) {
        return Err(STALE.into());
    }
    let released = state
        .0
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .release(&grant);
    drop(released);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn path() -> PathBuf {
        std::env::temp_dir().join("dropped-video.mp4")
    }
    fn ready(s: &mut Slots<u8>, now: Instant) -> String {
        let g = s.reserve(&[path()], now).unwrap();
        assert!(s.ready(&g, now));
        g
    }
    #[test]
    fn validation_guard_cannot_cancel_the_next_take_of_the_same_grant() {
        let state = LocalDropState::default();
        let now = Instant::now();
        let cancelled = state.0.lock().unwrap().reserve(&[path()], now).unwrap();
        drop(Flight::new(&state, &cancelled));
        {
            let slots = state.0.lock().unwrap();
            assert!(slots.flight.is_none() && slots.pending.is_none());
        }

        let grant = state.0.lock().unwrap().reserve(&[path()], now).unwrap();
        let mut validation = Flight::new(&state, &grant);
        assert!(validation.publish_ready(now));
        assert_eq!(state.0.lock().unwrap().start(&grant, now).unwrap(), path());
        let taking = Flight::new(&state, &grant);
        // The event consumer starts before the publishing task returns.
        drop(validation);
        {
            let mut slots = state.0.lock().unwrap();
            assert_eq!(slots.flight.as_deref(), Some(grant.as_str()));
            assert!(slots
                .pending
                .as_ref()
                .is_some_and(|p| p.grant == grant && p.ready));
            assert!(slots.reserve(&[path()], now).is_none());
        }
        // Only the current take's own cleanup may retire its flight.
        drop(taking);
        let slots = state.0.lock().unwrap();
        assert!(slots.flight.is_none() && slots.pending.is_none());
    }
    #[test]
    fn drop_rejection_and_replay_never_retire_active() {
        let mut s = Slots::default();
        let now = Instant::now();
        let a = ready(&mut s, now);
        s.start(&a, now).unwrap();
        s.finish(&a, 1, now).unwrap();
        assert!(s.start(&a, now).is_err());
        assert!(s.reserve(&[path(), path()], now).is_none());
        assert!(s
            .reserve(&[PathBuf::from("https://example.invalid/video.mp4")], now)
            .is_none());
        assert_eq!(s.issued.get(&a), Some(&1));
        let b = ready(&mut s, now);
        assert!(s.reserve(&[path()], now).is_none());
        assert_eq!(s.release(&b), None);
        assert_eq!(s.issued.get(&a), Some(&1));
        let c = ready(&mut s, now);
        s.start(&c, now).unwrap();
        s.finish(&c, 2, now).unwrap();
        assert_eq!(s.issued.get(&a), Some(&1));
        assert!(s.reserve(&[path()], now).is_none()); // no third issued capability
        assert_eq!(s.release(&a), Some(1));
        assert_eq!(s.release(&a), None);
        assert_eq!(s.issued.get(&c), Some(&2));
        assert_eq!(s.release(&c), Some(2));
    }
    #[test]
    fn gui_rejection_after_take_preserves_the_previous_video() {
        let mut s = Slots::default();
        let now = Instant::now();
        let a = ready(&mut s, now);
        s.start(&a, now).unwrap();
        s.finish(&a, 1, now).unwrap();
        let b = ready(&mut s, now);
        s.start(&b, now).unwrap();
        s.finish(&b, 2, now).unwrap();
        // Kiosk/parental ownership may change while JS awaits take. Its reject
        // cleanup must release only B, leaving A readable with its exact grant.
        assert_eq!(s.release(&b), Some(2));
        assert_eq!(s.issued.get(&a), Some(&1));
        assert_eq!(s.issued.len(), 1);
        assert_eq!(s.advance_page(), vec![1]);
        assert!(s.issued.is_empty());
    }
    #[test]
    fn page_change_and_expiry_refuse_late_completion() {
        let mut s = Slots::default();
        let now = Instant::now();
        let a = ready(&mut s, now);
        s.start(&a, now).unwrap();
        s.advance_page();
        assert!(s.reserve(&[path()], now).is_none()); // old IO still draining
        assert!(s.finish(&a, 1, now).is_err());
        s.reject(&a);
        let b = ready(&mut s, now);
        assert!(s.start(&b, now + DROP_LIFETIME).is_err());
        assert!(s.issued.is_empty());
    }
    #[test]
    fn cancelled_pending_io_cannot_reappear_or_consume_another_page() {
        let mut s = Slots::default();
        let now = Instant::now();
        let a = s.reserve(&[path()], now).unwrap();
        s.release(&a);
        assert!(!s.ready(&a, now));
        let b = ready(&mut s, now);
        assert!(s.start(&a, now).is_err());
        assert!(s.start(&b, now).is_ok());
        assert!(s.finish(&b, 1, now + DROP_LIFETIME).is_err());
        s.reject(&b);
        assert!(s.issued.is_empty());
    }
    #[test]
    fn cold_open_uses_latest_valid_intent_after_startup_readiness_once() {
        let mut s: Slots<u8> = Slots::default();
        let now = Instant::now();
        let first = path();
        let second = first.with_file_name("second.mp4");
        assert!(s.accept(&[first.clone()], now).is_none());
        assert!(s.flight.is_none() && s.pending.is_none());
        assert!(s.accept(&[second.clone()], now).is_none());
        assert!(s.accept(&[first.clone(), second.clone()], now).is_none());
        assert!(s.accept(&[first.with_extension("txt")], now).is_none());
        assert!(s.flight.is_none() && s.pending.is_none());
        s.advance_page();
        s.advance_page();
        assert_eq!(s.page_ready(), Some(second.clone()));
        assert_eq!(s.page_ready(), None);
        let grant = s.accept(&[second], now).unwrap();
        assert!(s.ready(&grant, now));
        s.advance_page();
        assert!(s.start(&grant, now).is_err());
    }
    #[test]
    fn system_open_accepts_only_one_local_video_url() {
        let source = path().with_file_name("movie with space ü.MP4");
        let url = url::Url::from_file_path(&source).unwrap();
        assert_eq!(opened_path(&[url.clone()]), Some(source));
        assert!(opened_path(&[url.clone(), url]).is_none());
        for raw in [
            "https://example.invalid/movie.mp4",
            "file://remote/movie.mp4",
            "file:///movie.mp4?x=1",
            "file:///movie.mp4#x",
            "file:///movie.txt",
        ] {
            assert!(opened_path(&[url::Url::parse(raw).unwrap()]).is_none());
        }
    }
    #[test]
    fn system_argv_keeps_native_paths_and_rejects_urls_and_extra_operands() {
        let cwd = std::env::temp_dir();
        assert_eq!(
            argument_path(&["movie ü.mp4".into()], &cwd),
            Some(cwd.join("movie ü.mp4"))
        );
        assert_eq!(
            argument_path(&["--".into(), "-movie.mp4".into()], &cwd),
            Some(cwd.join("-movie.mp4"))
        );
        let source = cwd.join("movie with space ü.mp4");
        let local_url = url::Url::from_file_path(&source).unwrap();
        assert_eq!(
            argument_path(&[local_url.as_str().into()], &cwd),
            Some(source)
        );
        for args in [
            vec!["https://example.invalid/movie.mp4".into()],
            vec!["file://remote/movie.mp4".into()],
            vec!["file:///movie.mp4?x=1".into()],
            vec!["file:///movie.mp4#x".into()],
            vec!["-movie.mp4".into()],
            vec!["a.mp4".into(), "b.mp4".into()],
        ] {
            assert!(argument_path(&args, &cwd).is_none());
        }
    }
    #[test]
    fn commands_are_main_only_and_event_has_only_grant() {
        assert!(require_main("main").is_ok());
        assert!(require_main("pip").is_err());
        assert!(require_main("main-other").is_err());
        assert!(!valid_grant("/tmp/video.mp4"));
        let event = serde_json::to_value(DropEvent {
            grant: "a".repeat(64),
        })
        .unwrap();
        assert_eq!(event, serde_json::json!({"grant": "a".repeat(64)}));
    }
}
