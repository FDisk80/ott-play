<a id="browser-generations-and-operating-systems"></a>

# 브라우저 세대와 운영체제

<!-- language-navigation:start -->
<p dir="ltr">
<a href="browser-compatibility.md" lang="en" dir="ltr">English</a> · <a href="browser-compatibility.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="browser-compatibility.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="browser-compatibility.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="browser-compatibility.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="browser-compatibility.es.md" lang="es" dir="ltr">Español</a> · <a href="browser-compatibility.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="browser-compatibility.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="browser-compatibility.he.md" lang="he" dir="rtl">עברית</a> · <a href="browser-compatibility.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="browser-compatibility.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="browser-compatibility.it.md" lang="it" dir="ltr">Italiano</a> · <a href="browser-compatibility.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="browser-compatibility.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="browser-compatibility.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="browser-compatibility.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="browser-compatibility.pt.md" lang="pt" dir="ltr">Português</a> · <a href="browser-compatibility.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="browser-compatibility.th.md" lang="th" dir="ltr">ไทย</a> · <a href="browser-compatibility.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="browser-compatibility.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="browser-compatibility.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="browser-compatibility.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="browser-compatibility.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[측정 결과](implementation-report.ko.md#browser-gate-integration)

![설정된 브라우저 적격성 검증: 대상 35개, 시나리오 실행 166회](diagrams/browser-qualification.svg)

기존의 장치, 미디어, 구형 ES5/worker, 네이티브 UI, Apple 네이티브 HLS 검사는 계속 필수입니다. 공유 TypeScript 워크플로는 정확히 패키징된 Mode A 아카이브를 대상으로 Plex 시나리오도 실행합니다. 여기에는 현지화된 로드/다시 로드 흐름 두 개, 미디어 변경과 다시 로드 시 HLS.js 및 Video.js 화면 비율 유지, HLS.js를 사용하는 엄격한 키오스크의 자연스러운 에피소드 종료가 포함됩니다. 미디어 시나리오는 실제 디코딩을 사용하며 모든 시나리오는 실제 DOM과 입력을 사용합니다. Plex 데이터와 미디어 소스만 로컬 합성 테스트 데이터입니다.

화면 비율 픽스처는 저장소에 포함된 H.264/AAC 전송 스트림을 별도의 fMP4 변형으로 재다중화합니다. 초기화 헤더는 [RFC 8216 3.3절](https://www.rfc-editor.org/rfc/rfc8216#section-3.3)에 따라 `iso6` 브랜드와 0인 영화/트랙 길이를 사용합니다. AVC 샘플 항목도 SPS 개수의 필수 예약 비트와 마지막 `pre_defined` 필드의 부호 있는 상수 `-1`을 사용합니다. 이는 고정된 픽스처 다중화기가 생성한 컨테이너 구문을 수정합니다. 픽스처 계약은 헤더를 검사하고 잘못된 박스를 거부하면서 코덱 매개변수 집합, 트랙 ID, 시간 척도, 미디어 조각 바이트가 그대로임을 확인합니다. 합성 입력을 검증하는 것이며, 그 자체로 브라우저 재생을 증명하거나 전체 RC 매트릭스를 대체하지 않습니다.

풀 리퀘스트는 Linux의 최신 Chromium, Firefox, WebKit과 Windows의 Chromium, macOS의 WebKit을 요구합니다. nightly 및 beta 빌드도 이 다섯 대상을 요구합니다. RC 적격성 검증은 선언된 35개 대상 모두를 요구합니다. Linux, Windows, macOS의 정확한 Playwright/브라우저 세 세대, 세 시스템 모두에 설치한 안정판 Chrome/Edge, Linux의 beta Chrome/Edge입니다. 과거 macOS WebKit 대상 두 개(Playwright 1.62.1 및 1.63.0)는 `macos-15-intel`을 사용하며, 증빙에 실제 프로세스 아키텍처를 기록하고 ARM 러너를 거부합니다. 직접 MSE 진단에서 동일한 H.264 초기화 및 미디어 바이트가 Intel의 1.63과 ARM의 1.64에서는 완료됐지만, macOS 15 ARM VM의 이전 WebKit은 `updateend` 전에 멈췄습니다. 컨테이너 변경, ManagedMediaSource 사용, 브라우저 창 열기로도 해결되지 않았습니다. 두 대상은 여전히 원래 재생/UI 시나리오 다섯 개를 모두 요구합니다. 이 러너 선택은 모든 물리 macOS 장치나 네이티브 Safari에 대한 주장이 아닙니다. 목록을 재생성할 때 검토된 러너 재정의를 유지해야 하며, 프로필 계약은 이를 제거하면 거부합니다.

Linux WebKit 세 세대는 모두 명시적으로 `ubuntu-26.04` x64 러너를 사용합니다. 검토된 공식 런타임 비교에서는 Ubuntu 24.04에서 엄격한 키오스크 전환 오류가 재현됐고, 동일 후보와 변경 없는 다섯 시나리오는 Ubuntu 26.04에서 네 번 연속 통과했습니다. 이는 개별 멀티미디어 라이브러리를 교체하거나 재생 단언을 완화하지 않고 일관된 지원 런타임을 선택하는 것입니다. 다른 Linux 브라우저 대상은 기존 러너를 유지합니다. 정확한 소스, 산출물, 비교 결과와 한계는 [Linux WebKit 런타임 적격성 검증](linux-webkit-runtime.md)을 참조하세요. 전체 RC 매트릭스와 별도의 패키징된 네이티브 수용 검사는 계속 필수입니다.

테스트한 제품 버전은 런타임에 기록합니다. Playwright Firefox는 패치된 자체 빌드이며 네이티브 Firefox ESR에 대한 보증이 아닙니다. WebKit은 Safari가 아닙니다. 이 매트릭스는 물리 TV나 네이티브 셸의 적격성 검증을 대체하지 않습니다.

전체 목록에는 **플랫폼 대상 35개, 즉 HLS 지원 대상 32개와 UI 전용 Windows WebKit 대상 3개**가 있습니다. 마지막 세 대상도 현지화된 로드/다시 로드 흐름 두 개를 모두 요구하며, 해당 WebKit 빌드에는 MediaSource와 네이티브 HLS가 없습니다. 이는 선언된 제한이지 재생 검사 통과가 아닙니다. 정확한 대상 ID 세 개는 `scripts/browser-compatibility-profile.cjs`에서 검토합니다. 기능 프로브는 UI 테스트 전에 이 제한을 확인해야 합니다. MSE(ManagedMediaSource 포함)나 네이티브 HLS가 사용 가능해지면 프로필을 업데이트할 때까지 게이트가 실패합니다. 다른 모든 대상은 H.264 및 AAC MSE 지원과 변경 없는 다섯 시나리오를 요구합니다. 기능 손실 시 더 작은 테스트 집합을 선택하지 않고 실패합니다. 프로브는 후보의 HLS 라이브러리를 로드하고 고정된 인스턴스 기본값이 선택한 백엔드를 확인합니다. 순서는 MediaSource, ManagedMediaSource, WebKitMediaSource입니다. 증빙에는 백엔드와 HLS 버전을 기록하며, 기본값이나 버전 변경은 프로브 계약에 대한 명시적 검토를 요구합니다.

따라서 전체 RC에는 **시나리오 실행 166회 성공**(32 × 5 + 3 × 2)과 대상 증빙 35개가 필요합니다. PR/nightly/beta 부분 집합은 다섯 대상과 25회 실행을 유지합니다. 각 증빙은 정확한 시나리오 집합, 기능 프로브, HLS 검증 통과 또는 명시적인 미지원 사유를 기록합니다. 이는 설정된 요구 사항이며 특정 RC가 이미 완료했다는 주장이 아닙니다. 제한은 Playwright 1.64가 사용하는 [WebKit Windows 빌드 설정](https://github.com/WebKit/WebKit/blob/56453fdfe0b0ca6258c23e6453b34f70b885d13f/Source/cmake/OptionsWin.cmake#L75)과 고정된 런타임 프로브로 확인합니다.

두 경로 모두 현재 실행에서 생성 작업이 만든 정확한 산출물 ID를 다운로드합니다. 새로 압축을 푼 디렉터리를 제공하기 전에 아카이브 체크섬, 소스 커밋, 패키징된 bundle/provider 해시, 파일 유형과 경로를 확인합니다. 릴리스 검사는 고정된 빌드 증빙도 검증합니다. 브라우저 작업은 테스트할 코드를 다시 빌드하지 않으며 프로덕션 의존성만 설치합니다. 테스트 서버는 여전히 소스의 전체 provider 목록을 요구합니다. 컴파일러는 실제 bundle을 조립할 때만 로드하며 목록 상수를 읽을 때는 로드하지 않습니다. 실패, 건너뜀, 오래됨, 누락된 시나리오 증빙은 공유 게이트를 실패시킵니다. 각 대상의 트레이스, 실제 런타임 식별 정보, 후보 다이제스트를 보존합니다.

생성된 목록/잠금 파일 일곱 개는 `venus-os-ci-toolkit/scripts/prepare_browser_compatibility.py`에서 나옵니다. 애플리케이션 패키지와 과거 브라우저 패키지는 별도 잠금 파일을 사용합니다. GitHub-hosted 러너가 기본값이며, 공유 워크플로는 준비된 Linux 예비 선택을 유지합니다. Windows/macOS 대상은 각각의 네이티브 OS가 필요합니다.

공유 릴리스 판정은 선택된 모든 대상과 소스 SHA, 실행, 시도, 채널, 정확한 후보 산출물 ID를 확인합니다. RC는 다섯 대상의 beta 증빙을 사용할 수 없습니다. stable 승격은 승인된 RC의 바이트를 사용합니다. 실패 후에는 전체 적격성 검증 워크플로를 다시 실행하세요. 이전 시도 증빙으로 새 검증을 완료할 수 없습니다.

<a id="terminal-diagnostics"></a>

## 종료 진단

런타임과 후보 메타데이터를 로드한 뒤, 수용 검증이 완료되거나 예외를 던지면 `scripts/browser-acceptance.cjs`가 `CI_BROWSER_DIAGNOSTICS` 안에 `acceptance-terminal.json`을 기록합니다. 마지막 단계, 소스/후보 식별 정보, 대상 브라우저, 실행/시도, 경과 시간과 테스트 프로세스의 종료 상태, 신호 또는 허용 목록에 있는 오류 코드를 기록합니다. 기록은 2 KiB 미만이며 원시 오류, URL, 표준 출력/표준 오류 출력, 환경 값이나 메모리 덤프를 포함하지 않습니다. 작업이 소유한 기존 출력 디렉터리 안에 배타적 접근과 권한 모드 `0600`으로 생성하며, 기존 파일이나 경로의 마지막 구성 요소에 있는 심볼릭 링크를 덮어쓰지 않습니다.

이는 **진단 증빙이며, 수용 검증 성공이 아닙니다**. 항상 `acceptance: false`를 선언하며, 기존의 모든 단언이 통과한 뒤 별도의 `CI_BROWSER_EVIDENCE` 파일만 후보의 적격성을 인정할 수 있습니다. 진단 기록에 실패해도 원래의 성공 또는 실패를 바꿀 수 없습니다. 래퍼가 갑자기 종료되거나 시작 전에 메타데이터 로드가 실패하면 기록이 남지 않을 수 있습니다. 테스트 프로세스의 신호는 Firefox 콘텐츠 프로세스가 같은 신호를 받았다는 증거가 아닙니다. 네이티브 충돌의 원인을 규명하려면 여전히 일치하는 네이티브 스택이나 통제된 재현 사례가 필요하며, 재시도가 통과해도 조사가 종결되지는 않습니다.

이 도우미는 원시 Firefox 충돌 보고서나 `DEBUG=pw:browser` 로깅을 활성화하지 않습니다. 브라우저 메모리와 콘솔 출력에는 민감한 데이터가 들어 있을 수 있으므로, 별도로 검토한 수집 및 접근 정책 없이 일반적으로 업로드하는 산출물에 복사해서는 안 됩니다. 시나리오 순서, 고정된 브라우저 버전, 워커 한 개, 재시도 없음과 기존 시간 제한은 그대로 유지됩니다.

<a id="from-source-to-accepted-candidate"></a>

## 소스에서 승인된 후보까지

![소스, 패키지 검증, 기능 검사 및 증빙](diagrams/candidate-verification-flow.svg)

1. 검토된 소스를 빌드하고 생성된 Mode A 파일을 패키징합니다. 아카이브 체크섬과 소스 식별 정보를 후보와 함께 보관합니다.
2. 압축 해제 전에 아카이브 크기 제한, 안전한 경로, 파일 유형, 소스/버전, 전체 항목/provider 해시 목록을 검증합니다. 릴리스 적격성 검증은 고정된 빌드 증빙도 확인합니다.
3. 실제 브라우저 버전과 미디어 기능을 조사하고 선언된 프로필을 선택합니다. 기능 불일치는 범위를 조용히 축소하는 대신 실패해야 합니다.
4. 압축 해제된 파일에 정확한 시나리오 집합을 다시 빌드하지 않고 실행합니다. 모든 시나리오가 정확히 한 번, 건너뜀·실패·재시도 없이 통과해야 합니다.
5. 런타임, 기능, 후보 다이제스트와 시나리오 결과를 보존합니다. 공유 게이트는 증빙 수용 전에 필수 대상 및 실행/시도/소스 일치를 확인합니다. 릴리스 조정과 장치 수용은 별도 조건입니다.

<a id="what-has-been-measured-locally"></a>

## 로컬에서 측정한 내용

![로컬 통합 검증: 장치와 패키징된 브라우저의 별도 테스트 집합](diagrams/browser-verification-results.svg)

소스 `c52f4d07`에서 전체 Chromium 장치-브라우저 실행은 196개 테스트를 통과했고, 네이티브 HLS 하나는 예상대로 건너뛰었습니다. 별도로 동일한 Mode A 패키지 아카이브는 Chromium 156.0.8078.4, Firefox 157.0, WebKit 27.2에서 각각 다섯 시나리오를 통과했습니다. 총 15개 통과, 건너뜀과 재시도는 없었습니다. 이들은 서로 다른 테스트 집합이며, 개수는 범위 백분율이나 hosted 대상 35개 전체의 통과 증거가 아닙니다.

[저장된 증빙](evidence/post779-local-acceptance/summary.json)은 실제 macOS 26.7.1 호스트를 식별합니다. `macos-15` 프로필 레이블과 명확히 구분하며 릴리스 적격성을 부여하지 않습니다. Mac에서 이 로컬 검사를 반복하려면 잠긴 의존성과 Playwright 1.64.0 브라우저를 설치하고 현재 소스를 빌드한 뒤, 저장소 디렉터리를 인자로 [저장된 절차](evidence/post779-local-acceptance/reproduce.sh)를 실행하세요. 기존 빌드를 패키징하고 후보를 검사하며 각 브라우저를 조사해 `.compatibility/` 아래에 새 증빙을 저장합니다. 포트 4189가 필요하며 기존 `browser-candidate-web` 디렉터리는 덮어쓰지 않습니다. 빌드와 절차 실행 사이에 소스를 변경하지 마세요. hosted CI와 물리 장치 결과는 [구현 보고서](implementation-report.ko.md)에서 별도로 추적합니다.
