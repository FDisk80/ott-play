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

İnternet olmadan yerel dosyalar: [Yerel videolar ve çevrimdışı oynatma](docs/offline-media.md) bölümüne bakın.

[![OTT-play FOSS kanal tarayıcısının perspektif görünümü](docs/images/hero.png)](docs/images/studio-2026-default.png)

*Sentetik kanal ve program verileriyle mevcut Studio 2026 arayüzünün ekran görüntüsü.
Orijinal düz görünüm için resmi açın; bu, etkin bir abonelikten alınmış görüntü değildir.
[Resmin kaynağı ve yeniden oluşturulması](docs/images/README.md).*

[88 dilde hızlı başlangıç](docs/readme/README.md) · [Belge vikisi](docs/wiki/Home.tr.md)

[![OpenSSF En İyi Uygulamalar](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![Fuzzing: yalnızca RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

Herkese açık sürüm adayları, yerel/sunucu XMLTV ayrıştırması ve portal isteği doğrulaması için sınırlı, yalıtılmış fuzzing kampanyaları çalıştırır. [Fuzzing kapsamı, yeniden üretim ve sürüm kanıtlarına](FUZZING.md) bakın.

Yerel Rust HTTP sunucusuna sahip bağımsız IPTV/OTT oynatıcısı. Akıllı TV'lerde (LG WebOS, Samsung Tizen, Panasonic, Sony vb.), set üstü kutularda (Infomir MAG, Dune HD, Enigma2, Android TV) ve masaüstü tarayıcılarda çalışır.

Çalışma zamanı katmanları, sorumluluklar, sağlayıcı genişletme örnekleri ve doğrulama için [mimari ve katkıcı kılavuzuyla](docs/architecture.md) başlayın. Çekirdek/ana ortam sınırı ve uyumluluk sözleşmeleri için [oynatma oturumları ve sağlayıcı yaşam sürelerine](docs/playback-session-architecture.md) bakın.

<!-- ci-release-process:start -->
<a id="release-process"></a>

## Sürüm süreci

Doğrulama, nightly, beta, RC ve kararlı sürüme yükseltme kuralları için [sürüm stratejisine](RELEASING.md), yerel komutlar için [işletim kılavuzuna](docs/release-workflow.md) bakın.
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## Tarayıcıda çalıştırma

[Canlı demoyu](https://player.ottplay.here.now/) açın veya aşağıdaki yönergelerle web oynatıcısını derleyip sunun.

[Yerel macOS dağıtımı](docs/local-http-deployment.md), 8443–8446 bağlantı noktalarında HTTP oynatıcı origin'leri sunar. 8095 bağlantı noktası kullanımdan kaldırılmıştır.

İlk açılışta hareketli test desenini oynatmak için **Demoyu dene** seçeneğini kullanın veya kendi M3U listenizi ya da sağlayıcınızı ayarlayın. Demo daha sonra **Sağlayıcıyı değiştir → Demo** üzerinden de açılabilir.

Demo modu internet ister, ancak sağlayıcı hesabı istemez. Sessiz MP4 ve HLS test kanalları here.now üzerinde barındırılır ve web oynatıcısı, Tauri, Capacitor ile OTT Server tarafından paylaşılır. Geçiş sırasında mevcut sağlayıcı ayarları korunur. Ayrı bir **görüntü ve ses kontrolü** için yönetilen HTML5 motorunda boşta beklerken veya canlı TV izlerken **Bilgi → Ses → Oynat** yolunu açın. Bu işlem here.now üzerindeki sesli `av-v1.mp4` test dosyasını kullanır ve internet gerektirir. Klip oynatıcı paketlerinde bulunmaz ve açılışta asla indirilmez. VOD, arşiv ve cihaz motoru geçersiz kılmaları (PC2/Video.js ve yerel motorlar dahil) kapsam dışıdır; [adımlar, beklenen sesler ve barındırma şemasına](docs/audio-video-check.tr.md) bakın.

Kurulu masaüstü tarayıcı pencereleri **Window Controls Overlay** destekler: Chrome ayrı başlık çubuğunu gizleyip pencere düğmelerini ve uygulama menüsünü oynatıcının üzerinde tutabilir. Kurulu uygulamayı açın ve Chrome sunduğunda **Başlık çubuğunu gizle** seçeneğini seçin; **Başlık çubuğunu göster** normal çerçeveyi geri getirir. Normal sekmeler ve TV/yerel kabuk düzenleri mevcut davranışlarını korur. Desteklenen kurulum URL'leri, mevcut kısayolun güncellenmesi ve doğrulama için [tarayıcı pencere kontrollerine](docs/browser-window-controls.md) bakın.

Ana video görünümünde tam ekranda veya normal görünümde on saniyelik atlama için **Alt/Option + Sol/Sağ** kullanın (macOS'ta **Command + Sol/Sağ** da çalışır). Yerel videolar, VOD ve desteklenen kanal arşivleri web, Tauri ve Capacitor'da aynı kontrolleri kullanır. [Klavye kısayolları ve sınırlara](docs/browser-window-controls.md#playback-keyboard-shortcuts) bakın.

PC arayüzünde **R**, geçerli listedeki başka bir rastgele kanal veya videoyu, liste sırasını değiştirmeden oynatır. Ana video görünümünde ve kanal/video listelerinde çalışır; metin alanları, iletişim kutuları, ayarlar ve kiosk kısıtlamaları önceliğini korur. Diğer cihaz tuş eşlemeleri değişmez.

Sentetik test deseni `scripts/generate-demo-media.sh` ile yeniden oluşturulabilir (FFmpeg gerekir); üretilen medya, Git tarafından yok sayılan `.local-artifacts` dizininde kalır.

<a id="features"></a>

## Özellikler

- **Oynatma**: yönetilen HLS.js/Shaka kalite üst sınırları, sınırlı kurtarma ve canlı kanal başına en fazla üç açık yedek URL ile HLS, DASH ve düz HTTP akışları. Arşiv/VOD hiçbir zaman canlı yedeğe geçmez; [kalite ve kurtarmaya](docs/playback-stream-policy.tr.md) bakın.
- **EPG**: XMLTV eşleştirme, zaman kaydırma/geçmiş yayın, program başlığı arama (EPG'de N5), hatırlatıcılar ve barındırılan/yerel XMLTV yolunda belirli bir kanal için elle kaynak/kimlik bağlama. [Bağlama ve erişilebilirliğe](docs/guide-binding-accessibility.tr.md) bakın.
- **Favoriler**: desteklenen cihazlarda yapılandırılmış sağlayıcı ve profiller arasında tek bir sıralı [karma koleksiyon](docs/mixed-favorites.md), CLI üzerinden taşınabilir dışa/içe aktarma; ebeveyn PIN’i. Yedek modda kaynağa özel favori listeleri kullanılabilir kalır.
- **Ayarlar**: ayar ve favorilerin JSON dışa/içe aktarımı, desteklenen localStorage toplu işlemleri için geri alma günlüğü, kaynağı dikkate alan arşiv sürdürme ve denetleyici iş akışları için kayıtlı ayarların tam karşılaştırılması. Kurtarma tek yazıcı varsayar; özel depolama bağdaştırıcıları olanaklar ölçüsünde geri alma sağlar. [Ayar kurtarmaya](docs/settings-recovery.tr.md) bakın.
- **Paylaşılan arayüz**: OTT Server, Tauri ve Capacitor aynı kanal listesi temasını ve görünürlük ayarlarını kullanır. [Arayüz renkleri](docs/interface-colors.md) dokuz renk rolü, bir palet, hassas HEX/RGB/HSV girişi ve beş renk şeması sunar; ayarlar istemciye özel kaydedilir. Kanal listesi ayarları kanal adları, picon'lar, mevcut programlar, ilerleme ve arşiv işaretlerini kontrol eder.
- **Sağlayıcılar**: M3U/M3U8, Xtream canlı TV ve [isteğe bağlı film/dizi katalogları](docs/xtream-media.tr.md), [filmleri ve iç içe klasörlerdeki bölümleri](docs/stalker-media.md) destekleyen Stalker/Ministra, Plex ve VPortal. Sağlayıcı yetenekleri ile hesap erişimi kullanılabilir arşiv ve medya kitaplığı özelliklerini belirler.
- **Push komutları**: webhook üzerinden uzaktan kontrol — kanal, sağlayıcı ve liste değiştirme, açılır bildirim gösterme
- **Uzaktan metin girişi (swop)**: TV ile telefon farklı ağlardayken Cloudflare Worker üzerinden telefon klavyesi (kurulum için yetkilendirilmiş oturumlar; sanal klavyede ♥™)
- **Cihaza göre yönlendirme**: çok cihazlı kurulumlar için UUID tabanlı adresleme
- **Yerel proxy**: tamamen yerel otomasyon için isteğe bağlı yerel komut sunucusu (merkezi sunucu gerekmez)
- **Denetleyici entegrasyonu**: cihaz/eylem kapsamlı operatörler, isteğe bağlı kalıcı komut sonuçları, devam ettirilebilir Local/Home hazır ayar uygulaması ve uygun [kontrol sunucusu](https://github.com/open-ott-play/ottplay-control-server) üzerinden aynı kaynakta canlı/arşiv devri. Bunlar güncellenmiş denetleyici/CLI gerektirir; bağımsız bir tarayıcı sekmesi bunları sağlamaz.
- **Türü belirlenmiş uzaktan tercihler**: ayarları keşfedin, kayıtlı ve etkin değerleri okuyun, çalışma örneği, kaynak ve revizyon denetimleriyle kaydedin; bkz. [uzaktan ayarlar ve VPortal yapılandırması](docs/remote-player-settings.md).
- **Hata ayıklama**: `?debug=1` ile isteğe bağlı oynatma HUD'u/halka günlük, izinli uzaktan inceleme ve talep üzerine barındırılan ses/video kontrolü
- **Klavye erişilebilirliği**: adlandırılmış klasik iletişim kutuları, Tab odağının sınırlandırılması ve geri dönüşü, seçili kanal semantiği ve kesintiye yol açmayan durum bildirimleri. Bunlar tam WCAG veya cihaz ekran okuyucusu uyumluluğunu kanıtlamaz.
- **24 cihaz türü**: cihaza özel uzaktan kumanda tuş eşlemeleri
- **88 arayüz dili**: uyumlu kataloglar, [yerelleştirilmiş hızlı başlangıçlar](docs/readme/README.md) ve [CLDR ile kontrol edilmiş klavye alfabeleri](docs/localization.md). Ana kılavuz ve eşlenik özellik kılavuzları [24 belge dilinde](docs/manual-translations.md) sunulur; diğer mühendislik başvuruları mevcut dillerini korur.

[Teslim kılavuzu](docs/roadmap-delivery.tr.md), bu kaynak sürümündeki özellikleri, platform sınırlarını, şemaları ve doğrulamayı açıklar. Kurulu sürümler veya barındırılan dağıtımlar daha eski bir revizyon kullanabilir. Bağımsız yerel [Android uygulaması](https://github.com/open-ott-play/ottplay-android) da ses/altyazı seçimlerini manifest dizinleri yerine dil, rol ve etikete göre saklar; uygulaması ve sürümü bu frontend'den ayrıdır.

[STB kaynak kodu incelemesi](docs/stb-player-improvements.md), medya, kaynak kullanımı ve kurtarma iyileştirmelerini, kaynak kodu karşılaştırmalarını ve mevcut sınırları açıklar.

<a id="debug-hud"></a>

## Hata ayıklama HUD'u

Yerel HUD ile sunucu günlüklerinin kalıcı tutulması ayrı ayrı etkinleştirilir. Diğer cihazlardan günlük toplamadan önce [tanılama erişimi, gizleme ve saklamaya](docs/diagnostic-security.md) bakın.

Hata ayıklamayı şu yollardan biriyle etkinleştirin:
- URL: `?debug=1` veya `?debug=true`
- Yerel depolama: `localStorage.setItem("ottplay_debug", "1")`
- Pencere özelliği: `window.__OTT_DEBUG__ = true`
- Sunucu: `/debug/config`, `{enabled: true}` döndürdüğünde

Hata ayıklama açıkken:
- Ekrandaki HUD şeridini değiştirmek için **D** tuşuna basın (`ottDebugSetHud` / `__ottDebug.toggleHud()`)
  - Odak INPUT/TEXTAREA/listEdit üzerindeyse atlar
  - MAG/Maple PLAY/PREV=68 çakışmasını önlemek için `e.key` kullanır
- Bilgi menüsü → **Hata ayıklama HUD'u** → `__ottDebug.toggleHud()` çağırır
- Ayarları yönet → **Hata ayıklama HUD'u**:
  - Hata ayıklama zaten yüklüyse: HUD görünürlüğünü değiştirir
  - Değilse: `ottplay_debug=1` + `ottplay_debug_hud=1` ayarlar ve yeniden başlatma ister
- Kalıcılık: HUD durumu `ottDebugSetHud` tarafından `localStorage.ottplay_debug_hud` içine ("1"/"0") kaydedilir

<a id="capacitor-ios-and-android"></a>

## iOS ve Android için Capacitor

Bu depo paylaşılan TypeScript frontend'ini iOS ve Android 7+ için Capacitor ile paketler. İkisi de sistem yazı tiplerini ve npm ile kilitlenmiş yerel çalışma zamanını kullanır. Ayrı bir API 22 uyumluluk APK'sı, WebView 60 veya yenisiyle Android 5.1/6'yı destekler. Her iki Android APK'sı da imzalıdır ve uygun beta, RC ve kararlı sürümlerde imzasız iOS IPA ile birlikte sunulur. Bağımsız Kotlin uygulaması [ottplay-android](https://github.com/open-ott-play/ottplay-android) içinde kalır.

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

[Capacitor yapılandırmasına](docs/capacitor-mobile.md) ve [Android dağıtımı ile uzaktan güncellemelere](docs/android-distributions.md) bakın.

iOS arayüzü yatay yönü kullanır. Ayarlar, sağlayıcı yapılandırması, uzaktan kontrol izni ve JSON içe/dışa aktarımı ortak frontend'i kullanmaya devam eder. Tablet çoklu görevi istenen yönü geçersiz kılabilir.

iPhone'da kanal listesinin üzerinde dikey kaydırarak satır ve sayfalar arasında ilerleyin; sonraki kanallar için yukarı, öncekiler için aşağı kaydırın. Hızlı bir hareket birkaç sayfa boyunca sürer ve yavaşlayarak durur; yavaş sürükleme hassas kalır. Hareketi durdurmak için ekrana dokunun veya bir gezinme tuşuna basın. Başka bir satır seçili olsa bile tek dokunuş parmağınızın altındaki kanalı başlatır. Kaydırma, parmağınızı kaldırdığınızda kanalı açmaz.

Video iPhone'da arayüz içinde oynar. Program bilgisi için ekranın altına dokunun veya oynatma sürerken menüyü açın. Resim içinde Resim ayrı bir oynatma seçeneği olarak kalır.

Cihaz temel testi: [Mod B kontrol listesi](docs/mode-b-device-smoke.md) ve `./scripts/smoke-capacitor-device.sh --help` (derleme/eşitleme hedefi yalnızca iOS). Tauri masaüstü testi: [masaüstü kontrol listesi](docs/mode-b-tauri-smoke.md).

<a id="installation"></a>

## Kurulum

| Platform | Paket | Notlar |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Ayrı Apple Silicon ve Intel derlemeleri; Apple imzası ayarlanmadıkça ad-hoc imzalı |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | Çeşitli dağıtımlar |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode veya Homebrew Channel](docs/lg-webos-installation.md); barındırılan oynatıcı, ağ gerekir |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode ve yerel imzalama; imzasız TV paketi, Family Hub’dan ayrı](docs/samsung-tizen-installation.md) |
| **iOS** | AltStore / TestFlight / Xcode ile `.ipa` | Yalnızca dışarıdan yükleme — henüz App Store'da değil |
| **Android (ortak frontend)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | İmzalı Capacitor paketleri; desteklenen Android sürümünü seçin |
| **Android (yerel Kotlin)** | Ayrı [yerel uygulama](https://github.com/open-ott-play/ottplay-android) | Herkese açık depo; ayrı uygulama ve sürüm iş akışı |

Desteklenen kurulum dosyaları uygun GitHub sürümlerine eklenir: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **Not:** Apple imzalama bilgileri yokken macOS uygulama paketleri ad-hoc imza kullanır; bu Developer ID veya noter onayı sağlamaz. Windows/Linux kurucuları ve iOS sürüm paketleri imzasız olabilir. iOS, fiziksel cihaza kurulumdan önce imza ister. Uygun Full ve API 22 Android sürüm APK'ları yerleşik imza sertifikasını kullanır; yerel sürüm derlemelerinin imzalı APK üretmek için yapılandırılmış keystore'a ihtiyacı vardır.

---

<a id="macos"></a>

### macOS

1. [Sürümlerden](https://github.com/open-ott-play/ottplay-foss/releases) amaçlanan etiketi seçin. Son sürüm kısayolu beta veya RC değil, kararlıyı seçer.
2. Apple Silicon için `OttPlay.FOSS_*_aarch64-apple-darwin.dmg`, Intel için `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` indirin. Bunlar ayrı mimari derlemeleridir.
3. `.dmg` dosyasını açın ve **OttPlay FOSS.app** uygulamasını Uygulamalar'a sürükleyin.
4. İlk başlatmadan önce kopyalanan paketi doğrulayın:

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

Başarılı doğrulama paket bütünlüğünü kontrol eder. `Signature=adhoc`, uygulamanın Apple tarafından doğrulanmış geliştirici kimliği olmadığı anlamına gelir; noter onayı veya Gatekeeper kabulü kanıtlamaz. Güvenilir indirme ve geçerli paket olsa da ilk açılış denemesinden sonra macOS **Sistem Ayarları → Gizlilik ve Güvenlik → Yine de Aç** gerektirebilir; [Apple yönergelerine](https://support.apple.com/en-us/102445) bakın.

“Uygulama hasarlı” mesajı tek başına karantina kanıtı değildir. İmza doğrulaması başarısızsa hatayı saklayın ve düzeltilmiş bir sürüm edinin. Başarısız doğrulamayı başarılı göstermek için indirilen uygulamayı yeniden imzalamayın veya özniteliklerini kaldırmayın.

ZIP alternatifleri `OttPlay.FOSS_aarch64-apple-darwin.app.zip` ve `OttPlay.FOSS_x86_64-apple-darwin.app.zip` dosyalarıdır. Çıkarma, disk görüntüsü ve Gatekeeper kontrolleri için [macOS imzalama ve çıktı doğrulamaya](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact) bakın. Checkout derlemeleri ve yerel kurulum için [yerel macOS teslimini](docs/macos-local-delivery.md) kullanın.

---

<a id="windows"></a>

### Windows

1. [Sürümlerden](https://github.com/open-ott-play/ottplay-foss/releases/latest) `.msi` veya `.exe` indirin
2. Kurucuyu çalıştırıp yönergeleri izleyin
3. Başlat menüsünden veya masaüstü kısayolundan açın

---

<a id="linux"></a>

### Linux

Linux oynatması WebKitGTK'ya ek olarak GStreamer HLS, H.264 ve AAC eklentilerini gerektirir. Paketler bu medya bağımlılıklarını bildirir; AppImage derlemeleri medya çerçevesini içerir. Codec kontrolleri ve tarayıcı/yerel kabul ayrımı için [Linux medya paketlemeye](docs/linux-media-packaging.md) bakın.

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

### iOS kurulumu

iOS fiziksel cihaza kurulumdan önce imza ister. İmzasız sürüm IPA'sı için AltStore Classic kullanın veya kaynakları Xcode ile derleyip imzalayın. Sunulduğunda TestFlight ayrı davet gerektirir.

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### Seçenek 1: AltStore Classic (kişisel kullanım için önerilir)

AltServer bilgisayarınızda; AltStore Classic iPhone/iPad'inizde çalışır ve IPA'yı içe aktarır. Ücretsiz Apple Hesabı yeterlidir.

**Ön koşullar:**

- Mevcut OTT-play derlemesi için **iOS/iPadOS 15 veya yenisi** yüklü iPhone/iPad.
- AltServer bulunan Mac veya Windows PC ve USB veri kablosu.
- İmzalama için Apple Hesabı, sürümü indirmek için internet.

**1. adım: AltStore'u bir kez kurun**

1. Resmî [macOS kurulumunu](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) veya [Windows kurulumunu](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows) izleyerek AltServer'ı yükleyin. Başlatıp menü çubuğu/sistem tepsisi simgesini kullanın.
2. Cihazı USB ile bağlayın, kilidini açın ve bilgisayar/cihaz güven istemlerini kabul edin. Mac'te cihazın Finder'da göründüğünü kontrol edin.
3. **AltServer menüsü → Install AltStore** içinde cihazınızı seçip imza hesabı istemlerini tamamlayın. Kurulum bildirimini bekleyin.
4. Cihazda **Ayarlar → Genel → VPN ve Aygıt Yönetimi** yolunu açıp istenirse imza hesabınızın geliştirici kaydına güvenin. iOS 16+ üzerinde **Ayarlar → Gizlilik ve Güvenlik → Geliştirici Modu** seçeneğini etkinleştirin, yeniden başlatma/onay adımlarını tamamlayın.
5. Cihazda AltStore'u açın. Zaten kurulu ve çalışıyorsa bu kurulumu atlayın; aşağıdaki aktarım için AltServer'ı açık bırakın.

**2. adım: seçili sürümü iPhone/iPad'e aktarın**

1. [Tüm sürümlerden](https://github.com/open-ott-play/ottplay-foss/releases) kesin bir etiket seçin ve cihazdaki Safari'de `ottplay-foss-ios-unsigned.ipa` dosyasını indirin. [Son sürüm kısayolu](https://github.com/open-ott-play/ottplay-foss/releases/latest) kararlı sürümü seçer; beta kurmak istiyorsanız tam listeyi kullanın.
2. IPA'yı Dosyalar'a kaydedin. **AltStore → My Apps → +** içinde dosyayı seçin. İndirilen IPA'yı Mac'ten AirDrop ile gönderip aktarmadan önce Dosyalar'a da kaydedebilirsiniz. IPA'yı Mac'te açmak bu içe aktarma adımı değildir.
3. AltStore uygulamayı imzalayıp yüklerken AltServer çalışır ve USB kablosu bağlı kalsın. Güncellemede mevcut kurulumla aynı imza hesabını kullanın; sorun giderirken ilk iş olarak uygulamayı silmeyin.
4. Aktarımın bitmesini bekleyin, **My Apps** içinde OTT-play'i kontrol edip başlatın.

**Alternatif: sürüm URL'sini doğrudan aktarın**

AltStore zaten kuruluysa bu kalıbı **iPhone'daki Safari'ye** girin, `TAG` yerine kesin sürüm etiketini yazın ve **AltStore'da Aç** seçeneğini kabul edin:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

Bu, AltStore'un [kurulum URL işleyicisini](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift) kullanır. Birçok indirme aynı dosya adına sahip olduğunda belirsiz Dosyalar/Son Kullanılanlar girişini önler. URL sürüm sayfasına değil IPA dosyasına işaret etmelidir.

Örneğin aşağıdaki aktarım **2026-09-29** tarihinde AltStore 2.3 ve AltServer 1.8.1 ile doğrulanmıştır. Bu sabit tarihsel örnektir, son sürüm bağlantısı değildir:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**Yenileme:** ücretsiz hesap kurulumları yedi gün sonra sona erer. AltServer'ı erişilebilir tutun ve süre dolmadan **AltStore → My Apps → Refresh All** kullanın. Arka plan yenilemesi de AltServer erişimi ister; [AltStore yenileme yönergelerine](https://faq.altstore.io/altstore-classic/your-altstore) bakın.

<a id="verify-the-installed-version-before-retrying"></a>

#### Tekrar denemeden önce kurulu sürümü doğrulayın

AirDrop “Gönderildi” mesajı yalnızca aktarımı onaylar. AltStore ilerleme çubuğu içe aktarmanın başladığını gösterir. Yansıtma/USB bağlantısının kopması kurulumun başarısız olduğunu kanıtlamaz: IPA'yı yeniden göndermeden önce kurulu uygulamayı kontrol edin.

Xcode kurulu ve etkin geliştirici dizini olarak seçilmiş bir Mac'te yeniden kurmadan cihazı inceleyin:

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

JSON'un `result.apps` alanında OTT-play'i bulun (`bundleIdentifier`, `play.ott.foss` ile başlar) ve hem `version` hem `bundleVersion` değerlerini seçili IPA'nın `CFBundleShortVersionString` ve `CFBundleVersion` değerleriyle karşılaştırın. Paket kimliğinde AltStore imza hesabı eki beklenir. Cihaz raporunu yerel tutun.

Doğrulanmış beta.9 örneği **sürüm `1.1.51`, derleme `2.2.66`** bildirir. Bu kurulumu doğrular; uygulamayı açma, Cloudflare oturumu, liste yükleme, oynatma ve PiP ayrı cihaz kontrolleridir.

<a id="troubleshooting-ios-installation"></a>

#### iOS kurulum sorunlarını giderme

- **AltServer'ın penceresi yok veya otomasyonla açmak zaman aşımına uğruyor:** menü çubuğu/sistem tepsisi simgesini kullanın. Arka plan uygulamasıdır. Normal uygulama penceresini tekrar tekrar açmaya çalışmak IPA içe aktarımı yapmaz.
- **“Could not find AltServer” veya USB cihazı erişilemiyor:** AltServer'ın çalıştığını doğrulayın, telefonu açın ve bilgisayar/cihaz güven istemlerini kontrol edin. Mac'te Finder görünürlüğüne bakın. Bağlantı koptuysa güvenli olduğunda yeniden bağlayın, tekrar denemeden önce kurulu sürümü kontrol edin. Sürerse [AltStore bağlantı sorun gidermesini](https://faq.altstore.io/altstore-classic/troubleshooting-guide) izleyin. Telefon bilgisayarın internetini sağlıyorsa kablo/ağ değişikliklerini diğer işleri kesmeyecek şekilde koordine edin.
- **iPhone Yansıtma “iPhone in Use” diyor veya “Connecting” aşamasında kalıyor:** kurulumu fiziksel telefonda tamamlayın ya da ekranını kilitleyip kilidi açık Mac'in yakınına koyun. Telefon kilidini açmak Yansıtmayı bitirir; USB güven/kurulumu önce kilidin açılmasını gerektirebilir. Bir yeniden bağlama da takılırsa Yansıtmayı kapatıp telefonda devam edin. [Apple Yansıtma gereksinimlerine](https://support.apple.com/en-us/120421) bakın. Kurulum için Yansıtma isteğe bağlıdır.
- **Yansıtma içinde URL Latin harflerini kaybediyor veya Kiril'e dönüşüyor:** **Mac giriş kaynağını ABC/İngilizce** yapın. Yansıtma odaktayken **Control–Boşluk** basıp iPhone donanım klavyesi için **English (US)** seçin. Mac ve iPhone giriş kaynakları farklı olabilir; doğrulanmış oturumumuzda yalnızca Mac'i değiştirmek yetmedi. Alanı temizleyip URL'yi yeniden girin ve göndermeden önce inceleyin.
- **Yansıtma içine panodan yapıştırma takılıyor veya beklenmedik metin ekliyor:** alanı temizleyip iPhone'un English (US) giriş kaynağıyla küçük parçalar halinde yavaşça yazın ya da URL'yi doğrudan telefona girin. Hızlı Yansıtma girişi karakter kaybedebilir veya çoğaltabilir; kaydetmeden önce tüm adresi doğrulayın. Kısmen yapıştırılmış URL göndermeyin. Kurulum oturumumuzda yapıştırma başarısızdı; doğrudan URL yöntemi için zorunlu değildir.
- **Dosyalar/Son Kullanılanlar birkaç aynı IPA adı gösteriyor:** kesin indirme konumunu seçin veya yukarıdaki etiketli doğrudan URL'yi kullanın. Açıklık için yerel kopyanın adına etiket/derleme eklenebilir; yeniden adlandırma içeriği değiştirmez.
- **Kurulu uygulama açılmıyor:** telefondaki geliştirici güveni veya Geliştirici Modu istemlerini izleyin. AltStore'da süreyi kontrol edip gerekirse yenileyin. Sürerse gerçek hatayı kaydedin; yalnızca bağlantı hatası uygulamayı silip kurma gerekçesi değildir.
- **OTT-play açılıyor ancak korumalı liste mobil ağda yüklenmiyor:** kurulum ve kaynak kimlik doğrulaması ayrıdır. **Ayarlar → Ayarları yönet → Kaynak erişimi** üzerinden yapılandırılmış kaynağa giriş yapıp listeyi yeniden yükleyin. Gerektiğinde biyometri/passkey veya e-posta kodunu fiziksel cihazda tamamlayın. Kaynak [iOS Access entegrasyonunu](docs/ios-source-access.md) desteklemelidir; uygulamayı kurmak IP izin listesini aşmaz.
- **Güvenilir Wi-Fi'da passkey isteniyor:** iOS Access kaynaklarında uygulama önce özgün kaynağı giriş yapmadan dener; kimliği doğrulanmış mobil girişi yalnızca erişim reddinden sonra kullanır. Kaynağın gerçekten gördüğü açık IP'yi, IPv6 dahil kontrol edin: izinli ev IPv4'ü başka IPv6, VPN veya mobil adresi kapsamaz. Ağ değişiklikleri ve yeniden açma geçici yol tercihini temizler. Genel ağ/sunucu hatası giriş istememelidir.
- **Giriş artık çıkmıyor ama kanal listesi boş:** geçerli kayıtlı oturum yeniden istem olmadan kullanılır. Önceki başarısız yükleme veya sunucu düzeltmesinden sonra listeyi yeniden yükleyin ya da uygulamayı bir kez tamamen kapatıp açın. Sürerse kaynağın HTML giriş sayfası veya JSON hatası yerine liste döndürdüğünü doğrulayın. Görünen hata ve HTTP durumunu kaydedin; kimlik bilgisi, çerez veya Access token içeren kaynak URL'lerini paylaşmayın.
- **Kanallar yükleniyor ama video tamponlanıyor veya `SRC_NOT_FOUND` diyor:** liste yükleme ve oynatma ayrı kontrollerdir. Girişten sonra kanalı bir kez tekrar deneyin; sürerse HLS manifest/segment yanıtlarını ve akışın codec desteğini kontrol edin. Hata tek başına motor değiştirme veya yeniden kurmanın yararlı olacağını kanıtlamaz.

<a id="option-2-testflight-if-available"></a>

#### Seçenek 2: TestFlight (varsa)

TestFlight daveti yayımlanmışsa App Store'dan TestFlight kurun, daveti cihazda açın ve **Yükle** düğmesine dokunun. GitHub'dan IPA indirmek TestFlight daveti sağlamaz.

<a id="option-3-xcode-for-developers"></a>

#### Seçenek 3: Xcode (geliştiriciler için)

[Derleme ve açma](docs/capacitor-mobile.md#build-and-open) adımlarını izleyin, Xcode'da **App** hedefini seçin, **Signing & Capabilities** altında geliştirme ekibini ayarlayın, bağlı cihazı seçip derleyin/çalıştırın. Gerektiğinde cihaz güveni ve Geliştirici Modu istemlerini tamamlayın. İmzasız sürüm IPA'sını Xcode Devices penceresine aktarmak eksik imza kimliğini veya provisioning profilini sağlamaz.

---

<a id="android-application"></a>

### Android uygulaması

Ortak oynatıcı arayüzü için bu deponun sürümündeki Full Capacitor APK'sını seçin. Android 5.1–6'da API 22 uyumluluk APK'sını kullanın; WebView 60 veya yenisi gerekir. Güncellerken uygulama kimliğini ve imza sertifikasını koruyun; mevcut profiller böylece erişilebilir kalır. [Derleme yönergelerine](android/README.md) ve [dağıtım, imzalama ve uzaktan kuruluma](docs/android-distributions.md) bakın.

Ayrı [ottplay-android deposu](https://github.com/open-ott-play/ottplay-android), yerel Kotlin/Compose uygulamasını içerir. Kendi kimliği, tercihleri ve sürüm iş akışı vardır; mevcut Capacitor kurulumunun yerine doğrudan geçmez. Tarihsel sürüm dosyaları erişilebilir kalır.

---

<a id="quick-start"></a>

## Hızlı başlangıç

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

Tarayıcı temel testlerinde aynı revizyonun kendi dağıtımınızı kullanın.

Node 22 ve kararlı Rust araç zincirini kullanın. Statik dosyaların bulunabilmesi için sunucuyu deponun kökünden çalıştırın. Yerel derlemeler aşağıda açıklanan platform araçlarını gerektirir; yalnızca sunucu derlemesinde gerekmezler.

İlk yüklemede **Demoyu dene** seçin veya **Ayarlar → Sağlayıcıyı değiştir → M3U / M3U8 listeleri** yolunu açın. **Liste seç** seçeneğini açın, bir yuva seçip **Liste URL'si** girin, düzenlemeyi kaydedin ve **Listeyi yükle** seçin. Liste veya sağlayıcı hesabını siz sağlarsınız; uygulama ücretli kanal aboneliği sunmaz.

<a id="mode-a-companion-smoke"></a>

## Mod A companion temel testi

Mod A companion için curl tabanlı test (`ottplay-server` / `archive/server.py` eşdeğerliği): indeks, statik dizinler, `/logo`, `/version`, isteğe bağlı `/epg` ve içerik indirmeden `POST /m3u/cp.php` yoklaması.

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

Kontroller `scripts/modea-smoke-checks.json` içindedir. Sır içermez. Komut kuyruğu / `local_proxy.py` (:8081), varsa `scripts/smoke-command-queue.sh` tarafından ayrıca test edilir.

<a id="classic-stalker--ministra-portals"></a>

## Klasik Stalker / Ministra portalları

**Stalker portalları** seçip sağlayıcının verdiği MAC'i ve tam portal URL'sini, örneğin `http://provider.example/stalker_portal/c/`, girin. `/c/index.html`, `/stalker_portal`, `/server/load.php`, `/load.php` ve `/portal.php` URL'leri klasik MAG protokolünü seçer. Mevcut yalın sunucu yapılandırmaları JSON-RPC'yi korur. Sağlayıcı profil, türler ve sayfalı canlı kanalları ortak Stalker çekirdeğiyle yükler, ardından klasik `type=vod` protokolü üzerinden filmleri ve iç içe klasörlerdeki bölümleri arka planda keşfeder. Klasör yolları normal Kanal listesinde kategorilere dönüşür; mevcut açıklamalar, posterler ve kalıcı genel Favoriler aynı medya arayüzünü kullanır. Bkz. [katalog davranışı ve sınırları](docs/stalker-media.md).

Kendi sunucunuzda barındırılan tarayıcı sürümünün istekleri companion'ın `/stalker/api` uç noktasından geçer; yerel uygulamalar mevcut HTTP taşımasını kullanır. Barındırma hizmetindeki tarayıcı sürümleri, [özel röle](docs/stalker-relay.md) üzerinden açıkça yapılandırılmış yollar gerektirir. Tarayıcı ve sunucu dosyaları birlikte güncellenmelidir.

Canlı oynatma akış açılırken geçici kanal komutlarını çözer; kanal değişimi, durdurma, PiP ve sağlayıcı değişimi eskimiş çözümlemeleri iptal eder. Açık, geçici olmayan HTTP(S) komutları doğrudan oynar. Kısa EPG desteklenir. Klasik portal arşivi ve ayrı `type=series` protokol çeşidi bu sağlayıcıda sunulmaz. Mevcut JSON-RPC arşiv/rehber davranışı değişmez. Companion yolunu kullanan özel LAN portalları, diğer companion proxy yollarında olduğu gibi kesin bir `OTTPLAY_PROXY_LAN_ORIGINS` girdisi ister.

Herkese açık Infomir demosu `http://middleware-stalker.com/stalker_portal/c/` adresindedir. 2026-09-26 tarihinde üç canlı katalog girdisi döndürdü ancak medya uç noktaları kullanılamıyordu; oynatma regresyonu için kontrollü portal/medya test verileri kullanın.

<a id="m3u-stream-proxy-header-smoke"></a>

## M3U akış proxy başlık testi

Mod A companion `POST /m3u/cp.php` yolunun denetlenebilir bir yankı URL'sini alırken eklediği üst sunucu istek başlıklarını karşılaştırır (varsayılan yerel taklit — IPTV sağlayıcısı veya sır yok).

Sözleşme (`src-rs/core/src/m3u.rs` + `archive/server.py`):
- Yalnızca **User-Agent** ekler (varsayılan `OTT-play-FOSS/1.0` veya `webos` / `tizen` / `viera` / `mag` / `dune` hazır ayarları).
- **Referer eklemez** (Capacitor `M3UProxy` ekler; Mod A eklemez).
- `url` başındaki `@` işaretini kaldırır (sağlayıcının jQuery formu).

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

Çıkış: `0` başarılı, `1` dinlemiyor, `2` başlık/HTTP uyuşmazlığı, `3` kullanım/bağımlılıklar. `smoke-modea-companion.sh` / `smoke-command-queue.sh` ile ilişkilidir.

<a id="logo-concurrent-bench-smoke"></a>

## Eşzamanlı logo yük testi

Mod A companion'a karşı eşzamanlı `GET /logo/<id>.svg` (isteğe bağlı `?ch=`) gecikme testi. Başarılı/başarısız sayıları ve p50/p95/p99 raporlar. Varsayılan pratik yerel CI yüküdür (`CONCURRENCY=200`, `TOTAL=1000`); tam 10 binlik uzun test isteğe bağlıdır (`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`).

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

Çıkış: `0` başarılı, `1` dinlemiyor / bağlantı başarısız, `2` yüksek hata oranı, `3` kullanım. `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh` ile ilişkilidir.

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## XMLTV önbellek yenileme / ısınma testi

Mod A companion'ın XMLTV/EPG önbellek davranışını `src-rs` karşısında gerçeğe uygun biçimde doğrular (uydurulmuş API yok):

- Bellekteki `EPG_CACHE`, `GET /epg/:hash` üzerinden sunulur → daima `{"epg_data":[...]}` (HTTP 200).
- Süreç başlangıcı HTTP açılışını geciktirmeden arka planda `EPG_URLS` alır; tamamlanan her alımdan sonra sonraki yenilemeye kadar **2h** beklenir.
- `DATABASE_URL` ayarlanırsa isteğe bağlı SQLite kalıcılığı (herkese açık önbellek durum uç noktası yok).
- `GET /health` → `OK`, isteğe bağlı yeniden başlatma sonrasında HTTP hazır oluşunu doğrular. `--strict-epg` ve `--epg-hash` ile test aynı `--warmup-timeout` bütçesi içinde o kanal için boş olmayan EPG de bekler.

Varsayılan yol yalnızca curl çalıştırır — **süreçleri öldürmez**. Otomatik sonlandırma+yeniden başlatma için `--restart-cmd` / `RESTART_CMD` verin veya `--help` içindeki elle `launchctl` adımlarını izleyin.

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

Çıkış: `0` başarılı, `1` dinlemiyor, `2` doğrulama / ısınma başarısız, `3` kullanım. `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh` ile ilişkilidir.

<a id="mode-a-e2e-play-path-smoke"></a>

## Mod A E2E oynatma yolu testi

Companion tarafında **oynatma yolu / akış hazır oluşu** testi (yalnızca HTTP — görünür arayüzlü E2E **değildir**). Çalışan Mod A companion üzerinde şunları kontrol eder:

- Health veya indeks erişimi
- Statik oynatıcı kabuğu dosyaları (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`)
- `EPG_HASH` ayarlıysa isteğe bağlı `GET /epg/<hash>.json`
- Sırsız JSON test verisiyle `POST /m3u/match-channels` (boş liste + bir sentetik kanal)
- Akış proxy'sinde **oynatma**: denetlenebilir medyaya `POST /m3u/cp.php` (varsayılan yerel HLS listesi veya `MEDIA_URL`), HTTP 200 + boş olmayan gövde / beklenen `Content-Type` doğrulaması (proxy'den geçen ilk baytlar)

Özel IPTV kimlik bilgileri yoktur. `smoke-modea-companion.sh` (varlık), `smoke-m3u-stream-proxy-headers.sh` (UA/Referer), `smoke-xmltv-cache-refresh.sh` ile ilişkilidir.

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

Çıkış: `0` başarılı, `1` dinlemiyor, `2` doğrulama başarısız, `3` kullanım/bağımlılıklar.

<a id="capacitor-device-smoke-mode-b"></a>

## Capacitor cihaz testi (Mod B)

Mod B Cap için simülatör / emülatör (isteğe bağlı gerçek cihaz) **kontrol listesi** — Mod A companion HTTP testi değildir. Arayüz başarısını insan işaretler; yardımcı araç zinciri / yerel dizinler / yumuşak komut kuyruğu curl testini otomatikleştirir.

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

Ayrıntılar: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md). `smoke-command-queue.sh` (Cap loopback) ile ilişkilidir — yukarıdaki Mod A testleriyle karıştırmayın.

<a id="tauri-desktop-smoke-mode-b"></a>

## Tauri masaüstü testi (Mod B)

Mod B Tauri için masaüstü kontrol listesi ve yardımcı (pencere / kanal oynatma / PiP). Mod A companion HTTP veya Cap cihaz testi değildir.

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

Ayrıntılar: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md). Yerel testte Apple geliştirici bilgileri isteğe bağlıdır; paketlenmiş Mac uygulaması için [ad-hoc imza](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials) kullanın. İnsan kabulü hâlâ başlatma, oynatma ve PiP'yi kapsar.

<a id="docker"></a>

## Docker

Çok mimarili görüntüler (amd64/arm64) aday OCI arşivleri olarak derlenir. Kayıt deposuna yayınlama, onaylanmış kararlı arşivi yeniden derlemeden Docker Hub'a yükseltir; [işletim kılavuzuna](docs/release-workflow.md) bakın.

Sunucu ikilisi **musl** (Alpine) üzerinde derlenir ve Alpine ile sunulur — GLIBC_2.38+ **gerektirmez**. Bu, `alvit/ottplay-foss` görüntüsünü Synology DSM Docker (x86_64) ve eski glibc kullanan diğer ana makinelerde çalışabilir tutar.

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

Kararlı kayıt etiketleri `X.Y.Z` kullanır. `latest` güncellemesi, sürümlü görüntü yayımlandıktan sonra ayrı bir açık seçenektir; main gönderimleri ve Git etiketleri görüntü yayımlamaz.

<a id="build-from-source"></a>

## Kaynaktan derleme

Oynatıcının alan kuralları `vendor/ottplay-core.js` içindeki sabitlenmiş Kotlin çok platformlu çıktısından gelir. Rehber, arşiv, liste, sağlayıcı, kalıcı durum ve oynatma kararları uygulamalarını FOSS2 ve yerel Android ile paylaşır. Tarayıcı/TV, Swift ve Rust bağdaştırıcıları cihaz API'leri, codec'ler, ağ ve arayüz etkilerini üstlenir. Tarayıcı çıktısı ES5 sözdizimini ve desteklenen eski API başlatmasını korur. `npm test`, `check:bundle` ve `check:es5` entegrasyonu doğrular; çıktı manifesti kaynak ve çıktı karmalarını kaydeder.

Control-server ve SWOP protokol doğrulayıcıları sürümlü `contracts/ottplay-wire-v1.json` şemasından üretilir. Denetlenen üretici kayıtları ve değişmez uyumluluk test verileri tüketiciye özel politika kopyalarını önler.

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

## Cihaz algılama

Oynatıcı 24 cihaz türünü destekler. Algılama sırası: önce URL `/f/{device_id}/`, ardından User-Agent.

| Cihaz kimliği | Cihaz |
|---|---|
| `pc` | PC tarayıcısı |
| `pc2` | videojs web oynatıcısı |
| `nodejs` | Windows uygulaması (Electron) |
| `lg/webos` | LG WebOS TV'ler |
| `samsung/tizen` | Samsung Tizen TV'ler |
| `samsung/maple` | Samsung Orsay TV'ler |
| `mag` | Infomir MAG kutuları |
| `dune` | Dune HD kutuları |
| `android` | Android TV / tabletler |
| `hbbtv` | HbbTV TV'ler |
| `panasonic` | Panasonic Viera TV'ler |
| `philips` | Philips TV'ler |
| `sony` | Sony TV'ler |
| `sharp` | Sharp TV'ler |
| `toshiba` | Toshiba TV'ler |
| `hisense` | Hisense TV'ler |
| `skyworth` | Skyworth TV'ler |
| `tcl` | TCL TV'ler |
| `vewd` | Vewd cihazları |
| `spark` | Spark alıcıları |

<a id="push-command-system"></a>

## Push komut sistemi

Ayrı bir çok cihazlı hizmet için [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) ve **Ayarlar → Uzaktan kontrol** içindeki **Komut sunucusu** bölümünü kullanın. IP/adresi ve bu oynatıcının cihaz erişim kodunu girin; ikisini kaydetmek ses, kanal ve diğer komutlar için yoklamayı otomatik başlatır. Portsuz IP, HTTP 8081 kullanır. Durdurmak için adresi temizleyin veya **Bağlantıyı kes** seçin. Bu dışarıya doğru bağlantı onaylı teslim destekler ve yerel dinleyici gerektirmez. [Bağlantı ve uyumluluk ayrıntılarına](docs/remote-command-server.md) bakın. Aşağıdaki örnekler mevcut yerel proxy/dinleyici modunu açıklar.

**Komut sunucusunu bul**, cihaz belirtecini kopyalamadan bir denetleyici bulup operatör onayı istemenizi sağlar. Tauri önce yerel DNS'i kontrol eder ve sonuç boşsa açıkça yapılandırılmış bir dağıtım profiline geçebilir; tarayıcı, LG ve Capacitor oynatıcıları tarayıcı profili yolunu kullanır. Home keşif meta verileri, denetleyiciden bağımsız olarak here.now üzerinde barındırılabilir. Genel derlemeler bu Home profilini otomatik olarak içermez ve güncellemeler kayıtlı bağlantıları değiştirmez. [Platform davranışı, profil kurulumu ve sorun giderme](docs/remote-command-server.md#discovery-and-one-time-approval) bölümüne bakın.

Yerel HTTP uzaktan kontrol tarayıcı/OTT sunucu oynatıcısı, Tauri ve Capacitor'da **varsayılan olarak kapalıdır**. Gizli cihaz kodu üretmek için **Oynatıcı ayarları → Uzaktan kontrol** içinde açın. Komutlar `"command"` alanı olan JSON nesneleridir; HTTP istekleri `Authorization: Bearer <device-code>` gerektirir.

<a id="architecture"></a>

### Mimari

<a id="local-command-url-recommended"></a>

#### Yerel komut URL'si (önerilir)

**Oynatıcı ayarları → Uzaktan kontrol** içinde **Yerel HTTP uzaktan kontrol** açın, üretilen **Cihaz kodunu** kopyalayın ve aşağıdaki proxy'yi bu kodla ayarlayın. **Yerel komut URL'sini** proxy komut uç noktasına ayarlayın. Etkinken oynatıcı bu URL'yi Authorization başlığındaki cihaz koduyla her 10 saniyede bir yoklar. Yalnızca URL ayarlamak komut kontrolünü açmaz.

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### Cihaz UUID'si

Mevcut Cihaz UUID'si (ör. `dev_a1b2c3d4e5`) açık yönlendirme metaverisidir, yetkilendirme bilgisi değildir. Ayrı **Cihaz kodu** yerel HTTP kontrolü açıldığında güvenle üretilir ve cihazda kalır; bulut ayarlarıyla kopyalanmaz. Yerel HTTP kontrolünü kapatmak yoklama/dinleyicileri durdurur. Yeniden açmak yeni kod üretir: eski kimlik bilgisini iptal etmek için proxy ve entegrasyonları güncelleyin.

Tauri ve Capacitor loopback HTTP dinleyicisini ancak bu ayar izninden sonra başlatır. Yönlendirme proxy'leri gösterilen cihaz kodunu Bearer token olarak o dinleyiciye göndermelidir. Mod A, aşağıdaki ayrı ayarlanan `local_proxy.py` kuyruğunu kullanır.

<a id="remote-text-entry-swop"></a>

#### Uzaktan metin girişi (swop)

Amaç: TV ve telefon **farklı ağlardayken** Cloudflare Worker oturum devri yoluyla ♥™ / uzaktan sanal klavye için telefonda yazmak.

- Worker deposu: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop)
- **Kurulum yetkilendirmesi:** oynatıcı istekleri sunucusuyla aynı origin'deki `/swop` aktarıcısına gönderir. Sunucu kendi özel kurulum token'ını ekler; kayıtlı sunucu origin'indeki her istemci uzaktan metin girişi kullanabilir. Cihaz UUID'leri oturumları tanımlar ve cihaz başına izin listesi gerekmez.
- Ayar: `swopBaseUrl` (boş = ♥™ “yapılandırılmadı” gösterir / işlem yapmaz). **Ayarlar → Uzaktan kontrol** (tuş **2**) içinde düzenleyin veya operatör kurulumlarında Git tarafından yok sayılan `/local/swop.json` üzerinden enjekte edin
- `POST /session`, `clientId`, `caption` ve `draft` içerir; `POST /val`, `clientId`, `code` ve döndürülen `sessionToken` içerir. Telefon URL'si ayrı bir yazma token'ı taşır. Oturum okuma token'ları tarayıcı belleğinde kalır.
- **Yerel kurulum:** Worker'da kurulum ve kesin LAN/localhost origin'lerini kaydettikten sonra `SWOP_BASE_URL` ve `SWOP_INSTALLATION_TOKEN` ayarlayın. `scripts/install-ottplay-local-service.sh` bunları özel mod-0600 launchd plist dosyasında korur. Açık `/local/swop.json` yalnızca `{"swopBaseUrl":"/swop"}` içerir. Kurulum token'ını asla açık dosyalara koymayın.
- **Statik barındırma:** aynı iki uç nokta için sunucu tarafında kimliği doğrulanmış proxy ayarlayın. Kurulum token'ını barındırma hizmetinin sırlarında tutun. Açık oynatıcı dosyalarını kopyalamak sunucu kimlik bilgisini kopyalamaz.

> Merkezi OTT sunucusu `/api/webhook/commands`, `/webhook/poll`, `/webhook/notify` ve komut sağlık takma yollarını tüm HTTP yöntemleri için kapalı tutar. Mod A için ayrı komut sunucusu veya açıkça ayarlanmış, kimliği doğrulanmış `local_proxy.py` kullanın; merkezi sunucuda yayın komut kuyruğu yoktur.

<a id="available-commands"></a>

### Kullanılabilir komutlar

Aşağıdaki tüm örnekler yerel proxy URL'si olarak `http://192.168.1.50:8081/api/webhook/commands` kullanır. Gerçek proxy adresinizle değiştirin ve `OTTPLAY_QUEUE_HTTP_TOKEN` değerini oynatıcıda HTTP kontrolü açılınca gösterilen **Cihaz koduna** ayarlayın. Proxy aynı kodla yapılandırılmalıdır.

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — Bildirim göster

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| Alan | Tür | Varsayılan | Açıklama |
|---|---|---|---|
| `message` | string | zorunlu | Gösterilecek metin |
| `popup_duration` | number | 5 | Gösterim süresi, saniye (sağ üst köşe) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — Listedeki konumla kanal değiştir

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| Alan | Tür | Varsayılan | Açıklama |
|---|---|---|---|
| `channel_number` | number | zorunlu | Listedeki 1 tabanlı kanal konumu |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — (Kısmi) ada göre kanal değiştir

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

Büyük/küçük harfe duyarsız alt dize araması. İlk eşleşme kazanır.

| Alan | Tür | Varsayılan | Açıklama |
|---|---|---|---|
| `channel_name` | string | zorunlu | Kanal adı veya adın bir bölümü |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — Rastgele kanala geç

Bu eski komut, geçerli liste veya kategoriden uygun kanalları seçer. Kanal numaraları ve aralıklar bu listedeki konumları belirtir; [güvenli rastgele seçim kurallarına](docs/remote-command-server.md#safe-random-playback) bakın.

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

| Alan | Tür | Varsayılan | Açıklama |
|---|---|---|---|
| `random_range` | [start, end] | geçerli liste | 1 tabanlı aralık |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — IPTV sağlayıcısını değiştir

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| Alan | Tür | Varsayılan | Açıklama |
|---|---|---|---|
| `provider` | number | zorunlu | Sağlayıcı dizisindeki indeks (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — Yeni M3U listesi yükle

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| Alan | Tür | Varsayılan | Açıklama |
|---|---|---|---|
| `playlist` | string | zorunlu | M3U listesi URL'si |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — Sağlayıcı yapılandırmasını güncelle

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| Alan | Tür | Varsayılan | Açıklama |
|---|---|---|---|
| `provider_settings` | string | zorunlu | Sağlayıcı yapılandırmalı JSON dizesi |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — Sesi ayarla veya değiştir

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

Ses kontrolü desteklemeyen istemcilerde sessizce yok sayılır.

| Alan | Tür | Varsayılan | Açıklama |
|---|---|---|---|
| `volume` | number | — | Mutlak düzey 0-100 |
| `volume_step` | number | — | Göreli değişim, ör. +10 veya -5 |

<a id="player-standby-restart-and-exit"></a>

#### Oynatıcı bekleme, yeniden başlatma ve çıkış

Yerel proxy'nin onaysız webhook kuyruğu `exit_player` veya türlenmiş bekleme/uyandırma isteklerini desteklemez. Oynatıcıyı [komut sunucusuna](docs/remote-command-server.md) bağlayın ve CLI'sini kullanın:

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

`d1` yerine kayıtlı oynatıcı takma adını yazın. `stop`, `standby` için; `start` ve `wake`, `go` için takma addır. Go çalışan, bağlı oynatıcı gerektirir; kapalı uygulamayı başlatamaz veya çevrimdışı cihazı uyandıramaz. Yerel uygulama çıkışı olmayan tarayıcı veya TV çıkışın desteklenmediğini bildirir. Bekleme uzaktan yoklamayı açık tutar ve ana makinenin veya ortak sunucunun ilgisiz işlerini askıya almaz.

Standby/go sonrasında `ott d1 status` ile bekleme/arka plan durumunu kontrol edin ve devam eden oynatmayı ayrıca doğrulayın. Oynatıcı yeniden yüklendikten sonra `ott d1 doctor` ile yeni çalışma zamanını doğrulayın. Çıkıştan sonra işletim sistemi üzerinden uygulama sürecinin kapandığını kontrol edin; uzaktan zaman aşımı çıkış kanıtı değildir. Komutun yalnızca kabul edilmesi bu sonuçları doğrulamaz.

<a id="local-proxy-server"></a>

## Yerel proxy sunucusu

`local_proxy.py` tek oynatıcı için bağımsız, kimliği doğrulanmış komut kuyruğudur. Varsayılan çağrı port açmadan çıkar. Her proxy örneği oynatıcının ürettiği cihaz kodunu kullanır; birden fazla oynatıcı için ayrı örnek/port kullanın. `device_id` sorgu parametresi uyumluluk metaverisi olarak kabul edilir; kimlik doğrulamaz veya başka cihaz seçmez.

<a id="start-the-proxy"></a>

### Proxy'yi başlatma

1. Oynatıcıda **Yerel HTTP uzaktan kontrol** açın ve **Cihaz kodunu** kopyalayın.
2. Proxy ana makinesinde kodu ve oynatıcıyı sunan kesin origin'i (şema, ana makine, port; yol yok) ayarlayın:

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. Oynatıcının **Yerel komut URL'sini** `http://192.168.1.50:8081/api/webhook/commands` olarak ayarlayın.

Varsayılan bağlanma adresi `127.0.0.1` değeridir; örnek LAN erişimini açıkça açar. `OTTPLAY_QUEUE_HTTP_ORIGINS`, virgülle ayrılmış kesin tarayıcı origin izin listesidir. Oynatıcı HTTPS ile sunuluyorsa karma içerik kurallarının yoklamaya izin vermesi için HTTPS ters proxy kullanın. Cihaz kodunu gizli ve URL dışında tutun. Yeni kod üretildiğinde proxy'yi yeni değerle yeniden başlatın; yalnızca oynatıcıyı kapatmak bağımsız yönetilen proxy sürecini durdurmaz.

<a id="endpoints"></a>

### Uç noktalar

| Yöntem | Yol | Açıklama |
|---|---|---|
| `POST` | `/api/webhook/commands` | Komutu kuyruğa ekle |
| `GET` | `/api/webhook/commands` | Kuyruktaki komutları al (oynatıcı yoklaması) |
| `POST` | `/webhook/notify` | Kimliği doğrulanmış uyumluluk takma yolu |
| `GET` | `/webhook/poll` | Kimliği doğrulanmış uyumluluk takma yolu |

Gönderme ve boşaltma eşleşen Bearer cihaz kodunu gerektirir. Kimlik doğrulamasız yayın uç noktası yoktur. Komutlar 60 saniyede sona erer; her proxy en fazla 50 komut tutar.

Proxy aynı anda en fazla 16 bağlantı işler; boşta tarayıcı bağlantısı veya eksik istek diğer komutları geciktirmez. Her soketin beş saniyelik hareketsizlik zaman aşımı vardır; tüm çalışanlar meşgulken ek bağlantılar kapatılır. Kuyruğa ekleme ve boşaltma çalışanlar arasında atomiktir.

<a id="smoke-script-all-modes"></a>

### Temel test betiği (tüm modlar)

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Android emülatörü/cihazı: önce `adb forward tcp:18081 tcp:18081`. Cap/Tauri yalnızca loopback'tir — LAN Home Assistant için bu Mod A proxy'sini kullanın. Ayrıntılar: `docs/capacitor-mobile.md` § Smoke test.

<a id="cors"></a>

### CORS

Proxy yalnızca `OTTPLAY_QUEUE_HTTP_ORIGINS` kaynaklı tarayıcı isteklerine izin verir. İzinli origin'den gelen ön kontrol `OPTIONS` istekleri token istemez; her gerçek GET/POST Bearer cihaz kodu gerektirir. Joker ve `null` origin'leri kabul edilmez. Home Assistant ve diğer tarayıcı dışı çağıranlar Origin'i atlayabilir, ancak yine de kimlik doğrulamalıdır.

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### Örnek: Home Assistant webhook → yerel proxy → oynatıcı

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

### Home Assistant otomasyon örnekleri

Bildirim, kanal ve ses örnekleri yerel proxy kullanır. Home Assistant `secrets.yaml` içindeki `ottplay_device_authorization` değerini açık oynatıcının gösterdiği kodla `Bearer <device-code>` olarak ayarlayın.

Gece beklemesi ayrı [komut sunucusunu](docs/remote-command-server.md) kullanır. Aşağıdaki örnek URL ve `DEVICE_UUID` yerine denetleyici adresi ile kayıtlı cihaz kimliğini yazın; yerel CLI takma adı `d1` cihaz kimliği değildir. `secrets.yaml` içinde `ottplay_control_authorization` değerini `Bearer <controller-admin-token>` olarak ayarlayın. Bu bilgi yerel proxy cihaz kodundan ayrıdır. Home Assistant [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) ve [sırlar](https://www.home-assistant.io/docs/configuration/secrets/) belgelerine bakın.

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

`standby_request` otomasyon izi için HTTP yanıtını içerir. HTTP 202 yalnızca kuyruğa alındı demektir: `content.id` saklayın, ardından oynatıcı yanıtı için aynı denetleyici bilgisiyle `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` yoklayın. Yeni bir `status` isteği `player.standby` ve `player.background` gözlemler; beklemenin açık, `suspended` durumunun mevcut ve bekleyenlerin sıfır olması oynatıcının izlenen işlerinin boşaldığını doğrular. Beklemeden çıkmak için aynı türlenmiş isteği `"operation":"wake"` (`ott d1 go`) ile kullanın. Zaman aşımından sonra değişikliği körlemesine yinelemeyin. Denetleyicinin [istek/yanıt API'sine](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) ve [bekleme anlamına](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake) bakın.

<a id="server-api-reference"></a>

## Sunucu API başvurusu

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Webhook uç noktaları (Rust `ottplay-server`)

Rust sunucusu ve arşivlenmiş Python yedeği komut uç noktalarını HTTP 403 ile reddeder. `/api/webhook/commands`, `/webhook/notify`, `/webhook/poll` ve komut sağlık takma yolları komut eklemez, yayınlamaz veya boşaltmaz. Genel geri bildirim API'si bu ayrılmış yolları geçersiz kılamaz. Mod A komut teslimi yukarıdaki ayrı ayarlanmış komut sunucusunu veya kimliği doğrulanmış yerel proxy'yi kullanır.

<a id="other-endpoints"></a>

### Diğer uç noktalar

| Yöntem | Yol | Açıklama |
|---|---|---|
| `GET` | `/epg/<hash>.json` | Kanalın EPG verileri |
| `GET` | `/logo/<id>.svg` | Üretilmiş kanal logosu |
| `GET` | `/version/<path>` | Dosya sürüm karması |
| `POST` | `/m3u/match-channels` | Kanal–EPG eşleştirme |
| `POST` | `/m3u/match-logos` | Kanal logosu eşleştirme |
| `POST` | `/m3u/cp.php` | Akış proxy'si |
| `GET/POST` | `/feedback/` | Geri bildirim günlüğü |
| `GET` | `/tmdb/*` | TMDb API proxy'si |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## Proje yapısı

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

## STB tuş eşlemeleri

- **Samsung Tizen**: `RETURN=10009`, `ENTER=13`, renkler 403-406
- **Samsung Maple**: dpad 4/5/6/8, özgün SDK kodları
- **LG WebOS**: `RETURN=461`, HbbTV uyumlu renkler
- **LG NetCast**: `RETURN=8`, HbbTV kodları
- **MAG**: `RETURN=8`, MAC için gSTB API
- **Dune HD**: standart kodlar, Dune API
- **Android TV**: Android tuş kodları (`BACK=4`, `DPAD_*` 19-22, `ENTER=66`)
- **HbbTV/Panasonic/Philips/Sony/vb.**: HbbTV kodları (`RED=403`, `BLUE=406`, `VOL_UP=447`)

<a id="documentation"></a>

## Belgeler

- [Belge vikisi](./docs/wiki/Home.tr.md) / [Rusça viki](./docs/wiki/Home.ru.md) — göreve yönelik gezinme ve bakım kuralları.
- [Uygulama raporu](./docs/implementation-report.tr.md) / [Rusça süreç ve sonuç](./docs/implementation-report.ru.md) — renkli şemalar, doğrulanmış davranış, ölçülen maliyet ve sürüm geçitleri.
- [Teslim kılavuzu](./docs/roadmap-delivery.tr.md) / [Rusça yeni özellikler kılavuzu](./docs/roadmap-delivery.ru.md) — özellikler, sınırlar ve doğrulama.
- [88 arayüz dilinde hızlı başlangıç](./docs/readme/README.md) — gönderilen arayüz çevirilerinden üretilir; ana kılavuz ve eşlenik özellik kılavuzları [24 belge dilinde](docs/manual-translations.md) kullanılabilir.
- [Kalite sınırları ve canlı kurtarma](./docs/playback-stream-policy.tr.md) / [Rusça](./docs/playback-stream-policy.ru.md).
- [Elle XMLTV eşleştirme ve klasik erişilebilirlik](./docs/guide-binding-accessibility.tr.md) / [Rusça](./docs/guide-binding-accessibility.ru.md).
- [Barındırılan ses/video kontrolü](./docs/audio-video-check.tr.md) / [Rusça](./docs/audio-video-check.ru.md).
- [Xtream medya kitaplığı](./docs/xtream-media.tr.md) / [Rusça](./docs/xtream-media.ru.md).
- [Aynı kaynaklı cihaz devri](./docs/remote-handoff.tr.md) / [Rusça](./docs/remote-handoff.ru.md).
- [Kurtarılabilir yerel ayarlar](./docs/settings-recovery.tr.md) / [Rusça](./docs/settings-recovery.ru.md).
- [Tarayıcı nesilleri, işletim sistemleri ve kesin sürüm adayı kontrolleri](docs/browser-compatibility.tr.md) / [Rusça](docs/browser-compatibility.ru.md).

- [Oynatıcı mimarisi](./docs/architecture.md) — çalışma zamanı sorumlulukları, sağlayıcı entegrasyonu, oynatma, rehber, cihaz bağdaştırıcıları ve derleme sözleşmeleri.
- [Klasik ES5 derleme hattı](./docs/build-pipeline.md) — derleme, uyumluluk kontrolleri ve çıktı boyutu sınırları.
- [Çalışma zamanı dosya adları ve dağıtım geçişi](./docs/asset-layout.md) — web ve yerel paketlerin paylaştığı açıklayıcı yollar.
- [Uzaktan çalışma tezgâhı](./docs/remote-workbench.md) — arayüz/medya incelemesi, işlem kayıtları ve saklanan kanıtlar.
- [Çalışma zamanı tanılaması](./docs/runtime-debug.md) — hata geçmişi, kare/döngü sayaçları, Capacitor/Tauri yerel ölçümleri ve sunucu hata ayıklama.
- [Yerel macOS teslimi](./docs/macos-local-delivery.md) — checkout derlemeleri, yerel kurulum ve doğrulama.

<a id="license"></a>

## Lisans

[MIT](LICENSE) — özgür ve açık kaynak. Sağlayıcı içeriği ve üçüncü taraf bağımlılıklar kendi haklarını ve lisanslarını korur.

PlxNative’den türetilen ayrı [OTTPlay native webOS](docs/native-webos.md) uygulaması, karşılık gelen kaynak koduyla birlikte **GPL-3.0-or-later** altında dağıtılır.
Proje kökündeki MIT lisansı, bu yerel uygulamanın veya yamalarının lisansını değiştirmez.

<a id="desktop-updater--notarization-mode-b"></a>

## Masaüstü güncelleyici / noter onayı (Mod B)

[Masaüstü imzalama ve güncelleyici kılavuzu](docs/tauri-updater-notarize.md), macOS ad-hoc imzasını, isteğe bağlı Developer ID/noter onayını ve paket doğrulamasını açıklar. Sürüm CI'ı Apple bilgileri olmadan ad-hoc imza kullanır. Güncelleyici imzası ayrıdır; üretim otomatik güncellemeleri henüz ayarlanmamıştır.

<a id="local-mac-build-helpers"></a>

## Yerel Mac derleme yardımcıları

[docs/local-build-scripts.md](docs/local-build-scripts.md) belgesine bakın.

<a id="privacy"></a>

## Gizlilik

Yerel ayarlar, yapılandırılan hizmetler ve seçenekleriniz için [gizlilik politikasını](docs/privacy-policy.md) okuyun. Gizlilik ve destek iletişimi: [alvit.work@gmail.com](mailto:alvit.work@gmail.com).

Studio 2026 varsayılan arayüz temasıdır. Classic ve PLi-HD seçilebilir kalır, kayıtlı tercihler korunur. [Arayüz ayarlarına](docs/interface-settings.md) bakın. PLi-HD teması Vali, littlesat, VU+NL, Milo ve üst proje katkıcılarını belirtir. İngilizce geçmiş ve kaynak bağlantıları için [arayüz katkıları ve tasarım geçmişine](docs/interface-history.md) bakın; oynatıcının bilgi menüsünden de açılır.

<a id="demo-video-editing"></a>

## Demo video düzenleme

Tanıtım kayıtlarını hazırlamak ve düzenlemek için yerel [video-use iş akışını](docs/demo-video.md) kullanın. Yardımcı, üretilen tüm medyayı Git dışında tutar.

<a id="plex-media-library"></a>

## Plex medya kitaplığı

Her oynatıcı **Plex** sağlayıcısıyla bir Plex hesabına veya Plex Media Server'a bağlanabilir. Entegrasyon Plex kullanır; Synology medya sunucusu için olası ana makinelerden biridir. Erişilebilir tüm videolar ve müzik parçaları kanal listesine otomatik eklenir; kategori seçimi kitaplık, klasör veya diziye göre filtreler. Oynatma ilk kullanılabilir partiden başlar; arka plan yüklemesi, standart arama ve karıştır/tekrarla Eylemleri vardır, OTT sunucusunda Plex ayarlamak gerekmez. [Plex girişi ve doğrudan oynatmaya](docs/plex-provider.md) bakın.

![Plex yükleme, dosya gezinme ve kapanış yaşam döngüsü](docs/images/plex-playback-lifecycle.svg)

[Resimli güvenilirlik incelemesi](docs/plex-provider.md#reliability-review-process-and-results), yükleme ve iptal kurallarını, tam katalog ve dosya geçişi düzeltmelerini, ölçülmüş Chromium/WebKit doğrulama sonuçlarını açıklar.

<a id="related-repositories"></a>

## İlgili depolar

- [ottplay-core](https://github.com/open-ott-play/ottplay-core), ortak JVM/ES5 alan mantığını, iletişim sözleşmelerini ve FOSS2 istemcisini barındırır. Bu oynatıcı üretilen çıktıları tüketir; ortak değişikliklerde çekirdek teslim kılavuzunu izleyin.
- [ottplay-android](https://github.com/open-ott-play/ottplay-android), kendi kurulum ve sürüm kimliğine sahip ayrı yerel Kotlin/Compose uygulamasıdır.
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server), kendi barındırdığınız uzaktan komutları sağlar; [ottplay-swop](https://github.com/open-ott-play/ottplay-swop), isteğe bağlı Worker tabanlı metin taşıması sunar.
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine), tarayıcı demosunun barındırılan profilini, demo medyasını ve yayın doğrulamasını yönetir.

<a id="project-maintenance"></a>

## Proje bakımı

[Katkı ve test gereksinimlerine](CONTRIBUTING.md), [güvenlik bildirim politikasına](SECURITY.md), [güvenlik tasarımına](docs/security-design.md) ve [OpenSSF kanıtları ile kalan ölçütlere](docs/openssf-evidence.md) bakın.
