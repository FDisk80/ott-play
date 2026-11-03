//! Instance-owned torrent leases with bounded, selected-piece storage.
use super::storage::{CacheOwner, Reservation, WindowFactory, WindowInner};
use axum::body::Bytes;
use librqbit::storage::StorageFactoryExt;
use librqbit::{
    AddTorrent, AddTorrentOptions, AddTorrentResponse, ManagedTorrent, Session, SessionOptions,
};
use serde::Serialize;
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{atomic::AtomicU64, Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncSeek, AsyncSeekExt},
    sync::{watch, Semaphore},
};
use tokio_util::sync::CancellationToken;

pub const MAX_SESSIONS: usize = 2;
pub const CACHE_LIMIT: u64 = 2 * 1024 * 1024 * 1024;
enum Source {
    Url(String),
    Metainfo(Vec<u8>),
}
async fn resolve_source(source: Source) -> Result<(Source, bool), &'static str> {
    let source = match source {
        Source::Url(url) if !url.starts_with("magnet:") => {
            Source::Metainfo(super::source::fetch(&url).await?)
        }
        source => source,
    };
    let private = match &source {
        Source::Metainfo(bytes) => {
            super::source::validate_metainfo(bytes)?;
            librqbit::torrent_from_bytes(bytes)
                .map_err(|_| "invalid_metadata")?
                .info
                .data
                .private
        }
        Source::Url(_) => false,
    };
    Ok((source, private))
}
fn session_options(token: CancellationToken, private: bool) -> SessionOptions {
    SessionOptions {
        cancellation_token: Some(token),
        persistence: None,
        dht: if private {
            None
        } else {
            Some(librqbit::DhtSessionConfig {
                persistence: None,
                ..Default::default()
            })
        },
        listen: None,
        disable_local_service_discovery: true,
        peer_limit: Some(16),
        concurrent_init_limit: Some(1),
        runtime_worker_threads: Some(2),
        ..Default::default()
    }
}
#[cfg(test)]
mod private_policy_tests {
    use super::*;

    #[tokio::test]
    async fn private_metainfo_never_constructs_public_discovery() {
        let bytes = b"d8:announce28:http://127.0.0.1:90/announce4:infod6:lengthi1e4:name1:x12:piece lengthi1e6:pieces20:000000000000000000007:privatei1eee".to_vec();
        let (_, private) = resolve_source(Source::Metainfo(bytes)).await.unwrap();
        assert!(private);
        let options = session_options(CancellationToken::new(), private);
        assert!(options.dht.is_none());
        assert!(
            !options.disable_trackers,
            "Private torrents still use their declared tracker"
        );
        assert!(options.listen.is_none());
        assert!(options.disable_local_service_discovery);
    }

    #[tokio::test]
    async fn unresolved_magnets_keep_discovery_and_bad_metadata_fails_before_engine() {
        for magnet in [
            "magnet:?xt=urn:btih:0123456789012345678901234567890123456789",
            "magnet:?xt=urn:btih:0123456789012345678901234567890123456789&tr=http%3A%2F%2F127.0.0.1%3A90%2Fannounce",
        ] {
            let (_, private) = resolve_source(Source::Url(magnet.into())).await.unwrap();
            assert!(!private, "a magnet does not carry the metainfo private flag");
            assert!(session_options(CancellationToken::new(), private)
                .dht
                .is_some(), "a declared tracker does not disable magnet DHT discovery");
        }
        assert!(resolve_source(Source::Metainfo(b"not metainfo".to_vec()))
            .await
            .is_err());
    }
}
const MAX_FILES: usize = 4096;
const METADATA_LIMIT: usize = 1024 * 1024;
const IDLE: Duration = Duration::from_secs(120);
trait SeekReader: AsyncRead + AsyncSeek + Send + Unpin {}
impl<T: AsyncRead + AsyncSeek + Send + Unpin> SeekReader for T {}
pub(super) fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

