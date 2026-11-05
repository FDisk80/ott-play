# Deliver command-server discovery to each player

A website update reaches players that load that website. It does not replace
the frontend or executable inside an installed application. Use this guide to
choose the delivery target after configuring
[command-server discovery and approval](remote-command-server.md#discovery-and-one-time-approval).
The platform guides linked below remain the source for complete build and
installation procedures.

## Reload a website or install a package?

| Player | Where its player code comes from | How to deliver a player change |
| --- | --- | --- |
| Browser or PWA on the hosted site | That site's published web assets | Publish to the same site, then reload and verify the loaded build. An open page keeps its current runtime until reloaded. |
| Browser using a local OTT Server | The local server's web root | Update the server's web assets, then reload the same player origin. Replace the server executable separately if the change requires it. |
| Tauri desktop app | Frontend bundled with the desktop application | Build and install the updated application. Publishing the website does not update its embedded frontend. |
| Capacitor Android Full, including API 22 compatibility | Web assets packaged in the APK | Build the appropriate APK, sign it with the existing identity, and install the update. |
| Capacitor iOS | Web assets packaged in the iOS application | Rebuild, sign and distribute the iOS application. |
| LG hosted webOS wrapper, `com.openottplay.player` | The canonical website opened by the launcher | Reload or reopen the launcher to load the updated site. A new IPK is needed for launcher changes, not for a website-only change. |
| Media Station X using the project bootstrap | The website selected by its start parameter | Update that website and reload the linked player. Check whether the parameter points to the hosted site or a local server. |
| Samsung packaged Tizen TV, `OttPlayFss.Player` | A Mode A snapshot inside the WGT | Package, sign and install a new WGT. It does not fetch replacement player code from the canonical site. |
| Native LG, `com.openottplay.player.native` | A native executable inside a separate IPK | Build and install the native IPK. It is a different application from the hosted wrapper. |

For an existing wrapper, verify its target URL before treating a website
publication as its update. Older or custom wrappers may open another site.
This table describes delivery mechanisms; it does not establish the installed
version, successful reload or playback on any particular device. The separate
legacy Android shell and independent Android application require their own
delivery checks.

## Discovery transport is a separate choice

Tauri supports LAN DNS-SD discovery. Linux Native support is part of the
separate [Native delivery candidate](https://github.com/open-ott-play/ottplay-foss/pull/1014),
not the shared-player change described here. Browser-based players, including
Capacitor and the hosted LG wrapper, use the configured HTTPS catalog;
eligible loopback pages can also ask their local OTT Server to discover servers.
The catalog contains public server descriptors, not player code or credentials.
Publishing it does not relocate or start the command server.

The Tauri source includes discovery support for macOS, Windows and Linux:
system discovery domains and DNS queries on macOS, registry search domains and
`DnsQuery` on Windows, and resolver configuration/system DNS on Linux. Source
support does not establish installation or runtime acceptance on each OS.

Use the [platform lookup rules](remote-command-server.md#lookup-by-platform) for
fallback behavior and the [Native LG guide](../native/webos/README.md)
for its separate implementation. A reachable catalog does not prove that the
advertised controller, pairing endpoint or media source is reachable. Keep the
controller's allowed origins aligned with the actual player origin. Discovery
does not bypass pairing approval. Automatic discovery preserves an existing
saved connection. An explicit replacement is saved only after pairing approval.

## Select an explicit profile for the build

Keep installation-specific discovery settings outside generic release defaults.
For a distribution that should use a reviewed catalog, export both values in
the environment of the actual frontend build:

```sh
export OTTPLAY_CONTROL_DISCOVERY_URL="$REVIEWED_PUBLIC_CATALOG_URL"
export OTTPLAY_CONTROL_DISCOVERY_SHA256="$REVIEWED_CATALOG_SHA256"
```

Set the two `REVIEWED_...` variables to the absolute HTTPS metadata URL and the
SHA-256 of its exact raw bytes first. See
[deployment profile configuration](remote-command-server.md#deployment-profile-and-herenow)
for the format and the maintained Home catalog reference. Do not substitute the
controller's command API URL for the catalog URL, or copy credentials into it.
With both build variables unset, the build remains unconfigured. The build
rejects a partial or invalid pair and preserves an already defined deployment
URL override.

Choose the build path for the target; these are alternatives, not a sequence
to run for every deployment:

- **Server/hosted web:** build with `npm run build:server`, then create the
  Mode A artifact with `npm run package:modea`. Keep its build information and
  checksums with the deployment record.
- **Tauri:** provide the same environment to the desktop build described in
  the [signing and updater guide](tauri-updater-notarize.md). Inspect the final
  application's embedded frontend, not only an earlier web build.
- **Android:** use `npm run android:full:release` or
  `npm run android:api22:release` as described in the
  [Android build guide](../android/README.md). Each variant regenerates and
  audits its own assets. Copying a completed Mode A archive or an old
  `dist-mobile` directory into an APK is not the supported build path.
- **iOS:** `npm run build:ios` builds and audits `dist-mobile`, syncs iOS,
  and audits the copied assets. Continue with the
  [Capacitor build guide](capacitor-mobile.md#build-and-open).
- **Tizen:** package the configured Mode A artifact using the
  [Tizen release procedure](samsung-tizen-installation.md). The packager retains
  the player bundle and its discovery settings; a second injection is unnecessary.
- **Hosted LG wrapper:** keep its target on the intended site. Injecting a
  JavaScript variable only into the launcher's document does not configure the
  separate document opened by its redirect.

In the separate Native delivery candidate, the native builder uses its own
inputs. Add both
`--control-discovery-url "$REVIEWED_PUBLIC_CATALOG_URL"` and
`--control-discovery-sha256 "$REVIEWED_CATALOG_SHA256"` to the documented native
`build` or `all` command. The common web environment variables alone do not
configure that native executable. Retain its `built.json` configuration record.

The common web SHA marker records the reviewed build input; browser discovery
does **not** verify the downloaded catalog's digest at runtime. The Native
candidate's configured catalog path performs its own response-digest check. Record the
source revision actually built, even when its shared web code matches another
revision. Do not relabel a new build as an earlier source commit.

## Preserve the installation while updating

Use the same site and browser origin, or the same application/storage identity.
Changing scheme, hostname or port creates another browser storage context.
An update must not clear application data, reset profiles or import another
device's remote credentials. Exporting player settings is useful for recovery,
but it does not transfer command-server authorization; see the
[connection rules](remote-command-server.md).

For web publication, preserve the site's private configuration, proxy routes,
existing explicit overrides and immutable dependencies needed by open pages.
Update against the current site version and verify the result before requesting
reloads. For the local server, preserve its configuration, certificates and
listener layout. Follow the [macOS delivery and recovery runbook](macos-local-delivery.md)
when replacing local web assets or multiple Tauri instances.

For packaged applications, version and signing identity are part of delivery:

- Android updates must retain `play.ott.foss`, its storage origin and the
  established signing certificate. The updater requires a strictly newer
  version code. Use the real frozen release version plan, not a hand-edited
  version that merely looks newer. See
  [Android release identity](android-distributions.md#release-identity).
- Tizen updates need a compatible author identity and the correct numeric
  version from the release plan. The webOS and Tizen packagers' `--local` mode
  produces build number `0` and numeric version `1.0.0`; this is a development
  candidate, not evidence that it can upgrade an installed release.
- Do not uninstall an app to work around a signature or downgrade error.
  Follow the platform's update guide and preserve the existing profile data.
  Android OTA may require an on-device system confirmation; sending an install
  command is not proof that installation completed.

## Record what was actually delivered

Keep the source revision, selected catalog URL/hash, artifact checksums and
target identity together. Check the served build information and player bytes
after web publication; inspect the packaged frontend or native configuration
before installing a native artifact. Then record reload or installation and the
reported running version separately from the build result.

After a device is available for validation, check its saved profiles and remote
connection as well as discovery and playback. A successful build, a server
response, a staged APK or an accepted update command proves only that step.
Report deferred packages or untested devices explicitly instead of marking
every platform updated after a website deployment.
