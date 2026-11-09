mod commands;

/// Production command modules exposed for the isolated native CI fixture.
/// Re-exporting handlers does not grant any IPC permission.
#[doc(hidden)]
pub mod native_window_smoke_commands {
    pub use crate::commands::{tauri_commands, window_controls};
    pub use crate::window_aspect;

    #[cfg(target_os = "macos")]
    pub fn build_native_menu(
        app: &tauri::AppHandle,
    ) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
        crate::native_menu::build(app)
    }
    #[cfg(target_os = "macos")]
    pub fn handle_native_menu(app: &tauri::AppHandle, event: tauri::menu::MenuEvent) {
        crate::native_menu::handle(app, event);
    }
    #[cfg(target_os = "macos")]
    pub fn native_menu_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
        crate::native_menu::on_window_event(window, event);
    }
}
mod instance;
#[cfg(target_os = "linux")]
mod linux_media_compat;
#[cfg(target_os = "macos")]
mod native_menu;
mod preferred_languages;
#[doc(hidden)]
pub mod window_aspect;
mod window_preferences;

use commands::media_session::MediaSessionState;
use commands::tauri_commands::{PipState, TauriState};
use std::collections::HashMap;
#[cfg(any(target_os = "windows", test))]
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::RwLock;

#[cfg(any(target_os = "windows", test))]
struct StartupWindowReveal {
    intended_url: Option<String>,
    saved_geometry: bool,
    revealed: AtomicBool,
}

#[cfg(any(target_os = "windows", test))]
const STARTUP_REVEAL_FALLBACK: std::time::Duration = std::time::Duration::from_secs(8);

#[cfg(any(target_os = "windows", test))]
fn startup_page_is_intended(intended_url: Option<&str>, loaded_url: &str) -> bool {
    intended_url.is_none_or(|expected| expected == loaded_url)
}

#[cfg(any(target_os = "windows", test))]
fn reveal_startup_window(window: &tauri::Window) {
    let reveal = window.app_handle().state::<StartupWindowReveal>();
    if reveal
        .revealed
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return;
    }

    use tauri_plugin_window_state::{StateFlags, WindowExt};
    if reveal.saved_geometry {
        if let Err(error) = window.restore_state(StateFlags::SIZE | StateFlags::POSITION) {
            tracing::warn!(%error, "Could not restore the initial window geometry");
        }
    }
    if !window.is_visible().unwrap_or(false) {
        if let Err(error) = window.show().and_then(|_| window.set_focus()) {
            reveal.revealed.store(false, Ordering::Release);
            tracing::warn!(%error, "Could not reveal the initial main window");
        }
    }
}

/// Default URL for the desktop shell webview.
///
/// Debug builds point at the local HTTP companion (`:8443`) so Mode A paths work while
/// developing. Release builds default to empty so the app uses embedded
/// `frontendDist` (`frontend/` — Mode A-like staged tree).
///
/// Override with `OTTPLAY_WEB_URL` in either mode. Set it to empty to keep
/// embedded `frontendDist`.
#[cfg(debug_assertions)]
const DEFAULT_WEB_URL: &str = "http://127.0.0.1:8443/";
#[cfg(not(debug_assertions))]
const DEFAULT_WEB_URL: &str = "";

