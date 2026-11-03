# Deliver and update OTTPlay Native for LG

Use this guide to verify a native release and update an existing installation.
The [native build guide](../native/webos/README.md) describes source preparation,
SDK setup and first-time Developer Mode access. The [hosted installation
guide](lg-webos-installation.md) describes the separate web application.

Native package **0.2.0** is published as
[native-webos-v0.2.0-beta.1](https://github.com/open-ott-play/ottplay-foss/releases/tag/native-webos-v0.2.0-beta.1).
Use its existing release assets; updating a television does not require a new
build or publication. The package metadata records
`device_validation: not_performed`. Publication and package verification are
not proof of playback or state retention on the receiving television.

## Identify the application first

**OTTPlay Native** uses application ID `com.openottplay.player.native` and a
native ARM executable with an SDL/OpenGL interface. **OTT-play hosted** uses
`com.openottplay.player` and loads the shared player website. The Plex
application from LG Apps is another independent installation.

These applications have separate update streams and state. A deployment to
`player.ottplay.here.now` or a new Tauri/OTTserver build does not replace the
native executable. Conversely, installing a native IPK does not update the
hosted player, import its profiles or transfer its remote-control consent.
Select the intended application ID in both the installer and the launch command.

The native package has its own numeric version. Read it from the release's
metadata and IPK; do not derive it from a main-player release number. For
example, the initial native release tag `native-webos-v0.1.0-beta.1` contains
native package version `0.1.0`. A beta label is not part of the numeric version
that the TV installer compares. A subsequent installable candidate needs the
version chosen for that candidate, consistently applied to all package
descriptors and manifests.

## Keep one complete release bundle

Download the following files from the **same native release**. In these names,
`VERSION` means the numeric native package version, not the Git tag:

- `ottplay-native-webos-VERSION.ipk` — installable package.
- `ottplay-native-webos-VERSION.json` — package identity and build receipt.
- `ottplay-native-webos-VERSION.sha256` — checksum for that IPK.
- `ottplay-native-webos-VERSION-source.tar.gz` and
  `ottplay-native-webos-VERSION-source.tar.gz.release.json` — application,
  adaptation and dependency sources with the primary report.
- `ottplay-native-webos-VERSION-runtime-source.tar.gz` — additional runtime
  sources and final-link evidence.
- `ottplay-native-webos-VERSION-source-set.json` — binds the two source
  archives to the package.
- `ottplay-native-webos-icon.png` — artwork used by the release catalog.

A Homebrew Channel publication also includes
`ottplay-native-webos-manifest.json` and
`ottplay-native-webos-repository.json`. Those files must describe this bundle's
ID, numeric version, IPK size and SHA-256, icon and matching source URLs. Do not
reuse a previous candidate's manifest after rebuilding the IPK.

The native source set retains its GPL-3.0-or-later license and dependency
notices. Distribute both matching source archives and the source-set receipt
with the binary. The primary archive by itself does not contain all the
runtime-source evidence. See [the source-set explanation](native-webos.md#the-matching-source-set).

## Verify the downloaded files

Keep the bundle in one directory. From a checkout containing the verifier, run:

```sh
python3 scripts/verify-webos-native-release.py \
  --metadata /path/to/downloads/ottplay-native-webos-VERSION.json
```

For a bundle intended for Homebrew Channel, require its catalog files too:

```sh
python3 scripts/verify-webos-native-release.py \
  --metadata /path/to/downloads/ottplay-native-webos-VERSION.json \
  --require-feed
```

The verifier reads the adjacent files offline; it does not install an SDK,
contact the TV or fetch missing artifacts. A missing file, mixed version or
hash mismatch must be resolved before installation or publication. A passing
result establishes agreement between the distributed bytes and their receipts.
It does **not** establish an independent reproducible rebuild, LG approval,
successful playback or retention of settings. In particular, `NOT_RUN` and
`NOT_PROVEN` rebuild fields are not successful rebuild results.

For a quick check of the IPK alone, run the command below **from its download
directory** with the actual version substituted:

```sh
shasum -a 256 -c ottplay-native-webos-VERSION.sha256
```

Linux can use `sha256sum -c` instead. This single-file check does not replace
verification of the source set and catalog.

## Prepare an update without discarding state

Before replacing the application, record the installed native version and
confirm that the new bundle uses the same application ID. Keep the previously
verified IPK available until the new installation has passed its checks. Do
not uninstall the application, disable Developer Mode or clear its data as
part of a routine update.

Stop playback and close only the native application before taking a private
state backup or installing the update. Where the installed version provides
profile/Favorites export, use that version's supported export mechanism. Do
not assume that an export or remote command exists merely because the hosted
player supports it.

An installation managed through private files needs particular care:

- Preserve `ottplay-profile.json`, when present, from the installed application
  directory. It may contain the managed Plex credentials. Keep its backup
  private and restore it only to the intended installation.
- Preserve `ottplay-control.json`, when present, as private provisioning data.
  Never include its remote-control credentials in a release or public receipt.
- Versions that create an `ott-state` directory require that directory to be
  preserved as a unit. It can contain encrypted OTT state and control
  configuration. Keep the original bytes; do not rewrite the encrypted records
  or include them in a release artifact.
- Retain the native application's existing Plex sign-in and preferences. They
  are separate from a managed profile file and must not be replaced with the
  hosted player's browser storage. The storage service uses protected DB8 data
  and keymanager keys outside the application directory. Copying that directory
  alone does not back up the complete protected store or make it portable to
  another television.

Use the actual installed application directory and the already authorized
device connection. Homebrew and Developer Mode layouts can differ. Restrict
local backup directories to the owner and configuration files to mode `0600`;
never put these backups in the source tree, public logs or a shared release
directory. Device-encrypted state is not a portable profile export: copying it
to another TV or recreating its encryption keys may make it unreadable.

An in-place update avoids deliberate data deletion, but the installer may
replace files inside the application directory. After installation and before
the first launch, check that the managed profile and any version-specific state
directory are still present. Restore missing files from the private backup
only when the new version's migration contract accepts them. Preserve their
permissions and original encrypted contents. If the state is incompatible,
stop and retain both versions of the state instead of overwriting it.

Installing an older IPK is not automatically a safe rollback: its code may not
understand a newer state schema. Check the release's downgrade guidance and
use a matching pre-update backup when recovery requires one. Never work around
an installer version refusal by changing the application ID; that creates a
different installation and loses the intended state continuity.

## Delete local data (native 0.2)

`Delete all local data` is an explicit reset. It stops OTT playback, remote
control and the local helper, then clears protected profiles, Favorites,
playback positions, settings, pairing and app-owned helper data. It also removes
`ottplay-profile.json` and `ottplay-control.json` from the installed application
directory. Source video files and an external file selected by
`OTTPLAY_PLEX_PROFILE` are not deleted.

A durable reset marker prevents managed startup files from automatically
restoring the deleted configuration, including an external
`OTTPLAY_PLEX_PROFILE`. Restoring a provisioning file alone does not re-enable
managed startup import; there is currently no supported command to lift this
block. After a successful reset, configure the player again through its normal
interface and pair remote control again as needed.

Incomplete deletion is reported. Retry deletion if data remains; protected
profiles and pairing cannot reload while their reset is incomplete. For ordinary
package updates, preserve provisioning files and the entire `ott-state`
directory, including the reset marker, as described above.

## Checked update helper with an existing Ares connection

`scripts/update-webos-native.py` updates the existing
`com.openottplay.player.native` application through an already configured Ares
device alias. It does not create an alias, obtain a key, uninstall an application
or switch between native and hosted players. Keep the same private work directory
for planning, installation and any later diagnosis of that update.

The following paths and alias are placeholders. First prepare and verify the
published package without contacting the television:

```sh
python3 scripts/update-webos-native.py \
  --device YOUR_TV --tag native-webos-v0.2.0-beta.1 \
  --work-dir /absolute/path/to/private/native-update
```

This is the default dry-run. Release verification may contact GitHub; no Ares
device requests are made. Use `--bundle-dir /absolute/path/to/downloaded-release`
to reuse local release files while still checking their official release
identity and hashes. No source compilation or release publication is needed.
The helper checks four official assets: the IPK, package metadata, checksum
and source-set receipt. It verifies their published hashes and package identity;
it does not download or rebuild both source archives. Use the complete bundle
verifier above for the broader source and catalog checks.

Device operations require macOS or Linux and an existing Developer Mode alias.
If Ares is not on `PATH`, add
`--ares-root /absolute/path/to/node_modules/@webos-tools/cli` to select the
supported CLI version `3.2.6`. Add `--ares-compat` only when using the existing
repository compatibility wrapper; it requires that explicit `--ares-root`.
These options reuse the alias and credentials already configured on the
computer. They do not enable Developer Mode, start Key Server or acquire keys.
Private state transfer also verifies the supported CLI source before installing
an update that needs a state backup. It supplies the saved bytes through a
dedicated private file descriptor after the remote stream is ready. This avoids
the CLI's early standard-input listener and control messages; file contents are
not embedded in command arguments or logs. If that transport cannot be
validated, the update stops before installation.

When the intended television is available, explicitly request read-only checks:

```sh
python3 scripts/update-webos-native.py \
  --device YOUR_TV --tag native-webos-v0.2.0-beta.1 \
  --work-dir /absolute/path/to/private/native-update --preflight
```

The device check requires LG's [device-specific identifier](https://webostv.developer.lge.com/develop/references/device-unique-id)
through the existing authorized connection; an IP address, alias and model alone are insufficient.
Run this local LGUDID check with the device owner's agreement.
Only its hash contributes to the saved identity. The raw identifier is not
retained in journals, receipts or logs; the command transport temporarily
buffers its response in a private file. If the TV denies or cannot provide this
information, the helper stops before updating. This local identity check does
not grant extra permissions or authenticate the SSH peer. A journal created with
the older alias-and-model identity cannot authorize restoration to a newly
identified TV.

Review the detected native application and version, then apply the same update:

```sh
python3 scripts/update-webos-native.py \
  --device YOUR_TV --tag native-webos-v0.2.0-beta.1 \
  --work-dir /absolute/path/to/private/native-update --apply
```

The helper validates the official release and local package before installation.
It closes the native app and verifies both the application manager and native
process state before capturing the known private files. It then performs one
same-ID installation, reads back the installed identity/version and payload
hashes, preserves the captured state and verifies launch. A close or launch
acknowledgement alone does not complete those checks. Missing access, ambiguous identity, a newer
installed version or an unsafe state operation stops the update.
Payload verification reads the device's SHA-256 output directly and requires
every expected file exactly once. Missing, duplicate or malformed rows cannot
turn a failed verification into success; this check does not depend on sending
a checksum manifest through standard input.

The snapshot covers the known application-directory files described above,
including the entire `ott-state` directory. It is **not a complete DB8/keymanager
backup**. Preserve the snapshot privately on the same computer; it is not a
profile export for another television. Existing files with conflicting contents
must not be overwritten merely to make a restore succeed. Owner, group and mode
are part of this check; an alias unable to restore the original ownership must
not proceed with installation. Missing files are transferred to private staging
files, hash-checked and published without replacing an existing destination.
An interrupted transfer cannot leave a partial file at its final name. A new
file or directory appearing at that name makes restoration stop instead of
overwriting it.

Private recovery files are stored under
`WORK_DIR/YOUR_TV/native-webos-v0.2.0-beta.1/`: `update.json` is the journal,
`snapshot/state.tar` contains the captured private data, and
`snapshot/manifest.json` records its hashes and permissions. The install uses a
verified private copy named `verified-update.ipk`. Keep this directory private
and intact until the update and playback checks are complete. A per-device lock
prevents another apply or reconciliation in this work directory from running
concurrently. `update_in_progress` means that operation is still active; do not
choose a different work directory to bypass the lock.

The journal records `install_started: false` before preparation and durably
changes it to `true` immediately before invoking the installer. After a failure
that is provably before installation, repeat `--apply` with the same arguments:
the helper requires the same release, device identity and previously installed
version, retains earlier local artifacts under `prior-attempt-*`, and prepares a
fresh snapshot. It does not automatically repeat an installer call. A missing
marker, a `true` marker or an ambiguous journal stays blocked and requires the
recovery checks below. Do not edit these markers to force a retry.

Before `--apply`, the same per-device lock also protects a check of journals for
other tags. An unresolved installation blocks a new tag. The pre-install
exception is narrow: the earlier journal must explicitly contain
`install_started: false` and its outcome must be `closing` or `needs-review`.
No installer call has begun in those states, so a different tag may take its own
fresh snapshot and proceed. The earlier journal, snapshot and other files remain
untouched. A missing or unknown marker, malformed journal, or installation that
has started does not qualify for this exception; complete that recovery first.

An installer timeout produces `install-indeterminate`, even if readback already
shows the target version. The helper records that observation without retrying
the install, restoring over possibly active state or launching the player.
Retain the pending journal and snapshot. A subsequent invocation must handle that
pending update before treating a matching version as an unchanged installation;
do not delete the journal or choose a fresh work directory to bypass recovery.
Use `--preflight` with the same arguments to obtain read-only status even while
recovery is pending. If the target version and exact payload are installed,
request the separate recovery operation:

```sh
python3 scripts/update-webos-native.py \
  --device YOUR_TV --tag native-webos-v0.2.0-beta.1 \
  --work-dir /absolute/path/to/private/native-update --reconcile
```

`--reconcile` verifies the saved release, device identity and installed payload,
stops the native app, checks the private snapshot, restores missing state and
verifies launch. It requires a durable `install_started: true` marker; a manual
installation cannot authorize restoring a snapshot from an earlier pre-install
failure. A close timeout requires successful stopped-state readback
before restoration; a still-running process prevents it. It **never installs an
IPK**. It refuses an old or different installed
build, a missing or changed snapshot, and conflicting state. Resolve those
conditions while retaining the journal and both state versions; do not bypass
them by retrying `--apply` in a new directory. A completed journal cannot be
reconciled again: `no_pending_update` prevents restoration of an old snapshot
over settings changed after the successful update.

After a completed update, repeating it is a no-op when the installed version is
already current, its payload hashes match, and no recovery is pending. The same
numeric version with different binaries is an error, not an update or a verified
no-op. Package, state-file and process
checks do not establish correct playback: separately verify moving video, sound,
the existing Plex connection, profiles, Favorites and behavior after reopening.
Keep those observations with the exact package SHA-256 in the update record.

For example, the published package produces this **planning receipt** before
any TV request; it is not an installation result:

```json
{
  "schema": 1,
  "application_id": "com.openottplay.player.native",
  "tag": "native-webos-v0.2.0-beta.1",
  "version": "0.2.0",
  "sha256": "7ce2b7af3bfe2fb895a40c8524dde56475563f3e911645fbe9b801aba0d76528",
  "source_sha": "181162cea1f103f212cdc4bd59b32340ead96c62",
  "source_set_sha256": "02694c69cf31f061265c03ea98c976135ad8725844a2cd569d8af583c3d00e24",
  "release_id": 432694668,
  "transport": "existing-ares-developer-mode",
  "outcome": "dry-run",
  "install_started": false,
  "protected_store_backup": "not_performed",
  "playback_validation": "not_performed"
}
```

An `outcome` of `complete` means installation or reconciliation passed the
package, private-file and process checks; `already-current` means no installation
was needed. `install-indeterminate` requires recovery and returns exit code `2`.
Other failures return `1`; after a mutation, consult the retained `needs-review`
journal and its safe error code. Even a successful result leaves
`playback_validation` and `protected_store_backup` as `not_performed`.

This helper is an Ares connection workflow, not a Homebrew Channel controller.
Having Homebrew Channel installed does not create an Ares alias or grant its
user access to another installation's private directory. If the existing Ares
connection cannot safely capture and restore that installation's files, stop
and use the appropriately authorized Homebrew update procedure below. A
Homebrew update also does not remove Developer Mode's expiry rules from an
application originally installed under that mode.

## Update through Developer Mode

The existing connection must pass the native guide's read-only device and
installed-app checks first. With `YOUR_TV` replaced by that CLI device alias:

```sh
ares-device --device YOUR_TV --system-info
ares-install --device YOUR_TV --listfull
ares-launch --device YOUR_TV --close com.openottplay.player.native
```

Take the applicable private backup described above, then install the verified
package over the same application ID:

```sh
ares-install --device YOUR_TV /path/to/downloads/ottplay-native-webos-VERSION.ipk
ares-install --device YOUR_TV --listfull
```

Verify or restore the applicable managed files before reopening the app:

```sh
ares-launch --device YOUR_TV com.openottplay.player.native
ares-launch --device YOUR_TV --running
```

If an install command times out, inspect the installed version before retrying.
The TV may already have completed the installation. An installer or launcher
acknowledgement is not a video-playback result.

Keep the Developer Mode session active. LG documents that development apps
are removed when Developer Mode becomes disabled, including after a reboot
with an expired session. Renew the session while the TV is online; do not
treat reinstalling after expiry as a state-preserving update. See
[LG's Developer Mode guide](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app).
Use the [native build guide](../native/webos/README.md) for CLI troubleshooting;
do not reset the TV or delete its credentials to address a CLI defect.
An SSH, Key Server or authentication error alone does not prove that the
Developer Mode session expired. Diagnose the existing connection without
automatically requesting a new key, changing the device alias or clearing state.

## Update through an existing Homebrew Channel

Use the native release's repository URL, not a main-player release URL:

```text
https://ottplay-webos.igw-2560801.workers.dev/v1/NATIVE_RELEASE_TAG/ottplay-native-webos-repository.json
```

Replace `NATIVE_RELEASE_TAG` with the exact tag containing the verified native
assets. Add that repository in Homebrew Channel, select **OTTPlay Native** and
check its application ID and version before choosing **Install** or **Update**.
Follow the same private-state preservation steps as for a Developer Mode
update. Remove obsolete snapshot repositories from Homebrew settings when
they create duplicate entries; do not remove the application itself.

This endpoint is an immutable release snapshot, not a moving beta or `latest`
subscription. Adding a newer snapshot does not silently install it. Catalog,
manifest and icon delivery require browser CORS; the IPK is downloaded from
its release URL and checked against the manifest's hash. See
[metadata endpoint operations](webos-feed-operations.md) and the
[Homebrew Channel project](https://github.com/webosbrew/webos-homebrew-channel).

The metadata service does not carry video. If it is unavailable, an already
installed native executable still uses its own configured media sources;
availability of those sources is a separate question. It does not fall back to
the hosted website. Homebrew Channel does not remove a Developer Mode
installation's session-expiry requirements.

Verify the URLs actually present in the native manifest. The native feed does
not currently require the hosted feed's separate HTML description URL;
`fullDescriptionUrl` should be checked only when the manifest supplies it.

## Record what the candidate actually passed

Maintain a receipt for the **exact IPK hash tested**, with the source revision,
native version, TV model, firmware and test result. Do not carry an older
candidate's device result forward after rebuilding. Keep credentials, private
media addresses and pairing codes out of a publishable receipt.

Record these as separate results:

1. **Package and source:** bundle verifier result, application descriptors,
   architecture, artwork, dependency notices and source-set hashes.
2. **Install and launch:** installed ID/version and evidence that this native
   process starts and remains running.
3. **Interface and playback:** visible moving picture, sound, remote navigation,
   Back, pause/resume and seek, plus audio/subtitle selection where the chosen
   source provides those tracks. A simulator does not prove LG decoding.
4. **State retention:** the same Plex connection and settings after the update
   and a second launch; retained OTT profiles, category selection, Favorites
   and remote pairing only where that candidate implements them.
5. **Provider and control contract:** each advertised provider and command is
   exercised through its real entry point, including cancellation/failure and
   restart. Command queue acknowledgement and an accepted play request do not
   prove that frames were decoded.

Keep the actual capability and state/status responses with that receipt,
redacted of credentials and personal media paths. Bind them to the IPK and
source-set SHA-256 values; a source-level list of handlers is not evidence that
the installed build answered those commands. If a companion is packaged, its
executable and dependency sources must also be covered by the same runtime
source and final-link checks. A helper's own local-source archive alone does
not replace the complete corresponding source set.

The complete experimental `0.2` candidate requires the companion and its verified
source closure; a native-only build is for isolated development. Follow the
[complete build and collection sequence](../native/webos/README.md#complete-candidate-build-with-companion).
Run preparation first, then pass its complete `environment` object to both the
helper build and source collection so they use the same checked cache and pinned
toolchain offline. Pass the verified bundle to `--companion-bundle`; staging
preserves its manifest bytes and checks the local-input digest. Collect the helper's locked dependencies
and exact Rust sources before passing both `--companion-bundle` and
`--companion-sources` to the enclosing runtime collector. The helper's SDK source
coverage remains pending until that collector validates the final-link inputs
against the pinned SDK. It also checks the GCC wrapper and its actual compiler
backend against the original SDK archive, and binds the helper's Rust compiler
and standard-library source to the exact commit in its archived manifest.
Matching receipt hashes alone do not replace those checks.
It embeds `companion/companion-source.tar.gz` and receipts
inside the existing runtime-source archive, preserving the two top-level source
archives. Finish with the release verifier's `--check-checkout`; this sequence
does not itself claim a completed ARM build, independent rebuild or TV test.

### Candidate plugin-resolution contract

The upcoming `0.2` native source implements plugin resolution through the
authenticated `native_companion` command. The native host tests compile and
pass for the bounded request contract and proposal-only response, including
exit cancellation. Live helper-command and TV acceptance are still pending;
this is not a capability of the published `0.1.0` release. Record the
exact-candidate result before advertising it as delivered.

The parameters are `version: 1`, the current remote session's `runtime`,
`op: "resolve_plugin"`, a plugin `id` and an `input` object. Obtain the runtime
and advertised operations from the current installation; do not reuse an
identifier across application restarts. `plugins` and `resolve_plugin` are
advertised only when the helper is ready and reports plugin support. Resolution
also requires the native application to be in the foreground and outside
Standby. The existing bounded request encoder validates the plugin ID and input.

A successful response contains `data.streams`, an array of `{url, title}`
proposals. Resolution does not start playback or acquire a playback lease.
The native adapter validates returned proposals and rejects the current
helper's private token in URLs or titles, including percent-encoded forms.
Request deadlines and cancellation cover queued work, in-flight work and late
replies; a late response must not start playback or mutate the current source.

The initial `0.1.0` native installation received a user confirmation that it
worked. That observation does not verify every codec, a controlled retention
test, or a later multi-provider candidate. New provider code, source-only
tests and an uninstalled ARM build must remain marked separately from tested
release capabilities.

For each advertised capability, link its native implementation, relevant
automated test and exact-candidate observation, or state the missing evidence.
A capability name in a manifest, an accepted UI selection or the existence of
the same feature in Tauri/OTTserver is insufficient. Native release notes must
describe the candidate delivered, including explicit unsupported paths.

## Build and publication handoff

Use the existing [native candidate workflow](../.github/workflows/webos-native.yml)
or the documented local build stages. The integration records the upstream
pin, adaptation digest, patched source tree, compiler identity and IPK hash.
Changing the source pin or adaptation requires a newly prepared build directory;
do not edit a successful receipt to make old output appear current.

Before publication, the release owner verifies the complete bundle and its
intended versioned catalog URLs. Publish the binary, corresponding source,
receipts and catalog together. After publication, download and recheck the
assets, verify CORS metadata delivery and confirm that the public catalog
points to those exact bytes. These checks are separate from device acceptance.

Build, install and release operations share one coordination queue. Finish the
candidate and its host checks before scheduling TV time; preserve the working
installation while compilation runs. Do not trigger a second release pipeline
or install concurrently with another owner.

After acceptance, remove only disposable output owned by the completed task.
First verify that required commits and unique private files are preserved and
no process or recorded build dependency still uses the path. Retain the active
source, SDK, current release bundle and necessary recovery state. Directory
names or age alone are not evidence that a build copy is safe to delete.
