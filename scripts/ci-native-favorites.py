"""Proposed CI-only hidden WK driver. Source tests are not native qualification."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import plistlib
import selectors
import shutil
import signal
import stat
import subprocess
import time

BASELINE = 'bfacdf28058a233148cac610848b719d702f9c4ddd95f9b5490f5538cef3e4fc'
CANDIDATE = '2535a14380b7bbc3f4c0ecff715fab7d5606f01e7299a38b8efa14a0c7bb91c9'
OLD = '                !/^https?:\\/\\/[^\\s/?#]+(?![\\s\\S])/.test(grant.origin)'
NEW = '                (grant.origin !== "tauri://localhost" &&\n                    !/^https?:\\/\\/[^\\s/?#]+(?![\\s\\S])/.test(grant.origin))'
LOG_CAP, EVIDENCE_CAP, JSON_CAP = 16 * 1024**2, 32 * 1024**2, 4 * 1024**2
GROWTH_CAP, FLOOR, BLOCK = 4 * 1024**3, 4 * 1024**3, 65536
RUNTIME_JSON = ('intent.json', 'result.json', 'capabilities-writer.json',
                'capabilities-observer.json', 'capabilities-slot2.json',
                'capabilities-slot3.json', 'capabilities-slot4.json')
MODULE_FILES = ('src/storage/favorites-physical-storage.ts', 'src/storage/index.ts',
                'src/utils/lzstring.ts', 'src/settings/favorites-operation-receipts.ts',
                'src/settings/favorites-recovery-codec.ts', 'src/commands/favorites-recovery.ts',
                'src/commands/favorites-transfer.ts')
VIEW_LABELS = ('writer', 'observer', 'slot2', 'slot3', 'slot4')


def require(value, message):
    if not value:
        raise RuntimeError(message)


class DeadlineError(RuntimeError):
    pass


class Budget:
    def __init__(self, clock=None):
        self.clock = clock or time.monotonic
        self.started = self.clock()  # Before argument parsing or any preflight IO.
        self.deadline = self.started + 1800
        self.work_deadline = self.deadline - 120
        self.evidence_total = self.log_total = 0
        self.evidence_files = {}

    def tick(self, cleanup=False):
        if self.clock() >= (self.deadline if cleanup else self.work_deadline):
            raise DeadlineError('Original CI deadline exhausted')

    def allocate(self, count, log=False, cleanup=False):
        self.tick(cleanup)
        require(count >= 0 and self.evidence_total + count <= EVIDENCE_CAP, 'Incremental evidence cap exceeded')
        if log:
            require(self.log_total + count <= LOG_CAP, 'Incremental combined log cap exceeded')
            self.log_total += count
        self.evidence_total += count
        self.tick(cleanup)

    def read(self, path, cap, cleanup=False):
        self.tick(cleanup)
        before = path.lstat()
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_size <= cap, 'Nonregular/linked/oversized input')
        flags = os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0)
        data = bytearray()
        with os.fdopen(os.open(path, flags), 'rb') as stream:
            opened = os.fstat(stream.fileno())
            require((opened.st_dev, opened.st_ino) == (before.st_dev, before.st_ino), 'Input identity changed')
            while True:
                self.tick(cleanup)
                block = stream.read(min(BLOCK, cap + 1 - len(data)))
                self.tick(cleanup)
                if not block:
                    break
                data.extend(block)
                require(len(data) <= cap, 'Input grew beyond cap')
            after = os.fstat(stream.fileno())
            require((after.st_size, after.st_mtime_ns, after.st_nlink) ==
                    (before.st_size, before.st_mtime_ns, 1), 'Input changed while reading')
        self.tick(cleanup)
        return bytes(data)

    def digest(self, path, cap=1024**3, cleanup=False):
        self.tick(cleanup)
        info = path.lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_size <= cap, 'Hash input not bounded regular file')
        digest = hashlib.sha256()
        with os.fdopen(os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0)), 'rb') as stream:
            count = 0
            while True:
                self.tick(cleanup)
                block = stream.read(BLOCK)
                self.tick(cleanup)
                if not block:
                    break
                count += len(block)
                require(count <= cap, 'Hash input exceeded cap')
                digest.update(block)
                self.tick(cleanup)
        self.tick(cleanup)
        return digest.hexdigest()

    def atomic(self, path, data, *, evidence=False, cleanup=False):
        self.tick(cleanup)
        if evidence:
            # Count all replacement/write bytes too. A retry cannot evade the quota.
            self.allocate(len(data), cleanup=cleanup)
        temporary = path.with_name(path.name + '.owned-tmp')
        require(not temporary.exists() and not temporary.is_symlink(), 'Fresh atomic temp required')
        try:
            with temporary.open('xb') as stream:
                for offset in range(0, len(data), BLOCK):
                    self.tick(cleanup)
                    stream.write(data[offset:offset + BLOCK])
                    self.tick(cleanup)
                stream.flush()
                self.tick(cleanup)
            os.replace(temporary, path)
            self.tick(cleanup)
            if evidence:
                self.evidence_files[str(path)] = len(data)
        finally:
            if temporary.exists():
                temporary.unlink()

    def json_evidence(self, path, value, cleanup=False):
        self.tick(cleanup)
        data = (json.dumps(value, indent=2) + '\n').encode()
        self.tick(cleanup)
        require(len(data) <= JSON_CAP, 'JSON evidence exceeds per-file cap')
        self.atomic(path, data, evidence=True, cleanup=cleanup)


class Driver:
    def __init__(self, root, output, budget):
        self.root, self.output, self.budget = root, output, budget
        self.evidence, self.runtime_root = output / 'evidence', output / 'runtime-stores'
        self.env = dict(os.environ)
        self.env.update(CARGO_TARGET_DIR=str(output / 'target'), CARGO_INCREMENTAL='0',
                        CARGO_PROFILE_DEV_DEBUG='0', CARGO_PROFILE_DEV_INCREMENTAL='false',
                        CARGO_BUILD_JOBS='1', PYTHONDONTWRITEBYTECODE='1')
        self.commands, self.last_resource_sample = [], 0
        budget.tick()
        (self.evidence / 'logs').mkdir(parents=True)
        self.runtime_root.mkdir()
        (output / 'tmp').mkdir()
        self.env['TMPDIR'] = str(output / 'tmp')
        budget.tick()

    def sample(self):
        self.budget.tick()
        if self.budget.clock() - self.last_resource_sample < 5:
            return
        self.last_resource_sample = self.budget.clock()
        require(shutil.disk_usage(self.output).free >= FLOOR, 'CI disk floor crossed')
        self.budget.tick()
        total, entries = 0, 0
        def scan_error(error):
            self.budget.tick()
            if not isinstance(error, FileNotFoundError):
                raise error
        for parent, dirs, files in os.walk(self.output, followlinks=False, onerror=scan_error):
            self.budget.tick()
            for name in dirs + files:
                self.budget.tick()
                entries += 1
                require(entries <= 400000, 'Resource scan entry cap exceeded')
                try:
                    total += (Path(parent) / name).lstat().st_size
                except FileNotFoundError:
                    # Compiler and WebKit temporary entries may disappear after listing.
                    # The entry still counts toward the traversal bound.
                    pass
                self.budget.tick()
                require(total <= GROWTH_CAP, 'CI attempt growth cap crossed')
        self.budget.tick()

    def run(self, name, argv, limit=1500):
        self.budget.tick()
        end = min(self.budget.clock() + limit, self.budget.work_deadline)
        proc = subprocess.Popen(argv, cwd=self.root, env=self.env, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, start_new_session=True)
        # Protect the returned handle before identity, selector or logging setup.
        entry = {'name': name, 'argv': argv, 'pid': proc.pid, 'pgid': None,
                 'sid': None, 'exit_code': None, 'reaped': False, 'group_gone': False,
                 'ownership_verified': False, 'cleanup_errors': []}
        self.commands.append(entry)
        selector = None
        primary = None
        def reaped(code):
            entry.update(exit_code=code, reaped=True)
            return code
        def observe():
            if entry['reaped']:
                return entry['exit_code']
            code = proc.poll()
            return reaped(code) if code is not None else None
        def group_gone():
            if entry['ownership_verified']:
                pgid = entry['pgid']
            elif entry.get('identity_state') == 'exited-before-identity' and entry['reaped']:
                # start_new_session establishes the expected initial group, but
                # a reaped child never grants authority to signal that number.
                # Existing/reused groups and permission errors stay unknown.
                pgid = entry['expected_pgid']
                entry['group_gone'] = False
            else:
                return False
            try:
                os.killpg(pgid, 0)
            except ProcessLookupError:
                entry['group_gone'] = True
            return entry['group_gone']
        log_path = self.evidence / 'logs' / (name + '.log')
        try:
            try:
                entry.update(pgid=os.getpgid(proc.pid), sid=os.getsid(proc.pid))
            except ProcessLookupError as error:
                if observe() is None:
                    # Identity can disappear before the first nonblocking reap.
                    # Use the existing one-second reap bound and phase deadline;
                    # an unsettled child still grants only handle cleanup.
                    self.budget.tick()
                    remaining = min(1, end - self.budget.clock())
                    if remaining <= 0:
                        raise
                    try:
                        reaped(proc.wait(timeout=remaining))
                    except subprocess.TimeoutExpired:
                        raise error from None
                    self.budget.tick()
                    require(self.budget.clock() < end, 'Owned command phase deadline exceeded')
                entry.update(identity_state='exited-before-identity', expected_pgid=proc.pid)
            else:
                require(entry['pgid'] == entry['sid'] == proc.pid, 'Owned command identity differs')
                entry['ownership_verified'] = True
            selector = selectors.DefaultSelector()
            os.set_blocking(proc.stdout.fileno(), False)
            selector.register(proc.stdout, selectors.EVENT_READ)
            self.budget.json_evidence(self.evidence / 'commands.json', self.commands)
            with log_path.open('xb') as log:
                self.budget.evidence_files[str(log_path)] = 0
                eof = False
                while not eof or observe() is None:
                    self.budget.tick()
                    require(self.budget.clock() < end, 'Owned command phase deadline exceeded')
                    self.sample()
                    for key, _ in selector.select(.2):
                        self.budget.tick()
                        data = os.read(key.fileobj.fileno(), BLOCK)
                        if not data:
                            selector.unregister(key.fileobj)
                            eof = True
                            continue
                        self.budget.allocate(len(data), log=True)
                        log.write(data)
                        self.budget.evidence_files[str(log_path)] += len(data)
                        self.budget.tick()
                code = reaped(proc.wait(timeout=max(.01, min(1, end - self.budget.clock()))))
                group_gone()
                self.budget.tick()
                require(entry['group_gone'] and code == 0, 'Owned command failed or descendants remain: ' + name)
        except BaseException as error:
            primary = error
            entry['primary_error'] = type(error).__name__
            raise
        finally:
            cleanup_error = None
            try:
                if selector is not None:
                    selector.close()
            except BaseException as error:
                cleanup_error = error
                entry['cleanup_errors'].append(type(error).__name__)
            try:
                # Reaping is monotone. Never signal a numeric group after any
                # poll/wait has reaped its leader, even if descendants remain.
                self.budget.tick(cleanup=True)
                for sig in (signal.SIGTERM, signal.SIGKILL):
                    if observe() is not None:
                        break
                    self.budget.tick(cleanup=True)
                    try:
                        if entry['ownership_verified']:
                            os.killpg(entry['pgid'], sig)
                        else:
                            # Failed identity setup grants only this unreaped
                            # Popen handle, never an unverified process group.
                            proc.send_signal(sig)
                    except ProcessLookupError:
                        pass
                    try:
                        reaped(proc.wait(timeout=max(.01, min(5, self.budget.deadline - self.budget.clock()))))
                    except subprocess.TimeoutExpired:
                        pass
                    self.budget.tick(cleanup=True)
                observe()
                group_gone()
                self.budget.tick(cleanup=True)
            except BaseException as error:
                cleanup_error = cleanup_error or error
                entry['cleanup_errors'].append(type(error).__name__)
            try:
                proc.stdout.close()
            except BaseException as error:
                cleanup_error = cleanup_error or error
                entry['cleanup_errors'].append(type(error).__name__)
            entry['cleanup_confirmed'] = entry['reaped'] and entry['group_gone'] and not entry['cleanup_errors']
            try:
                self.budget.json_evidence(self.evidence / 'commands.json', self.commands, cleanup=True)
            except BaseException as error:
                cleanup_error = cleanup_error or error
            if primary is None:
                if cleanup_error is not None:
                    raise cleanup_error
                require(entry['cleanup_confirmed'], 'Owned command cleanup is unknown: ' + name)

    def copy_binary(self, source, destination):
        self.budget.tick()
        info = source.lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_size <= 1024**3, 'Native example not bounded regular file')
        destination.parent.mkdir(parents=True, exist_ok=True)
        with os.fdopen(os.open(source, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0)), 'rb') as src:
            with destination.open('wb') as dst:
                count = 0
                while True:
                    self.budget.tick()
                    block = src.read(BLOCK)
                    self.budget.tick()
                    if not block:
                        break
                    count += len(block)
                    require(count <= 1024**3, 'Binary copy grew beyond cap')
                    dst.write(block)
                    self.budget.tick()
        destination.chmod(0o755)
        self.budget.tick()

    def generate_and_build(self, label):
        self.run(label + '-generate', ['node', 'src-tauri/examples/favorites-storage-smoke/prepare.cjs'], 60)
        self.run(label + '-build', ['cargo', 'build', '--offline', '--locked', '-p', 'ottplay-tauri',
                                  '--features', 'custom-protocol', '--example', 'favorites_storage_smoke', '--jobs', '1'])
        executable = self.output / 'FavoritesNativeQualification.app/Contents/MacOS/favorites_storage_smoke'
        self.copy_binary(self.output / 'target/debug/examples/favorites_storage_smoke', executable)
        info = {'CFBundleIdentifier': 'play.ott.favorites-native-qualification',
                'CFBundleName': 'Favorites Native Qualification', 'CFBundleExecutable': 'favorites_storage_smoke',
                'CFBundlePackageType': 'APPL', 'CFBundleShortVersionString': '0.0.0',
                'CFBundleVersion': '1', 'LSUIElement': True}
        self.budget.tick()
        info_path = executable.parent.parent / 'Info.plist'
        self.budget.atomic(info_path, plistlib.dumps(info))
        self.budget.json_evidence(self.evidence / (label + '-binary.json'), {
            'sha256': self.budget.digest(executable), 'bytes': executable.stat().st_size,
            'Info.plist_sha256': self.budget.digest(info_path)})
        self.run(label + '-arch', ['/usr/bin/lipo', '-archs', str(executable)], 15)
        return executable

    def copy_runtime_metadata(self, label, cleanup=False):
        self.budget.tick(cleanup)
        require(label in ('stage-a-runtime', 'stage-b-runtime'), 'Unknown runtime label')
        require(stat.S_ISDIR(self.runtime_root.lstat().st_mode) and not self.runtime_root.is_symlink(), 'Runtime parent is not own directory')
        runtime = self.runtime_root / label
        if not runtime.exists():
            return
        require(stat.S_ISDIR(runtime.lstat().st_mode) and not runtime.is_symlink(), 'Runtime root is not own directory')
        destination = self.evidence / label
        destination.mkdir(exist_ok=True)
        for name in RUNTIME_JSON:
            self.budget.tick(cleanup)
            source = runtime / name
            if not source.exists() and not source.is_symlink():
                continue
            raw = self.budget.read(source, JSON_CAP, cleanup)
            self.budget.tick(cleanup)
            parsed = json.loads(raw)
            require(isinstance(parsed, dict), 'Native evidence must be a JSON object')
            # Exact allowlist only; never recurse into slot*/webview or any other file.
            self.budget.atomic(destination / name, raw, evidence=True, cleanup=cleanup)
        self.budget.tick(cleanup)

    def runtime(self, label, executable, physical):
        runtime = self.runtime_root / label  # All native/store files stay OUTSIDE upload tree.
        argv = [str(executable), str(runtime)] + (['--physical-only'] if physical else [])
        try:
            self.run(label, argv, 110)
            raw = self.budget.read(runtime / 'result.json', JSON_CAP)
            report = json.loads(raw)
            self.budget.tick()
            require(report['status'] == 'pass' and report['physical_only'] is physical, 'Native stage failed')
            require(report['own_named_stores_cleaned'] is True, 'Own WK store cleanup unknown')
            require(report['visible_windows'] is False and report['user_profiles_accessed'] is False, 'Runtime isolation failed')
            require(report['module_pins']['src/settings/favorites-recovery-codec.ts'] == (BASELINE if physical else CANDIDATE), 'Actual embedded codec differs')
            require(report['module_pins'] == {name: self.budget.digest(self.root / name) for name in MODULE_FILES}, 'Actual bundled fixture modules differ')
            require(set(report['capabilities']) == set(VIEW_LABELS), 'Actual fixture view set differs')
            for value in report['capabilities'].values():
                self.budget.tick()
                require(value['origin'] == 'tauri://localhost' and value['href'] in ('tauri://localhost', 'tauri://localhost/index.html'), 'Actual native URL mismatch')
                require(all(value[k] is True for k in ('secureContext', 'storage', 'actualLocks', 'grant', 'current')), 'Actual native grant unavailable')
            self.budget.tick()
            return {'result_sha256': hashlib.sha256(raw).hexdigest(), 'stage': report['stage']}
        finally:
            # Preserve bounded failure intent/diagnostics too, within original cleanup reserve.
            self.copy_runtime_metadata(label, cleanup=True)

    def restore_codec(self, path, original, cleanup=False):
        self.budget.atomic(path, original, cleanup=cleanup)
        require(self.budget.digest(path, JSON_CAP, cleanup) == hashlib.sha256(original).hexdigest(), 'Codec restoration failed')
        self.budget.tick(cleanup)

    def scan_evidence(self, cleanup=False):
        # Explicit known set only: not a recursive walk through arbitrary output/userdata.
        total = 0
        for raw, expected in self.budget.evidence_files.items():
            self.budget.tick(cleanup)
            info = Path(raw).lstat()
            require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_size == expected, 'Evidence identity/size changed')
            total += info.st_size
            require(total <= EVIDENCE_CAP, 'Final evidence size cap exceeded')
        self.budget.tick(cleanup)

    def terminal(self, result, success):
        # An expired working clock can never produce a passing terminal, even if
        # codec restoration, serialization, atomic writing or final scan took time.
        try:
            self.budget.tick()
            require(success, 'Work was not successful')
            self.scan_evidence()
            result['status'] = 'pass'
            self.budget.json_evidence(self.evidence / 'terminal.json', result)
            self.scan_evidence()
            require(json.loads(self.budget.read(self.evidence / 'terminal.json', JSON_CAP)) == result, 'Terminal readback mismatch')
            self.budget.tick()
            return True
        except BaseException as error:
            result['status'] = 'fail'
            result['finalization_error'] = str(error)
            self.budget.json_evidence(self.evidence / 'terminal.json', result, cleanup=True)
            self.scan_evidence(cleanup=True)
            require(json.loads(self.budget.read(self.evidence / 'terminal.json', JSON_CAP, cleanup=True)) == result, 'Failed terminal readback mismatch')
            self.budget.tick(cleanup=True)
            return False


def main(argv=None, clock=None):
    budget = Budget(clock)  # Original clock starts before all preflight work.
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['physical', 'full'], required=True)
    args = parser.parse_args(argv)
    budget.tick()
    require(platform.system() == 'Darwin' and os.environ.get('GITHUB_ACTIONS') == 'true' and
            os.environ.get('RUNNER_ENVIRONMENT') == 'github-hosted', 'Disposable hosted macOS CI only')
    root = Path.cwd().resolve()
    budget.tick()
    output = Path(os.environ['RUNNER_TEMP']) / ('ottplay-favorites-' + os.environ['GITHUB_RUN_ID'] + '-' + os.environ['GITHUB_RUN_ATTEMPT'])
    require(not output.exists() and not output.is_symlink(), 'Fresh owned CI attempt required')
    budget.tick()
    require(shutil.disk_usage(output.parent).free >= FLOOR + GROWTH_CAP, 'Need4GiB growth allowance plus4GiB floor')
    budget.tick()
    output.mkdir(mode=0o700)
    budget.tick()
    driver = Driver(root, output, budget)
    codec = root / 'src/settings/favorites-recovery-codec.ts'
    original = budget.read(codec, JSON_CAP)
    require(hashlib.sha256(original).hexdigest() == (BASELINE if args.mode == 'physical' else CANDIDATE), 'Reviewed codec changed')
    baseline = original if args.mode == 'physical' else original.decode().replace(NEW, OLD).encode()
    budget.tick()
    require(hashlib.sha256(baseline).hexdigest() == BASELINE, 'Inverse delta did not reproduce exact baseline')
    result = {'status': 'fail', 'mode': args.mode, 'qualified_native_origin': False,
              'runner_disposable': True, 'user_profiles_accessed': False, 'visible_windows': False}
    success = False
    try:
        for name, command in [('os-version', ['/usr/bin/sw_vers']), ('kernel', ['/usr/bin/uname', '-a']),
                              ('rust-version', ['rustc', '-vV']), ('cargo-version', ['cargo', '-V']),
                              ('node-version', ['node', '-v']), ('sdk-version', ['/usr/bin/xcrun', '--show-sdk-version']),
                              ('webkit-version', ['/usr/libexec/PlistBuddy', '-c', 'Print :CFBundleVersion', '/System/Library/Frameworks/WebKit.framework/Resources/Info.plist'])]:
            budget.tick()
            driver.run(name, command, 15)
        require(int(platform.mac_ver()[0].split('.')[0]) >= 14, 'Named WK stores require macOS14+')
        config = json.loads(budget.read(root / 'src-tauri/examples/favorites-storage-smoke/tauri.conf.json', JSON_CAP))
        config['build']['frontendDist'] = str(root / 'src-tauri/examples/favorites-storage-smoke')
        config['bundle']['icon'] = [str(root / 'src-tauri/icons/32x32.png')]
        driver.env['TAURI_CONFIG'] = json.dumps(config)
        budget.json_evidence(driver.evidence / 'tauri-build-override.json', config)
        driver.run('compression-regression', ['node', 'tests/test_native_favorites_provider_compression.cjs'], 60)
        driver.run('dependency-fetch', ['cargo', 'fetch', '--locked'], 300)
        driver.run('cargo-metadata', ['cargo', 'metadata', '--offline', '--locked', '--format-version', '1'], 60)
        budget.atomic(codec, baseline)
        stage_a = driver.generate_and_build('stage-a')
        result['stage_a'] = driver.runtime('stage-a-runtime', stage_a, True)
        driver.restore_codec(codec, original)
        if args.mode == 'full':
            driver.run('codec-regression', ['node', 'tests/test_favorites_recovery_codec.cjs'], 60)
            driver.run('physical-regression', ['node', 'tests/test_favorites_physical_storage.cjs'], 60)
            stage_b = driver.generate_and_build('stage-b')
            result['stage_b'] = driver.runtime('stage-b-runtime', stage_b, False)
        budget.tick()
        success = True
    except BaseException as error:
        result['error'] = str(error)
    finally:
        try:
            # Success restoration must finish before the original work deadline.
            driver.restore_codec(codec, original)
        except BaseException as error:
            success = False
            result['restore_error'] = str(error)
            driver.restore_codec(codec, original, cleanup=True)
        result['commands'] = driver.commands
        result['elapsed_seconds'] = budget.clock() - budget.started
        result['external_webkit_scope'] = 'Own fixture UUIDs/disposable runner; XPC cleanup not inferred from process-group exit'
    require(driver.terminal(result, success), 'CI qualification failed or finalization exceeded original deadline')


if __name__ == '__main__':
    main()
