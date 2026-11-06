#!/usr/bin/env node
// Measure final artifacts, including native transformations, in UTF-8 bytes.
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { gzipSync } = require("node:zlib");

// Bound the shipped outputs after settings and codec deduplication, including
// PLi-HD/Studio layouts, settings fixes and offline credit controls. Allow
// candidate-version suffixes and Node/zlib variation: CI Node 22 compresses
// these bundles less than local Node 26. ES5, persisted menu identities and
// final-artifact checks remain enforced.
// Localized keyboard paging/case-safe cells, translated menus and eight new
// selector entries add <1 KB after shared label reuse. Dictionaries stay external.
// The optional PC2 engine port also fits within these measured budgets.
// Owned episode looping and the natural-ended bridge add about 1.8 KB raw.
// Persistent page-title filtering adds about 1.5 KB, including its TV editor.
// Hosted EPG orchestration and encrypted same-Site input add ~14 KB raw;
// gzip/XML parsing remains in separately loaded worker assets.
// Visible hosted EPG diagnostics and retry add ~5.6 KB raw / 1.5 KB gzip.
// Remote CLI queries, result delivery and provider adapters add ~9 KB raw.
// Discovery, secure pairing and its UI measure 603103 raw / 182299 gzip
// for web 1.1.50 on Node 22.23.3 (native gzip 182353). Retain release headroom.
// Protected iOS sources retain cancellation and session checks after transport
// helper deduplication. Native Node 22 output exceeded the previous gzip cap by
// 16 bytes; allocate 50 bytes for this reviewed feature cost without raising raw
// or complete-payload limits.
// CSP-safe playback controls plus shared color-picker layout reduce raw output
// by 119 bytes and add 210 gzip bytes to native output on Node 22.23.2. The beta
// artifact measures 183726 gzip bytes; allow this reviewed feature cost and
// version suffix headroom while retaining raw and complete-payload limits.
// Producer-owned EPG/LG remote snapshots add 863 raw / 277 gzip bytes over
// published beta.7 (605567 / 183673 on Node 22.23.2). The measured candidate
// is 606430 / 183950 for web and 606388 / 184004 for native. Allocate 500 raw
// and 50 gzip entry bytes for this reviewed feature and version suffix room.
// Unicode remote matching on Node 22.23.3 measures 606636 raw / 184035 gzip
// for web and 606594 raw / 184089 gzip for both native variants. Allocate its
// measured cost plus candidate suffix room; retain the complete gzip limit.
// Native list swipes retain gesture ownership across paginated row replacement.
// Node 26 measures 608740 raw / 184260 gzip (web), 608698 / 184317 (native).
// Include release suffix room and the established Node 22 gzip variation.
// Remote VPortal collection, cancellation and per-visit URL renewal measure
// 615932 raw / 186854 gzip on Node 26.8.2 (native 615890 / 186913).
// Removing redundant canonicalization and metadata work saves 400 raw bytes.
// Budget the new feature explicitly,
// retaining candidate suffix room and the established Node 22 gzip allowance.
// Server EPG metadata snapshots and catalogue-bound playback add 1885 raw /
// 535 gzip bytes: 617817 / 187389 web on Node 26.8.2, without guide downloads.
// M3U profile management and acknowledged playback restarts add 8539 raw /
// at most 2585 gzip bytes on Node 22.23.2: web 626025 / 190382 and native
// 625983 / 190440. Include explicit paused startup for the core and PC2 engines.
// With inline video and native single-tap rows, the combined build measures
// 626111 / 190420 for web and 626069 / 190480 for native, within these limits.
// Cancellable iOS sign-in/proxy requests, peak touch movement and immediate PiP
// Stop add 995 raw / 384 gzip bytes to fe79de1 on Node 22.23.2. With the accepted
// EPG changes, web measures 627267 / 190842 and native 627225 / 190902. Allocate
// this reviewed lifecycle cost while retaining release-version headroom.
// NAS discovery and per-client Plex add bounded library boot and playback routing.
// Folder shuffle and explicit repeat add owned collection/EOS transitions,
// parental checks and source-scoped preference storage. Keep those guards;
// Plex pagination stays in its optional provider asset. Account for this
// reviewed feature cost: Node 26.8.2 web 640894 / 194762 gzip, native
// 640852 / 194822; retain native, Node 22 and release suffix headroom.
// This includes exact Plex cold resume, its guarded startup intent and exit flush.
// One-time VPortal queue shuffling also fits within these entry limits.
// Plex folder restoration retains bounded route metadata and rebuilds sibling
// queues with cancellation guards. Node 26.8.2 measures 644120 raw / 195549
// gzip for web, 644078 / 195613 native; retain Node 22 and release suffix room.
// Continuous catalog browsing adds owned page append/cancellation and a retry
// row without copying catalogs on each highlight. Node 26.8.2 measures
// 647536 raw / 196635 gzip for web; include native, Node 22 and suffix room.
// Visible shuffle/repeat modes, ordered-queue restoration and DOM digit fallback
// measure 650817 raw / 197647 gzip on Node 26.8.2. Preserve the established
// native, Node 22 and candidate-suffix allowance for this control-state feature.
// Catalogue-bound remote archive resolution/playback adds 2553 raw / 735 gzip
// bytes: Node 26.8.2 web measures 653370 / 198382. Retain the existing native,
// Node 22 and candidate-suffix allowance for these admission checks.
// Query-selected HLS Auto fallback reuses the native URL predicate (+93 raw).
// Numbered Stalker preset writes add validation, isolated persistence and safe
// acknowledgements. Missing-category localization adds 22 raw bytes. Combined
// Node 22.23.3 output before Plex is 655714 / 199443 web and 655672 / 199504 native.
// Plex adds owned loading, bounded connection retries and manual queue skips
// with cancellation and parental admission (+1593 raw entry bytes). Combined
// Node 22.23.3 output is 657307 / 199903 web and 657265 / 199963 native;
// retain bounded candidate-version suffix headroom for this feature cost.
// Runtime-scoped diagnostics, consent UI and complete logger cleanup add a
// measured 28 KB raw / 8.4 KB gzip. Node 26 measures 685215 / 208384 for the
// entry; allow native transforms, Node 22 compression and release suffix room.
// Installation-bound trust, durable revocation and acknowledged runtime repairs
// add about 10.5 KB raw, including cross-tab revocation; retain the bounded
// native/Node/version allowance.
// Persistent kiosk policy, admission/input guards and ten-second recovery add
// 6704 raw entry bytes. Node 26.8.2 measures 664011 / 201509 gzip; retain
// native, Node 22 and candidate-version headroom for this optional feature.
// Typed remote controls, semantic input admission and probed native lifecycle
// add about 9.9 KiB raw / 2.9 KiB gzip to the entry; provider assets are unchanged.
// Node 26.8.2 measures 714105 raw / 217220 gzip for web and 714063 / 217278
// for native. Retain bounded Node 22 and release-version suffix headroom.
// Language-switch recovery, generated-label provenance and native dialog labels
// add bounded interface logic; all 28 dictionaries remain external assets.
// Include native transforms, Node 22 compression and release suffix headroom.
// Adjacent-channel control and guarded list/PiP admission add 3272 raw/939 gzip
// bytes over be969d6 on Node 22.23.3: combined web 722437/220327 and native
// 722395/220390. Allocate the reviewed 3300 raw/950 gzip increment in addition
// to the localization budget, preserving both feature reserves.
// Atomic signed channel offsets add 426 raw / at most 186 gzip bytes over
// a845242 on Node 22.23.3. Preserve its 450 raw / 200 gzip feature allowance.
// Independent VPortal profiles load in an optional family. Persisted VOD kiosk
// admission/recovery adds about 6 KB to the entry. Keep both feature reserves
// and bounded native/Node/release-suffix room in the combined cap.
// Preserve the additional 2100 raw / 700 gzip allowance for Tauri native
// frame-loss recovery from main; it does not change optional provider assets.
// Thirty external catalogs add selector labels, script-mark labels and owned
// native composition/explicit-apply handling. Add 3.5 KB raw / 1.2 KB gzip
// while preserving each upstream feature and release-version reserve.
// Thirty more external catalogs and Georgian/combining-mark keyboard support
// add 1293 raw / about 800 gzip entry bytes. Node 22 measures 734887 raw /
// 225215 gzip for web; retain the existing native and candidate suffix reserve.
// Remote screenshots add a bounded capture adapter, local permission UI and
// expiring image delivery. Reserve 13 KB raw / 4 KB gzip for this feature;
// external dictionaries and native capture implementations remain separate.
// Explicit Plex queues keep their implementation in the optional Plex asset.
// Node 22.23.3, level-9 gzip: web entry 750532/230056, native 750490/230118.
// The lazy dispatcher and transactional media handoff exceed the prior caps by
// 1082 raw / 318 gzip bytes. Increase those caps by 1650 / 600, leaving at least
// 568 raw / 282 gzip bytes for native and candidate-version variation.
// Decoder-confirmed state, catalog lease preservation and recoverable native
// errors add 560 raw / 164 gzip bytes on Node 22: web 751092 / 230220.
// Allocate 600 / 200 to preserve the existing release-version headroom.
// Complete localization, system/media language preferences and pinned Unicode 17
// measure 783615 / 243951 web and 783573 / 244023 native on Node 22.23.3,
// compared with 746380 / 228703 web and 746338 / 228765 native at 8c240190.
// Compact ASCII varints keep normalization, grapheme and full case-fold data
// inside the measured entry. Bounded cookie recovery uses part of the original
// reserve; the unchanged cap leaves at least 685 raw / 477 gzip bytes at 1.1.53.
// Do not exclude these tables or storage helpers from the measurement.
// Both branches consumed the same historical reserve: common source 6f497732
// measures 746380 / 228703, below its 749450 / 229800 cap. Adding only cap
// increments therefore undercounts their combined cost. Latest main 3d7b65b7
// measures 783764 / 243995; Plex, decoder ownership and explicit native Resume
// together measure 788914 / 245600 on Node 22.23.3. Add their measured 5150 /
// 1605 cost, rounded to 5200 / 1650, to main's 784300 / 244500 cap so the
// existing native and release-version reserve is retained exactly once.
// Read-only doctor snapshots, exact-target inspection and bounded operation
// receipts, pure capability reads and the integrated Unicode fixes measure
// 804298 raw bytes on Node 22.23.3 before the embedded clean-source hash.
// Allocate 15500 / 4800 over 67618611 for this combined feature cost, retaining
// native transforms, the source hash and release suffix room. No provider moved.
// A cancellable Plex file-selection wait reuses the startup loading UI.
// The entry adds 871 raw bytes to the integrated 804881-byte baseline,
// including pointer/wheel admission behind the dialog and a clean source hash.
// Node 22.23.3 measures a 332-byte native gzip increment before that hash;
// allocate 900 raw / 400 gzip bytes to preserve the release-version reserve.
// Localized remote/touch feedback and language recovery share command playback
// code instead of repeating it. On clean Node 22.23.3 the combined web entry is
// 805979 raw / 251002 gzip; native is 805937 / 251071. Add only 200 raw bytes,
// leaving 121 before the release suffix; gzip and complete-payload caps stay put.
// Explicit Capacitor update dispatch adds 2367 raw bytes; retain release suffix room.
// Bounded kiosk reload and duplicate-item checkpoints measure 809372 raw web
// bytes on Node 26.8.2 (+661); retain native and release suffix headroom.
// Explicit aspect control, fenced persistence and media-only restore add 4889
// raw / at most 1353 gzip bytes over 57d8dd1 on Node 22.23.3.
// Web measures 810945 / 252390; native 810903 / 252458. Add 4900 / 1400
// to preserve the existing native and release-suffix reserve once.
// Combined with Android updates and durable kiosk cooldown checks, Node 22.23.3
// measures 814350 / 253386 web and 814308 / 253454 native within that allowance.
// Guarded kiosk frame-progress sampling and persistent retry evidence measure
// 817201 raw web bytes on Node 26.8.2. Allocate 3200 raw / 1100 gzip bytes for
// this shared recovery feature, retaining native and release-suffix headroom.
// Episode-bound strict-kiosk footer gestures add 2011 raw / 600 gzip bytes on Node 26.8.2.
// Budget this local seek control while retaining native/version headroom.
// Connected-runtime diagnostics add the bounded event ring, loop/frame counters,
// native projection and cancellable inspection. Same Node 26.8.2 toolchain:
// base 5c7bc823 = 819252 / 254180; candidate = 827579 / 256753 before the
// clean-source hash. Allocate 8500 raw / 2800 gzip for this reviewed feature,
// preserving the existing native, clean-source and release-suffix headroom.
// Android screen/lifecycle suspension adds 1640 raw bytes on Node 26.8.2
// (829840 total entry bytes). Retain clean-source and release suffix headroom;
// CI Node 22 measures 258390 gzip entry bytes before the native variant;
// allow the measured ~490-byte compressed feature cost plus suffix headroom.
// Named Plex libraries retain strict eager admission and lazy bounded collection.
// After a 265-byte entry reduction, Node 22.23.3 / zlib 1.3.1-e00f703 at the
// common 1.1.54 version measures base ef31f556 at 829930 / 258405 web and
// 829888 / 258473 native; candidate 23e3fa5c is 831249 / 258803 web and
// 831207 / 258869 native. Allocate the measured +1319 raw / +398 gzip cost
// rounded to +1350 / +400, preserving the existing native/version reserve.
// The 1.1.54-beta.1 entry is 831270 / 258821 web, 831228 / 258889 native.
// Cross-profile remote favorites add a bounded global index, durable source
// references, guarded profile loading and fresh media resolution. Node 22.23.3
// measures 845765 raw / 262584 gzip for the web entry. Allocate 14500 raw /
// 3600 gzip over the prior cap, retaining native and release suffix headroom.
// Standby tears down both lanes, retires pending Plex work and isolates cleanup
// failures. Node 22.23.3 measures 846770 / 262859 web, 846728 / 262927 native:
// +1005 raw / +275 gzip over the prior web entry. Allocate +1000 / +300 while
// preserving bounded native and release-version headroom.
// Cancellable Plex arrow waits and buffered HLS resume add 1282 raw / at most
// 366 gzip bytes on Node 26.8.2 at version 1.1.54. Allocate +1300 / +400, retaining
// the existing native, clean-source identity and release-version reserve.
// Reviewed roadmap cost: bbf9ca7b -> cae971da on the same Node 26.8.2,
// Terser 5.51.2 and zlib 1.2.12: entry 848092/262392 -> 874926/270321
// raw/gzip; native 874884/270372. Retain the prior Node 22/native/version
// reserve, plus the one-byte rooted diagnostic URL fix. Full evidence and
// scope (JavaScript only, separate A/V asset) are in docs/roadmap-size.md.
// Post-beta Plex integration and explicit damaged-journal recovery (including
// scoped cookie reset) measure 879533 / 271761 on Node 26.8.2, Rollup 4.64.5.
// Allocate their measured cost while preserving native/Node 22/version room.
// Transport suspension retains the logical lease while cancelling its engine
// and resolver, then safely reattaches on wake. Node 26.8.2 measures 848868 raw /
// 262607 gzip web bytes. Reserve +1000 raw for this lifecycle path and its
// stale-callback guards; retain the existing compressed budget.
// The required 40-hex source revision adds up to 40 gzip bytes across 68
// identity controls on Node 22.23.3. Native output reaches 263606 gzip bytes.
// Allocate 64 compressed bytes for this metadata and its compression variation;
// keep the raw cap and every staged entry check unchanged.
// Attached-engine diagnostics add 868 raw / at most 233 gzip bytes on Node
// 22.23.3 across beta.10 and final-base web/native output; reserve 900 / 256.
// Explicit debug-v2 negotiation preserves legacy payloads. Node 22.23.3 measures
// +235 raw / at most 108 gzip bytes; existing raw limits fit. Allocate 128 gzip
// bytes per entry and complete payload while keeping all provider assets counted.
// Salted PIN migration, bundled SHA256/HMAC/PBKDF2 primitives and fail-closed
// backup/rollback boundaries add 12549 raw / at most 4203 gzip bytes over 29e44213
// on Node 26.8.2: web 862631/267163, native 862589/267222. Allocate 12600/4250
// once, preserving existing Node22 and release-identity reserves. No payload
// or compatibility checks are removed; the seven provider assets are unchanged.
// Verified startup protection replaces post-unlock legacy migration. Its guarded
// load/publication and complete-copy failover add 480 raw bytes on Node 26.8.2
// (863111 versus 862631). Allocate 500 raw bytes. Recompressing the same
// source with CI Node 22.23.3 (zlib 1.3.1) measures 268281 / 268346 gzip
// web/native, versus 268113 / 268182 before startup protection. Allocate
// 192 gzip bytes for the measured maximum +168, retaining the prior source
// identity and release-version headroom. Node 26 uses a different zlib build.
// The scoped SJCL word-copy fix avoids V8 species-probe startup stalls.
// Node 22.23.3: prior 848f web 863151/268323 -> fixed 863425/268420.
// Reserve +256 raw/+128 gzip once; all five measured outputs fit while
// preserving native transforms and release-identity room.
// Combine the independently reviewed roadmap and main allowances once over
// their common 1ecbc0e7 baseline (848400 raw / 263600 gzip). No artifact or
// provider is excluded, and no additional integration reserve is introduced.
// Source-bound debug-v3 attempt history retains internal retries and EOF counters
// without changing v1/v2 payloads. Same Node 22.23.3, version 1.1.56 and 40-hex
// identity: baseline 1e8973 web 894773/277766, native 894731/277823;
// deduplicated implementation web 896640/278330, native 896598/278387.
// Add exactly +1867 raw/+564 gzip once, preserving the existing 383-byte raw
// and 195-byte worst-native gzip reserve. Beta.1 projects to 896661/278350
// web and 896619/278405 native; no provider or artifact is excluded.
// Local media library adds bounded 16KB raw / 5KB gzip to the entry.
// Offline profile storage, import/export boundaries and local binding UI:
// same-version Node 26 baseline c98c115d entry 912941/282340 vs 928115/286930.
// Allocate the measured +15174/+4590 with bounded release/native room.
// Upstream loading spinner adds 459 raw bytes; count its 512-byte allowance once.
// Upstream desktop volume capture and Ctrl seek add 155 raw bytes; allow 256 once.
// Retain the existing gzip cap and all native/provider artifact checks.
// Desktop volume capture and Ctrl seek add 155 raw bytes; allow 256 once.
// Nonblocking local startup and bounded source recovery add 454 raw bytes.
// Progressive 10k-file scanning, preferred resume and append-only catalogs add
// 3322 raw bytes and ~1.2 KB gzip; reserve 3584/1536 for this feature
// while retaining prior Node/zlib compression headroom.
// Legacy bookmark readiness and scan counters consume the remaining raw headroom;
// allow another 512 bytes while retaining the gzip cap.
// Initial scan phases and metadata progress need 60 more bytes; reserve 256.
// Native progressive polling, bounded requests and first-item playback measure
// 920867 raw / 284799 gzip on Node 26. Use prior headroom plus 2304/768 bytes;
// native artifacts and optional providers remain included in the same gates.
// Reversible list shuffle and stable favorites backup add 4304 raw bytes.
// Allocate 4608/1024 once, plus the 16 KiB / 5 KiB profile allowance.
// Profile persistence and non-scanning snapshots add 15790 raw bytes over
// the progressive native baseline. All provider/native artifacts stay gated.
// Restored profile ownership/atomic recovery and browser/native inactivity
// bounds add 2058 raw bytes to the final integrated entry. Reserve 2304/768.
// Selected Plex/VPortal sources, progressive channel playlists and owned file
// playback add 10941 raw / at most 3105 gzip entry bytes over 4f9aea8a on
// Node 26.8.2: web 952023/293798, native 951981/293855. Allocate 11000/3150
// while retaining the previous native, Node 22 and release-suffix allowance.
// Combined with PR818 recovery guards: 954096/294386 web, 954054/294444
// native on Node 26.8.2; retain both independently measured allowances.
// PR820 local resume/exit and per-profile journal isolation reserve another
// 512 + 256 raw bytes in the entry, with no increase to its gzip allowance.
// Visible progressive-list refresh, owned VPortal failure completion and Local
// file arrows add 1529 raw entry bytes on Node 26.8.2 (956603 total). Reserve
// 1600 raw bytes for these guards. Node 22.23.3 / zlib 1.3.1 measures
// 295986 gzip in CI before the native suffix; reserve another 256 gzip bytes
// for that compressor, native artifacts and release identity. Total caps stay.
// Retain the independently measured standby allowance once: 11264 raw / 3712 gzip.
// Combined with main 4fe571e3 on Node 22.23.3: web 967984/299580,
// native 967942/299643; complete web 1099953/347857 and native 1099911/347920.
// Owned Local EOF transitions and filename rendering add ~1368 raw / 458 gzip
// bytes over afb7e4b9 on Node 26.8.2 (web 968685/298948 before the change).
// Allocate 1536/512 once, retaining native, Node 22 and release identity room.
// Collection/programme clocks and scalar successor reads add 4755 raw / 1481
// gzip entry bytes on Node 26.8.2 (974808 / 300930 total). Reserve 5120 raw / 1536 gzip for
// this feature, retaining native/Node 22 and release suffix headroom.
// Stable-group/history reaches 302000 gzip bytes on the macOS CI Node 22.23.3
// runner. Matching local Node 22 measures 302042 native with a beta suffix.
// Reserve 256 gzip bytes for this measured feature and native/release variation.
// Deferred browser import, source priority and one-shot provider handoff add
// 1107 raw bytes on Node 22; reserve 1280 for the feature and version suffix.
// Web gzip is 302279 bytes; allow the measured native and release suffix delta.
// Browser enumeration phases, honest counters and cold-directory deadlines add
// 1337 raw entry bytes on Node 22; reserve 1536 including release identity room.
// Web gzip is 302703 bytes; retain 448 extra bytes for native/release variation.
// Startup cancellation, sanitized read failures and local standby wake add
// about 2613 raw bytes on Node 22; reserve 2816 for this reviewed feature set.
// Web gzip is 303501 bytes; add 896 for native transforms and release identity.
// Source-bound local-folder kiosk adds 2167 raw / 730 gzip bytes on Node 22.
// Keep bounded native/release room; optional provider budgets are unchanged.
// Completed-source uniqueness and missing-file recovery keep bounded native/beta headroom.
// Android Local screen suspension and deferred EOF add about 1.2 KB raw;
// retain bounded gzip/native/release identity headroom.
// Progressive missing-file fallback, native scan events and cancellable loading
// add bounded startup control. Node 22.23.3 measures 988660/305866 web
// and 988618/305920 native; complete native 1120808/354248 bytes.
// Retain a small reserve for clean-source identity and release suffixes.
// PC random selection adds 3199 raw / 788 gzip bytes to the largest entry.
// Node 22.23.3 measures 991859/306650 web and 991817/306708 native;
// retain about 700 raw / 600 gzip bytes for release identity variation.
// Same-ID browser folder reconnection and bounded stale directory recovery add
// 2379 raw / 639 gzip entry bytes on Node 22.23.3. Web is 994238/307289;
// native is 994196/307346. Retain ~700 raw / 600 gzip bytes for release identity.
// Bounded cached folder candidates and honest network enumeration progress add
// 1429 raw / 376 gzip bytes. Node 22.23.3 web measures 995667/307664,
// native 995625/307722; retain about 700 raw / 600 gzip release headroom.
// Explicit source-relative file bootstrap and its standard editor add 3431 raw
// / 841 gzip bytes on Node 22.23.3: web 999098/308505, native 999056/308561.
// Keep about 700 raw / 600 gzip bytes of native/release identity headroom.
// Read-only local helper controls add 322 raw bytes; reserve 600 raw bytes
// for the reviewed UI and unchanged release identity allowance.
// TV media category memberships and bounded remote category catalogs add
// about 12.6 KB raw (1012845 total on Node 22). Keep the release suffix reserve.
// Successful-page receipt renewal adds 342 raw bytes; retain candidate
// version and native-transform room after the measured 1013442-byte entry.
// Whole-portal progressive limits, compact metadata and idle diagnostics add
// 1944 raw entry bytes (1015386 on Node 22.23.3); retain candidate headroom.
// Persistent seek feedback/pending decoder targets and bounded metadata
// fallback measure 1016906 raw on Node 22; retain ~600 identity bytes.
// External seek admission/acknowledgment adds ~0.9 KB raw; retain identity room.
// Footer hit testing with the verified beta.999 identity measures 1018418/314088.
// Optional active-player notifications retain bounded parsing, runtime/expiry
// checks and independent failure handling. Same-identity Node 26.8.2 comparison:
// 1018045/312970 -> 1021481/314181 raw/gzip (+3436/+1211). Allocate +3500/+1250
// for this feature, preserving existing native, Node 22 and release headroom.
// Compact HA cards with footer-linked translucency measure 315473 native gzip
// bytes in the reviewed Node 22.23.3 UI preflight, before a candidate suffix.
// Reserve 100 entry gzip bytes for this presentation feature and candidate
// identity variation, including the separately checked beta metadata;
// retain raw and per-provider limits and count this reserve once in the total.
// JPEG notification transport and durable per-install receive policy add about
// 9 KB raw / 2.5 KB gzip on Node 22; reserve +9500/+2700, including native/identity variance.
// Authoritative safe random selection with fenced media catalogs and admission
// checks, measured on Node 22.23.3 with the same beta.999 identity: web
// 1031496/318153 -> 1035867/319454, native 1031454/318212 -> 1035825/319513
// raw/gzip (+4371/+1301). Allocate +4500/+1400, retaining a small release
// identity reserve; existing global interfaces and provider budgets stay fixed.
// On-demand engine readiness, bounded playback feedback and device/source buffer
// policy add less than 6 KB raw / 1.8 KB gzip; engine payloads stay off boot.
// Periodic channel-backed VOD checkpoints measure 321463 native entry gzip
// bytes with Node 22.23.4 and beta.9999. Allow 96 bytes including identity room.
// Opt-in live recovery and feedback handoff add 5758 raw entry bytes over
// v1.1.60 on Node 26.12.1. Reserve +6000/+2100 raw/gzip; retain native/CI room.
// Shared numbered Plex lists and focused Local file arrows: Node 22.23.4
// baseline cd96c047 is 1047147/323332 web bytes/gzip; the candidate is
// 1047713/323722 (native 1047671/323780). Plex presentation and cold restore
// load with its provider. Keep the entry raw limit; allow 500 gzip bytes for
// this measured feature, native transformation and release identity.
// Local source commands, guarded activation and compact seeded playback order
// add 12155 raw / 3332 gzip bytes over 58c52527 on Node 26.8.2, same 1.1.61
// identity. Allocate 12200 / 3400 once, retaining existing native/release room.
// See docs/evidence/local-media-size-20261027.json; provider caps stay fixed.
// Independent folder scans, per-source completion and cancellation fencing add
// 2539 raw / at most 715 gzip bytes on Node 22.23.4 with the same candidate
// identity. Allocate 2560 / 768, retaining previous native/release headroom.
// See docs/evidence/local-source-priority-size-20261027.json. This keeps the
// first Local command independent of an additional lazy asset download.
// Bounded Local HTML5 recovery, including queued input/ownership fences.
// Provisional feature-only allocation from the production optimizer estimate;
// canonical web/native/mobile measurement must confirm it before release.
const LOCAL_STALL_RECOVERY_ALLOWANCE = Object.freeze({
    bytes: 2048,
    gzipBytes: 640,
});
// Session-only Local commands and deliberate, atomic persistence boundaries.
// This provisional feature budget still requires canonical bundle validation.
const LOCAL_COMMAND_SESSION_ALLOWANCE = Object.freeze({
    bytes: 5632,
    gzipBytes: 1792,
});
// First selected-source preview plus one-shot stable saved-item restoration.
// Canonical PR919 artifacts observe +7711 raw / +2409 web, +2412 native gzip.
// Node patch versions differ; this is observed payload cost, not a controlled
// optimizer experiment or device-runtime proof. Count this feature once per
// entry/legacy/base total; providers and optional assets retain their own caps.
// See docs/evidence/local-startup-preview-size-20261027.json.
const LOCAL_STARTUP_PREVIEW_ALLOWANCE = Object.freeze({
    bytes: 8192,
    gzipBytes: 2560,
});
// Unified desktop F favorites: guarded key routing and provider-owned toggles.
// Hosted CI40627949923, fe9078f6 (tested merge4cd97d1c), Node22.23.3/zlib1.3.1-e00f703
// observes +4609 raw / +1027 web, +1026 native gzip versus canonical5a85 bytes.
// Reviewed bounded +4650/+1100; count once per entry/legacy/complete payload.
// Preserve existing release/version room; provider and optional caps stay fixed.
// Reviewed feature allocation; fresh required CI must validate the final source.
// See docs/evidence/desktop-favorites-key-size-20261028.json.
const DESKTOP_FAVORITES_KEY_ALLOWANCE = Object.freeze({
    bytes: 4650,
    gzipBytes: 1100,
});
// Persistent current-Plex favorites: hosted CI40630774289 on bcaf8aef,
// Node22.23.3/zlib1.3.1-e00f703, compared with canonical main5a85 reports.
// Entry +9243 raw / +2312 maximum gzip; Plex provider +447/+134;
// new optional family 85304/23899. Preserve prior release headroom once.
// Reviewed measured feature allocation; see favorites-transfer-size-20261028.json.
const FAVORITES_TRANSFER_ENTRY_ALLOWANCE = Object.freeze({
    bytes: 9300,
    gzipBytes: 2400,
});
const FAVORITES_TRANSFER_PLEX_ALLOWANCE = Object.freeze({
    bytes: 500,
    gzipBytes: 150,
});
const FAVORITES_TRANSFER_OPTIONAL_ALLOWANCE = Object.freeze({
    bytes: 86000,
    gzipBytes: 24400,
});
// Guarded global favorites recovery: exact hosted CI40645896589 / 5f9e1b20.
// Same Node22.23.3/zlib1.3.1-e00f703 combined F+transfer baseline observes
// entry +4746 raw/+1356 maximum gzip and optional +23193/+4823.
// Proposed named feature cost preserves all previous allowances once; no
// generic provider increase. See favorites-recovery-size-20261028.json.
const FAVORITES_RECOVERY_ENTRY_ALLOWANCE = Object.freeze({
    bytes: 4800,
    gzipBytes: 1400,
});
const FAVORITES_RECOVERY_OPTIONAL_ALLOWANCE = Object.freeze({
    bytes: 23300,
    gzipBytes: 4900,
});
// Asynchronous Shaka retirement keeps an unresolved owner barrier and validates
// media/source release before another engine attaches. Paired Node22.23.4 builds
// measure +1145 raw bytes in all three entries and complete payloads, with gzip
// inside existing caps. Round raw cost to1152 (+7); do not increase gzip or
// provider/optional limits. See shaka-retirement-size-20261028.json.
const SHAKA_RETIREMENT_ENTRY_ALLOWANCE = Object.freeze({
    bytes: 1152,
    gzipBytes: 0,
});
// Atomic relative VOD seeking adds 2613 raw / 768 gzip bytes; rejected-seek
// marker rollback adds another 124 raw / 35 gzip on Node22.23.4.
// Count the measured entry cost once in
// each complete total; preserve prior release headroom and all provider/
// optional caps. See docs/evidence/relative-seek-size-20261029.json and
// docs/evidence/relative-seek-rollback-size-20261029.json.
// Explicit archive timeline, guarded source replacement and paused startup.
// Paired Node26.8.2 builds add 2374 raw / at most710 gzip; retain earlier
// headroom and count this cost once in each complete payload. Provider and
// optional assets are unchanged. Evidence: archive-relative-seek-size-20261102.json.
const ARCHIVE_RELATIVE_SEEK_ALLOWANCE = Object.freeze({
    bytes: 2374,
    gzipBytes: 710,
});
const RELATIVE_SEEK_ENTRY_ALLOWANCE = Object.freeze({
    bytes: 2737,
    gzipBytes: 803,
});
// Selected-only Plex queue metadata adds 308 raw / 70 gzip bytes to its lazy
// provider on Node22.23.4. Count it once in the complete payload; entry,
// legacy, provider and optional caps retain their existing limits.
// See docs/evidence/plex-queue-step-size-20261029.json.
const PLEX_QUEUE_STEP_TOTAL_ALLOWANCE = Object.freeze({
    bytes: 308,
    gzipBytes: 70,
});
// Mixed global favorites: measured against the production-equivalent a480
// baseline using Node22.23.4/zlib1.3.1-e00f703. These bounded named allowances
// use exact a822/6234 canonical deltas, preserving pre-feature headroom.
// Count entry/provider/optional cost once in their applicable complete totals.
// Individual provider and unrelated optional limits remain unchanged.
// See docs/evidence/mixed-global-favorites-size-20261028.json.
const MIXED_GLOBAL_FAVORITES_ENTRY_ALLOWANCE = Object.freeze({
    bytes: 34739,
    gzipBytes: 8485,
});
const MIXED_GLOBAL_FAVORITES_OPTIONAL_ALLOWANCE = Object.freeze({
    bytes: 132130,
    gzipBytes: 32892,
});
const MIXED_GLOBAL_FAVORITES_PROVIDER_ALLOWANCE = Object.freeze({
    bytes: 1536,
    gzipBytes: 640,
});
// Same-toolchain Shaka track controls add 550 raw / 91 gzip bytes to the
// entry. Keep its previous headroom; the lazy adapter has its own cap below.
// Evidence: docs/evidence/shaka-track-controls-size-20261029.json.
const SHAKA_TRACKS_ENTRY_ALLOWANCE = Object.freeze({
    bytes: 576,
    gzipBytes: 128,
});
// Negotiated presence and confirmed-media projection: Node22.23.4 observes
// +7707 raw/+2542 gzip over 1d85ec9c before the source commit was embedded.
// Inserting the full b9840aa7 identity in memory gives +7747/+2589 maximum;
// retain 20 gzip bytes for final identity variation, pending clean-source CI.
// Hosted transport adds exactly +27/+10 in its optional asset. Count both
// once in complete totals and preserve all previous headroom and other caps.
// See docs/evidence/player-presence-size-20261029.json.
const PLAYER_PRESENCE_ENTRY_ALLOWANCE = Object.freeze({
    bytes: 7747,
    gzipBytes: 2609,
});
const PLAYER_PRESENCE_TRANSPORT_ALLOWANCE = Object.freeze({
    bytes: 27,
    gzipBytes: 10,
});
// Optional visibility of the two virtual category rows adds 1505 raw / 415 gzip
// bytes in paired Node22.23.4 entry builds. Preserve the previous headroom;
// count this entry-only change once in each aggregate, with no provider or
// optional-asset allowance. Native/final release artifacts still pass all caps.
// Evidence: docs/evidence/category-visibility-size.json.
const CATEGORY_VISIBILITY_ENTRY_ALLOWANCE = Object.freeze({
    bytes: 1505,
    gzipBytes: 415,
});
// EPG dates, offset-consistent labels and optional time/Archive presentation add
// 992 raw / 355 gzip entry bytes in paired Node22.23.4 builds. Preserve headroom;
// count once per aggregate, with provider and optional-asset caps unchanged.
// Evidence: docs/evidence/epg-presentation-size.json.
const EPG_PRESENTATION_ENTRY_ALLOWANCE = Object.freeze({
    bytes: 992,
    gzipBytes: 355,
});
// Persistent category selection and shared Favorites picker writes:
// paired Node22.23.4 builds add 2781 raw / at most 780 gzip entry bytes and
// 209 raw / 65 gzip bytes to the lazy Favorites family. Keep prior headroom
// and add only 20 gzip entry bytes for revision/release identity variation.
// Count each component once in its applicable total; other caps stay fixed.
// Evidence: docs/evidence/category-selection-size-20261029.json.
const CATEGORY_SELECTION_ENTRY_ALLOWANCE = Object.freeze({
    bytes: 2781,
    gzipBytes: 800,
});
const CATEGORY_SELECTION_FAVORITES_ALLOWANCE = Object.freeze({
    bytes: 209,
    gzipBytes: 65,
});
// Escaped category labels and picker data restoration add 45 raw / 8 gzip
// entry bytes in paired full-width source-stamped CI builds. Count the entry
// delta once in each complete total; preserve provider and optional caps.
// Evidence: docs/evidence/category-picker-size-20261029.json.
const CATEGORY_PICKER_ENTRY_ALLOWANCE = Object.freeze({
    bytes: 45,
    gzipBytes: 8,
});
// Paired 1.1.61 / Node22.23.4 builds measure four changed asset families.
// Preserve prior headroom and add only 20 entry gzip bytes for source-identity
// variation. Both measured builds have null sourceRevision; final stamped
// artifacts still require validation. Providers retain their existing cap.
// Evidence: docs/evidence/stb-player-improvements-size-20261029.json.
const STB_PLAYER_ENTRY_ALLOWANCE = Object.freeze({
    bytes: 5356,
    gzipBytes: 1666,
});
const STB_PLAYER_STALKER_ALLOWANCE = Object.freeze({
    bytes: 7803,
    gzipBytes: 2601,
});
const STB_PLAYER_XTREAM_ALLOWANCE = Object.freeze({
    bytes: 48,
    gzipBytes: 8,
});
const STB_PLAYER_FAVORITES_ALLOWANCE = Object.freeze({
    bytes: 2433,
    gzipBytes: 511,
});
// Favorites category navigation and category-membership panel restoration:
// paired clean 1.1.62 / Node22.23.4 builds add 10 raw / 5 gzip entry bytes
// and 603 raw / 214 gzip bytes to the lazy Favorites family. Preserve prior
// headroom and add only 20 entry gzip bytes for source-identity variation.
// Count each component once; other provider and optional caps stay fixed.
// Evidence: docs/evidence/category-navigation-size-20261029.json.
const CATEGORY_NAVIGATION_ENTRY_ALLOWANCE = Object.freeze({
    bytes: 10,
    gzipBytes: 25,
});
const CATEGORY_NAVIGATION_FAVORITES_ALLOWANCE = Object.freeze({
    bytes: 603,
    gzipBytes: 214,
});
// Packaged Tizen startup resolves shared-runtime and provider paths locally
// and skips the local Swop endpoint. Clean, source-stamped 1.1.62 / Node22.23.4
// builds add 116 raw bytes and at most 75 gzip bytes to each entry. Preserve prior headroom and allow only
// 20 additional gzip bytes for source-identity variation. Other caps stay fixed.
// Evidence: docs/evidence/tizen-package-boot-size-20261030.json.
const TIZEN_PACKAGE_BOOT_ALLOWANCE = Object.freeze({
    bytes: 116,
    gzipBytes: 95,
});
// Media companion dispatch/settings remain small at startup; session resolution,
// file selection live in a separately bounded family; its retired UI is deducted below.
// Paired Node22 measurements and explicit source/release reserves are recorded
// in docs/evidence/media-companion-size-20261030.json. Count each allowance once.
const MEDIA_COMPANION_ENTRY_ALLOWANCE = Object.freeze({
    bytes: 2261,
    gzipBytes: 795,
});
const MEDIA_COMPANION_SETTINGS_ALLOWANCE = Object.freeze({
    bytes: 36,
    gzipBytes: 9,
});
const MEDIA_COMPANION_OPTIONAL_ALLOWANCE = Object.freeze({
    bytes: 12260,
    gzipBytes: 4609,
});
// The browser transport capability notice stays in the optional companion family.
// Exact Node22 delta, preserving its previous raw/gzip headroom unchanged.
// Evidence: docs/evidence/media-companion-transport-size-20261030.json.
const MEDIA_COMPANION_TRANSPORT_ALLOWANCE = Object.freeze({
    bytes: 412,
    gzipBytes: 125,
});
// Source preparation has its own bounded deadline before decoder startup.
// Paired Node22 entry delta; provider/optional assets remain byte-identical.
// Evidence: docs/evidence/media-companion-preparation-size-20261030.json.
const MEDIA_COMPANION_PREPARATION_ALLOWANCE = Object.freeze({
    bytes: 445,
    gzipBytes: 124,
});
// Opt-in Modern presentation: measured separately from the existing catalogue.
// Entry contains only settings, loader and repaint hooks; the renderer stays lazy.
// Evidence: docs/evidence/modern-interface-size-20261030.json.
const MODERN_INTERFACE_ENTRY_ALLOWANCE = Object.freeze({
    bytes: 3820,
    gzipBytes: 1250,
});
const MODERN_INTERFACE_OPTIONAL_ALLOWANCE = Object.freeze({
    bytes: 6200,
    gzipBytes: 2650,
});
// Optional Modern playback overlay: responsive bottom panel, action rail and
// shared scrubber presentation. It ships in the same lazy asset as the Modern
// catalogue; Classic entry, providers and legacy totals are unchanged.
// Evidence: docs/evidence/modern-player-size-20261031.json.
const MODERN_PLAYER_OPTIONAL_ALLOWANCE = Object.freeze({
    bytes: 17600,
    gzipBytes: 5100,
});
// Native-style Home/Library shell, artwork and guarded selected-item actions,
// including final focus ownership and finite playback-time presentation fixes.
// Paired e7f18/current optional builds retain the existing raw/gzip headroom.
// Entry, provider and legacy-total limits are unchanged; count this once below.
// Evidence: docs/evidence/modern-native-shell-size-20261102.json.
const MODERN_NATIVE_SHELL_OPTIONAL_ALLOWANCE = Object.freeze({
    bytes: 6607,
    gzipBytes: 1897,
});
// Allocate 193 optional gzip bytes for pointer-safe Modern repaints.
// The final Node 22 delta is 196: three bytes use the prior reserve; totals stay fixed.
// Evidence: docs/evidence/modern-repaint-size-20261103.json.
const MODERN_REPAINT_OPTIONAL_ALLOWANCE = Object.freeze({
    bytes: 0,
    gzipBytes: 193,
});
// Authenticated poster/backdrop getters stay in the lazy Plex provider.
// Count its measured delta only in legacy/complete totals, preserving the
// existing entry, generic per-provider and optional limits.
// Evidence: docs/evidence/plex-artwork-size-20261102.json.
const PLEX_ARTWORK_ALLOWANCE = Object.freeze({ bytes: 185, gzipBytes: 77 });
const MODERN_INTERFACE_RELATED_ALLOWANCES = Object.freeze({
    "favorites-transfer": Object.freeze({ bytes: 64, gzipBytes: 32 }),
    "remote-settings-lifecycle": Object.freeze({ bytes: 700, gzipBytes: 256 }),
    "subtitle-appearance": Object.freeze({ bytes: 96, gzipBytes: 32 }),
});
// Native-only Torrent provider: measured HEAD/source-archive comparison on Node26.
// Catalog/editor is a lazy provider asset; shared entry adds only capability and
// registry plumbing. Retired companion UI savings are deducted once, and the
// existing global Favorites/remote-settings changes are accounted separately.
// Evidence: docs/evidence/torrent-provider-size-20261030.json.
// Catalog RPC deltas preserve existing headroom; parser and engine stay in lazy assets.
// Evidence: docs/evidence/torrent-catalog-rpc-size-20261030.json.
const TORRENT_PROVIDER_ALLOWANCE = Object.freeze({
    catalog: Object.freeze({ bytes: 8426 + 25059, gzipBytes: 3348 + 7960 }),
    companion: Object.freeze({ bytes: -3663 + 286, gzipBytes: -1439 + 81 }),
    entry: Object.freeze({ bytes: 2286 + 2286, gzipBytes: 548 + 538 }),
    favorites: Object.freeze({ bytes: 1194 + 3055, gzipBytes: 270 + 851 }),
    settings: Object.freeze({ bytes: 263, gzipBytes: 102 }),
});
// Localized movie discovery stays in the lazy Torrent asset. Count the measured
// entry hooks and optional settings validation separately, preserving old room.
// Paired Node 26 gzip-9 receipts: docs/evidence/torrent-discovery-size-20261030.json.
const TORRENT_DISCOVERY_ALLOWANCE = Object.freeze({
    catalog: Object.freeze({ bytes: 14256, gzipBytes: 4740 }),
    entry: Object.freeze({ bytes: 1794, gzipBytes: 456 }),
    settings: Object.freeze({ bytes: 493, gzipBytes: 160 }),
});
// Configured stream selection and playback admission are measured against the
// immutable first-stage archive. Add only paired Node 26 gzip-9 deltas; no reserve.
// Evidence: docs/evidence/torrent-streams-size-20261030.json.
const TORRENT_STREAMS_ALLOWANCE = Object.freeze({
    catalog: Object.freeze({ bytes: 31466, gzipBytes: 9168 }),
    companion: Object.freeze({ bytes: 207, gzipBytes: 79 }),
    entry: Object.freeze({ bytes: 6550, gzipBytes: 1741 }),
    settings: Object.freeze({ bytes: 490, gzipBytes: 155 }),
});
// Local Torznab discovery keeps indexer transport and parsing in the native companion.
// Count only measured web/native hooks, portable identities and redacted diagnostics;
// preserve every earlier allowance with no additional reserve.
// Evidence: docs/evidence/torznab-discovery-size-20261030.json.
const TORZNAB_DISCOVERY_ALLOWANCE = Object.freeze({
    catalog: Object.freeze({ bytes: 7503, gzipBytes: 2124 }),
    companion: Object.freeze({ bytes: 1516, gzipBytes: 463 }),
    entry: Object.freeze({ bytes: 4257, gzipBytes: 1089 }),
    favorites: Object.freeze({ bytes: 81, gzipBytes: 30 }),
    settings: Object.freeze({ bytes: 165, gzipBytes: 60 }),
});
// Global Modern navigation/hero and measured option pages remain a lazy renderer.
// The shared entry adds only screen/focus lifecycle hooks; Prowlarr configuration
// stays in the optional Torrent provider. Allocate paired web/native/mobile
// deltas without adding reserve or altering earlier evidence.
// Evidence: docs/evidence/modern-provider-experience-size-20261031.json.
const MODERN_EXPERIENCE_ALLOWANCE = Object.freeze({
    catalog: Object.freeze({ bytes: 4991, gzipBytes: 1336 }),
    entry: Object.freeze({ bytes: 2152, gzipBytes: 636 }),
    renderer: Object.freeze({ bytes: 7161, gzipBytes: 2221 }),
});
// Passive playback-only companion diagnostics and bounded native error notices.
// Count the measured delta against the delivered Modern candidate on each
// platform exactly once; no additional reserve or unrelated provider growth.
// Evidence: docs/evidence/companion-diagnostics-size-20261031.json.
const COMPANION_DIAGNOSTICS_ALLOWANCE = Object.freeze({
    catalog: Object.freeze({ bytes: 114, gzipBytes: 53 }),
    companion: Object.freeze({ bytes: 663, gzipBytes: 192 }),
    entry: Object.freeze({ bytes: 2158, gzipBytes: 737 }),
});
// Separate passive playback information from explicit menu interaction. Count
// measured intent propagation in entry, two providers and two lazy assets once.
// Paired real-version Node 26 builds preserve all previous headroom; no reserve
// or generic provider-cap increase. VPortal and other assets remain unchanged.
// Evidence: docs/evidence/modern-info-interaction-size-20261101.json.
const MODERN_INFO_INTERACTION_ALLOWANCE = Object.freeze({
    edem: Object.freeze({ bytes: 78, gzipBytes: 39 }),
    entry: Object.freeze({ bytes: 1424, gzipBytes: 356 }),
    favorites: Object.freeze({ bytes: 424, gzipBytes: 165 }),
    plex: Object.freeze({ bytes: 291, gzipBytes: 111 }),
    renderer: Object.freeze({ bytes: 769, gzipBytes: 206 }),
});
// Installation-wide Favorites category persistence: paired clean 1.1.62
// builds add 2823 raw / at most 809 gzip entry bytes and 283 / 49 to
// the optional Favorites family, including rejected-save and unmounted-view
// guards. Preserve prior source/release headroom and count each part once.
// Evidence: favorites-category-persistence-size-20261102.json.
const FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE = Object.freeze({
    entry: Object.freeze({ bytes: 2848, gzipBytes: 832 }),
    favorites: Object.freeze({ bytes: 288, gzipBytes: 64 }),
});
// Exact source-archive comparison after lossless path/proof deduplication:
// entry +999/+480 gzip; optional Favorites +7324/+1944. Retain the prior
// source-identity, native-transform and release-suffix headroom. Count the
// entry in legacy payloads and both parts once in complete payloads.
// Evidence: docs/evidence/local-favorites-path-size-20261102.json.
const LOCAL_FAVORITES_PATH_ALLOWANCE = Object.freeze({
    entry: Object.freeze({ bytes: 1024, gzipBytes: 512 }),
    favorites: Object.freeze({ bytes: 7424, gzipBytes: 2048 }),
});
// Local Favorite write recovery keeps the entry, exact-path proof and rollback
// under one existing lock. Count only measured entry and optional-family growth;
// preserve prior headroom and the immutable earlier feature evidence.
// Evidence: docs/evidence/local-favorite-write-recovery-size-20261102.json.
const LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE = Object.freeze({
    entry: Object.freeze({ bytes: 32, gzipBytes: 16 }),
    favorites: Object.freeze({ bytes: 864, gzipBytes: 288 }),
});
// Shared desktop Full screen / Always on top controls add 3141 raw bytes
// and at most 929 gzip bytes on Node 22.23.4 / zlib 1.3.1-e00f703.
// Count this entry-only cost once in each payload, preserving prior headroom.
// Evidence: docs/evidence/native-window-controls-size-20261103.json.
const NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE = Object.freeze({
    bytes: 3141,
    gzipBytes: 929,
});
// One-file desktop drop keeps gesture handling out of shared startup. The
// shared temporary-session and OS-startup hooks add 3987 raw / 1078 gzip bytes
// on Node 26.8.2. The optional desktop bundle measures 5356 / 2109 bytes.
// Evidence: docs/evidence/desktop-video-drop-size.json. Preserve bounded
// compiler/compressor variation; no provider allowance is changed.
const DESKTOP_DROP_ALLOWANCE = Object.freeze({
    entry: Object.freeze({ bytes: 4000, gzipBytes: 1200 }),
    optional: Object.freeze({ bytes: 5400, gzipBytes: 2200 }),
});
// Ordered desktop queues add 407 raw / 169 gzip bytes to the optional drop
// asset on the same Node 22 toolchain, preserving its measured 44 / 96 reserve.
// Entry and whole-payload deltas are not isolated across the two version
// envelopes. Allocate only this optional component, once per complete player.
// Evidence: docs/evidence/desktop-video-queue-size-20261105.json.
const DESKTOP_VIDEO_QUEUE_ALLOWANCE = Object.freeze({
    bytes: 407,
    gzipBytes: 169,
});
// Bounded recovery after relay failure adds 425 raw and at most 259 gzip bytes.
// Existing raw caps cover the change. Count the measured gzip cost once per
// entry and aggregate; preserve identity headroom and unrelated asset caps.
// Evidence: docs/evidence/auto-relay-stall-recovery-size-20261105.json.
const AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE = Object.freeze({
    bytes: 0,
    gzipBytes: 259,
});
// Net presentation, recovery and Menu-to-Interface changes from 5901487 to
// 6b06f42 add 2281 raw / at most 1049 gzip bytes to each entry, and 195 / 74
// to the existing appearance chunk. Preserve the prior headroom with no
// additional reserve; aggregate entry and appearance exactly once.
// Evidence: docs/evidence/classic-presentation-settings-size-20261105.json.
const CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE = Object.freeze({
    appearance: Object.freeze({ bytes: 195, gzipBytes: 74 }),
    entry: Object.freeze({ bytes: 2281, gzipBytes: 1049 }),
});
// Observed RC1-base b158b94 -> final PR1070 head0d4f69b (mergea9824d1) net cost,
// including color-picker Enter/focus and live folder-handle cache fixes.
// Node22.23.4/zlib1.3.1 match; differing build identities preclude an isolated
// feature measurement. Maximum per target: entry +3389/+1144 raw/gzip and
// appearance +301/+197. Count each once, preserving prior headroom with no
// extra reserve. The initial head55bf1f2 measurement omitted the final fixes.
// Evidence: docs/evidence/interface-notification-settings-size-20261106.json.
const INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE = Object.freeze({
    appearance: Object.freeze({ bytes: 301, gzipBytes: 197 }),
    entry: Object.freeze({ bytes: 3389, gzipBytes: 1144 }),
});
// Same-HEAD hosted Node22.23.4/zlib1.3.1 color feature cost, max per target.
// Count each emitted family once; Edem still fits its unchanged provider cap.
// The original comparator counted an extra offline worker and failed; preserved
// inventories support these deltas without relabeling that run a release pass.
// Evidence: docs/evidence/client-interface-colors-size-20261106/.
const CLIENT_INTERFACE_COLORS_ALLOWANCE = Object.freeze({
    appearance: Object.freeze({
        bytes: 529,
        gzipBytes: 215,
    }),
    entry: Object.freeze({
        bytes: 8796,
        gzipBytes: 2501,
    }),
    optional: Object.freeze({
        bytes: 10444,
        gzipBytes: 4378,
    }),
    providerEdem: Object.freeze({
        bytes: 44,
        gzipBytes: 18,
    }),
    remoteSettingsLifecycle: Object.freeze({
        bytes: 334,
        gzipBytes: 145,
    }),
});
// The nonce-safe font preview used existing asset headroom first. Ordinary CI
// still exceeded this asset's ceiling by 35 raw / 86 gzip bytes. Cover only that
// remaining shortfall; entry, provider, complete and historical color budgets
// stay unchanged. This is not an isolated feature-cost measurement.
// Evidence: docs/evidence/interface-font-csp-budget-20261106/.
const INTERFACE_FONT_CSP_ASSET_CORRECTION = Object.freeze({
    bytes: 35,
    gzipBytes: 86,
});
const BUDGET = Object.freeze({
    bytes:
        CLIENT_INTERFACE_COLORS_ALLOWANCE.entry.bytes +
        INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE.entry.bytes +
        CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE.entry.bytes +
        DESKTOP_DROP_ALLOWANCE.entry.bytes +
        NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE.bytes +
        FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE.entry.bytes +
        LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE.entry.bytes +
        LOCAL_FAVORITES_PATH_ALLOWANCE.entry.bytes +
        MODERN_INFO_INTERACTION_ALLOWANCE.entry.bytes +
        COMPANION_DIAGNOSTICS_ALLOWANCE.entry.bytes +
        MODERN_EXPERIENCE_ALLOWANCE.entry.bytes +
        TORZNAB_DISCOVERY_ALLOWANCE.entry.bytes +
        TORRENT_STREAMS_ALLOWANCE.entry.bytes +
        TORRENT_DISCOVERY_ALLOWANCE.entry.bytes +
        TORRENT_PROVIDER_ALLOWANCE.entry.bytes +
        MEDIA_COMPANION_ENTRY_ALLOWANCE.bytes +
        MEDIA_COMPANION_PREPARATION_ALLOWANCE.bytes +
        MODERN_INTERFACE_ENTRY_ALLOWANCE.bytes +
        TIZEN_PACKAGE_BOOT_ALLOWANCE.bytes +
        CATEGORY_NAVIGATION_ENTRY_ALLOWANCE.bytes +
        STB_PLAYER_ENTRY_ALLOWANCE.bytes +
        CATEGORY_PICKER_ENTRY_ALLOWANCE.bytes +
        CATEGORY_SELECTION_ENTRY_ALLOWANCE.bytes +
        CATEGORY_VISIBILITY_ENTRY_ALLOWANCE.bytes +
        EPG_PRESENTATION_ENTRY_ALLOWANCE.bytes +
        MIXED_GLOBAL_FAVORITES_ENTRY_ALLOWANCE.bytes +
        1062760 +
        LOCAL_STALL_RECOVERY_ALLOWANCE.bytes +
        LOCAL_COMMAND_SESSION_ALLOWANCE.bytes +
        LOCAL_STARTUP_PREVIEW_ALLOWANCE.bytes +
        FAVORITES_TRANSFER_ENTRY_ALLOWANCE.bytes +
        DESKTOP_FAVORITES_KEY_ALLOWANCE.bytes +
        FAVORITES_RECOVERY_ENTRY_ALLOWANCE.bytes +
        SHAKA_RETIREMENT_ENTRY_ALLOWANCE.bytes +
        SHAKA_TRACKS_ENTRY_ALLOWANCE.bytes +
        ARCHIVE_RELATIVE_SEEK_ALLOWANCE.bytes +
        RELATIVE_SEEK_ENTRY_ALLOWANCE.bytes +
        PLAYER_PRESENCE_ENTRY_ALLOWANCE.bytes,
    gzipBytes:
        CLIENT_INTERFACE_COLORS_ALLOWANCE.entry.gzipBytes +
        INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE.entry.gzipBytes +
        CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE.entry.gzipBytes +
        DESKTOP_DROP_ALLOWANCE.entry.gzipBytes +
        AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE.gzipBytes +
        NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE.gzipBytes +
        FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE.entry.gzipBytes +
        LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE.entry.gzipBytes +
        LOCAL_FAVORITES_PATH_ALLOWANCE.entry.gzipBytes +
        MODERN_INFO_INTERACTION_ALLOWANCE.entry.gzipBytes +
        COMPANION_DIAGNOSTICS_ALLOWANCE.entry.gzipBytes +
        MODERN_EXPERIENCE_ALLOWANCE.entry.gzipBytes +
        TORZNAB_DISCOVERY_ALLOWANCE.entry.gzipBytes +
        TORRENT_STREAMS_ALLOWANCE.entry.gzipBytes +
        TORRENT_DISCOVERY_ALLOWANCE.entry.gzipBytes +
        TORRENT_PROVIDER_ALLOWANCE.entry.gzipBytes +
        MEDIA_COMPANION_ENTRY_ALLOWANCE.gzipBytes +
        MEDIA_COMPANION_PREPARATION_ALLOWANCE.gzipBytes +
        MODERN_INTERFACE_ENTRY_ALLOWANCE.gzipBytes +
        TIZEN_PACKAGE_BOOT_ALLOWANCE.gzipBytes +
        CATEGORY_NAVIGATION_ENTRY_ALLOWANCE.gzipBytes +
        STB_PLAYER_ENTRY_ALLOWANCE.gzipBytes +
        CATEGORY_PICKER_ENTRY_ALLOWANCE.gzipBytes +
        CATEGORY_SELECTION_ENTRY_ALLOWANCE.gzipBytes +
        CATEGORY_VISIBILITY_ENTRY_ALLOWANCE.gzipBytes +
        EPG_PRESENTATION_ENTRY_ALLOWANCE.gzipBytes +
        MIXED_GLOBAL_FAVORITES_ENTRY_ALLOWANCE.gzipBytes +
        328314 +
        LOCAL_STALL_RECOVERY_ALLOWANCE.gzipBytes +
        LOCAL_COMMAND_SESSION_ALLOWANCE.gzipBytes +
        LOCAL_STARTUP_PREVIEW_ALLOWANCE.gzipBytes +
        FAVORITES_TRANSFER_ENTRY_ALLOWANCE.gzipBytes +
        DESKTOP_FAVORITES_KEY_ALLOWANCE.gzipBytes +
        FAVORITES_RECOVERY_ENTRY_ALLOWANCE.gzipBytes +
        SHAKA_TRACKS_ENTRY_ALLOWANCE.gzipBytes +
        ARCHIVE_RELATIVE_SEEK_ALLOWANCE.gzipBytes +
        RELATIVE_SEEK_ENTRY_ALLOWANCE.gzipBytes +
        PLAYER_PRESENCE_ENTRY_ALLOWANCE.gzipBytes,
});
// The SJCL repair changes only the entry; retain the previous per-provider caps.
const PROVIDER_BUDGET = Object.freeze({ bytes: 863400, gzipBytes: 268490 });
// Count every optional family as well, so moving code out of the entry bundle
// cannot disguise growth of the complete player payload.
// Classic MAG support adds ~5 KB to the optional Stalker family and a small
// cancellable URL resolver to the shared backend (including release suffix room).
// The combined localization and PC2 changes need 85 more raw bytes; retain
// release suffix room without increasing the complete compressed budget.
// Stalker recovery and settings re-entry measure 192100 gzip bytes in native
// outputs on CI Node 22.23.2 (192106 with a beta version). Keep suffix headroom.
// VOD-owned native metadata and the late-guide guard measure 192222 on Node 22.
// Include the VPortal automatic-quality resolver as part of episode looping.
// The same candidate plus every provider totals 667727 / 206833 for web;
// native variants total 667685 / 206887. All complete payloads remain bounded.
// The same bounded diagnostics addition needs 100 raw complete-payload bytes.
// The same candidate with every provider measures 671260 / 208569 for web
// and 671218 / 208623 for native outputs; retain bounded suffix headroom.
// The gesture candidate totals 673493 raw / 208815 gzip before version suffixes.
// Including the Edem queue bridge, the VPortal candidate totals 681416 raw /
// 211638 gzip (native 681374 / 211697); all provider families remain counted.
// The metadata RPCs add the same measured cost to the complete payload.
// The same profile/restart candidate totals 691509 / 215210 for web and
// 691467 / 215268 for native; all five provider assets remain byte-identical.
// The combined inline-video/tap build totals 691595 / 215248 for web and
// 691553 / 215308 for native, still retaining bounded release suffix room.
// The same combined source plus every provider totals 692751 / 215670 for web
// and 692709 / 215730 for native on Node 22.23.2. Provider assets are unchanged;
// retain the complete-payload guard and release-version headroom.
// Include direct Plex catalogs, PIN sign-in, roaming connections and session cleanup.
// Include bounded, independently cancellable Plex folder collection and title
// fallbacks in the complete payload: web 733963 / 229802 gzip, native
// 733921 / 229862, retaining comparable complete-payload headroom.
// Include complete Plex folder records: 737347 / 230655 web
// and 737305 / 230719 native, with the same bounded release headroom.
// Include independent Plex/VPortal page transports and stable cursor IDs:
// the complete web payload is 742619 raw / 232209 gzip on Node 26.8.2.
// The same control-state change adds 3281 raw / 1012 gzip bytes; provider payloads
// remain unchanged and count toward this complete-output bound.
// Fifteen Stalker profiles, legacy migration and owned switching live in the
// optional provider asset. Combined with the control-state change, Node 22.23.2
// measures 748121 / 234576 for web and 748079 / 234635 for native. Keep the
// entry budget unchanged and allow release suffix room for both feature costs.
// The same archive RPCs leave provider assets unchanged: the complete web
// payload measures 750586 raw / 234697 gzip on Node 26.8.2.
// The HLS predicate, Stalker preset handler and missing-category localization
// change only the entry. Before Plex, Node 22.23.3 complete outputs measure
// 752930 / 235840 web and 752888 / 235901 native, including unchanged providers.
// Plex loading, retry and queue navigation add 1970 raw complete-payload bytes.
// Combined Node 22.23.3 output is 754900 / 236452 web and 754858 / 236512 native;
// retain bounded release-suffix headroom while counting every provider.
// The same diagnostic implementation is counted once; providers are unchanged.
// Kiosk changes only the entry; count the same measured cost in total payloads.
// Count localization logic, optional-provider provenance and adjacent-channel
// admission together with all six provider bundles. Node 22.23.3 combined
// totals are web 819932/256711 and native 819890/256774. Provider assets are
// unchanged by adjacent-channel admission; add its reviewed 3300 raw/950 gzip
// increment to the localization complete-payload cap.
// Include the optional VPortal family and VOD kiosk entry logic, plus the
// 450 raw / 200 gzip allowance for signed channel offsets from main.
// Include the same 2100 raw / 700 gzip frame-loss recovery allowance once.
// Include the same screenshot feature once in the complete payload bound.
// Including all provider assets, explicit queues measure 862700/271732 web
// and 862658/271794 native. The prior caps were 855550/269000: measured excess
// is 7150 raw / 2794 gzip bytes. Add 7650 / 3100, retaining at least 500 / 306
// bytes for native and release-version variation rather than hiding lazy code.
// Apply the same decoder-state increment once; provider assets are unchanged.
// The same localized build plus all seven provider families is 888391 / 283217
// web and 888349 / 283289 native. Only Stalker's locale adds provider bytes
// (+24 raw / +7 gzip). The unchanged complete-payload cap leaves at least
// 2009 raw / 411 gzip bytes at 1.1.53, counting every provider and table.
// Common source 6f497732 totals 851132 / 267962, below its 855550 / 269000
// cap. Latest main totals 888540 / 283261; the combined player totals 901237 /
// 287304, including every optional provider. Add the measured 12697 / 4043
// cost, rounded to 12700 / 4100, to main's 890400 / 283700 cap. This preserves
// main's reserve without counting the common branch reserve twice.
// The workbench entry increment is counted once in the complete payload too.
// The Plex error handoff adds 14 more gzip bytes in its optional provider.
// Include the same 400-byte compressed allowance in the complete player;
// its raw payload remains within the existing cap.
// Native Node 22 output with kiosk recovery measures 293871 gzip bytes.
// Include the Android menu alias and retain candidate-version headroom.
// The same aspect increment is counted here; all seven provider assets are
// unchanged. Complete web measures 923327 / 294108; native 923285 / 294176.
// The integrated Android/aspect build is 926823 / 295139 web and
// 926781 / 295207 native on Node 22.23.3, including the durable kiosk guard.
// Count the same kiosk frame-progress increment once; providers are unchanged.
// The same runtime feature costs 8327 raw / 2573 gzip in the complete payload;
// provider assets are unchanged and all remain included in this size gate.
// Exact movie selection measures 940789 raw web / 940829 native bytes in CI.
// Add 250 raw bytes for this bounded selector and release identity variation;
// retain the compressed and entry limits and count every optional provider.
// Count the same 1640-byte screen suspension addition once in the full payload.
// Count named-library resolution and pagination in all seven provider assets.
// At the same 1.1.54 version/toolchain, base ef31f556 totals 942519 / 300181
// web and 942477 / 300249 native; candidate 23e3fa5c totals 946507 / 301500
// web and 946465 / 301566 native. Allocate +4000 raw / +1350 gzip for the
// measured +3988 / +1319 feature cost, retaining the prior reserve once.
// The 1.1.54-beta.1 totals are 946528 / 301518 web, 946486 / 301586 native.
// Count the favorites entry change and Plex source-binding helper together:
// Node 22.23.3 measures 961572 raw / 305427 gzip including all seven providers.
// Retain bounded native and release suffix room; no optional code is excluded.
// Count the standby entry changes and optional Plex admission guard together.
// Node 22.23.3 totals 962749 / 305746 web and 962707 / 305814 native:
// +1177 raw / +319 gzip over the prior complete web payload. Allocate +1200 / +350.
// Include the shared skip wait, buffered HLS resume and optional Plex retries:
// +1670 raw / at most 488 gzip bytes over fbc80031, measured with all seven
// providers on Node 26.8.2. Allocate +1700 / +500 to preserve the prior reserve.
// All eight provider families remain counted, including lazy Xtream:
// 964459/305344 -> 995587/315103 web; 995545/315154 native.
// The same build, counting all eight optional providers, is 1000388 / 316600.
// Keep every provider inside the bound; no runtime code is excluded or deferred.
// Count the same transport-suspension code once in the complete payload.
// CI Node 22 measures 306569 gzip bytes; retain 81 bytes for release identity.
// Count the same 64-byte source-metadata allowance once in the full payload.
// All seven providers remain included and contribute 43074 gzip bytes.
// Count the same 900 / 256 engine-diagnostic allowance once; providers do not change.
// Count the same 12600/4250 PIN migration allowance once in the total, plus
// the measured startup protection cost of 500 raw / 192 gzip bytes.
// Count the same +256 raw/+128 gzip word-copy repair once; all seven
// provider outputs and every artifact remain in the complete-payload checks.
// Combine both reviewed deltas over the common 964900 / 306550 baseline.
// Count the same +1867/+564 debug-v3 feature cost once; all eight provider
// bundles are unchanged and remain inside the complete-payload measurement.
// Count the same 512-byte loading-spinner allowance once in the full payload.
// Include the same 256-byte desktop input allowance once.
// Count the 512-byte local startup allowance once; gzip limits stay fixed.
// Include the same progressive-catalog allowance once in the full payload.
// Count the 512-byte readiness/counter allowance once in the payload.
// Include the same 256-byte initial progress allowance once.
// Count the same shuffle and profile deltas once across shipped artifacts.
// Count the restored recovery/ownership boundary once across all artifacts.
// Count the channel-playlist entry and both optional provider scanners once.
// The complete payload adds 23671 raw / at most 6957 gzip bytes over 4f9aea8a;
// allocate 23700/7000, preserving the existing complete-payload headroom.
// Count PR820's 768-byte local resume/journal allowance once in the payload.
// Count the same standby allowance once across the complete payload.
// Count the same Local EOF/footer allowance once; providers are unchanged.
// Count the same collection/programme feature once in the full payload.
// Stable-group completion/history adds 536 raw / 184 gzip to the full player
// (1107534 / 349398 on Node 26.8.2). The existing entry and gzip caps fit;
// retain 256 raw aggregate bytes for the frozen beta suffix and native variants.
// Node 22 beta output totals 350370 gzip bytes for native builds; the observed
// CI entry variation leaves only 47 bytes. Retain 128 bytes of aggregate margin.
// Integrated Node 22 native output is 350730 gzip bytes; retain suffix room.
// Count the same local-folder policy and EOF/footer routing once in the total.
// Node 22 measures 1115298/352559 web and 1115256/352616 native.
// The same PC shortcut is counted once across all shipped artifacts.
// Node 22.23.3 totals 1124049/354978 web and 1124007/355036 native.
// Count that same reviewed reconnect cost once in the complete payload:
// Node 22.23.3 web 1126428/355617; native 1126386/355674.
// Include the same bounded-candidate and progress cost once: Node 22.23.3
// web 1127857/355992; native 1127815/356050, with unchanged provider bytes.
// Count explicit relative-file bootstrap once: web 1131288/356833,
// native 1131246/356889 on Node 22.23.3; optional provider bytes are unchanged.
// Compact whole-Plex metadata, flat music ancestry, Unicode-safe labels and
// VPortal wire-compatible titles add 1762 raw bytes to the reviewed catalog
// build. Node 22.23.3 measures 1147384 / 361587 gzip for the complete web
// payload; preserve bounded native and release-suffix headroom.
// Exact PMS navigation accounting, C1 cleanup and successful-page renewal
// measure 1148243 / 361821 gzip on Node 22.23.3. Retain bounded release room.
// Count the bounded whole-portal scanner once in the complete payload.
// The same seek/fallback changes measure 1151707 total raw on Node 22.
// External-seek hooks measure 363232 gzip on clean Node 22 builds.
// The same beta identity measures 1153219 raw bytes including provider bundles.
// Count the measured notifications entry increment once; provider limits stay fixed.
// The same reviewed Node 22.23.3 UI preflight totals 364883 gzip bytes,
// before a candidate suffix. Count the 100-byte entry reserve
// once here; all provider assets remain included and their own caps stay fixed.
// Count the same notification entry growth once; provider limits are unchanged.
// Count the same +4500/+1400 safe-random entry allocation once; providers unchanged.
// On-demand subtitle appearance and interface settings: separately bounded,
// counted in every complete payload, never paid by the default startup entry.
// Direct ES5 optimization measures 6880 raw / 2881 gzip on Node 26; retain
// bounded engine/identity and Node 22 compression headroom without growing entry.
// Count the same 96-byte VOD allowance once: Node 22.23.4 beta.9999 native
// legacy total measures 370893 gzip bytes; provider and optional caps stay fixed.
const LEGACY_TOTAL_BUDGET = Object.freeze({
    // Preserve the independent Plex (+8000/+3000) and Local (+12200/+3400)
    // allocations exactly once, plus independent folder scans (+2560/+768).
    bytes:
        CLIENT_INTERFACE_COLORS_ALLOWANCE.entry.bytes +
        CLIENT_INTERFACE_COLORS_ALLOWANCE.providerEdem.bytes +
        INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE.entry.bytes +
        CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE.entry.bytes +
        DESKTOP_DROP_ALLOWANCE.entry.bytes +
        NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE.bytes +
        FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE.entry.bytes +
        LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE.entry.bytes +
        LOCAL_FAVORITES_PATH_ALLOWANCE.entry.bytes +
        PLEX_ARTWORK_ALLOWANCE.bytes +
        MODERN_INFO_INTERACTION_ALLOWANCE.entry.bytes +
        MODERN_INFO_INTERACTION_ALLOWANCE.edem.bytes +
        MODERN_INFO_INTERACTION_ALLOWANCE.plex.bytes +
        COMPANION_DIAGNOSTICS_ALLOWANCE.entry.bytes +
        COMPANION_DIAGNOSTICS_ALLOWANCE.catalog.bytes +
        MODERN_EXPERIENCE_ALLOWANCE.entry.bytes +
        MODERN_EXPERIENCE_ALLOWANCE.catalog.bytes +
        TORZNAB_DISCOVERY_ALLOWANCE.entry.bytes +
        TORRENT_STREAMS_ALLOWANCE.entry.bytes +
        TORZNAB_DISCOVERY_ALLOWANCE.catalog.bytes +
        TORRENT_STREAMS_ALLOWANCE.catalog.bytes +
        TORRENT_DISCOVERY_ALLOWANCE.entry.bytes +
        TORRENT_DISCOVERY_ALLOWANCE.catalog.bytes +
        TORRENT_PROVIDER_ALLOWANCE.entry.bytes +
        TORRENT_PROVIDER_ALLOWANCE.catalog.bytes +
        MEDIA_COMPANION_ENTRY_ALLOWANCE.bytes +
        MEDIA_COMPANION_PREPARATION_ALLOWANCE.bytes +
        MODERN_INTERFACE_ENTRY_ALLOWANCE.bytes +
        TIZEN_PACKAGE_BOOT_ALLOWANCE.bytes +
        CATEGORY_NAVIGATION_ENTRY_ALLOWANCE.bytes +
        STB_PLAYER_ENTRY_ALLOWANCE.bytes +
        STB_PLAYER_STALKER_ALLOWANCE.bytes +
        STB_PLAYER_XTREAM_ALLOWANCE.bytes +
        CATEGORY_PICKER_ENTRY_ALLOWANCE.bytes +
        CATEGORY_SELECTION_ENTRY_ALLOWANCE.bytes +
        CATEGORY_VISIBILITY_ENTRY_ALLOWANCE.bytes +
        EPG_PRESENTATION_ENTRY_ALLOWANCE.bytes +
        MIXED_GLOBAL_FAVORITES_ENTRY_ALLOWANCE.bytes +
        MIXED_GLOBAL_FAVORITES_PROVIDER_ALLOWANCE.bytes +
        1205560 +
        LOCAL_STALL_RECOVERY_ALLOWANCE.bytes +
        LOCAL_COMMAND_SESSION_ALLOWANCE.bytes +
        LOCAL_STARTUP_PREVIEW_ALLOWANCE.bytes +
        FAVORITES_TRANSFER_ENTRY_ALLOWANCE.bytes +
        FAVORITES_TRANSFER_PLEX_ALLOWANCE.bytes +
        DESKTOP_FAVORITES_KEY_ALLOWANCE.bytes +
        FAVORITES_RECOVERY_ENTRY_ALLOWANCE.bytes +
        SHAKA_RETIREMENT_ENTRY_ALLOWANCE.bytes +
        SHAKA_TRACKS_ENTRY_ALLOWANCE.bytes +
        ARCHIVE_RELATIVE_SEEK_ALLOWANCE.bytes +
        RELATIVE_SEEK_ENTRY_ALLOWANCE.bytes +
        PLAYER_PRESENCE_ENTRY_ALLOWANCE.bytes,
    gzipBytes:
        CLIENT_INTERFACE_COLORS_ALLOWANCE.entry.gzipBytes +
        CLIENT_INTERFACE_COLORS_ALLOWANCE.providerEdem.gzipBytes +
        INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE.entry.gzipBytes +
        CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE.entry.gzipBytes +
        DESKTOP_DROP_ALLOWANCE.entry.gzipBytes +
        AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE.gzipBytes +
        NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE.gzipBytes +
        FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE.entry.gzipBytes +
        LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE.entry.gzipBytes +
        LOCAL_FAVORITES_PATH_ALLOWANCE.entry.gzipBytes +
        PLEX_ARTWORK_ALLOWANCE.gzipBytes +
        MODERN_INFO_INTERACTION_ALLOWANCE.entry.gzipBytes +
        MODERN_INFO_INTERACTION_ALLOWANCE.edem.gzipBytes +
        MODERN_INFO_INTERACTION_ALLOWANCE.plex.gzipBytes +
        COMPANION_DIAGNOSTICS_ALLOWANCE.entry.gzipBytes +
        COMPANION_DIAGNOSTICS_ALLOWANCE.catalog.gzipBytes +
        MODERN_EXPERIENCE_ALLOWANCE.entry.gzipBytes +
        MODERN_EXPERIENCE_ALLOWANCE.catalog.gzipBytes +
        TORZNAB_DISCOVERY_ALLOWANCE.entry.gzipBytes +
        TORRENT_STREAMS_ALLOWANCE.entry.gzipBytes +
        TORZNAB_DISCOVERY_ALLOWANCE.catalog.gzipBytes +
        TORRENT_STREAMS_ALLOWANCE.catalog.gzipBytes +
        TORRENT_DISCOVERY_ALLOWANCE.entry.gzipBytes +
        TORRENT_DISCOVERY_ALLOWANCE.catalog.gzipBytes +
        TORRENT_PROVIDER_ALLOWANCE.entry.gzipBytes +
        TORRENT_PROVIDER_ALLOWANCE.catalog.gzipBytes +
        MEDIA_COMPANION_ENTRY_ALLOWANCE.gzipBytes +
        MEDIA_COMPANION_PREPARATION_ALLOWANCE.gzipBytes +
        MODERN_INTERFACE_ENTRY_ALLOWANCE.gzipBytes +
        TIZEN_PACKAGE_BOOT_ALLOWANCE.gzipBytes +
        CATEGORY_NAVIGATION_ENTRY_ALLOWANCE.gzipBytes +
        STB_PLAYER_ENTRY_ALLOWANCE.gzipBytes +
        STB_PLAYER_STALKER_ALLOWANCE.gzipBytes +
        STB_PLAYER_XTREAM_ALLOWANCE.gzipBytes +
        CATEGORY_PICKER_ENTRY_ALLOWANCE.gzipBytes +
        CATEGORY_SELECTION_ENTRY_ALLOWANCE.gzipBytes +
        CATEGORY_VISIBILITY_ENTRY_ALLOWANCE.gzipBytes +
        EPG_PRESENTATION_ENTRY_ALLOWANCE.gzipBytes +
        MIXED_GLOBAL_FAVORITES_ENTRY_ALLOWANCE.gzipBytes +
        MIXED_GLOBAL_FAVORITES_PROVIDER_ALLOWANCE.gzipBytes +
        380214 +
        LOCAL_STALL_RECOVERY_ALLOWANCE.gzipBytes +
        LOCAL_COMMAND_SESSION_ALLOWANCE.gzipBytes +
        LOCAL_STARTUP_PREVIEW_ALLOWANCE.gzipBytes +
        FAVORITES_TRANSFER_ENTRY_ALLOWANCE.gzipBytes +
        FAVORITES_TRANSFER_PLEX_ALLOWANCE.gzipBytes +
        DESKTOP_FAVORITES_KEY_ALLOWANCE.gzipBytes +
        FAVORITES_RECOVERY_ENTRY_ALLOWANCE.gzipBytes +
        SHAKA_TRACKS_ENTRY_ALLOWANCE.gzipBytes +
        ARCHIVE_RELATIVE_SEEK_ALLOWANCE.gzipBytes +
        RELATIVE_SEEK_ENTRY_ALLOWANCE.gzipBytes +
        PLAYER_PRESENCE_ENTRY_ALLOWANCE.gzipBytes,
});
const OPTIONAL_BUDGET = Object.freeze({ bytes: 7800, gzipBytes: 3300 });
// Optional hosted transport and remote settings retain independent feature caps.
// Their union does not change the legacy entry/provider or subtitle limits.
// Passive Local identity observation travels with the existing Local feature.
// Controlled Node 22.23.4 ON/OFF measurements are recorded in
// docs/evidence/local-source-diagnostics-size-20261103.json. Startup and legacy
// budgets stay unchanged; only the complete feature payload is allocated.
const LOCAL_SOURCE_DIAGNOSTICS_ALLOWANCE = Object.freeze({
    bytes: 5800,
    gzipBytes: 1724,
    optional: Object.freeze({ bytes: 9450, gzipBytes: 3550 }),
});
const OPTIONAL_BUDGETS = Object.freeze({
    "color-appearance": CLIENT_INTERFACE_COLORS_ALLOWANCE.optional,
    "control-transport": Object.freeze({
        bytes: 6000 + PLAYER_PRESENCE_TRANSPORT_ALLOWANCE.bytes,
        gzipBytes: 2000 + PLAYER_PRESENCE_TRANSPORT_ALLOWANCE.gzipBytes,
    }),
    "favorites-transfer": Object.freeze({
        bytes:
            FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE.favorites.bytes +
            LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE.favorites.bytes +
            LOCAL_FAVORITES_PATH_ALLOWANCE.favorites.bytes +
            MODERN_INFO_INTERACTION_ALLOWANCE.favorites.bytes +
            TORZNAB_DISCOVERY_ALLOWANCE.favorites.bytes +
            TORRENT_PROVIDER_ALLOWANCE.favorites.bytes +
            MODERN_INTERFACE_RELATED_ALLOWANCES["favorites-transfer"].bytes +
            CATEGORY_NAVIGATION_FAVORITES_ALLOWANCE.bytes +
            STB_PLAYER_FAVORITES_ALLOWANCE.bytes +
            CATEGORY_SELECTION_FAVORITES_ALLOWANCE.bytes +
            FAVORITES_TRANSFER_OPTIONAL_ALLOWANCE.bytes +
            FAVORITES_RECOVERY_OPTIONAL_ALLOWANCE.bytes +
            MIXED_GLOBAL_FAVORITES_OPTIONAL_ALLOWANCE.bytes,
        gzipBytes:
            FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE.favorites.gzipBytes +
            LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE.favorites.gzipBytes +
            LOCAL_FAVORITES_PATH_ALLOWANCE.favorites.gzipBytes +
            MODERN_INFO_INTERACTION_ALLOWANCE.favorites.gzipBytes +
            TORZNAB_DISCOVERY_ALLOWANCE.favorites.gzipBytes +
            TORRENT_PROVIDER_ALLOWANCE.favorites.gzipBytes +
            MODERN_INTERFACE_RELATED_ALLOWANCES["favorites-transfer"]
                .gzipBytes +
            CATEGORY_NAVIGATION_FAVORITES_ALLOWANCE.gzipBytes +
            STB_PLAYER_FAVORITES_ALLOWANCE.gzipBytes +
            CATEGORY_SELECTION_FAVORITES_ALLOWANCE.gzipBytes +
            FAVORITES_TRANSFER_OPTIONAL_ALLOWANCE.gzipBytes +
            FAVORITES_RECOVERY_OPTIONAL_ALLOWANCE.gzipBytes +
            MIXED_GLOBAL_FAVORITES_OPTIONAL_ALLOWANCE.gzipBytes,
    }),
    // Compatibility is net-new; Local UI and the admitted command runner move
    // existing code off startup. Every emitted asset remains counted once.
    // Isolated raw/gzip: compatibility3527/1529, UI8453/3297, runner2460/1155.
    "local-compatibility": LOCAL_SOURCE_DIAGNOSTICS_ALLOWANCE.optional,
    "local-drop": Object.freeze({
        bytes:
            DESKTOP_DROP_ALLOWANCE.optional.bytes +
            DESKTOP_VIDEO_QUEUE_ALLOWANCE.bytes,
        gzipBytes:
            DESKTOP_DROP_ALLOWANCE.optional.gzipBytes +
            DESKTOP_VIDEO_QUEUE_ALLOWANCE.gzipBytes,
    }),
    "local-media-ui": Object.freeze({ bytes: 8500, gzipBytes: 3400 }),
    "media-companion": Object.freeze({
        bytes:
            COMPANION_DIAGNOSTICS_ALLOWANCE.companion.bytes +
            TORZNAB_DISCOVERY_ALLOWANCE.companion.bytes +
            TORRENT_STREAMS_ALLOWANCE.companion.bytes +
            TORRENT_PROVIDER_ALLOWANCE.companion.bytes +
            MEDIA_COMPANION_OPTIONAL_ALLOWANCE.bytes +
            MEDIA_COMPANION_TRANSPORT_ALLOWANCE.bytes,
        gzipBytes:
            COMPANION_DIAGNOSTICS_ALLOWANCE.companion.gzipBytes +
            TORZNAB_DISCOVERY_ALLOWANCE.companion.gzipBytes +
            TORRENT_STREAMS_ALLOWANCE.companion.gzipBytes +
            TORRENT_PROVIDER_ALLOWANCE.companion.gzipBytes +
            MEDIA_COMPANION_OPTIONAL_ALLOWANCE.gzipBytes +
            MEDIA_COMPANION_TRANSPORT_ALLOWANCE.gzipBytes,
    }),
    "modern-interface": Object.freeze({
        bytes:
            MODERN_NATIVE_SHELL_OPTIONAL_ALLOWANCE.bytes +
            MODERN_INFO_INTERACTION_ALLOWANCE.renderer.bytes +
            MODERN_INTERFACE_OPTIONAL_ALLOWANCE.bytes +
            MODERN_PLAYER_OPTIONAL_ALLOWANCE.bytes +
            MODERN_EXPERIENCE_ALLOWANCE.renderer.bytes,
        gzipBytes:
            MODERN_REPAINT_OPTIONAL_ALLOWANCE.gzipBytes +
            MODERN_NATIVE_SHELL_OPTIONAL_ALLOWANCE.gzipBytes +
            MODERN_INFO_INTERACTION_ALLOWANCE.renderer.gzipBytes +
            MODERN_INTERFACE_OPTIONAL_ALLOWANCE.gzipBytes +
            MODERN_PLAYER_OPTIONAL_ALLOWANCE.gzipBytes +
            MODERN_EXPERIENCE_ALLOWANCE.renderer.gzipBytes,
    }),
    // Explicit TTL performance capture: sensors, quotas and correlation stay optional.
    // Existing startup and complete legacy limits do not grow for this feature.
    // Opt-in HLS v2 adds track ranges, PTS, passive live/config measurements and
    // version fencing. Node22.23.4 level9: 15638/6089 -> 18760/7076 raw/gzip.
    // Allocate its measured +3122/+987 with +3200/+1024; retain prior headroom.
    // Opt-in HLS v3 adds initial/current policy, observed error actions and
    // fragment flags. After sharing config projection, TS5.9.3/Terser5.51.2
    // on Node26.8.2 level9 measures 19400/7263 -> 21388/7942 raw/gzip.
    // Allocate the measured +1988/+679 as +2000/+704, retaining prior headroom.
    // Main and legacy-total limits remain unchanged; total counts this once.
    "perf-capture": Object.freeze({ bytes: 22200, gzipBytes: 8528 }),
    "remote-local-runner": Object.freeze({ bytes: 2700, gzipBytes: 1300 }),
    // Provider scalar codecs and the paginated Plex folder collection reuse normal
    // save paths. Node22 development: provider fields15528/5460, settings20128/6781;
    // moving legacy Plex setup into the optional asset leaves legacy1175608/370795.
    "remote-provider-fields": Object.freeze({ bytes: 18000, gzipBytes: 6200 }),
    // Move the typed factory/dispatcher into the lifecycle asset, and the remote-only
    // handoff/notification handlers out of startup. Combined Node22: base15851/5206,
    // lifecycle29193/9276; entry1037905/321296. Existing entry/legacy caps stay fixed.
    "remote-settings": Object.freeze({ bytes: 17500, gzipBytes: 5800 }),
    // Existing UI/debug owners stay in startup; typed extras, CAS and ACK handling
    // are optional. Node22 level9: extras5651/2255, combined entry1038397/320895.
    "remote-settings-extras": Object.freeze({ bytes: 7000, gzipBytes: 2800 }),
    "remote-settings-lifecycle": Object.freeze({
        bytes:
            CLIENT_INTERFACE_COLORS_ALLOWANCE.remoteSettingsLifecycle.bytes +
            TORZNAB_DISCOVERY_ALLOWANCE.settings.bytes +
            TORRENT_STREAMS_ALLOWANCE.settings.bytes +
            TORRENT_DISCOVERY_ALLOWANCE.settings.bytes +
            31000 +
            MEDIA_COMPANION_SETTINGS_ALLOWANCE.bytes +
            MODERN_INTERFACE_RELATED_ALLOWANCES["remote-settings-lifecycle"]
                .bytes,
        gzipBytes:
            CLIENT_INTERFACE_COLORS_ALLOWANCE.remoteSettingsLifecycle
                .gzipBytes +
            TORZNAB_DISCOVERY_ALLOWANCE.settings.gzipBytes +
            TORRENT_STREAMS_ALLOWANCE.settings.gzipBytes +
            TORRENT_DISCOVERY_ALLOWANCE.settings.gzipBytes +
            10000 +
            MEDIA_COMPANION_SETTINGS_ALLOWANCE.gzipBytes +
            MODERN_INTERFACE_RELATED_ALLOWANCES["remote-settings-lifecycle"]
                .gzipBytes,
    }),
    // Pure legacy snapshot projections move out of startup; no new polling.
    "runtime-debug-details": Object.freeze({ bytes: 3800, gzipBytes: 1900 }),
    // Measured 1144 raw / 596 gzip bytes; fetched only when Shaka is requested.
    "shaka-tracks": Object.freeze({ bytes: 1200, gzipBytes: 640 }),
    // Two live-recovery choices add 239 raw / 73 gzip bytes on Node 26.12.1.
    // Keep the existing lazy editor and its original measurement headroom.
    "subtitle-appearance": Object.freeze({
        bytes:
            INTERFACE_FONT_CSP_ASSET_CORRECTION.bytes +
            CLIENT_INTERFACE_COLORS_ALLOWANCE.appearance.bytes +
            INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE.appearance.bytes +
            CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE.appearance.bytes +
            8100 +
            MODERN_INTERFACE_RELATED_ALLOWANCES["subtitle-appearance"].bytes,
        gzipBytes:
            INTERFACE_FONT_CSP_ASSET_CORRECTION.gzipBytes +
            CLIENT_INTERFACE_COLORS_ALLOWANCE.appearance.gzipBytes +
            INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE.appearance.gzipBytes +
            CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE.appearance.gzipBytes +
            3400 +
            MODERN_INTERFACE_RELATED_ALLOWANCES["subtitle-appearance"]
                .gzipBytes,
    }),
});
// Carry the approved 96-byte VOD checkpoint allowance into the complete
// payload exactly once, alongside the independently bounded optional capture.
// Count the reviewed recovery allowances (+6300/+2200) and HLS v3
// optional allowance (+2000/+704) once each; individual budgets stay bounded.
// Include both feature increments once; provider and optional caps stay fixed.
// Count independent folder scans once; preserve legacy plus optional allocation.
const BASE_TOTAL_BUDGET = Object.freeze({
    bytes:
        CLIENT_INTERFACE_COLORS_ALLOWANCE.entry.bytes +
        CLIENT_INTERFACE_COLORS_ALLOWANCE.providerEdem.bytes +
        CLIENT_INTERFACE_COLORS_ALLOWANCE.appearance.bytes +
        CLIENT_INTERFACE_COLORS_ALLOWANCE.remoteSettingsLifecycle.bytes +
        CLIENT_INTERFACE_COLORS_ALLOWANCE.optional.bytes +
        DESKTOP_VIDEO_QUEUE_ALLOWANCE.bytes +
        INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE.entry.bytes +
        CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE.entry.bytes +
        INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE.appearance.bytes +
        CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE.appearance.bytes +
        DESKTOP_DROP_ALLOWANCE.entry.bytes +
        DESKTOP_DROP_ALLOWANCE.optional.bytes +
        NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE.bytes +
        FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE.entry.bytes +
        FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE.favorites.bytes +
        LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE.entry.bytes +
        LOCAL_FAVORITES_PATH_ALLOWANCE.entry.bytes +
        LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE.favorites.bytes +
        LOCAL_FAVORITES_PATH_ALLOWANCE.favorites.bytes +
        PLEX_ARTWORK_ALLOWANCE.bytes +
        MODERN_NATIVE_SHELL_OPTIONAL_ALLOWANCE.bytes +
        Object.values(MODERN_INFO_INTERACTION_ALLOWANCE).reduce(
            (sum, cap) => sum + cap.bytes,
            0
        ) +
        Object.values(COMPANION_DIAGNOSTICS_ALLOWANCE).reduce(
            (sum, cap) => sum + cap.bytes,
            0
        ) +
        Object.values(MODERN_EXPERIENCE_ALLOWANCE).reduce(
            (sum, cap) => sum + cap.bytes,
            0
        ) +
        TORZNAB_DISCOVERY_ALLOWANCE.entry.bytes +
        TORRENT_STREAMS_ALLOWANCE.entry.bytes +
        TORZNAB_DISCOVERY_ALLOWANCE.catalog.bytes +
        TORRENT_STREAMS_ALLOWANCE.catalog.bytes +
        TORZNAB_DISCOVERY_ALLOWANCE.companion.bytes +
        TORRENT_STREAMS_ALLOWANCE.companion.bytes +
        TORZNAB_DISCOVERY_ALLOWANCE.settings.bytes +
        TORRENT_STREAMS_ALLOWANCE.settings.bytes +
        TORRENT_DISCOVERY_ALLOWANCE.entry.bytes +
        TORRENT_DISCOVERY_ALLOWANCE.catalog.bytes +
        TORRENT_DISCOVERY_ALLOWANCE.settings.bytes +
        TORRENT_PROVIDER_ALLOWANCE.entry.bytes +
        TORRENT_PROVIDER_ALLOWANCE.catalog.bytes +
        TORZNAB_DISCOVERY_ALLOWANCE.favorites.bytes +
        TORRENT_PROVIDER_ALLOWANCE.favorites.bytes +
        TORRENT_PROVIDER_ALLOWANCE.settings.bytes +
        TORRENT_PROVIDER_ALLOWANCE.companion.bytes +
        MEDIA_COMPANION_ENTRY_ALLOWANCE.bytes +
        MEDIA_COMPANION_PREPARATION_ALLOWANCE.bytes +
        MEDIA_COMPANION_OPTIONAL_ALLOWANCE.bytes +
        MEDIA_COMPANION_TRANSPORT_ALLOWANCE.bytes +
        MEDIA_COMPANION_SETTINGS_ALLOWANCE.bytes +
        MODERN_INTERFACE_OPTIONAL_ALLOWANCE.bytes +
        MODERN_PLAYER_OPTIONAL_ALLOWANCE.bytes +
        Object.values(MODERN_INTERFACE_RELATED_ALLOWANCES).reduce(
            (sum, cap) => sum + cap.bytes,
            0
        ) +
        MODERN_INTERFACE_ENTRY_ALLOWANCE.bytes +
        TIZEN_PACKAGE_BOOT_ALLOWANCE.bytes +
        CATEGORY_NAVIGATION_ENTRY_ALLOWANCE.bytes +
        STB_PLAYER_ENTRY_ALLOWANCE.bytes +
        STB_PLAYER_STALKER_ALLOWANCE.bytes +
        STB_PLAYER_XTREAM_ALLOWANCE.bytes +
        CATEGORY_NAVIGATION_FAVORITES_ALLOWANCE.bytes +
        STB_PLAYER_FAVORITES_ALLOWANCE.bytes +
        CATEGORY_PICKER_ENTRY_ALLOWANCE.bytes +
        CATEGORY_SELECTION_ENTRY_ALLOWANCE.bytes +
        CATEGORY_VISIBILITY_ENTRY_ALLOWANCE.bytes +
        EPG_PRESENTATION_ENTRY_ALLOWANCE.bytes +
        CATEGORY_SELECTION_FAVORITES_ALLOWANCE.bytes +
        MIXED_GLOBAL_FAVORITES_ENTRY_ALLOWANCE.bytes +
        MIXED_GLOBAL_FAVORITES_PROVIDER_ALLOWANCE.bytes +
        MIXED_GLOBAL_FAVORITES_OPTIONAL_ALLOWANCE.bytes +
        1319160 +
        LOCAL_STALL_RECOVERY_ALLOWANCE.bytes +
        LOCAL_COMMAND_SESSION_ALLOWANCE.bytes +
        LOCAL_STARTUP_PREVIEW_ALLOWANCE.bytes +
        FAVORITES_TRANSFER_ENTRY_ALLOWANCE.bytes +
        FAVORITES_TRANSFER_PLEX_ALLOWANCE.bytes +
        FAVORITES_TRANSFER_OPTIONAL_ALLOWANCE.bytes +
        DESKTOP_FAVORITES_KEY_ALLOWANCE.bytes +
        FAVORITES_RECOVERY_ENTRY_ALLOWANCE.bytes +
        FAVORITES_RECOVERY_OPTIONAL_ALLOWANCE.bytes +
        SHAKA_RETIREMENT_ENTRY_ALLOWANCE.bytes +
        OPTIONAL_BUDGETS["shaka-tracks"].bytes +
        SHAKA_TRACKS_ENTRY_ALLOWANCE.bytes +
        ARCHIVE_RELATIVE_SEEK_ALLOWANCE.bytes +
        RELATIVE_SEEK_ENTRY_ALLOWANCE.bytes +
        PLEX_QUEUE_STEP_TOTAL_ALLOWANCE.bytes +
        PLAYER_PRESENCE_ENTRY_ALLOWANCE.bytes +
        PLAYER_PRESENCE_TRANSPORT_ALLOWANCE.bytes,
    gzipBytes:
        CLIENT_INTERFACE_COLORS_ALLOWANCE.entry.gzipBytes +
        CLIENT_INTERFACE_COLORS_ALLOWANCE.providerEdem.gzipBytes +
        CLIENT_INTERFACE_COLORS_ALLOWANCE.appearance.gzipBytes +
        CLIENT_INTERFACE_COLORS_ALLOWANCE.remoteSettingsLifecycle.gzipBytes +
        CLIENT_INTERFACE_COLORS_ALLOWANCE.optional.gzipBytes +
        DESKTOP_VIDEO_QUEUE_ALLOWANCE.gzipBytes +
        INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE.entry.gzipBytes +
        CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE.entry.gzipBytes +
        INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE.appearance.gzipBytes +
        CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE.appearance.gzipBytes +
        DESKTOP_DROP_ALLOWANCE.entry.gzipBytes +
        DESKTOP_DROP_ALLOWANCE.optional.gzipBytes +
        AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE.gzipBytes +
        NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE.gzipBytes +
        FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE.entry.gzipBytes +
        FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE.favorites.gzipBytes +
        LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE.entry.gzipBytes +
        LOCAL_FAVORITES_PATH_ALLOWANCE.entry.gzipBytes +
        LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE.favorites.gzipBytes +
        LOCAL_FAVORITES_PATH_ALLOWANCE.favorites.gzipBytes +
        PLEX_ARTWORK_ALLOWANCE.gzipBytes +
        MODERN_NATIVE_SHELL_OPTIONAL_ALLOWANCE.gzipBytes +
        Object.values(MODERN_INFO_INTERACTION_ALLOWANCE).reduce(
            (sum, cap) => sum + cap.gzipBytes,
            0
        ) +
        Object.values(COMPANION_DIAGNOSTICS_ALLOWANCE).reduce(
            (sum, cap) => sum + cap.gzipBytes,
            0
        ) +
        Object.values(MODERN_EXPERIENCE_ALLOWANCE).reduce(
            (sum, cap) => sum + cap.gzipBytes,
            0
        ) +
        TORZNAB_DISCOVERY_ALLOWANCE.entry.gzipBytes +
        TORRENT_STREAMS_ALLOWANCE.entry.gzipBytes +
        TORZNAB_DISCOVERY_ALLOWANCE.catalog.gzipBytes +
        TORRENT_STREAMS_ALLOWANCE.catalog.gzipBytes +
        TORZNAB_DISCOVERY_ALLOWANCE.companion.gzipBytes +
        TORRENT_STREAMS_ALLOWANCE.companion.gzipBytes +
        TORZNAB_DISCOVERY_ALLOWANCE.settings.gzipBytes +
        TORRENT_STREAMS_ALLOWANCE.settings.gzipBytes +
        TORRENT_DISCOVERY_ALLOWANCE.entry.gzipBytes +
        TORRENT_DISCOVERY_ALLOWANCE.catalog.gzipBytes +
        TORRENT_DISCOVERY_ALLOWANCE.settings.gzipBytes +
        TORRENT_PROVIDER_ALLOWANCE.entry.gzipBytes +
        TORRENT_PROVIDER_ALLOWANCE.catalog.gzipBytes +
        TORZNAB_DISCOVERY_ALLOWANCE.favorites.gzipBytes +
        TORRENT_PROVIDER_ALLOWANCE.favorites.gzipBytes +
        TORRENT_PROVIDER_ALLOWANCE.settings.gzipBytes +
        TORRENT_PROVIDER_ALLOWANCE.companion.gzipBytes +
        MEDIA_COMPANION_ENTRY_ALLOWANCE.gzipBytes +
        MEDIA_COMPANION_PREPARATION_ALLOWANCE.gzipBytes +
        MEDIA_COMPANION_OPTIONAL_ALLOWANCE.gzipBytes +
        MEDIA_COMPANION_TRANSPORT_ALLOWANCE.gzipBytes +
        MEDIA_COMPANION_SETTINGS_ALLOWANCE.gzipBytes +
        MODERN_INTERFACE_OPTIONAL_ALLOWANCE.gzipBytes +
        MODERN_PLAYER_OPTIONAL_ALLOWANCE.gzipBytes +
        Object.values(MODERN_INTERFACE_RELATED_ALLOWANCES).reduce(
            (sum, cap) => sum + cap.gzipBytes,
            0
        ) +
        MODERN_INTERFACE_ENTRY_ALLOWANCE.gzipBytes +
        TIZEN_PACKAGE_BOOT_ALLOWANCE.gzipBytes +
        CATEGORY_NAVIGATION_ENTRY_ALLOWANCE.gzipBytes +
        STB_PLAYER_ENTRY_ALLOWANCE.gzipBytes +
        STB_PLAYER_STALKER_ALLOWANCE.gzipBytes +
        STB_PLAYER_XTREAM_ALLOWANCE.gzipBytes +
        CATEGORY_NAVIGATION_FAVORITES_ALLOWANCE.gzipBytes +
        STB_PLAYER_FAVORITES_ALLOWANCE.gzipBytes +
        CATEGORY_PICKER_ENTRY_ALLOWANCE.gzipBytes +
        CATEGORY_SELECTION_ENTRY_ALLOWANCE.gzipBytes +
        CATEGORY_VISIBILITY_ENTRY_ALLOWANCE.gzipBytes +
        EPG_PRESENTATION_ENTRY_ALLOWANCE.gzipBytes +
        CATEGORY_SELECTION_FAVORITES_ALLOWANCE.gzipBytes +
        MIXED_GLOBAL_FAVORITES_ENTRY_ALLOWANCE.gzipBytes +
        MIXED_GLOBAL_FAVORITES_PROVIDER_ALLOWANCE.gzipBytes +
        MIXED_GLOBAL_FAVORITES_OPTIONAL_ALLOWANCE.gzipBytes +
        420842 +
        LOCAL_STALL_RECOVERY_ALLOWANCE.gzipBytes +
        LOCAL_COMMAND_SESSION_ALLOWANCE.gzipBytes +
        LOCAL_STARTUP_PREVIEW_ALLOWANCE.gzipBytes +
        FAVORITES_TRANSFER_ENTRY_ALLOWANCE.gzipBytes +
        FAVORITES_TRANSFER_PLEX_ALLOWANCE.gzipBytes +
        FAVORITES_TRANSFER_OPTIONAL_ALLOWANCE.gzipBytes +
        DESKTOP_FAVORITES_KEY_ALLOWANCE.gzipBytes +
        FAVORITES_RECOVERY_ENTRY_ALLOWANCE.gzipBytes +
        FAVORITES_RECOVERY_OPTIONAL_ALLOWANCE.gzipBytes +
        OPTIONAL_BUDGETS["shaka-tracks"].gzipBytes +
        SHAKA_TRACKS_ENTRY_ALLOWANCE.gzipBytes +
        ARCHIVE_RELATIVE_SEEK_ALLOWANCE.gzipBytes +
        RELATIVE_SEEK_ENTRY_ALLOWANCE.gzipBytes +
        PLEX_QUEUE_STEP_TOTAL_ALLOWANCE.gzipBytes +
        PLAYER_PRESENCE_ENTRY_ALLOWANCE.gzipBytes +
        PLAYER_PRESENCE_TRANSPORT_ALLOWANCE.gzipBytes,
});
// Reviewed net-new AVI/MKV behavior only. This does not allocate the relocated
// Local UI or command runner a second copy of their existing payload allowance.
const LOCAL_COMPATIBILITY_ALLOWANCE = Object.freeze({
    // Measured owned-lease snapshots and source-time resume require another
    // 384/256 over the initial feature allocation, including native gzip
    // variation; no startup/legacy increase.
    bytes: 4480,
    gzipBytes: 2304,
});
const TOTAL_BUDGET = Object.freeze({
    bytes:
        BASE_TOTAL_BUDGET.bytes +
        LOCAL_COMPATIBILITY_ALLOWANCE.bytes +
        LOCAL_SOURCE_DIAGNOSTICS_ALLOWANCE.bytes,
    gzipBytes:
        BASE_TOTAL_BUDGET.gzipBytes +
        LOCAL_COMPATIBILITY_ALLOWANCE.gzipBytes +
        LOCAL_SOURCE_DIAGNOSTICS_ALLOWANCE.gzipBytes,
});
const ARTIFACTS = Object.freeze([
    "dist/player.js",
    "src-tauri/frontend/dist/player.js",
    "dist-mobile/dist/player.js",
]);

