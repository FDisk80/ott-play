# OTTPlay Native for LG webOS

This is a separate, experimental **native Plex client**. Its SDL2/OpenGL ES
interface runs on the television without Chromium or a WebView. Media is
demultiplexed by the bundled FFmpeg and sent to the television's native decoder.
The UI and Plex runtime derive from
[PlxNative](https://github.com/GLinnik21/plx-native), pinned by `upstream.json`.
Our reviewed changes are in `patches/`; upstream code is fetched during the
build, not silently copied into the main player's source tree.

The application ID is `com.openottplay.player.native`, the title is **OTTPlay
Native**, and its independent experimental version starts at **0.1.0**. The
existing `com.openottplay.player` hosted web application remains separate.

## What this target provides

The native Plex runtime supplies a remote-friendly GPU interface, libraries,
posters, details, playback, seeking and track selection. Our integration adds
the configuration entry points documented with the runtime patch. Playback
support still depends on the LG model, firmware, source codecs and the Plex
server's available conversions. A successful ARM build is not a successful
physical-television playback test.

This package does **not** yet contain the main OTT player's M3U, VPortal, Local
providers, shared Favorites, command-server pairing or `ott` CLI protocol.
Profiles and credentials are separate. The web player remains the complete
multi-provider option. No performance number from upstream is claimed for our
build or for an untested television.

## Build on an Apple Silicon Mac or ARM Linux host

Use Python 3.12+, Git, make, a C build environment and rustup. The pinned native
SDK supports macOS arm64/x86_64 and Linux aarch64; an ordinary x86_64 Linux
runner is not supported by that SDK release. Native dependencies additionally
need CMake, Ninja, Meson, pkg-config, autoconf, automake and libtool. Docker is
not required. Allow several GiB for source, the SDK, Rust and intermediate
objects; no build command deletes other projects or global build caches.

From the repository root:

```sh
python3 native/webos/build.py all --jobs 2
```

For an existing SDK:

```sh
python3 native/webos/build.py all \
  --sdk /absolute/path/to/arm-webos-linux-gnueabi_sdk-buildroot \
  --work-dir /absolute/path/to/ottplay-native-build --jobs 2
```

`WEBOS_SDK` is also accepted. The SDK is downloaded only when the chosen
directory is absent, and its digest must match both manifests. The
SDK contains target-system absolute symlinks; extraction converts these to
relative links contained inside the target sysroot, while preserving the
archive path and link containment checks.
The selected Rust version is read from the pinned upstream `rust-toolchain.toml`; the ARMv7
GNU/Linux target and matching `rust-src` are installed through rustup. Android
ARM libraries are not interchangeable with webOS.

FFmpeg source downloads try the canonical `ffmpeg.org` release first, then
[MacPorts' distribution mirror](https://distfiles.macports.org/ffmpeg/) if the
origin remains unavailable after its bounded retries. Both locations must
supply the same pinned archive bytes. A checksum mismatch stops the build
immediately; it never falls through to another source. The fallback changes
only transport, not the recorded upstream origin, version, license or source
provenance. The integration patch is included in the corresponding source
archive for every native package.

The stages can also be run individually, using the same `--work-dir` and
`--sdk` arguments each time:

1. `prepare` fetches the exact commit, applies the overlay, and records its
   digest and patched Git tree. `--local-upstream /path/to/clone` can avoid downloading an existing
   clone; the exact commit is still checked.
2. `bootstrap` verifies/downloads the SDK and installs the pinned Rust target.
3. `build` runs only `make RELEASE=1 FLAVOR=stable ipk`. It never contacts a TV.
4. `package` checks the native ARM executable, storage service, demuxer and
   package identity and the successful source-build receipt, then copies the independently named artifact.
5. `source` collects and verifies corresponding source, Cargo-vendored
   dependencies, bundled native dependencies and Rust runtime source.

After `all`, collect the additional GCC/glibc runtime sources and bind their
linker evidence to the exact package:

```sh
python3 scripts/webos-runtime-sources.py \
  --metadata build/native-webos/dist/ottplay-native-webos-0.1.0.json \
  --source build/native-webos/source \
  --sdk build/native-webos/toolchain/arm-webos-linux-gnueabi_sdk-buildroot
```

For a custom build directory, adjust these paths. Preserve the verified SDK
archive downloaded by `bootstrap`, or pass its location with `--sdk-archive`.
The collector checks linked runtime archives and objects against that pinned
SDK before claiming source coverage. `all` alone produces the primary source
archive; distribution requires this second step as well.

Default results are in `build/native-webos/dist/`. Keep these together:

- `ottplay-native-webos-0.1.0.ipk`
- `ottplay-native-webos-0.1.0.json` and `.sha256`
- `ottplay-native-webos-0.1.0-source.tar.gz` and its `.release.json` report
- `ottplay-native-webos-0.1.0-runtime-source.tar.gz`
- `ottplay-native-webos-0.1.0-source-set.json`
- `ottplay-native-webos-icon.png`

`verify` rechecks the IPK. Source-validation reports distinguish a verified
source archive from an independently rebuilt binary; they do not claim a
rebuild has occurred when it has not. A change to the source pin or overlay
requires a new build directory, so stale objects cannot silently enter a new
candidate.

The build receipt records the patched source tree, exact IPK hash, Rust
version and actual SDK compiler hash. Corresponding-source validation also
requires physical archives for every bundled native dependency, Cargo crates
and the Rust runtime; a list of download URLs alone does not pass.

## Install through LG Developer Mode

### Choose and verify the native package

The initial experimental release is
[native-webos-v0.1.0-beta.1](https://github.com/open-ott-play/ottplay-foss/releases/tag/native-webos-v0.1.0-beta.1).
Download `ottplay-native-webos-0.1.0.ipk`, its `.sha256` and `.json` files, and
the matching source set described above. From the download directory, check:

```sh
shasum -a 256 -c ottplay-native-webos-0.1.0.sha256
```

The metadata must identify `type: native`, architecture `arm`, and application
ID **`com.openottplay.player.native`**. The ordinary OTT-play webOS package
uses **`com.openottplay.player`**. The Plex app from the LG store is a third,
independent application; launching it through a TV remote-control shortcut does
not launch OTTPlay Native. Main-player releases and here.now deployments do not
update this native executable.

The candidate passed loader-symbol checks against sampled webOS 3.4.0–11.2.0
firmware images; sampled webOS 1.x/2.x images are unsupported. These checks do
not establish decoding, permissions or compatibility on a particular TV. Record
the actual model, webOS and firmware version before testing.

### Enable the TV connection

Follow [LG's Developer Mode instructions](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app):

1. Connect the TV and computer to the same reachable local network.
2. Install **Developer Mode** from LG Apps on the TV and sign in with an LG
   Developer account. Account sign-in happens on the TV; it is not an SSH login.
3. Set **Dev Mode Status** to **ON** and allow the required TV restart.
4. Open Developer Mode again, confirm that the session is active, and set
   **Key Server** to **ON**. Keep this screen open while obtaining the key.

A responding web player or TV remote-control connection on ports 3000/3001
does not prove that Developer Mode is ready. Development SSH uses port **9922**;
the temporary Key Server used by the CLI uses port **9991**.

Install or locate the [webOS CLI](https://webostv.developer.lge.com/develop/tools/cli-introduction)
on the computer. These commands use `@webos-tools/cli` 3.2.6. A project-local
installation exposes commands under
`/path/to/installation/node_modules/.bin/`; use those full command paths if
`ares-install` is not on `PATH`. Use the CLI's `tv` profile. The placeholders
`YOUR_TV` and `TV_IP` below mean your chosen device alias and the TV's current
LAN address, not its OTT player name or Device ID.

```sh
ares-setup-device --list
ares-setup-device --add YOUR_TV \
  --info host=TV_IP --info port=9922 --info username=prisoner
ares-novacom --device YOUR_TV --getkey
```

If the alias already exists, inspect it and use `--modify YOUR_TV` instead of
creating a second entry. Enter the **current six-character, case-sensitive
Passphrase** displayed by the TV when `--getkey` prompts. It is not the LG
account password, OTT pairing code or the player HTTP access token. Use an
interactive terminal and wait for the prompt before typing: piping input before
the prompt can leave the saved passphrase unchanged even when the command exits
successfully. Do not put the passphrase in shell arguments, scripts, issue
reports or this repository.

On macOS/Linux with CLI 3.2.6's `tv` profile, device settings are normally in
`~/.webos/tv/novacom-devices.json` and the downloaded key is in
`~/.ssh/YOUR_TV_webos` (spaces in the alias are replaced with underscores).
The device configuration can contain the saved passphrase. Keep both private;
the key should have mode `0600`. Do not delete the whole device registry or SSH
directory to repair one TV.

### Prove access, install, then verify

Successful `--getkey` output means the key was downloaded and saved. It does
**not** prove that the supplied passphrase decrypts it or that SSH authentication
works. Both read-only checks must succeed before installation:

```sh
ares-device --device YOUR_TV --system-info
ares-install --device YOUR_TV --list
```

Confirm that the reported TV is the intended one, then install the verified IPK
and launch its native ID. Run this from the download directory, or substitute
the build output path `build/native-webos/dist/`:

```sh
ares-install --device YOUR_TV ./ottplay-native-webos-0.1.0.ipk
ares-install --device YOUR_TV --listfull
ares-launch --device YOUR_TV com.openottplay.player.native
ares-launch --device YOUR_TV --running
```

Find the native application ID and version in `--listfull`, then check the TV
screen. An install or launch acknowledgement alone is not a playback test.
Sign in to Plex, open a
library, play a known file, and check visible video movement, sound, pause/resume,
seeking and the Back button. Close and reopen the app to verify its own saved
session. Keep a private receipt with the package hash, model/firmware, command
outcomes and observed playback result; exclude passwords, tokens and keys.

If an installation times out or loses its response, first run `--list` again
and inspect the TV. Do not blindly repeat installation or uninstall the app:
the first request may have succeeded. Resolve the actual installed state before
retrying.

Installation and launch of the released native **0.1.0** package were verified
on an **OLED65B4AUA.DUSQLJR**, webOS SDK **10.3.2**, firmware **33.31.75**.
`--listfull` confirmed the application ID/version, and `--running` confirmed
the launched process remained present. This is installation/startup evidence;
Plex playback and decoder compatibility on that TV are not yet verified.

### Connection and startup troubleshooting

- **`ares-*` command not found:** locate the installed CLI binary directory.
  This is a computer-side path problem, not a reason to reset the TV.
- **Connection refused on 9922:** verify the address and active Dev Mode Status
  after the TV restart. A working browser/SSAP connection uses a different
  service. A network timeout can also indicate routing, VPN or firewall rules.
- **Key download fails on 9991:** open Developer Mode, enable Key Server and
  retry obtaining the key once it is reachable. Do not expose these ports to
  the public Internet.
- **`Cannot parse privateKey`, `Malformed OpenSSH private key` or `Bad passphrase`
  after a successful download:** re-read the current TV passphrase exactly,
  including case, and run `--getkey` again for the same alias. Do not guess codes
  or keep retrying installation. Then repeat `--system-info` and `--list`.
  If needed, `ssh-keygen -y -f /path/to/developer-key > /dev/null` checks key
  decryption locally with an interactive prompt; it does not test TV access.
  Persistent failure can mean a stale/corrupt key or a different CLI profile,
  alias or key path. Inspect only that connection before replacing anything.
- **SSH authentication rejected:** verify the `prisoner` user, port 9922,
  selected alias, current session and its downloaded key. The normal LG account
  password is not a substitute. Changing keys does not require clearing the
  player's profile or reinstalling it.
- **IPK installed but no usable picture:** confirm the native app ID was
  launched and distinguish an app-start failure from a media-decoder failure.
  Test a known Plex file and retain the exact error/model/firmware. The
  browser-based webOS simulator cannot verify the TV's native decoder. If the
  platform denies a native capability, use the existing hosted player while
  investigating; do not change platform permissions or install system packages.

#### CLI 3.2.6: `Callback was already called.`

This was reproduced with `@webos-tools/cli` **3.2.6** and Node **26.8.2** after
validating the key and passphrase. The CLI's TCP connection probe connected,
then socket closure emitted `ENOTCONN`, completing the same callback twice.
It was a CLI probe error, not a reason to reset the TV or obtain another key.

The optional [`ares-compat.cjs`](ares-compat.cjs) launcher guards that probe's
completion once, only for the exact reviewed CLI version and source hash.
It retains SSH authentication and original command options; it changes neither
the installed CLI files nor global `NODE_OPTIONS`. From the repository root:

```sh
node native/webos/ares-compat.cjs /path/to/node_modules/@webos-tools/cli \
  ares-device --device YOUR_TV --system-info
node native/webos/ares-compat.cjs /path/to/node_modules/@webos-tools/cli \
  ares-install --device YOUR_TV --listfull
```

The path identifies the CLI package directory, not its `.bin` directory.
After those checks succeed, the same launcher accepts `ares-install` and
`ares-launch` with the installation or launch arguments shown above. It refuses
an unreviewed version or source mismatch; do not weaken those checks to force
another CLI version through it. Normal CLI commands remain the first choice
when this specific failure is absent.

### Updates and Developer Mode expiry

Developer Mode is temporary. Use **EXTEND** in the TV's Developer Mode app while
the session is still active and the TV has network access. When Developer Mode
is disabled after expiry, LG removes development applications; their saved state
must not be assumed recoverable. Re-enable it and re-establish access before
reinstalling. Do not disable Developer Mode merely to troubleshoot an app.

For an update, first verify the new **native** package, its application ID and
matching source metadata. Close only this app, install over the same ID, verify
the installed version and reopen it:

```sh
ares-launch --device YOUR_TV --close com.openottplay.player.native
ares-install --device YOUR_TV /path/to/verified-native-update.ipk
ares-install --device YOUR_TV --listfull
ares-launch --device YOUR_TV com.openottplay.player.native
```

Do not uninstall first. Keep the previous verified package and any separately
managed private Plex configuration for recovery. In-place installation avoids
deliberate data deletion, but migration, retained sign-in and downgrades still
require verification; they are not guaranteed. The hosted player's profiles,
Favorites and command-server pairing are separate and are not imported by this
installation.

## Optional existing Plex configuration

The normal Plex sign-in remains available. The native runtime can also read a
private `ottplay-profile.json` from its installed application directory when
starting. For example:

```json
{
  "address": "https://plex.example.net",
  "token": "YOUR_PLEX_TOKEN",
  "serverId": "YOUR_PLEX_MACHINE_IDENTIFIER",
  "name": "Home Plex"
}
```

`baseUrl`, `server` and `url` are aliases for `address`; `machineIdentifier`
and `machineId` are aliases for `serverId`. A saved `plexcfg` object or a JSON
string containing that object is also accepted. The address must be an
origin, without a path, query or embedded credentials. HTTPS is the default.
HTTP requires `allowInsecureHttp: true`, a numeric private/loopback/link-local
address and an expected `serverId`; the runtime checks `/identity` before
sending credentials. Invalid configuration leaves normal sign-in available.

Keep this file outside the repository and public release output. The IPK
validator rejects packages containing it. On an already authorized Developer
Mode connection, if that account can write the installed app's directory:

```sh
chmod 600 ./ottplay-profile.json
scp -O -P 9922 -i /path/to/developer-key ./ottplay-profile.json \
  prisoner@TV_IP:/media/developer/apps/usr/palm/applications/com.openottplay.player.native/ottplay-profile.json
ssh -p 9922 -i /path/to/developer-key prisoner@TV_IP \
  'chmod 600 /media/developer/apps/usr/palm/applications/com.openottplay.player.native/ottplay-profile.json'
ares-launch --device YOUR_TV --close com.openottplay.player.native
ares-launch --device YOUR_TV com.openottplay.player.native
```

Replace the TV/key placeholders with your existing Developer Mode connection.
If file access is denied, use Plex sign-in; do not change platform permissions.
Homebrew installations can use a different app directory. Host development
also accepts an absolute file path in `OTTPLAY_PLEX_PROFILE`. Remove the
transferred file to stop applying it on later starts; a saved session may
still need to be signed out in the app.

This is a managed server connection: while the file remains, it restores the
connection on every cold launch. Sign-out revokes it for the running session;
remove the file and restart to unlink it permanently. A Plex Media Server
token does not grant Plex account or Home-user features. Account-scoped local
resume positions and preferences are not promised in this mode; use normal
Plex sign-in for a complete account profile.

## Optional Homebrew Channel repository

A working **webOS Homebrew Channel** can install the same IPK. This is the TV
application, not the macOS Homebrew package manager. Add the
[initial native release repository](https://ottplay-webos.igw-2560801.workers.dev/v1/native-webos-v0.1.0-beta.1/ottplay-native-webos-repository.json)
to its repository list, select **OTTPlay Native**, and verify the ID
`com.openottplay.player.native` and version before installing. This URL is a
versioned release snapshot, not a rolling `latest` feed. Use the new native
release's repository URL for a later version and verify its package metadata.
Having Homebrew Channel does not by itself establish that this native decoder
works on the TV.

For maintainers publishing a new native release, generate metadata only after
building, and supply the exact HTTPS directory where these artifacts will be
published:

```sh
python3 native/webos/build.py package \
  --base-url https://downloads.example.org/ottplay-native/0.1.0
python3 native/webos/build.py source
```

Run the runtime-source collector above after `source`. Publish the IPK, both
matching source archives, source-set JSON, icon and repository metadata together.
If metadata and downloads use different hosts, add `--download-base-url` with
the exact HTTPS IPK/source directory; `--base-url` keeps the CORS-compatible
metadata and icon directory. The repository URL ends in
`ottplay-native-webos-repository.json`. Metadata and icon responses must allow
browser CORS; a GitHub release redirect alone may not do so. Generation does
not upload anything, modify the existing OTT-play feed, or imply inclusion in
the central webOSbrew catalog. `rootRequired: false` describes this app, not
how Homebrew Channel was installed. A Developer Mode installation retains its
session lifecycle even when Homebrew Channel performs subsequent installs.

## Source and license

The adapted native runtime and its patches are **GPL-3.0-or-later**. `COPYING`
contains the license; upstream copyright and dependency notices remain in the
package and source archive. This independent executable does not change the
license of the main web player. Distribute the matching two-archive source set along with every binary
candidate, including Cargo/native dependencies, GCC/glibc runtime sources,
Buildroot recipes and all application build scripts. The primary archive
contains the patched upstream tree and this integration under
`ci/ottplay-integration/`; the supplement includes verified final linker
evidence and records which firmware libraries are used but not redistributed.

For an offline reconstruction, extract the source archive and follow its
`ci/restore-source-inputs.py` instructions and upstream source-build document.
The SDK is a separately obtained build toolchain; its exact version and
compiler digest are recorded. Use `RELEASE=1 FLAVOR=stable` when rebuilding.
Telemetry credentials and upstream update endpoints are disabled by our
overlay; the build wrapper also removes inherited telemetry environment
variables.

Fast integration tests, with no SDK, network, display or television:

```sh
python3 -m unittest discover -s native/webos -p 'test_*.py' -v
```
