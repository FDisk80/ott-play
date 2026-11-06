<a id="ott-play-documentation-wiki"></a>

# Dokumentations-Wiki von OTT-play

<!-- language-navigation:start -->
<p dir="ltr">
<a href="Home.md" lang="en" dir="ltr">English</a> · <a href="Home.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="Home.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="Home.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="Home.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="Home.es.md" lang="es" dir="ltr">Español</a> · <a href="Home.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="Home.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="Home.he.md" lang="he" dir="rtl">עברית</a> · <a href="Home.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="Home.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="Home.it.md" lang="it" dir="ltr">Italiano</a> · <a href="Home.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="Home.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="Home.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="Home.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="Home.pt.md" lang="pt" dir="ltr">Português</a> · <a href="Home.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="Home.th.md" lang="th" dir="ltr">ไทย</a> · <a href="Home.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="Home.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="Home.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="Home.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="Home.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[README](../../README.de.md) · [Alle Oberflächensprachen](../readme/README.md)

Dies ist die versionierte Dokumentationsstartseite im Quellrepository. GitHub kann diese Markdown-Seiten direkt darstellen; hier bleiben Anleitungen, Diagramme und Tests in derselben Prüfung wie der Code. Das separate [GitHub Wiki](https://github.com/open-ott-play/ottplay-foss/wiki) wird aus diesen Quellen exportiert und nennt auf jeder Seite seine Quellrevision. Siehe die [Veröffentlichungsanleitung](../wiki-publishing.md).

<a id="start-and-install"></a>

## Start und Installation

- [Praktischer Leitfaden](../../README.de.md), verfügbar in [24 Dokumentationssprachen](../manual-translations.md).
- [Lokalisierte Schnellstarts für alle 88 Oberflächensprachen](../readme/README.md). Sie verwenden übersetzte UI-Beschriftungen und Navigationsschritte wieder. Es sind keine 88 übersetzten technischen Handbücher. Das Haupthandbuch und die zugehörigen Funktionsleitfäden liegen vollständig in 24 Dokumentationssprachen vor.
- [Android-Full/API-22-Pakete und Updates](../android-distributions.md), [Android-Build](../../android/README.md) und [Capacitor iOS/Android](../capacitor-mobile.md).
- [Desktop-Auslieferung unter macOS](../macos-local-delivery.md), [Tauri-Signierung/Updater](../tauri-updater-notarize.md) und [lokale HTTP-Instanzen](../local-http-deployment.md).

<a id="process-and-results"></a>

## Ablauf und Ergebnisse

- [Browserqualifikation und Kandidatenprüfung](../browser-compatibility.de.md) ([Русский](../browser-compatibility.ru.md)): konfigurierte Ziele, farbige Diagramme, Prüfungen exakter Pakete und separate lokale Ergebnisse.

- [Implementierungsbericht und farbige Diagramme](../implementation-report.de.md) ([Русский](../implementation-report.ru.md)): geprüfte Änderungen, behobene Regressionen, gemessene Ausgabe und verbleibende Freigabekriterien.

<a id="use-the-new-capabilities"></a>

## Neue Möglichkeiten nutzen

- [Funktionsauslieferung und Plattformgrenzen](../roadmap-delivery.de.md) ([Русский](../roadmap-delivery.ru.md)).
- [Qualitätsobergrenzen, explizite Live-Ersatzquellen und begrenzte Wiederherstellung](../playback-stream-policy.de.md) ([Русский](../playback-stream-policy.ru.md)).
- [Manuelle XMLTV-Zuordnung und klassische Barrierefreiheit](../guide-binding-accessibility.de.md) ([Русский](../guide-binding-accessibility.ru.md)).
- [Gehosteter Bild-und-Ton-Test](../audio-video-check.de.md) ([Русский](../audio-video-check.ru.md)): **Information → Audio → Wiedergabe**, erwartete Töne, Hosting-Diagramm und Rückkehr zum Live-TV. Der Clip wird bei Bedarf geladen, erfordert Internet und fehlt in den Player-Paketen. Die separate Online-Demo mit bewegtem Muster ist stumm.
- [Xtream-Film-/Serienbibliothek](../xtream-media.de.md) ([Русский](../xtream-media.ru.md)).
- [Player-Übergabe bei gleicher Quelle](../remote-handoff.de.md) ([Русский](../remote-handoff.ru.md)).
- [Lokales Einstellungsjournal und Wiederherstellung](../settings-recovery.de.md) ([Русский](../settings-recovery.ru.md)).
- [Zuverlässige Steuerung, fortsetzbare Profile und Übergabe](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.md) ([Русский](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.ru.md)). Erfordert eine passende Controller-/CLI-Revision und konfigurierte Berechtigungen.
- [Semantische Audio-/Untertitelpräferenzen in nativem Android](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.md) ([Русский](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.ru.md)). Die native Kotlin-Anwendung ist von den Capacitor-APKs dieses Repositorys getrennt.

<a id="configure-sources-and-inspect-problems"></a>

## Quellen einrichten und Probleme untersuchen

- [Plex-Anmeldung und Wiedergabe](../plex-provider.md), [Programmführer-Architektur](../guide-architecture.md) und [gehostete EPG-Diagnose](../hosted-epg-diagnostics.md).
- [Oberflächeneinstellungen](../interface-settings.md), [Designgeschichte und Danksagungen](../interface-history.md) und [Sprachkataloge/Tastaturen](../localization.md).
- [Remote-Werkbank](../remote-workbench.md), [Laufzeitdiagnose](../runtime-debug.md) und [Diagnoseeinwilligung, Schwärzung und Aufbewahrung](../diagnostic-security.md).
- [Checkliste für native Geräte](../mode-b-device-smoke.md), [Tauri-Gerätecheckliste](../mode-b-tauri-smoke.md) und [Browser-Fenstersteuerung](../browser-window-controls.md).

- [Gemessene Funktionskosten](../roadmap-size.de.md), Rohdaten und SVG-Diagramm.

<a id="develop-and-release"></a>

## Entwicklung und Veröffentlichung

- [Architektur und Zuständigkeiten](../architecture.md), [Wiedergabesitzungen](../playback-session-architecture.md) und [klassischer ES5-Build](../build-pipeline.md).
- [Namen der Laufzeitressourcen](../asset-layout.md), [Release-Richtlinie](../../RELEASING.md), [Betriebshandbuch für Releases](../release-workflow.md) und [RC-Fuzzing](../../FUZZING.md).
- [Datenschutzrichtlinie](../privacy-policy.md) und [MIT-Lizenz](../../LICENSE).

Führen Sie bei Dokumentationsänderungen `npm run docs:generate` aus, wenn sich eine UI-Beschriftung oder Schnellstartvorlage ändert, danach `npm run check:docs`. Halten Sie alle Handbuchübersetzungen vollständig, nennen Sie Funktionsgrenzen direkt bei den Aussagen und unterscheiden Sie lokale Validierung von Tests auf physischen Geräten. Diagramme sind prüfbare Repository-Dateien; siehe [das SVG zur Programmführer-Zuordnung](../images/guide-binding.svg) und die in den Funktionsleitfäden verlinkten Diagramme. Der Prüfer validiert relative Dateiziele, nicht die Erreichbarkeit externer Websites oder jeden Markdown-Überschriftenanker.
