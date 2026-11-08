//! Bounded HTTP playlist proxy. Each connection uses only previously checked DNS
//! answers; redirects and environment proxies cannot bypass that check.
use std::future::Future;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};
use std::time::Duration;

use reqwest::{header::HeaderMap, redirect, Client, Url};
use tokio::sync::Semaphore;

use super::background_work::WorkLease;

const MAX_BYTES: usize = 16 * 1024 * 1024;
const MAX_REQUESTS: usize = 8;
const MAX_REDIRECTS: usize = 5;
const TIMEOUT: Duration = Duration::from_secs(15);
// Playlist generation can exceed the short portal/API budget even for modest
// catalogs. This remains a total deadline, including DNS, redirects and reads.
const PLAYLIST_TIMEOUT: Duration = Duration::from_secs(60);
static REQUESTS: Semaphore = Semaphore::const_new(MAX_REQUESTS);
static DNS_REQUESTS: Semaphore = Semaphore::const_new(MAX_REQUESTS);

#[derive(Clone, Default)]
struct Policy {
    // Only exact literal RFC1918/ULA origins can enter this list via configuration.
    lan_origins: Vec<String>,
}

fn http_url(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw).map_err(|_| "Invalid proxy URL")?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err("Only HTTP(S) proxy URLs are supported".into());
    }
    Ok(url)
}

fn redirect_url(current: &Url, location: &str) -> Result<Url, String> {
    let joined = current
        .join(location)
        .map_err(|_| "Invalid proxy redirect")?;
    let mut next = http_url(joined.as_str())?;
    // URL::join drops userinfo for an absolute Location. Preserve the original
    // Basic credentials only within the exact same scheme/host/effective port.
    if next.origin() == current.origin()
        && next.username().is_empty()
        && next.password().is_none()
        && (!current.username().is_empty() || current.password().is_some())
    {
        next.set_username(current.username())
            .map_err(|_| "Invalid proxy redirect")?;
        next.set_password(current.password())
            .map_err(|_| "Invalid proxy redirect")?;
    }
    Ok(next)
}

fn literal_ip(url: &Url) -> Option<IpAddr> {
    url.host_str()?
        .trim_start_matches('[')
        .trim_end_matches(']')
        .parse()
        .ok()
}

fn is_lan(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => ip.is_private(),
        IpAddr::V6(ip) => ip.segments()[0] & 0xfe00 == 0xfc00,
    }
}

fn public_v4(ip: Ipv4Addr) -> bool {
    let [a, b, c, _] = ip.octets();
    !(a == 0
        || a == 10
        || a == 127
        || a >= 224
        || (a == 100 && (64..=127).contains(&b))
        || (a == 169 && b == 254)
        || (a == 172 && (16..=31).contains(&b))
        || (a == 192
            && (b == 168 || (b == 0 && c == 0) || (b == 0 && c == 2) || (b == 88 && c == 99)))
        || (a == 198 && (b == 18 || b == 19 || (b == 51 && c == 100)))
        || (a == 203 && b == 0 && c == 113))
}

fn public_v6(ip: Ipv6Addr) -> bool {
    if let Some(v4) = ip.to_ipv4_mapped() {
        return public_v4(v4);
    }
    let s = ip.segments();
    // Only global unicast. Exclude special-use, documentation and 6to4 ranges;
    // NAT64, ULA, link-local, multicast and IPv4-compatible forms are outside /3.
    s[0] & 0xe000 == 0x2000
        && !(s[0] == 0x2001 && s[1] < 0x0200)
        && !(s[0] == 0x2001 && s[1] == 0x0db8)
        && s[0] != 0x2002
        && !(s[0] == 0x3fff && s[1] < 0x1000)
}

fn is_public(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => public_v4(ip),
        IpAddr::V6(ip) => public_v6(ip),
    }
}

impl Policy {
    fn parse(raw: &str) -> Result<Self, String> {
        let mut policy = Self::default();
        for entry in raw
            .split(',')
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            let url = http_url(entry).map_err(|_| "Invalid OTTPLAY_PROXY_LAN_ORIGINS")?;
            if !literal_ip(&url).is_some_and(is_lan)
                || !url.username().is_empty()
                || url.password().is_some()
                || !matches!(url.path(), "" | "/")
                || url.query().is_some()
                || url.fragment().is_some()
            {
                return Err("OTTPLAY_PROXY_LAN_ORIGINS requires exact HTTP(S) origins with literal RFC1918/ULA addresses".into());
            }
            policy.lan_origins.push(url.origin().ascii_serialization());
        }
        Ok(policy)
    }

    fn check_addresses(&self, url: &Url, addresses: &[SocketAddr]) -> Result<(), String> {
        let lan_allowed = self
            .lan_origins
            .contains(&url.origin().ascii_serialization());
        if addresses.is_empty()
            || addresses.len() > 32
            || addresses
                .iter()
                .any(|address| !(is_public(address.ip()) || lan_allowed && is_lan(address.ip())))
        {
            return Err("Proxy destination is not allowed".into());
        }
        Ok(())
    }

    async fn resolve(&self, url: &Url) -> Result<Vec<SocketAddr>, String> {
        self.resolve_tracked(url, None).await
    }

    async fn resolve_tracked(
        &self,
        url: &Url,
        work: Option<WorkLease>,
    ) -> Result<Vec<SocketAddr>, String> {
        let port = url.port_or_known_default().ok_or("Invalid proxy port")?;
        let addresses = if let Some(ip) = literal_ip(url) {
            vec![SocketAddr::new(ip, port)]
        } else {
            let host = url.host_str().ok_or("Invalid proxy host")?.to_string();
            dns_lookup_tracked(work, move || {
                (host.as_str(), port)
                    .to_socket_addrs()
                    .map(|answers| answers.take(33).collect())
            })
            .await?
        };
        self.check_addresses(url, &addresses)?;
        Ok(addresses)
    }
}

async fn dns_lookup_tracked<F>(
    work: Option<WorkLease>,
    lookup: F,
) -> Result<Vec<SocketAddr>, String>
where
    F: FnOnce() -> std::io::Result<Vec<SocketAddr>> + Send + 'static,
{
    if let Some(work) = &work {
        work.check().map_err(str::to_string)?;
    }
    let permit = DNS_REQUESTS
        .try_acquire()
        .map_err(|_| "Proxy DNS is busy; retry later")?;
    // Dropping the async request cannot stop libc DNS. Keep both its admission
    // slot and instance lease in the blocking task until lookup actually exits.
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        let _work = work;
        if let Some(work) = &_work {
            work.check().map_err(str::to_string)?;
        }
        lookup().map_err(|_| "Proxy DNS lookup failed".to_string())
    })
    .await
    .map_err(|_| "Proxy DNS lookup failed")?
}

