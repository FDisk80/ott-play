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

Místní soubory bez internetu: viz [Místní videa a přehrávání offline](docs/offline-media.md).

[![Seznam kanálů OTT-play FOSS v perspektivě](docs/images/hero.png)](docs/images/studio-2026-default.png)

*Existující snímek rozhraní Studio 2026 se syntetickými údaji kanálů a pořadů.
Otevřením obrázku zobrazíte původní plochý pohled; nejde o záznam aktivního předplatného.
[Zdroj obrázku a opětovné vytvoření](docs/images/README.md).*

[Rychlý start v 88 jazycích](docs/readme/README.md) · [Dokumentační wiki](docs/wiki/Home.cs.md)

[![Osvědčené postupy OpenSSF](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![Fuzzing: pouze RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

Veřejní kandidáti na vydání spouštějí omezené, izolované fuzzovací kampaně pro nativní/serverové zpracování XMLTV a ověřování požadavků portálů. Viz [rozsah fuzzingu, reprodukce a doklady vydání](FUZZING.md).

Samostatný přehrávač IPTV/OTT s místním HTTP serverem v Rustu. Funguje na chytrých televizorech (LG WebOS, Samsung Tizen, Panasonic, Sony atd.), set-top boxech (Infomir MAG, Dune HD, Enigma2, Android TV) a v desktopových prohlížečích.

Začněte [průvodcem architekturou a přispíváním](docs/architecture.md), který popisuje běhové vrstvy, odpovědnosti, rozšiřování poskytovatelů a ověřování. [Relace přehrávání a životnost poskytovatelů](docs/playback-session-architecture.md) vysvětlují hranici mezi jádrem a hostitelem a smlouvy kompatibility.

<!-- ci-release-process:start -->
<a id="release-process"></a>

## Proces vydávání

Viz [strategie vydávání](RELEASING.md) pro pravidla ověřování a povyšování nightly, beta, RC a stable a [provozní příručka](docs/release-workflow.md) pro místní příkazy.
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## Spuštění v prohlížeči

Otevřete [živé demo](https://player.ottplay.here.now/) nebo sestavte a zpřístupněte webový přehrávač podle pokynů níže.

[Místní nasazení v macOS](docs/local-http-deployment.md) poskytuje HTTP originy přehrávače na portech 8443–8446. Port 8095 byl vyřazen.

Při prvním spuštění vyberte **Vyzkoušet demo** pro pohyblivý testovací obraz nebo nastavte vlastní seznam M3U či poskytovatele. Demo je později dostupné přes **Změnit poskytovatele → Demo**.

Režim demo vyžaduje internet, ale ne účet poskytovatele. Jeho tiché testovací kanály MP4 a HLS jsou hostované na here.now a sdílené webovým přehrávačem, Tauri, Capacitorem a OTT Serverem. Přepnutí zachovává nastavení dosavadních poskytovatelů. Pro samostatnou **kontrolu obrazu a zvuku** otevřete **Informace → Zvuk → Přehrát** ve spravovaném enginu HTML5 při nečinnosti nebo sledování živé televize. Používá zvukový testovací soubor `av-v1.mp4` z here.now a vyžaduje internet. Klip není v balíčcích přehrávače a nikdy se nestahuje při spuštění. VOD, archiv a vynucené enginy zařízení (včetně PC2/Video.js a nativních enginů) jsou vyloučené; viz [postup, očekávané tóny a diagram hostování](docs/audio-video-check.cs.md).

Nainstalovaná okna desktopového prohlížeče podporují **Window Controls Overlay**: Chrome může skrýt samostatný titulkový pruh a ponechat tlačítka okna a nabídku aplikace nad přehrávačem. Otevřete nainstalovanou aplikaci a zvolte **Skrýt titulkový pruh**, pokud to Chrome nabídne; **Zobrazit titulkový pruh** vrátí obvyklý rám. Běžné karty a televizní/nativní rozvržení zachovávají dosavadní chování. Viz [ovládání okna prohlížeče](docs/browser-window-controls.md) pro podporované instalační URL, aktualizaci existujícího zástupce a ověření.

Pro posun o deset sekund v hlavním pohledu videa použijte **Alt/Option + Vlevo/Vpravo** (v macOS funguje také **Command + Vlevo/Vpravo**), na celé obrazovce i v běžném pohledu. Místní videa, VOD a podporované archivy kanálů používají stejné ovládání na webu, v Tauri a Capacitoru. Viz [klávesové zkratky a omezení](docs/browser-window-controls.md#playback-keyboard-shortcuts).

V rozhraní PC klávesa **R** přehraje jiný náhodný kanál nebo video z aktuálního seznamu bez změny pořadí. Funguje v hlavním pohledu videa a seznamech kanálů/videí; textové editory, dialogy, nastavení a omezení kiosku mají přednost. Ostatní mapování kláves zařízení se nemění.

Syntetický testovací obraz lze vytvořit znovu pomocí `scripts/generate-demo-media.sh` (vyžaduje FFmpeg); vytvořená média zůstávají v ignorovaném adresáři `.local-artifacts`.

<a id="features"></a>

## Funkce

- **Přehrávání**: HLS, DASH a prosté HTTP streamy se spravovanými limity kvality HLS.js/Shaka, omezeným obnovováním a až třemi výslovnými záložními URL na živý kanál. Archiv/VOD nikdy nepřepne na živou zálohu; viz [kvalita a obnova](docs/playback-stream-policy.cs.md).
- **EPG**: párování XMLTV, časový posun/zpětné přehrávání, hledání názvů pořadů (N5 v EPG), připomínky a ruční vazba zdroje/ID pro konkrétní kanál v hostované/nativní cestě XMLTV. Viz [vazby a přístupnost](docs/guide-binding-accessibility.cs.md).
- **Oblíbené**: jedna seřazená [smíšená kolekce](docs/mixed-favorites.md) napříč nastavenými poskytovateli a profily na podporovaných zařízeních, s přenositelným exportem/importem přes CLI; rodičovský PIN. V záložním režimu zůstávají dostupné seznamy oblíbených pro jednotlivé zdroje.
- **Nastavení**: export/import JSON nastavení a oblíbených, deník vrácení pro podporované dávky localStorage, obnovení archivu se zohledněním zdroje a přesné porovnání uložených nastavení pro postupy kontroleru. Obnova předpokládá jediného zapisujícího; vlastní úložné adaptéry zachovávají vrácení změn podle možností. Viz [obnova nastavení](docs/settings-recovery.cs.md).
- **Sdílené rozhraní**: OTT Server, Tauri a Capacitor používají stejný motiv a nastavení viditelnosti seznamu kanálů. Nastavení [barev rozhraní](docs/interface-colors.md) nabízí devět barevných rolí, paletu, přesné zadávání hodnot HEX/RGB/HSV a pět barevných schémat a ukládá se pro daného klienta; nastavení seznamu určuje názvy kanálů, picony, aktuální pořady, průběh a značky archivu.
- **Poskytovatelé**: M3U/M3U8, živá televize Xtream a [katalogy filmů/seriálů na vyžádání](docs/xtream-media.cs.md), Stalker/Ministra s [filmy a vnořenými epizodami](docs/stalker-media.md), Plex a VPortal. Možnosti poskytovatele a přístup účtu určují dostupné funkce archivu a knihovny médií.
- **Push příkazy**: dálkové ovládání webhookem — změna kanálu, poskytovatele, seznamu a zobrazení zpráv
- **Vzdálené zadávání textu (swop)**: klávesnice telefonu přes Cloudflare Worker, když jsou TV a telefon v různých sítích (relace autorizované pro instalaci; ♥™ na virtuální klávesnici)
- **Směrování podle zařízení**: adresování UUID pro více zařízení
- **Místní proxy**: volitelný místní příkazový server pro zcela místní automatizaci (bez centrálního serveru)
- **Integrace kontroleru**: operátoři omezení na zařízení/akce, volitelné trvalé výsledky příkazů, obnovitelné použití předvoleb Local/Home a předání živého/archivního přehrávání stejného zdroje přes odpovídající [řídicí server](https://github.com/open-ott-play/ottplay-control-server). Vyžadují aktualizovaný kontroler/CLI; samostatná karta prohlížeče je neposkytuje.
- **Typované vzdálené předvolby**: Zjistěte dostupná nastavení, přečtěte uložené i účinné hodnoty a ukládejte s kontrolou běhové instance, zdroje a revize; viz [vzdálená nastavení a konfigurace VPortal](docs/remote-player-settings.md).
- **Ladění**: volitelný HUD přehrávání/kruhový log přes `?debug=1`, vzdálená inspekce se souhlasem a hostovaná kontrola zvuku/videa na vyžádání
- **Přístupnost klávesnice**: pojmenované klasické dialogy, zachycení a návrat fokusu Tab, sémantika vybraného kanálu a nevtíravá oznámení stavu. Tato vylepšení neprokazují plnou shodu s WCAG ani čtečkami obrazovky zařízení.
- **24 typů zařízení**: mapování dálkového ovladače podle zařízení
- **88 jazyků rozhraní**: odpovídající katalogy, [lokalizované rychlé návody](docs/readme/README.md) a [abecedy klávesnic ověřené podle CLDR](docs/localization.md). Hlavní příručka a spárované průvodce funkcemi jsou dostupné ve [24 jazycích dokumentace](docs/manual-translations.md); ostatní technické reference zachovávají své dosavadní jazyky.

[Průvodce dodáním](docs/roadmap-delivery.cs.md) popisuje funkce implementované v této revizi zdrojů, hranice platforem, diagramy a ověření. Nainstalovaná vydání nebo hostovaná nasazení mohou používat starší revizi. Samostatná nativní [aplikace Android](https://github.com/open-ott-play/ottplay-android) také uchovává volby zvuku/titulků podle jazyka, role a popisku místo indexů manifestu; její implementace a vydávání jsou oddělené od tohoto frontendu.

[Přehled zdrojů STB](docs/stb-player-improvements.md) vysvětluje vylepšení médií, využití prostředků a obnovy, porovnání zdrojů a současná omezení.

<a id="debug-hud"></a>

## Ladicí HUD

Místní HUD a trvalé ukládání logů serveru se zapínají samostatně. Před sběrem logů z jiných zařízení viz [diagnostický přístup, redakce a uchovávání](docs/diagnostic-security.md).

Ladění zapněte jedním z těchto způsobů:
- URL: `?debug=1` nebo `?debug=true`
- Místní úložiště: `localStorage.setItem("ottplay_debug", "1")`
- Vlastnost okna: `window.__OTT_DEBUG__ = true`
- Server: když `/debug/config` vrátí `{enabled: true}`

Při zapnutém ladění:
- Stiskněte **D** pro přepnutí pruhu HUD (`ottDebugSetHud` / `__ottDebug.toggleHud()`)
  - Přeskočí se při fokusu v INPUT/TEXTAREA/listEdit
  - Používá `e.key`, aby nevznikl konflikt MAG/Maple PLAY/PREV=68
- Nabídka Informace → **Ladicí HUD** → volá `__ottDebug.toggleHud()`
- Správa nastavení → **Ladicí HUD**:
  - Pokud je ladění již načtené: přepne viditelnost HUD
  - Jinak: nastaví `ottplay_debug=1` + `ottplay_debug_hud=1` a vyzve k restartu
- Trvalost: `ottDebugSetHud` ukládá stav HUD do `localStorage.ottplay_debug_hud` ("1"/"0")

<a id="capacitor-ios-and-android"></a>

## Capacitor pro iOS a Android

Toto úložiště balí sdílený frontend TypeScript pomocí Capacitoru pro iOS a Android 7+. Oba používají systémová písma a nativní runtime uzamčený v npm. Samostatný kompatibilní APK API 22 podporuje Android 5.1/6 s WebView 60 nebo novějším. Oba Android APK jsou podepsané a součástí kvalifikovaných beta, RC a stabilních vydání společně s nepodepsaným iOS IPA. Samostatná Kotlin aplikace zůstává v [ottplay-android](https://github.com/open-ott-play/ottplay-android).

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

Viz [konfigurace Capacitoru](docs/capacitor-mobile.md) a [distribuce Androidu a vzdálené aktualizace](docs/android-distributions.md).

Rozhraní iOS používá orientaci na šířku. Nastavení, konfigurace poskytovatele, souhlas s dálkovým ovládáním a import/export JSON nadále používají sdílený frontend. Multitasking tabletu může požadovanou orientaci změnit.

Na iPhonu přejíždějte svisle po seznamu kanálů pro posun po řádcích a stránkách; nahoru na pozdější kanály, dolů na dřívější. Rychlé švihnutí pokračuje přes více stránek a zpomaluje do zastavení; pomalé tažení zůstává přesné. Pohyb zastavte dotykem obrazovky nebo navigační klávesou. Jediné klepnutí spustí kanál pod prstem, i když je vybraný jiný řádek. Přejetí při zvednutí prstu nikdy neotevře kanál.

Video na iPhonu hraje přímo v rozhraní. Klepněte dolů pro informace o pořadu nebo otevřete nabídku, zatímco přehrávání pokračuje. Obraz v obraze zůstává samostatnou možností přehrávání.

Základní test zařízení: [kontrolní seznam režimu B](docs/mode-b-device-smoke.md) a `./scripts/smoke-capacitor-device.sh --help` (sestavení/synchronizace jen pro iOS). Základní test Tauri desktopu: [desktopový seznam](docs/mode-b-tauri-smoke.md).

<a id="installation"></a>

## Instalace

| Platforma | Balíček | Poznámky |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Samostatná sestavení Apple Silicon a Intel; podpis ad-hoc, pokud není nastavený podpis Apple |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | Různé distribuce |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode nebo Homebrew Channel](docs/lg-webos-installation.md); hostovaný přehrávač, vyžaduje síť |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode a místní podpis; nepodepsaný balíček pro TV, oddělený od Family Hub](docs/samsung-tizen-installation.md) |
| **iOS** | `.ipa` přes AltStore / TestFlight / Xcode | Pouze boční instalace — zatím není v App Store |
| **Android (sdílený frontend)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | Podepsané balíčky Capacitor; zvolte podporovanou verzi Androidu |
| **Android (nativní Kotlin)** | Samostatná [nativní aplikace](https://github.com/open-ott-play/ottplay-android) | Veřejné úložiště; oddělená aplikace a proces vydávání |

Podporované instalátory jsou přiložené ke kvalifikovaným vydáním GitHub: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **Poznámka:** balíčky macOS používají podpis ad-hoc, pokud chybí přihlašovací údaje pro podpis Apple; to neposkytuje Developer ID ani notarizaci. Instalátory Windows/Linux a balíčky vydání iOS mohou být nepodepsané. iOS vyžaduje podpis před instalací na fyzické zařízení. Kvalifikované vydané APK Android Full a API 22 používají zavedený podpisový certifikát; místní release sestavení potřebují nastavený keystore pro vytvoření podepsaných APK.

---

<a id="macos"></a>

### macOS

1. Zvolte požadovaný tag z [vydání](https://github.com/open-ott-play/ottplay-foss/releases). Odkaz na nejnovější vydání vybere stable, nikoli beta nebo RC.
2. Stáhněte `OttPlay.FOSS_*_aarch64-apple-darwin.dmg` pro Apple Silicon nebo `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` pro Intel. Jde o samostatná sestavení architektur.
3. Otevřete `.dmg` a přetáhněte **OttPlay FOSS.app** do Aplikací.
4. Před prvním spuštěním ověřte zkopírovaný balíček:

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

Úspěšná kontrola ověřuje integritu balíčku. `Signature=adhoc` znamená, že aplikace nemá identitu vývojáře ověřenou Applem; nedokládá notarizaci ani schválení Gatekeeperem. I při důvěryhodném stažení a platném balíčku může macOS po prvním pokusu vyžadovat **Nastavení systému → Soukromí a zabezpečení → Přesto otevřít**; viz [pokyny Apple](https://support.apple.com/en-us/102445).

Zpráva „aplikace je poškozená“ sama neprokazuje, že příčinou je pouze karanténa. Pokud ověření podpisu selže, uchovejte chybu a získejte opravené vydání. Staženou aplikaci znovu nepodepisujte ani neodstraňujte její atributy, aby neúspěšná kontrola vypadala úspěšně.

Alternativy ZIP jsou `OttPlay.FOSS_aarch64-apple-darwin.app.zip` a `OttPlay.FOSS_x86_64-apple-darwin.app.zip`. Pro rozbalení, obrazy disků a kontroly Gatekeeper viz [podpis macOS a ověření artefaktů](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact). Pro sestavení checkoutu a místní instalaci použijte [místní dodání macOS](docs/macos-local-delivery.md).

---

<a id="windows"></a>

### Windows

1. Stáhněte `.msi` nebo `.exe` z [vydání](https://github.com/open-ott-play/ottplay-foss/releases/latest)
2. Spusťte instalátor a postupujte podle pokynů
3. Spusťte aplikaci z nabídky Start nebo zástupce na ploše

---

<a id="linux"></a>

### Linux

Přehrávání v Linuxu potřebuje kromě WebKitGTK pluginy GStreamer HLS, H.264 a AAC. Balíčky tyto mediální závislosti deklarují; sestavení AppImage obsahují mediální framework. Viz [balení médií pro Linux](docs/linux-media-packaging.md) pro kontroly kodeků a rozdíl mezi přijetím v prohlížeči a nativně.

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

### Instalace iOS

iOS vyžaduje podpis před instalací na fyzické zařízení. Pro nepodepsaný IPA vydání použijte AltStore Classic nebo sestavte a podepište zdroje v Xcode. TestFlight vyžaduje samostatnou pozvánku, pokud je nabízen.

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### Možnost 1: AltStore Classic (doporučeno pro osobní použití)

AltServer běží na počítači; AltStore Classic běží na iPhonu/iPadu a importuje IPA. Stačí bezplatný účet Apple.

**Předpoklady:**

- iPhone/iPad s **iOS/iPadOS 15 nebo novějším** pro současné sestavení OTT-play.
- Mac nebo PC Windows s AltServerem a datovým USB kabelem.
- Účet Apple pro podpis a internet pro stažení vydání.

**Krok 1: jednorázově nastavte AltStore**

1. Nainstalujte AltServer podle oficiálního [návodu pro macOS](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) nebo [návodu pro Windows](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows). Spusťte jej a používejte ikonu v řádku nabídek/oznamovací oblasti.
2. Připojte zařízení přes USB, odemkněte je a potvrďte důvěru počítače/zařízení. Na Macu ověřte, že se zobrazuje ve Finderu.
3. V **nabídce AltServer → Install AltStore** zvolte zařízení a dokončete výzvy podpisového účtu. Počkejte na oznámení o instalaci.
4. Na zařízení otevřete **Nastavení → Obecné → VPN a správa zařízení** a podle potřeby důvěřujte položce vývojáře podpisového účtu. V iOS 16+ zapněte **Nastavení → Soukromí a zabezpečení → Vývojářský režim** a dokončete restart a potvrzení zařízení.
5. Otevřete AltStore na zařízení. Pokud již funguje, přeskočte toto nastavení a nechte AltServer běžet pro následující import.

**Krok 2: importujte vybrané vydání na iPhonu/iPadu**

1. Vyberte přesný tag ze [všech vydání](https://github.com/open-ott-play/ottplay-foss/releases) a stáhněte jeho `ottplay-foss-ios-unsigned.ipa` v Safari na zařízení. [Odkaz na nejnovější vydání](https://github.com/open-ott-play/ottplay-foss/releases/latest) vybere stable; pro instalaci bety použijte úplný seznam.
2. Uložte IPA do Souborů. V **AltStore → My Apps → +** zvolte tento soubor. Stažený IPA lze také přenést z Maca přes AirDrop a před importem uložit do Souborů. Otevření IPA na Macu není tento importní krok.
3. Nechte AltServer spuštěný a USB kabel připojený během podpisu a instalace aplikace. Při aktualizaci použijte stejný podpisový účet jako u dosavadní instalace; neodstraňujte aplikaci jako první pokus o nápravu.
4. Počkejte na dokončení importu, zkontrolujte OTT-play v **My Apps** a spusťte jej.

**Alternativa: přímo importujte URL vydání**

Pokud je AltStore nainstalovaný, zadejte tento vzor v **Safari na iPhonu**, nahraďte `TAG` přesným tagem vydání a potvrďte **Otevřít v AltStore**:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

Používá [obsluhu instalačních URL AltStore](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift). Vyhýbá se nejasným položkám Soubory/Poslední, když mají stažené soubory stejný název. URL musí mířit na soubor IPA, nikoli stránku vydání.

Například následující import byl ověřen **2026-09-29** s AltStore 2.3 a AltServer 1.8.1. Jde o pevný historický příklad, nikoli odkaz na nejnovější verzi:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**Obnovení:** instalace bezplatného účtu vyprší po sedmi dnech. Udržujte AltServer dostupný a před vypršením použijte **AltStore → My Apps → Refresh All**. Obnovení na pozadí také potřebuje přístup k AltServeru; viz [pokyny k obnovování AltStore](https://faq.altstore.io/altstore-classic/your-altstore).

<a id="verify-the-installed-version-before-retrying"></a>

#### Před dalším pokusem ověřte nainstalovanou verzi

Zpráva AirDrop „Odesláno“ potvrzuje jen přenos. Průběhový pruh AltStore potvrzuje začátek importu. Ztracené připojení Zrcadlení/USB neprokazuje neúspěšnou instalaci: před opětovným odesláním IPA ověřte nainstalovanou aplikaci.

Na Macu s Xcode nainstalovaným a vybraným jako aktivní vývojářský adresář prohlédněte zařízení bez reinstalace:

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

V `result.apps` JSONu najděte OTT-play (`bundleIdentifier` začíná `play.ott.foss`) a porovnejte `version` i `bundleVersion` s `CFBundleShortVersionString` a `CFBundleVersion` vybraného IPA. Přípona podpisového účtu AltStore u identifikátoru balíčku je očekávaná. Zprávu zařízení uchovejte místně.

Ověřený příklad beta.9 uvádí **verzi `1.1.51`, sestavení `2.2.66`**. Potvrzuje to instalaci; otevření aplikace, přihlášení Cloudflare, načtení seznamu, přehrávání a PiP jsou samostatné kontroly zařízení.

<a id="troubleshooting-ios-installation"></a>

#### Řešení problémů s instalací iOS

- **AltServer nemá okno nebo automatizované otevření vyprší:** použijte ikonu v řádku nabídek/oznamovací oblasti. Jde o aplikaci na pozadí. Opakované pokusy otevřít běžné okno neimportují IPA.
- **„Could not find AltServer“ nebo nedostupné USB zařízení:** ověřte běh AltServeru, odemkněte telefon a zkontrolujte výzvy k důvěře. Na Macu ověřte viditelnost ve Finderu. Pokud spojení vypadlo, bezpečně je obnovte a před opakováním ověřte nainstalovanou verzi. Při trvání potíží použijte [řešení problémů s připojením AltStore](https://faq.altstore.io/altstore-classic/troubleshooting-guide). Pokud telefon poskytuje počítači internet, koordinujte změny kabelu nebo sítě, aby nebyla přerušena jiná práce.
- **Zrcadlení iPhonu hlásí „iPhone in Use“ nebo zůstává u „Connecting“:** dokončete nastavení na fyzickém telefonu nebo zamkněte jeho obrazovku a nechte ho poblíž odemčeného Maca pro zrcadlení. Odemknutí telefonu zrcadlení ukončuje; USB důvěra/nastavení mohou nejprve vyžadovat odemknutí. Pokud jedno obnovení spojení nepomůže, ukončete Zrcadlení a pokračujte na telefonu. Viz [požadavky Apple na Zrcadlení](https://support.apple.com/en-us/120421). Zrcadlení je pro instalaci nepovinné.
- **URL při Zrcadlení ztrácí latinská písmena nebo přechází do azbuky:** přepněte **vstupní zdroj Maca na ABC/angličtinu**. Se zaměřeným Zrcadlením stiskněte **Control–Mezerník** a vyberte **English (US)** pro hardwarovou klávesnici iPhonu. Vstupní zdroje se mohou lišit; změna jen na Macu v ověřené relaci nestačila. Vymažte pole, zadejte URL znovu a před odesláním jej zkontrolujte.
- **Vložení ze schránky do Zrcadlení zamrzne nebo vloží neočekávaný text:** vymažte pole a pište pomalu po krátkých úsecích se vstupem English (US) iPhonu nebo zadejte URL přímo na telefonu. Rychlý vstup může znaky vynechat či zdvojit; před uložením ověřte celý řetězec. Neodesílejte částečně vložené URL. Vložení v naší instalační relaci selhalo; není podmínkou přímé metody URL.
- **Soubory/Poslední ukazují více stejných názvů IPA:** vyberte přesné místo stažení nebo použijte přímé URL s tagem výše. Místní kopii lze pro přehlednost přejmenovat podle tagu/sestavení; název nemění obsah.
- **Nainstalovaná aplikace se neotevře:** proveďte pokyny k důvěře vývojáře nebo Vývojářskému režimu v telefonu. Ověřte vypršení v AltStore a případně obnovte. Pokud stále nefunguje, zaznamenejte skutečnou chybu; samotná chyba připojení není důvod k odstranění a reinstalaci.
- **OTT-play se otevře, ale chráněný seznam selže přes mobilní síť:** instalace a ověření zdroje jsou oddělené. Přihlaste se ke nakonfigurovanému zdroji přes **Nastavení → Správa nastavení → Přístup ke zdroji** a načtěte seznam znovu. Biometrii/passkey nebo e-mailový kód podle potřeby dokončete na fyzickém zařízení. Zdroj musí podporovat [integraci iOS Access](docs/ios-source-access.md); instalace neobchází seznam povolených IP.
- **Passkey je vyžadován na důvěryhodné Wi-Fi:** u zdrojů s iOS Access aplikace nejprve zkouší původní zdroj bez přihlášení a ověřený mobilní vstup použije až po odmítnutí. Zkontrolujte veřejnou IP skutečně viděnou zdrojem, včetně IPv6: povolená domácí IPv4 nezahrnuje jiné IPv6, VPN ani mobilní adresu. Změny sítě a opětovné otevření mažou dočasnou preferenci trasy. Obecná chyba sítě/serveru by neměla vyvolat přihlášení.
- **Přihlášení se již nezobrazuje, ale seznam kanálů je prázdný:** platná uložená relace se použije bez další výzvy. Po dřívějším selhání načtení nebo opravě serveru načtěte seznam znovu nebo aplikaci jednou úplně zavřete a otevřete. Při přetrvání ověřte, že zdroj vrací seznam místo přihlašovacího HTML nebo chyby JSON. Zaznamenejte zobrazenou chybu a stav HTTP; nesdílejte URL zdrojů s přihlašovacími údaji, cookies nebo tokeny Access.
- **Kanály se načtou, ale video načítá nebo hlásí `SRC_NOT_FOUND`:** načtení seznamu a přehrávání jsou oddělené kontroly. Po přihlášení zkuste kanál ještě jednou; při přetrvání ověřte odpovědi manifestu HLS a segmentů a podporu kodeků streamu. Samotná chyba nedokládá, že pomůže změna enginu nebo reinstalace.

<a id="option-2-testflight-if-available"></a>

#### Možnost 2: TestFlight (pokud je dostupný)

Pokud je zveřejněna pozvánka TestFlight, nainstalujte TestFlight z App Store, otevřete pozvánku na zařízení a klepněte na **Instalovat**. Stažení IPA z GitHubu neposkytuje pozvánku TestFlight.

<a id="option-3-xcode-for-developers"></a>

#### Možnost 3: Xcode (pro vývojáře)

Postupujte podle [Sestavení a otevření](docs/capacitor-mobile.md#build-and-open), vyberte cíl **App** v Xcode, nastavte vývojářský tým v **Signing & Capabilities**, zvolte připojené zařízení a sestavte/spusťte. Podle potřeby potvrďte důvěru a Vývojářský režim. Import nepodepsaného IPA vydání do okna Devices v Xcode nedodá chybějící podpisovou identitu ani provisioning profil.

---

<a id="android-application"></a>

### Aplikace Android

Pro sdílené rozhraní vyberte Full Capacitor APK z vydání tohoto úložiště. Na Androidu 5.1–6 použijte kompatibilní API 22 APK; vyžaduje WebView 60 nebo novější. Při aktualizaci zachovejte identitu aplikace a podpisový certifikát, aby byly dosavadní profily dostupné. Viz [pokyny k sestavení](android/README.md) a [distribuce, podpis a vzdálená instalace](docs/android-distributions.md).

Samostatné [úložiště ottplay-android](https://github.com/open-ott-play/ottplay-android) obsahuje nativní aplikaci Kotlin/Compose. Má vlastní identitu, předvolby a proces vydávání a nenahrazuje přímo instalaci Capacitoru. Soubory historických vydání zůstávají dostupné.

---

<a id="quick-start"></a>

## Rychlý start

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

Pro základní testy prohlížeče použijte vlastní nasazení stejné revize.

Použijte Node 22 a stabilní toolchain Rust. Server spouštějte z kořene úložiště, aby byly dostupné statické soubory. Nativní sestavení vyžadují platformové nástroje popsané níže; pro samotný server nejsou nutné.

Při prvním načtení vyberte **Vyzkoušet demo** nebo otevřete **Nastavení → Změnit poskytovatele → Seznamy M3U / M3U8**. Otevřete **Vybrat seznam**, zvolte pozici, zadejte **URL seznamu**, uložte změnu a zvolte **Načíst seznam**. Seznam nebo účet poskytovatele dodáváte vy; aplikace neposkytuje předplatné placených kanálů.

<a id="mode-a-companion-smoke"></a>

## Základní test companionu režimu A

Test přes curl pro companion režimu A (shoda `ottplay-server` / `archive/server.py`): index, statické adresáře, `/logo`, `/version`, volitelné `/epg` a zkouška `POST /m3u/cp.php` bez stahování.

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

Kontroly jsou v `scripts/modea-smoke-checks.json`. Bez tajných údajů. Frontu příkazů / `local_proxy.py` (:8081) samostatně pokrývá `scripts/smoke-command-queue.sh` (pokud existuje).

<a id="classic-stalker--ministra-portals"></a>

## Klasické portály Stalker / Ministra

Zvolte **Portály Stalker** a zadejte MAC poskytnutou poskytovatelem a úplné URL portálu, například `http://provider.example/stalker_portal/c/`. URL `/c/index.html`, `/stalker_portal`, `/server/load.php`, `/load.php` a `/portal.php` vybírají klasický protokol MAG. Dosavadní konfigurace pouze serveru zachovávají JSON-RPC. Poskytovatel načítá profil, žánry a stránkované živé kanály sdíleným jádrem Stalker a potom na pozadí vyhledává filmy a vnořené epizody klasického protokolu `type=vod`. Cesty složek se stávají kategoriemi v běžném seznamu kanálů; dostupné popisy, plakáty a globální oblíbené se stabilními odkazy používají stejné mediální rozhraní. Viz [chování a limity katalogu](docs/stalker-media.md).

Požadavky prohlížeče na vlastní instalaci procházejí endpointem `/stalker/api` companionu; nativní aplikace používají dosavadní transport HTTP. Hostované prohlížeče vyžadují výslovně nastavené trasy přes [vyhrazený relay](docs/stalker-relay.md). Soubory prohlížeče a serveru se musí aktualizovat společně.

Živé přehrávání při otevírání streamu vyhodnotí dočasné příkazy kanálů; změny kanálu, zastavení, PiP a změna poskytovatele ruší zastaralé vyhodnocování. Výslovné trvalé příkazy HTTP(S) hrají přímo. Krátké EPG je podporované. Archiv klasického portálu a samostatný protokol `type=series` tento poskytovatel nezpřístupňuje. Dosavadní chování archivu/průvodce JSON-RPC se nemění. Soukromé LAN portály na trase companionu vyžadují přesný záznam `OTTPLAY_PROXY_LAN_ORIGINS`, stejně jako ostatní proxy trasy companionu.

Veřejné demo Infomir je `http://middleware-stalker.com/stalker_portal/c/`. Dne 2026-09-26 vrátilo tři živé položky katalogu, ale mediální endpointy byly nedostupné; pro regresi přehrávání použijte řízená testovací data portálu/médií.

<a id="m3u-stream-proxy-header-smoke"></a>

## Test hlaviček M3U stream proxy

Porovnává hlavičky odchozích požadavků, které `POST /m3u/cp.php` companionu režimu A doplňuje při stahování řízeného echo URL (standardně místní mock — bez poskytovatelů IPTV a tajných údajů).

Smlouva (z `src-rs/core/src/m3u.rs` + `archive/server.py`):
- Vkládá pouze **User-Agent** (standardně `OTT-play-FOSS/1.0` nebo předvolby `webos` / `tizen` / `viera` / `mag` / `dune`).
- **Nevkládá Referer** (`M3UProxy` Capacitoru ano; režim A ne).
- Odstraňuje počáteční `@` z `url` (formulář poskytovatele jQuery).

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

Návratový kód: `0` úspěch, `1` nenaslouchá, `2` neshoda hlaviček/HTTP, `3` použití/závislosti. Doplňuje `smoke-modea-companion.sh` / `smoke-command-queue.sh`.

<a id="logo-concurrent-bench-smoke"></a>

## Souběžný zátěžový test log

Test latence souběžných `GET /logo/<id>.svg` (volitelně `?ch=`) proti companionu režimu A. Hlásí počty úspěchů/chyb a p50/p95/p99. Výchozí je praktická místní zátěž CI (`CONCURRENCY=200`, `TOTAL=1000`); úplný dlouhý test 10 tisíc je volitelný (`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`).

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

Návratový kód: `0` úspěch, `1` nenaslouchá / spojení selhalo, `2` vysoká chybovost, `3` použití. Doplňuje `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`.

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## Test obnovy a zahřátí cache XMLTV

Poctivě ověřuje chování cache XMLTV/EPG companionu režimu A proti `src-rs` (bez vymyšlených API):

- `EPG_CACHE` v paměti zpřístupněná přes `GET /epg/:hash` → vždy `{"epg_data":[...]}` (HTTP 200).
- Start procesu stahuje `EPG_URLS` na pozadí bez zdržení HTTP; po každém dokončeném stažení následuje čekání **2h** před další obnovou.
- Volitelné trvalé uložení SQLite při nastaveném `DATABASE_URL` (bez veřejného endpointu stavu cache).
- `GET /health` → `OK` potvrzuje připravenost HTTP po volitelném restartu. S `--strict-epg` a `--epg-hash` test také čeká na neprázdné EPG daného kanálu v témže limitu `--warmup-timeout`.

Výchozí cesta jen volá curl — **neukončuje procesy**. Pro automatické ukončení+restart předejte `--restart-cmd` / `RESTART_CMD` nebo postupujte ručně podle kroků `launchctl` v `--help`.

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

Návratový kód: `0` úspěch, `1` nenaslouchá, `2` selhání tvrzení/zahřátí, `3` použití. Doplňuje `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`.

<a id="mode-a-e2e-play-path-smoke"></a>

## E2E test přehrávací cesty režimu A

Test **přehrávací cesty/připravenosti streamu** na straně companionu (pouze HTTP — **nikoli** E2E s viditelným UI). Pro běžící companion režimu A kontroluje:

- Dostupnost health nebo indexu
- Statické soubory shellu přehrávače (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`)
- Volitelné `GET /epg/<hash>.json`, pokud je nastaveno `EPG_HASH`
- `POST /m3u/match-channels` s JSON testovacími daty bez tajných údajů (prázdný seznam + jeden syntetický kanál)
- **Přehrání** přes stream proxy: `POST /m3u/cp.php` na řízená testovací média (standardně místní HLS seznam nebo `MEDIA_URL`) a ověření HTTP 200 + neprázdného těla / očekávaného `Content-Type` (první bajty přes proxy)

Bez soukromých přihlašovacích údajů IPTV. Doplňuje `smoke-modea-companion.sh` (přítomnost), `smoke-m3u-stream-proxy-headers.sh` (UA/Referer), `smoke-xmltv-cache-refresh.sh`.

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

Návratový kód: `0` úspěch, `1` nenaslouchá, `2` selhání tvrzení, `3` použití/závislosti.

<a id="capacitor-device-smoke-mode-b"></a>

## Test zařízení Capacitor (režim B)

**Kontrolní seznam** simulátoru/emulátoru (volitelně skutečného zařízení) pro Cap režimu B — nikoli HTTP companionu režimu A. Člověk označuje přijetí UI; pomocník automatizuje toolchain, nativní adresáře a mírnou curl kontrolu fronty příkazů.

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

Podrobnosti: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md). Doplňuje `smoke-command-queue.sh` (Cap loopback) — nezaměňujte s výše uvedenými testy režimu A.

<a id="tauri-desktop-smoke-mode-b"></a>

## Desktopový test Tauri (režim B)

Desktopový seznam a pomocník pro Tauri režimu B (okno/přehrání kanálu/PiP). Nejde o HTTP companionu režimu A ani test zařízení Cap.

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

Podrobnosti: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md). Údaje vývojáře Apple jsou pro místní test nepovinné; pro zabalenou aplikaci Mac použijte [podpis ad-hoc](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials). Ruční přijetí nadále zahrnuje spuštění, přehrávání a PiP.

<a id="docker"></a>

## Docker

Vícearchitekturní obrazy (amd64/arm64) se sestavují jako kandidátské archivy OCI. Publikace do registru povýší schválený stabilní archiv do Docker Hub bez nového sestavení; viz [provozní příručka](docs/release-workflow.md).

Binární server se sestavuje na **musl** (Alpine) a dodává na Alpine — **nevyžaduje** GLIBC_2.38+. Proto `alvit/ottplay-foss` funguje na Synology DSM Docker (x86_64) a dalších hostitelích se starším glibc.

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

Stabilní tagy registru používají `X.Y.Z`. Aktualizace `latest` je samostatná výslovná volba po publikaci verzovaného obrazu; push do main a Git tagy obrazy nepublikují.

<a id="build-from-source"></a>

## Sestavení ze zdrojů

Doménová pravidla přehrávače pocházejí z připnutého multiplatformního artefaktu Kotlin v `vendor/ottplay-core.js`. Rozhodování o průvodci, archivu, seznamu, poskytovateli, trvalém stavu a přehrávání sdílí implementaci s FOSS2 a nativním Androidem. Adaptéry prohlížeče/TV, Swiftu a Rustu si ponechávají API zařízení, kodeky, síť a efekty UI. Artefakt prohlížeče zachovává syntaxi ES5 a inicializaci podporovaných starších API. `npm test`, `check:bundle` a `check:es5` ověřují integraci; manifest artefaktu zaznamenává hashe zdroje a výstupu.

Validátory protokolů control-server a SWOP se generují z verzovaného schématu `contracts/ottplay-wire-v1.json`. Kontrolovaná potvrzení generátoru a neměnná testovací data kompatibility zabraňují kopiím zásad pro jednotlivé konzumenty.

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

## Detekce zařízení

Přehrávač podporuje 24 typů zařízení. Detekce: nejprve URL `/f/{device_id}/`, potom User-Agent.

| ID zařízení | Zařízení |
|---|---|
| `pc` | Prohlížeč PC |
| `pc2` | Webový přehrávač videojs |
| `nodejs` | Aplikace Windows (Electron) |
| `lg/webos` | Televizory LG WebOS |
| `samsung/tizen` | Televizory Samsung Tizen |
| `samsung/maple` | Televizory Samsung Orsay |
| `mag` | Boxy Infomir MAG |
| `dune` | Boxy Dune HD |
| `android` | Android TV / tablety |
| `hbbtv` | Televizory HbbTV |
| `panasonic` | Televizory Panasonic Viera |
| `philips` | Televizory Philips |
| `sony` | Televizory Sony |
| `sharp` | Televizory Sharp |
| `toshiba` | Televizory Toshiba |
| `hisense` | Televizory Hisense |
| `skyworth` | Televizory Skyworth |
| `tcl` | Televizory TCL |
| `vewd` | Zařízení Vewd |
| `spark` | Přijímače Spark |

<a id="push-command-system"></a>

## Systém push příkazů

Pro samostatnou službu s více zařízeními použijte [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) a část **Příkazový server** v **Nastavení → Dálkové ovládání**. Zadejte IP/adresu a přístupový kód tohoto přehrávače; uložení obou automaticky spustí dotazování na hlasitost, kanál a další příkazy. IP bez portu používá HTTP port 8081. Pro zastavení smažte adresu nebo zvolte **Odpojit**. Toto odchozí spojení podporuje potvrzené doručení a nepotřebuje místní naslouchání. Viz [připojení a kompatibilita](docs/remote-command-server.md). Následující příklady popisují dosavadní režim místního proxy/naslouchání.

Funkce **Najít příkazový server** dokáže vyhledat řadič a požádat o schválení operátorem bez kopírování tokenu zařízení. Tauri nejprve zkouší nativní DNS a při prázdném výsledku může přejít na výslovně nastavený profil nasazení; přehrávače v prohlížeči, LG a Capacitor používají cestu přes profil prohlížeče. Metadata vyhledávání Home lze hostovat na here.now nezávisle na řadiči. Obecná sestavení profil Home automaticky neobsahují a aktualizace nenahrazuje uložená připojení. Viz [chování platforem, nastavení profilu a řešení problémů](docs/remote-command-server.md#discovery-and-one-time-approval).

Místní dálkové ovládání HTTP je **standardně vypnuté** v prohlížeči/přehrávači OTT serveru, Tauri a Capacitoru. Zapněte jej přes **Nastavení přehrávače → Dálkové ovládání**, čímž vytvoříte tajný kód zařízení. Příkazy jsou objekty JSON s polem `"command"`; HTTP požadavky vyžadují `Authorization: Bearer <device-code>`.

<a id="architecture"></a>

### Architektura

<a id="local-command-url-recommended"></a>

#### Místní URL příkazů (doporučeno)

Zapněte **Místní dálkové ovládání HTTP** v **Nastavení přehrávače → Dálkové ovládání**, zkopírujte vytvořený **Kód zařízení** a nastavte jím proxy níže. **Místní URL příkazů** nastavte na endpoint příkazů proxy. Během zapnutí se přehrávač dotazuje každých 10 sekund s kódem v hlavičce Authorization. Samotné zadání URL ovládání nezapne.

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### UUID zařízení

Dosavadní UUID zařízení (např. `dev_a1b2c3d4e5`) je veřejné směrovací metadata, nikoli autorizační údaj. Samostatný **Kód zařízení** se bezpečně vytváří při zapnutí místního HTTP a zůstává na zařízení; nekopíruje se cloudovým nastavením. Vypnutí místního HTTP zastaví dotazování/naslouchání. Opětovné zapnutí vytvoří nový kód: aktualizujte proxy a integrace, abyste zneplatnili starý přístup.

Tauri a Capacitor spustí loopback HTTP naslouchání až po tomto souhlasu v nastavení. Přeposílací proxy musí posílat zobrazený kód jako Bearer token tomuto naslouchání. Režim A používá samostatně nastavenou frontu `local_proxy.py` níže.

<a id="remote-text-entry-swop"></a>

#### Vzdálené zadávání textu (swop)

Účel: psaní na telefonu pro ♥™ / vzdálenou virtuální klávesnici, když jsou TV a telefon v **různých sítích**, přes předání relace Cloudflare Worker.

- Úložiště Workeru: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop)
- **Autorizace instalace:** přehrávač posílá požadavky do relay `/swop` stejného originu svého serveru. Server přidá svůj soukromý instalační token; vzdálené psaní může použít každý klient registrovaného originu. UUID zařízení identifikují relace a nevyžadují seznam povolení pro každé zařízení.
- Nastavení: `swopBaseUrl` (prázdné = ♥™ zobrazí „nenastaveno“ / nic neprovede). Upravte v **Nastavení → Dálkové ovládání** (klávesa **2**) nebo vložte přes Gitem ignorovaný `/local/swop.json` u instalací operátora
- `POST /session` obsahuje `clientId`, `caption` a `draft`; `POST /val` obsahuje `clientId`, `code` a vrácený `sessionToken`. URL telefonu obsahuje samostatný token zápisu. Čtecí tokeny relace zůstávají v paměti prohlížeče.
- **Místní instalace:** nastavte `SWOP_BASE_URL` a `SWOP_INSTALLATION_TOKEN` po registraci instalace a jejích přesných LAN/localhost originů ve Workeru. `scripts/install-ottplay-local-service.sh` je uchová v soukromém launchd plist s režimem 0600. Veřejný `/local/swop.json` obsahuje jen `{"swopBaseUrl":"/swop"}`. Nikdy nevkládejte instalační token do veřejných souborů.
- **Statický hosting:** nastavte autentizované serverové proxy pro stejné dva endpointy. Uchovejte instalační token v tajných údajích hostingové služby. Kopírování veřejných souborů přehrávače nekopíruje tento serverový údaj.

> Centrální OTT server udržuje `/api/webhook/commands`, `/webhook/poll`, `/webhook/notify` a aliasy zdraví příkazů vypnuté pro každou metodu HTTP. Pro režim A použijte samostatný příkazový server nebo výslovně nastavené autentizované `local_proxy.py`; centrální server nemá rozesílací frontu příkazů.

<a id="available-commands"></a>

### Dostupné příkazy

Všechny příklady níže používají `http://192.168.1.50:8081/api/webhook/commands` jako URL místního proxy. Nahraďte jej skutečnou adresou a nastavte `OTTPLAY_QUEUE_HTTP_TOKEN` na **Kód zařízení** zobrazený po zapnutí HTTP v nastavení. Proxy musí používat stejný kód.

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — Zobrazit oznámení

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| Pole | Typ | Výchozí | Popis |
|---|---|---|---|
| `message` | string | povinné | Zobrazovaný text |
| `popup_duration` | number | 5 | Sekundy zobrazení (pravý horní roh) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — Přepnout kanál podle pozice v seznamu

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| Pole | Typ | Výchozí | Popis |
|---|---|---|---|
| `channel_number` | number | povinné | Pozice kanálu v seznamu počítaná od 1 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — Přepnout kanál podle (části) názvu

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

Hledání podřetězce nerozlišuje velikost písmen. Platí první shoda.

| Pole | Typ | Výchozí | Popis |
|---|---|---|---|
| `channel_name` | string | povinné | Název nebo část názvu kanálu |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — Přepnout na náhodný kanál

Tento starší příkaz vybírá způsobilé kanály z aktuálního seznamu či kategorie. Čísla kanálů a rozsahy označují pozice v tomto seznamu; viz [pravidla bezpečného náhodného výběru](docs/remote-command-server.md#safe-random-playback).

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

| Pole | Typ | Výchozí | Popis |
|---|---|---|---|
| `random_range` | [start, end] | aktuální seznam | Rozsah počítaný od 1 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — Změnit poskytovatele IPTV

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| Pole | Typ | Výchozí | Popis |
|---|---|---|---|
| `provider` | number | povinné | Index v poli poskytovatelů (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — Načíst nový seznam M3U

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| Pole | Typ | Výchozí | Popis |
|---|---|---|---|
| `playlist` | string | povinné | URL seznamu M3U |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — Aktualizovat konfiguraci poskytovatele

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| Pole | Typ | Výchozí | Popis |
|---|---|---|---|
| `provider_settings` | string | povinné | Řetězec JSON s konfigurací poskytovatele |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — Nastavit nebo upravit hlasitost

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

Klienti bez podpory řízení hlasitosti příkaz tiše ignorují.

| Pole | Typ | Výchozí | Popis |
|---|---|---|---|
| `volume` | number | — | Absolutní úroveň 0-100 |
| `volume_step` | number | — | Relativní změna, např. +10 nebo -5 |

<a id="player-standby-restart-and-exit"></a>

#### Pohotovost, restart a ukončení přehrávače

Webhook fronta místního proxy bez potvrzení nepodporuje `exit_player` ani typované požadavky pohotovosti/probuzení. Připojte přehrávač k [příkazovému serveru](docs/remote-command-server.md) a použijte jeho CLI:

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

Nahraďte `d1` aliasem registrovaného přehrávače. `stop` je alias `standby`; `start` a `wake` jsou aliasy `go`. Go vyžaduje běžící připojený přehrávač; nedokáže spustit zavřenou aplikaci ani probudit offline zařízení. Prohlížeč nebo TV bez nativního ukončení hlásí, že ukončení nepodporuje. Pohotovost zachovává vzdálené dotazování a nepozastavuje nesouvisející práci hostitele nebo sdíleného serveru.

Po standby/go zkontrolujte `ott d1 status` pro stav pohotovosti/pozadí a samostatně ověřte obnovené přehrávání. Po znovunačtení přehrávače potvrďte nový runtime přes `ott d1 doctor`. Po ukončení ověřte v OS, že proces skončil; vzdálený timeout ukončení neprokazuje. Samotné přijetí příkazu tyto výsledky nepotvrzuje.

<a id="local-proxy-server"></a>

## Místní proxy server

`local_proxy.py` je samostatná autentizovaná fronta příkazů pro jeden přehrávač. Výchozí spuštění skončí bez otevření portu. Každá instance používá kód zařízení vytvořený přehrávačem; pro více přehrávačů použijte oddělené instance/porty. Parametr dotazu `device_id` je přijat jako metadata kompatibility a nikdy neověřuje ani nevybírá jiné zařízení.

<a id="start-the-proxy"></a>

### Spuštění proxy

1. Zapněte **Místní dálkové ovládání HTTP** v přehrávači a zkopírujte jeho **Kód zařízení**.
2. Na hostiteli proxy nastavte kód a přesný origin poskytující přehrávač (schéma, hostitel a port, bez cesty):

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. Nastavte **Místní URL příkazů** přehrávače na `http://192.168.1.50:8081/api/webhook/commands`.

Výchozí adresa naslouchání je `127.0.0.1`; příklad výslovně zapíná přístup LAN. `OTTPLAY_QUEUE_HTTP_ORIGINS` je čárkami oddělený seznam přesných povolených originů prohlížeče. Pokud poskytujete přehrávač přes HTTPS, použijte reverzní proxy HTTPS, aby pravidla smíšeného obsahu dotazování dovolila. Kód uchovejte v tajnosti a mimo URL. Když přehrávač vytvoří nový kód, restartujte proxy s novou hodnotou; vypnutí samotného přehrávače nezastaví samostatně spravované proxy.

<a id="endpoints"></a>

### Endpointy

| Metoda | Cesta | Popis |
|---|---|---|
| `POST` | `/api/webhook/commands` | Zařadit příkaz do fronty |
| `GET` | `/api/webhook/commands` | Vybrat příkazy z fronty (dotaz přehrávače) |
| `POST` | `/webhook/notify` | Autentizovaný kompatibilní alias |
| `GET` | `/webhook/poll` | Autentizovaný kompatibilní alias |

Odesílání i vybírání vyžaduje odpovídající Bearer kód zařízení. Neexistuje neautentizovaný rozesílací endpoint. Příkazy vyprší za 60 sekund; každé proxy uchovává nanejvýš 50 příkazů.

Proxy zpracuje až 16 spojení současně, takže nečinné spojení prohlížeče nebo neúplný požadavek nezdrží ostatní příkazy. Každý socket má pětisekundový timeout nečinnosti; další spojení se zavírají, když jsou všichni pracovníci obsazení. Zařazení a vybrání fronty je mezi pracovníky atomické.

<a id="smoke-script-all-modes"></a>

### Testovací skript (všechny režimy)

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Emulátor/zařízení Android: nejprve `adb forward tcp:18081 tcp:18081`. Cap/Tauri používají pouze loopback — pro Home Assistant v LAN použijte toto proxy režimu A. Podrobnosti: `docs/capacitor-mobile.md` § Smoke test.

<a id="cors"></a>

### CORS

Proxy dovoluje požadavky prohlížeče pouze z `OTTPLAY_QUEUE_HTTP_ORIGINS`. Předběžné požadavky `OPTIONS` z povoleného originu nepotřebují token; každý skutečný GET/POST vyžaduje Bearer kód zařízení. Zástupné originy a `null` se nepřijímají. Home Assistant a další klienti mimo prohlížeč mohou vynechat Origin, ale stále potřebují autentizaci.

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### Příklad: webhook Home Assistant → místní proxy → přehrávač

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

### Příklady automatizace Home Assistant

Příklady oznámení, kanálu a hlasitosti používají místní proxy. Nastavte `ottplay_device_authorization` v Home Assistant `secrets.yaml` na `Bearer <device-code>` s kódem zobrazeným aktivovaným přehrávačem.

Noční pohotovost používá samostatný [příkazový server](docs/remote-command-server.md). Nahraďte příkladové URL a `DEVICE_UUID` adresou kontroleru a ID registrovaného zařízení; místní CLI alias `d1` není ID zařízení. Nastavte `ottplay_control_authorization` na `Bearer <controller-admin-token>` v `secrets.yaml`. Tento údaj je oddělený od kódu zařízení místního proxy. Viz dokumentace Home Assistant [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) a [tajné údaje](https://www.home-assistant.io/docs/configuration/secrets/).

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

`standby_request` obsahuje HTTP odpověď pro stopu automatizace. HTTP 202 znamená pouze zařazení: uchovejte `content.id` a potom dotazujte `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` se stejným údajem kontroleru pro odpověď přehrávače. Nový požadavek `status` sleduje `player.standby` a `player.background`; zapnutá pohotovost s `suspended` a nulou čekajících potvrzuje dokončení sledované práce přehrávače. Pohotovost ukončete stejným typovaným požadavkem s `"operation":"wake"` (`ott d1 go`). Po timeoutu neopakujte změnu naslepo. Viz [API požadavek/odpověď](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) a [sémantika pohotovosti](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake) kontroleru.

<a id="server-api-reference"></a>

## Reference API serveru

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Endpointy webhook (Rust `ottplay-server`)

Server Rust a archivovaná náhrada Python odmítají příkazové endpointy stavem HTTP 403. `/api/webhook/commands`, `/webhook/notify`, `/webhook/poll` a aliasy zdraví příkazů nezařazují, nerozesílají ani nevybírají příkazy. Obecné API zpětné vazby nemůže tyto rezervované trasy přepsat. Doručování v režimu A používá samostatně nakonfigurovaný příkazový server nebo autentizované místní proxy popsané výše.

<a id="other-endpoints"></a>

### Ostatní endpointy

| Metoda | Cesta | Popis |
|---|---|---|
| `GET` | `/epg/<hash>.json` | Data EPG kanálu |
| `GET` | `/logo/<id>.svg` | Vygenerované logo kanálu |
| `GET` | `/version/<path>` | Hash verze souboru |
| `POST` | `/m3u/match-channels` | Párování kanálů s EPG |
| `POST` | `/m3u/match-logos` | Párování log kanálů |
| `POST` | `/m3u/cp.php` | Stream proxy |
| `GET/POST` | `/feedback/` | Záznam zpětné vazby |
| `GET` | `/tmdb/*` | Proxy API TMDb |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## Struktura projektu

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

## Mapování kláves STB

- **Samsung Tizen**: `RETURN=10009`, `ENTER=13`, barvy 403-406
- **Samsung Maple**: dpad 4/5/6/8, původní kódy SDK
- **LG WebOS**: `RETURN=461`, barvy kompatibilní s HbbTV
- **LG NetCast**: `RETURN=8`, kódy HbbTV
- **MAG**: `RETURN=8`, API gSTB pro MAC
- **Dune HD**: standardní kódy, API Dune
- **Android TV**: kódy Android (`BACK=4`, `DPAD_*` 19-22, `ENTER=66`)
- **HbbTV/Panasonic/Philips/Sony/atd.**: kódy HbbTV (`RED=403`, `BLUE=406`, `VOL_UP=447`)

<a id="documentation"></a>

## Dokumentace

- [Dokumentační wiki](./docs/wiki/Home.cs.md) / [Wiki rusky](./docs/wiki/Home.ru.md) — navigace podle úkolů a pravidla údržby.
- [Zpráva o implementaci](./docs/implementation-report.cs.md) / [Proces a výsledek rusky](./docs/implementation-report.ru.md) — barevné diagramy, ověřené chování, měřené náklady a podmínky vydání.
- [Průvodce dodáním](./docs/roadmap-delivery.cs.md) / [Nové funkce rusky](./docs/roadmap-delivery.ru.md) — funkce, omezení a ověření.
- [Rychlý start v 88 jazycích rozhraní](./docs/readme/README.md) — vytvořený z dodávaných překladů UI; hlavní příručka a spárované průvodce funkcemi jsou dostupné ve [24 jazycích dokumentace](docs/manual-translations.md).
- [Limity kvality a obnova živého přehrávání](./docs/playback-stream-policy.cs.md) / [Rusky](./docs/playback-stream-policy.ru.md).
- [Ruční mapování XMLTV a klasická přístupnost](./docs/guide-binding-accessibility.cs.md) / [Rusky](./docs/guide-binding-accessibility.ru.md).
- [Hostovaný test zvuku/videa](./docs/audio-video-check.cs.md) / [Rusky](./docs/audio-video-check.ru.md).
- [Knihovna médií Xtream](./docs/xtream-media.cs.md) / [Rusky](./docs/xtream-media.ru.md).
- [Předání mezi zařízeními stejného zdroje](./docs/remote-handoff.cs.md) / [Rusky](./docs/remote-handoff.ru.md).
- [Obnovitelné místní nastavení](./docs/settings-recovery.cs.md) / [Rusky](./docs/settings-recovery.ru.md).
- [Generace prohlížečů, operační systémy a přesné kontroly kandidátů vydání](docs/browser-compatibility.cs.md) / [Rusky](docs/browser-compatibility.ru.md).

- [Architektura přehrávače](./docs/architecture.md) — běhové odpovědnosti, integrace poskytovatelů, přehrávání, průvodce, adaptéry zařízení a smlouvy sestavení.
- [Klasický sestavovací řetězec ES5](./docs/build-pipeline.md) — kompilace, kontroly kompatibility a limity velikosti artefaktů.
- [Názvy běhových souborů a migrace nasazení](./docs/asset-layout.md) — popisné cesty sdílené webovými a nativními balíčky.
- [Vzdálené pracovní prostředí](./docs/remote-workbench.md) — inspekce UI/médií, potvrzení operací a uložené doklady.
- [Běhová diagnostika](./docs/runtime-debug.md) — historie chyb, počítadla snímků/smyček, nativní metriky Capacitor/Tauri a ladění serveru.
- [Místní dodání macOS](./docs/macos-local-delivery.md) — sestavení checkoutu, místní instalace a ověření.

<a id="license"></a>

## Licence

[MIT](LICENSE) — svobodný a otevřený software. Obsah poskytovatelů a závislosti třetích stran si zachovávají vlastní práva a licence.

Samostatná aplikace [OTTPlay native webOS](docs/native-webos.md), odvozená od PlxNative, je distribuována pod licencí **GPL-3.0-or-later** spolu s odpovídajícím zdrojovým kódem.
Licence MIT v kořenovém adresáři nemění licenci této nativní aplikace ani jejích oprav.

<a id="desktop-updater--notarization-mode-b"></a>

## Desktopový aktualizátor / notarizace (režim B)

[Průvodce podpisem a aktualizátorem desktopu](docs/tauri-updater-notarize.md) popisuje podpis macOS ad-hoc, volitelné Developer ID/notarizaci a ověření balíčku. Release CI používá podpis ad-hoc bez údajů Apple. Podpis aktualizátoru je samostatný; produkční automatické aktualizace zůstávají nenastavené.

<a id="local-mac-build-helpers"></a>

## Pomocníci pro místní sestavení Mac

Viz [docs/local-build-scripts.md](docs/local-build-scripts.md).

<a id="privacy"></a>

## Soukromí

Přečtěte si [zásady ochrany soukromí](docs/privacy-policy.md) pro informace o místních nastaveních, nakonfigurovaných službách a vašich možnostech. Kontakt pro soukromí a podporu: [alvit.work@gmail.com](mailto:alvit.work@gmail.com).

Studio 2026 je výchozí motiv rozhraní. Classic a PLi-HD zůstávají volitelné a uložené předvolby se zachovávají. Viz [nastavení rozhraní](docs/interface-settings.md). Motiv PLi-HD připisuje zásluhy autorům Vali, littlesat, VU+NL, Milo a původním přispěvatelům. Viz [autoři rozhraní a historie návrhu](docs/interface-history.md) pro anglickou historii a odkazy na zdroje, dostupné také v informační nabídce přehrávače.

<a id="demo-video-editing"></a>

## Úpravy demonstračního videa

Pro přípravu a úpravu demonstračních záznamů použijte místní [postup video-use](docs/demo-video.md). Pomocník udržuje všechna vytvořená média mimo Git.

<a id="plex-media-library"></a>

## Knihovna médií Plex

Každý přehrávač se může přes poskytovatele **Plex** připojit k účtu Plex nebo Plex Media Serveru. Integrace používá Plex; Synology je jedním z možných hostitelů mediálního serveru. Všechna dostupná videa a hudební skladby se automaticky zobrazí v seznamu kanálů; výběr kategorie filtruje podle knihovny, složky nebo seriálu. Přehrávání začne první použitelnou dávkou, s načítáním na pozadí, běžným hledáním a Akcemi pro náhodné pořadí/opakování, bez nastavování Plexu na OTT serveru. Viz [přihlášení Plex a přímé přehrávání](docs/plex-provider.md).

![Životní cyklus načítání Plex, navigace soubory a ukončení](docs/images/plex-playback-lifecycle.svg)

[Ilustrovaný přehled spolehlivosti](docs/plex-provider.md#reliability-review-process-and-results) vysvětluje pravidla načítání a rušení, opravy úplných katalogů a přepínání souborů a naměřené výsledky ověření Chromium/WebKit.

Volitelná integrace OTT serveru také zpřístupňuje katalog existujícího Plex serveru a kompatibilní přehrávání přes samostatnou položku knihovny NAS a export M3U. Viz [nastavení serverové knihovny a přístup klienta](docs/synology-library.md).

<a id="related-repositories"></a>

## Související úložiště

- [ottplay-core](https://github.com/open-ott-play/ottplay-core) obsahuje sdílenou doménovou logiku JVM/ES5, komunikační smlouvy a klienta FOSS2. Tento přehrávač používá generované artefakty; pro sdílené změny dodržujte průvodce dodáním jádra.
- [ottplay-android](https://github.com/open-ott-play/ottplay-android) je samostatná nativní aplikace Kotlin/Compose s vlastní instalační a vydávací identitou.
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server) poskytuje samostatně hostované vzdálené příkazy; [ottplay-swop](https://github.com/open-ott-play/ottplay-swop) nabízí volitelný přenos textového vstupu přes Worker.
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine) spravuje hostovaný profil dema prohlížeče, demonstrační média a ověření publikace.

<a id="project-maintenance"></a>

## Údržba projektu

Viz [požadavky na přispívání a testy](CONTRIBUTING.md), [zásady hlášení bezpečnostních problémů](SECURITY.md), [bezpečnostní návrh](docs/security-design.md) a [doklady OpenSSF a zbývající kritéria](docs/openssf-evidence.md).
