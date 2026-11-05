//! Native-picked local sources, served directly through a private loopback endpoint.
use serde::Serialize;
use std::collections::HashMap;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tokio::sync::Mutex;

#[derive(Clone)]
pub(super) struct Runtime {
    pub(super) endpoint: String,
    pub(super) library: ottplay_core::offline_media::Library,
}
#[derive(Default)]
pub struct OfflineMediaState(
    Mutex<Option<Runtime>>,
    Mutex<HashMap<String, ottplay_core::offline_media::NativeRequest>>,
);
impl OfflineMediaState {
    pub(super) fn diagnostic_endpoint(&self) -> Option<String> {
        self.0
            .try_lock()
            .ok()?
            .as_ref()
            .map(|value| value.endpoint.clone())
    }
    #[cfg(test)]
    pub(super) fn diagnostic_lock_for_test(&self) -> impl Drop + '_ {
        self.0.try_lock().expect("test runtime lock")
    }
}
#[derive(Serialize)]
pub struct Endpoint {
    endpoint: String,
    #[serde(rename = "pickerCancelled", skip_serializing_if = "Option::is_none")]
    picker_cancelled: Option<bool>,
}

pub(super) async fn runtime(
    app: &AppHandle,
    state: &OfflineMediaState,
    preferred_id: Option<&str>,
    refresh: bool,
    discover: bool,
) -> Result<Runtime, String> {
    let background = app.state::<ottplay_core::background_work::BackgroundWork>();
    let work = background.enter().map_err(str::to_string)?;
    let mut current = work.run(state.0.lock()).await.map_err(str::to_string)?;
    if let Some(value) = current.as_ref() {
        let value = value.clone();
        drop(current);
        if refresh {
            value
                .library
                .start_refresh_sources_with_preferred_tracked(preferred_id, work.clone())
                .await;
        } else if discover {
            value
                .library
                .ensure_catalog_tracked(preferred_id, work.clone())
                .await;
        }
        work.check().map_err(str::to_string)?;
        return Ok(value);
    }
    let root = crate::instance::app_data_dir(app)?.join("offline-media");
    let token = format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );
    let library = work
        .run(ottplay_core::offline_media::Library::new(
            root, token, "device",
        ))
        .await
        .map_err(str::to_string)?
        .map_err(|_| "Local media storage unavailable")?
        .with_background(background.inner().clone())
        .with_compatibility_from_env()
        .await;
    let listener = work
        .run(tokio::net::TcpListener::bind("127.0.0.1:0"))
        .await
        .map_err(str::to_string)?
        .map_err(|_| "Local media listener unavailable")?;
    let address = listener
        .local_addr()
        .map_err(|_| "Local media listener unavailable")?;
    let endpoint = format!("http://{address}{}", library.endpoint());
    let server = library.clone();
    if refresh || discover {
        library
            .start_refresh_sources_with_preferred_tracked(preferred_id, work.clone())
            .await;
    }
    let result = Runtime { endpoint, library };
    work.publish(|| {
        tauri::async_runtime::spawn(async move {
            if let Err(error) = axum::serve(listener, server.routes()).await {
                tracing::warn!(%error, "Offline media listener stopped");
            }
        });
        *current = Some(result.clone());
    })
    .map_err(str::to_string)?;
    Ok(result)
}

#[tauri::command]
pub async fn offline_media_endpoint(
    app: AppHandle,
    state: State<'_, OfflineMediaState>,
    refresh: Option<bool>,
    preferred_id: Option<String>,
    source_id: Option<String>,
) -> Result<Endpoint, String> {
    let current = runtime(
        &app,
        &state,
        preferred_id.as_deref(),
        refresh.unwrap_or(false),
        true,
    )
    .await?;
    if let Some(source_id) = source_id {
        let work = app
            .state::<ottplay_core::background_work::BackgroundWork>()
            .enter()
            .map_err(str::to_string)?;
        current
            .library
            .prioritize_source_tracked(&source_id, work)
            .await
            .map_err(|_| "Local source is unavailable")?;
    }
    Ok(Endpoint {
        endpoint: current.endpoint,
        picker_cancelled: None,
    })
}

#[tauri::command]
pub async fn offline_media_import_files(
    app: AppHandle,
    state: State<'_, OfflineMediaState>,
) -> Result<Endpoint, String> {
    let work = app
        .state::<ottplay_core::background_work::BackgroundWork>()
        .enter()
        .map_err(str::to_string)?;
    let current = runtime(&app, &state, None, false, true).await?;
    let picker_work = work.clone();
    let selected = tauri::async_runtime::spawn_blocking(move || {
        let _picker_work = picker_work;
        app.dialog()
            .file()
            .add_filter(
                "Media",
                &[
                    "mp4", "m4v", "webm", "ogv", "mp3", "m4a", "ogg", "avi", "mkv",
                ],
            )
            .blocking_pick_files()
    })
    .await
    .map_err(|_| "File picker unavailable")?;
    work.check().map_err(str::to_string)?;
    let picker_cancelled = selected.is_none().then_some(true);
    if let Some(files) = selected {
        let paths = files
            .into_iter()
            .map(|file| {
                file.into_path()
                    .map_err(|_| "Select a local filesystem file")
            })
            .collect::<Result<Vec<_>, _>>()?;
        current
            .library
            .start_link_paths_tracked(paths, false, work.clone())
            .await
            .map_err(|_| "Unable to link selected files; no files were copied")?;
    }
    Ok(Endpoint {
        endpoint: current.endpoint,
        picker_cancelled,
    })
}

