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

Pliki lokalne bez Internetu: zobacz [Lokalne wideo i odtwarzanie offline](docs/offline-media.md).

[![Przeglądarka kanałów OTT-play FOSS w perspektywie](docs/images/hero.png)](docs/images/studio-2026-default.png)

*Istniejący zrzut interfejsu Studio 2026 z syntetycznymi danymi kanałów i programów.
Otwórz obraz, aby zobaczyć oryginalny płaski widok; nie przedstawia on aktywnej subskrypcji.
[Źródło obrazu i ponowne generowanie](docs/images/README.md).*

[Szybki start w 88 językach](docs/readme/README.md) · [Wiki dokumentacji](docs/wiki/Home.pl.md)

[![Dobre praktyki OpenSSF](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![Fuzzing: tylko RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

Publiczne wersje kandydujące przechodzą ograniczone, izolowane kampanie fuzzingu dotyczące natywnego/serwerowego parsowania XMLTV i walidacji żądań portali. Zobacz [zakres fuzzingu, odtwarzanie testów i dowody wydania](FUZZING.md).

Samodzielny odtwarzacz IPTV/OTT z lokalnym serwerem HTTP w Rust. Działa na Smart TV (LG WebOS, Samsung Tizen, Panasonic, Sony itd.), dekoderach (Infomir MAG, Dune HD, Enigma2, Android TV) i w przeglądarkach komputerowych.

Zacznij od [przewodnika po architekturze i współtworzeniu](docs/architecture.md), który opisuje warstwy wykonawcze, odpowiedzialność, rozszerzanie dostawców i weryfikację. [Sesje odtwarzania i cykl życia dostawców](docs/playback-session-architecture.md) opisują granicę między rdzeniem a hostem oraz kontrakty zgodności.

<!-- ci-release-process:start -->
<a id="release-process"></a>

## Proces wydawania

Zobacz [strategię wydań](RELEASING.md), aby poznać reguły walidacji oraz promocji nightly, beta, RC i stable, a [instrukcję operacyjną](docs/release-workflow.md), aby znaleźć polecenia lokalne.
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## Uruchamianie w przeglądarce

Otwórz [działające demo](https://player.ottplay.here.now/) albo zbuduj i udostępnij odtwarzacz internetowy zgodnie z instrukcjami poniżej.

[Lokalne wdrożenie macOS](docs/local-http-deployment.md) udostępnia źródła HTTP odtwarzacza na portach 8443–8446. Port 8095 został wycofany.

Przy pierwszym uruchomieniu wybierz **Wypróbuj demo**, aby odtworzyć ruchomą planszę testową, albo skonfiguruj własną listę M3U lub dostawcę. Demo jest później dostępne przez **Zmień dostawcę → Demo**.

Tryb demo wymaga Internetu, ale nie konta dostawcy. Nieme kanały testowe MP4 i HLS są hostowane na here.now i współdzielone przez odtwarzacz WWW, Tauri, Capacitor oraz OTT Server. Przełączanie zachowuje istniejące ustawienia dostawców. Aby wykonać osobny **test obrazu i dźwięku**, otwórz **Informacje → Dźwięk → Odtwórz** w zarządzanym silniku HTML5 podczas bezczynności lub oglądania telewizji na żywo. Używany jest dźwiękowy plik testowy `av-v1.mp4` z here.now, więc potrzebny jest Internet. Klip nie znajduje się w pakietach odtwarzacza i nigdy nie jest pobierany przy starcie. VOD, archiwum i wymuszone silniki urządzeń (w tym PC2/Video.js oraz silniki natywne) są wyłączone z tego testu; zobacz [kroki, oczekiwane dźwięki i diagram hostowania](docs/audio-video-check.pl.md).

Zainstalowane okna przeglądarki komputerowej obsługują **Window Controls Overlay**: Chrome może ukryć osobny pasek tytułu, zachowując przyciski okna i menu aplikacji nad odtwarzaczem. Otwórz zainstalowaną aplikację i wybierz **Ukryj pasek tytułu**, gdy Chrome zaoferuje tę opcję; **Pokaż pasek tytułu** przywraca zwykłą ramkę. Zwykłe karty oraz układy telewizyjne i natywne zachowują dotychczasowe działanie. Zobacz [sterowanie oknem przeglądarki](docs/browser-window-controls.md), aby poznać obsługiwane adresy instalacyjne, aktualizację istniejącego skrótu i weryfikację.

Do przewijania o dziesięć sekund w głównym widoku wideo używaj **Alt/Option + Lewo/Prawo** (w macOS działa również **Command + Lewo/Prawo**), zarówno na pełnym ekranie, jak i w zwykłym widoku. Lokalne wideo, VOD i obsługiwane archiwa kanałów używają tych samych klawiszy w WWW, Tauri i Capacitor. Zobacz [skróty klawiaturowe i ograniczenia](docs/browser-window-controls.md#playback-keyboard-shortcuts).

W interfejsie PC klawisz **R** odtwarza inny losowy kanał lub film z bieżącej listy, nie zmieniając jej kolejności. Działa w głównym widoku wideo i listach kanałów/filmów; pola tekstowe, okna dialogowe, ustawienia i ograniczenia kiosku mają pierwszeństwo. Pozostałe mapowania klawiszy urządzeń nie zmieniają się.

Syntetyczną planszę testową można odtworzyć przez `scripts/generate-demo-media.sh` (wymaga FFmpeg); wygenerowane media pozostają w ignorowanym katalogu `.local-artifacts`.

<a id="features"></a>

## Funkcje

- **Odtwarzanie**: HLS, DASH i zwykłe strumienie HTTP, zarządzane limity jakości HLS.js/Shaka, ograniczone odzyskiwanie i maksymalnie trzy jawne zapasowe adresy URL na kanał na żywo. Archiwum/VOD nigdy nie przełącza się na zapasowy strumień na żywo; zobacz [jakość i odzyskiwanie](docs/playback-stream-policy.pl.md).
- **EPG**: dopasowanie XMLTV, przesunięcie czasowe/catch-up, wyszukiwanie tytułów programów (N5 w EPG), przypomnienia i ręczne przypisanie źródła/ID do konkretnego kanału w hostowanej/natywnej ścieżce XMLTV. Zobacz [powiązania i dostępność](docs/guide-binding-accessibility.pl.md).
- **Ulubione**: jedna uporządkowana [kolekcja mieszana](docs/mixed-favorites.md) obejmująca skonfigurowanych dostawców i profile na obsługiwanych urządzeniach, z przenośnym eksportem/importem przez CLI; PIN rodzicielski. W trybie zastępczym nadal dostępne są listy ulubionych poszczególnych źródeł.
- **Ustawienia**: eksport/import JSON ustawień i ulubionych, dziennik cofania obsługiwanych partii localStorage, wznawianie archiwum uwzględniające źródło i dokładne porównywanie zapisanych ustawień dla procedur kontrolera. Odzyskiwanie zakłada jednego zapisującego; niestandardowe adaptery pamięci zachowują wycofywanie na zasadzie best effort. Zobacz [odzyskiwanie ustawień](docs/settings-recovery.pl.md).
- **Wspólny interfejs**: OTT Server, Tauri i Capacitor używają tego samego motywu i ustawień widoczności listy kanałów. Ustawienia [kolorów interfejsu](docs/interface-colors.md) oferują dziewięć ról kolorów, paletę, dokładne wprowadzanie wartości HEX/RGB/HSV i pięć schematów i są zapisywane dla danego klienta; ustawienia listy kontrolują nazwy, picony, bieżące programy, postęp i znaczniki archiwum.
- **Dostawcy**: M3U/M3U8, telewizja Xtream na żywo oraz [katalogi filmów/seriali na żądanie](docs/xtream-media.pl.md), Stalker/Ministra z [filmami i zagnieżdżonymi odcinkami](docs/stalker-media.md), Plex i VPortal. Możliwości dostawcy i dostęp konta określają dostępne funkcje archiwum i biblioteki mediów.
- **Polecenia push**: sterowanie przez webhook — zmiana kanału, dostawcy, listy i wyświetlanie komunikatów
- **Zdalne wpisywanie tekstu (swop)**: klawiatura telefonu przez Cloudflare Worker, gdy telewizor i telefon są w różnych sieciach (sesje autoryzowane dla instalacji; ♥™ na klawiaturze ekranowej)
- **Kierowanie do urządzeń**: adresowanie UUID w instalacjach wielourządzeniowych
- **Lokalne proxy**: opcjonalny lokalny serwer poleceń do całkowicie lokalnej automatyzacji (bez serwera centralnego)
- **Integracja kontrolera**: operatorzy ograniczeni do urządzeń/działań, opcjonalne trwałe wyniki poleceń, wznawialne stosowanie profili Local/Home oraz przekazywanie odtwarzania live/archiwum z tego samego źródła przez zgodny [serwer sterowania](https://github.com/open-ott-play/ottplay-control-server). Wymagają aktualnego kontrolera/CLI; samodzielna karta przeglądarki ich nie dostarcza.
- **Typowane preferencje zdalne**: wykrywaj ustawienia, odczytuj wartości zapisane i obowiązujące oraz zapisuj z kontrolą instancji wykonawczej, źródła i rewizji; zobacz [ustawienia zdalne i konfigurację VPortal](docs/remote-player-settings.md).
- **Debugowanie**: opcjonalny HUD odtwarzania/log pierścieniowy przez `?debug=1`, zdalna inspekcja za zgodą i hostowany test audio/wideo na żądanie
- **Dostępność klawiatury**: nazwane klasyczne okna dialogowe, zatrzymywanie i przywracanie fokusu Tab, semantyka zaznaczonego kanału i nieprzerywające komunikaty stanu. Te ulepszenia nie oznaczają pełnej zgodności z WCAG ani czytnikami ekranu urządzeń.
- **24 typy urządzeń**: mapowania klawiszy pilota zależne od urządzenia
- **88 języków interfejsu**: zgodne katalogi, [zlokalizowane przewodniki startowe](docs/readme/README.md) i [alfabety klawiatur sprawdzone według CLDR](docs/localization.md). Główna instrukcja i powiązane przewodniki funkcji są dostępne w [24 językach dokumentacji](docs/manual-translations.md); pozostałe materiały inżynierskie zachowują istniejące języki.

[Przewodnik dostarczenia](docs/roadmap-delivery.pl.md) opisuje funkcje wdrożone w tej rewizji źródeł, granice platform, diagramy i weryfikację. Zainstalowane wydania lub wdrożenia hostowane mogą używać starszej rewizji. Niezależna natywna [aplikacja Android](https://github.com/open-ott-play/ottplay-android) zachowuje również wybory audio/napisów według języka, roli i etykiety zamiast indeksów manifestu; jej implementacja i wydania są niezależne od tego frontendu.

[Przegląd kodu źródłowego STB](docs/stb-player-improvements.md) opisuje ulepszenia dotyczące multimediów, zasobów i odzyskiwania, porównania źródeł oraz aktualne ograniczenia.

<a id="debug-hud"></a>

## HUD debugowania

Lokalny HUD i trwałe logowanie serwera mają osobne zgody. Przed zbieraniem logów z innych urządzeń zobacz [dostęp diagnostyczny, redakcję i przechowywanie](docs/diagnostic-security.md).

Włącz debugowanie jednym ze sposobów:
- URL: `?debug=1` lub `?debug=true`
- Pamięć lokalna: `localStorage.setItem("ottplay_debug", "1")`
- Właściwość okna: `window.__OTT_DEBUG__ = true`
- Serwer: gdy `/debug/config` zwraca `{enabled: true}`

Gdy debugowanie jest aktywne:
- Naciśnij **D**, aby przełączyć pasek HUD (`ottDebugSetHud` / `__ottDebug.toggleHud()`)
  - Pomija działanie, gdy fokus jest w INPUT/TEXTAREA/listEdit
  - Używa `e.key`, aby uniknąć konfliktu MAG/Maple PLAY/PREV=68
- Menu Informacje → **HUD debugowania** → wywołuje `__ottDebug.toggleHud()`
- Zarządzaj ustawieniami → **HUD debugowania**:
  - Jeśli debugowanie już załadowano: przełącza widoczność HUD
  - W przeciwnym razie: ustawia `ottplay_debug=1` + `ottplay_debug_hud=1` i prosi o restart
- Trwałość: `ottDebugSetHud` zapisuje stan HUD w `localStorage.ottplay_debug_hud` ("1"/"0")

<a id="capacitor-ios-and-android"></a>

## Capacitor dla iOS i Androida

To repozytorium pakuje wspólny frontend TypeScript przez Capacitor dla iOS i Androida 7+. Oba używają czcionek systemowych i natywnego środowiska przypiętego przez npm. Oddzielny APK zgodności API 22 obsługuje Androida 5.1/6 z WebView 60 lub nowszym. Oba APK Androida są podpisane i wchodzą w skład zakwalifikowanych wydań beta, RC i stable, obok niepodpisanego IPA iOS. Niezależna aplikacja Kotlin pozostaje w [ottplay-android](https://github.com/open-ott-play/ottplay-android).

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

Zobacz [konfigurację Capacitor](docs/capacitor-mobile.md) oraz [dystrybucję Androida i aktualizacje zdalne](docs/android-distributions.md).

Interfejs iOS używa orientacji poziomej. Ustawienia, konfiguracja dostawcy, zgoda na sterowanie zdalne i import/eksport JSON nadal używają wspólnego frontendu. Wielozadaniowość tabletu może zastąpić żądaną orientację.

Na iPhonie przesuwaj pionowo po liście kanałów, aby przewijać wiersze i strony; w górę do dalszych kanałów, w dół do wcześniejszych. Szybki ruch przewija kilka stron i zwalnia do zatrzymania; wolne przeciągnięcie pozostaje precyzyjne. Dotknij ekranu lub naciśnij klawisz nawigacji, aby zatrzymać ruch. Pojedyncze dotknięcie uruchamia kanał pod palcem, nawet gdy zaznaczono inny wiersz. Gest przesunięcia nigdy nie otwiera kanału po podniesieniu palca.

Wideo na iPhonie jest odtwarzane w interfejsie. Dotknij dołu ekranu, aby uzyskać informacje o programie, albo otwórz menu podczas odtwarzania. Obraz w obrazie pozostaje osobną opcją odtwarzania.

Test urządzenia: [lista kontrolna trybu B](docs/mode-b-device-smoke.md) i `./scripts/smoke-capacitor-device.sh --help` (budowanie/synchronizacja tylko dla iOS). Test Tauri na komputerze: [lista kontrolna desktopu](docs/mode-b-tauri-smoke.md).

<a id="installation"></a>

## Instalacja

| Platforma | Pakiet | Uwagi |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Oddzielne kompilacje Apple Silicon i Intel; podpis ad-hoc, jeśli nie skonfigurowano podpisywania Apple |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | Różne dystrybucje |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode lub Homebrew Channel](docs/lg-webos-installation.md); odtwarzacz hostowany, wymaga sieci |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode i podpis lokalny; niepodpisany pakiet TV, odrębny od Family Hub](docs/samsung-tizen-installation.md) |
| **iOS** | `.ipa` przez AltStore / TestFlight / Xcode | Tylko instalacja boczna — jeszcze bez App Store |
| **Android (wspólny frontend)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | Podpisane pakiety Capacitor; wybierz obsługiwaną wersję Androida |
| **Android (natywny Kotlin)** | Oddzielna [aplikacja natywna](https://github.com/open-ott-play/ottplay-android) | Publiczne repozytorium; osobna aplikacja i proces wydawania |

Obsługiwane instalatory są dołączone do zakwalifikowanych wydań GitHub: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **Uwaga:** pakiety macOS używają podpisu ad-hoc, gdy nie ma danych podpisywania Apple; nie zapewnia to Developer ID ani notaryzacji. Instalatory Windows/Linux i pakiety wydań iOS mogą być niepodpisane. iOS wymaga podpisu przed instalacją na urządzeniu fizycznym. Zakwalifikowane APK Android Full i API 22 używają ustalonego certyfikatu podpisu; lokalne kompilacje wydaniowe wymagają skonfigurowanego keystore do utworzenia podpisanych APK.

---

<a id="macos"></a>

### macOS

1. Wybierz żądany tag z [wydań](https://github.com/open-ott-play/ottplay-foss/releases). Skrót do najnowszego wydania wybiera stable, nie beta lub RC.
2. Pobierz `OttPlay.FOSS_*_aarch64-apple-darwin.dmg` dla Apple Silicon albo `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` dla Intel. Są to osobne kompilacje architektur.
3. Otwórz `.dmg` i przeciągnij **OttPlay FOSS.app** do Aplikacji.
4. Sprawdź skopiowany pakiet przed pierwszym uruchomieniem:

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

Udana weryfikacja sprawdza integralność pakietu. `Signature=adhoc` oznacza brak tożsamości programisty uwierzytelnionej przez Apple; nie potwierdza notaryzacji ani zgody Gatekeeper. Nawet przy zaufanym pobraniu i prawidłowym pakiecie macOS może wymagać **Ustawienia systemowe → Prywatność i ochrona → Otwórz mimo to** po pierwszej próbie; zobacz [instrukcje Apple](https://support.apple.com/en-us/102445).

Komunikat o uszkodzeniu aplikacji nie dowodzi, że przyczyną jest wyłącznie kwarantanna. Jeśli podpis nie przejdzie weryfikacji, zachowaj błąd i uzyskaj poprawione wydanie. Nie podpisuj pobranej aplikacji ponownie ani nie usuwaj jej atrybutów, aby nieudaną kontrolę przedstawić jako udaną.

Alternatywne ZIP-y to `OttPlay.FOSS_aarch64-apple-darwin.app.zip` oraz `OttPlay.FOSS_x86_64-apple-darwin.app.zip`. Zobacz [podpisywanie macOS i weryfikację artefaktów](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact) w sprawie rozpakowywania, obrazów dysków i Gatekeeper. Do kompilacji checkoutu i lokalnej instalacji użyj [lokalnego dostarczenia macOS](docs/macos-local-delivery.md).

---

<a id="windows"></a>

### Windows

1. Pobierz `.msi` lub `.exe` z [wydań](https://github.com/open-ott-play/ottplay-foss/releases/latest)
2. Uruchom instalator i wykonaj jego instrukcje
3. Uruchom aplikację z menu Start lub skrótu na pulpicie

---

<a id="linux"></a>

### Linux

Odtwarzanie w Linux wymaga wtyczek GStreamer HLS, H.264 i AAC oprócz WebKitGTK. Pakiety deklarują te zależności multimedialne; AppImage zawiera framework mediów. Zobacz [pakowanie mediów dla Linux](docs/linux-media-packaging.md), aby sprawdzić kodeki oraz odróżnić akceptację przeglądarkową od natywnej.

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

### Instalacja iOS

iOS wymaga podpisu przed instalacją na urządzeniu fizycznym. Użyj AltStore Classic do niepodpisanego IPA wydania albo zbuduj i podpisz źródła przez Xcode. TestFlight wymaga osobnego zaproszenia, jeśli jest oferowany.

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### Opcja 1: AltStore Classic (zalecana do użytku osobistego)

AltServer działa na komputerze; AltStore Classic działa na iPhonie/iPadzie i importuje IPA. Wystarczy bezpłatne konto Apple.

**Wymagania:**

- iPhone/iPad z **iOS/iPadOS 15 lub nowszym** dla bieżącej kompilacji OTT-play.
- Mac lub PC Windows z AltServer i kablem USB do danych.
- Konto Apple do podpisywania i Internet do pobrania wydania.

**Krok 1: jednorazowo skonfiguruj AltStore**

1. Zainstaluj AltServer zgodnie z oficjalną [instrukcją macOS](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) albo [instrukcją Windows](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows). Uruchom go i używaj ikony na pasku menu/w zasobniku.
2. Podłącz urządzenie przez USB, odblokuj je i zaakceptuj pytania o zaufanie komputera/urządzenia. Na Macu sprawdź obecność urządzenia w Finderze.
3. W **menu AltServer → Install AltStore** wybierz urządzenie i przejdź pytania dotyczące konta podpisującego. Poczekaj na powiadomienie o instalacji.
4. Na urządzeniu otwórz **Ustawienia → Ogólne → VPN i zarządzanie urządzeniem** i, jeśli trzeba, zaufaj wpisowi programisty konta podpisującego. Na iOS 16+ włącz **Ustawienia → Prywatność i ochrona → Tryb deweloperski** oraz wykonaj restart i potwierdzenia.
5. Otwórz AltStore na urządzeniu. Jeśli jest już zainstalowany i działa, pomiń konfigurację i pozostaw AltServer uruchomiony do importu poniżej.

**Krok 2: zaimportuj wybrane wydanie na iPhonie/iPadzie**

1. Wybierz dokładny tag ze [wszystkich wydań](https://github.com/open-ott-play/ottplay-foss/releases) i pobierz jego `ottplay-foss-ios-unsigned.ipa` w Safari na urządzeniu. [Skrót do najnowszego wydania](https://github.com/open-ott-play/ottplay-foss/releases/latest) wybiera stable; użyj pełnej listy, gdy instalujesz betę.
2. Zapisz IPA w Plikach. W **AltStore → My Apps → +** wybierz ten plik. Możesz też przesłać pobrany IPA z Maca przez AirDrop i zapisać go w Plikach przed importem. Otwarcie IPA na Macu nie jest tym krokiem importu.
3. Pozostaw AltServer uruchomiony i kabel USB podłączony, gdy AltStore podpisuje i instaluje aplikację. Aktualizując, używaj tego samego konta podpisującego co istniejąca instalacja; nie usuwaj aplikacji jako pierwszego kroku naprawy.
4. Poczekaj na koniec importu, sprawdź OTT-play w **My Apps** i uruchom go.

**Alternatywa: bezpośrednio zaimportuj URL wydania**

Mając zainstalowany AltStore, wpisz ten wzorzec w **Safari na iPhonie**, zastępując `TAG` dokładnym tagiem wydania, i zaakceptuj **Otwórz w AltStore**:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

Wykorzystuje to [obsługę instalacyjnego URL AltStore](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift). Pozwala uniknąć niejednoznacznych wpisów Pliki/Ostatnie przy kilku pobraniach o tej samej nazwie. URL musi wskazywać plik IPA, a nie stronę wydania.

Na przykład poniższy import zweryfikowano **2026-09-29** w AltStore 2.3 i AltServer 1.8.1. To stały przykład historyczny, a nie odnośnik do najnowszej wersji:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**Odświeżanie:** instalacje z bezpłatnego konta wygasają po siedmiu dniach. Utrzymuj dostęp do AltServer i używaj **AltStore → My Apps → Refresh All** przed wygaśnięciem. Odświeżanie w tle również wymaga dostępu do AltServer; zobacz [instrukcje odświeżania AltStore](https://faq.altstore.io/altstore-classic/your-altstore).

<a id="verify-the-installed-version-before-retrying"></a>

#### Sprawdź zainstalowaną wersję przed ponowną próbą

Komunikat AirDrop „Wysłano” potwierdza tylko transfer. Pasek postępu AltStore potwierdza rozpoczęcie importu. Utrata połączenia Klonowania/USB nie dowodzi nieudanej instalacji: sprawdź zainstalowaną aplikację przed ponownym wysłaniem IPA.

Na Macu z zainstalowanym Xcode wybranym jako aktywny katalog narzędzi deweloperskich sprawdź urządzenie bez ponownej instalacji:

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

W `result.apps` pliku JSON znajdź OTT-play (`bundleIdentifier` zaczyna się od `play.ott.foss`) i porównaj zarówno `version`, jak i `bundleVersion` z `CFBundleShortVersionString` oraz `CFBundleVersion` wybranego IPA. Sufiks konta podpisującego AltStore w identyfikatorze pakietu jest oczekiwany. Zachowaj raport urządzenia lokalnie.

Zweryfikowany przykład beta.9 zgłasza **wersję `1.1.51`, kompilację `2.2.66`**. Potwierdza to instalację; otwarcie aplikacji, logowanie Cloudflare, wczytanie listy, odtwarzanie i PiP to osobne testy urządzenia.

<a id="troubleshooting-ios-installation"></a>

#### Rozwiązywanie problemów z instalacją iOS

- **AltServer nie ma okna albo otwieranie przez automatyzację przekracza limit czasu:** użyj ikony paska menu/zasobnika. To aplikacja działająca w tle. Wielokrotne próby otwarcia zwykłego okna nie wykonują importu IPA.
- **„Could not find AltServer” albo brak urządzenia USB:** sprawdź, czy AltServer działa, odblokuj telefon i sprawdź pytania o zaufanie. Na Macu sprawdź widoczność w Finderze. Po zerwaniu połączenia podłącz ponownie, gdy jest to bezpieczne, a następnie sprawdź zainstalowaną wersję przed powtórką. Jeśli problem trwa, użyj [diagnostyki połączenia AltStore](https://faq.altstore.io/altstore-classic/troubleshooting-guide). Jeśli telefon zapewnia komputerowi Internet, uzgodnij zmianę kabla lub sieci, aby nie przerywać innej pracy.
- **Klonowanie iPhone'a pokazuje „iPhone in Use” lub pozostaje przy „Connecting”:** dokończ konfigurację na fizycznym telefonie albo zablokuj jego ekran i pozostaw obok odblokowanego Maca, aby go klonować. Odblokowanie telefonu kończy klonowanie; zaufanie/konfiguracja USB mogą najpierw wymagać odblokowania. Jeśli pojedyncze ponowne połączenie nie pomaga, zamknij Klonowanie i kontynuuj na telefonie. Zobacz [wymagania Klonowania Apple](https://support.apple.com/en-us/120421). Klonowanie nie jest wymagane do instalacji.
- **URL gubi litery łacińskie albo zamienia je na cyrylicę w Klonowaniu:** ustaw **źródło wprowadzania Maca na ABC/angielski**. Przy aktywnym Klonowaniu naciśnij **Control–Spacja** i wybierz **English (US)** dla klawiatury sprzętowej iPhone'a. Źródła wprowadzania Maca i iPhone'a mogą się różnić; zmiana tylko na Macu nie wystarczyła w naszej zweryfikowanej sesji. Wyczyść pole, wpisz URL ponownie i sprawdź adres przed wysłaniem.
- **Wklejanie do Klonowania zawiesza się lub wstawia nieoczekiwany tekst:** wyczyść pole i wpisuj powoli małymi fragmentami przy źródle English (US) iPhone'a albo wpisz URL bezpośrednio na telefonie. Szybkie wpisywanie przez Klonowanie może pomijać lub powielać znaki; sprawdź cały adres przed zapisem. Nie wysyłaj częściowo wklejonego URL. Wklejanie nie działało w naszej sesji instalacji; nie jest wymagane w metodzie bezpośredniego URL.
- **Pliki/Ostatnie pokazują kilka jednakowych nazw IPA:** wybierz dokładne miejsce pobrania albo użyj powyższego bezpośredniego URL z tagiem. Lokalną kopię można dla jasności nazwać z tagiem/numerem kompilacji; zmiana nazwy nie zmienia zawartości.
- **Zainstalowana aplikacja się nie otwiera:** wykonaj wskazania dotyczące zaufania programisty lub Trybu deweloperskiego na telefonie. Sprawdź wygaśnięcie w AltStore i odśwież w razie potrzeby. Jeśli nadal nie działa, zapisz rzeczywisty błąd; sam błąd połączenia nie jest powodem usuwania i ponownej instalacji.
- **OTT-play otwiera się, ale chroniona lista nie działa przez sieć komórkową:** instalacja i uwierzytelnienie źródła są oddzielne. Użyj **Ustawienia → Zarządzaj ustawieniami → Dostęp do źródła**, aby zalogować się do skonfigurowanego źródła, po czym przeładuj listę. W razie potrzeby wykonaj biometrię/passkey lub kod e-mail na fizycznym urządzeniu. Źródło musi obsługiwać [integrację iOS Access](docs/ios-source-access.md); instalacja nie omija listy dozwolonych IP.
- **Prośba o passkey w zaufanej sieci Wi-Fi:** dla źródeł iOS Access aplikacja najpierw próbuje pierwotnego źródła bez logowania i używa uwierzytelnionego wejścia mobilnego dopiero po odmowie dostępu. Sprawdź publiczne IP faktycznie widziane przez źródło, w tym IPv6: dozwolony domowy IPv4 nie obejmuje innego IPv6, VPN lub adresu komórkowego. Zmiany sieci i ponowne otwarcie aplikacji czyszczą tymczasową preferencję trasy. Ogólny błąd sieci/serwera nie powinien wywoływać logowania.
- **Logowanie już się nie pojawia, ale lista kanałów jest pusta:** prawidłowa zapisana sesja jest ponownie używana bez pytania. Po wcześniejszym błędzie ładowania lub naprawie serwera przeładuj listę albo raz całkowicie zamknij i otwórz aplikację. Jeśli nadal nie działa, sprawdź, czy źródło zwraca listę, a nie stronę HTML logowania lub błąd JSON. Zapisz widoczny błąd i status HTTP; nie udostępniaj URL źródeł zawierających dane logowania, cookies lub tokeny Access.
- **Kanały się ładują, ale wideo buforuje lub zgłasza `SRC_NOT_FOUND`:** wczytanie listy i odtwarzanie wideo to osobne kontrole. Po logowaniu spróbuj kanału jeszcze raz; jeśli problem trwa, sprawdź odpowiedzi manifestu HLS i segmentów oraz obsługę kodeków. Sam błąd nie dowodzi, że zmiana silnika lub ponowna instalacja pomoże.

<a id="option-2-testflight-if-available"></a>

#### Opcja 2: TestFlight (jeśli dostępny)

Jeśli opublikowano zaproszenie TestFlight, zainstaluj TestFlight z App Store, otwórz zaproszenie na urządzeniu i dotknij **Zainstaluj**. Pobranie IPA z GitHub nie zapewnia zaproszenia TestFlight.

<a id="option-3-xcode-for-developers"></a>

#### Opcja 3: Xcode (dla programistów)

Wykonaj [Budowanie i otwieranie](docs/capacitor-mobile.md#build-and-open), wybierz cel **App** w Xcode, ustaw zespół w **Signing & Capabilities**, wybierz podłączone urządzenie i zbuduj/uruchom. W razie potrzeby potwierdź zaufanie i Tryb deweloperski. Import niepodpisanego IPA wydania do okna Devices w Xcode nie zapewnia brakującej tożsamości podpisującej ani profilu aprowizacji.

---

<a id="android-application"></a>

### Aplikacja Android

Wybierz APK Full Capacitor z wydania tego repozytorium, aby korzystać ze wspólnego interfejsu odtwarzacza. Na Androidzie 5.1–6 użyj APK zgodności API 22; wymaga WebView 60 lub nowszego. Aktualizując, zachowaj tożsamość aplikacji i certyfikat podpisu, aby istniejące profile pozostały dostępne. Zobacz [instrukcje budowania](android/README.md) oraz [dystrybucję, podpisywanie i instalację zdalną](docs/android-distributions.md).

Oddzielne [repozytorium ottplay-android](https://github.com/open-ott-play/ottplay-android) zawiera natywną aplikację Kotlin/Compose. Ma własną tożsamość, preferencje i proces wydawania oraz nie zastępuje bezpośrednio instalacji Capacitor. Historyczne pliki wydań pozostają dostępne.

---

<a id="quick-start"></a>

## Szybki start

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

Do testów przeglądarki użyj własnego wdrożenia tej samej rewizji.

Używaj Node 22 i stabilnego toolchaina Rust. Uruchamiaj serwer z katalogu głównego repozytorium, aby pliki statyczne były dostępne. Kompilacje natywne wymagają narzędzi platformowych opisanych poniżej; nie są potrzebne do kompilacji samego serwera.

Przy pierwszym wczytaniu wybierz **Wypróbuj demo** albo otwórz **Ustawienia → Zmień dostawcę → Listy M3U / M3U8**. Otwórz **Wybierz listę**, wybierz pozycję, wpisz **URL listy**, zapisz zmianę i wybierz **Wczytaj listę**. Listę lub konto dostawcy zapewniasz samodzielnie; aplikacja nie dostarcza subskrypcji płatnych kanałów.

<a id="mode-a-companion-smoke"></a>

## Test podstawowy companion trybu A

Test curl companion trybu A (zgodność `ottplay-server` / `archive/server.py`): indeks, katalogi statyczne, `/logo`, `/version`, opcjonalne `/epg` oraz próba `POST /m3u/cp.php` bez pobierania.

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

Kontrole znajdują się w `scripts/modea-smoke-checks.json`. Bez sekretów. Kolejkę poleceń / `local_proxy.py` (:8081) osobno obejmuje `scripts/smoke-command-queue.sh` (jeśli istnieje).

<a id="classic-stalker--ministra-portals"></a>

## Klasyczne portale Stalker / Ministra

Wybierz **Portale Stalker** i wpisz MAC nadany przez dostawcę oraz pełny URL portalu, np. `http://provider.example/stalker_portal/c/`. Adresy `/c/index.html`, `/stalker_portal`, `/server/load.php`, `/load.php` i `/portal.php` wybierają klasyczny protokół MAG. Dotychczasowe konfiguracje samego serwera zachowują JSON-RPC. Dostawca ładuje profil, gatunki i stronicowane kanały na żywo przez wspólny rdzeń Stalker, a następnie w tle wykrywa filmy klasycznego protokołu `type=vod` i zagnieżdżone odcinki. Ścieżki folderów stają się kategoriami na standardowej liście kanałów; dostępne opisy, plakaty i trwałe globalne Ulubione korzystają z tego samego interfejsu multimediów. Zobacz [działanie i ograniczenia katalogu](docs/stalker-media.md).

Żądania samodzielnie hostowanej wersji przeglądarkowej przechodzą przez endpoint `/stalker/api` companion; aplikacje natywne używają istniejącego transportu HTTP. Hostowane wersje przeglądarkowe wymagają jawnie skonfigurowanych tras przez [dedykowany serwer pośredniczący](docs/stalker-relay.md). Pliki przeglądarki i serwera trzeba aktualizować razem.

Odtwarzanie na żywo rozwiązuje tymczasowe polecenia kanału przy otwieraniu strumienia; zmiany kanałów, zatrzymanie, PiP i zmiana dostawcy anulują nieaktualne rozwiązywanie. Jawne nietymczasowe polecenia HTTP(S) odtwarzają się bezpośrednio. Krótkie EPG jest obsługiwane. Archiwum klasycznego portalu i odrębny dialekt `type=series` nie są udostępnione przez tego dostawcę. Zachowanie istniejącego archiwum/przewodnika JSON-RPC nie zmienia się. Prywatne portale LAN korzystające z trasy companion wymagają dokładnego wpisu `OTTPLAY_PROXY_LAN_ORIGINS`, podobnie jak inne trasy proxy companion.

Publiczne demo Infomir to `http://middleware-stalker.com/stalker_portal/c/`. Zwróciło trzy pozycje katalogu na żywo 2026-09-26, ale endpointy mediów były niedostępne; do regresji odtwarzania użyj kontrolowanych danych portalu/mediów.

<a id="m3u-stream-proxy-header-smoke"></a>

## Test nagłówków proxy strumieni M3U

Porównuje nagłówki żądań wychodzących dodawane przez `POST /m3u/cp.php` companion trybu A podczas pobierania kontrolowanego URL echo (domyślnie lokalna atrapa — bez dostawców IPTV i sekretów).

Kontrakt (z `src-rs/core/src/m3u.rs` + `archive/server.py`):
- Dodaje tylko **User-Agent** (domyślnie `OTT-play-FOSS/1.0` albo profile `webos` / `tizen` / `viera` / `mag` / `dune`).
- **Nie** dodaje **Referer** (`M3UProxy` Capacitor dodaje; tryb A nie).
- Usuwa początkowe `@` z `url` (formularz jQuery dostawcy).

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

Kod wyjścia: `0` sukces, `1` brak nasłuchu, `2` niezgodność nagłówków/HTTP, `3` użycie/zależności. Uzupełnia `smoke-modea-companion.sh` / `smoke-command-queue.sh`.

<a id="logo-concurrent-bench-smoke"></a>

## Test równoległego obciążenia logotypów

Test opóźnień równoległych `GET /logo/<id>.svg` (opcjonalne `?ch=`) dla companion trybu A. Raportuje liczby sukcesów/błędów i p50/p95/p99. Domyślne obciążenie jest praktyczne dla lokalnego CI (`CONCURRENCY=200`, `TOTAL=1000`); pełny długotrwały test 10 tys. jest opcjonalny (`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`).

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

Kod wyjścia: `0` sukces, `1` brak nasłuchu / błąd połączenia, `2` wysoki odsetek błędów, `3` użycie. Uzupełnia `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`.

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## Test odświeżania i rozgrzewania cache XMLTV

Rzetelnie sprawdza cache XMLTV/EPG companion trybu A względem `src-rs` (bez wymyślonych API):

- `EPG_CACHE` w pamięci udostępniany przez `GET /epg/:hash` → zawsze `{"epg_data":[...]}` (HTTP 200).
- Start procesu pobiera `EPG_URLS` w tle bez opóźniania HTTP; każde zakończone pobranie jest poprzednikiem **2h** oczekiwania przed następnym odświeżeniem.
- Opcjonalny trwały zapis SQLite po ustawieniu `DATABASE_URL` (bez publicznego endpointu stanu cache).
- `GET /health` → `OK` potwierdza gotowość HTTP po opcjonalnym restarcie. Z `--strict-epg` i `--epg-hash` test czeka też na niepuste EPG tego kanału w tym samym limicie `--warmup-timeout`.

Domyślna ścieżka tylko wywołuje curl — **nie zabija procesów**. Przekaż `--restart-cmd` / `RESTART_CMD`, aby automatycznie zakończyć i uruchomić proces, albo wykonaj ręczne kroki `launchctl` z `--help`.

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

Kod wyjścia: `0` sukces, `1` brak nasłuchu, `2` błąd asercji/rozgrzewania, `3` użycie. Uzupełnia `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`.

<a id="mode-a-e2e-play-path-smoke"></a>

## Test E2E ścieżki odtwarzania trybu A

Test **ścieżki odtwarzania/gotowości strumienia** po stronie companion (tylko HTTP — **nie** E2E z widocznym interfejsem). Na uruchomionym companion trybu A sprawdza:

- Dostępność health lub indeksu
- Statyczne pliki powłoki odtwarzacza (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`)
- Opcjonalne `GET /epg/<hash>.json`, gdy ustawiono `EPG_HASH`
- `POST /m3u/match-channels` z JSON testowym bez sekretów (pusta lista + jeden syntetyczny kanał)
- **Odtwarzanie** przez proxy: `POST /m3u/cp.php` z kontrolowanym medium (domyślnie lokalna lista HLS albo `MEDIA_URL`) i potwierdzenie HTTP 200 + niepustego ciała / oczekiwanego `Content-Type` (pierwsze bajty przez proxy)

Bez prywatnych danych IPTV. Uzupełnia `smoke-modea-companion.sh` (obecność), `smoke-m3u-stream-proxy-headers.sh` (UA/Referer), `smoke-xmltv-cache-refresh.sh`.

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

Kod wyjścia: `0` sukces, `1` brak nasłuchu, `2` błąd asercji, `3` użycie/zależności.

<a id="capacitor-device-smoke-mode-b"></a>

## Test urządzenia Capacitor (tryb B)

**Lista kontrolna** symulatora/emulatora (opcjonalnie fizycznego urządzenia) dla Cap trybu B — nie dla HTTP companion trybu A. Człowiek oznacza akceptację interfejsu; pomocnik automatyzuje toolchain, katalogi natywne i łagodny test curl kolejki poleceń.

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

Szczegóły: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md). Uzupełnia `smoke-command-queue.sh` (loopback Cap) — nie myl z powyższymi testami trybu A.

<a id="tauri-desktop-smoke-mode-b"></a>

## Test komputerowy Tauri (tryb B)

Lista kontrolna i pomocnik dla Tauri trybu B (okno/odtwarzanie kanału/PiP). Nie jest to HTTP companion trybu A ani test urządzenia Cap.

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

Szczegóły: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md). Dane programisty Apple są opcjonalne dla lokalnego testu; użyj [podpisu ad-hoc](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials) dla pakietu aplikacji Mac. Akceptacja przez człowieka nadal obejmuje uruchomienie, odtwarzanie i PiP.

<a id="docker"></a>

## Docker

Obrazy wieloarchitekturowe (amd64/arm64) są budowane jako kandydujące archiwa OCI. Publikacja w rejestrze promuje zatwierdzone stabilne archiwum do Docker Hub bez przebudowy; zobacz [instrukcję operacyjną](docs/release-workflow.md).

Binarny serwer jest budowany z **musl** (Alpine) i dostarczany na Alpine — **nie** wymaga GLIBC_2.38+. Dzięki temu `alvit/ottplay-foss` działa na Dockerze Synology DSM (x86_64) i innych hostach ze starszym glibc.

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

Stabilne tagi rejestru mają postać `X.Y.Z`. Aktualizacja `latest` jest osobną jawną opcją po opublikowaniu wersjonowanego obrazu; push do main i tagi Git nie publikują obrazów.

<a id="build-from-source"></a>

## Budowanie ze źródeł

Reguły domenowe odtwarzacza pochodzą z przypiętego artefaktu Kotlin multiplatform w `vendor/ottplay-core.js`. Decyzje dotyczące przewodnika, archiwum, list, dostawców, trwałego stanu i odtwarzania współdzielą implementację z FOSS2 i natywnym Androidem. Adaptery przeglądarki/TV, Swift i Rust zachowują API urządzeń, kodeki, sieć i efekty interfejsu. Artefakt przeglądarki zachowuje składnię ES5 i inicjalizację obsługiwanych starszych API. `npm test`, `check:bundle` i `check:es5` sprawdzają integrację; manifest artefaktu zapisuje hashe źródeł i wyniku.

Walidatory protokołów control-server i SWOP są generowane z wersjonowanego schematu `contracts/ottplay-wire-v1.json`. Sprawdzane potwierdzenia generatora i niezmienne dane zgodności zapobiegają kopiowaniu polityk specyficznych dla odbiorcy.

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

## Wykrywanie urządzenia

Odtwarzacz obsługuje 24 typy urządzeń. Wykrywanie: najpierw URL `/f/{device_id}/`, następnie User-Agent.

| ID urządzenia | Urządzenie |
|---|---|
| `pc` | Przeglądarka PC |
| `pc2` | Odtwarzacz WWW videojs |
| `nodejs` | Aplikacja Windows (Electron) |
| `lg/webos` | Telewizory LG WebOS |
| `samsung/tizen` | Telewizory Samsung Tizen |
| `samsung/maple` | Telewizory Samsung Orsay |
| `mag` | Dekodery Infomir MAG |
| `dune` | Dekodery Dune HD |
| `android` | Android TV / tablety |
| `hbbtv` | Telewizory HbbTV |
| `panasonic` | Telewizory Panasonic Viera |
| `philips` | Telewizory Philips |
| `sony` | Telewizory Sony |
| `sharp` | Telewizory Sharp |
| `toshiba` | Telewizory Toshiba |
| `hisense` | Telewizory Hisense |
| `skyworth` | Telewizory Skyworth |
| `tcl` | Telewizory TCL |
| `vewd` | Urządzenia Vewd |
| `spark` | Odbiorniki Spark |

<a id="push-command-system"></a>

## System poleceń push

Dla oddzielnej usługi wielourządzeniowej użyj [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) i sekcji **Serwer poleceń** w **Ustawienia → Sterowanie zdalne**. Wpisz IP/adres oraz kod dostępu tego odtwarzacza; zapis obu automatycznie rozpoczyna odpytywanie o głośność, kanały i inne polecenia. IP bez portu używa HTTP 8081. Wyczyść adres lub wybierz **Rozłącz**, aby zatrzymać. To połączenie wychodzące obsługuje potwierdzane dostarczanie i nie wymaga lokalnego nasłuchu. Zobacz [szczegóły połączenia i zgodności](docs/remote-command-server.md). Poniższe przykłady opisują istniejący tryb lokalnego proxy/nasłuchu.

**Znajdź serwer poleceń** pozwala wykryć kontroler i poprosić operatora o zatwierdzenie bez kopiowania tokenu urządzenia. Tauri najpierw sprawdza natywny DNS, a przy pustym wyniku może użyć jawnie skonfigurowanego profilu wdrożenia; odtwarzacze przeglądarkowe, LG i Capacitor korzystają ze ścieżki profilu przeglądarki. Metadane wykrywania Home można hostować w here.now niezależnie od kontrolera. Ogólne kompilacje nie zawierają automatycznie tego profilu Home, a aktualizacja nie zastępuje zapisanych połączeń. Zobacz [zachowanie platform, konfigurację profilu i rozwiązywanie problemów](docs/remote-command-server.md#discovery-and-one-time-approval).

Lokalne sterowanie HTTP jest **domyślnie wyłączone** w odtwarzaczu przeglądarkowym/OTT server, Tauri i Capacitor. Włącz je w **Ustawienia odtwarzacza → Sterowanie zdalne**, aby wygenerować tajny kod urządzenia. Polecenia są obiektami JSON z polem `"command"`; żądania HTTP wymagają `Authorization: Bearer <device-code>`.

<a id="architecture"></a>

### Architektura

<a id="local-command-url-recommended"></a>

#### Lokalny URL poleceń (zalecany)

Włącz **Lokalne sterowanie HTTP** w **Ustawienia odtwarzacza → Sterowanie zdalne**, skopiuj wygenerowany **Kod urządzenia** i skonfiguruj nim proxy poniżej. Ustaw **Lokalny URL poleceń** na endpoint poleceń proxy. Gdy funkcja jest aktywna, odtwarzacz odpytuje ten URL co 10 sekund z kodem w nagłówku Authorization. Samo ustawienie URL nie włącza sterowania.

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### UUID urządzenia

Istniejący UUID urządzenia (np. `dev_a1b2c3d4e5`) to publiczne metadane routingu, nie dane autoryzacyjne. Osobny **Kod urządzenia** jest bezpiecznie generowany przy włączeniu lokalnego HTTP i pozostaje na urządzeniu; nie jest kopiowany przez ustawienia chmurowe. Wyłączenie lokalnego HTTP zatrzymuje odpytywanie/nasłuch. Ponowne włączenie tworzy nowy kod: zaktualizuj proxy i integracje, aby unieważnić stare dane dostępu.

Tauri i Capacitor uruchamiają nasłuch HTTP loopback dopiero po tej zgodzie w ustawieniach. Proxy przekazujące muszą wysyłać widoczny kod jako token Bearer do tego nasłuchu. Tryb A używa osobno konfigurowanej kolejki `local_proxy.py` opisanej niżej.

<a id="remote-text-entry-swop"></a>

#### Zdalne wpisywanie tekstu (swop)

Cel: wpisywanie na telefonie dla ♥™ / zdalnej klawiatury ekranowej, gdy telewizor i telefon są w **różnych sieciach**, przez przekazanie sesji Cloudflare Worker.

- Repozytorium Workera: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop)
- **Autoryzacja instalacji:** odtwarzacz wysyła żądania do przekaźnika `/swop` w tym samym origin serwera. Serwer dodaje prywatny token instalacji; każdy klient zarejestrowanego origin serwera może zdalnie wpisywać tekst. UUID urządzeń identyfikują sesje i nie wymagają listy dopuszczeń na urządzenie.
- Ustawienie: `swopBaseUrl` (puste = ♥™ pokazuje „nieskonfigurowane” / brak działania). Edytuj w **Ustawienia → Sterowanie zdalne** (klawisz **2**) albo wstrzyknij przez ignorowany w Git `/local/swop.json` w instalacjach operatora
- `POST /session` zawiera `clientId`, `caption` i `draft`; `POST /val` zawiera `clientId`, `code` i zwrócony `sessionToken`. URL telefonu zawiera oddzielny token zapisu. Tokeny odczytu sesji pozostają w pamięci przeglądarki.
- **Instalacja lokalna:** ustaw `SWOP_BASE_URL` i `SWOP_INSTALLATION_TOKEN` po zarejestrowaniu instalacji i jej dokładnych origin LAN/localhost w Workerze. `scripts/install-ottplay-local-service.sh` zachowuje je w prywatnym plist launchd z trybem 0600. Publiczny `/local/swop.json` zawiera tylko `{"swopBaseUrl":"/swop"}`. Nigdy nie umieszczaj tokena instalacji w publicznych zasobach.
- **Hosting statyczny:** skonfiguruj uwierzytelnione proxy serwerowe dla tych samych dwóch endpointów. Przechowuj token instalacji w sekretach usługi hostingowej. Kopiowanie publicznych plików odtwarzacza nie kopiuje tych danych serwera.

> Centralny serwer OTT utrzymuje `/api/webhook/commands`, `/webhook/poll`, `/webhook/notify` i aliasy zdrowia poleceń wyłączone dla każdej metody HTTP. W trybie A użyj osobnego serwera poleceń lub jawnie skonfigurowanego uwierzytelnionego `local_proxy.py`; serwer centralny nie ma rozgłoszeniowej kolejki poleceń.

<a id="available-commands"></a>

### Dostępne polecenia

Wszystkie poniższe przykłady używają `http://192.168.1.50:8081/api/webhook/commands` jako URL lokalnego proxy. Zastąp go właściwym adresem i ustaw `OTTPLAY_QUEUE_HTTP_TOKEN` na **Kod urządzenia** widoczny po włączeniu HTTP w ustawieniach odtwarzacza. Proxy musi używać tego samego kodu.

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — Wyświetl powiadomienie

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| Pole | Typ | Domyślnie | Opis |
|---|---|---|---|
| `message` | string | wymagane | Wyświetlany tekst |
| `popup_duration` | number | 5 | Czas wyświetlania w sekundach (prawy górny róg) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — Przełącz kanał według pozycji na liście

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| Pole | Typ | Domyślnie | Opis |
|---|---|---|---|
| `channel_number` | number | wymagane | Pozycja kanału na liście liczona od 1 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — Przełącz kanał według (części) nazwy

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

Wyszukiwanie fragmentu bez rozróżniania wielkości liter. Wygrywa pierwsze dopasowanie.

| Pole | Typ | Domyślnie | Opis |
|---|---|---|---|
| `channel_name` | string | wymagane | Pełna lub częściowa nazwa kanału |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — Przełącz na losowy kanał

To starsze polecenie wybiera dozwolone kanały z bieżącej listy lub kategorii. Numery kanałów i zakresy oznaczają pozycje na tej liście; zobacz [zasady bezpiecznego losowego wyboru](docs/remote-command-server.md#safe-random-playback).

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

| Pole | Typ | Domyślnie | Opis |
|---|---|---|---|
| `random_range` | [start, end] | bieżąca lista | Zakres liczony od 1 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — Zmień dostawcę IPTV

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| Pole | Typ | Domyślnie | Opis |
|---|---|---|---|
| `provider` | number | wymagane | Indeks tablicy dostawców (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — Wczytaj nową listę M3U

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| Pole | Typ | Domyślnie | Opis |
|---|---|---|---|
| `playlist` | string | wymagane | URL listy M3U |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — Zaktualizuj konfigurację dostawcy

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| Pole | Typ | Domyślnie | Opis |
|---|---|---|---|
| `provider_settings` | string | wymagane | Ciąg JSON z konfiguracją dostawcy |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — Ustaw lub zmień głośność

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

Polecenie jest bez komunikatu ignorowane przez klientów bez regulacji głośności.

| Pole | Typ | Domyślnie | Opis |
|---|---|---|---|
| `volume` | number | — | Poziom bezwzględny 0-100 |
| `volume_step` | number | — | Zmiana względna, np. +10 lub -5 |

<a id="player-standby-restart-and-exit"></a>

#### Czuwanie, restart i zamknięcie odtwarzacza

Kolejka webhook lokalnego proxy bez potwierdzeń nie obsługuje `exit_player` ani typowanych żądań czuwania/wybudzenia. Połącz odtwarzacz z [serwerem poleceń](docs/remote-command-server.md) i użyj jego CLI:

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

Zastąp `d1` aliasem zarejestrowanego odtwarzacza. `stop` jest aliasem `standby`; `start` i `wake` są aliasami `go`. Go wymaga uruchomionego, połączonego odtwarzacza; nie uruchamia zamkniętej aplikacji ani nie budzi urządzenia offline. Przeglądarka lub telewizor bez natywnego zamknięcia aplikacji zgłaszają brak obsługi wyjścia. Czuwanie utrzymuje zdalne odpytywanie i nie zawiesza niezwiązanej pracy hosta lub współdzielonego serwera.

Po standby/go sprawdź `ott d1 status` pod kątem stanu czuwania/tła i osobno potwierdź wznowione odtwarzanie. Po przeładowaniu odtwarzacza potwierdź nowe środowisko wykonawcze przez `ott d1 doctor`. Po wyjściu sprawdź w systemie operacyjnym, czy proces aplikacji się zamknął; zdalny timeout nie dowodzi zamknięcia. Samo przyjęcie polecenia nie potwierdza tych wyników.

<a id="local-proxy-server"></a>

## Lokalny serwer proxy

`local_proxy.py` jest samodzielną uwierzytelnioną kolejką poleceń dla jednego odtwarzacza. Domyślne wywołanie kończy się bez otwierania portu. Każda instancja używa kodu urządzenia wygenerowanego przez odtwarzacz; dla wielu odtwarzaczy używaj oddzielnych instancji/portów. Parametr zapytania `device_id` jest przyjmowany jako metadane zgodności i nigdy nie uwierzytelnia ani nie wybiera innego urządzenia.

<a id="start-the-proxy"></a>

### Uruchom proxy

1. Włącz **Lokalne sterowanie HTTP** w odtwarzaczu i skopiuj **Kod urządzenia**.
2. Na hoście proxy ustaw kod i dokładny origin udostępniający odtwarzacz (schemat, host i port, bez ścieżki):

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. Ustaw **Lokalny URL poleceń** odtwarzacza na `http://192.168.1.50:8081/api/webhook/commands`.

Domyślny adres nasłuchu to `127.0.0.1`; przykład jawnie włącza LAN. `OTTPLAY_QUEUE_HTTP_ORIGINS` jest listą dokładnych origin przeglądarki oddzielonych przecinkami. Jeśli odtwarzacz działa przez HTTPS, użyj odwrotnego proxy HTTPS, aby reguły mieszanej treści zezwoliły na odpytywanie. Zachowaj kod urządzenia w tajemnicy i poza URL. Gdy odtwarzacz wygeneruje nowy kod, uruchom proxy ponownie z nową wartością; samo wyłączenie odtwarzacza nie zatrzymuje niezależnie zarządzanego procesu proxy.

<a id="endpoints"></a>

### Endpointy

| Metoda | Ścieżka | Opis |
|---|---|---|
| `POST` | `/api/webhook/commands` | Dodaj polecenie do kolejki |
| `GET` | `/api/webhook/commands` | Pobierz polecenia z kolejki (odpytywanie odtwarzacza) |
| `POST` | `/webhook/notify` | Uwierzytelniony alias zgodności |
| `GET` | `/webhook/poll` | Uwierzytelniony alias zgodności |

Wysyłanie i opróżnianie wymagają zgodnego kodu urządzenia Bearer. Nie ma nieuwierzytelnionego endpointu rozgłoszeniowego. Polecenia wygasają po 60 sekundach; każde proxy zachowuje maksymalnie 50 poleceń.

Proxy obsługuje jednocześnie do 16 połączeń, więc bezczynne połączenie przeglądarki lub niepełne żądanie nie opóźnia pozostałych poleceń. Każdy socket ma pięciosekundowy limit bezczynności; dodatkowe połączenia są zamykane, gdy wszystkie workery są zajęte. Dodawanie do kolejki i jej opróżnianie jest atomowe między workerami.

<a id="smoke-script-all-modes"></a>

### Skrypt testowy (wszystkie tryby)

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Emulator/urządzenie Android: najpierw `adb forward tcp:18081 tcp:18081`. Cap/Tauri działają tylko na loopback — użyj tego proxy trybu A dla Home Assistant w LAN. Szczegóły: `docs/capacitor-mobile.md` § Smoke test.

<a id="cors"></a>

### CORS

Proxy zezwala na żądania przeglądarki wyłącznie z `OTTPLAY_QUEUE_HTTP_ORIGINS`. Wstępne żądania `OPTIONS` z dozwolonego origin nie wymagają tokena; każde właściwe GET/POST wymaga kodu Bearer. Origin z wildcard i `null` nie są akceptowane. Home Assistant i inni klienci spoza przeglądarki mogą pominąć Origin, lecz nadal wymagają uwierzytelnienia.

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### Przykład: webhook Home Assistant → lokalne proxy → odtwarzacz

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

### Przykłady automatyzacji Home Assistant

Przykłady komunikatu, kanału i głośności używają lokalnego proxy. Ustaw `ottplay_device_authorization` w `secrets.yaml` Home Assistant na `Bearer <device-code>` z kodem widocznym w aktywowanym odtwarzaczu.

Nocne czuwanie używa osobnego [serwera poleceń](docs/remote-command-server.md). Zastąp przykładowy URL i `DEVICE_UUID` adresem kontrolera i zarejestrowanym ID urządzenia; lokalny alias CLI `d1` nie jest ID urządzenia. Ustaw `ottplay_control_authorization` na `Bearer <controller-admin-token>` w `secrets.yaml`. Te dane dostępu są niezależne od kodu urządzenia lokalnego proxy. Zobacz dokumentację Home Assistant: [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) i [sekrety](https://www.home-assistant.io/docs/configuration/secrets/).

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

`standby_request` zawiera odpowiedź HTTP dla śladu automatyzacji. HTTP 202 oznacza tylko umieszczenie w kolejce: zachowaj `content.id`, a następnie odpytuj `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` tymi samymi danymi kontrolera, aby uzyskać odpowiedź odtwarzacza. Nowe żądanie `status` obserwuje `player.standby` i `player.background`; aktywne czuwanie z `suspended` i zerem oczekujących potwierdza zakończenie śledzonej pracy odtwarzacza. Aby wyjść z czuwania, użyj tego samego typowanego żądania z `"operation":"wake"` (`ott d1 go`). Nie powtarzaj zmiany bez zastanowienia po timeout. Zobacz [API żądanie/odpowiedź](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) i [semantykę czuwania](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake) kontrolera.

<a id="server-api-reference"></a>

## Referencja API serwera

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Endpointy webhook (Rust `ottplay-server`)

Serwer Rust i zarchiwizowana alternatywa Python odrzucają endpointy poleceń kodem HTTP 403. `/api/webhook/commands`, `/webhook/notify`, `/webhook/poll` i aliasy zdrowia poleceń nie dodają, nie rozgłaszają ani nie pobierają poleceń z kolejki. Ogólne API informacji zwrotnej nie może zastąpić tych zarezerwowanych tras. Dostarczanie poleceń trybu A używa osobno skonfigurowanego serwera poleceń lub uwierzytelnionego proxy opisanego wyżej.

<a id="other-endpoints"></a>

### Pozostałe endpointy

| Metoda | Ścieżka | Opis |
|---|---|---|
| `GET` | `/epg/<hash>.json` | Dane EPG kanału |
| `GET` | `/logo/<id>.svg` | Wygenerowane logo kanału |
| `GET` | `/version/<path>` | Hash wersji pliku |
| `POST` | `/m3u/match-channels` | Dopasowanie kanału do EPG |
| `POST` | `/m3u/match-logos` | Dopasowanie logo kanału |
| `POST` | `/m3u/cp.php` | Proxy strumienia |
| `GET/POST` | `/feedback/` | Logowanie informacji zwrotnej |
| `GET` | `/tmdb/*` | Proxy API TMDb |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## Struktura projektu

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

## Mapowania klawiszy STB

- **Samsung Tizen**: `RETURN=10009`, `ENTER=13`, kolory 403-406
- **Samsung Maple**: dpad 4/5/6/8, oryginalne kody SDK
- **LG WebOS**: `RETURN=461`, kolory zgodne z HbbTV
- **LG NetCast**: `RETURN=8`, kody HbbTV
- **MAG**: `RETURN=8`, API gSTB dla MAC
- **Dune HD**: standardowe kody, API Dune
- **Android TV**: kody Android (`BACK=4`, `DPAD_*` 19-22, `ENTER=66`)
- **HbbTV/Panasonic/Philips/Sony/itd.**: kody HbbTV (`RED=403`, `BLUE=406`, `VOL_UP=447`)

<a id="documentation"></a>

## Dokumentacja

- [Wiki dokumentacji](./docs/wiki/Home.pl.md) / [Wiki po rosyjsku](./docs/wiki/Home.ru.md) — nawigacja według zadań i zasady utrzymania.
- [Raport implementacji](./docs/implementation-report.pl.md) / [Proces i wynik po rosyjsku](./docs/implementation-report.ru.md) — kolorowe diagramy, zweryfikowane zachowanie, zmierzony koszt i bramki wydania.
- [Przewodnik dostarczenia](./docs/roadmap-delivery.pl.md) / [Nowe funkcje po rosyjsku](./docs/roadmap-delivery.ru.md) — funkcje, ograniczenia i weryfikacja.
- [Szybki start w 88 językach interfejsu](./docs/readme/README.md) — generowany z dostarczanych tłumaczeń UI; główna instrukcja i powiązane przewodniki funkcji są dostępne w [24 językach dokumentacji](docs/manual-translations.md).
- [Limity jakości i odzyskiwanie live](./docs/playback-stream-policy.pl.md) / [Po rosyjsku](./docs/playback-stream-policy.ru.md).
- [Ręczne mapowanie XMLTV i klasyczna dostępność](./docs/guide-binding-accessibility.pl.md) / [Po rosyjsku](./docs/guide-binding-accessibility.ru.md).
- [Hostowany test audio/wideo](./docs/audio-video-check.pl.md) / [Po rosyjsku](./docs/audio-video-check.ru.md).
- [Biblioteka multimediów Xtream](./docs/xtream-media.pl.md) / [Po rosyjsku](./docs/xtream-media.ru.md).
- [Przekazanie między urządzeniami tego samego źródła](./docs/remote-handoff.pl.md) / [Po rosyjsku](./docs/remote-handoff.ru.md).
- [Odzyskiwalne ustawienia lokalne](./docs/settings-recovery.pl.md) / [Po rosyjsku](./docs/settings-recovery.ru.md).
- [Generacje przeglądarek, systemy operacyjne i dokładne kontrole kandydatów wydania](docs/browser-compatibility.pl.md) / [Po rosyjsku](docs/browser-compatibility.ru.md).

- [Architektura odtwarzacza](./docs/architecture.md) — odpowiedzialności wykonawcze, integracja dostawców, odtwarzanie, przewodnik, adaptery urządzeń i kontrakty budowania.
- [Klasyczny potok ES5](./docs/build-pipeline.md) — kompilacja, kontrole zgodności i limity rozmiarów artefaktów.
- [Nazwy zasobów wykonawczych i migracja wdrożeń](./docs/asset-layout.md) — opisowe ścieżki współdzielone przez pakiety WWW i natywne.
- [Zdalne stanowisko pracy](./docs/remote-workbench.md) — inspekcja UI/mediów, potwierdzenia operacji i zapisane dowody.
- [Diagnostyka wykonawcza](./docs/runtime-debug.md) — historia błędów, liczniki klatek/pętli, natywne metryki Capacitor/Tauri i debugowanie serwera.
- [Lokalne dostarczenie macOS](./docs/macos-local-delivery.md) — kompilacje checkoutu, lokalna instalacja i weryfikacja.

<a id="license"></a>

## Licencja

[MIT](LICENSE) — wolne i otwarte oprogramowanie. Treści dostawców i zależności zewnętrzne zachowują własne prawa oraz licencje.

Oddzielna aplikacja [OTTPlay native webOS](docs/native-webos.md), oparta na PlxNative, jest rozpowszechniana na licencji **GPL-3.0-or-later** wraz z odpowiadającym jej kodem źródłowym.
Licencja MIT w katalogu głównym projektu nie zmienia licencji tej aplikacji natywnej ani jej poprawek.

<a id="desktop-updater--notarization-mode-b"></a>

## Aktualizator desktopowy / notaryzacja (tryb B)

[Przewodnik podpisywania desktopu i aktualizatora](docs/tauri-updater-notarize.md) opisuje podpis ad-hoc macOS, opcjonalne Developer ID/notaryzację i weryfikację pakietu. CI wydań używa podpisu ad-hoc bez danych Apple. Podpis aktualizatora jest osobny; produkcyjne automatyczne aktualizacje pozostają nieskonfigurowane.

<a id="local-mac-build-helpers"></a>

## Pomocniki lokalnej kompilacji Mac

Zobacz [docs/local-build-scripts.md](docs/local-build-scripts.md).

<a id="privacy"></a>

## Prywatność

Przeczytaj [politykę prywatności](docs/privacy-policy.md), aby poznać informacje o lokalnych ustawieniach, skonfigurowanych usługach i swoich wyborach. Kontakt w sprawie prywatności i wsparcia: [alvit.work@gmail.com](mailto:alvit.work@gmail.com).

Studio 2026 jest domyślnym motywem interfejsu. Classic i PLi-HD pozostają do wyboru, a zapisane preferencje są zachowane. Zobacz [ustawienia interfejsu](docs/interface-settings.md). Motyw PLi-HD wymienia autorów Vali, littlesat, VU+NL, Milo i współtwórców upstream. [Autorzy interfejsu i historia projektu](docs/interface-history.md) opisują historię po angielsku i źródła; materiał jest dostępny także w menu informacji odtwarzacza.

<a id="demo-video-editing"></a>

## Edycja wideo demonstracyjnego

Użyj lokalnej [procedury video-use](docs/demo-video.md) do przygotowania i edycji nagrań demonstracyjnych. Pomocnik utrzymuje wszystkie wygenerowane media poza Git.

<a id="plex-media-library"></a>

## Biblioteka mediów Plex

Każdy odtwarzacz może połączyć się z kontem Plex lub Plex Media Server przez dostawcę **Plex**. Integracja używa Plex; Synology jest jednym z możliwych hostów serwera mediów. Wszystkie dostępne filmy i utwory automatycznie trafiają na listę kanałów; wybór kategorii filtruje ją według biblioteki, folderu lub serialu. Odtwarzanie zaczyna się od pierwszej użytecznej partii, z ładowaniem w tle, zwykłym wyszukiwaniem i Działaniami losowania/powtarzania, bez konfigurowania Plex na serwerze OTT. Zobacz [logowanie Plex i bezpośrednie odtwarzanie](docs/plex-provider.md).

![Cykl ładowania Plex, nawigacji po plikach i zamykania](docs/images/plex-playback-lifecycle.svg)

[Ilustrowana analiza niezawodności](docs/plex-provider.md#reliability-review-process-and-results) wyjaśnia reguły ładowania i anulowania, poprawki pełnych katalogów i przełączania plików oraz zmierzone wyniki walidacji Chromium/WebKit.

Opcjonalna integracja serwera OTT udostępnia też katalog istniejącego serwera Plex i zgodne odtwarzanie przez osobny wpis biblioteki NAS oraz eksport M3U. Zobacz [konfigurację biblioteki serwera i dostęp klienta](docs/synology-library.md).

<a id="related-repositories"></a>

## Powiązane repozytoria

- [ottplay-core](https://github.com/open-ott-play/ottplay-core) zawiera wspólną logikę domenową JVM/ES5, kontrakty komunikacji i klienta FOSS2. Ten odtwarzacz używa wygenerowanych artefaktów; przy wspólnych zmianach stosuj przewodnik dostarczenia rdzenia.
- [ottplay-android](https://github.com/open-ott-play/ottplay-android) jest oddzielną natywną aplikacją Kotlin/Compose z własną tożsamością instalacji i wydań.
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server) zapewnia samodzielnie hostowane zdalne polecenia; [ottplay-swop](https://github.com/open-ott-play/ottplay-swop) zapewnia opcjonalny transport tekstu przez Worker.
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine) utrzymuje hostowany profil demonstracji przeglądarkowej, media demo i weryfikację publikacji.

<a id="project-maintenance"></a>

## Utrzymanie projektu

Zobacz [wymagania współtworzenia i testów](CONTRIBUTING.md), [politykę zgłaszania bezpieczeństwa](SECURITY.md), [projekt bezpieczeństwa](docs/security-design.md) i [dowody OpenSSF oraz pozostałe kryteria](docs/openssf-evidence.md).
