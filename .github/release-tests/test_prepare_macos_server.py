"""Private preparation contracts; all host commands are mocked, never run."""
import copy
import hashlib
import json
import os
from pathlib import Path
import stat
import struct
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import macos_server_artifact as artifact
import prepare_macos_server as prep


def macho(dependency="/usr/lib/libSystem.B.dylib", minimum=(11, 0, 0), extra=b""):
    name = dependency.encode() + b"\0"
    size = (24 + len(name) + 7) // 8 * 8
    load = struct.pack("<6I", 0xC, size, 24, 0, 0, 0) + name
    load += b"\0" * (size - len(load))
    version = minimum[0] << 16 | minimum[1] << 8 | minimum[2]
    commands = struct.pack("<6I", 0x32, 24, 1, version, version, 0) + load
    commands += struct.pack("<4I", 0x1D, 16, 0, 4) + extra
    count = 3 + bool(extra)
    return struct.pack("<8I", 0xFEEDFACF, 0x0100000C, 0, 2, count, len(commands), 0, 0) + commands + b"TEST"


class PrepareMacosServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.artifacts = self.root / "artifacts"
        self.artifacts.mkdir()
        self.args = SimpleNamespace(artifacts=self.artifacts, output=self.root / "prepared",
                                    acceptance=self.root / "acceptance.json",
                                    implementation=self.root / "implementation.json",
                                    source="1" * 40, tree="2" * 40, version="1.2.3-beta.4")
        self.expected = {"source": self.args.source, "tree": self.args.tree, "target": prep.TARGET,
                         "packageVersion": self.args.version, "planSha256": "a" * 64,
                         "planDigest": "b" * 64, "runId": 100, "runAttempt": 2}
        pins = {name: "d" * 64 for name in prep.IMPLEMENTATION}
        pins["macos_server_artifact.py"] = hashlib.sha256(Path(artifact.__file__).read_bytes()).hexdigest()
        self.args.implementation.write_bytes(prep.encoded(pins))
        self.args.implementation_sha256 = prep.digest(self.args.implementation.read_bytes())
        self.pins = pins
        self.reset_artifacts()
        # No test may accidentally invoke codesign or any other process.
        self.process = mock.patch.object(prep.subprocess, "run", side_effect=AssertionError("Unexpected process"))
        self.process.start()
        self.addCleanup(self.process.stop)

    def reset_artifacts(self, binary=None):
        for path in self.artifacts.iterdir():
            path.unlink()
        binary = binary if binary is not None else macho()
        deps = (prep.STEM + ":\n\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1.0.0)\n").encode()
        def declaration(name, data):
            (self.artifacts / name).write_bytes(data)
            return {"name": name, "size": len(data), "sha256": prep.digest(data)}
        record = {"schema": 1, "kind": "macos-server-build", "releaseAccepted": False,
                  **self.expected, "binary": declaration(prep.STEM, binary),
                  "dependencies": declaration(prep.TRIO[1], deps), "build": dict(artifact.BUILD)}
        (self.artifacts / prep.TRIO[2]).write_bytes(prep.encoded(record))
        (self.artifacts / prep.STEM).chmod(0o644)
        rows = []
        for index, name in enumerate((*prep.TRIO, prep.PRODUCER, "release-manifest.json"), 1):
            raw = (self.artifacts / name).read_bytes() if name in prep.TRIO else name.encode()
            rows.append({"name": name, "id": index, "bytes": len(raw), "sha256": prep.digest(raw),
                         "method": "independent-stream-rehash"})
        by_name = {row["name"]: row for row in rows}
        self.receipt = {"status": "PASS_RELEASE_ARTIFACTS", "releaseAccepted": True, "sampleOnly": False,
                        "scope": "published artifacts, not installation", "repository": "open-ott-play/ottplay-foss",
                        "channel": prep.VERSION.fullmatch(self.args.version).group(1),
                        "tag": "v" + self.args.version, "mergeSha": self.args.source,
                        "peeledTagSha": self.args.source, "mergedTree": self.args.tree,
                        "implementationSha256": self.pins, "verifierSha256": self.pins["verify_release.py"],
                        "manifestSha256": by_name["release-manifest.json"]["sha256"],
                        "planSha256": self.expected["planDigest"], "sourcePolicySha256": "c" * 64,
                        "configSha256": "c" * 64, "evidenceArchiveSha256": "c" * 64,
                        "runId": 100, "runAttempt": 2, "releaseId": 200, "evidenceArtifactId": 300,
                        "assetCount": 5, "payloadCount": 3, "producerReceipts": 1,
                        "independentlyRehashedBytes": sum(row["bytes"] for row in rows), "payloadRehashes": [rows],
                        "planArtifact": {"id": 400, "sha256": "e" * 64, "memberBytes": 500,
                                         "rawPlanSha256": self.expected["planSha256"],
                                         "canonicalPlanDigest": self.expected["planDigest"]},
                        "macosServer": {"schema": 1, **self.expected,
                                        "producerReceipt": {"name": prep.PRODUCER, "sha256": by_name[prep.PRODUCER]["sha256"]},
                                        "files": {name: {k: by_name[name][k] for k in ("id", "bytes", "sha256")}
                                                  for name in prep.TRIO}}}
        self.save_receipt()

    def save_receipt(self):
        self.args.acceptance.write_bytes(prep.encoded(self.receipt))
        self.args.acceptance_sha256 = prep.digest(self.args.acceptance.read_bytes())

    def test_accepted_nonexecutable_download_becomes_exact_0755_candidate(self):
        original = {p.name: p.read_bytes() for p in self.artifacts.iterdir()}
        def inspect(candidate):
            self.assertEqual(candidate, self.args.output / "ottplay-server")
            self.assertEqual(candidate.read_bytes(), original[prep.STEM])
            self.assertEqual(stat.S_IMODE(candidate.stat().st_mode), 0o755)
            return {"serverExecuted": False}
        with mock.patch.object(prep, "host_checks", side_effect=inspect) as check:
            evidence = prep.prepare(self.args)
        check.assert_called_once_with(self.args.output / "ottplay-server")
        binary = self.args.output / "ottplay-server"
        self.assertEqual(binary.read_bytes(), original[prep.STEM])
        self.assertEqual(stat.S_IMODE(binary.stat().st_mode), 0o755)
        self.assertEqual(stat.S_IMODE((self.artifacts / prep.STEM).stat().st_mode), 0o644)
        self.assertEqual({p.name: p.read_bytes() for p in self.artifacts.iterdir()}, original)
        identity = json.loads((self.args.output / "identity.json").read_bytes())
        self.assertEqual(identity, {"schema": 1, "source": self.args.source, "version": self.args.version,
                                    "target": prep.TARGET, "provenance": "official-release",
                                    "binary_sha256": prep.digest(original[prep.STEM])})
        self.assertEqual(evidence["identitySha256"], prep.digest((self.args.output / "identity.json").read_bytes()))
        self.assertEqual(evidence["acceptanceSha256"], self.args.acceptance_sha256)
        self.assertEqual((self.args.output / "acceptance.json").read_bytes(), self.args.acceptance.read_bytes())
        self.assertFalse(evidence["installed"])
        self.assertIn("NOT_RUN", evidence["runtimeHealth"])

    def test_partial_forged_and_unsupported_acceptance_refused_before_host_checks(self):
        original = copy.deepcopy(self.receipt)
        changes = [("status", "PASS_SINGLE_ASSET_PROVENANCE"), ("releaseAccepted", False),
                   ("sampleOnly", True), ("scope", "sample"), ("channel", "stable"),
                   ("mergeSha", "3" * 40), ("mergedTree", "4" * 40), ("tag", "v1.2.3-beta.5"),
                   ("assetCount", 4), ("payloadRehashes", []), ("macosServer", None)]
        for key, value in changes:
            with self.subTest(key=key):
                self.receipt = copy.deepcopy(original)
                self.receipt[key] = value
                self.save_receipt()
                with mock.patch.object(prep, "host_checks") as check, self.assertRaises(ValueError):
                    prep.prepare(self.args)
                check.assert_not_called()
                self.assertFalse(self.args.output.exists())

    def test_rc_package_projection_is_distinct_from_release_identity(self):
        self.args.version = "1.2.3-rc.4"
        for package_version in ("1.2.3", "1.2.3-rc.4"):
            with self.subTest(package_version=package_version):
                self.expected["packageVersion"] = package_version
                self.reset_artifacts()
                self.args.output = self.root / ("rc-" + package_version)
                with mock.patch.object(prep, "host_checks", return_value={"serverExecuted": False}):
                    evidence = prep.prepare(self.args)
                self.assertEqual(evidence["macosServer"]["packageVersion"], package_version)
                identity = json.loads((self.args.output / "identity.json").read_bytes())
                self.assertEqual(identity["version"], "1.2.3-rc.4")
        self.expected["packageVersion"] = "1.2.4"
        self.reset_artifacts()
        self.args.output = self.root / "wrong-version"
        with self.assertRaisesRegex(ValueError, "package version contradicts"):
            prep.prepare(self.args)
        self.assertFalse(self.args.output.exists())

    def test_receipt_and_external_implementation_hashes_are_required(self):
        for field in ("acceptance_sha256", "implementation_sha256"):
            with self.subTest(field=field):
                original = getattr(self.args, field)
                setattr(self.args, field, "0" * 64)
                with self.assertRaisesRegex(ValueError, "SHA mismatch"):
                    prep.prepare(self.args)
                setattr(self.args, field, original)
        self.receipt["implementationSha256"] = dict(self.pins, **{"macos_server_artifact.py": "0" * 64})
        self.save_receipt()
        with self.assertRaisesRegex(ValueError, "implementation mismatch"):
            prep.prepare(self.args)
        self.assertFalse(self.args.output.exists())

    def test_server_section_must_match_full_payload_and_plan_provenance(self):
        original = copy.deepcopy(self.receipt)
        for field, value in (("target", "x86_64-apple-darwin"), ("source", "4" * 40),
                             ("planSha256", "0" * 64), ("planDigest", "0" * 64), ("runAttempt", 1),
                             ("producerReceipt", {"name": prep.TRIO[2], "sha256": "0" * 64}),
                             ("files", {})):
            with self.subTest(field=field):
                self.receipt = copy.deepcopy(original)
                self.receipt["macosServer"][field] = value
                self.save_receipt()
                with self.assertRaises(ValueError):
                    prep.prepare(self.args)
                self.assertFalse(self.args.output.exists())

    def test_wrong_macho_tamper_and_symlink_artifacts_refused(self):
        bad = bytearray(macho())
        struct.pack_into("<I", bad, 4, 0x01000007)
        self.reset_artifacts(bytes(bad))
        with self.assertRaisesRegex(ValueError, "ARM64"):
            prep.prepare(self.args)
        self.reset_artifacts()
        binary = self.artifacts / prep.STEM
        binary.write_bytes(binary.read_bytes() + b"changed")
        with self.assertRaises(ValueError):
            prep.prepare(self.args)
        self.reset_artifacts()
        outside = self.root / "outside"
        outside.write_bytes(binary.read_bytes())
        binary.unlink()
        binary.symlink_to(outside)
        with self.assertRaises(ValueError):
            prep.prepare(self.args)
        self.assertFalse(self.args.output.exists())

    def test_existing_output_and_symlink_parent_are_refused(self):
        self.args.output.mkdir()
        sentinel = self.args.output / "sentinel"
        sentinel.write_bytes(b"preserve")
        with self.assertRaisesRegex(ValueError, "Fresh output"):
            prep.prepare(self.args)
        self.assertEqual(sentinel.read_bytes(), b"preserve")
        alias = self.root / "alias"
        alias.symlink_to(self.root, target_is_directory=True)
        self.args.output = alias / "another"
        with self.assertRaisesRegex(ValueError, "Fresh output"):
            prep.prepare(self.args)

    def test_static_host_checks_support_shared_cache_without_running_binary(self):
        with mock.patch.object(prep.platform, "system", return_value="Darwin"), \
             mock.patch.object(prep.platform, "machine", return_value="arm64"), \
             mock.patch.object(prep.platform, "mac_ver", return_value=("14.0", (), "")), \
             mock.patch.object(prep, "in_shared_cache", return_value=True), \
             mock.patch.object(prep.subprocess, "run", return_value=SimpleNamespace(returncode=0)) as command:
            result = prep.host_checks(self.artifacts / prep.STEM)
        argv = command.call_args.args[0]
        self.assertEqual(argv, ["/usr/bin/codesign", "--verify", "--strict", str(self.artifacts / prep.STEM)])
        self.assertEqual(command.call_args.kwargs["timeout"], 15)
        self.assertEqual(command.call_args.kwargs["stdout"], subprocess.DEVNULL)
        self.assertFalse(result["serverExecuted"])
        self.assertIn("static", result["compatibility"])
        for unavailable in (False, ImportError("shared-cache inspection unavailable")):
            with self.subTest(unavailable=type(unavailable).__name__), \
                 mock.patch.object(prep.platform, "system", return_value="Darwin"), \
                 mock.patch.object(prep.platform, "machine", return_value="arm64"), \
                 mock.patch.object(prep.platform, "mac_ver", return_value=("14.0", (), "")), \
                 mock.patch.object(Path, "is_file", return_value=False), \
                 mock.patch.object(prep, "in_shared_cache") as cache, \
                 mock.patch.object(prep.subprocess, "run") as command:
                if isinstance(unavailable, BaseException):
                    cache.side_effect = unavailable
                else:
                    cache.return_value = unavailable
                with self.assertRaises((ValueError, ImportError)):
                    prep.host_checks(self.artifacts / prep.STEM)
                command.assert_not_called()

    def test_signature_failure_missing_tool_and_timeout_never_succeed(self):
        for failure in (SimpleNamespace(returncode=1), FileNotFoundError("codesign"),
                        subprocess.TimeoutExpired("codesign", 15)):
            with self.subTest(failure=type(failure).__name__), \
                 mock.patch.object(prep.platform, "system", return_value="Darwin"), \
                 mock.patch.object(prep.platform, "machine", return_value="arm64"), \
                 mock.patch.object(prep.platform, "mac_ver", return_value=("14.0", (), "")), \
                 mock.patch.object(prep, "in_shared_cache", return_value=True), \
                 mock.patch.object(prep.subprocess, "run") as command:
                if isinstance(failure, BaseException):
                    command.side_effect = failure
                else:
                    command.return_value = failure
                with self.assertRaises((ValueError, OSError, subprocess.SubprocessError)):
                    prep.host_checks(self.artifacts / prep.STEM)

    def test_non_system_dependency_rpath_and_unsupported_os_are_refused(self):
        for raw in (macho("@rpath/libexample.dylib"), macho("/opt/homebrew/lib/libexample.dylib"),
                    macho(extra=struct.pack("<4I", 0x8000001C, 16, 12, 0))):
            with self.subTest(raw=prep.digest(raw)):
                (self.artifacts / prep.STEM).write_bytes(raw)
                with self.assertRaises(ValueError):
                    prep.macho_requirements(self.artifacts / prep.STEM)
        (self.artifacts / prep.STEM).write_bytes(macho(minimum=(15, 0, 0)))
        with mock.patch.object(prep.platform, "system", return_value="Darwin"), \
             mock.patch.object(prep.platform, "machine", return_value="arm64"), \
             mock.patch.object(prep.platform, "mac_ver", return_value=("14.0", (), "")), \
             self.assertRaisesRegex(ValueError, "below binary minimum"):
            prep.host_checks(self.artifacts / prep.STEM)

    def test_changed_inputs_during_inspection_and_failed_executable_mode_refuse(self):
        def change(_):
            self.args.acceptance.write_bytes(b"{}")
            return {}
        with mock.patch.object(prep, "host_checks", side_effect=change), \
             self.assertRaisesRegex(ValueError, "inputs changed"):
            prep.prepare(self.args)
        self.assertFalse(self.args.output.exists())
        self.save_receipt()
        with mock.patch.object(prep, "host_checks", return_value={}), \
             mock.patch.object(prep.os, "fchmod", side_effect=OSError("mode denied")), \
             self.assertRaises(OSError):
            prep.prepare(self.args)
        self.assertFalse((self.args.output / "identity.json").exists())
        self.assertFalse((self.args.output / "ottplay-server").exists())


    def test_readers_refuse_fifo_symlink_and_file_replacement_at_open(self):
        real_open = os.open
        other = self.root / "other"
        other.write_bytes(macho())
        for reader in (lambda path: prep.read(path, 1024), prep.file_identity, prep.macho_requirements):
            for replacement in ("fifo", "symlink", "regular"):
                with self.subTest(reader=reader, replacement=replacement):
                    path = self.root / "race-input"
                    path.write_bytes(macho())
                    descriptors = []
                    def replace_before_open(name, flags, *args, **kwargs):
                        self.assertEqual(Path(name), path)
                        self.assertTrue(flags & os.O_NOFOLLOW)
                        self.assertTrue(flags & os.O_NONBLOCK)
                        path.rename(self.root / "prior-input")
                        if replacement == "fifo":
                            os.mkfifo(path)
                        elif replacement == "symlink":
                            path.symlink_to(other)
                        else:
                            path.write_bytes(macho())
                        descriptor = real_open(name, flags, *args, **kwargs)
                        descriptors.append(descriptor)
                        return descriptor
                    with mock.patch.object(prep.os, "open", side_effect=replace_before_open) as opened:
                        with self.assertRaises((ValueError, OSError)):
                            reader(path)
                    opened.assert_called_once()
                    for descriptor in descriptors:
                        with self.assertRaises(OSError):
                            os.fstat(descriptor)
                    path.unlink()

    def test_copy_refuses_source_replaced_by_fifo_after_initial_validation(self):
        real_open = os.open
        source = self.artifacts / prep.STEM
        swapped = False
        def replace_before_copy(name, flags, *args, **kwargs):
            nonlocal swapped
            if Path(name) == source and (self.args.output / "ottplay-server").exists():
                self.assertTrue(flags & os.O_NONBLOCK)
                source.unlink()
                os.mkfifo(source)
                swapped = True
            return real_open(name, flags, *args, **kwargs)
        with mock.patch.object(prep.os, "open", side_effect=replace_before_copy), \
             mock.patch.object(prep, "host_checks") as check:
            with self.assertRaisesRegex(ValueError, "changed while opening"):
                prep.prepare(self.args)
        self.assertTrue(swapped)
        check.assert_not_called()
        self.assertFalse(self.args.output.exists())

    def test_inspection_changes_to_candidate_retained_payload_or_pins_refuse(self):
        pins = self.args.implementation.read_bytes()
        for changed in ("candidate", "retained", "pins"):
            with self.subTest(changed=changed):
                self.reset_artifacts()
                self.args.implementation.write_bytes(pins)
                def inspect(candidate):
                    target = {"candidate": candidate, "retained": self.artifacts / prep.STEM,
                              "pins": self.args.implementation}[changed]
                    target.write_bytes(target.read_bytes() + b"changed")
                    return {}
                with mock.patch.object(prep, "host_checks", side_effect=inspect):
                    with self.assertRaises(ValueError):
                        prep.prepare(self.args)
                self.assertFalse(self.args.output.exists())

    def test_sidecar_fsync_failure_removes_all_owned_files_and_allows_retry(self):
        for fail_at in range(2, 6):  # candidate fsync is first, then four sidecars
            with self.subTest(fail_at=fail_at):
                self.args.output = self.root / ("prepared-" + str(fail_at))
                calls = 0
                def fsync(_descriptor):
                    nonlocal calls
                    calls += 1
                    if calls == fail_at:
                        raise OSError("sidecar fsync failed")
                with mock.patch.object(prep, "host_checks", return_value={}), \
                     mock.patch.object(prep.os, "fsync", side_effect=fsync):
                    with self.assertRaisesRegex(OSError, "sidecar fsync failed"):
                        prep.prepare(self.args)
                self.assertEqual(calls, fail_at)
                self.assertFalse(self.args.output.exists())
                with mock.patch.object(prep, "host_checks", return_value={}):
                    self.assertEqual(prep.prepare(self.args)["status"], "PREPARED_ACCEPTED_SERVER")

    def test_colliding_sidecar_is_never_owned_or_removed(self):
        real_open = os.open
        collision = self.args.output / "identity.json"
        def collide(name, flags, *args, **kwargs):
            if Path(name) == collision:
                collision.write_bytes(b"foreign file")
            return real_open(name, flags, *args, **kwargs)
        with mock.patch.object(prep, "host_checks", return_value={}), \
             mock.patch.object(prep.os, "open", side_effect=collide):
            with self.assertRaises(FileExistsError):
                prep.prepare(self.args)
        self.assertEqual(list(self.args.output.iterdir()), [collision])
        self.assertEqual(collision.read_bytes(), b"foreign file")


if __name__ == "__main__":
    unittest.main()
