<a id="ott-play-documentation-wiki"></a>

# OTT-play 文档 Wiki

<!-- language-navigation:start -->
<p dir="ltr">
<a href="Home.md" lang="en" dir="ltr">English</a> · <a href="Home.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="Home.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="Home.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="Home.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="Home.es.md" lang="es" dir="ltr">Español</a> · <a href="Home.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="Home.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="Home.he.md" lang="he" dir="rtl">עברית</a> · <a href="Home.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="Home.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="Home.it.md" lang="it" dir="ltr">Italiano</a> · <a href="Home.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="Home.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="Home.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="Home.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="Home.pt.md" lang="pt" dir="ltr">Português</a> · <a href="Home.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="Home.th.md" lang="th" dir="ltr">ไทย</a> · <a href="Home.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="Home.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="Home.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="Home.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="Home.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[README](../../README.zh-Hans.md) · [全部界面语言](../readme/README.md)

这是源代码仓库中受版本管理的文档首页。GitHub 可以直接呈现这些 Markdown 页面；将其维护在此处，可使说明、图表和测试与代码一同接受审查。独立的 [GitHub Wiki](https://github.com/open-ott-play/ottplay-foss/wiki) 从这些源文件导出，并在每页标明源修订版。参见[发布说明](../wiki-publishing.md)。

<a id="start-and-install"></a>

## 开始与安装

- [实用指南](../../README.zh-Hans.md)，提供 [24 种文档语言](../manual-translations.md)。
- [覆盖全部 88 种界面语言的本地化快速入门](../readme/README.md)。它们复用已翻译的界面标签和导航步骤，并非 88 种语言的工程手册。主手册和配套功能指南提供 24 种语言的完整版本。
- [Android Full/API 22 包与更新](../android-distributions.md)、[Android 构建](../../android/README.md)和 [Capacitor iOS/Android](../capacitor-mobile.md)。
- [macOS 桌面交付](../macos-local-delivery.md)、[Tauri 签名/更新器](../tauri-updater-notarize.md)和[本地 HTTP 实例](../local-http-deployment.md)。

<a id="process-and-results"></a>

## 流程与结果

- [浏览器资格评估与候选版验证](../browser-compatibility.zh-Hans.md)（[Русский](../browser-compatibility.ru.md)）：已配置目标、彩色图表、精确包检查及单独记录的本地结果。

- [实现报告与彩色图表](../implementation-report.zh-Hans.md)（[Русский](../implementation-report.ru.md)）：已审查变更、已修复回归、测量结果和剩余发布条件。

<a id="use-the-new-capabilities"></a>

## 使用新能力

- [功能交付与平台边界](../roadmap-delivery.zh-Hans.md)（[Русский](../roadmap-delivery.ru.md)）。
- [质量上限、显式直播备用源与有界恢复](../playback-stream-policy.zh-Hans.md)（[Русский](../playback-stream-policy.ru.md)）。
- [手动 XMLTV 绑定与经典控件无障碍支持](../guide-binding-accessibility.zh-Hans.md)（[Русский](../guide-binding-accessibility.ru.md)）。
- [托管的图像和声音检查](../audio-video-check.zh-Hans.md)（[Русский](../audio-video-check.ru.md)）：**信息 → 音频 → 播放**、预期音调、托管图表以及返回直播电视。片段按需获取，需要互联网，且不包含在播放器包中。独立的在线动态图案演示没有声音。
- [Xtream 电影/剧集库](../xtream-media.zh-Hans.md)（[Русский](../xtream-media.ru.md)）。
- [同一来源的播放器交接](../remote-handoff.zh-Hans.md)（[Русский](../remote-handoff.ru.md)）。
- [本地设置日志与恢复](../settings-recovery.zh-Hans.md)（[Русский](../settings-recovery.ru.md)）。
- [可靠控制、可恢复配置档和交接](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.md)（[Русский](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.ru.md)）。需要匹配的控制器/CLI 修订版及已配置权限。
- [原生 Android 中基于语义的音频/字幕偏好](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.md)（[Русский](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.ru.md)）。原生 Kotlin 应用与本仓库的 Capacitor APK 相互独立。

<a id="configure-sources-and-inspect-problems"></a>

## 配置来源与排查问题

- [Plex 登录与播放](../plex-provider.md)、[节目指南架构](../guide-architecture.md)及[托管 EPG 诊断](../hosted-epg-diagnostics.md)。
- [界面设置](../interface-settings.md)、[设计历史与致谢](../interface-history.md)及[语言目录/键盘](../localization.md)。
- [远程工作台](../remote-workbench.md)、[运行时诊断](../runtime-debug.md)及[诊断同意、脱敏与保留](../diagnostic-security.md)。
- [原生设备检查清单](../mode-b-device-smoke.md)、[Tauri 设备检查清单](../mode-b-tauri-smoke.md)及[浏览器窗口控件](../browser-window-controls.md)。

- [功能成本实测](../roadmap-size.zh-Hans.md)、原始依据与 SVG 图表。

<a id="develop-and-release"></a>

## 开发与发布

- [架构与所有权](../architecture.md)、[播放会话](../playback-session-architecture.md)及[经典 ES5 构建](../build-pipeline.md)。
- [运行时资源名称](../asset-layout.md)、[发布政策](../../RELEASING.md)、[发布操作手册](../release-workflow.md)及 [RC 模糊测试](../../FUZZING.md)。
- [隐私政策](../privacy-policy.md)及 [MIT 许可证](../../LICENSE)。

更改文档时，若界面标签或快速入门模板发生变化，请运行 `npm run docs:generate`，然后运行 `npm run check:docs`。保持所有手册翻译完整，在能力声明旁注明限制，并区分本地验证与真机测试。图表是可审查的仓库资源；参见[节目指南绑定 SVG](../images/guide-binding.svg)及功能指南中链接的图表。检查器验证相对文件目标，不验证远程网站可用性或每个 Markdown 标题锚点。
