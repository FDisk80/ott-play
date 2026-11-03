# Native webOS companion package

The separate native-player integration candidate launches the existing Rust
`ottplay-companion` as an app-owned child process. This is the same torrent,
storage and plugin implementation used by the other native players. It is not
an HTTP server exposed to the LAN.
`bin/ottplay-companion` listens only on loopback; every API request requires the
per-launch capability in `/companion/<token>/v1`. The launcher owns its lifetime,
cache directory, resource limits and capability.

The player controls, remote adapter and launcher policy described below belong
to that separate native integration. This helper packaging checkout does not
by itself provide those controls or install a launcher. Check the installed
native release's capabilities before using them. TV execution remains pending;
the build and staging commands below do not establish device compatibility.

## Using the native player

The **Torrent** provider appears only after the packaged local helper is ready
and has reported torrent playback and local indexer support. A binary existing
on disk is not sufficient. In the player's OTT settings, **Local torrent
service** offers enable/disable, a cache limit and **Start / retry service**.
The default configuration enables the service when protected player settings
have loaded and the application is in the foreground. A failed launch does not
trigger an endless retry loop; use Start / retry service after resolving the
reported problem.

Within Torrent, select an indexer, then a category or Search. Results form a
numbered list; Load more retrieves another bounded page. Selecting a result
prepares it through the local helper and, where needed, opens file selection.
The native decoder opens the selected file only after the helper reports it
ready. **Open torrent link** accepts a magnet link or an HTTP(S) torrent source
directly. **Add local indexer** asks for an ID, name, local Torznab endpoint and
API key. The helper stores indexer configuration privately; the player does not
copy those credentials into its profile metadata or remote status.

Only local/private-network indexers are accepted. This is distinct from torrent
peer traffic: P2P playback can communicate with peers and trackers outside the
LAN. There is no public companion proxy, remote engine address setting or
automatic fallback to an external engine when the bundled helper is missing.

Only materialized `.torrent` metadata, including byte-backed local references,
lets the helper inspect the private flag before creating its torrent engine.
When that flag is set, it creates no DHT session. Unresolved magnets, including
saved magnet references, use public DHT for metadata discovery even when they
list trackers. Their info hash may therefore reach DHT peers before metadata
reveals a private flag. Use original `.torrent` metadata when that distinction
matters; local indexer access does not make magnet discovery private.

## Authenticated remote control

These operations use the existing authenticated player command channel. The
JSON below supplies its `action` and `params`; retain the channel's normal
request ID and expiration envelope. Obtain the current player runtime from the
capabilities response's `player.runtime` and replace `<player-runtime>` with
that exact value. It changes when the player runtime changes. It is a session
identifier, **not** the helper's private per-launch URL capability; clients
never need or receive that capability.

`native_companion` version 1 accepts these exact parameter fields. Additional
fields, a stale runtime or an expired request are rejected.

| `op` | Fields besides `version`, `runtime`, `op` | Result |
| --- | --- | --- |
| `status` | None | Current local helper state, readiness, capabilities and effective limits. |
| `configure` | `enabled` (boolean), `cacheBytes` (integer bytes) | Saves the requested configuration durably. |
| `start` | None | Saves enabled state and a new retry revision, including when already enabled. |
| `stop` | None | Saves disabled state, then stops the helper and its owned playback. |
| `plugins` | None | Public manifests of packaged plugins, when supported by the running helper. |

For example, set the default 256 MiB limit:

```json
{
  "action": "native_companion",
  "params": {
    "version": 1,
    "runtime": "<player-runtime>",
    "op": "configure",
    "enabled": true,
    "cacheBytes": 268435456
  }
}
```

To retry a stopped or failed service:

```json
{
  "action": "native_companion",
  "params": {"version": 1, "runtime": "<player-runtime>", "op": "start"}
}
```

Replace `start` with `status`, `stop` or `plugins` for those operations.
Configuration commands return a durable-save result (`persisted: true`); that
does not mean the child process is ready yet. Poll `status` and inspect
`data.companion.ready`, `state` and `error` before relying on it. Enable/retry
effects wait for the foreground and never wake the player. An uncertain
settings write is not applied. Each committed retry revision causes at most
one launch attempt.

Plugin results contain `id`, `name`, `apiVersion`, `builtin`, `network`,
`allowedHostCount` and resource limits (`maxInputBytes`, `maxOutputBytes`,
`maxStreams`, `memoryLimitBytes`, `timeoutMs`, `maxNetworkCalls`,
`maxFetchBytes`). They contain no source URLs, host-address lists or tokens.
This command lists packaged plugins; it does not install plugins or execute
arbitrary remote scripts.

### Existing `torrent_indexer` version 1 wire contract

The native implementation uses the same six indexer operations as the other
players. Every request includes `version: 1`, the exact `runtime`, and `op`.
The following additional fields are mandatory, even when a value such as an
empty query is intentional. Unknown fields are rejected.

