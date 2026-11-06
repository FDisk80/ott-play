<div lang="he" dir="rtl">

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

לקבצים מקומיים ללא אינטרנט, ראו [סרטונים מקומיים וניגון לא מקוון](docs/offline-media.md).

[![דפדפן הערוצים של OTT-play FOSS במבט פרספקטיבי](docs/images/hero.png)](docs/images/studio-2026-default.png)

*צילום של ממשק Studio 2026 הקיים עם ערוצים ותוכניות בדיקה סינתטיים. פתחו את התמונה לתצוגה המקורית והשטוחה; זה אינו צילום של מינוי פעיל. [מקור התמונה ויצירה מחדש](docs/images/README.md).*

[מדריכי התחלה ב־88 שפות](docs/readme/README.md) · [ויקי התיעוד](docs/wiki/Home.he.md)

[![שיטות העבודה המומלצות של OpenSSF](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![בדיקות fuzzing: רק RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

גרסאות מועמדות ציבוריות מריצות סבבי fuzzing מוגבלים ומבודדים לפענוח XMLTV ברכיבים הילידיים/בשרת ולאימות בקשות לפורטל. ראו [היקף הבדיקות, שחזור וראיות שחרור](FUZZING.md).

נגן IPTV/OTT עצמאי עם שרת HTTP מקומי ב־Rust. פועל בטלוויזיות חכמות (LG WebOS, Samsung Tizen, Panasonic, Sony ועוד), בממירים (Infomir MAG, Dune HD, Enigma2, Android TV) ובדפדפני מחשב.

התחילו ב[מדריך הארכיטקטורה והתרומה](docs/architecture.md) לשכבות זמן הריצה, אחריות, מתכוני הרחבת ספקים ואימות. ראו [הפעלות ניגון ואורך חיי ספקים](docs/playback-session-architecture.md) לגבול הליבה/המארח ולחוזי התאימות.

<!-- ci-release-process:start -->
<a id="release-process"></a>

## תהליך השחרור

ראו [אסטרטגיית שחרור](RELEASING.md) לכללי אימות, גרסאות ליליות, בטא, RC וקידום לגרסה יציבה, ו[מדריך התפעול](docs/release-workflow.md) לפקודות מקומיות.
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## הפעלה בדפדפן

פתחו את [ההדגמה החיה](https://player.ottplay.here.now/), או בנו והגישו את נגן הרשת לפי ההוראות בהמשך.

[הפריסה המקומית ב־macOS](docs/local-http-deployment.md) מספקת מקורות HTTP לנגן ביציאות 8443–8446. יציאה 8095 הוצאה משימוש.

בהפעלה הראשונה בחרו **ניסיון הדגמה** כדי לנגן תבנית בדיקה נעה, או הגדירו רשימת M3U או ספק משלכם. אפשר לחזור להדגמה דרך **החלפת ספק ← הדגמה**.

מצב ההדגמה דורש אינטרנט אך אינו דורש חשבון ספק. ערוצי MP4 ו־HLS השקטים שלו מתארחים ב־here.now ומשותפים לנגן הרשת, Tauri, Capacitor ו־OTT Server. הגדרות הספק הקיימות נשמרות בעת מעבר. ל**בדיקת תמונה וקול** נפרדת, פתחו **מידע ← שמע ← ניגון** במנוע HTML5 המנוהל בזמן סרק או צפייה חיה. הבדיקה משתמשת בקובץ הנשמע `av-v1.mp4` ב־here.now ודורשת אינטרנט. הקליפ אינו כלול בחבילות הנגן ולעולם אינו נשלף בזמן האתחול. VOD, ארכיון ועקיפות מנוע של המכשיר (כולל PC2/Video.js ומנועים ילידיים) אינם נכללים; ראו [שלבים, צלילים צפויים ותרשים אירוח](docs/audio-video-check.he.md).

חלונות דפדפן שולחניים שהותקנו כיישום תומכים ב־**Window Controls Overlay**: Chrome יכול להסתיר את שורת הכותרת הנפרדת ולהשאיר את כפתורי החלון ותפריט היישום מעל הנגן. פתחו את היישום המותקן ובחרו **Hide title bar** כש־Chrome מציע זאת; **Show title bar** מחזיר את המסגרת הרגילה. כרטיסיות רגילות ופריסות טלוויזיה/מעטפת ילידית ממשיכות להתנהג כרגיל. ראו [בקרי חלון הדפדפן](docs/browser-window-controls.md) לכתובות התקנה נתמכות, עדכון קיצור קיים ואימות.

לדילוג של עשר שניות בתצוגת הווידאו הראשית השתמשו ב־**Alt/Option + שמאלה/ימינה** (גם **Command + שמאלה/ימינה** עובד ב־macOS), במסך מלא או רגיל. סרטונים מקומיים, VOD וארכיוני ערוצים נתמכים משתמשים באותם בקרים ברשת, ב־Tauri וב־Capacitor. ראו [קיצורי מקשים ומגבלות](docs/browser-window-controls.md#playback-keyboard-shortcuts).

בממשק המחשב, **R** מנגן ערוץ או סרטון אחר באופן אקראי מהרשימה הנוכחית בלי לערבב את סדרה. הוא פועל בתצוגת הווידאו הראשית וברשימות הערוצים/הסרטונים; עורכי טקסט, חלוניות, הגדרות והגבלות קיוסק מקבלים קדימות. מיפויי מקשים במכשירים אחרים אינם משתנים.

אפשר ליצור מחדש את תבנית הבדיקה באמצעות `scripts/generate-demo-media.sh` (דורש FFmpeg); המדיה שנוצרת נשארת בתיקייה המוחרגת `.local-artifacts`.

<a id="features"></a>

## תכונות

- **ניגון**: זרמי HLS, DASH ו־HTTP רגיל, עם תקרות איכות מנוהלות ב־HLS.js/Shaka, התאוששות מוגבלת ועד שלוש כתובות גיבוי מפורשות לכל ערוץ חי. ארכיון/VOD לעולם אינם עוברים לגיבוי חי; ראו [איכות והתאוששות](docs/playback-stream-policy.he.md).
- **EPG**: התאמת XMLTV, הסטת זמן/השלמת צפייה, חיפוש בכותרות תוכניות (N5 ב־EPG), תזכורות וקישור ידני להזנה/מזהה לערוץ מדויק במסלול XMLTV המתארח/הילידי. ראו [קישור ונגישות](docs/guide-binding-accessibility.he.md).
- **מועדפים**: [אוסף מעורב](docs/mixed-favorites.md) מסודר אחד בין ספקים ופרופילים מוגדרים במכשירים נתמכים, עם ייצוא/ייבוא נייד דרך CLI; PIN הורים. רשימות מועדפים לכל מקור נשארות זמינות במצב חלופי.
- **הגדרות**: ייצוא/ייבוא JSON של הגדרות ומועדפים, יומן ביטול לאצוות localStorage נתמכות, חידוש ארכיון מודע־מקור והשוואה מדויקת של הגדרות שמורות עבור תהליכי בקר. ההתאוששות מניחה כותב יחיד; מתאמי אחסון מותאמים שומרים על החזרה לאחור במאמץ מיטבי. ראו [שחזור הגדרות](docs/settings-recovery.he.md).
- **ממשק משותף**: OTT Server, Tauri ו־Capacitor משתמשים באותה ערכת רשימת ערוצים ובהגדרות נראות. האפשרות [צבעי הממשק](docs/interface-colors.md) מציעה תשעה תפקידי צבע, פלטת צבעים, הזנה מדויקת של ערכי HEX/RGB/HSV וחמש ערכות צבעים, וההגדרות נשמרות עבור מופע הנגן; הגדרות הרשימה קובעות שמות ערוצים, סמלים, תוכניות נוכחיות, התקדמות וסימוני ארכיון.
- **ספקים**: M3U/M3U8, טלוויזיה חיה של Xtream יחד עם [קטלוג סרטים/סדרות לפי דרישה](docs/xtream-media.he.md), Stalker/Ministra עם [סרטים ופרקים מקוננים בפרוטוקול הקלאסי](docs/stalker-media.md), Plex ו־VPortal. יכולות הספק והרשאות החשבון קובעות אילו תכונות ארכיון וספריית מדיה זמינות.
- **פקודות דחיפה**: שליטה מרחוק באמצעות webhook — החלפת ערוץ, ספק ורשימת ניגון והצגת הודעות.
- **הזנת טקסט מרחוק (swop)**: מקלדת טלפון דרך Cloudflare Worker כאשר הטלוויזיה והטלפון ברשתות שונות (הפעלות מורשות להתקנה; ♥™ ב־VKB).
- **ניתוב לכל מכשיר**: כתובות מבוססות UUID למערכים מרובי מכשירים.
- **פרוקסי מקומי**: שרת פקודות מקומי אופציונלי לאוטומציה מקומית לחלוטין (ללא שרת מרכזי).
- **שילוב בקר**: מפעילים מוגבלים למכשיר/פעולה, תוצאות פקודה עמידות אופציונליות, החלה ניתנת לחידוש של תצורות Local/Home והעברת חי/ארכיון מאותו מקור דרך [שרת הבקרה](https://github.com/open-ott-play/ottplay-control-server) התואם. אלה דורשים בקר/CLI מעודכנים; כרטיסיית דפדפן עצמאית אינה מספקת אותם.
- **העדפות מרוחקות עם טיפוסים מוגדרים**: גלו הגדרות, קראו ערכים שמורים וערכים בפועל, ושמרו תוך בדיקת מופע הריצה, המקור והגרסה; ראו [הגדרות מרוחקות ותצורת VPortal](docs/remote-player-settings.md).
- **ניפוי שגיאות**: HUD ניגון / יומן טבעתי בהסכמה דרך `?debug=1`, בדיקה מרחוק בהסכמה ובדיקת שמע/וידאו מתארחת לפי דרישה.
- **נגישות מקלדת**: חלוניות קלאסיות בעלות שם, הגבלה והחזרה של מיקוד Tab, משמעות סמנטית לערוץ נבחר והודעות מצב לא מפריעות. שיפורים אלה אינם מבססים תאימות מלאה ל־WCAG או לקוראי מסך במכשירים.
- **24 סוגי מכשיר**: מיפויי שלט ייעודיים לכל מכשיר.
- **88 שפות ממשק**: קטלוגים תואמים, [מדריכי התחלה מתורגמים](docs/readme/README.md) ו[אלפבית מקלדת שנבדק מול CLDR](docs/localization.md). המדריך הראשי ומדריכי התכונות המקבילים זמינים ב[־24 שפות תיעוד](docs/manual-translations.md); יתר המקורות ההנדסיים שומרים על השפות הקיימות.

[מדריך האספקה](docs/roadmap-delivery.he.md) מתאר את התכונות שיושמו בגרסת המקור הזו, גבולות פלטפורמות, תרשימים ואימות. התקנות ופריסות מתארחות עשויות להשתמש בגרסה קודמת. [יישום Android](https://github.com/open-ott-play/ottplay-android) הילידי העצמאי שומר גם בחירות שמע/כתוביות לפי שפה, תפקיד ותווית במקום אינדקסי manifest; היישום והשחרור שלו נפרדים מממשק זה.

[סקירת מקורות STB](docs/stb-player-improvements.md) מסבירה את השיפורים במדיה, במשאבים ובהתאוששות, את השוואת המקורות ואת המגבלות הנוכחיות.

<a id="debug-hud"></a>

## HUD לניפוי שגיאות

ל־HUD המקומי ולשמירה המתמשכת של יומן השרת יש הסכמות נפרדות. לפני איסוף יומנים ממכשירים אחרים ראו [גישה לאבחון, הסרת מידע ושמירה](docs/diagnostic-security.md).

הפעילו מצב ניפוי באחת הדרכים:
- URL: `?debug=1` או `?debug=true`
- אחסון מקומי: `localStorage.setItem("ottplay_debug", "1")`
- מאפיין חלון: `window.__OTT_DEBUG__ = true`
- שרת: כאשר `/debug/config` מחזיר `{enabled: true}`

כאשר הניפוי פעיל:
- לחצו **D** להחלפת נראות רצועת HUD (`ottDebugSetHud` / `__ottDebug.toggleHud()`)
  - מדלג כאשר המיקוד ב־INPUT/TEXTAREA/listEdit
  - משתמש ב־`e.key` למניעת התנגשות עם PLAY/PREV=68 ב־MAG/Maple
- תפריט מידע ← **Debug HUD** ← מפעיל `__ottDebug.toggleHud()`
- ניהול הגדרות ← **Debug HUD**:
  - אם הניפוי כבר נטען: מחליף את נראות HUD
  - אחרת: מגדיר `ottplay_debug=1` + `ottplay_debug_hud=1` ומבקש הפעלה מחדש
- שמירה: מצב HUD נשמר ב־`localStorage.ottplay_debug_hud` ("1"/"0") באמצעות `ottDebugSetHud`

<a id="capacitor-ios-and-android"></a>

## Capacitor עבור iOS ו־Android

מאגר זה אורז את ממשק TypeScript המשותף עם Capacitor עבור iOS ו־Android 7+. שניהם משתמשים בגופני המערכת ובזמן הריצה הילידי הנעול ב־npm. APK תאימות נפרד ל־API 22 תומך ב־Android 5.1/6 עם WebView 60 ומעלה. שני קובצי APK של Android חתומים ונכללים בשחרורי בטא, RC ויציב שעברו את התנאים, לצד IPA לא חתום ל־iOS. יישום Kotlin העצמאי נשאר ב[־ottplay-android](https://github.com/open-ott-play/ottplay-android).

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

<div lang="he" dir="rtl">

ראו [תצורת Capacitor](docs/capacitor-mobile.md) ו[הפצת Android ועדכונים מרחוק](docs/android-distributions.md).

ממשק iOS פועל לרוחב. הגדרות, תצורת ספק, הסכמה לשליטה מרחוק וייבוא/ייצוא JSON נשארים בממשק המשותף. ריבוי משימות בטאבלט יכול לעקוף את הכיוון המבוקש.

ב־iPhone החליקו אנכית מעל רשימת הערוצים למעבר בין שורות ועמודים; למעלה לערוצים מאוחרים ולמטה למוקדמים. תנועה מהירה ממשיכה מספר עמודים ומאטה עד לעצירה; גרירה איטית נשארת מדויקת. געו במסך או לחצו מקש ניווט לעצירה. נגיעה בודדת מפעילה את הערוץ שמתחת לאצבע גם אם שורה אחרת נבחרה. החלקה לעולם אינה פותחת ערוץ בהרמת האצבע.

הווידאו מנוגן בתוך הדף ב־iPhone. געו בתחתית המסך למידע על התוכנית או פתחו תפריט בזמן שהניגון ממשיך. תמונה בתוך תמונה נשארת אפשרות ניגון נפרדת.

בדיקת עשן במכשיר: [רשימת Mode B](docs/mode-b-device-smoke.md) ו־`./scripts/smoke-capacitor-device.sh --help` (יעד בנייה/סנכרון iOS בלבד). בדיקת Tauri למחשב: [רשימת מחשב](docs/mode-b-tauri-smoke.md).

<a id="installation"></a>

## התקנה

| פלטפורמה | חבילה | הערות |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | בניות נפרדות ל־Apple Silicon ול־Intel; חתימת ad-hoc אלא אם הוגדרה חתימת Apple |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | הפצות שונות |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode או Homebrew Channel](docs/lg-webos-installation.md); נגן מתארח, נדרש חיבור לרשת |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode וחתימה מקומית; חבילת טלוויזיה לא חתומה, נפרדת מ־Family Hub](docs/samsung-tizen-installation.md) |
| **iOS** | `.ipa` דרך AltStore / TestFlight / Xcode | התקנה צדדית בלבד — עדיין לא ב־App Store |
| **Android (ממשק משותף)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | חבילות Capacitor חתומות; בחרו גרסת Android נתמכת |
| **Android (Kotlin ילידי)** | [יישום ילידי](https://github.com/open-ott-play/ottplay-android) נפרד | מאגר ציבורי; יישום ותהליך שחרור נפרדים |

מתקינים נתמכים מצורפים לשחרורי GitHub שעברו את התנאים: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **הערה:** חבילות macOS משתמשות בחתימת ad-hoc כשאין פרטי חתימה של Apple; זו אינה Developer ID או notarization. מתקיני Windows/Linux וחבילות iOS עשויים להיות לא חתומים. iOS דורש חתימה לפני התקנה במכשיר פיזי. APK של שחרורי Full ו־API 22 המאושרים משתמשים בתעודת החתימה הקבועה; בנייה מקומית לשחרור דורשת keystore מוגדר ליצירת APK חתום.

---

<a id="macos"></a>

### macOS

1. בחרו את התג הרצוי ב[שחרורים](https://github.com/open-ott-play/ottplay-foss/releases). קיצור הגרסה האחרונה בוחר יציבה, לא בטא או RC.
2. הורידו `OttPlay.FOSS_*_aarch64-apple-darwin.dmg` ל־Apple Silicon או `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` ל־Intel. אלה בניות נפרדות לפי ארכיטקטורה.
3. פתחו `.dmg` וגררו את **OttPlay FOSS.app** ל־Applications.
4. אמתו את החבילה שהועתקה לפני ההפעלה הראשונה:

</div>

<div dir="ltr">

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

</div>

<div lang="he" dir="rtl">

אימות מוצלח בודק את שלמות החבילה. `Signature=adhoc` פירושו שאין ליישום זהות מפתח מאומתת ב־Apple; אין בכך הוכחת notarization או אישור Gatekeeper. גם עם הורדה אמינה וחבילה תקינה, macOS עשוי לדרוש **הגדרות מערכת ← פרטיות ואבטחה ← פתיחה בכל זאת** אחרי ניסיון הפעלה ראשון; ראו [הוראות Apple](https://support.apple.com/en-us/102445).

הודעת ״היישום פגום״ אינה מוכיחה שרק הסגר הוא הבעיה. אם אימות החתימה נכשל, שמרו את השגיאה והשיגו שחרור מתוקן. אל תחתמו מחדש על היישום שהורד ואל תסירו מאפיינים כדי לגרום לאימות כושל להיראות מוצלח.

חלופות ZIP הן `OttPlay.FOSS_aarch64-apple-darwin.app.zip` ו־`OttPlay.FOSS_x86_64-apple-darwin.app.zip`. ראו [חתימת macOS ואימות תוצרים](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact) לבדיקות חילוץ, תמונת דיסק ו־Gatekeeper. לבנייה מעותק המאגר והתקנה מקומית, השתמשו ב[אספקה מקומית ל־macOS](docs/macos-local-delivery.md).

---

<a id="windows"></a>

### Windows

1. הורידו `.msi` או `.exe` מ[שחרורים](https://github.com/open-ott-play/ottplay-foss/releases/latest)
2. הריצו את המתקין ופעלו לפי ההנחיות
3. הפעילו מתפריט Start או מקיצור שולחן העבודה

---

<a id="linux"></a>

### Linux

ניגון Linux דורש תוספי GStreamer עבור HLS, H.264 ו־AAC בנוסף ל־WebKitGTK. החבילות מצהירות על תלות במדיה זו; בניות AppImage כוללות את תשתית המדיה. ראו [אריזת מדיה ב־Linux](docs/linux-media-packaging.md) לבדיקות מקודדים והבדל בין קבלת דפדפן לקבלה ילידית.

**AppImage:**

</div>

<div dir="ltr">

```bash
chmod +x OttPlay.FOSS_*_amd64.AppImage
./OttPlay.FOSS_*_amd64.AppImage
```

</div>

<div lang="he" dir="rtl">

**Debian/Ubuntu (.deb):**

</div>

<div dir="ltr">

```bash
sudo apt install ./OttPlay.FOSS_*.deb
```

</div>

<div lang="he" dir="rtl">

**Fedora (.rpm):**

</div>

<div dir="ltr">

```bash
sudo dnf --enablerepo=fedora-cisco-openh264 install ./OttPlay.FOSS-*.rpm
```

</div>

<div lang="he" dir="rtl">

---

<a id="ios-installation"></a>

### התקנת iOS

iOS דורש חתימה לפני התקנה במכשיר פיזי. השתמשו ב־AltStore Classic עבור IPA לא חתום מהשחרור, או בנו וחתמו מהמקור עם Xcode. TestFlight דורש הזמנה נפרדת כאשר הוא מוצע.

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### אפשרות 1: AltStore Classic (מומלץ לשימוש אישי)

AltServer פועל במחשב; AltStore Classic פועל ב־iPhone/iPad ומייבא את IPA. חשבון Apple חינמי מספיק.

**דרישות מקדימות:**

- iPhone/iPad עם **iOS/iPadOS 15 ומעלה** עבור בניית OTT-play הנוכחית.
- Mac או מחשב Windows עם AltServer וכבל נתונים USB.
- חשבון Apple לחתימה ואינטרנט להורדת השחרור.

**שלב 1: הגדרת AltStore פעם אחת**

1. התקינו AltServer לפי [הוראות macOS](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) או [הוראות Windows](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows) הרשמיות. הפעילו אותו והשתמשו בסמל שורת התפריטים/מגש המערכת.
2. חברו את המכשיר ב־USB, בטלו נעילה ואשרו את בקשות האמון במחשב/מכשיר. ב־Mac בדקו שהמכשיר מופיע ב־Finder.
3. ב־**תפריט AltServer ← Install AltStore** בחרו את המכשיר והשלימו את בקשות חשבון החתימה. המתינו להודעת ההתקנה.
4. במכשיר פתחו **הגדרות ← כללי ← VPN וניהול מכשירים** ואשרו אמון במפתח של חשבון החתימה אם נדרש. ב־iOS 16+ הפעילו **הגדרות ← פרטיות ואבטחה ← מצב מפתח** והשלימו הפעלה מחדש ואישור.
5. פתחו AltStore במכשיר. אם הוא מותקן ופועל, דלגו על ההגדרה והשאירו את AltServer פעיל לייבוא הבא.

**שלב 2: ייבוא השחרור הנבחר ב־iPhone/iPad**

1. בחרו תג מדויק מ[כל השחרורים](https://github.com/open-ott-play/ottplay-foss/releases) והורידו את `ottplay-foss-ios-unsigned.ipa` שלו ב־Safari במכשיר. [קיצור השחרור האחרון](https://github.com/open-ott-play/ottplay-foss/releases/latest) בוחר גרסה יציבה; השתמשו ברשימה המלאה להתקנת בטא.
2. שמרו את IPA ב־Files. ב־**AltStore ← My Apps ← +** בחרו את הקובץ. אפשר להעביר IPA שהורד ב־Mac דרך AirDrop ולשמור ב־Files לפני הייבוא. פתיחת IPA ב־Mac אינה שלב הייבוא הזה.
3. השאירו את AltServer פעיל ואת כבל USB מחובר בזמן ש־AltStore חותם ומתקין. לעדכון השתמשו באותו חשבון חתימה של ההתקנה הקיימת; אל תמחקו את היישום כצעד פתרון ראשון.
4. המתינו לסיום הייבוא, בדקו OTT-play ב־**My Apps** והפעילו אותו.

**חלופה: ייבוא כתובת השחרור ישירות**

כאשר AltStore כבר מותקן, הזינו את התבנית הזו ב־**Safari ב־iPhone**, החליפו `TAG` בתג המדויק ואשרו **Open in AltStore**:

</div>

<div dir="ltr">

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

</div>

<div lang="he" dir="rtl">

הדרך משתמשת ב[מטפל כתובת ההתקנה](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift) של AltStore. היא מונעת עמימות ב־Files/Recents כאשר למספר הורדות אותו שם. הכתובת חייבת להפנות לקובץ IPA ולא לדף השחרור.

למשל, הייבוא הבא אומת ב־**2026-09-29** עם AltStore 2.3 ו־AltServer 1.8.1. זו דוגמה היסטורית קבועה, לא קישור לגרסה האחרונה:

</div>

<div dir="ltr">

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

</div>

<div lang="he" dir="rtl">

**רענון:** התקנות בחשבון חינמי פגות אחרי שבעה ימים. השאירו את AltServer נגיש והשתמשו ב־**AltStore ← My Apps ← Refresh All** לפני התפוגה. רענון ברקע דורש גם הוא גישה ל־AltServer; ראו [הוראות הרענון של AltStore](https://faq.altstore.io/altstore-classic/your-altstore).

<a id="verify-the-installed-version-before-retrying"></a>

#### אימות הגרסה המותקנת לפני ניסיון נוסף

הודעת ״נשלח״ של AirDrop מאשרת העברה בלבד. סרגל התקדמות AltStore מאשר שהייבוא התחיל. אובדן Mirroring/USB אינו מוכיח שהתקנה נכשלה: בדקו את היישום המותקן לפני שליחת IPA שוב.

ב־Mac שבו Xcode מותקן ונבחר כתיקיית המפתח הפעילה, בדקו את המכשיר בלי להתקין מחדש:

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

<div lang="he" dir="rtl">

בתוך `result.apps` של JSON מצאו OTT-play (`bundleIdentifier` מתחיל ב־`play.ott.foss`) והשוו גם `version` וגם `bundleVersion` ל־`CFBundleShortVersionString` ול־`CFBundleVersion` של IPA הנבחר. סיומת חשבון החתימה של AltStore במזהה החבילה צפויה. שמרו את דוח המכשיר מקומית.

דוגמת beta.9 שאומתה מדווחת **גרסה `1.1.51`, בנייה `2.2.66`**. זה מאשר התקנה; פתיחת היישום, כניסת Cloudflare, טעינת הרשימה, ניגון ו־PiP הם בדיקות נפרדות במכשיר.

<a id="troubleshooting-ios-installation"></a>

#### פתרון בעיות התקנת iOS

- **אין חלון ל־AltServer, או פתיחתו באוטומציה מגיעה לפסק זמן:** השתמשו בסמל שורת התפריטים/מגש המערכת. זהו יישום רקע. ניסיונות חוזרים לפתוח חלון רגיל אינם מייבאים IPA.
- **״Could not find AltServer״ או שמכשיר USB אינו זמין:** ודאו ש־AltServer פועל, בטלו נעילת הטלפון ובדקו בקשות אמון. בדקו נראות ב־Finder ב־Mac. אם החיבור נותק, חברו שוב כשבטוח ובדקו גרסה מותקנת לפני ניסיון חוזר. אם נמשך, פעלו לפי [פתרון בעיות קישוריות של AltStore](https://faq.altstore.io/altstore-classic/troubleshooting-guide). אם הטלפון מספק אינטרנט למחשב, תאמו שינוי כבל/רשת כדי לא להפריע לעבודות אחרות.
- **iPhone Mirroring מציג ״iPhone in Use״ או נשאר ב־״Connecting״:** השלימו במכשיר הפיזי, או נעלו אותו והשאירו ליד Mac לא נעול לשיקוף. פתיחת נעילת הטלפון מסיימת את השיקוף; אמון/הגדרת USB עשויים לדרוש ביטול נעילה תחילה. אם חיבור חוזר אחד עדיין נתקע, סגרו Mirroring והמשיכו בטלפון. ראו [דרישות השיקוף של Apple](https://support.apple.com/en-us/120421). השיקוף אינו חובה להתקנה.
- **כתובת מאבדת אותיות לטיניות או הופכת לקירילית בשיקוף:** שנו את **מקור הקלט של Mac ל־ABC/English**. כשהמיקוד בשיקוף, לחצו **Control–Space** ובחרו **English (US)** למקלדת החומרה של iPhone. מקורות הקלט עשויים להיות שונים; שינוי Mac בלבד לא הספיק בבדיקה שלנו. נקו את השדה, הזינו מחדש ובדקו לפני שליחה.
- **הדבקת הלוח לשיקוף נתקעת או מכניסה טקסט לא צפוי:** נקו את השדה והקלידו לאט בחלקים קצרים עם מקור English (US) של iPhone, או הזינו ישירות בטלפון. הקלדה מהירה בשיקוף עלולה להשמיט או להכפיל תווים; בדקו כתובת מלאה לפני שמירה. אל תשלחו כתובת שהודבקה חלקית. ההדבקה נכשלה בבדיקת ההתקנה שלנו; היא אינה דרישה לשיטת הכתובת הישירה.
- **Files/Recents מציג מספר שמות IPA זהים:** בחרו את מיקום ההורדה המדויק או השתמשו בכתובת מתויגת לעיל. אפשר לשנות שם עותק מקומי כדי לכלול תג/בנייה להבהרה; שינוי שם אינו משנה תוכן.
- **היישום המותקן אינו נפתח:** פעלו לפי בקשות אמון במפתח או מצב מפתח בטלפון. בדקו תפוגה ב־AltStore ורעננו לפי הצורך. אם עדיין נכשל, תעדו את השגיאה בפועל; שגיאת חיבור לבדה אינה סיבה למחיקה והתקנה מחדש.
- **OTT-play נפתח אך רשימה מוגנת נכשלת בסלולר:** התקנה ואימות מקור הם נפרדים. השתמשו ב־**הגדרות ← ניהול הגדרות ← גישה למקור** לכניסה למקור מוגדר, ואז טענו מחדש. השלימו ביומטריה/passkey או קוד דוא״ל במכשיר הפיזי לפי הצורך. המקור חייב לתמוך ב[שילוב iOS Access](docs/ios-source-access.md); ההתקנה אינה עוקפת רשימת IP מורשים.
- **מתבקשת passkey ב־Wi-Fi מהימן:** במקורות עם iOS Access, היישום מנסה תחילה את המקור המקורי ללא כניסה ועובר לכניסה ניידת מאומתת רק אחרי סירוב גישה. בדקו את ה־IP הציבורי שהמקור באמת רואה, כולל IPv6: אישור IPv4 ביתי אינו מכסה IPv6 שונה, VPN או כתובת סלולרית. שינוי רשת ופתיחת היישום מחדש מנקים את העדפת המסלול הזמנית. שגיאת רשת/שרת כללית לא אמורה להפעיל כניסה.
- **הכניסה אינה מוצגת אך רשימת הערוצים ריקה:** הפעלה שמורה תקפה ממוחזרת ללא בקשה נוספת. אחרי טעינה כושלת או תיקון בשרת, טענו רשימה מחדש או סגרו לגמרי ופתחו פעם אחת. אם נמשך, בדקו שהמקור מחזיר רשימת ניגון ולא דף כניסה HTML או שגיאת JSON. תעדו שגיאה וקוד HTTP; אל תשתפו כתובות מקור עם פרטי זיהוי, cookies או אסימוני Access.
- **הערוצים נטענים אך הווידאו אוגר או מציג `SRC_NOT_FOUND`:** טעינת רשימה וניגון הם בדיקות נפרדות. נסו את הערוץ פעם נוספת אחרי כניסה; אם נמשך, בדקו manifest HLS, תגובות המקטעים ותמיכת המקודד. השגיאה לבדה אינה מוכיחה שהחלפת מנוע או התקנה מחדש יעזרו.

<a id="option-2-testflight-if-available"></a>

#### אפשרות 2: TestFlight (אם זמין)

אם מתפרסמת הזמנת TestFlight, התקינו TestFlight מה־App Store, פתחו את ההזמנה במכשיר ולחצו **Install**. הורדת IPA מ־GitHub אינה מספקת הזמנת TestFlight.

<a id="option-3-xcode-for-developers"></a>

#### אפשרות 3: Xcode (למפתחים)

עקבו אחרי [בנייה ופתיחה](docs/capacitor-mobile.md#build-and-open), בחרו יעד **App** ב־Xcode, הגדירו צוות פיתוח ב־**Signing & Capabilities**, בחרו מכשיר מחובר ובנו/הריצו. השלימו אמון ומצב מפתח לפי הצורך. ייבוא IPA לא חתום לחלון Devices אינו מספק זהות חתימה או פרופיל provisioning חסרים.

---

<a id="android-application"></a>

### יישום Android

בחרו Full Capacitor APK מהשחרור של מאגר זה לממשק המשותף. השתמשו ב־APK תאימות API 22 ב־Android 5.1–6; הוא דורש WebView 60 ומעלה. שמרו על זהות היישום ותעודת החתימה בעדכון כדי לשמר פרופילים קיימים. ראו [הוראות בנייה](android/README.md) ו[הפצה, חתימה והתקנה מרחוק](docs/android-distributions.md).

[מאגר ottplay-android](https://github.com/open-ott-play/ottplay-android) הנפרד מכיל יישום Kotlin/Compose ילידי. יש לו זהות, העדפות ותהליך שחרור משלו, והוא אינו מחליף התקנת Capacitor במקומה. תוצרי שחרור היסטוריים נשארים זמינים.

---

<a id="quick-start"></a>

## התחלה מהירה

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

<div lang="he" dir="rtl">

לבדיקת עשן בדפדפן השתמשו בפריסה משלכם מאותה גרסת מקור.

השתמשו ב־Node 22 ובשרשרת הכלים היציבה של Rust. הריצו את השרת משורש המאגר כדי שהמשאבים הסטטיים יהיו זמינים. בנייה ילידית דורשת את כלי הפלטפורמה המתוארים בהמשך; הם אינם דרושים לבניית שרת בלבד.

בטעינה הראשונה בחרו **ניסיון הדגמה**, או **הגדרות ← החלפת ספק ← רשימות M3U / M3U8**. פתחו **בחירת רשימה**, בחרו משבצת, הזינו **כתובת רשימה**, שמרו ובחרו **טעינת רשימה**. הרשימה או חשבון הספק מגיעים מכם; היישום אינו מספק מינוי לערוצים בתשלום.

<a id="mode-a-companion-smoke"></a>

## בדיקת עשן למלווה Mode A

בדיקה מבוססת curl למלווה Mode A (התאמה בין `ottplay-server` / `archive/server.py`): אינדקס, תיקיות סטטיות, `/logo`, `/version`, `/epg` אופציונלי ובדיקה ללא שליפה של `POST /m3u/cp.php`.

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

<div lang="he" dir="rtl">

הבדיקות נמצאות ב־`scripts/modea-smoke-checks.json`. ללא סודות. תור הפקודות / `local_proxy.py` (:8081) נבדק בנפרד ב־`scripts/smoke-command-queue.sh` (אם קיים).

<a id="classic-stalker--ministra-portals"></a>

## פורטלי Stalker / Ministra קלאסיים

בחרו **פורטלי Stalker** והזינו MAC שסיפק הספק וכתובת פורטל מלאה, למשל `http://provider.example/stalker_portal/c/`. כתובות `/c/index.html`, `/stalker_portal`, `/server/load.php`, `/load.php` ו־`/portal.php` בוחרות בפרוטוקול MAG הקלאסי. הגדרות קיימות עם כתובת שרת בלבד ממשיכות ב־JSON-RPC. הספק טוען פרופיל, סוגות וערוצים חיים מחולקים לעמודים באמצעות ליבת Stalker המשותפת, ואז מגלה ברקע סרטים ופרקים מקוננים בפרוטוקול הקלאסי `type=vod`. נתיבי תיקיות הופכים לקטגוריות ברשימת הערוצים הרגילה; התיאורים והכרזות הזמינים והמועדפים הגלובליים בעלי ההפניות היציבות משתמשים באותו ממשק מדיה. ראו [התנהגות הקטלוג ומגבלותיו](docs/stalker-media.md).

בקשות דפדפן בהתקנה באירוח עצמי עוברות ב־`/stalker/api` של השרת המלווה; יישומים ילידיים משתמשים בתעבורת HTTP הקיימת שלהם. דפדפנים באירוח דורשים נתיבים שהוגדרו במפורש דרך [הממסר הייעודי](docs/stalker-relay.md). יש לעדכן יחד את משאבי הדפדפן והשרת.

ניגון חי פותר פקודות ערוץ זמניות בפתיחת זרם; החלפת ערוץ, עצירה, PiP והחלפת ספק מבטלים פתרונות שהתיישנו. פקודות HTTP(S) מפורשות שאינן זמניות מנוגנות ישירות. EPG קצר נתמך. הספק הזה אינו חושף את ארכיון הפורטל הקלאסי או את הפרוטוקול הנפרד `type=series`. התנהגות ארכיון/מדריך JSON-RPC הקיימת נשמרת. פורטלי LAN פרטיים בנתיב השרת המלווה דורשים ערך מדויק ב־`OTTPLAY_PROXY_LAN_ORIGINS`, כמו יתר נתיבי הפרוקסי שלו.

הדגמת Infomir הציבורית היא `http://middleware-stalker.com/stalker_portal/c/`. ב־2026-09-26 היא החזירה שלושה פריטי קטלוג חי, אבל נקודות המדיה לא היו זמינות; השתמשו בפורטל/מדיית בדיקה נשלטים לבדיקות נסיגה בניגון.

<a id="m3u-stream-proxy-header-smoke"></a>

## בדיקת כותרות פרוקסי זרם M3U

משווה כותרות בקשות למקור ש־`POST /m3u/cp.php` של מלווה Mode A מוסיף בעת שליפת כתובת echo נשלטת (ברירת מחדל mock מקומי — ללא ספקי IPTV או סודות).

החוזה (מתוך `src-rs/core/src/m3u.rs` + `archive/server.py`):
- מוסיף **User-Agent** בלבד (ברירת מחדל `OTT-play-FOSS/1.0`, או תצורות `webos` / `tizen` / `viera` / `mag` / `dune`).
- **אינו** מוסיף **Referer** (`M3UProxy` של Capacitor כן; Mode A לא).
- מסיר `@` מוביל מ־`url` (טופס jQuery של הספק).

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

<div lang="he" dir="rtl">

קוד יציאה: `0` הצלחה, `1` אינו מאזין, `2` אי־התאמת כותרות/HTTP, `3` שימוש/תלויות. בדיקה מקבילה ל־`smoke-modea-companion.sh` / `smoke-command-queue.sh`.

<a id="logo-concurrent-bench-smoke"></a>

## בדיקת ביצועים מקבילית לסמלים

בדיקת השהיה של `GET /logo/<id>.svg` במקביל (עם `?ch=` אופציונלי) מול מלווה Mode A. מדווחת ספירת הצלחה/כישלון ו־p50/p95/p99. ברירת המחדל היא עומס מעשי מקומי ב־CI (`CONCURRENCY=200`, `TOTAL=1000`); בדיקת עומס ממושכת של 10k היא אופציונלית (`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`).

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

<div lang="he" dir="rtl">

קוד יציאה: `0` הצלחה, `1` אינו מאזין / חיבור נכשל, `2` שיעור שגיאות גבוה, `3` שימוש. בדיקה מקבילה ל־`smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`.

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## בדיקת רענון / חימום מטמון XMLTV

מאמתת את התנהגות מטמון XMLTV/EPG במלווה Mode A מול `src-rs` בפועל (ללא API מומצא):

- `EPG_CACHE` שבזיכרון מוגש דרך `GET /epg/:hash` ← תמיד `{"epg_data":[...]}` (HTTP 200).
- תחילת התהליך שולפת `EPG_URLS` ברקע בלי לעכב התחלת HTTP; אחרי כל שליפה שהסתיימה ממתינים **2h** לפני הרענון הבא.
- שמירת SQLite אופציונלית עם `DATABASE_URL` (אין נקודת מצב מטמון ציבורית).
- `GET /health` ← `OK` מאשר מוכנות HTTP אחרי הפעלה מחדש אופציונלית. עם `--strict-epg` ו־`--epg-hash`, הבדיקה ממתינה גם ל־EPG לא ריק לערוץ באותה מכסת זמן `--warmup-timeout`.

המסלול הרגיל משתמש רק ב־curl — **אינו הורג תהליכים**. העבירו `--restart-cmd` / `RESTART_CMD` להריגה והפעלה מחדש אוטומטיות, או פעלו לפי שלבי `launchctl` הידניים ב־`--help`.

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

<div lang="he" dir="rtl">

קוד יציאה: `0` הצלחה, `1` אינו מאזין, `2` בדיקת תנאי / חימום נכשלו, `3` שימוש. בדיקה מקבילה ל־`smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`.

<a id="mode-a-e2e-play-path-smoke"></a>

## בדיקת מסלול ניגון E2E ב־Mode A

בדיקת **מסלול ניגון / מוכנות זרם** מצד המלווה (HTTP בלבד — **לא** E2E עם ממשק גרפי מוצג). מול מלווה Mode A פעיל היא בודקת:

- נגישות health או index
- משאבים סטטיים של מעטפת הנגן (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`)
- `GET /epg/<hash>.json` אופציונלי כאשר `EPG_HASH` מוגדר
- `POST /m3u/match-channels` עם נתוני JSON ללא סודות (רשימה ריקה + ערוץ סינתטי אחד)
- **ניגון** פרוקסי: `POST /m3u/cp.php` למדיית בדיקה נשלטת (רשימת HLS מקומית כברירת מחדל או `MEDIA_URL`) ואימות HTTP 200 + גוף לא ריק / `Content-Type` צפוי (הבתים הראשונים דרך הפרוקסי)

ללא פרטי IPTV פרטיים. בדיקה מקבילה ל־`smoke-modea-companion.sh` (נוכחות), `smoke-m3u-stream-proxy-headers.sh` (UA/Referer), `smoke-xmltv-cache-refresh.sh`.

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

<div lang="he" dir="rtl">

קוד יציאה: `0` הצלחה, `1` אינו מאזין, `2` בדיקת תנאי נכשלה, `3` שימוש/תלויות.

<a id="capacitor-device-smoke-mode-b"></a>

## בדיקת מכשיר Capacitor (Mode B)

**רשימת בדיקה** לסימולטור/אמולטור (ומכשיר אמיתי אופציונלי) ל־Mode B Cap — לא HTTP של מלווה Mode A. אדם מסמן הצלחות UI; כלי העזר מבצע אוטומציה של כלי בנייה / תיקיות ילידיות / curl רך לתור פקודות.

</div>

<div dir="ltr">

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

</div>

<div lang="he" dir="rtl">

פרטים: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md). בדיקה מקבילה ל־`smoke-command-queue.sh` (loopback של Cap) — אין לבלבל עם Mode A לעיל.

<a id="tauri-desktop-smoke-mode-b"></a>

## בדיקת שולחן עבודה Tauri (Mode B)

רשימת בדיקה וכלי עזר ל־Mode B Tauri (חלון / ניגון ערוץ / PiP). לא HTTP של מלווה Mode A ולא בדיקת מכשיר Cap.

</div>

<div dir="ltr">

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

</div>

<div lang="he" dir="rtl">

פרטים: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md). פרטי מפתח Apple הם אופציונליים לבדיקה מקומית; השתמשו ב[חתימת ad-hoc](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials) ליישום Mac ארוז. קבלה אנושית עדיין כוללת הפעלה, ניגון ו־PiP.

<a id="docker"></a>

## Docker

תמונות מרובות ארכיטקטורה (amd64/arm64) נבנות כארכיוני OCI מועמדים. פרסום לרישום מקדם את הארכיון היציב שאושר ל־Docker Hub ללא בנייה מחדש; ראו [מדריך התפעול](docs/release-workflow.md).

קובץ השרת הבינרי נבנה על **musl** (Alpine) ונשלח על Alpine — הוא **אינו** דורש GLIBC_2.38+. כך `alvit/ottplay-foss` פועל ב־Docker של Synology DSM (x86_64) ובמארחים אחרים עם glibc ישן.

</div>

<div dir="ltr">

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

</div>

<div lang="he" dir="rtl">

תגי הרישום היציבים משתמשים ב־`X.Y.Z`. עדכון `latest` הוא אפשרות מפורשת ונפרדת לאחר פרסום תמונה מתויגת; דחיפות main ותגי Git אינם מפרסמים תמונות.

<a id="build-from-source"></a>

## בנייה מהמקור

כללי התחום של הנגן מגיעים מתוצר Kotlin רב־פלטפורמי מוצמד ב־`vendor/ottplay-core.js`. החלטות מדריך, ארכיון, רשימה, ספק, מצב עמיד וניגון חולקות יישום עם FOSS2 ו־Android הילידי. מתאמי דפדפן/טלוויזיה, Swift ו־Rust מחזיקים ב־API מכשיר, מקודדים, רשת והשפעות ממשק. תוצר הדפדפן שומר על תחביר ES5 ואתחול API מדור קודם הנתמך. `npm test`, `check:bundle` ו־`check:es5` מאמתים שילוב; manifest התוצר מתעד גיבובי מקור ופלט.

מאמתי פרוטוקול שרת הבקרה ו־SWOP נוצרים מהסכמה המתויגת `contracts/ottplay-wire-v1.json`. קבלות ייצור נבדקות ונתוני תאימות קבועים מונעים עותקי מדיניות ייעודיים לצרכן.

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

<div lang="he" dir="rtl">

<a id="device-detection"></a>

## זיהוי מכשיר

הנגן תומך ב־24 סוגי מכשיר. הזיהוי מתחיל בכתובת `/f/{device_id}/` ואז ב־User-Agent.

| מזהה מכשיר | מכשיר |
|---|---|
| `pc` | דפדפן מחשב |
| `pc2` | נגן רשת videojs |
| `nodejs` | יישום Windows (Electron) |
| `lg/webos` | טלוויזיות LG WebOS |
| `samsung/tizen` | טלוויזיות Samsung Tizen |
| `samsung/maple` | טלוויזיות Samsung Orsay |
| `mag` | ממירי Infomir MAG |
| `dune` | ממירי Dune HD |
| `android` | Android TV / טאבלטים |
| `hbbtv` | טלוויזיות HbbTV |
| `panasonic` | טלוויזיות Panasonic Viera |
| `philips` | טלוויזיות Philips |
| `sony` | טלוויזיות Sony |
| `sharp` | טלוויזיות Sharp |
| `toshiba` | טלוויזיות Toshiba |
| `hisense` | טלוויזיות Hisense |
| `skyworth` | טלוויזיות Skyworth |
| `tcl` | טלוויזיות TCL |
| `vewd` | מכשירי Vewd |
| `spark` | מקלטי Spark |

<a id="push-command-system"></a>

## מערכת פקודות דחיפה

לשירות מרובה מכשירים נפרד, השתמשו ב־[OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) ובחלק **שרת פקודות** תחת **הגדרות ← שליטה מרחוק**. הזינו כתובת/IP ואת קוד הגישה של הנגן; שמירת שניהם מתחילה תשאול אוטומטי לפקודות עוצמה, ערוץ ואחרות. IP ללא יציאה משתמש ב־HTTP 8081. נקו כתובת או בחרו **ניתוק** לעצירה. החיבור היוצא תומך במסירה מאושרת ואינו דורש מאזין מקומי. ראו [פרטי חיבור ותאימות](docs/remote-command-server.md). הדוגמאות הבאות מתארות את מצב הפרוקסי/מאזין המקומי הקיים.

האפשרות **חיפוש שרת פקודות** יכולה לאתר בקר ולבקש את אישור המפעיל בלי להעתיק אסימון גישה של המכשיר. Tauri בודק תחילה את ה-DNS המובנה ויכול לעבור לפרופיל פריסה שהוגדר במפורש אם התוצאה ריקה; נגני דפדפן, LG ו-Capacitor משתמשים במסלול פרופיל הדפדפן. אפשר לארח את נתוני הגילוי של Home ב-here.now בנפרד מהבקר. גרסאות כלליות אינן כוללות אוטומטית את פרופיל Home הזה, ועדכון אינו מחליף חיבורים שמורים. ראו [התנהגות לפי פלטפורמה, הגדרת פרופיל ופתרון בעיות](docs/remote-command-server.md#discovery-and-one-time-approval).

שליטה מקומית ב־HTTP **כבויה כברירת מחדל** בנגן דפדפן/OTT server, ב־Tauri וב־Capacitor. הפעילו ב־**הגדרות הנגן ← שליטה מרחוק** ליצירת קוד מכשיר סודי. הפקודות הן אובייקטי JSON עם שדה `"command"`; בקשות HTTP דורשות `Authorization: Bearer <device-code>`.

<a id="architecture"></a>

### ארכיטקטורה

<a id="local-command-url-recommended"></a>

#### כתובת פקודות מקומית (מומלץ)

הפעילו **שליטה מקומית ב־HTTP** תחת **הגדרות הנגן ← שליטה מרחוק**, העתיקו את **קוד המכשיר** והגדירו אותו בפרוקסי להלן. הגדירו **כתובת פקודות מקומית** לנקודת הפקודות של הפרוקסי. כאשר מופעל, הנגן מתשאל כתובת זו כל 10 שניות עם קוד המכשיר בכותרת Authorization. הזנת כתובת בלבד אינה מפעילה שליטה בפקודות.

</div>

<div dir="ltr">

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

</div>

<div lang="he" dir="rtl">

<a id="device-uuid"></a>

#### UUID של מכשיר

UUID המכשיר הקיים (למשל `dev_a1b2c3d4e5`) הוא מטא־נתוני ניתוב ציבוריים, לא אמצעי אימות. **קוד המכשיר** הנפרד נוצר באופן מאובטח כששליטת HTTP מופעלת ונשאר במכשיר; הוא אינו מועתק דרך הגדרות ענן. כיבוי השליטה עוצר תשאול/מאזינים. הפעלה חוזרת יוצרת קוד חדש: עדכנו את הפרוקסי והשילובים לביטול הקוד הישן.

Tauri ו־Capacitor מפעילים מאזין HTTP ב־loopback רק אחרי הסכמה זו בהגדרות. פרוקסי העברה חייב לשלוח למאזין את הקוד המוצג כאסימון Bearer. Mode A משתמש בתור `local_proxy.py` שמוגדר בנפרד ומתואר בהמשך.

<a id="remote-text-entry-swop"></a>

#### הזנת טקסט מרחוק (swop)

מטרה: להקליד בטלפון עבור ♥™ / מקלדת וירטואלית מרוחקת כשהטלוויזיה והטלפון נמצאים ב**רשתות שונות**, באמצעות העברת הפעלה של Cloudflare Worker.

- מאגר Worker: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop)
- **הרשאת התקנה:** הנגן שולח לממסר `/swop` מאותו מקור בשרת שלו. השרת מוסיף אסימון התקנה פרטי; כל לקוח במקור השרת הרשום יכול להשתמש בהזנת טקסט מרחוק. UUID של מכשירים מזהים הפעלות ואין צורך ברשימת הרשאה לכל מכשיר.
- הגדרה: `swopBaseUrl` (ריק = ♥™ מציג ״לא מוגדר״ / אינו פועל). ערכו תחת **הגדרות ← שליטה מרחוק** (מקש **2**) או הזריקו דרך `/local/swop.json` המוחרג מ־Git בהתקנות מפעיל.
- `POST /session` כולל `clientId`, `caption` ו־`draft`; `POST /val` כולל `clientId`, `code` ו־`sessionToken` שהוחזר. כתובת הטלפון מכילה אסימון כתיבה נפרד. אסימוני קריאת ההפעלה נשארים בזיכרון הדפדפן.
- **התקנה מקומית:** הגדירו `SWOP_BASE_URL` ו־`SWOP_INSTALLATION_TOKEN` לאחר רישום ההתקנה ומקורות LAN/localhost המדויקים ב־Worker. `scripts/install-ottplay-local-service.sh` שומר אותם ב־launchd plist פרטי במצב 0600. `/local/swop.json` הציבורי מכיל רק `{"swopBaseUrl":"/swop"}`. לעולם אל תכניסו אסימון התקנה למשאבים ציבוריים.
- **אירוח סטטי:** הגדירו פרוקסי מאומת בצד השרת לאותן שתי נקודות. שמרו את אסימון ההתקנה בסודות שירות האירוח. העתקת קובצי הנגן הציבוריים אינה מעתיקה את סוד השרת.

> שרת OTT המרכזי משאיר את `/api/webhook/commands`, `/webhook/poll`, `/webhook/notify` וכינויי health של פקודות כבויים בכל שיטות HTTP. השתמשו בשרת הפקודות הנפרד או ב־`local_proxy.py` מאומת שהוגדר במפורש ל־Mode A; אין לשרת המרכזי תור פקודות שידור כללי.

<a id="available-commands"></a>

### פקודות זמינות

כל הדוגמאות משתמשות ב־`http://192.168.1.50:8081/api/webhook/commands` ככתובת פרוקסי מקומית. החליפו לכתובת שלכם והגדירו `OTTPLAY_QUEUE_HTTP_TOKEN` ל**קוד המכשיר** המוצג אחרי הפעלת HTTP בהגדרות. הפרוקסי חייב להיות מוגדר עם אותו קוד.

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — הצגת הודעה קופצת

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

</div>

<div lang="he" dir="rtl">

| שדה | סוג | ברירת מחדל | תיאור |
|---|---|---|---|
| `message` | string | חובה | טקסט להצגה |
| `popup_duration` | number | 5 | שניות תצוגה (פינה ימנית עליונה) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — החלפת ערוץ לפי מיקום ברשימה

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

</div>

<div lang="he" dir="rtl">

| שדה | סוג | ברירת מחדל | תיאור |
|---|---|---|---|
| `channel_number` | number | חובה | מיקום ערוץ ברשימה החל מ־1 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — החלפת ערוץ לפי שם (חלקי)

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

</div>

<div lang="he" dir="rtl">

חיפוש תת־מחרוזת ללא הבדל בין אותיות גדולות לקטנות. ההתאמה הראשונה נבחרת.

| שדה | סוג | ברירת מחדל | תיאור |
|---|---|---|---|
| `channel_name` | string | חובה | שם ערוץ או חלק ממנו |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — מעבר לערוץ אקראי

פקודה ותיקה זו בוחרת ערוצים מותרים מתוך הרשימה או הקטגוריה הנוכחית. מספרי הערוצים והטווחים מציינים מיקומים באותה רשימה; ראו [מדיניות הבחירה האקראית הבטוחה](docs/remote-command-server.md#safe-random-playback).

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

<div lang="he" dir="rtl">

| שדה | סוג | ברירת מחדל | תיאור |
|---|---|---|---|
| `random_range` | [start, end] | הרשימה הנוכחית | טווח החל מ־1 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — החלפת ספק IPTV

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

</div>

<div lang="he" dir="rtl">

| שדה | סוג | ברירת מחדל | תיאור |
|---|---|---|---|
| `provider` | number | חובה | אינדקס במערך ספקים (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — טעינת רשימת M3U חדשה

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

</div>

<div lang="he" dir="rtl">

| שדה | סוג | ברירת מחדל | תיאור |
|---|---|---|---|
| `playlist` | string | חובה | כתובת רשימת M3U |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — עדכון תצורת ספק

</div>

<div dir="ltr">

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

</div>

<div lang="he" dir="rtl">

| שדה | סוג | ברירת מחדל | תיאור |
|---|---|---|---|
| `provider_settings` | string | חובה | מחרוזת JSON עם תצורת ספק |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — קביעת עוצמת קול או שינויה

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

<div lang="he" dir="rtl">

מתעלם בשקט בלקוחות ללא תמיכת בקרת עוצמה.

| שדה | סוג | ברירת מחדל | תיאור |
|---|---|---|---|
| `volume` | number | — | רמה מוחלטת 0-100 |
| `volume_step` | number | — | שינוי יחסי, כגון +10 או -5 |

<a id="player-standby-restart-and-exit"></a>

#### המתנה, הפעלה מחדש ויציאה מהנגן

תור webhook ללא אישור של הפרוקסי המקומי אינו תומך ב־`exit_player` או בבקשות standby/wake מטיפוס מוגדר. חברו את הנגן ל[שרת הפקודות](docs/remote-command-server.md) והשתמשו ב־CLI שלו:

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

<div lang="he" dir="rtl">

החליפו `d1` בכינוי הנגן הרשום. `stop` הוא כינוי ל־`standby`; `start` ו־`wake` כינויים ל־`go`. Go דורש נגן פועל ומחובר; אינו מפעיל יישום סגור או מעיר מכשיר לא מקוון. דפדפן או טלוויזיה ללא יציאה ילידית מדווחים שהיציאה אינה נתמכת. המתנה משאירה תשאול מרחוק פעיל ואינה משהה עבודת מארח או שרת משותף לא קשורה.

אחרי standby/go בדקו `ott d1 status` למצב המתנה/רקע ואמתו חידוש ניגון בנפרד. אחרי טעינת נגן מחדש אמתו runtime חדש באמצעות `ott d1 doctor`. אחרי יציאה ודאו במערכת ההפעלה שתהליך היישום נסגר; פסק זמן מרחוק אינו מוכיח יציאה. קבלת פקודה בלבד אינה מאשרת תוצאות אלה.

<a id="local-proxy-server"></a>

## שרת פרוקסי מקומי

`local_proxy.py` הוא תור פקודות עצמאי ומאומת לנגן אחד. הפעלתו הרגילה מסתיימת בלי לפתוח יציאה. כל מופע משתמש בקוד שהנגן יצר; למספר נגנים השתמשו במופעים/יציאות נפרדים. פרמטר שאילתה `device_id` מתקבל כמטא־נתוני תאימות ואינו מאמת או בוחר מכשיר אחר.

<a id="start-the-proxy"></a>

### הפעלת הפרוקסי

1. הפעילו **שליטה מקומית ב־HTTP** בנגן והעתיקו את **קוד המכשיר**.
2. במארח הפרוקסי הגדירו את הקוד והמקור המדויק שמגיש את הנגן (סכמה, מארח ויציאה, ללא נתיב):

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

<div lang="he" dir="rtl">

3. הגדירו **כתובת פקודות מקומית** בנגן ל־`http://192.168.1.50:8081/api/webhook/commands`.

כתובת ההאזנה הרגילה היא `127.0.0.1`; הדוגמה מאפשרת LAN במפורש. `OTTPLAY_QUEUE_HTTP_ORIGINS` היא רשימת מקורות דפדפן מדויקים, מופרדים בפסיקים. השתמשו ב־reverse proxy של HTTPS כשהנגן מוגש ב־HTTPS, כדי שכללי תוכן מעורב יתירו תשאול. שמרו קוד בסוד ומחוץ לכתובות. כאשר נוצר קוד חדש, הפעילו מחדש את הפרוקסי עם הערך החדש; כיבוי הנגן בלבד אינו עוצר תהליך פרוקסי המנוהל בנפרד.

<a id="endpoints"></a>

### נקודות קצה

| שיטה | נתיב | תיאור |
|---|---|---|
| `POST` | `/api/webhook/commands` | הוספת פקודה לתור |
| `GET` | `/api/webhook/commands` | משיכת פקודות בתור (תשאול נגן) |
| `POST` | `/webhook/notify` | כינוי תאימות מאומת |
| `GET` | `/webhook/poll` | כינוי תאימות מאומת |

שליחה וריקון דורשים שניהם קוד Bearer תואם למכשיר. אין נקודת שידור ללא אימות. פקודות פגות אחרי 60 שניות; כל פרוקסי שומר עד 50 פקודות.

הפרוקסי מטפל בעד 16 חיבורים במקביל, כך שחיבור דפדפן סרק או בקשה חלקית אינם מעכבים פקודות אחרות. לכל socket זמן חוסר פעילות של חמש שניות; חיבורים נוספים נסגרים כשכל העובדים תפוסים. הוספה לתור וריקונו אטומיים בין עובדים.

<a id="smoke-script-all-modes"></a>

### סקריפט בדיקת עשן (כל המצבים)

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

<div lang="he" dir="rtl">

אמולטור/מכשיר Android: תחילה `adb forward tcp:18081 tcp:18081`. Cap/Tauri הם loopback בלבד — השתמשו בפרוקסי Mode A זה ל־Home Assistant ב־LAN. פרטים: `docs/capacitor-mobile.md`, סעיף Smoke test.

<a id="cors"></a>

### CORS

הפרוקסי מתיר בקשות דפדפן רק מ־`OTTPLAY_QUEUE_HTTP_ORIGINS`. בקשות preflight מסוג `OPTIONS` ממקור מותר אינן דורשות אסימון; כל GET/POST ממשי דורש קוד Bearer למכשיר. מקורות wildcard ו־`null` אינם מתקבלים. Home Assistant וקוראים אחרים שאינם דפדפן יכולים להשמיט Origin אך עדיין צריכים אימות.

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### דוגמה: webhook של Home Assistant ← פרוקסי מקומי ← נגן

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

<div lang="he" dir="rtl">

<a id="home-assistant-automation-examples"></a>

### דוגמאות אוטומציה של Home Assistant

דוגמאות ההודעה, הערוץ והעוצמה משתמשות בפרוקסי המקומי. הגדירו `ottplay_device_authorization` ב־`secrets.yaml` של Home Assistant ל־`Bearer <device-code>` עם הקוד המוצג בנגן הפעיל.

המתנה לילית משתמשת ב[שרת הפקודות](docs/remote-command-server.md) הנפרד. החליפו את כתובת הדוגמה ו־`DEVICE_UUID` בכתובת הבקר ומזהה המכשיר הרשום; כינוי CLI מקומי `d1` אינו מזהה מכשיר. הגדירו `ottplay_control_authorization` ל־`Bearer <controller-admin-token>` ב־`secrets.yaml`. זהו סוד נפרד מקוד הפרוקסי המקומי. ראו תיעוד Home Assistant ל־[RESTful Command](https://www.home-assistant.io/integrations/rest_command/) ול־[secrets](https://www.home-assistant.io/docs/configuration/secrets/).

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

<div lang="he" dir="rtl">

`standby_request` מכיל תגובת HTTP למעקב האוטומציה. HTTP 202 פירושו רק הוספה לתור: שמרו `content.id` ותשאלו `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` עם אותו סוד בקר לקבלת תשובת הנגן. בקשת `status` חדשה צופה ב־`player.standby` וב־`player.background`; המתנה פעילה עם `suspended` ואפס ממתינים מאשרת שכל העבודה שהנגן עוקב אחריה התרוקנה. ליציאה מהמתנה השתמשו באותה בקשה מטיפוס מוגדר עם `"operation":"wake"` (`ott d1 go`). אל תחזרו בעיוורון על שינוי אחרי פסק זמן. ראו [API בקשה/תגובה](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) ו[משמעות המתנה](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake) של הבקר.

<a id="server-api-reference"></a>

## מדריך API של השרת

<a id="webhook-endpoints-rust-ottplay-server"></a>

### נקודות Webhook (Rust `ottplay-server`)

שרת Rust וחלופת Python שהועברה לארכיון דוחים נקודות פקודה ב־HTTP 403. `/api/webhook/commands`, `/webhook/notify`, `/webhook/poll` וכינויי בריאות הפקודות אינם מוסיפים, משדרים או מרוקנים פקודות. API המשוב הכללי אינו יכול לעקוף נתיבים שמורים אלה. מסירת פקודות Mode A משתמשת בשרת נפרד או בפרוקסי מקומי מאומת שתוארו לעיל.

<a id="other-endpoints"></a>

### נקודות אחרות

| שיטה | נתיב | תיאור |
|---|---|---|
| `GET` | `/epg/<hash>.json` | נתוני EPG לערוץ |
| `GET` | `/logo/<id>.svg` | סמל ערוץ שנוצר |
| `GET` | `/version/<path>` | גיבוב גרסת קובץ |
| `POST` | `/m3u/match-channels` | התאמת ערוץ ל־EPG |
| `POST` | `/m3u/match-logos` | התאמת סמלי ערוצים |
| `POST` | `/m3u/cp.php` | פרוקסי זרם |
| `GET/POST` | `/feedback/` | רישום משוב |
| `GET` | `/tmdb/*` | פרוקסי TMDb API |

<a id="epg"></a>

### EPG

</div>

<div dir="ltr">

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

</div>

<div lang="he" dir="rtl">

<a id="project-structure"></a>

## מבנה הפרויקט

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

<div lang="he" dir="rtl">

<a id="stb-key-mappings"></a>

## מיפויי מקשים ל־STB

- **Samsung Tizen**: `RETURN=10009`, `ENTER=13`, צבעים 403-406
- **Samsung Maple**: dpad 4/5/6/8, קודי SDK מקוריים
- **LG WebOS**: `RETURN=461`, צבעים תואמי HbbTV
- **LG NetCast**: `RETURN=8`, קודי HbbTV
- **MAG**: `RETURN=8`, gSTB API ל־MAC
- **Dune HD**: קודים רגילים, Dune API
- **Android TV**: קודי Android (`BACK=4`, `DPAD_*` 19-22, `ENTER=66`)
- **HbbTV/Panasonic/Philips/Sony/ואחרים**: קודי HbbTV (`RED=403`, `BLUE=406`, `VOL_UP=447`)

<a id="documentation"></a>

## תיעוד

- [ויקי התיעוד](./docs/wiki/Home.he.md) / [Вики по-русски](./docs/wiki/Home.ru.md) — ניווט לפי משימה וכללי תחזוקה.
- [דוח יישום](./docs/implementation-report.he.md) / [Процесс и результат](./docs/implementation-report.ru.md) — תרשימים צבעוניים, התנהגות מאומתת, עלות מדודה ושערי שחרור.
- [מדריך אספקה](./docs/roadmap-delivery.he.md) / [Руководство по новым возможностям](./docs/roadmap-delivery.ru.md) — תכונות, מגבלות ואימות.
- [התחלה ב־88 שפות ממשק](./docs/readme/README.md) — נוצר מהתרגומים המסופקים; המדריך הראשי ומדריכי התכונות המקבילים זמינים ב[־24 שפות תיעוד](docs/manual-translations.md).
- [מגבלות איכות והתאוששות בשידור חי](./docs/playback-stream-policy.he.md) / [По-русски](./docs/playback-stream-policy.ru.md).
- [מיפוי XMLTV ידני ונגישות קלאסית](./docs/guide-binding-accessibility.he.md) / [По-русски](./docs/guide-binding-accessibility.ru.md).
- [בדיקת שמע/וידאו מתארחת](./docs/audio-video-check.he.md) / [По-русски](./docs/audio-video-check.ru.md).
- [ספריית מדיה Xtream](./docs/xtream-media.he.md) / [По-русски](./docs/xtream-media.ru.md).
- [העברה בין מכשירים מאותו מקור](./docs/remote-handoff.he.md) / [По-русски](./docs/remote-handoff.ru.md).
- [הגדרות מקומיות ניתנות לשחזור](./docs/settings-recovery.he.md) / [По-русски](./docs/settings-recovery.ru.md).
- [דורות דפדפן, מערכות הפעלה ובדיקות מדויקות למועמד שחרור](docs/browser-compatibility.he.md) / [По-русски](docs/browser-compatibility.ru.md).

- [ארכיטקטורת הנגן](./docs/architecture.md) — בעלות זמן ריצה, שילוב ספק, ניגון, מדריך, מתאמי מכשיר וחוזי בנייה.
- [תהליך בניית ES5 קלאסי](./docs/build-pipeline.md) — הידור, בדיקות תאימות ומגבלות גודל תוצרים.
- [שמות משאבי זמן ריצה והגירת פריסה](./docs/asset-layout.md) — נתיבים תיאוריים משותפים לרשת ולחבילות הילידיות.
- [סביבת עבודה מרחוק](./docs/remote-workbench.md) — בדיקת UI/מדיה, קבלות פעולות וראיות שמורות.
- [אבחון זמן ריצה](./docs/runtime-debug.md) — היסטוריית שגיאות, מוני פריימים/לולאות, מדדים ילידיים של Capacitor/Tauri וניפוי שרת.
- [אספקה מקומית ל־macOS](./docs/macos-local-delivery.md) — בניות מעותק המאגר, התקנה מקומית ואימות.

<a id="license"></a>

## רישיון

[MIT](LICENSE) — חופשי ובקוד פתוח. תוכן ספק ותלויות צד שלישי שומרים על זכויותיהם ורישיונותיהם.

היישום הנפרד [OTTPlay native webOS](docs/native-webos.md), המבוסס על PlxNative, מופץ תחת **GPL-3.0-or-later** עם קוד המקור התואם.
רישיון MIT שבשורש הפרויקט אינו משנה את הרישיון של היישום המקומי הזה או של התיקונים שלו.

<a id="desktop-updater--notarization-mode-b"></a>

## מעדכן מחשב / notarization (Mode B)

[מדריך חתימה ומעדכן למחשב](docs/tauri-updater-notarize.md) מתאר חתימת ad-hoc ב־macOS, אפשרות Developer ID/notarization ואימות חבילה. CI לשחרור משתמש ב־ad-hoc ללא פרטי Apple. חתימת המעדכן נפרדת; עדכונים אוטומטיים לייצור עדיין אינם מוגדרים.

<a id="local-mac-build-helpers"></a>

## כלי עזר לבנייה מקומית ב־Mac

ראו [docs/local-build-scripts.md](docs/local-build-scripts.md).

<a id="privacy"></a>

## פרטיות

קראו [מדיניות פרטיות](docs/privacy-policy.md) למידע על הגדרות מקומיות, שירותים מוגדרים והבחירות שלכם. קשר לפרטיות ותמיכה: [alvit.work@gmail.com](mailto:alvit.work@gmail.com).

Studio 2026 הוא מראה ברירת המחדל. Classic ו־PLi-HD נשארים ניתנים לבחירה והעדפות המשתמש השמורות נשמרות. ראו [הגדרות ממשק](docs/interface-settings.md). ערכת PLi-HD נותנת קרדיט ל־Vali, littlesat, VU+NL, Milo ולתורמים המקוריים. ראו [קרדיטים והיסטוריית עיצוב הממשק](docs/interface-history.md) להיסטוריה באנגלית וקישורי מקור, הזמינים גם מתפריט המידע של הנגן.

<a id="demo-video-editing"></a>

## עריכת סרטון הדגמה

השתמשו ב[תהליך video-use](docs/demo-video.md) המקומי להכנה ולעריכה של הקלטות הדגמה. כלי העזר שומר את כל המדיה שנוצרת מחוץ ל־Git.

<a id="plex-media-library"></a>

## ספריית מדיה Plex

כל נגן יכול להתחבר לחשבון Plex או ל־Plex Media Server באמצעות ספק **Plex**. השילוב משתמש ב־Plex; Synology הוא מארח אפשרי אחד לשרת המדיה. כל הסרטונים וקטעי המוזיקה הזמינים מופיעים אוטומטית ברשימת הערוצים; בחירת קטגוריה מסננת לפי ספרייה, תיקייה או סדרה. הניגון מתחיל מהאצווה הראשונה השמישה עם טעינת רקע, חיפוש רגיל ופעולות ערבוב/חזרה, בלי להגדיר Plex בשרת OTT. ראו [כניסה ל־Plex וניגון ישיר](docs/plex-provider.md).

![מחזור טעינת Plex, ניווט קבצים וכיבוי](docs/images/plex-playback-lifecycle.svg)

[סקירת האמינות המאוירת](docs/plex-provider.md#reliability-review-process-and-results) מסבירה כללי טעינה וביטול, תיקונים לקטלוגים מלאים ולהחלפת קבצים, ותוצאות האימות המדודות ב־Chromium/WebKit.

<a id="related-repositories"></a>

## מאגרים קשורים

- [ottplay-core](https://github.com/open-ott-play/ottplay-core) אחראי ללוגיקת התחום המשותפת JVM/ES5, חוזי התקשורת ולקוח FOSS2. הנגן צורך תוצרים שנוצרו; לשינויים משותפים פעלו לפי מדריך האספקה של core.
- [ottplay-android](https://github.com/open-ott-play/ottplay-android) הוא יישום Kotlin/Compose ילידי נפרד עם זהות התקנה ושחרור משלו.
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server) מספק פקודות מרחוק באירוח עצמי; [ottplay-swop](https://github.com/open-ott-play/ottplay-swop) מספק תעבורת טקסט אופציונלית מבוססת Worker.
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine) אחראי לפרופיל המתארח של הדגמת הדפדפן, למדיה ולאימות הפרסום.

<a id="project-maintenance"></a>

## תחזוקת הפרויקט

ראו [דרישות תרומה ובדיקות](CONTRIBUTING.md), [מדיניות דיווח אבטחה](SECURITY.md), [תכנון אבטחה](docs/security-design.md) ו[ראיות OpenSSF והקריטריונים הנותרים](docs/openssf-evidence.md).

</div>
