# Publishing a native webOS release

The **Publish native webOS release** workflow promotes an already verified
candidate. It does not rebuild the package, install it on a television, or
claim that playback has been tested on hardware. Installation and package
inspection are covered in [Native webOS delivery](native-webos-delivery.md).

## Build and select the candidate

Merge the desired native changes and release tooling into `main` first. Run
**Native webOS candidate** (`webos-native.yml`) directly with
`workflow_dispatch` on `main`. Wait for the entire run to succeed.

Record the run ID, its full 40-character source SHA, and the numeric application
version from `native/webos/upstream.json`. The selected run must still refer to
the current `main` commit. If `main` advances, build a new candidate from the
new commit before publishing. A pull-request build, a reusable workflow run,
an expired artifact, or an artifact from another repository is not eligible.

The candidate artifact is named `ottplay-native-webos-candidate`. It contains
ten files: the IPK, package metadata, checksum, application source
archive, source receipt, runtime source archive, source-set manifest, icon,
`ottplay-native-webos-VERSION-cargo-artifacts.jsonl`, and
`ottplay-native-webos-VERSION-build-config.txt`. Here `VERSION` is the numeric
application version. The last two files provide the recorded compilation evidence.
See the [bundle inventory](native-webos-delivery.md#keep-one-complete-release-bundle) for their
purpose. The publisher checks both the GitHub artifact digest and the complete
package/source contract against the checked-out integration.

## Publish the verified files

Run **Publish native webOS release** (`native-webos-release.yml`) on `main` with:

- `candidate_run_id`: the successful direct candidate run ID.
- `source_sha`: its full commit SHA, also the current `main` SHA.
- `version`: the numeric package version, such as `0.2.0`.
- `tag`: a new tag, such as `native-webos-v0.2.0-beta.1`.

Supported tag forms are `native-webos-vX.Y.Z`,
`native-webos-vX.Y.Z-beta.N`, and `native-webos-vX.Y.Z-rc.N`, where `N` starts
at 1. The numeric version in the tag must match the package. The examples do
not indicate that a release with that version already exists.

For example, after replacing the run ID and SHA with the verified values:

```sh
gh workflow run native-webos-release.yml \
  --repo open-ott-play/ottplay-foss --ref main \
  -f candidate_run_id=123456789 \
  -f source_sha=FULL_40_CHARACTER_COMMIT_SHA \
  -f version=0.2.0 \
  -f tag=native-webos-v0.2.0-beta.1
```

The workflow performs three stages:

1. **Prepare.** Download and verify the ten candidate files. Generate the
   two Homebrew catalog JSON files with URLs for the exact release tag, and
   verify the resulting twelve-file bundle. Save it as a workflow artifact with
   an internal `promotion.json` receipt. No release or public catalog needs to
   exist yet.
2. **Publish.** Re-download the original candidate to prove that the handoff
   has not changed it. Create a new tag at the exact source SHA and a draft
   release. Upload all twelve files, download them again, compare their hashes,
   and run the complete bundle verifier. Only then make the release public.
3. **Verify public delivery.** Check the public release files and the exact
   catalog/icon responses from the metadata service, including its CORS
   response for `Origin: null`. This stage checks the immutable published
   version even if `main` has since advanced.

Only the publication job receives repository write access. Beta and RC tags
are marked as prereleases. Native releases do not replace the repository's
default latest release.

The generated catalog points to these fixed locations:

```text
https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/
https://ottplay-webos.igw-2560801.workers.dev/v1/TAG/ottplay-native-webos-repository.json
```

The internal promotion receipt stays in the workflow artifact; it is not an
thirteenth release asset or an independent proof of provenance. Publication
revalidates its source against GitHub's original candidate artifact.

## Describe the version

Commit optional release notes at `native/webos/releases/X.Y.Z.md` before
building the candidate, using its numeric application version. The publisher
reads this regular UTF-8 file from the verified source commit and uses it as
the release description. A beta or RC tag uses the same numeric version's notes.
Keep the file nonempty and at most 64 KiB, and describe features, limitations,
and the validation actually performed. Package verification alone does not
establish television playback compatibility.

An explicit `Release preparation:` notice, including its bold Markdown form,
blocks publication before a tag or release is created. Keep the notice while
package verification is pending. Before publishing, replace it with accurate
release notes and build a new candidate from that committed source. Removing
the notice is not evidence of hardware validation; report the actual limits.

An absent notes file preserves the generic description used by older versions.
Untracked files and later checkout edits cannot supply notes. A symlink,
invalid encoding, empty file, or oversized file stops publication before it
creates a tag or release. Do not edit the draft description while publication
is running: the publisher checks it again before making the release public.

## When a run fails

An existing tag or release, including a draft from a previous attempt, causes
publication to stop. The workflow never deletes a tag, overwrites an asset, or
silently resumes a partially published release. Inspect the failed run and
its draft before deciding how to recover; use a new unique release tag for a
new publication attempt. If the source changes, first build a new candidate.

If verification fails after the release becomes public, the workflow reports
failure and leaves that release intact for inspection. Correct the delivery
problem and use **Re-run failed jobs** to repeat public verification with the
original preparation bundle. The downstream jobs retain its producing
attempt's artifact name. Re-running the whole workflow also reruns publication,
which intentionally refuses the existing tag. A green build alone is not
evidence of successful public delivery or television playback.
