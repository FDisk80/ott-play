<a id="ott-play-documentation-wiki"></a>

# Wiki dokumentasi OTT-play

<!-- language-navigation:start -->
<p dir="ltr">
<a href="Home.md" lang="en" dir="ltr">English</a> · <a href="Home.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="Home.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="Home.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="Home.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="Home.es.md" lang="es" dir="ltr">Español</a> · <a href="Home.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="Home.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="Home.he.md" lang="he" dir="rtl">עברית</a> · <a href="Home.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="Home.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="Home.it.md" lang="it" dir="ltr">Italiano</a> · <a href="Home.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="Home.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="Home.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="Home.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="Home.pt.md" lang="pt" dir="ltr">Português</a> · <a href="Home.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="Home.th.md" lang="th" dir="ltr">ไทย</a> · <a href="Home.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="Home.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="Home.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="Home.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="Home.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[README](../../README.id.md) · [Semua bahasa antarmuka](../readme/README.md)

Ini adalah halaman utama dokumentasi berversi dalam repositori sumber. GitHub dapat menampilkan halaman Markdown ini langsung; menyimpannya di sini membuat petunjuk, diagram, dan pengujian ditinjau bersama kode. [GitHub Wiki](https://github.com/open-ott-play/ottplay-foss/wiki) yang terpisah diekspor dari sumber ini dan mencantumkan revisi sumber pada setiap halaman. Lihat [petunjuk penerbitan](../wiki-publishing.md).

<a id="start-and-install"></a>

## Memulai dan memasang

- [Panduan praktis](../../README.id.md), tersedia dalam [24 bahasa dokumentasi](../manual-translations.md).
- [Panduan cepat terlokalisasi untuk seluruh 88 bahasa antarmuka](../readme/README.md). Panduan ini memakai kembali label UI terjemahan dan langkah navigasi. Ini bukan 88 manual teknis terjemahan. Manual utama dan panduan fitur berpasangan memiliki edisi lengkap dalam 24 bahasa.
- [Paket dan pembaruan Android Full/API 22](../android-distributions.md), [build Android](../../android/README.md), dan [Capacitor iOS/Android](../capacitor-mobile.md).
- [Distribusi desktop di macOS](../macos-local-delivery.md), [penandatanganan/pembaruan Tauri](../tauri-updater-notarize.md), dan [instans HTTP lokal](../local-http-deployment.md).

<a id="process-and-results"></a>

## Proses dan hasil

- [Kualifikasi browser dan verifikasi kandidat](../browser-compatibility.id.md) ([Русский](../browser-compatibility.ru.md)): target yang dikonfigurasi, diagram berwarna, pemeriksaan paket persis, dan hasil lokal yang terpisah.

- [Laporan implementasi dan diagram berwarna](../implementation-report.id.md) ([Русский](../implementation-report.ru.md)): perubahan yang ditinjau, regresi yang diperbaiki, keluaran terukur, dan persyaratan rilis yang tersisa.

<a id="use-the-new-capabilities"></a>

## Memakai kemampuan baru

- [Penyampaian fitur dan batas platform](../roadmap-delivery.id.md) ([Русский](../roadmap-delivery.ru.md)).
- [Batas kualitas, sumber cadangan siaran langsung eksplisit, dan pemulihan terbatas](../playback-stream-policy.id.md) ([Русский](../playback-stream-policy.ru.md)).
- [Pengikatan XMLTV manual dan aksesibilitas klasik](../guide-binding-accessibility.id.md) ([Русский](../guide-binding-accessibility.ru.md)).
- [Pemeriksaan gambar dan suara yang dihosting](../audio-video-check.id.md) ([Русский](../audio-video-check.ru.md)): **Informasi → Audio → Putar**, nada yang diharapkan, diagram hosting, dan kembali ke TV langsung. Klip diambil sesuai kebutuhan, memerlukan internet, dan tidak ada dalam paket pemutar. Demo pola bergerak online yang terpisah tidak bersuara.
- [Pustaka film/serial Xtream](../xtream-media.id.md) ([Русский](../xtream-media.ru.md)).
- [Handoff pemutar dengan sumber sama](../remote-handoff.id.md) ([Русский](../remote-handoff.ru.md)).
- [Jurnal pengaturan lokal dan pemulihan](../settings-recovery.id.md) ([Русский](../settings-recovery.ru.md)).
- [Kontrol andal, profil yang dapat dilanjutkan, dan handoff](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.md) ([Русский](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.ru.md)). Memerlukan revisi pengontrol/CLI yang cocok dan izin yang dikonfigurasi.
- [Preferensi audio/subtitel semantik di Android native](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.md) ([Русский](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.ru.md)). Aplikasi Kotlin native terpisah dari APK Capacitor repositori ini.

<a id="configure-sources-and-inspect-problems"></a>

## Mengonfigurasi sumber dan menyelidiki masalah

- [Masuk dan pemutaran Plex](../plex-provider.md), [arsitektur panduan](../guide-architecture.md), dan [diagnostik EPG yang dihosting](../hosted-epg-diagnostics.md).
- [Pengaturan antarmuka](../interface-settings.md), [riwayat desain dan kredit](../interface-history.md), serta [katalog bahasa/papan ketik](../localization.md).
- [Meja kerja jarak jauh](../remote-workbench.md), [diagnostik runtime](../runtime-debug.md), dan [persetujuan, penyamaran, serta retensi diagnostik](../diagnostic-security.md).
- [Daftar periksa perangkat native](../mode-b-device-smoke.md), [daftar periksa perangkat Tauri](../mode-b-tauri-smoke.md), dan [kontrol jendela browser](../browser-window-controls.md).

- [Biaya fitur terukur](../roadmap-size.id.md), bukti mentah, dan grafik SVG.

<a id="develop-and-release"></a>

## Mengembangkan dan merilis

- [Arsitektur dan kepemilikan](../architecture.md), [sesi pemutaran](../playback-session-architecture.md), dan [build ES5 klasik](../build-pipeline.md).
- [Nama aset runtime](../asset-layout.md), [kebijakan rilis](../../RELEASING.md), [runbook operator rilis](../release-workflow.md), dan [fuzzing RC](../../FUZZING.md).
- [Kebijakan privasi](../privacy-policy.md) dan [lisensi MIT](../../LICENSE).

Untuk perubahan dokumentasi, jalankan `npm run docs:generate` ketika label UI atau templat panduan cepat berubah, lalu `npm run check:docs`. Pastikan semua terjemahan manual lengkap, letakkan batas kemampuan di dekat klaim, dan bedakan validasi lokal dari pengujian perangkat fisik. Diagram adalah aset repositori yang dapat ditinjau; lihat [SVG pengikatan panduan](../images/guide-binding.svg) dan diagram yang ditautkan dari panduan fitur. Pemeriksa memvalidasi tujuan berkas relatif, bukan ketersediaan situs jarak jauh atau setiap jangkar judul Markdown.
