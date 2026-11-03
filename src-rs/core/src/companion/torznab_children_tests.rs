//! Loopback-only regressions for selected Jackett children. No real indexer is contacted.
use super::torznab::{Configure, Prepare, Search, Torznab};
use super::torznab_store::Payload;
use super::*;
use std::future::Future;
use std::pin::Pin;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::Mutex;
use std::task::Poll;
use std::time::Duration;

const PREFIX: &str = "/gateway/api/v2.0/indexers/";
const KEY: &str = "fixture-key";
const META_A: &[u8] = b"d8:announce0:4:infod6:lengthi1e4:name5:a.mp412:piece lengthi1e6:pieces20:000000000000000000007:privatei1eee";
const META_B: &[u8] = b"d8:announce0:4:infod6:lengthi1e4:name5:b.mp412:piece lengthi1e6:pieces20:111111111111111111117:privatei1eee";

struct Temp(std::path::PathBuf);
impl Temp {
    fn new() -> Self {
        Self(std::env::temp_dir().join(format!("ott-child-test-{}", uuid::Uuid::new_v4().simple())))
    }
}
impl Drop for Temp {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[derive(Clone, Debug)]
struct Call {
    child: String,
    operation: String,
    path: String,
}
struct FixtureState {
    children: AtomicU8,
    delay_caps: AtomicBool,
    delay_discovery: AtomicBool,
    seen: tokio::sync::Notify,
    release: tokio::sync::Notify,
    calls: Mutex<Vec<Call>>,
}
struct Server(Option<tokio::task::JoinHandle<()>>);
impl Drop for Server {
    fn drop(&mut self) {
        if let Some(task) = self.0.take() {
            task.abort();
        }
    }
}
struct Fixture {
    base: String,
    state: Arc<FixtureState>,
    _server: Server,
}
impl Fixture {
    async fn start() -> Self {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let state = Arc::new(FixtureState {
            children: AtomicU8::new(3),
            delay_caps: AtomicBool::new(false),
            delay_discovery: AtomicBool::new(false),
            seen: tokio::sync::Notify::new(),
            release: tokio::sync::Notify::new(),
            calls: Mutex::new(Vec::new()),
        });
        let router = Router::new().fallback(route).with_state(state.clone());
        let server = tokio::spawn(async move {
            axum::serve(listener, router).await.unwrap();
        });
        Self {
            base,
            state,
            _server: Server(Some(server)),
        }
    }
    fn endpoint(&self) -> String {
        format!("{}{PREFIX}all/results/torznab/api", self.base)
    }
    fn calls(&self) -> Vec<Call> {
        self.state.calls.lock().unwrap().clone()
    }
    fn discovery_calls(&self) -> usize {
        self.calls()
            .iter()
            .filter(|call| call.operation == "indexers")
            .count()
    }
    async fn wait_until_blocked(&self) {
        tokio::time::timeout(Duration::from_secs(2), self.state.seen.notified())
            .await
            .expect("fixture request must arrive");
    }
    fn allow_response(&self) {
        self.state.release.notify_one();
    }
}

async fn route(State(state): State<Arc<FixtureState>>, uri: axum::http::Uri) -> Response {
    let url = reqwest::Url::parse(&format!("http://fixture.invalid{uri}")).unwrap();
    let query: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
    let child = uri
        .path()
        .strip_prefix(PREFIX)
        .and_then(|p| p.split('/').next())
        .unwrap_or("direct");
    let operation = query.get("t").map(String::as_str).unwrap_or("download");
    state.calls.lock().unwrap().push(Call {
        child: child.to_owned(),
        operation: operation.to_owned(),
        path: uri.path().to_owned(),
    });
    if operation != "download" && query.get("apikey").map(String::as_str) != Some(KEY) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    if operation == "indexers" {
        assert_eq!(child, "all");
        assert_eq!(query.get("configured").map(String::as_str), Some("true"));
        let bits = state.children.load(Ordering::SeqCst);
        if state.delay_discovery.swap(false, Ordering::SeqCst) {
            state.seen.notify_one();
            state.release.notified().await;
        }
        let mut xml = String::from("<indexers>");
        for (bit, id) in [(1, "alpha"), (2, "beta")] {
            if bits & bit != 0 {
                xml.push_str(&format!(
                    "<indexer id='{id}' configured='true'><title>{id}</title>\
                     <link>https://tracker.invalid/not-an-api?secret=homepage</link>\
                     <language>en-US</language><type>public</type><caps/></indexer>"
                ));
            }
        }
        xml.push_str("</indexers>");
        return xml.into_response();
    }
    let slow = query.get("q").is_some_and(|q| q == "slow")
        || uri.path().ends_with("/slow.torrent")
        || (operation == "caps" && state.delay_caps.swap(false, Ordering::SeqCst));
    if slow {
        state.seen.notify_one();
        state.release.notified().await;
    }
    if operation == "caps" {
        let (category, title) = if child == "beta" {
            (5000, "Beta series")
        } else {
            (2000, "Alpha movies")
        };
        return format!(
            "<caps><limits max='100'/><searching><search available='yes'/></searching>\
             <categories><category id='{category}' name='{title}'/></categories></caps>"
        )
        .into_response();
    }
    if operation == "search" {
        if query.get("q").is_some_and(|q| q == "error") {
            return (StatusCode::BAD_GATEWAY, "fixture upstream failure").into_response();
        }
        let link = match query.get("q").map(String::as_str) {
            Some("shared") => "shared.torrent",
            Some("slow-prepare") => "slow.torrent",
            _ => "file.torrent",
        };
        return format!(
            "<rss><channel><response offset='0' total='1'/><item><title>Open fixture</title>\
             <enclosure url='{link}' type='application/x-bittorrent'/></item></channel></rss>"
        )
        .into_response();
    }
    if operation == "download" && uri.path().ends_with(".torrent") {
        let bytes = if child == "beta" && !uri.path().ends_with("/shared.torrent") {
            META_B
        } else {
            META_A
        };
        return bytes.to_vec().into_response();
    }
    StatusCode::NOT_FOUND.into_response()
}

async fn configure(service: &Torznab, id: &str, endpoint: String, label: &str) {
    service
        .configure(Configure {
            id: id.into(),
            label: label.into(),
            endpoint,
            api_key: KEY.into(),
        })
        .await
        .unwrap();
}
async fn configured(root: &std::path::Path, fixture: &Fixture) -> Torznab {
    let service = Torznab::new(root.to_owned(), CancellationToken::new())
        .await
        .unwrap();
    configure(&service, "local", fixture.endpoint(), "Fixture").await;
    service
}
fn search(child: Option<&str>, query: &str) -> Search {
    Search {
        source_id: "local".into(),
        indexer_id: child.map(str::to_owned),
        query: query.into(),
        category_ids: Vec::new(),
        offset: 0,
        limit: 10,
    }
}
fn result_ref(page: &Value) -> String {
    page["items"][0]["resultRef"].as_str().unwrap().to_owned()
}
async fn prepare(service: &Torznab, reference: String) -> Value {
    service
        .prepare(Prepare {
            source_id: "local".into(),
            result_ref: reference,
        })
        .await
        .unwrap()
}
async fn payload(service: &Torznab, prepared: &Value) -> Vec<u8> {
    match service
        .payload(
            "local".into(),
            prepared["sourceRef"].as_str().unwrap().into(),
        )
        .await
        .unwrap()
    {
        Payload::Torrent(bytes) => bytes,
        Payload::Magnet(_) => panic!("fixture must retain original metainfo"),
    }
}
fn assert_private(value: &Value, fixture: &Fixture) {
    let text = value.to_string();
    for secret in [KEY, &fixture.base, "tracker.invalid", "homepage"] {
        assert!(
            !text.contains(secret),
            "private endpoint information escaped"
        );
    }
}

// Polling the follower before releasing the fixture makes it overlap the
// blocked leader without depending on scheduler delays or sleeping.
async fn poll_pending<F: Future>(mut future: Pin<&mut F>) {
    std::future::poll_fn(|cx| {
        assert!(future.as_mut().poll(cx).is_pending());
        Poll::Ready(())
    })
    .await;
}

#[tokio::test]
async fn selected_children_resolve_identical_relative_links_against_distinct_endpoints() {
    let fixture = Fixture::start().await;
    let root = Temp::new();
    let service = configured(&root.0, &fixture).await;
    let children = service.indexers("local").await.unwrap();
    assert_eq!(children["supported"], true);
    assert_eq!(children["indexers"].as_array().unwrap().len(), 2);
    assert_private(&children, &fixture);
    let a = service.search(search(Some("alpha"), "open")).await.unwrap();
    let b = service.search(search(Some("beta"), "open")).await.unwrap();
    assert_eq!(a["indexerId"], "alpha");
    assert_eq!(b["indexerId"], "beta");
    assert_ne!(result_ref(&a), result_ref(&b));
    assert_private(&a, &fixture);
    assert_private(&b, &fixture);
    let pa = prepare(&service, result_ref(&a)).await;
    let pb = prepare(&service, result_ref(&b)).await;
    assert_eq!(payload(&service, &pa).await, META_A);
    assert_eq!(payload(&service, &pb).await, META_B);
    for child in ["alpha", "beta"] {
        assert!(fixture.calls().iter().any(|c| {
            c.operation == "download"
                && c.path == format!("{PREFIX}{child}/results/torznab/file.torrent")
        }));
    }
    configure(&service, "other", fixture.endpoint(), "Other source").await;
    let mut other = search(Some("alpha"), "open");
    other.source_id = "other".into();
    let other = service.search(other).await.unwrap();
    assert_ne!(result_ref(&other), result_ref(&a));
    assert!(service
        .prepare(Prepare {
            source_id: "other".into(),
            result_ref: result_ref(&a)
        })
        .await
        .is_err());
}

#[tokio::test]
async fn concurrent_cold_children_share_discovery_and_both_search_successfully() {
    let fixture = Fixture::start().await;
    let root = Temp::new();
    let service = configured(&root.0, &fixture).await;
    fixture.state.delay_discovery.store(true, Ordering::SeqCst);
    let client = service.clone();
    let leader = tokio::spawn(async move { client.search(search(Some("alpha"), "open")).await });
    fixture.wait_until_blocked().await;
    let follower = service.search(search(Some("beta"), "open"));
    tokio::pin!(follower);
    poll_pending(follower.as_mut()).await;
    fixture.allow_response();
    let (a, b) = tokio::time::timeout(Duration::from_secs(2), async {
        tokio::join!(leader, follower)
    })
    .await
    .unwrap();
    let a = a.unwrap().unwrap();
    let b = b.unwrap();
    assert_eq!(a["indexerId"], "alpha");
    assert_eq!(b["indexerId"], "beta");
    assert_ne!(result_ref(&a), result_ref(&b));
    assert_eq!(fixture.discovery_calls(), 1);
    for child in ["alpha", "beta"] {
        assert_eq!(
            fixture
                .calls()
                .iter()
                .filter(|call| call.operation == "search" && call.child == child)
                .count(),
            1
        );
    }
}

#[tokio::test]
async fn cancelling_discovery_follower_does_not_cancel_leader_or_later_requests() {
    let fixture = Fixture::start().await;
    let root = Temp::new();
    let service = configured(&root.0, &fixture).await;
    fixture.state.delay_discovery.store(true, Ordering::SeqCst);
    let client = service.clone();
    let leader = tokio::spawn(async move { client.search(search(Some("alpha"), "open")).await });
    fixture.wait_until_blocked().await;
    {
        let follower = service.search(search(Some("beta"), "open"));
        tokio::pin!(follower);
        poll_pending(follower.as_mut()).await;
        // Leaving this scope drops the pending request and its permit.
    }
    assert!(!leader.is_finished());
    fixture.allow_response();
    let a = tokio::time::timeout(Duration::from_secs(2), leader)
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    assert_eq!(a["indexerId"], "alpha");
    let b = tokio::time::timeout(
        Duration::from_secs(2),
        service.search(search(Some("beta"), "open")),
    )
    .await
    .unwrap()
    .unwrap();
    assert_eq!(b["indexerId"], "beta");
    assert_eq!(fixture.discovery_calls(), 1);
}

#[tokio::test]
async fn discovery_follower_keeps_its_own_deadline_without_cancelling_leader() {
    let fixture = Fixture::start().await;
    let root = Temp::new();
    let service = configured(&root.0, &fixture).await;
    fixture.state.delay_discovery.store(true, Ordering::SeqCst);
    let client = service.clone();
    let leader = tokio::spawn(async move { client.search(search(Some("alpha"), "open")).await });
    fixture.wait_until_blocked().await;
    let follower = service.search_before(
        search(Some("beta"), "open"),
        std::time::Instant::now() + Duration::from_millis(100),
    );
    let error = tokio::time::timeout(Duration::from_secs(2), follower)
        .await
        .unwrap()
        .unwrap_err();
    assert_eq!(error, "torznab_timeout");
    assert!(
        !leader.is_finished(),
        "follower expiry must leave leader alive"
    );
    assert_eq!(fixture.discovery_calls(), 1);
    fixture.allow_response();
    assert_eq!(
        tokio::time::timeout(Duration::from_secs(2), leader)
            .await
            .unwrap()
            .unwrap()
            .unwrap()["indexerId"],
        "alpha"
    );
    let fresh = tokio::time::timeout(
        Duration::from_secs(2),
        service.search(search(Some("beta"), "open")),
    )
    .await
    .unwrap()
    .unwrap();
    assert_eq!(fresh["indexerId"], "beta");
    assert_eq!(fixture.discovery_calls(), 1);
}

#[tokio::test]
async fn source_change_releases_discovery_leader_and_follower_before_old_response() {
    let fixture = Fixture::start().await;
    let replacement = Fixture::start().await;
    let root = Temp::new();
    let service = configured(&root.0, &fixture).await;
    fixture.state.delay_discovery.store(true, Ordering::SeqCst);
    let client = service.clone();
    let leader = tokio::spawn(async move { client.search(search(Some("alpha"), "open")).await });
    fixture.wait_until_blocked().await;
    let follower = service.search(search(Some("beta"), "open"));
    tokio::pin!(follower);
    poll_pending(follower.as_mut()).await;
    configure(&service, "local", replacement.endpoint(), "Replacement").await;
    let (a, b) = tokio::time::timeout(Duration::from_secs(2), async {
        tokio::join!(leader, follower)
    })
    .await
    .unwrap();
    assert_eq!(a.unwrap().unwrap_err(), "torznab_cancelled");
    assert_eq!(b.unwrap_err(), "torznab_cancelled");
    assert_eq!(fixture.discovery_calls(), 1);
    assert!(!fixture
        .calls()
        .iter()
        .any(|call| call.operation == "search"));
    let fresh = tokio::time::timeout(
        Duration::from_secs(2),
        service.search(search(Some("beta"), "open")),
    )
    .await
    .unwrap()
    .unwrap();
    assert_eq!(fresh["indexerId"], "beta");
    assert_eq!(replacement.discovery_calls(), 1);
    fixture.allow_response();
}

#[tokio::test]
async fn aborting_discovery_leader_releases_follower_and_allows_fresh_discovery() {
    let fixture = Fixture::start().await;
    let root = Temp::new();
    let service = configured(&root.0, &fixture).await;
    fixture.state.delay_discovery.store(true, Ordering::SeqCst);
    let client = service.clone();
    let leader = tokio::spawn(async move { client.search(search(Some("alpha"), "open")).await });
    fixture.wait_until_blocked().await;
    let follower = service.search(search(Some("beta"), "open"));
    tokio::pin!(follower);
    poll_pending(follower.as_mut()).await;
    leader.abort();
    assert!(leader.await.unwrap_err().is_cancelled());
    assert_eq!(
        tokio::time::timeout(Duration::from_secs(2), follower)
            .await
            .unwrap()
            .unwrap_err(),
        "torznab_cancelled"
    );
    // Do not release the abandoned upstream request: retry must be independent.
    let fresh = tokio::time::timeout(
        Duration::from_secs(2),
        service.search(search(Some("beta"), "open")),
    )
    .await
    .unwrap()
    .unwrap();
    assert_eq!(fresh["indexerId"], "beta");
    assert_eq!(fixture.discovery_calls(), 2);
    fixture.allow_response();
}

#[tokio::test]
async fn identical_payloads_across_children_keep_legacy_stable_reference_deduplication() {
    let fixture = Fixture::start().await;
    let root = Temp::new();
    let service = configured(&root.0, &fixture).await;
    let a = service
        .search(search(Some("alpha"), "shared"))
        .await
        .unwrap();
    let b = service
        .search(search(Some("beta"), "shared"))
        .await
        .unwrap();
    assert_ne!(result_ref(&a), result_ref(&b));
    let pa = prepare(&service, result_ref(&a)).await;
    let pb = prepare(&service, result_ref(&b)).await;
    assert_eq!(
        pa, pb,
        "stable references identify exact payload within a source generation"
    );
    configure(&service, "local", fixture.endpoint(), "Renamed only").await;
    assert_eq!(prepare(&service, result_ref(&a)).await, pa);
}

#[tokio::test]
async fn child_caps_exact_identifiers_and_errors_never_fall_back_to_all() {
    let fixture = Fixture::start().await;
    let root = Temp::new();
    let service = configured(&root.0, &fixture).await;
    let a = service.caps("local", Some("alpha")).await.unwrap();
    let b = service.caps("local", Some("beta")).await.unwrap();
    assert_eq!(a["categories"][0]["id"], 2000);
    assert_eq!(b["categories"][0]["id"], 5000);
    let mut invalid_category = search(Some("beta"), "open");
    invalid_category.category_ids = vec![2000];
    assert_eq!(
        service.search(invalid_category).await.unwrap_err(),
        "torznab_invalid_category"
    );
    for id in ["Alpha", "missing", "all", "../beta", "alpha%2fbeta", ""] {
        assert!(
            service.search(search(Some(id), "open")).await.is_err(),
            "{id}"
        );
    }
    assert_eq!(
        service
            .search(search(Some("alpha"), "error"))
            .await
            .unwrap_err(),
        "torznab_http_error"
    );
    let calls = fixture.calls();
    let searches: Vec<_> = calls.iter().filter(|c| c.operation == "search").collect();
    assert_eq!(searches.len(), 1);
    assert_eq!(searches[0].child, "alpha");
    assert!(!calls
        .iter()
        .any(|c| c.child == "all" && c.operation == "caps"));
}

#[tokio::test]
async fn direct_torznab_sources_keep_legacy_behavior_without_discovery_requests() {
    let fixture = Fixture::start().await;
    let root = Temp::new();
    let service = configured(&root.0, &fixture).await;
    configure(
        &service,
        "local",
        format!("{}/direct/api", fixture.base),
        "Direct",
    )
    .await;
    let before = fixture.calls().len();
    let children = service.indexers("local").await.unwrap();
    assert_eq!(children["supported"], false);
    assert_eq!(children["indexers"], json!([]));
    assert_eq!(fixture.calls().len(), before);
    assert_eq!(
        service
            .search(search(Some("alpha"), "open"))
            .await
            .unwrap_err(),
        "torznab_indexers_unsupported"
    );
    let page = service.search(search(None, "open")).await.unwrap();
    assert!(page.get("indexerId").is_none());
    assert_eq!(
        payload(&service, &prepare(&service, result_ref(&page)).await).await,
        META_A
    );
}

#[tokio::test]
async fn source_rotation_cancels_pending_child_work_and_invalidates_old_handles() {
    let fixture = Fixture::start().await;
    let root = Temp::new();
    let service = configured(&root.0, &fixture).await;
    let old = service.search(search(Some("alpha"), "open")).await.unwrap();
    let client = service.clone();
    let pending = tokio::spawn(async move { client.search(search(Some("alpha"), "slow")).await });
    fixture.wait_until_blocked().await;
    service
        .configure(Configure {
            id: "local".into(),
            label: "Rotated".into(),
            endpoint: fixture.endpoint(),
            api_key: "rotated".into(),
        })
        .await
        .unwrap();
    let error = tokio::time::timeout(Duration::from_secs(1), pending)
        .await
        .unwrap()
        .unwrap()
        .unwrap_err();
    assert_eq!(error, "torznab_cancelled");
    fixture.allow_response();
    assert!(service
        .prepare(Prepare {
            source_id: "local".into(),
            result_ref: result_ref(&old)
        })
        .await
        .is_err());
}

#[tokio::test]
async fn refresh_revokes_removed_child_pending_search_and_handles_but_not_stable_payloads() {
    let fixture = Fixture::start().await;
    let root = Temp::new();
    let service = configured(&root.0, &fixture).await;
    let a = service.search(search(Some("alpha"), "open")).await.unwrap();
    let b = service.search(search(Some("beta"), "open")).await.unwrap();
    let stable = prepare(&service, result_ref(&a)).await;
    let client = service.clone();
    let pending = tokio::spawn(async move { client.search(search(Some("alpha"), "slow")).await });
    fixture.wait_until_blocked().await;
    fixture.state.children.store(2, Ordering::SeqCst);
    let current = service.indexers("local").await.unwrap();
    assert_eq!(current["indexers"].as_array().unwrap().len(), 1);
    fixture.allow_response();
    assert!(tokio::time::timeout(Duration::from_secs(1), pending)
        .await
        .unwrap()
        .unwrap()
        .is_err());
    assert!(service
        .prepare(Prepare {
            source_id: "local".into(),
            result_ref: result_ref(&a)
        })
        .await
        .is_err());
    assert_eq!(payload(&service, &stable).await, META_A);
    assert_eq!(
        payload(&service, &prepare(&service, result_ref(&b)).await).await,
        META_B
    );
    assert_eq!(
        service.caps("local", Some("alpha")).await.unwrap_err(),
        "torznab_indexer_missing"
    );
}

#[tokio::test]
async fn refresh_revokes_removed_child_caps_response_before_it_can_enter_cache() {
    let fixture = Fixture::start().await;
    let root = Temp::new();
    let service = configured(&root.0, &fixture).await;
    service.indexers("local").await.unwrap();
    fixture.state.delay_caps.store(true, Ordering::SeqCst);
    let client = service.clone();
    let pending = tokio::spawn(async move { client.caps("local", Some("alpha")).await });
    fixture.wait_until_blocked().await;
    fixture.state.children.store(2, Ordering::SeqCst);
    service.indexers("local").await.unwrap();
    fixture.allow_response();
    assert!(tokio::time::timeout(Duration::from_secs(1), pending)
        .await
        .unwrap()
        .unwrap()
        .is_err());
    fixture.state.children.store(3, Ordering::SeqCst);
    service.indexers("local").await.unwrap();
    service.caps("local", Some("alpha")).await.unwrap();
    assert_eq!(
        fixture
            .calls()
            .iter()
            .filter(|c| c.child == "alpha" && c.operation == "caps")
            .count(),
        2
    );
}

#[tokio::test]
async fn refresh_revokes_removed_child_pending_prepare_without_changing_legacy_contract() {
    let fixture = Fixture::start().await;
    let root = Temp::new();
    let service = configured(&root.0, &fixture).await;
    let page = service
        .search(search(Some("alpha"), "slow-prepare"))
        .await
        .unwrap();
    let client = service.clone();
    let pending = tokio::spawn(async move {
        client
            .prepare(Prepare {
                source_id: "local".into(),
                result_ref: result_ref(&page),
            })
            .await
    });
    fixture.wait_until_blocked().await;
    fixture.state.children.store(2, Ordering::SeqCst);
    service.indexers("local").await.unwrap();
    fixture.allow_response();
    assert!(tokio::time::timeout(Duration::from_secs(1), pending)
        .await
        .unwrap()
        .unwrap()
        .is_err());
}

#[tokio::test]
async fn older_discovery_response_cannot_overwrite_a_newer_child_removal() {
    let fixture = Fixture::start().await;
    let root = Temp::new();
    let service = configured(&root.0, &fixture).await;
    service.indexers("local").await.unwrap();
    fixture.state.delay_discovery.store(true, Ordering::SeqCst);
    let client = service.clone();
    let older = tokio::spawn(async move { client.indexers("local").await });
    fixture.wait_until_blocked().await;
    // The older response already captured alpha+beta, but has not returned.
    fixture.state.children.store(2, Ordering::SeqCst);
    let newer = service.indexers("local").await.unwrap();
    assert_eq!(newer["indexers"].as_array().unwrap().len(), 1);
    assert_eq!(newer["indexers"][0]["id"], "beta");
    fixture.allow_response();
    assert_eq!(
        tokio::time::timeout(Duration::from_secs(1), older)
            .await
            .unwrap()
            .unwrap()
            .unwrap_err(),
        "torznab_cancelled"
    );
    assert_eq!(
        service.caps("local", Some("alpha")).await.unwrap_err(),
        "torznab_indexer_missing"
    );
    assert_eq!(
        service.caps("local", Some("beta")).await.unwrap()["indexerId"],
        "beta"
    );
}

#[tokio::test]
async fn removing_then_readding_same_child_does_not_revive_its_pending_search() {
    let fixture = Fixture::start().await;
    let root = Temp::new();
    let service = configured(&root.0, &fixture).await;
    service.caps("local", Some("alpha")).await.unwrap();
    let client = service.clone();
    let older = tokio::spawn(async move { client.search(search(Some("alpha"), "slow")).await });
    fixture.wait_until_blocked().await;
    fixture.state.children.store(2, Ordering::SeqCst);
    service.indexers("local").await.unwrap();
    fixture.state.children.store(3, Ordering::SeqCst);
    service.indexers("local").await.unwrap();
    fixture.allow_response();
    let error = tokio::time::timeout(Duration::from_secs(1), older)
        .await
        .unwrap()
        .unwrap()
        .unwrap_err();
    assert!(matches!(
        error,
        "torznab_indexer_missing" | "torznab_cancelled"
    ));
    let fresh = service.search(search(Some("alpha"), "open")).await.unwrap();
    assert_eq!(fresh["indexerId"], "alpha");
    assert_eq!(fresh["items"].as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn authenticated_child_routes_and_legacy_prepare_reject_selector_injection() {
    let fixture = Fixture::start().await;
    let root = Temp::new();
    let token = "c".repeat(48);
    let companion = Companion::new(root.0.clone(), token, None).await.unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = format!("http://{}", listener.local_addr().unwrap());
    let base = format!("{address}{}", companion.endpoint());
    let router = companion.routes();
    let _server = Server(Some(tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    })));
    let http = reqwest::Client::builder().no_proxy().build().unwrap();
    let wrong = format!(
        "{address}/companion/{}/v1/torrent/sources/local",
        "z".repeat(48)
    );
    for suffix in ["/indexers", "/caps?indexerId=alpha"] {
        assert_eq!(
            http.get(format!("{wrong}{suffix}"))
                .send()
                .await
                .unwrap()
                .status(),
            StatusCode::UNAUTHORIZED
        );
    }
    assert!(fixture.calls().is_empty());
    let configured = http
        .post(format!("{base}/torrent/sources"))
        .json(&json!({
            "id":"local", "label":"Fixture", "endpoint":fixture.endpoint(), "apiKey":KEY
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(configured.status(), StatusCode::OK);
    let children: Value = http
        .get(format!("{base}/torrent/sources/local/indexers"))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(children["supported"], true);
    assert_private(&children, &fixture);
    let caps: Value = http
        .get(format!("{base}/torrent/sources/local/caps?indexerId=beta"))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(caps["indexerId"], "beta");
    assert_eq!(caps["categories"][0]["id"], 5000);
    let page: Value = http
        .post(format!("{base}/torrent/search"))
        .json(&json!({
            "sourceId":"local", "indexerId":"alpha", "query":"open", "limit":10
        }))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let request = json!({"sourceId":"local", "resultRef":result_ref(&page)});
    let prepared = http
        .post(format!("{base}/torrent/prepare"))
        .json(&request)
        .send()
        .await
        .unwrap();
    assert_eq!(prepared.status(), StatusCode::OK);
    let prepared: Value = prepared.json().await.unwrap();
    assert_eq!(prepared["sourceRef"].as_str().unwrap().len(), 32);
    let mut injected = request;
    injected["indexerId"] = json!("beta");
    let rejected = http
        .post(format!("{base}/torrent/prepare"))
        .json(&injected)
        .send()
        .await
        .unwrap();
    assert!(!rejected.status().is_success());
    let probes_before = fixture.calls().len();
    let null_selector = http
        .post(format!("{base}/torrent/search"))
        .json(&json!({
            "sourceId":"local", "indexerId":null, "query":"open", "limit":10
        }))
        .send()
        .await
        .unwrap();
    assert!(!null_selector.status().is_success());
    assert_eq!(
        fixture.calls().len(),
        probes_before,
        "null must not probe the aggregate or any child"
    );
    companion.shutdown().await;
}