#[derive(Clone, Serialize)]
pub struct MediaFile {
    pub index: usize,
    pub name: String,
    pub length: u64,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct View {
    pub id: String,
    pub state: &'static str,
    pub files: Vec<MediaFile>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selected: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub downloaded: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<&'static str>,
}
struct LeaseData {
    view: View,
    handle: Option<Arc<ManagedTorrent>>,
    webseed: Option<Arc<super::webseed::WebSeed>>,
}
pub struct Lease {
    data: Mutex<LeaseData>,
    pub cancel: CancellationToken,
    select: watch::Sender<Option<usize>>,
    touched: Mutex<Instant>,
    created: Instant,
    done: watch::Sender<bool>,
}
impl Lease {
    pub fn view(&self) -> View {
        *lock(&self.touched) = Instant::now();
        let data = lock(&self.data);
        let mut view = data.view.clone();
        if let (Some(handle), Some(index)) = (&data.handle, view.selected) {
            let stats = handle.stats();
            view.downloaded = stats
                .file_progress
                .get(index)
                .copied()
                .map(|v| v.min(view.total.unwrap_or(v)));
            if stats.error.is_some() && data.webseed.is_none() {
                view.state = "error";
                view.error = Some("torrent_failed");
                view.stream_path = None;
            }
        }
        if let Some(webseed) = &data.webseed {
            view.downloaded = Some(view.downloaded.unwrap_or(0).max(webseed.downloaded()));
        }
        view
    }
    pub fn choose(&self, index: usize) -> Result<View, &'static str> {
        let data = lock(&self.data);
        if self.cancel.is_cancelled() {
            return Err("session_stopped");
        }
        if data.view.state == "ready" && data.view.selected == Some(index) {
            drop(data);
            return Ok(self.view());
        }
        if data.view.state != "select" {
            return Err("session_busy");
        }
        if !data
            .view
            .files
            .iter()
            .any(|file| file.index == index && file.length > 0)
        {
            return Err("invalid_file");
        }
        if self.select.borrow().is_some() {
            return Err("session_busy");
        }
        self.select.send_replace(Some(index));
        drop(data);
        Ok(self.view())
    }
    fn fail(&self, code: &'static str) {
        let mut data = lock(&self.data);
        data.view.state = "error";
        data.view.error = Some(code);
        data.view.stream_path = None;
        data.handle = None;
    }
    fn stream_failed(&self, code: &'static str) {
        if self.cancel.is_cancelled() {
            return;
        }
        let mut data = lock(&self.data);
        data.view.state = "error";
        data.view.error = Some(code);
        data.view.stream_path = None;
    }
    pub async fn stop(&self) -> bool {
        self.cancel.cancel();
        let mut done = self.done.subscribe();
        let _ = tokio::time::timeout(Duration::from_secs(5), async {
            while !*done.borrow_and_update() {
                if done.changed().await.is_err() {
                    break;
                }
            }
        })
        .await;
        *self.done.borrow()
    }
    fn expired(&self) -> bool {
        lock(&self.touched).elapsed() > IDLE || self.created.elapsed() > Duration::from_secs(21600)
    }
}
pub struct TorrentManager {
    owner: Mutex<Option<Arc<CacheOwner>>>,
    root: PathBuf,
    sessions: Mutex<HashMap<String, Arc<Lease>>>,
    pub(super) reserved: Arc<AtomicU64>,
    pub cancel: CancellationToken,
    streams: Arc<Semaphore>,
    limits: super::ResourceLimits,
    #[cfg(test)]
    pub initial_peers: Mutex<Vec<std::net::SocketAddr>>,
}
impl TorrentManager {
    pub async fn new(
        root: PathBuf,
        cancel: CancellationToken,
        limits: super::ResourceLimits,
    ) -> anyhow::Result<Arc<Self>> {
        let owner = super::storage::prepare_root(&root).await?;
        let manager = Arc::new(Self {
            owner: Mutex::new(Some(owner)),
            root,
            sessions: Mutex::new(HashMap::new()),
            reserved: Arc::new(AtomicU64::new(0)),
            cancel,
            streams: Arc::new(Semaphore::new(limits.max_streams)),
            limits,
            #[cfg(test)]
            initial_peers: Mutex::new(Vec::new()),
        });
        let weak = Arc::downgrade(&manager);
        let cancelled = manager.cancel.clone();
        tokio::spawn(async move {
            loop {
                tokio::select! { _ = cancelled.cancelled() => break, _ = tokio::time::sleep(Duration::from_secs(5)) => {} }
                let Some(manager) = weak.upgrade() else {
                    break;
                };
                let expired: Vec<_> = lock(&manager.sessions)
                    .iter()
                    .filter(|(_, lease)| lease.expired())
                    .map(|(id, _)| id.clone())
                    .collect();
                for id in expired {
                    manager.remove(&id).await;
                }
            }
        });
        Ok(manager)
    }
    pub fn create(
        self: &Arc<Self>,
        source: String,
        selected: Option<usize>,
    ) -> Result<View, &'static str> {
        super::source::validate(&source)?;
        self.create_source(Source::Url(source), selected)
    }
    pub fn create_metainfo(
        self: &Arc<Self>,
        bytes: Vec<u8>,
        selected: Option<usize>,
    ) -> Result<View, &'static str> {
        super::source::validate_metainfo(&bytes)?;
        self.create_source(Source::Metainfo(bytes), selected)
    }
    fn create_source(
        self: &Arc<Self>,
        source: Source,
        selected: Option<usize>,
    ) -> Result<View, &'static str> {
        if self.cancel.is_cancelled() {
            return Err("service_stopped");
        }
        let id = uuid::Uuid::new_v4().simple().to_string();
        let (select, _) = watch::channel(selected);
        let (done, _) = watch::channel(false);
        let view = View {
            id: id.clone(),
            state: "metadata",
            files: vec![],
            selected: None,
            stream_path: None,
            downloaded: None,
            total: None,
            error: None,
        };
        let lease = Arc::new(Lease {
            data: Mutex::new(LeaseData {
                view: view.clone(),
                handle: None,
                webseed: None,
            }),
            cancel: self.cancel.child_token(),
            select,
            touched: Mutex::new(Instant::now()),
            created: Instant::now(),
            done,
        });
        {
            let mut sessions = lock(&self.sessions);
            if self.cancel.is_cancelled() {
                return Err("service_stopped");
            }
            if sessions.len() >= self.limits.max_sessions {
                return Err("session_limit");
            }
            sessions.insert(id, lease.clone());
        }
        let manager = self.clone();
        tokio::spawn(async move {
            manager.run(lease.clone(), source).await;
            lease.done.send_replace(true);
        });
        Ok(view)
    }
    pub fn get(&self, id: &str) -> Option<Arc<Lease>> {
        lock(&self.sessions).get(id).cloned()
    }
    pub async fn remove(&self, id: &str) -> bool {
        let lease = self.get(id);
        if let Some(lease) = lease {
            if !lease.stop().await {
                return false;
            }
            let mut sessions = lock(&self.sessions);
            if sessions
                .get(id)
                .is_some_and(|current| Arc::ptr_eq(current, &lease))
            {
                sessions.remove(id);
            }
            true
        } else {
            false
        }
    }
    pub async fn shutdown(&self) {
        self.cancel.cancel();
        let leases: Vec<_> = lock(&self.sessions)
            .drain()
            .map(|(_, lease)| lease)
            .collect();
        futures_util::future::join_all(leases.iter().map(|lease| lease.stop())).await;
        // Router clones may outlive graceful HTTP shutdown; only surviving
        // storage workers need to retain the exclusive disk ownership now.
        lock(&self.owner).take();
    }
    async fn run(self: Arc<Self>, lease: Arc<Lease>, source: Source) {
        let token = lease.cancel.clone();
        // Read the private bit BEFORE constructing the engine: constructing a
        // DHT session already starts public bootstrap traffic even if adding a
        // private torrent would later suppress its lookups.
        let (source, private) = tokio::select! {
            _ = token.cancelled() => return,
            result = tokio::time::timeout(Duration::from_secs(45), resolve_source(source)) => match result {
                Ok(Ok(source)) => source,
                Ok(Err(code)) => { lease.fail(code); return; },
                Err(_) => { lease.fail("metadata_timeout"); return; },
            }
        };
        #[allow(unused_mut)]
        let mut options = session_options(token.clone(), private);
        #[cfg(test)]
        {
            options.dht = None;
            options.disable_trackers = true;
        }
        // No incoming TCP listener, UPnP or service discovery is enabled.
        let engine = tokio::select! {
            _ = token.cancelled() => return,
            result = Session::new_with_opts(self.root.clone(), options) => match result { Ok(v) => v, Err(_) => { lease.fail("engine_unavailable"); return; } }
        };
        let result = tokio::select! { _ = token.cancelled() => Err("session_stopped"), result = self.prepare(&lease, &engine, source) => result };
        if let Err(code) = result {
            if !token.is_cancelled() {
                lease.fail(code);
            }
        } else {
            token.cancelled().await;
        }
        token.cancel();
        // Storage checks the same token under its I/O lock. Even a library task
        // finishing after stop cannot publish more bytes into a retired lease.
        engine.stop().await;
        lock(&lease.data).handle = None;
    }
    async fn prepare(
        &self,
        lease: &Arc<Lease>,
        engine: &Arc<Session>,
        source: Source,
    ) -> Result<(), &'static str> {
        let list = async {
            let add = match source {
                Source::Metainfo(bytes) => AddTorrent::from_bytes(bytes),
                Source::Url(source) if source.starts_with("magnet:") => {
                    AddTorrent::from_url(source)
                }
                Source::Url(_) => return Err("invalid_source"),
            };
            #[allow(unused_mut)]
            let mut options = AddTorrentOptions {
                list_only: true,
                peer_limit: Some(16),
                ..Default::default()
            };
            #[cfg(test)]
            {
                options.initial_peers = Some(lock(&self.initial_peers).clone());
            }
            match engine
                .add_torrent(add, Some(options))
                .await
                .map_err(|_| "metadata_failed")?
            {
                AddTorrentResponse::ListOnly(list) => Ok(list),
                _ => Err("metadata_failed"),
            }
        };
        let list = tokio::time::timeout(Duration::from_secs(45), list)
            .await
            .map_err(|_| "metadata_timeout")??;
        if list.torrent_bytes.len() > METADATA_LIMIT {
            return Err("metadata_limit");
        }
        super::source::validate_metainfo(&list.torrent_bytes)?;
        let mut files = Vec::new();
        let mut total = 0u64;
        for (index, file) in list.info.iter_file_details().enumerate() {
            if index >= MAX_FILES {
                return Err("file_limit");
            }
            let name = file
                .filename
                .to_pathbuf()
                .to_string_lossy()
                .replace('\\', "/");
            if name.len() > 1024 || name.chars().any(char::is_control) {
                return Err("invalid_metadata");
            }
            total = total.checked_add(file.len).ok_or("metadata_limit")?;
            files.push(MediaFile {
                index,
                name,
                length: file.len,
            });
        }
        if files.is_empty() || total == 0 {
            return Err("no_files");
        }
        {
            let mut data = lock(&lease.data);
            data.view.files = files.clone();
            data.view.state = "select";
        }
        let mut receiver = lease.select.subscribe();
        let index = loop {
            if let Some(index) = *receiver.borrow_and_update() {
                break index;
            }
            receiver.changed().await.map_err(|_| "session_stopped")?;
        };
        let file = files
            .get(index)
            .filter(|f| f.length > 0)
            .ok_or("invalid_file")?;
        // Optional seed URLs/paths must not make a valid P2P torrent unusable.
        let webseed = super::webseed::WebSeed::from_metainfo(&list.torrent_bytes, index)
            .ok()
            .flatten();
        let piece = u64::from(list.info.lengths().default_piece_length());
        if piece == 0 || piece > 16 * 1024 * 1024 {
            return Err("metadata_limit");
        }
        let offset = files[..index]
            .iter()
            .try_fold(0u64, |a, f| a.checked_add(f.length))
            .ok_or("metadata_limit")?;
        let start = offset / piece * piece;
        let end = (offset + file.length)
            .div_ceil(piece)
            .checked_mul(piece)
            .ok_or("metadata_limit")?
            .min(total);
        let reservation =
            Reservation::with_limit(self.reserved.clone(), end - start, self.limits.cache_bytes)?;
        let path = self
            .root
            .join(format!("lease-{}.bin", lock(&lease.data).view.id));
        let store = Arc::new(WindowInner::new(
            path,
            reservation,
            lease.cancel.clone(),
            start,
            end,
            &files,
            Some(lock(&self.owner).clone().ok_or("session_stopped")?),
        )?);
        {
            let mut data = lock(&lease.data);
            data.view.selected = Some(index);
            data.view.total = Some(file.length);
            data.view.state = "preparing";
        }
        let mut options = AddTorrentOptions {
            only_files: Some(vec![index]),
            storage_factory: Some(WindowFactory(store).boxed()),
            peer_limit: Some(16),
            overwrite: false,
            ..Default::default()
        };
        options.initial_peers = Some(list.seen_peers);
        #[cfg(test)]
        {
            options
                .initial_peers
                .as_mut()
                .unwrap()
                .extend(lock(&self.initial_peers).iter().copied());
        }
        let setup = async {
            let handle = engine
                .add_torrent(
                    AddTorrent::TorrentFileBytes(list.torrent_bytes),
                    Some(options),
                )
                .await
                .map_err(|_| "torrent_failed")?
                .into_handle()
                .ok_or("torrent_failed")?;
            tokio::time::timeout(Duration::from_secs(30), handle.wait_until_initialized())
                .await
                .map_err(|_| "initialization_timeout")?
                .map_err(|_| "torrent_failed")?;
            Ok::<_, &'static str>(handle)
        }
        .await;
        let handle = match setup {
            Ok(handle) => Some(handle),
            Err(_) if webseed.is_some() => {
                webseed
                    .as_ref()
                    .unwrap()
                    .active
                    .store(true, std::sync::atomic::Ordering::Relaxed);
                None
            }
            Err(code) => return Err(code),
        };
        if lease.cancel.is_cancelled() {
            return Err("session_stopped");
        }
        let mut data = lock(&lease.data);
        data.view.state = "ready";
        data.view.stream_path = Some(format!("sessions/{}/stream", data.view.id));
        data.view.downloaded = Some(0);
        data.handle = handle;
        data.webseed = webseed;
        Ok(())
    }
    pub async fn stream(
        &self,
        lease: Arc<Lease>,
        start: u64,
        length: u64,
    ) -> Result<axum::body::Body, &'static str> {
        let permit = self
            .streams
            .clone()
            .try_acquire_owned()
            .map_err(|_| "stream_limit")?;
        let (handle, selected, webseed) = {
            let data = lock(&lease.data);
            (
                data.handle.clone(),
                data.view.selected.ok_or("session_busy")?,
                data.webseed.clone(),
            )
        };
        let setup = async {
            let handle = handle.ok_or("torrent_failed")?;
            let mut file = tokio::time::timeout(
                Duration::from_secs(if webseed.is_some() { 2 } else { 15 }),
                handle.stream(selected),
            )
            .await
            .map_err(|_| "stream_timeout")?
            .map_err(|_| "torrent_failed")?;
            file.seek(std::io::SeekFrom::Start(start))
                .await
                .map_err(|_| "range_failed")?;
            Ok::<_, &'static str>(file)
        };
        let reader: Box<dyn SeekReader> = tokio::select! {
            _ = lease.cancel.cancelled() => return Err("session_stopped"),
            result = setup => match result {
                Ok(file) => Box::new(file),
                Err(_) if webseed.is_some() => {
                    webseed.as_ref().unwrap().active.store(true, std::sync::atomic::Ordering::Relaxed);
                    Box::new(std::io::Cursor::new(Vec::<u8>::new()))
                }
                Err(code) => { lease.stream_failed(code); return Err(code); }
            }
        };
        let stream = futures_util::stream::unfold(
            (reader, start, length, lease, permit, webseed),
            |(mut reader, position, left, lease, permit, webseed)| async move {
                if left == 0 || lease.cancel.is_cancelled() {
                    return None;
                }
                let size = left.min(64 * 1024) as usize;
                let active = webseed
                    .as_ref()
                    .is_some_and(|seed| seed.active.load(std::sync::atomic::Ordering::Relaxed));
                let result = {
                    // Keep a healthy but slower swarm alive when an optional web
                    // seed fails. Both routes share one bounded read deadline.
                    let peer = async {
                        reader
                            .seek(std::io::SeekFrom::Start(position))
                            .await
                            .map_err(|_| "range_failed")?;
                        let mut bytes = vec![0u8; size];
                        let n = reader
                            .read(&mut bytes)
                            .await
                            .map_err(|_| "torrent_failed")?;
                        if n == 0 {
                            return Err("stream_timeout");
                        }
                        bytes.truncate(n);
                        Ok(bytes)
                    };
                    let mirror = async {
                        let Some(seed) = &webseed else {
                            return std::future::pending().await;
                        };
                        if !active {
                            tokio::time::sleep(Duration::from_secs(2)).await;
                        }
                        let bytes = seed.read(position, size, &lease.cancel).await?;
                        seed.active
                            .store(true, std::sync::atomic::Ordering::Relaxed);
                        Ok(bytes)
                    };
                    let race = first_stream_success(peer, mirror, webseed.is_some());
                    tokio::select! {
                        _ = lease.cancel.cancelled() => return None,
                        result = tokio::time::timeout(Duration::from_secs(30), race) => result.unwrap_or(Err("stream_timeout")),
                    }
                };
                let bytes = match result {
                    Ok(bytes) => bytes,
                    Err(code) => {
                        if lease.cancel.is_cancelled() {
                            return None;
                        }
                        lease.stream_failed(code);
                        return Some((
                            Err(std::io::Error::other(code)),
                            (reader, position, 0, lease, permit, webseed),
                        ));
                    }
                };
                let n = bytes.len() as u64;
                *lock(&lease.touched) = Instant::now();
                Some((
                    Ok(Bytes::from(bytes)),
                    (reader, position + n, left - n, lease, permit, webseed),
                ))
            },
        );
        Ok(axum::body::Body::from_stream(stream))
    }
}

