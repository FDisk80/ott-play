# Read-only CLI acceptance for OTTPlay Native

The native CLI smoke helper collects evidence from an already running, paired
**OTTPlay Native for LG**. It checks the reported native version, remote request
handling and changes in the reported playback position. It does not install,
launch, stop, wake or reconfigure a player, select media, send keys or change
volume. No physical-TV validation has been performed for this helper yet.

Use the [native build and delivery guide](native-webos.md) to verify and install
the package separately. The native application ID is
`com.openottplay.player.native`; the hosted application
`com.openottplay.player` is a different installation.

## Run an observation

Use a trusted, installed OTT CLI with the player's existing configuration and
pairing. The helper resolves one installed CLI revision and loads that revision's
Python API and sibling modules; it records their hashes in the report. It reuses
the CLI's correlated `call_receipt` requests and capability/schema validation. A CLI path therefore
selects executable local code: use your known installation, not a downloaded
file or a path supplied by an untrusted report.

From the repository root:

```sh
python3 scripts/smoke-webos-native-cli.py \
  --player YOUR_NATIVE_PLAYER \
  --expected-version 0.2.0
```

To select the installation and bound the observation explicitly:

```sh
python3 scripts/smoke-webos-native-cli.py \
  --player YOUR_NATIVE_PLAYER \
  --expected-version 0.2.0 \
  --config /path/to/ott-config.json \
  --cli /path/to/ott \
  --samples 3 \
  --interval 2 \
  --timeout 10 \
  --budget 90 \
  --tv-status
```

`--samples` limits the number of observations, `--interval` sets the interval in
seconds, and `--timeout` bounds an individual remote request. `--budget` bounds
the complete observation in seconds, including settings and status reads.
`--tv-status` also requests the existing read-only TV status when available. It does not
launch an application or turn on the screen. An unavailable TV status must
remain unavailable evidence; it cannot establish which application is visible.

Do not substitute `--lane native` in existing OTT workbench commands. That lane
selects a bound **Android system agent**; it does not identify the LG native
renderer or grant access to its decoder.

For a single fresh native status reply, the existing CLI command is:

```sh
ott -j -t 20 --receipt YOUR_NATIVE_PLAYER status
```

`ott -j YOUR_NATIVE_PLAYER state` reads retained state and is useful for
inspection, but retained state is not a fresh playback observation. Do not use
`get_state` or `diagnostics` as player verbs: the CLI can interpret unrecognized
verbs as media searches and start playback. The helper uses the real CLI API
with an explicit read-only request list; it does not invent CLI verbs.

## Read the result by evidence type

An installed application or a successful launch request establishes neither a
working remote connection nor a moving picture. A current-app report identifies
the foreground application only to the extent the TV status service reports it.
The smoke helper does not itself perform a launch test.
The optional TV status is one snapshot taken before the other requests. It
does not establish that the application remains in the foreground throughout
the observation window.

A valid, correlated remote reply establishes that the control request reached
the selected runtime and produced a reply accepted by the CLI's protocol
validation. Merely finding an online session, reading a cached presence record
or receiving an enqueue acknowledgement is insufficient. The expected platform
and version must match; a hosted-player response cannot satisfy the native
check.

Increasing position values from one continuous media identity establish
**reported media-clock progress**. They do not establish that new video frames
were decoded, displayed correctly or accompanied by audible sound. The
observation must retain the runtime and media identity throughout its sample
window. A missing identity, runtime change, source change, position reset,
loop or seek-like jump prevents a continuous-progress conclusion. Separate
sessions must never be combined to manufacture progress.

The protocol does not expose a native playback-generation identifier or a
reliable profile identity for the playing item. A switch between profiles that
reuse the same provider and media identifier, a restart of the same item or a
small seek between samples can therefore be unobservable.
The position result is a bounded sanity check of reported progress, not proof
of uninterrupted playback.

The native status protocol does not expose a renderer presentation counter or
a decoded-video-frame counter. The report therefore keeps **renderer** and
**decoder** as `not_observed`, even when version, control and position checks
look healthy. A screenshot would establish only one captured frame; the TV's
separate video plane may not be included in an application capture.

