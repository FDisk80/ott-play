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


def write_primary(path, files=None, dependencies=(), build_environment=None):
    files = {} if files is None else files
    rows = {name: {"sha256": hashlib.sha256(data).hexdigest(), "mode": 0o644} for name, data in files.items()}
    snapshot = hashlib.sha256(json.dumps(rows, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    manifest = {"schema": 1, "files": rows, "snapshot_sha256": snapshot, "dependencies": list(dependencies)}
    if build_environment is not None:
        manifest["build_environment"] = build_environment
    write_tar(path, {**files, "SOURCE-MANIFEST.json": runtime.canonical(manifest)})
    return snapshot


def primary_inputs(root):
    recipes = (
        "Makefile",
        "rust-modules/Cargo.toml",
        "rust-modules/Cargo.lock",
        "rust-modules/build.rs",
        "rust-modules/src/lib.rs",
        "ci/check-staticlib-artifact.py",
        "ci/build-sentry-native.sh",
        "ci/build-libass.py",
    )
    files = {name: ("fixture recipe: " + name).encode() for name in recipes}
    for name, data in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    dependencies = []
    for identity, recipe in (
        ("cargo-vendor", "rust-modules/Cargo.toml"),
        ("rust-runtime", "Makefile"),
        ("sentry-native", "ci/build-sentry-native.sh"),
        *((name, "ci/build-libass.py") for name in ("libass", "freetype", "fribidi", "harfbuzz", "libunibreak")),
    ):
        name = "dependencies/" + identity + "/source.tar.gz"
        data = ("fixture source: " + identity).encode()
        files[name] = data
        dependencies.append(
            {
                "id": identity,
                "sources": [{"path": name, "sha256": hashlib.sha256(data).hexdigest()}],
                "recipes": [recipe],
                "patches": [],
            }
        )
    return files, dependencies


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
        primary_snapshot = write_primary(self.root / "primary.tar.gz")
        self.metadata.update(
            sha256=runtime.digest(self.root / "native.ipk"),
            build={"tree": "fixture"},
            corresponding_source={
                "file": "primary.tar.gz",
                "sha256": runtime.digest(self.root / "primary.tar.gz"),
                "snapshot_sha256": primary_snapshot,
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
            primary_snapshot = write_primary(root / "primary.tar.gz")
            metadata.write_text(
                json.dumps(
                    {
                        "sha256": runtime.digest(root / "native.ipk"),
                        "build": {"tree": "fixture"},
                        "corresponding_source": {
                            "file": "primary.tar.gz",
                            "sha256": runtime.digest(root / "primary.tar.gz"),
                            "snapshot_sha256": primary_snapshot,
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


class RuntimeArchiveContainmentTests(unittest.TestCase):
    """Exercise the existing classifier with real path resolution, not a linker."""

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.source = self.root / "source"
        self.sdk = self.root / "sdk"
        for path in (self.source, self.sdk, self.source / "vendor", self.source / "src"):
            path.mkdir()
        (self.source / "rust-modules").mkdir()

    def archive(self, path):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"path-classification fixture, not a linkable archive")
        return path

    def inputs(self, path, **kwargs):
        return runtime.runtime_inputs(str(path) + "(member.o)\n", self.source, self.sdk, **kwargs)

    def test_spaced_absolute_archives_keep_full_paths_and_relative_members(self):
        sdk = self.root / "sdk with spaces"
        sdk.mkdir()
        archive = self.archive(sdk / "lib/libgcc.a")
        helper = self.archive(self.root / "helper/libhelper.a")
        text = str(archive) + "(div.o) helper/libhelper.a(member.o)\n"
        try:
            rows = runtime.runtime_inputs(text, self.source, sdk, archive_root=self.root,
                                          allowed_archives={str(helper)})
        except ValueError as error:
            self.fail("Valid whole archive paths were split: " + str(error))
        self.assertEqual(rows, [{"source": "gcc-runtime", "archive_or_object": "libgcc.a",
                                 "member": "div.o", "sdk_path": "lib/libgcc.a"}])

    def test_spaced_startup_objects_keep_full_sdk_paths(self):
        sdk = self.root / "sdk with spaces"
        sdk.mkdir()
        for name, owner in (("crt1.o", "glibc-runtime"), ("Scrt1.o", "glibc-runtime"),
                            ("crti.o", "glibc-runtime"), ("crtn.o", "glibc-runtime"),
                            ("crtbeginS.o", "gcc-runtime"), ("crtendS.o", "gcc-runtime")):
            obj = self.archive(sdk / "lib" / name)
            for line in ("LOAD " + str(obj), " .text 0x100 0x10 " + str(obj), str(obj)):
                with self.subTest(name=name, line=line):
                    rows = runtime.runtime_inputs(line + "\n", self.source, sdk)
                    self.assertEqual(rows, [{"source": owner, "archive_or_object": name,
                                             "member": "", "sdk_path": "lib/" + name}])

    def test_spaced_objects_cannot_borrow_sdk_suffix_authority(self):
        outside = self.archive(self.root / "outside with spaces/lib/crti.o")
        # Even a valid SDK startup object with the same basename cannot authorize it.
        self.archive(self.sdk / "lib/crti.o")
        with self.assertRaisesRegex(ValueError, "outside the recorded SDK"):
            runtime.runtime_inputs("LOAD " + str(outside), self.source, self.sdk)
        unknown = self.archive(self.sdk / "directory with spaces/unreviewed.o")
        with self.assertRaisesRegex(ValueError, "Unclassified static SDK object"):
            runtime.runtime_inputs("LOAD " + str(unknown), self.source, self.sdk)

    def test_spaced_unknown_archives_cannot_borrow_suffix_authority(self):
        for suffix in (".a", ".rlib"):
            for location, expected in ((self.source, "Static source archive has no bundled source evidence"),
                                       (self.sdk, "Unclassified static SDK archive"),
                                       (self.root / "external", "Unclassified static archive")):
                archive = self.archive(location / ("directory with spaces/libunknown" + suffix))
                # A separately allowed suffix must not authorize the complete input.
                misleading = (self.source / ("spaces/libunknown" + suffix)).resolve()
                with self.subTest(archive=str(archive)), self.assertRaisesRegex(ValueError, expected):
                    runtime.runtime_inputs(str(archive) + "(member.o)\n", self.source, self.sdk,
                                           allowed_archives={str(misleading), str(archive)}
                                           if location != self.root / "external" else {str(misleading)})

    def test_source_sibling_prefix_does_not_authorize_archive(self):
        outside = self.archive(self.root / "source-sibling/libother.a")
        with self.assertRaisesRegex(ValueError, "Unclassified static archive"):
            self.inputs(outside)

    def test_relative_source_prefix_cannot_traverse_outside(self):
        self.archive(self.root / "outside/libother.a")
        for prefix in ("vendor", "src", "rust-modules"):
            with self.subTest(prefix=prefix), self.assertRaisesRegex(ValueError, "Unclassified static archive"):
                self.inputs(prefix + "/../../outside/libother.a")

    def test_source_symlink_to_external_archive_is_rejected(self):
        outside = self.archive(self.root / "outside/libother.a")
        link = self.source / "vendor/external"
        link.symlink_to(outside.parent, target_is_directory=True)
        for path in (link / outside.name, "vendor/external/" + outside.name):
            with self.subTest(path=str(path)), self.assertRaisesRegex(ValueError, "Unclassified static archive"):
                self.inputs(path)
        native_tail = Path("armv7-unknown-linux-gnueabi/release/libplxnative_modules.a")
        self.archive(self.root / "external-target" / native_tail)
        native_link = self.source / "rust-modules/target-release-sym"
        native_link.symlink_to(self.root / "external-target", target_is_directory=True)
        for path in (native_link / native_tail, Path("rust-modules/target-release-sym") / native_tail):
            with self.subTest(path=str(path)), self.assertRaisesRegex(ValueError, "Unclassified static archive"):
                self.inputs(path)

    def test_unknown_source_archives_do_not_gain_coverage_from_containment(self):
        local = self.archive(self.source / "vendor/liblocal.a")
        custom = self.archive(self.source / "custom/libprivate.a")
        alias = self.source / "vendor-alias"
        alias.symlink_to("vendor", target_is_directory=True)
        for path in (local, custom, "vendor/liblocal.a", "src/../vendor/liblocal.a", "vendor-alias/liblocal.a"):
            with self.subTest(path=str(path)), self.assertRaisesRegex(ValueError, "[Ss]ource archive"):
                self.inputs(path)

    def test_resolved_generated_source_archive_requires_bundled_inputs(self):
        files, dependencies = primary_inputs(self.source)
        primary = self.root / "primary.tar.gz"
        snapshot = write_primary(primary, files, dependencies)
        coverage = runtime.PrimarySourceCoverage(primary, snapshot, self.source)
        relative = Path("rust-modules/target-release-sym/armv7-unknown-linux-gnueabi/release/libplxnative_modules.a")
        native = self.archive(self.source / relative)
        alias = self.source / "rust-alias"
        alias.symlink_to("rust-modules", target_is_directory=True)
        for path in (native, relative, Path("rust-alias") / Path(*relative.parts[1:])):
            with self.subTest(path=str(path)):
                self.assertEqual(self.inputs(path, source_coverage=coverage), [])
        self.assertEqual(coverage.covered, {relative.as_posix(): ["cargo-vendor", "rust-runtime"]})

    def test_sdk_runtime_keeps_its_separate_source_owner(self):
        sdk_archive = self.archive(self.sdk / "lib/libgcc.a")
        rows = self.inputs(sdk_archive)
        self.assertEqual(
            rows,
            [
                {
                    "source": "gcc-runtime",
                    "archive_or_object": "libgcc.a",
                    "member": "member.o",
                    "sdk_path": "lib/libgcc.a",
                }
            ],
        )
        outside = self.archive(self.root / "outside/libgcc.a")
        with self.assertRaisesRegex(ValueError, "outside the recorded SDK"):
            self.inputs(outside, allowed_archives={str(outside)})
        unknown = self.archive(self.sdk / "lib/libunknown.a")
        with self.assertRaisesRegex(ValueError, "Unclassified static SDK"):
            self.inputs(unknown, allowed_archives={str(unknown)})

    def test_explicit_companion_archive_does_not_authorize_its_sibling(self):
        helper = self.archive(self.root / "helper-target/libhelper.a")
        sibling = self.archive(self.root / "helper-target-sibling/libhelper.a")
        allowed = {str(helper)}
        self.assertEqual(self.inputs(helper, allowed_archives=allowed), [])
        self.assertEqual(
            self.inputs("../helper-target/libhelper.a", archive_root=self.source, allowed_archives=allowed), []
        )
        for path, kwargs in ((helper, {}), (sibling, {"allowed_archives": allowed})):
            with (
                self.subTest(path=str(path), explicit=bool(kwargs)),
                self.assertRaisesRegex(ValueError, "Unclassified static archive"),
            ):
                self.inputs(path, **kwargs)

    def test_sdk_sibling_prefix_remains_an_independent_archive(self):
        sibling = self.archive(self.root / "sdk-sibling/libhelper.a")
        with self.assertRaisesRegex(ValueError, "Unclassified static archive"):
            self.inputs(sibling)
        self.assertEqual(self.inputs(sibling, allowed_archives={str(sibling)}), [])

    def test_sdk_object_classification_uses_resolved_containment(self):
        ordinary = self.archive(self.sdk / "lib/ordinary.o")
        sibling = self.archive(self.root / "sdk-sibling/ordinary.o")
        local = self.archive(self.source / "vendor/ordinary.o")
        alias = self.source / "vendor/sdk"
        alias.symlink_to(self.sdk, target_is_directory=True)
        for path in (ordinary, "vendor/sdk/lib/ordinary.o"):
            with self.subTest(path=str(path)), self.assertRaisesRegex(ValueError, "Unclassified static SDK object"):
                runtime.runtime_inputs("LOAD " + str(path) + "\n", self.source, self.sdk)
        for path in (sibling, local):
            with self.subTest(path=str(path)):
                self.assertEqual(runtime.runtime_inputs("LOAD " + str(path) + "\n", self.source, self.sdk), [])
        startup = self.archive(self.sdk / "lib/crtbegin.o")
        expected = [
            {"source": "gcc-runtime", "archive_or_object": "crtbegin.o", "member": "", "sdk_path": "lib/crtbegin.o"}
        ]
        for path, kwargs in (
            (startup, {}),
            ("vendor/sdk/lib/crtbegin.o", {}),
            ("lib/crtbegin.o", {"archive_root": self.sdk}),
        ):
            with self.subTest(path=str(path)):
                self.assertEqual(
                    runtime.runtime_inputs("LOAD " + str(path) + "\n", self.source, self.sdk, **kwargs), expected
                )
        outside = self.archive(self.root / "sdk-sibling/crtbegin.o")
        with self.assertRaisesRegex(ValueError, "outside the recorded SDK"):
            runtime.runtime_inputs("LOAD " + str(outside) + "\n", self.source, self.sdk)


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

    def test_companion_inventory_does_not_authorize_unclassified_native_source_archive(self):
        f = self.fixture
        path = f.source / "custom/libunknown.a"
        path.parent.mkdir()
        path.write_bytes(b"fixture")
        f.link_map += ("LOAD " + str(path) + "\n" + str(path) + "(object.o)\n").encode()
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
        _, allowed = self.inventory()
        self.assertIn(str(path), allowed)  # Real byte-bound inventory admits this source-root member.
        coverage = runtime.PrimarySourceCoverage(
            f.root / "primary.tar.gz", f.metadata["corresponding_source"]["snapshot_sha256"], f.source
        )
        with self.assertRaisesRegex(ValueError, "Unclassified static source archive"):
            runtime.runtime_inputs(
                f.link_map.decode(),
                f.source,
                f.sdk,
                allowed_archives=allowed,
                archive_root=f.build_root,
                source_coverage=coverage,
            )

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


class PrimaryArchiveCoverageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.source = self.root / "source"
        self.files, self.dependencies = primary_inputs(self.source)
        self.primary = self.root / "primary.tar.gz"

    def coverage(self, files=None, dependencies=None, native_archive=None):
        snapshot = write_primary(
            self.primary,
            self.files if files is None else files,
            self.dependencies if dependencies is None else dependencies,
        )
        return runtime.PrimarySourceCoverage(self.primary, snapshot, self.source, native_archive)

    def classify(self, name, coverage):
        path = self.source / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"generated archive fixture")
        return runtime.runtime_inputs(
            str(path) + "(member.o)", self.source, self.root / "sdk", source_coverage=coverage
        )

    def test_every_supported_generated_archive_has_a_bundled_owner(self):
        coverage = self.coverage()
        names = [
            "vendor/libass-prefix/lib/lib" + item + ".a"
            for item in ("ass", "unibreak", "freetype", "fribidi", "harfbuzz")
        ]
        names += [
            "vendor/sentry-native-prefix/lib/" + item for item in ("libsentry.a", "libunwind.a", "libunwind_remote.a")
        ]
        names += [
            "vendor/sentry-native-build/vendor/libunwind/" + item for item in ("libunwind.a", "libunwind_remote.a")
        ]
        for name in names:
            with self.subTest(name=name):
                self.assertEqual(self.classify(name, coverage), [])
        self.assertEqual(set(coverage.covered), set(names))

    def test_unknown_archive_rejected_even_if_binary_itself_is_in_source_tar(self):
        name = "custom/libprivate.a"
        coverage = self.coverage(files={**self.files, name: b"generated archive fixture"})
        with self.assertRaisesRegex(ValueError, "Unclassified static source archive"):
            self.classify(name, coverage)

    def test_known_path_without_dependency_or_with_changed_recipe_is_rejected(self):
        without = [row for row in self.dependencies if row["id"] != "sentry-native"]
        with self.assertRaisesRegex(ValueError, "Missing bundled archive dependency"):
            self.classify("vendor/sentry-native-prefix/lib/libsentry.a", self.coverage(dependencies=without))
        coverage = self.coverage()
        (self.source / "ci/build-sentry-native.sh").write_bytes(b"changed recipe")
        with self.assertRaisesRegex(ValueError, "changed bundled archive recipe"):
            self.classify("vendor/sentry-native-prefix/lib/libsentry.a", coverage)

    def test_missing_dependency_member_and_wrong_digest_are_rejected(self):
        name = self.dependencies[0]["sources"][0]["path"]
        for files in ({k: v for k, v in self.files.items() if k != name}, {**self.files, name: b"tampered"}):
            with self.subTest(files=len(files)):
                coverage = self.coverage(files=files)
                with self.assertRaisesRegex(ValueError, "Missing bundled archive dependency bytes"):
                    self.classify(
                        "rust-modules/target-release/armv7-unknown-linux-gnueabi/release/libplxnative_modules.a",
                        coverage,
                    )

    def test_archive_members_must_equal_manifest_and_expected_snapshot(self):
        snapshot = write_primary(self.primary, self.files, self.dependencies)
        with tarfile.open(self.primary) as source:
            manifest = source.extractfile("SOURCE-MANIFEST.json").read()
        write_tar(self.primary, {**self.files, "Makefile": b"tampered", "SOURCE-MANIFEST.json": manifest})
        with self.assertRaisesRegex(ValueError, "file set/hash/mode mismatch"):
            runtime.PrimarySourceCoverage(self.primary, snapshot, self.source)
        write_primary(self.primary, self.files, self.dependencies)
        with self.assertRaisesRegex(ValueError, "snapshot mismatch"):
            runtime.PrimarySourceCoverage(self.primary, "0" * 64, self.source)

    def test_native_archive_cannot_differ_from_compilation_record(self):
        name = "rust-modules/target-release/armv7-unknown-linux-gnueabi/release/libplxnative_modules.a"
        record = {"path": name, "sha256": hashlib.sha256(b"generated archive fixture").hexdigest()}
        self.assertEqual(self.classify(name, self.coverage(native_archive=record)), [])
        for wrong in ({**record, "sha256": "0" * 64}, {**record, "path": "other.a"}):
            with self.subTest(wrong=wrong), self.assertRaisesRegex(ValueError, "compilation evidence"):
                self.classify(name, self.coverage(native_archive=wrong))

    def test_load_and_trace_only_archives_cannot_escape_classification(self):
        for text in ("LOAD custom/libprivate.a\n", "custom/libprivate.a\n"):
            with self.subTest(text=text), self.assertRaisesRegex(ValueError, "Unclassified static source archive"):
                runtime.runtime_inputs(text, self.source, self.root / "sdk", source_coverage=self.coverage())

    def test_real_collector_cannot_publish_pass_for_unknown_archive(self):
        snapshot = write_primary(self.primary, self.files, self.dependencies)
        binary = b"\x7fELFfixture"
        link_map = b"LOAD custom/libprivate.a\ncustom/libprivate.a(member.o)\n"
        trace = b"custom/libprivate.a\n"
        base = self.source / "pkg/link-evidence/stable/player"
        base.parent.mkdir(parents=True)
        record = {
            "archive_excluded": True,
            "elf_sha256": hashlib.sha256(binary).hexdigest(),
            "map_sha256": hashlib.sha256(link_map).hexdigest(),
            "trace_sha256": hashlib.sha256(trace).hexdigest(),
        }
        for suffix, data in (
            (".link.map", link_map),
            (".link.trace", trace),
            (".link.json", runtime.canonical(record)),
        ):
            Path(str(base) + suffix).write_bytes(data)
        ipk = self.root / "native.ipk"
        ipk.write_bytes(b"fixture package")
        metadata = self.root / "native.json"
        metadata.write_bytes(
            runtime.canonical(
                {
                    "sha256": runtime.digest(ipk),
                    "build": {},
                    "corresponding_source": {
                        "file": self.primary.name,
                        "sha256": runtime.digest(self.primary),
                        "snapshot_sha256": snapshot,
                    },
                }
            )
        )
        spec = self.root / "inputs.json"
        spec.write_bytes(runtime.canonical({"inputs": [], "sdk_recipe_reference": {}}))
        args = SimpleNamespace(metadata=metadata, source=self.source, sdk=self.root / "sdk", cache=self.root)
        with (
            patch.object(runtime, "MANIFEST", spec),
            patch.object(runtime, "package_elfs", return_value={"player": binary}),
            patch.object(runtime.subprocess, "check_output", return_value=""),
            patch.object(runtime, "attest_sdk", return_value={}),
            self.assertRaisesRegex(ValueError, "Unclassified static source archive"),
        ):
            runtime.collect(args)
        self.assertFalse((self.root / "native-source-set.json").exists())
        self.assertFalse((self.root / "native-runtime-source.tar.gz").exists())

    def test_sentry_relative_inputs_are_resolved_from_its_actual_cmake_build(self):
        binary = b"\x7fELFfixture"
        name = "vendor/libunwind/libunwind_remote.a"
        link_map = ("LOAD " + name + "\n" + name + "(member.o)\n").encode()
        trace = (name + "\n").encode()
        base = self.source / "pkg/link-evidence/stable/sentry-crash"
        base.parent.mkdir(parents=True)
        for suffix, data in (
            (".link.map", link_map),
            (".link.trace", trace),
            (
                ".link.json",
                runtime.canonical(
                    {
                        "archive_excluded": True,
                        "elf_sha256": hashlib.sha256(binary).hexdigest(),
                        "map_sha256": hashlib.sha256(link_map).hexdigest(),
                        "trace_sha256": hashlib.sha256(trace).hexdigest(),
                    }
                ),
            ),
        ):
            Path(str(base) + suffix).write_bytes(data)
        coverage = self.coverage()
        with patch.object(runtime.subprocess, "check_output", return_value=""):
            _, files, _ = runtime.link_evidence(
                {"sentry-crash": binary}, self.source, self.root / "sdk", source_coverage=coverage
            )
        self.assertEqual(coverage.covered, {"vendor/sentry-native-build/" + name: ["sentry-native"]})
        self.assertIn(
            b"/build/ottplay-native/vendor/sentry-native-build/" + name.encode(),
            files["evidence/sentry-crash.link.map"],
        )


class RlibCoverageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.source, self.sdk = self.root / "source", self.root / "sdk"
        self.source.mkdir()
        self.sdk.mkdir()
        self.files, self.dependencies = primary_inputs(self.source)
        self.pin = "1.99.1"
        self.commit = "a" * 40
        self.identity = ("rustc 1.99.1 (aaaaaaaaa 2026-09-01)\n"
                         "binary: rustc\ncommit-hash: " + self.commit + "\n"
                         "host: aarch64-unknown-linux-gnu\nrelease: 1.99.1\nLLVM version: 23.1.0\n")
        self.environment = {"rustc": self.identity, "rust_target": "armv7-unknown-linux-gnueabi"}
        self.pin_name = "rust-modules/rust-toolchain.toml"
        self.files[self.pin_name] = b'[toolchain]\nchannel = "1.99.1"\n'
        (self.source / self.pin_name).write_bytes(self.files[self.pin_name])
        next(row for row in self.dependencies if row["id"] == "rust-runtime")["version"] = self.commit
        self.sysroot = self.root / "rust"
        self.builtins = self.sysroot / "lib/rustlib/armv7-unknown-linux-gnueabi/lib/libcompiler_builtins-0123456789abcdef.rlib"
        self.builtins.parent.mkdir(parents=True)
        self.builtins.write_bytes(b"fixture prebuilt compiler builtins")
        self.probes = []

    def coverage(self):
        path = self.root / "primary.tar.gz"
        snapshot = write_primary(path, self.files, self.dependencies, self.environment)
        return runtime.PrimarySourceCoverage(path, snapshot, self.source)

    def probe(self, args, **kwargs):
        if args[0] != "rustc":
            return ""  # The tests exercise the real linker-evidence path; ELF inspection is mocked.
        self.probes.append((args, kwargs))
        self.assertEqual(args[1], "+" + self.pin)
        self.assertEqual(kwargs["env"]["RUSTUP_AUTO_INSTALL"], "0")
        self.assertGreater(kwargs["timeout"], 0)
        self.assertLessEqual(kwargs["timeout"], 15)
        if args[2:] == ["-Vv"]:
            return self.identity
        self.assertEqual(args[2:], ["--print", "sysroot"])
        return str(self.sysroot) + "\n"

    def link(self, path, coverage):
        binary = b"\x7fELFfixture"
        link_map = ("LOAD " + str(path) + "\n" + str(path) + "(member.o)\n").encode()
        trace = (str(path) + "\n").encode()
        base = self.source / "pkg/link-evidence/stable/plxnative-storage"
        base.parent.mkdir(parents=True, exist_ok=True)
        record = {"archive_excluded": True, "elf_sha256": hashlib.sha256(binary).hexdigest(),
                  "map_sha256": hashlib.sha256(link_map).hexdigest(),
                  "trace_sha256": hashlib.sha256(trace).hexdigest()}
        for suffix, data in ((".link.map", link_map), (".link.trace", trace),
                             (".link.json", runtime.canonical(record))):
            Path(str(base) + suffix).write_bytes(data)
        with patch.object(runtime.subprocess, "check_output", side_effect=self.probe):
            return runtime.link_evidence({"plxnative-storage": binary}, self.source, self.sdk,
                                         source_coverage=coverage)

    def test_collector_accepts_bound_builtins_in_spaced_sysroot_without_suffix(self):
        spaced = self.root / "rust toolchain"
        self.sysroot.rename(spaced)
        relative = self.builtins.relative_to(self.sysroot)
        self.sysroot, self.builtins = spaced, spaced / relative
        try:
            result, files, _ = self.link(self.builtins, self.coverage())
        except ValueError as error:
            self.fail("Bound compiler builtins path was split: " + str(error))
        binding = result["plxnative-storage"]["native_rust_runtime"]
        self.assertEqual(binding["archives"][0]["path"], "/build/native-rust/" + relative.as_posix())
        self.assertEqual(binding["archives"][0]["sha256"], runtime.digest(self.builtins))
        self.assertEqual(binding["archives"][0]["validation"], "collection-time")
        self.assertEqual(len(binding["archives"]), 1)
        self.assertEqual(len(self.probes), 2)
        self.assertNotIn(str(self.root).encode(), files["evidence/plxnative-storage.link.map"])

    def test_native_rlib_all_linker_forms_require_source_owner(self):
        path = self.source / "custom/libunknown.rlib"
        path.parent.mkdir()
        path.write_bytes(b"unclassified archive")
        forms = ["LOAD custom/libunknown.rlib\n", "custom/libunknown.rlib\n",
                 "custom/libunknown.rlib(member.o)\n", str(path) + "(member.o)\n",
                 "(" + str(path) + ")member.o\n"]
        for text in forms:
            with self.subTest(text=text), self.assertRaisesRegex(ValueError, "Unclassified static source archive"):
                runtime.runtime_inputs(text, self.source, self.sdk, source_coverage=self.coverage())

    def test_sdk_and_unbound_external_rlibs_are_not_silently_ignored(self):
        for path, expected in ((self.sdk / "libunknown.rlib", "Unclassified static SDK archive"),
                               (self.root / "external/libunknown.rlib", "Unclassified static archive"),
                               (self.builtins, "Unclassified static archive")):
            for text in ("LOAD " + str(path) + "\n", str(path) + "(member.o)\n"):
                with self.subTest(path=str(path), text=text), self.assertRaisesRegex(ValueError, expected):
                    runtime.runtime_inputs(text, self.source, self.sdk)
        with self.assertRaisesRegex(ValueError, "Unclassified static SDK archive"):
            runtime.runtime_inputs("LOAD " + str(self.sdk / "libunknown.rlib"), self.source, self.sdk,
                                   allowed_archives={str(self.sdk / "libunknown.rlib")})

    def test_companion_rlibs_use_exact_inventory_without_rust_probes(self):
        (self.root / "companion").mkdir()
        f = CompanionFixture(self.root / "companion")
        f.ephemeral.unlink()
        roots, allowed = runtime.companion_archives(f.record, f.link_map, f.trace, f.source, f.sdk)
        with patch.object(runtime.subprocess, "check_output", side_effect=AssertionError("no probe in classifier")):
            rows = runtime.runtime_inputs((f.link_map + f.trace).decode(), f.source, f.sdk,
                                          allowed_archives=allowed, archive_root=roots["build_root"])
        self.assertEqual({row["source"] for row in rows}, {"gcc-runtime", "glibc-runtime"})
        coverage = runtime.PrimarySourceCoverage(f.root / "primary.tar.gz",
                                                f.metadata["corresponding_source"]["snapshot_sha256"], f.source)
        path = f.persistent.with_name("libunrecorded.rlib")
        with self.assertRaisesRegex(ValueError, "Unclassified static archive"):
            runtime.runtime_inputs("LOAD " + str(path), f.source, f.sdk, allowed_archives=allowed)
        # A real byte-bound companion inventory cannot bypass native-source ownership.
        path = f.source / "custom/libunknown.rlib"
        path.parent.mkdir()
        path.write_bytes(b"native unknown")
        f.link_map += ("LOAD " + str(path) + "\n").encode()
        f.trace += (str(path) + "\n").encode()
        f.record["archive_inputs"].append({"path": str(path), "sha256": runtime.digest(path),
                                           "bytes": path.stat().st_size, "observed_at_link": True,
                                           "validation": "link_time_and_current"})
        _, allowed = runtime.companion_archives(f.record, f.link_map, f.trace, f.source, f.sdk)
        self.assertIn(str(path), allowed)
        with self.assertRaisesRegex(ValueError, "Unclassified static source archive"):
            runtime.runtime_inputs((f.link_map + f.trace).decode(), f.source, f.sdk,
                                   allowed_archives=allowed, source_coverage=coverage)

    def test_collector_binds_prebuilt_builtins_to_exact_bundled_toolchain(self):
        result, _, _ = self.link(self.builtins, self.coverage())
        entry = result["plxnative-storage"]
        self.assertIn("native_rust_runtime", entry)
        binding = entry["native_rust_runtime"]
        self.assertEqual(binding["source"], "rust-runtime")
        self.assertEqual(binding["source_commit"], self.commit)
        self.assertEqual(binding["rustc"], self.identity.strip())
        self.assertEqual(binding["archives"], [{"path": "/build/native-rust/" + self.builtins.relative_to(self.sysroot).as_posix(),
                                               "sha256": runtime.digest(self.builtins), "bytes": self.builtins.stat().st_size,
                                               "validation": "collection-time"}])
        self.assertEqual(len(self.probes), 2)

    def test_collector_rejects_changed_toolchain_source_pin_and_unknown_rlib(self):
        for case in ("compiler", "source-commit", "pin", "missing-source", "wrong-target", "unknown-name", "wrong-root"):
            with self.subTest(case=case):
                original_identity = self.identity
                original_files = dict(self.files)
                original_dependencies = json.loads(json.dumps(self.dependencies))
                original_environment = dict(self.environment)
                path = self.builtins
                if case == "compiler":
                    self.identity = self.identity.replace("LLVM version: 23.1.0", "LLVM version: altered")
                elif case == "source-commit":
                    next(row for row in self.dependencies if row["id"] == "rust-runtime")["version"] = "b" * 40
                elif case == "pin":
                    (self.source / self.pin_name).write_bytes(b'[toolchain]\nchannel = "other"\n')
                elif case == "missing-source":
                    self.files.pop(next(row for row in self.dependencies if row["id"] == "rust-runtime")["sources"][0]["path"])
                elif case == "wrong-target":
                    self.environment["rust_target"] = "aarch64-unknown-linux-gnu"
                else:
                    path = self.builtins.with_name("libunknown.rlib") if case == "unknown-name" else self.root / self.builtins.name
                    path.write_bytes(b"unclassified archive")
                try:
                    with self.assertRaisesRegex(ValueError, "[Rr]ust|[Aa]rchive|[Rr]ecipe|[Ss]ource|[Tt]oolchain"):
                        self.link(path, self.coverage())
                finally:
                    self.identity, self.files = original_identity, original_files
                    self.dependencies, self.environment = original_dependencies, original_environment
                    (self.source / self.pin_name).write_bytes(self.files[self.pin_name])

    def test_real_collector_cannot_publish_pass_for_native_rlib(self):
        (self.root / "companion").mkdir()
        f = CompanionFixture(self.root / "companion")
        f.args.companion_bundle = f.args.companion_sources = None
        f.metadata.pop("companion")
        f.args.metadata.write_bytes(runtime.canonical(f.metadata))
        link_map = b"LOAD custom/libunknown.rlib\ncustom/libunknown.rlib(member.o)\n"
        trace = b"custom/libunknown.rlib\n"
        base = f.source / "pkg/link-evidence/stable/player"
        base.parent.mkdir(parents=True)
        record = {"archive_excluded": True, "elf_sha256": hashlib.sha256(f.binary).hexdigest(),
                  "map_sha256": hashlib.sha256(link_map).hexdigest(), "trace_sha256": hashlib.sha256(trace).hexdigest()}
        for suffix, data in ((".link.map", link_map), (".link.trace", trace), (".link.json", runtime.canonical(record))):
            Path(str(base) + suffix).write_bytes(data)
        with (patch.object(runtime, "MANIFEST", f.spec),
              patch.object(runtime, "package_elfs", return_value={"player": f.binary}),
              patch.object(runtime.subprocess, "check_output", return_value=""),
              patch.object(runtime, "attest_sdk", return_value={}),
              self.assertRaisesRegex(ValueError, "Unclassified static source archive")):
            runtime.collect(f.args)
        self.assertFalse((f.root / "native-source-set.json").exists())

    def test_failed_or_timed_out_rust_probe_cannot_authorize_archive(self):
        def unavailable(args, **kwargs):
            if args[0] == "rustc":
                raise runtime.subprocess.TimeoutExpired(args, kwargs["timeout"])
            return ""

        original = self.probe
        self.probe = unavailable
        try:
            with self.assertRaisesRegex(ValueError, "Rust toolchain probe timed out"):
                self.link(self.builtins, self.coverage())
        finally:
            self.probe = original

    def test_native_rust_alias_cannot_leak_an_unbound_path_into_public_evidence(self):
        leaf = self.root / "private-alias" / self.builtins.name
        leaf.parent.mkdir()
        leaf.symlink_to(self.builtins)
        directory = self.root / "private-directory-alias"
        directory.symlink_to(self.builtins.parent, target_is_directory=True)
        lexical = self.root / "private-segment" / ".." / self.builtins.relative_to(self.root)
        for alias in (leaf, directory / self.builtins.name, lexical):
            with self.subTest(alias=str(alias)), self.assertRaisesRegex(ValueError, "archive path"):
                self.link(alias, self.coverage())


if __name__ == "__main__":
    unittest.main()
