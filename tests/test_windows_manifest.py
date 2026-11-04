#!/usr/bin/env python3
"""Portable checks for fail-closed manifest and Cargo artifact selection."""
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("windows_manifest", ROOT / "scripts/check-windows-manifest.py")
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)
MANIFEST = (ROOT / "src-tauri/windows-app-manifest.xml").read_bytes()


class ManifestTests(unittest.TestCase):
    def test_only_whitespace_and_attribute_order_are_ignored(self):
        root = CHECK.ET.fromstring(MANIFEST)
        for element in root.iter():
            element.text = element.tail = None
            element.attrib = dict(reversed(list(element.attrib.items())))
        compact = CHECK.ET.tostring(root)
        self.assertEqual(CHECK.xml_structure(MANIFEST), CHECK.xml_structure(compact))

    def test_missing_or_changed_dependency_is_not_accepted(self):
        expected = CHECK.xml_structure(MANIFEST)
        for old, new in [(b"6.0.0.0", b"5.0.0.0"),
                         (b"Microsoft.Windows.Common-Controls", b"Other.Dependency"),
                         (b"6595b64144ccf1df", b"0000000000000000"),
                         (b'processorArchitecture="*"', b'processorArchitecture="amd64"')]:
            with self.subTest(old=old):
                self.assertNotEqual(expected, CHECK.xml_structure(MANIFEST.replace(old, new)))

    def test_added_privilege_requirement_is_not_accepted(self):
        modified = MANIFEST.replace(b"</assembly>", b'<trustInfo><security level="requireAdministrator"/></trustInfo></assembly>')
        self.assertNotEqual(CHECK.xml_structure(MANIFEST), CHECK.xml_structure(modified))

    def test_bad_xml_and_size_fail(self):
        for data in [b"", b"x" * 65537, b"<assembly>", b"<other/>"]:
            with self.subTest(data=data[:20]), self.assertRaises((RuntimeError, CHECK.ET.ParseError)):
                CHECK.xml_structure(data)

    def test_exact_test_artifacts_selected(self):
        record = {"reason": "compiler-artifact", "target": {"name": "ottplay_tauri_lib"},
                  "profile": {"test": True}, "executable": "target/debug/deps/ott.exe"}
        ignored = {**record, "target": {"name": "dependency"}}
        production = {**record, "profile": {"test": False}}
        text = "\n".join(map(json.dumps, [ignored, production, record, {"reason": "build-finished"}]))
        self.assertEqual(CHECK.test_executables(text), [Path(record["executable"])])
        for invalid in ["", json.dumps(ignored), json.dumps(production),
                        json.dumps(record) + "\n" + json.dumps(record),
                        json.dumps({**record, "executable": None})]:
            with self.subTest(invalid=invalid), self.assertRaises(RuntimeError):
                CHECK.test_executables(invalid)


if __name__ == "__main__":
    unittest.main()