fn pinned_client(url: &Url, addresses: &[SocketAddr], title_case: bool) -> Result<Client, String> {
    let mut builder = Client::builder();
    // Older Stalker PHP portals use case-sensitive getallheaders() lookups.
    if title_case {
        builder = builder.http1_title_case_headers();
    }
    builder
        .no_proxy()
        .redirect(redirect::Policy::none())
        // The operation's outer deadline covers all hops and response reads.
        // A shorter client deadline would silently truncate playlist budgets.
        // The original hostname remains in Host and TLS SNI/certificate checks.
        // The connector cannot perform a second, potentially rebound DNS lookup.
        .resolve_to_addrs(url.host_str().ok_or("Invalid proxy host")?, addresses)
        .build()
        .map_err(|_| "Cannot create proxy client".into())
}

async fn request_pinned(
    url: Url,
    ua: &str,
    addresses: &[SocketAddr],
) -> Result<reqwest::Response, String> {
    pinned_client(&url, addresses, false)?
        .get(url)
        .header("User-Agent", ua)
        .send()
        .await
        .map_err(|_| "Proxy upstream request failed".into())
}

async fn read_bounded(
    mut response: reqwest::Response,
    max_bytes: usize,
) -> Result<(HeaderMap, Vec<u8>), String> {
    if response
        .content_length()
        .is_some_and(|size| size > max_bytes as u64)
    {
        return Err("Proxy response exceeds byte limit".into());
    }
    let headers = response.headers().clone();
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|error| {
        if error.is_timeout() {
            "Proxy request timed out"
        } else {
            "Proxy response read failed"
        }
    })? {
        if chunk.len() > max_bytes - body.len() {
            return Err("Proxy response exceeds byte limit".into());
        }
        body.extend_from_slice(&chunk);
    }
    Ok((headers, body))
}

async fn fetch_checked<F, Fut>(
    mut url: Url,
    ua: &str,
    mut check: F,
    max_bytes: usize,
) -> Result<(HeaderMap, Vec<u8>), String>
where
    F: FnMut(Url) -> Fut,
    Fut: Future<Output = Result<Vec<SocketAddr>, String>>,
{
    for hop in 0..=MAX_REDIRECTS {
        let addresses = check(url.clone()).await?;
        let response = request_pinned(url.clone(), ua, &addresses).await?;
        let status = response.status();
        if matches!(status.as_u16(), 301 | 302 | 303 | 307 | 308) {
            if hop == MAX_REDIRECTS {
                return Err("Too many proxy redirects".into());
            }
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|value| value.to_str().ok())
                .ok_or("Invalid proxy redirect")?;
            url = redirect_url(&url, location)?;
            continue;
        }
        if !status.is_success() {
            return Err(format!("Upstream {status}"));
        }
        return read_bounded(response, max_bytes).await;
    }
    Err("Too many proxy redirects".into())
}

async fn limited<T>(
    requests: &Semaphore,
    timeout: Duration,
    work: impl Future<Output = Result<T, String>>,
) -> Result<T, String> {
    // Reject overload immediately instead of creating an unbounded waiter queue.
    let _permit = requests
        .try_acquire()
        .map_err(|_| "Proxy is busy; retry later")?;
    tokio::time::timeout(timeout, work)
        .await
        .map_err(|_| "Proxy request timed out")?
}

pub(crate) async fn fetch(raw: &str, ua: &str) -> Result<(HeaderMap, Vec<u8>), String> {
    limited(&REQUESTS, PLAYLIST_TIMEOUT, async {
        let url = http_url(raw)?;
        let policy =
            Policy::parse(&std::env::var("OTTPLAY_PROXY_LAN_ORIGINS").unwrap_or_default())?;
        fetch_checked(
            url,
            ua,
            |url| {
                let policy = policy.clone();
                async move { policy.resolve(&url).await }
            },
            MAX_BYTES,
        )
        .await
    })
    .await
}

async fn artwork_checked<F, Fut>(url: Url, mut check: F) -> Result<Vec<u8>, String>
where
    F: FnMut(Url) -> Fut,
    Fut: Future<Output = Result<Vec<SocketAddr>, String>>,
{
    let origin = url.origin();
    let (_, bytes) = fetch_checked(
        url,
        "OTT-play-FOSS/1.0",
        |url| {
            let valid =
                super::artwork::validate_url(url.as_str()).is_ok() && url.origin() == origin;
            // Validate before invoking the resolver so rejected hops cannot cause DNS work.
            let resolved = valid.then(|| check(url));
            async move {
                match resolved {
                    Some(resolved) => resolved.await,
                    None => Err(
                        "Artwork redirect must remain on the same origin without credentials"
                            .into(),
                    ),
                }
            }
        },
        super::artwork::MAX_IMAGE_BYTES,
    )
    .await?;
    Ok(bytes)
}

pub(crate) async fn fetch_artwork(url: Url, work: Option<WorkLease>) -> Result<Vec<u8>, String> {
    limited(&REQUESTS, super::artwork::TIMEOUT, async {
        let policy =
            Policy::parse(&std::env::var("OTTPLAY_PROXY_LAN_ORIGINS").unwrap_or_default())?;
        artwork_checked(url, |url| {
            let policy = policy.clone();
            let work = work.clone();
            async move { policy.resolve_tracked(&url, work).await }
        })
        .await
    })
    .await
}

