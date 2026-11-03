"""Runtime source evidence must remain bound to the final native package."""

import hashlib
import importlib.util
import io
import json
import posixpath
import tarfile
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/webos-runtime-sources.py"
SPEC = importlib.util.spec_from_file_location("runtime_sources", SCRIPT)
runtime = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runtime)


def write_tar(path, files, mode="w:gz"):
    with tarfile.open(path, mode) as archive:
        for name, data in files.items():
            member = tarfile.TarInfo(name)
            member.mode, member.size = 0o644, len(data)
            archive.addfile(member, io.BytesIO(data))


class CompanionFixture:
    """Tiny real source/bundle receipts; only ELF inspection is mocked."""

    def __init__(self, root):
        self.root = root.resolve()
        self.source, self.sdk = self.root / "native", self.root / "sdk"
        self.bundle, self.sources = self.root / "bundle", self.root / "sources"
        self.build_root, self.target, self.rust = (self.root / name for name in ("workspace", "target", "rust"))
        for path in (self.source, self.sdk, self.bundle, self.sources, self.build_root, self.target, self.rust):
            path.mkdir()
        self.compiler = self.sdk / "bin/arm-webos-linux-gnueabi-gcc"
        self.backend = self.compiler.with_name(self.compiler.name + ".br_real")
        self.compiler.parent.mkdir()
        self.compiler.write_bytes(b"fixture compiler")
        self.sdk_archive = self.root / "sdk.tar.bz2"
        sdk_files = {
            "lib/libgcc.a": b"gcc runtime",
            "lib/crti.o": b"glibc startup",
            "bin/arm-webos-linux-gnueabi-gcc": b"fixture compiler",
            "bin/arm-webos-linux-gnueabi-gcc.br_real": b"fixture compiler backend",
        }
        for name, data in sdk_files.items():
            path = self.sdk / name
            path.parent.mkdir(exist_ok=True)
            path.write_bytes(data)
        write_tar(self.sdk_archive, {"sdk/" + name: data for name, data in sdk_files.items()}, "w:bz2")
        self.sdk_hash = runtime.digest(self.sdk_archive)
        upstream = self.source / "ci/ottplay-integration/upstream.json"
        upstream.parent.mkdir(parents=True)
        upstream.write_bytes(
            runtime.canonical(
                {"sdk": {"directory": "sdk", "version": "fixture", "assets": {"fixture": {"sha256": self.sdk_hash}}}}
            )
        )
        self.persistent = self.target / "arm/release/deps/libhelper.rlib"
        self.ephemeral = self.target / "arm/release/deps/rustcABCD/libstd-fixture.rlib"
        self.rust_archive = self.rust / "lib/rustlib/libcore.rlib"
        for path in (self.persistent, self.ephemeral, self.rust_archive):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(path.name.encode())
        self.archives = [self.persistent, self.ephemeral, self.rust_archive, self.sdk / "lib/libgcc.a"]
        self.binary = b"\x7fELF" + b"\x00" * 48
        (self.bundle / runtime.COMPANION).write_bytes(self.binary)
        self.link_map = (
            "".join("LOAD " + str(path) + "\n" for path in self.archives)
            + str(self.sdk / "lib/libgcc.a")
            + "(_muldi3.o)\n"
            + "LOAD "
            + str(self.sdk / "lib/crti.o")
            + "\n"
        ).encode()
        self.trace = ("\n".join(map(str, self.archives)) + "\n").encode()
        self.record = {
            "schema": 1,
            "elf_sha256": hashlib.sha256(self.binary).hexdigest(),
            "map_sha256": hashlib.sha256(self.link_map).hexdigest(),
            "trace_sha256": hashlib.sha256(self.trace).hexdigest(),
            "compiler_sha256": runtime.digest(self.compiler),
            "compiler_backend_sha256": runtime.digest(self.backend),
            "archive_excluded": True,
            "build_root": str(self.build_root),
            "build_target": str(self.target),
            "rust_sysroot": str(self.rust),
            "archive_inputs_capture": "during-final-link",
            "archive_inputs": [
                {
                    "path": str(path),
                    "sha256": runtime.digest(path),
                    "bytes": path.stat().st_size,
                    "observed_at_link": True,
                    "validation": "link_time_only_ephemeral" if path == self.ephemeral else "link_time_and_current",
                }
                for path in self.archives
            ],
        }
        for suffix, data in (
            (".link.map", self.link_map),
            (".link.trace", self.trace),
            (".link.json", runtime.canonical(self.record)),
        ):
            (self.bundle / (runtime.COMPANION + suffix)).write_bytes(data)
        source_receipt = {"schema": 1, "local_inputs_sha256": "c" * 64, "local_inputs": []}
        (self.bundle / "source-receipt.json").write_bytes(runtime.canonical(source_receipt))
        write_tar(self.bundle / "local-source.tar.gz", {"source/Cargo.lock": b"fixture lock"})
        self.receipt = {
            "schema": 1,
            "package": runtime.COMPANION,
            "target": "armv7-unknown-linux-gnueabi",
            "elf": {"sha256": self.record["elf_sha256"], "bytes": len(self.binary)},
            "manifest_sha256": "d" * 64,
            "source_receipt_sha256": runtime.digest(self.bundle / "source-receipt.json"),
            "local_source_archive_sha256": runtime.digest(self.bundle / "local-source.tar.gz"),
            "local_inputs_sha256": "c" * 64,
            "link_map_sha256": self.record["map_sha256"],
            "link_trace_sha256": self.record["trace_sha256"],
            "link_receipt_sha256": runtime.digest(self.bundle / (runtime.COMPANION + ".link.json")),
            "sdk": {
                "archive_sha256": self.sdk_hash,
                "host": "fixture",
                "version": "fixture",
                "executables": {
                    "gcc": self.record["compiler_sha256"],
                    "gcc_backend": self.record["compiler_backend_sha256"],
                },
            },
        }
        (self.bundle / "receipt.json").write_bytes(runtime.canonical(self.receipt))
        linkage = {
            "elf_sha256": self.record["elf_sha256"],
            "map_sha256": self.record["map_sha256"],
            "trace_sha256": self.record["trace_sha256"],
            "receipt_sha256": self.receipt["link_receipt_sha256"],
            "trace_available": True,
            "compiler_sha256": self.record["compiler_sha256"],
            "compiler_backend_sha256": self.record["compiler_backend_sha256"],
        }
        self.source_files = {
            "local-source.tar.gz": (self.bundle / "local-source.tar.gz").read_bytes(),
            "build-receipt.json": (self.bundle / "receipt.json").read_bytes(),
            "source-receipt.json": (self.bundle / "source-receipt.json").read_bytes(),
        }
        self.manifest = {
            "schema": 1,
            "package": runtime.COMPANION,
            "target": self.receipt["target"],
            "local_inputs_sha256": "c" * 64,
            "cargo_lock_sha256": "e" * 64,
            "dependency_count": 0,
            "rust": {"toolchain": "fixture"},
            "sdk_linkage": linkage,
            "sdk_archive_sha256": self.sdk_hash,
            "files": {
                name: {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}
                for name, data in self.source_files.items()
            },
            "sdk_runtime_source_coverage": "PENDING_ENCLOSING_RELEASE",
            "complete_corresponding_source": False,
            "rebuild_validation": "NOT_RUN",
            "bit_identical_rebuild": "NOT_PROVEN",
        }
        manifest_data = runtime.canonical(self.manifest)
        (self.sources / "SOURCE-MANIFEST.json").write_bytes(manifest_data)
        write_tar(
            self.sources / "companion-source.tar.gz", {**self.source_files, "SOURCE-MANIFEST.json": manifest_data}
        )
        self.closure = {
            key: self.manifest[key]
            for key in (
                "schema",
                "local_inputs_sha256",
                "cargo_lock_sha256",
                "dependency_count",
                "rust",
                "sdk_linkage",
                "sdk_archive_sha256",
                "sdk_runtime_source_coverage",
                "complete_corresponding_source",
                "rebuild_validation",
            )
        }
        self.closure.update(
            elf_sha256=self.record["elf_sha256"],
            locked_source_coverage="PASS",
            source_receipt_sha256=self.receipt["source_receipt_sha256"],
            local_source_archive_sha256=self.receipt["local_source_archive_sha256"],
            source_manifest_sha256=runtime.digest(self.sources / "SOURCE-MANIFEST.json"),
            source_archive={
                "file": "companion-source.tar.gz",
                "sha256": runtime.digest(self.sources / "companion-source.tar.gz"),
                "bytes": (self.sources / "companion-source.tar.gz").stat().st_size,
            },
        )
        (self.sources / "source-closure.json").write_bytes(runtime.canonical(self.closure))
        self.metadata = {
            "companion": {
                key: self.receipt[key]
                for key in (
                    "manifest_sha256",
                    "source_receipt_sha256",
                    "local_source_archive_sha256",
                    "local_inputs_sha256",
                )
            }
        }
        self.metadata["companion"].update(
            elf_sha256=self.record["elf_sha256"], receipt_sha256=runtime.digest(self.bundle / "receipt.json")
        )
        (self.root / "native.ipk").write_bytes(b"fixture package")
        (self.root / "primary.tar.gz").write_bytes(b"fixture primary source")
        self.metadata.update(
            sha256=runtime.digest(self.root / "native.ipk"),
            build={"tree": "fixture"},
            corresponding_source={
                "file": "primary.tar.gz",
                "sha256": runtime.digest(self.root / "primary.tar.gz"),
                "snapshot_sha256": "f" * 64,
            },
        )
        (self.root / "native.json").write_bytes(runtime.canonical(self.metadata))
        self.args = SimpleNamespace(
            metadata=self.root / "native.json",
            source=self.source,
            sdk=self.sdk,
            sdk_archive=self.sdk_archive,
            cache=self.root,
            companion_bundle=self.bundle,
            companion_sources=self.sources,
        )
        spec = {"sdk_recipe_reference": {"revision": "fixture"}, "inputs": []}
        for source_id in ("gcc-runtime", "glibc-runtime"):
            path = self.root / (source_id + ".tar.gz")
            write_tar(path, {"source/COPYING": b"fixture license"})
            spec["inputs"].append(
                {"id": source_id, "file": path.name, "sha256": runtime.digest(path), "licenses": ["COPYING"]}
            )
        self.spec = self.root / "inputs.json"
        self.spec.write_bytes(runtime.canonical(spec))


