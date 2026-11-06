<a id="ott-play-documentation-wiki"></a>

# OTT-play 文件 Wiki

<!-- language-navigation:start -->
<p dir="ltr">
<a href="Home.md" lang="en" dir="ltr">English</a> · <a href="Home.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="Home.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="Home.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="Home.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="Home.es.md" lang="es" dir="ltr">Español</a> · <a href="Home.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="Home.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="Home.he.md" lang="he" dir="rtl">עברית</a> · <a href="Home.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="Home.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="Home.it.md" lang="it" dir="ltr">Italiano</a> · <a href="Home.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="Home.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="Home.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="Home.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="Home.pt.md" lang="pt" dir="ltr">Português</a> · <a href="Home.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="Home.th.md" lang="th" dir="ltr">ไทย</a> · <a href="Home.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="Home.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="Home.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="Home.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="Home.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[README](../../README.zh-Hant.md) · [全部介面語言](../readme/README.md)

這是原始碼儲存庫中受版本管理的文件首頁。GitHub 可直接呈現這些 Markdown 頁面；在此維護可讓說明、圖表與測試和程式碼一起接受審查。獨立的 [GitHub Wiki](https://github.com/open-ott-play/ottplay-foss/wiki) 從這些來源匯出，並在每頁標明來源修訂版。參見[發佈說明](../wiki-publishing.md)。

<a id="start-and-install"></a>

## 開始與安裝

- [實用指南](../../README.zh-Hant.md)，提供 [24 種文件語言](../manual-translations.md)。
- [涵蓋全部 88 種介面語言的本地化快速入門](../readme/README.md)。它們重用已翻譯的介面標籤及導覽步驟，並非 88 種語言的工程手冊。主手冊與配套功能指南提供 24 種語言的完整版本。
- [Android Full/API 22 套件與更新](../android-distributions.md)、[Android 建置](../../android/README.md)及 [Capacitor iOS/Android](../capacitor-mobile.md)。
- [macOS 桌面交付](../macos-local-delivery.md)、[Tauri 簽章/更新器](../tauri-updater-notarize.md)及[本機 HTTP 執行個體](../local-http-deployment.md)。

<a id="process-and-results"></a>

## 流程與結果

- [瀏覽器資格評估與候選版驗證](../browser-compatibility.zh-Hant.md)（[Русский](../browser-compatibility.ru.md)）：已設定目標、彩色圖表、精確套件檢查及分別記錄的本機結果。

- [實作報告與彩色圖表](../implementation-report.zh-Hant.md)（[Русский](../implementation-report.ru.md)）：已審查變更、已修正回歸、測量結果與剩餘發佈條件。

<a id="use-the-new-capabilities"></a>

## 使用新能力

- [功能交付與平台界線](../roadmap-delivery.zh-Hant.md)（[Русский](../roadmap-delivery.ru.md)）。
- [品質上限、明確的直播備援來源及有界復原](../playback-stream-policy.zh-Hant.md)（[Русский](../playback-stream-policy.ru.md)）。
- [手動 XMLTV 繫結與傳統控制項無障礙支援](../guide-binding-accessibility.zh-Hant.md)（[Русский](../guide-binding-accessibility.ru.md)）。
- [託管的影像與聲音檢查](../audio-video-check.zh-Hant.md)（[Русский](../audio-video-check.ru.md)）：**資訊 → 音訊 → 播放**、預期音調、託管圖表與返回直播電視。片段依需求擷取，需要網際網路，且不包含在播放器套件中。獨立的線上動態圖樣示範沒有聲音。
- [Xtream 電影/影集庫](../xtream-media.zh-Hant.md)（[Русский](../xtream-media.ru.md)）。
- [同一來源的播放器交接](../remote-handoff.zh-Hant.md)（[Русский](../remote-handoff.ru.md)）。
- [本機設定日誌與復原](../settings-recovery.zh-Hant.md)（[Русский](../settings-recovery.ru.md)）。
- [可靠控制、可復原設定檔與交接](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.md)（[Русский](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.ru.md)）。需要相符的控制器/CLI 修訂版及已設定權限。
- [原生 Android 中依語義設定的音訊/字幕偏好](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.md)（[Русский](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.ru.md)）。原生 Kotlin 應用程式與本儲存庫的 Capacitor APK 相互獨立。

<a id="configure-sources-and-inspect-problems"></a>

## 設定來源與排查問題

- [Plex 登入與播放](../plex-provider.md)、[節目指南架構](../guide-architecture.md)及[託管 EPG 診斷](../hosted-epg-diagnostics.md)。
- [介面設定](../interface-settings.md)、[設計歷史與致謝](../interface-history.md)及[語言目錄/鍵盤](../localization.md)。
- [遠端工作台](../remote-workbench.md)、[執行階段診斷](../runtime-debug.md)及[診斷同意、遮蔽與保留](../diagnostic-security.md)。
- [原生裝置檢查清單](../mode-b-device-smoke.md)、[Tauri 裝置檢查清單](../mode-b-tauri-smoke.md)及[瀏覽器視窗控制項](../browser-window-controls.md)。

- [功能成本實測](../roadmap-size.zh-Hant.md)、原始依據與 SVG 圖表。

<a id="develop-and-release"></a>

## 開發與發佈

- [架構與擁有權](../architecture.md)、[播放工作階段](../playback-session-architecture.md)及[傳統 ES5 建置](../build-pipeline.md)。
- [執行階段資源名稱](../asset-layout.md)、[發佈政策](../../RELEASING.md)、[發佈操作手冊](../release-workflow.md)及 [RC 模糊測試](../../FUZZING.md)。
- [隱私權政策](../privacy-policy.md)及 [MIT 授權](../../LICENSE)。

變更文件時，若介面標籤或快速入門範本有變，請執行 `npm run docs:generate`，然後執行 `npm run check:docs`。保持所有手冊翻譯完整，在能力宣稱旁標明限制，並區分本機驗證與實機測試。圖表是可審查的儲存庫資源；參見[節目指南繫結 SVG](../images/guide-binding.svg)及功能指南連結的圖表。檢查器驗證相對檔案目標，不驗證遠端網站可用性或每個 Markdown 標題錨點。
