<a id="ott-play-documentation-wiki"></a>

# Documentatiewiki van OTT-play

<!-- language-navigation:start -->
<p dir="ltr">
<a href="Home.md" lang="en" dir="ltr">English</a> · <a href="Home.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="Home.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="Home.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="Home.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="Home.es.md" lang="es" dir="ltr">Español</a> · <a href="Home.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="Home.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="Home.he.md" lang="he" dir="rtl">עברית</a> · <a href="Home.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="Home.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="Home.it.md" lang="it" dir="ltr">Italiano</a> · <a href="Home.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="Home.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="Home.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="Home.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="Home.pt.md" lang="pt" dir="ltr">Português</a> · <a href="Home.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="Home.th.md" lang="th" dir="ltr">ไทย</a> · <a href="Home.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="Home.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="Home.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="Home.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="Home.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[README](../../README.nl.md) · [Alle interfacetalen](../readme/README.md)

Dit is de startpagina van de versiebeheerde documentatie in de bronrepository. GitHub kan deze Markdown-pagina’s direct weergeven; door ze hier te onderhouden worden instructies, diagrammen en tests samen met de code beoordeeld. De aparte [GitHub Wiki](https://github.com/open-ott-play/ottplay-foss/wiki) wordt uit deze bronnen geëxporteerd en vermeldt op elke pagina de bronrevisie. Zie de [publicatie-instructies](../wiki-publishing.md).

<a id="start-and-install"></a>

## Starten en installeren

- [Praktische handleiding](../../README.nl.md), beschikbaar in [24 documentatietalen](../manual-translations.md).
- [Vertaalde snelstartgidsen voor alle 88 interfacetalen](../readme/README.md). Ze hergebruiken vertaalde UI-teksten en navigatiestappen. Het zijn geen 88 vertaalde technische handleidingen. De hoofdhandleiding en bijbehorende functiegidsen hebben volledige edities in 24 talen.
- [Android Full/API 22-pakketten en updates](../android-distributions.md), [Android-build](../../android/README.md) en [Capacitor iOS/Android](../capacitor-mobile.md).
- [Desktopdistributie op macOS](../macos-local-delivery.md), [Tauri-ondertekening/updater](../tauri-updater-notarize.md) en [lokale HTTP-instanties](../local-http-deployment.md).

<a id="process-and-results"></a>

## Proces en resultaten

- [Browserkwalificatie en kandidaatverificatie](../browser-compatibility.nl.md) ([Русский](../browser-compatibility.ru.md)): ingestelde doelen, kleurrijke diagrammen, controles van de exacte pakketten en aparte lokale resultaten.

- [Implementatieverslag en gekleurde diagrammen](../implementation-report.nl.md) ([Русский](../implementation-report.ru.md)): beoordeelde wijzigingen, herstelde regressies, gemeten uitvoer en resterende releasevoorwaarden.

<a id="use-the-new-capabilities"></a>

## Nieuwe mogelijkheden gebruiken

- [Functielevering en platformgrenzen](../roadmap-delivery.nl.md) ([Русский](../roadmap-delivery.ru.md)).
- [Kwaliteitsgrenzen, expliciete live-reservebronnen en begrensd herstel](../playback-stream-policy.nl.md) ([Русский](../playback-stream-policy.ru.md)).
- [Handmatige XMLTV-koppeling en klassieke toegankelijkheid](../guide-binding-accessibility.nl.md) ([Русский](../guide-binding-accessibility.ru.md)).
- [Gehoste beeld-en-geluidcontrole](../audio-video-check.nl.md) ([Русский](../audio-video-check.ru.md)): **Informatie → Audio → Afspelen**, verwachte tonen, hostingdiagram en terugkeer naar live-tv. De clip wordt op aanvraag opgehaald, vereist internet en zit niet in de spelerpakketten. De aparte online demonstratie met bewegend patroon is stil.
- [Xtream-film-/seriebibliotheek](../xtream-media.nl.md) ([Русский](../xtream-media.ru.md)).
- [Speleroverdracht met dezelfde bron](../remote-handoff.nl.md) ([Русский](../remote-handoff.ru.md)).
- [Lokaal instellingenjournaal en herstel](../settings-recovery.nl.md) ([Русский](../settings-recovery.ru.md)).
- [Betrouwbare bediening, hervatbare profielen en overdracht](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.md) ([Русский](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.ru.md)). Vereist een passende controller-/CLI-revisie en ingestelde rechten.
- [Semantische audio-/ondertitelvoorkeuren in native Android](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.md) ([Русский](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.ru.md)). De native Kotlin-app staat los van de Capacitor-APK’s van deze repository.

<a id="configure-sources-and-inspect-problems"></a>

## Bronnen instellen en problemen onderzoeken

- [Plex-aanmelding en afspelen](../plex-provider.md), [gidsarchitectuur](../guide-architecture.md) en [gehoste EPG-diagnostiek](../hosted-epg-diagnostics.md).
- [Interface-instellingen](../interface-settings.md), [ontwerpgeschiedenis en dankbetuigingen](../interface-history.md) en [taalcatalogi/toetsenborden](../localization.md).
- [Werkbank op afstand](../remote-workbench.md), [runtimediagnostiek](../runtime-debug.md) en [diagnostische toestemming, afscherming en bewaartermijnen](../diagnostic-security.md).
- [Checklist voor native apparaten](../mode-b-device-smoke.md), [Tauri-apparatenchecklist](../mode-b-tauri-smoke.md) en [browservensterbediening](../browser-window-controls.md).

- [Gemeten functiekosten](../roadmap-size.nl.md), ruwe meetgegevens en SVG-grafiek.

<a id="develop-and-release"></a>

## Ontwikkelen en uitbrengen

- [Architectuur en eigenaarschap](../architecture.md), [afspeelsessies](../playback-session-architecture.md) en [klassieke ES5-build](../build-pipeline.md).
- [Namen van runtimebestanden](../asset-layout.md), [releasebeleid](../../RELEASING.md), [draaiboek voor releases](../release-workflow.md) en [RC-fuzzing](../../FUZZING.md).
- [Privacybeleid](../privacy-policy.md) en [MIT-licentie](../../LICENSE).

Voer bij documentatiewijzigingen `npm run docs:generate` uit als een UI-tekst of snelstartsjabloon verandert en daarna `npm run check:docs`. Houd alle vertalingen volledig, vermeld functiebeperkingen bij de claims en onderscheid lokale validatie van tests op fysieke apparaten. Diagrammen zijn controleerbare repositorybestanden; zie [de SVG voor gidskoppeling](../images/guide-binding.svg) en de diagrammen waarnaar de functiegidsen verwijzen. De controle valideert relatieve bestandsbestemmingen, niet de bereikbaarheid van externe websites of elk Markdown-kopanker.
