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

인터넷 없이 로컬 파일을 사용하려면 [로컬 동영상과 오프라인 재생](docs/offline-media.md)을 참고하세요.

[![원근감 있게 표현한 OTT-play FOSS 채널 브라우저](docs/images/hero.png)](docs/images/studio-2026-default.png)

*합성 채널 및 프로그램 테스트 데이터를 사용한 기존 Studio 2026 화면입니다. 이미지를 열면 원래 평면 화면을 볼 수 있습니다. 실제 구독 서비스를 캡처한 화면이 아닙니다. [이미지 출처와 재생성](docs/images/README.md).*

[88개 언어 빠른 시작](docs/readme/README.md) · [문서 위키](docs/wiki/Home.ko.md)

[![OpenSSF 모범 사례](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![퍼징: RC만](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

공개 릴리스 후보는 네이티브/서버 XMLTV 파싱과 포털 요청 검증에 대해 범위를 제한하고 격리한 퍼징을 실행합니다. [퍼징 범위, 재현 및 릴리스 증빙](FUZZING.md)을 참고하세요.

로컬 Rust HTTP 서버를 포함한 독립형 IPTV/OTT 플레이어입니다. 스마트 TV(LG WebOS, Samsung Tizen, Panasonic, Sony 등), 셋톱박스(Infomir MAG, Dune HD, Enigma2, Android TV), 데스크톱 브라우저에서 실행됩니다.

런타임 계층, 책임, 공급자 확장 방법과 검증은 [아키텍처 및 기여자 안내](docs/architecture.md)부터 읽으세요. 코어/호스트 경계와 호환성 계약은 [재생 세션과 공급자 수명](docs/playback-session-architecture.md)을 참고하세요.

<!-- ci-release-process:start -->
<a id="release-process"></a>

## 릴리스 과정

검증, nightly, beta, RC 및 stable 승격 규칙은 [릴리스 전략](RELEASING.md), 로컬 명령은 [운영 안내서](docs/release-workflow.md)를 참고하세요.
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## 브라우저에서 실행

[라이브 데모](https://player.ottplay.here.now/)를 열거나 아래 설명에 따라 웹 플레이어를 빌드하고 제공하세요.

[로컬 macOS 배포](docs/local-http-deployment.md)는 포트 8443–8446에서 HTTP 플레이어 오리진을 제공합니다. 포트 8095는 폐기됐습니다.

처음 실행할 때 **데모 체험**을 선택해 움직이는 테스트 패턴을 재생하거나 직접 M3U 재생목록 또는 공급자를 설정하세요. 나중에도 **공급자 변경 → 데모**에서 이용할 수 있습니다.

데모는 인터넷 연결이 필요하지만 공급자 계정은 필요 없습니다. 무음 MP4 및 HLS 테스트 채널은 here.now에서 호스팅하며 웹 플레이어, Tauri, Capacitor, OTT Server가 공유합니다. 전환 시 기존 공급자 설정은 유지됩니다. 별도의 **영상 및 소리 확인**은 관리되는 HTML5 엔진이 대기 중이거나 실시간 TV를 재생할 때 **정보 → 오디오 → 재생**에서 실행하세요. here.now의 소리 있는 `av-v1.mp4` 픽스처를 사용하므로 인터넷 연결이 필요합니다. 이 클립은 플레이어 패키지에 없으며 시작할 때 가져오지 않습니다. VOD, 다시 보기, 장치 엔진 재정의(PC2/Video.js 및 네이티브 엔진 포함)는 제외됩니다. [절차, 예상 소리 및 호스팅 다이어그램](docs/audio-video-check.ko.md)을 참고하세요.

설치된 데스크톱 브라우저 창은 **Window Controls Overlay**를 지원합니다. Chrome은 별도 제목 표시줄을 숨기고 창 버튼과 앱 메뉴를 플레이어 위에 유지할 수 있습니다. 설치된 앱을 열고 Chrome이 제공하면 **제목 표시줄 숨기기**를 선택하세요. **제목 표시줄 표시**로 일반 프레임을 복원합니다. 일반 탭과 TV/네이티브 셸 레이아웃은 기존 동작을 유지합니다. 지원 설치 URL, 기존 바로가기 갱신 및 검증은 [브라우저 창 제어](docs/browser-window-controls.md)를 참고하세요.

기본 동영상 화면에서 10초 탐색하려면 전체 화면 또는 일반 화면에서 **Alt/Option + 왼쪽/오른쪽**을 사용하세요. macOS는 **Command + 왼쪽/오른쪽**도 지원합니다. 로컬 동영상, VOD, 지원되는 채널 다시 보기에 웹, Tauri, Capacitor 공통 제어를 사용합니다. [키보드 단축키 및 제한](docs/browser-window-controls.md#playback-keyboard-shortcuts)을 참고하세요.

PC 인터페이스의 **R**은 목록 순서를 섞지 않고 현재 목록에서 다른 채널이나 동영상을 임의로 재생합니다. 기본 동영상 화면과 채널/동영상 목록에서 작동하며 텍스트 편집기, 대화상자, 설정 및 키오스크 제한이 우선합니다. 다른 장치의 키 매핑은 바뀌지 않습니다.

합성 테스트 패턴은 `scripts/generate-demo-media.sh`로 재생성할 수 있습니다(FFmpeg 필요). 생성 미디어는 Git에서 제외된 `.local-artifacts` 디렉터리에 보관됩니다.

<a id="features"></a>

## 기능

- **재생**: HLS, DASH 및 일반 HTTP 스트림. 관리되는 HLS.js/Shaka 화질 상한, 제한된 복구, 실시간 채널마다 최대 세 개의 명시적 백업 URL을 지원합니다. 다시 보기/VOD는 실시간 백업으로 전환하지 않습니다. [화질 및 복구](docs/playback-stream-policy.ko.md)를 참고하세요.
- **EPG**: XMLTV 매칭, 타임시프트/다시 보기, 프로그램 제목 검색(EPG의 N5), 알림, 호스팅/네이티브 XMLTV 경로에서 정확한 채널의 수동 피드/ID 연결. [연결 및 접근성](docs/guide-binding-accessibility.ko.md)을 참고하세요.
- **즐겨찾기**: 지원되는 환경에서 설정된 공급자와 프로필을 아우르는 하나의 순서 있는 [혼합 모음](docs/mixed-favorites.md), CLI를 통한 이식 가능한 내보내기/가져오기 및 자녀 보호 PIN. 대체 모드에서는 소스별 즐겨찾기 목록을 계속 사용할 수 있습니다.
- **설정**: 설정 및 즐겨찾기 JSON 내보내기/가져오기, 지원 localStorage 배치의 실행 취소 저널, 소스를 구분하는 다시 보기 재개, 컨트롤러 워크플로의 저장 설정 정밀 비교. 복구는 단일 작성자를 가정하며 사용자 정의 저장소 어댑터는 최선의 롤백을 유지합니다. [설정 복구](docs/settings-recovery.ko.md)를 참고하세요.
- **공유 인터페이스**: OTT Server, Tauri, Capacitor는 같은 채널 목록 테마와 표시 설정을 사용합니다. [인터페이스 색상](docs/interface-colors.md)은 9가지 역할별 색상, 팔레트, 정확한 HEX/RGB/HSV 값 입력과 5가지 배색을 제공하며, 설정은 클라이언트별로 저장됩니다. 채널 목록 설정은 채널명, 아이콘, 현재 프로그램, 진행률, 다시 보기 표시를 제어합니다.
- **공급자**: M3U/M3U8, Xtream 실시간 TV와 [주문형 영화/시리즈 카탈로그](docs/xtream-media.ko.md), [영화와 중첩된 에피소드](docs/stalker-media.md)를 지원하는 Stalker/Ministra, Plex, VPortal. 공급자 기능과 계정 접근 권한에 따라 다시 보기와 미디어 라이브러리 기능이 결정됩니다.
- **푸시 명령**: webhook 원격 제어로 채널, 공급자, 재생목록을 바꾸거나 팝업을 표시합니다.
- **원격 텍스트 입력(swop)**: TV와 휴대전화가 다른 네트워크에 있을 때 Cloudflare Worker를 통한 휴대전화 키보드 사용(설치 승인 세션, 가상 키보드의 ♥™).
- **장치별 라우팅**: 다중 장치 설정을 위한 UUID 기반 주소 지정.
- **로컬 프록시**: 선택적 로컬 명령 서버로 100% 로컬 자동화, 중앙 서버 불필요.
- **컨트롤러 통합**: 장치/작업 범위 운영자, 선택적 영구 명령 결과, 재개 가능한 Local/Home 프리셋 적용, 대응 [제어 서버](https://github.com/open-ott-play/ottplay-control-server)를 통한 동일 소스 실시간/다시 보기 이어받기. 갱신된 컨트롤러/CLI가 필요하며 독립 브라우저 탭은 이를 제공하지 않습니다.
- **타입이 지정된 원격 설정**: 사용 가능한 설정을 찾고, 저장된 값과 실제 적용 값을 읽으며, 실행 인스턴스·소스·리비전을 확인하여 저장합니다. [원격 설정 및 VPortal 구성](docs/remote-player-settings.md)을 참조하세요.
- **디버그**: `?debug=1`로 선택하는 재생 HUD/순환 로그, 동의 기반 원격 검사, 요청 시 호스팅된 오디오/비디오 확인.
- **키보드 접근성**: 이름 있는 클래식 대화상자, Tab 포커스 제한 및 복귀, 선택 채널 의미 정보, 정중한 상태 알림. 전체 WCAG 또는 장치 화면 읽기 프로그램 준수를 보증하지 않습니다.
- **24개 장치 유형**: 장치별 리모컨 키 매핑.
- **88개 인터페이스 언어**: 일치하는 카탈로그, [현지화 빠른 시작](docs/readme/README.md), [CLDR 검증 키보드 문자](docs/localization.md). 기본 설명서와 대응 기능 안내서는 [24개 문서 언어](docs/manual-translations.md)로 제공하며 다른 엔지니어링 참고 문서는 기존 언어를 유지합니다.

[제공 기능 안내](docs/roadmap-delivery.ko.md)는 이 소스 리비전에 구현된 기능, 플랫폼 경계, 다이어그램 및 검증을 설명합니다. 설치된 릴리스나 호스팅 배포는 이전 리비전일 수 있습니다. 별도 네이티브 [Android 앱](https://github.com/open-ott-play/ottplay-android)도 매니페스트 인덱스 대신 언어, 역할, 레이블로 오디오/자막 선택을 유지합니다. 구현 및 릴리스는 이 프런트엔드와 별개입니다.

[STB 소스 검토](docs/stb-player-improvements.md)는 미디어, 리소스 및 복구 개선 사항과 관련 소스 비교, 현재 제한 사항을 설명합니다.

<a id="debug-hud"></a>

## 디버그 HUD

로컬 HUD와 서버 로그 영구 저장은 별도로 선택합니다. 다른 장치 로그를 수집하기 전에 [진단 접근, 정보 제거 및 보존](docs/diagnostic-security.md)을 읽으세요.

다음 중 하나로 디버그 모드를 켭니다.
- URL: `?debug=1` 또는 `?debug=true`
- 로컬 저장소: `localStorage.setItem("ottplay_debug", "1")`
- 창 속성: `window.__OTT_DEBUG__ = true`
- 서버: `/debug/config`가 `{enabled: true}`를 반환할 때

디버그가 켜지면:
- **D**로 화면 HUD 표시를 전환합니다(`ottDebugSetHud` / `__ottDebug.toggleHud()`).
  - INPUT/TEXTAREA/listEdit에 포커스가 있으면 건너뜁니다.
  - MAG/Maple PLAY/PREV=68 충돌을 피하도록 `e.key`를 사용합니다.
- 정보 메뉴 → **디버그 HUD** → `__ottDebug.toggleHud()`를 호출합니다.
- 설정 관리 → **디버그 HUD**:
  - 이미 디버그가 로드됐으면 HUD 표시를 전환합니다.
  - 아니면 `ottplay_debug=1` + `ottplay_debug_hud=1`을 설정하고 재시작을 안내합니다.
- 영구 저장: `ottDebugSetHud`가 HUD 상태를 `localStorage.ottplay_debug_hud`("1"/"0")에 저장합니다.

<a id="capacitor-ios-and-android"></a>

## Capacitor iOS 및 Android

이 저장소는 공유 TypeScript 프런트엔드를 Capacitor로 iOS와 Android 7+용으로 패키징합니다. 둘 다 시스템 글꼴과 npm으로 잠근 네이티브 런타임을 사용합니다. 별도 API 22 호환 APK는 WebView 60 이상을 갖춘 Android 5.1/6을 지원합니다. 두 Android APK 모두 서명되며 검증된 beta, RC, stable 릴리스에 미서명 iOS IPA와 함께 포함됩니다. 별도 Kotlin 앱은 [ottplay-android](https://github.com/open-ott-play/ottplay-android)에 있습니다.

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

[Capacitor 설정](docs/capacitor-mobile.md)과 [Android 배포 및 원격 업데이트](docs/android-distributions.md)를 참고하세요.

iOS 인터페이스는 가로 방향입니다. 설정, 공급자 구성, 원격 제어 동의, JSON 가져오기/내보내기는 공유 프런트엔드를 사용합니다. 태블릿 멀티태스킹은 요청한 방향을 재정의할 수 있습니다.

iPhone 채널 목록을 세로로 밀어 행과 페이지를 이동하세요. 위로 밀면 뒤 채널, 아래로 밀면 앞 채널입니다. 빠른 플릭은 여러 페이지를 지나 감속해 멈추며, 느린 드래그는 정밀합니다. 화면을 터치하거나 탐색 키를 누르면 멈춥니다. 한 번 탭하면 다른 행이 선택돼 있어도 손가락 아래 채널을 시작합니다. 스와이프 후 손가락을 떼면 채널이 열리지 않습니다.

iPhone에서는 동영상이 인라인 재생됩니다. 화면 아래를 탭해 프로그램 정보를 보거나 재생 중 메뉴를 열 수 있습니다. 화면 속 화면은 별도의 재생 옵션입니다.

장치 스모크 검사: [Mode B 체크리스트](docs/mode-b-device-smoke.md) 및 `./scripts/smoke-capacitor-device.sh --help`(빌드/동기화는 iOS만). Tauri 데스크톱 스모크: [데스크톱 체크리스트](docs/mode-b-tauri-smoke.md).

<a id="installation"></a>

## 설치

| 플랫폼 | 패키지 | 설명 |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Apple Silicon과 Intel 별도 빌드, Apple 서명이 없으면 임시 서명 |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | 여러 배포판 |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode 또는 Homebrew Channel](docs/lg-webos-installation.md); 호스팅 플레이어, 네트워크 필요 |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode 및 로컬 서명; 서명되지 않은 TV 패키지, Family Hub와 별개](docs/samsung-tizen-installation.md) |
| **iOS** | AltStore / TestFlight / Xcode로 `.ipa` 설치 | 사이드로드만 지원, 아직 App Store에 없음 |
| **Android(공유 프런트엔드)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | 서명된 Capacitor 패키지, 지원 Android 버전 선택 |
| **Android(네이티브 Kotlin)** | 별도 [네이티브 앱](https://github.com/open-ott-play/ottplay-android) | 공개 저장소, 별도 앱 및 릴리스 워크플로 |

지원 설치 파일은 검증된 GitHub 릴리스에 첨부됩니다: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **참고:** Apple 서명 자격 증명이 없으면 macOS 앱 번들은 임시 서명되며 Developer ID나 공증을 제공하지 않습니다. Windows/Linux 설치 파일과 iOS 릴리스 패키지는 미서명일 수 있습니다. iOS 실제 장치에 설치하려면 먼저 서명이 필요합니다. 검증된 Full 및 API 22 Android 릴리스 APK는 기존 서명 인증서를 사용합니다. 로컬 릴리스 빌드로 서명 APK를 만들려면 keystore를 설정해야 합니다.

---

<a id="macos"></a>

### macOS

1. [릴리스](https://github.com/open-ott-play/ottplay-foss/releases)에서 원하는 태그를 선택하세요. 최신 릴리스 바로가기는 beta나 RC가 아닌 stable을 선택합니다.
2. Apple Silicon은 `OttPlay.FOSS_*_aarch64-apple-darwin.dmg`, Intel은 `OttPlay.FOSS_*_x86_64-apple-darwin.dmg`를 내려받으세요. 별도 아키텍처 빌드입니다.
3. `.dmg`를 열어 **OttPlay FOSS.app**을 응용 프로그램으로 끌어놓으세요.
4. 첫 실행 전에 복사한 번들을 검증하세요.

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

검증 성공은 번들 무결성을 확인합니다. `Signature=adhoc`는 Apple 인증 개발자 신원이 없음을 의미하며 공증이나 Gatekeeper 승인을 증명하지 않습니다. 신뢰할 수 있는 다운로드와 유효한 번들이어도 첫 실행 후 **시스템 설정 → 개인정보 보호 및 보안 → 확인 없이 열기**가 필요할 수 있습니다. [Apple 안내](https://support.apple.com/en-us/102445)를 참고하세요.

“앱이 손상됨” 메시지만으로 격리 속성이 원인이라고 단정할 수 없습니다. 서명 검증에 실패하면 오류를 보존하고 수정 릴리스를 받으세요. 내려받은 앱을 다시 서명하거나 속성을 지워 실패한 검증을 성공처럼 보이게 만들지 마세요.

ZIP 대안은 `OttPlay.FOSS_aarch64-apple-darwin.app.zip` 및 `OttPlay.FOSS_x86_64-apple-darwin.app.zip`입니다. 압축 해제, 디스크 이미지, Gatekeeper 검사는 [macOS 서명과 산출물 검증](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact)을 참고하세요. 체크아웃 빌드와 로컬 설치에는 [로컬 macOS 제공 절차](docs/macos-local-delivery.md)를 사용하세요.

---

<a id="windows"></a>

### Windows

1. [릴리스](https://github.com/open-ott-play/ottplay-foss/releases/latest)에서 `.msi` 또는 `.exe`를 내려받으세요.
2. 설치 프로그램을 실행하고 안내를 따르세요.
3. 시작 메뉴나 바탕화면 바로가기로 실행하세요.

---

<a id="linux"></a>

### Linux

Linux 재생에는 WebKitGTK 외에 GStreamer HLS, H.264, AAC 플러그인이 필요합니다. 패키지는 이 미디어 의존성을 선언하며 AppImage에는 미디어 프레임워크가 포함됩니다. 코덱 검사와 브라우저/네이티브 수용 검사의 차이는 [Linux 미디어 패키징](docs/linux-media-packaging.md)을 참고하세요.

**AppImage:**

```bash
chmod +x OttPlay.FOSS_*_amd64.AppImage
./OttPlay.FOSS_*_amd64.AppImage
```

**Debian/Ubuntu(.deb):**

```bash
sudo apt install ./OttPlay.FOSS_*.deb
```

**Fedora(.rpm):**

```bash
sudo dnf --enablerepo=fedora-cisco-openh264 install ./OttPlay.FOSS-*.rpm
```

---

<a id="ios-installation"></a>

### iOS 설치

iOS 실제 장치 설치 전에는 서명이 필요합니다. 미서명 릴리스 IPA에는 AltStore Classic을 사용하거나 Xcode로 소스에서 빌드하고 서명하세요. TestFlight가 제공되더라도 별도 초대가 필요합니다.

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### 옵션 1: AltStore Classic(개인 사용 권장)

AltServer는 컴퓨터에서, AltStore Classic은 iPhone/iPad에서 실행되어 IPA를 가져옵니다. 무료 Apple 계정이면 충분합니다.

**사전 조건:**

- 현재 OTT-play 빌드는 **iOS/iPadOS 15 이상**의 iPhone/iPad가 필요합니다.
- AltServer가 설치된 Mac 또는 Windows PC와 USB 데이터 케이블.
- 서명용 Apple 계정과 릴리스 다운로드용 인터넷 연결.

**1단계: AltStore 최초 설정**

1. 공식 [macOS 설정](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) 또는 [Windows 설정](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows)에 따라 AltServer를 설치하세요. 실행한 뒤 메뉴 막대/시스템 트레이 아이콘을 사용하세요.
2. USB로 장치를 연결하고 잠금을 해제한 다음 컴퓨터/장치 신뢰 요청을 승인하세요. Mac에서는 Finder에 장치가 보이는지 확인하세요.
3. **AltServer 메뉴 → Install AltStore**에서 장치를 선택하고 서명 계정 안내를 완료한 뒤 설치 알림을 기다리세요.
4. 장치의 **설정 → 일반 → VPN 및 기기 관리**에서 요청 시 서명 계정의 개발자 항목을 신뢰하세요. iOS 16+는 **설정 → 개인정보 보호 및 보안 → 개발자 모드**를 켜고 장치 재시작/확인 안내를 완료하세요.
5. 장치에서 AltStore를 여세요. 이미 설치돼 작동한다면 설정을 건너뛰고 아래 가져오기를 위해 AltServer를 실행 상태로 두세요.

**2단계: iPhone/iPad로 선택 릴리스 가져오기**

1. [모든 릴리스](https://github.com/open-ott-play/ottplay-foss/releases)에서 정확한 태그를 선택하고 장치 Safari로 해당 `ottplay-foss-ios-unsigned.ipa`를 내려받으세요. [최신 릴리스 바로가기](https://github.com/open-ott-play/ottplay-foss/releases/latest)는 stable을 선택하므로 beta는 전체 목록을 사용하세요.
2. IPA를 파일 앱에 저장하세요. **AltStore → My Apps → +**에서 파일을 선택하세요. Mac에서 내려받은 IPA를 AirDrop으로 보내 파일 앱에 저장한 뒤 가져올 수도 있습니다. Mac에서 IPA를 여는 것은 이 가져오기 단계가 아닙니다.
3. AltStore가 서명하고 설치하는 동안 AltServer와 USB 연결을 유지하세요. 업데이트는 기존 설치와 같은 서명 계정을 사용하며, 문제 해결 첫 단계로 앱을 삭제하지 마세요.
4. 가져오기가 완료될 때까지 기다려 **My Apps**에서 OTT-play를 확인한 다음 실행하세요.

**대안: 릴리스 URL 직접 가져오기**

AltStore가 설치돼 있다면 **iPhone의 Safari**에 다음 형식을 입력하고 `TAG`를 정확한 릴리스 태그로 바꾼 뒤 **AltStore에서 열기**를 승인하세요.

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

AltStore의 [설치 URL 처리기](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift)를 사용합니다. 여러 다운로드의 파일명이 같을 때 파일/최근 항목의 모호함을 피할 수 있습니다. URL은 릴리스 페이지가 아닌 IPA 파일을 가리켜야 합니다.

다음 예시는 **2026-09-29**에 AltStore 2.3 및 AltServer 1.8.1로 검증했습니다. 고정된 과거 예시이며 최신 버전 링크가 아닙니다.

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**갱신:** 무료 계정 설치는 7일 뒤 만료됩니다. AltServer 접근을 유지하고 만료 전에 **AltStore → My Apps → Refresh All**을 실행하세요. 백그라운드 갱신에도 AltServer 접근이 필요합니다. [AltStore 갱신 안내](https://faq.altstore.io/altstore-classic/your-altstore)를 참고하세요.

<a id="verify-the-installed-version-before-retrying"></a>

#### 재시도 전에 설치 버전 확인

AirDrop의 “전송됨”은 전송만, AltStore 진행 막대는 가져오기 시작만 확인합니다. 미러링/USB 연결이 끊겨도 설치 실패를 뜻하지 않습니다. IPA를 다시 제출하기 전에 설치된 앱을 확인하세요.

Xcode가 설치되고 활성 개발자 디렉터리로 선택된 Mac에서 재설치 없이 장치를 조사하세요.

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

JSON의 `result.apps`에서 OTT-play(`bundleIdentifier`가 `play.ott.foss`로 시작)를 찾고 `version` 및 `bundleVersion`을 선택한 IPA의 `CFBundleShortVersionString` 및 `CFBundleVersion`과 각각 비교하세요. 번들 ID에 AltStore 서명 계정 접미사가 붙는 것은 정상입니다. 장치 보고서는 로컬에 보관하세요.

검증된 beta.9 예시는 **버전 `1.1.51`, 빌드 `2.2.66`**을 보고합니다. 설치 확인이며 앱 열기, Cloudflare 로그인, 재생목록 로드, 재생, PiP는 별도 장치 검사입니다.

<a id="troubleshooting-ios-installation"></a>

#### iOS 설치 문제 해결

- **AltServer에 창이 없거나 자동화로 열면 시간 초과:** 메뉴 막대/시스템 트레이 아이콘을 사용하세요. 백그라운드 앱입니다. 일반 창을 반복해서 열려고 해도 IPA를 가져오지 않습니다.
- **“Could not find AltServer” 또는 USB 장치를 사용할 수 없음:** AltServer 실행, 휴대전화 잠금 해제, 컴퓨터/장치 신뢰 요청을 확인하세요. Mac에서는 Finder 표시를 확인하세요. 연결이 끊기면 안전할 때 다시 연결하고 설치 버전을 확인한 뒤 재시도하세요. 계속되면 [AltStore 연결 문제 해결](https://faq.altstore.io/altstore-classic/troubleshooting-guide)을 따르세요. 휴대전화가 컴퓨터 인터넷을 제공한다면 다른 작업을 끊지 않도록 케이블/네트워크 변경을 조율하세요.
- **iPhone 미러링이 “iPhone in Use” 또는 “Connecting” 상태:** 실제 휴대전화로 설정을 마치거나 화면을 잠그고 잠금 해제된 Mac 근처에 두세요. 휴대전화 잠금을 풀면 미러링이 종료되지만 USB 신뢰/설정에는 먼저 잠금 해제가 필요할 수 있습니다. 한 번 재연결해도 멈춘다면 미러링을 종료하고 휴대전화에서 계속하세요. [Apple 미러링 요구 사항](https://support.apple.com/en-us/120421)을 참고하세요. 미러링은 설치 필수가 아닙니다.
- **미러링에서 URL의 라틴 문자가 사라지거나 키릴 문자로 변함:** **Mac 입력 소스를 ABC/영어**로 바꾸세요. 미러링에 포커스를 둔 채 **Control–Space**를 눌러 iPhone 하드웨어 키보드에 **English (US)**를 선택하세요. 두 장치 입력 소스는 다를 수 있고, 검증한 세션에서는 Mac만 바꿔서는 부족했습니다. 필드를 지워 URL을 다시 입력하고 제출 전에 확인하세요.
- **미러링 붙여넣기가 멈추거나 엉뚱한 텍스트를 넣음:** 필드를 지우고 iPhone English (US) 입력 소스로 짧게 나눠 천천히 입력하거나 휴대전화에서 직접 입력하세요. 빠른 미러링 입력은 문자를 빠뜨리거나 중복시킬 수 있으므로 저장 전 전체 주소를 확인하세요. 일부만 붙여넣은 URL을 제출하지 마세요. 실제 설치 세션에서도 붙여넣기는 실패했으며 직접 URL 방식의 전제가 아닙니다.
- **파일/최근 항목에 같은 IPA 이름이 여러 개:** 정확한 다운로드 위치나 위의 태그 포함 직접 URL을 사용하세요. 로컬 복사본 이름에 태그/빌드를 넣어 구분해도 되며 이름 변경은 내용을 바꾸지 않습니다.
- **설치된 앱이 열리지 않음:** 휴대전화의 개발자 신뢰 또는 개발자 모드 안내를 따르세요. AltStore 만료를 확인해 필요하면 갱신하세요. 계속 실패하면 실제 오류를 기록하세요. 연결 오류만으로 앱을 삭제하고 재설치하면 안 됩니다.
- **OTT-play는 열리지만 보호된 재생목록이 셀룰러에서 실패:** 설치와 소스 인증은 별개입니다. **설정 → 설정 관리 → 소스 접근**에서 구성된 소스에 로그인한 뒤 목록을 다시 로드하세요. 필요하면 실제 장치에서 생체 인증/패스키 또는 이메일 코드 요청을 완료하세요. 소스는 [iOS Access 통합](docs/ios-source-access.md)을 지원해야 하며 앱 설치는 IP 허용 목록을 우회하지 않습니다.
- **신뢰하는 Wi-Fi에서도 패스키 요청:** iOS Access 소스는 먼저 로그인 없이 원래 소스를 시도하고 접근 거부 후 인증된 모바일 진입점을 사용합니다. IPv6를 포함해 소스가 보는 실제 공인 IP를 확인하세요. 집 IPv4 허용은 다른 IPv6, VPN, 셀룰러 주소에 적용되지 않습니다. 네트워크 변경이나 앱 다시 열기는 임시 경로 우선순위를 초기화합니다. 일반 네트워크/서버 오류는 로그인을 유발해서는 안 됩니다.
- **로그인은 더 이상 안 뜨지만 채널 목록이 비어 있음:** 유효한 저장 세션은 추가 요청 없이 재사용됩니다. 이전 로드 실패나 서버 수정 후에는 목록을 다시 로드하거나 앱을 완전히 닫고 한 번 다시 여세요. 계속되면 소스가 HTML 로그인 페이지나 JSON 오류가 아닌 재생목록을 반환하는지 확인하세요. 표시 오류와 HTTP 상태를 기록하고 자격 증명, 쿠키, Access 토큰이 있는 소스 URL은 공유하지 마세요.
- **채널은 로드되지만 영상이 버퍼링되거나 `SRC_NOT_FOUND` 표시:** 목록 로드와 영상 재생은 별도 검사입니다. 로그인 후 채널을 한 번 다시 시도하고 계속되면 HLS 매니페스트와 세그먼트 응답, 코덱 지원을 확인하세요. 이 오류만으로 엔진 변경이나 재설치가 도움이 된다고 단정할 수 없습니다.

<a id="option-2-testflight-if-available"></a>

#### 옵션 2: TestFlight(제공되는 경우)

TestFlight 초대가 게시되면 App Store에서 TestFlight를 설치하고 장치에서 초대를 열어 **설치**를 탭하세요. GitHub IPA 다운로드 자체는 TestFlight 초대가 아닙니다.

<a id="option-3-xcode-for-developers"></a>

#### 옵션 3: Xcode(개발자용)

[빌드 및 열기](docs/capacitor-mobile.md#build-and-open)에 따라 Xcode의 **App** 대상을 선택하고 **Signing & Capabilities**에서 개발 팀을 설정한 뒤 연결된 장치를 선택해 빌드/실행하세요. 장치 신뢰 및 개발자 모드 요청을 완료하세요. 미서명 IPA를 Xcode Devices 창에 가져와도 없는 서명 ID나 프로비저닝 프로필이 제공되지 않습니다.

---

<a id="android-application"></a>

### Android 앱

공유 플레이어 UI를 사용하려면 이 저장소 릴리스의 Full Capacitor APK를 선택하세요. Android 5.1–6은 WebView 60 이상이 필요한 API 22 호환 APK를 사용하세요. 업데이트할 때 앱 ID와 서명 인증서를 유지해야 기존 프로필을 계속 사용할 수 있습니다. [빌드 지침](android/README.md)과 [배포, 서명 및 원격 설치](docs/android-distributions.md)를 참고하세요.

별도 [ottplay-android 저장소](https://github.com/open-ott-play/ottplay-android)는 네이티브 Kotlin/Compose 앱을 포함합니다. 고유한 ID, 설정, 릴리스 워크플로가 있으며 Capacitor 설치를 제자리에서 대체하지 않습니다. 과거 릴리스 파일은 계속 제공됩니다.

---

<a id="quick-start"></a>

## 빠른 시작

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

브라우저 스모크 테스트에는 동일 리비전을 직접 배포해 사용하세요.

Node 22와 Rust stable 도구 모음을 사용하세요. 정적 자산을 찾도록 저장소 루트에서 서버를 실행하세요. 네이티브 빌드는 아래의 플랫폼 도구가 필요하지만 서버 전용 빌드는 필요하지 않습니다.

첫 로드에서 **데모 체험**을 선택하거나 **설정 → 공급자 변경 → M3U / M3U8 재생목록**을 여세요. **재생목록 선택**에서 슬롯을 선택하고 **재생목록 URL**을 입력해 저장한 뒤 **재생목록 로드**를 선택하세요. 목록이나 공급자 계정은 사용자가 준비하며 앱은 유료 채널 구독을 제공하지 않습니다.

<a id="mode-a-companion-smoke"></a>

## Mode A 보조 서버 스모크 테스트

curl 기반 Mode A 보조 서버 검사(`ottplay-server` / `archive/server.py` 동등성)로, 인덱스, 정적 디렉터리, `/logo`, `/version`, 선택적 `/epg`, 가져오기를 하지 않는 `POST /m3u/cp.php` 검사를 포함합니다.

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

검사는 `scripts/modea-smoke-checks.json`에 있으며 비밀이 없습니다. 명령 큐 / `local_proxy.py`(:8081)는 `scripts/smoke-command-queue.sh`가 존재하면 별도로 검사합니다.

<a id="classic-stalker--ministra-portals"></a>

## 클래식 Stalker / Ministra 포털

**Stalker 포털**을 선택하고 공급자가 발급한 MAC과 전체 포털 URL(예: `http://provider.example/stalker_portal/c/`)을 입력하세요. `/c/index.html`, `/stalker_portal`, `/server/load.php`, `/load.php`, `/portal.php` URL은 클래식 MAG 프로토콜을 선택합니다. 기존의 서버 주소만 있는 설정은 JSON-RPC를 유지합니다. 공급자는 공유 Stalker 코어로 프로필, 장르, 페이지별 실시간 채널을 로드한 다음, 백그라운드에서 클래식 `type=vod` 프로토콜의 영화와 중첩된 에피소드를 탐색합니다. 폴더 경로는 일반 채널 목록의 카테고리가 되며, 제공되는 설명과 포스터 및 안정적으로 유지되는 전역 즐겨찾기는 같은 미디어 인터페이스를 사용합니다. [카탈로그 동작과 제한](docs/stalker-media.md)을 참고하세요.

자체 호스팅 브라우저 버전의 요청은 보조 서버의 `/stalker/api`를 거치며 네이티브 앱은 기존 HTTP 전송을 사용합니다. 호스팅된 브라우저 버전에는 [전용 릴레이](docs/stalker-relay.md)를 통하는 경로를 명시적으로 설정해야 합니다. 브라우저와 서버 자산은 함께 업데이트해야 합니다.

실시간 재생은 스트림을 열 때 임시 채널 명령을 해석합니다. 채널 변경, 정지, PiP, 공급자 교체는 오래된 해석 작업을 취소합니다. 명시적 비임시 HTTP(S) 명령은 직접 재생합니다. 짧은 EPG는 지원합니다. 클래식 포털 다시 보기와 별도의 `type=series` 방식은 이 공급자에서 제공하지 않습니다. 기존 JSON-RPC 다시 보기/가이드 동작은 그대로입니다. 보조 서버 경로를 이용하는 사설 LAN 포털은 다른 보조 프록시 경로처럼 정확한 `OTTPLAY_PROXY_LAN_ORIGINS` 항목이 필요합니다.

공개 Infomir 데모는 `http://middleware-stalker.com/stalker_portal/c/`입니다. 2026-09-26에 실시간 카탈로그 세 항목을 반환했지만 미디어 엔드포인트는 사용할 수 없었습니다. 재생 회귀에는 제어 가능한 포털/미디어 픽스처를 사용하세요.

<a id="m3u-stream-proxy-header-smoke"></a>

## M3U 스트림 프록시 헤더 스모크 테스트

Mode A 보조 서버 `POST /m3u/cp.php`가 제어 가능한 에코 URL을 가져올 때 주입하는 업스트림 요청 헤더를 비교합니다. 기본값은 로컬 모의 서버이며 IPTV 공급자나 비밀을 사용하지 않습니다.

계약(`src-rs/core/src/m3u.rs` + `archive/server.py`):
- **User-Agent**만 주입합니다(기본 `OTT-play-FOSS/1.0` 또는 `webos` / `tizen` / `viera` / `mag` / `dune` 프리셋).
- **Referer**는 주입하지 **않습니다**(Capacitor의 `M3UProxy`는 주입하지만 Mode A는 아닙니다).
- `url` 앞의 `@`를 제거합니다(공급자 jQuery 폼).

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

종료 코드: `0` 통과, `1` 수신 대기 없음, `2` 헤더/HTTP 불일치, `3` 사용법/의존성 오류. `smoke-modea-companion.sh` / `smoke-command-queue.sh`와 연관된 검사입니다.

<a id="logo-concurrent-bench-smoke"></a>

## 로고 동시성 벤치마크 스모크 테스트

Mode A 보조 서버에 동시 `GET /logo/<id>.svg`(선택적 `?ch=`) 요청을 보내 지연을 검사합니다. 성공/실패 수와 p50/p95/p99를 보고합니다. 기본값은 CI 로컬의 실용적 부하(`CONCURRENCY=200`, `TOTAL=1000`)이며 전체 1만 회 지속 검사는 선택 사항입니다(`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`).

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

종료 코드: `0` 통과, `1` 수신 대기 없음/연결 실패, `2` 높은 오류율, `3` 사용법 오류. `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`와 연관됩니다.

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## XMLTV 캐시 갱신/예열 스모크 테스트

존재하지 않는 API를 가정하지 않고 `src-rs`에 맞춰 Mode A 보조 서버 XMLTV/EPG 캐시 동작을 정확히 검증합니다.

- 메모리의 `EPG_CACHE`는 `GET /epg/:hash`를 통해 항상 `{"epg_data":[...]}`(HTTP 200)를 제공합니다.
- 프로세스 시작 시 HTTP 시작을 지연하지 않고 백그라운드에서 `EPG_URLS`를 가져옵니다. 각 가져오기가 끝나면 다음 갱신까지 **2시간** 기다립니다.
- `DATABASE_URL` 설정 시 선택적으로 SQLite에 영구 저장합니다(공개 캐시 상태 엔드포인트 없음).
- 선택적 재시작 후 `GET /health` → `OK`로 HTTP 준비 상태를 확인합니다. `--strict-epg`와 `--epg-hash`를 사용하면 같은 `--warmup-timeout` 안에 해당 채널의 비어 있지 않은 EPG도 기다립니다.

기본 경로는 curl만 사용하며 **프로세스를 종료하지 않습니다**. 자동 종료/재시작에는 `--restart-cmd` / `RESTART_CMD`를 전달하거나 `--help`의 수동 `launchctl` 절차를 따르세요.

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

종료 코드: `0` 통과, `1` 수신 대기 없음, `2` 단언/예열 실패, `3` 사용법 오류. `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`와 연관됩니다.

<a id="mode-a-e2e-play-path-smoke"></a>

## Mode A E2E 재생 경로 스모크 테스트

보조 서버 측 **재생 경로/스트림 준비 상태** 검사입니다. HTTP 전용이며 창이 있는 UI E2E가 **아닙니다**. 실행 중인 Mode A 보조 서버에서 다음을 확인합니다.

- 상태 검사 또는 인덱스 접근 가능 여부.
- 정적 플레이어 셸 자산(`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`).
- `EPG_HASH` 설정 시 선택적 `GET /epg/<hash>.json`.
- 비밀 없는 JSON 픽스처(빈 목록과 합성 채널 하나)로 `POST /m3u/match-channels`.
- 스트림 프록시 **재생**: 제어 가능한 미디어 픽스처(기본 로컬 HLS 목록 또는 `MEDIA_URL`)에 `POST /m3u/cp.php`를 보내 HTTP 200, 비어 있지 않은 본문, 예상 `Content-Type`을 검사합니다. 프록시를 거친 첫 바이트를 확인합니다.

비공개 IPTV 자격 증명은 사용하지 않습니다. `smoke-modea-companion.sh`(존재), `smoke-m3u-stream-proxy-headers.sh`(UA/Referer), `smoke-xmltv-cache-refresh.sh`와 연관됩니다.

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

종료 코드: `0` 통과, `1` 수신 대기 없음, `2` 단언 실패, `3` 사용법/의존성 오류.

<a id="capacitor-device-smoke-mode-b"></a>

## Capacitor 장치 스모크 테스트(Mode B)

Mode B Cap용 시뮬레이터/에뮬레이터(실제 장치 선택 가능) **체크리스트**이며 Mode A 보조 HTTP 검사가 아닙니다. UI 통과는 사람이 표시하고 도구는 도구 모음/네이티브 디렉터리/느슨한 명령 큐 curl 검사를 자동화합니다.

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

상세: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md). `smoke-command-queue.sh`(Cap 루프백)와 연관되며 위의 Mode A 검사와 혼동하지 마세요.

<a id="tauri-desktop-smoke-mode-b"></a>

## Tauri 데스크톱 스모크 테스트(Mode B)

Mode B Tauri의 창/채널 재생/PiP를 위한 데스크톱 체크리스트와 도구입니다. Mode A 보조 HTTP나 Cap 장치 검사가 아닙니다.

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

상세: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md). 로컬 스모크에는 Apple 개발자 자격 증명이 선택 사항입니다. 패키징한 Mac 앱은 [임시 서명](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials)을 사용하세요. 실행, 재생, PiP는 사람이 수용 검사해야 합니다.

<a id="docker"></a>

## Docker

다중 아키텍처 이미지(amd64/arm64)는 후보 OCI 아카이브로 빌드합니다. 레지스트리 게시는 승인된 stable 아카이브를 다시 빌드하지 않고 Docker Hub로 승격합니다. [운영 안내서](docs/release-workflow.md)를 참고하세요.

서버 바이너리는 **musl**(Alpine)에서 빌드해 Alpine으로 배포하므로 GLIBC_2.38+가 필요하지 **않습니다**. 따라서 `alvit/ottplay-foss`는 Synology DSM Docker(x86_64)와 오래된 glibc 호스트에서 실행할 수 있습니다.

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

stable 레지스트리 태그는 `X.Y.Z`를 사용합니다. `latest` 갱신은 버전 이미지를 게시한 후 명시적으로 선택하는 별도 옵션입니다. main 푸시나 Git 태그는 이미지를 게시하지 않습니다.

<a id="build-from-source"></a>

## 소스에서 빌드

플레이어 도메인 규칙은 `vendor/ottplay-core.js`의 고정된 Kotlin 멀티플랫폼 산출물에서 옵니다. 가이드, 다시 보기, 재생목록, 공급자, 영구 상태 및 재생 결정은 FOSS2와 네이티브 Android와 구현을 공유합니다. 브라우저/TV, Swift, Rust 어댑터는 장치 API, 코덱, 네트워크, UI 효과를 담당합니다. 브라우저 산출물은 ES5 구문과 지원되는 레거시 API 초기화를 유지합니다. `npm test`, `check:bundle`, `check:es5`가 통합을 검증하며 산출물 매니페스트가 소스와 출력 해시를 기록합니다.

Control-server 및 SWOP 프로토콜 검증기는 버전 관리된 `contracts/ottplay-wire-v1.json` 스키마에서 생성합니다. 검사된 생성기 증빙과 불변 호환성 픽스처가 소비자별 정책 복제를 막습니다.

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

## 장치 감지

플레이어는 24개 장치 유형을 지원합니다. 먼저 URL `/f/{device_id}/`, 다음으로 User-Agent를 사용해 감지합니다.

| 장치 ID | 장치 |
|---|---|
| `pc` | PC 브라우저 |
| `pc2` | videojs 웹 플레이어 |
| `nodejs` | Windows 앱(Electron) |
| `lg/webos` | LG WebOS TV |
| `samsung/tizen` | Samsung Tizen TV |
| `samsung/maple` | Samsung Orsay TV |
| `mag` | Infomir MAG 셋톱박스 |
| `dune` | Dune HD 셋톱박스 |
| `android` | Android TV / 태블릿 |
| `hbbtv` | HbbTV TV |
| `panasonic` | Panasonic Viera TV |
| `philips` | Philips TV |
| `sony` | Sony TV |
| `sharp` | Sharp TV |
| `toshiba` | Toshiba TV |
| `hisense` | Hisense TV |
| `skyworth` | Skyworth TV |
| `tcl` | TCL TV |
| `vewd` | Vewd 장치 |
| `spark` | Spark 수신기 |

<a id="push-command-system"></a>

## 푸시 명령 시스템

별도 다중 장치 서비스는 [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server)와 **설정 → 원격 제어**의 **명령 서버** 영역을 사용하세요. IP/주소와 이 플레이어의 장치 접근 코드를 입력하고 둘 다 저장하면 음량, 채널 등 명령 폴링이 자동 시작됩니다. 포트 없는 IP는 HTTP 8081을 사용합니다. 주소를 지우거나 **연결 해제**로 중지합니다. 이 아웃바운드 연결은 확인된 전달을 지원하며 로컬 리스너가 필요하지 않습니다. [연결 및 호환성 상세](docs/remote-command-server.md)를 참고하세요. 아래 예시는 기존 로컬 프록시/리스너 모드입니다.

**명령 서버 찾기**를 사용하면 장치 토큰을 복사하지 않고 컨트롤러를 찾아 운영자 승인을 요청할 수 있습니다. Tauri는 네이티브 DNS를 먼저 확인하며 결과가 비어 있으면 명시적으로 설정된 배포 프로필로 대체할 수 있습니다. 브라우저, LG 및 Capacitor 플레이어는 브라우저 프로필 경로를 사용합니다. Home 검색 메타데이터는 컨트롤러와 별도로 here.now에서 호스팅할 수 있습니다. 일반 빌드에는 해당 Home 프로필이 자동으로 포함되지 않으며, 업데이트해도 저장된 연결은 교체되지 않습니다. [플랫폼별 동작, 프로필 설정 및 문제 해결](docs/remote-command-server.md#discovery-and-one-time-approval)을 참조하세요.

로컬 HTTP 원격 제어는 브라우저/OTT 서버 플레이어, Tauri, Capacitor 모두 **기본적으로 꺼져 있습니다**. **플레이어 설정 → 원격 제어**에서 켜면 비밀 장치 코드가 생성됩니다. 명령은 `"command"` 필드가 있는 JSON 객체이며 HTTP 요청에는 `Authorization: Bearer <device-code>`가 필요합니다.

<a id="architecture"></a>

### 아키텍처

<a id="local-command-url-recommended"></a>

#### 로컬 명령 URL(권장)

**플레이어 설정 → 원격 제어**에서 **로컬 HTTP 원격 제어**를 켜고 생성된 **장치 코드**를 복사해 아래 프록시에 설정하세요. **로컬 명령 URL**을 프록시 명령 엔드포인트로 지정하세요. 활성화된 동안 플레이어는 Authorization 헤더에 장치 코드를 넣어 10초마다 폴링합니다. URL만 지정해도 제어가 켜지는 것은 아닙니다.

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### 장치 UUID

기존 장치 UUID(예: `dev_a1b2c3d4e5`)는 공개 라우팅 메타데이터이며 인증 자격 증명이 아닙니다. 별도 **장치 코드**는 로컬 HTTP 제어를 켤 때 안전하게 생성되어 이 장치에 남으며 클라우드 설정으로 복사되지 않습니다. 끄면 폴링/리스너가 중지됩니다. 다시 켜면 새 코드가 생성되므로 프록시와 통합을 갱신해 이전 자격 증명을 폐기하세요.

Tauri와 Capacitor는 이 설정을 켠 뒤에만 루프백 HTTP 리스너를 시작합니다. 전달 프록시는 표시된 코드를 Bearer 토큰으로 리스너에 보내야 합니다. Mode A는 아래에서 따로 설정하는 `local_proxy.py` 큐를 사용합니다.

<a id="remote-text-entry-swop"></a>

#### 원격 텍스트 입력(swop)

목적은 TV와 휴대전화가 **다른 네트워크**에 있을 때 Cloudflare Worker 세션 전달을 이용해 휴대전화로 ♥™ / 원격 가상 키보드에 입력하는 것입니다.

- Worker 저장소: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop).
- **설치 승인:** 플레이어는 자기 서버의 동일 오리진 `/swop` 릴레이로 요청합니다. 서버가 비공개 설치 토큰을 추가하며 등록된 서버 오리진의 모든 클라이언트가 원격 입력을 사용할 수 있습니다. 장치 UUID는 세션 식별용이며 장치별 허용 목록은 필요하지 않습니다.
- 설정: `swopBaseUrl`(비어 있으면 ♥™가 “구성 안 됨”을 표시하고 동작하지 않음). **설정 → 원격 제어**(키 **2**)에서 수정하거나 운영 설치 시 Git에서 제외된 `/local/swop.json`으로 주입하세요.
- `POST /session`은 `clientId`, `caption`, `draft`를 포함하며 `POST /val`은 `clientId`, `code`, 반환된 `sessionToken`을 포함합니다. 휴대전화 URL에는 별도의 쓰기 토큰이 있습니다. 세션 읽기 토큰은 브라우저 메모리에 남습니다.
- **로컬 설치:** Worker에 설치와 정확한 LAN/localhost 오리진을 등록한 후 `SWOP_BASE_URL` 및 `SWOP_INSTALLATION_TOKEN`을 설정하세요. `scripts/install-ottplay-local-service.sh`는 권한 0600의 비공개 launchd plist에 보존합니다. 공개 `/local/swop.json`은 `{"swopBaseUrl":"/swop"}`만 포함합니다. 공개 자산에 설치 토큰을 넣지 마세요.
- **정적 호스팅:** 같은 두 엔드포인트에 서버 측 인증 프록시를 설정하세요. 설치 토큰은 호스팅 서비스의 secrets에 보관하세요. 공개 플레이어 파일을 복사해도 서버 자격 증명은 복사되지 않습니다.

> 중앙 OTT 서버는 `/api/webhook/commands`, `/webhook/poll`, `/webhook/notify` 및 명령 상태 별칭을 모든 HTTP 메서드에서 비활성화합니다. Mode A에는 별도 명령 서버나 명시적으로 설정된 인증 `local_proxy.py`를 사용하세요. 중앙 서버에는 브로드캐스트 명령 큐가 없습니다.

<a id="available-commands"></a>

### 사용 가능한 명령

아래 예시는 로컬 프록시 URL로 `http://192.168.1.50:8081/api/webhook/commands`를 사용합니다. 실제 프록시 주소로 바꾸고 `OTTPLAY_QUEUE_HTTP_TOKEN`에 플레이어 설정에서 HTTP 제어를 켜면 표시되는 **장치 코드**를 지정하세요. 프록시에도 같은 코드를 설정해야 합니다.

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — 알림 팝업 표시

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| 필드 | 유형 | 기본값 | 설명 |
|---|---|---|---|
| `message` | 문자열 | 필수 | 표시할 텍스트 |
| `popup_duration` | 숫자 | 5 | 오른쪽 위에 표시할 초 |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — 목록 위치로 채널 변경

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| 필드 | 유형 | 기본값 | 설명 |
|---|---|---|---|
| `channel_number` | 숫자 | 필수 | 1부터 시작하는 목록의 채널 위치 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — 전체 또는 일부 이름으로 채널 변경

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

대소문자를 구분하지 않는 부분 문자열 검색이며 첫 일치를 사용합니다.

| 필드 | 유형 | 기본값 | 설명 |
|---|---|---|---|
| `channel_name` | 문자열 | 필수 | 채널 이름 또는 일부 |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — 임의 채널로 변경

이 기존 명령은 현재 목록이나 카테고리에서 선택 가능한 채널을 고릅니다. 채널 번호와 범위는 해당 목록의 위치를 가리킵니다. [안전한 무작위 선택 규칙](docs/remote-command-server.md#safe-random-playback)을 참조하세요.

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

| 필드 | 유형 | 기본값 | 설명 |
|---|---|---|---|
| `random_range` | [시작, 끝] | 현재 목록 | 1부터 시작하는 범위 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — IPTV 공급자 변경

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| 필드 | 유형 | 기본값 | 설명 |
|---|---|---|---|
| `provider` | 숫자 | 필수 | 공급자 배열 인덱스(0=m3u, 1=stalker, 2=xtream 등) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — 새 M3U 재생목록 로드

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| 필드 | 유형 | 기본값 | 설명 |
|---|---|---|---|
| `playlist` | 문자열 | 필수 | M3U 재생목록 URL |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — 공급자 설정 갱신

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| 필드 | 유형 | 기본값 | 설명 |
|---|---|---|---|
| `provider_settings` | 문자열 | 필수 | 공급자 설정을 담은 JSON 문자열 |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — 음량 설정 또는 조정

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

음량 제어를 지원하지 않는 클라이언트는 조용히 무시합니다.

| 필드 | 유형 | 기본값 | 설명 |
|---|---|---|---|
| `volume` | 숫자 | — | 절대 음량 0–100 |
| `volume_step` | 숫자 | — | 상대 변화, 예: +10 또는 -5 |

<a id="player-standby-restart-and-exit"></a>

#### 플레이어 대기, 재시작 및 종료

로컬 프록시의 확인 없는 webhook 큐는 `exit_player`나 형식이 지정된 대기/깨우기 요청을 지원하지 않습니다. 플레이어를 [명령 서버](docs/remote-command-server.md)에 연결하고 CLI를 사용하세요.

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

`d1`을 등록한 플레이어 별칭으로 바꾸세요. `stop`은 `standby`의 별칭이고 `start`, `wake`는 `go`의 별칭입니다. Go는 실행 중이고 연결된 플레이어가 필요하며 닫힌 앱이나 오프라인 장치를 시작할 수 없습니다. 네이티브 종료가 없는 브라우저나 TV는 미지원으로 보고합니다. 대기는 원격 폴링을 유지하며 관련 없는 호스트 또는 공유 서버 작업을 중단하지 않습니다.

standby/go 후 `ott d1 status`로 대기/백그라운드 상태를 확인하고 재생 재개를 별도로 검증하세요. 다시 로드한 후 `ott d1 doctor`로 새 런타임을 확인하세요. 종료 후에는 OS로 앱 프로세스가 닫혔는지 확인하세요. 원격 시간 초과는 종료 증거가 아닙니다. 명령 수락만으로 결과가 확인되지는 않습니다.

<a id="local-proxy-server"></a>

## 로컬 프록시 서버

`local_proxy.py`는 플레이어 하나를 위한 독립 인증 명령 큐입니다. 기본 실행은 포트를 열지 않고 종료합니다. 각 프록시는 플레이어가 생성한 코드를 사용하므로 여러 플레이어에는 별도 인스턴스/포트를 사용하세요. `device_id` 쿼리는 호환성 메타데이터일 뿐 인증하거나 다른 장치를 선택하지 않습니다.

<a id="start-the-proxy"></a>

### 프록시 시작

1. 플레이어에서 **로컬 HTTP 원격 제어**를 켜고 **장치 코드**를 복사하세요.
2. 프록시 호스트에서 코드와 플레이어를 제공하는 정확한 오리진(스킴, 호스트, 포트, 경로 없음)을 설정하세요.

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. 플레이어의 **로컬 명령 URL**을 `http://192.168.1.50:8081/api/webhook/commands`로 설정하세요.

기본 바인드 주소는 `127.0.0.1`이며 예시는 LAN 접근을 명시적으로 켭니다. `OTTPLAY_QUEUE_HTTP_ORIGINS`는 쉼표로 구분한 정확한 브라우저 오리진 허용 목록입니다. HTTPS 플레이어는 HTTPS 역방향 프록시를 사용해 브라우저 혼합 콘텐츠 규칙이 폴링을 허용하도록 하세요. 코드는 비밀로 유지하고 URL에 넣지 마세요. 새 코드가 생성되면 그 값으로 프록시를 재시작하세요. 플레이어만 끈다고 별도 관리 프록시 프로세스가 멈추지는 않습니다.

<a id="endpoints"></a>

### 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/api/webhook/commands` | 명령을 큐에 추가 |
| `GET` | `/api/webhook/commands` | 큐 명령 가져오기(플레이어 폴링) |
| `POST` | `/webhook/notify` | 인증된 호환성 별칭 |
| `GET` | `/webhook/poll` | 인증된 호환성 별칭 |

보내기와 큐 비우기 모두 일치하는 Bearer 장치 코드가 필요합니다. 미인증 브로드캐스트 엔드포인트는 없습니다. 명령은 60초 뒤 만료되며 각 프록시는 최대 50개를 보관합니다.

프록시는 최대 16개 연결을 동시에 처리하므로 유휴 브라우저 연결이나 불완전한 요청이 다른 명령을 지연시키지 않습니다. 각 소켓은 5초 비활성 시간 제한을 가지며 모든 작업자가 사용 중이면 추가 연결은 닫힙니다. 큐 삽입 및 비우기는 작업자 간 원자적입니다.

<a id="smoke-script-all-modes"></a>

### 스모크 스크립트(전체 모드)

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Android 에뮬레이터/장치는 먼저 `adb forward tcp:18081 tcp:18081`을 실행하세요. Cap/Tauri는 루프백 전용이므로 LAN Home Assistant에는 이 Mode A 프록시를 사용하세요. 상세: `docs/capacitor-mobile.md`의 스모크 테스트 절.

<a id="cors"></a>

### CORS

브라우저 요청은 `OTTPLAY_QUEUE_HTTP_ORIGINS`에서만 허용합니다. 허용 오리진의 사전 `OPTIONS` 요청에는 토큰이 필요 없지만 실제 GET/POST에는 모두 Bearer 코드가 필요합니다. 와일드카드 및 `null` 오리진은 허용하지 않습니다. Home Assistant 같은 비브라우저 호출자는 Origin을 생략해도 인증은 필요합니다.

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### 예: Home Assistant webhook → 로컬 프록시 → 플레이어

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

### Home Assistant 자동화 예시

팝업, 채널 및 음량 예시는 로컬 프록시를 사용합니다. Home Assistant `secrets.yaml`의 `ottplay_device_authorization`을 활성화된 플레이어의 코드를 사용한 `Bearer <device-code>`로 설정하세요.

야간 대기는 별도 [명령 서버](docs/remote-command-server.md)를 사용합니다. 아래 URL과 `DEVICE_UUID`를 컨트롤러 주소 및 등록 장치 ID로 바꾸세요. 로컬 CLI 별칭 `d1`은 장치 ID가 아닙니다. `secrets.yaml`의 `ottplay_control_authorization`을 `Bearer <controller-admin-token>`으로 설정하세요. 이는 로컬 프록시 장치 코드와 별도 자격 증명입니다. Home Assistant의 [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) 및 [secrets](https://www.home-assistant.io/docs/configuration/secrets/) 문서를 참고하세요.

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

`standby_request`는 자동화 추적용 HTTP 응답을 포함합니다. HTTP 202는 큐에 들어갔다는 뜻뿐입니다. `content.id`를 보관하고 같은 컨트롤러 자격 증명으로 `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID`를 폴링해 플레이어 응답을 확인하세요. 새 `status` 요청은 `player.standby`와 `player.background`를 관찰합니다. 대기가 켜지고 `suspended`이며 대기 작업이 0이면 플레이어가 추적하는 작업이 비워졌음을 확인합니다. 대기를 끝내려면 같은 형식 요청의 `"operation":"wake"`(`ott d1 go`)를 사용하세요. 시간 초과 후 변경 작업을 무조건 반복하지 마세요. 컨트롤러 [요청/응답 API](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) 및 [대기 의미](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake)를 참고하세요.

<a id="server-api-reference"></a>

## 서버 API 참고

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Webhook 엔드포인트(Rust `ottplay-server`)

Rust 서버와 보관된 Python 대체 구현은 명령 엔드포인트를 HTTP 403으로 거부합니다. `/api/webhook/commands`, `/webhook/notify`, `/webhook/poll` 및 명령 상태 별칭은 명령을 추가, 브로드캐스트하거나 비우지 않습니다. 일반 피드백 API는 이 예약 경로를 재정의할 수 없습니다. Mode A 명령 전달은 위에서 따로 설정한 명령 서버 또는 인증된 로컬 프록시를 사용합니다.

<a id="other-endpoints"></a>

### 다른 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/epg/<hash>.json` | 채널 EPG 데이터 |
| `GET` | `/logo/<id>.svg` | 생성된 채널 로고 |
| `GET` | `/version/<path>` | 파일 버전 해시 |
| `POST` | `/m3u/match-channels` | 채널-EPG 매칭 |
| `POST` | `/m3u/match-logos` | 채널 로고 매칭 |
| `POST` | `/m3u/cp.php` | 스트림 프록시 |
| `GET/POST` | `/feedback/` | 피드백 기록 |
| `GET` | `/tmdb/*` | TMDb API 프록시 |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## 프로젝트 구조

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

## STB 키 매핑

- **Samsung Tizen**: `RETURN=10009`, `ENTER=13`, 색상 키 403–406.
- **Samsung Maple**: 방향 패드 4/5/6/8, 원래 SDK 코드.
- **LG WebOS**: `RETURN=461`, HbbTV 호환 색상.
- **LG NetCast**: `RETURN=8`, HbbTV 코드.
- **MAG**: `RETURN=8`, MAC용 gSTB API.
- **Dune HD**: 표준 코드, Dune API.
- **Android TV**: Android 키 코드(`BACK=4`, `DPAD_*` 19–22, `ENTER=66`).
- **HbbTV/Panasonic/Philips/Sony 등**: HbbTV 코드(`RED=403`, `BLUE=406`, `VOL_UP=447`).

<a id="documentation"></a>

## 문서

- [문서 위키](./docs/wiki/Home.ko.md) / [러시아어 위키](./docs/wiki/Home.ru.md) — 작업별 탐색과 유지 관리 규칙.
- [구현 보고서](./docs/implementation-report.ko.md) / [러시아어 과정과 결과](./docs/implementation-report.ru.md) — 색상 다이어그램, 검증된 동작, 측정 비용, 릴리스 게이트.
- [제공 기능 안내](./docs/roadmap-delivery.ko.md) / [러시아어 새 기능 안내](./docs/roadmap-delivery.ru.md) — 기능, 제한, 검증.
- [88개 인터페이스 언어 빠른 시작](./docs/readme/README.md) — 배포 UI 번역에서 생성되며 기본 설명서와 대응 기능 안내는 [24개 문서 언어](docs/manual-translations.md)로 제공됩니다.
- [화질 제한 및 실시간 복구](./docs/playback-stream-policy.ko.md) / [러시아어](./docs/playback-stream-policy.ru.md).
- [수동 XMLTV 매핑 및 클래식 접근성](./docs/guide-binding-accessibility.ko.md) / [러시아어](./docs/guide-binding-accessibility.ru.md).
- [호스팅 오디오/비디오 검사](./docs/audio-video-check.ko.md) / [러시아어](./docs/audio-video-check.ru.md).
- [Xtream 미디어 라이브러리](./docs/xtream-media.ko.md) / [러시아어](./docs/xtream-media.ru.md).
- [동일 소스 장치 이어받기](./docs/remote-handoff.ko.md) / [러시아어](./docs/remote-handoff.ru.md).
- [복구 가능한 로컬 설정](./docs/settings-recovery.ko.md) / [러시아어](./docs/settings-recovery.ru.md).
- [브라우저 세대, 운영체제, 정확한 릴리스 후보 검사](docs/browser-compatibility.ko.md) / [러시아어](docs/browser-compatibility.ru.md).

- [플레이어 아키텍처](./docs/architecture.md) — 런타임 책임, 공급자 통합, 재생, 가이드, 장치 어댑터 및 빌드 계약.
- [클래식 ES5 빌드 파이프라인](./docs/build-pipeline.md) — 컴파일, 호환성 검사, 산출물 크기 제한.
- [런타임 자산 이름 및 배포 마이그레이션](./docs/asset-layout.md) — 웹과 네이티브 패키지가 공유하는 설명적 경로.
- [원격 워크벤치](./docs/remote-workbench.md) — UI/미디어 검사, 작업 증빙, 저장된 증거.
- [런타임 진단](./docs/runtime-debug.md) — 오류 이력, 프레임/루프 카운터, Capacitor/Tauri 네이티브 지표 및 서버 디버깅.
- [로컬 macOS 제공 절차](./docs/macos-local-delivery.md) — 체크아웃 빌드, 로컬 설치, 검증.

<a id="license"></a>

## 라이선스

[MIT](LICENSE) — 자유 오픈 소스입니다. 공급자 콘텐츠 및 타사 의존성은 각자의 권리와 라이선스를 유지합니다.

PlxNative에서 파생된 별도 애플리케이션 [OTTPlay native webOS](docs/native-webos.md)는 해당 소스 코드와 함께 **GPL-3.0-or-later** 라이선스로 배포됩니다.
프로젝트 루트의 MIT 라이선스는 이 네이티브 애플리케이션이나 패치의 라이선스를 변경하지 않습니다.

<a id="desktop-updater--notarization-mode-b"></a>

## 데스크톱 업데이트/공증(Mode B)

[데스크톱 서명 및 업데이트 안내](docs/tauri-updater-notarize.md)는 macOS 임시 서명, 선택적 Developer ID/공증 및 번들 검증을 설명합니다. Apple 자격 증명 없이 릴리스 CI는 임시 서명을 사용합니다. 업데이트 서명은 별도이며 프로덕션 자동 업데이트는 아직 설정되지 않았습니다.

<a id="local-mac-build-helpers"></a>

## 로컬 Mac 빌드 도구

[docs/local-build-scripts.md](docs/local-build-scripts.md)를 참고하세요.

<a id="privacy"></a>

## 개인정보

로컬 설정, 구성된 서비스 및 사용자 선택에 관한 내용은 [개인정보 정책](docs/privacy-policy.md)을 읽으세요. 개인정보 및 지원 연락처: [alvit.work@gmail.com](mailto:alvit.work@gmail.com).

기본 인터페이스 테마는 Studio 2026입니다. Classic과 PLi-HD도 선택할 수 있으며 저장된 사용자 설정은 유지됩니다. [인터페이스 설정](docs/interface-settings.md)을 참고하세요. PLi-HD 테마는 Vali, littlesat, VU+NL, Milo와 업스트림 기여자에게 감사를 표합니다. 영어 이력과 출처 링크는 [인터페이스 기여 및 디자인 이력](docs/interface-history.md)에 있으며 플레이어 정보 메뉴에서도 열 수 있습니다.

<a id="demo-video-editing"></a>

## 데모 영상 편집

로컬 [video-use 워크플로](docs/demo-video.md)로 시연 녹화를 준비하고 편집하세요. 도구는 생성된 미디어를 모두 Git 밖에 보관합니다.

<a id="plex-media-library"></a>

## Plex 미디어 라이브러리

각 플레이어는 **Plex** 공급자로 Plex 계정이나 Plex Media Server에 연결할 수 있습니다. 이 통합은 Plex를 사용하며 Synology는 미디어 서버를 호스팅할 수 있는 한 가지 선택입니다. 접근 가능한 모든 동영상과 음악이 채널 목록에 자동으로 표시되며, 카테고리 선택으로 라이브러리, 폴더 또는 시리즈별로 필터링합니다. OTT 서버에 Plex를 설정하지 않아도 첫 사용 가능 배치부터 재생하며 백그라운드 로드, 표준 검색, 섞기/반복 작업을 지원합니다. [Plex 로그인 및 직접 재생](docs/plex-provider.md)을 참고하세요.

![Plex 로드, 파일 탐색, 종료 수명 주기](docs/images/plex-playback-lifecycle.svg)

[그림이 있는 신뢰성 검토](docs/plex-provider.md#reliability-review-process-and-results)는 로드/취소 규칙, 전체 카탈로그와 파일 전환 수정, 측정한 Chromium/WebKit 검증 결과를 설명합니다.

<a id="related-repositories"></a>

## 관련 저장소

- [ottplay-core](https://github.com/open-ott-play/ottplay-core)는 공유 JVM/ES5 도메인 로직, 통신 계약, FOSS2 클라이언트를 담당합니다. 이 플레이어는 생성 산출물을 사용하므로 공유 변경에는 코어 제공 지침을 따르세요.
- [ottplay-android](https://github.com/open-ott-play/ottplay-android)는 별도 네이티브 Kotlin/Compose 앱이며 자체 설치 및 릴리스 ID를 가집니다.
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server)는 자체 호스팅 원격 명령을, [ottplay-swop](https://github.com/open-ott-play/ottplay-swop)는 선택적 Worker 기반 텍스트 입력 전송을 제공합니다.
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine)는 브라우저 데모의 호스팅 프로필, 데모 미디어, 게시 검증을 담당합니다.

<a id="project-maintenance"></a>

## 프로젝트 유지 관리

[기여 및 테스트 요구 사항](CONTRIBUTING.md), [보안 신고 정책](SECURITY.md), [보안 설계](docs/security-design.md), [OpenSSF 증빙 및 남은 기준](docs/openssf-evidence.md)을 참고하세요.
