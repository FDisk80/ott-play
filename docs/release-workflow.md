# CI and release operations — open-ott-play/ottplay-foss

The source of truth is `.release-policy.json`. `quality-gate.yml` runs the callable
validation workflows and produces the required **CI gate** status on every PR
and merge-queue commit. Superseded PR runs are cancelled. Without an explicit
`change_scope` policy, every change keeps full CI and normal release preparation.
Documentation-only skipping requires that explicit opt-in. When enabled, the
Change scope job checks the complete Git diff first; the gate accepts only proven
documentation skips. Missing, failed or unexpectedly skipped workflows fail the
gate. Unknown files, incomplete history, code, workflows and lockfile changes run
full validation.

The required ordinary **CI gate** uses `always()` so its existing result checks
still run after cancellation. [GitHub accepts skipped required checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks#handling-skipped-but-required-checks),
so using `!cancelled()` on this aggregate could allow an unfinished validator to
be hidden behind a skipped gate. Failed, cancelled, missing or unauthorized
skipped dependencies must produce a failing aggregate. A cancelled run whose
validators already all succeeded retains that valid result. Superseded runs can
therefore retain a short queued aggregate; do not trade this protection for
faster queue cleanup. Keep the separate release publication and signing guards
unchanged: cancellation must still stop those operations.

The optional `change_scope` policy provides exact `documentation_paths`, exact
`required_paths` for documentation used as a build input, and
`always_validate_workflows` for independently required checks. Documentation paths
cannot exempt source, tests, fixtures, build configuration or dependencies.
Documentation-only skipping applies to PR and merge-queue validation. Main-branch
pushes, manual dispatch, scheduled runs and release qualification retain the full
release path, even with `change_scope` enabled. This preserves security and contract
checks and avoids leaving an in-flight release without a replacement when the
default branch advances. The configured nightly policy is unchanged.

## Local checks

Use Python 3.11+ for the CLI and the project toolchains documented in `scripts/ci.sh`.
The scripts fail on missing dependencies and do not publish anything during checks.

```bash
python3 scripts/release.py check
python3 scripts/release.py status
```

Callable validation workflows:
- `.github/workflows/ci.yml`
- `.github/workflows/native-parity.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/dependency-review.yml`
- `.github/workflows/container-validation.yml`

The validation paths have different coverage:

- PRs and merge queues run the five workflows above after `scope` and
  `workflow-contracts`. Nightlies, RCs and final builds select the same default
  set through `release-quality-gate.yml`.
- Beta releases select `beta-checks.yml` instead of those five workflows. After
  `scope` and `workflow-contracts`, its existing job runs `npm ci`, the declared
  test inventory check, lint, typecheck and `test:unified`, in that order. The
  inventory check fails before the remaining steps if test declarations are
  incomplete; it does not execute the declared tests or replace full CI.
- Both gates also require release tooling contracts after `scope`, including
  the Python contracts, download retry regression and committed version check.
  The release build depends on successful preparation and the validation gate,
  so an inventory failure prevents platform builds without adding another job.

Beta lint, typecheck and `test:unified` overlap with full CI (`npm test` includes
`test:unified` through `test:port`). They do not cover the full frontend, Python,
Rust, native, remote integration or browser suites. In particular, a beta built
from a parent commit cannot validate changes to `ci.yml` in a later PR; matching
command names are not evidence for another source or workflow revision.

Release packaging applies the frozen version plan before compilation and checks
the resulting versioned artifacts. Release browser checks consume that build's
artifact ID and channel, with extended coverage for RC/stable; CI browser checks
consume the CI artifact. These artifact checks remain required even when source
checks overlap. A beta cannot be promoted to stable; it needs a fully validated RC.

The [release strategy](../RELEASING.md) defines versioning, channels, acceptance,
ownership, hotfixes and rollback. This document is the operational runbook.

The standalone macOS ARM64 server has a separate
[build, acceptance and preparation path](macos-server-release.md). Its executable
is not replaced by updating the web archive or the Tauri application.

## Nightly, beta and RC

During rollout, checks and builds run but public candidate publication is disabled
until repository variable `RELEASE_CHANNELS_ENABLED=true`. Enable it only after
required release reviewers are configured and legacy production webhooks have
been migrated. This prevents the first nightly/beta from reaching an old auto-deploy
handler. Manual beta/RC/stable requests fail with an explicit configuration error
until enabled; build-only nightlies remain available in Actions artifacts.

Nightly runs daily at the repository's staggered UTC schedule. Default-branch
pushes request beta builds through the same validation and build gates. Publication
also requires the opt-in variable and an eligible unreleased base version. GitHub can delay
scheduled runs; schedule timing is not an SLA. A committed base version (`X.Y.Z`)
is required. Version changes go through PR review, including any native companion
version files. The frozen release plan supplies full candidate versions to declared
format adapters before compilation; the manifest binds the plan and build receipts.

From a clean checkout matching GitHub's default-branch HEAD:

```bash
python3 scripts/release.py package --version 1.2.3 --channel rc
python3 scripts/release.py nightly --dry-run
python3 scripts/release.py beta --version 1.2.3
python3 scripts/release.py rc --version 1.2.3
python3 scripts/release.py status
```

Replace the example version with the committed project version. Native multi-OS
packages require the hosted build matrix; local packaging covers only supported
local targets. These commands never stage unrelated changes, push `main`, or create
tags directly. Publication commands dispatch `release-pipeline.yml` on the default
branch; `package` builds locally, `status` reads run history, and `--dry-run` only
displays the request.

If the base version already has a stable release, bump the committed version through
a PR before beta/RC publication. Nightly builds may still use that existing base. After every fresh check and platform build passes, an automatic nightly skips duplicate GitHub publication if retained immutable evidence qualifies an existing beta/RC/stable at the same source, policy and base. It reports `reused` with that tag, retains its Actions build artifacts, and does not advance the publication floor or create new promotion evidence. Reserved counters may have gaps. Mutable build inputs and current security databases are still exercised. Manual nightly requests, new sources and missing/expired/unverifiable evidence retain full publication.
Automatic push betas skip packaging/publication with `version-required` when their
committed base already has a stable tag. Quality and security checks still run.
Prepare the next version through a PR; manual beta/RC requests still fail strictly.

Candidate tags are unique and immutable: `vX.Y.Z-beta.N`, `vX.Y.Z-rc.N`, or
`vX.Y.Z-nightly.<UTC timestamp>.<run>.<attempt>`. Candidates are prereleases and
never update stable/latest. All required platforms must build before publication.
`release-manifest.json` records source SHA, workflow/run attempt and every payload
SHA-256. The manifest is also saved in immutable Actions evidence for 90 days.
Versioned Actions packages also record their producer repository, run ID, attempt
and source in every receipt; publication requires the current verified run identity.
The installer scopes build, signing and collection artifact names to that attempt.
ID-selected candidate downloads require a separate consumer check of receipt
producer identity and payload digest; the name-scoping helper does not verify them.
Before publication starts, use **Re-run all jobs** only if the allocator and
release policy permit reuse of that reservation. Recreate every required input
in the same attempt; older packages must not fill missing current builds. After
publication starts, or its result is partial or uncertain, inspect existing tags,
releases and assets before a policy-authorized new run. Never reset the ledger or
overwrite published assets. See [publication-phase retry rules](VERSIONING.md#package-identity-across-reruns).
Update shared fuzz workflow pins with the producer and collector rollout. Local
offline receipts cannot qualify live publication.

Automatic push betas and scheduled nightlies publish the current default HEAD.
An older source is explicitly marked `superseded` only after ancestry and one
newer automatic replacement run at current HEAD are verified. This does not claim
that the replacement passed or published. No tag, release or promotion evidence
is created for that skipped publication, and its reserved number is not reused.
Missing replacement evidence or API failures remain errors. Manual releases keep
their existing checks. A race after the final check can still fail publication;
inspect the error and dispatch a fresh run at current HEAD, never reset the ledger.

## Stable promotion

After testing the RC on the intended target/environment:

```bash
python3 scripts/release.py doctor
python3 scripts/release.py stable --rc v1.2.3-rc.1 --dry-run
python3 scripts/release.py stable --rc v1.2.3-rc.1
```

Approve the pending `release` environment in GitHub Actions. The publisher checks
that reviewers are configured, verifies the RC's successful run/attempt, default
branch ancestry, Release gate, immutable evidence and every payload checksum.
Stable `vX.Y.Z` copies the tested RC bytes without rebuilding. No override or
force-tag option exists. Expired/missing evidence requires a new RC. A partial
upload remains an unpublished draft; inspect it before any manual recovery.

Assets are uploaded to the draft's known release ID, using one bounded request
per file. Publication does not repeat a tag lookup for each upload: a draft may
not appear in the published-release-by-tag API. Each response must confirm a
created asset with the expected name and size; the final verification still
downloads and checks every payload before making the release public. A timeout,
incomplete response or upload conflict stops publication without retrying or
overwriting the asset. Preserve the draft and its evidence for inspection;
do not reset the version allocation ledger to reuse the failed build number.

Release-asset downloads use the expected size and SHA-256 from the validated
inventory before opening a new destination. Every chunk is checked before it is
written; a longer, shorter or different response is rejected. The transfer also
has one deadline covering stdout, stderr and silent waiting. Failure or
cancellation stops and reaps the transfer process and removes only its own
incomplete file. Existing destinations are never overwritten.

The shared `download_asset` helper requires `expected={"size": ..., "sha256": ...}`
and a `DownloadBudget(max_bytes, reserve_bytes=...)`. Reuse one budget across the
whole sequential inventory. `max_bytes` counts cumulative downloaded bytes, even
if a verified staging file is removed before the next download; hashing the same
bytes does not charge them twice. The separate `reserve_bytes` is the operator's
minimum free space on the destination filesystem, checked before each file and
during transfer, including silent waiting. Its default is zero; callers retain
any additional environment-specific capacity admission and reserve. Neither
parameter changes a consumer's release-size cap or reserves space against other
processes. Before each asset, its full expected size must fit the remaining byte
budget and currently free space above that floor.

The built-in promotion, closed-build resolution, registry publication and
versioned verification paths
share a budget derived from their validated manifest. Upload readback uses the
known local identities and a shared budget for its complete upload inventory.
Upload readback and promotion source downloads each use an internal allowance
of three times their total expected inventory size, with at most three GET
attempts per asset within one shared transfer deadline. Failed prefixes remain
charged to that allowance; each retry clears only its own staging file and
resets the per-file hash. Every accepted file must still
match its expected size and SHA-256. Authentication failures, transfer timeouts,
and cancellations are not retried, and publication writes are never replayed.
Operator-supplied budgets and other download paths keep their existing caps:
a retry stops if the remaining budget cannot fit the complete expected asset.
A consumer backport must update `release_control.py`, `release_closed.py`,
`release_versioned.py` and any installed `publish_verified.py` atomically
with their generated contract tests; the installer ships this complete bundle.
Calling the raw transport with an unbounded file object is no longer accepted.
The final release snapshot, provenance and signature checks still run after the
transfer. The offline regression suite is `tests/test_release_download.py`.

During publication, the current Actions run and its prerequisite gate can take
time to appear consistently in the API. The publisher shares one five-minute
wait across both updates and rechecks execution identity on every read. It
publishes only after the exact Release gate reports completed success. Failed,
skipped, duplicate or mismatched gates stop immediately; validating a previously
completed release never uses this propagation wait.

For a targeted consumer backport, record the reviewed toolkit commit and the
resulting client/test file hashes in the change review. Preserve that consumer's
signing requirements, asset restrictions and import adaptations. A partial
backport does not update every vendored module, so it must not claim a new
whole-toolkit revision. The installer reads files from its own checkout; a later
full regeneration from an older checkout can overwrite the backport. Regenerate
from a reviewed checkout containing these fixes, inspect the complete diff and
update the general revision only as part of that full migration.

GitHub releases do not deploy production. Existing push/tag/CI deployment hooks
must be migrated or disabled before enabling automatic prereleases. Container
and PyPI publication use verified stable assets as a separate explicit operation.

```bash
# Verify and display the exact registry operations; requires skopeo and registry login.
python3 scripts/publish_verified.py containers --tag v1.2.3
# Import the same OCI bytes, then optionally move latest after all version tags exist.
python3 scripts/publish_verified.py containers --tag v1.2.3 --execute --latest
```

If publication partially fails, inspect the existing immutable version tags before
retrying. The tool refuses to overwrite them. Never rebuild an image for stable.

## Qualified GitHub CLI

Release jobs install and check the exact native GitHub CLI before GitHub API operations. For local use, follow [the supported CLI installation and TLS profile](release-github-cli.md).

## Project limits and rollout requirements

- Retains web/server, desktop, iOS and Full Capacitor Android APK targets. The independent Kotlin Android app and Play Store publication belong to open-ott-play/ottplay-android.
- Classic emitted bundle smoke and ES5 checks are required, in addition to TypeScript checks.
- Physical TV/STB firmware, decoders, live IPTV streams and DRM are separate acceptance checks.
- OCI container archives are promoted without rebuild; deployment remains explicit.
- Tauri bundle metadata keeps the base SemVer because MSI rejects beta and RC labels. Under promote-bytes, RC and stable package/Cargo version fields use the final base version from the version plan; the full candidate tag, source and run identity remain in manifests and receipts.
- Production automatic updating is not configured: updater public key is a placeholder and latest.json is not generated. Manual installers are supported; unsigned iOS packages need operator signing/sideloading.
- Full Capacitor APKs are signed with the established update certificate and preserve the play.ott.foss application ID and localhost settings origin. Android installation may require on-device permission/confirmation.
- The separate Capacitor 6 API 22 APK supports Android 5.1/6 devices with WebView 60+. It shares the Full application ID, profile origin and signing certificate; modern devices keep Capacitor 8. Both APKs are built for beta/RC and promoted unchanged to stable.
- LG webOS delivery includes one unprivileged hosted web-app IPK for Developer Mode and an existing Homebrew Channel. The launcher loads the canonical HTTPS player and requires network access; it is not an LG Content Store package. Numeric installer versions use 1.0.<frozen build number>; RC-to-stable promotion preserves the package and feed bytes.
- Samsung Tizen TV delivery bundles the shared web player in an unsigned WGT. Installation requires an existing Samsung author/distributor profile accepted by the target TV; certificates stay on the operator computer. Family Hub is a separate, unqualified installation target. Frozen build numbers are projected into bounded numeric widget versions; RC-to-stable promotion preserves package bytes.

For public repositories, merge and verify the workflows before enabling the
additive Terraform **CI gate** ruleset. Where release/deployment workflows use
environments, configure reviewers and default-branch-only policies. The governance
repositories contain `release-standards.tf` and opt-in examples for public
repositories only. Do not extend these requirements to private repositories by
buying a plan or to workflows that have not landed.

Existing review/security rules remain in force. Physical hardware, real
credentials/streams and production access are not implied by unit tests or builds.

The release engine/client are vendored from `victron-venus/venus-os-ci-toolkit`.
They are excluded from consumer-specific formatting/type policy. Application
release workflows run the mandatory Release tooling contracts job; validation-only
projects receive the local client, whose contracts run in the toolkit. Update the toolkit source, then run
`python3 scripts/install_release.py /path/to/consumer` from the toolkit checkout;
add `--check` to detect drift without writing files. The installer is not vendored
into consumer repositories.

References: [GitHub schedules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule),
[protected environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments),
[artifact provenance](https://docs.github.com/en/rest/actions/artifacts).

## Migrating artifact selection without upgrading a consumer

For an existing public, hosted, versioned release pipeline, run the following
from a toolkit Git checkout containing the consumer's pinned shared fuzz commit:

```sh
python3 scripts/install_release.py /path/to/consumer --release-attempts-only --check
python3 scripts/install_release.py /path/to/consumer --release-attempts-only
```

The check reports drift without writing. The migration changes artifact names
and selectors in the existing generated release pipeline and its exclusive local
build adapters. It retains workflow pins, commands, gates, permissions, version
plans, exact-ID downloads and runtime files. Review and merge the producer and
collector changes together. This mode does not update dependencies, run builds,
dispatch releases, fetch Git objects, or delete retained Actions artifacts.

Unsupported or ambiguous layouts stop before any files are written. These include
legacy pipelines, closed-build importers, aliases on changed artifact edges,
adapters used by ordinary CI, opaque remote build producers and shared fuzz
revisions that still upload unscoped artifacts. Closed-build scripts can import
artifacts by exact name; their importers and workflow must be reviewed together.
Such revisions need a separately reviewed producer upgrade; changing only the
collector would leave it without a matching input. The pinned producer is checked
from its exact local Git object, with replacement objects and lazy fetching disabled.
This requires Git with the global `--no-lazy-fetch` option; an unsupported option
or missing local object stops before writes, without falling back to a fetch.
Workflow files and policy text are read and written as UTF-8 on every platform.

Every ordinary release artifact name now ends in
`-run-<run_id>-attempt-<run_attempt>`. A full same-run retry can retain previous
attempts without mixing their payloads. Before publication starts, use
**Re-run all jobs** only if the allocator and release policy permit reuse of that
reservation, so every required producer creates inputs for the same new attempt.
Re-running only a failed job can leave no current inputs, or an incomplete set;
older packages must not fill those gaps. Once publication starts, or its result
is partial or uncertain, inspect existing tags, releases and assets before a
policy-authorized new run. Never reset the ledger or overwrite published assets.
See [publication-phase retry rules](VERSIONING.md#package-identity-across-reruns).
Duplicate payload names remain errors, even when their bytes match.

Name selection does not add receipt verification. This mode leaves vendored
runtimes unchanged. Before qualifying releases, confirm that the consumer's
publisher verifies source, repository, run and attempt; older receipt/publisher
code needs a separately reviewed runtime update. Platform completeness requires
a source-declared set of required producer receipts plus package-specific checks:
a valid receipt for one platform does not establish that all required platforms
were built. The regression suite
uses synthetic packages with the toolkit's actual selector, collector and receipt
verifiers; it does not certify an older consumer runtime, a live release retry or
device acceptance.

## Automatic version preparation

Run `python3 scripts/release.py prepare-version --pr` from the clean default-branch HEAD. The command refreshes tags and opens a PR with synchronized owned version fields. An existing unreleased base is retained; use `--bump minor`, `--bump major`, or `--version X.Y.Z` for explicit intent. See [version plans](VERSIONING.md) for build overlays, the dedicated allocation ledger and recovery.

A local candidate package also needs the saved `.release-plan.json` at its exact source commit. Restore the `version_plan` object from the published `release-manifest.json` as `.release-plan.json` in a disposable checkout. Apply the recorded version fields with `python3 scripts/version_plan.py sync --root . --plan .release-plan.json` before `release.py package`; do not invent a tag or native counter locally. Ordinary development builds can use the project's native build command and explicitly local version identity.

### Migrate package receipt identity without replacing the release engine

For an existing public hosted versioned release, the toolkit can migrate reviewed
receipt, publisher and signing-preparation code without replacing action pins,
workflow adapters, package policy, or unrelated release APIs:

```sh
python3 scripts/install_release.py /path/to/consumer --release-receipts-only --check
python3 scripts/install_release.py /path/to/consumer --release-receipts-only
```

`--check` reports pending changes without writing. The migration recognizes
reviewed complete source shapes only. Unknown customizations, partly updated
functions or mixed old/new receipt, publisher and signer files require explicit
review; the renderer refuses the complete update before writing anything.
The generated header and detached-provenance requirement are preserved.

After migration, run a fresh, complete build of all required package producers in
one workflow attempt. The publisher verifies the independently supplied repository,
run ID, attempt and source SHA against every package receipt. Pre-migration receipts
without producer identity cannot qualify fresh package publication through this
migrated publisher. Existing historical promotion and retained-evidence validation
remain separate and unchanged. A failed-job-only retry cannot
fill missing current-attempt packages from an earlier attempt; regenerate the full
coherent package set instead. Existing release approval and acceptance policies
still apply.

Offline creation and inspection remain supported without an Actions identity, but
an offline receipt cannot qualify fresh publication through the migrated publisher.
Receipt coverage proves that
the staged files have matching receipts; package-set completeness is a separate
check for targets explicitly listed in `versioning.artifacts`. It does not infer
all intended platforms from workflow names. To require every intended producer,
declare `versioning.required_build_receipts` and apply `--release-inventory-only`
as described below. No release is dispatched by this mode.

### Require the complete set of package producers

Declare `versioning.required_build_receipts` as a nonempty list of exact receipt
filenames after reviewing every release-build matrix and conditional producer.
Each complete filename must be at most 200 ASCII characters, matching the release
asset staging limit; longer names are rejected during policy validation.
Include the final signature receipt when the publisher consumes one. For example,
an ordinary package and a later signing job require:

```json
"required_build_receipts": [
  "release-inputs-package.json",
  "release-inputs-signature.json"
]
```

Do not include `release-inputs-fuzz.json`: the authenticated RC validation receipt
is checked and separated from package receipts before this inventory check.
An intentionally smaller release scope needs its own reviewed policy; a skipped
producer cannot silently reduce the declared set.

For runtimes that already have package producer identity checks, apply only the
reviewed inventory delta with:

```sh
python3 scripts/install_release.py /path/to/consumer --release-inventory-only --check
python3 scripts/install_release.py /path/to/consumer --release-inventory-only
```

This mode changes only the known version-plan validator, receipt validator and
publisher. It does not infer or rewrite policy, workflow pins or signing code.
Unknown or partially migrated files fail before any changes are written.
The final fresh publisher authenticates each receipt's repository, source, run
and attempt, then rejects missing, duplicate or unexpected producer receipts.
Pre-signing validation remains separate because signature receipts do not yet
exist at that stage. Historical RC promotion retains its original source policy.

Update the declared set whenever producer jobs or matrices change. Receipt-set
completeness does not prove every package format inside a producer group; retain
declared artifact metadata checks and release asset verification.

## Maintaining documentation scope safely

The CI Toolkit correction is recorded at
[`56863cf0beed5ab97c4f27d7adb5aedb83c758d5`](https://github.com/victron-venus/venus-os-ci-toolkit/commit/56863cf0beed5ab97c4f27d7adb5aedb83c758d5).
This project has a channel-specific `release-quality-gate.yml` wrapper, so the
generic `--change-scope-only` migration deliberately rejects its graph. Maintain
this adapter explicitly: preserve the prepared release channel and keep
`FORCE_FULL: 'true'` in both the outer release pipeline and the inner release
validation classifier. Do not reinstall the entire release engine to update
only documentation routing.

Run the durable contract after reviewing scope changes:

```sh
python3 -m unittest discover -s .github/workflow-tests -p test_release_scope.py
```

The existing `toolkit_revision` fields record historical release-engine
provenance. The always-run contract rejects an older generator's documentation
skip; ordinary-documentation skipping applies only to PR and merge-group CI.

### Documentation validation

Documentation-only pull requests still run the existing README, translation,
manual navigation, source-digest and local-link checks in the CI configuration
contracts job. The job calls `tests/test_readme_docs.cjs` unchanged and installs
only TypeScript, using the exact version, registry URL and integrity hash from
`package-lock.json`. It does not install the frontend or native build toolchains.
Missing documents and stale translated manuals fail this gate. Full source and
release validation remain unchanged.
