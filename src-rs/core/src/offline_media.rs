//! Local media: private server imports and native-picked, read-only source references.
//! HTTP requests select opaque IDs only. Explicit native commands may link folders.
#[path = "offline_media_compat.rs"]
mod compatibility_routes;
use axum::{
    body::{Body, Bytes},
    extract::{DefaultBodyLimit, Path, Query, State},
    http::{HeaderMap, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};

use futures_util::{stream, StreamExt};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    path::{Path as FsPath, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU8, Ordering},
        Arc,
    },
};
use tokio::{
    fs,
    io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt},
    sync::{watch, Mutex, Semaphore},
};

const MAX_BYTES: u64 = 16 * 1024 * 1024 * 1024;
pub const NATIVE_SOURCE_OVERLAP: &str =
    "Local folder overlaps an existing source; use the connected source or disconnect it before linking this folder";
pub const NATIVE_SOURCE_LIMIT: &str =
    "Local media supports up to 32 connected sources; disconnect a source before adding another";

/// A filesystem check of the requested folder failed before metadata or playback changes.
/// Native callers can classify this without inspecting filesystem error text or paths.
#[derive(Debug)]
pub struct NativeSourceUnavailable;

impl std::fmt::Display for NativeSourceUnavailable {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("Requested local folder is unavailable")
    }
}

impl std::error::Error for NativeSourceUnavailable {}

#[derive(Debug)]
struct NativeProbeDeadline {
    admitted: bool,
}

impl std::fmt::Display for NativeProbeDeadline {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("Local folder read timed out")
    }
}

impl std::error::Error for NativeProbeDeadline {}

const NATIVE_SOURCE_PROBE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(15);
const MAX_NATIVE_SCAN_ENTRIES: usize = 100_000;
const SOURCE_PROBE_CONCURRENCY: usize = 4;
const LIBRARY_PROBE_CONCURRENCY: usize = 8;
const EARLY_METADATA_ENTRIES: usize = 256;
const EARLY_DIRECTORY_ENTRIES: usize = 64;
const EARLY_SOURCE_CANDIDATES: usize = 4;
const EARLY_INDEX_BYTES: u64 = 64 * 1024;
const NATIVE_SCAN_LIMIT: &str = "Selected source exceeds the 100,000-entry scan limit";

fn count_native_scan_entry(count: &mut usize) -> anyhow::Result<()> {
    anyhow::ensure!(*count < MAX_NATIVE_SCAN_ENTRIES, NATIVE_SCAN_LIMIT);
    *count += 1;
    Ok(())
}
#[derive(PartialEq)]
struct DirectoryStamp {
    modified: Option<std::time::SystemTime>,
    #[cfg(unix)]
    identity: (u64, u64, i64, i64),
}
impl DirectoryStamp {
    fn from_metadata(metadata: &std::fs::Metadata) -> Self {
        #[cfg(unix)]
        use std::os::unix::fs::MetadataExt;
        Self {
            modified: metadata.modified().ok(),
            #[cfg(unix)]
            identity: (
                metadata.dev(),
                metadata.ino(),
                metadata.ctime(),
                metadata.ctime_nsec(),
            ),
        }
    }
}
struct ScanDirectory {
    path: PathBuf,
    stamp: DirectoryStamp,
    entries: fs::ReadDir,
}

// An abandoned upload is never catalogued. Drop its file handle before the
// best-effort removal of its partial file (including cancelled requests).
struct PendingUpload {
    file: Option<fs::File>,
    path: PathBuf,
}
impl Drop for PendingUpload {
    fn drop(&mut self) {
        drop(self.file.take());
        let _ = std::fs::remove_file(&self.path);
    }
}

#[derive(Clone)]
pub struct Library {
    root: PathBuf,
    token: String,
    storage: String,
    mutation: Arc<Mutex<()>>,
    uploads: Arc<Mutex<()>>,
    source_workers: Arc<Mutex<HashMap<String, Arc<Mutex<()>>>>>,
    metadata_reads: Arc<Semaphore>,
    source_probes: Arc<Semaphore>,
    scan: Arc<Mutex<ScanState>>,
    background: crate::background_work::BackgroundWork,
    read_only_paths: Option<Arc<Vec<PathBuf>>>,
    compatibility: Option<crate::local_compatibility::Manager>,
    #[cfg(test)]
    original_checks: Arc<std::sync::Mutex<Vec<PathBuf>>>,
    #[cfg(test)]
    native_source_probe_gate: Option<(PathBuf, Arc<Semaphore>)>,
    #[cfg(test)]
    native_source_probe_timeout: Option<std::time::Duration>,
    #[cfg(test)]
    native_source_records_gate: Option<Arc<Semaphore>>,
    #[cfg(test)]
    native_registration_gate: Option<(RegistrationStep, Arc<Semaphore>, Arc<Semaphore>)>,
    #[cfg(test)]
    scan_entry_limit: usize,
    #[cfg(test)]
    metadata_read_gate: Option<Arc<Mutex<()>>>,
    #[cfg(test)]
    metadata_bootstrap_gate: Option<Arc<Semaphore>>,
    #[cfg(test)]
    source_metadata_gate: Option<Arc<Semaphore>>,
    #[cfg(test)]
    force_early_source_miss: bool,
    #[cfg(test)]
    early_metadata_entries: Arc<std::sync::atomic::AtomicUsize>,
    #[cfg(test)]
    original_read_delay: Option<std::time::Duration>,
    #[cfg(test)]
    original_read_gate: Option<(PathBuf, Arc<Semaphore>)>,
    #[cfg(test)]
    scan_entries: Arc<std::sync::Mutex<Vec<PathBuf>>>,
    #[cfg(test)]
    scan_leaf_metadata: Arc<std::sync::Mutex<Vec<PathBuf>>>,
    #[cfg(test)]
    scan_entry_gate: Option<(PathBuf, Arc<Semaphore>)>,
    #[cfg(test)]
    scan_directories: Arc<std::sync::Mutex<Vec<PathBuf>>>,
    #[cfg(test)]
    scan_directory_gate: Option<(PathBuf, Arc<Semaphore>)>,
}
#[derive(Default)]
struct ScanState {
    jobs: usize,
    work_epoch: Option<u64>,
    scanned: u64,
    records: std::collections::HashMap<String, (Record, bool)>,
    cached: bool,
    revision: u64,
    error: Option<String>,
    preferred: Option<Preferred>,
    source_scans: HashMap<String, SourceScan>,
    next_source_generation: u64,
    // Disconnect can race a metadata read. IDs are never reused by a new
    // binding, so a scoped tombstone rejects only the removed source/item.
    revoked_ids: HashSet<String>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceScan {
    source_id: String,
    generation: u64,
    state: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip)]
    available: Option<bool>,
}

/// Admission for one registration; cancellation never stops shared scans.
#[derive(Clone)]
pub struct NativeRequest {
    state: Arc<AtomicU8>,
    deadline_ms: u64,
    cancelled: watch::Sender<bool>,
}
impl NativeRequest {
    pub fn new(deadline_ms: u64) -> Self {
        Self {
            state: Arc::new(AtomicU8::new(0)),
            deadline_ms,
            cancelled: watch::channel(false).0,
        }
    }
    pub fn cancel(&self) {
        if self
            .state
            .compare_exchange(0, 1, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
        {
            self.cancelled.send_replace(true);
        }
    }
    pub fn expired(&self) -> bool {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(true, |now| now.as_millis() >= u128::from(self.deadline_ms))
    }
    pub fn check(&self) -> anyhow::Result<()> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_millis();
        anyhow::ensure!(
            self.state.load(Ordering::SeqCst) != 1 && now < u128::from(self.deadline_ms),
            "Local folder request expired"
        );
        Ok(())
    }
    // Only pre-commit waits: cancellation cannot undo a durable registration.
    // Filesystem callers must use owned_read so dropping this future does not
    // release the worker's accounting or permit before its syscall drains.
    async fn run<T>(&self, future: impl std::future::Future<Output = T>) -> anyhow::Result<T> {
        let mut cancelled = self.cancelled.subscribe();
        self.check()?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_millis();
        let remaining = u128::from(self.deadline_ms).saturating_sub(now) as u64;
        let deadline = async {
            if self.deadline_ms == u64::MAX {
                std::future::pending::<()>().await;
            } else {
                tokio::time::sleep(std::time::Duration::from_millis(remaining)).await;
            }
        };
        tokio::select! {
            biased;
            _ = cancelled.changed() => anyhow::bail!("Local folder request expired"),
            _ = deadline => anyhow::bail!("Local folder request expired"),
            value = future => {
                self.check()?;
                Ok(value)
            }
        }
    }

    fn commit(&self) -> anyhow::Result<()> {
        self.check()?;
        self.state
            .compare_exchange(0, 2, Ordering::SeqCst, Ordering::SeqCst)
            .map_err(|_| anyhow::anyhow!("Local folder request expired"))?;
        Ok(())
    }
}
// Dropping an invoke abandons only its uncommitted registration. The worker
// still owns its mutation lock and lease while submitted filesystem I/O drains.
struct NativeRegistrationCaller(NativeRequest);
impl Drop for NativeRegistrationCaller {
    fn drop(&mut self) {
        self.0.cancel();
    }
}

#[cfg(test)]
#[derive(Clone, Copy, PartialEq, Eq)]
enum RegistrationStep {
    Index,
    Part,
    Commit,
}

// Flush even after a failed write before returning ownership to cleanup.
async fn write_registration_file(
    path: &FsPath,
    bytes: &[u8],
    created: &mut bool,
) -> std::io::Result<()> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .await?;
    *created = true;
    let written = file.write_all(bytes).await;
    let flushed = file.flush().await;
    written.and(flushed)
}

impl ScanState {
    // Call only inside the lease's publication gate with the scan lock held.
    // Old epochs remain accounted for by BackgroundWork.pending, but cannot
    // block or mutate the current epoch's catalog.
    fn adopt_epoch(&mut self, epoch: u64) {
        if self.work_epoch.is_some_and(|current| current != epoch) {
            if self.jobs > 0
                || self
                    .source_scans
                    .values()
                    .any(|state| matches!(state.state, "pending" | "scanning"))
            {
                self.invalidate();
                self.records.clear();
                self.scanned = 0;
                self.error = None;
            }
            self.jobs = 0;
        }
        self.work_epoch = Some(epoch);
    }

    fn finish_job(&mut self, work: &crate::background_work::WorkLease, error: Option<String>) {
        if self.work_epoch != Some(work.epoch()) {
            return;
        }
        let remaining = self.jobs.saturating_sub(1);
        if work
            .publish(|| {
                if let Some(error) = error {
                    self.error = Some(error);
                }
                self.jobs = remaining;
            })
            .is_err()
        {
            self.invalidate();
            self.error = Some("Local media scan cancelled".into());
            self.jobs = remaining;
        }
    }

    fn invalidate(&mut self) {
        self.cached = false;
        self.preferred = None;
        self.revision = self.revision.wrapping_add(1);
        self.source_scans.clear();
    }

    fn cache_preferred(&mut self, preferred: Option<(u64, Option<Record>, Preferred)>) {
        if let Some((revision, record, status)) = preferred {
            // A source can be disconnected while the direct lookup is awaiting
            // filesystem I/O. Never resurrect that entry in a newer snapshot.
            if self.cached && self.revision == revision {
                if let Some(record) = record {
                    self.records.insert(record.id.clone(), (record, true));
                }
                self.preferred = Some(status);
            }
        }
    }
}
#[derive(Clone, Serialize)]
pub struct Preferred {
    id: String,
    state: &'static str,
}

#[derive(Clone, Serialize, Deserialize)]
struct Record {
    id: String,
    name: String,
    size: u64,
    mime: String,
    extension: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    linked_path: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    source_id: Option<String>,
}
#[derive(Clone, Serialize, Deserialize)]
struct SourceRecord {
    id: String,
    name: String,
    kind: String,
    path: PathBuf,
}
#[derive(Serialize)]
pub struct Source {
    id: String,
    name: String,
    kind: String,
    available: bool,
    access: &'static str,
}
/// Native-only source metadata. Paths never enter the HTTP catalog and are
/// returned only when the caller explicitly requests a private source export.
#[derive(Clone, Serialize)]
pub struct NativeSource {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<PathBuf>,
}

// Keep OS canonical paths for IO and identity, but make private exports usable
// by the CLI's ordinary absolute-path contract (including Windows UNC shares).
fn native_source_export_path(path: &FsPath) -> PathBuf {
    if let Some(value) = path.to_str() {
        if let Some(unc) = value.strip_prefix(r"\\?\UNC\") {
            return PathBuf::from(format!("//{}", unc.replace('\\', "/")));
        }
        if let Some(drive) = value.strip_prefix(r"\\?\") {
            let bytes = drive.as_bytes();
            if bytes.len() >= 3
                && bytes[0].is_ascii_alphabetic()
                && bytes[1] == b':'
                && bytes[2] == b'\\'
            {
                return PathBuf::from(drive);
            }
        }
    }
    path.to_path_buf()
}
#[derive(Serialize)]
pub struct Item {
    pub id: String,
    pub name: String,
    pub directory: String,
    /// Portable path beneath the bound folder, never a physical mount path.
    /// Explicit null distinguishes an unportable item from a legacy catalog.
    #[serde(rename = "relativePath")]
    pub relative_path: Option<String>,
    pub size: u64,
    pub mime: String,
    pub url: String,
    pub available: bool,
    pub source: &'static str,
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub playback: Option<crate::local_compatibility::Playback>,
}
// Source IDs bind paths to their selected root. An ambiguous ID must not
// acquire a portable path merely because one of its roots happened to be last.
fn catalog_source_roots(sources: &[SourceRecord]) -> HashMap<&str, Option<&FsPath>> {
    let mut roots = HashMap::new();
    for source in sources {
        roots
            .entry(source.id.as_str())
            .and_modify(|root| *root = None)
            .or_insert_with(|| (source.kind == "folder").then_some(source.path.as_path()));
    }
    roots
}

fn linked_relative_path(record: &Record, roots: &HashMap<&str, Option<&FsPath>>) -> Option<String> {
    use std::path::Component;
    let root = roots.get(record.source_id.as_deref()?)?.as_ref()?;
    let path = record.linked_path.as_deref()?;
    // Scanning already validates originals for playback. This projection is
    // purely lexical, so catalog polling adds no per-file filesystem requests.
    // Reject malformed metadata instead of repairing it or exporting lossy text.
    root.to_str()?;
    path.to_str()?;
    if !root.is_absolute()
        || !path.is_absolute()
        || root
            .components()
            .any(|part| matches!(part, Component::ParentDir))
    {
        return None;
    }
    let mut segments = Vec::new();
    for part in path.strip_prefix(root).ok()?.components() {
        let Component::Normal(segment) = part else {
            return None;
        };
        let segment = segment.to_str()?;
        if segment.contains('\\')
            || segment
                .chars()
                .any(|c| matches!(c, '\u{0}'..='\u{1f}' | '\u{7f}'))
        {
            return None;
        }
        segments.push(segment);
    }
    let relative = segments.join("/");
    let bytes = relative.as_bytes();
    // Match the portable Favorites codec's ECMAScript whitespace boundaries.
    let edge_whitespace = |c: char| {
        matches!(c,
        '\u{9}'..='\u{d}' | '\u{20}' | '\u{a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}'
        | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}')
    };
    if relative.is_empty()
        || relative.encode_utf16().count() > 8192
        || relative.starts_with(edge_whitespace)
        || relative.ends_with(edge_whitespace)
        || (bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':')
    {
        return None;
    }
    Some(relative)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub available: bool,
    pub items: Vec<Item>,
    pub storage: String,
    pub persistent: bool,
    pub upload_url: String,
    pub direct_sources: bool,
    pub read_only: bool,
    pub sources: Vec<Source>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub source_scans: Vec<SourceScan>,
    pub scanning: bool,
    pub scanned: u64,
    pub total: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scan_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preferred: Option<Preferred>,
    pub compatibility: crate::local_compatibility::Capability,
}
#[derive(Deserialize)]
struct ImportQuery {
    name: String,
}
#[derive(Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct CatalogQuery {
    refresh: bool,
    preferred_id: Option<String>,
}

