<div lang="ar" dir="rtl">

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

للملفات المحلية دون إنترنت، راجع [الفيديو المحلي والتشغيل دون اتصال](docs/offline-media.md).

[![متصفح قنوات OTT-play FOSS بمنظور مائل](docs/images/hero.png)](docs/images/studio-2026-default.png)

*لقطة للواجهة الحالية Studio 2026 بقنوات وبرامج تجريبية مصطنعة. افتح الصورة لرؤية النسخة الأصلية المسطحة؛ ليست هذه لقطة لاشتراك فعلي. [مصدر الصورة وإعادة إنشائها](docs/images/README.md).*

[أدلة البدء السريع بـ88 لغة](docs/readme/README.md) · [ويكي التوثيق](docs/wiki/Home.ar.md)

[![أفضل ممارسات OpenSSF](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![اختبارات التشويش: للنسخ المرشحة فقط](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

تشغّل النسخ المرشحة العامة حملات تشويش محدودة ومعزولة لتحليل XMLTV في المكونات الأصلية/الخادم والتحقق من طلبات البوابة. راجع [نطاق التشويش وإعادة الإنتاج وأدلة الإصدار](FUZZING.md).

مشغّل IPTV/OTT مستقل مع خادم HTTP محلي بلغة Rust. يعمل على التلفزيونات الذكية (LG WebOS وSamsung Tizen وPanasonic وSony وغيرها)، وأجهزة الاستقبال (Infomir MAG وDune HD وEnigma2 وAndroid TV)، ومتصفحات سطح المكتب.

ابدأ بـ[دليل البنية والمساهمة](docs/architecture.md) لفهم طبقات التشغيل والملكية ووصفات توسيع المزوّدين والتحقق. راجع [جلسات التشغيل وأعمار المزوّدين](docs/playback-session-architecture.md) لحدود النواة/المضيف وعقود التوافق.

<!-- ci-release-process:start -->
<a id="release-process"></a>

## عملية الإصدار

راجع [استراتيجية الإصدار](RELEASING.md) لقواعد التحقق والإصدارات الليلية والتجريبية والمرشحة والترقية إلى المستقر، و[دليل المشغّل](docs/release-workflow.md) للأوامر المحلية.
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## التشغيل في المتصفح

افتح [العرض الحي](https://player.ottplay.here.now/)، أو ابنِ مشغّل الويب وقدّمه باستخدام التعليمات أدناه.

يوفّر [النشر المحلي على macOS](docs/local-http-deployment.md) أصول HTTP للمشغّل على المنافذ 8443–8446. أُلغي استخدام المنفذ 8095.

عند التشغيل الأول اختر **تجربة العرض** لتشغيل نمط الاختبار المتحرك، أو اضبط قائمة M3U أو المزوّد الخاص بك. يتوفر العرض لاحقًا أيضًا من **تغيير المزوّد ← العرض التجريبي**.

يحتاج العرض إلى اتصال بالإنترنت، دون حساب لدى مزوّد. قنوات اختباره الصامتة MP4 وHLS مستضافة على here.now ومشتركة بين مشغّل الويب وTauri وCapacitor وOTT Server. تُحفظ إعدادات المزوّد الحالية عند التبديل. لاختبار **الصورة والصوت** بصورة منفصلة، افتح **المعلومات ← الصوت ← تشغيل** في محرك HTML5 المُدار أثناء الخمول أو مشاهدة بث مباشر. يستخدم هذا الملف الاختباري المسموع `av-v1.mp4` المستضاف على here.now ويحتاج إلى الإنترنت. المقطع غير موجود في حزم المشغّل ولا يُجلب عند بدء التشغيل. تُستثنى VOD والأرشيف وتجاوزات محرك الجهاز (بما فيها PC2/Video.js والمحركات الأصلية)؛ راجع [الخطوات والنغمات المتوقعة ومخطط الاستضافة](docs/audio-video-check.ar.md).

تدعم نوافذ تطبيق المتصفح المثبّت على سطح المكتب **Window Controls Overlay**: يستطيع Chrome إخفاء شريط العنوان المنفصل مع إبقاء أزرار النافذة وقائمة التطبيق فوق المشغّل. افتح التطبيق المثبّت واختر **إخفاء شريط العنوان** عندما يتيحه Chrome؛ يعيد **إظهار شريط العنوان** الإطار المعتاد. تبقى علامات التبويب العادية وتخطيطات التلفزيون/الأغلفة الأصلية بسلوكها الحالي. راجع [عناصر التحكم بنافذة المتصفح](docs/browser-window-controls.md) لعناوين التثبيت المدعومة وتحديث الاختصار الحالي والتحقق.

للتقديم أو الإرجاع عشر ثوانٍ في عرض الفيديو الرئيسي استخدم **Alt/Option + يسار/يمين** (ويعمل أيضًا **Command + يسار/يمين** على macOS)، بملء الشاشة أو العرض العادي. تستخدم الفيديوهات المحلية وVOD وأرشيفات القنوات المدعومة عناصر التحكم نفسها في الويب وTauri وCapacitor. راجع [اختصارات لوحة المفاتيح وحدودها](docs/browser-window-controls.md#playback-keyboard-shortcuts).

في واجهة الحاسوب، يشغّل **R** قناة أو فيديو مختلفًا عشوائيًا من القائمة الحالية دون خلط ترتيبها. يعمل في عرض الفيديو الرئيسي وقوائم القنوات/الفيديو؛ تظل لمحررات النص والحوارات والإعدادات وقيود الكشك الأولوية. لا تتغير تعيينات مفاتيح الأجهزة الأخرى.

يمكن إعادة توليد نمط الاختبار المصطنع باستخدام `scripts/generate-demo-media.sh` (يتطلب FFmpeg)؛ تبقى الوسائط المولّدة في الدليل المتجاهَل `.local-artifacts`.

<a id="features"></a>

## المزايا

- **التشغيل**: بث HLS وDASH وHTTP العادي، مع سقوف جودة HLS.js/Shaka المُدارة واسترداد محدود وما يصل إلى ثلاثة عناوين احتياطية صريحة لكل قناة مباشرة. لا ينتقل الأرشيف/VOD مطلقًا إلى بديل مباشر؛ راجع [الجودة والاسترداد](docs/playback-stream-policy.ar.md).
- **EPG**: مطابقة XMLTV، والإزاحة الزمنية/المشاهدة اللاحقة، والبحث بعناوين البرامج (N5 في EPG)، والتذكيرات، والربط اليدوي للخلاصة/المعرّف لقناة محددة في مسار XMLTV المستضاف/الأصلي. راجع [الربط وإمكانية الوصول](docs/guide-binding-accessibility.ar.md).
- **المفضلة**: [مجموعة مختلطة](docs/mixed-favorites.md) واحدة مرتبة عبر المزوّدين والملفات الشخصية المضبوطة على الأجهزة المدعومة، مع تصدير واستيراد قابل للنقل عبر CLI؛ ورمز PIN أبوي. تبقى قوائم المفضلة الخاصة بكل مصدر متاحة في الوضع البديل.
- **الإعدادات**: تصدير/استيراد JSON للإعدادات والمفضلة، وسجل تراجع لدفعات localStorage المدعومة، واستئناف للأرشيف واعٍ بالمصدر، ومقارنة دقيقة للإعدادات المخزنة لسير عمل المتحكم. يفترض الاسترداد وجود كاتب واحد؛ تحتفظ محولات التخزين المخصصة بتراجع وفق أفضل جهد. راجع [استرداد الإعدادات](docs/settings-recovery.ar.md).
- **الواجهة المشتركة**: يستخدم OTT Server وTauri وCapacitor سمة قائمة القنوات وإعدادات ظهورها نفسها. توفّر [ألوان الواجهة](docs/interface-colors.md) تسعة أدوار للألوان، ولوحة ألوان، وإدخالًا دقيقًا لقيم HEX/RGB/HSV، وخمسة أنظمة ألوان، وتُحفظ الإعدادات لكل عميل؛ وتتحكم إعدادات قائمة القنوات بالأسماء والأيقونات والبرامج الحالية والتقدم وعلامات الأرشيف.
- **المزوّدون**: M3U/M3U8 وXtream للتلفزيون المباشر مع [كتالوجات أفلام ومسلسلات عند الطلب](docs/xtream-media.ar.md)، وStalker/Ministra مع [الأفلام والحلقات المتداخلة للبروتوكول الكلاسيكي](docs/stalker-media.md) وPlex وVPortal. تحدد إمكانات المزوّد والوصول بالحساب مزايا الأرشيف ومكتبة الوسائط المتاحة.
- **أوامر الدفع**: تحكم عن بُعد عبر webhook — تغيير القناة والمزوّد وقائمة التشغيل وعرض النوافذ المنبثقة.
- **إدخال النص عن بُعد (swop)**: لوحة مفاتيح الهاتف عبر Cloudflare Worker عندما يكون التلفزيون والهاتف على شبكتين مختلفتين (جلسات مخوّلة للتثبيت؛ ♥™ على VKB).
- **توجيه لكل جهاز**: عنونة تعتمد UUID لإعدادات الأجهزة المتعددة.
- **الوكيل المحلي**: خادم أوامر محلي اختياري لأتمتة محلية بالكامل (دون الحاجة لخادم مركزي).
- **تكامل المتحكم**: مشغّلون محددون بالجهاز/الإجراء، ونتائج أوامر دائمة اختيارية، وتطبيق قابل للاستئناف لإعدادات Local/Home المسبقة، وتسليم البث المباشر/الأرشيف من المصدر نفسه عبر [خادم التحكم](https://github.com/open-ott-play/ottplay-control-server) المطابق. تتطلب هذه المزايا المتحكم/CLI المحدّثين؛ ولا توفرها علامة تبويب متصفح مستقلة.
- **تفضيلات بعيدة ذات أنواع محددة**: اكتشف الإعدادات، واقرأ القيم المحفوظة والفعلية، واحفظها مع التحقق من جلسة التشغيل والمصدر والمراجعة؛ راجع [الإعدادات البعيدة وتهيئة VPortal](docs/remote-player-settings.md).
- **التشخيص**: HUD للتشغيل/سجل دائري اختياري عبر `?debug=1`، وفحص عن بُعد بموافقة، واختبار صوت/فيديو مستضاف عند الطلب.
- **إمكانية الوصول بلوحة المفاتيح**: حوارات كلاسيكية مسماة، وحصر تركيز Tab وإعادته، ودلالات القناة المحددة، وإعلانات حالة غير مقاطعة. لا تثبت هذه التحسينات الامتثال الكامل لـWCAG أو لقارئات الشاشة بالأجهزة.
- **24 نوع جهاز**: تعيينات مفاتيح تحكم عن بُعد مخصصة لكل جهاز.
- **88 لغة واجهة**: كتالوجات مطابقة و[أدلة بدء مترجمة](docs/readme/README.md) و[أبجديات لوحة مفاتيح مدققة بـCLDR](docs/localization.md). يتوفر الدليل الرئيسي وأدلة المزايا المقترنة بـ[24 لغة توثيق](docs/manual-translations.md)؛ وتحتفظ المراجع الهندسية الأخرى بلغاتها الحالية.

يصف [دليل التسليم](docs/roadmap-delivery.ar.md) المزايا المنفذة في هذه النسخة من المصدر وحدود المنصات والمخططات والتحقق. قد تستخدم الإصدارات المثبّتة أو المنشورة نسخة أقدم. يحفظ [تطبيق Android](https://github.com/open-ott-play/ottplay-android) الأصلي المستقل أيضًا خيارات الصوت والترجمة وفق اللغة والدور والتسمية بدل فهارس manifest؛ تنفيذه وإصداره منفصلان عن هذه الواجهة.

تشرح [مراجعة مصادر STB](docs/stb-player-improvements.md) تحسينات الوسائط والموارد والتعافي، ومقارنة مصادرها وحدودها الحالية.

<a id="debug-hud"></a>

## HUD التشخيص

يتطلب HUD المحلي وحفظ سجل الخادم موافقتين منفصلتين. راجع [الوصول التشخيصي وتنقيح البيانات والاحتفاظ](docs/diagnostic-security.md) قبل جمع السجلات من أجهزة أخرى.

فعّل وضع التشخيص بإحدى الطرق:
- URL: `?debug=1` أو `?debug=true`
- التخزين المحلي: `localStorage.setItem("ottplay_debug", "1")`
- خاصية النافذة: `window.__OTT_DEBUG__ = true`
- الخادم: عندما يعيد `/debug/config` القيمة `{enabled: true}`

عندما يكون التشخيص مفعّلًا:
- اضغط **D** لتبديل شريط HUD على الشاشة (`ottDebugSetHud` / `__ottDebug.toggleHud()`)
  - يُتجاهَل عندما يكون التركيز على INPUT/TEXTAREA/listEdit
  - يستخدم `e.key` لتجنب تعارض MAG/Maple مع PLAY/PREV=68
- قائمة المعلومات ← **Debug HUD** ← يستدعي `__ottDebug.toggleHud()`
- إدارة الإعدادات ← **Debug HUD**:
  - إذا كان التشخيص محملًا: يبدّل ظهور HUD
  - وإلا: يضبط `ottplay_debug=1` + `ottplay_debug_hud=1` ويطلب إعادة التشغيل
- الحفظ: تُخزّن حالة HUD في `localStorage.ottplay_debug_hud` ("1"/"0") بواسطة `ottDebugSetHud`

<a id="capacitor-ios-and-android"></a>

## Capacitor على iOS وAndroid

يحزم هذا المستودع واجهة TypeScript المشتركة مع Capacitor لـiOS وAndroid 7+. يستخدم كلاهما خطوط النظام وبيئة التشغيل الأصلية المثبّتة بإصدار npm. تدعم حزمة APK توافق منفصلة بمستوى API 22 إصداري Android 5.1/6 مع WebView 60 أو أحدث. تُوقّع حزمتا Android وتُرفقان بالإصدارات التجريبية والمرشحة والمستقرة المؤهلة، إلى جانب IPA غير موقّعة لـiOS. يبقى تطبيق Kotlin المستقل في [ottplay-android](https://github.com/open-ott-play/ottplay-android).

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

<div lang="ar" dir="rtl">

راجع [إعداد Capacitor](docs/capacitor-mobile.md) و[توزيع Android والتحديثات عن بُعد](docs/android-distributions.md).

تستخدم واجهة iOS الاتجاه الأفقي. تبقى الإعدادات وضبط المزوّد والموافقة على التحكم عن بُعد واستيراد/تصدير JSON ضمن الواجهة المشتركة. قد يتجاوز تعدد المهام على الجهاز اللوحي الاتجاه المطلوب.

على iPhone اسحب عموديًا فوق قائمة القنوات للتنقل بين الصفوف والصفحات؛ لأعلى نحو القنوات اللاحقة ولأسفل نحو السابقة. تستمر النقرة السريعة الساحبة عبر عدة صفحات ثم تتباطأ حتى تتوقف؛ ويبقى السحب البطيء دقيقًا. المس الشاشة أو اضغط مفتاح تنقل لإيقاف الحركة. تبدأ نقرة واحدة القناة تحت إصبعك حتى عند اختيار صف آخر. لا يفتح السحب قناة عند رفع إصبعك.

يعمل الفيديو داخل الصفحة على iPhone. المس أسفل الشاشة لمعلومات البرنامج أو افتح القائمة مع استمرار التشغيل. تبقى صورة داخل صورة خيار تشغيل منفصلًا.

فحص سريع للجهاز: [قائمة Mode B](docs/mode-b-device-smoke.md) و`./scripts/smoke-capacitor-device.sh --help` (هدف البناء/المزامنة iOS فقط). فحص Tauri لسطح المكتب: [قائمة سطح المكتب](docs/mode-b-tauri-smoke.md).

<a id="installation"></a>

## التثبيت

| المنصة | الحزمة | ملاحظات |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | بناء منفصل لـApple Silicon وIntel؛ توقيع ad-hoc ما لم يُضبط توقيع Apple |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | توزيعات متعددة |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode أو Homebrew Channel](docs/lg-webos-installation.md)؛ مشغّل مستضاف، يتطلب اتصالاً بالشبكة |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode والتوقيع المحلي؛ حزمة تلفاز غير موقعة، منفصلة عن Family Hub](docs/samsung-tizen-installation.md) |
| **iOS** | `.ipa` عبر AltStore / TestFlight / Xcode | تثبيت جانبي فقط — غير متاح في App Store بعد |
| **Android (الواجهة المشتركة)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | حزم Capacitor موقعة؛ اختر إصدار Android المدعوم |
| **Android (Kotlin أصلي)** | [تطبيق أصلي](https://github.com/open-ott-play/ottplay-android) منفصل | مستودع عام؛ تطبيق وسير إصدار منفصلان |

تُرفق المثبّتات المدعومة بإصدارات GitHub المؤهلة: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **ملاحظة:** تستخدم حزم تطبيق macOS توقيع ad-hoc عند غياب بيانات توقيع Apple؛ وهذا لا يوفر Developer ID أو notarization. قد تكون مثبّتات Windows/Linux وحزم إصدار iOS غير موقّعة. يتطلب iOS توقيعًا قبل التثبيت على جهاز فعلي. تستخدم حزم APK المؤهلة لإصدارات Android Full وAPI 22 شهادة التوقيع المعتمدة؛ وتحتاج عمليات بناء الإصدار المحلية إلى keystore مضبوط لإنتاج APK موقّعة.

---

<a id="macos"></a>

### macOS

1. اختر الوسم المطلوب من [الإصدارات](https://github.com/open-ott-play/ottplay-foss/releases). يختار اختصار أحدث إصدار المستقر، وليس التجريبي أو المرشح.
2. نزّل `OttPlay.FOSS_*_aarch64-apple-darwin.dmg` لـApple Silicon أو `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` لـIntel. هما بناءان بمعماريتين منفصلتين.
3. افتح `.dmg` واسحب **OttPlay FOSS.app** إلى Applications.
4. تحقّق من الحزمة المنسوخة قبل أول تشغيل:

</div>

<div dir="ltr">

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

</div>

<div lang="ar" dir="rtl">

يتحقق الفحص الناجح من سلامة الحزمة. تعني `Signature=adhoc` أن التطبيق لا يحمل هوية مطور موثقة لدى Apple؛ ولا تثبت notarization أو موافقة Gatekeeper. حتى مع تنزيل موثوق وحزمة سليمة، قد يتطلب macOS اختيار **إعدادات النظام ← الخصوصية والأمان ← فتح على أي حال** بعد أول محاولة تشغيل؛ راجع [تعليمات Apple](https://support.apple.com/en-us/102445).

رسالة «التطبيق تالف» ليست دليلًا على الحجر وحده. إذا فشل التحقق من التوقيع، احتفظ بالخطأ واحصل على إصدار مصحّح. لا تعِد توقيع التطبيق المنزّل أو تحذف سماته لجعل فحص فاشل يبدو ناجحًا.

بدائل ZIP هي `OttPlay.FOSS_aarch64-apple-darwin.app.zip` و`OttPlay.FOSS_x86_64-apple-darwin.app.zip`. راجع [توقيع macOS والتحقق من الملفات](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact) لفحص الاستخراج وصورة القرص وGatekeeper. للبناء من نسخة المستودع والتثبيت المحلي، استخدم [التسليم المحلي على macOS](docs/macos-local-delivery.md).

---

<a id="windows"></a>

### Windows

1. نزّل `.msi` أو `.exe` من [الإصدارات](https://github.com/open-ott-play/ottplay-foss/releases/latest)
2. شغّل المثبّت واتبع التعليمات
3. افتح من قائمة ابدأ أو اختصار سطح المكتب

---

<a id="linux"></a>

### Linux

يحتاج التشغيل على Linux إضافات GStreamer لـHLS وH.264 وAAC إضافة إلى WebKitGTK. تصرّح الحزم بهذه تبعيات الوسائط؛ وتضمّن إصدارات AppImage إطار الوسائط. راجع [تحزيم وسائط Linux](docs/linux-media-packaging.md) لفحوص الترميز والفرق بين قبول المتصفح والقبول الأصلي.

**AppImage:**

</div>

<div dir="ltr">

```bash
chmod +x OttPlay.FOSS_*_amd64.AppImage
./OttPlay.FOSS_*_amd64.AppImage
```

</div>

<div lang="ar" dir="rtl">

**Debian/Ubuntu (.deb):**

</div>

<div dir="ltr">

```bash
sudo apt install ./OttPlay.FOSS_*.deb
```

</div>

<div lang="ar" dir="rtl">

**Fedora (.rpm):**

</div>

<div dir="ltr">

```bash
sudo dnf --enablerepo=fedora-cisco-openh264 install ./OttPlay.FOSS-*.rpm
```

</div>

<div lang="ar" dir="rtl">

---

<a id="ios-installation"></a>

### تثبيت iOS

يحتاج iOS إلى توقيع قبل التثبيت على جهاز فعلي. استخدم AltStore Classic لملف IPA غير الموقّع من الإصدار، أو ابنِ من المصدر ووقّع باستخدام Xcode. يتطلب TestFlight دعوة منفصلة عندما تتوفر.

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### الخيار 1: AltStore Classic (موصى به للاستخدام الشخصي)

يعمل AltServer على الحاسوب؛ ويعمل AltStore Classic على iPhone/iPad ويستورد IPA. يكفي حساب Apple مجاني.

**المتطلبات:**

- iPhone/iPad بنظام **iOS/iPadOS 15 أو أحدث** لبناء OTT-play الحالي.
- Mac أو حاسوب Windows مع AltServer وكابل USB لنقل البيانات.
- حساب Apple للتوقيع واتصال بالإنترنت لتنزيل الإصدار.

**الخطوة 1: إعداد AltStore مرة واحدة**

1. ثبّت AltServer باتباع تعليمات [إعداد macOS](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) أو [إعداد Windows](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows) الرسمية. شغّله واستخدم أيقونته في شريط القائمة/علبة النظام.
2. صِل الجهاز عبر USB وافتح قفله واقبل مطالبات الثقة بين الحاسوب والجهاز. على Mac تأكد من ظهوره في Finder.
3. في **قائمة AltServer ← Install AltStore** اختر جهازك وأكمل مطالبات حساب التوقيع. انتظر إشعار التثبيت.
4. على الجهاز افتح **الإعدادات ← عام ← VPN وإدارة الجهاز** وثق بمدخل المطور الخاص بحساب التوقيع إذا طُلب ذلك. على iOS 16+ فعّل **الإعدادات ← الخصوصية والأمان ← نمط المطور** وأكمل مطالبات إعادة التشغيل والتأكيد.
5. افتح AltStore على الجهاز. إذا كان مثبتًا ويعمل بالفعل، تجاوز هذا الإعداد وأبقِ AltServer قيد التشغيل للاستيراد أدناه.

**الخطوة 2: استيراد الإصدار المختار على iPhone/iPad**

1. اختر وسمًا محددًا من [كل الإصدارات](https://github.com/open-ott-play/ottplay-foss/releases) ونزّل `ottplay-foss-ios-unsigned.ipa` الخاص به في Safari على الجهاز. يختار [اختصار أحدث إصدار](https://github.com/open-ott-play/ottplay-foss/releases/latest) إصدارًا مستقرًا؛ استخدم القائمة الكاملة لتثبيت نسخة تجريبية.
2. احفظ IPA في «الملفات». في **AltStore ← My Apps ← +** اختر الملف. يمكنك أيضًا نقل IPA منزّل من Mac عبر AirDrop وحفظه في «الملفات» قبل الاستيراد. فتح IPA على Mac ليس خطوة الاستيراد هذه.
3. أبقِ AltServer قيد التشغيل وكابل USB موصولًا أثناء توقيع التطبيق وتثبيته بواسطة AltStore. للتحديث استخدم حساب التوقيع نفسه للتثبيت الحالي؛ لا تحذف التطبيق كخطوة أولى لحل المشكلة.
4. انتظر اكتمال الاستيراد وتحقق من OTT-play في **My Apps** ثم شغّله.

**بديل: استيراد عنوان الإصدار مباشرةً**

إذا كان AltStore مثبتًا، أدخل النمط التالي في **Safari على iPhone** مع استبدال `TAG` بوسم الإصدار الدقيق، واقبل **Open in AltStore**:

</div>

<div dir="ltr">

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

</div>

<div lang="ar" dir="rtl">

يستخدم ذلك [معالج عناوين التثبيت](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift) في AltStore. ويتجنب التباس «الملفات/الأخيرة» عند وجود عدة تنزيلات بالاسم نفسه. يجب أن يشير URL إلى ملف IPA، لا صفحة الإصدار.

مثلًا، جرى التحقق من الاستيراد التالي في **2026-09-29** باستخدام AltStore 2.3 وAltServer 1.8.1. هذا مثال تاريخي ثابت، وليس رابط أحدث نسخة:

</div>

<div dir="ltr">

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

</div>

<div lang="ar" dir="rtl">

**التجديد:** تنتهي صلاحية التثبيت بحساب مجاني بعد سبعة أيام. أبقِ AltServer قابلًا للوصول واستخدم **AltStore ← My Apps ← Refresh All** قبل الانتهاء. يحتاج التجديد في الخلفية أيضًا إلى AltServer؛ راجع [تعليمات التجديد من AltStore](https://faq.altstore.io/altstore-classic/your-altstore).

<a id="verify-the-installed-version-before-retrying"></a>

#### تحقّق من النسخة المثبتة قبل إعادة المحاولة

رسالة AirDrop «تم الإرسال» تؤكد النقل فقط. ويؤكد شريط تقدم AltStore بدء الاستيراد. فقدان اتصال Mirroring/USB لا يثبت فشل التثبيت: افحص التطبيق المثبّت قبل إرسال IPA مجددًا.

على Mac مع Xcode مثبّتًا ومختارًا كدليل المطور النشط، افحص الجهاز دون إعادة التثبيت:

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

<div lang="ar" dir="rtl">

في `result.apps` بملف JSON ابحث عن OTT-play (يبدأ `bundleIdentifier` بـ`play.ott.foss`) وقارن `version` و`bundleVersion` مع `CFBundleShortVersionString` و`CFBundleVersion` في IPA المختار. لاحقة حساب توقيع AltStore على معرّف الحزمة متوقعة. احتفظ بتقرير الجهاز محليًا.

يُبلغ مثال beta.9 المتحقق منه عن **النسخة `1.1.51`، البناء `2.2.66`**. يؤكد ذلك التثبيت؛ أما فتح التطبيق وتسجيل دخول Cloudflare وتحميل القائمة والتشغيل وPiP فهي اختبارات منفصلة على الجهاز.

<a id="troubleshooting-ios-installation"></a>

#### استكشاف مشكلات تثبيت iOS

- **لا توجد نافذة لـAltServer، أو تنتهي مهلة فتحه بالأتمتة:** استخدم أيقونته في شريط القائمة/علبة النظام. إنه تطبيق خلفي. تكرار محاولة فتح نافذة عادية لا يستورد IPA.
- **«تعذّر العثور على AltServer» أو جهاز USB غير متاح:** تأكد من تشغيل AltServer وافتح قفل الهاتف وافحص مطالبات الثقة. تحقق من ظهوره في Finder على Mac. إذا انقطع الاتصال فأعده عندما يكون ذلك آمنًا، ثم افحص النسخة المثبتة قبل المحاولة مجددًا. اتبع [حل مشكلات الاتصال من AltStore](https://faq.altstore.io/altstore-classic/troubleshooting-guide) إذا استمرت. إن كان الهاتف يوفر إنترنت الحاسوب، نسّق أي تغيير للكابل أو الشبكة لتجنب تعطيل أعمال أخرى.
- **يعرض iPhone Mirroring «iPhone قيد الاستخدام» أو يظل «جارٍ الاتصال»:** استخدم الهاتف الفعلي لإكمال الإعداد، أو اقفل شاشته واتركه قرب Mac غير المقفل للانعكاس. فتح قفل الهاتف ينهي Mirroring؛ وقد تتطلب ثقة USB/الإعداد فتحه أولًا. إذا استمر التعطل بعد إعادة اتصال واحدة، أغلق Mirroring وأكمل على الهاتف. راجع [متطلبات Mirroring من Apple](https://support.apple.com/en-us/120421). الانعكاس اختياري للتثبيت.
- **يفقد URL أحرفًا لاتينية أو يتحول إلى السيريلية في Mirroring:** بدّل **مصدر الإدخال على Mac إلى ABC/English**. مع تركيز Mirroring اضغط **Control–Space** واختر **English (US)** للوحة مفاتيح iPhone الفعلية. قد يختلف مصدرا إدخال Mac وiPhone؛ لم يكفِ تغيير Mac وحده في جلستنا المتحقق منها. امسح الحقل وأعد إدخال URL وافحصه قبل الإرسال.
- **يعلق لصق الحافظة في Mirroring أو يُدرج نصًا غير متوقع:** امسح الحقل وأعد الكتابة ببطء في أجزاء قصيرة باستخدام مصدر English (US) على iPhone، أو أدخل URL مباشرة على الهاتف. قد يسقط الإدخال السريع أحرفًا أو يكررها؛ افحص العنوان كاملًا قبل الحفظ. لا ترسل URL ملصوقًا جزئيًا. فشل اللصق في جلسة التثبيت لدينا؛ وليس شرطًا لطريقة URL المباشر.
- **تعرض «الملفات/الأخيرة» أسماء IPA متطابقة:** اختر مكان التنزيل الدقيق أو استخدم URL الموسوم أعلاه. يمكن إعادة تسمية نسخة محلية لإضافة الوسم/البناء للتوضيح؛ لا تغير التسمية المحتوى.
- **لا يفتح التطبيق المثبّت:** اتبع مطالبات ثقة المطور أو نمط المطور على الهاتف. افحص انتهاء الصلاحية في AltStore وجدّد عند الحاجة. سجّل الخطأ الفعلي إذا استمر؛ خطأ الاتصال وحده ليس سببًا لحذف التطبيق وإعادة تثبيته.
- **يفتح OTT-play لكن تفشل قائمة محمية على الاتصال الخلوي:** التثبيت ومصادقة المصدر منفصلان. استخدم **الإعدادات ← إدارة الإعدادات ← الوصول إلى المصدر** لتسجيل الدخول إلى مصدر مضبوط، ثم أعد تحميل القائمة. أكمل مطالبات القياسات الحيوية/passkey أو رمز البريد على الجهاز الفعلي عند الحاجة. يجب أن يدعم المصدر [تكامل iOS Access](docs/ios-source-access.md)؛ لا يتجاوز تثبيت التطبيق قائمة عناوين IP المسموحة.
- **يُطلب passkey مع الاتصال بشبكة Wi-Fi موثوقة:** للمصادر ذات تكامل iOS Access، يحاول التطبيق أولًا المصدر الأصلي دون دخول، ولا يستخدم مدخل الهاتف المصادق عليه إلا بعد رفض الوصول. افحص IP العام الذي يراه المصدر فعلًا، بما فيه IPv6: سماح IPv4 المنزلي لا يشمل IPv6 آخر أو VPN أو عنوانًا خلويًا. تغييرات الشبكة وإعادة فتح التطبيق تمسح تفضيل المسار المؤقت. لا ينبغي أن يؤدي خطأ شبكة/خادم عام إلى تسجيل دخول.
- **لا يظهر تسجيل الدخول لكن قائمة القنوات فارغة:** تُعاد استخدام الجلسة المحفوظة الصالحة دون مطالبة أخرى. بعد تحميل فاشل سابق أو إصلاح بالخادم، أعد تحميل القائمة أو أغلق التطبيق تمامًا وافتحه مرة واحدة. إن استمر الفشل، تأكد من أن المصدر يعيد قائمة لا صفحة دخول HTML أو خطأ JSON. سجّل الخطأ الظاهر وحالة HTTP؛ لا تشارك عناوين مصادر تحوي بيانات اعتماد أو cookies أو رموز Access.
- **تُحمّل القنوات لكن الفيديو يتوقف للتخزين أو يعرض `SRC_NOT_FOUND`:** تحميل القائمة وتشغيل الفيديو فحصان منفصلان. أعد محاولة القناة مرة بعد الدخول؛ إن استمر، افحص manifest HLS واستجابات المقاطع ودعم ترميز البث. لا يثبت الخطأ وحده أن تبديل المحرك أو إعادة التثبيت سيساعد.

<a id="option-2-testflight-if-available"></a>

#### الخيار 2: TestFlight (عند توفره)

إذا نُشرت دعوة TestFlight، ثبّت TestFlight من App Store وافتح الدعوة على الجهاز واضغط **Install**. تنزيل IPA من GitHub لا يوفر دعوة TestFlight.

<a id="option-3-xcode-for-developers"></a>

#### الخيار 3: Xcode (للمطورين)

اتبع [البناء والفتح](docs/capacitor-mobile.md#build-and-open)، واختر هدف **App** في Xcode، واضبط فريق التطوير في **Signing & Capabilities**، واختر الجهاز المتصل ثم ابنِ/شغّل. أكمل مطالبات الثقة ونمط المطور عند الحاجة. لا يوفر استيراد IPA غير الموقّع إلى نافذة Devices في Xcode هوية التوقيع أو ملف provisioning المفقودين.

---

<a id="android-application"></a>

### تطبيق Android

اختر APK من نوع Full Capacitor من إصدار هذا المستودع للحصول على واجهة المشغّل المشتركة. استخدم APK التوافق API 22 على Android 5.1–6؛ ويحتاج WebView 60 أو أحدث. حافظ على هوية التطبيق وشهادة توقيعه عند التحديث حتى تبقى الملفات الشخصية الحالية. راجع [تعليمات البناء](android/README.md) و[التوزيع والتوقيع والتثبيت عن بُعد](docs/android-distributions.md).

يحتوي [مستودع ottplay-android](https://github.com/open-ott-play/ottplay-android) المنفصل على تطبيق Kotlin/Compose الأصلي. له هويته وتفضيلاته وسير إصداره الخاص، ولا يستبدل تثبيت Capacitor في موضعه. تبقى ملفات الإصدارات التاريخية متاحة.

---

<a id="quick-start"></a>

## البدء السريع

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

<div lang="ar" dir="rtl">

استخدم نشرًا خاصًا بك من النسخة نفسها للفحص السريع في المتصفح.

استخدم Node 22 وسلسلة أدوات Rust المستقرة. شغّل الخادم من جذر المستودع لتتوفر موارده الثابتة. تتطلب عمليات البناء الأصلية أدوات المنصات المبينة أدناه؛ لا تلزم لبناء الخادم وحده.

عند التحميل الأول اختر **تجربة العرض**، أو افتح **الإعدادات ← تغيير المزوّد ← قوائم M3U / M3U8**. افتح **اختيار قائمة تشغيل**، واختر خانة، وأدخل **عنوان القائمة**، واحفظ التعديل ثم اختر **تحميل القائمة**. أنت توفر القائمة أو حساب المزوّد؛ لا يوفر التطبيق اشتراك قنوات مدفوعًا.

<a id="mode-a-companion-smoke"></a>

## الفحص السريع للمرافق في Mode A

فحص باستخدام curl للمرافق في Mode A (تكافؤ `ottplay-server` / `archive/server.py`): الفهرس والأدلة الثابتة و`/logo` و`/version` و`/epg` الاختياري، واختبار دون جلب لـ`POST /m3u/cp.php`.

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

<div lang="ar" dir="rtl">

الفحوص في `scripts/modea-smoke-checks.json`. دون أسرار. تغطي `scripts/smoke-command-queue.sh` (عند توفرها) طابور الأوامر / `local_proxy.py` (:8081) بشكل منفصل.

<a id="classic-stalker--ministra-portals"></a>

## بوابات Stalker / Ministra الكلاسيكية

اختر **بوابات Stalker** وأدخل MAC الممنوح من المزوّد وعنوان البوابة الكامل، مثل `http://provider.example/stalker_portal/c/`. تختار عناوين `/c/index.html` و`/stalker_portal` و`/server/load.php` و`/load.php` و`/portal.php` بروتوكول MAG الكلاسيكي. تحتفظ إعدادات عنوان الخادم المجرد الحالية بـJSON-RPC. يحمّل المزوّد الملف الشخصي والتصنيفات والقنوات المباشرة المقسمة إلى صفحات عبر نواة Stalker المشتركة، ثم يكتشف في الخلفية الأفلام والحلقات المتداخلة باستخدام `type=vod` الكلاسيكي. تصبح مسارات المجلدات تصنيفات في قائمة القنوات المعتادة؛ وتستخدم الأوصاف والملصقات المتاحة والمفضلة العامة ذات المراجع الثابتة واجهة الوسائط نفسها. انظر [سلوك الكتالوج وحدوده](docs/stalker-media.md).

تمر طلبات المتصفح في الاستضافة الذاتية عبر `/stalker/api` في الخادم المرافق؛ وتستخدم التطبيقات الأصلية نقل HTTP الحالي لديها. تتطلب المتصفحات المستضافة مسارات مضبوطة صراحة عبر [الوسيط المخصص](docs/stalker-relay.md). يجب تحديث موارد المتصفح والخادم معًا.

يحل التشغيل المباشر أوامر القنوات المؤقتة عند فتح البث؛ ويلغي تغيير القناة والتوقف وPiP واستبدال المزوّد عمليات الحل القديمة. تعمل أوامر HTTP(S) الصريحة غير المؤقتة مباشرة. يُدعم EPG القصير. لا يتيح هذا المزوّد أرشيف البوابة الكلاسيكية ولا البروتوكول المنفصل `type=series`. يبقى سلوك أرشيف/دليل JSON-RPC الحالي كما هو. تتطلب بوابات LAN الخاصة عبر مسار الخادم المرافق مدخلًا دقيقًا في `OTTPLAY_PROXY_LAN_ORIGINS` مثل مسارات وكيله الأخرى.

عرض Infomir العام هو `http://middleware-stalker.com/stalker_portal/c/`. أعاد ثلاثة مدخلات للبث المباشر في 2026-09-26، لكن نقاط نهاية الوسائط كانت غير متاحة؛ استخدم بوابة/وسائط اختبار مضبوطة لاختبارات تراجع التشغيل.

<a id="m3u-stream-proxy-header-smoke"></a>

## فحص ترويسات وكيل بث M3U

يقارن ترويسات الطلب إلى المصدر التي يحقنها `POST /m3u/cp.php` في مرافق Mode A عند جلب URL صدى مضبوط (محاكاة محلية افتراضيًا — دون مزوّدي IPTV أو أسرار).

العقد (من `src-rs/core/src/m3u.rs` + `archive/server.py`):
- يحقن **User-Agent** فقط (الافتراضي `OTT-play-FOSS/1.0`، أو الإعدادات `webos` / `tizen` / `viera` / `mag` / `dune`).
- **لا** يحقن **Referer** (يفعل ذلك `M3UProxy` في Capacitor؛ ولا يفعله Mode A).
- يحذف `@` البادئة من `url` (نموذج jQuery للمزوّد).

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

<div lang="ar" dir="rtl">

رمز الخروج: `0` نجاح، `1` لا يستمع، `2` اختلاف الترويسات/HTTP، `3` الاستخدام/التبعيات. اختبار شقيق لـ`smoke-modea-companion.sh` / `smoke-command-queue.sh`.

<a id="logo-concurrent-bench-smoke"></a>

## فحص أداء طلبات الشعارات المتزامنة

فحص زمن استجابة `GET /logo/<id>.svg` المتزامن (مع `?ch=` اختياريًا) مقابل مرافق Mode A. يعرض أعداد النجاح/الفشل وp50/p95/p99. الافتراضي حمل عملي محلي في CI (`CONCURRENCY=200`، `TOTAL=1000`)؛ اختبار التحمل الكامل 10k اختياري (`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`).

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

<div lang="ar" dir="rtl">

رمز الخروج: `0` نجاح، `1` لا يستمع / فشل الاتصال، `2` نسبة أخطاء مرتفعة، `3` الاستخدام. اختبار شقيق لـ`smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`.

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## فحص تحديث / تهيئة ذاكرة XMLTV

يتحقق من سلوك ذاكرة XMLTV/EPG في مرافق Mode A كما هو في `src-rs` (دون اختراع واجهات API):

- تُقدّم `EPG_CACHE` في الذاكرة عبر `GET /epg/:hash` ← دائمًا `{"epg_data":[...]}` (HTTP 200).
- يجلب بدء العملية `EPG_URLS` في الخلفية دون تأخير بدء HTTP؛ وبعد كل جلب مكتمل ينتظر **2h** قبل التحديث التالي.
- حفظ اختياري في SQLite عند ضبط `DATABASE_URL` (لا توجد نقطة عامة لحالة الذاكرة).
- يؤكد `GET /health` ← `OK` جاهزية HTTP بعد إعادة تشغيل اختيارية. مع `--strict-epg` و`--epg-hash` ينتظر الفحص أيضًا EPG غير فارغ لتلك القناة ضمن ميزانية `--warmup-timeout` نفسها.

المسار الافتراضي يستخدم curl فقط — **لا يقتل عمليات**. مرّر `--restart-cmd` / `RESTART_CMD` للقتل وإعادة التشغيل آليًا، أو اتبع خطوات `launchctl` اليدوية في `--help`.

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

<div lang="ar" dir="rtl">

رمز الخروج: `0` نجاح، `1` لا يستمع، `2` فشل التحقق / التهيئة، `3` الاستخدام. اختبار شقيق لـ`smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`.

<a id="mode-a-e2e-play-path-smoke"></a>

## فحص مسار التشغيل من الطرف إلى الطرف في Mode A

فحص **مسار التشغيل / جاهزية البث** من جهة المرافق (HTTP فقط — **ليس** E2E لواجهة رسومية ظاهرة). يتحقق مقابل مرافق Mode A يعمل من:

- إمكانية الوصول للصحة أو الفهرس
- موارد غلاف المشغّل الثابتة (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`)
- `GET /epg/<hash>.json` الاختياري عند ضبط `EPG_HASH`
- `POST /m3u/match-channels` ببيانات JSON اختبار خالية من الأسرار (قائمة فارغة + قناة مصطنعة واحدة)
- **تشغيل** وكيل البث: `POST /m3u/cp.php` إلى مورد وسائط اختبار مضبوط (قائمة HLS محلية افتراضيًا أو `MEDIA_URL`)، والتحقق من HTTP 200 + متن غير فارغ / `Content-Type` متوقع (البايتات الأولى عبر الوكيل)

دون بيانات اعتماد IPTV خاصة. اختبار شقيق لـ`smoke-modea-companion.sh` (الوجود) و`smoke-m3u-stream-proxy-headers.sh` (UA/Referer) و`smoke-xmltv-cache-refresh.sh`.

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

<div lang="ar" dir="rtl">

رمز الخروج: `0` نجاح، `1` لا يستمع، `2` فشل التحقق، `3` الاستخدام/التبعيات.

<a id="capacitor-device-smoke-mode-b"></a>

## الفحص السريع لأجهزة Capacitor (Mode B)

**قائمة تحقق** للمحاكي (واختياريًا جهاز فعلي) لـMode B Cap — وليست HTTP لمرافق Mode A. يسجّل إنسان نجاح الواجهة؛ ويؤتمت المساعد سلسلة الأدوات / الأدلة الأصلية / اختبار curl المرن لطابور الأوامر.

</div>

<div dir="ltr">

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

</div>

<div lang="ar" dir="rtl">

التفاصيل: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md). اختبار شقيق لـ`smoke-command-queue.sh` (loopback في Cap) — لا تخلطه بفحوص Mode A أعلاه.

<a id="tauri-desktop-smoke-mode-b"></a>

## الفحص السريع لسطح مكتب Tauri (Mode B)

قائمة تحقق ومساعد لـMode B Tauri (النافذة / تشغيل القناة / PiP). ليس HTTP لمرافق Mode A ولا فحص أجهزة Cap.

</div>

<div dir="ltr">

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

</div>

<div lang="ar" dir="rtl">

التفاصيل: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md). بيانات مطور Apple اختيارية للفحص المحلي؛ استخدم [توقيع ad-hoc](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials) لتطبيق Mac المحزّم. يظل القبول البشري يشمل الفتح والتشغيل وPiP.

<a id="docker"></a>

## Docker

تُبنى الصور متعددة المعمارية (amd64/arm64) كأرشيفات OCI مرشحة. يرقّي النشر في السجل الأرشيف المستقر المعتمد إلى Docker Hub دون إعادة بناء؛ راجع [دليل المشغّل](docs/release-workflow.md).

يُبنى الملف التنفيذي للخادم على **musl** (Alpine) ويُوزّع على Alpine — **لا** يحتاج GLIBC_2.38+. يبقي ذلك `alvit/ottplay-foss` قابلًا للتشغيل في Docker على Synology DSM (x86_64) والمضيفات ذات glibc الأقدم.

</div>

<div dir="ltr">

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

</div>

<div lang="ar" dir="rtl">

تستخدم وسوم السجل المستقرة `X.Y.Z`. تحديث `latest` خيار صريح منفصل بعد نشر الصورة ذات الإصدار؛ لا تنشر عمليات الدفع إلى main أو وسوم Git صورًا.

<a id="build-from-source"></a>

## البناء من المصدر

تأتي قواعد نطاق المشغّل من حزمة Kotlin متعددة المنصات المثبّتة في `vendor/ottplay-core.js`. تتشارك قرارات الدليل والأرشيف والقوائم والمزوّد والحالة الدائمة والتشغيل التنفيذ مع FOSS2 وAndroid الأصلي. تحتفظ محولات المتصفح/التلفزيون وSwift وRust بواجهات الجهاز والترميزات والشبكات وتأثيرات الواجهة. تحافظ حزمة المتصفح على صياغة ES5 وتهيئة API القديمة المدعومة. يتحقق `npm test` و`check:bundle` و`check:es5` من التكامل؛ ويسجل manifest الحزمة بصمات المصدر والمخرجات.

تُولّد أدوات التحقق من بروتوكولي خادم التحكم وSWOP من المخطط ذي الإصدار `contracts/ottplay-wire-v1.json`. تمنع إيصالات التوليد المدققة وبيانات التوافق الثابتة نسخ السياسات الخاصة بكل مستهلك.

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

<div lang="ar" dir="rtl">

<a id="device-detection"></a>

## اكتشاف الجهاز

يدعم المشغّل 24 نوع جهاز. يبدأ الاكتشاف بعنوان `/f/{device_id}/` ثم User-Agent.

| معرّف الجهاز | الجهاز |
|---|---|
| `pc` | متصفح حاسوب |
| `pc2` | مشغّل ويب videojs |
| `nodejs` | تطبيق Windows (Electron) |
| `lg/webos` | تلفزيونات LG WebOS |
| `samsung/tizen` | تلفزيونات Samsung Tizen |
| `samsung/maple` | تلفزيونات Samsung Orsay |
| `mag` | أجهزة Infomir MAG |
| `dune` | أجهزة Dune HD |
| `android` | Android TV / أجهزة لوحية |
| `hbbtv` | تلفزيونات HbbTV |
| `panasonic` | تلفزيونات Panasonic Viera |
| `philips` | تلفزيونات Philips |
| `sony` | تلفزيونات Sony |
| `sharp` | تلفزيونات Sharp |
| `toshiba` | تلفزيونات Toshiba |
| `hisense` | تلفزيونات Hisense |
| `skyworth` | تلفزيونات Skyworth |
| `tcl` | تلفزيونات TCL |
| `vewd` | أجهزة Vewd |
| `spark` | مستقبلات Spark |

<a id="push-command-system"></a>

## نظام أوامر الدفع

لخدمة منفصلة متعددة الأجهزة استخدم [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) وقسم **خادم الأوامر** في **الإعدادات ← التحكم عن بُعد**. أدخل IP/عنوانه ورمز وصول هذا المشغّل؛ يبدأ حفظ الاثنين الاستقصاء تلقائيًا لأوامر الصوت والقنوات وغيرها. يستخدم IP دون منفذ HTTP 8081. امسح العنوان أو اختر **قطع الاتصال** للتوقف. يدعم هذا الاتصال الصادر تسليمًا مؤكّد الاستلام ولا يتطلب مستمعًا محليًا. راجع [تفاصيل الاتصال والتوافق](docs/remote-command-server.md). تصف الأمثلة التالية وضع الوكيل/المستمع المحلي الحالي.

تتيح ميزة **البحث عن خادم الأوامر** اكتشاف وحدة تحكم وطلب موافقة المشغّل بدلًا من نسخ رمز وصول الجهاز. يتحقق Tauri أولًا عبر DNS الأصلي، ويمكنه الرجوع إلى ملف تعريف نشر محدد صراحةً إذا كانت النتيجة فارغة؛ أما مشغّلات المتصفح وLG وCapacitor فتستخدم مسار ملف التعريف في المتصفح. يمكن استضافة بيانات اكتشاف Home على here.now بشكل مستقل عن وحدة التحكم. لا تتضمن البنيات العامة ملف تعريف Home تلقائيًا، ولا يستبدل التحديث الاتصالات المحفوظة. راجع [سلوك المنصات وإعداد ملف التعريف واستكشاف الأخطاء وإصلاحها](docs/remote-command-server.md#discovery-and-one-time-approval).

التحكم المحلي عبر HTTP **معطّل افتراضيًا** في مشغّل المتصفح/OTT server وTauri وCapacitor. فعّله في **إعدادات المشغّل ← التحكم عن بُعد** لتوليد رمز جهاز سري. الأوامر كائنات JSON بحقل `"command"`؛ وتتطلب طلبات HTTP الترويسة `Authorization: Bearer <device-code>`.

<a id="architecture"></a>

### البنية

<a id="local-command-url-recommended"></a>

#### عنوان الأوامر المحلي (موصى به)

فعّل **التحكم المحلي عبر HTTP** في **إعدادات المشغّل ← التحكم عن بُعد**، وانسخ **رمز الجهاز** المولّد واضبط به الوكيل أدناه. اضبط **عنوان الأوامر المحلي** على نقطة أوامر الوكيل. أثناء التفعيل يستقصي المشغّل هذا العنوان كل 10 ثوانٍ مع رمز الجهاز في ترويسة Authorization. مجرد تعيين URL لا يفعّل التحكم بالأوامر.

</div>

<div dir="ltr">

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

</div>

<div lang="ar" dir="rtl">

<a id="device-uuid"></a>

#### UUID الجهاز

UUID الجهاز الحالي (مثل `dev_a1b2c3d4e5`) بيانات توجيه عامة، وليس بيانات اعتماد. يُولّد **رمز الجهاز** المنفصل بأمان عند تفعيل التحكم المحلي عبر HTTP ويبقى على هذا الجهاز؛ ولا يُنسخ عبر إعدادات السحابة. تعطيل التحكم يوقف الاستقصاء/المستمعات. إعادة التفعيل تولّد رمزًا جديدًا: حدّث الوكيل والتكاملات لإبطال بيانات الاعتماد القديمة.

لا يبدأ Tauri وCapacitor مستمع HTTP على loopback إلا بعد هذه الموافقة في الإعدادات. يجب أن ترسل وكلاء إعادة التوجيه رمز الجهاز المعروض كرمز Bearer إلى المستمع. يستخدم Mode A طابور `local_proxy.py` المضبوط منفصلًا والمشروح أدناه.

<a id="remote-text-entry-swop"></a>

#### إدخال النص عن بُعد (swop)

الغرض: الكتابة على الهاتف لـ♥™ / لوحة المفاتيح الافتراضية البعيدة عندما يكون التلفزيون والهاتف على **شبكتين مختلفتين**، عبر تسليم جلسة باستخدام Cloudflare Worker.

- مستودع Worker: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop)
- **تخويل التثبيت:** يرسل المشغّل الطلبات إلى مرحّل `/swop` من الأصل نفسه على خادمه. يضيف الخادم رمز التثبيت السري؛ ويمكن لكل عميل على أصل الخادم المسجّل استخدام إدخال النص البعيد. تعرّف UUIDs الأجهزة الجلسات ولا تحتاج لقائمة سماح لكل جهاز.
- الإعداد: `swopBaseUrl` (فارغ = يعرض ♥™ «غير مضبوط» / لا يفعل شيئًا). عدّله في **الإعدادات ← التحكم عن بُعد** (المفتاح **2**) أو احقنه عبر `/local/swop.json` المتجاهَل في Git لتثبيتات المشغّلين.
- يتضمن `POST /session` الحقول `clientId` و`caption` و`draft`؛ ويتضمن `POST /val` الحقول `clientId` و`code` و`sessionToken` المعاد. يحتوي URL الهاتف رمز كتابة منفصلًا. تبقى رموز قراءة الجلسة في ذاكرة المتصفح.
- **تثبيت محلي:** اضبط `SWOP_BASE_URL` و`SWOP_INSTALLATION_TOKEN` بعد تسجيل التثبيت وأصول LAN/localhost الدقيقة في Worker. يحفظهما `scripts/install-ottplay-local-service.sh` في ملف launchd plist خاص بصلاحية 0600. يحتوي `/local/swop.json` العام فقط `{"swopBaseUrl":"/swop"}`. لا تضع رمز التثبيت مطلقًا في الموارد العامة.
- **استضافة ثابتة:** اضبط وكيلًا مصادقًا من جهة الخادم لنقطتي النهاية نفسيهما. أبقِ رمز التثبيت في أسرار خدمة الاستضافة. نسخ ملفات المشغّل العامة لا ينسخ بيانات اعتماد الخادم.

> يبقي خادم OTT المركزي `/api/webhook/commands` و`/webhook/poll` و`/webhook/notify` وأسماء صحة الأوامر البديلة معطّلة لكل طرق HTTP. استخدم خادم الأوامر المنفصل أو `local_proxy.py` مصادقًا ومضبوطًا صراحة لـMode A؛ لا يوجد طابور أوامر بث عام في الخادم المركزي.

<a id="available-commands"></a>

### الأوامر المتاحة

تستخدم الأمثلة التالية `http://192.168.1.50:8081/api/webhook/commands` عنوانًا للوكيل المحلي. استبدله بعنوانك الحقيقي واضبط `OTTPLAY_QUEUE_HTTP_TOKEN` على **رمز الجهاز** المعروض بعد تفعيل تحكم HTTP في إعدادات المشغّل. يجب ضبط الوكيل بالرمز نفسه.

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — عرض إشعار منبثق

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

</div>

<div lang="ar" dir="rtl">

| الحقل | النوع | الافتراضي | الوصف |
|---|---|---|---|
| `message` | string | مطلوب | النص المعروض |
| `popup_duration` | number | 5 | ثواني العرض (الركن العلوي الأيمن) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — تغيير القناة حسب موقعها في القائمة

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

</div>

<div lang="ar" dir="rtl">

| الحقل | النوع | الافتراضي | الوصف |
|---|---|---|---|
| `channel_number` | number | مطلوب | موقع القناة في القائمة بدءًا من 1 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — تغيير القناة حسب الاسم (أو جزء منه)

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

</div>

<div lang="ar" dir="rtl">

بحث عن جزء من النص دون تمييز حالة الأحرف. تُختار أول مطابقة.

| الحقل | النوع | الافتراضي | الوصف |
|---|---|---|---|
| `channel_name` | string | مطلوب | اسم القناة أو جزء منه |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — الانتقال لقناة عشوائية

يختار هذا الأمر القديم القنوات المؤهلة من القائمة أو الفئة الحالية. تشير أرقام القنوات والنطاقات إلى مواضعها في تلك القائمة؛ راجع [سياسة الاختيار العشوائي الآمن](docs/remote-command-server.md#safe-random-playback).

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

<div lang="ar" dir="rtl">

| الحقل | النوع | الافتراضي | الوصف |
|---|---|---|---|
| `random_range` | [start, end] | القائمة الحالية | نطاق يبدأ من 1 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — تبديل مزوّد IPTV

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

</div>

<div lang="ar" dir="rtl">

| الحقل | النوع | الافتراضي | الوصف |
|---|---|---|---|
| `provider` | number | مطلوب | الفهرس في مصفوفة المزوّدين (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — تحميل قائمة M3U جديدة

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

</div>

<div lang="ar" dir="rtl">

| الحقل | النوع | الافتراضي | الوصف |
|---|---|---|---|
| `playlist` | string | مطلوب | URL قائمة M3U |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — تحديث إعداد المزوّد

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

</div>

<div lang="ar" dir="rtl">

| الحقل | النوع | الافتراضي | الوصف |
|---|---|---|---|
| `provider_settings` | string | مطلوب | سلسلة JSON بإعداد المزوّد |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — ضبط مستوى الصوت أو تغييره

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

<div lang="ar" dir="rtl">

يُتجاهل بصمت على العملاء الذين لا يدعمون التحكم بالصوت.

| الحقل | النوع | الافتراضي | الوصف |
|---|---|---|---|
| `volume` | number | — | مستوى مطلق 0-100 |
| `volume_step` | number | — | تغيير نسبي، مثل +10 أو -5 |

<a id="player-standby-restart-and-exit"></a>

#### استعداد المشغّل وإعادة تشغيله وإغلاقه

لا يدعم طابور webhook غير المؤكد في الوكيل المحلي `exit_player` أو طلبات الاستعداد/الإيقاظ ذات الأنواع المحددة. صِل المشغّل بـ[خادم الأوامر](docs/remote-command-server.md) واستخدم CLI الخاص به:

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

<div lang="ar" dir="rtl">

استبدل `d1` بالاسم البديل لمشغّلك المسجّل. `stop` بديل لـ`standby`؛ و`start` و`wake` بديلان لـ`go`. يتطلب Go مشغّلًا يعمل ومتصلًا؛ ولا يستطيع تشغيل تطبيق مغلق أو إيقاظ جهاز غير متصل. المتصفح أو التلفزيون دون إغلاق تطبيق أصلي يُبلغ أن الإغلاق غير مدعوم. يُبقي الاستعداد الاستقصاء البعيد نشطًا ولا يعلّق عملًا غير متعلق به على المضيف أو الخادم المشترك.

بعد standby/go افحص `ott d1 status` لحالة الاستعداد/الخلفية وتحقق من استئناف التشغيل منفصلًا. بعد إعادة تحميل المشغّل تأكد من runtime جديد عبر `ott d1 doctor`. بعد الإغلاق تأكد بواسطة نظام التشغيل أن عملية التطبيق أُغلقت؛ مهلة بعيدة لا تثبت الإغلاق. قبول الأمر وحده لا يؤكد هذه النتائج.

<a id="local-proxy-server"></a>

## خادم الوكيل المحلي

`local_proxy.py` طابور أوامر مصادق مستقل لمشغّل واحد. ينتهي استدعاؤه الافتراضي دون فتح منفذ. تستخدم كل نسخة رمز الجهاز المولّد من المشغّل؛ استخدم نسخًا/منافذ منفصلة لمشغّلين متعددين. يُقبل معامل الاستعلام `device_id` كبيانات توافق فقط، ولا يصادق مطلقًا أو يختار جهازًا آخر.

<a id="start-the-proxy"></a>

### بدء الوكيل

1. فعّل **التحكم المحلي عبر HTTP** في المشغّل وانسخ **رمز الجهاز**.
2. على مضيف الوكيل اضبط الرمز والأصل الدقيق الذي يقدم المشغّل (المخطط والمضيف والمنفذ، دون مسار):

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

<div lang="ar" dir="rtl">

3. اضبط **عنوان الأوامر المحلي** في المشغّل على `http://192.168.1.50:8081/api/webhook/commands`.

عنوان الربط الافتراضي `127.0.0.1`؛ يفعّل المثال الوصول عبر LAN صراحة. `OTTPLAY_QUEUE_HTTP_ORIGINS` قائمة سماح بأصول متصفح دقيقة مفصولة بفواصل. استخدم وكيل HTTPS عكسيًا عند تقديم المشغّل عبر HTTPS، لتسمح قواعد المحتوى المختلط بالاستقصاء. أبقِ رمز الجهاز سريًا وخارج URLs. عندما يولّد المشغّل رمزًا جديدًا، أعد تشغيل الوكيل بالقيمة الجديدة؛ تعطيل المشغّل وحده لا يوقف عملية وكيل تُدار منفصلًا.

<a id="endpoints"></a>

### نقاط النهاية

| الطريقة | المسار | الوصف |
|---|---|---|
| `POST` | `/api/webhook/commands` | إدراج أمر بالطابور |
| `GET` | `/api/webhook/commands` | جلب الأوامر المنتظرة (استقصاء المشغّل) |
| `POST` | `/webhook/notify` | اسم بديل مصادق للتوافق |
| `GET` | `/webhook/poll` | اسم بديل مصادق للتوافق |

يتطلب الإرسال والتفريغ رمز Bearer المطابق للجهاز. لا توجد نقطة بث عام دون مصادقة. تنتهي الأوامر بعد 60 ثانية؛ ويحتفظ كل وكيل بـ50 أمرًا كحد أقصى.

يعالج الوكيل حتى 16 اتصالًا متزامنًا، لذا لا يؤخر اتصال متصفح خامل أو طلب غير مكتمل طلبات الأوامر الأخرى. لكل socket مهلة خمول خمس ثوانٍ؛ وتُغلق الاتصالات الإضافية عندما تنشغل كل العمال. إدراج الطابور وتفريغه عمليتان ذريتان بين العمال.

<a id="smoke-script-all-modes"></a>

### سكربت الفحص السريع (كل الأوضاع)

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

<div lang="ar" dir="rtl">

محاكي/جهاز Android: نفّذ أولًا `adb forward tcp:18081 tcp:18081`. يعمل Cap/Tauri على loopback فقط — استخدم وكيل Mode A هذا لـHome Assistant عبر LAN. التفاصيل: `docs/capacitor-mobile.md`، قسم Smoke test.

<a id="cors"></a>

### CORS

يسمح الوكيل بطلبات المتصفح فقط من `OTTPLAY_QUEUE_HTTP_ORIGINS`. لا تحتاج طلبات `OPTIONS` التمهيدية من أصل مسموح إلى رمز؛ كل GET/POST فعلي يحتاج رمز Bearer للجهاز. لا تُقبل الأصول wildcard أو `null`. يستطيع Home Assistant والعملاء الآخرون غير المتصفحات حذف Origin لكن تبقى المصادقة مطلوبة.

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### مثال: webhook في Home Assistant ← الوكيل المحلي ← المشغّل

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

<div lang="ar" dir="rtl">

<a id="home-assistant-automation-examples"></a>

### أمثلة أتمتة Home Assistant

تستخدم أمثلة الإشعار والقناة والصوت الوكيل المحلي. اضبط `ottplay_device_authorization` في `secrets.yaml` الخاص بـHome Assistant إلى `Bearer <device-code>` مستخدمًا الرمز الظاهر في المشغّل المفعّل.

يستخدم الاستعداد الليلي [خادم الأوامر](docs/remote-command-server.md) المنفصل. استبدل عنوان مثاله و`DEVICE_UUID` أدناه بعنوان المتحكم ومعرّف الجهاز المسجل؛ الاسم المحلي لـCLI وهو `d1` ليس معرّف جهاز. اضبط `ottplay_control_authorization` إلى `Bearer <controller-admin-token>` في `secrets.yaml`. بيانات الاعتماد هذه منفصلة عن رمز جهاز الوكيل المحلي. راجع توثيق Home Assistant لـ[RESTful Command](https://www.home-assistant.io/integrations/rest_command/) و[الأسرار](https://www.home-assistant.io/docs/configuration/secrets/).

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

<div lang="ar" dir="rtl">

يحتوي `standby_request` استجابة HTTP لسجل الأتمتة. HTTP 202 يعني الإدراج فقط: احتفظ بـ`content.id`، ثم استقصِ `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` ببيانات اعتماد المتحكم نفسها للحصول على رد المشغّل. يراقب طلب `status` جديد `player.standby` و`player.background`؛ تفعيل الاستعداد مع `suspended` وصفر أعمال معلقة يؤكد تفريغ العمل المتتبع للمشغّل. لمغادرة الاستعداد استخدم الطلب ذا النوع نفسه مع `"operation":"wake"` (`ott d1 go`). لا تكرر عملية تغيير عمياء بعد مهلة. راجع [API الطلب/الاستجابة](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) و[دلالات الاستعداد](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake) للمتحكم.

<a id="server-api-reference"></a>

## مرجع API الخادم

<a id="webhook-endpoints-rust-ottplay-server"></a>

### نقاط Webhook (Rust `ottplay-server`)

يرفض خادم Rust وبديل Python المؤرشف نقاط الأوامر برمز HTTP 403. لا تدرج `/api/webhook/commands` و`/webhook/notify` و`/webhook/poll` وأسماء صحة الأوامر البديلة أوامر ولا تبثها أو تفرغها. لا يمكن لـAPI الملاحظات العامة تجاوز هذه المسارات المحجوزة. يستخدم تسليم أوامر Mode A خادم الأوامر المضبوط منفصلًا أو الوكيل المحلي المصادق الموصوف أعلاه.

<a id="other-endpoints"></a>

### نقاط نهاية أخرى

| الطريقة | المسار | الوصف |
|---|---|---|
| `GET` | `/epg/<hash>.json` | بيانات EPG للقناة |
| `GET` | `/logo/<id>.svg` | شعار قناة مولّد |
| `GET` | `/version/<path>` | بصمة إصدار الملف |
| `POST` | `/m3u/match-channels` | مطابقة القنوات مع EPG |
| `POST` | `/m3u/match-logos` | مطابقة شعارات القنوات |
| `POST` | `/m3u/cp.php` | وكيل بث |
| `GET/POST` | `/feedback/` | تسجيل الملاحظات |
| `GET` | `/tmdb/*` | وكيل TMDb API |

<a id="epg"></a>

### EPG

</div>

<div dir="ltr">

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

</div>

<div lang="ar" dir="rtl">

<a id="project-structure"></a>

## بنية المشروع

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

<div lang="ar" dir="rtl">

<a id="stb-key-mappings"></a>

## تعيينات مفاتيح STB

- **Samsung Tizen**: `RETURN=10009`، `ENTER=13`، الألوان 403-406
- **Samsung Maple**: dpad 4/5/6/8، رموز SDK الأصلية
- **LG WebOS**: `RETURN=461`، ألوان متوافقة مع HbbTV
- **LG NetCast**: `RETURN=8`، رموز HbbTV
- **MAG**: `RETURN=8`، gSTB API لـMAC
- **Dune HD**: رموز قياسية، Dune API
- **Android TV**: رموز Android (`BACK=4`، `DPAD_*` 19-22، `ENTER=66`)
- **HbbTV/Panasonic/Philips/Sony/وغيرها**: رموز HbbTV (`RED=403`، `BLUE=406`، `VOL_UP=447`)

<a id="documentation"></a>

## التوثيق

- [ويكي التوثيق](./docs/wiki/Home.ar.md) / [Вики по-русски](./docs/wiki/Home.ru.md) — تنقل حسب المهام وقواعد الصيانة.
- [تقرير التنفيذ](./docs/implementation-report.ar.md) / [Процесс и результат](./docs/implementation-report.ru.md) — مخططات ملونة وسلوك متحقق منه وكلفة مقاسة وبوابات الإصدار.
- [دليل التسليم](./docs/roadmap-delivery.ar.md) / [Руководство по новым возможностям](./docs/roadmap-delivery.ru.md) — المزايا والحدود والتحقق.
- [أدلة بدء بـ88 لغة واجهة](./docs/readme/README.md) — مولّدة من ترجمات الواجهة الموزعة؛ الدليل الرئيسي وأدلة المزايا المقترنة متاحة بـ[24 لغة توثيق](docs/manual-translations.md).
- [حدود الجودة واسترداد البث المباشر](./docs/playback-stream-policy.ar.md) / [По-русски](./docs/playback-stream-policy.ru.md).
- [ربط XMLTV اليدوي وإمكانية الوصول الكلاسيكية](./docs/guide-binding-accessibility.ar.md) / [По-русски](./docs/guide-binding-accessibility.ru.md).
- [فحص الصوت/الفيديو المستضاف](./docs/audio-video-check.ar.md) / [По-русски](./docs/audio-video-check.ru.md).
- [مكتبة وسائط Xtream](./docs/xtream-media.ar.md) / [По-русски](./docs/xtream-media.ru.md).
- [تسليم الأجهزة من المصدر نفسه](./docs/remote-handoff.ar.md) / [По-русски](./docs/remote-handoff.ru.md).
- [إعدادات محلية قابلة للاسترداد](./docs/settings-recovery.ar.md) / [По-русски](./docs/settings-recovery.ru.md).
- [أجيال المتصفحات وأنظمة التشغيل وفحوص مرشح الإصدار الدقيقة](docs/browser-compatibility.ar.md) / [По-русски](docs/browser-compatibility.ru.md).

- [بنية المشغّل](./docs/architecture.md) — ملكية التشغيل وتكامل المزوّد والتشغيل والدليل ومحولات الأجهزة وعقود البناء.
- [خط بناء ES5 الكلاسيكي](./docs/build-pipeline.md) — الترجمة البرمجية وفحوص التوافق وحدود أحجام الحزم.
- [أسماء موارد التشغيل وترحيل النشر](./docs/asset-layout.md) — مسارات وصفية مشتركة بين الويب والحزم الأصلية.
- [منصة العمل البعيدة](./docs/remote-workbench.md) — فحص الواجهة/الوسائط وإيصالات العمليات والأدلة المحفوظة.
- [تشخيص التشغيل](./docs/runtime-debug.md) — تاريخ الأخطاء وعدادات الإطارات/الحلقات ومقاييس Capacitor/Tauri الأصلية وتشخيص الخادم.
- [التسليم المحلي على macOS](./docs/macos-local-delivery.md) — البناء من نسخة المستودع والتثبيت المحلي والتحقق.

<a id="license"></a>

## الترخيص

[MIT](LICENSE) — حر ومفتوح المصدر. يحتفظ محتوى المزوّد وتبعيات الأطراف الثالثة بحقوقه وتراخيصه الخاصة.

يُوزَّع تطبيق [OTTPlay native webOS](docs/native-webos.md) المنفصل، المشتق من PlxNative، بموجب **GPL-3.0-or-later** مع الشفرة المصدرية المقابلة.
ولا تعيد رخصة MIT في جذر المشروع ترخيص هذا التطبيق الأصلي أو تعديلاته.

<a id="desktop-updater--notarization-mode-b"></a>

## محدّث سطح المكتب / notarization (Mode B)

يصف [دليل توقيع سطح المكتب والمحدّث](docs/tauri-updater-notarize.md) توقيع macOS ad-hoc وخيار Developer ID/notarization والتحقق من الحزمة. يستخدم CI الإصدار توقيع ad-hoc دون بيانات اعتماد Apple. توقيع المحدّث منفصل؛ وتظل التحديثات التلقائية للإنتاج غير مضبوطة.

<a id="local-mac-build-helpers"></a>

## مساعدات البناء المحلي على Mac

راجع [docs/local-build-scripts.md](docs/local-build-scripts.md).

<a id="privacy"></a>

## الخصوصية

اقرأ [سياسة الخصوصية](docs/privacy-policy.md) لمعلومات عن الإعدادات المحلية والخدمات المضبوطة وخياراتك. للتواصل بشأن الخصوصية والدعم: [alvit.work@gmail.com](mailto:alvit.work@gmail.com).

Studio 2026 سمة الواجهة الافتراضية. يبقى Classic وPLi-HD متاحين للاختيار وتُحفظ تفضيلات المستخدم. راجع [إعدادات الواجهة](docs/interface-settings.md). تنسب سمة PLi-HD الفضل إلى Vali وlittlesat وVU+NL وMilo والمساهمين الأصليين. راجع [اعتمادات الواجهة وتاريخ التصميم](docs/interface-history.md) للتاريخ الإنجليزي وروابط المصادر، والمتاح أيضًا من قائمة معلومات المشغّل.

<a id="demo-video-editing"></a>

## تحرير فيديو العرض

استخدم [سير عمل video-use](docs/demo-video.md) المحلي لتحضير تسجيلات العرض وتحريرها. يُبقي المساعد كل الوسائط المولّدة خارج Git.

<a id="plex-media-library"></a>

## مكتبة وسائط Plex

يستطيع كل مشغّل الاتصال بحساب Plex أو Plex Media Server باستخدام مزوّد **Plex**. يستخدم التكامل Plex؛ وSynology مضيف محتمل لخادم الوسائط. تظهر جميع مقاطع الفيديو والمسارات الموسيقية المتاحة تلقائيًا في قائمة القنوات؛ يتيح اختيار الفئة التصفية حسب المكتبة أو المجلد أو المسلسل. يبدأ التشغيل من أول دفعة صالحة مع تحميل خلفي وبحث معتاد وإجراءات للخلط/التكرار، دون ضبط Plex على خادم OTT. راجع [تسجيل الدخول إلى Plex والتشغيل المباشر](docs/plex-provider.md).

![دورة تحميل Plex والتنقل في الملفات والإغلاق](docs/images/plex-playback-lifecycle.svg)

تشرح [مراجعة الموثوقية المصوّرة](docs/plex-provider.md#reliability-review-process-and-results) قواعد التحميل والإلغاء وإصلاحات الكتالوجات الكاملة وتبديل الملفات ونتائج التحقق المقاسة في Chromium/WebKit.

يتيح تكامل اختياري على خادم OTT أيضًا كتالوج خادم Plex قائم وتشغيله المتوافق عبر مدخل مكتبة NAS منفصل وتصدير M3U. راجع [إعداد المكتبة بالخادم ووصول العميل](docs/synology-library.md).

<a id="related-repositories"></a>

## المستودعات ذات الصلة

- يملك [ottplay-core](https://github.com/open-ott-play/ottplay-core) منطق النطاق المشترك JVM/ES5 وعقود النقل وعميل FOSS2. يستهلك هذا المشغّل الحزم المولّدة؛ اتبع دليل تسليم core للتغييرات المشتركة.
- [ottplay-android](https://github.com/open-ott-play/ottplay-android) تطبيق Kotlin/Compose أصلي منفصل، بهوية تثبيت وإصدار خاصة به.
- يوفّر [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server) أوامر بعيدة مستضافة ذاتيًا؛ ويوفّر [ottplay-swop](https://github.com/open-ott-play/ottplay-swop) نقلًا اختياريًا لإدخال النص يعتمد Worker.
- يملك [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine) ملف العرض المستضاف في المتصفح ووسائطه والتحقق من النشر.

<a id="project-maintenance"></a>

## صيانة المشروع

راجع [متطلبات المساهمة والاختبار](CONTRIBUTING.md) و[سياسة الإبلاغ الأمني](SECURITY.md) و[التصميم الأمني](docs/security-design.md) و[أدلة OpenSSF والمعايير المتبقية](docs/openssf-evidence.md).

</div>
