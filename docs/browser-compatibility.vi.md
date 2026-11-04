<a id="browser-generations-and-operating-systems"></a>

# Các thế hệ trình duyệt và hệ điều hành

<!-- language-navigation:start -->
<p dir="ltr">
<a href="browser-compatibility.md" lang="en" dir="ltr">English</a> · <a href="browser-compatibility.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="browser-compatibility.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="browser-compatibility.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="browser-compatibility.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="browser-compatibility.es.md" lang="es" dir="ltr">Español</a> · <a href="browser-compatibility.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="browser-compatibility.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="browser-compatibility.he.md" lang="he" dir="rtl">עברית</a> · <a href="browser-compatibility.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="browser-compatibility.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="browser-compatibility.it.md" lang="it" dir="ltr">Italiano</a> · <a href="browser-compatibility.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="browser-compatibility.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="browser-compatibility.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="browser-compatibility.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="browser-compatibility.pt.md" lang="pt" dir="ltr">Português</a> · <a href="browser-compatibility.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="browser-compatibility.th.md" lang="th" dir="ltr">ไทย</a> · <a href="browser-compatibility.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="browser-compatibility.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="browser-compatibility.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="browser-compatibility.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="browser-compatibility.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[Kết quả đo](implementation-report.vi.md#browser-gate-integration)

![Cấu hình đánh giá trình duyệt: 35 mục tiêu, 166 lượt chạy kịch bản](diagrams/browser-qualification.svg)

Các kiểm tra hiện có về thiết bị, media, ES5/worker cũ, giao diện native và HLS native của Apple vẫn bắt buộc. Workflow TypeScript dùng chung còn chạy các kịch bản Plex trên đúng kho lưu trữ Mode A đã đóng gói: hai luồng tải/tải lại đã bản địa hóa, giữ tỷ lệ khung hình trong HLS.js và Video.js khi đổi media hoặc tải lại, và kết thúc tập tự nhiên trong chế độ kiosk nghiêm ngặt với HLS.js. Kịch bản media dùng giải mã thực; mọi kịch bản dùng DOM và đầu vào thực. Chỉ dữ liệu Plex và nguồn media là dữ liệu kiểm thử tổng hợp cục bộ.

Dữ liệu kiểm thử tỷ lệ khung hình chuyển đóng gói luồng truyền tải H.264/AAC đã lưu trong kho thành các biến thể fMP4 riêng. Header khởi tạo dùng nhãn `iso6` và thời lượng phim/track bằng không theo [mục 3.3 RFC 8216](https://www.rfc-editor.org/rfc/rfc8216#section-3.3). Mục mẫu AVC cũng dùng các bit dành riêng bắt buộc trong số lượng SPS và hằng có dấu `-1` ở trường cuối `pre_defined`. Việc này sửa cú pháp container do bộ ghép kênh kiểm thử đã ghim tạo ra. Hợp đồng dữ liệu kiểm thử kiểm tra header, từ chối box sai định dạng và chứng minh bộ tham số codec, ID track, thang thời gian và byte của phân đoạn media không đổi. Đây là xác thực đầu vào tổng hợp; tự nó không chứng minh khả năng phát trong trình duyệt hay thay thế ma trận RC đầy đủ.

Pull request yêu cầu Chromium, Firefox và WebKit hiện tại trên Linux, Chromium trên Windows và WebKit trên macOS. Bản dựng nightly và beta yêu cầu năm mục tiêu này. Đánh giá RC yêu cầu cả 35 mục tiêu khai báo: ba thế hệ Playwright/trình duyệt với phiên bản chính xác trên Linux, Windows và macOS, cộng Chrome/Edge ổn định đã cài trên cả ba hệ thống và Chrome/Edge beta trên Linux. Hai mục tiêu macOS WebKit lịch sử (Playwright 1.62.1 và 1.63.0) dùng `macos-15-intel`; bản ghi của chúng lưu kiến trúc tiến trình thực và từ chối runner ARM. Chẩn đoán MSE trực tiếp cho thấy cùng các byte khởi tạo H.264 và media hoàn tất trên Intel với 1.63 và ARM với 1.64, trong khi WebKit cũ trên VM ARM macOS 15 kẹt trước `updateend`. Đổi container, dùng ManagedMediaSource hoặc mở cửa sổ trình duyệt đều không khắc phục. Hai mục tiêu vẫn cần đủ năm kịch bản phát/giao diện gốc. Lựa chọn runner này không khẳng định điều gì về mọi thiết bị macOS vật lý hay Safari native. Khi tạo lại danh mục phải giữ các ghi đè runner đã duyệt; hợp đồng hồ sơ từ chối việc xóa chúng.

Cả ba thế hệ Linux WebKit đều chỉ định runner x64 `ubuntu-26.04`. So sánh môi trường chạy chính thức đã duyệt tái hiện lỗi chuyển trạng thái kiosk nghiêm ngặt trên Ubuntu 24.04, trong khi cùng ứng viên và năm kịch bản không đổi vượt qua bốn lần liên tiếp trên Ubuntu 26.04. Cách này chọn môi trường được hỗ trợ nhất quán, không thay từng thư viện đa phương tiện hay nới lỏng khẳng định phát. Các mục tiêu Linux khác giữ runner hiện có. Xem [đánh giá môi trường Linux WebKit](linux-webkit-runtime.md) để biết chính xác nguồn, hiện vật, kết quả so sánh và giới hạn. Ma trận RC đầy đủ và nghiệm thu gói native riêng vẫn bắt buộc.

Phiên bản sản phẩm được kiểm thử được ghi lúc chạy. Playwright Firefox là bản dựng đã vá của Playwright, không phải khẳng định về Firefox ESR native; WebKit không phải Safari. Ma trận này không thay thế đánh giá trên TV vật lý hoặc shell native.

Danh mục đầy đủ có **35 mục tiêu nền tảng: 32 hỗ trợ HLS và ba mục tiêu Windows WebKit chỉ kiểm tra giao diện**. Ba mục tiêu sau vẫn cần cả hai luồng tải/tải lại đã bản địa hóa; bản dựng WebKit của chúng không có MediaSource lẫn HLS native. Đây là giới hạn được khai báo, không phải phạm vi phát đã vượt qua. Ba ID mục tiêu chính xác được duyệt trong `scripts/browser-compatibility-profile.cjs`. Phép dò khả năng phải xác nhận giới hạn trước khi chạy kiểm tra giao diện. Nếu MSE (kể cả ManagedMediaSource) hoặc HLS native khả dụng, cổng kiểm tra thất bại cho đến khi nâng cấp hồ sơ. Mọi mục tiêu khác cần MSE cho cả H.264 và AAC cùng đủ năm kịch bản không đổi; mất khả năng sẽ thất bại thay vì chọn bộ kiểm thử nhỏ hơn. Phép dò tải thư viện HLS của ứng viên và kiểm tra backend do mặc định của instance đã ghim chọn: MediaSource, rồi ManagedMediaSource, rồi WebKitMediaSource. Bản ghi nêu backend và phiên bản HLS; thay đổi mặc định hoặc phiên bản cần duyệt rõ ràng hợp đồng phép dò.

Vì vậy, RC đầy đủ yêu cầu **166 lượt chạy kịch bản thành công** (32 × 5 + 3 × 2), với 35 bản ghi mục tiêu. Tập con PR/nightly/beta vẫn là năm mục tiêu và 25 lượt chạy. Mỗi bản ghi lưu đúng tập kịch bản, phép dò khả năng và phạm vi HLS đã đạt hoặc lý do không hỗ trợ rõ ràng. Đây là các yêu cầu đã cấu hình, không phải khẳng định một RC cụ thể đã hoàn thành. Giới hạn được xác nhận bởi [cấu hình dựng WebKit Windows](https://github.com/WebKit/WebKit/blob/56453fdfe0b0ca6258c23e6453b34f70b885d13f/Source/cmake/OptionsWin.cmake#L75) mà Playwright 1.64 sử dụng và phép dò môi trường đã ghim.

Cả hai đường chạy đều tải đúng ID hiện vật từ tác vụ tạo trong lần chạy hiện tại. Trước khi phục vụ thư mục mới giải nén, chúng kiểm tra checksum kho lưu trữ, commit nguồn, hash bundle/provider đóng gói, loại tệp và đường dẫn. Kiểm tra phát hành còn xác minh bản ghi dựng đã cố định. Tác vụ trình duyệt không dựng lại mã đang kiểm thử; chỉ cài phụ thuộc production. Máy chủ thử nghiệm vẫn cần danh mục provider đầy đủ từ nguồn; compiler chỉ được nạp khi thực sự tạo bundle, không phải lúc đọc hằng danh mục. Bằng chứng kịch bản lỗi, bỏ qua, cũ hoặc thiếu khiến cổng chung thất bại; trace, định danh môi trường thực và digest ứng viên được giữ cho từng mục tiêu.

Bảy tệp danh mục/lock được sinh từ `venus-os-ci-toolkit/scripts/prepare_browser_compatibility.py`. Gói ứng dụng và gói trình duyệt lịch sử có lockfile riêng. Runner do GitHub lưu trữ vẫn là mặc định; workflow chung giữ lựa chọn dự phòng Linux đã chuẩn bị, còn mục tiêu Windows/macOS cần hệ điều hành native tương ứng.

Kết luận phát hành chung kiểm tra từng mục tiêu đã chọn cùng SHA nguồn, lần chạy, lần thử, kênh và ID hiện vật ứng viên chính xác. RC không được dùng bằng chứng beta của năm mục tiêu. Nâng lên stable dùng byte của RC đã được chấp nhận. Sau lỗi, chạy lại toàn bộ workflow đánh giá; bản ghi từ lần thử cũ không được hoàn tất đánh giá mới.

## Chẩn đoán khi kết thúc

Sau khi nạp siêu dữ liệu của môi trường thực thi và ứng viên, `scripts/browser-acceptance.cjs` ghi `acceptance-terminal.json` vào `CI_BROWSER_DIAGNOSTICS` khi quá trình nghiệm thu kết thúc hoặc phát sinh ngoại lệ. Bản ghi chứa giai đoạn cuối cùng, định danh nguồn và ứng viên, mục tiêu trình duyệt, lần chạy và lần thử, thời gian đã trôi qua cùng trạng thái thoát của tiến trình kiểm thử, tín hiệu hoặc mã lỗi thuộc danh sách cho phép. Bản ghi nhỏ hơn 2 KiB và không chứa lỗi thô, URL, stdout/stderr, giá trị môi trường hay bản kết xuất bộ nhớ. Bản ghi được tạo với quyền truy cập độc quyền và chế độ `0600` trong thư mục đầu ra hiện có thuộc tác vụ; không ghi đè tệp đã có hoặc liên kết tượng trưng ở thành phần cuối của đường dẫn.

Đây là **bằng chứng chẩn đoán, không phải kết quả nghiệm thu thành công**. Bản ghi luôn khai báo `acceptance: false`; chỉ tệp riêng biệt `CI_BROWSER_EVIDENCE` mới có thể xác nhận ứng viên đạt yêu cầu sau khi tất cả điều kiện kiểm tra hiện có đều đạt. Lỗi ghi dữ liệu chẩn đoán không thể thay thế kết quả thành công hay thất bại ban đầu. Việc chương trình bao ngoài bị chấm dứt đột ngột, hoặc lỗi nạp siêu dữ liệu trước khi chương trình bắt đầu, có thể khiến không có bản ghi nào. Tín hiệu của tiến trình kiểm thử không chứng minh rằng tiến trình nội dung của Firefox đã nhận tín hiệu đó. Muốn xác định nguyên nhân sự cố native vẫn cần dấu vết ngăn xếp native tương ứng hoặc một trường hợp tái hiện có kiểm soát; một lần thử lại thành công không khép lại cuộc điều tra.

Công cụ hỗ trợ này không bật báo cáo sự cố thô của Firefox hay chế độ ghi nhật ký `DEBUG=pw:browser`. Bộ nhớ trình duyệt và đầu ra bảng điều khiển có thể chứa dữ liệu nhạy cảm, nên không được sao chép chúng vào các hiện vật tải lên thông thường nếu chưa có chính sách thu thập và truy cập được xem xét riêng. Thứ tự kịch bản, các phiên bản trình duyệt đã ghim, việc dùng một worker, không thử lại và các thời hạn chờ hiện có đều không thay đổi.

<a id="from-source-to-accepted-candidate"></a>

## Từ mã nguồn đến ứng viên được chấp nhận

![Nguồn, xác minh gói, kiểm tra khả năng và bằng chứng](diagrams/candidate-verification-flow.svg)

1. Dựng nguồn đã duyệt và đóng gói các tệp Mode A tạo ra. Giữ checksum kho lưu trữ và định danh nguồn cùng ứng viên.
2. Trước khi giải nén, xác minh giới hạn kích thước, đường dẫn an toàn, loại tệp, nguồn/phiên bản và danh mục hash đầy đủ của mục/provider. Đánh giá phát hành còn kiểm tra bản ghi dựng đã cố định.
3. Dò phiên bản trình duyệt thực và khả năng media. Chọn hồ sơ khai báo; khả năng không khớp phải gây lỗi thay vì âm thầm giảm phạm vi.
4. Chạy đúng tập kịch bản trên tệp đã giải nén, không dựng lại. Mỗi kịch bản phải chạy đúng một lần, không bỏ qua, lỗi hay thử lại.
5. Giữ môi trường, khả năng, digest ứng viên và kết quả. Cổng chung kiểm tra mục tiêu bắt buộc và sự khớp nhau của lần chạy/lần thử/nguồn trước khi nhận bằng chứng. Điều phối phát hành và nghiệm thu thiết bị vẫn là điều kiện riêng.

<a id="what-has-been-measured-locally"></a>

## Những gì đã đo cục bộ

![Xác minh tích hợp cục bộ: bộ kiểm thử thiết bị và trình duyệt đóng gói riêng](diagrams/browser-verification-results.svg)

Tại nguồn `c52f4d07`, lượt kiểm thử thiết bị-trình duyệt Chromium đầy đủ đạt 196 bài, với một bài HLS native bị bỏ qua đúng dự kiến. Riêng cùng kho Mode A đóng gói đạt năm kịch bản trong mỗi Chromium 156.0.8078.4, Firefox 157.0 và WebKit 27.2: 15 đạt, không bỏ qua hay thử lại. Đây là các bộ khác nhau; số lượng không phải tỷ lệ phần trăm phạm vi hoặc bằng chứng rằng cả 35 mục tiêu hosted đều đạt.

Các [bản ghi đã lưu](evidence/post779-local-acceptance/summary.json) nhận diện máy chủ thực macOS 26.7.1. Chúng phân biệt rõ với nhãn hồ sơ `macos-15` và không chứng nhận bản phát hành. Để lặp lại kiểm tra cục bộ trên Mac, cài phụ thuộc đã khóa và trình duyệt Playwright 1.64.0, dựng nguồn hiện tại rồi chạy [công thức đã lưu](evidence/post779-local-acceptance/reproduce.sh) với thư mục kho làm đối số. Công thức đóng gói bản dựng có sẵn, kiểm tra ứng viên, dò từng trình duyệt và lưu bản ghi mới dưới `.compatibility/`. Cần cổng 4189 và không được ghi đè thư mục `browser-candidate-web` hiện có. Giữ nguồn không đổi giữa bước dựng và chạy công thức. Kết quả CI hosted và thiết bị vật lý được theo dõi riêng trong [báo cáo triển khai](implementation-report.vi.md).
