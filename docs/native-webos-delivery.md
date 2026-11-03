# Deliver and update OTTPlay Native for LG

Use this guide to verify a native release and update an existing installation.
The [native build guide](../native/webos/README.md) describes source preparation,
SDK setup and first-time Developer Mode access. The [hosted installation
guide](lg-webos-installation.md) describes the separate web application.

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
  hosted player's browser storage. Copying an application directory alone is
  not proof that every protected store has been backed up.

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
