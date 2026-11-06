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

Tệp cục bộ không cần Internet: xem [Video cục bộ và phát ngoại tuyến](docs/offline-media.md).

[![Danh sách kênh OTT-play FOSS ở góc nhìn phối cảnh](docs/images/hero.png)](docs/images/studio-2026-default.png)

*Ảnh chụp giao diện Studio 2026 hiện có, với dữ liệu kênh và chương trình tổng hợp.
Mở ảnh để xem bản phẳng gốc; đây không phải ảnh chụp một thuê bao đang hoạt động.
[Nguồn ảnh và cách tạo lại](docs/images/README.md).*

[Hướng dẫn nhanh bằng 88 ngôn ngữ](docs/readme/README.md) · [Wiki tài liệu](docs/wiki/Home.vi.md)

[![Thực hành tốt nhất OpenSSF](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![Fuzzing: chỉ RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

Các bản ứng viên phát hành công khai chạy chiến dịch fuzzing có giới hạn và cách ly để kiểm tra phân tích XMLTV gốc/phía máy chủ và xác thực yêu cầu cổng. Xem [phạm vi fuzzing, cách tái hiện và bằng chứng phát hành](FUZZING.md).

Trình phát IPTV/OTT độc lập với máy chủ HTTP Rust cục bộ. Chạy trên Smart TV (LG WebOS, Samsung Tizen, Panasonic, Sony, v.v.), hộp giải mã (Infomir MAG, Dune HD, Enigma2, Android TV) và trình duyệt máy tính.

Bắt đầu với [hướng dẫn kiến trúc và đóng góp](docs/architecture.md) để hiểu các lớp thực thi, trách nhiệm, cách mở rộng nhà cung cấp và xác minh. Xem [phiên phát và vòng đời nhà cung cấp](docs/playback-session-architecture.md) về ranh giới lõi/môi trường chủ và các hợp đồng tương thích.

<!-- ci-release-process:start -->
<a id="release-process"></a>

## Quy trình phát hành

Xem [chiến lược phát hành](RELEASING.md) về quy tắc xác minh và nâng cấp nightly, beta, RC, ổn định; xem [sổ tay vận hành](docs/release-workflow.md) về lệnh cục bộ.
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## Chạy trong trình duyệt

Mở [bản demo trực tiếp](https://player.ottplay.here.now/) hoặc biên dịch và phục vụ trình phát web theo hướng dẫn bên dưới.

[Triển khai macOS cục bộ](docs/local-http-deployment.md) cung cấp các origin HTTP của trình phát trên cổng 8443–8446. Cổng 8095 đã ngừng sử dụng.

Trong lần mở đầu, chọn **Thử demo** để phát hình kiểm tra chuyển động hoặc cấu hình danh sách M3U hay nhà cung cấp của bạn. Sau đó vẫn có thể mở demo từ **Đổi nhà cung cấp → Demo**.

Chế độ demo cần Internet nhưng không cần tài khoản nhà cung cấp. Các kênh thử MP4 và HLS không tiếng được lưu trên here.now và dùng chung bởi trình phát web, Tauri, Capacitor và OTT Server. Việc chuyển đổi giữ nguyên cấu hình nhà cung cấp đã có. Để **kiểm tra hình và tiếng** riêng, mở **Thông tin → Âm thanh → Phát** trên bộ máy HTML5 được quản lý khi đang rảnh hoặc xem TV trực tiếp. Thao tác này dùng tệp thử có âm thanh `av-v1.mp4` trên here.now và cần Internet. Đoạn phim không nằm trong gói trình phát và không bao giờ được tải khi khởi động. VOD, kho lưu trữ và các bộ máy được ghi đè theo thiết bị (gồm PC2/Video.js và bộ máy gốc) không thuộc phạm vi; xem [các bước, âm báo dự kiến và sơ đồ lưu trữ](docs/audio-video-check.vi.md).

Cửa sổ trình duyệt máy tính đã cài đặt hỗ trợ **Window Controls Overlay**: Chrome có thể ẩn thanh tiêu đề riêng nhưng vẫn giữ nút cửa sổ và menu ứng dụng phía trên trình phát. Mở ứng dụng đã cài và chọn **Ẩn thanh tiêu đề** khi Chrome đề nghị; **Hiện thanh tiêu đề** khôi phục khung thông thường. Tab thường và bố cục TV/vỏ ứng dụng gốc giữ nguyên hành vi. Xem [điều khiển cửa sổ trình duyệt](docs/browser-window-controls.md) về URL cài đặt được hỗ trợ, cập nhật lối tắt hiện có và xác minh.

Để tua mười giây trong chế độ xem video chính, dùng **Alt/Option + Trái/Phải** (**Command + Trái/Phải** cũng hoạt động trên macOS), ở toàn màn hình hoặc chế độ thường. Video cục bộ, VOD và kho lưu trữ kênh được hỗ trợ dùng cùng cách điều khiển trên web, Tauri và Capacitor. Xem [phím tắt và giới hạn](docs/browser-window-controls.md#playback-keyboard-shortcuts).

Trong giao diện PC, **R** phát ngẫu nhiên một kênh hoặc video khác trong danh sách hiện tại mà không đảo thứ tự danh sách. Hoạt động ở màn hình video chính và danh sách kênh/video; ô nhập văn bản, hộp thoại, cài đặt và giới hạn kiosk vẫn được ưu tiên. Ánh xạ phím của các thiết bị khác không đổi.

Có thể tạo lại hình thử tổng hợp bằng `scripts/generate-demo-media.sh` (cần FFmpeg); nội dung được tạo nằm trong thư mục `.local-artifacts` được Git bỏ qua.

<a id="features"></a>

## Tính năng

- **Phát**: HLS, DASH và luồng HTTP thường, với trần chất lượng HLS.js/Shaka được quản lý, khôi phục có giới hạn và tối đa ba URL dự phòng chỉ định rõ cho mỗi kênh trực tiếp. Kho lưu trữ/VOD không bao giờ chuyển sang dự phòng trực tiếp; xem [chất lượng và khôi phục](docs/playback-stream-policy.vi.md).
- **EPG**: khớp XMLTV, dịch thời gian/xem lại, tìm theo tên chương trình (N5 trong EPG), nhắc nhở và gán nguồn/ID thủ công cho một kênh chính xác trong đường XMLTV được lưu trữ/gốc. Xem [gán liên kết và khả năng tiếp cận](docs/guide-binding-accessibility.vi.md).
- **Yêu thích**: một [bộ sưu tập hỗn hợp](docs/mixed-favorites.md) có thứ tự giữa các nhà cung cấp và hồ sơ đã cấu hình trên thiết bị được hỗ trợ, với xuất/nhập có thể chuyển sang thiết bị khác qua CLI; PIN phụ huynh. Danh sách yêu thích theo nguồn vẫn có trong chế độ dự phòng.
- **Cài đặt**: xuất/nhập JSON cài đặt và mục yêu thích, nhật ký hoàn tác cho các lô localStorage được hỗ trợ, tiếp tục kho lưu trữ theo nguồn và so sánh chính xác cài đặt đã lưu cho quy trình bộ điều khiển. Khôi phục giả định chỉ một bên ghi; bộ chuyển đổi lưu trữ tùy chỉnh vẫn hoàn tác theo khả năng. Xem [khôi phục cài đặt](docs/settings-recovery.vi.md).
- **Giao diện chung**: OTT Server, Tauri và Capacitor dùng cùng chủ đề danh sách kênh và cài đặt hiển thị. Tính năng [Màu giao diện](docs/interface-colors.md) cung cấp chín vai trò màu sắc, bảng màu, khả năng nhập chính xác giá trị HEX/RGB/HSV và năm bộ phối màu, với thiết lập được lưu riêng cho máy khách; cài đặt danh sách kiểm soát tên kênh, picon, chương trình hiện tại, tiến độ và dấu kho lưu trữ.
- **Nhà cung cấp**: M3U/M3U8, TV trực tiếp Xtream cùng [danh mục phim/phim bộ theo yêu cầu](docs/xtream-media.vi.md), Stalker/Ministra với [phim và các tập trong thư mục lồng nhau](docs/stalker-media.md), Plex và VPortal. Khả năng nhà cung cấp và quyền tài khoản quyết định các chức năng kho lưu trữ, thư viện nội dung khả dụng.
- **Lệnh push**: điều khiển qua webhook — đổi kênh, nhà cung cấp, danh sách, hiện thông báo bật lên
- **Nhập văn bản từ xa (swop)**: bàn phím điện thoại qua Cloudflare Worker khi TV và điện thoại ở mạng khác nhau (phiên được cấp quyền theo cài đặt; ♥™ trên bàn phím ảo)
- **Định tuyến theo thiết bị**: địa chỉ UUID cho cấu hình nhiều thiết bị
- **Proxy cục bộ**: máy chủ lệnh cục bộ tùy chọn cho tự động hóa hoàn toàn cục bộ (không cần máy chủ trung tâm)
- **Tích hợp bộ điều khiển**: người vận hành có phạm vi thiết bị/hành động, kết quả lệnh bền vững tùy chọn, áp dụng cấu hình Local/Home có thể tiếp tục và chuyển tiếp trực tiếp/kho lưu trữ cùng nguồn qua [máy chủ điều khiển](https://github.com/open-ott-play/ottplay-control-server) tương ứng. Cần bộ điều khiển/CLI đã cập nhật; một tab trình duyệt độc lập không cung cấp các chức năng này.
- **Tùy chọn từ xa có kiểu dữ liệu**: khám phá cài đặt, đọc giá trị đã lưu và có hiệu lực, rồi lưu sau khi kiểm tra phiên chạy, nguồn và phiên bản sửa đổi; xem [cài đặt từ xa và cấu hình VPortal](docs/remote-player-settings.md).
- **Gỡ lỗi**: HUD phát/nhật ký vòng được bật tùy chọn qua `?debug=1`, kiểm tra từ xa có đồng ý và kiểm tra âm thanh/video lưu trữ theo yêu cầu
- **Tiếp cận bằng bàn phím**: hộp thoại cổ điển có tên, giữ và trả lại tiêu điểm Tab, ngữ nghĩa kênh được chọn và thông báo trạng thái không ngắt quãng. Các cải tiến không khẳng định tuân thủ đầy đủ WCAG hay trình đọc màn hình thiết bị.
- **24 loại thiết bị**: ánh xạ phím điều khiển theo thiết bị
- **88 ngôn ngữ giao diện**: danh mục tương ứng, [hướng dẫn nhanh bản địa hóa](docs/readme/README.md) và [bảng chữ cái bàn phím được kiểm tra bằng CLDR](docs/localization.md). Sổ tay chính và các hướng dẫn tính năng theo cặp có [24 ngôn ngữ tài liệu](docs/manual-translations.md); các tài liệu kỹ thuật khác giữ nguyên ngôn ngữ hiện có.

[Hướng dẫn bàn giao](docs/roadmap-delivery.vi.md) mô tả các tính năng thực hiện trong bản nguồn này, ranh giới nền tảng, sơ đồ và xác minh. Bản phát hành đã cài hoặc triển khai lưu trữ có thể dùng bản nguồn cũ hơn. [Ứng dụng Android](https://github.com/open-ott-play/ottplay-android) gốc độc lập cũng giữ lựa chọn âm thanh/phụ đề theo ngôn ngữ, vai trò và nhãn thay vì chỉ số manifest; triển khai và phát hành của nó tách biệt frontend này.

[Bài đánh giá mã nguồn STB](docs/stb-player-improvements.md) giải thích các cải tiến về nội dung, sử dụng tài nguyên và khôi phục, cùng các so sánh mã nguồn và giới hạn hiện tại.

<a id="debug-hud"></a>

## HUD gỡ lỗi

HUD cục bộ và lưu nhật ký máy chủ lâu dài được bật riêng. Xem [truy cập chẩn đoán, che dữ liệu và thời hạn lưu](docs/diagnostic-security.md) trước khi thu thập nhật ký thiết bị khác.

Bật chế độ gỡ lỗi bằng một trong các cách:
- URL: `?debug=1` hoặc `?debug=true`
- Lưu trữ cục bộ: `localStorage.setItem("ottplay_debug", "1")`
- Thuộc tính cửa sổ: `window.__OTT_DEBUG__ = true`
- Máy chủ: khi `/debug/config` trả về `{enabled: true}`

Khi đã bật gỡ lỗi:
- Nhấn **D** để bật/tắt dải HUD trên màn hình (`ottDebugSetHud` / `__ottDebug.toggleHud()`)
  - Bỏ qua khi tiêu điểm nằm trong INPUT/TEXTAREA/listEdit
  - Dùng `e.key` để tránh xung đột MAG/Maple PLAY/PREV=68
- Menu thông tin → **HUD gỡ lỗi** → gọi `__ottDebug.toggleHud()`
- Quản lý cài đặt → **HUD gỡ lỗi**:
  - Nếu gỡ lỗi đã tải: đổi trạng thái hiển thị HUD
  - Nếu chưa: đặt `ottplay_debug=1` + `ottplay_debug_hud=1` và đề nghị khởi động lại
- Lưu trữ: `ottDebugSetHud` lưu trạng thái HUD vào `localStorage.ottplay_debug_hud` ("1"/"0")

<a id="capacitor-ios-and-android"></a>

## Capacitor cho iOS và Android

Kho này đóng gói frontend TypeScript dùng chung bằng Capacitor cho iOS và Android 7+. Cả hai dùng phông hệ thống và runtime gốc được khóa bằng npm. Một APK tương thích API 22 riêng hỗ trợ Android 5.1/6 với WebView 60 trở lên. Cả hai APK Android đều được ký và kèm trong các bản beta, RC, ổn định đủ điều kiện, cùng IPA iOS chưa ký. Ứng dụng Kotlin độc lập vẫn ở [ottplay-android](https://github.com/open-ott-play/ottplay-android).

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

Xem [cấu hình Capacitor](docs/capacitor-mobile.md) và [phân phối Android, cập nhật từ xa](docs/android-distributions.md).

Giao diện iOS sử dụng hướng ngang. Cài đặt, cấu hình nhà cung cấp, đồng ý điều khiển từ xa và nhập/xuất JSON tiếp tục dùng frontend chung. Đa nhiệm máy tính bảng có thể thay hướng được yêu cầu.

Trên iPhone, vuốt dọc danh sách kênh để di chuyển qua các hàng và trang; vuốt lên đến kênh sau, xuống đến kênh trước. Vuốt nhanh tiếp tục qua nhiều trang rồi chậm dần đến dừng; kéo chậm vẫn chính xác. Chạm màn hình hoặc nhấn phím điều hướng để dừng chuyển động. Một lần chạm phát kênh dưới ngón tay ngay cả khi đang chọn hàng khác. Vuốt không bao giờ mở kênh khi nhấc ngón tay.

Video phát ngay trong giao diện iPhone. Chạm cuối màn hình để xem thông tin chương trình hoặc mở menu trong khi video tiếp tục. Hình trong hình vẫn là tùy chọn phát riêng.

Kiểm tra cơ bản thiết bị: [danh sách kiểm tra Chế độ B](docs/mode-b-device-smoke.md) và `./scripts/smoke-capacitor-device.sh --help` (đích build/sync chỉ iOS). Kiểm tra Tauri desktop: [danh sách kiểm tra máy tính](docs/mode-b-tauri-smoke.md).

<a id="installation"></a>

## Cài đặt

| Nền tảng | Gói | Ghi chú |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Bản Apple Silicon và Intel riêng; ký ad-hoc nếu chưa cấu hình ký Apple |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | Nhiều bản phân phối |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode hoặc Homebrew Channel](docs/lg-webos-installation.md); trình phát được lưu trên máy chủ, cần kết nối mạng |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode và ký cục bộ; gói TV chưa ký, tách biệt với Family Hub](docs/samsung-tizen-installation.md) |
| **iOS** | `.ipa` qua AltStore / TestFlight / Xcode | Chỉ cài ngoài — chưa có trên App Store |
| **Android (frontend chung)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | Gói Capacitor có chữ ký; chọn phiên bản Android được hỗ trợ |
| **Android (Kotlin gốc)** | [Ứng dụng gốc](https://github.com/open-ott-play/ottplay-android) riêng | Kho công khai; ứng dụng và quy trình phát hành riêng |

Bộ cài được hỗ trợ đính kèm các bản GitHub đủ điều kiện: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **Lưu ý:** gói ứng dụng macOS dùng ký ad-hoc khi thiếu thông tin ký Apple; điều này không cung cấp Developer ID hay công chứng. Bộ cài Windows/Linux và gói phát hành iOS có thể chưa ký. iOS cần ký trước khi cài trên thiết bị vật lý. APK Android Full và API 22 đủ điều kiện dùng chứng chỉ ký đã xác lập; bản phát hành build cục bộ cần keystore được cấu hình để tạo APK đã ký.

---

<a id="macos"></a>

### macOS

1. Chọn đúng tag từ [Bản phát hành](https://github.com/open-ott-play/ottplay-foss/releases). Lối tắt bản mới nhất chọn ổn định, không phải beta hay RC.
2. Tải `OttPlay.FOSS_*_aarch64-apple-darwin.dmg` cho Apple Silicon hoặc `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` cho Intel. Đây là các bản kiến trúc riêng.
3. Mở `.dmg` và kéo **OttPlay FOSS.app** vào Applications.
4. Xác minh gói đã sao chép trước lần mở đầu:

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

Xác minh thành công kiểm tra tính toàn vẹn của gói. `Signature=adhoc` nghĩa là ứng dụng không có danh tính nhà phát triển được Apple xác thực; không chứng minh công chứng hay Gatekeeper chấp thuận. Với tải xuống đáng tin và gói hợp lệ, macOS vẫn có thể yêu cầu **Cài đặt hệ thống → Quyền riêng tư & Bảo mật → Vẫn mở** sau lần thử đầu; xem [hướng dẫn Apple](https://support.apple.com/en-us/102445).

Thông báo “ứng dụng bị hỏng” không chỉ ra chắc chắn rằng nguyên nhân chỉ là cách ly. Nếu kiểm tra chữ ký thất bại, giữ lại lỗi và lấy bản phát hành đã sửa. Không ký lại ứng dụng đã tải hoặc xóa thuộc tính để biến lần kiểm tra thất bại thành có vẻ thành công.

Các lựa chọn ZIP là `OttPlay.FOSS_aarch64-apple-darwin.app.zip` và `OttPlay.FOSS_x86_64-apple-darwin.app.zip`. Xem [ký macOS và kiểm tra tệp phát hành](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact) về giải nén, ảnh đĩa và Gatekeeper. Với build từ checkout và cài cục bộ, dùng [bàn giao macOS cục bộ](docs/macos-local-delivery.md).

---

<a id="windows"></a>

### Windows

1. Tải `.msi` hoặc `.exe` từ [Bản phát hành](https://github.com/open-ott-play/ottplay-foss/releases/latest)
2. Chạy bộ cài và làm theo chỉ dẫn
3. Mở từ menu Start hoặc lối tắt Desktop

---

<a id="linux"></a>

### Linux

Phát trên Linux cần plugin GStreamer HLS, H.264 và AAC ngoài WebKitGTK. Các gói khai báo những phụ thuộc nội dung này; bản AppImage kèm khung xử lý nội dung. Xem [đóng gói nội dung Linux](docs/linux-media-packaging.md) về kiểm tra codec và sự khác nhau giữa nghiệm thu trình duyệt với ứng dụng gốc.

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

### Cài đặt iOS

iOS cần ký trước khi cài trên thiết bị vật lý. Dùng AltStore Classic cho IPA phát hành chưa ký hoặc build và ký từ nguồn bằng Xcode. TestFlight cần lời mời riêng khi được cung cấp.

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### Lựa chọn 1: AltStore Classic (khuyên dùng cá nhân)

AltServer chạy trên máy tính; AltStore Classic chạy trên iPhone/iPad và nhập IPA. Tài khoản Apple miễn phí là đủ.

**Điều kiện:**

- iPhone/iPad chạy **iOS/iPadOS 15 trở lên** cho bản OTT-play hiện tại.
- Mac hoặc máy Windows có AltServer và cáp dữ liệu USB.
- Tài khoản Apple để ký và Internet để tải bản phát hành.

**Bước 1: thiết lập AltStore một lần**

1. Cài AltServer theo [thiết lập macOS](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) hoặc [thiết lập Windows](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows) chính thức. Chạy nó và dùng biểu tượng thanh menu/khay hệ thống.
2. Nối thiết bị bằng USB, mở khóa và chấp nhận yêu cầu tin cậy máy tính/thiết bị. Trên Mac, kiểm tra thiết bị xuất hiện trong Finder.
3. Trong **menu AltServer → Install AltStore**, chọn thiết bị và hoàn tất yêu cầu tài khoản ký. Đợi thông báo cài đặt.
4. Trên thiết bị, mở **Cài đặt → Cài đặt chung → VPN & Quản lý thiết bị** và tin cậy mục nhà phát triển của tài khoản ký nếu được hỏi. Trên iOS 16+, bật **Cài đặt → Quyền riêng tư & Bảo mật → Chế độ nhà phát triển**, hoàn tất khởi động lại và xác nhận.
5. Mở AltStore trên thiết bị. Nếu đã cài và hoạt động, bỏ qua thiết lập này và giữ AltServer chạy để nhập bên dưới.

**Bước 2: nhập bản phát hành đã chọn trên iPhone/iPad**

1. Chọn tag chính xác từ [tất cả bản phát hành](https://github.com/open-ott-play/ottplay-foss/releases) và tải `ottplay-foss-ios-unsigned.ipa` của nó bằng Safari trên thiết bị. [Lối tắt bản mới nhất](https://github.com/open-ott-play/ottplay-foss/releases/latest) chọn ổn định; dùng danh sách đầy đủ nếu muốn beta.
2. Lưu IPA vào Tệp. Trong **AltStore → My Apps → +**, chọn tệp đó. Cũng có thể chuyển IPA đã tải từ Mac bằng AirDrop và lưu vào Tệp trước khi nhập. Mở IPA trên Mac không thực hiện bước nhập này.
3. Giữ AltServer chạy và cáp USB kết nối trong lúc AltStore ký, cài ứng dụng. Khi cập nhật, dùng cùng tài khoản ký với bản cài hiện tại; đừng xóa ứng dụng như bước xử lý sự cố đầu tiên.
4. Đợi nhập xong, kiểm tra OTT-play trong **My Apps** rồi mở.

**Cách khác: nhập trực tiếp URL bản phát hành**

Khi AltStore đã cài, nhập mẫu này vào **Safari trên iPhone**, thay `TAG` bằng tag phát hành chính xác và chấp nhận **Mở trong AltStore**:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

Cách này dùng [bộ xử lý URL cài đặt](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift) của AltStore. Nó tránh mục Tệp/Gần đây mơ hồ khi nhiều lần tải cùng tên. URL phải trỏ đến tệp IPA, không phải trang phát hành.

Ví dụ, lần nhập sau được xác minh ngày **2026-09-29** với AltStore 2.3 và AltServer 1.8.1. Đây là ví dụ lịch sử cố định, không phải liên kết bản mới nhất:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**Gia hạn:** bản cài tài khoản miễn phí hết hạn sau bảy ngày. Giữ AltServer truy cập được và dùng **AltStore → My Apps → Refresh All** trước khi hết hạn. Gia hạn nền cũng cần AltServer; xem [hướng dẫn gia hạn AltStore](https://faq.altstore.io/altstore-classic/your-altstore).

<a id="verify-the-installed-version-before-retrying"></a>

#### Xác minh phiên bản đã cài trước khi thử lại

Thông báo AirDrop “Đã gửi” chỉ xác nhận truyền tệp. Thanh tiến độ AltStore xác nhận việc nhập đã bắt đầu. Mất kết nối Phản chiếu/USB không chứng minh cài đặt thất bại: kiểm tra ứng dụng đã cài trước khi gửi IPA lần nữa.

Trên Mac có Xcode được cài và chọn làm thư mục nhà phát triển hiện hành, kiểm tra thiết bị mà không cài lại:

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

Trong `result.apps` của JSON, tìm OTT-play (`bundleIdentifier` bắt đầu bằng `play.ott.foss`) rồi so sánh cả `version` lẫn `bundleVersion` với `CFBundleShortVersionString` và `CFBundleVersion` của IPA đã chọn. Hậu tố tài khoản ký AltStore ở mã gói là bình thường. Giữ báo cáo thiết bị cục bộ.

Ví dụ beta.9 đã xác minh báo **phiên bản `1.1.51`, build `2.2.66`**. Điều này xác nhận cài đặt; mở ứng dụng, đăng nhập Cloudflare, tải danh sách, phát và PiP là những kiểm tra thiết bị riêng.

<a id="troubleshooting-ios-installation"></a>

#### Khắc phục sự cố cài iOS

- **AltServer không có cửa sổ hoặc mở bằng tự động hóa bị hết thời gian:** dùng biểu tượng thanh menu/khay hệ thống. Nó là ứng dụng nền. Liên tục thử mở cửa sổ thông thường không nhập IPA.
- **“Could not find AltServer” hoặc không có thiết bị USB:** kiểm tra AltServer đang chạy, mở khóa điện thoại và kiểm tra yêu cầu tin cậy máy tính/thiết bị. Trên Mac kiểm tra Finder. Nếu kết nối rớt, nối lại khi an toàn rồi kiểm tra bản đã cài trước khi thử lại. Nếu vẫn lỗi, theo [khắc phục kết nối AltStore](https://faq.altstore.io/altstore-classic/troubleshooting-guide). Nếu điện thoại cấp Internet cho máy tính, phối hợp mọi thay đổi cáp/mạng để không gián đoạn việc khác.
- **Phản chiếu iPhone báo “iPhone in Use” hoặc dừng ở “Connecting”:** dùng điện thoại thật để hoàn tất thiết lập, hoặc khóa màn hình và để gần Mac đã mở khóa để phản chiếu. Mở khóa điện thoại chấm dứt Phản chiếu; tin cậy/thiết lập USB có thể cần mở khóa trước. Nếu một lần kết nối lại vẫn kẹt, thoát Phản chiếu và tiếp tục trên điện thoại. Xem [yêu cầu Phản chiếu Apple](https://support.apple.com/en-us/120421). Phản chiếu là tùy chọn cho cài đặt.
- **URL mất chữ Latin hoặc thành Cyrillic trong Phản chiếu:** chuyển **nguồn nhập Mac sang ABC/English**. Khi Phản chiếu có tiêu điểm, nhấn **Control–Space** rồi chọn **English (US)** cho bàn phím phần cứng iPhone. Nguồn nhập Mac và iPhone có thể khác nhau; chỉ đổi Mac là chưa đủ trong phiên đã xác minh của chúng tôi. Xóa ô, nhập lại URL và kiểm tra trước khi gửi.
- **Dán clipboard vào Phản chiếu bị treo hoặc chèn văn bản lạ:** xóa ô và nhập chậm từng đoạn ngắn với nguồn English (US) của iPhone, hoặc nhập URL ngay trên điện thoại. Nhập nhanh qua Phản chiếu có thể mất hoặc lặp ký tự; xác minh đầy đủ địa chỉ trước khi lưu. Không gửi URL mới dán một phần. Dán đã lỗi trong phiên cài của chúng tôi; nó không bắt buộc cho cách URL trực tiếp.
- **Tệp/Gần đây hiện nhiều IPA cùng tên:** chọn vị trí tải chính xác hoặc dùng URL trực tiếp có tag ở trên. Có thể đổi tên bản sao cục bộ để kèm tag/build cho dễ phân biệt; đổi tên không đổi nội dung.
- **Ứng dụng đã cài không mở:** làm theo yêu cầu tin cậy nhà phát triển hoặc Chế độ nhà phát triển trên điện thoại. Kiểm tra hết hạn trong AltStore và gia hạn nếu cần. Ghi lỗi thực tế nếu vẫn thất bại; riêng lỗi kết nối không phải lý do xóa và cài lại.
- **OTT-play mở nhưng danh sách được bảo vệ thất bại trên mạng di động:** cài đặt và xác thực nguồn tách biệt. Dùng **Cài đặt → Quản lý cài đặt → Truy cập nguồn** để đăng nhập nguồn đã cấu hình rồi tải lại danh sách. Hoàn tất sinh trắc học/passkey hoặc mã email trên thiết bị thật khi cần. Nguồn phải hỗ trợ [tích hợp iOS Access](docs/ios-source-access.md); cài ứng dụng không vượt qua danh sách IP cho phép.
- **Yêu cầu passkey khi dùng Wi-Fi tin cậy:** với nguồn tích hợp iOS Access, ứng dụng thử nguồn gốc không đăng nhập trước, chỉ dùng lối vào di động được xác thực sau khi bị từ chối. Kiểm tra IP công khai nguồn thực sự thấy, gồm IPv6: IPv4 gia đình được cho phép không bao gồm IPv6, VPN hay địa chỉ di động khác. Đổi mạng và mở lại ứng dụng xóa ưu tiên tuyến tạm thời. Lỗi mạng/máy chủ chung không nên kích hoạt đăng nhập.
- **Không còn hỏi đăng nhập nhưng danh sách kênh rỗng:** phiên đã lưu hợp lệ được tái sử dụng không hỏi lại. Sau lần tải lỗi hoặc máy chủ được sửa, tải lại danh sách hoặc đóng hoàn toàn rồi mở ứng dụng một lần. Nếu vẫn lỗi, xác minh nguồn trả danh sách thay vì trang đăng nhập HTML hay lỗi JSON. Ghi lỗi hiển thị và trạng thái HTTP; không chia sẻ URL nguồn chứa thông tin đăng nhập, cookie hay token Access.
- **Kênh tải được nhưng video đệm hoặc báo `SRC_NOT_FOUND`:** tải danh sách và phát video là hai kiểm tra riêng. Thử kênh lại một lần sau đăng nhập; nếu còn lỗi, kiểm tra phản hồi manifest HLS, các đoạn và hỗ trợ codec của luồng. Lỗi đó riêng lẻ không chứng minh đổi bộ máy hoặc cài lại sẽ có ích.

<a id="option-2-testflight-if-available"></a>

#### Lựa chọn 2: TestFlight (nếu có)

Nếu lời mời TestFlight được công bố, cài TestFlight từ App Store, mở lời mời trên thiết bị và chạm **Cài đặt**. Tải IPA từ GitHub không cung cấp lời mời TestFlight.

<a id="option-3-xcode-for-developers"></a>

#### Lựa chọn 3: Xcode (cho nhà phát triển)

Theo [Biên dịch và mở](docs/capacitor-mobile.md#build-and-open), chọn target **App** trong Xcode, cấu hình nhóm phát triển ở **Signing & Capabilities**, chọn thiết bị kết nối rồi build/chạy. Hoàn tất tin cậy thiết bị và Chế độ nhà phát triển khi cần. Nhập IPA chưa ký vào cửa sổ Devices của Xcode không cung cấp danh tính ký hay hồ sơ provisioning còn thiếu.

---

<a id="android-application"></a>

### Ứng dụng Android

Chọn APK Full Capacitor từ bản phát hành kho này cho giao diện chung. Dùng APK tương thích API 22 trên Android 5.1–6; cần WebView 60 trở lên. Giữ danh tính ứng dụng và chứng chỉ ký khi cập nhật để các hồ sơ hiện có vẫn dùng được. Xem [hướng dẫn build](android/README.md) và [phân phối, ký, cài từ xa](docs/android-distributions.md).

[Kho ottplay-android](https://github.com/open-ott-play/ottplay-android) riêng chứa ứng dụng Kotlin/Compose gốc. Nó có danh tính, tùy chọn và quy trình phát hành riêng, không thay thế trực tiếp bản Capacitor. Tệp các bản phát hành lịch sử vẫn có sẵn.

---

<a id="quick-start"></a>

## Bắt đầu nhanh

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

Dùng triển khai riêng cùng bản nguồn để kiểm tra cơ bản bằng trình duyệt.

Dùng Node 22 và bộ công cụ Rust ổn định. Chạy máy chủ từ thư mục gốc kho để có các tệp tĩnh. Bản build gốc cần công cụ nền tảng nêu bên dưới; chỉ build máy chủ thì không cần chúng.

Lần tải đầu, chọn **Thử demo** hoặc mở **Cài đặt → Đổi nhà cung cấp → Danh sách M3U / M3U8**. Mở **Chọn danh sách**, chọn ô, nhập **URL danh sách**, lưu thay đổi rồi chọn **Tải danh sách**. Bạn tự cung cấp danh sách hoặc tài khoản nhà cung cấp; ứng dụng không cung cấp thuê bao kênh trả phí.

<a id="mode-a-companion-smoke"></a>

## Kiểm tra companion Chế độ A

Kiểm tra bằng curl cho companion Chế độ A (tương đương `ottplay-server` / `archive/server.py`): trang chỉ mục, thư mục tĩnh, `/logo`, `/version`, `/epg` tùy chọn và thăm dò `POST /m3u/cp.php` không lấy nội dung.

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

Các kiểm tra nằm trong `scripts/modea-smoke-checks.json`. Không có bí mật. Hàng đợi lệnh / `local_proxy.py` (:8081) được kiểm tra riêng bởi `scripts/smoke-command-queue.sh` (nếu có).

<a id="classic-stalker--ministra-portals"></a>

## Cổng Stalker / Ministra cổ điển

Chọn **Cổng Stalker** và nhập MAC do nhà cung cấp cấp cùng URL cổng đầy đủ, ví dụ `http://provider.example/stalker_portal/c/`. Các URL `/c/index.html`, `/stalker_portal`, `/server/load.php`, `/load.php` và `/portal.php` chọn giao thức MAG cổ điển. Cấu hình chỉ địa chỉ máy chủ hiện có giữ JSON-RPC. Nhà cung cấp tải hồ sơ, thể loại và các trang kênh trực tiếp bằng lõi Stalker chung, sau đó tìm phim và các tập trong thư mục lồng nhau qua giao thức `type=vod` cổ điển ở chế độ nền. Đường dẫn thư mục trở thành thể loại trong danh sách kênh thông thường; mô tả, áp phích có sẵn và Mục yêu thích toàn cục ổn định dùng chung giao diện nội dung. Xem [cách hoạt động và giới hạn của danh mục](docs/stalker-media.md).

Yêu cầu từ phiên bản trình duyệt tự lưu trữ đi qua endpoint `/stalker/api` của companion; ứng dụng gốc dùng giao vận HTTP hiện có. Phiên bản trình duyệt trên dịch vụ lưu trữ cần các tuyến được cấu hình rõ ràng qua [relay chuyên dụng](docs/stalker-relay.md). Tài nguyên trình duyệt và máy chủ phải được cập nhật cùng nhau.

Phát trực tiếp giải quyết lệnh kênh tạm thời khi mở luồng; đổi kênh, dừng, PiP và thay nhà cung cấp hủy việc giải quyết đã cũ. Lệnh HTTP(S) rõ ràng, không tạm thời, phát trực tiếp. EPG ngắn được hỗ trợ. Nhà cung cấp này không cung cấp kho lưu trữ của cổng cổ điển hoặc biến thể giao thức `type=series` riêng biệt. Hành vi kho lưu trữ/lịch JSON-RPC hiện có không đổi. Cổng LAN riêng dùng tuyến companion cần mục `OTTPLAY_PROXY_LAN_ORIGINS` chính xác, như các tuyến proxy companion khác.

Demo Infomir công khai ở `http://middleware-stalker.com/stalker_portal/c/`. Nó trả ba mục danh mục trực tiếp ngày 2026-09-26 nhưng endpoint nội dung không khả dụng; dùng dữ liệu cổng/nội dung có kiểm soát để kiểm thử hồi quy phát.

<a id="m3u-stream-proxy-header-smoke"></a>

## Kiểm tra header proxy luồng M3U

So sánh các header yêu cầu lên nguồn mà `POST /m3u/cp.php` của companion Chế độ A thêm khi lấy URL echo có kiểm soát (mặc định mô phỏng cục bộ — không dùng nhà cung cấp IPTV hay bí mật).

Hợp đồng (từ `src-rs/core/src/m3u.rs` + `archive/server.py`):
- Chỉ thêm **User-Agent** (mặc định `OTT-play-FOSS/1.0`, hoặc cấu hình `webos` / `tizen` / `viera` / `mag` / `dune`).
- **Không** thêm **Referer** (`M3UProxy` của Capacitor có thêm; Chế độ A không).
- Bỏ `@` ở đầu `url` (biểu mẫu jQuery của nhà cung cấp).

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

Mã thoát: `0` đạt, `1` không lắng nghe, `2` header/HTTP không khớp, `3` cách dùng/phụ thuộc. Liên quan đến `smoke-modea-companion.sh` / `smoke-command-queue.sh`.

<a id="logo-concurrent-bench-smoke"></a>

## Kiểm tra tải logo đồng thời

Kiểm tra độ trễ các yêu cầu `GET /logo/<id>.svg` đồng thời (`?ch=` tùy chọn) đến companion Chế độ A. Báo số đạt/lỗi và p50/p95/p99. Mặc định là tải thực tế cho CI cục bộ (`CONCURRENCY=200`, `TOTAL=1000`); thử dài đầy đủ 10 nghìn là tùy chọn (`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`).

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

Mã thoát: `0` đạt, `1` không lắng nghe / kết nối lỗi, `2` tỷ lệ lỗi cao, `3` cách dùng. Liên quan đến `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`.

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## Kiểm tra làm mới / khởi tạo bộ nhớ đệm XMLTV

Xác minh đúng hành vi bộ nhớ đệm XMLTV/EPG của companion Chế độ A theo `src-rs` (không bịa API):

- `EPG_CACHE` trong bộ nhớ được cung cấp qua `GET /epg/:hash` → luôn là `{"epg_data":[...]}` (HTTP 200).
- Khi bắt đầu, tiến trình lấy `EPG_URLS` trong nền mà không chậm khởi động HTTP; sau mỗi lần lấy xong, đợi **2h** trước lần làm mới tiếp theo.
- Lưu bền bằng SQLite tùy chọn khi có `DATABASE_URL` (không có endpoint công khai trạng thái bộ nhớ đệm).
- `GET /health` → `OK` xác nhận HTTP sẵn sàng sau khởi động lại tùy chọn. Với `--strict-epg` và `--epg-hash`, kiểm tra cũng đợi EPG không rỗng của kênh trong cùng giới hạn `--warmup-timeout`.

Đường mặc định chỉ gọi curl — **không kết thúc tiến trình**. Truyền `--restart-cmd` / `RESTART_CMD` để tự động kết thúc+khởi động lại, hoặc theo các bước `launchctl` thủ công trong `--help`.

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

Mã thoát: `0` đạt, `1` không lắng nghe, `2` xác nhận/khởi tạo lỗi, `3` cách dùng. Liên quan đến `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`.

<a id="mode-a-e2e-play-path-smoke"></a>

## Kiểm tra E2E đường phát Chế độ A

Kiểm tra **đường phát / độ sẵn sàng luồng** phía companion (chỉ HTTP — **không** phải E2E giao diện hiển thị). Đối với companion Chế độ A đang chạy, nó kiểm tra:

- Truy cập được health hoặc chỉ mục
- Tài nguyên tĩnh vỏ trình phát (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`)
- `GET /epg/<hash>.json` tùy chọn khi có `EPG_HASH`
- `POST /m3u/match-channels` với dữ liệu JSON không bí mật (danh sách rỗng + một kênh tổng hợp)
- **Phát** qua proxy: `POST /m3u/cp.php` đến nội dung có kiểm soát (mặc định danh sách HLS cục bộ hoặc `MEDIA_URL`), xác nhận HTTP 200 + thân không rỗng / `Content-Type` dự kiến (những byte đầu qua proxy)

Không dùng thông tin IPTV riêng tư. Liên quan đến `smoke-modea-companion.sh` (hiện diện), `smoke-m3u-stream-proxy-headers.sh` (UA/Referer), `smoke-xmltv-cache-refresh.sh`.

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

Mã thoát: `0` đạt, `1` không lắng nghe, `2` xác nhận lỗi, `3` cách dùng/phụ thuộc.

<a id="capacitor-device-smoke-mode-b"></a>

## Kiểm tra thiết bị Capacitor (Chế độ B)

**Danh sách kiểm tra** trình mô phỏng/giả lập (thiết bị thật tùy chọn) cho Cap Chế độ B — không phải HTTP companion Chế độ A. Con người đánh dấu kết quả UI; công cụ hỗ trợ tự động hóa bộ công cụ/thư mục gốc/curl hàng đợi lệnh với kiểm tra nhẹ.

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

Chi tiết: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md). Liên quan đến `smoke-command-queue.sh` (loopback Cap) — không nhầm với các kiểm tra Chế độ A phía trên.

<a id="tauri-desktop-smoke-mode-b"></a>

## Kiểm tra Tauri desktop (Chế độ B)

Danh sách kiểm tra máy tính và công cụ hỗ trợ Chế độ B Tauri (cửa sổ/phát kênh/PiP). Không phải HTTP companion Chế độ A hay kiểm tra thiết bị Cap.

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

Chi tiết: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md). Thông tin nhà phát triển Apple là tùy chọn cho kiểm tra cục bộ; dùng [ký ad-hoc](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials) cho ứng dụng Mac đóng gói. Con người vẫn nghiệm thu việc mở, phát và PiP.

<a id="docker"></a>

## Docker

Ảnh đa kiến trúc (amd64/arm64) được build thành kho OCI ứng viên. Xuất bản registry nâng kho ổn định đã duyệt lên Docker Hub mà không build lại; xem [sổ tay vận hành](docs/release-workflow.md).

Tệp nhị phân máy chủ được build trên **musl** (Alpine) và đi kèm Alpine — **không** cần GLIBC_2.38+. Nhờ đó `alvit/ottplay-foss` chạy trên Docker Synology DSM (x86_64) và các máy chủ glibc cũ khác.

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

Tag ổn định trong registry dùng `X.Y.Z`. Cập nhật `latest` là tùy chọn rõ ràng riêng sau khi xuất bản ảnh có phiên bản; push main và tag Git không xuất bản ảnh.

<a id="build-from-source"></a>

## Biên dịch từ nguồn

Quy tắc miền của trình phát đến từ sản phẩm Kotlin đa nền tảng được ghim ở `vendor/ottplay-core.js`. Quyết định về lịch, kho lưu trữ, danh sách, nhà cung cấp, trạng thái bền và phát dùng chung triển khai với FOSS2 và Android gốc. Bộ chuyển đổi trình duyệt/TV, Swift, Rust giữ API thiết bị, codec, mạng và hiệu ứng UI. Sản phẩm trình duyệt giữ cú pháp ES5 và bootstrap API cũ được hỗ trợ. `npm test`, `check:bundle` và `check:es5` kiểm tra tích hợp; manifest sản phẩm ghi hash nguồn và đầu ra.

Bộ kiểm tra giao thức control-server và SWOP được sinh từ schema có phiên bản `contracts/ottplay-wire-v1.json`. Biên nhận bộ sinh được kiểm tra và dữ liệu tương thích bất biến ngăn bản sao chính sách riêng theo bên tiêu thụ.

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

## Phát hiện thiết bị

Trình phát hỗ trợ 24 loại thiết bị. Phát hiện theo URL `/f/{device_id}/` trước, sau đó User-Agent.

| ID thiết bị | Thiết bị |
|---|---|
| `pc` | Trình duyệt PC |
| `pc2` | Trình phát web videojs |
| `nodejs` | Ứng dụng Windows (Electron) |
| `lg/webos` | TV LG WebOS |
| `samsung/tizen` | TV Samsung Tizen |
| `samsung/maple` | TV Samsung Orsay |
| `mag` | Hộp Infomir MAG |
| `dune` | Hộp Dune HD |
| `android` | Android TV / máy tính bảng |
| `hbbtv` | TV HbbTV |
| `panasonic` | TV Panasonic Viera |
| `philips` | TV Philips |
| `sony` | TV Sony |
| `sharp` | TV Sharp |
| `toshiba` | TV Toshiba |
| `hisense` | TV Hisense |
| `skyworth` | TV Skyworth |
| `tcl` | TV TCL |
| `vewd` | Thiết bị Vewd |
| `spark` | Đầu thu Spark |

<a id="push-command-system"></a>

## Hệ thống lệnh push

Để có dịch vụ nhiều thiết bị riêng, dùng [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) và mục **Máy chủ lệnh** trong **Cài đặt → Điều khiển từ xa**. Nhập IP/địa chỉ cùng mã truy cập thiết bị của trình phát này; lưu cả hai tự bắt đầu hỏi lệnh âm lượng, kênh và lệnh khác. IP không có cổng dùng HTTP 8081. Xóa địa chỉ hoặc chọn **Ngắt kết nối** để dừng. Kết nối đi ra này hỗ trợ giao lệnh có xác nhận và không cần bộ lắng nghe cục bộ. Xem [kết nối và tương thích](docs/remote-command-server.md). Ví dụ bên dưới mô tả chế độ proxy/bộ lắng nghe cục bộ hiện có.

**Tìm máy chủ lệnh** cho phép tìm bộ điều khiển và yêu cầu người vận hành phê duyệt mà không cần sao chép token thiết bị. Tauri kiểm tra DNS gốc trước và có thể chuyển sang hồ sơ triển khai được cấu hình rõ ràng nếu kết quả trống; trình phát trên trình duyệt, LG và Capacitor sử dụng đường dẫn hồ sơ của trình duyệt. Siêu dữ liệu khám phá Home có thể được lưu trữ trên here.now độc lập với bộ điều khiển. Các bản dựng dùng chung không tự động bao gồm hồ sơ Home này và bản cập nhật không thay thế các kết nối đã lưu. Xem [hành vi theo nền tảng, thiết lập hồ sơ và khắc phục sự cố](docs/remote-command-server.md#discovery-and-one-time-approval).

Điều khiển HTTP cục bộ **mặc định tắt** trong trình phát trình duyệt/OTT server, Tauri và Capacitor. Bật ở **Cài đặt trình phát → Điều khiển từ xa** để tạo mã thiết bị bí mật. Lệnh là đối tượng JSON có trường `"command"`; yêu cầu HTTP cần `Authorization: Bearer <device-code>`.

<a id="architecture"></a>

### Kiến trúc

<a id="local-command-url-recommended"></a>

#### URL lệnh cục bộ (khuyên dùng)

Bật **Điều khiển HTTP cục bộ** trong **Cài đặt trình phát → Điều khiển từ xa**, sao chép **Mã thiết bị** vừa tạo và cấu hình proxy bên dưới bằng mã đó. Đặt **URL lệnh cục bộ** thành endpoint lệnh của proxy. Khi bật, trình phát hỏi URL này mỗi 10 giây với mã trong header Authorization. Chỉ đặt URL không bật điều khiển lệnh.

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### UUID thiết bị

UUID thiết bị hiện có (ví dụ `dev_a1b2c3d4e5`) là siêu dữ liệu định tuyến công khai, không phải thông tin cấp quyền. **Mã thiết bị** riêng được tạo an toàn khi bật HTTP cục bộ và ở lại thiết bị; không được sao chép qua cài đặt đám mây. Tắt HTTP cục bộ dừng hỏi/bộ lắng nghe. Bật lại tạo mã mới: cập nhật proxy và tích hợp để thu hồi thông tin cũ.

Tauri và Capacitor chỉ khởi động bộ lắng nghe HTTP loopback sau khi bật trong cài đặt. Proxy chuyển tiếp phải gửi mã hiển thị dưới dạng Bearer token tới bộ lắng nghe đó. Chế độ A dùng hàng đợi `local_proxy.py` được cấu hình riêng bên dưới.

<a id="remote-text-entry-swop"></a>

#### Nhập văn bản từ xa (swop)

Mục đích: gõ trên điện thoại cho ♥™ / bàn phím ảo từ xa khi TV và điện thoại ở **hai mạng khác nhau**, qua chuyển giao phiên Cloudflare Worker.

- Kho Worker: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop)
- **Cấp quyền cài đặt:** trình phát gửi yêu cầu tới relay `/swop` cùng origin với máy chủ. Máy chủ thêm token cài đặt riêng; mọi máy khách trên origin máy chủ đã đăng ký đều dùng được nhập từ xa. UUID thiết bị nhận diện phiên và không cần danh sách cho phép từng thiết bị.
- Cài đặt: `swopBaseUrl` (trống = ♥™ hiện “chưa cấu hình” / không làm gì). Sửa ở **Cài đặt → Điều khiển từ xa** (phím **2**) hoặc đưa vào qua `/local/swop.json` được Git bỏ qua trong các bản cài của người vận hành
- `POST /session` gồm `clientId`, `caption`, `draft`; `POST /val` gồm `clientId`, `code` và `sessionToken` trả về. URL điện thoại chứa token ghi riêng. Token đọc phiên nằm trong bộ nhớ trình duyệt.
- **Cài cục bộ:** đặt `SWOP_BASE_URL` và `SWOP_INSTALLATION_TOKEN` sau khi đăng ký bản cài và các origin LAN/localhost chính xác trong Worker. `scripts/install-ottplay-local-service.sh` giữ chúng trong plist launchd riêng có chế độ 0600. `/local/swop.json` công khai chỉ chứa `{"swopBaseUrl":"/swop"}`. Không đặt token cài đặt trong tài nguyên công khai.
- **Hosting tĩnh:** cấu hình proxy máy chủ có xác thực cho cùng hai endpoint. Giữ token cài đặt trong kho bí mật của dịch vụ hosting. Sao chép tệp trình phát công khai không sao chép thông tin máy chủ này.

> Máy chủ OTT trung tâm tắt `/api/webhook/commands`, `/webhook/poll`, `/webhook/notify` và alias sức khỏe lệnh với mọi phương thức HTTP. Dùng máy chủ lệnh riêng hoặc `local_proxy.py` có xác thực được cấu hình rõ ràng cho Chế độ A; máy chủ trung tâm không có hàng đợi lệnh quảng bá.

<a id="available-commands"></a>

### Lệnh khả dụng

Mọi ví dụ dưới đây dùng `http://192.168.1.50:8081/api/webhook/commands` làm URL proxy cục bộ. Thay bằng địa chỉ thực và đặt `OTTPLAY_QUEUE_HTTP_TOKEN` thành **Mã thiết bị** được hiện sau khi bật HTTP trong cài đặt trình phát. Proxy phải được cấu hình cùng mã.

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — Hiện thông báo bật lên

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| Trường | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `message` | string | bắt buộc | Văn bản hiển thị |
| `popup_duration` | number | 5 | Số giây hiển thị (góc trên phải) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — Đổi kênh theo vị trí danh sách

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| Trường | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `channel_number` | number | bắt buộc | Vị trí kênh trong danh sách bắt đầu từ 1 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — Đổi kênh theo (một phần) tên

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

Tìm chuỗi con không phân biệt hoa thường. Dùng kết quả khớp đầu tiên.

| Trường | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `channel_name` | string | bắt buộc | Tên kênh đầy đủ hoặc một phần |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — Đổi sang kênh ngẫu nhiên

Lệnh cũ này chọn các kênh đủ điều kiện từ danh sách hoặc danh mục hiện tại. Số kênh và khoảng số chỉ vị trí trong danh sách đó; xem [quy tắc chọn ngẫu nhiên an toàn](docs/remote-command-server.md#safe-random-playback).

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

| Trường | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `random_range` | [start, end] | danh sách hiện tại | Khoảng bắt đầu từ 1 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — Đổi nhà cung cấp IPTV

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| Trường | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `provider` | number | bắt buộc | Chỉ số trong mảng nhà cung cấp (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — Tải danh sách M3U mới

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| Trường | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `playlist` | string | bắt buộc | URL danh sách M3U |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — Cập nhật cấu hình nhà cung cấp

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| Trường | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `provider_settings` | string | bắt buộc | Chuỗi JSON chứa cấu hình nhà cung cấp |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — Đặt hoặc điều chỉnh âm lượng

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

Bị bỏ qua im lặng trên máy khách không hỗ trợ điều khiển âm lượng.

| Trường | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `volume` | number | — | Mức tuyệt đối 0-100 |
| `volume_step` | number | — | Thay đổi tương đối, ví dụ +10 hoặc -5 |

<a id="player-standby-restart-and-exit"></a>

#### Chờ, khởi động lại và thoát trình phát

Hàng đợi webhook không xác nhận của proxy cục bộ không hỗ trợ `exit_player` hoặc yêu cầu chờ/đánh thức có kiểu. Kết nối trình phát tới [máy chủ lệnh](docs/remote-command-server.md) và dùng CLI:

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

Thay `d1` bằng alias trình phát đã đăng ký. `stop` là alias của `standby`; `start` và `wake` là alias của `go`. Go cần trình phát đang chạy, có kết nối; không thể mở ứng dụng đã đóng hay đánh thức thiết bị ngoại tuyến. Trình duyệt hoặc TV không có thoát ứng dụng gốc sẽ báo không hỗ trợ thoát. Chế độ chờ giữ hoạt động hỏi từ xa và không tạm dừng công việc không liên quan của host hay máy chủ chung.

Sau standby/go, kiểm tra `ott d1 status` về trạng thái chờ/nền và xác minh phát tiếp riêng. Sau khi tải lại trình phát, xác nhận runtime mới bằng `ott d1 doctor`. Sau thoát, kiểm tra qua hệ điều hành rằng tiến trình đã đóng; timeout từ xa không chứng minh thoát. Chấp nhận lệnh đơn thuần không xác nhận các kết quả này.

<a id="local-proxy-server"></a>

## Máy chủ proxy cục bộ

`local_proxy.py` là hàng đợi lệnh độc lập có xác thực cho một trình phát. Lần gọi mặc định thoát mà không mở cổng. Mỗi proxy dùng mã thiết bị do trình phát sinh; dùng instance/cổng riêng cho nhiều trình phát. Tham số truy vấn `device_id` được nhận như siêu dữ liệu tương thích và không bao giờ xác thực hay chọn thiết bị khác.

<a id="start-the-proxy"></a>

### Khởi động proxy

1. Bật **Điều khiển HTTP cục bộ** trong trình phát và sao chép **Mã thiết bị**.
2. Trên host proxy, cấu hình mã cùng origin chính xác phục vụ trình phát (giao thức, host, cổng; không có đường dẫn):

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. Đặt **URL lệnh cục bộ** của trình phát thành `http://192.168.1.50:8081/api/webhook/commands`.

Địa chỉ lắng nghe mặc định là `127.0.0.1`; ví dụ bật rõ truy cập LAN. `OTTPLAY_QUEUE_HTTP_ORIGINS` là danh sách origin trình duyệt chính xác, ngăn cách bằng dấu phẩy. Dùng reverse proxy HTTPS khi phục vụ trình phát qua HTTPS để quy tắc nội dung hỗn hợp cho phép hỏi. Giữ mã bí mật và ngoài URL. Khi trình phát sinh mã mới, khởi động lại proxy với giá trị mới; chỉ tắt trình phát không dừng tiến trình proxy được quản lý riêng.

<a id="endpoints"></a>

### Endpoint

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| `POST` | `/api/webhook/commands` | Đưa lệnh vào hàng đợi |
| `GET` | `/api/webhook/commands` | Lấy lệnh trong hàng đợi (trình phát hỏi) |
| `POST` | `/webhook/notify` | Alias tương thích có xác thực |
| `GET` | `/webhook/poll` | Alias tương thích có xác thực |

Cả gửi và lấy đều cần mã thiết bị Bearer khớp. Không có endpoint quảng bá không xác thực. Lệnh hết hạn sau 60 giây; mỗi proxy giữ tối đa 50 lệnh.

Proxy xử lý tối đa 16 kết nối đồng thời, nên kết nối trình duyệt rảnh hay yêu cầu chưa đầy đủ không trì hoãn các lệnh khác. Mỗi socket có timeout không hoạt động năm giây; kết nối bổ sung bị đóng khi mọi worker bận. Thêm và rút hàng đợi là nguyên tử giữa các worker.

<a id="smoke-script-all-modes"></a>

### Tập lệnh kiểm tra (mọi chế độ)

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Trình giả lập/thiết bị Android: trước tiên chạy `adb forward tcp:18081 tcp:18081`. Cap/Tauri chỉ dùng loopback — dùng proxy Chế độ A này cho Home Assistant trên LAN. Chi tiết: `docs/capacitor-mobile.md` § Smoke test.

<a id="cors"></a>

### CORS

Proxy chỉ cho phép yêu cầu trình duyệt từ `OTTPLAY_QUEUE_HTTP_ORIGINS`. Yêu cầu thăm dò `OPTIONS` từ origin được cho phép không cần token; mọi GET/POST thật cần mã Bearer. Không nhận origin ký tự đại diện hay `null`. Home Assistant và bên gọi không phải trình duyệt có thể bỏ Origin nhưng vẫn phải xác thực.

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### Ví dụ: webhook Home Assistant → proxy cục bộ → trình phát

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

### Ví dụ tự động hóa Home Assistant

Ví dụ thông báo, kênh và âm lượng dùng proxy cục bộ. Đặt `ottplay_device_authorization` trong `secrets.yaml` của Home Assistant thành `Bearer <device-code>` với mã của trình phát đã bật.

Chờ ban đêm dùng [máy chủ lệnh](docs/remote-command-server.md) riêng. Thay URL ví dụ và `DEVICE_UUID` bằng địa chỉ bộ điều khiển cùng ID thiết bị đã đăng ký; alias CLI cục bộ `d1` không phải ID thiết bị. Đặt `ottplay_control_authorization` thành `Bearer <controller-admin-token>` trong `secrets.yaml`. Đây là thông tin riêng, khác mã thiết bị proxy. Xem tài liệu Home Assistant về [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) và [bí mật](https://www.home-assistant.io/docs/configuration/secrets/).

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

`standby_request` chứa phản hồi HTTP để theo dấu tự động hóa. HTTP 202 chỉ có nghĩa đã xếp hàng: giữ `content.id`, rồi hỏi `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` với cùng thông tin bộ điều khiển để nhận câu trả lời từ trình phát. Yêu cầu `status` mới quan sát `player.standby` và `player.background`; chờ bật với `suspended` và không còn mục chờ xác nhận công việc được theo dõi của trình phát đã hoàn tất. Để rời chế độ chờ, dùng cùng yêu cầu có kiểu với `"operation":"wake"` (`ott d1 go`). Không lặp lại thay đổi một cách mù quáng sau timeout. Xem [API yêu cầu/phản hồi](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) và [ngữ nghĩa chế độ chờ](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake) của bộ điều khiển.

<a id="server-api-reference"></a>

## Tham khảo API máy chủ

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Endpoint webhook (Rust `ottplay-server`)

Máy chủ Rust và phương án dự phòng Python đã lưu trữ từ chối endpoint lệnh bằng HTTP 403. `/api/webhook/commands`, `/webhook/notify`, `/webhook/poll` và alias sức khỏe lệnh không xếp hàng, phát quảng bá hay rút lệnh. API phản hồi chung không thể ghi đè những tuyến dành riêng này. Giao lệnh Chế độ A dùng máy chủ lệnh hoặc proxy cục bộ có xác thực được cấu hình riêng như trên.

<a id="other-endpoints"></a>

### Endpoint khác

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| `GET` | `/epg/<hash>.json` | Dữ liệu EPG của kênh |
| `GET` | `/logo/<id>.svg` | Logo kênh được sinh |
| `GET` | `/version/<path>` | Hash phiên bản tệp |
| `POST` | `/m3u/match-channels` | Ghép kênh với EPG |
| `POST` | `/m3u/match-logos` | Ghép logo kênh |
| `POST` | `/m3u/cp.php` | Proxy luồng |
| `GET/POST` | `/feedback/` | Ghi nhật ký phản hồi |
| `GET` | `/tmdb/*` | Proxy API TMDb |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## Cấu trúc dự án

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

## Ánh xạ phím STB

- **Samsung Tizen**: `RETURN=10009`, `ENTER=13`, màu 403-406
- **Samsung Maple**: dpad 4/5/6/8, mã SDK gốc
- **LG WebOS**: `RETURN=461`, màu tương thích HbbTV
- **LG NetCast**: `RETURN=8`, mã HbbTV
- **MAG**: `RETURN=8`, API gSTB cho MAC
- **Dune HD**: mã tiêu chuẩn, API Dune
- **Android TV**: mã phím Android (`BACK=4`, `DPAD_*` 19-22, `ENTER=66`)
- **HbbTV/Panasonic/Philips/Sony/v.v.**: mã HbbTV (`RED=403`, `BLUE=406`, `VOL_UP=447`)

<a id="documentation"></a>

## Tài liệu

- [Wiki tài liệu](./docs/wiki/Home.vi.md) / [Wiki tiếng Nga](./docs/wiki/Home.ru.md) — điều hướng theo nhiệm vụ và quy tắc bảo trì.
- [Báo cáo triển khai](./docs/implementation-report.vi.md) / [Quy trình và kết quả tiếng Nga](./docs/implementation-report.ru.md) — sơ đồ màu, hành vi đã kiểm chứng, chi phí đo được và điều kiện phát hành.
- [Hướng dẫn bàn giao](./docs/roadmap-delivery.vi.md) / [Tính năng mới tiếng Nga](./docs/roadmap-delivery.ru.md) — tính năng, giới hạn và xác minh.
- [Hướng dẫn nhanh bằng 88 ngôn ngữ giao diện](./docs/readme/README.md) — tạo từ bản dịch UI đi kèm; sổ tay chính và hướng dẫn tính năng theo cặp có [24 ngôn ngữ tài liệu](docs/manual-translations.md).
- [Giới hạn chất lượng và khôi phục trực tiếp](./docs/playback-stream-policy.vi.md) / [Tiếng Nga](./docs/playback-stream-policy.ru.md).
- [Ghép XMLTV thủ công và tiếp cận cổ điển](./docs/guide-binding-accessibility.vi.md) / [Tiếng Nga](./docs/guide-binding-accessibility.ru.md).
- [Kiểm tra âm thanh/video được lưu trữ](./docs/audio-video-check.vi.md) / [Tiếng Nga](./docs/audio-video-check.ru.md).
- [Thư viện nội dung Xtream](./docs/xtream-media.vi.md) / [Tiếng Nga](./docs/xtream-media.ru.md).
- [Chuyển tiếp thiết bị cùng nguồn](./docs/remote-handoff.vi.md) / [Tiếng Nga](./docs/remote-handoff.ru.md).
- [Cài đặt cục bộ có thể khôi phục](./docs/settings-recovery.vi.md) / [Tiếng Nga](./docs/settings-recovery.ru.md).
- [Thế hệ trình duyệt, hệ điều hành và kiểm tra ứng viên phát hành chính xác](docs/browser-compatibility.vi.md) / [Tiếng Nga](docs/browser-compatibility.ru.md).

- [Kiến trúc trình phát](./docs/architecture.md) — trách nhiệm runtime, tích hợp nhà cung cấp, phát, lịch, bộ chuyển đổi thiết bị và hợp đồng build.
- [Quy trình build ES5 cổ điển](./docs/build-pipeline.md) — biên dịch, kiểm tra tương thích và giới hạn kích thước sản phẩm.
- [Tên tài nguyên runtime và chuyển đổi triển khai](./docs/asset-layout.md) — đường dẫn mô tả chung cho gói web và gốc.
- [Bàn làm việc từ xa](./docs/remote-workbench.md) — kiểm tra UI/nội dung, biên nhận thao tác và bằng chứng đã lưu.
- [Chẩn đoán runtime](./docs/runtime-debug.md) — lịch sử lỗi, bộ đếm khung hình/vòng lặp, chỉ số gốc Capacitor/Tauri và gỡ lỗi máy chủ.
- [Bàn giao macOS cục bộ](./docs/macos-local-delivery.md) — build checkout, cài cục bộ và xác minh.

<a id="license"></a>

## Giấy phép

[MIT](LICENSE) — tự do và mã nguồn mở. Nội dung nhà cung cấp và phụ thuộc bên thứ ba giữ quyền và giấy phép riêng.

Ứng dụng riêng [OTTPlay native webOS](docs/native-webos.md), phát triển từ PlxNative, được phân phối theo **GPL-3.0-or-later** cùng mã nguồn tương ứng.
Giấy phép MIT ở thư mục gốc của dự án không thay đổi giấy phép của ứng dụng gốc này hoặc các bản vá của nó.

<a id="desktop-updater--notarization-mode-b"></a>

## Bộ cập nhật desktop / công chứng (Chế độ B)

[Hướng dẫn ký desktop và bộ cập nhật](docs/tauri-updater-notarize.md) mô tả ký ad-hoc macOS, Developer ID/công chứng tùy chọn và xác minh gói. CI phát hành dùng ký ad-hoc không có thông tin Apple. Ký bộ cập nhật tách biệt; tự động cập nhật sản xuất vẫn chưa được cấu hình.

<a id="local-mac-build-helpers"></a>

## Công cụ hỗ trợ build Mac cục bộ

Xem [docs/local-build-scripts.md](docs/local-build-scripts.md).

<a id="privacy"></a>

## Quyền riêng tư

Đọc [chính sách quyền riêng tư](docs/privacy-policy.md) để biết về cài đặt cục bộ, dịch vụ đã cấu hình và lựa chọn của bạn. Liên hệ quyền riêng tư và hỗ trợ: [alvit.work@gmail.com](mailto:alvit.work@gmail.com).

Studio 2026 là chủ đề giao diện mặc định. Classic và PLi-HD vẫn chọn được, tùy chọn đã lưu được giữ nguyên. Xem [cài đặt giao diện](docs/interface-settings.md). Chủ đề PLi-HD ghi công Vali, littlesat, VU+NL, Milo và những người đóng góp nguồn gốc. Xem [ghi công giao diện và lịch sử thiết kế](docs/interface-history.md) để đọc lịch sử tiếng Anh và liên kết nguồn, cũng truy cập được từ menu thông tin trình phát.

<a id="demo-video-editing"></a>

## Chỉnh sửa video demo

Dùng [quy trình video-use](docs/demo-video.md) cục bộ để chuẩn bị và biên tập bản ghi demo. Công cụ giữ toàn bộ nội dung được tạo ngoài Git.

<a id="plex-media-library"></a>

## Thư viện nội dung Plex

Mỗi trình phát có thể kết nối tài khoản Plex hoặc Plex Media Server qua nhà cung cấp **Plex**. Tích hợp dùng Plex; Synology là một máy chủ nội dung có thể dùng. Tất cả video và bản nhạc có thể truy cập tự động xuất hiện trong danh sách kênh; chọn danh mục để lọc theo thư viện, thư mục hoặc loạt phim. Phát bắt đầu từ lô đầu có thể dùng, với tải nền, tìm kiếm tiêu chuẩn và Hành động trộn/lặp, không cần cấu hình Plex trên máy chủ OTT. Xem [đăng nhập Plex và phát trực tiếp](docs/plex-provider.md).

![Vòng đời tải Plex, duyệt tệp và đóng](docs/images/plex-playback-lifecycle.svg)

[Đánh giá độ tin cậy có minh họa](docs/plex-provider.md#reliability-review-process-and-results) giải thích quy tắc tải/hủy, sửa lỗi danh mục đầy đủ và chuyển tệp, cùng kết quả kiểm tra Chromium/WebKit đã đo.

Tích hợp máy chủ OTT tùy chọn cũng cung cấp danh mục máy chủ Plex hiện có và phát tương thích qua mục thư viện NAS riêng cùng xuất M3U. Xem [cấu hình thư viện máy chủ và truy cập máy khách](docs/synology-library.md).

<a id="related-repositories"></a>

## Kho liên quan

- [ottplay-core](https://github.com/open-ott-play/ottplay-core) quản lý logic miền JVM/ES5 chung, hợp đồng truyền thông và máy khách FOSS2. Trình phát này dùng sản phẩm được sinh; theo hướng dẫn bàn giao lõi cho thay đổi dùng chung.
- [ottplay-android](https://github.com/open-ott-play/ottplay-android) là ứng dụng Kotlin/Compose gốc riêng, có danh tính cài đặt và phát hành riêng.
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server) cung cấp lệnh từ xa tự host; [ottplay-swop](https://github.com/open-ott-play/ottplay-swop) cung cấp kênh nhập văn bản dựa trên Worker tùy chọn.
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine) quản lý hồ sơ demo trình duyệt được host, nội dung demo và kiểm tra xuất bản.

<a id="project-maintenance"></a>

## Bảo trì dự án

Xem [yêu cầu đóng góp và kiểm thử](CONTRIBUTING.md), [chính sách báo cáo bảo mật](SECURITY.md), [thiết kế bảo mật](docs/security-design.md) và [bằng chứng OpenSSF cùng tiêu chí còn lại](docs/openssf-evidence.md).
