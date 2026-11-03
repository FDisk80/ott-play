//! Explicit local Torznab sources; neither endpoint credentials nor download URLs are DTOs.
use super::{
    torrent::lock,
    torznab_store::{self as storage, Config, Payload, Store},
    torznab_xml as xml,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    net::{IpAddr, SocketAddr},
    path::PathBuf,
    sync::{Arc, Mutex, Weak},
    time::{Duration, Instant},
};
use tokio::sync::{watch, Semaphore};
use tokio_util::sync::CancellationToken;

const DEADLINE: Duration = Duration::from_secs(15);
const RESULT_TTL: Duration = Duration::from_secs(15 * 60);
const CAPS_CACHE_LIMIT: usize = 32;
const INDEXERS_TTL: Duration = Duration::from_secs(60);
type Result<T> = std::result::Result<T, &'static str>;
#[derive(Clone)]
pub(super) struct Torznab(Arc<Inner>);
struct Inner {
    state: Mutex<State>,
    requests: Semaphore,
    cancel: CancellationToken,
}
struct State {
    store: Store,
    tokens: HashMap<String, CancellationToken>,
    caps: HashMap<Scope, (xml::Caps, Instant)>,
    indexers: HashMap<Scope, CachedIndexers>,
    indexers_pending: HashMap<Scope, Arc<PendingIndexers>>,
    results: HashMap<String, Handle>,
}
#[derive(Clone, PartialEq, Eq, Hash)]
struct Scope {
    source_id: String,
    generation: String,
    indexer_id: Option<String>,
    membership: Option<String>,
}
impl Scope {
    fn new(source: &Config, indexer_id: Option<&str>) -> Self {
        Self {
            source_id: source.id.clone(),
            generation: source.generation.clone(),
            indexer_id: indexer_id.map(str::to_owned),
            membership: None,
        }
    }
}
struct CachedIndexers {
    value: xml::Indexers,
    membership: HashMap<String, String>,
    created: Instant,
}
struct PendingIndexers {
    done: watch::Sender<Option<Result<xml::Indexers>>>,
}
impl PendingIndexers {
    async fn wait(&self, cancel: &CancellationToken, deadline: Instant) -> Result<xml::Indexers> {
        let mut receiver = self.done.subscribe();
        let waiting = async {
            loop {
                let value = receiver.borrow_and_update().clone();
                if let Some(value) = value {
                    return value;
                }
                receiver.changed().await.map_err(|_| "torznab_cancelled")?;
            }
        };
        let value = tokio::select! {
            biased;
            _ = cancel.cancelled() => Err("torznab_cancelled"),
            result = tokio::time::timeout_at(tokio::time::Instant::from_std(deadline), waiting) => result.map_err(|_| "torznab_timeout")?,
        }?;
        if Instant::now() >= deadline {
            return Err("torznab_timeout");
        }
        Ok(value)
    }
}
struct DiscoveryGuard {
    owner: Weak<Inner>,
    scope: Scope,
    pending: Arc<PendingIndexers>,
}
impl Drop for DiscoveryGuard {
    fn drop(&mut self) {
        if let Some(owner) = self.owner.upgrade() {
            let mut state = lock(&owner.state);
            if state
                .indexers_pending
                .get(&self.scope)
                .is_some_and(|pending| Arc::ptr_eq(pending, &self.pending))
            {
                state.indexers_pending.remove(&self.scope);
            }
        }
        // Dropping the request future must release followers and permit a
        // later retry; a cancelled leader must not strand a pending discovery.
        let unfinished = self.pending.done.borrow().is_none();
        if unfinished {
            self.pending
                .done
                .send_replace(Some(Err("torznab_cancelled")));
        }
    }
}
struct Handle {
    scope: Scope,
    link: String,
    created: Instant,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Configure {
    pub id: String,
    pub label: String,
    pub endpoint: String,
    pub api_key: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Search {
    pub source_id: String,
    #[serde(default, deserialize_with = "optional_indexer")]
    pub indexer_id: Option<String>,
    pub query: String,
    #[serde(default)]
    pub category_ids: Vec<u64>,
    #[serde(default)]
    pub offset: u64,
    pub limit: usize,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Prepare {
    pub source_id: String,
    pub result_ref: String,
}

// An omitted selector preserves the original source endpoint. A present selector
// must be a string, never null or a silent request for aggregate results.
pub(super) fn optional_indexer<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<Option<String>, D::Error> {
    String::deserialize(deserializer).map(Some)
}

// Only the explicit Jackett aggregate endpoint can enumerate/select children.
// Keep its configured HTTPS origin and reverse-proxy prefix unchanged.
fn scoped_endpoint(source: &Config, indexer_id: Option<&str>) -> Result<reqwest::Url> {
    let mut url = endpoint_url(&source.endpoint)?;
    let Some(id) = indexer_id else {
        return Ok(url);
    };
    if !xml::indexer_id(id) {
        return Err("torznab_invalid_indexer");
    }
    let (prefix, suffix) = jackett_path(&url).ok_or("torznab_indexers_unsupported")?;
    let path = format!("{prefix}/api/v2.0/indexers/{id}/results/torznab{suffix}");
    url.set_path(&path);
    Ok(url)
}
fn jackett_path(url: &reqwest::Url) -> Option<(&str, &str)> {
    const MARKER: &str = "/api/v2.0/indexers/all/results/torznab";
    let path = url.path();
    for suffix in ["/api/", "/api", "/", ""] {
        let Some(stem) = path.strip_suffix(suffix) else {
            continue;
        };
        if let Some(prefix) = stem.strip_suffix(MARKER) {
            return Some((prefix, suffix));
        }
    }
    None
}

pub(super) fn validate_config(id: &str, label: &str, endpoint: &str, key: &str) -> Result<()> {
    if !storage::source_id(id)
        || label.trim().is_empty()
        || label.len() > 128
        || label.chars().any(char::is_control)
        || key.len() > 2048
        || key.chars().any(char::is_control)
    {
        return Err("torznab_invalid_source");
    }
    endpoint_url(endpoint).map(|_| ())
}
fn endpoint_url(value: &str) -> Result<reqwest::Url> {
    if value.len() > 4096 || value.chars().any(char::is_control) {
        return Err("torznab_invalid_source");
    }
    let url = reqwest::Url::parse(value).map_err(|_| "torznab_invalid_source")?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.port_or_known_default().is_none_or(|p| p == 0)
    {
        return Err("torznab_invalid_source");
    }
    if let Some(ip) = literal_ip(&url) {
        if !local_ip(ip) {
            return Err("torznab_local_only");
        }
    }
    Ok(url)
}
fn literal_ip(url: &reqwest::Url) -> Option<IpAddr> {
    url.host_str()?.trim_matches(['[', ']']).parse().ok()
}
fn local_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => ip.is_loopback() || ip.is_private(),
        IpAddr::V6(ip) => {
            ip.is_loopback()
                || ip.is_unique_local()
                || ip
                    .to_ipv4_mapped()
                    .is_some_and(|ip| local_ip(IpAddr::V4(ip)))
        }
    }
}
fn link_url(source: &Config, link: &str) -> Result<reqwest::Url> {
    if link.len() > 16384 || link.chars().any(char::is_control) {
        return Err("torznab_invalid_link");
    }
    let endpoint = endpoint_url(&source.endpoint)?;
    let url = endpoint.join(link).map_err(|_| "torznab_invalid_link")?;
    if endpoint.origin() != url.origin()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
    {
        return Err("torznab_invalid_link");
    }
    Ok(url)
}
async fn request(
    url: reqwest::Url,
    maximum: usize,
    magnet_redirect: bool,
    cancel: &CancellationToken,
    deadline: Instant,
) -> Result<Payload> {
    let remaining = deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
        return Err("torznab_timeout");
    }
    let operation = async {
        let host = url
            .host_str()
            .ok_or("torznab_invalid_source")?
            .trim_matches(['[', ']']);
        let port = url
            .port_or_known_default()
            .ok_or("torznab_invalid_source")?;
        let addresses: Vec<SocketAddr> = if let Some(ip) = literal_ip(&url) {
            vec![SocketAddr::new(ip, port)]
        } else {
            tokio::net::lookup_host((host, port))
                .await
                .map_err(|_| "torznab_network_error")?
                .take(17)
                .collect()
        };
        if addresses.is_empty()
            || addresses.len() > 16
            || addresses.iter().any(|a| !local_ip(a.ip()))
        {
            return Err("torznab_local_only");
        }
        let client = reqwest::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(3))
            .timeout(remaining)
            .resolve_to_addrs(host, &addresses)
            .build()
            .map_err(|_| "torznab_network_error")?;
        let mut response = client.get(url).send().await.map_err(|e| {
            if e.is_timeout() {
                "torznab_timeout"
            } else {
                "torznab_network_error"
            }
        })?;
        if magnet_redirect && matches!(response.status().as_u16(), 301 | 302 | 303 | 307 | 308) {
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|v| v.to_str().ok())
                .ok_or("torznab_invalid_link")?;
            let payload = Payload::Magnet(location.to_owned());
            payload.validate()?;
            return Ok(payload);
        }
        if !response.status().is_success() {
            return Err("torznab_http_error");
        }
        if response
            .content_length()
            .is_some_and(|length| length > maximum as u64)
        {
            return Err("torznab_response_limit");
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|error| {
            if error.is_timeout() {
                "torznab_timeout"
            } else {
                "torznab_network_error"
            }
        })? {
            if bytes.len().saturating_add(chunk.len()) > maximum {
                return Err("torznab_response_limit");
            }
            bytes.extend_from_slice(&chunk);
        }
        Ok(Payload::Torrent(bytes))
    };
    tokio::select! {
        biased;
        _ = cancel.cancelled() => Err("torznab_cancelled"),
        result = tokio::time::timeout(remaining, operation) => result.map_err(|_| "torznab_timeout")?,
    }
}
impl Torznab {
    pub async fn new(root: PathBuf, cancel: CancellationToken) -> Result<Self> {
        let store = tokio::task::spawn_blocking(move || Store::load(root))
            .await
            .map_err(|_| "torznab_store_unavailable")??;
        let tokens = store
            .sources()
            .iter()
            .map(|s| (s.id.clone(), cancel.child_token()))
            .collect();
        Ok(Self(Arc::new(Inner {
            state: Mutex::new(State {
                store,
                tokens,
                caps: HashMap::new(),
                indexers: HashMap::new(),
                indexers_pending: HashMap::new(),
                results: HashMap::new(),
            }),
            requests: Semaphore::new(2),
            cancel,
        })))
    }
    pub fn sources(&self) -> Value {
        json!({"schema":1,"sources":lock(&self.0.state).store.sources().into_iter().map(|s| json!({"id":s.id,"label":s.label})).collect::<Vec<_>>()})
    }
    pub fn shutdown(&self) {
        self.0.cancel.cancel();
        lock(&self.0.state).store.release_owner();
    }
    pub async fn configure(&self, request: Configure) -> Result<Value> {
        validate_config(
            &request.id,
            &request.label,
            &request.endpoint,
            &request.api_key,
        )?;
        let this = self.clone();
        tokio::task::spawn_blocking(move || {
            let mut state = lock(&this.0.state);
            if this.0.cancel.is_cancelled() {
                return Err("torznab_cancelled");
            }
            let id = request.id.clone();
            let label = request.label.trim().to_owned();
            let changed = state.store.configure(Config {
                id: id.clone(),
                label: label.clone(),
                endpoint: request.endpoint,
                api_key: request.api_key,
                generation: storage::new_id(),
            })?;
            if changed {
                this.invalidate(&mut state, &id);
                state.tokens.insert(id.clone(), this.0.cancel.child_token());
            }
            Ok(json!({"schema":1,"source":{"id":id,"label":label}}))
        })
        .await
        .map_err(|_| "torznab_store_unavailable")?
    }
    fn invalidate(&self, state: &mut State, id: &str) {
        if let Some(token) = state.tokens.remove(id) {
            token.cancel();
        }
        state.caps.retain(|scope, _| scope.source_id != id);
        state.indexers.retain(|scope, _| scope.source_id != id);
        state
            .indexers_pending
            .retain(|scope, _| scope.source_id != id);
        state
            .results
            .retain(|_, result| result.scope.source_id != id);
    }
    pub async fn remove(&self, id: String) -> Result<Value> {
        let this = self.clone();
        tokio::task::spawn_blocking(move || {
            let mut state = lock(&this.0.state);
            if this.0.cancel.is_cancelled() {
                return Err("torznab_cancelled");
            }
            state.store.remove(&id)?;
            this.invalidate(&mut state, &id);
            Ok(json!({"schema":1,"removed":true}))
        })
        .await
        .map_err(|_| "torznab_store_unavailable")?
    }
    fn source(&self, id: &str) -> Result<(Config, CancellationToken)> {
        if !storage::source_id(id) {
            return Err("torznab_invalid_source");
        }
        let state = lock(&self.0.state);
        Ok((
            state.store.source(id)?,
            state
                .tokens
                .get(id)
                .ok_or("torznab_source_missing")?
                .clone(),
        ))
    }
    fn current(state: &State, source: &Config, cancel: &CancellationToken) -> Result<()> {
        if cancel.is_cancelled() || state.store.source(&source.id)?.generation != source.generation
        {
            return Err("torznab_cancelled");
        }
        Ok(())
    }
    fn current_scope(
        state: &State,
        source: &Config,
        scope: &Scope,
        cancel: &CancellationToken,
    ) -> Result<()> {
        Self::current(state, source, cancel)?;
        if let Some(id) = &scope.indexer_id {
            let present = state
                .indexers
                .get(&Scope::new(source, None))
                .is_some_and(|cached| {
                    cached.value.supported && cached.membership.get(id) == scope.membership.as_ref()
                });
            if !present {
                return Err("torznab_indexer_missing");
            }
        }
        Ok(())
    }
    async fn load_indexers(
        &self,
        source: &Config,
        cancel: &CancellationToken,
        deadline: Instant,
        refresh: bool,
    ) -> Result<xml::Indexers> {
        let scope = Scope::new(source, None);
        let url = endpoint_url(&source.endpoint)?;
        Self::current(&lock(&self.0.state), source, cancel)?;
        if jackett_path(&url).is_none() {
            return Ok(xml::Indexers {
                supported: false,
                indexers: vec![],
            });
        }
        let (pending, leader) = {
            let mut state = lock(&self.0.state);
            Self::current(&state, source, cancel)?;
            if !refresh {
                if let Some(cached) = state
                    .indexers
                    .get(&scope)
                    .filter(|c| c.created.elapsed() < INDEXERS_TTL)
                {
                    return Ok(cached.value.clone());
                }
            }
            let existing = if refresh {
                None
            } else {
                state.indexers_pending.get(&scope).cloned()
            };
            if let Some(pending) = existing {
                (pending, false)
            } else {
                let (done, _) = watch::channel(None);
                let pending = Arc::new(PendingIndexers { done });
                state
                    .indexers_pending
                    .insert(scope.clone(), pending.clone());
                (pending, true)
            }
        };
        if !leader {
            let result = pending.wait(cancel, deadline).await?;
            Self::current(&lock(&self.0.state), source, cancel)?;
            return Ok(result);
        }
        let guard = DiscoveryGuard {
            owner: Arc::downgrade(&self.0),
            scope,
            pending,
        };
        let result = self
            .fetch_indexers(source, cancel, deadline, url, &guard)
            .await;
        guard.pending.done.send_replace(Some(result.clone()));
        result
    }
    async fn fetch_indexers(
        &self,
        source: &Config,
        cancel: &CancellationToken,
        deadline: Instant,
        mut url: reqwest::Url,
        guard: &DiscoveryGuard,
    ) -> Result<xml::Indexers> {
        let scope = &guard.scope;
        url.query_pairs_mut()
            .append_pair("t", "indexers")
            .append_pair("configured", "true")
            .append_pair("apikey", &source.api_key);
        let Payload::Torrent(bytes) =
            request(url, 2 * 1024 * 1024, false, cancel, deadline).await?
        else {
            return Err("torznab_invalid_xml");
        };
        let value = xml::indexers(&bytes)?;
        if Instant::now() >= deadline {
            return Err("torznab_timeout");
        }
        let mut state = lock(&self.0.state);
        Self::current(&state, source, cancel)?;
        // A slower earlier response must never undo a newer refresh, including
        // when the newer request failed and its data therefore cannot be used.
        if !state
            .indexers_pending
            .get(scope)
            .is_some_and(|pending| Arc::ptr_eq(pending, &guard.pending))
        {
            return Err("torznab_cancelled");
        }
        let membership: HashMap<String, String> = value
            .indexers
            .iter()
            .map(|row| {
                let generation = state
                    .indexers
                    .get(scope)
                    .and_then(|previous| previous.membership.get(&row.id))
                    .cloned()
                    .unwrap_or_else(storage::new_id);
                (row.id.clone(), generation)
            })
            .collect();
        // Retain an epoch only for continuous membership. Removing and re-adding
        // an identical ID cannot revive a request that belonged to the old child.
        let retained = |candidate: &Scope| {
            candidate.source_id != source.id
                || candidate.generation != source.generation
                || candidate
                    .indexer_id
                    .as_ref()
                    .is_none_or(|id| membership.get(id) == candidate.membership.as_ref())
        };
        state.caps.retain(|key, _| retained(key));
        state.results.retain(|_, handle| retained(&handle.scope));
        state.indexers.insert(
            scope.clone(),
            CachedIndexers {
                value: value.clone(),
                membership,
                created: Instant::now(),
            },
        );
        Ok(value)
    }
    pub async fn indexers(&self, id: &str) -> Result<Value> {
        let _permit = self.0.requests.try_acquire().map_err(|_| "torznab_busy")?;
        let (source, cancel) = self.source(id)?;
        let value = self
            .load_indexers(&source, &cancel, Instant::now() + DEADLINE, true)
            .await?;
        Ok(json!({"schema":1,"sourceId":id,"supported":value.supported,"indexers":value.indexers}))
    }
    async fn scope(
        &self,
        source: &Config,
        indexer_id: Option<&str>,
        cancel: &CancellationToken,
        deadline: Instant,
    ) -> Result<Scope> {
        if let Some(id) = indexer_id {
            if !xml::indexer_id(id) {
                return Err("torznab_invalid_indexer");
            }
            let children = self.load_indexers(source, cancel, deadline, false).await?;
            if !children.supported {
                return Err("torznab_indexers_unsupported");
            }
            if !children.indexers.iter().any(|row| row.id == id) {
                return Err("torznab_indexer_missing");
            }
        }
        let mut scope = Scope::new(source, indexer_id);
        if let Some(id) = indexer_id {
            let state = lock(&self.0.state);
            Self::current(&state, source, cancel)?;
            scope.membership = Some(
                state
                    .indexers
                    .get(&Scope::new(source, None))
                    .and_then(|cached| cached.membership.get(id))
                    .cloned()
                    .ok_or("torznab_indexer_missing")?,
            );
        }
        Ok(scope)
    }
    async fn load_caps(
        &self,
        source: &Config,
        scope: &Scope,
        cancel: &CancellationToken,
        deadline: Instant,
    ) -> Result<xml::Caps> {
        {
            let state = lock(&self.0.state);
            Self::current_scope(&state, source, scope, cancel)?;
            if let Some(caps) = state.caps.get(scope) {
                return Ok(caps.0.clone());
            }
        }
        let mut url = scoped_endpoint(source, scope.indexer_id.as_deref())?;
        url.query_pairs_mut()
            .append_pair("t", "caps")
            .append_pair("apikey", &source.api_key);
        let Payload::Torrent(bytes) = request(url, 256 * 1024, false, cancel, deadline).await?
        else {
            return Err("torznab_invalid_xml");
        };
        let caps = xml::caps(&bytes)?;
        if Instant::now() >= deadline {
            return Err("torznab_timeout");
        }
        let mut state = lock(&self.0.state);
        Self::current_scope(&state, source, scope, cancel)?;
        if state.caps.len() >= CAPS_CACHE_LIMIT && !state.caps.contains_key(scope) {
            if let Some(oldest) = state
                .caps
                .iter()
                .min_by_key(|(_, (_, time))| *time)
                .map(|(key, _)| key.clone())
            {
                state.caps.remove(&oldest);
            }
        }
        state
            .caps
            .insert(scope.clone(), (caps.clone(), Instant::now()));
        Ok(caps)
    }
    pub async fn caps(&self, id: &str, indexer_id: Option<&str>) -> Result<Value> {
        let _permit = self.0.requests.try_acquire().map_err(|_| "torznab_busy")?;
        let (source, cancel) = self.source(id)?;
        let deadline = Instant::now() + DEADLINE;
        let scope = self.scope(&source, indexer_id, &cancel, deadline).await?;
        let caps = self.load_caps(&source, &scope, &cancel, deadline).await?;
        let mut value = json!({"schema":1,"sourceId":id,"searchAvailable":caps.search_available,"categories":caps.categories,"maxLimit":caps.max_limit});
        if let Some(id) = indexer_id {
            value["indexerId"] = json!(id);
        }
        Ok(value)
    }
    pub async fn search(&self, search: Search) -> Result<Value> {
        self.search_before(search, Instant::now() + DEADLINE).await
    }
    pub(super) async fn search_before(&self, search: Search, deadline: Instant) -> Result<Value> {
        if search.query.len() > 512
            || search.query.chars().any(char::is_control)
            || search.offset > 1_000_000
            || !(1..=100).contains(&search.limit)
            || search.category_ids.len() > 16
            || search
                .category_ids
                .iter()
                .any(|v| *v == 0 || *v > 9_007_199_254_740_991)
        {
            return Err("torznab_invalid_query");
        }
        let _permit = self.0.requests.try_acquire().map_err(|_| "torznab_busy")?;
        let (source, cancel) = self.source(&search.source_id)?;
        let scope = self
            .scope(&source, search.indexer_id.as_deref(), &cancel, deadline)
            .await?;
        let caps = self.load_caps(&source, &scope, &cancel, deadline).await?;
        if !caps.search_available {
            return Err("torznab_search_unavailable");
        }
        if search
            .category_ids
            .iter()
            .any(|id| !caps.categories.iter().any(|c| c.id == *id))
        {
            return Err("torznab_invalid_category");
        }
        let limit = search.limit.min(caps.max_limit);
        let mut url = scoped_endpoint(&source, scope.indexer_id.as_deref())?;
        let mut link_source = source.clone();
        link_source.endpoint = url.to_string();
        url.query_pairs_mut()
            .append_pair("t", "search")
            .append_pair("apikey", &source.api_key)
            .append_pair("q", search.query.trim())
            .append_pair("offset", &search.offset.to_string())
            .append_pair("limit", &limit.to_string())
            .append_pair("extended", "1");
        if !search.category_ids.is_empty() {
            url.query_pairs_mut().append_pair(
                "cat",
                &search
                    .category_ids
                    .iter()
                    .map(u64::to_string)
                    .collect::<Vec<_>>()
                    .join(","),
            );
        }
        let Payload::Torrent(bytes) =
            request(url, 2 * 1024 * 1024, false, &cancel, deadline).await?
        else {
            return Err("torznab_invalid_xml");
        };
        let mut page = xml::page(&bytes, limit)?;
        if Instant::now() >= deadline {
            return Err("torznab_timeout");
        }
        if page.offset.is_some_and(|v| v != search.offset) {
            return Err("torznab_invalid_page");
        }
        let mut state = lock(&self.0.state);
        Self::current_scope(&state, &source, &scope, &cancel)?;
        state
            .results
            .retain(|_, handle| handle.created.elapsed() < RESULT_TTL);
        page.items.retain_mut(|item| {
            if item.link.starts_with("magnet:") {
                Payload::Magnet(item.link.clone()).validate().is_ok()
            } else {
                match link_url(&link_source, &item.link) {
                    Ok(url) => {
                        item.link = url.to_string();
                        true
                    }
                    Err(_) => false,
                }
            }
        });
        for item in &mut page.items {
            if let Some((id, _)) = state
                .results
                .iter()
                .find(|(_, h)| h.scope == scope && h.link == item.link)
            {
                item.result_ref = id.clone();
            } else {
                if state.results.len() >= 512 {
                    if let Some(old) = state
                        .results
                        .iter()
                        .min_by_key(|(_, h)| h.created)
                        .map(|(id, _)| id.clone())
                    {
                        state.results.remove(&old);
                    }
                }
                let id = storage::new_id();
                state.results.insert(
                    id.clone(),
                    Handle {
                        scope: scope.clone(),
                        link: item.link.clone(),
                        created: Instant::now(),
                    },
                );
                item.result_ref = id;
            }
        }
        let next = search.offset + page.count as u64;
        let next_offset = (page.count == limit
            && next <= 1_000_000
            && page.total.is_none_or(|total| next < total))
        .then_some(next);
        let mut value = json!({"schema":1,"sourceId":source.id,"items":page.items,"nextOffset":next_offset,"total":page.total});
        if let Some(id) = scope.indexer_id {
            value["indexerId"] = json!(id);
        }
        Ok(value)
    }
    pub async fn prepare(&self, prepare: Prepare) -> Result<Value> {
        let deadline = Instant::now() + DEADLINE;
        if !storage::reference(&prepare.result_ref) {
            return Err("torznab_reference_missing");
        }
        let _permit = self.0.requests.try_acquire().map_err(|_| "torznab_busy")?;
        let (source, cancel) = self.source(&prepare.source_id)?;
        let cancel = cancel.child_token();
        let _cancel_on_drop = cancel.clone().drop_guard();
        let (scope, link) = {
            let state = lock(&self.0.state);
            let handle = state
                .results
                .get(&prepare.result_ref)
                .filter(|h| {
                    h.scope.source_id == source.id
                        && h.scope.generation == source.generation
                        && h.created.elapsed() < RESULT_TTL
                })
                .ok_or("torznab_reference_missing")?;
            (handle.scope.clone(), handle.link.clone())
        };
        let payload = if link.starts_with("magnet:") {
            Payload::Magnet(link)
        } else {
            request(
                link_url(&source, &link)?,
                1024 * 1024,
                true,
                &cancel,
                deadline,
            )
            .await?
        };
        payload.validate()?;
        let this = self.clone();
        tokio::task::spawn_blocking(move || {
            let mut state = lock(&this.0.state);
            Self::current_scope(&state, &source, &scope, &cancel)?;
            if Instant::now() >= deadline {
                return Err("torznab_timeout");
            }
            let id = state.store.prepare(&source, payload)?;
            Ok(json!({"schema":1,"sourceId":source.id,"sourceRef":id}))
        })
        .await
        .map_err(|_| "torznab_store_unavailable")?
    }
    pub async fn create_session(
        &self,
        source_id: String,
        reference: String,
        torrent: Arc<super::torrent::TorrentManager>,
        selected: Option<usize>,
    ) -> Result<super::torrent::View> {
        if !storage::source_id(&source_id) || !storage::reference(&reference) {
            return Err("torznab_reference_missing");
        }
        let this = self.clone();
        let cancel = self.0.cancel.child_token();
        let _cancel_on_drop = cancel.clone().drop_guard();
        tokio::task::spawn_blocking(move || {
            let state = lock(&this.0.state);
            if cancel.is_cancelled() {
                return Err("torznab_cancelled");
            }
            // Configuration ownership and lease admission share this lock. A
            // removed source cannot start a lease from bytes read before removal.
            match state.store.payload(&source_id, &reference)? {
                Payload::Torrent(bytes) => torrent.create_metainfo(bytes, selected),
                Payload::Magnet(magnet) => torrent.create(magnet, selected),
            }
        })
        .await
        .map_err(|_| "torznab_store_unavailable")?
    }
    #[cfg(test)]
    pub async fn payload(&self, source_id: String, reference: String) -> Result<Payload> {
        if !storage::source_id(&source_id) || !storage::reference(&reference) {
            return Err("torznab_reference_missing");
        }
        let this = self.clone();
        tokio::task::spawn_blocking(move || {
            if this.0.cancel.is_cancelled() {
                return Err("torznab_cancelled");
            }
            lock(&this.0.state).store.payload(&source_id, &reference)
        })
        .await
        .map_err(|_| "torznab_store_unavailable")?
    }
}

