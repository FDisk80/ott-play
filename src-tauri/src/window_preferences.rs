//! Small, instance-scoped desktop preferences. No window or webview access.

use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

const ASPECT_FILE: &str = "window-aspect-lock";
const TOPMOST_FILE: &str = "window-always-on-top";
static NEXT_TEMPORARY: AtomicU64 = AtomicU64::new(0);

/// A missing preference keeps the normal window default. Other invalid input
/// is reported to the caller, which can warn and use the same default.
pub fn read_always_on_top(root: &Path) -> io::Result<bool> {
    read_bool(root, TOPMOST_FILE)
}

pub fn read_aspect_lock(root: &Path) -> io::Result<bool> {
    read_bool(root, ASPECT_FILE)
}

fn read_bool(root: &Path, name: &str) -> io::Result<bool> {
    let path = root.join(name);
    let metadata = match fs::symlink_metadata(&path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(error),
    };
    // This is an app-owned preference, not a general input path. Reject
    // directories, links and special files before opening (a FIFO could block).
    // This check does not defend against a hostile concurrent path replacement.
    if !metadata.is_file() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Window preference must be a regular file",
        ));
    }
    let file = File::open(path)?;
    if !file.metadata()?.is_file() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Opened window preference must be a regular file",
        ));
    }
    let mut value = Vec::with_capacity(4);
    file.take(4).read_to_end(&mut value)?;
    match value.as_slice() {
        b"1\n" => Ok(true),
        b"0\n" => Ok(false),
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Invalid window preference",
        )),
    }
}

fn create_temporary(root: &Path, name: &str) -> io::Result<(PathBuf, File)> {
    for _ in 0..16 {
        let number = NEXT_TEMPORARY.fetch_add(1, Ordering::Relaxed);
        let path = root.join(format!(".{name}.{}.{number}.tmp", std::process::id()));
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => return Ok((path, file)),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        }
    }
    Err(io::Error::new(
        io::ErrorKind::AlreadyExists,
        "Cannot allocate a preference temporary file",
    ))
}

/// Replace a complete value only after its temporary file has been flushed.
/// Separate temporaries prevent two instances sharing a data root from
/// truncating each other's writes. The last complete replacement wins.
pub fn write_always_on_top(root: &Path, enabled: bool) -> io::Result<()> {
    write_bool(root, TOPMOST_FILE, enabled)
}

pub fn write_aspect_lock(root: &Path, enabled: bool) -> io::Result<()> {
    write_bool(root, ASPECT_FILE, enabled)
}

