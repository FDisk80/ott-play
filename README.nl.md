<a id="ott-play-foss"></a>

# OTT-play FOSS

<!-- language-navigation:start -->
<p dir="ltr">
<a href="README.md" lang="en" dir="ltr">English</a> · <a href="README.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="README.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="README.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="README.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="README.es.md" lang="es" dir="ltr">Español</a> · <a href="README.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="README.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="README.he.md" lang="he" dir="rtl">עברית</a> · <a href="README.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="README.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="README.it.md" lang="it" dir="ltr">Italiano</a> · <a href="README.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="README.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="README.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="README.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="README.pt.md" lang="pt" dir="ltr">Português</a> · <a href="README.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="README.th.md" lang="th" dir="ltr">ไทย</a> · <a href="README.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="README.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="README.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="README.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="README.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

Lokale bestanden zonder internet: zie [Lokale video's en offline afspelen](docs/offline-media.md).

[![De zenderlijst van OTT-play FOSS in perspectief](docs/images/hero.png)](docs/images/studio-2026-default.png)

*Bestaande schermafbeelding van de Studio 2026-interface met synthetische zender- en programmagegevens.
Open de afbeelding voor de oorspronkelijke, vlakke weergave; dit is geen opname van een actief abonnement.
[Afbeeldingsbron en opnieuw genereren](docs/images/README.md).*

[Snelstartgidsen in 88 talen](docs/readme/README.md) · [Documentatiewiki](docs/wiki/Home.nl.md)

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![Fuzzing: alleen RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

Publieke releasekandidaten voeren begrensde, geïsoleerde fuzzcampagnes uit voor native/server-XMLTV-parsing en validatie van portaalaanvragen. Zie [fuzzingbereik, reproductie en releasebewijs](FUZZING.md).

Zelfstandige IPTV/OTT-speler met een lokale Rust-HTTP-server. Werkt op smart-tv's (LG WebOS, Samsung Tizen, Panasonic, Sony enz.), settopboxen (Infomir MAG, Dune HD, Enigma2, Android TV) en desktopbrowsers.

Begin met de [architectuur- en bijdragersgids](docs/architecture.md) voor runtimelagen, verantwoordelijkheden, uitbreiding van providers en verificatie. Zie [afspeelsessies en levensduur van providers](docs/playback-session-architecture.md) voor de grens tussen core en host en de compatibiliteitscontracten.

<!-- ci-release-process:start -->
<a id="release-process"></a>

## Releaseproces

Zie de [releasestrategie](RELEASING.md) voor validatie en de regels voor promotie van nightly, beta, RC en stable, en het [operationele draaiboek](docs/release-workflow.md) voor lokale opdrachten.
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## In een browser uitvoeren

Open de [live demo](https://player.ottplay.here.now/) of bouw en serveer de webspeler volgens onderstaande instructies.

De [lokale macOS-installatie](docs/local-http-deployment.md) biedt HTTP-origins voor de speler op poorten 8443–8446. Poort 8095 is buiten gebruik.

Kies bij de eerste start **Demo proberen** om het bewegende testbeeld af te spelen, of stel uw eigen M3U-afspeellijst of provider in. De demo is later ook beschikbaar via **Provider wijzigen → Demo**.

De demomodus vereist internet, maar geen provideraccount. De stille MP4- en HLS-testzenders worden gehost op here.now en gedeeld door de webspeler, Tauri, Capacitor en OTT Server. Bestaande providerinstellingen blijven bij het wisselen behouden. Voor een afzonderlijke **beeld- en geluidscontrole** opent u **Informatie → Audio → Afspelen** op de beheerde HTML5-engine wanneer deze inactief is of live-tv afspeelt. Dit gebruikt het hoorbare testbestand `av-v1.mp4` op here.now en vereist internet. De clip zit niet in spelerpakketten en wordt nooit bij het opstarten opgehaald. VOD, archief en afwijkende apparaatengines (waaronder PC2/Video.js en native engines) zijn uitgesloten; zie de [stappen, verwachte tonen en het hostingdiagram](docs/audio-video-check.nl.md).

Geïnstalleerde desktopbrowservensters ondersteunen **Window Controls Overlay**: Chrome kan de afzonderlijke titelbalk verbergen en de vensterknoppen en het appmenu boven de speler behouden. Open de geïnstalleerde app en kies **Titelbalk verbergen** wanneer Chrome dat aanbiedt; **Titelbalk weergeven** herstelt het gebruikelijke kader. Gewone tabbladen en tv-/native-shellindelingen behouden hun gedrag. Zie [browservensterbediening](docs/browser-window-controls.md) voor ondersteunde installatie-URL's, het bijwerken van een bestaande snelkoppeling en verificatie.

Gebruik **Alt/Option + Links/Rechts** om in de hoofdvideoweergave tien seconden te zoeken (**Command + Links/Rechts** werkt ook op macOS), zowel in volledig scherm als in de normale weergave. Lokale video's, VOD en ondersteunde zenderarchieven gebruiken dezelfde bediening in web, Tauri en Capacitor. Zie [sneltoetsen en beperkingen](docs/browser-window-controls.md#playback-keyboard-shortcuts).

In de pc-interface speelt **R** een willekeurige andere zender of video uit de huidige lijst af zonder de volgorde te wijzigen. Dit werkt in de hoofdvideoweergave en zender-/videolijsten; tekstinvoer, dialoogvensters, instellingen en kioskbeperkingen houden voorrang. Andere apparaattoetsen blijven ongewijzigd.

Het synthetische testbeeld kan opnieuw worden gegenereerd met `scripts/generate-demo-media.sh` (vereist FFmpeg); gegenereerde media blijven in de genegeerde map `.local-artifacts`.

<a id="features"></a>

## Functies

- **Afspelen**: HLS, DASH en gewone HTTP-streams, met beheerde kwaliteitsplafonds voor HLS.js/Shaka, begrensd herstel en maximaal drie expliciete reserve-URL's per livezender. Archief/VOD schakelt nooit over naar een live reserve; zie [kwaliteit en herstel](docs/playback-stream-policy.nl.md).
- **EPG**: XMLTV-koppeling, timeshift/terugkijken, zoeken op programmatitel (N5 in de EPG), herinneringen en handmatige feed-/ID-koppeling voor één exacte zender in het gehoste/native XMLTV-pad. Zie [koppeling en toegankelijkheid](docs/guide-binding-accessibility.nl.md).
- **Favorieten**: één geordende [gemengde verzameling](docs/mixed-favorites.md) over ingestelde providers en profielen op ondersteunde apparaten, met overdraagbare CLI-export/import; ouderlijke pincode. Favorietenlijsten per bron blijven beschikbaar in de terugvalmodus.
- **Instellingen**: JSON-export/import van instellingen en favorieten, een terugdraaijournaal voor ondersteunde localStorage-batches, bronbewust hervatten van archief en exacte vergelijking van opgeslagen instellingen voor controllerworkflows. Herstel gaat uit van één schrijver; aangepaste opslagadapters behouden terugdraaien naar beste vermogen. Zie [instellingen herstellen](docs/settings-recovery.nl.md).
- **Gedeelde interface**: OTT Server, Tauri en Capacitor gebruiken hetzelfde zenderlijstthema en dezelfde zichtbaarheidsinstellingen. Instellingen voor [interfacekleuren](docs/interface-colors.md) bieden negen kleurrollen, een palet, exacte invoer van HEX/RGB/HSV-waarden en vijf kleurenschema's en worden per client opgeslagen; zenderlijstinstellingen bepalen zendernamen, picons, huidige programma's, voortgang en archiefmarkeringen.
- **Providers**: M3U/M3U8, Xtream live-tv plus [film-/seriecatalogi op aanvraag](docs/xtream-media.nl.md), Stalker/Ministra met [films en geneste afleveringen](docs/stalker-media.md), Plex en VPortal. Providermogelijkheden en accounttoegang bepalen beschikbare archief- en mediabibliotheekfuncties.
- **Pushopdrachten**: afstandsbediening via webhook — zender, provider of afspeellijst wijzigen en pop-ups tonen
- **Tekstinvoer op afstand (swop)**: telefoontoetsenbord via Cloudflare Worker wanneer tv en telefoon op verschillende netwerken zitten (per installatie geautoriseerde sessies; ♥™ op het virtuele toetsenbord)
- **Routering per apparaat**: UUID-adressering voor opstellingen met meerdere apparaten
- **Lokale proxy**: optionele lokale opdrachtserver voor volledig lokale automatisering (zonder centrale server)
- **Controllerintegratie**: operators met apparaat-/actiebereik, optionele duurzame opdrachtresultaten, hervatbare toepassing van Local/Home-presets en live-/archiefoverdracht van dezelfde bron via de bijbehorende [controlserver](https://github.com/open-ott-play/ottplay-control-server). Vereist de bijgewerkte controller/CLI; een zelfstandig browsertabblad levert dit niet.
- **Getypeerde externe voorkeuren**: ontdek instellingen, lees opgeslagen en effectieve waarden en sla op met controle van runtime-instantie, bron en revisie; zie [externe instellingen en VPortal-configuratie](docs/remote-player-settings.md).
- **Debuggen**: optionele afspeel-HUD/ringlog via `?debug=1`, inspectie op afstand met toestemming en een gehoste audio-/videocontrole op aanvraag
- **Toetsenbordtoegankelijkheid**: benoemde klassieke dialoogvensters, vasthouden en terugzetten van Tab-focus, semantiek voor de geselecteerde zender en niet-onderbrekende statusmeldingen. Deze verbeteringen bewijzen geen volledige WCAG- of apparaatschermlezerconformiteit.
- **24 apparaattypen**: apparaatspecifieke afstandsbedieningstoetsen
- **88 interfacetalen**: overeenkomstige catalogi, [vertaalde snelstartgidsen](docs/readme/README.md) en [met CLDR gecontroleerde toetsenbordalfabetten](docs/localization.md). De hoofdhandleiding en gekoppelde functiegidsen zijn beschikbaar in [24 documentatietalen](docs/manual-translations.md); andere technische referenties behouden hun bestaande talen.

De [opleveringsgids](docs/roadmap-delivery.nl.md) beschrijft de geïmplementeerde functies in deze bronrevisie, platformgrenzen, diagrammen en verificatie. Geïnstalleerde releases of gehoste installaties kunnen een eerdere revisie gebruiken. De onafhankelijke native [Android-app](https://github.com/open-ott-play/ottplay-android) bewaart audio-/ondertitelkeuzes ook op taal, rol en label in plaats van manifestindexen; implementatie en release daarvan staan los van deze frontend.

De [STB-broncodebeoordeling](docs/stb-player-improvements.md) beschrijft de verbeteringen voor media, resourcegebruik en herstel, de bijbehorende broncodevergelijkingen en de huidige beperkingen.

<a id="debug-hud"></a>

## Debug-HUD

De lokale HUD en serverlogopslag worden afzonderlijk ingeschakeld. Zie [diagnostische toegang, afscherming en bewaartermijnen](docs/diagnostic-security.md) voordat u logs van andere apparaten verzamelt.

Schakel debugmodus in via een van deze mogelijkheden:
- URL: `?debug=1` of `?debug=true`
- Lokale opslag: `localStorage.setItem("ottplay_debug", "1")`
- Venstereigenschap: `window.__OTT_DEBUG__ = true`
- Server: wanneer `/debug/config` `{enabled: true}` teruggeeft

Wanneer debuggen is ingeschakeld:
- Druk op **D** om de HUD-balk op het scherm te wisselen (`ottDebugSetHud` / `__ottDebug.toggleHud()`)
  - Slaat over wanneer de focus op INPUT/TEXTAREA/listEdit staat
  - Gebruikt `e.key` om het MAG/Maple-conflict PLAY/PREV=68 te vermijden
- Informatiemenu → **Debug-HUD** → roept `__ottDebug.toggleHud()` aan
- Instellingen beheren → **Debug-HUD**:
  - Als debuggen al geladen is: wisselt de zichtbaarheid van de HUD
  - Anders: stelt `ottplay_debug=1` + `ottplay_debug_hud=1` in en vraagt om opnieuw starten
- Opslag: `ottDebugSetHud` bewaart de HUD-status in `localStorage.ottplay_debug_hud` ("1"/"0")

<a id="capacitor-ios-and-android"></a>

## Capacitor voor iOS en Android

Deze repository verpakt de gedeelde TypeScript-frontend met Capacitor voor iOS en Android 7+. Beide gebruiken systeemlettertypen en de door npm vastgelegde native runtime. Een afzonderlijke API 22-compatibiliteits-APK ondersteunt Android 5.1/6 met WebView 60 of nieuwer. Beide Android-APK's zijn ondertekend en worden geleverd met gekwalificeerde beta-, RC- en stabiele releases, naast de niet-ondertekende iOS-IPA. De onafhankelijke Kotlin-app blijft in [ottplay-android](https://github.com/open-ott-play/ottplay-android).

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

Zie [Capacitor-configuratie](docs/capacitor-mobile.md) en [Android-distributie en updates op afstand](docs/android-distributions.md).

De iOS-interface gebruikt liggende stand. Instellingen, providerconfiguratie, toestemming voor afstandsbediening en JSON-import/export blijven de gedeelde frontend gebruiken. Tabletmultitasking kan de gevraagde oriëntatie overschrijven.

Veeg op iPhone verticaal over de zenderlijst om door rijen en pagina's te bewegen; omhoog voor latere zenders en omlaag voor eerdere. Een snelle veeg beweegt over meerdere pagina's en remt af; langzaam slepen blijft nauwkeurig. Raak het scherm aan of druk op een navigatietoets om de beweging te stoppen. Eén tik start de zender onder uw vinger, ook als een andere rij geselecteerd is. Een veeg opent nooit de zender wanneer u uw vinger optilt.

Video speelt inline af op iPhone. Tik onderaan het scherm voor programma-informatie of open het menu terwijl afspelen doorgaat. Picture in Picture blijft een afzonderlijke afspeeloptie.

Apparaat-smoketest: [checklist voor Modus B](docs/mode-b-device-smoke.md) en `./scripts/smoke-capacitor-device.sh --help` (build/sync alleen gericht op iOS). Tauri-desktopsmoketest: [desktopchecklist](docs/mode-b-tauri-smoke.md).

<a id="installation"></a>

## Installatie

| Platform | Pakket | Opmerkingen |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Afzonderlijke Apple Silicon- en Intel-builds; ad-hoc ondertekend tenzij Apple-ondertekening is ingesteld |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | Verschillende distributies |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode of Homebrew Channel](docs/lg-webos-installation.md); gehoste speler, netwerk vereist |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode en lokaal ondertekenen; niet-ondertekend tv-pakket, apart van Family Hub](docs/samsung-tizen-installation.md) |
| **iOS** | `.ipa` via AltStore / TestFlight / Xcode | Alleen sideloading — nog niet in de App Store |
| **Android (gedeelde frontend)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | Ondertekende Capacitor-pakketten; kies de ondersteunde Android-versie |
| **Android (native Kotlin)** | Afzonderlijke [native app](https://github.com/open-ott-play/ottplay-android) | Publieke repository; afzonderlijke app en releaseworkflow |

Ondersteunde installatiebestanden zijn toegevoegd aan gekwalificeerde GitHub-releases: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **Opmerking:** macOS-appbundels gebruiken ad-hoc ondertekening als Apple-ondertekeningsgegevens ontbreken; dit levert geen Developer ID of notarisatie. Windows-/Linux-installatiebestanden en iOS-releasepakketten kunnen niet-ondertekend zijn. iOS vereist ondertekening vóór installatie op een fysiek apparaat. Gekwalificeerde Full- en API 22-Android-release-APK's gebruiken het bestaande ondertekeningscertificaat; lokale releasebuilds hebben een ingestelde keystore nodig om ondertekende APK's te maken.

---

<a id="macos"></a>

### macOS

1. Kies de gewenste tag bij [Releases](https://github.com/open-ott-play/ottplay-foss/releases). De snelkoppeling naar de laatste release kiest stable, niet beta of RC.
2. Download `OttPlay.FOSS_*_aarch64-apple-darwin.dmg` voor Apple Silicon of `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` voor Intel. Dit zijn afzonderlijke architectuurbuilds.
3. Open de `.dmg` en sleep **OttPlay FOSS.app** naar Programma's.
4. Controleer de gekopieerde bundel vóór de eerste start:

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

Een geslaagde verificatie controleert de bundelintegriteit. `Signature=adhoc` betekent dat de app geen door Apple geauthenticeerde ontwikkelaarsidentiteit heeft; dit bewijst geen notarisatie of Gatekeeper-goedkeuring. Bij een vertrouwde download en geldige bundel kan macOS na de eerste startpoging nog steeds **Systeeminstellingen → Privacy en beveiliging → Open toch** vereisen; zie [Apple's instructies](https://support.apple.com/en-us/102445).

Een melding dat de app beschadigd is bewijst niet dat alleen quarantaine de oorzaak is. Bewaar bij mislukte handtekeningcontrole de fout en verkrijg een gecorrigeerde release. Onderteken de gedownloade app niet opnieuw en verwijder geen attributen om een mislukte controle geslaagd te laten lijken.

ZIP-alternatieven zijn `OttPlay.FOSS_aarch64-apple-darwin.app.zip` en `OttPlay.FOSS_x86_64-apple-darwin.app.zip`. Zie [macOS-ondertekening en artefactcontrole](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact) voor uitpakken, schijfimage- en Gatekeeper-controles. Gebruik [lokale macOS-oplevering](docs/macos-local-delivery.md) voor checkoutbuilds en lokale installatie.

---

<a id="windows"></a>

### Windows

1. Download `.msi` of `.exe` van [Releases](https://github.com/open-ott-play/ottplay-foss/releases/latest)
2. Voer het installatieprogramma uit en volg de aanwijzingen
3. Start via het Startmenu of de bureaubladsnelkoppeling

---

<a id="linux"></a>

### Linux

Linux-afspelen vereist GStreamer-plug-ins voor HLS, H.264 en AAC naast WebKitGTK. De pakketten verklaren deze media-afhankelijkheden; AppImage-builds bundelen het mediaframework. Zie [Linux-mediapakketten](docs/linux-media-packaging.md) voor codeccontroles en het onderscheid tussen browser- en native acceptatie.

**AppImage:**

```bash
chmod +x OttPlay.FOSS_*_amd64.AppImage
./OttPlay.FOSS_*_amd64.AppImage
```

**Debian/Ubuntu (.deb):**

```bash
sudo apt install ./OttPlay.FOSS_*.deb
```

**Fedora (.rpm):**

```bash
sudo dnf --enablerepo=fedora-cisco-openh264 install ./OttPlay.FOSS-*.rpm
```

---

<a id="ios-installation"></a>

### iOS-installatie

iOS vereist ondertekening vóór installatie op een fysiek apparaat. Gebruik AltStore Classic voor de niet-ondertekende release-IPA of bouw en onderteken de broncode met Xcode. TestFlight vereist een afzonderlijke uitnodiging, wanneer aangeboden.

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### Optie 1: AltStore Classic (aanbevolen voor persoonlijk gebruik)

AltServer draait op uw computer; AltStore Classic draait op uw iPhone/iPad en importeert de IPA. Een gratis Apple Account volstaat.

**Vereisten:**

- iPhone/iPad met **iOS/iPadOS 15 of nieuwer** voor de huidige OTT-play-build.
- Een Mac of Windows-pc met AltServer en een USB-datakabel.
- Een Apple Account voor ondertekening en internet voor de releasedownload.

**Stap 1: AltStore eenmalig instellen**

1. Installeer AltServer volgens de officiële [macOS-instructies](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) of [Windows-instructies](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows). Start het en gebruik het menubalk-/systeemvakpictogram.
2. Sluit het apparaat via USB aan, ontgrendel het en accepteer de vertrouwensvragen van computer en apparaat. Controleer op een Mac of het apparaat in Finder verschijnt.
3. Selecteer uw apparaat via **AltServer-menu → Install AltStore** en rond de vragen over het ondertekeningsaccount af. Wacht op de installatiemelding.
4. Open op het apparaat **Instellingen → Algemeen → VPN- en apparaatbeheer** en vertrouw zo nodig de ontwikkelaarsvermelding voor uw ondertekeningsaccount. Schakel op iOS 16+ **Instellingen → Privacy en beveiliging → Ontwikkelaarsmodus** in en voltooi de herstart-/bevestigingsvragen.
5. Open AltStore op het apparaat. Als het al geïnstalleerd is en werkt, sla deze instelling over en laat AltServer draaien voor de volgende import.

**Stap 2: de gekozen release op iPhone/iPad importeren**

1. Kies een exacte tag uit [alle releases](https://github.com/open-ott-play/ottplay-foss/releases) en download de bijbehorende `ottplay-foss-ios-unsigned.ipa` in Safari op het apparaat. De [snelkoppeling naar de laatste release](https://github.com/open-ott-play/ottplay-foss/releases/latest) kiest stable; gebruik de volledige lijst als u een beta wilt installeren.
2. Bewaar de IPA in Bestanden. Selecteer het bestand via **AltStore → My Apps → +**. U kunt ook een gedownloade IPA via AirDrop vanaf uw Mac overzetten en vóór import in Bestanden bewaren. De IPA openen op de Mac is niet deze importstap.
3. Laat AltServer draaien en de USB-kabel aangesloten terwijl AltStore de app ondertekent en installeert. Gebruik voor een update hetzelfde ondertekeningsaccount als de bestaande installatie; verwijder de app niet als eerste probleemoplossing.
4. Wacht tot de import voltooid is, controleer OTT-play onder **My Apps** en start het.

**Alternatief: de release-URL rechtstreeks importeren**

Voer met geïnstalleerde AltStore dit patroon in **Safari op de iPhone** in, vervang `TAG` door de exacte releasetag en accepteer **Open in AltStore**:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

Dit gebruikt de [installatie-URL-handler](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift) van AltStore. Het voorkomt onduidelijke Bestanden/Recent-vermeldingen wanneer meerdere downloads dezelfde bestandsnaam hebben. De URL moet naar het IPA-bestand verwijzen, niet naar de releasepagina.

De volgende import is bijvoorbeeld op **2026-09-29** gecontroleerd met AltStore 2.3 en AltServer 1.8.1. Dit is een vast historisch voorbeeld, geen link naar de nieuwste versie:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**Vernieuwen:** installaties met een gratis account verlopen na zeven dagen. Houd AltServer bereikbaar en gebruik **AltStore → My Apps → Refresh All** vóór het verlopen. Achtergrondvernieuwing heeft ook toegang tot AltServer nodig; zie [AltStore's vernieuwingsinstructies](https://faq.altstore.io/altstore-classic/your-altstore).

<a id="verify-the-installed-version-before-retrying"></a>

#### De geïnstalleerde versie controleren vóór opnieuw proberen

Een AirDrop-melding 'Verzonden' bevestigt alleen overdracht. Een voortgangsbalk van AltStore bevestigt dat import gestart is. Een verbroken Mirroring-/USB-verbinding bewijst niet dat installatie mislukte: controleer de geïnstalleerde app voordat u de IPA opnieuw aanbiedt.

Inspecteer op een Mac met Xcode geïnstalleerd en geselecteerd als actieve ontwikkelaarsmap het apparaat zonder herinstallatie:

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

Zoek in `result.apps` van de JSON naar OTT-play (`bundleIdentifier` begint met `play.ott.foss`) en vergelijk zowel `version` als `bundleVersion` met `CFBundleShortVersionString` en `CFBundleVersion` van de gekozen IPA. Een AltStore-accountachtervoegsel bij de bundle-ID is verwacht. Houd het apparaatrapport lokaal.

Het gecontroleerde beta.9-voorbeeld meldt **versie `1.1.51`, build `2.2.66`**. Dit bevestigt installatie; de app openen, aanmelden bij Cloudflare, afspeellijsten laden, afspelen en PiP zijn afzonderlijke apparaatcontroles.

<a id="troubleshooting-ios-installation"></a>

#### Problemen met iOS-installatie oplossen

- **AltServer heeft geen venster of geautomatiseerd openen loopt vast op een timeout:** gebruik het menubalk-/systeemvakpictogram. Het is een achtergrondapp. Herhaald een normaal appvenster proberen te openen voert geen IPA-import uit.
- **'Could not find AltServer' of het USB-apparaat is niet beschikbaar:** controleer of AltServer draait, ontgrendel de telefoon en controleer de vertrouwensvragen. Controleer zichtbaarheid in Finder op een Mac. Herstel een verbroken verbinding wanneer dat veilig is en controleer daarna de geïnstalleerde versie vóór een nieuwe poging. Volg bij aanhoudende problemen [AltStore's verbindingsdiagnose](https://faq.altstore.io/altstore-classic/troubleshooting-guide). Als de telefoon de internetverbinding van de computer levert, stem kabel- of netwerkwijzigingen af zodat ander werk niet wordt onderbroken.
- **iPhone Mirroring toont 'iPhone in Use' of blijft op 'Connecting':** rond de instelling af op de fysieke telefoon, of vergrendel het scherm en leg de telefoon bij de ontgrendelde Mac om te spiegelen. Ontgrendelen beëindigt Mirroring; voor USB-vertrouwen/-instelling moet het toestel mogelijk eerst ontgrendeld zijn. Als het na één herverbinding nog vastloopt, sluit Mirroring en ga op de telefoon verder. Zie [Apple's Mirroring-vereisten](https://support.apple.com/en-us/120421). Mirroring is optioneel voor installatie.
- **Een URL verliest Latijnse letters of wordt Cyrillisch in Mirroring:** zet de **Mac-invoerbron op ABC/Engels**. Druk met Mirroring actief op **Control–Spatie** en kies **English (US)** voor het hardwaretoetsenbord van de iPhone. De invoerbronnen kunnen verschillen; alleen de Mac-bron veranderen was in onze gecontroleerde sessie onvoldoende. Maak het veld leeg, voer de URL opnieuw in en controleer het adres vóór verzenden.
- **Plakken naar Mirroring blijft hangen of voegt onverwachte tekst in:** wis het veld en typ langzaam in korte stukken met English (US) op de iPhone, of voer de URL rechtstreeks op de telefoon in. Snelle Mirroring-invoer kan tekens verliezen of verdubbelen; controleer het hele adres vóór opslaan. Verzend geen gedeeltelijk geplakte URL. Plakken mislukte in onze installatiesessie; het is geen vereiste voor de rechtstreekse URL-methode.
- **Bestanden/Recent toont meerdere gelijke IPA-namen:** selecteer de exacte downloadlocatie of gebruik de URL met tag hierboven. U mag een lokale kopie hernoemen met tag/build voor duidelijkheid; hernoemen verandert de inhoud niet.
- **De geïnstalleerde app opent niet:** volg eventuele vragen over ontwikkelaarsvertrouwen of Ontwikkelaarsmodus op de telefoon. Controleer de verloopdatum in AltStore en vernieuw zo nodig. Noteer de werkelijke fout als het blijft mislukken; alleen een verbindingsfout is geen reden om de app te verwijderen en opnieuw te installeren.
- **OTT-play opent, maar een beveiligde afspeellijst faalt via mobiel internet:** installatie en bronauthenticatie staan los van elkaar. Gebruik **Instellingen → Instellingen beheren → Brontoegang** om bij een ingestelde bron aan te melden en laad de afspeellijst opnieuw. Voltooi biometrie/passkey- of e-mailcodevragen zo nodig op het fysieke apparaat. De bron moet [iOS Access-integratie](docs/ios-source-access.md) ondersteunen; installatie omzeilt geen IP-toestaanlijst.
- **Een passkey wordt gevraagd op vertrouwde wifi:** voor bronnen met iOS Access probeert de app eerst de oorspronkelijke bron zonder aanmelding en gebruikt de geauthenticeerde mobiele ingang pas na toegangsweigering. Controleer het publieke IP dat de bron echt ziet, inclusief IPv6: een toegestaan thuis-IPv4 dekt geen ander IPv6-, VPN- of mobiel adres. Netwerkwijzigingen en heropenen wissen de tijdelijke routevoorkeur. Een algemene netwerk-/serverfout hoort geen aanmelding uit te lokken.
- **Aanmelden verschijnt niet meer, maar de zenderlijst is leeg:** een geldige opgeslagen sessie wordt zonder nieuwe vraag hergebruikt. Laad na eerder mislukte gegevens of een servercorrectie de afspeellijst opnieuw, of sluit de app volledig en open deze eenmaal opnieuw. Controleer bij aanhoudende problemen of de bron een afspeellijst teruggeeft in plaats van een HTML-aanmeldpagina of JSON-fout. Noteer de getoonde fout en HTTP-status; deel geen bron-URL's met inloggegevens, cookies of Access-tokens.
- **Zenders laden, maar video buffert of meldt `SRC_NOT_FOUND`:** afspeellijsten laden en video afspelen zijn afzonderlijke controles. Probeer de zender na aanmelding eenmaal opnieuw; controleer bij aanhoudende problemen HLS-manifest- en segmentantwoorden en codec-ondersteuning. Alleen deze fout bewijst niet dat een andere engine of herinstallatie helpt.

<a id="option-2-testflight-if-available"></a>

#### Optie 2: TestFlight (indien beschikbaar)

Als een TestFlight-uitnodiging is gepubliceerd, installeer TestFlight uit de App Store, open de uitnodiging op het apparaat en tik op **Installeer**. Een GitHub-IPA-download levert geen TestFlight-uitnodiging.

<a id="option-3-xcode-for-developers"></a>

#### Optie 3: Xcode (voor ontwikkelaars)

Volg [Bouwen en openen](docs/capacitor-mobile.md#build-and-open), kies het **App**-target in Xcode, stel uw ontwikkelteam in onder **Signing & Capabilities**, kies het aangesloten apparaat en bouw/start. Voltooi zo nodig apparaatvertrouwen en Ontwikkelaarsmodus. De niet-ondertekende release-IPA importeren in Xcode's Devices-venster levert niet de ontbrekende ondertekeningsidentiteit of het provisioningprofiel.

---

<a id="android-application"></a>

### Android-app

Kies de Full Capacitor-APK uit de release van deze repository voor de gedeelde spelerinterface. Gebruik de API 22-compatibiliteits-APK op Android 5.1–6; deze vereist WebView 60 of nieuwer. Behoud bij updates de appidentiteit en het ondertekeningscertificaat zodat bestaande profielen beschikbaar blijven. Zie [bouwinstructies](android/README.md) en [distributie, ondertekening en installatie op afstand](docs/android-distributions.md).

De afzonderlijke [ottplay-android-repository](https://github.com/open-ott-play/ottplay-android) bevat de native Kotlin/Compose-app. Die heeft een eigen identiteit, voorkeuren en releaseworkflow en vervangt een Capacitor-installatie niet rechtstreeks. Historische releasebestanden blijven beschikbaar.

---

<a id="quick-start"></a>

## Snelstart

```bash
# 1. Build the player bundle
npm ci
npm run build:server   # production web/TV assets (ES5 → dist/player.js)

# 2. Build + start the Rust server
cargo build --release -p ottplay-server
./target/release/ottplay-server --port 8080

# 3. Open in browser
# http://localhost:8080
```

Gebruik uw eigen installatie van dezelfde revisie voor browsersmoketests.

Gebruik Node 22 en de stabiele Rust-toolchain. Start de server vanuit de repositoryhoofdmap zodat statische bestanden beschikbaar zijn. Native builds vereisen de hieronder beschreven platformtoolchains; die zijn niet nodig voor alleen de serverbuild.

Kies bij de eerste keer laden **Demo proberen** of open **Instellingen → Provider wijzigen → M3U / M3U8-afspeellijsten**. Open **Afspeellijst selecteren**, kies een slot, voer de **Afspeellijst-URL** in, sla de wijziging op en kies **Afspeellijst laden**. U levert zelf een afspeellijst of provideraccount; de app levert geen betaald zenderabonnement.

<a id="mode-a-companion-smoke"></a>

## Smoketest van de Modus A-companion

Curl-smoketest voor de Modus A-companion (`ottplay-server` / `archive/server.py`-gelijkheid): index, statische mappen, `/logo`, `/version`, optionele `/epg` en een proef zonder ophalen van `POST /m3u/cp.php`.

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

Controles staan in `scripts/modea-smoke-checks.json`. Geen geheimen. De opdrachtwachtrij / `local_proxy.py` (:8081) wordt apart getest door `scripts/smoke-command-queue.sh` (indien aanwezig).

<a id="classic-stalker--ministra-portals"></a>

## Klassieke Stalker-/Ministra-portalen

Kies **Stalker-portalen** en voer de MAC van de provider en de volledige portaal-URL in, bijvoorbeeld `http://provider.example/stalker_portal/c/`. URL's met `/c/index.html`, `/stalker_portal`, `/server/load.php`, `/load.php` en `/portal.php` kiezen het klassieke MAG-protocol. Bestaande configuraties met alleen de server behouden JSON-RPC. De provider laadt profiel, genres en gepagineerde livezenders met de gedeelde Stalker-core en zoekt vervolgens op de achtergrond naar films via het klassieke protocol `type=vod` en geneste afleveringen. Mappaden worden categorieën in de normale zenderlijst; beschikbare beschrijvingen, posters en stabiele globale Favorieten gebruiken dezelfde media-interface. Zie [catalogusgedrag en grenzen](docs/stalker-media.md).

Aanvragen van een zelfgehoste browserversie gaan via `/stalker/api` van de companion; native apps gebruiken hun bestaande HTTP-transport. Gehoste browserversies vereisen expliciet geconfigureerde routes via de [aparte relay](docs/stalker-relay.md). Browser- en serverbestanden moeten samen worden bijgewerkt.

Live afspelen resolveert tijdelijke zenderopdrachten bij het openen van een stream; zenderwissels, stoppen, PiP en providervervanging annuleren verouderde resoluties. Expliciete niet-tijdelijke HTTP(S)-opdrachten spelen rechtstreeks. Korte EPG wordt ondersteund. Het archief van klassieke portalen en het afzonderlijke `type=series`-dialect worden niet aangeboden door deze provider. Bestaand JSON-RPC-archief-/gidsgedrag verandert niet. Privé-LAN-portalen via de companionroute vereisen een exacte `OTTPLAY_PROXY_LAN_ORIGINS`-vermelding, net als andere companionproxyroutes.

De publieke Infomir-demo is `http://middleware-stalker.com/stalker_portal/c/`. Die gaf op 2026-09-26 drie livecatalogusvermeldingen terug, maar de media-endpoints waren onbeschikbaar; gebruik gecontroleerde portaal-/mediatestgegevens voor afspeelregressie.

<a id="m3u-stream-proxy-header-smoke"></a>

## Smoketest van M3U-streamproxyheaders

Vergelijkt upstreamaanvraagheaders die de Modus A-companion via `POST /m3u/cp.php` toevoegt bij ophalen van een beheersbare echo-URL (standaard een lokale mock — geen IPTV-providers of geheimen).

Contract (uit `src-rs/core/src/m3u.rs` + `archive/server.py`):
- Voegt alleen **User-Agent** toe (standaard `OTT-play-FOSS/1.0`, of presets `webos` / `tizen` / `viera` / `mag` / `dune`).
- Voegt **geen Referer** toe (Capacitor `M3UProxy` wel; Modus A niet).
- Verwijdert een beginnende `@` uit `url` (jQuery-formulier van provider).

```bash
# Companion must be listening (local install default :8443)
./scripts/smoke-m3u-stream-proxy-headers.sh

# Docker / cargo CLI default (:8080) — echo must be reachable from the companion process
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-m3u-stream-proxy-headers.sh

# Optional public echo (httpbin /headers JSON shape)
ECHO_URL=https://httpbingo.org/headers ./scripts/smoke-m3u-stream-proxy-headers.sh

# Also exercise JSON {url,ua} body
./scripts/smoke-m3u-stream-proxy-headers.sh --json
```

Afsluitcode: `0` geslaagd, `1` luistert niet, `2` header-/HTTP-afwijking, `3` gebruik/afhankelijkheden. Verwant aan `smoke-modea-companion.sh` / `smoke-command-queue.sh`.

<a id="logo-concurrent-bench-smoke"></a>

## Gelijktijdige logo-benchmarksmoketest

Latentiesmoketest met gelijktijdige `GET /logo/<id>.svg` (`?ch=` optioneel) tegen de Modus A-companion. Meldt aantallen geslaagd/mislukt en p50/p95/p99. Standaard praktische lokale CI-belasting (`CONCURRENCY=200`, `TOTAL=1000`); een volledige duurtest van 10.000 is optioneel (`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`).

```bash
# Companion must be listening (local install default :8443)
./scripts/smoke-logo-concurrent-bench.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-logo-concurrent-bench.sh

# Tune load
CONCURRENCY=100 TOTAL=500 ./scripts/smoke-logo-concurrent-bench.sh
./scripts/smoke-logo-concurrent-bench.sh --concurrency 100 --total 500

# Optional soak (machine must tolerate it)
./scripts/smoke-logo-concurrent-bench.sh --full
# LOGO_BENCH_FULL=1 ./scripts/smoke-logo-concurrent-bench.sh
```

Afsluitcode: `0` geslaagd, `1` luistert niet / verbinding mislukt, `2` hoog foutpercentage, `3` gebruik. Verwant aan `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`.

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## Smoketest voor XMLTV-cacheverversing en opwarming

Controleert het werkelijke XMLTV-/EPG-cachegedrag van de Modus A-companion tegen `src-rs` (zonder verzonnen API's):

- `EPG_CACHE` in geheugen via `GET /epg/:hash` → altijd `{"epg_data":[...]}` (HTTP 200).
- Processtart haalt `EPG_URLS` op de achtergrond op zonder HTTP-start te vertragen; elke voltooide ophaalactie wordt gevolgd door **2h** wachten vóór de volgende verversing.
- Optionele SQLite-opslag wanneer `DATABASE_URL` is ingesteld (geen publiek cachestatusendpoint).
- `GET /health` → `OK` bevestigt HTTP-gereedheid na een optionele herstart. Met `--strict-epg` en `--epg-hash` wacht de test ook op niet-lege EPG voor die zender binnen hetzelfde `--warmup-timeout`-budget.

Het standaardpad gebruikt alleen curl — **beëindigt geen processen**. Geef `--restart-cmd` / `RESTART_CMD` mee voor automatisch stoppen+herstarten, of volg de handmatige `launchctl`-stappen in `--help`.

```bash
# Companion must be listening (local install default :8443)
./scripts/smoke-xmltv-cache-refresh.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-xmltv-cache-refresh.sh

# Optional real channel hash (before/after restart if --restart-cmd set)
EPG_HASH=<channel-hash> ./scripts/smoke-xmltv-cache-refresh.sh

# Optional restart + wait for /health (warm-up). Example macOS local install:
./scripts/smoke-xmltv-cache-refresh.sh --restart-cmd \
  'launchctl unload ~/Library/LaunchAgents/com.ottplay-foss-local.plist && launchctl load ~/Library/LaunchAgents/com.ottplay-foss-local.plist'

# Optional local peek at archive/server.py .cache (Python companion only)
./scripts/smoke-xmltv-cache-refresh.sh --check-disk-cache /path/to/workdir/.cache
```

Afsluitcode: `0` geslaagd, `1` luistert niet, `2` assertie/opwarming mislukt, `3` gebruik. Verwant aan `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`.

<a id="mode-a-e2e-play-path-smoke"></a>

## E2E-smoketest voor het Modus A-afspeelpad

Smoketest van **afspeelpad/streamgereedheid** aan companionzijde (alleen HTTP — **geen** E2E met zichtbare UI). Controleert tegen een actieve Modus A-companion:

- Health of index bereikbaar
- Statische bestanden van de spelershell (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`)
- Optionele `GET /epg/<hash>.json` wanneer `EPG_HASH` is ingesteld
- `POST /m3u/match-channels` met geheimvrije JSON-testgegevens (lege lijst + één synthetische zender)
- **Afspelen** via streamproxy: `POST /m3u/cp.php` naar beheersbare testmedia (standaard lokale HLS-lijst, of `MEDIA_URL`) en controle op HTTP 200 + niet-lege inhoud / verwacht `Content-Type` (eerste bytes via de proxy)

Geen privé-IPTV-inloggegevens. Verwant aan `smoke-modea-companion.sh` (aanwezigheid), `smoke-m3u-stream-proxy-headers.sh` (UA/Referer), `smoke-xmltv-cache-refresh.sh`.

```bash
# Companion must be listening (local install default :8443)
./scripts/smoke-modea-e2e-play.sh

# Docker / cargo CLI default (:8080) — fixture host must be reachable from the companion
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-e2e-play.sh

# Optional EPG slice
EPG_HASH=<channel-hash> ./scripts/smoke-modea-e2e-play.sh

# Optional external media/echo (skips body equality; still requires HTTP 200 + non-empty)
MEDIA_URL=https://httpbingo.org/bytes/64 ./scripts/smoke-modea-e2e-play.sh

# Tiny MPEG-TS fixture + leading '@' strip on the play POST
./scripts/smoke-modea-e2e-play.sh --ts-fixture --with-at-strip
```

Afsluitcode: `0` geslaagd, `1` luistert niet, `2` assertie mislukt, `3` gebruik/afhankelijkheden.

<a id="capacitor-device-smoke-mode-b"></a>

## Capacitor-apparaatsmoketest (Modus B)

Simulator-/emulator-**checklist** (optioneel echt apparaat) voor Modus B Cap — niet de HTTP-companion van Modus A. Een mens beoordeelt de UI; het hulpscript automatiseert toolchain/native mappen/niet-fatale curl-controle van de opdrachtwachtrij.

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

Details: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md). Verwant aan `smoke-command-queue.sh` (Cap-loopback) — verwar dit niet met de Modus A-tests hierboven.

<a id="tauri-desktop-smoke-mode-b"></a>

## Tauri-desktopsmoketest (Modus B)

Desktopchecklist en hulpscript voor Modus B Tauri (venster/zender afspelen/PiP). Geen Modus A-companion-HTTP en geen Cap-apparaatsmoketest.

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

Details: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md). Apple-ontwikkelaarsgegevens zijn optioneel voor lokale tests; gebruik [ad-hoc ondertekening](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials) voor een verpakte Mac-app. Menselijke acceptatie blijft start, afspelen en PiP omvatten.

<a id="docker"></a>

## Docker

Multi-arch-images (amd64/arm64) worden gebouwd als kandidaat-OCI-archieven. Registerpublicatie promoveert het goedgekeurde stabiele archief naar Docker Hub zonder opnieuw bouwen; zie het [operationele draaiboek](docs/release-workflow.md).

De serverbinary wordt gebouwd met **musl** (Alpine) en geleverd op Alpine — vereist **geen** GLIBC_2.38+. Daardoor blijft `alvit/ottplay-foss` bruikbaar op Synology DSM Docker (x86_64) en andere hosts met oudere glibc.

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

Stabiele registertags gebruiken `X.Y.Z`. `latest` bijwerken is een afzonderlijke expliciete optie na publicatie van het image met versienummer; main-pushes en Git-tags publiceren geen images.

<a id="build-from-source"></a>

## Vanuit broncode bouwen

De domeinregels van de speler komen uit het vastgelegde Kotlin-multiplatformartefact in `vendor/ottplay-core.js`. Gids-, archief-, afspeellijst-, provider-, duurzame-status- en afspeelbeslissingen delen hun implementatie met FOSS2 en native Android. Browser-/tv-, Swift- en Rust-adapters behouden apparaat-API's, codecs, netwerkverkeer en UI-effecten. Het browserartefact behoudt ES5-syntaxis en de ondersteunde bootstrap voor legacy-API's. `npm test`, `check:bundle` en `check:es5` controleren de integratie; het artefactmanifest legt bron- en uitvoerhashes vast.

Controlserver- en SWOP-protocolvalidators worden gegenereerd uit het geversioneerde schema `contracts/ottplay-wire-v1.json`. Gecontroleerde generatorbewijzen en onveranderlijke compatibiliteitstestgegevens voorkomen consumerspecifieke beleidskopieën.

```
src/
├── polyfills/       # Polyfills for old STBs (String.trim, Math.imul, Array, TextEncoder, Date)
├── utils/           # Utilities (encoding, helpers, LZString compression)
├── storage/         # Storage (localStorage/cookie abstraction)
├── localization/    # Translation (_(), language file loader)
├── settings/        # ~100 player settings with typed interface (+ export/import envelope)
├── channels/        # Channels, EPG, favorites lists, timers, continue-watching
├── debug/           # Opt-in playback HUD / ring / ingest (`?debug=1`)
├── core/            # Playback (HLS.js/Shaka, fullscreen, PiP, audio/subtitle, soft live restart)
├── ui/              # UI (info bar, dialogs, lists, volume, color)
├── key-handler/     # Remote control key dispatch
├── provider/        # Providers (load, M3U/Xtream/Stalker)
├── commands/        # Push command handler (webhook commands)
├── app/             # Device + init helpers
└── index.ts         # Entry point, wires modules + window.* publish (concat last in MODULES)
```

<a id="device-detection"></a>

## Apparaatdetectie

De speler ondersteunt 24 apparaattypen. Detectie: eerst via URL `/f/{device_id}/`, daarna User-Agent.

| Apparaat-ID | Apparaat |
|---|---|
| `pc` | Pc-browser |
| `pc2` | videojs-webspeler |
| `nodejs` | Windows-app (Electron) |
| `lg/webos` | LG WebOS-tv's |
| `samsung/tizen` | Samsung Tizen-tv's |
| `samsung/maple` | Samsung Orsay-tv's |
| `mag` | Infomir MAG-boxen |
| `dune` | Dune HD-boxen |
| `android` | Android TV / tablets |
| `hbbtv` | HbbTV-tv's |
| `panasonic` | Panasonic Viera-tv's |
| `philips` | Philips-tv's |
| `sony` | Sony-tv's |
| `sharp` | Sharp-tv's |
| `toshiba` | Toshiba-tv's |
| `hisense` | Hisense-tv's |
| `skyworth` | Skyworth-tv's |
| `tcl` | TCL-tv's |
| `vewd` | Vewd-apparaten |
| `spark` | Spark-ontvangers |

<a id="push-command-system"></a>

## Pushopdrachtensysteem

Gebruik voor een afzonderlijke dienst met meerdere apparaten [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) en de sectie **Opdrachtserver** onder **Instellingen → Afstandsbediening**. Voer het IP/adres en de apparaattoegangscode van deze speler in; beide opslaan start automatisch pollen voor volume-, zender- en andere opdrachten. Een IP zonder poort gebruikt HTTP-poort 8081. Wis het adres of kies **Verbinding verbreken** om te stoppen. Deze uitgaande verbinding ondersteunt bevestigde aflevering en vereist geen lokale listener. Zie [verbinding en compatibiliteit](docs/remote-command-server.md). De voorbeelden hieronder beschrijven de bestaande lokale proxy-/listenermodus.

Met **Opdrachtserver zoeken** kunt u een controller vinden en goedkeuring van de beheerder aanvragen zonder een apparaattoken te kopiëren. Tauri controleert eerst het native DNS en kan bij een leeg resultaat terugvallen op een expliciet ingesteld implementatieprofiel; browser-, LG- en Capacitor-spelers gebruiken de browserprofielroute. De Home-detectiemetadata kunnen onafhankelijk van de controller op here.now worden gehost. Algemene builds bevatten dat Home-profiel niet automatisch en updates vervangen geen opgeslagen verbindingen. Zie [platformgedrag, profielinstelling en probleemoplossing](docs/remote-command-server.md#discovery-and-one-time-approval).

Lokale HTTP-afstandsbediening staat **standaard uit** in de browser-/OTT-server-speler, Tauri en Capacitor. Schakel deze in via **Spelerinstellingen → Afstandsbediening** om een geheime apparaatcode te genereren. Opdrachten zijn JSON-objecten met een veld `"command"`; HTTP-aanvragen vereisen `Authorization: Bearer <device-code>`.

<a id="architecture"></a>

### Architectuur

<a id="local-command-url-recommended"></a>

#### Lokale opdracht-URL (aanbevolen)

Schakel **Lokale HTTP-afstandsbediening** in via **Spelerinstellingen → Afstandsbediening**, kopieer de gegenereerde **Apparaatcode** en stel de proxy hieronder met die code in. Zet **Lokale opdracht-URL** op het opdrachtendpoint van de proxy. Terwijl dit actief is, pollt de speler die URL elke 10 seconden met de apparaatcode in de Authorization-header. Alleen een URL instellen schakelt opdrachtbediening niet in.

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### Apparaat-UUID

De bestaande apparaat-UUID (bijvoorbeeld `dev_a1b2c3d4e5`) is publieke routeringsmetadata, geen autorisatiegegeven. De afzonderlijke **Apparaatcode** wordt veilig gegenereerd bij het inschakelen van lokale HTTP-bediening en blijft op dit apparaat; hij wordt niet via cloudinstellingen gekopieerd. Uitschakelen stopt polling/listeners. Opnieuw inschakelen genereert een nieuwe code: werk proxy en integraties bij om de oude toegang in te trekken.

Tauri en Capacitor starten hun loopback-HTTP-listener pas na deze expliciete instelling. Doorstuurproxies moeten de getoonde apparaatcode als Bearer-token naar de listener sturen. Modus A gebruikt de hieronder beschreven, afzonderlijk ingestelde `local_proxy.py`-wachtrij.

<a id="remote-text-entry-swop"></a>

#### Tekstinvoer op afstand (swop)

Doel: op een telefoon typen voor ♥™ / het virtuele afstandstoetsenbord wanneer tv en telefoon op **verschillende netwerken** zitten, via sessieoverdracht door een Cloudflare Worker.

- Worker-repository: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop)
- **Installatieautorisatie:** de speler stuurt aanvragen naar de `/swop`-relay op dezelfde origin van zijn server. Die server voegt het privé-installatietoken toe; iedere client op de geregistreerde serverorigin kan tekst op afstand invoeren. Apparaat-UUID's identificeren sessies en vereisen geen toestaanlijst per apparaat.
- Instelling: `swopBaseUrl` (leeg = ♥™ toont 'niet ingesteld' / doet niets). Bewerk onder **Instellingen → Afstandsbediening** (toets **2**) of injecteer via het door Git genegeerde `/local/swop.json` bij operatorinstallaties
- `POST /session` bevat `clientId`, `caption` en `draft`; `POST /val` bevat `clientId`, `code` en het teruggegeven `sessionToken`. De telefoon-URL bevat een afzonderlijk schrijftoken. Leestokens van sessies blijven in het browsergeheugen.
- **Lokale installatie:** stel `SWOP_BASE_URL` en `SWOP_INSTALLATION_TOKEN` in nadat de installatie en exacte LAN-/localhost-origins bij de Worker geregistreerd zijn. `scripts/install-ottplay-local-service.sh` bewaart ze in zijn privé-launchd-plist met modus 0600. Publieke `/local/swop.json` bevat alleen `{"swopBaseUrl":"/swop"}`. Zet nooit een installatietoken in publieke bestanden.
- **Statische hosting:** stel een geauthenticeerde serverproxy in voor dezelfde twee endpoints. Bewaar het installatietoken in de geheimen van de hostingdienst. Publieke spelerbestanden kopiëren kopieert dit servertoegangsgegeven niet.

> De centrale OTT-server houdt `/api/webhook/commands`, `/webhook/poll`, `/webhook/notify` en opdracht-health-aliases voor elke HTTP-methode uitgeschakeld. Gebruik de afzonderlijke opdrachtserver of expliciet ingestelde, geauthenticeerde `local_proxy.py` voor Modus A; de centrale server heeft geen broadcastopdrachtwachtrij.

<a id="available-commands"></a>

### Beschikbare opdrachten

Alle voorbeelden hieronder gebruiken `http://192.168.1.50:8081/api/webhook/commands` als lokale proxy-URL. Vervang die door uw echte proxyadres en stel `OTTPLAY_QUEUE_HTTP_TOKEN` in op de **Apparaatcode** die verschijnt na inschakelen van HTTP-bediening in de spelerinstellingen. De proxy moet dezelfde code gebruiken.

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — Een melding tonen

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| Veld | Type | Standaard | Beschrijving |
|---|---|---|---|
| `message` | string | verplicht | Te tonen tekst |
| `popup_duration` | number | 5 | Aantal seconden tonen (rechtsboven) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — Zender wisselen volgens lijstpositie

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| Veld | Type | Standaard | Beschrijving |
|---|---|---|---|
| `channel_number` | number | verplicht | Zenderpositie in de lijst, beginnend bij 1 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — Zender wisselen volgens (gedeeltelijke) naam

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

Zoeken op deeltekst zonder onderscheid tussen hoofdletters. De eerste overeenkomst geldt.

| Veld | Type | Standaard | Beschrijving |
|---|---|---|---|
| `channel_name` | string | verplicht | Zendernaam of deel daarvan |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — Naar een willekeurige zender wisselen

Deze oudere opdracht kiest toegestane zenders uit de huidige lijst of categorie. Zendernummers en bereiken verwijzen naar posities in die lijst; zie de [regels voor veilige willekeurige selectie](docs/remote-command-server.md#safe-random-playback).

```bash
# Random from the current channel list
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"random_channel"}'

# Random from range (1-2000)
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"random_channel","random_range":[1,2000]}'
```

| Veld | Type | Standaard | Beschrijving |
|---|---|---|---|
| `random_range` | [start, end] | huidige lijst | Bereik beginnend bij 1 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — IPTV-provider wisselen

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| Veld | Type | Standaard | Beschrijving |
|---|---|---|---|
| `provider` | number | verplicht | Index in de providerarray (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — Nieuwe M3U-afspeellijst laden

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| Veld | Type | Standaard | Beschrijving |
|---|---|---|---|
| `playlist` | string | verplicht | URL van M3U-afspeellijst |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — Providerconfiguratie bijwerken

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| Veld | Type | Standaard | Beschrijving |
|---|---|---|---|
| `provider_settings` | string | verplicht | JSON-string met providerconfiguratie |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — Volume instellen of aanpassen

```bash
# Set absolute volume (0-100)
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"set_volume","volume":75}'

# Increase by 10
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"set_volume","volume_step":10}'

# Decrease by 5
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"set_volume","volume_step":-5}'
```

Wordt stilzwijgend genegeerd op clients zonder volumeregeling.

| Veld | Type | Standaard | Beschrijving |
|---|---|---|---|
| `volume` | number | — | Absoluut niveau 0-100 |
| `volume_step` | number | — | Relatieve wijziging, bijvoorbeeld +10 of -5 |

<a id="player-standby-restart-and-exit"></a>

#### Speler stand-by zetten, herstarten en afsluiten

De webhookwachtrij zonder bevestiging van de lokale proxy ondersteunt geen `exit_player` of getypeerde stand-by-/wekverzoeken. Verbind de speler met de [opdrachtserver](docs/remote-command-server.md) en gebruik diens CLI:

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

Vervang `d1` door uw geregistreerde speleralias. `stop` is een alias voor `standby`; `start` en `wake` zijn aliases voor `go`. Go vereist een actieve, verbonden speler; het kan geen gesloten app starten of offline apparaat wekken. Een browser of tv zonder native app-afsluiting meldt dat afsluiten niet wordt ondersteund. Stand-by houdt externe polling actief en pauzeert geen ongerelateerd werk van de host of gedeelde server.

Controleer na standby/go met `ott d1 status` de stand-by-/achtergrondstatus en controleer hervat afspelen afzonderlijk. Bevestig na herladen van de speler een nieuwe runtime met `ott d1 doctor`. Controleer na afsluiten via het OS of het appproces is gestopt; een externe timeout bewijst geen afsluiting. Opdrachtacceptatie alleen bevestigt deze resultaten niet.

<a id="local-proxy-server"></a>

## Lokale proxyserver

`local_proxy.py` is een zelfstandige geauthenticeerde opdrachtwachtrij voor één speler. Standaard sluit het programma af zonder een poort te openen. Elke proxyinstantie gebruikt de door de speler gegenereerde apparaatcode; gebruik aparte instanties/poorten voor meerdere spelers. Een queryparameter `device_id` wordt geaccepteerd als compatibiliteitsmetadata en authenticeert nooit en selecteert geen ander apparaat.

<a id="start-the-proxy"></a>

### De proxy starten

1. Schakel **Lokale HTTP-afstandsbediening** in de speler in en kopieer de **Apparaatcode**.
2. Stel op de proxyhost de code en exacte origin van de speler in (schema, host en poort, geen pad):

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. Zet de **Lokale opdracht-URL** van de speler op `http://192.168.1.50:8081/api/webhook/commands`.

Het standaard bind-adres is `127.0.0.1`; het voorbeeld schakelt LAN-toegang expliciet in. `OTTPLAY_QUEUE_HTTP_ORIGINS` is een kommagescheiden toestaanlijst van exacte browserorigins. Gebruik een HTTPS-reverse-proxy wanneer u de speler via HTTPS serveert, zodat browserregels voor gemengde inhoud polling toestaan. Houd de apparaatcode geheim en uit URL's. Herstart de proxy met de nieuwe waarde wanneer de speler een nieuwe code genereert; alleen de speler uitschakelen stopt geen afzonderlijk beheerd proxyproces.

<a id="endpoints"></a>

### Endpoints

| Methode | Pad | Beschrijving |
|---|---|---|
| `POST` | `/api/webhook/commands` | Een opdracht in de wachtrij plaatsen |
| `GET` | `/api/webhook/commands` | Wachtrijopdrachten ophalen (spelerpolling) |
| `POST` | `/webhook/notify` | Geauthenticeerde compatibiliteitsalias |
| `GET` | `/webhook/poll` | Geauthenticeerde compatibiliteitsalias |

Zowel verzenden als leeghalen vereist de overeenkomstige Bearer-apparaatcode. Er is geen ongeauthenticeerd broadcastendpoint. Opdrachten verlopen na 60 seconden; iedere proxy bewaart maximaal 50 opdrachten.

De proxy verwerkt maximaal 16 verbindingen tegelijk, zodat een inactieve browserverbinding of onvolledig verzoek andere opdrachten niet vertraagt. Elke socket heeft een inactiviteitstimeout van vijf seconden; extra verbindingen worden gesloten wanneer alle workers bezet zijn. Toevoegen aan en leeghalen van de wachtrij is atomair over workers heen.

<a id="smoke-script-all-modes"></a>

### Smoketestscript (alle modi)

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Android-emulator/-apparaat: eerst `adb forward tcp:18081 tcp:18081`. Cap/Tauri zijn alleen loopback — gebruik deze Modus A-proxy voor Home Assistant op de LAN. Details: `docs/capacitor-mobile.md` § Smoke test.

<a id="cors"></a>

### CORS

De proxy staat browseraanvragen alleen vanuit `OTTPLAY_QUEUE_HTTP_ORIGINS` toe. Preflight-`OPTIONS`-aanvragen van een toegestane origin vereisen geen token; elke echte GET/POST vereist de Bearer-apparaatcode. Wildcard- en `null`-origins worden niet geaccepteerd. Home Assistant en andere niet-browserclients mogen Origin weglaten, maar hebben nog steeds authenticatie nodig.

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### Voorbeeld: Home Assistant-webhook → lokale proxy → speler

```bash
# 1. Enable player HTTP control, then start the proxy with its code and origin as above.

# 2. In player settings, set Local command URL to:
#    http://192.168.1.50:8081/api/webhook/commands

# 3. Send commands from HA or curl:
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Motion detected!","popup_duration":5}'

curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"BBC"}'

curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"random_channel","random_range":[1,2000]}'
```

<a id="home-assistant-automation-examples"></a>

### Voorbeelden van Home Assistant-automatisering

De pop-up-, zender- en volumevoorbeelden gebruiken de lokale proxy. Stel `ottplay_device_authorization` in Home Assistant `secrets.yaml` in op `Bearer <device-code>` met de code die de ingeschakelde speler toont.

Nachtelijke stand-by gebruikt de afzonderlijke [opdrachtserver](docs/remote-command-server.md). Vervang de voorbeeld-URL en `DEVICE_UUID` hieronder door uw controlleradres en geregistreerde apparaat-ID; de lokale CLI-alias `d1` is geen apparaat-ID. Stel `ottplay_control_authorization` in op `Bearer <controller-admin-token>` in `secrets.yaml`. Dit toegangsgegeven staat los van de apparaatcode van de lokale proxy. Zie Home Assistant-documentatie voor [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) en [geheimen](https://www.home-assistant.io/docs/configuration/secrets/).

```yaml
rest_command:
  tv_command:
    url: "http://192.168.1.50:8081/api/webhook/commands"
    method: POST
    headers:
      Content-Type: application/json
      Authorization: !secret ottplay_device_authorization
    payload: >-
      {{ {'command': command} | combine(payload | default({})) | tojson }}
  tv_standby:
    url: "https://controller.example.com/ott-control/api/requests?device_id=DEVICE_UUID"
    method: POST
    headers:
      Authorization: !secret ottplay_control_authorization
    content_type: "application/json"
    payload: '{"action":"lifecycle","params":{"operation":"standby"}}'

automation:
  # Show popup when door opens
  - alias: "TV: Door alert"
    trigger:
      platform: state
      entity_id: binary_sensor.front_door
      to: "on"
    action:
      - service: rest_command.tv_command
        data:
          command: popup_message
          payload:
            message: "Front door opened!"
            popup_duration: 5

  # Switch to random channel in the evening
  - alias: "TV: Evening random channel"
    trigger:
      platform: time
      at: "20:00:00"
    action:
      - service: rest_command.tv_command
        data:
          command: random_channel
          payload:
            random_range: [1, 500]

  # Volume up
  - alias: "TV: Volume up"
    trigger:
      platform: event
      event_type: volume_up_button
    action:
      - service: rest_command.tv_command
        data:
          command: set_volume
          payload:
            volume_step: 10

  # Put the player in standby at night; keep remote control connected
  - alias: "TV: Night standby"
    trigger:
      platform: time
      at: "23:00:00"
    action:
      - service: rest_command.tv_standby
        response_variable: standby_request
```

`standby_request` bevat het HTTP-antwoord voor het automatiseringstracé. HTTP 202 betekent alleen in de wachtrij: bewaar `content.id` en poll daarna `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` met hetzelfde controllertoegangsgegeven voor het antwoord van de speler. Een nieuw `status`-verzoek observeert `player.standby` en `player.background`; actieve stand-by met `suspended` en nul wachtenden bevestigt dat het gevolgde spelerwerk is afgehandeld. Gebruik hetzelfde getypeerde verzoek met `"operation":"wake"` (`ott d1 go`) om stand-by te verlaten. Herhaal een wijziging niet blind na een timeout. Zie de [request/response-API](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) en [stand-bysemantiek](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake) van de controller.

<a id="server-api-reference"></a>

## Server-API-referentie

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Webhookendpoints (Rust `ottplay-server`)

De Rust-server en gearchiveerde Python-terugval weigeren opdrachtendpoints met HTTP 403. `/api/webhook/commands`, `/webhook/notify`, `/webhook/poll` en opdracht-health-aliases plaatsen, broadcasten of verwijderen geen opdrachten. De algemene feedback-API kan deze gereserveerde routes niet overschrijven. Modus A-opdrachtaflevering gebruikt de hierboven beschreven, afzonderlijk ingestelde opdrachtserver of geauthenticeerde lokale proxy.

<a id="other-endpoints"></a>

### Andere endpoints

| Methode | Pad | Beschrijving |
|---|---|---|
| `GET` | `/epg/<hash>.json` | EPG-gegevens voor zender |
| `GET` | `/logo/<id>.svg` | Gegenereerd zenderlogo |
| `GET` | `/version/<path>` | Versiehash van bestand |
| `POST` | `/m3u/match-channels` | Zender-EPG-koppeling |
| `POST` | `/m3u/match-logos` | Zenderlogokoppeling |
| `POST` | `/m3u/cp.php` | Streamproxy |
| `GET/POST` | `/feedback/` | Feedbacklogging |
| `GET` | `/tmdb/*` | TMDb-API-proxy |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## Projectstructuur

```
.
├── archive/
│   └── server.py          # Original Python server (frozen for STB fallback)
├── local_proxy.py         # Standalone local command proxy
├── index.html             # Player entry point (device detection + poller)
├── dist/
│   └── player.js          # Built player bundle (TypeScript → ES5, minified)
├── src/                   # TypeScript sources
├── devices/
│   ├── legacy-core.js     # Retained compatibility test oracle (not packaged)
│   └── {device}/device.js # Device adapters and key mappings
├── styles/player.css      # Responsive player interface and themes
├── locales/{language}.js  # 88 matching language catalogs, named in English
├── images/player-logo.png # Player startup logo
├── providers/             # Provider descriptions, logos and retained test oracles
├── js/                    # CDN libraries (HLS.js, Shaka, jQuery)
└── fonts/                 # Local fonts
```

<a id="stb-key-mappings"></a>

## STB-toetstoewijzingen

- **Samsung Tizen**: `RETURN=10009`, `ENTER=13`, kleuren 403-406
- **Samsung Maple**: dpad 4/5/6/8, oorspronkelijke SDK-codes
- **LG WebOS**: `RETURN=461`, HbbTV-compatibele kleuren
- **LG NetCast**: `RETURN=8`, HbbTV-codes
- **MAG**: `RETURN=8`, gSTB-API voor MAC
- **Dune HD**: standaardcodes, Dune-API
- **Android TV**: Android-toetscodes (`BACK=4`, `DPAD_*` 19-22, `ENTER=66`)
- **HbbTV/Panasonic/Philips/Sony/enz.**: HbbTV-codes (`RED=403`, `BLUE=406`, `VOL_UP=447`)

<a id="documentation"></a>

## Documentatie

- [Documentatiewiki](./docs/wiki/Home.nl.md) / [Wiki in het Russisch](./docs/wiki/Home.ru.md) — taakgerichte navigatie en onderhoudsregels.
- [Implementatierapport](./docs/implementation-report.nl.md) / [Proces en resultaat in het Russisch](./docs/implementation-report.ru.md) — gekleurde diagrammen, gecontroleerd gedrag, gemeten kosten en releasevoorwaarden.
- [Opleveringsgids](./docs/roadmap-delivery.nl.md) / [Nieuwe functies in het Russisch](./docs/roadmap-delivery.ru.md) — functies, beperkingen en verificatie.
- [Snelstartgidsen in 88 interfacetalen](./docs/readme/README.md) — gegenereerd uit geleverde UI-vertalingen; de hoofdhandleiding en gekoppelde functiegidsen zijn beschikbaar in [24 documentatietalen](docs/manual-translations.md).
- [Kwaliteitsgrenzen en liveherstel](./docs/playback-stream-policy.nl.md) / [In het Russisch](./docs/playback-stream-policy.ru.md).
- [Handmatige XMLTV-koppeling en klassieke toegankelijkheid](./docs/guide-binding-accessibility.nl.md) / [In het Russisch](./docs/guide-binding-accessibility.ru.md).
- [Gehoste audio-/videocontrole](./docs/audio-video-check.nl.md) / [In het Russisch](./docs/audio-video-check.ru.md).
- [Xtream-mediabibliotheek](./docs/xtream-media.nl.md) / [In het Russisch](./docs/xtream-media.ru.md).
- [Apparaatoverdracht van dezelfde bron](./docs/remote-handoff.nl.md) / [In het Russisch](./docs/remote-handoff.ru.md).
- [Herstelbare lokale instellingen](./docs/settings-recovery.nl.md) / [In het Russisch](./docs/settings-recovery.ru.md).
- [Browsergeneraties, besturingssystemen en exacte releasekandidaatcontroles](docs/browser-compatibility.nl.md) / [In het Russisch](docs/browser-compatibility.ru.md).

- [Spelerarchitectuur](./docs/architecture.md) — runtimeverantwoordelijkheden, providerintegratie, afspelen, gids, apparaatadapters en bouwcontracten.
- [Klassieke ES5-bouwpijplijn](./docs/build-pipeline.md) — compilatie, compatibiliteitscontroles en limieten voor artefactgrootte.
- [Runtimebestandsnamen en installatiemigratie](./docs/asset-layout.md) — beschrijvende paden gedeeld door web- en native pakketten.
- [Werkbank op afstand](./docs/remote-workbench.md) — UI-/media-inspectie, operatiebewijzen en opgeslagen bewijs.
- [Runtimediagnostiek](./docs/runtime-debug.md) — foutgeschiedenis, frame-/lustellers, native Capacitor-/Tauri-metingen en serverdebugging.
- [Lokale macOS-oplevering](./docs/macos-local-delivery.md) — checkoutbuilds, lokale installatie en verificatie.

<a id="license"></a>

## Licentie

[MIT](LICENSE) — vrij en opensource. Providerinhoud en afhankelijkheden van derden behouden hun eigen rechten en licenties.

De afzonderlijke toepassing [OTTPlay native webOS](docs/native-webos.md), afgeleid van PlxNative, wordt onder **GPL-3.0-or-later** verspreid met de bijbehorende broncode.
De MIT-licentie in de hoofdmap wijzigt de licentie van deze native toepassing of de bijbehorende patches niet.

<a id="desktop-updater--notarization-mode-b"></a>

## Desktopupdater / notarisatie (Modus B)

De [gids voor desktopondertekening en updater](docs/tauri-updater-notarize.md) beschrijft macOS-ad-hoc-ondertekening, optionele Developer ID/notarisatie en bundelverificatie. Release-CI gebruikt ad-hoc ondertekening zonder Apple-gegevens. Updaterondertekening staat daar los van; automatische productie-updates zijn nog niet ingesteld.

<a id="local-mac-build-helpers"></a>

## Hulpmiddelen voor lokale Mac-builds

Zie [docs/local-build-scripts.md](docs/local-build-scripts.md).

<a id="privacy"></a>

## Privacy

Lees het [privacybeleid](docs/privacy-policy.md) voor informatie over lokale instellingen, ingestelde diensten en uw keuzes. Privacy- en ondersteuningscontact: [alvit.work@gmail.com](mailto:alvit.work@gmail.com).

Studio 2026 is het standaardinterfacethema. Classic en PLi-HD blijven beschikbaar en opgeslagen voorkeuren blijven behouden. Zie [interface-instellingen](docs/interface-settings.md). Het PLi-HD-thema vermeldt Vali, littlesat, VU+NL, Milo en upstreambijdragers als makers. Zie [interfacecredits en ontwerpgeschiedenis](docs/interface-history.md) voor de Engelstalige geschiedenis en bronlinks, ook bereikbaar via het informatiemenu van de speler.

<a id="demo-video-editing"></a>

## Demovideo's bewerken

Gebruik de lokale [video-use-workflow](docs/demo-video.md) om demonstratieopnamen voor te bereiden en te bewerken. Het hulpmiddel houdt alle gegenereerde media buiten Git.

<a id="plex-media-library"></a>

## Plex-mediabibliotheek

Elke speler kan via de provider **Plex** verbinding maken met een Plex-account of Plex Media Server. De integratie gebruikt Plex; Synology is één mogelijke host voor de mediaserver. Alle beschikbare video’s en muzieknummers verschijnen automatisch in de zenderlijst; de categoriekeuze filtert op bibliotheek, map of serie. Afspelen start vanaf de eerste bruikbare batch, met achtergrondladen, standaardzoeken en Acties voor shuffle/herhalen, zonder Plex op de OTT-server in te stellen. Zie [Plex-aanmelding en rechtstreeks afspelen](docs/plex-provider.md).

![Levenscyclus van Plex-laden, bestandsnavigatie en afsluiten](docs/images/plex-playback-lifecycle.svg)

De [geïllustreerde betrouwbaarheidsanalyse](docs/plex-provider.md#reliability-review-process-and-results) legt laad- en annuleringsregels uit, correcties voor volledige catalogi en bestandswissels, en gemeten Chromium-/WebKit-validatieresultaten.

<a id="related-repositories"></a>

## Gerelateerde repositories

- [ottplay-core](https://github.com/open-ott-play/ottplay-core) beheert de gedeelde JVM-/ES5-domeinlogica, communicatiecontracten en FOSS2-client. Deze speler gebruikt gegenereerde artefacten; volg de core-opleveringsgids voor gedeelde wijzigingen.
- [ottplay-android](https://github.com/open-ott-play/ottplay-android) is de afzonderlijke native Kotlin/Compose-app met eigen installatie- en release-identiteit.
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server) biedt zelfgehoste externe opdrachten; [ottplay-swop](https://github.com/open-ott-play/ottplay-swop) biedt optioneel Worker-gebaseerd tekstinvoertransport.
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine) beheert het gehoste profiel van de browserdemo, demomedia en publicatieverificatie.

<a id="project-maintenance"></a>

## Projectonderhoud

Zie [bijdrage- en testvereisten](CONTRIBUTING.md), het [beleid voor beveiligingsmeldingen](SECURITY.md), het [beveiligingsontwerp](docs/security-design.md) en het [OpenSSF-bewijs en resterende criteria](docs/openssf-evidence.md).
