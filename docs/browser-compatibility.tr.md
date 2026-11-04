<a id="browser-generations-and-operating-systems"></a>

# Tarayıcı nesilleri ve işletim sistemleri

<!-- language-navigation:start -->
<p dir="ltr">
<a href="browser-compatibility.md" lang="en" dir="ltr">English</a> · <a href="browser-compatibility.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="browser-compatibility.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="browser-compatibility.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="browser-compatibility.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="browser-compatibility.es.md" lang="es" dir="ltr">Español</a> · <a href="browser-compatibility.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="browser-compatibility.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="browser-compatibility.he.md" lang="he" dir="rtl">עברית</a> · <a href="browser-compatibility.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="browser-compatibility.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="browser-compatibility.it.md" lang="it" dir="ltr">Italiano</a> · <a href="browser-compatibility.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="browser-compatibility.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="browser-compatibility.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="browser-compatibility.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="browser-compatibility.pt.md" lang="pt" dir="ltr">Português</a> · <a href="browser-compatibility.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="browser-compatibility.th.md" lang="th" dir="ltr">ไทย</a> · <a href="browser-compatibility.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="browser-compatibility.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="browser-compatibility.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="browser-compatibility.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="browser-compatibility.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[Ölçülen sonuçlar](implementation-report.tr.md#browser-gate-integration)

![Yapılandırılmış tarayıcı yeterlilik denetimi: 35 hedef, 166 senaryo yürütmesi](diagrams/browser-qualification.svg)

Mevcut cihaz, medya, eski ES5/worker, yerel arayüz ve Apple yerel HLS kontrolleri zorunlu olmaya devam eder. Ortak TypeScript iş akışı ayrıca tam olarak paketlenmiş Mode A arşivinde Plex senaryolarını çalıştırır: iki yerelleştirilmiş yükleme/yeniden yükleme akışı, medya değişimi ve yeniden yüklemede HLS.js ve Video.js en-boy oranının korunması ve HLS.js ile katı kiosk modunda bölümün doğal olarak bitmesi. Medya senaryoları gerçek kod çözme kullanır; tüm senaryolar gerçek DOM ve giriş kullanır. Yalnızca Plex verileri ve medya kaynağı yerel sentetik test verileridir.

En-boy oranı test verisi, depodaki H.264/AAC taşıma akışını ayrı fMP4 varyantlarına yeniden paketler. Başlatma başlıkları, [RFC 8216 bölüm 3.3](https://www.rfc-editor.org/rfc/rfc8216#section-3.3) gereğince `iso6` markasını ve sıfır film/iz süresini kullanır. AVC örnek girdisi de SPS sayısında gereken ayrılmış bitleri ve son `pre_defined` alanında işaretli `-1` sabitini kullanır. Böylece sabitlenmiş test çoğullayıcısının ürettiği kapsayıcı sözdizimi düzeltilir. Test sözleşmesi başlıkları denetler, bozuk kutuları reddeder ve codec parametre kümelerinin, iz kimliklerinin, zaman ölçeklerinin ve medya parçası baytlarının değişmediğini doğrular. Bu, sentetik girdiyi doğrular; tek başına tarayıcıda oynatmayı kanıtlamaz veya tam RC matrisinin yerini tutmaz.

Pull request’ler Linux’ta güncel Chromium, Firefox ve WebKit, Windows’ta Chromium ve macOS’ta WebKit gerektirir. Gecelik ve beta derlemeler bu beş hedefi gerektirir. RC yeterliliği, tanımlı 35 hedefin tamamını gerektirir: Linux, Windows ve macOS’ta üç kesin Playwright/tarayıcı nesli, üç sistemde kurulu kararlı Chrome/Edge ve Linux’ta beta Chrome/Edge. İki tarihsel macOS WebKit hedefi (Playwright 1.62.1 ve 1.63.0) `macos-15-intel` kullanır; kayıtları gerçek süreç mimarisini belirtir ve ARM çalıştırıcıyı reddeder. Doğrudan MSE tanısı, aynı H.264 başlatma ve medya baytlarının Intel’de 1.63 ve ARM’de 1.64 ile tamamlandığını, macOS 15 ARM VM’deki eski WebKit’in ise `updateend` öncesinde takıldığını gösterdi. Kapsayıcı değiştirmek, ManagedMediaSource kullanmak veya tarayıcı penceresi açmak bunu gidermedi. Bu iki hedef hâlâ beş özgün oynatma/arayüz senaryosunun tümünü gerektirir. Çalıştırıcı seçimi, her fiziksel macOS cihazı veya yerel Safari hakkında bir iddia değildir. Envanter yeniden üretilirken incelenmiş çalıştırıcı istisnaları korunmalıdır; profil sözleşmesi bunların kaldırılmasını reddeder.

Üç Linux WebKit neslinin tamamı açıkça `ubuntu-26.04` x64 çalıştırıcısını kullanır. İncelenen resmî çalışma ortamı karşılaştırması Ubuntu 24.04’te katı kiosk geçiş hatasını yeniden üretti; aynı aday ve değiştirilmemiş beş senaryo Ubuntu 26.04’te art arda dört kez geçti. Böylece tekil çoklu ortam kitaplıkları değiştirilmeden veya oynatma doğrulamaları gevşetilmeden tutarlı, desteklenen bir ortam seçilir. Diğer Linux tarayıcı hedefleri mevcut çalıştırıcılarını korur. Kesin kaynak, çıktı, karşılaştırma sonuçları ve sınırlar için [Linux WebKit çalışma ortamı yeterliliğine](linux-webkit-runtime.md) bakın. Tam RC matrisi ve ayrı paketlenmiş yerel kabul testleri zorunludur.

Test edilen ürün sürümleri çalışma sırasında kaydedilir. Playwright Firefox, onun yamalı derlemesidir; yerel Firefox ESR hakkında bir doğrulama değildir. WebKit, Safari değildir. Bu matris fiziksel televizyonlarda veya yerel kabuklarda yeterlilik testinin yerini tutmaz.

Tam envanter **35 platform hedefi içerir: HLS destekleyen 32 hedef ve yalnızca arayüz için üç Windows WebKit hedefi**. Son üçü hâlâ iki yerelleştirilmiş yükleme/yeniden yükleme akışını gerektirir; WebKit derlemelerinde MediaSource veya yerel HLS yoktur. Bu, belirtilmiş bir sınırlamadır; başarıyla doğrulanmış oynatma kapsamı değildir. Üç kesin hedef kimliği `scripts/browser-compatibility-profile.cjs` içinde incelenir. Arayüz testlerinden önce yetenek yoklaması bu sınırlamayı doğrulamalıdır. MSE (ManagedMediaSource dâhil) veya yerel HLS kullanılabilir olursa profil yükseltilene kadar kontrol kapısı başarısız olur. Diğer her hedef hem H.264 hem AAC MSE desteği ve değiştirilmemiş beş senaryoyu gerektirir; yetenek kaybı daha küçük test kümesi seçmek yerine hata verir. Yoklama adayın HLS kitaplığını yükler ve sabitlenmiş örneğin varsayılanının seçtiği arka ucu denetler: MediaSource, ardından ManagedMediaSource, ardından WebKitMediaSource. Kayıt, arka ucu ve HLS sürümünü belirtir; varsayılan veya sürüm değişikliği yoklama sözleşmesinin açıkça incelenmesini gerektirir.

Dolayısıyla tam RC, 35 hedef kaydıyla **166 başarılı senaryo yürütmesi** (32 × 5 + 3 × 2) gerektirir. PR/gecelik/beta alt kümesi beş hedef ve 25 yürütme olarak kalır. Her kayıt, kesin senaryo kümesini, yetenek yoklamasını ve başarılı HLS kapsamını veya açık desteklenmeme nedenini içerir. Bunlar yapılandırılmış gereksinimlerdir; belirli bir RC’nin bunları zaten tamamladığı iddiası değildir. Sınırlama, Playwright 1.64’ün kullandığı [WebKit Windows derleme yapılandırması](https://github.com/WebKit/WebKit/blob/56453fdfe0b0ca6258c23e6453b34f70b885d13f/Source/cmake/OptionsWin.cmake#L75) ve sabitlenmiş çalışma zamanı yoklamasıyla doğrulanır.

Her iki yol da üretici işin geçerli çalıştırmadaki kesin çıktı kimliğini indirir. Yeni çıkarılmış dizin sunulmadan önce arşiv sağlama toplamları, kaynak commit’i, paketlenmiş bundle/provider özetleri, dosya türleri ve yollar denetlenir. Sürüm kontrolleri dondurulmuş derleme kaydını da doğrular. Tarayıcı işleri test edilen kodu yeniden derlemez; yalnızca üretim bağımlılıklarını kurar. Test sunucusu kaynaktaki tam provider envanterini hâlâ gerektirir; derleyici yalnızca gerçekten bundle oluşturulurken yüklenir, envanter sabitleri okunurken değil. Başarısız, atlanmış, eski veya eksik senaryo kanıtı ortak kapıyı başarısız kılar; her hedefin izleri, gerçek çalışma ortamı kimliği ve aday özeti saklanır.

Üretilen yedi envanter/kilit dosyası `venus-os-ci-toolkit/scripts/prepare_browser_compatibility.py` tarafından oluşturulur. Uygulama paketleri ile tarihsel tarayıcı paketlerinin kilit dosyaları ayrıdır. GitHub-hosted çalıştırıcılar varsayılan kalır; ortak iş akışı hazırlanmış Linux yedek seçimini korurken Windows/macOS hedefleri kendi yerel işletim sistemlerini gerektirir.

Ortak sürüm kararı, seçilen her hedefi ve kaynak SHA’sını, çalıştırmayı, denemeyi, kanalı ve kesin aday çıktı kimliğini doğrular. RC, beş hedefli beta kanıtını kullanamaz. Stable’a yükseltme kabul edilmiş RC baytlarını kullanır. Hata sonrası tüm yeterlilik iş akışını yeniden çalıştırın; eski denemelerin kayıtları yeni yeterliliği tamamlayamaz.

## Sonlandırma tanılama bilgileri

Çalışma zamanı ve adayın meta verileri yüklendikten sonra, kabul denetimi tamamlandığında
veya bir istisna fırlattığında `scripts/browser-acceptance.cjs`, `CI_BROWSER_DIAGNOSTICS`
dizinine `acceptance-terminal.json` dosyasını yazar. Kayıt; son aşamayı, kaynak ve aday
kimliğini, hedef tarayıcıyı, çalıştırmayı ve denemeyi, geçen süreyi ve test sürecinin
çıkış durumunu, sinyalini ya da izin verilenler listesindeki bir hata kodunu içerir.
Kayıt 2 KiB'den küçüktür; ham hatalar, URL'ler, stdout/stderr, ortam değerleri veya bellek
dökümleri içermez. Dosya, işe ait mevcut çıktı dizininde özel erişim ve `0600` modu ile
oluşturulur; mevcut bir dosyanın veya son dosya yolundaki sembolik bağlantının üzerine
yazılmaz.

Bu kayıt **başarılı kabul sonucu değil, tanılama kanıtıdır**. Her zaman
`acceptance: false` bildirir; ancak ayrı `CI_BROWSER_EVIDENCE` dosyası, mevcut tüm
doğrulamalar geçtikten sonra adayın yeterliliğini onaylayabilir. Tanılama kaydının
yazılamaması, ilk başarı veya başarısızlık sonucunun yerini alamaz. Sarmalayıcının aniden
sonlanması veya bu aşamadan önce meta veriler yüklenirken hata oluşması durumunda kayıt
bulunmayabilir. Test sürecine ait bir sinyal, Firefox'un içerik sürecinin aynı sinyali
aldığını kanıtlamaz. Yerel bir çökmenin kaynağını belirlemek için hâlâ eşleşen bir yerel
çağrı yığını veya hatanın kontrollü biçimde yeniden üretilmesi gerekir; başarılı bir
yeniden deneme incelemeyi kapatmaz.

Bu yardımcı program, ham Firefox çökme raporlarını veya `DEBUG=pw:browser` günlüklemesini
etkinleştirmez. Tarayıcı belleği ve konsol çıktısı hassas veriler içerebilir; ayrıca
incelenmiş bir toplama ve erişim politikası olmadan sıradan yüklenen yapılara kopyalanmamalıdır.
Senaryoların sırası, sabitlenmiş tarayıcı sürümleri, tek işçi, sıfır yeniden deneme ve
mevcut zaman aşımları değişmeden kalır.

<a id="from-source-to-accepted-candidate"></a>

## Kaynaktan kabul edilmiş adaya

![Kaynak, paket doğrulama, yetenek kontrolleri ve kanıt](diagrams/candidate-verification-flow.svg)

1. İncelenen kaynağı derleyin ve oluşan Mode A dosyalarını paketleyin. Arşiv sağlama toplamını ve kaynak kimliğini adayla birlikte saklayın.
2. Çıkarmadan önce sınırlı arşiv boyutunu, güvenli yolları, dosya türlerini, kaynak/sürümü ve tam girdi/provider özet envanterini doğrulayın. Sürüm yeterliliği ayrıca dondurulmuş derleme kaydını denetler.
3. Gerçek tarayıcı sürümünü ve medya yeteneklerini yoklayın. Tanımlı profili seçin; yetenek uyuşmazlığı kapsamı sessizce azaltmak yerine hata vermelidir.
4. Kesin senaryo kümesini çıkarılmış dosyalarda yeniden derlemeden çalıştırın. Her senaryoyu tam bir kez, atlama, hata veya yeniden deneme olmadan zorunlu tutun.
5. Çalışma ortamını, yetenekleri, aday özetini ve senaryo sonuçlarını saklayın. Ortak kapı kanıtı kabul etmeden önce zorunlu hedefleri ve eşleşen çalıştırma/deneme/kaynağı denetler. Sürüm koordinasyonu ve cihaz kabulü ayrı koşullar olarak kalır.

<a id="what-has-been-measured-locally"></a>

## Yerel olarak ölçülenler

![Yerel entegrasyon doğrulaması: ayrı cihaz ve paketlenmiş tarayıcı test kümeleri](diagrams/browser-verification-results.svg)

`c52f4d07` kaynağında tam Chromium cihaz-tarayıcı çalıştırması, beklenen bir yerel HLS atlamasıyla 196 testi geçti. Ayrı olarak aynı paketlenmiş Mode A arşivi Chromium 156.0.8078.4, Firefox 157.0 ve WebKit 27.2’nin her birinde beş senaryoyu geçti: 15 başarı, atlama veya yeniden deneme yok. Bunlar farklı kümelerdir; sayıları kapsam yüzdesi veya barındırılan 35 hedefin tamamının geçtiğinin kanıtı değildir.

[Saklanan kayıtlar](evidence/post779-local-acceptance/summary.json) gerçek macOS 26.7.1 ana makinesini tanımlar. Bunu `macos-15` profil etiketinden açıkça ayırır ve bir sürümü yeterli saymaz. Bu yerel kontrolü Mac’te tekrarlamak için kilitli bağımlılıkları ve Playwright 1.64.0 tarayıcılarını kurun, güncel kaynağı derleyin ve [saklanan tarifi](evidence/post779-local-acceptance/reproduce.sh) depo dizinini argüman olarak vererek çalıştırın. Mevcut derlemeyi paketler, adayı kontrol eder, her tarayıcıyı yoklar ve yeni kayıtları `.compatibility/` altında saklar. 4189 portunu gerektirir ve mevcut `browser-candidate-web` dizininin üzerine yazmayı reddeder. Derleme ile tarifi çalıştırma arasında kaynağı değiştirmeyin. Barındırılan CI ve fiziksel cihaz sonuçları [uygulama raporunda](implementation-report.tr.md) ayrı izlenir.