function collectBundleMeasurement(source, name) {
    const buffer = Buffer.isBuffer(source)
        ? source
        : Buffer.from(source, "utf8");
    const result = {
        bytes: buffer.length,
        gzipBytes: gzipSync(buffer, { level: 9 }).length,
        path: name,
        sha256: createHash("sha256").update(buffer).digest("hex"),
    };
    if (!result.bytes) throw new Error("Empty classic bundle: " + name);
    return result;
}

function measureBundle(source, name, budget = BUDGET) {
    const result = collectBundleMeasurement(source, name);
    for (const key of ["bytes", "gzipBytes"]) {
        if (result[key] > budget[key])
            throw new Error(
                `${name}: ${key} ${result[key]} exceeds budget ${budget[key]}`
            );
    }
    return result;
}

function inspectBundles(root, artifacts = ARTIFACTS) {
    return artifacts.map((file) =>
        measureBundle(fs.readFileSync(path.join(root, file)), file)
    );
}

function inspectBundleSets(root, artifacts = ARTIFACTS, providerKinds) {
    const {
        CLASSIC_PROVIDER_BUNDLES,
        CLASSIC_OPTIONAL_BUNDLES,
    } = require("./classic-bundle.cjs");
    const kinds = providerKinds || Object.keys(CLASSIC_PROVIDER_BUNDLES);
    if (
        new Set(kinds).size !== kinds.length ||
        kinds.some(
            (kind) =>
                !Object.prototype.hasOwnProperty.call(
                    CLASSIC_PROVIDER_BUNDLES,
                    kind
                )
        )
    )
        throw new Error("Invalid expected provider bundle kinds");
    return inspectBundles(root, artifacts).map((entry) => {
        const directory = path.dirname(entry.path);
        const expected = kinds.map((kind) => "provider-" + kind + ".js");
        for (const name of fs.readdirSync(path.join(root, directory))) {
            if (/^provider-.*\.js$/.test(name) && !expected.includes(name))
                throw new Error(
                    "Unexpected provider bundle: " + path.join(directory, name)
                );
        }
        const providers = expected.map((name) => {
            const file = path.join(directory, name);
            return measureBundle(
                fs.readFileSync(path.join(root, file)),
                file,
                PROVIDER_BUDGET
            );
        });
        const optionalAssets = Object.keys(CLASSIC_OPTIONAL_BUNDLES).map(
            (name) => {
                const file = path.join(directory, name + ".js");
                const budget = OPTIONAL_BUDGETS[name];
                if (!budget)
                    throw new Error("Missing optional budget: " + name);
                return measureBundle(
                    fs.readFileSync(path.join(root, file)),
                    file,
                    budget
                );
            }
        );
        const legacyTotal = [entry, ...providers].reduce(
            (sum, item) => ({
                bytes: sum.bytes + item.bytes,
                gzipBytes: sum.gzipBytes + item.gzipBytes,
            }),
            { bytes: 0, gzipBytes: 0 }
        );
        for (const key of ["bytes", "gzipBytes"])
            if (legacyTotal[key] > LEGACY_TOTAL_BUDGET[key])
                throw new Error(
                    `${entry.path}: legacy complete player ${key} ${legacyTotal[key]} exceeds budget ${LEGACY_TOTAL_BUDGET[key]}`
                );
        const total = [entry, ...providers, ...optionalAssets].reduce(
            (sum, item) => ({
                bytes: sum.bytes + item.bytes,
                gzipBytes: sum.gzipBytes + item.gzipBytes,
            }),
            { bytes: 0, gzipBytes: 0 }
        );
        for (const key of ["bytes", "gzipBytes"]) {
            if (total[key] > TOTAL_BUDGET[key])
                throw new Error(
                    `${entry.path}: complete player ${key} ${total[key]} exceeds budget ${TOTAL_BUDGET[key]}`
                );
        }
        return {
            entry: entry.path,
            legacyTotal,
            optionalAssets,
            providers,
            total,
        };
    });
}

