# LG Developer Mode: setup, installation, updates and troubleshooting

This runbook covers a computer connecting to a consumer LG webOS TV through Developer Mode, then installing or maintaining OTTPlay. It also explains what to check when the connection, application or playback fails. Documentation was checked on **November 3, 2026**. Package compatibility still depends on the particular TV, firmware and release.

## 1. Choose the application and record the target

OTTPlay has two separate TV applications. Select one before downloading a package:

- **Hosted OTTPlay:** `ottplay-foss-webos.ipk`, application ID `com.openottplay.player`. Its launcher opens [the hosted player](https://player.ottplay.here.now/). The IPK does not contain the full player, media or additional codecs. The TV needs access to the website and its selected providers.
- **OTTPlay (native):** `ottplay-native-webos-VERSION.ipk`, application ID `com.openottplay.player.native`. Its release contains the native executable and matching storage service. Publishing a new hosted website does not replace that executable.

Their profiles, Favorites and remote-control pairing are separate. An upstream PlxNative package or repository is a third application, not an OTTPlay update. Use the [hosted installation guide](lg-webos-installation.md) or [native delivery guide](native-webos-delivery.md) for the chosen release's package details.

Keep a small private installation record: TV model, webOS/firmware version, connection alias, intended application ID, release tag, package version and SHA-256. Add the actual installed version and test result afterward. Do not put account passwords, pairing passphrases, private keys, tokens or raw device identifiers into an issue report.

`YOUR_TV` in this guide is a local **Ares device alias**, not an OTTPlay player name or remote-control Device ID. Substitute an alias you control. Paths and filenames in command examples are placeholders.

## 2. Prepare the TV

**Before toggling Developer Mode, restarting or replacing an existing installation, save any supported profile/settings exports and required private backups.** A fresh TV and a TV with development applications already installed need different preparation. Do not assume that re-enabling the mode will preserve or recover those applications' data.

Use an LG Developer account and put the TV and computer on the same network. Install **Developer Mode** from the TV's Apps store, sign in, enable **Dev Mode Status**, and allow the reboot. Reopen the application, enable **Key Server**, and keep its current passphrase available for key retrieval. The account password and this case-sensitive passphrase serve different purposes. LG's physical-TV connection uses user `prisoner` and port `9922`. [LG Developer Mode setup](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app)

Before changing anything else, confirm the TV's current local address. A guest Wi-Fi network, client isolation, a VPN or a changed address can prevent the intended connection. Check the network path before changing SSH settings. Avoid exposing Developer Mode services through public port forwarding.

For shared TVs, agree who owns the maintenance window. Do not close an application, install an update or restart the TV while another operator is validating playback or saving settings. A local tool's lock does not automatically coordinate other computers.

## 3. Install and identify the desktop tools

LG publishes `@webos-tools/cli` and documents installation with npm. Its installation page still includes older Node recommendations, so check the **selected package's** engine requirement as well. The inspected CLI **3.2.6** declares Node **20 or newer**; this project's reviewed setup uses Node **22.23.4**. These are identified versions, not a promise that a moving `latest` package is unchanged. [LG CLI installation](https://webostv.developer.lge.com/develop/tools/cli-installation), [CLI 3.2.6 release](https://github.com/webos-tools/cli/releases/tag/v3.2.6)

For a new installation deliberately selecting the reviewed CLI version:

```sh
node --version
npm install -g @webos-tools/cli@3.2.6
ares -V
ares-config --profile tv
```

An existing managed installation can remain in its own prefix. Record which CLI and Node installation your terminal actually uses; multiple installations can make the version you inspect differ from the command your updater runs. Do not replace a working managed SDK as a troubleshooting experiment.

Use `ares-device --system-info`, not the deprecated `ares-device-info` executable. The latter is an error stub in 3.2.6. [Versioned implementation](https://github.com/webos-tools/cli/blob/v3.2.6/bin/ares-device-info.js)

The graphical alternative is LG's **webOS Studio**: use **webOS: Set Up Device**, followed by **webOS TV: Set Up SSH Key** and refresh the device list. It uses the same target identity and on-screen pairing information. [LG webOS Studio guide](https://webostv.developer.lge.com/develop/tools/webos-studio-dev-guide)

## 4. Register, pair and verify the connection

Inspect existing aliases privately before creating another entry for the same TV:

```sh
ares-setup-device --list
```

Only if the alias is missing or needs correction, run interactive setup and enter the TV address, `prisoner` and port `9922`:

```sh
ares-setup-device
```

With Key Server enabled, retrieve the key and enter the displayed passphrase interactively. Then verify the connection:

```sh
ares-novacom --device YOUR_TV --getkey
ares-device --system-info --device YOUR_TV
ares-install --device YOUR_TV --listfull
```

These are device setup, connection and application-inventory operations. Select the TV profile, not an emulator or another webOS target. [Current LG CLI reference](https://webostv.developer.lge.com/develop/tools/cli-dev-guide)

**Keep device-list output private:** in 3.2.6, `ares-setup-device --list` can display a passphrase column and `--listfull` exposes additional configuration. This warning concerns device setup output, not just files named as keys. [Listing implementation](https://github.com/webos-tools/cli/blob/v3.2.6/lib/base/setup-device.js)

Compare the returned information with the intended television before installation. Key retrieval alone does not prove that the key decrypts, SSH authenticates or a remote command completes. Likewise, a working OTTPlay browser session or remote-control connection does not prove Developer Mode access.

Keep generated keys private. If pairing fails, recheck the displayed passphrase, alias and current address first. Do not publish a device registry or key file to obtain help. Re-pair deliberately when the existing credential is no longer valid; do not repeatedly create aliases to hide an unresolved failure.

## 5. Verify a release and perform the first installation

Download from the selected [OTTPlay release](https://github.com/open-ott-play/ottplay-foss/releases), and keep its metadata and checksum with the IPK. Compare the downloaded SHA-256 with that same release. For example, on macOS:

```sh
shasum -a 256 /path/to/APP_FILE.ipk
```

Linux can use `sha256sum`; Windows can use `certutil -hashfile FILE SHA256`. A matching checksum ties the file to the supplied release evidence. It is not an LG approval or a guarantee of playback compatibility.

Do not confuse the release label with the numeric installer version. The hosted package uses `1.0.<build number>`. A native tag such as `native-webos-vX.Y.Z-beta.N` uses numeric package version `X.Y.Z`. Read the actual release metadata rather than constructing a tag or inferring that a higher beta suffix changes the numeric version.

If the native application ID is already installed, continue to the checked-update procedure below. For a genuine first installation, run only the matching pair:

```sh
# Hosted application
ares-install --device YOUR_TV /path/to/ottplay-foss-webos.ipk
ares-launch --device YOUR_TV com.openottplay.player

# OR: the separately verified native application
ares-install --device YOUR_TV /path/to/ottplay-native-webos-VERSION.ipk
ares-launch --device YOUR_TV com.openottplay.player.native
```

Then read back the installed inventory and running applications:

```sh
ares-install --device YOUR_TV --listfull
ares-launch --device YOUR_TV --running
```

Installation and launch are distinct CLI operations. A successful acknowledgement is a useful checkpoint, not proof that the screen rendered or media progressed. [LG's first web-app walkthrough](https://webostv.developer.lge.com/develop/getting-started/build-your-first-web-app)

On the TV, verify the intended application, navigate with the remote and open an accessible source. Check moving video, sound, Back, pause/resume and available audio/subtitle selection. Save a harmless setting, close and reopen, then confirm it persisted. Record unavailable features as untested, rather than treating an empty track list or inaccessible source as a passing test.

For ordinary close/relaunch, use the actual app ID:

```sh
ares-launch --device YOUR_TV --close APP_ID
ares-launch --device YOUR_TV APP_ID
```

Removal is different: `ares-install --device YOUR_TV --remove APP_ID` deliberately uninstalls that application. Export required data first; do not use removal as a routine restart. [CLI launch help](https://github.com/webos-tools/cli/blob/v3.2.6/files/help/ares-launch.help), [CLI installation help](https://github.com/webos-tools/cli/blob/v3.2.6/files/help/ares-install.help)

## 6. Keep Developer Mode and application data healthy

Open Developer Mode regularly and read **Remain Session**. While online, use **EXTEND before zero** and confirm that the counter increases; an expired session cannot be extended. LG lists a reboot after expiry and ten offline reboots as conditions that disable the mode; its installed applications are then uninstalled. **Clear Cache Data** clears all applications' caches after reboot; it is not a renewal step. [LG lifecycle instructions](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app)

A December 2025 LG-hosted forum reply describes a maximum of **1000 hours** and removal of the old extension command. Treat that as dated guidance, not a universal initial counter or SSH-key lifetime. The current CLI does not provide `ares-extend-dev`; use the TV's EXTEND control as the primary procedure. [Dated CLI-renewal discussion](https://forum.webostv.developer.lge.com/t/whats-the-way-to-extend-dev-time-with-webos-cli/28033)

Do not assume being online renews the session automatically. A December 2023 forum response says renewal is not automatic. April 2024 replies also warn that signing into another TV with the same account may invalidate the previous TV's session after reboot. These are dated forum observations, not an independently verified staff guarantee; multi-TV operators should review their account arrangement and each TV's actual counter. [Automatic-renewal discussion](https://forum.webostv.developer.lge.com/t/topic/4854), [multiple-TV discussion](https://forum.webostv.developer.lge.com/t/developer-mode-keeps-login-me-out-before-999h-run-out/6428)

Use the application's supported export or backup before updates, removal or expiry. LG's Web Storage sample distinguishes packaged `localStorage`, which it says is removed on update/removal, from hosted storage, which can be evicted at a storage limit. `sessionStorage` is session-scoped. Those statements do not specify every native file, database or remote account. Do not promise either universal retention or universal deletion. [LG Web Storage sample](https://github.com/webOS-TV-app-samples/WebStorage)

If an application disappears, check Developer Mode first. Restore the connection and reinstall the intended verified package only after identifying what remains. Reinstalling is not evidence that old settings survived, and uninstalling is not a settings-preserving repair.

## 7. Use the checked native update path

The repository's [native update helper](../scripts/update-webos-native.py) maintains an existing native installation. Device operations require macOS or Linux and an already working Ares alias. It does not provision keys, perform first installation or convert a hosted player into the native application.

Run from the FOSS checkout, select an **actually published native tag**, and keep one private work directory throughout. First verify the official release without contacting the TV:

```sh
python3 scripts/update-webos-native.py --device YOUR_TV \
  --tag NATIVE_RELEASE_TAG \
  --work-dir /absolute/path/to/private/native-update
```

For the reviewed CLI 3.2.6 compatibility route, pass both the explicit SDK root and compatibility flag. Preflight performs read-only TV checks:

```sh
python3 scripts/update-webos-native.py --device YOUR_TV \
  --tag NATIVE_RELEASE_TAG \
  --work-dir /absolute/path/to/private/native-update --preflight \
  --ares-root /absolute/path/to/node_modules/@webos-tools/cli --ares-compat
```

Read the result and resolve any identity, permission, release or pending-transaction error. When ready for the maintenance window, repeat that command with **`--apply` instead of `--preflight`**. This authorizes closing the app, capturing known state, installing once, restoring missing state and verifying launch.

The compatibility option applies source-guarded workarounds inside that explicit CLI process; it does not edit the installed SDK or configure a global hook. It is not permission to substitute an arbitrary SDK version. The helper's ordered output checks reject incomplete captures instead of treating missing output as empty state.

The updater verifies package/source identity, numeric version, installed layout and recovery identity. It refuses unsafe or conflicting state, downgrades, same-version different bytes and unresolved installation transactions. Its snapshot covers the known `ottplay-profile.json`, `ottplay-control.json` and `ott-state` paths when present. **This is not a complete DB8/Keymanager backup or a cross-TV settings export.** Keep previous verified packages and supported exports privately too.

On timeout or uncertain installation, retain the journal and snapshot. Do not blindly repeat installation or move to a new work directory. Use preflight; if the exact intended package is installed and the pending journal allows recovery, the same command with **`--reconcile`** restores missing state and checks launch without installing another IPK. Old or conflicting snapshots remain stop conditions. A completed recovery must not be replayed over subsequent user changes.

`--bundle-dir` can reuse downloaded assets but still checks the official release identity; it is not a fully offline or unpublished-package bypass. The local lock also does not replace coordination with another operator. Follow the [complete native delivery procedure](native-webos-delivery.md) for recovery decisions and state boundaries.

## 8. Homebrew, permissions and storage boundaries

An already working Homebrew Channel is an alternative installer. Use the chosen release's matching OTTPlay catalog: hosted and native repository filenames differ. A catalog URL containing an exact release tag is a fixed snapshot, not an automatic latest/beta subscription. Adding it does not silently update the application. The product-specific installation guides provide the matching metadata gateway addresses.

Homebrew Channel is a community project. Its own documentation distinguishes root-dependent features from ordinary execution. Merely having it installed is not proof of root access; an installation dependent on Developer Mode still needs that session. Keep root-oriented maintainer commands out of the ordinary `prisoner:9922` workflow. [Homebrew Channel project documentation](https://github.com/webosbrew/webos-homebrew-channel/blob/main/README.md)

For USB and local files, distinguish three questions: can the installer accept a package, can this application see a location, and can its media engine play the contents? A September 2025 LG-hosted **web-app** forum response states that USB access is unavailable in that context. It does not establish every native application's permissions. LG's JavaScript-service guide allows additional filesystem operations with restrictions, including no C/C++ addons; it does not grant arbitrary filesystem access to the web page. [USB discussion](https://forum.webostv.developer.lge.com/t/webos-internal-storage-and-usb/27902), [LG JavaScript services](https://webostv.developer.lge.com/develop/guides/js-service-basics)

No general modern-webOS procedure for copying an arbitrary IPK to a USB stick was established by this review. LG's older USB installation instructions are under **NetCast** and must not be transplanted into this runbook. [LG NetCast FAQ](https://webostv.developer.lge.com/more/netcast/netcast-faq)

Native USB/media support must be qualified for the exact release and TV. A computer's mounted folder is not automatically a TV path. A stored source name is not proof that a disconnected drive is available. Do not use permission changes or a root repair to conceal an ordinary missing source.

## 9. Diagnose the failed stage

Work from the last completed checkpoint. Preserve the first failure and command exit status; avoid changing credentials, SDK, package and application data together.

1. **Alias or network:** confirm the selected TV profile, current TV address, local routing and maintenance ownership.
2. **Key retrieval:** check Key Server and the current displayed passphrase. A downloaded file is only the end of this stage.
3. **SSH authentication and command completion:** run the read-only system-information check. An authentication error, a timeout and incomplete output are different failures. Do not classify every timeout as an SSH-algorithm mismatch.
4. **Package installation:** verify release identity and inventory. If completion is uncertain, inspect state before deciding whether any retry is safe.
5. **Application launch:** check the application ID, running state and TV screen. An installed package may still fail during startup.
6. **Player, provider or media:** separate website loading, provider access, decoding, audio, remote input and persistence. Use a source you are authorized to access, and report the smallest reproducible failure.

### Web Inspector, logs and screenshots

Inspect the actual TV web application, using its application ID:

```sh
ares-inspect --device YOUR_TV --app APP_ID
```

Open the printed URL in a compatible Chrome/Chromium and keep the tunnel running. Use Console and Network to separate JavaScript errors from failed requests; use Sources and Elements for code/layout debugging. A development package may provide more useful source information than a minified release. A desktop tab opening the same player URL is comparison evidence, not the TV runtime. [LG app debugging and browser compatibility](https://webostv.developer.lge.com/develop/getting-started/app-debugging)

Inspection can launch an application that is not running. For a packaged JavaScript service, `ares-inspect --device YOUR_TV --service SERVICE_ID` uses the **service ID** and may stop/restart it and write debugger-port setup. Follow its emitted Node Inspector instructions. On the Node 8+ path, automatic `--open` is unsupported. Arrange a debugging window and stop the tunnel with Ctrl-C afterward. Neither mode debugs a native executable. [CLI 3.2.6 inspector implementation](https://github.com/webos-tools/cli/blob/v3.2.6/lib/inspect.js)

The TV profile of 3.2.6 does **not** support `ares-log`, `ares-shell`, `ares-push` or `ares-pull`. Switching to OSE does not grant those operations on a consumer TV. Use the web/service inspector for console diagnostics or read an existing app-owned log where permitted. No universal TV system-log export command was established here. [Command profile matrix](https://github.com/webos-tools/cli/blob/v3.2.6/README.md#command-list)

For an explicit read-only shell check, the TV command is:

```sh
ares-novacom --device YOUR_TV --run "id"
```

For supported target resource monitoring:

```sh
ares-device --device YOUR_TV --resource-monitor \
  --id-filter APP_ID --time-interval 3 --save ./resources.csv
```

Stop the monitor with Ctrl-C. Resource numbers help describe a problem but do not establish its cause. [CLI device help](https://github.com/webos-tools/cli/blob/v3.2.6/files/help/ares-device.help)

For file retrieval, do not use `ares-novacom --put` or `--get`: their parser names have no dispatch implementation in 3.2.6. [Versioned dispatcher](https://github.com/webos-tools/cli/blob/v3.2.6/bin/ares-novacom.js)

Ordinary SSH can stream a small, readable app-owned log. The CLI normally saves the key for `YOUR_TV` as `~/.ssh/YOUR_TV_webos`; a manually configured alias can differ. The following is a template, not a known log location. Substitute a verified key and actual accessible path:

```sh
ssh -T -p 9922 -i "$HOME/.ssh/YOUR_TV_webos" prisoner@TV_HOST \
  'cat /actual/app-owned/log.txt' > ./tv-log.txt
```

Use normal host-key verification, check exit status and the captured file, and keep the result private. SSH authentication does not make a root-only path readable. Do not overwrite a live profile/database or assemble an ad hoc backup from database/WAL files. This access method uses the same streaming principle as the CLI's file-transfer implementation; target permissions still need verification. [CLI key/transfer implementation](https://github.com/webos-tools/cli/blob/v3.2.6/lib/base/novacom.js), [OpenSSH options](https://man.openbsd.org/ssh.1)

For a small disposable upload, choose an unused scratch filename in a location the session can write. This example refuses to overwrite an existing file; `/tmp` is not persistent storage:

```sh
ssh -T -p 9922 -i "$HOME/.ssh/YOUR_TV_webos" prisoner@TV_HOST \
  'umask 077; set -C; cat > /tmp/ottplay-note-UNIQUE.txt' < ./note.txt
ssh -T -p 9922 -i "$HOME/.ssh/YOUR_TV_webos" prisoner@TV_HOST \
  'cat /tmp/ottplay-note-UNIQUE.txt' > ./note-returned.txt
shasum -a 256 ./note.txt ./note-returned.txt
```

Check both SSH exit statuses and matching hashes, then remove only your scratch file when finished. A denied path is a stop condition, not permission to alter the jail.

### A confirmed legacy SSH negotiation error

Only if OpenSSH explicitly reports no matching **host-key algorithm** and offers `ssh-rsa`, a temporary per-command exception can be tested against the intended, verified host:

```sh
ssh -T -p 9922 -o HostKeyAlgorithms=+ssh-rsa \
  -i "$HOME/.ssh/YOUR_TV_webos" prisoner@TV_HOST 'id'
```

This appends one algorithm for that invocation; it does not disable host-key checking. User authentication is a separate stage: add `-o PubkeyAcceptedAlgorithms=+ssh-rsa` only for a confirmed RSA/SHA-1 authentication requirement. An RSA key does not itself require SHA-1. Do not apply either option globally or use it to explain an undiagnosed timeout. [OpenSSH legacy guidance](https://www.openssh.org/legacy.html), [RSA/SHA-1 compatibility note](https://www.openssh.org/txt/release-8.8)

### Screenshots and safe reports

For a real-TV screenshot, use a camera. CLI 3.2.6 rejects `ares-device --capture-screen` in the TV profile; its OSE/APOLLO support is not a consumer-TV capture route. Capture a Simulator window with the host OS instead and label it accordingly. Do not substitute undocumented Luna capture calls. [Capture profile guard](https://github.com/webos-tools/cli/blob/v3.2.6/bin/ares-device.js)

Keep raw logs, screenshots and updater work directories private until reviewed. Redact source URLs containing tokens, account identifiers, local addresses, device identifiers and pairing material. A useful public report contains model/firmware, CLI/Node versions, app ID, release/package identity, failed stage, sanitized error, expected result and reproducible steps. Do not publish private snapshots as diagnostic attachments.

### What one bounded lab check established

A November 2026 project read-only check identified one **OLED65B4AUA.DUSQLJR**, SDK **10.3.2**, firmware **33.31.75**. It reported an `aarch64` kernel but a **32-bit ARM userspace**, illustrating why kernel architecture alone cannot select a native package. The saved credential authenticated against an isolated host pin originating from trust-on-first-use, not out-of-band verification. No application was installed or launched. This small SDK probe did not establish the full CLI timeout's cause, and is not an LG compatibility statement or justification to weaken host verification globally.

## 10. Know what simulation and platform documentation prove

LG's Simulator is useful for web application development but has native and media limitations. A simulator restriction is not proof that a physical TV lacks a capability; a simulator pass is not physical-TV acceptance either. [LG Simulator introduction](https://webostv.developer.lge.com/develop/tools/simulator-introduction)

For this repository's hosted player, start the intended local server separately, then use:

```sh
bash scripts/run-webos-simulator.sh --url http://127.0.0.1:8443/ --dry-run
bash scripts/run-webos-simulator.sh --url http://127.0.0.1:8443/ --no-install
```

The dry run prepares launcher files and prints the command; it is not zero-write. The second command needs an installed supported Simulator. Omit `--no-install` only when intentionally allowing its automatic installation. This script does not build or start the player server; an actual run checks the supplied server's health and player URL. Native desktop simulation is a separate path. Neither qualifies TV decoding, USB access, sandbox permissions or installation.

For an independent web-app directory containing `appinfo.json`, the CLI also supports direct Simulator launch:

```sh
ares-launch --simulator 26 --simulator-path /path/to/webOS_TV_26_Simulator ./web-app
```

Use the installed Simulator's actual version/path. No TV pairing is involved. [LG Simulator guide](https://webostv.developer.lge.com/develop/tools/simulator-dev-guide)

For web-only iteration on the paired TV, `ares-launch --device YOUR_TV --hosted ./web-app` serves from the computer. The TV must reach that server; this mode does not run packaged JavaScript services and is not an offline-install test. [LG hosted-mode reference](https://webostv.developer.lge.com/develop/tools/cli-dev-guide)

Also avoid the obsolete blanket statement that Developer Mode supports only web apps. LG now documents Flutter deployment with its supplied toolchain on **webOS TV 26 Re:New and later**; the official host support is Ubuntu. LG explicitly says TVs shipped with webOS 26 still need the Re:New update. That exception does not certify arbitrary Rust/native IPKs or OTTPlay's media runtime. [LG Flutter guide](https://webostv.developer.lge.com/develop/guides/flutter-for-webos), [LG Flutter announcement](https://webostv.developer.lge.com/news/flutter-for-webos-tv-is-now-available-for-developers)

Permission declarations are version-specific too: LG describes optional ACG adoption/testing for webOS 26 Re:New and mandatory declarations from webOS 27. Declaring a group does not confer root or access to arbitrary private services. [LG ACG guide](https://webostv.developer.lge.com/develop/guides/acg-guide)

Before calling a TV/release combination supported, verify installation, startup, the required media and controls, Save/reopen behavior, and any required external storage on that actual combination. Keep untested capabilities visible in the result.

## 11. Optional Home Assistant control and waking the TV

Home Assistant TV control is a separate pairing from Developer Mode SSH and OTTPlay's own remote-control connection. It does not install IPKs or renew the Developer Mode session.

With the TV on, enable its applicable network-control setting, then in Home Assistant open **Settings → Devices & services → Add Integration → LG webOS TV** and follow the prompts. Use the actual TV host if discovery fails. For network waking, Home Assistant recommends Ethernet and describes settings such as **LG Connect Apps**, **Mobile App**, or a model-specific **Wake on LAN** control. Labels vary; do not assume a setting on one model exists on another. Its documented integration range starts at webOS 2.0, which is not an OTTPlay compatibility statement. [Home Assistant's LG integration](https://www.home-assistant.io/integrations/webostv/)

Add Home Assistant's **Wake on LAN** integration with the TV's network-interface MAC privately, then test its button while the TV is in standby. The button sends a packet; it does not confirm that the TV woke. Observe the screen and check subsequent availability. This normally needs the same network; cross-subnet delivery needs separate network support. [Wake on LAN setup](https://www.home-assistant.io/integrations/wake_on_lan/)

If an existing ESPHome node already provides the TV's wake action, use that instead of adding a duplicate wake route. This is the arrangement in an existing project configuration: the configured target stays in the node's private firmware configuration. In Home Assistant, open the **Actions** tool, select the registered action, and call it once. Its generic name is:

```yaml
action: esphome.<NODE>_wake_<TV>
```

Replace the placeholders with the action already registered for your node and TV; this project action takes no arguments. It asks the node to send a finite sequence of Wake-on-LAN packets; successful dispatch still requires checking that the TV wakes. [ESPHome Wake-on-LAN](https://esphome.io/components/button/wake_on_lan/) A **screen-on** control for an already running TV is not a wake-from-standby operation. Keep those actions distinct. [Home Assistant screen controls](https://www.home-assistant.io/integrations/webostv/#switches)

To wire the TV entity's power-on request, create an automation using **Device is requested to turn on** and call the configured wake action. Test this before making it part of unattended maintenance. A TV being awake is still not proof of SSH readiness, a valid Developer Mode session or a free maintenance window. [LG integration power-on workflow](https://www.home-assistant.io/integrations/webostv/#turning-on-the-tv-from-home-assistant)
