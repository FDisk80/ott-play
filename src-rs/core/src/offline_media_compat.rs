//! Thin authenticated routes; filesystem access remains owned by offline_media.
use super::*;
use crate::local_compatibility::{Error, Input, Manager};
// Library is trusted host configuration, never an HTTP State extractor.
pub(super) fn routes(library: &Library) -> Router<Library> {
    let prepare = library.clone();
    let cancel = library.clone();
    let playlist = library.clone();
    let segment = library.clone();
    Router::new()
        .route(
            "/offline-media/:token/compat/:id/prepare",
            post(move |path: Path<(String, String)>| compat_prepare(prepare.clone(), path))
                .options(preflight),
        )
        .route(
            "/offline-media/:token/compat/:id/cancel",
            post(move |path: Path<(String, String)>, headers: HeaderMap| {
                compat_cancel(cancel.clone(), path, headers)
            })
            .options(preflight),
        )
        .route(
            "/offline-media/:token/compat/:id/:lease/:name",
            get(move |path: Path<(String, String, String, String)>| {
                compat_playlist(playlist.clone(), path)
            })
            .options(preflight),
        )
        .route(
            "/offline-media/:token/compat/:id/:lease/:track/:segment",
            get(
                move |path: Path<(String, String, String, String, String)>,
                      headers: HeaderMap,
                      method: Method| {
                    compat_segment(segment.clone(), path, headers, method)
                },
            )
            .options(preflight),
        )
}
static DELIVERIES: std::sync::LazyLock<Arc<Semaphore>> =
    std::sync::LazyLock::new(|| Arc::new(Semaphore::new(8)));