function writeBundleReport(
    root,
    optimizer,
    modules,
    artifacts = ARTIFACTS,
    providerKinds
) {
    const measured = inspectBundles(root, artifacts);
    if (measured[0].sha256 !== optimizer.outputSha256)
        throw new Error(
            "Classic optimizer report does not match the server bundle"
        );
    return saveBundleReport(
        root,
        optimizer,
        modules,
        measured,
        inspectBundleSets(root, artifacts, providerKinds)
    );
}

function saveBundleReport(root, optimizer, modules, measured, sets) {
    const { CLASSIC_PRIVATE_MODULES } = require("./classic-bundle.cjs");
    const report = {
        archiveRelativeSeekAllowance: ARCHIVE_RELATIVE_SEEK_ALLOWANCE,
        artifacts: measured,
        autoRelayStallRecoveryEntryAllowance:
            AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE,
        baseTotalBudget: BASE_TOTAL_BUDGET,
        budget: BUDGET,
        categoryNavigationEntryAllowance: CATEGORY_NAVIGATION_ENTRY_ALLOWANCE,
        categoryNavigationFavoritesAllowance:
            CATEGORY_NAVIGATION_FAVORITES_ALLOWANCE,
        categoryPickerEntryAllowance: CATEGORY_PICKER_ENTRY_ALLOWANCE,
        categorySelectionEntryAllowance: CATEGORY_SELECTION_ENTRY_ALLOWANCE,
        categorySelectionFavoritesAllowance:
            CATEGORY_SELECTION_FAVORITES_ALLOWANCE,
        categoryVisibilityEntryAllowance: CATEGORY_VISIBILITY_ENTRY_ALLOWANCE,
        classicPresentationSettingsAllowance:
            CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE,
        clientInterfaceColorsAllowance: CLIENT_INTERFACE_COLORS_ALLOWANCE,
        companionDiagnosticsAllowance: COMPANION_DIAGNOSTICS_ALLOWANCE,
        desktopFavoritesKeyAllowance: DESKTOP_FAVORITES_KEY_ALLOWANCE,
        desktopVideoQueueAllowance: DESKTOP_VIDEO_QUEUE_ALLOWANCE,
        epgPresentationEntryAllowance: EPG_PRESENTATION_ENTRY_ALLOWANCE,
        favoritesCategoryPersistenceAllowance:
            FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE,
        favoritesRecoveryEntryAllowance: FAVORITES_RECOVERY_ENTRY_ALLOWANCE,
        favoritesRecoveryOptionalAllowance:
            FAVORITES_RECOVERY_OPTIONAL_ALLOWANCE,
        favoritesTransferEntryAllowance: FAVORITES_TRANSFER_ENTRY_ALLOWANCE,
        favoritesTransferOptionalAllowance:
            FAVORITES_TRANSFER_OPTIONAL_ALLOWANCE,
        favoritesTransferPlexAllowance: FAVORITES_TRANSFER_PLEX_ALLOWANCE,
        interfaceNotificationSettingsAllowance:
            INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE,
        legacyTotalBudget: LEGACY_TOTAL_BUDGET,
        localCommandSessionAllowance: LOCAL_COMMAND_SESSION_ALLOWANCE,
        localCompatibilityAllowance: LOCAL_COMPATIBILITY_ALLOWANCE,
        localFavoritesPathAllowance: LOCAL_FAVORITES_PATH_ALLOWANCE,
        localFavoriteWriteRecoveryAllowance:
            LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE,
        localSourceDiagnosticsAllowance: LOCAL_SOURCE_DIAGNOSTICS_ALLOWANCE,
        localStallRecoveryAllowance: LOCAL_STALL_RECOVERY_ALLOWANCE,
        localStartupPreviewAllowance: LOCAL_STARTUP_PREVIEW_ALLOWANCE,
        mediaCompanionEntryAllowance: MEDIA_COMPANION_ENTRY_ALLOWANCE,
        mediaCompanionOptionalAllowance: MEDIA_COMPANION_OPTIONAL_ALLOWANCE,
        mediaCompanionPreparationAllowance:
            MEDIA_COMPANION_PREPARATION_ALLOWANCE,
        mediaCompanionSettingsAllowance: MEDIA_COMPANION_SETTINGS_ALLOWANCE,
        mediaCompanionTransportAllowance: MEDIA_COMPANION_TRANSPORT_ALLOWANCE,
        mixedGlobalFavoritesEntryAllowance:
            MIXED_GLOBAL_FAVORITES_ENTRY_ALLOWANCE,
        mixedGlobalFavoritesOptionalAllowance:
            MIXED_GLOBAL_FAVORITES_OPTIONAL_ALLOWANCE,
        mixedGlobalFavoritesProviderAllowance:
            MIXED_GLOBAL_FAVORITES_PROVIDER_ALLOWANCE,
        modernExperienceAllowance: MODERN_EXPERIENCE_ALLOWANCE,
        modernInfoInteractionAllowance: MODERN_INFO_INTERACTION_ALLOWANCE,
        modernNativeShellOptionalAllowance:
            MODERN_NATIVE_SHELL_OPTIONAL_ALLOWANCE,
        modernPlayerOptionalAllowance: MODERN_PLAYER_OPTIONAL_ALLOWANCE,
        modules,
        nativeWindowControlsEntryAllowance:
            NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE,
        optimizer,
        optionalBudget: OPTIONAL_BUDGET,
        optionalBudgets: OPTIONAL_BUDGETS,
        playerPresenceEntryAllowance: PLAYER_PRESENCE_ENTRY_ALLOWANCE,
        playerPresenceTransportAllowance: PLAYER_PRESENCE_TRANSPORT_ALLOWANCE,
        plexArtworkAllowance: PLEX_ARTWORK_ALLOWANCE,
        plexQueueStepTotalAllowance: PLEX_QUEUE_STEP_TOTAL_ALLOWANCE,
        privateModules: Object.fromEntries(
            Object.entries(CLASSIC_PRIVATE_MODULES).filter(([file]) =>
                modules.includes(file)
            )
        ),
        providerBundles: sets,
        relativeSeekEntryAllowance: RELATIVE_SEEK_ENTRY_ALLOWANCE,
        schema: 1,
        shakaRetirementEntryAllowance: SHAKA_RETIREMENT_ENTRY_ALLOWANCE,
        shakaTracksEntryAllowance: SHAKA_TRACKS_ENTRY_ALLOWANCE,
        stbPlayerEntryAllowance: STB_PLAYER_ENTRY_ALLOWANCE,
        stbPlayerFavoritesAllowance: STB_PLAYER_FAVORITES_ALLOWANCE,
        stbPlayerStalkerAllowance: STB_PLAYER_STALKER_ALLOWANCE,
        stbPlayerXtreamAllowance: STB_PLAYER_XTREAM_ALLOWANCE,
        tizenPackageBootAllowance: TIZEN_PACKAGE_BOOT_ALLOWANCE,
        toolchain: { node: process.versions.node, zlib: process.versions.zlib },
        torrentDiscoveryAllowance: TORRENT_DISCOVERY_ALLOWANCE,
        torrentProviderAllowance: TORRENT_PROVIDER_ALLOWANCE,
        torrentStreamsAllowance: TORRENT_STREAMS_ALLOWANCE,
        torznabDiscoveryAllowance: TORZNAB_DISCOVERY_ALLOWANCE,
        totalBudget: TOTAL_BUDGET,
    };
    const output = path.join(root, "build/reports/classic-bundle.json");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    return report;
}

