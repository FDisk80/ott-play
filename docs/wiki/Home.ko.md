<a id="ott-play-documentation-wiki"></a>

# OTT-play 문서 위키

<!-- language-navigation:start -->
<p dir="ltr">
<a href="Home.md" lang="en" dir="ltr">English</a> · <a href="Home.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="Home.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="Home.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="Home.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="Home.es.md" lang="es" dir="ltr">Español</a> · <a href="Home.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="Home.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="Home.he.md" lang="he" dir="rtl">עברית</a> · <a href="Home.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="Home.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="Home.it.md" lang="it" dir="ltr">Italiano</a> · <a href="Home.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="Home.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="Home.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="Home.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="Home.pt.md" lang="pt" dir="ltr">Português</a> · <a href="Home.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="Home.th.md" lang="th" dir="ltr">ไทย</a> · <a href="Home.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="Home.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="Home.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="Home.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="Home.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[README](../../README.ko.md) · [모든 인터페이스 언어](../readme/README.md)

소스 저장소에서 버전 관리되는 문서의 시작 페이지입니다. GitHub는 이 Markdown 페이지를 바로 표시할 수 있습니다. 여기서 관리하면 지침, 다이어그램, 테스트를 코드와 함께 검토할 수 있습니다. 별도의 [GitHub Wiki](https://github.com/open-ott-play/ottplay-foss/wiki)는 이 소스에서 내보내며 각 페이지에 소스 리비전을 표시합니다. [게시 지침](../wiki-publishing.md)을 참고하세요.

<a id="start-and-install"></a>

## 시작 및 설치

- [실용 안내서](../../README.ko.md)는 [문서용 24개 언어](../manual-translations.md)로 제공됩니다.
- [인터페이스 88개 언어 전체의 현지화된 빠른 시작](../readme/README.md). 번역된 UI 라벨과 탐색 단계를 재사용합니다. 88개 언어로 번역된 기술 설명서가 아닙니다. 기본 설명서와 연결된 기능 안내서는 24개 언어의 완전한 판본을 제공합니다.
- [Android Full/API 22 패키지와 업데이트](../android-distributions.md), [Android 빌드](../../android/README.md), [Capacitor iOS/Android](../capacitor-mobile.md).
- [macOS 데스크톱 배포](../macos-local-delivery.md), [Tauri 서명/업데이터](../tauri-updater-notarize.md), [로컬 HTTP 인스턴스](../local-http-deployment.md).

<a id="process-and-results"></a>

## 과정과 결과

- [브라우저 적격성 및 후보 검증](../browser-compatibility.ko.md) ([Русский](../browser-compatibility.ru.md)): 설정된 대상, 컬러 다이어그램, 정확한 패키지 검사, 별도의 로컬 결과.

- [구현 보고서와 컬러 다이어그램](../implementation-report.ko.md) ([Русский](../implementation-report.ru.md)): 검토된 변경, 수정된 회귀, 측정 결과, 남은 릴리스 조건.

<a id="use-the-new-capabilities"></a>

## 새 기능 사용

- [기능 제공과 플랫폼 경계](../roadmap-delivery.ko.md) ([Русский](../roadmap-delivery.ru.md)).
- [화질 상한, 명시적 실시간 예비 소스와 제한된 복구](../playback-stream-policy.ko.md) ([Русский](../playback-stream-policy.ru.md)).
- [수동 XMLTV 연결과 클래식 접근성](../guide-binding-accessibility.ko.md) ([Русский](../guide-binding-accessibility.ru.md)).
- [호스팅된 화면·소리 검사](../audio-video-check.ko.md) ([Русский](../audio-video-check.ru.md)): **정보 → 오디오 → 재생**, 예상 음, 호스팅 다이어그램, 실시간 TV 복귀. 클립은 요청 시 가져오며 인터넷이 필요하고 플레이어 패키지에 들어 있지 않습니다. 별도의 온라인 움직이는 패턴 데모는 무음입니다.
- [Xtream 영화/시리즈 라이브러리](../xtream-media.ko.md) ([Русский](../xtream-media.ru.md)).
- [동일 소스 플레이어 인계](../remote-handoff.ko.md) ([Русский](../remote-handoff.ru.md)).
- [로컬 설정 저널과 복구](../settings-recovery.ko.md) ([Русский](../settings-recovery.ru.md)).
- [신뢰할 수 있는 제어, 재개 가능한 프로필 및 인계](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.md) ([Русский](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.ru.md)). 호환되는 컨트롤러/CLI 리비전과 설정된 권한이 필요합니다.
- [네이티브 Android의 의미 기반 오디오/자막 선호](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.md) ([Русский](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.ru.md)). 네이티브 Kotlin 앱은 이 저장소의 Capacitor APK와 별개입니다.

<a id="configure-sources-and-inspect-problems"></a>

## 소스 설정과 문제 조사

- [Plex 로그인과 재생](../plex-provider.md), [프로그램 가이드 구조](../guide-architecture.md), [호스팅된 EPG 진단](../hosted-epg-diagnostics.md).
- [인터페이스 설정](../interface-settings.md), [설계 역사와 기여자](../interface-history.md), [언어 카탈로그/키보드](../localization.md).
- [원격 작업대](../remote-workbench.md), [런타임 진단](../runtime-debug.md), [진단 동의·민감 정보 가리기·보관](../diagnostic-security.md).
- [네이티브 장치 점검표](../mode-b-device-smoke.md), [Tauri 장치 점검표](../mode-b-tauri-smoke.md), [브라우저 창 제어](../browser-window-controls.md).

- [측정된 기능 비용](../roadmap-size.ko.md), 원시 근거 및 SVG 차트.

<a id="develop-and-release"></a>

## 개발 및 릴리스

- [아키텍처와 소유권](../architecture.md), [재생 세션](../playback-session-architecture.md), [클래식 ES5 빌드](../build-pipeline.md).
- [런타임 자산 이름](../asset-layout.md), [릴리스 정책](../../RELEASING.md), [릴리스 운영 절차](../release-workflow.md), [RC 퍼징](../../FUZZING.md).
- [개인정보 보호정책](../privacy-policy.md)과 [MIT 라이선스](../../LICENSE).

문서를 바꿀 때 UI 라벨이나 빠른 시작 템플릿이 바뀌면 `npm run docs:generate`를, 이어서 `npm run check:docs`를 실행하세요. 모든 번역을 완전하게 유지하고 기능 주장 옆에 제한을 적으며 로컬 검증과 실제 장치 테스트를 구분하세요. 다이어그램은 검토 가능한 저장소 자산입니다. [가이드 연결 SVG](../images/guide-binding.svg)와 기능 안내서의 연결된 다이어그램을 참고하세요. 검사기는 상대 파일 대상을 검증하며 원격 사이트의 가동 여부나 모든 Markdown 제목 앵커까지 검증하지는 않습니다.
