//! A torrent file name never becomes a local path. Only selected pieces are stored.
use super::torrent::{lock, MediaFile, CACHE_LIMIT};
use librqbit::storage::{BoxStorageFactory, StorageFactory, StorageFactoryExt, TorrentStorage};
use std::{
    fs::{File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
};
use tokio_util::sync::CancellationToken;

const OWNER_FILE: &str = ".ott-companion-owner";
const OWNER_MARKER: &[u8] = b"ottplay-companion-cache-v1\n";

/// Keep the operating-system lock alive through any outstanding storage worker.
/// A new process may clean crash leftovers only after acquiring this same lock.
pub struct CacheOwner {
    _lock: File,
}

impl Drop for CacheOwner {
    fn drop(&mut self) {
        // The last Arc marks the end of every owning storage worker. Closing
        // this descriptor alone can leave its lock alive in a child between
        // fork and exec, so release it explicitly before closing the file.
        let _ = self._lock.unlock();
    }
}

pub async fn prepare_root(root: &Path) -> anyhow::Result<Arc<CacheOwner>> {
    let root = root.to_owned();
    tokio::task::spawn_blocking(move || prepare_root_sync(&root)).await?
}

fn valid_lease_name(name: &str) -> bool {
    name.len() == 42
        && name.starts_with("lease-")
        && name.ends_with(".bin")
        && name[6..38].bytes().all(|v| v.is_ascii_hexdigit())
}

fn regular_private_file(path: &Path) -> anyhow::Result<std::fs::Metadata> {
    let metadata = std::fs::symlink_metadata(path)?;
    anyhow::ensure!(
        metadata.is_file() && !metadata.file_type().is_symlink(),
        "Invalid companion cache entry"
    );
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        anyhow::ensure!(metadata.nlink() == 1, "Invalid companion cache entry");
    }
    Ok(metadata)
}