Exit status describes the complete observation, not just its best check:

- `1`: an observed check failed; inspect its reason.
- `2`: acceptance remains incomplete, including missing evidence. Healthy
  control and position checks with unobserved rendering/decoding are incomplete.
- A successful host-test command returning `0` validates the helper against
  synthetic cases. It is not a physical-TV playback pass.

Do not present an incomplete report as a successful device acceptance. Retain
the individual results when investigating: control can work while the picture
is frozen, and a paused or sleeping player can be functioning as requested
without providing evidence of active playback.

## Timing and native diagnostics

The helper brackets requests with its own monotonic clock. A transport timeout,
malformed reply or insufficient sample window must not be repaired with an old
successful observation. A presence sequence advancing proves a new publication,
not a new decoded frame. Repeated reads of an unchanged cached record cannot
substitute for independent correlated replies.

The native application's existing event log has additional diagnostic fields,
but the CLI status response does not contain them:

- `loop` counts main-loop iterations. It is application liveness evidence.
- Lowercase `fps` counts actual GL swaps of the application's graphics plane.
  A settled idle interface can legitimately report zero. Older uppercase `FPS`
  counted loop iterations and must not be interpreted as rendering evidence.
- `vtick` and `vgap` describe the native pipeline's position callbacks. On the
  measured firmware those callbacks arrive at about 5 Hz independently of the
  video's frame rate. Despite the native callback's `FRAMEREADY` name, these
  are not decoded-frame or displayed-frame counts.
- Heartbeat `pos` is quantized to whole seconds; `play` is a media-clock rate
  estimate. A single position step, especially after a seek, is insufficient
  evidence of sustained progress.

These distinctions are implemented in the native source's
`rust-modules/src/app/run.rs::heartbeat` and
`rust-modules/media/src/player/mod.rs::sf_on_event`. A future log collector must
start at a fresh file offset, track file replacement and process/runtime
changes, and split observations at media discontinuities. The event log does
not timestamp every record, so counting old lines cannot establish elapsed
observation time. Host-simulator logs must remain host evidence.

## Optional media for a later device check

A personal library or provider subscription is unnecessary. The repository's
[synthetic A/V generator](../scripts/generate-av-diagnostic.sh) creates an
eight-second H.264/AAC MP4 with a moving pattern, timed left/right beeps and
corresponding flashes:

```sh
bash scripts/generate-av-diagnostic.sh /tmp/ott-av-diagnostic.mp4
```

This generation step requires FFmpeg and runs separately from the read-only
smoke helper. Serve or transfer the resulting file using an already approved
media path, then deliberately select it on the player before observing. The
helper does not publish a server or select the file. Start the sample window
early enough to finish before the eight-second file ends; do not count a loop
back to zero as additional progress. For a longer observation, provide a longer
synthetic fixture instead of merging several playback runs.

The checked-in [HLS runtime fixture](../tests/fixtures/media-runtime/README.md)
provides a separate two-second H.264/AAC MPEG-TS example. It is useful for a
format check, but too short for sustained-progress acceptance. Neither a
generated fixture nor a passed file-format check proves that an LG has played
it. Visible motion, correct aspect ratio, audio, A/V sync, remote interaction
and lifecycle behaviour still need their own device evidence.

## Host regression checks

The separate conformance checks import an explicitly supplied, trusted OTT CLI.
The first uses its real capability/settings validators without any network. The
second uses its actual request/receipt transport against a temporary loopback
controller and synthetic configuration. It never reads the personal CLI config.

```sh
python3 scripts/check-native-cli-settings.py --cli /path/to/ott
python3 scripts/check-native-cli-transport.py --cli /path/to/ott
```

The settings fixture reproduces the native schema bug: removing `aliases` from
the Native and Modern choice objects must fail validation; both corrected
choices, the complete schema and all three setting reads must pass. This is a
native schema correction, not a change to the web or Tauri settings. Optional
`--native-source /path/to/ott_settings.rs` compares the source choice objects to
the fixture. The loopback check also exercises `unsupported` and
`request_pending_timeout` through the real CLI, with one enqueue per request.

