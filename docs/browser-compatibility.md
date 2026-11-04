# Browser generations and operating systems

<!-- language-navigation:start -->
<p dir="ltr">
<a href="browser-compatibility.md" lang="en" dir="ltr">English</a> · <a href="browser-compatibility.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="browser-compatibility.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="browser-compatibility.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="browser-compatibility.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="browser-compatibility.es.md" lang="es" dir="ltr">Español</a> · <a href="browser-compatibility.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="browser-compatibility.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="browser-compatibility.he.md" lang="he" dir="rtl">עברית</a> · <a href="browser-compatibility.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="browser-compatibility.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="browser-compatibility.it.md" lang="it" dir="ltr">Italiano</a> · <a href="browser-compatibility.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="browser-compatibility.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="browser-compatibility.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="browser-compatibility.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="browser-compatibility.pt.md" lang="pt" dir="ltr">Português</a> · <a href="browser-compatibility.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="browser-compatibility.th.md" lang="th" dir="ltr">ไทย</a> · <a href="browser-compatibility.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="browser-compatibility.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="browser-compatibility.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="browser-compatibility.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="browser-compatibility.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[Measured results](implementation-report.md#browser-gate-integration)

![Configured browser qualification: 35 targets, 166 scenario executions](diagrams/browser-qualification.svg)

The existing device, media, legacy ES5/worker, native UI and Apple native-HLS
checks remain required. The shared TypeScript workflow additionally runs the
Plex scenarios against the exact packaged Mode A archive: two
localized loading/reload flows, HLS.js and Video.js aspect persistence across
media changes/reload, and strict-kiosk natural episode completion with HLS.js.
The media scenarios use real decoding; all scenarios use real DOM/input. Only
Plex data and the media source are synthetic local fixtures.

The aspect fixture transmuxes the checked-in H.264/AAC transport stream into
separate fMP4 renditions. Its initialization headers use an `iso6` brand and
zero movie/track durations, as required by [RFC 8216 section 3.3](https://www.rfc-editor.org/rfc/rfc8216#section-3.3).
The AVC sample entry also uses the required reserved bits in its SPS count and
the signed `-1` constant in its trailing `pre_defined` field. These correct
container syntax emitted by the pinned fixture muxer. A fixture contract checks
these headers and rejects malformed boxes while proving that codec parameter
sets, track IDs, timescales and media fragment
bytes are unchanged. This validates the synthetic input; it does not by itself
prove browser playback or replace the complete RC matrix.

Pull requests require current Chromium, Firefox and WebKit on Linux, Chromium
on Windows, and WebKit on macOS. Nightly and beta builds require these five targets. RC qualification requires
all 35 declared targets:
three exact Playwright/browser generations on Linux, Windows and macOS plus
installed stable Chrome/Edge on all three systems and beta Chrome/Edge on Linux.
The two historical macOS WebKit targets (Playwright 1.62.1 and 1.63.0) use
`macos-15-intel`; their receipts record the actual process architecture and
reject an ARM runner. Direct-MSE diagnosis found that the same H.264 initialization
and media bytes completed on Intel with 1.63 and on ARM with 1.64, while older
WebKit on the macOS 15 ARM VM stalled before `updateend`. Changing containers,
using ManagedMediaSource, or opening a browser window did not resolve that stall.
These two targets still require all five original playback/UI scenarios. This
runner choice is not a claim about every physical macOS device or native Safari.
Inventory regeneration must retain these reviewed runner overrides; the profile
contract rejects their removal.

All three Linux WebKit generations use the explicit `ubuntu-26.04` x64 runner.
The reviewed official-runtime comparison reproduced the strict-kiosk transition
failure on Ubuntu 24.04 while the same candidate and five unchanged scenarios
passed four consecutive times on Ubuntu 26.04. This selects a coherent supported
runtime, without replacing individual multimedia libraries or relaxing playback
assertions. The other Linux browser targets retain their existing runners.
See [Linux WebKit runtime qualification](linux-webkit-runtime.md) for the exact
source, artifact, comparison results and limits. The complete RC matrix and
separate packaged native acceptance remain required.

The tested product versions are recorded at runtime. Playwright Firefox is its
patched build, not an assertion about native Firefox ESR; WebKit is not Safari.
This matrix does not replace qualification on physical TVs or native shells.

The full inventory has **35 platform targets: 32 HLS-capable targets and three
Windows WebKit UI-only targets**. The latter still require both localized
loading/reload flows; their WebKit build has neither MediaSource nor native HLS.
This is a declared limitation, not passed playback coverage. The exact three
target IDs are reviewed in `scripts/browser-compatibility-profile.cjs`.
A capability probe must confirm that limitation before their UI tests run. If
MSE (including ManagedMediaSource) or native HLS becomes available, the gate
fails until the profile is upgraded.
Every other target requires both H.264 and AAC MSE support and all five unchanged
scenarios; losing a capability fails instead of selecting a smaller suite.
The capability probe loads the candidate’s HLS library and checks the backend
selected by its pinned instance default: MediaSource, then ManagedMediaSource,
then WebKitMediaSource. The receipt names that backend and HLS version; a
changed default or version requires explicit review of the probe contract.

Consequently, a complete RC requires **166 successful scenario executions**
(32 × 5 + 3 × 2), with 35 target receipts. The PR/nightly/beta subset remains five
targets and 25 scenario executions. Each receipt records its exact scenario set,
capability probe and either passed HLS coverage or the explicit unsupported
reason. These are configured requirements, not a claim that a particular RC has
already completed them. The limitation is confirmed by the
[WebKit Windows build configuration](https://github.com/WebKit/WebKit/blob/56453fdfe0b0ca6258c23e6453b34f70b885d13f/Source/cmake/OptionsWin.cmake#L75)
used by Playwright 1.64 and by the pinned runtime probe.

Both paths download the producing job's exact current-run artifact ID. Archive
checksums, source commit, packaged bundle/provider hashes, file types and paths
are checked before serving a fresh extracted directory. Release checks also
verify the frozen build receipt. Browser jobs do not rebuild the tested code.
They install production dependencies only. The test server still requires the
complete provider inventory from the source; the compiler loads only when an
actual bundle is assembled, not when its inventory constants are read.
Failed, skipped, stale or missing scenario evidence fails the shared gate; traces,
actual runtime identity and candidate digest are retained for each target.

The seven generated inventory/lock files come from
`venus-os-ci-toolkit/scripts/prepare_browser_compatibility.py`. Application
packages and historical browser packages have separate lockfiles. GitHub-hosted
runners remain the default; the shared workflow retains the prepared Linux
reserve selection, while Windows/macOS targets require their native OS.

The shared release verdict verifies every selected target and its source SHA,
run, attempt, channel and exact candidate artifact ID. RC cannot use the five-
target beta evidence. Stable promotion consumes the accepted RC bytes. Re-run
the whole qualification workflow after failure; older attempt receipts cannot
complete a new qualification.

## Terminal diagnostics

After the runtime and candidate metadata load, `scripts/browser-acceptance.cjs`
writes `acceptance-terminal.json` in `CI_BROWSER_DIAGNOSTICS` when acceptance
finishes or throws. It records the last phase, source/candidate identity,
browser target, run/attempt, elapsed time and the test-process exit status,
signal or an allowlisted error code. The record is below 2 KiB and contains no
raw errors, URLs, stdout/stderr, environment values or memory dumps. It is
created with exclusive access and mode `0600` in the existing job-owned output
directory; an existing file or final symlink is not overwritten.

This is **diagnostic evidence, not successful acceptance**. It always declares
`acceptance: false`; only the separate `CI_BROWSER_EVIDENCE` file can qualify a
candidate after every existing assertion passes. A failed diagnostic write
cannot replace the original success or failure. An abrupt termination of the
wrapper, or a metadata-load failure before it starts, may leave no record.
A test-process signal is not proof that Firefox's content process received that
signal. Native crash attribution still needs a matching native stack or a
controlled reproducer; a passing retry does not close the investigation.

Raw Firefox crash reports and `DEBUG=pw:browser` logging are not enabled by this
helper. Browser memory and console output may contain sensitive data and must
not be copied into ordinary uploaded artifacts without a separately reviewed
collection and access policy. The scenario order, browser pins, one worker,
zero retries and existing timeouts are unchanged.

## From source to accepted candidate

![Source, package verification, capability checks and evidence](diagrams/candidate-verification-flow.svg)

1. Build the reviewed source and package the resulting Mode A files. Keep the
   archive checksum and source identity with the candidate.
2. Before extraction, verify bounded archive size, safe paths, file types,
   source/version, and the complete entry/provider hash inventory. Release
   qualification additionally checks the frozen build receipt.
3. Probe the actual browser version and media capabilities. Select the declared
   profile; a capability mismatch fails instead of silently reducing coverage.
4. Run the exact scenario set against the extracted files, without rebuilding.
   Require every scenario exactly once, with no skips, failures or retries.
5. Retain the runtime, capabilities, candidate digest and scenario results.
   The shared gate checks the required targets and matching run/attempt/source
   before accepting the evidence. Release coordination and device acceptance
   remain separate conditions.

## What has been measured locally

![Local integration verification: separate device and packaged-browser suites](diagrams/browser-verification-results.svg)

At source `c52f4d07`, the complete Chromium device-browser run passed 196 tests
with one expected native-HLS skip. Separately, the same packaged Mode A archive
passed five scenarios in each of Chromium 156.0.8078.4, Firefox 157.0 and WebKit
27.2: 15 passes, no skips or retries. These are different suites; their counts
are not a coverage percentage or proof that all 35 hosted targets passed.

The [saved receipts](evidence/post779-local-acceptance/summary.json) identify the
actual macOS 26.7.1 host. They explicitly distinguish it from the `macos-15`
profile label and do not qualify a release. To repeat this local check on a Mac,
install the locked dependencies and Playwright 1.64.0 browsers, build the current
source, then run the [saved recipe](evidence/post779-local-acceptance/reproduce.sh)
with the repository directory as its argument. It packages the existing build,
checks the candidate, probes each browser and saves new receipts under
`.compatibility/`. It requires port 4189 and refuses to overwrite an existing
`browser-candidate-web` directory. Keep the source unchanged between building
and running the recipe. Hosted CI and physical-device results are tracked
separately in the [implementation report](implementation-report.md).
