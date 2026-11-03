//! Stage A: actual hidden Tauri/Wry/WKWebView physical-backend qualification.
//! This source proposal has not been compiled or executed. No installed player is used.
#[cfg(target_os = "macos")]
#[path = "../src/instance.rs"]
mod instance;

#[cfg(target_os = "macos")]
mod smoke {
    use serde_json::{json, Value};
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicBool, AtomicI32, AtomicUsize, Ordering};
    use std::time::{Duration, Instant};
    use tauri::{Listener, Manager};
    static LOADED: AtomicUsize = AtomicUsize::new(0);
    static STARTED: AtomicBool = AtomicBool::new(false);
    static SEQ: AtomicUsize = AtomicUsize::new(0);
    static EXIT: AtomicI32 = AtomicI32::new(1);
    static CREATED: AtomicUsize = AtomicUsize::new(0);
    static DESTROYED: AtomicUsize = AtomicUsize::new(0);
    static SHARED_STORAGE: std::sync::Mutex<Option<Value>> = std::sync::Mutex::new(None);
    const OWN_LABELS: [&str; 6] = ["writer", "observer", "slot2", "slot3", "slot4", "reloaded"];
    const LABELS: [&str; 5] = ["writer", "observer", "slot2", "slot3", "slot4"];

    fn own_window_mask(label: &str) -> usize {
        OWN_LABELS.iter().position(|candidate| *candidate == label)
            .map_or(0, |index| 1 << index)
    }
    fn fixture_href(href: &str) -> bool {
        matches!(href, "tauri://localhost" | "tauri://localhost/index.html")
    }
    async fn main_loop_release(app: &tauri::AppHandle, deadline: Instant) -> Result<(), String> {
        let (sender, receiver) = tokio::sync::oneshot::channel();
        // A queued turn runs after the Destroyed handler and Wry's wrapper removal.
        app.run_on_main_thread(move || { let _ = sender.send(()); })
            .map_err(|error| error.to_string())?;
        tokio::time::timeout_at(tokio::time::Instant::from_std(deadline), receiver).await
            .map_err(|_| "Own main-loop release timed out".to_string())?
            .map_err(|_| "Own main-loop release channel closed".to_string())
    }
    fn shared_storage_observation(value: Value) -> Result<(), String> {
        *SHARED_STORAGE.lock().map_err(|_| "Own storage observation lock poisoned".to_string())? = Some(value);
        Ok(())
    }
    async fn evaluate(window: &tauri::WebviewWindow, expression: &str) -> Result<Value, String> {
        let event = format!("favorites-native-{}", SEQ.fetch_add(1, Ordering::SeqCst));
        let (sender, receiver) = tokio::sync::oneshot::channel();
        let listener = window.once(event.clone(), move |reply| {
            let _ = sender.send(serde_json::from_str::<Value>(reply.payload()));
        });
        let script = format!(
            r#"(async function() {{try {{const value=await ({});await window.__TAURI__.event.emit({},{{ok:true,value}});}}catch(error){{await window.__TAURI__.event.emit({},{{ok:false,error:String(error.message)}});}}}})();"#,
            expression,
            json!(event),
            json!(event)
        );
        if let Err(error) = window.eval(script) {
            window.unlisten(listener);
            return Err(error.to_string());
        }
        let received = tokio::time::timeout(Duration::from_secs(10), receiver).await;
        window.unlisten(listener);
        let reply = received
            .map_err(|_| "Own hidden view evaluation timed out".to_string())?
            .map_err(|_| "Own hidden view reply closed".to_string())?
            .map_err(|error| error.to_string())?;
        if reply["ok"] == true {
            Ok(reply["value"].clone())
        } else {
            Err(reply["error"]
                .as_str()
                .unwrap_or("Fixture evaluation failed")
                .to_string())
        }
    }
    async fn wait(window: &tauri::WebviewWindow, expression: &str) -> Result<(), String> {
        let end = Instant::now() + Duration::from_secs(10);
        loop {
            if evaluate(window, expression).await? == true {
                return Ok(());
            }
            if Instant::now() >= end {
                return Err("Native phase condition timed out".into());
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    }
    fn require(ok: bool, message: &str) -> Result<(), String> {
        if ok {
            Ok(())
        } else {
            Err(message.to_string())
        }
    }
    fn acknowledged(value: &Value) -> Result<(), String> {
        require(
            value["result"]["acknowledged"] == true
                && value["result"]["persistence"] == "persistent",
            "One fresh native ACK did not persist",
        )?;
        require(
            value["result"]["record"]["original_state"] == "pending"
                && value["result"]["record"]["original_outcome"] == "unknown",
            "ACK changed original uncertain outcome",
        )?;
        require(
            value["result"]["record"]["original_entry_sha256"]
                == value["inspected"]["record"]["original_entry_sha256"],
            "ACK changed original entry digest",
        )?;
        require(
            value["result"]["ledger_revision"] == value["inspected"]["after_ledger_sha256"]
                && value["observed"]["acknowledge_allowed"] == false,
            "Native ACK readback mismatch or replay allowed",
        )
    }
    async fn recovery(
        writer: &tauri::WebviewWindow,
        observer: &tauri::WebviewWindow,
    ) -> Result<Value, String> {
        evaluate(writer, "window.installNativeRecovery('native-writer')").await?;
        evaluate(observer, "window.installNativeRecovery('native-observer')").await?;
        evaluate(
            writer,
            "window.nativeRecovery.start('00000000-0000-4000-8000-000000000001')",
        )
        .await?;
        wait(
            writer,
            "window.nativeRecovery.state.entered === true && !!window.nativeRecovery.state.heldAck",
        )
        .await?;
        wait(writer, "window.nativeRecovery.state.rpcResult !== null").await?;
        require(
            evaluate(writer, "window.nativeRecovery.state.rpcResult.outcome").await? == "unknown",
            "Actual engine RPC did not reach its deadline while native work remained pending",
        )?;
        require(
            evaluate(writer, "window.nativeRecovery.bytesPreserved()").await? == true,
            "Actual engine overwrote bytes still used by unresolved native apply",
        )?;
        let before = evaluate(observer, "window.nativeRecovery.raw()").await?;
        require(evaluate(observer, "window.nativeRecovery.execute({mode:'inspect',operation_id:'00000000-0000-4000-8000-000000000001'})").await?["error"] == "busy", "Actual inspector acquired a lock held after engine RPC deadline")?;
        let held_ack = evaluate(writer, "window.nativeRecovery.state.heldAck").await?;
        let busy = evaluate(
            observer,
            &format!("window.nativeRecovery.execute({})", held_ack),
        )
        .await?;
        require(
            busy["error"] == "busy"
                && evaluate(observer, "window.nativeRecovery.raw()").await? == before,
            "Busy ACK changed native ledger or acquired pending physical work",
        )?;
        evaluate(writer, "window.nativeRecovery.release()").await?;
        wait(writer, "window.nativeRecovery.state.settled === true").await?;
        wait(observer, "window.nativeRecovery.execute({mode:'inspect',operation_id:'00000000-0000-4000-8000-000000000001'}).then(value=>value.acknowledge_allowed===true)").await?;
        let first = evaluate(
            observer,
            "window.nativeRecovery.freshAck('00000000-0000-4000-8000-000000000001')",
        )
        .await?;
        acknowledged(&first)?;
        let original_first = evaluate(
            observer,
            "JSON.stringify(JSON.parse(window.nativeRecovery.raw()).entries[0])",
        )
        .await?;
        // A second independent pending receipt uses the actual service and native grant.
        // Its writer realm is destroyed; no fake lock or callback settles it.
        evaluate(
            writer,
            "window.nativeRecovery.reserveOnly('00000000-0000-4000-8000-000000000002')",
        )
        .await?;
        wait(writer, "window.nativeRecovery.state.entered === true").await?;
        require(evaluate(observer, "window.nativeRecovery.execute({mode:'inspect',operation_id:'00000000-0000-4000-8000-000000000002'})").await?["error"] == "busy", "Closed-writer prerequisite was not physically held")?;
        writer.destroy().map_err(|error| error.to_string())?;
        wait(observer, "window.nativeRecovery.execute({mode:'inspect',operation_id:'00000000-0000-4000-8000-000000000002'}).then(value=>value.acknowledge_allowed===true)").await?;
        let second = evaluate(
            observer,
            "window.nativeRecovery.freshAck('00000000-0000-4000-8000-000000000002')",
        )
        .await?;
        acknowledged(&second)?;
        require(
            evaluate(
                observer,
                "JSON.stringify(JSON.parse(window.nativeRecovery.raw()).entries[0])",
            )
            .await?
                == original_first,
            "Closed-writer ACK changed previous original/audit bytes",
        )?;
        Ok(
            json!({"actual_engine_rpc_timeout_unknown":true,"native_lock_retained_until_actual_apply_settlement":true,"busy_ack_zero_ledger_change":true,"closed_writer_native_lock_release":true,"single_fresh_ack_each":true,"originals_and_previous_audit_preserved":true,"first":first,"second":second}),
        )
    }
    async fn exercise(app: tauri::AppHandle, output: PathBuf) -> Result<Value, String> {
        let mut capabilities = serde_json::Map::new();
        let module_pins = evaluate(
            &app.get_webview_window("writer").ok_or("Writer missing")?,
            "window.nativeSourcePins",
        )
        .await?;
        for label in LABELS {
            let view = app
                .get_webview_window(label)
                .ok_or("Missing own test view")?;
            require(
                !view.is_visible().map_err(|error| error.to_string())?,
                "A fixture view became visible",
            )?;
            let value = evaluate(&view, "window.nativeFavoritesSmoke.capabilities()").await?;
            let bytes = serde_json::to_vec_pretty(&value).map_err(|error| error.to_string())?;
            std::fs::write(output.join(format!("capabilities-{label}.json")), bytes)
                .map_err(|error| error.to_string())?;
            require(
                value["origin"] == "tauri://localhost",
                "Actual window.location.origin is not exact tauri://localhost",
            )?;
            require(
                value["href"].as_str().is_some_and(fixture_href),
                "Actual committed href differs from bundled fixture",
            )?;
            require(
                value["secureContext"] == true
                    && value["storage"] == true
                    && value["actualLocks"] == true
                    && value["grant"] == true
                    && value["current"] == true,
                "Actual captured Storage/WebLocks grant unavailable; do not qualify native origin",
            )?;
            require(evaluate(&view, "window.nativeSourcePins").await? == module_pins,
                "Own bundled fixture module pins differ between native views")?;
            capabilities.insert(label.to_string(), value);
        }
        let writer = app.get_webview_window("writer").ok_or("Writer missing")?;
        let observer = app
            .get_webview_window("observer")
            .ok_or("Observer missing")?;
        require(
            evaluate(
                &writer,
                "window.nativeFavoritesSmoke.set('own-shared-value')",
            )
            .await?
                == "own-shared-value",
            "Own native set/read failed",
        )?;
        let shared_started = Instant::now();
        let shared_deadline = shared_started + Duration::from_secs(10);
        // These are the intended production isolation IDs, not a claim that
        // physical storage sharing has already been observed.
        let writer_identifier = super::instance::data_store_identifier(&output.join("slot1"));
        let observer_identifier = super::instance::data_store_identifier(&output.join("slot1"));
        let mut observation = json!({"expected":"own-shared-value", "writer_view":"writer", "observer_view":"observer",
            "writer_intended_store_identifier":writer_identifier,
            "observer_intended_store_identifier":observer_identifier,
            "same_intended_store_identifier":writer_identifier == observer_identifier});
        shared_storage_observation(observation.clone())?;
        // The existing 10-second/25-ms observation convention uses ONE absolute
        // deadline for every IPC read, poll and final comparison. No late read
        // after timeout can turn a failed observation into success.
        let observed = tokio::time::timeout_at(tokio::time::Instant::from_std(shared_deadline), async {
            let mut polls = 0usize;
            loop {
                let sample = evaluate(&observer, "window.nativeFavoritesSmoke.get()").await;
                if polls == 0 {
                    observation["before"] = json!(sample.as_ref().ok());
                    observation["before_read_error"] = json!(sample.as_ref().err());
                    observation["before_elapsed_ms"] = json!(shared_started.elapsed().as_millis());
                }
                polls += 1;
                observation["polls"] = json!(polls);
                observation["last_observed"] = json!(sample.as_ref().ok());
                observation["last_read_error"] = json!(sample.as_ref().err());
                shared_storage_observation(observation.clone())?;
                if sample? == "own-shared-value" {
                    let after = evaluate(&observer, "window.nativeFavoritesSmoke.get()").await;
                    observation["after"] = json!(after.as_ref().ok());
                    observation["after_read_error"] = json!(after.as_ref().err());
                    shared_storage_observation(observation.clone())?;
                    require(after? == "own-shared-value", "Same WK store did not share exact writer localStorage after bounded wait")?;
                    return Ok::<(), String>(());
                }
                tokio::time::sleep_until(tokio::time::Instant::from_std(std::cmp::min(
                    shared_deadline, Instant::now() + Duration::from_millis(25)))).await;
            }
        }).await.unwrap_or_else(|_| Err("Same WK store did not share exact writer localStorage within original 10-second observation deadline".to_string()));
        let observed = observed.and_then(|_| require(Instant::now() < shared_deadline,
            "Same-store observation completed after its original deadline"));
        observation["elapsed_ms"] = json!(shared_started.elapsed().as_millis());
        observation["wait_succeeded"] = json!(observed.is_ok());
        observation["wait_error"] = json!(observed.as_ref().err());
        shared_storage_observation(observation)?;
        observed?;
        for label in ["slot2", "slot3", "slot4"] {
            let view = app
                .get_webview_window(label)
                .ok_or("Isolated view missing")?;
            require(
                evaluate(&view, "window.nativeFavoritesSmoke.get()")
                    .await?
                    .is_null(),
                "Distinct instance store leaked Favorites data",
            )?;
        }
        evaluate(&writer, "window.nativeFavoritesSmoke.beginHold()").await?;
        wait(
            &writer,
            "window.nativeFavoritesSmoke.state.entered === true",
        )
        .await?;
        // An external deadline must not settle/cancel the actual Web Locks promise.
        tokio::time::sleep(Duration::from_millis(120)).await;
        require(
            evaluate(&observer, "window.nativeFavoritesSmoke.acquired()").await? == false,
            "Same-store second view acquired a held native WebLock",
        )?;
        for label in ["slot2", "slot3", "slot4"] {
            let view = app
                .get_webview_window(label)
                .ok_or("Isolated view missing")?;
            require(
                evaluate(&view, "window.nativeFavoritesSmoke.acquired()").await? == true,
                "Distinct instance store incorrectly shared native lock",
            )?;
        }
        evaluate(&writer, "window.nativeFavoritesSmoke.release()").await?;
        wait(
            &writer,
            "window.nativeFavoritesSmoke.state.settled === true",
        )
        .await?;
        require(
            evaluate(&observer, "window.nativeFavoritesSmoke.acquired()").await? == true,
            "Actual settled promise did not release lock",
        )?;
        let targets = evaluate(&writer, "window.nativeStorageFacade.writeTargets()").await?;
        let observed_targets =
            evaluate(&observer, "window.nativeStorageFacade.readTargets()").await?;
        require(targets == observed_targets && observed_targets["aliasesMatch"] == true, "Production provider aliases/persisted/physical readback disagree across actual WK views")?;
        let cas = evaluate(&observer, "window.nativeFavoritesSmoke.finalCompare()").await?;
        require(
            cas["outcome"] == "conflict"
                && cas["value"] == "competing"
                && cas["admissionCalls"] == 2,
            "Final physical CAS overwrote competing actual localStorage bytes",
        )?;
        let physical_only = std::env::args().any(|value| value == "--physical-only");
        let recovery_result = if physical_only {
            evaluate(&observer, "window.nativeFavoritesSmoke.beginHold()").await?;
            wait(
                &observer,
                "window.nativeFavoritesSmoke.state.entered === true",
            )
            .await?;
            require(
                evaluate(&writer, "window.nativeFavoritesSmoke.acquired()").await? == false,
                "Closed-writer prerequisite lock was not held",
            )?;
            observer.destroy().map_err(|error| error.to_string())?;
            wait(&writer, "window.nativeFavoritesSmoke.acquired()").await?;
            json!({"not_run":"Stage A only; no engine/ACK qualification"})
        } else {
            recovery(&writer, &observer).await?
        };
        if !physical_only {
            let ledger_before_reload = evaluate(
                &observer,
                "window.nativeStorageFacade.raw('favorites-receipts.v1')",
            )
            .await?;
            observer.destroy().map_err(|error| error.to_string())?;
            let builder = tauri::WebviewWindowBuilder::new(
                &app,
                "reloaded",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .visible(false)
            .skip_taskbar(true)
            .decorations(false)
            .on_navigation(|url| {
                url.scheme() == "tauri"
                    && url.host_str() == Some("localhost")
                    && url.port().is_none()
                    && url.username().is_empty()
                    && url.password().is_none()
            });
            let reloaded = super::instance::apply_isolation(builder, &output.join("slot1"))
                .build()
                .map_err(|error| error.to_string())?;
            CREATED.fetch_or(own_window_mask("reloaded"), Ordering::SeqCst);
            let end = Instant::now() + Duration::from_secs(10);
            while LOADED.load(Ordering::SeqCst) < 6 {
                if Instant::now() >= end {
                    return Err("Own reload view did not finish native bootstrap".into());
                }
                tokio::time::sleep(Duration::from_millis(25)).await;
            }
            require(
                !reloaded.is_visible().map_err(|error| error.to_string())?,
                "Reload fixture became visible",
            )?;
            let after_reload =
                evaluate(&reloaded, "window.nativeStorageFacade.readTargets()").await?;
            for field in ["tv", "media", "tvRawUnits", "mediaRawUnits", "aliasesMatch"] {
                require(
                    after_reload[field] == targets[field],
                    "Production TV/media native persisted data changed after realm recreation",
                )?;
            }
            require(
                after_reload["ledgerRaw"] == ledger_before_reload,
                "Actual private receipt ledger did not survive production storage bootstrap reload",
            )?;
        }
        let report = json!({"status":"pass", "stage":if physical_only {"A-actual-native-physical-backend"} else {"A+B-native-physical-engine-recovery"}, "module_pins":module_pins, "capabilities": capabilities,
            "same_store_two_views":true,"four_test_instance_stores_isolated":true,"native_lock_full_promise_lifetime":true,
            "final_compare_conflict_preserved":true,"destroyed_writer_releases_native_lock":true,
            "recovery":recovery_result,"physical_only":physical_only,
            "not_claimed":["full verified Plex host admission", "production origin qualification", "installed t1-t4 runtime proof"],
            "user_profiles_accessed":false,"visible_windows":false,"output":output});
        Ok(report)
    }
    async fn release_owned_store_data(
        app: &tauri::AppHandle,
        identifier: [u8; 16],
        deadline: Instant,
    ) -> Result<(), String> {
        let (sender, receiver) = tokio::sync::oneshot::channel();
        app.run_on_main_thread(move || {
            objc2::rc::autoreleasepool(|_| {
                let Some(mtm) = objc2::MainThreadMarker::new() else {
                    let _ = sender.send(Err("Main thread unavailable".to_string()));
                    return;
                };
                let sender = std::cell::RefCell::new(Some(sender));
                let callback = block2::RcBlock::new(move || {
                    if let Some(sender) = sender.borrow_mut().take() { let _ = sender.send(Ok(())); }
                });
                let uuid = objc2_foundation::NSUUID::from_bytes(identifier);
                // A destroyed view can leave this session in WebKit's process cache.
                // Public data removal also releases that session's cached processes.
                // Never enumerate stores or obtain the application's default store.
                let store = unsafe { objc2_web_kit::WKWebsiteDataStore::dataStoreForIdentifier(&uuid, mtm) };
                let types = unsafe { objc2_web_kit::WKWebsiteDataStore::allWebsiteDataTypes(mtm) };
                let since = objc2_foundation::NSDate::distantPast();
                unsafe { store.removeDataOfTypes_modifiedSince_completionHandler(&types, &since, &callback); }
                // The completion must not keep this reference alive during removal.
                drop(store);
            });
        }).map_err(|error| error.to_string())?;
        tokio::time::timeout_at(tokio::time::Instant::from_std(deadline), receiver).await
            .map_err(|_| "Own store data-release callback timed out".to_string())?
            .map_err(|_| "Own store data-release channel closed".to_string())??;
        // WebKit's callback can itself retain the store until it returns.
        main_loop_release(app, deadline).await
    }
    async fn cleanup(app: &tauri::AppHandle, output: &std::path::Path) -> Result<Value, String> {
        let deadline = Instant::now() + Duration::from_secs(30);
        let expected = CREATED.load(Ordering::SeqCst);
        let mut attempts = Vec::new();
        let mut released_stores = Vec::new();
        require(expected != 0, "Own created-window mask is empty")?;
        for label in OWN_LABELS {
            if let Some(view) = app.get_webview_window(label) {
                view.destroy().map_err(|error| error.to_string())?;
            }
        }
        // destroy() only enqueues destruction. Observe actual events before deleting
        // stores; give Wry a later main-loop turn to drop its native webview wrappers.
        while DESTROYED.load(Ordering::SeqCst) & expected != expected {
            require(Instant::now() < deadline, &format!("Own windows did not emit Destroyed before cleanup deadline; expected={expected}, destroyed={}", DESTROYED.load(Ordering::SeqCst)))?;
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
        main_loop_release(app, deadline).await?;
        require(OWN_LABELS.iter().all(|label| app.get_webview_window(label).is_none()),
            "Own window manager still contains a destroyed view")?;
        for slot in ["slot1", "slot2", "slot3", "slot4"] {
            let identifier = super::instance::data_store_identifier(&output.join(slot));
            require(Instant::now() < deadline, "Own store data release exceeded cleanup deadline")?;
            release_owned_store_data(app, identifier, deadline).await
                .map_err(|error| format!("Own named-store data release failed for {slot}: {error}; attempts={}", json!(attempts)))?;
            released_stores.push(json!({"slot":slot,"identifier":identifier}));
            let mut removed = false;
            // Only these exact intent UUIDs are retried, within one cleanup deadline.
            for attempt in 1..=40 {
                require(Instant::now() < deadline, &format!("Own named-store cleanup deadline; attempts={}", json!(attempts)))?;
                let (sender, receiver) = tokio::sync::oneshot::channel();
                app.run_on_main_thread(move || {
                    let Some(mtm) = objc2::MainThreadMarker::new() else { let _ = sender.send(Err("Main thread unavailable".to_string())); return; };
                    let sender = std::cell::RefCell::new(Some(sender));
                    let callback = block2::RcBlock::new(move |error: *mut objc2_foundation::NSError| {
                        let outcome = if let Some(error) = unsafe { error.as_ref() } {
                            Err(format!("{} (domain={}, code={})", error.localizedDescription(), error.domain(), error.code()))
                        } else { Ok(()) };
                        if let Some(sender) = sender.borrow_mut().take() { let _ = sender.send(outcome); }
                    });
                    let uuid = objc2_foundation::NSUUID::from_bytes(identifier);
                    // Public exact-ID removal only. No enumeration, default stores or private APIs.
                    unsafe { objc2_web_kit::WKWebsiteDataStore::removeDataStoreForIdentifier_completionHandler(&uuid, &callback, mtm); }
                }).map_err(|error| error.to_string())?;
                let result = tokio::time::timeout_at(tokio::time::Instant::from_std(deadline), receiver)
                    .await.map_err(|_| format!("Own named-store cleanup callback timed out; attempts={}", json!(attempts)))?
                    .map_err(|_| "Own named-store cleanup channel closed".to_string())?;
                attempts.push(json!({"slot":slot,"identifier":identifier,"attempt":attempt,"error":result.as_ref().err()}));
                require(Instant::now() < deadline, &format!("Own named-store callback exceeded cleanup deadline; attempts={}", json!(attempts)))?;
                if result.is_ok() { removed = true; break; }
                // WebKit may release the store asynchronously after its view is gone.
                main_loop_release(app, deadline).await.map_err(|error| format!("{error}; attempts={}", json!(attempts)))?;
                tokio::time::sleep_until(tokio::time::Instant::from_std(
                    std::cmp::min(deadline, Instant::now() + Duration::from_millis(100)))).await;
            }
            require(removed, &format!("Own named store still in use or removal failed; attempts={}", json!(attempts)))?;
        }
        require(Instant::now() < deadline, "Own named-store cleanup exceeded original cleanup deadline")?;
        Ok(json!({"own_windows_destroyed":true,"destroyed_mask":DESTROYED.load(Ordering::SeqCst),
            "expected_mask":expected,"own_store_data_release_callbacks":released_stores,"own_uuid_removal_attempts":attempts}))
    }
    pub fn run() -> Result<i32, Box<dyn std::error::Error>> {
        let output = PathBuf::from(
            std::env::args()
                .nth(1)
                .ok_or("Explicit owned output root required")?,
        );
        if !output.is_absolute() || output.exists() {
            return Err("Fresh absolute owned output root required".into());
        }
        std::fs::create_dir_all(&output)?;
        let store_ids: Vec<_> = ["slot1", "slot2", "slot3", "slot4"].iter().map(|slot| json!({"slot":slot,"identifier":super::instance::data_store_identifier(&output.join(slot))})).collect();
        std::fs::write(
            output.join("intent.json"),
            serde_json::to_vec_pretty(
                &json!({"fresh_output":output.display().to_string(),"own_test_store_ids":store_ids,"user_profiles":false,"native_qualified":false}),
            )?,
        )?;
        let fixture_root = output.clone();
        let report_root = output.clone();
        let app = tauri::Builder::default()
            .setup(move |app| {
                app.set_activation_policy(tauri::ActivationPolicy::Prohibited);
                for label in LABELS {
                    let slot = match label { "writer" | "observer" => "slot1", value => value };
                    let store_root = fixture_root.join(slot);
                    // Production isolation mapping, but only fresh TEMP fixture paths.
                    let builder = tauri::WebviewWindowBuilder::new(app, label, tauri::WebviewUrl::App("index.html".into()))
                        .visible(false).skip_taskbar(true).decorations(false)
                        .on_navigation(|url| url.scheme() == "tauri" && url.host_str() == Some("localhost") && url.port().is_none() && url.username().is_empty() && url.password().is_none());
                    super::instance::apply_isolation(builder, &store_root).build()?;
                    CREATED.fetch_or(own_window_mask(label), Ordering::SeqCst);
                }
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move { tokio::time::sleep(Duration::from_secs(90)).await; handle.exit(1); });
                Ok(())
            })
            .on_window_event(|window, event| {
                if matches!(event, tauri::WindowEvent::Destroyed) {
                    DESTROYED.fetch_or(own_window_mask(window.label()), Ordering::SeqCst);
                }
            })
            .on_page_load(move |view, event| {
                if event.event() != tauri::webview::PageLoadEvent::Finished || (!LABELS.contains(&view.label()) && view.label() != "reloaded") { return; }
                if LOADED.fetch_add(1, Ordering::SeqCst) + 1 != LABELS.len() || STARTED.swap(true, Ordering::SeqCst) { return; }
                let app = view.app_handle().clone(); let output = report_root.clone();
                tauri::async_runtime::spawn(async move {
                    let result = exercise(app.clone(), output.clone()).await;
                    let cleaned = cleanup(&app, &output).await;
                    let mut code = if result.is_ok() && cleaned.is_ok() { 0 } else { 1 };
                    let mut report = result.unwrap_or_else(|error| json!({"status":"fail","error":error,"qualified_native_origin":false}));
                    match SHARED_STORAGE.lock() {
                        Ok(observation) => if let Some(value) = observation.as_ref() { report["shared_storage_observation"] = value.clone(); },
                        Err(_) => { code = 1; report["status"] = json!("fail"); report["observation_error"] = json!("Own storage observation lock poisoned"); }
                    }
                    report["own_named_stores_cleaned"] = json!(cleaned.is_ok());
                    match cleaned {
                        Ok(cleanup) => report["cleanup"] = cleanup,
                        Err(error) => { report["status"] = json!("fail"); report["cleanup_error"] = json!(error); }
                    }
                    match serde_json::to_string_pretty(&report) { Ok(text) => if std::fs::write(output.join("result.json"), text).is_err() { code = 1; }, Err(_) => code = 1, }
                    EXIT.store(code, Ordering::SeqCst); app.exit(code);
                });
            })
            .build(tauri::generate_context!("examples/favorites-storage-smoke/tauri.conf.json"))?;
        app.run_return(|_, event| {
            if let tauri::RunEvent::ExitRequested {
                code: None, api, ..
            } = event
            {
                api.prevent_exit();
            }
        });
        Ok(EXIT.load(Ordering::SeqCst))
    }
}
#[cfg(target_os = "macos")]
fn main() {
    match smoke::run() {
        Ok(code) => std::process::exit(code),
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }
}
#[cfg(not(target_os = "macos"))]
fn main() {
    eprintln!("Requires actual macOS WKWebView");
    std::process::exit(1);
}