// Production-only collection boundary: measurements never authorize an oversized
// build. Strict public inspectors above retain their original eager behavior.
function clearBuildSizeReports(root) {
    for (const name of ["classic-size-diagnostics.json", "classic-bundle.json"])
        fs.rmSync(path.join(root, "build/reports", name), { force: true });
}
function writeBuildBundleReport(
    root,
    optimizer,
    modules,
    artifacts = ARTIFACTS,
    providerKinds,
    context = {}
) {
    const {
        CLASSIC_PROVIDER_BUNDLES,
        CLASSIC_OPTIONAL_BUNDLES,
    } = require("./classic-bundle.cjs");
    const kinds = providerKinds || Object.keys(CLASSIC_PROVIDER_BUNDLES);
    if (
        !artifacts.length ||
        artifacts.length > 3 ||
        new Set(artifacts).size !== artifacts.length ||
        new Set(kinds).size !== kinds.length ||
        kinds.some((kind) => !Object.hasOwn(CLASSIC_PROVIDER_BUNDLES, kind))
    )
        throw new Error("Invalid expected classic bundle inventory");
    if (
        artifacts.some(
            (file) =>
                typeof file !== "string" ||
                file.length > 512 ||
                path.isAbsolute(file) ||
                file
                    .split(/[\\/]/)
                    .some((part) => !part || part === "." || part === "..")
        )
    )
        throw new Error("Unsafe declared classic artifact path");
    const violations = [],
        inputErrors = [],
        measured = [],
        sets = [];
    fs.rmSync(path.join(root, "build/reports/classic-bundle.json"), {
        force: true,
    });
    const base = fs.realpathSync(root);
    function violation(item, budget, scope) {
        for (const metric of ["bytes", "gzipBytes"])
            if (item[metric] > budget[metric])
                violations.push({
                    actual: item[metric],
                    budget: budget[metric],
                    metric,
                    path: item.path,
                    scope,
                });
    }
    function read(file, budget) {
        try {
            if (
                path.isAbsolute(file) ||
                file
                    .split(/[\\/]/)
                    .some((part) => !part || part === "." || part === "..")
            )
                throw new Error("Unsafe declared path");
            let target = base;
            for (const part of file.split(/[\\/]/)) {
                target = path.join(target, part);
                if (fs.lstatSync(target).isSymbolicLink())
                    throw new Error("Symlink input");
            }
            const namedBefore = fs.lstatSync(target);
            if (
                !namedBefore.isFile() ||
                !namedBefore.size ||
                namedBefore.size > 16 * 1024 * 1024
            )
                throw new Error("Empty, nonregular or excessive input");
            const fd = fs.openSync(
                target,
                fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0)
            );
            let bytes;
            try {
                const before = fs.fstatSync(fd);
                if (
                    !before.isFile() ||
                    !before.size ||
                    before.size > 16 * 1024 * 1024
                )
                    throw new Error("Empty, nonregular or excessive input");
                if (
                    before.ino !== namedBefore.ino ||
                    before.dev !== namedBefore.dev ||
                    fs.realpathSync(target) !== target
                )
                    throw new Error("Changed input path");
                bytes = Buffer.alloc(before.size);
                if (fs.readSync(fd, bytes, 0, bytes.length, 0) !== bytes.length)
                    throw new Error("Incomplete input read");
                const after = fs.fstatSync(fd),
                    named = fs.lstatSync(target);
                if (
                    before.size !== after.size ||
                    before.mtimeMs !== after.mtimeMs ||
                    before.ctimeMs !== after.ctimeMs ||
                    before.ino !== named.ino ||
                    before.dev !== named.dev ||
                    before.size !== named.size ||
                    before.mtimeMs !== named.mtimeMs ||
                    before.ctimeMs !== named.ctimeMs ||
                    fs.realpathSync(target) !== target ||
                    named.isSymbolicLink()
                )
                    throw new Error("Unstable input");
            } finally {
                fs.closeSync(fd);
            }
            const item = collectBundleMeasurement(bytes, file);
            // A missing policy remains an input error; still measure the bytes.
            if (budget) violation(item, budget, "asset");
            return item;
        } catch (error) {
            inputErrors.push({
                error: String(error.message).slice(0, 512),
                path: String(file).slice(0, 256),
            });
            return null;
        }
    }
    function sum(items) {
        return items.some((item) => !item)
            ? null
            : items.reduce(
                  (total, item) => ({
                      bytes: total.bytes + item.bytes,
                      gzipBytes: total.gzipBytes + item.gzipBytes,
                  }),
                  { bytes: 0, gzipBytes: 0 }
              );
    }
    for (const file of artifacts) {
        const entry = read(file, BUDGET),
            directory = path.dirname(file);
        measured.push(entry);
        const expected = kinds.map((kind) => "provider-" + kind + ".js");
        // Bound inventory enumeration and reject symlink directories too.
        let directoryValid = true;
        try {
            let target = base;
            if (directory !== ".")
                for (const part of directory.split(/[\\/]/)) {
                    target = path.join(target, part);
                    const info = fs.lstatSync(target);
                    if (info.isSymbolicLink() || !info.isDirectory())
                        throw new Error("Unsafe input directory");
                }
            const dir = fs.opendirSync(target);
            try {
                let item,
                    count = 0;
                while ((item = dir.readSync())) {
                    if (++count > 4096)
                        throw new Error("Excessive directory inventory");
                    if (
                        /^provider-.*\.js$/.test(item.name) &&
                        !expected.includes(item.name)
                    )
                        throw new Error(
                            "Unexpected provider bundle: " +
                                item.name.slice(0, 128)
                        );
                }
            } finally {
                dir.closeSync();
            }
        } catch (error) {
            directoryValid = false;
            inputErrors.push({
                error: String(error.message).slice(0, 512),
                path: directory,
            });
        }
        const providers = expected.map((name) =>
            read(path.join(directory, name), PROVIDER_BUDGET)
        );
        const optionalAssets = Object.keys(CLASSIC_OPTIONAL_BUNDLES).map(
            (name) => {
                const file = path.join(directory, name + ".js");
                if (
                    !Object.hasOwn(OPTIONAL_BUDGETS, name) ||
                    !OPTIONAL_BUDGETS[name]
                ) {
                    inputErrors.push({
                        error:
                            "Missing optional budget: " +
                            String(name).slice(0, 128),
                        path: file,
                    });
                    return read(file, null);
                }
                return read(file, OPTIONAL_BUDGETS[name]);
            }
        );
        const legacyTotal = directoryValid ? sum([entry, ...providers]) : null,
            total = directoryValid
                ? sum([entry, ...providers, ...optionalAssets])
                : null;
        if (legacyTotal)
            violation(
                { path: file, ...legacyTotal },
                LEGACY_TOTAL_BUDGET,
                "legacyTotal"
            );
        if (total) violation({ path: file, ...total }, TOTAL_BUDGET, "total");
        sets.push({
            entry: file,
            legacyTotal,
            optionalAssets,
            providers,
            total,
        });
    }
    let expectedSha256 = optimizer.outputSha256;
    if (context.nativeEntrySource !== undefined) {
        const source = collectBundleMeasurement(
            context.nativeEntrySource,
            "optimizer-output"
        );
        violation(source, BUDGET, "optimizer");
        if (source.sha256 !== optimizer.outputSha256)
            inputErrors.push({
                error: "Native transform source does not match optimizer output",
                path: artifacts[0],
            });
        const { transformPlaySystemIcons } = require("./play-system-icons.cjs");
        expectedSha256 = collectBundleMeasurement(
            transformPlaySystemIcons(context.nativeEntrySource),
            "native-optimizer-output"
        ).sha256;
    }
    if (measured[0] && measured[0].sha256 !== expectedSha256)
        inputErrors.push({
            error: "Classic optimizer report does not match the server bundle",
            path: artifacts[0],
        });
    function label(value) {
        return value == null ? null : String(value).slice(0, 256);
    }
    const diagnosticPath = path.join(
        root,
        "build/reports/classic-size-diagnostics.json"
    );
    if (violations.length || inputErrors.length) {
        const diagnostic = {
            archiveRelativeSeekAllowance: ARCHIVE_RELATIVE_SEEK_ALLOWANCE,
            artifacts: measured,
            attempt: label(context.attempt || process.env.GITHUB_RUN_ATTEMPT),
            autoRelayStallRecoveryEntryAllowance:
                AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE,
            budget: BUDGET,
            categoryNavigationEntryAllowance:
                CATEGORY_NAVIGATION_ENTRY_ALLOWANCE,
            categoryNavigationFavoritesAllowance:
                CATEGORY_NAVIGATION_FAVORITES_ALLOWANCE,
            categoryPickerEntryAllowance: CATEGORY_PICKER_ENTRY_ALLOWANCE,
            categorySelectionEntryAllowance: CATEGORY_SELECTION_ENTRY_ALLOWANCE,
            categorySelectionFavoritesAllowance:
                CATEGORY_SELECTION_FAVORITES_ALLOWANCE,
            categoryVisibilityEntryAllowance:
                CATEGORY_VISIBILITY_ENTRY_ALLOWANCE,
            classicPresentationSettingsAllowance:
                CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE,
            clientInterfaceColorsAllowance: CLIENT_INTERFACE_COLORS_ALLOWANCE,
            collectedAt: new Date().toISOString(),
            companionDiagnosticsAllowance: COMPANION_DIAGNOSTICS_ALLOWANCE,
            complete: !inputErrors.length,
            desktopFavoritesKeyAllowance: DESKTOP_FAVORITES_KEY_ALLOWANCE,
            desktopVideoQueueAllowance: DESKTOP_VIDEO_QUEUE_ALLOWANCE,
            diagnostic: true,
            epgPresentationEntryAllowance: EPG_PRESENTATION_ENTRY_ALLOWANCE,
            favoritesCategoryPersistenceAllowance:
                FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE,
            favoritesRecoveryEntryAllowance: FAVORITES_RECOVERY_ENTRY_ALLOWANCE,
            favoritesRecoveryOptionalAllowance:
                FAVORITES_RECOVERY_OPTIONAL_ALLOWANCE,
            favoritesTransferEntryAllowance: FAVORITES_TRANSFER_ENTRY_ALLOWANCE,
            favoritesTransferOptionalAllowance:
                FAVORITES_TRANSFER_OPTIONAL_ALLOWANCE,
            favoritesTransferPlexAllowance: FAVORITES_TRANSFER_PLEX_ALLOWANCE,
            inputErrors,
            interfaceNotificationSettingsAllowance:
                INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE,
            legacyTotalBudget: LEGACY_TOTAL_BUDGET,
            localFavoritesPathAllowance: LOCAL_FAVORITES_PATH_ALLOWANCE,
            localFavoriteWriteRecoveryAllowance:
                LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE,
            mediaCompanionEntryAllowance: MEDIA_COMPANION_ENTRY_ALLOWANCE,
            mediaCompanionOptionalAllowance: MEDIA_COMPANION_OPTIONAL_ALLOWANCE,
            mediaCompanionPreparationAllowance:
                MEDIA_COMPANION_PREPARATION_ALLOWANCE,
            mediaCompanionSettingsAllowance: MEDIA_COMPANION_SETTINGS_ALLOWANCE,
            mediaCompanionTransportAllowance:
                MEDIA_COMPANION_TRANSPORT_ALLOWANCE,
            mixedGlobalFavoritesEntryAllowance:
                MIXED_GLOBAL_FAVORITES_ENTRY_ALLOWANCE,
            mixedGlobalFavoritesOptionalAllowance:
                MIXED_GLOBAL_FAVORITES_OPTIONAL_ALLOWANCE,
            mixedGlobalFavoritesProviderAllowance:
                MIXED_GLOBAL_FAVORITES_PROVIDER_ALLOWANCE,
            mode: label(context.mode || "standard"),
            modernExperienceAllowance: MODERN_EXPERIENCE_ALLOWANCE,
            modernInfoInteractionAllowance: MODERN_INFO_INTERACTION_ALLOWANCE,
            modernNativeShellOptionalAllowance:
                MODERN_NATIVE_SHELL_OPTIONAL_ALLOWANCE,
            nativeWindowControlsEntryAllowance:
                NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE,
            optimizerBinding: {
                outputSha256: optimizer.outputSha256,
                stagedExpectedSha256: expectedSha256,
            },
            optionalBudgets: OPTIONAL_BUDGETS,
            playerPresenceEntryAllowance: PLAYER_PRESENCE_ENTRY_ALLOWANCE,
            playerPresenceTransportAllowance:
                PLAYER_PRESENCE_TRANSPORT_ALLOWANCE,
            plexArtworkAllowance: PLEX_ARTWORK_ALLOWANCE,
            plexQueueStepTotalAllowance: PLEX_QUEUE_STEP_TOTAL_ALLOWANCE,
            providerBudget: PROVIDER_BUDGET,
            providerBundles: sets,
            relativeSeekEntryAllowance: RELATIVE_SEEK_ENTRY_ALLOWANCE,
            run: label(process.env.GITHUB_RUN_ID),
            runAttempt: label(process.env.GITHUB_RUN_ATTEMPT),
            schema: 1,
            shakaRetirementEntryAllowance: SHAKA_RETIREMENT_ENTRY_ALLOWANCE,
            shakaTracksEntryAllowance: SHAKA_TRACKS_ENTRY_ALLOWANCE,
            source: label(context.source || process.env.GITHUB_SHA),
            stbPlayerEntryAllowance: STB_PLAYER_ENTRY_ALLOWANCE,
            stbPlayerFavoritesAllowance: STB_PLAYER_FAVORITES_ALLOWANCE,
            stbPlayerStalkerAllowance: STB_PLAYER_STALKER_ALLOWANCE,
            stbPlayerXtreamAllowance: STB_PLAYER_XTREAM_ALLOWANCE,
            tizenPackageBootAllowance: TIZEN_PACKAGE_BOOT_ALLOWANCE,
            toolchain: {
                node: process.versions.node,
                zlib: process.versions.zlib,
            },
            torrentDiscoveryAllowance: TORRENT_DISCOVERY_ALLOWANCE,
            torrentProviderAllowance: TORRENT_PROVIDER_ALLOWANCE,
            torrentStreamsAllowance: TORRENT_STREAMS_ALLOWANCE,
            torznabDiscoveryAllowance: TORZNAB_DISCOVERY_ALLOWANCE,
            totalBudget: TOTAL_BUDGET,
            violations,
        };
        const error = new Error(
            "Classic bundle validation failed: " +
                violations.length +
                " size violations; " +
                inputErrors.length +
                " input errors; " +
                (violations.length
                    ? `${violations[0].path}: ${violations[0].scope} ${violations[0].metric} ${violations[0].actual} exceeds budget ${violations[0].budget}`
                    : inputErrors[0].error)
        );
        try {
            fs.rmSync(diagnosticPath, { force: true });
            fs.mkdirSync(path.dirname(diagnosticPath), { recursive: true });
            fs.writeFileSync(
                diagnosticPath,
                JSON.stringify(diagnostic, null, 2) + "\n"
            );
        } catch (writeError) {
            error.message +=
                "; diagnostics write failed: " + writeError.message;
        }
        throw error;
    }
    fs.rmSync(diagnosticPath, { force: true });
    return saveBundleReport(root, optimizer, modules, measured, sets);
}