type Failure = (StatusCode, &'static str);
const BACKGROUND_CANCELLED: Failure = (
    StatusCode::SERVICE_UNAVAILABLE,
    "Player background work cancelled",
);

struct ReadCaller(watch::Sender<bool>);
impl Drop for ReadCaller {
    fn drop(&mut self) {
        self.0.send_replace(true);
    }
}

#[derive(Clone)]
struct ReadWork {
    lease: crate::background_work::WorkLease,
    abandoned: watch::Receiver<bool>,
    deadline: Option<std::time::Instant>,
}
impl ReadWork {
    fn check(&self) -> Result<(), Failure> {
        if self
            .deadline
            .is_some_and(|deadline| std::time::Instant::now() >= deadline)
            || *self.abandoned.borrow()
        {
            return Err(BACKGROUND_CANCELLED);
        }
        self.lease.check().map_err(|_| BACKGROUND_CANCELLED)
    }

    fn publish<T>(&self, publish: impl FnOnce() -> T) -> Result<T, Failure> {
        // Serialize caller abandonment with the short cache publication, just
        // as the lease serializes it with a global standby transition.
        let abandoned = self.abandoned.borrow();
        if *abandoned {
            return Err(BACKGROUND_CANCELLED);
        }
        self.lease
            .publish(publish)
            .map_err(|_| BACKGROUND_CANCELLED)
    }

    // Only interrupt waits without an in-flight filesystem operation, such as
    // the scan mutex. Actual filesystem futures go through checked() instead.
    async fn run<T>(&self, future: impl std::future::Future<Output = T>) -> Result<T, Failure> {
        let mut abandoned = self.abandoned.clone();
        if *abandoned.borrow_and_update() {
            return Err(BACKGROUND_CANCELLED);
        }
        tokio::select! {
            biased;
            _ = abandoned.changed() => Err(BACKGROUND_CANCELLED),
            value = self.lease.run(future) => {
                self.check()?;
                value.map_err(|_| BACKGROUND_CANCELLED)
            }
        }
    }
}

// Unlike cancellation of a network future, dropping a tokio::fs future does
// not stop its blocking syscall. Keep the owner alive until that call returns,
// but abandon subsequent operations when this particular caller goes away.
async fn owned_read<
    T: Send + 'static,
    F: std::future::Future<Output = Result<T, Failure>> + Send + 'static,
>(
    work: &crate::background_work::WorkLease,
    read: impl FnOnce(ReadWork) -> F + Send + 'static,
) -> Result<T, Failure> {
    owned_read_until(work, None, read).await
}

// A deadline stops admission between syscalls. Always await the owned task:
// a slow filesystem operation must drain before its caller starts more work.
async fn owned_read_until<
    T: Send + 'static,
    F: std::future::Future<Output = Result<T, Failure>> + Send + 'static,
>(
    work: &crate::background_work::WorkLease,
    deadline: Option<std::time::Instant>,
    read: impl FnOnce(ReadWork) -> F + Send + 'static,
) -> Result<T, Failure> {
    work.check().map_err(|_| BACKGROUND_CANCELLED)?;
    let (abandoned, receiver) = watch::channel(false);
    let _caller = ReadCaller(abandoned);
    let owner = ReadWork {
        lease: work.clone(),
        abandoned: receiver,
        deadline,
    };
    let task = tokio::spawn(async move { checked(Some(&owner), read(owner.clone())).await? });
    if deadline.is_some() {
        task.await.map_err(storage_error)?
    } else {
        work.run(task)
            .await
            .map_err(|_| BACKGROUND_CANCELLED)?
            .map_err(storage_error)?
    }
}

// The owned reader must stop between operations, rather than abandon an
// operation already submitted to the filesystem thread pool.
async fn checked<T>(
    work: Option<&ReadWork>,
    operation: impl std::future::Future<Output = T>,
) -> Result<T, Failure> {
    if let Some(work) = work {
        work.check()?;
    }
    let value = operation.await;
    if let Some(work) = work {
        work.check()?;
    }
    Ok(value)
}
impl Library {
    pub async fn new(root: PathBuf, token: String, storage: &str) -> anyhow::Result<Self> {
        anyhow::ensure!(
            token.len() >= 32
                && token
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_'),
            "Offline media token must contain at least 32 URL-safe characters"
        );
        fs::create_dir_all(&root).await?;
        let root = fs::canonicalize(root).await?;
        Ok(Self {
            root,
            token,
            storage: storage.into(),
            mutation: Arc::new(Mutex::new(())),
            uploads: Arc::new(Mutex::new(())),
            source_workers: Arc::new(Mutex::new(HashMap::new())),
            metadata_reads: Arc::new(Semaphore::new(2)),
            source_probes: Arc::new(Semaphore::new(LIBRARY_PROBE_CONCURRENCY)),
            scan: Arc::new(Mutex::new(ScanState::default())),
            background: Default::default(),
            read_only_paths: None,
            compatibility: None,
            #[cfg(test)]
            original_checks: Arc::default(),
            #[cfg(test)]
            native_source_probe_gate: None,
            #[cfg(test)]
            native_source_probe_timeout: None,
            #[cfg(test)]
            native_source_records_gate: None,
            #[cfg(test)]
            native_registration_gate: None,
            #[cfg(test)]
            scan_entry_limit: MAX_NATIVE_SCAN_ENTRIES,
            #[cfg(test)]
            metadata_read_gate: None,
            #[cfg(test)]
            metadata_bootstrap_gate: None,
            #[cfg(test)]
            source_metadata_gate: None,
            #[cfg(test)]
            force_early_source_miss: false,
            #[cfg(test)]
            early_metadata_entries: Arc::default(),
            #[cfg(test)]
            original_read_delay: None,
            #[cfg(test)]
            original_read_gate: None,
            #[cfg(test)]
            scan_entries: Arc::default(),
            #[cfg(test)]
            scan_leaf_metadata: Arc::default(),
            #[cfg(test)]
            scan_entry_gate: None,
            #[cfg(test)]
            scan_directories: Arc::default(),
            #[cfg(test)]
            scan_directory_gate: None,
        })
    }
    /// A token-protected, operator-configured library of original files. The
    /// private metadata directory must be outside every served media tree.
    pub async fn new_read_only(
        root: PathBuf,
        token: String,
        paths: Vec<PathBuf>,
    ) -> anyhow::Result<Self> {
        anyhow::ensure!(
            !paths.is_empty() && paths.len() <= 32,
            "Configure 1 to 32 read-only folders"
        );
        anyhow::ensure!(
            root.is_absolute(),
            "Read-only metadata directory must be absolute"
        );
        let mut canonical_paths = Vec::new();
        for path in paths {
            anyhow::ensure!(
                path.is_absolute(),
                "Read-only folders must be absolute paths"
            );
            let path = fs::canonicalize(path).await?;
            anyhow::ensure!(
                fs::metadata(&path).await?.is_dir(),
                "Read-only source must be a folder"
            );
            if !canonical_paths.contains(&path) {
                canonical_paths.push(path);
            }
        }
        // Check before creating anything: this mode never writes metadata to
        // the media source, including through a symlinked cache parent.
        let canonical_root = match fs::canonicalize(&root).await {
            Ok(path) => path,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                let parent = root
                    .parent()
                    .ok_or_else(|| anyhow::anyhow!("Invalid metadata directory"))?;
                fs::canonicalize(parent).await?.join(
                    root.file_name()
                        .ok_or_else(|| anyhow::anyhow!("Invalid metadata directory"))?,
                )
            }
            Err(error) => return Err(error.into()),
        };
        anyhow::ensure!(canonical_paths.iter().all(|path| !canonical_root.starts_with(path) && !path.starts_with(&canonical_root)), "Metadata directory must be outside read-only media folders");
        let mut library = Self::new(canonical_root, token, "device").await?;
        library.read_only_paths = Some(Arc::new(canonical_paths.clone()));
        library.start_link_paths(canonical_paths, true).await?;
        Ok(library)
    }

    fn allows_record(&self, record: &Record) -> bool {
        self.read_only_paths.as_ref().is_none_or(|roots| {
            record.linked_path.as_ref().is_some_and(|path| {
                roots
                    .iter()
                    .any(|root| path.starts_with(root) && path != root)
            })
        })
    }
    /// Only native instances attach a player gate. A shared server keeps its own
    /// independent default gate and cannot be suspended by a connected player.
    pub fn with_background(mut self, background: crate::background_work::BackgroundWork) -> Self {
        self.compatibility = None;
        self.background = background;
        self
    }
    /// Existing tools only. The input bridge is private, loopback-only, and
    /// exposes the original authenticated range reader, never a URL proxy.
    pub async fn with_compatibility_from_env(mut self) -> Self {
        let Ok(work) = self.background.enter() else {
            return self;
        };
        let Some(tools) = crate::local_compatibility::discover(&work).await else {
            return self;
        };
        let Ok(listener) = tokio::net::TcpListener::bind("127.0.0.1:0").await else {
            return self;
        };
        let Ok(address) = listener.local_addr() else {
            return self;
        };
        let token = format!(
            "{}{}",
            uuid::Uuid::new_v4().simple(),
            uuid::Uuid::new_v4().simple()
        );
        let mut input = self.clone();
        input.token = token.clone();
        input.compatibility = None;
        let router = Router::new()
            .route("/_input/:token/:id", get(media))
            .with_state(input);
        if work.check().is_err() {
            return self;
        }
        let bridge = tokio::spawn(async move {
            let _ = axum::serve(listener, router).await;
        });
        self.compatibility =
            crate::local_compatibility::Manager::new(tools, address, token, bridge).ok();
        self
    }
    pub fn endpoint(&self) -> String {
        format!("/offline-media/{}", self.token)
    }
    pub fn routes(self) -> Router {
        if self.read_only_paths.is_some() {
            return Router::new()
                .route("/offline-media/:token", get(catalog).options(preflight))
                .route("/offline-media/:token/:id", get(media).options(preflight))
                .merge(compatibility_routes::routes(&self))
                .layer(axum::middleware::map_response(
                    |mut response: Response| async move {
                        response.headers_mut().insert(
                            "access-control-allow-methods",
                            HeaderValue::from_static("GET, HEAD, POST, OPTIONS"),
                        );
                        response
                    },
                ))
                .with_state(self);
        }
        // The library is host configuration, not a request extractor. Keep the
        // trusted filesystem root captured by mutation handlers; only tokens
        // and IDs come from the HTTP request.
        let remove_source_library = self.clone();
        let remove_item_library = self.clone();
        Router::new()
            .route("/offline-media/:token", get(catalog).options(preflight))
            .merge(compatibility_routes::routes(&self))
            .route(
                "/offline-media/:token/import",
                post(import).options(preflight),
            )
            .route(
                "/offline-media/:token/sources/:id",
                axum::routing::delete(move |path: Path<(String, String)>| {
                    remove_source(remove_source_library.clone(), path)
                })
                .options(preflight),
            )
            .route(
                "/offline-media/:token/:id",
                get(media)
                    .delete(move |path: Path<(String, String)>| {
                        remove(remove_item_library.clone(), path)
                    })
                    .options(preflight),
            )
            .layer(DefaultBodyLimit::disable())
            .with_state(self)
    }
    fn authorize(&self, token: &str) -> Result<(), Failure> {
        if self.background.status().standby {
            return Err((StatusCode::SERVICE_UNAVAILABLE, "Player is in standby"));
        }
        // Fixed-length comparison avoids early exits on a matching prefix.
        let mut diff = self.token.len() ^ token.len();
        for (a, b) in self.token.bytes().zip(token.bytes()) {
            diff |= (a ^ b) as usize;
        }
        if diff != 0 {
            Err((StatusCode::NOT_FOUND, "Not found"))
        } else {
            Ok(())
        }
    }
    #[cfg(test)]
    async fn records(
        &self,
        work: &crate::background_work::WorkLease,
    ) -> Result<Vec<Record>, Failure> {
        let library = self.clone();
        owned_read(
            work,
            |owner| async move { library.read_records(&owner).await },
        )
        .await
    }
    async fn read_records(&self, work: &ReadWork) -> Result<Vec<Record>, Failure> {
        self.read_records_except_folders(work, &[]).await
    }

    // Only startup calls this with bindings that its subsequent source sweep
    // must scan. Ordinary catalog reads still validate all original paths.
    async fn read_records_except_folders(
        &self,
        work: &ReadWork,
        folders: &[SourceRecord],
    ) -> Result<Vec<Record>, Failure> {
        let mut out = Vec::new();
        for record in self.metadata_records(work, false).await? {
            if valid_id(&record.id)
                && media_type(&record.extension) == Some(record.mime.as_str())
                && self.allows_record(&record)
            {
                if folders.iter().any(|source| {
                    source.kind == "folder"
                        && source.path.is_absolute()
                        && record.source_id.as_deref() == Some(source.id.as_str())
                        && record.linked_path.as_ref().is_some_and(|path| {
                            path != &source.path && path.starts_with(&source.path)
                        })
                }) {
                    continue;
                }
                let available = self.read_path(&record, Some(work)).await.is_ok();
                work.check().map_err(|_| BACKGROUND_CANCELLED)?;
                if record.linked_path.is_none() && !available {
                    continue;
                }
                #[cfg(test)]
                if let Some(gate) = &self.metadata_read_gate {
                    drop(work.run(gate.lock()).await?);
                }
                let mut scan = work
                    .run(self.scan.lock())
                    .await
                    .map_err(|_| BACKGROUND_CANCELLED)?;
                let retained = work
                    .publish(|| {
                        if scan.revoked_ids.contains(&record.id)
                            || record
                                .source_id
                                .as_ref()
                                .is_some_and(|id| scan.revoked_ids.contains(id))
                        {
                            return false;
                        }
                        if scan.jobs > 0
                            && !record
                                .source_id
                                .as_ref()
                                .is_some_and(|id| scan.source_scans.contains_key(id))
                        {
                            scan.scanned += 1;
                            scan.records
                                .insert(record.id.clone(), (record.clone(), available));
                        }
                        true
                    })
                    .map_err(|_| BACKGROUND_CANCELLED)?;
                if retained {
                    out.push(record);
                }
            }
        }
        out.sort_by_cached_key(|record| (record.name.to_lowercase(), record.id.clone()));
        Ok(out)
    }
    // Metadata-only bootstrap never probes an original path. Keep the small
    // local reads on one blocking worker, bounded across all sources/epochs.
    async fn metadata_records(
        &self,
        work: &ReadWork,
        tolerate_read_errors: bool,
    ) -> Result<Vec<Record>, Failure> {
        #[cfg(test)]
        if let Some(gate) = &self.metadata_bootstrap_gate {
            let permit = work.run(gate.acquire()).await?.map_err(storage_error)?;
            permit.forget();
        }
        let queued_at = std::time::Instant::now();
        let permit = work
            .run(self.metadata_reads.clone().acquire_owned())
            .await?
            .map_err(storage_error)?;
        let root = self.root.clone();
        let owner = work.clone();
        tokio::task::spawn_blocking(move || -> Result<Vec<Record>, Failure> {
            use std::io::Read;
            // The owned permit and ReadWork survive a dropped JoinHandle and
            // keep BackgroundWork.pending accurate through the last syscall.
            let _permit = permit;
            owner.check()?;
            let started = std::time::Instant::now();
            tracing::debug!(target: "ottplay::local_scan", phase = "metadata", state = "start", queued_ms = queued_at.elapsed().as_millis() as u64);
            let mut found = Vec::new();
            for entry in std::fs::read_dir(root).map_err(storage_error)? {
                owner.check()?;
                let entry = entry.map_err(storage_error)?;
                if entry.path().extension().and_then(|s| s.to_str()) != Some("json") {
                    continue;
                }
                let metadata = match std::fs::symlink_metadata(entry.path()) {
                    Ok(metadata) => metadata,
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
                    Err(error) => return Err(storage_error(error)),
                };
                if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > 4096
                {
                    continue;
                }
                owner.check()?;
                let read = (|| {
                    let file = std::fs::File::open(entry.path())?;
                    let mut bytes = Vec::with_capacity(metadata.len() as usize);
                    file.take(4097).read_to_end(&mut bytes)?;
                    Ok::<_, std::io::Error>(bytes)
                })();
                match read {
                    Ok(bytes) if bytes.len() <= 4096 => {
                        if let Ok(record) = serde_json::from_slice::<Record>(&bytes) {
                            found.push(record);
                        }
                    }
                    Ok(_) => (),
                    Err(error)
                        if tolerate_read_errors || error.kind() == std::io::ErrorKind::NotFound =>
                    {}
                    Err(error) => return Err(storage_error(error)),
                }
            }
            owner.check()?;
            tracing::debug!(target: "ottplay::local_scan", phase = "metadata", state = "complete", count = found.len(), elapsed_ms = started.elapsed().as_millis() as u64);
            Ok(found)
        })
        .await
        .map_err(storage_error)?
    }

    async fn path(&self, record: &Record) -> Result<PathBuf, Failure> {
        self.read_path(record, None).await
    }
    async fn read_path(
        &self,
        record: &Record,
        work: Option<&ReadWork>,
    ) -> Result<PathBuf, Failure> {
        if !self.allows_record(record) {
            return Err((StatusCode::NOT_FOUND, "Media not found"));
        }
        let path = if let Some(path) = &record.linked_path {
            #[cfg(test)]
            self.original_checks.lock().unwrap().push(path.clone());
            #[cfg(test)]
            if let Some(delay) = self.original_read_delay {
                tokio::time::sleep(delay).await;
            }
            #[cfg(test)]
            if let Some((root, gate)) = &self.original_read_gate {
                if path.starts_with(root) {
                    gate.acquire().await.unwrap().forget();
                }
            }
            // Native-picked originals may live outside the private library.
            // They must still name the same canonical, non-symlinked file.
            if checked(work, fs::canonicalize(path)).await?.ok().as_ref() != Some(path) {
                return Err((StatusCode::GONE, "Original source unavailable"));
            }
            path.clone()
        } else {
            // Keep this boundary local to the filesystem operation, even if a
            // future caller has not passed through metadata validation first.
            if !valid_id(&record.id) || media_type(&record.extension) != Some(record.mime.as_str())
            {
                return Err((StatusCode::NOT_FOUND, "Media not found"));
            }
            let path = self
                .root
                .join(format!("{}.{}", record.id, record.extension));
            if !path.starts_with(&self.root) || path.parent() != Some(self.root.as_path()) {
                return Err((StatusCode::NOT_FOUND, "Media not found"));
            }
            path
        };
        let metadata = checked(work, fs::symlink_metadata(&path))
            .await?
            .map_err(|_| (StatusCode::NOT_FOUND, "Media not found"))?;
        if !metadata.is_file() || metadata.file_type().is_symlink() {
            return Err((StatusCode::NOT_FOUND, "Media not found"));
        }
        Ok(path)
    }
    async fn record(&self, id: &str) -> Result<Record, Failure> {
        self.read_record(id, None).await
    }
    fn metadata_path(&self, id: &str) -> Result<PathBuf, Failure> {
        if !valid_id(id) {
            return Err((StatusCode::NOT_FOUND, "Media not found"));
        }
        let path = self.root.join(format!("{id}.json"));
        if !path.starts_with(&self.root) || path.parent() != Some(self.root.as_path()) {
            return Err((StatusCode::NOT_FOUND, "Media not found"));
        }
        Ok(path)
    }
    async fn read_record(&self, id: &str, work: Option<&ReadWork>) -> Result<Record, Failure> {
        // A range request must not rescan every metadata record before it can
        // return the first video byte from a large library.
        let path = self.metadata_path(id)?;
        let metadata = checked(work, fs::symlink_metadata(&path))
            .await?
            .map_err(|_| (StatusCode::NOT_FOUND, "Media not found"))?;
        if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > 4096 {
            return Err((StatusCode::NOT_FOUND, "Media not found"));
        }
        let bytes = checked(work, fs::read(path))
            .await?
            .map_err(storage_error)?;
        let record: Record = serde_json::from_slice(&bytes).map_err(storage_error)?;
        if bytes.len() > 4096
            || record.id != id
            || media_type(&record.extension) != Some(record.mime.as_str())
            || !self.allows_record(&record)
        {
            return Err((StatusCode::NOT_FOUND, "Media not found"));
        }
        Ok(record)
    }
    async fn source_records(&self) -> Result<Vec<SourceRecord>, Failure> {
        self.read_source_records(None).await
    }
    async fn read_source_records(
        &self,
        work: Option<&ReadWork>,
    ) -> Result<Vec<SourceRecord>, Failure> {
        let folder = self.root.join("sources");
        checked(work, fs::create_dir_all(&folder))
            .await?
            .map_err(storage_error)?;
        let mut entries = checked(work, fs::read_dir(folder))
            .await?
            .map_err(storage_error)?;
        let mut sources = Vec::new();
        while let Some(entry) = checked(work, entries.next_entry())
            .await?
            .map_err(storage_error)?
        {
            let kind = match checked(work, entry.file_type()).await? {
                Ok(kind) => kind,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
                Err(error) => return Err(storage_error(error)),
            };
            if !kind.is_file() || entry.path().extension().and_then(|x| x.to_str()) != Some("json")
            {
                continue;
            }
            let metadata = match checked(work, entry.metadata()).await? {
                Ok(metadata) => metadata,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
                Err(error) => return Err(storage_error(error)),
            };
            if metadata.len() > 16384 {
                continue;
            }
            if let Ok(bytes) = checked(work, fs::read(entry.path())).await? {
                if let Ok(source) = serde_json::from_slice::<SourceRecord>(&bytes) {
                    if valid_id(&source.id)
                        && self.read_only_paths.as_ref().is_none_or(|roots| {
                            source.kind == "folder" && roots.contains(&source.path)
                        })
                    {
                        sources.push(source);
                    }
                }
            }
        }
        Ok(sources)
    }

    /// Read native source bindings without rescanning files or exposing paths
    /// through the token-authenticated HTTP library API.
    pub async fn native_sources(
        &self,
        include_paths: bool,
        path_filter: Option<PathBuf>,
    ) -> anyhow::Result<Vec<NativeSource>> {
        self.native_sources_selected(include_paths, path_filter, None)
            .await
    }

    pub async fn native_sources_selected(
        &self,
        include_paths: bool,
        path_filter: Option<PathBuf>,
        selection: Option<&str>,
    ) -> anyhow::Result<Vec<NativeSource>> {
        anyhow::ensure!(
            self.storage == "device" && self.read_only_paths.is_none(),
            "Native source bindings are unavailable on this server"
        );
        anyhow::ensure!(
            selection.is_none_or(|value| !value.is_empty()
                && value.len() <= 512
                && !value.chars().any(char::is_control)),
            "Invalid local source selection"
        );
        anyhow::ensure!(
            selection.is_none() || path_filter.is_none(),
            "Select a source by name or path, not both"
        );
        let work = self.background.enter().map_err(anyhow::Error::msg)?;
        let deadline = self.native_probe_deadline();
        let path_filter = match path_filter {
            Some(path) => Some(
                self.native_folder_probe_until(path, &work, deadline)
                    .await?
                    .ok_or(NativeSourceUnavailable)?,
            ),
            None => None,
        };
        let library = self.clone();
        let mut sources = Self::native_read(
            self.metadata_reads.clone(),
            &work,
            Some(deadline),
            move |owner| async move {
                #[cfg(test)]
                if let Some(gate) = &library.native_source_records_gate {
                    let _gate = checked(Some(&owner), gate.acquire())
                        .await?
                        .map_err(storage_error)?;
                }
                library.read_source_records(Some(&owner)).await
            },
        )
        .await
        .map_err(|error| {
            if error.is::<NativeProbeDeadline>() {
                error
            } else if let Err(message) = work.check() {
                anyhow::anyhow!(message)
            } else {
                anyhow::anyhow!("Cannot read media sources")
            }
        })?;
        if let Some(selection) = selection {
            let by_id = sources.iter().any(|source| source.id == selection);
            sources.retain(|source| {
                if by_id {
                    source.id == selection
                } else {
                    source.name == selection
                }
            });
        }
        sources.retain(|source| path_filter.as_ref().is_none_or(|path| *path == source.path));
        self.native_source_availability(include_paths, sources, &work, deadline)
            .await
    }

    async fn native_source_availability(
        &self,
        include_paths: bool,
        mut sources: Vec<SourceRecord>,
        work: &crate::background_work::WorkLease,
        deadline: tokio::time::Instant,
    ) -> anyhow::Result<Vec<NativeSource>> {
        sources.sort_by(|a, b| a.id.cmp(&b.id));
        // A stalled mount must not consume the entire lookup deadline before
        // healthy sources get a chance to prove their availability.
        let mut result = stream::iter(sources)
            .map(|source| async move {
                work.check().map_err(anyhow::Error::msg)?;
                let probe = if source.kind == "folder" {
                    self.native_folder_probe_until(source.path.clone(), work, deadline)
                        .await
                        .map(|path| path.is_some_and(|path| path == source.path))
                } else {
                    self.native_file_available_until(source.path.clone(), work, deadline)
                        .await
                };
                let available = match probe {
                    Ok(available) => available,
                    Err(error)
                        if error
                            .downcast_ref::<NativeProbeDeadline>()
                            .is_some_and(|timeout| timeout.admitted) =>
                    {
                        false
                    }
                    Err(error) => return Err(error),
                };
                work.check().map_err(anyhow::Error::msg)?;
                Ok(NativeSource {
                    id: source.id,
                    name: source.name,
                    kind: source.kind,
                    available,
                    path: include_paths.then(|| native_source_export_path(&source.path)),
                })
            })
            .buffer_unordered(LIBRARY_PROBE_CONCURRENCY)
            .collect::<Vec<anyhow::Result<_>>>()
            .await
            .into_iter()
            .collect::<anyhow::Result<Vec<_>>>()?;
        result.sort_by(|a, b| a.name.cmp(&b.name).then(a.id.cmp(&b.id)));
        Ok(result)
    }

    async fn native_file_available_until(
        &self,
        path: PathBuf,
        work: &crate::background_work::WorkLease,
        deadline: tokio::time::Instant,
    ) -> anyhow::Result<bool> {
        #[cfg(test)]
        let gate = self.native_source_probe_gate.clone();
        Self::native_read(
            self.source_probes.clone(),
            work,
            Some(deadline),
            move |owner| async move {
                #[cfg(test)]
                if let Some((blocked, gate)) = gate {
                    if path == blocked {
                        let _gate = checked(Some(&owner), gate.acquire())
                            .await?
                            .map_err(storage_error)?;
                    }
                }
                if !checked(Some(&owner), fs::canonicalize(&path))
                    .await?
                    .is_ok_and(|canonical| canonical == path)
                {
                    return Ok(false);
                }
                Ok(checked(Some(&owner), fs::symlink_metadata(path))
                    .await?
                    .is_ok_and(|metadata| !metadata.file_type().is_symlink() && metadata.is_file()))
            },
        )
        .await
    }

    fn native_probe_deadline(&self) -> tokio::time::Instant {
        let timeout = NATIVE_SOURCE_PROBE_TIMEOUT;
        #[cfg(test)]
        let timeout = self.native_source_probe_timeout.unwrap_or(timeout);
        tokio::time::Instant::now() + timeout
    }

    // Admission can expire without observing the filesystem. Once admitted,
    // the owned task retains its permit until the in-flight syscall drains.
    async fn native_read<T: Send + 'static, F>(
        permits: Arc<Semaphore>,
        work: &crate::background_work::WorkLease,
        deadline: Option<tokio::time::Instant>,
        read: impl FnOnce(ReadWork) -> F + Send + 'static,
    ) -> anyhow::Result<T>
    where
        F: std::future::Future<Output = Result<T, Failure>> + Send + 'static,
    {
        const NOT_ADMITTED: Failure = (StatusCode::REQUEST_TIMEOUT, "Local folder read timed out");
        work.check().map_err(anyhow::Error::msg)?;
        let acquire = work.run(permits.acquire_owned());
        let permit = match deadline {
            Some(deadline) => {
                if tokio::time::Instant::now() >= deadline {
                    return Err(NativeProbeDeadline { admitted: false }.into());
                }
                tokio::time::timeout_at(deadline, acquire)
                    .await
                    .map_err(|_| NativeProbeDeadline { admitted: false })?
            }
            None => acquire.await,
        }
        .map_err(anyhow::Error::msg)?
        .map_err(|_| anyhow::anyhow!("Local media storage unavailable"))?;
        let admitted = Arc::new(AtomicBool::new(false));
        let started = admitted.clone();
        let operation = owned_read(work, move |owner| async move {
            let _permit = permit;
            owner.check()?;
            if deadline.is_some_and(|end| tokio::time::Instant::now() >= end) {
                return Err(NOT_ADMITTED);
            }
            started.store(true, Ordering::SeqCst);
            read(owner).await
        });
        let result = match deadline {
            Some(deadline) => tokio::time::timeout_at(deadline, operation)
                .await
                .map_err(|_| NativeProbeDeadline {
                    admitted: admitted.load(Ordering::SeqCst),
                })?,
            None => operation.await,
        };
        result.map_err(|failure| {
            if failure == NOT_ADMITTED {
                NativeProbeDeadline { admitted: false }.into()
            } else {
                anyhow::anyhow!(failure.1)
            }
        })
    }

    async fn native_folder_path(
        &self,
        path: PathBuf,
        work: &crate::background_work::WorkLease,
    ) -> anyhow::Result<PathBuf> {
        self.native_folder_path_until(path, work, self.native_probe_deadline())
            .await
    }

    async fn native_folder_path_until(
        &self,
        path: PathBuf,
        work: &crate::background_work::WorkLease,
        deadline: tokio::time::Instant,
    ) -> anyhow::Result<PathBuf> {
        self.native_folder_probe_until(path, work, deadline)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Local media storage unavailable"))
    }

    // None means actual filesystem availability failed. Lifetime, validation,
    // deadline and worker failures remain Err and must not be relabelled.
    async fn native_folder_probe_until(
        &self,
        path: PathBuf,
        work: &crate::background_work::WorkLease,
        deadline: tokio::time::Instant,
    ) -> anyhow::Result<Option<PathBuf>> {
        self.native_folder_probe(path, work, Some(deadline)).await
    }

    async fn native_folder_probe(
        &self,
        path: PathBuf,
        work: &crate::background_work::WorkLease,
        deadline: Option<tokio::time::Instant>,
    ) -> anyhow::Result<Option<PathBuf>> {
        anyhow::ensure!(
            path.is_absolute() && path.parent().is_some(),
            "Select an absolute local folder below the filesystem root"
        );
        anyhow::ensure!(
            path.as_os_str().len() <= 4096 && !path.to_string_lossy().chars().any(char::is_control),
            "Invalid local folder path"
        );
        let library = self.clone();
        Self::native_read(
            self.source_probes.clone(),
            work,
            deadline,
            move |owner| async move { library.read_native_folder(path, &owner).await },
        )
        .await
    }

    async fn read_native_folder(
        &self,
        path: PathBuf,
        owner: &ReadWork,
    ) -> Result<Option<PathBuf>, Failure> {
        #[cfg(test)]
        if let Some((blocked, gate)) = &self.native_source_probe_gate {
            if &path == blocked {
                // Represents a filesystem call already in flight.
                let _gate = checked(Some(owner), gate.acquire())
                    .await?
                    .map_err(storage_error)?;
            }
        }
        let path = match checked(Some(owner), fs::canonicalize(path)).await? {
            Ok(path) => path,
            Err(_) => return Ok(None),
        };
        if path.parent().is_none() {
            return Err((
                StatusCode::BAD_REQUEST,
                "Select a local folder below the filesystem root",
            ));
        }
        let metadata = match checked(Some(owner), fs::symlink_metadata(&path)).await? {
            Ok(metadata) => metadata,
            Err(_) => return Ok(None),
        };
        if !metadata.is_dir() || metadata.file_type().is_symlink() {
            return Err((StatusCode::BAD_REQUEST, "Select an accessible local folder"));
        }
        match checked(Some(owner), fs::read_dir(&path)).await? {
            Ok(directory) => drop(directory),
            Err(_) => return Ok(None),
        }
        Ok(Some(path))
    }

    /// Link an explicitly authorized absolute native folder, returning its
    /// stable binding before background discovery. This is not an HTTP route.
    pub async fn start_link_folder_path_tracked(
        &self,
        path: PathBuf,
        work: crate::background_work::WorkLease,
    ) -> anyhow::Result<NativeSource> {
        self.start_link_folder_request(path, work, NativeRequest::new(u64::MAX))
            .await
    }

    pub async fn start_link_folder_request(
        &self,
        path: PathBuf,
        work: crate::background_work::WorkLease,
        request: NativeRequest,
    ) -> anyhow::Result<NativeSource> {
        request.check()?;
        work.check().map_err(anyhow::Error::msg)?;
        anyhow::ensure!(
            self.storage == "device" && self.read_only_paths.is_none(),
            "Native source bindings are unavailable on this server"
        );
        let path = request.run(self.native_folder_path(path, &work)).await??;
        request.check()?;
        let _caller = NativeRegistrationCaller(request.clone());
        let library = self.clone();
        let worker_request = request.clone();
        let worker_work = work.clone();
        let deadline = self.native_probe_deadline();
        let mut task =
            tokio::spawn(async move {
                let owner = ReadWork {
                    lease: worker_work,
                    abandoned: worker_request.cancelled.subscribe(),
                    deadline: Some(deadline.into_std()),
                };
                let _lock = owner
                    .run(library.mutation.clone().lock_owned())
                    .await
                    .map_err(|error| anyhow::anyhow!(error.1))?;
                worker_request.check()?;
                let sources = {
                    let _permit = owner
                        .run(library.metadata_reads.acquire())
                        .await
                        .map_err(|error| anyhow::anyhow!(error.1))?
                        .map_err(|_| anyhow::anyhow!("Cannot read media sources"))?;
                    library
                        .read_source_records(Some(&owner))
                        .await
                        .map_err(|_| anyhow::anyhow!("Cannot read media sources"))?
                };
                let existing = sources
                    .iter()
                    .any(|source| source.path == path && source.kind == "folder");
                anyhow::ensure!(existing || sources.len() < 32, NATIVE_SOURCE_LIMIT);
                anyhow::ensure!(
                    existing
                        || !sources.iter().any(|source| source.path.starts_with(&path)
                            || path.starts_with(&source.path)),
                    NATIVE_SOURCE_OVERLAP
                );
                library
                    .register_source_checked(
                        &path,
                        true,
                        &sources,
                        &owner.lease,
                        Some(&path),
                        Some((&worker_request, &owner)),
                    )
                    .await
            });
        let source = tokio::select! {
            biased;
            failure = async {
                tokio::select! {
                    _ = work.cancelled() => anyhow::anyhow!(BACKGROUND_CANCELLED.1),
                    result = request.run(std::future::pending::<()>()) =>
                        result.expect_err("pending request cannot complete"),
                    _ = tokio::time::sleep_until(deadline) =>
                        anyhow::anyhow!("Local folder registration timed out"),
                }
            } => {
                request.cancel();
                if request.state.load(Ordering::SeqCst) == 2 {
                    // Commit won the race: do not abandon its atomic rename or
                    // report cancellation while publication is still in flight.
                    task.await??
                } else {
                    return Err(failure);
                }
            }
            result = &mut task => result??,
        };
        let result = NativeSource {
            id: source.id.clone(),
            name: source.name.clone(),
            kind: source.kind.clone(),
            available: true,
            path: None,
        };
        self.prioritize_source_tracked(&source.id, work).await?;
        Ok(result)
    }

    async fn register_source(
        &self,
        picked: &FsPath,
        folder: bool,
        sources: &[SourceRecord],
        work: &crate::background_work::WorkLease,
        expected_root: Option<&FsPath>,
    ) -> anyhow::Result<SourceRecord> {
        self.register_source_checked(picked, folder, sources, work, expected_root, None)
            .await
    }

    async fn register_source_checked(
        &self,
        picked: &FsPath,
        folder: bool,
        sources: &[SourceRecord],
        work: &crate::background_work::WorkLease,
        expected_root: Option<&FsPath>,
        registration: Option<(&NativeRequest, &ReadWork)>,
    ) -> anyhow::Result<SourceRecord> {
        let request = registration.map(|(request, _)| request);
        let owner = registration.map(|(_, owner)| owner);
        work.check().map_err(anyhow::Error::msg)?;
        let request_folder = request.is_some() && folder;
        let root = if let Some(owner) = owner.filter(|_| folder) {
            let _permit = owner
                .run(self.source_probes.acquire())
                .await
                .map_err(|error| anyhow::anyhow!(error.1))?
                .map_err(|_| anyhow::anyhow!("Local media storage unavailable"))?;
            self.read_native_folder(picked.to_path_buf(), owner)
                .await
                .map_err(|error| anyhow::anyhow!(error.1))?
                .ok_or_else(|| anyhow::anyhow!("Local media storage unavailable"))?
        } else {
            work.run(fs::canonicalize(picked))
                .await
                .map_err(anyhow::Error::msg)??
        };
        anyhow::ensure!(
            expected_root.is_none_or(|expected| expected == root),
            "Local folder identity changed before registration"
        );
        anyhow::ensure!(
            self.read_only_paths
                .as_ref()
                .is_none_or(|roots| folder && roots.contains(&root)),
            "Source is outside the configured read-only folders"
        );
        if !request_folder {
            let metadata = work
                .run(fs::symlink_metadata(&root))
                .await
                .map_err(anyhow::Error::msg)??;
            anyhow::ensure!(
                !metadata.file_type().is_symlink()
                    && if folder {
                        metadata.is_dir()
                    } else {
                        metadata.is_file()
                    },
                "Invalid selected source"
            );
        }
        let id = sources
            .iter()
            .find(|s| s.path == root)
            .map(|s| s.id.clone())
            .unwrap_or_else(|| uuid::Uuid::new_v4().simple().to_string());
        let source = SourceRecord {
            id: id.clone(),
            name: root
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("Local media")
                .to_string(),
            kind: if folder { "folder" } else { "file" }.into(),
            path: root,
        };
        // Validate actual read access before persisting the source. Scanning
        // later retains unavailable entries instead of substituting files.
        if folder && !request_folder {
            drop(
                work.run(fs::read_dir(&source.path))
                    .await
                    .map_err(anyhow::Error::msg)??,
            );
        } else if !folder {
            drop(
                work.run(fs::File::open(&source.path))
                    .await
                    .map_err(anyhow::Error::msg)??,
            );
        }
        let destination = self.root.join("sources").join(format!("{id}.json"));
        let temporary = destination.with_extension(format!("{}.part", uuid::Uuid::new_v4()));
        let index = self.root.join("source-index").join(format!("{id}.json"));
        let mut created_index = false;
        let mut created_part = false;
        let check = || -> anyhow::Result<()> {
            work.check().map_err(anyhow::Error::msg)?;
            if let Some(request) = request {
                request.check()?;
            }
            if let Some(owner) = owner {
                owner.check().map_err(|error| anyhow::anyhow!(error.1))?;
            }
            Ok(())
        };
        let result = async {
            check()?;
            if !sources.iter().any(|existing| existing.id == id) {
                fs::create_dir_all(self.root.join("source-index")).await?;
                check()?;
                match write_registration_file(&index, b"[]", &mut created_index).await {
                    // An existing cache belongs to another operation; never
                    // truncate it or claim it for this registration's cleanup.
                    Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
                    result => result?,
                }
                #[cfg(test)]
                self.registration_step(RegistrationStep::Index).await;
                check()?;
            }
            write_registration_file(&temporary, &serde_json::to_vec(&source)?, &mut created_part)
                .await?;
            #[cfg(test)]
            self.registration_step(RegistrationStep::Part).await;
            check()?;
            if let Some(request) = request {
                work.publish(|| request.commit())
                    .map_err(anyhow::Error::msg)??;
            }
            #[cfg(test)]
            self.registration_step(RegistrationStep::Commit).await;
            fs::rename(&temporary, &destination).await?;
            Ok::<_, anyhow::Error>(())
        }
        .await;
        if result.is_err() {
            // Keep the owning task/lock/lease until writes and cleanup drain.
            // These flags are set only after exclusive creation succeeds.
            for (created, path) in [(created_part, &temporary), (created_index, &index)] {
                if created && fs::remove_file(path).await.is_err() {
                    tracing::warn!("Could not remove owned local registration staging file");
                }
            }
        }
        result?;
        Ok(source)
    }

    #[cfg(test)]
    async fn registration_step(&self, step: RegistrationStep) {
        if let Some((blocked, entered, release)) = &self.native_registration_gate {
            if *blocked == step {
                entered.add_permits(1);
                release.acquire().await.unwrap().forget();
            }
        }
    }

    /// Schedule native discovery without keeping the webview's invoke pending.
    /// Metadata becomes visible in cumulative catalog snapshots as it is read.
    pub async fn start_link_paths(&self, paths: Vec<PathBuf>, folder: bool) -> anyhow::Result<()> {
        let work = self.background.enter().map_err(anyhow::Error::msg)?;
        self.start_link_paths_tracked(paths, folder, work).await
    }

    pub async fn start_link_paths_tracked(
        &self,
        paths: Vec<PathBuf>,
        folder: bool,
        work: crate::background_work::WorkLease,
    ) -> anyhow::Result<()> {
        self.start_link_paths_owned(paths, folder, work, None).await
    }

    async fn start_link_paths_owned(
        &self,
        paths: Vec<PathBuf>,
        folder: bool,
        work: crate::background_work::WorkLease,
        expected_source: Option<SourceRecord>,
    ) -> anyhow::Result<()> {
        work.check().map_err(anyhow::Error::msg)?;
        anyhow::ensure!(
            self.storage == "device",
            "Native sources are unavailable on this server"
        );
        let rebuild = {
            let mut scan = work
                .run(self.scan.lock())
                .await
                .map_err(anyhow::Error::msg)?;
            work.publish(|| {
                scan.adopt_epoch(work.epoch());
                let rebuild = scan.jobs == 0 && (!scan.cached || scan.error.is_some());
                if scan.jobs == 0 {
                    // Keep a complete catalog visible while adding another source.
                    // An invalid snapshot must rebuild every other connected root
                    // before this job can mark the library complete again.
                    if rebuild {
                        scan.records.clear();
                        scan.source_scans.clear();
                    }
                    scan.cached = true;
                    scan.scanned = 0;
                    scan.error = None;
                }
                scan.jobs += 1;
                rebuild
            })
            .map_err(anyhow::Error::msg)?
        };
        let library = self.clone();
        tokio::spawn(async move {
            if rebuild {
                library
                    .refresh_sources_except(&work, expected_source.as_ref())
                    .await;
            }
            let result = library
                .link_paths_inner(paths, folder, &work, expected_source.as_ref())
                .await;
            let mut scan = library.scan.lock().await;
            let error = result.err().map(|error| {
                if error.to_string() == NATIVE_SCAN_LIMIT {
                    NATIVE_SCAN_LIMIT.into()
                } else {
                    "Local source could not be completely scanned".into()
                }
            });
            scan.finish_job(&work, error);
        });
        Ok(())
    }

    pub async fn start_refresh_sources(&self) {
        self.start_refresh_sources_with_preferred(None).await;
    }

    async fn preferred_record(
        &self,
        id: &str,
        work: &crate::background_work::WorkLease,
    ) -> Option<(u64, Option<Record>, Preferred)> {
        if self.storage != "device" {
            return None;
        }
        let revision = work.run(self.scan.lock()).await.ok()?.revision;
        if !valid_id(id) {
            // Switching from a browser folder can leave a browser-owned
            // source:path selection. This library only owns opaque 32-hex IDs:
            // report that foreign selection missing without interpreting it as
            // a filesystem path or waiting for the background catalog.
            return self.read_only_paths.as_ref().map(|_| {
                (
                    revision,
                    None,
                    Preferred {
                        id: id.into(),
                        state: "missing",
                    },
                )
            });
        }
        let library = self.clone();
        let id = id.to_string();
        let status = Preferred {
            id: id.clone(),
            state: "pending",
        };
        let result = tokio::time::timeout(
            std::time::Duration::from_secs(1),
            owned_read(work, |owner| async move {
                // Only an explicit NotFound proves absence. Permission, timeout,
                // corrupt metadata or a changed/symlinked source stay pending.
                let metadata = library.root.join(format!("{id}.json"));
                if matches!(checked(Some(&owner), fs::symlink_metadata(&metadata)).await?,
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound)
                {
                    return Ok((None, "missing"));
                }
                let record = library.read_record(&id, Some(&owner)).await?;
                let path = record.linked_path.clone().unwrap_or_else(|| {
                    library
                        .root
                        .join(format!("{}.{}", record.id, record.extension))
                });
                if matches!(checked(Some(&owner), fs::symlink_metadata(&path)).await?,
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound)
                {
                    // A disconnected volume is not evidence that one saved
                    // file was removed from an otherwise readable folder.
                    if let Some(parent) = path.parent() {
                        if checked(Some(&owner), fs::metadata(parent))
                            .await?
                            .map(|metadata| metadata.is_dir())
                            .unwrap_or(false)
                        {
                            return Ok((None, "missing"));
                        }
                    }
                }
                library.read_path(&record, Some(&owner)).await?;
                Ok((Some(record), "found"))
            }),
        )
        .await;
        match result {
            Ok(Ok((record, state))) => Some((revision, record, Preferred { state, ..status })),
            _ => Some((revision, None, status)),
        }
    }

    /// Make the saved item available without restarting an existing scan.
    pub async fn prioritize_item(&self, id: &str) {
        let Ok(work) = self.background.enter() else {
            return;
        };
        self.prioritize_item_tracked(id, work).await;
    }

    pub async fn prioritize_item_tracked(&self, id: &str, work: crate::background_work::WorkLease) {
        self.ensure_catalog_tracked(Some(id), work).await;
    }

    /// Reuse a valid snapshot, or restart discovery after cancellation without
    /// making endpoint readers wait for a synchronous full-directory catalog.
    pub async fn ensure_catalog_tracked(
        &self,
        preferred_id: Option<&str>,
        work: crate::background_work::WorkLease,
    ) {
        if self.storage != "device" || work.check().is_err() {
            return;
        }
        if self.prepare_scan_epoch(&work).await.is_err() {
            return;
        }
        let preferred = match preferred_id {
            Some(id) => self.preferred_record(id, &work).await,
            None => None,
        };
        let Ok(mut scan) = work.run(self.scan.lock()).await else {
            return;
        };
        // Standby invalidates a cancelled snapshot. Wake may discover an
        // existing endpoint without an explicit refresh, so rebuild that
        // snapshot in the background instead of falling back to a full catalog
        // read before the preferred item becomes playable.
        if !scan.cached && scan.jobs == 0 {
            drop(scan);
            self.start_refresh_sources_seeded(preferred, work, false)
                .await;
            return;
        }
        let _ = work.publish(|| scan.cache_preferred(preferred));
    }

    pub async fn start_refresh_sources_with_preferred(&self, preferred_id: Option<&str>) {
        let Ok(work) = self.background.enter() else {
            return;
        };
        self.start_refresh_sources_with_preferred_tracked(preferred_id, work)
            .await;
    }

    pub async fn start_refresh_sources_tracked(&self, work: crate::background_work::WorkLease) {
        self.start_refresh_sources_with_preferred_tracked(None, work)
            .await;
    }

    pub async fn start_refresh_sources_with_preferred_tracked(
        &self,
        preferred_id: Option<&str>,
        work: crate::background_work::WorkLease,
    ) {
        if self.storage != "device" || work.check().is_err() {
            return;
        }
        if self.prepare_scan_epoch(&work).await.is_err() {
            return;
        }
        let preferred = match preferred_id {
            Some(id) => self.preferred_record(id, &work).await,
            None => None,
        };
        self.start_refresh_sources_seeded(preferred, work, true)
            .await;
    }

    async fn start_refresh_sources_seeded(
        &self,
        preferred: Option<(u64, Option<Record>, Preferred)>,
        work: crate::background_work::WorkLease,
        force_refresh: bool,
    ) {
        let library = self.clone();
        // Register before returning so the first HTTP catalog cannot mistake an
        // empty startup snapshot for a finished library. Registration and the
        // preferred seed share the standby publication gate.
        {
            let Ok(mut scan) = work.run(self.scan.lock()).await else {
                return;
            };
            let start = work.publish(|| {
                scan.adopt_epoch(work.epoch());
                if scan.jobs > 0 || (!force_refresh && scan.cached) {
                    scan.cache_preferred(preferred);
                    return false;
                }
                scan.jobs = 1;
                scan.records.clear();
                scan.source_scans.clear();
                scan.cached = true;
                scan.scanned = 0;
                scan.error = None;
                scan.preferred = None;
                scan.cache_preferred(preferred);
                true
            });
            if start != Ok(true) {
                return;
            }
        }
        tokio::spawn(async move {
            // Keep the exact binding snapshot for the mandatory source sweep.
            // A failed source-list read cannot make skipped originals look
            // like a complete global catalog.
            let sources = library.source_records().await;
            let metadata = async {
                match &sources {
                    Ok(sources) => {
                        let sources = sources.clone();
                        let reader = library.clone();
                        owned_read(&work, |owner| async move {
                            reader.read_records_except_folders(&owner, &sources).await
                        })
                        .await
                    }
                    Err(error) => Err(*error),
                }
            };
            let sweep = async {
                if let Ok(sources) = &sources {
                    library.refresh_known_sources(&work, sources, None).await;
                }
            };
            let (metadata, ()) = tokio::join!(metadata, sweep);
            if metadata.is_err() {
                let mut scan = library.scan.lock().await;
                if scan.work_epoch == Some(work.epoch()) {
                    let _ = work.publish(|| {
                        scan.error = Some("Local media metadata could not be read".into())
                    });
                }
            }
            let mut scan = library.scan.lock().await;
            scan.finish_job(&work, None);
        });
    }

    /// Called only by native source registration, never HTTP input.
    /// Stores names and original paths; no source media is copied or deleted.
    pub async fn link_paths(&self, paths: Vec<PathBuf>, folder: bool) -> anyhow::Result<()> {
        let work = self.background.enter().map_err(anyhow::Error::msg)?;
        self.link_paths_inner(paths, folder, &work, None).await
    }

    async fn source_worker(&self, id: &str) -> Arc<Mutex<()>> {
        self.source_workers
            .lock()
            .await
            .entry(id.to_string())
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    }

    async fn prepare_scan_epoch(
        &self,
        work: &crate::background_work::WorkLease,
    ) -> anyhow::Result<()> {
        let mut scan = work
            .run(self.scan.lock())
            .await
            .map_err(anyhow::Error::msg)?;
        work.publish(|| scan.adopt_epoch(work.epoch()))
            .map_err(anyhow::Error::msg)
    }

    fn reserve_source(scan: &mut ScanState, id: &str) -> u64 {
        scan.next_source_generation = (scan.next_source_generation % 9_007_199_254_740_990) + 1;
        let generation = scan.next_source_generation;
        scan.source_scans.insert(
            id.into(),
            SourceScan {
                source_id: id.into(),
                generation,
                state: "pending",
                error: None,
                available: None,
            },
        );
        generation
    }

    fn owns_source(scan: &ScanState, id: &str, generation: u64) -> bool {
        scan.source_scans
            .get(id)
            .is_some_and(|state| state.generation == generation)
    }

    fn complete_source(
        scan: &mut ScanState,
        id: &str,
        generation: u64,
        work: &crate::background_work::WorkLease,
    ) -> anyhow::Result<()> {
        work.publish(|| {
            anyhow::ensure!(
                scan.work_epoch == Some(work.epoch()),
                "Local source scan superseded"
            );
            let state = scan
                .source_scans
                .get_mut(id)
                .filter(|state| state.generation == generation)
                .ok_or_else(|| anyhow::anyhow!("Local source scan superseded"))?;
            state.state = "complete";
            Ok(())
        })
        .map_err(anyhow::Error::msg)?
    }

    /// Prioritize one complete source without waiting for unrelated discovery.
    pub async fn prioritize_source_tracked(
        &self,
        id: &str,
        work: crate::background_work::WorkLease,
    ) -> anyhow::Result<()> {
        anyhow::ensure!(valid_id(id), "Invalid source ID");
        self.ensure_catalog_tracked(None, work.clone()).await;
        // Reading the binding and reserving its generation is one short
        // transaction; disconnect must not leave a phantom pending source.
        let binding = work
            .run(self.mutation.lock())
            .await
            .map_err(anyhow::Error::msg)?;
        let source = self
            .source_records()
            .await
            .map_err(|_| anyhow::anyhow!("Cannot read sources"))?
            .into_iter()
            .find(|source| source.id == id)
            .ok_or_else(|| anyhow::anyhow!("Local source is disconnected"))?;
        let generation = {
            let mut scan = work
                .run(self.scan.lock())
                .await
                .map_err(anyhow::Error::msg)?;
            if scan
                .source_scans
                .get(id)
                .is_some_and(|state| matches!(state.state, "pending" | "scanning" | "complete"))
            {
                return Ok(());
            }
            work.publish(|| {
                scan.adopt_epoch(work.epoch());
                scan.jobs += 1;
                Self::reserve_source(&mut scan, id)
            })
            .map_err(anyhow::Error::msg)?
        };
        drop(binding);
        let library = self.clone();
        tokio::spawn(async move {
            let _ = library.scan_source(source, &work, Some(generation)).await;
            let mut scan = library.scan.lock().await;
            scan.finish_job(&work, None);
        });
        Ok(())
    }

    // Read only a bounded index prefix / metadata window. Cached records are
    // hints: the authoritative JSON and original are validated independently.
    // Failure or exhaustion is an optimization miss, never evidence of absence.
    async fn early_source_record(
        &self,
        source: &SourceRecord,
        work: &crate::background_work::WorkLease,
    ) -> Option<Record> {
        #[cfg(test)]
        if self.force_early_source_miss {
            return None;
        }
        let library = self.clone();
        let source = source.clone();
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(1);
        owned_read_until(work, Some(deadline), move |owner| async move {
            // Share the existing global original-probe budget. Waiting for a
            // permit has no filesystem syscall to drain and may time out.
            let _permit = tokio::time::timeout_at(
                tokio::time::Instant::from_std(deadline),
                owner.run(library.source_probes.acquire()),
            )
            .await
            .map_err(|_| BACKGROUND_CANCELLED)??
            .map_err(storage_error)?;
            let matches_source = |record: &Record| {
                record.source_id.as_deref() == Some(source.id.as_str())
                    && record
                        .linked_path
                        .as_ref()
                        .is_some_and(|path| path != &source.path && path.starts_with(&source.path))
            };
            let mut candidates = Vec::new();
            let index = library
                .root
                .join("source-index")
                .join(format!("{}.json", source.id));
            if checked(Some(&owner), fs::symlink_metadata(&index))
                .await?
                .is_ok_and(|metadata| metadata.is_file() && !metadata.file_type().is_symlink())
            {
                if let Ok(file) = checked(Some(&owner), fs::File::open(index)).await? {
                    let mut bytes = Vec::new();
                    checked(
                        Some(&owner),
                        file.take(EARLY_INDEX_BYTES).read_to_end(&mut bytes),
                    )
                    .await?
                    .map_err(storage_error)?;
                    // Parse complete objects in the prefix; a truncated next
                    // object is harmless because no indexed bytes authorize IO.
                    let mut rest = bytes.as_slice().trim_ascii_start();
                    if rest.first() == Some(&b'[') {
                        rest = &rest[1..];
                        while candidates.len() < EARLY_SOURCE_CANDIDATES {
                            rest = rest.trim_ascii_start();
                            if rest.first() == Some(&b',') {
                                rest = &rest[1..];
                            }
                            let mut records =
                                serde_json::Deserializer::from_slice(rest).into_iter::<Record>();
                            let Some(Ok(record)) = records.next() else {
                                break;
                            };
                            let offset = records.byte_offset();
                            rest = &rest[offset..];
                            candidates.push(record);
                        }
                    }
                }
            }
            let mut tried = HashSet::new();
            let mut attempts = 0;
            for record in candidates {
                if !valid_id(&record.id)
                    || !matches_source(&record)
                    || !tried.insert(record.id.clone())
                {
                    continue;
                }
                attempts += 1;
                if let Ok(actual) = library.read_record(&record.id, Some(&owner)).await {
                    if matches_source(&actual)
                        && library.read_path(&actual, Some(&owner)).await.is_ok()
                    {
                        return Ok(Some(actual));
                    }
                }
            }
            // Modern imports have an existing source/path-derived ID. Probe
            // a small guarded walk without creating any record or assigning an
            // ID; legacy random IDs are still resolved by metadata below.
            // Reserve most of the shared entry budget for that legacy fallback.
            let mut entries_left = EARLY_METADATA_ENTRIES;
            let mut directories = vec![checked(Some(&owner), fs::read_dir(&source.path))
                .await?
                .map_err(storage_error)?];
            for _ in 0..EARLY_DIRECTORY_ENTRIES {
                if attempts >= EARLY_SOURCE_CANDIDATES {
                    break;
                }
                let Some(directory) = directories.last_mut() else {
                    break;
                };
                let Some(entry) = checked(Some(&owner), directory.next_entry())
                    .await?
                    .map_err(storage_error)?
                else {
                    directories.pop();
                    continue;
                };
                entries_left -= 1;
                let path = entry.path();
                let kind = checked(Some(&owner), entry.file_type())
                    .await?
                    .map_err(storage_error)?;
                if kind.is_symlink() {
                    continue;
                }
                if kind.is_dir() {
                    // Never follow a child directory symlink / changed ancestor.
                    if checked(Some(&owner), fs::canonicalize(&path))
                        .await?
                        .ok()
                        .as_ref()
                        != Some(&path)
                    {
                        continue;
                    }
                    if let Ok(directory) = checked(Some(&owner), fs::read_dir(&path)).await? {
                        directories.push(directory);
                    }
                    continue;
                }
                if !kind.is_file()
                    || media_type(
                        &path
                            .extension()
                            .and_then(|value| value.to_str())
                            .unwrap_or("")
                            .to_ascii_lowercase(),
                    )
                    .is_none()
                {
                    continue;
                }
                let mut hash = Sha256::new();
                hash.update(source.id.as_bytes());
                hash.update([0]);
                hash.update(path.as_os_str().as_encoded_bytes());
                let id = format!("{:x}", hash.finalize())[..32].to_string();
                if !tried.insert(id.clone()) {
                    continue;
                }
                if let Ok(actual) = library.read_record(&id, Some(&owner)).await {
                    if matches_source(&actual) && actual.linked_path.as_ref() == Some(&path) {
                        attempts += 1;
                        if library.read_path(&actual, Some(&owner)).await.is_ok() {
                            return Ok(Some(actual));
                        }
                    }
                }
            }
            let mut entries = checked(Some(&owner), fs::read_dir(&library.root))
                .await?
                .map_err(storage_error)?;
            for _ in 0..entries_left {
                if attempts >= EARLY_SOURCE_CANDIDATES {
                    break;
                }
                let Some(entry) = checked(Some(&owner), entries.next_entry())
                    .await?
                    .map_err(storage_error)?
                else {
                    break;
                };
                #[cfg(test)]
                library
                    .early_metadata_entries
                    .fetch_add(1, Ordering::SeqCst);
                let path = entry.path();
                if path.extension().and_then(|extension| extension.to_str()) != Some("json") {
                    continue;
                }
                let Some(id) = path.file_stem().and_then(|id| id.to_str()) else {
                    continue;
                };
                if !valid_id(id) || !tried.insert(id.to_string()) {
                    continue;
                }
                if let Ok(actual) = library.read_record(id, Some(&owner)).await {
                    if matches_source(&actual) {
                        attempts += 1;
                        if library.read_path(&actual, Some(&owner)).await.is_ok() {
                            return Ok(Some(actual));
                        }
                    }
                }
            }
            Ok(None)
        })
        .await
        .ok()
        .flatten()
    }

    // An exhausted preview must not make every saved record/index a barrier
    // to first playback. Stream authoritative JSON until one selected-source
    // original is validated; legacy random IDs must never be replaced by a
    // newly invented path-derived ID. A complete, readable stream with no
    // selected records also lets a genuinely new source walk immediately.
    async fn first_source_record(
        &self,
        source: &SourceRecord,
        generation: u64,
        work: &crate::background_work::WorkLease,
    ) -> Result<(Option<Record>, bool), Failure> {
        let library = self.clone();
        let source = source.clone();
        owned_read(work, move |owner| async move {
            let mut entries = checked(Some(&owner), fs::read_dir(&library.root))
                .await?
                .map_err(storage_error)?;
            let mut may_have_records = false;
            loop {
                owner.check()?;
                {
                    let scan = owner.run(library.scan.lock()).await?;
                    if !Self::owns_source(&scan, &source.id, generation) {
                        return Err(BACKGROUND_CANCELLED);
                    }
                }
                let metadata = owner
                    .run(library.metadata_reads.clone().acquire_owned())
                    .await?
                    .map_err(storage_error)?;
                let Some(entry) = checked(Some(&owner), entries.next_entry())
                    .await?
                    .map_err(storage_error)?
                else {
                    return Ok((None, may_have_records));
                };
                let path = entry.path();
                if path.extension().and_then(|value| value.to_str()) != Some("json") {
                    continue;
                }
                let Some(id) = path.file_stem().and_then(|value| value.to_str()) else {
                    continue;
                };
                if !valid_id(id) {
                    continue;
                }
                let record = match library.read_record(id, Some(&owner)).await {
                    Ok(record) => record,
                    Err(_) => {
                        // A damaged/unreadable record cannot prove that this
                        // source has no legacy IDs; retain the full recovery pass.
                        owner.check()?;
                        may_have_records = true;
                        continue;
                    }
                };
                if record.source_id.as_deref() != Some(source.id.as_str())
                    || !record
                        .linked_path
                        .as_ref()
                        .is_some_and(|path| path.starts_with(&source.path))
                {
                    continue;
                }
                may_have_records = true;
                if record.linked_path.as_ref() == Some(&source.path) {
                    continue;
                }
                drop(metadata); // A slow original must not hold metadata admission.
                let _probe = owner
                    .run(library.source_probes.acquire())
                    .await?
                    .map_err(storage_error)?;
                if library.read_path(&record, Some(&owner)).await.is_ok() {
                    owner.check()?;
                    return Ok((Some(record), true));
                }
                owner.check()?;
            }
        })
        .await
    }

    // A rebuildable source-local metadata index avoids checking every other
    // source's original files. Legacy libraries bootstrap from local JSON only.
    async fn source_metadata(
        &self,
        source: &SourceRecord,
        use_index: bool,
        work: &crate::background_work::WorkLease,
    ) -> anyhow::Result<Vec<Record>> {
        #[cfg(test)]
        if let Some(gate) = &self.source_metadata_gate {
            let permit = work
                .run(gate.acquire())
                .await
                .map_err(anyhow::Error::msg)??;
            permit.forget();
        }
        let index = self
            .root
            .join("source-index")
            .join(format!("{}.json", source.id));
        let bounded_index = use_index
            && fs::symlink_metadata(&index).await.is_ok_and(|metadata| {
                metadata.is_file()
                    && !metadata.file_type().is_symlink()
                    && metadata.len() <= 128 * 1024 * 1024
            });
        let mut records = match if bounded_index {
            fs::read(index).await
        } else {
            Err(std::io::ErrorKind::NotFound.into())
        } {
            Ok(bytes) if bytes.len() <= 128 * 1024 * 1024 => {
                serde_json::from_slice::<Vec<Record>>(&bytes).ok()
            }
            _ => None,
        };
        if records.is_none() {
            let reader = self.clone();
            records = Some(
                owned_read(work, |owner| async move {
                    reader.metadata_records(&owner, true).await
                })
                .await
                .map_err(|error| anyhow::anyhow!(error.1))?,
            );
        }
        Ok(records
            .unwrap_or_default()
            .into_iter()
            .filter(|record| {
                valid_id(&record.id)
                    && record.source_id.as_deref() == Some(&source.id)
                    && media_type(&record.extension) == Some(record.mime.as_str())
                    && record
                        .linked_path
                        .as_ref()
                        .is_some_and(|path| path.starts_with(&source.path))
            })
            .collect())
    }

    async fn link_paths_inner(
        &self,
        paths: Vec<PathBuf>,
        folder: bool,
        work: &crate::background_work::WorkLease,
        expected_source: Option<&SourceRecord>,
    ) -> anyhow::Result<()> {
        work.check().map_err(anyhow::Error::msg)?;
        anyhow::ensure!(
            self.storage == "device",
            "Native sources are unavailable on this server"
        );
        for picked in paths {
            let source = {
                let _binding = work
                    .run(self.mutation.lock())
                    .await
                    .map_err(anyhow::Error::msg)?;
                let sources = self
                    .source_records()
                    .await
                    .map_err(|_| anyhow::anyhow!("Cannot read media sources"))?;
                if let Some(expected) = expected_source {
                    anyhow::ensure!(
                        picked == expected.path
                            && sources.iter().any(|source| source.id == expected.id
                                && source.path == expected.path
                                && source.kind == expected.kind),
                        "Local source was disconnected before scanning"
                    );
                    expected.clone()
                } else {
                    self.register_source(&picked, folder, &sources, work, None)
                        .await?
                }
            };
            if expected_source.is_none() {
                let mut scan = self.scan.lock().await;
                work.publish(|| {
                    if scan
                        .source_scans
                        .get(&source.id)
                        .is_some_and(|state| state.state == "complete")
                    {
                        scan.source_scans.remove(&source.id);
                    }
                })
                .map_err(anyhow::Error::msg)?;
            }
            self.scan_source(source, work, None).await?;
        }
        Ok(())
    }

    async fn scan_source(
        &self,
        source: SourceRecord,
        work: &crate::background_work::WorkLease,
        reserved: Option<u64>,
    ) -> anyhow::Result<()> {
        let worker = self.source_worker(&source.id).await;
        let _worker = work.run(worker.lock()).await.map_err(anyhow::Error::msg)?;
        self.prepare_scan_epoch(work).await?;
        let generation = {
            let _binding = work
                .run(self.mutation.lock())
                .await
                .map_err(anyhow::Error::msg)?;
            let sources = self
                .source_records()
                .await
                .map_err(|_| anyhow::anyhow!("Cannot read media sources"))?;
            anyhow::ensure!(
                sources
                    .iter()
                    .any(|s| s.id == source.id && s.path == source.path && s.kind == source.kind),
                "Local source is disconnected"
            );
            let mut scan = self.scan.lock().await;
            work.publish(|| -> anyhow::Result<Option<u64>> {
                if let Some(generation) = reserved {
                    anyhow::ensure!(
                        Self::owns_source(&scan, &source.id, generation),
                        "Local source scan superseded"
                    );
                }
                if scan
                    .source_scans
                    .get(&source.id)
                    .is_some_and(|state| state.state == "complete")
                {
                    return Ok(None);
                }
                let generation = scan
                    .source_scans
                    .get(&source.id)
                    .filter(|state| matches!(state.state, "pending" | "scanning"))
                    .map(|state| state.generation)
                    .unwrap_or_else(|| Self::reserve_source(&mut scan, &source.id));
                if let Some(state) = scan.source_scans.get_mut(&source.id) {
                    state.state = "scanning";
                }
                Ok(Some(generation))
            })
            .map_err(anyhow::Error::msg)??
        };
        let Some(generation) = generation else {
            return Ok(());
        };
        let result = self.scan_source_inner(&source, generation, work).await;
        if let Err(error) = &result {
            let root_unavailable = self
                .scan
                .lock()
                .await
                .source_scans
                .get(&source.id)
                .is_some_and(|state| state.generation == generation && state.available.is_none());
            if root_unavailable && work.check().is_ok() {
                // A priority worker may own this source before the global
                // metadata pass reaches it. Keep its saved references even
                // when the original root cannot be opened, without probing
                // any original file on that unavailable mount.
                if let Ok(records) = self.source_metadata(&source, true, work).await {
                    for indexed in records {
                        if let Ok(actual) = self.record(&indexed.id).await {
                            if actual.source_id == indexed.source_id
                                && actual.linked_path == indexed.linked_path
                                && self
                                    .publish_source_record(&source, generation, actual, false, work)
                                    .await
                                    .is_err()
                            {
                                break;
                            }
                        }
                    }
                }
            }
            let mut scan = self.scan.lock().await;
            let _ = work.publish(|| {
                if let Some(state) = scan
                    .source_scans
                    .get_mut(&source.id)
                    .filter(|s| s.generation == generation)
                {
                    state.state = "error";
                    state.available.get_or_insert(false);
                    state.error = Some(if error.to_string() == NATIVE_SCAN_LIMIT {
                        NATIVE_SCAN_LIMIT.into()
                    } else {
                        "Local source could not be completely scanned".into()
                    });
                }
            });
        }
        result
    }

    async fn publish_source_record(
        &self,
        source: &SourceRecord,
        generation: u64,
        record: Record,
        available: bool,
        work: &crate::background_work::WorkLease,
    ) -> anyhow::Result<()> {
        let mut scan = self.scan.lock().await;
        anyhow::ensure!(
            Self::owns_source(&scan, &source.id, generation),
            "Local source scan superseded"
        );
        work.publish(|| {
            scan.records.insert(record.id.clone(), (record, available));
            // Completed work units, including revalidation of cached IDs.
            scan.scanned += 1;
        })
        .map_err(anyhow::Error::msg)?;
        Ok(())
    }

    // Directory identity replaces repeated ancestor checks for every file in
    // a folder scan. Serving and preferred lookup still validate full paths.
    async fn scan_directory(
        &self,
        path: &FsPath,
        root: &FsPath,
        work: &crate::background_work::WorkLease,
    ) -> anyhow::Result<ScanDirectory> {
        work.check().map_err(anyhow::Error::msg)?;
        anyhow::ensure!(
            path == root || path.starts_with(root),
            "Local directory is outside its source"
        );
        let _permit = work
            .run(self.source_probes.acquire())
            .await
            .map_err(anyhow::Error::msg)??;
        #[cfg(test)]
        {
            self.scan_directories
                .lock()
                .unwrap()
                .push(path.to_path_buf());
            if let Some((selected, gate)) = &self.scan_directory_gate {
                if path == selected {
                    gate.acquire().await.unwrap().forget();
                }
            }
        }
        let metadata = Self::directory_metadata(path, root, work).await?;
        let entries = fs::read_dir(path).await?;
        work.check().map_err(anyhow::Error::msg)?;
        Ok(ScanDirectory {
            path: path.to_path_buf(),
            stamp: DirectoryStamp::from_metadata(&metadata),
            entries,
        })
    }

    async fn directory_metadata(
        path: &FsPath,
        root: &FsPath,
        work: &crate::background_work::WorkLease,
    ) -> anyhow::Result<std::fs::Metadata> {
        // Drain admitted OS calls before releasing the work owner and permit.
        work.check().map_err(anyhow::Error::msg)?;
        anyhow::ensure!(
            path == root || path.starts_with(root),
            "Local directory is outside its source"
        );
        let canonical = fs::canonicalize(path).await?;
        work.check().map_err(anyhow::Error::msg)?;
        anyhow::ensure!(
            canonical == path,
            "Local directory identity changed during scanning"
        );
        let metadata = fs::symlink_metadata(path).await?;
        work.check().map_err(anyhow::Error::msg)?;
        anyhow::ensure!(
            metadata.is_dir() && !metadata.file_type().is_symlink(),
            "Local directory is unavailable"
        );
        Ok(metadata)
    }

    async fn finish_scan_directory(
        &self,
        directory: ScanDirectory,
        root: &FsPath,
        work: &crate::background_work::WorkLease,
    ) -> anyhow::Result<()> {
        let _permit = work
            .run(self.source_probes.acquire())
            .await
            .map_err(anyhow::Error::msg)??;
        let metadata = Self::directory_metadata(&directory.path, root, work).await?;
        // A bookend detects ordinary namespace changes, not an atomic filesystem
        // snapshot; NAS attribute caches may delay them. Serving rechecks paths.
        anyhow::ensure!(
            directory.stamp == DirectoryStamp::from_metadata(&metadata),
            "Local directory changed during scanning"
        );
        Ok(())
    }

    async fn scan_source_inner(
        &self,
        source: &SourceRecord,
        generation: u64,
        work: &crate::background_work::WorkLease,
    ) -> anyhow::Result<()> {
        let first_started = std::time::Instant::now();
        let root = if source.kind == "folder" {
            self.native_folder_probe(source.path.clone(), work, None)
                .await?
                .ok_or_else(|| anyhow::anyhow!("Local media storage unavailable"))?
        } else {
            fs::canonicalize(&source.path).await?
        };
        anyhow::ensure!(
            root == source.path,
            "Local folder identity changed before scanning"
        );
        {
            let mut scan = self.scan.lock().await;
            anyhow::ensure!(
                Self::owns_source(&scan, &source.id, generation),
                "Local source scan superseded"
            );
            work.publish(|| {
                if let Some(state) = scan.source_scans.get_mut(&source.id) {
                    state.available = Some(true);
                }
            })
            .map_err(anyhow::Error::msg)?;
        }
        let mut has_saved_records = true;
        if source.kind == "folder" {
            let mut first = self.early_source_record(source, work).await;
            if first.is_none() {
                let (record, saved) = self
                    .first_source_record(source, generation, work)
                    .await
                    .map_err(|error| anyhow::anyhow!(error.1))?;
                first = record;
                has_saved_records = saved;
            }
            if let Some(record) = first {
                self.publish_source_record(source, generation, record, true, work)
                    .await?;
                tracing::debug!(target: "ottplay::local_scan", phase = "first-publication", source_id = source.id, published = 1, elapsed_ms = first_started.elapsed().as_millis() as u64);
            }
        }
        work.check().map_err(anyhow::Error::msg)?;
        let mut known = HashMap::<PathBuf, Record>::new();
        if has_saved_records {
            let metadata_started = std::time::Instant::now();
            tracing::debug!(target: "ottplay::local_scan", phase = "source-metadata", state = "start", source_id = source.id);
            let mut records = self.source_metadata(source, true, work).await?.into_iter();
            tracing::debug!(target: "ottplay::local_scan", phase = "source-metadata", state = "complete", source_id = source.id, count = records.len(), elapsed_ms = metadata_started.elapsed().as_millis() as u64);
            let checks_started = std::time::Instant::now();
            let probe = |record: Record| async move {
                work.check().map_err(anyhow::Error::msg)?;
                let _permit = work
                    .run(self.source_probes.acquire())
                    .await
                    .map_err(anyhow::Error::msg)??;
                work.check().map_err(anyhow::Error::msg)?;
                {
                    let scan = self.scan.lock().await;
                    anyhow::ensure!(
                        Self::owns_source(&scan, &source.id, generation),
                        "Local source scan superseded"
                    );
                }
                // The index is an accelerator, not authority: deleted/changed
                // JSON must not resurrect an old record or another source.
                if let Ok(actual) = self.record(&record.id).await {
                    if actual.source_id.as_deref() == Some(&source.id)
                        && actual.linked_path == record.linked_path
                    {
                        if source.kind == "folder" {
                            // Only metadata is validated here. Original-file
                            // availability comes from the guarded directory walk.
                            let mut scan = self.scan.lock().await;
                            anyhow::ensure!(
                                Self::owns_source(&scan, &source.id, generation),
                                "Local source scan superseded"
                            );
                            work.publish(|| scan.scanned += 1)
                                .map_err(anyhow::Error::msg)?;
                        } else {
                            let available = self.path(&actual).await.is_ok();
                            work.check().map_err(anyhow::Error::msg)?;
                            self.publish_source_record(
                                source,
                                generation,
                                actual.clone(),
                                available,
                                work,
                            )
                            .await?;
                        }
                        return Ok(Some(actual));
                    }
                }
                Ok::<_, anyhow::Error>(None)
            };
            let mut probes = futures_util::stream::FuturesUnordered::new();
            for record in records.by_ref().take(SOURCE_PROBE_CONCURRENCY) {
                probes.push(probe(record));
            }
            let mut probe_error = None;
            // Stop admission on failure; drain the in-flight bounded window.
            while let Some(result) = probes.next().await {
                match result {
                    Ok(Some(actual)) => {
                        known.insert(actual.linked_path.clone().unwrap(), actual);
                    }
                    Ok(None) => (),
                    Err(error) => {
                        probe_error.get_or_insert(error);
                    }
                }
                if probe_error.is_none() {
                    if let Some(record) = records.next() {
                        probes.push(probe(record));
                    }
                }
            }
            if let Some(error) = probe_error {
                return Err(error);
            }
            tracing::debug!(target: "ottplay::local_scan", phase = "validation", state = "complete", source_id = source.id, count = known.len(), elapsed_ms = checks_started.elapsed().as_millis() as u64);
        }
        let traversal_started = std::time::Instant::now();
        let mut pending = vec![root.clone()];
        let mut directories: Vec<ScanDirectory> = Vec::new();
        let mut count = 0;
        let mut incomplete = false;
        let mut seen = HashSet::new();
        let traversal = async {
            loop {
                work.check().map_err(anyhow::Error::msg)?;
                {
                    let scan = self.scan.lock().await;
                    anyhow::ensure!(
                        Self::owns_source(&scan, &source.id, generation),
                        "Local source scan superseded"
                    );
                }
                let mut batch = Vec::with_capacity(SOURCE_PROBE_CONCURRENCY);
                while batch.len() < SOURCE_PROBE_CONCURRENCY {
                    let (path, entry) = if let Some(path) = pending.pop() {
                        (path, None)
                    } else if let Some(directory) = directories.last_mut() {
                        match directory.entries.next_entry().await {
                            Ok(Some(entry)) => {
                                let path = entry.path();
                                // Without a portable change stamp, retain the
                                // conservative per-leaf metadata check.
                                (path, directory.stamp.modified.is_some().then_some(entry))
                            }
                            Ok(None) => {
                                // Verify only after the final prefetched batch
                                // was processed, including any child directories.
                                if !batch.is_empty() {
                                    break;
                                }
                                let finished = directories.pop().unwrap();
                                self.finish_scan_directory(finished, &root, work).await?;
                                continue;
                            }
                            Err(_) => {
                                incomplete = true;
                                directories.pop();
                                continue;
                            }
                        }
                    } else {
                        break;
                    };
                    count_native_scan_entry(&mut count)?;
                    #[cfg(test)]
                    anyhow::ensure!(count <= self.scan_entry_limit, NATIVE_SCAN_LIMIT);
                    let known_size = (source.kind == "folder")
                        .then(|| known.get(&path).map(|record| record.size))
                        .flatten();
                    batch.push((path, entry, known_size));
                }
                if batch.is_empty() {
                    break;
                }
                let inspected = stream::iter(batch)
                    .map(|(path, entry, known_size)| async move {
                        let _permit = work
                            .run(self.source_probes.acquire())
                            .await
                            .map_err(anyhow::Error::msg)??;
                        work.check().map_err(anyhow::Error::msg)?;
                        #[cfg(test)]
                        {
                            self.scan_entries.lock().unwrap().push(path.clone());
                            if let Some((selected, gate)) = &self.scan_entry_gate {
                                if path != *selected && path.starts_with(selected) {
                                    gate.acquire().await.unwrap().forget();
                                }
                            }
                        }
                        #[cfg(test)]
                        if let Some(delay) = self.original_read_delay {
                            tokio::time::sleep(delay).await;
                        }
                        // Tokio captures this no-follow type while enumerating.
                        // A known file needs no duplicate lstat: availability is
                        // an enumeration-time observation, never serving authority.
                        let cached = match (entry, known_size) {
                            (Some(entry), Some(size)) => {
                                Some(entry.file_type().await.map(|kind| (kind, size)))
                            }
                            _ => None,
                        };
                        let observation = match cached {
                            Some(Ok((kind, size))) if kind.is_file() => Ok((kind, size)),
                            Some(Err(error)) => Err(error),
                            _ => {
                                #[cfg(test)]
                                self.scan_leaf_metadata.lock().unwrap().push(path.clone());
                                fs::symlink_metadata(&path)
                                    .await
                                    .map(|metadata| (metadata.file_type(), metadata.len()))
                            }
                        };
                        work.check().map_err(anyhow::Error::msg)?;
                        Ok::<_, anyhow::Error>((path, observation))
                    })
                    .buffer_unordered(SOURCE_PROBE_CONCURRENCY)
                    .collect::<Vec<_>>()
                    .await;
                // Every submitted operation is drained before propagating errors.
                for inspected in inspected {
                    work.check().map_err(anyhow::Error::msg)?;
                    let (path, observation) = inspected?;
                    {
                        let mut scan = self.scan.lock().await;
                        anyhow::ensure!(
                            Self::owns_source(&scan, &source.id, generation),
                            "Local source scan superseded"
                        );
                        work.publish(|| scan.scanned += 1)
                            .map_err(anyhow::Error::msg)?;
                    }
                    let (kind, size) = match observation {
                        Ok(observation) => observation,
                        Err(error) if path == root => return Err(error.into()),
                        Err(_) => {
                            incomplete = true;
                            continue;
                        }
                    };
                    if kind.is_symlink() {
                        continue;
                    }
                    if kind.is_dir() {
                        match self.scan_directory(&path, &root, work).await {
                            Ok(directory) => directories.push(directory),
                            Err(error) if path == root => return Err(error),
                            Err(_) => incomplete = true,
                        }
                        continue;
                    }
                    if !kind.is_file() {
                        continue;
                    }
                    let extension = path
                        .extension()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .to_ascii_lowercase();
                    let Some(mime) = media_type(&extension) else {
                        continue;
                    };
                    if let Some(record) = known.get(&path) {
                        if source.kind == "folder" {
                            self.publish_source_record(
                                source,
                                generation,
                                record.clone(),
                                true,
                                work,
                            )
                            .await?;
                            seen.insert(path);
                        }
                        continue;
                    }
                    match fs::File::open(&path).await {
                        Ok(file) => drop(file),
                        Err(error) if path == root => return Err(error.into()),
                        Err(_) => {
                            incomplete = true;
                            continue;
                        }
                    }
                    // Stable IDs also recover a record committed before an interrupted
                    // index update, without scanning unrelated source metadata.
                    let mut hash = Sha256::new();
                    hash.update(source.id.as_bytes());
                    hash.update([0]);
                    hash.update(path.as_os_str().as_encoded_bytes());
                    let id = format!("{:x}", hash.finalize())[..32].to_string();
                    let record = Record {
                        id: id.clone(),
                        name: path
                            .file_name()
                            .and_then(|s| s.to_str())
                            .unwrap_or("Local media")
                            .into(),
                        size,
                        mime: mime.into(),
                        extension,
                        linked_path: Some(path.clone()),
                        source_id: Some(source.id.clone()),
                    };
                    let destination = self.root.join(format!("{id}.json"));
                    if let Ok(existing) = self.record(&id).await {
                        anyhow::ensure!(
                            existing.linked_path == record.linked_path
                                && existing.source_id == record.source_id,
                            "Local media identity collision"
                        );
                    }
                    let temporary = destination.with_extension("part");
                    fs::write(&temporary, serde_json::to_vec(&record)?).await?;
                    {
                        let _binding = work
                            .run(self.mutation.lock())
                            .await
                            .map_err(anyhow::Error::msg)?;
                        {
                            let scan = self.scan.lock().await;
                            anyhow::ensure!(
                                Self::owns_source(&scan, &source.id, generation),
                                "Local source scan superseded"
                            );
                        }
                        work.check().map_err(anyhow::Error::msg)?;
                        fs::rename(temporary, destination).await?;
                        self.publish_source_record(source, generation, record.clone(), true, work)
                            .await?;
                    }
                    seen.insert(path.clone());
                    known.insert(path, record);
                }
            }
            Ok::<(), anyhow::Error>(())
        }
        .await;
        if source.kind == "folder" {
            // A failed subtree still retains its saved references. False means
            // not confirmed playable; only a successful walk proves absence.
            for (path, record) in &known {
                if !seen.contains(path) {
                    self.publish_source_record(source, generation, record.clone(), false, work)
                        .await?;
                }
            }
            traversal?;
            // A replaced root/ancestor cannot certify the completed snapshot
            // collected through the old directory handle.
            drop(self.scan_directory(&root, &root, work).await?);
        } else {
            traversal?;
        }
        let index_dir = self.root.join("source-index");
        fs::create_dir_all(&index_dir).await?;
        let index = index_dir.join(format!("{}.json", source.id));
        let temporary = index.with_extension("part");
        fs::write(
            &temporary,
            serde_json::to_vec(&known.into_values().collect::<Vec<_>>())?,
        )
        .await?;
        let _binding = work
            .run(self.mutation.lock())
            .await
            .map_err(anyhow::Error::msg)?;
        {
            let scan = self.scan.lock().await;
            anyhow::ensure!(
                Self::owns_source(&scan, &source.id, generation),
                "Local source scan superseded"
            );
        }
        work.check().map_err(anyhow::Error::msg)?;
        fs::rename(temporary, index).await?;
        anyhow::ensure!(!incomplete, "Local source could not be completely scanned");
        let mut scan = self.scan.lock().await;
        Self::complete_source(&mut scan, &source.id, generation, work)?;
        tracing::debug!(target: "ottplay::local_scan", phase = "traversal", state = "complete", source_id = source.id, entries = count, elapsed_ms = traversal_started.elapsed().as_millis() as u64);
        Ok(())
    }

    /// Refresh existing folder grants without dropping missing files or changing stable IDs.
    pub async fn refresh_sources(&self) {
        let Ok(work) = self.background.enter() else {
            return;
        };
        if self.prepare_scan_epoch(&work).await.is_err() {
            return;
        }
        {
            let mut scan = self.scan.lock().await;
            if work
                .publish(|| {
                    if scan.jobs == 0 {
                        scan.source_scans.clear();
                    }
                })
                .is_err()
            {
                return;
            }
        }
        self.refresh_sources_inner(&work).await;
    }
    async fn refresh_sources_inner(&self, work: &crate::background_work::WorkLease) {
        self.refresh_sources_except(work, None).await;
    }

    async fn refresh_sources_except(
        &self,
        work: &crate::background_work::WorkLease,
        excluded_source: Option<&SourceRecord>,
    ) {
        if work.check().is_err() {
            return;
        }
        if self.storage != "device" {
            return;
        }
        let Ok(sources) = self.source_records().await else {
            return;
        };
        self.refresh_known_sources(work, &sources, excluded_source)
            .await;
    }

    async fn refresh_known_sources(
        &self,
        work: &crate::background_work::WorkLease,
        sources: &[SourceRecord],
        excluded_source: Option<&SourceRecord>,
    ) {
        for source in sources {
            if work.check().is_err() {
                return;
            }
            if source.kind != "folder"
                || excluded_source.is_some_and(|excluded| {
                    excluded.id == source.id
                        && excluded.path == source.path
                        && excluded.kind == source.kind
                })
            {
                continue;
            }
            // Unmounted, moved or denied sources remain visible for reconnection.
            if self
                .link_paths_inner(vec![source.path.clone()], true, work, Some(source))
                .await
                .is_err()
            {
                tracing::debug!("Local source currently unavailable during refresh");
                let mut scan = self.scan.lock().await;
                let _ = work.publish(|| {
                    // Binding errors may occur before any source state exists.
                    if !scan.revoked_ids.contains(&source.id)
                        && !scan.source_scans.contains_key(&source.id)
                    {
                        scan.error = Some("Local source refresh could not be started".into());
                    }
                });
            }
        }
    }

    pub async fn disconnect_source(&self, id: &str) -> anyhow::Result<()> {
        anyhow::ensure!(
            self.read_only_paths.is_none(),
            "Read-only sources cannot be disconnected"
        );
        let work = self.background.enter().map_err(anyhow::Error::msg)?;
        anyhow::ensure!(valid_id(id), "Invalid source ID");
        if let Some(manager) = &self.compatibility {
            manager.cancel_source(id);
        }
        let source = {
            let _binding = work
                .run(self.mutation.lock())
                .await
                .map_err(anyhow::Error::msg)?;
            let source = self
                .source_records()
                .await
                .map_err(|_| anyhow::anyhow!("Cannot read sources"))?
                .into_iter()
                .find(|source| source.id == id);
            let path = self.root.join("sources").join(format!("{id}.json"));
            if fs::try_exists(&path).await? {
                fs::remove_file(path).await?;
            }
            let mut scan = self.scan.lock().await;
            scan.revoked_ids.insert(id.to_string());
            scan.source_scans.remove(id);
            scan.records
                .retain(|_, (record, _)| record.source_id.as_deref().unwrap_or(&record.id) != id);
            scan.preferred = None;
            scan.revision = scan.revision.wrapping_add(1);
            if scan.jobs == 0 {
                scan.cached = false;
            }
            source
        };
        // Waiting for this source never blocks registration or playback of
        // another one. The removed generation prevents any later commit.
        let worker = self.source_worker(id).await;
        let _worker = work.run(worker.lock()).await.map_err(anyhow::Error::msg)?;
        let records = if let Some(source) = source {
            self.source_metadata(&source, false, &work).await?
        } else {
            self.record(id).await.ok().into_iter().collect()
        };
        for record in records {
            work.check().map_err(anyhow::Error::msg)?;
            if record.linked_path.is_none() {
                if let Ok(path) = self.path(&record).await {
                    fs::remove_file(path).await?;
                }
            }
            let metadata_path = self
                .metadata_path(&record.id)
                .map_err(|_| anyhow::anyhow!("Invalid media ID"))?;
            match fs::remove_file(metadata_path).await {
                Ok(()) => (),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => (),
                Err(error) => return Err(error.into()),
            }
        }
        let _ = fs::remove_file(self.root.join("source-index").join(format!("{id}.json"))).await;
        self.source_workers.lock().await.remove(id);
        Ok(())
    }

    pub async fn catalog(&self) -> Result<Catalog, Failure> {
        let work = self
            .background
            .enter()
            .map_err(|_| (StatusCode::SERVICE_UNAVAILABLE, "Player is in standby"))?;
        let library = self.clone();
        owned_read(
            &work,
            |owner| async move { library.read_catalog(&owner).await },
        )
        .await
    }
    async fn read_catalog(&self, work: &ReadWork) -> Result<Catalog, Failure> {
        let base = self.endpoint();
        let (scanning, scanned, scan_error, cached, preferred, source_scans) = {
            let scan = work.run(self.scan.lock()).await?;
            (
                scan.jobs > 0,
                scan.scanned,
                scan.error.clone().or_else(|| {
                    scan.source_scans.values().find_map(|state| {
                        // An unavailable mount has no eligible items and may
                        // coexist with other playable sources. An accessible
                        // root with an incomplete traversal must not certify
                        // the resulting partial catalog as complete.
                        (state.state == "error" && state.available == Some(true)).then(|| {
                            state.error.clone().unwrap_or_else(|| {
                                "Local source could not be completely scanned".into()
                            })
                        })
                    })
                }),
                if scan.cached {
                    Some(scan.records.values().cloned().collect::<Vec<_>>())
                } else {
                    None
                },
                scan.preferred.clone(),
                if scan.cached {
                    scan.source_scans.values().cloned().collect::<Vec<_>>()
                } else {
                    Vec::new()
                },
            )
        };
        let mut records = match cached {
            Some(records) => records,
            None => {
                let mut validated = Vec::new();
                for record in self.read_records(work).await? {
                    work.check()?;
                    let available = self.read_path(&record, Some(work)).await.is_ok();
                    work.check()?;
                    validated.push((record, available));
                }
                validated
            }
        };
        // Normalize each name once, rather than allocating on every comparison.
        records.sort_by_cached_key(|(record, _)| (record.name.to_lowercase(), record.id.clone()));
        let source_records = self.read_source_records(Some(work)).await?;
        let source_roots = catalog_source_roots(&source_records);
        let mut items = Vec::new();
        for (r, available) in records {
            // Availability is checked when metadata enters a scan snapshot.
            // Media requests always validate the original again before serving.
            let size = r.size;
            let available = available
                && (!matches!(r.extension.as_str(), "avi" | "mkv") || self.compatibility.is_some());
            items.push(Item {
                id: r.id.clone(),
                directory: r
                    .linked_path
                    .as_ref()
                    .and_then(|path| path.parent())
                    .and_then(|path| path.file_name())
                    .and_then(|name| name.to_str())
                    .unwrap_or("")
                    .to_string(),
                playback: matches!(r.extension.as_str(), "avi" | "mkv").then(|| {
                    crate::local_compatibility::Playback::new(
                        &base,
                        &r.id,
                        self.compatibility.is_some(),
                    )
                }),
                relative_path: linked_relative_path(&r, &source_roots),
                name: r.name,
                size,
                mime: r.mime,
                url: if available {
                    format!("{base}/{}", r.id)
                } else {
                    String::new()
                },
                available,
                source: if r.linked_path.is_some() {
                    "linked"
                } else {
                    "imported"
                },
                source_id: r.source_id.unwrap_or(r.id),
            });
        }
        drop(source_roots);
        let mut sources = Vec::new();
        for source in source_records {
            let known = source_scans
                .iter()
                .find(|state| state.source_id == source.id);
            // Source workers own availability during a cached scan. A remote
            // catalog read must not wait on an unrelated mounted/NAS root.
            let available = if let Some(state) = known {
                state.available.unwrap_or(state.state != "error")
            } else if scanning {
                true
            } else {
                checked(Some(work), fs::symlink_metadata(&source.path))
                    .await?
                    .map(|m| {
                        !m.file_type().is_symlink()
                            && if source.kind == "folder" {
                                m.is_dir()
                            } else {
                                m.is_file()
                            }
                    })
                    .unwrap_or(false)
            };
            sources.push(Source {
                id: source.id,
                name: source.name,
                kind: source.kind,
                available,
                access: if available { "granted" } else { "unavailable" },
            });
        }
        // Preserve source order while avoiding a quadratic scan for libraries
        // containing many individually linked/imported files.
        let mut source_ids: HashSet<String> =
            sources.iter().map(|source| source.id.clone()).collect();
        for item in &items {
            if source_ids.insert(item.source_id.clone()) {
                sources.push(Source {
                    id: item.source_id.clone(),
                    name: item.name.clone(),
                    kind: "file".into(),
                    available: item.available,
                    access: if item.available {
                        "granted"
                    } else {
                        "unavailable"
                    },
                });
            }
        }
        work.check()?;
        Ok(Catalog {
            compatibility: crate::local_compatibility::Capability::new(
                self.compatibility.is_some(),
            ),
            available: true,
            items,
            storage: if self.read_only_paths.is_some() {
                "server".into()
            } else {
                self.storage.clone()
            },
            persistent: true,
            upload_url: if self.read_only_paths.is_some() {
                String::new()
            } else {
                format!("{base}/import")
            },
            direct_sources: self.storage == "device" && self.read_only_paths.is_none(),
            read_only: self.read_only_paths.is_some(),
            sources,
            source_scans,
            scanning,
            scanned,
            total: if scanning || scan_error.is_some() {
                None
            } else {
                Some(scanned)
            },
            scan_error,
            preferred,
        })
    }
}
fn valid_id(id: &str) -> bool {
    id.len() == 32 && id.bytes().all(|b| b.is_ascii_hexdigit())
}
fn storage_error<T>(_: T) -> Failure {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        "Local media storage unavailable",
    )
}
fn media_type(extension: &str) -> Option<&'static str> {
    match extension {
        "mp4" | "m4v" => Some("video/mp4"),
        "webm" => Some("video/webm"),
        "avi" => Some("video/x-msvideo"),
        "mkv" => Some("video/x-matroska"),
        "ogv" => Some("video/ogg"),
        "mp3" => Some("audio/mpeg"),
        "m4a" => Some("audio/mp4"),
        "ogg" => Some("audio/ogg"),
        _ => None,
    }
}
fn cors(response: &mut Response) {
    let h = response.headers_mut();
    h.insert("access-control-allow-origin", HeaderValue::from_static("*"));
    h.insert(
        "access-control-allow-methods",
        HeaderValue::from_static("GET, HEAD, POST, DELETE, OPTIONS"),
    );
    h.insert(
        "access-control-allow-headers",
        HeaderValue::from_static("Content-Type, Range, X-OTT-Playback-Lease"),
    );
    h.insert(
        "access-control-expose-headers",
        HeaderValue::from_static("Content-Length, Content-Range, Accept-Ranges"),
    );
    h.insert("cache-control", HeaderValue::from_static("no-store"));
    h.insert("referrer-policy", HeaderValue::from_static("no-referrer"));
}
async fn preflight(
    State(l): State<Library>,
    Path(params): Path<std::collections::HashMap<String, String>>,
) -> Response {
    let mut r = match l.authorize(params.get("token").map(String::as_str).unwrap_or("")) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => e.into_response(),
    };
    cors(&mut r);
    r
}
async fn catalog(
    State(l): State<Library>,
    Path(token): Path<String>,
    Query(query): Query<CatalogQuery>,
) -> Response {
    let mut r = match l.authorize(&token) {
        Ok(()) => {
            if l.read_only_paths.is_some() {
                if query.refresh {
                    l.start_refresh_sources_with_preferred(query.preferred_id.as_deref())
                        .await;
                } else if let Ok(work) = l.background.enter() {
                    l.ensure_catalog_tracked(query.preferred_id.as_deref(), work)
                        .await;
                }
            }
            match l.catalog().await {
                Ok(c) => Json(c).into_response(),
                Err(e) => e.into_response(),
            }
        }
        Err(e) => e.into_response(),
    };
    cors(&mut r);
    r
}
async fn import(
    State(l): State<Library>,
    Path(token): Path<String>,
    Query(q): Query<ImportQuery>,
    body: Body,
) -> Response {
    let result = import_inner(&l, &token, &q.name, body).await;
    let mut r = match result {
        Ok(c) => Json(c).into_response(),
        Err(e) => e.into_response(),
    };
    cors(&mut r);
    r
}
async fn import_inner(
    l: &Library,
    token: &str,
    name: &str,
    body: Body,
) -> Result<Catalog, Failure> {
    l.authorize(token)?;
    let work = l
        .background
        .enter()
        .map_err(|_| (StatusCode::SERVICE_UNAVAILABLE, "Player is in standby"))?;
    if name.is_empty()
        || name.len() > 240
        || name
            .chars()
            .any(|c| c.is_control() || c == '/' || c == '\\')
    {
        return Err((StatusCode::BAD_REQUEST, "Invalid media filename"));
    }
    let extension = FsPath::new(name)
        .extension()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let mime = media_type(&extension).ok_or((
        StatusCode::UNSUPPORTED_MEDIA_TYPE,
        "Use MP4, WebM, OGV, MP3, M4A or OGG",
    ))?;
    let _upload = work
        .run(l.uploads.lock())
        .await
        .map_err(|_| BACKGROUND_CANCELLED)?;
    let id = uuid::Uuid::new_v4().simple().to_string();
    let temporary = l.root.join(format!("{id}.upload"));
    let target = l.root.join(format!("{id}.{extension}"));
    // Ownership is established inside the blocking task, so cancellation while
    // creating the file still drops a guard instead of leaving an orphan.
    let upload_path = temporary.clone();
    let creation = work.clone();
    let mut upload = tokio::task::spawn_blocking(move || {
        creation.check().map_err(std::io::Error::other)?;
        let file = std::fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&upload_path)?;
        Ok::<_, std::io::Error>(PendingUpload {
            file: Some(fs::File::from_std(file)),
            path: upload_path,
        })
    })
    .await
    .map_err(storage_error)?
    .map_err(storage_error)?;
    let write_result: Result<u64, Failure> = async {
        let mut size = 0u64;
        let mut chunks = body.into_data_stream();
        while let Some(chunk) = work
            .run(tokio::time::timeout(
                std::time::Duration::from_secs(60),
                chunks.next(),
            ))
            .await
            .map_err(|_| (StatusCode::SERVICE_UNAVAILABLE, "Player is in standby"))?
            .map_err(|_| (StatusCode::REQUEST_TIMEOUT, "Upload stalled"))?
        {
            let chunk = chunk.map_err(|_| (StatusCode::BAD_REQUEST, "Upload interrupted"))?;
            size = size
                .checked_add(chunk.len() as u64)
                .filter(|s| *s <= MAX_BYTES)
                .ok_or((
                    StatusCode::PAYLOAD_TOO_LARGE,
                    "Maximum media size is 16 GiB",
                ))?;
            upload
                .file
                .as_mut()
                .unwrap()
                .write_all(&chunk)
                .await
                .map_err(storage_error)?;
        }
        work.check()
            .map_err(|_| (StatusCode::SERVICE_UNAVAILABLE, "Player is in standby"))?;
        if size == 0 {
            return Err((StatusCode::BAD_REQUEST, "Media file is empty"));
        }
        upload
            .file
            .as_mut()
            .unwrap()
            .flush()
            .await
            .map_err(storage_error)?;
        Ok(size)
    }
    .await;
    drop(upload.file.take());
    let size = match write_result {
        Ok(size) => size,
        Err(e) => {
            let _ = fs::remove_file(&temporary).await;
            return Err(e);
        }
    };
    let _lock = work
        .run(l.mutation.lock())
        .await
        .map_err(|_| BACKGROUND_CANCELLED)?;
    fs::rename(&temporary, &target)
        .await
        .map_err(storage_error)?;
    let record = Record {
        id: id.clone(),
        name: name.into(),
        size,
        mime: mime.into(),
        extension,
        linked_path: None,
        source_id: None,
    };
    let encoded = serde_json::to_vec(&record).map_err(storage_error)?;
    if let Err(e) = fs::write(l.root.join(format!("{id}.json")), encoded).await {
        let _ = fs::remove_file(target).await;
        return Err(storage_error(e));
    }
    l.scan.lock().await.invalidate();
    drop(_lock);
    l.catalog().await
}
async fn remove(l: Library, Path((token, id)): Path<(String, String)>) -> Response {
    let result: Result<Catalog, Failure> = async {
        l.authorize(&token)?;
        let work = l
            .background
            .enter()
            .map_err(|_| (StatusCode::SERVICE_UNAVAILABLE, "Player is in standby"))?;
        let _lock = work.run(l.mutation.lock()).await.map_err(|_| {
            (
                StatusCode::SERVICE_UNAVAILABLE,
                "Player background work cancelled",
            )
        })?;
        let metadata_path = l.metadata_path(&id)?;
        let record = l.record(&id).await?;
        if let Some(manager) = &l.compatibility {
            manager.cancel_item(&id);
        }
        if record.linked_path.is_none() {
            fs::remove_file(l.path(&record).await?)
                .await
                .map_err(storage_error)?;
        }
        fs::remove_file(metadata_path)
            .await
            .map_err(storage_error)?;
        {
            let mut scan = l.scan.lock().await;
            scan.revoked_ids.insert(id.clone());
            scan.invalidate();
        }
        drop(_lock);
        l.catalog().await
    }
    .await;
    let mut r = match result {
        Ok(c) => Json(c).into_response(),
        Err(e) => e.into_response(),
    };
    cors(&mut r);
    r
}
async fn remove_source(l: Library, Path((token, id)): Path<(String, String)>) -> Response {
    let result = async {
        l.authorize(&token)?;
        l.disconnect_source(&id).await.map_err(storage_error)?;
        l.catalog().await
    }
    .await;
    let mut response = match result {
        Ok(catalog) => Json(catalog).into_response(),
        Err(error) => error.into_response(),
    };
    cors(&mut response);
    response
}

