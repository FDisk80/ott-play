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

Локальні файли без інтернету: див. [Локальні відео та відтворення офлайн](docs/offline-media.md).

[![Список каналів OTT-play FOSS у перспективі](docs/images/hero.png)](docs/images/studio-2026-default.png)

*Наявний знімок інтерфейсу Studio 2026 із синтетичними каналами та програмами.
Відкрийте зображення для початкового плаского вигляду; це не знімок чинної передплати.
[Джерело зображення та повторне створення](docs/images/README.md).*

[Швидкий початок 88 мовами](docs/readme/README.md) · [Вікі документації](docs/wiki/Home.uk.md)

[![Належні практики OpenSSF](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![Фазинг: лише RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

Публічні кандидати у випуск проходять обмежені ізольовані кампанії фазингу для нативного/серверного розбору XMLTV та перевірки запитів порталів. Див. [обсяг фазингу, відтворення та докази випуску](FUZZING.md).

Самодостатній IPTV/OTT-програвач із локальним HTTP-сервером на Rust. Працює на Smart TV (LG WebOS, Samsung Tizen, Panasonic, Sony тощо), приставках (Infomir MAG, Dune HD, Enigma2, Android TV) та в настільних браузерах.

Почніть із [посібника з архітектури та внесків](docs/architecture.md), щоб дізнатися про рівні виконання, відповідальність, розширення провайдерів і перевірки. [Сеанси відтворення та життєвий цикл провайдерів](docs/playback-session-architecture.md) описують межу між ядром і хостом та контракти сумісності.

<!-- ci-release-process:start -->
<a id="release-process"></a>

## Процес випуску

Див. [стратегію випуску](RELEASING.md) для правил перевірки та просування nightly, beta, RC і stable, а також [операційний посібник](docs/release-workflow.md) для локальних команд.
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## Запуск у браузері

Відкрийте [діючу демонстрацію](https://player.ottplay.here.now/) або зберіть і розмістіть вебпрогравач за інструкціями нижче.

[Локальне розгортання macOS](docs/local-http-deployment.md) надає HTTP-origin програвача на портах 8443–8446. Порт 8095 виведений з використання.

Під час першого запуску виберіть **Спробувати демонстрацію**, щоб відтворити рухому тестову таблицю, або налаштуйте власний список M3U чи провайдера. Надалі демонстрація доступна через **Змінити провайдера → Демонстрація**.

Режим демонстрації потребує інтернету, але не облікового запису провайдера. Його беззвучні тестові канали MP4 і HLS розміщені на here.now та спільно використовуються вебпрогравачем, Tauri, Capacitor і OTT Server. Перемикання зберігає наявні налаштування провайдерів. Для окремої **перевірки зображення та звуку** відкрийте **Інформація → Аудіо → Відтворити** на керованому рушії HTML5 під час простою або перегляду прямого ефіру. Це використовує звуковий тестовий файл `av-v1.mp4` на here.now і потребує інтернету. Кліп відсутній у пакетах програвача й ніколи не завантажується під час запуску. VOD, архів і перевизначені рушії пристроїв (зокрема PC2/Video.js та нативні рушії) виключені; див. [кроки, очікувані тони та схему розміщення](docs/audio-video-check.uk.md).

Встановлені вікна настільного браузера підтримують **Window Controls Overlay**: Chrome може приховати окремий рядок заголовка, зберігши кнопки вікна та меню застосунку над програвачем. Відкрийте встановлений застосунок і виберіть **Приховати рядок заголовка**, коли Chrome це запропонує; **Показати рядок заголовка** повертає звичайну рамку. Звичайні вкладки та телевізійні/нативні оболонки зберігають поточну поведінку. Див. [керування вікном браузера](docs/browser-window-controls.md) щодо підтримуваних URL встановлення, оновлення наявного ярлика та перевірки.

Для перемотування на десять секунд у головному відеовигляді використовуйте **Alt/Option + Ліворуч/Праворуч** (на macOS також працює **Command + Ліворуч/Праворуч**) у повноекранному та звичайному режимах. Локальні відео, VOD і підтримувані архіви каналів використовують однакове керування у вебі, Tauri та Capacitor. Див. [клавіатурні скорочення й обмеження](docs/browser-window-controls.md#playback-keyboard-shortcuts).

В інтерфейсі ПК клавіша **R** відтворює інший випадковий канал або відео з поточного списку, не змінюючи порядок. Працює в головному відеовигляді та списках каналів/відео; текстові редактори, діалоги, налаштування й обмеження кіоску мають пріоритет. Інші призначення клавіш пристроїв не змінюються.

Синтетичну тестову таблицю можна створити повторно за допомогою `scripts/generate-demo-media.sh` (потрібен FFmpeg); створені медіа залишаються в ігнорованому каталозі `.local-artifacts`.

<a id="features"></a>

## Можливості

- **Відтворення**: HLS, DASH і звичайні HTTP-потоки з керованими обмеженнями якості HLS.js/Shaka, обмеженим відновленням і до трьох явних резервних URL на канал прямого ефіру. Архів/VOD ніколи не перемикається на резерв прямого ефіру; див. [якість і відновлення](docs/playback-stream-policy.uk.md).
- **EPG**: зіставлення XMLTV, зсув часу/перегляд минулих передач, пошук назв програм (N5 в EPG), нагадування та ручна прив'язка джерела/ID до конкретного каналу в розміщеному/нативному шляху XMLTV. Див. [прив'язку та доступність](docs/guide-binding-accessibility.uk.md).
- **Обране**: одна впорядкована [змішана колекція](docs/mixed-favorites.md) з налаштованих провайдерів і профілів на підтримуваних пристроях, із переносним експортом/імпортом через CLI; батьківський PIN. У резервному режимі залишаються доступними окремі списки обраного для кожного джерела.
- **Налаштування**: JSON-експорт/імпорт налаштувань і обраного, журнал скасування для підтримуваних пакетів localStorage, відновлення архіву з урахуванням джерела та точне порівняння збережених налаштувань для процедур контролера. Відновлення передбачає одного записувача; власні адаптери сховища зберігають відкат у межах можливого. Див. [відновлення налаштувань](docs/settings-recovery.uk.md).
- **Спільний інтерфейс**: OTT Server, Tauri й Capacitor використовують одну тему списку каналів і налаштування видимості. Налаштування інтерфейсу керують кольорами підсвічування та вибору; налаштування списку — назвами каналів, піконами, поточними програмами, прогресом і позначками архіву.
- **Провайдери**: M3U/M3U8, прямий ефір Xtream та [каталоги фільмів/серіалів на вимогу](docs/xtream-media.uk.md), Stalker/Ministra з [фільмами та вкладеними епізодами](docs/stalker-media.md), Plex і VPortal. Можливості провайдера та доступ облікового запису визначають доступні функції архіву й медіатеки.
- **Push-команди**: дистанційне керування через webhook — змінити канал, провайдера, список, показати повідомлення
- **Віддалене введення тексту (swop)**: клавіатура телефона через Cloudflare Worker, коли телевізор і телефон у різних мережах (сеанси авторизовані для встановлення; ♥™ на екранній клавіатурі)
- **Маршрутизація за пристроєм**: адресація UUID для конфігурацій із кількома пристроями
- **Локальний проксі**: необов'язковий локальний сервер команд для повністю локальної автоматизації (центральний сервер не потрібен)
- **Інтеграція контролера**: оператори, обмежені пристроями/діями, необов'язкові стійкі результати команд, відновлюване застосування профілів Local/Home та передавання прямого/архівного відтворення того самого джерела через відповідний [сервер керування](https://github.com/open-ott-play/ottplay-control-server). Потрібен оновлений контролер/CLI; окрема вкладка браузера цього не надає.
- **Типізовані віддалені налаштування**: знаходьте доступні налаштування, читайте збережені та чинні значення й зберігайте зміни з перевіркою екземпляра програвача, джерела та ревізії; див. [віддалені налаштування й конфігурацію VPortal](docs/remote-player-settings.md).
- **Налагодження**: добровільно ввімкнений HUD відтворення/кільцевий журнал через `?debug=1`, віддалений огляд за згодою та розміщена перевірка аудіо/відео на вимогу
- **Доступність клавіатури**: названі класичні діалоги, утримання й повернення фокусу Tab, семантика вибраного каналу та ненав'язливі повідомлення стану. Ці поліпшення не засвідчують повної відповідності WCAG або екранним читачам пристроїв.
- **24 типи пристроїв**: окремі призначення клавіш пульта для кожного пристрою
- **88 мов інтерфейсу**: відповідні каталоги, [локалізовані короткі інструкції](docs/readme/README.md) та [абетки клавіатур, перевірені за CLDR](docs/localization.md). Головний посібник і парні інструкції функцій доступні [24 мовами документації](docs/manual-translations.md); інші інженерні довідники зберігають поточні мови.

[Посібник постачання](docs/roadmap-delivery.uk.md) описує реалізовані можливості цієї ревізії, межі платформ, схеми та перевірки. Встановлені випуски або розміщені розгортання можуть використовувати старішу ревізію. Окремий нативний [застосунок Android](https://github.com/open-ott-play/ottplay-android) також зберігає вибір аудіо/субтитрів за мовою, роллю та назвою замість індексів маніфесту; його реалізація та випуск незалежні від цього фронтенду.

В [огляді вихідного коду STB](docs/stb-player-improvements.md) описано поліпшення роботи з медіаконтентом, використання ресурсів і відновлення, порівняння вихідного коду та поточні обмеження.

<a id="debug-hud"></a>

## HUD налагодження

Локальний HUD і постійне зберігання журналів сервера вмикаються окремо. Перед збиранням журналів інших пристроїв див. [діагностичний доступ, приховування даних і зберігання](docs/diagnostic-security.md).

Увімкніть налагодження одним зі способів:
- URL: `?debug=1` або `?debug=true`
- Локальне сховище: `localStorage.setItem("ottplay_debug", "1")`
- Властивість вікна: `window.__OTT_DEBUG__ = true`
- Сервер: коли `/debug/config` повертає `{enabled: true}`

Коли налагодження ввімкнене:
- Натисніть **D**, щоб перемкнути екранну смугу HUD (`ottDebugSetHud` / `__ottDebug.toggleHud()`)
  - Пропускається, якщо фокус на INPUT/TEXTAREA/listEdit
  - Використовує `e.key`, щоб уникнути конфлікту MAG/Maple PLAY/PREV=68
- Меню інформації → **HUD налагодження** → викликає `__ottDebug.toggleHud()`
- Керування налаштуваннями → **HUD налагодження**:
  - Якщо налагодження вже завантажене: перемикає видимість HUD
  - Інакше: задає `ottplay_debug=1` + `ottplay_debug_hud=1` і пропонує перезапуск
- Збереження: `ottDebugSetHud` записує стан HUD у `localStorage.ottplay_debug_hud` ("1"/"0")

<a id="capacitor-ios-and-android"></a>

## Capacitor для iOS та Android

Цей репозиторій пакує спільний TypeScript-фронтенд за допомогою Capacitor для iOS та Android 7+. Обидва використовують системні шрифти та зафіксоване npm нативне середовище. Окремий сумісний APK API 22 підтримує Android 5.1/6 із WebView 60 або новішим. Обидва APK Android підписані та входять до кваліфікованих beta-, RC- і стабільних випусків разом із непідписаним IPA iOS. Окремий Kotlin-застосунок залишається в [ottplay-android](https://github.com/open-ott-play/ottplay-android).

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

Див. [конфігурацію Capacitor](docs/capacitor-mobile.md) та [поширення Android і віддалені оновлення](docs/android-distributions.md).

Інтерфейс iOS використовує альбомну орієнтацію. Налаштування, конфігурація провайдера, згода на дистанційне керування та імпорт/експорт JSON далі використовують спільний фронтенд. Багатозадачність планшета може змінити запитану орієнтацію.

На iPhone проводьте вертикально по списку каналів, щоб рухатися рядками та сторінками; угору — до наступних каналів, униз — до попередніх. Швидкий рух продовжується на кілька сторінок і сповільнюється до зупинки; повільне перетягування залишається точним. Торкніться екрана або натисніть навігаційну клавішу, щоб зупинити рух. Один дотик запускає канал під пальцем, навіть якщо вибраний інший рядок. Проведення ніколи не відкриває канал після підняття пальця.

На iPhone відео відтворюється всередині інтерфейсу. Торкніться низу екрана для інформації про програму або відкрийте меню, не перериваючи відтворення. Картинка в картинці залишається окремим режимом.

Базова перевірка пристрою: [контрольний список режиму B](docs/mode-b-device-smoke.md) та `./scripts/smoke-capacitor-device.sh --help` (збирання/синхронізація лише для iOS). Базова перевірка Tauri desktop: [контрольний список комп'ютера](docs/mode-b-tauri-smoke.md).

<a id="installation"></a>

## Встановлення

| Платформа | Пакет | Примітки |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Окремі збірки Apple Silicon та Intel; підпис ad-hoc, якщо не налаштований підпис Apple |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | Різні дистрибутиви |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode або Homebrew Channel](docs/lg-webos-installation.md); вебпрогравач, потрібна мережа |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode і локальний підпис; непідписаний пакет для ТБ, окремий від Family Hub](docs/samsung-tizen-installation.md) |
| **iOS** | `.ipa` через AltStore / TestFlight / Xcode | Лише стороннє встановлення — у App Store ще немає |
| **Android (спільний фронтенд)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | Підписані пакети Capacitor; виберіть підтримувану версію Android |
| **Android (нативний Kotlin)** | Окремий [нативний застосунок](https://github.com/open-ott-play/ottplay-android) | Публічний репозиторій; окремий застосунок і процес випуску |

Підтримувані інсталятори додані до кваліфікованих випусків GitHub: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **Примітка:** пакети macOS використовують ad-hoc підпис за відсутності даних підписування Apple; це не надає Developer ID або нотаризації. Інсталятори Windows/Linux та пакети iOS можуть бути непідписаними. iOS вимагає підпису перед встановленням на фізичний пристрій. Кваліфіковані APK Android Full і API 22 використовують усталений сертифікат підпису; локальні випускові збірки потребують налаштованого keystore для створення підписаних APK.

---

<a id="macos"></a>

### macOS

1. Виберіть потрібний тег із [випусків](https://github.com/open-ott-play/ottplay-foss/releases). Посилання на останній випуск вибирає stable, не beta або RC.
2. Завантажте `OttPlay.FOSS_*_aarch64-apple-darwin.dmg` для Apple Silicon або `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` для Intel. Це окремі архітектурні збірки.
3. Відкрийте `.dmg` і перетягніть **OttPlay FOSS.app** до Програм.
4. Перевірте скопійований пакет перед першим запуском:

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

Успішна перевірка засвідчує цілісність пакета. `Signature=adhoc` означає, що застосунок не має автентифікованої Apple особи розробника; це не доводить нотаризації або схвалення Gatekeeper. Навіть за довіреного завантаження та справного пакета macOS може після першої спроби вимагати **Системні параметри → Приватність і безпека → Відкрити попри це**; див. [інструкції Apple](https://support.apple.com/en-us/102445).

Повідомлення «застосунок пошкоджений» не доводить, що причина лише в карантині. Якщо підпис не проходить перевірку, збережіть помилку й отримайте виправлений випуск. Не перепідписуйте завантажений застосунок і не видаляйте атрибути, щоб невдала перевірка виглядала успішною.

Альтернативні ZIP-файли: `OttPlay.FOSS_aarch64-apple-darwin.app.zip` і `OttPlay.FOSS_x86_64-apple-darwin.app.zip`. Див. [підпис macOS та перевірку артефактів](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact) щодо розпакування, образів диска та Gatekeeper. Для збірок checkout і локального встановлення використовуйте [локальне постачання macOS](docs/macos-local-delivery.md).

---

<a id="windows"></a>

### Windows

1. Завантажте `.msi` або `.exe` з [випусків](https://github.com/open-ott-play/ottplay-foss/releases/latest)
2. Запустіть інсталятор і виконайте вказівки
3. Запустіть із меню Пуск або ярлика робочого столу

---

<a id="linux"></a>

### Linux

Відтворення Linux потребує модулів GStreamer HLS, H.264 та AAC на додачу до WebKitGTK. Пакети декларують ці медіазалежності; збірки AppImage містять медіафреймворк. Див. [пакування медіа Linux](docs/linux-media-packaging.md) щодо перевірки кодеків і різниці між прийманням у браузері та нативно.

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

### Встановлення iOS

iOS вимагає підпису перед встановленням на фізичний пристрій. Використовуйте AltStore Classic для непідписаного IPA випуску або зберіть і підпишіть вихідний код у Xcode. TestFlight потребує окремого запрошення, якщо його надають.

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### Варіант 1: AltStore Classic (рекомендовано для особистого використання)

AltServer працює на комп'ютері; AltStore Classic працює на iPhone/iPad та імпортує IPA. Достатньо безкоштовного облікового запису Apple.

**Передумови:**

- iPhone/iPad з **iOS/iPadOS 15 або новішою** для поточної збірки OTT-play.
- Mac або ПК Windows з AltServer і USB-кабелем даних.
- Обліковий запис Apple для підписування та інтернет для завантаження випуску.

**Крок 1: один раз налаштуйте AltStore**

1. Встановіть AltServer за офіційною [інструкцією macOS](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) або [інструкцією Windows](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows). Запустіть і використовуйте значок у рядку меню/системній області.
2. Під'єднайте пристрій через USB, розблокуйте й підтвердьте довіру на комп'ютері/пристрої. На Mac перевірте появу пристрою у Finder.
3. У **меню AltServer → Install AltStore** виберіть пристрій і виконайте запити облікового запису підписування. Дочекайтеся повідомлення про встановлення.
4. На пристрої відкрийте **Параметри → Загальні → VPN і керування пристроєм** і за потреби довірте запису розробника свого облікового запису підписування. На iOS 16+ увімкніть **Параметри → Приватність і безпека → Режим розробника**, виконайте перезапуск і підтвердження.
5. Відкрийте AltStore на пристрої. Якщо вже встановлений і працює, пропустіть цей крок налаштування та залиште AltServer запущеним для імпорту нижче.

**Крок 2: імпортуйте вибраний випуск на iPhone/iPad**

1. Виберіть точний тег серед [усіх випусків](https://github.com/open-ott-play/ottplay-foss/releases) і завантажте його `ottplay-foss-ios-unsigned.ipa` у Safari на пристрої. [Посилання на останній випуск](https://github.com/open-ott-play/ottplay-foss/releases/latest) вибирає стабільний; для бети користуйтеся повним списком.
2. Збережіть IPA у Файлах. У **AltStore → My Apps → +** виберіть цей файл. Можна також передати завантажений IPA з Mac через AirDrop та зберегти у Файлах перед імпортом. Відкриття IPA на Mac не є цим кроком імпорту.
3. Залиште AltServer запущеним, а USB-кабель під'єднаним, поки AltStore підписує та встановлює застосунок. Для оновлення використовуйте той самий обліковий запис підписування, що й у наявної інсталяції; не видаляйте застосунок першим кроком усунення проблем.
4. Дочекайтеся завершення імпорту, перевірте OTT-play у **My Apps** і запустіть його.

**Альтернатива: безпосередньо імпортуйте URL випуску**

Коли AltStore вже встановлений, введіть цей шаблон у **Safari на iPhone**, замініть `TAG` точним тегом випуску й погодьтеся на **Відкрити в AltStore**:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

Це використовує [обробник URL встановлення](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift) AltStore. Так уникають неоднозначних записів Файли/Недавні, коли кілька завантажень мають однакову назву. URL має вказувати на IPA-файл, а не сторінку випуску.

Наприклад, наступний імпорт перевірено **2026-09-29** з AltStore 2.3 та AltServer 1.8.1. Це фіксований історичний приклад, не посилання на найновішу версію:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**Поновлення:** встановлення з безкоштовного облікового запису спливають за сім днів. Підтримуйте доступність AltServer і використовуйте **AltStore → My Apps → Refresh All** до спливу. Фонове поновлення також потребує AltServer; див. [інструкції поновлення AltStore](https://faq.altstore.io/altstore-classic/your-altstore).

<a id="verify-the-installed-version-before-retrying"></a>

#### Перевірте встановлену версію перед повторною спробою

Повідомлення AirDrop «Надіслано» підтверджує лише передавання. Смуга прогресу AltStore підтверджує початок імпорту. Втрата з'єднання Дублювання/USB не доводить невдалого встановлення: перевірте встановлений застосунок перед повторним надсиланням IPA.

На Mac зі встановленим Xcode, вибраним як активний каталог розробника, огляньте пристрій без перевстановлення:

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

У `result.apps` JSON знайдіть OTT-play (`bundleIdentifier` починається з `play.ott.foss`) і порівняйте `version` та `bundleVersion` із `CFBundleShortVersionString` та `CFBundleVersion` вибраного IPA. Суфікс облікового запису підписування AltStore в ідентифікаторі пакета очікуваний. Зберігайте звіт пристрою локально.

Перевірений приклад beta.9 показує **версію `1.1.51`, збірку `2.2.66`**. Це підтверджує встановлення; відкриття застосунку, вхід Cloudflare, завантаження списку, відтворення та PiP — окремі перевірки на пристрої.

<a id="troubleshooting-ios-installation"></a>

#### Усунення проблем встановлення iOS

- **AltServer не має вікна або автоматизоване відкриття перевищує час:** використовуйте значок у рядку меню/системній області. Це фоновий застосунок. Повторні спроби відкрити звичайне вікно не імпортують IPA.
- **«Could not find AltServer» або USB-пристрій недоступний:** перевірте роботу AltServer, розблокуйте телефон і перевірте запити довіри. На Mac перевірте видимість у Finder. Якщо зв'язок обірвався, безпечно під'єднайте знову й перевірте встановлену версію перед повтором. За стійкої проблеми скористайтеся [діагностикою з'єднання AltStore](https://faq.altstore.io/altstore-classic/troubleshooting-guide). Якщо телефон надає комп'ютеру інтернет, узгодьте зміну кабелю чи мережі, щоб не перервати іншу роботу.
- **Дублювання iPhone показує «iPhone in Use» або лишається на «Connecting»:** завершіть налаштування на фізичному телефоні або заблокуйте екран і залиште його біля розблокованого Mac для дублювання. Розблокування телефона завершує Дублювання; довіра/налаштування USB спершу можуть потребувати розблокування. Якщо одне перепід'єднання не допомагає, закрийте Дублювання й продовжте на телефоні. Див. [вимоги Apple до Дублювання](https://support.apple.com/en-us/120421). Для встановлення Дублювання необов'язкове.
- **URL втрачає латинські літери або стає кириличним у Дублюванні:** перемкніть **джерело введення Mac на ABC/англійську**. З активним Дублюванням натисніть **Control–Пробіл** і виберіть **English (US)** для апаратної клавіатури iPhone. Джерела введення Mac та iPhone можуть відрізнятися; зміни лише на Mac у перевіреному сеансі було недостатньо. Очистьте поле, введіть URL знову й перевірте адресу перед надсиланням.
- **Вставлення з буфера в Дублювання зависає або додає неочікуваний текст:** очистьте поле й набирайте повільно короткими частинами з джерелом English (US) iPhone або введіть URL безпосередньо на телефоні. Швидке введення через Дублювання може губити або подвоювати символи; перевірте всю адресу перед збереженням. Не надсилайте частково вставлений URL. У нашому сеансі вставлення не працювало; це не передумова методу прямого URL.
- **Файли/Недавні показують кілька однакових назв IPA:** виберіть точне місце завантаження або використайте прямий URL із тегом вище. Локальну копію можна перейменувати з тегом/збіркою для зрозумілості; перейменування не змінює вміст.
- **Встановлений застосунок не відкривається:** виконайте запити довіри розробнику або Режиму розробника на телефоні. Перевірте строк дії в AltStore і поновіть за потреби. За подальшого збою запишіть фактичну помилку; помилка з'єднання сама по собі не є підставою видаляти й перевстановлювати застосунок.
- **OTT-play відкривається, але захищений список не працює в мобільній мережі:** встановлення та автентифікація джерела — різні речі. Через **Налаштування → Керування налаштуваннями → Доступ до джерела** увійдіть у налаштоване джерело й перезавантажте список. За потреби завершіть біометрію/passkey або код електронної пошти на фізичному пристрої. Джерело має підтримувати [інтеграцію iOS Access](docs/ios-source-access.md); встановлення не обходить список дозволених IP.
- **Запит passkey у довіреній Wi-Fi:** для джерел з iOS Access застосунок спершу пробує початкове джерело без входу й використовує автентифікований мобільний вхід лише після відмови в доступі. Перевірте публічний IP, який справді бачить джерело, включно з IPv6: дозволений домашній IPv4 не охоплює інший IPv6, VPN чи мобільну адресу. Зміна мережі та повторне відкриття очищують тимчасову перевагу маршруту. Загальна мережева/серверна помилка не повинна викликати вхід.
- **Вхід більше не з'являється, але список каналів порожній:** чинний збережений сеанс використовується без повторного запиту. Після попереднього невдалого завантаження чи виправлення сервера перезавантажте список або один раз повністю закрийте й відкрийте застосунок. Якщо не допоможе, перевірте, що джерело повертає список, а не HTML-сторінку входу або JSON-помилку. Запишіть видиму помилку й HTTP-статус; не поширюйте URL джерел із обліковими даними, cookies чи токенами Access.
- **Канали завантажуються, але відео буферизується або показує `SRC_NOT_FOUND`:** завантаження списку й відтворення відео — окремі перевірки. Після входу повторіть канал один раз; за стійкої проблеми перевірте відповіді маніфесту HLS і сегментів та підтримку кодеків потоку. Сама помилка не доводить, що зміна рушія чи перевстановлення допоможе.

<a id="option-2-testflight-if-available"></a>

#### Варіант 2: TestFlight (якщо доступний)

Якщо опубліковане запрошення TestFlight, встановіть TestFlight з App Store, відкрийте запрошення на пристрої й торкніться **Встановити**. Завантаження IPA з GitHub не надає запрошення TestFlight.

<a id="option-3-xcode-for-developers"></a>

#### Варіант 3: Xcode (для розробників)

Виконайте [Збирання та відкриття](docs/capacitor-mobile.md#build-and-open), виберіть ціль **App** у Xcode, налаштуйте команду розробника в **Signing & Capabilities**, виберіть під'єднаний пристрій і зберіть/запустіть. За потреби підтвердьте довіру та Режим розробника. Імпорт непідписаного IPA випуску у вікно Devices Xcode не надає відсутньої особи підписувача або профілю підготовки.

---

<a id="android-application"></a>

### Застосунок Android

Виберіть Full Capacitor APK із випуску цього репозиторію для спільного інтерфейсу програвача. На Android 5.1–6 використовуйте сумісний API 22 APK; потрібен WebView 60 або новіший. Зберігайте ідентичність застосунку та сертифікат підпису під час оновлення, щоб наявні профілі залишалися доступними. Див. [інструкції збирання](android/README.md) та [поширення, підписування й віддалене встановлення](docs/android-distributions.md).

Окремий [репозиторій ottplay-android](https://github.com/open-ott-play/ottplay-android) містить нативний застосунок Kotlin/Compose. Він має власну ідентичність, параметри та процес випуску й не замінює встановлений Capacitor безпосередньо. Історичні файли випусків залишаються доступними.

---

<a id="quick-start"></a>

## Швидкий початок

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

Для базових перевірок у браузері використовуйте власне розгортання тієї самої ревізії.

Використовуйте Node 22 і стабільний набір інструментів Rust. Запускайте сервер із кореня репозиторію, щоб статичні ресурси були доступні. Нативні збірки потребують платформних інструментів, описаних нижче; для самого сервера вони не потрібні.

Під час першого завантаження виберіть **Спробувати демонстрацію** або відкрийте **Налаштування → Змінити провайдера → Списки M3U / M3U8**. Відкрийте **Вибрати список**, виберіть позицію, введіть **URL списку**, збережіть зміни та виберіть **Завантажити список**. Список або обліковий запис провайдера надаєте ви; застосунок не надає передплати платних каналів.

<a id="mode-a-companion-smoke"></a>

## Базова перевірка companion режиму A

Перевірка curl для companion режиму A (відповідність `ottplay-server` / `archive/server.py`): індекс, статичні каталоги, `/logo`, `/version`, необов'язковий `/epg` та перевірка `POST /m3u/cp.php` без завантаження.

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

Перевірки розміщені в `scripts/modea-smoke-checks.json`. Без секретів. Чергу команд / `local_proxy.py` (:8081) окремо перевіряє `scripts/smoke-command-queue.sh` (за наявності).

<a id="classic-stalker--ministra-portals"></a>

## Класичні портали Stalker / Ministra

Виберіть **Портали Stalker** і введіть виданий провайдером MAC та повний URL порталу, наприклад `http://provider.example/stalker_portal/c/`. URL `/c/index.html`, `/stalker_portal`, `/server/load.php`, `/load.php` і `/portal.php` вибирають класичний протокол MAG. Наявні конфігурації лише адреси сервера зберігають JSON-RPC. Провайдер завантажує профіль, жанри й посторінкові канали прямого ефіру через спільне ядро Stalker, а потім у фоновому режимі знаходить фільми та вкладені епізоди через класичний протокол `type=vod`. Шляхи папок стають категоріями у звичайному списку каналів; доступні описи, постери та стабільні записи глобального Обраного використовують той самий інтерфейс медіаконтенту. Див. [поведінку й обмеження каталогу](docs/stalker-media.md).

У самостійно розміщеній браузерній версії запити проходять через endpoint `/stalker/api` companion; нативні застосунки використовують наявний HTTP-транспорт. Браузерні версії на хостингу потребують явно налаштованих маршрутів через [виділений ретранслятор](docs/stalker-relay.md). Ресурси браузера та сервера потрібно оновлювати разом.

Відтворення прямого ефіру розв'язує тимчасові команди каналу під час відкриття потоку; зміна каналу, зупинка, PiP і заміна провайдера скасовують застарілі розв'язання. Явні нетимчасові HTTP(S)-команди відтворюються безпосередньо. Коротке EPG підтримується. Архів класичного порталу та окремий діалект `type=series` цей провайдер не надає. Поведінка наявного архіву/програми JSON-RPC не змінюється. Приватні LAN-портали, доступні через маршрут companion, потребують точного запису `OTTPLAY_PROXY_LAN_ORIGINS`, як і решта проксі-маршрутів companion.

Публічна демонстрація Infomir — `http://middleware-stalker.com/stalker_portal/c/`. Вона повертала три записи каталогу прямого ефіру 2026-09-26, але медіа-endpoint були недоступні; для регресій відтворення використовуйте контрольовані тестові дані порталу/медіа.

<a id="m3u-stream-proxy-header-smoke"></a>

## Перевірка заголовків проксі потоків M3U

Порівнює заголовки вихідних запитів, які `POST /m3u/cp.php` companion режиму A додає під час отримання контрольованого echo-URL (типово локальна імітація — без IPTV-провайдерів і секретів).

Контракт (із `src-rs/core/src/m3u.rs` + `archive/server.py`):
- Додає лише **User-Agent** (типово `OTT-play-FOSS/1.0` або профілі `webos` / `tizen` / `viera` / `mag` / `dune`).
- **Не** додає **Referer** (`M3UProxy` Capacitor додає; режим A — ні).
- Прибирає початковий `@` із `url` (форма jQuery провайдера).

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

Код виходу: `0` успіх, `1` немає прослуховування, `2` невідповідність заголовка/HTTP, `3` використання/залежності. Доповнює `smoke-modea-companion.sh` / `smoke-command-queue.sh`.

<a id="logo-concurrent-bench-smoke"></a>

## Паралельна перевірка навантаження логотипів

Перевірка затримки одночасних `GET /logo/<id>.svg` (необов'язковий `?ch=`) для companion режиму A. Показує кількості успіхів/помилок і p50/p95/p99. Типове навантаження практичне для локального CI (`CONCURRENCY=200`, `TOTAL=1000`); повний тривалий тест на 10 тисяч необов'язковий (`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`).

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

Код виходу: `0` успіх, `1` немає прослуховування / з'єднання не вдалося, `2` висока частота помилок, `3` використання. Доповнює `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`.

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## Перевірка оновлення та прогрівання кешу XMLTV

Перевіряє реальну поведінку кешу XMLTV/EPG companion режиму A відповідно до `src-rs` (без вигаданих API):

- `EPG_CACHE` у пам'яті надається через `GET /epg/:hash` → завжди `{"epg_data":[...]}` (HTTP 200).
- Запуск процесу завантажує `EPG_URLS` у фоні, не затримуючи HTTP; після кожного завершеного завантаження йде очікування **2h** до наступного оновлення.
- Необов'язкове зберігання SQLite, коли задано `DATABASE_URL` (немає публічного endpoint стану кешу).
- `GET /health` → `OK` підтверджує готовність HTTP після необов'язкового перезапуску. З `--strict-epg` і `--epg-hash` перевірка також очікує непорожнього EPG каналу в межах того самого `--warmup-timeout`.

Типовий шлях лише виконує curl — **не завершує процеси**. Передайте `--restart-cmd` / `RESTART_CMD` для автоматичного завершення й перезапуску або дотримуйтеся ручних кроків `launchctl` у `--help`.

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

Код виходу: `0` успіх, `1` немає прослуховування, `2` помилка твердження/прогрівання, `3` використання. Доповнює `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`.

<a id="mode-a-e2e-play-path-smoke"></a>

## E2E-перевірка шляху відтворення режиму A

Перевірка **шляху відтворення/готовності потоку** на боці companion (лише HTTP — **не** E2E з видимим інтерфейсом). Для запущеного companion режиму A перевіряє:

- Доступність health або індексу
- Статичні ресурси оболонки програвача (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`)
- Необов'язковий `GET /epg/<hash>.json`, коли задано `EPG_HASH`
- `POST /m3u/match-channels` із JSON-тестом без секретів (порожній список + один синтетичний канал)
- **Відтворення** через проксі: `POST /m3u/cp.php` до контрольованого медіа (типово локальний HLS-список або `MEDIA_URL`) та перевірка HTTP 200 + непорожнього тіла / очікуваного `Content-Type` (перші байти через проксі)

Без приватних облікових даних IPTV. Доповнює `smoke-modea-companion.sh` (наявність), `smoke-m3u-stream-proxy-headers.sh` (UA/Referer), `smoke-xmltv-cache-refresh.sh`.

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

Код виходу: `0` успіх, `1` немає прослуховування, `2` помилка твердження, `3` використання/залежності.

<a id="capacitor-device-smoke-mode-b"></a>

## Перевірка пристрою Capacitor (режим B)

**Контрольний список** симулятора/емулятора (за потреби фізичного пристрою) для Cap режиму B — не HTTP companion режиму A. Людина позначає проходження UI; помічник автоматизує інструментарій, нативні каталоги й м'яку curl-перевірку черги команд.

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

Подробиці: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md). Доповнює `smoke-command-queue.sh` (Cap loopback) — не плутайте з перевірками режиму A вище.

<a id="tauri-desktop-smoke-mode-b"></a>

## Перевірка Tauri desktop (режим B)

Контрольний список комп'ютера й помічник для Tauri режиму B (вікно/відтворення каналу/PiP). Це не HTTP companion режиму A й не тест пристрою Cap.

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

Подробиці: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md). Дані розробника Apple необов'язкові для локальної перевірки; використовуйте [підпис ad-hoc](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials) для упакованого застосунку Mac. Людина все одно перевіряє запуск, відтворення та PiP.

<a id="docker"></a>

## Docker

Багатоархітектурні образи (amd64/arm64) збираються як кандидатні OCI-архіви. Публікація в реєстр просуває схвалений стабільний архів до Docker Hub без повторного збирання; див. [операційний посібник](docs/release-workflow.md).

Двійковий сервер збирається на **musl** (Alpine) і постачається на Alpine — **не** потребує GLIBC_2.38+. Завдяки цьому `alvit/ottplay-foss` працює на Synology DSM Docker (x86_64) та інших хостах зі старішим glibc.

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

Стабільні теги реєстру використовують `X.Y.Z`. Оновлення `latest` — окрема явна опція після публікації версійованого образу; push у main і Git-теги не публікують образів.

<a id="build-from-source"></a>

## Збирання з вихідного коду

Доменні правила програвача походять із зафіксованого артефакту Kotlin multiplatform у `vendor/ottplay-core.js`. Рішення щодо програми, архіву, списку, провайдера, стійкого стану й відтворення мають спільну реалізацію з FOSS2 і нативним Android. Адаптери браузера/TV, Swift та Rust зберігають API пристроїв, кодеки, мережу й ефекти UI. Артефакт браузера зберігає синтаксис ES5 та підтримувану ініціалізацію застарілих API. `npm test`, `check:bundle` і `check:es5` перевіряють інтеграцію; маніфест артефакту записує хеші джерела та результату.

Валідатори протоколів control-server і SWOP генеруються з версійованої схеми `contracts/ottplay-wire-v1.json`. Перевірені квитанції генератора й незмінні тести сумісності запобігають окремим копіям політик для споживачів.

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

## Визначення пристрою

Програвач підтримує 24 типи пристроїв. Визначення: спершу URL `/f/{device_id}/`, потім User-Agent.

| ID пристрою | Пристрій |
|---|---|
| `pc` | Браузер ПК |
| `pc2` | Вебпрогравач videojs |
| `nodejs` | Застосунок Windows (Electron) |
| `lg/webos` | Телевізори LG WebOS |
| `samsung/tizen` | Телевізори Samsung Tizen |
| `samsung/maple` | Телевізори Samsung Orsay |
| `mag` | Приставки Infomir MAG |
| `dune` | Приставки Dune HD |
| `android` | Android TV / планшети |
| `hbbtv` | Телевізори HbbTV |
| `panasonic` | Телевізори Panasonic Viera |
| `philips` | Телевізори Philips |
| `sony` | Телевізори Sony |
| `sharp` | Телевізори Sharp |
| `toshiba` | Телевізори Toshiba |
| `hisense` | Телевізори Hisense |
| `skyworth` | Телевізори Skyworth |
| `tcl` | Телевізори TCL |
| `vewd` | Пристрої Vewd |
| `spark` | Приймачі Spark |

<a id="push-command-system"></a>

## Система push-команд

Для окремої багатопристроєвої служби використовуйте [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) та розділ **Сервер команд** у **Налаштування → Дистанційне керування**. Введіть IP/адресу й код доступу цього програвача; збереження обох автоматично запускає опитування команд гучності, каналів та інших. IP без порту використовує HTTP 8081. Очистьте адресу або виберіть **Від'єднати**, щоб зупинити. Це вихідне з'єднання підтримує підтверджене доставлення й не потребує локального прослуховування. Див. [під'єднання та сумісність](docs/remote-command-server.md). Приклади нижче описують наявний режим локального проксі/слухача.

**Знайти сервер команд** дає змогу виявити контролер і запросити схвалення оператора без копіювання токена пристрою. Tauri спочатку перевіряє нативний DNS і за порожнього результату може перейти до явно налаштованого профілю розгортання; браузерні програвачі, LG і Capacitor використовують браузерний шлях із профілем. Метадані виявлення Home можна розмістити на here.now незалежно від контролера. Універсальні збірки не включають цей профіль Home автоматично, а оновлення не замінює збережені підключення. Див. [поведінку платформ, налаштування профілю й усунення неполадок](docs/remote-command-server.md#discovery-and-one-time-approval).

Локальне дистанційне керування HTTP **типово вимкнене** у браузерному/OTT server програвачі, Tauri та Capacitor. Увімкніть у **Налаштування програвача → Дистанційне керування**, щоб створити таємний код пристрою. Команди — JSON-об'єкти з полем `"command"`; HTTP-запити потребують `Authorization: Bearer <device-code>`.

<a id="architecture"></a>

### Архітектура

<a id="local-command-url-recommended"></a>

#### Локальний URL команд (рекомендовано)

Увімкніть **Локальне HTTP-керування** в **Налаштування програвача → Дистанційне керування**, скопіюйте створений **Код пристрою** та налаштуйте ним проксі нижче. Задайте **Локальний URL команд** як endpoint команд проксі. Поки ввімкнено, програвач опитує цей URL кожні 10 секунд із кодом у заголовку Authorization. Саме задання URL не вмикає керування командами.

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### UUID пристрою

Наявний UUID пристрою (наприклад, `dev_a1b2c3d4e5`) — публічні метадані маршрутизації, не авторизаційні дані. Окремий **Код пристрою** безпечно створюється при ввімкненні локального HTTP і залишається на цьому пристрої; не копіюється через хмарні налаштування. Вимкнення HTTP зупиняє опитування/слухачі. Повторне ввімкнення створює новий код: оновіть проксі та інтеграції, щоб відкликати старий доступ.

Tauri й Capacitor запускають HTTP-слухач loopback лише після цього дозволу в налаштуваннях. Пересильні проксі мають надсилати показаний код як Bearer-токен до слухача. Режим A використовує окремо налаштовану чергу `local_proxy.py`, описану нижче.

<a id="remote-text-entry-swop"></a>

#### Віддалене введення тексту (swop)

Призначення: вводити на телефоні для ♥™ / віддаленої віртуальної клавіатури, коли TV і телефон у **різних мережах**, через передавання сеансу Cloudflare Worker.

- Репозиторій Worker: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop)
- **Авторизація встановлення:** програвач надсилає запити до ретранслятора `/swop` того самого origin свого сервера. Сервер додає приватний токен встановлення; кожен клієнт зареєстрованого origin може використовувати віддалене введення. UUID пристроїв ідентифікують сеанси й не потребують списків дозволів на кожен пристрій.
- Налаштування: `swopBaseUrl` (порожньо = ♥™ показує «не налаштовано» / нічого не робить). Редагуйте в **Налаштування → Дистанційне керування** (клавіша **2**) або задайте через ігнорований Git `/local/swop.json` в операторських встановленнях
- `POST /session` містить `clientId`, `caption` і `draft`; `POST /val` містить `clientId`, `code` та повернутий `sessionToken`. URL телефона містить окремий токен запису. Токени читання сеансу залишаються в пам'яті браузера.
- **Локальне встановлення:** задайте `SWOP_BASE_URL` і `SWOP_INSTALLATION_TOKEN` після реєстрації встановлення та його точних LAN/localhost origin у Worker. `scripts/install-ottplay-local-service.sh` зберігає їх у приватному launchd plist з режимом 0600. Публічний `/local/swop.json` містить лише `{"swopBaseUrl":"/swop"}`. Ніколи не розміщуйте токен встановлення в публічних ресурсах.
- **Статичний хостинг:** налаштуйте серверний автентифікований проксі для тих самих двох endpoint. Зберігайте токен встановлення в секретах хостингу. Копіювання публічних файлів програвача не копіює ці серверні дані доступу.

> Центральний OTT-сервер зберігає `/api/webhook/commands`, `/webhook/poll`, `/webhook/notify` та псевдоніми здоров'я команд вимкненими для всіх HTTP-методів. Для режиму A використовуйте окремий сервер команд або явно налаштований автентифікований `local_proxy.py`; центральний сервер не має широкомовної черги команд.

<a id="available-commands"></a>

### Доступні команди

Усі приклади нижче використовують `http://192.168.1.50:8081/api/webhook/commands` як URL локального проксі. Замініть реальною адресою й задайте `OTTPLAY_QUEUE_HTTP_TOKEN` як **Код пристрою**, показаний після ввімкнення HTTP-керування в налаштуваннях. Проксі має використовувати той самий код.

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — Показати сповіщення

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| Поле | Тип | Типове значення | Опис |
|---|---|---|---|
| `message` | string | обов'язкове | Текст для показу |
| `popup_duration` | number | 5 | Секунди показу (праворуч угорі) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — Перемкнути канал за позицією у списку

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| Поле | Тип | Типове значення | Опис |
|---|---|---|---|
| `channel_number` | number | обов'язкове | Позиція каналу у списку, починаючи з 1 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — Перемкнути канал за (частиною) назви

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

Пошук підрядка без урахування регістру. Вибирається перший збіг.

| Поле | Тип | Типове значення | Опис |
|---|---|---|---|
| `channel_name` | string | обов'язкове | Повна або часткова назва каналу |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — Перемкнути на випадковий канал

Ця попередня команда вибирає допустимі канали з поточного списку або категорії. Номери каналів і діапазони позначають позиції в цьому списку; див. [правила безпечного випадкового вибору](docs/remote-command-server.md#safe-random-playback).

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

| Поле | Тип | Типове значення | Опис |
|---|---|---|---|
| `random_range` | [start, end] | поточний список | Діапазон, починаючи з 1 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — Змінити IPTV-провайдера

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| Поле | Тип | Типове значення | Опис |
|---|---|---|---|
| `provider` | number | обов'язкове | Індекс у масиві провайдерів (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — Завантажити новий M3U-список

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| Поле | Тип | Типове значення | Опис |
|---|---|---|---|
| `playlist` | string | обов'язкове | URL M3U-списку |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — Оновити конфігурацію провайдера

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| Поле | Тип | Типове значення | Опис |
|---|---|---|---|
| `provider_settings` | string | обов'язкове | JSON-рядок із конфігурацією провайдера |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — Задати або змінити гучність

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

Клієнти без підтримки гучності мовчки ігнорують команду.

| Поле | Тип | Типове значення | Опис |
|---|---|---|---|
| `volume` | number | — | Абсолютний рівень 0-100 |
| `volume_step` | number | — | Відносна зміна, наприклад +10 або -5 |

<a id="player-standby-restart-and-exit"></a>

#### Очікування, перезапуск і вихід програвача

Webhook-черга локального проксі без підтверджень не підтримує `exit_player` або типізовані запити очікування/пробудження. Під'єднайте програвач до [сервера команд](docs/remote-command-server.md) і використовуйте його CLI:

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

Замініть `d1` псевдонімом зареєстрованого програвача. `stop` — псевдонім `standby`; `start` і `wake` — псевдоніми `go`. Go потребує запущеного під'єднаного програвача; не може запустити закритий застосунок або розбудити офлайновий пристрій. Браузер або TV без нативного виходу повідомляє, що вихід не підтримується. Очікування зберігає віддалене опитування й не призупиняє сторонню роботу хоста або спільного сервера.

Після standby/go перевірте `ott d1 status` щодо стану очікування/фону та окремо підтвердьте відновлене відтворення. Після перезавантаження програвача підтвердьте нове середовище командою `ott d1 doctor`. Після виходу переконайтеся через ОС, що процес закрився; віддалений тайм-аут не доводить виходу. Саме прийняття команди не підтверджує цих результатів.

<a id="local-proxy-server"></a>

## Локальний проксі-сервер

`local_proxy.py` — самостійна автентифікована черга команд для одного програвача. Типовий виклик завершується без відкриття порту. Кожен екземпляр використовує створений програвачем код пристрою; для кількох програвачів потрібні окремі екземпляри/порти. Параметр запиту `device_id` приймається як метадані сумісності й ніколи не автентифікує та не вибирає інший пристрій.

<a id="start-the-proxy"></a>

### Запуск проксі

1. Увімкніть **Локальне HTTP-керування** в програвачі та скопіюйте **Код пристрою**.
2. На хості проксі задайте код і точний origin, з якого надається програвач (схема, хост і порт, без шляху):

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. Задайте **Локальний URL команд** програвача як `http://192.168.1.50:8081/api/webhook/commands`.

Типова адреса прослуховування — `127.0.0.1`; приклад явно вмикає доступ LAN. `OTTPLAY_QUEUE_HTTP_ORIGINS` — розділений комами список точних дозволених origin браузера. Використовуйте зворотний проксі HTTPS, якщо програвач надається через HTTPS, щоб правила змішаного вмісту дозволяли опитування. Зберігайте код у таємниці й не додавайте до URL. Коли програвач створює новий код, перезапустіть проксі з новим значенням; саме вимкнення програвача не зупиняє незалежно керований процес проксі.

<a id="endpoints"></a>

### Endpoint

| Метод | Шлях | Опис |
|---|---|---|
| `POST` | `/api/webhook/commands` | Додати команду в чергу |
| `GET` | `/api/webhook/commands` | Забрати команди з черги (опитування програвача) |
| `POST` | `/webhook/notify` | Автентифікований псевдонім сумісності |
| `GET` | `/webhook/poll` | Автентифікований псевдонім сумісності |

Надсилання й забирання потребують відповідного Bearer-коду пристрою. Неавтентифікованого широкомовного endpoint немає. Команди спливають за 60 секунд; кожен проксі зберігає не більш як 50 команд.

Проксі одночасно обробляє до 16 з'єднань, тому бездіяльне з'єднання браузера або неповний запит не затримує інші команди. Кожен сокет має п'ятисекундний тайм-аут бездіяльності; додаткові з'єднання закриваються, коли всі робітники зайняті. Додавання й забирання черги атомарні між робітниками.

<a id="smoke-script-all-modes"></a>

### Скрипт базової перевірки (усі режими)

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Емулятор/пристрій Android: спершу `adb forward tcp:18081 tcp:18081`. Cap/Tauri доступні лише через loopback — для Home Assistant у LAN використовуйте цей проксі режиму A. Подробиці: `docs/capacitor-mobile.md` § Smoke test.

<a id="cors"></a>

### CORS

Проксі дозволяє браузерні запити лише з `OTTPLAY_QUEUE_HTTP_ORIGINS`. Попередні запити `OPTIONS` із дозволеного origin не потребують токена; кожен фактичний GET/POST потребує Bearer-коду. Origin із шаблоном і `null` не приймаються. Home Assistant та інші небраузерні клієнти можуть не надсилати Origin, але все одно потребують автентифікації.

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### Приклад: webhook Home Assistant → локальний проксі → програвач

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

### Приклади автоматизації Home Assistant

Приклади повідомлення, каналу та гучності використовують локальний проксі. Задайте `ottplay_device_authorization` у `secrets.yaml` Home Assistant як `Bearer <device-code>` із кодом увімкненого програвача.

Нічне очікування використовує окремий [сервер команд](docs/remote-command-server.md). Замініть приклад URL і `DEVICE_UUID` нижче адресою контролера та зареєстрованим ID пристрою; локальний псевдонім CLI `d1` не є ID пристрою. Задайте `ottplay_control_authorization` як `Bearer <controller-admin-token>` у `secrets.yaml`. Це окремі дані доступу, не код локального проксі. Див. документацію Home Assistant: [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) та [секрети](https://www.home-assistant.io/docs/configuration/secrets/).

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

`standby_request` містить HTTP-відповідь для трасування автоматизації. HTTP 202 означає лише додавання в чергу: збережіть `content.id`, потім опитуйте `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` із тими самими даними контролера для відповіді програвача. Новий запит `status` спостерігає `player.standby` і `player.background`; увімкнене очікування з `suspended` і нулем очікуваних підтверджує завершення відстежуваної роботи програвача. Для виходу з очікування використайте той самий типізований запит із `"operation":"wake"` (`ott d1 go`). Не повторюйте зміну наосліп після тайм-ауту. Див. [API запиту/відповіді](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) та [семантику очікування](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake) контролера.

<a id="server-api-reference"></a>

## Довідник API сервера

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Webhook endpoint (Rust `ottplay-server`)

Сервер Rust і архівний резервний Python відхиляють endpoint команд із HTTP 403. `/api/webhook/commands`, `/webhook/notify`, `/webhook/poll` і псевдоніми здоров'я команд не додають, не розсилають і не забирають команд. Загальний API відгуків не може перевизначати ці зарезервовані маршрути. Доставлення команд режиму A використовує окремо налаштований сервер команд або автентифікований локальний проксі, описані вище.

<a id="other-endpoints"></a>

### Інші endpoint

| Метод | Шлях | Опис |
|---|---|---|
| `GET` | `/epg/<hash>.json` | Дані EPG каналу |
| `GET` | `/logo/<id>.svg` | Створений логотип каналу |
| `GET` | `/version/<path>` | Хеш версії файлу |
| `POST` | `/m3u/match-channels` | Зіставлення каналів з EPG |
| `POST` | `/m3u/match-logos` | Зіставлення логотипів каналів |
| `POST` | `/m3u/cp.php` | Проксі потоку |
| `GET/POST` | `/feedback/` | Журналювання відгуків |
| `GET` | `/tmdb/*` | Проксі API TMDb |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## Структура проєкту

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

## Призначення клавіш STB

- **Samsung Tizen**: `RETURN=10009`, `ENTER=13`, кольори 403-406
- **Samsung Maple**: dpad 4/5/6/8, початкові коди SDK
- **LG WebOS**: `RETURN=461`, кольори сумісні з HbbTV
- **LG NetCast**: `RETURN=8`, коди HbbTV
- **MAG**: `RETURN=8`, API gSTB для MAC
- **Dune HD**: стандартні коди, API Dune
- **Android TV**: коди Android (`BACK=4`, `DPAD_*` 19-22, `ENTER=66`)
- **HbbTV/Panasonic/Philips/Sony/тощо**: коди HbbTV (`RED=403`, `BLUE=406`, `VOL_UP=447`)

<a id="documentation"></a>

## Документація

- [Вікі документації](./docs/wiki/Home.uk.md) / [Вікі російською](./docs/wiki/Home.ru.md) — навігація за завданнями та правила супроводу.
- [Звіт реалізації](./docs/implementation-report.uk.md) / [Процес і результат російською](./docs/implementation-report.ru.md) — кольорові схеми, перевірена поведінка, виміряна вартість і бар'єри випуску.
- [Посібник постачання](./docs/roadmap-delivery.uk.md) / [Нові можливості російською](./docs/roadmap-delivery.ru.md) — можливості, обмеження та перевірка.
- [Швидкий початок 88 мовами інтерфейсу](./docs/readme/README.md) — створений із перекладів UI, що постачаються; головний посібник і парні інструкції функцій доступні [24 мовами документації](docs/manual-translations.md).
- [Обмеження якості та відновлення прямого ефіру](./docs/playback-stream-policy.uk.md) / [Російською](./docs/playback-stream-policy.ru.md).
- [Ручне зіставлення XMLTV та класична доступність](./docs/guide-binding-accessibility.uk.md) / [Російською](./docs/guide-binding-accessibility.ru.md).
- [Розміщена перевірка аудіо/відео](./docs/audio-video-check.uk.md) / [Російською](./docs/audio-video-check.ru.md).
- [Медіатека Xtream](./docs/xtream-media.uk.md) / [Російською](./docs/xtream-media.ru.md).
- [Передавання між пристроями одного джерела](./docs/remote-handoff.uk.md) / [Російською](./docs/remote-handoff.ru.md).
- [Відновлювані локальні налаштування](./docs/settings-recovery.uk.md) / [Російською](./docs/settings-recovery.ru.md).
- [Покоління браузерів, операційні системи й точні перевірки кандидатів у випуск](docs/browser-compatibility.uk.md) / [Російською](docs/browser-compatibility.ru.md).

- [Архітектура програвача](./docs/architecture.md) — відповідальність під час виконання, інтеграція провайдерів, відтворення, програма, адаптери пристроїв і контракти збирання.
- [Класичний конвеєр ES5](./docs/build-pipeline.md) — компіляція, перевірки сумісності й ліміти розміру артефактів.
- [Назви ресурсів виконання та міграція розгортань](./docs/asset-layout.md) — описові шляхи, спільні для веб- і нативних пакетів.
- [Віддалене робоче середовище](./docs/remote-workbench.md) — огляд UI/медіа, квитанції операцій і збережені докази.
- [Діагностика виконання](./docs/runtime-debug.md) — історія помилок, лічильники кадрів/циклів, нативні метрики Capacitor/Tauri та налагодження сервера.
- [Локальне постачання macOS](./docs/macos-local-delivery.md) — збірки checkout, локальне встановлення та перевірка.

<a id="license"></a>

## Ліцензія

[MIT](LICENSE) — вільний і відкритий код. Вміст провайдерів та сторонні залежності зберігають власні права й ліцензії.

Окремий застосунок [OTTPlay native webOS](docs/native-webos.md), заснований на PlxNative, поширюється під **GPL-3.0-or-later** разом із відповідним вихідним кодом.
Ліцензія MIT у корені проєкту не змінює ліцензію цього нативного застосунку та його патчів.

<a id="desktop-updater--notarization-mode-b"></a>

## Настільний оновлювач / нотаризація (режим B)

[Посібник підписування й оновлювача desktop](docs/tauri-updater-notarize.md) описує ad-hoc підпис macOS, необов'язковий Developer ID/нотаризацію та перевірку пакета. CI випуску використовує ad-hoc підпис без даних Apple. Підпис оновлювача окремий; виробничі автоматичні оновлення залишаються неналаштованими.

<a id="local-mac-build-helpers"></a>

## Помічники локального збирання Mac

Див. [docs/local-build-scripts.md](docs/local-build-scripts.md).

<a id="privacy"></a>

## Приватність

Прочитайте [політику приватності](docs/privacy-policy.md) щодо локальних налаштувань, налаштованих служб і ваших варіантів вибору. Контакт приватності та підтримки: [alvit.work@gmail.com](mailto:alvit.work@gmail.com).

Studio 2026 — типова тема інтерфейсу. Classic і PLi-HD залишаються доступними, збережені вподобання не змінюються. Див. [налаштування інтерфейсу](docs/interface-settings.md). Тема PLi-HD визнає внесок Vali, littlesat, VU+NL, Milo та учасників початкового проєкту. Див. [авторство інтерфейсу й історію дизайну](docs/interface-history.md) для англомовної історії та джерел; матеріал також доступний у меню інформації програвача.

<a id="demo-video-editing"></a>

## Монтаж демонстраційного відео

Використовуйте локальний [процес video-use](docs/demo-video.md), щоб готувати й редагувати демонстраційні записи. Помічник зберігає всі створені медіа поза Git.

<a id="plex-media-library"></a>

## Медіатека Plex

Кожен програвач може під'єднатися до облікового запису Plex або Plex Media Server через провайдера **Plex**. Інтеграція використовує Plex; Synology — один із можливих хостів медіасервера. Усі доступні відео й музичні треки автоматично потрапляють до звичайного списку каналів; вибір категорії фільтрує його за бібліотекою, папкою або серіалом. Відтворення починається з першої придатної порції, з фоновим завантаженням, звичайним пошуком і Діями для перемішування/повтору, без налаштування Plex на OTT-сервері. Див. [вхід Plex і пряме відтворення](docs/plex-provider.md).

![Життєвий цикл завантаження Plex, навігації файлами й завершення](docs/images/plex-playback-lifecycle.svg)

[Ілюстрований огляд надійності](docs/plex-provider.md#reliability-review-process-and-results) пояснює правила завантаження й скасування, виправлення повних каталогів і перемикання файлів та виміряні результати перевірки Chromium/WebKit.

Необов'язкова інтеграція OTT-сервера також надає каталог наявного Plex-сервера й сумісне відтворення через окремий запис бібліотеки NAS та експорт M3U. Див. [налаштування бібліотеки сервера й доступ клієнта](docs/synology-library.md).

<a id="related-repositories"></a>

## Пов'язані репозиторії

- [ottplay-core](https://github.com/open-ott-play/ottplay-core) містить спільну доменну логіку JVM/ES5, комунікаційні контракти та клієнт FOSS2. Цей програвач споживає створені артефакти; для спільних змін дотримуйтеся посібника постачання ядра.
- [ottplay-android](https://github.com/open-ott-play/ottplay-android) — окремий нативний застосунок Kotlin/Compose із власною ідентичністю встановлення й випуску.
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server) надає самостійно розміщені віддалені команди; [ottplay-swop](https://github.com/open-ott-play/ottplay-swop) — необов'язковий транспорт введення тексту через Worker.
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine) підтримує розміщений профіль браузерної демонстрації, демонстраційні медіа та перевірку публікації.

<a id="project-maintenance"></a>

## Супровід проєкту

Див. [вимоги до внесків і тестування](CONTRIBUTING.md), [політику повідомлення про вразливості](SECURITY.md), [проєктування безпеки](docs/security-design.md) та [докази OpenSSF і решту критеріїв](docs/openssf-evidence.md).
