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
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::RwLock;

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
            // Persist main window position/size across launches (Mode B frameless).
            // SIZE|POSITION|VISIBLE only — never FULLSCREEN/MAXIMIZED/DECORATIONS so
            // restore does not fight Key L native fullscreen toggle.
            // Per-instance filename when OTTPLAY_INSTANCE / OTTPLAY_DATA_DIR is set.
            let mut ws = tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::VISIBLE,
                )
                .with_denylist(&["pip"]);
            if let Some(name) = instance::window_state_filename() {
                ws = ws.with_filename(name);
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
            #[cfg(dev)]
            let dev_url = app.config().build.dev_url.as_ref();
            #[cfg(not(dev))]
            let dev_url = None;

            let always_on_top = commands::window_controls::initial_always_on_top(app.handle());
            let mut builder = tauri::WebviewWindowBuilder::new(
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
            .resizable(true)
            .always_on_top(always_on_top)
            .decorations(false);
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
