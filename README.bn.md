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

ইন্টারনেট ছাড়া স্থানীয় ফাইল: [স্থানীয় ভিডিও ও অফলাইন প্লেব্যাক](docs/offline-media.md) দেখুন।

[![দৃষ্টিকোণ থেকে OTT-play FOSS-এর চ্যানেল তালিকা](docs/images/hero.png)](docs/images/studio-2026-default.png)

*কৃত্রিম চ্যানেল ও অনুষ্ঠান তথ্যসহ বিদ্যমান Studio 2026 ইন্টারফেসের স্ক্রিনশট।
মূল সমতল দৃশ্য দেখতে ছবিটি খুলুন; এটি কোনো সক্রিয় সাবস্ক্রিপশনের ছবি নয়।
[ছবির উৎস ও পুনরায় তৈরি](docs/images/README.md)।*

[88 ভাষায় দ্রুত শুরু](docs/readme/README.md) · [ডকুমেন্টেশন উইকি](docs/wiki/Home.bn.md)

[![OpenSSF সর্বোত্তম অনুশীলন](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![ফাজিং: শুধু RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

পাবলিক রিলিজ প্রার্থীরা নেটিভ/সার্ভার XMLTV পার্সিং ও পোর্টাল অনুরোধ যাচাইয়ের জন্য সীমিত, বিচ্ছিন্ন ফাজিং অভিযান চালায়। [ফাজিংয়ের পরিসর, পুনরুৎপাদন ও রিলিজের প্রমাণ](FUZZING.md) দেখুন।

স্থানীয় Rust HTTP সার্ভারসহ স্বয়ংসম্পূর্ণ IPTV/OTT প্লেয়ার। Smart TV (LG WebOS, Samsung Tizen, Panasonic, Sony ইত্যাদি), সেট-টপ বক্স (Infomir MAG, Dune HD, Enigma2, Android TV) ও ডেস্কটপ ব্রাউজারে চলে।

রানটাইম স্তর, দায়িত্ব, প্রদানকারী সম্প্রসারণের পদ্ধতি ও যাচাই জানতে [স্থাপত্য ও অবদানকারীর নির্দেশিকা](docs/architecture.md) দিয়ে শুরু করুন। কোর/হোস্ট সীমানা ও সামঞ্জস্য চুক্তির জন্য [প্লেব্যাক সেশন ও প্রদানকারীর আয়ুষ্কাল](docs/playback-session-architecture.md) দেখুন।

<!-- ci-release-process:start -->
<a id="release-process"></a>

## রিলিজ প্রক্রিয়া

যাচাই এবং nightly, beta, RC ও stable-এ উন্নীত করার নিয়মের জন্য [রিলিজ কৌশল](RELEASING.md), আর স্থানীয় কমান্ডের জন্য [পরিচালনা নির্দেশিকা](docs/release-workflow.md) দেখুন।
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## ব্রাউজারে চালানো

[লাইভ ডেমো](https://player.ottplay.here.now/) খুলুন, অথবা নিচের নির্দেশনা অনুযায়ী ওয়েব প্লেয়ার বিল্ড করে পরিবেশন করুন।

[স্থানীয় macOS স্থাপনা](docs/local-http-deployment.md) 8443–8446 পোর্টে প্লেয়ারের HTTP origin দেয়। 8095 পোর্ট আর ব্যবহার করা হয় না।

প্রথম চালুর সময় চলমান পরীক্ষার প্যাটার্নের জন্য **ডেমো চেষ্টা করুন** বেছে নিন, অথবা নিজের M3U তালিকা বা প্রদানকারী কনফিগার করুন। পরে **প্রদানকারী পরিবর্তন → ডেমো** থেকেও এটি খোলা যায়।

ডেমো মোডে ইন্টারনেট লাগে, কিন্তু প্রদানকারীর অ্যাকাউন্ট লাগে না। শব্দহীন MP4 ও HLS পরীক্ষার চ্যানেল here.now-তে রাখা হয় এবং ওয়েব প্লেয়ার, Tauri, Capacitor ও OTT Server সেগুলো ভাগ করে ব্যবহার করে। পরিবর্তনের সময় বিদ্যমান প্রদানকারীর সেটিং থাকে। আলাদা **ছবি ও শব্দ পরীক্ষা** করতে পরিচালিত HTML5 ইঞ্জিনে নিষ্ক্রিয় থাকা বা লাইভ TV দেখার সময় **তথ্য → অডিও → চালান** খুলুন। এটি here.now-তে থাকা শব্দযুক্ত `av-v1.mp4` পরীক্ষার ফাইল ব্যবহার করে এবং ইন্টারনেট লাগে। ক্লিপটি প্লেয়ারের প্যাকেজে নেই, চালুর সময় কখনো আনা হয় না। VOD, আর্কাইভ এবং ডিভাইস ইঞ্জিন ওভাররাইড (PC2/Video.js ও নেটিভ ইঞ্জিনসহ) এই পরীক্ষার বাইরে; [ধাপ, প্রত্যাশিত শব্দ ও হোস্টিং চিত্র](docs/audio-video-check.bn.md) দেখুন।

ইনস্টল করা ডেস্কটপ ব্রাউজার উইন্ডো **Window Controls Overlay** সমর্থন করে: Chrome আলাদা শিরোনাম বার লুকিয়ে উইন্ডোর বোতাম ও অ্যাপ মেনু প্লেয়ারের ওপরে রাখতে পারে। ইনস্টল করা অ্যাপ খুলে Chrome বিকল্প দিলে **শিরোনাম বার লুকান** বেছে নিন; **শিরোনাম বার দেখান** স্বাভাবিক ফ্রেম ফেরায়। সাধারণ ট্যাব এবং TV/নেটিভ শেলের বিন্যাস আগের আচরণ রাখে। সমর্থিত ইনস্টল URL, বিদ্যমান শর্টকাট আপডেট ও যাচাইয়ের জন্য [ব্রাউজার উইন্ডোর নিয়ন্ত্রণ](docs/browser-window-controls.md) দেখুন।

মূল ভিডিও দৃশ্যে দশ সেকেন্ড এগোনো বা পেছানোর জন্য **Alt/Option + বাঁ/ডান** ব্যবহার করুন (macOS-এ **Command + বাঁ/ডান**-ও চলে), পূর্ণ পর্দা বা সাধারণ দৃশ্য উভয়েই। স্থানীয় ভিডিও, VOD ও সমর্থিত চ্যানেল আর্কাইভ ওয়েব, Tauri ও Capacitor-এ একই নিয়ন্ত্রণ ব্যবহার করে। [কিবোর্ড শর্টকাট ও সীমা](docs/browser-window-controls.md#playback-keyboard-shortcuts) দেখুন।

PC ইন্টারফেসে **R** বর্তমান তালিকার অন্য কোনো চ্যানেল বা ভিডিও এলোমেলোভাবে চালায়, তালিকার ক্রম না বদলে। মূল ভিডিও দৃশ্য ও চ্যানেল/ভিডিও তালিকায় কাজ করে; লেখা সম্পাদনা, ডায়ালগ, সেটিং ও কিয়স্কের সীমা অগ্রাধিকার রাখে। অন্য ডিভাইসের কী ম্যাপিং বদলায় না।

কৃত্রিম পরীক্ষার প্যাটার্ন `scripts/generate-demo-media.sh` দিয়ে আবার তৈরি করা যায় (FFmpeg লাগে); তৈরি মিডিয়া Git-এ উপেক্ষিত `.local-artifacts` ডিরেক্টরিতে থাকে।

<a id="features"></a>

## বৈশিষ্ট্য

- **প্লেব্যাক**: পরিচালিত HLS.js/Shaka গুণমানের সীমা, সীমিত পুনরুদ্ধার এবং প্রতিটি লাইভ চ্যানেলে সর্বোচ্চ তিনটি স্পষ্ট ব্যাকআপ URL-সহ HLS, DASH ও সাধারণ HTTP স্ট্রিম। আর্কাইভ/VOD কখনো লাইভ ব্যাকআপে যায় না; [গুণমান ও পুনরুদ্ধার](docs/playback-stream-policy.bn.md) দেখুন।
- **EPG**: XMLTV মেলানো, টাইম-শিফট/পুরোনো অনুষ্ঠান দেখা, অনুষ্ঠানের শিরোনাম খোঁজা (EPG-তে N5), অনুস্মারক এবং হোস্ট করা/নেটিভ XMLTV পথে নির্দিষ্ট চ্যানেলের ফিড/ID হাতে বাঁধা। [বন্ধন ও অভিগম্যতা](docs/guide-binding-accessibility.bn.md) দেখুন।
- **পছন্দের**: সমর্থিত হোস্টে কনফিগার করা সরবরাহকারী ও প্রোফাইল জুড়ে একটি ক্রমবদ্ধ [মিশ্র সংগ্রহ](docs/mixed-favorites.md), CLI দিয়ে বহনযোগ্য রপ্তানি/আমদানিসহ; অভিভাবকীয় PIN। বিকল্প মোডে প্রতিটি উৎসের পছন্দের তালিকা পাওয়া যায়।
- **সেটিং**: সেটিং ও পছন্দের JSON রপ্তানি/আমদানি, সমর্থিত localStorage ব্যাচের জন্য পূর্বাবস্থার জার্নাল, উৎস অনুযায়ী আর্কাইভ চালিয়ে যাওয়া এবং কন্ট্রোলারের কাজের জন্য সংরক্ষিত সেটিংয়ের নির্ভুল তুলনা। পুনরুদ্ধার একজন লেখক ধরে নেয়; কাস্টম স্টোরেজ অ্যাডাপ্টার যথাসম্ভব রোলব্যাক রাখে। [সেটিং পুনরুদ্ধার](docs/settings-recovery.bn.md) দেখুন।
- **যৌথ ইন্টারফেস**: OTT Server, Tauri ও Capacitor একই চ্যানেল তালিকার থিম ও দৃশ্যমানতার সেটিং ব্যবহার করে। ইন্টারফেস সেটিং হাইলাইট ও নির্বাচনের রং নিয়ন্ত্রণ করে; তালিকার সেটিং নাম, পিকন, বর্তমান অনুষ্ঠান, অগ্রগতি ও আর্কাইভ চিহ্ন নিয়ন্ত্রণ করে।
- **প্রদানকারী**: M3U/M3U8, Xtream লাইভ TV এবং [চাহিদামতো সিনেমা/সিরিজের ক্যাটালগ](docs/xtream-media.bn.md), [চলচ্চিত্র ও নেস্টেড পর্ব](docs/stalker-media.md) সমর্থনসহ Stalker/Ministra, Plex ও VPortal। প্রদানকারীর ক্ষমতা ও অ্যাকাউন্টের প্রবেশাধিকার উপলব্ধ আর্কাইভ ও মিডিয়া লাইব্রেরির সুবিধা নির্ধারণ করে।
- **পুশ কমান্ড**: webhook দিয়ে দূরনিয়ন্ত্রণ — চ্যানেল, প্রদানকারী, তালিকা বদলানো ও পপআপ দেখানো
- **দূর থেকে লেখা (swop)**: TV ও ফোন আলাদা নেটওয়ার্কে থাকলে Cloudflare Worker দিয়ে ফোনের কিবোর্ড (ইনস্টলেশন-অনুমোদিত সেশন; ভার্চুয়াল কিবোর্ডে ♥™)
- **ডিভাইসভিত্তিক রাউটিং**: একাধিক ডিভাইসের জন্য UUID-ভিত্তিক ঠিকানা
- **স্থানীয় প্রক্সি**: পুরোপুরি স্থানীয় স্বয়ংক্রিয় কাজের জন্য ঐচ্ছিক স্থানীয় কমান্ড সার্ভার (কেন্দ্রীয় সার্ভার লাগে না)
- **কন্ট্রোলার সংযোগ**: ডিভাইস/কাজ-সীমিত অপারেটর, ঐচ্ছিক স্থায়ী কমান্ড ফলাফল, আবার চালানো যায় এমন Local/Home প্রিসেট প্রয়োগ এবং সংশ্লিষ্ট [কন্ট্রোল সার্ভার](https://github.com/open-ott-play/ottplay-control-server) দিয়ে একই উৎসের লাইভ/আর্কাইভ হস্তান্তর। আপডেট করা কন্ট্রোলার/CLI লাগে; একটি স্বতন্ত্র ব্রাউজার ট্যাব এগুলো দেয় না।
- **টাইপযুক্ত দূরবর্তী পছন্দ**: সেটিংস খুঁজুন, সংরক্ষিত ও কার্যকর মান পড়ুন এবং রানটাইম, উৎস ও সংশোধন যাচাই করে সংরক্ষণ করুন; দেখুন [দূরবর্তী সেটিংস ও VPortal কনফিগারেশন](docs/remote-player-settings.md)।
- **ডিবাগ**: `?debug=1` দিয়ে ঐচ্ছিক প্লেব্যাক HUD/রিং লগ, সম্মতিনির্ভর দূরবর্তী পরীক্ষা এবং চাহিদামতো হোস্ট করা অডিও/ভিডিও পরীক্ষা
- **কিবোর্ড অভিগম্যতা**: নামযুক্ত ক্লাসিক ডায়ালগ, Tab ফোকাস ধরে রাখা ও ফেরানো, নির্বাচিত চ্যানেলের অর্থপূর্ণ তথ্য এবং বাধাহীন অবস্থার ঘোষণা। এই উন্নতি পূর্ণ WCAG বা ডিভাইস স্ক্রিন রিডার সম্মতি প্রমাণ করে না।
- **24 ধরনের ডিভাইস**: প্রতিটি ডিভাইসের রিমোট কন্ট্রোল কী ম্যাপিং
- **88 ইন্টারফেস ভাষা**: সংশ্লিষ্ট ক্যাটালগ, [অনূদিত দ্রুত শুরুর নির্দেশিকা](docs/readme/README.md) এবং [CLDR দিয়ে যাচাই করা কিবোর্ড বর্ণমালা](docs/localization.md)। মূল নির্দেশিকা ও জোড়া বৈশিষ্ট্যের নির্দেশিকা [24টি ডকুমেন্টেশন ভাষায়](docs/manual-translations.md) আছে; অন্যান্য প্রকৌশল নথি বিদ্যমান ভাষা রাখে।

[সরবরাহ নির্দেশিকা](docs/roadmap-delivery.bn.md) এই উৎস সংস্করণে বাস্তবায়িত বৈশিষ্ট্য, প্ল্যাটফর্মের সীমা, চিত্র ও যাচাই ব্যাখ্যা করে। ইনস্টল করা রিলিজ বা হোস্ট করা স্থাপনা পুরোনো সংস্করণ ব্যবহার করতে পারে। স্বতন্ত্র নেটিভ [Android অ্যাপ](https://github.com/open-ott-play/ottplay-android)-ও manifest-এর সূচকের বদলে ভাষা, ভূমিকা ও লেবেল অনুযায়ী অডিও/সাবটাইটেল পছন্দ রাখে; তার বাস্তবায়ন ও রিলিজ এই frontend থেকে আলাদা।

[STB সোর্স পর্যালোচনা](docs/stb-player-improvements.md)-এ মিডিয়া, রিসোর্স ও পুনরুদ্ধারের উন্নতি, সোর্সগুলির তুলনা এবং বর্তমান সীমাবদ্ধতা ব্যাখ্যা করা হয়েছে।

<a id="debug-hud"></a>

## ডিবাগ HUD

স্থানীয় HUD ও সার্ভারে লগের স্থায়ী সংরক্ষণ আলাদাভাবে চালু হয়। অন্য ডিভাইসের লগ নেওয়ার আগে [নির্ণয় প্রবেশাধিকার, তথ্য আড়াল ও ধরে রাখা](docs/diagnostic-security.md) দেখুন।

যেকোনো একটি উপায়ে ডিবাগ মোড চালু করুন:
- URL: `?debug=1` অথবা `?debug=true`
- স্থানীয় স্টোরেজ: `localStorage.setItem("ottplay_debug", "1")`
- উইন্ডোর বৈশিষ্ট্য: `window.__OTT_DEBUG__ = true`
- সার্ভার: যখন `/debug/config`, `{enabled: true}` ফেরত দেয়

ডিবাগ চালু থাকলে:
- পর্দার HUD স্ট্রিপ বদলাতে **D** চাপুন (`ottDebugSetHud` / `__ottDebug.toggleHud()`)
  - ফোকাস INPUT/TEXTAREA/listEdit-এ থাকলে এড়িয়ে যায়
  - MAG/Maple PLAY/PREV=68 সংঘর্ষ এড়াতে `e.key` ব্যবহার করে
- তথ্য মেনু → **ডিবাগ HUD** → `__ottDebug.toggleHud()` ডাকে
- সেটিং ব্যবস্থাপনা → **ডিবাগ HUD**:
  - ডিবাগ আগে লোড হলে: HUD-এর দৃশ্যমানতা বদলায়
  - না হলে: `ottplay_debug=1` + `ottplay_debug_hud=1` সেট করে আবার চালু করতে বলে
- স্থায়িত্ব: `ottDebugSetHud` HUD অবস্থা `localStorage.ottplay_debug_hud`-এ ("1"/"0") রাখে

<a id="capacitor-ios-and-android"></a>

## iOS ও Android-এর জন্য Capacitor

এই রিপোজিটরি যৌথ TypeScript frontend-কে Capacitor দিয়ে iOS ও Android 7+-এর জন্য প্যাকেজ করে। উভয়ই সিস্টেম ফন্ট ও npm-এ লক করা নেটিভ রানটাইম ব্যবহার করে। আলাদা API 22 সামঞ্জস্য APK, WebView 60 বা নতুনের সঙ্গে Android 5.1/6 সমর্থন করে। দুটি Android APK-ই স্বাক্ষরিত এবং যোগ্য beta, RC ও stable রিলিজে স্বাক্ষরহীন iOS IPA-র সঙ্গে থাকে। স্বতন্ত্র Kotlin অ্যাপ [ottplay-android](https://github.com/open-ott-play/ottplay-android)-এ থাকে।

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

[Capacitor কনফিগারেশন](docs/capacitor-mobile.md) এবং [Android বিতরণ ও দূরবর্তী আপডেট](docs/android-distributions.md) দেখুন।

iOS ইন্টারফেস আড়াআড়ি দিক ব্যবহার করে। সেটিং, প্রদানকারীর কনফিগারেশন, দূরনিয়ন্ত্রণের সম্মতি ও JSON আমদানি/রপ্তানি যৌথ frontend ব্যবহার করে। ট্যাবলেটের মাল্টিটাস্কিং চাওয়া দিক বদলাতে পারে।

iPhone-এ চ্যানেল তালিকার ওপর উল্লম্বভাবে সোয়াইপ করে সারি ও পৃষ্ঠা পেরোন; পরের চ্যানেলের জন্য ওপরের দিকে, আগের জন্য নিচে। দ্রুত সোয়াইপ কয়েক পৃষ্ঠা চলতে থাকে, তারপর ধীরে থামে; ধীর টান নির্ভুল থাকে। পর্দা ছুঁয়ে বা নেভিগেশন কী চেপে গতি থামান। অন্য সারি নির্বাচিত থাকলেও এক ট্যাপে আঙুলের নিচের চ্যানেল চলে। সোয়াইপ শেষে আঙুল তুললে কখনো চ্যানেল খোলে না।

iPhone-এ ভিডিও ইন্টারফেসের মধ্যেই চলে। অনুষ্ঠানের তথ্যের জন্য পর্দার নিচে ট্যাপ করুন, অথবা ভিডিও চলার সময় মেনু খুলুন। Picture in Picture আলাদা প্লেব্যাক বিকল্প থাকে।

ডিভাইসের মৌলিক পরীক্ষা: [Mode B চেকলিস্ট](docs/mode-b-device-smoke.md) এবং `./scripts/smoke-capacitor-device.sh --help` (বিল্ড/সিঙ্ক লক্ষ্য শুধু iOS)। Tauri ডেস্কটপ পরীক্ষা: [ডেস্কটপ চেকলিস্ট](docs/mode-b-tauri-smoke.md)।

<a id="installation"></a>

## ইনস্টলেশন

| প্ল্যাটফর্ম | প্যাকেজ | মন্তব্য |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Apple Silicon ও Intel-এর আলাদা বিল্ড; Apple স্বাক্ষর কনফিগার না থাকলে ad-hoc স্বাক্ষর |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | বিভিন্ন ডিস্ট্রিবিউশন |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode বা Homebrew Channel](docs/lg-webos-installation.md); হোস্ট করা প্লেয়ার, নেটওয়ার্ক প্রয়োজন |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode ও স্থানীয় স্বাক্ষর; স্বাক্ষরবিহীন TV প্যাকেজ, Family Hub থেকে পৃথক](docs/samsung-tizen-installation.md) |
| **iOS** | AltStore / TestFlight / Xcode দিয়ে `.ipa` | শুধু সাইডলোড — এখনো App Store-এ নেই |
| **Android (যৌথ frontend)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | স্বাক্ষরিত Capacitor প্যাকেজ; সমর্থিত Android সংস্করণ বেছে নিন |
| **Android (নেটিভ Kotlin)** | আলাদা [নেটিভ অ্যাপ](https://github.com/open-ott-play/ottplay-android) | পাবলিক রিপোজিটরি; আলাদা অ্যাপ ও রিলিজ প্রক্রিয়া |

সমর্থিত ইনস্টলার যোগ্য GitHub রিলিজের সঙ্গে যুক্ত থাকে: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **মনে রাখুন:** Apple স্বাক্ষরের তথ্য না থাকলে macOS অ্যাপ বান্ডল ad-hoc স্বাক্ষর ব্যবহার করে; এতে Developer ID বা নোটারাইজেশন হয় না। Windows/Linux ইনস্টলার ও iOS রিলিজ প্যাকেজ স্বাক্ষরহীন হতে পারে। iOS-এর ভৌত ডিভাইসে ইনস্টলের আগে স্বাক্ষর লাগে। যোগ্য Full ও API 22 Android রিলিজ APK প্রতিষ্ঠিত স্বাক্ষর সার্টিফিকেট ব্যবহার করে; স্থানীয় রিলিজ বিল্ডে স্বাক্ষরিত APK করতে কনফিগার করা keystore লাগে।

---

<a id="macos"></a>

### macOS

1. [রিলিজ](https://github.com/open-ott-play/ottplay-foss/releases) থেকে নির্দিষ্ট ট্যাগ বেছে নিন। সর্বশেষ রিলিজ শর্টকাট stable বেছে নেয়, beta বা RC নয়।
2. Apple Silicon-এর জন্য `OttPlay.FOSS_*_aarch64-apple-darwin.dmg` বা Intel-এর জন্য `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` নামান। এগুলো আলাদা আর্কিটেকচারের বিল্ড।
3. `.dmg` খুলে **OttPlay FOSS.app**-কে Applications-এ টানুন।
4. প্রথম চালুর আগে কপি করা বান্ডল যাচাই করুন:

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

সফল যাচাই বান্ডলের অখণ্ডতা পরীক্ষা করে। `Signature=adhoc` মানে অ্যাপটির Apple-অনুমোদিত ডেভেলপার পরিচয় নেই; এতে নোটারাইজেশন বা Gatekeeper অনুমতি প্রমাণ হয় না। বিশ্বস্ত ডাউনলোড ও সঠিক বান্ডল হলেও প্রথম চেষ্টার পরে macOS-এ **System Settings → Privacy & Security → Open Anyway** লাগতে পারে; [Apple-এর নির্দেশনা](https://support.apple.com/en-us/102445) দেখুন।

“অ্যাপ ক্ষতিগ্রস্ত” বার্তা শুধু কোয়ারেন্টিনের প্রমাণ নয়। স্বাক্ষর যাচাই ব্যর্থ হলে ত্রুটি রেখে সংশোধিত রিলিজ সংগ্রহ করুন। ব্যর্থ যাচাইকে সফল দেখাতে ডাউনলোড করা অ্যাপ আবার স্বাক্ষর করবেন না বা তার বৈশিষ্ট্য মুছবেন না।

ZIP বিকল্প হলো `OttPlay.FOSS_aarch64-apple-darwin.app.zip` এবং `OttPlay.FOSS_x86_64-apple-darwin.app.zip`। বের করা, ডিস্ক ইমেজ ও Gatekeeper পরীক্ষার জন্য [macOS স্বাক্ষর ও আর্টিফ্যাক্ট যাচাই](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact) দেখুন। চেকআউট বিল্ড ও স্থানীয় ইনস্টলের জন্য [স্থানীয় macOS সরবরাহ](docs/macos-local-delivery.md) ব্যবহার করুন।

---

<a id="windows"></a>

### Windows

1. [রিলিজ](https://github.com/open-ott-play/ottplay-foss/releases/latest) থেকে `.msi` বা `.exe` নামান
2. ইনস্টলার চালিয়ে নির্দেশনা অনুসরণ করুন
3. Start Menu বা Desktop শর্টকাট থেকে খুলুন

---

<a id="linux"></a>

### Linux

Linux প্লেব্যাকে WebKitGTK-এর সঙ্গে GStreamer HLS, H.264 ও AAC প্লাগইন লাগে। প্যাকেজ এই মিডিয়া নির্ভরতা ঘোষণা করে; AppImage বিল্ড মিডিয়া ফ্রেমওয়ার্ক সঙ্গে রাখে। কোডেক পরীক্ষা ও ব্রাউজার/নেটিভ গ্রহণযোগ্যতার পার্থক্য জানতে [Linux মিডিয়া প্যাকেজিং](docs/linux-media-packaging.md) দেখুন।

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

### iOS ইনস্টলেশন

iOS-এ ভৌত ডিভাইসে ইনস্টলের আগে স্বাক্ষর লাগে। স্বাক্ষরহীন রিলিজ IPA-র জন্য AltStore Classic ব্যবহার করুন, অথবা Xcode দিয়ে উৎস থেকে বিল্ড ও স্বাক্ষর করুন। দেওয়া হলে TestFlight-এর জন্য আলাদা আমন্ত্রণ লাগে।

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### বিকল্প 1: AltStore Classic (ব্যক্তিগত ব্যবহারের জন্য প্রস্তাবিত)

AltServer কম্পিউটারে চলে; AltStore Classic iPhone/iPad-এ চলে ও IPA আমদানি করে। বিনামূল্যের Apple Account যথেষ্ট।

**পূর্বশর্ত:**

- বর্তমান OTT-play বিল্ডের জন্য **iOS/iPadOS 15 বা নতুন** সংস্করণের iPhone/iPad।
- AltServer-সহ Mac বা Windows PC ও USB ডেটা কেবল।
- স্বাক্ষরের জন্য Apple Account এবং রিলিজ নামানোর জন্য ইন্টারনেট।

**ধাপ 1: একবার AltStore সেট করুন**

1. সরকারি [macOS সেটআপ](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) বা [Windows সেটআপ](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows) অনুযায়ী AltServer ইনস্টল করুন। চালু করে মেনু বার/সিস্টেম ট্রে আইকন ব্যবহার করুন।
2. USB দিয়ে ডিভাইস যুক্ত করুন, আনলক করুন এবং কম্পিউটার/ডিভাইসের বিশ্বাস করার অনুরোধ মেনে নিন। Mac-এ Finder-এ ডিভাইস দেখা যাচ্ছে কি না দেখুন।
3. **AltServer মেনু → Install AltStore** থেকে ডিভাইস বেছে স্বাক্ষরের অ্যাকাউন্টের ধাপ পূরণ করুন। ইনস্টলেশনের বিজ্ঞপ্তির জন্য অপেক্ষা করুন।
4. ডিভাইসে **Settings → General → VPN & Device Management** খুলে চাইলে স্বাক্ষর অ্যাকাউন্টের ডেভেলপার এন্ট্রিকে বিশ্বাস করুন। iOS 16+-এ **Settings → Privacy & Security → Developer Mode** চালু করে পুনরারম্ভ ও নিশ্চিতকরণ শেষ করুন।
5. ডিভাইসে AltStore খুলুন। আগে ইনস্টল হয়ে কাজ করলে এই সেটআপ বাদ দিন এবং নিচের আমদানির জন্য AltServer চালু রাখুন।

**ধাপ 2: নির্বাচিত রিলিজ iPhone/iPad-এ আমদানি করুন**

1. [সব রিলিজ](https://github.com/open-ott-play/ottplay-foss/releases) থেকে সঠিক ট্যাগ বেছে তার `ottplay-foss-ios-unsigned.ipa` ডিভাইসের Safari-তে নামান। [সর্বশেষ রিলিজ শর্টকাট](https://github.com/open-ott-play/ottplay-foss/releases/latest) স্থিতিশীল রিলিজ বেছে নেয়; beta চাইলে পূর্ণ তালিকা ব্যবহার করুন।
2. IPA-টি Files-এ রাখুন। **AltStore → My Apps → +** থেকে ফাইলটি বাছুন। Mac-এ নামানো IPA AirDrop দিয়ে পাঠিয়ে আমদানির আগে Files-এও রাখতে পারেন। Mac-এ IPA খোলা এই আমদানি ধাপ নয়।
3. AltStore অ্যাপ স্বাক্ষর ও ইনস্টল করার সময় AltServer চালু এবং USB যুক্ত রাখুন। আপডেটে আগের ইনস্টলের একই স্বাক্ষর অ্যাকাউন্ট ব্যবহার করুন; সমস্যা মেটানোর প্রথম ধাপে অ্যাপ মুছবেন না।
4. আমদানি শেষ হওয়া পর্যন্ত অপেক্ষা করে **My Apps**-এ OTT-play দেখুন, তারপর খুলুন।

**বিকল্প: রিলিজ URL সরাসরি আমদানি**

AltStore ইনস্টল থাকলে **iPhone-এর Safari**-তে এই ধরনটি লিখুন, `TAG`-এর জায়গায় সঠিক রিলিজ ট্যাগ দিন এবং **Open in AltStore** মেনে নিন:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

এটি AltStore-এর [ইনস্টল URL হ্যান্ডলার](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift) ব্যবহার করে। একাধিক ডাউনলোডের একই নাম হলে Files/Recents-এর অস্পষ্টতা এড়ায়। URL অবশ্যই IPA ফাইলের হতে হবে, রিলিজ পৃষ্ঠার নয়।

যেমন, নিচের আমদানি **2026-09-29** তারিখে AltStore 2.3 ও AltServer 1.8.1 দিয়ে যাচাই করা হয়েছে। এটি স্থির ঐতিহাসিক উদাহরণ, সর্বশেষ সংস্করণের লিঙ্ক নয়:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**নবায়ন:** বিনামূল্যের অ্যাকাউন্টের ইনস্টল সাত দিন পরে শেষ হয়। AltServer-এ পৌঁছানো যায় এমন রাখুন এবং মেয়াদ ফুরোনোর আগে **AltStore → My Apps → Refresh All** ব্যবহার করুন। পটভূমির নবায়নেও AltServer লাগে; [AltStore নবায়নের নির্দেশনা](https://faq.altstore.io/altstore-classic/your-altstore) দেখুন।

<a id="verify-the-installed-version-before-retrying"></a>

#### আবার চেষ্টা করার আগে ইনস্টল করা সংস্করণ যাচাই করুন

AirDrop-এর “Sent” বার্তা শুধু স্থানান্তর নিশ্চিত করে। AltStore-এর অগ্রগতির বার আমদানি শুরু হওয়া নিশ্চিত করে। Mirroring/USB সংযোগ হারানো মানেই ইনস্টল ব্যর্থ নয়: IPA আবার দেওয়ার আগে ইনস্টল অ্যাপ পরীক্ষা করুন।

Xcode ইনস্টল এবং সক্রিয় ডেভেলপার ডিরেক্টরি হিসেবে নির্বাচিত Mac-এ পুনরায় ইনস্টল না করে ডিভাইস পরীক্ষা করুন:

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

JSON-এর `result.apps`-এ OTT-play খুঁজুন (`bundleIdentifier` শুরু হয় `play.ott.foss` দিয়ে) এবং `version` ও `bundleVersion`-কে নির্বাচিত IPA-র `CFBundleShortVersionString` ও `CFBundleVersion`-এর সঙ্গে মিলিয়ে দেখুন। বান্ডল পরিচয়ে AltStore স্বাক্ষর অ্যাকাউন্টের প্রত্যয় প্রত্যাশিত। ডিভাইস রিপোর্ট স্থানীয় রাখুন।

যাচাই করা beta.9 উদাহরণে **সংস্করণ `1.1.51`, বিল্ড `2.2.66`** দেখা যায়। এতে ইনস্টল নিশ্চিত হয়; অ্যাপ খোলা, Cloudflare লগইন, তালিকা লোড, প্লেব্যাক ও PiP আলাদা ডিভাইস পরীক্ষা।

<a id="troubleshooting-ios-installation"></a>

#### iOS ইনস্টলেশনের সমস্যা মেটানো

- **AltServer-এর উইন্ডো নেই বা অটোমেশনে খুলতে টাইমআউট:** মেনু বার/সিস্টেম ট্রে আইকন ব্যবহার করুন। এটি পটভূমির অ্যাপ। বারবার সাধারণ উইন্ডো খোলার চেষ্টা IPA আমদানি করে না।
- **“Could not find AltServer” বা USB ডিভাইস পাওয়া যায় না:** AltServer চলছে কি না দেখুন, ফোন আনলক করুন এবং বিশ্বাসের অনুরোধ পরীক্ষা করুন। Mac-এ Finder দেখুন। সংযোগ ছিঁড়লে নিরাপদ সময়ে আবার যুক্ত করে পুনরায় চেষ্টার আগে ইনস্টল সংস্করণ দেখুন। সমস্যা থাকলে [AltStore সংযোগ সমস্যা মেটানো](https://faq.altstore.io/altstore-classic/troubleshooting-guide) অনুসরণ করুন। ফোন কম্পিউটারের ইন্টারনেট দিলে কেবল বা নেটওয়ার্ক বদল সমন্বয় করুন, যাতে অন্য কাজ বন্ধ না হয়।
- **iPhone Mirroring “iPhone in Use” বলে বা “Connecting”-এ থাকে:** আসল ফোনে সেটআপ শেষ করুন, অথবা পর্দা লক করে আনলক Mac-এর কাছে রাখুন। ফোন আনলক করলে Mirroring শেষ হয়; USB বিশ্বাস/সেটআপে আগে আনলক লাগতে পারে। একবার পুনঃসংযোগেও আটকে থাকলে Mirroring বন্ধ করে ফোনে চালিয়ে যান। [Apple-এর Mirroring শর্ত](https://support.apple.com/en-us/120421) দেখুন। ইনস্টলের জন্য Mirroring ঐচ্ছিক।
- **Mirroring-এ URL-এর লাতিন অক্ষর হারায় বা সিরিলিক হয়:** **Mac ইনপুট উৎস ABC/English** করুন। Mirroring-এ ফোকাস রেখে **Control–Space** চাপুন এবং iPhone হার্ডওয়্যার কিবোর্ডে **English (US)** বাছুন। Mac ও iPhone-এর ইনপুট উৎস আলাদা হতে পারে; যাচাই করা সেশনে শুধু Mac বদলানো যথেষ্ট ছিল না। ঘর খালি করে URL আবার লিখুন এবং পাঠানোর আগে ঠিকানা দেখুন।
- **Mirroring-এ ক্লিপবোর্ড পেস্ট আটকে যায় বা অপ্রত্যাশিত লেখা দেয়:** ঘর খালি করে iPhone-এর English (US) উৎসে ধীরে ছোট ভাগে লিখুন, অথবা সরাসরি ফোনে URL দিন। দ্রুত Mirroring ইনপুট অক্ষর বাদ দিতে বা দ্বিগুণ করতে পারে; সংরক্ষণের আগে পুরো ঠিকানা যাচাই করুন। অর্ধেক পেস্ট হওয়া URL পাঠাবেন না। আমাদের ইনস্টল সেশনে পেস্ট ব্যর্থ হয়েছিল; সরাসরি URL পদ্ধতির জন্য এটি জরুরি নয়।
- **Files/Recents-এ একাধিক একই IPA নাম:** সঠিক ডাউনলোড স্থান বাছুন বা ওপরের ট্যাগসহ সরাসরি URL ব্যবহার করুন। স্পষ্টতার জন্য স্থানীয় কপির নামে ট্যাগ/বিল্ড যোগ করা যায়; নাম বদলালে বিষয়বস্তু বদলায় না।
- **ইনস্টল করা অ্যাপ খোলে না:** ফোনের ডেভেলপার বিশ্বাস বা Developer Mode নির্দেশ অনুসরণ করুন। AltStore-এ মেয়াদ দেখুন ও প্রয়োজনে নবায়ন করুন। তবুও না চললে প্রকৃত ত্রুটি লিখে রাখুন; শুধু সংযোগ ত্রুটি অ্যাপ মুছে পুনরায় ইনস্টলের কারণ নয়।
- **OTT-play খোলে কিন্তু সুরক্ষিত তালিকা মোবাইল নেটওয়ার্কে ব্যর্থ:** ইনস্টলেশন ও উৎসের প্রমাণীকরণ আলাদা। **Settings → Manage settings → Source access** দিয়ে কনফিগার করা উৎসে লগইন করে তালিকা আবার লোড করুন। প্রয়োজনে বায়োমেট্রিক/passkey বা ইমেইল কোড আসল ডিভাইসে সম্পন্ন করুন। উৎসকে [iOS Access সংযোগ](docs/ios-source-access.md) সমর্থন করতে হবে; অ্যাপ ইনস্টল IP অনুমতি তালিকা পেরোয় না।
- **বিশ্বস্ত Wi-Fi-তে passkey চায়:** iOS Access উৎসের ক্ষেত্রে অ্যাপ আগে মূল উৎস লগইন ছাড়া চেষ্টা করে, অ্যাক্সেস প্রত্যাখ্যানের পরেই প্রমাণীকৃত মোবাইল প্রবেশ ব্যবহার করে। উৎস সত্যিই যে পাবলিক IP দেখে, IPv6-সহ তা দেখুন: অনুমোদিত বাড়ির IPv4 অন্য IPv6, VPN বা মোবাইল ঠিকানা ঢাকে না। নেটওয়ার্ক বদল ও অ্যাপ আবার খোলা অস্থায়ী রুট পছন্দ মুছে দেয়। সাধারণ নেটওয়ার্ক/সার্ভার ত্রুটিতে লগইন চাওয়া উচিত নয়।
- **লগইন আর আসে না, কিন্তু চ্যানেল তালিকা ফাঁকা:** বৈধ সংরক্ষিত সেশন নতুন অনুরোধ ছাড়াই ব্যবহৃত হয়। আগে লোড ব্যর্থ বা সার্ভার ঠিক করার পরে তালিকা আবার লোড করুন, অথবা অ্যাপ একবার পুরো বন্ধ করে খুলুন। না হলে দেখুন উৎস তালিকা দিচ্ছে, HTML লগইন পৃষ্ঠা বা JSON ত্রুটি নয়। দেখানো ত্রুটি ও HTTP অবস্থা রাখুন; ক্রেডেনশিয়াল, কুকি বা Access token-সহ উৎস URL শেয়ার করবেন না।
- **চ্যানেল লোড হয় কিন্তু ভিডিও বাফার করে বা `SRC_NOT_FOUND` বলে:** তালিকা লোড ও ভিডিও চলা আলাদা পরীক্ষা। লগইনের পরে চ্যানেল একবার আবার চেষ্টা করুন; সমস্যা থাকলে HLS manifest ও segment প্রতিক্রিয়া এবং স্ট্রিমের কোডেক সমর্থন দেখুন। ত্রুটিটি একা ইঞ্জিন বদল বা পুনরায় ইনস্টলে লাভ হবে প্রমাণ করে না।

<a id="option-2-testflight-if-available"></a>

#### বিকল্প 2: TestFlight (পাওয়া গেলে)

TestFlight আমন্ত্রণ প্রকাশিত হলে App Store থেকে TestFlight ইনস্টল করুন, ডিভাইসে আমন্ত্রণ খুলে **Install** চাপুন। GitHub থেকে IPA নামালে TestFlight আমন্ত্রণ পাওয়া যায় না।

<a id="option-3-xcode-for-developers"></a>

#### বিকল্প 3: Xcode (ডেভেলপারদের জন্য)

[বিল্ড ও খোলা](docs/capacitor-mobile.md#build-and-open) অনুসরণ করে Xcode-এ **App** টার্গেট বাছুন, **Signing & Capabilities**-এ ডেভেলপমেন্ট দল সেট করুন, যুক্ত ডিভাইস বেছে বিল্ড/রান করুন। প্রয়োজনে ডিভাইস বিশ্বাস ও Developer Mode ধাপ পূরণ করুন। স্বাক্ষরহীন রিলিজ IPA Xcode-এর Devices উইন্ডোতে আমদানি করলে অনুপস্থিত স্বাক্ষরের পরিচয় বা provisioning profile আসে না।

---

<a id="android-application"></a>

### Android অ্যাপ

যৌথ প্লেয়ার ইন্টারফেসের জন্য এই রিপোজিটরির রিলিজের Full Capacitor APK বাছুন। Android 5.1–6-এ API 22 সামঞ্জস্য APK ব্যবহার করুন; WebView 60 বা নতুন লাগে। আপডেটের সময় অ্যাপের পরিচয় ও স্বাক্ষরের সার্টিফিকেট রাখুন, যাতে পুরোনো প্রোফাইল থাকে। [বিল্ড নির্দেশনা](android/README.md) এবং [বিতরণ, স্বাক্ষর ও দূরবর্তী ইনস্টল](docs/android-distributions.md) দেখুন।

আলাদা [ottplay-android রিপোজিটরি](https://github.com/open-ott-play/ottplay-android)-তে নেটিভ Kotlin/Compose অ্যাপ আছে। এর নিজস্ব পরিচয়, পছন্দ ও রিলিজ প্রক্রিয়া আছে; এটি Capacitor ইনস্টলকে সরাসরি প্রতিস্থাপন করে না। ঐতিহাসিক রিলিজ ফাইল পাওয়া যায়।

---

<a id="quick-start"></a>

## দ্রুত শুরু

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

ব্রাউজারের মৌলিক পরীক্ষায় একই সংস্করণের নিজের স্থাপনা ব্যবহার করুন।

Node 22 ও স্থিতিশীল Rust টুলচেইন ব্যবহার করুন। স্থির ফাইল পাওয়ার জন্য সার্ভার রিপোজিটরির মূল থেকে চালান। নেটিভ বিল্ডে নিচের প্ল্যাটফর্ম টুলচেইন লাগে; শুধু সার্ভার বিল্ডে লাগে না।

প্রথম লোডে **ডেমো চেষ্টা করুন** বাছুন, অথবা **সেটিং → প্রদানকারী পরিবর্তন → M3U / M3U8 তালিকা** খুলুন। **তালিকা নির্বাচন** খুলে একটি ঘর বাছুন, **তালিকার URL** দিন, সম্পাদনা রেখে **তালিকা লোড** বাছুন। তালিকা বা প্রদানকারীর অ্যাকাউন্ট আপনি দেন; অ্যাপটি পেইড চ্যানেলের সাবস্ক্রিপশন দেয় না।

<a id="mode-a-companion-smoke"></a>

## Mode A companion-এর মৌলিক পরীক্ষা

Mode A companion-এর curl পরীক্ষা (`ottplay-server` / `archive/server.py` সমতা): index, স্থির ডিরেক্টরি, `/logo`, `/version`, ঐচ্ছিক `/epg` এবং না নামিয়ে `POST /m3u/cp.php` পরীক্ষা।

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

পরীক্ষা `scripts/modea-smoke-checks.json`-এ আছে। গোপন তথ্য নেই। কমান্ড কিউ / `local_proxy.py` (:8081) আলাদাভাবে `scripts/smoke-command-queue.sh` দ্বারা পরীক্ষা হয় (থাকলে)।

<a id="classic-stalker--ministra-portals"></a>

## ক্লাসিক Stalker / Ministra পোর্টাল

**Stalker পোর্টাল** বেছে প্রদানকারীর দেওয়া MAC ও পুরো পোর্টাল URL দিন, যেমন `http://provider.example/stalker_portal/c/`। `/c/index.html`, `/stalker_portal`, `/server/load.php`, `/load.php` ও `/portal.php` URL ক্লাসিক MAG প্রোটোকল বেছে নেয়। আগে থেকে থাকা শুধু-সার্ভার কনফিগারেশন JSON-RPC রাখে। প্রদানকারী যৌথ Stalker কোর দিয়ে প্রোফাইল, ধরন ও পৃষ্ঠাভিত্তিক লাইভ চ্যানেল লোড করে, তারপর পটভূমিতে ক্লাসিক `type=vod` চলচ্চিত্র ও নেস্টেড পর্ব খুঁজে আনে। ফোল্ডারের পথগুলি সাধারণ চ্যানেল তালিকার বিভাগ হয়; উপলব্ধ বিবরণ, পোস্টার এবং স্থিতিশীল রেফারেন্সসহ গ্লোবাল Favorites একই মিডিয়া ইন্টারফেস ব্যবহার করে। দেখুন [ক্যাটালগের আচরণ ও সীমা](docs/stalker-media.md)।

স্ব-হোস্টেড ব্রাউজারের অনুরোধ companion-এর `/stalker/api` endpoint দিয়ে যায়; নেটিভ অ্যাপ বিদ্যমান HTTP পরিবহন ব্যবহার করে। হোস্টেড ব্রাউজারের জন্য [নির্দিষ্ট রিলে](docs/stalker-relay.md)-এর মাধ্যমে স্পষ্টভাবে কনফিগার করা রুট দরকার। ব্রাউজার ও সার্ভারের ফাইল একসঙ্গে আপডেট করতে হবে।

লাইভ প্লেব্যাক স্ট্রিম খোলার সময় অস্থায়ী চ্যানেল কমান্ড সমাধান করে; চ্যানেল বদল, থামানো, PiP ও প্রদানকারী বদল পুরোনো সমাধান বাতিল করে। স্পষ্ট অস্থায়ী নয় এমন HTTP(S) কমান্ড সরাসরি চলে। সংক্ষিপ্ত EPG সমর্থিত। এই প্রদানকারী ক্লাসিক পোর্টালের আর্কাইভ এবং পৃথক `type=series` প্রোটোকল দেয় না। বর্তমান JSON-RPC আর্কাইভ/গাইড আচরণ বদলায় না। companion রুটের ব্যক্তিগত LAN পোর্টালে অন্যান্য companion প্রক্সি রুটের মতো সঠিক `OTTPLAY_PROXY_LAN_ORIGINS` এন্ট্রি লাগে।

পাবলিক Infomir ডেমো `http://middleware-stalker.com/stalker_portal/c/`। 2026-09-26 তারিখে এটি তিনটি লাইভ ক্যাটালগ এন্ট্রি দিয়েছিল, কিন্তু মিডিয়া endpoint অনুপলব্ধ ছিল; প্লেব্যাক রিগ্রেশনে নিয়ন্ত্রিত পোর্টাল/মিডিয়া ডেটা ব্যবহার করুন।

<a id="m3u-stream-proxy-header-smoke"></a>

## M3U স্ট্রিম প্রক্সির হেডার পরীক্ষা

নিয়ন্ত্রিত echo URL আনার সময় Mode A companion `POST /m3u/cp.php` যে upstream অনুরোধ হেডার যোগ করে তা তুলনা করে (ডিফল্ট স্থানীয় mock — IPTV প্রদানকারী বা গোপন তথ্য নেই)।

চুক্তি (`src-rs/core/src/m3u.rs` + `archive/server.py` থেকে):
- শুধু **User-Agent** যোগ করে (ডিফল্ট `OTT-play-FOSS/1.0`, অথবা `webos` / `tizen` / `viera` / `mag` / `dune` প্রিসেট)।
- **Referer যোগ করে না** (Capacitor `M3UProxy` করে; Mode A করে না)।
- `url`-এর শুরু থেকে `@` বাদ দেয় (প্রদানকারীর jQuery ফর্ম)।

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

প্রস্থান কোড: `0` সফল, `1` শুনছে না, `2` হেডার/HTTP অমিল, `3` ব্যবহার/নির্ভরতা। `smoke-modea-companion.sh` / `smoke-command-queue.sh`-এর সঙ্গী।

<a id="logo-concurrent-bench-smoke"></a>

## সমান্তরাল লোগো বেঞ্চ পরীক্ষা

Mode A companion-এর বিরুদ্ধে একযোগে `GET /logo/<id>.svg` (ঐচ্ছিক `?ch=`) বিলম্ব পরীক্ষা। সফল/ব্যর্থ সংখ্যা ও p50/p95/p99 জানায়। ডিফল্ট বাস্তবসম্মত স্থানীয় CI লোড (`CONCURRENCY=200`, `TOTAL=1000`); পুরো 10 হাজারের দীর্ঘ পরীক্ষা ঐচ্ছিক (`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`)।

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

প্রস্থান কোড: `0` সফল, `1` শুনছে না / সংযোগ ব্যর্থ, `2` উচ্চ ত্রুটির হার, `3` ব্যবহার। `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`-এর সঙ্গী।

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## XMLTV ক্যাশ নবায়ন / প্রস্তুতি পরীক্ষা

`src-rs` অনুযায়ী Mode A companion-এর XMLTV/EPG ক্যাশের প্রকৃত আচরণ যাচাই করে (বানানো API নয়):

- মেমরির `EPG_CACHE`, `GET /epg/:hash` দিয়ে পরিবেশিত → সব সময় `{"epg_data":[...]}` (HTTP 200)।
- প্রক্রিয়ার শুরু HTTP চালু হওয়া না আটকে পটভূমিতে `EPG_URLS` আনে; প্রতিবার আনা শেষ হলে পরের নবায়নের আগে **2h** অপেক্ষা।
- `DATABASE_URL` সেট থাকলে ঐচ্ছিক SQLite স্থায়ী সংরক্ষণ (পাবলিক ক্যাশ-স্ট্যাটাস endpoint নেই)।
- `GET /health` → `OK` ঐচ্ছিক পুনরারম্ভের পরে HTTP প্রস্তুতি নিশ্চিত করে। `--strict-epg` ও `--epg-hash` দিয়ে পরীক্ষা একই `--warmup-timeout` সময়ের মধ্যে ওই চ্যানেলের অখালি EPG-র জন্যও অপেক্ষা করে।

ডিফল্ট পথ শুধু curl চালায় — **প্রক্রিয়া মারে না**। স্বয়ংক্রিয় বন্ধ+পুনরারম্ভের জন্য `--restart-cmd` / `RESTART_CMD` দিন, বা `--help`-এর ম্যানুয়াল `launchctl` ধাপ অনুসরণ করুন।

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

প্রস্থান কোড: `0` সফল, `1` শুনছে না, `2` assertion/প্রস্তুতি ব্যর্থ, `3` ব্যবহার। `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`-এর সঙ্গী।

<a id="mode-a-e2e-play-path-smoke"></a>

## Mode A E2E প্লেব্যাক পথ পরীক্ষা

Companion-এর দিকে **প্লেব্যাক পথ / স্ট্রিম প্রস্তুতি** পরীক্ষা (শুধু HTTP — দৃশ্যমান UI E2E **নয়**)। চলমান Mode A companion-এ দেখে:

- Health বা index-এ পৌঁছানো যায়
- স্থির প্লেয়ার শেল ফাইল (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`)
- `EPG_HASH` সেট থাকলে ঐচ্ছিক `GET /epg/<hash>.json`
- গোপন তথ্যহীন JSON ডেটা দিয়ে `POST /m3u/match-channels` (ফাঁকা তালিকা + একটি কৃত্রিম চ্যানেল)
- স্ট্রিম প্রক্সির **প্লে**: নিয়ন্ত্রিত মিডিয়ায় `POST /m3u/cp.php` (ডিফল্ট স্থানীয় HLS তালিকা বা `MEDIA_URL`) এবং HTTP 200 + অখালি বডি / প্রত্যাশিত `Content-Type` পরীক্ষা (প্রক্সি দিয়ে প্রথম বাইট)

ব্যক্তিগত IPTV ক্রেডেনশিয়াল নেই। `smoke-modea-companion.sh` (উপস্থিতি), `smoke-m3u-stream-proxy-headers.sh` (UA/Referer), `smoke-xmltv-cache-refresh.sh`-এর সঙ্গী।

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

প্রস্থান কোড: `0` সফল, `1` শুনছে না, `2` assertion ব্যর্থ, `3` ব্যবহার/নির্ভরতা।

<a id="capacitor-device-smoke-mode-b"></a>

## Capacitor ডিভাইস পরীক্ষা (Mode B)

Mode B Cap-এর জন্য সিমুলেটর/এমুলেটর (ঐচ্ছিক আসল ডিভাইস) **চেকলিস্ট** — Mode A companion HTTP নয়। মানুষ UI সফলতা চিহ্নিত করে; সহায়ক টুলচেইন/নেটিভ ডিরেক্টরি/কমান্ড কিউয়ের হালকা curl পরীক্ষা স্বয়ংক্রিয় করে।

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

বিস্তারিত: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md)। `smoke-command-queue.sh` (Cap loopback)-এর সঙ্গী — ওপরের Mode A পরীক্ষার সঙ্গে গুলিয়ে ফেলবেন না।

<a id="tauri-desktop-smoke-mode-b"></a>

## Tauri ডেস্কটপ পরীক্ষা (Mode B)

Mode B Tauri-এর ডেস্কটপ চেকলিস্ট ও সহায়ক (উইন্ডো/চ্যানেল চালানো/PiP)। Mode A companion HTTP বা Cap ডিভাইস পরীক্ষা নয়।

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

বিস্তারিত: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md)। স্থানীয় পরীক্ষায় Apple ডেভেলপার ক্রেডেনশিয়াল ঐচ্ছিক; প্যাকেজ করা Mac অ্যাপে [ad-hoc স্বাক্ষর](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials) ব্যবহার করুন। মানুষের গ্রহণযোগ্যতা পরীক্ষায় চালু করা, প্লেব্যাক ও PiP থাকে।

<a id="docker"></a>

## Docker

বহু-আর্কিটেকচার ইমেজ (amd64/arm64) প্রার্থী OCI আর্কাইভ হিসেবে তৈরি হয়। রেজিস্ট্রি প্রকাশনা অনুমোদিত stable আর্কাইভ আবার বিল্ড না করে Docker Hub-এ দেয়; [পরিচালনা নির্দেশিকা](docs/release-workflow.md) দেখুন।

সার্ভার বাইনারি **musl** (Alpine)-এ তৈরি এবং Alpine-এ সরবরাহ হয় — GLIBC_2.38+ **লাগে না**। ফলে `alvit/ottplay-foss` Synology DSM Docker (x86_64) ও পুরোনো glibc হোস্টে চলতে পারে।

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

স্থিতিশীল রেজিস্ট্রি ট্যাগ `X.Y.Z` ব্যবহার করে। সংস্করণযুক্ত ইমেজ প্রকাশের পরে `latest` আপডেট করা আলাদা স্পষ্ট বিকল্প; main push ও Git tag ইমেজ প্রকাশ করে না।

<a id="build-from-source"></a>

## উৎস থেকে বিল্ড

প্লেয়ারের ডোমেইন নিয়ম `vendor/ottplay-core.js`-এ পিন করা Kotlin multiplatform আর্টিফ্যাক্ট থেকে আসে। গাইড, আর্কাইভ, তালিকা, প্রদানকারী, স্থায়ী অবস্থা ও প্লেব্যাক সিদ্ধান্ত FOSS2 এবং নেটিভ Android-এর সঙ্গে বাস্তবায়ন ভাগ করে। ব্রাউজার/TV, Swift ও Rust অ্যাডাপ্টার ডিভাইস API, কোডেক, নেটওয়ার্ক ও UI প্রভাব রাখে। ব্রাউজার আর্টিফ্যাক্ট ES5 সিনট্যাক্স ও সমর্থিত পুরোনো API bootstrap রাখে। `npm test`, `check:bundle` ও `check:es5` সংযোগ যাচাই করে; আর্টিফ্যাক্ট manifest উৎস ও আউটপুট hash রাখে।

Control-server ও SWOP প্রোটোকল যাচাইকারী সংস্করণযুক্ত `contracts/ottplay-wire-v1.json` স্কিমা থেকে তৈরি হয়। পরীক্ষিত জেনারেটর রসিদ ও অপরিবর্তনীয় সামঞ্জস্য ডেটা ব্যবহারকারীভেদে নীতির কপি প্রতিরোধ করে।

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

## ডিভাইস শনাক্তকরণ

প্লেয়ার 24 ধরনের ডিভাইস সমর্থন করে। আগে URL `/f/{device_id}/`, পরে User-Agent দিয়ে শনাক্ত হয়।

| ডিভাইস ID | ডিভাইস |
|---|---|
| `pc` | PC ব্রাউজার |
| `pc2` | videojs ওয়েব প্লেয়ার |
| `nodejs` | Windows অ্যাপ (Electron) |
| `lg/webos` | LG WebOS TV |
| `samsung/tizen` | Samsung Tizen TV |
| `samsung/maple` | Samsung Orsay TV |
| `mag` | Infomir MAG বক্স |
| `dune` | Dune HD বক্স |
| `android` | Android TV / ট্যাবলেট |
| `hbbtv` | HbbTV TV |
| `panasonic` | Panasonic Viera TV |
| `philips` | Philips TV |
| `sony` | Sony TV |
| `sharp` | Sharp TV |
| `toshiba` | Toshiba TV |
| `hisense` | Hisense TV |
| `skyworth` | Skyworth TV |
| `tcl` | TCL TV |
| `vewd` | Vewd ডিভাইস |
| `spark` | Spark রিসিভার |

<a id="push-command-system"></a>

## পুশ কমান্ড ব্যবস্থা

আলাদা বহু-ডিভাইস পরিষেবার জন্য [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) ও **সেটিং → দূরনিয়ন্ত্রণ**-এর **কমান্ড সার্ভার** অংশ ব্যবহার করুন। তার IP/ঠিকানা ও এই প্লেয়ারের ডিভাইস কোড দিন; দুটো সংরক্ষণ করলে স্বয়ংক্রিয়ভাবে ভলিউম, চ্যানেল ও অন্যান্য কমান্ডের পোলিং শুরু হয়। পোর্ট ছাড়া IP HTTP 8081 ব্যবহার করে। থামাতে ঠিকানা মুছুন বা **বিচ্ছিন্ন করুন** বাছুন। এই বহির্মুখী সংযোগ নিশ্চিত সরবরাহ সমর্থন করে এবং স্থানীয় listener লাগে না। [সংযোগ ও সামঞ্জস্যের বিস্তারিত](docs/remote-command-server.md) দেখুন। নিচের উদাহরণ বিদ্যমান স্থানীয় প্রক্সি/listener মোড বোঝায়।

**কমান্ড সার্ভার খুঁজুন** ব্যবহার করে ডিভাইসের টোকেন কপি না করেই কন্ট্রোলার খুঁজে অপারেটরের অনুমোদন চাওয়া যায়। Tauri প্রথমে নেটিভ DNS পরীক্ষা করে; ফলাফল খালি হলে স্পষ্টভাবে নির্ধারিত ডিপ্লয়মেন্ট প্রোফাইল ব্যবহার করতে পারে। ব্রাউজার, LG ও Capacitor প্লেয়ার ব্রাউজারের প্রোফাইল-পদ্ধতি ব্যবহার করে। Home-এর ডিসকভারি মেটাডেটা কন্ট্রোলার থেকে আলাদাভাবে here.now-এ হোস্ট করা যায়। সাধারণ বিল্ডে Home প্রোফাইল স্বয়ংক্রিয়ভাবে থাকে না এবং আপডেট সংরক্ষিত সংযোগ বদলে দেয় না। দেখুন [প্ল্যাটফর্মের আচরণ, প্রোফাইল সেটআপ ও সমস্যা সমাধান](docs/remote-command-server.md#discovery-and-one-time-approval)।

ব্রাউজার/OTT server প্লেয়ার, Tauri ও Capacitor-এ স্থানীয় HTTP দূরনিয়ন্ত্রণ **ডিফল্ট বন্ধ**। গোপন ডিভাইস কোড তৈরির জন্য **প্লেয়ার সেটিং → দূরনিয়ন্ত্রণ**-এ চালু করুন। কমান্ড হলো `"command"` ফিল্ডসহ JSON অবজেক্ট; HTTP অনুরোধে `Authorization: Bearer <device-code>` লাগে।

<a id="architecture"></a>

### স্থাপত্য

<a id="local-command-url-recommended"></a>

#### স্থানীয় কমান্ড URL (প্রস্তাবিত)

**প্লেয়ার সেটিং → দূরনিয়ন্ত্রণ**-এ **স্থানীয় HTTP দূরনিয়ন্ত্রণ** চালু করুন, তৈরি **ডিভাইস কোড** কপি করুন এবং নিচের প্রক্সিতে দিন। **স্থানীয় কমান্ড URL** প্রক্সির কমান্ড endpoint-এ সেট করুন। চালু থাকলে প্লেয়ার প্রতি 10 সেকেন্ডে Authorization হেডারে কোড দিয়ে URL পরীক্ষা করে। শুধু URL দেওয়া কমান্ড নিয়ন্ত্রণ চালু করে না।

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### ডিভাইস UUID

বিদ্যমান ডিভাইস UUID (যেমন `dev_a1b2c3d4e5`) প্রকাশ্য রাউটিং তথ্য, অনুমোদনের পরিচয়পত্র নয়। স্থানীয় HTTP নিয়ন্ত্রণ চালু করলে পৃথক **ডিভাইস কোড** নিরাপদভাবে তৈরি হয় এবং এই ডিভাইসেই থাকে; ক্লাউড সেটিংয়ের মাধ্যমে কপি হয় না। স্থানীয় HTTP নিয়ন্ত্রণ বন্ধ করলে পোলিং/listener বন্ধ হয়। আবার চালু করলে নতুন কোড তৈরি হয়: পুরোনো পরিচয়পত্র বাতিল করতে প্রক্সি ও ইন্টিগ্রেশন আপডেট করুন।

Tauri ও Capacitor শুধু সেটিংয়ে এই সম্মতির পরে loopback HTTP listener চালু করে। ফরওয়ার্ডিং প্রক্সিকে ওই listener-এ প্রদর্শিত ডিভাইস কোড Bearer token হিসেবে পাঠাতে হবে। Mode A নিচে বর্ণিত আলাদাভাবে কনফিগার করা `local_proxy.py` সারি ব্যবহার করে।

<a id="remote-text-entry-swop"></a>

#### দূরবর্তী টেক্সট ইনপুট (swop)

উদ্দেশ্য: TV ও ফোন **আলাদা নেটওয়ার্কে** থাকলেও Cloudflare Worker সেশন হস্তান্তরের মাধ্যমে ফোনে ♥™ / দূরবর্তী ভার্চুয়াল কীবোর্ডের জন্য টাইপ করা।

- Worker-এর রেপো: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop)
- **ইনস্টলেশন অনুমোদন:** প্লেয়ার নিজের সার্ভারের একই-origin `/swop` relay-তে অনুরোধ পাঠায়। সার্ভার নিজের গোপন ইনস্টলেশন token যোগ করে; নিবন্ধিত সার্ভার origin-এর প্রতিটি ক্লায়েন্ট দূরবর্তী টেক্সট ইনপুট ব্যবহার করতে পারে। ডিভাইস UUID সেশন শনাক্ত করে; প্রতিটি ডিভাইসের পৃথক অনুমোদিত তালিকা লাগে না।
- সেটিং: `swopBaseUrl` (খালি = ♥™-এ “কনফিগার করা হয়নি” দেখায় / কিছু করে না)। **সেটিং → দূরনিয়ন্ত্রণ**-এ (**2** কী) বদলান, অথবা অপারেটর ইনস্টলেশনে gitignored `/local/swop.json` দিয়ে যোগ করুন।
- `POST /session`-এ `clientId`, `caption` ও `draft` থাকে; `POST /val`-এ `clientId`, `code` এবং ফেরত পাওয়া `sessionToken` থাকে। ফোনের URL-এ আলাদা write token থাকে। সেশনের read token ব্রাউজারের মেমরিতেই থাকে।
- **স্থানীয় ইনস্টল:** Worker-এ ইনস্টলেশন ও তার সুনির্দিষ্ট LAN/localhost origin নিবন্ধনের পরে `SWOP_BASE_URL` ও `SWOP_INSTALLATION_TOKEN` দিন। `scripts/install-ottplay-local-service.sh` এগুলো নিজের ব্যক্তিগত mode-0600 launchd plist-এ সংরক্ষণ করে। প্রকাশ্য `/local/swop.json`-এ শুধু `{"swopBaseUrl":"/swop"}` থাকে। প্রকাশ্য asset-এ কখনও ইনস্টলেশন token দেবেন না।
- **স্ট্যাটিক হোস্টিং:** একই দুই endpoint-এর জন্য সার্ভারে অনুমোদিত প্রক্সি কনফিগার করুন। হোস্টিং পরিষেবার secrets-এ ইনস্টলেশন token রাখুন। প্রকাশ্য প্লেয়ার ফাইল কপি করলে সার্ভারের পরিচয়পত্র কপি হয় না।

> কেন্দ্রীয় OTT সার্ভারে `/api/webhook/commands`, `/webhook/poll`, `/webhook/notify` ও command health alias প্রতিটি HTTP পদ্ধতির জন্য বন্ধ থাকে। Mode A-তে আলাদা command server বা স্পষ্টভাবে কনফিগার করা অনুমোদিত `local_proxy.py` ব্যবহার করুন; কেন্দ্রীয় সার্ভারে broadcast command queue নেই।

<a id="available-commands"></a>

### উপলব্ধ কমান্ড

নিচের সব উদাহরণে স্থানীয় প্রক্সির URL `http://192.168.1.50:8081/api/webhook/commands`। নিজের প্রক্সির আসল ঠিকানা দিন এবং প্লেয়ার সেটিংয়ে HTTP নিয়ন্ত্রণ চালুর পরে প্রদর্শিত **ডিভাইস কোড** দিয়ে `OTTPLAY_QUEUE_HTTP_TOKEN` সেট করুন। প্রক্সিতেও একই কোড কনফিগার করতে হবে।

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — পপআপ বিজ্ঞপ্তি দেখানো

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| ফিল্ড | ধরন | ডিফল্ট | বিবরণ |
|---|---|---|---|
| `message` | string | আবশ্যক | প্রদর্শিত টেক্সট |
| `popup_duration` | number | 5 | প্রদর্শনের সেকেন্ড (উপরের ডান কোণে) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — তালিকার অবস্থান দিয়ে চ্যানেল বদলানো

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| ফিল্ড | ধরন | ডিফল্ট | বিবরণ |
|---|---|---|---|
| `channel_number` | number | আবশ্যক | তালিকায় চ্যানেলের অবস্থান, 1 থেকে গণনা |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — নামের (অংশের) মাধ্যমে চ্যানেল বদলানো

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

বড়-ছোট অক্ষর উপেক্ষা করে নামের অংশ খোঁজে। প্রথম মিলটি বেছে নেয়।

| ফিল্ড | ধরন | ডিফল্ট | বিবরণ |
|---|---|---|---|
| `channel_name` | string | আবশ্যক | চ্যানেলের নাম বা নামের অংশ |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — দৈব চ্যানেলে যাওয়া

এই পুরোনো কমান্ডটি বর্তমান তালিকা বা বিভাগ থেকে উপযুক্ত চ্যানেল বেছে নেয়। চ্যানেলের নম্বর ও পরিসর ওই তালিকার অবস্থান বোঝায়; দেখুন [নিরাপদ এলোমেলো নির্বাচনের নিয়ম](docs/remote-command-server.md#safe-random-playback)।

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

| ফিল্ড | ধরন | ডিফল্ট | বিবরণ |
|---|---|---|---|
| `random_range` | [start, end] | বর্তমান তালিকা | 1 থেকে গণনা করা পরিসর |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — IPTV সরবরাহকারী বদলানো

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| ফিল্ড | ধরন | ডিফল্ট | বিবরণ |
|---|---|---|---|
| `provider` | number | আবশ্যক | সরবরাহকারীর অ্যারেতে সূচক (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — নতুন M3U প্লেলিস্ট লোড করা

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| ফিল্ড | ধরন | ডিফল্ট | বিবরণ |
|---|---|---|---|
| `playlist` | string | আবশ্যক | M3U প্লেলিস্টের URL |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — সরবরাহকারীর কনফিগারেশন আপডেট

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| ফিল্ড | ধরন | ডিফল্ট | বিবরণ |
|---|---|---|---|
| `provider_settings` | string | আবশ্যক | সরবরাহকারীর কনফিগারেশনসহ JSON string |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — ভলিউম নির্ধারণ বা পরিবর্তন

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

ভলিউম নিয়ন্ত্রণ সমর্থন করে না এমন ক্লায়েন্টে নিঃশব্দে উপেক্ষিত হয়।

| ফিল্ড | ধরন | ডিফল্ট | বিবরণ |
|---|---|---|---|
| `volume` | number | — | নির্দিষ্ট মাত্রা 0-100 |
| `volume_step` | number | — | আপেক্ষিক পরিবর্তন, যেমন +10 বা -5 |

<a id="player-standby-restart-and-exit"></a>

#### প্লেয়ার স্ট্যান্ডবাই, পুনরারম্ভ ও বন্ধ

স্থানীয় প্রক্সির প্রাপ্তিস্বীকারহীন webhook সারি `exit_player` বা typed standby/wake অনুরোধ সমর্থন করে না। প্লেয়ারকে [command server](docs/remote-command-server.md)-এ সংযুক্ত করে তার CLI ব্যবহার করুন:

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

`d1`-এর জায়গায় নিজের নিবন্ধিত প্লেয়ারের alias দিন। `stop` হলো `standby`-এর alias; `start` ও `wake` হলো `go`-এর alias। Go-এর জন্য চলমান, সংযুক্ত প্লেয়ার লাগে; বন্ধ অ্যাপ চালু বা অফলাইন ডিভাইস জাগাতে পারে না। নেটিভ অ্যাপ বন্ধের সুবিধা নেই এমন ব্রাউজার বা TV জানায় যে exit সমর্থিত নয়। স্ট্যান্ডবাইয়ে দূরবর্তী পোলিং সক্রিয় থাকে এবং হোস্ট বা শেয়ার্ড সার্ভারের অন্য কাজ স্থগিত হয় না।

standby/go-এর পরে `ott d1 status` দিয়ে standby/background অবস্থা দেখুন এবং পুনরায় playback আলাদা করে যাচাই করুন। প্লেয়ার reload-এর পরে `ott d1 doctor` দিয়ে নতুন runtime নিশ্চিত করুন। exit-এর পরে OS দিয়ে নিশ্চিত করুন অ্যাপের process বন্ধ হয়েছে; দূরবর্তী timeout exit-এর প্রমাণ নয়। শুধু কমান্ড গৃহীত হওয়া এসব ফল নিশ্চিত করে না।

<a id="local-proxy-server"></a>

## স্থানীয় প্রক্সি সার্ভার

`local_proxy.py` একটি প্লেয়ারের জন্য স্বতন্ত্র অনুমোদিত command queue। ডিফল্টভাবে চালালে পোর্ট না খুলেই বন্ধ হয়। প্রতিটি প্রক্সি instance প্লেয়ারে তৈরি ডিভাইস কোড ব্যবহার করে; একাধিক প্লেয়ারের জন্য পৃথক instance/port ব্যবহার করুন। `device_id` query parameter সামঞ্জস্যের তথ্য হিসেবে গৃহীত হলেও কখনও অনুমোদন দেয় না বা অন্য ডিভাইস বেছে নেয় না।

<a id="start-the-proxy"></a>

### প্রক্সি চালু করা

1. প্লেয়ারে **স্থানীয় HTTP দূরনিয়ন্ত্রণ** চালু করে **ডিভাইস কোড** কপি করুন।
2. প্রক্সি হোস্টে কোড ও প্লেয়ার পরিবেশনের সুনির্দিষ্ট origin কনফিগার করুন (scheme, host ও port, path ছাড়া):

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. প্লেয়ারের **স্থানীয় কমান্ড URL** সেট করুন `http://192.168.1.50:8081/api/webhook/commands`।

ডিফল্ট bind address `127.0.0.1`; উদাহরণে স্পষ্টভাবে LAN প্রবেশাধিকার চালু করা হয়েছে। `OTTPLAY_QUEUE_HTTP_ORIGINS` হলো কমা দিয়ে আলাদা করা সুনির্দিষ্ট ব্রাউজার origin-এর অনুমোদিত তালিকা। HTTPS-এ প্লেয়ার পরিবেশন করলে HTTPS reverse proxy ব্যবহার করুন, যাতে ব্রাউজারের mixed-content নিয়ম পোলিং অনুমোদন করে। ডিভাইস কোড গোপন রাখুন, URL-এ দেবেন না। প্লেয়ার নতুন কোড তৈরি করলে নতুন মান দিয়ে প্রক্সি পুনরারম্ভ করুন; শুধু প্লেয়ার বন্ধ করলে আলাদাভাবে পরিচালিত প্রক্সি process বন্ধ হয় না।

<a id="endpoints"></a>

### Endpoint

| পদ্ধতি | Path | বিবরণ |
|---|---|---|
| `POST` | `/api/webhook/commands` | কমান্ড সারিতে রাখা |
| `GET` | `/api/webhook/commands` | সারির কমান্ড নেওয়া (প্লেয়ারের পোলিং) |
| `POST` | `/webhook/notify` | অনুমোদিত সামঞ্জস্য alias |
| `GET` | `/webhook/poll` | অনুমোদিত সামঞ্জস্য alias |

পাঠানো ও সারি খালি করে নেওয়া দুটিতেই মিলযুক্ত Bearer ডিভাইস কোড লাগে। অনুমোদনহীন broadcast endpoint নেই। 60 সেকেন্ডে কমান্ডের মেয়াদ শেষ হয়; প্রতিটি প্রক্সি সর্বোচ্চ 50টি কমান্ড রাখে।

প্রক্সি একসঙ্গে সর্বোচ্চ 16টি সংযোগ পরিচালনা করে, তাই নিষ্ক্রিয় ব্রাউজার সংযোগ বা অসম্পূর্ণ অনুরোধ অন্য কমান্ড অনুরোধকে দেরি করায় না। প্রতিটি socket-এ পাঁচ সেকেন্ডের নিষ্ক্রিয়তার timeout আছে; সব worker ব্যস্ত থাকলে অতিরিক্ত সংযোগ বন্ধ করা হয়। সব worker-এর মধ্যে সারিতে যোগ ও সারি খালি করার কাজ atomic।

<a id="smoke-script-all-modes"></a>

### Smoke script (সব মোড)

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Android emulator/device: আগে `adb forward tcp:18081 tcp:18081`। Cap/Tauri শুধু loopback—LAN Home Assistant-এর জন্য এই Mode A প্রক্সি ব্যবহার করুন। বিস্তারিত: `docs/capacitor-mobile.md`-এর Smoke test অংশ।

<a id="cors"></a>

### CORS

প্রক্সি শুধু `OTTPLAY_QUEUE_HTTP_ORIGINS`-এর origin থেকে ব্রাউজার অনুরোধ অনুমোদন করে। অনুমোদিত origin-এর preflight `OPTIONS` অনুরোধে token লাগে না; প্রতিটি প্রকৃত GET/POST-এ Bearer ডিভাইস কোড লাগে। Wildcard ও `null` origin গ্রহণ করা হয় না। Home Assistant ও অন্যান্য অ-ব্রাউজার caller Origin বাদ দিতে পারে, কিন্তু অনুমোদন তখনও লাগে।

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### উদাহরণ: Home Assistant webhook → স্থানীয় প্রক্সি → প্লেয়ার

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

### Home Assistant automation-এর উদাহরণ

পপআপ, চ্যানেল ও ভলিউমের উদাহরণ স্থানীয় প্রক্সি ব্যবহার করে। চালু প্লেয়ারে দেখানো কোড দিয়ে Home Assistant-এর `secrets.yaml`-এ `ottplay_device_authorization`-এর মান `Bearer <device-code>` দিন।

রাতে স্ট্যান্ডবাইয়ের জন্য আলাদা [command server](docs/remote-command-server.md) লাগে। নিচের উদাহরণের URL ও `DEVICE_UUID`-এর জায়গায় নিজের controller-এর ঠিকানা ও নিবন্ধিত device ID দিন; স্থানীয় CLI alias `d1` device ID নয়। `secrets.yaml`-এ `ottplay_control_authorization`-এর মান `Bearer <controller-admin-token>` দিন। এই পরিচয়পত্র স্থানীয় প্রক্সির ডিভাইস কোড থেকে আলাদা। Home Assistant-এর [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) ও [secrets](https://www.home-assistant.io/docs/configuration/secrets/) নথি দেখুন।

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

`standby_request`-এ automation trace-এর HTTP উত্তর থাকে। HTTP 202-এর অর্থ শুধু সারিতে রাখা হয়েছে: তার `content.id` সংরক্ষণ করে প্লেয়ারের উত্তর পেতে একই controller পরিচয়পত্র দিয়ে `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` পোল করুন। নতুন `status` অনুরোধ `player.standby` ও `player.background` দেখে; standby চালু, `suspended` ও শূন্য pending মিললে প্লেয়ারের tracked কাজ শেষ হয়েছে বলে নিশ্চিত হয়। স্ট্যান্ডবাই ছাড়তে একই typed অনুরোধে `"operation":"wake"` (`ott d1 go`) ব্যবহার করুন। timeout-এর পরে না দেখে mutation পুনরাবৃত্তি করবেন না। controller-এর [request/response API](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) ও [standby semantics](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake) দেখুন।

<a id="server-api-reference"></a>

## সার্ভার API রেফারেন্স

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Webhook endpoint (Rust `ottplay-server`)

Rust সার্ভার ও archived Python fallback command endpoint-এ HTTP 403 দেয়। `/api/webhook/commands`, `/webhook/notify`, `/webhook/poll` ও command health alias কমান্ড সারিতে রাখে না, broadcast করে না বা সারি খালি করে না। সাধারণ feedback API এই সংরক্ষিত route বদলাতে পারে না। Mode A-তে কমান্ড পৌঁছায় ওপরে বর্ণিত আলাদাভাবে কনফিগার করা command server বা অনুমোদিত স্থানীয় প্রক্সির মাধ্যমে।

<a id="other-endpoints"></a>

### অন্যান্য endpoint

| পদ্ধতি | Path | বিবরণ |
|---|---|---|
| `GET` | `/epg/<hash>.json` | চ্যানেলের EPG তথ্য |
| `GET` | `/logo/<id>.svg` | তৈরি করা চ্যানেল লোগো |
| `GET` | `/version/<path>` | ফাইলের version hash |
| `POST` | `/m3u/match-channels` | চ্যানেল ও EPG মেলানো |
| `POST` | `/m3u/match-logos` | চ্যানেল লোগো মেলানো |
| `POST` | `/m3u/cp.php` | স্ট্রিম প্রক্সি |
| `GET/POST` | `/feedback/` | feedback লগ করা |
| `GET` | `/tmdb/*` | TMDb API প্রক্সি |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## প্রকল্পের গঠন

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

## STB কী ম্যাপিং

- **Samsung Tizen**: `RETURN=10009`, `ENTER=13`, রং 403-406
- **Samsung Maple**: dpad 4/5/6/8, মূল SDK কোড
- **LG WebOS**: `RETURN=461`, HbbTV-সামঞ্জস্যপূর্ণ রং
- **LG NetCast**: `RETURN=8`, HbbTV কোড
- **MAG**: `RETURN=8`, MAC-এর জন্য gSTB API
- **Dune HD**: প্রচলিত কোড, Dune API
- **Android TV**: Android keycode (`BACK=4`, `DPAD_*` 19-22, `ENTER=66`)
- **HbbTV/Panasonic/Philips/Sony/ইত্যাদি**: HbbTV কোড (`RED=403`, `BLUE=406`, `VOL_UP=447`)

<a id="documentation"></a>

## নথি

- [নথির wiki](./docs/wiki/Home.bn.md) / [Вики по-русски](./docs/wiki/Home.ru.md) — কাজভিত্তিক নেভিগেশন ও রক্ষণাবেক্ষণের নিয়ম।
- [বাস্তবায়নের প্রতিবেদন](./docs/implementation-report.bn.md) / [Процесс и результат](./docs/implementation-report.ru.md) — রঙিন ডায়াগ্রাম, যাচাইকৃত আচরণ, পরিমাপ করা খরচ ও release gate।
- [ডেলিভারি নির্দেশিকা](./docs/roadmap-delivery.bn.md) / [Руководство по новым возможностям](./docs/roadmap-delivery.ru.md) — সুবিধা, সীমাবদ্ধতা ও যাচাই।
- [ইন্টারফেসের 88 ভাষায় শুরু করার সংক্ষিপ্ত নির্দেশিকা](./docs/readme/README.md) — প্রকাশিত UI অনুবাদ থেকে তৈরি; মূল ম্যানুয়াল ও জোড়া বৈশিষ্ট্য নির্দেশিকা [নথির 24 ভাষায়](docs/manual-translations.md) পাওয়া যায়।
- [মানের সীমা ও লাইভ পুনরুদ্ধার](./docs/playback-stream-policy.bn.md) / [По-русски](./docs/playback-stream-policy.ru.md)।
- [ম্যানুয়াল XMLTV ম্যাপিং ও classic accessibility](./docs/guide-binding-accessibility.bn.md) / [По-русски](./docs/guide-binding-accessibility.ru.md)।
- [হোস্ট করা অডিও/ভিডিও পরীক্ষা](./docs/audio-video-check.bn.md) / [По-русски](./docs/audio-video-check.ru.md)।
- [Xtream মিডিয়া লাইব্রেরি](./docs/xtream-media.bn.md) / [По-русски](./docs/xtream-media.ru.md)।
- [একই উৎসের ডিভাইস হস্তান্তর](./docs/remote-handoff.bn.md) / [По-русски](./docs/remote-handoff.ru.md)।
- [পুনরুদ্ধারযোগ্য স্থানীয় সেটিং](./docs/settings-recovery.bn.md) / [По-русски](./docs/settings-recovery.ru.md)।
- [ব্রাউজারের প্রজন্ম, OS ও সুনির্দিষ্ট release-candidate পরীক্ষা](docs/browser-compatibility.bn.md) / [По-русски](docs/browser-compatibility.ru.md)।

- [প্লেয়ারের স্থাপত্য](./docs/architecture.md) — runtime মালিকানা, সরবরাহকারী ইন্টিগ্রেশন, playback, guide, device adapter ও build contract।
- [Classic ES5 build pipeline](./docs/build-pipeline.md) — compilation, compatibility check ও artifact-এর আকারের সীমা।
- [Runtime asset-এর নাম ও deployment migration](./docs/asset-layout.md) — web ও native package-এর জন্য সাধারণ বর্ণনামূলক path।
- [দূরবর্তী workbench](./docs/remote-workbench.md) — UI/media পর্যবেক্ষণ, operation receipt ও সংরক্ষিত প্রমাণ।
- [Runtime diagnostics](./docs/runtime-debug.md) — error history, frame/loop counter, Capacitor/Tauri-এর native metric ও server debugging।
- [স্থানীয় macOS delivery](./docs/macos-local-delivery.md) — checkout build, স্থানীয় ইনস্টলেশন ও যাচাই।

<a id="license"></a>

## লাইসেন্স

[MIT](LICENSE) — মুক্ত ও ওপেন সোর্স। সরবরাহকারীর কনটেন্ট ও তৃতীয় পক্ষের dependency-র নিজস্ব অধিকার ও লাইসেন্স বহাল থাকে।

PlxNative থেকে তৈরি পৃথক [OTTPlay native webOS](docs/native-webos.md) অ্যাপ্লিকেশনটি সংশ্লিষ্ট সোর্স কোডসহ **GPL-3.0-or-later** লাইসেন্সে বিতরণ করা হয়।
প্রকল্পের মূল MIT লাইসেন্স এই নেটিভ অ্যাপ্লিকেশন বা এর প্যাচগুলির লাইসেন্স পরিবর্তন করে না।

<a id="desktop-updater--notarization-mode-b"></a>

## ডেস্কটপ আপডেটার / notarization (Mode B)

[ডেস্কটপ স্বাক্ষর ও আপডেটার নির্দেশিকা](docs/tauri-updater-notarize.md)-য় macOS ad-hoc স্বাক্ষর, ঐচ্ছিক Developer ID/notarization ও bundle যাচাই বর্ণিত আছে। Release CI Apple পরিচয়পত্র ছাড়াই ad-hoc স্বাক্ষর ব্যবহার করে। আপডেটারের স্বাক্ষর পৃথক; production-এ স্বয়ংক্রিয় আপডেট এখনও কনফিগার করা হয়নি।

<a id="local-mac-build-helpers"></a>

## স্থানীয় Mac build helper

[docs/local-build-scripts.md](docs/local-build-scripts.md) দেখুন।

<a id="privacy"></a>

## গোপনীয়তা

স্থানীয় সেটিং, কনফিগার করা পরিষেবা ও নিজের পছন্দ সম্পর্কে জানতে [গোপনীয়তা নীতি](docs/privacy-policy.md) পড়ুন। গোপনীয়তা ও সহায়তার যোগাযোগ: [alvit.work@gmail.com](mailto:alvit.work@gmail.com)।

Studio 2026 ডিফল্ট ইন্টারফেস থিম। Classic ও PLi-HD বেছে নেওয়া যায়, এবং ব্যবহারকারীর সংরক্ষিত পছন্দ অক্ষুণ্ণ থাকে। [ইন্টারফেস সেটিং](docs/interface-settings.md) দেখুন। PLi-HD থিম Vali, littlesat, VU+NL, Milo ও upstream অবদানকারীদের কৃতিত্ব দেয়। ইংরেজিতে ইতিহাস ও উৎসের লিঙ্কের জন্য [ইন্টারফেসের কৃতিত্ব ও নকশার ইতিহাস](docs/interface-history.md) দেখুন; প্লেয়ারের তথ্য মেনু থেকেও পাওয়া যায়।

<a id="demo-video-editing"></a>

## ডেমো ভিডিও সম্পাদনা

প্রদর্শনমূলক রেকর্ডিং তৈরি ও সম্পাদনা করতে স্থানীয় [video-use workflow](docs/demo-video.md) ব্যবহার করুন। helper সমস্ত তৈরি মিডিয়া Git-এর বাইরে রাখে।

<a id="plex-media-library"></a>

## Plex মিডিয়া লাইব্রেরি

প্রতিটি প্লেয়ার **Plex** সরবরাহকারীর মাধ্যমে Plex account বা Plex Media Server-এ সংযুক্ত হতে পারে। ইন্টিগ্রেশন Plex ব্যবহার করে; মিডিয়া সার্ভারের সম্ভাব্য হোস্টগুলোর একটি Synology। সব অ্যাক্সেসযোগ্য ভিডিও ও মিউজিক ট্র্যাক স্বয়ংক্রিয়ভাবে চ্যানেল তালিকায় আসে; ক্যাটাগরি নির্বাচন দিয়ে লাইব্রেরি, ফোল্ডার বা সিরিজ অনুযায়ী ফিল্টার করুন। OTT server-এ Plex কনফিগার না করেই প্রথম ব্যবহারযোগ্য batch থেকে playback শুরু হয়; পেছনে লোড হওয়া, প্রচলিত অনুসন্ধান ও shuffle/repeat-এর Actions সমর্থিত। [Plex-এ সাইন-ইন ও সরাসরি playback](docs/plex-provider.md) দেখুন।

![Plex লোড হওয়া, ফাইল নেভিগেশন ও বন্ধের জীবনচক্র](docs/images/plex-playback-lifecycle.svg)

[সচিত্র নির্ভরযোগ্যতা পর্যালোচনা](docs/plex-provider.md#reliability-review-process-and-results)-য় loading ও cancellation-এর নিয়ম, সম্পূর্ণ catalog ও file switching-এর সংশোধন এবং পরিমাপ করা Chromium/WebKit যাচাই ফল ব্যাখ্যা করা হয়েছে।

ঐচ্ছিক OTT server ইন্টিগ্রেশন আলাদা NAS library entry ও M3U export দিয়ে বিদ্যমান Plex server-এর catalog ও সামঞ্জস্যপূর্ণ playback-ও প্রকাশ করে। [সার্ভারের library configuration ও client access](docs/synology-library.md) দেখুন।

<a id="related-repositories"></a>

## সংশ্লিষ্ট রেপোজিটরি

- [ottplay-core](https://github.com/open-ott-play/ottplay-core) সাধারণ JVM/ES5 domain logic, wire contract ও FOSS2 client-এর মালিক। এই প্লেয়ার তৈরি artifact ব্যবহার করে; সাধারণ পরিবর্তনের জন্য core delivery নির্দেশিকা অনুসরণ করুন।
- [ottplay-android](https://github.com/open-ott-play/ottplay-android) আলাদা native Kotlin/Compose অ্যাপ, যার নিজস্ব ইনস্টলেশন ও release পরিচয় আছে।
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server) self-hosted দূরবর্তী কমান্ড দেয়; [ottplay-swop](https://github.com/open-ott-play/ottplay-swop) ঐচ্ছিক Worker-ভিত্তিক টেক্সট ইনপুট পরিবহন দেয়।
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine) ব্রাউজার ডেমোর hosted profile, demo media ও প্রকাশনা যাচাইয়ের মালিক।

<a id="project-maintenance"></a>

## প্রকল্পের রক্ষণাবেক্ষণ

[অবদান ও পরীক্ষার প্রয়োজনীয়তা](CONTRIBUTING.md), [নিরাপত্তা প্রতিবেদন নীতি](SECURITY.md), [নিরাপত্তা নকশা](docs/security-design.md) এবং [OpenSSF প্রমাণ ও বাকি মানদণ্ড](docs/openssf-evidence.md) দেখুন।
