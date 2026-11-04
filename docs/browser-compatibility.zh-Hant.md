<a id="browser-generations-and-operating-systems"></a>

# 瀏覽器世代與作業系統

<!-- language-navigation:start -->
<p dir="ltr">
<a href="browser-compatibility.md" lang="en" dir="ltr">English</a> · <a href="browser-compatibility.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="browser-compatibility.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="browser-compatibility.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="browser-compatibility.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="browser-compatibility.es.md" lang="es" dir="ltr">Español</a> · <a href="browser-compatibility.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="browser-compatibility.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="browser-compatibility.he.md" lang="he" dir="rtl">עברית</a> · <a href="browser-compatibility.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="browser-compatibility.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="browser-compatibility.it.md" lang="it" dir="ltr">Italiano</a> · <a href="browser-compatibility.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="browser-compatibility.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="browser-compatibility.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="browser-compatibility.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="browser-compatibility.pt.md" lang="pt" dir="ltr">Português</a> · <a href="browser-compatibility.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="browser-compatibility.th.md" lang="th" dir="ltr">ไทย</a> · <a href="browser-compatibility.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="browser-compatibility.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="browser-compatibility.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="browser-compatibility.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="browser-compatibility.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[實測結果](implementation-report.zh-Hant.md#browser-gate-integration)

![已設定的瀏覽器資格驗證：35個目標，166次情境執行](diagrams/browser-qualification.svg)

現有的裝置、媒體、舊版ES5/worker、原生介面和Apple原生HLS檢查仍是必要項目。共用TypeScript工作流程還會對確切的Mode A封裝壓縮檔執行Plex情境：兩個在地化載入/重新載入流程、HLS.js和Video.js在切換媒體與重新載入時保持長寬比，以及使用HLS.js在嚴格自助模式下自然結束影集單集。媒體情境使用真正的解碼；所有情境均使用真正的DOM和輸入。只有Plex資料與媒體來源是本機合成測試資料。

長寬比測試資料將儲存庫中的H.264/AAC傳輸串流轉封裝為獨立的fMP4版本。其初始化標頭依[RFC 8216第3.3節](https://www.rfc-editor.org/rfc/rfc8216#section-3.3)使用`iso6`品牌與零長度的影片/軌道。AVC樣本項目也在SPS數量中使用必要的保留位元，並在末尾`pre_defined`欄位中使用有號常數`-1`。這修正了鎖定版本的測試多工器所輸出的容器語法。測試資料契約會檢查標頭、拒絕格式錯誤的box，並證明編解碼器參數集、軌道ID、時間尺度和媒體片段位元組皆未變動。這只驗證合成輸入，本身不能證明瀏覽器播放正常，也不能取代完整RC矩陣。

提取要求需要Linux上的目前版Chromium、Firefox和WebKit，Windows上的Chromium及macOS上的WebKit。nightly與beta建置也需要這五個目標。RC資格驗證需要全部35個宣告目標：Linux、Windows與macOS上三個精確的Playwright/瀏覽器世代，三個系統上安裝的穩定版Chrome/Edge，以及Linux上的beta版Chrome/Edge。兩個歷史macOS WebKit目標（Playwright 1.62.1和1.63.0）使用`macos-15-intel`；其憑據記錄實際處理程序架構並拒絕ARM執行器。直接MSE診斷發現，相同H.264初始化與媒體位元組在Intel的1.63及ARM的1.64上能完成，但macOS 15 ARM虛擬機上的舊WebKit會在`updateend`之前卡住。更換容器、使用ManagedMediaSource或開啟瀏覽器視窗都未解決問題。這兩個目標仍需全部五個原始播放/介面情境。選擇此執行器並不代表對所有實體macOS裝置或原生Safari作出結論。重新產生清單時必須保留這些已審查的執行器覆寫設定；設定檔契約會拒絕移除它們。

全部三個Linux WebKit世代明確使用`ubuntu-26.04` x64執行器。已審查的官方執行環境比較在Ubuntu 24.04上重現嚴格自助模式切換失敗，而相同候選套件與五個未變動情境在Ubuntu 26.04上連續通過四次。這是在選擇一致且受支援的環境，而非替換個別多媒體程式庫或放寬播放斷言。其他Linux瀏覽器目標保留原有執行器。確切原始碼、成品、比較結果與限制見[Linux WebKit執行環境資格驗證](linux-webkit-runtime.md)。完整RC矩陣與獨立的原生封裝驗收仍為必要。

受測產品版本會在執行階段記錄。Playwright Firefox是其修補後的建置，並非對原生Firefox ESR的證明；WebKit不是Safari。此矩陣不能取代實體電視或原生殼層上的資格驗證。

完整清單包含**35個平台目標：32個支援HLS的目標及三個僅測試介面的Windows WebKit目標**。後三者仍須通過兩個在地化載入/重新載入流程；其WebKit建置既無MediaSource也無原生HLS。這是明確宣告的限制，不是已通過的播放涵蓋範圍。三個確切目標ID在`scripts/browser-compatibility-profile.cjs`中審查。執行介面測試前，能力探測必須確認此限制。如果MSE（包括ManagedMediaSource）或原生HLS變得可用，關卡必須失敗，直到更新設定檔。其他所有目標皆需要H.264與AAC的MSE支援及五個未變動情境；喪失能力必須導致失敗，不能選擇較小的測試集。探測會載入候選套件的HLS程式庫，檢查鎖定執行個體的預設值所選後端：依序為MediaSource、ManagedMediaSource、WebKitMediaSource。憑據列出後端與HLS版本；預設值或版本變更必須明確審查探測契約。

因此，完整RC需要**166次成功的情境執行**（32 × 5 + 3 × 2）及35份目標憑據。PR/nightly/beta子集仍為五個目標、25次執行。每份憑據記錄確切情境集、能力探測，以及HLS涵蓋範圍通過或明確的不支援原因。這些是設定要求，並不代表某個RC已完成它們。限制由Playwright 1.64使用的[WebKit Windows建置設定](https://github.com/WebKit/WebKit/blob/56453fdfe0b0ca6258c23e6453b34f70b885d13f/Source/cmake/OptionsWin.cmake#L75)和鎖定的執行階段探測確認。

兩條路徑皆下載目前執行中產生工作的確切成品ID。在提供剛解壓縮的目錄之前，檢查壓縮檔校驗和、來源提交、封裝bundle/provider雜湊、檔案類型與路徑。發行檢查還會驗證凍結的建置憑據。瀏覽器工作不重新建置受測程式碼，只安裝正式環境相依套件。測試伺服器仍需原始碼中的完整provider清單；編譯器只在真正組裝bundle時載入，讀取清單常數時不載入。失敗、略過、過期或缺漏的情境證據都會使共用關卡失敗；每個目標保留追蹤、實際執行環境身分與候選套件摘要。

七個產生的清單/鎖定檔來自`venus-os-ci-toolkit/scripts/prepare_browser_compatibility.py`。應用程式套件與歷史瀏覽器套件使用獨立鎖定檔。預設仍使用GitHub託管執行器；共用工作流程保留已準備的Linux備援選擇，而Windows/macOS目標需要各自原生作業系統。

共用發行判定會驗證每個選取目標及其來源SHA、執行、嘗試、通道與確切候選成品ID。RC不能使用五目標beta證據。升級至stable使用已接受RC的原始位元組。失敗後請重新執行整個資格驗證工作流程；舊嘗試的憑據不能完成新一輪驗證。

<a id="terminal-diagnostics"></a>

## 結束時的診斷

載入執行環境和候選套件的中繼資料後，`scripts/browser-acceptance.cjs`會在驗收結束或擲出例外時，將`acceptance-terminal.json`寫入`CI_BROWSER_DIAGNOSTICS`。記錄包含最後的階段、原始碼/候選套件身分、目標瀏覽器、執行/嘗試、經過時間，以及測試處理程序的結束狀態、訊號或允許清單內的錯誤碼。記錄小於2 KiB，不包含原始錯誤、URL、標準輸出/標準錯誤輸出、環境值或記憶體傾印。檔案以獨占存取方式和`0600`權限模式建立在工作所屬的現有輸出目錄中；不會覆寫既有檔案，也不會覆寫路徑最後一個元件處的符號連結。

這是**診斷證據，不代表驗收成功**。記錄一律宣告`acceptance: false`；只有獨立的`CI_BROWSER_EVIDENCE`檔案，才能在全部現有斷言通過後確認候選套件合格。診斷寫入失敗不能取代原本的成功或失敗結果。包裝程式突然終止，或啟動前中繼資料載入失敗，都可能導致沒有記錄。測試處理程序的訊號不能證明Firefox內容處理程序收到了相同訊號。判定原生崩潰的原因仍需要相符的原生呼叫堆疊或受控重現；重試通過不代表調查可以結束。

此輔助程式不會啟用原始Firefox崩潰報告或`DEBUG=pw:browser`記錄。瀏覽器記憶體與主控台輸出可能包含敏感資料，若沒有經過另行審查的收集與存取政策，不得將其複製到一般上傳的成品中。情境順序、鎖定的瀏覽器版本、一個工作處理程序、零重試與既有逾時限制均維持不變。

<a id="from-source-to-accepted-candidate"></a>

## 從原始碼到被接受的候選套件

![原始碼、套件驗證、能力檢查與證據](diagrams/candidate-verification-flow.svg)

1. 建置已審查的原始碼並封裝產生的Mode A檔案。將壓縮檔校驗和與原始碼身分隨候選套件保存。
2. 解壓縮前驗證壓縮檔大小上限、安全路徑、檔案類型、原始碼/版本及完整項目/provider雜湊清單。發行資格驗證還會檢查凍結的建置憑據。
3. 探測實際瀏覽器版本與媒體能力。選擇宣告的設定檔；能力不符應失敗，而非悄悄縮減涵蓋範圍。
4. 對解壓縮檔案執行確切情境集，不重新建置。每個情境必須恰好執行一次，不得略過、失敗或重試。
5. 保留執行環境、能力、候選摘要與情境結果。共用關卡在接受證據前檢查必要目標及執行/嘗試/原始碼的一致性。發行協調與裝置驗收仍是獨立條件。

<a id="what-has-been-measured-locally"></a>

## 本機實測內容

![本機整合驗證：裝置與封裝瀏覽器使用獨立測試集](diagrams/browser-verification-results.svg)

在原始碼`c52f4d07`上，完整Chromium裝置瀏覽器執行通過196項測試，並依預期略過一項原生HLS測試。另行測試的相同Mode A壓縮檔在Chromium 156.0.8078.4、Firefox 157.0和WebKit 27.2上分別通過五個情境：共15項通過，無略過或重試。這些是不同測試集；數量不是涵蓋率，也不是全部35個託管目標通過的證據。

[保存的憑據](evidence/post779-local-acceptance/summary.json)標明實際主機為macOS 26.7.1，明確區分其與`macos-15`設定檔標籤，且不構成發行資格認證。要在Mac上重複本機檢查，請安裝鎖定相依套件及Playwright 1.64.0瀏覽器，建置目前原始碼，再執行[保存的操作步驟](evidence/post779-local-acceptance/reproduce.sh)，以儲存庫目錄作為引數。它會封裝現有建置、檢查候選套件、探測每個瀏覽器並在`.compatibility/`下保存新憑據。需要連接埠4189，且拒絕覆寫既有`browser-candidate-web`目錄。建置與執行步驟之間請勿變更原始碼。託管CI與實體裝置結果分別記錄於[實作報告](implementation-report.zh-Hant.md)。
