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

Berkas lokal tanpa Internet: lihat [Video lokal dan pemutaran offline](docs/offline-media.md).

[![Daftar saluran OTT-play FOSS dalam tampilan perspektif](docs/images/hero.png)](docs/images/studio-2026-default.png)

*Tangkapan layar antarmuka Studio 2026 yang sudah ada, dengan data saluran dan acara sintetis.
Buka gambar untuk melihat tampilan datar aslinya; ini bukan tangkapan langganan langsung.
[Sumber gambar dan pembuatan ulang](docs/images/README.md).*

[Panduan cepat dalam 88 bahasa](docs/readme/README.md) · [Wiki dokumentasi](docs/wiki/Home.id.md)

[![Praktik Terbaik OpenSSF](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![Fuzzing: hanya RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

Kandidat rilis publik menjalankan kampanye fuzzing terbatas dan terisolasi untuk penguraian XMLTV native/server serta validasi permintaan portal. Lihat [cakupan fuzzing, reproduksi, dan bukti rilis](FUZZING.md).

Pemutar IPTV/OTT mandiri dengan server HTTP Rust lokal. Berjalan di Smart TV (LG WebOS, Samsung Tizen, Panasonic, Sony, dan lainnya), set-top box (Infomir MAG, Dune HD, Enigma2, Android TV), dan browser desktop.

Mulai dengan [panduan arsitektur dan kontributor](docs/architecture.md) untuk lapisan runtime, tanggung jawab, cara memperluas penyedia, dan verifikasi. Lihat [sesi pemutaran dan masa hidup penyedia](docs/playback-session-architecture.md) untuk batas inti/host dan kontrak kompatibilitas.

<!-- ci-release-process:start -->
<a id="release-process"></a>

## Proses rilis

Lihat [strategi rilis](RELEASING.md) untuk aturan validasi serta promosi nightly, beta, RC, dan stabil, serta [panduan operasional](docs/release-workflow.md) untuk perintah lokal.
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## Menjalankan di browser

Buka [demo langsung](https://player.ottplay.here.now/), atau bangun dan sajikan pemutar web menggunakan petunjuk di bawah.

[Penerapan macOS lokal](docs/local-http-deployment.md) menyediakan origin HTTP pemutar pada port 8443–8446. Port 8095 sudah tidak digunakan.

Pada peluncuran pertama, pilih **Coba demo** untuk memutar pola uji bergerak, atau konfigurasikan daftar putar M3U atau penyedia sendiri. Demo juga tersedia kemudian melalui **Ubah penyedia → Demo**.

Mode demo membutuhkan Internet tetapi tidak membutuhkan akun penyedia. Saluran uji MP4 dan HLS tanpa suara dihosting di here.now dan dipakai bersama oleh pemutar web, Tauri, Capacitor, dan OTT Server. Pengaturan penyedia yang sudah ada tetap disimpan saat beralih. Untuk **pemeriksaan gambar dan suara** terpisah, buka **Informasi → Audio → Putar** pada mesin HTML5 yang dikelola ketika tidak memutar atau sedang menonton TV langsung. Ini menggunakan berkas uji bersuara `av-v1.mp4` di here.now dan membutuhkan Internet. Klip tidak ada dalam paket pemutar dan tidak pernah diambil saat startup. VOD, arsip, dan penggantian mesin perangkat (termasuk PC2/Video.js dan mesin native) dikecualikan; lihat [langkah, nada yang diharapkan, dan diagram hosting](docs/audio-video-check.id.md).

Jendela browser desktop yang diinstal mendukung **Window Controls Overlay**: Chrome dapat menyembunyikan bilah judul terpisah sambil mempertahankan tombol jendela dan menu aplikasi di atas pemutar. Buka aplikasi yang diinstal dan pilih **Sembunyikan bilah judul** ketika Chrome menawarkannya; **Tampilkan bilah judul** mengembalikan bingkai biasa. Tab biasa dan tata letak TV/shell native mempertahankan perilaku sebelumnya. Lihat [kontrol jendela browser](docs/browser-window-controls.md) untuk URL instalasi yang didukung, pembaruan pintasan yang ada, dan verifikasi.

Untuk melompat sepuluh detik dalam tampilan video utama, gunakan **Alt/Option + Kiri/Kanan** (**Command + Kiri/Kanan** juga berfungsi di macOS), dalam layar penuh maupun tampilan biasa. Video lokal, VOD, dan arsip saluran yang didukung menggunakan kontrol yang sama di web, Tauri, dan Capacitor. Lihat [pintasan keyboard dan batasannya](docs/browser-window-controls.md#playback-keyboard-shortcuts).

Pada antarmuka PC, **R** memutar saluran atau video lain secara acak dari daftar saat ini tanpa mengubah urutannya. Berfungsi dalam tampilan video utama dan daftar saluran/video; editor teks, dialog, pengaturan, dan pembatasan kios tetap diprioritaskan. Pemetaan tombol perangkat lain tidak berubah.

Pola uji sintetis dapat dibuat ulang dengan `scripts/generate-demo-media.sh` (membutuhkan FFmpeg); media yang dibuat tetap berada di direktori `.local-artifacts` yang diabaikan Git.

<a id="features"></a>

## Fitur

- **Pemutaran**: HLS, DASH, dan streaming HTTP biasa, dengan batas kualitas HLS.js/Shaka yang dikelola, pemulihan terbatas, dan hingga tiga URL cadangan eksplisit per saluran langsung. Arsip/VOD tidak pernah beralih ke cadangan langsung; lihat [kualitas dan pemulihan](docs/playback-stream-policy.id.md).
- **EPG**: pencocokan XMLTV, pergeseran waktu/tayangan ulang, pencarian judul acara (N5 di EPG), pengingat, dan pengikatan feed/ID manual untuk saluran tertentu pada jalur XMLTV terhosting/native. Lihat [pengikatan dan aksesibilitas](docs/guide-binding-accessibility.id.md).
- **Favorit**: satu [koleksi campuran](docs/mixed-favorites.md) berurutan lintas penyedia dan profil yang dikonfigurasi pada perangkat yang didukung, dengan ekspor/impor portabel melalui CLI; PIN orang tua. Daftar favorit per sumber tetap tersedia dalam mode cadangan.
- **Pengaturan**: ekspor/impor JSON pengaturan dan favorit, jurnal pembatalan untuk batch localStorage yang didukung, melanjutkan arsip sesuai sumber, dan perbandingan tepat pengaturan tersimpan untuk alur pengontrol. Pemulihan mengasumsikan satu penulis; adaptor penyimpanan khusus tetap memakai rollback sebisanya. Lihat [pemulihan pengaturan](docs/settings-recovery.id.md).
- **Antarmuka bersama**: OTT Server, Tauri, dan Capacitor memakai tema dan pengaturan visibilitas daftar saluran yang sama. [Warna antarmuka](docs/interface-colors.md) menyediakan sembilan peran warna, palet, input nilai HEX/RGB/HSV yang presisi, dan lima skema warna, dengan pengaturan yang disimpan untuk setiap klien; pengaturan daftar saluran mengendalikan nama, picon, acara saat ini, kemajuan, dan penanda arsip.
- **Penyedia**: M3U/M3U8, TV langsung Xtream beserta [katalog film/serial sesuai permintaan](docs/xtream-media.id.md), Stalker/Ministra dengan [film dan episode bertingkat](docs/stalker-media.md), Plex, dan VPortal. Kemampuan penyedia dan akses akun menentukan fitur arsip serta pustaka media yang tersedia.
- **Perintah push**: kendali jarak jauh melalui webhook — ubah saluran, penyedia, daftar putar, tampilkan popup
- **Input teks jarak jauh (swop)**: keyboard ponsel melalui Cloudflare Worker ketika TV dan ponsel berada di jaringan berbeda (sesi diotorisasi per instalasi; ♥™ pada keyboard virtual)
- **Perutean per perangkat**: pengalamatan berbasis UUID untuk konfigurasi banyak perangkat
- **Proxy lokal**: server perintah lokal opsional untuk otomatisasi 100% lokal (tanpa server pusat)
- **Integrasi pengontrol**: operator dengan cakupan perangkat/tindakan, hasil perintah persisten opsional, penerapan preset Local/Home yang dapat dilanjutkan, serta pengalihan langsung/arsip dari sumber yang sama melalui [server kontrol](https://github.com/open-ott-play/ottplay-control-server) yang sesuai. Membutuhkan pengontrol/CLI yang diperbarui; tab browser mandiri tidak menyediakannya.
- **Preferensi jarak jauh bertipe**: temukan pengaturan, baca nilai tersimpan dan efektif, lalu simpan dengan pemeriksaan instans runtime, sumber, dan revisi; lihat [pengaturan jarak jauh dan konfigurasi VPortal](docs/remote-player-settings.md).
- **Debug**: HUD pemutaran/log melingkar opsional melalui `?debug=1`, inspeksi jarak jauh berdasarkan persetujuan, dan pemeriksaan audio/video terhosting sesuai permintaan
- **Aksesibilitas keyboard**: dialog klasik bernama, pembatasan dan pengembalian fokus Tab, semantik saluran terpilih, dan pengumuman status yang tidak mengganggu. Peningkatan ini tidak membuktikan kepatuhan penuh WCAG atau pembaca layar perangkat.
- **24 jenis perangkat**: pemetaan tombol remote per perangkat
- **88 bahasa antarmuka**: katalog yang sesuai, [panduan cepat terlokalisasi](docs/readme/README.md), dan [alfabet keyboard yang diperiksa dengan CLDR](docs/localization.md). Manual utama dan panduan fitur berpasangan tersedia dalam [24 bahasa dokumentasi](docs/manual-translations.md); referensi rekayasa lain mempertahankan bahasa yang ada.

[Panduan penyampaian](docs/roadmap-delivery.id.md) menjelaskan fitur yang diimplementasikan dalam revisi sumber ini, batas platform, diagram, dan verifikasi. Rilis terinstal atau penerapan terhosting mungkin memakai revisi lebih lama. [Aplikasi Android](https://github.com/open-ott-play/ottplay-android) native yang mandiri juga menyimpan pilihan audio/subtitel menurut bahasa, peran, dan label, bukan indeks manifest; implementasi dan rilisnya terpisah dari frontend ini.

[Tinjauan kode sumber STB](docs/stb-player-improvements.md) menjelaskan peningkatan media, penggunaan sumber daya, dan pemulihan, beserta perbandingan kode sumber dan batasan saat ini.

<a id="debug-hud"></a>

## HUD debug

HUD lokal dan penyimpanan log server diaktifkan secara terpisah. Lihat [akses diagnostik, penyamaran, dan retensi](docs/diagnostic-security.md) sebelum mengumpulkan log perangkat lain.

Aktifkan debug dengan salah satu cara berikut:
- URL: `?debug=1` atau `?debug=true`
- Penyimpanan lokal: `localStorage.setItem("ottplay_debug", "1")`
- Properti jendela: `window.__OTT_DEBUG__ = true`
- Server: ketika `/debug/config` mengembalikan `{enabled: true}`

Ketika debug aktif:
- Tekan **D** untuk mengubah tampilan strip HUD (`ottDebugSetHud` / `__ottDebug.toggleHud()`)
  - Dilewati ketika fokus berada pada INPUT/TEXTAREA/listEdit
  - Menggunakan `e.key` untuk menghindari konflik MAG/Maple PLAY/PREV=68
- Menu informasi → **HUD debug** → memanggil `__ottDebug.toggleHud()`
- Kelola pengaturan → **HUD debug**:
  - Jika debug sudah dimuat: mengubah visibilitas HUD
  - Jika belum: menetapkan `ottplay_debug=1` + `ottplay_debug_hud=1` dan meminta restart
- Persistensi: status HUD disimpan di `localStorage.ottplay_debug_hud` ("1"/"0") oleh `ottDebugSetHud`

<a id="capacitor-ios-and-android"></a>

## Capacitor untuk iOS dan Android

Repositori ini mengemas frontend TypeScript bersama memakai Capacitor untuk iOS dan Android 7+. Keduanya memakai font sistem dan runtime native yang dikunci npm. APK kompatibilitas API 22 terpisah mendukung Android 5.1/6 dengan WebView 60 atau lebih baru. Kedua APK Android ditandatangani dan disertakan dalam rilis beta, RC, dan stabil yang memenuhi syarat, bersama IPA iOS yang tidak ditandatangani. Aplikasi Kotlin mandiri tetap berada di [ottplay-android](https://github.com/open-ott-play/ottplay-android).

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

Lihat [konfigurasi Capacitor](docs/capacitor-mobile.md) dan [distribusi Android serta pembaruan jarak jauh](docs/android-distributions.md).

Antarmuka iOS memakai orientasi lanskap. Pengaturan, konfigurasi penyedia, persetujuan kendali jarak jauh, dan impor/ekspor JSON tetap memakai frontend bersama. Multitasking tablet dapat menggantikan orientasi yang diminta.

Pada iPhone, geser vertikal di atas daftar saluran untuk menelusuri baris dan halaman; geser ke atas untuk saluran berikutnya dan ke bawah untuk sebelumnya. Sentilan cepat bergerak melewati beberapa halaman lalu melambat hingga berhenti; seretan lambat tetap presisi. Sentuh layar atau tekan tombol navigasi untuk menghentikan gerakan. Satu ketukan memulai saluran di bawah jari meskipun baris lain sedang dipilih. Geseran tidak pernah membuka saluran saat jari diangkat.

Video diputar langsung dalam antarmuka iPhone. Ketuk bagian bawah layar untuk informasi acara atau buka menu sementara pemutaran berlanjut. Picture in Picture tetap merupakan opsi pemutaran terpisah.

Uji dasar perangkat: [daftar periksa Mode B](docs/mode-b-device-smoke.md) dan `./scripts/smoke-capacitor-device.sh --help` (target build/sync hanya iOS). Uji dasar Tauri desktop: [daftar periksa desktop](docs/mode-b-tauri-smoke.md).

<a id="installation"></a>

## Instalasi

| Platform | Paket | Catatan |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Build Apple Silicon dan Intel terpisah; ditandatangani ad-hoc kecuali penandatanganan Apple dikonfigurasi |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | Berbagai distribusi |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode atau Homebrew Channel](docs/lg-webos-installation.md); pemutar di server, memerlukan jaringan |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode dan penandatanganan lokal; paket TV belum ditandatangani, terpisah dari Family Hub](docs/samsung-tizen-installation.md) |
| **iOS** | `.ipa` melalui AltStore / TestFlight / Xcode | Hanya sideload — belum di App Store |
| **Android (frontend bersama)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | Paket Capacitor ditandatangani; pilih versi Android yang didukung |
| **Android (Kotlin native)** | [Aplikasi native](https://github.com/open-ott-play/ottplay-android) terpisah | Repositori publik; aplikasi dan alur rilis terpisah |

Installer yang didukung dilampirkan pada rilis GitHub yang memenuhi syarat: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **Catatan:** bundel macOS memakai tanda tangan ad-hoc jika kredensial Apple tidak tersedia; ini tidak menyediakan Developer ID atau notarisasi. Installer Windows/Linux dan paket rilis iOS mungkin tidak ditandatangani. iOS membutuhkan penandatanganan sebelum dipasang pada perangkat fisik. APK rilis Android Full dan API 22 yang memenuhi syarat memakai sertifikat penandatanganan yang ditetapkan; build rilis lokal membutuhkan keystore terkonfigurasi untuk menghasilkan APK bertanda tangan.

---

<a id="macos"></a>

### macOS

1. Pilih tag yang dimaksud dari [Rilis](https://github.com/open-ott-play/ottplay-foss/releases). Pintasan rilis terbaru memilih stabil, bukan beta atau RC.
2. Unduh `OttPlay.FOSS_*_aarch64-apple-darwin.dmg` untuk Apple Silicon atau `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` untuk Intel. Keduanya build arsitektur terpisah.
3. Buka `.dmg` dan seret **OttPlay FOSS.app** ke Applications.
4. Verifikasi bundel yang disalin sebelum peluncuran pertama:

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

Verifikasi yang berhasil memeriksa integritas bundel. `Signature=adhoc` berarti aplikasi tidak mempunyai identitas pengembang yang diautentikasi Apple; ini tidak membuktikan notarisasi atau persetujuan Gatekeeper. Meski unduhan tepercaya dan bundel valid, macOS masih dapat meminta **System Settings → Privacy & Security → Open Anyway** setelah percobaan pertama; lihat [petunjuk Apple](https://support.apple.com/en-us/102445).

Pesan “aplikasi rusak” bukan bukti bahwa penyebabnya hanya karantina. Jika verifikasi tanda tangan gagal, simpan kesalahannya dan dapatkan rilis yang diperbaiki. Jangan menandatangani ulang aplikasi unduhan atau menghapus atributnya untuk membuat verifikasi gagal tampak berhasil.

Alternatif ZIP adalah `OttPlay.FOSS_aarch64-apple-darwin.app.zip` dan `OttPlay.FOSS_x86_64-apple-darwin.app.zip`. Lihat [penandatanganan macOS dan verifikasi artefak](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact) untuk ekstraksi, citra disk, dan pemeriksaan Gatekeeper. Untuk build checkout dan pemasangan lokal, gunakan [penyampaian macOS lokal](docs/macos-local-delivery.md).

---

<a id="windows"></a>

### Windows

1. Unduh `.msi` atau `.exe` dari [Rilis](https://github.com/open-ott-play/ottplay-foss/releases/latest)
2. Jalankan installer dan ikuti petunjuk
3. Luncurkan melalui Start Menu atau pintasan Desktop

---

<a id="linux"></a>

### Linux

Pemutaran Linux membutuhkan plugin GStreamer HLS, H.264, dan AAC selain WebKitGTK. Paket menyatakan dependensi media ini; build AppImage menyertakan kerangka media. Lihat [pengemasan media Linux](docs/linux-media-packaging.md) untuk pemeriksaan codec dan perbedaan antara penerimaan browser dan native.

**AppImage:**

```bash
chmod +x OttPlay.FOSS_*_amd64.AppImage
./OttPlay.FOSS_*_amd64.AppImage
```

**Debian/Ubuntu (.deb):**

```bash
sudo apt install ./OttPlay.FOSS_*.deb
```

**Fedora (.rpm):**

```bash
sudo dnf --enablerepo=fedora-cisco-openh264 install ./OttPlay.FOSS-*.rpm
```

---

<a id="ios-installation"></a>

### Instalasi iOS

iOS membutuhkan penandatanganan sebelum dipasang pada perangkat fisik. Gunakan AltStore Classic untuk IPA rilis tanpa tanda tangan, atau bangun dan tandatangani dari sumber dengan Xcode. TestFlight memerlukan undangan terpisah, jika ditawarkan.

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### Opsi 1: AltStore Classic (disarankan untuk penggunaan pribadi)

AltServer berjalan di komputer; AltStore Classic berjalan di iPhone/iPad dan mengimpor IPA. Akun Apple gratis sudah cukup.

**Prasyarat:**

- iPhone/iPad dengan **iOS/iPadOS 15 atau lebih baru** untuk build OTT-play saat ini.
- Mac atau PC Windows dengan AltServer dan kabel data USB.
- Akun Apple untuk penandatanganan dan Internet untuk mengunduh rilis.

**Langkah 1: siapkan AltStore sekali**

1. Instal AltServer mengikuti [pengaturan macOS](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) atau [pengaturan Windows](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows) resmi. Jalankan dan gunakan ikon bilah menu/system tray.
2. Hubungkan perangkat melalui USB, buka kuncinya, dan terima permintaan kepercayaan komputer/perangkat. Pada Mac, pastikan perangkat muncul di Finder.
3. Melalui **menu AltServer → Install AltStore**, pilih perangkat dan selesaikan permintaan akun penandatanganan. Tunggu pemberitahuan instalasi.
4. Pada perangkat, buka **Settings → General → VPN & Device Management** dan percayai entri pengembang akun penandatanganan jika diminta. Pada iOS 16+, aktifkan **Settings → Privacy & Security → Developer Mode** dan selesaikan restart/konfirmasi perangkat.
5. Buka AltStore pada perangkat. Jika sudah terinstal dan bekerja, lewati penyiapan ini dan biarkan AltServer berjalan untuk impor berikutnya.

**Langkah 2: impor rilis pilihan di iPhone/iPad**

1. Pilih tag persis dari [semua rilis](https://github.com/open-ott-play/ottplay-foss/releases) dan unduh `ottplay-foss-ios-unsigned.ipa` miliknya dengan Safari pada perangkat. [Pintasan rilis terbaru](https://github.com/open-ott-play/ottplay-foss/releases/latest) memilih rilis stabil; gunakan daftar lengkap jika ingin beta.
2. Simpan IPA ke Files. Di **AltStore → My Apps → +**, pilih berkas itu. Anda juga dapat mengirim IPA unduhan dari Mac melalui AirDrop dan menyimpannya ke Files sebelum impor. Membuka IPA di Mac bukan langkah impor ini.
3. Biarkan AltServer berjalan dan kabel USB terhubung saat AltStore menandatangani dan memasang aplikasi. Untuk pembaruan, gunakan akun penandatanganan yang sama dengan instalasi lama; jangan menghapus aplikasi sebagai langkah pemecahan masalah pertama.
4. Tunggu impor selesai, periksa OTT-play di **My Apps**, lalu luncurkan.

**Alternatif: impor URL rilis secara langsung**

Dengan AltStore sudah terinstal, masukkan pola ini di **Safari pada iPhone**, ganti `TAG` dengan tag rilis persis, lalu terima **Open in AltStore**:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

Ini memakai [penangan URL instalasi](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift) AltStore. Cara ini menghindari entri Files/Recents yang ambigu ketika beberapa unduhan memiliki nama sama. URL harus menunjuk aset IPA, bukan halaman rilis.

Sebagai contoh, impor berikut diverifikasi pada **2026-09-29** memakai AltStore 2.3 dan AltServer 1.8.1. Ini contoh historis tetap, bukan tautan versi terbaru:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**Penyegaran:** instalasi akun gratis kedaluwarsa setelah tujuh hari. Pastikan AltServer dapat dijangkau dan gunakan **AltStore → My Apps → Refresh All** sebelum kedaluwarsa. Penyegaran latar belakang juga membutuhkan akses AltServer; lihat [petunjuk penyegaran AltStore](https://faq.altstore.io/altstore-classic/your-altstore).

<a id="verify-the-installed-version-before-retrying"></a>

#### Verifikasi versi terinstal sebelum mencoba lagi

Pesan AirDrop “Sent” hanya membuktikan transfer. Bilah kemajuan AltStore membuktikan impor dimulai. Sambungan Mirroring/USB yang putus tidak membuktikan instalasi gagal: periksa aplikasi terinstal sebelum mengirim IPA kembali.

Pada Mac dengan Xcode terpasang dan dipilih sebagai direktori pengembang aktif, periksa perangkat tanpa memasang ulang:

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

Di `result.apps` JSON, temukan OTT-play (`bundleIdentifier` diawali `play.ott.foss`) dan bandingkan `version` serta `bundleVersion` dengan `CFBundleShortVersionString` dan `CFBundleVersion` IPA pilihan. Akhiran akun penandatanganan AltStore pada identitas bundel memang diharapkan. Simpan laporan perangkat secara lokal.

Contoh beta.9 yang diverifikasi melaporkan **versi `1.1.51`, build `2.2.66`**. Ini memastikan instalasi; membuka aplikasi, masuk Cloudflare, memuat daftar putar, pemutaran, dan PiP adalah pemeriksaan perangkat terpisah.

<a id="troubleshooting-ios-installation"></a>

#### Pemecahan masalah instalasi iOS

- **AltServer tidak mempunyai jendela, atau membukanya lewat otomatisasi mengalami timeout:** gunakan ikon bilah menu/system tray. Ini aplikasi latar belakang. Berulang kali mencoba membuka jendela aplikasi biasa tidak mengimpor IPA.
- **“Could not find AltServer” atau perangkat USB tidak tersedia:** pastikan AltServer berjalan, buka kunci ponsel, dan periksa permintaan kepercayaan komputer/perangkat. Periksa Finder pada Mac. Jika koneksi putus, sambungkan kembali saat aman lalu periksa versi terinstal sebelum mengulang. Ikuti [pemecahan masalah konektivitas AltStore](https://faq.altstore.io/altstore-classic/troubleshooting-guide) jika berlanjut. Jika ponsel menyediakan Internet komputer, koordinasikan perubahan kabel/jaringan agar pekerjaan lain tidak terganggu.
- **iPhone Mirroring menampilkan “iPhone in Use” atau tetap “Connecting”:** selesaikan penyiapan pada ponsel fisik, atau kunci layarnya dan letakkan dekat Mac yang terbuka untuk mencerminkan. Membuka kunci ponsel mengakhiri Mirroring; kepercayaan/penyiapan USB mungkin membutuhkan ponsel terbuka terlebih dahulu. Jika satu penyambungan ulang masih macet, tutup Mirroring dan lanjutkan pada ponsel. Lihat [persyaratan Mirroring Apple](https://support.apple.com/en-us/120421). Mirroring opsional untuk instalasi.
- **URL kehilangan huruf Latin atau berubah menjadi Sirilik di Mirroring:** ubah **sumber input Mac ke ABC/English**. Saat Mirroring fokus, tekan **Control–Space** dan pilih **English (US)** untuk keyboard perangkat keras iPhone. Sumber input Mac dan iPhone dapat berbeda; mengganti Mac saja tidak cukup pada sesi terverifikasi kami. Kosongkan bidang, ketik ulang URL, dan periksa alamat sebelum mengirim.
- **Menempel dari clipboard ke Mirroring macet atau menyisipkan teks tak terduga:** kosongkan bidang dan ketik perlahan dalam potongan pendek memakai sumber input English (US) iPhone, atau masukkan URL langsung pada ponsel. Pengetikan cepat melalui Mirroring dapat menghilangkan atau menggandakan karakter; verifikasi alamat lengkap sebelum menyimpan. Jangan kirim URL yang baru tertempel sebagian. Penempelan gagal pada sesi instalasi kami; ini bukan prasyarat metode URL langsung.
- **Files/Recents menampilkan beberapa nama IPA identik:** pilih lokasi unduhan yang tepat atau gunakan URL langsung bertag di atas. Salinan lokal boleh diganti namanya dengan tag/build agar jelas; mengganti nama tidak mengubah isinya.
- **Aplikasi terinstal tidak dapat dibuka:** ikuti permintaan kepercayaan pengembang atau Developer Mode pada ponsel. Periksa kedaluwarsa di AltStore dan segarkan jika perlu. Catat kesalahan sebenarnya jika tetap gagal; kesalahan koneksi saja bukan alasan menghapus dan memasang ulang aplikasi.
- **OTT-play terbuka tetapi daftar terlindungi gagal melalui seluler:** instalasi dan autentikasi sumber terpisah. Gunakan **Pengaturan → Kelola pengaturan → Akses sumber** untuk masuk ke sumber terkonfigurasi, kemudian muat ulang daftar. Selesaikan biometrik/passkey atau kode email pada perangkat fisik jika diperlukan. Sumber harus mendukung [integrasi iOS Access](docs/ios-source-access.md); memasang aplikasi tidak melewati daftar IP yang diizinkan.
- **Passkey diminta ketika memakai Wi-Fi tepercaya:** untuk sumber dengan iOS Access, aplikasi mencoba sumber asli tanpa login dahulu dan memakai pintu masuk seluler terautentikasi hanya setelah akses ditolak. Periksa IP publik yang benar-benar terlihat oleh sumber, termasuk IPv6: IPv4 rumah yang diizinkan tidak mencakup IPv6, VPN, atau alamat seluler lain. Perubahan jaringan dan membuka ulang aplikasi menghapus preferensi rute sementara. Kesalahan jaringan/server umum seharusnya tidak memicu login.
- **Login tidak muncul lagi tetapi daftar saluran kosong:** sesi tersimpan yang valid digunakan ulang tanpa permintaan baru. Setelah kegagalan pemuatan atau perbaikan server sebelumnya, muat ulang daftar atau tutup aplikasi sepenuhnya lalu buka kembali sekali. Jika tetap gagal, pastikan sumber mengembalikan daftar, bukan halaman login HTML atau kesalahan JSON. Catat pesan dan status HTTP; jangan bagikan URL sumber yang berisi kredensial, cookie, atau token Access.
- **Saluran dimuat tetapi video buffering atau melaporkan `SRC_NOT_FOUND`:** pemuatan daftar dan pemutaran video adalah pemeriksaan terpisah. Coba saluran sekali setelah login; jika berlanjut, periksa respons manifest HLS dan segmen serta dukungan codec stream. Kesalahan itu sendiri tidak membuktikan pergantian mesin atau pemasangan ulang akan membantu.

<a id="option-2-testflight-if-available"></a>

#### Opsi 2: TestFlight (jika tersedia)

Jika undangan TestFlight diterbitkan, instal TestFlight dari App Store, buka undangan pada perangkat, lalu ketuk **Install**. Mengunduh IPA GitHub tidak menyediakan undangan TestFlight.

<a id="option-3-xcode-for-developers"></a>

#### Opsi 3: Xcode (untuk pengembang)

Ikuti [Build dan buka](docs/capacitor-mobile.md#build-and-open), pilih target **App** di Xcode, atur tim pengembangan di **Signing & Capabilities**, pilih perangkat terhubung, lalu build/jalankan. Selesaikan kepercayaan perangkat dan Developer Mode jika perlu. Mengimpor IPA rilis tanpa tanda tangan ke jendela Devices Xcode tidak menyediakan identitas penandatanganan atau profil provisioning yang kurang.

---

<a id="android-application"></a>

### Aplikasi Android

Pilih APK Full Capacitor dari rilis repositori ini untuk antarmuka pemutar bersama. Gunakan APK kompatibilitas API 22 pada Android 5.1–6; membutuhkan WebView 60 atau lebih baru. Pertahankan identitas aplikasi dan sertifikat tanda tangan saat memperbarui agar profil lama tetap tersedia. Lihat [petunjuk build](android/README.md) dan [distribusi, penandatanganan, serta pemasangan jarak jauh](docs/android-distributions.md).

[Repositori ottplay-android](https://github.com/open-ott-play/ottplay-android) yang terpisah berisi aplikasi Kotlin/Compose native. Identitas, preferensi, dan alur rilisnya sendiri, dan tidak mengganti instalasi Capacitor secara langsung. Aset rilis historis tetap tersedia.

---

<a id="quick-start"></a>

## Mulai cepat

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

Gunakan penerapan sendiri dari revisi yang sama untuk pengujian dasar browser.

Gunakan Node 22 dan toolchain Rust stabil. Jalankan server dari akar repositori agar aset statis tersedia. Build native membutuhkan toolchain platform yang dijelaskan di bawah; toolchain tersebut tidak diperlukan untuk build server saja.

Saat pertama dimuat, pilih **Coba demo**, atau buka **Pengaturan → Ubah penyedia → Daftar putar M3U / M3U8**. Buka **Pilih daftar**, pilih slot, masukkan **URL daftar putar**, simpan perubahan, lalu pilih **Muat daftar**. Daftar putar atau akun penyedia berasal dari Anda; aplikasi tidak memberikan langganan saluran berbayar.

<a id="mode-a-companion-smoke"></a>

## Uji dasar companion Mode A

Uji berbasis curl untuk companion Mode A (kesetaraan `ottplay-server` / `archive/server.py`): indeks, direktori statis, `/logo`, `/version`, `/epg` opsional, dan probe `POST /m3u/cp.php` tanpa pengambilan data.

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

Pemeriksaan berada di `scripts/modea-smoke-checks.json`. Tanpa rahasia. Antrean perintah / `local_proxy.py` (:8081) dicakup terpisah oleh `scripts/smoke-command-queue.sh` (jika ada).

<a id="classic-stalker--ministra-portals"></a>

## Portal Stalker / Ministra klasik

Pilih **Portal Stalker** dan masukkan MAC dari penyedia serta URL portal lengkap, misalnya `http://provider.example/stalker_portal/c/`. URL `/c/index.html`, `/stalker_portal`, `/server/load.php`, `/load.php`, dan `/portal.php` memilih protokol MAG klasik. Konfigurasi server tanpa jalur yang sudah ada mempertahankan JSON-RPC. Penyedia memuat profil, genre, dan saluran langsung berhalaman melalui inti Stalker bersama, lalu menemukan film dari protokol klasik `type=vod` dan episode bertingkat di latar belakang. Jalur folder menjadi kategori dalam Daftar saluran biasa; deskripsi dan poster yang tersedia serta Favorit global yang stabil menggunakan antarmuka media yang sama. Lihat [perilaku dan batas katalog](docs/stalker-media.md).

Permintaan versi browser yang dihosting sendiri melewati endpoint `/stalker/api` companion; aplikasi native memakai transport HTTP yang ada. Versi browser terhosting memerlukan rute yang dikonfigurasi secara eksplisit melalui [relai khusus](docs/stalker-relay.md). Aset browser dan server harus diperbarui bersama.

Pemutaran langsung menyelesaikan perintah saluran sementara saat membuka stream; pergantian saluran, berhenti, PiP, dan penggantian penyedia membatalkan resolusi lama. Perintah HTTP(S) eksplisit yang tidak sementara diputar langsung. EPG pendek didukung. Arsip portal klasik dan dialek `type=series` yang terpisah tidak disajikan oleh penyedia ini. Perilaku arsip/panduan JSON-RPC yang sudah ada tidak berubah. Portal LAN pribadi yang menggunakan rute companion memerlukan entri `OTTPLAY_PROXY_LAN_ORIGINS` yang tepat, seperti rute proxy companion lainnya.

Demo Infomir publik berada di `http://middleware-stalker.com/stalker_portal/c/`. Demo mengembalikan tiga entri katalog langsung pada 2026-09-26, tetapi endpoint medianya tidak tersedia; gunakan data portal/media terkontrol untuk regresi pemutaran.

<a id="m3u-stream-proxy-header-smoke"></a>

## Uji header proxy stream M3U

Membandingkan header permintaan upstream yang disisipkan `POST /m3u/cp.php` companion Mode A ketika mengambil URL echo terkontrol (mock lokal secara default — tanpa penyedia IPTV atau rahasia).

Kontrak (dari `src-rs/core/src/m3u.rs` + `archive/server.py`):
- Menyisipkan hanya **User-Agent** (default `OTT-play-FOSS/1.0`, atau preset `webos` / `tizen` / `viera` / `mag` / `dune`).
- **Tidak** menyisipkan **Referer** (`M3UProxy` Capacitor melakukannya; Mode A tidak).
- Menghapus `@` di awal `url` (formulir jQuery penyedia).

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

Kode keluar: `0` lulus, `1` tidak mendengarkan, `2` ketidakcocokan header/HTTP, `3` penggunaan/dependensi. Terkait dengan `smoke-modea-companion.sh` / `smoke-command-queue.sh`.

<a id="logo-concurrent-bench-smoke"></a>

## Uji benchmark logo bersamaan

Uji latensi `GET /logo/<id>.svg` bersamaan (`?ch=` opsional) terhadap companion Mode A. Melaporkan jumlah sukses/gagal dan p50/p95/p99. Default memakai beban lokal CI yang praktis (`CONCURRENCY=200`, `TOTAL=1000`); pengujian penuh 10 ribu opsional (`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`).

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

Kode keluar: `0` lulus, `1` tidak mendengarkan / koneksi gagal, `2` tingkat kesalahan tinggi, `3` penggunaan. Terkait dengan `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`.

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## Uji pembaruan / pemanasan cache XMLTV

Memverifikasi perilaku cache XMLTV/EPG companion Mode A secara jujur terhadap `src-rs` (tanpa API rekaan):

- `EPG_CACHE` dalam memori disajikan melalui `GET /epg/:hash` → selalu `{"epg_data":[...]}` (HTTP 200).
- Awal proses mengambil `EPG_URLS` di latar belakang tanpa menunda startup HTTP; setiap pengambilan selesai diikuti jeda **2h** sebelum pembaruan berikutnya.
- Persistensi SQLite opsional jika `DATABASE_URL` ditetapkan (tanpa endpoint publik status cache).
- `GET /health` → `OK` memastikan HTTP siap setelah restart opsional. Dengan `--strict-epg` dan `--epg-hash`, uji juga menunggu EPG tidak kosong untuk saluran itu dalam anggaran `--warmup-timeout` yang sama.

Jalur default hanya menjalankan curl — **tidak mematikan proses**. Berikan `--restart-cmd` / `RESTART_CMD` untuk penghentian+restart otomatis, atau ikuti langkah `launchctl` manual dalam `--help`.

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

Kode keluar: `0` lulus, `1` tidak mendengarkan, `2` asersi/pemanasan gagal, `3` penggunaan. Terkait dengan `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`.

<a id="mode-a-e2e-play-path-smoke"></a>

## Uji E2E jalur pemutaran Mode A

Uji **jalur pemutaran/kesiapan stream** sisi companion (HTTP saja — **bukan** E2E dengan antarmuka terlihat). Terhadap companion Mode A yang berjalan, uji memeriksa:

- Health atau indeks terjangkau
- Aset statis shell pemutar (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`)
- `GET /epg/<hash>.json` opsional jika `EPG_HASH` ditetapkan
- `POST /m3u/match-channels` dengan JSON uji bebas rahasia (daftar kosong + satu saluran sintetis)
- **Pemutaran** proxy stream: `POST /m3u/cp.php` ke media terkontrol (default daftar HLS lokal atau `MEDIA_URL`), memastikan HTTP 200 + isi tidak kosong / `Content-Type` sesuai (byte pertama melalui proxy)

Tanpa kredensial IPTV pribadi. Terkait dengan `smoke-modea-companion.sh` (keberadaan), `smoke-m3u-stream-proxy-headers.sh` (UA/Referer), `smoke-xmltv-cache-refresh.sh`.

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

Kode keluar: `0` lulus, `1` tidak mendengarkan, `2` asersi gagal, `3` penggunaan/dependensi.

<a id="capacitor-device-smoke-mode-b"></a>

## Uji perangkat Capacitor (Mode B)

**Daftar periksa** simulator/emulator (perangkat nyata opsional) untuk Cap Mode B — bukan HTTP companion Mode A. Manusia menandai kelulusan antarmuka; helper mengotomatiskan toolchain/direktori native/curl antrean perintah yang toleran.

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

Detail: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md). Terkait dengan `smoke-command-queue.sh` (loopback Cap) — jangan disamakan dengan uji Mode A di atas.

<a id="tauri-desktop-smoke-mode-b"></a>

## Uji desktop Tauri (Mode B)

Daftar periksa dan helper desktop untuk Tauri Mode B (jendela/pemutaran saluran/PiP). Bukan HTTP companion Mode A dan bukan uji perangkat Cap.

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

Detail: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md). Kredensial pengembang Apple opsional untuk uji lokal; gunakan [penandatanganan ad-hoc](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials) untuk aplikasi Mac terkemas. Penerimaan manusia tetap mencakup peluncuran, pemutaran, dan PiP.

<a id="docker"></a>

## Docker

Image multiarsitektur (amd64/arm64) dibangun sebagai arsip OCI kandidat. Publikasi registry mempromosikan arsip stabil yang disetujui ke Docker Hub tanpa membangun ulang; lihat [panduan operasional](docs/release-workflow.md).

Biner server dibangun pada **musl** (Alpine) dan dikirim pada Alpine — **tidak** memerlukan GLIBC_2.38+. Ini menjaga `alvit/ottplay-foss` dapat berjalan di Synology DSM Docker (x86_64) dan host glibc lama lainnya.

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

Tag registry stabil memakai `X.Y.Z`. Memperbarui `latest` merupakan opsi eksplisit terpisah setelah image berversi diterbitkan; push main dan tag Git tidak menerbitkan image.

<a id="build-from-source"></a>

## Membangun dari sumber

Aturan domain pemutar berasal dari artefak Kotlin multiplatform yang dipatok di `vendor/ottplay-core.js`. Keputusan panduan, arsip, daftar putar, penyedia, status persisten, dan pemutaran berbagi implementasi dengan FOSS2 serta Android native. Adaptor browser/TV, Swift, dan Rust tetap menangani API perangkat, codec, jaringan, dan efek antarmuka. Artefak browser mempertahankan sintaks ES5 dan bootstrap API lama yang didukung. `npm test`, `check:bundle`, dan `check:es5` memverifikasi integrasi; manifest artefak mencatat hash sumber dan hasil.

Validator protokol control-server dan SWOP dihasilkan dari skema berversi `contracts/ottplay-wire-v1.json`. Bukti generator yang diperiksa dan data kompatibilitas tetap mencegah salinan kebijakan khusus konsumen.

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

## Deteksi perangkat

Pemutar mendukung 24 jenis perangkat. Deteksi: pertama melalui URL `/f/{device_id}/`, kemudian User-Agent.

| ID perangkat | Perangkat |
|---|---|
| `pc` | Browser PC |
| `pc2` | Pemutar web videojs |
| `nodejs` | Aplikasi Windows (Electron) |
| `lg/webos` | TV LG WebOS |
| `samsung/tizen` | TV Samsung Tizen |
| `samsung/maple` | TV Samsung Orsay |
| `mag` | Kotak Infomir MAG |
| `dune` | Kotak Dune HD |
| `android` | Android TV / tablet |
| `hbbtv` | TV HbbTV |
| `panasonic` | TV Panasonic Viera |
| `philips` | TV Philips |
| `sony` | TV Sony |
| `sharp` | TV Sharp |
| `toshiba` | TV Toshiba |
| `hisense` | TV Hisense |
| `skyworth` | TV Skyworth |
| `tcl` | TV TCL |
| `vewd` | Perangkat Vewd |
| `spark` | Penerima Spark |

<a id="push-command-system"></a>

## Sistem perintah push

Untuk layanan multiperangkat terpisah, gunakan [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) dan bagian **Server perintah** dalam **Pengaturan → Kendali jarak jauh**. Masukkan IP/alamat dan kode akses perangkat pemutar ini; menyimpan keduanya otomatis memulai polling perintah volume, saluran, dan lainnya. IP tanpa port memakai HTTP port 8081. Kosongkan alamat atau pilih **Putuskan** untuk berhenti. Sambungan keluar ini mendukung pengiriman terkonfirmasi dan tidak membutuhkan listener lokal. Lihat [detail koneksi dan kompatibilitas](docs/remote-command-server.md). Contoh berikut menjelaskan mode proxy/listener lokal yang sudah ada.

**Cari server perintah** dapat menemukan pengontrol dan meminta persetujuan operator tanpa menyalin token perangkat. Tauri memeriksa DNS native terlebih dahulu dan, jika hasilnya kosong, dapat beralih ke profil deployment yang dikonfigurasi secara eksplisit; pemutar browser, LG, dan Capacitor menggunakan jalur profil browser. Metadata penemuan Home dapat dihosting di here.now secara terpisah dari pengontrol. Build umum tidak otomatis menyertakan profil Home tersebut, dan pembaruan tidak mengganti koneksi yang tersimpan. Lihat [perilaku platform, pengaturan profil, dan pemecahan masalah](docs/remote-command-server.md#discovery-and-one-time-approval).

Kendali HTTP lokal **mati secara default** pada pemutar browser/OTT server, Tauri, dan Capacitor. Aktifkan dalam **Pengaturan pemutar → Kendali jarak jauh** untuk menghasilkan kode perangkat rahasia. Perintah adalah objek JSON dengan kolom `"command"`; permintaan HTTP membutuhkan `Authorization: Bearer <device-code>`.

<a id="architecture"></a>

### Arsitektur

<a id="local-command-url-recommended"></a>

#### URL perintah lokal (disarankan)

Aktifkan **Kendali HTTP lokal** dalam **Pengaturan pemutar → Kendali jarak jauh**, salin **Kode perangkat** yang dihasilkan, dan atur proxy di bawah dengan kode itu. Tetapkan **URL perintah lokal** ke endpoint perintah proxy. Selama aktif, pemutar memeriksa URL ini setiap 10 detik dengan kode dalam header Authorization. Menetapkan URL saja tidak mengaktifkan kendali perintah.

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### UUID perangkat

UUID Perangkat yang sudah ada (misalnya `dev_a1b2c3d4e5`) adalah metadata perutean publik, bukan kredensial otorisasi. **Kode perangkat** terpisah dibuat secara aman saat HTTP lokal diaktifkan dan tetap di perangkat ini; tidak disalin lewat pengaturan cloud. Menonaktifkan HTTP lokal menghentikan polling/listener. Mengaktifkan lagi menghasilkan kode baru: perbarui proxy dan integrasi untuk mencabut kredensial lama.

Tauri dan Capacitor memulai listener HTTP loopback hanya setelah pengaturan ini diizinkan. Proxy penerus harus mengirim kode yang ditampilkan sebagai token Bearer ke listener tersebut. Mode A memakai antrean `local_proxy.py` yang dikonfigurasi terpisah di bawah.

<a id="remote-text-entry-swop"></a>

#### Input teks jarak jauh (swop)

Tujuan: mengetik di ponsel untuk ♥™ / keyboard virtual jarak jauh ketika TV dan ponsel berada di **jaringan berbeda**, melalui penyerahan sesi Cloudflare Worker.

- Repositori Worker: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop)
- **Otorisasi instalasi:** pemutar mengirim permintaan ke relay `/swop` dengan origin yang sama pada servernya. Server menambahkan token instalasi privat; setiap klien pada origin server terdaftar dapat memakai input teks jarak jauh. UUID perangkat mengidentifikasi sesi dan tidak memerlukan daftar izin per perangkat.
- Pengaturan: `swopBaseUrl` (kosong = ♥™ menampilkan “belum dikonfigurasi” / tidak melakukan apa-apa). Edit di **Pengaturan → Kendali jarak jauh** (tombol **2**) atau sisipkan melalui `/local/swop.json` yang diabaikan Git pada instalasi operator
- `POST /session` berisi `clientId`, `caption`, dan `draft`; `POST /val` berisi `clientId`, `code`, serta `sessionToken` yang dikembalikan. URL ponsel memuat token tulis terpisah. Token baca sesi tetap di memori browser.
- **Instalasi lokal:** tetapkan `SWOP_BASE_URL` dan `SWOP_INSTALLATION_TOKEN` setelah mendaftarkan instalasi dan origin LAN/localhost yang tepat pada Worker. `scripts/install-ottplay-local-service.sh` mempertahankannya dalam plist launchd privat dengan mode 0600. `/local/swop.json` publik hanya berisi `{"swopBaseUrl":"/swop"}`. Jangan pernah menaruh token instalasi di aset publik.
- **Hosting statis:** konfigurasikan proxy terautentikasi sisi server untuk dua endpoint yang sama. Simpan token instalasi dalam rahasia layanan hosting. Menyalin berkas pemutar publik tidak menyalin kredensial server itu.

> Server OTT pusat menonaktifkan `/api/webhook/commands`, `/webhook/poll`, `/webhook/notify`, dan alias kesehatan perintah untuk semua metode HTTP. Gunakan server perintah terpisah atau `local_proxy.py` terautentikasi yang dikonfigurasi eksplisit untuk Mode A; server pusat tidak mempunyai antrean perintah siaran.

<a id="available-commands"></a>

### Perintah yang tersedia

Semua contoh berikut memakai `http://192.168.1.50:8081/api/webhook/commands` sebagai URL proxy lokal. Ganti dengan alamat proxy yang sebenarnya dan tetapkan `OTTPLAY_QUEUE_HTTP_TOKEN` ke **Kode perangkat** yang ditampilkan setelah HTTP diaktifkan dalam pengaturan. Proxy harus memakai kode yang sama.

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — Tampilkan popup notifikasi

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| Kolom | Tipe | Default | Deskripsi |
|---|---|---|---|
| `message` | string | wajib | Teks untuk ditampilkan |
| `popup_duration` | number | 5 | Lama tampil dalam detik (pojok kanan atas) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — Ganti saluran berdasarkan posisi daftar

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| Kolom | Tipe | Default | Deskripsi |
|---|---|---|---|
| `channel_number` | number | wajib | Posisi saluran dalam daftar, dimulai dari 1 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — Ganti saluran berdasarkan nama (sebagian)

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

Pencarian substring tanpa membedakan huruf besar/kecil. Kecocokan pertama dipakai.

| Kolom | Tipe | Default | Deskripsi |
|---|---|---|---|
| `channel_name` | string | wajib | Nama saluran lengkap atau sebagian |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — Ganti ke saluran acak

Perintah lama ini memilih saluran yang memenuhi syarat dari daftar atau kategori saat ini. Nomor saluran dan rentang merujuk pada posisi dalam daftar tersebut; lihat [kebijakan pemilihan acak yang aman](docs/remote-command-server.md#safe-random-playback).

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

| Kolom | Tipe | Default | Deskripsi |
|---|---|---|---|
| `random_range` | [start, end] | daftar saat ini | Rentang dimulai dari 1 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — Ganti penyedia IPTV

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| Kolom | Tipe | Default | Deskripsi |
|---|---|---|---|
| `provider` | number | wajib | Indeks dalam array penyedia (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — Muat daftar M3U baru

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| Kolom | Tipe | Default | Deskripsi |
|---|---|---|---|
| `playlist` | string | wajib | URL daftar putar M3U |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — Perbarui konfigurasi penyedia

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| Kolom | Tipe | Default | Deskripsi |
|---|---|---|---|
| `provider_settings` | string | wajib | String JSON konfigurasi penyedia |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — Tetapkan atau sesuaikan volume

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

Diabaikan tanpa pesan pada klien yang tidak mendukung kendali volume.

| Kolom | Tipe | Default | Deskripsi |
|---|---|---|---|
| `volume` | number | — | Tingkat absolut 0-100 |
| `volume_step` | number | — | Perubahan relatif, misalnya +10 atau -5 |

<a id="player-standby-restart-and-exit"></a>

#### Siaga, restart, dan keluar dari pemutar

Antrean webhook proxy lokal tanpa konfirmasi tidak mendukung `exit_player` atau permintaan siaga/bangun bertipe. Hubungkan pemutar ke [server perintah](docs/remote-command-server.md) dan gunakan CLI-nya:

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

Ganti `d1` dengan alias pemutar terdaftar. `stop` adalah alias `standby`; `start` dan `wake` adalah alias `go`. Go membutuhkan pemutar yang berjalan dan terhubung; tidak dapat meluncurkan aplikasi tertutup atau membangunkan perangkat offline. Browser atau TV tanpa fitur keluar aplikasi native melaporkan bahwa keluar tidak didukung. Siaga mempertahankan polling jarak jauh dan tidak menangguhkan pekerjaan host atau server bersama yang tidak terkait.

Setelah standby/go, periksa `ott d1 status` untuk status siaga/latar belakang dan verifikasi pemutaran berlanjut secara terpisah. Setelah pemutar dimuat ulang, pastikan runtime baru dengan `ott d1 doctor`. Setelah keluar, pastikan lewat OS bahwa proses aplikasi ditutup; timeout jarak jauh tidak membuktikan keluar. Penerimaan perintah saja tidak memastikan hasil ini.

<a id="local-proxy-server"></a>

## Server proxy lokal

`local_proxy.py` adalah antrean perintah mandiri terautentikasi untuk satu pemutar. Pemanggilan default keluar tanpa membuka port. Setiap instans proxy memakai kode perangkat yang dibuat pemutar; gunakan instans/port terpisah untuk beberapa pemutar. Parameter kueri `device_id` diterima sebagai metadata kompatibilitas dan tidak pernah mengautentikasi atau memilih perangkat lain.

<a id="start-the-proxy"></a>

### Memulai proxy

1. Aktifkan **Kendali HTTP lokal** pada pemutar dan salin **Kode perangkat**.
2. Pada host proxy, atur kode dan origin tepat yang menyajikan pemutar (skema, host, dan port, tanpa jalur):

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. Tetapkan **URL perintah lokal** pemutar ke `http://192.168.1.50:8081/api/webhook/commands`.

Alamat bind default adalah `127.0.0.1`; contoh secara eksplisit mengaktifkan LAN. `OTTPLAY_QUEUE_HTTP_ORIGINS` adalah daftar izin origin browser persis, dipisahkan koma. Gunakan reverse proxy HTTPS jika pemutar disajikan melalui HTTPS agar aturan konten campuran mengizinkan polling. Rahasiakan kode perangkat dan jangan masukkan ke URL. Ketika pemutar menghasilkan kode baru, restart proxy dengan nilai baru; menonaktifkan pemutar saja tidak menghentikan proses proxy yang dikelola terpisah.

<a id="endpoints"></a>

### Endpoint

| Metode | Jalur | Deskripsi |
|---|---|---|
| `POST` | `/api/webhook/commands` | Masukkan perintah ke antrean |
| `GET` | `/api/webhook/commands` | Ambil perintah antrean (polling pemutar) |
| `POST` | `/webhook/notify` | Alias kompatibilitas terautentikasi |
| `GET` | `/webhook/poll` | Alias kompatibilitas terautentikasi |

Mengirim dan menguras antrean sama-sama membutuhkan kode perangkat Bearer yang cocok. Tidak ada endpoint siaran tanpa autentikasi. Perintah kedaluwarsa setelah 60 detik; tiap proxy menyimpan paling banyak 50 perintah.

Proxy menangani hingga 16 koneksi bersamaan, sehingga koneksi browser yang diam atau permintaan tidak lengkap tidak menunda perintah lain. Setiap soket mempunyai timeout tidak aktif lima detik; koneksi tambahan ditutup saat semua worker sibuk. Penyisipan dan pengurasan antrean bersifat atomik antar-worker.

<a id="smoke-script-all-modes"></a>

### Skrip uji dasar (semua mode)

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Emulator/perangkat Android: jalankan `adb forward tcp:18081 tcp:18081` dahulu. Cap/Tauri hanya loopback — gunakan proxy Mode A ini untuk Home Assistant LAN. Detail: `docs/capacitor-mobile.md` § Smoke test.

<a id="cors"></a>

### CORS

Proxy hanya mengizinkan permintaan browser dari `OTTPLAY_QUEUE_HTTP_ORIGINS`. Preflight `OPTIONS` dari origin yang diizinkan tidak membutuhkan token; setiap GET/POST aktual membutuhkan kode Bearer. Origin wildcard dan `null` tidak diterima. Home Assistant dan pemanggil nonbrowser boleh menghilangkan Origin tetapi tetap membutuhkan autentikasi.

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### Contoh: webhook Home Assistant → proxy lokal → pemutar

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

### Contoh otomatisasi Home Assistant

Contoh popup, saluran, dan volume memakai proxy lokal. Tetapkan `ottplay_device_authorization` dalam `secrets.yaml` Home Assistant ke `Bearer <device-code>` menggunakan kode yang ditampilkan pemutar aktif.

Siaga malam memakai [server perintah](docs/remote-command-server.md) terpisah. Ganti URL contoh dan `DEVICE_UUID` di bawah dengan alamat pengontrol serta ID perangkat terdaftar; alias CLI lokal `d1` bukan ID perangkat. Tetapkan `ottplay_control_authorization` ke `Bearer <controller-admin-token>` dalam `secrets.yaml`. Kredensial ini berbeda dari kode perangkat proxy lokal. Lihat dokumentasi Home Assistant [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) dan [rahasia](https://www.home-assistant.io/docs/configuration/secrets/).

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

`standby_request` memuat respons HTTP untuk jejak otomatisasi. HTTP 202 hanya berarti masuk antrean: simpan `content.id`, lalu poll `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` dengan kredensial pengontrol yang sama untuk jawaban pemutar. Permintaan `status` baru mengamati `player.standby` dan `player.background`; siaga aktif dengan `suspended` serta nol tertunda memastikan pekerjaan pemutar yang dilacak sudah selesai. Untuk keluar dari siaga, gunakan permintaan bertipe yang sama dengan `"operation":"wake"` (`ott d1 go`). Jangan ulangi mutasi membabi buta setelah timeout. Lihat [API permintaan/respons](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) dan [semantik siaga](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake) pengontrol.

<a id="server-api-reference"></a>

## Referensi API server

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Endpoint webhook (Rust `ottplay-server`)

Server Rust dan fallback Python yang diarsipkan menolak endpoint perintah dengan HTTP 403. `/api/webhook/commands`, `/webhook/notify`, `/webhook/poll`, dan alias kesehatan perintah tidak mengantrekan, menyiarkan, atau menguras perintah. API umpan balik umum tidak dapat menggantikan rute yang dicadangkan ini. Pengiriman perintah Mode A memakai server perintah atau proxy lokal terautentikasi yang dikonfigurasi terpisah di atas.

<a id="other-endpoints"></a>

### Endpoint lainnya

| Metode | Jalur | Deskripsi |
|---|---|---|
| `GET` | `/epg/<hash>.json` | Data EPG saluran |
| `GET` | `/logo/<id>.svg` | Logo saluran yang dihasilkan |
| `GET` | `/version/<path>` | Hash versi berkas |
| `POST` | `/m3u/match-channels` | Pencocokan saluran dengan EPG |
| `POST` | `/m3u/match-logos` | Pencocokan logo saluran |
| `POST` | `/m3u/cp.php` | Proxy stream |
| `GET/POST` | `/feedback/` | Pencatatan umpan balik |
| `GET` | `/tmdb/*` | Proxy API TMDb |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## Struktur proyek

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

## Pemetaan tombol STB

- **Samsung Tizen**: `RETURN=10009`, `ENTER=13`, warna 403-406
- **Samsung Maple**: dpad 4/5/6/8, kode SDK asli
- **LG WebOS**: `RETURN=461`, warna kompatibel HbbTV
- **LG NetCast**: `RETURN=8`, kode HbbTV
- **MAG**: `RETURN=8`, API gSTB untuk MAC
- **Dune HD**: kode standar, API Dune
- **Android TV**: keycode Android (`BACK=4`, `DPAD_*` 19-22, `ENTER=66`)
- **HbbTV/Panasonic/Philips/Sony/dll.**: kode HbbTV (`RED=403`, `BLUE=406`, `VOL_UP=447`)

<a id="documentation"></a>

## Dokumentasi

- [Wiki dokumentasi](./docs/wiki/Home.id.md) / [Wiki bahasa Rusia](./docs/wiki/Home.ru.md) — navigasi berdasarkan tugas dan aturan pemeliharaan.
- [Laporan implementasi](./docs/implementation-report.id.md) / [Proses dan hasil dalam bahasa Rusia](./docs/implementation-report.ru.md) — diagram berwarna, perilaku terverifikasi, biaya terukur, dan gerbang rilis.
- [Panduan penyampaian](./docs/roadmap-delivery.id.md) / [Fitur baru dalam bahasa Rusia](./docs/roadmap-delivery.ru.md) — fitur, batasan, dan verifikasi.
- [Panduan cepat dalam 88 bahasa antarmuka](./docs/readme/README.md) — dihasilkan dari terjemahan UI yang dikirimkan; manual utama dan panduan fitur berpasangan tersedia dalam [24 bahasa dokumentasi](docs/manual-translations.md).
- [Batas kualitas dan pemulihan langsung](./docs/playback-stream-policy.id.md) / [Bahasa Rusia](./docs/playback-stream-policy.ru.md).
- [Pemetaan XMLTV manual dan aksesibilitas klasik](./docs/guide-binding-accessibility.id.md) / [Bahasa Rusia](./docs/guide-binding-accessibility.ru.md).
- [Pemeriksaan audio/video terhosting](./docs/audio-video-check.id.md) / [Bahasa Rusia](./docs/audio-video-check.ru.md).
- [Pustaka media Xtream](./docs/xtream-media.id.md) / [Bahasa Rusia](./docs/xtream-media.ru.md).
- [Penyerahan antarperangkat dengan sumber sama](./docs/remote-handoff.id.md) / [Bahasa Rusia](./docs/remote-handoff.ru.md).
- [Pengaturan lokal yang dapat dipulihkan](./docs/settings-recovery.id.md) / [Bahasa Rusia](./docs/settings-recovery.ru.md).
- [Generasi browser, sistem operasi, dan pemeriksaan kandidat rilis yang tepat](docs/browser-compatibility.id.md) / [Bahasa Rusia](docs/browser-compatibility.ru.md).

- [Arsitektur pemutar](./docs/architecture.md) — tanggung jawab runtime, integrasi penyedia, pemutaran, panduan, adaptor perangkat, dan kontrak build.
- [Pipeline build ES5 klasik](./docs/build-pipeline.md) — kompilasi, pemeriksaan kompatibilitas, dan batas ukuran artefak.
- [Nama aset runtime dan migrasi penerapan](./docs/asset-layout.md) — jalur deskriptif bersama untuk paket web dan native.
- [Meja kerja jarak jauh](./docs/remote-workbench.md) — inspeksi UI/media, bukti operasi, dan bukti tersimpan.
- [Diagnostik runtime](./docs/runtime-debug.md) — riwayat kesalahan, penghitung frame/loop, metrik native Capacitor/Tauri, dan debug server.
- [Penyampaian macOS lokal](./docs/macos-local-delivery.md) — build checkout, pemasangan lokal, dan verifikasi.

<a id="license"></a>

## Lisensi

[MIT](LICENSE) — bebas dan sumber terbuka. Konten penyedia dan dependensi pihak ketiga mempertahankan hak serta lisensinya sendiri.

Aplikasi terpisah [OTTPlay native webOS](docs/native-webos.md), yang diturunkan dari PlxNative, didistribusikan dengan lisensi **GPL-3.0-or-later** beserta kode sumber yang sesuai.
Lisensi MIT di direktori utama proyek tidak mengubah lisensi aplikasi native ini atau patch-nya.

<a id="desktop-updater--notarization-mode-b"></a>

## Pembaru desktop / notarisasi (Mode B)

[Panduan penandatanganan dan pembaru desktop](docs/tauri-updater-notarize.md) menjelaskan penandatanganan ad-hoc macOS, Developer ID/notarisasi opsional, dan verifikasi bundel. CI rilis memakai tanda tangan ad-hoc tanpa kredensial Apple. Tanda tangan pembaru terpisah; pembaruan otomatis produksi tetap belum dikonfigurasi.

<a id="local-mac-build-helpers"></a>

## Helper build Mac lokal

Lihat [docs/local-build-scripts.md](docs/local-build-scripts.md).

<a id="privacy"></a>

## Privasi

Baca [kebijakan privasi](docs/privacy-policy.md) untuk informasi pengaturan lokal, layanan terkonfigurasi, dan pilihan Anda. Kontak privasi dan dukungan: [alvit.work@gmail.com](mailto:alvit.work@gmail.com).

Studio 2026 adalah tema antarmuka default. Classic dan PLi-HD tetap dapat dipilih, serta preferensi tersimpan dipertahankan. Lihat [pengaturan antarmuka](docs/interface-settings.md). Tema PLi-HD memberi kredit kepada Vali, littlesat, VU+NL, Milo, dan kontributor upstream. Lihat [kredit antarmuka dan sejarah desain](docs/interface-history.md) untuk sejarah bahasa Inggris serta tautan sumber, juga tersedia dari menu informasi pemutar.

<a id="demo-video-editing"></a>

## Penyuntingan video demo

Gunakan [alur video-use](docs/demo-video.md) lokal untuk menyiapkan dan menyunting rekaman demonstrasi. Helper menjaga semua media hasil di luar Git.

<a id="plex-media-library"></a>

## Pustaka media Plex

Setiap pemutar dapat terhubung ke akun Plex atau Plex Media Server melalui penyedia **Plex**. Integrasi memakai Plex; Synology adalah salah satu host yang mungkin untuk server media. Semua video dan trek musik yang dapat diakses otomatis masuk ke daftar saluran; pilihan kategori menyaring berdasarkan pustaka, folder, atau serial. Pemutaran dimulai dari batch pertama yang dapat digunakan, dengan pemuatan latar belakang, pencarian standar, serta Tindakan acak/ulang, tanpa mengonfigurasi Plex pada server OTT. Lihat [login Plex dan pemutaran langsung](docs/plex-provider.md).

![Siklus pemuatan Plex, navigasi berkas, dan penutupan](docs/images/plex-playback-lifecycle.svg)

[Tinjauan keandalan bergambar](docs/plex-provider.md#reliability-review-process-and-results) menjelaskan aturan pemuatan dan pembatalan, perbaikan katalog lengkap dan pergantian berkas, serta hasil validasi Chromium/WebKit terukur.

<a id="related-repositories"></a>

## Repositori terkait

- [ottplay-core](https://github.com/open-ott-play/ottplay-core) memegang logika domain JVM/ES5 bersama, kontrak komunikasi, dan klien FOSS2. Pemutar ini memakai artefak hasil; ikuti panduan penyampaian inti untuk perubahan bersama.
- [ottplay-android](https://github.com/open-ott-play/ottplay-android) adalah aplikasi Kotlin/Compose native terpisah, dengan identitas pemasangan dan rilis sendiri.
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server) menyediakan perintah jarak jauh yang dihosting sendiri; [ottplay-swop](https://github.com/open-ott-play/ottplay-swop) menyediakan transport input teks berbasis Worker opsional.
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine) memegang profil terhosting demo browser, media demo, dan verifikasi publikasi.

<a id="project-maintenance"></a>

## Pemeliharaan proyek

Lihat [persyaratan kontribusi dan pengujian](CONTRIBUTING.md), [kebijakan pelaporan keamanan](SECURITY.md), [desain keamanan](docs/security-design.md), dan [bukti OpenSSF serta kriteria tersisa](docs/openssf-evidence.md).
