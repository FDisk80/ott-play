<a id="ott-play-documentation-wiki"></a>

# Wiki dokumentacji OTT-play

<!-- language-navigation:start -->
<p dir="ltr">
<a href="Home.md" lang="en" dir="ltr">English</a> · <a href="Home.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="Home.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="Home.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="Home.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="Home.es.md" lang="es" dir="ltr">Español</a> · <a href="Home.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="Home.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="Home.he.md" lang="he" dir="rtl">עברית</a> · <a href="Home.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="Home.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="Home.it.md" lang="it" dir="ltr">Italiano</a> · <a href="Home.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="Home.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="Home.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="Home.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="Home.pt.md" lang="pt" dir="ltr">Português</a> · <a href="Home.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="Home.th.md" lang="th" dir="ltr">ไทย</a> · <a href="Home.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="Home.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="Home.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="Home.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="Home.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[README](../../README.pl.md) · [Wszystkie języki interfejsu](../readme/README.md)

To strona główna wersjonowanej dokumentacji w repozytorium źródłowym. GitHub może bezpośrednio wyświetlać te strony Markdown; utrzymywanie ich tutaj pozwala przeglądać instrukcje, diagramy i testy razem z kodem. Oddzielna [GitHub Wiki](https://github.com/open-ott-play/ottplay-foss/wiki) jest eksportowana z tych źródeł i podaje rewizję źródła na każdej stronie. Zobacz [instrukcje publikacji](../wiki-publishing.md).

<a id="start-and-install"></a>

## Uruchomienie i instalacja

- [Praktyczny przewodnik](../../README.pl.md), dostępny w [24 językach dokumentacji](../manual-translations.md).
- [Zlokalizowane szybkie starty dla wszystkich 88 języków interfejsu](../readme/README.md). Wykorzystują przetłumaczone etykiety UI i kroki nawigacji. To nie 88 przetłumaczonych podręczników technicznych. Główny podręcznik i powiązane przewodniki po funkcjach mają pełne wydania w 24 językach.
- [Pakiety i aktualizacje Android Full/API 22](../android-distributions.md), [kompilacja Android](../../android/README.md) i [Capacitor iOS/Android](../capacitor-mobile.md).
- [Wydanie desktopowe na macOS](../macos-local-delivery.md), [podpisywanie/aktualizator Tauri](../tauri-updater-notarize.md) i [lokalne instancje HTTP](../local-http-deployment.md).

<a id="process-and-results"></a>

## Proces i wyniki

- [Kwalifikacja przeglądarek i weryfikacja kandydata](../browser-compatibility.pl.md) ([Русский](../browser-compatibility.ru.md)): skonfigurowane cele, kolorowe diagramy, kontrole dokładnych pakietów i oddzielne wyniki lokalne.

- [Raport z implementacji i kolorowe diagramy](../implementation-report.pl.md) ([Русский](../implementation-report.ru.md)): przejrzane zmiany, naprawione regresje, zmierzone wyniki i pozostałe warunki wydania.

<a id="use-the-new-capabilities"></a>

## Korzystanie z nowych możliwości

- [Dostarczanie funkcji i granice platform](../roadmap-delivery.pl.md) ([Русский](../roadmap-delivery.ru.md)).
- [Pułapy jakości, jawne zapasowe źródła transmisji i ograniczone odzyskiwanie](../playback-stream-policy.pl.md) ([Русский](../playback-stream-policy.ru.md)).
- [Ręczne powiązanie XMLTV i klasyczna dostępność](../guide-binding-accessibility.pl.md) ([Русский](../guide-binding-accessibility.ru.md)).
- [Hostowany test obrazu i dźwięku](../audio-video-check.pl.md) ([Русский](../audio-video-check.ru.md)): **Informacje → Audio → Odtwórz**, oczekiwane tony, diagram hostingu i powrót do telewizji na żywo. Klip jest pobierany na żądanie, wymaga internetu i nie jest zawarty w pakietach odtwarzacza. Oddzielne internetowe demo ruchomego wzoru jest nieme.
- [Biblioteka filmów/seriali Xtream](../xtream-media.pl.md) ([Русский](../xtream-media.ru.md)).
- [Przekazanie odtwarzacza w obrębie tego samego źródła](../remote-handoff.pl.md) ([Русский](../remote-handoff.ru.md)).
- [Lokalny dziennik ustawień i odzyskiwanie](../settings-recovery.pl.md) ([Русский](../settings-recovery.ru.md)).
- [Niezawodne sterowanie, wznawialne profile i przekazanie](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.md) ([Русский](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.ru.md)). Wymaga zgodnej rewizji kontrolera/CLI i skonfigurowanych uprawnień.
- [Semantyczne preferencje audio/napisów w natywnym Androidzie](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.md) ([Русский](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.ru.md)). Natywna aplikacja Kotlin jest oddzielna od APK Capacitor z tego repozytorium.

<a id="configure-sources-and-inspect-problems"></a>

## Konfigurowanie źródeł i badanie problemów

- [Logowanie i odtwarzanie Plex](../plex-provider.md), [architektura przewodnika](../guide-architecture.md) i [hostowana diagnostyka EPG](../hosted-epg-diagnostics.md).
- [Ustawienia interfejsu](../interface-settings.md), [historia projektu i podziękowania](../interface-history.md) oraz [katalogi językowe/klawiatury](../localization.md).
- [Zdalny warsztat](../remote-workbench.md), [diagnostyka wykonania](../runtime-debug.md) i [zgoda, redakcja i przechowywanie diagnostyki](../diagnostic-security.md).
- [Lista kontrolna urządzeń natywnych](../mode-b-device-smoke.md), [lista urządzeń Tauri](../mode-b-tauri-smoke.md) i [sterowanie oknem przeglądarki](../browser-window-controls.md).

- [Zmierzony koszt funkcji](../roadmap-size.pl.md), surowe dane i wykres SVG.

<a id="develop-and-release"></a>

## Rozwój i wydawanie

- [Architektura i odpowiedzialność](../architecture.md), [sesje odtwarzania](../playback-session-architecture.md) i [klasyczna kompilacja ES5](../build-pipeline.md).
- [Nazwy zasobów wykonania](../asset-layout.md), [polityka wydań](../../RELEASING.md), [instrukcja operacyjna wydania](../release-workflow.md) i [fuzzing RC](../../FUZZING.md).
- [Polityka prywatności](../privacy-policy.md) i [licencja MIT](../../LICENSE).

Przy zmianach dokumentacji uruchom `npm run docs:generate`, gdy zmieni się etykieta UI lub szablon szybkiego startu, a następnie `npm run check:docs`. Zachowuj pełne tłumaczenia, umieszczaj ograniczenia obok twierdzeń i odróżniaj lokalną walidację od testów fizycznych urządzeń. Diagramy to przeglądalne zasoby repozytorium; zobacz [SVG powiązania przewodnika](../images/guide-binding.svg) i diagramy z przewodników funkcji. Kontrola sprawdza względne cele plików, nie dostępność zdalnych stron ani każdą kotwicę nagłówka Markdown.
