#!/usr/bin/env python3
"""Update an existing Developer Mode installation through its existing Ares alias.

Default: verify the official release and print a plan, without contacting a TV.
--preflight enables read-only device checks; --apply enables an in-place update.
Homebrew installation, key acquisition, uninstall and automatic retry are absent.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import io
import json
import os
import re
import shlex
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
import uuid
from contextlib import contextmanager
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
APP_ID = "com.openottplay.player.native"
APP_DIR = "/media/developer/apps/usr/palm/applications/" + APP_ID
REPOSITORY = "open-ott-play/ottplay-foss"
DEVICE_ID_COMMAND = '/usr/bin/luna-send-pub -n 1 luna://com.webos.service.sm/deviceid/getIDs \'{"idType":["LGUDID"]}\''
STATE_ROOTS = ("ottplay-profile.json", "ottplay-control.json", "ott-state")
STATE_LIMIT = 32 * 1024 * 1024
OUTPUT_LIMIT = 64 * 1024 * 1024
CAPTURE_PROTOCOL = "novacom-framed-v1"
VERSION = r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)"
ANSI = re.compile(r"\x1b\[[0-9;]*m")
RELEASE_BINDINGS = (
    "tag",
    "version",
    "sha256",
    "source_sha",
    "release_id",
    "source_set_sha256",
)
PRIVATE_INPUT_BOOTSTRAP = r"""
"use strict";
const fs = require("node:fs");
try {
    const [wrapperPath, root, tool, compatibility, ...args] = process.argv.slice(1);
    if (tool !== "ares-novacom") throw new Error("unsupported private transfer");
    const wrapper = require(wrapperPath);
    const {entry, novacom} = wrapper.validateCli(root, tool);
    if (args.length === 1 && args[0] === "--verify-private-input") process.exit(0);
    const fdText = args.pop();
    if (!/^[0-9]+$/.test(fdText)) throw new Error("invalid private input");
    const fd = Number(fdText), stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077)) {
        throw new Error("unsafe private input");
    }
    const prototype = require(novacom).Session.prototype;
    const original = prototype.run;
    if (typeof original !== "function") throw new Error("unsupported private transfer");
    let used = false;
    prototype.run = function(cmd, stdin, stdout, stderr, next) {
        if (used) return next(new Error("private input already consumed"));
        used = true;
        const input = fs.createReadStream(null, {fd, start: 0, autoClose: false});
        return original.call(this, cmd, input, stdout, stderr, function(...result) {
            input.destroy();
            next(...result);
        });
    };
    if (compatibility === "1") wrapper.run([root, tool, ...args]);
    else {
        process.argv = [process.execPath, entry, ...args];
        require(entry);
    }
} catch (_) {
    process.stderr.write("private input transport unavailable\n");
    process.exitCode = 1;
}
"""


class UpdateError(ValueError):
    """Only static codes are reported; never include command output or secrets."""

    def __init__(self, code):
        self.code = code
        super().__init__(code)


def check(condition, code):
    if not condition:
        raise UpdateError(code)


def load_module(filename):
    spec = importlib.util.spec_from_file_location(
        "native_update_" + filename.replace("-", "_"), ROOT / "scripts" / filename
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def digest(data):
    return hashlib.sha256(data).hexdigest()


def require_capture_protocol(snapshot):
    check(
        isinstance(snapshot, dict) and snapshot.get("capture_protocol") == CAPTURE_PROTOCOL,
        "snapshot_capture_unverified",
    )


def require_device_binding(identity):
    check(
        isinstance(identity, dict)
        and identity.get("binding") == "lgudid-v1"
        and isinstance(identity.get("device_id_sha256"), str)
        and re.fullmatch(r"[0-9a-f]{64}", identity["device_id_sha256"]),
        "journal_device_binding_missing",
    )


def version_tuple(value):
    check(isinstance(value, str) and re.fullmatch(VERSION, value), "invalid_version")
    return tuple(map(int, value.split(".")))


def tag_version(tag):
    match = re.fullmatch(
        r"native-webos-v(" + VERSION + r")(?:-(?:beta|rc)\.[1-9][0-9]*)?", tag
    )
    check(match is not None, "invalid_release_tag")
    return match[1]


def json_bytes(data):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            check(key not in result, "duplicate_json_key")
            result[key] = value
        return result

    check(len(data) <= 8 * 1024 * 1024, "json_limit")
    try:
        return json.loads(data, object_pairs_hook=unique)
    except (UnicodeError, json.JSONDecodeError):
        raise UpdateError("invalid_json") from None


def cli_lines(text):
    check(isinstance(text, str) and len(text) <= 8 * 1024 * 1024, "invalid_cli_output")
    for line in ANSI.sub("", text).splitlines():
        if not line.strip() or re.fullmatch(
            r"\[Info\] Set target device : [^\r\n]+", line
        ):
            continue
        yield line


def parse_installed(text):
    apps, current = [], None
    for line in cli_lines(text):
        if line.startswith("id : "):
            current = {"id": line[5:]}
            check(
                re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", current["id"]),
                "invalid_app_inventory",
            )
            check(
                all(row["id"] != current["id"] for row in apps),
                "duplicate_app_identity",
            )
            apps.append(current)
        elif current is not None and not line.startswith("-") and " : " in line:
            key, value = line.split(" : ", 1)
            check(key not in current, "duplicate_app_field")
            current[key] = value
        elif current is None:
            raise UpdateError("invalid_app_inventory")
    for app in apps:
        if app["id"] == APP_ID:
            version_tuple(app.get("version"))
            check(
                app.get("folderPath", "").rstrip("/") == APP_DIR,
                "not_developer_mode_installation",
            )
            check(app.get("type") == "native", "not_native_installation")
            app["folderPath"] = APP_DIR
    return apps


def parse_system_info(text):
    allowed = {"modelName", "sdkVersion", "firmwareVersion", "boardType", "otaId"}
    result = {}
    for line in cli_lines(text):
        key, separator, value = line.partition(" : ")
        check(
            separator
            and key in allowed
            and key not in result
            and value
            and len(value) <= 256,
            "invalid_system_info",
        )
        check(all(char.isprintable() for char in value), "invalid_system_info")
        result[key] = value
    check(
        {"modelName", "sdkVersion", "firmwareVersion"} <= result.keys(),
        "incomplete_system_info",
    )
    return result


def verify_release_files(directory, tag, release_info, ref_info):
    """Bind cached bytes to the live official release, not just adjacent files."""
    directory = Path(directory)
    version = tag_version(tag)
    check(
        release_info.get("tag_name") == tag
        and release_info.get("draft") is False
        and type(release_info.get("id")) is int
        and release_info["id"] > 0
        and release_info.get("html_url")
        == f"https://github.com/{REPOSITORY}/releases/tag/{tag}",
        "unofficial_release",
    )
    obj = ref_info.get("object", {})
    check(
        ref_info.get("ref") == "refs/tags/" + tag
        and obj.get("type") == "commit"
        and re.fullmatch(r"[0-9a-f]{40}", obj.get("sha", "")),
        "invalid_release_tag_target",
    )
    stem = "ottplay-native-webos-" + version
    names = [
        stem + suffix for suffix in (".ipk", ".json", ".sha256", "-source-set.json")
    ]
    assets = release_info.get("assets", [])
    check(isinstance(assets, list), "invalid_release_assets")
    for name in names:
        matches = [row for row in assets if row.get("name") == name]
        check(len(matches) == 1, "missing_or_duplicate_release_asset")
        asset = matches[0]
        check(
            type(asset.get("id")) is int
            and asset["id"] > 0
            and asset.get("state") == "uploaded"
            and asset.get("browser_download_url")
            == f"https://github.com/{REPOSITORY}/releases/download/{tag}/{name}",
            "unofficial_release_asset",
        )
        expected = asset.get("digest", "")
        check(
            isinstance(expected, str)
            and re.fullmatch(r"sha256:[0-9a-f]{64}", expected),
            "missing_official_asset_digest",
        )
        path = directory / name
        check(not path.is_symlink() and path.is_file(), "missing_release_file")
        limit = 128 * 1024 * 1024 if name.endswith(".ipk") else 8 * 1024 * 1024
        check(
            0 < path.stat().st_size <= limit
            and path.stat().st_size == asset.get("size"),
            "release_asset_size_mismatch",
        )
        with path.open("rb") as stream:
            check(
                "sha256:" + hashlib.file_digest(stream, "sha256").hexdigest()
                == expected,
                "release_asset_hash_mismatch",
            )
    metadata = json_bytes((directory / names[1]).read_bytes())
    check(
        metadata.get("application", {}).get("id") == APP_ID
        and metadata["application"].get("version") == version,
        "release_identity_mismatch",
    )
    checksum = (directory / names[2]).read_text().strip()
    check(
        checksum == metadata.get("sha256", "") + "  " + names[0],
        "release_checksum_mismatch",
    )
    verifier = load_module("verify-webos-native-release.py")
    try:
        # Full IPK validation includes app/service IDs, native ARM format and private-file rejection.
        actual = verifier.build.verify_ipk(
            directory / names[0], {"application": metadata["application"]}
        )
    except (ValueError, KeyError, OSError, tarfile.TarError):
        raise UpdateError("invalid_native_package") from None
    for field in (
        "application",
        "sha256",
        "size",
        "architecture",
        "type",
        "rootRequired",
        "companion",
    ):
        check(
            actual.get(field) == metadata.get(field),
            "release_package_metadata_mismatch",
        )
    check(
        metadata.get("build", {}).get("ipk_sha256") == metadata["sha256"],
        "release_build_hash_mismatch",
    )
    source_set = json_bytes((directory / names[3]).read_bytes())
    check(
        source_set.get("ipk") == {"file": names[0], "sha256": metadata["sha256"]}
        and source_set.get("schema") == 1,
        "source_set_identity_mismatch",
    )
    primary = metadata.get("corresponding_source", {})
    archives = source_set.get("source_archives", [])
    check(
        isinstance(archives, list)
        and len(archives) == 2
        and {row.get("file") for row in archives}
        == {stem + "-source.tar.gz", stem + "-runtime-source.tar.gz"}
        and all(
            re.fullmatch(r"[0-9a-f]{64}", row.get("sha256", "")) for row in archives
        )
        and any(
            row.get("file") == primary.get("file")
            and row.get("sha256") == primary.get("sha256")
            and row.get("snapshot_sha256") == primary.get("snapshot_sha256")
            for row in archives
        ),
        "source_set_primary_mismatch",
    )
    files = verifier.build.tar_files(
        verifier.build.ar_members((directory / names[0]).read_bytes())["data.tar.gz"]
    )
    payload = {}
    prefixes = {
        "app/": "usr/palm/applications/" + APP_ID + "/",
        "service/": "usr/palm/services/" + APP_ID + ".storage/",
    }
    for path, raw in files.items():
        for label, prefix in prefixes.items():
            if path.startswith(prefix):
                payload[label + path[len(prefix) :]] = digest(raw)
    check(
        {"app/plxnative", "app/appinfo.json", "service/plxnative-storage"}
        <= payload.keys(),
        "incomplete_native_payload",
    )
    return {
        "tag": tag,
        "version": version,
        "sha256": metadata["sha256"],
        "ipk": directory / names[0],
        "source_sha": obj["sha"],
        "release_id": release_info["id"],
        "source_set_sha256": digest((directory / names[3]).read_bytes()),
        "payload": payload,
    }


def official_release(tag, directory):
    version = tag_version(tag)
    publisher = load_module("publish-webos-native.py")
    try:
        release = publisher.api_json(f"/repos/{REPOSITORY}/releases/tags/{tag}")
        ref = publisher.api_json(f"/repos/{REPOSITORY}/git/ref/tags/{tag}")
        check(
            release.get("tag_name") == tag and release.get("draft") is False,
            "unofficial_release",
        )
        directory = Path(directory)
        check(not directory.is_symlink(), "unsafe_bundle_directory")
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        for suffix in (".ipk", ".json", ".sha256", "-source-set.json"):
            name = "ottplay-native-webos-" + version + suffix
            destination = directory / name
            check(not destination.is_symlink(), "unsafe_release_file")
            if not destination.exists():
                publisher.fetch_public_asset(
                    f"https://github.com/{REPOSITORY}/releases/download/{tag}/{name}",
                    destination,
                    128 * 1024 * 1024 if suffix == ".ipk" else 8 * 1024 * 1024,
                )
        result = verify_release_files(directory, tag, release, ref)
        check(
            publisher.api_json(f"/repos/{REPOSITORY}/git/ref/tags/{tag}") == ref,
            "release_tag_changed",
        )
        return result
    except UpdateError:
        raise
    except (
        OSError,
        ValueError,
        KeyError,
        TypeError,
        AttributeError,
        subprocess.SubprocessError,
        tarfile.TarError,
    ):
        raise UpdateError("official_release_verification_failed") from None


def command_error(raw):
    message = raw.lower()
    if (
        b"developer mode session has expired" in message
        or b"developer mode is disabled" in message
    ):
        return "developer_mode_expired_or_disabled"
    if b"key server" in message and (
        b"unavailable" in message or b"not running" in message
    ):
        return "key_server_unavailable"
    if any(
        value in message
        for value in (
            b"permission denied",
            b"authentication",
            b"private key",
            b"all configured authentication",
        )
    ):
        return "authentication_required"
    if any(
        value in message
        for value in (
            b"connection refused",
            b"no route to host",
            b"timed out",
            b"enotfound",
        )
    ):
        return "device_unavailable"
    return "ares_command_failed"


def run_command(command, *, operation, timeout=30, data=None, private_input=False, keep_stdin_open=False):
    check(type(keep_stdin_open) is bool and not (keep_stdin_open and (data is not None or private_input)), "invalid_held_input")
    environment = {**os.environ, "DEBUG": "", "NODE_DEBUG": ""}
    with (
        tempfile.TemporaryFile() as output,
        tempfile.TemporaryFile() as errors,
        tempfile.TemporaryFile() as source,
    ):
        check(data is None or len(data) <= STATE_LIMIT, "private_state_limit")
        if data is not None:
            source.write(data)
            source.seek(0)
        check(
            not private_input or (os.name == "posix" and data is not None),
            "private_input_unavailable",
        )
        command = list(command)
        input_options = {}
        if private_input:
            # Ares attaches a global flowing stdin listener before SSH setup.
            # Pass a separate private descriptor; the bootstrap creates its
            # paused ReadStream only when Session.run is invoked.
            command.append(str(source.fileno()))
            input_options["pass_fds"] = (source.fileno(),)
        process = None
        try:
            process = subprocess.Popen(
                command,
                stdin=subprocess.PIPE if keep_stdin_open else (
                    source if data is not None and not private_input else subprocess.DEVNULL
                ),
                stdout=output,
                stderr=errors,
                env=environment,
                start_new_session=True,
                **input_options,
            )
            deadline = time.monotonic() + timeout
            while process.poll() is None:
                check(
                    os.fstat(output.fileno()).st_size <= OUTPUT_LIMIT
                    and os.fstat(errors.fileno()).st_size <= 1024 * 1024,
                    "ares_output_limit",
                )
                check(time.monotonic() < deadline, operation + "_timeout")
                time.sleep(0.05)
        except OSError:
            raise UpdateError("ares_execution_unavailable") from None
        finally:
            try:
                if process is not None and process.poll() is None:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    process.wait()
            finally:
                if process is not None and process.stdin is not None:
                    process.stdin.close()
        check(
            os.fstat(output.fileno()).st_size <= OUTPUT_LIMIT
            and os.fstat(errors.fileno()).st_size <= 1024 * 1024,
            "ares_output_limit",
        )
        if process.returncode:
            errors.seek(0)
            raise UpdateError(command_error(errors.read(8192)))
        output.seek(0)
        return output.read(OUTPUT_LIMIT + 1)


def private_directory(path):
    path = Path(path)
    check(not path.is_symlink(), "unsafe_private_directory")
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    check(
        path.is_dir()
        and (not hasattr(os, "getuid") or path.stat().st_uid == os.getuid()),
        "unsafe_private_directory",
    )
    path.chmod(0o700)
    return path


def write_private(path, data):
    check(not path.is_symlink(), "unsafe_private_file")
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def state_archive(data):
    check(len(data) <= STATE_LIMIT, "private_state_limit")
    verifier = load_module("verify-webos-native-release.py")
    rows, content, total = {}, {}, 0
    with tarfile.open(
        fileobj=io.BytesIO(data), mode="r|", tarinfo=verifier.BoundedTarInfo
    ) as archive:
        for member in archive:
            name = str(PurePosixPath(member.name))
            parts = PurePosixPath(name).parts
            check(
                parts
                and parts[0] in STATE_ROOTS
                and ".." not in parts
                and not name.startswith("/")
                and "\\" not in name
                and name not in rows
                and len(rows) < 4096,
                "unsafe_private_state_path",
            )
            check(
                (member.isfile() or member.isdir())
                and not member.issparse()
                and member.mode & ~0o777 == 0,
                "unsafe_private_state_type",
            )
            total += member.size
            check(
                0 <= member.size <= 8 * 1024 * 1024 and total <= STATE_LIMIT,
                "private_state_limit",
            )
            raw = archive.extractfile(member).read() if member.isfile() else b""
            check(len(raw) == member.size or member.isdir(), "private_state_truncated")
            rows[name] = {
                "sha256": digest(raw),
                "mode": member.mode,
                "uid": member.uid,
                "gid": member.gid,
                "directory": member.isdir(),
            }
            content[name] = raw
        # tarfile's streaming reader accepts EOF between complete members. That
        # is not a complete snapshot: require tar's two end blocks and padding.
        padding = data[archive.offset:]
        check(
            len(data) % 512 == 0 and len(padding) >= 1024 and not any(padding),
            "private_state_truncated",
        )
    return rows, content


class Ares:
    def __init__(
        self, alias, cli_root=None, *, runner=run_command, compatibility=False
    ):
        check(os.name == "posix", "ares_update_requires_macos_or_linux")
        check(
            re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}", alias),
            "invalid_device_alias",
        )
        self.alias, self.runner = alias, runner
        self.compatibility = compatibility
        self.cli_root = Path(cli_root).expanduser() if cli_root else None
        check(
            not compatibility or self.cli_root is not None,
            "compatibility_requires_ares_root",
        )
        if self.cli_root:
            package = json_bytes((self.cli_root / "package.json").read_bytes())
            check(
                package.get("name") == "@webos-tools/cli"
                and package.get("version") == "3.2.6",
                "unsupported_ares_version",
            )

    def command(self, tool, *arguments, operation="preflight", timeout=30, data=None, keep_stdin_open=False):
        check(not keep_stdin_open or (tool == "ares-novacom" and data is None), "invalid_held_input")
        if data is not None:
            check(tool == "ares-novacom", "unsupported_private_transfer")
            return self.runner(
                [*self.private_input_command(), *arguments],
                operation=operation,
                timeout=timeout,
                data=data,
                private_input=True,
            )
        if self.cli_root:
            command = ["node", str(self.cli_root / "bin" / (tool + ".js"))]
            if self.compatibility and tool != "ares-setup-device":
                wrapper = ROOT / "native/webos/ares-compat.cjs"
                check(wrapper.is_file(), "ares_compatibility_wrapper_missing")
                command = ["node", str(wrapper), str(self.cli_root), tool]
        else:
            executable = shutil.which(tool)
            check(executable is not None, "ares_not_installed")
            command = [executable]
        return self.runner(
            [*command, *arguments], operation=operation, timeout=timeout, data=data,
            **({"keep_stdin_open": True} if keep_stdin_open else {}),
        )

    def private_input_command(self):
        root = self.cli_root
        if root is None:
            executable = shutil.which("ares-novacom")
            check(executable is not None, "ares_not_installed")
            root = Path(executable).resolve().parents[1]
        wrapper = ROOT / "native/webos/ares-compat.cjs"
        check(wrapper.is_file(), "ares_compatibility_wrapper_missing")
        return [
            "node",
            "-e",
            PRIVATE_INPUT_BOOTSTRAP,
            str(wrapper),
            str(root),
            "ares-novacom",
            "1" if self.compatibility else "0",
        ]

    def device(self, tool, *arguments, **kwargs):
        return self.command(tool, "--device", self.alias, *arguments, **kwargs)

    def identity(self):
        inventory = json_bytes(self.command("ares-setup-device", "--listfull"))
        check(isinstance(inventory, list), "invalid_alias_inventory")
        aliases = [row for row in inventory if row.get("name") == self.alias]
        check(len(aliases) == 1, "missing_or_duplicate_alias")
        alias = aliases[0]
        info = alias.get("deviceinfo", {})
        check(
            alias.get("profile") == "tv"
            and info.get("user") == "prisoner"
            and str(info.get("port")) == "9922",
            "not_developer_mode_alias",
        )
        check(isinstance(info.get("ip"), str) and info["ip"], "invalid_device_identity")
        system = parse_system_info(
            self.device("ares-device", "--system-info").decode("utf-8")
        )
        try:
            response = json_bytes(
                "\n".join(
                    cli_lines(self.remote(DEVICE_ID_COMMAND, keep_stdin_open=True).decode("utf-8"))
                ).encode()
            )
            check(
                isinstance(response, dict) and response.get("returnValue") is True,
                "device_identity_unavailable",
            )
            rows = response.get("idList")
            check(
                isinstance(rows, list) and len(rows) == 1, "device_identity_unavailable"
            )
            row = rows[0]
            check(
                isinstance(row, dict) and row.get("idType") == "LGUDID",
                "device_identity_unavailable",
            )
            raw_id = row.get("idValue")
            check(
                isinstance(raw_id, str)
                and re.fullmatch(
                    r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}", raw_id
                ),
                "device_identity_unavailable",
            )
            device_id = uuid.UUID(raw_id)
            check(device_id.int != 0, "device_identity_unavailable")
            device_hash = digest(
                b"ottplay-lgudid-v1\0" + str(device_id).encode("ascii")
            )
        except (UpdateError, ValueError, UnicodeError):
            raise UpdateError("device_identity_unavailable") from None
        # The read-only device ID binds recovery to the TV; this is not SSH peer attestation.
        bound = {
            "alias": self.alias,
            "endpoint": {key: info.get(key) for key in ("ip", "port", "user", "uid")},
            "system": system,
            "device_id_sha256": device_hash,
        }
        return {
            "alias": self.alias,
            "fingerprint": digest(json.dumps(bound, sort_keys=True).encode()),
            "model": system["modelName"],
            "scope": "lgudid-with-alias-endpoint-and-model",
            "binding": "lgudid-v1",
            "device_id_sha256": device_hash,
        }

    def installed(self):
        apps = parse_installed(
            self.device("ares-install", "--listfull").decode("utf-8")
        )
        return next((row for row in apps if row["id"] == APP_ID), None)

    def running(self):
        # Match the pinned CLI's public-bus/display-0 selection, but require
        # complete typed responses instead of interpreting missing stdout as [].
        command = "/usr/bin/luna-send-pub -n 1 "
        params = " '{\"subscribe\":false}'"
        sessions = json_bytes(self.remote(
            command + "luna://com.webos.service.sessionmanager/getSessionList" + params,
            keep_stdin_open=True,
        ))
        check(
            isinstance(sessions, dict) and type(sessions.get("returnValue")) is bool,
            "invalid_running_sessions",
        )
        if sessions["returnValue"]:
            rows = sessions.get("sessionList")
            check(isinstance(rows, list) and 0 < len(rows) <= 256, "invalid_running_sessions")
            selected = []
            for row in rows:
                check(isinstance(row, dict), "invalid_running_sessions")
                device = row.get("deviceSetInfo")
                check(
                    isinstance(device, dict)
                    and type(device.get("displayId")) is int
                    and device["displayId"] >= 0,
                    "invalid_running_sessions",
                )
                if device["displayId"] == 0:
                    selected.append(row.get("sessionId"))
            check(len(selected) == 1, "invalid_running_sessions")
            session_id = selected[0]
            check(
                (type(session_id) is int and 0 <= session_id <= 2**53 - 1)
                or (isinstance(session_id, str)
                    and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}", session_id)),
                "invalid_running_sessions",
            )
            # The SDK omits -c for numeric zero, but includes it for string "0".
            if session_id:
                command += "-c " + shlex.quote(str(session_id)) + " "
        response = json_bytes(self.remote(
            command + "luna://com.webos.applicationManager/dev/running" + params,
            keep_stdin_open=True,
        ))
        check(
            isinstance(response, dict) and response.get("returnValue") is True
            and isinstance(response.get("running"), list) and len(response["running"]) <= 4096,
            "invalid_running_inventory",
        )
        result = set()
        for row in response["running"]:
            check(isinstance(row, dict), "invalid_running_inventory")
            app_id = row.get("id")
            check(
                isinstance(app_id, str) and len(app_id) <= 256
                and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9._-]+", app_id),
                "invalid_running_inventory",
            )
            result.add(app_id)
        return result

    def remote(self, command, *, data=None, keep_stdin_open=False):
        # SDK 3.2.6 can report SSH exit before draining stdout. A fresh trailing
        # frame proves ordered-stream completion; it is not peer authentication.
        check(isinstance(command, str) and "\0" not in command, "invalid_remote_command")
        token = "OTT_NATIVE_STREAM_" + uuid.uuid4().hex
        begin, end = token + "_BEGIN\n", "\n" + token + "_END:"
        wrapped = (
            "printf '%s' " + shlex.quote(begin) + "; (\n" + command
            + "\n); ott_status=$?; printf '%s%s\\n' " + shlex.quote(end)
            + ' "$ott_status"; exit "$ott_status"'
        )
        check(len(wrapped.encode("utf-8")) <= 1024 * 1024, "remote_command_limit")
        raw = self.device(
            "ares-novacom", "--run", wrapped, operation="private_state", data=data,
            **({"keep_stdin_open": True} if keep_stdin_open else {}),
        )
        check(isinstance(raw, bytes) and len(raw) <= OUTPUT_LIMIT, "invalid_remote_output")
        prefix, separator, framed = raw.partition(begin.encode("ascii"))
        try:
            valid_prefix = not list(cli_lines(prefix.decode("utf-8")))
        except UnicodeError:
            valid_prefix = False
        check(
            separator and valid_prefix and raw.count(begin.encode("ascii")) == 1,
            "incomplete_remote_output",
        )
        payload, separator, status = framed.rpartition(end.encode("ascii"))
        check(
            separator and status == b"0\n" and framed.count(end.encode("ascii")) == 1,
            "incomplete_remote_output",
        )
        return payload

    def native_process(self):
        command = 'for p in /proc/[0-9]*; do [ -d "$p" ] || continue; '
        command += 'n=$(cat "$p/comm" 2>/dev/null) || { [ ! -d "$p" ] && continue; exit 77; }; '
        command += '[ "$n" = plxnative ] || continue; '
        command += 'x=$(readlink "$p/exe" 2>/dev/null) || { [ ! -d "$p" ] && continue; exit 77; }; '
        command += (
            'if [ "$x" = ' + shlex.quote(APP_DIR + "/plxnative") + ' ] || [ "$x" = '
        )
        command += (
            shlex.quote(APP_DIR + "/plxnative (deleted)")
            + " ]; then printf 'OTT_NATIVE_RUNNING\\n'; fi; done"
        )
        try:
            lines = list(cli_lines(self.remote(command).decode("utf-8")))
        except UpdateError:
            raise UpdateError("process_inspection_unavailable") from None
        check(
            all(line == "OTT_NATIVE_RUNNING" for line in lines),
            "invalid_process_readback",
        )
        return bool(lines)

    def require_payload_hashing(self):
        # Exercise the same remote utility before closing or replacing the app.
        try:
            output = self.remote("command -v sha256sum >/dev/null || exit 79; printf '' | sha256sum")
            lines = list(cli_lines(output.decode("utf-8")))
        except (UpdateError, UnicodeError):
            raise UpdateError("payload_hashing_unavailable") from None
        check(lines == [digest(b"") + "  -"], "payload_hashing_unavailable")

    def payload_matches(self, payload):
        check(
            isinstance(payload, dict) and 0 < len(payload) <= 4096,
            "missing_native_payload",
        )
        targets, expected_files = [], {}
        for name, expected in payload.items():
            kind, separator, relative = name.partition("/")
            check(
                separator
                and kind in {"app", "service"}
                and re.fullmatch(r"[0-9a-f]{64}", expected),
                "invalid_native_payload",
            )
            parts = PurePosixPath(relative).parts
            check(
                parts
                and not relative.startswith("/")
                and ".." not in parts
                and "\\" not in relative
                and all(char.isprintable() for char in relative),
                "invalid_native_payload",
            )
            root = (
                APP_DIR
                if kind == "app"
                else "/media/developer/apps/usr/palm/services/" + APP_ID + ".storage"
            )
            target = root + "/" + relative
            check(target not in expected_files, "invalid_native_payload")
            targets.append(shlex.quote(target))
            expected_files[target] = expected
        command = "command -v sha256sum >/dev/null || exit 79; for f in " + " ".join(
            targets
        )
        command += '; do if [ ! -f "$f" ] || [ -L "$f" ]; then printf "OTT_PAYLOAD_MISMATCH\\n"; exit 0; fi; done; '
        command += "sha256sum " + " ".join(targets)
        check(len(command.encode()) <= 128 * 1024, "native_payload_manifest_limit")
        output = self.remote(command)
        lines = list(cli_lines(output.decode("utf-8")))
        if lines == ["OTT_PAYLOAD_MISMATCH"]:
            return False
        observed = {}
        for line in lines:
            match = re.fullmatch(r"([0-9a-f]{64})  (.+)", line)
            check(match is not None, "invalid_payload_readback")
            checksum, path = match.groups()
            check(
                path in expected_files and path not in observed,
                "invalid_payload_readback",
            )
            observed[path] = checksum
        check(observed.keys() == expected_files.keys(), "invalid_payload_readback")
        return observed == expected_files

    def close(self):
        self.device("ares-launch", "--close", APP_ID, operation="close")

    def install(self, ipk):
        self.device("ares-install", str(ipk), operation="install", timeout=180)

    def launch(self):
        self.device("ares-launch", APP_ID, operation="launch")

    def capture(self):
        command = "cd " + shlex.quote(APP_DIR) + " || exit 71; "
        for root in STATE_ROOTS:
            quoted = shlex.quote(root)
            command += f"[ ! -L {quoted} ] || exit 72; if [ -e {quoted} ]; then printf '%s\\n' {quoted}; fi; "
        roots = list(cli_lines(self.remote(command).decode("utf-8")))
        check(
            len(roots) == len(set(roots))
            and all(root in STATE_ROOTS for root in roots),
            "invalid_private_inventory",
        )
        if not roots:
            return {}, {}, b""
        command = (
            "cd "
            + shlex.quote(APP_DIR)
            + " || exit 71; printf 'OTT_NATIVE_STATE\\n'; exec tar -cf - "
        )
        command += " ".join(shlex.quote(root) for root in roots)
        raw = self.remote(command)
        prefix, separator, archive = raw.partition(b"OTT_NATIVE_STATE\n")
        check(
            separator and not list(cli_lines(prefix.decode("utf-8"))),
            "invalid_private_snapshot",
        )
        rows, data = state_archive(archive)
        check(
            {PurePosixPath(name).parts[0] for name in rows} == set(roots),
            "incomplete_private_snapshot",
        )
        return rows, data, archive

    def snapshot(self, destination):
        directory = private_directory(destination)
        before, _content, archive = self.capture()
        again, _, _ = self.capture()
        check(before == again, "private_state_changed_during_snapshot")
        if before:
            # This is a restore-capability precondition, not proof of all protected-store access.
            self.remote("test -w " + shlex.quote(APP_DIR) + " || exit 73")
            ownership = list(cli_lines(self.remote("id -u; id -g").decode("utf-8")))
            check(
                len(ownership) == 2
                and all(re.fullmatch(r"[0-9]+", value) for value in ownership),
                "private_owner_unavailable",
            )
            uid, gid = map(int, ownership)
            check(
                all(row["uid"] == uid and row["gid"] == gid for row in before.values()),
                "private_owner_not_restorable",
            )
            # Verify the exact CLI transport before any installation can start.
            self.runner(
                [*self.private_input_command(), "--verify-private-input"],
                operation="private_input_preflight",
                timeout=10,
            )
        write_private(directory / "state.tar", archive)
        snapshot = {
            "capture_protocol": CAPTURE_PROTOCOL,
            "path": str(directory / "state.tar"),
            "sha256": digest(archive),
            "files": before,
        }
        write_private(
            directory / "manifest.json", json.dumps(snapshot, sort_keys=True).encode()
        )
        return snapshot

    def restore(self, snapshot):
        require_capture_protocol(snapshot)
        path = Path(snapshot["path"])
        check(
            not path.is_symlink() and path.stat().st_size <= STATE_LIMIT,
            "unsafe_private_snapshot",
        )
        archive = path.read_bytes()
        check(digest(archive) == snapshot["sha256"], "private_snapshot_hash_mismatch")
        expected, content = state_archive(archive) if archive else ({}, {})
        check(expected == snapshot["files"], "private_snapshot_manifest_mismatch")
        current, _, _ = self.capture()
        for name in expected.keys() & current.keys():
            check(
                expected[name] == current[name], "private_state_changed_after_install"
            )
        missing = {name: row for name, row in expected.items() if name not in current}
        if missing:
            ownership = list(cli_lines(self.remote("id -u; id -g").decode("utf-8")))
            check(
                len(ownership) == 2
                and all(re.fullmatch(r"[0-9]+", value) for value in ownership),
                "private_owner_unavailable",
            )
            uid, gid = map(int, ownership)
            check(
                all(
                    row["uid"] == uid and row["gid"] == gid for row in missing.values()
                ),
                "private_owner_not_restorable",
            )
        for name in sorted(
            expected, key=lambda value: (len(PurePosixPath(value).parts), value)
        ):
            if name in current:
                continue
            row = expected[name]
            target = APP_DIR + "/" + name
            parent = str(PurePosixPath(target).parent)
            command = (
                "test -d "
                + shlex.quote(parent)
                + " && test ! -L "
                + shlex.quote(parent)
                + " || exit 74; "
            )
            if row["directory"]:
                command += "if test -g " + shlex.quote(parent) + "; then "
                command += (
                    "group=$(stat -c '%g' " + shlex.quote(parent) + ") || exit 75; "
                )
                command += (
                    '[ "$group" = '
                    + shlex.quote(str(row["gid"]))
                    + " ] || exit 75; fi; "
                )
                command += (
                    "umask 077; mkdir -m "
                    + oct(row["mode"])[2:]
                    + " "
                    + shlex.quote(target)
                )
            else:
                # Publish only complete verified bytes. A failed transfer must
                # never leave a truncated destination that blocks reconciliation.
                # Keep any SIGKILL orphan outside the managed state roots.
                # A cross-filesystem destination fails safely at publication.
                command += (
                    "umask 077; tmp=$(mktemp "
                    + shlex.quote(APP_DIR + "/.ott-restore.XXXXXX")
                    + ") || exit 75; "
                )
                command += "trap 'rm -f -- \"$tmp\"' 0; trap 'exit 76' 1 2 15; "
                command += (
                    'cat > "$tmp" || exit 75; actual=$(sha256sum < "$tmp") || exit 75; '
                )
                command += (
                    '[ "${actual%% *}" = '
                    + shlex.quote(row["sha256"])
                    + " ] || exit 75; "
                )
                command += "owner=$(stat -c '%u:%g' \"$tmp\") || exit 75; "
                command += (
                    '[ "$owner" = '
                    + shlex.quote(str(row["uid"]) + ":" + str(row["gid"]))
                    + " ] || exit 75; "
                )
                command += "chmod " + oct(row["mode"])[2:] + ' "$tmp" || exit 75; '
                # -T rejects a racing directory; no -f means an existing file,
                # including a symlink, can never be replaced.
                command += 'ln -T "$tmp" ' + shlex.quote(target) + " || exit 75"
            self.remote(command, data=None if row["directory"] else content[name])
        restored, _, _ = self.capture()
        check(
            all(restored.get(name) == row for name, row in expected.items()),
            "private_state_restore_failed",
        )


def wait_for(predicate, *, attempts, poll_interval, code):
    for index in range(attempts):
        if predicate():
            return
        if index + 1 < attempts:
            time.sleep(poll_interval)
    raise UpdateError(code)


def save_journal(path, receipt):
    fd, name = tempfile.mkstemp(prefix=".update-", suffix=".json", dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(json.dumps(receipt, sort_keys=True).encode())
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        if os.name == "posix":
            directory_fd = os.open(
                path.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
            )
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
    finally:
        temporary.unlink(missing_ok=True)


def reconcile_device(ares, release, state_dir, *, attempts=3, poll_interval=1):
    """Resume only verified state restoration/launch; never repeat installation."""
    directory = private_directory(state_dir)
    journal = directory / "update.json"
    check(journal.is_file() and not journal.is_symlink(), "missing_update_journal")
    receipt = json_bytes(journal.read_bytes())
    check(
        all(receipt.get(key) == release.get(key) for key in RELEASE_BINDINGS),
        "journal_release_mismatch",
    )
    check(
        receipt.get("outcome")
        in {
            "installing",
            "install-indeterminate",
            "restoring",
            "launching",
            "needs-review",
        },
        "no_pending_update",
    )
    check(receipt.get("install_started") is True, "installation_not_started")
    check(
        receipt.get("application_id") == APP_ID and receipt.get("snapshot"),
        "recovery_snapshot_unavailable",
    )
    require_capture_protocol(receipt["snapshot"])
    require_device_binding(receipt.get("device"))
    check(ares.identity() == receipt.get("device"), "device_identity_changed")
    current = ares.installed()
    check(
        current is not None
        and current.get("id") == APP_ID
        and current.get("type") == "native"
        and current.get("folderPath") == APP_DIR
        and current.get("version") == release["version"],
        "recovery_target_not_installed",
    )
    check(ares.payload_matches(release["payload"]), "recovery_payload_mismatch")
    path = directory / "snapshot/manifest.json"
    check(path.is_file() and not path.is_symlink(), "recovery_snapshot_unavailable")
    snapshot = json_bytes(path.read_bytes())
    require_capture_protocol(snapshot)
    check(
        snapshot.get("path") == str(directory / "snapshot/state.tar")
        and snapshot.get("sha256") == receipt["snapshot"]["sha256"],
        "recovery_snapshot_mismatch",
    )
    try:
        if APP_ID in ares.running() or ares.native_process():
            try:
                ares.close()
            except UpdateError as error:
                if error.code != "close_timeout":
                    raise
        wait_for(
            lambda: APP_ID not in ares.running() and not ares.native_process(),
            attempts=attempts,
            poll_interval=poll_interval,
            code="native_app_did_not_stop",
        )
        check(ares.identity() == receipt["device"], "device_identity_changed")
        ares.restore(snapshot)
        ares.launch()
        wait_for(
            lambda: APP_ID in ares.running() and ares.native_process(),
            attempts=attempts,
            poll_interval=poll_interval,
            code="native_process_not_confirmed",
        )
        current = ares.installed()
        check(
            current is not None
            and current.get("id") == APP_ID
            and current.get("type") == "native"
            and current.get("folderPath") == APP_DIR
            and current.get("version") == release["version"]
            and ares.identity() == receipt["device"]
            and ares.payload_matches(release["payload"]),
            "final_readback_mismatch",
        )
        receipt.update(
            outcome="complete",
            sam_running=True,
            native_process_running=True,
            observed_version=current["version"],
            reconciled=True,
        )
        receipt.pop("error_code", None)
        save_journal(journal, receipt)
        return receipt
    except UpdateError as error:
        receipt.update(outcome="needs-review", error_code=error.code)
        save_journal(journal, receipt)
        raise


def _update_device(
    ares,
    release,
    *,
    apply=False,
    preflight=False,
    reconcile=False,
    state_dir,
    attempts=3,
    poll_interval=1,
):
    version_tuple(release["version"])
    check(
        tag_version(release["tag"]) == release["version"], "release_identity_mismatch"
    )
    if reconcile:
        return reconcile_device(
            ares, release, state_dir, attempts=attempts, poll_interval=poll_interval
        )
    receipt = {
        "schema": 1,
        "tag": release["tag"],
        "version": release["version"],
        "sha256": release["sha256"],
        "source_sha": release.get("source_sha"),
        "release_id": release.get("release_id"),
        "source_set_sha256": release.get("source_set_sha256"),
        "application_id": APP_ID,
        "transport": "existing-ares-developer-mode",
        "protected_store_backup": "not_performed",
        "playback_validation": "not_performed",
        "outcome": "dry-run",
        "install_started": False,
    }
    if not apply and not preflight:
        return receipt
    directory = private_directory(state_dir) if apply else Path(state_dir)
    journal = directory / "update.json"
    previous = None
    retry_preinstall = False
    if journal.exists() or journal.is_symlink():
        check(not journal.is_symlink(), "unsafe_private_journal")
        previous = json_bytes(journal.read_bytes())
        if apply:
            retry_preinstall = previous.get(
                "install_started"
            ) is False and previous.get("outcome") in {"closing", "needs-review"}
            check(
                previous.get("outcome") in {"complete", "already-current"}
                or retry_preinstall,
                "pending_update",
            )
            if retry_preinstall:
                check(
                    previous.get("application_id") == APP_ID
                    and all(
                        previous.get(key) == release.get(key)
                        for key in RELEASE_BINDINGS
                    ),
                    "journal_release_mismatch",
                )
                require_device_binding(previous.get("device"))
        else:
            receipt["pending_outcome"] = previous.get("outcome")
    identity = ares.identity()
    require_device_binding(identity)
    if retry_preinstall:
        check(identity == previous.get("device"), "device_identity_changed")
    before = ares.installed()
    check(before is not None, "native_app_not_installed")
    check(
        before.get("id") == APP_ID
        and before.get("folderPath") == APP_DIR
        and before.get("type") == "native",
        "installed_identity_mismatch",
    )
    check(
        version_tuple(before["version"]) <= version_tuple(release["version"]),
        "downgrade_not_supported",
    )
    if retry_preinstall:
        check(
            before["version"] == previous.get("previous_version"),
            "preinstall_target_changed",
        )
    ares.require_payload_hashing()
    receipt.update(device=identity, previous_version=before["version"])
    active = APP_ID in ares.running()
    process = ares.native_process()
    receipt.update(sam_running=active, native_process_running=process)
    if not apply:
        receipt["outcome"] = "preflight"
        return receipt
    if before["version"] == release["version"]:
        check(ares.payload_matches(release["payload"]), "same_version_different_build")
        receipt["outcome"] = "already-current"
        return receipt
    check(previous is None or retry_preinstall, "completed_update_changed")
    if not retry_preinstall:
        check(
            not (directory / "verified-update.ipk").exists()
            and not (directory / "snapshot").exists(),
            "existing_update_artifacts",
        )

    def save(outcome):
        receipt["outcome"] = outcome
        save_journal(journal, receipt)

    save("closing")
    try:
        if retry_preinstall:
            # No installation call can precede a durable true marker. Retain
            # interrupted local work, then take a fresh snapshot of current state.
            remnants = [
                directory / name for name in ("snapshot", "verified-update.ipk")
            ]
            for path in remnants:
                check(not path.is_symlink(), "unsafe_preinstall_artifact")
            remnants = [path for path in remnants if path.exists()]
            if remnants:
                retained = Path(
                    tempfile.mkdtemp(prefix="prior-attempt-", dir=directory)
                )
                for path in remnants:
                    path.rename(retained / path.name)
        if active or process:
            try:
                ares.close()
            except UpdateError as error:
                if error.code != "close_timeout":
                    raise
        wait_for(
            lambda: APP_ID not in ares.running() and not ares.native_process(),
            attempts=attempts,
            poll_interval=poll_interval,
            code="native_app_did_not_stop",
        )
        check(ares.identity() == identity, "device_identity_changed")
        snapshot = ares.snapshot(directory / "snapshot")
        require_capture_protocol(snapshot)
        receipt["snapshot"] = {
            "capture_protocol": snapshot["capture_protocol"],
            "sha256": snapshot["sha256"],
            "entries": len(snapshot["files"]),
        }
        try:
            ipk = Path(release["ipk"])
            check(
                not ipk.is_symlink()
                and ipk.is_file()
                and ipk.stat().st_size <= 128 * 1024 * 1024,
                "release_file_changed",
            )
            local_ipk = directory / "verified-update.ipk"
            with ipk.open("rb") as source, local_ipk.open("xb") as target:
                os.chmod(local_ipk, 0o600)
                shutil.copyfileobj(source, target, length=1024 * 1024)
            with local_ipk.open("rb") as stream:
                check(
                    hashlib.file_digest(stream, "sha256").hexdigest()
                    == release["sha256"],
                    "release_file_changed",
                )
            check(ares.identity() == identity, "device_identity_changed")
            receipt["install_started"] = True
            save("installing")
            ares.install(local_ipk)
        except UpdateError as error:
            if error.code != "install_timeout":
                raise
            try:
                observed = ares.installed()
                receipt["observed_version"] = (
                    observed.get("version") if observed else None
                )
                receipt["identity_matches"] = ares.identity() == identity
            except UpdateError:
                receipt["observed_version"] = None
            save("install-indeterminate")
            return receipt
        observed = ares.installed()
        check(
            observed is not None
            and observed.get("id") == APP_ID
            and observed.get("version") == release["version"]
            and observed.get("folderPath") == APP_DIR
            and observed.get("type") == "native"
            and ares.identity() == identity,
            "installed_update_not_confirmed",
        )
        check(ares.payload_matches(release["payload"]), "installed_payload_mismatch")
        check(
            APP_ID not in ares.running() and not ares.native_process(),
            "unexpected_running_app_after_install",
        )
        save("restoring")
        check(ares.identity() == identity, "device_identity_changed")
        ares.restore(snapshot)
        save("launching")
        ares.launch()
        wait_for(
            lambda: APP_ID in ares.running() and ares.native_process(),
            attempts=attempts,
            poll_interval=poll_interval,
            code="native_process_not_confirmed",
        )
        observed = ares.installed()
        check(
            observed is not None
            and observed.get("id") == APP_ID
            and observed.get("type") == "native"
            and observed.get("folderPath") == APP_DIR
            and observed.get("version") == release["version"]
            and ares.identity() == identity
            and ares.payload_matches(release["payload"]),
            "final_readback_mismatch",
        )
        receipt.update(
            sam_running=True,
            native_process_running=True,
            observed_version=observed["version"],
        )
        save("complete")
        return receipt
    except UpdateError as error:
        receipt["error_code"] = error.code
        save("needs-review")
        raise


@contextmanager
def update_lock(directory):
    directory = private_directory(directory)
    path = directory / "native-update.lock"
    check(not path.is_symlink(), "unsafe_update_lock")
    flags = os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0)
    with os.fdopen(os.open(path, flags, 0o600), "r+b") as stream:
        if os.name == "posix":
            import fcntl

            try:
                fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise UpdateError("update_in_progress") from None
            try:
                yield
            finally:
                fcntl.flock(stream, fcntl.LOCK_UN)
        else:
            # Real Ares operations are POSIX-only. Keep the pure orchestrator
            # usable by offline fake-device tests on Windows as well.
            import msvcrt

            stream.write(b"0")
            stream.flush()
            stream.seek(0)
            try:
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError:
                raise UpdateError("update_in_progress") from None
            try:
                yield
            finally:
                stream.seek(0)
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)


def check_other_update_journals(state_dir):
    """Keep an earlier tag recoverable while holding the device-scoped lock."""
    directory = Path(state_dir)
    remaining = 8 * 1024 * 1024
    with os.scandir(directory.parent) as entries:
        for count, entry in enumerate(entries, 1):
            check(count <= 1024, "update_journal_limit")
            if entry.name == directory.name:
                continue
            check(not entry.is_symlink(), "unsafe_private_journal")
            if not entry.is_dir(follow_symlinks=False):
                continue
            journal = Path(entry.path) / "update.json"
            check(not journal.is_symlink(), "unsafe_private_journal")
            try:
                flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
                fd = os.open(journal, flags)
            except FileNotFoundError:
                continue
            except OSError:
                raise UpdateError("unsafe_private_journal") from None
            with os.fdopen(fd, "rb") as stream:
                info = os.fstat(stream.fileno())
                check(stat.S_ISREG(info.st_mode) and info.st_size <= remaining
                      and (not hasattr(os, "getuid") or info.st_uid == os.getuid()),
                      "unsafe_private_journal")
                raw = stream.read(remaining + 1)
            remaining -= len(raw)
            check(remaining >= 0, "update_journal_limit")
            previous = json_bytes(raw)
            check(isinstance(previous, dict) and previous.get("schema") == 1
                  and previous.get("application_id") == APP_ID
                  and previous.get("tag") == entry.name
                  and type(previous.get("install_started")) is bool,
                  "invalid_update_journal")
            check(tag_version(previous["tag"]) == previous.get("version"), "invalid_update_journal")
            require_device_binding(previous.get("device"))
            settled = (previous.get("outcome") == "complete" and previous["install_started"] is True) or (
                previous.get("outcome") == "already-current" and previous["install_started"] is False
            )
            preinstall = previous["install_started"] is False and previous.get("outcome") in {"closing", "needs-review"}
            check(settled or preinstall, "pending_update")


def update_device(
    ares,
    release,
    *,
    apply=False,
    preflight=False,
    reconcile=False,
    state_dir,
    attempts=3,
    poll_interval=1,
):
    options = {
        "apply": apply,
        "preflight": preflight,
        "reconcile": reconcile,
        "state_dir": state_dir,
        "attempts": attempts,
        "poll_interval": poll_interval,
    }
    if apply or reconcile:
        with update_lock(Path(state_dir).parent):
            if apply:
                check_other_update_journals(state_dir)
            return _update_device(ares, release, **options)
    return _update_device(ares, release, **options)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device", required=True)
    parser.add_argument("--tag", required=True)
    parser.add_argument(
        "--work-dir",
        type=Path,
        default=Path.home() / ".local/share/ottplay/native-updates",
    )
    parser.add_argument("--bundle-dir", type=Path)
    parser.add_argument("--ares-root", type=Path)
    parser.add_argument(
        "--ares-compat",
        action="store_true",
        help="Use the existing pinned CLI compatibility wrapper",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--preflight", action="store_true")
    mode.add_argument(
        "--reconcile",
        action="store_true",
        help="Restore/launch an already installed pending update; never reinstall",
    )
    mode.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        tag_version(args.tag)
        check(
            re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}", args.device),
            "invalid_device_alias",
        )
        work = private_directory(args.work_dir)
        release = official_release(
            args.tag, args.bundle_dir or work / "releases" / args.tag
        )
        ares = (
            Ares(args.device, args.ares_root, compatibility=args.ares_compat)
            if args.apply or args.preflight or args.reconcile
            else None
        )
        receipt = update_device(
            ares,
            release,
            apply=args.apply,
            preflight=args.preflight,
            reconcile=args.reconcile,
            state_dir=work / args.device / args.tag,
        )
        print(json.dumps(receipt, sort_keys=True))
        return 0 if receipt["outcome"] != "install-indeterminate" else 2
    except UpdateError as error:
        print("FAIL: " + error.code, file=sys.stderr)
        return 1
    except (
        OSError,
        ValueError,
        KeyError,
        TypeError,
        AttributeError,
        subprocess.SubprocessError,
        tarfile.TarError,
    ):
        print("FAIL: update_precondition_or_io_failed", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
