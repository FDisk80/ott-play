//! Optional native media companion. Every route requires the private endpoint token.
//! This API contains no host-path commands and no dynamically downloaded code.
use axum::{
    body::Body,
    extract::{
        rejection::{JsonRejection, QueryRejection},
        DefaultBodyLimit, Path, Query, State,
    },
    http::{header, HeaderMap, Method, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{path::PathBuf, sync::Arc};
use tokio_util::sync::CancellationToken;
pub mod plugins;
mod source;
mod storage;
#[cfg(test)]
mod tests;
mod torrent;
mod torznab;
#[cfg(test)]
mod torznab_children_tests;
#[cfg(test)]
mod torznab_fixture;
mod torznab_store;
#[cfg(test)]
mod torznab_tests;
mod torznab_xml;
mod webseed;

#[derive(Clone)]
pub struct Companion(Arc<Inner>);

/// Per-instance limits. Desktop callers retain the established defaults;
/// constrained native hosts may lower them before starting the service.
#[derive(Clone, Copy, Debug)]
pub struct ResourceLimits {
    pub cache_bytes: u64,
    pub max_sessions: usize,
    pub max_streams: usize,
}
impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            cache_bytes: torrent::CACHE_LIMIT,
            max_sessions: torrent::MAX_SESSIONS,
            max_streams: 4,
        }
    }
}
impl ResourceLimits {
    pub fn validate(self) -> anyhow::Result<Self> {
        anyhow::ensure!(
            (64 * 1024 * 1024..=torrent::CACHE_LIMIT).contains(&self.cache_bytes),
            "Companion cache limit must be between 64 MiB and 2 GiB"
        );
        anyhow::ensure!(
            (1..=torrent::MAX_SESSIONS).contains(&self.max_sessions),
            "Companion session limit must be 1 or 2"
        );
        anyhow::ensure!(
            (1..=4).contains(&self.max_streams),
            "Companion stream limit must be between 1 and 4"
        );
        Ok(self)
    }
}
struct Inner {
    token: String,
    torrent: Arc<torrent::TorrentManager>,
    torznab: torznab::Torznab,
    plugins: plugins::PluginService,
    cancel: CancellationToken,
    limits: ResourceLimits,
}
impl Companion {
    pub async fn new(
        root: PathBuf,
        token: String,
        plugin_dir: Option<PathBuf>,
    ) -> anyhow::Result<Self> {
        Self::with_limits(root, token, plugin_dir, ResourceLimits::default()).await
    }
    pub async fn with_limits(
        root: PathBuf,
        token: String,
        plugin_dir: Option<PathBuf>,
        limits: ResourceLimits,
    ) -> anyhow::Result<Self> {
        let limits = limits.validate()?;
        anyhow::ensure!(
            (32..=128).contains(&token.len())
                && token
                    .bytes()
                    .all(|v| v.is_ascii_alphanumeric() || v == b'_' || v == b'-'),
            "Invalid companion access token"
        );
        let cancel = CancellationToken::new();
        let plugins = plugins::PluginService::load(plugin_dir.as_deref())
            .map_err(|error| anyhow::anyhow!(error.code()))?;
        let torrent =
            torrent::TorrentManager::new(root.join("torrent-cache"), cancel.clone(), limits)
                .await?;
        let torznab = torznab::Torznab::new(root.join("torznab-private"), cancel.clone())
            .await
            .map_err(anyhow::Error::msg)?;
        Ok(Self(Arc::new(Inner {
            token,
            torrent,
            torznab,
            plugins,
            cancel,
            limits,
        })))
    }
    pub fn endpoint(&self) -> String {
        format!("/companion/{}/v1", self.0.token)
    }
    pub fn routes(&self) -> Router {
        Router::new()
            .route(
                "/companion/:token/v1/capabilities",
                get(capabilities).options(preflight),
            )
            .route(
                "/companion/:token/v1/sessions",
                post(create).options(preflight),
            )
            .route(
                "/companion/:token/v1/sessions/:id",
                get(status).delete(remove).options(preflight),
            )
            .route(
                "/companion/:token/v1/sessions/:id/select",
                post(select).options(preflight),
            )
            .route(
                "/companion/:token/v1/sessions/:id/stream",
                get(stream).head(stream).options(preflight),
            )
            .route(
                "/companion/:token/v1/torrent/sources",
                get(torznab_sources)
                    .post(torznab_configure)
                    .options(preflight),
            )
            .route(
                "/companion/:token/v1/torrent/sources/:id",
                axum::routing::delete(torznab_remove).options(preflight),
            )
            .route(
                "/companion/:token/v1/torrent/sources/:id/indexers",
                get(torznab_indexers).options(preflight),
            )
            .route(
                "/companion/:token/v1/torrent/sources/:id/caps",
                get(torznab_caps).options(preflight),
            )
            .route(
                "/companion/:token/v1/torrent/search",
                post(torznab_search).options(preflight),
            )
            .route(
                "/companion/:token/v1/torrent/prepare",
                post(torznab_prepare).options(preflight),
            )
            .route(
                "/companion/:token/v1/plugins",
                get(plugin_list).options(preflight),
            )
            .route(
                "/companion/:token/v1/plugins/:id/resolve",
                post(plugin_resolve).options(preflight),
            )
            .layer(DefaultBodyLimit::max(64 * 1024))
            .layer(middleware::from_fn_with_state(self.clone(), authenticate))
            .with_state(self.clone())
    }
    pub async fn shutdown(&self) {
        self.0.cancel.cancel();
        self.0.torznab.shutdown();
        self.0.torrent.shutdown().await;
    }
}
impl Drop for Inner {
    fn drop(&mut self) {
        self.cancel.cancel();
    }
}
async fn authenticate(State(c): State<Companion>, request: Request<Body>, next: Next) -> Response {
    let token = request
        .uri()
        .path()
        .strip_prefix("/companion/")
        .and_then(|v| v.split('/').next())
        .unwrap_or("");
    // Constant work for correctly-sized tokens. There are no cookie credentials.
    let valid = token.len() == c.0.token.len()
        && token
            .bytes()
            .zip(c.0.token.bytes())
            .fold(0u8, |diff, (a, b)| diff | (a ^ b))
            == 0;
    if !valid {
        return failure("unauthorized");
    }
    if c.0.cancel.is_cancelled() {
        return failure("service_stopped");
    }
    let private_network_preflight = request.method() == Method::OPTIONS
        && request
            .headers()
            .get("access-control-request-private-network")
            .is_some_and(|value| value == "true");
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    headers.insert(header::CACHE_CONTROL, "no-store".parse().unwrap());
    headers.insert(header::REFERRER_POLICY, "no-referrer".parse().unwrap());
    headers.insert(header::X_CONTENT_TYPE_OPTIONS, "nosniff".parse().unwrap());
    // The private URL is the sole bearer credential. Allow uncredentialed web/TV
    // clients explicitly, never ambient cookies or Access-Control-Allow-Credentials.
    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*".parse().unwrap());
    if private_network_preflight {
        headers.insert(
            "access-control-allow-private-network",
            "true".parse().unwrap(),
        );
    }
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        "GET, HEAD, POST, DELETE, OPTIONS".parse().unwrap(),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        "Content-Type, Range".parse().unwrap(),
    );
    headers.insert(
        header::ACCESS_CONTROL_EXPOSE_HEADERS,
        "Accept-Ranges, Content-Range, Content-Length"
            .parse()
            .unwrap(),
    );
    response
}
fn failure(code: &'static str) -> Response {
    let status = match code {
        "unauthorized" => StatusCode::UNAUTHORIZED,
        "session_missing"
        | "plugin_not_found"
        | "torznab_source_missing"
        | "torznab_indexer_missing"
        | "torznab_reference_missing" => StatusCode::NOT_FOUND,
        "service_stopped" | "session_stopped" | "plugin_cancelled" => {
            StatusCode::SERVICE_UNAVAILABLE
        }
        "session_busy"
        | "session_limit"
        | "stream_limit"
        | "cache_limit"
        | "busy"
        | "cleanup_pending"
        | "plugin_busy"
        | "torznab_busy"
        | "torznab_store_limit"
        | "torznab_source_limit" => StatusCode::CONFLICT,
        "stream_timeout" | "plugin_timed_out" | "torznab_timeout" => StatusCode::GATEWAY_TIMEOUT,
        "plugin_execution_failed"
        | "plugin_network_failed"
        | "torznab_http_error"
        | "torznab_network_error"
        | "torznab_api_error" => StatusCode::BAD_GATEWAY,
        _ => StatusCode::BAD_REQUEST,
    };
    (status, Json(json!({"schema":1,"error":code}))).into_response()
}
async fn preflight() -> StatusCode {
    StatusCode::NO_CONTENT
}
async fn capabilities(State(c): State<Companion>) -> Json<Value> {
    Json(
        json!({"schema":1,"torrent":true,"plugins":true,"localTorznab":true,"localTorznabChildren":true,"torrentSources":["magnet","http","https","local-reference"],"fileSelection":true,"maxSessions":c.0.limits.max_sessions,"maxStreams":c.0.limits.max_streams,"cacheBytes":c.0.limits.cache_bytes,"inboundPeerListener":false,"pluginNetwork":true,"pluginNetworkDefault":false}),
    )
}

