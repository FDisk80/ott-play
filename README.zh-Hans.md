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

无需互联网的本地文件播放：参见[本地视频与离线播放](docs/offline-media.md)。

[![透视角度下的OTT-play FOSS频道浏览器](docs/images/hero.png)](docs/images/studio-2026-default.png)

*现有Studio 2026界面截图，使用合成频道和节目测试数据。打开图片可查看原始平面视图；这不是实际订阅服务的截图。[图片来源与重新生成](docs/images/README.md)。*

[88种语言的快速入门](docs/readme/README.md) · [文档wiki](docs/wiki/Home.zh-Hans.md)

[![OpenSSF最佳实践](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![模糊测试：仅RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

公开候选发布版会对原生/服务器端XMLTV解析和门户请求验证运行有界、隔离的模糊测试。参见[模糊测试范围、复现与发布证据](FUZZING.md)。

自包含的IPTV/OTT播放器，带本地Rust HTTP服务器。可在智能电视（LG WebOS、Samsung Tizen、Panasonic、Sony等）、机顶盒（Infomir MAG、Dune HD、Enigma2、Android TV）和桌面浏览器中运行。

请先阅读[架构与贡献者指南](docs/architecture.md)，了解运行时分层、职责归属、提供商扩展方法和验证。核心/宿主边界与兼容性契约见[播放会话和提供商生命周期](docs/playback-session-architecture.md)。

<!-- ci-release-process:start -->
<a id="release-process"></a>

## 发布流程

验证、nightly、beta、RC及stable升级规则见[发布策略](RELEASING.md)，本地命令见[运维手册](docs/release-workflow.md)。
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## 在浏览器中运行

打开[在线演示](https://player.ottplay.here.now/)，或按照下文构建并提供网页播放器。

[本地macOS部署](docs/local-http-deployment.md)在8443–8446端口提供HTTP播放器来源。8095端口已停用。

首次启动时选择**试用演示**播放动态测试图，或配置自己的M3U播放列表或提供商。之后也可通过**更换提供商 → 演示**打开演示。

演示模式需要互联网连接，但不需要提供商账户。无声MP4和HLS测试频道托管在here.now，由网页播放器、Tauri、Capacitor和OTT Server共用。切换时会保留已有提供商设置。要单独**检查图像与声音**，请在托管HTML5引擎空闲或播放直播时打开**信息 → 音频 → 播放**。此功能使用here.now上的有声`av-v1.mp4`测试片段，需要互联网连接。片段不包含在播放器包中，也绝不会在启动时下载。VOD、回看和设备引擎覆盖（包括PC2/Video.js及原生引擎）不适用；参见[步骤、预期声音和托管示意图](docs/audio-video-check.zh-Hans.md)。

已安装的桌面浏览器窗口支持**窗口控件叠加层**：Chrome可以隐藏独立标题栏，同时在播放器上保留窗口按钮和应用菜单。打开已安装应用，在Chrome提供此选项时选择**隐藏标题栏**；**显示标题栏**可恢复普通窗口框架。普通标签页和电视/原生外壳布局保持原有行为。支持的安装网址、更新已有快捷方式及验证方法见[浏览器窗口控件](docs/browser-window-controls.md)。

在主视频视图中使用**Alt/Option + 左/右**可前后跳转十秒，macOS也支持**Command + 左/右**，全屏与普通视图均可使用。本地视频、VOD和支持的频道回看在网页、Tauri与Capacitor中共用这些操作。参见[键盘快捷键与限制](docs/browser-window-controls.md#playback-keyboard-shortcuts)。

在PC界面中，**R**会从当前列表随机播放另一个频道或视频，但不打乱列表顺序。此操作适用于主视频视图和频道/视频列表；文本编辑器、对话框、设置与自助模式限制具有优先权。其他设备的按键映射不变。

可用`scripts/generate-demo-media.sh`重新生成合成测试图（需要FFmpeg）；生成媒体保存在Git忽略的`.local-artifacts`目录中。

<a id="features"></a>

## 功能

- **播放**：HLS、DASH和普通HTTP流，支持托管HLS.js/Shaka画质上限、有界恢复，以及每个直播频道最多三个显式备用URL。回看/VOD绝不会切换到直播备用源；参见[画质与恢复](docs/playback-stream-policy.zh-Hans.md)。
- **节目指南**：XMLTV匹配、时移/回看、节目标题搜索（EPG中的N5）、提醒，以及托管/原生XMLTV路径中针对准确频道的手动节目源/ID绑定。参见[绑定与无障碍](docs/guide-binding-accessibility.zh-Hans.md)。
- **收藏**：在支持的设备上，跨已配置的提供商和配置档案使用一个有序的[混合收藏集](docs/mixed-favorites.md)，支持通过CLI进行可迁移的导出/导入；保留家长控制PIN。回退模式下仍可使用各来源的收藏列表。
- **设置**：设置和收藏的JSON导入/导出、支持的localStorage批量操作撤销日志、区分来源的回看续播，以及控制器工作流所用的已存设置精确比较。恢复假定只有一个写入者；自定义存储适配器仍为尽力回滚。参见[设置恢复](docs/settings-recovery.zh-Hans.md)。
- **共享界面**：OTT Server、Tauri和Capacitor使用相同的频道列表主题与可见性设置。界面设置控制高亮和选中色；频道列表设置控制频道名称、图标、当前节目、进度及回看标记。
- **提供商**：M3U/M3U8、Xtream直播及[点播电影/剧集目录](docs/xtream-media.zh-Hans.md)、支持[电影和嵌套分集](docs/stalker-media.md)的Stalker/Ministra、Plex和VPortal。可用回看与媒体库功能取决于提供商能力和账户权限。
- **推送命令**：通过webhook远程控制——切换频道、提供商、播放列表以及显示弹窗。
- **远程文字输入（swop）**：电视和手机处于不同网络时，通过Cloudflare Worker使用手机键盘（安装授权会话；虚拟键盘上的♥™）。
- **按设备路由**：基于UUID为多设备部署寻址。
- **本地代理**：可选本地命令服务器，实现100%本地自动化，无需中央服务器。
- **控制器集成**：按设备/操作限定权限的操作员、可选持久化命令结果、可恢复的Local/Home预设应用，以及通过匹配的[控制服务器](https://github.com/open-ott-play/ottplay-control-server)进行同源直播/回看接力。这需要更新后的控制器/CLI，独立浏览器标签页本身不提供这些能力。
- **带类型的远程设置**：发现可用设置，读取已保存值和实际生效值，并在保存时检查运行实例、来源和修订版本；参见[远程设置与 VPortal 配置](docs/remote-player-settings.md)。
- **调试**：通过`?debug=1`选择启用播放HUD/环形日志、经同意的远程检查，以及按需托管的音视频检查。
- **键盘无障碍**：经典对话框有可访问名称、Tab焦点限制与返回、已选频道语义和礼貌状态播报。这些改进不代表完整WCAG或设备屏幕阅读器合规。
- **24类设备**：按设备设置遥控器按键映射。
- **88种界面语言**：配套目录、[本地化快速入门](docs/readme/README.md)和[经CLDR校验的键盘字符表](docs/localization.md)。主手册和成对功能指南提供[24种文档语言](docs/manual-translations.md)；其他工程参考文档保留原有语言。

[交付指南](docs/roadmap-delivery.zh-Hans.md)介绍此源码版本已实现的功能、平台边界、图表与验证。已安装版本或托管部署可能使用更早修订。独立的原生[Android应用](https://github.com/open-ott-play/ottplay-android)也会按语言、角色和标签保存音轨/字幕选择，而非使用清单索引；其实现与发布独立于本前端。

[STB源码审查](docs/stb-player-improvements.md)介绍媒体、资源使用和恢复方面的改进，以及源码比较和当前限制。

<a id="debug-hud"></a>

## 调试HUD

本地HUD与服务器日志持久化分别选择启用。收集其他设备日志前，请阅读[诊断访问、脱敏和保留策略](docs/diagnostic-security.md)。

通过以下任一方式启用调试：
- URL：`?debug=1`或`?debug=true`
- 本地存储：`localStorage.setItem("ottplay_debug", "1")`
- 窗口属性：`window.__OTT_DEBUG__ = true`
- 服务器：`/debug/config`返回`{enabled: true}`时

启用调试后：
- 按**D**切换屏幕HUD条（`ottDebugSetHud` / `__ottDebug.toggleHud()`）。
  - 焦点位于INPUT/TEXTAREA/listEdit时跳过。
  - 使用`e.key`避免MAG/Maple PLAY/PREV=68冲突。
- 信息菜单 → **调试HUD** → 调用`__ottDebug.toggleHud()`。
- 管理设置 → **调试HUD**：
  - 调试已加载：切换HUD可见性。
  - 否则：设置`ottplay_debug=1` + `ottplay_debug_hud=1`并提示重启。
- 持久化：`ottDebugSetHud`将HUD状态保存到`localStorage.ottplay_debug_hud`（"1"/"0"）。

<a id="capacitor-ios-and-android"></a>

## Capacitor iOS与Android

本仓库使用Capacitor将共享TypeScript前端打包到iOS和Android 7+。两者均使用系统字体与npm锁定的原生运行时。另有API 22兼容APK，支持安装WebView 60或更新版本的Android 5.1/6。两个Android APK均已签名，并与未签名iOS IPA一起包含在通过资格验证的beta、RC和stable发布中。独立Kotlin应用仍位于[ottplay-android](https://github.com/open-ott-play/ottplay-android)。

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

参见[Capacitor配置](docs/capacitor-mobile.md)和[Android分发与远程更新](docs/android-distributions.md)。

iOS界面使用横屏。设置、提供商配置、远程控制授权和JSON导入/导出仍使用共享前端。平板多任务可能覆盖请求的屏幕方向。

在iPhone上，可在频道列表上下滑动以移动行和页面：上滑到后续频道，下滑到之前频道。快速轻扫会跨越多页并逐渐停止；慢速拖动保持精确。触摸屏幕或按导航键可停止运动。单击会启动手指下的频道，即使当前选中的是另一行；滑动松手不会打开频道。

视频在iPhone上内嵌播放。点按屏幕底部可查看节目信息，播放期间也能打开菜单。画中画仍是独立播放选项。

设备冒烟检查：[Mode B清单](docs/mode-b-device-smoke.md)与`./scripts/smoke-capacitor-device.sh --help`（构建/同步仅针对iOS）。Tauri桌面冒烟检查：[桌面清单](docs/mode-b-tauri-smoke.md)。

<a id="installation"></a>

## 安装

| 平台 | 软件包 | 说明 |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Apple Silicon与Intel分别构建；未配置Apple签名时使用临时签名 |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | 多种发行版 |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode 或 Homebrew Channel](docs/lg-webos-installation.md)；托管播放器，需要网络连接 |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode 和本地签名；未签名的电视软件包，与 Family Hub 分开](docs/samsung-tizen-installation.md) |
| **iOS** | 通过AltStore / TestFlight / Xcode安装`.ipa` | 仅侧载，尚未上架App Store |
| **Android（共享前端）** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | 已签名Capacitor包；选择支持的Android版本 |
| **Android（原生Kotlin）** | 独立[原生应用](https://github.com/open-ott-play/ottplay-android) | 公开仓库，独立应用与发布工作流 |

支持的安装包附在通过资格验证的GitHub发布中：[https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **注意：**没有Apple签名凭据时，macOS应用包采用临时签名，不提供Developer ID或公证。Windows/Linux安装包和iOS发布包可能未签名。安装到iOS真机前必须签名。通过资格验证的Full和API 22 Android发布APK使用既定签名证书；本地release构建需要配置keystore才能生成已签名APK。

---

<a id="macos"></a>

### macOS

1. 从[发布列表](https://github.com/open-ott-play/ottplay-foss/releases)选择所需标签。最新发布快捷入口选择stable，而非beta或RC。
2. Apple Silicon下载`OttPlay.FOSS_*_aarch64-apple-darwin.dmg`，Intel下载`OttPlay.FOSS_*_x86_64-apple-darwin.dmg`。它们是独立架构构建。
3. 打开`.dmg`并将**OttPlay FOSS.app**拖入“应用程序”。
4. 首次运行前验证复制的应用包：

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

验证成功表示应用包完整性通过。`Signature=adhoc`表示没有Apple认证的开发者身份，不能证明经过公证或Gatekeeper批准。即使下载可信且应用包有效，首次尝试启动后macOS仍可能要求**系统设置 → 隐私与安全性 → 仍要打开**；参见[Apple说明](https://support.apple.com/en-us/102445)。

“应用已损坏”不只意味着隔离属性问题。若签名验证失败，请保留错误并取得修复版本。不要重新签署下载的应用或删除属性来让失败的验证看起来成功。

ZIP替代包为`OttPlay.FOSS_aarch64-apple-darwin.app.zip`和`OttPlay.FOSS_x86_64-apple-darwin.app.zip`。解压、磁盘映像和Gatekeeper检查见[macOS签名及产物验证](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact)。检出源码构建和本地安装请使用[本地macOS交付](docs/macos-local-delivery.md)。

---

<a id="windows"></a>

### Windows

1. 从[发布页面](https://github.com/open-ott-play/ottplay-foss/releases/latest)下载`.msi`或`.exe`。
2. 运行安装程序并按提示操作。
3. 从开始菜单或桌面快捷方式启动。

---

<a id="linux"></a>

### Linux

Linux播放除WebKitGTK外还需要GStreamer HLS、H.264和AAC插件。软件包声明这些媒体依赖；AppImage构建内置媒体框架。编解码器检查以及浏览器和原生验收之间的区别见[Linux媒体打包](docs/linux-media-packaging.md)。

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

### iOS安装

在iOS真机安装前必须签名。可使用AltStore Classic安装未签名发布IPA，或通过Xcode从源码构建并签名。TestFlight如有提供，需要单独邀请。

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### 选项1：AltStore Classic（推荐个人使用）

AltServer运行于电脑；AltStore Classic运行于iPhone/iPad并导入IPA。免费Apple账户即可。

**前提条件：**

- 当前OTT-play构建要求iPhone/iPad运行**iOS/iPadOS 15或更新版本**。
- 装有AltServer的Mac或Windows电脑，以及USB数据线。
- 用于签名的Apple账户，以及下载发布包所需的互联网连接。

**步骤1：一次性设置AltStore**

1. 按照官方[macOS设置](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos)或[Windows设置](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows)安装AltServer。启动后使用其菜单栏/系统托盘图标。
2. 通过USB连接设备、解锁，并接受电脑/设备信任提示。在Mac上确认Finder能看到设备。
3. 在**AltServer菜单 → Install AltStore**选择设备并完成签名账户提示，等待安装通知。
4. 在设备打开**设置 → 通用 → VPN与设备管理**，按要求信任签名账户的开发者项目。iOS 16+还需启用**设置 → 隐私与安全性 → 开发者模式**，完成设备重启/确认提示。
5. 在设备打开AltStore。若已经安装且工作正常，可跳过设置，保持AltServer运行以进行下方导入。

**步骤2：在iPhone/iPad上导入选定版本**

1. 从[所有发布](https://github.com/open-ott-play/ottplay-foss/releases)选择准确标签，在设备Safari下载其`ottplay-foss-ios-unsigned.ipa`。[最新发布快捷入口](https://github.com/open-ott-play/ottplay-foss/releases/latest)选择稳定版；安装beta请用完整列表。
2. 将IPA保存到“文件”。在**AltStore → My Apps → +**选择该文件。也可从Mac通过AirDrop传输已下载IPA，保存到“文件”后再导入。在Mac打开IPA不属于此导入步骤。
3. AltStore签名和安装时保持AltServer运行并连接USB线。更新时使用与现有安装相同的签名账户，不要先删除应用来排障。
4. 等待导入完成，在**My Apps**中检查OTT-play，然后启动。

**替代方式：直接导入发布URL**

已安装AltStore时，在**iPhone的Safari**输入以下模式，将`TAG`替换为准确发布标签，并接受**在AltStore中打开**：

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

这使用AltStore的[安装URL处理器](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift)。多个下载同名时可避免“文件/最近使用”条目的歧义。URL必须指向IPA资产，而非发布页面。

例如，下方导入曾于**2026-09-29**通过AltStore 2.3和AltServer 1.8.1验证。这是固定历史示例，不是最新版本链接：

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**刷新：**免费账户安装七天后过期。保持AltServer可访问，并在到期前使用**AltStore → My Apps → Refresh All**。后台刷新也需要访问AltServer；参见[AltStore刷新说明](https://faq.altstore.io/altstore-classic/your-altstore)。

<a id="verify-the-installed-version-before-retrying"></a>

#### 重试前确认已安装版本

AirDrop的“已发送”仅证明传输完成。AltStore进度条仅证明导入开始。镜像/USB连接中断不能证明安装失败：再次提交IPA前先检查已安装应用。

在安装Xcode并将其选为活动开发者目录的Mac上，可不重装而检查设备：

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

在JSON的`result.apps`中找到OTT-play（`bundleIdentifier`以`play.ott.foss`开头），将`version`和`bundleVersion`分别与选定IPA的`CFBundleShortVersionString`和`CFBundleVersion`比较。包标识符带有AltStore签名账户后缀是正常现象。设备报告请留在本地。

已验证的beta.9示例报告**版本`1.1.51`，构建`2.2.66`**。这确认安装完成；启动应用、Cloudflare登录、加载播放列表、播放和画中画仍须分别进行设备检查。

<a id="troubleshooting-ios-installation"></a>

#### iOS安装排障

- **AltServer没有窗口，或通过自动化打开时超时：**使用菜单栏/系统托盘图标。它是后台应用。反复尝试打开普通应用窗口不会执行IPA导入。
- **“Could not find AltServer”或USB设备不可用：**确认AltServer正在运行，解锁手机并检查电脑/设备信任提示。Mac上检查Finder是否可见。若连接断开，在安全时重新连接，再检查已安装版本后才重试。持续出现时按[AltStore连接排障](https://faq.altstore.io/altstore-classic/troubleshooting-guide)处理。若手机为电脑提供互联网连接，应协调线缆或网络变更，以免中断其他工作。
- **iPhone镜像显示“iPhone in Use”或一直“Connecting”：**在真机完成设置，或锁定手机屏幕并放在已解锁Mac附近进行镜像。解锁手机会结束镜像；USB信任/设置可能需要先解锁。重新连接一次仍卡住时，退出镜像并在手机继续。参见[Apple镜像要求](https://support.apple.com/en-us/120421)。安装不强制要求镜像。
- **镜像中URL丢失拉丁字母或变成西里尔文：**将**Mac输入源切换为ABC/英语**。焦点在镜像时按**Control–Space**，为iPhone硬件键盘选择**English (US)**。Mac与iPhone输入源可能不同；已验证会话中只更改Mac不足以解决。清空输入框，重新输入URL，提交前检查地址。
- **粘贴到镜像时卡住或插入意外文本：**清空输入框，使用iPhone的English (US)输入源分小段慢慢重输，或直接在手机输入URL。快速镜像输入可能丢字或重复，保存前检查完整地址。不要提交只粘贴了一部分的URL。我们安装时粘贴失败；直接URL方式并不依赖粘贴。
- **“文件/最近使用”中有多个同名IPA：**选择准确下载位置，或使用上方带标签的直接URL。为便于识别，可将本地副本重命名为包含标签/构建号的名称；重命名不改变内容。
- **已安装应用无法打开：**按手机上的开发者信任或开发者模式提示操作。检查AltStore中的到期时间，必要时刷新。若仍失败，记录实际错误；仅有连接错误不应成为删除重装应用的理由。
- **OTT-play可打开，但受保护播放列表在蜂窝网络失败：**安装与来源认证是独立步骤。通过**设置 → 管理设置 → 来源访问**登录已配置来源，再重新加载列表。按要求在真机完成生物识别/passkey或邮件验证码提示。来源必须支持[iOS Access集成](docs/ios-source-access.md)；安装应用不会绕过IP允许列表。
- **连接可信Wi-Fi时仍请求passkey：**对于集成iOS Access的来源，应用先尝试不登录访问原始来源，仅在访问被拒后才使用已认证移动入口。检查来源实际看到的公网IP，包括IPv6：允许的家庭IPv4不能涵盖不同IPv6、VPN或蜂窝地址。网络改变和重新打开应用会清除临时路由偏好。普通网络/服务器错误不应触发登录。
- **不再提示登录，但频道列表为空：**有效已保存会话会复用，不再提示。此前加载失败或服务器修复后，重新加载播放列表，或完全关闭后重新打开应用一次。若仍失败，确认来源返回播放列表而不是HTML登录页或JSON错误。记录显示错误及HTTP状态；不要分享含凭据、Cookie或Access令牌的来源URL。
- **频道加载了，但视频缓冲或报`SRC_NOT_FOUND`：**播放列表加载与视频播放是独立检查。登录后重试频道一次；若持续发生，检查HLS清单、分段响应及流的编解码器支持。此错误本身不能证明切换引擎或重装应用会有帮助。

<a id="option-2-testflight-if-available"></a>

#### 选项2：TestFlight（如有提供）

若发布了TestFlight邀请，请从App Store安装TestFlight，在设备打开邀请并点按**安装**。下载GitHub IPA不会自动提供TestFlight邀请。

<a id="option-3-xcode-for-developers"></a>

#### 选项3：Xcode（供开发者使用）

按照[构建与打开](docs/capacitor-mobile.md#build-and-open)操作，在Xcode选择**App**目标，在**Signing & Capabilities**配置开发团队，选择已连接设备并构建/运行。按要求完成设备信任和开发者模式提示。把未签名发布IPA导入Xcode的Devices窗口不会补齐缺少的签名身份或预置描述文件。

---

<a id="android-application"></a>

### Android应用

若需要共享播放器界面，请选择本仓库发布的Full Capacitor APK。Android 5.1–6使用API 22兼容APK，需要WebView 60或更新版本。更新时保持应用身份和签名证书，以便继续使用已有配置。参见[构建说明](android/README.md)及[分发、签名与远程安装](docs/android-distributions.md)。

独立的[ottplay-android仓库](https://github.com/open-ott-play/ottplay-android)包含原生Kotlin/Compose应用。它有独立身份、偏好和发布工作流，不会原位替换Capacitor安装。历史发布资产仍然可用。

---

<a id="quick-start"></a>

## 快速入门

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

浏览器冒烟测试请使用自己部署的同一修订。

使用Node 22和Rust stable工具链。从仓库根目录运行服务器，以便访问静态资源。原生构建需要下文平台工具链；仅服务器构建不需要。

首次加载时选择**试用演示**，或打开**设置 → 更换提供商 → M3U / M3U8播放列表**。打开**选择播放列表**，选择槽位，输入**播放列表URL**，保存编辑并选择**加载播放列表**。播放列表或提供商账户由你提供；应用不提供付费频道订阅。

<a id="mode-a-companion-smoke"></a>

## Mode A配套服务器冒烟测试

基于curl测试Mode A配套服务器（`ottplay-server` / `archive/server.py`行为一致性）：首页、静态目录、`/logo`、`/version`、可选`/epg`，以及不发起抓取的`POST /m3u/cp.php`探测。

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

检查定义在`scripts/modea-smoke-checks.json`，不含秘密。命令队列 / `local_proxy.py`（:8081）由`scripts/smoke-command-queue.sh`单独覆盖（若存在）。

<a id="classic-stalker--ministra-portals"></a>

## 经典Stalker / Ministra门户

选择**Stalker门户**，输入提供商发放的MAC和完整门户URL，例如`http://provider.example/stalker_portal/c/`。`/c/index.html`、`/stalker_portal`、`/server/load.php`、`/load.php`和`/portal.php` URL选择经典MAG协议。现有裸服务器配置保留JSON-RPC。提供商通过共享Stalker核心加载配置、分类和分页直播频道，然后在后台通过经典`type=vod`协议发现电影和嵌套分集。文件夹路径成为常规频道列表中的分类；可用的简介、海报和稳定的全局收藏使用同一媒体界面。参见[目录行为与限制](docs/stalker-media.md)。

自行托管的浏览器版本通过配套服务器的`/stalker/api`端点发送请求；原生应用使用现有HTTP传输。使用托管服务的浏览器版本需要明确配置经由[专用中继](docs/stalker-relay.md)的路由。浏览器和服务器资产必须一起更新。

打开直播流时会解析临时频道命令；切换频道、停止、画中画和更换提供商会取消过期解析。显式的非临时HTTP(S)命令直接播放。支持短EPG。此提供商不开放经典门户回看和独立的`type=series`协议变体。现有JSON-RPC回看/节目指南行为不变。通过配套服务器路由访问的私有局域网门户与其他配套代理路由一样，需要准确的`OTTPLAY_PROXY_LAN_ORIGINS`条目。

Infomir公开演示为`http://middleware-stalker.com/stalker_portal/c/`。它在2026-09-26返回三个直播目录条目，但媒体端点不可用；播放回归请使用可控门户/媒体测试数据。

<a id="m3u-stream-proxy-header-smoke"></a>

## M3U流代理请求头冒烟测试

比较Mode A配套服务器`POST /m3u/cp.php`抓取可控回显URL时注入的上游请求头（默认本地模拟，不访问IPTV提供商，不使用秘密）。

契约来自`src-rs/core/src/m3u.rs` + `archive/server.py`：
- 仅注入**User-Agent**（默认为`OTT-play-FOSS/1.0`，或使用`webos` / `tizen` / `viera` / `mag` / `dune`预设）。
- **不**注入**Referer**（Capacitor的`M3UProxy`会注入，Mode A不会）。
- 去掉`url`开头的`@`（提供商jQuery表单）。

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

退出码：`0`通过，`1`未监听，`2`请求头/HTTP不匹配，`3`用法/依赖错误。与`smoke-modea-companion.sh` / `smoke-command-queue.sh`配套。

<a id="logo-concurrent-bench-smoke"></a>

## Logo并发基准冒烟测试

对Mode A配套服务器并发`GET /logo/<id>.svg`（可选`?ch=`）进行延迟冒烟测试。报告成功/失败次数及p50/p95/p99。默认使用适合CI本地的实际负载（`CONCURRENCY=200`、`TOTAL=1000`）；完整一万次持续测试为可选（`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`）。

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

退出码：`0`通过，`1`未监听/连接失败，`2`错误率高，`3`用法错误。与`smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`配套。

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## XMLTV缓存刷新/预热冒烟测试

依据`src-rs`准确验证Mode A配套服务器XMLTV/EPG缓存行为，不虚构API：

- 内存`EPG_CACHE`由`GET /epg/:hash`提供，始终返回`{"epg_data":[...]}`（HTTP 200）。
- 进程启动后后台抓取`EPG_URLS`，不延迟HTTP启动；每次抓取完成后等待**2小时**再刷新。
- 配置`DATABASE_URL`时可选SQLite持久化，没有公开缓存状态端点。
- 可选重启后，`GET /health` → `OK`确认HTTP就绪。使用`--strict-epg`和`--epg-hash`时，测试还会在同一个`--warmup-timeout`时间预算内等待该频道非空EPG。

默认路径只使用curl，**不会终止进程**。传入`--restart-cmd` / `RESTART_CMD`可自动终止并重启，或按`--help`中的手动`launchctl`步骤操作。

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

退出码：`0`通过，`1`未监听，`2`断言/预热失败，`3`用法错误。与`smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`配套。

<a id="mode-a-e2e-play-path-smoke"></a>

## Mode A端到端播放路径冒烟测试

配套服务器侧的**播放路径/流就绪**冒烟测试，仅HTTP，**不是**带图形界面的端到端UI测试。它针对正在运行的Mode A配套服务器检查：

- 健康检查或首页可访问。
- 静态播放器外壳资产（`/`、`/styles/player.css`、`/js/jquery-…`、`/f/…`）。
- 设置`EPG_HASH`时可选检查`GET /epg/<hash>.json`。
- 使用无秘密JSON测试数据（空列表加一个合成频道）调用`POST /m3u/match-channels`。
- 流代理**播放**：向可控媒体测试源（默认本地HLS列表，或`MEDIA_URL`）调用`POST /m3u/cp.php`，断言HTTP 200、非空响应及预期`Content-Type`，验证首批字节经过代理。

不使用私有IPTV凭据。与`smoke-modea-companion.sh`（存在性）、`smoke-m3u-stream-proxy-headers.sh`（UA/Referer）、`smoke-xmltv-cache-refresh.sh`配套。

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

退出码：`0`通过，`1`未监听，`2`断言失败，`3`用法/依赖错误。

<a id="capacitor-device-smoke-mode-b"></a>

## Capacitor设备冒烟测试（Mode B）

用于Mode B Cap的模拟器/仿真器（可选真机）**清单**，不是Mode A配套服务器HTTP测试。人工标记UI通过；辅助工具自动检查工具链、原生目录及宽松命令队列curl探测。

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

详情：[docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md)。与`smoke-command-queue.sh`（Cap回环）配套，不要与上方Mode A冒烟测试混淆。

<a id="tauri-desktop-smoke-mode-b"></a>

## Tauri桌面冒烟测试（Mode B）

Mode B Tauri的桌面清单和辅助工具，检查窗口/频道播放/画中画。不是Mode A配套HTTP测试，也不是Cap设备测试。

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

详情：[docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md)。本地冒烟测试不强制Apple开发者凭据；打包Mac应用可用[临时签名](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials)。人工验收仍需覆盖启动、播放和画中画。

<a id="docker"></a>

## Docker

多架构镜像（amd64/arm64）先构建为候选OCI归档。注册表发布会将批准的stable归档原样提升到Docker Hub，不重新构建；参见[运维手册](docs/release-workflow.md)。

服务器二进制在**musl**（Alpine）上构建并以Alpine交付，**不**要求GLIBC_2.38+。因此`alvit/ottplay-foss`可以运行在Synology DSM Docker（x86_64）及其他glibc较旧的主机上。

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

稳定注册表标签使用`X.Y.Z`。发布带版本镜像后，更新`latest`是另一个必须明确选择的选项；推送main和Git标签不会发布镜像。

<a id="build-from-source"></a>

## 从源码构建

播放器领域规则来自`vendor/ottplay-core.js`中锁定的Kotlin多平台产物。节目指南、回看、播放列表、提供商、持久状态与播放决策同FOSS2和原生Android共享实现。浏览器/电视、Swift和Rust适配器保留设备API、编解码器、网络及UI效果。浏览器产物保留ES5语法与受支持的旧API引导。`npm test`、`check:bundle`和`check:es5`验证集成；产物清单记录源码与输出哈希。

Control-server和SWOP协议验证器从版本化的`contracts/ottplay-wire-v1.json`模式生成。经检查的生成器凭据与不可变兼容性测试数据，避免各消费者复制自己的策略。

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

## 设备识别

播放器支持24类设备。首先通过URL `/f/{device_id}/`识别，再通过User-Agent识别。

| 设备ID | 设备 |
|---|---|
| `pc` | PC浏览器 |
| `pc2` | videojs网页播放器 |
| `nodejs` | Windows应用（Electron） |
| `lg/webos` | LG WebOS电视 |
| `samsung/tizen` | Samsung Tizen电视 |
| `samsung/maple` | Samsung Orsay电视 |
| `mag` | Infomir MAG机顶盒 |
| `dune` | Dune HD机顶盒 |
| `android` | Android TV / 平板 |
| `hbbtv` | HbbTV电视 |
| `panasonic` | Panasonic Viera电视 |
| `philips` | Philips电视 |
| `sony` | Sony电视 |
| `sharp` | Sharp电视 |
| `toshiba` | Toshiba电视 |
| `hisense` | Hisense电视 |
| `skyworth` | Skyworth电视 |
| `tcl` | TCL电视 |
| `vewd` | Vewd设备 |
| `spark` | Spark接收器 |

<a id="push-command-system"></a>

## 推送命令系统

若需要独立多设备服务，请使用[OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server)和**设置 → 远程控制**中的**命令服务器**部分。输入其IP/地址和本播放器设备访问码；两者保存后自动开始轮询音量、频道及其他命令。未带端口的IP使用HTTP 8081。清除地址或选择**断开连接**即可停止。此出站连接支持确认交付，不需要本地监听器。参见[连接与兼容性详情](docs/remote-command-server.md)。下方示例介绍现有本地代理/监听器模式。

**查找命令服务器**可以发现控制器并请求操作员批准，无需复制设备令牌。Tauri先检查原生DNS；如果结果为空，可以回退到明确配置的部署配置文件。浏览器、LG和Capacitor播放器使用浏览器配置文件路径。Home发现元数据可以独立于控制器托管在here.now上。通用构建不会自动包含此Home配置文件，更新也不会替换已保存的连接。参见[平台行为、配置文件设置及故障排除](docs/remote-command-server.md#discovery-and-one-time-approval)。

浏览器/OTT服务器播放器、Tauri和Capacitor中的本地HTTP远程控制均**默认关闭**。在**播放器设置 → 远程控制**中启用以生成秘密设备码。命令是带`"command"`字段的JSON对象；HTTP请求需要`Authorization: Bearer <device-code>`。

<a id="architecture"></a>

### 架构

<a id="local-command-url-recommended"></a>

#### 本地命令URL（推荐）

在**播放器设置 → 远程控制**启用**本地HTTP远程控制**，复制生成的**设备码**，用该码配置下方代理。将**本地命令URL**设为代理命令端点。启用后，播放器每10秒轮询该URL，设备码放在Authorization头中。仅设置URL不会启用命令控制。

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### 设备UUID

现有设备UUID（如`dev_a1b2c3d4e5`）是公开路由元数据，不是授权凭据。独立的**设备码**在启用本地HTTP控制时安全生成并留在本设备，不通过云设置复制。禁用本地HTTP控制会停止轮询/监听器。重新启用会生成新码：更新代理和集成以撤销旧凭据。

Tauri与Capacitor仅在设置中主动启用后才启动回环HTTP监听器。转发代理必须以Bearer令牌向监听器发送显示的设备码。Mode A使用下方单独配置的`local_proxy.py`队列。

<a id="remote-text-entry-swop"></a>

#### 远程文字输入（swop）

用途：电视和手机处于**不同网络**时，通过Cloudflare Worker会话接力，在手机上为♥™ / 远程虚拟键盘输入。

- Worker仓库：[ottplay-swop](https://github.com/open-ott-play/ottplay-swop)。
- **安装授权：**播放器将请求发到服务器同源的`/swop`中继。服务器添加私有安装令牌；注册服务器来源下的所有客户端均可使用远程输入。设备UUID识别会话，不需要逐设备允许列表。
- 设置：`swopBaseUrl`（空值表示♥™显示“未配置”且不执行）。在**设置 → 远程控制**（按键**2**）编辑，或在运维安装中通过Git忽略的`/local/swop.json`注入。
- `POST /session`包含`clientId`、`caption`和`draft`；`POST /val`包含`clientId`、`code`及返回的`sessionToken`。手机URL包含独立写令牌。会话读令牌保存在浏览器内存。
- **本地安装：**在Worker中注册该安装及其精确LAN/localhost来源后，设置`SWOP_BASE_URL`和`SWOP_INSTALLATION_TOKEN`。`scripts/install-ottplay-local-service.sh`将其保存在私有、权限0600的launchd plist中。公开`/local/swop.json`仅含`{"swopBaseUrl":"/swop"}`。绝不要把安装令牌放入公开资产。
- **静态托管：**为相同两个端点配置服务器端认证代理。安装令牌保存在托管服务的秘密存储中。复制公开播放器文件不会复制该服务器凭据。

> 中央OTT服务器对所有HTTP方法禁用`/api/webhook/commands`、`/webhook/poll`、`/webhook/notify`及命令健康检查别名。Mode A请使用独立命令服务器或明确配置且经过认证的`local_proxy.py`；中央服务器没有广播命令队列。

<a id="available-commands"></a>

### 可用命令

下方所有示例以`http://192.168.1.50:8081/api/webhook/commands`作为本地代理URL。请替换成实际代理地址，并将`OTTPLAY_QUEUE_HTTP_TOKEN`设为在播放器设置中启用HTTP控制后显示的**设备码**。代理必须配置同一码。

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — 显示通知弹窗

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `message` | 字符串 | 必填 | 显示文本 |
| `popup_duration` | 数字 | 5 | 右上角显示的秒数 |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — 按列表位置切换频道

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `channel_number` | 数字 | 必填 | 列表中从1开始的频道位置 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — 按完整或部分名称切换频道

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

不区分大小写的子串搜索，采用首个匹配。

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `channel_name` | 字符串 | 必填 | 频道名或部分名称 |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — 切换到随机频道

此旧版命令从当前列表或分类中选择符合条件的频道。频道编号和范围指的是该列表中的位置；请参阅[安全随机选择规则](docs/remote-command-server.md#safe-random-playback)。

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

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `random_range` | [起点, 终点] | 当前列表 | 从1开始的范围 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — 切换IPTV提供商

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `provider` | 数字 | 必填 | 提供商数组中的索引（0=m3u、1=stalker、2=xtream等） |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — 加载新M3U播放列表

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `playlist` | 字符串 | 必填 | M3U播放列表URL |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — 更新提供商配置

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `provider_settings` | 字符串 | 必填 | 含提供商配置的JSON字符串 |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — 设置或调整音量

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

不支持音量控制的客户端会静默忽略。

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `volume` | 数字 | — | 绝对音量0–100 |
| `volume_step` | 数字 | — | 相对变化，例如+10或-5 |

<a id="player-standby-restart-and-exit"></a>

#### 播放器待机、重启与退出

本地代理不带确认的webhook队列不支持`exit_player`或类型化待机/唤醒请求。请把播放器连接到[命令服务器](docs/remote-command-server.md)，并使用其CLI：

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

将`d1`替换为已注册播放器别名。`stop`是`standby`的别名；`start`和`wake`是`go`的别名。Go要求播放器正在运行且已连接，不能启动已关闭的应用或唤醒离线设备。没有原生应用退出能力的浏览器或电视会报告不支持退出。待机会保持远程轮询，不会暂停无关宿主或共享服务器工作。

执行standby/go后，用`ott d1 status`检查待机/后台状态，并单独验证恢复播放。播放器重新加载后，用`ott d1 doctor`确认新的运行时。退出后，通过操作系统确认应用进程已关闭；远程超时不能证明退出。命令被接受本身不能确认这些结果。

<a id="local-proxy-server"></a>

## 本地代理服务器

`local_proxy.py`是面向一个播放器的独立认证命令队列。默认调用会直接退出，不打开端口。每个代理实例使用播放器生成的设备码；多个播放器需要独立实例/端口。`device_id`查询参数仅作为兼容性元数据接受，绝不用于认证或选择其他设备。

<a id="start-the-proxy"></a>

### 启动代理

1. 在播放器启用**本地HTTP远程控制**，复制其**设备码**。
2. 在代理主机配置该码和提供播放器的精确来源（协议、主机和端口，不含路径）：

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. 将播放器的**本地命令URL**设为`http://192.168.1.50:8081/api/webhook/commands`。

默认绑定地址是`127.0.0.1`；示例显式启用LAN访问。`OTTPLAY_QUEUE_HTTP_ORIGINS`是逗号分隔的精确浏览器来源允许列表。若通过HTTPS提供播放器，请使用HTTPS反向代理，使浏览器混合内容规则允许轮询。设备码应保密且不得放入URL。播放器生成新码后，用新值重启代理；仅禁用播放器不会停止独立管理的代理进程。

<a id="endpoints"></a>

### 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/webhook/commands` | 将命令入队 |
| `GET` | `/api/webhook/commands` | 取出排队命令（播放器轮询） |
| `POST` | `/webhook/notify` | 经过认证的兼容别名 |
| `GET` | `/webhook/poll` | 经过认证的兼容别名 |

发送和取空队列都需要匹配的Bearer设备码，没有未经认证的广播端点。命令60秒后过期；每个代理最多保留50条命令。

代理最多并发处理16个连接，因此空闲浏览器连接或不完整请求不会延误其他命令请求。每个套接字有五秒不活动超时；所有工作线程占用时，新增连接会被关闭。跨工作线程的入队和取空操作均为原子操作。

<a id="smoke-script-all-modes"></a>

### 冒烟脚本（所有模式）

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Android模拟器/设备需先运行`adb forward tcp:18081 tcp:18081`。Cap/Tauri仅监听回环；局域网Home Assistant请使用此Mode A代理。详情：`docs/capacitor-mobile.md`的冒烟测试章节。

<a id="cors"></a>

### CORS

代理仅允许来自`OTTPLAY_QUEUE_HTTP_ORIGINS`的浏览器请求。允许来源的预检`OPTIONS`请求无需令牌；每个实际GET/POST都需要Bearer设备码。不接受通配符或`null`来源。Home Assistant及其他非浏览器调用方可省略Origin，但仍须认证。

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### 示例：Home Assistant webhook → 本地代理 → 播放器

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

### Home Assistant自动化示例

弹窗、频道和音量示例使用本地代理。将Home Assistant `secrets.yaml`中的`ottplay_device_authorization`设为`Bearer <device-code>`，使用已启用播放器显示的码。

夜间待机使用独立的[命令服务器](docs/remote-command-server.md)。将下方示例URL和`DEVICE_UUID`替换为控制器地址和已注册设备ID；本地CLI别名`d1`不是设备ID。在`secrets.yaml`中将`ottplay_control_authorization`设为`Bearer <controller-admin-token>`。此凭据与本地代理设备码不同。参见Home Assistant的[RESTful Command](https://www.home-assistant.io/integrations/rest_command/)和[secrets](https://www.home-assistant.io/docs/configuration/secrets/)文档。

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

`standby_request`包含供自动化追踪使用的HTTP响应。HTTP 202仅表示已入队：保留其`content.id`，然后使用相同控制器凭据轮询`GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID`取得播放器回复。新的`status`请求可观察`player.standby`和`player.background`；待机开启、状态为`suspended`且待处理数量为零，才确认播放器跟踪的工作已排空。退出待机时使用同类类型化请求并设置`"operation":"wake"`（`ott d1 go`）。超时后不要盲目重复修改操作。参见控制器[请求/响应API](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1)和[待机语义](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake)。

<a id="server-api-reference"></a>

## 服务器API参考

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Webhook端点（Rust `ottplay-server`）

Rust服务器和已归档Python后备实现以HTTP 403拒绝命令端点。`/api/webhook/commands`、`/webhook/notify`、`/webhook/poll`和命令健康检查别名不会入队、广播或取空命令。通用反馈API不能覆盖这些保留路由。Mode A命令交付使用上文单独配置的命令服务器或认证本地代理。

<a id="other-endpoints"></a>

### 其他端点

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/epg/<hash>.json` | 频道EPG数据 |
| `GET` | `/logo/<id>.svg` | 生成频道图标 |
| `GET` | `/version/<path>` | 文件版本哈希 |
| `POST` | `/m3u/match-channels` | 频道与EPG匹配 |
| `POST` | `/m3u/match-logos` | 频道图标匹配 |
| `POST` | `/m3u/cp.php` | 流代理 |
| `GET/POST` | `/feedback/` | 反馈日志 |
| `GET` | `/tmdb/*` | TMDb API代理 |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## 项目结构

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

## 机顶盒按键映射

- **Samsung Tizen**：`RETURN=10009`、`ENTER=13`，彩色键403–406。
- **Samsung Maple**：方向键4/5/6/8，原始SDK代码。
- **LG WebOS**：`RETURN=461`，兼容HbbTV的彩色键。
- **LG NetCast**：`RETURN=8`，HbbTV代码。
- **MAG**：`RETURN=8`，通过gSTB API获取MAC。
- **Dune HD**：标准代码，Dune API。
- **Android TV**：Android键码（`BACK=4`、`DPAD_*` 19–22、`ENTER=66`）。
- **HbbTV/Panasonic/Philips/Sony等**：HbbTV代码（`RED=403`、`BLUE=406`、`VOL_UP=447`）。

<a id="documentation"></a>

## 文档

- [文档wiki](./docs/wiki/Home.zh-Hans.md) / [俄语wiki](./docs/wiki/Home.ru.md)——按任务组织的导航与维护规则。
- [实现报告](./docs/implementation-report.zh-Hans.md) / [俄语流程与结果](./docs/implementation-report.ru.md)——彩色图表、已验证行为、实测成本与发布关卡。
- [交付指南](./docs/roadmap-delivery.zh-Hans.md) / [俄语新功能指南](./docs/roadmap-delivery.ru.md)——功能、限制与验证。
- [88种界面语言的快速入门](./docs/readme/README.md)——从随应用交付的UI翻译生成；主手册和成对功能指南提供[24种文档语言](docs/manual-translations.md)。
- [画质上限与直播恢复](./docs/playback-stream-policy.zh-Hans.md) / [俄语](./docs/playback-stream-policy.ru.md)。
- [手动XMLTV映射与经典界面无障碍](./docs/guide-binding-accessibility.zh-Hans.md) / [俄语](./docs/guide-binding-accessibility.ru.md)。
- [托管音视频检查](./docs/audio-video-check.zh-Hans.md) / [俄语](./docs/audio-video-check.ru.md)。
- [Xtream媒体库](./docs/xtream-media.zh-Hans.md) / [俄语](./docs/xtream-media.ru.md)。
- [同源设备接力](./docs/remote-handoff.zh-Hans.md) / [俄语](./docs/remote-handoff.ru.md)。
- [可恢复的本地设置](./docs/settings-recovery.zh-Hans.md) / [俄语](./docs/settings-recovery.ru.md)。
- [浏览器世代、操作系统和精确候选发布检查](docs/browser-compatibility.zh-Hans.md) / [俄语](docs/browser-compatibility.ru.md)。

- [播放器架构](./docs/architecture.md)——运行时职责、提供商集成、播放、节目指南、设备适配器和构建契约。
- [经典ES5构建流水线](./docs/build-pipeline.md)——编译、兼容性检查和产物大小限制。
- [运行时资产名称与部署迁移](./docs/asset-layout.md)——网页和原生包共用的描述性路径。
- [远程工作台](./docs/remote-workbench.md)——UI/媒体检查、操作凭据和保存的证据。
- [运行时诊断](./docs/runtime-debug.md)——错误历史、帧/循环计数器、Capacitor/Tauri原生指标和服务器调试。
- [本地macOS交付](./docs/macos-local-delivery.md)——检出源码构建、本地安装和验证。

<a id="license"></a>

## 许可证

[MIT](LICENSE)——自由开源。提供商内容和第三方依赖保留各自权利与许可证。

基于 PlxNative 的独立应用 [OTTPlay native webOS](docs/native-webos.md) 按 **GPL-3.0-or-later** 许可证分发，并提供对应的源代码。
项目根目录中的 MIT 许可证不会改变此原生应用或其补丁的许可证。

<a id="desktop-updater--notarization-mode-b"></a>

## 桌面更新器/公证（Mode B）

[桌面签名与更新器指南](docs/tauri-updater-notarize.md)介绍macOS临时签名、可选Developer ID/公证和应用包验证。没有Apple凭据时发布CI采用临时签名。更新器签名单独处理；生产自动更新仍未配置。

<a id="local-mac-build-helpers"></a>

## 本地Mac构建辅助工具

参见[docs/local-build-scripts.md](docs/local-build-scripts.md)。

<a id="privacy"></a>

## 隐私

本地设置、已配置服务及个人选择见[隐私政策](docs/privacy-policy.md)。隐私与支持联系人：[alvit.work@gmail.com](mailto:alvit.work@gmail.com)。

默认界面主题为Studio 2026。仍可选择Classic和PLi-HD，并保留用户已保存偏好。参见[界面设置](docs/interface-settings.md)。PLi-HD主题致谢Vali、littlesat、VU+NL、Milo及上游贡献者。其英文历史与来源链接见[界面致谢和设计历史](docs/interface-history.md)，也可从播放器信息菜单打开。

<a id="demo-video-editing"></a>

## 演示视频编辑

使用本地[video-use工作流](docs/demo-video.md)准备和编辑演示录屏。辅助工具将所有生成媒体保存在Git之外。

<a id="plex-media-library"></a>

## Plex媒体库

每个播放器都可使用**Plex**提供商连接Plex账户或Plex Media Server。集成使用Plex；Synology只是媒体服务器的一种宿主选择。所有可访问的视频和音乐都会自动加入频道列表，可通过类别选择按媒体库、文件夹或剧集筛选。无需在OTT服务器配置Plex，播放器会从第一批可用数据开始播放并后台加载，支持标准搜索以及操作菜单中的随机/重复。参见[Plex登录与直接播放](docs/plex-provider.md)。

![Plex加载、文件导航与关闭生命周期](docs/images/plex-playback-lifecycle.svg)

[图解可靠性审查](docs/plex-provider.md#reliability-review-process-and-results)说明加载和取消规则、完整目录与文件切换的修复，以及实测Chromium/WebKit验证结果。

可选OTT服务器集成也可通过独立NAS媒体库入口和M3U导出，提供已有Plex服务器目录及兼容播放。参见[服务器端媒体库配置与客户端访问](docs/synology-library.md)。

<a id="related-repositories"></a>

## 相关仓库

- [ottplay-core](https://github.com/open-ott-play/ottplay-core)负责共享JVM/ES5领域逻辑、线协议契约和FOSS2客户端。本播放器使用生成产物；共享改动请遵循核心交付指南。
- [ottplay-android](https://github.com/open-ott-play/ottplay-android)是独立原生Kotlin/Compose应用，具有自己的安装和发布身份。
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server)提供自托管远程命令；[ottplay-swop](https://github.com/open-ott-play/ottplay-swop)提供可选的Worker文字输入传输。
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine)负责浏览器演示的托管配置、演示媒体和发布验证。

<a id="project-maintenance"></a>

## 项目维护

参见[贡献与测试要求](CONTRIBUTING.md)、[安全报告政策](SECURITY.md)、[安全设计](docs/security-design.md)及[OpenSSF证据与剩余标准](docs/openssf-evidence.md)。
