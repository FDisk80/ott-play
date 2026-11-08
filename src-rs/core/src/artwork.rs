//! Bounded, binary-safe artwork for trusted local player transports.
//! This is not a public relay: callers must enforce their own local/auth boundary.

use serde::Deserialize;

pub const MAX_REQUEST_BYTES: usize = 8 * 1024;
pub const MAX_IMAGE_BYTES: usize = 4 * 1024 * 1024;
pub const TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub url: String,
}

impl Request {
    pub fn validate(&self) -> Result<(), &'static str> {
        validate_url(&self.url).map(|_| ())
    }
}

pub(crate) fn validate_url(raw: &str) -> Result<reqwest::Url, &'static str> {
    if raw.len() > 4096 {
        return Err("Invalid artwork URL");
    }
    let url = reqwest::Url::parse(raw).map_err(|_| "Invalid artwork URL")?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
    {
        return Err("Invalid artwork URL");
    }
    Ok(url)
}

#[derive(Debug)]
pub struct Image {
    pub content_type: &'static str,
    pub bytes: Vec<u8>,
}

/// MIME is selected from the binary signature, never the upstream response header.
pub fn raster_content_type(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if bytes.starts_with(b"\xff\xd8\xff") {
        Some("image/jpeg")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some("image/gif")
    } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        Some("image/webp")
    } else {
        None
    }
}

pub async fn fetch(request: Request) -> Result<Image, String> {
    fetch_inner(request, None).await
}

/// Cancel async work on standby, while retaining the lease for any blocking DNS.
pub async fn fetch_tracked(
    request: Request,
    work: super::background_work::WorkLease,
) -> Result<Image, String> {
    work.run(fetch_inner(request, Some(work.clone())))
        .await
        .map_err(str::to_string)?
}

async fn fetch_inner(
    request: Request,
    work: Option<super::background_work::WorkLease>,
) -> Result<Image, String> {
    let url = validate_url(&request.url)?;
    let bytes = super::proxy::fetch_artwork(url, work).await?;
    let content_type = raster_content_type(&bytes).ok_or("Unsupported artwork format")?;
    Ok(Image {
        content_type,
        bytes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn artwork_allows_only_http_without_userinfo_or_fragments() {
        for raw in [
            "http://images.example/img/1.jpg?token=fixture",
            "https://images.example/1.png",
        ] {
            assert!(validate_url(raw).is_ok());
        }
        for raw in [
            "file:///tmp/private",
            "data:image/png;base64,AA==",
            "ftp://images.example/1",
            "http://u:p@images.example/1",
            "http://images.example/1#fragment",
        ] {
            assert_eq!(validate_url(raw).unwrap_err(), "Invalid artwork URL");
        }
        assert!(validate_url(&format!("http://images.example/{}", "a".repeat(4096))).is_err());
        assert!(serde_json::from_str::<Request>(
            r#"{"url":"https://example.test/a","headers":{}}"#
        )
        .is_err());
    }

    #[test]
    fn artwork_signature_allowlist_rejects_active_and_unknown_content() {
        for (bytes, mime) in [
            (b"\x89PNG\r\n\x1a\n".as_slice(), "image/png"),
            (b"\xff\xd8\xff".as_slice(), "image/jpeg"),
            (b"GIF87a".as_slice(), "image/gif"),
            (b"GIF89a".as_slice(), "image/gif"),
            (b"RIFF\x00\x00\x00\x00WEBP".as_slice(), "image/webp"),
        ] {
            assert_eq!(raster_content_type(bytes), Some(mime));
        }
        for bytes in [
            b"<svg xmlns='http://www.w3.org/2000/svg'/>".as_slice(),
            b"<!doctype html><script>1</script>",
            b"RIFF",
            b"RIFF0000WAVE",
            b"\xff\xd8",
            b"",
        ] {
            assert_eq!(raster_content_type(bytes), None);
        }
    }

    #[tokio::test]
    async fn artwork_private_destinations_fail_without_echoing_url_tokens() {
        for url in [
            "http://127.0.0.1/img?token=fixture-secret",
            "http://169.254.169.254/img",
            "http://[::1]/img",
        ] {
            assert_eq!(
                fetch(Request { url: url.into() }).await.unwrap_err(),
                "Proxy destination is not allowed"
            );
        }
    }
}
