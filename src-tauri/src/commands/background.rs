//! Read-only status and idempotent instance-scoped media work suspension.
use ottplay_core::background_work::{BackgroundStatus, BackgroundWork};
use tauri::Manager;

#[derive(Default)]
pub struct BackgroundPersistence(tokio::sync::Mutex<()>);

fn stored(path: &std::path::Path) -> std::io::Result<bool> {
    use std::io::Read;
    let metadata = match std::fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(error),
    };
    // The standby preference is app-owned. A special file (such as a FIFO)
    // must not block startup before the fail-closed fallback can run.
    if !metadata.is_file() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Standby preference must be a regular file",
        ));
    }
    let file = std::fs::File::open(path)?;
    if !file.metadata()?.is_file() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Opened standby preference must be a regular file",
        ));
    }
    let mut value = String::new();
    file.take(4).read_to_string(&mut value)?;
    match value.as_str() {
        "1\n" => Ok(true),
        "0\n" => Ok(false),
        _ => Err(std::io::Error::other("Invalid standby state")),
    }
}

/// Called before a window or the automatic XMLTV warm task can start.
pub fn restore(app: &tauri::AppHandle) {
    let standby = crate::instance::app_data_dir(app)
        .map_err(std::io::Error::other)
        .and_then(|root| stored(&root.join("background-standby")))
        .unwrap_or_else(|_| {
            tracing::warn!("Native standby state unavailable; background work remains stopped");
            true
        });
    app.state::<BackgroundWork>().set_standby(standby);
}

#[tauri::command]
pub fn background_standby_status(work: tauri::State<'_, BackgroundWork>) -> BackgroundStatus {
    work.status()
}

#[tauri::command]
pub async fn set_background_standby(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    work: tauri::State<'_, BackgroundWork>,
    persistence: tauri::State<'_, BackgroundPersistence>,
    hls: tauri::State<'_, super::native_hls::NativeHlsState>,
    standby: bool,
) -> Result<BackgroundStatus, String> {
    if window.label() != "main" {
        return Err("Standby is controlled by the main player".into());
    }
    let _transition = persistence.0.lock().await;
    // Closing admission is immediate; waking is allowed only after durable intent.
    let media_stopped = if standby {
        work.set_standby(true);
        app.state::<super::companion::CompanionState>().stop().await;
        hls.stop_all().await;
        let _ = super::media_session::stop_media_session(app.state()).await;
        super::tauri_commands::stop_pip(app.clone(), None).await.map(|_| ())
    } else { Ok(()) };
    let root = crate::instance::app_data_dir(&app)?;
    tokio::fs::create_dir_all(&root).await.map_err(|_| "Cannot save standby state")?;
    let destination = root.join("background-standby");
    if stored(&destination).ok() != Some(standby) {
        let temporary = root.join("background-standby.tmp");
        tokio::fs::write(&temporary, if standby { "1\n" } else { "0\n" }).await.map_err(|_| "Cannot save standby state")?;
        tokio::fs::rename(&temporary, &destination).await.map_err(|_| "Cannot save standby state")?;
    }
    work.set_standby(standby);
    media_stopped?;
    // Let cancelled async owners retire, without claiming a blocking worker stopped.
    tokio::task::yield_now().await;
    Ok(work.status())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn standby_startup_state_is_strict_and_missing_is_awake() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        std::fs::create_dir_all(&root).unwrap();
        let file = root.join("background-standby");
        assert!(!stored(&file).unwrap());
        std::fs::write(&file, "1\n").unwrap();
        assert!(stored(&file).unwrap());
        std::fs::write(&file, "0\n").unwrap();
        assert!(!stored(&file).unwrap());
        std::fs::write(&file, "broken").unwrap();
        assert!(stored(&file).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn standby_startup_rejects_non_regular_preferences() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("background-standby");
        std::fs::create_dir(&path).unwrap();
        assert_eq!(
            stored(&path).unwrap_err().kind(),
            std::io::ErrorKind::InvalidData
        );
        assert!(stored(&path).unwrap_or(true));
        std::fs::remove_dir(&path).unwrap();
        #[cfg(unix)]
        {
            let target = root.join("other");
            std::fs::write(&target, "0\n").unwrap();
            std::os::unix::fs::symlink(&target, &path).unwrap();
            assert_eq!(
                stored(&path).unwrap_err().kind(),
                std::io::ErrorKind::InvalidData
            );
            assert!(stored(&path).unwrap_or(true));
            assert_eq!(std::fs::read(&target).unwrap(), b"0\n");
        }
        std::fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn standby_startup_does_not_wait_for_a_fifo_writer() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("background-standby");
        assert!(std::process::Command::new("mkfifo")
            .arg(&path)
            .status()
            .unwrap()
            .success());
        let (sender, receiver) = std::sync::mpsc::channel();
        let worker = std::thread::spawn(move || {
            let _ = sender.send(stored(&path));
        });
        let result = receiver.recv_timeout(std::time::Duration::from_secs(2));
        // Cleanup also runs when the old blocking reader reaches the deadline.
        std::fs::remove_dir_all(root).unwrap();
        let result = result.expect("standby preference reader blocked on a FIFO");
        worker.join().unwrap();
        assert_eq!(
            result.as_ref().unwrap_err().kind(),
            std::io::ErrorKind::InvalidData
        );
        assert!(result.unwrap_or(true));
    }
}
