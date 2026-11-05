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

Lokale Dateien ohne Internet: siehe [Lokale Videos und Offline-Wiedergabe](docs/offline-media.md).

[![OTT-play-FOSS-Kanalliste in perspektivischer Ansicht](docs/images/hero.png)](docs/images/studio-2026-default.png)

*Screenshot der vorhandenen Studio-2026-Oberfläche mit synthetischen Kanal- und Programmbeispielen. Öffnen Sie das Bild für die ursprüngliche flache Ansicht; es zeigt kein aktives Abonnement. [Bildquelle und erneute Erstellung](docs/images/README.md).*

[Kurzanleitungen in 88 Sprachen](docs/readme/README.md) · [Dokumentationswiki](docs/wiki/Home.de.md)

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![Fuzzing: nur RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

Öffentliche Release Candidates führen begrenzte, isolierte Fuzzing-Kampagnen für die native/serverseitige XMLTV-Verarbeitung und die Validierung von Portalanfragen aus. Siehe [Fuzzing-Umfang, Reproduktion und Release-Nachweise](FUZZING.md).

Eigenständiger IPTV/OTT-Player mit lokalem Rust-HTTP-Server. Läuft auf Smart-TVs (LG WebOS, Samsung Tizen, Panasonic, Sony usw.), Set-Top-Boxen (Infomir MAG, Dune HD, Enigma2, Android TV) und in Desktop-Browsern.

Beginnen Sie mit dem [Architektur- und Beitragsleitfaden](docs/architecture.md) zu Laufzeitschichten, Zuständigkeiten, Provider-Erweiterungen und Prüfungen. [Wiedergabesitzungen und Provider-Lebenszyklen](docs/playback-session-architecture.md) beschreiben die Grenze zwischen Kern und Host sowie die Kompatibilitätsverträge.

<!-- ci-release-process:start -->
<a id="release-process"></a>

## Release-Prozess

Die [Release-Strategie](RELEASING.md) beschreibt Validierung sowie Nightly-, Beta-, RC- und Stable-Freigaben; lokale Befehle stehen im [Betriebshandbuch](docs/release-workflow.md).
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## Im Browser ausführen

Öffnen Sie die [Live-Demo](https://player.ottplay.here.now/) oder erstellen und hosten Sie den Webplayer mit den folgenden Anweisungen.

Die [lokale macOS-Bereitstellung](docs/local-http-deployment.md) stellt HTTP-Player-Origins auf den Ports 8443–8446 bereit. Port 8095 wird nicht mehr verwendet.

Wählen Sie beim ersten Start **Demo ausprobieren**, um das bewegte Testbild abzuspielen, oder konfigurieren Sie eine eigene M3U-Playlist beziehungsweise einen Provider. Die Demo ist später auch über **Provider wechseln → Demo** erreichbar.

Der Demomodus benötigt Internet, aber kein Provider-Konto. Seine stummen MP4- und HLS-Testkanäle liegen auf here.now und werden von Webplayer, Tauri, Capacitor und OTT Server gemeinsam genutzt. Vorhandene Provider-Einstellungen bleiben beim Wechsel erhalten. Für eine separate **Bild-und-Ton-Prüfung** öffnen Sie **Informationen → Audio → Abspielen** bei der verwalteten HTML5-Engine im Leerlauf oder während Live-TV. Dabei wird das hörbare Testmedium `av-v1.mp4` auf here.now verwendet; Internet ist erforderlich. Der Clip ist nicht in Player-Paketen enthalten und wird niemals beim Start geladen. VOD, Archiv und gerätespezifische Engine-Überschreibungen (einschließlich PC2/Video.js und nativer Engines) sind ausgeschlossen; siehe [Schritte, erwartete Töne und Hosting-Diagramm](docs/audio-video-check.de.md).

Installierte Desktop-Browserfenster unterstützen **Window Controls Overlay**: Chrome kann die separate Titelleiste ausblenden und Fensterknöpfe sowie App-Menü über dem Player belassen. Öffnen Sie die installierte App und wählen Sie **Titelleiste ausblenden**, wenn Chrome dies anbietet; **Titelleiste anzeigen** stellt den normalen Rahmen wieder her. Normale Tabs sowie TV-/native Shell-Layouts behalten ihr Verhalten. Unterstützte Installations-URLs, die Aktualisierung vorhandener Verknüpfungen und Prüfungen stehen unter [Browser-Fenstersteuerung](docs/browser-window-controls.md).

Zum Springen um zehn Sekunden in der Hauptvideoansicht verwenden Sie **Alt/Option + Links/Rechts** (unter macOS auch **Command + Links/Rechts**), im Vollbild oder normalen Fenster. Lokale Videos, VOD und unterstützte Kanalarchive verwenden dieselbe Steuerung in Web, Tauri und Capacitor. Siehe [Tastenkürzel und Grenzen](docs/browser-window-controls.md#playback-keyboard-shortcuts).

In der PC-Oberfläche spielt **R** einen zufälligen anderen Kanal oder ein anderes Video aus der aktuellen Liste ab, ohne deren Reihenfolge zu ändern. Das funktioniert in der Hauptvideoansicht und in Kanal-/Videolisten; Texteingaben, Dialoge, Einstellungen und Kiosk-Beschränkungen haben weiterhin Vorrang. Andere Gerätetastenbelegungen bleiben unverändert.

Das synthetische Testbild lässt sich mit `scripts/generate-demo-media.sh` neu erzeugen (FFmpeg erforderlich); erzeugte Medien bleiben im ignorierten Verzeichnis `.local-artifacts`.

<a id="features"></a>

## Funktionen

- **Wiedergabe**: HLS-, DASH- und einfache HTTP-Streams mit verwalteten HLS.js-/Shaka-Qualitätsobergrenzen, begrenzter Wiederherstellung und bis zu drei ausdrücklich angegebenen Ersatz-URLs pro Live-Kanal. Archiv/VOD wechseln niemals auf einen Live-Ersatz; siehe [Qualität und Wiederherstellung](docs/playback-stream-policy.de.md).
- **EPG**: XMLTV-Zuordnung, Zeitversatz/Catch-up, Suche nach Sendungstiteln (N5 im EPG), Erinnerungen und manuelle Feed-/ID-Bindung für einen bestimmten Kanal im gehosteten/nativen XMLTV-Pfad. Siehe [Bindung und Barrierefreiheit](docs/guide-binding-accessibility.de.md).
- **Favoriten**: eine geordnete [gemischte Sammlung](docs/mixed-favorites.md) über konfigurierte Anbieter und Profile auf unterstützten Geräten, mit übertragbarem CLI-Export/-Import; Jugendschutz-PIN. Im Rückfallmodus bleiben Favoritenlisten je Quelle verfügbar.
- **Einstellungen**: JSON-Export/-Import von Einstellungen und Favoriten, Rückgängig-Journal für unterstützte localStorage-Änderungsgruppen, quellenspezifische Archivfortsetzung und exakter Vergleich gespeicherter Einstellungen für Controller-Abläufe. Die Wiederherstellung setzt einen einzelnen Schreiber voraus; eigene Speicheradapter behalten eine bestmögliche Rücknahme. Siehe [Einstellungswiederherstellung](docs/settings-recovery.de.md).
- **Gemeinsame Oberfläche**: OTT Server, Tauri und Capacitor verwenden dieselben Kanallisten-Themes und Sichtbarkeitseinstellungen. Oberflächeneinstellungen steuern Hervorhebungs- und Auswahlfarben; Kanallisteneinstellungen steuern Kanalnamen, Picons, aktuelle Sendungen, Fortschritt und Archivmarkierungen.
- **Provider**: M3U/M3U8, Xtream-Live-TV mit [Film-/Serienkatalogen auf Abruf](docs/xtream-media.de.md), Stalker/Ministra mit [Filmen und verschachtelten Episoden](docs/stalker-media.md), Plex und VPortal. Provider-Fähigkeiten und Kontozugriff bestimmen verfügbare Archiv- und Mediathekfunktionen.
- **Push-Befehle**: Fernsteuerung per Webhook — Kanal, Provider und Playlist wechseln sowie Pop-ups anzeigen.
- **Ferne Texteingabe (swop)**: Telefontastatur über Cloudflare Worker, wenn TV und Telefon in verschiedenen Netzen sind (für die Installation autorisierte Sitzungen; ♥™ auf der virtuellen Tastatur).
- **Geräterouting**: UUID-basierte Adressierung für mehrere Geräte.
- **Lokaler Proxy**: optionaler lokaler Befehlsserver für vollständig lokale Automatisierung (kein zentraler Server nötig).
- **Controller-Integration**: auf Geräte/Aktionen beschränkte Operatoren, optional dauerhaft gespeicherte Befehlsergebnisse, fortsetzbare Anwendung von Local-/Home-Profilen und Live-/Archivübergabe derselben Quelle über den passenden [Control Server](https://github.com/open-ott-play/ottplay-control-server). Dies erfordert den aktualisierten Controller/die CLI und wird nicht von einem einzelnen Browser-Tab bereitgestellt.
- **Typisierte Ferneinstellungen**: verfügbare Einstellungen ermitteln, gespeicherte und wirksame Werte lesen und mit Prüfung von Laufzeitinstanz, Quelle und Revision speichern; siehe [Ferneinstellungen und VPortal-Konfiguration](docs/remote-player-settings.md).
- **Debugging**: optionales Wiedergabe-HUD/Ringprotokoll über `?debug=1`, Ferninspektion mit Zustimmung und gehostete Audio-/Videoprüfung auf Abruf.
- **Tastaturzugänglichkeit**: benannte klassische Dialoge, eingeschlossener und zurückkehrender Tab-Fokus, Semantik des ausgewählten Kanals und zurückhaltende Statusansagen. Diese Verbesserungen belegen keine vollständige WCAG- oder Geräte-Screenreader-Konformität.
- **24 Gerätetypen**: gerätespezifische Fernbedienungsbelegung.
- **88 Oberflächensprachen**: passende Kataloge, [lokalisierte Kurzanleitungen](docs/readme/README.md) und [gegen CLDR geprüfte Tastaturalphabete](docs/localization.md). Haupthandbuch und zugehörige Funktionsleitfäden sind in [24 Dokumentationssprachen](docs/manual-translations.md) verfügbar; andere technische Referenzen behalten ihre bisherigen Sprachen.

Der [Funktions- und Auslieferungsleitfaden](docs/roadmap-delivery.de.md) beschreibt den in dieser Quellrevision umgesetzten Funktionsumfang, Plattformgrenzen, Diagramme und Prüfungen. Installierte Releases oder gehostete Bereitstellungen können einen älteren Stand verwenden. Die unabhängige native [Android-App](https://github.com/open-ott-play/ottplay-android) speichert Audio-/Untertitelauswahlen ebenfalls nach Sprache, Rolle und Bezeichnung statt nach Manifestindizes; Implementierung und Release sind von diesem Frontend getrennt.

Der [STB-Quellenvergleich](docs/stb-player-improvements.md) erläutert die Verbesserungen bei Medien, Ressourcennutzung und Wiederherstellung, ihre Quellvergleiche und die aktuellen Grenzen.

<a id="debug-hud"></a>

## Debug-HUD

Lokales HUD und dauerhafte Serverprotokolle werden getrennt aktiviert. Lesen Sie vor dem Sammeln fremder Geräteprotokolle [Diagnosezugriff, Schwärzung und Aufbewahrung](docs/diagnostic-security.md).

Aktivieren Sie den Debugmodus auf eine der folgenden Arten:
- URL: `?debug=1` oder `?debug=true`.
- Lokaler Speicher: `localStorage.setItem("ottplay_debug", "1")`.
- Fenstereigenschaft: `window.__OTT_DEBUG__ = true`.
- Server: wenn `/debug/config` den Wert `{enabled: true}` zurückgibt.

Bei aktiviertem Debugmodus:
- **D** schaltet die HUD-Leiste um (`ottDebugSetHud` / `__ottDebug.toggleHud()`).
  - Wird bei Fokus in INPUT/TEXTAREA/listEdit übersprungen.
  - Verwendet `e.key`, um den Konflikt mit MAG/Maple PLAY/PREV=68 zu vermeiden.
- Info-Menü → **Debug HUD** → ruft `__ottDebug.toggleHud()` auf.
- Einstellungen verwalten → **Debug HUD**:
  - Debug bereits geladen: schaltet die HUD-Sichtbarkeit um.
  - Sonst: setzt `ottplay_debug=1` + `ottplay_debug_hud=1` und fordert einen Neustart an.
- Speicherung: `ottDebugSetHud` speichert den HUD-Zustand in `localStorage.ottplay_debug_hud` ("1"/"0").

<a id="capacitor-ios-and-android"></a>

## Capacitor für iOS und Android

Dieses Repository verpackt das gemeinsame TypeScript-Frontend mit Capacitor für iOS und Android 7+. Beide verwenden Systemschriften und die durch npm festgelegte native Laufzeit. Ein separates API-22-Kompatibilitäts-APK unterstützt Android 5.1/6 mit WebView 60 oder neuer. Beide Android-APKs sind signiert und gehören zusammen mit dem unsignierten iOS-IPA zu qualifizierten Beta-, RC- und Stable-Releases. Die unabhängige Kotlin-App bleibt in [ottplay-android](https://github.com/open-ott-play/ottplay-android).

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

Siehe [Capacitor-Konfiguration](docs/capacitor-mobile.md) sowie [Android-Verteilung und Fernaktualisierungen](docs/android-distributions.md).

Die iOS-Oberfläche verwendet Querformat. Einstellungen, Provider-Konfiguration, Zustimmung zur Fernsteuerung sowie JSON-Import/-Export verwenden weiterhin das gemeinsame Frontend. Tablet-Multitasking kann die gewünschte Ausrichtung überschreiben.

Wischen Sie auf dem iPhone vertikal über die Kanalliste, um durch Zeilen und Seiten zu gehen: nach oben zu späteren, nach unten zu früheren Kanälen. Ein schneller Wisch läuft über mehrere Seiten weiter und bremst ab; langsames Ziehen bleibt präzise. Berühren Sie den Bildschirm oder drücken Sie eine Navigationstaste, um die Bewegung anzuhalten. Ein einzelnes Tippen startet den Kanal unter dem Finger, auch wenn eine andere Zeile markiert ist. Ein Wischen öffnet beim Loslassen niemals einen Kanal.

Videos spielen auf dem iPhone innerhalb der Oberfläche. Tippen Sie unten für Programminformationen oder öffnen Sie während der Wiedergabe das Menü. Bild-in-Bild bleibt eine separate Wiedergabeoption.

Geräteprüfung: [Modus-B-Checkliste](docs/mode-b-device-smoke.md) und `./scripts/smoke-capacitor-device.sh --help` (Build-/Sync-Ziel nur iOS). Tauri-Desktopprüfung: [Desktop-Checkliste](docs/mode-b-tauri-smoke.md).

<a id="installation"></a>

## Installation

| Plattform | Paket | Hinweise |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Getrennte Apple-Silicon- und Intel-Builds; ad-hoc-signiert, sofern keine Apple-Signierung eingerichtet ist |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | Verschiedene Distributionen |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode oder Homebrew Channel](docs/lg-webos-installation.md); gehosteter Player, Netzwerk erforderlich |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode und lokale Signierung; unsigniertes TV-Paket, getrennt von Family Hub](docs/samsung-tizen-installation.md) |
| **iOS** | `.ipa` über AltStore / TestFlight / Xcode | Nur Sideloading — noch nicht im App Store |
| **Android (gemeinsames Frontend)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | Signierte Capacitor-Pakete; passende Android-Version wählen |
| **Android (natives Kotlin)** | Separate [native App](https://github.com/open-ott-play/ottplay-android) | Öffentliches Repository; eigene App und eigener Release-Ablauf |

Unterstützte Installationspakete sind qualifizierten GitHub-Releases beigefügt: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **Hinweis:** macOS-App-Bundles verwenden ohne Apple-Signierungsdaten eine Ad-hoc-Signatur; diese bietet weder Developer ID noch Notarisierung. Windows-/Linux-Installationspakete und iOS-Releasepakete können unsigniert sein. iOS benötigt vor der Installation auf einem physischen Gerät eine Signierung. Qualifizierte Android-Release-APKs für Full und API 22 verwenden das etablierte Signierungszertifikat; lokale Release-Builds brauchen einen konfigurierten Keystore, um signierte APKs zu erzeugen.

---

<a id="macos"></a>

### macOS

1. Wählen Sie den gewünschten Tag unter [Releases](https://github.com/open-ott-play/ottplay-foss/releases). Die Verknüpfung zum neuesten Release wählt Stable, nicht Beta oder RC.
2. Laden Sie `OttPlay.FOSS_*_aarch64-apple-darwin.dmg` für Apple Silicon oder `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` für Intel herunter. Es sind getrennte Architektur-Builds.
3. Öffnen Sie die `.dmg` und ziehen Sie **OttPlay FOSS.app** nach Programme.
4. Prüfen Sie das kopierte Bundle vor dem ersten Start:

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

Eine erfolgreiche Prüfung bestätigt die Bundle-Integrität. `Signature=adhoc` bedeutet, dass die App keine von Apple authentifizierte Entwickleridentität besitzt; dies belegt weder Notarisierung noch Gatekeeper-Freigabe. Bei vertrauenswürdigem Download und gültigem Bundle kann macOS nach dem ersten Startversuch dennoch **Systemeinstellungen → Datenschutz & Sicherheit → Dennoch öffnen** verlangen; siehe [Apple-Anleitung](https://support.apple.com/en-us/102445).

Die Meldung „App ist beschädigt“ belegt nicht allein ein Quarantäneproblem. Schlägt die Signaturprüfung fehl, bewahren Sie den Fehler auf und beziehen Sie ein korrigiertes Release. Signieren Sie die heruntergeladene App nicht neu und entfernen Sie keine Attribute, um eine fehlgeschlagene Prüfung erfolgreich erscheinen zu lassen.

ZIP-Alternativen sind `OttPlay.FOSS_aarch64-apple-darwin.app.zip` und `OttPlay.FOSS_x86_64-apple-darwin.app.zip`. Entpacken, Disk-Image- und Gatekeeper-Prüfungen stehen unter [macOS-Signierung und Artefaktprüfung](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact). Für Builds aus dem Checkout und lokale Installation siehe [lokale macOS-Auslieferung](docs/macos-local-delivery.md).

---

<a id="windows"></a>

### Windows

1. Laden Sie `.msi` oder `.exe` unter [Releases](https://github.com/open-ott-play/ottplay-foss/releases/latest) herunter.
2. Starten Sie das Installationsprogramm und folgen Sie den Hinweisen.
3. Starten Sie über Startmenü oder Desktop-Verknüpfung.

---

<a id="linux"></a>

### Linux

Linux-Wiedergabe benötigt zusätzlich zu WebKitGTK GStreamer-Plug-ins für HLS, H.264 und AAC. Die Pakete deklarieren diese Medienabhängigkeiten; AppImage-Builds enthalten das Medienframework. Codec-Prüfungen und die Unterscheidung zwischen Browser- und nativer Abnahme stehen unter [Linux-Medienpaketierung](docs/linux-media-packaging.md).

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

### iOS-Installation

iOS benötigt vor der Installation auf einem physischen Gerät eine Signierung. Verwenden Sie AltStore Classic für das unsignierte Release-IPA oder bauen und signieren Sie den Quellcode mit Xcode. TestFlight benötigt, sofern angeboten, eine separate Einladung.

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### Option 1: AltStore Classic (für persönliche Nutzung empfohlen)

AltServer läuft auf Ihrem Computer; AltStore Classic läuft auf iPhone/iPad und importiert das IPA. Ein kostenloser Apple Account reicht aus.

**Voraussetzungen:**

- iPhone/iPad mit **iOS/iPadOS 15 oder neuer** für den aktuellen OTT-play-Build.
- Mac oder Windows-PC mit AltServer und USB-Datenkabel.
- Apple Account zur Signierung und Internetzugang zum Herunterladen des Releases.

**Schritt 1: AltStore einmalig einrichten**

1. Installieren Sie AltServer nach der offiziellen [macOS-Anleitung](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) oder [Windows-Anleitung](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows). Starten Sie ihn und verwenden Sie sein Menüleisten-/Infobereichsymbol.
2. Verbinden Sie das Gerät per USB, entsperren Sie es und bestätigen Sie die Vertrauensabfragen auf Computer und Gerät. Prüfen Sie auf einem Mac, ob das Gerät im Finder erscheint.
3. Wählen Sie im **AltServer-Menü → Install AltStore** Ihr Gerät und folgen Sie den Abfragen für das Signierungskonto. Warten Sie auf die Installationsmeldung.
4. Öffnen Sie am Gerät **Einstellungen → Allgemein → VPN & Geräteverwaltung** und vertrauen Sie bei Aufforderung dem Entwicklereintrag Ihres Signierungskontos. Aktivieren Sie unter iOS 16+ **Einstellungen → Datenschutz & Sicherheit → Entwicklermodus** und führen Sie Neustart und Bestätigungen aus.
5. Öffnen Sie AltStore am Gerät. Ist er bereits installiert und funktionsfähig, überspringen Sie diese Einrichtung und lassen Sie AltServer für den folgenden Import laufen.

**Schritt 2: Gewähltes Release auf iPhone/iPad importieren**

1. Wählen Sie einen exakten Tag aus [allen Releases](https://github.com/open-ott-play/ottplay-foss/releases) und laden Sie dessen `ottplay-foss-ios-unsigned.ipa` in Safari auf dem Gerät herunter. Die [Verknüpfung zum neuesten Release](https://github.com/open-ott-play/ottplay-foss/releases/latest) wählt ein stabiles Release; verwenden Sie für Beta die vollständige Liste.
2. Speichern Sie das IPA in Dateien. Wählen Sie diese Datei unter **AltStore → My Apps → +**. Sie können ein heruntergeladenes IPA auch per AirDrop vom Mac übertragen und vor dem Import in Dateien speichern. Das Öffnen des IPA auf dem Mac ist nicht dieser Importschritt.
3. Lassen Sie AltServer laufen und das USB-Kabel angeschlossen, während AltStore signiert und installiert. Verwenden Sie bei einem Update dasselbe Signierungskonto wie für die vorhandene Installation; löschen Sie die App nicht als ersten Fehlerbehebungsschritt.
4. Warten Sie auf das Ende des Imports, prüfen Sie OTT-play unter **My Apps** und starten Sie es.

**Alternative: Release-URL direkt importieren**

Geben Sie bei bereits installiertem AltStore dieses Muster in **Safari auf dem iPhone** ein, ersetzen Sie `TAG` durch den exakten Release-Tag und bestätigen Sie **Open in AltStore**:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

Dies verwendet AltStores [Installations-URL-Handler](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift). Es vermeidet einen mehrdeutigen Dateien-/Zuletzt-verwendet-Eintrag bei mehreren Downloads mit gleichem Namen. Die URL muss auf das IPA-Artefakt zeigen, nicht auf die Release-Seite.

Der folgende Import wurde beispielsweise am **2026-09-29** mit AltStore 2.3 und AltServer 1.8.1 geprüft. Dies ist ein festes historisches Beispiel, kein Link auf die neueste Version:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**Erneuern:** Installationen mit kostenlosem Konto laufen nach sieben Tagen ab. Halten Sie AltServer erreichbar und verwenden Sie vor Ablauf **AltStore → My Apps → Refresh All**. Auch die Hintergrundaktualisierung braucht Zugriff auf AltServer; siehe [AltStores Anleitung zur Erneuerung](https://faq.altstore.io/altstore-classic/your-altstore).

<a id="verify-the-installed-version-before-retrying"></a>

#### Installierte Version vor erneutem Versuch prüfen

Eine AirDrop-Meldung „Gesendet“ bestätigt nur die Übertragung. Ein AltStore-Fortschrittsbalken bestätigt den Beginn des Imports. Eine unterbrochene Mirroring-/USB-Verbindung belegt keine fehlgeschlagene Installation: prüfen Sie die installierte App, bevor Sie das IPA erneut senden.

Auf einem Mac mit installiertem Xcode, das als aktives Entwicklerverzeichnis ausgewählt ist, prüfen Sie das Gerät ohne Neuinstallation:

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

Suchen Sie OTT-play in `result.apps` des JSON (`bundleIdentifier` beginnt mit `play.ott.foss`) und vergleichen Sie sowohl `version` als auch `bundleVersion` mit `CFBundleShortVersionString` und `CFBundleVersion` des gewählten IPA. Ein AltStore-Signierungskonto-Suffix am Bundle-Identifier ist normal. Bewahren Sie den Gerätebericht lokal auf.

Das geprüfte beta.9-Beispiel meldet **Version `1.1.51`, Build `2.2.66`**. Dies bestätigt die Installation; App-Start, Cloudflare-Anmeldung, Playlist-Laden, Wiedergabe und PiP sind separate Geräteprüfungen.

<a id="troubleshooting-ios-installation"></a>

#### Fehlerbehebung bei der iOS-Installation

- **AltServer hat kein Fenster oder automatisiertes Öffnen läuft in ein Timeout:** verwenden Sie das Menüleisten-/Infobereichsymbol. Es ist eine Hintergrund-App. Wiederholtes Öffnen eines normalen App-Fensters führt keinen IPA-Import aus.
- **„Could not find AltServer“ oder USB-Gerät nicht verfügbar:** prüfen Sie, ob AltServer läuft, entsperren Sie das Telefon und prüfen Sie die Vertrauensabfragen. Kontrollieren Sie auf einem Mac die Sichtbarkeit im Finder. Stellen Sie eine verlorene Verbindung sicher wieder her und prüfen Sie vor einem erneuten Versuch die installierte Version. Folgen Sie bei anhaltenden Problemen [AltStores Verbindungsfehlerbehebung](https://faq.altstore.io/altstore-classic/troubleshooting-guide). Liefert das Telefon die Internetverbindung des Computers, koordinieren Sie Kabel- oder Netzänderungen, damit andere Arbeit nicht unterbrochen wird.
- **iPhone-Synchronisierung meldet „iPhone in Use“ oder bleibt bei „Connecting“:** beenden Sie die Einrichtung am physischen Telefon oder sperren Sie dessen Bildschirm und lassen Sie es zum Spiegeln in der Nähe des entsperrten Mac. Entsperren des Telefons beendet Mirroring; USB-Vertrauen/-Einrichtung kann vorher ein entsperrtes Gerät verlangen. Stockt auch ein erneuter Verbindungsversuch, beenden Sie Mirroring und arbeiten Sie am Telefon weiter. Siehe [Apples Mirroring-Voraussetzungen](https://support.apple.com/en-us/120421). Mirroring ist für die Installation optional.
- **Eine URL verliert lateinische Buchstaben oder wird bei Mirroring kyrillisch:** stellen Sie die **Mac-Eingabequelle auf ABC/Englisch**. Drücken Sie bei fokussiertem Mirroring **Control–Leertaste** und wählen Sie **English (US)** für die iPhone-Hardwaretastatur. Mac und iPhone können unterschiedliche Eingabequellen haben; nur die Mac-Quelle zu ändern reichte in unserer geprüften Sitzung nicht. Leeren Sie das Feld, geben Sie die URL erneut ein und kontrollieren Sie die Adresse vor dem Absenden.
- **Einfügen aus der Zwischenablage hängt bei Mirroring oder fügt unerwarteten Text ein:** leeren Sie das Feld und tippen Sie mit der iPhone-Eingabequelle English (US) langsam in kurzen Abschnitten, oder geben Sie die URL direkt am Telefon ein. Schnelle Mirroring-Eingabe kann Zeichen verlieren oder verdoppeln; prüfen Sie die vollständige Adresse vor dem Speichern. Senden Sie keine teilweise eingefügte URL. Einfügen schlug in unserer Installationssitzung fehl; für die Direkt-URL-Methode ist es keine Voraussetzung.
- **Dateien/Zuletzt verwendet zeigt mehrere identische IPA-Namen:** wählen Sie den genauen Downloadort oder verwenden Sie die direkte URL mit Tag oben. Eine lokale Kopie darf zur Klarheit Tag/Build im Namen erhalten; Umbenennen ändert ihren Inhalt nicht.
- **Die installierte App öffnet sich nicht:** folgen Sie Entwicklervertrauens- oder Entwicklermodus-Abfragen am Telefon. Prüfen Sie den Ablauf in AltStore und erneuern Sie bei Bedarf. Halten Sie bei weiterem Fehler die tatsächliche Meldung fest; ein Verbindungsfehler allein ist kein Grund zum Löschen und Neuinstallieren.
- **OTT-play öffnet sich, aber eine geschützte Playlist scheitert im Mobilfunknetz:** Installation und Quellenauthentifizierung sind getrennt. Melden Sie sich unter **Einstellungen → Einstellungen verwalten → Quellenzugriff** an einer konfigurierten Quelle an und laden Sie danach die Playlist neu. Erledigen Sie nötige Biometrie-/Passkey- oder E-Mail-Code-Abfragen am physischen Gerät. Die Quelle muss die [iOS-Access-Integration](docs/ios-source-access.md) unterstützen; die App-Installation umgeht keine IP-Zulassungsliste.
- **Passkey wird im vertrauenswürdigen WLAN verlangt:** bei Quellen mit iOS-Access-Integration versucht die App zuerst die ursprüngliche Quelle ohne Anmeldung und nutzt erst nach einer Zugriffsverweigerung den authentifizierten mobilen Einstieg. Prüfen Sie die tatsächlich von der Quelle erkannte öffentliche IP einschließlich IPv6: eine erlaubte Heim-IPv4 deckt keine andere IPv6-, VPN- oder Mobilfunkadresse ab. Netzwechsel und erneutes Öffnen der App löschen ihre vorübergehende Routenpräferenz. Ein allgemeiner Netzwerk-/Serverfehler sollte keine Anmeldung auslösen.
- **Anmeldung erscheint nicht mehr, aber die Kanalliste ist leer:** eine gültige gespeicherte Sitzung wird ohne erneute Abfrage verwendet. Nach vorherigem Ladefehler oder serverseitiger Korrektur laden Sie die Playlist neu oder schließen und öffnen die App einmal vollständig. Prüfen Sie bei weiterem Fehler, ob die Quelle eine Playlist statt HTML-Anmeldeseite oder JSON-Fehler liefert. Notieren Sie angezeigten Fehler und HTTP-Status; teilen Sie keine Quell-URLs mit Zugangsdaten, Cookies oder Access-Tokens.
- **Kanäle laden, aber Video puffert oder meldet `SRC_NOT_FOUND`:** Playlist-Laden und Videowiedergabe sind getrennte Prüfungen. Versuchen Sie den Kanal nach der Anmeldung einmal erneut; prüfen Sie bei anhaltendem Fehler HLS-Manifest- und Segmentantworten sowie Codec-Unterstützung. Der Fehler allein belegt nicht, dass Engine-Wechsel oder Neuinstallation hilft.

<a id="option-2-testflight-if-available"></a>

#### Option 2: TestFlight (falls verfügbar)

Wird eine TestFlight-Einladung veröffentlicht, installieren Sie TestFlight aus dem App Store, öffnen Sie die Einladung am Gerät und tippen Sie auf **Installieren**. Ein GitHub-IPA-Download stellt keine TestFlight-Einladung bereit.

<a id="option-3-xcode-for-developers"></a>

#### Option 3: Xcode (für Entwickler)

Folgen Sie [Erstellen und öffnen](docs/capacitor-mobile.md#build-and-open), wählen Sie das Ziel **App** in Xcode, konfigurieren Sie Ihr Entwicklungsteam unter **Signing & Capabilities**, wählen Sie das verbundene Gerät und bauen/starten Sie. Bestätigen Sie Gerätevertrauen und Entwicklermodus nach Bedarf. Der Import des unsignierten Release-IPA in Xcodes Gerätefenster liefert weder die fehlende Signierungsidentität noch das Bereitstellungsprofil.

---

<a id="android-application"></a>

### Android-App

Wählen Sie für die gemeinsame Player-Oberfläche das Full-Capacitor-APK aus dem Release dieses Repositorys. Unter Android 5.1–6 verwenden Sie das API-22-Kompatibilitäts-APK; es benötigt WebView 60 oder neuer. Bewahren Sie beim Update App-Identität und Signierungszertifikat, damit vorhandene Profile erhalten bleiben. Siehe [Build-Anleitung](android/README.md) sowie [Verteilung, Signierung und Ferninstallation](docs/android-distributions.md).

Das separate [Repository ottplay-android](https://github.com/open-ott-play/ottplay-android) enthält die native Kotlin-/Compose-App. Sie besitzt eigene Identität, Einstellungen und Release-Abläufe und ersetzt keine vorhandene Capacitor-Installation direkt. Historische Release-Artefakte bleiben verfügbar.

---

<a id="quick-start"></a>

## Schnellstart

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

Verwenden Sie für Browser-Funktionstests eine eigene Bereitstellung derselben Revision.

Verwenden Sie Node 22 und die stabile Rust-Toolchain. Starten Sie den Server aus dem Repository-Stamm, damit seine statischen Ressourcen verfügbar sind. Native Builds benötigen die unten beschriebenen Plattformwerkzeuge; für den reinen Server-Build sind sie nicht nötig.

Wählen Sie beim ersten Laden **Demo ausprobieren** oder öffnen Sie **Einstellungen → Provider wechseln → M3U-/M3U8-Playlists**. Öffnen Sie **Playlist auswählen**, wählen Sie einen Platz, geben Sie die **Playlist-URL** ein, speichern Sie und wählen Sie **Playlist laden**. Playlist oder Provider-Konto stellen Sie selbst bereit; die Anwendung liefert kein kostenpflichtiges Kanalabonnement.

<a id="mode-a-companion-smoke"></a>

## Funktionstest des Modus-A-Begleitservers

Curl-basierter Funktionstest für den Modus-A-Begleitserver (Gleichwertigkeit von `ottplay-server` / `archive/server.py`): Startseite, statische Verzeichnisse, `/logo`, `/version`, optional `/epg` sowie Prüfung von `POST /m3u/cp.php` ohne Abruf von Quelldaten.

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

Die Prüfungen stehen in `scripts/modea-smoke-checks.json`. Keine Geheimnisse. Befehlswarteschlange / `local_proxy.py` (:8081) wird separat durch `scripts/smoke-command-queue.sh` geprüft, sofern vorhanden.

<a id="classic-stalker--ministra-portals"></a>

## Klassische Stalker-/Ministra-Portale

Wählen Sie **Stalker-Portale** und geben Sie die vom Provider zugeteilte MAC-Adresse sowie die vollständige Portal-URL ein, etwa `http://provider.example/stalker_portal/c/`. URLs mit `/c/index.html`, `/stalker_portal`, `/server/load.php`, `/load.php` und `/portal.php` wählen das klassische MAG-Protokoll. Bestehende Konfigurationen mit reiner Serveradresse behalten JSON-RPC. Der Provider lädt Profil, Genres und seitenweise Live-Kanäle über den gemeinsamen Stalker-Kern und ermittelt danach im Hintergrund Filme und verschachtelte Episoden über das klassische Protokoll `type=vod`. Ordnerpfade werden zu Kategorien in der normalen Kanalliste; verfügbare Beschreibungen, Poster und globale Favoriten mit stabilen Verweisen verwenden dieselbe Medienoberfläche. Siehe [Katalogverhalten und Grenzen](docs/stalker-media.md).

Browseranfragen bei eigener Serverinstallation laufen durch den Endpunkt `/stalker/api` des Begleitservers; native Apps nutzen ihren vorhandenen HTTP-Transport. Gehostete Browser benötigen ausdrücklich konfigurierte Routen über das [dedizierte Relay](docs/stalker-relay.md). Browser- und Server-Ressourcen müssen gemeinsam aktualisiert werden.

Live-Wiedergabe löst beim Öffnen eines Streams temporäre Kanalbefehle auf; Kanalwechsel, Stopp, PiP und Provider-Wechsel brechen veraltete Auflösungen ab. Explizite dauerhafte HTTP(S)-Befehle werden direkt abgespielt. Kurzes EPG wird unterstützt. Archive klassischer Portale und das separate Protokoll `type=series` werden von diesem Provider nicht angeboten. Bestehendes JSON-RPC-Archiv-/Programmverhalten bleibt unverändert. Private LAN-Portale auf der Begleitserver-Route benötigen wie dessen andere Proxy-Routen einen exakten Eintrag in `OTTPLAY_PROXY_LAN_ORIGINS`.

Die öffentliche Infomir-Demo ist `http://middleware-stalker.com/stalker_portal/c/`. Sie lieferte am 2026-09-26 drei Live-Katalogeinträge, ihre Medienendpunkte waren jedoch nicht verfügbar. Verwenden Sie für Wiedergaberegressionen ein kontrolliertes Portal-/Medien-Testobjekt.

<a id="m3u-stream-proxy-header-smoke"></a>

## Prüfung der M3U-Streamproxy-Header

Vergleicht die Upstream-Anfrageheader, die `POST /m3u/cp.php` des Modus-A-Begleitservers beim Abruf einer kontrollierbaren Echo-URL einfügt (standardmäßig lokaler Mock — keine IPTV-Provider, keine Geheimnisse).

Vertrag (aus `src-rs/core/src/m3u.rs` + `archive/server.py`):
- Fügt nur **User-Agent** ein (standardmäßig `OTT-play-FOSS/1.0` oder Voreinstellungen `webos` / `tizen` / `viera` / `mag` / `dune`).
- Fügt **keinen Referer** ein (Capacitors `M3UProxy` tut dies; Modus A nicht).
- Entfernt ein führendes `@` aus `url` (jQuery-Formular des Providers).

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

Rückgabecodes: `0` erfolgreich, `1` Server lauscht nicht, `2` Header-/HTTP-Abweichung, `3` Verwendung/Abhängigkeiten. Ergänzt `smoke-modea-companion.sh` / `smoke-command-queue.sh`.

<a id="logo-concurrent-bench-smoke"></a>

## Gleichzeitiger Last-Funktionstest für Logos

Latenzprüfung gleichzeitiger `GET /logo/<id>.svg`-Anfragen (optional `?ch=`) an den Modus-A-Begleitserver. Meldet Erfolgs-/Fehlerzahlen sowie p50/p95/p99. Standardmäßig praktische lokale CI-Last (`CONCURRENCY=200`, `TOTAL=1000`); ein vollständiger Dauertest mit 10.000 Anfragen ist optional (`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`).

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

Rückgabecodes: `0` erfolgreich, `1` Server lauscht nicht / Verbindung fehlgeschlagen, `2` hohe Fehlerquote, `3` Verwendung. Ergänzt `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`.

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## XMLTV-Cache-Aktualisierung und Aufwärmprüfung

Prüft das tatsächliche XMLTV-/EPG-Cache-Verhalten des Modus-A-Begleitservers anhand von `src-rs` (keine erfundenen APIs):

- `EPG_CACHE` im Speicher wird über `GET /epg/:hash` immer als `{"epg_data":[...]}` ausgeliefert (HTTP 200).
- Beim Prozessstart werden `EPG_URLS` im Hintergrund abgerufen, ohne den HTTP-Start zu verzögern; nach jedem abgeschlossenen Abruf folgen **2 Stunden** Wartezeit bis zur nächsten Aktualisierung.
- Optionale SQLite-Persistenz bei gesetztem `DATABASE_URL` (kein öffentlicher Cache-Statusendpunkt).
- `GET /health` → `OK` bestätigt HTTP-Bereitschaft nach einem optionalen Neustart. Mit `--strict-epg` und `--epg-hash` wartet die Prüfung außerdem innerhalb desselben `--warmup-timeout`-Budgets auf nicht leeres EPG für diesen Kanal.

Der Standardpfad verwendet nur curl — **er beendet keine Prozesse**. Übergeben Sie `--restart-cmd` / `RESTART_CMD` für automatisches Beenden und Neustarten oder folgen Sie den manuellen `launchctl`-Schritten in `--help`.

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

Rückgabecodes: `0` erfolgreich, `1` Server lauscht nicht, `2` Zusicherung/Aufwärmen fehlgeschlagen, `3` Verwendung. Ergänzt `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`.

<a id="mode-a-e2e-play-path-smoke"></a>

## Modus-A-End-to-End-Prüfung des Wiedergabepfads

Begleitserverseitiger Funktionstest für **Wiedergabepfad / Streambereitschaft** (nur HTTP — **kein** UI-End-to-End-Test mit sichtbarem Fenster). Gegen einen laufenden Modus-A-Begleitserver werden geprüft:

- Erreichbarkeit von Health-Endpunkt oder Startseite.
- Statische Player-Shell-Ressourcen (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`).
- Optional `GET /epg/<hash>.json`, wenn `EPG_HASH` gesetzt ist.
- `POST /m3u/match-channels` mit geheimnisfreiem JSON-Testobjekt (leere Liste + ein synthetischer Kanal).
- **Wiedergabe** über den Streamproxy: `POST /m3u/cp.php` an ein kontrollierbares Medien-Testobjekt (standardmäßig lokale HLS-Playlist oder `MEDIA_URL`) mit Prüfung auf HTTP 200 + nicht leeren Inhalt / erwarteten `Content-Type` (erste Bytes durch den Proxy).

Keine privaten IPTV-Zugangsdaten. Ergänzt `smoke-modea-companion.sh` (Vorhandensein), `smoke-m3u-stream-proxy-headers.sh` (UA/Referer), `smoke-xmltv-cache-refresh.sh`.

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

Rückgabecodes: `0` erfolgreich, `1` Server lauscht nicht, `2` Zusicherung fehlgeschlagen, `3` Verwendung/Abhängigkeiten.

<a id="capacitor-device-smoke-mode-b"></a>

## Capacitor-Gerätetest (Modus B)

**Checkliste** für Simulator/Emulator (optional physisches Gerät) mit Modus B Cap — nicht Modus-A-Begleitserver-HTTP. Menschen bestätigen UI-Ergebnisse; das Hilfsskript automatisiert Toolchain, native Verzeichnisse und einen toleranten Curl-Test der Befehlswarteschlange.

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

Details: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md). Ergänzt `smoke-command-queue.sh` (Cap-Loopback) — nicht mit den obigen Modus-A-Tests verwechseln.

<a id="tauri-desktop-smoke-mode-b"></a>

## Tauri-Desktoptest (Modus B)

Desktop-Checkliste und Hilfsskript für Modus B Tauri (Fenster / Kanalwiedergabe / PiP). Weder Modus-A-Begleitserver-HTTP noch Cap-Gerätetest.

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

Details: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md). Apple-Entwicklerzugangsdaten sind für lokale Funktionstests optional; verwenden Sie [Ad-hoc-Signierung](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials) für eine paketierte Mac-App. Menschliche Abnahme umfasst weiterhin Start, Wiedergabe und PiP.

<a id="docker"></a>

## Docker

Multiarch-Images (amd64/arm64) werden als OCI-Kandidatenarchive gebaut. Die Veröffentlichung im Registry überträgt das freigegebene stabile Archiv ohne Neubau zu Docker Hub; siehe [Betriebshandbuch](docs/release-workflow.md).

Das Serverprogramm wird auf **musl** (Alpine) gebaut und auf Alpine ausgeliefert — es benötigt **kein** GLIBC_2.38+. Dadurch bleibt `alvit/ottplay-foss` auf Synology DSM Docker (x86_64) und anderen Hosts mit älterer glibc lauffähig.

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

Stabile Registry-Tags verwenden `X.Y.Z`. Die Aktualisierung von `latest` ist nach Veröffentlichung des versionierten Images eine separate ausdrückliche Option; Pushes auf main und Git-Tags veröffentlichen keine Images.

<a id="build-from-source"></a>

## Aus Quellcode bauen

Die Domänenregeln des Players stammen aus dem festgelegten Kotlin-Multiplatform-Artefakt in `vendor/ottplay-core.js`. Entscheidungen zu Programmführer, Archiv, Playlist, Provider, dauerhaftem Zustand und Wiedergabe teilen ihre Implementierung mit FOSS2 und nativem Android. Browser-/TV-, Swift- und Rust-Adapter behalten Geräte-APIs, Codecs, Netzwerk und UI-Effekte. Das Browserartefakt bewahrt ES5-Syntax und den unterstützten Start älterer APIs. `npm test`, `check:bundle` und `check:es5` prüfen die Integration; das Artefaktmanifest hält Quell- und Ausgabehashes fest.

Protokollvalidatoren für Control-server und SWOP werden aus dem versionierten Schema `contracts/ottplay-wire-v1.json` generiert. Geprüfte Generatornachweise und unveränderliche Kompatibilitäts-Testobjekte verhindern verbraucherspezifische Kopien von Richtlinien.

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

## Geräteerkennung

Der Player unterstützt 24 Gerätetypen. Erkennung zuerst über die URL `/f/{device_id}/`, danach über User-Agent.

| Geräte-ID | Gerät |
|---|---|
| `pc` | PC-Browser |
| `pc2` | videojs-Webplayer |
| `nodejs` | Windows-App (Electron) |
| `lg/webos` | LG-WebOS-Fernseher |
| `samsung/tizen` | Samsung-Tizen-Fernseher |
| `samsung/maple` | Samsung-Orsay-Fernseher |
| `mag` | Infomir-MAG-Boxen |
| `dune` | Dune-HD-Boxen |
| `android` | Android TV / Tablets |
| `hbbtv` | HbbTV-Fernseher |
| `panasonic` | Panasonic-Viera-Fernseher |
| `philips` | Philips-Fernseher |
| `sony` | Sony-Fernseher |
| `sharp` | Sharp-Fernseher |
| `toshiba` | Toshiba-Fernseher |
| `hisense` | Hisense-Fernseher |
| `skyworth` | Skyworth-Fernseher |
| `tcl` | TCL-Fernseher |
| `vewd` | Vewd-Geräte |
| `spark` | Spark-Receiver |

<a id="push-command-system"></a>

## Push-Befehlssystem

Verwenden Sie für einen separaten Dienst mit mehreren Geräten [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) und den Abschnitt **Befehlsserver** unter **Einstellungen → Fernsteuerung**. Geben Sie dessen IP/Adresse und den Gerätezugangscode dieses Players ein; das Speichern beider Werte startet automatisch die Abfrage von Lautstärke-, Kanal- und anderen Befehlen. Eine IP ohne Port verwendet HTTP-Port 8081. Leeren Sie die Adresse oder wählen Sie **Trennen**, um zu stoppen. Diese ausgehende Verbindung unterstützt bestätigte Zustellung und benötigt keinen lokalen Listener. Siehe [Verbindungs- und Kompatibilitätsdetails](docs/remote-command-server.md). Die folgenden Beispiele beschreiben den vorhandenen lokalen Proxy-/Listener-Modus.

Mit **Befehlsserver suchen** lässt sich ein Controller finden und die Freigabe durch den Betreiber anfordern, ohne ein Gerätetoken zu kopieren. Tauri prüft zuerst das native DNS und kann bei einem leeren Ergebnis auf ein ausdrücklich eingerichtetes Bereitstellungsprofil zurückgreifen; Browser-, LG- und Capacitor-Player verwenden den Browser-Profilpfad. Die Home-Erkennungsmetadaten können unabhängig vom Controller auf here.now gehostet werden. Allgemeine Builds enthalten dieses Home-Profil nicht automatisch, und ein Update ersetzt keine gespeicherten Verbindungen. Siehe [Plattformverhalten, Profileinrichtung und Fehlerbehebung](docs/remote-command-server.md#discovery-and-one-time-approval).

Lokale HTTP-Fernsteuerung ist im Browser-/OTT-Server-Player, in Tauri und Capacitor **standardmäßig aus**. Aktivieren Sie sie unter **Player-Einstellungen → Fernsteuerung**, um einen geheimen Gerätecode zu erzeugen. Befehle sind JSON-Objekte mit einem Feld `"command"`; HTTP-Anfragen benötigen `Authorization: Bearer <device-code>`.

<a id="architecture"></a>

### Architektur

<a id="local-command-url-recommended"></a>

#### Lokale Befehls-URL (empfohlen)

Aktivieren Sie **Lokale HTTP-Fernsteuerung** unter **Player-Einstellungen → Fernsteuerung**, kopieren Sie den erzeugten **Gerätecode** und konfigurieren Sie damit den folgenden Proxy. Setzen Sie **Lokale Befehls-URL** auf den Befehlsendpunkt des Proxys. Solange dies aktiviert ist, fragt der Player diese URL alle zehn Sekunden mit dem Gerätecode im Authorization-Header ab. Eine URL allein aktiviert die Befehlssteuerung nicht.

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### Geräte-UUID

Die vorhandene Geräte-UUID (z. B. `dev_a1b2c3d4e5`) sind öffentliche Routingmetadaten, keine Autorisierungsdaten. Der separate **Gerätecode** wird bei Aktivierung lokaler HTTP-Steuerung sicher erzeugt und bleibt auf diesem Gerät; er wird nicht über Cloud-Einstellungen kopiert. Deaktivieren stoppt Abfragen/Listener. Erneutes Aktivieren erzeugt einen neuen Code: aktualisieren Sie Proxy und Integrationen, um die alten Zugangsdaten zu widerrufen.

Tauri und Capacitor starten ihren Loopback-HTTP-Listener erst nach dieser Zustimmung in den Einstellungen. Weiterleitende Proxys müssen den angezeigten Gerätecode als Bearer-Token an diesen Listener senden. Modus A verwendet die unten beschriebene, separat konfigurierte Warteschlange `local_proxy.py`.

<a id="remote-text-entry-swop"></a>

#### Ferne Texteingabe (swop)

Zweck: Texteingabe am Telefon für ♥™ / ferne virtuelle Tastatur, wenn TV und Telefon in **verschiedenen Netzen** sind, über eine Cloudflare-Worker-Sitzungsübergabe.

- Worker-Repository: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop).
- **Installationsautorisierung:** der Player sendet Anfragen an das `/swop`-Relay seines Servers unter derselben Origin. Der Server fügt sein privates Installationstoken hinzu; jeder Client unter der registrierten Server-Origin kann ferne Texteingabe nutzen. Geräte-UUIDs identifizieren Sitzungen und benötigen keine gerätespezifische Zulassungsliste.
- Einstellung: `swopBaseUrl` (leer = ♥™ zeigt „nicht konfiguriert“ / keine Aktion). Unter **Einstellungen → Fernsteuerung** (Taste **2**) bearbeiten oder bei Operator-Installationen über das von Git ignorierte `/local/swop.json` setzen.
- `POST /session` enthält `clientId`, `caption` und `draft`; `POST /val` enthält `clientId`, `code` sowie das zurückgegebene `sessionToken`. Die Telefon-URL enthält ein separates Schreibtoken. Sitzungs-Lesetokens bleiben im Browserspeicher.
- **Lokale Installation:** setzen Sie `SWOP_BASE_URL` und `SWOP_INSTALLATION_TOKEN`, nachdem Installation und ihre exakten LAN-/localhost-Origins im Worker registriert wurden. `scripts/install-ottplay-local-service.sh` bewahrt sie in seiner privaten launchd-plist mit Modus 0600 auf. Das öffentliche `/local/swop.json` enthält nur `{"swopBaseUrl":"/swop"}`. Schreiben Sie niemals ein Installationstoken in öffentliche Ressourcen.
- **Statisches Hosting:** konfigurieren Sie für dieselben zwei Endpunkte einen serverseitigen authentifizierten Proxy. Bewahren Sie das Installationstoken in den Geheimnissen des Hostingdienstes auf. Das Kopieren öffentlicher Playerdateien kopiert diese Serverzugangsdaten nicht.

> Der zentrale OTT-Server hält `/api/webhook/commands`, `/webhook/poll`, `/webhook/notify` und Befehls-Health-Aliasse für jede HTTP-Methode deaktiviert. Verwenden Sie für Modus A den separaten Befehlsserver oder ein ausdrücklich konfiguriertes authentifiziertes `local_proxy.py`; der zentrale Server hat keine Broadcast-Befehlswarteschlange.

<a id="available-commands"></a>

### Verfügbare Befehle

Alle folgenden Beispiele verwenden `http://192.168.1.50:8081/api/webhook/commands` als lokale Proxy-URL. Ersetzen Sie sie durch Ihre tatsächliche Proxyadresse und setzen Sie `OTTPLAY_QUEUE_HTTP_TOKEN` auf den **Gerätecode**, der nach Aktivieren der HTTP-Steuerung in den Player-Einstellungen angezeigt wird. Der Proxy muss denselben Code verwenden.

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — Benachrichtigungs-Pop-up anzeigen

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| Feld | Typ | Standard | Beschreibung |
|---|---|---|---|
| `message` | string | erforderlich | Anzuzeigender Text |
| `popup_duration` | number | 5 | Anzeigedauer in Sekunden (oben rechts) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — Kanal nach Listenposition wechseln

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| Feld | Typ | Standard | Beschreibung |
|---|---|---|---|
| `channel_number` | number | erforderlich | Kanalposition in der Liste, ab 1 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — Kanal nach vollständigem oder teilweisem Namen wechseln

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

Teilzeichenfolgensuche ohne Beachtung der Groß-/Kleinschreibung. Der erste Treffer gewinnt.

| Feld | Typ | Standard | Beschreibung |
|---|---|---|---|
| `channel_name` | string | erforderlich | Kanalname oder Teil davon |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — Zufälligen Kanal wählen

Dieser ältere Befehl wählt zulässige Kanäle aus der aktuellen Liste/Kategorie. Kanalnummern und Bereiche beziehen sich auf Positionen in dieser Liste; siehe [Regeln für die sichere Zufallsauswahl](docs/remote-command-server.md#safe-random-playback).

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

| Feld | Typ | Standard | Beschreibung |
|---|---|---|---|
| `random_range` | [start, end] | aktuelle Liste | Bereich, ab 1 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — IPTV-Provider wechseln

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| Feld | Typ | Standard | Beschreibung |
|---|---|---|---|
| `provider` | number | erforderlich | Index im Provider-Array (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — Neue M3U-Playlist laden

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| Feld | Typ | Standard | Beschreibung |
|---|---|---|---|
| `playlist` | string | erforderlich | URL der M3U-Playlist |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — Provider-Konfiguration aktualisieren

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| Feld | Typ | Standard | Beschreibung |
|---|---|---|---|
| `provider_settings` | string | erforderlich | JSON-Zeichenfolge mit Provider-Konfiguration |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — Lautstärke setzen oder ändern

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

Auf Clients ohne Lautstärkesteuerung wird dies still ignoriert.

| Feld | Typ | Standard | Beschreibung |
|---|---|---|---|
| `volume` | number | — | Absoluter Pegel 0–100 |
| `volume_step` | number | — | Relative Änderung, etwa +10 oder -5 |

<a id="player-standby-restart-and-exit"></a>

#### Player-Standby, Neustart und Beenden

Die unbestätigte Webhook-Warteschlange des lokalen Proxys unterstützt weder `exit_player` noch typisierte Standby-/Aufwachanfragen. Verbinden Sie den Player mit dem [Befehlsserver](docs/remote-command-server.md) und verwenden Sie dessen CLI:

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

Ersetzen Sie `d1` durch Ihren registrierten Player-Alias. `stop` ist ein Alias für `standby`; `start` und `wake` sind Aliasse für `go`. Go benötigt einen laufenden, verbundenen Player; es kann keine geschlossene App starten und kein Offline-Gerät wecken. Ein Browser oder Fernseher ohne native App-Beendigung meldet, dass Beenden nicht unterstützt wird. Standby hält die Fernabfrage aktiv und pausiert keine unabhängige Host- oder gemeinsam genutzte Serverarbeit.

Prüfen Sie nach standby/go mit `ott d1 status` den Standby-/Hintergrundzustand und bestätigen Sie die fortgesetzte Wiedergabe separat. Bestätigen Sie nach einem Neuladen des Players mit `ott d1 doctor` eine neue Laufzeit. Prüfen Sie nach Beenden im Betriebssystem, dass der App-Prozess geschlossen ist; ein Remote-Timeout beweist kein Beenden. Die Annahme eines Befehls allein bestätigt diese Ergebnisse nicht.

<a id="local-proxy-server"></a>

## Lokaler Proxyserver

`local_proxy.py` ist eine eigenständige authentifizierte Befehlswarteschlange für einen Player. Der Standardaufruf beendet sich, ohne einen Port zu öffnen. Jede Proxyinstanz verwendet den vom Player erzeugten Gerätecode; für mehrere Player benötigen Sie separate Instanzen/Ports. Ein Abfrageparameter `device_id` wird als Kompatibilitätsmetadatum akzeptiert und authentifiziert oder wählt niemals ein anderes Gerät.

<a id="start-the-proxy"></a>

### Proxy starten

1. Aktivieren Sie **Lokale HTTP-Fernsteuerung** im Player und kopieren Sie dessen **Gerätecode**.
2. Konfigurieren Sie auf dem Proxyhost den Code und die exakte Origin des Players (Schema, Host und Port, kein Pfad):

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. Setzen Sie die **Lokale Befehls-URL** des Players auf `http://192.168.1.50:8081/api/webhook/commands`.

Die Standard-Bindadresse lautet `127.0.0.1`; das Beispiel aktiviert LAN-Zugriff ausdrücklich. `OTTPLAY_QUEUE_HTTP_ORIGINS` ist eine kommagetrennte Zulassungsliste exakter Browser-Origins. Verwenden Sie einen HTTPS-Reverse-Proxy, wenn der Player über HTTPS bereitgestellt wird, damit die Mixed-Content-Regeln des Browsers die Abfrage erlauben. Halten Sie den Gerätecode geheim und aus URLs heraus. Starten Sie den Proxy bei einem neuen Playercode mit dem neuen Wert neu; allein das Deaktivieren des Players beendet keinen separat verwalteten Proxyprozess.

<a id="endpoints"></a>

### Endpunkte

| Methode | Pfad | Beschreibung |
|---|---|---|
| `POST` | `/api/webhook/commands` | Befehl einreihen |
| `GET` | `/api/webhook/commands` | Eingereihte Befehle abrufen (Player-Abfrage) |
| `POST` | `/webhook/notify` | Authentifizierter Kompatibilitätsalias |
| `GET` | `/webhook/poll` | Authentifizierter Kompatibilitätsalias |

Senden und Entnehmen benötigen beide den passenden Bearer-Gerätecode. Es gibt keinen unauthentifizierten Broadcast-Endpunkt. Befehle verfallen nach 60 Sekunden; jeder Proxy hält höchstens 50 Befehle.

Der Proxy bearbeitet bis zu 16 Verbindungen gleichzeitig, sodass eine inaktive Browserverbindung oder unvollständige Anfrage andere Befehlsanfragen nicht verzögert. Jeder Socket hat fünf Sekunden Inaktivitäts-Timeout; sind alle Worker beschäftigt, werden weitere Verbindungen geschlossen. Einreihen und Entnehmen sind über Worker hinweg atomar.

<a id="smoke-script-all-modes"></a>

### Funktionstestskript (alle Modi)

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Android-Emulator/-Gerät: zuerst `adb forward tcp:18081 tcp:18081`. Cap/Tauri sind nur über Loopback erreichbar — verwenden Sie für LAN-Home-Assistant diesen Modus-A-Proxy. Details: `docs/capacitor-mobile.md`, Abschnitt Smoke test.

<a id="cors"></a>

### CORS

Der Proxy erlaubt Browseranfragen nur aus `OTTPLAY_QUEUE_HTTP_ORIGINS`. Preflight-`OPTIONS`-Anfragen einer erlaubten Origin brauchen kein Token; jede tatsächliche GET-/POST-Anfrage benötigt den Bearer-Gerätecode. Platzhalter- und `null`-Origins werden nicht akzeptiert. Home Assistant und andere Nicht-Browser-Clients können Origin weglassen, müssen sich aber dennoch authentifizieren.

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### Beispiel: Home-Assistant-Webhook → lokaler Proxy → Player

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

### Home-Assistant-Automatisierungsbeispiele

Die Beispiele für Pop-ups, Kanäle und Lautstärke verwenden den lokalen Proxy. Setzen Sie `ottplay_device_authorization` in Home Assistants `secrets.yaml` auf `Bearer <device-code>` mit dem vom aktivierten Player angezeigten Code.

Nächtlicher Standby verwendet den separaten [Befehlsserver](docs/remote-command-server.md). Ersetzen Sie seine Beispiel-URL und `DEVICE_UUID` unten durch Ihre Controlleradresse und registrierte Geräte-ID; der lokale CLI-Alias `d1` ist keine Geräte-ID. Setzen Sie `ottplay_control_authorization` in `secrets.yaml` auf `Bearer <controller-admin-token>`. Diese Zugangsdaten sind vom Gerätecode des lokalen Proxys getrennt. Siehe Home Assistants Dokumentation zu [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) und [Geheimnissen](https://www.home-assistant.io/docs/configuration/secrets/).

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

`standby_request` enthält die HTTP-Antwort für die Automatisierungsspur. HTTP 202 bedeutet nur eingereiht: bewahren Sie `content.id` auf und fragen Sie mit denselben Controllerzugangsdaten `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` nach der Playerantwort ab. Eine neue `status`-Anfrage beobachtet `player.standby` und `player.background`; aktivierter Standby mit `suspended` und null ausstehenden Aufgaben bestätigt, dass die verfolgte Playerarbeit beendet wurde. Zum Verlassen von Standby verwenden Sie dieselbe typisierte Anfrage mit `"operation":"wake"` (`ott d1 go`). Wiederholen Sie eine Änderung nach einem Timeout nicht blind. Siehe [Anfrage-/Antwort-API](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) und [Standby-Semantik](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake) des Controllers.

<a id="server-api-reference"></a>

## Server-API-Referenz

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Webhook-Endpunkte (Rust `ottplay-server`)

Der Rust-Server und die archivierte Python-Ausweichimplementierung lehnen Befehlsendpunkte mit HTTP 403 ab. `/api/webhook/commands`, `/webhook/notify`, `/webhook/poll` und Befehls-Health-Aliasse reihen weder Befehle ein, noch senden sie diese als Broadcast oder entnehmen sie. Die allgemeine Feedback-API kann diese reservierten Routen nicht überschreiben. Modus-A-Befehlszustellung verwendet den oben beschriebenen, separat konfigurierten Befehlsserver oder authentifizierten lokalen Proxy.

<a id="other-endpoints"></a>

### Weitere Endpunkte

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/epg/<hash>.json` | EPG-Daten für den Kanal |
| `GET` | `/logo/<id>.svg` | Generiertes Kanallogo |
| `GET` | `/version/<path>` | Hash der Dateiversion |
| `POST` | `/m3u/match-channels` | Kanal-EPG-Zuordnung |
| `POST` | `/m3u/match-logos` | Zuordnung von Kanallogos |
| `POST` | `/m3u/cp.php` | Streamproxy |
| `GET/POST` | `/feedback/` | Feedback-Protokollierung |
| `GET` | `/tmdb/*` | TMDb-API-Proxy |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## Projektstruktur

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

## STB-Tastenbelegungen

- **Samsung Tizen**: `RETURN=10009`, `ENTER=13`, Farben 403–406.
- **Samsung Maple**: Steuerkreuz 4/5/6/8, ursprüngliche SDK-Codes.
- **LG WebOS**: `RETURN=461`, HbbTV-kompatible Farbtasten.
- **LG NetCast**: `RETURN=8`, HbbTV-Codes.
- **MAG**: `RETURN=8`, gSTB-API für MAC.
- **Dune HD**: Standardcodes, Dune-API.
- **Android TV**: Android-Tastencodes (`BACK=4`, `DPAD_*` 19–22, `ENTER=66`).
- **HbbTV/Panasonic/Philips/Sony/usw.**: HbbTV-Codes (`RED=403`, `BLUE=406`, `VOL_UP=447`).

<a id="documentation"></a>

## Dokumentation

- [Dokumentationswiki](./docs/wiki/Home.de.md) / [Russisches Wiki](./docs/wiki/Home.ru.md) — aufgabenorientierte Navigation und Wartungsregeln.
- [Implementierungsbericht](./docs/implementation-report.de.md) / [Prozess und Ergebnis auf Russisch](./docs/implementation-report.ru.md) — farbige Diagramme, geprüftes Verhalten, gemessener Aufwand und Release-Freigaben.
- [Funktionsleitfaden](./docs/roadmap-delivery.de.md) / [Leitfaden zu neuen Funktionen auf Russisch](./docs/roadmap-delivery.ru.md) — Funktionen, Grenzen und Prüfung.
- [Kurzanleitungen in 88 Oberflächensprachen](./docs/readme/README.md) — aus den ausgelieferten UI-Übersetzungen erzeugt; Haupthandbuch und zugehörige Funktionsleitfäden sind in [24 Dokumentationssprachen](docs/manual-translations.md) verfügbar, andere technische Referenzen behalten ihre bisherigen Sprachen.
- [Qualitätsgrenzen und Live-Wiederherstellung](./docs/playback-stream-policy.de.md) / [Auf Russisch](./docs/playback-stream-policy.ru.md).
- [Manuelle XMLTV-Zuordnung und klassische Barrierefreiheit](./docs/guide-binding-accessibility.de.md) / [Auf Russisch](./docs/guide-binding-accessibility.ru.md).
- [Gehostete Audio-/Videoprüfung](./docs/audio-video-check.de.md) / [Auf Russisch](./docs/audio-video-check.ru.md).
- [Xtream-Mediathek](./docs/xtream-media.de.md) / [Auf Russisch](./docs/xtream-media.ru.md).
- [Geräteübergabe derselben Quelle](./docs/remote-handoff.de.md) / [Auf Russisch](./docs/remote-handoff.ru.md).
- [Wiederherstellbare lokale Einstellungen](./docs/settings-recovery.de.md) / [Auf Russisch](./docs/settings-recovery.ru.md).
- [Browsergenerationen, Betriebssysteme und exakte Release-Candidate-Prüfungen](docs/browser-compatibility.de.md) / [Auf Russisch](docs/browser-compatibility.ru.md).

- [Playerarchitektur](./docs/architecture.md) — Laufzeitzuständigkeiten, Providerintegration, Wiedergabe, Programmführer, Geräteadapter und Build-Verträge.
- [Klassische ES5-Build-Pipeline](./docs/build-pipeline.md) — Kompilierung, Kompatibilitätsprüfungen und Artefaktgrößenlimits.
- [Laufzeitressourcennamen und Bereitstellungsmigration](./docs/asset-layout.md) — beschreibende Pfade für Web- und native Pakete.
- [Remote-Workbench](./docs/remote-workbench.md) — UI-/Medieninspektion, Operationsnachweise und gespeicherte Belege.
- [Laufzeitdiagnose](./docs/runtime-debug.md) — Fehlerverlauf, Frame-/Schleifenzähler, native Capacitor-/Tauri-Metriken und Serverdebugging.
- [Lokale macOS-Auslieferung](./docs/macos-local-delivery.md) — Builds aus dem Checkout, lokale Installation und Prüfung.

<a id="license"></a>

## Lizenz

[MIT](LICENSE) — frei und quelloffen. Providerinhalte und Abhängigkeiten Dritter behalten ihre eigenen Rechte und Lizenzen.

Die separate Anwendung [OTTPlay native webOS](docs/native-webos.md), die auf PlxNative basiert, wird unter **GPL-3.0-or-later** mit dem zugehörigen Quellcode verteilt.
Die MIT-Lizenz im Stammverzeichnis ändert nicht die Lizenz dieser nativen Anwendung oder ihrer Patches.

<a id="desktop-updater--notarization-mode-b"></a>

## Desktop-Updater / Notarisierung (Modus B)

Der [Leitfaden zu Desktop-Signierung und Updater](docs/tauri-updater-notarize.md) beschreibt macOS-Ad-hoc-Signierung, optionale Developer ID/Notarisierung und Bundle-Prüfung. Release-CI verwendet ohne Apple-Zugangsdaten Ad-hoc-Signierung. Updater-Signierung ist separat; automatische Produktionsupdates bleiben unkonfiguriert.

<a id="local-mac-build-helpers"></a>

## Lokale Mac-Build-Helfer

Siehe [docs/local-build-scripts.md](docs/local-build-scripts.md).

<a id="privacy"></a>

## Datenschutz

Informationen zu lokalen Einstellungen, konfigurierten Diensten und Wahlmöglichkeiten finden Sie in der [Datenschutzrichtlinie](docs/privacy-policy.md). Kontakt für Datenschutz und Support: [alvit.work@gmail.com](mailto:alvit.work@gmail.com).

Studio 2026 ist das Standard-Theme. Classic und PLi-HD bleiben auswählbar; gespeicherte Benutzerpräferenzen bleiben erhalten. Siehe [Oberflächeneinstellungen](docs/interface-settings.md). Das PLi-HD-Theme würdigt Vali, littlesat, VU+NL, Milo und die Upstream-Mitwirkenden. Die [Oberflächen-Danksagung und Designgeschichte](docs/interface-history.md) enthält die englische Geschichte und Quelllinks und ist auch im Informationsmenü des Players erreichbar.

<a id="demo-video-editing"></a>

## Demovideos bearbeiten

Verwenden Sie den lokalen [video-use-Ablauf](docs/demo-video.md), um Demonstrationsaufnahmen vorzubereiten und zu bearbeiten. Das Hilfswerkzeug hält alle erzeugten Medien außerhalb von Git.

<a id="plex-media-library"></a>

## Plex-Mediathek

Jeder Player kann sich über den Provider **Plex** mit einem Plex-Konto oder Plex Media Server verbinden. Die Integration verwendet Plex; Synology ist ein möglicher Host für den Medienserver. Alle verfügbaren Videos und Musiktitel erscheinen automatisch in der normalen Kanalliste; die Kategorieauswahl filtert nach Bibliothek, Ordner oder Serie. Die Wiedergabe beginnt mit dem ersten nutzbaren Datenpaket, mit Hintergrundladen, normaler Suche und Aktionen für Zufallsreihenfolge/Wiederholung, ohne Plex auf dem OTT-Server einzurichten. Siehe [Plex-Anmeldung und direkte Wiedergabe](docs/plex-provider.md).

![Plex-Laden, Dateinavigation und Beendigungslebenszyklus](docs/images/plex-playback-lifecycle.svg)

Der [illustrierte Zuverlässigkeitsbericht](docs/plex-provider.md#reliability-review-process-and-results) erklärt Lade- und Abbruchregeln, Korrekturen für vollständige Kataloge und Dateiwechsel sowie gemessene Chromium-/WebKit-Prüfergebnisse.

Eine optionale OTT-Serverintegration stellt außerdem den Katalog eines vorhandenen Plex-Servers und kompatible Wiedergabe über einen separaten NAS-Bibliothekseintrag und M3U-Export bereit. Siehe [serverseitige Bibliothekskonfiguration und Clientzugriff](docs/synology-library.md).

<a id="related-repositories"></a>

## Verwandte Repositorys

- [ottplay-core](https://github.com/open-ott-play/ottplay-core) verantwortet gemeinsame JVM-/ES5-Domänenlogik, Übertragungsverträge und den FOSS2-Client. Dieser Player verwendet generierte Artefakte; folgen Sie für gemeinsame Änderungen dem Auslieferungsleitfaden des Kerns.
- [ottplay-android](https://github.com/open-ott-play/ottplay-android) ist die separate native Kotlin-/Compose-App mit eigener Installations- und Release-Identität.
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server) bietet selbst gehostete Fernbefehle; [ottplay-swop](https://github.com/open-ott-play/ottplay-swop) einen optionalen Worker-basierten Texteingabetransport.
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine) verantwortet gehostetes Profil der Browserdemo, Demomedien und Veröffentlichungsprüfung.

<a id="project-maintenance"></a>

## Projektwartung

Siehe [Beitrags- und Testanforderungen](CONTRIBUTING.md), [Richtlinie für Sicherheitsmeldungen](SECURITY.md), [Sicherheitsdesign](docs/security-design.md) und [OpenSSF-Nachweise und verbleibende Kriterien](docs/openssf-evidence.md).