#[cfg(test)]
mod resource_tests {
    use super::*;

    #[tokio::test]
    async fn capabilities_publish_the_actual_instance_limits() {
        let root = std::env::temp_dir().join(format!("ott-limits-{}", uuid::Uuid::new_v4()));
        let limits = ResourceLimits {
            cache_bytes: 64 * 1024 * 1024,
            max_sessions: 1,
            max_streams: 2,
        };
        let companion = Companion::with_limits(root.clone(), "z".repeat(48), None, limits)
            .await
            .unwrap();
        let Json(caps) = capabilities(State(companion.clone())).await;
        assert_eq!(caps["cacheBytes"], limits.cache_bytes);
        assert_eq!(caps["maxSessions"], 1);
        assert_eq!(caps["maxStreams"], 2);
        companion.shutdown().await;
        drop(companion);
        std::fs::remove_dir_all(root).unwrap();
    }
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Create {
    source: Option<String>,
    source_id: Option<String>,
    source_ref: Option<String>,
    file_index: Option<usize>,
}
async fn create(State(c): State<Companion>, body: Result<Json<Create>, JsonRejection>) -> Response {
    let Ok(Json(body)) = body else {
        return failure("invalid_request");
    };
    let result = match (body.source, body.source_id, body.source_ref) {
        (Some(source), None, None) => c.0.torrent.create(source, body.file_index),
        (None, Some(source_id), Some(reference)) => {
            c.0.torznab
                .create_session(source_id, reference, c.0.torrent.clone(), body.file_index)
                .await
        }
        _ => Err("invalid_request"),
    };
    match result {
        Ok(view) => (StatusCode::ACCEPTED, Json(view)).into_response(),
        Err(code) => failure(code),
    }
}
async fn torznab_sources(State(c): State<Companion>) -> Json<Value> {
    Json(c.0.torznab.sources())
}
fn torznab_response(result: Result<Value, &'static str>) -> Response {
    match result {
        Ok(value) => Json(value).into_response(),
        Err(code) => failure(code),
    }
}
async fn torznab_configure(
    State(c): State<Companion>,
    body: Result<Json<torznab::Configure>, JsonRejection>,
) -> Response {
    let Ok(Json(body)) = body else {
        return failure("invalid_request");
    };
    torznab_response(c.0.torznab.configure(body).await)
}
async fn torznab_remove(
    State(c): State<Companion>,
    Path((_, id)): Path<(String, String)>,
) -> Response {
    torznab_response(c.0.torznab.remove(id).await)
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct IndexerScopeQuery {
    #[serde(default, deserialize_with = "torznab::optional_indexer")]
    indexer_id: Option<String>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EmptyQuery {}
async fn torznab_indexers(
    State(c): State<Companion>,
    Path((_, id)): Path<(String, String)>,
    query: Result<Query<EmptyQuery>, QueryRejection>,
) -> Response {
    if query.is_err() {
        return failure("invalid_request");
    }
    torznab_response(c.0.torznab.indexers(&id).await)
}
async fn torznab_caps(
    State(c): State<Companion>,
    Path((_, id)): Path<(String, String)>,
    query: Result<Query<IndexerScopeQuery>, QueryRejection>,
) -> Response {
    let Ok(Query(query)) = query else {
        return failure("invalid_request");
    };
    torznab_response(c.0.torznab.caps(&id, query.indexer_id.as_deref()).await)
}
async fn torznab_search(
    State(c): State<Companion>,
    body: Result<Json<torznab::Search>, JsonRejection>,
) -> Response {
    let Ok(Json(body)) = body else {
        return failure("invalid_request");
    };
    torznab_response(c.0.torznab.search(body).await)
}
async fn torznab_prepare(
    State(c): State<Companion>,
    body: Result<Json<torznab::Prepare>, JsonRejection>,
) -> Response {
    let Ok(Json(body)) = body else {
        return failure("invalid_request");
    };
    torznab_response(c.0.torznab.prepare(body).await)
}
async fn status(State(c): State<Companion>, Path((_, id)): Path<(String, String)>) -> Response {
    match c.0.torrent.get(&id) {
        Some(lease) => Json(lease.view()).into_response(),
        None => failure("session_missing"),
    }
}
async fn remove(State(c): State<Companion>, Path((_, id)): Path<(String, String)>) -> Response {
    if c.0.torrent.remove(&id).await {
        StatusCode::NO_CONTENT.into_response()
    } else if c.0.torrent.get(&id).is_some() {
        failure("cleanup_pending")
    } else {
        failure("session_missing")
    }
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Select {
    file_index: usize,
}
async fn select(
    State(c): State<Companion>,
    Path((_, id)): Path<(String, String)>,
    body: Result<Json<Select>, JsonRejection>,
) -> Response {
    let Ok(Json(body)) = body else {
        return failure("invalid_request");
    };
    let Some(lease) = c.0.torrent.get(&id) else {
        return failure("session_missing");
    };
    match lease.choose(body.file_index) {
        Ok(view) => (StatusCode::ACCEPTED, Json(view)).into_response(),
        Err(code) => failure(code),
    }
}
fn range(value: Option<&str>, size: u64) -> Result<(u64, u64, bool), ()> {
    let Some(value) = value else {
        return Ok((0, size, false));
    };
    let value = value.strip_prefix("bytes=").ok_or(())?;
    let (start, end) = value.split_once('-').ok_or(())?;
    fn number(value: &str) -> Result<u64, ()> {
        if value.is_empty() || !value.bytes().all(|v| v.is_ascii_digit()) {
            return Err(());
        }
        value.parse().map_err(|_| ())
    }
    if start.is_empty() {
        let length = number(end)?.min(size);
        if length == 0 {
            return Err(());
        }
        return Ok((size - length, length, true));
    }
    let start = number(start)?;
    if start >= size {
        return Err(());
    }
    let end = if end.is_empty() {
        size - 1
    } else {
        number(end)?.min(size - 1)
    };
    if end < start {
        return Err(());
    }
    Ok((start, end - start + 1, true))
}
async fn stream(
    State(c): State<Companion>,
    Path((_, id)): Path<(String, String)>,
    method: Method,
    headers: HeaderMap,
) -> Response {
    let Some(lease) = c.0.torrent.get(&id) else {
        return failure("session_missing");
    };
    let view = lease.view();
    if view.state != "ready" {
        return failure("session_busy");
    }
    let Some(file) = view
        .files
        .iter()
        .find(|file| Some(file.index) == view.selected)
    else {
        return failure("invalid_file");
    };
    let ranges: Vec<_> = headers.get_all(header::RANGE).iter().collect();
    let parsed = match ranges.as_slice() {
        [] => range(None, file.length),
        [value] => value
            .to_str()
            .map_err(|_| ())
            .and_then(|value| range(Some(value), file.length)),
        _ => Err(()),
    };
    let (start, length, partial) = match parsed {
        Ok(v) => v,
        Err(()) => {
            return (
                StatusCode::RANGE_NOT_SATISFIABLE,
                [(header::CONTENT_RANGE, format!("bytes */{}", file.length))],
            )
                .into_response()
        }
    };
    let body = if method == Method::HEAD {
        Body::empty()
    } else {
        match c.0.torrent.stream(lease, start, length).await {
            Ok(body) => body,
            Err(code) => return failure(code),
        }
    };
    let mime = match file
        .name
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "mp4" | "m4v" => "video/mp4",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "avi" => "video/x-msvideo",
        "ts" => "video/mp2t",
        "mp3" => "audio/mpeg",
        "m4a" => "audio/mp4",
        _ => "application/octet-stream",
    };
    let mut response = Response::builder()
        .status(if partial {
            StatusCode::PARTIAL_CONTENT
        } else {
            StatusCode::OK
        })
        .header(header::CONTENT_TYPE, mime)
        .header(header::CONTENT_LENGTH, length.to_string())
        .header(header::ACCEPT_RANGES, "bytes");
    if partial {
        response = response.header(
            header::CONTENT_RANGE,
            format!("bytes {}-{}/{}", start, start + length - 1, file.length),
        );
    }
    response.body(body).unwrap()
}
async fn plugin_list(State(c): State<Companion>) -> Json<Value> {
    Json(json!({"schema":1,"plugins":c.0.plugins.list()}))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Resolve {
    input: Value,
}
async fn plugin_resolve(
    State(c): State<Companion>,
    Path((_, id)): Path<(String, String)>,
    body: Result<Json<Resolve>, JsonRejection>,
) -> Response {
    let Ok(Json(body)) = body else {
        return failure("invalid_request");
    };
    let cancel = c.0.cancel.child_token();
    let _guard = cancel.clone().drop_guard();
    match c.0.plugins.resolve(&id, body.input, cancel).await {
        Ok(output) => Json(output).into_response(),
        Err(error) => failure(error.code()),
    }
}
