import importlib.util
import json
import os
import shlex
import shutil
import struct
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

LOADER = importlib.util.spec_from_file_location("webos_companion_build", Path(__file__).with_name("build.py"))
build = importlib.util.module_from_spec(LOADER)
LOADER.loader.exec_module(build)
FLAGS_LOADER = importlib.util.spec_from_file_location("webos_companion_flags", build.ROOT / "src-rs/companion/build-webos.py")
flags = importlib.util.module_from_spec(FLAGS_LOADER)
with patch.dict(sys.modules, {"webos_link": build.linker}):
    FLAGS_LOADER.loader.exec_module(flags)


def executable(flags=0x5000200, interpreter=b"/lib/ld-linux.so.3\0", stack_flags=6):
    data = bytearray(256)
    data[:7] = b"\x7fELF\x01\x01\x01"
    struct.pack_into("<HHIIIIIHHHHHH", data, 16, 3, 40, 1, 0, 52, 0, flags, 52, 32, 2, 0, 0, 0)
    struct.pack_into("<IIIIIIII", data, 52, 3, 128, 0, 0, len(interpreter), len(interpreter), 4, 1)
    struct.pack_into("<IIIIIIII", data, 84, 0x6474E551, 0, 0, 0, 0, 0, stack_flags, 16)
    data[128:128 + len(interpreter)] = interpreter
    return data


REPORT = """
  0x00000001 (NEEDED) Shared library: [libc.so.6]
  0x00000001 (NEEDED) Shared library: [libgcc_s.so.1]
  Name: GLIBC_2.4
  Name: GLIBC_2.12
  Name: GCC_4.3.0
"""
RUST_IDENTITY = ("rustc " + build.SPEC["rust_toolchain"] + " (" + build.SPEC["rust_commit"][:9]
                 + " 2026-06-26)\nrelease: " + build.SPEC["rust_toolchain"]
                 + "\ncommit-hash: " + build.SPEC["rust_commit"])