async fn first_stream_success<A, B>(
    peer: A,
    mirror: B,
    has_mirror: bool,
) -> Result<Vec<u8>, &'static str>
where
    A: std::future::Future<Output = Result<Vec<u8>, &'static str>>,
    B: std::future::Future<Output = Result<Vec<u8>, &'static str>>,
{
    tokio::pin!(peer, mirror);
    tokio::select! {
        result = &mut peer => match result {
            Ok(bytes) => Ok(bytes),
            Err(_) if has_mirror => mirror.await,
            Err(code) => Err(code),
        },
        result = &mut mirror => match result {
            Ok(bytes) => Ok(bytes),
            Err(code) => peer.await.or(Err(code)),
        },
    }
}

#[cfg(test)]
mod webseed_fallback_tests {
    use super::*;

    #[tokio::test]
    async fn an_unavailable_webseed_does_not_poison_a_healthy_slower_swarm() {
        let peer = async {
            tokio::task::yield_now().await;
            Ok(vec![1, 2, 3])
        };
        assert_eq!(
            first_stream_success(peer, async { Err("webseed_hash_mismatch") }, true)
                .await
                .unwrap(),
            vec![1, 2, 3]
        );
        assert_eq!(
            first_stream_success(
                async { Err("torrent_failed") },
                async { Ok(vec![4, 5]) },
                true
            )
            .await
            .unwrap(),
            vec![4, 5]
        );
        assert_eq!(
            first_stream_success(
                async { Err("torrent_failed") },
                async { Err("webseed_hash_mismatch") },
                true
            )
            .await
            .unwrap_err(),
            "webseed_hash_mismatch"
        );
    }

    #[tokio::test]
    async fn stream_errors_persist_but_cancelled_leases_do_not_report_spurious_failures() {
        let (select, _) = watch::channel(None);
        let (done, _) = watch::channel(false);
        let lease = Lease {
            data: Mutex::new(LeaseData {
                view: View {
                    id: "fixture".into(),
                    state: "ready",
                    files: vec![],
                    selected: None,
                    stream_path: Some("stream".into()),
                    downloaded: Some(0),
                    total: Some(10),
                    error: None,
                },
                handle: None,
                webseed: None,
            }),
            cancel: CancellationToken::new(),
            select,
            touched: Mutex::new(Instant::now()),
            created: Instant::now(),
            done,
        };
        lease.stream_failed("webseed_hash_mismatch");
        assert_eq!(lease.view().state, "error");
        assert_eq!(lease.view().error, Some("webseed_hash_mismatch"));
        assert!(lease.view().stream_path.is_none());
        lease.cancel.cancel();
        lease.stream_failed("stream_timeout");
        assert_eq!(lease.view().error, Some("webseed_hash_mismatch"));
    }
}