#[tauri::command]
pub async fn offline_media_import_folder(
    app: AppHandle,
    state: State<'_, OfflineMediaState>,
) -> Result<Endpoint, String> {
    let work = app
        .state::<ottplay_core::background_work::BackgroundWork>()
        .enter()
        .map_err(str::to_string)?;
    let current = runtime(&app, &state, None, false, true).await?;
    let picker_work = work.clone();
    let selected = tauri::async_runtime::spawn_blocking(move || {
        let _picker_work = picker_work;
        app.dialog().file().blocking_pick_folder()
    })
    .await
    .map_err(|_| "Folder picker unavailable")?;
    work.check().map_err(str::to_string)?;
    let picker_cancelled = selected.is_none().then_some(true);
    if let Some(folder) = selected {
        let path = folder
            .into_path()
            .map_err(|_| "Select a local filesystem folder")?;
        current
            .library
            .start_link_paths_tracked(vec![path], true, work.clone())
            .await
            .map_err(|_| "Unable to link selected folder; no files were copied")?;
    }
    Ok(Endpoint {
        endpoint: current.endpoint,
        picker_cancelled,
    })
}

#[tauri::command]
pub async fn offline_media_remove_source(
    app: AppHandle,
    state: State<'_, OfflineMediaState>,
    id: String,
) -> Result<Endpoint, String> {
    let current = runtime(&app, &state, None, false, true).await?;
    current
        .library
        .disconnect_source(&id)
        .await
        .map_err(|_| "Unable to disconnect local source")?;
    Ok(Endpoint {
        endpoint: current.endpoint,
        picker_cancelled: None,
    })
}