| `op` | Additional fields | Result |
| --- | --- | --- |
| `list` | None | `sources`, with public `id` and `label`. |
| `configure` | `sourceId`, `label`, `endpoint`, `apiKey` | Public `source` receipt after helper storage. |
| `remove` | `sourceId` | `removed: true` after helper storage. |
| `caps` | `sourceId` | `sourceId`, `searchAvailable`, `maxLimit`, `categories`. |
| `search` | `sourceId`, `query`, `categoryIds`, `offset`, `limit` | `sourceId`, `items`, `nextOffset`, `total`. |
| `prepare` | `sourceId`, `resultRef` | Opaque `sourceId` and `sourceRef` for the local engine. |

Example search:

```json
{
  "action": "torrent_indexer",
  "params": {
    "version": 1,
    "runtime": "<player-runtime>",
    "op": "search",
    "sourceId": "home",
    "query": "example film",
    "categoryIds": [],
    "offset": 0,
    "limit": 50
  }
}
```

Example indexer configuration, with placeholders rather than credentials:

```json
{
  "action": "torrent_indexer",
  "params": {
    "version": 1,
    "runtime": "<player-runtime>",
    "op": "configure",
    "sourceId": "home",
    "label": "Home indexer",
    "endpoint": "http://<private-indexer-host>:<port>/api",
    "apiKey": "<indexer-api-key>"
  }
}
```

`sourceId` matches `[a-z][a-z0-9-]{0,63}`. Limits are 128 UTF-8 bytes for
`label`, 4,096 for `endpoint`, 2,048 for `apiKey` and 512 for `query`.
The key and query may be empty; control characters are rejected. The endpoint
must not contain a query string or fragment. Search `limit` is 1–100,
`offset` is 0–1,000,000, and `categoryIds` contains at most 16 positive,
JavaScript-safe integer IDs returned by `caps`.

Use the 32-character hexadecimal `resultRef` from a current search result with
`prepare`. A `resultRef` is transient: the helper retains at most 512 result
handles for 15 minutes, so later searches can displace one. Search again when
that handle is unavailable; do not persist it as a playback identity.

The returned `sourceRef` is a durable local reference to the original metainfo
or full magnet. It survives helper restarts and is stored separately from the
media-piece cache. The store holds at most 128 references and 64 MiB, with no
silent eviction of durable references. Changing a source's endpoint or API key,
or removing the source, invalidates its references; changing only its label
preserves them. The shared player profile identity is exactly
`ottplay-local-torrent:SOURCEID/SOURCEREF`. This is not a media URL and does not
transfer the private reference payload or source credentials to another player.

`prepare` alone does not start playback; the native UI follows preparation with
a local session and file selection. The UI retains at most 512 search results,
matching the transient handle cache. This native implementation does not
advertise the separate `torrent_catalog` import/export protocol.

Preparation and playback require the app to be in the foreground and out of
standby. Indexer configuration/removal are management operations and do not wake
the player. Each queued request carries its expiration and cancellation scope;
the HTTP worker checks that scope before dispatch and during transport. Runtime
changes, cancellation or expiration cannot authorize a later queued mutation.
Cancellation cannot roll back a mutation that the helper already accepted.

## Storage limits and lifecycle

The native configuration accepts **64–512 MiB**, default **256 MiB**. At launch,
the effective budget is the smaller of the requested limit and available disk
space minus a **96 MiB reserve**, rounded down to whole MiB. If less than 64 MiB
remains for playback, startup fails with an insufficient-space error. The
reserve leaves room for the independent reference store and other app/system
work; it is not extra playable-media capacity. The native helper allows one
torrent session and two simultaneous stream readers.

The budget covers the **whole selected file's torrent-piece-aligned byte
range**, including boundary pieces where needed. It is not a rolling buffer
that can play an arbitrarily large file with a tiny cache. A file whose aligned
range exceeds the effective budget is rejected (`cache_limit`). A file near
256 MiB can therefore fail with the default budget, and a multi-gigabyte file
cannot currently fit this native-TV configuration. Selecting one smaller file
from a multi-file torrent does not reserve every other file in the torrent.

The app owns the helper process and every playback lease. It cancels pending
preparation/inspection and releases owned playback on background/standby,
replacement, cancellation and shutdown. A late result cannot replace a newer
native playback selection. Ready media uses an owned loopback transport that
does not follow redirects, use an environment proxy, or promote a file's
contents into an external HLS playlist.

While owned media is playing or paused, the adapter checks its session every
30 seconds to keep the lease alive. Failure or timeout stops that owned playback
before releasing its lease; it does not leave the decoder attached to a dead
URL. This lifecycle does not stop unrelated native Plex playback. Sleep or
background cancellation ends the lease rather than preserving a publicly
reusable stream address.

