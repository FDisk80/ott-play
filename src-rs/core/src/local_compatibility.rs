//! Bounded instance-owned local VOD compatibility. No services or downloads.
use crate::background_work::WorkLease;
use serde::Deserialize;
use serde::Serialize;
use std::{
    collections::HashMap,
    net::{Ipv4Addr, SocketAddr},
    path::PathBuf,
    process::Stdio,
    sync::{Arc, LazyLock, Mutex},
    time::{Duration, Instant},
};
use tokio::{
    io::AsyncReadExt,
    process::Command,
    sync::{watch, Mutex as AsyncMutex, Semaphore},
};
const MAX_DURATION: f64 = 43_200.0;
const MAX_SEGMENTS: usize = 16_384;
const MAX_METADATA: usize = 1024 * 1024;
const MAX_SEGMENT: usize = 8 * 1024 * 1024;
const CACHE_BYTES: usize = 64 * 1024 * 1024;
const MAX_LEASES: usize = 16;
const IDLE: Duration = Duration::from_secs(300);
const DEADLINE: Duration = Duration::from_secs(30);
static PROCESSES: LazyLock<Arc<Semaphore>> = LazyLock::new(|| Arc::new(Semaphore::new(2)));
static REQUESTS: LazyLock<Arc<Semaphore>> = LazyLock::new(|| Arc::new(Semaphore::new(8)));
static CACHE: LazyLock<Mutex<Cache>> = LazyLock::new(|| Mutex::new(Cache::default()));
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Error {
    Unavailable,
    Unsupported,
    Busy,
    Cancelled,
    Source,
}
pub(crate) type Result<T> = std::result::Result<T, Error>;
impl Error {
    pub(crate) fn code(self) -> &'static str {
        match self {
            Self::Unavailable => "compatibility_unavailable",
            Self::Unsupported => "unsupported_media",
            Self::Busy => "busy",
            Self::Cancelled => "cancelled",
            Self::Source => "source_unavailable",
        }
    }
    pub(crate) fn message(self) -> &'static str {
        match self {
            Self::Unavailable => "Local compatibility tools are unavailable",
            Self::Unsupported => "Local media cannot be prepared within compatibility limits",
            Self::Busy => "Local compatibility is busy; retry shortly",
            Self::Cancelled => "Local playback was cancelled",
            Self::Source => "Local source is unavailable",
        }
    }
}
fn check(work: &WorkLease) -> Result<()> {
    work.check().map_err(|_| Error::Cancelled)
}
fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}
#[derive(Clone, Serialize)]
pub struct Capability {
    pub available: bool,
    pub formats: [&'static str; 2],
    pub modes: [&'static str; 2],
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<&'static str>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Playback {
    pub mode: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prepare_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<&'static str>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Prepared {
    pub mode: &'static str,
    pub finite: bool,
    pub timeline: &'static str,
    pub time_origin: u8,
    pub duration: f64,
    pub mime: &'static str,
    pub url: String,
    pub cancel_url: String,
    pub lease: String,
}
impl Capability {
    pub(crate) fn new(available: bool) -> Self {
        Self {
            available,
            formats: ["avi", "mkv"],
            modes: ["remux", "transcode"],
            reason: (!available).then_some("tools_unavailable"),
        }
    }
}
impl Playback {
    pub(crate) fn new(base: &str, id: &str, available: bool) -> Self {
        Self {
            mode: if available {
                "compatibility"
            } else {
                "unsupported"
            },
            prepare_url: available.then(|| format!("{base}/compat/{id}/prepare")),
            mime: available.then_some("application/vnd.apple.mpegurl"),
            reason: (!available).then_some("compatibility_unavailable"),
        }
    }
}
pub(crate) struct Tools {
    ffmpeg: PathBuf,
    ffprobe: PathBuf,
}
fn executable(name: &str, variable: &str) -> Option<PathBuf> {
    if let Some(value) = std::env::var_os(variable) {
        let p = PathBuf::from(value);
        return (p.is_absolute() && p.is_file())
            .then(|| std::fs::canonicalize(p).ok())
            .flatten();
    }
    let mut roots: Vec<_> = std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default())
        .filter(|p| p.is_absolute())
        .collect();
    roots.extend(["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"].map(PathBuf::from));
    roots.into_iter().find_map(|root| {
        let p = root.join(if cfg!(windows) {
            format!("{name}.exe")
        } else {
            name.into()
        });
        p.is_file().then(|| std::fs::canonicalize(p).ok()).flatten()
    })
}
pub(crate) async fn discover(work: &WorkLease) -> Option<Tools> {
    let tools = Tools {
        ffmpeg: executable("ffmpeg", "OTT_LOCAL_FFMPEG")?,
        ffprobe: executable("ffprobe", "OTT_LOCAL_FFPROBE")?,
    };
    let (sender, rx) = watch::channel(false);
    for (p, name) in [(&tools.ffmpeg, "ffmpeg"), (&tools.ffprobe, "ffprobe")] {
        let mut cmd = Command::new(p);
        cmd.arg("-version");
        let bytes = capture(cmd, work, rx.clone(), 16_384, Duration::from_secs(3))
            .await
            .ok()?;
        if !bytes.starts_with(format!("{name} version ").as_bytes()) {
            return None;
        }
    }
    drop(sender);
    Some(tools)
}
/// Constructed only after offline_media authorizes and revalidates an opaque record.
pub(crate) struct Input {
    pub id: String,
    pub source_id: String,
    pub fingerprint: String,
    pub extension: String,
    pub size: u64,
}
struct Inner {
    tools: Tools,
    endpoint: PrivateEndpoint,
    client: reqwest::Client,
    leases: Mutex<HashMap<String, Arc<Lease>>>,
    preparing: Mutex<HashMap<String, Preparing>>,
    publication: Mutex<()>,
    #[cfg(test)]
    before_publication: Mutex<Option<Box<dyn FnOnce() + Send>>>,
    bridge: tokio::task::JoinHandle<()>,
}
/// Only the OS-assigned address of our owned IPv4 loopback listener is accepted.
/// No handler can supply a URL, host, scheme, query, or path to the HTTP client.
struct PrivateEndpoint {
    port: u16,
    capability: String,
}
impl PrivateEndpoint {
    fn new(address: SocketAddr, capability: String) -> Result<Self> {
        if address.ip() != std::net::IpAddr::V4(Ipv4Addr::LOCALHOST)
            || address.port() == 0
            || capability.len() != 64
            || !capability.bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err(Error::Unavailable);
        }
        Ok(Self {
            port: address.port(),
            capability,
        })
    }
    fn source(&self, id: &str) -> Result<reqwest::Url> {
        if id.len() != 32 || !id.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(Error::Source);
        }
        let mut url = reqwest::Url::parse("http://127.0.0.1/").expect("constant loopback URL");
        url.set_port(Some(self.port))
            .map_err(|_| Error::Unavailable)?;
        url.set_path(&format!("/_input/{}/{id}", self.capability));
        Ok(url)
    }
}
impl Drop for Inner {
    fn drop(&mut self) {
        for (id, lease) in lock(&self.leases).iter() {
            lease.cancel.send_replace(true);
            lock(&CACHE).remove_prefix(id);
        }
        for request in lock(&self.preparing).values() {
            request.cancel.send_replace(true);
        }
        self.bridge.abort();
    }
}
#[derive(Clone)]
pub(crate) struct Manager(Arc<Inner>);
struct Lease {
    item: String,
    source_id: String,
    fingerprint: String,
    epoch: u64,
    plan: Plan,
    cancel: watch::Sender<bool>,
    touched: Mutex<Instant>,
    gates: Mutex<HashMap<String, Arc<AsyncMutex<()>>>>,
}
#[derive(Clone)]
struct Plan {
    duration: f64,
    starts: Vec<f64>,
    copy: bool,
    audio: usize,
}
struct Preparing {
    item: String,
    source: String,
    cancel: watch::Sender<bool>,
}
struct PrepareGuard {
    inner: Arc<Inner>,
    id: String,
}
impl Drop for PrepareGuard {
    fn drop(&mut self) {
        lock(&self.inner.preparing).remove(&self.id);
    }
}
struct SegmentGate {
    lease: Arc<Lease>,
    key: String,
    gate: Arc<AsyncMutex<()>>,
}
impl SegmentGate {
    fn new(lease: Arc<Lease>, key: String) -> Result<Self> {
        let gate = {
            let mut gates = lock(&lease.gates);
            if gates.len() >= 8 && !gates.contains_key(&key) {
                return Err(Error::Busy);
            }
            gates
                .entry(key.clone())
                .or_insert_with(|| Arc::new(AsyncMutex::new(())))
                .clone()
        };
        Ok(Self { lease, key, gate })
    }
}
impl Drop for SegmentGate {
    fn drop(&mut self) {
        let mut gates = lock(&self.lease.gates);
        if Arc::strong_count(&self.gate) == 2
            && gates
                .get(&self.key)
                .is_some_and(|g| Arc::ptr_eq(g, &self.gate))
        {
            gates.remove(&self.key);
        }
    }
}
impl Manager {
    pub(crate) fn new(
        tools: Tools,
        address: SocketAddr,
        capability: String,
        bridge: tokio::task::JoinHandle<()>,
    ) -> Result<Self> {
        let endpoint = match PrivateEndpoint::new(address, capability) {
            Ok(endpoint) => endpoint,
            Err(e) => {
                bridge.abort();
                return Err(e);
            }
        };
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .no_proxy()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("fixed local HTTP client");
        let manager = Self(Arc::new(Inner {
            tools,
            endpoint,
            client,
            leases: Mutex::new(HashMap::new()),
            preparing: Mutex::new(HashMap::new()),
            publication: Mutex::new(()),
            #[cfg(test)]
            before_publication: Mutex::new(None),
            bridge,
        }));
        let weak = Arc::downgrade(&manager.0);
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(15)).await;
                let Some(inner) = weak.upgrade() else {
                    break;
                };
                Manager(inner).prune();
            }
        });
        Ok(manager)
    }
    fn source(&self, id: &str) -> Result<reqwest::Url> {
        self.0.endpoint.source(id)
    }
    fn prune(&self) {
        let mut leases = lock(&self.0.leases);
        leases.retain(|id, l| {
            let keep = !*l.cancel.borrow() && lock(&l.touched).elapsed() < IDLE;
            if !keep {
                l.cancel.send_replace(true);
                lock(&CACHE).remove_prefix(id);
            }
            keep
        });
    }
    pub(crate) fn cancel(&self, item: &str, id: &str) {
        let mut leases = lock(&self.0.leases);
        if leases.get(id).is_some_and(|l| l.item == item) {
            if let Some(l) = leases.remove(id) {
                l.cancel.send_replace(true);
            }
            lock(&CACHE).remove_prefix(id);
        }
    }
    pub(crate) fn cancel_item(&self, item: &str) {
        let _publication = lock(&self.0.publication);
        for p in lock(&self.0.preparing).values().filter(|p| p.item == item) {
            p.cancel.send_replace(true);
        }
        let ids: Vec<_> = lock(&self.0.leases)
            .iter()
            .filter(|(_, l)| l.item == item)
            .map(|(id, _)| id.clone())
            .collect();
        for id in ids {
            self.cancel(item, &id);
        }
    }
    pub(crate) fn cancel_source(&self, source: &str) {
        let _publication = lock(&self.0.publication);
        for p in lock(&self.0.preparing)
            .values()
            .filter(|p| p.source == source)
        {
            p.cancel.send_replace(true);
        }
        let ids: Vec<_> = lock(&self.0.leases)
            .iter()
            .filter(|(_, l)| l.source_id == source)
            .map(|(id, l)| (l.item.clone(), id.clone()))
            .collect();
        for (item, id) in ids {
            self.cancel(&item, &id);
        }
    }
    fn lease(&self, input: &Input, id: &str, work: &WorkLease) -> Result<Arc<Lease>> {
        self.prune();
        check(work)?;
        let l = lock(&self.0.leases)
            .get(id)
            .cloned()
            .ok_or(Error::Cancelled)?;
        if l.item != input.id
            || l.fingerprint != input.fingerprint
            || l.epoch != work.epoch()
            || *l.cancel.borrow()
        {
            if l.item == input.id {
                self.cancel(&input.id, id);
            }
            return Err(Error::Cancelled);
        }
        *lock(&l.touched) = Instant::now();
        Ok(l)
    }
    pub(crate) async fn prepare(
        &self,
        input: Input,
        base: &str,
        work: &WorkLease,
    ) -> Result<Prepared> {
        tokio::time::timeout(DEADLINE, self.prepare_inner(input, base, work))
            .await
            .map_err(|_| Error::Unsupported)?
    }
    async fn prepare_inner(&self, input: Input, base: &str, work: &WorkLease) -> Result<Prepared> {
        let _request = REQUESTS
            .clone()
            .try_acquire_owned()
            .map_err(|_| Error::Busy)?;
        self.prune();
        if lock(&self.0.leases).len() >= MAX_LEASES {
            return Err(Error::Busy);
        }
        let (sender, cancel) = watch::channel(false);
        let request_id = uuid::Uuid::new_v4().simple().to_string();
        lock(&self.0.preparing).insert(
            request_id.clone(),
            Preparing {
                item: input.id.clone(),
                source: input.source_id.clone(),
                cancel: sender.clone(),
            },
        );
        let _preparing = PrepareGuard {
            inner: self.0.clone(),
            id: request_id,
        };
        let source = self.source(&input.id)?.to_string();
        let mut cmd = Command::new(&self.0.tools.ffprobe);
        cmd.args([
            "-v",
            "error",
            "-rw_timeout",
            "5000000",
            "-protocol_whitelist",
            "http,tcp",
            "-format_whitelist",
            "avi,matroska,webm",
            "-probesize",
            "2097152",
            "-analyzeduration",
            "3000000",
            "-show_entries",
            "format=duration,start_time:stream=codec_type,codec_name,pix_fmt",
            "-of",
            "json",
            &source,
        ]);
        let bytes = capture(cmd, work, cancel, 65_536, DEADLINE).await?;
        let probe: Probe = serde_json::from_slice(&bytes).map_err(|_| Error::Unsupported)?;
        let duration = probe
            .format
            .duration
            .parse::<f64>()
            .map_err(|_| Error::Unsupported)?;
        if !duration.is_finite() || duration <= 0.05 || duration > MAX_DURATION {
            return Err(Error::Unsupported);
        }
        let video = probe
            .streams
            .iter()
            .find(|s| s.codec_type == "video")
            .ok_or(Error::Unsupported)?;
        let audio: Vec<_> = probe
            .streams
            .iter()
            .filter(|s| s.codec_type == "audio")
            .collect();
        if audio.len() > 8 {
            return Err(Error::Unsupported);
        }
        let can_copy = input.extension == "mkv"
            && video.codec_name == "h264"
            && video.pix_fmt == "yuv420p"
            && audio.iter().all(|s| s.codec_name == "aac")
            && probe.format.start_time.parse::<f64>().unwrap_or(0.0).abs() < 0.001;
        let cues = if can_copy {
            self.cues(&input.id, input.size, duration, work).await.ok()
        } else {
            None
        };
        check(work)?;
        if *sender.borrow() {
            return Err(Error::Cancelled);
        }
        let copy = cues.is_some();
        let starts = cues.unwrap_or_else(|| uniform_starts(duration));
        if starts.len() > MAX_SEGMENTS {
            return Err(Error::Unsupported);
        }
        let id = uuid::Uuid::new_v4().simple().to_string();
        let (cancel, _) = watch::channel(false);
        let lease = Arc::new(Lease {
            item: input.id.clone(),
            source_id: input.source_id,
            fingerprint: input.fingerprint,
            epoch: work.epoch(),
            plan: Plan {
                duration,
                starts,
                copy,
                audio: audio.len(),
            },
            cancel,
            touched: Mutex::new(Instant::now()),
            gates: Mutex::new(HashMap::new()),
        });
        self.publish_lease(id.clone(), lease, &sender, work)?;
        Ok(Prepared {
            mode: if copy { "remux" } else { "transcode" },
            finite: true,
            timeline: "vod",
            time_origin: 0,
            duration,
            mime: "application/vnd.apple.mpegurl",
            url: format!("{base}/compat/{}/{id}/index.m3u8", input.id),
            cancel_url: format!("{base}/compat/{}/cancel", input.id),
            lease: id,
        })
    }
    fn publish_lease(
        &self,
        id: String,
        lease: Arc<Lease>,
        sender: &watch::Sender<bool>,
        work: &WorkLease,
    ) -> Result<()> {
        #[cfg(test)]
        {
            let hook = lock(&self.0.before_publication).take();
            if let Some(hook) = hook {
                hook();
            }
        }
        work.publish(|| {
            let _publication = lock(&self.0.publication);
            let cancelled = sender.borrow();
            if *cancelled {
                return Err(Error::Cancelled);
            }
            let mut leases = lock(&self.0.leases);
            if leases.len() >= MAX_LEASES {
                return Err(Error::Busy);
            }
            leases.insert(id, lease);
            Ok(())
        })
        .map_err(|_| Error::Cancelled)?
    }
    pub(crate) fn playlist(
        &self,
        input: &Input,
        id: &str,
        name: &str,
        base: &str,
        work: &WorkLease,
    ) -> Result<String> {
        let lease = self.lease(input, id, work)?;
        let p = &lease.plan;
        if name == "index.m3u8" {
            let mut text = String::from("#EXTM3U\n#EXT-X-VERSION:3\n");
            for i in 0..p.audio {
                text+=&format!("#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"audio\",NAME=\"Audio {}\",DEFAULT={},AUTOSELECT=YES,URI=\"{base}/audio{i}.m3u8\"\n",i+1,if i==0{"YES"}else{"NO"});
            }
            text += if p.audio == 0 {
                "#EXT-X-STREAM-INF:BANDWIDTH=4500000\n"
            } else {
                "#EXT-X-STREAM-INF:BANDWIDTH=4500000,AUDIO=\"audio\"\n"
            };
            text += &format!("{base}/video.m3u8\n");
            return Ok(text);
        }
        let track = name.strip_suffix(".m3u8").ok_or(Error::Unsupported)?;
        valid_track(track, p.audio)?;
        let target = p
            .starts
            .iter()
            .enumerate()
            .map(|(i, s)| p.starts.get(i + 1).copied().unwrap_or(p.duration) - s)
            .fold(0.0, f64::max)
            .ceil() as u64;
        let mut text=format!("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:{target}\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:VOD\n");
        for (i, s) in p.starts.iter().enumerate() {
            let len = p.starts.get(i + 1).copied().unwrap_or(p.duration) - s;
            text += &format!("#EXTINF:{len:.6},\n{base}/{track}/{i}.ts\n");
        }
        text += "#EXT-X-ENDLIST\n";
        Ok(text)
    }
    pub(crate) async fn segment(
        &self,
        input: Input,
        id: &str,
        track: &str,
        index: usize,
        work: &WorkLease,
    ) -> Result<Arc<Vec<u8>>> {
        let _request = REQUESTS
            .clone()
            .try_acquire_owned()
            .map_err(|_| Error::Busy)?;
        let lease = self.lease(&input, id, work)?;
        valid_track(track, lease.plan.audio)?;
        let start = *lease.plan.starts.get(index).ok_or(Error::Unsupported)?;
        let end = lease
            .plan
            .starts
            .get(index + 1)
            .copied()
            .unwrap_or(lease.plan.duration);
        let key = format!("{id}/{track}/{index}");
        if let Some(bytes) = lock(&CACHE).get(&key) {
            return Ok(bytes);
        }
        let gate = SegmentGate::new(lease.clone(), key.clone())?;
        let guard = work
            .run(gate.gate.lock())
            .await
            .map_err(|_| Error::Cancelled)?;
        self.lease(&input, id, work)?;
        if let Some(bytes) = lock(&CACHE).get(&key) {
            drop(guard);
            return Ok(bytes);
        }
        let mut cmd = Command::new(&self.0.tools.ffmpeg);
        cmd.args([
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-rw_timeout",
            "5000000",
            "-protocol_whitelist",
            "http,tcp",
            "-format_whitelist",
            "avi,matroska,webm",
            "-probesize",
            "2097152",
            "-analyzeduration",
            "3000000",
            "-ss",
            &format!("{start:.6}"),
            "-i",
            self.source(&input.id)?.as_str(),
            "-t",
            &format!("{:.6}", end - start),
        ]);
        if track == "video" {
            cmd.args(["-map", "0:v:0", "-an"]);
            if lease.plan.copy {
                cmd.args(["-c:v", "copy", "-bsf:v", "h264_mp4toannexb"]);
            } else {
                cmd.args(["-c:v","libx264","-preset","ultrafast","-crf","23","-threads","1","-bf","0","-pix_fmt","yuv420p","-g","120","-sc_threshold","0","-vf","scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2","-maxrate","4000000","-bufsize","8000000"]);
            }
        } else {
            let audio = track.strip_prefix("audio").unwrap();
            cmd.args(["-map", &format!("0:a:{audio}"), "-vn"]);
            if lease.plan.copy {
                cmd.args(["-c:a", "copy"]);
            } else {
                cmd.args(["-c:a", "aac", "-b:a", "160k", "-ac", "2", "-threads", "1"]);
            }
        }
        cmd.args([
            "-avoid_negative_ts",
            "disabled",
            "-output_ts_offset",
            &format!("{start:.6}"),
            "-muxdelay",
            "0",
            "-muxpreload",
            "0",
            "-mpegts_flags",
            "+resend_headers",
            "-f",
            "mpegts",
            "pipe:1",
        ]);
        let result = capture(cmd, work, lease.cancel.subscribe(), MAX_SEGMENT, DEADLINE).await;
        let bytes = Arc::new(result?);
        self.lease(&input, id, work)?;
        if bytes.is_empty() {
            return Err(Error::Unsupported);
        }
        work.publish(|| {
            let cancelled = lease.cancel.borrow();
            if *cancelled {
                return Err(Error::Cancelled);
            }
            lock(&CACHE).insert(key.clone(), bytes.clone());
            Ok(())
        })
        .map_err(|_| Error::Cancelled)??;
        drop(guard);
        Ok(bytes)
    }
    async fn range(
        &self,
        id: &str,
        size: u64,
        start: u64,
        length: usize,
        work: &WorkLease,
    ) -> Result<Vec<u8>> {
        if length == 0 || length > MAX_METADATA || start >= size {
            return Err(Error::Unsupported);
        }
        let end = start.saturating_add(length as u64).min(size) - 1;
        let response = work
            .run(
                self.0
                    .client
                    .get(self.source(id)?)
                    .header("Range", format!("bytes={start}-{end}"))
                    .send(),
            )
            .await
            .map_err(|_| Error::Cancelled)?
            .map_err(|_| Error::Source)?;
        if response.status() != reqwest::StatusCode::PARTIAL_CONTENT
            || response.content_length() != Some(end - start + 1)
        {
            return Err(Error::Source);
        }
        let bytes = work
            .run(response.bytes())
            .await
            .map_err(|_| Error::Cancelled)?
            .map_err(|_| Error::Source)?;
        if bytes.len() > length {
            return Err(Error::Unsupported);
        }
        Ok(bytes.to_vec())
    }
    async fn metadata_element(
        &self,
        id: &str,
        size: u64,
        position: u64,
        work: &WorkLease,
    ) -> Result<Vec<u8>> {
        let header = self.range(id, size, position, 16, work).await?;
        let (_, start, length, _) = element_header(&header, 0)?;
        if length > MAX_METADATA
            || position
                .checked_add(start as u64)
                .and_then(|n| n.checked_add(length as u64))
                .is_none_or(|end| end > size)
        {
            return Err(Error::Unsupported);
        }
        self.range(id, size, position + start as u64, length, work)
            .await
    }
    /// Matroska SeekHead->Tracks/Info/Cues; reads at most 3MiB plus 64KiB.
    /// Missing or doubtful index means transcode, never a fabricated copy grid.
    async fn cues(&self, id: &str, size: u64, duration: f64, work: &WorkLease) -> Result<Vec<f64>> {
        let header = self.range(id, size, 0, 65_536, work).await?;
        let mut at = 0;
        let mut offset = None;
        while at < header.len() {
            let (id, start, _, next) = element_header(&header, at)?;
            if id == 0x18538067 {
                offset = Some(start);
                break;
            }
            if next > header.len() {
                return Err(Error::Unsupported);
            }
            at = next;
        }
        let offset = offset.ok_or(Error::Unsupported)?;
        let mut seek = None;
        let mut p = offset;
        while p < header.len() {
            let (id, start, len, next) = element(&header, p)?;
            if id == 0x114d9b74 {
                seek = Some(&header[start..start + len]);
                break;
            }
            p = next;
        }
        let seek = seek.ok_or(Error::Unsupported)?;
        let mut locations = HashMap::new();
        for (id, body) in children(seek)? {
            if id != 0x4dbb {
                continue;
            }
            let (mut target, mut position) = (None, None);
            for (id, b) in children(body)? {
                if id == 0x53ab {
                    target = Some(integer(b)?);
                }
                if id == 0x53ac {
                    position = Some(integer(b)?);
                }
            }
            if let (Some(target), Some(position)) = (target, position) {
                locations.insert(
                    target,
                    position
                        .checked_add(offset as u64)
                        .ok_or(Error::Unsupported)?,
                );
            }
        }
        let mut scale = 0.001;
        if let Some(pos) = locations.get(&0x1549a966) {
            let body = self.metadata_element(id, size, *pos, work).await?;
            for (id, b) in children(&body)? {
                if id == 0x2ad7b1 {
                    scale = integer(b)? as f64 / 1_000_000_000.0;
                }
            }
        }
        if !scale.is_finite() || scale <= 0.0 || scale > 1.0 {
            return Err(Error::Unsupported);
        }
        let tracks = self
            .metadata_element(
                id,
                size,
                *locations.get(&0x1654ae6b).ok_or(Error::Unsupported)?,
                work,
            )
            .await?;
        let mut video = None;
        for (id, body) in children(&tracks)? {
            if id != 0xae {
                continue;
            }
            let (mut number, mut kind) = (None, None);
            for (id, b) in children(body)? {
                if id == 0xd7 {
                    number = Some(integer(b)?);
                }
                if id == 0x83 {
                    kind = Some(integer(b)?);
                }
            }
            if kind == Some(1) && video.is_none() {
                video = number;
            }
        }
        let video = video.ok_or(Error::Unsupported)?;
        let cues = self
            .metadata_element(
                id,
                size,
                *locations.get(&0x1c53bb6b).ok_or(Error::Unsupported)?,
                work,
            )
            .await?;
        let mut times = Vec::new();
        for (id, body) in children(&cues)? {
            if id != 0xbb {
                continue;
            }
            let (mut time, mut track) = (None, None);
            for (id, b) in children(body)? {
                if id == 0xb3 {
                    time = Some(integer(b)?);
                }
                if id == 0xb7 {
                    for (id, b) in children(b)? {
                        if id == 0xf7 {
                            track = Some(integer(b)?);
                        }
                    }
                }
            }
            if track == Some(video) {
                if let Some(t) = time {
                    times.push(t as f64 * scale);
                }
            }
        }
        cue_starts(times, duration)
    }
}

