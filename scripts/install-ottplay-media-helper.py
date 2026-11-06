#!/usr/bin/env python3
"""Install the read-only local media helper as a private macOS LaunchAgent."""
import argparse
import ipaddress
import json
import os
from pathlib import Path
import plistlib
import re
import secrets
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import urllib.request

LABEL = "com.ottplay.media-helper"


def listen_address(value, allow_lan=False):
    if "%" in value:
        raise ValueError("Scoped interface addresses are not supported")
    address = ipaddress.ip_address(value)
    if address.version == 6 and address.ipv4_mapped is not None:
        raise ValueError("IPv4-mapped IPv6 addresses are not supported; use the IPv4 address")
    private_networks = ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7")
    if not address.is_loopback and not (allow_lan and any(
            address in ipaddress.ip_network(network) for network in private_networks)):
        raise ValueError("Use a loopback address, or --allow-lan with a specific private LAN IP")
    return str(address)


def authority(config):
    host = config["host"]
    return f"[{host}]:{config['port']}" if ":" in host else f"{host}:{config['port']}"


def plan(binary, directories, state, port=8448, label=LABEL, home=None,
         host="127.0.0.1", allow_lan=False):
    host = listen_address(host, allow_lan)
    home = Path(home or Path.home())
    binary = Path(binary).expanduser().resolve(strict=True)
    if not binary.is_file() or not os.access(binary, os.X_OK):
        raise ValueError("The prepared ottplay-server binary must be executable")
    if not 1 <= port <= 65535 or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.-]*", label):
        raise ValueError("Invalid helper port or LaunchAgent label")
    roots = []
    for directory in directories:
        supplied = Path(directory).expanduser()
        if not supplied.is_absolute():
            raise ValueError("Media directories must be absolute paths")
        root = supplied.resolve(strict=True)
        if not root.is_dir():
            raise ValueError("Every media source must be an existing mounted directory")
        if root not in roots:
            roots.append(root)
    if not roots:
        raise ValueError("At least one media directory is required")
    state = Path(state).expanduser().resolve()
    for root in roots:
        if state == root or state in root.parents or root in state.parents:
            raise ValueError("Private helper state must be separate from every media directory")
    return {
        "binary": binary, "roots": roots, "state": state, "port": port, "label": label,
        "host": host, "allow_lan": allow_lan,
        "plist": home / "Library/LaunchAgents" / (label + ".plist"),
    }


def private_directory(path):
    if path.is_symlink():
        raise ValueError("Private helper directories must not be symlinks")
    path.mkdir(parents=True, mode=0o700, exist_ok=True)
    info = path.stat()
    if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077:
        raise ValueError("Existing helper directory must be owned by this user with mode 0700")