fn prepare_root_sync(root: &Path) -> anyhow::Result<Arc<CacheOwner>> {
    std::fs::create_dir_all(root)?;
    let metadata = std::fs::symlink_metadata(root)?;
    anyhow::ensure!(
        metadata.is_dir() && !metadata.file_type().is_symlink(),
        "Companion cache must be a directory"
    );
    let marker = root.join(OWNER_FILE);
    let created = match std::fs::symlink_metadata(&marker) {
        Ok(_) => {
            regular_private_file(&marker)?;
            false
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            anyhow::ensure!(
                std::fs::read_dir(root)?.next().is_none(),
                "Unowned companion cache must be empty"
            );
            true
        }
        Err(error) => return Err(error.into()),
    };
    let mut options = OpenOptions::new();
    options.read(true).write(true);
    if created {
        options.create_new(true);
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600).custom_flags(libc::O_NOFOLLOW);
    }
    let mut file = options.open(&marker)?;
    file.try_lock()
        .map_err(|_| anyhow::anyhow!("Companion cache already in use"))?;
    if created {
        file.write_all(OWNER_MARKER)?;
        file.sync_all()?;
    } else {
        anyhow::ensure!(
            file.metadata()?.len() == OWNER_MARKER.len() as u64,
            "Invalid companion cache owner"
        );
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)?;
        anyhow::ensure!(bytes == OWNER_MARKER, "Invalid companion cache owner");
    }
    // Validate every entry before deleting anything; an unknown file prevents
    // cleanup, including previously recognized lease files.
    let mut leftovers = Vec::new();
    for entry in std::fs::read_dir(root)? {
        let entry = entry?;
        let name = entry.file_name();
        if name == OWNER_FILE {
            continue;
        }
        anyhow::ensure!(leftovers.len() < 1024, "Companion cache needs maintenance");
        let name = name
            .to_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid companion cache entry"))?;
        anyhow::ensure!(
            valid_lease_name(name),
            "Companion cache must be a dedicated directory"
        );
        regular_private_file(&entry.path())?;
        leftovers.push(entry.path());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(root, std::fs::Permissions::from_mode(0o700))?;
        file.set_permissions(std::fs::Permissions::from_mode(0o600))?;
    }
    for path in leftovers {
        std::fs::remove_file(path)?;
    }
    Ok(Arc::new(CacheOwner { _lock: file }))
}
pub struct Reservation {
    budget: Arc<AtomicU64>,
    bytes: u64,
}
impl Reservation {
    pub fn new(budget: Arc<AtomicU64>, bytes: u64) -> Result<Self, &'static str> {
        budget
            .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |value| {
                value.checked_add(bytes).filter(|v| *v <= CACHE_LIMIT)
            })
            .map_err(|_| "cache_limit")?;
        Ok(Self { budget, bytes })
    }
}
impl Drop for Reservation {
    fn drop(&mut self) {
        self.budget.fetch_sub(self.bytes, Ordering::SeqCst);
    }
}
pub struct WindowInner {
    _owner: Option<Arc<CacheOwner>>,
    initialized: AtomicBool,
    file: Mutex<Option<File>>,
    path: PathBuf,
    reservation: Option<Reservation>,
    cancel: CancellationToken,
    start: u64,
    end: u64,
    offsets: Vec<(u64, u64)>,
}
impl WindowInner {
    pub fn new(
        path: PathBuf,
        reservation: Reservation,
        cancel: CancellationToken,
        start: u64,
        end: u64,
        files: &[MediaFile],
        owner: Option<Arc<CacheOwner>>,
    ) -> Result<Self, &'static str> {
        let mut opts = OpenOptions::new();
        opts.create_new(true).read(true).write(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            opts.mode(0o600);
        }
        let file = opts.open(&path).map_err(|_| "cache_unavailable")?;
        if file.set_len(end - start).is_err() {
            drop(file);
            let _ = std::fs::remove_file(&path);
            return Err("cache_unavailable");
        }
        let mut cursor = 0;
        let offsets = files
            .iter()
            .map(|f| {
                let offset = cursor;
                cursor += f.length;
                (offset, f.length)
            })
            .collect();
        Ok(Self {
            _owner: owner,
            initialized: AtomicBool::new(false),
            file: Mutex::new(Some(file)),
            path,
            reservation: Some(reservation),
            cancel,
            start,
            end,
            offsets,
        })
    }
    fn offset(&self, index: usize, offset: u64, size: usize) -> anyhow::Result<u64> {
        let (base, length) = *self
            .offsets
            .get(index)
            .ok_or_else(|| anyhow::anyhow!("Invalid file"))?;
        let end = offset
            .checked_add(size as u64)
            .ok_or_else(|| anyhow::anyhow!("Invalid range"))?;
        anyhow::ensure!(
            end <= length && base + offset >= self.start && base + end <= self.end,
            "Range outside selected pieces"
        );
        Ok(base + offset - self.start)
    }
}
impl Drop for WindowInner {
    fn drop(&mut self) {
        lock(&self.file).take();
        // If removal fails, disk remains charged. The next exclusive owner will remove the leftover file.
        if std::fs::remove_file(&self.path).is_err() {
            if let Some(mut reservation) = self.reservation.take() {
                reservation.bytes = 0;
            }
        }
    }
}
#[derive(Clone)]
pub struct WindowFactory(pub Arc<WindowInner>);
pub struct WindowStorage(Mutex<Option<Arc<WindowInner>>>);
impl StorageFactory for WindowFactory {
    type Storage = WindowStorage;
    fn create(
        &self,
        _: &librqbit::ManagedTorrentShared,
        _: &librqbit::TorrentMetadata,
    ) -> anyhow::Result<Self::Storage> {
        Ok(WindowStorage(Mutex::new(Some(self.0.clone()))))
    }
    fn clone_box(&self) -> BoxStorageFactory {
        self.clone().boxed()
    }
}
impl WindowStorage {
    fn inner(&self) -> anyhow::Result<Arc<WindowInner>> {
        lock(&self.0)
            .clone()
            .ok_or_else(|| anyhow::anyhow!("Storage retired"))
    }
}
impl TorrentStorage for WindowStorage {
    fn init(
        &mut self,
        _: &librqbit::ManagedTorrentShared,
        _: &librqbit::TorrentMetadata,
    ) -> anyhow::Result<()> {
        Ok(())
    }
    fn pread_exact(&self, index: usize, offset: u64, bytes: &mut [u8]) -> anyhow::Result<()> {
        let inner = self.inner()?;
        anyhow::ensure!(
            inner.initialized.load(Ordering::Acquire),
            "Fresh cache has no verified data"
        );
        let offset = inner.offset(index, offset, bytes.len())?;
        let mut guard = lock(&inner.file);
        anyhow::ensure!(!inner.cancel.is_cancelled(), "Storage retired");
        let file = guard
            .as_mut()
            .ok_or_else(|| anyhow::anyhow!("Storage retired"))?;
        file.seek(SeekFrom::Start(offset))?;
        file.read_exact(bytes)?;
        Ok(())
    }
    fn pwrite_all(&self, index: usize, offset: u64, bytes: &[u8]) -> anyhow::Result<()> {
        let inner = self.inner()?;
        let offset = inner.offset(index, offset, bytes.len())?;
        let mut guard = lock(&inner.file);
        anyhow::ensure!(!inner.cancel.is_cancelled(), "Storage retired");
        let file = guard
            .as_mut()
            .ok_or_else(|| anyhow::anyhow!("Storage retired"))?;
        file.seek(SeekFrom::Start(offset))?;
        file.write_all(bytes)?;
        Ok(())
    }
    fn remove_file(&self, _: usize, _: &Path) -> anyhow::Result<()> {
        Ok(())
    }
    fn remove_directory_if_empty(&self, _: &Path) -> anyhow::Result<()> {
        Ok(())
    }
    fn ensure_file_length(&self, index: usize, length: u64) -> anyhow::Result<()> {
        let inner = self.inner()?;
        anyhow::ensure!(
            inner
                .offsets
                .get(index)
                .is_some_and(|(_, len)| *len == length),
            "Invalid length"
        );
        inner.initialized.store(true, Ordering::Release);
        Ok(())
    }
    fn take(&self) -> anyhow::Result<Box<dyn TorrentStorage>> {
        let inner = lock(&self.0)
            .take()
            .ok_or_else(|| anyhow::anyhow!("Storage retired"))?;
        Ok(Box::new(Self(Mutex::new(Some(inner)))))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cache_window_prevents_outside_writes_and_retires_with_its_lease() {
        let dir =
            std::env::temp_dir().join(format!("ott-window-test-{}", uuid::Uuid::new_v4().simple()));
        std::fs::create_dir(&dir).unwrap();
        let path = dir.join("cache.bin");
        let budget = Arc::new(AtomicU64::new(0));
        let token = CancellationToken::new();
        let files = vec![
            MediaFile {
                index: 0,
                name: "../ignored-name".into(),
                length: 16,
            },
            MediaFile {
                index: 1,
                name: "selected.mp4".into(),
                length: 16,
            },
            MediaFile {
                index: 2,
                name: "tail".into(),
                length: 16,
            },
        ];
        let inner = Arc::new(
            WindowInner::new(
                path.clone(),
                Reservation::new(budget.clone(), 32).unwrap(),
                token.clone(),
                8,
                40,
                &files,
                None,
            )
            .unwrap(),
        );
        let store = WindowStorage(Mutex::new(Some(inner.clone())));
        assert_eq!(budget.load(Ordering::SeqCst), 32);
        assert!(
            store.pread_exact(1, 0, &mut [0; 4]).is_err(),
            "fresh cache must not be hashed as existing data"
        );
        store.ensure_file_length(1, 16).unwrap();
        store.pwrite_all(1, 0, b"test").unwrap();
        let mut bytes = [0; 4];
        store.pread_exact(1, 0, &mut bytes).unwrap();
        assert_eq!(&bytes, b"test");
        assert!(store.pwrite_all(0, 0, b"outside").is_err());
        assert!(store.pwrite_all(2, 9, b"outside").is_err());
        token.cancel();
        assert!(store.pwrite_all(1, 4, b"late").is_err());
        drop(store);
        drop(inner);
        assert_eq!(budget.load(Ordering::SeqCst), 0);
        assert!(!path.exists());
        std::fs::remove_dir(&dir).unwrap();
    }
    #[tokio::test]
    async fn exclusive_owner_reclaims_only_validated_crash_leftovers() {
        let dir =
            std::env::temp_dir().join(format!("ott-cache-owner-{}", uuid::Uuid::new_v4().simple()));
        let owner = prepare_root(&dir).await.unwrap();
        assert!(
            prepare_root(&dir).await.is_err(),
            "another owner cannot use the same cache"
        );
        let stale = dir.join("lease-0123456789abcdef0123456789abcdef.bin");
        std::fs::write(&stale, b"interrupted download").unwrap();
        assert!(prepare_root(&dir).await.is_err());
        assert!(stale.exists(), "active owner contents are not cleaned");
        drop(owner);
        let next = prepare_root(&dir).await.unwrap();
        assert!(!stale.exists(), "exclusive restart reclaims the old cache");
        assert!(dir.join(OWNER_FILE).exists());
        drop(next);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn last_owner_releases_lock_despite_an_inherited_descriptor() {
        let dir = std::env::temp_dir().join(format!(
            "ott-cache-inherited-{}",
            uuid::Uuid::new_v4().simple()
        ));
        let owner = prepare_root_sync(&dir).unwrap();
        // A child between fork and exec holds the same open file description,
        // even though Rust opens the descriptor with close-on-exec enabled.
        let inherited = owner._lock.try_clone().unwrap();
        let worker = owner.clone();
        drop(owner);
        assert!(
            prepare_root_sync(&dir).is_err(),
            "a worker still owns the cache"
        );
        drop(worker);
        let next = prepare_root_sync(&dir).unwrap();
        drop(inherited);
        assert!(
            prepare_root_sync(&dir).is_err(),
            "closing the old descriptor must not unlock the new owner"
        );
        drop(next);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[tokio::test]
    async fn unknown_entries_or_bad_owner_prevent_any_cleanup() {
        let dir = std::env::temp_dir().join(format!(
            "ott-cache-preserve-{}",
            uuid::Uuid::new_v4().simple()
        ));
        let owner = prepare_root(&dir).await.unwrap();
        drop(owner);
        let stale = dir.join("lease-0123456789abcdef0123456789abcdef.bin");
        let user_file = dir.join("my-video.mp4");
        std::fs::write(&stale, b"cache").unwrap();
        std::fs::write(&user_file, b"personal file").unwrap();
        assert!(prepare_root(&dir).await.is_err());
        assert_eq!(std::fs::read(&stale).unwrap(), b"cache");
        assert_eq!(std::fs::read(&user_file).unwrap(), b"personal file");
        std::fs::remove_file(user_file).unwrap();
        std::fs::write(dir.join(OWNER_FILE), b"another service").unwrap();
        assert!(prepare_root(&dir).await.is_err());
        assert!(stale.exists());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn symlink_cache_entries_and_unowned_directories_are_preserved() {
        let dir =
            std::env::temp_dir().join(format!("ott-cache-link-{}", uuid::Uuid::new_v4().simple()));
        let owner = prepare_root(&dir).await.unwrap();
        drop(owner);
        let outside = dir.with_extension("outside");
        std::fs::write(&outside, b"personal file").unwrap();
        let stale = dir.join("lease-0123456789abcdef0123456789abcdef.bin");
        std::os::unix::fs::symlink(&outside, &stale).unwrap();
        assert!(prepare_root(&dir).await.is_err());
        assert!(std::fs::symlink_metadata(&stale)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(std::fs::read(&outside).unwrap(), b"personal file");
        std::fs::remove_file(stale).unwrap();
        std::fs::remove_file(dir.join(OWNER_FILE)).unwrap();
        std::fs::write(dir.join("user-file"), b"user").unwrap();
        assert!(prepare_root(&dir).await.is_err());
        assert!(
            !dir.join(OWNER_FILE).exists(),
            "an unowned directory is never adopted"
        );
        std::fs::remove_dir_all(dir).unwrap();
        std::fs::remove_file(outside).unwrap();
    }

    #[test]
    fn reservation_never_exceeds_global_cache_limit() {
        let budget = Arc::new(AtomicU64::new(CACHE_LIMIT - 8));
        let last = Reservation::new(budget.clone(), 8).unwrap();
        assert!(Reservation::new(budget.clone(), 1).is_err());
        drop(last);
        assert_eq!(budget.load(Ordering::SeqCst), CACHE_LIMIT - 8);
    }
}