// Stalker needs explicit MAC/session headers which browsers cannot set. Keep
// the existing DNS pinning, limits and destination policy for this transport.
async fn get_headers_checked<F, Fut>(
    mut url: Url,
    headers: HeaderMap,
    mut check: F,
    max_bytes: usize,
) -> Result<(reqwest::StatusCode, Vec<u8>), String>
where
    F: FnMut(Url) -> Fut,
    Fut: Future<Output = Result<Vec<SocketAddr>, String>>,
{
    for hop in 0..=MAX_REDIRECTS {
        let addresses = check(url.clone()).await?;
        let response = pinned_client(&url, &addresses, true)?
            .get(url.clone())
            .headers(headers.clone())
            .send()
            .await
            .map_err(|_| "Proxy upstream request failed")?;
        let status = response.status();
        if matches!(status.as_u16(), 301 | 302 | 303 | 307 | 308) {
            if hop == MAX_REDIRECTS {
                return Err("Too many proxy redirects".into());
            }
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|v| v.to_str().ok())
                .ok_or("Invalid proxy redirect")?;
            let next = redirect_url(&url, location)?;
            if next.origin() != url.origin()
                || !next.username().is_empty()
                || next.password().is_some()
            {
                return Err("Stalker redirect must remain on the same origin".into());
            }
            url = next;
            continue;
        }
        let (_, body) = read_bounded(response, max_bytes).await?;
        return Ok((status, body));
    }
    Err("Too many proxy redirects".into())
}

pub(crate) async fn get_headers(
    raw: &str,
    headers: HeaderMap,
) -> Result<(reqwest::StatusCode, Vec<u8>), String> {
    get_headers_limit(raw, headers, MAX_BYTES).await
}

pub(crate) async fn get_headers_limit(
    raw: &str,
    headers: HeaderMap,
    max_bytes: usize,
) -> Result<(reqwest::StatusCode, Vec<u8>), String> {
    limited(&REQUESTS, TIMEOUT, async {
        let url = http_url(raw)?;
        let policy =
            Policy::parse(&std::env::var("OTTPLAY_PROXY_LAN_ORIGINS").unwrap_or_default())?;
        get_headers_checked(
            url,
            headers,
            |url| {
                let policy = policy.clone();
                async move { policy.resolve(&url).await }
            },
            max_bytes,
        )
        .await
    })
    .await
}

async fn post_json_checked<F, Fut>(
    mut url: Url,
    body: &[u8],
    mut check: F,
    max_bytes: usize,
) -> Result<(reqwest::StatusCode, Vec<u8>), String>
where
    F: FnMut(Url) -> Fut,
    Fut: Future<Output = Result<Vec<SocketAddr>, String>>,
{
    for hop in 0..=MAX_REDIRECTS {
        let addresses = check(url.clone()).await?;
        let response = pinned_client(&url, &addresses, false)?
            .post(url.clone())
            .header(reqwest::header::USER_AGENT, "OTT-play-FOSS/1.0")
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .header(reqwest::header::ACCEPT, "application/json")
            .body(body.to_vec())
            .send()
            .await
            .map_err(|error| {
                if error.is_timeout() {
                    "Proxy request timed out"
                } else {
                    "Proxy upstream request failed"
                }
            })?;
        let status = response.status();
        if matches!(status.as_u16(), 301 | 302 | 303 | 307 | 308) {
            if hop == MAX_REDIRECTS {
                return Err("Too many proxy redirects".into());
            }
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|value| value.to_str().ok())
                .ok_or("Invalid proxy redirect")?;
            let next = redirect_url(&url, location)?;
            // The JSON body contains the access key. Never forward it to another
            // origin. Same-origin redirects retain the VPortal POST protocol and
            // still repeat DNS/address validation before connecting.
            if next.origin() != url.origin()
                || next.username() != url.username()
                || next.password() != url.password()
            {
                return Err("VPortal redirect must remain on the same origin".into());
            }
            url = next;
            continue;
        }
        let (_, body) = read_bounded(response, max_bytes).await?;
        // Preserve non-success JSON responses so callers can report portal errors.
        return Ok((status, body));
    }
    Err("Too many proxy redirects".into())
}

pub(crate) async fn post_json(
    raw: &str,
    body: &[u8],
) -> Result<(reqwest::StatusCode, Vec<u8>), String> {
    limited(&REQUESTS, TIMEOUT, async {
        let url = http_url(raw)?;
        let policy =
            Policy::parse(&std::env::var("OTTPLAY_PROXY_LAN_ORIGINS").unwrap_or_default())?;
        post_json_checked(
            url,
            body,
            |url| {
                let policy = policy.clone();
                async move { policy.resolve(&url).await }
            },
            MAX_BYTES,
        )
        .await
    })
    .await
}

/// Strict resolver transport. This does not inherit playlist LAN exceptions,
/// headers, redirects or environment proxies. The caller owns its deadline.
pub(crate) async fn fetch_plugin_text(
    raw: &str,
    allowed_hosts: &[String],
    max_bytes: usize,
) -> Result<String, &'static str> {
    let url = plugin_url(raw, allowed_hosts)?;
    let response = companion_get(url).await?;
    plugin_response_text(response, max_bytes).await
}

/// Torrent metadata uses the same strict default address policy as resolvers.
/// Unlike the configurable playlist proxy, it never opts into LAN origins.
pub(crate) async fn fetch_companion_metadata(raw: &str) -> Result<Vec<u8>, &'static str> {
    let url = Url::parse(raw).map_err(|_| "source_invalid")?;
    if raw.len() > 16 * 1024
        || raw.trim() != raw
        || raw.chars().any(char::is_control)
        || !matches!(url.scheme(), "http" | "https")
        || !matches!(url.port_or_known_default(), Some(80 | 443))
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
        || url.host_str().is_none()
    {
        return Err("source_invalid");
    }
    tokio::time::timeout(TIMEOUT, async {
        let response = companion_get(url).await?;
        companion_response_bytes(response, 1024 * 1024).await
    })
    .await
    .map_err(|_| "source_timeout")?
}

/// A web seed is an untrusted public peer. Recheck and pin every redirect;
/// never inherit the playlist proxy's LAN exceptions or ambient credentials.
pub(crate) fn companion_range_url(raw: &str) -> Result<Url, &'static str> {
    let url = Url::parse(raw).map_err(|_| "webseed_network_denied")?;
    if raw.len() > 8192
        || raw.trim() != raw
        || raw.chars().any(char::is_control)
        || !matches!(url.scheme(), "http" | "https")
        || !matches!(url.port_or_known_default(), Some(80 | 443))
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
        || url.host_str().is_none()
    {
        return Err("webseed_network_denied");
    }
    Ok(url)
}

pub(crate) async fn fetch_companion_range(
    raw: &str,
    start: u64,
    length: u64,
    total: u64,
    cancel: &tokio_util::sync::CancellationToken,
) -> Result<Vec<u8>, &'static str> {
    let url = companion_range_url(raw)?;
    tokio::select! {
        _ = cancel.cancelled() => Err("session_stopped"),
        result = tokio::time::timeout(TIMEOUT, companion_range_with(url, start, length, total, |url| async move {
            Policy::default().resolve(&url).await.map_err(|_| "webseed_network_denied")
        })) => result.map_err(|_| "webseed_timeout")?,
    }
}

