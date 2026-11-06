# macOS ARM64 server delivery

The ARM64 desktop release job also builds the standalone `ottplay-server` from
the same checkout and frozen version plan. Updating the web files does not
replace this executable. The standalone server is a separate payload from the
Tauri application, and its signing status must be checked separately.

## Build and publication

After collecting the desktop bundles, the existing macOS ARM64 job runs:

```sh
cargo build --locked --release --target aarch64-apple-darwin -p ottplay-server --bin ottplay-server
python3 scripts/macos_server_artifact.py create \
  --binary target/aarch64-apple-darwin/release/ottplay-server \
  --directory tauri-artifacts --plan .release-plan.json
```

The producer uses one Cargo build worker and disables incremental output. It
creates and validates these three files before the ordinary release staging:

- `ottplay-server_aarch64-apple-darwin`
- `ottplay-server_aarch64-apple-darwin.dependencies.txt`
- `ottplay-server_aarch64-apple-darwin.build.json`

The record binds both payload hashes and sizes to the actual source, source
tree, target, package-version projection, Actions run and attempt. It records
the SHA256 of the original plan bytes separately from the canonical plan
digest. The helper rejects ambiguous names, symlinks, oversized files and a
binary that is not a thin ARM64 Mach-O executable. It does not run the server.

All three files enter the existing macOS producer receipt and release manifest.
The release policy additionally requires the record's `packageVersion` to match
the frozen plan. Generic artifact transport and promotion need no new format.
The Cargo crate's own version is not used as release identity.

The record has `releaseAccepted: false`: build evidence is not permission to
install. A successful upload or a matching filename is also insufficient.

## Independent acceptance

Use a full-payload verifier qualified for the exact source and workflow. The
older three-payload web/Tauri helper does not accept this server. A verifier
whose desktop allowlist recognizes only application archives must be extended
before using the new release.

The extension must require the exact server trio only when the source policy
declares it, and only for the macOS ARM64 producer. Existing desktop packages,
other target restrictions, complete payload coverage, byte readback, disk and
time bounds remain required. Retain the verified trio in a private directory;
streaming a payload and discarding it does not create an installable candidate.

The accepted full receipt includes a `macosServer` section binding the retained
files to the producer receipt, original plan bytes, canonical plan digest and
source tree. The preparation command below requires the receipt's exact hash
and the separately reviewed verifier implementation inventory and hash. Changing
that verifier requires reviewing its consumer pins as well; do not relabel an
old receipt or copy only its success flag.

RC package versions may be the final base version under `promote-bytes`, even
though the requested release tag still contains `-rc.N`. Promotion preserves
the original RC payloads and producer identity. Do not compare their build
record to the later promotion run or equate raw-plan and canonical digests.

## Prepare a server candidate

On the target ARM64 Mac, pass the actual accepted paths and independently
recorded hashes. The output directory must not exist. These arguments are
placeholders for the reviewed release, not values to infer from the latest tag.

```sh
python3 scripts/prepare_macos_server.py \
  --artifacts "$OTT_ACCEPTED_SERVER_FILES" \
  --acceptance "$OTT_FULL_ACCEPTANCE" \
  --acceptance-sha256 "$OTT_FULL_ACCEPTANCE_SHA256" \
  --implementation "$OTT_VERIFIER_INVENTORY" \
  --implementation-sha256 "$OTT_VERIFIER_INVENTORY_SHA256" \
  --source "$OTT_ACCEPTED_SOURCE" --tree "$OTT_ACCEPTED_TREE" \
  --version "$OTT_REQUESTED_VERSION" --output "$OTT_PREPARED_SERVER"
```

Preparation supports explicitly selected beta and RC releases. It verifies the
full receipt and retained bytes, actual Mach-O target, minimum macOS version,
system-library availability and code signature. A valid ad-hoc signature is
allowed; the command does not claim Developer ID signing or notarization.
Libraries in the dyld shared cache need not exist as ordinary disk files.
Relative, rpath and non-system dependencies are rejected by this standalone
delivery contract. A missing verification tool or unsupported host is an error.

The command writes a new `ottplay-server` with mode `0755`, `identity.json`, the
accepted receipt and implementation inventory, and `preparation.json`. It
rehashes the copy; download permissions are not trusted. It neither executes
the server nor changes a running service, LaunchAgent, profile or configuration.
Static compatibility checks are not a runtime playback test.

Use this candidate and identity with the existing server installer and fresh
current-binary and LaunchAgent hashes. Keep its ownership, compare-and-swap,
health and rollback checks. The requested version is explicit; preparation does
not impose an automatic upgrade/downgrade policy. Stable-promotion and nightly
receipts are rejected by this initial preparation interface rather than being
treated as beta/RC receipts.

## Offline regression checks

The ordinary release contract discovery includes both new suites:

```sh
python3 -B -m unittest discover -s .github/release-tests -p test_macos_server_artifact.py -v
python3 -B -m unittest discover -s .github/release-tests -p test_prepare_macos_server.py -v
```

Fixtures cover malformed or incomplete trios, mismatched hashes and provenance,
wrong executable formats, raw/canonical plan confusion, RC projections, partial
receipts, changed implementation pins, unsafe paths, producer cleanup and
executable-copy preparation. External host inspections are mocked. These tests
do not compile, download, install or execute a real server; the actual future
GitHub package and target-Mac service still require their own acceptance.