#[derive(Deserialize)]
struct Probe {
    streams: Vec<Stream>,
    format: Format,
}
#[derive(Deserialize)]
struct Stream {
    codec_type: String,
    #[serde(default)]
    codec_name: String,
    #[serde(default)]
    pix_fmt: String,
}
#[derive(Deserialize)]
struct Format {
    duration: String,
    #[serde(default)]
    start_time: String,
}
fn uniform_starts(duration: f64) -> Vec<f64> {
    merge_short_tail(
        (0..((duration / 4.0).ceil() as usize))
            .map(|i| i as f64 * 4.0)
            .collect(),
        duration,
    )
}
fn merge_short_tail(mut starts: Vec<f64>, duration: f64) -> Vec<f64> {
    // Container duration can include AAC/AC-3 padding after the final video
    // frame. A new sub-second interval may therefore contain no video packets.
    // Extend the previous segment instead; retain the full original duration.
    if starts.len() > 1 && duration - starts[starts.len() - 1] < 1.0 {
        starts.pop();
    }
    starts
}
fn valid_track(track: &str, audio: usize) -> Result<()> {
    if track == "video" {
        return Ok(());
    }
    let n = track
        .strip_prefix("audio")
        .and_then(|n| n.parse::<usize>().ok())
        .filter(|n| *n < audio)
        .ok_or(Error::Unsupported)?;
    if track != format!("audio{n}") {
        return Err(Error::Unsupported);
    }
    Ok(())
}
fn cue_starts(times: Vec<f64>, duration: f64) -> Result<Vec<f64>> {
    if times.is_empty() || times.len() > MAX_SEGMENTS || times[0].abs() > 0.001 {
        return Err(Error::Unsupported);
    }
    let mut result = vec![0.0];
    let mut last = -1.0;
    for t in times {
        if !t.is_finite() || t < 0.0 || t <= last || t >= duration {
            return Err(Error::Unsupported);
        }
        last = t;
        if t - result.last().unwrap() >= 4.0 {
            result.push(t);
        }
    }
    let result = merge_short_tail(result, duration);
    if result
        .iter()
        .enumerate()
        .any(|(i, t)| result.get(i + 1).copied().unwrap_or(duration) - t > 30.0)
    {
        return Err(Error::Unsupported);
    }
    Ok(result)
}
fn vint(data: &[u8], at: usize, id: bool) -> Result<(u64, usize)> {
    let first = *data.get(at).ok_or(Error::Unsupported)?;
    let n = first.leading_zeros() as usize + 1;
    if n > if id { 4 } else { 8 } || at + n > data.len() {
        return Err(Error::Unsupported);
    }
    let mut value = if id {
        first as u64
    } else if n == 8 {
        0
    } else {
        (first & (0xff >> n)) as u64
    };
    for b in &data[at + 1..at + n] {
        value = (value << 8) | u64::from(*b);
    }
    Ok((value, n))
}
fn element_header(data: &[u8], at: usize) -> Result<(u64, usize, usize, usize)> {
    let (id, n) = vint(data, at, true)?;
    let (size, m) = vint(data, at + n, false)?;
    let start = at + n + m;
    let size = usize::try_from(size).map_err(|_| Error::Unsupported)?;
    let next = start.checked_add(size).ok_or(Error::Unsupported)?;
    Ok((id, start, size, next))
}
fn element(data: &[u8], at: usize) -> Result<(u64, usize, usize, usize)> {
    let e = element_header(data, at)?;
    if e.3 > data.len() {
        return Err(Error::Unsupported);
    }
    Ok(e)
}
fn children(data: &[u8]) -> Result<Vec<(u64, &[u8])>> {
    let mut result = Vec::new();
    let mut at = 0;
    while at < data.len() {
        let (id, start, len, next) = element(data, at)?;
        result.push((id, &data[start..start + len]));
        if result.len() > MAX_SEGMENTS * 4 {
            return Err(Error::Unsupported);
        }
        at = next;
    }
    Ok(result)
}
fn integer(data: &[u8]) -> Result<u64> {
    if data.is_empty() || data.len() > 8 {
        return Err(Error::Unsupported);
    }
    Ok(data.iter().fold(0, |v, b| (v << 8) | u64::from(*b)))
}