async fn companion_range_with<F, Fut>(
    mut url: Url,
    start: u64,
    length: u64,
    total: u64,
    resolve: F,
) -> Result<Vec<u8>, &'static str>
where
    F: Fn(Url) -> Fut,
    Fut: Future<Output = Result<Vec<SocketAddr>, &'static str>>,
{
    let end = start.checked_add(length).ok_or("webseed_invalid_range")?;
    if length == 0 || length > 16 * 1024 * 1024 || end > total {
        return Err("webseed_invalid_range");
    }
    for hop in 0..=MAX_REDIRECTS {
        let addresses = resolve(url.clone()).await?;
        let client = Client::builder()
            .no_proxy()
            .redirect(redirect::Policy::none())
            .no_gzip()
            .no_brotli()
            .no_deflate()
            .no_zstd()
            .resolve_to_addrs(url.host_str().ok_or("webseed_network_denied")?, &addresses)
            .build()
            .map_err(|_| "webseed_unavailable")?;
        let mut response = client
            .get(url.clone())
            .header(reqwest::header::ACCEPT_ENCODING, "identity")
            .header(reqwest::header::RANGE, format!("bytes={start}-{}", end - 1))
            .send()
            .await
            .map_err(|_| "webseed_unavailable")?;
        if response.status().is_redirection() {
            if hop == MAX_REDIRECTS {
                return Err("webseed_unavailable");
            }
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|v| v.to_str().ok())
                .ok_or("webseed_unavailable")?;
            let next = url.join(location).map_err(|_| "webseed_network_denied")?;
            url = companion_range_url(next.as_str())?;
            continue;
        }
        if response
            .headers()
            .get(reqwest::header::CONTENT_ENCODING)
            .is_some_and(|v| v != "identity")
        {
            return Err("webseed_invalid_range");
        }
        let expected = format!("bytes {start}-{}/{total}", end - 1);
        if response.status() == reqwest::StatusCode::PARTIAL_CONTENT {
            if response
                .headers()
                .get(reqwest::header::CONTENT_RANGE)
                .and_then(|v| v.to_str().ok())
                != Some(expected.as_str())
            {
                return Err("webseed_invalid_range");
            }
        } else if response.status() != reqwest::StatusCode::OK || start != 0 || length != total {
            return Err("webseed_invalid_range");
        }
        if response.content_length().is_some_and(|n| n != length) {
            return Err("webseed_invalid_range");
        }
        let mut bytes = Vec::with_capacity(length as usize);
        while let Some(chunk) = response.chunk().await.map_err(|_| "webseed_unavailable")? {
            if bytes.len() + chunk.len() > length as usize {
                return Err("webseed_invalid_range");
            }
            bytes.extend_from_slice(&chunk);
        }
        return if bytes.len() == length as usize {
            Ok(bytes)
        } else {
            Err("webseed_invalid_range")
        };
    }
    Err("webseed_unavailable")
}

#[cfg(test)]
mod webseed_range_tests {
    use super::*;
    use axum::{response::IntoResponse, routing::get, Router};

    #[tokio::test]
    async fn pinned_ranges_validate_status_length_encoding_and_every_redirect() {
        let app = Router::new().route("/:kind", get(|axum::extract::Path(kind): axum::extract::Path<String>, headers: HeaderMap| async move {
            assert_eq!(headers.get("range").unwrap(), "bytes=2-4");
            assert_eq!(headers.get("accept-encoding").unwrap(), "identity");
            assert!(!headers.contains_key("authorization"));
            assert!(!headers.contains_key("cookie"));
            match kind.as_str() {
                "redirect" => (axum::http::StatusCode::FOUND, [("location", "http://private.invalid/data")], "").into_response(),
                "oversize" => (axum::http::StatusCode::PARTIAL_CONTENT, [("content-range", "bytes 2-4/10")], "toolong").into_response(),
                "short" => (axum::http::StatusCode::PARTIAL_CONTENT, [("content-range", "bytes 2-4/10")], "ab").into_response(),
                "wrong" => (axum::http::StatusCode::PARTIAL_CONTENT, [("content-range", "bytes 0-2/10")], "abc").into_response(),
                "full" => (axum::http::StatusCode::OK, [("content-range", "bytes 2-4/10")], "abc").into_response(),
                "encoded" => (axum::http::StatusCode::PARTIAL_CONTENT, [("content-range", "bytes 2-4/10"), ("content-encoding", "gzip")], "abc").into_response(),
                _ => (axum::http::StatusCode::PARTIAL_CONTENT, [("content-range", "bytes 2-4/10")], "abc").into_response(),
            }
        }));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let task = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        for kind in [
            "ok", "oversize", "short", "wrong", "full", "encoded", "redirect",
        ] {
            let url = companion_range_url(&format!("http://webseed.invalid/{kind}")).unwrap();
            let result = companion_range_with(url, 2, 3, 10, |url| async move {
                if url.host_str() == Some("webseed.invalid") {
                    Ok(vec![address])
                } else {
                    Err("webseed_network_denied")
                }
            })
            .await;
            if kind == "ok" {
                assert_eq!(result.unwrap(), b"abc");
            } else if kind == "redirect" {
                assert_eq!(result.unwrap_err(), "webseed_network_denied");
            } else {
                assert_eq!(result.unwrap_err(), "webseed_invalid_range", "{kind}");
            }
        }
        task.abort();
    }

    #[tokio::test]
    async fn webseed_public_policy_rejects_lan_and_cancellation() {
        for url in [
            "http://127.0.0.1/a",
            "http://169.254.169.254/latest",
            "http://10.1.2.3/a",
            "http://[::1]/a",
        ] {
            let cancel = tokio_util::sync::CancellationToken::new();
            assert_eq!(
                fetch_companion_range(url, 0, 1, 1, &cancel)
                    .await
                    .unwrap_err(),
                "webseed_network_denied"
            );
        }
        for url in [
            "http://user:pass@example.test/a",
            "file:///tmp/a",
            "https://example.test:9000/a",
            "https://example.test/a#b",
        ] {
            assert!(companion_range_url(url).is_err());
        }
        let cancel = tokio_util::sync::CancellationToken::new();
        cancel.cancel();
        assert_eq!(
            fetch_companion_range("http://example.invalid/a", 0, 1, 1, &cancel)
                .await
                .unwrap_err(),
            "session_stopped"
        );
    }
}