#[cfg(test)]
mod scope_url_tests {
    use super::*;

    fn config(endpoint: &str) -> Config {
        Config {
            id: "home".into(),
            label: "Home".into(),
            endpoint: endpoint.into(),
            api_key: "fixture-only".into(),
            generation: "a".repeat(32),
        }
    }
    #[test]
    fn exact_child_path_preserves_https_prefix_case_and_suffix() {
        for suffix in ["", "/", "/api", "/api/"] {
            let source = config(&format!("https://jackett.example/home%20proxy/api/v2.0/indexers/all/results/torznab{suffix}"));
            assert_eq!(scoped_endpoint(&source, Some("Bittorrentfiles")).unwrap().as_str(),
                format!("https://jackett.example/home%20proxy/api/v2.0/indexers/Bittorrentfiles/results/torznab{suffix}"));
            assert_eq!(
                scoped_endpoint(&source, None).unwrap().as_str(),
                source.endpoint
            );
        }
    }
    #[test]
    fn invalid_children_never_expand_or_fall_back_to_aggregate() {
        let source =
            config("https://jackett.example/prefix/api/v2.0/indexers/all/results/torznab/api");
        for id in [
            "", "all", "ALL", "All", "tag:fast", "../child", "a/b", "a%2fb", " child", "a?key=1",
            "a#x", "a\\b",
        ] {
            assert_eq!(
                scoped_endpoint(&source, Some(id)).unwrap_err(),
                "torznab_invalid_indexer"
            );
        }
        for endpoint in [
            "https://jackett.example/api",
            "https://jackett.example/api/v2.0/indexers/tag:fast/results/torznab/api",
            "https://jackett.example/api/v2.0/indexers/one/results/torznab/api",
        ] {
            assert_eq!(
                scoped_endpoint(&config(endpoint), Some("one")).unwrap_err(),
                "torznab_indexers_unsupported"
            );
        }
    }
    #[test]
    fn child_download_links_resolve_against_child_and_do_not_downgrade_https() {
        let mut source =
            config("https://jackett.example/prefix/api/v2.0/indexers/all/results/torznab/api");
        source.endpoint = scoped_endpoint(&source, Some("ChildA"))
            .unwrap()
            .to_string();
        assert_eq!(link_url(&source, "download?t=one").unwrap().as_str(), "https://jackett.example/prefix/api/v2.0/indexers/ChildA/results/torznab/download?t=one");
        assert_eq!(
            link_url(&source, "/prefix/dl/ChildA?t=one")
                .unwrap()
                .as_str(),
            "https://jackett.example/prefix/dl/ChildA?t=one"
        );
        for link in [
            "http://jackett.example/prefix/dl/ChildA",
            "https://other.example/file",
            "//other.example/file",
            "https://user:pass@jackett.example/file",
            "download#fragment",
        ] {
            assert_eq!(link_url(&source, link).unwrap_err(), "torznab_invalid_link");
        }
    }
}
