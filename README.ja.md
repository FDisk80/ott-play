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

インターネットなしでのローカルファイル再生は[ローカル動画とオフライン再生](docs/offline-media.md)を参照してください。

[![遠近感を付けたOTT-play FOSSのチャンネルブラウザー](docs/images/hero.png)](docs/images/studio-2026-default.png)

*合成チャンネル・番組データを使った既存のStudio 2026画面です。画像を開くと元の平面画像を表示します。実際の契約サービスを撮影したものではありません。[画像の出典と再生成](docs/images/README.md)。*

[88言語のクイックスタート](docs/readme/README.md) · [ドキュメントwiki](docs/wiki/Home.ja.md)

[![OpenSSFベストプラクティス](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![ファジング：RCのみ](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

公開リリース候補では、ネイティブ／サーバーのXMLTV解析とポータル要求検証に対して、範囲を限定した隔離ファジングを実行します。[ファジングの範囲、再現方法、リリース証跡](FUZZING.md)を参照してください。

ローカルRust HTTPサーバーを備えた自己完結型IPTV/OTTプレーヤーです。スマートテレビ（LG WebOS、Samsung Tizen、Panasonic、Sonyなど）、セットトップボックス（Infomir MAG、Dune HD、Enigma2、Android TV）、デスクトップブラウザーで動作します。

実行時の層、責任分担、プロバイダー拡張手順、検証は[アーキテクチャと貢献者ガイド](docs/architecture.md)から確認してください。コアとホストの境界、互換性契約は[再生セッションとプロバイダーの寿命](docs/playback-session-architecture.md)を参照してください。

<!-- ci-release-process:start -->
<a id="release-process"></a>

## リリース手順

検証、nightly、beta、RC、stableへの昇格規則は[リリース戦略](RELEASING.md)、ローカルコマンドは[運用手順書](docs/release-workflow.md)を参照してください。
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## ブラウザーで実行

[ライブデモ](https://player.ottplay.here.now/)を開くか、以下の手順でWebプレーヤーをビルドして配信します。

[ローカルmacOSデプロイ](docs/local-http-deployment.md)はポート8443–8446でHTTPプレーヤーのオリジンを提供します。ポート8095は廃止済みです。

初回起動時は**デモを試す**を選んで動くテストパターンを再生するか、自分のM3Uプレイリストまたはプロバイダーを設定してください。デモは後から**プロバイダー変更 → デモ**でも利用できます。

デモモードにはインターネット接続が必要ですが、プロバイダーアカウントは不要です。無音のMP4/HLSテストチャンネルはhere.nowでホストされ、Webプレーヤー、Tauri、Capacitor、OTT Serverで共有します。切り替えても既存のプロバイダー設定は保持されます。別途**映像と音声を確認**するには、管理対象HTML5エンジンが待機中またはライブTV再生中に**情報 → 音声 → 再生**を開きます。here.now上の音声付き`av-v1.mp4`を使うため、インターネット接続が必要です。このクリップはプレーヤーパッケージに含まれず、起動時にも取得しません。VOD、アーカイブ、デバイス固有エンジンの上書き（PC2/Video.jsとネイティブエンジンを含む）は対象外です。[手順、期待する音、ホスティング図](docs/audio-video-check.ja.md)を参照してください。

インストール済みデスクトップブラウザーのウィンドウは**Window Controls Overlay**に対応します。Chromeは独立したタイトルバーを隠し、ウィンドウボタンとアプリメニューをプレーヤー上に保持できます。インストール済みアプリを開き、Chromeが提示した場合に**タイトルバーを非表示**を選択します。**タイトルバーを表示**で通常の枠に戻せます。通常タブとTV／ネイティブシェルのレイアウトは従来どおりです。対応インストールURL、既存ショートカットの更新、検証は[ブラウザーのウィンドウ操作](docs/browser-window-controls.md)を参照してください。

メイン動画表示で10秒シークするには、全画面でも通常表示でも**Alt/Option + 左／右**を使います。macOSでは**Command + 左／右**も使用できます。ローカル動画、VOD、対応チャンネルアーカイブで、Web、Tauri、Capacitor共通の操作です。[キーボード操作と制限](docs/browser-window-controls.md#playback-keyboard-shortcuts)を参照してください。

PCインターフェースの**R**は、リスト順を変えずに現在のリストから別のチャンネルや動画をランダム再生します。メイン動画表示とチャンネル／動画リストで動作しますが、テキスト編集、ダイアログ、設定、キオスク制限が優先されます。他デバイスのキー割り当ては変更しません。

合成テストパターンは`scripts/generate-demo-media.sh`で再生成できます（FFmpegが必要）。生成メディアはGit対象外の`.local-artifacts`に置かれます。

<a id="features"></a>

## 機能

- **再生**：HLS、DASH、通常のHTTPストリーム。管理対象HLS.js/Shakaの画質上限、上限付き復旧、ライブチャンネルごとに最大3つの明示的バックアップURLに対応します。アーカイブ／VODがライブバックアップへ切り替わることはありません。[画質と復旧](docs/playback-stream-policy.ja.md)を参照してください。
- **EPG**：XMLTV照合、タイムシフト／見逃し再生、番組名検索（EPG内のN5）、リマインダー、ホスト型／ネイティブXMLTV経路の特定チャンネルへの手動フィード／ID紐付け。[紐付けとアクセシビリティ](docs/guide-binding-accessibility.ja.md)を参照してください。
- **お気に入り**：対応環境で設定済みのプロバイダーとプロファイルを横断する、順序付きの単一の[混合コレクション](docs/mixed-favorites.md)。CLIによる移行可能なエクスポート／インポートとペアレンタルPINに対応。フォールバックモードではソース別のお気に入りリストも引き続き利用できます。
- **設定**：設定とお気に入りのJSON出力／入力、対応localStorageバッチの取り消しジャーナル、ソースを考慮したアーカイブ再開、コントローラー処理向けの保存設定の厳密比較。復旧は単一ライターを前提とし、独自ストレージアダプターのロールバックは最善努力です。[設定の復旧](docs/settings-recovery.ja.md)を参照してください。
- **共有インターフェース**：OTT Server、Tauri、Capacitorでチャンネルリストのテーマと表示設定を共用します。インターフェース設定は強調／選択色を、チャンネルリスト設定はチャンネル名、アイコン、現在番組、進捗、アーカイブマーカーを制御します。
- **プロバイダー**：M3U/M3U8、XtreamライブTVと[映画／シリーズのオンデマンドカタログ](docs/xtream-media.ja.md)、[映画と階層化されたエピソード](docs/stalker-media.md)に対応するStalker/Ministra、Plex、VPortal。利用可能なアーカイブ／メディアライブラリー機能は、プロバイダーの機能とアカウント権限によります。
- **プッシュコマンド**：webhookによる遠隔操作。チャンネル、プロバイダー、プレイリスト変更やポップアップ表示。
- **遠隔文字入力（swop）**：TVと携帯が異なるネットワークでもCloudflare Worker経由で携帯キーボードを使用（インストール承認済みセッション、VKBの♥™）。
- **デバイス別ルーティング**：複数デバイス構成でUUIDによる宛先指定。
- **ローカルプロキシー**：任意のローカルコマンドサーバーで100%ローカル自動化。中央サーバーは不要です。
- **コントローラー統合**：デバイス／操作範囲を限定したオペレーター、任意の永続コマンド結果、再開可能なLocal/Homeプリセット適用、対応する[コントロールサーバー](https://github.com/open-ott-play/ottplay-control-server)経由の同一ソースのライブ／アーカイブ引き継ぎ。更新済みコントローラー／CLIが必要で、単独のブラウザータブでは提供しません。
- **型付きリモート設定**：利用可能な設定を調べ、保存値と実効値を読み取り、実行インスタンス・ソース・リビジョンを確認して保存できます。[リモート設定と VPortal 構成](docs/remote-player-settings.md)を参照してください。
- **デバッグ**：`?debug=1`で任意に有効化する再生HUD／リングログ、同意に基づく遠隔検査、オンデマンドのホスト型音声・動画確認。
- **キーボードアクセシビリティ**：名前付きクラシックダイアログ、Tabフォーカスの閉じ込めと復帰、選択チャンネルの意味情報、控えめな状態通知。完全なWCAG準拠やデバイスのスクリーンリーダー適合を保証するものではありません。
- **24種類のデバイス**：デバイス別リモコンキー割り当て。
- **88のインターフェース言語**：対応カタログ、[ローカライズ済みクイックスタート](docs/readme/README.md)、[CLDRで検証したキーボード文字表](docs/localization.md)。本マニュアルと対になる機能ガイドは[24のドキュメント言語](docs/manual-translations.md)に対応し、他の技術資料は既存言語を維持します。

[提供機能ガイド](docs/roadmap-delivery.ja.md)は、このソース版に実装済みの機能、プラットフォーム境界、図、検証を説明します。インストール済みリリースやホスト環境は古い版の可能性があります。独立したネイティブ[Androidアプリ](https://github.com/open-ott-play/ottplay-android)も、マニフェスト索引ではなく言語・役割・ラベルで音声／字幕選択を保持します。実装とリリースはこのフロントエンドとは別です。

[STBソースレビュー](docs/stb-player-improvements.md)では、メディア、リソース、復旧に関する改善、そのソースコードの比較、現在の制限を説明しています。

<a id="debug-hud"></a>

## デバッグHUD

ローカルHUDとサーバーログ永続化は個別のオプトインです。他デバイスのログを収集する前に[診断アクセス、秘匿化、保持](docs/diagnostic-security.md)を確認してください。

次のいずれかでデバッグを有効にします。
- URL：`?debug=1`または`?debug=true`
- ローカルストレージ：`localStorage.setItem("ottplay_debug", "1")`
- ウィンドウプロパティー：`window.__OTT_DEBUG__ = true`
- サーバー：`/debug/config`が`{enabled: true}`を返すとき

デバッグ有効時：
- **D**で画面上のHUDバーを切り替えます（`ottDebugSetHud` / `__ottDebug.toggleHud()`）。
  - INPUT/TEXTAREA/listEditにフォーカスがあるときは無視します。
  - MAG/MapleのPLAY/PREV=68競合を避けるため`e.key`を使います。
- 情報メニュー → **デバッグHUD** → `__ottDebug.toggleHud()`を呼びます。
- 設定管理 → **デバッグHUD**：
  - デバッグ読込済みならHUD表示を切り替えます。
  - 未読込なら`ottplay_debug=1` + `ottplay_debug_hud=1`を設定し、再起動を促します。
- 永続化：`ottDebugSetHud`がHUD状態を`localStorage.ottplay_debug_hud`（"1"/"0"）に保存します。

<a id="capacitor-ios-and-android"></a>

## Capacitor iOSとAndroid

このリポジトリーは共有TypeScriptフロントエンドをCapacitorでiOSとAndroid 7+向けにパッケージ化します。どちらもシステムフォントとnpmで固定したネイティブランタイムを使います。別のAPI 22互換APKはWebView 60以降のAndroid 5.1/6に対応します。両Android APKは署名済みで、適格性確認済みbeta、RC、stableリリースに未署名iOS IPAとともに含まれます。独立Kotlinアプリは引き続き[ottplay-android](https://github.com/open-ott-play/ottplay-android)にあります。

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

[Capacitor設定](docs/capacitor-mobile.md)と[Android配布と遠隔更新](docs/android-distributions.md)を参照してください。

iOSインターフェースは横向きです。設定、プロバイダー構成、遠隔操作の同意、JSON入出力は共有フロントエンドを使います。タブレットのマルチタスクは要求した向きを上書きする場合があります。

iPhoneではチャンネルリストを縦にスワイプして行やページを移動します。上にスワイプすると後のチャンネル、下なら前のチャンネルです。速いフリックは複数ページを進んで徐々に停止し、遅いドラッグは精密に動きます。画面へのタッチやナビゲーションキーで停止できます。1回のタップで指の下のチャンネルを開始し、別の行が選択中でも同じです。スワイプ後に指を離してもチャンネルは開きません。

iPhoneでは動画をインライン再生します。画面下部をタップして番組情報を表示したり、再生を続けたままメニューを開けます。ピクチャーインピクチャーは別の再生オプションです。

デバイスのスモークテスト：[Mode Bチェックリスト](docs/mode-b-device-smoke.md)と`./scripts/smoke-capacitor-device.sh --help`（ビルド／同期はiOSのみ）。Tauriデスクトップ：[デスクトップチェックリスト](docs/mode-b-tauri-smoke.md)。

<a id="installation"></a>

## インストール

| プラットフォーム | パッケージ | 備考 |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Apple SiliconとIntelは別ビルド。Apple署名未設定ならアドホック署名 |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | 各種ディストリビューション |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode または Homebrew Channel](docs/lg-webos-installation.md)。ホスト型プレーヤーのためネットワーク接続が必要 |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode とローカル署名。未署名のTVパッケージで、Family Hubとは別](docs/samsung-tizen-installation.md) |
| **iOS** | AltStore / TestFlight / Xcode経由の`.ipa` | サイドロードのみ。App Store未公開 |
| **Android（共有フロントエンド）** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | 署名済みCapacitorパッケージ。対応Android版を選択 |
| **Android（ネイティブKotlin）** | 独立した[ネイティブアプリ](https://github.com/open-ott-play/ottplay-android) | 公開リポジトリー。アプリとリリース手順は独立 |

対応インストーラーは適格性確認済みGitHubリリースに添付されます：[https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **注意：**Apple署名資格情報がなければmacOSアプリはアドホック署名で、Developer IDや公証は提供しません。Windows/LinuxインストーラーとiOSリリースパッケージは未署名の場合があります。実機iOSへのインストールには署名が必要です。適格性確認済みFull/API 22 Android APKは既定の署名証明書を使用します。ローカルreleaseビルドで署名済みAPKを作るにはkeystoreの設定が必要です。

---

<a id="macos"></a>

### macOS

1. [リリース一覧](https://github.com/open-ott-play/ottplay-foss/releases)から目的のタグを選びます。最新リリースへのショートカットはbetaやRCではなくstableを選びます。
2. Apple Siliconは`OttPlay.FOSS_*_aarch64-apple-darwin.dmg`、Intelは`OttPlay.FOSS_*_x86_64-apple-darwin.dmg`をダウンロードします。アーキテクチャ別のビルドです。
3. `.dmg`を開き、**OttPlay FOSS.app**をアプリケーションにドラッグします。
4. 初回起動前にコピーしたバンドルを検証します。

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

検証成功はバンドルの完全性を確認します。`Signature=adhoc`はApple認証の開発者識別情報がないことを意味し、公証やGatekeeper承認を示しません。信頼できるダウンロードと有効なバンドルでも、初回起動後に**システム設定 → プライバシーとセキュリティ → このまま開く**が必要な場合があります。[Appleの手順](https://support.apple.com/en-us/102445)を参照してください。

「アプリが壊れている」という表示だけでは隔離属性が原因とは限りません。署名検証に失敗したらエラーを保存して修正版を入手してください。ダウンロードしたアプリを再署名したり属性を削除したりして、検証失敗を成功に見せかけないでください。

ZIP版は`OttPlay.FOSS_aarch64-apple-darwin.app.zip`と`OttPlay.FOSS_x86_64-apple-darwin.app.zip`です。展開、ディスクイメージ、Gatekeeperの確認は[macOS署名と成果物検証](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact)を参照してください。チェックアウトからのビルドとローカル導入には[ローカルmacOS提供手順](docs/macos-local-delivery.md)を使います。

---

<a id="windows"></a>

### Windows

1. [リリース](https://github.com/open-ott-play/ottplay-foss/releases/latest)から`.msi`または`.exe`をダウンロードします。
2. インストーラーを実行し、指示に従います。
3. スタートメニューまたはデスクトップショートカットから起動します。

---

<a id="linux"></a>

### Linux

Linux再生にはWebKitGTKに加えてGStreamerのHLS、H.264、AACプラグインが必要です。パッケージはこれらの依存関係を宣言し、AppImageにはメディアフレームワークを同梱します。コーデック検査とブラウザー／ネイティブ受け入れの区別は[Linuxメディアパッケージ](docs/linux-media-packaging.md)を参照してください。

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

### iOSのインストール

実機iOSへのインストールには署名が必要です。未署名リリースIPAにはAltStore Classicを使うか、Xcodeでソースからビルド・署名してください。TestFlightが提供される場合も別途招待が必要です。

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### 選択肢1：AltStore Classic（個人利用に推奨）

AltServerはコンピューターで動作し、AltStore ClassicはiPhone/iPadでIPAを取り込みます。無料Apple Accountで利用できます。

**前提条件：**

- 現行OTT-playには**iOS/iPadOS 15以降**のiPhone/iPadが必要です。
- AltServerを導入したMacまたはWindows PCと、USBデータケーブル。
- 署名用Apple Accountとリリースダウンロード用インターネット接続。

**手順1：AltStoreを初回設定**

1. 公式の[macOS設定](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos)または[Windows設定](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows)に従ってAltServerを導入します。起動後はメニューバー／システムトレイのアイコンを使います。
2. デバイスをUSB接続してロック解除し、コンピューター／デバイスの信頼確認を承認します。MacではFinderに表示されることを確認します。
3. **AltServerメニュー → Install AltStore**でデバイスを選び、署名アカウントの案内を完了してインストール通知を待ちます。
4. デバイスの**設定 → 一般 → VPNとデバイス管理**を開き、要求されたら署名アカウントの開発者項目を信頼します。iOS 16+では**設定 → プライバシーとセキュリティ → デベロッパモード**を有効にし、再起動・確認を完了します。
5. デバイスでAltStoreを開きます。導入済みで正常なら設定を省略し、以下のインポートのためAltServerを起動したままにします。

**手順2：iPhone/iPadに選択したリリースを取り込む**

1. [全リリース](https://github.com/open-ott-play/ottplay-foss/releases)から正確なタグを選び、デバイスのSafariで`ottplay-foss-ios-unsigned.ipa`をダウンロードします。[最新リリースへのショートカット](https://github.com/open-ott-play/ottplay-foss/releases/latest)はstableを選ぶため、betaには一覧を使います。
2. IPAを「ファイル」に保存し、**AltStore → My Apps → +**で選択します。MacでダウンロードしたIPAをAirDropで転送し、ファイルに保存してから取り込むこともできます。Mac上でIPAを開くことは、この取り込み手順ではありません。
3. AltStoreが署名・インストールしている間、AltServerを稼働させUSB接続を維持します。更新には既存と同じ署名アカウントを使い、最初の対処としてアプリを削除しないでください。
4. 取り込み完了を待ち、**My Apps**でOTT-playを確認して起動します。

**代替：リリースURLを直接取り込む**

AltStore導入済みなら、**iPhoneのSafari**で次の形式を入力し、`TAG`を正確なリリースタグに置き換えて**AltStoreで開く**を承認します。

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

これはAltStoreの[インストールURLハンドラー](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift)を使います。同名ファイルが複数ある場合の「ファイル／最近使った項目」の曖昧さを避けられます。URLはリリースページではなくIPA資産を指す必要があります。

例えば以下の取り込みは**2026-09-29**にAltStore 2.3とAltServer 1.8.1で検証済みです。固定の過去例で、最新版へのリンクではありません。

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**更新：**無料アカウントのインストールは7日で失効します。AltServerに接続できる状態を保ち、期限前に**AltStore → My Apps → Refresh All**を使ってください。バックグラウンド更新もAltServerへの接続が必要です。[AltStoreの更新手順](https://faq.altstore.io/altstore-classic/your-altstore)を参照してください。

<a id="verify-the-installed-version-before-retrying"></a>

#### 再試行前にインストール済みバージョンを確認

AirDropの「送信済み」は転送だけ、AltStoreの進捗バーは取り込み開始だけを示します。ミラーリング／USB接続が切れてもインストール失敗とは限りません。IPAを再送する前にインストール済みアプリを確認してください。

Xcodeを導入し、アクティブな開発者ディレクトリーとして選択したMacで、再インストールせずデバイスを調べます。

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

JSONの`result.apps`でOTT-play（`bundleIdentifier`が`play.ott.foss`で始まる）を探し、`version`と`bundleVersion`を選択IPAの`CFBundleShortVersionString`と`CFBundleVersion`とそれぞれ比較します。バンドル識別子にAltStore署名アカウントの接尾辞が付くのは正常です。デバイス報告はローカルに保持してください。

検証済みbeta.9の例は**バージョン`1.1.51`、ビルド`2.2.66`**を報告します。これはインストール確認です。起動、Cloudflareサインイン、プレイリスト読込、再生、PiPは別途デバイスで確認します。

<a id="troubleshooting-ios-installation"></a>

#### iOSインストールのトラブルシューティング

- **AltServerにウィンドウがない／自動起動がタイムアウトする：**メニューバー／システムトレイのアイコンを使います。バックグラウンドアプリなので、通常ウィンドウを繰り返し開こうとしてもIPAは取り込めません。
- **「Could not find AltServer」またはUSBデバイスが利用不可：**AltServerの稼働、携帯のロック解除、コンピューター／デバイスの信頼確認を調べます。MacではFinderへの表示も確認します。接続が切れたら安全なときに再接続し、再試行前に導入済み版を確認します。続く場合は[AltStoreの接続トラブル対処](https://faq.altstore.io/altstore-classic/troubleshooting-guide)に従います。携帯がコンピューターのネット接続を提供している場合、他の作業を中断しないようケーブル／ネットワーク変更を調整してください。
- **iPhoneミラーリングが「iPhone in Use」や「Connecting」のまま：**実機で設定を完了するか、画面をロックし、ロック解除したMacの近くに置いてミラーリングします。携帯をロック解除するとミラーリングは終了しますが、USB信頼／設定には先にロック解除が必要な場合があります。1回再接続しても止まるならミラーリングを終了し、実機で続けます。[Appleのミラーリング要件](https://support.apple.com/en-us/120421)を参照してください。ミラーリングは導入の必須条件ではありません。
- **ミラーリングでURLのラテン文字が消える／キリル文字になる：** **Macの入力ソースをABC／英語**に切り替えます。ミラーリングにフォーカスして**Control–Space**を押し、iPhoneハードウェアキーボードに**English (US)**を選びます。MacとiPhoneの入力ソースは異なり得ます。検証したセッションではMacだけの変更では不足しました。入力欄を消してURLを再入力し、送信前に確認します。
- **ミラーリングへの貼り付けが止まる／想定外の文字になる：**入力欄を消し、iPhoneのEnglish (US)入力で短い塊をゆっくり入力するか実機でURLを入力します。高速入力は文字の欠落や重複を起こし得るため、保存前に全アドレスを確認します。途中まで貼られたURLを送らないでください。実際の導入セッションでも貼り付けは失敗しました。直接URL方式の前提ではありません。
- **ファイル／最近使った項目に同名IPAが複数ある：**正確な保存場所か、上記のタグ付き直接URLを使います。分かりやすくローカルコピー名にタグ／ビルドを含めても構いません。名前変更では内容は変わりません。
- **導入済みアプリが開かない：**携帯の開発者信頼／デベロッパモードの案内に従います。AltStoreで有効期限を確認し、必要なら更新します。まだ失敗する場合は実際のエラーを記録してください。接続エラーだけを理由に削除・再導入しないでください。
- **OTT-playは開くが、保護されたプレイリストが携帯回線で失敗：**導入とソース認証は別です。**設定 → 設定管理 → ソースアクセス**で設定済みソースにサインインしてからリストを再読込します。必要な生体認証／パスキー／メールコードは実機で完了します。ソースは[iOS Access統合](docs/ios-source-access.md)への対応が必要で、アプリ導入によってIP許可リストを回避できるわけではありません。
- **信頼されたWi-Fiでパスキーを要求される：**iOS Access対応ソースでは、最初に元のソースをログインなしで試し、拒否後に認証済みモバイル入口を使います。IPv6を含め、ソースが実際に見る公開IPを確認します。自宅IPv4の許可は別のIPv6、VPN、携帯回線アドレスには及びません。ネット変更と再起動で一時的な経路優先設定は消えます。一般的なネット／サーバーエラーでサインインを開始すべきではありません。
- **サインインは出なくなったがチャンネルが空：**有効な保存セッションは確認なしで再利用します。以前の読込失敗やサーバー修正後は、リストを再読込するか、アプリを完全終了して1回開き直します。続く場合はソースがHTMLログイン画面やJSONエラーではなくプレイリストを返すか確認します。表示エラーとHTTP状態を記録し、資格情報、Cookie、Accessトークンを含むソースURLは共有しないでください。
- **チャンネルは読めるが動画がバッファ中／`SRC_NOT_FOUND`：**リスト読込と動画再生は別の検査です。サインイン後に1回チャンネルを再試行し、続く場合はHLSマニフェスト、セグメント応答、コーデック対応を確認します。このエラーだけではエンジン変更や再導入が有効とは言えません。

<a id="option-2-testflight-if-available"></a>

#### 選択肢2：TestFlight（提供される場合）

TestFlightの招待が公開された場合、App StoreからTestFlightを入れ、デバイスで招待を開いて**インストール**をタップします。GitHubからIPAを取得してもTestFlightの招待にはなりません。

<a id="option-3-xcode-for-developers"></a>

#### 選択肢3：Xcode（開発者向け）

[ビルドして開く](docs/capacitor-mobile.md#build-and-open)に従い、Xcodeの**App**ターゲットを選び、**Signing & Capabilities**で開発チームを設定し、接続したデバイスを選んでビルド／実行します。要求された信頼確認とデベロッパモードを完了してください。未署名IPAをXcodeのDevicesウィンドウに取り込んでも、不足する署名識別情報やプロビジョニングプロファイルは補われません。

---

<a id="android-application"></a>

### Androidアプリ

共有プレーヤーUIには、このリポジトリーのリリースからFull Capacitor APKを選びます。Android 5.1–6にはAPI 22互換APKを使い、WebView 60以降が必要です。更新時にはアプリ識別情報と署名証明書を維持して既存プロファイルを保持してください。[ビルド手順](android/README.md)と[配布、署名、遠隔導入](docs/android-distributions.md)を参照してください。

別の[ottplay-androidリポジトリー](https://github.com/open-ott-play/ottplay-android)にはネイティブKotlin/Composeアプリがあります。独自の識別情報、設定、リリース手順を持ち、Capacitor版をそのまま置換しません。過去のリリース資産も引き続き利用できます。

---

<a id="quick-start"></a>

## クイックスタート

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

ブラウザースモークテストには同じ版を自分でデプロイしてください。

Node 22とRust stableツールチェーンを使います。静的資産が利用できるようリポジトリールートからサーバーを起動します。ネイティブビルドには後述の各プラットフォーム用ツールが必要ですが、サーバーのみのビルドでは不要です。

初回は**デモを試す**を選ぶか、**設定 → プロバイダー変更 → M3U / M3U8プレイリスト**を開きます。**プレイリスト選択**でスロットを選び、**プレイリストURL**を入力・保存して**プレイリストを読み込む**を選びます。リストやプロバイダーアカウントは利用者が用意します。アプリは有料チャンネル契約を提供しません。

<a id="mode-a-companion-smoke"></a>

## Mode A補助サーバーのスモークテスト

curlによるMode A補助サーバー（`ottplay-server` / `archive/server.py`の同等性）の検査です。インデックス、静的ディレクトリー、`/logo`、`/version`、任意の`/epg`、取得を行わない`POST /m3u/cp.php`の検査を含みます。

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

検査定義は`scripts/modea-smoke-checks.json`にあり、秘密情報はありません。コマンドキュー／`local_proxy.py`（:8081）は、存在する場合`scripts/smoke-command-queue.sh`で別途検査します。

<a id="classic-stalker--ministra-portals"></a>

## 従来型Stalker / Ministraポータル

**Stalkerポータル**を選び、プロバイダー発行のMACと完全なURL（例：`http://provider.example/stalker_portal/c/`）を入力します。`/c/index.html`、`/stalker_portal`、`/server/load.php`、`/load.php`、`/portal.php`のURLは従来のMAGプロトコルを選択します。既存のサーバーだけの設定はJSON-RPCを維持します。共有Stalkerコアでプロファイル、ジャンル、ページ分割したライブチャンネルを読み込み、その後、従来型プロトコルの`type=vod`映画と階層化されたエピソードをバックグラウンドで検出します。フォルダーパスは通常のチャンネルリストのカテゴリーとなり、利用可能な説明やポスター、安定したグローバルお気に入りは同じメディアインターフェースを使用します。[カタログの動作と制限](docs/stalker-media.md)を参照してください。

ブラウザー版をセルフホストする場合、要求は補助サーバーの`/stalker/api`を通り、ネイティブ版は既存HTTPトランスポートを使います。ホスト環境のブラウザー版には、[専用リレー](docs/stalker-relay.md)を経由する経路の明示的な設定が必要です。ブラウザーとサーバーの資産は同時更新が必要です。

ライブ再生はストリームを開く際に一時的なチャンネルコマンドを解決します。チャンネル変更、停止、PiP、プロバイダー変更は古い解決処理を取り消します。明示的な一時でないHTTP(S)コマンドは直接再生します。短期EPGに対応します。従来型ポータルのアーカイブと独立した`type=series`形式は、このプロバイダーでは提供していません。既存のJSON-RPCアーカイブ／ガイド動作は変わりません。補助サーバーの経路を使う非公開LANポータルには、他の補助プロキシー経路と同様、正確な`OTTPLAY_PROXY_LAN_ORIGINS`の登録が必要です。

Infomirの公開デモは`http://middleware-stalker.com/stalker_portal/c/`です。2026-09-26にはライブカタログ3件を返しましたが、メディアエンドポイントは利用不能でした。再生回帰には管理できるポータル／メディアのテストデータを使ってください。

<a id="m3u-stream-proxy-header-smoke"></a>

## M3Uストリームプロキシーのヘッダースモークテスト

Mode A補助サーバーの`POST /m3u/cp.php`が制御可能なエコーURLを取得するときの上流要求ヘッダーを比較します。既定はローカルモックで、IPTVプロバイダーや秘密情報は使いません。

契約（`src-rs/core/src/m3u.rs` + `archive/server.py`）：
- **User-Agent**だけを注入します（既定`OTT-play-FOSS/1.0`、または`webos` / `tizen` / `viera` / `mag` / `dune`プリセット）。
- **Referer**は注入**しません**（Capacitorの`M3UProxy`は注入しますが、Mode Aはしません）。
- `url`先頭の`@`を除去します（プロバイダーのjQueryフォーム）。

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

終了コード：`0`成功、`1`待受なし、`2`ヘッダー／HTTP不一致、`3`使い方／依存関係。`smoke-modea-companion.sh` / `smoke-command-queue.sh`と関連する検査です。

<a id="logo-concurrent-bench-smoke"></a>

## ロゴ並行ベンチマークのスモークテスト

Mode A補助サーバーに並行して`GET /logo/<id>.svg`（任意で`?ch=`）を送り、遅延を検査します。成功／失敗数とp50/p95/p99を報告します。既定はCI内での実用負荷（`CONCURRENCY=200`、`TOTAL=1000`）で、1万件の長時間負荷は任意です（`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`）。

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

終了コード：`0`成功、`1`待受なし／接続失敗、`2`高エラー率、`3`使い方。`smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`と関連する検査です。

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## XMLTVキャッシュ更新／ウォームアップのスモークテスト

`src-rs`の実際のAPIに基づき、Mode A補助サーバーのXMLTV/EPGキャッシュを検証します。存在しないAPIは仮定しません。

- メモリー内の`EPG_CACHE`を`GET /epg/:hash`で提供し、常に`{"epg_data":[...]}`（HTTP 200）を返します。
- プロセス起動後、HTTP開始を遅らせずバックグラウンドで`EPG_URLS`を取得します。取得完了ごとに次の更新まで**2時間**待ちます。
- `DATABASE_URL`設定時は任意でSQLite永続化を行います。公開キャッシュ状態エンドポイントはありません。
- 任意の再起動後、`GET /health` → `OK`でHTTP準備完了を確認します。`--strict-epg`と`--epg-hash`では、同じ`--warmup-timeout`内に対象チャンネルの空でないEPGも待ちます。

既定経路はcurlだけで、**プロセスを終了しません**。自動終了＋再起動には`--restart-cmd` / `RESTART_CMD`を渡すか、`--help`内の手動`launchctl`手順に従ってください。

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

終了コード：`0`成功、`1`待受なし、`2`アサーション／ウォームアップ失敗、`3`使い方。`smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`と関連します。

<a id="mode-a-e2e-play-path-smoke"></a>

## Mode A E2E再生経路のスモークテスト

補助サーバー側の**再生経路／ストリーム準備**検査です。HTTPのみで、画面付きUI E2Eでは**ありません**。稼働中のMode A補助サーバーについて次を確認します。

- ヘルスチェックまたはインデックスへの到達性。
- 静的プレーヤーシェル資産（`/`、`/styles/player.css`、`/js/jquery-…`、`/f/…`）。
- `EPG_HASH`設定時、任意で`GET /epg/<hash>.json`。
- 秘密情報のないJSONデータ（空リスト＋合成チャンネル1件）による`POST /m3u/match-channels`。
- ストリームプロキシーの**再生**：管理可能なメディア（既定はローカルHLSリスト、または`MEDIA_URL`）への`POST /m3u/cp.php`でHTTP 200、空でない本文、期待する`Content-Type`を検査し、最初のバイトがプロキシーを通ることを確認。

非公開IPTV資格情報は使いません。`smoke-modea-companion.sh`（存在確認）、`smoke-m3u-stream-proxy-headers.sh`（UA/Referer）、`smoke-xmltv-cache-refresh.sh`と関連します。

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

終了コード：`0`成功、`1`待受なし、`2`アサーション失敗、`3`使い方／依存関係。

<a id="capacitor-device-smoke-mode-b"></a>

## Capacitorデバイスのスモークテスト（Mode B）

Mode B Cap用のシミュレーター／エミュレーター（任意で実機）**チェックリスト**です。Mode A補助サーバーのHTTP検査ではありません。UI合格は人が判断し、補助ツールはツールチェーン、ネイティブディレクトリー、緩やかなコマンドキューcurl検査を自動化します。

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

詳細：[docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md)。`smoke-command-queue.sh`（Capループバック）と関連します。上のMode A検査と混同しないでください。

<a id="tauri-desktop-smoke-mode-b"></a>

## Tauriデスクトップのスモークテスト（Mode B）

Mode B Tauriのウィンドウ、チャンネル再生、PiPを確認するデスクトップチェックリストと補助ツールです。Mode A補助HTTPやCapデバイス検査ではありません。

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

詳細：[docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md)。ローカルスモークではApple開発者資格情報は任意です。パッケージ済みMacアプリには[アドホック署名](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials)を使います。起動、再生、PiPは引き続き人が受け入れ確認します。

<a id="docker"></a>

## Docker

マルチアーキテクチャー（amd64/arm64）イメージは候補OCIアーカイブとしてビルドします。レジストリー公開は承認済みstableアーカイブを再ビルドせずDocker Hubに昇格します。[運用手順書](docs/release-workflow.md)を参照してください。

サーバーバイナリーは**musl**（Alpine）上でビルドし、Alpine上で配布します。GLIBC_2.38+は**不要**です。これにより`alvit/ottplay-foss`はSynology DSM Docker（x86_64）や古いglibcのホストでも実行できます。

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

安定版レジストリータグは`X.Y.Z`です。`latest`の更新は版付きイメージ公開後の独立した明示オプションです。mainへのpushやGitタグはイメージを公開しません。

<a id="build-from-source"></a>

## ソースからのビルド

プレーヤーのドメイン規則は`vendor/ottplay-core.js`の固定Kotlinマルチプラットフォーム成果物から得ます。ガイド、アーカイブ、プレイリスト、プロバイダー、永続状態、再生判断はFOSS2およびネイティブAndroidと実装を共有します。ブラウザー／TV、Swift、RustアダプターはデバイスAPI、コーデック、ネットワーク、UI効果を担当します。ブラウザー成果物はES5構文と対応する旧API初期化を維持します。`npm test`、`check:bundle`、`check:es5`が統合を検証し、成果物マニフェストはソース／出力ハッシュを記録します。

Control-serverとSWOPプロトコルの検証器は、版管理された`contracts/ottplay-wire-v1.json`から生成します。検査済み生成器の証跡と不変の互換性データにより、利用側ごとのポリシー複製を防ぎます。

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

## デバイス検出

プレーヤーは24種類のデバイスに対応します。URL `/f/{device_id}/`を優先し、次にUser-Agentで検出します。

| デバイスID | デバイス |
|---|---|
| `pc` | PCブラウザー |
| `pc2` | videojs Webプレーヤー |
| `nodejs` | Windowsアプリ（Electron） |
| `lg/webos` | LG WebOS TV |
| `samsung/tizen` | Samsung Tizen TV |
| `samsung/maple` | Samsung Orsay TV |
| `mag` | Infomir MAGボックス |
| `dune` | Dune HDボックス |
| `android` | Android TV／タブレット |
| `hbbtv` | HbbTVテレビ |
| `panasonic` | Panasonic Viera TV |
| `philips` | Philips TV |
| `sony` | Sony TV |
| `sharp` | Sharp TV |
| `toshiba` | Toshiba TV |
| `hisense` | Hisense TV |
| `skyworth` | Skyworth TV |
| `tcl` | TCL TV |
| `vewd` | Vewdデバイス |
| `spark` | Spark受信機 |

<a id="push-command-system"></a>

## プッシュコマンドシステム

独立した複数デバイス用サービスには[OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server)と、**設定 → リモート制御**内の**コマンドサーバー**を使います。IP／アドレスとこのプレーヤーのデバイスアクセスコードを入力し両方を保存すると、音量やチャンネルなどのコマンドのポーリングが自動開始します。ポート未指定のIPはHTTP 8081を使います。アドレスを消すか**切断**を選ぶと停止します。この外向き接続は確認応答付き配送に対応し、ローカルリスナーは不要です。[接続と互換性の詳細](docs/remote-command-server.md)を参照してください。以下の例は既存のローカルプロキシー／リスナーモードです。

**コマンドサーバーを検索**では、デバイストークンをコピーせずにコントローラーを見つけ、オペレーターに承認を要求できます。TauriはまずネイティブDNSを確認し、結果が空の場合は明示的に設定されたデプロイ用プロファイルにフォールバックできます。ブラウザー、LG、Capacitorのプレーヤーはブラウザープロファイルの経路を使用します。Homeの検出メタデータは、コントローラーとは独立してhere.nowに配置できます。汎用ビルドにはこのHomeプロファイルは自動的に含まれず、更新によって保存済みの接続が置き換わることもありません。[プラットフォームごとの動作、プロファイルの設定、トラブルシューティング](docs/remote-command-server.md#discovery-and-one-time-approval)を参照してください。

ローカルHTTP遠隔制御はブラウザー／OTTサーバープレーヤー、Tauri、Capacitorのすべてで**既定は無効**です。**プレーヤー設定 → リモート制御**で有効にすると秘密のデバイスコードを生成します。コマンドは`"command"`フィールド付きJSONオブジェクトで、HTTP要求には`Authorization: Bearer <device-code>`が必要です。

<a id="architecture"></a>

### アーキテクチャ

<a id="local-command-url-recommended"></a>

#### ローカルコマンドURL（推奨）

**プレーヤー設定 → リモート制御**で**ローカルHTTP遠隔制御**を有効にし、生成された**デバイスコード**をコピーして以下のプロキシーに設定します。**ローカルコマンドURL**をプロキシーのコマンドエンドポイントにします。有効な間、10秒ごとにAuthorizationヘッダーへコードを付けてポーリングします。URLを設定するだけでは制御は有効になりません。

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### デバイスUUID

既存のデバイスUUID（例：`dev_a1b2c3d4e5`）は公開ルーティングメタデータで、認証資格情報ではありません。別の**デバイスコード**はローカルHTTP制御有効化時に安全に生成し、このデバイスに保持します。クラウド設定ではコピーしません。無効化するとポーリング／リスナーは停止します。再有効化で新しいコードを生成するため、プロキシーや統合を更新して古い資格情報を失効させてください。

TauriとCapacitorはこの設定のオプトイン後にのみループバックHTTPリスナーを開始します。転送プロキシーは表示されたコードをBearerトークンとして送る必要があります。Mode Aは後述の別途設定した`local_proxy.py`キューを使います。

<a id="remote-text-entry-swop"></a>

#### 遠隔文字入力（swop）

目的はTVと携帯が**異なるネットワーク**にある場合、Cloudflare Workerのセッション引き継ぎ経由で♥™／遠隔仮想キーボードに携帯から入力することです。

- Workerリポジトリー：[ottplay-swop](https://github.com/open-ott-play/ottplay-swop)。
- **インストール承認：**プレーヤーは自サーバーと同一オリジンの`/swop`リレーへ送信します。サーバーが非公開インストールトークンを付けます。登録サーバーオリジンの全クライアントが遠隔入力を利用できます。デバイスUUIDはセッション識別用で、デバイス別許可リストは不要です。
- 設定：`swopBaseUrl`（空なら♥™は「未設定」で何もしません）。**設定 → リモート制御**（キー**2**）で編集するか、運用者による導入ではGit対象外の`/local/swop.json`から注入します。
- `POST /session`には`clientId`、`caption`、`draft`を、`POST /val`には`clientId`、`code`、返された`sessionToken`を含めます。携帯URLには別の書き込みトークンがあります。セッション読み取りトークンはブラウザーメモリーに保持します。
- **ローカル導入：**Workerにインストールと正確なLAN/localhostオリジンを登録後、`SWOP_BASE_URL`と`SWOP_INSTALLATION_TOKEN`を設定します。`scripts/install-ottplay-local-service.sh`は非公開mode-0600のlaunchd plistに保持します。公開`/local/swop.json`には`{"swopBaseUrl":"/swop"}`だけを入れます。公開資産にインストールトークンを置かないでください。
- **静的ホスティング：**同じ2エンドポイントにサーバー側の認証プロキシーを設定します。インストールトークンはホスティングサービスのsecretに保持します。公開プレーヤーファイルのコピーではサーバー資格情報はコピーされません。

> 中央OTTサーバーでは`/api/webhook/commands`、`/webhook/poll`、`/webhook/notify`、コマンドヘルス別名を全HTTPメソッドで無効化しています。Mode Aでは別のコマンドサーバーか、明示的に設定した認証付き`local_proxy.py`を使います。中央サーバーにブロードキャストキューはありません。

<a id="available-commands"></a>

### 利用可能なコマンド

以下はローカルプロキシーURLとして`http://192.168.1.50:8081/api/webhook/commands`を使います。実アドレスに置き換え、`OTTPLAY_QUEUE_HTTP_TOKEN`をプレーヤーでHTTP制御を有効にした後の**デバイスコード**に設定します。プロキシーにも同じコードを設定してください。

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — 通知ポップアップ表示

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| フィールド | 型 | 既定値 | 説明 |
|---|---|---|---|
| `message` | 文字列 | 必須 | 表示する文字 |
| `popup_duration` | 数値 | 5 | 右上に表示する秒数 |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — リスト位置でチャンネル変更

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| フィールド | 型 | 既定値 | 説明 |
|---|---|---|---|
| `channel_number` | 数値 | 必須 | 1始まりのチャンネル位置 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — 名前の全部または一部で変更

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

大文字小文字を区別しない部分文字列検索で、最初の一致を使います。

| フィールド | 型 | 既定値 | 説明 |
|---|---|---|---|
| `channel_name` | 文字列 | 必須 | チャンネル名またはその一部 |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — ランダムなチャンネルに変更

この従来のコマンドは、現在のリストまたはカテゴリから選択可能なチャンネルを選びます。チャンネル番号と範囲は、そのリスト内の位置を表します。[安全なランダム選択のルール](docs/remote-command-server.md#safe-random-playback)を参照してください。

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

| フィールド | 型 | 既定値 | 説明 |
|---|---|---|---|
| `random_range` | [開始, 終了] | 現在のリスト | 1始まりの範囲 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — IPTVプロバイダー変更

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| フィールド | 型 | 既定値 | 説明 |
|---|---|---|---|
| `provider` | 数値 | 必須 | プロバイダー配列の索引（0=m3u、1=stalker、2=xtreamなど） |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — 新しいM3Uプレイリストを読込

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| フィールド | 型 | 既定値 | 説明 |
|---|---|---|---|
| `playlist` | 文字列 | 必須 | M3UプレイリストURL |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — プロバイダー設定更新

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| フィールド | 型 | 既定値 | 説明 |
|---|---|---|---|
| `provider_settings` | 文字列 | 必須 | プロバイダー設定のJSON文字列 |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — 音量設定／調整

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

音量制御非対応のクライアントでは何も通知せず無視します。

| フィールド | 型 | 既定値 | 説明 |
|---|---|---|---|
| `volume` | 数値 | — | 絶対音量0–100 |
| `volume_step` | 数値 | — | 相対変更（例：+10、-5） |

<a id="player-standby-restart-and-exit"></a>

#### プレーヤーの待機、再起動、終了

ローカルプロキシーの確認応答なしwebhookキューは`exit_player`や型付き待機／復帰要求に非対応です。プレーヤーを[コマンドサーバー](docs/remote-command-server.md)に接続してCLIを使います。

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

`d1`を登録プレーヤーの別名に置き換えます。`stop`は`standby`、`start`と`wake`は`go`の別名です。Goには起動中で接続済みのプレーヤーが必要で、閉じたアプリの起動やオフライン機器の復帰はできません。ネイティブ終了のないブラウザー／TVは非対応と返します。待機中も遠隔ポーリングは続き、無関係なホスト／共有サーバー作業は停止しません。

standby/go後は`ott d1 status`で待機／バックグラウンド状態を調べ、再生再開は別途検証します。再読込後は`ott d1 doctor`で新ランタイムを確認します。終了後はOSでアプリプロセス停止を確認してください。遠隔タイムアウトだけでは終了を証明できません。コマンド受理だけでもこれらの結果は確認できません。

<a id="local-proxy-server"></a>

## ローカルプロキシーサーバー

`local_proxy.py`は1プレーヤー用の独立した認証付きコマンドキューです。既定の起動ではポートを開かず終了します。各インスタンスはプレーヤー生成コードを使い、複数プレーヤーには個別インスタンス／ポートが必要です。`device_id`クエリーは互換性メタデータとして受け入れますが、認証や他デバイスの選択には使いません。

<a id="start-the-proxy"></a>

### プロキシー起動

1. プレーヤーの**ローカルHTTP遠隔制御**を有効にし、**デバイスコード**をコピーします。
2. プロキシーホストでコードと、プレーヤーを配信する正確なオリジン（スキーム、ホスト、ポート、パスなし）を設定します。

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. プレーヤーの**ローカルコマンドURL**を`http://192.168.1.50:8081/api/webhook/commands`にします。

既定のバインド先は`127.0.0.1`で、例はLANアクセスを明示的に有効化します。`OTTPLAY_QUEUE_HTTP_ORIGINS`は正確なブラウザーオリジンのカンマ区切り許可リストです。HTTPSで配信するプレーヤーにはHTTPSリバースプロキシーを使い、混在コンテンツ規則でポーリングを許可できるようにします。コードを秘密に保ち、URLには入れないでください。コードを再生成したら新しい値でプロキシーを再起動します。プレーヤーを無効にしただけでは独立管理のプロキシープロセスは停止しません。

<a id="endpoints"></a>

### エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| `POST` | `/api/webhook/commands` | コマンドをキューに追加 |
| `GET` | `/api/webhook/commands` | キューのコマンドを取得（プレーヤーのポーリング） |
| `POST` | `/webhook/notify` | 認証付き互換別名 |
| `GET` | `/webhook/poll` | 認証付き互換別名 |

送信と取り出しの両方に、一致するBearerデバイスコードが必要です。未認証のブロードキャストエンドポイントはありません。コマンドは60秒で失効し、プロキシーごとに最大50件を保持します。

最大16接続を並行処理するので、アイドルなブラウザー接続や未完了要求が他のコマンドを遅らせません。各ソケットの無操作タイムアウトは5秒です。全ワーカー使用中は追加接続を閉じます。追加と取り出しはワーカー間でアトミックです。

<a id="smoke-script-all-modes"></a>

### スモークスクリプト（全モード）

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Androidエミュレーター／デバイスでは先に`adb forward tcp:18081 tcp:18081`を実行します。Cap/Tauriはループバック専用なので、LAN上のHome AssistantにはこのMode Aプロキシーを使います。詳細は`docs/capacitor-mobile.md`のスモークテスト節です。

<a id="cors"></a>

### CORS

ブラウザー要求は`OTTPLAY_QUEUE_HTTP_ORIGINS`からのみ許可します。許可オリジンのプリフライト`OPTIONS`にはトークン不要ですが、実際のGET/POSTはすべてBearerコードが必要です。ワイルドカードと`null`オリジンは受け入れません。Home Assistantなど非ブラウザークライアントはOriginを省略できますが、認証は必要です。

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### 例：Home Assistant webhook → ローカルプロキシー → プレーヤー

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

### Home Assistant自動化例

ポップアップ、チャンネル、音量の例はローカルプロキシーを使います。Home Assistantの`secrets.yaml`内の`ottplay_device_authorization`を、有効なプレーヤーに表示されたコードを使って`Bearer <device-code>`に設定します。

夜間待機には別の[コマンドサーバー](docs/remote-command-server.md)を使います。例のURLと`DEVICE_UUID`を自分のコントローラーアドレスと登録デバイスIDに置き換えます。ローカルCLIの別名`d1`はデバイスIDではありません。`secrets.yaml`の`ottplay_control_authorization`を`Bearer <controller-admin-token>`にします。これはプロキシーのデバイスコードとは別の資格情報です。Home Assistantの[RESTful Command](https://www.home-assistant.io/integrations/rest_command/)と[secrets](https://www.home-assistant.io/docs/configuration/secrets/)を参照してください。

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

`standby_request`は自動化トレース用のHTTP応答を含みます。HTTP 202はキュー投入だけを示します。`content.id`を保持し、同じコントローラー資格情報で`GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID`をポーリングして応答を待ちます。新たな`status`要求で`player.standby`と`player.background`を確認します。待機有効、`suspended`、保留ゼロなら、プレーヤーが追跡する処理が完了したことを示します。待機を解除するには同じ型付き要求で`"operation":"wake"`（`ott d1 go`）を使います。タイムアウト後に変更操作を無条件で繰り返さないでください。コントローラーの[要求／応答API](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1)と[待機の意味](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake)を参照してください。

<a id="server-api-reference"></a>

## サーバーAPIリファレンス

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Webhookエンドポイント（Rust `ottplay-server`）

RustサーバーとアーカイブされたPython代替実装は、コマンドエンドポイントをHTTP 403で拒否します。`/api/webhook/commands`、`/webhook/notify`、`/webhook/poll`、コマンドヘルス別名は追加、ブロードキャスト、取り出しを行いません。汎用フィードバックAPIで予約ルートを上書きできません。Mode Aのコマンド配送には、上記の別途設定したコマンドサーバーか認証付きローカルプロキシーを使います。

<a id="other-endpoints"></a>

### その他のエンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/epg/<hash>.json` | チャンネルのEPGデータ |
| `GET` | `/logo/<id>.svg` | 生成されたチャンネルロゴ |
| `GET` | `/version/<path>` | ファイルバージョンハッシュ |
| `POST` | `/m3u/match-channels` | チャンネルとEPGの照合 |
| `POST` | `/m3u/match-logos` | チャンネルロゴの照合 |
| `POST` | `/m3u/cp.php` | ストリームプロキシー |
| `GET/POST` | `/feedback/` | フィードバック記録 |
| `GET` | `/tmdb/*` | TMDb APIプロキシー |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## プロジェクト構造

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

## STBキー割り当て

- **Samsung Tizen**：`RETURN=10009`、`ENTER=13`、色403–406。
- **Samsung Maple**：方向パッド4/5/6/8、元のSDKコード。
- **LG WebOS**：`RETURN=461`、HbbTV互換の色。
- **LG NetCast**：`RETURN=8`、HbbTVコード。
- **MAG**：`RETURN=8`、MAC用gSTB API。
- **Dune HD**：標準コード、Dune API。
- **Android TV**：Androidキーコード（`BACK=4`、`DPAD_*` 19–22、`ENTER=66`）。
- **HbbTV/Panasonic/Philips/Sonyなど**：HbbTVコード（`RED=403`、`BLUE=406`、`VOL_UP=447`）。

<a id="documentation"></a>

## ドキュメント

- [ドキュメントwiki](./docs/wiki/Home.ja.md) / [ロシア語wiki](./docs/wiki/Home.ru.md) — タスク別ナビゲーションと保守規則。
- [実装報告](./docs/implementation-report.ja.md) / [ロシア語の過程と結果](./docs/implementation-report.ru.md) — カラー図、検証済み動作、実測コスト、リリースゲート。
- [提供機能ガイド](./docs/roadmap-delivery.ja.md) / [ロシア語の新機能ガイド](./docs/roadmap-delivery.ru.md) — 機能、制限、検証。
- [88のUI言語のクイックスタート](./docs/readme/README.md) — 配布UI翻訳から生成。本マニュアルと対になる機能ガイドは[24のドキュメント言語](docs/manual-translations.md)に対応。
- [画質制限とライブ復旧](./docs/playback-stream-policy.ja.md) / [ロシア語](./docs/playback-stream-policy.ru.md)。
- [手動XMLTV紐付けとクラシックUIのアクセシビリティ](./docs/guide-binding-accessibility.ja.md) / [ロシア語](./docs/guide-binding-accessibility.ru.md)。
- [ホスト型音声・動画確認](./docs/audio-video-check.ja.md) / [ロシア語](./docs/audio-video-check.ru.md)。
- [Xtreamメディアライブラリー](./docs/xtream-media.ja.md) / [ロシア語](./docs/xtream-media.ru.md)。
- [同一ソースのデバイス引き継ぎ](./docs/remote-handoff.ja.md) / [ロシア語](./docs/remote-handoff.ru.md)。
- [復旧可能なローカル設定](./docs/settings-recovery.ja.md) / [ロシア語](./docs/settings-recovery.ru.md)。
- [ブラウザー世代、OS、厳密なリリース候補検証](docs/browser-compatibility.ja.md) / [ロシア語](docs/browser-compatibility.ru.md)。

- [プレーヤーアーキテクチャ](./docs/architecture.md) — ランタイム責任、プロバイダー統合、再生、ガイド、デバイスアダプター、ビルド契約。
- [従来ES5のビルドパイプライン](./docs/build-pipeline.md) — コンパイル、互換性検査、成果物サイズ制限。
- [ランタイム資産名とデプロイ移行](./docs/asset-layout.md) — Webとネイティブ共通の分かりやすいパス。
- [リモートワークベンチ](./docs/remote-workbench.md) — UI／メディア検査、操作証跡、保存済み証拠。
- [ランタイム診断](./docs/runtime-debug.md) — エラー履歴、フレーム／ループカウンター、Capacitor/Tauriネイティブ指標、サーバーデバッグ。
- [ローカルmacOS提供手順](./docs/macos-local-delivery.md) — チェックアウトからのビルド、ローカル導入、検証。

<a id="license"></a>

## ライセンス

[MIT](LICENSE) — 自由なオープンソースです。プロバイダーのコンテンツと第三者依存関係は、それぞれの権利とライセンスを保持します。

PlxNative を基にした別アプリケーション [OTTPlay native webOS](docs/native-webos.md) は、対応するソースコードとともに **GPL-3.0-or-later** で配布されます。
プロジェクトのルートにある MIT ライセンスによって、このネイティブアプリケーションやそのパッチのライセンスが変更されることはありません。

<a id="desktop-updater--notarization-mode-b"></a>

## デスクトップ更新機能／公証（Mode B）

[デスクトップ署名と更新ガイド](docs/tauri-updater-notarize.md)は、macOSアドホック署名、任意のDeveloper ID／公証、バンドル検証を説明します。Apple資格情報がないリリースCIはアドホック署名を使います。更新機能の署名は別で、本番の自動更新は未設定です。

<a id="local-mac-build-helpers"></a>

## ローカルMacビルド補助

[docs/local-build-scripts.md](docs/local-build-scripts.md)を参照してください。

<a id="privacy"></a>

## プライバシー

ローカル設定、設定済みサービス、利用者の選択は[プライバシーポリシー](docs/privacy-policy.md)を参照してください。プライバシー／サポート窓口：[alvit.work@gmail.com](mailto:alvit.work@gmail.com)。

Studio 2026が既定UIテーマです。ClassicとPLi-HDも選択でき、保存済み設定を維持します。[インターフェース設定](docs/interface-settings.md)を参照してください。PLi-HDはVali、littlesat、VU+NL、Milo、上流貢献者に謝辞を記しています。英語の経緯と出典は[インターフェースの謝辞と設計史](docs/interface-history.md)にあり、プレーヤーの情報メニューからも開けます。

<a id="demo-video-editing"></a>

## デモ動画の編集

ローカルの[video-useワークフロー](docs/demo-video.md)でデモ録画を準備・編集します。補助ツールは生成メディアをすべてGit外に保持します。

<a id="plex-media-library"></a>

## Plexメディアライブラリー

各プレーヤーは**Plex**プロバイダーからPlexアカウントまたはPlex Media Serverへ接続できます。この統合はPlexを使い、Synologyはメディアサーバーのホストの一例です。アクセス可能なすべての動画と音楽がチャンネル一覧に自動追加され、カテゴリー選択でライブラリー・フォルダー・シリーズ別に絞り込めます。最初の利用可能なバッチから再生し、バックグラウンド読込、標準検索、シャッフル／リピート操作に対応します。OTTサーバーへのPlex設定は不要です。[Plexサインインと直接再生](docs/plex-provider.md)を参照してください。

![Plexの読み込み、ファイル操作、停止ライフサイクル](docs/images/plex-playback-lifecycle.svg)

[図解付き信頼性レビュー](docs/plex-provider.md#reliability-review-process-and-results)は、読込／キャンセル規則、完全なカタログとファイル切り替えの修正、Chromium/WebKitでの実測検証を説明します。

任意のOTTサーバー統合でも、独立NASライブラリー入口とM3U出力を通じ、既存Plexサーバーのカタログと対応再生を提供できます。[サーバー側ライブラリー設定とクライアントアクセス](docs/synology-library.md)を参照してください。

<a id="related-repositories"></a>

## 関連リポジトリー

- [ottplay-core](https://github.com/open-ott-play/ottplay-core)は共有JVM/ES5ドメインロジック、通信契約、FOSS2クライアントを担当します。このプレーヤーは生成成果物を利用します。共通変更にはコア提供ガイドに従ってください。
- [ottplay-android](https://github.com/open-ott-play/ottplay-android)は独立したネイティブKotlin/Composeアプリで、独自の導入・リリース識別情報を持ちます。
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server)はセルフホスト遠隔コマンドを、[ottplay-swop](https://github.com/open-ott-play/ottplay-swop)は任意のWorker文字入力トランスポートを提供します。
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine)はブラウザーデモのホスト設定、デモメディア、公開検証を担当します。

<a id="project-maintenance"></a>

## プロジェクト保守

[貢献とテスト要件](CONTRIBUTING.md)、[脆弱性報告方針](SECURITY.md)、[セキュリティ設計](docs/security-design.md)、[OpenSSF証跡と残りの基準](docs/openssf-evidence.md)を参照してください。
