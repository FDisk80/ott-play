<div lang="fa" dir="rtl">

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

برای فایل‌های محلی بدون اینترنت، [ویدئوهای محلی و پخش آفلاین](docs/offline-media.md) را ببینید.

[![مرورگر کانال OTT-play FOSS در نمای پرسپکتیو](docs/images/hero.png)](docs/images/studio-2026-default.png)

*تصویر رابط فعلی Studio 2026 با کانال‌ها و برنامه‌های آزمایشی ساختگی. تصویر را باز کنید تا نمای اصلی و تخت را ببینید؛ این تصویر از اشتراک زنده گرفته نشده است. [منبع تصویر و بازتولید](docs/images/README.md).*

[راهنمای شروع سریع به 88 زبان](docs/readme/README.md) · [ویکی مستندات](docs/wiki/Home.fa.md)

[![روش‌های برتر OpenSSF](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![آزمون فازینگ: فقط RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

نامزدهای انتشار عمومی، آزمون‌های فازینگ محدود و ایزوله را برای تجزیهٔ XMLTV در بخش بومی/سرور و اعتبارسنجی درخواست پورتال اجرا می‌کنند. [دامنهٔ فازینگ، بازتولید و شواهد انتشار](FUZZING.md) را ببینید.

پخش‌کنندهٔ مستقل IPTV/OTT با سرور HTTP محلی به زبان Rust. روی تلویزیون‌های هوشمند (LG WebOS، Samsung Tizen، Panasonic، Sony و غیره)، گیرنده‌ها (Infomir MAG، Dune HD، Enigma2، Android TV) و مرورگرهای دسکتاپ اجرا می‌شود.

برای لایه‌های اجرا، مسئولیت‌ها، روش گسترش ارائه‌دهندگان و اعتبارسنجی، از [راهنمای معماری و مشارکت](docs/architecture.md) شروع کنید. برای مرز هسته/میزبان و قراردادهای سازگاری، [نشست‌های پخش و طول عمر ارائه‌دهندگان](docs/playback-session-architecture.md) را ببینید.

<!-- ci-release-process:start -->
<a id="release-process"></a>

## فرایند انتشار

برای قواعد اعتبارسنجی، نسخهٔ شبانه، بتا، RC و ارتقا به پایدار، [راهبرد انتشار](RELEASING.md) و برای فرمان‌های محلی [راهنمای عملیاتی](docs/release-workflow.md) را ببینید.
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## اجرا در مرورگر

[دموی زنده](https://player.ottplay.here.now/) را باز کنید یا پخش‌کنندهٔ وب را طبق دستورهای زیر بسازید و میزبانی کنید.

[استقرار محلی macOS](docs/local-http-deployment.md) مبدأهای HTTP پخش‌کننده را روی درگاه‌های 8443–8446 فراهم می‌کند. درگاه 8095 بازنشسته شده است.

در اجرای نخست **امتحان دمو** را برای الگوی آزمون متحرک انتخاب کنید یا فهرست M3U یا ارائه‌دهندهٔ خود را تنظیم کنید. دمو بعداً نیز از **تغییر ارائه‌دهنده ← دمو** در دسترس است.

دمو اینترنت لازم دارد، ولی حساب ارائه‌دهنده نمی‌خواهد. کانال‌های آزمون بی‌صدای MP4 و HLS آن در here.now میزبانی می‌شوند و بین وب، Tauri، Capacitor و OTT Server مشترک‌اند. هنگام تغییر، تنظیمات قبلی ارائه‌دهنده حفظ می‌شوند. برای **آزمون تصویر و صدا**ی جداگانه، در موتور HTML5 مدیریت‌شده و هنگام بیکاری یا تماشای زنده، **اطلاعات ← صدا ← پخش** را باز کنید. این آزمون از فایل صدادار `av-v1.mp4` در here.now استفاده می‌کند و اینترنت می‌خواهد. کلیپ در بسته‌های پخش‌کننده نیست و هنگام شروع هرگز دریافت نمی‌شود. VOD، آرشیو و جایگزین‌های موتور دستگاه (از جمله PC2/Video.js و موتورهای بومی) مستثنا هستند؛ [مراحل، صداهای مورد انتظار و نمودار میزبانی](docs/audio-video-check.fa.md) را ببینید.

پنجرهٔ برنامهٔ مرورگری نصب‌شده روی دسکتاپ از **Window Controls Overlay** پشتیبانی می‌کند: Chrome می‌تواند نوار عنوان جداگانه را پنهان کند و دکمه‌های پنجره و منوی برنامه را روی پخش‌کننده نگه دارد. برنامهٔ نصب‌شده را باز کنید و وقتی Chrome پیشنهاد می‌دهد **Hide title bar** را انتخاب کنید؛ **Show title bar** قاب معمول را برمی‌گرداند. برگه‌های عادی و چیدمان تلویزیون/پوستهٔ بومی رفتار قبلی را حفظ می‌کنند. برای نشانی‌های نصب پشتیبانی‌شده، به‌روزرسانی میان‌بر و بررسی، [کنترل پنجرهٔ مرورگر](docs/browser-window-controls.md) را ببینید.

برای جابه‌جایی ده‌ثانیه‌ای در نمای اصلی ویدئو، در حالت تمام‌صفحه یا عادی از **Alt/Option + چپ/راست** استفاده کنید (**Command + چپ/راست** نیز روی macOS کار می‌کند). ویدئوهای محلی، VOD و آرشیوهای پشتیبانی‌شده همین کنترل‌ها را در وب، Tauri و Capacitor دارند. [میان‌برهای صفحه‌کلید و محدودیت‌ها](docs/browser-window-controls.md#playback-keyboard-shortcuts) را ببینید.

در رابط رایانه، **R** کانال یا ویدئوی متفاوتی را به‌طور تصادفی از فهرست فعلی پخش می‌کند، بدون درهم‌ریختن ترتیب فهرست. در نمای اصلی ویدئو و فهرست‌های کانال/ویدئو کار می‌کند؛ ویرایشگر متن، کادرها، تنظیمات و محدودیت‌های کیوسک اولویت دارند. نگاشت کلید سایر دستگاه‌ها تغییر نمی‌کند.

الگوی آزمون ساختگی را می‌توان با `scripts/generate-demo-media.sh` بازتولید کرد (نیازمند FFmpeg)؛ رسانهٔ تولیدشده در پوشهٔ نادیده‌گرفته‌شدهٔ `.local-artifacts` می‌ماند.

<a id="features"></a>

## امکانات

- **پخش**: جریان‌های HLS، DASH و HTTP ساده، با سقف کیفیت مدیریت‌شدهٔ HLS.js/Shaka، بازیابی محدود و تا سه URL پشتیبان صریح برای هر کانال زنده. آرشیو/VOD هرگز به پشتیبان زنده منتقل نمی‌شود؛ [کیفیت و بازیابی](docs/playback-stream-policy.fa.md) را ببینید.
- **EPG**: تطبیق XMLTV، جابه‌جایی زمانی/تماشای مجدد، جست‌وجوی عنوان برنامه (N5 در EPG)، یادآورها و اتصال دستی خوراک/شناسه به کانال دقیق در مسیر XMLTV میزبانی‌شده/بومی. [اتصال و دسترس‌پذیری](docs/guide-binding-accessibility.fa.md) را ببینید.
- **علاقه‌مندی‌ها**: یک [مجموعهٔ ترکیبی](docs/mixed-favorites.md) مرتب از ارائه‌دهندگان و پروفایل‌های پیکربندی‌شده در میزبان‌های پشتیبانی‌شده، با خروجی/ورودی قابل‌انتقال از طریق CLI؛ PIN والدین. فهرست‌های علاقه‌مندی هر منبع در حالت جایگزین همچنان در دسترس هستند.
- **تنظیمات**: صدور/ورود JSON تنظیمات و علاقه‌مندی‌ها، دفتر بازگردانی برای دسته‌های localStorage پشتیبانی‌شده، ادامهٔ آرشیو با آگاهی از منبع و مقایسهٔ دقیق تنظیمات ذخیره‌شده برای گردش کار کنترل‌کننده. بازیابی فرض می‌کند فقط یک نویسنده وجود دارد؛ آداپتورهای ذخیره‌سازی سفارشی بازگردانی با بهترین تلاش را حفظ می‌کنند. [بازیابی تنظیمات](docs/settings-recovery.fa.md) را ببینید.
- **رابط مشترک**: OTT Server، Tauri و Capacitor از پوسته و تنظیمات نمایش فهرست کانال یکسان استفاده می‌کنند. بخش [رنگ‌های رابط](docs/interface-colors.md) نُه نقش رنگی، یک پالت، ورود دقیق مقادیر HEX/RGB/HSV و پنج طرح رنگ را ارائه می‌دهد و تنظیمات برای همان کلاینت ذخیره می‌شوند؛ تنظیمات فهرست کانال نام، آیکون، برنامهٔ فعلی، پیشرفت و نشان آرشیو را کنترل می‌کند.
- **ارائه‌دهندگان**: M3U/M3U8، تلویزیون زندهٔ Xtream همراه [کاتالوگ فیلم/سریال درخواستی](docs/xtream-media.fa.md)، Stalker/Ministra همراه با [فیلم‌ها و قسمت‌های تودرتوی پروتکل کلاسیک](docs/stalker-media.md)، Plex و VPortal. قابلیت ارائه‌دهنده و دسترسی حساب تعیین می‌کنند کدام امکانات آرشیو و کتابخانهٔ رسانه موجود است.
- **فرمان‌های push**: کنترل از راه دور با webhook — تغییر کانال، ارائه‌دهنده، فهرست و نمایش اعلان.
- **ورود متن از راه دور (swop)**: صفحه‌کلید گوشی از طریق Cloudflare Worker وقتی تلویزیون و گوشی در شبکه‌های متفاوت‌اند (نشست مجاز برای نصب؛ ♥™ روی VKB).
- **مسیریابی هر دستگاه**: نشانی‌دهی UUID برای چند دستگاه.
- **پروکسی محلی**: سرور فرمان محلی اختیاری برای اتوماسیون کاملاً محلی (بدون سرور مرکزی).
- **یکپارچگی کنترل‌کننده**: اپراتور محدود به دستگاه/عملیات، نتیجهٔ ماندگار اختیاری فرمان‌ها، اعمال قابل‌ادامهٔ پیش‌تنظیم Local/Home و انتقال زنده/آرشیو از همان منبع با [سرور کنترل](https://github.com/open-ott-play/ottplay-control-server) هم‌نسخه. این‌ها کنترل‌کننده/CLI به‌روز می‌خواهند؛ یک برگهٔ مرورگر مستقل آن‌ها را فراهم نمی‌کند.
- **تنظیمات راه دور با نوع مشخص**: تنظیمات را پیدا کنید، مقادیر ذخیره‌شده و مؤثر را بخوانید و با بررسی نمونهٔ در حال اجرا، منبع و بازبینی ذخیره کنید؛ [تنظیمات راه دور و پیکربندی VPortal](docs/remote-player-settings.md) را ببینید.
- **اشکال‌زدایی**: HUD پخش / گزارش حلقوی اختیاری با `?debug=1`، بازرسی از راه دور با رضایت و آزمون صوت/ویدئوی میزبانی‌شده هنگام درخواست.
- **دسترس‌پذیری صفحه‌کلید**: کادرهای کلاسیک نام‌دار، محصورکردن و بازگرداندن تمرکز Tab، معنای کانال انتخاب‌شده و اعلان وضعیت غیرمزاحم. این بهبودها به‌معنای انطباق کامل WCAG یا صفحه‌خوان دستگاه نیست.
- **24 نوع دستگاه**: نگاشت کلید کنترل از راه دور مخصوص هر دستگاه.
- **88 زبان رابط**: کاتالوگ‌های متناظر، [شروع سریع بومی‌شده](docs/readme/README.md) و [الفبای صفحه‌کلید بررسی‌شده با CLDR](docs/localization.md). راهنمای اصلی و راهنماهای ویژگی جفت‌شده به [24 زبان مستندات](docs/manual-translations.md) موجودند؛ منابع مهندسی دیگر زبان‌های فعلی را حفظ می‌کنند.

[راهنمای تحویل](docs/roadmap-delivery.fa.md) امکانات پیاده‌شده در این بازبینی منبع، مرز پلتفرم‌ها، نمودارها و اعتبارسنجی را شرح می‌دهد. نسخه‌های نصب‌شده یا استقرارهای میزبانی‌شده ممکن است قدیمی‌تر باشند. [برنامهٔ Android](https://github.com/open-ott-play/ottplay-android) بومی مستقل نیز انتخاب صدا/زیرنویس را بر اساس زبان، نقش و برچسب، نه شاخص manifest، نگه می‌دارد؛ پیاده‌سازی و انتشارش از این رابط جداست.

[بررسی منابع STB](docs/stb-player-improvements.md) بهبودهای رسانه، منابع و بازیابی، مقایسهٔ منابع و محدودیت‌های فعلی را توضیح می‌دهد.

<a id="debug-hud"></a>

## HUD اشکال‌زدایی

HUD محلی و ماندگاری گزارش سرور رضایت‌های جداگانه می‌خواهند. پیش از گردآوری گزارش از دستگاه‌های دیگر، [دسترسی تشخیصی، حذف اطلاعات حساس و نگهداری](docs/diagnostic-security.md) را ببینید.

حالت اشکال‌زدایی را با یکی از این روش‌ها فعال کنید:
- URL: `?debug=1` یا `?debug=true`
- ذخیره‌سازی محلی: `localStorage.setItem("ottplay_debug", "1")`
- ویژگی پنجره: `window.__OTT_DEBUG__ = true`
- سرور: وقتی `/debug/config` مقدار `{enabled: true}` برمی‌گرداند

وقتی اشکال‌زدایی فعال است:
- **D** را برای تغییر نمایش نوار HUD بزنید (`ottDebugSetHud` / `__ottDebug.toggleHud()`)
  - وقتی تمرکز روی INPUT/TEXTAREA/listEdit است نادیده گرفته می‌شود
  - برای پرهیز از تداخل PLAY/PREV=68 در MAG/Maple از `e.key` استفاده می‌کند
- منوی اطلاعات ← **Debug HUD** ← فراخوانی `__ottDebug.toggleHud()`
- مدیریت تنظیمات ← **Debug HUD**:
  - اگر اشکال‌زدایی بارگذاری شده: نمایش HUD را تغییر می‌دهد
  - وگرنه: `ottplay_debug=1` + `ottplay_debug_hud=1` را تنظیم و راه‌اندازی مجدد را درخواست می‌کند
- ماندگاری: `ottDebugSetHud` وضعیت HUD را در `localStorage.ottplay_debug_hud` ("1"/"0") ذخیره می‌کند

<a id="capacitor-ios-and-android"></a>

## Capacitor برای iOS و Android

این مخزن رابط TypeScript مشترک را با Capacitor برای iOS و Android 7+ بسته‌بندی می‌کند. هر دو از فونت سیستم و runtime بومی قفل‌شده با npm استفاده می‌کنند. APK سازگاری جداگانهٔ API 22 از Android 5.1/6 با WebView 60 یا جدیدتر پشتیبانی می‌کند. هر دو APK Android امضاشده‌اند و در انتشارهای بتا، RC و پایدار واجد شرایط، کنار IPA بدون امضای iOS قرار می‌گیرند. برنامهٔ Kotlin مستقل در [ottplay-android](https://github.com/open-ott-play/ottplay-android) باقی می‌ماند.

</div>

<div dir="ltr">

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

</div>

<div lang="fa" dir="rtl">

[پیکربندی Capacitor](docs/capacitor-mobile.md) و [توزیع Android و به‌روزرسانی از راه دور](docs/android-distributions.md) را ببینید.

رابط iOS افقی است. تنظیمات، پیکربندی ارائه‌دهنده، رضایت کنترل از راه دور و ورود/صدور JSON همچنان از رابط مشترک استفاده می‌کنند. چندوظیفگی تبلت می‌تواند جهت درخواستی را نادیده بگیرد.

در iPhone روی فهرست کانال عمودی بکشید تا بین ردیف‌ها و صفحه‌ها حرکت کنید؛ بالا برای کانال‌های بعدی و پایین برای قبلی‌ها. پرتاب سریع چند صفحه ادامه پیدا می‌کند و آرام می‌ایستد؛ کشیدن آهسته دقیق می‌ماند. برای توقف حرکت، صفحه را لمس کنید یا کلید پیمایش بزنید. یک لمس کانال زیر انگشت را پخش می‌کند، حتی اگر ردیف دیگری انتخاب شده باشد. کشیدن هنگام برداشتن انگشت هرگز کانالی باز نمی‌کند.

ویدئو در iPhone داخل صفحه پخش می‌شود. برای اطلاعات برنامه پایین صفحه را لمس کنید یا هنگام ادامهٔ پخش منو را باز کنید. تصویر در تصویر گزینهٔ جداگانه‌ای می‌ماند.

آزمون اولیهٔ دستگاه: [فهرست Mode B](docs/mode-b-device-smoke.md) و `./scripts/smoke-capacitor-device.sh --help` (هدف ساخت/همگام‌سازی فقط iOS). آزمون Tauri دسکتاپ: [فهرست دسکتاپ](docs/mode-b-tauri-smoke.md).

<a id="installation"></a>

## نصب

| پلتفرم | بسته | توضیح |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | ساخت جداگانهٔ Apple Silicon و Intel؛ امضای ad-hoc مگر امضای Apple تنظیم شده باشد |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | توزیع‌های گوناگون |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode یا Homebrew Channel](docs/lg-webos-installation.md)؛ پخش‌کنندهٔ میزبانی‌شده، نیازمند شبکه |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode و امضای محلی؛ بستهٔ تلویزیون بدون امضا، جدا از Family Hub](docs/samsung-tizen-installation.md) |
| **iOS** | `.ipa` از AltStore / TestFlight / Xcode | فقط نصب جانبی — هنوز در App Store نیست |
| **Android (رابط مشترک)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | بسته‌های امضاشدهٔ Capacitor؛ نسخهٔ مناسب Android را انتخاب کنید |
| **Android (Kotlin بومی)** | [برنامهٔ بومی](https://github.com/open-ott-play/ottplay-android) جداگانه | مخزن عمومی؛ برنامه و گردش انتشار جداگانه |

نصب‌کننده‌های پشتیبانی‌شده به انتشارهای واجد شرایط GitHub پیوست می‌شوند: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **نکته:** بسته‌های برنامهٔ macOS بدون اطلاعات امضای Apple از امضای ad-hoc استفاده می‌کنند؛ این Developer ID یا notarization نمی‌دهد. نصب‌کننده‌های Windows/Linux و بسته‌های iOS ممکن است بدون امضا باشند. iOS پیش از نصب روی دستگاه واقعی امضا می‌خواهد. APKهای انتشار واجد شرایط Full و API 22 از گواهی امضای تثبیت‌شده استفاده می‌کنند؛ ساخت انتشار محلی برای APK امضاشده keystore تنظیم‌شده لازم دارد.

---

<a id="macos"></a>

### macOS

1. تگ مورد نظر را از [انتشارها](https://github.com/open-ott-play/ottplay-foss/releases) انتخاب کنید. میان‌بر آخرین انتشار نسخهٔ پایدار را انتخاب می‌کند، نه بتا یا RC.
2. برای Apple Silicon فایل `OttPlay.FOSS_*_aarch64-apple-darwin.dmg` و برای Intel فایل `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` را بگیرید. معماری ساخت آن‌ها جداست.
3. `.dmg` را باز و **OttPlay FOSS.app** را به Applications بکشید.
4. پیش از اولین اجرا، بستهٔ کپی‌شده را اعتبارسنجی کنید:

</div>

<div dir="ltr">

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

</div>

<div lang="fa" dir="rtl">

اعتبارسنجی موفق یکپارچگی بسته را بررسی می‌کند. `Signature=adhoc` یعنی برنامه هویت توسعه‌دهندهٔ تأییدشده با Apple ندارد؛ notarization یا تأیید Gatekeeper را اثبات نمی‌کند. با دانلود مورد اعتماد و بستهٔ معتبر نیز macOS ممکن است بعد از تلاش اول، **تنظیمات سیستم ← حریم خصوصی و امنیت ← Open Anyway** بخواهد؛ [دستور Apple](https://support.apple.com/en-us/102445) را ببینید.

پیام «برنامه آسیب دیده» به‌تنهایی قرنطینه را ثابت نمی‌کند. اگر اعتبارسنجی امضا شکست خورد، خطا را نگه دارید و انتشار اصلاح‌شده بگیرید. برنامهٔ دانلودشده را دوباره امضا نکنید و ویژگی‌هایش را حذف نکنید تا بررسی ناموفق ظاهراً موفق شود.

جایگزین‌های ZIP عبارت‌اند از `OttPlay.FOSS_aarch64-apple-darwin.app.zip` و `OttPlay.FOSS_x86_64-apple-darwin.app.zip`. برای استخراج، تصویر دیسک و بررسی Gatekeeper، [امضای macOS و اعتبارسنجی فایل انتشار](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact) را ببینید. برای ساخت از checkout و نصب محلی، [تحویل محلی macOS](docs/macos-local-delivery.md) را استفاده کنید.

---

<a id="windows"></a>

### Windows

1. `.msi` یا `.exe` را از [انتشارها](https://github.com/open-ott-play/ottplay-foss/releases/latest) بگیرید
2. نصب‌کننده را اجرا و مراحل را دنبال کنید
3. از منوی Start یا میان‌بر دسکتاپ اجرا کنید

---

<a id="linux"></a>

### Linux

پخش Linux علاوه بر WebKitGTK، افزونه‌های GStreamer برای HLS، H.264 و AAC می‌خواهد. بسته‌ها این وابستگی‌های رسانه را اعلام می‌کنند؛ ساخت AppImage چارچوب رسانه را همراه دارد. برای بررسی کدک و تفاوت پذیرش مرورگر و بومی، [بسته‌بندی رسانهٔ Linux](docs/linux-media-packaging.md) را ببینید.

**AppImage:**

</div>

<div dir="ltr">

```bash
chmod +x OttPlay.FOSS_*_amd64.AppImage
./OttPlay.FOSS_*_amd64.AppImage
```

</div>

<div lang="fa" dir="rtl">

**Debian/Ubuntu (.deb):**

</div>

<div dir="ltr">

```bash
sudo apt install ./OttPlay.FOSS_*.deb
```

</div>

<div lang="fa" dir="rtl">

**Fedora (.rpm):**

</div>

<div dir="ltr">

```bash
sudo dnf --enablerepo=fedora-cisco-openh264 install ./OttPlay.FOSS-*.rpm
```

</div>

<div lang="fa" dir="rtl">

---

<a id="ios-installation"></a>

### نصب iOS

iOS پیش از نصب روی دستگاه واقعی امضا لازم دارد. برای IPA بدون امضای انتشار از AltStore Classic استفاده کنید یا با Xcode از منبع بسازید و امضا کنید. TestFlight در صورت ارائه، دعوت جداگانه می‌خواهد.

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### گزینهٔ 1: AltStore Classic (پیشنهادی برای استفادهٔ شخصی)

AltServer روی رایانه اجرا می‌شود؛ AltStore Classic روی iPhone/iPad اجرا و IPA را وارد می‌کند. حساب رایگان Apple کافی است.

**پیش‌نیازها:**

- iPhone/iPad با **iOS/iPadOS 15 یا جدیدتر** برای ساخت فعلی OTT-play.
- رایانهٔ Mac یا Windows با AltServer و کابل دادهٔ USB.
- حساب Apple برای امضا و اینترنت برای دانلود انتشار.

**مرحلهٔ 1: یک‌بار AltStore را تنظیم کنید**

1. AltServer را با راهنمای رسمی [نصب macOS](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) یا [نصب Windows](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows) نصب کنید. آن را اجرا و از نماد نوار منو/سینی سیستم استفاده کنید.
2. دستگاه را با USB وصل، قفلش را باز و پیام‌های اعتماد رایانه/دستگاه را قبول کنید. در Mac حضورش در Finder را بررسی کنید.
3. در **منوی AltServer ← Install AltStore** دستگاه را انتخاب و مراحل حساب امضا را کامل کنید. منتظر اعلان نصب بمانید.
4. روی دستگاه **تنظیمات ← عمومی ← VPN و مدیریت دستگاه** را باز کنید و در صورت درخواست، مدخل توسعه‌دهندهٔ حساب امضا را مورد اعتماد قرار دهید. در iOS 16+، **تنظیمات ← حریم خصوصی و امنیت ← Developer Mode** را فعال و مراحل راه‌اندازی مجدد/تأیید را کامل کنید.
5. AltStore را روی دستگاه باز کنید. اگر از قبل نصب و فعال است، این تنظیم را رد کنید و AltServer را برای ورود فایل زیر روشن نگه دارید.

**مرحلهٔ 2: انتشار انتخابی را روی iPhone/iPad وارد کنید**

1. تگ دقیق را از [همهٔ انتشارها](https://github.com/open-ott-play/ottplay-foss/releases) انتخاب و `ottplay-foss-ios-unsigned.ipa` آن را در Safari دستگاه دانلود کنید. [میان‌بر آخرین انتشار](https://github.com/open-ott-play/ottplay-foss/releases/latest) نسخهٔ پایدار را انتخاب می‌کند؛ برای بتا از فهرست کامل استفاده کنید.
2. IPA را در Files ذخیره کنید. در **AltStore ← My Apps ← +** فایل را انتخاب کنید. می‌توانید IPA دانلودشده را با AirDrop از Mac منتقل و پیش از ورود در Files ذخیره کنید. بازکردن IPA روی Mac این مرحلهٔ ورود نیست.
3. هنگام امضا و نصب AltStore، AltServer را روشن و کابل USB را وصل نگه دارید. برای به‌روزرسانی، حساب امضای نصب فعلی را به کار ببرید؛ حذف برنامه را اولین راه عیب‌یابی قرار ندهید.
4. منتظر پایان ورود بمانید، OTT-play را در **My Apps** بررسی و سپس اجرا کنید.

**جایگزین: ورود مستقیم URL انتشار**

وقتی AltStore نصب است، الگوی زیر را در **Safari روی iPhone** وارد، `TAG` را با تگ دقیق جایگزین و **Open in AltStore** را قبول کنید:

</div>

<div dir="ltr">

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

</div>

<div lang="fa" dir="rtl">

این روش از [مدیریت‌کنندهٔ URL نصب](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift) در AltStore استفاده می‌کند. وقتی چند دانلود نام یکسان دارند، ابهام Files/Recents را حذف می‌کند. URL باید به فایل IPA اشاره کند، نه صفحهٔ انتشار.

مثلاً ورود زیر در **2026-09-29** با AltStore 2.3 و AltServer 1.8.1 بررسی شد. این مثال تاریخی ثابت است، نه پیوند آخرین نسخه:

</div>

<div dir="ltr">

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

</div>

<div lang="fa" dir="rtl">

**تمدید:** نصب حساب رایگان پس از هفت روز منقضی می‌شود. AltServer را دسترس‌پذیر نگه دارید و پیش از انقضا **AltStore ← My Apps ← Refresh All** را اجرا کنید. تمدید پس‌زمینه هم دسترسی به AltServer می‌خواهد؛ [دستور تمدید AltStore](https://faq.altstore.io/altstore-classic/your-altstore) را ببینید.

<a id="verify-the-installed-version-before-retrying"></a>

#### پیش از تلاش مجدد نسخهٔ نصب‌شده را بررسی کنید

پیام «Sent» در AirDrop فقط انتقال را تأیید می‌کند. نوار پیشرفت AltStore فقط شروع ورود را نشان می‌دهد. قطع Mirroring/USB شکست نصب را اثبات نمی‌کند: پیش از فرستادن دوبارهٔ IPA برنامهٔ نصب‌شده را بررسی کنید.

در Mac که Xcode نصب و به‌عنوان پوشهٔ توسعه‌دهندهٔ فعال انتخاب شده است، دستگاه را بدون نصب مجدد بررسی کنید:

</div>

<div dir="ltr">

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

</div>

<div lang="fa" dir="rtl">

در `result.apps` فایل JSON، OTT-play را بیابید (`bundleIdentifier` با `play.ott.foss` شروع می‌شود) و هر دو `version` و `bundleVersion` را با `CFBundleShortVersionString` و `CFBundleVersion` فایل IPA انتخابی مقایسه کنید. پسوند حساب امضای AltStore در شناسهٔ بسته طبیعی است. گزارش دستگاه را محلی نگه دارید.

مثال بررسی‌شدهٔ beta.9، **نسخهٔ `1.1.51`، ساخت `2.2.66`** گزارش می‌کند. این نصب را تأیید می‌کند؛ بازشدن برنامه، ورود Cloudflare، بارگذاری فهرست، پخش و PiP آزمون‌های جداگانهٔ دستگاه‌اند.

<a id="troubleshooting-ios-installation"></a>

#### عیب‌یابی نصب iOS

- **AltServer پنجره ندارد یا بازکردن خودکارش timeout می‌شود:** از نماد نوار منو/سینی سیستم استفاده کنید. برنامه‌ای پس‌زمینه است. تلاش مکرر برای پنجرهٔ عادی، IPA را وارد نمی‌کند.
- **«Could not find AltServer» یا دستگاه USB در دسترس نیست:** اجرای AltServer را بررسی، قفل گوشی را باز و پیام‌های اعتماد رایانه/دستگاه را چک کنید. حضور در Finder را در Mac بررسی کنید. اگر اتصال قطع شده، در زمان امن وصل کنید و پیش از تلاش مجدد نسخهٔ نصب‌شده را ببینید. در صورت ادامه [عیب‌یابی اتصال AltStore](https://faq.altstore.io/altstore-classic/troubleshooting-guide) را دنبال کنید. اگر گوشی اینترنت رایانه را می‌دهد، تغییر کابل/شبکه را هماهنگ کنید تا کار دیگر قطع نشود.
- **iPhone Mirroring پیام «iPhone in Use» دارد یا روی «Connecting» می‌ماند:** تنظیم را روی گوشی واقعی تمام کنید یا صفحه‌اش را قفل و نزدیک Mac بازشده بگذارید. بازکردن قفل گوشی Mirroring را تمام می‌کند؛ اعتماد/تنظیم USB شاید ابتدا گوشی باز بخواهد. اگر یک اتصال مجدد هم گیر کرد، Mirroring را ببندید و روی گوشی ادامه دهید. [نیازمندی‌های Mirroring در Apple](https://support.apple.com/en-us/120421) را ببینید. Mirroring برای نصب اختیاری است.
- **URL در Mirroring حروف لاتین را از دست می‌دهد یا سیریلیک می‌شود:** **منبع ورودی Mac را ABC/English** کنید. با تمرکز روی Mirroring، **Control–Space** بزنید و برای صفحه‌کلید سخت‌افزاری iPhone، **English (US)** را برگزینید. منابع Mac و iPhone می‌توانند متفاوت باشند؛ تغییر Mac به‌تنهایی در جلسهٔ بررسی‌شده کافی نبود. کادر را پاک، URL را دوباره وارد و پیش از ارسال بررسی کنید.
- **چسباندن کلیپ‌بورد در Mirroring گیر می‌کند یا متن غیرمنتظره می‌گذارد:** کادر را پاک و با ورودی English (US) آیفون، آهسته در بخش‌های کوتاه بنویسید یا URL را مستقیم روی گوشی وارد کنید. ورود سریع در Mirroring ممکن است حرف حذف یا تکرار کند؛ نشانی کامل را پیش از ذخیره ببینید. URL ناقص ارسال نکنید. چسباندن در جلسهٔ نصب ما شکست خورد؛ پیش‌نیاز روش URL مستقیم نیست.
- **Files/Recents چند نام IPA یکسان دارد:** محل دانلود دقیق یا URL مستقیم تگ‌دار بالا را انتخاب کنید. می‌توان نام کپی محلی را برای وضوح با تگ/ساخت تغییر داد؛ تغییر نام محتوا را عوض نمی‌کند.
- **برنامهٔ نصب‌شده باز نمی‌شود:** پیام اعتماد توسعه‌دهنده یا Developer Mode گوشی را دنبال کنید. انقضا را در AltStore بررسی و در صورت نیاز تمدید کنید. اگر هنوز شکست خورد، خطای واقعی را ثبت کنید؛ خطای اتصال به‌تنهایی دلیل حذف و نصب دوباره نیست.
- **OTT-play باز می‌شود ولی فهرست محافظت‌شده روی اینترنت همراه شکست می‌خورد:** نصب و احراز هویت منبع جدا هستند. با **تنظیمات ← مدیریت تنظیمات ← دسترسی منبع** به منبع تنظیم‌شده وارد و سپس فهرست را دوباره بارگذاری کنید. درخواست زیست‌سنجی/passkey یا کد ایمیل را در صورت نیاز روی دستگاه واقعی کامل کنید. منبع باید [یکپارچگی iOS Access](docs/ios-source-access.md) را پشتیبانی کند؛ نصب برنامه فهرست مجاز IP را دور نمی‌زند.
- **در Wi-Fi مورد اعتماد passkey خواسته می‌شود:** برای منابع دارای iOS Access، برنامه ابتدا منبع اصلی را بدون ورود امتحان و فقط پس از رد دسترسی از ورودی موبایل احرازهویت‌شده استفاده می‌کند. IP عمومی دیده‌شده توسط منبع، شامل IPv6، را بررسی کنید: IPv4 خانهٔ مجاز، IPv6 متفاوت، VPN یا نشانی موبایل را پوشش نمی‌دهد. تغییر شبکه و بازکردن دوبارهٔ برنامه ترجیح مسیر موقت را پاک می‌کند. خطای عمومی شبکه/سرور نباید ورود را فعال کند.
- **ورود دیگر نشان داده نمی‌شود ولی فهرست خالی است:** نشست ذخیره‌شدهٔ معتبر بدون درخواست دوباره استفاده می‌شود. پس از بارگذاری ناموفق قبلی یا اصلاح سرور، فهرست را دوباره بارگذاری یا برنامه را یک‌بار کامل ببندید و باز کنید. اگر ادامه یافت، بررسی کنید منبع فهرست می‌دهد نه صفحهٔ ورود HTML یا خطای JSON. خطای نمایش‌داده‌شده و وضعیت HTTP را ثبت کنید؛ URL منبع دارای اطلاعات ورود، cookie یا توکن Access را به اشتراک نگذارید.
- **کانال‌ها می‌آیند ولی ویدئو buffer می‌کند یا `SRC_NOT_FOUND` می‌دهد:** بارگذاری فهرست و پخش دو بررسی مستقل‌اند. پس از ورود یک‌بار کانال را دوباره امتحان کنید؛ اگر ادامه داشت manifest HLS، پاسخ قطعات و پشتیبانی کدک جریان را ببینید. این خطا به‌تنهایی ثابت نمی‌کند تغییر موتور یا نصب دوباره کمک می‌کند.

<a id="option-2-testflight-if-available"></a>

#### گزینهٔ 2: TestFlight (در صورت وجود)

اگر دعوت TestFlight منتشر شد، TestFlight را از App Store نصب، دعوت را روی دستگاه باز و **Install** را بزنید. دانلود IPA از GitHub دعوت TestFlight نمی‌دهد.

<a id="option-3-xcode-for-developers"></a>

#### گزینهٔ 3: Xcode (برای توسعه‌دهندگان)

[ساخت و بازکردن](docs/capacitor-mobile.md#build-and-open) را دنبال، هدف **App** را در Xcode انتخاب، تیم توسعه را زیر **Signing & Capabilities** تنظیم و دستگاه متصل را انتخاب کنید و بسازید/اجرا کنید. پیام‌های اعتماد و Developer Mode را کامل کنید. ورود IPA بدون امضا به پنجرهٔ Devices در Xcode هویت امضا یا provisioning profile گمشده را فراهم نمی‌کند.

---

<a id="android-application"></a>

### برنامهٔ Android

برای رابط مشترک، Full Capacitor APK انتشار این مخزن را انتخاب کنید. روی Android 5.1–6 از APK سازگاری API 22 استفاده کنید؛ WebView 60 یا جدیدتر می‌خواهد. هنگام به‌روزرسانی هویت برنامه و گواهی امضا را حفظ کنید تا پروفایل‌های موجود بمانند. [دستور ساخت](android/README.md) و [توزیع، امضا و نصب از راه دور](docs/android-distributions.md) را ببینید.

[مخزن مستقل ottplay-android](https://github.com/open-ott-play/ottplay-android) برنامهٔ Kotlin/Compose بومی را دارد. هویت، ترجیحات و گردش انتشار خودش را دارد و جای نصب Capacitor را همان‌جا نمی‌گیرد. فایل‌های انتشار تاریخی همچنان موجودند.

---

<a id="quick-start"></a>

## شروع سریع

</div>

<div dir="ltr">

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

</div>

<div lang="fa" dir="rtl">

برای آزمون اولیهٔ مرورگر از استقرار خودتان با همین بازبینی استفاده کنید.

از Node 22 و toolchain پایدار Rust استفاده کنید. سرور را از ریشهٔ مخزن اجرا کنید تا منابع ایستا در دسترس باشند. ساخت بومی ابزار پلتفرم شرح‌داده‌شده در پایین را می‌خواهد؛ برای ساخت فقط سرور لازم نیست.

در بارگذاری اول **امتحان دمو** را بزنید یا **تنظیمات ← تغییر ارائه‌دهنده ← فهرست‌های M3U / M3U8** را باز کنید. **انتخاب فهرست** را باز، یک جایگاه را انتخاب، **URL فهرست** را وارد و ویرایش را ذخیره کنید و **بارگذاری فهرست** را بزنید. فهرست یا حساب ارائه‌دهنده را شما می‌دهید؛ برنامه اشتراک کانال پولی فراهم نمی‌کند.

<a id="mode-a-companion-smoke"></a>

## آزمون اولیهٔ همراه Mode A

آزمون curl برای همراه Mode A (برابری `ottplay-server` / `archive/server.py`): index، پوشه‌های ایستا، `/logo`، `/version`، `/epg` اختیاری و بررسی بدون دریافت برای `POST /m3u/cp.php`.

</div>

<div dir="ltr">

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

</div>

<div lang="fa" dir="rtl">

بررسی‌ها در `scripts/modea-smoke-checks.json` هستند. بدون اسرار. صف فرمان / `local_proxy.py` (:8081) جداگانه با `scripts/smoke-command-queue.sh` (در صورت وجود) بررسی می‌شود.

<a id="classic-stalker--ministra-portals"></a>

## پورتال کلاسیک Stalker / Ministra

**پورتال‌های Stalker** را برگزینید و MAC صادرشده از ارائه‌دهنده و URL کامل پورتال، مثلاً `http://provider.example/stalker_portal/c/` را وارد کنید. URLهای `/c/index.html`، `/stalker_portal`، `/server/load.php`، `/load.php` و `/portal.php` پروتکل کلاسیک MAG را انتخاب می‌کنند. پیکربندی موجود با نشانی سرور خالی از مسیر، JSON-RPC را حفظ می‌کند. ارائه‌دهنده با هستهٔ مشترک Stalker پروفایل، ژانر و کانال‌های زندهٔ صفحه‌بندی‌شده را می‌گیرد و سپس فیلم‌ها و قسمت‌های تودرتوی پروتکل کلاسیک `type=vod` را در پس‌زمینه پیدا می‌کند. مسیر پوشه‌ها به دسته‌های فهرست معمول کانال تبدیل می‌شوند؛ توضیحات و پوسترهای موجود و علاقه‌مندی‌های سراسری با ارجاع پایدار از همان رابط رسانه استفاده می‌کنند. [رفتار و حدود کاتالوگ](docs/stalker-media.md) را ببینید.

در نصب خودمیزبان، درخواست مرورگر از `/stalker/api` سرور همراه عبور می‌کند؛ برنامهٔ بومی از انتقال HTTP موجودش استفاده می‌کند. مرورگرهای میزبانی‌شده به مسیرهای صریحاً پیکربندی‌شده از طریق [رلهٔ اختصاصی](docs/stalker-relay.md) نیاز دارند. منابع مرورگر و سرور باید با هم به‌روز شوند.

پخش زنده هنگام بازکردن جریان، فرمان موقت کانال را حل می‌کند؛ تعویض کانال، توقف، PiP و جایگزینی ارائه‌دهنده حل‌های قدیمی را لغو می‌کنند. فرمان صریح غیرموقت HTTP(S) مستقیم پخش می‌شود. EPG کوتاه پشتیبانی می‌شود. این ارائه‌دهنده آرشیو پورتال کلاسیک و پروتکل جداگانهٔ `type=series` را عرضه نمی‌کند. رفتار فعلی آرشیو/راهنمای JSON-RPC تغییر نکرده است. پورتال خصوصی LAN در مسیر سرور همراه، همانند سایر مسیرهای پروکسی آن، مدخل دقیق `OTTPLAY_PROXY_LAN_ORIGINS` می‌خواهد.

دموی عمومی Infomir نشانی `http://middleware-stalker.com/stalker_portal/c/` دارد. در 2026-09-26 سه مدخل کاتالوگ زنده برگرداند، اما endpoint رسانه در دسترس نبود؛ برای آزمون بازگشت پخش از پورتال/رسانهٔ کنترل‌شده استفاده کنید.

<a id="m3u-stream-proxy-header-smoke"></a>

## آزمون سرآیند پروکسی جریان M3U

سرآیندهای درخواست بالادست را که `POST /m3u/cp.php` همراه Mode A هنگام دریافت URL echo کنترل‌شده تزریق می‌کند مقایسه می‌کند (پیش‌فرض mock محلی — بدون ارائه‌دهندهٔ IPTV و اسرار).

قرارداد (از `src-rs/core/src/m3u.rs` + `archive/server.py`):
- فقط **User-Agent** تزریق می‌شود (پیش‌فرض `OTT-play-FOSS/1.0` یا پیش‌تنظیم `webos` / `tizen` / `viera` / `mag` / `dune`).
- **Referer** تزریق **نمی‌شود** (`M3UProxy` در Capacitor این کار را می‌کند؛ Mode A نه).
- `@` ابتدایی را از `url` حذف می‌کند (فرم jQuery ارائه‌دهنده).

</div>

<div dir="ltr">

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

</div>

<div lang="fa" dir="rtl">

خروج: `0` موفق، `1` گوش نمی‌دهد، `2` ناهماهنگی سرآیند/HTTP، `3` استفاده/وابستگی‌ها. هم‌خانوادهٔ `smoke-modea-companion.sh` / `smoke-command-queue.sh`.

<a id="logo-concurrent-bench-smoke"></a>

## آزمون کارایی هم‌زمان لوگو

آزمون تأخیر هم‌زمان `GET /logo/<id>.svg` (اختیاری `?ch=`) روی همراه Mode A. تعداد موفق/ناموفق و p50/p95/p99 را گزارش می‌کند. پیش‌فرض بار عملی محلی CI است (`CONCURRENCY=200`، `TOTAL=1000`)؛ آزمون ماندگار کامل 10k اختیاری است (`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`).

</div>

<div dir="ltr">

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

</div>

<div lang="fa" dir="rtl">

خروج: `0` موفق، `1` گوش نمی‌دهد / اتصال شکست خورد، `2` نرخ خطای زیاد، `3` استفاده. هم‌خانوادهٔ `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`.

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## آزمون نوسازی / گرم‌شدن کش XMLTV

رفتار کش XMLTV/EPG همراه Mode A را دقیقاً مطابق `src-rs` می‌سنجد (بدون API ساختگی):

- `EPG_CACHE` حافظه از `GET /epg/:hash` ارائه می‌شود ← همیشه `{"epg_data":[...]}` (HTTP 200).
- آغاز پردازش، `EPG_URLS` را در پس‌زمینه و بدون تأخیر شروع HTTP می‌گیرد؛ پس از هر دریافت کامل **2h** تا نوسازی بعدی صبر می‌کند.
- ذخیرهٔ اختیاری SQLite با تنظیم `DATABASE_URL` (بدون endpoint عمومی وضعیت کش).
- `GET /health` ← `OK` آمادگی HTTP را پس از راه‌اندازی مجدد اختیاری تأیید می‌کند. با `--strict-epg` و `--epg-hash`، آزمون در همان بودجهٔ `--warmup-timeout` برای EPG غیرخالی آن کانال هم صبر می‌کند.

مسیر پیش‌فرض فقط curl می‌زند — **پردازش را نمی‌کشد**. برای کشتن و راه‌اندازی مجدد خودکار `--restart-cmd` / `RESTART_CMD` بدهید یا مراحل دستی `launchctl` در `--help` را دنبال کنید.

</div>

<div dir="ltr">

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

</div>

<div lang="fa" dir="rtl">

خروج: `0` موفق، `1` گوش نمی‌دهد، `2` شکست assertion / گرم‌شدن، `3` استفاده. هم‌خانوادهٔ `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`.

<a id="mode-a-e2e-play-path-smoke"></a>

## آزمون سرتاسری مسیر پخش Mode A

آزمون **مسیر پخش / آمادگی جریان** سمت همراه (فقط HTTP — **نه** E2E رابط گرافیکی نمایان). روی همراه Mode A در حال اجرا این‌ها را بررسی می‌کند:

- سلامت یا index در دسترس
- منابع ایستای پوستهٔ پخش‌کننده (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`)
- `GET /epg/<hash>.json` اختیاری با تنظیم `EPG_HASH`
- `POST /m3u/match-channels` با دادهٔ JSON بدون اسرار (فهرست خالی + یک کانال ساختگی)
- **پخش** پروکسی جریان: `POST /m3u/cp.php` به رسانهٔ آزمون کنترل‌شده (پیش‌فرض فهرست HLS محلی یا `MEDIA_URL`) و بررسی HTTP 200 + بدنهٔ غیرخالی / `Content-Type` مورد انتظار (اولین بایت‌ها از پروکسی)

بدون اطلاعات ورود خصوصی IPTV. هم‌خانوادهٔ `smoke-modea-companion.sh` (وجود)، `smoke-m3u-stream-proxy-headers.sh` (UA/Referer)، `smoke-xmltv-cache-refresh.sh`.

</div>

<div dir="ltr">

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

</div>

<div lang="fa" dir="rtl">

خروج: `0` موفق، `1` گوش نمی‌دهد، `2` assertion شکست خورد، `3` استفاده/وابستگی‌ها.

<a id="capacitor-device-smoke-mode-b"></a>

## آزمون دستگاه Capacitor (Mode B)

**فهرست بررسی** شبیه‌ساز/امولاتور (دستگاه واقعی اختیاری) برای Mode B Cap — نه HTTP همراه Mode A. انسان موفقیت رابط را ثبت می‌کند؛ helper ابزار ساخت / پوشهٔ بومی / curl نرم صف فرمان را خودکار می‌کند.

</div>

<div dir="ltr">

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

</div>

<div lang="fa" dir="rtl">

جزئیات: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md). هم‌خانوادهٔ `smoke-command-queue.sh` (loopback در Cap) — با آزمون‌های Mode A بالا اشتباه نگیرید.

<a id="tauri-desktop-smoke-mode-b"></a>

## آزمون دسکتاپ Tauri (Mode B)

فهرست دسکتاپ و helper برای Mode B Tauri (پنجره / پخش کانال / PiP). نه HTTP همراه Mode A است و نه آزمون دستگاه Cap.

</div>

<div dir="ltr">

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

</div>

<div lang="fa" dir="rtl">

جزئیات: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md). اطلاعات توسعه‌دهندهٔ Apple برای آزمون محلی اختیاری است؛ برای برنامهٔ بسته‌بندی‌شدهٔ Mac از [امضای ad-hoc](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials) استفاده کنید. پذیرش انسانی همچنان اجرا، پخش و PiP را پوشش می‌دهد.

<a id="docker"></a>

## Docker

تصاویر چندمعماری (amd64/arm64) به‌شکل آرشیو OCI نامزد ساخته می‌شوند. انتشار در registry آرشیو پایدار تأییدشده را بدون ساخت مجدد به Docker Hub می‌برد؛ [راهنمای عملیاتی](docs/release-workflow.md) را ببینید.

باینری سرور روی **musl** (Alpine) ساخته و روی Alpine عرضه می‌شود — GLIBC_2.38+ **لازم ندارد**. بنابراین `alvit/ottplay-foss` روی Docker در Synology DSM (x86_64) و میزبان‌های با glibc قدیمی‌تر اجرا می‌شود.

</div>

<div dir="ltr">

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

</div>

<div lang="fa" dir="rtl">

تگ پایدار registry از `X.Y.Z` استفاده می‌کند. به‌روزکردن `latest` گزینهٔ صریح جداگانه پس از انتشار تصویر نسخه‌دار است؛ push به main و تگ Git تصویر منتشر نمی‌کنند.

<a id="build-from-source"></a>

## ساخت از منبع

قواعد دامنهٔ پخش‌کننده از artifact چندسکویی Kotlin پین‌شده در `vendor/ottplay-core.js` می‌آیند. راهنما، آرشیو، فهرست، ارائه‌دهنده، وضعیت ماندگار و تصمیم پخش با FOSS2 و Android بومی پیاده‌سازی مشترک دارند. آداپتورهای مرورگر/تلویزیون، Swift و Rust مسئول API دستگاه، کدک، شبکه و اثرهای رابط می‌مانند. artifact مرورگر نحو ES5 و راه‌اندازی API قدیمی پشتیبانی‌شده را نگه می‌دارد. `npm test`، `check:bundle` و `check:es5` یکپارچگی را می‌سنجند؛ manifest اثرانگشت منبع و خروجی را ثبت می‌کند.

اعتبارسنج پروتکل سرور کنترل و SWOP از schema نسخه‌دار `contracts/ottplay-wire-v1.json` تولید می‌شود. رسید تولید بررسی‌شده و داده‌های سازگاری تغییرناپذیر جلوی کپی سیاست مختص مصرف‌کننده را می‌گیرند.

</div>

<div dir="ltr">

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

</div>

<div lang="fa" dir="rtl">

<a id="device-detection"></a>

## تشخیص دستگاه

پخش‌کننده 24 نوع دستگاه را پشتیبانی می‌کند. تشخیص ابتدا با URL `/f/{device_id}/` و بعد User-Agent است.

| شناسهٔ دستگاه | دستگاه |
|---|---|
| `pc` | مرورگر رایانه |
| `pc2` | پخش‌کنندهٔ وب videojs |
| `nodejs` | برنامهٔ Windows (Electron) |
| `lg/webos` | تلویزیون LG WebOS |
| `samsung/tizen` | تلویزیون Samsung Tizen |
| `samsung/maple` | تلویزیون Samsung Orsay |
| `mag` | گیرندهٔ Infomir MAG |
| `dune` | گیرندهٔ Dune HD |
| `android` | Android TV / تبلت |
| `hbbtv` | تلویزیون HbbTV |
| `panasonic` | تلویزیون Panasonic Viera |
| `philips` | تلویزیون Philips |
| `sony` | تلویزیون Sony |
| `sharp` | تلویزیون Sharp |
| `toshiba` | تلویزیون Toshiba |
| `hisense` | تلویزیون Hisense |
| `skyworth` | تلویزیون Skyworth |
| `tcl` | تلویزیون TCL |
| `vewd` | دستگاه Vewd |
| `spark` | گیرندهٔ Spark |

<a id="push-command-system"></a>

## سامانهٔ فرمان push

برای سرویس چنددستگاهی جداگانه از [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) و بخش **سرور فرمان** در **تنظیمات ← کنترل از راه دور** استفاده کنید. IP/نشانی آن و کد دسترسی این پخش‌کننده را بدهید؛ ذخیرهٔ هر دو polling صدا، کانال و فرمان‌های دیگر را خودکار شروع می‌کند. IP بدون درگاه از HTTP 8081 استفاده می‌کند. برای توقف نشانی را پاک یا **قطع اتصال** را انتخاب کنید. این اتصال خروجی تحویل دارای تأیید را پشتیبانی می‌کند و listener محلی نمی‌خواهد. [جزئیات اتصال و سازگاری](docs/remote-command-server.md) را ببینید. مثال‌های زیر حالت فعلی پروکسی/listener محلی را توضیح می‌دهند.

با **یافتن سرور فرمان** می‌توان کنترل‌کننده را پیدا کرد و بدون کپی‌کردن توکن دستگاه، تأیید اپراتور را درخواست کرد. Tauri ابتدا DNS بومی را بررسی می‌کند و اگر نتیجه خالی باشد، می‌تواند از پروفایل استقراری که صریحاً تنظیم شده استفاده کند؛ پخش‌کننده‌های مرورگر، LG و Capacitor از مسیر پروفایل مرورگر استفاده می‌کنند. فرادادهٔ کشف Home را می‌توان مستقل از کنترل‌کننده روی here.now میزبانی کرد. ساخت‌های عمومی این پروفایل Home را خودکار ندارند و به‌روزرسانی، اتصال‌های ذخیره‌شده را جایگزین نمی‌کند. به [رفتار پلتفرم‌ها، تنظیم پروفایل و عیب‌یابی](docs/remote-command-server.md#discovery-and-one-time-approval) مراجعه کنید.

کنترل محلی HTTP در مرورگر/پخش‌کنندهٔ OTT server، Tauri و Capacitor **به‌طور پیش‌فرض خاموش** است. آن را در **تنظیمات پخش‌کننده ← کنترل از راه دور** روشن کنید تا کد محرمانهٔ دستگاه تولید شود. فرمان‌ها شیء JSON با فیلد `"command"` هستند؛ درخواست HTTP به `Authorization: Bearer <device-code>` نیاز دارد.

<a id="architecture"></a>

### معماری

<a id="local-command-url-recommended"></a>

#### URL فرمان محلی (پیشنهادی)

در **تنظیمات پخش‌کننده ← کنترل از راه دور**، **کنترل محلی HTTP** را روشن، **کد دستگاه** را کپی و پروکسی زیر را با آن تنظیم کنید. **URL فرمان محلی** را روی endpoint فرمان پروکسی بگذارید. وقتی فعال است، پخش‌کننده هر 10 ثانیه URL را با کد دستگاه در سرآیند Authorization poll می‌کند. تنها واردکردن URL کنترل فرمان را فعال نمی‌کند.

</div>

<div dir="ltr">

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

</div>

<div lang="fa" dir="rtl">

<a id="device-uuid"></a>

#### UUID دستگاه

UUID فعلی دستگاه (مثلاً `dev_a1b2c3d4e5`) فرادادهٔ عمومی مسیریابی است، نه اعتبارنامه. **کد دستگاه** جداگانه هنگام روشن‌شدن کنترل HTTP به‌طور امن تولید می‌شود و روی همین دستگاه می‌ماند؛ از تنظیمات ابری کپی نمی‌شود. خاموش‌کردن کنترل محلی HTTP، polling/listener را متوقف می‌کند. روشن‌کردن دوباره کد جدید می‌سازد: برای باطل‌کردن اعتبارنامهٔ قبلی پروکسی و یکپارچه‌سازی‌ها را به‌روز کنید.

Tauri و Capacitor تنها پس از این رضایت در تنظیمات، listener حلقهٔ محلی HTTP را شروع می‌کنند. پروکسی انتقال باید کد نشان‌داده‌شده را به‌شکل Bearer token به آن listener بفرستد. Mode A صف جداگانهٔ `local_proxy.py` شرح‌داده‌شده در پایین را به کار می‌برد.

<a id="remote-text-entry-swop"></a>

#### ورود متن از راه دور (swop)

هدف: تایپ روی گوشی برای ♥™ / صفحه‌کلید مجازی دوردست هنگامی که تلویزیون و گوشی در **شبکه‌های متفاوت** هستند، با تحویل نشست Cloudflare Worker.

- مخزن Worker: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop)
- **مجوز نصب:** پخش‌کننده درخواست را به relay هم‌مبدأ `/swop` سرورش می‌فرستد. سرور توکن نصب خصوصی را اضافه می‌کند؛ هر کلاینت روی مبدأ ثبت‌شده می‌تواند ورود متن دوردست را استفاده کند. UUID دستگاه نشست را مشخص می‌کند و فهرست مجاز برای هر دستگاه لازم نیست.
- تنظیم: `swopBaseUrl` (خالی = ♥™ «تنظیم نشده» نشان می‌دهد / کاری نمی‌کند). در **تنظیمات ← کنترل از راه دور** (کلید **2**) ویرایش کنید یا در نصب اپراتور از `/local/swop.json` نادیده‌گرفته‌شده در Git تزریق کنید.
- `POST /session` شامل `clientId`، `caption` و `draft` است؛ `POST /val` شامل `clientId`، `code` و `sessionToken` برگشتی است. URL گوشی توکن نوشتن جداگانه دارد. توکن خواندن نشست در حافظهٔ مرورگر می‌ماند.
- **نصب محلی:** پس از ثبت نصب و مبدأهای دقیق LAN/localhost در Worker، `SWOP_BASE_URL` و `SWOP_INSTALLATION_TOKEN` را تنظیم کنید. `scripts/install-ottplay-local-service.sh` آن‌ها را در launchd plist خصوصی با mode-0600 حفظ می‌کند. `/local/swop.json` عمومی فقط `{"swopBaseUrl":"/swop"}` دارد. هرگز توکن نصب را در منابع عمومی نگذارید.
- **میزبانی ایستا:** برای همان دو endpoint پروکسی احرازهویت‌شدهٔ سمت سرور تنظیم کنید. توکن نصب را در secrets سرویس میزبانی نگه دارید. کپی فایل‌های عمومی پخش‌کننده اعتبارنامهٔ سرور را کپی نمی‌کند.

> سرور مرکزی OTT، `/api/webhook/commands`، `/webhook/poll`، `/webhook/notify` و aliasهای سلامت فرمان را برای همهٔ متدهای HTTP خاموش نگه می‌دارد. برای Mode A از سرور فرمان جداگانه یا `local_proxy.py` احرازهویت‌شده و صریحاً تنظیم‌شده استفاده کنید؛ سرور مرکزی صف فرمان پخشی ندارد.

<a id="available-commands"></a>

### فرمان‌های موجود

همهٔ مثال‌های پایین `http://192.168.1.50:8081/api/webhook/commands` را URL پروکسی محلی می‌گیرند. با نشانی واقعی خود جایگزین و `OTTPLAY_QUEUE_HTTP_TOKEN` را روی **کد دستگاه** نشان‌داده‌شده پس از فعال‌کردن کنترل HTTP بگذارید. پروکسی باید همان کد را داشته باشد.

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — نمایش اعلان

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

</div>

<div lang="fa" dir="rtl">

| فیلد | نوع | پیش‌فرض | شرح |
|---|---|---|---|
| `message` | string | الزامی | متن نمایشی |
| `popup_duration` | number | 5 | ثانیهٔ نمایش (گوشهٔ بالا راست) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — تعویض کانال با جایگاه فهرست

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

</div>

<div lang="fa" dir="rtl">

| فیلد | نوع | پیش‌فرض | شرح |
|---|---|---|---|
| `channel_number` | number | الزامی | جایگاه کانال در فهرست با شروع از 1 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — تعویض کانال با نام (جزئی)

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

</div>

<div lang="fa" dir="rtl">

جست‌وجوی زیررشته بدون حساسیت به بزرگی حروف. اولین تطبیق انتخاب می‌شود.

| فیلد | نوع | پیش‌فرض | شرح |
|---|---|---|---|
| `channel_name` | string | الزامی | نام کانال یا بخشی از آن |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — رفتن به کانال تصادفی

این فرمان قدیمی کانال‌های مجاز را از فهرست یا دستهٔ فعلی انتخاب می‌کند. شماره‌های کانال و بازه‌ها به جایگاه‌ها در همان فهرست اشاره دارند؛ [سیاست انتخاب تصادفی امن](docs/remote-command-server.md#safe-random-playback) را ببینید.

</div>

<div dir="ltr">

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

</div>

<div lang="fa" dir="rtl">

| فیلد | نوع | پیش‌فرض | شرح |
|---|---|---|---|
| `random_range` | [start, end] | فهرست فعلی | بازه با شروع از 1 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — تغییر ارائه‌دهندهٔ IPTV

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

</div>

<div lang="fa" dir="rtl">

| فیلد | نوع | پیش‌فرض | شرح |
|---|---|---|---|
| `provider` | number | الزامی | شاخص آرایهٔ ارائه‌دهنده (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — بارگذاری فهرست M3U جدید

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

</div>

<div lang="fa" dir="rtl">

| فیلد | نوع | پیش‌فرض | شرح |
|---|---|---|---|
| `playlist` | string | الزامی | URL فهرست M3U |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — به‌روزرسانی پیکربندی ارائه‌دهنده

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

</div>

<div lang="fa" dir="rtl">

| فیلد | نوع | پیش‌فرض | شرح |
|---|---|---|---|
| `provider_settings` | string | الزامی | رشتهٔ JSON تنظیم ارائه‌دهنده |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — تنظیم یا تغییر صدا

</div>

<div dir="ltr">

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

</div>

<div lang="fa" dir="rtl">

در کلاینت بدون پشتیبانی کنترل صدا بی‌صدا نادیده گرفته می‌شود.

| فیلد | نوع | پیش‌فرض | شرح |
|---|---|---|---|
| `volume` | number | — | سطح مطلق 0-100 |
| `volume_step` | number | — | تغییر نسبی، مثلاً +10 یا -5 |

<a id="player-standby-restart-and-exit"></a>

#### آماده‌به‌کار، راه‌اندازی مجدد و خروج پخش‌کننده

صف webhook بدون تأیید پروکسی محلی از `exit_player` یا درخواست نوع‌دار standby/wake پشتیبانی نمی‌کند. پخش‌کننده را به [سرور فرمان](docs/remote-command-server.md) وصل و CLI آن را استفاده کنید:

</div>

<div dir="ltr">

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

</div>

<div lang="fa" dir="rtl">

`d1` را با نام مستعار پخش‌کنندهٔ ثبت‌شده جایگزین کنید. `stop` نام دیگر `standby` است؛ `start` و `wake` نام دیگر `go` هستند. Go پخش‌کنندهٔ در حال اجرا و متصل می‌خواهد؛ برنامهٔ بسته را باز یا دستگاه آفلاین را بیدار نمی‌کند. مرورگر یا تلویزیون فاقد خروج بومی اعلام می‌کند خروج پشتیبانی نمی‌شود. standby، polling دوردست را فعال نگه می‌دارد و کار نامرتبط میزبان یا سرور مشترک را معلق نمی‌کند.

پس از standby/go، `ott d1 status` را برای حالت standby/background بررسی و ازسرگیری پخش را جداگانه تأیید کنید. پس از reload پخش‌کننده، با `ott d1 doctor` runtime جدید را تأیید کنید. پس از خروج با سیستم‌عامل بسته‌شدن پردازش را بررسی کنید؛ timeout دوردست خروج را ثابت نمی‌کند. پذیرش فرمان به‌تنهایی این نتایج را تأیید نمی‌کند.

<a id="local-proxy-server"></a>

## سرور پروکسی محلی

`local_proxy.py` صف فرمان مستقل و احرازهویت‌شده برای یک پخش‌کننده است. اجرای پیش‌فرض آن بدون بازکردن درگاه خارج می‌شود. هر نمونه کد تولیدشدهٔ پخش‌کننده را به کار می‌برد؛ برای چند پخش‌کننده نمونه/درگاه جدا بگیرید. پارامتر پرس‌وجوی `device_id` فقط فرادادهٔ سازگاری است و هرگز احراز هویت یا انتخاب دستگاه دیگر انجام نمی‌دهد.

<a id="start-the-proxy"></a>

### شروع پروکسی

1. **کنترل محلی HTTP** را در پخش‌کننده روشن و **کد دستگاه** را کپی کنید.
2. روی میزبان پروکسی، کد و مبدأ دقیق ارائه‌دهندهٔ پخش‌کننده را تنظیم کنید (scheme، میزبان و درگاه، بدون مسیر):

</div>

<div dir="ltr">

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

</div>

<div lang="fa" dir="rtl">

3. **URL فرمان محلی** پخش‌کننده را `http://192.168.1.50:8081/api/webhook/commands` بگذارید.

نشانی bind پیش‌فرض `127.0.0.1` است؛ مثال صریحاً دسترسی LAN را فعال می‌کند. `OTTPLAY_QUEUE_HTTP_ORIGINS` فهرست مجاز مبدأ دقیق مرورگر با جداکنندهٔ ویرگول است. اگر پخش‌کننده با HTTPS ارائه می‌شود از reverse proxy با HTTPS استفاده کنید تا قواعد mixed-content، polling را مجاز بدانند. کد را محرمانه و بیرون URL نگه دارید. با تولید کد جدید، پروکسی را با مقدار جدید راه‌اندازی مجدد کنید؛ خاموش‌کردن پخش‌کننده به‌تنهایی پردازش جداگانهٔ پروکسی را متوقف نمی‌کند.

<a id="endpoints"></a>

### Endpointها

| متد | مسیر | شرح |
|---|---|---|
| `POST` | `/api/webhook/commands` | افزودن فرمان به صف |
| `GET` | `/api/webhook/commands` | دریافت فرمان‌های صف (poll پخش‌کننده) |
| `POST` | `/webhook/notify` | alias سازگاری احرازهویت‌شده |
| `GET` | `/webhook/poll` | alias سازگاری احرازهویت‌شده |

ارسال و تخلیه هر دو کد Bearer مطابق دستگاه می‌خواهند. endpoint پخشی بدون احراز هویت وجود ندارد. فرمان پس از 60 ثانیه منقضی می‌شود؛ هر پروکسی حداکثر 50 فرمان نگه می‌دارد.

پروکسی تا 16 اتصال هم‌زمان مدیریت می‌کند؛ اتصال بیکار مرورگر یا درخواست ناقص فرمان‌های دیگر را عقب نمی‌اندازد. هر socket زمان‌انتظار بی‌فعالیتی پنج‌ثانیه‌ای دارد؛ وقتی همهٔ workerها مشغول‌اند اتصال اضافه بسته می‌شود. افزودن و تخلیهٔ صف میان workerها اتمیک است.

<a id="smoke-script-all-modes"></a>

### اسکریپت آزمون اولیه (همهٔ حالت‌ها)

</div>

<div dir="ltr">

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

</div>

<div lang="fa" dir="rtl">

امولاتور/دستگاه Android: ابتدا `adb forward tcp:18081 tcp:18081`. Cap/Tauri فقط loopback هستند — برای Home Assistant در LAN از همین پروکسی Mode A استفاده کنید. جزئیات: بخش Smoke test در `docs/capacitor-mobile.md`.

<a id="cors"></a>

### CORS

پروکسی درخواست مرورگر را فقط از `OTTPLAY_QUEUE_HTTP_ORIGINS` می‌پذیرد. preflight با `OPTIONS` از مبدأ مجاز توکن نمی‌خواهد؛ هر GET/POST واقعی کد Bearer دستگاه می‌خواهد. مبدأ wildcard و `null` پذیرفته نیست. Home Assistant و فراخوان‌های غیرمرورگری می‌توانند Origin را حذف کنند ولی همچنان احراز هویت لازم دارند.

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### مثال: webhook در Home Assistant ← پروکسی محلی ← پخش‌کننده

</div>

<div dir="ltr">

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

</div>

<div lang="fa" dir="rtl">

<a id="home-assistant-automation-examples"></a>

### مثال‌های اتوماسیون Home Assistant

مثال اعلان، کانال و صدا پروکسی محلی را به کار می‌برند. در `secrets.yaml` Home Assistant، `ottplay_device_authorization` را با کد نشان‌داده‌شده در پخش‌کنندهٔ فعال روی `Bearer <device-code>` بگذارید.

standby شبانه از [سرور فرمان](docs/remote-command-server.md) جداگانه استفاده می‌کند. URL نمونه و `DEVICE_UUID` پایین را با نشانی کنترل‌کننده و شناسهٔ ثبت‌شده جایگزین کنید؛ نام محلی CLI یعنی `d1` شناسهٔ دستگاه نیست. `ottplay_control_authorization` را در `secrets.yaml` روی `Bearer <controller-admin-token>` بگذارید. این اعتبارنامه از کد دستگاه پروکسی محلی جداست. مستندات [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) و [secrets](https://www.home-assistant.io/docs/configuration/secrets/) Home Assistant را ببینید.

</div>

<div dir="ltr">

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

</div>

<div lang="fa" dir="rtl">

`standby_request` پاسخ HTTP را برای trace اتوماسیون دارد. HTTP 202 تنها یعنی در صف قرار گرفته: `content.id` را نگه دارید و با همان اعتبارنامهٔ کنترل‌کننده، `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` را برای پاسخ پخش‌کننده poll کنید. درخواست جدید `status`، `player.standby` و `player.background` را می‌بیند؛ standby روشن با `suspended` و صفر pending تأیید می‌کند کار ردگیری‌شده تخلیه شده است. برای خروج از standby همان درخواست نوع‌دار با `"operation":"wake"` (`ott d1 go`) را بفرستید. پس از timeout تغییر را کورکورانه تکرار نکنید. [API درخواست/پاسخ](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) و [معنای standby](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake) کنترل‌کننده را ببینید.

<a id="server-api-reference"></a>

## مرجع API سرور

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Endpointهای Webhook (Rust `ottplay-server`)

سرور Rust و fallback آرشیوشدهٔ Python، endpoint فرمان را با HTTP 403 رد می‌کنند. `/api/webhook/commands`، `/webhook/notify`، `/webhook/poll` و alias سلامت فرمان صف‌گذاری، پخش عمومی یا تخلیه انجام نمی‌دهند. API عمومی بازخورد نمی‌تواند این مسیرهای رزروشده را جایگزین کند. تحویل فرمان Mode A از سرور فرمان جداگانه یا پروکسی محلی احرازهویت‌شدهٔ بالا استفاده می‌کند.

<a id="other-endpoints"></a>

### سایر Endpointها

| متد | مسیر | شرح |
|---|---|---|
| `GET` | `/epg/<hash>.json` | دادهٔ EPG کانال |
| `GET` | `/logo/<id>.svg` | لوگوی تولیدشدهٔ کانال |
| `GET` | `/version/<path>` | hash نسخهٔ فایل |
| `POST` | `/m3u/match-channels` | تطبیق کانال با EPG |
| `POST` | `/m3u/match-logos` | تطبیق لوگوی کانال |
| `POST` | `/m3u/cp.php` | پروکسی جریان |
| `GET/POST` | `/feedback/` | ثبت بازخورد |
| `GET` | `/tmdb/*` | پروکسی TMDb API |

<a id="epg"></a>

### EPG

</div>

<div dir="ltr">

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

</div>

<div lang="fa" dir="rtl">

<a id="project-structure"></a>

## ساختار پروژه

</div>

<div dir="ltr">

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

</div>

<div lang="fa" dir="rtl">

<a id="stb-key-mappings"></a>

## نگاشت کلید STB

- **Samsung Tizen**: `RETURN=10009`، `ENTER=13`، رنگ 403-406
- **Samsung Maple**: dpad 4/5/6/8، کدهای اصلی SDK
- **LG WebOS**: `RETURN=461`، رنگ سازگار با HbbTV
- **LG NetCast**: `RETURN=8`، کدهای HbbTV
- **MAG**: `RETURN=8`، gSTB API برای MAC
- **Dune HD**: کد استاندارد، Dune API
- **Android TV**: keycode اندروید (`BACK=4`، `DPAD_*` 19-22، `ENTER=66`)
- **HbbTV/Panasonic/Philips/Sony/غیره**: کد HbbTV (`RED=403`، `BLUE=406`، `VOL_UP=447`)

<a id="documentation"></a>

## مستندات

- [ویکی مستندات](./docs/wiki/Home.fa.md) / [Вики по-русски](./docs/wiki/Home.ru.md) — پیمایش کارمحور و قواعد نگهداری.
- [گزارش پیاده‌سازی](./docs/implementation-report.fa.md) / [Процесс и результат](./docs/implementation-report.ru.md) — نمودار رنگی، رفتار بررسی‌شده، هزینهٔ اندازه‌گیری‌شده و دروازهٔ انتشار.
- [راهنمای تحویل](./docs/roadmap-delivery.fa.md) / [Руководство по новым возможностям](./docs/roadmap-delivery.ru.md) — امکانات، محدودیت‌ها و بررسی.
- [شروع سریع به 88 زبان رابط](./docs/readme/README.md) — تولیدشده از ترجمهٔ رابط عرضه‌شده؛ راهنمای اصلی و راهنماهای ویژگی جفت‌شده به [24 زبان مستندات](docs/manual-translations.md) موجودند.
- [حد کیفیت و بازیابی زنده](./docs/playback-stream-policy.fa.md) / [По-русски](./docs/playback-stream-policy.ru.md).
- [نگاشت دستی XMLTV و دسترس‌پذیری کلاسیک](./docs/guide-binding-accessibility.fa.md) / [По-русски](./docs/guide-binding-accessibility.ru.md).
- [آزمون صوت/ویدئوی میزبانی‌شده](./docs/audio-video-check.fa.md) / [По-русски](./docs/audio-video-check.ru.md).
- [کتابخانهٔ رسانهٔ Xtream](./docs/xtream-media.fa.md) / [По-русски](./docs/xtream-media.ru.md).
- [تحویل دستگاه با منبع یکسان](./docs/remote-handoff.fa.md) / [По-русски](./docs/remote-handoff.ru.md).
- [تنظیمات محلی بازیافتنی](./docs/settings-recovery.fa.md) / [По-русски](./docs/settings-recovery.ru.md).
- [نسل مرورگر، سیستم‌عامل و آزمون دقیق نامزد انتشار](docs/browser-compatibility.fa.md) / [По-русски](docs/browser-compatibility.ru.md).

- [معماری پخش‌کننده](./docs/architecture.md) — مالکیت اجرا، یکپارچگی ارائه‌دهنده، پخش، راهنما، آداپتور دستگاه و قرارداد ساخت.
- [خط ساخت کلاسیک ES5](./docs/build-pipeline.md) — کامپایل، بررسی سازگاری و محدودیت اندازهٔ artifact.
- [نام منابع اجرا و مهاجرت استقرار](./docs/asset-layout.md) — مسیر توصیفی مشترک وب و بستهٔ بومی.
- [میزکار دوردست](./docs/remote-workbench.md) — بررسی UI/رسانه، رسید عملیات و شواهد ذخیره‌شده.
- [عیب‌یابی زمان اجرا](./docs/runtime-debug.md) — تاریخچهٔ خطا، شمارندهٔ فریم/حلقه، سنجهٔ بومی Capacitor/Tauri و اشکال‌زدایی سرور.
- [تحویل محلی macOS](./docs/macos-local-delivery.md) — ساخت checkout، نصب محلی و اعتبارسنجی.

<a id="license"></a>

## مجوز

[MIT](LICENSE) — آزاد و متن‌باز. محتوای ارائه‌دهنده و وابستگی‌های ثالث حقوق و مجوز خود را حفظ می‌کنند.

برنامهٔ مستقل [OTTPlay native webOS](docs/native-webos.md) که از PlxNative مشتق شده است، همراه با کد منبع متناظر تحت مجوز **GPL-3.0-or-later** توزیع می‌شود.
مجوز MIT در ریشهٔ پروژه، مجوز این برنامهٔ بومی یا وصله‌های آن را تغییر نمی‌دهد.

<a id="desktop-updater--notarization-mode-b"></a>

## به‌روزرسان دسکتاپ / notarization (Mode B)

[راهنمای امضای دسکتاپ و به‌روزرسان](docs/tauri-updater-notarize.md) امضای ad-hoc در macOS، Developer ID/notarization اختیاری و اعتبارسنجی بسته را شرح می‌دهد. CI انتشار بدون اعتبارنامهٔ Apple از ad-hoc استفاده می‌کند. امضای به‌روزرسان جداست؛ به‌روزرسانی خودکار production هنوز تنظیم نشده است.

<a id="local-mac-build-helpers"></a>

## کمک‌ابزار ساخت محلی Mac

[docs/local-build-scripts.md](docs/local-build-scripts.md) را ببینید.

<a id="privacy"></a>

## حریم خصوصی

برای اطلاعات تنظیمات محلی، سرویس‌های تنظیم‌شده و انتخاب‌ها، [سیاست حریم خصوصی](docs/privacy-policy.md) را بخوانید. تماس حریم خصوصی و پشتیبانی: [alvit.work@gmail.com](mailto:alvit.work@gmail.com).

Studio 2026 پوستهٔ پیش‌فرض است. Classic و PLi-HD قابل انتخاب می‌مانند و ترجیحات ذخیره‌شده حفظ می‌شوند. [تنظیمات رابط](docs/interface-settings.md) را ببینید. پوستهٔ PLi-HD از Vali، littlesat، VU+NL، Milo و مشارکت‌کنندگان بالادست نام می‌برد. تاریخ انگلیسی و پیوند منابع در [اعتبارات رابط و تاریخ طراحی](docs/interface-history.md) است که از منوی اطلاعات پخش‌کننده هم در دسترس است.

<a id="demo-video-editing"></a>

## ویرایش ویدئوی دمو

برای آماده‌سازی و ویرایش ضبط دمو از [گردش کار video-use](docs/demo-video.md) محلی استفاده کنید. کمک‌ابزار همهٔ رسانهٔ تولیدشده را بیرون Git نگه می‌دارد.

<a id="plex-media-library"></a>

## کتابخانهٔ رسانهٔ Plex

هر پخش‌کننده می‌تواند با ارائه‌دهندهٔ **Plex** به حساب Plex یا Plex Media Server وصل شود. یکپارچه‌سازی از Plex استفاده می‌کند؛ Synology یکی از میزبان‌های ممکن است. همهٔ ویدیوها و آهنگ‌های قابل‌دسترسی خودکار در فهرست کانال‌ها نمایش داده می‌شوند؛ انتخاب دسته بر اساس کتابخانه، پوشه یا مجموعه فیلتر می‌کند. پخش از نخستین دستهٔ قابل‌استفاده شروع می‌شود؛ بارگذاری پس‌زمینه، جست‌وجوی عادی و Actions برای پخش تصادفی/تکرار، بدون تنظیم Plex روی سرور OTT فراهم‌اند. [ورود Plex و پخش مستقیم](docs/plex-provider.md) را ببینید.

![چرخهٔ بارگذاری، پیمایش فایل و خاموش‌شدن Plex](docs/images/plex-playback-lifecycle.svg)

[مرور مصور قابلیت اطمینان](docs/plex-provider.md#reliability-review-process-and-results) قواعد بارگذاری و لغو، اصلاح کاتالوگ کامل و تعویض فایل، و نتیجهٔ اندازه‌گیری‌شدهٔ اعتبارسنجی Chromium/WebKit را توضیح می‌دهد.

یکپارچگی اختیاری سرور OTT همچنین کاتالوگ و پخش سازگار یک Plex موجود را از مدخل جداگانهٔ کتابخانهٔ NAS و خروجی M3U عرضه می‌کند. [تنظیم کتابخانهٔ سمت سرور و دسترسی کلاینت](docs/synology-library.md) را ببینید.

<a id="related-repositories"></a>

## مخزن‌های مرتبط

- [ottplay-core](https://github.com/open-ott-play/ottplay-core) مسئول منطق مشترک JVM/ES5، قراردادهای ارتباط و کلاینت FOSS2 است. این پخش‌کننده artifact تولیدشده را مصرف می‌کند؛ برای تغییر مشترک راهنمای تحویل core را دنبال کنید.
- [ottplay-android](https://github.com/open-ott-play/ottplay-android) برنامهٔ بومی جداگانهٔ Kotlin/Compose با هویت نصب و انتشار خودش است.
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server) فرمان دوردست خودمیزبان می‌دهد؛ [ottplay-swop](https://github.com/open-ott-play/ottplay-swop) انتقال متن اختیاری مبتنی بر Worker می‌دهد.
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine) مسئول پروفایل میزبانی‌شده، رسانهٔ دمو و اعتبارسنجی انتشار دموی مرورگر است.

<a id="project-maintenance"></a>

## نگهداری پروژه

[نیازمندی مشارکت و آزمون](CONTRIBUTING.md)، [سیاست گزارش امنیت](SECURITY.md)، [طراحی امنیت](docs/security-design.md) و [شواهد OpenSSF و معیارهای باقی‌مانده](docs/openssf-evidence.md) را ببینید.

</div>
