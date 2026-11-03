//! Explicitly configured audio normalization gateway. No arbitrary URL API.
use anyhow::{bail, Context, Result};
use axum::{
    extract::{DefaultBodyLimit, Path, Query, State},
    http::{HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use hmac::{Hmac, Mac};
use ottplay_core::audio_normalization::{Config, Manager};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::Sha256;
use std::{
    collections::{HashMap, VecDeque},
    path::PathBuf,
    sync::{Arc, Mutex, OnceLock, Weak},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tower_http::cors::CorsLayer;

type Shared = Arc<Gateway>;
static GATEWAYS: OnceLock<Mutex<Vec<Weak<Gateway>>>> = OnceLock::new();
pub fn configured() -> bool {
    GATEWAYS.get().is_some()
}
pub async fn stop_signal() {
    #[cfg(unix)]
    {
        if let Ok(mut terminate) =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        {
            tokio::select! { _=terminate.recv()=>{}, _=tokio::signal::ctrl_c()=>{} }
            return;
        }
    }
    let _ = tokio::signal::ctrl_c().await;
}
pub async fn shutdown() {
    shutdown_gateways(registered_gateways()).await;
}

fn registered_gateways() -> Vec<Shared> {
    GATEWAYS
        .get()
        .map(|gateways| {
            gateways
                .lock()
                .unwrap()
                .iter()
                .filter_map(Weak::upgrade)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

async fn shutdown_gateways(gateways: Vec<Shared>) {
    for gateway in gateways {
        let ids: Vec<_> = gateway.leases.lock().unwrap().keys().cloned().collect();
        for id in ids {
            if let Some(lease) = gateway.close(&id) {
                let mut done = lease.done.subscribe();
                let _ = tokio::time::timeout(Duration::from_secs(5), async {
                    while !*done.borrow_and_update() {
                        if done.changed().await.is_err() {
                            break;
                        }
                    }
                })
                .await;
                let _ = gateway.manager.close_and_wait(&id).await;
            }
        }
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Settings {
    key: String,
    public_base: String,
    origins: Vec<String>,
    ffmpeg: PathBuf,
    ffprobe: PathBuf,
    directory: PathBuf,
    sources: HashMap<String, Source>,
    #[serde(default)]
    profiles: HashMap<String, Profile>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Profile {
    file: PathBuf,
    key: String,
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct Source {
    url: String,
    allowed_origins: Vec<String>,
    #[serde(default)]
    headers: HashMap<String, String>,
    playback_key: String,
    #[serde(default = "default_preparation_budget_seconds")]
    preparation_budget_seconds: u64,
    #[serde(default = "default_preparation_attempts")]
    preparation_attempts: u8,
}
fn default_preparation_budget_seconds() -> u64 {
    30
}
fn default_preparation_attempts() -> u8 {
    2
}
impl Source {
    fn preparation_budget(&self) -> Duration {
        Duration::from_secs(self.preparation_budget_seconds)
    }
    fn preparation_wait(&self) -> Duration {
        self.preparation_budget() + Duration::from_secs(5)
    }
}
struct Resources {
    urls: VecDeque<(usize, String)>,
    next: usize,
    bytes: usize,
}
impl Resources {
    fn insert(&mut self, index: usize, url: String) {
        while !self.urls.is_empty()
            && (self.urls.len() >= 4096 || self.bytes + url.len() > 1024 * 1024)
        {
            if let Some((_, removed)) = self.urls.pop_front() {
                self.bytes -= removed.len();
            }
        }
        self.bytes += url.len();
        self.urls.push_back((index, url));
    }
}
struct Lease {
    source_id: String,
    generation: u64,
    sequence_starts: HashMap<u16, u64>,
    play_key: String,
    source: Source,
    resources: Mutex<Resources>,
    media_expiry: Mutex<VecDeque<(String, u64)>>,
    playlists: Mutex<HashMap<String, String>>,
    previous: Mutex<Option<String>>,
    state: Mutex<Progress>,
    touched: Mutex<Instant>,
    created: Instant,
    retired: Mutex<Option<Instant>>,
    done: tokio::sync::watch::Sender<bool>,
}
#[derive(Default)]
struct Progress {
    session: Option<String>,
    ready: bool,
    failed: bool,
    closed: bool,
}
#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct GenerationState {
    generations: HashMap<String, u64>,
    sequences: HashMap<String, HashMap<u16, u64>>,
    #[serde(default)]
    targets: HashMap<String, HashMap<u16, u64>>,
}
struct Generations {
    state: GenerationState,
    path: PathBuf,
    _owner: GenerationOwner,
}
struct GenerationOwner(std::fs::File);
impl Drop for GenerationOwner {
    fn drop(&mut self) {
        // A child can briefly inherit this open file description before exec.
        // Release ownership now instead of waiting for its last descriptor.
        let _ = self.0.unlock();
    }
}
impl Generations {
    fn open(directory: &std::path::Path) -> Result<Self> {
        let path = directory.join(".generation");
        let lock = directory.join(".owner");
        for file in [&path, &lock] {
            if std::fs::symlink_metadata(file)
                .is_ok_and(|metadata| metadata.file_type().is_symlink())
            {
                bail!("normalization metadata cannot be a symlink");
            }
        }
        let owner = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(lock)?;
        owner
            .try_lock()
            .map_err(|_| anyhow::anyhow!("normalization directory already in use"))?;
        let owner = GenerationOwner(owner);
        let state: GenerationState = match std::fs::File::open(&path) {
            Ok(file) => {
                use std::io::Read;
                let mut bytes = Vec::new();
                file.take(131073).read_to_end(&mut bytes)?;
                if bytes.len() > 131072 {
                    bail!("invalid normalization generation");
                }
                serde_json::from_slice(&bytes).context("invalid normalization generation")?
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                GenerationState::default()
            }
            Err(error) => return Err(error.into()),
        };
        if state.generations.len() > 128
            || state
                .generations
                .values()
                .any(|generation| *generation > i64::MAX as u64 - 1_000_000)
            || state.targets.len() > 128
            || state.targets.values().any(|tracks| {
                tracks.len() > 17
                    || tracks
                        .iter()
                        .any(|(track, target)| *track > 16 || *target == 0 || *target > 3600)
            })
            || state.sequences.len() > 128
            || state.sequences.iter().any(|(id, tracks)| {
                id.is_empty()
                    || id.len() > 64
                    || !id
                        .bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
                    || tracks.len() > 17
                    || tracks.iter().any(|(track, sequence)| {
                        *track > 16 || *sequence > i64::MAX as u64 - 1_000_000
                    })
            })
        {
            bail!("invalid normalization sequence metadata");
        }
        // Only this manager's UUID session directories are expendable after a crash.
        for entry in std::fs::read_dir(directory)? {
            let entry = entry?;
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if name.len() == 32
                && name.bytes().all(|b| b.is_ascii_hexdigit())
                && entry.file_type()?.is_dir()
            {
                std::fs::remove_dir_all(entry.path())?;
            }
        }
        Ok(Self {
            state,
            path,
            _owner: owner,
        })
    }
    fn persist(&mut self, state: GenerationState) -> Result<()> {
        use std::io::Write;
        let temporary = self
            .path
            .with_extension(format!("{}.tmp", uuid::Uuid::new_v4().simple()));
        let result = (|| -> Result<()> {
            let mut options = std::fs::OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            let mut file = options.open(&temporary)?;
            file.write_all(&serde_json::to_vec(&state)?)?;
            file.sync_all()?;
            std::fs::rename(&temporary, &self.path)?;
            #[cfg(unix)]
            {
                std::fs::File::open(self.path.parent().unwrap())?.sync_all()?;
            }
            Ok(())
        })();
        if result.is_err() {
            let _ = std::fs::remove_file(&temporary);
        }
        result?;
        self.state = state;
        Ok(())
    }
    fn next(&mut self, source: &str) -> Result<(u64, HashMap<u16, u64>)> {
        let mut state = self.state.clone();
        let generation = state
            .generations
            .get(source)
            .copied()
            .unwrap_or(0)
            .checked_add(1)
            .context("normalization generation exhausted")?;
        if state.generations.len() >= 128 && !state.generations.contains_key(source) {
            bail!("normalization source history limit reached");
        }
        state.generations.insert(source.to_owned(), generation);
        let starts = state
            .sequences
            .get(source)
            .into_iter()
            .flat_map(|tracks| tracks.iter())
            .map(|(track, last)| {
                Ok((
                    *track,
                    last.checked_add(1)
                        .context("normalization sequence exhausted")?,
                ))
            })
            .collect::<Result<HashMap<_, _>>>()?;
        self.persist(state)?;
        Ok((generation, starts))
    }
    fn target(&mut self, source: &str, track: u16, target: u64) -> Result<u64> {
        if target == 0 || target > 3600 {
            bail!("invalid media target duration");
        }
        if let Some(previous) = self
            .state
            .targets
            .get(source)
            .and_then(|tracks| tracks.get(&track))
        {
            if target > *previous {
                bail!("source target duration changed");
            }
            return Ok(*previous);
        }
        let mut state = self.state.clone();
        state
            .targets
            .entry(source.to_owned())
            .or_default()
            .insert(track, target);
        self.persist(state)?;
        Ok(target)
    }
    fn published(&mut self, source: &str, track: u16, last: u64, target: u64) -> Result<u64> {
        let target = self.target(source, track, target)?;
        let previous = self
            .state
            .sequences
            .get(source)
            .and_then(|tracks| tracks.get(&track))
            .copied()
            .unwrap_or(0);
        if previous >= last {
            return Ok(target);
        }
        let mut state = self.state.clone();
        state
            .sequences
            .entry(source.to_owned())
            .or_default()
            .insert(track, last);
        self.persist(state)?;
        Ok(target)
    }
}

struct Gateway {
    settings: Settings,
    profiles: HashMap<String, Vec<u8>>,
    manager: Manager,
    leases: Mutex<HashMap<String, Arc<Lease>>>,
    client: reqwest::Client,
    internal: String,
    entries: tokio::sync::Mutex<HashMap<String, String>>,
    generation: Mutex<Generations>,
    fetch_slots: Arc<tokio::sync::Semaphore>,
    serve_slots: Arc<tokio::sync::Semaphore>,
}

/// Disabled unless the operator supplies a private JSON configuration file.
pub async fn routes_from_env(bound_host: &str) -> Result<Router> {
    let Some(file) = std::env::var_os("OTT_NORMALIZATION_CONFIG") else {
        return Ok(Router::new());
    };
    let settings: Settings = serde_json::from_slice(&tokio::fs::read(file).await?)
        .context("invalid normalization configuration")?;
    validate_bind(&settings.public_base, bound_host)?;
    configured_routes(settings).await
}
async fn configured_routes(settings: Settings) -> Result<Router> {
    validate_settings(&settings)?;
    let profiles = load_profiles(&settings.profiles).await?;
    let origins: Vec<HeaderValue> = settings
        .origins
        .iter()
        .map(|origin| origin.parse())
        .collect::<std::result::Result<_, _>>()?;
    let manager = Manager::new(Config {
        ffmpeg: settings.ffmpeg.clone(),
        ffprobe: settings.ffprobe.clone(),
        directory: settings.directory.clone(),
        sessions: 2,
        disk_limit: 96 * 1024 * 1024,
        startup_timeout: Duration::from_secs(25),
        idle_timeout: Duration::from_secs(45),
        lease_duration: Duration::from_secs(6 * 60 * 60),
    })
    .await?;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let internal = format!("http://{}", listener.local_addr()?);
    let client = source_client(&settings).await?;
    let generation = Generations::open(&settings.directory)?;
    let gateway = Arc::new(Gateway {
        settings,
        profiles,
        manager,
        leases: Mutex::new(HashMap::new()),
        client: client.clone(),
        internal,
        entries: tokio::sync::Mutex::new(HashMap::new()),
        generation: Mutex::new(generation),
        fetch_slots: Arc::new(tokio::sync::Semaphore::new(4)),
        serve_slots: Arc::new(tokio::sync::Semaphore::new(8)),
    });
    GATEWAYS
        .get_or_init(|| Mutex::new(Vec::new()))
        .lock()
        .unwrap()
        .push(Arc::downgrade(&gateway));
    let proxy = Router::new()
        .route("/fetch/:lease/:resource", get(fetch))
        .with_state(gateway.clone());
    tokio::spawn(async move {
        let _ = axum::serve(listener, proxy).await;
    });
    let cleanup = gateway.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(2));
        loop {
            interval.tick().await;
            let expired: Vec<_> = cleanup
                .leases
                .lock()
                .unwrap()
                .iter()
                .filter(|(_, lease)| {
                    expired(lease)
                        || (lease.retired.lock().unwrap().is_some()
                            && lease
                                .state
                                .lock()
                                .unwrap()
                                .session
                                .as_ref()
                                .is_some_and(|session| !cleanup.manager.is_active(session)))
                })
                .map(|(id, _)| id.clone())
                .collect();
            for id in expired {
                let _ = cleanup.close(&id);
            }
        }
    });
    Ok(Router::new()
        .route(
            "/normalize/config",
            get(|| async { Json(json!({"enabled":true,"protocol":1})) }),
        )
        .route(
            "/normalize/api",
            post(api).route_layer(axum::middleware::from_fn_with_state(
                gateway.clone(),
                admin_auth,
            )),
        )
        .route("/normalize/profile/:profile/:key/index.m3u", get(profile))
        .route("/normalize/media/:lease/:file", get(media))
        .route("/normalize/lease/:lease/:key/:file", get(leased_playlist))
        .route("/normalize/play/:source/:key/:file", get(play))
        .route(
            "/normalize/original/:source/:key/:lease/:resource",
            get(original),
        )
        .layer(DefaultBodyLimit::max(4096))
        .layer(
            CorsLayer::new()
                .allow_origin(origins)
                .allow_methods([Method::GET, Method::HEAD, Method::POST])
                .allow_headers([
                    axum::http::header::AUTHORIZATION,
                    axum::http::header::CONTENT_TYPE,
                ]),
        )
        .with_state(gateway))
}

async fn source_client(settings: &Settings) -> Result<reqwest::Client> {
    let mut builder = reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(8));
    let mut pinned = std::collections::HashSet::new();
    for source in settings.sources.values() {
        for origin in &source.allowed_origins {
            let url = reqwest::Url::parse(origin)?;
            let host = url.host_str().context("source hostname unavailable")?;
            if host.parse::<std::net::IpAddr>().is_ok() || !pinned.insert(host.to_string()) {
                continue;
            }
            let addresses = tokio::time::timeout(
                Duration::from_secs(3),
                tokio::net::lookup_host((
                    host,
                    url.port_or_known_default()
                        .context("source port unavailable")?,
                )),
            )
            .await
            .context("source resolution timed out")?
            .context("source resolution failed")?
            .take(16)
            .collect::<Vec<_>>();
            if addresses.is_empty() {
                bail!("source resolution empty");
            }
            builder = builder.resolve_to_addrs(host, &addresses);
        }
    }
    Ok(builder.build()?)
}

fn literal_loopback_base(base: &str) -> bool {
    let Some(authority) = base
        .strip_prefix("http://")
        .and_then(|v| v.split('/').next())
    else {
        return false;
    };
    authority == "127.0.0.1"
        || authority == "[::1]"
        || authority
            .strip_prefix("127.0.0.1:")
            .is_some_and(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()))
        || authority
            .strip_prefix("[::1]:")
            .is_some_and(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()))
}
fn validate_bind(base: &str, host: &str) -> Result<()> {
    if reqwest::Url::parse(base)?.scheme() == "http"
        && (!literal_loopback_base(base) || !matches!(host, "127.0.0.1" | "::1"))
    {
        bail!("HTTP normalization requires a literal loopback base and bind address");
    }
    Ok(())
}
fn validate_profiles(settings: &Settings) -> Result<()> {
    if settings.profiles.len() > 8 {
        bail!("profile registry too large");
    }
    let mut keys = std::collections::HashSet::new();
    for (id, profile) in &settings.profiles {
        if id.is_empty()
            || id.len() > 64
            || !id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
            || !profile.file.is_absolute()
            || !(32..=128).contains(&profile.key.len())
            || !profile
                .key
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
            || same_secret(&profile.key, &settings.key)
            || settings
                .sources
                .values()
                .any(|source| same_secret(&profile.key, &source.playback_key))
            || !keys.insert(&profile.key)
        {
            bail!("invalid independent profile registration");
        }
    }
    Ok(())
}
async fn load_profiles(profiles: &HashMap<String, Profile>) -> Result<HashMap<String, Vec<u8>>> {
    use tokio::io::AsyncReadExt;
    let mut snapshots = HashMap::new();
    for (id, profile) in profiles {
        let bytes = tokio::time::timeout(Duration::from_secs(3), async {
            let before = tokio::fs::symlink_metadata(&profile.file).await?;
            if !before.is_file() || before.len() > 4 * 1024 * 1024 {
                bail!("invalid profile file");
            }
            let file = tokio::fs::File::open(&profile.file).await?;
            let opened = file.metadata().await?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::MetadataExt;
                if before.dev() != opened.dev()
                    || before.ino() != opened.ino()
                    || opened.mode() & 0o077 != 0
                {
                    bail!("profile file must remain private and unchanged while opening");
                }
            }
            let mut bytes = Vec::new();
            file.take(4 * 1024 * 1024 + 1)
                .read_to_end(&mut bytes)
                .await?;
            if bytes.len() > 4 * 1024 * 1024
                || !std::str::from_utf8(&bytes)?
                    .trim_start_matches('\u{feff}')
                    .starts_with("#EXTM3U")
            {
                bail!("invalid profile snapshot");
            }
            Ok::<_, anyhow::Error>(bytes)
        })
        .await
        .context("profile snapshot timed out")??;
        snapshots.insert(id.clone(), bytes);
    }
    Ok(snapshots)
}
async fn profile(
    State(gateway): State<Shared>,
    Path((id, key)): Path<(String, String)>,
) -> Response {
    let Some(profile) = gateway.settings.profiles.get(&id) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    if !same_secret(&key, &profile.key) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    let Ok(permit) = gateway.serve_slots.clone().try_acquire_owned() else {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    };
    let mut response = guarded_response("audio/x-mpegurl", gateway.profiles[&id].clone(), permit);
    response.headers_mut().insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    response
}

fn validate_settings(settings: &Settings) -> Result<()> {
    if settings.key.len() < 32 || settings.key.len() > 256 {
        bail!("normalization key must contain 32 to 256 bytes");
    }
    if settings.sources.len() > 128 {
        bail!("source registry too large");
    }
    let base = reqwest::Url::parse(&settings.public_base)?;
    if !(base.scheme() == "https" || literal_loopback_base(&settings.public_base))
        || !base.username().is_empty()
        || base.password().is_some()
        || base.path() != "/"
        || base.query().is_some()
        || base.fragment().is_some()
    {
        bail!("normalization public base requires HTTPS");
    }
    validate_profiles(settings)?;
    for origin in &settings.origins {
        let url = reqwest::Url::parse(origin)?;
        let native = matches!(
            origin.as_str(),
            "tauri://localhost" | "capacitor://localhost"
        );
        let local = url.scheme() == "http"
            && matches!(
                url.host_str(),
                Some("localhost" | "127.0.0.1" | "[::1]" | "tauri.localhost")
            );
        if !native
            && (url.origin().ascii_serialization() != *origin
                || !(url.scheme() == "https" || local))
        {
            bail!("invalid normalization browser origin");
        }
    }
    let _: HeaderValue = format!("Bearer {}", settings.key).parse()?;
    for (id, source) in &settings.sources {
        if !(30..=60).contains(&source.preparation_budget_seconds)
            || !(1..=3).contains(&source.preparation_attempts)
        {
            bail!("invalid source preparation limits");
        }
        if id.is_empty()
            || id.len() > 64
            || !id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        {
            bail!("invalid normalization source identifier");
        }
        if source.playback_key.len() < 32
            || source.playback_key.len() > 128
            || !source
                .playback_key
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        {
            bail!("invalid source playback key");
        }
        if source.allowed_origins.len() > 64 {
            bail!("too many source origins");
        }
        for origin in &source.allowed_origins {
            let origin_url = reqwest::Url::parse(origin)?;
            if !matches!(origin_url.scheme(), "http" | "https")
                || origin_url.origin().ascii_serialization() != *origin
            {
                bail!("invalid source origin");
            }
        }
        let url = reqwest::Url::parse(&source.url)?;
        permitted(source, &url)?;
        for (name, value) in &source.headers {
            let name: axum::http::HeaderName = name.parse()?;
            let _: HeaderValue = value.parse()?;
            if ["host", "connection", "content-length", "transfer-encoding"]
                .contains(&name.as_str())
            {
                bail!("invalid source header");
            }
        }
    }
    Ok(())
}
fn permitted(source: &Source, url: &reqwest::Url) -> Result<()> {
    if url.as_str().len() > 16384
        || !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
        || !source
            .allowed_origins
            .contains(&url.origin().ascii_serialization())
    {
        bail!("source destination not authorized");
    }
    Ok(())
}
fn expired(lease: &Lease) -> bool {
    let preparing = {
        let state = lease.state.lock().unwrap();
        if state.closed {
            return true;
        }
        !state.ready && !state.failed
    };
    lease.retired.lock().unwrap().map_or_else(
        || {
            if preparing {
                // Reading/heartbeating a pending lease must not renew its absolute deadline.
                lease.created.elapsed() > lease.source.preparation_wait()
            } else {
                lease.touched.lock().unwrap().elapsed() > Duration::from_secs(40)
            }
        },
        |retired| retired.elapsed() > Duration::from_secs(180),
    )
}

async fn prepare_with_budget<T, F, Fut>(
    deadline: tokio::time::Instant,
    attempts: u8,
    mut attempt: F,
) -> Result<T>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T>>,
{
    tokio::time::timeout_at(deadline, async {
        let mut result = Err(anyhow::anyhow!("normalization unavailable"));
        for index in 0..attempts {
            result = attempt().await;
            if result.is_ok() {
                break;
            }
            if index + 1 < attempts {
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        }
        result
    })
    .await
    .context("normalization preparation timed out")?
}

fn same_secret(expected: &str, supplied: &str) -> bool {
    let mut expected_mac = Hmac::<Sha256>::new_from_slice(expected.as_bytes()).expect("HMAC key");
    expected_mac.update(b"normalization authorization");
    let digest = expected_mac.finalize().into_bytes();
    let mut supplied_mac = Hmac::<Sha256>::new_from_slice(supplied.as_bytes()).expect("HMAC key");
    supplied_mac.update(b"normalization authorization");
    supplied_mac.verify_slice(&digest).is_ok()
}
impl Gateway {
    fn close(&self, id: &str) -> Option<Arc<Lease>> {
        if let Some(lease) = self.leases.lock().unwrap().remove(id) {
            let mut state = lease.state.lock().unwrap();
            state.closed = true;
            // The manager uses this same lease ID even before admission finishes.
            self.manager.close(id);
            drop(state);
            return Some(lease);
        }
        None
    }
    fn lease(&self, id: &str) -> Result<Arc<Lease>> {
        let lease = self
            .leases
            .lock()
            .unwrap()
            .get(id)
            .cloned()
            .context("lease unavailable")?;
        if expired(&lease) {
            bail!("lease expired");
        }
        Ok(lease)
    }
    fn resource(&self, lease: &Lease, id: &str, url: reqwest::Url) -> Result<String> {
        permitted(&lease.source, &url)?;
        let extension = url_extension(url.path());
        let mut resources = lease.resources.lock().unwrap();
        let index = if url.as_str() == lease.source.url {
            0
        } else if let Some((index, _)) =
            resources.urls.iter().find(|(_, item)| item == url.as_str())
        {
            *index
        } else {
            let index = resources.next;
            resources.next = resources
                .next
                .checked_add(1)
                .context("source resource index exhausted")?;
            resources.insert(index, url.to_string());
            index
        };
        Ok(format!(
            "{}/fetch/{id}/{index}.{}",
            self.internal, extension
        ))
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    op: String,
    #[serde(rename = "sourceId")]
    source_id: Option<String>,
    lease: Option<String>,
}

fn prepare(gateway: &Shared, source_id: &str, source: Source) -> Result<String> {
    if gateway
        .leases
        .lock()
        .unwrap()
        .values()
        .filter(|lease| lease.retired.lock().unwrap().is_none())
        .count()
        >= 2
    {
        bail!("normalization capacity reached");
    }
    let id = uuid::Uuid::new_v4().simple().to_string();
    let (generation, sequence_starts) = gateway.generation.lock().unwrap().next(source_id)?;
    let lease = Arc::new(Lease {
        source_id: source_id.to_owned(),
        generation,
        sequence_starts,
        play_key: uuid::Uuid::new_v4().simple().to_string(),
        resources: Mutex::new(Resources {
            urls: VecDeque::new(),
            next: 1,
            bytes: 0,
        }),
        source,
        media_expiry: Mutex::new(VecDeque::new()),
        playlists: Mutex::new(HashMap::new()),
        previous: Mutex::new(None),
        state: Mutex::new(Progress::default()),
        touched: Mutex::new(Instant::now()),
        created: Instant::now(),
        retired: Mutex::new(None),
        done: tokio::sync::watch::channel(false).0,
    });
    {
        let mut leases = gateway.leases.lock().unwrap();
        if leases
            .values()
            .filter(|lease| lease.retired.lock().unwrap().is_none())
            .count()
            >= 2
        {
            bail!("normalization capacity reached");
        }
        leases.insert(id.clone(), lease.clone());
    }
    let worker = gateway.clone();
    let task_id = id.clone();
    tokio::spawn(async move {
        let _finished = Finish(lease.done.clone());
        let source = format!("{}/fetch/{task_id}/0.m3u8", worker.internal);
        let deadline =
            tokio::time::Instant::from_std(lease.created + lease.source.preparation_budget());
        let work = prepare_with_budget(deadline, lease.source.preparation_attempts, || async {
            let tracks = worker.manager.probe(&source).await?;
            if tracks.len() < 2 {
                return Ok(None);
            }
            let session = worker
                .manager
                .start_named(task_id.clone(), &source, &tracks)
                .await?;
            for track in 0..=tracks.len() {
                let admitted = async {
                    let bytes = worker
                        .manager
                        .read(&session, &format!("track_{track}.m3u8"))
                        .await?;
                    let playlist = std::str::from_utf8(&bytes)?;
                    let target = playlist_number(playlist, "#EXT-X-TARGETDURATION:")
                        .context("missing target duration")?;
                    let fixed = worker.generation.lock().unwrap().target(
                        &lease.source_id,
                        track as u16,
                        target,
                    )?;
                    validate_live_window(playlist, fixed)
                }
                .await;
                if let Err(error) = admitted {
                    worker.manager.close_and_wait(&session).await?;
                    return Err(error);
                }
            }
            Ok(Some(session))
        });
        // Own the future so expiry drops a pending probe before waiting for producer cleanup.
        let mut work = Box::pin(work);
        let result = loop {
            tokio::select! {
                result = &mut work => break result,
                _ = tokio::time::sleep(Duration::from_millis(100)) => {
                    if expired(&lease) {
                        drop(work);
                        let _ = worker.manager.close_and_wait(&task_id).await;
                        return;
                    }
                }
            }
        };
        drop(work);
        if result.is_err() {
            // A deadline may expire after the producer starts but during admission.
            let _ = worker.manager.close_and_wait(&task_id).await;
        }
        if let Some(session) = complete_preparation(&lease, result) {
            worker.manager.close(&session);
        }
    });
    Ok(id)
}

// Returns a producer that completed after explicit close and must be revoked.
fn complete_preparation(lease: &Lease, result: Result<Option<String>>) -> Option<String> {
    let mut state = lease.state.lock().unwrap();
    match result {
        Ok(session) if state.closed => return session,
        Ok(session) => {
            *lease.touched.lock().unwrap() = Instant::now();
            state.session = session;
            state.ready = true;
        }
        Err(_) => {
            if !state.closed {
                *lease.touched.lock().unwrap() = Instant::now();
            }
            state.failed = true;
        }
    }
    None
}

async fn admin_auth(
    State(gateway): State<Shared>,
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> Response {
    let headers = request.headers();
    let supplied = headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .unwrap_or("");
    if !same_secret(&gateway.settings.key, supplied) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    if let Some(origin) = headers.get("origin") {
        if !gateway
            .settings
            .origins
            .iter()
            .any(|allowed| origin.as_bytes() == allowed.as_bytes())
        {
            return StatusCode::FORBIDDEN.into_response();
        }
    }
    next.run(request).await
}

async fn api(State(gateway): State<Shared>, Json(request): Json<Request>) -> Response {
    match request.op.as_str() {
        "prepare" => {
            let Some(source_id) = request.source_id else {
                return StatusCode::NOT_FOUND.into_response();
            };
            let Some(source) = gateway.settings.sources.get(&source_id).cloned() else {
                return StatusCode::NOT_FOUND.into_response();
            };
            let id = match prepare(&gateway, &source_id, source) {
                Ok(id) => id,
                Err(_) => return StatusCode::TOO_MANY_REQUESTS.into_response(),
            };
            (
                StatusCode::ACCEPTED,
                Json(json!({"lease":id,"state":"preparing"})),
            )
                .into_response()
        }
        "close" => {
            if let Some(id) = request.lease {
                if let Some(lease) = gateway.close(&id) {
                    let mut done = lease.done.subscribe();
                    if tokio::time::timeout(Duration::from_secs(5), async {
                        while !*done.borrow_and_update() {
                            if done.changed().await.is_err() {
                                break;
                            }
                        }
                    })
                    .await
                    .is_err()
                        || gateway.manager.close_and_wait(&id).await.is_err()
                    {
                        return StatusCode::SERVICE_UNAVAILABLE.into_response();
                    }
                }
            }
            StatusCode::NO_CONTENT.into_response()
        }
        "status" | "heartbeat" => {
            let Some(id) = request.lease else {
                return StatusCode::BAD_REQUEST.into_response();
            };
            let Ok(lease) = gateway.lease(&id) else {
                return StatusCode::GONE.into_response();
            };
            *lease.touched.lock().unwrap() = Instant::now();
            let state = lease.state.lock().unwrap();
            let active = state
                .session
                .as_ref()
                .is_some_and(|session| gateway.manager.is_producing(session));
            let status = if state.failed || (state.session.is_some() && !active) {
                "unavailable"
            } else if !state.ready {
                "preparing"
            } else if state.session.is_none() {
                "original"
            } else {
                "ready"
            };
            let master = active.then(|| {
                format!(
                    "{}/normalize/lease/{id}/{}/master.m3u8",
                    gateway.settings.public_base.trim_end_matches('/'),
                    lease.play_key
                )
            });
            Json(json!({"state":status,"masterURL":master})).into_response()
        }
        _ => StatusCode::BAD_REQUEST.into_response(),
    }
}

struct GuardedBytes {
    bytes: Vec<u8>,
    _permit: tokio::sync::OwnedSemaphorePermit,
}
impl AsRef<[u8]> for GuardedBytes {
    fn as_ref(&self) -> &[u8] {
        &self.bytes
    }
}
fn guarded_response(
    mime: &str,
    bytes: Vec<u8>,
    permit: tokio::sync::OwnedSemaphorePermit,
) -> Response {
    let owned = axum::body::Bytes::from_owner(GuardedBytes {
        bytes,
        _permit: permit,
    });
    let mut response = Response::new(axum::body::Body::from(owned));
    response.headers_mut().insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_str(mime).expect("fixed MIME"),
    );
    response.headers_mut().insert(
        axum::http::header::CACHE_CONTROL,
        HeaderValue::from_static("private, no-store"),
    );
    response.headers_mut().insert(
        axum::http::header::REFERRER_POLICY,
        HeaderValue::from_static("no-referrer"),
    );
    response
}

async fn original(
    State(gateway): State<Shared>,
    Path((source_id, key, id, resource)): Path<(String, String, String, usize)>,
) -> Response {
    let Some(source) = gateway.settings.sources.get(&source_id) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    if !same_secret(&source.playback_key, &key) {
        return StatusCode::NOT_FOUND.into_response();
    }
    let Ok(lease) = gateway.lease(&id) else {
        return StatusCode::GONE.into_response();
    };
    if lease.source_id != source_id {
        return StatusCode::NOT_FOUND.into_response();
    }
    *lease.touched.lock().unwrap() = Instant::now();
    match fetch_resource(&gateway, &id, resource).await {
        Ok((mime, bytes, permit)) => {
            let bytes = if mime == "application/vnd.apple.mpegurl" {
                let Ok(playlist) = String::from_utf8(bytes) else {
                    return StatusCode::BAD_GATEWAY.into_response();
                };
                let prefix = format!("{}/fetch/{id}/", gateway.internal);
                match rewrite(&playlist, |url| {
                    let index = url
                        .strip_prefix(&prefix)
                        .context("invalid internal resource")?
                        .split('.')
                        .next()
                        .unwrap_or("")
                        .parse::<usize>()?;
                    Ok(format!(
                        "{}/normalize/original/{source_id}/{key}/{id}/{index}",
                        gateway.settings.public_base.trim_end_matches('/')
                    ))
                }) {
                    Ok(playlist) => playlist.into_bytes(),
                    Err(_) => return StatusCode::BAD_GATEWAY.into_response(),
                }
            } else {
                bytes
            };
            guarded_response(&mime, bytes, permit)
        }
        Err(_) => StatusCode::BAD_GATEWAY.into_response(),
    }
}
struct Finish(tokio::sync::watch::Sender<bool>);
impl Drop for Finish {
    fn drop(&mut self) {
        self.0.send_replace(true);
    }
}
#[derive(Deserialize, Default)]
struct Signature {
    #[serde(default)]
    expires: u64,
    #[serde(default)]
    signature: String,
}
fn epoch() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
fn media_tag(gateway: &Gateway, id: &str, file: &str, expires: u64) -> String {
    let mut mac =
        Hmac::<Sha256>::new_from_slice(gateway.settings.key.as_bytes()).expect("HMAC key");
    mac.update(format!("{id}\n{file}\n{expires}").as_bytes());
    mac.finalize()
        .into_bytes()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}
fn playlist_number(playlist: &str, tag: &str) -> Option<u64> {
    playlist
        .lines()
        .find_map(|line| line.strip_prefix(tag))?
        .parse()
        .ok()
}
fn playlist_end(playlist: &str) -> Option<u64> {
    playlist_number(playlist, "#EXT-X-MEDIA-SEQUENCE:")?.checked_add(
        playlist
            .lines()
            .filter(|line| line.starts_with("#EXTINF:"))
            .count() as u64,
    )
}
fn remember_playlist(snapshots: &mut HashMap<String, String>, file: &str, playlist: String) {
    if playlist_end(&playlist).is_some_and(|end| {
        snapshots
            .get(file)
            .and_then(|old| playlist_end(old))
            .is_none_or(|old| old <= end)
    }) {
        snapshots.insert(file.to_owned(), playlist);
    }
}
fn stitch_playlists(old: &str, new: &str, gap: u64) -> Option<String> {
    if !(1..=64).contains(&gap) {
        return None;
    }
    let start = playlist_number(old, "#EXT-X-MEDIA-SEQUENCE:")?;
    let old_count = old
        .lines()
        .filter(|line| line.starts_with("#EXTINF:"))
        .count() as u64;
    if start.checked_add(old_count)? != playlist_number(new, "#EXT-X-MEDIA-SEQUENCE:")? {
        return None;
    }
    let target = playlist_number(old, "#EXT-X-TARGETDURATION:")?
        .max(playlist_number(new, "#EXT-X-TARGETDURATION:")?);
    let discontinuity = playlist_number(old, "#EXT-X-DISCONTINUITY-SEQUENCE:")?;
    let body = |playlist: &str| {
        playlist
            .lines()
            .filter(|line| {
                !line.is_empty()
                    && ![
                        "#EXTM3U",
                        "#EXT-X-VERSION:",
                        "#EXT-X-TARGETDURATION:",
                        "#EXT-X-MEDIA-SEQUENCE:",
                        "#EXT-X-DISCONTINUITY-SEQUENCE:",
                        "#EXT-X-ENDLIST",
                    ]
                    .iter()
                    .any(|prefix| line.starts_with(prefix))
            })
            .collect::<Vec<_>>()
            .join("\n")
    };
    let combined = format!("#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:{target}\n#EXT-X-MEDIA-SEQUENCE:{start}\n#EXT-X-DISCONTINUITY-SEQUENCE:{discontinuity}\n{}\n{}{}\n", body(old), "#EXT-X-DISCONTINUITY\n".repeat((gap - 1) as usize), body(new));
    (combined.len() <= 256 * 1024).then_some(combined)
}
fn finish_playlist(gateway: &Gateway, lease: &Lease, file: &str, playlist: String) -> String {
    let Some(track) = file
        .strip_prefix("track_")
        .and_then(|name| name.strip_suffix(".m3u8"))
        .and_then(|value| value.parse::<u16>().ok())
        .filter(|track| *track <= 16)
    else {
        return playlist;
    };
    if playlist.len() > 65536 {
        return playlist;
    }
    {
        let mut snapshots = lease.playlists.lock().unwrap();
        remember_playlist(&mut snapshots, file, playlist.clone());
    }
    if playlist_number(&playlist, "#EXT-X-MEDIA-SEQUENCE:")
        != Some(lease.sequence_starts.get(&track).copied().unwrap_or(0))
    {
        return playlist;
    }
    let Some(previous) = lease.previous.lock().unwrap().clone() else {
        return playlist;
    };
    let Ok(old) = gateway.lease(&previous) else {
        return playlist;
    };
    if old.source_id != lease.source_id
        || !old
            .state
            .lock()
            .unwrap()
            .session
            .as_ref()
            .is_some_and(|id| gateway.manager.is_active(id))
    {
        return playlist;
    }
    let snapshot = old.playlists.lock().unwrap().get(file).cloned();
    snapshot
        .and_then(|old_playlist| {
            stitch_playlists(
                &old_playlist,
                &playlist,
                lease.generation.saturating_sub(old.generation),
            )
        })
        .unwrap_or(playlist)
}

fn validate_live_window(playlist: &str, target: u64) -> Result<()> {
    let duration = playlist
        .lines()
        .filter_map(|line| line.strip_prefix("#EXTINF:"))
        .map(|value| {
            value
                .split(',')
                .next()
                .and_then(|value| value.parse::<f64>().ok())
        })
        .collect::<Option<Vec<_>>>()
        .context("invalid media duration")?
        .iter()
        .sum::<f64>();
    if !duration.is_finite() || duration < target as f64 * 3.0 {
        bail!("media window is shorter than three target durations");
    }
    Ok(())
}
fn published_playlist(
    gateway: &Gateway,
    lease: &Lease,
    file: &str,
    playlist: &str,
) -> Result<String> {
    let Some(track) = file
        .strip_prefix("track_")
        .and_then(|name| name.strip_suffix(".m3u8"))
        .and_then(|name| name.parse::<u16>().ok())
    else {
        return Ok(playlist.to_owned());
    };
    let start: u64 = playlist
        .lines()
        .find_map(|line| line.strip_prefix("#EXT-X-MEDIA-SEQUENCE:"))
        .context("missing sequence")?
        .parse()?;
    let base = lease.sequence_starts.get(&track).copied().unwrap_or(0);
    let count = playlist
        .lines()
        .filter(|line| line.starts_with("#EXTINF:"))
        .count() as u64;
    let last = start
        .checked_add(base)
        .and_then(|start| start.checked_add(count.checked_sub(1)?))
        .context("sequence exhausted")?;
    let target =
        playlist_number(playlist, "#EXT-X-TARGETDURATION:").context("missing target duration")?;
    let floor = {
        let mut generations = gateway.generation.lock().unwrap();
        let fixed = generations.target(&lease.source_id, track, target)?;
        validate_live_window(playlist, fixed)?;
        generations.published(&lease.source_id, track, last, target)?
    };
    let playlist = playlist.replace(
        &format!("#EXT-X-TARGETDURATION:{target}\n"),
        &format!("#EXT-X-TARGETDURATION:{floor}\n"),
    );
    Ok(generation_playlist(&playlist, lease.generation, base))
}
fn generation_playlist(playlist: &str, generation: u64, sequence_base: u64) -> String {
    if !playlist.contains("#EXT-X-TARGETDURATION:") {
        return playlist.to_owned();
    }
    let sequence = playlist
        .lines()
        .find_map(|line| line.strip_prefix("#EXT-X-MEDIA-SEQUENCE:"))
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(0);
    let at_start = sequence == 0;
    let discontinuity = generation.saturating_sub(u64::from(at_start));
    let mut result = playlist
        .replacen(
            "#EXTM3U\n",
            &format!("#EXTM3U\n#EXT-X-DISCONTINUITY-SEQUENCE:{discontinuity}\n"),
            1,
        )
        .replacen(
            &format!("#EXT-X-MEDIA-SEQUENCE:{sequence}\n"),
            &format!("#EXT-X-MEDIA-SEQUENCE:{}\n", sequence + sequence_base),
            1,
        );
    if at_start {
        let before = if result.contains("#EXT-X-MAP:") {
            "#EXT-X-MAP:"
        } else {
            "#EXTINF:"
        };
        result = result.replacen(before, &format!("#EXT-X-DISCONTINUITY\n{before}"), 1);
    }
    result
}

fn fragment_expiry(entries: &mut VecDeque<(String, u64)>, file: &str, now: u64) -> u64 {
    if let Some((_, expires)) = entries
        .iter()
        .find(|(name, expires)| name == file && *expires > now)
    {
        return *expires;
    }
    entries.retain(|(name, expires)| name != file && *expires > now);
    if entries.len() >= 256 {
        entries.pop_front();
    }
    let expires = now + 600;
    entries.push_back((file.to_owned(), expires));
    expires
}
fn signed_media(gateway: &Gateway, id: &str, file: &str) -> String {
    let now = epoch();
    let expires = gateway
        .lease(id)
        .map(|lease| fragment_expiry(&mut lease.media_expiry.lock().unwrap(), file, now))
        .unwrap_or(now + 600);
    format!(
        "{}/normalize/media/{id}/{file}?expires={expires}&signature={}",
        gateway.settings.public_base.trim_end_matches('/'),
        media_tag(gateway, id, file, expires)
    )
}
fn verify_media(gateway: &Gateway, id: &str, file: &str, signature: &Signature) -> bool {
    signature.expires >= epoch()
        && signature.expires <= epoch() + 600
        && same_secret(
            &media_tag(gateway, id, file, signature.expires),
            &signature.signature,
        )
}
async fn play(
    State(gateway): State<Shared>,
    Path((source_id, key, file)): Path<(String, String, String)>,
) -> Response {
    let Some(source) = gateway.settings.sources.get(&source_id) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    if !same_secret(&source.playback_key, &key)
        || !(file.ends_with(".m3u8") || file.ends_with("_init.mp4"))
    {
        return StatusCode::NOT_FOUND.into_response();
    }
    // A single producer is shared by all readers of this explicitly registered source.
    let mut entries = gateway.entries.lock().await;
    let mut id = entries.get(&source_id).cloned();
    let mut previous = None;
    if id.as_ref().is_some_and(|id| {
        gateway.lease(id).map_or(true, |lease| {
            let state = lease.state.lock().unwrap();
            state
                .session
                .as_ref()
                .is_some_and(|session| !gateway.manager.is_producing(session))
                || (file != "master.m3u8"
                    && state.failed
                    && lease.created.elapsed() >= Duration::from_secs(3))
        })
    }) {
        if let Some(old) = &id {
            if let Ok(lease) = gateway.lease(old) {
                let empty = lease.state.lock().unwrap().session.is_none();
                previous = if empty {
                    lease.previous.lock().unwrap().clone()
                } else {
                    Some(old.clone())
                };
                if empty {
                    let _ = gateway.close(old);
                } else {
                    *lease.retired.lock().unwrap() = Some(Instant::now());
                }
            }
        }
        id = None;
    }
    if id.is_none() {
        id = match prepare(&gateway, &source_id, source.clone()) {
            Ok(id) => Some(id),
            Err(_) => return StatusCode::TOO_MANY_REQUESTS.into_response(),
        };
        if let Some(id) = &id {
            if let Ok(lease) = gateway.lease(id) {
                *lease.previous.lock().unwrap() = previous;
            }
            entries.insert(source_id.clone(), id.clone());
        }
    }
    let Some(id) = id else {
        return StatusCode::BAD_GATEWAY.into_response();
    };
    drop(entries);
    let lease = match gateway.lease(&id) {
        Ok(lease) => lease,
        Err(_) => return StatusCode::GONE.into_response(),
    };
    let waited = tokio::time::timeout_at(
        tokio::time::Instant::from_std(lease.created + lease.source.preparation_wait()),
        async {
            loop {
                let finished = {
                    let state = lease.state.lock().unwrap();
                    state.ready || state.failed || state.closed
                };
                if finished {
                    return;
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        },
    )
    .await;
    let session = lease.state.lock().unwrap().session.clone();
    let Some(session) = session else {
        let _ = waited;
        return if file == "master.m3u8" {
            original(State(gateway), Path((source_id, key, id, 0))).await
        } else {
            StatusCode::SERVICE_UNAVAILABLE.into_response()
        };
    };
    let Ok(permit) = gateway.serve_slots.clone().try_acquire_owned() else {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    };
    match gateway.manager.read(&session, &file).await {
        Ok(bytes) => {
            *lease.touched.lock().unwrap() = Instant::now();
            if file.ends_with("_init.mp4") {
                return guarded_response("video/mp4", bytes, permit);
            }
            let Ok(playlist) = String::from_utf8(bytes) else {
                return StatusCode::BAD_GATEWAY.into_response();
            };
            let Ok(playlist) = published_playlist(&gateway, &lease, &file, &playlist) else {
                return StatusCode::SERVICE_UNAVAILABLE.into_response();
            };
            let result = rewrite(&playlist, |child| {
                if child.ends_with(".m3u8") {
                    Ok(format!(
                        "{}/normalize/play/{source_id}/{key}/{child}",
                        gateway.settings.public_base.trim_end_matches('/')
                    ))
                } else if child.ends_with("_init.mp4") {
                    Ok(format!(
                        "{}/normalize/lease/{id}/{}/{child}",
                        gateway.settings.public_base.trim_end_matches('/'),
                        lease.play_key
                    ))
                } else {
                    Ok(signed_media(&gateway, &id, child))
                }
            });
            match result {
                Ok(playlist) => guarded_response(
                    "application/vnd.apple.mpegurl",
                    finish_playlist(&gateway, &lease, &file, playlist).into_bytes(),
                    permit,
                ),
                Err(_) => StatusCode::BAD_GATEWAY.into_response(),
            }
        }
        Err(_) => StatusCode::SERVICE_UNAVAILABLE.into_response(),
    }
}

async fn leased_playlist(
    State(gateway): State<Shared>,
    Path((id, key, file)): Path<(String, String, String)>,
) -> Response {
    if !(file.ends_with(".m3u8") || file.ends_with("_init.mp4")) {
        return StatusCode::NOT_FOUND.into_response();
    }
    let Ok(lease) = gateway.lease(&id) else {
        return StatusCode::GONE.into_response();
    };
    if !same_secret(&lease.play_key, &key) {
        return StatusCode::NOT_FOUND.into_response();
    }
    let session = lease.state.lock().unwrap().session.clone();
    let Some(session) = session else {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    };
    let Ok(permit) = gateway.serve_slots.clone().try_acquire_owned() else {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    };
    match gateway.manager.read(&session, &file).await {
        Ok(bytes) => {
            *lease.touched.lock().unwrap() = Instant::now();
            if file.ends_with("_init.mp4") {
                return guarded_response("video/mp4", bytes, permit);
            }
            let Ok(playlist) = String::from_utf8(bytes) else {
                return StatusCode::BAD_GATEWAY.into_response();
            };
            let Ok(playlist) = published_playlist(&gateway, &lease, &file, &playlist) else {
                return StatusCode::SERVICE_UNAVAILABLE.into_response();
            };
            let result = rewrite(&playlist, |child| {
                if child.ends_with(".m3u8") || child.ends_with("_init.mp4") {
                    Ok(format!(
                        "{}/normalize/lease/{id}/{key}/{child}",
                        gateway.settings.public_base.trim_end_matches('/')
                    ))
                } else {
                    Ok(signed_media(&gateway, &id, child))
                }
            });
            match result {
                Ok(playlist) => guarded_response(
                    "application/vnd.apple.mpegurl",
                    finish_playlist(&gateway, &lease, &file, playlist).into_bytes(),
                    permit,
                ),
                Err(_) => StatusCode::BAD_GATEWAY.into_response(),
            }
        }
        Err(_) => StatusCode::SERVICE_UNAVAILABLE.into_response(),
    }
}

async fn media(
    State(gateway): State<Shared>,
    Path((id, file)): Path<(String, String)>,
    Query(signature): Query<Signature>,
) -> Response {
    if !verify_media(&gateway, &id, &file, &signature) {
        return StatusCode::GONE.into_response();
    }
    let Ok(lease) = gateway.lease(&id) else {
        return StatusCode::GONE.into_response();
    };
    let session = lease.state.lock().unwrap().session.clone();
    let Some(session) = session else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let Ok(permit) = gateway.serve_slots.clone().try_acquire_owned() else {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    };
    match gateway.manager.read(&session, &file).await {
        Ok(bytes) => {
            *lease.touched.lock().unwrap() = Instant::now();
            let mime = if file.ends_with(".m3u8") {
                "application/vnd.apple.mpegurl"
            } else if file.ends_with(".ts") {
                "video/mp2t"
            } else {
                "video/mp4"
            };
            let bytes = if file.ends_with(".m3u8") {
                match String::from_utf8(bytes).ok().and_then(|playlist| {
                    rewrite(&playlist, |file| Ok(signed_media(&gateway, &id, file))).ok()
                }) {
                    Some(playlist) => playlist.into_bytes(),
                    None => return StatusCode::BAD_GATEWAY.into_response(),
                }
            } else {
                bytes
            };
            guarded_response(mime, bytes, permit)
        }
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}
async fn fetch(
    State(gateway): State<Shared>,
    Path((id, resource)): Path<(String, String)>,
) -> Response {
    let Ok(resource) = resource.split('.').next().unwrap_or("").parse::<usize>() else {
        return StatusCode::NOT_FOUND.into_response();
    };
    match fetch_resource(&gateway, &id, resource).await {
        Ok((mime, bytes, permit)) => guarded_response(&mime, bytes, permit),
        Err(_) => StatusCode::BAD_GATEWAY.into_response(),
    }
}
async fn fetch_resource(
    gateway: &Gateway,
    id: &str,
    resource: usize,
) -> Result<(String, Vec<u8>, tokio::sync::OwnedSemaphorePermit)> {
    let permit = gateway
        .fetch_slots
        .clone()
        .try_acquire_owned()
        .context("source capacity reached")?;
    let lease = gateway.lease(id)?;
    let original = if resource == 0 {
        lease.source.url.clone()
    } else {
        lease
            .resources
            .lock()
            .unwrap()
            .urls
            .iter()
            .find(|(index, _)| *index == resource)
            .map(|(_, url)| url.clone())
            .context("source resource unavailable")?
    };
    let mut url = reqwest::Url::parse(&original)?;
    let source_origin = reqwest::Url::parse(&lease.source.url)?.origin();
    for attempt in 0..=3 {
        permitted(&lease.source, &url)?;
        let mut request = gateway.client.get(url.clone());
        if url.origin() == source_origin {
            for (name, value) in &lease.source.headers {
                request = request.header(name, value);
            }
        }
        let mut response = request.send().await?;
        if response.status().is_redirection() {
            if attempt == 3 {
                bail!("source redirect limit reached");
            }
            url = url.join(
                response
                    .headers()
                    .get("location")
                    .context("source redirect unavailable")?
                    .to_str()?,
            )?;
            continue;
        }
        if !response.status().is_success() {
            bail!("source request failed");
        }
        if response
            .content_length()
            .is_some_and(|size| size > 16 * 1024 * 1024)
        {
            bail!("source resource limit reached");
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await? {
            if bytes.len() + chunk.len() > 16 * 1024 * 1024 {
                bail!("source resource limit reached");
            }
            bytes.extend_from_slice(&chunk);
        }
        let text = std::str::from_utf8(&bytes)
            .ok()
            .map(|text| text.trim_start_matches('\u{feff}').trim_start());
        if text.is_some_and(|text| text.starts_with("#EXTM3U")) {
            if bytes.len() > 1024 * 1024 {
                bail!("source playlist limit reached");
            }
            let playlist = text.expect("recognized playlist");
            let rewritten = rewrite(playlist, |reference| {
                gateway.resource(&lease, id, url.join(reference)?)
            })?;
            return Ok((
                "application/vnd.apple.mpegurl".into(),
                rewritten.into_bytes(),
                permit,
            ));
        }
        if resource == 0 || url.path().ends_with(".m3u8") {
            bail!("source playlist unavailable");
        }
        return Ok(("application/octet-stream".into(), bytes, permit));
    }
    bail!("source request failed")
}
fn url_extension(path: &str) -> &str {
    match path.rsplit('.').next().unwrap_or("") {
        "m3u8" => "m3u8",
        "m4s" => "m4s",
        "mp4" => "mp4",
        "aac" => "aac",
        "vtt" => "vtt",
        "key" => "key",
        _ => "ts",
    }
}
fn rewrite(playlist: &str, mut resource: impl FnMut(&str) -> Result<String>) -> Result<String> {
    let mut output = String::new();
    for line in playlist.lines() {
        let line = line.trim();
        if !line.is_empty() && !line.starts_with('#') {
            output.push_str(&resource(line)?);
        } else {
            let mut rest = line;
            for (at, _) in line.match_indices("URI=") {
                if !line[at..].starts_with("URI=\"") {
                    bail!("unquoted source URI");
                }
            }
            while let Some(at) = rest.find("URI=\"") {
                output.push_str(&rest[..at + 5]);
                rest = &rest[at + 5..];
                let end = rest.find('"').context("invalid source URI")?;
                output.push_str(&resource(&rest[..end])?);
                output.push('"');
                rest = &rest[end + 1..];
            }
            output.push_str(rest);
        }
        output.push('\n');
        if output.len() > 2 * 1024 * 1024 {
            bail!("rewritten playlist exceeds limit");
        }
    }
    Ok(output)
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    fn sample_source() -> Source {
        serde_json::from_value(json!({
            "url":"https://media.example/stream.m3u8",
            "allowed_origins":["https://media.example"],
            "playback_key":"p".repeat(40)
        }))
        .unwrap()
    }
    fn sample_settings(source: Source) -> Settings {
        Settings {
            key: "k".repeat(40),
            public_base: "https://media.example".into(),
            origins: vec![],
            ffmpeg: "/unused/ffmpeg".into(),
            ffprobe: "/unused/ffprobe".into(),
            directory: "/unused/state".into(),
            profiles: HashMap::new(),
            sources: HashMap::from([("demo".into(), source)]),
        }
    }
    fn sample_lease(created: Duration, touched: Duration) -> Lease {
        Lease {
            source_id: "demo".into(),
            generation: 1,
            sequence_starts: HashMap::new(),
            play_key: "p".repeat(40),
            source: sample_source(),
            resources: Mutex::new(Resources {
                urls: VecDeque::new(),
                next: 1,
                bytes: 0,
            }),
            media_expiry: Mutex::new(VecDeque::new()),
            playlists: Mutex::new(HashMap::new()),
            previous: Mutex::new(None),
            state: Mutex::new(Progress::default()),
            touched: Mutex::new(Instant::now() - touched),
            created: Instant::now() - created,
            retired: Mutex::new(None),
            done: tokio::sync::watch::channel(false).0,
        }
    }
    async fn shutdown_test_gateways(directory: &std::path::Path) {
        let gateways: Vec<_> = registered_gateways()
            .into_iter()
            .filter(|gateway| gateway.settings.directory.starts_with(directory))
            .collect();
        assert!(
            !gateways.is_empty(),
            "test teardown matched no owned gateways"
        );
        shutdown_gateways(gateways).await;
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn fixture_shutdown_preserves_another_gateways_existing_lease() {
        use tower::ServiceExt;

        let root =
            std::env::temp_dir().join(format!("ott-shutdown-scope-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        // Never open these executable fixtures for writing during parallel tests.
        let executables =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/normalization");
        let owned_root = root.join("owned");
        // A textual prefix is not ownership: this sibling must remain available.
        let other_root = root.join("owned-sibling");
        let mut fixtures = Vec::new();
        for directory in [&owned_root, &other_root] {
            let mut source = sample_source();
            source.url = "http://127.0.0.1:9/source.m3u8".into();
            source.allowed_origins = vec!["http://127.0.0.1:9".into()];
            let mut settings = sample_settings(source);
            settings.ffmpeg = executables.join("ffmpeg");
            settings.ffprobe = executables.join("ffprobe");
            settings.directory = directory.join("state");
            let app = configured_routes(settings).await.unwrap();
            let gateway = registered_gateways()
                .into_iter()
                .find(|gateway| gateway.settings.directory == directory.join("state"))
                .unwrap();
            let lease = Arc::new(sample_lease(Duration::ZERO, Duration::ZERO));
            // No producer is needed to prove lease ownership; its completion is immediate.
            lease.done.send_replace(true);
            let id = uuid::Uuid::new_v4().simple().to_string();
            gateway
                .leases
                .lock()
                .unwrap()
                .insert(id.clone(), lease.clone());
            fixtures.push((app, gateway, id, lease));
        }
        shutdown_test_gateways(&owned_root).await;
        for (index, (app, gateway, id, lease)) in fixtures.iter().enumerate() {
            let response = app
                .clone()
                .oneshot(
                    axum::http::Request::builder()
                        .method("POST")
                        .uri("/normalize/api")
                        .header("authorization", format!("Bearer {}", "k".repeat(40)))
                        .header("content-type", "application/json")
                        .body(axum::body::Body::from(
                            json!({"op":"status","lease":id}).to_string(),
                        ))
                        .unwrap(),
                )
                .await
                .unwrap();
            if index == 0 {
                assert_eq!(response.status(), StatusCode::GONE);
                assert!(lease.state.lock().unwrap().closed);
            } else {
                assert_eq!(response.status(), StatusCode::OK);
                assert!(!lease.state.lock().unwrap().closed);
                assert!(Arc::ptr_eq(&gateway.lease(id).unwrap(), lease));
                let body = axum::body::to_bytes(response.into_body(), 4096)
                    .await
                    .unwrap();
                let status: Value = serde_json::from_slice(&body).unwrap();
                assert_eq!(status["state"], "preparing");
            }
        }
        shutdown_test_gateways(&other_root).await;
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn preparation_defaults_and_bounds_are_explicit() {
        let source = sample_source();
        assert_eq!(source.preparation_budget_seconds, 30);
        assert_eq!(source.preparation_attempts, 2);
        assert_eq!(source.preparation_wait(), Duration::from_secs(35));
        assert!(validate_settings(&sample_settings(source)).is_ok());
        for (budget, attempts, valid) in [
            (30, 1, true),
            (60, 3, true),
            (29, 2, false),
            (61, 2, false),
            (45, 0, false),
            (45, 4, false),
        ] {
            let mut source = sample_source();
            source.preparation_budget_seconds = budget;
            source.preparation_attempts = attempts;
            assert_eq!(validate_settings(&sample_settings(source)).is_ok(), valid);
        }
    }
    #[test]
    fn preparing_expiry_is_absolute_and_ready_idle_policy_is_unchanged() {
        let mut lease = sample_lease(Duration::from_secs(44), Duration::from_secs(44));
        lease.source.preparation_budget_seconds = 45;
        assert!(
            !expired(&lease),
            "extended preparation must survive the normal40s idle deadline"
        );
        lease.created = Instant::now() - Duration::from_secs(51);
        *lease.touched.lock().unwrap() = Instant::now();
        assert!(expired(&lease), "heartbeat cannot extend preparation");
        lease.state.lock().unwrap().ready = true;
        assert!(
            !expired(&lease),
            "ready uses last activity rather than creation"
        );
        *lease.touched.lock().unwrap() = Instant::now() - Duration::from_secs(41);
        assert!(expired(&lease));
        *lease.touched.lock().unwrap() = Instant::now();
        lease.state.lock().unwrap().closed = true;
        assert!(expired(&lease), "explicit close is immediate");
    }
    #[test]
    fn long_preparation_completion_starts_a_fresh_idle_window() {
        let mut lease = sample_lease(Duration::from_secs(44), Duration::from_secs(44));
        lease.source.preparation_budget_seconds = 45;
        assert!(!expired(&lease));
        assert_eq!(
            complete_preparation(&lease, Ok(Some("producer".into()))),
            None
        );
        assert!(lease.state.lock().unwrap().ready);
        assert!(
            !expired(&lease),
            "completed producer must remain usable after the old40s threshold"
        );
        assert!(lease.touched.lock().unwrap().elapsed() < Duration::from_secs(1));
        lease.state.lock().unwrap().closed = true;
        assert_eq!(
            complete_preparation(&lease, Ok(Some("late".into()))),
            Some("late".into())
        );
        assert!(expired(&lease));
    }

    #[tokio::test]
    async fn third_preparation_attempt_can_recover_within_one_budget() {
        let calls = std::sync::atomic::AtomicU8::new(0);
        let result = prepare_with_budget(
            tokio::time::Instant::now() + Duration::from_secs(10),
            3,
            || async {
                if calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst) < 2 {
                    bail!("cold source");
                }
                Ok(6)
            },
        )
        .await
        .unwrap();
        assert_eq!(result, 6);
        assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 3);
    }
    #[tokio::test]
    async fn preparation_does_not_retry_after_budget_or_attempt_limit() {
        let calls = std::sync::atomic::AtomicU8::new(0);
        let result: Result<()> = prepare_with_budget(
            tokio::time::Instant::now() + Duration::from_millis(20),
            3,
            || async {
                calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                tokio::time::sleep(Duration::from_secs(1)).await;
                Ok(())
            },
        )
        .await;
        assert!(result.is_err());
        assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 1);
        let result: Result<()> = prepare_with_budget(
            tokio::time::Instant::now() + Duration::from_secs(1),
            1,
            || async {
                calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                bail!("one attempt only")
            },
        )
        .await;
        assert!(result.is_err());
        assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 2);
    }
    #[tokio::test]
    async fn cancelling_preparation_drops_inflight_work() {
        struct Released(Arc<std::sync::atomic::AtomicBool>);
        impl Drop for Released {
            fn drop(&mut self) {
                self.0.store(true, std::sync::atomic::Ordering::SeqCst);
            }
        }
        let released = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let signal = Arc::new(tokio::sync::Notify::new());
        let mut work = Box::pin(prepare_with_budget(
            tokio::time::Instant::now() + Duration::from_secs(45),
            3,
            || {
                let released = released.clone();
                let signal = signal.clone();
                async move {
                    let _guard = Released(released);
                    signal.notify_one();
                    std::future::pending::<Result<()>>().await
                }
            },
        ));
        tokio::select! { _=&mut work=>panic!("pending attempt completed"), _=signal.notified()=>{} }
        drop(work);
        assert!(released.load(std::sync::atomic::Ordering::SeqCst));
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn third_real_probe_attempt_admits_producer_and_close_removes_output() {
        use std::os::unix::fs::PermissionsExt;
        use tower::ServiceExt;
        let root = std::env::temp_dir().join(format!("ott-three-probes-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir(&root).await.unwrap();
        let probe = root.join("ffprobe");
        let mux = root.join("ffmpeg");
        let count = root.join("count");
        let streams = json!({"streams":(1..=6).map(|index|json!({"index":index,"codec_name":"aac","tags":{"language":"eng"}})).collect::<Vec<_>>()});
        tokio::fs::write(&probe, format!("#!/bin/sh\nif [ \"$1\" = \"-version\" ]; then echo ffprobe version test; exit 0; fi\nn=0; test ! -f '{0}' || n=$(cat '{0}'); n=$((n+1)); echo $n > '{0}'\nif [ $n -lt 3 ]; then exit 1; fi\nprintf '%s' '{1}'\n",count.display(),streams)).await.unwrap();
        let mut script = String::from("#!/bin/sh\nif [ \"$1\" = \"-version\" ]; then echo ffmpeg version test; exit 0; fi\ncat > master.m3u8 <<'END'\n#EXTM3U\n");
        for index in 1..=6 {
            script.push_str(&format!("#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"sound\",NAME=\"{index}\",URI=\"track_{index}.m3u8\"\n"));
        }
        script.push_str("#EXT-X-STREAM-INF:BANDWIDTH=1,AUDIO=\"sound\"\ntrack_0.m3u8\nEND\n");
        for index in 0..=6 {
            script.push_str(&format!("printf '0123456789' > track_{index}_init.mp4\ncat > track_{index}.m3u8 <<'END'\n#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:0\n"));
            for segment in 0..3 {
                script.push_str(&format!("#EXTINF:2,\ntrack_{index}_{segment}.m4s\n"));
            }
            script.push_str("END\n");
            for segment in 0..3 {
                script.push_str(&format!("printf 'segment' > track_{index}_{segment}.m4s\n"));
            }
        }
        script.push_str("exec sleep 60\n");
        tokio::fs::write(&mux, script).await.unwrap();
        for file in [&probe, &mux] {
            std::fs::set_permissions(file, std::fs::Permissions::from_mode(0o700)).unwrap();
        }
        let mut source = sample_source();
        source.url = "http://127.0.0.1:9/source.m3u8".into();
        source.allowed_origins = vec!["http://127.0.0.1:9".into()];
        source.preparation_attempts = 3;
        source.preparation_budget_seconds = 45;
        let mut settings = sample_settings(source);
        settings.ffmpeg = mux;
        settings.ffprobe = probe;
        settings.directory = root.join("state");
        let app = configured_routes(settings).await.unwrap();
        let uri = format!("/normalize/play/demo/{}/master.m3u8", "p".repeat(40));
        let response = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .uri(uri)
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = axum::body::to_bytes(response.into_body(), 65536)
            .await
            .unwrap();
        assert_eq!(
            std::str::from_utf8(&body)
                .unwrap()
                .matches("TYPE=AUDIO")
                .count(),
            6
        );
        assert_eq!(tokio::fs::read_to_string(&count).await.unwrap().trim(), "3");
        let mut entries = tokio::fs::read_dir(root.join("state")).await.unwrap();
        let mut id = None;
        while let Some(entry) = entries.next_entry().await.unwrap() {
            if entry.file_type().await.unwrap().is_dir() {
                id = Some(entry.file_name().to_string_lossy().to_string());
            }
        }
        let id = id.expect("admitted producer directory");
        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .method("POST")
                    .uri("/normalize/api")
                    .header("authorization", format!("Bearer {}", "k".repeat(40)))
                    .header("content-type", "application/json")
                    .body(axum::body::Body::from(
                        json!({"op":"close","lease":id}).to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        assert!(!root.join("state").join(id).exists());
        tokio::fs::remove_dir_all(root).await.unwrap();
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn closing_extended_preparation_reaps_probe_and_cleans_session() {
        use std::os::unix::fs::PermissionsExt;
        use tower::ServiceExt;
        let root =
            std::env::temp_dir().join(format!("ott-preparation-close-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir(&root).await.unwrap();
        let probe = root.join("ffprobe");
        let mux = root.join("ffmpeg");
        let pidfile = root.join("probe.pid");
        tokio::fs::write(&probe, format!("#!/bin/sh\nif [ \"$1\" = \"-version\" ]; then echo ffprobe version test; exit 0; fi\necho $$ > '{}'\nexec sleep 60\n", pidfile.display())).await.unwrap();
        tokio::fs::write(&mux, b"#!/bin/sh\necho ffmpeg version test\n")
            .await
            .unwrap();
        for file in [&probe, &mux] {
            std::fs::set_permissions(file, std::fs::Permissions::from_mode(0o700)).unwrap();
        }
        // A parallel Unix spawn can inherit a briefly writable fixture fd before
        // close-on-exec. Wait for Linux ETXTBSY to clear here, not in production.
        // These private files are never rewritten after this publication check.
        for (file, name) in [(&probe, "ffprobe"), (&mux, "ffmpeg")] {
            use tokio::io::AsyncReadExt;
            let deadline = tokio::time::Instant::now() + Duration::from_secs(3);
            let mut child = tokio::time::timeout_at(deadline, async {
                loop {
                    match tokio::process::Command::new(file)
                        .arg("-version")
                        .stdin(std::process::Stdio::null())
                        .stdout(std::process::Stdio::piped())
                        .stderr(std::process::Stdio::null())
                        .kill_on_drop(true)
                        .spawn()
                    {
                        Ok(child) => break child,
                        Err(error)
                            if cfg!(target_os = "linux") && error.raw_os_error() == Some(26) =>
                        {
                            tokio::time::sleep(Duration::from_millis(10)).await;
                        }
                        Err(error) => panic!("fixture executable publication failed: {error}"),
                    }
                }
            })
            .await
            .expect("fixture executable remained busy");
            let result = tokio::time::timeout_at(deadline, async {
                let mut version = Vec::new();
                child
                    .stdout
                    .take()
                    .unwrap()
                    .take(128)
                    .read_to_end(&mut version)
                    .await?;
                let status = child.wait().await?;
                Ok::<_, std::io::Error>((status, version))
            })
            .await;
            if !matches!(&result, Ok(Ok(_))) {
                // Reap a failed or timed-out version probe before failing the test.
                let _ = child.start_kill();
                tokio::time::timeout(Duration::from_secs(1), child.wait())
                    .await
                    .expect("fixture version probe cleanup timed out")
                    .expect("fixture version probe could not be reaped");
            }
            let (status, version) = result
                .expect("fixture version probe timed out")
                .expect("fixture version probe failed");
            assert!(status.success());
            assert_eq!(version, format!("{name} version test\n").into_bytes());
        }
        let mut source = sample_source();
        source.url = "http://127.0.0.1:9/source.m3u8".into();
        source.allowed_origins = vec!["http://127.0.0.1:9".into()];
        source.preparation_budget_seconds = 45;
        source.preparation_attempts = 3;
        let mut settings = sample_settings(source);
        settings.ffmpeg = mux;
        settings.ffprobe = probe;
        settings.directory = root.join("state");
        let app = configured_routes(settings).await.unwrap();
        let request = |value: Value| {
            axum::http::Request::builder()
                .method("POST")
                .uri("/normalize/api")
                .header("authorization", format!("Bearer {}", "k".repeat(40)))
                .header("content-type", "application/json")
                .body(axum::body::Body::from(value.to_string()))
                .unwrap()
        };
        let response = app
            .clone()
            .oneshot(request(json!({"op":"prepare","sourceId":"demo"})))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::ACCEPTED);
        let bytes = axum::body::to_bytes(response.into_body(), 4096)
            .await
            .unwrap();
        let prepared: Value = serde_json::from_slice(&bytes).unwrap();
        let id = prepared["lease"].as_str().unwrap();
        tokio::time::timeout(Duration::from_secs(3), async {
            while !pidfile.exists() {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        let pid = tokio::fs::read_to_string(&pidfile).await.unwrap();
        let response = app
            .oneshot(request(json!({"op":"close","lease":id})))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        tokio::time::timeout(Duration::from_secs(3), async {
            loop {
                let status = tokio::process::Command::new("kill")
                    .args(["-0", pid.trim()])
                    .stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .status()
                    .await
                    .unwrap();
                if !status.success() {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        assert!(!root.join("state").join(id).exists());
        tokio::fs::remove_dir_all(root).await.unwrap();
    }

    #[test]
    fn replacement_playlist_overlaps_old_tail_before_new_discontinuity() {
        let old = "#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:10\n#EXT-X-DISCONTINUITY-SEQUENCE:1\n#EXT-X-MAP:URI=\"old-init\"\n#EXTINF:2,\nold-10\n#EXTINF:2,\nold-11\n";
        let new = "#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:12\n#EXT-X-DISCONTINUITY-SEQUENCE:1\n#EXT-X-DISCONTINUITY\n#EXT-X-MAP:URI=\"new-init\"\n#EXTINF:2,\nnew-12\n";
        let joined = stitch_playlists(old, new, 1).unwrap();
        assert_eq!(joined.matches("#EXTM3U").count(), 1);
        assert_eq!(joined.matches("#EXTINF:").count(), 3);
        assert!(joined.contains("old-11\n#EXT-X-DISCONTINUITY\n#EXT-X-MAP:URI=\"new-init"));
        assert!(stitch_playlists(old, &new.replace(":12", ":13"), 1).is_none());
        assert!(stitch_playlists(old, new, 65).is_none());
    }
    #[test]
    fn delayed_playlist_cannot_replace_newer_bridge_snapshot() {
        let mut snapshots = HashMap::new();
        let playlist = "#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:10\n#EXTINF:2,\na\n";
        remember_playlist(
            &mut snapshots,
            "track_0.m3u8",
            playlist.replace(":10", ":12"),
        );
        remember_playlist(&mut snapshots, "track_0.m3u8", playlist.into());
        assert_eq!(playlist_end(&snapshots["track_0.m3u8"]), Some(13));
    }
    #[test]
    fn generation_boundary_stays_explicit_until_first_fragment_slides_out() {
        let playlist = "#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:2,\ntrack_0_20.m4s\n";
        let first = generation_playlist(playlist, 3, 20);
        assert!(first.contains("#EXT-X-DISCONTINUITY-SEQUENCE:2\n"));
        assert!(first.contains("#EXT-X-MEDIA-SEQUENCE:20\n"));
        assert!(first.contains("#EXT-X-DISCONTINUITY\n#EXTINF:"));
        let sliding = generation_playlist(&playlist.replace(":0", ":1"), 3, 20);
        assert!(sliding.contains("#EXT-X-DISCONTINUITY-SEQUENCE:3\n"));
        assert!(!sliding.contains("#EXT-X-DISCONTINUITY\n"));
    }
    #[test]
    fn generations_survive_restart_reject_another_owner_and_corruption() {
        let directory =
            std::env::temp_dir().join(format!("ott-generations-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&directory).unwrap();
        let orphan = directory.join(uuid::Uuid::new_v4().simple().to_string());
        std::fs::create_dir(&orphan).unwrap();
        std::fs::write(orphan.join("segment.m4s"), "old").unwrap();
        std::fs::write(directory.join("operator-note"), "keep").unwrap();
        let mut first = Generations::open(&directory).unwrap();
        assert!(!orphan.exists());
        assert!(directory.join("operator-note").exists());
        assert_eq!(first.next("demo").unwrap(), (1, HashMap::new()));
        assert_eq!(first.next("independent").unwrap(), (1, HashMap::new()));
        assert_eq!(first.next("independent").unwrap(), (2, HashMap::new()));
        first.published("demo", 0, 7, 6).unwrap();
        first.published("demo", 1, 11, 2).unwrap();
        assert_eq!(first.published("demo", 0, 8, 2).unwrap(), 6);
        assert!(first.published("demo", 0, 9, 7).is_err());
        assert!(validate_live_window("#EXTINF:2,\na\n#EXTINF:2,\nb\n#EXTINF:2,\nc\n", 6).is_err());
        assert!(validate_live_window("#EXTINF:6,\na\n#EXTINF:6,\nb\n#EXTINF:6,\nc\n", 6).is_ok());
        assert_eq!(first.state.sequences["demo"][&0], 8);
        assert!(Generations::open(&directory).is_err());
        assert_eq!(
            first.next("demo").unwrap(),
            (2, HashMap::from([(0, 9), (1, 12)]))
        );
        drop(first);
        let mut second = Generations::open(&directory).unwrap();
        assert_eq!(
            second.next("demo").unwrap(),
            (3, HashMap::from([(0, 9), (1, 12)]))
        );
        drop(second);
        std::fs::write(directory.join(".generation"), "invalid").unwrap();
        assert!(Generations::open(&directory).is_err());
        std::fs::remove_dir_all(directory).unwrap();
    }
    #[cfg(unix)]
    #[test]
    fn generation_owner_releases_lock_while_a_child_retains_its_descriptor() {
        struct ChildGuard(std::process::Child);
        impl Drop for ChildGuard {
            fn drop(&mut self) {
                let _ = self.0.kill();
                let _ = self.0.wait();
            }
        }
        let directory =
            std::env::temp_dir().join(format!("ott-owner-drop-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&directory).unwrap();
        let first = Generations::open(&directory).unwrap();
        let mut child = ChildGuard(
            std::process::Command::new("sleep")
                .arg("30")
                .stdin(std::process::Stdio::from(
                    first._owner.0.try_clone().unwrap(),
                ))
                .spawn()
                .unwrap(),
        );
        assert!(child.0.try_wait().unwrap().is_none());
        assert!(Generations::open(&directory).is_err());
        assert!(Generations::open(&directory).is_err());
        drop(first);
        let second = Generations::open(&directory).unwrap();
        assert!(child.0.try_wait().unwrap().is_none());
        drop(second);
        drop(child);
        std::fs::remove_dir_all(directory).unwrap();
    }
    #[test]
    fn fragment_identity_is_stable_bounded_and_renewable() {
        let mut entries = VecDeque::new();
        assert_eq!(fragment_expiry(&mut entries, "track_0_0.m4s", 100), 700);
        assert_eq!(fragment_expiry(&mut entries, "track_0_0.m4s", 101), 700);
        assert_eq!(fragment_expiry(&mut entries, "track_0_0.m4s", 699), 700);
        assert_eq!(fragment_expiry(&mut entries, "track_0_0.m4s", 700), 1300);
        for index in 0..300 {
            fragment_expiry(&mut entries, &format!("track_0_{index}.m4s"), 701);
        }
        assert_eq!(entries.len(), 256);
        assert!(entries.iter().all(|(_, expiry)| *expiry <= 1301));
    }
    #[test]
    fn source_resource_cache_is_byte_bounded() {
        let mut resources = Resources {
            urls: VecDeque::new(),
            next: 1,
            bytes: 0,
        };
        for index in 0..100 {
            resources.insert(index, "x".repeat(16384));
        }
        assert!(resources.bytes <= 1024 * 1024);
        assert_eq!(resources.urls.len(), 64);
        assert_eq!(
            resources.bytes,
            resources
                .urls
                .iter()
                .map(|(_, url)| url.len())
                .sum::<usize>()
        );
    }
    #[test]
    fn expanded_playlist_is_bounded() {
        let playlist = "a\n".repeat(40000);
        assert!(rewrite(&playlist, |_| Ok("x".repeat(80))).is_err());
    }
    #[test]
    fn playlist_rewrites_nested_keys_audio_and_media() {
        let playlist="#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI=\"key\"\n#EXT-X-MEDIA:TYPE=AUDIO,URI=\"audio.m3u8\"\n#EXT-X-MAP:URI=\"init.mp4\"\nvideo.ts\n";
        let result = rewrite(playlist, |url| Ok(format!("http://127.0.0.1/fetch/{url}"))).unwrap();
        assert_eq!(result.matches("http://127.0.0.1/fetch/").count(), 4);
    }
    #[test]
    fn destinations_and_secrets_are_scoped() {
        let source = Source {
            url: "https://media.example/a".into(),
            allowed_origins: vec!["https://media.example".into()],
            headers: HashMap::new(),
            playback_key: "p".repeat(32),
            preparation_budget_seconds: 30,
            preparation_attempts: 2,
        };
        for url in [
            "http://media.example/a",
            "https://elsewhere.example/a",
            "file:///tmp/a",
            "https://secret@media.example/a",
        ] {
            assert!(permitted(&source, &reqwest::Url::parse(url).unwrap()).is_err());
        }
        assert!(same_secret("long key", "long key"));
        assert!(!same_secret("long key", "other key"));
    }
    #[test]
    fn local_base_requires_exact_loopback_bind() {
        for base in ["http://127.0.0.1:8765", "http://[::1]:8765"] {
            assert!(validate_bind(base, "127.0.0.1").is_ok());
            assert!(validate_bind(base, "::1").is_ok());
            for host in ["0.0.0.0", "::", "localhost", "127.0.0.2"] {
                assert!(validate_bind(base, host).is_err());
            }
        }
        for base in [
            "http://localhost:8765",
            "http://127.1:8765",
            "http://2130706433:8765",
            "http://127.0.0.2:8765",
            "http://127.0.0.1.evil:8765",
        ] {
            assert!(validate_bind(base, "127.0.0.1").is_err());
        }
        assert!(validate_bind("https://media.example", "0.0.0.0").is_ok());
    }

    #[test]
    fn profile_keys_are_independent_of_playback_and_admin() {
        let mut settings: Settings = serde_json::from_value(json!({
            "key": "a".repeat(40), "public_base": "https://media.example", "origins": [],
            "ffmpeg": "/bin/ffmpeg", "ffprobe": "/bin/ffprobe", "directory": "/private/state",
            "sources": {"demo": {"url": "https://source.example/a", "allowed_origins": ["https://source.example"], "playback_key": "b".repeat(40)}},
            "profiles": {"home": {"file": std::env::temp_dir().join("ott-profile-test.m3u"), "key": "c".repeat(40)}}
        })).unwrap();
        assert!(validate_settings(&settings).is_ok());
        for key in [
            "a".repeat(40),
            "b".repeat(40),
            "short".into(),
            "?".repeat(40),
        ] {
            settings.profiles.get_mut("home").unwrap().key = key;
            assert!(validate_settings(&settings).is_err());
        }
        settings.profiles.get_mut("home").unwrap().key = "c".repeat(40);
        settings.profiles.get_mut("home").unwrap().file = "relative.m3u".into();
        assert!(validate_settings(&settings).is_err());
    }

    #[tokio::test]
    async fn private_profile_snapshot_is_bounded_and_immutable() {
        #[cfg(unix)]
        use std::os::unix::fs::PermissionsExt;
        let directory = std::env::temp_dir().join(format!("ott-profile-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir(&directory).await.unwrap();
        let file = directory.join("home.m3u");
        tokio::fs::write(
            &file,
            b"#EXTM3U\n#EXTINF:-1,Sample\nhttps://example.invalid/video\n",
        )
        .await
        .unwrap();
        #[cfg(unix)]
        std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o600)).unwrap();
        let profiles = HashMap::from([(
            "home".into(),
            Profile {
                file: file.clone(),
                key: "z".repeat(40),
            },
        )]);
        let snapshot = load_profiles(&profiles).await.unwrap();
        tokio::fs::write(&file, b"#EXTM3U\nchanged").await.unwrap();
        assert!(String::from_utf8(snapshot["home"].clone())
            .unwrap()
            .contains("Sample"));
        #[cfg(unix)]
        {
            std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o644)).unwrap();
            assert!(load_profiles(&profiles).await.is_err());
            std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o600)).unwrap();
        }
        tokio::fs::write(&file, vec![b'x'; 4 * 1024 * 1024 + 1])
            .await
            .unwrap();
        assert!(load_profiles(&profiles).await.is_err());
        tokio::fs::write(&file, b"not a playlist").await.unwrap();
        assert!(load_profiles(&profiles).await.is_err());
        tokio::fs::remove_file(&file).await.unwrap();
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink("missing", &file).unwrap();
            assert!(load_profiles(&profiles).await.is_err());
        }
        tokio::fs::remove_dir_all(&directory).await.unwrap();
    }

    #[tokio::test]
    async fn response_keeps_capacity_until_last_emitted_bytes_are_dropped() {
        use futures_util::StreamExt;
        let slots = Arc::new(tokio::sync::Semaphore::new(1));
        let permit = slots.clone().try_acquire_owned().unwrap();
        let response = guarded_response("video/mp4", b"data".to_vec(), permit);
        let mut body = response.into_body().into_data_stream();
        let bytes = body.next().await.unwrap().unwrap();
        assert_eq!(&bytes[..], b"data");
        let retained = bytes.clone();
        drop(bytes);
        drop(body);
        assert!(slots.clone().try_acquire_owned().is_err());
        drop(retained);
        assert_eq!(slots.available_permits(), 1);
    }
    #[tokio::test]
    #[ignore = "requires explicitly configured installed ffmpeg and ffprobe"]
    async fn real_gateway_auth_six_tracks_stable_children_and_close() {
        use tower::ServiceExt;
        let directory =
            std::env::temp_dir().join(format!("ott-gateway-test-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir(&directory).await.unwrap();
        let ffmpeg = PathBuf::from(std::env::var_os("OTT_TEST_FFMPEG").expect("ffmpeg"));
        let ffprobe = PathBuf::from(std::env::var_os("OTT_TEST_FFPROBE").expect("ffprobe"));
        let fixture = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../tests/fixtures/media-runtime/segment00.ts");
        let fixture = if fixture.exists() {
            fixture
        } else {
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../../tests/fixtures/media-runtime/segment00.ts")
        };
        let input = directory.join("six.ts");
        let mut command = tokio::process::Command::new(&ffmpeg);
        command
            .args([
                "-nostdin",
                "-hide_banner",
                "-loglevel",
                "error",
                "-stream_loop",
                "5",
                "-i",
            ])
            .arg(fixture)
            .args(["-map", "0:v:0"]);
        for _ in 0..6 {
            command.args(["-map", "0:a:0"]);
        }
        assert!(command
            .args(["-c", "copy", "-f", "mpegts"])
            .arg(&input)
            .status()
            .await
            .unwrap()
            .success());
        let bytes = tokio::fs::read(&input).await.unwrap();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let upstream=Router::new().route("/master.m3u8",get(||async{"#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:12\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:12,\nsix.ts\n"})).route("/six.ts",get(move||{let bytes=bytes.clone();async move{bytes}}));
        let slow_started = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let started = slow_started.clone();
        let upstream = upstream.route(
            "/slow.m3u8",
            get(move || {
                let started = started.clone();
                async move {
                    started.store(true, std::sync::atomic::Ordering::SeqCst);
                    tokio::time::sleep(Duration::from_secs(8)).await;
                    "#EXTM3U\n#EXT-X-TARGETDURATION:12\n#EXTINF:12,\nsix.ts\n"
                }
            }),
        );
        let server = tokio::spawn(async move {
            axum::serve(listener, upstream).await.unwrap();
        });
        let key = "k".repeat(40);
        let playback = "p".repeat(40);
        let mut sources = HashMap::new();
        sources.insert(
            "demo".into(),
            Source {
                url: format!("http://{address}/master.m3u8"),
                allowed_origins: vec![format!("http://{address}")],
                headers: HashMap::new(),
                playback_key: playback.clone(),
                preparation_budget_seconds: 30,
                preparation_attempts: 2,
            },
        );
        sources.insert(
            "slow".into(),
            Source {
                url: format!("http://{address}/slow.m3u8"),
                allowed_origins: vec![format!("http://{address}")],
                headers: HashMap::new(),
                playback_key: playback.clone(),
                preparation_budget_seconds: 30,
                preparation_attempts: 2,
            },
        );
        sources.insert(
            "alias".into(),
            Source {
                url: format!("http://{address}/master.m3u8"),
                allowed_origins: vec![format!("http://{address}")],
                headers: HashMap::from([("x-tenant".into(), "other".into())]),
                playback_key: "q".repeat(40),
                preparation_budget_seconds: 30,
                preparation_attempts: 2,
            },
        );
        let profile_file = directory.join("home.m3u");
        tokio::fs::write(
            &profile_file,
            b"#EXTM3U\n#EXTINF:-1,Sample\nhttps://example.invalid/video\n",
        )
        .await
        .unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&profile_file, std::fs::Permissions::from_mode(0o600))
                .unwrap();
        }
        let app = configured_routes(Settings {
            key: key.clone(),
            public_base: "https://media.example".into(),
            origins: vec!["https://player.example".into()],
            ffmpeg,
            ffprobe,
            directory: directory.join("sessions"),
            sources,
            profiles: HashMap::from([(
                "home".into(),
                Profile {
                    file: profile_file.clone(),
                    key: "z".repeat(40),
                },
            )]),
        })
        .await
        .unwrap();
        for method in ["GET", "HEAD"] {
            let response = app
                .clone()
                .oneshot(
                    axum::http::Request::builder()
                        .method(method)
                        .uri(format!(
                            "/normalize/profile/home/{}/index.m3u",
                            "z".repeat(40)
                        ))
                        .body(axum::body::Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::OK);
            assert_eq!(response.headers()["cache-control"], "private, no-store");
            assert_eq!(response.headers()["referrer-policy"], "no-referrer");
            let body = axum::body::to_bytes(response.into_body(), 4096)
                .await
                .unwrap();
            assert_eq!(body.is_empty(), method == "HEAD");
        }
        tokio::fs::write(&profile_file, b"#EXTM3U\nchanged")
            .await
            .unwrap();
        let snapshot_response = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .uri(format!(
                        "/normalize/profile/home/{}/index.m3u",
                        "z".repeat(40)
                    ))
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let snapshot = axum::body::to_bytes(snapshot_response.into_body(), 4096)
            .await
            .unwrap();
        assert!(std::str::from_utf8(&snapshot).unwrap().contains("Sample"));
        for invalid in [&key, &playback] {
            let response = app
                .clone()
                .oneshot(
                    axum::http::Request::builder()
                        .uri(format!("/normalize/profile/home/{invalid}/index.m3u"))
                        .body(axum::body::Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        }
        for path in [
            format!("/normalize/profile/missing/{}/index.m3u", "z".repeat(40)),
            format!("/normalize/profile/home/{}/other.m3u", "z".repeat(40)),
        ] {
            let response = app
                .clone()
                .oneshot(
                    axum::http::Request::builder()
                        .uri(path)
                        .body(axum::body::Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }
        async fn request(
            app: &Router,
            path: &str,
            body: Option<Value>,
            key: Option<&str>,
        ) -> (StatusCode, Vec<u8>) {
            let mut request = axum::http::Request::builder()
                .uri(path)
                .method(if body.is_some() { "POST" } else { "GET" });
            if let Some(key) = key {
                request = request.header("authorization", format!("Bearer {key}"));
            }
            let bytes = body.map(|body| body.to_string()).unwrap_or_default();
            let response = app
                .clone()
                .oneshot(
                    request
                        .header("content-type", "application/json")
                        .body(axum::body::Body::from(bytes))
                        .unwrap(),
                )
                .await
                .unwrap();
            let status = response.status();
            let bytes = axum::body::to_bytes(response.into_body(), 4 * 1024 * 1024)
                .await
                .unwrap();
            (status, bytes.to_vec())
        }
        assert_eq!(
            request(
                &app,
                "/normalize/api",
                Some(json!({"op":"prepare","sourceId":"demo"})),
                None
            )
            .await
            .0,
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            request(
                &app,
                "/normalize/api",
                Some(json!({"op":"prepare","sourceId":"other"})),
                Some(&key)
            )
            .await
            .0,
            StatusCode::NOT_FOUND
        );
        let oversized = json!({"op":"prepare","sourceId":"x".repeat(5000)});
        assert_eq!(
            request(&app, "/normalize/api", Some(oversized.clone()), None)
                .await
                .0,
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            request(&app, "/normalize/api", Some(oversized), Some(&key))
                .await
                .0,
            StatusCode::PAYLOAD_TOO_LARGE
        );
        let entry = format!("/normalize/play/demo/{playback}/master.m3u8");
        assert_eq!(
            request(&app, "/normalize/play/demo/wrong/master.m3u8", None, None)
                .await
                .0,
            StatusCode::NOT_FOUND
        );
        let (status, master) = request(&app, &entry, None, None).await;
        assert_eq!(
            status,
            StatusCode::OK,
            "{}",
            String::from_utf8_lossy(&master)
        );
        let master = String::from_utf8(master).unwrap();
        assert_eq!(master.matches("TYPE=AUDIO").count(), 6);
        let video = master
            .lines()
            .find(|line| !line.is_empty() && !line.starts_with('#'))
            .unwrap();
        let video = reqwest::Url::parse(video).unwrap();
        let (_, video_playlist) = request(&app, video.path(), None, None).await;
        let video_playlist = String::from_utf8(video_playlist).unwrap();
        let _published_video_end = video_playlist
            .lines()
            .find_map(|line| line.strip_prefix("#EXT-X-MEDIA-SEQUENCE:"))
            .unwrap()
            .parse::<u64>()
            .unwrap()
            + video_playlist.matches("#EXTINF:").count() as u64
            - 1;
        let child = master
            .split("URI=\"")
            .nth(1)
            .unwrap()
            .split('"')
            .next()
            .unwrap();
        let child = reqwest::Url::parse(child).unwrap();
        let (status, playlist) = request(&app, child.path(), None, None).await;
        assert_eq!(status, StatusCode::OK);
        let cold_app = app.clone();
        let cold_path = format!("/normalize/play/slow/{playback}/master.m3u8");
        let cold = tokio::spawn(async move {
            cold_app
                .oneshot(
                    axum::http::Request::builder()
                        .uri(cold_path)
                        .body(axum::body::Body::empty())
                        .unwrap(),
                )
                .await
        });
        tokio::time::timeout(Duration::from_secs(2), async {
            while !slow_started.load(std::sync::atomic::Ordering::SeqCst) {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        assert_eq!(
            tokio::time::timeout(
                Duration::from_millis(500),
                request(&app, child.path(), None, None)
            )
            .await
            .expect("cold source must not block playing source")
            .0,
            StatusCode::OK
        );
        cold.abort();
        let playlist = String::from_utf8(playlist).unwrap();
        let init = playlist
            .split("#EXT-X-MAP:URI=\"")
            .nth(1)
            .unwrap()
            .split('"')
            .next()
            .unwrap();
        let init = reqwest::Url::parse(init).unwrap();
        assert!(init.path().starts_with("/normalize/lease/"));
        assert!(init.path().ends_with("_init.mp4"));
        assert!(
            init.query().is_none(),
            "init address must not expire mid-playback"
        );
        let init_response = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .uri(init.path())
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(init_response.status(), StatusCode::OK);
        assert_eq!(
            init_response.headers()[axum::http::header::CONTENT_TYPE],
            "video/mp4"
        );
        let (_, refreshed) = request(&app, child.path(), None, None).await;
        assert!(String::from_utf8(refreshed)
            .unwrap()
            .contains(init.as_str()));
        let segment = playlist
            .lines()
            .find(|line| !line.starts_with('#') && !line.is_empty())
            .unwrap();
        let segment = reqwest::Url::parse(segment).unwrap();
        let segment_path = format!("{}?{}", segment.path(), segment.query().unwrap());
        assert_eq!(
            request(&app, &segment_path, None, None).await.0,
            StatusCode::OK
        );
        assert_eq!(
            request(&app, segment.path(), None, None).await.0,
            StatusCode::GONE
        );
        let expired = format!("{}?expires=1&signature=invalid", segment.path());
        assert_eq!(
            request(&app, &expired, None, None).await.0,
            StatusCode::GONE
        );
        // Child playlist address remains stable; every reload obtains fresh signed segments.
        assert_eq!(
            request(&app, child.path(), None, None).await.0,
            StatusCode::OK
        );
        let lease = segment.path().split('/').nth(3).unwrap();
        let (status, bytes) = request(
            &app,
            "/normalize/api",
            Some(json!({"op":"status","lease":lease})),
            Some(&key),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let status: Value = serde_json::from_slice(&bytes).unwrap();
        assert!(status["masterURL"]
            .as_str()
            .unwrap()
            .starts_with(&format!("https://media.example/normalize/lease/{lease}/")));
        assert_eq!(
            request(
                &app,
                &format!("/normalize/lease/{lease}/wrong/master.m3u8"),
                None,
                None
            )
            .await
            .0,
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            request(
                &app,
                &format!("/normalize/lease/{lease}/master.m3u8"),
                None,
                None
            )
            .await
            .0,
            StatusCode::NOT_FOUND
        );
        let lease_master = reqwest::Url::parse(status["masterURL"].as_str().unwrap()).unwrap();
        assert_eq!(
            request(&app, lease_master.path(), None, None).await.0,
            StatusCode::OK
        );
        assert_eq!(
            request(
                &app,
                &format!("/normalize/original/alias/{}/{lease}/0", "q".repeat(40)),
                None,
                None
            )
            .await
            .0,
            StatusCode::NOT_FOUND
        );

        let (_, last_playlist) = request(&app, child.path(), None, None).await;
        let last_playlist = String::from_utf8(last_playlist).unwrap();
        let next_audio_sequence = last_playlist
            .lines()
            .find_map(|line| line.strip_prefix("#EXT-X-MEDIA-SEQUENCE:"))
            .unwrap()
            .parse::<u64>()
            .unwrap()
            + last_playlist.matches("#EXTINF:").count() as u64;
        assert_eq!(
            request(
                &app,
                "/normalize/api",
                Some(json!({"op":"close","lease":lease})),
                Some(&key)
            )
            .await
            .0,
            StatusCode::NO_CONTENT
        );
        assert_eq!(
            request(&app, &segment_path, None, None).await.0,
            StatusCode::GONE
        );
        assert!(!directory.join("sessions").join(lease).exists());
        // API ownership must survive resolving its playback URL: the cold source
        // already occupies the other slot, so another producer cannot be hidden.
        let (status, body) = request(
            &app,
            "/normalize/api",
            Some(json!({"op":"prepare","sourceId":"demo"})),
            Some(&key),
        )
        .await;
        assert_eq!(status, StatusCode::ACCEPTED);
        let prepared: Value = serde_json::from_slice(&body).unwrap();
        let prepared = prepared["lease"].as_str().unwrap().to_owned();
        let owned_master = tokio::time::timeout(Duration::from_secs(12), async {
            loop {
                let (_, body) = request(
                    &app,
                    "/normalize/api",
                    Some(json!({"op":"status","lease":prepared})),
                    Some(&key),
                )
                .await;
                let status: Value = serde_json::from_slice(&body).unwrap();
                if status["state"] == "ready" {
                    break status["masterURL"].as_str().unwrap().to_owned();
                }
                assert_ne!(status["state"], "unavailable");
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        })
        .await
        .unwrap();
        let owned_master = reqwest::Url::parse(&owned_master).unwrap();
        assert_eq!(
            request(&app, owned_master.path(), None, None).await.0,
            StatusCode::OK
        );
        assert_eq!(
            request(
                &app,
                "/normalize/api",
                Some(json!({"op":"close","lease":prepared})),
                Some(&key)
            )
            .await
            .0,
            StatusCode::NO_CONTENT
        );
        assert_eq!(
            request(&app, owned_master.path(), None, None).await.0,
            StatusCode::GONE
        );

        // Reopening the stable source after release must not reuse an old HLS timeline.
        let (_, replacement) = request(&app, child.path(), None, None).await;
        let replacement = String::from_utf8(replacement).unwrap();
        let tag = |body: &str, prefix: &str| -> u64 {
            body.lines()
                .find_map(|line| line.strip_prefix(prefix))
                .unwrap()
                .parse()
                .unwrap()
        };
        assert_eq!(
            tag(&replacement, "#EXT-X-MEDIA-SEQUENCE:"),
            next_audio_sequence
        );
        assert!(
            tag(&replacement, "#EXT-X-DISCONTINUITY-SEQUENCE:")
                > tag(&playlist, "#EXT-X-DISCONTINUITY-SEQUENCE:")
        );
        let replacement_init = replacement
            .split("#EXT-X-MAP:URI=\"")
            .nth(1)
            .unwrap()
            .split('"')
            .next()
            .unwrap();
        assert_ne!(replacement_init, init.as_str());
        let replacement_init = reqwest::Url::parse(replacement_init).unwrap();
        let replacement_id = replacement_init.path().split('/').nth(3).unwrap();
        assert_eq!(
            request(
                &app,
                "/normalize/api",
                Some(json!({"op":"close","lease":replacement_id})),
                Some(&key)
            )
            .await
            .0,
            StatusCode::NO_CONTENT
        );

        // A failed remux keeps the original authorized transport usable, without
        // putting the upstream URL or credentials in the playlist.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let failed = directory.join("failed-ffmpeg");
            tokio::fs::write(
                &failed,
                b"#!/bin/sh\nif [ \"$1\" = \"-version\" ]; then echo ffmpeg version test; exit 0; fi\nexit 1\n",
            )
            .await
            .unwrap();
            std::fs::set_permissions(&failed, std::fs::Permissions::from_mode(0o700)).unwrap();
            let fallback = configured_routes(Settings {
                key: key.clone(),
                public_base: "https://media.example".into(),
                origins: vec![],
                ffmpeg: failed,
                ffprobe: PathBuf::from(std::env::var_os("OTT_TEST_FFPROBE").unwrap()),
                directory: directory.join("fallback"),
                profiles: HashMap::new(),
                sources: HashMap::from([(
                    "demo".into(),
                    Source {
                        url: format!("http://{address}/master.m3u8"),
                        allowed_origins: vec![format!("http://{address}")],
                        headers: HashMap::new(),
                        playback_key: playback.clone(),
                        preparation_budget_seconds: 30,
                        preparation_attempts: 2,
                    },
                )]),
            })
            .await
            .unwrap();
            let (status, playlist) = request(&fallback, &entry, None, None).await;
            assert_eq!(status, StatusCode::OK);
            let playlist = String::from_utf8(playlist).unwrap();
            assert!(playlist.contains("/normalize/original/demo/"));
            assert!(!playlist.contains(&address.to_string()));
            let original = reqwest::Url::parse(
                playlist
                    .lines()
                    .find(|line| !line.starts_with('#') && !line.is_empty())
                    .unwrap(),
            )
            .unwrap();
            assert_eq!(
                request(&fallback, original.path(), None, None).await.0,
                StatusCode::OK
            );
            assert_eq!(
                request(
                    &fallback,
                    &format!("/normalize/play/demo/{playback}/track_0.m3u8"),
                    None,
                    None
                )
                .await
                .0,
                StatusCode::SERVICE_UNAVAILABLE,
                "a normalized child must not be replaced by an incompatible original playlist"
            );
            let fallback_lease = original.path().split('/').nth(5).unwrap();
            assert_eq!(
                request(
                    &fallback,
                    "/normalize/api",
                    Some(json!({"op":"close","lease":fallback_lease})),
                    Some(&key)
                )
                .await
                .0,
                StatusCode::NO_CONTENT
            );
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let slow = directory.join("slow-probe");
            let pidfile = directory.join("probe.pid");
            tokio::fs::write(&slow,format!("#!/bin/sh\nif [ \"$1\" = \"-version\" ]; then echo ffprobe version test; exit 0; fi\necho $$ > '{}'\nexec sleep 60\n",pidfile.display())).await.unwrap();
            std::fs::set_permissions(&slow, std::fs::Permissions::from_mode(0o700)).unwrap();
            let pending = configured_routes(Settings {
                key: key.clone(),
                public_base: "https://media.example".into(),
                origins: vec![],
                ffmpeg: PathBuf::from(std::env::var_os("OTT_TEST_FFMPEG").unwrap()),
                ffprobe: slow,
                directory: directory.join("pending"),
                profiles: HashMap::new(),
                sources: HashMap::from([(
                    "demo".into(),
                    Source {
                        url: format!("http://{address}/master.m3u8"),
                        allowed_origins: vec![format!("http://{address}")],
                        headers: HashMap::new(),
                        playback_key: playback.clone(),
                        preparation_budget_seconds: 30,
                        preparation_attempts: 2,
                    },
                )]),
            })
            .await
            .unwrap();
            let (status, bytes) = request(
                &pending,
                "/normalize/api",
                Some(json!({"op":"prepare","sourceId":"demo"})),
                Some(&key),
            )
            .await;
            assert_eq!(status, StatusCode::ACCEPTED);
            let value: Value = serde_json::from_slice(&bytes).unwrap();
            let pending_id = value["lease"].as_str().unwrap();
            tokio::time::timeout(Duration::from_secs(2), async {
                while !pidfile.exists() {
                    tokio::time::sleep(Duration::from_millis(10)).await;
                }
            })
            .await
            .unwrap();
            let pid = tokio::fs::read_to_string(&pidfile).await.unwrap();
            assert_eq!(
                request(
                    &pending,
                    "/normalize/api",
                    Some(json!({"op":"close","lease":pending_id})),
                    Some(&key)
                )
                .await
                .0,
                StatusCode::NO_CONTENT
            );
            tokio::time::timeout(Duration::from_secs(2), async {
                loop {
                    if !tokio::process::Command::new("kill")
                        .args(["-0", pid.trim()])
                        .stderr(std::process::Stdio::null())
                        .status()
                        .await
                        .unwrap()
                        .success()
                    {
                        break;
                    }
                    tokio::time::sleep(Duration::from_millis(10)).await;
                }
            })
            .await
            .unwrap();
        }
        shutdown_test_gateways(&directory).await;
        server.abort();
        tokio::fs::remove_dir_all(directory).await.unwrap();
    }
}
