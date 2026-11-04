# Install OTT-play on an LG webOS TV

For Developer Mode account setup, pairing, session renewal and troubleshooting,
see the [LG Developer Mode runbook](lg-developer-mode.md). This page focuses on
the hosted OTTPlay package and its installation routes.

This guide describes the full multi-provider **hosted web player**. The
separate [experimental native OTT application](native-webos.md) has its own
app ID, build, license and installation package, and renders without the TV's
web engine.

The webOS package adds **OTT-play** to the TV launcher. It opens the existing
player at **<https://player.ottplay.here.now/>** in LG's hosted web-app environment.
You can install the same package with LG Developer Mode or an already installed
webOS Homebrew Channel. This is not the macOS Homebrew package manager.

The package uses app ID **`com.openottplay.player`**. It is a hosted web app,
not a native decoder port. The television needs a working network connection to
load the player and reach the selected provider. Installation does not add
codecs, mount computer folders, or provide offline copies of the player and media.

## Choose an installation route

- **Developer Mode:** use a computer on the same network to install the release
  `.ipk`. No root access is needed. Keep the Developer Mode session renewed.
- **Existing Homebrew Channel:** add the release's repository URL on the TV and
  install its OTT-play entry. This guide assumes Homebrew Channel is already
  working; it does not change the TV's firmware or security configuration.