def write_private(path, data):
    fd, temporary = tempfile.mkstemp(prefix=".helper-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as output:
            output.write(data)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def prepare(config):
    state = config["state"]
    private_directory(state)
    for name in ("bin", "logs", "library"):
        private_directory(state / name)
    token_path = state / "token"
    if token_path.exists() or token_path.is_symlink():
        if token_path.is_symlink():
            raise ValueError("The helper token must not be a symlink")
        info = token_path.stat()
        if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077:
            raise ValueError("Existing helper token must be private to this user")
        token = token_path.read_text().strip()
        if not re.fullmatch(r"[A-Za-z0-9_-]{32,}", token):
            raise ValueError("Existing helper token is invalid")
    else:
        token = secrets.token_urlsafe(32)
        write_private(token_path, (token + "\n").encode())
    installed = state / "bin/ottplay-server"
    fd, temporary = tempfile.mkstemp(prefix=".binary-", dir=installed.parent)
    os.close(fd)
    try:
        shutil.copyfile(config["binary"], temporary)
        os.chmod(temporary, 0o700)
        os.replace(temporary, installed)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    agent = {
        "Label": config["label"],
        "ProgramArguments": [str(installed), "--host", config["host"], "--port", str(config["port"])]
            + (["--allow-lan-local-media"] if config["allow_lan"] else []),
        "WorkingDirectory": str(state),
        "EnvironmentVariables": {
            "OTT_OFFLINE_MEDIA_READONLY_PATHS": json.dumps([str(root) for root in config["roots"]]),
            "OTT_OFFLINE_MEDIA_DIR": str(state / "library"),
            "OTT_OFFLINE_MEDIA_TOKEN": token,
        },
        "RunAtLoad": True, "KeepAlive": True, "ThrottleInterval": 10,
        "ProcessType": "Background", "Umask": 0o077,
        "StandardOutPath": str(state / "logs/helper.log"),
        "StandardErrorPath": str(state / "logs/helper.log"),
    }
    config["plist"].parent.mkdir(parents=True, exist_ok=True)
    write_private(config["plist"], plistlib.dumps(agent))
    url = f"http://{authority(config)}/offline-media/{token}"
    write_private(state / "library-url.txt", (url + "\n").encode())
    return agent


def check_port(config):
    listeners = subprocess.run(
        ["lsof", "-nP", f"-iTCP:{config['port']}", "-sTCP:LISTEN", "-Fp"],
        capture_output=True, text=True, check=False,
    )
    if listeners.returncode not in (0, 1):
        raise RuntimeError("Could not inspect the helper port")
    pids = set(re.findall(r"^p(\d+)$", listeners.stdout, re.MULTILINE))
    if not pids:
        return
    service = subprocess.run(
        ["launchctl", "print", f"gui/{os.getuid()}/{config['label']}"],
        capture_output=True, text=True, check=False,
    )
    own = set(re.findall(r"^\s*pid = (\d+)\s*$", service.stdout, re.MULTILINE))
    if not own or pids != own:
        raise RuntimeError("Helper port is occupied by another service; choose a free port")


def start(config):
    check_port(config)
    target = f"gui/{os.getuid()}/{config['label']}"
    subprocess.run(["launchctl", "bootout", target], stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL, check=False)
    # bootout returns before launchd necessarily removes this service. Starting
    # the same label immediately can fail with Bootstrap failed: 5.
    for _ in range(20):
        try:
            unloaded = subprocess.run(
                ["launchctl", "print", target], stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL, check=False, timeout=1,
            )
        except subprocess.TimeoutExpired as error:
            raise RuntimeError("Timed out checking helper removal; retry the installation") from error
        if unloaded.returncode != 0:
            break
        time.sleep(0.25)
    else:
        raise RuntimeError("Helper service has not finished unloading; retry the installation")
    subprocess.run(["launchctl", "bootstrap", f"gui/{os.getuid()}", str(config["plist"])], check=True)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    health = f"http://{authority(config)}/health"
    catalog = (config["state"] / "library-url.txt").read_text().strip()
    for _ in range(8):
        try:
            with opener.open(health, timeout=2) as response:
                if response.status != 200:
                    continue
            with opener.open(catalog, timeout=2) as response:
                value = json.load(response)
                if (response.status == 200 and value.get("readOnly") is True
                        and value.get("directSources") is False and value.get("uploadUrl") == ""):
                    return
        except (OSError, ValueError):
            pass
        time.sleep(0.5)
    raise RuntimeError("Helper did not become healthy; inspect its private logs/helper.log")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", default=str(Path.home() / "ottplay-foss-local/ottplay-server"))
    parser.add_argument("--directory", action="append", required=True)
    parser.add_argument("--state-dir", default=str(Path.home() / "Library/Application Support/OTTplay/MediaHelper"))
    parser.add_argument("--port", type=int, default=8448)
    parser.add_argument("--listen-address", default="127.0.0.1", help="Specific loopback or private LAN interface IP")
    parser.add_argument("--allow-lan", action="store_true", help="Opt in to serving authorized folders on the selected private LAN IP")
    parser.add_argument("--label", default=LABEL)
    parser.add_argument("--dry-run", action="store_true", help="Validate and show paths without writing or launching")
    parser.add_argument("--no-start", action="store_true", help="Prepare private files but do not touch launchd")
    args = parser.parse_args()
    config = plan(args.binary, args.directory, args.state_dir, args.port, args.label,
                  host=args.listen_address, allow_lan=args.allow_lan)
    if args.dry_run:
        print(json.dumps({key: [str(p) for p in value] if isinstance(value, list) else str(value)
                          for key, value in config.items()}, indent=2))
        return
    if sys.platform != "darwin":
        raise RuntimeError("LaunchAgent installation requires macOS; use --dry-run to validate elsewhere")
    if not args.no_start:
        check_port(config)
    prepare(config)
    if not args.no_start:
        start(config)
    print(f"Prepared {'and started ' if not args.no_start else ''}{config['label']} on {authority(config)}")
    print(f"Private player URL: {config['state'] / 'library-url.txt'}")
    print(f"Private log: {config['state'] / 'logs/helper.log'}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