pub fn run() {
    #[cfg(target_os = "linux")]
    linux_media_compat::configure_early();
    let epg_urls = commands::tauri_commands::init_xmltv_urls();
    let command_queues = commands::queue::new_shared();
    let background = ottplay_core::background_work::BackgroundWork::default();
    // No listener starts at launch; settings explicitly configure optional HTTP.
    let builder = tauri::Builder::default();
    #[cfg(target_os = "macos")]
    let builder = builder
        .menu(native_menu::build)
        .on_menu_event(native_menu::handle);
    // Managed local copies have a distinct bundle identity and WebKit store.
    // Installing the canonical updater archive over one would erase that
    // identity. Update the main app, then refresh the instance copies instead.
    let builder = if std::env::var("OTTPLAY_MANAGED_INSTANCE").as_deref() == Ok("1") {
        builder
    } else {
        builder.plugin(tauri_plugin_updater::Builder::new().build())
    };
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin({
            #[cfg(any(target_os = "windows", test))]
            let state_flags = tauri_plugin_window_state::StateFlags::SIZE
                | tauri_plugin_window_state::StateFlags::POSITION;
            #[cfg(not(any(target_os = "windows", test)))]
            let state_flags = tauri_plugin_window_state::StateFlags::SIZE
                | tauri_plugin_window_state::StateFlags::POSITION
                | tauri_plugin_window_state::StateFlags::VISIBLE;
            // Persist main window position/size across launches (Mode B frameless).
            // Windows deliberately excludes visibility: its startup window stays
            // hidden until the intended page is ready, so transient visibility
            // must not be persisted. Other platforms keep their existing policy.
            // Never restore FULLSCREEN/MAXIMIZED/DECORATIONS so restore does not
            // fight Key L native fullscreen toggle.
            // Per-instance filename when OTTPLAY_INSTANCE / OTTPLAY_DATA_DIR is set.
            let mut ws = tauri_plugin_window_state::Builder::new()
                .with_state_flags(state_flags)
                .with_denylist(&["pip"]);
            if let Some(name) = instance::window_state_filename() {
                ws = ws.with_filename(name);
            }
            // Defer geometry restoration until the intended frontend has loaded
            // so Windows does not flash the centered default frame at startup.
            #[cfg(any(target_os = "windows", test))]
            {
                ws = ws.skip_initial_state("main");
            }
            ws.build()
        })
        .manage(background.clone())
        .manage(commands::background::BackgroundPersistence::default())
        .manage(commands::window_controls::AlwaysOnTopPersistence::default())
        .manage(window_aspect::WindowAspectLock::default())
        .manage(commands::offline_media::OfflineMediaState::default())
        .manage(commands::local_drop::LocalDropState::default())
        .manage(commands::companion::CompanionState::default())
        .manage(commands::queue::QueueHttpRuntime::default())
        .manage(MediaSessionState::default())
        .manage(commands::native_hls::NativeHlsState::default())
        .manage(commands::runtime_diagnostics::RuntimeDiagnosticsState::default())
        .manage(PipState::default())
        .manage(TauriState {
            background,
            xmltv_cache: Arc::new(RwLock::new(None)),
            epg_urls: Arc::new(RwLock::new(epg_urls.clone())),
            epg_to_xmltv: Arc::new(RwLock::new(HashMap::new())),
            time_shift_by_epg: Arc::new(RwLock::new(HashMap::new())),
            xmltv_fetch_lock: Arc::new(tokio::sync::Mutex::new(())),
            command_queues: command_queues.clone(),
        })
        .invoke_handler(tauri::generate_handler![
            commands::tauri_commands::ping,
            commands::companion::companion_capabilities,
            commands::companion::companion_endpoint,
            commands::background::background_standby_status,
            commands::background::set_background_standby,
            commands::local_drop::local_media_drop_ready,
            commands::local_drop::local_media_take_drop,
            commands::local_drop::local_media_release_drop,
            commands::offline_media::offline_media_endpoint,
            commands::offline_media::offline_media_import_files,
            commands::offline_media::offline_media_import_folder,
            commands::offline_media::offline_media_remove_source,
            commands::offline_media::local_media_capabilities,
            commands::offline_media::local_media_sources,
            commands::local_source_diagnostics::local_source_diagnostics,
            commands::offline_media::local_media_link_folder,
            commands::offline_media::local_media_cancel_request,
            commands::runtime_diagnostics::runtime_diagnostics,
            commands::tauri_commands::get_epg,
            commands::m3u::match_channels,
            commands::m3u::match_logos,
            commands::tmdb::tmdb_proxy,
            commands::artwork::artwork_fetch,
            commands::tauri_commands::proxy_fetch,
            commands::http::proxy_http,
            commands::plex_auth::open_plex_sign_in,
            commands::control_discovery::discover_control_servers,
            commands::swop::swop_http,
            commands::native_hls::native_hls_start,
            commands::native_hls::native_hls_stats,
            commands::native_hls::native_hls_stop,
            commands::tauri_commands::set_fullscreen,
            commands::tauri_commands::toggle_fullscreen,
            commands::window_controls::set_always_on_top,
            window_aspect::get_window_aspect_lock,
            window_aspect::set_window_aspect_lock,
            commands::tauri_commands::prevent_sleep,
            commands::tauri_commands::allow_sleep,
            commands::tauri_commands::play_pip,
            commands::tauri_commands::pip_player_event,
            commands::tauri_commands::stop_pip,
            commands::tauri_commands::set_pip_bounds,
            commands::tauri_commands::exit_app,
            commands::lifecycle::lifecycle_capabilities,
            commands::lifecycle::restart_app,
            commands::screenshot::screenshot_capabilities,
            commands::screenshot::capture_screenshot,
            commands::media_session::start_media_session,
            commands::media_session::pause_media_session,
            commands::media_session::resume_media_session,
            commands::media_session::stop_media_session,
            commands::media_session::update_media_session,
            commands::queue::queue_poll,
            commands::queue::queue_enqueue,
            commands::queue::queue_port,
            commands::queue::queue_http_configure,
            commands::misc::get_version,
            commands::misc::feedback_get,
            commands::misc::feedback_post,
            commands::stalker::stalker_portal_fetch,
        ])
        .on_window_event(|window, event| {
            #[cfg(target_os = "macos")]
            native_menu::on_window_event(window, event);
            if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                commands::local_drop::offer(window.app_handle(), window.label(), paths);
            }
        })
        .on_page_load(|window, payload| {
            if window.label() == "main" && payload.event() == tauri::webview::PageLoadEvent::Started
            {
                let app = window.app_handle().clone();
                app.state::<commands::local_drop::LocalDropState>()
                    .advance_page();
                let generation = app
                    .state::<commands::companion::CompanionState>()
                    .advance_page();
                tauri::async_runtime::spawn(async move {
                    app.state::<commands::companion::CompanionState>()
                        .stop_before(generation)
                        .await;
                    app.state::<commands::native_hls::NativeHlsState>()
                        .stop_all()
                        .await;
                });
            }
            #[cfg(any(target_os = "windows", test))]
            if window.label() == "main"
                && payload.event() == tauri::webview::PageLoadEvent::Finished
            {
                let reveal = window.app_handle().state::<StartupWindowReveal>();
                let loaded_url = payload.url().as_str();
                if startup_page_is_intended(reveal.intended_url.as_deref(), loaded_url) {
                    let native_window = window.window();
                    reveal_startup_window(&native_window);
                }
            }
        })
        .setup(|app| {
            commands::background::restore(app.handle());
            // Always build the main window here (tauri.conf windows=[]) so
            // OTTPLAY_INSTANCE / OTTPLAY_DATA_DIR can set data_directory +
            // macOS data_store_identifier at create time. Destroy+recreate
            // races on the `main` label and panics.
            if let Some(data_dir) = instance::resolve_data_dir() {
                instance::ensure_dirs(&data_dir).map_err(|e| {
                    Box::<dyn std::error::Error>::from(format!(
                        "instance data dir {}: {e}",
                        data_dir.display()
                    ))
                })?;
                tracing::info!(
                    path = %data_dir.display(),
                    slug = instance::isolation_slug().unwrap_or_default(),
                    "OTTPLAY instance isolation enabled"
                );
            }

            let raw = std::env::var("OTTPLAY_WEB_URL").unwrap_or_else(|_| DEFAULT_WEB_URL.into());
            let web_url = if raw.trim().is_empty() {
                None
            } else {
                Some(tauri::Url::parse(&raw).map_err(|e| {
                    Box::<dyn std::error::Error>::from(format!(
                        "invalid OTTPLAY_WEB_URL {raw:?}: {e}"
                    ))
                })?)
            };
            #[cfg(any(target_os = "windows", test))]
            app.manage(StartupWindowReveal {
                intended_url: web_url.as_ref().map(|url| url.as_str().to_owned()),
                saved_geometry: app
                    .path()
                    .app_config_dir()
                    .ok()
                    .and_then(|dir| {
                        let filename = instance::window_state_filename().unwrap_or_else(|| {
                            tauri_plugin_window_state::DEFAULT_FILENAME.to_owned()
                        });
                        instance::saved_window_geometry(&dir, &filename, "main")
                    })
                    .unwrap_or(false),
                revealed: AtomicBool::new(false),
            });
            #[cfg(dev)]
            let dev_url = app.config().build.dev_url.as_ref();
            #[cfg(not(dev))]
            let dev_url = None;

            let always_on_top = commands::window_controls::initial_always_on_top(app.handle());
            let builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .initialization_script(preferred_languages::initialization_script(
                web_url.as_ref(),
                dev_url,
            ))
            .title("OttPlay FOSS")
            .inner_size(1280.0, 720.0)
            .center()
            .background_color(tauri::window::Color(17, 17, 17, 255))
            .resizable(true)
            .always_on_top(always_on_top)
            .decorations(false);
            #[cfg(any(target_os = "windows", test))]
            let mut builder = builder.visible(false);
            #[cfg(not(any(target_os = "windows", test)))]
            let mut builder = builder;
            if let Some(data_dir) = instance::resolve_data_dir() {
                builder = instance::apply_isolation(builder, &data_dir);
            }
            builder.build()?;
            #[cfg(target_os = "macos")]
            native_menu::refresh(app.handle());
            #[cfg(any(target_os = "windows", target_os = "linux"))]
            commands::local_drop::initial_arguments(app.handle());
            if let Some(webview) = app.get_webview_window("main") {
                let window = webview.as_ref().window();
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(error) = window_aspect::initialize(handle, window).await {
                        tracing::warn!(%error, "Native aspect preference restore failed");
                    }
                });
            }

            if let Some(window) = app.get_webview_window("main") {
                if let Some(url) = web_url {
                    tracing::info!("navigating main webview to {url}");
                    window.navigate(url)?;
                } else {
                    tracing::info!("OTTPLAY_WEB_URL empty — using embedded frontendDist");
                }
                #[cfg(any(target_os = "windows", test))]
                {
                    let fallback_window = window.as_ref().window().clone();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(STARTUP_REVEAL_FALLBACK).await;
                        reveal_startup_window(&fallback_window);
                    });
                }
            }

            // Mode A companion warms XMLTV before serving; Mode B must too or the
            // first get_epg/match_channels pays a multi-second 40MB gz parse and
            // can permanently cache a transient 0-channel miss.
            let handle = app.handle().clone();
            commands::tauri_commands::spawn_xmltv_warm(handle, &*app.state::<TauriState>());

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                commands::local_drop::opened(_app, &urls);
            }
        });
}

#[cfg(test)]
mod startup_window_reveal_tests {
    use super::{startup_page_is_intended, STARTUP_REVEAL_FALLBACK};
    use std::time::Duration;

    #[test]
    fn embedded_frontend_reveals_on_its_first_completed_page() {
        assert!(startup_page_is_intended(
            None,
            "http://tauri.localhost/index.html"
        ));
    }

    #[test]
    fn external_frontend_ignores_embedded_load_until_target_url_finishes() {
        let intended = "http://127.0.0.1:8443/";
        assert!(!startup_page_is_intended(
            Some(intended),
            "http://tauri.localhost/index.html"
        ));
        assert!(startup_page_is_intended(Some(intended), intended));
        assert!(!startup_page_is_intended(
            Some(intended),
            "http://127.0.0.1:8443/other"
        ));
    }

    #[test]
    fn failed_or_never_finished_navigation_has_a_bounded_reveal_fallback() {
        assert!(STARTUP_REVEAL_FALLBACK >= Duration::from_secs(1));
        assert!(STARTUP_REVEAL_FALLBACK <= Duration::from_secs(10));
    }
}
