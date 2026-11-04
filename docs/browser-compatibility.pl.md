<a id="browser-generations-and-operating-systems"></a>

# Generacje przeglądarek i systemy operacyjne

<!-- language-navigation:start -->
<p dir="ltr">
<a href="browser-compatibility.md" lang="en" dir="ltr">English</a> · <a href="browser-compatibility.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="browser-compatibility.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="browser-compatibility.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="browser-compatibility.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="browser-compatibility.es.md" lang="es" dir="ltr">Español</a> · <a href="browser-compatibility.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="browser-compatibility.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="browser-compatibility.he.md" lang="he" dir="rtl">עברית</a> · <a href="browser-compatibility.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="browser-compatibility.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="browser-compatibility.it.md" lang="it" dir="ltr">Italiano</a> · <a href="browser-compatibility.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="browser-compatibility.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="browser-compatibility.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="browser-compatibility.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="browser-compatibility.pt.md" lang="pt" dir="ltr">Português</a> · <a href="browser-compatibility.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="browser-compatibility.th.md" lang="th" dir="ltr">ไทย</a> · <a href="browser-compatibility.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="browser-compatibility.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="browser-compatibility.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="browser-compatibility.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="browser-compatibility.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[Wyniki pomiarów](implementation-report.pl.md#browser-gate-integration)

![Skonfigurowana kwalifikacja przeglądarek: 35 celów, 166 wykonań scenariuszy](diagrams/browser-qualification.svg)

Dotychczasowe kontrole urządzeń, multimediów, starszego ES5/workerów, natywnego interfejsu i natywnego HLS Apple pozostają obowiązkowe. Współdzielony workflow TypeScript uruchamia dodatkowo scenariusze Plex na dokładnym spakowanym archiwum Mode A: dwa zlokalizowane przebiegi ładowania/ponownego ładowania, zachowanie proporcji obrazu przez HLS.js i Video.js przy zmianach mediów i przeładowaniu oraz naturalne zakończenie odcinka w ścisłym trybie kiosku z HLS.js. Scenariusze multimedialne korzystają z rzeczywistego dekodowania; wszystkie używają rzeczywistego DOM i wejścia. Jedynie dane Plex i źródło mediów są syntetycznymi lokalnymi danymi testowymi.

Próbka do testowania proporcji przepakowuje zapisany w repozytorium strumień transportowy H.264/AAC do oddzielnych wariantów fMP4. Nagłówki inicjalizacyjne używają marki `iso6` i zerowych czasów filmu/ścieżek, zgodnie z [sekcją 3.3 RFC 8216](https://www.rfc-editor.org/rfc/rfc8216#section-3.3). Wpis próbki AVC używa też wymaganych bitów zarezerwowanych w liczbie SPS i stałej ze znakiem `-1` w końcowym polu `pre_defined`. Koryguje to składnię kontenera generowaną przez przypięty multiplekser testowy. Kontrakt danych testowych sprawdza nagłówki i odrzuca niepoprawne boksy, potwierdzając niezmienność zestawów parametrów kodeka, ID ścieżek, skal czasu i bajtów fragmentów multimedialnych. Weryfikuje to wejście syntetyczne; samo w sobie nie dowodzi odtwarzania w przeglądarce ani nie zastępuje pełnej macierzy RC.

Pull requesty wymagają aktualnych Chromium, Firefox i WebKit na Linuksie, Chromium na Windows oraz WebKit na macOS. Kompilacje nocne i beta wymagają tych pięciu celów. Kwalifikacja RC wymaga wszystkich 35 zadeklarowanych celów: trzech dokładnych generacji Playwright/przeglądarek na Linuksie, Windows i macOS, zainstalowanych stabilnych Chrome/Edge na wszystkich trzech systemach oraz beta Chrome/Edge na Linuksie. Dwa historyczne cele macOS WebKit (Playwright 1.62.1 i 1.63.0) używają `macos-15-intel`; ich poświadczenia zapisują rzeczywistą architekturę procesu i odrzucają runnery ARM. Bezpośrednia diagnostyka MSE wykazała, że te same bajty inicjalizacji H.264 i mediów kończyły przetwarzanie na Intelu z 1.63 i na ARM z 1.64, podczas gdy starszy WebKit w maszynie wirtualnej macOS 15 ARM zatrzymywał się przed `updateend`. Zmiana kontenerów, ManagedMediaSource ani otwarcie okna przeglądarki nie rozwiązały problemu. Te dwa cele nadal wymagają pięciu oryginalnych scenariuszy odtwarzania/interfejsu. Wybór runnera nie jest twierdzeniem o każdym fizycznym urządzeniu macOS ani natywnym Safari. Ponowne generowanie inwentarza musi zachować te zatwierdzone wyjątki runnerów; kontrakt profilu odrzuca ich usunięcie.

Wszystkie trzy generacje Linux WebKit używają jawnie runnera x64 `ubuntu-26.04`. Przejrzane porównanie oficjalnych środowisk wykonawczych odtworzyło błąd przejścia ścisłego kiosku na Ubuntu 24.04, podczas gdy ten sam kandydat i pięć niezmienionych scenariuszy przeszły cztery razy z rzędu na Ubuntu 26.04. Wybrano spójne, obsługiwane środowisko bez wymiany pojedynczych bibliotek multimedialnych ani łagodzenia asercji odtwarzania. Pozostałe cele linuksowe zachowują swoje runnery. Dokładne źródło, artefakt, wyniki i ograniczenia opisuje [kwalifikacja środowiska Linux WebKit](linux-webkit-runtime.md). Pełna macierz RC i oddzielna akceptacja natywnych pakietów pozostają obowiązkowe.

Testowane wersje produktów są zapisywane w czasie wykonania. Playwright Firefox to jego zmodyfikowana kompilacja, nie twierdzenie o natywnym Firefox ESR; WebKit nie jest Safari. Ta macierz nie zastępuje kwalifikacji na fizycznych telewizorach ani w natywnych powłokach.

Pełny inwentarz obejmuje **35 celów platformowych: 32 obsługujące HLS i trzy cele Windows WebKit wyłącznie dla interfejsu**. Te ostatnie nadal wymagają obu zlokalizowanych przebiegów ładowania/przeładowania; ich kompilacja WebKit nie ma MediaSource ani natywnego HLS. To jawne ograniczenie, a nie zaliczone pokrycie odtwarzania. Dokładne trzy ID celów są przeglądane w `scripts/browser-compatibility-profile.cjs`. Sonda możliwości musi potwierdzić to ograniczenie przed testami interfejsu. Jeśli pojawi się MSE (w tym ManagedMediaSource) albo natywny HLS, bramka ma zawieść do czasu aktualizacji profilu. Każdy inny cel wymaga MSE dla H.264 i AAC oraz pięciu niezmienionych scenariuszy; utrata możliwości powoduje błąd zamiast wybrania mniejszego zestawu. Sonda ładuje bibliotekę HLS kandydata i sprawdza backend wybrany przez domyślne ustawienie przypiętej instancji: MediaSource, potem ManagedMediaSource, potem WebKitMediaSource. Poświadczenie wskazuje backend i wersję HLS; zmiana wartości domyślnej lub wersji wymaga jawnego przeglądu kontraktu sondy.

Pełny RC wymaga zatem **166 udanych wykonań scenariuszy** (32 × 5 + 3 × 2) i 35 poświadczeń celów. Podzbiór PR/nocny/beta nadal obejmuje pięć celów i 25 wykonań. Każde poświadczenie zapisuje dokładny zestaw scenariuszy, sondę możliwości oraz zaliczone HLS albo jawny powód braku obsługi. Są to skonfigurowane wymagania, nie twierdzenie, że konkretny RC już je spełnił. Ograniczenie potwierdzają [konfiguracja kompilacji WebKit dla Windows](https://github.com/WebKit/WebKit/blob/56453fdfe0b0ca6258c23e6453b34f70b885d13f/Source/cmake/OptionsWin.cmake#L75) używana przez Playwright 1.64 i przypięta sonda środowiska.

Obie ścieżki pobierają dokładny identyfikator artefaktu z zadania wytwarzającego w bieżącym uruchomieniu. Przed udostępnieniem świeżo rozpakowanego katalogu sprawdzane są sumy kontrolne archiwum, commit źródłowy, hashe spakowanych bundle/providerów, typy plików i ścieżki. Kontrole wydania sprawdzają także zamrożone poświadczenie kompilacji. Zadania przeglądarek nie przebudowują testowanego kodu; instalują tylko zależności produkcyjne. Serwer testowy nadal wymaga pełnego inwentarza providerów ze źródeł; kompilator ładuje się tylko podczas rzeczywistego tworzenia bundla, a nie odczytywania stałych inwentarza. Błędne, pominięte, nieaktualne lub brakujące dowody scenariuszy powodują błąd wspólnej bramki; dla każdego celu zachowywane są ślady, rzeczywista tożsamość środowiska i skrót kandydata.

Siedem generowanych plików inwentarza/lock pochodzi z `venus-os-ci-toolkit/scripts/prepare_browser_compatibility.py`. Pakiety aplikacji i historyczne pakiety przeglądarek mają osobne pliki blokad. Domyślnie pozostają runnery hostowane przez GitHub; współdzielony workflow zachowuje przygotowaną opcję rezerwy linuksowej, natomiast Windows/macOS wymagają własnego natywnego systemu.

Wspólny werdykt wydania sprawdza każdy wybrany cel i jego SHA źródła, uruchomienie, próbę, kanał oraz dokładne ID artefaktu kandydata. RC nie może używać dowodów beta z pięciu celów. Awans do stable korzysta z bajtów zaakceptowanego RC. Po błędzie uruchom ponownie cały workflow kwalifikacji; poświadczenia starszych prób nie mogą zakończyć nowej kwalifikacji.

## Diagnostyka zakończenia

Po wczytaniu środowiska wykonawczego i metadanych kandydata `scripts/browser-acceptance.cjs`
zapisuje `acceptance-terminal.json` w katalogu `CI_BROWSER_DIAGNOSTICS`, gdy weryfikacja
akceptacyjna zakończy się lub zgłosi wyjątek. Rekord zawiera ostatni etap, tożsamość
źródeł i kandydata, docelową przeglądarkę, uruchomienie i próbę, czas trwania oraz status
zakończenia procesu testowego, sygnał lub kod błędu z listy dozwolonych wartości. Rekord
ma mniej niż 2 KiB i nie zawiera surowych błędów, adresów URL, stdout/stderr, wartości
zmiennych środowiskowych ani zrzutów pamięci. Plik jest tworzony z dostępem wyłącznym
i uprawnieniami `0600` w istniejącym katalogu wyjściowym zadania; istniejący plik ani
dowiązanie symboliczne pod ścieżką pliku docelowego nie są nadpisywane.

Są to **dane diagnostyczne, a nie potwierdzenie pomyślnej akceptacji**. Rekord zawsze
deklaruje `acceptance: false`; tylko osobny plik `CI_BROWSER_EVIDENCE` może potwierdzić
kwalifikację kandydata po przejściu wszystkich istniejących asercji. Błąd zapisu
diagnostyki nie może zastąpić pierwotnego wyniku powodzenia lub niepowodzenia. Nagłe
zakończenie procesu opakowującego albo błąd wczytania metadanych przed rozpoczęciem
tego etapu może spowodować brak rekordu. Sygnał procesu testowego nie dowodzi, że ten
sygnał otrzymał proces treści Firefoksa. Ustalenie źródła awarii natywnej nadal wymaga
odpowiadającego jej natywnego stosu lub kontrolowanego odtworzenia błędu; pomyślna
ponowna próba nie zamyka dochodzenia.

Ten pomocniczy skrypt nie włącza surowych raportów awarii Firefoksa ani logowania
`DEBUG=pw:browser`. Pamięć przeglądarki i wyjście konsoli mogą zawierać dane wrażliwe;
nie wolno ich kopiować do zwykłych wysyłanych artefaktów bez osobno zweryfikowanych
zasad zbierania danych i dostępu. Kolejność scenariuszy, przypięte wersje przeglądarek,
jeden proces roboczy, brak ponownych prób i istniejące limity czasu pozostają bez zmian.

<a id="from-source-to-accepted-candidate"></a>

## Od źródła do zaakceptowanego kandydata

![Źródło, weryfikacja pakietu, sprawdzenie możliwości i dowody](diagrams/candidate-verification-flow.svg)

1. Zbuduj przejrzane źródło i spakuj powstałe pliki Mode A. Zachowaj przy kandydacie sumę kontrolną archiwum i tożsamość źródła.
2. Przed rozpakowaniem sprawdź limit rozmiaru archiwum, bezpieczne ścieżki, typy plików, źródło/wersję i kompletny inwentarz hashów wpisów/providerów. Kwalifikacja wydania sprawdza dodatkowo zamrożone poświadczenie kompilacji.
3. Zbadaj faktyczną wersję przeglądarki i możliwości multimedialne. Wybierz zadeklarowany profil; niezgodność powoduje błąd zamiast cichego ograniczenia pokrycia.
4. Uruchom dokładny zestaw scenariuszy na rozpakowanych plikach, bez przebudowy. Każdy scenariusz musi wystąpić dokładnie raz, bez pominięć, błędów ani ponowień.
5. Zachowaj środowisko, możliwości, skrót kandydata i wyniki scenariuszy. Wspólna bramka przed akceptacją dowodów sprawdza wymagane cele i zgodność uruchomienia/próby/źródła. Koordynacja wydania i akceptacja urządzeń pozostają osobnymi warunkami.

<a id="what-has-been-measured-locally"></a>

## Co zmierzono lokalnie

![Lokalna weryfikacja integracji: osobne zestawy urządzeń i spakowanych przeglądarek](diagrams/browser-verification-results.svg)

Dla źródła `c52f4d07` pełny przebieg urządzeń/przeglądarki Chromium zaliczył 196 testów z jednym oczekiwanym pominięciem natywnego HLS. Osobno to samo spakowane archiwum Mode A zaliczyło pięć scenariuszy w każdym z Chromium 156.0.8078.4, Firefox 157.0 i WebKit 27.2: 15 zaliczeń, bez pominięć i ponowień. To różne zestawy; ich liczebności nie są procentem pokrycia ani dowodem zaliczenia wszystkich 35 hostowanych celów.

[Zapisane poświadczenia](evidence/post779-local-acceptance/summary.json) identyfikują rzeczywisty host macOS 26.7.1. Wyraźnie odróżniają go od etykiety profilu `macos-15` i nie kwalifikują wydania. Aby powtórzyć lokalne sprawdzenie na Macu, zainstaluj zablokowane zależności i przeglądarki Playwright 1.64.0, zbuduj aktualne źródło, a następnie uruchom [zapisany przepis](evidence/post779-local-acceptance/reproduce.sh) z katalogiem repozytorium jako argumentem. Pakuje istniejącą kompilację, sprawdza kandydata, bada każdą przeglądarkę i zapisuje nowe poświadczenia w `.compatibility/`. Wymaga portu 4189 i odmawia nadpisania istniejącego katalogu `browser-candidate-web`. Nie zmieniaj źródła między kompilacją a wykonaniem przepisu. Wyniki hostowanego CI i fizycznych urządzeń są śledzone osobno w [raporcie implementacji](implementation-report.pl.md).
