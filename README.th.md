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

สำหรับไฟล์ในเครื่องที่ไม่ใช้อินเทอร์เน็ต ดู [วิดีโอในเครื่องและการเล่นออฟไลน์](docs/offline-media.md)

[![หน้ารายการช่อง OTT-play FOSS ในมุมมองเอียง](docs/images/hero.png)](docs/images/studio-2026-default.png)

*ภาพหน้าจออินเทอร์เฟซ Studio 2026 ที่มีอยู่ โดยใช้ช่องและรายการสังเคราะห์สำหรับทดสอบ เปิดภาพเพื่อดูต้นฉบับแบบหน้าตรง ภาพนี้ไม่ได้ถ่ายจากบัญชีสมาชิกที่ใช้งานจริง [ที่มาของภาพและการสร้างใหม่](docs/images/README.md)*

[คู่มือเริ่มต้นใน 88 ภาษา](docs/readme/README.md) · [วิกิเอกสาร](docs/wiki/Home.th.md)

[![แนวปฏิบัติที่ดีของ OpenSSF](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![Fuzzing: เฉพาะ RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

รุ่นผู้สมัครเผยแพร่สาธารณะจะรันการทดสอบ fuzz แบบจำกัดขอบเขตและแยกสภาพแวดล้อม สำหรับตัวแยกวิเคราะห์ XMLTV ฝั่งเนทีฟ/เซิร์ฟเวอร์และการตรวจสอบคำขอพอร์ทัล ดู [ขอบเขต fuzzing การทำซ้ำ และหลักฐานการเผยแพร่](FUZZING.md)

เครื่องเล่น IPTV/OTT ที่ทำงานได้ในตัว พร้อมเซิร์ฟเวอร์ HTTP ภาษา Rust ในเครื่อง ใช้ได้บน Smart TV (LG WebOS, Samsung Tizen, Panasonic, Sony ฯลฯ), กล่องรับสัญญาณ (Infomir MAG, Dune HD, Enigma2, Android TV) และเบราว์เซอร์เดสก์ท็อป

เริ่มที่ [คู่มือสถาปัตยกรรมและผู้ร่วมพัฒนา](docs/architecture.md) สำหรับชั้นการทำงาน ผู้รับผิดชอบ วิธีขยายผู้ให้บริการ และการตรวจสอบ ดู [เซสชันการเล่นและอายุการทำงานของผู้ให้บริการ](docs/playback-session-architecture.md) สำหรับขอบเขต core/host และข้อกำหนดความเข้ากันได้

<!-- ci-release-process:start -->
<a id="release-process"></a>

## กระบวนการเผยแพร่

ดู [กลยุทธ์การเผยแพร่](RELEASING.md) สำหรับการตรวจสอบ กฎรุ่น nightly, beta, RC และการเลื่อนเป็น stable และ [คู่มือปฏิบัติการ](docs/release-workflow.md) สำหรับคำสั่งในเครื่อง
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## เปิดในเบราว์เซอร์

เปิด [เดโมออนไลน์](https://player.ottplay.here.now/) หรือสร้างและให้บริการเครื่องเล่นเว็บตามคำแนะนำด้านล่าง

[การติดตั้งใช้งานบน macOS ในเครื่อง](docs/local-http-deployment.md) ให้ origin แบบ HTTP ของเครื่องเล่นที่พอร์ต 8443–8446 เลิกใช้พอร์ต 8095 แล้ว

ในการเปิดครั้งแรก เลือก **ลองเดโม** เพื่อเล่นภาพทดสอบเคลื่อนไหว หรือกำหนดเพลย์ลิสต์ M3U หรือผู้ให้บริการของคุณเอง ภายหลังยังเปิดเดโมได้จาก **เปลี่ยนผู้ให้บริการ → เดโม**

เดโมต้องใช้อินเทอร์เน็ตแต่ไม่ต้องมีบัญชีผู้ให้บริการ ช่องทดสอบ MP4 และ HLS ที่ไม่มีเสียงโฮสต์บน here.now และใช้ร่วมกันในเว็บ, Tauri, Capacitor และ OTT Server การเปลี่ยนโหมดจะเก็บการตั้งค่าผู้ให้บริการเดิมไว้ สำหรับ **ทดสอบภาพและเสียง** แยกต่างหาก ให้เปิด **ข้อมูล → เสียง → เล่น** บนเอนจิน HTML5 ที่ระบบจัดการ ขณะว่างหรือดูทีวีสด การทดสอบนี้ใช้ไฟล์มีเสียง `av-v1.mp4` บน here.now และต้องใช้อินเทอร์เน็ต คลิปไม่ได้อยู่ในแพ็กเกจเครื่องเล่นและไม่ถูกดาวน์โหลดตอนเริ่มทำงาน ไม่ครอบคลุม VOD, ย้อนหลัง หรือเอนจินเฉพาะอุปกรณ์ที่ใช้แทน (รวม PC2/Video.js และเอนจินเนทีฟ) ดู [ขั้นตอน เสียงที่ควรได้ยิน และแผนภาพโฮสติ้ง](docs/audio-video-check.th.md)

หน้าต่างแอปเบราว์เซอร์ที่ติดตั้งบนเดสก์ท็อปรองรับ **Window Controls Overlay**: Chrome ซ่อนแถบชื่อแยกได้ โดยคงปุ่มหน้าต่างและเมนูแอปไว้เหนือเครื่องเล่น เปิดแอปที่ติดตั้งแล้วเลือก **Hide title bar** เมื่อ Chrome เสนอให้ใช้ **Show title bar** จะคืนกรอบปกติ แท็บทั่วไปและเลย์เอาต์ TV/เนทีฟยังทำงานเหมือนเดิม ดู [การควบคุมหน้าต่างเบราว์เซอร์](docs/browser-window-controls.md) สำหรับ URL ติดตั้งที่รองรับ การอัปเดตชอร์ตคัตเดิม และการตรวจสอบ

เลื่อนวิดีโอครั้งละสิบวินาทีในหน้าวิดีโอหลักด้วย **Alt/Option + ซ้าย/ขวา** (บน macOS ใช้ **Command + ซ้าย/ขวา** ได้ด้วย) ทั้งเต็มหน้าจอและปกติ วิดีโอในเครื่อง, VOD และย้อนหลังของช่องที่รองรับใช้ปุ่มเดียวกันบนเว็บ, Tauri และ Capacitor ดู [แป้นลัดและข้อจำกัด](docs/browser-window-controls.md#playback-keyboard-shortcuts)

ในอินเทอร์เฟซ PC ปุ่ม **R** สุ่มเล่นช่องหรือวิดีโออื่นในรายการปัจจุบัน โดยไม่สลับลำดับรายการ ใช้ได้ในหน้าวิดีโอหลักและรายการช่อง/วิดีโอ ตัวแก้ไขข้อความ กล่องโต้ตอบ การตั้งค่า และข้อจำกัดคีออสก์ยังมีลำดับความสำคัญสูงกว่า การผูกปุ่มของอุปกรณ์อื่นไม่เปลี่ยน

สร้างภาพทดสอบสังเคราะห์ใหม่ได้ด้วย `scripts/generate-demo-media.sh` (ต้องมี FFmpeg) สื่อที่สร้างจะอยู่ในไดเรกทอรี `.local-artifacts` ที่ Git ไม่ติดตาม

<a id="features"></a>

## คุณสมบัติ

- **การเล่น**: สตรีม HLS, DASH และ HTTP ปกติ พร้อมเพดานคุณภาพ HLS.js/Shaka ที่จัดการได้ การกู้คืนแบบจำกัด และ URL สำรองที่ระบุชัดได้สูงสุดสามรายการต่อช่องสด ย้อนหลัง/VOD จะไม่เปลี่ยนไปใช้สตรีมสดสำรอง ดู [คุณภาพและการกู้คืน](docs/playback-stream-policy.th.md)
- **EPG**: จับคู่ XMLTV, เลื่อนเวลา/ดูย้อนหลัง, ค้นหาชื่อรายการ (N5 ใน EPG), เตือนรายการ และผูก feed/ID ด้วยตนเองกับช่องที่แน่นอนในเส้นทาง XMLTV แบบโฮสต์/เนทีฟ ดู [การผูกและการเข้าถึง](docs/guide-binding-accessibility.th.md)
- **รายการโปรด**: [คอลเลกชันแบบผสม](docs/mixed-favorites.md) หนึ่งชุดที่มีลำดับ รวมผู้ให้บริการและโปรไฟล์ที่กำหนดค่าไว้บนอุปกรณ์ที่รองรับ พร้อมการส่งออก/นำเข้าแบบพกพาผ่าน CLI และ PIN ผู้ปกครอง รายการโปรดแยกตามแหล่งยังใช้ได้ในโหมดสำรอง
- **การตั้งค่า**: ส่งออก/นำเข้า JSON ของการตั้งค่าและรายการโปรด มีบันทึกย้อนคืนสำหรับชุด localStorage ที่รองรับ เล่นย้อนหลังต่อโดยรู้แหล่งที่มา และเปรียบเทียบการตั้งค่าที่เก็บไว้อย่างตรงตัวสำหรับเวิร์กโฟลว์ตัวควบคุม การกู้คืนสมมติว่ามีผู้เขียนเพียงรายเดียว อะแดปเตอร์จัดเก็บแบบกำหนดเองยังย้อนคืนแบบพยายามดีที่สุด ดู [การกู้คืนการตั้งค่า](docs/settings-recovery.th.md)
- **อินเทอร์เฟซร่วม**: OTT Server, Tauri และ Capacitor ใช้ธีมรายการช่องและการตั้งค่าการมองเห็นเดียวกัน [สีอินเทอร์เฟซ](docs/interface-colors.md) ปรับสีได้ 9 บทบาท พร้อมจานสี การป้อนค่า HEX/RGB/HSV อย่างแม่นยำ และชุดสี 5 แบบ โดยบันทึกการตั้งค่าไว้สำหรับไคลเอนต์นั้น ส่วนการตั้งค่ารายการช่องควบคุมชื่อช่อง ไอคอน รายการปัจจุบัน ความคืบหน้า และเครื่องหมายย้อนหลัง
- **ผู้ให้บริการ**: M3U/M3U8, ทีวีสด Xtream พร้อม [แค็ตตาล็อกหนัง/ซีรีส์ตามสั่ง](docs/xtream-media.th.md), Stalker/Ministra พร้อม [หนังและตอนในโฟลเดอร์ซ้อนกัน](docs/stalker-media.md), Plex และ VPortal ความสามารถของผู้ให้บริการและสิทธิ์บัญชีเป็นตัวกำหนดฟีเจอร์ย้อนหลังและคลังสื่อที่ใช้ได้
- **คำสั่ง push**: ควบคุมระยะไกลผ่าน webhook เพื่อเปลี่ยนช่อง ผู้ให้บริการ เพลย์ลิสต์ และแสดงป๊อปอัป
- **ป้อนข้อความระยะไกล (swop)**: ใช้แป้นพิมพ์โทรศัพท์ผ่าน Cloudflare Worker เมื่อ TV/โทรศัพท์อยู่ต่างเครือข่าย (เซสชันที่การติดตั้งได้รับอนุญาต; ♥™ บน VKB)
- **เส้นทางต่ออุปกรณ์**: กำหนดปลายทางด้วย UUID สำหรับหลายอุปกรณ์
- **พร็อกซีในเครื่อง**: เซิร์ฟเวอร์คำสั่งภายในแบบเลือกใช้ สำหรับอัตโนมัติในพื้นที่ทั้งหมด (ไม่ต้องมีเซิร์ฟเวอร์กลาง)
- **เชื่อมตัวควบคุม**: ผู้ปฏิบัติการจำกัดตามอุปกรณ์/การกระทำ ผลคำสั่งแบบคงทนที่เลือกใช้ได้ การใช้พรีเซ็ต Local/Home ต่อจากเดิมได้ และส่งต่อสด/ย้อนหลังจากแหล่งเดียวกันผ่าน [เซิร์ฟเวอร์ควบคุม](https://github.com/open-ott-play/ottplay-control-server) ที่ตรงกัน ต้องใช้ตัวควบคุม/CLI ที่อัปเดตแล้ว ไม่ได้มีให้จากแท็บเบราว์เซอร์เดี่ยว
- **การตั้งค่าระยะไกลที่ระบุชนิดข้อมูล**: ค้นหาการตั้งค่า อ่านค่าที่บันทึกและค่าที่มีผล แล้วบันทึกโดยตรวจสอบอินสแตนซ์ขณะทำงาน แหล่งข้อมูล และรุ่นแก้ไข ดู [การตั้งค่าระยะไกลและการกำหนดค่า VPortal](docs/remote-player-settings.md)
- **ดีบัก**: เปิด HUD การเล่น/บันทึกวงแหวนโดยสมัครใจด้วย `?debug=1`, ตรวจระยะไกลโดยได้รับความยินยอม และทดสอบเสียง/วิดีโอที่โฮสต์ตามต้องการ
- **เข้าถึงด้วยแป้นพิมพ์**: กล่องโต้ตอบคลาสสิกมีชื่อ จำกัดและคืนโฟกัส Tab ระบุความหมายของช่องที่เลือก และประกาศสถานะอย่างไม่รบกวน การปรับปรุงนี้ไม่ได้ยืนยันการสอดคล้องกับ WCAG หรือโปรแกรมอ่านหน้าจอของอุปกรณ์อย่างสมบูรณ์
- **อุปกรณ์ 24 ชนิด**: การผูกปุ่มรีโมตแยกตามอุปกรณ์
- **อินเทอร์เฟซ 88 ภาษา**: แค็ตตาล็อกที่ตรงกัน [คู่มือเริ่มต้นแปลภาษา](docs/readme/README.md) และ [ชุดอักษรแป้นพิมพ์ตรวจด้วย CLDR](docs/localization.md) คู่มือหลักและคู่มือฟีเจอร์ที่มีฉบับคู่มีใน [เอกสาร 24 ภาษา](docs/manual-translations.md) ส่วนเอกสารวิศวกรรมอื่นคงภาษาที่มีอยู่

[คู่มือส่งมอบ](docs/roadmap-delivery.th.md) อธิบายฟีเจอร์ที่ใช้แล้วในซอร์สรุ่นนี้ ขอบเขตแพลตฟอร์ม แผนภาพ และการตรวจสอบ รุ่นที่ติดตั้งหรือโฮสต์อาจใช้ซอร์สเก่ากว่า [แอป Android](https://github.com/open-ott-play/ottplay-android) เนทีฟอิสระยังจดจำเสียง/คำบรรยายตามภาษา บทบาท และป้ายชื่อ แทนดัชนี manifest การพัฒนาและเผยแพร่แยกจาก frontend นี้

[บททบทวนซอร์สโค้ด STB](docs/stb-player-improvements.md) อธิบายการปรับปรุงด้านสื่อ การใช้ทรัพยากร และการกู้คืน พร้อมการเปรียบเทียบซอร์สโค้ดและข้อจำกัดในปัจจุบัน

<a id="debug-hud"></a>

## HUD ดีบัก

HUD ในเครื่องกับการเก็บบันทึกเซิร์ฟเวอร์ถาวรต้องเปิดอนุญาตแยกกัน ดู [สิทธิ์วินิจฉัย การปกปิดข้อมูล และการเก็บรักษา](docs/diagnostic-security.md) ก่อนเก็บบันทึกจากอุปกรณ์อื่น

เปิดโหมดดีบักด้วยวิธีใดวิธีหนึ่ง:
- URL: `?debug=1` หรือ `?debug=true`
- พื้นที่จัดเก็บในเครื่อง: `localStorage.setItem("ottplay_debug", "1")`
- คุณสมบัติ window: `window.__OTT_DEBUG__ = true`
- เซิร์ฟเวอร์: เมื่อ `/debug/config` คืน `{enabled: true}`

เมื่อเปิดดีบัก:
- กด **D** เพื่อสลับแถบ HUD บนหน้าจอ (`ottDebugSetHud` / `__ottDebug.toggleHud()`)
  - ข้ามเมื่อโฟกัสอยู่ที่ INPUT/TEXTAREA/listEdit
  - ใช้ `e.key` เพื่อเลี่ยงชนกับ MAG/Maple PLAY/PREV=68
- เมนูข้อมูล → **Debug HUD** → เรียก `__ottDebug.toggleHud()`
- จัดการการตั้งค่า → **Debug HUD**:
  - ถ้าโหลดดีบักแล้ว: สลับการแสดง HUD
  - ไม่เช่นนั้น: ตั้ง `ottplay_debug=1` + `ottplay_debug_hud=1` และขอให้เริ่มใหม่
- การคงค่า: `ottDebugSetHud` เก็บสถานะ HUD ที่ `localStorage.ottplay_debug_hud` ("1"/"0")

<a id="capacitor-ios-and-android"></a>

## Capacitor สำหรับ iOS และ Android

คลังนี้แพ็ก frontend TypeScript ร่วมด้วย Capacitor สำหรับ iOS และ Android 7+ ทั้งคู่ใช้ฟอนต์ระบบและ runtime เนทีฟที่ล็อกใน npm มี APK เข้ากันได้ API 22 แยกสำหรับ Android 5.1/6 ที่มี WebView 60 ขึ้นไป APK Android ทั้งสองลงลายเซ็นและรวมใน beta, RC และ stable ที่ผ่านเกณฑ์ พร้อม IPA iOS ที่ยังไม่ลงลายเซ็น แอป Kotlin อิสระยังอยู่ใน [ottplay-android](https://github.com/open-ott-play/ottplay-android)

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

ดู [การตั้งค่า Capacitor](docs/capacitor-mobile.md) และ [การกระจาย Android และอัปเดตระยะไกล](docs/android-distributions.md)

อินเทอร์เฟซ iOS ใช้แนวนอน การตั้งค่า ผู้ให้บริการ ความยินยอมรีโมต และนำเข้า/ส่งออก JSON ยังใช้ frontend ร่วม การทำงานหลายแอปบนแท็บเล็ตอาจแทนที่แนวหน้าจอที่ร้องขอ

บน iPhone ปัดแนวตั้งเหนือรายการช่องเพื่อเลื่อนแถวและหน้า ปัดขึ้นไปช่องถัดไป ลงไปช่องก่อนหน้า สะบัดเร็วจะเลื่อนต่อหลายหน้าแล้วชะลอจนหยุด ลากช้าจะยังแม่นยำ แตะหน้าจอหรือกดปุ่มนำทางเพื่อหยุดการเคลื่อน แตะครั้งเดียวเริ่มช่องใต้ปลายนิ้วแม้เลือกแถวอื่นอยู่ การปัดจะไม่เปิดช่องตอนยกนิ้ว

วิดีโอเล่นในหน้าเดียวบน iPhone แตะด้านล่างเพื่อดูข้อมูลรายการ หรือเปิดเมนูขณะที่ยังเล่นอยู่ Picture in Picture ยังคงเป็นตัวเลือกแยก

ทดสอบอุปกรณ์เบื้องต้น: [เช็กลิสต์ Mode B](docs/mode-b-device-smoke.md) และ `./scripts/smoke-capacitor-device.sh --help` (เป้าหมาย build/sync เฉพาะ iOS) ทดสอบ Tauri เดสก์ท็อป: [เช็กลิสต์เดสก์ท็อป](docs/mode-b-tauri-smoke.md)

<a id="installation"></a>

## การติดตั้ง

| แพลตฟอร์ม | แพ็กเกจ | หมายเหตุ |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | แยก build Apple Silicon และ Intel; ลงลายเซ็น ad-hoc เว้นแต่ตั้งการลงลายเซ็น Apple |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | หลายดิสทริบิวชัน |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode หรือ Homebrew Channel](docs/lg-webos-installation.md); เพลเยอร์บนเซิร์ฟเวอร์ ต้องเชื่อมต่อเครือข่าย |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode และการลงนามในเครื่อง; แพ็กเกจทีวีที่ยังไม่ลงนาม แยกจาก Family Hub](docs/samsung-tizen-installation.md) |
| **iOS** | `.ipa` ผ่าน AltStore / TestFlight / Xcode | ติดตั้งภายนอกเท่านั้น ยังไม่อยู่ใน App Store |
| **Android (frontend ร่วม)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | แพ็กเกจ Capacitor ลงลายเซ็น เลือกให้ตรง Android ที่รองรับ |
| **Android (Kotlin เนทีฟ)** | [แอปเนทีฟ](https://github.com/open-ott-play/ottplay-android) แยก | คลังสาธารณะ แอปและเวิร์กโฟลว์เผยแพร่แยก |

ตัวติดตั้งที่รองรับแนบกับ GitHub release ที่ผ่านเกณฑ์: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **หมายเหตุ:** แพ็กเกจแอป macOS ใช้ ad-hoc เมื่อไม่มีข้อมูลรับรอง Apple ซึ่งไม่ได้ให้ Developer ID หรือ notarization ตัวติดตั้ง Windows/Linux และแพ็กเกจ iOS อาจยังไม่ลงลายเซ็น iOS ต้องลงลายเซ็นก่อนติดตั้งบนอุปกรณ์จริง APK รุ่น Full และ API 22 ที่ผ่านเกณฑ์ใช้ใบรับรองที่ใช้อยู่แล้ว ส่วนการ build release ในเครื่องต้องกำหนด keystore จึงจะได้ APK ลงลายเซ็น

---

<a id="macos"></a>

### macOS

1. เลือกแท็กที่ต้องการจาก [Releases](https://github.com/open-ott-play/ottplay-foss/releases) ทางลัดรุ่นล่าสุดเลือก stable ไม่ใช่ beta หรือ RC
2. ดาวน์โหลด `OttPlay.FOSS_*_aarch64-apple-darwin.dmg` สำหรับ Apple Silicon หรือ `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` สำหรับ Intel เป็น build คนละสถาปัตยกรรม
3. เปิด `.dmg` แล้วลาก **OttPlay FOSS.app** ไป Applications
4. ตรวจแพ็กเกจที่คัดลอกก่อนเปิดครั้งแรก:

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

การตรวจสำเร็จยืนยันความสมบูรณ์ของแพ็กเกจ `Signature=adhoc` หมายถึงไม่มีตัวตนนักพัฒนาที่ Apple รับรอง ไม่ได้ยืนยัน notarization หรือการอนุมัติ Gatekeeper แม้ดาวน์โหลดจากแหล่งเชื่อถือได้และแพ็กเกจถูกต้อง macOS อาจยังให้เลือก **System Settings → Privacy & Security → Open Anyway** หลังลองเปิดครั้งแรก ดู [คำแนะนำ Apple](https://support.apple.com/en-us/102445)

ข้อความ “app is damaged” ไม่ได้พิสูจน์ว่าเกิดจาก quarantine อย่างเดียว ถ้าตรวจลายเซ็นไม่ผ่าน ให้เก็บข้อผิดพลาดและขอรุ่นที่แก้แล้ว อย่าลงลายเซ็นใหม่หรือลบแอตทริบิวต์ของแอปที่ดาวน์โหลดเพื่อทำให้ผลตรวจที่ล้มเหลวดูเหมือนผ่าน

ตัวเลือก ZIP คือ `OttPlay.FOSS_aarch64-apple-darwin.app.zip` และ `OttPlay.FOSS_x86_64-apple-darwin.app.zip` ดู [การลงลายเซ็น macOS และตรวจไฟล์เผยแพร่](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact) สำหรับการแตกไฟล์ ตรวจ disk image และ Gatekeeper หาก build จาก checkout และติดตั้งในเครื่อง ให้ใช้ [การส่งมอบ macOS ในเครื่อง](docs/macos-local-delivery.md)

---

<a id="windows"></a>

### Windows

1. ดาวน์โหลด `.msi` หรือ `.exe` จาก [Releases](https://github.com/open-ott-play/ottplay-foss/releases/latest)
2. เปิดตัวติดตั้งและทำตามขั้นตอน
3. เปิดจาก Start Menu หรือชอร์ตคัตเดสก์ท็อป

---

<a id="linux"></a>

### Linux

การเล่นบน Linux ต้องมีปลั๊กอิน GStreamer สำหรับ HLS, H.264 และ AAC นอกเหนือจาก WebKitGTK แพ็กเกจประกาศ dependency สื่อเหล่านี้ ส่วน AppImage รวม framework สื่อไว้ ดู [แพ็กเกจสื่อ Linux](docs/linux-media-packaging.md) สำหรับตรวจ codec และความแตกต่างระหว่างการยอมรับบนเบราว์เซอร์กับเนทีฟ

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

### ติดตั้ง iOS

iOS ต้องลงลายเซ็นก่อนติดตั้งบนอุปกรณ์จริง ใช้ AltStore Classic กับ IPA release ที่ยังไม่ลงลายเซ็น หรือ build และลงลายเซ็นจากซอร์สด้วย Xcode หากมี TestFlight ต้องใช้คำเชิญแยก

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### วิธี 1: AltStore Classic (แนะนำสำหรับใช้ส่วนตัว)

AltServer ทำงานบนคอมพิวเตอร์ ส่วน AltStore Classic ทำงานบน iPhone/iPad และนำเข้า IPA ใช้บัญชี Apple ฟรีได้

**สิ่งที่ต้องมี:**

- iPhone/iPad ที่ใช้ **iOS/iPadOS 15 ขึ้นไป** สำหรับ OTT-play build ปัจจุบัน
- Mac หรือ Windows PC ที่ติดตั้ง AltServer พร้อมสาย USB รับส่งข้อมูล
- บัญชี Apple สำหรับลงลายเซ็น และอินเทอร์เน็ตสำหรับดาวน์โหลด release

**ขั้นตอน 1: ตั้งค่า AltStore ครั้งเดียว**

1. ติดตั้ง AltServer ตามคู่มือทางการ [macOS](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) หรือ [Windows](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows) เปิดแล้วใช้ไอคอนในแถบเมนู/ถาดระบบ
2. ต่ออุปกรณ์ผ่าน USB ปลดล็อก และยอมรับคำถามเชื่อถือคอมพิวเตอร์/อุปกรณ์ บน Mac ตรวจว่าเห็นอุปกรณ์ใน Finder
3. ใน **เมนู AltServer → Install AltStore** เลือกอุปกรณ์และทำตามคำถามบัญชีลงลายเซ็น รอแจ้งเตือนติดตั้ง
4. บนอุปกรณ์ เปิด **Settings → General → VPN & Device Management** แล้วเชื่อถือรายการนักพัฒนาของบัญชีลงลายเซ็นหากถูกถาม บน iOS 16+ เปิด **Settings → Privacy & Security → Developer Mode** และทำขั้นตอนรีสตาร์ต/ยืนยัน
5. เปิด AltStore บนอุปกรณ์ หากติดตั้งและทำงานอยู่แล้ว ข้ามขั้นตอนนี้แต่เปิด AltServer ค้างไว้เพื่อนำเข้าด้านล่าง

**ขั้นตอน 2: นำเข้า release ที่เลือกบน iPhone/iPad**

1. เลือกแท็กที่แน่นอนจาก [release ทั้งหมด](https://github.com/open-ott-play/ottplay-foss/releases) แล้วดาวน์โหลด `ottplay-foss-ios-unsigned.ipa` ของรุ่นนั้นด้วย Safari บนอุปกรณ์ [ทางลัด release ล่าสุด](https://github.com/open-ott-play/ottplay-foss/releases/latest) เลือก stable ถ้าต้องการ beta ให้ใช้รายการเต็ม
2. บันทึก IPA ลง Files แล้วเลือกไฟล์ใน **AltStore → My Apps → +** หรือส่ง IPA ที่ดาวน์โหลดบน Mac ผ่าน AirDrop แล้วบันทึกใน Files ก่อนนำเข้า การเปิด IPA บน Mac ไม่ใช่ขั้นตอนนำเข้านี้
3. เปิด AltServer ค้างและต่อ USB ไว้ระหว่าง AltStore ลงลายเซ็นและติดตั้ง หากอัปเดตให้ใช้บัญชีลงลายเซ็นเดิม อย่าลบแอปเป็นขั้นตอนแรกของการแก้ปัญหา
4. รอการนำเข้าเสร็จ ตรวจ OTT-play ใน **My Apps** แล้วเปิด

**ทางเลือก: นำเข้า URL release โดยตรง**

เมื่อติดตั้ง AltStore แล้ว ป้อนรูปแบบนี้ใน **Safari บน iPhone** แทน `TAG` ด้วยแท็ก release ที่ตรง แล้วเลือก **Open in AltStore**:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

ใช้ [ตัวจัดการ URL ติดตั้ง](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift) ของ AltStore เพื่อเลี่ยงรายการ Files/Recents ที่กำกวมเมื่อหลายไฟล์ชื่อเดียวกัน URL ต้องชี้ไฟล์ IPA ไม่ใช่หน้า release

ตัวอย่างต่อไปตรวจแล้วเมื่อ **2026-09-29** ด้วย AltStore 2.3 และ AltServer 1.8.1 เป็นตัวอย่างย้อนหลังตายตัว ไม่ใช่ลิงก์รุ่นล่าสุด:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**ต่ออายุ:** แอปที่ติดตั้งด้วยบัญชีฟรีหมดอายุในเจ็ดวัน ให้เข้าถึง AltServer ได้และใช้ **AltStore → My Apps → Refresh All** ก่อนหมดอายุ การต่ออายุเบื้องหลังก็ต้องเข้าถึง AltServer ดู [คำแนะนำต่ออายุ AltStore](https://faq.altstore.io/altstore-classic/your-altstore)

<a id="verify-the-installed-version-before-retrying"></a>

#### ตรวจรุ่นที่ติดตั้งก่อนลองใหม่

ข้อความ AirDrop “Sent” ยืนยันเพียงส่งไฟล์ แถบความคืบหน้า AltStore ยืนยันเพียงเริ่มนำเข้า การหลุดของ Mirroring/USB ไม่ได้พิสูจน์ว่าติดตั้งล้มเหลว ตรวจแอปที่ติดตั้งก่อนส่ง IPA ซ้ำ

บน Mac ที่ติดตั้ง Xcode และเลือกเป็น active developer directory ให้ตรวจอุปกรณ์โดยไม่ติดตั้งซ้ำ:

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

ใน `result.apps` ของ JSON หา OTT-play (`bundleIdentifier` เริ่มด้วย `play.ott.foss`) แล้วเทียบทั้ง `version` และ `bundleVersion` กับ `CFBundleShortVersionString` และ `CFBundleVersion` ของ IPA ที่เลือก ส่วนต่อท้ายบัญชีลงลายเซ็น AltStore ใน bundle identifier เป็นเรื่องปกติ เก็บรายงานอุปกรณ์ไว้ในเครื่อง

ตัวอย่าง beta.9 ที่ตรวจแล้วรายงาน **version `1.1.51`, build `2.2.66`** สิ่งนี้ยืนยันการติดตั้ง ส่วนเปิดแอป เข้าสู่ระบบ Cloudflare โหลดเพลย์ลิสต์ เล่น และ PiP เป็นการตรวจอุปกรณ์แยกกัน

<a id="troubleshooting-ios-installation"></a>

#### แก้ปัญหาการติดตั้ง iOS

- **AltServer ไม่มีหน้าต่าง หรือเปิดด้วยอัตโนมัติแล้ว timeout:** ใช้ไอคอนแถบเมนู/ถาดระบบ เพราะเป็นแอปเบื้องหลัง การพยายามเปิดหน้าต่างปกติซ้ำไม่ได้นำเข้า IPA
- **“Could not find AltServer” หรือไม่พบอุปกรณ์ USB:** ตรวจว่า AltServer ทำงาน ปลดล็อกโทรศัพท์ และตรวจคำถามเชื่อถือ บน Mac ตรวจ Finder หากหลุด ให้ต่อใหม่เมื่อปลอดภัยแล้วตรวจรุ่นที่ติดตั้งก่อนลองซ้ำ ถ้ายังมีปัญหาใช้ [การแก้ปัญหาการเชื่อมต่อ AltStore](https://faq.altstore.io/altstore-classic/troubleshooting-guide) ถ้าโทรศัพท์ให้อินเทอร์เน็ตแก่คอมพิวเตอร์ ให้ประสานการเปลี่ยนสายหรือเครือข่ายเพื่อไม่กระทบงานอื่น
- **iPhone Mirroring แจ้ง “iPhone in Use” หรือค้าง “Connecting”:** ใช้โทรศัพท์จริงตั้งค่าให้เสร็จ หรือล็อกหน้าจอแล้ววางใกล้ Mac ที่ปลดล็อกเพื่อ mirror การปลดล็อกโทรศัพท์จะจบ Mirroring ส่วนความเชื่อถือ/ตั้งค่า USB อาจต้องปลดล็อกก่อน ถ้าต่อใหม่ครั้งหนึ่งแล้วยังค้าง ให้ปิด Mirroring และทำบนโทรศัพท์ ดู [เงื่อนไข Mirroring ของ Apple](https://support.apple.com/en-us/120421) การติดตั้งไม่จำเป็นต้องใช้ Mirroring
- **URL สูญเสียตัวอักษรละตินหรือกลายเป็นซีริลลิกใน Mirroring:** เปลี่ยน **แหล่งป้อนข้อมูล Mac เป็น ABC/English** เมื่อ Mirroring มีโฟกัส กด **Control–Space** แล้วเลือก **English (US)** สำหรับแป้นพิมพ์ฮาร์ดแวร์ iPhone แหล่งป้อนข้อมูลทั้งสองอาจต่างกัน ในการทดสอบเปลี่ยนเฉพาะ Mac ไม่พอ ล้างช่อง ป้อนใหม่ และตรวจ URL ก่อนส่ง
- **วางคลิปบอร์ดใน Mirroring แล้วค้างหรือได้ข้อความผิด:** ล้างช่องแล้วพิมพ์ช้า ๆ เป็นส่วนสั้นด้วยแหล่งป้อน English (US) ของ iPhone หรือป้อน URL บนโทรศัพท์โดยตรง การพิมพ์เร็วผ่าน Mirroring อาจตกหรือซ้ำตัวอักษร ตรวจทั้งที่อยู่ก่อนบันทึก อย่าส่ง URL ที่วางเพียงบางส่วน การวางล้มเหลวในเซสชันทดสอบของเรา และไม่ใช่ข้อจำเป็นของวิธี URL โดยตรง
- **Files/Recents แสดง IPA ชื่อเหมือนกันหลายไฟล์:** เลือกที่ดาวน์โหลดแน่นอนหรือใช้ URL พร้อมแท็กด้านบน เปลี่ยนชื่อสำเนาในเครื่องให้มีแท็ก/build เพื่อชัดเจนได้ โดยไม่เปลี่ยนเนื้อหา
- **แอปที่ติดตั้งเปิดไม่ได้:** ทำตามคำถามเชื่อถือนักพัฒนาหรือ Developer Mode ตรวจวันหมดอายุใน AltStore และต่ออายุถ้าจำเป็น หากยังล้มเหลวให้บันทึกข้อผิดพลาดจริง ข้อผิดพลาดเชื่อมต่อเพียงอย่างเดียวไม่ใช่เหตุให้ลบและติดตั้งใหม่
- **OTT-play เปิดได้แต่เพลย์ลิสต์ป้องกันโหลดไม่ได้บนเซลลูลาร์:** การติดตั้งกับการยืนยันตัวตนแหล่งข้อมูลแยกกัน ใช้ **Settings → Manage settings → Source access** เข้าสู่ระบบแหล่งที่ตั้งไว้ แล้วโหลดรายการใหม่ ยืนยันชีวมิติ/passkey หรือรหัสอีเมลบนอุปกรณ์จริงเมื่อจำเป็น แหล่งต้องรองรับ [iOS Access](docs/ios-source-access.md) การติดตั้งไม่ได้ข้าม IP allowlist
- **ถูกขอ passkey ทั้งที่อยู่ Wi-Fi ที่เชื่อถือ:** สำหรับแหล่ง iOS Access แอปลองแหล่งเดิมโดยไม่ล็อกอินก่อน และใช้ทางเข้ามือถือที่ยืนยันตัวตนเฉพาะหลังถูกปฏิเสธ ตรวจ IP สาธารณะที่แหล่งเห็นจริงรวม IPv6 การอนุญาต IPv4 บ้านไม่ครอบคลุม IPv6 อื่น, VPN หรือ IP เซลลูลาร์ การเปลี่ยนเครือข่ายและเปิดแอปใหม่ล้างเส้นทางที่จำชั่วคราว ข้อผิดพลาดเครือข่าย/เซิร์ฟเวอร์ทั่วไปไม่ควรเรียกล็อกอิน
- **ไม่ถามล็อกอินแล้วแต่รายการช่องว่าง:** เซสชันที่บันทึกและยังใช้ได้ถูกนำกลับมาใช้โดยไม่ถามใหม่ หลังการโหลดล้มเหลวหรือแก้ฝั่งเซิร์ฟเวอร์ ให้โหลดรายการใหม่หรือปิดแอปสนิทแล้วเปิดครั้งหนึ่ง หากยังผิด ตรวจว่าแหล่งคืนเพลย์ลิสต์ ไม่ใช่หน้า HTML ล็อกอินหรือ JSON error บันทึกข้อความผิดพลาดและ HTTP status อย่าแชร์ URL ที่มีข้อมูลรับรอง, cookies หรือ Access token
- **ช่องโหลดแต่ภาพ buffer หรือแจ้ง `SRC_NOT_FOUND`:** การโหลดรายการกับการเล่นวิดีโอเป็นคนละการตรวจ ลองช่องอีกครั้งหลังล็อกอิน ถ้ายังผิดให้ตรวจ HLS manifest, คำตอบ segment และ codec ของสตรีม ข้อผิดพลาดอย่างเดียวไม่ยืนยันว่าการเปลี่ยนเอนจินหรือติดตั้งใหม่ช่วยได้

<a id="option-2-testflight-if-available"></a>

#### วิธี 2: TestFlight (ถ้ามี)

หากมีคำเชิญ TestFlight ให้ติดตั้ง TestFlight จาก App Store เปิดคำเชิญบนอุปกรณ์แล้วแตะ **Install** การดาวน์โหลด IPA จาก GitHub ไม่ได้ให้คำเชิญ TestFlight

<a id="option-3-xcode-for-developers"></a>

#### วิธี 3: Xcode (สำหรับนักพัฒนา)

ทำตาม [Build and open](docs/capacitor-mobile.md#build-and-open) เลือก target **App** ใน Xcode ตั้งทีมพัฒนาที่ **Signing & Capabilities** เลือกอุปกรณ์ที่ต่อแล้ว build/run ยืนยันความเชื่อถือและ Developer Mode ตามต้องการ การนำเข้า IPA ไม่ลงลายเซ็นในหน้าต่าง Devices ไม่ได้เติม signing identity หรือ provisioning profile ที่ขาด

---

<a id="android-application"></a>

### แอป Android

เลือก Full Capacitor APK จาก release ของคลังนี้สำหรับอินเทอร์เฟซร่วม ใช้ APK เข้ากันได้ API 22 บน Android 5.1–6 ซึ่งต้องมี WebView 60 ขึ้นไป รักษาตัวตนแอปและใบรับรองลงลายเซ็นเมื่ออัปเดต เพื่อให้โปรไฟล์เดิมยังอยู่ ดู [วิธี build](android/README.md) และ [การกระจาย ลงลายเซ็น และติดตั้งระยะไกล](docs/android-distributions.md)

[คลัง ottplay-android แยก](https://github.com/open-ott-play/ottplay-android) มีแอป Kotlin/Compose เนทีฟ มีตัวตน ค่าตั้ง และเวิร์กโฟลว์เผยแพร่ของตัวเอง ไม่ได้ทับการติดตั้ง Capacitor โดยตรง ไฟล์ release เก่ายังดาวน์โหลดได้

---

<a id="quick-start"></a>

## เริ่มต้นอย่างรวดเร็ว

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

ใช้การติดตั้งของคุณเองที่เป็นซอร์สรุ่นเดียวกันเพื่อทดสอบเบราว์เซอร์

ใช้ Node 22 และ Rust toolchain รุ่น stable รันเซิร์ฟเวอร์จากรากคลังเพื่อให้เข้าถึง static assets การ build เนทีฟต้องมี toolchain แพลตฟอร์มตามด้านล่าง แต่การ build เฉพาะเซิร์ฟเวอร์ไม่ต้องใช้

เมื่อโหลดครั้งแรก เลือก **ลองเดโม** หรือเปิด **Settings → Change provider → M3U / M3U8 playlists** เปิด **Select playlist** เลือกช่องเก็บ ป้อน **Playlist URL** บันทึกแล้วเลือก **Load playlist** คุณต้องจัดหาเพลย์ลิสต์หรือบัญชีผู้ให้บริการเอง แอปไม่ได้ให้สมาชิกช่องแบบเสียเงิน

<a id="mode-a-companion-smoke"></a>

## ทดสอบ companion Mode A เบื้องต้น

ทดสอบผ่าน curl สำหรับ companion Mode A (ความเท่าเทียม `ottplay-server` / `archive/server.py`): index, static dirs, `/logo`, `/version`, `/epg` ทางเลือก และตรวจ `POST /m3u/cp.php` แบบไม่ดึงข้อมูล

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

การตรวจอยู่ใน `scripts/modea-smoke-checks.json` ไม่มี secrets ส่วน command queue / `local_proxy.py` (:8081) ตรวจแยกด้วย `scripts/smoke-command-queue.sh` ถ้ามี

<a id="classic-stalker--ministra-portals"></a>

## พอร์ทัล Stalker / Ministra คลาสสิก

เลือก **Stalker portals** ป้อน MAC ที่ผู้ให้บริการออกให้และ URL พอร์ทัลเต็ม เช่น `http://provider.example/stalker_portal/c/` URL แบบ `/c/index.html`, `/stalker_portal`, `/server/load.php`, `/load.php` และ `/portal.php` จะเลือกโปรโตคอล MAG คลาสสิก การตั้งเซิร์ฟเวอร์เปล่าที่มีอยู่ยังใช้ JSON-RPC ผู้ให้บริการโหลดโปรไฟล์ หมวด และช่องสดแบบแบ่งหน้าผ่าน Stalker core ร่วม จากนั้นค้นหาหนังและตอนในโฟลเดอร์ซ้อนกันผ่านโปรโตคอล `type=vod` แบบคลาสสิกในเบื้องหลัง เส้นทางโฟลเดอร์จะกลายเป็นหมวดในรายการช่องปกติ คำอธิบายและโปสเตอร์ที่มีให้ รวมถึงรายการโปรดส่วนกลางที่มีตัวระบุคงที่ ใช้อินเทอร์เฟซสื่อเดียวกัน ดู [การทำงานและขอบเขตของแค็ตตาล็อก](docs/stalker-media.md)

คำขอเบราว์เซอร์ของระบบที่โฮสต์เองผ่าน `/stalker/api` ของ companion ส่วนแอปเนทีฟใช้ HTTP transport เดิม เบราว์เซอร์ของระบบที่ใช้บริการโฮสต์ต้องกำหนดเส้นทางผ่าน [รีเลย์เฉพาะ](docs/stalker-relay.md) อย่างชัดเจน ต้องอัปเดต assets เบราว์เซอร์กับเซิร์ฟเวอร์พร้อมกัน

การเล่นสดแก้คำสั่งช่องชั่วคราวเมื่อเปิดสตรีม การเปลี่ยนช่อง หยุด PiP และเปลี่ยนผู้ให้บริการจะยกเลิกการแก้คำสั่งที่ล้าสมัย คำสั่ง HTTP(S) ที่ระบุชัดว่าไม่ชั่วคราวเล่นโดยตรง รองรับ EPG สั้น ผู้ให้บริการนี้ไม่เปิดย้อนหลังของพอร์ทัลคลาสสิกหรือรูปแบบโปรโตคอล `type=series` ที่แยกต่างหาก พฤติกรรมย้อนหลัง/ไกด์ JSON-RPC เดิมไม่เปลี่ยน พอร์ทัล LAN ส่วนตัวที่ใช้เส้นทาง companion ต้องมีรายการ `OTTPLAY_PROXY_LAN_ORIGINS` ตรงตัวเหมือนเส้นทางพร็อกซี companion อื่น

เดโมสาธารณะ Infomir คือ `http://middleware-stalker.com/stalker_portal/c/` เมื่อ 2026-09-26 คืนรายการช่องสดสามรายการ แต่ endpoint สื่อใช้ไม่ได้ ให้ใช้พอร์ทัล/สื่อทดสอบที่ควบคุมได้สำหรับทดสอบการถดถอย

<a id="m3u-stream-proxy-header-smoke"></a>

## ทดสอบ header พร็อกซีสตรีม M3U

เปรียบเทียบ header คำขอ upstream ที่ `POST /m3u/cp.php` ของ companion Mode A ใส่เมื่อเรียก echo URL ที่ควบคุมได้ (ค่าเริ่มต้น mock ในเครื่อง ไม่มีผู้ให้บริการ IPTV หรือ secrets)

ข้อกำหนด (จาก `src-rs/core/src/m3u.rs` + `archive/server.py`):
- ใส่ **User-Agent** เท่านั้น (ค่าเริ่มต้น `OTT-play-FOSS/1.0` หรือ preset `webos` / `tizen` / `viera` / `mag` / `dune`)
- **ไม่**ใส่ **Referer** (`M3UProxy` ของ Capacitor ใส่ แต่ Mode A ไม่ใส่)
- ตัด `@` ที่นำหน้า `url` (รูปแบบ jQuery ของผู้ให้บริการ)

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

รหัสออก: `0` ผ่าน, `1` ไม่ได้ฟังการเชื่อมต่อ, `2` header/HTTP ไม่ตรง, `3` วิธีใช้/dependency เป็นชุดเดียวกับ `smoke-modea-companion.sh` / `smoke-command-queue.sh`

<a id="logo-concurrent-bench-smoke"></a>

## ทดสอบความหน่วงโลโก้พร้อมกัน

ทดสอบความหน่วง `GET /logo/<id>.svg` พร้อมกัน (เลือก `?ch=` ได้) กับ companion Mode A รายงานจำนวนสำเร็จ/ล้มเหลวและ p50/p95/p99 ค่าเริ่มต้นเป็นโหลดใช้งานจริงใน CI ภายใน (`CONCURRENCY=200`, `TOTAL=1000`) ทดสอบเต็ม 10k เลือกได้ด้วย `--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`

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

รหัสออก: `0` ผ่าน, `1` ไม่ได้ฟัง/เชื่อมต่อล้มเหลว, `2` อัตราผิดพลาดสูง, `3` วิธีใช้ เป็นชุดเดียวกับ `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## ทดสอบ refresh / warm-up แคช XMLTV

ตรวจพฤติกรรมแคช XMLTV/EPG ของ companion Mode A ตาม `src-rs` จริง โดยไม่สมมติ API:

- `EPG_CACHE` ในหน่วยความจำให้ผ่าน `GET /epg/:hash` → เป็น `{"epg_data":[...]}` เสมอ (HTTP 200)
- เมื่อเริ่ม process จะดึง `EPG_URLS` เบื้องหลังไม่หน่วง HTTP startup หลังดึงเสร็จแต่ละครั้งจะรอ **2h** ก่อน refresh ถัดไป
- เลือกเก็บถาวร SQLite เมื่อกำหนด `DATABASE_URL` (ไม่มี public cache-status endpoint)
- `GET /health` → `OK` ยืนยัน HTTP พร้อมหลัง restart ทางเลือก เมื่อใช้ `--strict-epg` และ `--epg-hash` ยังรอ EPG ที่ไม่ว่างของช่องนั้นในงบ `--warmup-timeout` เดียวกัน

ค่าเริ่มต้นใช้ curl เท่านั้น **ไม่ kill process** ระบุ `--restart-cmd` / `RESTART_CMD` ถ้าต้องการ kill+restart อัตโนมัติ หรือทำขั้นตอน `launchctl` ด้วยมือใน `--help`

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

รหัสออก: `0` ผ่าน, `1` ไม่ได้ฟัง, `2` assertion/warm-up ล้มเหลว, `3` วิธีใช้ เป็นชุดเดียวกับ `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`

<a id="mode-a-e2e-play-path-smoke"></a>

## ทดสอบเส้นทางเล่น E2E ของ Mode A

ทดสอบ **เส้นทางเล่น/ความพร้อมสตรีม** ฝั่ง companion (HTTP เท่านั้น **ไม่ใช่** UI E2E ที่เปิดหน้าต่าง) เมื่อ companion Mode A ทำงาน จะตรวจ:

- เข้าถึง health หรือ index ได้
- static assets ของ player shell (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`)
- `GET /epg/<hash>.json` ทางเลือกเมื่อกำหนด `EPG_HASH`
- `POST /m3u/match-channels` ด้วย JSON ทดสอบไม่มี secrets (รายการว่าง + ช่องสังเคราะห์หนึ่งช่อง)
- **การเล่น** ผ่าน stream proxy: `POST /m3u/cp.php` ไปสื่อทดสอบที่ควบคุมได้ (ค่าเริ่มต้นเพลย์ลิสต์ HLS ในเครื่อง หรือ `MEDIA_URL`) แล้วตรวจ HTTP 200 + body ไม่ว่าง / `Content-Type` ที่คาด (ไบต์แรกที่ผ่านพร็อกซี)

ไม่มีข้อมูลรับรอง IPTV ส่วนตัว เป็นชุดเดียวกับ `smoke-modea-companion.sh` (การมีอยู่), `smoke-m3u-stream-proxy-headers.sh` (UA/Referer), `smoke-xmltv-cache-refresh.sh`

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

รหัสออก: `0` ผ่าน, `1` ไม่ได้ฟัง, `2` assertion ล้มเหลว, `3` วิธีใช้/dependency

<a id="capacitor-device-smoke-mode-b"></a>

## ทดสอบอุปกรณ์ Capacitor (Mode B)

**เช็กลิสต์** simulator/emulator (เลือกอุปกรณ์จริงได้) สำหรับ Mode B Cap ไม่ใช่ HTTP companion Mode A คนเป็นผู้ระบุว่า UI ผ่าน ส่วน helper ตรวจ toolchain / native dirs / curl command queue แบบอ่อนโดยอัตโนมัติ

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

รายละเอียด: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md) เป็นชุดเดียวกับ `smoke-command-queue.sh` (Cap loopback) อย่าสับสนกับ Mode A ด้านบน

<a id="tauri-desktop-smoke-mode-b"></a>

## ทดสอบ Tauri เดสก์ท็อป (Mode B)

เช็กลิสต์และ helper สำหรับ Mode B Tauri (หน้าต่าง/เล่นช่อง/PiP) ไม่ใช่ HTTP companion Mode A หรือการทดสอบอุปกรณ์ Cap

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

รายละเอียด: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md) ข้อมูลนักพัฒนา Apple เป็นทางเลือกในการทดสอบในเครื่อง ใช้ [ad-hoc signing](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials) สำหรับแอป Mac ที่แพ็กแล้ว คนยังต้องตรวจการเปิด เล่น และ PiP

<a id="docker"></a>

## Docker

อิมเมจหลายสถาปัตยกรรม (amd64/arm64) build เป็น candidate OCI archive การเผยแพร่ registry นำ archive stable ที่อนุมัติไป Docker Hub โดยไม่ build ซ้ำ ดู [คู่มือปฏิบัติการ](docs/release-workflow.md)

ไบนารีเซิร์ฟเวอร์ build บน **musl** (Alpine) และแจกบน Alpine จึง **ไม่ต้องใช้** GLIBC_2.38+ ทำให้ `alvit/ottplay-foss` รันบน Synology DSM Docker (x86_64) และโฮสต์ glibc เก่าอื่นได้

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

แท็ก stable ใน registry ใช้ `X.Y.Z` การอัปเดต `latest` เป็นตัวเลือกแยกที่ต้องระบุหลังเผยแพร่อิมเมจเวอร์ชันแล้ว การ push main และ Git tag ไม่เผยแพร่อิมเมจ

<a id="build-from-source"></a>

## Build จากซอร์ส

กฎโดเมนเครื่องเล่นมาจาก Kotlin multiplatform artifact ที่ปักรุ่นใน `vendor/ottplay-core.js` การตัดสินใจเรื่องไกด์ ย้อนหลัง เพลย์ลิสต์ ผู้ให้บริการ สถานะถาวร และการเล่น ใช้ implementation ร่วมกับ FOSS2 และ Android เนทีฟ อะแดปเตอร์ browser/TV, Swift และ Rust ยังดูแล device API, codec, เครือข่ายและผลต่อ UI artifact เบราว์เซอร์คงไวยากรณ์ ES5 และ bootstrap API เก่าที่รองรับ `npm test`, `check:bundle` และ `check:es5` ตรวจการเชื่อมต่อ manifest บันทึก hash ซอร์สและผลลัพธ์

ตัวตรวจโปรโตคอล control-server และ SWOP สร้างจาก schema มีเวอร์ชัน `contracts/ottplay-wire-v1.json` ใบรับรองการสร้างที่ตรวจแล้วและ fixture ความเข้ากันได้ที่เปลี่ยนไม่ได้ป้องกันการคัดลอกนโยบายเฉพาะ consumer

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

## ตรวจชนิดอุปกรณ์

เครื่องเล่นรองรับอุปกรณ์ 24 ชนิด ตรวจจาก URL `/f/{device_id}/` ก่อน แล้วจึง User-Agent

| Device ID | อุปกรณ์ |
|---|---|
| `pc` | เบราว์เซอร์ PC |
| `pc2` | เครื่องเล่นเว็บ videojs |
| `nodejs` | แอป Windows (Electron) |
| `lg/webos` | LG WebOS TV |
| `samsung/tizen` | Samsung Tizen TV |
| `samsung/maple` | Samsung Orsay TV |
| `mag` | กล่อง Infomir MAG |
| `dune` | กล่อง Dune HD |
| `android` | Android TV / แท็บเล็ต |
| `hbbtv` | HbbTV TV |
| `panasonic` | Panasonic Viera TV |
| `philips` | Philips TV |
| `sony` | Sony TV |
| `sharp` | Sharp TV |
| `toshiba` | Toshiba TV |
| `hisense` | Hisense TV |
| `skyworth` | Skyworth TV |
| `tcl` | TCL TV |
| `vewd` | อุปกรณ์ Vewd |
| `spark` | เครื่องรับ Spark |

<a id="push-command-system"></a>

## ระบบคำสั่ง push

สำหรับบริการหลายอุปกรณ์แยก ใช้ [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) และส่วน **Command server** ใน **Settings → Remote control** ป้อน IP/ที่อยู่และรหัสเข้าถึงของเครื่องเล่นนี้ การบันทึกทั้งคู่เริ่ม polling สำหรับเสียง ช่อง และคำสั่งอื่นโดยอัตโนมัติ IP ไม่ระบุพอร์ตใช้ HTTP 8081 ล้างที่อยู่หรือเลือก **Disconnect** เพื่อหยุด การเชื่อมต่อขาออกนี้รองรับยืนยันการส่งและไม่ต้องใช้ listener ในเครื่อง ดู [การเชื่อมต่อและความเข้ากันได้](docs/remote-command-server.md) ตัวอย่างด้านล่างอธิบายโหมด local-proxy/listener ที่มีอยู่

**ค้นหาเซิร์ฟเวอร์คำสั่ง** สามารถค้นหาคอนโทรลเลอร์และขอการอนุมัติจากผู้ดูแลโดยไม่ต้องคัดลอกโทเค็นของอุปกรณ์ Tauri ตรวจสอบ DNS แบบเนทีฟก่อน และหากผลลัพธ์ว่างก็สามารถใช้โปรไฟล์การติดตั้งที่กำหนดไว้อย่างชัดเจนแทนได้ ส่วนเครื่องเล่นบนเบราว์เซอร์, LG และ Capacitor ใช้เส้นทางโปรไฟล์ของเบราว์เซอร์ สามารถโฮสต์เมทาดาทาการค้นหา Home บน here.now แยกจากคอนโทรลเลอร์ได้ บิลด์ทั่วไปไม่ได้รวมโปรไฟล์ Home นี้โดยอัตโนมัติ และการอัปเดตไม่แทนที่การเชื่อมต่อที่บันทึกไว้ ดู [พฤติกรรมของแต่ละแพลตฟอร์ม การตั้งค่าโปรไฟล์ และการแก้ปัญหา](docs/remote-command-server.md#discovery-and-one-time-approval)

HTTP remote control ในเครื่อง **ปิดโดยค่าเริ่มต้น** ใน browser/OTT server player, Tauri และ Capacitor เปิดที่ **Player settings → Remote control** เพื่อสร้างรหัสอุปกรณ์ลับ คำสั่งเป็น JSON object มีฟิลด์ `"command"` และ HTTP ต้องมี `Authorization: Bearer <device-code>`

<a id="architecture"></a>

### สถาปัตยกรรม

<a id="local-command-url-recommended"></a>

#### Local Command URL (แนะนำ)

เปิด **Local HTTP remote control** ใน **Player settings → Remote control** คัดลอก **Device code** ที่สร้าง แล้วตั้งพร็อกซีด้านล่างด้วยรหัสนั้น ตั้ง **Local command URL** เป็น command endpoint ของพร็อกซี เมื่อเปิดอยู่ เครื่องเล่น poll URL ทุก 10 วินาทีด้วยรหัสใน Authorization header การตั้ง URL อย่างเดียวไม่ได้เปิดการควบคุม

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### UUID อุปกรณ์

Device UUID เดิม (เช่น `dev_a1b2c3d4e5`) เป็นข้อมูลเส้นทางสาธารณะ ไม่ใช่ข้อมูลยืนยันสิทธิ์ **Device code** แยกถูกสร้างอย่างปลอดภัยเมื่อเปิด local HTTP control และอยู่บนอุปกรณ์นี้ ไม่คัดลอกผ่านการตั้งค่าคลาวด์ การปิด local HTTP control หยุด polling/listener เมื่อเปิดใหม่จะสร้างรหัสใหม่ ให้อัปเดตพร็อกซีและ integration เพื่อเพิกถอนรหัสเดิม

Tauri และ Capacitor เริ่ม HTTP listener บน loopback หลังผู้ใช้ยินยอมในการตั้งค่านี้เท่านั้น พร็อกซีที่ส่งต่อจะต้องส่ง Device code ที่แสดงเป็น Bearer token ไป listener ส่วน Mode A ใช้คิว `local_proxy.py` ที่ตั้งแยกตามด้านล่าง

<a id="remote-text-entry-swop"></a>

#### ป้อนข้อความระยะไกล (swop)

จุดประสงค์คือพิมพ์บนโทรศัพท์สำหรับ ♥™ / แป้นพิมพ์เสมือนระยะไกล เมื่อ TV และโทรศัพท์อยู่ **คนละเครือข่าย** โดยส่งต่อเซสชันผ่าน Cloudflare Worker

- คลัง Worker: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop)
- **สิทธิ์การติดตั้ง:** เครื่องเล่นส่งคำขอไป relay `/swop` ใน origin เดียวกับเซิร์ฟเวอร์ เซิร์ฟเวอร์เพิ่ม installation token ส่วนตัว ทุกไคลเอนต์บน origin เซิร์ฟเวอร์ที่ลงทะเบียนใช้ป้อนข้อความระยะไกลได้ UUID อุปกรณ์ระบุเซสชัน ไม่ต้องมี allowlist รายอุปกรณ์
- การตั้งค่า: `swopBaseUrl` (ว่าง = ♥™ แสดง “not configured” / ไม่ทำงาน) แก้ใน **Settings → Remote control** (ปุ่ม **2**) หรือใส่ผ่าน `/local/swop.json` ที่ gitignore ในการติดตั้งของผู้ดูแล
- `POST /session` มี `clientId`, `caption` และ `draft`; `POST /val` มี `clientId`, `code` และ `sessionToken` ที่ได้กลับ URL โทรศัพท์มี write token แยก ส่วน read token ของเซสชันเก็บในหน่วยความจำเบราว์เซอร์
- **ติดตั้งในเครื่อง:** ตั้ง `SWOP_BASE_URL` และ `SWOP_INSTALLATION_TOKEN` หลังลงทะเบียนการติดตั้งพร้อม LAN/localhost origins ตรงตัวใน Worker `scripts/install-ottplay-local-service.sh` รักษาค่าใน launchd plist ส่วนตัว mode-0600 ส่วน `/local/swop.json` สาธารณะมีเพียง `{"swopBaseUrl":"/swop"}` อย่าใส่ installation token ใน public assets
- **Static hosting:** ตั้งพร็อกซีฝั่งเซิร์ฟเวอร์ที่ยืนยันตัวตนสำหรับสอง endpoint เดียวกัน เก็บ token ใน secrets ของโฮสติ้ง การคัดลอกไฟล์สาธารณะของเครื่องเล่นไม่คัดลอกข้อมูลรับรองเซิร์ฟเวอร์นี้

> OTT server กลางปิด `/api/webhook/commands`, `/webhook/poll`, `/webhook/notify` และ alias ตรวจสุขภาพคำสั่งในทุก HTTP method ใช้ command server แยก หรือ `local_proxy.py` ที่ยืนยันตัวตนและตั้งชัดเจนสำหรับ Mode A เซิร์ฟเวอร์กลางไม่มีคิว broadcast command

<a id="available-commands"></a>

### คำสั่งที่มี

ทุกตัวอย่างใช้ `http://192.168.1.50:8081/api/webhook/commands` เป็น URL พร็อกซีในเครื่อง เปลี่ยนเป็นที่อยู่จริงและตั้ง `OTTPLAY_QUEUE_HTTP_TOKEN` เป็น **Device code** ที่แสดงหลังเปิด HTTP control ในเครื่องเล่น พร็อกซีต้องตั้งรหัสเดียวกัน

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — แสดงป๊อปอัปแจ้งเตือน

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| ฟิลด์ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `message` | string | จำเป็น | ข้อความที่แสดง |
| `popup_duration` | number | 5 | วินาทีที่แสดง (มุมขวาบน) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — เปลี่ยนช่องตามตำแหน่งรายการ

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| ฟิลด์ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `channel_number` | number | จำเป็น | ตำแหน่งช่องในรายการ เริ่มที่ 1 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — เปลี่ยนช่องด้วยชื่อ (บางส่วน)

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

ค้นหาข้อความย่อยโดยไม่สนตัวพิมพ์ใหญ่เล็ก เลือกรายการแรกที่ตรง

| ฟิลด์ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `channel_name` | string | จำเป็น | ชื่อช่องหรือบางส่วนของชื่อ |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — สุ่มเปลี่ยนช่อง

คำสั่งแบบเดิมนี้เลือกช่องที่เข้าเกณฑ์จากรายการหรือหมวดหมู่ปัจจุบัน หมายเลขช่องและช่วงหมายถึงตำแหน่งในรายการนั้น ดู [กฎการสุ่มเลือกอย่างปลอดภัย](docs/remote-command-server.md#safe-random-playback)

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

| ฟิลด์ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `random_range` | [start, end] | รายการปัจจุบัน | ช่วงเริ่มนับจาก 1 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — เปลี่ยนผู้ให้บริการ IPTV

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| ฟิลด์ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `provider` | number | จำเป็น | ดัชนีในอาร์เรย์ผู้ให้บริการ (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — โหลดเพลย์ลิสต์ M3U ใหม่

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| ฟิลด์ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `playlist` | string | จำเป็น | URL เพลย์ลิสต์ M3U |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — อัปเดตการตั้งค่าผู้ให้บริการ

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| ฟิลด์ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `provider_settings` | string | จำเป็น | JSON string ที่มีการตั้งค่าผู้ให้บริการ |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — ตั้งหรือปรับระดับเสียง

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

ละเว้นเงียบ ๆ บนไคลเอนต์ที่ไม่รองรับควบคุมระดับเสียง

| ฟิลด์ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `volume` | number | — | ระดับเสียงสัมบูรณ์ 0-100 |
| `volume_step` | number | — | เปลี่ยนแบบสัมพัทธ์ เช่น +10 หรือ -5 |

<a id="player-standby-restart-and-exit"></a>

#### สแตนด์บาย รีสตาร์ต และออกจากเครื่องเล่น

คิว webhook ที่ไม่ยืนยันรับของพร็อกซีในเครื่องไม่รองรับ `exit_player` หรือคำขอ standby/wake แบบมีชนิด เชื่อมเครื่องเล่นกับ [command server](docs/remote-command-server.md) แล้วใช้ CLI:

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

แทน `d1` ด้วย alias เครื่องเล่นที่ลงทะเบียน `stop` เป็น alias ของ `standby`; `start` และ `wake` เป็น alias ของ `go` การใช้ Go ต้องมีเครื่องเล่นทำงานและเชื่อมต่ออยู่ ไม่สามารถเปิดแอปที่ปิดหรือปลุกอุปกรณ์ออฟไลน์ เบราว์เซอร์หรือ TV ที่ออกแอปแบบเนทีฟไม่ได้จะแจ้งว่าไม่รองรับ exit สแตนด์บายยัง polling ระยะไกล และไม่พักงานอื่นของโฮสต์หรือเซิร์ฟเวอร์ร่วม

หลัง standby/go ตรวจ `ott d1 status` เพื่อดู standby/background และตรวจการเล่นต่อแยกต่างหาก หลัง reload เครื่องเล่นให้ยืนยัน runtime ใหม่ด้วย `ott d1 doctor` หลัง exit ให้ตรวจผ่าน OS ว่า process ปิดจริง timeout ระยะไกลไม่ได้ยืนยันการออก การยอมรับคำสั่งอย่างเดียวไม่ยืนยันผลเหล่านี้

<a id="local-proxy-server"></a>

## เซิร์ฟเวอร์พร็อกซีในเครื่อง

`local_proxy.py` เป็นคิวคำสั่งยืนยันตัวตนแบบอิสระสำหรับหนึ่งเครื่องเล่น การเรียกค่าเริ่มต้นจะจบโดยไม่เปิดพอร์ต แต่ละ instance ใช้รหัสที่เครื่องเล่นสร้าง ถ้ามีหลายเครื่องให้แยก instance/port พารามิเตอร์ query `device_id` รับเป็น metadata เพื่อความเข้ากันได้เท่านั้น ไม่ยืนยันตัวตนหรือเลือกอุปกรณ์อื่น

<a id="start-the-proxy"></a>

### เริ่มพร็อกซี

1. เปิด **Local HTTP remote control** ในเครื่องเล่นแล้วคัดลอก **Device code**
2. บนโฮสต์พร็อกซี ตั้งรหัสและ origin ที่ให้บริการเครื่องเล่นอย่างตรงตัว (scheme, host และ port ไม่มี path):

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. ตั้ง **Local command URL** ของเครื่องเล่นเป็น `http://192.168.1.50:8081/api/webhook/commands`

bind address เริ่มต้นคือ `127.0.0.1` ตัวอย่างเปิด LAN โดยชัดเจน `OTTPLAY_QUEUE_HTTP_ORIGINS` เป็น allowlist origin เบราว์เซอร์ตรงตัว คั่นด้วยจุลภาค ถ้าให้บริการเครื่องเล่นด้วย HTTPS ให้ใช้ HTTPS reverse proxy เพื่อให้กฎ mixed-content อนุญาต polling เก็บรหัสลับและอย่าใส่ใน URL เมื่อเครื่องเล่นสร้างรหัสใหม่ให้รีสตาร์ตพร็อกซีด้วยค่าใหม่ การปิดเครื่องเล่นอย่างเดียวไม่หยุด process พร็อกซีที่จัดการแยก

<a id="endpoints"></a>

### Endpoint

| Method | Path | คำอธิบาย |
|---|---|---|
| `POST` | `/api/webhook/commands` | เพิ่มคำสั่งในคิว |
| `GET` | `/api/webhook/commands` | รับคำสั่งที่ค้าง (เครื่องเล่น poll) |
| `POST` | `/webhook/notify` | alias ที่ยืนยันตัวตนเพื่อความเข้ากันได้ |
| `GET` | `/webhook/poll` | alias ที่ยืนยันตัวตนเพื่อความเข้ากันได้ |

ทั้งส่งและดึงคิวต้องใช้ Bearer device code ตรงกัน ไม่มี endpoint broadcast ที่ไม่ยืนยันตัวตน คำสั่งหมดอายุหลัง 60 วินาที แต่ละพร็อกซีเก็บไม่เกิน 50 คำสั่ง

พร็อกซีรับพร้อมกันได้ 16 การเชื่อมต่อ ทำให้การเชื่อมต่อเบราว์เซอร์ว่างหรือคำขอไม่ครบไม่หน่วงคำสั่งอื่น ทุก socket มี inactivity timeout ห้าวินาที เมื่อ worker เต็มจะปิดการเชื่อมต่อเพิ่ม การใส่และดึงคิวเป็น atomic ระหว่าง worker

<a id="smoke-script-all-modes"></a>

### สคริปต์ทดสอบเบื้องต้น (ทุกโหมด)

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Android emulator/device: ทำ `adb forward tcp:18081 tcp:18081` ก่อน Cap/Tauri เป็น loopback-only ใช้พร็อกซี Mode A นี้สำหรับ Home Assistant บน LAN รายละเอียดอยู่ส่วน Smoke test ใน `docs/capacitor-mobile.md`

<a id="cors"></a>

### CORS

พร็อกซีอนุญาตเบราว์เซอร์จาก `OTTPLAY_QUEUE_HTTP_ORIGINS` เท่านั้น คำขอ preflight `OPTIONS` จาก origin ที่อนุญาตไม่ต้องมี token แต่ GET/POST จริงทุกคำขอต้องมี Bearer device code ไม่รับ wildcard และ `null` origin Home Assistant และ caller ที่ไม่ใช่เบราว์เซอร์ละ Origin ได้ แต่ยังต้องยืนยันตัวตน

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### ตัวอย่าง: Home Assistant webhook → พร็อกซีในเครื่อง → เครื่องเล่น

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

### ตัวอย่าง Home Assistant automation

ตัวอย่างป๊อปอัป ช่อง และเสียง ใช้พร็อกซีในเครื่อง ตั้ง `ottplay_device_authorization` ใน `secrets.yaml` ของ Home Assistant เป็น `Bearer <device-code>` โดยใช้รหัสที่เครื่องเล่นแสดงหลังเปิดใช้

สแตนด์บายกลางคืนใช้ [command server](docs/remote-command-server.md) แยก แทน URL ตัวอย่างและ `DEVICE_UUID` ด้วยที่อยู่ controller และ device ID ที่ลงทะเบียน alias CLI ในเครื่อง `d1` ไม่ใช่ device ID ตั้ง `ottplay_control_authorization` เป็น `Bearer <controller-admin-token>` ใน `secrets.yaml` ข้อมูลรับรองนี้แยกจาก Device code ของพร็อกซี ดูเอกสาร Home Assistant เรื่อง [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) และ [secrets](https://www.home-assistant.io/docs/configuration/secrets/)

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

`standby_request` มี HTTP response สำหรับ trace ของ automation HTTP 202 หมายถึงเข้าคิวแล้วเท่านั้น เก็บ `content.id` แล้ว poll `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` ด้วยข้อมูลรับรอง controller เดิมเพื่อรับคำตอบเครื่องเล่น คำขอ `status` ใหม่ดู `player.standby` และ `player.background` สแตนด์บายเปิดพร้อม `suspended` และ pending เป็นศูนย์ยืนยันว่างานที่เครื่องเล่นติดตามจบแล้ว ออกจากสแตนด์บายด้วยคำขอชนิดเดิมและ `"operation":"wake"` (`ott d1 go`) อย่าส่งคำสั่งเปลี่ยนสถานะซ้ำโดยไม่ตรวจหลัง timeout ดู [request/response API](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) และ [ความหมายของสแตนด์บาย](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake)

<a id="server-api-reference"></a>

## อ้างอิง Server API

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Webhook endpoint (Rust `ottplay-server`)

เซิร์ฟเวอร์ Rust และ Python fallback ที่เก็บเป็น archive ปฏิเสธ endpoint คำสั่งด้วย HTTP 403 `/api/webhook/commands`, `/webhook/notify`, `/webhook/poll` และ command health alias ไม่เข้าคิว ไม่ broadcast และไม่ดึงคิว API feedback ทั่วไปแทนที่ route สงวนเหล่านี้ไม่ได้ การส่งคำสั่ง Mode A ใช้ command server ที่ตั้งแยกหรือพร็อกซีในเครื่องที่ยืนยันตัวตนตามข้างบน

<a id="other-endpoints"></a>

### Endpoint อื่น

| Method | Path | คำอธิบาย |
|---|---|---|
| `GET` | `/epg/<hash>.json` | ข้อมูล EPG ของช่อง |
| `GET` | `/logo/<id>.svg` | โลโก้ช่องที่สร้างขึ้น |
| `GET` | `/version/<path>` | hash เวอร์ชันไฟล์ |
| `POST` | `/m3u/match-channels` | จับคู่ช่องกับ EPG |
| `POST` | `/m3u/match-logos` | จับคู่โลโก้ช่อง |
| `POST` | `/m3u/cp.php` | พร็อกซีสตรีม |
| `GET/POST` | `/feedback/` | บันทึก feedback |
| `GET` | `/tmdb/*` | พร็อกซี TMDb API |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## โครงสร้างโครงการ

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

## การผูกปุ่ม STB

- **Samsung Tizen**: `RETURN=10009`, `ENTER=13`, สี 403-406
- **Samsung Maple**: dpad 4/5/6/8, รหัส SDK เดิม
- **LG WebOS**: `RETURN=461`, สีเข้ากันได้กับ HbbTV
- **LG NetCast**: `RETURN=8`, รหัส HbbTV
- **MAG**: `RETURN=8`, gSTB API สำหรับ MAC
- **Dune HD**: รหัสมาตรฐาน, Dune API
- **Android TV**: Android keycodes (`BACK=4`, `DPAD_*` 19-22, `ENTER=66`)
- **HbbTV/Panasonic/Philips/Sony/อื่น ๆ**: รหัส HbbTV (`RED=403`, `BLUE=406`, `VOL_UP=447`)

<a id="documentation"></a>

## เอกสาร

- [วิกิเอกสาร](./docs/wiki/Home.th.md) / [Вики по-русски](./docs/wiki/Home.ru.md) — นำทางตามงานและกฎบำรุงรักษา
- [รายงาน implementation](./docs/implementation-report.th.md) / [Процесс и результат](./docs/implementation-report.ru.md) — แผนภาพสี พฤติกรรมที่ตรวจแล้ว ต้นทุนที่วัด และเกณฑ์เผยแพร่
- [คู่มือส่งมอบ](./docs/roadmap-delivery.th.md) / [Руководство по новым возможностям](./docs/roadmap-delivery.ru.md) — คุณสมบัติ ข้อจำกัด และการตรวจสอบ
- [เริ่มต้นใน 88 ภาษาอินเทอร์เฟซ](./docs/readme/README.md) — สร้างจากคำแปล UI ที่แจก คู่มือหลักและคู่มือฟีเจอร์แบบคู่มีใน [24 ภาษาเอกสาร](docs/manual-translations.md)
- [ขีดจำกัดคุณภาพและการกู้คืนสด](./docs/playback-stream-policy.th.md) / [По-русски](./docs/playback-stream-policy.ru.md)
- [จับคู่ XMLTV ด้วยมือและการเข้าถึงคลาสสิก](./docs/guide-binding-accessibility.th.md) / [По-русски](./docs/guide-binding-accessibility.ru.md)
- [ทดสอบเสียง/วิดีโอบนโฮสต์](./docs/audio-video-check.th.md) / [По-русски](./docs/audio-video-check.ru.md)
- [คลังสื่อ Xtream](./docs/xtream-media.th.md) / [По-русски](./docs/xtream-media.ru.md)
- [ส่งต่ออุปกรณ์จากแหล่งเดียวกัน](./docs/remote-handoff.th.md) / [По-русски](./docs/remote-handoff.ru.md)
- [การตั้งค่าในเครื่องที่กู้คืนได้](./docs/settings-recovery.th.md) / [По-русски](./docs/settings-recovery.ru.md)
- [รุ่นเบราว์เซอร์ OS และตรวจ release candidate ตรงรุ่น](docs/browser-compatibility.th.md) / [По-русски](docs/browser-compatibility.ru.md)

- [สถาปัตยกรรมเครื่องเล่น](./docs/architecture.md) — ผู้รับผิดชอบ runtime การเชื่อมผู้ให้บริการ การเล่น ไกด์ device adapter และข้อกำหนด build
- [pipeline build ES5 คลาสสิก](./docs/build-pipeline.md) — คอมไพล์ ตรวจความเข้ากันได้ และขีดจำกัดขนาด artifact
- [ชื่อ runtime assets และการย้าย deployment](./docs/asset-layout.md) — path สื่อความหมายที่เว็บและแพ็กเกจเนทีฟใช้ร่วมกัน
- [โต๊ะทำงานระยะไกล](./docs/remote-workbench.md) — ตรวจ UI/สื่อ ใบรับการทำงาน และหลักฐานที่เก็บไว้
- [วินิจฉัย runtime](./docs/runtime-debug.md) — ประวัติ error ตัวนับ frame/loop เมตริกเนทีฟ Capacitor/Tauri และดีบักเซิร์ฟเวอร์
- [ส่งมอบ macOS ในเครื่อง](./docs/macos-local-delivery.md) — build จาก checkout ติดตั้งในเครื่อง และตรวจสอบ

<a id="license"></a>

## ใบอนุญาต

[MIT](LICENSE) — ฟรีและโอเพนซอร์ส เนื้อหาผู้ให้บริการและ dependency ภายนอกยังคงสิทธิ์และใบอนุญาตของตน

แอปพลิเคชันแยกต่างหาก [OTTPlay native webOS](docs/native-webos.md) ซึ่งพัฒนาจาก PlxNative เผยแพร่ภายใต้ **GPL-3.0-or-later** พร้อมซอร์สโค้ดที่ตรงกัน
สัญญาอนุญาต MIT ในไดเรกทอรีหลักของโครงการไม่ได้เปลี่ยนสัญญาอนุญาตของแอปพลิเคชันเนทีฟนี้หรือแพตช์ของแอปพลิเคชัน

<a id="desktop-updater--notarization-mode-b"></a>

## ตัวอัปเดตเดสก์ท็อป / notarization (Mode B)

[คู่มือเซ็นเดสก์ท็อปและตัวอัปเดต](docs/tauri-updater-notarize.md) อธิบาย macOS ad-hoc signing, Developer ID/notarization แบบเลือกได้ และตรวจแพ็กเกจ Release CI ใช้ ad-hoc โดยไม่มีข้อมูลรับรอง Apple การเซ็น updater แยกต่างหาก การอัปเดตอัตโนมัติ production ยังไม่ได้ตั้ง

<a id="local-mac-build-helpers"></a>

## ตัวช่วย build Mac ในเครื่อง

ดู [docs/local-build-scripts.md](docs/local-build-scripts.md)

<a id="privacy"></a>

## ความเป็นส่วนตัว

อ่าน [นโยบายความเป็นส่วนตัว](docs/privacy-policy.md) สำหรับข้อมูลการตั้งค่าในเครื่อง บริการที่กำหนด และทางเลือกของคุณ ติดต่อความเป็นส่วนตัวและช่วยเหลือ: [alvit.work@gmail.com](mailto:alvit.work@gmail.com)

Studio 2026 เป็นธีมเริ่มต้น ยังเลือก Classic และ PLi-HD ได้ และรักษาค่าที่ผู้ใช้บันทึก ดู [การตั้งค่าอินเทอร์เฟซ](docs/interface-settings.md) ธีม PLi-HD ให้เครดิต Vali, littlesat, VU+NL, Milo และผู้ร่วมพัฒนาต้นทาง ดูประวัติภาษาอังกฤษกับลิงก์แหล่งที่มาที่ [เครดิตอินเทอร์เฟซและประวัติการออกแบบ](docs/interface-history.md) ซึ่งเปิดจากเมนูข้อมูลเครื่องเล่นได้ด้วย

<a id="demo-video-editing"></a>

## ตัดต่อวิดีโอเดโม

ใช้ [เวิร์กโฟลว์ video-use](docs/demo-video.md) ในเครื่องเพื่อเตรียมและตัดต่อการบันทึกเดโม ตัวช่วยเก็บสื่อที่สร้างทั้งหมดนอก Git

<a id="plex-media-library"></a>

## คลังสื่อ Plex

แต่ละเครื่องเล่นเชื่อมบัญชี Plex หรือ Plex Media Server ผ่านผู้ให้บริการ **Plex** ได้ Integration นี้ใช้ Plex โดย Synology เป็นโฮสต์เซิร์ฟเวอร์สื่อที่เป็นไปได้แบบหนึ่ง วิดีโอและเพลงที่เข้าถึงได้ทั้งหมดจะแสดงในรายการช่องโดยอัตโนมัติ เลือกหมวดหมู่เพื่อกรองตามคลัง โฟลเดอร์ หรือซีรีส์ การเล่นเริ่มจากชุดแรกที่ใช้ได้ พร้อมโหลดเบื้องหลัง ค้นหาปกติ และ Actions สำหรับสุ่ม/เล่นซ้ำ โดยไม่ตั้ง Plex บน OTT server ดู [เข้าสู่ระบบ Plex และเล่นโดยตรง](docs/plex-provider.md)

![วงจรโหลด Plex นำทางไฟล์ และปิด](docs/images/plex-playback-lifecycle.svg)

[รีวิวความเชื่อถือได้พร้อมภาพ](docs/plex-provider.md#reliability-review-process-and-results) อธิบายกฎโหลดและยกเลิก การแก้แค็ตตาล็อกให้ครบและเปลี่ยนไฟล์ รวมถึงผลตรวจ Chromium/WebKit ที่วัดได้

<a id="related-repositories"></a>

## คลังที่เกี่ยวข้อง

- [ottplay-core](https://github.com/open-ott-play/ottplay-core) ดูแลตรรกะโดเมน JVM/ES5 ร่วม ข้อกำหนดการสื่อสาร และ FOSS2 client เครื่องเล่นนี้ใช้ artifact ที่สร้างแล้ว หากเปลี่ยนส่วนร่วมให้ตามคู่มือส่งมอบ core
- [ottplay-android](https://github.com/open-ott-play/ottplay-android) เป็นแอป Kotlin/Compose เนทีฟแยก มีตัวตนการติดตั้งและ release ของตัวเอง
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server) ให้คำสั่งระยะไกลแบบ self-hosted ส่วน [ottplay-swop](https://github.com/open-ott-play/ottplay-swop) ให้การส่งข้อความผ่าน Worker แบบเลือกใช้
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine) ดูแลโปรไฟล์เดโมเบราว์เซอร์ที่โฮสต์ สื่อเดโม และการตรวจเผยแพร่

<a id="project-maintenance"></a>

## บำรุงรักษาโครงการ

ดู [ข้อกำหนดการร่วมพัฒนาและทดสอบ](CONTRIBUTING.md), [นโยบายรายงานความปลอดภัย](SECURITY.md), [การออกแบบความปลอดภัย](docs/security-design.md) และ [หลักฐาน OpenSSF กับเกณฑ์ที่เหลือ](docs/openssf-evidence.md)