struct Caller(watch::Sender<bool>);
impl Drop for Caller {
    fn drop(&mut self) {
        self.0.send_replace(true);
    }
}
const CHILD_PROXY_VARIABLES: [&str; 6] = [
    "http_proxy",
    "HTTP_PROXY",
    "https_proxy",
    "HTTPS_PROXY",
    "all_proxy",
    "ALL_PROXY",
];
fn clear_child_proxies(command: &mut Command) {
    // This child can read only our private loopback input. Inherited proxy
    // configuration must not send its capability or original bytes elsewhere.
    for name in CHILD_PROXY_VARIABLES {
        command.env_remove(name);
    }
}
/// The worker retains its BackgroundWork lease through kill AND wait/reap.
async fn capture(
    mut cmd: Command,
    work: &WorkLease,
    mut cancelled: watch::Receiver<bool>,
    limit: usize,
    timeout: Duration,
) -> Result<Vec<u8>> {
    clear_child_proxies(&mut cmd);
    // FFmpeg/ffprobe are background workers, including discovery probes.
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    check(work)?;
    if *cancelled.borrow() {
        return Err(Error::Cancelled);
    }
    let owner = work.clone();
    let (abandoned, mut caller) = watch::channel(false);
    let _caller = Caller(abandoned);
    let task = tokio::spawn(async move {
        let started = Instant::now();
        let slot = tokio::select! {biased;_=owner.cancelled()=>return Err(Error::Cancelled),_=cancelled.changed()=>return Err(Error::Cancelled),_=caller.changed()=>return Err(Error::Cancelled),v=tokio::time::timeout(timeout,PROCESSES.clone().acquire_owned())=>v.map_err(|_|Error::Busy)?.map_err(|_|Error::Busy)?};
        check(&owner)?;
        if *cancelled.borrow() || *caller.borrow() {
            return Err(Error::Cancelled);
        }
        let mut child = cmd
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true)
            .spawn()
            .map_err(|_| Error::Unavailable)?;
        #[cfg(test)]
        if let Some(observer) = lock(&tests::SPAWN_OBSERVER).take() {
            let _ = observer.send(());
        }
        let mut stdout = child.stdout.take().ok_or(Error::Unavailable)?;
        let read = async {
            let mut bytes = Vec::new();
            let mut buffer = [0u8; 16_384];
            loop {
                let n = stdout.read(&mut buffer).await.map_err(|_| Error::Source)?;
                if n == 0 {
                    return Ok(bytes);
                }
                if bytes.len() + n > limit {
                    return Err(Error::Unsupported);
                }
                bytes.extend_from_slice(&buffer[..n]);
            }
        };
        let result = tokio::select! {biased;_=owner.cancelled()=>Err(Error::Cancelled),_=cancelled.changed()=>Err(Error::Cancelled),_=caller.changed()=>Err(Error::Cancelled),v=tokio::time::timeout(timeout.saturating_sub(started.elapsed()),read)=>v.unwrap_or(Err(Error::Unsupported))};
        if result.is_err() {
            let _ = child.kill().await;
            let _ = child.wait().await;
            drop(slot);
            return result;
        }
        let status = tokio::select! {biased;_=owner.cancelled()=>None,_=cancelled.changed()=>None,_=caller.changed()=>None,v=tokio::time::timeout(Duration::from_secs(3),child.wait())=>v.ok().and_then(|v|v.ok())};
        if status.is_none() {
            let _ = child.kill().await;
            let _ = child.wait().await;
            return Err(Error::Cancelled);
        }
        check(&owner)?;
        if !status.unwrap().success() {
            return Err(Error::Unsupported);
        }
        drop(slot);
        result
    });
    work.run(task)
        .await
        .map_err(|_| Error::Cancelled)?
        .map_err(|_| Error::Cancelled)?
}
#[derive(Default)]
struct Cache {
    entries: HashMap<String, (Arc<Vec<u8>>, Instant)>,
    bytes: usize,
    #[cfg(test)]
    limit: usize,
}
impl Cache {
    fn get(&mut self, key: &str) -> Option<Arc<Vec<u8>>> {
        let e = self.entries.get_mut(key)?;
        e.1 = Instant::now();
        Some(e.0.clone())
    }
    fn remove_prefix(&mut self, id: &str) {
        let prefix = format!("{id}/");
        self.entries.retain(|key, (bytes, _)| {
            let keep = !key.starts_with(&prefix);
            if !keep {
                self.bytes -= bytes.len();
            }
            keep
        });
    }
    fn insert(&mut self, key: String, bytes: Arc<Vec<u8>>) {
        #[cfg(not(test))]
        let limit = CACHE_BYTES;
        #[cfg(test)]
        let limit = if self.limit == 0 {
            CACHE_BYTES
        } else {
            self.limit
        };
        while self.bytes + bytes.len() > limit {
            let old = self
                .entries
                .iter()
                .min_by_key(|(_, (_, t))| *t)
                .map(|(k, _)| k.clone());
            let Some(old) = old else {
                return;
            };
            if let Some((data, _)) = self.entries.remove(&old) {
                self.bytes -= data.len();
            }
        }
        if let Some((old, _)) = self.entries.insert(key, (bytes.clone(), Instant::now())) {
            self.bytes -= old.len();
        }
        self.bytes += bytes.len();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn all_compatibility_children_use_the_windows_no_console_spawn_boundary() {
        // Command exposes no creation-flags getter. Keep the single shared
        // spawn boundary and its Windows-only setup auditable without spawning.
        // Windows checkout may use CRLF; keep test-only source out of the
        // production spawn audit on either platform.
        let source = include_str!("local_compatibility.rs").replace("\r\n", "\n");
        let production = source.split("\n#[cfg(test)]\nmod tests").next().unwrap();
        assert_eq!(production.matches(".spawn()").count(), 1);
        let capture = production.split_once("async fn capture(").unwrap().1;
        let compact = capture.split_whitespace().collect::<Vec<_>>().join(" ");
        let setup = "#[cfg(windows)] { const CREATE_NO_WINDOW: u32 = 0x0800_0000; cmd.creation_flags(CREATE_NO_WINDOW); }";
        assert!(compact.contains(setup));
        assert!(compact.find(setup).unwrap() < compact.find(".spawn()").unwrap());
    }
    #[test]
    fn private_media_children_explicitly_remove_all_proxy_variants() {
        for name in CHILD_PROXY_VARIABLES {
            let mut command = Command::new("unused-no-process-is-launched");
            command.env(name, "discard-me");
            clear_child_proxies(&mut command);
            assert!(
                command.as_std().get_envs().any(|(key, value)| {
                    #[cfg(windows)]
                    let matches = key.to_string_lossy().eq_ignore_ascii_case(name);
                    #[cfg(not(windows))]
                    let matches = key == std::ffi::OsStr::new(name);
                    matches && value.is_none()
                }),
                "{name} must be removed from the child's environment"
            );
        }
    }
    #[test]
    fn private_endpoint_has_fixed_loopback_origin_and_opaque_paths() {
        let endpoint =
            PrivateEndpoint::new("127.0.0.1:12345".parse().unwrap(), "a".repeat(64)).unwrap();
        let target = endpoint.source(&"b".repeat(32)).unwrap();
        assert_eq!(target.scheme(), "http");
        assert_eq!(target.host_str(), Some("127.0.0.1"));
        assert_eq!(target.port(), Some(12345));
        assert!(
            target.username().is_empty()
                && target.password().is_none()
                && target.query().is_none()
                && target.fragment().is_none()
        );
        assert_eq!(
            target.path(),
            format!("/_input/{}/{}", "a".repeat(64), "b".repeat(32))
        );
        for id in ["", "not-an-opaque-id", &"a".repeat(31), &"g".repeat(32)] {
            assert!(endpoint.source(id).is_err());
        }
        for address in [
            "127.0.0.1:0",
            "0.0.0.0:12345",
            "192.0.2.1:12345",
            "[::1]:12345",
        ] {
            assert!(PrivateEndpoint::new(address.parse().unwrap(), "a".repeat(64)).is_err());
        }
        assert!(PrivateEndpoint::new(
            "127.0.0.1:12345".parse().unwrap(),
            "not-a-capability".into()
        )
        .is_err());
    }
    fn input() -> Input {
        Input {
            id: "a".repeat(32),
            source_id: "source".into(),
            fingerprint: "unchanged".into(),
            extension: "avi".into(),
            size: 100,
        }
    }
    fn lease(work: &WorkLease, audio: usize) -> Arc<Lease> {
        let (cancel, _) = watch::channel(false);
        Arc::new(Lease {
            item: input().id,
            source_id: "source".into(),
            fingerprint: input().fingerprint,
            epoch: work.epoch(),
            plan: Plan {
                duration: 12.25,
                starts: uniform_starts(12.25),
                copy: false,
                audio,
            },
            cancel,
            touched: Mutex::new(Instant::now()),
            gates: Mutex::new(HashMap::new()),
        })
    }
    fn manager() -> Manager {
        Manager::new(
            Tools {
                ffmpeg: "/unused".into(),
                ffprobe: "/unused".into(),
            },
            "127.0.0.1:1".parse().unwrap(),
            "a".repeat(64),
            tokio::spawn(std::future::pending()),
        )
        .unwrap()
    }
    #[test]
    fn finite_timeline_has_truthful_tail_and_irregular_copy_boundaries() {
        assert_eq!(uniform_starts(12.25), vec![0.0, 4.0, 8.0]);
        assert_eq!(
            cue_starts(vec![0.0, 2.0, 5.3, 6.7, 9.9], 12.25).unwrap(),
            vec![0.0, 5.3, 9.9]
        );
        for times in [
            vec![1.0],
            vec![0.0, 0.0],
            vec![0.0, 40.0],
            vec![0.0, f64::NAN],
        ] {
            assert!(cue_starts(times, 50.0).is_err());
        }
    }
    #[test]
    fn audio_padding_tail_merges_without_cutting_finite_duration() {
        for (duration, expected) in [
            (0.06, vec![0.0]),
            (0.5, vec![0.0]),
            (3.9, vec![0.0]),
            (4.0, vec![0.0]),
            (4.016327, vec![0.0]),
            (8.0, vec![0.0, 4.0]),
            (8.023, vec![0.0, 4.0]),
            (12.016327, vec![0.0, 4.0, 8.0]),
            (13.0, vec![0.0, 4.0, 8.0, 12.0]),
        ] {
            let starts = uniform_starts(duration);
            assert_eq!(starts, expected);
            let lengths: Vec<_> = starts
                .iter()
                .enumerate()
                .map(|(i, t)| starts.get(i + 1).copied().unwrap_or(duration) - t)
                .collect();
            assert!(lengths.iter().all(|v| *v > 0.0));
            assert!((lengths.iter().sum::<f64>() - duration).abs() < 0.000001);
            if starts.len() > 1 {
                assert!(*lengths.last().unwrap() >= 1.0);
            }
        }
        assert_eq!(
            cue_starts(vec![0.0, 4.0, 8.0, 12.0], 12.023).unwrap(),
            vec![0.0, 4.0, 8.0]
        );
        assert!(
            cue_starts(vec![0.0, 29.5, 30.0], 30.2).is_err(),
            "tail merge cannot violate the 30-second copy bound"
        );
    }
    #[test]
    fn bounded_ebml_rejects_truncation_and_handles_eight_byte_sizes() {
        assert!(vint(&[0], 0, false).is_err());
        assert!(element(&[0x81, 0x88, 1], 0).is_err());
        assert_eq!(vint(&[1, 0, 0, 0, 0, 0, 0, 8], 0, false).unwrap(), (8, 8));
        assert_eq!(children(&[0x81, 0x81, 7]).unwrap()[0], (0x81, &[7][..]));
    }
    #[test]
    fn audio_and_segment_names_cannot_become_process_arguments() {
        for name in ["audio-1", "audio01", "audio8", "../../video", "video.ts"] {
            assert!(valid_track(name, 2).is_err());
        }
        assert!(valid_track("audio1", 2).is_ok());
    }
    #[test]
    fn cache_limit_is_global_lru_and_cancel_is_prefix_scoped() {
        let mut c = Cache {
            limit: 2048,
            ..Default::default()
        };
        c.insert("one/video/0".into(), Arc::new(vec![1; 1024]));
        c.insert("two/video/0".into(), Arc::new(vec![2; 1024]));
        c.get("one/video/0");
        c.insert("three/video/0".into(), Arc::new(vec![3; 1024]));
        assert!(c.bytes <= 2048);
        assert!(c.get("two/video/0").is_none());
        c.remove_prefix("one");
        assert!(c.get("three/video/0").is_some());
        const {
            assert!(CACHE_BYTES <= 256 * 1024 * 1024);
        }
    }
    #[tokio::test]
    async fn failed_gate_cleanup_does_not_exhaust_eight_keys() {
        let background = crate::background_work::BackgroundWork::default();
        let work = background.enter().unwrap();
        let l = lease(&work, 1);
        for i in 0..24 {
            let key = format!("failed/{i}");
            let gate = SegmentGate::new(l.clone(), key).unwrap();
            drop(gate);
            assert!(lock(&l.gates).is_empty());
        }
        let first = SegmentGate::new(l.clone(), "same".into()).unwrap();
        let second = SegmentGate::new(l.clone(), "same".into()).unwrap();
        drop(first);
        assert_eq!(lock(&l.gates).len(), 1);
        drop(second);
        assert!(lock(&l.gates).is_empty());
    }
    #[tokio::test]
    async fn two_clients_cancel_and_source_replacement_are_isolated() {
        let background = crate::background_work::BackgroundWork::default();
        let work = background.enter().unwrap();
        let m = manager();
        lock(&m.0.leases).insert("one".into(), lease(&work, 1));
        lock(&m.0.leases).insert("two".into(), lease(&work, 1));
        m.cancel("different-item", "two");
        assert!(m.lease(&input(), "two", &work).is_ok());
        m.cancel(&input().id, "one");
        assert!(m.lease(&input(), "one", &work).is_err());
        assert!(m.lease(&input(), "two", &work).is_ok());
        let mut changed = input();
        changed.fingerprint = "replaced".into();
        assert!(m.lease(&changed, "two", &work).is_err());
        m.cancel_source("source");
        assert!(m.lease(&input(), "two", &work).is_err());
    }
    #[tokio::test]
    async fn all_child_playlists_are_finite_and_silent_video_is_supported() {
        let background = crate::background_work::BackgroundWork::default();
        let work = background.enter().unwrap();
        let m = manager();
        lock(&m.0.leases).insert("one".into(), lease(&work, 2));
        for track in ["video", "audio0", "audio1"] {
            let p = m
                .playlist(&input(), "one", &format!("{track}.m3u8"), "/base", &work)
                .unwrap();
            assert!(p.contains("#EXT-X-PLAYLIST-TYPE:VOD") && p.ends_with("#EXT-X-ENDLIST\n"));
            let sum: f64 = p
                .lines()
                .filter_map(|s| s.strip_prefix("#EXTINF:"))
                .map(|s| s.trim_end_matches(',').parse::<f64>().unwrap())
                .sum();
            assert!((sum - 12.25).abs() < 0.000001);
            assert!(p.contains("#EXTINF:4.250000,"));
        }
        let master = m
            .playlist(&input(), "one", "index.m3u8", "/base", &work)
            .unwrap();
        assert!(master.contains("audio1.m3u8") && !master.contains("#EXT-X-ENDLIST"));
        lock(&m.0.leases).insert("silent".into(), lease(&work, 0));
        assert!(!m
            .playlist(&input(), "silent", "index.m3u8", "/base", &work)
            .unwrap()
            .contains("AUDIO="));
    }
    #[tokio::test]
    async fn standby_wake_does_not_revive_old_lease() {
        let b = crate::background_work::BackgroundWork::default();
        let old = b.enter().unwrap();
        let m = manager();
        lock(&m.0.leases).insert("one".into(), lease(&old, 1));
        b.set_standby(true);
        b.set_standby(false);
        let current = b.enter().unwrap();
        assert!(m.lease(&input(), "one", &current).is_err());
    }
    #[tokio::test]
    async fn source_cancel_between_prepare_check_and_publication_cannot_publish() {
        let b = crate::background_work::BackgroundWork::default();
        let work = b.enter().unwrap();
        let m = manager();
        let (sender, _) = watch::channel(false);
        lock(&m.0.preparing).insert(
            "pending".into(),
            Preparing {
                item: input().id,
                source: "source".into(),
                cancel: sender.clone(),
            },
        );
        let cancel = m.clone();
        *lock(&m.0.before_publication) = Some(Box::new(move || cancel.cancel_source("source")));
        let result = m.publish_lease("late".into(), lease(&work, 1), &sender, &work);
        assert_eq!(result.unwrap_err(), Error::Cancelled);
        assert!(lock(&m.0.leases).is_empty());
    }
    #[cfg(unix)]
    static PROCESS_TEST: LazyLock<AsyncMutex<()>> = LazyLock::new(|| AsyncMutex::new(()));
    pub(super) static SPAWN_OBSERVER: Mutex<Option<tokio::sync::oneshot::Sender<()>>> =
        Mutex::new(None);
    #[cfg(unix)]
    async fn drain(b: &crate::background_work::BackgroundWork) {
        for _ in 0..200 {
            if b.status().pending == 0 {
                return;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        panic!("child lease did not drain after kill/reap");
    }
    #[cfg(unix)]
    #[tokio::test]
    async fn process_deadline_and_output_limit_kill_and_reap() {
        let _serial = PROCESS_TEST.lock().await;
        let b = crate::background_work::BackgroundWork::default();
        let work = b.enter().unwrap();
        let (sender, rx) = watch::channel(false);
        let mut command = Command::new("/bin/sh");
        command.args(["-c", "exec sleep 30"]);
        assert_eq!(
            capture(command, &work, rx.clone(), 10, Duration::from_millis(50))
                .await
                .unwrap_err(),
            Error::Unsupported
        );
        let mut command = Command::new("/bin/sh");
        command.args(["-c", "printf 123456789; exec sleep 30"]);
        assert_eq!(
            capture(command, &work, rx, 4, Duration::from_secs(2))
                .await
                .unwrap_err(),
            Error::Unsupported
        );
        drop(sender);
        drop(work);
        drain(&b).await;
    }
    #[cfg(unix)]
    #[tokio::test]
    async fn standby_cancels_running_child_and_preserves_pending_until_reap() {
        let _serial = PROCESS_TEST.lock().await;
        let b = crate::background_work::BackgroundWork::default();
        let work = b.enter().unwrap();
        let (sender, rx) = watch::channel(false);
        let (started, ready) = tokio::sync::oneshot::channel();
        *lock(&SPAWN_OBSERVER) = Some(started);
        let task = tokio::spawn(async move {
            let mut c = Command::new("/bin/sh");
            c.args(["-c", "exec sleep 30"]);
            capture(c, &work, rx, 20, Duration::from_secs(5)).await
        });
        tokio::time::timeout(Duration::from_secs(3), ready)
            .await
            .unwrap()
            .unwrap();
        b.set_standby(true);
        assert_eq!(task.await.unwrap().unwrap_err(), Error::Cancelled);
        drop(sender);
        drain(&b).await;
    }
    #[cfg(unix)]
    #[tokio::test]
    async fn abandoned_request_and_source_cancel_reap_running_children() {
        let _serial = PROCESS_TEST.lock().await;
        for abandon in [false, true] {
            let b = crate::background_work::BackgroundWork::default();
            let work = b.enter().unwrap();
            let m = manager();
            let (sender, rx) = watch::channel(false);
            lock(&m.0.preparing).insert(
                "pending".into(),
                Preparing {
                    item: input().id,
                    source: "source".into(),
                    cancel: sender,
                },
            );
            let (started, ready) = tokio::sync::oneshot::channel();
            *lock(&SPAWN_OBSERVER) = Some(started);
            let task = tokio::spawn(async move {
                let mut c = Command::new("/bin/sh");
                c.args(["-c", "exec sleep 30"]);
                capture(c, &work, rx, 20, Duration::from_secs(5)).await
            });
            tokio::time::timeout(Duration::from_secs(3), ready)
                .await
                .unwrap()
                .unwrap();
            if abandon {
                task.abort();
                assert!(task.await.unwrap_err().is_cancelled());
            } else {
                m.cancel_source("source");
                assert_eq!(task.await.unwrap().unwrap_err(), Error::Cancelled);
            }
            drain(&b).await;
        }
    }
}