fn delivery_body(
    bytes: Bytes,
    permit: tokio::sync::OwnedSemaphorePermit,
    work: crate::background_work::WorkLease,
    live: Option<Arc<AtomicBool>>,
) -> Body {
    Body::from_stream(stream::unfold(
        (Some(bytes), permit, work, live),
        |(bytes, permit, work, live)| async move {
            if work.check().is_err() || live.as_ref().is_some_and(|v| !v.load(Ordering::Acquire)) {
                return None;
            }
            bytes.map(|bytes| (Ok::<_, std::io::Error>(bytes), (None, permit, work, live)))
        },
    ))
}
fn failure(error: Error) -> Response {
    let status = match error {
        Error::Unavailable | Error::Cancelled => StatusCode::SERVICE_UNAVAILABLE,
        Error::Unsupported => StatusCode::UNSUPPORTED_MEDIA_TYPE,
        Error::Busy => StatusCode::TOO_MANY_REQUESTS,
        Error::Source => StatusCode::NOT_FOUND,
    };
    let mut response = (
        status,
        Json(serde_json::json!({"code":error.code(),"message":error.message()})),
    )
        .into_response();
    cors(&mut response);
    response
}
async fn input(
    l: Library,
    id: String,
    work: &crate::background_work::WorkLease,
) -> Result<(Input, Option<Arc<AtomicBool>>), Error> {
    if !valid_id(&id) {
        return Err(Error::Source);
    }
    owned_read(work, move |owner| async move {
        let (record, _file, metadata, live) = l.open_record(&id, Some(&owner)).await?;
        if !matches!(record.extension.as_str(), "avi" | "mkv") {
            return Err((
                StatusCode::UNSUPPORTED_MEDIA_TYPE,
                "Unsupported compatibility source",
            ));
        }
        let modified = metadata
            .modified()
            .ok()
            .and_then(|v| v.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|v| v.as_nanos())
            .unwrap_or(0);
        #[cfg(unix)]
        let identity = {
            use std::os::unix::fs::MetadataExt;
            format!("{}:{}", metadata.dev(), metadata.ino())
        };
        #[cfg(not(unix))]
        let identity = String::new();
        Ok((
            Input {
                source_id: record.source_id.clone().unwrap_or_else(|| id.clone()),
                id,
                fingerprint: format!("{}:{modified}:{identity}", metadata.len()),
                extension: record.extension,
                size: metadata.len(),
            },
            live,
        ))
    })
    .await
    .map_err(|e| {
        if e.0 == StatusCode::SERVICE_UNAVAILABLE {
            Error::Cancelled
        } else {
            Error::Source
        }
    })
}
fn manager(l: &Library) -> Result<Manager, Error> {
    l.compatibility.clone().ok_or(Error::Unavailable)
}
pub(super) async fn compat_prepare(
    l: Library,
    Path((token, id)): Path<(String, String)>,
) -> Response {
    if let Err(e) = l.authorize(&token) {
        return e.into_response();
    }
    let admission = match DELIVERIES.clone().try_acquire_owned() {
        Ok(p) => p,
        Err(_) => return failure(Error::Busy),
    };
    let m = match manager(&l) {
        Ok(m) => m,
        Err(e) => return failure(e),
    };
    let Ok(work) = l.background.enter() else {
        return failure(Error::Cancelled);
    };
    let base = l.endpoint();
    let result = async {
        let (value, live) = input(l, id.clone(), &work).await?;
        let prepared = m.prepare(value, &base, &work).await?;
        if live.as_ref().is_some_and(|v| !v.load(Ordering::Acquire)) {
            m.cancel_item(&id);
            return Err(Error::Cancelled);
        }
        Ok((prepared, live))
    }
    .await;
    let mut response = match result {
        Ok((v, None)) => Json(v).into_response(),
        Ok((v, live)) => {
            let bytes = match serde_json::to_vec(&v) {
                Ok(v) => Bytes::from(v),
                Err(_) => return failure(Error::Source),
            };
            (
                [("content-type", "application/json")],
                delivery_body(bytes, admission, work.clone(), live),
            )
                .into_response()
        }
        Err(e) => return failure(e),
    };
    cors(&mut response);
    response
}
pub(super) async fn compat_cancel(
    l: Library,
    Path((token, id)): Path<(String, String)>,
    headers: HeaderMap,
) -> Response {
    if let Err(e) = l.authorize(&token) {
        return e.into_response();
    }
    let lease = headers
        .get("X-OTT-Playback-Lease")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let mut response = if !valid_id(&id) || !valid_id(lease) {
        StatusCode::BAD_REQUEST.into_response()
    } else {
        if let Some(m) = &l.compatibility {
            m.cancel(&id, lease);
        }
        StatusCode::NO_CONTENT.into_response()
    };
    cors(&mut response);
    response
}
pub(super) async fn compat_playlist(
    l: Library,
    Path((token, id, lease, name)): Path<(String, String, String, String)>,
) -> Response {
    if let Err(e) = l.authorize(&token) {
        return e.into_response();
    }
    let delivery = match DELIVERIES.clone().try_acquire_owned() {
        Ok(p) => p,
        Err(_) => return failure(Error::Busy),
    };
    if !valid_id(&lease) {
        return failure(Error::Cancelled);
    }
    let m = match manager(&l) {
        Ok(m) => m,
        Err(e) => return failure(e),
    };
    let Ok(work) = l.background.enter() else {
        return failure(Error::Cancelled);
    };
    let base = format!("{}/compat/{id}/{lease}", l.endpoint());
    let result = async {
        let (value, live) = input(l, id, &work).await?;
        Ok((m.playlist(&value, &lease, &name, &base, &work)?, live))
    }
    .await;
    let mut response = match result {
        Ok((v, live)) => (
            [("content-type", "application/vnd.apple.mpegurl")],
            delivery_body(Bytes::from(v), delivery, work.clone(), live),
        )
            .into_response(),
        Err(e) => return failure(e),
    };
    cors(&mut response);
    response
}
pub(super) async fn compat_segment(
    l: Library,
    Path((token, id, lease, track, segment)): Path<(String, String, String, String, String)>,
    headers: HeaderMap,
    method: Method,
) -> Response {
    if let Err(e) = l.authorize(&token) {
        return e.into_response();
    }
    let delivery = match DELIVERIES.clone().try_acquire_owned() {
        Ok(p) => p,
        Err(_) => return failure(Error::Busy),
    };
    let Some(index) = segment
        .strip_suffix(".ts")
        .and_then(|v| v.parse::<usize>().ok())
        .filter(|n| segment == format!("{n}.ts"))
    else {
        return failure(Error::Unsupported);
    };
    if !valid_id(&lease) {
        return failure(Error::Cancelled);
    }
    let m = match manager(&l) {
        Ok(m) => m,
        Err(e) => return failure(e),
    };
    let Ok(work) = l.background.enter() else {
        return failure(Error::Cancelled);
    };
    let result = async {
        let (value, live) = input(l, id, &work).await?;
        Ok((m.segment(value, &lease, &track, index, &work).await?, live))
    }
    .await;
    let (data, live) = match result {
        Ok(v) => v,
        Err(e) => return failure(e),
    };
    let size = data.len() as u64;
    let range = match byte_range(headers.get("range").and_then(|v| v.to_str().ok()), size) {
        Ok(v) => v,
        Err(e) => return e.into_response(),
    };
    let (start, end) = range.unwrap_or((0, size - 1));
    let length = end - start + 1;
    let mut response = if method == Method::HEAD {
        Body::empty()
    } else {
        let bytes = Bytes::from(data[start as usize..=end as usize].to_vec());
        delivery_body(bytes, delivery, work.clone(), live)
    }
    .into_response();
    *response.status_mut() = if range.is_some() {
        StatusCode::PARTIAL_CONTENT
    } else {
        StatusCode::OK
    };
    response
        .headers_mut()
        .insert("content-type", HeaderValue::from_static("video/mp2t"));
    response
        .headers_mut()
        .insert("content-length", length.into());
    response
        .headers_mut()
        .insert("accept-ranges", HeaderValue::from_static("bytes"));
    if range.is_some() {
        response.headers_mut().insert(
            "content-range",
            format!("bytes {start}-{end}/{size}").parse().unwrap(),
        );
    }
    cors(&mut response);
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn buffered_compatibility_body_is_revoked_with_the_dropped_file() {
        let background = crate::background_work::BackgroundWork::default();
        let permits = Arc::new(Semaphore::new(1));
        for bytes in [
            b"#EXTM3U".as_slice(),
            b"segment bytes".as_slice(),
            b"{\"url\":\"opaque\"}".as_slice(),
        ] {
            let live = Arc::new(AtomicBool::new(true));
            let body = delivery_body(
                Bytes::copy_from_slice(bytes),
                permits.clone().acquire_owned().await.unwrap(),
                background.enter().unwrap(),
                Some(live.clone()),
            );
            live.store(false, Ordering::Release);
            assert!(axum::body::to_bytes(body, 64).await.unwrap().is_empty());
            let body = delivery_body(
                Bytes::copy_from_slice(bytes),
                permits.clone().acquire_owned().await.unwrap(),
                background.enter().unwrap(),
                None,
            );
            assert_eq!(
                axum::body::to_bytes(body, 64).await.unwrap().as_ref(),
                bytes
            );
        }
    }
    async fn media_tool(program: PathBuf, args: &[&str], bytes: &[u8]) -> std::process::Output {
        let mut child = tokio::process::Command::new(program)
            .args(args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .unwrap();
        let mut stdin = child.stdin.take().unwrap();
        let data = bytes.to_vec();
        let writer = tokio::spawn(async move { stdin.write_all(&data).await });
        let output =
            tokio::time::timeout(std::time::Duration::from_secs(10), child.wait_with_output())
                .await
                .unwrap()
                .unwrap();
        let written = writer.await.unwrap();
        assert!(
            output.status.success(),
            "synthetic tool failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        written.unwrap();
        output
    }
    async fn assert_segment_decode_and_time(
        bytes: &[u8],
        kind: &str,
        expected_codec: &str,
        start: f64,
    ) {
        let ffprobe = std::env::var_os("OTT_LOCAL_FFPROBE")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("/opt/homebrew/bin/ffprobe"));
        let probe = media_tool(
            ffprobe,
            &[
                "-v",
                "error",
                "-count_frames",
                "-show_entries",
                "stream=codec_type,codec_name,start_time,nb_read_frames",
                "-of",
                "json",
                "pipe:0",
            ],
            bytes,
        )
        .await;
        let metadata: serde_json::Value = serde_json::from_slice(&probe.stdout).unwrap();
        let streams = metadata["streams"].as_array().unwrap();
        let stream = streams
            .iter()
            .find(|stream| stream["codec_type"] == kind)
            .expect("expected decoded elementary stream");
        assert_eq!(stream["codec_name"], expected_codec);
        let frames = stream["nb_read_frames"]
            .as_str()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);
        assert!(frames > 0, "segment must decode actual {kind} frames");
        let actual = stream["start_time"]
            .as_str()
            .unwrap()
            .parse::<f64>()
            .unwrap();
        // 100ms is less than two frames at12fps and allows audio codec delay.
        assert!(
            actual.is_finite() && (actual - start).abs() <= 0.100,
            "{kind} segment starts at {actual}, advertised {start}"
        );
        let ffmpeg = std::env::var_os("OTT_LOCAL_FFMPEG")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("/opt/homebrew/bin/ffmpeg"));
        media_tool(
            ffmpeg,
            &["-nostdin", "-v", "error", "-i", "pipe:0", "-f", "null", "-"],
            bytes,
        )
        .await;
    }
    #[tokio::test]
    async fn readonly_routes_keep_auth_lease_cors_and_no_mutation() {
        let root =
            std::env::temp_dir().join(format!("local-compat-routes-{}", uuid::Uuid::new_v4()));
        let token = "t".repeat(32);
        let id = "a".repeat(32);
        let mut library = Library::new(root.clone(), token.clone(), "server")
            .await
            .unwrap();
        library.read_only_paths = Some(Arc::new(vec![root.join("unused")]));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let origin = format!("http://{}", listener.local_addr().unwrap());
        let server =
            tokio::spawn(async move { axum::serve(listener, library.routes()).await.unwrap() });
        let client = reqwest::Client::new();
        let base = format!("{origin}/offline-media/{token}");
        let preflight = client
            .request(
                reqwest::Method::OPTIONS,
                format!("{base}/compat/{id}/cancel"),
            )
            .send()
            .await
            .unwrap();
        assert_eq!(preflight.status(), StatusCode::NO_CONTENT);
        assert!(preflight.headers()["access-control-allow-headers"]
            .to_str()
            .unwrap()
            .contains("X-OTT-Playback-Lease"));
        assert!(preflight.headers()["access-control-allow-methods"]
            .to_str()
            .unwrap()
            .contains("POST"));
        let response = client
            .post(format!("{base}/compat/{id}/prepare"))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(
            response.json::<serde_json::Value>().await.unwrap()["code"],
            "compatibility_unavailable"
        );
        let wrong = client
            .post(format!(
                "{origin}/offline-media/{}/compat/{id}/prepare",
                "x".repeat(32)
            ))
            .send()
            .await
            .unwrap();
        assert_eq!(wrong.status(), StatusCode::NOT_FOUND);
        assert_eq!(
            client
                .post(format!("{base}/compat/{id}/cancel"))
                .header("X-OTT-Playback-Lease", "b".repeat(32))
                .send()
                .await
                .unwrap()
                .status(),
            StatusCode::NO_CONTENT
        );
        assert_eq!(
            client
                .post(format!("{base}/compat/{id}/cancel"))
                .send()
                .await
                .unwrap()
                .status(),
            StatusCode::BAD_REQUEST
        );
        let import = client
            .post(format!("{base}/import?name=movie.avi"))
            .send()
            .await
            .unwrap();
        assert!(!import.status().is_success());
        assert!(!client
            .delete(format!("{base}/{id}"))
            .send()
            .await
            .unwrap()
            .status()
            .is_success());
        server.abort();
        let _ = server.await;
        fs::remove_dir_all(root).await.unwrap();
    }
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    #[ignore = "requires explicitly provided synthetic AVI/MKV and installed FFmpeg tools"]
    async fn real_ffmpeg_http_finite_seek_decode_and_independent_leases() {
        let fixtures = PathBuf::from(
            std::env::var_os("OTT_LOCAL_COMPAT_FIXTURES")
                .expect("explicit synthetic fixture directory"),
        );
        let before: Vec<_> = ["xvid-ac3.avi", "h264-aac.mkv"]
            .into_iter()
            .map(|name| {
                let p = fixtures.join(name);
                let bytes = std::fs::read(&p).unwrap();
                assert!(bytes.len() < 2 * 1024 * 1024);
                (p, Sha256::digest(bytes).to_vec())
            })
            .collect();
        // Remux coverage requires zero-origin video/cues, not merely a container
        // shifted forward to hide the AAC encoder's negative priming packet.
        let ffprobe = std::env::var_os("OTT_LOCAL_FFPROBE")
            .map(PathBuf::from)
            .expect("explicit synthetic ffprobe");
        let mkv = fixtures.join("h264-aac.mkv");
        let metadata = media_tool(
            ffprobe,
            &[
                "-v",
                "error",
                "-show_entries",
                "format=start_time:stream=codec_type,start_time",
                "-of",
                "json",
                mkv.to_str().unwrap(),
            ],
            &[],
        )
        .await;
        let metadata: serde_json::Value = serde_json::from_slice(&metadata.stdout).unwrap();
        let video = metadata["streams"]
            .as_array()
            .unwrap()
            .iter()
            .find(|stream| stream["codec_type"] == "video")
            .unwrap();
        for start in [&metadata["format"]["start_time"], &video["start_time"]] {
            let start = start.as_str().unwrap().parse::<f64>().unwrap();
            assert!(
                start.is_finite() && start.abs() < 0.001,
                "synthetic remux fixture must have zero container/video origin: {metadata}"
            );
        }
        let root =
            std::env::temp_dir().join(format!("local-compat-smoke-{}", uuid::Uuid::new_v4()));
        let token = "s".repeat(32);
        let library = Library::new_read_only(root.clone(), token.clone(), vec![fixtures.clone()])
            .await
            .unwrap()
            .with_compatibility_from_env()
            .await;
        assert!(
            library.compatibility.is_some(),
            "explicit installed tools required"
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let origin = format!("http://{}", listener.local_addr().unwrap());
        let app = library.clone();
        let server =
            tokio::spawn(async move { axum::serve(listener, app.routes()).await.unwrap() });
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(40))
            .build()
            .unwrap();
        let mut catalogue = None;
        for _ in 0..100 {
            let c = library.catalog().await.unwrap();
            if c.items.len() == 2 && !c.scanning {
                catalogue = Some(c);
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
        for item in catalogue.expect("synthetic source must finish scan").items {
            let prepare = format!("{origin}/offline-media/{token}/compat/{}/prepare", item.id);
            let a = client
                .post(&prepare)
                .send()
                .await
                .unwrap()
                .error_for_status()
                .unwrap()
                .json::<serde_json::Value>()
                .await
                .unwrap();
            let b = client
                .post(&prepare)
                .send()
                .await
                .unwrap()
                .error_for_status()
                .unwrap()
                .json::<serde_json::Value>()
                .await
                .unwrap();
            assert_ne!(a["lease"], b["lease"]);
            let expected_mode = if item.mime == "video/x-matroska" {
                "remux"
            } else {
                "transcode"
            };
            if a["mode"] != expected_mode || b["mode"] != expected_mode {
                let ffprobe = std::env::var_os("OTT_LOCAL_FFPROBE")
                    .map(PathBuf::from)
                    .unwrap_or_else(|| PathBuf::from("/opt/homebrew/bin/ffprobe"));
                let path = fixtures.join(&item.name);
                let diagnostic=media_tool(ffprobe,&["-v","error","-show_entries","format=start_time,duration:stream=codec_type,codec_name,pix_fmt,start_time","-of","json",path.to_str().unwrap()],&[]).await;
                eprintln!(
                    "Unexpected synthetic compatibility mode; input codec/origin metadata: {}",
                    String::from_utf8_lossy(&diagnostic.stdout)
                );
            }
            assert_eq!(
                a["mode"], expected_mode,
                "synthetic indexed H264/AAC MKV must exercise real remux"
            );
            assert_eq!(b["mode"], expected_mode);

            assert_eq!(b["finite"], true);
            assert_eq!(b["timeOrigin"], 0);
            let duration = b["duration"].as_f64().unwrap();
            assert!((11.5..13.0).contains(&duration));
            let master_url = format!("{origin}{}", b["url"].as_str().unwrap());
            let master = client
                .get(&master_url)
                .send()
                .await
                .unwrap()
                .error_for_status()
                .unwrap()
                .text()
                .await
                .unwrap();
            assert!(master.contains("#EXT-X-STREAM-INF") && !master.contains("#EXT-X-ENDLIST"));
            for (track, kind, codec) in [("video", "video", "h264"), ("audio0", "audio", "aac")] {
                let child_url =
                    master_url.trim_end_matches("index.m3u8").to_string() + track + ".m3u8";
                let child = client
                    .get(&child_url)
                    .send()
                    .await
                    .unwrap()
                    .error_for_status()
                    .unwrap()
                    .text()
                    .await
                    .unwrap();
                assert!(
                    child.contains("#EXT-X-PLAYLIST-TYPE:VOD")
                        && child.ends_with("#EXT-X-ENDLIST\n")
                );
                let mut elapsed = 0.0;
                let mut pending = None;
                let mut segments = Vec::new();
                for line in child.lines() {
                    if let Some(value) = line.strip_prefix("#EXTINF:") {
                        pending = Some(value.trim_end_matches(',').parse::<f64>().unwrap());
                    } else if !line.starts_with('#') && !line.is_empty() {
                        let length = pending.take().expect("every segment has EXTINF");
                        assert!(length > 0.0);
                        segments.push((line, elapsed, length));
                        elapsed += length;
                    }
                }
                assert!(
                    (elapsed - duration).abs() < 0.00001,
                    "finite duration must include the complete original tail"
                );
                assert!(!segments.is_empty());
                for (segment, start, length) in [segments[0], *segments.last().unwrap()] {
                    assert!(start + length <= duration + 0.00001);
                    let bytes = client
                        .get(format!("{origin}{segment}"))
                        .send()
                        .await
                        .unwrap()
                        .error_for_status()
                        .unwrap()
                        .bytes()
                        .await
                        .unwrap();
                    assert_segment_decode_and_time(&bytes, kind, codec, start).await;
                }
            }
            client
                .post(format!("{origin}{}", a["cancelUrl"].as_str().unwrap()))
                .header("X-OTT-Playback-Lease", a["lease"].as_str().unwrap())
                .send()
                .await
                .unwrap()
                .error_for_status()
                .unwrap();
            assert!(!client
                .get(format!("{origin}{}", a["url"].as_str().unwrap()))
                .send()
                .await
                .unwrap()
                .status()
                .is_success());
            assert!(client
                .get(&master_url)
                .send()
                .await
                .unwrap()
                .status()
                .is_success());
            client
                .post(format!("{origin}{}", b["cancelUrl"].as_str().unwrap()))
                .header("X-OTT-Playback-Lease", b["lease"].as_str().unwrap())
                .send()
                .await
                .unwrap()
                .error_for_status()
                .unwrap();
        }
        server.abort();
        let _ = server.await;
        drop(library);
        for (path, hash) in before {
            assert_eq!(Sha256::digest(std::fs::read(path).unwrap()).to_vec(), hash);
        }
        fs::remove_dir_all(root).await.unwrap();
    }
}