class RuntimeSourceTests(unittest.TestCase):
    def test_observed_archive_names_parser_never_uses_host_filesystem(self):
        with (
            patch.object(Path, "resolve", side_effect=AssertionError("must be pure")),
            patch.object(Path, "is_symlink", side_effect=AssertionError("must be pure")),
        ):
            names = runtime.observed_archive_names(
                b"LOAD relative/library.a\n /build/target/libcore.rlib(core.o)\n",
                b"relative/library.a\n(/build/target/libcore.rlib)core.o\n",
            )
        self.assertEqual(names, {"relative/library.a", "/build/target/libcore.rlib"})
        self.assertEqual(
            runtime.observed_archive_names(
                iter([b"LOAD relative/library.a\n", " /build/target/libcore.rlib(core.o)\n"]),
                iter(["relative/library.a\n", b"(/build/target/libcore.rlib)core.o\n"]),
            ),
            names,
        )

    def test_glibc_and_gcc_members_have_source_owners(self):
        rows = runtime.runtime_inputs(
            "/sdk/usr/lib/libc_nonshared.a(elf-init.oS)\n/sdk/lib/libgcc.a(_muldi3.o)\n"
            "LOAD /sdk/usr/lib/crt1.o\nLOAD /sdk/lib/crtbegin.o\n",
            Path("/app"),
            Path("/sdk"),
        )
        self.assertEqual({r["source"] for r in rows}, {"gcc-runtime", "glibc-runtime"})
        self.assertEqual(len(rows), 4)

    def test_unknown_static_sdk_code_requires_review(self):
        with self.assertRaisesRegex(ValueError, "Unclassified static SDK"):
            runtime.runtime_inputs("/sdk/usr/lib/libunknown.a(runtime.o)", Path("/app"), Path("/sdk"))

    def test_unknown_static_sdk_object_requires_review(self):
        with self.assertRaisesRegex(ValueError, "Unclassified static SDK object"):
            runtime.runtime_inputs("LOAD /sdk/usr/lib/unreviewed.o", Path("/app"), Path("/sdk"))

    def test_shared_startup_object_is_identified(self):
        rows = runtime.runtime_inputs("LOAD /sdk/usr/lib/Scrt1.o", Path("/app"), Path("/sdk"))
        self.assertEqual(rows[0]["source"], "glibc-runtime")
        self.assertEqual(rows[0]["sdk_path"], "usr/lib/Scrt1.o")

    def test_linked_runtime_must_match_pinned_sdk_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            sdk = root / "sdk"
            (sdk / "lib").mkdir(parents=True)
            (sdk / "lib/libgcc.a").write_bytes(b"expected runtime")
            archive = root / "sdk.tar.bz2"
            with tarfile.open(archive, "w:bz2") as output:
                member = tarfile.TarInfo("sdk/lib/libgcc.a")
                member.size = len(b"expected runtime")
                output.addfile(member, io.BytesIO(b"expected runtime"))
            spec = {
                "sdk": {"directory": "sdk", "version": "test", "assets": {"test": {"sha256": runtime.digest(archive)}}}
            }
            source = root / "source/ci/ottplay-integration"
            source.mkdir(parents=True)
            (source / "upstream.json").write_text(json.dumps(spec))
            args = SimpleNamespace(source=root / "source", sdk=sdk, sdk_archive=archive)
            evidence = {"player": {"runtime_inputs": [{"sdk_path": "lib/libgcc.a"}]}}
            result = runtime.attest_sdk(args, evidence)
            self.assertEqual(result["runtime_archive_match"], "PASS")
            (sdk / "lib/libgcc.a").write_bytes(b"another runtime")
            with self.assertRaisesRegex(ValueError, "differs from pinned archive"):
                runtime.attest_sdk(args, evidence)

    def test_cached_source_cannot_have_another_digest(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / "source.tar.gz").write_bytes(b"modified")
            with self.assertRaisesRegex(ValueError, "digest mismatch"):
                runtime.fetch({"file": "source.tar.gz", "sha256": "0" * 64}, path)

    def evidence(self, directory, binary=b"\x7fELFfixture"):
        root = Path(directory)
        base = root / "pkg/link-evidence/stable/player"
        base.parent.mkdir(parents=True)
        link_map = b"LOAD /sdk/usr/lib/crt1.o\n/sdk/usr/lib/libc_nonshared.a(elf-init.oS)\n"
        trace = b"/sdk/usr/lib/crt1.o\n"
        record = {
            "elf_sha256": hashlib.sha256(binary).hexdigest(),
            "map_sha256": hashlib.sha256(link_map).hexdigest(),
            "trace_sha256": hashlib.sha256(trace).hexdigest(),
            "archive_excluded": True,
        }
        Path(str(base) + ".link.map").write_bytes(link_map)
        Path(str(base) + ".link.trace").write_bytes(trace)
        Path(str(base) + ".link.json").write_text(json.dumps(record))
        return root, binary

    def test_elf_changed_after_link_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _ = self.evidence(directory)
            with self.assertRaisesRegex(ValueError, "differs from shipped ELF"):
                runtime.link_evidence({"player": b"\x7fELFother"}, root, Path("/sdk"))

    def test_unknown_dynamic_dependency_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root, binary = self.evidence(directory)
            with (
                patch.object(
                    runtime.subprocess, "check_output", side_effect=["(NEEDED) Shared library: [libunknown.so.1]", ""]
                ),
                self.assertRaisesRegex(ValueError, "Unclassified runtime shared"),
            ):
                runtime.link_evidence({"player": binary}, root, Path("/sdk"))

    def test_known_runtime_evidence_retains_original_hashes(self):
        with tempfile.TemporaryDirectory() as directory:
            root, binary = self.evidence(directory)
            with patch.object(
                runtime.subprocess,
                "check_output",
                side_effect=[
                    "(NEEDED) Shared library: [libc.so.6]",
                    "[Requesting program interpreter: /lib/ld-linux.so.3]",
                ],
            ):
                result, files, system = runtime.link_evidence({"player": binary}, root, Path("/sdk"))
            self.assertEqual(system, ["libc.so.6"])
            self.assertEqual(result["player"]["elf_sha256"], hashlib.sha256(binary).hexdigest())
            self.assertIn(b"/build/webos-sdk/", files["evidence/player.link.map"])

    def test_source_set_binds_both_archives_and_includes_reusable_collector(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            metadata = root / "native.json"
            (root / "native.ipk").write_bytes(b"fixture IPK")
            (root / "primary.tar.gz").write_bytes(b"fixture primary source")
            metadata.write_text(
                json.dumps(
                    {
                        "sha256": runtime.digest(root / "native.ipk"),
                        "build": {"tree": "fixture"},
                        "corresponding_source": {
                            "file": "primary.tar.gz",
                            "sha256": runtime.digest(root / "primary.tar.gz"),
                            "snapshot_sha256": "fixture",
                        },
                    }
                )
            )
            source = root / "dependency.tar.gz"
            with tarfile.open(source, "w:gz") as archive:
                member = tarfile.TarInfo("dependency/COPYING")
                member.size = len(b"fixture license")
                archive.addfile(member, io.BytesIO(b"fixture license"))
            spec = root / "inputs.json"
            spec.write_text(
                json.dumps(
                    {
                        "sdk_recipe_reference": {"revision": "fixture"},
                        "inputs": [
                            {
                                "id": "runtime",
                                "file": source.name,
                                "sha256": runtime.digest(source),
                                "licenses": ["COPYING"],
                            }
                        ],
                    }
                )
            )
            args = SimpleNamespace(metadata=metadata, source=root, sdk=root, cache=root)
            with (
                patch.object(runtime, "MANIFEST", spec),
                patch.object(runtime, "package_elfs", return_value={}),
                patch.object(runtime, "link_evidence", return_value=({}, {}, [])),
                patch.object(runtime, "attest_sdk", return_value={}),
                patch("builtins.print"),
            ):
                runtime.collect(args)
            receipt = json.loads((root / "native-source-set.json").read_text())
            self.assertEqual(len(receipt["source_archives"]), 2)
            self.assertEqual(receipt["ipk"]["sha256"], runtime.digest(root / "native.ipk"))
            with tarfile.open(root / "native-runtime-source.tar.gz") as archive:
                self.assertIn("tools/webos-runtime-sources.README.txt", archive.getnames())
                manifest = json.load(archive.extractfile("RUNTIME-SOURCE-MANIFEST.json"))
                self.assertEqual(manifest["sdk_recipe_reference"]["revision"], "fixture")


class CompanionRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.fixture = CompanionFixture(Path(self.temporary.name))
        self.elfs = {runtime.COMPANION: self.fixture.binary}

    def inputs(self):
        f = self.fixture
        return runtime.companion_inputs(f.args, f.metadata, self.elfs)

    def inventory(self):
        f = self.fixture
        return runtime.companion_archives(f.record, f.link_map, f.trace, f.source, f.sdk)

    def test_helper_requires_both_source_and_bundle_flags(self):
        f = self.fixture
        for key in ("companion_bundle", "companion_sources"):
            old = getattr(f.args, key)
            setattr(f.args, key, None)
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "requires"):
                self.inputs()
            setattr(f.args, key, old)
        with self.assertRaisesRegex(ValueError, "metadata"):
            runtime.companion_inputs(f.args, {}, self.elfs)

    def test_flags_and_metadata_rejected_when_no_helper_is_packaged(self):
        f = self.fixture
        with self.assertRaisesRegex(ValueError, "Unexpected"):
            runtime.companion_inputs(f.args, {}, {})
        f.args.companion_bundle = f.args.companion_sources = None
        with self.assertRaisesRegex(ValueError, "Unexpected"):
            runtime.companion_inputs(f.args, f.metadata, {})
        self.assertIsNone(runtime.companion_inputs(f.args, {}, {}))

    def test_helper_bundle_and_archive_bind_to_packaged_metadata(self):
        f = self.fixture
        self.assertEqual(self.inputs()["binding"]["packaged"], f.metadata["companion"])
        f.metadata["companion"]["receipt_sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "receipt differs"):
            self.inputs()

    def test_missing_or_modified_real_trace_fails(self):
        f = self.fixture
        (f.bundle / (runtime.COMPANION + ".link.trace")).write_bytes(b"invented trace")
        with self.assertRaisesRegex(ValueError, "evidence digest"):
            self.inputs()

    def test_link_inventory_requires_backend_digest(self):
        del self.fixture.record["compiler_backend_sha256"]
        with self.assertRaisesRegex(ValueError, "receipt fields"):
            self.inventory()

    def test_changed_or_missing_backend_rejects_source_collection(self):
        f = self.fixture
        f.backend.write_bytes(b"modified backend")
        with self.assertRaisesRegex(ValueError, "compiler_backend_sha256"):
            self.inputs()
        f.backend.unlink()
        with self.assertRaises(FileNotFoundError):
            self.inputs()

    def test_sdk_attestation_binds_both_compiler_files_to_pinned_archive(self):
        f = self.fixture
        evidence = {runtime.COMPANION: dict(f.record, runtime_inputs=[{"sdk_path": "lib/libgcc.a"}])}
        result = runtime.attest_sdk(f.args, evidence)
        compiler = result["companion_compiler"]
        self.assertEqual(compiler["archive_match"], "PASS")
        self.assertEqual(compiler["compiler"]["sha256"], f.record["compiler_sha256"])
        self.assertEqual(compiler["backend"]["sha256"], f.record["compiler_backend_sha256"])
        self.assertEqual(set(result["runtime_files_sha256"]), {"lib/libgcc.a"})
        # Updating all reported disk hashes still cannot bless a backend that
        # differs from the pinned SDK archive.
        f.backend.write_bytes(b"modified backend")
        evidence[runtime.COMPANION]["compiler_backend_sha256"] = runtime.digest(f.backend)
        with self.assertRaisesRegex(ValueError, "differs from pinned archive"):
            runtime.attest_sdk(f.args, evidence)

    def test_sdk_compiler_aliases_resolve_inside_sdk(self):
        f = self.fixture
        wrapper = f.compiler.with_name("toolchain-wrapper")
        backend = f.backend.with_name("actual-backend")
        f.compiler.rename(wrapper)
        f.backend.rename(backend)
        f.compiler.symlink_to(wrapper.name)
        f.backend.symlink_to(backend.name)
        result = runtime.companion_compiler_inputs(f.sdk, f.record)
        self.assertEqual(result["compiler"]["sdk_path"], "bin/toolchain-wrapper")
        self.assertEqual(result["backend"]["sdk_path"], "bin/actual-backend")
        f.backend.unlink()
        outside = f.root / "outside-backend"
        outside.write_bytes(backend.read_bytes())
        f.backend.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, "escapes"):
            runtime.companion_compiler_inputs(f.sdk, f.record)

    def test_backend_must_exist_as_bytes_in_pinned_archive(self):
        f = self.fixture
        write_tar(
            f.sdk_archive,
            {
                "sdk/lib/libgcc.a": (f.sdk / "lib/libgcc.a").read_bytes(),
                "sdk/bin/arm-webos-linux-gnueabi-gcc": f.compiler.read_bytes(),
            },
            "w:bz2",
        )
        upstream = f.source / "ci/ottplay-integration/upstream.json"
        spec = json.loads(upstream.read_text())
        spec["sdk"]["assets"]["fixture"]["sha256"] = runtime.digest(f.sdk_archive)
        upstream.write_bytes(runtime.canonical(spec))
        evidence = {runtime.COMPANION: dict(f.record, runtime_inputs=[{"sdk_path": "lib/libgcc.a"}])}
        with self.assertRaisesRegex(ValueError, "absent from pinned archive"):
            runtime.attest_sdk(f.args, evidence)

    def test_closure_must_not_claim_completed_sdk_coverage(self):
        f = self.fixture
        f.closure["sdk_runtime_source_coverage"] = "PASS"
        (f.sources / "source-closure.json").write_bytes(runtime.canonical(f.closure))
        with self.assertRaisesRegex(ValueError, "overclaimed"):
            self.inputs()

    def test_modified_archived_source_is_rejected_despite_new_outer_hash(self):
        f = self.fixture
        files = {
            **f.source_files,
            "build-receipt.json": b"changed",
            "SOURCE-MANIFEST.json": runtime.canonical(f.manifest),
        }
        archive = f.sources / "companion-source.tar.gz"
        write_tar(archive, files)
        f.closure["source_archive"].update(sha256=runtime.digest(archive), bytes=archive.stat().st_size)
        (f.sources / "source-closure.json").write_bytes(runtime.canonical(f.closure))
        with self.assertRaisesRegex(ValueError, "differs from manifest"):
            self.inputs()

    def test_persistent_archive_is_rehashed_and_cannot_vanish(self):
        f = self.fixture
        self.inventory()
        f.persistent.write_bytes(b"modified")
        with self.assertRaisesRegex(ValueError, "archive changed"):
            self.inventory()
        f.persistent.unlink()
        with self.assertRaisesRegex(ValueError, "nonregular"):
            self.inventory()

    def test_only_recorded_rustc_temporary_rlib_may_vanish(self):
        f = self.fixture
        f.ephemeral.unlink()
        self.inventory()
        row = next(row for row in f.record["archive_inputs"] if row["path"] == str(f.ephemeral))
        row["observed_at_link"] = False
        with self.assertRaisesRegex(ValueError, "inventory"):
            self.inventory()

    def test_ephemeral_label_does_not_exempt_persistent_rlib(self):
        f = self.fixture
        row = next(row for row in f.record["archive_inputs"] if row["path"] == str(f.persistent))
        row["validation"] = "link_time_only_ephemeral"
        with self.assertRaisesRegex(ValueError, "validation scope"):
            self.inventory()

    def test_non_rlib_cannot_use_rustc_temporary_exemption(self):
        f = self.fixture
        path = str(f.ephemeral)
        other = path.removesuffix(".rlib") + ".a"
        f.link_map, f.trace = (
            f.link_map.replace(path.encode(), other.encode()),
            f.trace.replace(path.encode(), other.encode()),
        )
        next(row for row in f.record["archive_inputs"] if row["path"] == path)["path"] = other
        with self.assertRaisesRegex(ValueError, "validation scope"):
            self.inventory()

    def test_extra_and_missing_inventory_rows_fail(self):
        f = self.fixture
        removed = f.record["archive_inputs"].pop()
        with self.assertRaisesRegex(ValueError, "differs from observed"):
            self.inventory()
        f.record["archive_inputs"].extend([removed, removed])
        with self.assertRaisesRegex(ValueError, "inventory"):
            self.inventory()

    def test_archive_outside_bound_roots_fails(self):
        f = self.fixture
        path = f.root / "outside.a"
        path.write_bytes(b"fixture")
        f.link_map += ("LOAD " + str(path) + "\n").encode()
        f.trace += (str(path) + "\n").encode()
        f.record["archive_inputs"].append(
            {
                "path": str(path),
                "sha256": runtime.digest(path),
                "bytes": 7,
                "observed_at_link": True,
                "validation": "link_time_and_current",
            }
        )
        with self.assertRaisesRegex(ValueError, "outside its bound"):
            self.inventory()

    def test_relative_linker_archive_is_resolved_against_recorded_build_root(self):
        f = self.fixture
        path = f.build_root / "native/libhelper.a"
        path.parent.mkdir()
        path.write_bytes(b"fixture")
        f.link_map += b"LOAD native/libhelper.a\nnative/libhelper.a(object.o)\n"
        f.trace += b"native/libhelper.a\n"
        f.record["archive_inputs"].append(
            {
                "path": str(path),
                "sha256": runtime.digest(path),
                "bytes": 7,
                "observed_at_link": True,
                "validation": "link_time_and_current",
            }
        )
        _, allowed = self.inventory()
        rows = runtime.runtime_inputs(
            f.link_map.decode(), f.source, f.sdk, allowed_archives=allowed, archive_root=f.build_root
        )
        self.assertTrue(rows)

    def test_published_relative_target_paths_match_normalized_inventory(self):
        f = self.fixture
        link_map = f.link_map.replace(str(f.target).encode(), b"../target")
        trace = f.trace.replace(str(f.target).encode(), b"../target")
        record = dict(
            f.record, map_sha256=hashlib.sha256(link_map).hexdigest(), trace_sha256=hashlib.sha256(trace).hexdigest()
        )
        for suffix, content in (
            (".link.map", link_map),
            (".link.trace", trace),
            (".link.json", runtime.canonical(record)),
        ):
            (f.bundle / (runtime.COMPANION + suffix)).write_bytes(content)
        with patch.object(runtime.subprocess, "check_output", return_value=""):
            evidence, files, _ = runtime.link_evidence(self.elfs, f.source, f.sdk, {"bundle": f.bundle})
        entry = evidence[runtime.COMPANION]
        observed = runtime.observed_archive_names(
            files["evidence/ottplay-companion.link.map"], files["evidence/ottplay-companion.link.trace"]
        )
        names = {posixpath.normpath(posixpath.join(entry["build_root"], name)) for name in observed}
        self.assertEqual(names, {row["path"] for row in entry["archive_inputs"]})
        self.assertNotIn(b"../target", files["evidence/ottplay-companion.link.map"])

    def test_complete_collection_retains_two_archives_and_combines_sdk_evidence(self):
        f = self.fixture
        f.ephemeral.unlink()
        with (
            patch.object(runtime, "MANIFEST", f.spec),
            patch.object(runtime, "package_elfs", return_value=self.elfs),
            patch.object(
                runtime.subprocess,
                "check_output",
                side_effect=[
                    "(NEEDED) Shared library: [libc.so.6]",
                    "Requesting program interpreter: /lib/ld-linux.so.3",
                ],
            ),
            patch("builtins.print"),
        ):
            runtime.collect(f.args)
        receipt = json.loads((f.root / "native-source-set.json").read_text())
        self.assertEqual(len(receipt["source_archives"]), 2)
        with tarfile.open(f.root / "native-runtime-source.tar.gz") as archive:
            manifest = json.load(archive.extractfile("RUNTIME-SOURCE-MANIFEST.json"))
            binding = manifest["companion"]
            self.assertEqual(binding["source_closure"], f.closure)
            self.assertEqual(binding["packaged"], f.metadata["companion"])
            self.assertEqual(binding["sdk_runtime_source_coverage"], "PASS")
            self.assertEqual(binding["source_closure"]["sdk_runtime_source_coverage"], "PENDING_ENCLOSING_RELEASE")
            self.assertIn("companion/SOURCE-MANIFEST.json", archive.getnames())
            self.assertEqual(
                archive.extractfile(binding["archive"]["file"]).read(),
                (f.sources / "companion-source.tar.gz").read_bytes(),
            )
            entry = manifest["shipped_elfs"][runtime.COMPANION]
            self.assertEqual(entry["link_receipt_sha256"], f.receipt["link_receipt_sha256"])
            self.assertEqual(entry["build_root"], "/build/ottplay-companion")
            self.assertEqual(entry["build_target"], "/build/companion-target")
            self.assertEqual(entry["rust_sysroot"], "/build/companion-rust")
            self.assertNotIn(str(f.root), json.dumps(manifest))
            for suffix in ("map", "trace"):
                data = archive.extractfile("evidence/ottplay-companion.link." + suffix).read()
                self.assertNotIn(str(f.root).encode(), data)
                self.assertEqual(hashlib.sha256(data).hexdigest(), entry["distributed_" + suffix + "_sha256"])
            self.assertEqual(set(manifest["sdk_attestation"]["runtime_files_sha256"]), {"lib/libgcc.a", "lib/crti.o"})
            self.assertEqual(
                manifest["sdk_attestation"]["companion_compiler"]["backend"]["sha256"],
                f.record["compiler_backend_sha256"],
            )

    def test_sdk_attestation_failure_cannot_publish_completed_companion_coverage(self):
        f = self.fixture
        with (
            patch.object(runtime, "MANIFEST", f.spec),
            patch.object(runtime, "package_elfs", return_value=self.elfs),
            patch.object(runtime.subprocess, "check_output", return_value=""),
            patch.object(runtime, "attest_sdk", side_effect=ValueError("SDK mismatch")),
            self.assertRaisesRegex(ValueError, "SDK mismatch"),
        ):
            runtime.collect(f.args)
        self.assertFalse((f.root / "native-runtime-source.tar.gz").exists())


if __name__ == "__main__":
    unittest.main()
