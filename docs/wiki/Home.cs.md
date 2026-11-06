<a id="ott-play-documentation-wiki"></a>

# Dokumentační wiki OTT-play

<!-- language-navigation:start -->
<p dir="ltr">
<a href="Home.md" lang="en" dir="ltr">English</a> · <a href="Home.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="Home.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="Home.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="Home.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="Home.es.md" lang="es" dir="ltr">Español</a> · <a href="Home.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="Home.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="Home.he.md" lang="he" dir="rtl">עברית</a> · <a href="Home.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="Home.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="Home.it.md" lang="it" dir="ltr">Italiano</a> · <a href="Home.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="Home.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="Home.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="Home.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="Home.pt.md" lang="pt" dir="ltr">Português</a> · <a href="Home.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="Home.th.md" lang="th" dir="ltr">ไทย</a> · <a href="Home.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="Home.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="Home.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="Home.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="Home.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[README](../../README.cs.md) · [Všechny jazyky rozhraní](../readme/README.md)

Toto je úvodní stránka verzované dokumentace ve zdrojovém repozitáři. GitHub umí tyto stránky Markdown zobrazit přímo; jejich údržba zde udržuje návody, diagramy a testy ve stejné revizi jako kód. Samostatná [GitHub Wiki](https://github.com/open-ott-play/ottplay-foss/wiki) se exportuje z těchto zdrojů a na každé stránce uvádí zdrojovou revizi. Viz [pokyny k publikování](../wiki-publishing.md).

<a id="start-and-install"></a>

## Spuštění a instalace

- [Praktická příručka](../../README.cs.md), dostupná ve [24 jazycích dokumentace](../manual-translations.md).
- [Lokalizované rychlé začátky pro všech 88 jazyků rozhraní](../readme/README.md). Znovu používají přeložené popisky a navigační kroky. Nejde o 88 přeložených technických příruček. Hlavní příručka a související průvodci funkcemi mají úplná vydání ve 24 jazycích.
- [Balíčky a aktualizace Android Full/API 22](../android-distributions.md), [sestavení Androidu](../../android/README.md) a [Capacitor iOS/Android](../capacitor-mobile.md).
- [Desktopové vydání pro macOS](../macos-local-delivery.md), [podepisování/aktualizátor Tauri](../tauri-updater-notarize.md) a [místní instance HTTP](../local-http-deployment.md).

<a id="process-and-results"></a>

## Postup a výsledky

- [Kvalifikace prohlížečů a ověření kandidáta](../browser-compatibility.cs.md) ([Русский](../browser-compatibility.ru.md)): nakonfigurované cíle, barevné diagramy, kontroly přesných balíčků a oddělené místní výsledky.

- [Zpráva o implementaci a barevné diagramy](../implementation-report.cs.md) ([Русский](../implementation-report.ru.md)): zkontrolované změny, opravené regrese, naměřené výsledky a zbývající podmínky vydání.

<a id="use-the-new-capabilities"></a>

## Použití nových možností

- [Dodání funkcí a hranice platforem](../roadmap-delivery.cs.md) ([Русский](../roadmap-delivery.ru.md)).
- [Stropy kvality, explicitní záložní živé zdroje a omezená obnova](../playback-stream-policy.cs.md) ([Русский](../playback-stream-policy.ru.md)).
- [Ruční přiřazení XMLTV a klasická přístupnost](../guide-binding-accessibility.cs.md) ([Русский](../guide-binding-accessibility.ru.md)).
- [Hostovaná kontrola obrazu a zvuku](../audio-video-check.cs.md) ([Русский](../audio-video-check.ru.md)): **Informace → Zvuk → Přehrát**, očekávané tóny, diagram hostování a návrat k živé TV. Klip se načítá na požádání, vyžaduje internet a není v balíčcích přehrávače. Samostatná online ukázka pohyblivého vzoru je bez zvuku.
- [Knihovna filmů/seriálů Xtream](../xtream-media.cs.md) ([Русский](../xtream-media.ru.md)).
- [Předání přehrávače při stejném zdroji](../remote-handoff.cs.md) ([Русский](../remote-handoff.ru.md)).
- [Místní žurnál nastavení a obnova](../settings-recovery.cs.md) ([Русский](../settings-recovery.ru.md)).
- [Spolehlivé ovládání, obnovitelné profily a předání](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.md) ([Русский](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.ru.md)). Vyžaduje odpovídající revizi ovladače/CLI a nastavená oprávnění.
- [Sémantické preference zvuku/titulků v nativním Androidu](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.md) ([Русский](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.ru.md)). Nativní aplikace Kotlin je oddělená od APK Capacitor v tomto repozitáři.

<a id="configure-sources-and-inspect-problems"></a>

## Nastavení zdrojů a zkoumání problémů

- [Přihlášení a přehrávání Plex](../plex-provider.md), [architektura průvodce](../guide-architecture.md) a [hostovaná diagnostika EPG](../hosted-epg-diagnostics.md).
- [Nastavení rozhraní](../interface-settings.md), [historie návrhu a poděkování](../interface-history.md) a [jazykové katalogy/klávesnice](../localization.md).
- [Vzdálené pracovní prostředí](../remote-workbench.md), [běhová diagnostika](../runtime-debug.md) a [souhlas, začernění a uchovávání diagnostiky](../diagnostic-security.md).
- [Kontrolní seznam nativních zařízení](../mode-b-device-smoke.md), [seznam zařízení Tauri](../mode-b-tauri-smoke.md) a [ovládání okna prohlížeče](../browser-window-controls.md).

- [Změřené náklady funkcí](../roadmap-size.cs.md), surové podklady a graf SVG.

<a id="develop-and-release"></a>

## Vývoj a vydávání

- [Architektura a odpovědnosti](../architecture.md), [relace přehrávání](../playback-session-architecture.md) a [klasické sestavení ES5](../build-pipeline.md).
- [Názvy běhových souborů](../asset-layout.md), [pravidla vydávání](../../RELEASING.md), [provozní příručka vydání](../release-workflow.md) a [fuzzing RC](../../FUZZING.md).
- [Zásady ochrany soukromí](../privacy-policy.md) a [licence MIT](../../LICENSE).

Při změně dokumentace spusťte `npm run docs:generate`, pokud se změnil popisek rozhraní nebo šablona rychlého začátku, a poté `npm run check:docs`. Udržujte všechny překlady úplné, omezení schopností uvádějte vedle tvrzení a rozlišujte místní ověřování od testů na fyzických zařízeních. Diagramy jsou kontrolovatelné soubory repozitáře; viz [SVG přiřazení průvodce](../images/guide-binding.svg) a diagramy odkazované z průvodců funkcemi. Kontrola ověřuje relativní cíle souborů, nikoli dostupnost vzdálených webů nebo každou kotvu nadpisu Markdown.
