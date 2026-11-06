"""Driver tests with tiny owned subprocesses; no native/WebKit/workflow runs."""
import importlib.util
import contextlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest import mock

driver_path = Path(__file__).with_name('ci-native-favorites.py')
if not driver_path.is_file():
    driver_path = Path(__file__).parent.parent / 'scripts/ci-native-favorites.py'
spec = importlib.util.spec_from_file_location('ci_native_favorites', driver_path)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def stage_a_codec(raw):
    digest = m.hashlib.sha256(raw).hexdigest()
    if digest == m.CANDIDATE:
        raw = raw.decode().replace(m.NEW, m.OLD).encode()
    if m.hashlib.sha256(raw).hexdigest() != m.BASELINE:
        raise ValueError('Stage A fixture codec is not the exact reviewed baseline')
    return raw


class Clock:
    def __init__(self):
        self.now = 0
    def __call__(self):
        return self.now


class DriverTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.clock = Clock()
        self.budget = m.Budget(self.clock)
        self.output = self.base / 'attempt'
        self.output.mkdir()
        self.driver = m.Driver(self.base, self.output, self.budget)

    def tearDown(self):
        self.temp.cleanup()

    def runtime(self, label='stage-a-runtime'):
        root = self.driver.runtime_root / label
        root.mkdir()
        return root

    def native_report(self):
        pins = {}
        for name in m.MODULE_FILES:
            path = self.base / name
            path.parent.mkdir(parents=True, exist_ok=True)
            raw = ((Path(__file__).parent.parent / name).read_bytes()
                   if name.endswith('favorites-recovery-codec.ts') else name.encode())
            if name.endswith('favorites-recovery-codec.ts'):
                raw = stage_a_codec(raw)
            path.write_bytes(raw)
            pins[name] = m.hashlib.sha256(raw).hexdigest()
        self.assertEqual(pins['src/settings/favorites-recovery-codec.ts'], m.BASELINE)
        return {'status': 'pass', 'physical_only': True, 'own_named_stores_cleaned': True,
                'visible_windows': False, 'user_profiles_accessed': False,
                'stage': 'A-actual-native-physical-backend', 'module_pins': pins,
                'capabilities': {label: {'origin': 'tauri://localhost', 'href': 'tauri://localhost',
                                       **{key: True for key in ('secureContext', 'storage', 'actualLocks', 'grant', 'current')}}
                                 for label in m.VIEW_LABELS}}

    def accept_native_report(self, report):
        def native_fixture(_label, _argv, _timeout):
            root = self.driver.runtime_root / 'stage-a-runtime'
            root.mkdir(exist_ok=True)
            (root / 'result.json').write_text(json.dumps(report))
        with mock.patch.object(self.driver, 'run', side_effect=native_fixture):
            return self.driver.runtime('stage-a-runtime', self.base / 'fixture-executable', True)

    def test_stage_a_fixture_reconstructs_only_exact_baseline(self):
        raw = (Path(__file__).parent.parent / 'src/settings/favorites-recovery-codec.ts').read_bytes()
        baseline = stage_a_codec(raw)
        candidate = baseline.decode().replace(m.OLD, m.NEW).encode()
        self.assertEqual(m.hashlib.sha256(candidate).hexdigest(), m.CANDIDATE)
        self.assertEqual(stage_a_codec(candidate), baseline)
        self.assertEqual(stage_a_codec(baseline), baseline)
        with self.assertRaises(ValueError):
            stage_a_codec(candidate + b'\n')

    def test_actual_runtime_accepts_only_two_canonical_fixture_urls(self):
        report = self.native_report()
        for href in ('tauri://localhost', 'tauri://localhost/index.html'):
            with self.subTest(href=href):
                for value in report['capabilities'].values():
                    value['href'] = href
                self.assertEqual(self.accept_native_report(report)['stage'], report['stage'])

    def test_actual_runtime_rejects_foreign_or_modified_fixture_urls(self):
        report = self.native_report()
        for href in ('tauri://localhost/', 'tauri://localhost/other.html',
                     'tauri://localhost?x=1', 'tauri://localhost/index.html#x',
                     'tauri://user@localhost', 'tauri://localhost.other/index.html',
                     'https://localhost/index.html'):
            with self.subTest(href=href):
                report['capabilities']['writer']['href'] = href
                with self.assertRaisesRegex(RuntimeError, 'Actual native URL mismatch'):
                    self.accept_native_report(report)

    def test_actual_runtime_rejects_changed_fixture_module_identity(self):
        report = self.native_report()
        report['module_pins']['src/storage/index.ts'] = '0' * 64
        with self.assertRaisesRegex(RuntimeError, 'Actual bundled fixture modules differ'):
            self.accept_native_report(report)

    def test_actual_runtime_rejects_missing_view_or_wrong_origin(self):
        report = self.native_report()
        removed = report['capabilities'].pop('slot4')
        with self.assertRaisesRegex(RuntimeError, 'Actual fixture view set differs'):
            self.accept_native_report(report)
        report['capabilities']['slot4'] = removed
        removed['origin'] = 'https://localhost'
        with self.assertRaisesRegex(RuntimeError, 'Actual native URL mismatch'):
            self.accept_native_report(report)

    def test_main_clock_precedes_disk_preflight_and_output(self):
        root = self.base / 'preflight'
        root.mkdir()
        clock = Clock()
        def disk(_path):
            clock.now = 1681
            return shutil._ntuple_diskusage(100 * 1024**3, 0, 100 * 1024**3)
        env = {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted',
               'RUNNER_TEMP': str(root), 'GITHUB_RUN_ID': '1', 'GITHUB_RUN_ATTEMPT': '1'}
        with mock.patch.dict(os.environ, env), mock.patch.object(m.platform, 'system', return_value='Darwin'), mock.patch.object(m.shutil, 'disk_usage', side_effect=disk), mock.patch.object(m.subprocess, 'Popen') as spawn:
            with self.assertRaises(m.DeadlineError):
                m.main(['--mode', 'physical'], clock=clock)
            spawn.assert_not_called()
        self.assertFalse((root / 'ottplay-favorites-1-1').exists())

    def test_sample_deadline_checked_per_entry(self):
        (self.output / 'first').write_text('one')
        original = Path.lstat
        def slow(path, *args, **kwargs):
            value = original(path, *args, **kwargs)
            if path.name == 'first':
                self.clock.now = 1681
            return value
        self.clock.now = 10
        with mock.patch.object(Path, 'lstat', slow):
            with self.assertRaises(m.DeadlineError):
                self.driver.sample()

    def test_sample_accepts_only_disappeared_owned_entries(self):
        path = self.output / 'compiler-temporary'
        path.write_text('temporary')
        original = Path.lstat
        def disappears(candidate, *args, **kwargs):
            if candidate == path:
                candidate.unlink()
                raise FileNotFoundError(str(candidate))
            return original(candidate, *args, **kwargs)
        self.clock.now = 10
        with mock.patch.object(Path, 'lstat', disappears):
            self.driver.sample()
        self.assertFalse(path.exists())

    def test_sample_rejects_other_metadata_errors(self):
        path = self.output / 'unreadable'
        path.write_text('temporary')
        original = Path.lstat
        def denied(candidate, *args, **kwargs):
            if candidate == path:
                raise PermissionError(str(candidate))
            return original(candidate, *args, **kwargs)
        self.clock.now = 10
        with mock.patch.object(Path, 'lstat', denied):
            with self.assertRaises(PermissionError):
                self.driver.sample()

    def test_sample_walk_errors_fail_closed_except_disappearance(self):
        def walk(_root, *, followlinks, onerror):
            onerror(FileNotFoundError('removed directory'))
            yield str(self.output), [], []
        self.clock.now = 10
        with mock.patch.object(m.os, 'walk', side_effect=walk):
            self.driver.sample()
        def denied(_root, *, followlinks, onerror):
            onerror(PermissionError('unreadable directory'))
            yield str(self.output), [], []
        self.clock.now = 20
        with mock.patch.object(m.os, 'walk', side_effect=denied):
            with self.assertRaises(PermissionError):
                self.driver.sample()

    def fake_command(self, *, natural=False, term_exits=True, group_present=False,
                     identity_error=False, selector_error=False,
                     cleanup_wait_error=False, expire=False, group_error=False,
                     selector_close_error=False):
        read_fd, write_fd = os.pipe()
        os.close(write_fd)
        state = {'group_signals': [], 'handle_signals': [], 'reaped': False}
        class Process:
            pid = 424242
            stdout = os.fdopen(read_fd, 'rb')
            returncode = 0 if natural else None
            def poll(proc):
                if proc.returncode is not None:
                    state['reaped'] = True
                return proc.returncode
            def wait(proc, timeout):
                if cleanup_wait_error:
                    raise PermissionError('cleanup wait failed')
                if proc.returncode is None:
                    raise m.subprocess.TimeoutExpired('fixture', timeout)
                state['reaped'] = True
                return proc.returncode
            def send_signal(proc, sig):
                self.assertFalse(state['reaped'], 'signal after reap')
                state['handle_signals'].append(sig)
                if sig == m.signal.SIGKILL or term_exits:
                    proc.returncode = 0
        proc = Process()
        real_selector = m.selectors.DefaultSelector
        class FailingCloseSelector:
            def __init__(self):
                self.actual = real_selector()
            def __getattr__(self, name):
                return getattr(self.actual, name)
            def close(self):
                self.actual.close()
                raise RuntimeError('selector close failed')
        def killpg(_pgid, sig):
            if sig == 0:
                if group_error:
                    raise PermissionError('unknown group')
                if not group_present:
                    raise ProcessLookupError()
                return
            self.assertFalse(state['reaped'], 'group signal after reap')
            state['group_signals'].append(sig)
            if sig == m.signal.SIGKILL or term_exits:
                proc.returncode = 0
        def sample():
            if not natural:
                if expire:
                    self.clock.now = 1801
                raise RuntimeError('original phase failure')
        error = None
        with contextlib.ExitStack() as stack:
            stack.enter_context(mock.patch.object(m.subprocess, 'Popen', return_value=proc))
            identity_failure = (identity_error if isinstance(identity_error, BaseException)
                                else OSError('identity setup failed') if identity_error else None)
            stack.enter_context(mock.patch.object(m.os, 'getpgid', side_effect=identity_failure or (lambda _pid: proc.pid)))
            stack.enter_context(mock.patch.object(m.os, 'getsid', return_value=proc.pid))
            stack.enter_context(mock.patch.object(m.os, 'killpg', side_effect=killpg))
            stack.enter_context(mock.patch.object(self.driver, 'sample', side_effect=sample))
            if selector_error:
                stack.enter_context(mock.patch.object(m.selectors, 'DefaultSelector', side_effect=RuntimeError('selector setup failed')))
            elif selector_close_error:
                stack.enter_context(mock.patch.object(m.selectors, 'DefaultSelector', FailingCloseSelector))
            try:
                self.driver.run('owned-process-fixture', ['fixture-command'], 1)
            except BaseException as caught:
                error = caught
        self.assertTrue(proc.stdout.closed)
        return error, self.driver.commands[-1], state

    def identity_transition(self, *, lookup='getpgid', exit_code=0, outcome='exit',
                            group_state='absent', limit=1, start=0):
        """Model ESRCH before waitpid can reap, without launching or signalling a child."""
        self.clock.now = start
        read_fd, write_fd = os.pipe()
        os.write(write_fd, b'identity-transition\n')
        os.close(write_fd)
        state = {'events': [], 'waits': [], 'probes': [], 'signals': [], 'reaped': False}
        failure = ProcessLookupError('identity vanished before reap')
        wait_failure = PermissionError('wait status unavailable')
        fixture = self
        class Process:
            pid = 424242
            stdout = os.fdopen(read_fd, 'rb')
            returncode = None
            polls = 0
            def poll(proc):
                proc.polls += 1
                # The baseline reaches its second poll only in cleanup. It must
                # still fail even though that later poll finds a successful exit.
                if proc.polls > 1 and outcome in ('exit', 'late'):
                    proc.returncode = exit_code
                if proc.returncode is not None:
                    state['reaped'] = True
                state['events'].append(('poll', proc.returncode))
                return proc.returncode
            def wait(proc, timeout):
                fixture.assertGreater(timeout, 0)
                if proc.returncode is None:
                    state['waits'].append(timeout)
                    state['events'].append(('wait', timeout))
                    if outcome == 'error':
                        raise wait_failure
                    if outcome == 'timeout':
                        fixture.clock.now += timeout
                        raise m.subprocess.TimeoutExpired('identity-transition', timeout)
                    fixture.clock.now += timeout if outcome == 'late' else min(.01, timeout / 2)
                    proc.returncode = exit_code
                state['reaped'] = True
                return proc.returncode
            def send_signal(proc, sig):
                fixture.assertFalse(state['reaped'], 'handle signal after reap')
                state['signals'].append(sig)
                proc.returncode = -sig
        proc = Process()
        def spawn(_argv, **kwargs):
            self.assertTrue(kwargs['start_new_session'])
            return proc
        def missing(pid):
            self.assertEqual(pid, proc.pid)
            raise failure
        def probe(pgid, sig):
            self.assertEqual(pgid, proc.pid)
            self.assertEqual(sig, 0, 'unverified group must never be signalled')
            self.assertTrue(state['reaped'], 'group absence is checked only after reap')
            state['probes'].append(sig)
            if group_state == 'denied':
                raise PermissionError('group status unavailable')
            if group_state == 'absent' or (group_state == 'reappears' and len(state['probes']) == 1):
                raise ProcessLookupError()
        name = 'identity-transition-' + str(len(self.driver.commands))
        error = None
        with contextlib.ExitStack() as stack:
            stack.enter_context(mock.patch.object(m.subprocess, 'Popen', side_effect=spawn))
            stack.enter_context(mock.patch.object(m.os, 'getpgid', side_effect=missing if lookup == 'getpgid' else lambda pid: pid))
            stack.enter_context(mock.patch.object(m.os, 'getsid', side_effect=missing if lookup == 'getsid' else lambda pid: pid))
            stack.enter_context(mock.patch.object(m.os, 'killpg', side_effect=probe))
            stack.enter_context(mock.patch.object(self.driver, 'sample'))
            try:
                self.driver.run(name, ['identity-transition-fixture'], limit=limit)
            except BaseException as caught:
                error = caught
        self.assertTrue(proc.stdout.closed)
        self.assertEqual(state['events'][0], ('poll', None))
        return error, self.driver.commands[-1], state, failure, wait_failure

    def test_identity_esrch_then_pending_poll_then_exit_zero_is_collected(self):
        for lookup in ('getpgid', 'getsid'):
            with self.subTest(lookup=lookup):
                error, entry, state, _failure, _wait_failure = self.identity_transition(lookup=lookup)
                self.assertIsNone(error, 'ESRCH-to-reap transition must succeed')
                self.assertEqual(state['events'][:2], [('poll', None), ('wait', 1)])
                self.assertEqual(state['waits'], [1])
                self.assertEqual(state['signals'], [])
                self.assertEqual(state['probes'], [0, 0])
                self.assertEqual(entry['exit_code'], 0)
                self.assertTrue(entry['reaped'])
                self.assertTrue(entry['group_gone'])
                self.assertTrue(entry['cleanup_confirmed'])
                self.assertFalse(entry['ownership_verified'])
                self.assertEqual(entry['identity_state'], 'exited-before-identity')
                self.assertEqual(entry['expected_pgid'], entry['pid'])
                self.assertIsNone(entry['pgid'])
                self.assertIsNone(entry['sid'])
                log = self.driver.evidence / 'logs' / (entry['name'] + '.log')
                self.assertEqual(log.read_bytes(), b'identity-transition\n')

    def test_identity_transition_nonzero_exit_stays_failed(self):
        error, entry, state, _failure, _wait_failure = self.identity_transition(exit_code=7)
        self.assertIsInstance(error, RuntimeError)
        self.assertIn('Owned command failed', str(error))
        self.assertEqual(entry['exit_code'], 7)
        self.assertTrue(entry['cleanup_confirmed'])
        self.assertFalse(entry['ownership_verified'])
        self.assertEqual(state['signals'], [])

    def test_identity_transition_unsettled_child_keeps_original_error_and_handle_cleanup(self):
        for lookup in ('getpgid', 'getsid'):
            with self.subTest(lookup=lookup):
                error, entry, state, failure, _wait_failure = self.identity_transition(lookup=lookup, outcome='timeout')
                self.assertIs(error, failure)
                self.assertEqual(state['waits'], [1])
                self.assertEqual(state['signals'], [m.signal.SIGTERM])
                self.assertEqual(state['probes'], [])
                self.assertNotIn('identity_state', entry)
                self.assertTrue(entry['reaped'])
                self.assertFalse(entry['ownership_verified'])
                self.assertFalse(entry['cleanup_confirmed'])

    def test_identity_transition_wait_error_cannot_establish_identity(self):
        error, entry, state, _failure, wait_failure = self.identity_transition(outcome='error')
        self.assertIs(error, wait_failure)
        self.assertEqual(state['signals'], [m.signal.SIGTERM])
        self.assertEqual(state['probes'], [])
        self.assertNotIn('identity_state', entry)
        self.assertFalse(entry['ownership_verified'])
        self.assertFalse(entry['cleanup_confirmed'])

    def test_identity_transition_requires_absent_group_even_after_exit_zero(self):
        for group_state in ('present', 'reappears', 'denied'):
            with self.subTest(group_state=group_state):
                error, entry, state, _failure, _wait_failure = self.identity_transition(group_state=group_state)
                self.assertIsInstance(error, PermissionError if group_state == 'denied' else RuntimeError)
                self.assertTrue(entry['reaped'])
                self.assertEqual(entry['exit_code'], 0)
                self.assertFalse(entry['ownership_verified'])
                self.assertFalse(entry['group_gone'])
                self.assertFalse(entry['cleanup_confirmed'])
                self.assertEqual(state['signals'], [])
                self.assertGreaterEqual(len(state['probes']), 2)

    def test_identity_transition_wait_uses_remaining_phase_and_work_deadline(self):
        for options in ({'limit': .025}, {'start': self.budget.work_deadline - .025}):
            with self.subTest(options=options):
                error, entry, state, failure, _wait_failure = self.identity_transition(outcome='timeout', **options)
                self.assertIs(error, failure)
                self.assertEqual(len(state['waits']), 1)
                self.assertAlmostEqual(state['waits'][0], .025)
                self.assertNotIn('identity_state', entry)
                self.assertFalse(entry['cleanup_confirmed'])

    def test_identity_transition_exit_at_deadline_cannot_pass(self):
        for options, expected in (({}, RuntimeError),
                                  ({'start': self.budget.work_deadline - .025}, m.DeadlineError)):
            with self.subTest(options=options):
                error, entry, state, _failure, _wait_failure = self.identity_transition(outcome='late', **options)
                self.assertIsInstance(error, expected)
                self.assertIn('deadline', str(error))
                self.assertTrue(entry['reaped'])
                self.assertNotIn('identity_state', entry)
                self.assertEqual(state['signals'], [])
                self.assertFalse(entry['cleanup_confirmed'])

    def test_identity_transition_expired_phase_does_not_wait(self):
        error, entry, state, failure, _wait_failure = self.identity_transition(limit=0)
        self.assertIs(error, failure)
        self.assertEqual(state['waits'], [])
        self.assertEqual(state['signals'], [])
        self.assertTrue(entry['reaped'])
        self.assertNotIn('identity_state', entry)
        self.assertFalse(entry['cleanup_confirmed'])

    def early_command(self, *, lookup='getpgid', exit_code=0, identity_error=None,
                      group_state='absent', expire=False, log_cap=None):
        """Return a genuinely reaped child, keeping its real stdout pipe unread."""
        real_popen = m.subprocess.Popen
        children, probes = [], []
        marker = 'early-exit-marker'
        argv = [sys.executable, '-c',
                'import sys; print(' + repr(marker) + ', flush=True); sys.exit(' + str(exit_code) + ')']
        name = 'early-exit-' + str(len(self.driver.commands))
        def spawn(command, **kwargs):
            self.assertTrue(kwargs['start_new_session'])
            proc = real_popen(command, **kwargs)
            children.append(proc)
            try:
                self.assertEqual(proc.wait(timeout=5), exit_code)
            except BaseException:
                if proc.poll() is None:
                    proc.kill()
                proc.wait(timeout=5)
                proc.stdout.close()
                raise
            proc.send_signal = mock.Mock(side_effect=AssertionError('signal after reap'))
            return proc
        failure = identity_error if identity_error is not None else ProcessLookupError('child exited before identity')
        def missing_identity(pid):
            self.assertEqual(pid, children[0].pid)
            raise failure
        def group_probe(pgid, sig):
            probes.append((pgid, sig))
            self.assertEqual(pgid, children[0].pid)
            self.assertEqual(sig, 0, 'only a read-only group absence check is allowed after reap')
            if group_state == 'denied':
                raise PermissionError('group identity uncertain')
            if group_state == 'absent' or (group_state == 'reappears' and len(probes) == 1):
                raise ProcessLookupError()
        def sample():
            if expire:
                self.clock.now = self.budget.work_deadline
        error = None
        with contextlib.ExitStack() as stack:
            stack.enter_context(mock.patch.object(m.subprocess, 'Popen', side_effect=spawn))
            stack.enter_context(mock.patch.object(m.os, 'getpgid', side_effect=missing_identity if lookup == 'getpgid' else lambda pid: pid))
            stack.enter_context(mock.patch.object(m.os, 'getsid', side_effect=missing_identity if lookup == 'getsid' else lambda pid: pid))
            stack.enter_context(mock.patch.object(m.os, 'killpg', side_effect=group_probe))
            stack.enter_context(mock.patch.object(self.driver, 'sample', side_effect=sample))
            if log_cap is not None:
                stack.enter_context(mock.patch.object(m, 'LOG_CAP', log_cap))
            try:
                self.driver.run(name, argv, limit=1)
            except BaseException as caught:
                error = caught
        self.assertEqual(len(children), 1)
        proc = children[0]
        proc.send_signal.assert_not_called()
        self.assertTrue(proc.stdout.closed)
        self.assertTrue(all(sig == 0 for _, sig in probes))
        log = self.driver.evidence / 'logs' / (name + '.log')
        return error, self.driver.commands[-1], probes, log

    def test_real_reaped_child_before_either_identity_lookup_still_collects_output(self):
        for lookup in ('getpgid', 'getsid'):
            with self.subTest(lookup=lookup):
                error, entry, probes, log = self.early_command(lookup=lookup)
                self.assertIsNone(error)
                self.assertEqual(log.read_bytes(), b'early-exit-marker\n')
                self.assertEqual(entry['exit_code'], 0)
                self.assertTrue(entry['reaped'])
                self.assertTrue(entry['group_gone'])
                self.assertTrue(entry['cleanup_confirmed'])
                self.assertFalse(entry['ownership_verified'])
                self.assertEqual(entry['identity_state'], 'exited-before-identity')
                self.assertEqual(entry['expected_pgid'], entry['pid'])
                self.assertIsNone(entry['pgid'])
                self.assertIsNone(entry['sid'])
                self.assertTrue(probes)

    def test_real_reaped_child_with_existing_or_reused_group_cannot_pass(self):
        error, entry, probes, log = self.early_command(group_state='present')
        self.assertIsInstance(error, RuntimeError)
        self.assertIn('descendants remain', str(error))
        self.assertEqual(log.read_bytes(), b'early-exit-marker\n')
        self.assertTrue(entry['reaped'])
        self.assertFalse(entry['ownership_verified'])
        self.assertFalse(entry['group_gone'])
        self.assertFalse(entry['cleanup_confirmed'])
        self.assertTrue(probes)

    def test_real_reaped_child_nonzero_exit_remains_failure(self):
        error, entry, probes, log = self.early_command(exit_code=7)
        self.assertIsInstance(error, RuntimeError)
        self.assertEqual(entry['exit_code'], 7)
        self.assertTrue(entry['reaped'])
        self.assertTrue(entry['group_gone'])
        self.assertTrue(entry['cleanup_confirmed'])
        self.assertFalse(entry['ownership_verified'])
        self.assertEqual(log.read_bytes(), b'early-exit-marker\n')

    def test_real_reaped_child_reused_group_does_not_keep_stale_absence(self):
        error, entry, probes, _log = self.early_command(group_state='reappears')
        self.assertIsInstance(error, RuntimeError)
        self.assertIn('cleanup is unknown', str(error))
        self.assertGreaterEqual(len(probes), 2)
        self.assertTrue(entry['reaped'])
        self.assertFalse(entry['ownership_verified'])
        self.assertFalse(entry['group_gone'])
        self.assertFalse(entry['cleanup_confirmed'])

    def test_real_reaped_child_permission_or_other_identity_error_is_not_recovered(self):
        for failure in (PermissionError('identity denied'), OSError('identity unavailable')):
            with self.subTest(failure=type(failure).__name__):
                error, entry, probes, _log = self.early_command(identity_error=failure)
                self.assertIs(error, failure)
                self.assertTrue(entry['reaped'])
                self.assertFalse(entry['ownership_verified'])
                self.assertFalse(entry['cleanup_confirmed'])
                self.assertNotIn('identity_state', entry)
                self.assertEqual(probes, [])

    def test_real_reaped_child_group_permission_error_remains_uncertain(self):
        error, entry, probes, _log = self.early_command(group_state='denied')
        self.assertIsInstance(error, PermissionError)
        self.assertTrue(entry['reaped'])
        self.assertFalse(entry['group_gone'])
        self.assertFalse(entry['cleanup_confirmed'])
        self.assertIn('PermissionError', entry['cleanup_errors'])
        self.assertTrue(probes)

    def test_real_reaped_child_keeps_original_deadline_and_log_cap(self):
        for options, expected in (({'expire': True}, m.DeadlineError),
                                  ({'log_cap': 0}, RuntimeError)):
            with self.subTest(options=options):
                self.clock.now = 0
                error, entry, _probes, _log = self.early_command(**options)
                self.assertIsInstance(error, expected)
                self.assertTrue(entry['reaped'])
                self.assertTrue(entry['group_gone'])
                self.assertEqual(entry['primary_error'], expected.__name__)
                self.assertIn('Original CI deadline exhausted' if options.get('expire')
                              else 'Incremental combined log cap exceeded', str(error))

    def test_missing_identity_while_child_is_running_retains_handle_only_cleanup(self):
        failure = ProcessLookupError('identity missing but child still running')
        error, entry, state = self.fake_command(identity_error=failure)
        self.assertIs(error, failure)
        self.assertNotIn('identity_state', entry)
        self.assertFalse(entry['ownership_verified'])
        self.assertEqual(state['group_signals'], [])
        self.assertEqual(state['handle_signals'], [m.signal.SIGTERM])
        self.assertTrue(entry['reaped'])
        self.assertFalse(entry['cleanup_confirmed'])

    def test_reaped_leader_present_group_is_unknown_without_signals(self):
        error, entry, state = self.fake_command(natural=True, group_present=True)
        self.assertIsInstance(error, RuntimeError)
        self.assertTrue(entry['reaped'])
        self.assertFalse(entry['cleanup_confirmed'])
        self.assertEqual(state['group_signals'], [])

    def test_term_wait_reap_never_sends_later_kill(self):
        error, entry, state = self.fake_command(group_present=True)
        self.assertEqual(str(error), 'original phase failure')
        self.assertEqual(state['group_signals'], [m.signal.SIGTERM])
        self.assertTrue(entry['reaped'])
        self.assertFalse(entry['cleanup_confirmed'])

    def test_kill_is_allowed_only_while_leader_remains_unreaped(self):
        error, entry, state = self.fake_command(term_exits=False)
        self.assertEqual(str(error), 'original phase failure')
        self.assertEqual(state['group_signals'], [m.signal.SIGTERM, m.signal.SIGKILL])
        self.assertTrue(entry['cleanup_confirmed'])

    def test_failed_identity_setup_protects_only_returned_handle(self):
        error, entry, state = self.fake_command(identity_error=True)
        self.assertEqual(str(error), 'identity setup failed')
        self.assertEqual(state['group_signals'], [])
        self.assertEqual(state['handle_signals'], [m.signal.SIGTERM])
        self.assertTrue(entry['reaped'])
        self.assertFalse(entry['cleanup_confirmed'])

    def test_failed_selector_setup_still_cleans_owned_child(self):
        error, entry, state = self.fake_command(selector_error=True)
        self.assertEqual(str(error), 'selector setup failed')
        self.assertEqual(state['group_signals'], [m.signal.SIGTERM])
        self.assertTrue(entry['cleanup_confirmed'])

    def test_failed_selector_close_still_reaps_owned_child(self):
        error, entry, state = self.fake_command(selector_close_error=True)
        self.assertEqual(str(error), 'original phase failure')
        self.assertEqual(state['group_signals'], [m.signal.SIGTERM])
        self.assertTrue(entry['reaped'])
        self.assertTrue(entry['group_gone'])
        self.assertFalse(entry['cleanup_confirmed'])

    def test_cleanup_failure_and_deadline_do_not_replace_primary_error(self):
        error, entry, _ = self.fake_command(cleanup_wait_error=True)
        self.assertEqual(str(error), 'original phase failure')
        self.assertFalse(entry['cleanup_confirmed'])
        self.assertIn('PermissionError', entry['cleanup_errors'])

    def test_original_deadline_does_not_reset_for_cleanup(self):
        error, entry, state = self.fake_command(expire=True)
        self.assertEqual(str(error), 'original phase failure')
        self.assertFalse(entry['cleanup_confirmed'])
        self.assertEqual(state['group_signals'], [])

    def test_unconfirmed_group_after_reap_is_not_signalled(self):
        error, entry, state = self.fake_command(natural=True, group_error=True)
        self.assertIsInstance(error, PermissionError)
        self.assertTrue(entry['reaped'])
        self.assertFalse(entry['cleanup_confirmed'])
        self.assertEqual(state['group_signals'], [])

    def test_natural_exit_requires_confirmed_group_absence(self):
        error, entry, state = self.fake_command(natural=True)
        self.assertIsNone(error)
        self.assertTrue(entry['cleanup_confirmed'])
        self.assertEqual(state['group_signals'], [])

    def test_binary_copy_deadline_is_not_just_command_deadline(self):
        source = self.base / 'binary'
        source.write_bytes(b'x' * (m.BLOCK * 3))
        calls = 0
        original = self.budget.tick
        def tick(cleanup=False):
            nonlocal calls
            calls += 1
            if calls == 5:
                self.clock.now = 1681
            return original(cleanup)
        with mock.patch.object(self.budget, 'tick', side_effect=tick):
            with self.assertRaises(m.DeadlineError):
                self.driver.copy_binary(source, self.output / 'bundle/bin')

    def test_hash_deadline_checked_per_block(self):
        source = self.base / 'hash-input'
        source.write_bytes(b'x' * (m.BLOCK * 3))
        calls = 0
        original = self.budget.tick
        def tick(cleanup=False):
            nonlocal calls
            calls += 1
            if calls == 6:
                self.clock.now = 1681
            return original(cleanup)
        with mock.patch.object(self.budget, 'tick', side_effect=tick):
            with self.assertRaises(m.DeadlineError):
                self.budget.digest(source)

    def test_codec_restore_and_after_write_clock_checked(self):
        codec = self.base / 'codec.ts'
        codec.write_bytes(b'candidate')
        calls = 0
        original = self.budget.tick
        def tick(cleanup=False):
            nonlocal calls
            calls += 1
            if calls == 4:
                self.clock.now = 1681
            return original(cleanup)
        with mock.patch.object(self.budget, 'tick', side_effect=tick):
            with self.assertRaises(m.DeadlineError):
                self.driver.restore_codec(codec, b'original')
        self.assertFalse(codec.with_name('codec.ts.owned-tmp').exists())
        self.driver.restore_codec(codec, b'original', cleanup=True)
        self.assertEqual(codec.read_bytes(), b'original')

    def test_terminal_late_after_write_cannot_pass(self):
        original = self.budget.json_evidence
        def slow(path, value, cleanup=False):
            original(path, value, cleanup)
            if value.get('status') == 'pass':
                self.clock.now = 1681
        with mock.patch.object(self.budget, 'json_evidence', side_effect=slow):
            self.assertFalse(self.driver.terminal({'status': 'fail'}, True))
        self.assertEqual(json.loads((self.driver.evidence / 'terminal.json').read_text())['status'], 'fail')

    def test_terminal_readback_late_cannot_pass(self):
        original = self.budget.read
        def slow(path, cap, cleanup=False):
            data = original(path, cap, cleanup)
            if path.name == 'terminal.json' and not cleanup:
                self.clock.now = 1681
            return data
        with mock.patch.object(self.budget, 'read', side_effect=slow):
            self.assertFalse(self.driver.terminal({'status': 'fail'}, True))
        self.assertEqual(json.loads((self.driver.evidence / 'terminal.json').read_text())['status'], 'fail')

    def test_terminal_scan_late_cannot_pass(self):
        self.budget.json_evidence(self.driver.evidence / 'x.json', {'x': 1})
        original = self.driver.scan_evidence
        def scan(cleanup=False):
            original(cleanup)
            if not cleanup:
                self.clock.now = 1681
        with mock.patch.object(self.driver, 'scan_evidence', side_effect=scan):
            self.assertFalse(self.driver.terminal({'status': 'fail'}, True))
        self.assertEqual(json.loads((self.driver.evidence / 'terminal.json').read_text())['status'], 'fail')

    def test_allowed_native_json_and_failure_intent_copy_only(self):
        root = self.runtime()
        (root / 'intent.json').write_text('{"own_test_store_ids":[]}')
        (root / 'result.json').write_text('{"status":"fail"}')
        (root / 'slot1/webview').mkdir(parents=True)
        (root / 'slot1/webview/LocalStorage').write_text('PRIVATE-DO-NOT-UPLOAD')
        (root / 'other.json').write_text('{"private":true}')
        self.driver.copy_runtime_metadata('stage-a-runtime')
        uploaded = self.driver.evidence / 'stage-a-runtime'
        self.assertEqual(sorted(p.name for p in uploaded.iterdir()), ['intent.json', 'result.json'])
        self.assertNotIn('PRIVATE-DO-NOT-UPLOAD', ''.join(p.read_text() for p in uploaded.iterdir()))
        self.assertFalse(self.driver.runtime_root.is_relative_to(self.driver.evidence))

    def test_symlink_native_json_rejected(self):
        root = self.runtime()
        secret = self.base / 'private.json'
        secret.write_text('{"secret":true}')
        (root / 'intent.json').symlink_to(secret)
        with self.assertRaises(RuntimeError):
            self.driver.copy_runtime_metadata('stage-a-runtime')
        self.assertFalse((self.driver.evidence / 'stage-a-runtime/intent.json').exists())

    def test_hardlinked_native_json_rejected(self):
        root = self.runtime()
        secret = self.base / 'private.json'
        secret.write_text('{"secret":true}')
        os.link(secret, root / 'intent.json')
        with self.assertRaises(RuntimeError):
            self.driver.copy_runtime_metadata('stage-a-runtime')

    def test_symlink_runtime_parent_rejected(self):
        shutil.rmtree(self.driver.runtime_root)
        foreign = self.base / 'foreign'
        (foreign / 'stage-a-runtime').mkdir(parents=True)
        (foreign / 'stage-a-runtime/intent.json').write_text('{}')
        self.driver.runtime_root.symlink_to(foreign)
        with self.assertRaises(RuntimeError):
            self.driver.copy_runtime_metadata('stage-a-runtime')

    def test_oversized_json_rejected_before_copy(self):
        root = self.runtime()
        (root / 'intent.json').write_bytes(b' ' * (m.JSON_CAP + 1))
        with self.assertRaises(RuntimeError):
            self.driver.copy_runtime_metadata('stage-a-runtime')
        self.assertFalse((self.driver.evidence / 'stage-a-runtime/intent.json').exists())

    def test_malformed_or_nonobject_json_rejected(self):
        root = self.runtime()
        for text in ('not-json', '[1,2,3]'):
            (root / 'intent.json').write_text(text)
            with self.assertRaises((RuntimeError, ValueError)):
                self.driver.copy_runtime_metadata('stage-a-runtime')
        self.assertFalse((self.driver.evidence / 'stage-a-runtime/intent.json').exists())

    def test_cumulative_budget_rejects_before_extra_native_copy(self):
        root = self.runtime()
        (root / 'intent.json').write_text('{}')
        self.budget.evidence_total = m.EVIDENCE_CAP - 1
        with self.assertRaises(RuntimeError):
            self.driver.copy_runtime_metadata('stage-a-runtime')
        self.assertFalse((self.driver.evidence / 'stage-a-runtime/intent.json').exists())
        self.assertEqual(self.budget.evidence_total, m.EVIDENCE_CAP - 1)

    def test_log_cap_rejects_before_allocation(self):
        self.budget.log_total = m.LOG_CAP
        with self.assertRaises(RuntimeError):
            self.budget.allocate(1, log=True)
        self.assertEqual(self.budget.evidence_total, 0)

    def test_metadata_copy_deadline_checked_after_read(self):
        root = self.runtime()
        (root / 'intent.json').write_text('{}')
        original = self.budget.read
        def slow(*args, **kwargs):
            data = original(*args, **kwargs)
            self.clock.now = 1681
            return data
        with mock.patch.object(self.budget, 'read', side_effect=slow):
            with self.assertRaises(m.DeadlineError):
                self.driver.copy_runtime_metadata('stage-a-runtime')
        self.assertFalse((self.driver.evidence / 'stage-a-runtime/intent.json').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
