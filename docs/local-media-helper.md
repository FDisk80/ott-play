# Read-only media helper

Use this helper when Chrome's direct folder access cannot start a video while a
large SMB/AFP folder is being enumerated. The helper reads the original files
through a local HTTP stream with byte-range support. Chrome no longer opens
those files through its File System Access queue. OTT stores references and
small catalog records; it does not copy the videos.

This is an optional source for the existing **Local videos → Server library…**
setting. It runs on `127.0.0.1:8448` and can serve only browsers on the same Mac.
The default URL will not work on an Android tablet or another computer: their loopback
address refers to that other device. Browser-local folders, Tauri and Capacitor
continue to use their existing source implementations.

To serve a Roku, tablet or another computer, explicitly enable the private-LAN
mode described below. The default remains limited to this Mac.

## Install and connect

Mount the media folder first. Build the server containing the read-only mode,
or supply an already built binary of that version:

```sh
cargo build --locked --release -p ottplay-server
python3 scripts/install-ottplay-media-helper.py \
  --binary "$PWD/target/release/ottplay-server" \
  --directory /Volumes/data/FFFF
```

Repeat `--directory` to authorize another folder. Only the operator's configured
absolute folders are sources. A browser request cannot add a filesystem path.
The installer uses a separate LaunchAgent, `com.ottplay.media-helper`, and leaves
other OTT services and their ports unchanged. It refuses a port occupied by an
unrelated process. `--dry-run` validates and prints the plan without writing or
starting anything; `--no-start` prepares private files without changing launchd.

The default state directory is
`~/Library/Application Support/OTTplay/MediaHelper`. It contains a private copy
of the supplied executable, catalog metadata, logs, and a random access token.
The state directory is mode `0700`; the token, player URL and LaunchAgent plist
are mode `0600`. It must be outside all configured media folders. The installer
reuses the token when updating the helper, so the saved player URL stays valid.

Read `library-url.txt` from that private directory and paste its complete value
into **Local videos → Server library…**. Treat the URL as a credential; do not
put it in public screenshots or logs. If Chrome asks for local-network access,
allow this connection to your own helper. The helper does not require turning
off browser security settings.

Choose **Play local videos** once a playable item appears. The helper publishes
its catalog while discovery continues. **Refresh** starts one new folder scan;
ordinary catalog polling reuses that scan rather than restarting it. A profile created for browser-owned
folders is not automatically rebound to the helper's distinct source identity;
use the existing explicit profile-binding controls or save a separate profile
for this library. The player retains its normal seek, resume, next-file,
shuffle, footer and kiosk behavior.

For a read-only library, OTT hides upload/import, source-disconnect and delete
controls. **Refresh**, playback, and **Server library…** remain available. Clear
the Server library value to return to the original browser-local sources. Their
saved handles, original media and source IDs are not deleted by using the helper.

## Connect another device on a private LAN

Use a build that supports `--allow-lan-local-media`. Choose the Mac's current
private network interface address, then explicitly enable LAN access:

```sh
python3 scripts/install-ottplay-media-helper.py \
  --binary "$PWD/target/release/ottplay-server" \
  --directory /Volumes/data/FFFF \
  --listen-address 192.168.1.20 --allow-lan
```

Replace `192.168.1.20` with the address actually assigned to this Mac. The
installer accepts specific RFC 1918 IPv4 or IPv6 unique-local addresses. It
rejects wildcard, public, link-local and hostname binds. The server separately
enforces the same rule and requires the explicit opt-in flag. A missing
interface causes binding to fail; it does not fall back to every interface.

Paste the updated private `library-url.txt` into the other player's **Local
videos** server setting. Keep the whole URL private: its token grants read
access to the configured folders. This HTTP connection is intended for a
trusted private network. The installer does not open firewall ports, configure
router forwarding, or publish an Internet address. If the host firewall blocks
the selected port, use the host's normal application/network controls.

LAN mode still serves only health and authenticated read-only media routes.
Clients cannot add folders, upload files, delete originals or use the full
server's proxy/control APIs. The existing token, source IDs and metadata are
preserved when changing the bind address. Rerun the same command, including the
LAN options, for later updates. To return to local-only access, rerun it without
those options and replace any saved URL with the resulting loopback URL.

Older helper builds remain loopback-only. An operator-managed gateway can relay
their authenticated media routes, but is not installed or configured by this
helper.

## Persistence, updates and recovery

The LaunchAgent starts at user login and restarts a failed process. It does not
mount NAS volumes, change VPN settings or bypass macOS privacy permissions. A
missing or unresponsive mount can prevent initialization or streaming. Startup
validates the configured folders and does not serve the library until that
validation succeeds; a blocked operating-system lookup can delay startup.
Restore the operating-system mount before retrying. Reading through the helper avoids
Chrome's queued folder operation, but cannot make an unavailable NAS readable.

After updating the binary, rerun the same installer command. It preserves the
private token and installs only this helper. To restart or stop it manually:

```sh
launchctl kickstart -k "gui/$(id -u)/com.ottplay.media-helper"
launchctl bootout "gui/$(id -u)/com.ottplay.media-helper"
```

The supplied binary must support `OTT_OFFLINE_MEDIA_READONLY_PATHS`. In that
mode, its HTTP router contains only `/health` and authenticated media-library
read operations. The installer checks both health and an authenticated catalog
with `readOnly: true`; a different HTTP service returning `200` is insufficient.
A server/library error is written to the private `logs/helper.log`. Do not post
whole configuration or LaunchAgent dumps because they contain the access token.

The manual equivalent of the generated LaunchAgent configuration is:

```text
ProgramArguments: ottplay-server --host 127.0.0.1 --port 8448
OTT_OFFLINE_MEDIA_READONLY_PATHS: JSON array of authorized absolute folder paths
OTT_OFFLINE_MEDIA_DIR: private metadata directory outside those folders
OTT_OFFLINE_MEDIA_TOKEN: private random URL-safe token of at least 32 characters
```

The route accepts authenticated `GET`, `HEAD`, and preflight `OPTIONS`. It does
not expose the full OTT server's UI, proxy, upload, delete or remote-control
routes. This mode is separate from the older writable server library configured
with `OTT_OFFLINE_MEDIA_DIR` and `OTT_OFFLINE_MEDIA_TOKEN` alone.

This helper is for trusted folders managed by the local operator. It rejects
ordinary symlink escapes and validates originals when serving them, but it is
not a hardened isolation boundary against a hostile process concurrently
replacing directory entries or ancestors during a file open. Do not authorize
untrusted writable trees as sources.
