# GLib 0.18.5 security backport

The Linux Tauri / GTK3 dependency graph requires the `glib` 0.18 series.
Upgrading only this transitive dependency to 0.20 does not satisfy GTK3's
version requirement. The workspace therefore patches crates.io `glib` to
`vendor/glib-0.18.5`, with the upstream version retained unchanged.

The directory contains the complete published [glib 0.18.5 crate](https://crates.io/crates/glib/0.18.5),
including its MIT `LICENSE`, `Cargo.toml.orig`, tests and `.cargo_vcs_info.json`.
The source archive SHA256 is
`233daaf6e83ae6a12a52055f568f9d7cf4671dabb78ff9560ab6da230ce00ee5`,
which matches the original workspace Cargo.lock registry checksum.
`glib-0.18.5.provenance.json` records every published file hash and the sole
patched source hash. The shared Cargo registry cache is never modified.

The only change inside the published crate is the two-line fix in
`src/variant_iter.rs` from upstream
[commit b5a4071](https://github.com/gtk-rs/gtk-rs-core/commit/b5a4071e439bef2b5eea76c3aa25e5ae84839e34).
The pointer passed as a C out-parameter is declared mutable and passed as `&mut p`. This removes the
invalid write through an immutable Rust reference identified by
[RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html).
`glib-0.18.5-RUSTSEC-2024-0429.patch` records the exact source diff.

Validation:

```sh
node scripts/check-glib-backport.cjs
cargo test --locked --release --manifest-path tests/glib-variant-regression/Cargo.toml
```

The optimized regression exercises forward, reverse, mixed-direction, `nth`,
`nth_back` and `last` borrowed-string iteration using actual GLib FFI. It needs
Rust, pkg-config and the system GLib development package (for example
`libglib2.0-dev` on Debian/Ubuntu). It is a small standalone Cargo workspace,
so it does not compile the Tauri application or all upstream GLib tests.

The package version remains 0.18.5. Its provenance manifest and patch identify
the applied security fix for dependency scanners.
Remove this override and its regression fixture when the application can
move to a supported GTK dependency graph with the upstream fix, or a
compatible official 0.18 security release becomes available. All release
builds must include `vendor/`; Docker copies it before resolving Rust packages.

## macOS file drag pasteboard guards

The workspace also patches the exact locked [Wry 0.55.1](https://crates.io/crates/wry/0.55.1)
and [Tao 0.35.3](https://crates.io/crates/tao/0.35.3) releases. Their complete
published crates, licenses and version numbers are preserved. The archive
SHA256 values below were verified against the original workspace lockfile:

- Wry: `186f9871daa55fd9c016578b810d149de58367113db7fb72b462d2323ce19514`.
- Tao: `d1c93047acf68669466a34690ac58cca7010bd1b201e1ec86f1fd0a75d3dd4a9`.

AppKit can advertise `NSFilenamesPboardType` but return no property list when
the source cannot supply a readable file URL. Wry previously unwrapped this
optional result and both array/string downcasts. Tao unwrapped the result and
cast its array and elements without checking their classes. A panic cannot
unwind safely through these native drag callbacks, and messaging an object of
the wrong class can raise an Objective-C exception.

The local patches check for missing property lists, require an actual array,
and skip entries that are not strings or cannot supply UTF-8 data. Tao rejects
a missing or non-array payload; Wry returns no file paths through its existing
event/fallback path.
Valid file order, Unicode conversion and hover/drop event handling are
unchanged. File dragging remains enabled. These guards do not catch arbitrary
exceptions thrown by AppKit itself or establish that every crash has this cause.
No JavaScript or playback behavior is changed.

Each `.provenance.json` inventories every published file and identifies its
patched files. Each `-macos-drag-pasteboard.patch` records the single-file drag
guard; Tao also carries the separately recorded window patch below. The drag
guard is a local hardening patch, not a claimed upstream
release or advisory fix; the shared Cargo cache is never changed. Remove these
overrides after a compatible official release supplies equivalent guards.

```sh
node scripts/check-macos-drag-backport.cjs
```

The checker verifies the complete source inventories, all original/patched
hashes, lockfile overrides and that reversing each exact diff recovers its
published source. All platforms must receive these vendor directories before
Cargo resolves the workspace, even though the drag guards are macOS-only.

The macOS CI job also runs the [native drag regression](../tests/macos-drag-regression/README.md).
It invokes both dependencies' real hover/drop callbacks on isolated pasteboards
and verifies 32 cases, including missing data, wrong types and Unicode paths.

### Tao window geometry patch

`tao-0.35.3-window-aspect.patch` records the five additional files used by
[native window aspect locking](../docs/native-window-aspect-lock.md). Four
Linux files expose the X11 control and keep aspect, minimum and maximum size
hints under one Tao/GTK owner, with guards around fullscreen and maximize
transitions. The macOS window file keeps the simple-fullscreen restore frame
separate from the frame used by Zoom. The existing drag patch is unchanged.

The provenance manifest retains every published file hash and adds the five
resulting hashes plus the separate patch hash. The checker requires exactly
these files, verifies the entire crate inventory, and reverses each patch to
its published bytes. Missing, duplicated or unrelated patch entries are
rejected; changing a hash alone cannot bypass reconstruction. The lightweight
regressions run with `node tests/test_tauri_dependencies.cjs` and include
tampered files, patches and provenance. They do not establish native runtime
acceptance. Wayland remains unsupported by the aspect control; platform
acceptance is tracked in the linked guide.

## Shared OttPlay domain core

`ottplay-core.js` and `ottplay-core.jar` are generated from the same canonical
Kotlin Multiplatform source. `ottplay-core.manifest.json` records the source
receipt and artifact hashes; `ottplay-core.LICENSE.txt` contains the project
license and bundled runtime notices. Do not edit these generated files.

The ES5 distribution supplies guide rules, 13 provider archive adapters, 43
playlist adapters, three media parsers and the base player's Xtream catalog and
short EPG. Stalker JSON-RPC sessions/catalogs/EPG and BEST LiST Xtream catalogs
also delegate; the latter retains its M3U fallback policy in the core. Captured
fixtures exercise 19 Stalker and 12 BEST LiST contracts. Native Swift and Rust guide bridges evaluate this identical file.
Classic-player now/next selection, time shifts and full-schedule cache policy
also delegate, retaining inclusive end times, one-hour miss retry and 12-hour
response TTL. Forty-four captured scenarios preserve those contracts.
The archived Android bridge uses the JVM artifact. Other provider sessions,
state and playback controllers still need migration.

Update from the canonical core using `scripts/distribute.cjs install-native`
with this repository's absolute path. `node scripts/shared-core.cjs` checks the
pinned distribution; build staging verifies and packages it after polyfills.

Canonical source: [ottplay-core/shared-core](https://github.com/open-ott-play/ottplay-core/tree/main/shared-core).
Rebuild these artifacts from the canonical source repository. The pinned
consumer artifacts are self-contained and carry source and artifact hashes.

## Legacy Apple Blocks FFI backport

The macOS dependency graph still uses [block 0.1.6](https://crates.io/crates/block/0.1.6).
The workspace selects the complete published four-file crate plus the sole
source change recorded in `block-0.1.6-opaque-class.patch`. The original archive
hash matches the prior Cargo.lock registry checksum; per-file original and
patched hashes are in `block-0.1.6.provenance.json`. The [MIT permission and
Steven Sheldon copyright notice](block-0.1.6-LICENSE.txt) is retained separately
from the original four-file crate, with its immutable source and hash in that
manifest.

The patch transfers the inhabited opaque class representation from
[upstream b6438c7](https://github.com/madsmtm/objc2/commit/b6438c733a7a9bfe75e60b62126d1933137f42e4),
retaining the private `Class` name. Only pointers to that class are used. The
crate's public API, version and native `_NSConcreteStackBlock` symbol stay the
same. This removes a real `uninhabited_static` soundness diagnostic; no known
runtime crash or assigned vulnerability identifier is claimed.

```sh
node scripts/check-block-backport.cjs
# macOS with Rust and Xcode command-line tools:
node scripts/check-block-backport.cjs --runtime
```

The runtime check links the actual Apple Blocks runtime and a Clang `-fblocks`
caller. It verifies captured values, 128 copy/release cycles and exactly-once
capture destruction, while the original source must fail the relevant compiler
lint. Remove the override only after a compatible maintained dependency path
includes the equivalent fix and the native regression still passes.

## Tauri updater optional ZIP dependency

The workspace uses the published `tauri-plugin-updater` 2.12.0 API with a local
ZIP dependency update from `4` to `9` and a strict TLS policy. The previously locked ZIP 4.6.1 is
covered by [RUSTSEC-2026-0367](https://rustsec.org/advisories/RUSTSEC-2026-0367.html),
[RUSTSEC-2026-0368](https://rustsec.org/advisories/RUSTSEC-2026-0368.html) and
[RUSTSEC-2026-0369](https://rustsec.org/advisories/RUSTSEC-2026-0369.html); all list
9.0.0 as patched. These advisories concern Unix permission and symlink handling.
The application lock and standalone compatibility workspace now resolve ZIP
9.1.3, replacing 9.0.0 for the later
[GHSA-m665-v7pm-7grj](https://github.com/advisories/GHSA-m665-v7pm-7grj)
advisory. The regression manifest pins `=9.1.3`; the provenance checker requires
the same version and published crate checksum in both locks. This update does
not modify the vendored updater source or its two reviewed patches.
Their presence in an optional lock graph does not establish that the Windows
application can exercise those paths. Windows ZIP updates remain disabled;
raw MSI/NSIS updates and non-Windows archive support are unchanged.

`tauri-plugin-updater-2.12.0/` retains the published file inventory, both licenses and
upstream version. The sole omitted file is the crate's historical development
`Cargo.lock`: downstream builds do not use it, and the application and isolated
regression have their own reviewed locks. Its original hash is retained in
`tauri-plugin-updater-2.12.0.provenance.json` with the reason for omission.
The published archive SHA256 is
`7a5cad8ed5948d988e1018ecd31e27cacedbf72ce3fb972940c3e4bf51639e4b`;
its source commit is `5baf71a47292d8490f0ba3d53f15224e55c48327`.
The ZIP version constraints in `Cargo.toml` and `Cargo.toml.orig` differ; the
adjacent `-zip9.patch` records those two lines. `src/updater.rs` additionally
enforces certificate and hostname verification after optional client callbacks
for both metadata checks and artifact downloads. The public API shape remains
compatible, but dangerous invalid-certificate/hostname options are not honored
by this local build. Custom preconfigured TLS connectors are replaced with the
feature-selected verified backend; normal root-certificate additions remain
supported. The application already uses HTTPS and the secure defaults.
The `-tls.patch` records this source change; the provenance manifest records
every original and patched hash, and the checker reconstructs the upstream
bytes. No registry cache is modified.

```sh
python3 scripts/check-updater-backport.py
cargo test --locked --manifest-path tests/updater-zip-regression/Cargo.toml
python3 scripts/check-updater-features.py
```

The [isolated compatibility regression](../tests/updater-zip-regression/README.md)
compiles the actual updater extraction method with ZIP 9 and the strict TLS
helper on Linux and Windows. Loopback-only HTTPS checks use newly generated
certificates to prove valid trusted requests work while untrusted certificates
and wrong hostnames are rejected. No production keys or external server are used.
ZIP 9 requires Rust 1.88+ when enabled; CI uses stable Rust. Native Windows
installer lifecycle tests remain required. Remove this override only when a
compatible upstream updater resolves a patched ZIP release and preserves the
same enforced TLS verification; retain the regression coverage until then.
