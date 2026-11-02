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

Enable Developer Mode using LG's documented process, add the TV to the
[webOS CLI](https://webostv.developer.lge.com/develop/tools/cli-introduction),
and use the device name configured on your computer:

```sh
ares-install --device YOUR_TV build/native-webos/dist/ottplay-native-webos-0.1.0.ipk
ares-launch --device YOUR_TV com.openottplay.player.native
```

Developer Mode must remain active. Session expiry can remove development
applications and their state. Installation and decoder compatibility need a
real LG TV; the browser-based webOS simulator is not a native-decoder test.
If the platform denies a native capability, retain the web application while
investigating supported APIs. This integration does not repair the platform
sandbox, elevate privileges, or install system packages.

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

A working Homebrew Channel can install the same IPK. Generate metadata only
after building, and supply the exact HTTPS directory where these artifacts
will be published:

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