CI pins the CLI repository revision in
[native-cli-acceptance.yml](../.github/workflows/native-cli-acceptance.yml).
Both helpers report source hashes so a local installation can be compared with
that pinned check. These hashes identify parser/transport code, not a deployed TV.

```sh
python3 -m unittest discover -s tests -p 'test_webos_native_cli_smoke.py'
```

The host tests use bounded synthetic status samples and local fakes. They must
cover healthy partial evidence, wrong platform/version, frozen clocks,
unavailable or changing identity, resets/jumps, invalid timing and malformed
data without contacting a device. Renderer and decoder fields must never
become observed merely because the reported playback state is `playing`.

## Native 0.2 contract audit

The source audit covers `app/ott_commands.rs`, `ott_settings.rs`,
`ott_provider_settings.rs`, `ott_commands_offline.rs`, `ott_remote`,
`ott_companion_adapter.rs` and `data/ott/favorites_wire.rs` in the native source.
Read the capability response at the time of an operation; it is not a permanent
promise for every playback state.

- `player_settings` version 1 advertises `schema`, `get`, `set`, with at most 20
  descriptors per page. The native descriptors are `uiFontScale` (50–150,
  default 100, writable), `players` (Native, read-only), and `interfaceMode`
  (Modern, read-only). Writes require the source context and single-use revision;
  the smoke only reads them. No separate validate/apply command is advertised.
- `input` contains the six navigation keys while foreground playback is
  allowed; mute and volume keys additionally require an active native transport.
  Input and lifecycle acceptance precede their after-ACK effect. It does not
  prove the resulting screen or sound. Measured playback volume remains `null`;
  a desired volume is not a reliable getter reading.
- `playback` advertises category navigation when a selected list is available,
  pause/resume for an active transport, and seek/relative seek only for a finite
  timeline. `lifecycle` exposes exit, standby and wake; stream restart is added
  only when a retained route can restart. Process restart and device reboot are
  not advertised native operations.
- `vportal_settings` uses the provider settings adapter. Generic provider/profile
  requests, M3U/VPortal updates and the narrower Xtream/Stalker adapters are
  distinct from individually typed application settings. Do not infer support
  for every web-only setting from the presence of this marker.
- `offline_profiles` is conditional on the Local provider. It lists the existing
  list/load/save/export/import operations; this does not promise that every
  filesystem can be mounted or that every source binding is available on LG.
- `favorites_global` version 1 routes to the global document protocol. The
  native dispatcher does not claim the separate legacy or item/recovery
  extension schemas merely because a global Favorites list is present.
- `native_companion` advertises status/configure/start/stop. Plugin operations
  require a ready companion with plugin support; `torrent_indexer` requires a
  ready local Torznab implementation. These conditional capabilities must not
  be treated as installed or working plugins before their individual results.
- Native `status` and presence share bounded playback metadata projection.
  They expose state, kind, title, provider, media ID, channel number, position,
  duration and volume; unavailable values are null. The smoke discards display
  metadata entirely and emits only fixed check names, numeric deltas, validated
  request IDs and closed error reasons. `kind` currently derives from provider
  selection, so it is not independent evidence of a live or VOD decoder route.
- Neither `inspect`/debug snapshots nor frame counters are advertised by native
  0.2. `player_settings_patch` for command-server migration also remains
  unadvertised/unsupported; it must not be used as a settings fallback. The
  legacy translations are limited to channel selection, provider/playlist
  changes, volume and acknowledged exit. Unknown RPCs return unsupported;
  unknown **CLI words** may instead mean a media search.

An expected healthy report has `identity`, `control`, `settings` and `position`
observed, while `renderer`, `decoder` and `physical_display` remain
`not_observed`, and the overall `acceptance` is `incomplete`. A timeout is an
unknown result, not a claim that the application exited; an explicit unsupported
reply means the request completed with no implementation for that operation.
