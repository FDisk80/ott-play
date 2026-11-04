<a id="browser-generations-and-operating-systems"></a>

# ブラウザーの世代とオペレーティングシステム

<!-- language-navigation:start -->
<p dir="ltr">
<a href="browser-compatibility.md" lang="en" dir="ltr">English</a> · <a href="browser-compatibility.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="browser-compatibility.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="browser-compatibility.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="browser-compatibility.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="browser-compatibility.es.md" lang="es" dir="ltr">Español</a> · <a href="browser-compatibility.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="browser-compatibility.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="browser-compatibility.he.md" lang="he" dir="rtl">עברית</a> · <a href="browser-compatibility.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="browser-compatibility.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="browser-compatibility.it.md" lang="it" dir="ltr">Italiano</a> · <a href="browser-compatibility.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="browser-compatibility.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="browser-compatibility.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="browser-compatibility.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="browser-compatibility.pt.md" lang="pt" dir="ltr">Português</a> · <a href="browser-compatibility.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="browser-compatibility.th.md" lang="th" dir="ltr">ไทย</a> · <a href="browser-compatibility.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="browser-compatibility.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="browser-compatibility.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="browser-compatibility.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="browser-compatibility.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[測定結果](implementation-report.ja.md#browser-gate-integration)

![設定されたブラウザー適格性検証：35ターゲット、166回のシナリオ実行](diagrams/browser-qualification.svg)

既存のデバイス、メディア、旧式ES5/worker、ネイティブUI、AppleネイティブHLSの検査は引き続き必須です。共有TypeScriptワークフローは、対象となるMode Aのパッケージ済みアーカイブそのものに対してPlexシナリオも実行します。内容は、ローカライズされた2つの読み込み／再読み込みフロー、メディア変更や再読み込みをまたぐHLS.jsとVideo.jsのアスペクト比保持、HLS.jsによる厳格キオスクでのエピソード自然終了です。メディアシナリオは実際にデコードし、すべてのシナリオが実際のDOMと入力を使用します。合成されたローカルテストデータなのはPlexデータとメディアソースだけです。

アスペクト比用フィクスチャは、リポジトリ内のH.264/AACトランスポートストリームを別々のfMP4形式に再多重化します。初期化ヘッダーは[RFC 8216の3.3節](https://www.rfc-editor.org/rfc/rfc8216#section-3.3)に従い、ブランド`iso6`と長さゼロのムービー／トラックを使います。AVCサンプルエントリーも、SPS数の必須予約ビットと、末尾の`pre_defined`フィールドの符号付き定数`-1`を使います。これにより固定版フィクスチャマルチプレクサーが出力するコンテナー構文を修正します。フィクスチャ契約はヘッダーを検査して不正なボックスを拒否し、コーデックパラメーターセット、トラックID、タイムスケール、メディア断片のバイト列が不変であることを確認します。これは合成入力の検証であり、それだけでブラウザー再生を証明したり、完全なRCマトリクスを代替したりするものではありません。

プルリクエストではLinuxの現行Chromium、Firefox、WebKit、WindowsのChromium、macOSのWebKitが必須です。nightlyとbetaもこの5ターゲットを必要とします。RCの適格性検証では宣言された35ターゲットすべてが必須です。Linux、Windows、macOS上の正確な3世代のPlaywright／ブラウザー、3システムすべてにインストールした安定版Chrome/Edge、Linuxのbeta版Chrome/Edgeが含まれます。過去のmacOS WebKitの2ターゲット（Playwright 1.62.1と1.63.0）は`macos-15-intel`を使い、証跡に実際のプロセスアーキテクチャを記録してARMランナーを拒否します。直接MSE診断では、同じH.264初期化・メディアバイト列がIntelの1.63とARMの1.64で完了した一方、macOS 15 ARM VM上の古いWebKitは`updateend`より前に停止しました。コンテナー変更、ManagedMediaSource、ブラウザーウィンドウの表示でも解消しませんでした。この2ターゲットにも元の再生／UIシナリオ5件すべてが必要です。このランナー選択は、あらゆる物理macOSデバイスやネイティブSafariについての主張ではありません。インベントリー再生成ではレビュー済みランナー上書きを維持しなければならず、プロファイル契約は削除を拒否します。

Linux WebKitの3世代すべては明示的にx64ランナー`ubuntu-26.04`を使います。レビュー済みの公式ランタイム比較では、Ubuntu 24.04で厳格キオスクの遷移失敗が再現し、同じ候補と変更のない5シナリオはUbuntu 26.04で4回連続成功しました。これは個別のマルチメディアライブラリーの置換や再生アサーションの緩和ではなく、一貫したサポート対象ランタイムの選択です。他のLinuxブラウザーターゲットは既存ランナーを維持します。正確なソース、成果物、比較結果、限界は[Linux WebKitランタイムの適格性検証](linux-webkit-runtime.md)を参照してください。完全なRCマトリクスと、別途パッケージ化されたネイティブ版の受け入れは引き続き必須です。

テスト対象製品のバージョンは実行時に記録します。Playwright FirefoxはPlaywrightのパッチ適用ビルドであり、ネイティブFirefox ESRについての証明ではありません。WebKitはSafariではありません。このマトリクスは物理テレビやネイティブシェルでの適格性検証を代替しません。

全インベントリーには**35のプラットフォームターゲットがあり、32はHLS対応、3つのWindows WebKitはUI専用**です。後者にもローカライズされた読み込み／再読み込みフロー2件が必要で、そのWebKitビルドにはMediaSourceもネイティブHLSもありません。これは明示的な制約であり、再生検証の成功ではありません。正確な3つのターゲットIDは`scripts/browser-compatibility-profile.cjs`でレビューします。UIテスト前に機能プローブがこの制約を確認しなければなりません。MSE（ManagedMediaSourceを含む）やネイティブHLSが利用可能になれば、プロファイルを更新するまでゲートは失敗します。それ以外はすべてH.264とAAC双方のMSE対応と、変更のない5シナリオが必須です。機能喪失時は小さなスイートを選ばず失敗します。プローブは候補のHLSライブラリーを読み込み、固定版インスタンスの既定値が選ぶバックエンドを確認します。順序はMediaSource、ManagedMediaSource、WebKitMediaSourceです。証跡はバックエンドとHLSバージョンを示し、既定値やバージョンの変更にはプローブ契約の明示的レビューが必要です。

したがって完全なRCには**166回のシナリオ成功**（32 × 5 + 3 × 2）と35のターゲット証跡が必要です。PR/nightly/betaの部分集合は5ターゲット、25回のままです。各証跡は正確なシナリオ集合、機能プローブ、およびHLS検証成功または明示的な非対応理由を記録します。これらは設定された要件であり、特定のRCが既に完了したという主張ではありません。制約はPlaywright 1.64が使用する[WebKit Windowsビルド設定](https://github.com/WebKit/WebKit/blob/56453fdfe0b0ca6258c23e6453b34f70b885d13f/Source/cmake/OptionsWin.cmake#L75)と固定版ランタイムプローブで確認されます。

両経路とも、現行runの生成ジョブによる正確な成果物IDをダウンロードします。新規展開ディレクトリーを配信する前に、アーカイブのチェックサム、ソースコミット、パッケージ済みbundle/providerハッシュ、ファイル種別とパスを検査します。リリース検査では凍結されたビルド証跡も確認します。ブラウザージョブはテスト対象コードを再ビルドせず、本番依存関係だけをインストールします。テストサーバーは引き続きソースの全providerインベントリーを必要とし、コンパイラーを読み込むのはbundleを実際に組み立てるときだけで、インベントリー定数の読み取り時ではありません。失敗、スキップ、古い証跡、欠落した証跡はいずれも共有ゲートを失敗させます。ターゲットごとにトレース、実際のランタイム識別情報、候補ダイジェストを保持します。

生成する7つのインベントリー／ロックファイルは`venus-os-ci-toolkit/scripts/prepare_browser_compatibility.py`に由来します。アプリケーションパッケージと過去のブラウザーパッケージは別々のロックファイルを持ちます。GitHub-hostedランナーが引き続き既定です。共有ワークフローには準備済みのLinux予備選択を保持しますが、Windows/macOSターゲットにはそれぞれのネイティブOSが必要です。

共有リリース判定は選択された各ターゲットと、そのソースSHA、run、attempt、チャネル、正確な候補成果物IDを検証します。RCは5ターゲットのbeta証跡を利用できません。stableへの昇格は受け入れ済みRCのバイト列を使用します。失敗後は適格性検証ワークフロー全体を再実行してください。古いattemptの証跡では新しい検証を完了できません。

<a id="terminal-diagnostics"></a>

## 終了時の診断

ランタイムと候補のメタデータを読み込んだ後、受け入れ検証が終了するか例外を送出すると、`scripts/browser-acceptance.cjs`は`CI_BROWSER_DIAGNOSTICS`内に`acceptance-terminal.json`を書き込みます。最後のフェーズ、ソース／候補の識別情報、対象ブラウザー、run／attempt、経過時間、およびテストプロセスの終了ステータス、シグナル、または許可リスト内のエラーコードを記録します。記録は2 KiB未満で、生のエラー、URL、標準出力／標準エラー出力、環境の値、メモリーダンプは含みません。ジョブが所有する既存の出力ディレクトリー内に、排他的アクセスと権限モード`0600`で作成します。既存のファイルや、パスの最終要素にあるシンボリックリンクは上書きしません。

これは**診断の証跡であり、受け入れ成功ではありません**。常に`acceptance: false`を宣言し、既存のすべてのアサーションが成功した後に候補の適格性を認められるのは、別の`CI_BROWSER_EVIDENCE`ファイルだけです。診断の書き込みに失敗しても、元の成功または失敗を置き換えることはありません。ラッパーの突然の終了や、その開始前のメタデータ読み込み失敗では、記録が残らない場合があります。テストプロセスのシグナルは、Firefoxのコンテンツプロセスが同じシグナルを受信した証拠ではありません。ネイティブクラッシュの原因特定には、対応するネイティブスタックか、制御された条件での再現が引き続き必要です。再試行が成功しても調査は終了しません。

このヘルパーは、生のFirefoxクラッシュレポートや`DEBUG=pw:browser`ログを有効にしません。ブラウザーのメモリーとコンソール出力には機密データが含まれる可能性があるため、収集とアクセスの方針を別途レビューしない限り、通常アップロードする成果物にコピーしてはいけません。シナリオの順序、固定されたブラウザーバージョン、ワーカー1つ、再試行0回、既存のタイムアウトは変更しません。

<a id="from-source-to-accepted-candidate"></a>

## ソースから受け入れ済み候補まで

![ソース、パッケージ検証、機能検査、証跡](diagrams/candidate-verification-flow.svg)

1. レビュー済みソースをビルドし、生成されたMode Aファイルをパッケージ化します。アーカイブのチェックサムとソース識別情報を候補とともに保存します。
2. 展開前にアーカイブサイズの上限、安全なパス、ファイル種別、ソース／バージョン、全entry/providerのハッシュ一覧を確認します。リリース適格性検証では凍結されたビルド証跡も確認します。
3. 実際のブラウザーバージョンとメディア機能を調べ、宣言されたプロファイルを選択します。不一致は検証範囲を黙って減らすのではなく失敗にします。
4. 展開ファイルに対して正確なシナリオ集合を再ビルドなしで実行します。各シナリオは正確に1回、スキップ・失敗・再試行なしで成功する必要があります。
5. ランタイム、機能、候補ダイジェスト、シナリオ結果を保持します。共有ゲートは必須ターゲットとrun/attempt/ソースの一致を確認してから証跡を受け入れます。リリース調整とデバイス受け入れは別条件です。

<a id="what-has-been-measured-locally"></a>

## ローカルで測定した内容

![ローカル統合検証：デバイスとパッケージ済みブラウザーの別々のスイート](diagrams/browser-verification-results.svg)

ソース`c52f4d07`ではChromiumデバイス・ブラウザーの完全な実行で196テストが成功し、ネイティブHLSの予定されたスキップが1件ありました。別途、同じMode AアーカイブはChromium 156.0.8078.4、Firefox 157.0、WebKit 27.2でそれぞれ5シナリオに成功しました。合計15成功、スキップも再試行もありません。これらは異なるスイートで、件数はカバレッジの割合でも、hostedの35ターゲットすべての成功証明でもありません。

[保存済み証跡](evidence/post779-local-acceptance/summary.json)は実際のmacOS 26.7.1ホストを識別し、`macos-15`というプロファイルラベルとは明確に区別しています。これだけではリリースを認定しません。Macで再現するには、ロック済み依存関係とPlaywright 1.64.0のブラウザーをインストールし、現行ソースをビルドしてから、リポジトリーディレクトリーを引数に[保存済み手順](evidence/post779-local-acceptance/reproduce.sh)を実行します。既存ビルドをパッケージ化し、候補を検査し、各ブラウザーを調べ、新しい証跡を`.compatibility/`に保存します。ポート4189が必要で、既存の`browser-candidate-web`ディレクトリーの上書きは拒否します。ビルドから手順実行までソースを変更しないでください。hosted CIと物理デバイスの結果は[実装報告](implementation-report.ja.md)で別々に管理します。
