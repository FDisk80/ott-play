<a id="ott-play-documentation-wiki"></a>

# วิกิเอกสาร OTT-play

<!-- language-navigation:start -->
<p dir="ltr">
<a href="Home.md" lang="en" dir="ltr">English</a> · <a href="Home.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="Home.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="Home.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="Home.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="Home.es.md" lang="es" dir="ltr">Español</a> · <a href="Home.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="Home.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="Home.he.md" lang="he" dir="rtl">עברית</a> · <a href="Home.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="Home.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="Home.it.md" lang="it" dir="ltr">Italiano</a> · <a href="Home.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="Home.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="Home.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="Home.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="Home.pt.md" lang="pt" dir="ltr">Português</a> · <a href="Home.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="Home.th.md" lang="th" dir="ltr">ไทย</a> · <a href="Home.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="Home.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="Home.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="Home.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="Home.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[README](../../README.th.md) · [ภาษาอินเทอร์เฟซทั้งหมด](../readme/README.md)

นี่คือหน้าแรกของเอกสารที่ควบคุมเวอร์ชันในที่เก็บซอร์ส GitHub แสดงหน้า Markdown เหล่านี้ได้โดยตรง การดูแลไว้ที่นี่ทำให้คำแนะนำ แผนภาพ และการทดสอบได้รับการตรวจพร้อมโค้ด [GitHub Wiki](https://github.com/open-ott-play/ottplay-foss/wiki) ที่แยกต่างหากส่งออกจากซอร์สเหล่านี้และระบุรีวิชันซอร์สในทุกหน้า ดู[คำแนะนำการเผยแพร่](../wiki-publishing.md)

<a id="start-and-install"></a>

## เริ่มต้นและติดตั้ง

- [คู่มือปฏิบัติ](../../README.th.md) มีให้ใน[เอกสาร 24 ภาษา](../manual-translations.md)
- [คู่มือเริ่มต้นฉบับแปลสำหรับภาษาอินเทอร์เฟซทั้ง 88 ภาษา](../readme/README.md) ใช้คำบรรยาย UI ที่แปลแล้วและขั้นตอนนำทางซ้ำ ไม่ใช่คู่มือวิศวกรรมฉบับแปล 88 ภาษา คู่มือหลักและคู่มือฟีเจอร์ที่มีคู่ฉบับมีฉบับสมบูรณ์ใน 24 ภาษา
- [แพ็กเกจและอัปเดต Android Full/API 22](../android-distributions.md), [การบิลด์ Android](../../android/README.md) และ [Capacitor iOS/Android](../capacitor-mobile.md)
- [การส่งมอบเดสก์ท็อปบน macOS](../macos-local-delivery.md), [การลงนาม/ตัวอัปเดต Tauri](../tauri-updater-notarize.md) และ[อินสแตนซ์ HTTP ภายใน](../local-http-deployment.md)

<a id="process-and-results"></a>

## กระบวนการและผลลัพธ์

- [การรับรองเบราว์เซอร์และตรวจรุ่นที่เสนอเผยแพร่](../browser-compatibility.th.md) ([Русский](../browser-compatibility.ru.md)): เป้าหมายที่ตั้งค่าไว้ แผนภาพสี การตรวจแพ็กเกจที่แน่นอน และผลภายในเครื่องที่แยกไว้

- [รายงานการพัฒนาและแผนภาพสี](../implementation-report.th.md) ([Русский](../implementation-report.ru.md)): การเปลี่ยนแปลงที่ตรวจแล้ว ปัญหาถดถอยที่แก้แล้ว ผลที่วัด และเงื่อนไขเผยแพร่ที่เหลือ

<a id="use-the-new-capabilities"></a>

## ใช้ความสามารถใหม่

- [การส่งมอบฟีเจอร์และขอบเขตแพลตฟอร์ม](../roadmap-delivery.th.md) ([Русский](../roadmap-delivery.ru.md))
- [เพดานคุณภาพ แหล่งสำรองไลฟ์ที่ระบุชัด และการกู้คืนแบบจำกัด](../playback-stream-policy.th.md) ([Русский](../playback-stream-policy.ru.md))
- [การผูก XMLTV ด้วยตนเองและการเข้าถึงแบบคลาสสิก](../guide-binding-accessibility.th.md) ([Русский](../guide-binding-accessibility.ru.md))
- [การตรวจภาพและเสียงแบบโฮสต์](../audio-video-check.th.md) ([Русский](../audio-video-check.ru.md)): **ข้อมูล → เสียง → เล่น** เสียงที่คาดหวัง แผนภาพโฮสต์ และกลับสู่ทีวีสด คลิปดึงเมื่อร้องขอ ต้องใช้อินเทอร์เน็ต และไม่มีในแพ็กเกจเครื่องเล่น เดโมรูปแบบเคลื่อนไหวออนไลน์ที่แยกไว้นั้นไม่มีเสียง
- [คลังภาพยนตร์/ซีรีส์ Xtream](../xtream-media.th.md) ([Русский](../xtream-media.ru.md))
- [ส่งต่อเครื่องเล่นในแหล่งเดียวกัน](../remote-handoff.th.md) ([Русский](../remote-handoff.ru.md))
- [บันทึกการตั้งค่าภายในและการกู้คืน](../settings-recovery.th.md) ([Русский](../settings-recovery.ru.md))
- [ควบคุมอย่างเชื่อถือได้ โปรไฟล์ที่ทำต่อได้ และการส่งต่อ](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.md) ([Русский](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.ru.md)) ต้องใช้รีวิชันตัวควบคุม/CLI ที่ตรงกันและตั้งค่าสิทธิ์แล้ว
- [ค่ากำหนดเสียง/คำบรรยายเชิงความหมายใน Android เนทีฟ](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.md) ([Русский](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.ru.md)) แอป Kotlin เนทีฟแยกจาก Capacitor APK ของที่เก็บนี้

<a id="configure-sources-and-inspect-problems"></a>

## ตั้งค่าแหล่งและตรวจปัญหา

- [ลงชื่อเข้าใช้และเล่น Plex](../plex-provider.md), [สถาปัตยกรรมผังรายการ](../guide-architecture.md) และ[วินิจฉัย EPG แบบโฮสต์](../hosted-epg-diagnostics.md)
- [การตั้งค่าอินเทอร์เฟซ](../interface-settings.md), [ประวัติการออกแบบและเครดิต](../interface-history.md) และ[แค็ตตาล็อกภาษา/แป้นพิมพ์](../localization.md)
- [โต๊ะทำงานระยะไกล](../remote-workbench.md), [วินิจฉัยรันไทม์](../runtime-debug.md) และ[ความยินยอม การปกปิด และการเก็บข้อมูลวินิจฉัย](../diagnostic-security.md)
- [รายการตรวจอุปกรณ์เนทีฟ](../mode-b-device-smoke.md), [รายการตรวจอุปกรณ์ Tauri](../mode-b-tauri-smoke.md) และ[ตัวควบคุมหน้าต่างเบราว์เซอร์](../browser-window-controls.md)

- [ต้นทุนฟีเจอร์ที่วัดได้](../roadmap-size.th.md) หลักฐานดิบ และกราฟ SVG

<a id="develop-and-release"></a>

## พัฒนาและเผยแพร่

- [สถาปัตยกรรมและความเป็นเจ้าของ](../architecture.md), [เซสชันการเล่น](../playback-session-architecture.md) และ[บิลด์ ES5 แบบคลาสสิก](../build-pipeline.md)
- [ชื่อทรัพยากรรันไทม์](../asset-layout.md), [นโยบายรุ่น](../../RELEASING.md), [คู่มือผู้ดำเนินการเผยแพร่](../release-workflow.md) และ[การฟัซ RC](../../FUZZING.md)
- [นโยบายความเป็นส่วนตัว](../privacy-policy.md) และ[ใบอนุญาต MIT](../../LICENSE)

เมื่อเปลี่ยนเอกสาร ให้เรียก `npm run docs:generate` หากคำบรรยาย UI หรือเทมเพลตเริ่มต้นเปลี่ยน แล้วเรียก `npm run check:docs` ดูแลคำแปลทั้งหมดให้ครบ ระบุข้อจำกัดใกล้ข้อความอ้างความสามารถ และแยกการตรวจภายในเครื่องออกจากการทดสอบอุปกรณ์จริง แผนภาพเป็นทรัพยากรที่ตรวจสอบได้ในที่เก็บ ดู[SVG การผูกผังรายการ](../images/guide-binding.svg) และแผนภาพที่เชื่อมจากคู่มือฟีเจอร์ ตัวตรวจสอบตรวจปลายทางไฟล์สัมพัทธ์ ไม่ใช่ความพร้อมของเว็บไซต์ระยะไกลหรือทุกจุดยึดหัวข้อ Markdown
