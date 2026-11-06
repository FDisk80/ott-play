<a id="ott-play-documentation-wiki"></a>

# OTT-play ドキュメント Wiki

<!-- language-navigation:start -->
<p dir="ltr">
<a href="Home.md" lang="en" dir="ltr">English</a> · <a href="Home.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="Home.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="Home.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="Home.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="Home.es.md" lang="es" dir="ltr">Español</a> · <a href="Home.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="Home.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="Home.he.md" lang="he" dir="rtl">עברית</a> · <a href="Home.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="Home.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="Home.it.md" lang="it" dir="ltr">Italiano</a> · <a href="Home.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="Home.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="Home.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="Home.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="Home.pt.md" lang="pt" dir="ltr">Português</a> · <a href="Home.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="Home.th.md" lang="th" dir="ltr">ไทย</a> · <a href="Home.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="Home.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="Home.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="Home.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="Home.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[README](../../README.ja.md) · [すべてのインターフェース言語](../readme/README.md)

ここはソースリポジトリ内の、バージョン管理されたドキュメントのホームです。GitHub は Markdown ページを直接表示できます。ここで管理することで、手順、図、テストをコードと同じレビューで確認できます。別の [GitHub Wiki](https://github.com/open-ott-play/ottplay-foss/wiki) はこれらのソースから出力され、各ページにソースリビジョンを表示します。[公開手順](../wiki-publishing.md)を参照してください。

<a id="start-and-install"></a>

## 開始とインストール

- [実践ガイド](../../README.ja.md)は[ドキュメントの 24 言語](../manual-translations.md)で利用できます。
- [全 88 インターフェース言語向けのクイックスタート](../readme/README.md)。翻訳済み UI ラベルと操作手順を再利用しています。88 言語の技術マニュアルではありません。メインマニュアルと対応する機能ガイドには 24 言語の完全版があります。
- [Android Full/API 22 のパッケージと更新](../android-distributions.md)、[Android ビルド](../../android/README.md)、[Capacitor iOS/Android](../capacitor-mobile.md)。
- [macOS デスクトップ配布](../macos-local-delivery.md)、[Tauri 署名/アップデーター](../tauri-updater-notarize.md)、[ローカル HTTP インスタンス](../local-http-deployment.md)。

<a id="process-and-results"></a>

## 手順と結果

- [ブラウザー適格性と候補版の検証](../browser-compatibility.ja.md)（[Русский](../browser-compatibility.ru.md)）：設定された対象、カラー図、正確なパッケージの確認、別途のローカル結果。

- [実装レポートとカラー図](../implementation-report.ja.md)（[Русский](../implementation-report.ru.md)）：レビュー済み変更、修正済み回帰、測定結果、残るリリース条件。

<a id="use-the-new-capabilities"></a>

## 新しい機能を使う

- [機能配布とプラットフォーム境界](../roadmap-delivery.ja.md)（[Русский](../roadmap-delivery.ru.md)）。
- [品質上限、明示的なライブ予備ソース、有限の復旧](../playback-stream-policy.ja.md)（[Русский](../playback-stream-policy.ru.md)）。
- [手動 XMLTV 対応付けとクラシック UI のアクセシビリティ](../guide-binding-accessibility.ja.md)（[Русский](../guide-binding-accessibility.ru.md)）。
- [ホスト型の映像・音声チェック](../audio-video-check.ja.md)（[Русский](../audio-video-check.ru.md)）：**情報 → 音声 → 再生**、期待される音、ホスティング図、ライブ TV への復帰。クリップは必要時に取得し、インターネットが必要で、プレーヤーパッケージには含まれません。別のオンライン動作パターンデモは無音です。
- [Xtream 映画/シリーズライブラリ](../xtream-media.ja.md)（[Русский](../xtream-media.ru.md)）。
- [同一ソースでのプレーヤー引き継ぎ](../remote-handoff.ja.md)（[Русский](../remote-handoff.ru.md)）。
- [ローカル設定ジャーナルと復旧](../settings-recovery.ja.md)（[Русский](../settings-recovery.ru.md)）。
- [信頼できる制御、再開可能プロファイル、引き継ぎ](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.md)（[Русский](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.ru.md)）。対応するコントローラー/CLI リビジョンと権限設定が必要です。
- [ネイティブ Android の意味に基づく音声/字幕設定](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.md)（[Русский](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.ru.md)）。ネイティブ Kotlin アプリは、このリポジトリの Capacitor APK とは別です。

<a id="configure-sources-and-inspect-problems"></a>

## ソース設定と問題調査

- [Plex サインインと再生](../plex-provider.md)、[番組ガイドの構成](../guide-architecture.md)、[ホスト型 EPG 診断](../hosted-epg-diagnostics.md)。
- [インターフェース設定](../interface-settings.md)、[デザインの歴史と謝辞](../interface-history.md)、[言語カタログ/キーボード](../localization.md)。
- [リモート作業台](../remote-workbench.md)、[ランタイム診断](../runtime-debug.md)、[診断の同意・秘匿化・保存](../diagnostic-security.md)。
- [ネイティブ機器チェックリスト](../mode-b-device-smoke.md)、[Tauri 機器チェックリスト](../mode-b-tauri-smoke.md)、[ブラウザーウィンドウ操作](../browser-window-controls.md)。

- [機能の実測コスト](../roadmap-size.ja.md)、生の根拠資料、SVG グラフ。

<a id="develop-and-release"></a>

## 開発とリリース

- [アーキテクチャと所有権](../architecture.md)、[再生セッション](../playback-session-architecture.md)、[クラシック ES5 ビルド](../build-pipeline.md)。
- [ランタイムアセット名](../asset-layout.md)、[リリース方針](../../RELEASING.md)、[リリース運用手順](../release-workflow.md)、[RC ファジング](../../FUZZING.md)。
- [プライバシーポリシー](../privacy-policy.md)と [MIT ライセンス](../../LICENSE)。

ドキュメント変更時、UI ラベルやクイックスタートのテンプレートを変えたら `npm run docs:generate`、次に `npm run check:docs` を実行してください。全翻訳を完全に保ち、能力の説明のそばに制限を書き、ローカル検証と実機テストを区別してください。図はレビュー可能なリポジトリアセットです。[ガイド対応付け SVG](../images/guide-binding.svg)と機能ガイドのリンク先の図を参照してください。チェッカーは相対ファイルの参照先を検証しますが、外部サイトの稼働や全 Markdown 見出しアンカーは検証しません。
