# Same-ID diagnostic builds on GitHub workers

`webos-native-debug.yml` builds an instrumented ARM IPK for an explicitly selected
commit. It keeps `com.openottplay.player.native`, title `OTTPlay` and the declared
app version. It does not install, launch, publish, tag or promote anything.

The explicit receipt field is `build_mode: debug`. Its native build flags match
the established diagnostic recipe: `RELEASE=1 FLAVOR=stable SYMBOLS=1
ALLOW_DEV_ON_STABLE=1 ARM_PROFILE=release`, only the `devtriggers` feature, opt-level
2, fat LTO and one codegen unit. `stable` selects the normal **application ID**;
it is not a shipping qualification. `SYMBOLS=1` retains DWARF without `DEBUG=1`'s
core-dump behavior. The staged executable is stripped; `plxnative.debug` has the
same GNU build ID and must contain `.debug_info` and `.debug_line`.

## Start one remote build

Before the new workflow exists on the default branch, the assigned CI owner can
create one branch named `ci/native-debug/FULL_40_HEX_SHA` at that exact reviewed
commit, which must already contain this workflow and its helper. The push job
requires the exact repository and exact equality between the branch suffix and
`github.sha`; a later push to another commit on that branch cannot start a build.
Ordinary branches and PR events do not run this workflow. No fork code is selected.
The job has only `contents: read`, no secrets, no persisted checkout credentials
and a 90-minute limit.

Commands below trigger remote work and should only be used by the assigned CI
owner after source review, from the official repository checkout containing the
reviewed commit (replace the SHA; do not run both routes):

```sh
NATIVE_SOURCE_SHA=FULL_40_HEX_SHA
git push origin "$NATIVE_SOURCE_SHA:refs/heads/ci/native-debug/$NATIVE_SOURCE_SHA"
```

The CI owner creates this ref once; other delivery workers must not duplicate it.
If the branch already exists, inspect the existing run rather than updating or
recreating the ref blindly.

After the workflow reaches the default branch, dispatch on a branch/tag whose
tip is the chosen full SHA. The job refuses if `source_sha` differs from the
selected event SHA:

```sh
gh workflow run webos-native-debug.yml --repo open-ott-play/ottplay-foss \
  --ref BRANCH_OR_TAG -f source_sha=FULL_40_HEX_SHA -f build_mode=debug
```

GitHub requires a dispatch workflow to exist on the default branch. See
[manual workflow execution](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
and [push events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#push).

## Build and validation performed on the worker

Bounded archive indexing and the complete private-path policy run before the
structural verifier materializes the payload. Data expansion is limited to
512 MiB and control expansion to the existing JSON document limit.

The job uses the existing pinned SDK bootstrap, companion preparation/build and
isolated Cargo environment. It does not run the full host suite, simulator,
recordings or a device. Its small evidence-contract test command is:

```sh
python3 -m unittest discover -s native/webos -p test_build_debug.py -v
```

After `native/webos/build.py prepare` and `bootstrap`, the diagnostic command is:

```sh
python3 native/webos/build_debug.py --build-mode debug --source-sha "$EXPECTED_SOURCE" \
  --jobs 2 --sdk "$WEBOS_SDK" --sdk-archive "$WEBOS_SDK_ARCHIVE" \
  --companion-bundle "$RUNNER_TEMP/companion-bundle" \
  --control-discovery-url "$NATIVE_CONTROL_DISCOVERY_URL" \
  --control-discovery-sha256 "$NATIVE_CONTROL_DISCOVERY_SHA256"
```

It builds the application archive, storage service, `ipk-stage symbols`, then
stages the independently verified companion and uses the existing `ci/mkipk.py`.
`ci/check-elf.sh`, `ci/check-packaged-elf.py`, the normal IPK structural verifier,
the outer release verifier's bounded `check_package` (including its full private
path policy and PNG validation, without invoking shipping configuration checks),
actual Cargo feature/profile evidence, executable metadata, source rechecks and
matching symbol/build-ID checks must pass. All ELF link receipts are retained.
The shipping `ipk-pack` / `ci/check-package.py` route intentionally rejects a
same-ID diagnostic build, so this separate route never calls or weakens it.
No shipping size/quality/release qualification is inferred from diagnostic PASS.

## Accept the artifact before preparing an installation

Accept only a completed successful run of this workflow for the reviewed source,
repository and event. Record its numeric run ID and attempt. The run's
`head_sha`, `github.sha` and `diagnostic.json.foss.commit` must all identify the
reviewed commit. For a push run, also verify the exact
`ci/native-debug/SOURCE_SHA` branch name; for dispatch, verify the selected ref
and explicit source input.

The artifact name is
`ottplay-native-webos-diagnostic-SOURCE_SHA-RUN_ID-ATTEMPT`. Accept exactly one
unexpired artifact, record its immutable artifact ID and GitHub SHA-256 digest,
and verify the downloaded archive digest before bounded safe extraction. Verify
every file listed in `diagnostic.json.files` by bytes and SHA-256, and require:

- `kind: ottplay-native-diagnostic`, schema 1, `build_mode: debug`, completed
  status; normal app identity; `official_release: false`;
- exact outer FOSS commit/tree, native prepared `tree`, upstream `revision` and
  `integration_sha256`, not a fabricated local Native Git commit;
- exact run/attempt, SDK/toolchain, one successful application Cargo artifact
  with only devtriggers, matching main/symbol build IDs and all package checks;
- IPK hash from `package.sha256` and main hash from `main.sha256` agree with the
  independently inspected package, and the companion receipt is present.

The archive contains `ottplay-native-diagnostic.ipk`, `plxnative.debug`, the
diagnostic receipt, Cargo/config evidence, prepared-source receipt and ELF link
evidence. The companion's source closure is a separate artifact. This diagnostic
bundle does **not** claim complete corresponding source or replace the shipping
release's source closure. Keep it out of Homebrew/official release promotion.
The existing promoter accepts only `ottplay-native-webos-candidate` from
`webos-native.yml`; neither its selection nor shipping validators change here.

Do not pass this artifact to a helper that expects local five-stage build
receipts or a local Native HEAD equal to the prepared overlay tree. Installation
binding must consume the independently accepted hosted receipt honestly, retaining
the existing exact package/executable/metadata/profile guards. Reuse the current
installed-device baseline and a fresh one-use transaction marker. Building this
artifact grants no device operation; no profile, device or network credential is
part of it. Device playback and UI remain unverified until separately observed.
