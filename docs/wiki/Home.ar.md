<a id="ott-play-documentation-wiki"></a>

# ويكي وثائق OTT-play

<!-- language-navigation:start -->
<p dir="ltr">
<a href="Home.md" lang="en" dir="ltr">English</a> · <a href="Home.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="Home.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="Home.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="Home.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="Home.es.md" lang="es" dir="ltr">Español</a> · <a href="Home.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="Home.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="Home.he.md" lang="he" dir="rtl">עברית</a> · <a href="Home.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="Home.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="Home.it.md" lang="it" dir="ltr">Italiano</a> · <a href="Home.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="Home.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="Home.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="Home.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="Home.pt.md" lang="pt" dir="ltr">Português</a> · <a href="Home.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="Home.th.md" lang="th" dir="ltr">ไทย</a> · <a href="Home.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="Home.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="Home.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="Home.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="Home.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

<div lang="ar" dir="rtl">

[README](../../README.ar.md) · [جميع لغات الواجهة](../readme/README.md)

هذه صفحة الوثائق الرئيسية الخاضعة لإدارة الإصدارات في مستودع المصدر. يستطيع GitHub عرض صفحات Markdown مباشرة؛ وإبقاؤها هنا يجعل التعليمات والمخططات والاختبارات في المراجعة نفسها مع الشيفرة. تُصدّر [GitHub Wiki](https://github.com/open-ott-play/ottplay-foss/wiki) المنفصلة من هذه المصادر وتبيّن مراجعة المصدر في كل صفحة. راجع [تعليمات النشر](../wiki-publishing.md).

<a id="start-and-install"></a>

## البدء والتثبيت

- [الدليل العملي](../../README.ar.md)، متاح بـ[24 لغة للوثائق](../manual-translations.md).
- [أدلة بدء سريع مترجمة لجميع لغات الواجهة الـ88](../readme/README.md). تعيد استخدام تسميات الواجهة وخطوات التنقل المترجمة. وليست 88 دليلًا هندسيًا مترجمًا. يتوفر الدليل الرئيسي وأدلة الميزات المرتبطة به بنسخ كاملة في 24 لغة.
- [حزم وتحديثات Android Full/API 22](../android-distributions.md)، و[بناء Android](../../android/README.md)، و[Capacitor iOS/Android](../capacitor-mobile.md).
- [تسليم تطبيق سطح المكتب على macOS](../macos-local-delivery.md)، و[توقيع ومحدّث Tauri](../tauri-updater-notarize.md)، و[نسخ HTTP المحلية](../local-http-deployment.md).

<a id="process-and-results"></a>

## العملية والنتائج

- [تأهيل المتصفحات والتحقق من النسخة المرشحة](../browser-compatibility.ar.md) ([Русский](../browser-compatibility.ru.md)): أهداف مهيأة ومخططات ملونة وفحوص الحزم الدقيقة ونتائج محلية منفصلة.

- [تقرير التنفيذ والمخططات الملونة](../implementation-report.ar.md) ([Русский](../implementation-report.ru.md)): تغييرات مراجعة وتراجعات مصلحة ونتائج مقاسة وشروط إصدار متبقية.

<a id="use-the-new-capabilities"></a>

## استخدام القدرات الجديدة

- [تسليم الميزات وحدود المنصات](../roadmap-delivery.ar.md) ([Русский](../roadmap-delivery.ru.md)).
- [سقوف الجودة ومصادر البث الاحتياطية الصريحة والاسترداد المحدود](../playback-stream-policy.ar.md) ([Русский](../playback-stream-policy.ru.md)).
- [ربط XMLTV يدويًا والإتاحة التقليدية](../guide-binding-accessibility.ar.md) ([Русский](../guide-binding-accessibility.ru.md)).
- [فحص الصورة والصوت المستضاف](../audio-video-check.ar.md) ([Русский](../audio-video-check.ru.md)): **المعلومات → الصوت → تشغيل**، النغمات المتوقعة ومخطط الاستضافة والعودة إلى التلفزيون المباشر. يُجلب المقطع عند الطلب ويتطلب الإنترنت ولا يوجد في حزم المشغل. العرض المنفصل عبر الإنترنت للنمط المتحرك صامت.
- [مكتبة أفلام ومسلسلات Xtream](../xtream-media.ar.md) ([Русский](../xtream-media.ru.md)).
- [تسليم المشغل ضمن المصدر نفسه](../remote-handoff.ar.md) ([Русский](../remote-handoff.ru.md)).
- [سجل الإعدادات المحلي والاسترداد](../settings-recovery.ar.md) ([Русский](../settings-recovery.ru.md)).
- [تحكم موثوق وملفات تعريف قابلة للاستئناف وتسليم](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.md) ([Русский](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.ru.md)). يتطلب مراجعة متوافقة لوحدة التحكم/CLI وأذونات مهيأة.
- [تفضيلات الصوت والترجمة الدلالية في Android الأصلي](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.md) ([Русский](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.ru.md)). تطبيق Kotlin الأصلي منفصل عن حزم Capacitor APK في هذا المستودع.

<a id="configure-sources-and-inspect-problems"></a>

## تهيئة المصادر وفحص المشكلات

- [تسجيل دخول Plex وتشغيله](../plex-provider.md)، و[بنية دليل البرامج](../guide-architecture.md)، و[تشخيصات EPG المستضافة](../hosted-epg-diagnostics.md).
- [إعدادات الواجهة](../interface-settings.md)، و[تاريخ التصميم والإسناد](../interface-history.md)، و[كتالوجات اللغات ولوحات المفاتيح](../localization.md).
- [منضدة العمل البعيدة](../remote-workbench.md)، و[تشخيصات وقت التشغيل](../runtime-debug.md)، و[الموافقة على التشخيص وإخفاء البيانات والاحتفاظ بها](../diagnostic-security.md).
- [قائمة فحص الأجهزة الأصلية](../mode-b-device-smoke.md)، و[قائمة أجهزة Tauri](../mode-b-tauri-smoke.md)، و[عناصر تحكم نافذة المتصفح](../browser-window-controls.md).

- [تكلفة الميزات المقاسة](../roadmap-size.ar.md)، والأدلة الخام ومخطط SVG.

<a id="develop-and-release"></a>

## التطوير والإصدار

- [البنية والملكية](../architecture.md)، و[جلسات التشغيل](../playback-session-architecture.md)، و[بناء ES5 التقليدي](../build-pipeline.md).
- [أسماء أصول وقت التشغيل](../asset-layout.md)، و[سياسة الإصدارات](../../RELEASING.md)، و[دليل تشغيل مسؤول الإصدار](../release-workflow.md)، و[اختبار التشويش RC](../../FUZZING.md).
- [سياسة الخصوصية](../privacy-policy.md) و[رخصة MIT](../../LICENSE).

عند تعديل الوثائق، شغّل `npm run docs:generate` إذا تغيّرت تسمية واجهة أو قالب بدء سريع، ثم `npm run check:docs`. أبقِ جميع الترجمات كاملة، وضع حدود القدرات قرب الادعاءات، وميّز التحقق المحلي عن اختبار الأجهزة الفعلية. المخططات أصول قابلة للمراجعة في المستودع؛ راجع [ملف SVG لربط دليل البرامج](../images/guide-binding.svg) والمخططات المرتبطة بأدلة الميزات. يتحقق المدقق من وجهات الملفات النسبية، لا من توفر المواقع البعيدة أو كل رابط عنوان داخل Markdown.

</div>
