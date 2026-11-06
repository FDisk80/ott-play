<a id="ott-play-documentation-wiki"></a>

# Wiki документації OTT-play

<!-- language-navigation:start -->
<p dir="ltr">
<a href="Home.md" lang="en" dir="ltr">English</a> · <a href="Home.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="Home.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="Home.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="Home.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="Home.es.md" lang="es" dir="ltr">Español</a> · <a href="Home.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="Home.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="Home.he.md" lang="he" dir="rtl">עברית</a> · <a href="Home.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="Home.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="Home.it.md" lang="it" dir="ltr">Italiano</a> · <a href="Home.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="Home.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="Home.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="Home.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="Home.pt.md" lang="pt" dir="ltr">Português</a> · <a href="Home.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="Home.th.md" lang="th" dir="ltr">ไทย</a> · <a href="Home.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="Home.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="Home.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="Home.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="Home.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[README](../../README.uk.md) · [Усі мови інтерфейсу](../readme/README.md)

Це головна сторінка версійованої документації в репозиторії коду. GitHub безпосередньо відображає ці Markdown-сторінки; зберігання тут дозволяє перевіряти інструкції, схеми й тести разом із кодом. Окрема [GitHub Wiki](https://github.com/open-ott-play/ottplay-foss/wiki) експортується з цих джерел і вказує вихідну ревізію на кожній сторінці. Див. [інструкцію публікації](../wiki-publishing.md).

<a id="start-and-install"></a>

## Запуск та встановлення

- [Практичний посібник](../../README.uk.md), доступний [24 мовами документації](../manual-translations.md).
- [Локалізовані короткі інструкції для всіх 88 мов інтерфейсу](../readme/README.md). Вони повторно використовують перекладені підписи та кроки навігації. Це не 88 перекладених технічних посібників. Основний посібник і парні інструкції щодо можливостей повністю доступні 24 мовами.
- [Пакети й оновлення Android Full/API 22](../android-distributions.md), [збірка Android](../../android/README.md) та [Capacitor iOS/Android](../capacitor-mobile.md).
- [Настільна поставка для macOS](../macos-local-delivery.md), [підпис та оновлювач Tauri](../tauri-updater-notarize.md) і [локальні HTTP-екземпляри](../local-http-deployment.md).

<a id="process-and-results"></a>

## Процес і результати

- [Кваліфікація браузерів і перевірка кандидата](../browser-compatibility.uk.md) ([Русский](../browser-compatibility.ru.md)): налаштовані цілі, кольорові схеми, перевірки точних пакетів і окремі локальні результати.

- [Звіт про реалізацію та кольорові схеми](../implementation-report.uk.md) ([Русский](../implementation-report.ru.md)): перевірені зміни, виправлені регресії, виміряні результати й решта умов випуску.

<a id="use-the-new-capabilities"></a>

## Нові можливості

- [Поставка можливостей і межі платформ](../roadmap-delivery.uk.md) ([Русский](../roadmap-delivery.ru.md)).
- [Межі якості, явні резервні джерела ефіру й обмежене відновлення](../playback-stream-policy.uk.md) ([Русский](../playback-stream-policy.ru.md)).
- [Ручне прив’язування XMLTV і класична доступність](../guide-binding-accessibility.uk.md) ([Русский](../guide-binding-accessibility.ru.md)).
- [Розміщена в мережі перевірка зображення та звуку](../audio-video-check.uk.md) ([Русский](../audio-video-check.ru.md)): **Інформація → Аудіо → Відтворити**, очікувані сигнали, схема розміщення й повернення до прямого ефіру. Ролик завантажується на вимогу, потребує інтернету й відсутній у пакетах програвача. Окрема мережева демонстрація рухомого шаблону працює без звуку.
- [Бібліотека фільмів і серіалів Xtream](../xtream-media.uk.md) ([Русский](../xtream-media.ru.md)).
- [Передавання стану програвача в межах одного джерела](../remote-handoff.uk.md) ([Русский](../remote-handoff.ru.md)).
- [Локальний журнал налаштувань і відновлення](../settings-recovery.uk.md) ([Русский](../settings-recovery.ru.md)).
- [Надійне керування, відновлювані профілі та передавання](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.md) ([Русский](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.ru.md)). Потрібні відповідна ревізія контролера/CLI і налаштовані дозволи.
- [Семантичні переваги аудіо й субтитрів у нативному Android](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.md) ([Русский](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.ru.md)). Нативний Kotlin-застосунок відокремлений від Capacitor APK цього репозиторію.

<a id="configure-sources-and-inspect-problems"></a>

## Налаштування джерел і дослідження проблем

- [Вхід у Plex і відтворення](../plex-provider.md), [архітектура телегіда](../guide-architecture.md) та [діагностика розміщеного EPG](../hosted-epg-diagnostics.md).
- [Налаштування інтерфейсу](../interface-settings.md), [історія дизайну й подяки](../interface-history.md) та [мовні каталоги й клавіатури](../localization.md).
- [Віддалене робоче середовище](../remote-workbench.md), [діагностика виконання](../runtime-debug.md) та [згода на діагностику, вилучення чутливих даних і зберігання](../diagnostic-security.md).
- [Перевірки нативних пристроїв](../mode-b-device-smoke.md), [перевірки пристроїв Tauri](../mode-b-tauri-smoke.md) і [керування вікном браузера](../browser-window-controls.md).

- [Виміряна вартість можливостей](../roadmap-size.uk.md), початкові дані й графік SVG.

<a id="develop-and-release"></a>

## Розробка та випуск

- [Архітектура й володіння](../architecture.md), [сеанси відтворення](../playback-session-architecture.md) та [класична збірка ES5](../build-pipeline.md).
- [Назви runtime-ресурсів](../asset-layout.md), [політика релізів](../../RELEASING.md), [інструкція оператора релізу](../release-workflow.md) і [фазинг RC](../../FUZZING.md).
- [Політика конфіденційності](../privacy-policy.md) та [ліцензія MIT](../../LICENSE).

Змінюючи документацію, запускайте `npm run docs:generate`, коли змінюється підпис інтерфейсу або шаблон короткої інструкції, потім `npm run check:docs`. Підтримуйте повноту всіх перекладів, зазначайте обмеження біля тверджень про можливості й відрізняйте локальну перевірку від випробувань фізичних пристроїв. Схеми — перевірювані файли репозиторію; див. [SVG прив’язування телегіда](../images/guide-binding.svg) та схеми за посиланнями з посібників. Перевірка валідує відносні шляхи файлів, а не доступність зовнішніх сайтів чи кожен якір заголовка Markdown.
