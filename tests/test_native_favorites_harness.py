"""Pure source contracts for the hidden WK harness; no Rust/native execution."""
import json
from pathlib import Path
import re
import unittest

SOURCE = (Path(__file__).parent.parent / 'src-tauri/examples/favorites_storage_smoke.rs').read_text()


class NativeHarnessSourceTests(unittest.TestCase):
    def test_actual_rust_href_literal_policy(self):
        body = SOURCE.split('fn fixture_href(href: &str) -> bool {', 1)[1].split('\n    }', 1)[0].strip()
        match = re.fullmatch(r'matches!\(href, ("[^"\n]+"(?: \| "[^"\n]+")*)\)', body)
        self.assertIsNotNone(match, 'The Rust predicate must remain an exact literal match')
        allowed = {json.loads(item) for item in match.group(1).split(' | ')}
        self.assertEqual(allowed, {'tauri://localhost', 'tauri://localhost/index.html'})
        for value in ['tauri://localhost', 'tauri://localhost/index.html']:
            self.assertIn(value, allowed)
        for value in ['tauri://localhost/', 'tauri://localhost/index.html?x', 'tauri://localhost#x',
                      'tauri://user@localhost', 'tauri://localhost:80', 'tauri://other',
                      'tauri://localhost/foreign.html', 'http://localhost', 'null',
                      'tauri://localhost\n', 'tauri://LOCALHOST']:
            self.assertNotIn(value, allowed)

    def test_native_identity_stays_exact_and_each_view_pins_match(self):
        self.assertIn('value["origin"] == "tauri://localhost"', SOURCE)
        self.assertIn('value["href"].as_str().is_some_and(fixture_href)', SOURCE)
        loop = SOURCE.split('for label in LABELS {', 1)[1].split('let writer =', 1)[0]
        self.assertIn('evaluate(&view, "window.nativeSourcePins").await? == module_pins', loop)
        self.assertIn('"window.nativeSourcePins"', SOURCE)

    def test_cleanup_waits_for_actual_destroyed_then_main_loop(self):
        cleanup = SOURCE.split('async fn cleanup(', 1)[1].split('pub fn run()', 1)[0]
        order = ['view.destroy()', 'while DESTROYED.load', 'main_loop_release(app, deadline).await?',
                 'app.get_webview_window(label).is_none()', 'removeDataStoreForIdentifier_completionHandler']
        positions = [cleanup.index(value) for value in order]
        self.assertEqual(positions, sorted(positions))
        self.assertIn('matches!(event, tauri::WindowEvent::Destroyed)', SOURCE)
        self.assertIn('DESTROYED.fetch_or(own_window_mask(window.label())', SOURCE)
        self.assertIn('CREATED.fetch_or(own_window_mask(label)', SOURCE)
        self.assertIn('CREATED.fetch_or(own_window_mask("reloaded")', SOURCE)

    def test_store_retries_share_deadline_and_exact_intent_uuid(self):
        cleanup = SOURCE.split('async fn cleanup(', 1)[1].split('pub fn run()', 1)[0]
        self.assertEqual(cleanup.count('Instant::now() + Duration::from_secs('), 1)
        self.assertIn('let deadline = Instant::now() + Duration::from_secs(30)', cleanup)
        self.assertIn('for slot in ["slot1", "slot2", "slot3", "slot4"]', cleanup)
        self.assertLess(cleanup.index('let identifier ='), cleanup.index('for attempt in 1..=40'))
        self.assertIn('data_store_identifier(&output.join(slot))', cleanup)
        self.assertIn('NSUUID::from_bytes(identifier)', cleanup)
        self.assertIn('timeout_at(tokio::time::Instant::from_std(deadline), receiver)', cleanup)
        self.assertIn('require(removed,', cleanup)
        self.assertIn('error.localizedDescription(), error.domain(), error.code()', cleanup)
        self.assertIn('"own_uuid_removal_attempts":attempts', cleanup)
        self.assertNotIn('allDataStoreIdentifiers', cleanup)
        self.assertNotIn('defaultDataStore', cleanup)

    def test_cleanup_releases_only_own_store_caches_before_identifier_removal(self):
        cleanup = SOURCE.split('async fn cleanup(', 1)[1].split('pub fn run()', 1)[0]
        order = ['app.get_webview_window(label).is_none()',
                 'data_store_identifier(&output.join(slot))',
                 'release_owned_store_data(app, identifier, deadline).await',
                 'for attempt in 1..=40',
                 'removeDataStoreForIdentifier_completionHandler']
        for operation in order:
            self.assertIn(operation, cleanup, 'Cleanup must release the exact store before removing its identifier')
        positions = [cleanup.index(value) for value in order]
        self.assertEqual(positions, sorted(positions))
        self.assertIn('"own_store_data_release_callbacks":released_stores', cleanup)
        self.assertLess(cleanup.index('release_owned_store_data('), cleanup.index('released_stores.push('))
        self.assertIn('Own named-store data release failed for {slot}', cleanup)
        self.assertIn('require(removed,', cleanup)

    def test_store_release_callback_does_not_retain_store_or_get_a_new_deadline(self):
        self.assertIn('async fn release_owned_store_data(', SOURCE, 'Missing bounded native store-release phase')
        release = SOURCE.split('async fn release_owned_store_data(', 1)[1].split('async fn cleanup(', 1)[0]
        self.assertIn('identifier: [u8; 16]', release)
        self.assertIn('deadline: Instant', release)
        self.assertNotIn('Instant::now() +', release)
        self.assertIn('objc2::rc::autoreleasepool', release)
        self.assertIn('NSUUID::from_bytes(identifier)', release)
        self.assertIn('WKWebsiteDataStore::dataStoreForIdentifier(&uuid, mtm)', release)
        self.assertIn('WKWebsiteDataStore::allWebsiteDataTypes(mtm)', release)
        self.assertIn('NSDate::distantPast()', release)
        self.assertIn('store.removeDataOfTypes_modifiedSince_completionHandler', release)
        # The completion only sends an acknowledgement. No retained WK object
        # may survive in its capture while identifier removal is attempted.
        callback = release.split('let callback =', 1)[1].split('let uuid =', 1)[0]
        self.assertNotIn('store', callback)
        order = ['store.removeDataOfTypes_modifiedSince_completionHandler', 'drop(store)',
                 'timeout_at(tokio::time::Instant::from_std(deadline), receiver)',
                 'main_loop_release(app, deadline).await']
        positions = [release.index(value) for value in order]
        self.assertEqual(positions, sorted(positions))
        self.assertNotIn('allDataStoreIdentifiers', release)
        self.assertNotIn('defaultDataStore', release)

    def test_shared_storage_wait_requires_exact_writer_value_before_lock_tests(self):
        phase = SOURCE.split('let shared_started = Instant::now();', 1)[1].split('for label in ["slot2", "slot3", "slot4"]', 1)[0]
        self.assertIn('if sample? == "own-shared-value"', phase)
        self.assertIn('observed?;', phase)
        self.assertIn('require(after? == "own-shared-value"', phase)
        self.assertLess(phase.index('shared_storage_observation(observation)?'), phase.index('observed?;'))
        self.assertIn('let end = Instant::now() + Duration::from_secs(10)', SOURCE)
        self.assertIn('Same-store second view acquired a held native WebLock', SOURCE)
        self.assertIn('Final physical CAS overwrote competing actual localStorage bytes', SOURCE)

    def test_shared_storage_failure_diagnostics_keep_before_after_and_intended_uuid(self):
        self.assertIn('observation["before"] = json!(sample.as_ref().ok())', SOURCE)
        self.assertIn('observation["before_read_error"] = json!(sample.as_ref().err())', SOURCE)
        self.assertIn('observation["before_elapsed_ms"] = json!(shared_started.elapsed().as_millis())', SOURCE)
        self.assertIn('observation["last_observed"] = json!(sample.as_ref().ok())', SOURCE)
        self.assertIn('observation["after"] = json!(after.as_ref().ok())', SOURCE)
        self.assertIn('observation["wait_error"] = json!(observed.as_ref().err())', SOURCE)
        self.assertIn('"writer_intended_store_identifier":writer_identifier', SOURCE)
        self.assertIn('"observer_intended_store_identifier":observer_identifier', SOURCE)
        self.assertIn('"same_intended_store_identifier":writer_identifier == observer_identifier', SOURCE)
        report = SOURCE.split('let mut report = result.unwrap_or_else', 1)[1]
        self.assertIn('report["shared_storage_observation"] = value.clone()', report)
        self.assertIn('report["own_named_stores_cleaned"]', report)

    def test_shared_observation_uses_one_absolute_deadline_without_late_success(self):
        phase = SOURCE.split('let shared_started = Instant::now();', 1)[1].split('for label in ["slot2", "slot3", "slot4"]', 1)[0]
        self.assertEqual(phase.count('shared_started + Duration::from_secs(10)'), 1)
        self.assertIn('timeout_at(tokio::time::Instant::from_std(shared_deadline), async', phase)
        self.assertIn('shared_deadline, Instant::now() + Duration::from_millis(25)', phase)
        self.assertIn('let observed = observed.and_then(|_| require(Instant::now() < shared_deadline', phase)
        self.assertLess(phase.index('Instant::now() < shared_deadline'), phase.index('observed?;'))

    def test_watchdog_and_failure_result_are_preserved(self):
        self.assertIn('tokio::time::sleep(Duration::from_secs(90)).await; handle.exit(1)', SOURCE)
        self.assertIn('if result.is_ok() && cleaned.is_ok() { 0 } else { 1 }', SOURCE)
        self.assertIn('report["own_named_stores_cleaned"] = json!(cleaned.is_ok())', SOURCE)
        self.assertIn('report["cleanup_error"] = json!(error)', SOURCE)


if __name__ == '__main__':
    unittest.main(verbosity=2)