fn write_bool(root: &Path, name: &str, enabled: bool) -> io::Result<()> {
    fs::create_dir_all(root)?;
    let (temporary, mut file) = create_temporary(root, name)?;
    let result = (|| {
        file.write_all(if enabled { b"1\n" } else { b"0\n" })?;
        file.sync_all()?;
        drop(file);
        fs::rename(&temporary, root.join(name))?;
        #[cfg(unix)]
        File::open(root)?.sync_all()?;
        Ok(())
    })();
    if result.is_err() {
        // This name belongs to this successful create_new call only.
        let _ = fs::remove_file(&temporary);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!(
                "ott-topmost-test-{}-{}",
                std::process::id(),
                NEXT_TEMPORARY.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&root).unwrap();
            Self(root)
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[test]
    fn aspect_preference_is_off_by_default_independent_and_instance_scoped() {
        let root = TestDirectory::new();
        assert!(!read_aspect_lock(&root.0).unwrap());
        write_always_on_top(&root.0, true).unwrap();
        assert!(!read_aspect_lock(&root.0).unwrap());
        for enabled in [true, true, false] {
            write_aspect_lock(&root.0, enabled).unwrap();
            assert_eq!(read_aspect_lock(&root.0).unwrap(), enabled);
            assert!(read_always_on_top(&root.0).unwrap());
            assert!(!read_aspect_lock(&root.0.join("other")).unwrap());
        }
    }

    #[test]
    fn aspect_rejects_malformed_and_nonregular_preferences() {
        let root = TestDirectory::new();
        fs::write(root.0.join(ASPECT_FILE), b"true").unwrap();
        assert_eq!(
            read_aspect_lock(&root.0).unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        fs::remove_file(root.0.join(ASPECT_FILE)).unwrap();
        fs::create_dir(root.0.join(ASPECT_FILE)).unwrap();
        assert!(read_aspect_lock(&root.0).is_err());
        assert!(write_aspect_lock(&root.0, true).is_err());
        assert_eq!(fs::read_dir(&root.0).unwrap().count(), 1);
    }

    #[test]
    fn missing_preference_uses_normal_window_default() {
        let root = TestDirectory::new();
        assert!(!read_always_on_top(&root.0).unwrap());
        assert!(!read_always_on_top(&root.0.join("missing-instance")).unwrap());
        assert_eq!(fs::read_dir(&root.0).unwrap().count(), 0);
    }

    #[test]
    fn fresh_reads_restore_enabled_and_disabled_values() {
        let root = TestDirectory::new();
        for enabled in [true, true, false, false, true] {
            write_always_on_top(&root.0, enabled).unwrap();
            assert_eq!(read_always_on_top(&root.0).unwrap(), enabled);
            assert_eq!(
                fs::read(root.0.join(TOPMOST_FILE)).unwrap(),
                if enabled { b"1\n" } else { b"0\n" }
            );
            assert_eq!(fs::read_dir(&root.0).unwrap().count(), 1);
        }
    }

    #[test]
    fn instance_roots_do_not_share_preferences() {
        let root = TestDirectory::new();
        let first = root.0.join("first");
        let second = root.0.join("second");
        write_always_on_top(&first, true).unwrap();
        assert!(!read_always_on_top(&second).unwrap());
        write_always_on_top(&second, false).unwrap();
        assert!(read_always_on_top(&first).unwrap());
        assert!(!read_always_on_top(&second).unwrap());
    }

    #[test]
    fn invalid_and_oversized_values_are_not_enabled() {
        let root = TestDirectory::new();
        for value in [b"".as_slice(), b"1", b"true", b"1\n\n", b"0\nx", b"\xff\n"] {
            fs::write(root.0.join(TOPMOST_FILE), value).unwrap();
            assert_eq!(
                read_always_on_top(&root.0).unwrap_err().kind(),
                io::ErrorKind::InvalidData
            );
        }
        fs::write(root.0.join(TOPMOST_FILE), vec![b'1'; 8192]).unwrap();
        assert_eq!(
            read_always_on_top(&root.0).unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
    }

    #[test]
    fn directory_preference_is_invalid_and_can_use_normal_default() {
        let root = TestDirectory::new();
        fs::create_dir(root.0.join(TOPMOST_FILE)).unwrap();
        assert_eq!(
            read_always_on_top(&root.0).unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert!(!read_always_on_top(&root.0).unwrap_or(false));
    }

    #[cfg(unix)]
    #[test]
    fn symlink_preference_is_invalid_even_when_target_is_enabled() {
        let root = TestDirectory::new();
        let target = root.0.join("other");
        fs::write(&target, b"1\n").unwrap();
        std::os::unix::fs::symlink(&target, root.0.join(TOPMOST_FILE)).unwrap();
        assert_eq!(
            read_always_on_top(&root.0).unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert!(!read_always_on_top(&root.0).unwrap_or(false));
        assert_eq!(fs::read(target).unwrap(), b"1\n");
    }

    #[cfg(unix)]
    #[test]
    fn fifo_preference_is_rejected_without_waiting_for_a_writer() {
        let root = TestDirectory::new();
        assert!(std::process::Command::new("mkfifo")
            .arg(root.0.join(TOPMOST_FILE))
            .status()
            .unwrap()
            .success());
        let path = root.0.clone();
        let (sender, receiver) = std::sync::mpsc::channel();
        let worker = std::thread::spawn(move || {
            let _ = sender.send(read_always_on_top(&path));
        });
        let result = receiver
            .recv_timeout(std::time::Duration::from_secs(2))
            .expect("preference reader blocked on a FIFO");
        worker.join().unwrap();
        assert_eq!(
            result.as_ref().unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert!(!result.unwrap_or(false));
    }

    #[test]
    fn confirmed_write_can_replace_malformed_old_value() {
        let root = TestDirectory::new();
        fs::write(root.0.join(TOPMOST_FILE), b"broken").unwrap();
        write_always_on_top(&root.0, false).unwrap();
        assert!(!read_always_on_top(&root.0).unwrap());
    }

    #[test]
    fn failed_replacement_removes_only_its_temporary() {
        let root = TestDirectory::new();
        let destination = root.0.join(TOPMOST_FILE);
        fs::create_dir(&destination).unwrap();
        fs::write(destination.join("keep"), b"owned elsewhere").unwrap();
        assert!(read_always_on_top(&root.0).is_err());
        assert!(write_always_on_top(&root.0, true).is_err());
        assert_eq!(fs::read_dir(&root.0).unwrap().count(), 1);
        assert_eq!(
            fs::read(destination.join("keep")).unwrap(),
            b"owned elsewhere"
        );
    }

    #[test]
    fn invalid_root_returns_an_error_without_altering_it() {
        let root = TestDirectory::new();
        let file = root.0.join("not-a-directory");
        fs::write(&file, b"keep").unwrap();
        assert!(write_always_on_top(&file, true).is_err());
        assert_eq!(fs::read(file).unwrap(), b"keep");
    }
}
