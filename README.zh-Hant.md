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

無需網際網路的本機檔案播放：參見[本機影片與離線播放](docs/offline-media.md)。

[![透視角度下的OTT-play FOSS頻道瀏覽器](docs/images/hero.png)](docs/images/studio-2026-default.png)

*現有Studio 2026介面截圖，使用合成頻道和節目測試資料。開啟圖片可檢視原始平面版本；這不是實際訂閱服務的截圖。[圖片來源與重新生成](docs/images/README.md)。*

[88種語言的快速入門](docs/readme/README.md) · [文件wiki](docs/wiki/Home.zh-Hant.md)

[![OpenSSF最佳實踐](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![模糊測試：僅RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

公開候選釋出版會對原生/伺服器端XMLTV解析和門戶請求驗證執行有界、隔離的模糊測試。參見[模糊測試範圍、重現與釋出證據](FUZZING.md)。

自包含的IPTV/OTT播放器，帶本機Rust HTTP伺服器。可在智慧電視（LG WebOS、Samsung Tizen、Panasonic、Sony等）、機頂盒（Infomir MAG、Dune HD、Enigma2、Android TV）和桌面瀏覽器中執行。

請先閱讀[架構與貢獻者指南](docs/architecture.md)，瞭解執行階段分層、職責歸屬、提供商擴充方法和驗證。核心/宿主邊界與相容性契約見[播放工作階段和提供商生命週期](docs/playback-session-architecture.md)。

<!-- ci-release-process:start -->
<a id="release-process"></a>

## 釋出流程

驗證、nightly、beta、RC及stable升級規則見[釋出策略](RELEASING.md)，本機命令見[運維手冊](docs/release-workflow.md)。
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## 在瀏覽器中執行

開啟[線上演示](https://player.ottplay.here.now/)，或按照下文建置並提供網頁播放器。

[本機macOS部署](docs/local-http-deployment.md)在8443–8446埠提供HTTP播放器來源。8095埠已停用。

首次啟動時選擇**試用演示**播放動態測試圖，或配置自己的M3U播放列表或提供商。之後也可透過**更換提供商 → 演示**開啟演示。

演示模式需要網際網路連線，但不需要提供商帳號。無聲MP4和HLS測試頻道託管在here.now，由網頁播放器、Tauri、Capacitor和OTT Server共用。切換時會保留已有提供商設定。要單獨**檢查影像與聲音**，請在託管HTML5引擎空閒或播放直播時開啟**資訊 → 音訊 → 播放**。此功能使用here.now上的有聲`av-v1.mp4`測試片段，需要網際網路連線。片段不包含在播放器包中，也絕不會在啟動時下載。VOD、回看和裝置引擎覆蓋（包括PC2/Video.js及原生引擎）不適用；參見[步驟、預期聲音和託管示意圖](docs/audio-video-check.zh-Hant.md)。

已安裝的桌面瀏覽器視窗支援**視窗控制元件疊加層**：Chrome可以隱藏獨立標題欄，同時在播放器上保留視窗按鈕和應用選單。開啟已安裝應用，在Chrome提供此選項時選擇**隱藏標題欄**；**顯示標題欄**可恢復普通視窗框架。普通標籤頁和電視/原生外殼佈局保持原有行為。支援的安裝網址、更新已有捷徑及驗證方法見[瀏覽器視窗控制元件](docs/browser-window-controls.md)。

在主影片檢視中使用**Alt/Option + 左/右**可前後跳轉十秒，macOS也支援**Command + 左/右**，全屏與普通檢視均可使用。本機影片、VOD和支援的頻道回看在網頁、Tauri與Capacitor中共用這些操作。參見[鍵盤快捷鍵與限制](docs/browser-window-controls.md#playback-keyboard-shortcuts)。

在PC介面中，**R**會從目前列表隨機播放另一個頻道或影片，但不打亂列表順序。此操作適用於主影片檢視和頻道/影片列表；文字編輯器、對話方塊、設定與自助模式限制具有優先權。其他裝置的按鍵映射不變。

可用`scripts/generate-demo-media.sh`重新生成合成測試圖（需要FFmpeg）；生成媒體儲存在Git忽略的`.local-artifacts`目錄中。

<a id="features"></a>

## 功能

- **播放**：HLS、DASH和普通HTTP流，支援託管HLS.js/Shaka畫質上限、有界恢復，以及每個直播頻道最多三個顯式備用URL。回看/VOD絕不會切換到直播備用源；參見[畫質與恢復](docs/playback-stream-policy.zh-Hant.md)。
- **節目指南**：XMLTV匹配、時移/回看、節目標題搜尋（EPG中的N5）、提醒，以及託管/原生XMLTV路徑中針對準確頻道的手動節目來源/ID綁定。參見[綁定與無障礙](docs/guide-binding-accessibility.zh-Hant.md)。
- **收藏**：在支援的裝置上，跨已設定的提供商和設定檔使用一個有序的[混合收藏集](docs/mixed-favorites.md)，支援透過CLI進行可移轉的匯出/匯入；保留家長控制PIN。備援模式下仍可使用各來源的收藏清單。
- **設定**：設定和收藏的JSON匯入/匯出、支援的localStorage批次操作撤銷日誌、區分來源的回看續播，以及控制器工作流程所用的已存設定精確比較。恢復假定只有一個寫入者；自訂儲存適配器仍為盡力回復。參見[設定恢復](docs/settings-recovery.zh-Hant.md)。
- **共享介面**：OTT Server、Tauri和Capacitor使用相同的頻道列表主題與可見性設定。[介面色彩](docs/interface-colors.md)支援按九種用途分別設定顏色，提供調色盤、精確的HEX/RGB/HSV數值輸入和五種配色方案，設定按用戶端儲存。頻道列表設定控制頻道名稱、圖示、目前節目、進度及回看標記。
- **提供商**：M3U/M3U8、Xtream直播及[點播電影/劇集目錄](docs/xtream-media.zh-Hant.md)、支援[電影和巢狀分集](docs/stalker-media.md)的Stalker/Ministra、Plex和VPortal。可用回看與媒體庫功能取決於提供商能力和帳號權限。
- **推送命令**：透過webhook遠端控制——切換頻道、提供商、播放列表以及顯示彈窗。
- **遠端文字輸入（swop）**：電視和手機處於不同網路時，透過Cloudflare Worker使用手機鍵盤（安裝授權工作階段；虛擬鍵盤上的♥™）。
- **按裝置路由**：基於UUID為多裝置部署定址。
- **本機代理**：可選本機命令伺服器，實現100%本機自動化，無需中央伺服器。
- **控制器整合**：按裝置/操作限定權限的操作員、可選持久化命令結果、可恢復的Local/Home預設應用，以及透過匹配的[控制伺服器](https://github.com/open-ott-play/ottplay-control-server)進行同源直播/回看接力。這需要更新後的控制器/CLI，獨立瀏覽器標籤頁本身不提供這些能力。
- **具型別的遠端設定**：探索可用設定，讀取已儲存值和實際生效值，並在儲存時檢查執行個體、來源和修訂版本；參閱[遠端設定與 VPortal 組態](docs/remote-player-settings.md)。
- **除錯**：透過`?debug=1`選擇啟用播放HUD/環形日誌、經同意的遠端檢查，以及按需託管的音訊/視訊檢查。
- **鍵盤無障礙**：經典對話方塊有可存取名稱、Tab焦點限制與返回、已選頻道語義和禮貌狀態播報。這些改進不代表完整WCAG或裝置螢幕閱讀器合規。
- **24類裝置**：按裝置設定遙控器按鍵映射。
- **88種介面語言**：配套目錄、[在地化快速入門](docs/readme/README.md)和[經CLDR校驗的鍵盤字元表](docs/localization.md)。主手冊和成對功能指南提供[24種文件語言](docs/manual-translations.md)；其他工程參考文件保留原有語言。

[交付指南](docs/roadmap-delivery.zh-Hant.md)介紹此原始碼版本已實現的功能、平台邊界、圖表與驗證。已安裝版本或託管部署可能使用更早修訂。獨立的原生[Android應用](https://github.com/open-ott-play/ottplay-android)也會按語言、角色和標籤儲存音軌/字幕選擇，而非使用清單索引；其實現與釋出獨立於本前端。

[STB原始碼審查](docs/stb-player-improvements.md)介紹媒體、資源使用和復原方面的改進，以及原始碼比較和目前限制。

<a id="debug-hud"></a>

## 除錯HUD

本機HUD與伺服器日誌持久化分別選擇啟用。收集其他裝置日誌前，請閱讀[診斷存取、脫敏和保留策略](docs/diagnostic-security.md)。

透過以下任一方式啟用除錯：
- URL：`?debug=1`或`?debug=true`
- 本機儲存：`localStorage.setItem("ottplay_debug", "1")`
- 視窗屬性：`window.__OTT_DEBUG__ = true`
- 伺服器：`/debug/config`返回`{enabled: true}`時

啟用除錯後：
- 按**D**切換螢幕HUD條（`ottDebugSetHud` / `__ottDebug.toggleHud()`）。
  - 焦點位於INPUT/TEXTAREA/listEdit時跳過。
  - 使用`e.key`避免MAG/Maple PLAY/PREV=68衝突。
- 資訊選單 → **除錯HUD** → 呼叫`__ottDebug.toggleHud()`。
- 管理設定 → **除錯HUD**：
  - 除錯已載入：切換HUD可見性。
  - 否則：設定`ottplay_debug=1` + `ottplay_debug_hud=1`並提示重啟。
- 持久化：`ottDebugSetHud`將HUD狀態儲存到`localStorage.ottplay_debug_hud`（"1"/"0"）。

<a id="capacitor-ios-and-android"></a>

## Capacitor iOS與Android

本儲存庫使用Capacitor將共享TypeScript前端打包到iOS和Android 7+。兩者均使用系統字型與npm鎖定的原生執行環境。另有API 22相容APK，支援安裝WebView 60或更新版本的Android 5.1/6。兩個Android APK均已簽名，並與未簽名iOS IPA一起包含在通過資格驗證的beta、RC和stable釋出中。獨立Kotlin應用仍位於[ottplay-android](https://github.com/open-ott-play/ottplay-android)。

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

參見[Capacitor配置](docs/capacitor-mobile.md)和[Android分發與遠端更新](docs/android-distributions.md)。

iOS介面使用橫屏。設定、提供商配置、遠端控制授權和JSON匯入/匯出仍使用共享前端。平板多工可能覆蓋請求的螢幕方向。

在iPhone上，可在頻道列表上下滑動以移動行和頁面：上滑到後續頻道，下滑到之前頻道。快速輕掃會跨越多頁並逐漸停止；慢速拖動保持精確。觸碰螢幕或按導航鍵可停止運動。單擊會啟動手指下的頻道，即使目前選中的是另一行；滑動鬆手不會開啟頻道。

影片在iPhone上內嵌播放。點按螢幕底部可檢視節目資訊，播放期間也能開啟選單。畫中畫仍是獨立播放選項。

裝置冒煙檢查：[Mode B清單](docs/mode-b-device-smoke.md)與`./scripts/smoke-capacitor-device.sh --help`（建置/同步僅針對iOS）。Tauri桌面冒煙檢查：[桌面清單](docs/mode-b-tauri-smoke.md)。

<a id="installation"></a>

## 安裝

| 平台 | 軟體包 | 說明 |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Apple Silicon與Intel分別建置；未配置Apple簽名時使用臨時簽名 |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | 多種發行版 |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode 或 Homebrew Channel](docs/lg-webos-installation.md)；託管播放器，需要網路連線 |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode 與本機簽署；未簽署的電視套件，與 Family Hub 分開](docs/samsung-tizen-installation.md) |
| **iOS** | 透過AltStore / TestFlight / Xcode安裝`.ipa` | 僅側載，尚未上架App Store |
| **Android（共享前端）** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | 已簽名Capacitor包；選擇支援的Android版本 |
| **Android（原生Kotlin）** | 獨立[原生應用](https://github.com/open-ott-play/ottplay-android) | 公開儲存庫，獨立應用與釋出工作流程 |

支援的安裝包附在通過資格驗證的GitHub釋出中：[https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **注意：**沒有Apple簽名憑據時，macOS應用包採用臨時簽名，不提供Developer ID或公證。Windows/Linux安裝包和iOS釋出包可能未簽名。安裝到iOS真機前必須簽名。通過資格驗證的Full和API 22 Android釋出APK使用既定簽名證書；本機release建置需要配置keystore才能生成已簽名APK。

---

<a id="macos"></a>

### macOS

1. 從[釋出列表](https://github.com/open-ott-play/ottplay-foss/releases)選擇所需標籤。最新發布快捷入口選擇stable，而非beta或RC。
2. Apple Silicon下載`OttPlay.FOSS_*_aarch64-apple-darwin.dmg`，Intel下載`OttPlay.FOSS_*_x86_64-apple-darwin.dmg`。它們是獨立架構建置。
3. 開啟`.dmg`並將**OttPlay FOSS.app**拖入“應用程式”。
4. 首次執行前驗證複製的應用包：

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

驗證成功表示應用包完整性通過。`Signature=adhoc`表示沒有Apple認證的開發者身份，不能證明經過公證或Gatekeeper批准。即使下載可信且應用包有效，首次嘗試啟動後macOS仍可能要求**系統設定 → 隱私與安全性 → 仍要開啟**；參見[Apple說明](https://support.apple.com/en-us/102445)。

“應用已損壞”不只意味著隔離屬性問題。若簽名驗證失敗，請保留錯誤並取得修復版本。不要重新簽署下載的應用或刪除屬性來讓失敗的驗證看起來成功。

ZIP替代包為`OttPlay.FOSS_aarch64-apple-darwin.app.zip`和`OttPlay.FOSS_x86_64-apple-darwin.app.zip`。解壓、磁碟映像和Gatekeeper檢查見[macOS簽名及產物驗證](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact)。檢出原始碼建置和本機安裝請使用[本機macOS交付](docs/macos-local-delivery.md)。

---

<a id="windows"></a>

### Windows

1. 從[釋出頁面](https://github.com/open-ott-play/ottplay-foss/releases/latest)下載`.msi`或`.exe`。
2. 執行安裝程式並按提示操作。
3. 從開始選單或桌面捷徑啟動。

---

<a id="linux"></a>

### Linux

Linux播放除WebKitGTK外還需要GStreamer HLS、H.264和AAC外掛。軟體包宣告這些媒體依賴；AppImage建置內建媒體框架。編解碼器檢查以及瀏覽器和原生驗收之間的區別見[Linux媒體打包](docs/linux-media-packaging.md)。

**AppImage：**

```bash
chmod +x OttPlay.FOSS_*_amd64.AppImage
./OttPlay.FOSS_*_amd64.AppImage
```

**Debian/Ubuntu（.deb）：**

```bash
sudo apt install ./OttPlay.FOSS_*.deb
```

**Fedora（.rpm）：**

```bash
sudo dnf --enablerepo=fedora-cisco-openh264 install ./OttPlay.FOSS-*.rpm
```

---

<a id="ios-installation"></a>

### iOS安裝

在iOS真機安裝前必須簽名。可使用AltStore Classic安裝未簽名釋出IPA，或透過Xcode從原始碼建置並簽名。TestFlight如有提供，需要單獨邀請。

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### 選項1：AltStore Classic（推薦個人使用）

AltServer執行於電腦；AltStore Classic執行於iPhone/iPad並匯入IPA。免費Apple帳號即可。

**前提條件：**

- 目前OTT-play建置要求iPhone/iPad執行**iOS/iPadOS 15或更新版本**。
- 裝有AltServer的Mac或Windows電腦，以及USB資料線。
- 用於簽名的Apple帳號，以及下載釋出包所需的網際網路連線。

**步驟1：一次性設定AltStore**

1. 按照官方[macOS設定](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos)或[Windows設定](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows)安裝AltServer。啟動後使用其選單欄/系統托盤圖示。
2. 透過USB連線裝置、解鎖，並接受電腦/裝置信任提示。在Mac上確認Finder能看到裝置。
3. 在**AltServer選單 → Install AltStore**選擇裝置並完成簽名帳號提示，等待安裝通知。
4. 在裝置開啟**設定 → 通用 → VPN與裝置管理**，按要求信任簽名帳號的開發者項目。iOS 16+還需啟用**設定 → 隱私與安全性 → 開發者模式**，完成裝置重啟/確認提示。
5. 在裝置開啟AltStore。若已經安裝且工作正常，可跳過設定，保持AltServer執行以進行下方匯入。

**步驟2：在iPhone/iPad上匯入選定版本**

1. 從[所有釋出](https://github.com/open-ott-play/ottplay-foss/releases)選擇準確標籤，在裝置Safari下載其`ottplay-foss-ios-unsigned.ipa`。[最新發布快捷入口](https://github.com/open-ott-play/ottplay-foss/releases/latest)選擇穩定版；安裝beta請用完整列表。
2. 將IPA儲存到“檔案”。在**AltStore → My Apps → +**選擇該檔案。也可從Mac透過AirDrop傳輸已下載IPA，儲存到“檔案”後再匯入。在Mac開啟IPA不屬於此匯入步驟。
3. AltStore簽名和安裝時保持AltServer執行並連線USB線。更新時使用與現有安裝相同的簽名帳號，不要先刪除應用來排障。
4. 等待匯入完成，在**My Apps**中檢查OTT-play，然後啟動。

**替代方式：直接匯入釋出URL**

已安裝AltStore時，在**iPhone的Safari**輸入以下模式，將`TAG`替換為準確釋出標籤，並接受**在AltStore中開啟**：

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

這使用AltStore的[安裝URL處理器](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift)。多個下載同名時可避免“檔案/最近使用”條目的歧義。URL必須指向IPA資產，而非釋出頁面。

例如，下方匯入曾於**2026-09-29**透過AltStore 2.3和AltServer 1.8.1驗證。這是固定歷史範例，不是最新版本連結：

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**重新整理：**免費帳號安裝七天後過期。保持AltServer可存取，並在到期前使用**AltStore → My Apps → Refresh All**。後臺重新整理也需要存取AltServer；參見[AltStore重新整理說明](https://faq.altstore.io/altstore-classic/your-altstore)。

<a id="verify-the-installed-version-before-retrying"></a>

#### 重試前確認已安裝版本

AirDrop的“已傳送”僅證明傳輸完成。AltStore進度條僅證明匯入開始。鏡像輸出/USB連線中斷不能證明安裝失敗：再次提交IPA前先檢查已安裝應用。

在安裝Xcode並將其選為活動開發者目錄的Mac上，可不重新安裝而檢查裝置：

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

在JSON的`result.apps`中找到OTT-play（`bundleIdentifier`以`play.ott.foss`開頭），將`version`和`bundleVersion`分別與選定IPA的`CFBundleShortVersionString`和`CFBundleVersion`比較。包識別符號帶有AltStore簽名帳號字尾是正常現象。裝置報告請留在本機。

已驗證的beta.9範例報告**版本`1.1.51`，建置`2.2.66`**。這確認安裝完成；啟動應用、Cloudflare登入、載入播放列表、播放和畫中畫仍須分別進行裝置檢查。

<a id="troubleshooting-ios-installation"></a>

#### iOS安裝排障

- **AltServer沒有視窗，或透過自動化開啟時超時：**使用選單欄/系統托盤圖示。它是後臺應用。反覆嘗試開啟普通應用視窗不會執行IPA匯入。
- **“Could not find AltServer”或USB裝置不可用：**確認AltServer正在執行，解鎖手機並檢查電腦/裝置信任提示。Mac上檢查Finder是否可見。若連線斷開，在安全時重新連線，再檢查已安裝版本後才重試。持續出現時按[AltStore連線排障](https://faq.altstore.io/altstore-classic/troubleshooting-guide)處理。若手機為電腦提供網際網路連線，應協調線纜或網路變更，以免中斷其他工作。
- **iPhone鏡像輸出顯示“iPhone in Use”或一直“Connecting”：**在真機完成設定，或鎖定手機螢幕並放在已解鎖Mac附近進行鏡像輸出。解鎖手機會結束鏡像輸出；USB信任/設定可能需要先解鎖。重新連線一次仍卡住時，結束鏡像輸出並在手機繼續。參見[Apple鏡像輸出要求](https://support.apple.com/en-us/120421)。安裝不強制要求鏡像輸出。
- **鏡像輸出中URL丟失拉丁字母或變成西里爾文：**將**Mac輸入源切換為ABC/英語**。焦點在鏡像輸出時按**Control–Space**，為iPhone硬體鍵盤選擇**English (US)**。Mac與iPhone輸入源可能不同；已驗證工作階段中只更改Mac不足以解決。清空輸入框，重新輸入URL，提交前檢查地址。
- **貼上到鏡像輸出時卡住或插入意外文字：**清空輸入框，使用iPhone的English (US)輸入源分小段慢慢重輸，或直接在手機輸入URL。快速鏡像輸出輸入可能丟字或重複，儲存前檢查完整地址。不要提交只貼上了一部分的URL。我們安裝時貼上失敗；直接URL方式並不依賴貼上。
- **“檔案/最近使用”中有多個同名IPA：**選擇準確下載位置，或使用上方帶標籤的直接URL。為便於識別，可將本機副本重新命名為包含標籤/建置號的名稱；重新命名不改變內容。
- **已安裝應用無法開啟：**按手機上的開發者信任或開發者模式提示操作。檢查AltStore中的到期時間，必要時重新整理。若仍失敗，記錄實際錯誤；僅有連線錯誤不應成為刪除重新安裝應用的理由。
- **OTT-play可開啟，但受保護播放列表在行動網路失敗：**安裝與來源認證是獨立步驟。透過**設定 → 管理設定 → 來源存取**登入已配置來源，再重新載入列表。按要求在真機完成生物識別/passkey或郵件驗證碼提示。來源必須支援[iOS Access整合](docs/ios-source-access.md)；安裝應用不會繞過IP允許列表。
- **連線可信Wi-Fi時仍請求passkey：**對於整合iOS Access的來源，應用先嘗試不登入存取原始來源，僅在存取被拒後才使用已認證移動入口。檢查來源實際看到的公網IP，包括IPv6：允許的家庭IPv4不能涵蓋不同IPv6、VPN或行動地址。網路改變和重新開啟應用會清除臨時路由偏好。普通網路/伺服器錯誤不應觸發登入。
- **不再提示登入，但頻道列表為空：**有效已儲存工作階段會複用，不再提示。此前載入失敗或伺服器修復後，重新載入播放列表，或完全關閉後重新開啟應用一次。若仍失敗，確認來源返回播放列表而不是HTML登入頁或JSON錯誤。記錄顯示錯誤及HTTP狀態；不要分享含憑據、Cookie或Access權杖的來源URL。
- **頻道載入了，但影片緩衝或報`SRC_NOT_FOUND`：**播放列表載入與影片播放是獨立檢查。登入後重試頻道一次；若持續發生，檢查HLS清單、分段回應及流的編解碼器支援。此錯誤本身不能證明切換引擎或重新安裝應用會有幫助。

<a id="option-2-testflight-if-available"></a>

#### 選項2：TestFlight（如有提供）

若釋出了TestFlight邀請，請從App Store安裝TestFlight，在裝置開啟邀請並點按**安裝**。下載GitHub IPA不會自動提供TestFlight邀請。

<a id="option-3-xcode-for-developers"></a>

#### 選項3：Xcode（供開發者使用）

按照[建置與開啟](docs/capacitor-mobile.md#build-and-open)操作，在Xcode選擇**App**目標，在**Signing & Capabilities**配置開發團隊，選擇已連線裝置並建置/執行。按要求完成裝置信任和開發者模式提示。把未簽名釋出IPA匯入Xcode的Devices視窗不會補齊缺少的簽名身份或預置描述檔案。

---

<a id="android-application"></a>

### Android應用

若需要共享播放器介面，請選擇本儲存庫釋出的Full Capacitor APK。Android 5.1–6使用API 22相容APK，需要WebView 60或更新版本。更新時保持應用身份和簽名證書，以便繼續使用已有配置。參見[建置說明](android/README.md)及[分發、簽名與遠端安裝](docs/android-distributions.md)。

獨立的[ottplay-android儲存庫](https://github.com/open-ott-play/ottplay-android)包含原生Kotlin/Compose應用。它有獨立身份、偏好和釋出工作流程，不會原位替換Capacitor安裝。歷史釋出資產仍然可用。

---

<a id="quick-start"></a>

## 快速入門

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

瀏覽器冒煙測試請使用自己部署的同一修訂。

使用Node 22和Rust stable工具鏈。從儲存庫根目錄執行伺服器，以便存取靜態資源。原生建置需要下文平台工具鏈；僅伺服器建置不需要。

首次載入時選擇**試用演示**，或開啟**設定 → 更換提供商 → M3U / M3U8播放列表**。開啟**選擇播放列表**，選擇槽位，輸入**播放列表URL**，儲存編輯並選擇**載入播放列表**。播放列表或提供商帳號由你提供；應用不提供付費頻道訂閱。

<a id="mode-a-companion-smoke"></a>

## Mode A配套伺服器冒煙測試

基於curl測試Mode A配套伺服器（`ottplay-server` / `archive/server.py`行為一致性）：首頁、靜態目錄、`/logo`、`/version`、可選`/epg`，以及不發起抓取的`POST /m3u/cp.php`探測。

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

檢查定義在`scripts/modea-smoke-checks.json`，不含秘密。命令佇列 / `local_proxy.py`（:8081）由`scripts/smoke-command-queue.sh`單獨覆蓋（若存在）。

<a id="classic-stalker--ministra-portals"></a>

## 經典Stalker / Ministra門戶

選擇**Stalker門戶**，輸入提供商發放的MAC和完整門戶URL，例如`http://provider.example/stalker_portal/c/`。`/c/index.html`、`/stalker_portal`、`/server/load.php`、`/load.php`和`/portal.php` URL選擇經典MAG協議。現有裸伺服器配置保留JSON-RPC。提供商透過共享Stalker核心載入配置、分類和分頁直播頻道，然後在背景透過經典`type=vod`協定探索電影和巢狀分集。資料夾路徑成為一般頻道列表中的分類；可用的簡介、海報和穩定的全域收藏使用同一媒體介面。參見[目錄行為與限制](docs/stalker-media.md)。

自行架設的瀏覽器版本透過配套伺服器的`/stalker/api`端點傳送請求；原生應用使用現有HTTP傳輸。使用託管服務的瀏覽器版本需要明確設定經由[專用中繼](docs/stalker-relay.md)的路由。瀏覽器和伺服器資產必須一起更新。

開啟直播流時會解析臨時頻道命令；切換頻道、停止、畫中畫和更換提供商會取消過期解析。顯式的非臨時HTTP(S)命令直接播放。支援短EPG。此提供商不開放經典門戶回看和獨立的`type=series`協定變體。現有JSON-RPC回看/節目指南行為不變。透過配套伺服器路由存取的私有區域網門戶與其他配套代理路由一樣，需要準確的`OTTPLAY_PROXY_LAN_ORIGINS`條目。

Infomir公開演示為`http://middleware-stalker.com/stalker_portal/c/`。它在2026-09-26返回三個直播目錄條目，但媒體端點不可用；播放回歸請使用可控門戶/媒體測試資料。

<a id="m3u-stream-proxy-header-smoke"></a>

## M3U流代理請求標頭冒煙測試

比較Mode A配套伺服器`POST /m3u/cp.php`抓取可控回顯URL時注入的上游請求標頭（預設本機模擬，不存取IPTV提供商，不使用秘密）。

契約來自`src-rs/core/src/m3u.rs` + `archive/server.py`：
- 僅注入**User-Agent**（預設為`OTT-play-FOSS/1.0`，或使用`webos` / `tizen` / `viera` / `mag` / `dune`預設）。
- **不**注入**Referer**（Capacitor的`M3UProxy`會注入，Mode A不會）。
- 去掉`url`開頭的`@`（提供商jQuery表單）。

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

結束代碼：`0`通過，`1`未監聽，`2`請求標頭/HTTP不匹配，`3`用法/依賴錯誤。與`smoke-modea-companion.sh` / `smoke-command-queue.sh`配套。

<a id="logo-concurrent-bench-smoke"></a>

## Logo併發基準冒煙測試

對Mode A配套伺服器併發`GET /logo/<id>.svg`（可選`?ch=`）進行延遲冒煙測試。報告成功/失敗次數及p50/p95/p99。預設使用適合CI本機的實際負載（`CONCURRENCY=200`、`TOTAL=1000`）；完整一萬次持續測試為可選（`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`）。

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

結束代碼：`0`通過，`1`未監聽/連線失敗，`2`錯誤率高，`3`用法錯誤。與`smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`配套。

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## XMLTV快取重新整理/預熱冒煙測試

依據`src-rs`準確驗證Mode A配套伺服器XMLTV/EPG快取行為，不虛構API：

- 記憶體`EPG_CACHE`由`GET /epg/:hash`提供，始終返回`{"epg_data":[...]}`（HTTP 200）。
- 程序啟動後後臺抓取`EPG_URLS`，不延遲HTTP啟動；每次抓取完成後等待**2小時**再重新整理。
- 配置`DATABASE_URL`時可選SQLite持久化，沒有公開快取狀態端點。
- 可選重啟後，`GET /health` → `OK`確認HTTP就緒。使用`--strict-epg`和`--epg-hash`時，測試還會在同一個`--warmup-timeout`時間預算內等待該頻道非空EPG。

預設路徑只使用curl，**不會終止程序**。傳入`--restart-cmd` / `RESTART_CMD`可自動終止並重啟，或按`--help`中的手動`launchctl`步驟操作。

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

結束代碼：`0`通過，`1`未監聽，`2`斷言/預熱失敗，`3`用法錯誤。與`smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`配套。

<a id="mode-a-e2e-play-path-smoke"></a>

## Mode A端到端播放路徑冒煙測試

配套伺服器側的**播放路徑/流就緒**冒煙測試，僅HTTP，**不是**帶圖形介面的端到端UI測試。它針對正在執行的Mode A配套伺服器檢查：

- 健康檢查或首頁可存取。
- 靜態播放器外殼資產（`/`、`/styles/player.css`、`/js/jquery-…`、`/f/…`）。
- 設定`EPG_HASH`時可選檢查`GET /epg/<hash>.json`。
- 使用無秘密JSON測試資料（空列表加一個合成頻道）呼叫`POST /m3u/match-channels`。
- 流代理**播放**：向可控媒體測試源（預設本機HLS列表，或`MEDIA_URL`）呼叫`POST /m3u/cp.php`，斷言HTTP 200、非空回應及預期`Content-Type`，驗證首批位元組經過代理。

不使用私有IPTV憑據。與`smoke-modea-companion.sh`（存在性）、`smoke-m3u-stream-proxy-headers.sh`（UA/Referer）、`smoke-xmltv-cache-refresh.sh`配套。

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

結束代碼：`0`通過，`1`未監聽，`2`斷言失敗，`3`用法/依賴錯誤。

<a id="capacitor-device-smoke-mode-b"></a>

## Capacitor裝置冒煙測試（Mode B）

用於Mode B Cap的模擬器/仿真器（可選真機）**清單**，不是Mode A配套伺服器HTTP測試。人工標記UI通過；輔助工具自動檢查工具鏈、原生目錄及寬鬆命令佇列curl探測。

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

詳情：[docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md)。與`smoke-command-queue.sh`（Cap迴環）配套，不要與上方Mode A冒煙測試混淆。

<a id="tauri-desktop-smoke-mode-b"></a>

## Tauri桌面冒煙測試（Mode B）

Mode B Tauri的桌面清單和輔助工具，檢查視窗/頻道播放/畫中畫。不是Mode A配套HTTP測試，也不是Cap裝置測試。

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

詳情：[docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md)。本機冒煙測試不強制Apple開發者憑據；打包Mac應用可用[臨時簽名](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials)。人工驗收仍需覆蓋啟動、播放和畫中畫。

<a id="docker"></a>

## Docker

多架構映像（amd64/arm64）先建置為候選OCI歸檔。映像儲存庫釋出會將批准的stable歸檔原樣提升到Docker Hub，不重新建置；參見[運維手冊](docs/release-workflow.md)。

伺服器二進位制在**musl**（Alpine）上建置並以Alpine交付，**不**要求GLIBC_2.38+。因此`alvit/ottplay-foss`可以執行在Synology DSM Docker（x86_64）及其他glibc較舊的主機上。

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

穩定映像儲存庫標籤使用`X.Y.Z`。釋出帶版本映像後，更新`latest`是另一個必須明確選擇的選項；推送main和Git標籤不會發布映像。

<a id="build-from-source"></a>

## 從原始碼建置

播放器領域規則來自`vendor/ottplay-core.js`中鎖定的Kotlin多平台產物。節目指南、回看、播放列表、提供商、持久狀態與播放決策同FOSS2和原生Android共享實現。瀏覽器/電視、Swift和Rust適配器保留裝置API、編解碼器、網路及UI效果。瀏覽器產物保留ES5語法與受支援的舊API引導。`npm test`、`check:bundle`和`check:es5`驗證整合；產物清單記錄原始碼與輸出雜湊。

Control-server和SWOP協議驗證器從版本化的`contracts/ottplay-wire-v1.json`模式生成。經檢查的生成器憑據與不可變相容性測試資料，避免各消費者複製自己的策略。

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

## 裝置識別

播放器支援24類裝置。首先透過URL `/f/{device_id}/`識別，再透過User-Agent識別。

| 裝置ID | 裝置 |
|---|---|
| `pc` | PC瀏覽器 |
| `pc2` | videojs網頁播放器 |
| `nodejs` | Windows應用（Electron） |
| `lg/webos` | LG WebOS電視 |
| `samsung/tizen` | Samsung Tizen電視 |
| `samsung/maple` | Samsung Orsay電視 |
| `mag` | Infomir MAG機頂盒 |
| `dune` | Dune HD機頂盒 |
| `android` | Android TV / 平板 |
| `hbbtv` | HbbTV電視 |
| `panasonic` | Panasonic Viera電視 |
| `philips` | Philips電視 |
| `sony` | Sony電視 |
| `sharp` | Sharp電視 |
| `toshiba` | Toshiba電視 |
| `hisense` | Hisense電視 |
| `skyworth` | Skyworth電視 |
| `tcl` | TCL電視 |
| `vewd` | Vewd裝置 |
| `spark` | Spark接收器 |

<a id="push-command-system"></a>

## 推送命令系統

若需要獨立多裝置服務，請使用[OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server)和**設定 → 遠端控制**中的**命令伺服器**部分。輸入其IP/地址和本播放器裝置存取碼；兩者儲存後自動開始輪詢音量、頻道及其他命令。未帶埠的IP使用HTTP 8081。清除地址或選擇**斷開連線**即可停止。此出站連線支援確認交付，不需要本機監聽器。參見[連線與相容性詳情](docs/remote-command-server.md)。下方範例介紹現有本機代理/監聽器模式。

**尋找命令伺服器**可以找到控制器並請求操作員核准，無須複製裝置權杖。Tauri先檢查原生DNS；如果結果為空，可以回退至明確設定的部署設定檔。瀏覽器、LG和Capacitor播放器使用瀏覽器設定檔路徑。Home探索中繼資料可以獨立於控制器託管在here.now上。通用組建不會自動包含此Home設定檔，更新也不會取代已儲存的連線。參見[平台行為、設定檔設定及疑難排解](docs/remote-command-server.md#discovery-and-one-time-approval)。

瀏覽器/OTT伺服器播放器、Tauri和Capacitor中的本機HTTP遠端控制均**預設關閉**。在**播放器設定 → 遠端控制**中啟用以生成秘密裝置碼。命令是帶`"command"`欄位的JSON物件；HTTP請求需要`Authorization: Bearer <device-code>`。

<a id="architecture"></a>

### 架構

<a id="local-command-url-recommended"></a>

#### 本機命令URL（推薦）

在**播放器設定 → 遠端控制**啟用**本機HTTP遠端控制**，複製生成的**裝置碼**，用該碼配置下方代理。將**本機命令URL**設為代理命令端點。啟用後，播放器每10秒輪詢該URL，裝置碼放在Authorization標頭中。僅設定URL不會啟用命令控制。

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### 裝置UUID

現有裝置UUID（如`dev_a1b2c3d4e5`）是公開路由後設資料，不是授權憑據。獨立的**裝置碼**在啟用本機HTTP控制時安全生成並留在本裝置，不透過雲設定複製。禁用本機HTTP控制會停止輪詢/監聽器。重新啟用會生成新碼：更新代理和整合以撤銷舊憑據。

Tauri與Capacitor僅在設定中主動啟用後才啟動迴環HTTP監聽器。轉發代理必須以Bearer權杖向監聽器傳送顯示的裝置碼。Mode A使用下方單獨配置的`local_proxy.py`佇列。

<a id="remote-text-entry-swop"></a>

#### 遠端文字輸入（swop）

用途：電視和手機處於**不同網路**時，透過Cloudflare Worker工作階段接力，在手機上為♥™ / 遠端虛擬鍵盤輸入。

- Worker儲存庫：[ottplay-swop](https://github.com/open-ott-play/ottplay-swop)。
- **安裝授權：**播放器將請求發到伺服器同源的`/swop`中繼。伺服器新增私有安裝權杖；註冊伺服器來源下的所有客戶端均可使用遠端輸入。裝置UUID識別工作階段，不需要逐裝置允許列表。
- 設定：`swopBaseUrl`（空值表示♥™顯示“未配置”且不執行）。在**設定 → 遠端控制**（按鍵**2**）編輯，或在運維安裝中透過Git忽略的`/local/swop.json`注入。
- `POST /session`包含`clientId`、`caption`和`draft`；`POST /val`包含`clientId`、`code`及返回的`sessionToken`。手機URL包含獨立寫權杖。工作階段讀權杖儲存在瀏覽器記憶體。
- **本機安裝：**在Worker中註冊該安裝及其精確LAN/localhost來源後，設定`SWOP_BASE_URL`和`SWOP_INSTALLATION_TOKEN`。`scripts/install-ottplay-local-service.sh`將其儲存在私有、權限0600的launchd plist中。公開`/local/swop.json`僅含`{"swopBaseUrl":"/swop"}`。絕不要把安裝權杖放入公開資產。
- **靜態託管：**為相同兩個端點配置伺服器端認證代理。安裝權杖儲存在託管服務的秘密儲存中。複製公開播放器檔案不會複製該伺服器憑據。

> 中央OTT伺服器對所有HTTP方法禁用`/api/webhook/commands`、`/webhook/poll`、`/webhook/notify`及命令健康檢查別名。Mode A請使用獨立命令伺服器或明確配置且經過認證的`local_proxy.py`；中央伺服器沒有廣播命令佇列。

<a id="available-commands"></a>

### 可用命令

下方所有範例以`http://192.168.1.50:8081/api/webhook/commands`作為本機代理URL。請替換成實際代理地址，並將`OTTPLAY_QUEUE_HTTP_TOKEN`設為在播放器設定中啟用HTTP控制後顯示的**裝置碼**。代理必須配置同一碼。

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — 顯示通知彈窗

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| 欄位 | 型別 | 預設值 | 說明 |
|---|---|---|---|
| `message` | 字串 | 必填 | 顯示文字 |
| `popup_duration` | 數字 | 5 | 右上角顯示的秒數 |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — 按列表位置切換頻道

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| 欄位 | 型別 | 預設值 | 說明 |
|---|---|---|---|
| `channel_number` | 數字 | 必填 | 列表中從1開始的頻道位置 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — 按完整或部分名稱切換頻道

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

不區分大小寫的子串搜尋，採用首個匹配。

| 欄位 | 型別 | 預設值 | 說明 |
|---|---|---|---|
| `channel_name` | 字串 | 必填 | 頻道名或部分名稱 |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — 切換到隨機頻道

此舊版命令從目前清單或分類中選擇符合條件的頻道。頻道編號與範圍指的是該清單中的位置；請參閱[安全隨機選擇規則](docs/remote-command-server.md#safe-random-playback)。

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

| 欄位 | 型別 | 預設值 | 說明 |
|---|---|---|---|
| `random_range` | [起點, 終點] | 目前清單 | 從1開始的範圍 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — 切換IPTV提供商

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| 欄位 | 型別 | 預設值 | 說明 |
|---|---|---|---|
| `provider` | 數字 | 必填 | 提供商陣列中的索引（0=m3u、1=stalker、2=xtream等） |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — 載入新M3U播放列表

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| 欄位 | 型別 | 預設值 | 說明 |
|---|---|---|---|
| `playlist` | 字串 | 必填 | M3U播放列表URL |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — 更新提供商配置

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| 欄位 | 型別 | 預設值 | 說明 |
|---|---|---|---|
| `provider_settings` | 字串 | 必填 | 含提供商配置的JSON字串 |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — 設定或調整音量

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

不支援音量控制的客戶端會靜默忽略。

| 欄位 | 型別 | 預設值 | 說明 |
|---|---|---|---|
| `volume` | 數字 | — | 絕對音量0–100 |
| `volume_step` | 數字 | — | 相對變化，例如+10或-5 |

<a id="player-standby-restart-and-exit"></a>

#### 播放器待機、重啟與結束

本機代理不帶確認的webhook佇列不支援`exit_player`或具型別待機/喚醒請求。請把播放器連線到[命令伺服器](docs/remote-command-server.md)，並使用其CLI：

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

將`d1`替換為已註冊播放器別名。`stop`是`standby`的別名；`start`和`wake`是`go`的別名。Go要求播放器正在執行且已連線，不能啟動已關閉的應用或喚醒離線裝置。沒有原生應用結束能力的瀏覽器或電視會報告不支援結束。待機會保持遠端輪詢，不會暫停無關宿主或共享伺服器工作。

執行standby/go後，用`ott d1 status`檢查待機/後臺狀態，並單獨驗證恢復播放。播放器重新載入後，用`ott d1 doctor`確認新的執行階段。結束後，透過作業系統確認應用程序已關閉；遠端超時不能證明結束。命令被接受本身不能確認這些結果。

<a id="local-proxy-server"></a>

## 本機代理伺服器

`local_proxy.py`是面向一個播放器的獨立認證命令佇列。預設呼叫會直接結束，不開啟埠。每個代理實例使用播放器生成的裝置碼；多個播放器需要獨立實例/埠。`device_id`查詢引數僅作為相容性後設資料接受，絕不用於認證或選擇其他裝置。

<a id="start-the-proxy"></a>

### 啟動代理

1. 在播放器啟用**本機HTTP遠端控制**，複製其**裝置碼**。
2. 在代理主機配置該碼和提供播放器的精確來源（協議、主機和埠，不含路徑）：

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. 將播放器的**本機命令URL**設為`http://192.168.1.50:8081/api/webhook/commands`。

預設綁定地址是`127.0.0.1`；範例顯式啟用LAN存取。`OTTPLAY_QUEUE_HTTP_ORIGINS`是逗號分隔的精確瀏覽器來源允許列表。若透過HTTPS提供播放器，請使用HTTPS反向代理，使瀏覽器混合內容規則允許輪詢。裝置碼應保密且不得放入URL。播放器生成新碼後，用新值重啟代理；僅禁用播放器不會停止獨立管理的代理程序。

<a id="endpoints"></a>

### 端點

| 方法 | 路徑 | 說明 |
|---|---|---|
| `POST` | `/api/webhook/commands` | 將命令入隊 |
| `GET` | `/api/webhook/commands` | 取出排隊命令（播放器輪詢） |
| `POST` | `/webhook/notify` | 經過認證的相容別名 |
| `GET` | `/webhook/poll` | 經過認證的相容別名 |

傳送和取空佇列都需要匹配的Bearer裝置碼，沒有未經認證的廣播端點。命令60秒後過期；每個代理最多保留50條命令。

代理最多併發處理16個連線，因此空閒瀏覽器連線或不完整請求不會延誤其他命令請求。每個套接字有五秒不活動超時；所有工作執行緒佔用時，新增連線會被關閉。跨工作執行緒的入隊和取空操作均為原子操作。

<a id="smoke-script-all-modes"></a>

### 冒煙指令碼（所有模式）

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Android模擬器/裝置需先執行`adb forward tcp:18081 tcp:18081`。Cap/Tauri僅監聽迴環；區域網Home Assistant請使用此Mode A代理。詳情：`docs/capacitor-mobile.md`的冒煙測試章節。

<a id="cors"></a>

### CORS

代理僅允許來自`OTTPLAY_QUEUE_HTTP_ORIGINS`的瀏覽器請求。允許來源的預檢`OPTIONS`請求無需權杖；每個實際GET/POST都需要Bearer裝置碼。不接受萬用字元或`null`來源。Home Assistant及其他非瀏覽器呼叫方可省略Origin，但仍須認證。

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### 範例：Home Assistant webhook → 本機代理 → 播放器

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

### Home Assistant自動化範例

彈窗、頻道和音量範例使用本機代理。將Home Assistant `secrets.yaml`中的`ottplay_device_authorization`設為`Bearer <device-code>`，使用已啟用播放器顯示的碼。

夜間待機使用獨立的[命令伺服器](docs/remote-command-server.md)。將下方範例URL和`DEVICE_UUID`替換為控制器地址和已註冊裝置ID；本機CLI別名`d1`不是裝置ID。在`secrets.yaml`中將`ottplay_control_authorization`設為`Bearer <controller-admin-token>`。此憑據與本機代理裝置碼不同。參見Home Assistant的[RESTful Command](https://www.home-assistant.io/integrations/rest_command/)和[secrets](https://www.home-assistant.io/docs/configuration/secrets/)文件。

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

`standby_request`包含供自動化追蹤使用的HTTP回應。HTTP 202僅表示已入隊：保留其`content.id`，然後使用相同控制器憑據輪詢`GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID`取得播放器回覆。新的`status`請求可觀察`player.standby`和`player.background`；待機開啟、狀態為`suspended`且待處理數量為零，才確認播放器跟蹤的工作已排空。結束待機時使用同類具型別請求並設定`"operation":"wake"`（`ott d1 go`）。超時後不要盲目重複修改操作。參見控制器[請求/回應API](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1)和[待機語義](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake)。

<a id="server-api-reference"></a>

## 伺服器API參考

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Webhook端點（Rust `ottplay-server`）

Rust伺服器和已歸檔Python後備實現以HTTP 403拒絕命令端點。`/api/webhook/commands`、`/webhook/notify`、`/webhook/poll`和命令健康檢查別名不會入隊、廣播或取空命令。通用反饋API不能覆蓋這些保留路由。Mode A命令交付使用上文單獨配置的命令伺服器或認證本機代理。

<a id="other-endpoints"></a>

### 其他端點

| 方法 | 路徑 | 說明 |
|---|---|---|
| `GET` | `/epg/<hash>.json` | 頻道EPG資料 |
| `GET` | `/logo/<id>.svg` | 生成頻道圖示 |
| `GET` | `/version/<path>` | 檔案版本雜湊 |
| `POST` | `/m3u/match-channels` | 頻道與EPG匹配 |
| `POST` | `/m3u/match-logos` | 頻道圖示匹配 |
| `POST` | `/m3u/cp.php` | 流代理 |
| `GET/POST` | `/feedback/` | 反饋日誌 |
| `GET` | `/tmdb/*` | TMDb API代理 |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## 專案結構

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

## 機頂盒按鍵映射

- **Samsung Tizen**：`RETURN=10009`、`ENTER=13`，彩色鍵403–406。
- **Samsung Maple**：方向鍵4/5/6/8，原始SDK程式碼。
- **LG WebOS**：`RETURN=461`，相容HbbTV的彩色鍵。
- **LG NetCast**：`RETURN=8`，HbbTV程式碼。
- **MAG**：`RETURN=8`，透過gSTB API獲取MAC。
- **Dune HD**：標準程式碼，Dune API。
- **Android TV**：Android鍵碼（`BACK=4`、`DPAD_*` 19–22、`ENTER=66`）。
- **HbbTV/Panasonic/Philips/Sony等**：HbbTV程式碼（`RED=403`、`BLUE=406`、`VOL_UP=447`）。

<a id="documentation"></a>

## 文件

- [文件wiki](./docs/wiki/Home.zh-Hant.md) / [俄語wiki](./docs/wiki/Home.ru.md)——按任務組織的導航與維護規則。
- [實現報告](./docs/implementation-report.zh-Hant.md) / [俄語流程與結果](./docs/implementation-report.ru.md)——彩色圖表、已驗證行為、實測成本與釋出關卡。
- [交付指南](./docs/roadmap-delivery.zh-Hant.md) / [俄語新功能指南](./docs/roadmap-delivery.ru.md)——功能、限制與驗證。
- [88種介面語言的快速入門](./docs/readme/README.md)——從隨應用交付的UI翻譯生成；主手冊和成對功能指南提供[24種文件語言](docs/manual-translations.md)。
- [畫質上限與直播恢復](./docs/playback-stream-policy.zh-Hant.md) / [俄語](./docs/playback-stream-policy.ru.md)。
- [手動XMLTV映射與經典介面無障礙](./docs/guide-binding-accessibility.zh-Hant.md) / [俄語](./docs/guide-binding-accessibility.ru.md)。
- [託管音訊/視訊檢查](./docs/audio-video-check.zh-Hant.md) / [俄語](./docs/audio-video-check.ru.md)。
- [Xtream媒體庫](./docs/xtream-media.zh-Hant.md) / [俄語](./docs/xtream-media.ru.md)。
- [同源裝置接力](./docs/remote-handoff.zh-Hant.md) / [俄語](./docs/remote-handoff.ru.md)。
- [可恢復的本機設定](./docs/settings-recovery.zh-Hant.md) / [俄語](./docs/settings-recovery.ru.md)。
- [瀏覽器世代、作業系統和精確候選釋出檢查](docs/browser-compatibility.zh-Hant.md) / [俄語](docs/browser-compatibility.ru.md)。

- [播放器架構](./docs/architecture.md)——執行階段職責、提供商整合、播放、節目指南、裝置適配器和建置契約。
- [經典ES5建置流水線](./docs/build-pipeline.md)——編譯、相容性檢查和產物大小限制。
- [執行階段資產名稱與部署遷移](./docs/asset-layout.md)——網頁和原生包共用的描述性路徑。
- [遠端工作臺](./docs/remote-workbench.md)——UI/媒體檢查、操作憑據和儲存的證據。
- [執行階段診斷](./docs/runtime-debug.md)——錯誤歷史、幀/迴圈計數器、Capacitor/Tauri原生指標和伺服器除錯。
- [本機macOS交付](./docs/macos-local-delivery.md)——檢出原始碼建置、本機安裝和驗證。

<a id="license"></a>

## 許可證

[MIT](LICENSE)——自由開源。提供商內容和第三方依賴保留各自權利與許可證。

基於 PlxNative 的獨立應用程式 [OTTPlay native webOS](docs/native-webos.md) 依 **GPL-3.0-or-later** 授權條款散布，並提供對應的原始碼。
專案根目錄中的 MIT 授權條款不會變更此原生應用程式或其修補程式的授權條款。

<a id="desktop-updater--notarization-mode-b"></a>

## 桌面更新器/公證（Mode B）

[桌面簽名與更新器指南](docs/tauri-updater-notarize.md)介紹macOS臨時簽名、可選Developer ID/公證和應用包驗證。沒有Apple憑據時釋出CI採用臨時簽名。更新器簽名單獨處理；正式環境自動更新仍未配置。

<a id="local-mac-build-helpers"></a>

## 本機Mac建置輔助工具

參見[docs/local-build-scripts.md](docs/local-build-scripts.md)。

<a id="privacy"></a>

## 隱私

本機設定、已配置服務及個人選擇見[隱私政策](docs/privacy-policy.md)。隱私與支援聯絡人：[alvit.work@gmail.com](mailto:alvit.work@gmail.com)。

預設介面主題為Studio 2026。仍可選擇Classic和PLi-HD，並保留使用者已儲存偏好。參見[介面設定](docs/interface-settings.md)。PLi-HD主題致謝Vali、littlesat、VU+NL、Milo及上游貢獻者。其英文歷史與來源連結見[介面致謝和設計歷史](docs/interface-history.md)，也可從播放器資訊選單開啟。

<a id="demo-video-editing"></a>

## 演示影片編輯

使用本機[video-use工作流程](docs/demo-video.md)準備和編輯演示錄屏。輔助工具將所有生成媒體儲存在Git之外。

<a id="plex-media-library"></a>

## Plex媒體庫

每個播放器都可使用**Plex**提供商連線Plex帳號或Plex Media Server。整合使用Plex；Synology只是媒體伺服器的一種宿主選擇。所有可存取的影片和音樂都會自動加入頻道列表，可透過類別選擇按媒體庫、資料夾或影集篩選。無需在OTT伺服器配置Plex，播放器會從第一批可用資料開始播放並後臺載入，支援標準搜尋以及操作選單中的隨機/重複。參見[Plex登入與直接播放](docs/plex-provider.md)。

![Plex載入、檔案導航與關閉生命週期](docs/images/plex-playback-lifecycle.svg)

[圖解可靠性審查](docs/plex-provider.md#reliability-review-process-and-results)說明載入和取消規則、完整目錄與檔案切換的修復，以及實測Chromium/WebKit驗證結果。

可選OTT伺服器整合也可透過獨立NAS媒體庫入口和M3U匯出，提供已有Plex伺服器目錄及相容播放。參見[伺服器端媒體庫配置與客戶端存取](docs/synology-library.md)。

<a id="related-repositories"></a>

## 相關儲存庫

- [ottplay-core](https://github.com/open-ott-play/ottplay-core)負責共享JVM/ES5領域邏輯、線協議契約和FOSS2客戶端。本播放器使用生成產物；共享改動請遵循核心交付指南。
- [ottplay-android](https://github.com/open-ott-play/ottplay-android)是獨立原生Kotlin/Compose應用，具有自己的安裝和釋出身份。
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server)提供自託管遠端命令；[ottplay-swop](https://github.com/open-ott-play/ottplay-swop)提供可選的Worker文字輸入傳輸。
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine)負責瀏覽器演示的託管配置、演示媒體和釋出驗證。

<a id="project-maintenance"></a>

## 專案維護

參見[貢獻與測試要求](CONTRIBUTING.md)、[安全報告政策](SECURITY.md)、[安全設計](docs/security-design.md)及[OpenSSF證據與剩餘標準](docs/openssf-evidence.md)。
