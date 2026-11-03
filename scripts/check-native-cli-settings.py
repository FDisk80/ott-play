#!/usr/bin/env python3
"""Validate native settings fixtures against an explicitly trusted CLI checkout.

Imports parsers only: no client, network, configuration read, or device request.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ValueError("Cannot load the supplied CLI parser")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cli", type=Path, required=True,
                        help="Trusted ott.py or installed ott symlink; imported as Python code")
    parser.add_argument("--fixture", type=Path, default=Path(__file__).resolve().parents[1]
                        / "tests/fixtures/native-cli-settings.json")
    parser.add_argument("--native-source", type=Path,
                        help="Optional ott_settings.rs; compare its choices with the fixture")
    args = parser.parse_args()
    cli = args.cli.resolve(strict=True)
    settings_path = cli.with_name("player_settings.py")
    api = load("native_settings_cli", cli)
    settings = load("native_settings_parser", settings_path)
    fixture = json.loads(args.fixture.read_text(encoding="utf-8"))
    if fixture["version"] != 1:
        raise ValueError("Unknown fixture version")
    caps = api.capabilities_metadata(fixture["capabilities"])
    schema = fixture["schema"]
    if caps["player"]["runtime"] != schema["runtime"]:
        raise ValueError("Fixture runtime mismatch")
    request = {"op": "schema", "runtime": schema["runtime"], "limit": 20}
    settings.metadata(api, schema, request)
    for data in fixture["gets"]:
        settings.metadata(api, data, {"op": "get", "runtime": schema["runtime"],
                                      "id": data["setting"]["id"]})
    broken = copy.deepcopy(schema)
    removed = 0
    for row in broken["settings"]:
        for choice in row.get("choices", []):
            del choice["aliases"]
            removed += 1
    if removed != 2:
        raise ValueError("Fixture must exercise both native choice descriptors")
    try:
        settings.metadata(api, broken, request)
    except api.Error:
        pass
    else:
        raise ValueError("Parser accepted choices without required aliases")
    if args.native_source:
        choices = [json.loads(value) for value in re.findall(
            r'result\["choices"\] = json!\((\[.*?\])\);',
            args.native_source.read_text(encoding="utf-8"))]
        expected = [row["choices"] for row in schema["settings"] if "choices" in row]
        if choices != expected:
            raise ValueError("Native source choices differ from the verified fixture")
    print(json.dumps({"status": "passed", "checks": {"capabilities": True,
          "schema": True, "gets": len(fixture["gets"]), "missing_aliases_rejected": True,
          "source_choices": bool(args.native_source)},
          "cli_sha256": hashlib.sha256(cli.read_bytes()).hexdigest(),
          "settings_sha256": hashlib.sha256(settings_path.read_bytes()).hexdigest()},
          sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, TypeError) as error:
        print("Native CLI settings conformance failed: " + str(error), file=sys.stderr)
        sys.exit(1)