async fn companion_get(url: Url) -> Result<reqwest::Response, &'static str> {
    let addresses = Policy::default()
        .resolve(&url)
        .await
        .map_err(|_| "plugin_network_denied")?;
    let client = Client::builder()
        .no_proxy()
        .redirect(redirect::Policy::none())
        .no_gzip()
        .no_brotli()
        .no_deflate()
        .no_zstd()
        .resolve_to_addrs(url.host_str().ok_or("plugin_network_denied")?, &addresses)
        .build()
        .map_err(|_| "plugin_network_failed")?;
    client
        .get(url)
        .header(reqwest::header::ACCEPT_ENCODING, "identity")
        .send()
        .await
        .map_err(|_| "plugin_network_failed")
}

fn plugin_url(raw: &str, allowed_hosts: &[String]) -> Result<Url, &'static str> {
    if raw.len() > 8192 || raw.trim() != raw || raw.chars().any(char::is_control) {
        return Err("plugin_network_denied");
    }
    let url = Url::parse(raw).map_err(|_| "plugin_network_denied")?;
    if url.scheme() != "https"
        || url.port_or_known_default() != Some(443)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
        || !allowed_hosts
            .iter()
            .any(|host| Some(host.as_str()) == url.host_str())
    {
        return Err("plugin_network_denied");
    }
    Ok(url)
}

async fn plugin_response_text(
    response: reqwest::Response,
    max_bytes: usize,
) -> Result<String, &'static str> {
    let bytes = companion_response_bytes(response, max_bytes).await?;
    String::from_utf8(bytes).map_err(|_| "plugin_network_failed")
}

