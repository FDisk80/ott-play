<a id="browser-generations-and-operating-systems"></a>

# Generasi browser dan sistem operasi

<!-- language-navigation:start -->
<p dir="ltr">
<a href="browser-compatibility.md" lang="en" dir="ltr">English</a> · <a href="browser-compatibility.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="browser-compatibility.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="browser-compatibility.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="browser-compatibility.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="browser-compatibility.es.md" lang="es" dir="ltr">Español</a> · <a href="browser-compatibility.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="browser-compatibility.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="browser-compatibility.he.md" lang="he" dir="rtl">עברית</a> · <a href="browser-compatibility.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="browser-compatibility.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="browser-compatibility.it.md" lang="it" dir="ltr">Italiano</a> · <a href="browser-compatibility.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="browser-compatibility.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="browser-compatibility.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="browser-compatibility.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="browser-compatibility.pt.md" lang="pt" dir="ltr">Português</a> · <a href="browser-compatibility.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="browser-compatibility.th.md" lang="th" dir="ltr">ไทย</a> · <a href="browser-compatibility.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="browser-compatibility.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="browser-compatibility.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="browser-compatibility.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="browser-compatibility.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[Hasil pengukuran](implementation-report.id.md#browser-gate-integration)

![Kualifikasi browser yang dikonfigurasi: 35 target, 166 eksekusi skenario](diagrams/browser-qualification.svg)

Pemeriksaan perangkat, media, ES5/worker lama, UI native, dan HLS native Apple yang sudah ada tetap wajib. Workflow TypeScript bersama juga menjalankan skenario Plex terhadap arsip Mode A terkemas yang persis sama: dua alur pemuatan/pemuatan ulang terlokalisasi, persistensi rasio aspek HLS.js dan Video.js saat media berganti atau dimuat ulang, serta akhir episode alami pada kiosk ketat dengan HLS.js. Skenario media menggunakan decoding nyata; semua skenario memakai DOM dan input nyata. Hanya data Plex dan sumber media yang berupa fixture lokal sintetis.

Fixture rasio aspek melakukan transmux pada transport stream H.264/AAC yang tersimpan di repositori menjadi varian fMP4 terpisah. Header inisialisasinya memakai merek `iso6` dan durasi movie/track nol, sesuai [RFC 8216 bagian 3.3](https://www.rfc-editor.org/rfc/rfc8216#section-3.3). Entri sampel AVC juga memakai bit cadangan wajib pada jumlah SPS dan konstanta bertanda `-1` di bidang akhir `pre_defined`. Ini memperbaiki sintaks kontainer dari muxer fixture yang dipatok. Kontrak fixture memeriksa header, menolak box rusak, dan membuktikan set parameter codec, ID track, skala waktu, serta byte fragmen media tidak berubah. Ini memvalidasi input sintetis; dengan sendirinya tidak membuktikan pemutaran browser atau menggantikan matriks RC lengkap.

Pull request mewajibkan Chromium, Firefox, dan WebKit terkini di Linux, Chromium di Windows, serta WebKit di macOS. Build nightly dan beta mewajibkan lima target ini. Kualifikasi RC mewajibkan seluruh 35 target yang ditetapkan: tiga generasi Playwright/browser dengan versi pasti di Linux, Windows, dan macOS, ditambah Chrome/Edge stabil terpasang di ketiganya serta Chrome/Edge beta di Linux. Dua target macOS WebKit historis (Playwright 1.62.1 dan 1.63.0) memakai `macos-15-intel`; bukti eksekusinya mencatat arsitektur proses sebenarnya dan menolak runner ARM. Diagnosis MSE langsung menemukan byte inisialisasi H.264 dan media yang sama selesai pada Intel dengan 1.63 serta ARM dengan 1.64, sedangkan WebKit lama di VM ARM macOS 15 macet sebelum `updateend`. Mengganti kontainer, menggunakan ManagedMediaSource, atau membuka jendela browser tidak mengatasinya. Kedua target ini tetap mewajibkan lima skenario pemutaran/UI asli. Pilihan runner ini bukan klaim untuk setiap perangkat macOS fisik atau Safari native. Regenerasi inventaris harus mempertahankan override runner yang telah ditinjau; kontrak profil menolak penghapusannya.

Ketiga generasi Linux WebKit secara eksplisit memakai runner x64 `ubuntu-26.04`. Perbandingan runtime resmi yang ditinjau mereproduksi kegagalan transisi kiosk ketat di Ubuntu 24.04, sementara kandidat yang sama dan lima skenario tanpa perubahan lulus empat kali berturut-turut di Ubuntu 26.04. Ini memilih runtime didukung yang konsisten tanpa mengganti pustaka multimedia satu per satu atau melonggarkan asersi pemutaran. Target browser Linux lain mempertahankan runner semula. Lihat [kualifikasi runtime Linux WebKit](linux-webkit-runtime.md) untuk sumber, artefak, hasil perbandingan, dan batasannya yang tepat. Matriks RC lengkap dan penerimaan paket native terpisah tetap wajib.

Versi produk yang diuji dicatat saat runtime. Playwright Firefox adalah build yang ditambalnya, bukan pernyataan tentang Firefox ESR native; WebKit bukan Safari. Matriks ini tidak menggantikan kualifikasi pada TV fisik atau shell native.

Inventaris lengkap memiliki **35 target platform: 32 mendukung HLS dan tiga target Windows WebKit khusus UI**. Tiga target terakhir tetap mewajibkan kedua alur pemuatan/pemuatan ulang terlokalisasi; build WebKit mereka tidak memiliki MediaSource maupun HLS native. Ini batasan yang dinyatakan, bukan cakupan pemutaran yang lulus. Tiga ID target persis ditinjau dalam `scripts/browser-compatibility-profile.cjs`. Probe kemampuan wajib memastikan batasan itu sebelum pengujian UI. Jika MSE (termasuk ManagedMediaSource) atau HLS native tersedia, gerbang gagal sampai profil ditingkatkan. Semua target lain mewajibkan dukungan MSE H.264 dan AAC serta kelima skenario tanpa perubahan; kehilangan kemampuan menyebabkan gagal, bukan memilih suite lebih kecil. Probe memuat pustaka HLS kandidat dan memeriksa backend yang dipilih default instans yang dipatok: MediaSource, lalu ManagedMediaSource, lalu WebKitMediaSource. Bukti mencantumkan backend dan versi HLS; perubahan default atau versi memerlukan peninjauan eksplisit kontrak probe.

Karena itu, RC lengkap mewajibkan **166 eksekusi skenario berhasil** (32 × 5 + 3 × 2), dengan 35 bukti target. Subset PR/nightly/beta tetap lima target dan 25 eksekusi. Setiap bukti mencatat set skenario yang tepat, probe kemampuan, dan cakupan HLS lulus atau alasan eksplisit tidak didukung. Ini persyaratan yang dikonfigurasi, bukan klaim bahwa RC tertentu sudah memenuhinya. Batasan dikonfirmasi oleh [konfigurasi build WebKit Windows](https://github.com/WebKit/WebKit/blob/56453fdfe0b0ca6258c23e6453b34f70b885d13f/Source/cmake/OptionsWin.cmake#L75) yang dipakai Playwright 1.64 dan probe runtime yang dipatok.

Kedua jalur mengunduh ID artefak persis dari job pembuat pada run saat ini. Checksum arsip, commit sumber, hash bundle/provider terkemas, tipe file, dan jalur diperiksa sebelum menyajikan direktori hasil ekstraksi baru. Pemeriksaan rilis juga memverifikasi bukti build yang dibekukan. Job browser tidak membangun ulang kode yang diuji dan hanya memasang dependensi produksi. Server uji tetap memerlukan inventaris provider lengkap dari sumber; compiler hanya dimuat ketika bundle benar-benar dibuat, bukan saat konstanta inventaris dibaca. Bukti skenario gagal, dilewati, kedaluwarsa, atau hilang menggagalkan gerbang bersama; trace, identitas runtime sebenarnya, dan digest kandidat disimpan untuk setiap target.

Tujuh file inventaris/lock yang dihasilkan berasal dari `venus-os-ci-toolkit/scripts/prepare_browser_compatibility.py`. Paket aplikasi dan paket browser historis memakai lockfile terpisah. Runner GitHub-hosted tetap menjadi default; workflow bersama mempertahankan opsi cadangan Linux yang telah disiapkan, sedangkan target Windows/macOS memerlukan OS native masing-masing.

Putusan rilis bersama memverifikasi setiap target terpilih beserta SHA sumber, run, percobaan, kanal, dan ID artefak kandidat yang tepat. RC tidak boleh memakai bukti beta lima target. Promosi stable menggunakan byte RC yang diterima. Jalankan ulang seluruh workflow kualifikasi setelah gagal; bukti percobaan lama tidak boleh melengkapi kualifikasi baru.

## Diagnostik akhir eksekusi

Setelah metadata runtime dan kandidat dimuat, `scripts/browser-acceptance.cjs` menulis `acceptance-terminal.json` di `CI_BROWSER_DIAGNOSTICS` saat proses penerimaan selesai atau melempar pengecualian. Catatan ini memuat fase terakhir, identitas sumber dan kandidat, target browser, run dan percobaan, waktu yang berlalu, serta status keluar proses uji, sinyal, atau kode kesalahan yang diizinkan. Ukurannya kurang dari 2 KiB dan tidak memuat kesalahan mentah, URL, stdout/stderr, nilai lingkungan, atau dump memori. Catatan dibuat dengan akses eksklusif dan mode `0600` di direktori keluaran milik job yang sudah ada; file yang sudah ada atau tautan simbolis pada komponen terakhir jalur tidak ditimpa.

Ini adalah **bukti diagnostik, bukan penerimaan yang berhasil**. Catatan selalu menyatakan `acceptance: false`; hanya file terpisah `CI_BROWSER_EVIDENCE` yang dapat meluluskan kandidat setelah semua asersi yang ada berhasil. Kegagalan penulisan diagnostik tidak dapat menggantikan keberhasilan atau kegagalan semula. Penghentian mendadak program pembungkus, atau kegagalan memuat metadata sebelum program itu mulai, dapat menyebabkan tidak adanya catatan. Sinyal pada proses uji bukan bukti bahwa proses konten Firefox menerima sinyal tersebut. Penentuan penyebab crash native tetap memerlukan jejak stack native yang sesuai atau kasus reproduksi yang terkontrol; percobaan ulang yang berhasil tidak menutup penyelidikan.

Alat bantu ini tidak mengaktifkan laporan crash mentah Firefox ataupun pencatatan `DEBUG=pw:browser`. Memori browser dan keluaran konsol dapat berisi data sensitif dan tidak boleh disalin ke artefak unggahan biasa tanpa kebijakan pengumpulan dan akses yang ditinjau secara terpisah. Urutan skenario, versi browser yang dipatok, penggunaan satu worker, nol percobaan ulang, dan batas waktu yang ada tetap tidak berubah.

<a id="from-source-to-accepted-candidate"></a>

## Dari sumber hingga kandidat diterima

![Sumber, verifikasi paket, pemeriksaan kemampuan, dan bukti](diagrams/candidate-verification-flow.svg)

1. Bangun sumber yang ditinjau dan kemas file Mode A hasilnya. Simpan checksum arsip dan identitas sumber bersama kandidat.
2. Sebelum ekstraksi, verifikasi batas ukuran arsip, jalur aman, tipe file, sumber/versi, serta inventaris hash entri/provider lengkap. Kualifikasi rilis juga memeriksa bukti build yang dibekukan.
3. Periksa versi browser sebenarnya dan kemampuan media. Pilih profil yang dinyatakan; ketidakcocokan kemampuan menyebabkan gagal, bukan mengurangi cakupan diam-diam.
4. Jalankan set skenario persis pada file hasil ekstraksi tanpa membangun ulang. Wajibkan setiap skenario tepat sekali, tanpa dilewati, gagal, atau dicoba ulang.
5. Simpan runtime, kemampuan, digest kandidat, dan hasil skenario. Gerbang bersama memeriksa target wajib dan kecocokan run/percobaan/sumber sebelum menerima bukti. Koordinasi rilis dan penerimaan perangkat tetap syarat terpisah.

<a id="what-has-been-measured-locally"></a>

## Yang sudah diukur secara lokal

![Verifikasi integrasi lokal: suite perangkat dan browser terkemas yang terpisah](diagrams/browser-verification-results.svg)

Pada sumber `c52f4d07`, pengujian perangkat-browser Chromium lengkap lulus 196 tes dengan satu pengabaian HLS native yang diharapkan. Secara terpisah, arsip Mode A terkemas yang sama lulus lima skenario pada masing-masing Chromium 156.0.8078.4, Firefox 157.0, dan WebKit 27.2: 15 lulus, tanpa dilewati atau dicoba ulang. Itu suite berbeda; jumlahnya bukan persentase cakupan atau bukti bahwa seluruh 35 target hosted lulus.

[Bukti tersimpan](evidence/post779-local-acceptance/summary.json) mengidentifikasi host macOS 26.7.1 sebenarnya. Bukti itu secara eksplisit membedakannya dari label profil `macos-15` dan tidak mengkualifikasi rilis. Untuk mengulang pemeriksaan lokal di Mac, pasang dependensi terkunci dan browser Playwright 1.64.0, bangun sumber terkini, lalu jalankan [resep tersimpan](evidence/post779-local-acceptance/reproduce.sh) dengan direktori repositori sebagai argumen. Resep mengemas build yang ada, memeriksa kandidat, melakukan probe setiap browser, dan menyimpan bukti baru di `.compatibility/`. Port 4189 diperlukan dan direktori `browser-candidate-web` yang sudah ada tidak akan ditimpa. Jangan mengubah sumber antara membangun dan menjalankan resep. Hasil CI hosted dan perangkat fisik dilacak terpisah dalam [laporan implementasi](implementation-report.id.md).
