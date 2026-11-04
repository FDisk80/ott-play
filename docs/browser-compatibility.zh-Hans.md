<a id="browser-generations-and-operating-systems"></a>

# 浏览器世代与操作系统

<!-- language-navigation:start -->
<p dir="ltr">
<a href="browser-compatibility.md" lang="en" dir="ltr">English</a> · <a href="browser-compatibility.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="browser-compatibility.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="browser-compatibility.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="browser-compatibility.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="browser-compatibility.es.md" lang="es" dir="ltr">Español</a> · <a href="browser-compatibility.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="browser-compatibility.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="browser-compatibility.he.md" lang="he" dir="rtl">עברית</a> · <a href="browser-compatibility.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="browser-compatibility.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="browser-compatibility.it.md" lang="it" dir="ltr">Italiano</a> · <a href="browser-compatibility.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="browser-compatibility.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="browser-compatibility.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="browser-compatibility.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="browser-compatibility.pt.md" lang="pt" dir="ltr">Português</a> · <a href="browser-compatibility.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="browser-compatibility.th.md" lang="th" dir="ltr">ไทย</a> · <a href="browser-compatibility.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="browser-compatibility.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="browser-compatibility.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="browser-compatibility.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="browser-compatibility.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[实测结果](implementation-report.zh-Hans.md#browser-gate-integration)

![已配置的浏览器资格验证：35个目标，166次场景执行](diagrams/browser-qualification.svg)

现有的设备、媒体、旧版ES5/worker、原生界面和Apple原生HLS检查仍是必需项。共享TypeScript工作流还会对准确的Mode A打包归档运行Plex场景：两个本地化加载/重新加载流程、HLS.js和Video.js在切换媒体及重新加载时保持宽高比，以及使用HLS.js在严格自助模式下自然结束剧集。媒体场景使用真实解码；所有场景均使用真实DOM和输入。只有Plex数据和媒体来源是本地合成测试数据。

宽高比测试夹具将仓库中的H.264/AAC传输流转封装为独立的fMP4版本。其初始化头按[RFC 8216第3.3节](https://www.rfc-editor.org/rfc/rfc8216#section-3.3)使用`iso6`品牌和零时长的电影/轨道。AVC样本条目还在SPS数量中使用要求的保留位，并在末尾`pre_defined`字段中使用有符号常量`-1`。这修正了锁定版本的测试复用器输出的容器语法。夹具契约检查这些头并拒绝格式错误的box，同时证明编解码器参数集、轨道ID、时间尺度和媒体片段字节均未改变。这仅验证合成输入，本身不能证明浏览器播放正常，也不能替代完整RC矩阵。

拉取请求要求Linux上的当前Chromium、Firefox和WebKit，Windows上的Chromium及macOS上的WebKit。nightly和beta构建也要求这五个目标。RC资格验证要求全部35个声明目标：Linux、Windows和macOS上三个精确的Playwright/浏览器世代，三个系统上安装的稳定版Chrome/Edge，以及Linux上的beta版Chrome/Edge。两个历史macOS WebKit目标（Playwright 1.62.1和1.63.0）使用`macos-15-intel`；其凭据记录实际进程架构并拒绝ARM运行器。直接MSE诊断发现，同样的H.264初始化和媒体字节在Intel的1.63及ARM的1.64上能够完成，但macOS 15 ARM虚拟机上的旧WebKit会在`updateend`之前卡住。更换容器、使用ManagedMediaSource或打开浏览器窗口都未解决问题。这两个目标仍要求全部五个原始播放/界面场景。选择该运行器并不代表对所有物理macOS设备或原生Safari作出结论。重新生成清单时必须保留这些已审核的运行器覆盖设置；配置契约会拒绝移除它们。

全部三个Linux WebKit世代明确使用`ubuntu-26.04` x64运行器。已审核的官方运行环境对比在Ubuntu 24.04上复现了严格自助模式切换失败，而相同候选包和五个未改动场景在Ubuntu 26.04上连续通过四次。这是在选择一致且受支持的环境，而非替换个别多媒体库或放宽播放断言。其他Linux浏览器目标保留原有运行器。准确源码、产物、对比结果及局限见[Linux WebKit运行环境资格验证](linux-webkit-runtime.md)。完整RC矩阵和独立的原生打包验收仍然必需。

测试产品的版本在运行时记录。Playwright Firefox是其打补丁后的构建，并非对原生Firefox ESR的证明；WebKit不是Safari。此矩阵不能替代物理电视或原生外壳上的资格验证。

完整清单包含**35个平台目标：32个支持HLS的目标和三个仅测试界面的Windows WebKit目标**。后三者仍须通过两个本地化加载/重新加载流程；其WebKit构建既无MediaSource也无原生HLS。这是明确声明的限制，不是已通过的播放覆盖。三个准确目标ID在`scripts/browser-compatibility-profile.cjs`中审核。运行界面测试前，能力探针必须确认此限制。如果MSE（包括ManagedMediaSource）或原生HLS变得可用，关卡必须失败，直到更新配置。其他所有目标均要求H.264与AAC的MSE支持及五个未改动场景；丧失能力必须导致失败，不能选择较小的测试集。探针加载候选包的HLS库，检查锁定实例的默认设置所选后端：依次为MediaSource、ManagedMediaSource、WebKitMediaSource。凭据列出后端与HLS版本；默认设置或版本变化必须明确审核探针契约。

因此，完整RC要求**166次成功的场景执行**（32 × 5 + 3 × 2）及35份目标凭据。PR/nightly/beta子集仍为五个目标、25次执行。每份凭据记录准确的场景集、能力探针，以及HLS覆盖通过或明确的不支持原因。这些是配置要求，并不意味着某个RC已经完成它们。限制由Playwright 1.64使用的[WebKit Windows构建配置](https://github.com/WebKit/WebKit/blob/56453fdfe0b0ca6258c23e6453b34f70b885d13f/Source/cmake/OptionsWin.cmake#L75)和锁定的运行时探针确认。

两条路径均下载当前运行中生成任务所产出的准确产物ID。在提供刚解压的目录之前，检查归档校验和、源提交、打包bundle/provider哈希、文件类型及路径。发布检查还验证冻结的构建凭据。浏览器任务不重新构建受测代码，仅安装生产依赖。测试服务器仍需要源代码中的完整provider清单；编译器仅在真正组装bundle时加载，读取清单常量时不加载。失败、跳过、过期或缺失的场景证据都会使共享关卡失败；每个目标保留追踪、实际运行环境身份和候选包摘要。

七个生成的清单/锁文件来自`venus-os-ci-toolkit/scripts/prepare_browser_compatibility.py`。应用包和历史浏览器包使用独立锁文件。默认仍使用GitHub托管运行器；共享工作流保留已准备的Linux备用选择，而Windows/macOS目标要求各自原生操作系统。

共享发布判定验证每个选中目标及其源SHA、运行、尝试、渠道和准确候选产物ID。RC不能使用五目标beta证据。升级到stable使用已接受RC的原始字节。失败后重新运行整个资格验证工作流；旧尝试的凭据不能完成新一轮验证。

<a id="terminal-diagnostics"></a>

## 结束时的诊断

加载运行环境和候选包的元数据后，`scripts/browser-acceptance.cjs`会在验收结束或抛出异常时，将`acceptance-terminal.json`写入`CI_BROWSER_DIAGNOSTICS`。记录包含最后的阶段、源码/候选包身份、目标浏览器、运行/尝试、已用时间，以及测试进程的退出状态、信号或允许列表内的错误码。记录小于2 KiB，不包含原始错误、URL、标准输出/标准错误输出、环境值或内存转储。文件以独占访问方式和`0600`权限模式创建在任务所属的现有输出目录中；不会覆盖已有文件，也不会覆盖路径最后一个组件处的符号链接。

这是**诊断证据，不代表验收成功**。记录始终声明`acceptance: false`；只有单独的`CI_BROWSER_EVIDENCE`文件，才能在全部现有断言通过后确认候选包合格。诊断写入失败不能取代原有的成功或失败结果。包装程序突然终止，或者启动前元数据加载失败，都可能导致没有记录。测试进程的信号不能证明Firefox内容进程收到了同一信号。确定原生崩溃的原因仍需要匹配的原生调用栈或受控复现；重试通过并不意味着调查可以结束。

此辅助程序不会启用原始Firefox崩溃报告或`DEBUG=pw:browser`日志。浏览器内存和控制台输出可能包含敏感数据，若没有经过单独审核的收集与访问策略，不得将其复制到常规上传的产物中。场景顺序、锁定的浏览器版本、一个工作进程、零重试和现有超时均保持不变。

<a id="from-source-to-accepted-candidate"></a>

## 从源码到被接受的候选包

![源码、包验证、能力检查与证据](diagrams/candidate-verification-flow.svg)

1. 构建已审核源码并打包生成的Mode A文件。将归档校验和与源码身份随候选包保存。
2. 解压前验证归档大小限制、安全路径、文件类型、源码/版本以及完整条目/provider哈希清单。发布资格验证还检查冻结的构建凭据。
3. 探测实际浏览器版本和媒体能力。选择声明配置；能力不匹配应失败，而非悄悄减少覆盖。
4. 对解压文件运行准确场景集，不重新构建。每个场景必须恰好执行一次，不能跳过、失败或重试。
5. 保留运行环境、能力、候选摘要和场景结果。共享关卡在接受证据前检查必需目标及运行/尝试/源码的一致性。发布协调和设备验收仍是独立条件。

<a id="what-has-been-measured-locally"></a>

## 本地实测内容

![本地集成验证：设备与打包浏览器使用独立测试集](diagrams/browser-verification-results.svg)

在源码`c52f4d07`上，完整Chromium设备浏览器运行通过196项测试，并按预期跳过一项原生HLS测试。另行测试的相同Mode A归档在Chromium 156.0.8078.4、Firefox 157.0和WebKit 27.2上分别通过五个场景：共15项通过，无跳过或重试。这些是不同测试集；数量并非覆盖率，也不是全部35个托管目标通过的证据。

[保存的凭据](evidence/post779-local-acceptance/summary.json)标明实际主机为macOS 26.7.1，明确区分其与`macos-15`配置标签，且不构成发布资格认证。要在Mac上重复本地检查，请安装锁定依赖及Playwright 1.64.0浏览器，构建当前源码，再运行[保存的操作步骤](evidence/post779-local-acceptance/reproduce.sh)，以仓库目录作为参数。它打包现有构建、检查候选包、探测每个浏览器并在`.compatibility/`下保存新凭据。需要端口4189，且拒绝覆盖已有`browser-candidate-web`目录。构建与执行步骤之间不要更改源码。托管CI和物理设备结果分别记录于[实现报告](implementation-report.zh-Hans.md)。