async fn companion_response_bytes(
    response: reqwest::Response,
    max_bytes: usize,
) -> Result<Vec<u8>, &'static str> {
    if !response.status().is_success()
        || response
            .headers()
            .get_all(reqwest::header::CONTENT_ENCODING)
            .iter()
            .any(|value| {
                value
                    .to_str()
                    .map_or(true, |value| !value.eq_ignore_ascii_case("identity"))
            })
    {
        return Err("plugin_network_failed");
    }
    let (_, bytes) = read_bounded(response, max_bytes)
        .await
        .map_err(|_| "plugin_network_limit")?;
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt};

    #[tokio::test]
    async fn artwork_dns_keeps_instance_pending_after_standby_cancels_the_request() {
        let background = super::super::background_work::BackgroundWork::default();
        let lease = background.enter().unwrap();
        let (started, ready) = tokio::sync::oneshot::channel();
        let (release, blocked) = std::sync::mpsc::channel();
        let request = tokio::spawn(async move {
            lease
                .run(dns_lookup_tracked(Some(lease.clone()), move || {
                    let _ = started.send(());
                    // Deterministic libc-DNS stand-in: cancellation cannot interrupt
                    // this blocking operation. Dropping the sender also unblocks it
                    // if an assertion fails, so the test runtime cannot hang.
                    blocked
                        .recv()
                        .map_err(|_| std::io::Error::other("fixture released"))?;
                    Ok(vec!["8.8.8.8:80".parse().unwrap()])
                }))
                .await
        });
        tokio::time::timeout(Duration::from_secs(2), ready)
            .await
            .unwrap()
            .unwrap();
        background.set_standby(true);
        assert_eq!(
            tokio::time::timeout(Duration::from_secs(2), request)
                .await
                .unwrap()
                .unwrap(),
            Err("Player background work cancelled")
        );
        assert_eq!(background.status().pending, 1);
        assert!(!background.status().quiescent);
        release.send(()).unwrap();
        tokio::time::timeout(Duration::from_secs(2), background.wait_for_idle())
            .await
            .unwrap();
        assert_eq!(background.status().pending, 0);
        assert!(background.status().quiescent);
    }

    #[tokio::test]
    async fn artwork_dns_never_starts_for_a_revoked_instance_lease() {
        let background = super::super::background_work::BackgroundWork::default();
        let lease = background.enter().unwrap();
        background.set_standby(true);
        assert_eq!(
            dns_lookup_tracked(Some(lease), || panic!("Cancelled artwork started DNS")).await,
            Err("Player background work cancelled".into())
        );
        assert!(background.status().quiescent);
    }

    #[tokio::test]
    async fn artwork_redirects_recheck_pinned_dns_and_preserve_binary_bytes() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            for hop in 0..2 {
                let (mut socket, _) = listener.accept().await.unwrap();
                let request = read_request(&mut socket).await.to_lowercase();
                assert!(!request.contains("authorization:"));
                assert!(!request.contains("cookie:"));
                let response: &[u8] = if hop == 0 {
                    b"HTTP/1.1 302 Found\r\nLocation: /final.jpg\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                } else {
                    // The declared content type cannot turn binary bytes into text.
                    b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 5\r\nConnection: close\r\n\r\n\xff\xd8\xff\x00\xfe"
                };
                socket.write_all(response).await.unwrap();
            }
        });
        let url = http_url(&format!(
            "http://images.invalid:{}/first.jpg",
            address.port()
        ))
        .unwrap();
        let mut resolved = 0;
        let bytes = artwork_checked(url, |_| {
            resolved += 1;
            async move { Ok(vec![address]) }
        })
        .await
        .unwrap();
        assert_eq!(resolved, 2);
        assert_eq!(bytes, b"\xff\xd8\xff\x00\xfe");
        assert_eq!(
            super::super::artwork::raster_content_type(&bytes),
            Some("image/jpeg")
        );
        server.await.unwrap();
    }

    #[tokio::test]
    async fn artwork_rejects_redirect_scope_changes_before_dns_and_enforces_image_budget() {
        for response in [
            b"HTTP/1.1 302 Found\r\nLocation: http://other.invalid/final\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".as_slice(),
            b"HTTP/1.1 302 Found\r\nLocation: http://user:secret@images.invalid/final\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            b"HTTP/1.1 302 Found\r\nLocation: /final#fragment\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
        ] {
            let (address, server) = fixture(response).await;
            let mut resolved = 0;
            let result = artwork_checked(http_url("http://images.invalid/first").unwrap(), |_| {
                resolved += 1;
                async move { Ok(vec![address]) }
            }).await;
            assert_eq!(result.unwrap_err(), "Artwork redirect must remain on the same origin without credentials");
            assert_eq!(resolved, 1);
            server.await.unwrap();
        }
        let (address, server) =
            fixture(b"HTTP/1.1 200 OK\r\nContent-Length: 4194305\r\nConnection: close\r\n\r\n")
                .await;
        let error = artwork_checked(
            http_url("http://images.invalid/oversized").unwrap(),
            |_| async move { Ok(vec![address]) },
        )
        .await
        .unwrap_err();
        assert_eq!(error, "Proxy response exceeds byte limit");
        server.await.unwrap();
    }

    #[tokio::test]
    async fn stalker_headers_are_preserved_and_cross_origin_redirects_are_rejected() {
        for location in [
            "/server/load.php?next=1",
            "http://other.invalid/server/load.php",
        ] {
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let address = listener.local_addr().unwrap();
            let external = location.starts_with("http");
            let task = tokio::spawn(async move {
                for index in 0..if external { 1 } else { 2 } {
                    let (socket, _) = listener.accept().await.unwrap();
                    let mut socket = tokio::io::BufReader::new(socket);
                    let mut wire = String::new();
                    loop {
                        let mut line = String::new();
                        assert!(socket.read_line(&mut line).await.unwrap() > 0);
                        wire.push_str(&line);
                        if line == "\r\n" {
                            break;
                        }
                    }
                    assert!(wire.contains("Authorization: Bearer fixture-token"));
                    let text = wire.to_lowercase();
                    assert!(text.contains("cookie: mac=fixture"));
                    assert!(text.contains("authorization: bearer fixture-token"));
                    let response = if index == 0 {
                        format!("HTTP/1.1 302 Found\r\nLocation: {location}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                    } else {
                        "HTTP/1.1 200 OK\r\nContent-Length: 9\r\nConnection: close\r\n\r\n{\"js\":{}}".into()
                    };
                    socket.write_all(response.as_bytes()).await.unwrap();
                }
            });
            let mut headers = HeaderMap::new();
            headers.insert("cookie", "mac=fixture".parse().unwrap());
            headers.insert("authorization", "Bearer fixture-token".parse().unwrap());
            let url = http_url(&format!(
                "http://portal.invalid:{}/server/load.php",
                address.port()
            ))
            .unwrap();
            let mut resolutions = 0;
            let result = get_headers_checked(
                url,
                headers,
                |_| {
                    resolutions += 1;
                    async move { Ok(vec![address]) }
                },
                1024,
            )
            .await;
            if external {
                assert_eq!(
                    result.unwrap_err(),
                    "Stalker redirect must remain on the same origin"
                );
                assert_eq!(resolutions, 1);
            } else {
                assert_eq!(result.unwrap().1, b"{\"js\":{}}");
                assert_eq!(resolutions, 2);
            }
            task.await.unwrap();
        }
    }

    #[test]
    fn public_destinations_exclude_special_ipv4_ipv6_and_numeric_aliases() {
        for value in [
            "8.8.8.8",
            "93.184.216.34",
            "2606:4700:4700::1111",
            "2001:4860:4860::8888",
        ] {
            assert!(is_public(value.parse().unwrap()), "{value}");
        }
        for value in [
            "0.0.0.0",
            "10.1.2.3",
            "127.0.0.1",
            "100.64.0.1",
            "169.254.169.254",
            "172.16.0.1",
            "192.168.1.1",
            "192.0.0.1",
            "192.0.2.1",
            "198.18.0.1",
            "198.51.100.1",
            "203.0.113.1",
            "224.0.0.1",
            "240.0.0.1",
            "::",
            "::1",
            "::ffff:127.0.0.1",
            "::ffff:169.254.169.254",
            "::127.0.0.1",
            "fc00::1",
            "fe80::1",
            "ff02::1",
            "64:ff9b::7f00:1",
            "2001::1",
            "2001:db8::1",
            "2002:7f00:1::",
            "3fff::1",
        ] {
            assert!(!is_public(value.parse().unwrap()), "{value}");
        }
        for raw in [
            "http://2130706433/",
            "http://0x7f000001/",
            "http://127.1/",
            "http://[::ffff:127.0.0.1]/",
        ] {
            assert!(
                !is_public(literal_ip(&http_url(raw).unwrap()).unwrap()),
                "{raw}"
            );
        }
        assert!(http_url("file:///tmp/secret").is_err());
        assert!(http_url("ftp://example.com/playlist").is_err());
    }

    #[test]
    fn dns_answer_sets_fail_closed_and_lan_exceptions_are_exact_origins() {
        let public = http_url("https://provider.example/playlist?password=secret").unwrap();
        let addresses = [
            "8.8.8.8:443".parse().unwrap(),
            "127.0.0.1:443".parse().unwrap(),
        ];
        assert!(Policy::default()
            .check_addresses(&public, &addresses)
            .is_err());
        let policy = Policy::parse("http://192.168.1.20:8080, https://[fd00::10]:8443").unwrap();
        let ip = ["192.168.1.20:8080".parse().unwrap()];
        assert!(policy
            .check_addresses(&http_url("http://192.168.1.20:8080/list").unwrap(), &ip)
            .is_ok());
        for url in [
            "http://192.168.1.20:8081/list",
            "https://192.168.1.20:8080/list",
            "http://provider.example:8080/list",
        ] {
            assert!(policy
                .check_addresses(&http_url(url).unwrap(), &ip)
                .is_err());
        }
        for origin in [
            "*",
            "http://127.0.0.1:8080",
            "http://169.254.169.254",
            "http://[::1]",
            "http://provider.example",
            "http://192.168.1.0/24",
            "http://user:secret@192.168.1.20",
            "http://192.168.1.20?allow=all",
        ] {
            assert!(Policy::parse(origin).is_err(), "{origin}");
        }
    }

    async fn fixture(response: &'static [u8]) -> (SocketAddr, tokio::task::JoinHandle<String>) {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let request = read_request(&mut socket).await;
            socket.write_all(response).await.unwrap();
            request
        });
        (address, task)
    }

    async fn read_request(socket: &mut tokio::net::TcpStream) -> String {
        let mut reader = tokio::io::BufReader::new(socket);
        let mut request = String::new();
        let mut length = 0;
        loop {
            let mut line = String::new();
            assert!(reader.read_line(&mut line).await.unwrap() > 0);
            if let Some(value) = line.to_ascii_lowercase().strip_prefix("content-length:") {
                length = value.trim().parse().unwrap();
            }
            request.push_str(&line);
            if line == "\r\n" {
                break;
            }
        }
        let mut body = vec![0; length];
        reader.read_exact(&mut body).await.unwrap();
        request.push_str(std::str::from_utf8(&body).unwrap());
        request
    }

    #[tokio::test]
    async fn json_post_pins_destination_and_preserves_body_and_upstream_errors() {
        let (address, request) = fixture(b"HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\nContent-Length: 16\r\nConnection: close\r\n\r\n{\"type\":\"error\"}").await;
        let url = http_url(&format!(
            "http://post-fixture.invalid:{}/api/v1/",
            address.port()
        ))
        .unwrap();
        let body =
            r#"{"app":"ott-play","key":"fixture-secret","query":"Тест","limit":100}"#.as_bytes();
        let (status, response) =
            post_json_checked(url, body, |_| async { Ok(vec![address]) }, MAX_BYTES)
                .await
                .unwrap();
        assert_eq!(status, reqwest::StatusCode::FORBIDDEN);
        assert_eq!(response, br#"{"type":"error"}"#);
        let request = request.await.unwrap();
        let (headers, received_body) = request.split_once("\r\n\r\n").unwrap();
        assert!(headers.starts_with("POST /api/v1/ HTTP/1.1\r\n"));
        assert!(headers
            .to_ascii_lowercase()
            .contains("content-type: application/json"));
        assert!(headers
            .to_ascii_lowercase()
            .contains(&format!("host: post-fixture.invalid:{}", address.port())));
        assert!(!headers.contains("fixture-secret"));
        assert_eq!(received_body.as_bytes(), body);
    }

    #[tokio::test]
    async fn json_post_does_not_forward_keys_across_origins() {
        for response in [
            b"HTTP/1.1 307 Temporary Redirect\r\nLocation: http://other.example/api\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".as_slice(),
            b"HTTP/1.1 302 Found\r\nLocation: http://169.254.169.254/api\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".as_slice(),
        ] {
            let (address, request) = fixture(response).await;
            let url = http_url(&format!("http://post-fixture.invalid:{}/api", address.port())).unwrap();
            let error = post_json_checked(url, br#"{"key":"fixture-secret"}"#, |_| async { Ok(vec![address]) }, MAX_BYTES).await.unwrap_err();
            assert_eq!(error, "VPortal redirect must remain on the same origin");
            assert!(!error.contains("fixture-secret"));
            request.await.unwrap();
        }
    }

    #[tokio::test]
    async fn json_post_retains_protocol_and_rechecks_same_origin_redirects() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let task = tokio::spawn(async move {
            let mut requests = Vec::new();
            for response in [
                "HTTP/1.1 301 Moved Permanently\r\nLocation: /api/v1/\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}",
            ] {
                let (mut socket, _) = listener.accept().await.unwrap();
                requests.push(read_request(&mut socket).await);
                socket.write_all(response.as_bytes()).await.unwrap();
            }
            requests
        });
        let url = http_url(&format!(
            "http://post-fixture.invalid:{}/api/v1",
            address.port()
        ))
        .unwrap();
        let mut checked = Vec::new();
        let (_, body) = post_json_checked(
            url,
            br#"{"key":"fixture-secret"}"#,
            |url| {
                checked.push(url.path().to_string());
                async move { Ok(vec![address]) }
            },
            MAX_BYTES,
        )
        .await
        .unwrap();
        assert_eq!(body, b"{}");
        assert_eq!(checked, ["/api/v1", "/api/v1/"]);
        let requests = task.await.unwrap();
        for request in requests {
            assert!(request.starts_with("POST /api/v1"));
            assert!(request.ends_with(r#"{"key":"fixture-secret"}"#));
        }
    }

    #[tokio::test]
    async fn transport_pins_checked_address_and_preserves_host_and_user_agent() {
        let (address, request) =
            fixture(b"HTTP/1.1 200 OK\r\nContent-Length: 7\r\nConnection: close\r\n\r\n#EXTM3U")
                .await;
        // This hostname cannot resolve publicly; only the supplied checked address works.
        let url = http_url(&format!(
            "http://pinning-fixture.invalid:{}/list",
            address.port()
        ))
        .unwrap();
        let response = request_pinned(url, "OTT-audit-UA", &[address])
            .await
            .unwrap();
        assert_eq!(response.text().await.unwrap(), "#EXTM3U");
        let raw = request.await.unwrap().to_lowercase();
        assert!(raw.contains(&format!("host: pinning-fixture.invalid:{}", address.port())));
        assert!(raw.contains("user-agent: ott-audit-ua"));
    }

    #[tokio::test]
    async fn redirect_destination_is_rechecked_before_connecting() {
        let (address, request) = fixture(b"HTTP/1.1 302 Found\r\nLocation: http://169.254.169.254/latest/meta-data\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;
        let url = http_url(&format!(
            "http://redirect-fixture.invalid:{}/list",
            address.port()
        ))
        .unwrap();
        let error = fetch_checked(
            url,
            "audit",
            |url| async move {
                // Approve just the dummy first hop; every redirect uses the real policy.
                if url.host_str() == Some("redirect-fixture.invalid") {
                    Ok(vec![address])
                } else {
                    Policy::default().resolve(&url).await
                }
            },
            MAX_BYTES,
        )
        .await
        .unwrap_err();
        assert_eq!(error, "Proxy destination is not allowed");
        request.await.unwrap();
    }

    #[tokio::test]
    async fn redirects_keep_basic_auth_only_within_the_same_origin() {
        for kind in ["relative", "absolute", "other"] {
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let address = listener.local_addr().unwrap();
            let location = match kind {
                "relative" => "/final".to_string(),
                "absolute" => format!(
                    "http://credentials-fixture.invalid:{}/final",
                    address.port()
                ),
                _ => format!("http://other-fixture.invalid:{}/final", address.port()),
            };
            let task = tokio::spawn(async move {
                let mut requests = Vec::new();
                for reply in [
                    format!("HTTP/1.1 302 Found\r\nLocation: {location}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"),
                    "HTTP/1.1 200 OK\r\nContent-Length: 7\r\nConnection: close\r\n\r\n#EXTM3U".into(),
                ] {
                    let (mut socket, _) = listener.accept().await.unwrap();
                    let mut request = vec![0; 4096];
                    let length = socket.read(&mut request).await.unwrap();
                    requests.push(String::from_utf8_lossy(&request[..length]).to_lowercase());
                    socket.write_all(reply.as_bytes()).await.unwrap();
                }
                requests
            });
            let url = http_url(&format!(
                "http://dummy:secret@credentials-fixture.invalid:{}/start",
                address.port()
            ))
            .unwrap();
            let (_, body) = fetch_checked(url, "audit", |_| async { Ok(vec![address]) }, MAX_BYTES)
                .await
                .unwrap();
            assert_eq!(body, b"#EXTM3U");
            let requests = task.await.unwrap();
            assert!(requests[0].contains("authorization: basic zhvtbxk6c2vjcmv0"));
            assert_eq!(
                requests[1].contains("authorization: basic zhvtbxk6c2vjcmv0"),
                kind != "other",
                "{kind}"
            );
        }
        let current = http_url("https://user%40name:secret%2Fkey@provider.example/start").unwrap();
        let same = redirect_url(&current, "https://provider.example/final").unwrap();
        assert_eq!(same.username(), current.username());
        assert_eq!(same.password(), current.password());
        for target in [
            "http://provider.example/final",
            "https://provider.example:8443/final",
            "https://other.example/final",
        ] {
            let next = redirect_url(&current, target).unwrap();
            assert!(next.username().is_empty());
            assert!(next.password().is_none());
        }
    }

    #[tokio::test]
    async fn byte_limit_covers_declared_and_chunked_responses() {
        for response in [
            b"HTTP/1.1 200 OK\r\nContent-Length: 17\r\nConnection: close\r\n\r\n01234567890123456".as_slice(),
            b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n8\r\n01234567\r\n9\r\n890123456\r\n0\r\n\r\n".as_slice(),
        ] {
            let (address, request) = fixture(response).await;
            let url = http_url(&format!("http://size-fixture.invalid:{}/list", address.port())).unwrap();
            let error = fetch_checked(url, "audit", |_| async { Ok(vec![address]) }, 16).await.unwrap_err();
            assert_eq!(error, "Proxy response exceeds byte limit");
            request.await.unwrap();
        }
    }

    #[tokio::test]
    async fn overload_rejects_without_running_work_and_errors_release_permits() {
        let requests = Semaphore::new(1);
        let held = requests.acquire().await.unwrap();
        let result: Result<(), String> = limited(&requests, TIMEOUT, async {
            panic!("busy work must not run")
        })
        .await;
        assert_eq!(result.unwrap_err(), "Proxy is busy; retry later");
        drop(held);
        let failed: Result<(), String> =
            limited(&requests, TIMEOUT, async { Err("upstream failed".into()) }).await;
        assert!(failed.is_err());
        assert_eq!(requests.available_permits(), 1);
        {
            let pending = limited::<()>(&requests, TIMEOUT, std::future::pending());
            tokio::pin!(pending);
            tokio::select! { result = &mut pending => panic!("unexpected {result:?}"), _ = tokio::task::yield_now() => {} }
            assert_eq!(requests.available_permits(), 0);
        }
        assert_eq!(requests.available_permits(), 1);
    }

    #[tokio::test]
    async fn deadline_cancels_pending_work_and_releases_its_slot() {
        let requests = Semaphore::new(1);
        let result =
            limited::<()>(&requests, Duration::from_millis(10), std::future::pending()).await;
        assert_eq!(result.unwrap_err(), "Proxy request timed out");
        assert_eq!(requests.available_permits(), 1);
        let completed = limited(&requests, PLAYLIST_TIMEOUT, async { Ok(7) }).await;
        assert_eq!(completed.unwrap(), 7);
    }

    #[test]
    fn plugin_transport_requires_exact_https_host_without_credentials() {
        let hosts = vec!["media.example".to_owned()];
        assert!(plugin_url("https://media.example/catalog.json", &hosts).is_ok());
        for url in [
            "http://media.example/catalog.json",
            "https://media.example:8443/catalog.json",
            "https://media.example.evil/catalog.json",
            "https://other.example/catalog.json",
            "https://user:secret@media.example/catalog.json",
            "https://media.example/catalog.json#fragment",
            " https://media.example/catalog.json",
        ] {
            assert_eq!(
                plugin_url(url, &hosts).unwrap_err(),
                "plugin_network_denied"
            );
        }
    }

    #[tokio::test]
    async fn companion_fetch_rejects_local_addresses_even_when_host_is_listed() {
        for host in ["127.0.0.1", "169.254.169.254", "192.168.1.1", "[::1]"] {
            let url = format!("https://{host}/catalog");
            assert_eq!(
                fetch_plugin_text(&url, &[host.to_owned()], 1024)
                    .await
                    .unwrap_err(),
                "plugin_network_denied"
            );
            assert_eq!(
                fetch_companion_metadata(&url).await.unwrap_err(),
                "plugin_network_denied"
            );
        }
    }

    #[tokio::test]
    async fn plugin_response_limits_reject_redirects_encoding_and_oversized_bodies() {
        for (response, expected) in [
            (b"HTTP/1.1 302 Found\r\nLocation: https://media.example/next\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".as_slice(), "plugin_network_failed"),
            (b"HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}".as_slice(), "plugin_network_failed"),
            (b"HTTP/1.1 200 OK\r\nContent-Length: 9\r\nConnection: close\r\n\r\n123456789".as_slice(), "plugin_network_limit"),
            (b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n9\r\n123456789\r\n0\r\n\r\n".as_slice(), "plugin_network_limit"),
        ] {
            let (address, task) = fixture(response).await;
            let url = http_url(&format!("http://response-fixture.invalid:{}/catalog", address.port())).unwrap();
            let received = request_pinned(url, "fixture", &[address]).await.unwrap();
            assert_eq!(plugin_response_text(received, 8).await.unwrap_err(), expected);
            task.await.unwrap();
        }
        let (address, task) =
            fixture(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}").await;
        let url = http_url(&format!(
            "http://response-fixture.invalid:{}/catalog",
            address.port()
        ))
        .unwrap();
        let received = request_pinned(url, "fixture", &[address]).await.unwrap();
        assert_eq!(plugin_response_text(received, 8).await.unwrap(), "{}");
        task.await.unwrap();
    }
}
