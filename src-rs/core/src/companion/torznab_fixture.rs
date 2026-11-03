//! Explicitly opt-in local player fixture. No external peers, trackers, or media.
use super::*;
use librqbit::{
    AddTorrent, AddTorrentOptions, CreateTorrentOptions, ListenerOptions, Session, SessionOptions,
};
use std::{path::Path, time::Duration};

const KEY: &str = "local-fixture-only";
#[derive(Clone)]
struct FixtureData {
    metainfo: Vec<u8>,
    hash: [u8; 20],
    peer: [u8; 6],
    base: String,
    size: u64,
}
struct Fixture {
    base: String,
    server: tokio::task::JoinHandle<()>,
    seed: Arc<Session>,
    metainfo: Vec<u8>,
}
async fn route(State(data): State<FixtureData>, uri: axum::http::Uri) -> Response {
    let raw = uri.query().unwrap_or("");
    if uri.path() == "/announce" {
        let hash = raw
            .split('&')
            .find_map(|p| p.strip_prefix("info_hash="))
            .map(|v| urlencoding::decode_binary(v.as_bytes()));
        if !hash.is_some_and(|h| h.as_ref() == data.hash) {
            return StatusCode::BAD_REQUEST.into_response();
        }
        let mut body = b"d8:completei1e10:incompletei0e8:intervali30e5:peers6:".to_vec();
        body.extend_from_slice(&data.peer);
        body.push(b'e');
        return body.into_response();
    }
    let pairs: std::collections::HashMap<_, _> =
        reqwest::Url::parse(&format!("{}{}", data.base, uri))
            .unwrap()
            .query_pairs()
            .into_owned()
            .collect();
    if pairs.get("apikey").map(String::as_str) != Some(KEY) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    if matches!(
        uri.path(),
        "/download" | "/fixture/api/v2.0/indexers/OpenMovie/results/torznab/download"
    ) {
        return data.metainfo.into_response();
    }
    if uri.path() == "/fixture/api/v2.0/indexers/all/results/torznab/api" {
        return if pairs.get("t").map(String::as_str) == Some("indexers")
            && pairs.get("configured").map(String::as_str) == Some("true")
        {
            "<indexers><indexer id='OpenMovie' configured='true'><title>Local video fixture</title><language>en</language><type>public</type></indexer></indexers>".into_response()
        } else {
            StatusCode::BAD_REQUEST.into_response()
        };
    }
    let child = uri.path() == "/fixture/api/v2.0/indexers/OpenMovie/results/torznab/api";
    if uri.path() != "/api" && !child {
        return StatusCode::NOT_FOUND.into_response();
    }
    match pairs.get("t").map(String::as_str) {
        Some("caps") => "<caps><limits max='100'/><searching><search available='yes' supportedParams='q'/></searching><categories><category id='2000' name='Local test video'/></categories></caps>".into_response(),
        Some("search") => {
            let offset = pairs.get("offset").map(String::as_str).unwrap_or("0");
            let link = if child { format!("download?apikey={KEY}") } else { format!("{}/download?apikey={KEY}", data.base) };
            let item = if offset == "0" { format!("<item><title>Local video fixture</title><enclosure type='application/x-bittorrent' url='{link}' length='{}'/><torznab:attr name='seeders' value='1'/><torznab:attr name='category' value='2000'/></item>", data.size) } else { String::new() };
            format!("<rss xmlns:torznab='urn:torznab'><channel><torznab:response offset='{offset}' total='1'/>{item}</channel></rss>").into_response()
        }
        _ => StatusCode::BAD_REQUEST.into_response(),
    }
}
impl Fixture {
    async fn start(video: &Path) -> Self {
        assert!(video.is_absolute(), "fixture video path must be absolute");
        let metadata = std::fs::symlink_metadata(video).expect("fixture video must exist");
        assert!(
            metadata.is_file()
                && !metadata.file_type().is_symlink()
                && metadata.len() > 0
                && metadata.len() <= 16 * 1024 * 1024,
            "fixture video must be a regular file of 1..16 MiB"
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let mut created = librqbit::create_torrent(
            video,
            CreateTorrentOptions {
                trackers: vec![format!("{base}/announce")],
                piece_length: Some(16384),
                ..Default::default()
            },
            &librqbit::spawn_utils::BlockingSpawner::new(2),
        )
        .await
        .unwrap();
        created.meta.info.data.private = true;
        let metainfo = created.as_bytes().unwrap().to_vec();
        let parsed = librqbit::torrent_from_bytes(&metainfo).unwrap();
        assert!(parsed.info.data.private);
        let hash = parsed.info_hash.0;
        let seed = Session::new_with_opts(
            video.parent().unwrap().to_owned(),
            SessionOptions {
                dht: None,
                disable_trackers: true,
                disable_local_service_discovery: true,
                peer_limit: Some(8),
                listen: Some(ListenerOptions {
                    listen_addr: "127.0.0.1:0".parse().unwrap(),
                    ..Default::default()
                }),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        let handle = seed
            .add_torrent(
                AddTorrent::from_bytes(metainfo.clone()),
                Some(AddTorrentOptions {
                    overwrite: true,
                    output_folder: Some(video.parent().unwrap().to_str().unwrap().into()),
                    ..Default::default()
                }),
            )
            .await
            .unwrap()
            .into_handle()
            .unwrap();
        tokio::time::timeout(Duration::from_secs(20), handle.wait_until_completed())
            .await
            .unwrap()
            .unwrap();
        let port = seed.listen_addr().unwrap().port().to_be_bytes();
        let data = FixtureData {
            metainfo: metainfo.clone(),
            hash,
            peer: [127, 0, 0, 1, port[0], port[1]],
            base: base.clone(),
            size: metadata.len(),
        };
        let server = tokio::spawn(async move {
            axum::serve(listener, Router::new().fallback(route).with_state(data))
                .await
                .unwrap();
        });
        Self {
            base,
            server,
            seed,
            metainfo,
        }
    }
    async fn stop(self) {
        self.server.abort();
        self.seed.stop().await;
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "requires an explicitly supplied synthetic video; serves loopback only for a bounded duration"]
async fn serve_local_video_fixture() {
    let video = std::env::var_os("OTT_TORZNAB_FIXTURE_VIDEO")
        .expect("set OTT_TORZNAB_FIXTURE_VIDEO to a synthetic local MP4");
    let seconds = std::env::var("OTT_TORZNAB_FIXTURE_SECONDS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(600)
        .clamp(1, 1800);
    let fixture = Fixture::start(Path::new(&video)).await;
    println!(
        "TORZNAB_FIXTURE endpoint={}/api apiKey={KEY} lifetimeSeconds={seconds}",
        fixture.base
    );
    tokio::time::sleep(Duration::from_secs(seconds)).await;
    fixture.stop().await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn fixture_advertises_only_its_private_local_seed() {
    let root = std::env::temp_dir().join(format!("ott-fixture-{}", uuid::Uuid::new_v4().simple()));
    std::fs::create_dir(&root).unwrap();
    let path = root.join("synthetic.mp4");
    std::fs::write(&path, b"synthetic protocol fixture").unwrap();
    let fixture = Fixture::start(&path).await;
    let parsed = librqbit::torrent_from_bytes(&fixture.metainfo).unwrap();
    assert!(parsed.info.data.private);
    assert_eq!(parsed.iter_announce().count(), 1);
    let client = reqwest::Client::new();
    let bytes = client
        .get(format!(
            "{}/announce?info_hash={}",
            fixture.base,
            urlencoding::encode_binary(&parsed.info_hash.0)
        ))
        .send()
        .await
        .unwrap()
        .bytes()
        .await
        .unwrap();
    assert!(bytes.windows(4).any(|w| w == [127, 0, 0, 1]));
    let response = client
        .get(format!("{}/download?apikey={KEY}", fixture.base))
        .send()
        .await
        .unwrap()
        .bytes()
        .await
        .unwrap();
    assert_eq!(response.as_ref(), fixture.metainfo);
    assert_eq!(
        client
            .get(format!("{}/download", fixture.base))
            .send()
            .await
            .unwrap()
            .status(),
        StatusCode::UNAUTHORIZED
    );
    // Exercise actual tracker discovery; no test-only initial peer injection.
    let output = root.join("download");
    let downloader = Session::new_with_opts(
        output.clone(),
        SessionOptions {
            dht: None,
            disable_trackers: false,
            disable_local_service_discovery: true,
            listen: None,
            ..Default::default()
        },
    )
    .await
    .unwrap();
    let downloaded = downloader
        .add_torrent(
            AddTorrent::from_bytes(fixture.metainfo.clone()),
            Some(AddTorrentOptions {
                overwrite: true,
                output_folder: Some(output.to_str().unwrap().into()),
                ..Default::default()
            }),
        )
        .await
        .unwrap()
        .into_handle()
        .unwrap();
    tokio::time::timeout(Duration::from_secs(10), downloaded.wait_until_completed())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        std::fs::read(output.join("synthetic.mp4")).unwrap(),
        b"synthetic protocol fixture"
    );
    downloader.stop().await;
    fixture.stop().await;
    std::fs::remove_dir_all(root).unwrap();
}

async fn child_media_acceptance(video: &Path) {
    let bytes = std::fs::read(video).unwrap();
    assert!(
        bytes.len() >= 131072,
        "range fixture must contain at least 128 KiB"
    );
    let fixture = Fixture::start(video).await;
    let root =
        std::env::temp_dir().join(format!("ott-child-media-{}", uuid::Uuid::new_v4().simple()));
    let companion = Companion::with_limits(
        root.clone(),
        "v".repeat(48),
        None,
        ResourceLimits {
            cache_bytes: 64 * 1024 * 1024,
            max_sessions: 1,
            max_streams: 2,
        },
    )
    .await
    .unwrap();
    *super::torrent::lock(&companion.0.torrent.test_tracker) =
        Some(format!("{}/announce", fixture.base));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!(
        "http://{}{}",
        listener.local_addr().unwrap(),
        companion.endpoint()
    );
    let router = companion.routes();
    let server = tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    let http = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(60))
        .build()
        .unwrap();
    let configured = http.post(format!("{base}/torrent/sources")).json(&json!({
        "id":"movie", "label":"Local video fixture", "endpoint":format!("{}/fixture/api/v2.0/indexers/all/results/torznab/api", fixture.base), "apiKey":KEY,
    })).send().await.unwrap();
    assert_eq!(configured.status(), StatusCode::OK);
    let children: Value = http
        .get(format!("{base}/torrent/sources/movie/indexers"))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(children["indexers"][0]["id"], "OpenMovie");
    let page: Value = http.post(format!("{base}/torrent/search")).json(&json!({
        "sourceId":"movie", "indexerId":"OpenMovie", "query":"local fixture", "categoryIds":[2000], "offset":0, "limit":1,
    })).send().await.unwrap().error_for_status().unwrap().json().await.unwrap();
    assert_eq!(page["indexerId"], "OpenMovie");
    let prepared: Value = http
        .post(format!("{base}/torrent/prepare"))
        .json(&json!({
            "sourceId":"movie", "resultRef":page["items"][0]["resultRef"],
        }))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json()
        .await
        .unwrap();
    let started: Value = http
        .post(format!("{base}/sessions"))
        .json(&json!({
            "sourceId":"movie", "sourceRef":prepared["sourceRef"], "fileIndex":0,
        }))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json()
        .await
        .unwrap();
    let id = started["id"].as_str().unwrap();
    tokio::time::timeout(Duration::from_secs(60), async {
        loop {
            let state: Value = http
                .get(format!("{base}/sessions/{id}"))
                .send()
                .await
                .unwrap()
                .json()
                .await
                .unwrap();
            assert_ne!(state["state"], "error", "{state}");
            if state["state"] == "ready" {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .unwrap();
    let began = std::time::Instant::now();
    let ranges = [
        (0, 65535),
        (bytes.len() / 2, bytes.len() / 2 + 32767),
        (4096, 36863),
    ];
    let mut first_bytes_ms = 0;
    for (index, (start, end)) in ranges.into_iter().enumerate() {
        let response = http
            .get(format!("{base}/sessions/{id}/stream"))
            .header(header::RANGE, format!("bytes={start}-{end}"))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(
            response.headers().get(header::CONTENT_RANGE).unwrap(),
            format!("bytes {start}-{end}/{}", bytes.len()).as_str()
        );
        let body = response.bytes().await.unwrap();
        assert_eq!(body.as_ref(), &bytes[start..=end]);
        if index == 0 {
            first_bytes_ms = began.elapsed().as_millis();
        }
    }
    // Stop while a response is still held open, then verify the lease and piece
    // storage have gone. The stable metadata reference is intentionally retained.
    let mut active = http
        .get(format!("{base}/sessions/{id}/stream"))
        .send()
        .await
        .unwrap();
    assert!(active.chunk().await.unwrap().is_some());
    let stopping = std::time::Instant::now();
    let stopped = http
        .delete(format!("{base}/sessions/{id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(stopped.status(), StatusCode::NO_CONTENT);
    drop(active);
    let stop_ms = stopping.elapsed().as_millis();
    assert_eq!(
        http.get(format!("{base}/sessions/{id}/stream"))
            .send()
            .await
            .unwrap()
            .status(),
        StatusCode::NOT_FOUND
    );
    assert!(companion.0.torrent.get(id).is_none());
    let leases = std::fs::read_dir(root.join("torrent-cache"))
        .unwrap()
        .filter(|entry| {
            entry
                .as_ref()
                .unwrap()
                .file_name()
                .to_string_lossy()
                .starts_with("lease-")
        })
        .count();
    assert_eq!(leases, 0);
    companion.shutdown().await;
    drop(companion);
    server.abort();
    let _ = server.await;
    fixture.stop().await;
    std::fs::remove_dir_all(root).unwrap();
    println!(
        "TORZNAB_CHILD_ACCEPTANCE {}",
        json!({"bytes":bytes.len(),"readyToFirstRangeMs":first_bytes_ms,"rangesVerified":3,"stopMs":stop_ms,"remainingLeases":leases})
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn selected_child_streams_real_protocol_bytes_and_cleans_up() {
    let root =
        std::env::temp_dir().join(format!("ott-child-bytes-{}", uuid::Uuid::new_v4().simple()));
    std::fs::create_dir_all(&root).unwrap();
    let video = root.join("protocol-fixture.mp4");
    let bytes: Vec<u8> = (0..262144).map(|n| ((n * 31 + 7) % 251) as u8).collect();
    std::fs::write(&video, bytes).unwrap();
    child_media_acceptance(&video).await;
    std::fs::remove_dir_all(root).unwrap();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "requires an explicitly supplied, licensed local movie up to 16 MiB; no external discovery"]
async fn selected_child_movie_first_bytes_seek_and_stop() {
    let video = std::env::var_os("OTT_TORZNAB_FIXTURE_VIDEO").expect("supply a licensed local MP4");
    child_media_acceptance(Path::new(&video)).await;
}
