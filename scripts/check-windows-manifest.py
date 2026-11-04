#!/usr/bin/env python3
"""Read embedded Windows manifests without loading imports or running code."""
import argparse
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path
import xml.etree.ElementTree as ET


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def xml_structure(data):
    require(0 < len(data) <= 65536, "Manifest size is outside the inspection limit")
    root = ET.fromstring(data)
    require(root.tag == "{urn:schemas-microsoft-com:asm.v1}assembly", "Wrong manifest root")

    def node(element):
        return (element.tag, sorted(element.attrib.items()),
                (element.text or "").strip(), (element.tail or "").strip(),
                [node(child) for child in element])

    return node(root)


def embedded_manifest(binary):
    require(os.name == "nt", "Embedded manifest inspection requires Windows")
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.LoadLibraryExW.argtypes = [wintypes.LPCWSTR, wintypes.HANDLE, wintypes.DWORD]
    kernel.LoadLibraryExW.restype = wintypes.HMODULE
    kernel.FindResourceW.argtypes = [wintypes.HMODULE, ctypes.c_void_p, ctypes.c_void_p]
    kernel.FindResourceW.restype = ctypes.c_void_p
    kernel.SizeofResource.argtypes = [wintypes.HMODULE, ctypes.c_void_p]
    kernel.SizeofResource.restype = wintypes.DWORD
    kernel.LoadResource.argtypes = [wintypes.HMODULE, ctypes.c_void_p]
    kernel.LoadResource.restype = ctypes.c_void_p
    kernel.LockResource.argtypes = [ctypes.c_void_p]
    kernel.LockResource.restype = ctypes.c_void_p
    kernel.FreeLibrary.argtypes = [wintypes.HMODULE]
    kernel.FreeLibrary.restype = wintypes.BOOL
    # DATAFILE_EXCLUSIVE | IMAGE_RESOURCE: no imports, DllMain or entry point.
    handle = kernel.LoadLibraryExW(str(binary.resolve()), None, 0x40 | 0x20)
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        resource = kernel.FindResourceW(handle, ctypes.c_void_p(1), ctypes.c_void_p(24))
        if not resource:
            raise ctypes.WinError(ctypes.get_last_error())
        size = kernel.SizeofResource(handle, resource)
        require(0 < size <= 65536, "Missing or oversized RT_MANIFEST")
        loaded = kernel.LoadResource(handle, resource)
        if not loaded:
            raise ctypes.WinError(ctypes.get_last_error())
        address = kernel.LockResource(loaded)
        if not address:
            raise ctypes.WinError(ctypes.get_last_error())
        return ctypes.string_at(address, size)
    finally:
        if not kernel.FreeLibrary(handle):
            raise ctypes.WinError(ctypes.get_last_error())


def test_executables(text):
    selected = {}
    for line in text.splitlines():
        record = json.loads(line)
        name = record.get("target", {}).get("name")
        if (record.get("reason") != "compiler-artifact"
                or not record.get("profile", {}).get("test")
                or name not in {"ottplay_tauri_lib", "ottplay-tauri"}):
            continue
        require(name not in selected, "Duplicate test executable")
        require(record.get("executable"), "Test compiler artifact has no executable")
        selected[name] = Path(record["executable"])
    require("ottplay_tauri_lib" in selected, "Library test executable not found")
    return list(selected.values())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", action="append", default=[], type=Path)
    parser.add_argument("--cargo-json", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    expected = (root / "src-tauri/windows-app-manifest.xml").read_bytes()
    binaries = args.binary
    if args.cargo_json:
        binaries += test_executables(args.cargo_json.read_text(encoding="utf-8-sig"))
    require(binaries, "No executables selected")
    rows = []
    report = {"schema": 1, "source_sha": os.environ.get("GITHUB_SHA"),
              "expected_manifest_sha256": hashlib.sha256(expected).hexdigest(),
              "status": "failed", "executables": rows}
    try:
        for binary in binaries:
            binary = binary.resolve()
            require(binary.is_file() and binary.suffix.lower() == ".exe", "Missing executable")
            relative = binary.relative_to(root / "target")
            manifest = embedded_manifest(binary)
            with binary.open("rb") as stream:
                digest = hashlib.file_digest(stream, "sha256").hexdigest()
            row = {"path": str(relative), "sha256": digest,
                   "manifest_sha256": hashlib.sha256(manifest).hexdigest(),
                   "manifest": ET.tostring(ET.fromstring(manifest), encoding="unicode"), "status": "failed"}
            rows.append(row)
            require(xml_structure(manifest) == xml_structure(expected),
                    f"Embedded manifest differs from the Tauri default: {relative}")
            row["status"] = "passed"
        report["status"] = "passed"
    finally:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"PASS: exact default RT_MANIFEST in {len(rows)} Windows executables")


if __name__ == "__main__":
    main()
