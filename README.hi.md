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

इंटरनेट के बिना स्थानीय फ़ाइलों के लिए [स्थानीय वीडियो और ऑफ़लाइन प्लेबैक](docs/offline-media.md) देखें।

[![परिप्रेक्ष्य दृश्य में OTT-play FOSS की चैनल सूची](docs/images/hero.png)](docs/images/studio-2026-default.png)

*कृत्रिम चैनल और कार्यक्रम डेटा के साथ मौजूदा Studio 2026 इंटरफ़ेस का स्क्रीनशॉट।
मूल सपाट दृश्य के लिए चित्र खोलें; यह किसी सक्रिय सदस्यता का स्क्रीनशॉट नहीं है।
[चित्र का स्रोत और दोबारा बनाना](docs/images/README.md)।*

[88 भाषाओं में त्वरित शुरुआत](docs/readme/README.md) · [दस्तावेज़ विकी](docs/wiki/Home.hi.md)

[![OpenSSF सर्वोत्तम प्रथाएँ](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![फ़ज़िंग: केवल RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

सार्वजनिक रिलीज़ कैंडिडेट मूल/सर्वर XMLTV पार्सिंग और पोर्टल अनुरोध सत्यापन के लिए सीमित, अलग-थलग फ़ज़िंग अभियान चलाते हैं। [फ़ज़िंग का दायरा, पुनरुत्पादन और रिलीज़ प्रमाण](FUZZING.md) देखें।

स्थानीय Rust HTTP सर्वर वाला स्वतंत्र IPTV/OTT प्लेयर। Smart TV (LG WebOS, Samsung Tizen, Panasonic, Sony आदि), सेट-टॉप बॉक्स (Infomir MAG, Dune HD, Enigma2, Android TV) और डेस्कटॉप ब्राउज़र पर चलता है।

रनटाइम की परतों, ज़िम्मेदारियों, प्रदाता विस्तार के तरीकों और सत्यापन के लिए [आर्किटेक्चर और योगदानकर्ता मार्गदर्शिका](docs/architecture.md) से शुरू करें। कोर/होस्ट सीमा और संगतता अनुबंधों के लिए [प्लेबैक सत्र और प्रदाताओं का जीवनकाल](docs/playback-session-architecture.md) देखें।

<!-- ci-release-process:start -->
<a id="release-process"></a>

## रिलीज़ प्रक्रिया

सत्यापन तथा nightly, beta, RC और स्थिर संस्करण में उन्नयन के नियमों के लिए [रिलीज़ रणनीति](RELEASING.md), और स्थानीय कमांड के लिए [संचालन पुस्तिका](docs/release-workflow.md) देखें।
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## ब्राउज़र में चलाना

[लाइव डेमो](https://player.ottplay.here.now/) खोलें या नीचे के निर्देशों से वेब प्लेयर बनाएँ और उपलब्ध कराएँ।

[स्थानीय macOS परिनियोजन](docs/local-http-deployment.md) पोर्ट 8443–8446 पर प्लेयर के HTTP origin देता है। पोर्ट 8095 अब उपयोग में नहीं है।

पहली बार खोलने पर चलती परीक्षण आकृति के लिए **डेमो आज़माएँ** चुनें, या अपनी M3U सूची अथवा प्रदाता कॉन्फ़िगर करें। बाद में डेमो **प्रदाता बदलें → डेमो** से भी उपलब्ध है।

डेमो मोड में इंटरनेट चाहिए, प्रदाता खाता नहीं। इसके बिना आवाज़ वाले MP4 और HLS परीक्षण चैनल here.now पर होस्ट होते हैं और वेब प्लेयर, Tauri, Capacitor तथा OTT Server में साझा हैं। बदलते समय मौजूदा प्रदाता सेटिंग सुरक्षित रहती हैं। अलग **चित्र और ध्वनि जाँच** के लिए प्रबंधित HTML5 इंजन पर निष्क्रिय अवस्था या लाइव टीवी देखते समय **जानकारी → ऑडियो → चलाएँ** खोलें। यह here.now पर रखी आवाज़ वाली परीक्षण फ़ाइल `av-v1.mp4` इस्तेमाल करता है और इंटरनेट चाहता है। क्लिप प्लेयर पैकेज में नहीं है और स्टार्टअप पर कभी डाउनलोड नहीं होती। VOD, आर्काइव और डिवाइस इंजन ओवरराइड (PC2/Video.js और मूल इंजन सहित) इस जाँच में शामिल नहीं हैं; [कदम, अपेक्षित स्वर और होस्टिंग आरेख](docs/audio-video-check.hi.md) देखें।

इंस्टॉल की गई डेस्कटॉप ब्राउज़र विंडो **Window Controls Overlay** का समर्थन करती हैं: Chrome अलग शीर्षक पट्टी छिपाकर विंडो बटन और ऐप मेनू को प्लेयर के ऊपर रख सकता है। इंस्टॉल किया ऐप खोलें और Chrome विकल्प दे तो **शीर्षक पट्टी छिपाएँ** चुनें; **शीर्षक पट्टी दिखाएँ** सामान्य फ्रेम वापस लाता है। सामान्य टैब और टीवी/मूल शेल लेआउट अपना मौजूदा व्यवहार रखते हैं। समर्थित इंस्टॉलेशन URL, पुराने शॉर्टकट को अपडेट करने और सत्यापन के लिए [ब्राउज़र विंडो नियंत्रण](docs/browser-window-controls.md) देखें।

मुख्य वीडियो दृश्य में दस सेकंड आगे/पीछे जाने के लिए **Alt/Option + बायाँ/दायाँ** इस्तेमाल करें (macOS पर **Command + बायाँ/दायाँ** भी काम करता है), फ़ुलस्क्रीन या सामान्य दृश्य दोनों में। स्थानीय वीडियो, VOD और समर्थित चैनल आर्काइव वेब, Tauri और Capacitor में यही नियंत्रण इस्तेमाल करते हैं। [कीबोर्ड शॉर्टकट और सीमाएँ](docs/browser-window-controls.md#playback-keyboard-shortcuts) देखें।

PC इंटरफ़ेस में **R** सूची का क्रम बदले बिना वर्तमान सूची से कोई दूसरा यादृच्छिक चैनल या वीडियो चलाता है। यह मुख्य वीडियो दृश्य और चैनल/वीडियो सूचियों में काम करता है; टेक्स्ट संपादक, संवाद, सेटिंग और किओस्क प्रतिबंध प्राथमिकता रखते हैं। अन्य डिवाइस के कुंजी मानचित्रण नहीं बदलते।

कृत्रिम परीक्षण आकृति `scripts/generate-demo-media.sh` से दोबारा बनाई जा सकती है (FFmpeg चाहिए); बना हुआ मीडिया Git द्वारा अनदेखी `.local-artifacts` डायरेक्टरी में रहता है।

<a id="features"></a>

## विशेषताएँ

- **प्लेबैक**: HLS, DASH और सामान्य HTTP स्ट्रीम, प्रबंधित HLS.js/Shaka गुणवत्ता सीमा, सीमित पुनर्प्राप्ति और प्रत्येक लाइव चैनल के लिए अधिकतम तीन स्पष्ट बैकअप URL। आर्काइव/VOD कभी लाइव बैकअप पर नहीं जाते; [गुणवत्ता और पुनर्प्राप्ति](docs/playback-stream-policy.hi.md) देखें।
- **EPG**: XMLTV मिलान, टाइम-शिफ्ट/कैच-अप, कार्यक्रम शीर्षक खोज (EPG में N5), अनुस्मारक और होस्टेड/मूल XMLTV पथ में किसी सटीक चैनल के लिए फ़ीड/ID का मैनुअल बंधन। [बंधन और पहुँचयोग्यता](docs/guide-binding-accessibility.hi.md) देखें।
- **पसंदीदा**: समर्थित होस्ट पर कॉन्फ़िगर किए गए प्रदाताओं और प्रोफ़ाइलों का एक क्रमबद्ध [मिश्रित संग्रह](docs/mixed-favorites.md), CLI से पोर्टेबल निर्यात/आयात सहित; अभिभावकीय PIN। वैकल्पिक मोड में प्रत्येक स्रोत की पसंदीदा सूचियाँ उपलब्ध रहती हैं।
- **सेटिंग**: सेटिंग और पसंदीदा का JSON निर्यात/आयात, समर्थित localStorage बैच के लिए पूर्ववत जर्नल, स्रोत के अनुसार आर्काइव जारी करना, और नियंत्रक प्रक्रियाओं के लिए सहेजी सेटिंग का सटीक मिलान। पुनर्प्राप्ति एक ही लेखक मानती है; कस्टम स्टोरेज अडैप्टर यथासंभव रोलबैक रखते हैं। [सेटिंग पुनर्प्राप्ति](docs/settings-recovery.hi.md) देखें।
- **साझा इंटरफ़ेस**: OTT Server, Tauri और Capacitor एक ही चैनल-सूची थीम और दृश्यता सेटिंग इस्तेमाल करते हैं। इंटरफ़ेस सेटिंग हाइलाइट और चयन रंग नियंत्रित करती हैं; चैनल-सूची सेटिंग नाम, पिकॉन, वर्तमान कार्यक्रम, प्रगति और आर्काइव चिह्न नियंत्रित करती हैं।
- **प्रदाता**: M3U/M3U8, Xtream लाइव टीवी और [माँग पर फ़िल्म/सीरीज़ कैटलॉग](docs/xtream-media.hi.md), Stalker/Ministra के साथ [फ़िल्में और नेस्टेड एपिसोड](docs/stalker-media.md), Plex तथा VPortal। प्रदाता क्षमताएँ और खाते की पहुँच उपलब्ध आर्काइव और मीडिया लाइब्रेरी सुविधाएँ निर्धारित करती हैं।
- **पुश कमांड**: webhook द्वारा दूरस्थ नियंत्रण — चैनल, प्रदाता, सूची बदलना और पॉपअप दिखाना
- **दूरस्थ टेक्स्ट इनपुट (swop)**: टीवी और फ़ोन अलग नेटवर्क पर हों तो Cloudflare Worker से फ़ोन कीबोर्ड (इंस्टॉलेशन-अधिकृत सत्र; वर्चुअल कीबोर्ड पर ♥™)
- **प्रति-डिवाइस रूटिंग**: कई डिवाइस के लिए UUID आधारित पते
- **स्थानीय प्रॉक्सी**: पूरी तरह स्थानीय ऑटोमेशन के लिए वैकल्पिक स्थानीय कमांड सर्वर (केंद्रीय सर्वर आवश्यक नहीं)
- **नियंत्रक एकीकरण**: डिवाइस/क्रिया तक सीमित ऑपरेटर, वैकल्पिक स्थायी कमांड परिणाम, फिर शुरू किया जा सकने वाला Local/Home प्रीसेट प्रयोग और संबंधित [नियंत्रण सर्वर](https://github.com/open-ott-play/ottplay-control-server) से उसी स्रोत का लाइव/आर्काइव हस्तांतरण। अपडेट किया नियंत्रक/CLI चाहिए; स्वतंत्र ब्राउज़र टैब ये सुविधाएँ नहीं देता।
- **टाइपयुक्त दूरस्थ प्राथमिकताएँ**: सेटिंग खोजें, सहेजे गए और प्रभावी मान पढ़ें तथा रनटाइम इंस्टेंस, स्रोत और संशोधन की जाँच के साथ सहेजें; [दूरस्थ सेटिंग और VPortal कॉन्फ़िगरेशन](docs/remote-player-settings.md) देखें।
- **डिबग**: `?debug=1` से वैकल्पिक प्लेबैक HUD/रिंग लॉग, सहमति पर दूरस्थ निरीक्षण और माँग पर होस्टेड ऑडियो/वीडियो परीक्षण
- **कीबोर्ड पहुँचयोग्यता**: नामित क्लासिक संवाद, Tab फ़ोकस रोकना और लौटाना, चयनित चैनल का अर्थपूर्ण विवरण और बिना बाधा स्थिति घोषणाएँ। ये सुधार पूर्ण WCAG या डिवाइस स्क्रीन-रीडर अनुपालन सिद्ध नहीं करते।
- **24 डिवाइस प्रकार**: प्रत्येक डिवाइस के अनुसार रिमोट कुंजी मानचित्रण
- **88 इंटरफ़ेस भाषाएँ**: संबंधित कैटलॉग, [स्थानीयकृत त्वरित मार्गदर्शिकाएँ](docs/readme/README.md) और [CLDR से जाँची कीबोर्ड वर्णमालाएँ](docs/localization.md)। मुख्य पुस्तिका और जोड़ी वाली सुविधा मार्गदर्शिकाएँ [24 दस्तावेज़ भाषाओं](docs/manual-translations.md) में उपलब्ध हैं; अन्य इंजीनियरिंग संदर्भ अपनी मौजूदा भाषाएँ रखते हैं।

[डिलीवरी मार्गदर्शिका](docs/roadmap-delivery.hi.md) इस स्रोत संशोधन में लागू सुविधाएँ, प्लेटफ़ॉर्म सीमाएँ, आरेख और सत्यापन बताती है। इंस्टॉल किए संस्करण या होस्टेड परिनियोजन पुराना संशोधन इस्तेमाल कर सकते हैं। स्वतंत्र मूल [Android ऐप](https://github.com/open-ott-play/ottplay-android) भी ऑडियो/उपशीर्षक चयन को manifest इंडेक्स के बजाय भाषा, भूमिका और लेबल से रखता है; उसका कार्यान्वयन और रिलीज़ इस frontend से अलग हैं।

[STB सोर्स समीक्षा](docs/stb-player-improvements.md) मीडिया, संसाधन उपयोग और पुनर्प्राप्ति में हुए सुधारों, उनके सोर्स कोड की तुलनाओं और मौजूदा सीमाओं को समझाती है।

<a id="debug-hud"></a>

## डिबग HUD

स्थानीय HUD और सर्वर लॉग का स्थायी संग्रह अलग-अलग सक्षम होते हैं। अन्य डिवाइस से लॉग लेने से पहले [निदान पहुँच, छिपाना और संग्रह अवधि](docs/diagnostic-security.md) देखें।

इनमें से किसी तरीके से डिबग मोड चालू करें:
- URL: `?debug=1` या `?debug=true`
- स्थानीय स्टोरेज: `localStorage.setItem("ottplay_debug", "1")`
- विंडो गुण: `window.__OTT_DEBUG__ = true`
- सर्वर: जब `/debug/config`, `{enabled: true}` लौटाता है

डिबग चालू होने पर:
- स्क्रीन की HUD पट्टी बदलने के लिए **D** दबाएँ (`ottDebugSetHud` / `__ottDebug.toggleHud()`)
  - INPUT/TEXTAREA/listEdit पर फ़ोकस हो तो छोड़ देता है
  - MAG/Maple PLAY/PREV=68 टकराव से बचने के लिए `e.key` इस्तेमाल करता है
- जानकारी मेनू → **डिबग HUD** → `__ottDebug.toggleHud()` बुलाता है
- सेटिंग प्रबंधन → **डिबग HUD**:
  - डिबग पहले लोड हो चुका हो: HUD की दृश्यता बदलता है
  - अन्यथा: `ottplay_debug=1` + `ottplay_debug_hud=1` सेट करता है और पुनः आरंभ माँगता है
- स्थायित्व: `ottDebugSetHud`, HUD स्थिति को `localStorage.ottplay_debug_hud` में ("1"/"0") सहेजता है

<a id="capacitor-ios-and-android"></a>

## iOS और Android के लिए Capacitor

यह रिपॉज़िटरी साझा TypeScript frontend को Capacitor के साथ iOS और Android 7+ के लिए पैक करती है। दोनों सिस्टम फ़ॉन्ट और npm से लॉक मूल रनटाइम इस्तेमाल करते हैं। अलग API 22 संगतता APK, WebView 60 या नए के साथ Android 5.1/6 समर्थित करता है। दोनों Android APK हस्ताक्षरित हैं और योग्य beta, RC तथा स्थिर रिलीज़ में बिना हस्ताक्षर के iOS IPA के साथ शामिल हैं। स्वतंत्र Kotlin ऐप [ottplay-android](https://github.com/open-ott-play/ottplay-android) में रहता है।

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

[Capacitor कॉन्फ़िगरेशन](docs/capacitor-mobile.md) और [Android वितरण तथा दूरस्थ अपडेट](docs/android-distributions.md) देखें।

iOS इंटरफ़ेस लैंडस्केप दिशा इस्तेमाल करता है। सेटिंग, प्रदाता कॉन्फ़िगरेशन, दूरस्थ नियंत्रण सहमति और JSON आयात/निर्यात साझा frontend इस्तेमाल करते रहते हैं। टैबलेट मल्टीटास्किंग माँगी हुई दिशा बदल सकती है।

iPhone पर चैनल सूची को ऊपर-नीचे स्वाइप करके पंक्तियों और पृष्ठों में जाएँ; आगे के चैनलों के लिए ऊपर, पहले वालों के लिए नीचे। तेज़ स्वाइप कई पृष्ठों तक चलता है और धीरे-धीरे रुकता है; धीमा खींचना सटीक रहता है। स्क्रीन छूकर या नेविगेशन कुंजी दबाकर गति रोकें। एक टैप उँगली के नीचे का चैनल शुरू करता है, भले दूसरी पंक्ति चयनित हो। स्वाइप में उँगली उठाने पर चैनल कभी नहीं खुलता।

iPhone में वीडियो इंटरफ़ेस के अंदर चलता है। कार्यक्रम जानकारी के लिए स्क्रीन का निचला भाग छुएँ या प्लेबैक चलते हुए मेनू खोलें। Picture in Picture अलग प्लेबैक विकल्प बना रहता है।

डिवाइस मूल परीक्षण: [Mode B जाँच सूची](docs/mode-b-device-smoke.md) और `./scripts/smoke-capacitor-device.sh --help` (build/sync लक्ष्य केवल iOS)। Tauri डेस्कटॉप परीक्षण: [डेस्कटॉप जाँच सूची](docs/mode-b-tauri-smoke.md)।

<a id="installation"></a>

## इंस्टॉलेशन

| प्लेटफ़ॉर्म | पैकेज | टिप्पणी |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Apple Silicon और Intel के अलग बिल्ड; Apple हस्ताक्षर कॉन्फ़िगर न हों तो ad-hoc हस्ताक्षर |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | विभिन्न वितरण |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode या Homebrew Channel](docs/lg-webos-installation.md); होस्ट किया गया प्लेयर, नेटवर्क आवश्यक |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode और स्थानीय हस्ताक्षर; अहस्ताक्षरित TV पैकेज, Family Hub से अलग](docs/samsung-tizen-installation.md) |
| **iOS** | AltStore / TestFlight / Xcode से `.ipa` | केवल साइडलोड — अभी App Store पर नहीं |
| **Android (साझा frontend)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | हस्ताक्षरित Capacitor पैकेज; समर्थित Android संस्करण चुनें |
| **Android (मूल Kotlin)** | अलग [मूल ऐप](https://github.com/open-ott-play/ottplay-android) | सार्वजनिक रिपॉज़िटरी; अलग ऐप और रिलीज़ प्रक्रिया |

समर्थित इंस्टॉलर योग्य GitHub रिलीज़ में जुड़े हैं: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **ध्यान दें:** Apple हस्ताक्षर जानकारी न होने पर macOS बंडल ad-hoc हस्ताक्षर इस्तेमाल करते हैं; यह Developer ID या नोटरीकरण नहीं देता। Windows/Linux इंस्टॉलर और iOS रिलीज़ पैकेज बिना हस्ताक्षर हो सकते हैं। iOS को भौतिक डिवाइस पर इंस्टॉल करने से पहले हस्ताक्षर चाहिए। योग्य Full और API 22 Android रिलीज़ APK स्थापित हस्ताक्षर प्रमाणपत्र इस्तेमाल करते हैं; स्थानीय रिलीज़ बिल्ड को हस्ताक्षरित APK बनाने के लिए कॉन्फ़िगर किया keystore चाहिए।

---

<a id="macos"></a>

### macOS

1. [रिलीज़](https://github.com/open-ott-play/ottplay-foss/releases) से सही टैग चुनें। नवीनतम रिलीज़ शॉर्टकट स्थिर संस्करण चुनता है, beta या RC नहीं।
2. Apple Silicon के लिए `OttPlay.FOSS_*_aarch64-apple-darwin.dmg` या Intel के लिए `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` डाउनलोड करें। ये अलग आर्किटेक्चर बिल्ड हैं।
3. `.dmg` खोलें और **OttPlay FOSS.app** को Applications में खींचें।
4. पहली बार खोलने से पहले कॉपी किए बंडल की जाँच करें:

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

सफल सत्यापन बंडल की अखंडता जाँचता है। `Signature=adhoc` का अर्थ है कि ऐप के पास Apple द्वारा सत्यापित डेवलपर पहचान नहीं है; इससे नोटरीकरण या Gatekeeper अनुमति सिद्ध नहीं होती। भरोसेमंद डाउनलोड और सही बंडल के बावजूद पहले प्रयास के बाद macOS में **System Settings → Privacy & Security → Open Anyway** आवश्यक हो सकता है; [Apple निर्देश](https://support.apple.com/en-us/102445) देखें।

“ऐप क्षतिग्रस्त है” संदेश अकेले क्वारंटीन का प्रमाण नहीं है। हस्ताक्षर सत्यापन विफल हो तो त्रुटि सुरक्षित रखें और सुधारी हुई रिलीज़ लें। विफल सत्यापन को सफल दिखाने के लिए डाउनलोड किया ऐप दोबारा हस्ताक्षरित न करें और उसके गुण न हटाएँ।

ZIP विकल्प `OttPlay.FOSS_aarch64-apple-darwin.app.zip` और `OttPlay.FOSS_x86_64-apple-darwin.app.zip` हैं। निकालने, डिस्क इमेज और Gatekeeper जाँच के लिए [macOS हस्ताक्षर और आर्टिफ़ैक्ट सत्यापन](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact) देखें। Checkout बिल्ड और स्थानीय इंस्टॉलेशन के लिए [स्थानीय macOS डिलीवरी](docs/macos-local-delivery.md) इस्तेमाल करें।

---

<a id="windows"></a>

### Windows

1. [रिलीज़](https://github.com/open-ott-play/ottplay-foss/releases/latest) से `.msi` या `.exe` डाउनलोड करें
2. इंस्टॉलर चलाएँ और निर्देशों का पालन करें
3. Start Menu या Desktop शॉर्टकट से खोलें

---

<a id="linux"></a>

### Linux

Linux प्लेबैक को WebKitGTK के अलावा GStreamer HLS, H.264 और AAC प्लगइन चाहिए। पैकेज इन मीडिया निर्भरताओं की घोषणा करते हैं; AppImage बिल्ड में मीडिया फ़्रेमवर्क शामिल है। कोडेक जाँच और ब्राउज़र/मूल स्वीकृति के अंतर के लिए [Linux मीडिया पैकेजिंग](docs/linux-media-packaging.md) देखें।

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

### iOS इंस्टॉलेशन

iOS को भौतिक डिवाइस पर इंस्टॉल करने से पहले हस्ताक्षर चाहिए। बिना हस्ताक्षर वाली रिलीज़ IPA के लिए AltStore Classic इस्तेमाल करें या Xcode से स्रोत को बिल्ड और हस्ताक्षरित करें। उपलब्ध होने पर TestFlight को अलग निमंत्रण चाहिए।

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### विकल्प 1: AltStore Classic (व्यक्तिगत उपयोग के लिए अनुशंसित)

AltServer आपके कंप्यूटर पर चलता है; AltStore Classic iPhone/iPad पर चलता और IPA आयात करता है। मुफ़्त Apple Account पर्याप्त है।

**पूर्वापेक्षाएँ:**

- वर्तमान OTT-play बिल्ड के लिए **iOS/iPadOS 15 या बाद का** iPhone/iPad।
- AltServer वाला Mac या Windows PC और USB डेटा केबल।
- हस्ताक्षर के लिए Apple Account और रिलीज़ डाउनलोड करने के लिए इंटरनेट।

**चरण 1: AltStore एक बार सेट करें**

1. आधिकारिक [macOS सेटअप](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) या [Windows सेटअप](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows) से AltServer इंस्टॉल करें। उसे चालू करें और मेनू बार/सिस्टम ट्रे का आइकन इस्तेमाल करें।
2. डिवाइस USB से जोड़ें, अनलॉक करें और कंप्यूटर/डिवाइस के भरोसा अनुरोध स्वीकारें। Mac पर जाँचें कि डिवाइस Finder में दिखता है।
3. **AltServer मेनू → Install AltStore** में डिवाइस चुनें और हस्ताक्षर खाते के अनुरोध पूरे करें। इंस्टॉलेशन सूचना का इंतज़ार करें।
4. डिवाइस पर **Settings → General → VPN & Device Management** खोलें और माँगे जाने पर अपने हस्ताक्षर खाते की डेवलपर प्रविष्टि पर भरोसा करें। iOS 16+ पर **Settings → Privacy & Security → Developer Mode** चालू करें और पुनः आरंभ/पुष्टि पूरी करें।
5. डिवाइस पर AltStore खोलें। पहले से इंस्टॉल और काम कर रहा हो तो यह सेटअप छोड़ें और नीचे के आयात के लिए AltServer चलने दें।

**चरण 2: चुनी रिलीज़ iPhone/iPad पर आयात करें**

1. [सभी रिलीज़](https://github.com/open-ott-play/ottplay-foss/releases) से सटीक टैग चुनें और उसकी `ottplay-foss-ios-unsigned.ipa` डिवाइस पर Safari में डाउनलोड करें। [नवीनतम रिलीज़ शॉर्टकट](https://github.com/open-ott-play/ottplay-foss/releases/latest) स्थिर संस्करण चुनता है; beta के लिए पूरी सूची इस्तेमाल करें।
2. IPA को Files में सहेजें। **AltStore → My Apps → +** में वह फ़ाइल चुनें। Mac पर डाउनलोड IPA को AirDrop से भेजकर आयात से पहले Files में भी सहेज सकते हैं। Mac पर IPA खोलना यह आयात चरण नहीं है।
3. AltStore के ऐप को हस्ताक्षरित और इंस्टॉल करते समय AltServer चलता रहे और USB जुड़ा रहे। अपडेट के लिए मौजूदा इंस्टॉलेशन वाला हस्ताक्षर खाता इस्तेमाल करें; समस्या निवारण के पहले कदम में ऐप न हटाएँ।
4. आयात पूरा होने दें, **My Apps** में OTT-play जाँचें और खोलें।

**विकल्प: रिलीज़ URL सीधे आयात करें**

AltStore पहले से इंस्टॉल हो तो यह पैटर्न **iPhone के Safari** में डालें, `TAG` की जगह सटीक रिलीज़ टैग रखें और **Open in AltStore** स्वीकारें:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

यह AltStore का [इंस्टॉल URL हैंडलर](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift) इस्तेमाल करता है। कई डाउनलोड के एक जैसे नाम होने पर Files/Recents की अस्पष्टता से बचाता है। URL को IPA फ़ाइल की ओर जाना चाहिए, रिलीज़ पृष्ठ की ओर नहीं।

उदाहरण के लिए नीचे का आयात **2026-09-29** को AltStore 2.3 और AltServer 1.8.1 के साथ जाँचा गया था। यह स्थिर ऐतिहासिक उदाहरण है, नवीनतम संस्करण का लिंक नहीं:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**नवीनीकरण:** मुफ़्त खाते के इंस्टॉलेशन सात दिन बाद समाप्त होते हैं। AltServer पहुँच योग्य रखें और समाप्ति से पहले **AltStore → My Apps → Refresh All** इस्तेमाल करें। पृष्ठभूमि नवीनीकरण को भी AltServer चाहिए; [AltStore नवीनीकरण निर्देश](https://faq.altstore.io/altstore-classic/your-altstore) देखें।

<a id="verify-the-installed-version-before-retrying"></a>

#### फिर कोशिश करने से पहले इंस्टॉल संस्करण जाँचें

AirDrop का “Sent” संदेश केवल स्थानांतरण की पुष्टि करता है। AltStore की प्रगति पट्टी आयात शुरू होने की पुष्टि करती है। Mirroring/USB का कनेक्शन टूटना इंस्टॉलेशन विफल होने का प्रमाण नहीं: IPA फिर भेजने से पहले इंस्टॉल ऐप जाँचें।

ऐसे Mac पर जहाँ Xcode इंस्टॉल और सक्रिय डेवलपर डायरेक्टरी के रूप में चुना है, दोबारा इंस्टॉल किए बिना डिवाइस देखें:

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

JSON के `result.apps` में OTT-play खोजें (`bundleIdentifier`, `play.ott.foss` से शुरू होता है) और `version` तथा `bundleVersion` दोनों को चुनी IPA के `CFBundleShortVersionString` और `CFBundleVersion` से मिलाएँ। बंडल पहचान में AltStore हस्ताक्षर खाते का प्रत्यय अपेक्षित है। डिवाइस रिपोर्ट स्थानीय रखें।

जाँचा गया beta.9 उदाहरण **संस्करण `1.1.51`, बिल्ड `2.2.66`** दिखाता है। यह इंस्टॉलेशन की पुष्टि है; ऐप खोलना, Cloudflare लॉगिन, सूची लोड करना, प्लेबैक और PiP अलग डिवाइस जाँचें हैं।

<a id="troubleshooting-ios-installation"></a>

#### iOS इंस्टॉलेशन समस्या निवारण

- **AltServer की विंडो नहीं है या ऑटोमेशन से खोलना टाइमआउट होता है:** मेनू बार/सिस्टम ट्रे का आइकन इस्तेमाल करें। यह पृष्ठभूमि ऐप है। बार-बार सामान्य विंडो खोलने का प्रयास IPA आयात नहीं करता।
- **“Could not find AltServer” या USB डिवाइस उपलब्ध नहीं:** AltServer चल रहा है यह जाँचें, फ़ोन अनलॉक करें और कंप्यूटर/डिवाइस भरोसा अनुरोध देखें। Mac पर Finder में डिवाइस देखें। कनेक्शन टूटा हो तो सुरक्षित समय पर फिर जोड़ें, फिर दोबारा प्रयास से पहले इंस्टॉल संस्करण जाँचें। समस्या बनी रहे तो [AltStore कनेक्टिविटी समस्या निवारण](https://faq.altstore.io/altstore-classic/troubleshooting-guide) पढ़ें। फ़ोन कंप्यूटर का इंटरनेट देता हो तो केबल/नेटवर्क बदलाव समन्वित करें ताकि अन्य काम न रुकें।
- **iPhone Mirroring “iPhone in Use” कहता है या “Connecting” पर रहता है:** भौतिक फ़ोन पर सेटअप पूरा करें या स्क्रीन लॉक करके अनलॉक Mac के पास रखें। फ़ोन अनलॉक करने से Mirroring समाप्त होता है; USB भरोसा/सेटअप के लिए पहले अनलॉक आवश्यक हो सकता है। एक पुनः कनेक्शन के बाद भी अटके तो Mirroring बंद करें और फ़ोन पर जारी रखें। [Apple Mirroring आवश्यकताएँ](https://support.apple.com/en-us/120421) देखें। इंस्टॉलेशन के लिए Mirroring वैकल्पिक है।
- **Mirroring में URL के लैटिन अक्षर गायब होते या सिरिलिक बनते हैं:** **Mac इनपुट स्रोत ABC/English** करें। Mirroring पर फ़ोकस के साथ **Control–Space** दबाकर iPhone हार्डवेयर कीबोर्ड के लिए **English (US)** चुनें। Mac और iPhone के स्रोत अलग हो सकते हैं; हमारे सत्यापित सत्र में केवल Mac बदलना पर्याप्त नहीं था। फ़ील्ड साफ़ करें, URL दोबारा लिखें और भेजने से पहले पता जाँचें।
- **Mirroring में क्लिपबोर्ड पेस्ट अटकता या अनपेक्षित टेक्स्ट डालता है:** फ़ील्ड साफ़ करके iPhone के English (US) स्रोत से छोटे भागों में धीरे लिखें या सीधे फ़ोन पर URL डालें। तेज़ Mirroring इनपुट अक्षर छोड़ या दोहरा सकता है; सहेजने से पहले पूरा पता जाँचें। आधा पेस्ट हुआ URL न भेजें। हमारे इंस्टॉलेशन सत्र में पेस्ट विफल था; सीधे URL वाले तरीके के लिए यह आवश्यक नहीं है।
- **Files/Recents में कई समान IPA नाम हैं:** सटीक डाउनलोड स्थान चुनें या ऊपर का टैग वाला सीधा URL इस्तेमाल करें। स्पष्टता के लिए स्थानीय कॉपी का नाम टैग/बिल्ड के साथ बदला जा सकता है; नाम बदलना सामग्री नहीं बदलता।
- **इंस्टॉल ऐप नहीं खुलता:** फ़ोन पर डेवलपर भरोसा या Developer Mode के निर्देश पूरे करें। AltStore में समाप्ति जाँचें और ज़रूरत पर नवीनीकरण करें। फिर भी विफल हो तो वास्तविक त्रुटि लिखें; अकेली कनेक्शन त्रुटि ऐप हटाने और पुनः इंस्टॉल करने का कारण नहीं है।
- **OTT-play खुलता है लेकिन सुरक्षित सूची मोबाइल नेटवर्क पर विफल है:** इंस्टॉलेशन और स्रोत प्रमाणीकरण अलग हैं। **Settings → Manage settings → Source access** से कॉन्फ़िगर स्रोत में लॉगिन करें, फिर सूची पुनः लोड करें। आवश्यक हो तो बायोमेट्रिक/passkey या ईमेल कोड भौतिक डिवाइस पर पूरा करें। स्रोत को [iOS Access एकीकरण](docs/ios-source-access.md) समर्थित होना चाहिए; ऐप इंस्टॉल करना IP अनुमत सूची को नहीं पार करता।
- **भरोसेमंद Wi-Fi पर passkey माँगी जा रही है:** iOS Access वाले स्रोतों में ऐप पहले मूल स्रोत बिना लॉगिन आज़माता है और पहुँच अस्वीकृत होने के बाद ही प्रमाणित मोबाइल प्रवेश इस्तेमाल करता है। स्रोत को वास्तव में दिख रही सार्वजनिक IP, IPv6 सहित, जाँचें: अनुमत घरेलू IPv4 दूसरे IPv6, VPN या मोबाइल पते को नहीं समेटती। नेटवर्क बदलाव और ऐप दोबारा खोलना अस्थायी रूट पसंद साफ़ करते हैं। सामान्य नेटवर्क/सर्वर त्रुटि से लॉगिन नहीं माँगा जाना चाहिए।
- **लॉगिन अब नहीं आता लेकिन चैनल सूची खाली है:** वैध सहेजा सत्र बिना फिर पूछे इस्तेमाल होता है। पहले की लोड विफलता या सर्वर सुधार के बाद सूची फिर लोड करें या ऐप एक बार पूरी तरह बंद करके खोलें। फिर भी समस्या हो तो जाँचें कि स्रोत सूची लौटाता है, HTML लॉगिन पृष्ठ या JSON त्रुटि नहीं। दिखाई त्रुटि और HTTP स्थिति लिखें; क्रेडेंशियल, कुकी या Access टोकन वाले स्रोत URL साझा न करें।
- **चैनल लोड होते हैं लेकिन वीडियो बफ़र करता या `SRC_NOT_FOUND` दिखाता है:** सूची लोड करना और वीडियो चलाना अलग जाँचें हैं। लॉगिन के बाद चैनल एक बार दोबारा आज़माएँ; जारी रहने पर HLS manifest/segment प्रतिक्रियाएँ और स्ट्रीम कोडेक समर्थन जाँचें। यह त्रुटि अकेले इंजन बदलने या पुनः इंस्टॉलेशन से लाभ साबित नहीं करती।

<a id="option-2-testflight-if-available"></a>

#### विकल्प 2: TestFlight (यदि उपलब्ध हो)

TestFlight निमंत्रण प्रकाशित हो तो App Store से TestFlight इंस्टॉल करें, डिवाइस पर निमंत्रण खोलें और **Install** दबाएँ। GitHub से IPA डाउनलोड करना TestFlight निमंत्रण नहीं देता।

<a id="option-3-xcode-for-developers"></a>

#### विकल्प 3: Xcode (डेवलपर के लिए)

[बिल्ड करें और खोलें](docs/capacitor-mobile.md#build-and-open) निर्देश अपनाएँ, Xcode में **App** लक्ष्य चुनें, **Signing & Capabilities** में डेवलपर टीम सेट करें, जुड़ा डिवाइस चुनें और बिल्ड/रन करें। आवश्यक डिवाइस भरोसा और Developer Mode अनुरोध पूरे करें। बिना हस्ताक्षर रिलीज़ IPA को Xcode के Devices में आयात करना अनुपस्थित हस्ताक्षर पहचान या provisioning profile नहीं देता।

---

<a id="android-application"></a>

### Android ऐप

साझा प्लेयर इंटरफ़ेस के लिए इस रिपॉज़िटरी की रिलीज़ का Full Capacitor APK चुनें। Android 5.1–6 पर API 22 संगतता APK इस्तेमाल करें; WebView 60 या नया चाहिए। अपडेट में ऐप पहचान और हस्ताक्षर प्रमाणपत्र बनाए रखें ताकि पुराने प्रोफ़ाइल उपलब्ध रहें। [बिल्ड निर्देश](android/README.md) और [वितरण, हस्ताक्षर तथा दूरस्थ इंस्टॉलेशन](docs/android-distributions.md) देखें।

अलग [ottplay-android रिपॉज़िटरी](https://github.com/open-ott-play/ottplay-android) में मूल Kotlin/Compose ऐप है। उसकी अपनी पहचान, पसंद और रिलीज़ प्रक्रिया है; वह मौजूदा Capacitor इंस्टॉलेशन को सीधे प्रतिस्थापित नहीं करता। ऐतिहासिक रिलीज़ फ़ाइलें उपलब्ध रहती हैं।

---

<a id="quick-start"></a>

## त्वरित शुरुआत

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

ब्राउज़र के मूल परीक्षण के लिए उसी संशोधन का अपना परिनियोजन इस्तेमाल करें।

Node 22 और स्थिर Rust टूलचेन इस्तेमाल करें। सर्वर रिपॉज़िटरी की जड़ से चलाएँ ताकि स्थिर संसाधन उपलब्ध हों। मूल बिल्ड को नीचे वर्णित प्लेटफ़ॉर्म टूलचेन चाहिए; केवल सर्वर बिल्ड के लिए वे आवश्यक नहीं हैं।

पहली बार लोड होने पर **डेमो आज़माएँ** चुनें या **सेटिंग → प्रदाता बदलें → M3U / M3U8 सूचियाँ** खोलें। **सूची चुनें** खोलकर स्लॉट चुनें, **सूची URL** डालें, संपादन सहेजें और **सूची लोड करें** चुनें। सूची या प्रदाता खाता आप देते हैं; ऐप सशुल्क चैनल सदस्यता नहीं देता।

<a id="mode-a-companion-smoke"></a>

## Mode A companion का मूल परीक्षण

Mode A companion के लिए curl आधारित परीक्षण (`ottplay-server` / `archive/server.py` समता): index, स्थिर डायरेक्टरी, `/logo`, `/version`, वैकल्पिक `/epg`, और बिना डाउनलोड किए `POST /m3u/cp.php` जाँच।

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

जाँचें `scripts/modea-smoke-checks.json` में हैं। कोई रहस्य नहीं। कमांड कतार / `local_proxy.py` (:8081) की जाँच अलग से `scripts/smoke-command-queue.sh` करता है (यदि मौजूद हो)।

<a id="classic-stalker--ministra-portals"></a>

## क्लासिक Stalker / Ministra पोर्टल

**Stalker पोर्टल** चुनकर प्रदाता का MAC और पूरा पोर्टल URL डालें, जैसे `http://provider.example/stalker_portal/c/`। `/c/index.html`, `/stalker_portal`, `/server/load.php`, `/load.php` और `/portal.php` URL क्लासिक MAG प्रोटोकॉल चुनते हैं। मौजूदा केवल-सर्वर कॉन्फ़िगरेशन JSON-RPC रखते हैं। प्रदाता साझा Stalker कोर से प्रोफ़ाइल, श्रेणियाँ और पृष्ठों में लाइव चैनल लोड करता है, फिर पृष्ठभूमि में क्लासिक `type=vod` प्रोटोकॉल की फ़िल्में और नेस्टेड एपिसोड खोजता है। फ़ोल्डर पथ सामान्य चैनल सूची में श्रेणियाँ बन जाते हैं; उपलब्ध विवरण, पोस्टर और वैश्विक पसंदीदा की स्थिर प्रविष्टियाँ उसी मीडिया इंटरफ़ेस का उपयोग करती हैं। [कैटलॉग का व्यवहार और सीमाएँ](docs/stalker-media.md) देखें।

स्वयं होस्ट किए गए ब्राउज़र संस्करण के अनुरोध companion के `/stalker/api` endpoint से जाते हैं; मूल ऐप मौजूदा HTTP परिवहन इस्तेमाल करते हैं। होस्टेड ब्राउज़र संस्करणों के लिए [समर्पित रिले](docs/stalker-relay.md) से होकर जाने वाले रूट स्पष्ट रूप से कॉन्फ़िगर करना ज़रूरी है। ब्राउज़र और सर्वर संसाधन साथ अपडेट होने चाहिए।

लाइव प्लेबैक स्ट्रीम खोलते समय अस्थायी चैनल कमांड हल करता है; चैनल बदलना, रोकना, PiP और प्रदाता बदलना पुरानी प्रक्रियाएँ रद्द करते हैं। स्पष्ट गैर-अस्थायी HTTP(S) कमांड सीधे चलती हैं। संक्षिप्त EPG समर्थित है। इस प्रदाता में क्लासिक पोर्टल आर्काइव और अलग `type=series` प्रोटोकॉल रूप उपलब्ध नहीं हैं। मौजूदा JSON-RPC आर्काइव/गाइड व्यवहार नहीं बदलता। अन्य companion प्रॉक्सी रूट की तरह, companion रूट से जुड़े निजी LAN पोर्टल को सटीक `OTTPLAY_PROXY_LAN_ORIGINS` प्रविष्टि चाहिए।

सार्वजनिक Infomir डेमो `http://middleware-stalker.com/stalker_portal/c/` है। उसने 2026-09-26 को तीन लाइव कैटलॉग प्रविष्टियाँ दीं, लेकिन मीडिया endpoint उपलब्ध नहीं थे; प्लेबैक रिग्रेशन के लिए नियंत्रित पोर्टल/मीडिया परीक्षण डेटा इस्तेमाल करें।

<a id="m3u-stream-proxy-header-smoke"></a>

## M3U स्ट्रीम प्रॉक्सी हेडर परीक्षण

नियंत्रित echo URL लेते समय Mode A companion `POST /m3u/cp.php` द्वारा जोड़े गए अपस्ट्रीम अनुरोध हेडर की तुलना करता है (डिफ़ॉल्ट स्थानीय mock — IPTV प्रदाता या रहस्य नहीं)।

अनुबंध (`src-rs/core/src/m3u.rs` + `archive/server.py` से):
- केवल **User-Agent** जोड़ता है (डिफ़ॉल्ट `OTT-play-FOSS/1.0`, या प्रीसेट `webos` / `tizen` / `viera` / `mag` / `dune`)।
- **Referer नहीं** जोड़ता (Capacitor `M3UProxy` जोड़ता है; Mode A नहीं)।
- `url` के शुरू का `@` हटाता है (प्रदाता का jQuery फ़ॉर्म)।

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

निकास: `0` सफल, `1` सुन नहीं रहा, `2` हेडर/HTTP अंतर, `3` उपयोग/निर्भरताएँ। `smoke-modea-companion.sh` / `smoke-command-queue.sh` से संबंधित।

<a id="logo-concurrent-bench-smoke"></a>

## लोगो का समवर्ती बेंच परीक्षण

Mode A companion के विरुद्ध समवर्ती `GET /logo/<id>.svg` (वैकल्पिक `?ch=`) का विलंब परीक्षण। सफलता/विफलता संख्या और p50/p95/p99 बताता है। डिफ़ॉल्ट CI के लिए व्यावहारिक स्थानीय लोड है (`CONCURRENCY=200`, `TOTAL=1000`); पूरा 10 हज़ार का लंबा परीक्षण वैकल्पिक है (`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`)।

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

निकास: `0` सफल, `1` सुन नहीं रहा / कनेक्शन विफल, `2` अधिक त्रुटि दर, `3` उपयोग। `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh` से संबंधित।

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## XMLTV कैश ताज़ाकरण / वार्म-अप परीक्षण

Mode A companion के XMLTV/EPG कैश व्यवहार को `src-rs` के अनुसार ईमानदारी से जाँचता है (काल्पनिक API नहीं):

- मेमोरी का `EPG_CACHE`, `GET /epg/:hash` से मिलता है → हमेशा `{"epg_data":[...]}` (HTTP 200)।
- प्रक्रिया शुरू होने पर HTTP स्टार्टअप रोके बिना पृष्ठभूमि में `EPG_URLS` डाउनलोड होते हैं; हर पूर्ण डाउनलोड के बाद अगले ताज़ाकरण से पहले **2h** इंतज़ार होता है।
- `DATABASE_URL` सेट हो तो वैकल्पिक SQLite स्थायित्व (कैश स्थिति का सार्वजनिक endpoint नहीं)।
- `GET /health` → `OK` वैकल्पिक पुनः आरंभ के बाद HTTP तैयार होने की पुष्टि करता है। `--strict-epg` और `--epg-hash` के साथ परीक्षण उसी `--warmup-timeout` सीमा में उस चैनल का गैर-रिक्त EPG भी प्रतीक्षा करता है।

डिफ़ॉल्ट रास्ता केवल curl करता है — **प्रक्रियाएँ समाप्त नहीं करता**। स्वतः समाप्ति+पुनः आरंभ के लिए `--restart-cmd` / `RESTART_CMD` दें, या `--help` के मैनुअल `launchctl` कदम अपनाएँ।

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

निकास: `0` सफल, `1` सुन नहीं रहा, `2` assert/वार्म-अप विफल, `3` उपयोग। `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh` से संबंधित।

<a id="mode-a-e2e-play-path-smoke"></a>

## Mode A E2E प्लेबैक पथ परीक्षण

Companion की ओर **प्लेबैक पथ / स्ट्रीम तैयारी** परीक्षण (केवल HTTP — दिखाई देने वाले UI का E2E **नहीं**)। चल रहे Mode A companion पर यह जाँचता है:

- Health या index पहुँचा जा सकता है
- प्लेयर शेल के स्थिर संसाधन (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`)
- `EPG_HASH` सेट हो तो वैकल्पिक `GET /epg/<hash>.json`
- रहस्य-रहित JSON परीक्षण डेटा के साथ `POST /m3u/match-channels` (खाली सूची + एक कृत्रिम चैनल)
- स्ट्रीम प्रॉक्सी **प्ले**: नियंत्रित मीडिया पर `POST /m3u/cp.php` (डिफ़ॉल्ट स्थानीय HLS सूची या `MEDIA_URL`) और HTTP 200 + गैर-रिक्त बॉडी / अपेक्षित `Content-Type` की जाँच (प्रॉक्सी से शुरुआती बाइट)

निजी IPTV क्रेडेंशियल नहीं। `smoke-modea-companion.sh` (उपस्थिति), `smoke-m3u-stream-proxy-headers.sh` (UA/Referer), `smoke-xmltv-cache-refresh.sh` से संबंधित।

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

निकास: `0` सफल, `1` सुन नहीं रहा, `2` assert विफल, `3` उपयोग/निर्भरताएँ।

<a id="capacitor-device-smoke-mode-b"></a>

## Capacitor डिवाइस परीक्षण (Mode B)

Mode B Cap के लिए सिम्युलेटर/एम्युलेटर (वैकल्पिक असली डिवाइस) **जाँच सूची** — Mode A companion HTTP नहीं। UI सफलता मानव चिह्नित करता है; सहायक टूलचेन/मूल डायरेक्टरी/कमांड कतार का नरम curl परीक्षण स्वचालित करता है।

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

विवरण: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md)। `smoke-command-queue.sh` (Cap loopback) से संबंधित — ऊपर के Mode A परीक्षणों से न मिलाएँ।

<a id="tauri-desktop-smoke-mode-b"></a>

## Tauri डेस्कटॉप परीक्षण (Mode B)

Mode B Tauri के लिए डेस्कटॉप जाँच सूची और सहायक (विंडो / चैनल प्ले / PiP)। Mode A companion HTTP नहीं, Cap डिवाइस परीक्षण भी नहीं।

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

विवरण: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md)। स्थानीय परीक्षण के लिए Apple डेवलपर क्रेडेंशियल वैकल्पिक हैं; पैक किए Mac ऐप के लिए [ad-hoc हस्ताक्षर](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials) इस्तेमाल करें। मानव स्वीकृति में फिर भी लॉन्च, प्लेबैक और PiP शामिल हैं।

<a id="docker"></a>

## Docker

बहु-आर्किटेक्चर इमेज (amd64/arm64) उम्मीदवार OCI आर्काइव के रूप में बनती हैं। रजिस्ट्री प्रकाशन स्वीकृत स्थिर आर्काइव को बिना दोबारा बिल्ड किए Docker Hub पर बढ़ाता है; [संचालन पुस्तिका](docs/release-workflow.md) देखें।

सर्वर बाइनरी **musl** (Alpine) पर बनती और Alpine पर दी जाती है — GLIBC_2.38+ की आवश्यकता **नहीं**। इससे `alvit/ottplay-foss` Synology DSM Docker (x86_64) और पुराने glibc वाले अन्य होस्ट पर चलता है।

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

स्थिर रजिस्ट्री टैग `X.Y.Z` इस्तेमाल करते हैं। `latest` अपडेट करना संस्करण वाली इमेज प्रकाशित होने के बाद अलग स्पष्ट विकल्प है; main push और Git tag इमेज प्रकाशित नहीं करते।

<a id="build-from-source"></a>

## स्रोत से बिल्ड

प्लेयर के डोमेन नियम `vendor/ottplay-core.js` में पिन किए Kotlin multiplatform आर्टिफ़ैक्ट से आते हैं। गाइड, आर्काइव, सूची, प्रदाता, स्थायी स्थिति और प्लेबैक फैसले FOSS2 तथा मूल Android के साथ कार्यान्वयन साझा करते हैं। ब्राउज़र/TV, Swift और Rust अडैप्टर डिवाइस API, कोडेक, नेटवर्क और UI प्रभाव रखते हैं। ब्राउज़र आर्टिफ़ैक्ट ES5 वाक्यरचना और समर्थित पुराने API bootstrap बनाए रखता है। `npm test`, `check:bundle` और `check:es5` एकीकरण जाँचते हैं; आर्टिफ़ैक्ट manifest स्रोत और आउटपुट hash दर्ज करता है।

Control-server और SWOP प्रोटोकॉल वैलिडेटर संस्करण वाली `contracts/ottplay-wire-v1.json` स्कीमा से बनते हैं। जाँची गई जनरेटर रसीदें और अपरिवर्तनीय संगतता परीक्षण डेटा उपभोक्ता-विशिष्ट नीति प्रतियाँ रोकते हैं।

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

## डिवाइस पहचान

प्लेयर 24 डिवाइस प्रकार समर्थित करता है। पहचान: पहले URL `/f/{device_id}/`, फिर User-Agent।

| डिवाइस ID | डिवाइस |
|---|---|
| `pc` | PC ब्राउज़र |
| `pc2` | videojs वेब प्लेयर |
| `nodejs` | Windows ऐप (Electron) |
| `lg/webos` | LG WebOS टीवी |
| `samsung/tizen` | Samsung Tizen टीवी |
| `samsung/maple` | Samsung Orsay टीवी |
| `mag` | Infomir MAG बॉक्स |
| `dune` | Dune HD बॉक्स |
| `android` | Android TV / टैबलेट |
| `hbbtv` | HbbTV टीवी |
| `panasonic` | Panasonic Viera टीवी |
| `philips` | Philips टीवी |
| `sony` | Sony टीवी |
| `sharp` | Sharp टीवी |
| `toshiba` | Toshiba टीवी |
| `hisense` | Hisense टीवी |
| `skyworth` | Skyworth टीवी |
| `tcl` | TCL टीवी |
| `vewd` | Vewd डिवाइस |
| `spark` | Spark रिसीवर |

<a id="push-command-system"></a>

## पुश कमांड प्रणाली

अलग बहु-डिवाइस सेवा के लिए [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) और **सेटिंग → दूरस्थ नियंत्रण** के **कमांड सर्वर** खंड का उपयोग करें। उसका IP/पता और इस प्लेयर का डिवाइस पहुँच कोड भरें; दोनों सहेजने पर वॉल्यूम, चैनल तथा अन्य कमांड के लिए पोलिंग स्वतः शुरू होती है। पोर्ट के बिना IP HTTP पोर्ट 8081 इस्तेमाल करता है। रोकने के लिए पता साफ़ करें या **डिस्कनेक्ट** चुनें। यह बाहर जाने वाला कनेक्शन पुष्टि सहित वितरण समर्थित करता है और स्थानीय listener नहीं चाहता। [कनेक्शन और संगतता विवरण](docs/remote-command-server.md) देखें। नीचे के उदाहरण मौजूदा स्थानीय प्रॉक्सी/listener मोड बताते हैं।

**कमांड सर्वर ढूंढें** से डिवाइस टोकन कॉपी किए बिना कंट्रोलर खोजकर ऑपरेटर की स्वीकृति मांगी जा सकती है। Tauri पहले नेटिव DNS जांचता है और खाली परिणाम मिलने पर स्पष्ट रूप से कॉन्फ़िगर किए गए डिप्लॉयमेंट प्रोफ़ाइल का उपयोग कर सकता है; ब्राउज़र, LG और Capacitor प्लेयर ब्राउज़र प्रोफ़ाइल वाला तरीका अपनाते हैं। Home की खोज संबंधी मेटाडेटा को कंट्रोलर से अलग here.now पर होस्ट किया जा सकता है। सामान्य बिल्ड में यह Home प्रोफ़ाइल अपने आप शामिल नहीं होती और अपडेट सहेजे गए कनेक्शन नहीं बदलता। [प्लेटफ़ॉर्म का व्यवहार, प्रोफ़ाइल सेटअप और समस्या निवारण](docs/remote-command-server.md#discovery-and-one-time-approval) देखें।

ब्राउज़र/OTT server प्लेयर, Tauri और Capacitor में स्थानीय HTTP दूरस्थ नियंत्रण **डिफ़ॉल्ट बंद** है। गुप्त डिवाइस कोड बनाने के लिए **प्लेयर सेटिंग → दूरस्थ नियंत्रण** में चालू करें। कमांड `"command"` फ़ील्ड वाले JSON ऑब्जेक्ट हैं; HTTP अनुरोध में `Authorization: Bearer <device-code>` चाहिए।

<a id="architecture"></a>

### आर्किटेक्चर

<a id="local-command-url-recommended"></a>

#### स्थानीय कमांड URL (अनुशंसित)

**प्लेयर सेटिंग → दूरस्थ नियंत्रण** में **स्थानीय HTTP दूरस्थ नियंत्रण** चालू करें, बना **डिवाइस कोड** कॉपी करें और नीचे की प्रॉक्सी उसी से सेट करें। **स्थानीय कमांड URL** को प्रॉक्सी के कमांड endpoint पर सेट करें। चालू रहते प्लेयर हर 10 सेकंड इस URL को Authorization हेडर में डिवाइस कोड के साथ पोल करता है। केवल URL भरना कमांड नियंत्रण नहीं चालू करता।

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### डिवाइस UUID

मौजूदा डिवाइस UUID (जैसे `dev_a1b2c3d4e5`) सार्वजनिक रूटिंग मेटाडेटा है, प्राधिकरण क्रेडेंशियल नहीं। अलग **डिवाइस कोड** स्थानीय HTTP नियंत्रण चालू करते समय सुरक्षित ढंग से बनता और इसी डिवाइस पर रहता है; क्लाउड सेटिंग से कॉपी नहीं होता। स्थानीय HTTP बंद करने से पोलिंग/listener रुकते हैं। दोबारा चालू करने पर नया कोड बनता है: पुराने क्रेडेंशियल रद्द करने के लिए प्रॉक्सी और एकीकरण अपडेट करें।

Tauri और Capacitor इस सेटिंग की अनुमति के बाद ही loopback HTTP listener शुरू करते हैं। फ़ॉरवर्डिंग प्रॉक्सी को दिखाया डिवाइस कोड Bearer token के रूप में listener को भेजना चाहिए। Mode A नीचे की अलग कॉन्फ़िगर `local_proxy.py` कतार इस्तेमाल करता है।

<a id="remote-text-entry-swop"></a>

#### दूरस्थ टेक्स्ट प्रविष्टि (swop)

उद्देश्य: टीवी और फ़ोन **अलग नेटवर्क** पर हों तो Cloudflare Worker सत्र हस्तांतरण से ♥™ / दूरस्थ वर्चुअल कीबोर्ड के लिए फ़ोन पर लिखना।

- Worker रिपॉज़िटरी: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop)
- **इंस्टॉलेशन प्राधिकरण:** प्लेयर अपने सर्वर के same-origin `/swop` relay पर अनुरोध भेजता है। सर्वर निजी इंस्टॉलेशन token जोड़ता है; पंजीकृत सर्वर origin का हर क्लाइंट दूरस्थ टेक्स्ट प्रविष्टि कर सकता है। डिवाइस UUID सत्र पहचानते हैं और प्रति-डिवाइस अनुमति सूची आवश्यक नहीं।
- सेटिंग: `swopBaseUrl` (खाली = ♥™ “कॉन्फ़िगर नहीं” दिखाता है / कुछ नहीं करता)। **सेटिंग → दूरस्थ नियंत्रण** (कुंजी **2**) में बदलें या ऑपरेटर इंस्टॉलेशन में Git द्वारा अनदेखी `/local/swop.json` से डालें
- `POST /session` में `clientId`, `caption` और `draft`; `POST /val` में `clientId`, `code` और लौटा हुआ `sessionToken` होता है। फ़ोन URL में अलग write token होता है। सत्र read token ब्राउज़र मेमोरी में रहते हैं।
- **स्थानीय इंस्टॉलेशन:** Worker में इंस्टॉलेशन और सटीक LAN/localhost origin पंजीकृत करने के बाद `SWOP_BASE_URL` तथा `SWOP_INSTALLATION_TOKEN` सेट करें। `scripts/install-ottplay-local-service.sh` इन्हें निजी mode-0600 launchd plist में सुरक्षित रखता है। सार्वजनिक `/local/swop.json` में केवल `{"swopBaseUrl":"/swop"}` होता है। सार्वजनिक संसाधनों में इंस्टॉलेशन token कभी न रखें।
- **स्थिर होस्टिंग:** उन्हीं दो endpoint के लिए सर्वर पर प्रमाणित प्रॉक्सी कॉन्फ़िगर करें। इंस्टॉलेशन token होस्टिंग सेवा के रहस्यों में रखें। सार्वजनिक प्लेयर फ़ाइलें कॉपी करने से यह सर्वर क्रेडेंशियल कॉपी नहीं होता।

> केंद्रीय OTT सर्वर `/api/webhook/commands`, `/webhook/poll`, `/webhook/notify` और कमांड स्वास्थ्य alias हर HTTP विधि के लिए बंद रखता है। Mode A के लिए अलग कमांड सर्वर या स्पष्ट कॉन्फ़िगर किया प्रमाणित `local_proxy.py` इस्तेमाल करें; केंद्रीय सर्वर में प्रसारण कमांड कतार नहीं है।

<a id="available-commands"></a>

### उपलब्ध कमांड

सभी उदाहरण स्थानीय प्रॉक्सी URL के रूप में `http://192.168.1.50:8081/api/webhook/commands` इस्तेमाल करते हैं। इसे वास्तविक पते से बदलें और `OTTPLAY_QUEUE_HTTP_TOKEN` को HTTP नियंत्रण चालू करने के बाद दिखाई **डिवाइस कोड** पर सेट करें। प्रॉक्सी में भी वही कोड होना चाहिए।

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — पॉपअप सूचना दिखाएँ

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| फ़ील्ड | प्रकार | डिफ़ॉल्ट | विवरण |
|---|---|---|---|
| `message` | string | आवश्यक | दिखाया जाने वाला टेक्स्ट |
| `popup_duration` | number | 5 | दिखाने के सेकंड (ऊपर दायाँ कोना) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — सूची की स्थिति से चैनल बदलें

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| फ़ील्ड | प्रकार | डिफ़ॉल्ट | विवरण |
|---|---|---|---|
| `channel_number` | number | आवश्यक | सूची में चैनल स्थिति, 1 से शुरू |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — (आंशिक) नाम से चैनल बदलें

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

अक्षरों के बड़े/छोटे रूप को अनदेखा करके उपस्ट्रिंग खोजता है। पहला मिलान चुना जाता है।

| फ़ील्ड | प्रकार | डिफ़ॉल्ट | विवरण |
|---|---|---|---|
| `channel_name` | string | आवश्यक | चैनल नाम या उसका भाग |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — यादृच्छिक चैनल पर जाएँ

यह पुराना कमांड वर्तमान सूची या श्रेणी से पात्र चैनल चुनता है। चैनल नंबर और सीमाएं उसी सूची में स्थान दर्शाते हैं; [सुरक्षित यादृच्छिक चयन के नियम](docs/remote-command-server.md#safe-random-playback) देखें।

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

| फ़ील्ड | प्रकार | डिफ़ॉल्ट | विवरण |
|---|---|---|---|
| `random_range` | [start, end] | वर्तमान सूची | 1 से शुरू सीमा |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — IPTV प्रदाता बदलें

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| फ़ील्ड | प्रकार | डिफ़ॉल्ट | विवरण |
|---|---|---|---|
| `provider` | number | आवश्यक | प्रदाता array का index (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — नई M3U सूची लोड करें

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| फ़ील्ड | प्रकार | डिफ़ॉल्ट | विवरण |
|---|---|---|---|
| `playlist` | string | आवश्यक | M3U सूची URL |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — प्रदाता कॉन्फ़िगरेशन अपडेट करें

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| फ़ील्ड | प्रकार | डिफ़ॉल्ट | विवरण |
|---|---|---|---|
| `provider_settings` | string | आवश्यक | प्रदाता कॉन्फ़िगरेशन वाली JSON string |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — ध्वनि स्तर सेट या बदलें

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

ध्वनि नियंत्रण समर्थन न रखने वाले क्लाइंट पर चुपचाप अनदेखा होता है।

| फ़ील्ड | प्रकार | डिफ़ॉल्ट | विवरण |
|---|---|---|---|
| `volume` | number | — | पूर्ण स्तर 0-100 |
| `volume_step` | number | — | सापेक्ष बदलाव, जैसे +10 या -5 |

<a id="player-standby-restart-and-exit"></a>

#### प्लेयर स्टैंडबाय, पुनः आरंभ और बाहर निकलना

स्थानीय प्रॉक्सी की अपुष्ट webhook कतार `exit_player` या typed standby/wake अनुरोध नहीं संभालती। प्लेयर को [कमांड सर्वर](docs/remote-command-server.md) से जोड़कर उसका CLI इस्तेमाल करें:

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

`d1` की जगह पंजीकृत प्लेयर alias लिखें। `stop`, `standby` का alias है; `start` और `wake`, `go` के alias हैं। Go को चल रहा, जुड़ा प्लेयर चाहिए; बंद ऐप खोल या ऑफ़लाइन डिवाइस जगा नहीं सकता। मूल ऐप exit के बिना ब्राउज़र या टीवी बताता है कि exit समर्थित नहीं। स्टैंडबाय दूरस्थ पोलिंग जारी रखता है और होस्ट या साझा सर्वर के असंबंधित काम नहीं रोकता।

Standby/go के बाद `ott d1 status` से स्टैंडबाय/पृष्ठभूमि स्थिति जाँचें और फिर शुरू प्लेबैक अलग सत्यापित करें। प्लेयर पुनः लोड के बाद `ott d1 doctor` से नया रनटाइम जाँचें। Exit के बाद OS से पुष्टि करें कि ऐप प्रक्रिया बंद हुई; दूरस्थ टाइमआउट exit का प्रमाण नहीं। केवल कमांड स्वीकृति इन नतीजों की पुष्टि नहीं करती।

<a id="local-proxy-server"></a>

## स्थानीय प्रॉक्सी सर्वर

`local_proxy.py` एक प्लेयर के लिए स्वतंत्र प्रमाणित कमांड कतार है। डिफ़ॉल्ट चलाने पर पोर्ट खोले बिना बंद होती है। हर प्रॉक्सी इंस्टेंस प्लेयर का बनाया डिवाइस कोड इस्तेमाल करता है; कई प्लेयर के लिए अलग इंस्टेंस/पोर्ट रखें। `device_id` query parameter संगतता मेटाडेटा है, वह प्रमाणीकरण या अन्य डिवाइस का चुनाव कभी नहीं करता।

<a id="start-the-proxy"></a>

### प्रॉक्सी शुरू करें

1. प्लेयर में **स्थानीय HTTP दूरस्थ नियंत्रण** चालू करें और **डिवाइस कोड** कॉपी करें।
2. प्रॉक्सी होस्ट पर कोड और प्लेयर परोसने वाला सटीक origin सेट करें (scheme, host और port, पथ नहीं):

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. प्लेयर का **स्थानीय कमांड URL** `http://192.168.1.50:8081/api/webhook/commands` सेट करें।

डिफ़ॉल्ट bind पता `127.0.0.1` है; उदाहरण स्पष्ट रूप से LAN पहुँच चालू करता है। `OTTPLAY_QUEUE_HTTP_ORIGINS` सटीक browser origin की comma-separated अनुमति सूची है। HTTPS प्लेयर के लिए HTTPS reverse proxy इस्तेमाल करें ताकि mixed-content नियम पोलिंग की अनुमति दें। डिवाइस कोड गुप्त और URL से बाहर रखें। प्लेयर नया कोड बनाए तो प्रॉक्सी नई वैल्यू से फिर चलाएँ; केवल प्लेयर बंद करने से अलग प्रबंधित प्रॉक्सी प्रक्रिया नहीं रुकती।

<a id="endpoints"></a>

### Endpoint

| विधि | पथ | विवरण |
|---|---|---|
| `POST` | `/api/webhook/commands` | कमांड कतार में रखें |
| `GET` | `/api/webhook/commands` | कतार की कमांड निकालें (प्लेयर पोल) |
| `POST` | `/webhook/notify` | प्रमाणित संगतता alias |
| `GET` | `/webhook/poll` | प्रमाणित संगतता alias |

भेजने और निकालने दोनों के लिए सही Bearer डिवाइस कोड चाहिए। बिना प्रमाणीकरण वाला प्रसारण endpoint नहीं है। कमांड 60 सेकंड बाद समाप्त होती हैं; हर प्रॉक्सी अधिकतम 50 कमांड रखता है।

प्रॉक्सी एक साथ अधिकतम 16 कनेक्शन संभालता है ताकि निष्क्रिय ब्राउज़र कनेक्शन या अधूरा अनुरोध अन्य कमांड न रोके। हर socket में पाँच सेकंड का निष्क्रियता टाइमआउट है; सभी worker व्यस्त हों तो अतिरिक्त कनेक्शन बंद होते हैं। कतार में डालना और निकालना worker के बीच atomic है।

<a id="smoke-script-all-modes"></a>

### परीक्षण स्क्रिप्ट (सभी मोड)

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Android emulator/device: पहले `adb forward tcp:18081 tcp:18081` करें। Cap/Tauri केवल loopback हैं — LAN Home Assistant के लिए यह Mode A प्रॉक्सी इस्तेमाल करें। विवरण: `docs/capacitor-mobile.md` § Smoke test।

<a id="cors"></a>

### CORS

प्रॉक्सी केवल `OTTPLAY_QUEUE_HTTP_ORIGINS` से ब्राउज़र अनुरोध अनुमति देता है। अनुमत origin के preflight `OPTIONS` को token नहीं चाहिए; हर वास्तविक GET/POST को Bearer डिवाइस कोड चाहिए। Wildcard और `null` origin स्वीकार नहीं हैं। Home Assistant तथा अन्य गैर-ब्राउज़र क्लाइंट Origin छोड़ सकते हैं, पर प्रमाणीकरण आवश्यक है।

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### उदाहरण: Home Assistant webhook → स्थानीय प्रॉक्सी → प्लेयर

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

### Home Assistant ऑटोमेशन उदाहरण

पॉपअप, चैनल और ध्वनि उदाहरण स्थानीय प्रॉक्सी इस्तेमाल करते हैं। Home Assistant `secrets.yaml` में `ottplay_device_authorization` को चालू प्लेयर के कोड सहित `Bearer <device-code>` सेट करें।

रात्रि स्टैंडबाय अलग [कमांड सर्वर](docs/remote-command-server.md) इस्तेमाल करता है। उदाहरण का URL और `DEVICE_UUID` अपने controller पते और पंजीकृत डिवाइस ID से बदलें; स्थानीय CLI alias `d1` डिवाइस ID नहीं है। `secrets.yaml` में `ottplay_control_authorization` को `Bearer <controller-admin-token>` सेट करें। यह क्रेडेंशियल स्थानीय प्रॉक्सी के डिवाइस कोड से अलग है। Home Assistant के [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) और [secrets](https://www.home-assistant.io/docs/configuration/secrets/) दस्तावेज़ देखें।

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

`standby_request` में ऑटोमेशन trace के लिए HTTP प्रतिक्रिया होती है। HTTP 202 केवल कतार में डाले जाने का अर्थ है: `content.id` रखें, फिर प्लेयर का उत्तर लेने के लिए उसी controller credential से `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` पोल करें। नया `status` अनुरोध `player.standby` और `player.background` देखता है; स्टैंडबाय चालू, `suspended` और शून्य pending होना प्लेयर के tracked काम समाप्त होने की पुष्टि करता है। स्टैंडबाय छोड़ने के लिए वही typed अनुरोध `"operation":"wake"` (`ott d1 go`) के साथ भेजें। टाइमआउट के बाद बदलाव अंधाधुंध न दोहराएँ। controller का [request/response API](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) और [स्टैंडबाय व्यवहार](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake) देखें।

<a id="server-api-reference"></a>

## सर्वर API संदर्भ

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Webhook endpoint (Rust `ottplay-server`)

Rust सर्वर और संग्रहीत Python fallback कमांड endpoint को HTTP 403 से अस्वीकार करते हैं। `/api/webhook/commands`, `/webhook/notify`, `/webhook/poll` और कमांड स्वास्थ्य alias कमांड कतार में नहीं रखते, प्रसारित नहीं करते और निकालते नहीं। सामान्य feedback API इन आरक्षित रूट को बदल नहीं सकता। Mode A कमांड वितरण ऊपर का अलग कॉन्फ़िगर कमांड सर्वर या प्रमाणित स्थानीय प्रॉक्सी इस्तेमाल करता है।

<a id="other-endpoints"></a>

### अन्य endpoint

| विधि | पथ | विवरण |
|---|---|---|
| `GET` | `/epg/<hash>.json` | चैनल के EPG डेटा |
| `GET` | `/logo/<id>.svg` | उत्पन्न चैनल लोगो |
| `GET` | `/version/<path>` | फ़ाइल संस्करण hash |
| `POST` | `/m3u/match-channels` | चैनल और EPG मिलान |
| `POST` | `/m3u/match-logos` | चैनल लोगो मिलान |
| `POST` | `/m3u/cp.php` | स्ट्रीम प्रॉक्सी |
| `GET/POST` | `/feedback/` | फ़ीडबैक लॉगिंग |
| `GET` | `/tmdb/*` | TMDb API प्रॉक्सी |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## परियोजना संरचना

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

## STB कुंजी मानचित्रण

- **Samsung Tizen**: `RETURN=10009`, `ENTER=13`, रंग 403-406
- **Samsung Maple**: dpad 4/5/6/8, मूल SDK कोड
- **LG WebOS**: `RETURN=461`, HbbTV-संगत रंग
- **LG NetCast**: `RETURN=8`, HbbTV कोड
- **MAG**: `RETURN=8`, MAC के लिए gSTB API
- **Dune HD**: मानक कोड, Dune API
- **Android TV**: Android keycode (`BACK=4`, `DPAD_*` 19-22, `ENTER=66`)
- **HbbTV/Panasonic/Philips/Sony/आदि**: HbbTV कोड (`RED=403`, `BLUE=406`, `VOL_UP=447`)

<a id="documentation"></a>

## दस्तावेज़

- [दस्तावेज़ विकी](./docs/wiki/Home.hi.md) / [रूसी विकी](./docs/wiki/Home.ru.md) — काम के अनुसार नेविगेशन और रखरखाव नियम।
- [कार्यान्वयन रिपोर्ट](./docs/implementation-report.hi.md) / [रूसी में प्रक्रिया और परिणाम](./docs/implementation-report.ru.md) — रंगीन आरेख, सत्यापित व्यवहार, मापी लागत और रिलीज़ जाँच।
- [डिलीवरी मार्गदर्शिका](./docs/roadmap-delivery.hi.md) / [रूसी में नई सुविधाएँ](./docs/roadmap-delivery.ru.md) — सुविधाएँ, सीमाएँ और सत्यापन।
- [88 इंटरफ़ेस भाषाओं में त्वरित शुरुआत](./docs/readme/README.md) — वितरित UI अनुवाद से उत्पन्न; मुख्य पुस्तिका और जोड़ी वाली सुविधा मार्गदर्शिकाएँ [24 दस्तावेज़ भाषाओं](docs/manual-translations.md) में उपलब्ध हैं।
- [गुणवत्ता सीमाएँ और लाइव पुनर्प्राप्ति](./docs/playback-stream-policy.hi.md) / [रूसी में](./docs/playback-stream-policy.ru.md)।
- [मैनुअल XMLTV मैपिंग और क्लासिक पहुँचयोग्यता](./docs/guide-binding-accessibility.hi.md) / [रूसी में](./docs/guide-binding-accessibility.ru.md)।
- [होस्टेड ऑडियो/वीडियो परीक्षण](./docs/audio-video-check.hi.md) / [रूसी में](./docs/audio-video-check.ru.md)।
- [Xtream मीडिया लाइब्रेरी](./docs/xtream-media.hi.md) / [रूसी में](./docs/xtream-media.ru.md)।
- [एक ही स्रोत के डिवाइस का हस्तांतरण](./docs/remote-handoff.hi.md) / [रूसी में](./docs/remote-handoff.ru.md)।
- [पुनर्प्राप्त करने योग्य स्थानीय सेटिंग](./docs/settings-recovery.hi.md) / [रूसी में](./docs/settings-recovery.ru.md)।
- [ब्राउज़र पीढ़ियाँ, ऑपरेटिंग सिस्टम और सटीक रिलीज़-कैंडिडेट जाँचें](docs/browser-compatibility.hi.md) / [रूसी में](docs/browser-compatibility.ru.md)।

- [प्लेयर आर्किटेक्चर](./docs/architecture.md) — रनटाइम ज़िम्मेदारी, प्रदाता एकीकरण, प्लेबैक, गाइड, डिवाइस अडैप्टर और बिल्ड अनुबंध।
- [क्लासिक ES5 बिल्ड पाइपलाइन](./docs/build-pipeline.md) — संकलन, संगतता जाँच और आर्टिफ़ैक्ट आकार सीमाएँ।
- [रनटाइम संसाधन नाम और परिनियोजन माइग्रेशन](./docs/asset-layout.md) — वेब और मूल पैकेज में साझा वर्णनात्मक पथ।
- [दूरस्थ कार्यस्थल](./docs/remote-workbench.md) — UI/मीडिया निरीक्षण, ऑपरेशन रसीदें और सहेजे प्रमाण।
- [रनटाइम निदान](./docs/runtime-debug.md) — त्रुटि इतिहास, फ़्रेम/लूप काउंटर, Capacitor/Tauri मूल मेट्रिक्स और सर्वर डिबगिंग।
- [स्थानीय macOS डिलीवरी](./docs/macos-local-delivery.md) — checkout बिल्ड, स्थानीय इंस्टॉलेशन और सत्यापन।

<a id="license"></a>

## लाइसेंस

[MIT](LICENSE) — मुक्त और ओपन सोर्स। प्रदाता सामग्री और तृतीय-पक्ष निर्भरताएँ अपने अधिकार और लाइसेंस रखती हैं।

PlxNative से बना अलग [OTTPlay native webOS](docs/native-webos.md) अनुप्रयोग संबंधित स्रोत कोड के साथ **GPL-3.0-or-later** लाइसेंस के तहत वितरित किया जाता है।
परियोजना के मूल में मौजूद MIT लाइसेंस इस नेटिव अनुप्रयोग या इसके पैच का लाइसेंस नहीं बदलता।

<a id="desktop-updater--notarization-mode-b"></a>

## डेस्कटॉप अपडेटर / नोटरीकरण (Mode B)

[डेस्कटॉप हस्ताक्षर और अपडेटर मार्गदर्शिका](docs/tauri-updater-notarize.md) macOS ad-hoc हस्ताक्षर, वैकल्पिक Developer ID/नोटरीकरण और बंडल सत्यापन बताती है। रिलीज़ CI Apple क्रेडेंशियल के बिना ad-hoc हस्ताक्षर करता है। अपडेटर हस्ताक्षर अलग हैं; उत्पादन स्वतः अपडेट अभी कॉन्फ़िगर नहीं हैं।

<a id="local-mac-build-helpers"></a>

## स्थानीय Mac बिल्ड सहायक

[docs/local-build-scripts.md](docs/local-build-scripts.md) देखें।

<a id="privacy"></a>

## गोपनीयता

स्थानीय सेटिंग, कॉन्फ़िगर सेवाओं और विकल्पों के लिए [गोपनीयता नीति](docs/privacy-policy.md) पढ़ें। गोपनीयता और सहायता संपर्क: [alvit.work@gmail.com](mailto:alvit.work@gmail.com)।

Studio 2026 डिफ़ॉल्ट इंटरफ़ेस थीम है। Classic और PLi-HD चुने जा सकते हैं और सहेजी पसंद बनी रहती है। [इंटरफ़ेस सेटिंग](docs/interface-settings.md) देखें। PLi-HD थीम Vali, littlesat, VU+NL, Milo और मूल योगदानकर्ताओं को श्रेय देती है। अंग्रेज़ी इतिहास और स्रोत लिंक के लिए [इंटरफ़ेस श्रेय और डिज़ाइन इतिहास](docs/interface-history.md) देखें; यह प्लेयर के जानकारी मेनू से भी उपलब्ध है।

<a id="demo-video-editing"></a>

## डेमो वीडियो संपादन

प्रदर्शन रिकॉर्डिंग तैयार और संपादित करने के लिए स्थानीय [video-use प्रक्रिया](docs/demo-video.md) अपनाएँ। सहायक सभी उत्पन्न मीडिया Git से बाहर रखता है।

<a id="plex-media-library"></a>

## Plex मीडिया लाइब्रेरी

हर प्लेयर **Plex** प्रदाता से Plex खाते या Plex Media Server से जुड़ सकता है। एकीकरण Plex का उपयोग करता है; Synology मीडिया सर्वर का एक संभावित होस्ट है। सभी उपलब्ध वीडियो और संगीत ट्रैक चैनल सूची में अपने आप आते हैं; श्रेणी चयन से लाइब्रेरी, फ़ोल्डर या श्रृंखला के अनुसार फ़िल्टर करें। पहले उपयोगी बैच से प्लेबैक शुरू होता है, पृष्ठभूमि लोडिंग, मानक खोज और shuffle/repeat के लिए क्रियाओं के साथ, OTT सर्वर पर Plex कॉन्फ़िगर किए बिना। [Plex लॉगिन और सीधा प्लेबैक](docs/plex-provider.md) देखें।

![Plex लोडिंग, फ़ाइल नेविगेशन और बंद होने का जीवनचक्र](docs/images/plex-playback-lifecycle.svg)

[चित्रित विश्वसनीयता समीक्षा](docs/plex-provider.md#reliability-review-process-and-results) लोडिंग/रद्द करने के नियम, पूरे कैटलॉग और फ़ाइल बदलने के सुधार तथा मापे गए Chromium/WebKit सत्यापन परिणाम बताती है।

वैकल्पिक OTT सर्वर एकीकरण मौजूदा Plex सर्वर का कैटलॉग और संगत प्लेबैक अलग NAS लाइब्रेरी प्रविष्टि तथा M3U निर्यात से भी उपलब्ध कराता है। [सर्वर-साइड लाइब्रेरी कॉन्फ़िगरेशन और क्लाइंट पहुँच](docs/synology-library.md) देखें।

<a id="related-repositories"></a>

## संबंधित रिपॉज़िटरी

- [ottplay-core](https://github.com/open-ott-play/ottplay-core) साझा JVM/ES5 डोमेन लॉजिक, संचार अनुबंध और FOSS2 क्लाइंट रखता है। यह प्लेयर उत्पन्न आर्टिफ़ैक्ट लेता है; साझा बदलाव के लिए core डिलीवरी मार्गदर्शिका अपनाएँ।
- [ottplay-android](https://github.com/open-ott-play/ottplay-android) अलग मूल Kotlin/Compose ऐप है, अपनी इंस्टॉलेशन और रिलीज़ पहचान के साथ।
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server) स्वयं होस्ट की गई दूरस्थ कमांड देता है; [ottplay-swop](https://github.com/open-ott-play/ottplay-swop) वैकल्पिक Worker आधारित टेक्स्ट प्रविष्टि परिवहन देता है।
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine) ब्राउज़र डेमो की होस्टेड प्रोफ़ाइल, डेमो मीडिया और प्रकाशन सत्यापन संभालता है।

<a id="project-maintenance"></a>

## परियोजना रखरखाव

[योगदान और परीक्षण आवश्यकताएँ](CONTRIBUTING.md), [सुरक्षा रिपोर्ट नीति](SECURITY.md), [सुरक्षा डिज़ाइन](docs/security-design.md) तथा [OpenSSF प्रमाण और बाकी मानदंड](docs/openssf-evidence.md) देखें।