fn require_main(label: &str) -> Result<(), String> {
    if label == "main" {
        Ok(())
    } else {
        Err("Local source control is restricted to the main window".into())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalMediaCapabilities {
    version: u8,
    absolute_paths: bool,
    source_paths: bool,
}

#[derive(Serialize)]
pub struct LocalMediaSources {
    endpoint: String,
    sources: Vec<ottplay_core::offline_media::NativeSource>,
}

#[derive(Serialize)]
pub struct LocalMediaFolder {
    endpoint: String,
    source: ottplay_core::offline_media::NativeSource,
}

fn source_lookup_error(error: anyhow::Error) -> String {
    if error.is::<ottplay_core::offline_media::NativeSourceUnavailable>() {
        "source_unavailable"
    } else if ottplay_core::offline_media::is_native_probe_deadline(&error) {
        "operation_in_progress"
    } else {
        "Local sources unavailable; select an accessible absolute directory"
    }
    .into()
}

#[tauri::command]
pub fn local_media_capabilities(
    window: tauri::WebviewWindow,
) -> Result<LocalMediaCapabilities, String> {
    require_main(window.label())?;
    Ok(LocalMediaCapabilities {
        version: 1,
        absolute_paths: true,
        source_paths: true,
    })
}

/// The caller opts in to private paths only for an authenticated source export.
/// Unlike endpoint discovery this read never starts a media scan.
#[tauri::command]
pub async fn local_media_sources(
    app: AppHandle,
    window: tauri::WebviewWindow,
    state: State<'_, OfflineMediaState>,
    include_paths: Option<bool>,
    path: Option<String>,
    selection: Option<String>,
) -> Result<LocalMediaSources, String> {
    require_main(window.label())?;
    let current = runtime(&app, &state, None, false, false).await?;
    let sources = current
        .library
        .native_sources_selected(
            include_paths.unwrap_or(false),
            path.map(Into::into),
            selection.as_deref(),
        )
        .await
        .map_err(source_lookup_error)?;
    Ok(LocalMediaSources {
        endpoint: current.endpoint,
        sources,
    })
}

/// Called after the player validates an authenticated explicit local-folder
/// command. The native boundary still restricts the window and filesystem input.
#[tauri::command]
pub async fn local_media_link_folder(
    app: AppHandle,
    window: tauri::WebviewWindow,
    state: State<'_, OfflineMediaState>,
    path: String,
    deadline_ms: Option<u64>,
    request_id: Option<String>,
) -> Result<LocalMediaFolder, String> {
    require_main(window.label())?;
    if path.len() > 4096 || path.chars().any(char::is_control) {
        return Err("Invalid local folder path".into());
    }
    let request_id = request_id.unwrap_or_else(|| uuid::Uuid::new_v4().simple().to_string());
    validate_request_id(&request_id)?;
    let now = now_ms();
    let request = {
        let mut requests = state.1.lock().await;
        requests.retain(|_, request| !request.expired());
        if requests.len() >= 128 {
            return Err("Too many local source requests".into());
        }
        requests
            .entry(request_id.clone())
            .or_insert_with(|| {
                ottplay_core::offline_media::NativeRequest::new(
                    deadline_ms.unwrap_or(now + 60000).min(now + 60000),
                )
            })
            .clone()
    };
    let work = app
        .state::<ottplay_core::background_work::BackgroundWork>()
        .enter()
        .map_err(str::to_string)?;
    let current = runtime(&app, &state, None, false, false).await?;
    let result = current
        .library
        .start_link_folder_request(path.into(), work, request)
        .await
        .map_err(|error| {
            if error.to_string() == ottplay_core::offline_media::NATIVE_SOURCE_OVERLAP {
                ottplay_core::offline_media::NATIVE_SOURCE_OVERLAP
            } else if error.to_string() == ottplay_core::offline_media::NATIVE_SOURCE_LIMIT {
                ottplay_core::offline_media::NATIVE_SOURCE_LIMIT
            } else {
                "Unable to link local folder; select an accessible absolute directory"
            }
        });
    state.1.lock().await.remove(&request_id);
    let source = result?;
    Ok(LocalMediaFolder {
        endpoint: current.endpoint,
        source,
    })
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(u128::from(u64::MAX)) as u64
}

fn validate_request_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > 128
        || !id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"-_.:".contains(&c))
    {
        return Err("Invalid local source request ID".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn local_media_cancel_request(
    window: tauri::WebviewWindow,
    state: State<'_, OfflineMediaState>,
    request_id: String,
) -> Result<(), String> {
    require_main(window.label())?;
    validate_request_id(&request_id)?;
    let mut requests = state.1.lock().await;
    requests.retain(|_, request| !request.expired());
    // Retain a short-lived tombstone if cancellation wins the invoke race.
    if requests.len() >= 128 && !requests.contains_key(&request_id) {
        return Err("Too many local source requests".into());
    }
    requests
        .entry(request_id)
        .or_insert_with(|| ottplay_core::offline_media::NativeRequest::new(now_ms() + 60000))
        .cancel();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn source_lookup_error_classifies_only_the_typed_folder_failure() {
        let error = anyhow::Error::new(ottplay_core::offline_media::NativeSourceUnavailable)
            .context("private diagnostic context");
        assert_eq!(source_lookup_error(error), "source_unavailable");
        for message in [
            "Requested local folder is unavailable",
            "Local media storage unavailable",
            "Cannot read media sources",
            "Local folder read timed out",
            "operation_in_progress",
        ] {
            assert_eq!(
                source_lookup_error(anyhow::anyhow!(message.to_owned())),
                "Local sources unavailable; select an accessible absolute directory"
            );
        }
    }

    #[test]
    fn local_source_control_is_main_window_only() {
        assert!(require_main("main").is_ok());
        for label in ["pip", "", "MAIN", "main/child"] {
            assert!(require_main(label).is_err());
        }
        let capability: serde_json::Value =
            serde_json::from_str(include_str!("../../capabilities/local-media-control.json"))
                .unwrap();
        assert_eq!(capability["windows"], serde_json::json!(["main"]));
        assert_eq!(
            capability["permissions"],
            serde_json::json!(["allow-local-media-control", "allow-local-media-drop"])
        );
        assert_eq!(
            capability["remote"]["urls"],
            serde_json::json!([
                "http://127.0.0.1:8443/*",
                "http://127.0.0.1:8444/*",
                "http://127.0.0.1:8445/*",
                "http://127.0.0.1:8446/*",
                "http://localhost:8443/*",
                "http://localhost:8444/*",
                "http://localhost:8445/*",
                "http://localhost:8446/*",
                "http://tauri.localhost/*",
                "https://tauri.localhost/*",
                "http://asset.localhost/*",
                "https://asset.localhost/*",
                "tauri://localhost/*",
                "asset://localhost/*"
            ])
        );
        let drop_permission = include_str!("../../permissions/allow-local-media-drop.toml");
        assert_eq!(
            drop_permission
                .lines()
                .filter(|line| line.trim() == "[[permission]]")
                .count(),
            1
        );
        assert!(drop_permission
            .lines()
            .any(|line| line.trim() == "identifier = \"allow-local-media-drop\""));
        // This permission uses a JSON-compatible, one-line TOML string array.
        // Require exactly one declaration and its complete authorized command set.
        let drop_commands: Vec<_> = drop_permission
            .lines()
            .filter_map(|line| line.trim().strip_prefix("commands.allow = "))
            .collect();
        assert_eq!(drop_commands.len(), 1);
        let drop_commands: serde_json::Value = serde_json::from_str(drop_commands[0]).unwrap();
        assert_eq!(
            drop_commands,
            serde_json::json!([
                "local_media_drop_ready",
                "local_media_take_drop",
                "local_media_release_drop"
            ])
        );
        assert_eq!(
            serde_json::to_value(LocalMediaCapabilities {
                version: 1,
                absolute_paths: true,
                source_paths: true
            })
            .unwrap(),
            serde_json::json!({"version":1,"absolutePaths":true,"sourcePaths":true})
        );
    }
}