LG documents Developer Mode installation on webOS TV 3.0 and newer. That is an
installation prerequisite, not a promise that every old browser, video format,
or provider works on every model. Check playback on the actual TV. See
[LG's installation guide](https://webostv.developer.lge.com/develop/tools/cli-dev-guide)
and our [delivery review](plx-native-delivery-review.md).

## Download the TV package

Open the chosen [OTT-play release](https://github.com/open-ott-play/ottplay-foss/releases)
and download **`ottplay-foss-webos.ipk`** from its assets. Use the checksum from
that same release to verify the downloaded file. On macOS:

```sh
shasum -a 256 ottplay-foss-webos.ipk
```

Linux can use `sha256sum`; Windows can use
`certutil -hashfile ottplay-foss-webos.ipk SHA256`. The result must match the
release's published SHA-256. A checksum detects a mismatch with that release;
it is not an LG signature or LG Apps approval.

The `.ipk` is the installable package. The manifest, repository JSON and release
metadata describe it; do not select those files in an IPK installer. The
three-number package version used by webOS is `1.0.<build number>`; it differs
from the release label such as `1.1.62-beta.3`. The release asset
`ottplay-foss-webos.json` records both values and the source revision. Use that
metadata when reporting which package you installed.

## Install through Developer Mode

### Prepare the TV

1. Install **Developer Mode** from the TV's **Apps / LG Content Store**.
2. Open it and sign in with an LG developer account.
3. Enable **Dev Mode Status** and let the TV restart.
4. Open Developer Mode again and enable **Key Server**.
5. Keep the screen available: the computer needs the TV's local IP address and
   the displayed passphrase. Both devices must be on the same local network.

LG's [Developer Mode guide](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app)
shows these controls. The passphrase is for pairing the computer to the TV; it
is not your LG account password.

### Use a desktop installer

[webOS Dev Manager](https://github.com/webosbrew/dev-manager-desktop) provides a
graphical installer for macOS, Windows and Linux. Install a maintained release
from that project's own download page. It is a separate tool, not bundled with
OTT-play.

Add the TV using **Developer Mode**, its IP address and displayed passphrase.
The Developer Mode connection uses user `prisoner` and port `9922`. Once the
TV's installed apps are visible, choose **Apps → Install**, select
`ottplay-foss-webos.ipk`, and wait for completion. Open **OTT-play** from the TV
launcher.

### Or use the LG CLI

If you already maintain a current [LG webOS CLI](https://webostv.developer.lge.com/develop/tools/cli-dev-guide),
add the TV with `ares-setup-device`: choose a name such as `myTV`, the TV IP,
port `9922` and user `prisoner`. Then run:

```sh
ares-novacom --device myTV --getkey
ares-install --device myTV ./ottplay-foss-webos.ipk
ares-install --device myTV --list
ares-launch --device myTV com.openottplay.player
```

Enter the passphrase when key retrieval asks for it. The installed-app list
should contain `com.openottplay.player`. OTT-play does not automatically download
or install the external CLI; see [external CLI policy](webos-cli-security.md).

### Keep Developer Mode active

While the TV is online, open Developer Mode, check **Remain Session**, and use
**EXTEND** before it expires. Disabling Developer Mode or restarting after its
session expires can remove apps installed through it. Re-enabling the mode and
reinstalling is then necessary. Homebrew Channel installed through Developer
Mode does not remove this requirement. Follow
[LG's session guidance](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app#extending-developer-mode-time).

## Install with an existing Homebrew Channel

Each release that includes the TV package also includes
**`ottplay-foss-webos-repository.json`**. It is a small Homebrew Channel catalog
pointing to that release's manifest, package and icon. Use the metadata gateway
address below in Homebrew Channel, replacing `<release-tag>` with the chosen
release's exact tag, including its leading `v`:

```text
https://ottplay-webos.igw-2560801.workers.dev/v1/<release-tag>/ottplay-foss-webos-repository.json
```

1. Open the chosen GitHub release and check that its assets include the TV
   package and repository JSON. Copy its exact release tag into the URL above.
2. On the TV, open **Homebrew Channel → Settings → Add repository**.
3. Enter the completed gateway URL, including the `.json` filename.
4. Return to the catalog, open **OTT-play**, and choose **Install**.
5. Open OTT-play from the TV launcher when installation completes.

Homebrew Channel reads catalog metadata in its browser, where cross-origin
access must be allowed. The gateway serves the release's catalog, manifest,
HTML description and icon with the required CORS headers. GitHub release JSON
downloads remain available for inspection and verification, but their download
redirects do not provide the CORS headers needed for a Homebrew repository URL.
Do not enter a GitHub release page, `blob` page or release-asset download URL.

The IPK itself is downloaded from the exact GitHub release by Homebrew
Channel's installation service. The manifest carries its SHA-256, which that
service verifies before installation. The format and resolution are implemented in its
[catalog reader](https://github.com/webosbrew/webos-homebrew-channel/blob/1a2b969e992617c9ba4b8a891542cb93a9e07b0a/frontend/views/BrowserPanel.js)
and [package detail view](https://github.com/webosbrew/webos-homebrew-channel/blob/1a2b969e992617c9ba4b8a891542cb93a9e07b0a/frontend/views/DetailsPanel.js).

### Release snapshots and updates

Each gateway URL containing `/v1/<release-tag>/` is an **exact release snapshot**.
It continues to offer that package; it does not follow newer betas or stable
releases. To install another release, add the gateway URL with that release's
exact tag or install its IPK through the computer. Remove the obsolete snapshot
repository in Homebrew Channel Settings to avoid duplicate entries for the
same app ID. There is no moving `latest` or automatic beta feed.

An offered Homebrew Channel update still requires you to select **Update**.
Neither the package nor this catalog silently installs a replacement IPK.

This project-supplied repository is distinct from inclusion in the central
webOSbrew catalog. Adding it does not imply that webOSbrew or LG has reviewed or
approved OTT-play.

## Set up the player and verify playback

Once the player loads, configure the provider or connect it through
**Settings → Remote control** using the existing command-server pairing flow.
An installation does not embed your Home profile, provider passwords or device
access token. Load your own profile after connecting the new player.

Treat the TV app as a separate client from a tab in the LG browser or a desktop
player. Do not assume their profiles, Favorites or pairing state are shared.
Keep a profile backup before replacing or removing an installation. Updating
the same app ID does not deliberately reset the profile, but stored settings
are not guaranteed permanent: LG documents that hosted-app storage can be
removed when its storage limit is reached. Deleting an app, factory reset or
losing Developer Mode also must not be treated as a settings-preserving update
method. See [LG's storage clarification](https://forum.webostv.developer.lge.com/t/local-storage-behaviour-question/10068).

Check the actual TV with a source you can access: picture and sound, remote
navigation, Back, pause/resume, subtitles or audio selection when available,
and a second launch. Successful packaging or simulator startup alone does not
prove hardware decoding or compatibility with that source.

## What updates over the network

The IPK contains the launcher and points at the canonical hosted player. A
publication to that site can update the player loaded on a later launch or
reload without another IPK installation. It does not forcibly replace code in
an already running session. Launcher metadata changes still require a newer
IPK. Installing an older IPK does not restore an older hosted player because
its address remains the canonical site.

The TV must be able to reach the HTTPS site. A local NAS provider additionally
needs a route from the TV to that NAS; desktop SMB/AFP mount paths are not
transferred to the television. Codec and DRM support remain those available
through this TV's webOS browser and playback engine.

## Troubleshooting

- **The computer cannot connect:** confirm Developer Mode and Key Server,
  the current passphrase, and the TV's current IP address. Guest-network
  isolation or a VPN can prevent local connectivity.
- **The app disappeared:** check Developer Mode expiry before reinstalling.
- **Homebrew Channel has no OTT-play entry:** use the metadata gateway URL with
  the exact tag of a release that includes the TV assets. Raw GitHub download
  URLs are not supported as repository addresses. Check TV network connectivity.
- **The launcher opens but the player does not load:** verify the canonical
  site and the TV's network/date settings. An installed launcher does not make
  an unreachable website available offline.
- **The player loads but video does not play:** record the TV model, webOS
  version, release/package version and source type. Test another supported
  source to separate a device/codec problem from provider availability.

Do not include credentials, pairing passphrases or access tokens in a public
issue. For packaging and release provenance, see
[release workflow](release-workflow.md).

## Build the launcher from source

The packager uses Node.js built-ins; it does not install the LG SDK or CLI.
From a checkout, create and inspect a development package with:

```sh
npm run package:webos -- --local
npm run verify:webos -- --local
```

The files are written to `build/packages/`. Development packages use webOS
version `1.0.0`, carry an explicit local marker and cannot generate a release
catalog. They are not replacements for a newer installed release package.

Official packaging runs inside the normal release workflow. It requires the
exact source checkout with its frozen `.release-plan.json` and already applied
version overlay; an arbitrary version string is not sufficient:

```sh
npm run package:webos -- --plan .release-plan.json
npm run verify:webos -- --plan .release-plan.json
npm run package:webos-homebrew -- --plan .release-plan.json
```

The verifier checks the archive, application and package descriptors, embedded
build identity, artwork, file inventory and checksum before release staging.
`npm run test:webos` also exercises malformed packages and independently reads
the archive with Python. These checks do not install or launch a TV app.