fn byte_range(value: Option<&str>, size: u64) -> Result<Option<(u64, u64)>, Failure> {
    let Some(value) = value else { return Ok(None) };
    let fail = || (StatusCode::RANGE_NOT_SATISFIABLE, "Invalid byte range");
    let raw = value.strip_prefix("bytes=").ok_or_else(fail)?;
    if raw.contains(',') || size == 0 {
        return Err(fail());
    }
    let (a, b) = raw.split_once('-').ok_or_else(fail)?;
    let range = if a.is_empty() {
        let length = b.parse::<u64>().map_err(|_| fail())?;
        if length == 0 {
            return Err(fail());
        }
        (size.saturating_sub(length), size - 1)
    } else {
        let start = a.parse::<u64>().map_err(|_| fail())?;
        let end = if b.is_empty() {
            size - 1
        } else {
            b.parse::<u64>().map_err(|_| fail())?.min(size - 1)
        };
        if start >= size || end < start {
            return Err(fail());
        }
        (start, end)
    };
    Ok(Some(range))
}

async fn read_media_chunk<R: tokio::io::AsyncRead + Unpin + Send + 'static>(
    mut file: R,
    left: u64,
    work: &crate::background_work::WorkLease,
) -> Result<(R, Vec<u8>), Failure> {
    owned_read(work, move |owner| async move {
        let mut bytes = vec![0; left.min(64 * 1024) as usize];
        let read = checked(Some(&owner), file.read(&mut bytes))
            .await?
            .map_err(storage_error)?;
        bytes.truncate(read);
        Ok((file, bytes))
    })
    .await
}

