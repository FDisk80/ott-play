//! Local-only artwork transport. Never expose this arbitrary-URL route through a relay.
use std::net::SocketAddr;

use axum::{
    extract::{rejection::JsonRejection, ConnectInfo, DefaultBodyLimit, Request},
    http::{uri::Authority, HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};

pub fn routes() -> Router {
    Router::new()
        .route("/artwork", post(artwork_handler))
        .layer(DefaultBodyLimit::max(
            ottplay_core::artwork::MAX_REQUEST_BYTES,
        ))
        .route_layer(middleware::from_fn(local_only))
}

fn local_request(peer: SocketAddr, headers: &HeaderMap) -> bool {
    if !peer.ip().is_loopback()
        || headers
            .keys()
            .any(|name| name == "forwarded" || name.as_str().starts_with("x-forwarded-"))
    {
        return false;
    }
    // A public hostname resolving to loopback must not make the player a relay.
    let Some(host) = headers.get("host").and_then(|value| value.to_str().ok()) else {
        return false;
    };
    let Ok(authority) = host.parse::<Authority>() else {
        return false;
    };
    if !["localhost", "127.0.0.1", "[::1]"]
        .iter()
        .any(|allowed| authority.host().eq_ignore_ascii_case(allowed))
        || host.contains('@')
    {
        return false;
    }
    if let Some(site) = headers.get("sec-fetch-site") {
        if !matches!(site.to_str(), Ok("same-origin" | "none")) {
            return false;
        }
    }
    if let Some(origin) = headers.get("origin") {
        let Ok(origin) = origin.to_str() else {
            return false;
        };
        let Ok(url) = reqwest::Url::parse(origin) else {
            return false;
        };
        if !matches!(url.scheme(), "http" | "https")
            || url.origin().ascii_serialization() != origin
            || !origin
                .split_once("://")
                .is_some_and(|(_, value)| value.eq_ignore_ascii_case(host))
        {
            return false;
        }
    }
    true
}

async fn local_only(request: Request, next: Next) -> Response {
    let allowed = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .is_some_and(|peer| local_request(peer.0, request.headers()));
    let response = if allowed {
        next.run(request).await
    } else {
        (
            StatusCode::FORBIDDEN,
            "Artwork requires a local player request",
        )
            .into_response()
    };
    let (mut parts, body) = response.into_parts();
    parts
        .headers
        .insert("cache-control", "no-store".parse().unwrap());
    parts
        .headers
        .insert("x-content-type-options", "nosniff".parse().unwrap());
    Response::from_parts(parts, body)
}

async fn artwork_handler(
    request: Result<Json<ottplay_core::artwork::Request>, JsonRejection>,
) -> Response {
    let request = match request {
        Ok(Json(request)) if request.validate().is_ok() => request,
        Err(error) if error.status() == StatusCode::PAYLOAD_TOO_LARGE => {
            return (
                StatusCode::PAYLOAD_TOO_LARGE,
                "Artwork request exceeds byte limit",
            )
                .into_response();
        }
        _ => return (StatusCode::BAD_REQUEST, "Invalid artwork request").into_response(),
    };
    match ottplay_core::artwork::fetch(request).await {
        Ok(image) => ([("content-type", image.content_type)], image.bytes).into_response(),
        // URL query tokens, response bodies and upstream headers never enter errors/logs.
        Err(error) => {
            let (status, message) = match error.as_str() {
                "Proxy destination is not allowed" => {
                    (StatusCode::FORBIDDEN, "Artwork destination is not allowed")
                }
                "Proxy request timed out" => {
                    (StatusCode::GATEWAY_TIMEOUT, "Artwork request timed out")
                }
                "Proxy is busy; retry later" | "Proxy DNS is busy; retry later" => (
                    StatusCode::SERVICE_UNAVAILABLE,
                    "Artwork proxy is busy; retry later",
                ),
                "Unsupported artwork format" => (
                    StatusCode::UNSUPPORTED_MEDIA_TYPE,
                    "Unsupported artwork format",
                ),
                _ => (StatusCode::BAD_GATEWAY, "Artwork request failed"),
            };
            (status, message).into_response()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::{to_bytes, Body};
    use tower::Service;

    fn headers(host: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert("host", host.parse().unwrap());
        headers
    }

    #[test]
    fn artwork_route_requires_real_loopback_and_rejects_cross_site_and_proxy_requests() {
        let peer = "127.0.0.1:1234".parse().unwrap();
        for host in ["localhost:8443", "127.0.0.1:8443", "[::1]:8443"] {
            let mut values = headers(host);
            assert!(local_request(peer, &values));
            values.insert("origin", format!("https://{host}").parse().unwrap());
            values.insert("sec-fetch-site", "same-origin".parse().unwrap());
            assert!(local_request(peer, &values));
        }
        for host in [
            "player.example",
            "localhost.evil:8443",
            "127.0.0.2:8443",
            "localhost@evil:8443",
            "192.168.1.1:8443",
        ] {
            assert!(!local_request(peer, &headers(host)));
        }
        assert!(!local_request(
            "192.168.1.2:1234".parse().unwrap(),
            &headers("localhost:8443")
        ));
        for (name, value) in [
            ("origin", "https://evil.example"),
            ("origin", "null"),
            ("origin", "http://localhost:8444"),
            ("origin", "http://user@localhost:8443"),
            ("origin", "http://localhost:8443/path"),
            ("sec-fetch-site", "cross-site"),
            ("sec-fetch-site", "same-site"),
            ("forwarded", "for=127.0.0.1"),
            ("x-forwarded-for", "127.0.0.1"),
            ("x-forwarded-host", "localhost:8443"),
        ] {
            let mut values = headers("localhost:8443");
            values.insert(
                axum::http::header::HeaderName::from_static(name),
                value.parse().unwrap(),
            );
            assert!(!local_request(peer, &values), "{name}");
        }
    }

    async fn post(body: String, peer: Option<SocketAddr>) -> Response {
        let mut request = Request::post("/artwork")
            .header("host", "localhost:8443")
            .header("content-type", "application/json")
            .body(Body::from(body))
            .unwrap();
        if let Some(peer) = peer {
            request.extensions_mut().insert(ConnectInfo(peer));
        }
        routes().call(request).await.unwrap()
    }

    #[tokio::test]
    async fn artwork_route_is_private_bounded_and_never_echoes_tokens() {
        let peer = Some("127.0.0.1:1234".parse().unwrap());
        assert_eq!(post("{".into(), None).await.status(), StatusCode::FORBIDDEN);
        assert_eq!(
            post("{".into(), peer).await.status(),
            StatusCode::BAD_REQUEST
        );
        assert_eq!(
            post(
                " ".repeat(ottplay_core::artwork::MAX_REQUEST_BYTES + 1),
                peer
            )
            .await
            .status(),
            StatusCode::PAYLOAD_TOO_LARGE
        );
        let response = post(
            r#"{"url":"http://127.0.0.1/image?token=fixture-secret"}"#.into(),
            peer,
        )
        .await;
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert_eq!(response.headers()["cache-control"], "no-store");
        assert_eq!(response.headers()["x-content-type-options"], "nosniff");
        assert!(!response
            .headers()
            .contains_key("access-control-allow-origin"));
        assert_eq!(
            to_bytes(response.into_body(), 1024).await.unwrap(),
            "Artwork destination is not allowed"
        );
    }
}