Host validation is not TV execution. Loader compatibility, available space,
device codecs and real playback/lifecycle behavior still require validation on
a physical TV; **device execution remains pending**.

## Build and verification

Run from the repository root with Python 3.11 or newer, Rust 1.96.1, the
`armv7-unknown-linux-gnueabi` Rust target, libclang, and the pinned SDK archive
identified by `native/webos/upstream.json`. Keep build output outside the source
tree. The wrapper reuses `src-rs/companion/build-webos.py`.

For CI and a fresh build host, follow [reproducible preparation](PREPARATION.md).
The preparation command installs the pinned Rust toolchain without changing the
host's default, verifies the Rust source archive, and fetches locked dependencies
into the selected cache before compilation and offline source collection.

```sh
python3 native/webos/companion/build.py build \
  --sdk "$WEBOS_SDK" \
  --sdk-archive "$WEBOS_SDK_ARCHIVE" \
  --libclang "$LIBCLANG_PATH" \
  --target-dir "$COMPANION_TARGET" \
  --output "$COMPANION_BUNDLE" \
  --jobs 2
```

The bundle contains the executable, a private link map, a deterministic local
source archive, source checksums and a build receipt. The wrapper checks source
inputs before and after compilation, pins the Rust toolchain and SDK archive,
and records the actual SDK executable hashes. Verification reads the binary's
ELF and program headers, plus fresh SDK `readelf` output. It rejects:

- Anything other than ARM ELF32 little-endian EABI5 with the soft-float ABI.
- An interpreter other than `/lib/ld-linux.so.3`.
- Executable stacks, writable executable load segments, runtime search paths,
  text relocations or unexpected shared libraries.
- Requirements newer than `GLIBC_2.12` or `GCC_4.3.0`, private ABI requirements,
  an imported `getauxval`, or linkage to the SDK glibc polyfill archive.
- Embedded private build paths. Rust and native compiler path mappings keep
  these out of the executable; the private link evidence retains original input
  paths for verification and is never installed in the app.

To inspect an existing candidate without assigning it a new source receipt:

```sh
python3 native/webos/companion/build.py inspect \
  --binary "$COMPANION_BINARY" \
  --readelf "$WEBOS_SDK/bin/arm-webos-linux-gnueabi-readelf"
```

Passing these checks establishes the declared binary ABI. It does not prove
that a particular TV firmware provides every symbol, that the child process
starts, or that media plays. Device execution remains explicitly false in the
receipt until the separate device validation records it.

## Native package hook

After the native application files have been assembled, but before the IPK data
archive is written, stage into the application root (the directory containing
`appinfo.json`):

```sh
python3 native/webos/companion/build.py stage \
  --bundle "$COMPANION_BUNDLE" \
  --readelf "$WEBOS_SDK/bin/arm-webos-linux-gnueabi-readelf" \
  --destination "$IPK_APPLICATION_ROOT"
```

The stage step re-verifies the binary and checksums, and refuses source changes
since compilation or an existing companion install path. It adds:

```text
bin/ottplay-companion             executable, mode 0755
companion/manifest.json          ABI and launch contract
companion/receipt.json           binary and source checksums
companion/source.json            source-archive reference
companion/licenses/              companion, QuickJS and shared-core notices
```

No tokens, runtime cache, absolute build paths, SDK, private link map or source
archive are copied into the app. The native IPK verifier must check this
executable as well as the main executable, and bind its bytes to the receipt.
Packages that offer local torrent playback must require this hook; a missing
helper must not silently become a remote-service dependency.

## Corresponding source and release gate

`local-source.tar.gz` contains the exact local Cargo workspace inputs, patched
path dependencies, generated shared-core artifact and build scripts. The source
receipt also lists the entire workspace lock's external package coordinates
and checksums. This is intentionally an input receipt, **not a declaration that
all corresponding source has been collected**.

The release source collector must merge the local archive with all locked
registry/git dependencies used by this build, their licenses, the Rust standard
library sources matching the toolchain, and the SDK runtime source selected by
`ottplay-companion.link.map`. Use the existing runtime-source collection process
to verify each linked SDK input against the pinned SDK archive. Hashing the SDK
archive and compiler executables alone does not prove that an extracted sysroot
was not changed. Publish the completed source artifact alongside the IPK and
include both checksums in the release manifest. Keep this release gate separate
from package staging so a local build cannot incorrectly claim complete source
or device compatibility.

`sources.py` creates `companion-source.tar.gz` and `source-closure.json` from
the verified bundle and pinned Rust source archive. It vendors dependencies
offline from the exact archived Cargo workspace, checks lockfile and file
checksums, and binds the result to the executable and real linker evidence.
Its receipt deliberately leaves SDK runtime coverage pending. The enclosing
native release collector verifies those SDK inputs and includes the companion
source within its existing runtime-source archive before claiming completion.

```sh
python3 -m unittest discover -s native/webos/companion -p 'test_*.py'
```