async fn media(
    State(l): State<Library>,
    Path((token, id)): Path<(String, String)>,
    headers: HeaderMap,
    method: Method,
) -> Response {
    let result: Result<Response, Failure> = async {
        l.authorize(&token)?;
        let work = l
            .background
            .enter()
            .map_err(|_| (StatusCode::SERVICE_UNAVAILABLE, "Player is in standby"))?;
        let (record, file, size) = owned_read(&work, |owner| async move {
            let record = l.read_record(&id, Some(&owner)).await?;
            let path = l.read_path(&record, Some(&owner)).await?;
            let file = checked(Some(&owner), fs::File::open(path))
                .await?
                .map_err(storage_error)?;
            let size = checked(Some(&owner), file.metadata())
                .await?
                .map_err(storage_error)?
                .len();
            Ok((record, file, size))
        })
        .await?;
        let range = match byte_range(headers.get("range").and_then(|v| v.to_str().ok()), size) {
            Ok(r) => r,
            Err(e) => {
                let mut r = e.into_response();
                r.headers_mut()
                    .insert("content-range", format!("bytes */{size}").parse().unwrap());
                return Ok(r);
            }
        };
        let (start, end) = range.unwrap_or((0, size.saturating_sub(1)));
        let length = if size == 0 { 0 } else { end - start + 1 };
        let file = owned_read(&work, move |owner| async move {
            let mut file = file;
            checked(Some(&owner), file.seek(std::io::SeekFrom::Start(start)))
                .await?
                .map_err(storage_error)?;
            Ok(file)
        })
        .await?;
        let body = if method == Method::HEAD {
            Body::empty()
        } else {
            Body::from_stream(stream::try_unfold(
                (file, length, work),
                |(file, left, work)| async move {
                    if left == 0 {
                        return Ok::<_, std::io::Error>(None);
                    }
                    let (file, bytes) = read_media_chunk(file, left, &work)
                        .await
                        .map_err(|error| std::io::Error::other(error.1))?;
                    let read = bytes.len();
                    if read == 0 {
                        return Err(std::io::Error::new(
                            std::io::ErrorKind::UnexpectedEof,
                            "Local media truncated",
                        ));
                    }
                    Ok(Some((Bytes::from(bytes), (file, left - read as u64, work))))
                },
            ))
        };
        let mut r = Response::new(body);
        *r.status_mut() = if range.is_some() {
            StatusCode::PARTIAL_CONTENT
        } else {
            StatusCode::OK
        };
        let h = r.headers_mut();
        h.insert("content-type", record.mime.parse().unwrap());
        h.insert("content-length", length.into());
        h.insert("accept-ranges", HeaderValue::from_static("bytes"));
        if range.is_some() {
            h.insert(
                "content-range",
                format!("bytes {start}-{end}/{size}").parse().unwrap(),
            );
        }
        Ok(r)
    }
    .await;
    let mut r = match result {
        Ok(r) => r,
        Err(e) => e.into_response(),
    };
    cors(&mut r);
    r
}

#[cfg(test)]
mod tests {
    use super::*;

    fn relative_path_record(source: &SourceRecord, path: PathBuf) -> Record {
        Record {
            id: "b".repeat(32),
            name: "Episode.mp4".into(),
            size: 5,
            mime: "video/mp4".into(),
            extension: "mp4".into(),
            linked_path: Some(path),
            source_id: Some(source.id.clone()),
        }
    }

    #[test]
    fn portable_relative_path_rejects_unbound_and_unsafe_metadata() {
        let root = std::env::temp_dir().join("portable-source");
        let source = SourceRecord {
            id: "a".repeat(32),
            name: "Movies".into(),
            kind: "folder".into(),
            path: root.clone(),
        };
        let sources = vec![source.clone()];
        let roots = catalog_source_roots(&sources);
        let record = relative_path_record(&source, root.join("Family/Season 1/Episode.mp4"));
        assert_eq!(
            linked_relative_path(&record, &roots).as_deref(),
            Some("Family/Season 1/Episode.mp4")
        );
        for path in [
            root.clone(),
            root.join("../outside.mp4"),
            root.join("Family/../../outside.mp4"),
            root.with_file_name("portable-source-other")
                .join("Episode.mp4"),
            PathBuf::from("relative/Episode.mp4"),
            root.join("C:drive-relative.mp4"),
            root.join("line\nbreak.mp4"),
        ] {
            assert!(linked_relative_path(&relative_path_record(&source, path), &roots).is_none());
        }
        let mut unbound = record.clone();
        unbound.source_id = None;
        assert!(linked_relative_path(&unbound, &roots).is_none());
        unbound.source_id = Some("c".repeat(32));
        assert!(linked_relative_path(&unbound, &roots).is_none());
        unbound = record.clone();
        unbound.linked_path = None;
        assert!(linked_relative_path(&unbound, &roots).is_none());
        let mut individual = source.clone();
        individual.kind = "file".into();
        assert!(linked_relative_path(&record, &catalog_source_roots(&[individual])).is_none());
        let mut ambiguous = source.clone();
        ambiguous.path = root.with_file_name("other-root");
        assert!(
            linked_relative_path(&record, &catalog_source_roots(&[source, ambiguous])).is_none()
        );
    }

    #[cfg(unix)]
    #[test]
    fn portable_relative_path_never_exports_lossy_names_or_backslashes() {
        use std::os::unix::ffi::OsStringExt;
        let root = std::env::temp_dir().join("portable-source");
        let source = SourceRecord {
            id: "a".repeat(32),
            name: "Movies".into(),
            kind: "folder".into(),
            path: root.clone(),
        };
        let sources = vec![source.clone()];
        let roots = catalog_source_roots(&sources);
        let bad_name = std::ffi::OsString::from_vec(b"invalid-\xff.mp4".to_vec());
        for path in [root.join(bad_name), root.join("Family\\Episode.mp4")] {
            assert!(linked_relative_path(&relative_path_record(&source, path), &roots).is_none());
        }
        let mut bad_root = source.clone();
        bad_root.path = root.join(std::ffi::OsString::from_vec(b"invalid-\xff".to_vec()));
        let record = relative_path_record(&bad_root, bad_root.path.join("Episode.mp4"));
        assert!(linked_relative_path(&record, &catalog_source_roots(&[bad_root])).is_none());
    }

