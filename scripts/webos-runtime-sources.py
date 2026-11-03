#!/usr/bin/env python3
"""Collect native runtime sources and bind linker evidence to the shipped IPK."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import re
import subprocess
import tarfile
import tempfile
from pathlib import Path, PurePosixPath

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / "webos-runtime-sources.json"
SYSTEM = re.compile(
    r"^(?:lib(?:c|m|dl|rt|pthread|gcc_s|stdc\+\+|z|curl|glib-2\.0|gobject-2\.0|gthread-2\.0|gio-2\.0|gmodule-2\.0|luna-service2|wayland-client|SDL2(?:_ttf)?(?:-2\.0)?|GLESv2|EGL|playerAPIs|pf-1\.0|AcbAPI|freetype)\.so(?:\.[0-9]+)*|ld-linux\.so\.3)$"
)
RUNTIME = {
    "libc_nonshared.a": "glibc-runtime",
    "libpthread_nonshared.a": "glibc-runtime",
    "libc.a": "glibc-runtime",
    "libm.a": "glibc-runtime",
    "libgcc.a": "gcc-runtime",
    "libgcc_eh.a": "gcc-runtime",
    "libstdc++.a": "gcc-runtime",
    "libatomic.a": "gcc-runtime",
}
COMPANION = "ottplay-companion"
JSON_LIMIT = 16 * 1024 * 1024
LINK_LIMIT = 256 * 1024 * 1024
SOURCE_LIMIT = 4 * 1024 * 1024 * 1024


def digest(path, algorithm="sha256"):
    h = hashlib.new(algorithm)
    with Path(path).open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, indent=2).encode() + b"\n"


def fail(message):
    raise ValueError(message)


def fetch(row, cache):
    path = cache / row["file"]
    algorithm = "sha512" if "sha512" in row else "sha256"
    if path.exists():
        if digest(path, algorithm) != row[algorithm]:
            fail("Cached source digest mismatch: " + path.name)
        return path
    cache.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(prefix=path.name + ".", dir=cache, delete=False) as stream:
        temporary = Path(stream.name)
    try:
        subprocess.run(
            [
                "curl",
                "--fail",
                "--location",
                "--retry",
                "2",
                "--connect-timeout",
                "15",
                "--max-time",
                "600",
                "--silent",
                "--show-error",
                "--output",
                str(temporary),
                row["url"],
            ],
            check=True,
        )
        if digest(temporary, algorithm) != row[algorithm]:
            fail("Downloaded source digest mismatch: " + path.name)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    return path


def safe_name(name):
    path = PurePosixPath(name)
    if not name or path.is_absolute() or ".." in path.parts or "\\" in name:
        fail("Unsafe archive member")
    return path.as_posix()


def regular(path, limit=SOURCE_LIMIT):
    if path.is_symlink() or not path.is_file() or path.stat().st_size > limit:
        fail("Missing, nonregular or oversized companion input: " + path.name)
    return path


def load_json(path):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                fail("Duplicate companion JSON key")
            result[key] = value
        return result

    return json.loads(regular(path, JSON_LIMIT).read_bytes(), object_pairs_hook=unique)


class SourceTarInfo(tarfile.TarInfo):
    def _reject_sparse(self, *_args):
        fail("Sparse companion source entries are unsupported")

    _proc_gnusparse_00 = _reject_sparse
    _proc_gnusparse_01 = _reject_sparse
    _proc_gnusparse_10 = _reject_sparse

    def _apply_pax_info(self, pax_headers, encoding, errors):
        if any(key.startswith("GNU.sparse.") for key in pax_headers):
            self._reject_sparse()
        return super()._apply_pax_info(pax_headers, encoding, errors)

    def _proc_member(self, archive):
        if self.type == tarfile.GNUTYPE_SPARSE:
            self._reject_sparse()
        if (
            self.type
            in (
                tarfile.GNUTYPE_LONGNAME,
                tarfile.GNUTYPE_LONGLINK,
                tarfile.XHDTYPE,
                tarfile.XGLTYPE,
                tarfile.SOLARIS_XHDTYPE,
            )
            and not 0 <= self.size <= JSON_LIMIT
        ):
            fail("Oversized companion source header")
        archive.source_headers = getattr(archive, "source_headers", 0) + 1
        if archive.source_headers > 100_000:
            fail("Too many companion source headers")
        return super()._proc_member(archive)


def check_companion_archive(path, manifest, manifest_bytes):
    expected, seen, total = manifest["files"], set(), 0
    with tarfile.open(path, "r|gz", tarinfo=SourceTarInfo) as archive:
        for member in archive:
            name = safe_name(member.name)
            if name != member.name or name in seen or not member.isfile() or member.issparse():
                fail("Invalid companion source archive member")
            seen.add(name)
            total += member.size
            if not 0 <= member.size <= SOURCE_LIMIT or total > SOURCE_LIMIT or len(seen) > 100_000:
                fail("Companion source archive exceeds limits")
            row = (
                {"sha256": hashlib.sha256(manifest_bytes).hexdigest(), "bytes": len(manifest_bytes)}
                if name == "SOURCE-MANIFEST.json"
                else expected.get(name)
            )
            if row is None or member.size != row["bytes"] or member.mode not in (0o644, 0o755):
                fail("Companion source archive differs from manifest")
            h = hashlib.sha256()
            stream = archive.extractfile(member)
            while block := stream.read(1024 * 1024):
                h.update(block)
            if h.hexdigest() != row["sha256"]:
                fail("Companion source member digest mismatch: " + name)
    if seen != set(expected) | {"SOURCE-MANIFEST.json"}:
        fail("Incomplete companion source archive")


def companion_compiler_inputs(sdk, record):
    """Resolve the SDK dispatch alias and the backend selected by its basename."""
    sdk = sdk.resolve(strict=True)
    compiler = sdk / "bin/arm-webos-linux-gnueabi-gcc"
    result = {}
    for name, key, alias in (
        ("compiler", "compiler_sha256", compiler),
        ("backend", "compiler_backend_sha256", compiler.with_name(compiler.name + ".br_real")),
    ):
        path = alias.resolve(strict=True)
        if not path.is_relative_to(sdk):
            fail("Companion compiler executable escapes the pinned SDK")
        actual = digest(regular(path))
        if record.get(key) != actual:
            fail("Companion compiler executable changed: " + key)
        result[name] = {"sdk_path": path.relative_to(sdk).as_posix(), "sha256": actual}
    if result["compiler"]["sdk_path"] == result["backend"]["sdk_path"]:
        fail("Companion compiler wrapper and backend must be separate files")
    return result


def companion_inputs(args, metadata, elfs):
    bundle, sources = getattr(args, "companion_bundle", None), getattr(args, "companion_sources", None)
    if COMPANION not in elfs:
        if bundle is not None or sources is not None or "companion" in metadata:
            fail("Unexpected companion inputs without a packaged helper")
        return None
    if bundle is None or sources is None or not isinstance(metadata.get("companion"), dict):
        fail("Packaged companion requires --companion-bundle, --companion-sources and metadata")
    bundle, sources = Path(bundle), Path(sources)
    packaged = metadata["companion"]
    receipt = load_json(bundle / "receipt.json")
    source_receipt = load_json(bundle / "source-receipt.json")
    closure = load_json(sources / "source-closure.json")
    manifest_path = regular(sources / "SOURCE-MANIFEST.json", JSON_LIMIT)
    manifest = load_json(manifest_path)
    archive = regular(sources / "companion-source.tar.gz")
    if any(value.get("schema") != 1 for value in (receipt, source_receipt, closure, manifest)):
        fail("Unsupported companion source schema")
    binary_hash = hashlib.sha256(elfs[COMPANION]).hexdigest()
    if (
        packaged.get("elf_sha256") != binary_hash
        or receipt.get("elf", {}).get("sha256") != binary_hash
        or receipt["elf"].get("bytes") != len(elfs[COMPANION])
        or digest(regular(bundle / COMPANION)) != binary_hash
        or receipt.get("package") != COMPANION
        or manifest.get("package") != COMPANION
        or receipt.get("target") != "armv7-unknown-linux-gnueabi"
        or manifest.get("target") != receipt["target"]
    ):
        fail("Companion source/bundle differs from packaged helper")
    if digest(regular(bundle / "receipt.json")) != packaged.get("receipt_sha256"):
        fail("Companion build receipt differs from package")
    for key in ("manifest_sha256", "source_receipt_sha256", "local_source_archive_sha256", "local_inputs_sha256"):
        if receipt.get(key) != packaged.get(key):
            fail("Companion package receipt binding mismatch: " + key)
    for filename, key in (
        ("source-receipt.json", "source_receipt_sha256"),
        ("local-source.tar.gz", "local_source_archive_sha256"),
    ):
        if digest(regular(bundle / filename)) != packaged[key] or closure.get(key) != packaged[key]:
            fail("Companion source receipt binding mismatch: " + key)
    if (
        source_receipt.get("local_inputs_sha256") != packaged["local_inputs_sha256"]
        or closure.get("local_inputs_sha256") != packaged["local_inputs_sha256"]
        or manifest.get("local_inputs_sha256") != packaged["local_inputs_sha256"]
        or closure.get("elf_sha256") != binary_hash
    ):
        fail("Companion source inventory binding mismatch")
    archive_row = {"file": archive.name, "sha256": digest(archive), "bytes": archive.stat().st_size}
    if closure.get("source_archive") != archive_row or closure.get("source_manifest_sha256") != digest(manifest_path):
        fail("Companion source archive binding mismatch")
    if (
        manifest.get("bit_identical_rebuild") != "NOT_PROVEN"
        or closure.get("locked_source_coverage") != "PASS"
        or any(
            value.get("sdk_runtime_source_coverage") != "PENDING_ENCLOSING_RELEASE"
            or value.get("complete_corresponding_source") is not False
            or value.get("rebuild_validation") != "NOT_RUN"
            for value in (closure, manifest)
        )
    ):
        fail("Companion source coverage is missing or overclaimed")
    for key in ("cargo_lock_sha256", "dependency_count", "rust", "sdk_linkage", "sdk_archive_sha256"):
        if closure.get(key) != manifest.get(key):
            fail("Companion closure/manifest mismatch: " + key)
    for filename, key in (
        ("local-source.tar.gz", "local_source_archive_sha256"),
        ("source-receipt.json", "source_receipt_sha256"),
        ("build-receipt.json", "receipt_sha256"),
    ):
        if manifest["files"].get(filename, {}).get("sha256") != packaged[key]:
            fail("Companion archived build/source receipt mismatch")
    check_companion_archive(archive, manifest, manifest_path.read_bytes())
    record_path = regular(bundle / (COMPANION + ".link.json"), JSON_LIMIT)
    record = load_json(record_path)
    linkage = {
        "elf_sha256": binary_hash,
        "map_sha256": receipt.get("link_map_sha256"),
        "trace_sha256": receipt.get("link_trace_sha256"),
        "receipt_sha256": digest(record_path),
        "trace_available": True,
        "compiler_sha256": record.get("compiler_sha256"),
        "compiler_backend_sha256": record.get("compiler_backend_sha256"),
    }
    if closure["sdk_linkage"] != linkage or linkage["receipt_sha256"] != receipt.get("link_receipt_sha256"):
        fail("Companion source closure lacks matching real linker evidence")
    for suffix, key in ((".link.map", "map_sha256"), (".link.trace", "trace_sha256")):
        if (
            digest(regular(bundle / (COMPANION + suffix), LINK_LIMIT)) != linkage[key]
            or record.get(key) != linkage[key]
        ):
            fail("Companion linker evidence digest mismatch")
    compiler_inputs = companion_compiler_inputs(args.sdk, record)
    if (
        record.get("elf_sha256") != binary_hash
        or record.get("archive_excluded") is not True
        or receipt.get("sdk", {}).get("executables", {}).get("gcc") != compiler_inputs["compiler"]["sha256"]
        or receipt.get("sdk", {}).get("executables", {}).get("gcc_backend") != compiler_inputs["backend"]["sha256"]
        or receipt["sdk"].get("archive_sha256") != closure["sdk_archive_sha256"]
    ):
        fail("Companion linker compiler or SDK binding mismatch")
    return {
        "bundle": bundle,
        "archive": archive,
        "sources": sources,
        "receipt": receipt,
        "binding": {
            "archive": dict(archive_row, file="companion/" + archive.name),
            "source_closure": closure,
            "packaged": packaged,
        },
    }


def package_elfs(ipk):
    data = ipk.read_bytes()
    if not data.startswith(b"!<arch>\n"):
        fail("Not an IPK")
    offset, payload, seen = 8, None, set()
    while offset < len(data):
        header = data[offset : offset + 60]
        if len(header) != 60 or header[58:] != b"`\n":
            fail("Malformed IPK")
        name = header[:16].decode().strip().rstrip("/")
        size = int(header[48:58])
        if size < 0 or name in seen or offset + 60 + size > len(data):
            fail("Invalid IPK member")
        seen.add(name)
        if name == "data.tar.gz":
            payload = data[offset + 60 : offset + 60 + size]
        offset += 60 + size + size % 2
    if offset != len(data):
        fail("Truncated IPK alignment")
    if payload is None:
        fail("IPK payload missing")
    result = {}
    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
        for member in archive:
            name = safe_name(member.name)
            if member.isfile():
                content = archive.extractfile(member).read()
                if content.startswith(b"\x7fELF"):
                    base = PurePosixPath(name).name
                    if base in result:
                        fail("Ambiguous ELF basename")
                    result[base] = content
    if not result:
        fail("No native ELF in IPK")
    return result


def observed_archive_names(link_map, trace):
    """Parse bytes or iterables of lines without filesystem access or execution."""
    names = set()
    for data, is_map in ((link_map, True), (trace, False)):
        lines = data.splitlines() if isinstance(data, (bytes, str)) else data
        for raw in lines:
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8", errors="strict")
            if not isinstance(raw, str):
                fail("Invalid linker evidence line")
            line = raw.strip()
            if is_map and line.startswith("LOAD "):
                value = line[5:].strip()
                if value.endswith((".a", ".rlib")):
                    names.add(value)
            elif not is_map and line.endswith((".a", ".rlib")):
                names.add(line)
            if not is_map:
                match = re.fullmatch(r"\((.+\.(?:a|rlib))\).+", line)
                if match:
                    names.add(match[1])
            names.update(re.findall(r"(?<!\S)(/[^\n]*?\.(?:a|rlib))\([^()\n]*\)", line))
    return names


def observed_archives(link_map, trace, build_root):
    """Inventory actual map/trace inputs, including rewritten Rust rlibs."""
    result = set()
    for name in observed_archive_names(link_map, trace):
        path = Path(name)
        path = path if path.is_absolute() else build_root / path
        if any(part.is_symlink() for part in (path, *path.parents)):
            fail("Symlink in companion linker archive path")
        result.add(str(path.resolve()))
    return result


def companion_archives(record, link_map, trace, source, sdk):
    expected_fields = {
        "schema",
        "elf_sha256",
        "map_sha256",
        "trace_sha256",
        "compiler_sha256",
        "compiler_backend_sha256",
        "archive_excluded",
        "build_root",
        "build_target",
        "rust_sysroot",
        "archive_inputs",
        "archive_inputs_capture",
    }
    if set(record) != expected_fields:
        fail("Unexpected companion linker receipt fields")
    roots = {}
    for key in ("build_root", "build_target", "rust_sysroot"):
        value = record.get(key)
        if (
            not isinstance(value, str)
            or not Path(value).is_absolute()
            or Path(value) == Path("/")
            or str(Path(value).resolve()) != value
        ):
            fail("Invalid companion build root: " + key)
        roots[key] = Path(value)
    if record.get("schema") != 1 or record.get("archive_inputs_capture") != "during-final-link":
        fail("Companion archive inputs were not captured at final link")
    observed = observed_archives(link_map, trace, roots["build_root"])
    rows = record.get("archive_inputs")
    if not isinstance(rows, list) or not rows:
        fail("Missing companion link-time archive inventory")
    seen = set()
    allowed_roots = [*roots.values(), source.resolve(), sdk.resolve()]
    for row in rows:
        if (
            not isinstance(row, dict)
            or set(row) != {"path", "sha256", "bytes", "observed_at_link", "validation"}
            or not isinstance(row["path"], str)
            or row["path"] not in observed
            or row["path"] in seen
            or row["observed_at_link"] is not True
            or not isinstance(row["sha256"], str)
            or not re.fullmatch(r"[a-f0-9]{64}", row["sha256"])
            or type(row["bytes"]) is not int
            or row["bytes"] <= 0
        ):
            fail("Invalid companion link-time archive inventory")
        path = Path(row["path"])
        if not any(path.is_relative_to(root) for root in allowed_roots):
            fail("Companion archive is outside its bound build roots")
        seen.add(str(path))
        relative = (
            path.relative_to(roots["build_target"]).as_posix() if path.is_relative_to(roots["build_target"]) else ""
        )
        ephemeral = path.suffix == ".rlib" and re.search(r"(?:^|/)deps/rustc[^/]+/", relative) is not None
        expected = "link_time_only_ephemeral" if ephemeral else "link_time_and_current"
        if row["validation"] != expected:
            fail("Invalid companion archive validation scope")
        if not ephemeral or path.exists():
            regular(path)
            if path.stat().st_size != row["bytes"] or digest(path) != row["sha256"]:
                fail("Persistent companion linker archive changed")
    if seen != observed:
        fail("Companion archive inventory differs from observed linker inputs")
    return roots, seen


def runtime_inputs(text, source, sdk, *, allowed_archives=(), archive_root=None):
    rows = set()

    def archive_path(value):
        path = Path(value)
        if not path.is_absolute() and archive_root is not None:
            path = archive_root / path
        return path.resolve()

    def relative_sdk(path):
        try:
            return archive_path(path).relative_to(sdk.resolve()).as_posix()
        except ValueError:
            fail("Runtime input is outside the recorded SDK: " + path)

    for archive, member in re.findall(r"([^\s()]+\.a)\(([^\s()]+)\)", text):
        base = PurePosixPath(archive).name
        if base in RUNTIME:
            rows.add((RUNTIME[base], base, member, relative_sdk(archive)))
        elif str(sdk) in archive or "/sysroot/" in archive:
            fail("Unclassified static SDK archive: " + base)
        elif not (
            str(source) in archive
            or archive.startswith(("src/", "vendor/", "rust-modules/"))
            or str(archive_path(archive)) in allowed_archives
        ):
            fail("Unclassified static archive: " + base)
    for obj in re.findall(r"(?:^|\s)([^\s()]+/[^/\s()]+\.o)(?=\s|$)", text, re.MULTILINE):
        base = PurePosixPath(obj).name
        is_startup = base.startswith(("crt", "Scrt"))
        if not is_startup and str(sdk) not in obj and "/sysroot/" not in obj:
            continue
        if base in {"crt1.o", "Scrt1.o", "crti.o", "crtn.o"}:
            rows.add(("glibc-runtime", base, "", relative_sdk(obj)))
        elif re.fullmatch(r"crt(?:begin|end|fastmath)[A-Za-z]*\.o", base):
            rows.add(("gcc-runtime", base, "", relative_sdk(obj)))
        else:
            fail("Unclassified static SDK object: " + base)
    return [{"source": a, "archive_or_object": b, "member": c, "sdk_path": d} for a, b, c, d in sorted(rows)]


def normalized(value, replacements):
    """Normalize path-bearing evidence, retaining original byte hashes."""
    if isinstance(value, dict):
        return {key: normalized(item, replacements) for key, item in value.items()}
    if isinstance(value, list):
        return [normalized(item, replacements) for item in value]
    if isinstance(value, str):
        lookup = dict(replacements)
        pattern = "(?:" + "|".join(re.escape(old) for old, _ in replacements) + r")(?=/|$)"
        value = re.sub(pattern, lambda match: lookup[match[0]], value)
    return value


def published_link_text(data, replacements, archive_names=(), build_root=None):
    text = normalized(data.decode("utf-8"), replacements)
    # Independent public root labels no longer encode their original relative
    # positions. Resolve relative archive references before hiding those roots.
    relative = {
        name: normalized(str((build_root / name).resolve()), replacements)
        for name in archive_names
        if not Path(name).is_absolute()
    }
    if relative:
        pattern = (
            r"(?<![\w/.-])(?:"
            + "|".join(re.escape(name) for name in sorted(relative, key=len, reverse=True))
            + r")(?=$|[\s()])"
        )
        text = re.sub(pattern, lambda match: relative[match[0]], text)
    return text.encode()


def attest_sdk(args, evidence):
    spec = json.loads((args.source / "ci/ottplay-integration/upstream.json").read_text())["sdk"]
    allowed = {v["sha256"]: host for host, v in spec["assets"].items()}
    candidates = (
        [args.sdk_archive]
        if args.sdk_archive
        else sorted(
            set((args.source.parent / "downloads").glob("**/*.tar.bz2"))
            | set((args.sdk.parent / "downloads").glob("**/*.tar.bz2"))
        )
    )
    archive_path = None
    for candidate in candidates:
        archive_hash = digest(candidate)
        if archive_hash in allowed:
            archive_path = candidate
            break
    if archive_path is None:
        fail("Pinned SDK archive required: pass --sdk-archive or preserve bootstrap downloads")
    runtime_paths = {row["sdk_path"] for item in evidence.values() for row in item["runtime_inputs"]}
    if not runtime_paths:
        fail("No SDK runtime inputs were identified in the final link evidence")
    compiler_inputs = companion_compiler_inputs(args.sdk, evidence[COMPANION]) if COMPANION in evidence else None
    inputs = runtime_paths | ({row["sdk_path"] for row in compiler_inputs.values()} if compiler_inputs else set())
    hashes = {path: digest(args.sdk / path) for path in inputs}
    if compiler_inputs and any(hashes[row["sdk_path"]] != row["sha256"] for row in compiler_inputs.values()):
        fail("Companion compiler changed during SDK attestation")
    pending = set(inputs)
    prefix = spec["directory"] + "/"
    with tarfile.open(archive_path, "r|*") as archive:
        for member in archive:
            name = member.name.removeprefix("./")
            if not name.startswith(prefix) or name[len(prefix) :] not in pending:
                continue
            path = name[len(prefix) :]
            if not member.isfile():
                fail("SDK runtime archive member is not a regular file: " + path)
            if hashlib.sha256(archive.extractfile(member).read()).hexdigest() != hashes[path]:
                fail("Linked SDK runtime differs from pinned archive: " + path)
            pending.remove(path)
            if not pending:
                break
    if pending:
        fail("SDK runtime input absent from pinned archive: " + ", ".join(sorted(pending)))
    result = {
        "version": spec["version"],
        "host": allowed[archive_hash],
        "archive_sha256": archive_hash,
        "runtime_files_sha256": {path: hashes[path] for path in runtime_paths},
        "runtime_archive_match": "PASS",
    }
    if compiler_inputs:
        result["companion_compiler"] = {**compiler_inputs, "archive_match": "PASS"}
    return result


def link_evidence(elfs, source, sdk, companion=None):
    result, files, needed = {}, {}, set()
    readelf = sdk / "bin/arm-webos-linux-gnueabi-readelf"
    with tempfile.TemporaryDirectory(prefix="webos-elf-evidence-") as directory:
        for name, binary in sorted(elfs.items()):
            helper = name == COMPANION
            if helper and companion is None:
                fail("Missing companion source evidence")
            base = companion["bundle"] / name if helper else source / "pkg/link-evidence/stable" / name
            record = json.loads(Path(str(base) + ".link.json").read_text())
            link_map = Path(str(base) + ".link.map").read_bytes()
            trace = Path(str(base) + ".link.trace").read_bytes()
            for key, data in (("elf_sha256", binary), ("map_sha256", link_map), ("trace_sha256", trace)):
                if record.get(key) != hashlib.sha256(data).hexdigest():
                    fail("Link evidence differs from shipped ELF: " + name)
            if not record.get("archive_excluded") or b"libglibc_polyfills" in link_map + trace:
                fail("Unlicensed runtime archive was not excluded")
            replacements = [(str(source), "/build/ottplay-native"), (str(sdk), "/build/webos-sdk")]
            allowed_archives = set()
            archive_root = None
            archive_names = set()
            if helper:
                if b"LOAD " not in link_map or not trace.strip():
                    fail("Missing genuine companion linker map/input trace")
                roots, allowed_archives = companion_archives(record, link_map, trace, source, sdk)
                archive_root = roots["build_root"]
                archive_names = observed_archive_names(link_map, trace)
                replacements.extend(
                    (str(roots[key]), label)
                    for key, label in (
                        ("build_root", "/build/ottplay-companion"),
                        ("build_target", "/build/companion-target"),
                        ("rust_sysroot", "/build/companion-rust"),
                    )
                )
                record["link_receipt_sha256"] = digest(Path(str(base) + ".link.json"))
            replacements.append((str(Path.home()), "/home/build"))
            replacements.sort(key=lambda row: len(row[0]), reverse=True)
            path = Path(directory) / name
            path.write_bytes(binary)
            dynamic = subprocess.check_output([str(readelf), "-dW", str(path)], text=True)
            headers = subprocess.check_output([str(readelf), "-lW", str(path)], text=True)
            dependencies = re.findall(r"\(NEEDED\).*?\[([^\]]+)\]", dynamic)
            needed.update(dependencies)
            record["needed"] = dependencies
            record["interpreter"] = re.findall(r"Requesting program interpreter: ([^\]]+)", headers)
            record["runtime_inputs"] = runtime_inputs(
                (link_map + trace).decode(errors="replace"),
                source,
                sdk,
                allowed_archives=allowed_archives,
                archive_root=archive_root,
            )
            if helper:
                covered = {row["sdk_path"] for row in record["runtime_inputs"]}
                for archive_path in sorted(allowed_archives):
                    path = Path(archive_path)
                    if path.is_relative_to(sdk.resolve()):
                        if path.name not in RUNTIME:
                            fail("Unclassified static SDK archive: " + path.name)
                        relative = path.relative_to(sdk.resolve()).as_posix()
                        if relative not in covered:
                            record["runtime_inputs"].append(
                                {
                                    "source": RUNTIME[path.name],
                                    "archive_or_object": path.name,
                                    "member": "",
                                    "sdk_path": relative,
                                }
                            )
            for suffix, content in (("map", link_map), ("trace", trace)):
                content = published_link_text(content, replacements, archive_names, archive_root)
                files["evidence/" + name + ".link." + suffix] = content
                record["distributed_" + suffix + "_sha256"] = hashlib.sha256(content).hexdigest()
            record["evidence_transformation"] = (
                "source, SDK and user-home paths normalized; relative helper archive names canonicalized; original byte digests retained"
            )
            result[name] = normalized(record, replacements)
            files["evidence/" + name + ".readelf.txt"] = normalized(dynamic + "\n" + headers, replacements).encode()
    unknown = sorted(name for name in needed if name not in elfs and not SYSTEM.fullmatch(name))
    if unknown:
        fail("Unclassified runtime shared libraries: " + ", ".join(unknown))
    return result, files, sorted(needed - elfs.keys())


def append_file(archive, name, data):
    entry = tarfile.TarInfo(safe_name(name))
    entry.size = len(data)
    entry.mode = 0o644
    entry.mtime = 0
    archive.addfile(entry, io.BytesIO(data))


def collect(args):
    spec = json.loads(MANIFEST.read_text())
    metadata = json.loads(args.metadata.read_text())
    ipk = args.metadata.with_suffix(".ipk")
    primary = args.metadata.parent / metadata["corresponding_source"]["file"]
    if digest(ipk) != metadata["sha256"] or digest(primary) != metadata["corresponding_source"]["sha256"]:
        fail("IPK or primary source changed after validation")
    elfs = package_elfs(ipk)
    companion = companion_inputs(args, metadata, elfs)
    evidence, extra, system = link_evidence(elfs, args.source, args.sdk, companion)
    sdk_attestation = attest_sdk(args, evidence)
    if companion:
        binding = companion["binding"]
        if binding["source_closure"]["sdk_archive_sha256"] != sdk_attestation["archive_sha256"] or any(
            companion["receipt"]["sdk"][key] != sdk_attestation[key] for key in ("host", "version")
        ):
            fail("Companion uses a different SDK from the enclosing release")
        binding["sdk_runtime_source_coverage"] = "PASS"
        for name in ("source-closure.json", "SOURCE-MANIFEST.json"):
            extra["companion/" + name] = regular(companion["sources"] / name, JSON_LIMIT).read_bytes()
    sources = []
    for row in spec["inputs"]:
        path = fetch(row, args.cache)
        sources.append(dict(row, sha256=digest(path), bytes=path.stat().st_size))
        with tarfile.open(path, "r:*") as archive:
            root = archive.getmembers()[0].name.split("/")[0]
            for license_name in row["licenses"]:
                content = archive.extractfile(root + "/" + license_name).read()
                extra["licenses/" + row["id"] + "/" + license_name] = content
    closure = {
        "schema": 1,
        "ipk": {"file": ipk.name, "sha256": digest(ipk)},
        "primary_source": {
            "file": primary.name,
            "sha256": digest(primary),
            "snapshot_sha256": metadata["corresponding_source"]["snapshot_sha256"],
        },
        "source_inputs": sources,
        "sdk_recipe_reference": spec["sdk_recipe_reference"],
        "sdk_attestation": sdk_attestation,
        "application_build": metadata["build"],
        "shipped_elfs": evidence,
        "system_libraries": {
            "sonames": system,
            "distribution": "not copied into IPK or source supplement",
            "classification": "firmware OS graphics, media, window, C/C++ and loader interfaces; upstream GPL section 1 System Library basis",
            "basis": "Primary source LICENSING.md and THIRD-PARTY-NOTICES.md, GNU GPL v3 section 1. This is an explicit distribution classification, not a new license grant.",
        },
        "runtime_source_coverage": "PASS",
        "link_evidence_binding": "PASS",
        "primary_scope_gaps": {
            "glibc/GCC runtime source closure": "Sources and exact Buildroot recipes supplied in this supplement, bound to linked inputs",
            "LG firmware/sysroot": "Referenced, not redistributed; explicit firmware System Library classification recorded",
        },
        "independent_rebuild": "NOT_RUN",
        "bit_identical_rebuild": "NOT_PROVEN",
    }
    if companion:
        closure["companion"] = companion["binding"]
    extra["RUNTIME-SOURCE-MANIFEST.json"] = canonical(closure)
    extra["tools/webos-runtime-sources.py"] = Path(__file__).read_bytes()
    extra["tools/webos-runtime-sources.json"] = MANIFEST.read_bytes()
    extra["README.txt"] = (HERE / "webos-runtime-sources.README.txt").read_bytes()
    extra["tools/webos-runtime-sources.README.txt"] = extra["README.txt"]
    output = args.metadata.with_name(args.metadata.stem + "-runtime-source.tar.gz")
    with (
        output.open("wb") as raw,
        gzip.GzipFile(fileobj=raw, mode="wb", filename="", mtime=0) as compressed,
        tarfile.open(fileobj=compressed, mode="w|") as archive,
    ):
        for name, content in sorted(extra.items()):
            append_file(archive, name, content)
        for row in sources:
            path = args.cache / row["file"]
            entry = tarfile.TarInfo("sources/" + path.name)
            entry.size, entry.mode, entry.mtime = path.stat().st_size, 0o644, 0
            with path.open("rb") as stream:
                archive.addfile(entry, stream)
        if companion:
            path = companion["archive"]
            entry = tarfile.TarInfo(companion["binding"]["archive"]["file"])
            entry.size, entry.mode, entry.mtime = path.stat().st_size, 0o644, 0
            with path.open("rb") as stream:
                archive.addfile(entry, stream)
    source_set = {
        "schema": 1,
        "ipk": closure["ipk"],
        "source_archives": [closure["primary_source"], {"file": output.name, "sha256": digest(output)}],
        "runtime_source_coverage": "PASS",
        "link_evidence_binding": "PASS",
        "independent_rebuild": "NOT_RUN",
    }
    receipt = args.metadata.with_name(args.metadata.stem + "-source-set.json")
    receipt.write_bytes(canonical(source_set))
    print(receipt)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--metadata", required=True, type=Path, help="Native IPK metadata after primary source collection"
    )
    parser.add_argument("--source", required=True, type=Path, help="Exact native source holding link evidence")
    parser.add_argument("--sdk", required=True, type=Path)
    parser.add_argument("--sdk-archive", type=Path, help="Original pinned SDK archive, if outside bootstrap downloads")
    parser.add_argument("--cache", type=Path)
    parser.add_argument("--companion-bundle", type=Path, help="Exact packaged helper and real final-link receipts")
    parser.add_argument("--companion-sources", type=Path, help="Completed companion source closure directory")
    args = parser.parse_args()
    args.metadata = args.metadata.resolve()
    args.source, args.sdk = args.source.resolve(), args.sdk.resolve()
    args.cache = (args.cache or args.source.parent / "runtime-sources-cache").resolve()
    if args.companion_bundle is not None:
        args.companion_bundle = args.companion_bundle.resolve()
    if args.companion_sources is not None:
        args.companion_sources = args.companion_sources.resolve()
    collect(args)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        raise SystemExit("Runtime source collection failed: " + str(error)) from error
