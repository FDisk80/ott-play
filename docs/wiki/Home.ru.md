<a id="ott-play-documentation-wiki"></a>

# Wiki документации OTT-play

<!-- language-navigation:start -->
<p dir="ltr">
<a href="Home.md" lang="en" dir="ltr">English</a> · <a href="Home.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="Home.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="Home.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="Home.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="Home.es.md" lang="es" dir="ltr">Español</a> · <a href="Home.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="Home.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="Home.he.md" lang="he" dir="rtl">עברית</a> · <a href="Home.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="Home.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="Home.it.md" lang="it" dir="ltr">Italiano</a> · <a href="Home.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="Home.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="Home.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="Home.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="Home.pt.md" lang="pt" dir="ltr">Português</a> · <a href="Home.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="Home.th.md" lang="th" dir="ltr">ไทย</a> · <a href="Home.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="Home.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="Home.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="Home.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="Home.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[README](../../README.ru.md) · [Все языки интерфейса](../readme/README.md)

Это главная страница версионируемой документации в репозитории исходников. GitHub отображает эти Markdown-страницы напрямую; их хранение здесь позволяет проверять инструкции, схемы и тесты вместе с кодом. Отдельная [GitHub Wiki](https://github.com/open-ott-play/ottplay-foss/wiki) экспортируется из этих исходников и указывает исходную ревизию на каждой странице. См. [инструкцию публикации](../wiki-publishing.md).

<a id="start-and-install"></a>

## Запуск и установка

- [Практическое руководство](../../README.ru.md), доступное на [24 языках документации](../manual-translations.md).
- [Локализованные краткие инструкции для всех 88 языков интерфейса](../readme/README.md). Они используют переведённые подписи интерфейса и шаги навигации. Это не 88 переведённых инженерных руководств. Основное руководство и парные руководства по возможностям полностью доступны на 24 языках.
- [Пакеты и обновления Android Full/API 22](../android-distributions.md), [сборка Android](../../android/README.md) и [Capacitor iOS/Android](../capacitor-mobile.md).
- [Настольная поставка для macOS](../macos-local-delivery.md), [подпись и обновление Tauri](../tauri-updater-notarize.md) и [локальные HTTP-экземпляры](../local-http-deployment.md).

<a id="process-and-results"></a>

## Процесс и результаты

- [Квалификация браузеров и проверка кандидата](../browser-compatibility.ru.md) ([Русский](../browser-compatibility.ru.md)): настроенные цели, цветные схемы, проверки точных пакетов и отдельные локальные результаты.

- [Отчёт о реализации и цветные схемы](../implementation-report.ru.md) ([Русский](../implementation-report.ru.md)): проверенные изменения, исправленные регрессии, измеренные результаты и оставшиеся условия выпуска.

<a id="use-the-new-capabilities"></a>

## Новые возможности

- [Поставка возможностей и границы платформ](../roadmap-delivery.ru.md) ([Русский](../roadmap-delivery.ru.md)).
- [Пределы качества, явные резервные источники эфира и ограниченное восстановление](../playback-stream-policy.ru.md) ([Русский](../playback-stream-policy.ru.md)).
- [Ручная привязка XMLTV и доступность классических элементов](../guide-binding-accessibility.ru.md) ([Русский](../guide-binding-accessibility.ru.md)).
- [Размещённая в сети проверка изображения и звука](../audio-video-check.ru.md) ([Русский](../audio-video-check.ru.md)): **Информация → Аудио → Воспроизвести**, ожидаемые сигналы, схема размещения и возврат к прямому эфиру. Ролик загружается по требованию, нуждается в интернете и отсутствует в пакетах плеера. Отдельная сетевая демонстрация движущегося шаблона работает без звука.
- [Библиотека фильмов и сериалов Xtream](../xtream-media.ru.md) ([Русский](../xtream-media.ru.md)).
- [Передача состояния плеера в пределах одного источника](../remote-handoff.ru.md) ([Русский](../remote-handoff.ru.md)).
- [Локальный журнал настроек и восстановление](../settings-recovery.ru.md) ([Русский](../settings-recovery.ru.md)).
- [Надёжное управление, возобновляемые профили и передача](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.md) ([Русский](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.ru.md)). Нужны соответствующая ревизия контроллера/CLI и настроенные права.
- [Семантические предпочтения аудио и субтитров в нативном Android](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.md) ([Русский](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.ru.md)). Нативное Kotlin-приложение отделено от Capacitor APK этого репозитория.

<a id="configure-sources-and-inspect-problems"></a>

## Настройка источников и разбор проблем

- [Вход в Plex и воспроизведение](../plex-provider.md), [архитектура телегида](../guide-architecture.md) и [диагностика размещённого EPG](../hosted-epg-diagnostics.md).
- [Настройки интерфейса](../interface-settings.md), [история дизайна и благодарности](../interface-history.md) и [языковые каталоги и клавиатуры](../localization.md).
- [Удалённое рабочее окружение](../remote-workbench.md), [диагностика выполнения](../runtime-debug.md) и [согласие на диагностику, удаление чувствительных данных и хранение](../diagnostic-security.md).
- [Проверки нативных устройств](../mode-b-device-smoke.md), [проверки устройств Tauri](../mode-b-tauri-smoke.md) и [управление окном браузера](../browser-window-controls.md).

- [Измеренная стоимость возможностей](../roadmap-size.ru.md), исходные данные и график SVG.

<a id="develop-and-release"></a>

## Разработка и выпуск

- [Архитектура и владение](../architecture.md), [сеансы воспроизведения](../playback-session-architecture.md) и [классическая сборка ES5](../build-pipeline.md).
- [Имена runtime-ресурсов](../asset-layout.md), [политика релизов](../../RELEASING.md), [инструкция оператора релиза](../release-workflow.md) и [фаззинг RC](../../FUZZING.md).
- [Политика конфиденциальности](../privacy-policy.md) и [лицензия MIT](../../LICENSE).

При изменении документации запускайте `npm run docs:generate`, если меняется подпись интерфейса или шаблон краткой инструкции, затем `npm run check:docs`. Поддерживайте полноту всех переводов, указывайте ограничения рядом с заявлениями о возможностях и отличайте локальную проверку от испытаний на физических устройствах. Схемы — проверяемые файлы репозитория; см. [SVG привязки телегида](../images/guide-binding.svg) и схемы по ссылкам из руководств. Проверка валидирует относительные пути к файлам, а не доступность внешних сайтов или каждый якорь заголовка Markdown.