if (require.main === module) {
    try {
        for (const result of inspectBundles(path.resolve(__dirname, "..")))
            console.log(
                `${result.path}: ${result.bytes} bytes; gzip ${result.gzipBytes} bytes`
            );
        for (const result of inspectBundleSets(path.resolve(__dirname, "..")))
            console.log(
                `${result.entry}: complete player ${result.total.bytes} bytes; gzip ${result.total.gzipBytes} bytes`
            );
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
module.exports = {
    ARCHIVE_RELATIVE_SEEK_ALLOWANCE,
    ARTIFACTS,
    AUTO_RELAY_STALL_RECOVERY_ENTRY_ALLOWANCE,
    BASE_TOTAL_BUDGET,
    BUDGET,
    CATEGORY_NAVIGATION_ENTRY_ALLOWANCE,
    CATEGORY_NAVIGATION_FAVORITES_ALLOWANCE,
    CATEGORY_PICKER_ENTRY_ALLOWANCE,
    CATEGORY_SELECTION_ENTRY_ALLOWANCE,
    CATEGORY_SELECTION_FAVORITES_ALLOWANCE,
    CATEGORY_VISIBILITY_ENTRY_ALLOWANCE,
    CLASSIC_PRESENTATION_SETTINGS_ALLOWANCE,
    CLIENT_INTERFACE_COLORS_ALLOWANCE,
    COMPANION_DIAGNOSTICS_ALLOWANCE,
    clearBuildSizeReports,
    collectBundleMeasurement,
    DESKTOP_DROP_ALLOWANCE,
    DESKTOP_FAVORITES_KEY_ALLOWANCE,
    DESKTOP_VIDEO_QUEUE_ALLOWANCE,
    EPG_PRESENTATION_ENTRY_ALLOWANCE,
    FAVORITES_CATEGORY_PERSISTENCE_ALLOWANCE,
    FAVORITES_RECOVERY_ENTRY_ALLOWANCE,
    FAVORITES_RECOVERY_OPTIONAL_ALLOWANCE,
    FAVORITES_TRANSFER_ENTRY_ALLOWANCE,
    FAVORITES_TRANSFER_OPTIONAL_ALLOWANCE,
    FAVORITES_TRANSFER_PLEX_ALLOWANCE,
    INTERFACE_FONT_CSP_ASSET_CORRECTION,
    INTERFACE_NOTIFICATION_SETTINGS_ALLOWANCE,
    inspectBundleSets,
    inspectBundles,
    LEGACY_TOTAL_BUDGET,
    LOCAL_COMMAND_SESSION_ALLOWANCE,
    LOCAL_COMPATIBILITY_ALLOWANCE,
    LOCAL_FAVORITE_WRITE_RECOVERY_ALLOWANCE,
    LOCAL_FAVORITES_PATH_ALLOWANCE,
    LOCAL_SOURCE_DIAGNOSTICS_ALLOWANCE,
    LOCAL_STALL_RECOVERY_ALLOWANCE,
    LOCAL_STARTUP_PREVIEW_ALLOWANCE,
    MEDIA_COMPANION_ENTRY_ALLOWANCE,
    MEDIA_COMPANION_OPTIONAL_ALLOWANCE,
    MEDIA_COMPANION_PREPARATION_ALLOWANCE,
    MEDIA_COMPANION_SETTINGS_ALLOWANCE,
    MEDIA_COMPANION_TRANSPORT_ALLOWANCE,
    MIXED_GLOBAL_FAVORITES_ENTRY_ALLOWANCE,
    MIXED_GLOBAL_FAVORITES_OPTIONAL_ALLOWANCE,
    MIXED_GLOBAL_FAVORITES_PROVIDER_ALLOWANCE,
    MODERN_EXPERIENCE_ALLOWANCE,
    MODERN_INFO_INTERACTION_ALLOWANCE,
    MODERN_INTERFACE_ENTRY_ALLOWANCE,
    MODERN_INTERFACE_OPTIONAL_ALLOWANCE,
    MODERN_INTERFACE_RELATED_ALLOWANCES,
    MODERN_NATIVE_SHELL_OPTIONAL_ALLOWANCE,
    MODERN_PLAYER_OPTIONAL_ALLOWANCE,
    MODERN_REPAINT_OPTIONAL_ALLOWANCE,
    measureBundle,
    NATIVE_WINDOW_CONTROLS_ENTRY_ALLOWANCE,
    OPTIONAL_BUDGET,
    OPTIONAL_BUDGETS,
    PLAYER_PRESENCE_ENTRY_ALLOWANCE,
    PLAYER_PRESENCE_TRANSPORT_ALLOWANCE,
    PLEX_ARTWORK_ALLOWANCE,
    PLEX_QUEUE_STEP_TOTAL_ALLOWANCE,
    PROVIDER_BUDGET,
    RELATIVE_SEEK_ENTRY_ALLOWANCE,
    SHAKA_RETIREMENT_ENTRY_ALLOWANCE,
    SHAKA_TRACKS_ENTRY_ALLOWANCE,
    STB_PLAYER_ENTRY_ALLOWANCE,
    STB_PLAYER_FAVORITES_ALLOWANCE,
    STB_PLAYER_STALKER_ALLOWANCE,
    STB_PLAYER_XTREAM_ALLOWANCE,
    TIZEN_PACKAGE_BOOT_ALLOWANCE,
    TORRENT_DISCOVERY_ALLOWANCE,
    TORRENT_PROVIDER_ALLOWANCE,
    TORRENT_STREAMS_ALLOWANCE,
    TORZNAB_DISCOVERY_ALLOWANCE,
    TOTAL_BUDGET,
    writeBuildBundleReport,
    writeBundleReport,
};