    #[tokio::test]
    async fn catalog_portable_relative_paths_match_shared_fixture_across_mounts() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../../tests/fixtures/local-favorites-relative-path.json"
        ))
        .unwrap();
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(base.join("state"), "t".repeat(32), "device")
            .await
            .unwrap();
        let source_name = fixture["source"]["name"].as_str().unwrap();
        let mut folders = Vec::new();
        for mount in ["mount-one", "mount-two"] {
            let folder = base.join(mount).join(source_name);
            for item in fixture["items"].as_array().unwrap() {
                let path = folder.join(item["relativePath"].as_str().unwrap());
                fs::create_dir_all(path.parent().unwrap()).await.unwrap();
                fs::write(path, b"video").await.unwrap();
            }
            folders.push(folder);
        }
        library.link_paths(folders, true).await.unwrap();
        let catalog = library.catalog().await.unwrap();
        assert_eq!(catalog.sources.len(), 2);
        assert_ne!(catalog.sources[0].id, catalog.sources[1].id);
        assert_eq!(
            catalog.items.len(),
            fixture["items"].as_array().unwrap().len() * 2
        );
        let by_relative_path =
            |row: &serde_json::Value| row["relativePath"].as_str().unwrap().to_string();
        let mut expected = fixture["items"].as_array().unwrap().clone();
        expected.sort_by_key(by_relative_path);
        for source in &catalog.sources {
            assert_eq!(source.name, source_name);
            assert_eq!(source.kind, fixture["source"]["kind"].as_str().unwrap());
            let mut actual: Vec<_> = catalog.items.iter().filter(|item| item.source_id == source.id)
                .map(|item| serde_json::json!({"name":item.name,"directory":item.directory,"relativePath":item.relative_path}))
                .collect();
            actual.sort_by_key(by_relative_path);
            assert_eq!(actual, expected);
        }
        let body = serde_json::to_string(&catalog).unwrap();
        assert!(!body.contains("linked_path"));
        assert!(!body.contains("relative_path"));
        for source in library.source_records().await.unwrap() {
            assert!(!body.contains(source.path.to_str().unwrap()));
        }
        // Repeated cached reads must project the same paths without probing media.
        library.scan.lock().await.cached = true;
        library.original_checks.lock().unwrap().clear();
        let cached = library.catalog().await.unwrap();
        assert_eq!(
            serde_json::to_value(cached.items).unwrap(),
            serde_json::to_value(&catalog.items).unwrap()
        );
        assert!(library.original_checks.lock().unwrap().is_empty());
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn catalog_marks_imports_and_individual_files_as_unportable() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let token = "t".repeat(32);
        let library = Library::new(base.join("state"), token.clone(), "device")
            .await
            .unwrap();
        let individual = base.join("individual.mp4");
        fs::write(&individual, b"video").await.unwrap();
        library.link_paths(vec![individual], false).await.unwrap();
        let catalog = import_inner(&library, &token, "imported.mp4", Body::from("video"))
            .await
            .unwrap();
        assert_eq!(catalog.items.len(), 2);
        assert!(catalog
            .items
            .iter()
            .all(|item| item.relative_path.is_none()));
        let value = serde_json::to_value(&catalog).unwrap();
        assert!(value["items"]
            .as_array()
            .unwrap()
            .iter()
            .all(|item| item.get("relativePath") == Some(&serde_json::Value::Null)));
        fs::remove_dir_all(base).await.unwrap();
    }

    #[test]
    fn stale_job_cleanup_preserves_new_epoch_source_and_counter() {
        for cleanup_before_completion in [true, false] {
            let background = crate::background_work::BackgroundWork::default();
            let old = background.enter().unwrap();
            let mut scan = ScanState::default();
            old.publish(|| {
                scan.adopt_epoch(old.epoch());
                scan.jobs = 2;
                scan.cached = true;
            })
            .unwrap();
            Library::reserve_source(&mut scan, "old");
            background.set_standby(true);
            background.set_standby(false);
            let current = background.enter().unwrap();
            current
                .publish(|| {
                    scan.adopt_epoch(current.epoch());
                    scan.jobs = 1;
                    scan.cached = true;
                })
                .unwrap();
            let generation = Library::reserve_source(&mut scan, "current");
            if cleanup_before_completion {
                scan.finish_job(&old, Some("stale error".into()));
            }
            Library::complete_source(&mut scan, "current", generation, &current).unwrap();
            if !cleanup_before_completion {
                scan.finish_job(&old, Some("stale error".into()));
            }
            assert_eq!(scan.jobs, 1);
            assert!(scan.cached);
            assert!(scan.error.is_none());
            assert_eq!(scan.source_scans["current"].state, "complete");
            assert_eq!(scan.source_scans.len(), 1);
            scan.finish_job(&current, None);
            scan.finish_job(&old, None);
            assert_eq!(scan.jobs, 0, "old jobs cannot decrement the current epoch");
        }
    }

    #[test]
    fn completion_after_io_rejects_missing_or_replaced_source_generation() {
        for replacement in [false, true] {
            let background = crate::background_work::BackgroundWork::default();
            let work = background.enter().unwrap();
            let mut scan = ScanState::default();
            work.publish(|| {
                scan.adopt_epoch(work.epoch());
                scan.jobs = 1;
            })
            .unwrap();
            let old_generation = Library::reserve_source(&mut scan, "source");
            // This is the state change allowed while the index rename awaits IO.
            scan.invalidate();
            let new_generation = replacement.then(|| Library::reserve_source(&mut scan, "source"));
            assert!(Library::complete_source(&mut scan, "source", old_generation, &work).is_err());
            if let Some(generation) = new_generation {
                assert_eq!(scan.source_scans["source"].state, "pending");
                assert_eq!(scan.source_scans["source"].generation, generation);
                Library::complete_source(&mut scan, "source", generation, &work).unwrap();
            }
            scan.finish_job(&work, None);
            assert_eq!(
                scan.jobs, 0,
                "superseded completion must return without panicking"
            );
        }
    }

    #[tokio::test]
    async fn normal_catalog_admission_adopts_wake_epoch_before_old_jobs_drain() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let background = crate::background_work::BackgroundWork::default();
        let library = Library::new(base.clone(), "t".repeat(32), "device")
            .await
            .unwrap()
            .with_background(background.clone());
        let old = background.enter().unwrap();
        {
            let mut scan = library.scan.lock().await;
            old.publish(|| {
                scan.adopt_epoch(old.epoch());
                scan.jobs = 2;
                scan.cached = true;
                Library::reserve_source(&mut scan, "old");
            })
            .unwrap();
        }
        background.set_standby(true);
        background.set_standby(false);
        let current = background.enter().unwrap();
        library.ensure_catalog_tracked(None, current.clone()).await;
        {
            let mut scan = library.scan.lock().await;
            assert_eq!(scan.work_epoch, Some(current.epoch()));
            assert!(!scan.source_scans.contains_key("old"));
            let current_jobs = scan.jobs;
            assert!(
                current_jobs <= 1,
                "old jobs cannot block new catalog admission"
            );
            scan.finish_job(&old, Some("late old failure".into()));
            assert_eq!(scan.jobs, current_jobs);
            assert!(scan.error.is_none());
        }
        drop(old);
        drop(current);
        wait_for_drain(&background).await;
        let catalog = library.catalog().await.unwrap();
        assert!(!catalog.scanning);
        assert!(catalog.scan_error.is_none());
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn wake_admission_survives_old_worker_cleanup_without_waiting() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let old_folder = base.join("Old");
        let movies = base.join("Movies");
        fs::create_dir_all(&old_folder).await.unwrap();
        fs::create_dir_all(&movies).await.unwrap();
        fs::write(movies.join("movie.mp4"), b"video").await.unwrap();
        let background = crate::background_work::BackgroundWork::default();
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap()
            .with_background(background.clone());
        let old_work = background.enter().unwrap();
        let sources = library.source_records().await.unwrap();
        let old_source = library
            .register_source(&old_folder, true, &sources, &old_work, None)
            .await
            .unwrap();
        let worker = library.source_worker(&old_source.id).await;
        let held_worker = worker.lock().await;
        library
            .prioritize_source_tracked(&old_source.id, old_work.clone())
            .await
            .unwrap();
        let mut held_scan = library.scan.lock().await;
        assert!(held_scan.jobs > 0);
        background.set_standby(true);
        background.set_standby(false);
        let current = background.enter().unwrap();
        current
            .publish(|| held_scan.adopt_epoch(current.epoch()))
            .unwrap();
        assert_eq!(held_scan.jobs, 0);
        drop(held_scan);
        drop(old_work);
        let selected = library
            .start_link_folder_path_tracked(movies, current.clone())
            .await
            .unwrap();
        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            loop {
                let scan = library.scan.lock().await;
                if scan
                    .source_scans
                    .get(&selected.id)
                    .is_some_and(|state| state.state == "complete")
                {
                    assert_eq!(scan.work_epoch, Some(current.epoch()));
                    assert!(scan.cached);
                    assert!(scan.error.is_none());
                    break;
                }
                drop(scan);
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("new source must complete while the old source worker is held");
        drop(held_worker);
        drop(current);
        wait_for_drain(&background).await;
        let catalog = library.catalog().await.unwrap();
        assert!(!catalog.scanning);
        assert!(catalog.scan_error.is_none());
        assert_eq!(catalog.items.len(), 1);
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn disconnect_during_metadata_read_preserves_other_files() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let folder = base.join("Folder");
        fs::create_dir_all(&folder).await.unwrap();
        fs::write(folder.join("removed.mp4"), b"video")
            .await
            .unwrap();
        let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let source = library
            .start_link_folder_path_tracked(folder, library.background.enter().unwrap())
            .await
            .unwrap();
        wait_for_drain(&library.background).await;
        let original = base.join("individual.mp4");
        fs::write(&original, b"video").await.unwrap();
        let original = fs::canonicalize(original).await.unwrap();
        for n in 0..32 {
            let record = Record {
                id: uuid::Uuid::new_v4().simple().to_string(),
                name: format!("Individual {n}"),
                size: 5,
                mime: "video/mp4".into(),
                extension: "mp4".into(),
                linked_path: Some(original.clone()),
                source_id: None,
            };
            fs::write(
                library.root.join(format!("{}.json", record.id)),
                serde_json::to_vec(&record).unwrap(),
            )
            .await
            .unwrap();
        }
        library.original_checks.lock().unwrap().clear();
        let gate = Arc::new(Mutex::new(()));
        let held = gate.lock().await;
        library.metadata_read_gate = Some(gate.clone());
        library.start_refresh_sources().await;
        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            while library.original_checks.lock().unwrap().is_empty() {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        library.disconnect_source(&source.id).await.unwrap();
        drop(held);
        wait_for_drain(&library.background).await;
        let catalog = library.catalog().await.unwrap();
        assert!(!catalog.scanning);
        assert_eq!(catalog.items.len(), 32);
        assert!(catalog
            .items
            .iter()
            .all(|item| item.name.starts_with("Individual ")));
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn unavailable_priority_source_retains_saved_references() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let folder = base.join("Movies");
        fs::create_dir_all(&folder).await.unwrap();
        fs::write(folder.join("movie.mp4"), b"video").await.unwrap();
        let root = base.join("metadata");
        let first = Library::new(root.clone(), "t".repeat(32), "device")
            .await
            .unwrap();
        let source = first
            .start_link_folder_path_tracked(folder.clone(), first.background.enter().unwrap())
            .await
            .unwrap();
        wait_for_drain(&first.background).await;
        let item_id = first.catalog().await.unwrap().items[0].id.clone();
        // Folder records are deferred to their source worker at startup. An
        // unrelated individual file must keep the global metadata pass held.
        let original = base.join("individual.mp4");
        fs::write(&original, b"video").await.unwrap();
        let original = fs::canonicalize(original).await.unwrap();
        let individual = Record {
            id: uuid::Uuid::new_v4().simple().to_string(),
            name: "Individual".into(),
            size: 5,
            mime: "video/mp4".into(),
            extension: "mp4".into(),
            linked_path: Some(original.clone()),
            source_id: None,
        };
        fs::write(
            root.join(format!("{}.json", individual.id)),
            serde_json::to_vec(&individual).unwrap(),
        )
        .await
        .unwrap();
        fs::remove_dir_all(folder).await.unwrap();
        let mut library = Library::new(root, "t".repeat(32), "device").await.unwrap();
        let gate = Arc::new(Mutex::new(()));
        let held = gate.lock().await;
        library.metadata_read_gate = Some(gate.clone());
        library
            .prioritize_source_tracked(&source.id, library.background.enter().unwrap())
            .await
            .unwrap();
        let catalog = tokio::time::timeout(std::time::Duration::from_secs(2), async {
            loop {
                let catalog = library.catalog().await.unwrap();
                if catalog
                    .source_scans
                    .iter()
                    .any(|state| state.source_id == source.id && state.state == "error")
                    && library.original_checks.lock().unwrap().contains(&original)
                {
                    break catalog;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        assert!(catalog.scanning, "global metadata pass is still held");
        assert_eq!(catalog.items.len(), 1);
        assert_eq!(catalog.items[0].id, item_id);
        assert!(!catalog.items[0].available);
        assert!(catalog.scan_error.is_none());
        drop(held);
        wait_for_drain(&library.background).await;
        let catalog = library.catalog().await.unwrap();
        assert!(!catalog.scanning);
        assert_eq!(catalog.items.len(), 2);
        assert!(catalog
            .items
            .iter()
            .any(|item| item.id == item_id && !item.available));
        assert!(catalog
            .items
            .iter()
            .any(|item| item.id == individual.id && item.available));
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn uncached_catalog_omits_authoritative_source_completion() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let folder = base.join("Movies");
        fs::create_dir_all(&folder).await.unwrap();
        fs::write(folder.join("movie.mp4"), b"video").await.unwrap();
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        library
            .start_link_folder_path_tracked(folder, library.background.enter().unwrap())
            .await
            .unwrap();
        wait_for_drain(&library.background).await;
        assert_eq!(
            library.catalog().await.unwrap().source_scans[0].state,
            "complete"
        );
        library.scan.lock().await.cached = false;
        let catalog = library.catalog().await.unwrap();
        assert_eq!(catalog.items.len(), 1);
        assert!(catalog.source_scans.is_empty());
        assert!(serde_json::to_value(catalog)
            .unwrap()
            .get("sourceScans")
            .is_none());
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn five_movies_complete_while_unrelated_source_is_stalled() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let ffff = base.join("FFFF");
        let movies = base.join("Movies");
        fs::create_dir_all(&ffff).await.unwrap();
        fs::create_dir_all(&movies).await.unwrap();
        for n in 0..5 {
            fs::write(movies.join(format!("movie-{n}.mp4")), b"video")
                .await
                .unwrap();
        }
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let work = library.background.enter().unwrap();
        let sources = library.source_records().await.unwrap();
        let source = library
            .register_source(&ffff, true, &sources, &work, None)
            .await
            .unwrap();
        drop(work);
        let ffff_worker = library.source_worker(&source.id).await;
        let stalled = ffff_worker.lock().await;
        library
            .prioritize_source_tracked(&source.id, library.background.enter().unwrap())
            .await
            .unwrap();
        let selected = tokio::time::timeout(
            std::time::Duration::from_secs(2),
            library.start_link_folder_path_tracked(movies, library.background.enter().unwrap()),
        )
        .await
        .unwrap()
        .unwrap();
        let pending = library.catalog().await.unwrap();
        let generation = pending
            .source_scans
            .iter()
            .find(|s| s.source_id == selected.id)
            .unwrap()
            .generation;
        let ready = tokio::time::timeout(std::time::Duration::from_secs(2), async {
            loop {
                let catalog = library.catalog().await.unwrap();
                if catalog
                    .source_scans
                    .iter()
                    .any(|s| s.source_id == selected.id && s.state == "complete")
                {
                    break catalog;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("five Movies must finish before FFFF resumes");
        assert!(ready.scanning, "the global FFFF scan must still be pending");
        assert_eq!(
            ready
                .source_scans
                .iter()
                .find(|s| s.source_id == selected.id)
                .unwrap()
                .generation,
            generation
        );
        assert_eq!(
            ready
                .items
                .iter()
                .filter(|i| i.source_id == selected.id && i.available)
                .count(),
            5
        );
        assert!(!ready
            .source_scans
            .iter()
            .any(|s| s.source_id == source.id && s.state == "complete"));
        drop(stalled);
        wait_for_drain(&library.background).await;
        let complete = library.catalog().await.unwrap();
        assert_eq!(complete.items.len(), 5);
        assert_eq!(
            complete
                .source_scans
                .iter()
                .find(|s| s.source_id == selected.id)
                .unwrap()
                .generation,
            generation,
            "the later global sweep must reuse the completed source generation"
        );
        fs::remove_dir_all(base).await.unwrap();
    }

    async fn seed_legacy_source(
        library: &Library,
        folder: &FsPath,
        count: usize,
    ) -> (SourceRecord, HashSet<String>) {
        fs::create_dir_all(folder).await.unwrap();
        let folder = fs::canonicalize(folder).await.unwrap();
        let work = library.background.enter().unwrap();
        let source = library
            .register_source(
                &folder,
                true,
                &library.source_records().await.unwrap(),
                &work,
                None,
            )
            .await
            .unwrap();
        let mut ids = HashSet::new();
        for n in 0..count {
            let path = folder.join(format!("movie-{n}.mp4"));
            std::fs::write(&path, b"video").unwrap();
            let id = uuid::Uuid::new_v4().simple().to_string();
            let record = Record {
                id: id.clone(),
                name: format!("Movie {n}"),
                size: 5,
                mime: "video/mp4".into(),
                extension: "mp4".into(),
                linked_path: Some(path),
                source_id: Some(source.id.clone()),
            };
            std::fs::write(
                library.root.join(format!("{id}.json")),
                serde_json::to_vec(&record).unwrap(),
            )
            .unwrap();
            ids.insert(id);
        }
        fs::remove_file(
            library
                .root
                .join("source-index")
                .join(format!("{}.json", source.id)),
        )
        .await
        .unwrap();
        (source, ids)
    }

    // Exercise exactly one admitted generation without the global startup
    // sweep scheduling an intentional recovery scan after the injected error.
    async fn isolated_source_scan(
        library: &Library,
        source: &SourceRecord,
    ) -> tokio::task::JoinHandle<anyhow::Result<()>> {
        let work = library.background.enter().unwrap();
        library.prepare_scan_epoch(&work).await.unwrap();
        let generation = {
            let mut scan = library.scan.lock().await;
            work.publish(|| {
                scan.cached = true;
                scan.jobs += 1;
                Library::reserve_source(&mut scan, &source.id)
            })
            .unwrap()
        };
        let runner = library.clone();
        let source = source.clone();
        tokio::spawn(async move {
            let result = runner.scan_source(source, &work, Some(generation)).await;
            runner.scan.lock().await.finish_job(&work, None);
            result
        })
    }

    async fn wait_for_source_item(library: &Library, source: &SourceRecord) -> Catalog {
        tokio::time::timeout(std::time::Duration::from_secs(5), async {
            loop {
                let snapshot = library.catalog().await.unwrap();
                if snapshot
                    .items
                    .iter()
                    .any(|item| item.source_id == source.id && item.available)
                {
                    return snapshot;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("selected original must publish before full metadata")
    }

    #[tokio::test]
    async fn missed_preview_streams_first_legacy_id_before_blocked_full_metadata() {
        for indexed in [false, true] {
            let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
            let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
                .await
                .unwrap();
            let (_, unrelated) = seed_legacy_source(&library, &base.join("Other"), 20).await;
            let (source, expected) = seed_legacy_source(&library, &base.join("Selected"), 8).await;
            if indexed {
                let mut records = Vec::new();
                for id in &expected {
                    records.push(library.record(id).await.unwrap());
                }
                let expanded: Vec<_> = (0..400)
                    .map(|i| records[i % records.len()].clone())
                    .collect();
                fs::write(
                    library
                        .root
                        .join("source-index")
                        .join(format!("{}.json", source.id)),
                    serde_json::to_vec(&expanded).unwrap(),
                )
                .await
                .unwrap();
            }
            library.force_early_source_miss = true;
            let full = Arc::new(Semaphore::new(0));
            library.source_metadata_gate = Some(full.clone());
            let task = isolated_source_scan(&library, &source).await;
            let first = wait_for_source_item(&library, &source).await;
            let selected: Vec<_> = first
                .items
                .iter()
                .filter(|item| item.source_id == source.id)
                .collect();
            assert_eq!(selected.len(), 1);
            assert!(expected.contains(&selected[0].id));
            assert!(!unrelated.contains(&selected[0].id));
            assert_eq!(full.available_permits(), 0);
            assert!(
                library.scan_entries.lock().unwrap().is_empty(),
                "ordinary traversal remains behind full metadata"
            );
            full.add_permits(1);
            tokio::time::timeout(std::time::Duration::from_secs(5), task)
                .await
                .unwrap()
                .unwrap()
                .unwrap();
            let completed = library.catalog().await.unwrap();
            assert_eq!(
                completed
                    .items
                    .iter()
                    .filter(|item| item.source_id == source.id)
                    .map(|item| item.id.clone())
                    .collect::<HashSet<_>>(),
                expected
            );
            let saved = expected.iter().next().unwrap();
            let work = library.background.enter().unwrap();
            let (_, found, status) = library.preferred_record(saved, &work).await.unwrap();
            assert_eq!(status.state, "found");
            assert_eq!(&found.unwrap().id, saved);
            drop(work);
            wait_for_drain(&library.background).await;
            fs::remove_dir_all(base).await.unwrap();
        }
    }

    #[tokio::test]
    async fn new_source_walks_before_full_metadata_of_unrelated_sources() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let (other, _) = seed_legacy_source(&library, &base.join("Other"), 300).await;
        let (source, empty) = seed_legacy_source(&library, &base.join("Selected"), 0).await;
        assert!(empty.is_empty());
        fs::write(source.path.join("first.mp4"), b"video")
            .await
            .unwrap();
        let slow = source.path.join("Slow");
        fs::create_dir(&slow).await.unwrap();
        fs::write(slow.join("tail.mp4"), b"video").await.unwrap();
        library.force_early_source_miss = true;
        let full = Arc::new(Semaphore::new(0));
        let originals = Arc::new(Semaphore::new(0));
        let tail = Arc::new(Semaphore::new(0));
        library.source_metadata_gate = Some(full.clone());
        library.metadata_bootstrap_gate = Some(full.clone());
        library.original_read_gate = Some((other.path.clone(), originals.clone()));
        library.scan_entry_gate = Some((slow, tail.clone()));
        let task = isolated_source_scan(&library, &source).await;
        let first = wait_for_source_item(&library, &source).await;
        let published = first
            .items
            .iter()
            .find(|item| item.source_id == source.id && item.available)
            .unwrap()
            .id
            .clone();
        assert_eq!(
            full.available_permits(),
            0,
            "unrelated full JSON passes stay blocked"
        );
        assert_eq!(
            originals.available_permits(),
            0,
            "unrelated originals must not be probed"
        );
        assert!(library.original_checks.lock().unwrap().is_empty());
        assert!(library.record(&published).await.is_ok());
        tail.add_permits(8);
        tokio::time::timeout(std::time::Duration::from_secs(5), task)
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        let completed = library.catalog().await.unwrap();
        assert_eq!(
            completed
                .items
                .iter()
                .filter(|item| item.source_id == source.id)
                .count(),
            2
        );
        assert!(completed
            .items
            .iter()
            .any(|item| item.id == published && item.available));
        assert_eq!(
            full.available_permits(),
            0,
            "absence proof skips redundant full metadata"
        );
        let work = library.background.enter().unwrap();
        let (_, record, status) = library.preferred_record(&published, &work).await.unwrap();
        assert_eq!(status.state, "found");
        assert_eq!(record.unwrap().id, published);
        drop(work);
        wait_for_drain(&library.background).await;
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn streamed_first_record_never_publishes_after_cancel_or_supersession() {
        for superseded in [false, true] {
            let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
            let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
                .await
                .unwrap();
            let (source, _) = seed_legacy_source(&library, &base.join("Selected"), 1).await;
            library.force_early_source_miss = true;
            let original = Arc::new(Semaphore::new(0));
            library.original_read_gate = Some((source.path.clone(), original.clone()));
            library.source_metadata_gate = Some(Arc::new(Semaphore::new(0)));
            let task = isolated_source_scan(&library, &source).await;
            tokio::time::timeout(std::time::Duration::from_secs(5), async {
                while library.original_checks.lock().unwrap().is_empty() {
                    tokio::task::yield_now().await;
                }
            })
            .await
            .unwrap();
            if superseded {
                Library::reserve_source(&mut *library.scan.lock().await, &source.id);
            } else {
                library.background.set_standby(true);
            }
            original.add_permits(1);
            assert!(
                tokio::time::timeout(std::time::Duration::from_secs(5), task)
                    .await
                    .unwrap()
                    .unwrap()
                    .is_err()
            );
            assert!(
                library.scan.lock().await.records.is_empty(),
                "old generation/epoch cannot publish its late original"
            );
            wait_for_drain(&library.background).await;
            fs::remove_dir_all(base).await.unwrap();
        }
    }

    #[tokio::test]
    async fn first_legacy_item_precedes_full_metadata_with_cold_or_large_index() {
        for indexed in [false, true] {
            let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
            let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
                .await
                .unwrap();
            let (_, unrelated) = seed_legacy_source(&library, &base.join("Other"), 12).await;
            let (source, expected) = seed_legacy_source(&library, &base.join("Selected"), 40).await;
            if indexed {
                let mut records = Vec::new();
                for id in &expected {
                    records.push(library.record(id).await.unwrap());
                }
                // Preserve every legacy mapping in the full index while
                // making its JSON larger than the bounded prefix.
                let expanded: Vec<_> = (0..400)
                    .map(|index| records[index % records.len()].clone())
                    .collect();
                let bytes = serde_json::to_vec(&expanded).unwrap();
                assert!(bytes.len() > EARLY_INDEX_BYTES as usize);
                fs::write(
                    library
                        .root
                        .join("source-index")
                        .join(format!("{}.json", source.id)),
                    bytes,
                )
                .await
                .unwrap();
            }
            let global = Arc::new(Semaphore::new(0));
            let full = Arc::new(Semaphore::new(0));
            library.metadata_bootstrap_gate = Some(global.clone());
            library.source_metadata_gate = Some(full.clone());
            let started = std::time::Instant::now();
            library
                .prioritize_source_tracked(&source.id, library.background.enter().unwrap())
                .await
                .unwrap();
            let snapshot = tokio::time::timeout(std::time::Duration::from_secs(3), async {
                loop {
                    let snapshot = library.catalog().await.unwrap();
                    if snapshot
                        .items
                        .iter()
                        .any(|item| item.source_id == source.id && item.available)
                    {
                        break snapshot;
                    }
                    tokio::task::yield_now().await;
                }
            })
            .await
            .expect("first validated item must precede blocked full metadata");
            assert!(snapshot.scanning);
            let selected: Vec<_> = snapshot
                .items
                .iter()
                .filter(|item| item.source_id == source.id)
                .collect();
            assert_eq!(selected.len(), 1);
            assert!(expected.contains(&selected[0].id));
            assert!(!unrelated.contains(&selected[0].id));
            assert!(
                library.scan_entries.lock().unwrap().is_empty(),
                "full filesystem walk is still gated"
            );
            assert_eq!(global.available_permits(), 0);
            assert_eq!(full.available_permits(), 0);
            assert!(library.original_checks.lock().unwrap().len() <= 2 * EARLY_SOURCE_CANDIDATES);
            tracing::debug!(
                first_item_ms = started.elapsed().as_millis() as u64,
                indexed,
                "first item observed before full metadata release"
            );
            global.add_permits(8);
            full.add_permits(8);
            wait_for_drain(&library.background).await;
            let completed = library.catalog().await.unwrap();
            assert!(!completed.scanning);
            assert_eq!(
                completed
                    .items
                    .iter()
                    .filter(|item| item.source_id == source.id)
                    .map(|item| item.id.clone())
                    .collect::<HashSet<_>>(),
                expected
            );
            fs::remove_dir_all(base).await.unwrap();
        }
    }

    #[tokio::test]
    async fn early_modern_id_ignores_unrelated_metadata_window_without_creating_ids() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        // More unrelated metadata than the entire fallback window, created
        // before the selected source. Success must not depend on read_dir order.
        let (_, unrelated) = seed_legacy_source(&library, &base.join("Other"), 300).await;
        let (source, old_ids) = seed_legacy_source(&library, &base.join("Selected"), 1).await;
        let old_id = old_ids.iter().next().unwrap();
        let mut record = library.record(old_id).await.unwrap();
        let path = record.linked_path.as_ref().unwrap();
        let mut hash = Sha256::new();
        hash.update(source.id.as_bytes());
        hash.update([0]);
        hash.update(path.as_os_str().as_encoded_bytes());
        record.id = format!("{:x}", hash.finalize())[..32].to_string();
        fs::remove_file(library.root.join(format!("{old_id}.json")))
            .await
            .unwrap();
        fs::write(
            library.root.join(format!("{}.json", record.id)),
            serde_json::to_vec(&record).unwrap(),
        )
        .await
        .unwrap();
        let work = library.background.enter().unwrap();
        let found = library.early_source_record(&source, &work).await.unwrap();
        assert_eq!(found.id, record.id);
        assert!(!unrelated.contains(&found.id));
        assert_eq!(
            library.early_metadata_entries.load(Ordering::SeqCst),
            0,
            "directory-derived existing ID must precede global metadata fallback"
        );
        assert!(!library.root.join(format!("{old_id}.json")).exists());
        fs::remove_file(library.root.join(format!("{}.json", record.id)))
            .await
            .unwrap();
        assert!(
            library.early_source_record(&source, &work).await.is_none(),
            "a filesystem path without an existing record must not receive an ID"
        );
        assert!(!library.root.join(format!("{}.json", record.id)).exists());
        drop(work);
        wait_for_drain(&library.background).await;
        fs::remove_dir_all(base).await.unwrap();
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn early_probe_rejects_symlink_escape_and_stale_index_identity() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let (source, ids) = seed_legacy_source(&library, &base.join("Selected"), 1).await;
        let id = ids.iter().next().unwrap();
        let original = library.record(id).await.unwrap();
        let path = original.linked_path.as_ref().unwrap();
        let outside = base.join("outside.mp4");
        fs::write(&outside, b"outside").await.unwrap();
        fs::remove_file(path).await.unwrap();
        std::os::unix::fs::symlink(&outside, path).unwrap();
        let index = library
            .root
            .join("source-index")
            .join(format!("{}.json", source.id));
        fs::write(&index, serde_json::to_vec(&vec![original.clone()]).unwrap())
            .await
            .unwrap();
        let work = library.background.enter().unwrap();
        assert!(library.early_source_record(&source, &work).await.is_none());
        fs::remove_file(path).await.unwrap();
        fs::write(path, b"video").await.unwrap();
        let mut changed = original.clone();
        changed.source_id = Some("f".repeat(32));
        fs::write(
            library.root.join(format!("{id}.json")),
            serde_json::to_vec(&changed).unwrap(),
        )
        .await
        .unwrap();
        assert!(
            library.early_source_record(&source, &work).await.is_none(),
            "index identity cannot override authoritative source binding"
        );
        changed.source_id = original.source_id;
        changed.linked_path = Some(outside);
        fs::write(
            library.root.join(format!("{id}.json")),
            serde_json::to_vec(&changed).unwrap(),
        )
        .await
        .unwrap();
        assert!(
            library.early_source_record(&source, &work).await.is_none(),
            "a changed outside path cannot become a source candidate"
        );
        drop(work);
        wait_for_drain(&library.background).await;
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn early_probe_deadline_drains_owned_operation_before_returning() {
        let background = crate::background_work::BackgroundWork::default();
        let work = background.enter().unwrap();
        let (entered, entered_rx) = tokio::sync::oneshot::channel();
        let (release, release_rx) = tokio::sync::oneshot::channel();
        let later = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let observed = later.clone();
        let task = tokio::spawn(async move {
            owned_read_until(
                &work,
                Some(std::time::Instant::now() + std::time::Duration::from_millis(10)),
                move |owner| async move {
                    // A syscall analogue: cancellation/deadline cannot drop
                    // the current operation, but no next operation is admitted.
                    checked(Some(&owner), async move {
                        entered.send(()).unwrap();
                        release_rx.await.unwrap();
                    })
                    .await?;
                    observed.store(true, Ordering::SeqCst);
                    Ok(())
                },
            )
            .await
        });
        entered_rx.await.unwrap();
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        background.set_standby(true);
        assert!(
            !task.is_finished(),
            "in-flight operation must remain owned until drained"
        );
        release.send(()).unwrap();
        assert!(task.await.unwrap().is_err());
        assert!(
            !later.load(Ordering::SeqCst),
            "expired probe cannot admit subsequent work"
        );
        wait_for_drain(&background).await;
    }

    #[tokio::test]
    async fn folder_walk_preserves_legacy_and_unavailable_ids_without_per_file_realpath() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let (source, expected) = seed_legacy_source(&library, &base.join("Movies"), 67).await;
        let work = library.background.enter().unwrap();
        let records = library.source_metadata(&source, true, &work).await.unwrap();
        drop(work);
        for record in records.iter().take(3) {
            fs::remove_file(record.linked_path.as_ref().unwrap())
                .await
                .unwrap();
        }
        library
            .prioritize_source_tracked(&source.id, library.background.enter().unwrap())
            .await
            .unwrap();
        wait_for_drain(&library.background).await;
        let catalog = library.catalog().await.unwrap();
        assert_eq!(catalog.source_scans[0].state, "complete");
        assert!(catalog.scan_error.is_none());
        assert_eq!(
            catalog
                .items
                .iter()
                .map(|item| item.id.clone())
                .collect::<HashSet<_>>(),
            expected
        );
        assert_eq!(
            catalog.items.iter().filter(|item| item.available).count(),
            64
        );
        assert_eq!(
            catalog.items.iter().filter(|item| !item.available).count(),
            3
        );
        let early_checks = library.original_checks.lock().unwrap().len();
        assert!(
            early_checks <= EARLY_SOURCE_CANDIDATES,
            "only the bounded first-publication probe may canonicalize originals"
        );
        assert_eq!(
            *library.scan_leaf_metadata.lock().unwrap(),
            vec![source.path.clone()],
            "known regular files reuse enumeration types without another lstat"
        );
        assert_eq!(
            *library.scan_directories.lock().unwrap(),
            vec![source.path.clone(), source.path.clone()]
        );
        let index: Vec<Record> = serde_json::from_slice(
            &fs::read(
                library
                    .root
                    .join("source-index")
                    .join(format!("{}.json", source.id)),
            )
            .await
            .unwrap(),
        )
        .unwrap();
        assert_eq!(
            index
                .iter()
                .map(|item| item.id.clone())
                .collect::<HashSet<_>>(),
            expected
        );
        let item = catalog.items.iter().find(|item| item.available).unwrap();
        let mut headers = HeaderMap::new();
        headers.insert("range", "bytes=1-3".parse().unwrap());
        let response = media(
            State(library.clone()),
            Path(("t".repeat(32), item.id.clone())),
            headers,
            Method::GET,
        )
        .await;
        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(
            axum::body::to_bytes(response.into_body(), 16)
                .await
                .unwrap(),
            "ide"
        );
        assert_eq!(
            library.original_checks.lock().unwrap().len(),
            early_checks + 1,
            "serving must retain full original-path validation"
        );
        fs::remove_dir_all(base).await.unwrap();
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn folder_walk_cached_leaf_type_never_authorizes_a_replaced_original() {
        for replace_after_enumeration in [false, true] {
            let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
            let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
                .await
                .unwrap();
            let (source, expected) = seed_legacy_source(&library, &base.join("Movies"), 1).await;
            let id = expected.iter().next().unwrap().clone();
            let record = library.record(&id).await.unwrap();
            let path = record.linked_path.clone().unwrap();
            let outside = base.join("outside.mp4");
            fs::write(&outside, b"outside").await.unwrap();
            let gate = Arc::new(Semaphore::new(0));
            if replace_after_enumeration {
                library.scan_entry_gate = Some((source.path.clone(), gate.clone()));
            } else {
                fs::remove_file(&path).await.unwrap();
                std::os::unix::fs::symlink(&outside, &path).unwrap();
            }
            let scan_run = isolated_source_scan(&library, &source).await;
            if replace_after_enumeration {
                tokio::time::timeout(std::time::Duration::from_secs(3), async {
                    while !library.scan_entries.lock().unwrap().contains(&path) {
                        tokio::task::yield_now().await;
                    }
                })
                .await
                .unwrap();
                let directory = std::fs::File::open(&source.path).unwrap();
                let modified = directory.metadata().unwrap().modified().unwrap();
                fs::remove_file(&path).await.unwrap();
                std::os::unix::fs::symlink(&outside, &path).unwrap();
                // Filesystem timestamp granularity can coalesce this replacement
                // with the original directory stamp. Make the mutated namespace
                // observably different before releasing the cached-type gate.
                directory
                    .set_times(
                        std::fs::FileTimes::new()
                            .set_modified(modified + std::time::Duration::from_secs(2)),
                    )
                    .unwrap();
                assert_ne!(directory.metadata().unwrap().modified().unwrap(), modified);
                gate.add_permits(1);
                assert!(
                    scan_run.await.unwrap().is_err(),
                    "directory bookend must reject changed namespace"
                );
                assert!(
                    !library.scan_leaf_metadata.lock().unwrap().contains(&path),
                    "test must exercise the cached enumeration type"
                );
            } else {
                scan_run.await.unwrap().unwrap();
            }
            wait_for_drain(&library.background).await;
            let catalog = library.catalog().await.unwrap();
            assert_eq!(catalog.items.len(), 1);
            assert_eq!(catalog.items[0].id, id);
            if replace_after_enumeration {
                assert_eq!(catalog.source_scans[0].state, "error");
                assert!(catalog.scan_error.is_some());
            } else {
                assert_eq!(catalog.source_scans[0].state, "complete");
                assert!(
                    !catalog.items[0].available,
                    "an initial symlink is never a playable file"
                );
            }
            let response = media(
                State(library.clone()),
                Path(("t".repeat(32), id)),
                HeaderMap::new(),
                Method::GET,
            )
            .await;
            assert!(
                response.status().is_client_error(),
                "cached type must not authorize serving the replacement"
            );
            fs::remove_dir_all(base).await.unwrap();
        }
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn folder_walk_rejects_changed_parent_and_final_root_identity() {
        for final_root in [false, true] {
            let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
            let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
                .await
                .unwrap();
            let (source, expected) = seed_legacy_source(&library, &base.join("Movies"), 1).await;
            let id = expected.iter().next().unwrap().clone();
            let mut record = library.record(&id).await.unwrap();
            let target = if final_root {
                source.path.clone()
            } else {
                let nested = source.path.join("nested");
                fs::create_dir(&nested).await.unwrap();
                let destination = nested.join("movie.mp4");
                fs::rename(record.linked_path.as_ref().unwrap(), &destination)
                    .await
                    .unwrap();
                record.linked_path = Some(destination);
                fs::write(
                    library.root.join(format!("{id}.json")),
                    serde_json::to_vec(&record).unwrap(),
                )
                .await
                .unwrap();
                nested
            };
            let outside = base.join("outside");
            fs::create_dir(&outside).await.unwrap();
            fs::write(outside.join("movie.mp4"), b"outside")
                .await
                .unwrap();
            let gate = Arc::new(Semaphore::new(usize::from(final_root)));
            library.scan_directory_gate = Some((target.clone(), gate.clone()));
            let scan_run = isolated_source_scan(&library, &source).await;
            tokio::time::timeout(std::time::Duration::from_secs(3), async {
                while library
                    .scan_directories
                    .lock()
                    .unwrap()
                    .iter()
                    .filter(|path| **path == target)
                    .count()
                    < if final_root { 2 } else { 1 }
                {
                    tokio::task::yield_now().await;
                }
            })
            .await
            .unwrap();
            fs::rename(&target, base.join("displaced")).await.unwrap();
            std::os::unix::fs::symlink(&outside, &target).unwrap();
            gate.add_permits(16);
            assert!(scan_run.await.unwrap().is_err());
            wait_for_drain(&library.background).await;
            let catalog = library.catalog().await.unwrap();
            assert_eq!(catalog.source_scans[0].state, "error");
            assert!(catalog.scan_error.is_some());
            assert_eq!(
                catalog
                    .items
                    .iter()
                    .map(|item| item.id.clone())
                    .collect::<HashSet<_>>(),
                expected
            );
            if !final_root {
                assert!(!catalog.items[0].available);
            }
            let response = media(
                State(library.clone()),
                Path(("t".repeat(32), id)),
                HeaderMap::new(),
                Method::GET,
            )
            .await;
            assert!(
                response.status().is_client_error(),
                "redirected originals must never be served"
            );
            fs::remove_dir_all(base).await.unwrap();
        }
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn folder_walk_preserves_unverified_records_when_subtree_access_is_denied() {
        use std::os::unix::fs::PermissionsExt;
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let (source, expected) = seed_legacy_source(&library, &base.join("Movies"), 3).await;
        let id = expected.iter().next().unwrap().clone();
        let mut record = library.record(&id).await.unwrap();
        let denied = source.path.join("denied");
        fs::create_dir(&denied).await.unwrap();
        let destination = denied.join("movie.mp4");
        fs::rename(record.linked_path.as_ref().unwrap(), &destination)
            .await
            .unwrap();
        record.linked_path = Some(destination);
        fs::write(
            library.root.join(format!("{id}.json")),
            serde_json::to_vec(&record).unwrap(),
        )
        .await
        .unwrap();
        fs::set_permissions(&denied, std::fs::Permissions::from_mode(0o000))
            .await
            .unwrap();
        let enforced = fs::read_dir(&denied).await.is_err();
        library
            .prioritize_source_tracked(&source.id, library.background.enter().unwrap())
            .await
            .unwrap();
        wait_for_drain(&library.background).await;
        fs::set_permissions(&denied, std::fs::Permissions::from_mode(0o700))
            .await
            .unwrap();
        if enforced {
            let catalog = library.catalog().await.unwrap();
            assert_eq!(catalog.source_scans[0].state, "error");
            assert!(catalog.scan_error.is_some());
            assert_eq!(
                catalog
                    .items
                    .iter()
                    .map(|item| item.id.clone())
                    .collect::<HashSet<_>>(),
                expected
            );
            assert!(catalog
                .items
                .iter()
                .any(|item| item.id == id && !item.available));
            assert_eq!(
                catalog.items.iter().filter(|item| item.available).count(),
                2
            );
        }
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn folder_walk_does_not_trust_deleted_or_changed_index_records() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let (source, _) = seed_legacy_source(&library, &base.join("Movies"), 4).await;
        let work = library.background.enter().unwrap();
        let records = library.source_metadata(&source, true, &work).await.unwrap();
        fs::write(
            library
                .root
                .join("source-index")
                .join(format!("{}.json", source.id)),
            serde_json::to_vec(&records).unwrap(),
        )
        .await
        .unwrap();
        fs::remove_file(library.root.join(format!("{}.json", records[0].id)))
            .await
            .unwrap();
        let mut changed = records[1].clone();
        changed.source_id = Some("other-source".into());
        fs::write(
            library.root.join(format!("{}.json", changed.id)),
            serde_json::to_vec(&changed).unwrap(),
        )
        .await
        .unwrap();
        let mut changed = records[2].clone();
        changed.linked_path = Some(base.join("outside.mp4"));
        fs::write(
            library.root.join(format!("{}.json", changed.id)),
            serde_json::to_vec(&changed).unwrap(),
        )
        .await
        .unwrap();
        library.prepare_scan_epoch(&work).await.unwrap();
        library.scan.lock().await.cached = true;
        library
            .scan_source(source.clone(), &work, None)
            .await
            .unwrap();
        drop(work);
        let catalog = library.catalog().await.unwrap();
        assert_eq!(catalog.items.len(), 4);
        assert!(catalog
            .items
            .iter()
            .all(|item| item.available && item.source_id == source.id));
        assert!(catalog.items.iter().any(|item| item.id == records[3].id));
        for invalid in records.iter().take(3) {
            assert!(
                !catalog.items.iter().any(|item| item.id == invalid.id),
                "stale index cannot resurrect invalid metadata"
            );
        }
        assert!(library.original_checks.lock().unwrap().len() <= EARLY_SOURCE_CANDIDATES);
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn removing_item_during_folder_walk_retires_its_generation() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let (source, expected) = seed_legacy_source(&library, &base.join("Movies"), 8).await;
        let gate = Arc::new(Semaphore::new(0));
        library.scan_entry_gate = Some((source.path.clone(), gate.clone()));
        let scan_run = isolated_source_scan(&library, &source).await;
        tokio::time::timeout(std::time::Duration::from_secs(3), async {
            while library.scan_entries.lock().unwrap().len() < SOURCE_PROBE_CONCURRENCY + 1 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        let id = expected.iter().next().unwrap().clone();
        let response = remove(library.clone(), Path(("t".repeat(32), id.clone()))).await;
        assert!(response.status().is_success());
        gate.add_permits(16);
        assert!(scan_run.await.unwrap().is_err());
        wait_for_drain(&library.background).await;
        assert!(!library
            .catalog()
            .await
            .unwrap()
            .items
            .iter()
            .any(|item| item.id == id));
        assert!(!library
            .root
            .join("source-index")
            .join(format!("{}.json", source.id))
            .exists());
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn cold_small_source_completes_while_other_source_probes_are_blocked() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let (large, _) = seed_legacy_source(&library, &base.join("FFFF"), 512).await;
        let (small, expected) = seed_legacy_source(&library, &base.join("FF"), 46).await;
        let gate = Arc::new(Semaphore::new(0));
        library.scan_entry_gate = Some((large.path.clone(), gate.clone()));
        library.original_read_delay = Some(std::time::Duration::from_millis(20));
        library
            .prioritize_source_tracked(&large.id, library.background.enter().unwrap())
            .await
            .unwrap();
        tokio::time::timeout(std::time::Duration::from_secs(3), async {
            loop {
                let count = library
                    .scan_entries
                    .lock()
                    .unwrap()
                    .iter()
                    .filter(|path| *path != &large.path && path.starts_with(&large.path))
                    .count();
                if count == SOURCE_PROBE_CONCURRENCY {
                    break;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("large source must reach its bounded in-flight probe window");
        let started = std::time::Instant::now();
        library
            .prioritize_source_tracked(&small.id, library.background.enter().unwrap())
            .await
            .unwrap();
        let catalog = tokio::time::timeout(std::time::Duration::from_secs(3), async {
            loop {
                let catalog = library.catalog().await.unwrap();
                if catalog
                    .source_scans
                    .iter()
                    .any(|state| state.source_id == small.id && state.state == "complete")
                {
                    break catalog;
                }
                tokio::time::sleep(std::time::Duration::from_millis(5)).await;
            }
        })
        .await
        .expect("46-file folder must not wait for unrelated blocked original probes");
        assert!(catalog.scanning, "global scan remains incomplete");
        let selected: HashSet<_> = catalog
            .items
            .iter()
            .filter(|item| item.source_id == small.id)
            .map(|item| item.id.clone())
            .collect();
        assert_eq!(
            selected, expected,
            "all legacy UUIDs must survive the cold bootstrap"
        );
        eprintln!(
            "46-item selected source with delayed filesystem completed in {:?}",
            started.elapsed()
        );
        {
            let checks = library.scan_entries.lock().unwrap();
            assert_eq!(
                checks
                    .iter()
                    .filter(|path| *path != &small.path && path.starts_with(&small.path))
                    .count(),
                46,
                "each selected file is inspected once during traversal"
            );
            assert_eq!(
                checks
                    .iter()
                    .filter(|path| *path != &large.path && path.starts_with(&large.path))
                    .count(),
                SOURCE_PROBE_CONCURRENCY
            );
        }
        library.background.set_standby(true);
        assert!(
            library.background.status().pending > 0,
            "blocked operations remain accounted for"
        );
        gate.add_permits(SOURCE_PROBE_CONCURRENCY);
        wait_for_drain(&library.background).await;
        assert_eq!(
            library
                .scan_entries
                .lock()
                .unwrap()
                .iter()
                .filter(|path| *path != &large.path && path.starts_with(&large.path))
                .count(),
            SOURCE_PROBE_CONCURRENCY,
            "cancellation must not admit more original probes"
        );
        assert!(
            library.original_checks.lock().unwrap().len() <= EARLY_SOURCE_CANDIDATES,
            "folder scan must not canonicalize every original file"
        );
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn cached_source_checks_report_progress_only_after_completed_io() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let (source, expected) = seed_legacy_source(&library, &base.join("Movies"), 24).await;
        let work = library.background.enter().unwrap();
        let records = library.source_metadata(&source, true, &work).await.unwrap();
        {
            let mut scan = library.scan.lock().await;
            scan.cached = true;
            scan.records.extend(
                records
                    .into_iter()
                    .map(|record| (record.id.clone(), (record, true))),
            );
        }
        drop(work);
        let gate = Arc::new(Semaphore::new(0));
        library.scan_entry_gate = Some((source.path.clone(), gate.clone()));
        library
            .prioritize_source_tracked(&source.id, library.background.enter().unwrap())
            .await
            .unwrap();
        tokio::time::timeout(std::time::Duration::from_secs(3), async {
            while library.scan_entries.lock().unwrap().len() < SOURCE_PROBE_CONCURRENCY + 1 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        let before = library.catalog().await.unwrap().scanned;
        gate.add_permits(SOURCE_PROBE_CONCURRENCY);
        tokio::time::timeout(std::time::Duration::from_secs(3), async {
            while library.scan_entries.lock().unwrap().len() < 2 * SOURCE_PROBE_CONCURRENCY + 1 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        let snapshot = library.catalog().await.unwrap();
        assert!(
            snapshot.scanned > before,
            "completed file checks must advance progress"
        );
        assert_eq!(
            snapshot
                .items
                .iter()
                .map(|item| item.id.clone())
                .collect::<HashSet<_>>(),
            expected
        );
        assert!(snapshot.scanning);
        assert!(!library
            .root
            .join("source-index")
            .join(format!("{}.json", source.id))
            .exists());
        tokio::time::sleep(std::time::Duration::from_millis(40)).await;
        assert_eq!(
            library.catalog().await.unwrap().scanned,
            snapshot.scanned,
            "blocked I/O must not emit synthetic progress"
        );
        library.background.set_standby(true);
        gate.add_permits(SOURCE_PROBE_CONCURRENCY);
        wait_for_drain(&library.background).await;
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn disconnect_drains_only_admitted_source_probes() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let (source, _) = seed_legacy_source(&library, &base.join("Movies"), 128).await;
        let gate = Arc::new(Semaphore::new(0));
        library.scan_entry_gate = Some((source.path.clone(), gate.clone()));
        library
            .prioritize_source_tracked(&source.id, library.background.enter().unwrap())
            .await
            .unwrap();
        tokio::time::timeout(std::time::Duration::from_secs(3), async {
            while library.scan_entries.lock().unwrap().len() < SOURCE_PROBE_CONCURRENCY + 1 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        let remover = library.clone();
        let id = source.id.clone();
        let removal = tokio::spawn(async move { remover.disconnect_source(&id).await });
        tokio::time::timeout(std::time::Duration::from_secs(3), async {
            while !library.scan.lock().await.revoked_ids.contains(&source.id) {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        gate.add_permits(SOURCE_PROBE_CONCURRENCY);
        removal.await.unwrap().unwrap();
        wait_for_drain(&library.background).await;
        assert_eq!(
            library.scan_entries.lock().unwrap().len(),
            SOURCE_PROBE_CONCURRENCY + 1
        );
        let catalog = library.catalog().await.unwrap();
        assert!(catalog.items.is_empty());
        assert!(catalog.sources.is_empty());
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn deferred_source_admission_error_cannot_report_complete_empty_catalog() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let (source, _) = seed_legacy_source(&library, &base.join("Movies"), 1).await;
        let work = library.background.enter().unwrap();
        library.prepare_scan_epoch(&work).await.unwrap();
        fs::remove_dir_all(library.root.join("sources"))
            .await
            .unwrap();
        fs::write(library.root.join("sources"), b"not a directory")
            .await
            .unwrap();
        library.refresh_known_sources(&work, &[source], None).await;
        assert!(library.scan.lock().await.error.is_some());
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn legacy_source_bootstrap_never_validates_unrelated_originals() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let movies = base.join("Movies");
        fs::create_dir_all(&movies).await.unwrap();
        for n in 0..5 {
            fs::write(movies.join(format!("movie-{n}.mp4")), b"video")
                .await
                .unwrap();
        }
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let work = library.background.enter().unwrap();
        let sources = library.source_records().await.unwrap();
        let source = library
            .register_source(&movies, true, &sources, &work, None)
            .await
            .unwrap();
        fs::remove_file(
            library
                .root
                .join("source-index")
                .join(format!("{}.json", source.id)),
        )
        .await
        .unwrap();
        for n in 0..100 {
            let id = format!("{n:032x}");
            let record = Record {
                id: id.clone(),
                name: "unrelated".into(),
                size: 1,
                mime: "video/mp4".into(),
                extension: "mp4".into(),
                source_id: Some("f".repeat(32)),
                linked_path: Some(base.join("not-mounted").join(format!("{n}.mp4"))),
            };
            fs::write(
                library.root.join(format!("{id}.json")),
                serde_json::to_vec(&record).unwrap(),
            )
            .await
            .unwrap();
        }
        library
            .scan_source(source.clone(), &work, None)
            .await
            .unwrap();
        assert!(library
            .original_checks
            .lock()
            .unwrap()
            .iter()
            .all(|path| path.starts_with(&movies)));
        assert_eq!(library.scan.lock().await.records.len(), 5);
        assert_eq!(
            library.scan.lock().await.source_scans[&source.id].state,
            "complete"
        );
        drop(work);
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn scan_limit_never_marks_partial_source_complete() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let movies = base.join("Movies");
        fs::create_dir_all(&movies).await.unwrap();
        for n in 0..8 {
            fs::write(movies.join(format!("movie-{n}.mp4")), b"video")
                .await
                .unwrap();
        }
        let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        library.scan_entry_limit = 4;
        let source = library
            .start_link_folder_path_tracked(movies, library.background.enter().unwrap())
            .await
            .unwrap();
        wait_for_drain(&library.background).await;
        let catalog = library.catalog().await.unwrap();
        let state = catalog
            .source_scans
            .iter()
            .find(|state| state.source_id == source.id)
            .unwrap();
        assert_eq!(state.state, "error");
        assert_eq!(state.error.as_deref(), Some(NATIVE_SCAN_LIMIT));
        assert!(catalog.items.len() < 8);
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn disconnect_and_reconnect_cannot_resurrect_queued_source_generation() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let movies = base.join("Movies");
        fs::create_dir_all(&movies).await.unwrap();
        fs::write(movies.join("movie.mp4"), b"video").await.unwrap();
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let work = library.background.enter().unwrap();
        let sources = library.source_records().await.unwrap();
        let old = library
            .register_source(&movies, true, &sources, &work, None)
            .await
            .unwrap();
        drop(work);
        let old_worker = library.source_worker(&old.id).await;
        let held = old_worker.lock().await;
        library
            .prioritize_source_tracked(&old.id, library.background.enter().unwrap())
            .await
            .unwrap();
        let owner = library.clone();
        let old_id = old.id.clone();
        let disconnect = tokio::spawn(async move { owner.disconnect_source(&old_id).await });
        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            while !library.source_records().await.unwrap().is_empty() {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        let new = library
            .start_link_folder_path_tracked(movies, library.background.enter().unwrap())
            .await
            .unwrap();
        assert_ne!(new.id, old.id);
        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            loop {
                if library
                    .scan
                    .lock()
                    .await
                    .source_scans
                    .get(&new.id)
                    .is_some_and(|s| s.state == "complete")
                {
                    break;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        drop(held);
        disconnect.await.unwrap().unwrap();
        wait_for_drain(&library.background).await;
        let catalog = library.catalog().await.unwrap();
        assert_eq!(catalog.items.len(), 1);
        assert_eq!(catalog.items[0].source_id, new.id);
        assert!(catalog.source_scans.iter().all(|s| s.source_id != old.id));
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_request_interrupts_pending_precommit_wait() {
        for cancel in [true, false] {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;
            let request = NativeRequest::new(now + if cancel { 60_000 } else { 100 });
            let token = request.clone();
            let (started, entered) = tokio::sync::oneshot::channel();
            let pending = tokio::spawn(async move {
                token
                    .run(async move {
                        started.send(()).unwrap();
                        std::future::pending::<()>().await;
                    })
                    .await
            });
            bounded(entered).await.unwrap();
            if cancel {
                request.cancel();
            }
            let mut pending = pending;
            let outcome =
                tokio::time::timeout(std::time::Duration::from_secs(1), &mut pending).await;
            pending.abort();
            assert!(
                outcome.is_ok(),
                "request did not interrupt a pending pre-commit wait (cancel={cancel})"
            );
            assert!(outcome.unwrap().unwrap().is_err());
            assert_ne!(request.state.load(Ordering::SeqCst), 2);
        }
    }

    #[tokio::test]
    async fn native_request_cancellation_retains_probe_until_current_io_drains() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        let background = crate::background_work::BackgroundWork::default();
        let work = background.enter().unwrap();
        let request = NativeRequest::new(u64::MAX);
        let token = request.clone();
        let probes = Arc::new(Semaphore::new(1));
        let permits = probes.clone();
        let next_operations = Arc::new(AtomicUsize::new(0));
        let observed = next_operations.clone();
        let (started, entered) = tokio::sync::oneshot::channel();
        let (finish, current_io) = tokio::sync::oneshot::channel();
        let pending = tokio::spawn(async move {
            token
                .run(owned_read(&work, move |owner| async move {
                    let _permit = owner.run(permits.acquire()).await?.map_err(storage_error)?;
                    checked(Some(&owner), async move {
                        started.send(()).unwrap();
                        current_io.await.unwrap();
                    })
                    .await?;
                    observed.fetch_add(1, Ordering::SeqCst);
                    Ok(())
                }))
                .await
        });
        bounded(entered).await.unwrap();
        request.cancel();
        assert!(bounded(pending).await.unwrap().is_err());
        assert_eq!(
            probes.available_permits(),
            0,
            "in-flight filesystem work still owns its permit"
        );
        assert_eq!(background.status().pending, 1);
        assert!(!background.status().standby);
        finish.send(()).unwrap();
        wait_for_drain(&background).await;
        assert_eq!(probes.available_permits(), 1);
        assert_eq!(next_operations.load(Ordering::SeqCst), 0);
        assert!(request.commit().is_err());
    }

    async fn registration_fixture(
        step: RegistrationStep,
    ) -> (PathBuf, Library, PathBuf, Arc<Semaphore>, Arc<Semaphore>) {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let folder = base.join("Movies");
        fs::create_dir_all(&folder).await.unwrap();
        let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let entered = Arc::new(Semaphore::new(0));
        let release = Arc::new(Semaphore::new(0));
        library.native_registration_gate = Some((step, entered.clone(), release.clone()));
        (base, library, folder, entered, release)
    }

    async fn assert_registration_empty(library: &Library) {
        for name in ["sources", "source-index"] {
            let mut entries = fs::read_dir(library.root.join(name)).await.unwrap();
            assert!(
                entries.next_entry().await.unwrap().is_none(),
                "left files in {name}"
            );
        }
    }

    #[tokio::test]
    async fn native_registration_cancel_and_drop_retain_lock_until_cleanup() {
        for step in [RegistrationStep::Index, RegistrationStep::Part] {
            for abort in [false, true] {
                let (base, library, folder, entered, release) = registration_fixture(step).await;
                let request = NativeRequest::new(u64::MAX);
                let token = request.clone();
                let worker = library.clone();
                let pending = tokio::spawn(async move {
                    let work = worker.background.enter().unwrap();
                    worker.start_link_folder_request(folder, work, token).await
                });
                bounded(entered.acquire()).await.unwrap().forget();
                if abort {
                    pending.abort();
                    assert!(bounded(pending)
                        .await
                        .err()
                        .expect("invoke should be aborted")
                        .is_cancelled());
                } else {
                    request.cancel();
                    assert!(bounded(pending).await.unwrap().is_err());
                }
                assert_eq!(library.background.status().pending, 1);
                assert!(
                    library.mutation.try_lock().is_err(),
                    "in-flight stage lost its lock"
                );
                release.add_permits(1);
                wait_for_drain(&library.background).await;
                assert!(library.mutation.try_lock().is_ok());
                assert_registration_empty(&library).await;
                assert!(library.scan.lock().await.source_scans.is_empty());
                fs::remove_dir_all(base).await.unwrap();
            }
        }
    }

    #[tokio::test]
    async fn native_registration_deadline_keeps_inflight_stage_owned() {
        let (base, mut library, folder, entered, release) =
            registration_fixture(RegistrationStep::Part).await;
        // The gate establishes admission before the deadline. No tiny timeout
        // races filesystem setup; this exercises the actual registration timer.
        library.native_source_probe_timeout = Some(std::time::Duration::from_secs(2));
        let worker = library.clone();
        let pending = tokio::spawn(async move {
            let work = worker.background.enter().unwrap();
            worker
                .start_link_folder_request(folder, work, NativeRequest::new(u64::MAX))
                .await
        });
        bounded(entered.acquire()).await.unwrap().forget();
        let error = tokio::time::timeout(std::time::Duration::from_secs(5), pending)
            .await
            .expect("registration deadline did not return")
            .unwrap()
            .err()
            .unwrap();
        assert_eq!(error.to_string(), "Local folder registration timed out");
        assert_eq!(library.background.status().pending, 1);
        assert!(library.mutation.try_lock().is_err());
        release.add_permits(1);
        wait_for_drain(&library.background).await;
        assert_registration_empty(&library).await;
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_registration_standby_drains_before_next_actor() {
        let (base, library, folder, entered, release) =
            registration_fixture(RegistrationStep::Part).await;
        let worker = library.clone();
        let pending = tokio::spawn(async move {
            let work = worker.background.enter().unwrap();
            worker
                .start_link_folder_request(folder, work, NativeRequest::new(u64::MAX))
                .await
        });
        bounded(entered.acquire()).await.unwrap().forget();
        library.background.set_standby(true);
        assert!(bounded(pending).await.unwrap().is_err());
        assert!(!library.background.status().quiescent);
        library.background.set_standby(false);
        let mut next = library.clone();
        next.native_registration_gate = None;
        let folder = base.join("Next");
        fs::create_dir_all(&folder).await.unwrap();
        let next = tokio::spawn(async move {
            let work = next.background.enter().unwrap();
            next.start_link_folder_request(folder, work, NativeRequest::new(u64::MAX))
                .await
        });
        assert!(library.mutation.try_lock().is_err());
        release.add_permits(1);
        let source = bounded(next).await.unwrap().unwrap();
        wait_for_drain(&library.background).await;
        let sources = library.source_records().await.unwrap();
        assert_eq!(sources.len(), 1);
        assert_eq!(sources[0].id, source.id);
        for name in ["sources", "source-index"] {
            let mut entries = fs::read_dir(library.root.join(name)).await.unwrap();
            assert_eq!(
                entries.next_entry().await.unwrap().unwrap().file_name(),
                format!("{}.json", source.id).as_str()
            );
            assert!(entries.next_entry().await.unwrap().is_none());
        }
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_registration_commit_failure_removes_only_owned_staging() {
        let (base, mut library, folder, _, _) = registration_fixture(RegistrationStep::Part).await;
        library.native_registration_gate = None;
        library.source_records().await.unwrap();
        let unrelated = library.root.join("sources/another.part");
        fs::write(&unrelated, b"another actor").await.unwrap();
        let work = library.background.enter().unwrap();
        let request = NativeRequest::new(u64::MAX);
        request.commit().unwrap(); // A second commit must fail after staging.
        let owner = ReadWork {
            lease: work.clone(),
            abandoned: request.cancelled.subscribe(),
            deadline: None,
        };
        let _lock = library.mutation.lock().await;
        assert!(library
            .register_source_checked(&folder, true, &[], &work, None, Some((&request, &owner)))
            .await
            .is_err());
        assert_eq!(fs::read(&unrelated).await.unwrap(), b"another actor");
        fs::remove_file(unrelated).await.unwrap();
        assert_registration_empty(&library).await;
        drop(_lock);
        drop(owner);
        drop(work);
        wait_for_drain(&library.background).await;
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_registration_cancelled_rebind_preserves_existing_index() {
        let (base, mut library, folder, entered, release) =
            registration_fixture(RegistrationStep::Part).await;
        library.native_registration_gate = None;
        let source = library
            .start_link_folder_path_tracked(folder.clone(), library.background.enter().unwrap())
            .await
            .unwrap();
        wait_for_drain(&library.background).await;
        let index = library
            .root
            .join("source-index")
            .join(format!("{}.json", source.id));
        let original = library
            .root
            .join("sources")
            .join(format!("{}.json", source.id));
        let record = fs::read(&original).await.unwrap();
        fs::write(&index, b"existing index bytes").await.unwrap();
        library.native_registration_gate =
            Some((RegistrationStep::Part, entered.clone(), release.clone()));
        let worker = library.clone();
        let request = NativeRequest::new(u64::MAX);
        let token = request.clone();
        let pending = tokio::spawn(async move {
            let work = worker.background.enter().unwrap();
            worker.start_link_folder_request(folder, work, token).await
        });
        bounded(entered.acquire()).await.unwrap().forget();
        request.cancel();
        assert!(bounded(pending).await.unwrap().is_err());
        release.add_permits(1);
        wait_for_drain(&library.background).await;
        assert_eq!(fs::read(index).await.unwrap(), b"existing index bytes");
        assert_eq!(fs::read(original).await.unwrap(), record);
        let mut entries = fs::read_dir(library.root.join("sources")).await.unwrap();
        assert!(entries.next_entry().await.unwrap().is_some());
        assert!(entries.next_entry().await.unwrap().is_none());
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_registration_commit_wins_cancel_and_rename_failure_cleans_staging() {
        for fail_rename in [false, true] {
            let (base, library, folder, entered, release) =
                registration_fixture(RegistrationStep::Commit).await;
            let request = NativeRequest::new(u64::MAX);
            let token = request.clone();
            let worker = library.clone();
            let pending = tokio::spawn(async move {
                let work = worker.background.enter().unwrap();
                worker.start_link_folder_request(folder, work, token).await
            });
            bounded(entered.acquire()).await.unwrap().forget();
            assert_eq!(request.state.load(Ordering::SeqCst), 2);
            request.cancel();
            assert_eq!(request.state.load(Ordering::SeqCst), 2);
            let mut entries = fs::read_dir(library.root.join("source-index"))
                .await
                .unwrap();
            let name = entries.next_entry().await.unwrap().unwrap().file_name();
            let destination = library.root.join("sources").join(&name);
            if fail_rename {
                fs::create_dir(&destination).await.unwrap();
                fs::write(destination.join("preserve"), b"foreign destination")
                    .await
                    .unwrap();
            }
            release.add_permits(1);
            let result = bounded(pending).await.unwrap();
            assert_eq!(result.is_err(), fail_rename);
            wait_for_drain(&library.background).await;
            if fail_rename {
                assert_eq!(
                    fs::read(destination.join("preserve")).await.unwrap(),
                    b"foreign destination"
                );
                fs::remove_dir_all(destination).await.unwrap();
                assert_registration_empty(&library).await;
            } else {
                assert_eq!(library.source_records().await.unwrap().len(), 1);
            }
            fs::remove_dir_all(base).await.unwrap();
        }
    }

    async fn native_lookup_fixture(library: &Library, name: &str, folder: bool) -> SourceRecord {
        let path = library.root.parent().unwrap().join(name);
        fs::create_dir_all(path.parent().unwrap()).await.unwrap();
        if folder {
            fs::create_dir_all(&path).await.unwrap();
        } else {
            fs::write(&path, b"video").await.unwrap();
        }
        let source = SourceRecord {
            id: uuid::Uuid::new_v4().simple().to_string(),
            name: path.file_name().unwrap().to_string_lossy().into_owned(),
            kind: if folder { "folder" } else { "file" }.into(),
            path: fs::canonicalize(path).await.unwrap(),
        };
        let metadata = library.root.join("sources");
        fs::create_dir_all(&metadata).await.unwrap();
        fs::write(
            metadata.join(format!("{}.json", source.id)),
            serde_json::to_vec(&source).unwrap(),
        )
        .await
        .unwrap();
        source
    }

    #[tokio::test]
    async fn native_source_lookup_expired_admission_is_not_unavailable() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let source = native_lookup_fixture(&library, "Movies", true).await;
        let work = library.background.enter().unwrap();
        let error = library
            .native_folder_probe_until(source.path, &work, tokio::time::Instant::now())
            .await
            .unwrap_err();
        assert!(error
            .downcast_ref::<NativeProbeDeadline>()
            .is_some_and(|deadline| !deadline.admitted));
        assert!(!error.is::<NativeSourceUnavailable>());
        assert_eq!(
            library.source_probes.available_permits(),
            LIBRARY_PROBE_CONCURRENCY
        );
        drop(work);
        wait_for_drain(&library.background).await;
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_source_lookup_waiting_permit_is_not_unavailable() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        for folder in [true, false] {
            let source = native_lookup_fixture(
                &library,
                if folder { "Movies" } else { "movie.mp4" },
                folder,
            )
            .await;
            // Read actual metadata before starting the probe-only deadline.
            let sources = library
                .source_records()
                .await
                .unwrap()
                .into_iter()
                .filter(|record| record.id == source.id)
                .collect();
            let held = library
                .source_probes
                .acquire_many(LIBRARY_PROBE_CONCURRENCY as u32)
                .await
                .unwrap();
            let work = library.background.enter().unwrap();
            let error = bounded(library.native_source_availability(
                false,
                sources,
                &work,
                tokio::time::Instant::now() + std::time::Duration::from_millis(20),
            ))
            .await
            .err()
            .expect("lack of a probe permit must not produce an unavailable source row");
            assert!(
                error
                    .downcast_ref::<NativeProbeDeadline>()
                    .is_some_and(|deadline| !deadline.admitted),
                "expected an unadmitted probe deadline, got {error:?}"
            );
            assert!(!error.is::<NativeSourceUnavailable>());
            drop(work);
            wait_for_drain(&library.background).await;
            assert_eq!(library.source_probes.available_permits(), 0);
            drop(held);
            let sources = library
                .native_sources_selected(false, None, Some(&source.id))
                .await
                .unwrap();
            assert_eq!(sources.len(), 1);
            assert!(sources[0].available);
        }
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_source_lookup_metadata_admission_is_bounded() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        native_lookup_fixture(&library, "Movies", true).await;
        let held = library.metadata_reads.acquire_many(2).await.unwrap();
        for timeout in [
            std::time::Duration::from_millis(20),
            std::time::Duration::ZERO,
        ] {
            library.native_source_probe_timeout = Some(timeout);
            let error = bounded(library.native_sources(false, None))
                .await
                .err()
                .expect("metadata capacity or an expired deadline must fail before I/O");
            assert!(error
                .downcast_ref::<NativeProbeDeadline>()
                .is_some_and(|deadline| !deadline.admitted));
            assert_eq!(library.background.status().pending, 0);
            assert_eq!(library.metadata_reads.available_permits(), 0);
            assert_eq!(
                library.source_probes.available_permits(),
                LIBRARY_PROBE_CONCURRENCY
            );
        }
        drop(held);
        assert_eq!(library.metadata_reads.available_permits(), 2);
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_source_lookup_metadata_timeout_retains_owner() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let source = native_lookup_fixture(&library, "Movies", true).await;
        let gate = Arc::new(Semaphore::new(0));
        library.native_source_records_gate = Some(gate.clone());
        library.native_source_probe_timeout = Some(std::time::Duration::from_millis(20));
        let error = bounded(library.native_sources_selected(false, None, Some(&source.id)))
            .await
            .err()
            .expect("metadata deadline must fail the lookup");
        assert!(error.is::<NativeProbeDeadline>());
        assert!(!error.is::<NativeSourceUnavailable>());
        assert_eq!(
            library.source_probes.available_permits(),
            LIBRARY_PROBE_CONCURRENCY
        );
        assert_eq!(
            library.background.status().pending,
            1,
            "the admitted metadata operation must drain"
        );
        assert_eq!(library.metadata_reads.available_permits(), 1);
        gate.add_permits(1);
        wait_for_drain(&library.background).await;
        assert_eq!(library.metadata_reads.available_permits(), 2);
        assert!(library.scan.lock().await.source_scans.is_empty());
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_source_lookup_saturated_bulk_is_inconclusive() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        for index in 0..=LIBRARY_PROBE_CONCURRENCY {
            native_lookup_fixture(&library, &format!("Movies{index}"), true).await;
        }
        // Metadata I/O is covered separately; the short deadline below must
        // measure admission to the saturated probe pool, not JSON reads.
        let sources = library.source_records().await.unwrap();
        assert_eq!(sources.len(), LIBRARY_PROBE_CONCURRENCY + 1);
        let gate = Arc::new(Semaphore::new(0));
        let mut stalled = Vec::new();
        for _ in 0..LIBRARY_PROBE_CONCURRENCY {
            let library = library.clone();
            let gate = gate.clone();
            stalled.push(tokio::spawn(async move {
                let work = library.background.enter().unwrap();
                Library::native_read(
                    library.source_probes.clone(),
                    &work,
                    None,
                    move |owner| async move {
                        let _operation = checked(Some(&owner), gate.acquire())
                            .await?
                            .map_err(storage_error)?;
                        Ok(())
                    },
                )
                .await
            }));
        }
        bounded(async {
            while library.source_probes.available_permits() != 0 {
                tokio::task::yield_now().await;
            }
        })
        .await;
        let work = library.background.enter().unwrap();
        let error = bounded(library.native_source_availability(
            false,
            sources,
            &work,
            tokio::time::Instant::now() + std::time::Duration::from_millis(20),
        ))
        .await
        .err()
        .expect("nine healthy sources behind occupied permits are inconclusive, not unavailable");
        assert!(
            error
                .downcast_ref::<NativeProbeDeadline>()
                .is_some_and(|deadline| !deadline.admitted),
            "expected an unadmitted bulk probe deadline, got {error:?}"
        );
        drop(work);
        assert_eq!(library.source_probes.available_permits(), 0);
        assert_eq!(
            library.background.status().pending,
            LIBRARY_PROBE_CONCURRENCY
        );
        gate.add_permits(LIBRARY_PROBE_CONCURRENCY);
        for task in stalled {
            bounded(task).await.unwrap().unwrap();
        }
        wait_for_drain(&library.background).await;
        assert_eq!(
            library.source_probes.available_permits(),
            LIBRARY_PROBE_CONCURRENCY
        );
        let sources = library.native_sources(false, None).await.unwrap();
        assert_eq!(sources.len(), LIBRARY_PROBE_CONCURRENCY + 1);
        assert!(sources.iter().all(|source| source.available));
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_source_background_probe_ignores_lookup_deadline() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let source = native_lookup_fixture(&library, "Movies", true).await;
        let gate = Arc::new(Semaphore::new(0));
        library.native_source_probe_gate = Some((source.path.clone(), gate.clone()));
        library.native_source_probe_timeout = Some(std::time::Duration::from_millis(20));
        let owner = library.clone();
        let id = source.id.clone();
        let mut pending = tokio::spawn(async move {
            let work = owner.background.enter().unwrap();
            owner.scan_source(source, &work, None).await
        });
        bounded(async {
            while library.source_probes.available_permits() == LIBRARY_PROBE_CONCURRENCY {
                tokio::task::yield_now().await;
            }
        })
        .await;
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(60), &mut pending)
                .await
                .is_err()
        );
        {
            let scan = library.scan.lock().await;
            let state = &scan.source_scans[&id];
            assert_eq!(state.state, "scanning");
            assert_eq!(state.available, None);
            assert_eq!(state.error, None);
        }
        gate.add_permits(1);
        bounded(pending).await.unwrap().unwrap();
        wait_for_drain(&library.background).await;
        let scan = library.scan.lock().await;
        assert_eq!(scan.source_scans[&id].state, "complete");
        assert_eq!(scan.source_scans[&id].available, Some(true));
        drop(scan);
        fs::remove_dir_all(base).await.unwrap();
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn native_source_file_probe_rejects_changed_ancestor_identity() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let source = native_lookup_fixture(&library, "Files/movie.mp4", false).await;
        let original = source.path.parent().unwrap();
        let moved = base.join("Moved");
        let replacement = base.join("Replacement");
        fs::create_dir(&replacement).await.unwrap();
        fs::write(replacement.join("movie.mp4"), b"other")
            .await
            .unwrap();
        fs::rename(original, &moved).await.unwrap();
        std::os::unix::fs::symlink(&replacement, original).unwrap();
        let sources = library
            .native_sources_selected(false, None, Some(&source.id))
            .await
            .unwrap();
        assert_eq!(sources.len(), 1);
        assert!(!sources[0].available);
        fs::remove_file(original).await.unwrap();
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_request_folder_probes_share_deadline_and_release_waiters() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let held = library
            .source_probes
            .acquire_many(LIBRARY_PROBE_CONCURRENCY as u32)
            .await
            .unwrap();
        let work = library.background.enter().unwrap();
        let deadline = tokio::time::Instant::now() + std::time::Duration::from_millis(20);
        let error = bounded(library.native_folder_path_until(base.clone(), &work, deadline))
            .await
            .unwrap_err();
        assert_eq!(error.to_string(), "Local folder read timed out");
        // Reusing the lookup deadline must not give every remaining source its
        // own timeout, or enqueue more filesystem reads after it has expired.
        for _ in 0..32 {
            assert!(
                bounded(library.native_folder_path_until(base.clone(), &work, deadline))
                    .await
                    .is_err()
            );
        }
        drop(work);
        wait_for_drain(&library.background).await;
        assert_eq!(library.source_probes.available_permits(), 0);
        drop(held);
        assert_eq!(
            library.source_probes.available_permits(),
            LIBRARY_PROBE_CONCURRENCY
        );
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_request_bulk_lookup_keeps_healthy_source_after_stalled_source() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let work = library.background.enter().unwrap();
        library.source_records().await.unwrap();
        for name in ["First", "Second"] {
            let path = base.join(name);
            fs::create_dir_all(&path).await.unwrap();
            library
                .register_source(&path, true, &[], &work, None)
                .await
                .unwrap();
        }
        let mut ordered = library.source_records().await.unwrap();
        ordered.sort_by(|a, b| a.id.cmp(&b.id));
        let slow = ordered[0].clone();
        let healthy = ordered[1].clone();
        drop(work);
        let gate = Arc::new(Semaphore::new(0));
        library.native_source_probe_gate = Some((slow.path, gate.clone()));
        library.native_source_probe_timeout = Some(std::time::Duration::from_millis(500));
        let sources = bounded(library.native_sources(false, None)).await.unwrap();
        assert!(
            !sources
                .iter()
                .find(|source| source.id == slow.id)
                .unwrap()
                .available
        );
        assert!(sources.iter().find(|source| source.id == healthy.id).unwrap().available,
            "a stalled first source must not exhaust the deadline before the next healthy source is checked");
        assert_eq!(library.background.status().pending, 1);
        assert_eq!(
            library.source_probes.available_permits(),
            LIBRARY_PROBE_CONCURRENCY - 1
        );
        gate.add_permits(1);
        wait_for_drain(&library.background).await;
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_request_bulk_lookup_bounds_file_probe_and_preserves_healthy_folder() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        library.source_records().await.unwrap();
        let mut slow = SourceRecord {
            id: "a".repeat(32),
            name: "Slow file".into(),
            kind: "file".into(),
            path: base.join("movie.mp4"),
        };
        let mut healthy = SourceRecord {
            id: "b".repeat(32),
            name: "Healthy folder".into(),
            kind: "folder".into(),
            path: base.join("Movies"),
        };
        fs::write(&slow.path, b"video").await.unwrap();
        fs::create_dir_all(&healthy.path).await.unwrap();
        slow.path = fs::canonicalize(&slow.path).await.unwrap();
        healthy.path = fs::canonicalize(&healthy.path).await.unwrap();
        for source in [&slow, &healthy] {
            fs::write(
                library
                    .root
                    .join("sources")
                    .join(format!("{}.json", source.id)),
                serde_json::to_vec(source).unwrap(),
            )
            .await
            .unwrap();
        }
        let gate = Arc::new(Semaphore::new(0));
        library.native_source_probe_gate = Some((slow.path.clone(), gate.clone()));
        library.native_source_probe_timeout = Some(std::time::Duration::from_millis(500));
        let sources = bounded(library.native_sources(false, None)).await.unwrap();
        assert!(
            !sources
                .iter()
                .find(|source| source.id == slow.id)
                .unwrap()
                .available
        );
        assert!(
            sources
                .iter()
                .find(|source| source.id == healthy.id)
                .unwrap()
                .available
        );
        assert_eq!(library.background.status().pending, 1);
        assert_eq!(
            library.source_probes.available_permits(),
            LIBRARY_PROBE_CONCURRENCY - 1
        );
        gate.add_permits(1);
        wait_for_drain(&library.background).await;
        library.native_source_probe_gate = None;
        let sources = bounded(library.native_sources(false, None)).await.unwrap();
        assert!(sources.iter().all(|source| source.available));
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn registration_deadline_and_cancellation_do_not_publish_late_bindings() {
        for cancel in [false, true] {
            let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
            let movies = base.join("Movies");
            fs::create_dir_all(&movies).await.unwrap();
            let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
                .await
                .unwrap();
            let held = library.mutation.lock().await;
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;
            let request = NativeRequest::new(if cancel { now + 60_000 } else { now + 20 });
            let owner = library.clone();
            let token = request.clone();
            let pending = tokio::spawn(async move {
                owner
                    .start_link_folder_request(movies, owner.background.enter().unwrap(), token)
                    .await
            });
            tokio::time::sleep(std::time::Duration::from_millis(40)).await;
            if cancel {
                request.cancel();
            }
            assert!(bounded(pending).await.unwrap().is_err());
            drop(held);
            assert!(library
                .native_sources(false, None)
                .await
                .unwrap()
                .is_empty());
            fs::remove_dir_all(base).await.unwrap();
        }
        let request = NativeRequest::new(u64::MAX);
        request.commit().unwrap();
        request.cancel();
        assert_eq!(
            request.state.load(Ordering::SeqCst),
            2,
            "cancellation cannot undo committed registration"
        );
    }

    #[tokio::test]
    async fn missing_or_malformed_index_preserves_legacy_uuid() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let movies = base.join("Movies");
        fs::create_dir_all(&movies).await.unwrap();
        fs::write(movies.join("movie.mp4"), b"video").await.unwrap();
        let root = base.join("metadata");
        let library = Library::new(root.clone(), "t".repeat(32), "device")
            .await
            .unwrap();
        let source = library
            .start_link_folder_path_tracked(movies, library.background.enter().unwrap())
            .await
            .unwrap();
        wait_for_drain(&library.background).await;
        let item = library.catalog().await.unwrap().items.remove(0);
        let mut record = library.record(&item.id).await.unwrap();
        let legacy_id = uuid::Uuid::new_v4().simple().to_string();
        record.id = legacy_id.clone();
        fs::remove_file(root.join(format!("{}.json", item.id)))
            .await
            .unwrap();
        fs::write(
            root.join(format!("{legacy_id}.json")),
            serde_json::to_vec(&record).unwrap(),
        )
        .await
        .unwrap();
        for bytes in [None, Some(b"broken".as_slice())] {
            let index = root
                .join("source-index")
                .join(format!("{}.json", source.id));
            if let Some(bytes) = bytes {
                fs::write(&index, bytes).await.unwrap();
            } else {
                fs::remove_file(&index).await.unwrap();
            }
            let reopened = Library::new(root.clone(), "t".repeat(32), "device")
                .await
                .unwrap();
            reopened
                .prioritize_source_tracked(&source.id, reopened.background.enter().unwrap())
                .await
                .unwrap();
            wait_for_drain(&reopened.background).await;
            let catalog = reopened.catalog().await.unwrap();
            assert_eq!(catalog.items.len(), 1);
            assert_eq!(catalog.items[0].id, legacy_id);
        }
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn interrupted_or_missing_source_index_recovers_stable_record_ids() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let movies = base.join("Movies");
        fs::create_dir_all(&movies).await.unwrap();
        for n in 0..2 {
            fs::write(movies.join(format!("movie-{n}.mp4")), b"video")
                .await
                .unwrap();
        }
        let root = base.join("metadata");
        let library = Library::new(root.clone(), "t".repeat(32), "device")
            .await
            .unwrap();
        let source = library
            .start_link_folder_path_tracked(movies, library.background.enter().unwrap())
            .await
            .unwrap();
        wait_for_drain(&library.background).await;
        let mut ids: Vec<_> = library
            .catalog()
            .await
            .unwrap()
            .items
            .into_iter()
            .map(|i| i.id)
            .collect();
        ids.sort();
        for bytes in [Some(b"[]".as_slice()), None, Some(b"broken".as_slice())] {
            let index = root
                .join("source-index")
                .join(format!("{}.json", source.id));
            if let Some(bytes) = bytes {
                fs::write(&index, bytes).await.unwrap();
            } else {
                fs::remove_file(&index).await.unwrap();
            }
            let reopened = Library::new(root.clone(), "t".repeat(32), "device")
                .await
                .unwrap();
            reopened
                .prioritize_source_tracked(&source.id, reopened.background.enter().unwrap())
                .await
                .unwrap();
            wait_for_drain(&reopened.background).await;
            let mut found: Vec<_> = reopened
                .catalog()
                .await
                .unwrap()
                .items
                .into_iter()
                .map(|i| i.id)
                .collect();
            found.sort();
            assert_eq!(found, ids);
        }
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn local_connection_preserves_valid_catalog_while_link_job_waits() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let first = base.join("First");
        let second = base.join("Second");
        fs::create_dir_all(&first).await.unwrap();
        fs::create_dir_all(&second).await.unwrap();
        fs::write(first.join("First.mp4"), b"first").await.unwrap();
        fs::write(second.join("Second.mp4"), b"second")
            .await
            .unwrap();
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        library.start_link_paths(vec![first], true).await.unwrap();
        wait_for_drain(&library.background).await;
        let original = library.catalog().await.unwrap();
        assert_eq!(original.items.len(), 1);
        let original_id = original.items[0].id.clone();
        let guard = library.mutation.lock().await;
        library.start_link_paths(vec![second], true).await.unwrap();
        let pending = library.catalog().await.unwrap();
        assert!(pending.scanning);
        assert!(pending
            .items
            .iter()
            .any(|item| item.id == original_id && item.available));
        drop(guard);
        wait_for_drain(&library.background).await;
        let complete = library.catalog().await.unwrap();
        assert!(!complete.scanning);
        assert!(complete.scan_error.is_none());
        assert_eq!(complete.items.len(), 2);
        assert!(complete.items.iter().any(|item| item.id == original_id));
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn local_connection_rebuilds_other_sources_after_restart_or_invalidation() {
        for restarted in [true, false] {
            let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
            let first = base.join("First");
            let second = base.join("Second");
            let removed = base.join("Removed");
            let metadata = base.join("metadata");
            for directory in [&first, &second, &removed] {
                fs::create_dir_all(directory).await.unwrap();
            }
            fs::write(first.join("First.mp4"), b"first").await.unwrap();
            fs::write(second.join("Second.mp4"), b"second")
                .await
                .unwrap();
            fs::write(removed.join("Removed.mp4"), b"removed")
                .await
                .unwrap();
            let library = Library::new(metadata.clone(), "t".repeat(32), "device")
                .await
                .unwrap();
            library
                .start_link_paths(vec![first.clone(), removed], true)
                .await
                .unwrap();
            wait_for_drain(&library.background).await;
            let original = library.catalog().await.unwrap();
            let original_id = original
                .items
                .iter()
                .find(|item| item.name == "First.mp4")
                .unwrap()
                .id
                .clone();
            let removed_id = original
                .sources
                .iter()
                .find(|source| source.name == "Removed")
                .unwrap()
                .id
                .clone();
            library.disconnect_source(&removed_id).await.unwrap();
            let library = if restarted {
                Library::new(metadata, "t".repeat(32), "device")
                    .await
                    .unwrap()
            } else {
                library
            };
            fs::write(first.join("Added.mp4"), b"added").await.unwrap();
            library
                .start_link_folder_path_tracked(second, library.background.enter().unwrap())
                .await
                .unwrap();
            wait_for_drain(&library.background).await;
            let complete = library.catalog().await.unwrap();
            assert!(!complete.scanning);
            assert!(complete.scan_error.is_none());
            assert_eq!(complete.items.len(), 3, "restarted={restarted}");
            assert!(complete.items.iter().any(|item| item.id == original_id));
            assert!(complete.items.iter().any(|item| item.name == "Added.mp4"));
            assert!(!complete
                .sources
                .iter()
                .any(|source| source.id == removed_id));
            assert!(!complete.items.iter().any(|item| item.name == "Removed.mp4"));
            library
                .ensure_catalog_tracked(None, library.background.enter().unwrap())
                .await;
            assert_eq!(library.scan.lock().await.jobs, 0);
            assert_eq!(library.catalog().await.unwrap().items.len(), 3);
            fs::remove_dir_all(base).await.unwrap();
        }
    }

    #[test]
    fn native_scan_entry_budget_is_separate_from_playable_item_count() {
        let mut count = 0;
        for _ in 0..MAX_NATIVE_SCAN_ENTRIES {
            count_native_scan_entry(&mut count).unwrap();
        }
        assert_eq!(count, 100_000);
        assert_eq!(
            count_native_scan_entry(&mut count).unwrap_err().to_string(),
            NATIVE_SCAN_LIMIT
        );
        assert_eq!(count, MAX_NATIVE_SCAN_ENTRIES);
    }

    #[tokio::test]
    async fn native_scan_accepts_more_than_twenty_thousand_directory_entries() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = base.join("Movies");
        fs::create_dir_all(&originals).await.unwrap();
        let prepared = originals.clone();
        tokio::task::spawn_blocking(move || {
            for index in 0..20_001 {
                std::fs::write(prepared.join(format!("note-{index}.txt")), b"").unwrap();
            }
            std::fs::write(prepared.join("Movie.mp4"), b"video").unwrap();
        })
        .await
        .unwrap();
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        library.link_paths(vec![originals], true).await.unwrap();
        let catalog = library.catalog().await.unwrap();
        assert_eq!(catalog.items.len(), 1);
        assert!(catalog.scan_error.is_none());
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn queued_registered_scan_cannot_recreate_a_disconnected_source() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = base.join("Movies");
        fs::create_dir_all(&originals).await.unwrap();
        fs::write(originals.join("Movie.mp4"), b"video")
            .await
            .unwrap();
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        library.link_paths(vec![originals], true).await.unwrap();
        let source = library.source_records().await.unwrap().remove(0);
        let guard = library.mutation.lock().await;
        let mut disconnect = Box::pin(library.disconnect_source(&source.id));
        assert!(futures_util::poll!(disconnect.as_mut()).is_pending());
        library
            .start_link_paths_owned(
                vec![source.path.clone()],
                true,
                library.background.enter().unwrap(),
                Some(source.clone()),
            )
            .await
            .unwrap();
        drop(guard);
        disconnect.await.unwrap();
        wait_for_drain(&library.background).await;
        assert!(library.source_records().await.unwrap().is_empty());
        assert!(library
            .records(&library.background.enter().unwrap())
            .await
            .unwrap()
            .is_empty());
        assert!(library.catalog().await.unwrap().scan_error.is_some());
        fs::remove_dir_all(base).await.unwrap();
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn native_registration_rechecks_canonical_identity_before_persisting() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = base.join("Movies");
        let other = base.join("Other");
        fs::create_dir_all(&originals).await.unwrap();
        fs::create_dir_all(&other).await.unwrap();
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let work = library.background.enter().unwrap();
        let validated = library
            .native_folder_path(originals.clone(), &work)
            .await
            .unwrap();
        fs::remove_dir(&originals).await.unwrap();
        std::os::unix::fs::symlink(&other, &originals).unwrap();
        let _guard = library.mutation.lock().await;
        assert!(library
            .register_source(&validated, true, &[], &work, Some(&validated))
            .await
            .is_err());
        assert!(library.source_records().await.unwrap().is_empty());
        fs::remove_dir_all(base).await.unwrap();
    }

    #[test]
    fn private_source_export_uses_ordinary_absolute_paths() {
        for (canonical, exported) in [
            (r"\\?\C:\Movies\Kids", r"C:\Movies\Kids"),
            (r"\\?\UNC\nas\videos\Kids", "//nas/videos/Kids"),
            (r"D:\Movies", r"D:\Movies"),
            ("/Volumes/data/Movies", "/Volumes/data/Movies"),
            (r"/media/\\?\Movies", r"/media/\\?\Movies"),
        ] {
            let original = PathBuf::from(canonical);
            assert_eq!(
                native_source_export_path(&original),
                PathBuf::from(exported)
            );
            assert_eq!(original, PathBuf::from(canonical));
        }
    }

    #[tokio::test]
    async fn native_source_missing_requested_folder_is_typed_without_starting_scan() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let error = library
            .native_sources(false, Some(base.join("Missing")))
            .await
            .err()
            .expect("missing requested folder must fail preflight");
        assert!(error.is::<NativeSourceUnavailable>());
        assert_eq!(error.to_string(), "Requested local folder is unavailable");
        assert!(!library.root.join("sources").exists());
        {
            let scan = library.scan.lock().await;
            assert_eq!(scan.jobs, 0);
            assert_eq!(scan.next_source_generation, 0);
            assert!(scan.records.is_empty());
            assert!(scan.source_scans.is_empty());
        }
        wait_for_drain(&library.background).await;
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_source_metadata_failure_is_not_requested_folder_unavailable() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let folder = base.join("Movies");
        fs::create_dir_all(&folder).await.unwrap();
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        fs::write(library.root.join("sources"), b"not a metadata directory")
            .await
            .unwrap();
        let error = library
            .native_sources(false, Some(folder))
            .await
            .err()
            .expect("invalid metadata directory must fail");
        assert!(!error.is::<NativeSourceUnavailable>());
        assert_eq!(error.to_string(), "Cannot read media sources");
        assert_eq!(library.scan.lock().await.jobs, 0);
        wait_for_drain(&library.background).await;
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_source_cancelled_preflight_is_not_folder_unavailable() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let folder = base.join("Movies");
        fs::create_dir_all(&folder).await.unwrap();
        let folder = fs::canonicalize(folder).await.unwrap();
        let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let gate = Arc::new(Semaphore::new(0));
        library.native_source_probe_gate = Some((folder.clone(), gate.clone()));
        let owner = library.clone();
        let pending = tokio::spawn(async move { owner.native_sources(false, Some(folder)).await });
        bounded(async {
            while library.source_probes.available_permits() == LIBRARY_PROBE_CONCURRENCY {
                tokio::task::yield_now().await;
            }
        })
        .await;
        library.background.set_standby(true);
        let error = bounded(pending)
            .await
            .unwrap()
            .err()
            .expect("cancelled preflight must fail");
        assert!(!error.is::<NativeSourceUnavailable>());
        assert_eq!(error.to_string(), BACKGROUND_CANCELLED.1);
        assert!(!library.root.join("sources").exists());
        gate.add_permits(1);
        wait_for_drain(&library.background).await;
        assert_eq!(
            library.source_probes.available_permits(),
            LIBRARY_PROBE_CONCURRENCY
        );
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_source_invalid_input_is_not_folder_unavailable() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let file = base.join("Movie.mp4");
        fs::write(&file, b"video").await.unwrap();
        for path in [
            PathBuf::from("relative"),
            PathBuf::from("/"),
            base.join("bad\0name"),
            file,
        ] {
            let error = library
                .native_sources(false, Some(path))
                .await
                .err()
                .expect("invalid folder input must fail");
            assert!(!error.is::<NativeSourceUnavailable>());
        }
        assert!(!library.root.join("sources").exists());
        wait_for_drain(&library.background).await;
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_source_deadline_and_worker_failure_are_not_folder_unavailable() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let mut library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        library.native_source_probe_timeout = Some(std::time::Duration::from_millis(20));
        let held = library
            .source_probes
            .acquire_many(LIBRARY_PROBE_CONCURRENCY as u32)
            .await
            .unwrap();
        let error = bounded(library.native_sources(false, Some(base.clone())))
            .await
            .err()
            .expect("blocked admission must time out");
        assert!(!error.is::<NativeSourceUnavailable>());
        assert_eq!(error.to_string(), "Local folder read timed out");
        wait_for_drain(&library.background).await;
        drop(held);
        library.source_probes.close();
        let error = library
            .native_sources(false, Some(base.clone()))
            .await
            .err()
            .expect("closed worker gate must fail");
        assert!(!error.is::<NativeSourceUnavailable>());
        assert_eq!(error.to_string(), "Local media storage unavailable");
        assert!(!library.root.join("sources").exists());
        wait_for_drain(&library.background).await;
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_source_filter_resolves_target_path_without_connecting_or_scanning() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = base.join("Movies");
        let unconnected = base.join("Unconnected");
        fs::create_dir_all(&originals).await.unwrap();
        fs::create_dir_all(&unconnected).await.unwrap();
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let linked = library
            .start_link_folder_path_tracked(originals.clone(), library.background.enter().unwrap())
            .await
            .unwrap();
        wait_for_drain(&library.background).await;
        let sources = library
            .native_sources(true, Some(originals.join(".")))
            .await
            .unwrap();
        assert_eq!(sources.len(), 1);
        assert_eq!(sources[0].id, linked.id);
        assert_eq!(sources[0].name, "Movies");
        let private = library
            .native_sources(false, Some(originals.clone()))
            .await
            .unwrap();
        assert!(private[0].path.is_none());
        #[cfg(unix)]
        {
            let alias = base.join("Alias");
            std::os::unix::fs::symlink(&originals, &alias).unwrap();
            let sources = library.native_sources(true, Some(alias)).await.unwrap();
            assert_eq!(sources.len(), 1);
            assert_eq!(sources[0].id, linked.id);
        }
        assert!(library
            .native_sources(true, Some(unconnected))
            .await
            .unwrap()
            .is_empty());
        assert_eq!(library.source_records().await.unwrap().len(), 1);
        fs::write(originals.join("New.mp4"), b"video")
            .await
            .unwrap();
        library.native_sources(true, Some(originals)).await.unwrap();
        assert!(library
            .records(&library.background.enter().unwrap())
            .await
            .unwrap()
            .is_empty());
        for invalid in [
            base.join("Missing"),
            PathBuf::from("Movies"),
            base.join("Movies/New.mp4"),
        ] {
            assert!(library.native_sources(true, Some(invalid)).await.is_err());
        }
        fs::remove_dir_all(base).await.unwrap();
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn native_source_listing_reports_revoked_folder_read_access() {
        use std::os::unix::fs::PermissionsExt;
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = base.join("Movies");
        fs::create_dir_all(&originals).await.unwrap();
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let linked = library
            .start_link_folder_path_tracked(originals.clone(), library.background.enter().unwrap())
            .await
            .unwrap();
        wait_for_drain(&library.background).await;
        let before = library.native_sources(false, None).await.unwrap();
        assert!(before[0].available);
        assert!(before[0].path.is_none());
        fs::set_permissions(&originals, std::fs::Permissions::from_mode(0o000))
            .await
            .unwrap();
        let permission_is_enforced = fs::read_dir(&originals).await.is_err();
        let denied = library.native_sources(true, None).await;
        fs::set_permissions(&originals, std::fs::Permissions::from_mode(0o700))
            .await
            .unwrap();
        eprintln!("folder read permission enforced: {permission_is_enforced}");
        let denied = denied.unwrap();
        assert_eq!(denied.len(), 1);
        assert_eq!(denied[0].id, linked.id);
        assert!(denied[0].path.is_some());
        if permission_is_enforced {
            assert!(!denied[0].available);
        }
        let restored = library.native_sources(false, None).await.unwrap();
        assert!(restored[0].available);
        assert!(restored[0].path.is_none());
        fs::remove_dir_all(base).await.unwrap();
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn native_source_listing_rejects_replaced_ancestor_identity() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let parent = base.join("Original");
        let originals = parent.join("Movies");
        let replacement = base.join("Replacement");
        fs::create_dir_all(&originals).await.unwrap();
        fs::create_dir_all(replacement.join("Movies"))
            .await
            .unwrap();
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let linked = library
            .start_link_folder_path_tracked(originals, library.background.enter().unwrap())
            .await
            .unwrap();
        wait_for_drain(&library.background).await;
        let original_path = library.native_sources(true, None).await.unwrap()[0]
            .path
            .clone();
        fs::rename(&parent, base.join("Moved")).await.unwrap();
        std::os::unix::fs::symlink(&replacement, &parent).unwrap();
        let changed = library.native_sources(true, None).await.unwrap();
        assert_eq!(changed.len(), 1);
        assert_eq!(changed[0].id, linked.id);
        assert_eq!(changed[0].path, original_path);
        assert!(!changed[0].available);
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_folder_command_limits_new_sources_but_reuses_existing_root() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = base.join("Movies");
        fs::create_dir_all(&originals).await.unwrap();
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let canonical = fs::canonicalize(&originals).await.unwrap();
        fs::create_dir_all(library.root.join("sources"))
            .await
            .unwrap();
        for index in 0..32 {
            let source = SourceRecord {
                id: format!("{index:032x}"),
                name: format!("Source {index}"),
                kind: "folder".into(),
                path: if index == 0 {
                    canonical.clone()
                } else {
                    base.join(format!("Other-{index}"))
                },
            };
            fs::write(
                library
                    .root
                    .join("sources")
                    .join(format!("{}.json", source.id)),
                serde_json::to_vec(&source).unwrap(),
            )
            .await
            .unwrap();
        }
        let extra = base.join("Extra");
        fs::create_dir_all(&extra).await.unwrap();
        let error = library
            .start_link_folder_path_tracked(extra, library.background.enter().unwrap())
            .await
            .err()
            .unwrap();
        assert_eq!(error.to_string(), NATIVE_SOURCE_LIMIT);
        assert_eq!(library.source_records().await.unwrap().len(), 32);
        let reused = library
            .start_link_folder_path_tracked(originals, library.background.enter().unwrap())
            .await
            .unwrap();
        assert_eq!(reused.id, "0".repeat(32));
        wait_for_drain(&library.background).await;
        assert_eq!(library.source_records().await.unwrap().len(), 32);
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_folder_command_persists_one_binding_and_keeps_paths_private() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = base.join("Movies");
        let metadata = base.join("metadata");
        fs::create_dir_all(originals.join("Season 1"))
            .await
            .unwrap();
        fs::write(originals.join("Season 1/episode.mp4"), b"original video")
            .await
            .unwrap();
        let library = Library::new(metadata.clone(), "t".repeat(32), "device")
            .await
            .unwrap();
        let folder = library
            .start_link_folder_path_tracked(originals.clone(), library.background.enter().unwrap())
            .await
            .unwrap();
        assert_eq!(folder.kind, "folder");
        assert_eq!(folder.name, "Movies");
        assert!(folder.available);
        assert!(folder.path.is_none());
        let sources = library.native_sources(false, None).await.unwrap();
        assert_eq!(sources.len(), 1);
        assert_eq!(sources[0].id, folder.id);
        assert!(!serde_json::to_value(&sources).unwrap()[0]
            .as_object()
            .unwrap()
            .contains_key("path"));
        let sources = library.native_sources(true, None).await.unwrap();
        assert_eq!(
            sources[0].path.as_ref().unwrap(),
            &native_source_export_path(&fs::canonicalize(&originals).await.unwrap())
        );
        wait_for_drain(&library.background).await;
        let repeated = library
            .start_link_folder_path_tracked(
                originals.join("."),
                library.background.enter().unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(repeated.id, folder.id);
        wait_for_drain(&library.background).await;
        let catalog = library.catalog().await.unwrap();
        assert_eq!(catalog.items.len(), 1);
        assert_eq!(catalog.items[0].source_id, folder.id);
        let public = serde_json::to_value(catalog).unwrap();
        assert!(!public["sources"][0]
            .as_object()
            .unwrap()
            .contains_key("path"));
        assert_eq!(
            fs::read(originals.join("Season 1/episode.mp4"))
                .await
                .unwrap(),
            b"original video"
        );
        let reopened = Library::new(metadata, "r".repeat(32), "device")
            .await
            .unwrap();
        assert_eq!(
            reopened.native_sources(true, None).await.unwrap()[0].id,
            folder.id
        );
        fs::rename(&originals, base.join("moved")).await.unwrap();
        assert!(!reopened.native_sources(false, None).await.unwrap()[0].available);
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_folder_command_rejects_non_folders_relative_paths_and_root() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(base.join("metadata"), "t".repeat(32), "device")
            .await
            .unwrap();
        let file = base.join("file.mp4");
        fs::write(&file, b"video").await.unwrap();
        let filesystem_root = fs::canonicalize(&base)
            .await
            .unwrap()
            .ancestors()
            .last()
            .unwrap()
            .to_path_buf();
        for path in [
            PathBuf::from("relative"),
            base.join("missing"),
            file,
            filesystem_root,
        ] {
            assert!(library
                .start_link_folder_path_tracked(path, library.background.enter().unwrap())
                .await
                .is_err());
        }
        assert!(library.native_sources(true, None).await.unwrap().is_empty());
        assert_eq!(library.scan.lock().await.jobs, 0);
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_source_commands_reject_shared_servers_and_cancelled_work() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = base.join("Movies");
        fs::create_dir_all(&originals).await.unwrap();
        let shared = Library::new(base.join("shared"), "s".repeat(32), "server")
            .await
            .unwrap();
        assert!(shared.native_sources(true, None).await.is_err());
        assert!(shared
            .start_link_folder_path_tracked(originals.clone(), shared.background.enter().unwrap())
            .await
            .is_err());
        let native = Library::new(base.join("native"), "n".repeat(32), "device")
            .await
            .unwrap();
        let work = native.background.enter().unwrap();
        native.background.set_standby(true);
        assert!(native
            .start_link_folder_path_tracked(originals, work)
            .await
            .is_err());
        native.background.set_standby(false);
        assert!(native.native_sources(true, None).await.unwrap().is_empty());
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn native_folder_command_rejects_new_overlapping_roots_without_registration() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let parent = base.join("Movies");
        let child = parent.join("Series");
        fs::create_dir_all(&child).await.unwrap();
        fs::write(child.join("episode.mp4"), b"video")
            .await
            .unwrap();
        for (index, first, second) in [(0, &parent, &child), (1, &child, &parent)] {
            let library = Library::new(
                base.join(format!("metadata-{index}")),
                "t".repeat(32),
                "device",
            )
            .await
            .unwrap();
            let source = library
                .start_link_folder_path_tracked(first.clone(), library.background.enter().unwrap())
                .await
                .unwrap();
            wait_for_drain(&library.background).await;
            let error = library
                .start_link_folder_path_tracked(second.clone(), library.background.enter().unwrap())
                .await
                .err()
                .unwrap();
            assert_eq!(error.to_string(), NATIVE_SOURCE_OVERLAP);
            let sources = library.native_sources(true, None).await.unwrap();
            assert_eq!(sources.len(), 1);
            assert_eq!(sources[0].id, source.id);
        }
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn cached_catalog_preserves_name_order_and_unique_source_metadata() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(root.clone(), "c".repeat(32), "device")
            .await
            .unwrap();
        let source_id = "f".repeat(32);
        let source = SourceRecord {
            id: source_id.clone(),
            name: "Selected folder".into(),
            kind: "folder".into(),
            path: root.clone(),
        };
        fs::create_dir_all(root.join("sources")).await.unwrap();
        fs::write(
            root.join("sources").join(format!("{source_id}.json")),
            serde_json::to_vec(&source).unwrap(),
        )
        .await
        .unwrap();
        {
            let mut scan = library.scan.lock().await;
            scan.cached = true;
            for index in (0..2048).rev() {
                let id = format!("{index:032x}");
                let record = Record {
                    id: id.clone(),
                    // Duplicate names exercise the deterministic ID tie-breaker.
                    name: if index % 2 == 0 {
                        "VIDEO".into()
                    } else {
                        "video".into()
                    },
                    size: 1,
                    mime: "video/mp4".into(),
                    extension: "mp4".into(),
                    linked_path: None,
                    source_id: if index < 2 {
                        Some(source_id.clone())
                    } else {
                        None
                    },
                };
                scan.records.insert(id, (record, index % 2 == 0));
            }
        }
        let catalog = library.catalog().await.unwrap();
        assert_eq!(catalog.items.len(), 2048);
        assert!(catalog.items.windows(2).all(|pair| pair[0].id < pair[1].id));
        assert_eq!(catalog.sources.len(), 2047);
        assert_eq!(catalog.sources[0].id, source_id);
        assert_eq!(catalog.sources[0].name, "Selected folder");
        assert_eq!(catalog.sources[0].kind, "folder");
        assert!(catalog.sources[0].available);
        for (item, source) in catalog.items[2..].iter().zip(&catalog.sources[1..]) {
            assert_eq!(source.id, item.source_id);
            assert_eq!(source.name, item.name);
            assert_eq!(source.available, item.available);
        }
        fs::remove_dir_all(root).await.unwrap();
    }

    #[tokio::test]
    async fn readonly_foreign_selection_is_missing_while_scan_is_blocked() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = base.join("originals");
        fs::create_dir_all(&originals).await.unwrap();
        fs::write(originals.join("movie.mp4"), b"video")
            .await
            .unwrap();
        let mut library = Library::new(base.join("state"), "f".repeat(32), "device")
            .await
            .unwrap();
        library.read_only_paths = Some(Arc::new(vec![originals.clone()]));
        let held = library.mutation.lock().await;
        library
            .start_link_paths(vec![originals], true)
            .await
            .unwrap();
        for id in ["source-browser-folder:movie.mp4", "../../outside.mp4"] {
            let response = catalog(
                State(library.clone()),
                Path("f".repeat(32)),
                Query(CatalogQuery {
                    preferred_id: Some(id.into()),
                    refresh: false,
                }),
            )
            .await;
            assert_eq!(response.status(), StatusCode::OK);
            let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
                .await
                .unwrap();
            let value: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
            assert_eq!(value["scanning"], true);
            assert_eq!(value["preferred"]["id"], id);
            assert_eq!(value["preferred"]["state"], "missing");
        }
        drop(held);
        while library.scan.lock().await.jobs != 0 {
            tokio::task::yield_now().await;
        }
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn readonly_http_streams_early_without_import_or_delete_routes() {
        let base_dir = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = base_dir.join("originals");
        let root = base_dir.join("state");
        fs::create_dir_all(&originals).await.unwrap();
        for index in 0..192 {
            fs::write(
                originals.join(format!("movie-{index:03}.mp4")),
                b"0123456789",
            )
            .await
            .unwrap();
        }
        let token = "r".repeat(32);
        let library = Library::new_read_only(root.clone(), token.clone(), vec![originals.clone()])
            .await
            .unwrap();
        let initial = library.catalog().await.unwrap();
        assert!(
            initial.scanning,
            "constructor must not await the full source scan"
        );
        assert!(initial.read_only);
        assert!(!initial.direct_sources);
        assert!(initial.upload_url.is_empty());
        assert_eq!(initial.storage, "server");
        let early = tokio::time::timeout(std::time::Duration::from_secs(10), async {
            loop {
                let snapshot = library.catalog().await.unwrap();
                if !snapshot.items.is_empty() {
                    break snapshot;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        assert!(early.scanning && early.items.len() < 192);
        let id = early.items[0].id.clone();
        let source_id = early.items[0].source_id.clone();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let origin = format!("http://{}", listener.local_addr().unwrap());
        let endpoint = format!("{origin}{}", library.endpoint());
        let routes = library.clone().routes();
        let server = tokio::spawn(async move { axum::serve(listener, routes).await.unwrap() });
        let client = reqwest::Client::new();
        let range = tokio::time::timeout(
            std::time::Duration::from_secs(2),
            client
                .get(format!("{endpoint}/{id}"))
                .header("Range", "bytes=2-5")
                .send(),
        )
        .await
        .unwrap()
        .unwrap();
        assert_eq!(range.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(range.headers()["content-range"], "bytes 2-5/10");
        assert_eq!(range.bytes().await.unwrap(), "2345");
        let head = client
            .head(format!("{endpoint}/{id}"))
            .send()
            .await
            .unwrap();
        assert_eq!(head.status(), StatusCode::OK);
        assert_eq!(head.headers()["content-length"], "10");
        assert!(head.bytes().await.unwrap().is_empty());
        assert_eq!(
            client
                .get(format!("{origin}/offline-media/{}/{id}", "x".repeat(32)))
                .send()
                .await
                .unwrap()
                .status(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            client
                .post(format!("{endpoint}/import?name=copy.mp4"))
                .body("data")
                .send()
                .await
                .unwrap()
                .status(),
            StatusCode::METHOD_NOT_ALLOWED
        );
        assert_eq!(
            client
                .delete(format!("{endpoint}/{id}"))
                .send()
                .await
                .unwrap()
                .status(),
            StatusCode::METHOD_NOT_ALLOWED
        );
        assert_eq!(
            client
                .delete(format!("{endpoint}/sources/{source_id}"))
                .send()
                .await
                .unwrap()
                .status(),
            StatusCode::NOT_FOUND
        );
        for url in [&endpoint, &format!("{endpoint}/{id}")] {
            assert_eq!(
                client.post(url.as_str()).send().await.unwrap().status(),
                StatusCode::METHOD_NOT_ALLOWED,
                "compatibility POST support must not enable media mutations"
            );
        }
        let lease = "a".repeat(32);
        for operation in ["prepare", "cancel"] {
            assert_eq!(
                client
                    .post(format!(
                        "{origin}/offline-media/{}/compat/{id}/{operation}",
                        "x".repeat(32)
                    ))
                    .header("X-OTT-Playback-Lease", &lease)
                    .send()
                    .await
                    .unwrap()
                    .status(),
                StatusCode::NOT_FOUND,
                "compatibility POST must authenticate before doing work"
            );
        }
        // Compatibility routes exist on read-only libraries without enabling
        // imports or deletion. This fixture deliberately has no media tools.
        let prepare = client
            .post(format!("{endpoint}/compat/{id}/prepare"))
            .send()
            .await
            .unwrap();
        assert_eq!(prepare.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(
            prepare.json::<serde_json::Value>().await.unwrap()["code"],
            "compatibility_unavailable"
        );
        assert_eq!(
            client
                .post(format!("{endpoint}/compat/{id}/cancel"))
                .send()
                .await
                .unwrap()
                .status(),
            StatusCode::BAD_REQUEST,
            "cancellation requires an explicit valid playback lease"
        );
        assert_eq!(
            client
                .post(format!("{endpoint}/compat/{id}/cancel"))
                .header("X-OTT-Playback-Lease", &lease)
                .send()
                .await
                .unwrap()
                .status(),
            StatusCode::NO_CONTENT
        );
        assert!(library.disconnect_source(&source_id).await.is_err());
        let preflight = client
            .request(reqwest::Method::OPTIONS, &endpoint)
            .send()
            .await
            .unwrap();
        assert_eq!(
            preflight.headers()["access-control-allow-methods"],
            "GET, HEAD, POST, OPTIONS"
        );
        let response = client.get(&endpoint).send().await.unwrap();
        let body = response.text().await.unwrap();
        assert!(!body.contains(&base_dir.to_string_lossy().to_string()));
        assert!(!body.contains("linked_path"));
        assert!(!root.join("copy.mp4").exists());
        while library.scan.lock().await.jobs != 0 {
            tokio::task::yield_now().await;
        }
        assert_eq!(std::fs::read_dir(&originals).unwrap().count(), 192);
        assert_eq!(
            fs::read(originals.join("movie-000.mp4")).await.unwrap(),
            b"0123456789"
        );
        server.abort();
        fs::remove_dir_all(base_dir).await.unwrap();
    }

    #[tokio::test]
    async fn readonly_configuration_cannot_serve_previous_or_unconfigured_sources() {
        let base_dir = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let first = base_dir.join("first");
        let second = base_dir.join("second");
        let root = base_dir.join("state");
        fs::create_dir_all(&first).await.unwrap();
        fs::create_dir_all(&second).await.unwrap();
        fs::write(first.join("old.mp4"), b"old").await.unwrap();
        fs::write(second.join("new.mp4"), b"new").await.unwrap();
        let old = Library::new_read_only(root.clone(), "s".repeat(32), vec![first.clone()])
            .await
            .unwrap();
        while old.scan.lock().await.jobs != 0 {
            tokio::task::yield_now().await;
        }
        let old_id = old.catalog().await.unwrap().items[0].id.clone();
        let current = Library::new_read_only(root, "s".repeat(32), vec![second.clone()])
            .await
            .unwrap();
        while current.scan.lock().await.jobs != 0 {
            tokio::task::yield_now().await;
        }
        assert_eq!(
            current.record(&old_id).await.err().unwrap().0,
            StatusCode::NOT_FOUND
        );
        let snapshot = current.catalog().await.unwrap();
        assert_eq!(snapshot.items.len(), 1);
        assert_eq!(snapshot.items[0].name, "new.mp4");
        assert_eq!(snapshot.sources.len(), 1);
        assert!(current.link_paths(vec![first.clone()], true).await.is_err());
        let inside = first.join("forbidden-cache");
        assert!(
            Library::new_read_only(inside.clone(), "s".repeat(32), vec![first])
                .await
                .is_err()
        );
        assert!(!inside.exists());
        fs::remove_dir_all(base_dir).await.unwrap();
    }

    async fn bounded<T>(operation: impl std::future::Future<Output = T>) -> T {
        tokio::time::timeout(std::time::Duration::from_secs(2), operation)
            .await
            .expect("filesystem worker did not reach the expected checkpoint")
    }

    async fn wait_for_drain(background: &crate::background_work::BackgroundWork) {
        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            while background.status().pending != 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn cancelled_owned_read_counts_current_io_and_never_starts_next_operation() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        let background = crate::background_work::BackgroundWork::default();
        let work = background.enter().unwrap();
        let next_operations = Arc::new(AtomicUsize::new(0));
        let observed = next_operations.clone();
        let (started, entered) = tokio::sync::oneshot::channel();
        let (finish, current_io) = tokio::sync::oneshot::channel();
        let reader = tokio::spawn(async move {
            owned_read(&work, |owner| async move {
                // This barrier represents an already-running filesystem call:
                // cancelling its caller cannot stop the underlying operation.
                checked(Some(&owner), async move {
                    started.send(()).unwrap();
                    current_io.await.unwrap();
                })
                .await?;
                observed.fetch_add(1, Ordering::SeqCst);
                Ok(())
            })
            .await
        });
        bounded(entered).await.unwrap();
        background.set_standby(true);
        assert_eq!(bounded(reader).await.unwrap(), Err(BACKGROUND_CANCELLED));
        assert_eq!(background.status().pending, 1);
        assert!(!background.status().quiescent);
        // Even an immediate wake cannot authorize the previous read's tail.
        background.set_standby(false);
        finish.send(()).unwrap();
        wait_for_drain(&background).await;
        assert_eq!(next_operations.load(Ordering::SeqCst), 0);
        assert!(background.set_standby(true).quiescent);
    }

    #[tokio::test]
    async fn timed_out_or_dropped_reader_stops_after_current_io_while_player_stays_awake() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        for timeout in [true, false] {
            let background = crate::background_work::BackgroundWork::default();
            let work = background.enter().unwrap();
            let next_operations = Arc::new(AtomicUsize::new(0));
            let observed = next_operations.clone();
            let scan = Arc::new(Mutex::new(ScanState::default()));
            let published = scan.clone();
            let (started, entered) = tokio::sync::oneshot::channel();
            let (finish, current_io) = tokio::sync::oneshot::channel();
            let reader = tokio::spawn(async move {
                let read = owned_read(&work, |owner| async move {
                    checked(Some(&owner), async move {
                        started.send(()).unwrap();
                        current_io.await.unwrap();
                    })
                    .await?;
                    checked(Some(&owner), async {
                        observed.fetch_add(1, Ordering::SeqCst);
                    })
                    .await?;
                    let mut scan = owner.run(published.lock()).await?;
                    owner.publish(|| scan.cached = true)?;
                    Ok(())
                });
                if timeout {
                    assert!(
                        tokio::time::timeout(std::time::Duration::from_millis(25), read)
                            .await
                            .is_err()
                    );
                } else {
                    read.await.unwrap();
                }
            });
            bounded(entered).await.unwrap();
            if timeout {
                bounded(reader).await.unwrap();
            } else {
                reader.abort();
                assert!(bounded(reader).await.unwrap_err().is_cancelled());
            }
            assert_eq!(background.status().pending, 1);
            assert!(!background.status().standby);
            finish.send(()).unwrap();
            wait_for_drain(&background).await;
            assert!(!background.status().standby);
            assert_eq!(next_operations.load(Ordering::SeqCst), 0);
            assert!(!scan.lock().await.cached);
        }
    }

    #[tokio::test]
    async fn abandoned_reader_releases_scan_mutex_wait_without_late_publication() {
        let background = crate::background_work::BackgroundWork::default();
        let work = background.enter().unwrap();
        let scan = Arc::new(Mutex::new(ScanState::default()));
        let held = scan.lock().await;
        let published = scan.clone();
        let (started, entered) = tokio::sync::oneshot::channel();
        let reader = tokio::spawn(async move {
            owned_read(&work, |owner| async move {
                started.send(()).unwrap();
                let mut scan = owner.run(published.lock()).await?;
                owner.publish(|| scan.cached = true)?;
                Ok(())
            })
            .await
        });
        bounded(entered).await.unwrap();
        reader.abort();
        assert!(bounded(reader).await.unwrap_err().is_cancelled());
        // No filesystem call is active here: the abandoned mutex waiter must
        // drain even while another operation retains the publication lock.
        wait_for_drain(&background).await;
        assert!(!background.status().standby);
        assert!(!held.cached);
        drop(held);
        // A fresh read and publication remain allowed in this generation.
        let fresh = background.enter().unwrap();
        let published = scan.clone();
        owned_read(&fresh, |owner| async move {
            let mut scan = owner.run(published.lock()).await?;
            owner.publish(|| scan.cached = true)
        })
        .await
        .unwrap();
        assert!(scan.lock().await.cached);
    }

    #[tokio::test]
    async fn cancelled_media_chunk_keeps_io_owned_until_completion() {
        use std::sync::atomic::{AtomicBool, Ordering};
        struct HeldRead {
            started: Option<tokio::sync::oneshot::Sender<()>>,
            completion: tokio::sync::oneshot::Receiver<()>,
            dropped: Arc<AtomicBool>,
        }
        impl tokio::io::AsyncRead for HeldRead {
            fn poll_read(
                mut self: std::pin::Pin<&mut Self>,
                cx: &mut std::task::Context<'_>,
                buf: &mut tokio::io::ReadBuf<'_>,
            ) -> std::task::Poll<std::io::Result<()>> {
                if let Some(started) = self.started.take() {
                    started.send(()).unwrap();
                }
                match std::future::Future::poll(std::pin::Pin::new(&mut self.completion), cx) {
                    std::task::Poll::Pending => std::task::Poll::Pending,
                    std::task::Poll::Ready(result) => {
                        result.unwrap();
                        buf.put_slice(b"x");
                        std::task::Poll::Ready(Ok(()))
                    }
                }
            }
        }
        impl Drop for HeldRead {
            fn drop(&mut self) {
                self.dropped.store(true, Ordering::SeqCst);
            }
        }
        for standby in [false, true] {
            let background = crate::background_work::BackgroundWork::default();
            let work = background.enter().unwrap();
            let dropped = Arc::new(AtomicBool::new(false));
            let (started, entered) = tokio::sync::oneshot::channel();
            let (finish, completion) = tokio::sync::oneshot::channel();
            let file = HeldRead {
                started: Some(started),
                completion,
                dropped: dropped.clone(),
            };
            let reader = tokio::spawn(async move { read_media_chunk(file, 64, &work).await });
            bounded(entered).await.unwrap();
            if standby {
                background.set_standby(true);
                assert_eq!(
                    bounded(reader).await.unwrap().err(),
                    Some(BACKGROUND_CANCELLED)
                );
                background.set_standby(false);
            } else {
                reader.abort();
                assert!(bounded(reader).await.err().unwrap().is_cancelled());
            }
            assert_eq!(background.status().pending, 1);
            assert!(!dropped.load(Ordering::SeqCst));
            // The caller has gone, but its actual read still owns the file.
            finish.send(()).unwrap();
            wait_for_drain(&background).await;
            assert!(dropped.load(Ordering::SeqCst));
            assert!(!background.status().standby);
        }
    }

    #[tokio::test]
    async fn standby_stops_persisted_metadata_traversal_without_late_cache_publication() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = root.with_extension("originals");
        fs::create_dir_all(&originals).await.unwrap();
        let movie = originals.join("movie.mp4");
        fs::write(&movie, b"movie").await.unwrap();
        let movie = fs::canonicalize(movie).await.unwrap();
        let background = crate::background_work::BackgroundWork::default();
        let library = Library::new(root.clone(), "r".repeat(32), "device")
            .await
            .unwrap()
            .with_background(background.clone());
        for index in 0..64 {
            let record = Record {
                id: uuid::Uuid::new_v4().simple().to_string(),
                name: format!("movie-{index}"),
                size: 5,
                mime: "video/mp4".into(),
                extension: "mp4".into(),
                linked_path: Some(movie.clone()),
                source_id: None,
            };
            fs::write(
                root.join(format!("{}.json", record.id)),
                serde_json::to_vec(&record).unwrap(),
            )
            .await
            .unwrap();
        }
        library.start_refresh_sources().await;
        let at_cancel = tokio::time::timeout(std::time::Duration::from_secs(2), async {
            loop {
                let scan = library.scan.lock().await;
                if scan.scanned > 0 {
                    assert!(
                        scan.scanned < 64,
                        "cancel before the metadata traversal completes"
                    );
                    // Hold publication's mutex across cancellation. A record
                    // already read may not publish when that mutex is released.
                    background.set_standby(true);
                    let scanned = scan.scanned;
                    drop(scan);
                    return scanned;
                }
                drop(scan);
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        background.set_standby(false);
        wait_for_drain(&background).await;
        {
            let scan = library.scan.lock().await;
            assert_eq!(scan.scanned, at_cancel);
            assert_eq!(scan.records.len(), at_cancel as usize);
            assert_eq!(scan.jobs, 0);
            assert!(!scan.cached);
        }
        library.start_refresh_sources().await;
        wait_for_drain(&background).await;
        assert_eq!(library.catalog().await.unwrap().items.len(), 64);
        fs::remove_dir_all(root).await.unwrap();
        fs::remove_dir_all(originals).await.unwrap();
    }

    #[tokio::test]
    async fn saved_native_item_is_ready_before_unrelated_records_are_scanned() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = root.with_extension("originals");
        fs::create_dir_all(&originals).await.unwrap();
        for index in 0..128 {
            fs::write(originals.join(format!("movie-{index:03}.mp4")), b"video")
                .await
                .unwrap();
        }
        let library = Library::new(root.clone(), "p".repeat(32), "device")
            .await
            .unwrap();
        library
            .link_paths(vec![originals.clone()], true)
            .await
            .unwrap();
        let catalog = library.catalog().await.unwrap();
        let last_id = catalog.items.last().unwrap().id.clone();
        let reopened = Library::new(root.clone(), "r".repeat(32), "device")
            .await
            .unwrap();
        reopened
            .start_refresh_sources_with_preferred(Some(&last_id))
            .await;
        {
            // On this single-thread runtime the scheduled traversal has not
            // run yet: the last playlist item must already be playable.
            let scan = reopened.scan.lock().await;
            assert_eq!(scan.jobs, 1);
            assert_eq!(scan.scanned, 0);
            assert_eq!(scan.records.len(), 1);
            assert!(scan.records.get(&last_id).unwrap().1);
        }
        let response = media(
            State(reopened.clone()),
            Path(("r".repeat(32), last_id.clone())),
            HeaderMap::new(),
            Method::GET,
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        tokio::time::timeout(std::time::Duration::from_secs(10), async {
            while reopened.scan.lock().await.jobs != 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        let completed = reopened.catalog().await.unwrap();
        assert_eq!(completed.items.len(), 128);
        assert_eq!(
            completed
                .items
                .iter()
                .filter(|item| item.id == last_id)
                .count(),
            1
        );
        let scanned = completed.scanned;
        reopened.prioritize_item(&last_id).await;
        let repeated = reopened.catalog().await.unwrap();
        assert!(
            !repeated.scanning,
            "a saved-item lookup must not restart discovery"
        );
        assert_eq!(repeated.scanned, scanned);
        assert_eq!(repeated.items.len(), 128);
        fs::remove_dir_all(root).await.unwrap();
        fs::remove_dir_all(originals).await.unwrap();
    }

    #[tokio::test]
    async fn missing_saved_native_file_is_reported_before_background_discovery() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = root.with_extension("originals");
        fs::create_dir_all(&originals).await.unwrap();
        fs::write(originals.join("removed.mp4"), b"video")
            .await
            .unwrap();
        fs::write(originals.join("survivor.mp4"), b"video")
            .await
            .unwrap();
        let library = Library::new(root.clone(), "p".repeat(32), "device")
            .await
            .unwrap();
        library
            .link_paths(vec![originals.clone()], true)
            .await
            .unwrap();
        let id = library
            .catalog()
            .await
            .unwrap()
            .items
            .iter()
            .find(|item| item.name == "removed.mp4")
            .unwrap()
            .id
            .clone();
        fs::remove_file(originals.join("removed.mp4"))
            .await
            .unwrap();
        let reopened = Library::new(root.clone(), "r".repeat(32), "device")
            .await
            .unwrap();
        reopened
            .start_refresh_sources_with_preferred(Some(&id))
            .await;
        {
            let scan = reopened.scan.lock().await;
            assert_eq!(scan.scanned, 0);
            assert_eq!(scan.jobs, 1);
            let preferred = scan.preferred.as_ref().unwrap();
            assert_eq!(preferred.id, id);
            assert_eq!(preferred.state, "missing");
        }
        tokio::time::timeout(std::time::Duration::from_secs(10), async {
            while reopened.scan.lock().await.jobs != 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        assert!(reopened
            .catalog()
            .await
            .unwrap()
            .items
            .iter()
            .any(|item| item.name == "survivor.mp4" && item.available));
        fs::remove_dir_all(root).await.unwrap();
        fs::remove_dir_all(originals).await.unwrap();
    }

    #[tokio::test]
    async fn preferred_item_does_not_wait_for_or_reset_an_active_native_scan() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = root.with_extension("originals");
        fs::create_dir_all(&originals).await.unwrap();
        fs::write(originals.join("first.mp4"), b"first")
            .await
            .unwrap();
        fs::write(originals.join("last.mp4"), b"last")
            .await
            .unwrap();
        let library = Library::new(root.clone(), "p".repeat(32), "device")
            .await
            .unwrap();
        library
            .link_paths(vec![originals.clone()], true)
            .await
            .unwrap();
        let items = library.catalog().await.unwrap().items;
        // Discovery takes this lock for the whole source. Direct resume must
        // remain independent even when that background traversal is blocked.
        let mutation = library.mutation.lock().await;
        library
            .start_link_paths(vec![originals.clone()], true)
            .await
            .unwrap();
        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            library.prioritize_item(&items[0].id).await;
            library
                .start_refresh_sources_with_preferred(Some(&items[1].id))
                .await;
        })
        .await
        .unwrap();
        {
            let scan = library.scan.lock().await;
            assert_eq!(
                scan.jobs, 1,
                "repeated discovery must not enqueue a second job"
            );
            assert_eq!(scan.scanned, 0);
            assert_eq!(
                scan.records.len(),
                2,
                "an existing snapshot must not be cleared"
            );
        }
        let catalog = library.catalog().await.unwrap();
        assert!(catalog.scanning);
        assert!(catalog.items.iter().all(|item| item.available));
        drop(mutation);
        tokio::time::timeout(std::time::Duration::from_secs(10), async {
            while library.scan.lock().await.jobs != 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        assert_eq!(library.catalog().await.unwrap().items.len(), 2);
        fs::remove_dir_all(root).await.unwrap();
        fs::remove_dir_all(originals).await.unwrap();
    }

    #[tokio::test]
    async fn preferred_lookup_rejects_unknown_deleted_and_other_instance_items() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(root.join("one"), "p".repeat(32), "device")
            .await
            .unwrap();
        let other = Library::new(root.join("two"), "q".repeat(32), "device")
            .await
            .unwrap();
        let items = import_inner(&library, &"p".repeat(32), "movie.mp4", Body::from("movie"))
            .await
            .unwrap()
            .items;
        let id = &items[0].id;
        assert!(library
            .preferred_record(id, &library.background.enter().unwrap())
            .await
            .is_some());
        let foreign = other
            .preferred_record(id, &other.background.enter().unwrap())
            .await
            .unwrap();
        assert!(foreign.1.is_none());
        assert_eq!(foreign.2.state, "missing");
        for invalid in ["../movie", "/tmp/movie.mp4", "local-movie", ""] {
            assert!(library
                .preferred_record(invalid, &library.background.enter().unwrap())
                .await
                .is_none());
        }
        fs::remove_file(library.root.join(format!("{id}.mp4")))
            .await
            .unwrap();
        let missing = library
            .preferred_record(id, &library.background.enter().unwrap())
            .await
            .unwrap();
        assert!(missing.1.is_none());
        assert_eq!(missing.2.state, "missing");
        fs::remove_dir_all(root).await.unwrap();
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn preferred_lookup_rejects_replaced_original_and_metadata_symlinks() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = root.with_extension("originals");
        fs::create_dir_all(&originals).await.unwrap();
        let movie = originals.join("movie.mp4");
        fs::write(&movie, b"video").await.unwrap();
        let library = Library::new(root.clone(), "p".repeat(32), "device")
            .await
            .unwrap();
        library
            .link_paths(vec![originals.clone()], true)
            .await
            .unwrap();
        let id = library.catalog().await.unwrap().items[0].id.clone();
        let target = originals.join("replacement.mp4");
        fs::rename(&movie, &target).await.unwrap();
        std::os::unix::fs::symlink(&target, &movie).unwrap();
        let blocked = library
            .preferred_record(&id, &library.background.enter().unwrap())
            .await
            .unwrap();
        assert!(blocked.1.is_none());
        assert_eq!(blocked.2.state, "pending");
        fs::remove_file(&movie).await.unwrap();
        fs::rename(target, movie).await.unwrap();
        let metadata = root.join(format!("{id}.json"));
        let metadata_target = root.join("metadata.backup");
        fs::rename(&metadata, &metadata_target).await.unwrap();
        std::os::unix::fs::symlink(metadata_target, metadata).unwrap();
        let blocked = library
            .preferred_record(&id, &library.background.enter().unwrap())
            .await
            .unwrap();
        assert!(blocked.1.is_none());
        assert_eq!(blocked.2.state, "pending");
        fs::remove_dir_all(root).await.unwrap();
        fs::remove_dir_all(originals).await.unwrap();
    }

    #[tokio::test]
    async fn disconnect_during_preferred_lookup_cannot_restore_an_old_snapshot_entry() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(root.clone(), "p".repeat(32), "device")
            .await
            .unwrap();
        let item = import_inner(&library, &"p".repeat(32), "movie.mp4", Body::from("movie"))
            .await
            .unwrap()
            .items
            .remove(0);
        // Finish validation, then disconnect before that result is published.
        let preferred = library
            .preferred_record(&item.id, &library.background.enter().unwrap())
            .await;
        assert!(preferred.is_some());
        library.disconnect_source(&item.source_id).await.unwrap();
        library.start_refresh_sources().await;
        library.scan.lock().await.cache_preferred(preferred);
        assert!(library.catalog().await.unwrap().items.is_empty());
        tokio::time::timeout(std::time::Duration::from_secs(10), async {
            while library.scan.lock().await.jobs != 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        fs::remove_dir_all(root).await.unwrap();
    }

    #[tokio::test]
    async fn standby_cancels_preferred_startup_and_old_lookup_cannot_publish_after_wake() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let background = crate::background_work::BackgroundWork::default();
        let library = Library::new(root.clone(), "p".repeat(32), "device")
            .await
            .unwrap()
            .with_background(background.clone());
        let id = import_inner(&library, &"p".repeat(32), "movie.mp4", Body::from("movie"))
            .await
            .unwrap()
            .items
            .remove(0)
            .id;
        // Keep the lookup awaiting its first snapshot access. It must cancel
        // promptly rather than register a scan when this old request resumes.
        let held = library.scan.lock().await;
        let lookup_library = library.clone();
        let lookup_id = id.clone();
        let lookup = tokio::spawn(async move {
            lookup_library
                .start_refresh_sources_with_preferred(Some(&lookup_id))
                .await;
        });
        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            while background.status().pending == 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        background.set_standby(true);
        library.prioritize_item(&id).await;
        library
            .start_refresh_sources_with_preferred(Some(&id))
            .await;
        background.set_standby(false);
        tokio::time::timeout(std::time::Duration::from_secs(2), lookup)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(background.status().pending, 0);
        assert_eq!(held.jobs, 0);
        assert!(held.records.is_empty());
        drop(held);
        // A new wake generation can still use the direct seed normally.
        library
            .start_refresh_sources_with_preferred(Some(&id))
            .await;
        assert!(library.scan.lock().await.records.get(&id).unwrap().1);
        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            while background.status().pending != 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        fs::remove_dir_all(root).await.unwrap();
    }

    #[tokio::test]
    async fn ordinary_preferred_lookup_restarts_a_cancelled_snapshot_after_wake() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let background = crate::background_work::BackgroundWork::default();
        let library = Library::new(root.clone(), "p".repeat(32), "device")
            .await
            .unwrap()
            .with_background(background.clone());
        let id = import_inner(&library, &"p".repeat(32), "movie.mp4", Body::from("movie"))
            .await
            .unwrap()
            .items
            .remove(0)
            .id;
        library.start_refresh_sources().await;
        background.set_standby(true);
        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            while background.status().pending != 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        assert!(!library.scan.lock().await.cached);
        background.set_standby(false);
        // This is the ordinary endpoint lookup: no explicit refresh flag.
        library.prioritize_item(&id).await;
        {
            let scan = library.scan.lock().await;
            assert!(scan.cached);
            assert_eq!(scan.jobs, 1);
            assert_eq!(scan.scanned, 0);
            assert_eq!(scan.records.len(), 1);
            assert!(scan.records.get(&id).unwrap().1);
        }
        library.prioritize_item(&id).await;
        assert!(library.scan.lock().await.jobs <= 1);
        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            while background.status().pending != 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        let scanned = library.scan.lock().await.scanned;
        // Another endpoint can finish rebuilding between an ensure caller's
        // invalid-cache check and its registration lock. That stale decision
        // must not clear the now-complete snapshot and launch a second scan.
        let work = background.enter().unwrap();
        let preferred = library.preferred_record(&id, &work).await;
        library
            .start_refresh_sources_seeded(preferred, work, false)
            .await;
        library.prioritize_item(&id).await;
        assert_eq!(library.scan.lock().await.jobs, 0);
        assert_eq!(library.scan.lock().await.scanned, scanned);
        assert_eq!(library.catalog().await.unwrap().items.len(), 1);
        // Legacy profiles and the source manager may have no saved item.
        // Their ordinary endpoint discovery must also rebuild asynchronously.
        library.start_refresh_sources().await;
        background.set_standby(true);
        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            while background.status().pending != 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        background.set_standby(false);
        library
            .ensure_catalog_tracked(None, background.enter().unwrap())
            .await;
        {
            let scan = library.scan.lock().await;
            assert!(scan.cached);
            assert_eq!(scan.jobs, 1);
            assert_eq!(scan.scanned, 0);
        }
        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            while background.status().pending != 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        assert_eq!(library.catalog().await.unwrap().items.len(), 1);
        fs::remove_dir_all(root).await.unwrap();
    }

    #[tokio::test]
    async fn standby_cancels_a_queued_scan_and_wake_does_not_revive_its_generation() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = root.with_extension("originals");
        fs::create_dir_all(&originals).await.unwrap();
        fs::write(originals.join("movie.mp4"), b"video")
            .await
            .unwrap();
        let background = crate::background_work::BackgroundWork::default();
        let library = Library::new(root.clone(), "q".repeat(32), "device")
            .await
            .unwrap()
            .with_background(background.clone());
        let held = library.mutation.lock().await;
        library
            .start_link_paths(vec![originals.clone()], true)
            .await
            .unwrap();
        assert_eq!(background.status().pending, 1);
        background.set_standby(true);
        assert!(library
            .start_link_paths(vec![originals.clone()], true)
            .await
            .is_err());
        assert!(library.catalog().await.is_err());
        background.set_standby(false);
        drop(held);
        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            while background.status().pending != 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        assert!(library.source_records().await.unwrap().is_empty());
        library
            .start_link_paths(vec![originals.clone()], true)
            .await
            .unwrap();
        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            while background.status().pending != 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        assert_eq!(library.catalog().await.unwrap().items.len(), 1);
        background.set_standby(true);
        let shared_root = root.with_extension("shared");
        let shared = Library::new(shared_root.clone(), "z".repeat(32), "server")
            .await
            .unwrap();
        assert!(
            shared.catalog().await.is_ok(),
            "another server library is independent"
        );
        assert!(background.status().quiescent);
        fs::remove_dir_all(root).await.unwrap();
        fs::remove_dir_all(originals).await.unwrap();
        fs::remove_dir_all(shared_root).await.unwrap();
    }
    #[tokio::test]
    async fn background_native_scan_publishes_playable_items_before_completion() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = root.with_extension("originals");
        fs::create_dir_all(&originals).await.unwrap();
        for index in 0..192 {
            fs::write(originals.join(format!("movie-{index:03}.mp4")), b"video")
                .await
                .unwrap();
        }
        let library = Library::new(root.clone(), "p".repeat(32), "device")
            .await
            .unwrap();
        library
            .start_link_paths(vec![originals.clone()], true)
            .await
            .unwrap();
        let initial = library.catalog().await.unwrap();
        assert!(
            initial.scanning,
            "the command registers work before returning"
        );
        assert_eq!(initial.total, None);
        let early = tokio::time::timeout(std::time::Duration::from_secs(10), async {
            loop {
                let catalog = library.catalog().await.unwrap();
                if !catalog.items.is_empty() {
                    break catalog;
                }
                assert!(catalog.scanning);
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        assert!(
            early.scanning,
            "first playable batch must precede the final scan"
        );
        assert!(early.items.len() < 192);
        assert!(early.scanned > 0);
        let first_id = early.items[0].id.clone();
        let response = media(
            State(library.clone()),
            Path(("p".repeat(32), first_id.clone())),
            HeaderMap::new(),
            Method::GET,
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        let completed = tokio::time::timeout(std::time::Duration::from_secs(10), async {
            loop {
                if library.scan.lock().await.jobs == 0 {
                    break library.catalog().await.unwrap();
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        assert_eq!(completed.items.len(), 192);
        assert!(!completed.scanning);
        assert_eq!(completed.total, Some(completed.scanned));
        assert!(completed.scan_error.is_none());
        assert!(completed.items.iter().any(|item| item.id == first_id));
        library.start_refresh_sources().await;
        // Repeated endpoint discovery must not enqueue duplicate refresh jobs.
        library.start_refresh_sources().await;
        assert_eq!(library.scan.lock().await.jobs, 1);
        tokio::time::timeout(std::time::Duration::from_secs(10), async {
            while library.scan.lock().await.jobs != 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        let refreshed = library.catalog().await.unwrap();
        assert_eq!(refreshed.items.len(), 192);
        assert!(refreshed.items.iter().any(|item| item.id == first_id));
        assert!(!root.join(format!("{first_id}.mp4")).exists());
        let original = library
            .record(&first_id)
            .await
            .unwrap()
            .linked_path
            .unwrap();
        fs::remove_file(original).await.unwrap();
        library.start_refresh_sources().await;
        tokio::time::timeout(std::time::Duration::from_secs(10), async {
            while library.scan.lock().await.jobs != 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        let missing = library.catalog().await.unwrap();
        let missing_item = missing
            .items
            .iter()
            .find(|item| item.id == first_id)
            .unwrap();
        assert!(
            !missing_item.available,
            "cached snapshots must preserve unavailable originals"
        );
        assert!(missing_item.url.is_empty());
        library
            .disconnect_source(&missing_item.source_id)
            .await
            .unwrap();
        assert!(
            library.catalog().await.unwrap().items.is_empty(),
            "disconnect invalidates the completed scan cache"
        );
        fs::remove_dir_all(root).await.unwrap();
        fs::remove_dir_all(originals).await.unwrap();
    }

    #[tokio::test]
    async fn refresh_keeps_available_folder_when_another_source_is_missing() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = root.with_extension("originals");
        let missing = originals.join("missing");
        let available = originals.join("available");
        fs::create_dir_all(&missing).await.unwrap();
        fs::create_dir_all(&available).await.unwrap();
        fs::write(missing.join("old.mp4"), b"old").await.unwrap();
        fs::write(available.join("play.mp4"), b"video")
            .await
            .unwrap();
        let library = Library::new(root.clone(), "m".repeat(32), "device")
            .await
            .unwrap();
        library
            .link_paths(vec![missing.clone(), available], true)
            .await
            .unwrap();
        fs::remove_dir_all(missing).await.unwrap();
        library.start_refresh_sources().await;
        tokio::time::timeout(std::time::Duration::from_secs(10), async {
            while library.scan.lock().await.jobs != 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        let catalog = library.catalog().await.unwrap();
        assert!(
            catalog.scan_error.is_none(),
            "one disconnected source must not reject the playable catalog"
        );
        let unavailable = catalog
            .sources
            .iter()
            .find(|source| !source.available)
            .unwrap();
        assert!(catalog
            .source_scans
            .iter()
            .any(|state| state.source_id == unavailable.id && state.state == "error"));
        let available = catalog
            .sources
            .iter()
            .find(|source| source.available)
            .unwrap();
        assert!(catalog
            .source_scans
            .iter()
            .any(|state| state.source_id == available.id && state.state == "complete"));
        assert_eq!(catalog.items.len(), 2);
        assert_eq!(
            catalog.items.iter().filter(|item| item.available).count(),
            1
        );
        assert_eq!(
            catalog
                .sources
                .iter()
                .filter(|source| source.available)
                .count(),
            1
        );
        fs::remove_dir_all(root).await.unwrap();
        fs::remove_dir_all(originals).await.unwrap();
    }

    #[tokio::test]
    async fn failed_background_scan_finishes_with_explicit_error() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(root.clone(), "z".repeat(32), "device")
            .await
            .unwrap();
        library
            .start_link_paths(vec![root.join("missing")], true)
            .await
            .unwrap();
        tokio::time::timeout(std::time::Duration::from_secs(10), async {
            while library.scan.lock().await.jobs != 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        let catalog = library.catalog().await.unwrap();
        assert!(!catalog.scanning);
        assert!(catalog.scan_error.is_some());
        fs::remove_dir_all(root).await.unwrap();
    }

    #[tokio::test]
    async fn native_sources_stream_originals_persist_and_disconnect_without_deleting() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = root.with_extension("originals");
        fs::create_dir_all(originals.join("subfolder"))
            .await
            .unwrap();
        let movie = originals.join("subfolder").join("movie.mp4");
        fs::write(&movie, "0123456789").await.unwrap();
        fs::write(originals.join("notes.txt"), "keep this")
            .await
            .unwrap();
        let library = Library::new(root.clone(), "g".repeat(32), "device")
            .await
            .unwrap();
        library
            .link_paths(vec![originals.clone()], true)
            .await
            .unwrap();
        let catalog = library.catalog().await.unwrap();
        assert_eq!(catalog.items.len(), 1);
        assert_eq!(catalog.sources.len(), 1);
        assert_eq!(catalog.items[0].directory, "subfolder");
        assert_eq!(catalog.items[0].source, "linked");
        assert_eq!(catalog.items[0].source_id, catalog.sources[0].id);
        // App data contains metadata only, never an mp4 copy.
        assert!(!root.join(format!("{}.mp4", catalog.items[0].id)).exists());
        let original_id = catalog.items[0].id.clone();
        fs::write(originals.join("new.mp4"), "new content")
            .await
            .unwrap();
        library.refresh_sources().await;
        let refreshed = library.catalog().await.unwrap();
        assert_eq!(refreshed.items.len(), 2);
        assert!(refreshed.items.iter().any(|item| item.id == original_id));
        library.refresh_sources().await;
        assert_eq!(library.catalog().await.unwrap().items.len(), 2);
        let reopened = Library::new(root.clone(), "h".repeat(32), "device")
            .await
            .unwrap();
        assert_eq!(reopened.catalog().await.unwrap().items.len(), 2);
        let mut headers = HeaderMap::new();
        headers.insert("range", "bytes=2-5".parse().unwrap());
        let response = media(
            State(reopened.clone()),
            Path(("h".repeat(32), catalog.items[0].id.clone())),
            headers,
            Method::GET,
        )
        .await;
        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(
            axum::body::to_bytes(response.into_body(), 1024)
                .await
                .unwrap(),
            "2345"
        );
        // Missing original stays visible but cannot be played.
        fs::rename(&movie, movie.with_extension("moved"))
            .await
            .unwrap();
        reopened.refresh_sources().await;
        let missing = reopened.catalog().await.unwrap();
        let missing_original = missing
            .items
            .iter()
            .find(|item| item.id == original_id)
            .unwrap();
        assert!(!missing_original.available);
        assert!(missing_original.url.is_empty());
        reopened
            .disconnect_source(&catalog.sources[0].id)
            .await
            .unwrap();
        assert!(reopened.catalog().await.unwrap().items.is_empty());
        assert_eq!(
            fs::read(movie.with_extension("moved")).await.unwrap(),
            b"0123456789"
        );
        assert_eq!(
            fs::read(originals.join("notes.txt")).await.unwrap(),
            b"keep this"
        );
        fs::remove_dir_all(root).await.unwrap();
        fs::remove_dir_all(originals).await.unwrap();
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn native_folder_does_not_follow_external_symlinks() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = root.with_extension("originals");
        let secret = root.with_extension("secret.mp4");
        fs::create_dir_all(&originals).await.unwrap();
        fs::write(&secret, "private").await.unwrap();
        std::os::unix::fs::symlink(&secret, originals.join("escape.mp4")).unwrap();
        let library = Library::new(root.clone(), "i".repeat(32), "device")
            .await
            .unwrap();
        library
            .link_paths(vec![originals.clone()], true)
            .await
            .unwrap();
        assert!(library.catalog().await.unwrap().items.is_empty());
        fs::remove_dir_all(root).await.unwrap();
        fs::remove_dir_all(originals).await.unwrap();
        fs::remove_file(secret).await.unwrap();
    }

    #[test]
    fn ranges() {
        assert_eq!(byte_range(Some("bytes=2-4"), 10).unwrap(), Some((2, 4)));
        assert_eq!(byte_range(Some("bytes=-3"), 10).unwrap(), Some((7, 9)));
        assert_eq!(byte_range(Some("bytes=8-"), 10).unwrap(), Some((8, 9)));
        assert!(byte_range(Some("bytes=10-"), 10).is_err());
        assert!(byte_range(Some("bytes=1-2,4-5"), 10).is_err());
    }
    #[tokio::test]
    async fn imports_persist_and_reject_paths() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let l = Library::new(root.clone(), "a".repeat(32), "device")
            .await
            .unwrap();
        assert!(
            import_inner(&l, &"b".repeat(32), "a.mp4", Body::from("123"))
                .await
                .is_err()
        );
        assert!(
            import_inner(&l, &"a".repeat(32), "../a.mp4", Body::from("123"))
                .await
                .is_err()
        );
        let catalog = import_inner(&l, &"a".repeat(32), "cartoon.mp4", Body::from("12345"))
            .await
            .unwrap();
        assert_eq!(catalog.items.len(), 1);
        assert_eq!(catalog.items[0].size, 5);
        let reopened = Library::new(root.clone(), "a".repeat(32), "device")
            .await
            .unwrap();
        assert_eq!(reopened.catalog().await.unwrap().items.len(), 1);
        fs::remove_dir_all(root).await.unwrap();
    }
    #[tokio::test]
    async fn http_upload_range_head_delete_and_preflight() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let l = Library::new(root.clone(), "c".repeat(32), "device")
            .await
            .unwrap();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let origin = format!("http://{}", listener.local_addr().unwrap());
        let base = format!("{origin}{}", l.endpoint());
        let task = tokio::spawn(async move { axum::serve(listener, l.routes()).await.unwrap() });
        let client = reqwest::Client::new();
        assert_eq!(
            client
                .get(format!("{origin}/offline-media/{}", "x".repeat(32)))
                .send()
                .await
                .unwrap()
                .status(),
            StatusCode::NOT_FOUND
        );
        let upload = client
            .post(format!("{base}/import?name=test.mp4"))
            .body("0123456789")
            .send()
            .await
            .unwrap();
        assert_eq!(upload.status(), StatusCode::OK);
        let catalog: serde_json::Value = upload.json().await.unwrap();
        let url = format!("{origin}{}", catalog["items"][0]["url"].as_str().unwrap());
        let range = client
            .get(&url)
            .header("Range", "bytes=2-5")
            .send()
            .await
            .unwrap();
        assert_eq!(range.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(range.headers()["content-range"], "bytes 2-5/10");
        assert_eq!(range.bytes().await.unwrap(), "2345");
        let invalid = client
            .get(&url)
            .header("Range", "bytes=20-")
            .send()
            .await
            .unwrap();
        assert_eq!(invalid.status(), StatusCode::RANGE_NOT_SATISFIABLE);
        assert_eq!(invalid.headers()["content-range"], "bytes */10");
        let head = client.head(&url).send().await.unwrap();
        assert_eq!(head.headers()["content-length"], "10");
        assert!(head.bytes().await.unwrap().is_empty());
        let options = client
            .request(reqwest::Method::OPTIONS, &url)
            .send()
            .await
            .unwrap();
        assert_eq!(options.status(), StatusCode::NO_CONTENT);
        let unauthorized_url = url.replace(&"c".repeat(32), &"x".repeat(32));
        assert_eq!(
            client
                .delete(&unauthorized_url)
                .send()
                .await
                .unwrap()
                .status(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            client.get(&url).send().await.unwrap().status(),
            StatusCode::OK,
            "a rejected delete must preserve the media"
        );
        assert_eq!(
            client.delete(&url).send().await.unwrap().status(),
            StatusCode::OK
        );
        assert_eq!(
            client.get(&url).send().await.unwrap().status(),
            StatusCode::NOT_FOUND
        );
        task.abort();
        fs::remove_dir_all(root).await.unwrap();
    }

    #[tokio::test]
    async fn http_source_delete_authenticates_and_keeps_linked_original() {
        let base = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = base.join("originals");
        fs::create_dir_all(&originals).await.unwrap();
        let original = originals.join("movie.mp4");
        fs::write(&original, b"original video").await.unwrap();
        let token = "s".repeat(32);
        let library = Library::new(base.join("state"), token.clone(), "device")
            .await
            .unwrap();
        library.link_paths(vec![originals], true).await.unwrap();
        let source_id = library.catalog().await.unwrap().sources[0].id.clone();
        let routes = library.clone().routes();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let origin = format!("http://{}", listener.local_addr().unwrap());
        let server = tokio::spawn(async move { axum::serve(listener, routes).await.unwrap() });
        let client = reqwest::Client::new();
        assert_eq!(
            client
                .delete(format!(
                    "{origin}/offline-media/{}/sources/{source_id}",
                    "x".repeat(32)
                ))
                .send()
                .await
                .unwrap()
                .status(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(library.catalog().await.unwrap().items.len(), 1);
        assert_eq!(
            client
                .delete(format!(
                    "{origin}/offline-media/{token}/sources/{source_id}"
                ))
                .send()
                .await
                .unwrap()
                .status(),
            StatusCode::OK
        );
        let after = library.catalog().await.unwrap();
        assert!(after.sources.is_empty());
        assert!(after.items.is_empty());
        assert_eq!(fs::read(original).await.unwrap(), b"original video");
        server.abort();
        fs::remove_dir_all(base).await.unwrap();
    }

    #[tokio::test]
    async fn media_body_reads_on_demand_and_rejects_old_reads_after_standby() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let background = crate::background_work::BackgroundWork::default();
        let library = Library::new(root.clone(), "b".repeat(32), "device")
            .await
            .unwrap()
            .with_background(background.clone());
        let payload = vec![b'a'; 128 * 1024];
        let catalog = import_inner(&library, &library.token, "movie.mp4", Body::from(payload))
            .await
            .unwrap();
        let id = catalog.items[0].id.clone();
        let response = media(
            State(library.clone()),
            Path((library.token.clone(), id.clone())),
            HeaderMap::new(),
            Method::GET,
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()["content-length"], "131072");
        let mut body = response.into_body().into_data_stream();
        assert_eq!(body.next().await.unwrap().unwrap(), vec![b'a'; 64 * 1024]);
        // Changing the unread half proves the stream has not prefetched it.
        let path = library
            .path(&library.record(&id).await.unwrap())
            .await
            .unwrap();
        fs::write(&path, vec![b'b'; 128 * 1024]).await.unwrap();
        assert_eq!(body.next().await.unwrap().unwrap(), vec![b'b'; 64 * 1024]);
        assert!(body.next().await.is_none());
        drop(body);
        wait_for_drain(&background).await;

        let response = media(
            State(library.clone()),
            Path((library.token.clone(), id.clone())),
            HeaderMap::new(),
            Method::GET,
        )
        .await;
        let mut body = response.into_body().into_data_stream();
        assert_eq!(body.next().await.unwrap().unwrap().len(), 64 * 1024);
        background.set_standby(true);
        background.set_standby(false);
        assert!(body.next().await.unwrap().is_err());
        drop(body);
        wait_for_drain(&background).await;
        assert!(!background.status().standby);

        let response = media(
            State(library.clone()),
            Path((library.token.clone(), id)),
            HeaderMap::new(),
            Method::GET,
        )
        .await;
        let mut body = response.into_body().into_data_stream();
        assert_eq!(body.next().await.unwrap().unwrap().len(), 64 * 1024);
        assert_eq!(background.status().pending, 1);
        drop(body); // A disconnected consumer must release the idle stream.
        wait_for_drain(&background).await;
        fs::remove_dir_all(root).await.unwrap();
    }
    #[tokio::test]
    async fn cancelled_upload_removes_partial_file() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let l = Library::new(root.clone(), "d".repeat(32), "device")
            .await
            .unwrap();
        let body = Body::from_stream(
            stream::iter(vec![Ok::<_, std::io::Error>(Bytes::from_static(
                b"partial",
            ))])
            .chain(stream::pending()),
        );
        let task =
            tokio::spawn(async move { import_inner(&l, &"d".repeat(32), "test.mp4", body).await });
        let mut started = false;
        for _ in 0..100 {
            if fs::read_dir(&root)
                .await
                .unwrap()
                .next_entry()
                .await
                .unwrap()
                .is_some()
            {
                started = true;
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        assert!(started);
        task.abort();
        let _ = task.await;
        let mut clean = false;
        for _ in 0..100 {
            if fs::read_dir(&root)
                .await
                .unwrap()
                .next_entry()
                .await
                .unwrap()
                .is_none()
            {
                clean = true;
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        assert!(clean);
        fs::remove_dir_all(root).await.unwrap();
    }
    #[tokio::test]
    async fn rejects_unsafe_tokens_and_path_ids() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        assert!(Library::new(root.clone(), "short".into(), "device")
            .await
            .is_err());
        assert!(Library::new(root.clone(), "a/".repeat(32), "device")
            .await
            .is_err());
        let l = Library::new(root.clone(), "e".repeat(32), "device")
            .await
            .unwrap();
        assert!(l.authorize(&"e".repeat(31)).is_err());
        assert!(l.authorize(&format!("{}x", "e".repeat(32))).is_err());
        let result = media(
            State(l),
            Path(("e".repeat(32), "../private".into())),
            HeaderMap::new(),
            Method::GET,
        )
        .await;
        assert_eq!(result.status(), StatusCode::NOT_FOUND);
        fs::remove_dir_all(root).await.unwrap();
    }

    #[tokio::test]
    async fn request_ids_cannot_escape_library_or_delete_originals() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let outside = root.with_extension("mp4");
        fs::write(&outside, "original outside library")
            .await
            .unwrap();
        let token = "j".repeat(32);
        let library = Library::new(root.clone(), token.clone(), "device")
            .await
            .unwrap();
        let saved = import_inner(&library, &token, "saved.mp4", Body::from("saved media"))
            .await
            .unwrap();
        let saved_id = saved.items[0].id.clone();
        for id in [
            "../outside",
            "..\\outside",
            "/tmp/outside",
            "C:\\outside",
            "%2e%2e%2foutside",
            "0123456789abcdef0123456789abcde/..",
            "gggggggggggggggggggggggggggggggg",
            "",
        ] {
            let response = remove(library.clone(), Path((token.clone(), id.to_owned()))).await;
            assert_eq!(response.status(), StatusCode::NOT_FOUND, "id={id}");
            assert!(library.disconnect_source(id).await.is_err(), "id={id}");
        }
        assert_eq!(
            fs::read(&outside).await.unwrap(),
            b"original outside library"
        );
        assert_eq!(library.catalog().await.unwrap().items[0].id, saved_id);
        fs::remove_dir_all(root).await.unwrap();
        fs::remove_file(outside).await.unwrap();
    }

    #[tokio::test]
    async fn generated_media_boundary_rejects_unvalidated_records_and_keeps_picked_originals() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(root.join("library"), "k".repeat(32), "device")
            .await
            .unwrap();
        let id = "a".repeat(32);
        let managed = library.root.join(format!("{id}.mp4"));
        fs::write(&managed, b"managed").await.unwrap();
        let original = root.join("outside.mp4");
        fs::write(&original, b"picked original").await.unwrap();
        let original = fs::canonicalize(original).await.unwrap();
        let good = Record {
            id: id.clone(),
            name: "movie.mp4".into(),
            size: 7,
            mime: "video/mp4".into(),
            extension: "mp4".into(),
            linked_path: None,
            source_id: None,
        };
        assert_eq!(library.path(&good).await.unwrap(), managed);
        // These direct callers deliberately bypass read_record/read_records,
        // proving the generated-file boundary validates its own input.
        for bad_id in [
            "../outside".into(),
            "..\\outside".into(),
            original.to_string_lossy().into_owned(),
            "a".repeat(31),
        ] {
            let mut bad = good.clone();
            bad.id = bad_id;
            assert!(library.path(&bad).await.is_err());
        }
        for bad_extension in ["../mp4", "mp4/../../outside", "..\\mp4", "", "json"] {
            let mut bad = good.clone();
            bad.extension = bad_extension.into();
            assert!(library.path(&bad).await.is_err());
        }
        let mut bad_mime = good.clone();
        bad_mime.mime = "text/plain".into();
        assert!(library.path(&bad_mime).await.is_err());
        let mut picked = good;
        picked.linked_path = Some(original.clone());
        let work = library.background.enter().unwrap();
        assert_eq!(
            owned_read(&work, |owner| async move {
                library.read_path(&picked, Some(&owner)).await
            })
            .await
            .unwrap(),
            original
        );
        assert_eq!(fs::read(&original).await.unwrap(), b"picked original");
        assert_eq!(fs::read(&managed).await.unwrap(), b"managed");
        fs::remove_dir_all(root).await.unwrap();
    }

    #[tokio::test]
    async fn malformed_metadata_cannot_introduce_path_components() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(root.clone(), "k".repeat(32), "device")
            .await
            .unwrap();
        for (index, (id, extension)) in [
            ("../outside", "mp4"),
            ("0123456789abcdef0123456789abcdef", "../../outside.mp4"),
            ("0123456789abcdef0123456789abcdef", "mp4/../../outside"),
        ]
        .into_iter()
        .enumerate()
        {
            let record = Record {
                id: id.into(),
                name: "Untrusted metadata".into(),
                size: 1,
                mime: "video/mp4".into(),
                extension: extension.into(),
                linked_path: None,
                source_id: None,
            };
            fs::write(
                root.join(format!("malformed-{index}.json")),
                serde_json::to_vec(&record).unwrap(),
            )
            .await
            .unwrap();
        }
        assert!(library.catalog().await.unwrap().items.is_empty());
        fs::remove_dir_all(root).await.unwrap();
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn incomplete_folder_is_not_advertised_complete_and_remains_refreshable() {
        use std::os::unix::fs::PermissionsExt;
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = root.join("originals");
        let denied = originals.join("denied");
        fs::create_dir_all(&denied).await.unwrap();
        fs::write(originals.join("good.mp4"), b"movie")
            .await
            .unwrap();
        fs::write(denied.join("hidden.mp4"), b"movie")
            .await
            .unwrap();
        fs::set_permissions(&denied, std::fs::Permissions::from_mode(0o000))
            .await
            .unwrap();
        let permission_is_enforced = fs::read_dir(&denied).await.is_err();
        let library = Library::new(root.join("library"), "k".repeat(32), "device")
            .await
            .unwrap();
        library
            .start_link_folder_path_tracked(originals.clone(), library.background.enter().unwrap())
            .await
            .unwrap();
        wait_for_drain(&library.background).await;
        let incomplete = library.catalog().await.unwrap();
        fs::set_permissions(&denied, std::fs::Permissions::from_mode(0o700))
            .await
            .unwrap();
        if permission_is_enforced {
            assert!(!incomplete.scanning);
            assert!(incomplete.scan_error.is_some());
            assert!(incomplete.total.is_none());
            assert!(library
                .scan
                .lock()
                .await
                .source_scans
                .values()
                .all(|state| state.state == "error"));
        }
        let sources = library.source_records().await.unwrap();
        assert_eq!(sources.len(), 1);
        assert_eq!(sources[0].kind, "folder");
        let records = library
            .records(&library.background.enter().unwrap())
            .await
            .unwrap();
        assert!(records.iter().any(|record| record.name == "good.mp4"));
        if permission_is_enforced {
            assert!(!records.iter().any(|record| record.name == "hidden.mp4"));
        }
        library.refresh_sources().await;
        assert!(library.catalog().await.unwrap().scan_error.is_none());
        assert!(library
            .records(&library.background.enter().unwrap())
            .await
            .unwrap()
            .iter()
            .any(|record| record.name == "hidden.mp4"));
        fs::remove_dir_all(root).await.unwrap();
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn unreadable_selected_root_fails_without_creating_source() {
        use std::os::unix::fs::PermissionsExt;
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let originals = root.join("originals");
        fs::create_dir_all(&originals).await.unwrap();
        let library = Library::new(root.join("library"), "k".repeat(32), "device")
            .await
            .unwrap();
        fs::set_permissions(&originals, std::fs::Permissions::from_mode(0o000))
            .await
            .unwrap();
        let permission_is_enforced = fs::read_dir(&originals).await.is_err();
        let result = library.link_paths(vec![originals.clone()], true).await;
        fs::set_permissions(&originals, std::fs::Permissions::from_mode(0o700))
            .await
            .unwrap();
        if permission_is_enforced {
            assert!(result.is_err());
            assert!(library.source_records().await.unwrap().is_empty());
        }
        fs::remove_dir_all(root).await.unwrap();
    }

    #[tokio::test]
    async fn server_cannot_link_a_filesystem_source() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let library = Library::new(root.clone(), "l".repeat(32), "server")
            .await
            .unwrap();
        assert!(library.link_paths(vec![root.clone()], true).await.is_err());
        assert!(!library.catalog().await.unwrap().direct_sources);
        assert!(library.catalog().await.unwrap().items.is_empty());
        fs::remove_dir_all(root).await.unwrap();
    }
    #[cfg(unix)]
    #[tokio::test]
    async fn never_serves_symlinked_media_or_metadata() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let outside = root.with_extension("private");
        let l = Library::new(root.clone(), "f".repeat(32), "device")
            .await
            .unwrap();
        let catalog = import_inner(&l, &"f".repeat(32), "movie.mp4", Body::from("movie"))
            .await
            .unwrap();
        let id = catalog.items[0].id.clone();
        let path = root.join(format!("{id}.mp4"));
        fs::write(&outside, "private data").await.unwrap();
        fs::remove_file(&path).await.unwrap();
        std::os::unix::fs::symlink(&outside, &path).unwrap();
        assert!(l.catalog().await.unwrap().items.is_empty());
        let result = media(
            State(l.clone()),
            Path(("f".repeat(32), id.clone())),
            HeaderMap::new(),
            Method::GET,
        )
        .await;
        assert_eq!(result.status(), StatusCode::NOT_FOUND);
        fs::remove_file(&path).await.unwrap();
        fs::write(&path, "movie").await.unwrap();
        let metadata = root.join(format!("{id}.json"));
        let saved = fs::read(&metadata).await.unwrap();
        fs::write(&outside, saved).await.unwrap();
        fs::remove_file(&metadata).await.unwrap();
        std::os::unix::fs::symlink(&outside, &metadata).unwrap();
        assert!(l.catalog().await.unwrap().items.is_empty());
        fs::remove_dir_all(root).await.unwrap();
        fs::remove_file(outside).await.unwrap();
    }
}
