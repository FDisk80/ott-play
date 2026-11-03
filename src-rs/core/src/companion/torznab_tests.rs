use super::torznab::{Configure, Prepare, Search, Torznab};
use super::torznab_store::{Config, Payload, Store};
use super::*;
use std::time::Duration;

const CAPS: &str = r#"<?xml version="1.0"?><caps><limits max="500"/><searching><search available="yes" supportedParams="q"/></searching><categories><category id="2000" name="Movies &amp; more"><subcat id="2040" name="HD"/></category></categories></caps>"#;
const META: &[u8] = b"d8:announce0:4:infod6:lengthi1e4:name5:a.mp412:piece lengthi1e6:pieces20:000000000000000000007:privatei1eee";
const MAGNET: &str = "magnet:?xt=urn:btih:1111111111111111111111111111111111111111&tr=https%3A%2F%2Ftracker.example%2Fprivate-key";
struct Temp(std::path::PathBuf);
impl Temp {
    fn new() -> Self {
        Self(std::env::temp_dir().join(format!(
            "ott-torznab-test-{}",
            uuid::Uuid::new_v4().simple()
        )))
    }
}
impl Drop for Temp {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
fn config() -> Config {
    Config {
        id: "local".into(),
        label: "Local indexer".into(),
        endpoint: "http://127.0.0.1:9117/api".into(),
        api_key: "private-key".into(),
        generation: "a".repeat(32),
    }
}
fn search() -> Search {
    Search {
        source_id: "local".into(),
        indexer_id: None,
        query: "legal & public".into(),
        category_ids: vec![2000],
        offset: 0,
        limit: 2,
    }
}
#[test]
fn xml_caps_and_namespaced_results_keep_real_optional_metadata() {
    let caps = torznab_xml::caps(CAPS.as_bytes()).unwrap();
    assert!(caps.search_available);
    assert_eq!(caps.max_limit, 100);
    assert_eq!(caps.categories.len(), 2);
    assert_eq!(caps.categories[0].name, "Movies & more");
    assert_eq!(caps.categories[1].parent_id, Some(2000));
    let page = torznab_xml::page(br#"<rss xmlns:torznab="urn:torznab"><channel><torznab:response offset="4" total="20"/><item><title>Public &amp; open</title><enclosure url="http://127.0.0.1/file?key=secret" type="application/x-bittorrent" length="42"/><torznab:attr name="seeders" value="9"/><torznab:attr name="category" value="2040"/><torznab:attr name="language" value="en,fr"/><pubDate>Fri, 30 Oct 2026 12:00:00 +0000</pubDate></item><item><title>Unknown</title><link>/other</link><torznab:attr name="seeders" value="-1"/></item></channel></rss>"#, 100).unwrap();
    assert_eq!(page.offset, Some(4));
    assert_eq!(page.total, Some(20));
    assert_eq!(page.items[0].size, Some(42));
    assert_eq!(page.items[0].seeders, Some(9));
    assert_eq!(page.items[0].languages, vec!["en", "fr"]);
    assert_eq!(page.items[1].seeders, None);
    assert_eq!(page.items[1].published_at, None);
    let encoded = serde_json::to_string(&page.items).unwrap();
    assert!(!encoded.contains("secret") && !encoded.contains("127.0.0.1"));
}
#[test]
fn xml_rejects_partial_entities_and_overdeep_documents() {
    for xml in [
        "<caps>",
        "<caps/><caps/>",
        "<!DOCTYPE caps [<!ENTITY x SYSTEM 'file:///private'>]><caps/>",
        "<caps>&unknown;</caps>",
        "<rss><channel></rss>",
    ] {
        assert!(torznab_xml::caps(xml.as_bytes()).is_err(), "{xml}");
    }
    assert!(
        torznab_xml::caps(format!("{}{}", "<a>".repeat(17), "</a>".repeat(17)).as_bytes()).is_err()
    );
    assert!(torznab_xml::page(b"<error code='100' description='private' />", 100).is_err());
    let empty = torznab_xml::caps(b"<caps/>").unwrap();
    assert!(!empty.search_available && empty.categories.is_empty());
}
#[test]
fn stable_payloads_preserve_private_metainfo_and_deduplicate_across_restart() {
    let dir = Temp::new();
    let source = config();
    let mut store = Store::load(dir.0.clone()).unwrap();
    store.configure(source.clone()).unwrap();
    let id = store
        .prepare(&source, Payload::Torrent(META.to_vec()))
        .unwrap();
    assert_eq!(
        store
            .prepare(&source, Payload::Torrent(META.to_vec()))
            .unwrap(),
        id
    );
    assert!(Store::load(dir.0.clone()).is_err(), "single owner");
    drop(store);
    let mut store = Store::load(dir.0.clone()).unwrap();
    let Payload::Torrent(bytes) = store.payload("local", &id).unwrap() else {
        panic!()
    };
    assert_eq!(bytes, META);
    assert_eq!(
        store
            .prepare(&source, Payload::Torrent(META.to_vec()))
            .unwrap(),
        id
    );
    assert!(store.payload("different", &id).is_err());
    let magnet = store
        .prepare(&source, Payload::Magnet(MAGNET.into()))
        .unwrap();
    let Payload::Magnet(value) = store.payload("local", &magnet).unwrap() else {
        panic!()
    };
    assert_eq!(value, MAGNET);
    let mut changed = source.clone();
    changed.api_key = "rotated".into();
    changed.generation = "b".repeat(32);
    store.configure(changed).unwrap();
    assert!(store.payload("local", &id).is_err());
    assert!(store.payload("local", &magnet).is_err());
}
#[test]
fn private_store_does_not_replace_unowned_or_symlinked_data() {
    let dir = Temp::new();
    std::fs::create_dir_all(&dir.0).unwrap();
    std::fs::write(dir.0.join("unrelated"), b"retain").unwrap();
    assert!(Store::load(dir.0.clone()).is_err());
    assert_eq!(std::fs::read(dir.0.join("unrelated")).unwrap(), b"retain");
    #[cfg(unix)]
    {
        let other = Temp::new();
        std::os::unix::fs::symlink(&dir.0, &other.0).unwrap();
        assert!(Store::load(other.0.clone()).is_err());
    }
}
#[test]
fn private_store_recovers_first_initialization_after_owner_sync() {
    use std::io::Write;

    let dir = Temp::new();
    std::fs::create_dir_all(&dir.0).unwrap();
    let marker = b"ottplay-torznab-private-v1\n";
    // Reproduce the durable checkpoint before the first state save starts.
    let mut owner = std::fs::File::create(dir.0.join(".owner")).unwrap();
    owner.write_all(marker).unwrap();
    owner.sync_all().unwrap();
    drop(owner);
    assert!(!dir.0.join("state.json").exists());

    let mut store = Store::load(dir.0.clone()).expect("recover owner-only initialization");
    assert!(store.sources().is_empty());
    let initial: serde_json::Value =
        serde_json::from_slice(&std::fs::read(dir.0.join("state.json")).unwrap()).unwrap();
    assert_eq!(
        initial,
        json!({"schema": 1, "sources": [], "references": []})
    );
    assert_eq!(Store::load(dir.0.clone()).err(), Some("torznab_store_busy"));
    let source = config();
    store.configure(source.clone()).unwrap();
    let id = store
        .prepare(&source, Payload::Torrent(META.to_vec()))
        .unwrap();
    drop(store);

    let store = Store::load(dir.0.clone()).unwrap();
    assert_eq!(store.sources().len(), 1);
    let Payload::Torrent(bytes) = store.payload("local", &id).unwrap() else {
        panic!()
    };
    assert_eq!(bytes, META);
    drop(store);
    assert_eq!(std::fs::read(dir.0.join(".owner")).unwrap(), marker);
}
#[test]
fn private_store_missing_state_refuses_invalid_owner_and_orphan_files() {
    for marker in [
        b"".as_slice(),
        b"foreign owner",
        b"ottplay-torznab-private-v1",
    ] {
        let dir = Temp::new();
        std::fs::create_dir_all(&dir.0).unwrap();
        std::fs::write(dir.0.join(".owner"), marker).unwrap();
        assert_eq!(
            Store::load(dir.0.clone()).err(),
            Some("torznab_store_unavailable")
        );
        assert_eq!(std::fs::read(dir.0.join(".owner")).unwrap(), marker);
        assert!(!dir.0.join("state.json").exists());
    }
    for name in [
        "state.pending",
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bin",
        "unrelated",
    ] {
        let dir = Temp::new();
        std::fs::create_dir_all(&dir.0).unwrap();
        std::fs::write(dir.0.join(".owner"), b"ottplay-torznab-private-v1\n").unwrap();
        std::fs::write(dir.0.join(name), b"retain orphaned data").unwrap();
        assert_eq!(
            Store::load(dir.0.clone()).err(),
            Some("torznab_store_unavailable")
        );
        assert_eq!(
            std::fs::read(dir.0.join(name)).unwrap(),
            b"retain orphaned data"
        );
        assert!(!dir.0.join("state.json").exists());
    }
}
#[test]
fn private_store_does_not_reset_corrupt_state() {
    for state in [
        b"".as_slice(),
        b"{",
        br#"{"schema":2,"sources":[],"references":[]}"#,
    ] {
        let dir = Temp::new();
        std::fs::create_dir_all(&dir.0).unwrap();
        std::fs::write(dir.0.join(".owner"), b"ottplay-torznab-private-v1\n").unwrap();
        std::fs::write(dir.0.join("state.json"), state).unwrap();
        assert_eq!(
            Store::load(dir.0.clone()).err(),
            Some("torznab_store_unavailable")
        );
        assert_eq!(std::fs::read(dir.0.join("state.json")).unwrap(), state);
    }
}
#[test]
fn local_source_contract_does_not_broaden_public_metadata_fetch() {
    for endpoint in [
        "https://8.8.8.8/api",
        "file:///private",
        "http://user:pass@127.0.0.1/api",
        "http://127.0.0.1/api?apikey=secret",
        "http://169.254.169.254/api",
    ] {
        assert!(torznab::validate_config("local", "Local", endpoint, "key").is_err());
    }
    assert!(
        torznab::validate_config("local", "Local", "http://127.0.0.1:9696/1/api", "key").is_ok()
    );
    assert!(source::validate("http://127.0.0.1:9696/1/api").is_err());
}

async fn indexer() -> (
    String,
    tokio::task::JoinHandle<()>,
    std::sync::Arc<tokio::sync::Notify>,
) {
    async fn route(
        State(seen): State<std::sync::Arc<tokio::sync::Notify>>,
        uri: axum::http::Uri,
    ) -> Response {
        let query = uri.query().unwrap_or("");
        if uri.path() == "/delayed" {
            tokio::time::sleep(Duration::from_millis(120)).await;
        }
        if uri.path() == "/download" {
            return META.to_vec().into_response();
        }
        if uri.path() == "/magnet" {
            return (StatusCode::FOUND, [(header::LOCATION, MAGNET)]).into_response();
        }
        if uri.path() == "/escape" {
            return (
                StatusCode::FOUND,
                [(header::LOCATION, "https://example.test/private")],
            )
                .into_response();
        }
        if query.contains("t=caps") {
            return CAPS.into_response();
        }
        if query.contains("q=slow") {
            seen.notify_one();
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
        if query.contains("q=oversized") {
            return vec![b' '; 2 * 1024 * 1024 + 1].into_response();
        }
        if query.contains("q=error") {
            return (StatusCode::BAD_REQUEST, "secret body").into_response();
        }
        let link = if query.contains("q=magnet") {
            "/magnet"
        } else if query.contains("q=escape") {
            "/escape"
        } else {
            "/download?apikey=private-key"
        };
        format!("<rss><channel><response offset='0' total='2'/><item><title>Public fixture</title><enclosure url='{link}' type='application/x-bittorrent'/></item><item><title>Second</title><link>{link}</link></item></channel></rss>").into_response()
    }
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let seen = std::sync::Arc::new(tokio::sync::Notify::new());
    let state = seen.clone();
    let task = tokio::spawn(async move {
        axum::serve(listener, Router::new().fallback(route).with_state(state))
            .await
            .unwrap();
    });
    (base, task, seen)
}
async fn configured(root: &std::path::Path, base: &str) -> Torznab {
    let service = Torznab::new(root.to_owned(), CancellationToken::new())
        .await
        .unwrap();
    service
        .configure(Configure {
            id: "local".into(),
            label: "Local".into(),
            endpoint: format!("{base}/api"),
            api_key: "private-key".into(),
        })
        .await
        .unwrap();
    service
}
#[tokio::test]
async fn actual_local_search_prepare_and_redirects_are_private_and_bounded() {
    let (base, task, _) = indexer().await;
    let dir = Temp::new();
    let service = configured(&dir.0, &base).await;
    let page = service.search(search()).await.unwrap();
    assert_eq!(page["items"].as_array().unwrap().len(), 2);
    assert!(page["nextOffset"].is_null());
    let id = page["items"][0]["resultRef"].as_str().unwrap();
    assert_eq!(page["items"][1]["resultRef"], id);
    assert_eq!(
        service.search(search()).await.unwrap()["items"][0]["resultRef"],
        id
    );
    assert!(!page.to_string().contains("apikey") && !page.to_string().contains(&base));
    let prepared = service
        .prepare(Prepare {
            source_id: "local".into(),
            result_ref: id.into(),
        })
        .await
        .unwrap();
    assert_eq!(
        service
            .prepare(Prepare {
                source_id: "local".into(),
                result_ref: id.into()
            })
            .await
            .unwrap(),
        prepared
    );
    let Payload::Torrent(bytes) = service
        .payload(
            "local".into(),
            prepared["sourceRef"].as_str().unwrap().into(),
        )
        .await
        .unwrap()
    else {
        panic!()
    };
    assert_eq!(bytes, META);
    let mut query = search();
    query.query = "magnet".into();
    let page = service.search(query).await.unwrap();
    let prepared = service
        .prepare(Prepare {
            source_id: "local".into(),
            result_ref: page["items"][0]["resultRef"].as_str().unwrap().into(),
        })
        .await
        .unwrap();
    let Payload::Magnet(value) = service
        .payload(
            "local".into(),
            prepared["sourceRef"].as_str().unwrap().into(),
        )
        .await
        .unwrap()
    else {
        panic!()
    };
    assert_eq!(value, MAGNET);
    let mut query = search();
    query.query = "escape".into();
    let page = service.search(query).await.unwrap();
    assert!(service
        .prepare(Prepare {
            source_id: "local".into(),
            result_ref: page["items"][0]["resultRef"].as_str().unwrap().into()
        })
        .await
        .is_err());
    let mut query = search();
    query.query = "error".into();
    assert_eq!(
        service.search(query).await.unwrap_err(),
        "torznab_http_error"
    );
    let mut query = search();
    query.query = "oversized".into();
    assert_eq!(
        service.search(query).await.unwrap_err(),
        "torznab_response_limit"
    );
    task.abort();
}
#[tokio::test]
async fn changed_source_cancels_pending_lookup_and_old_handles() {
    let (base, task, seen) = indexer().await;
    let dir = Temp::new();
    let service = configured(&dir.0, &base).await;
    service.caps("local", None).await.unwrap();
    let old = service.search(search()).await.unwrap();
    let pending_service = service.clone();
    let pending = tokio::spawn(async move {
        let mut query = search();
        query.query = "slow".into();
        pending_service.search(query).await
    });
    tokio::time::timeout(Duration::from_secs(2), seen.notified())
        .await
        .unwrap();
    service
        .configure(Configure {
            id: "local".into(),
            label: "New".into(),
            endpoint: format!("{base}/api"),
            api_key: "rotated".into(),
        })
        .await
        .unwrap();
    assert_eq!(
        tokio::time::timeout(Duration::from_secs(1), pending)
            .await
            .unwrap()
            .unwrap()
            .unwrap_err(),
        "torznab_cancelled"
    );
    assert!(service
        .prepare(Prepare {
            source_id: "local".into(),
            result_ref: old["items"][0]["resultRef"].as_str().unwrap().into()
        })
        .await
        .is_err());
    task.abort();
}

#[tokio::test]
async fn dropping_pending_search_releases_admission_without_publishing() {
    let (base, task, seen) = indexer().await;
    let dir = Temp::new();
    let service = configured(&dir.0, &base).await;
    service.caps("local", None).await.unwrap();
    let mut jobs = Vec::new();
    for _ in 0..2 {
        let client = service.clone();
        jobs.push(tokio::spawn(async move {
            let mut q = search();
            q.query = "slow".into();
            client.search(q).await
        }));
        tokio::time::timeout(Duration::from_secs(2), seen.notified())
            .await
            .unwrap();
    }
    assert_eq!(service.search(search()).await.unwrap_err(), "torznab_busy");
    for job in jobs {
        job.abort();
        let _ = job.await;
    }
    assert!(service.search(search()).await.is_ok());
    service.shutdown();
    assert!(service.search(search()).await.is_err());
    let reopened = Torznab::new(dir.0.clone(), CancellationToken::new())
        .await
        .unwrap();
    assert_eq!(reopened.sources()["sources"][0]["id"], "local");
    task.abort();
}

#[tokio::test]
async fn cold_caps_and_search_share_one_absolute_deadline() {
    let (base, task, _) = indexer().await;
    let dir = Temp::new();
    let service = configured(&dir.0, &base).await;
    service
        .configure(Configure {
            id: "local".into(),
            label: "Delayed".into(),
            endpoint: format!("{base}/delayed"),
            api_key: "private-key".into(),
        })
        .await
        .unwrap();
    let result = service
        .search_before(
            search(),
            std::time::Instant::now() + Duration::from_millis(180),
        )
        .await;
    assert_eq!(result.unwrap_err(), "torznab_timeout");
    assert!(
        service.search(search()).await.is_ok(),
        "expired work releases admission"
    );
    task.abort();
}

#[test]
fn compliant_larger_pages_are_bounded_without_dropping_the_next_offset() {
    let item = "<item><title>Public</title><link>/download</link></item>";
    let page = format!("<rss><channel>{}</channel></rss>", item.repeat(1000));
    let page = torznab_xml::page(page.as_bytes(), 100).unwrap();
    assert_eq!(page.items.len(), 100);
    assert_eq!(page.count, 100);
    let excessive = format!("<rss><channel>{}</channel></rss>", item.repeat(1001));
    assert!(torznab_xml::page(excessive.as_bytes(), 100).is_err());
}

#[test]
fn reference_quota_preserves_existing_favorites_and_detects_tampered_bytes() {
    let dir = Temp::new();
    let mut store = Store::load(dir.0.clone()).unwrap();
    let source = config();
    store.configure(source.clone()).unwrap();
    let mut first = String::new();
    for n in 0..128 {
        let id = store
            .prepare(
                &source,
                Payload::Magnet(format!("magnet:?xt=urn:btih:{n:040x}")),
            )
            .unwrap();
        if n == 0 {
            first = id;
        }
    }
    assert_eq!(
        store
            .prepare(
                &source,
                Payload::Magnet(format!("magnet:?xt=urn:btih:{:040x}", 129))
            )
            .unwrap_err(),
        "torznab_store_limit"
    );
    assert!(store.payload("local", &first).is_ok());
    assert_eq!(
        store
            .prepare(
                &source,
                Payload::Magnet(format!("magnet:?xt=urn:btih:{:040x}", 0))
            )
            .unwrap(),
        first
    );
    std::fs::write(dir.0.join(format!("{first}.bin")), b"tampered").unwrap();
    assert!(store.payload("local", &first).is_err());
}

#[tokio::test]
async fn authenticated_api_prepares_reference_and_feeds_existing_engine() {
    let (indexer_base, indexer_task, _) = indexer().await;
    let dir = Temp::new();
    let companion = Companion::new(dir.0.clone(), "x".repeat(48), None)
        .await
        .unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = format!("http://{}", listener.local_addr().unwrap());
    let base = format!("{address}{}", companion.endpoint());
    let router = companion.routes();
    let server = tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    let http = reqwest::Client::new();
    let unauthorized = http
        .post(format!(
            "{address}/companion/{}/v1/torrent/sources",
            "z".repeat(48)
        ))
        .json(&json!({"id":"local"}))
        .send()
        .await
        .unwrap();
    assert_eq!(unauthorized.status(), StatusCode::UNAUTHORIZED);
    let response = http.post(format!("{base}/torrent/sources")).json(&json!({"id":"local","label":"Local","endpoint":format!("{indexer_base}/api"),"apiKey":"private-key"})).send().await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert!(!response.text().await.unwrap().contains("private-key"));
    let page: Value = http
        .post(format!("{base}/torrent/search"))
        .json(
            &json!({"sourceId":"local","query":"public","categoryIds":[2000],"offset":0,"limit":2}),
        )
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let prepared: Value = http
        .post(format!("{base}/torrent/prepare"))
        .json(&json!({"sourceId":"local","resultRef":page["items"][0]["resultRef"]}))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    for invalid in [
        json!({"sourceRef":prepared["sourceRef"]}),
        json!({"sourceId":"other","sourceRef":prepared["sourceRef"]}),
        json!({"source":"https://example.test/a.torrent","sourceId":"local","sourceRef":prepared["sourceRef"]}),
    ] {
        assert!(!http
            .post(format!("{base}/sessions"))
            .json(&invalid)
            .send()
            .await
            .unwrap()
            .status()
            .is_success());
    }
    let response = http
        .post(format!("{base}/sessions"))
        .json(&json!({"sourceId":"local","sourceRef":prepared["sourceRef"]}))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::ACCEPTED);
    let started: Value = response.json().await.unwrap();
    let id = started["id"].as_str().unwrap();
    let lease = companion.0.torrent.get(id).unwrap();
    tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            let view = lease.view();
            assert_ne!(view.state, "error", "{:?}", view.error);
            if view.state == "select" {
                assert_eq!(view.files[0].name, "a.mp4");
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap();
    assert_eq!(
        http.delete(format!("{base}/sessions/{id}"))
            .send()
            .await
            .unwrap()
            .status(),
        StatusCode::NO_CONTENT
    );
    companion.shutdown().await;
    server.abort();
    indexer_task.abort();
}
