# OTTPlay for LG webOS (native)

This is a separate, experimental **native OTT player**. Its SDL2/OpenGL ES
interface runs on the television without Chromium or a WebView. Media is
demultiplexed by the bundled FFmpeg and sent to the television's native decoder.
The UI and Plex runtime derive from
[PlxNative](https://github.com/GLinnik21/plx-native), pinned by `upstream.json`.
Our reviewed changes are in `patches/`; upstream code is fetched during the
build, not silently copied into the main player's source tree.

The application ID is `com.openottplay.player.native`; the current display
title is **OTTPlay**. This guide's examples target the **0.3.0 candidate**. The
[0.3.0 release notes](releases/0.3.0.md) are not a publication or device-test
receipt: use these package filenames only after the matching release is available
or a verified candidate has been supplied. The earlier
[native-webos-v0.2.0-beta.1](https://github.com/open-ott-play/ottplay-foss/releases/tag/native-webos-v0.2.0-beta.1)
is a separate historical release, not a download source for 0.3.0.
The existing `com.openottplay.player` hosted web application remains separate.

The [release audit](releases/0.3.0-audit.md) records what still needs verification.

## Optional public command-server discovery profile

Generic builds contain no discovery catalog. An operator may explicitly select
a reviewed public profile for one distribution through the existing builder:

```sh
python3 native/webos/build.py build \
  --work-dir /absolute/path/to/prepared-build \
  --control-discovery-url "$REVIEWED_PUBLIC_CATALOG_URL" \
  --control-discovery-sha256 "$REVIEWED_CATALOG_SHA256"
```

The two flags are accepted together by `build` and `all`. They identify the exact
HTTPS metadata URL and SHA-256 of its raw response bytes; they are not a command
API, token, private configuration path or automatic Home default. No metadata is
downloaded by the builder. Use a lowercase canonical DNS hostname, optional
decimal port, and nonempty safe path; credentials, query/fragment, URL escapes,
whitespace and shell/Make punctuation are rejected. The digest is 64 lowercase
hexadecimal characters. A missing partner or invalid value fails before a build
command. Both omitted (or both explicitly empty) produce an unconfigured build.

The builder removes inherited `PLX_CONTROL_DISCOVERY_*` values and supplies only
the explicit pair after its normal environment scrub. `built.json` records
`configuration.control_discovery`: configured state, exact URL/digest and the
configuration fingerprint. Keep the reviewed public source revision and catalog
bytes/hash in the delivery evidence alongside that receipt. A receipt does not
replace inspection of the actual built artifact.

For an already prepared source tree, direct Make builds accept the same pair
only as environment variables `PLX_CONTROL_DISCOVERY_URL` and
`PLX_CONTROL_DISCOVERY_SHA256`; Make command-line assignments are rejected. The
fixed validator command reads environment data without interpolating it into
Make or shell expressions. Its fingerprint enters the existing configuration
stamp, including a transition back to `none` when the pair is removed. Bare
Cargo bypasses that Make relink fence; its runtime profile parser still must
reject partial/invalid inputs, and it is not a qualified packaging route.

`control_discovery_config.py` is part of the integration digest and is copied by
`prepare`. Rust/Make changes must also be delivered in the reviewed integration
patch sequence, so the exported upstream tree actually contains their consumer.
If that sequence or the helper changes, prepare a new source directory through
the existing provenance checks. Merely setting environment variables on old
prepared source does not add a feature. Qualify both configured and generic
artifacts, including profile changes and removal.

### Connect the player

Open **Browse → Settings → Remote control**. Browse is in the bottom bar in
**Classic** and the top header in **Modern**; close an open editor or Description
view to return to it. **Find command server** is a separate action in that group,
alongside the manual **Remote control server** editor. If that editor is open,
choose **Cancel** to return to the group before choosing Find. Builds containing the first-run
shortcut also show **Settings** as the last row of **Providers** and **Profiles**
while no saved profile is enabled. This shortcut does not appear in
channel/video lists.

For manual setup, open **Remote control server** and enter the controller's
HTTPS base URL, for example
`https://controller.example.invalid/home`, then select **Save**. Enter the
controller address, not the player website, a discovery catalog JSON URL or
an `/api/discovery` endpoint. The address is normalized and must use HTTPS;
embedded credentials, query strings, fragments and percent escapes are
rejected. Manual entry remains available in generic builds.

Once preferences are ready and access-policy checks permit it, builds with
Linux DNS-SD offer **Find command server** without requiring a catalog or typed
controller address. This is unicast DNS-SD for `_ottplay-ctrl._tcp` through the
system resolver and the network's search domains, not multicast mDNS. If DNS
returns a valid empty result, an explicitly configured public catalog can supply
the results instead; its raw response digest is verified. Resolver errors,
malformed or oversized answers, and timeouts do not trigger that fallback.
Builds without Linux DNS-SD support retain the catalog path.

Select the intended server from the results. Native Find is an explicit action,
including on a fresh installation, and it does not automatically approve pairing.
The three-second UI deadline cannot interrupt a blocking OS lookup. Another
Find remains unavailable until that worker finishes; late results are discarded.
Discovery errors preserve the prior saved configuration. Complete the normal
pairing approval and wait for the connection and saved configuration to be
confirmed; displaying a pairing code alone does not establish a connection.
See the [command-server discovery guide](../../docs/remote-command-server.md#lookup-by-platform)
for other players and deployment setup. The explicit Native Find action and
its three-second UI deadline are described above.

The normalized HTTPS controller address, interface mode, stable installation
device ID and bounded temporary native-Plex browse bookmarks use typed
non-secret preferences through the storage helper. These bookmarks hold
source/category fingerprints and a focus key; they do not grant source access. A genuinely absent configuration can establish a durable, disabled
identity without a token or KeyManager. An actual pairing token still requires
a successful protected, durable write before the new connection can be
activated. Saving preferences does not prove pairing or protected storage
works. There is no plaintext fallback for the full saved state. Existing
encrypted records retain their read, migration and erase paths. A legacy
decryption failure preserves the ciphertext and remains a private-storage
failure; independent preference storage does not unlock access when the prior
kiosk or parental policy is unknown. A displayed storage
diagnostic identifies which operation or step failed; it does not repair or
reset saved settings. If the error persists, note its exact on-screen text,
the action that produced it and the application version for the maintainer.
No shell access is needed to report that information. This candidate has no
on-screen export for the developer storage log. Keep the previous
configuration; discovering a server or receiving a pairing code does not prove
that settings will survive restart.

**Key Server** in Developer Mode supplies the computer's SSH key; enable it
when following [LG's key-download procedure](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app).
**KeyManager** is the separate TV credential service used for protected token
storage. Pairing the player with an OTT controller is another process.
Downloading an SSH key does not approve OTT pairing or verify a protected Save.

These instructions describe the candidate's source capabilities, not proof that
an installed or published package contains them. For a local diagnostic update,
use the **OTTPlay** display name and retain the `com.openottplay.player.native`
identity; follow [the in-place update procedure](#updates-and-developer-mode-expiry).
A diagnostic feature set under that identity is not an official release build.
Host/ARM builds, artifact inspection, transport and physical first-run acceptance
require their own receipts; see [diagnostic versus release delivery](../../docs/native-webos-delivery.md#local-diagnostic-candidates-and-published-releases).

## What this target provides

The candidate offers Classic and Modern presentations of the same sources.
Open **Browse → Settings → Interface mode**, choose **Classic** or **Modern**,
and wait for **Selected**. Choosing the mode itself requests a non-secret
preference save through the storage helper; there is no extra Save button for
this setting. Success requires current write permission and a durable
compare-and-swap write with exact readback. The previous selection remains
displayed while the result is pending. An uncertain write blocks further
preference writes until a full application restart; inspect the saved value
after reopening before retrying. If an error appears,
record its exact text, the action and the application version for the
maintainer. Fully close and reopen the application to check that the mode was
retained; closing and reopening Settings alone does not test persistence.

M3U, Xtream, Stalker, VPortal, local folders and Plex use provider profiles, a channel/video list and categories, with descriptions and artwork where the source supplies them. Saved provider profiles, their remembered categories, global Favorites and playback positions use the protected native store. Temporary native-Plex category and focus hints use the separate non-secret bookmark record and are reused only after current account and source authorization. Local files are read from their source, without an import copy. These are source-reviewed behaviors; the release audit keeps device acceptance separate.

Global Favorites can mix providers and profiles. Their portable identities bind to the receiving player's own matching profiles, source aliases and paths; credentials are not copied through a Favorite. Missing or ambiguous bindings are reported instead of choosing an unrelated source. An M3U profile can retain a private media attachment for matching VPortal Favorites; configure that attachment separately on each receiving player. An attached-media Favorite can be pinned as a single kiosk item with its exact M3U parent and attachment binding. Playback still requires current source authority and parental authorization; changing the source configuration invalidates the pin. Mixed attached-media kiosk queues are not supported.

Older local Favorites that retained only a filename can have lost their parent folders. The native client cannot distinguish such a truncated path from a genuine root-level file with the same name. Recreate those Favorites from their full relative paths before transfer; compatibility with that legacy capture format is not yet complete.

Command-server discovery and pairing use this installation's own device identity. The native command adapter implements profile and provider selection, global Favorites transfer, playback, validated individual settings and Standby. Async operations report completion after the relevant work; a queued command cannot silently act after its deadline or a change of source. Interface font scale is adjustable from 20 to 200 percent, with 100 percent as the default.

The authenticated `state` and `status` replies include `provider_context`, a
snapshot of the current in-memory Runtime and Saved image, not a physical
storage read or proof of a new durable write. `loaded` and `state_load`
(`idle`, `loading`, `failed`) describe the current load state;
`write_permit_valid` describes lifetime write authority, not storage-service
availability. `selected_provider` is the saved choice, or null if absent or
unrecognized. `saved_active_profile_present` reports whether a saved reference
exists; `saved_active_profile_kind` is its resolved kind or null.
`runtime_provider` and `effective_provider` distinguish the current runtime
selection from source precedence. `managed_active` and `classic_active` report
the corresponding generation-matched in-memory source bindings; neither proves
new playback or a persistence change. Provider values are limited to `m3u`,
`xtream`, `stalker`, `vportal`, `offline` and `plex`; the stored `local` alias
normalizes to `offline`. These diagnostic fields contain no profile identifiers,
names, URLs, paths, credentials or load-error text.

The original native Plex library views remain available. Plex playback uses the existing server session and conversion path. Direct Local/HTTP playback uses the bundled FFmpeg probe and the television's decoder. The ordinary multiplexed HLS path supports unencrypted MPEG-TS H.264/AAC streams, VOD seeking and live refresh, with a 64 MiB limit per segment. Encrypted HLS, fMP4, byte ranges, LL-HLS and adaptive variant switching are not implemented in this path. A separate bounded VOD path supports H.264 video with external AAC audio renditions; see [native HLS audio renditions](../../docs/native-hls-audio-renditions.md) for its stricter playlist requirements and track-selection limits. Container recognition does not guarantee codec support: an AVI containing MPEG4/Xvid still needs a compatible conversion.

For ordinary external multiplexed HLS, consecutive segments can retain decoder references after the preceding segment has been completely queued. Those references are not reused across a seek, a changed playlist source, a sequence gap, an HLS discontinuity, or a media playlist's independent-segments declaration. A fresh entry can skip dependent pictures until a real IDR within the bounded segment, retaining the original presentation time and removing audio before that entry. Sequence gaps remain errors. Plex-server HLS and the separate audio-rendition path retain their independent-segment requirements. Existing codec, probe and resource limits still apply.

The optional packaged companion runs as a separately supervised process on an authenticated loopback endpoint, with an ephemeral token, bounded sessions and bounded disk usage. Its configuration is separate from the native provider profiles. An absent helper or unsupported capability is reported explicitly. A companion-enabled package requires the helper's verified binary, linker evidence and corresponding source; a local-source-only receipt is insufficient for publication.

Catalogues currently have explicit 50,000-entry and 32 MiB model limits. A limit produces a visible partial-catalogue error. Cancelling a scan stops subsequent work, but cannot interrupt a kernel filesystem call already blocked on an unavailable network mount.

This remains an experimental target. Host and ARM checks do not establish physical-TV playback, video-plane composition or firmware compatibility. Device-specific acceptance and known limits must accompany each release; no performance result is inferred from the upstream application.

### Post-admission playback failure diagnostics

In builds providing this extension, authenticated `state` and `status` replies
include `data.playback_failure`, beside `data.playback` and `data.preplay`.
Older builds may omit it or return the version-1 object containing only
`version`, `play_generation` and `code`. By default, current replies retain
version 2: `context` is null or contains only `demux_exit` and `pipeline_error`.
The capability `playback_failure_versions: [2, 3]` advertises explicit version
selection. Send `playback_failure_version: 3` in the command parameters to request
the additional typed IO cause. The version-3 value is `null` or an object:

```json
{"version":3,"play_generation":5,"code":"playback_interrupted","context":{"demux_exit":"none","pipeline_error":0,"io_failure":{"hls":{"exit":"hls_transport_failed","outcome":null}}}}
```

In version 3, `context` is `null` when no native details can be attributed to the failed
attempt. Otherwise it contains exactly `demux_exit`, `pipeline_error` and `io_failure`.
`demux_exit` uses the closed `DemuxExitClass::code()` vocabulary in the
native telemetry schema;
`pipeline_error` is the signed 32-bit native callback error number. An observed
`{"demux_exit":"none","pipeline_error":0,"io_failure":null}` means the matching
Engine recorded none of these details. It differs from unavailable context and
does not imply success.
Clients should preserve unknown diagnostic versions and codes when forwarding
JSON; do not interpret them as successful playback.

`io_failure` is `null` when no terminal producer-IO cause was recorded. Otherwise
it has exactly one of these members:

- `source_io: {transport: ...}`: an unrecovered source read error. Transport is
  `none`, `partial`, `recv_error`, `send_error`, `got_nothing`, `timeout`, `http2`,
  `reopen_failed` or `other`. Here `none` means that the read failed without a
  recorded curl-specific cause; it does not mean a successful read.
- `hls: {exit: ..., outcome: ...}`: an HLS terminal error. `outcome` is `null` or
  `deadline`; the latter identifies an expired active-stream prime deadline.
  The closed exit set is `hls_failed`, `hls_not_ready`, `hls_playlist_fetch_failed`,
  `hls_playlist_invalid`, `hls_playlist_window`, `hls_transport_open_failed`,
  `hls_segment_probe_failed`, `hls_segment_codec`, `hls_video_framing`,
  `hls_first_idr`, `hls_short_body`, `hls_audio_identity`, `hls_audio_empty`,
  `hls_video_timestamp`, `hls_audio_timestamp`, `hls_audio_framing`,
  `hls_no_video_au`, `hls_size_limit`, `hls_transport_failed` and `other`.
- `auto_fallback: {outcome: "refused"}`: the current automatic handoff was
  rejected. This does not by itself establish a server rejection.
- `audio_decode: {outcome: "inconclusive"}`: an audio decoder returned an error;
  the lower-level cause is not classified.
- `unclassified: {outcome: "inconclusive"}`: another observed terminal producer
  failure. The sibling `demux_exit` may provide more detail.

The first complete IO observation wins within its captured native epoch. It is
frozen with the matching failure before cleanup; a new native session clears the
live observation. The epoch remains internal and is not an extra wire identifier.
These fields add evidence without changing retries, fallback or playback policy.
They contain no source URL, credentials, raw error text or media title.

`play_generation` is an unsigned 64-bit integer
captured when that OTT request was admitted to native playback. It identifies
the failed request, even if the current request counter has since advanced;
do not substitute `data.preplay.attempt_generation`. Correlate it within the
same player runtime, not across application restarts.

The record captures the first typed error observed by the normal OTT
owned-playback failure handler, before native cleanup. It survives that cleanup,
`idle`, generic pending-request cancellation and subsequent reads. A newly
accepted playback request clears it before resolution, and admission or an
observed change to a different native playback owner also clears it. A queued
replacement discards the outgoing source's diagnostic binding even if that
source temporarily remains playing. The record is process-local and is not
saved with settings.

Native details are sampled before that cleanup only for the matching physical
Load and active native epoch. If the failed Engine was already released, its
details come from the snapshot retained with that session's failure before
teardown. A new Load clears the native snapshot, including a retry of the same
source. Status reads never replace a retained observation with later native
signals. A refusal before an attributable Engine exists has `context: null`.

During a same-source reload, the existing player may retain an earlier terminal
verdict while a replacement Engine exists. This diagnostic extension preserves
that error-code policy and returns `context: null` for the replacement, whether
it is healthy or failed, instead of mixing the old code with new native details.
A fresh playback request clears that retained verdict through the existing
request lifecycle.

This is not a history of every stop or end-of-stream. Existing guards exclude
pending requests, unmatched playback owners and failures handled separately by
kiosk or temporary-playback workflows. `null` means no retained matching
observation; it does not establish healthy playback or decoded audio/video.

The closed code vocabulary is `decision_refused`, `playback_policy`,
`no_video_transcode_target`, `no_video_track`, `media_source`,
`playback_interrupted`, `tv_pipeline`, `jail_missing_rtkmem`, `load_timeout`,
`release_timeout`, `resolve_failed`, `preview_not_direct`, and `unspecified`.
This vocabulary does not expand which failures the handler observes. Codes
classify existing signals; they need not identify the underlying cause.

The object contains no URL, credentials, media title or raw error text. It does
not change periodic presence, existing playback fields, or playback decisions.

## Build on an Apple Silicon Mac or ARM Linux host

Use Python 3.12+, Git, make, a C build environment and rustup. The pinned native
SDK supports macOS arm64/x86_64 and Linux aarch64; an ordinary x86_64 Linux
runner is not supported by that SDK release. Native dependencies additionally
need CMake, Ninja, Meson, pkg-config, autoconf, automake and libtool. Docker is
not required. Allow several GiB for source, the SDK, Rust and intermediate
objects; no build command deletes other projects or global build caches.

Native packaging and source export use a temporary Cargo home without the
caller's Cargo configuration or credentials. Registry and Git caches, including
their locks, are shared with the normal Cargo home; installed Rust toolchains
are unchanged. Only Cargo configuration files verified against the prepared
source tree are accepted. An external ancestor `.cargo/config` or
`.cargo/config.toml` is rejected; choose `--work-dir` outside that configuration's
directory tree rather than changing or deleting the existing configuration.

From the repository root:

```sh
python3 native/webos/build.py all --jobs 2
```

The local default is Rust optimization level `2`. The hosted candidate uses
`--rust-opt-level s` to optimize native code for size; these are the two supported
values. Pass the option to `build` or `all`. It does not change the separately
prepared companion. The build records the actual Cargo profile and archive,
forces the final application link, and checks the existing executable size limit.
This setting alone does not establish playback performance or TV compatibility.

The hosted workflow checks its Linux prerequisites before compiling: the host
libcurl must support TLS and HTTP/2, Python TLS must support ALPN, and the pinned,
hash-verified Pillow wheel must decode the packaged icon. It then runs the native
lint/type checks, default library and storage tests, the hostsim library tests
(including OTT interface and host playback regressions), package-validator tests and
recorded UI scenarios through the Linux simulator under Xvfb. These host checks
precede ARM packaging because host builds can change files in the staging tree.
They do not replace the later checks of the actual ARM package or testing on a TV.
Linux host builds also link Wayland client and GLib explicitly: default-feature
tests retain platform callbacks that reference those libraries directly. The
workflow installs their development packages; ARM32 packaging keeps its existing
Makefile linkage, and macOS keeps its existing host libraries.

The package validator accepts current `+control:` build fingerprints and the
supported historical stamp formats. A present malformed or unknown build stamp
fails validation rather than silently skipping checks for the build type.

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
3. `build` uses `RELEASE=1 FLAVOR=stable`. It builds the native archive and storage
   helper, checks the actual Cargo profile, then links and stages the application.
   The existing size and ELF checks must pass before `ipk-pack`. With an explicit
   `--companion-bundle`, it first validates that bundle and stages the helper with
   its `--link-evidence` after `ipk-stage`. It never contacts a TV.
4. `package` checks the native ARM executable, storage service, demuxer and
   package identity and the successful source-build receipt, then copies the independently named artifact.
5. `source` collects and verifies corresponding source, Cargo-vendored
   dependencies, bundled native dependencies and Rust runtime source.

After `all`, collect the additional GCC/glibc runtime sources and bind their
linker evidence to the exact package:

```sh
python3 scripts/webos-runtime-sources.py \
  --metadata build/native-webos/dist/ottplay-native-webos-0.3.0.json \
  --source build/native-webos/source \
  --sdk build/native-webos/toolchain/arm-webos-linux-gnueabi_sdk-buildroot
```

For a custom build directory, adjust these paths. Preserve the verified SDK
archive downloaded by `bootstrap`, or pass its location with `--sdk-archive`.
The collector checks linked runtime archives and objects against that pinned
SDK before claiming source coverage. `all` alone produces the primary source
archive; distribution requires this second step as well.

Default results are in `build/native-webos/dist/`. Keep these together:

- `ottplay-native-webos-0.3.0.ipk`
- `ottplay-native-webos-0.3.0.json` and `.sha256`
- `ottplay-native-webos-0.3.0-source.tar.gz` and its `.release.json` report
- `ottplay-native-webos-0.3.0-runtime-source.tar.gz`
- `ottplay-native-webos-0.3.0-source-set.json`
- `ottplay-native-webos-0.3.0-cargo-artifacts.jsonl`
- `ottplay-native-webos-0.3.0-build-config.txt`
- `ottplay-native-webos-icon.png`

`verify` rechecks the IPK. Source-validation reports distinguish a verified
source archive from an independently rebuilt binary; they do not claim a
rebuild has occurred when it has not. A change to the source pin or overlay
requires a new build directory, so stale objects cannot silently enter a new
candidate.

The build receipt records the patched source tree, exact IPK hash, Rust
version, actual SDK compiler hash and effective build configuration. Current
packages include the Cargo and Make evidence files listed above; keep them with
the bundle for verification and publication. Older packages without compilation
evidence retain their historical verification path, but cannot pass the current
checkout check. The archive digest is the producer's record of its input, not an
independent rebuild of that archive. Corresponding-source validation also
requires physical archives for every bundled native dependency, Cargo crates
and the Rust runtime; a list of download URLs alone does not pass.

### Favorites compatibility check

After `prepare` and installation of the repository's JavaScript development
dependencies, compare the native interchange fixture with the actual browser
codec and strict JSON parser:

```sh
node native/webos/test_favorites_conformance.cjs --check \
  build/native-webos/source/rust-modules/data/src/ott/fixtures/favorites-conformance.json
```

Adjust the source path for a custom `--work-dir`. The native Rust tests consume
the same fixture. A mismatch requires reviewing the format change and both
implementations; regenerating the fixture alone does not establish compatibility.

### Complete candidate build with companion

The complete experimental `0.3.0` candidate must include the companion and its
verified source closure. The native-only commands above remain useful for
isolated development but do not produce that complete candidate. This procedure
is not a record of a completed ARM build or TV test. Use the same pinned SDK and
original SDK archive throughout. Install host libclang first. The
[preparation step](companion/PREPARATION.md) installs the manifest-pinned Rust
toolchain (currently `1.96.1`) and ARM target, fills an explicit Cargo cache and
verifies the exact Rust source archive; it does not compile the player.
All paths below are placeholders. Use fresh bundle/source outputs and a fresh
native work directory; read versions from the manifests rather than reusing an
older release's filenames. Run the stages in order and stop if any command fails.

```sh
native_sdk="/absolute/path/to/arm-webos-linux-gnueabi_sdk-buildroot"
native_sdk_archive="/absolute/path/to/original-pinned-sdk.tar.bz2"
native_libclang="/absolute/path/to/libclang-directory"
native_companion_cache="/absolute/path/to/companion-cache"
native_companion_target="/absolute/path/to/companion-target"
native_companion_bundle="/absolute/path/to/new-companion-bundle"
native_companion_sources="/absolute/path/to/new-companion-sources"
native_preparation="$native_companion_cache/prepared.json"
native_work="/absolute/path/to/new-native-build"
native_version="$(python3 -c 'import json; print(json.load(open("native/webos/upstream.json"))["application"]["version"])')"

python3 native/webos/companion/prepare.py \
  --cache-dir "$native_companion_cache" \
  --libclang "$native_libclang" --target-dir "$native_companion_target" \
  --output "$native_preparation"

python3 - "$native_preparation" "$native_sdk" "$native_sdk_archive" \
  "$native_companion_bundle" "$native_companion_sources" <<'PY'
import json
import os
from pathlib import Path
import subprocess
import sys

receipt, sdk, sdk_archive, bundle, sources = sys.argv[1:]
prepared = json.loads(Path(receipt).read_text())
environment = {**os.environ, **prepared["environment"]}
subprocess.run([
    sys.executable, "native/webos/companion/build.py", "build",
    "--sdk", sdk, "--sdk-archive", sdk_archive,
    "--libclang", prepared["libclang"], "--target-dir", prepared["target_dir"],
    "--output", bundle, "--jobs", "2",
], env=environment, check=True)
subprocess.run([
    sys.executable, "native/webos/companion/sources.py",
    "--bundle", bundle, "--output", sources,
    "--readelf", str(Path(sdk) / "bin/arm-webos-linux-gnueabi-readelf"),
    "--rust-sysroot", prepared["rust_sysroot"],
    "--rust-source-archive", prepared["rust_source_archive"],
], env=environment, check=True)
PY

python3 native/webos/build.py all \
  --companion-bundle "$native_companion_bundle" \
  --work-dir "$native_work" --sdk "$native_sdk" --jobs 2

python3 scripts/webos-runtime-sources.py \
  --metadata "$native_work/dist/ottplay-native-webos-${native_version}.json" \
  --source "$native_work/source" --sdk "$native_sdk" \
  --sdk-archive "$native_sdk_archive" \
  --companion-bundle "$native_companion_bundle" \
  --companion-sources "$native_companion_sources"

python3 scripts/verify-webos-native-release.py \
  --metadata "$native_work/dist/ottplay-native-webos-${native_version}.json" \
  --check-checkout
```

Pass the preparation receipt's **entire `environment` object to both helper
subprocesses**, as above. This keeps the checked Cargo cache, pinned toolchain,
libclang and offline dependency access identical for build and source collection.
Use its exact `rust_sysroot` and `rust_source_archive` paths; do not substitute a
different installed toolchain or source download. Keep the same checkout, cache
and target directory through final SDK attestation. Preparation's `status: ready`
only confirms inputs. Source collection still records SDK runtime coverage as
`PENDING_ENCLOSING_RELEASE` until the enclosing runtime collector verifies the
helper's final-link inputs against the pinned SDK and supplies their sources.

Staging copies the helper manifest byte-for-byte and binds the packaged source
summary to the build receipt's local-input digest. The runtime collector embeds
`companion/companion-source.tar.gz` and its receipts inside the existing
`-runtime-source.tar.gz`; the release still has two top-level source archives.
Keep the helper bundle, source output and linker evidence until this collection
and final verification succeed. Those checks do not establish an independent
rebuild, real-device execution or functional parity.

## Install through LG Developer Mode

### Choose and verify the native package

The following example is for the planned `native-webos-v0.3.0-beta.1` release.
After publication, obtain `ottplay-native-webos-0.3.0.ipk`, its `.sha256` and
`.json` files, and the matching source set from that same release. Until then,
use only an explicitly supplied, verified candidate; these instructions do not
claim that a public 0.3.0 download exists. From the download directory, check:

```sh
shasum -a 256 -c ottplay-native-webos-0.3.0.sha256
```

Use the [checked update guide](../../docs/native-webos-delivery.md) for an
existing installation. The initial
[0.1.0 release](https://github.com/open-ott-play/ottplay-foss/releases/tag/native-webos-v0.1.0-beta.1)
remains a historical release; its device observations do not qualify 0.3.0.

The metadata must identify `type: native`, architecture `arm`, and application
ID **`com.openottplay.player.native`**. The ordinary OTT-play webOS package
uses **`com.openottplay.player`**. The Plex app from the LG store is a third,
independent application; launching it through a TV remote-control shortcut does
not launch the native OTTPlay app. Main-player releases and here.now deployments do not
update this native executable.

The initial 0.1.0 candidate passed loader-symbol checks against sampled webOS 3.4.0–11.2.0
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
ares-install --device YOUR_TV ./ottplay-native-webos-0.3.0.ipk
ares-install --device YOUR_TV --listfull
ares-launch --device YOUR_TV com.openottplay.player.native
ares-launch --device YOUR_TV --running
```

For a separately built and fully verified candidate, substitute its exact IPK
filename and verify its matching checksum and source set first. The old release
tag must not be used as a download location for a newer candidate.

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

The same released **0.1.0** package was also installed and launched on an
**OLED77C5PUA.DUSQLJR**, webOS SDK **11.2.0**, firmware **43.21.96**. Developer
connection and system information were verified, installation and launch
completed successfully, and `--running` confirmed the native application ID.
The IPK SHA256 matched the published release digest. This is installation and
startup evidence only; playback and decoder compatibility remain unverified on
this model as well. It does not qualify the **0.3.0** candidate.

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

#### CLI 3.2.6: duplicate callbacks or truncated command output

This was reproduced with `@webos-tools/cli` **3.2.6** and Node **26.8.2** after
validating the key and passphrase. The CLI's TCP connection probe connected,
then socket closure emitted `ENOTCONN`, completing the same callback twice.
It was a CLI probe error, not a reason to reset the TV or obtain another key.

The same CLI can report remote command completion on the SSH exit event before
stdout and stderr have drained. A successful exit alone therefore does not
prove that a large `ares-novacom --run` response is complete.

The optional [`ares-compat.cjs`](ares-compat.cjs) launcher guards that probe's
completion once, only for the exact reviewed CLI version and source hash.
For explicit `ares-novacom --run` commands (including `-r` and `--run=...`), it also waits for both output
channels to end and close and for destination writes to flush, preserving
nonzero exits and transport/write errors. Other commands keep the TCP-only
workaround. The launcher has no built-in deadline: a direct invocation can wait
indefinitely if a channel never closes. The native updater supplies its own
bounded subprocess timeout. For a direct diagnostic command, use a caller that
sets a timeout, for example this portable Python invocation (which terminates
and waits for its local launcher on timeout):

```sh
python3 - <<'PY'
import subprocess
subprocess.run([
    "node", "native/webos/ares-compat.cjs", "/path/to/node_modules/@webos-tools/cli",
    "ares-novacom", "--device", "YOUR_TV", "--run", "id",
], stdin=subprocess.DEVNULL, timeout=30, check=True)
PY
```

Ending the local launcher does not prove that a remote command has stopped;
use only bounded, read-only commands for this diagnostic.
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
when neither of these failures is present. The native updater opts in with
both `--ares-root /path/to/node_modules/@webos-tools/cli` and `--ares-compat`;
these options never modify the installed SDK or enable the workaround globally.

The updater verifies downloaded release assets against their expected size and
SHA-256 before publishing the final cache filename. It uses a same-filesystem
hard link that refuses to overwrite an existing file; use a local cache filesystem
with hard-link support. An abruptly killed download may leave a private
`.native-asset-*.part` staging directory, but a retry does not reuse it. Existing
cache files still undergo release verification and are never silently replaced.

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

A valid file can supply the managed Plex connection on later starts. Automatic
selection respects the saved provider and startup intent: a non-Plex provider,
an active profile, a Favorites selection or newer navigation takes precedence.
Sign-out revokes the connection for the running session; remove the file and
restart to stop future startup imports. In native
0.2, `Delete all local data` also clears app-owned provisioning and persistently
blocks managed startup imports, including `OTTPLAY_PLEX_PROFILE`; replacing a
file does not lift that block. See [local-data reset](../../docs/native-webos-delivery.md#delete-local-data-native-02)
for what is cleared and how to configure the player again.

A Plex Media Server token does not grant Plex account or Home-user features.
Account-scoped local resume positions and preferences are not promised in this
mode; use normal Plex sign-in for a complete account profile.

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