class RustIdentityTests(unittest.TestCase):
    def test_exact_release_and_full_commit_are_accepted(self):
        build.validate_rust_identity(RUST_IDENTITY)

    def test_wrong_missing_short_or_duplicate_commit_is_rejected(self):
        for identity in (
            RUST_IDENTITY.replace(build.SPEC["rust_commit"], "a" * 40),
            RUST_IDENTITY.split("\ncommit-hash:")[0],
            RUST_IDENTITY.replace(build.SPEC["rust_commit"], build.SPEC["rust_commit"][:9]),
            RUST_IDENTITY + "\ncommit-hash: " + build.SPEC["rust_commit"],
            RUST_IDENTITY.replace("release: " + build.SPEC["rust_toolchain"], "release: 1.0.0"),
        ):
            with self.subTest(identity=identity), self.assertRaises(ValueError):
                build.validate_rust_identity(identity)

    def test_build_rejects_wrong_commit_before_invoking_compilation(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            args = SimpleNamespace(jobs=1, output=root / "output", target_dir=root / "target", sdk=root,
                                   sdk_archive=root / "sdk.tar", libclang=None)
            with (patch.object(build, "sdk_tools", return_value={}),
                  patch.object(build, "attest_sdk", return_value={}),
                  patch.object(build, "run", return_value=RUST_IDENTITY.replace(build.SPEC["rust_commit"], "a" * 40)),
                  patch.object(build.subprocess, "run") as compile_process,
                  self.assertRaisesRegex(ValueError, "release or commit")):
                build.build(args)
            compile_process.assert_not_called()


class ElfTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.binary = Path(self.temp.name) / "companion"
        self.binary.write_bytes(executable())

    def tearDown(self):
        self.temp.cleanup()

    def test_valid_arm_soft_float(self):
        result = build.inspect_elf(self.binary, REPORT)
        self.assertEqual(result["float_abi"], "soft")
        self.assertFalse(result["device_executed"])
        self.assertEqual(result["sha256"], build.sha(self.binary))

    def test_private_host_paths_rejected_in_elf_bytes(self):
        for prefix in (b"/Users", b"/home"):
            with self.subTest(prefix=prefix):
                self.binary.write_bytes(executable() + prefix + b"/builder/src/lib.rs\0")
                with self.assertRaisesRegex(ValueError, "private host paths"):
                    build.inspect_elf(self.binary, REPORT)

    def test_private_path_split_at_scan_boundary_rejected(self):
        self.binary.write_bytes(b"x" * (1024 * 1024 - 3) + b"/Users/builder\0")
        with self.assertRaisesRegex(ValueError, "private host paths"):
            build.linker.check_embedded_paths(self.binary)

    def test_wrong_class_or_machine(self):
        for index, value in ((4, 2), (5, 2), (18, 62)):
            with self.subTest(index=index):
                data = executable()
                data[index] = value
                self.binary.write_bytes(data)
                with self.assertRaises(ValueError):
                    build.inspect_elf(self.binary, REPORT)

    def test_hard_float_or_wrong_eabi(self):
        for flags in (0x5000400, 0x5000600, 0x4000200, 0x5000000):
            with self.subTest(flags=flags):
                self.binary.write_bytes(executable(flags=flags))
                with self.assertRaisesRegex(ValueError, "soft-float"):
                    build.inspect_elf(self.binary, REPORT)

    def test_interpreter(self):
        self.binary.write_bytes(executable(interpreter=b"/lib/ld-linux-armhf.so.3\0"))
        with self.assertRaisesRegex(ValueError, "interpreter"):
            build.inspect_elf(self.binary, REPORT)

    def test_executable_stack(self):
        self.binary.write_bytes(executable(stack_flags=7))
        with self.assertRaisesRegex(ValueError, "stack"):
            build.inspect_elf(self.binary, REPORT)

    def test_missing_stack(self):
        data = executable()
        struct.pack_into("<I", data, 84, 0)
        self.binary.write_bytes(data)
        with self.assertRaisesRegex(ValueError, "stack"):
            build.inspect_elf(self.binary, REPORT)

    def test_truncated_segment(self):
        data = executable()
        struct.pack_into("<I", data, 52 + 16, 9000)
        self.binary.write_bytes(data)
        with self.assertRaisesRegex(ValueError, "outside"):
            build.inspect_elf(self.binary, REPORT)

    def test_unsupported_dynamic_requirements(self):
        reports = [REPORT + "Name: GLIBC_2.17", REPORT + "Name: GLIBC_PRIVATE",
                   REPORT + "Name: GCC_4.8.0", REPORT + " (NEEDED) [libssl.so.3]",
                   REPORT + " (RPATH) [/tmp/build]", REPORT + " (RUNPATH) [$ORIGIN]",
                   REPORT + " (TEXTREL) 0", REPORT + " GLOBAL DEFAULT UND getauxval@GLIBC_2.16"]
        for report in reports:
            with self.subTest(report=report), self.assertRaises(ValueError):
                build.inspect_elf(self.binary, report)

    def test_unversioned_getauxval(self):
        with self.assertRaisesRegex(ValueError, "getauxval"):
            build.inspect_elf(self.binary, REPORT + " 9: GLOBAL DEFAULT UND getauxval\n")

    def test_missing_dynamic_evidence(self):
        with self.assertRaises(ValueError):
            build.inspect_elf(self.binary, "")


class SourceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        (self.root / "src").mkdir()
        (self.root / "src/code.rs").write_text("fn main() {}\n")
        (self.root / ".gitignore").write_text("src/cache/\n")
        (self.root / "src/cache").mkdir()
        (self.root / "src/cache/generated").write_text("not source")
        self.spec = {"source_roots": ["src"], "required_source_files": ["src/code.rs"]}

    def tearDown(self):
        self.temp.cleanup()

    def test_untracked_source_included_output_excluded(self):
        rows = build.source_inventory(self.root, self.spec)
        self.assertEqual([row["path"] for row in rows], ["src/code.rs"])

    def test_changed_source_changes_receipt(self):
        before = build.source_inventory(self.root, self.spec)
        (self.root / "src/code.rs").write_text("fn main() { panic!(); }")
        self.assertNotEqual(before, build.source_inventory(self.root, self.spec))

    def test_symlink_source_rejected(self):
        (self.root / "src/link.rs").symlink_to(self.root / "src/code.rs")
        with self.assertRaisesRegex(ValueError, "Symlink"):
            build.source_inventory(self.root, self.spec)

    def test_missing_required_source_rejected(self):
        (self.root / "src/code.rs").unlink()
        with self.assertRaisesRegex(ValueError, "Required"):
            build.source_inventory(self.root, self.spec)

    def test_stable_local_archive_and_source_paths(self):
        rows = build.source_inventory(self.root, self.spec)
        source = {"local_inputs": rows, "complete_corresponding_source": False}
        with patch.object(build, "assert_sources"):
            for name in ("one.tgz", "two.tgz"):
                build.local_source_archive(self.root / name, source, self.root)
        self.assertEqual(build.sha(self.root / "one.tgz"), build.sha(self.root / "two.tgz"))
        with tarfile.open(self.root / "one.tgz") as archive:
            self.assertEqual(archive.getnames(), ["source/src/code.rs", "source-receipt.json"])
            self.assertEqual(archive.getmember("source/src/code.rs").mtime, 0)
            self.assertFalse(json.load(archive.extractfile("source-receipt.json"))["complete_corresponding_source"])

    def test_archive_rejects_changed_source_bytes(self):
        source = {"local_inputs": build.source_inventory(self.root, self.spec)}
        (self.root / "src/code.rs").write_text("changed")
        with patch.object(build, "assert_sources"), self.assertRaisesRegex(ValueError, "changed"):
            build.local_source_archive(self.root / "bad.tgz", source, self.root)
        self.assertFalse((self.root / "bad.tgz").exists())

    def test_unsafe_paths(self):
        for path in ("../escape", "/absolute", "a/../../b", "a\\b", ""):
            with self.subTest(path=path), self.assertRaises(ValueError):
                build.safe_relative(path)


class BundleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.compiler = self.root / "arm-webos-linux-gnueabi-gcc"
        self.compiler.write_bytes(b"wrapper")
        self.backend = self.compiler.with_name(self.compiler.name + ".br_real")
        self.backend.write_bytes(b"backend")
        (self.root / "ottplay-companion").write_bytes(executable())
        (self.root / "source-receipt.json").write_text('{"local_inputs": []}')
        (self.root / "local-source.tar.gz").write_bytes(b"local source")
        (self.root / "ottplay-companion.link.map").write_text("LOAD /sdk/lib/crti.o\n")
        (self.root / "ottplay-companion.link.trace").write_text("/sdk/lib/crti.o\n")
        self.link_record = {"schema": 1, "archive_excluded": True,
                            "build_root": str(self.root), "build_target": str(self.root), "rust_sysroot": str(self.root), "archive_inputs": [],
                            **build.linker.compiler_digests(self.compiler),
                            "elf_sha256": build.sha(self.root / "ottplay-companion"),
                            "map_sha256": build.sha(self.root / "ottplay-companion.link.map"),
                            "trace_sha256": build.sha(self.root / "ottplay-companion.link.trace")}
        (self.root / "ottplay-companion.link.json").write_bytes(build.canonical(self.link_record))
        self.receipt = {
            "rustc": RUST_IDENTITY,
            "sdk": {"executables": {"gcc": build.sha(self.compiler), "gcc_backend": build.sha(self.backend)}},
            "manifest_sha256": build.sha(build.HERE / "manifest.json"),
            "source_receipt_sha256": build.sha(self.root / "source-receipt.json"),
            "local_source_archive_sha256": build.sha(self.root / "local-source.tar.gz"),
            "link_map_sha256": build.sha(self.root / "ottplay-companion.link.map"),
            "link_trace_sha256": build.sha(self.root / "ottplay-companion.link.trace"),
            "link_receipt_sha256": build.sha(self.root / "ottplay-companion.link.json"),
            "elf": build.inspect_elf(self.root / "ottplay-companion", REPORT)}
        self.save()

    def save(self):
        (self.root / "receipt.json").write_bytes(build.canonical(self.receipt))

    def tearDown(self):
        self.temp.cleanup()

    def check(self):
        with patch.object(build, "assert_sources"), patch.object(build, "elf_report", return_value=REPORT):
            return build.checked_bundle(self.root, self.root / "arm-webos-linux-gnueabi-readelf")

    def test_valid_receipt(self):
        self.assertEqual(self.check()[0], self.receipt)

    def test_changed_sdk_backend_is_rejected(self):
        self.backend.write_bytes(b"changed backend")
        with self.assertRaisesRegex(ValueError, "compiler_backend_sha256"):
            self.check()

    def test_outer_backend_digest_must_match_link_receipt(self):
        self.receipt["sdk"]["executables"]["gcc_backend"] = "e" * 64
        self.save()
        with self.assertRaisesRegex(ValueError, "backend digest"):
            self.check()

    def test_changed_binary_rejected(self):
        with (self.root / "ottplay-companion").open("ab") as stream:
            stream.write(b"changed")
        with self.assertRaisesRegex(ValueError, "changed"):
            self.check()

    def test_changed_source_receipt_rejected(self):
        (self.root / "source-receipt.json").write_text("{}")
        with self.assertRaisesRegex(ValueError, "checksum"):
            self.check()

    def test_changed_source_archive_rejected(self):
        (self.root / "local-source.tar.gz").write_text("changed")
        with self.assertRaisesRegex(ValueError, "checksum"):
            self.check()

    def test_changed_trace_rejected(self):
        (self.root / "ottplay-companion.link.trace").write_text("different trace")
        with self.assertRaisesRegex(ValueError, "checksum"):
            self.check()

    def test_missing_trace_rejected(self):
        (self.root / "ottplay-companion.link.trace").unlink()
        with self.assertRaises(OSError):
            self.check()

    def test_archive_exclusion_is_not_just_an_outer_checksum(self):
        self.link_record["archive_excluded"] = False
        (self.root / "ottplay-companion.link.json").write_bytes(build.canonical(self.link_record))
        self.receipt["link_receipt_sha256"] = build.sha(self.root / "ottplay-companion.link.json")
        self.save()
        with self.assertRaisesRegex(ValueError, "exclusion"):
            self.check()

    def test_trace_is_checked_even_if_outer_checksum_was_updated(self):
        (self.root / "ottplay-companion.link.trace").write_text("different trace")
        self.receipt["link_trace_sha256"] = build.sha(self.root / "ottplay-companion.link.trace")
        self.save()
        with self.assertRaisesRegex(ValueError, "trace_sha256"):
            self.check()

    def test_explicit_private_evidence_staging(self):
        source = {"local_inputs_sha256": "source-hash"}
        destination = self.root / "ipk"
        evidence = self.root / "link-evidence/stable"
        args = SimpleNamespace(bundle=self.root, readelf=Path("readelf"),
                               destination=destination, link_evidence=evidence)
        with patch.object(build, "checked_bundle", return_value=(self.receipt, source)), \
                patch.object(build, "assert_sources"), patch("builtins.print"):
            build.stage(args)
        build.linker.check_evidence(destination / "bin/ottplay-companion", evidence / "ottplay-companion")
        self.assertFalse(list(destination.rglob("*.link.*")))

    def test_private_evidence_cannot_be_put_in_application_payload(self):
        args = SimpleNamespace(bundle=self.root, readelf=Path("readelf"),
                               destination=self.root / "ipk", link_evidence=self.root / "ipk/evidence")
        with patch.object(build, "checked_bundle", return_value=(self.receipt, {})), \
                self.assertRaisesRegex(ValueError, "outside"):
            build.stage(args)

    def test_polyfill_rejected_even_with_updated_checksum(self):
        (self.root / "ottplay-companion.link.map").write_text("/sdk/libglibc_polyfills.a(member.o)")
        self.receipt["link_map_sha256"] = build.sha(self.root / "ottplay-companion.link.map")
        self.save()
        with self.assertRaisesRegex(ValueError, "polyfills"):
            self.check()

    def test_staging_installs_only_binary_and_public_metadata(self):
        source = {"local_inputs_sha256": "source-hash"}
        destination = self.root / "ipk"
        args = SimpleNamespace(bundle=self.root, readelf=Path("readelf"), destination=destination)
        with patch.object(build, "checked_bundle", return_value=(self.receipt, source)), \
                patch.object(build, "assert_sources"), patch("builtins.print"):
            build.stage(args)
        binary = destination / "bin/ottplay-companion"
        self.assertEqual(binary.stat().st_mode & 0o777, 0o755)
        self.assertEqual(build.sha(binary), self.receipt["elf"]["sha256"])
        self.assertTrue((destination / "companion/licenses/LICENSE").is_file())
        self.assertFalse(list(destination.rglob("*.link.map")))
        self.assertFalse(list(destination.rglob("*.tar.gz")))
        with patch.object(build, "checked_bundle", return_value=(self.receipt, source)), \
                self.assertRaisesRegex(ValueError, "already staged"):
            build.stage(args)

    def test_staging_refuses_symlink_install_parent(self):
        destination = self.root / "ipk"
        destination.mkdir()
        (destination / "bin").symlink_to(self.root, target_is_directory=True)
        args = SimpleNamespace(bundle=self.root, readelf=Path("readelf"), destination=destination)
        with patch.object(build, "checked_bundle", return_value=(self.receipt, {})), \
                self.assertRaisesRegex(ValueError, "already staged|symlink"):
            build.stage(args)


class CompilerFlagsTests(unittest.TestCase):
    def remaps(self):
        return flags.path_remaps(
            Path("/home/builder/source"), Path("/home/builder/target"), Path("/opt/cargo cache"),
            Path("/home/builder/.rustup/toolchains/pinned"), Path("/home/builder/sdk"),
            Path("/home/builder"), Path("/tmp"))

    def test_specific_roots_override_home_and_all_build_inputs_are_mapped(self):
        mappings = self.remaps()
        expected = {"/home/builder": "/build/user", "/tmp": "/build/tmp",
                    "/home/builder/source": "/build/ottplay-companion",
                    "/home/builder/target": "/build/ottplay-target",
                    "/opt/cargo cache": "/build/cargo",
                    "/home/builder/.rustup/toolchains/pinned": "/build/rust",
                    "/home/builder/sdk": "/build/webos-sdk"}
        self.assertEqual({key: dict(mappings)[key] for key in expected}, expected)
        lengths = [len(path) for path, _ in mappings]
        self.assertEqual(lengths, sorted(lengths))
        self.assertLess(mappings.index(("/home/builder", "/build/user")),
                        mappings.index(("/home/builder/source", "/build/ottplay-companion")))

    def test_symlink_and_canonical_roots_are_both_mapped(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            source = root / "source"
            source.mkdir()
            alias = root / "alias"
            alias.symlink_to(source, target_is_directory=True)
            mappings = dict(flags.path_remaps(alias, root / "target", root / "cargo", root / "rust",
                                             root / "sdk", root, Path("/tmp")))
            self.assertEqual(mappings[str(source)], "/build/ottplay-companion")
            self.assertEqual(mappings[str(alias)], "/build/ottplay-companion")

    def test_rust_and_native_macro_flags_keep_spaces_and_bindgen_is_separate(self):
        mappings = self.remaps()
        rust, native, bindgen = flags.compilation_flags(Path("/sdk with spaces/sysroot"), mappings)
        self.assertEqual("\x1f".join(rust).split("\x1f"), rust)
        self.assertEqual(shlex.split(shlex.join(native)), native)
        self.assertEqual(bindgen, ["--sysroot=/sdk with spaces/sysroot"])
        for original, replacement in mappings:
            mapping = original + "=" + replacement
            index = rust.index(mapping)
            self.assertEqual(rust[index - 1], "--remap-path-prefix")
            self.assertIn("-ffile-prefix-map=" + mapping, native)
            self.assertIn("-fmacro-prefix-map=" + mapping, native)

    def test_unsafe_compiler_prefixes_are_rejected(self):
        for prefix in ("/", "/tmp/with=newvalue", "/tmp/with\nnewline"):
            with self.subTest(prefix=prefix), self.assertRaisesRegex(ValueError, "Unsafe"):
                flags.path_remaps(prefix, "/target", "/cargo", "/rust", "/sdk", "/user", "/tmp")

    def test_cross_build_preserves_exact_libclang_alias(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            sdk, rust, target = root / "sdk", root / "rust", root / "target"
            (sdk / "bin").mkdir(parents=True)
            (sdk / "arm-webos-linux-gnueabi/sysroot").mkdir(parents=True)
            rust.mkdir()
            for name in ("gcc", "g++", "ar"):
                (sdk / "bin" / ("arm-webos-linux-gnueabi-" + name)).write_bytes(b"fixture")
            library = root / "libclang.18.dylib"
            library.write_bytes(b"fixture")
            alias = root / "libclang.dylib"
            alias.symlink_to(library.name)
            binary = target / "armv7-unknown-linux-gnueabi/release/ottplay-companion"
            binary.parent.mkdir(parents=True)
            binary.write_bytes(executable())
            with (patch.object(sys, "argv", ["build-webos.py", "--sdk", str(sdk), "--target-dir", str(target),
                                             "--libclang", str(alias)]),
                  patch.object(flags.subprocess, "check_output", return_value=str(rust)),
                  patch.object(flags.subprocess, "run", return_value=SimpleNamespace(stdout="ELF fixture")) as run,
                  patch.object(flags.webos_link, "stage_evidence"), patch("builtins.print")):
                flags.main()
            self.assertEqual(run.call_args_list[0].kwargs["env"]["LIBCLANG_PATH"], str(alias))

    def test_bundle_build_forwards_exact_libclang_alias(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            library = root / "libclang-18.so.18.1.3"
            library.write_bytes(b"fixture")
            alias = root / "libclang.so"
            alias.symlink_to(library.name)
            args = SimpleNamespace(jobs=1, output=root / "output", target_dir=root / "target", sdk=root,
                                   sdk_archive=root / "sdk.tar", libclang=alias)
            with (patch.object(build, "sdk_tools", return_value={}),
                  patch.object(build, "attest_sdk", return_value={}),
                  patch.object(build, "run", return_value=RUST_IDENTITY),
                  patch.object(build, "source_inventory", return_value=[]),
                  patch.object(build, "source_receipt", return_value={}),
                  patch.object(build.subprocess, "run", side_effect=RuntimeError("captured build")) as run,
                  self.assertRaisesRegex(RuntimeError, "captured build")):
                build.build(args)
            command = run.call_args.args[0]
            self.assertEqual(command[command.index("--libclang") + 1], str(alias))


class LinkerTests(unittest.TestCase):
    """A compiler-process fixture tests capture, never stands in for release evidence."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="companion-link-test-")
        self.root = Path(self.temp.name).resolve()
        self.compiler = self.root / "sdk with spaces/compiler"
        self.compiler.parent.mkdir()
        self.compiler.write_text('''#!/usr/bin/env python3
import os, pathlib, sys
if os.environ.get('FIXTURE_ARGV0'):
    assert pathlib.Path(sys.argv[0]).name == os.environ['FIXTURE_ARGV0']
backend = str(pathlib.Path(sys.argv[0]).absolute()) + '.br_real'
os.execv(backend, [backend, *sys.argv[1:]])
''')
        self.backend = self.compiler.with_name(self.compiler.name + ".br_real")
        self.backend.write_text('''#!/usr/bin/env python3
import os, pathlib, sys
args = sys.argv[1:]
assert '-tno-glibc-polyfill' in args
assert '-t' in args and '--cref' in args
output = pathlib.Path(args[args.index('-o') + 1])
mapfile = pathlib.Path(args[args.index('-Map') + 2])
output.parent.mkdir(parents=True, exist_ok=True)
output.write_bytes(b'\\x7fELFfixture-' + os.environ.get('FIXTURE_BYTES', 'a').encode())
text = 'LOAD /sdk/lib/crti.o\\n'
if os.environ.get('FIXTURE_FORBIDDEN'):
    text += 'LOAD /sdk/libglibc_polyfills.a\\n'
mapfile.write_text(text)
if os.environ.get('FIXTURE_ARCHIVE'):
    with mapfile.open('a') as stream:
        stream.write('LOAD ' + os.environ['FIXTURE_ARCHIVE'] + '\\n')
    print(os.environ['FIXTURE_ARCHIVE'])
print('/sdk/lib/crti.o')
print('compiler fixture diagnostic', file=sys.stderr)
if os.environ.get('FIXTURE_MUTATE_BACKEND'):
    with pathlib.Path(__file__).open('a') as stream:
        stream.write('\\n# changed during link\\n')
sys.exit(int(os.environ.get('FIXTURE_FAIL', '0')))
''')
        self.compiler.chmod(0o755)
        self.backend.chmod(0o755)

    def tearDown(self):
        self.temp.cleanup()

    def run_link(self, output, **environment):
        return subprocess.run([sys.executable, str(Path(build.linker.__file__)), '-o', str(output)],
                              env={**os.environ, 'OTT_COMPANION_CC': str(self.compiler),
                                   'OTT_COMPANION_BUILD_ROOT':str(self.root),
                                   'OTT_COMPANION_BUILD_TARGET':str(self.root),
                                   'OTT_COMPANION_RUST_SYSROOT':str(self.root), **environment},
                              capture_output=True, text=True, check=False)

    def test_real_subprocess_trace_and_byte_bound_receipt(self):
        output = self.root / 'with spaces,commas/program'
        result = self.run_link(output)
        self.assertEqual(result.returncode, 0, result.stderr)
        record = build.linker.check_evidence(output, compiler=self.compiler)
        trace = build.linker.sidecar(output, '.link.trace').read_text()
        self.assertEqual(trace, result.stdout + result.stderr)
        self.assertIn('/sdk/lib/crti.o', trace)
        self.assertTrue(record['archive_excluded'])
        self.assertEqual(record['compiler_backend_sha256'], build.sha(self.backend))

    def test_changed_backend_does_not_hide_behind_unchanged_wrapper(self):
        output = self.root / 'program'
        self.assertEqual(self.run_link(output).returncode, 0)
        before = build.sha(self.compiler)
        self.backend.write_text(self.backend.read_text() + '\n# new backend\n')
        self.assertEqual(before, build.sha(self.compiler))
        with self.assertRaisesRegex(ValueError, 'compiler_backend_sha256'):
            build.linker.check_evidence(output, compiler=self.compiler)

    def test_backend_change_during_link_prevents_success_receipt(self):
        output = self.root / 'program'
        result = self.run_link(output, FIXTURE_MUTATE_BACKEND='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('backend changed during final link', result.stderr)
        self.assertFalse(build.linker.sidecar(output, '.link.json').exists())

    def test_missing_backend_or_its_digest_is_rejected(self):
        output = self.root / 'program'
        self.assertEqual(self.run_link(output).returncode, 0)
        path = build.linker.sidecar(output, '.link.json')
        record = json.loads(path.read_text())
        del record['compiler_backend_sha256']
        path.write_text(json.dumps(record))
        with self.assertRaisesRegex(ValueError, 'compiler_backend_sha256'):
            build.linker.check_evidence(output)
        self.backend.unlink()
        self.assertNotEqual(self.run_link(output).returncode, 0)
        self.assertFalse(path.exists())

    def test_failed_relink_removes_previous_success_receipt(self):
        output = self.root / 'program'
        self.assertEqual(self.run_link(output).returncode, 0)
        self.assertEqual(self.run_link(output, FIXTURE_FAIL='2').returncode, 2)
        self.assertFalse(build.linker.sidecar(output, '.link.json').exists())

    def test_compiler_symlink_preserves_basename_for_multicall_wrapper(self):
        wrapper = self.compiler.with_name("toolchain-wrapper")
        self.compiler.rename(wrapper)
        self.compiler.symlink_to(wrapper.name)
        output = self.root / 'program'
        result = self.run_link(output, FIXTURE_ARGV0=self.compiler.name)
        self.assertEqual(result.returncode, 0, result.stderr)
        record = build.linker.check_evidence(output, compiler=self.compiler)
        self.assertEqual(record['compiler_sha256'], build.sha(wrapper))

    def test_forbidden_archive_cannot_be_attested(self):
        output = self.root / 'program'
        result = self.run_link(output, FIXTURE_FORBIDDEN='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(build.linker.sidecar(output, '.link.json').exists())

    def test_cargo_copy_finds_exact_internal_binary(self):
        output = self.root / 'target/triple/release/deps/ottplay_companion-correct'
        stale = output.with_name('ottplay_companion-stale')
        self.assertEqual(self.run_link(stale, FIXTURE_BYTES='stale').returncode, 0)
        self.assertEqual(self.run_link(output).returncode, 0)
        public = output.parent.parent / 'ottplay-companion'
        shutil.copyfile(output, public)
        build.linker.stage_evidence(public, compiler=self.compiler)
        self.assertEqual(build.linker.check_evidence(public)['elf_sha256'], build.sha(output))

    def test_map_alone_never_substitutes_for_actual_trace(self):
        output = self.root / 'target/triple/release/ottplay-companion'
        output.parent.mkdir(parents=True)
        output.write_bytes(b'\x7fELFfixture')
        build.linker.sidecar(output, '.link.map').write_text('LOAD /sdk/lib/crti.o\n')
        with self.assertRaisesRegex(ValueError, 'real linker evidence'):
            build.linker.stage_evidence(output)

    def test_response_file_output_path_is_detected_without_rewriting_arguments(self):
        response = self.root / 'args.rsp'
        response.write_text('-Wl,--as-needed -o "with spaces/program"')
        self.assertEqual(build.linker.link_output(['@' + str(response)]), Path('with spaces/program').absolute())
        self.assertIsNone(build.linker.link_output(['-c', '-o', 'file.o']))

    def test_actual_archive_bytes_are_hashed_before_temporary_input_disappears(self):
        archive = self.root / 'target/deps/rustctemporary/libfixture.rlib'
        archive.parent.mkdir(parents=True)
        archive.write_bytes(b'!<arch>\nfixture archive')
        output = self.root / 'program'
        result = self.run_link(output, FIXTURE_ARCHIVE=str(archive))
        self.assertEqual(result.returncode, 0, result.stderr)
        record = build.linker.check_evidence(output)
        self.assertEqual(record['archive_inputs'], [{'path':str(archive), 'sha256':build.sha(archive), 'bytes':archive.stat().st_size,
                                                   'observed_at_link':True, 'validation':'link_time_only_ephemeral'}])
        archive.unlink()
        # Verification retains the actual link-time hash; it does not substitute
        # a different persistent rlib after rustc removes its temporary copy.
        self.assertEqual(build.linker.check_evidence(output)['archive_inputs'], record['archive_inputs'])

    def test_static_archive_in_rustc_directory_remains_persistent(self):
        archive = self.root / 'target/deps/rustctemporary/libfixture.a'
        archive.parent.mkdir(parents=True)
        archive.write_bytes(b'!<arch>\nfixture archive')
        output = self.root / 'program'
        result = self.run_link(output, FIXTURE_ARCHIVE=str(archive))
        self.assertEqual(result.returncode, 0, result.stderr)
        record = build.linker.check_evidence(output)
        self.assertEqual(record['archive_inputs'][0]['validation'], 'link_time_and_current')
        archive.unlink()
        with self.assertRaisesRegex(ValueError, 'Persistent archive missing'):
            build.linker.check_evidence(output)

    def test_archive_inventory_cannot_add_or_duplicate_unobserved_inputs(self):
        output = self.root / 'program'
        self.assertEqual(self.run_link(output).returncode, 0)
        path = build.linker.sidecar(output, '.link.json')
        record = json.loads(path.read_text())
        record['archive_inputs'] = [{'path':str(self.root/'deps/rustctmp/injected.rlib'), 'sha256':'a'*64, 'bytes':8,
                                    'observed_at_link':True, 'validation':'link_time_only_ephemeral'}]
        path.write_text(json.dumps(record))
        with self.assertRaisesRegex(ValueError, 'observed'):
            build.linker.check_evidence(output)

    def test_symlink_archive_is_not_attested(self):
        target = self.root / 'real.a'
        target.write_bytes(b'!<arch>\nreal')
        archive = self.root / 'alias.a'
        archive.symlink_to(target)
        output = self.root / 'program'
        result = self.run_link(output, FIXTURE_ARCHIVE=str(archive))
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(build.linker.sidecar(output, '.link.json').exists())


if __name__ == "__main__":
    unittest.main()
