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

File locali senza Internet: vedere [Video locali e riproduzione offline](docs/offline-media.md).

[![Elenco canali di OTT-play FOSS in prospettiva](docs/images/hero.png)](docs/images/studio-2026-default.png)

*Schermata dell’interfaccia Studio 2026 esistente con canali e programmi sintetici di prova. Aprire l’immagine per la vista originale piatta; non mostra un abbonamento attivo. [Origine dell’immagine e rigenerazione](docs/images/README.md).*

[Guide rapide in 88 lingue](docs/readme/README.md) · [Wiki della documentazione](docs/wiki/Home.it.md)

[![Buone pratiche OpenSSF](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![Fuzzing: solo RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

Le release candidate pubbliche eseguono campagne di fuzzing limitate e isolate per l’analisi XMLTV nativa/server e la convalida delle richieste ai portali. Vedere [ambito del fuzzing, riproduzione ed evidenze di rilascio](FUZZING.md).

Lettore IPTV/OTT autonomo con server HTTP locale in Rust. Funziona su Smart TV (LG WebOS, Samsung Tizen, Panasonic, Sony e altre), decoder (Infomir MAG, Dune HD, Enigma2, Android TV) e browser desktop.

Iniziare dalla [guida all’architettura e ai contributi](docs/architecture.md) per livelli di esecuzione, responsabilità, estensioni dei provider e verifiche. Vedere [sessioni di riproduzione e cicli di vita dei provider](docs/playback-session-architecture.md) per il confine tra nucleo e host e i contratti di compatibilità.

<!-- ci-release-process:start -->
<a id="release-process"></a>

## Processo di rilascio

La [strategia di rilascio](RELEASING.md) descrive convalida e promozione nightly, beta, RC e stabile; il [manuale operativo](docs/release-workflow.md) contiene i comandi locali.
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## Eseguire nel browser

Aprire la [demo online](https://player.ottplay.here.now/) oppure compilare e servire il lettore web con le istruzioni seguenti.

La [distribuzione locale macOS](docs/local-http-deployment.md) fornisce origini HTTP del lettore sulle porte 8443–8446. La porta 8095 è dismessa.

Al primo avvio scegliere **Prova la demo** per riprodurre il monoscopio animato oppure configurare una propria playlist M3U o un provider. La demo rimane disponibile da **Cambia provider → Demo**.

La modalità demo richiede Internet ma nessun account provider. I canali di prova MP4 e HLS senza audio sono ospitati su here.now e condivisi da lettore web, Tauri, Capacitor e OTT Server. Cambiando modalità si conservano le impostazioni del provider. Per una **verifica separata di immagine e suono**, aprire **Informazioni → Audio → Riproduci** sul motore HTML5 gestito, quando inattivo o durante la TV in diretta. Usa il file udibile `av-v1.mp4` su here.now e richiede Internet. Il filmato non è incluso nei pacchetti e non viene mai scaricato all’avvio. Sono esclusi VOD, archivio e sostituzioni del motore specifiche del dispositivo (compresi PC2/Video.js e motori nativi); vedere [passaggi, toni attesi e schema di hosting](docs/audio-video-check.it.md).

Le finestre browser desktop installate supportano **Window Controls Overlay**: Chrome può nascondere la barra del titolo separata mantenendo pulsanti finestra e menu applicazione sopra il lettore. Aprire l’app installata e scegliere **Nascondi barra del titolo** quando disponibile; **Mostra barra del titolo** ripristina la cornice normale. Schede normali e layout TV/contenitori nativi mantengono il comportamento esistente. Vedere [controlli della finestra browser](docs/browser-window-controls.md) per URL d’installazione supportati, aggiornamento dei collegamenti e verifiche.

Per spostarsi di dieci secondi nella vista video principale usare **Alt/Opzione + Sinistra/Destra** (anche **Comando + Sinistra/Destra** su macOS), a schermo intero o normale. Video locali, VOD e archivi supportati usano gli stessi comandi su web, Tauri e Capacitor. Vedere [scorciatoie e limiti](docs/browser-window-controls.md#playback-keyboard-shortcuts).

Nell’interfaccia PC, **R** riproduce un altro canale o video casuale dell’elenco attuale senza cambiarne l’ordine. Funziona nella vista principale e negli elenchi; editor di testo, dialoghi, impostazioni e restrizioni del chiosco mantengono la priorità. Le mappature degli altri dispositivi non cambiano.

Il monoscopio sintetico si rigenera con `scripts/generate-demo-media.sh` (richiede FFmpeg); i media generati restano nella directory ignorata `.local-artifacts`.

<a id="features"></a>

## Funzionalità

- **Riproduzione**: flussi HLS, DASH e HTTP semplice, con limiti di qualità gestiti HLS.js/Shaka, recupero limitato e fino a tre URL di riserva espliciti per canale live. Archivio/VOD non passano mai a una riserva live; vedere [qualità e recupero](docs/playback-stream-policy.it.md).
- **EPG**: abbinamento XMLTV, differita/catch-up, ricerca nei titoli (N5 nell’EPG), promemoria e associazione manuale di fonte/ID a un canale preciso nel percorso XMLTV ospitato/nativo. Vedere [associazione e accessibilità](docs/guide-binding-accessibility.it.md).
- **Preferiti**: una [raccolta mista](docs/mixed-favorites.md) ordinata tra fornitori e profili configurati sui dispositivi supportati, con esportazione/importazione portabile tramite CLI; PIN parentale. Gli elenchi per singola sorgente restano disponibili in modalità di ripiego.
- **Impostazioni**: esportazione/importazione JSON di impostazioni e preferiti, registro di annullamento per gruppi localStorage supportati, ripresa archivio legata alla fonte e confronto esatto delle impostazioni memorizzate per i flussi del controller. Il recupero presume un solo autore delle scritture; gli adattatori personalizzati mantengono il ripristino secondo le possibilità. Vedere [recupero impostazioni](docs/settings-recovery.it.md).
- **Interfaccia condivisa**: OTT Server, Tauri e Capacitor usano lo stesso tema e le stesse impostazioni di visibilità dell’elenco. Le impostazioni d’interfaccia controllano evidenziazione e selezione; quelle dell’elenco controllano nomi, picon, programmi attuali, avanzamento e indicatori d’archivio.
- **Provider**: M3U/M3U8, diretta Xtream e [cataloghi di film/serie on demand](docs/xtream-media.it.md), Stalker/Ministra con [film ed episodi annidati](docs/stalker-media.md), Plex e VPortal. Capacità del provider e accesso dell’account determinano le funzioni di archivio e raccolta disponibili.
- **Comandi push**: controllo remoto tramite webhook — cambiare canale, provider, playlist e mostrare popup.
- **Inserimento remoto del testo (swop)**: tastiera del telefono tramite Cloudflare Worker quando TV e telefono sono in reti diverse (sessioni autorizzate per installazione; ♥™ sulla tastiera virtuale).
- **Instradamento per dispositivo**: indirizzamento UUID per installazioni con più dispositivi.
- **Proxy locale**: server di comandi opzionale per automazione interamente locale (nessun server centrale necessario).
- **Integrazione controller**: operatori limitati per dispositivo/azione, risultati persistenti opzionali dei comandi, applicazione riprendibile dei profili Local/Home e trasferimento di live/archivio della stessa fonte tramite il [server di controllo](https://github.com/open-ott-play/ottplay-control-server) corrispondente. Richiedono controller/CLI aggiornati; una scheda browser autonoma non li fornisce.
- **Preferenze remote tipizzate**: scopri le impostazioni, leggi i valori salvati ed effettivi e salva verificando istanza di esecuzione, sorgente e revisione; consulta [impostazioni remote e configurazione VPortal](docs/remote-player-settings.md).
- **Debug**: HUD/registro circolare opzionali tramite `?debug=1`, ispezione remota con consenso e verifica audio/video ospitata su richiesta.
- **Accessibilità da tastiera**: dialoghi classici nominati, contenimento e restituzione del focus Tab, semantica del canale selezionato e annunci di stato discreti. Questi miglioramenti non attestano conformità completa WCAG o con gli screen reader dei dispositivi.
- **24 tipi di dispositivo**: mappature del telecomando specifiche.
- **88 lingue d’interfaccia**: cataloghi corrispondenti, [guide rapide localizzate](docs/readme/README.md) e [alfabeti tastiera verificati con CLDR](docs/localization.md). Manuale principale e guide funzionali abbinate sono disponibili in [24 lingue di documentazione](docs/manual-translations.md); gli altri riferimenti tecnici mantengono le lingue esistenti.

La [guida alla distribuzione](docs/roadmap-delivery.it.md) descrive funzioni implementate in questa revisione, confini di piattaforma, diagrammi e verifiche. Release installate e servizi ospitati possono usare una revisione precedente. L’[app Android](https://github.com/open-ott-play/ottplay-android) nativa indipendente conserva anch’essa scelte audio/sottotitoli per lingua, ruolo ed etichetta invece degli indici del manifesto; implementazione e rilascio sono separati da questo frontend.

La [revisione del codice sorgente STB](docs/stb-player-improvements.md) descrive i miglioramenti relativi ai contenuti multimediali, alle risorse e al ripristino, i confronti tra i sorgenti e i limiti attuali.

<a id="debug-hud"></a>

## HUD di debug

HUD locale e persistenza dei log server si attivano separatamente. Leggere [accesso diagnostico, oscuramento dei dati e conservazione](docs/diagnostic-security.md) prima di raccogliere log da altri dispositivi.

Attivare il debug in uno dei seguenti modi:
- URL: `?debug=1` o `?debug=true`.
- Memoria locale: `localStorage.setItem("ottplay_debug", "1")`.
- Proprietà della finestra: `window.__OTT_DEBUG__ = true`.
- Server: quando `/debug/config` restituisce `{enabled: true}`.

Con debug attivo:
- **D** alterna la striscia HUD (`ottDebugSetHud` / `__ottDebug.toggleHud()`).
  - Ignorato quando il focus è in INPUT/TEXTAREA/listEdit.
  - Usa `e.key` per evitare il conflitto MAG/Maple PLAY/PREV=68.
- Menu Informazioni → **Debug HUD** → chiama `__ottDebug.toggleHud()`.
- Gestisci impostazioni → **Debug HUD**:
  - Debug già caricato: alterna la visibilità.
  - Altrimenti: imposta `ottplay_debug=1` + `ottplay_debug_hud=1` e propone il riavvio.
- Persistenza: `ottDebugSetHud` salva lo stato in `localStorage.ottplay_debug_hud` ("1"/"0").

<a id="capacitor-ios-and-android"></a>

## Capacitor per iOS e Android

Questo repository impacchetta il frontend TypeScript condiviso con Capacitor per iOS e Android 7+. Entrambi usano font di sistema e runtime nativo bloccato da npm. Un APK separato di compatibilità API 22 supporta Android 5.1/6 con WebView 60 o successivo. Entrambi gli APK sono firmati e inclusi nelle release beta, RC e stabili qualificate insieme all’IPA iOS non firmato. L’app Kotlin indipendente rimane in [ottplay-android](https://github.com/open-ott-play/ottplay-android).

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

Vedere [configurazione Capacitor](docs/capacitor-mobile.md) e [distribuzione Android e aggiornamenti remoti](docs/android-distributions.md).

L’interfaccia iOS usa l’orientamento orizzontale. Impostazioni, provider, consenso al controllo remoto ed esportazione/importazione JSON continuano a usare il frontend condiviso. Il multitasking dei tablet può sostituire l’orientamento richiesto.

Su iPhone scorrere verticalmente sull’elenco per attraversare righe e pagine: in alto verso i canali successivi, in basso verso i precedenti. Un gesto rapido continua per più pagine rallentando; un trascinamento lento resta preciso. Toccare lo schermo o premere un tasto di navigazione per arrestarlo. Un tocco avvia il canale sotto il dito anche se un’altra riga è selezionata. Uno scorrimento non apre mai il canale al rilascio.

Su iPhone il video viene riprodotto dentro l’interfaccia. Toccare il fondo dello schermo per informazioni sul programma o aprire il menu mentre continua. Picture in Picture resta un’opzione distinta.

Verifica dispositivo: [checklist modalità B](docs/mode-b-device-smoke.md) e `./scripts/smoke-capacitor-device.sh --help` (destinazione compilazione/sincronizzazione solo iOS). Verifica Tauri desktop: [checklist desktop](docs/mode-b-tauri-smoke.md).

<a id="installation"></a>

## Installazione

| Piattaforma | Pacchetto | Note |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Build separate Apple Silicon e Intel; firma ad hoc se la firma Apple non è configurata |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | Varie distribuzioni |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode o Homebrew Channel](docs/lg-webos-installation.md); lettore ospitato, rete necessaria |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode e firma locale; pacchetto TV non firmato, distinto da Family Hub](docs/samsung-tizen-installation.md) |
| **iOS** | `.ipa` tramite AltStore / TestFlight / Xcode | Solo installazione esterna — non ancora su App Store |
| **Android (frontend condiviso)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | Pacchetti Capacitor firmati; scegliere la versione Android supportata |
| **Android (Kotlin nativo)** | [Applicazione nativa](https://github.com/open-ott-play/ottplay-android) separata | Repository pubblico; applicazione e processo di rilascio separati |

Gli installatori supportati sono allegati alle release GitHub qualificate: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **Nota:** i bundle macOS usano firma ad hoc in assenza di credenziali Apple; non fornisce Developer ID o notarizzazione. Gli installatori Windows/Linux e i pacchetti iOS possono essere non firmati. iOS richiede una firma prima dell’installazione su dispositivo fisico. Gli APK Android Full e API 22 qualificati usano il certificato stabilito; le build locali di rilascio necessitano di keystore configurato per produrre APK firmati.

---

<a id="macos"></a>

### macOS

1. Scegliere il tag desiderato in [Release](https://github.com/open-ott-play/ottplay-foss/releases). Il collegamento all’ultima versione sceglie stabile, non beta o RC.
2. Scaricare `OttPlay.FOSS_*_aarch64-apple-darwin.dmg` per Apple Silicon o `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` per Intel. Sono build di architetture distinte.
3. Aprire il `.dmg` e trascinare **OttPlay FOSS.app** in Applicazioni.
4. Verificare il bundle copiato prima del primo avvio:

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

Una verifica riuscita controlla l’integrità del bundle. `Signature=adhoc` significa che l’app non ha identità sviluppatore autenticata da Apple; non attesta notarizzazione o approvazione Gatekeeper. Anche con download affidabile e bundle valido, macOS può richiedere **Impostazioni di Sistema → Privacy e sicurezza → Apri comunque** dopo il primo tentativo; vedere [istruzioni Apple](https://support.apple.com/en-us/102445).

Il messaggio «app danneggiata» non dimostra che il problema sia solo la quarantena. Se la verifica della firma fallisce, conservare l’errore e ottenere una release corretta. Non firmare nuovamente l’app scaricata né rimuoverne gli attributi per far sembrare riuscita una verifica fallita.

Le alternative ZIP sono `OttPlay.FOSS_aarch64-apple-darwin.app.zip` e `OttPlay.FOSS_x86_64-apple-darwin.app.zip`. Per estrazione, immagini disco e Gatekeeper vedere [firma macOS e verifica degli artefatti](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact). Per build dal checkout e installazione locale usare [distribuzione locale macOS](docs/macos-local-delivery.md).

---

<a id="windows"></a>

### Windows

1. Scaricare `.msi` o `.exe` dalle [release](https://github.com/open-ott-play/ottplay-foss/releases/latest).
2. Eseguire l’installatore e seguire le indicazioni.
3. Avviare dal menu Start o dal collegamento desktop.

---

<a id="linux"></a>

### Linux

La riproduzione Linux richiede plugin GStreamer HLS, H.264 e AAC oltre a WebKitGTK. I pacchetti dichiarano queste dipendenze; AppImage include il framework multimediale. Vedere [pacchetti multimediali Linux](docs/linux-media-packaging.md) per controlli codec e distinzione tra accettazione browser e nativa.

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

### Installazione iOS

iOS richiede firma prima dell’installazione fisica. Usare AltStore Classic per l’IPA di rilascio non firmato oppure compilare e firmare i sorgenti con Xcode. TestFlight richiede un invito separato, se offerto.

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### Opzione 1: AltStore Classic (consigliata per uso personale)

AltServer funziona sul computer; AltStore Classic su iPhone/iPad e importa l’IPA. È sufficiente un account Apple gratuito.

**Prerequisiti:**

- iPhone/iPad con **iOS/iPadOS 15 o successivo** per la build OTT-play attuale.
- Mac o PC Windows con AltServer e cavo USB dati.
- Account Apple per firmare e Internet per scaricare la release.

**Passo 1: configurare AltStore una volta**

1. Installare AltServer secondo la guida ufficiale [macOS](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) o [Windows](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows). Avviarlo e usare l’icona nella barra dei menu/area di notifica.
2. Collegare via USB, sbloccare e accettare le richieste di fiducia computer/dispositivo. Su Mac verificare che compaia nel Finder.
3. In **menu AltServer → Install AltStore**, scegliere il dispositivo e completare le richieste dell’account di firma. Attendere la notifica d’installazione.
4. Sul dispositivo aprire **Impostazioni → Generali → VPN e gestione dispositivo** e autorizzare lo sviluppatore dell’account di firma se richiesto. Su iOS 16+ abilitare **Impostazioni → Privacy e sicurezza → Modalità sviluppatore** e completare riavvio/conferme.
5. Aprire AltStore sul dispositivo. Se è già installato e funzionante, saltare la configurazione e lasciare AltServer attivo per l’importazione seguente.

**Passo 2: importare la release scelta su iPhone/iPad**

1. Scegliere un tag preciso da [tutte le release](https://github.com/open-ott-play/ottplay-foss/releases) e scaricarne `ottplay-foss-ios-unsigned.ipa` in Safari sul dispositivo. Il [collegamento all’ultima release](https://github.com/open-ott-play/ottplay-foss/releases/latest) sceglie stabile; usare l’elenco completo per una beta.
2. Salvare l’IPA in File. In **AltStore → My Apps → +**, selezionarlo. Si può anche trasferire dal Mac con AirDrop e salvarlo in File prima dell’importazione. Aprire l’IPA sul Mac non esegue questo passaggio.
3. Tenere AltServer attivo e il cavo USB collegato mentre AltStore firma e installa. Per aggiornare usare lo stesso account di firma dell’installazione esistente; non eliminare subito l’app per risolvere problemi.
4. Attendere la fine, verificare OTT-play in **My Apps**, quindi avviarlo.

**Alternativa: importare direttamente l’URL della release**

Con AltStore già installato, inserire questo modello in **Safari sull’iPhone**, sostituendo `TAG` con il tag esatto, e accettare **Open in AltStore**:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

Usa il [gestore URL d’installazione AltStore](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift). Evita una voce ambigua in File/Recenti quando più download hanno lo stesso nome. L’URL deve indicare l’IPA, non la pagina della release.

Per esempio, questa importazione è stata verificata il **2026-09-29** con AltStore 2.3 e AltServer 1.8.1. È un esempio storico fisso, non un collegamento all’ultima versione:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**Rinnovo:** le installazioni con account gratuito scadono dopo sette giorni. Mantenere AltServer raggiungibile e usare **AltStore → My Apps → Refresh All** prima della scadenza. Anche il rinnovo in background richiede AltServer; vedere [istruzioni di rinnovo](https://faq.altstore.io/altstore-classic/your-altstore).

<a id="verify-the-installed-version-before-retrying"></a>

#### Verificare la versione installata prima di riprovare

«Inviato» di AirDrop conferma solo il trasferimento. La barra di avanzamento AltStore conferma l’avvio dell’importazione. Perdere la connessione Duplicazione/USB non prova che l’installazione sia fallita: controllare l’app installata prima di reinviare l’IPA.

Su Mac con Xcode installato e selezionato come directory sviluppatore attiva, ispezionare senza reinstallare:

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

In `result.apps` del JSON trovare OTT-play (`bundleIdentifier` inizia con `play.ott.foss`) e confrontare `version` e `bundleVersion` con `CFBundleShortVersionString` e `CFBundleVersion` dell’IPA scelto. Un suffisso dell’account di firma AltStore nell’identificatore è normale. Conservare il rapporto localmente.

L’esempio beta.9 verificato riporta **versione `1.1.51`, build `2.2.66`**. Ciò conferma l’installazione; apertura, accesso Cloudflare, caricamento playlist, riproduzione e PiP sono prove separate sul dispositivo.

<a id="troubleshooting-ios-installation"></a>

#### Risolvere problemi d’installazione iOS

- **AltServer non ha finestra o l’apertura automatizzata scade:** usare l’icona nella barra dei menu/area di notifica. È un’app in background. Tentare ripetutamente di aprire una finestra normale non importa l’IPA.
- **«Could not find AltServer» o dispositivo USB non disponibile:** verificare che AltServer sia attivo, sbloccare il telefono e controllare le richieste di fiducia. Controllare la visibilità nel Finder su Mac. Se la connessione cade, ripristinarla in sicurezza e verificare la versione installata prima di riprovare. Se persiste, seguire [diagnostica connettività AltStore](https://faq.altstore.io/altstore-classic/troubleshooting-guide). Se il telefono fornisce Internet al computer, coordinare cambi di cavo/rete per non interrompere altro lavoro.
- **Duplicazione iPhone mostra «iPhone in Use» o resta su «Connecting»:** terminare la configurazione sul telefono fisico oppure bloccarne lo schermo e lasciarlo vicino al Mac sbloccato per duplicarlo. Sbloccare il telefono termina la duplicazione; fiducia/configurazione USB potrebbero richiedere prima lo sblocco. Se anche una riconnessione si blocca, chiudere Duplicazione e continuare sul telefono. Vedere [requisiti Apple](https://support.apple.com/en-us/120421). La duplicazione è facoltativa per installare.
- **Un URL perde lettere latine o diventa cirillico nella duplicazione:** impostare la **sorgente di input Mac su ABC/Inglese**. Con Duplicazione attiva premere **Ctrl–Spazio** e scegliere **English (US)** per la tastiera fisica iPhone. Le sorgenti Mac e iPhone possono differire; cambiare solo quella Mac non bastava nella sessione verificata. Svuotare il campo, riscrivere l’URL e controllarlo prima dell’invio.
- **Incollare nella duplicazione si blocca o inserisce testo inatteso:** svuotare e riscrivere lentamente in brevi parti con la sorgente English (US) dell’iPhone oppure inserire l’URL sul telefono. L’inserimento veloce può perdere o duplicare caratteri; controllare l’indirizzo completo prima di salvare. Non inviare URL incollati parzialmente. Incollare è fallito nella nostra sessione; non è necessario per il metodo URL diretto.
- **File/Recenti mostra più IPA con lo stesso nome:** scegliere la posizione esatta o usare l’URL diretto con tag sopra. Si può rinominare una copia locale includendo tag/build; rinominarla non cambia il contenuto.
- **L’app installata non si apre:** seguire richieste di fiducia sviluppatore o Modalità sviluppatore sul telefono. Controllare la scadenza in AltStore e rinnovare se serve. Registrare l’errore effettivo se persiste; il solo errore di connessione non giustifica eliminazione e reinstallazione.
- **OTT-play si apre ma una playlist protetta fallisce su rete cellulare:** installazione e autenticazione della fonte sono separate. Usare **Impostazioni → Gestisci impostazioni → Accesso alla fonte** per autenticarsi e poi ricaricare la playlist. Completare richieste biometriche/passkey o codice email sul dispositivo fisico. La fonte deve supportare [integrazione iOS Access](docs/ios-source-access.md); installare l’app non aggira una lista di IP consentiti.
- **Richiesta passkey su Wi-Fi attendibile:** per fonti integrate con iOS Access, l’app prova prima la fonte originale senza accesso e usa l’ingresso mobile autenticato solo dopo un rifiuto. Verificare l’IP pubblico realmente visto dalla fonte, incluso IPv6: un IPv4 domestico consentito non copre altro IPv6, VPN o indirizzo cellulare. Cambi di rete e riapertura cancellano la preferenza temporanea di percorso. Un generico errore rete/server non dovrebbe richiedere accesso.
- **L’accesso non appare più ma l’elenco è vuoto:** una sessione salvata valida viene riutilizzata senza richiedere credenziali. Dopo un caricamento fallito o correzione lato server, ricaricare la playlist o chiudere completamente e riaprire l’app una volta. Se persiste, verificare che la fonte restituisca una playlist e non una pagina HTML di accesso o errore JSON. Registrare errore e stato HTTP; non condividere URL con credenziali, cookie o token Access.
- **I canali si caricano ma il video resta in buffer o segnala `SRC_NOT_FOUND`:** caricamento playlist e riproduzione sono prove distinte. Riprovare una volta il canale dopo l’accesso; se persiste, verificare risposte del manifesto e segmenti HLS e supporto codec. Il solo errore non dimostra che cambiare motore o reinstallare aiuti.

<a id="option-2-testflight-if-available"></a>

#### Opzione 2: TestFlight (se disponibile)

Se viene pubblicato un invito TestFlight, installare TestFlight dall’App Store, aprire l’invito sul dispositivo e toccare **Installa**. Scaricare un IPA da GitHub non fornisce un invito.

<a id="option-3-xcode-for-developers"></a>

#### Opzione 3: Xcode (per sviluppatori)

Seguire [Compilare e aprire](docs/capacitor-mobile.md#build-and-open), selezionare la destinazione **App** in Xcode, configurare il team in **Signing & Capabilities**, scegliere il dispositivo collegato e compilare/eseguire. Completare fiducia e Modalità sviluppatore quando richiesto. Importare l’IPA non firmato nella finestra Devices di Xcode non fornisce identità di firma o profilo di provisioning mancanti.

---

<a id="android-application"></a>

### Applicazione Android

Scegliere l’APK Full Capacitor dalle release di questo repository per l’interfaccia condivisa. Usare l’APK compatibilità API 22 su Android 5.1–6; richiede WebView 60 o successivo. Conservare identità e certificato di firma durante gli aggiornamenti per mantenere i profili. Vedere [istruzioni di compilazione](android/README.md) e [distribuzione, firma e installazione remota](docs/android-distributions.md).

Il [repository ottplay-android](https://github.com/open-ott-play/ottplay-android) separato contiene l’app nativa Kotlin/Compose. Ha identità, preferenze e processo di rilascio propri e non sostituisce direttamente un’installazione Capacitor. Gli artefatti storici restano disponibili.

---

<a id="quick-start"></a>

## Avvio rapido

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

Per le prove del browser usare un proprio deployment della stessa revisione.

Usare Node 22 e la toolchain Rust stabile. Avviare il server dalla radice del repository per rendere disponibili gli asset statici. Le build native richiedono gli strumenti di piattaforma descritti sotto; non servono per la build del solo server.

Al primo caricamento scegliere **Prova la demo** oppure **Impostazioni → Cambia provider → Playlist M3U / M3U8**. Aprire **Seleziona playlist**, scegliere uno slot, inserire **URL playlist**, salvare e scegliere **Carica playlist**. Playlist e account provider sono forniti dall’utente; l’app non include abbonamenti a canali a pagamento.

<a id="mode-a-companion-smoke"></a>

## Verifica di base del server companion modalità A

Verifica tramite curl del companion modalità A (parità `ottplay-server` / `archive/server.py`): indice, directory statiche, `/logo`, `/version`, `/epg` opzionale e controllo di `POST /m3u/cp.php` senza scaricare dati dalla fonte.

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

I controlli sono in `scripts/modea-smoke-checks.json`. Nessun segreto. La coda comandi / `local_proxy.py` (:8081) è verificata separatamente da `scripts/smoke-command-queue.sh`, quando presente.

<a id="classic-stalker--ministra-portals"></a>

## Portali classici Stalker / Ministra

Scegliere **Portali Stalker** e inserire MAC rilasciato dal provider e URL completo, per esempio `http://provider.example/stalker_portal/c/`. Gli URL `/c/index.html`, `/stalker_portal`, `/server/load.php`, `/load.php` e `/portal.php` selezionano il protocollo MAG classico. Le configurazioni esistenti con solo indirizzo server mantengono JSON-RPC. Il provider carica profilo, generi e pagine di canali live tramite il nucleo Stalker condiviso, poi scopre in background i film del protocollo classico `type=vod` e gli episodi annidati. I percorsi delle cartelle diventano categorie nel normale Elenco canali; descrizioni e locandine disponibili e i preferiti globali stabili usano la stessa interfaccia multimediale. Vedere [comportamento e limiti del catalogo](docs/stalker-media.md).

Le richieste della versione browser ospitata autonomamente passano dall’endpoint `/stalker/api` del companion; le app native usano il trasporto HTTP esistente. Le versioni browser su hosting richiedono rotte configurate esplicitamente tramite il [relay dedicato](docs/stalker-relay.md). Gli asset del browser e del server devono essere aggiornati insieme.

La riproduzione live risolve i comandi temporanei del canale all’apertura del flusso; cambi di canale, stop, PiP e sostituzione provider annullano risoluzioni obsolete. I comandi HTTP(S) espliciti non temporanei si riproducono direttamente. È supportato l’EPG breve. L’archivio del portale classico e il dialetto separato `type=series` non sono esposti da questo provider. Il comportamento JSON-RPC esistente di archivio/guida non cambia. I portali LAN privati che usano la rotta del companion richiedono una voce esatta `OTTPLAY_PROXY_LAN_ORIGINS`, come le altre rotte proxy del companion.

La demo pubblica Infomir è `http://middleware-stalker.com/stalker_portal/c/`. Il 2026-09-26 restituiva tre voci live, ma gli endpoint multimediali non erano disponibili; usare portale/media controllati per test di regressione.

<a id="m3u-stream-proxy-header-smoke"></a>

## Verifica degli header proxy M3U

Confronta gli header delle richieste upstream inseriti da `POST /m3u/cp.php` del companion modalità A durante il recupero di un URL echo controllabile (mock locale predefinito — nessun provider IPTV o segreto).

Contratto (da `src-rs/core/src/m3u.rs` + `archive/server.py`):
- Inserisce solo **User-Agent** (`OTT-play-FOSS/1.0` predefinito o preset `webos` / `tizen` / `viera` / `mag` / `dune`).
- **Non** inserisce **Referer** (`M3UProxy` di Capacitor lo fa; modalità A no).
- Rimuove un `@` iniziale da `url` (formato jQuery del provider).

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

Uscita: `0` successo, `1` non in ascolto, `2` header/HTTP non corrispondenti, `3` utilizzo/dipendenze. Affianca `smoke-modea-companion.sh` / `smoke-command-queue.sh`.

<a id="logo-concurrent-bench-smoke"></a>

## Test concorrente dei loghi

Verifica della latenza di `GET /logo/<id>.svg` concorrenti (`?ch=` opzionale) sul companion modalità A. Riporta conteggi riusciti/falliti e p50/p95/p99. Il carico predefinito è pratico per CI locale (`CONCURRENCY=200`, `TOTAL=1000`); il test prolungato di 10.000 richieste è opzionale (`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`).

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

Uscita: `0` successo, `1` non in ascolto / connessione fallita, `2` alto tasso di errore, `3` utilizzo. Affianca `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`.

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## Verifica aggiornamento e riscaldamento cache XMLTV

Verifica il comportamento reale della cache XMLTV/EPG modalità A in `src-rs` (senza API inventate):

- `EPG_CACHE` in memoria servita tramite `GET /epg/:hash` → sempre `{"epg_data":[...]}` (HTTP 200).
- L’avvio recupera `EPG_URLS` in background senza ritardare HTTP; ogni recupero completato è seguito da **2 ore** di attesa prima dell’aggiornamento successivo.
- Persistenza SQLite opzionale con `DATABASE_URL` impostato (nessun endpoint pubblico per lo stato della cache).
- `GET /health` → `OK` conferma disponibilità HTTP dopo un riavvio opzionale. Con `--strict-epg` e `--epg-hash`, il test attende anche EPG non vuoto per quel canale nello stesso budget `--warmup-timeout`.

Il percorso predefinito usa solo curl — **non termina processi**. Passare `--restart-cmd` / `RESTART_CMD` per arresto e riavvio automatici oppure seguire i passaggi manuali `launchctl` in `--help`.

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

Uscita: `0` successo, `1` non in ascolto, `2` asserzione/riscaldamento falliti, `3` utilizzo. Affianca `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`.

<a id="mode-a-e2e-play-path-smoke"></a>

## Verifica end-to-end del percorso di riproduzione modalità A

Verifica lato companion di **percorso di riproduzione / disponibilità del flusso** (solo HTTP — **non** test UI end-to-end con finestra visibile). Sul companion modalità A attivo verifica:

- Health o indice raggiungibili.
- Asset statici della shell (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`).
- `GET /epg/<hash>.json` opzionale quando `EPG_HASH` è impostato.
- `POST /m3u/match-channels` con fixture JSON senza segreti (lista vuota + canale sintetico).
- **Riproduzione** del proxy: `POST /m3u/cp.php` verso una fixture controllabile (playlist HLS locale predefinita o `MEDIA_URL`), verificando HTTP 200 + corpo non vuoto / `Content-Type` atteso (primi byte attraverso il proxy).

Nessuna credenziale IPTV privata. Affianca `smoke-modea-companion.sh` (presenza), `smoke-m3u-stream-proxy-headers.sh` (UA/Referer), `smoke-xmltv-cache-refresh.sh`.

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

Uscita: `0` successo, `1` non in ascolto, `2` asserzione fallita, `3` utilizzo/dipendenze.

<a id="capacitor-device-smoke-mode-b"></a>

## Verifica dispositivo Capacitor (modalità B)

**Checklist** per simulatore/emulatore (dispositivo reale opzionale) modalità B Cap — non HTTP companion modalità A. L’operatore convalida la UI; l’assistente automatizza toolchain, directory native e curl della coda che può essere saltato senza errore.

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

Dettagli: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md). Affianca `smoke-command-queue.sh` (loopback Cap); non confondere con i test modalità A sopra.

<a id="tauri-desktop-smoke-mode-b"></a>

## Verifica desktop Tauri (modalità B)

Checklist desktop e assistente per modalità B Tauri (finestra / canale / PiP). Non è HTTP companion modalità A né verifica dispositivo Cap.

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

Dettagli: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md). Le credenziali sviluppatore Apple sono opzionali per la verifica locale; usare [firma ad hoc](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials) per un’app Mac impacchettata. L’accettazione umana verifica comunque avvio, riproduzione e PiP.

<a id="docker"></a>

## Docker

Le immagini multiarchitettura (amd64/arm64) sono costruite come archivi OCI candidati. La pubblicazione nel registro promuove l’archivio stabile approvato a Docker Hub senza ricompilare; vedere [manuale operativo](docs/release-workflow.md).

Il binario server è compilato su **musl** (Alpine) e distribuito su Alpine — **non** richiede GLIBC_2.38+. Ciò mantiene `alvit/ottplay-foss` eseguibile su Synology DSM Docker (x86_64) e host con glibc più vecchia.

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

I tag stabili del registro usano `X.Y.Z`. Aggiornare `latest` è un’opzione esplicita separata dopo la pubblicazione dell’immagine versionata; push su main e tag Git non pubblicano immagini.

<a id="build-from-source"></a>

## Compilare dai sorgenti

Le regole di dominio vengono dall’artefatto Kotlin multipiattaforma fissato in `vendor/ottplay-core.js`. Decisioni su guida, archivio, playlist, provider, stato duraturo e riproduzione condividono l’implementazione con FOSS2 e Android nativo. Gli adattatori browser/TV, Swift e Rust mantengono API dispositivo, codec, rete ed effetti UI. L’artefatto browser conserva sintassi ES5 e avvio delle API legacy supportate. `npm test`, `check:bundle` e `check:es5` verificano l’integrazione; il manifesto registra hash di sorgenti e output.

I validatori dei protocolli Control-server e SWOP sono generati dallo schema versionato `contracts/ottplay-wire-v1.json`. Ricevute del generatore verificate e fixture immutabili di compatibilità impediscono copie delle politiche specifiche dei consumatori.

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

## Rilevamento dispositivo

Il lettore supporta 24 tipi. Rilevamento prima tramite URL `/f/{device_id}/`, poi tramite User-Agent.

| ID dispositivo | Dispositivo |
|---|---|
| `pc` | Browser PC |
| `pc2` | Lettore web videojs |
| `nodejs` | App Windows (Electron) |
| `lg/webos` | TV LG WebOS |
| `samsung/tizen` | TV Samsung Tizen |
| `samsung/maple` | TV Samsung Orsay |
| `mag` | Decoder Infomir MAG |
| `dune` | Decoder Dune HD |
| `android` | Android TV / tablet |
| `hbbtv` | TV HbbTV |
| `panasonic` | TV Panasonic Viera |
| `philips` | TV Philips |
| `sony` | TV Sony |
| `sharp` | TV Sharp |
| `toshiba` | TV Toshiba |
| `hisense` | TV Hisense |
| `skyworth` | TV Skyworth |
| `tcl` | TV TCL |
| `vewd` | Dispositivi Vewd |
| `spark` | Ricevitori Spark |

<a id="push-command-system"></a>

## Sistema di comandi push

Per un servizio separato multidispositivo usare [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) e **Server comandi** in **Impostazioni → Controllo remoto**. Inserire IP/indirizzo e codice d’accesso del dispositivo; salvare entrambi avvia automaticamente il polling per volume, canali e altri comandi. Un IP senza porta usa HTTP 8081. Svuotare l’indirizzo o selezionare **Disconnetti** per fermarlo. Questa connessione in uscita supporta consegna confermata e non richiede listener locale. Vedere [connessione e compatibilità](docs/remote-command-server.md). Gli esempi seguenti descrivono il modo proxy/listener locale esistente.

**Trova server comandi** consente di individuare un controller e richiedere l’approvazione dell’operatore senza copiare un token del dispositivo. Tauri verifica prima il DNS nativo e, se il risultato è vuoto, può ricorrere a un profilo di distribuzione configurato esplicitamente; i lettori browser, LG e Capacitor usano il percorso del profilo browser. I metadati di rilevamento Home possono essere ospitati su here.now indipendentemente dal controller. Le build generiche non includono automaticamente quel profilo Home e gli aggiornamenti non sostituiscono le connessioni salvate. Vedere [comportamento delle piattaforme, configurazione del profilo e risoluzione dei problemi](docs/remote-command-server.md#discovery-and-one-time-approval).

Il controllo remoto HTTP locale è **disattivato per impostazione predefinita** nel browser/OTT server, Tauri e Capacitor. Attivarlo in **Impostazioni lettore → Controllo remoto** per generare un codice segreto. I comandi sono oggetti JSON con campo `"command"`; le richieste HTTP richiedono `Authorization: Bearer <device-code>`.

<a id="architecture"></a>

### Architettura

<a id="local-command-url-recommended"></a>

#### URL locale comandi (consigliato)

Attivare **Controllo remoto HTTP locale** in **Impostazioni lettore → Controllo remoto**, copiare il **Codice dispositivo** generato e configurare il proxy seguente. Impostare **URL locale comandi** sull’endpoint del proxy. Quando abilitato, il lettore interroga l’URL ogni dieci secondi con il codice nell’header Authorization. Impostare semplicemente un URL non abilita il controllo.

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### UUID dispositivo

L’UUID esistente (per esempio `dev_a1b2c3d4e5`) è metadato pubblico d’instradamento, non credenziale. Il **Codice dispositivo** distinto viene generato in sicurezza all’attivazione HTTP locale e rimane sul dispositivo; non viene copiato nelle impostazioni cloud. Disabilitare HTTP locale ferma polling/listener. Riabilitarlo genera un nuovo codice: aggiornare proxy e integrazioni per revocare quello precedente.

Tauri e Capacitor avviano il listener HTTP loopback solo dopo questa attivazione. I proxy inoltranti devono inviare al listener il codice mostrato come token Bearer. La modalità A usa la coda `local_proxy.py` configurata separatamente e descritta sotto.

<a id="remote-text-entry-swop"></a>

#### Inserimento remoto testo (swop)

Scopo: digitare sul telefono per ♥™ / tastiera virtuale remota quando TV e telefono sono **su reti diverse**, tramite passaggio di sessione Cloudflare Worker.

- Repository Worker: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop).
- **Autorizzazione installazione:** il lettore invia richieste al relay `/swop` della stessa origine del server. Il server aggiunge il proprio token privato; ogni client sull’origine registrata può usare la digitazione remota. Gli UUID identificano sessioni e non richiedono elenco dispositivi autorizzati.
- Impostazione: `swopBaseUrl` (vuota = ♥™ mostra «non configurato» / nessuna azione). Modificare in **Impostazioni → Controllo remoto** (tasto **2**) oppure iniettare tramite `/local/swop.json`, ignorato da Git, nelle installazioni operatore.
- `POST /session` include `clientId`, `caption` e `draft`; `POST /val` include `clientId`, `code` e il `sessionToken` restituito. L’URL del telefono contiene un token di scrittura distinto. I token di lettura restano nella memoria browser.
- **Installazione locale:** impostare `SWOP_BASE_URL` e `SWOP_INSTALLATION_TOKEN` dopo aver registrato installazione e origini LAN/localhost esatte nel Worker. `scripts/install-ottplay-local-service.sh` li conserva nel plist launchd privato con modalità 0600. Il `/local/swop.json` pubblico contiene solo `{"swopBaseUrl":"/swop"}`. Non mettere mai un token d’installazione negli asset pubblici.
- **Hosting statico:** configurare proxy autenticato lato server per gli stessi due endpoint. Conservare il token nei segreti dell’hosting. Copiare i file pubblici del lettore non copia questa credenziale server.

> Il server OTT centrale mantiene disabilitati `/api/webhook/commands`, `/webhook/poll`, `/webhook/notify` e alias health dei comandi per tutti i metodi HTTP. Usare il server comandi separato o un `local_proxy.py` autenticato configurato esplicitamente per modalità A; il server centrale non ha una coda broadcast.

<a id="available-commands"></a>

### Comandi disponibili

Gli esempi seguenti usano `http://192.168.1.50:8081/api/webhook/commands` come URL del proxy locale. Sostituirlo con quello reale e impostare `OTTPLAY_QUEUE_HTTP_TOKEN` sul **Codice dispositivo** mostrato dopo aver attivato HTTP nelle impostazioni. Il proxy deve usare lo stesso codice.

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — Mostrare notifica popup

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| Campo | Tipo | Predefinito | Descrizione |
|---|---|---|---|
| `message` | string | obbligatorio | Testo da mostrare |
| `popup_duration` | number | 5 | Secondi di visualizzazione (in alto a destra) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — Cambiare canale per posizione

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| Campo | Tipo | Predefinito | Descrizione |
|---|---|---|---|
| `channel_number` | number | obbligatorio | Posizione del canale nell’elenco, da 1 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — Cambiare canale per nome completo o parziale

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

Ricerca per sottostringa senza distinzione maiuscole/minuscole. Vince la prima corrispondenza.

| Campo | Tipo | Predefinito | Descrizione |
|---|---|---|---|
| `channel_name` | string | obbligatorio | Nome canale o parte del nome |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — Passare a un canale casuale

Questo comando precedente seleziona i canali idonei dall’elenco o dalla categoria corrente. I numeri dei canali e gli intervalli indicano le posizioni in quell’elenco; vedere le [regole di selezione casuale sicura](docs/remote-command-server.md#safe-random-playback).

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

| Campo | Tipo | Predefinito | Descrizione |
|---|---|---|---|
| `random_range` | [start, end] | elenco corrente | Intervallo con indici da 1 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — Cambiare provider IPTV

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| Campo | Tipo | Predefinito | Descrizione |
|---|---|---|---|
| `provider` | number | obbligatorio | Indice nell’array provider (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — Caricare nuova playlist M3U

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| Campo | Tipo | Predefinito | Descrizione |
|---|---|---|---|
| `playlist` | string | obbligatorio | URL della playlist M3U |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — Aggiornare configurazione provider

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| Campo | Tipo | Predefinito | Descrizione |
|---|---|---|---|
| `provider_settings` | string | obbligatorio | Stringa JSON con configurazione provider |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — Impostare o regolare volume

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

Ignorato senza avviso nei client privi di controllo volume.

| Campo | Tipo | Predefinito | Descrizione |
|---|---|---|---|
| `volume` | number | — | Livello assoluto 0–100 |
| `volume_step` | number | — | Variazione relativa, per esempio +10 o -5 |

<a id="player-standby-restart-and-exit"></a>

#### Standby, riavvio e uscita del lettore

La coda webhook senza conferme del proxy locale non supporta `exit_player` o richieste tipizzate standby/risveglio. Collegare il lettore al [server comandi](docs/remote-command-server.md) e usare la sua CLI:

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

Sostituire `d1` con l’alias registrato. `stop` è alias di `standby`; `start` e `wake` sono alias di `go`. Go richiede un lettore in esecuzione e connesso; non avvia un’app chiusa né risveglia un dispositivo offline. Browser o TV senza uscita nativa segnalano che non è supportata. Standby mantiene il polling remoto e non sospende attività estranee dell’host o server condiviso.

Dopo standby/go controllare `ott d1 status` per stato standby/background e verificare separatamente la ripresa. Dopo un reload confermare nuova istanza con `ott d1 doctor`. Dopo uscita, confermare tramite sistema operativo che il processo è terminato; un timeout remoto non prova l’uscita. L’accettazione del comando non conferma questi risultati.

<a id="local-proxy-server"></a>

## Server proxy locale

`local_proxy.py` è una coda autenticata autonoma per un lettore. L’invocazione predefinita termina senza aprire porte. Ogni istanza usa il codice generato dal lettore; per più lettori usare istanze/porte distinte. Il parametro `device_id` è accettato come metadato di compatibilità e non autentica né seleziona un altro dispositivo.

<a id="start-the-proxy"></a>

### Avviare il proxy

1. Attivare **Controllo remoto HTTP locale** nel lettore e copiarne il **Codice dispositivo**.
2. Sull’host proxy configurare codice e origine esatta del lettore (schema, host e porta, senza percorso):

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. Impostare **URL locale comandi** del lettore su `http://192.168.1.50:8081/api/webhook/commands`.

L’indirizzo di ascolto predefinito è `127.0.0.1`; l’esempio abilita esplicitamente LAN. `OTTPLAY_QUEUE_HTTP_ORIGINS` è l’elenco di origini browser esatte consentite, separate da virgole. Usare un reverse proxy HTTPS quando il lettore è servito su HTTPS, affinché le regole mixed-content consentano il polling. Tenere segreto il codice e fuori dagli URL. Quando il lettore genera un codice nuovo, riavviare il proxy col nuovo valore; disabilitare solo il lettore non ferma il processo proxy gestito separatamente.

<a id="endpoints"></a>

### Endpoint

| Metodo | Percorso | Descrizione |
|---|---|---|
| `POST` | `/api/webhook/commands` | Accodare un comando |
| `GET` | `/api/webhook/commands` | Recuperare i comandi (polling lettore) |
| `POST` | `/webhook/notify` | Alias di compatibilità autenticato |
| `GET` | `/webhook/poll` | Alias di compatibilità autenticato |

Invio e prelievo richiedono entrambi il codice Bearer corrispondente. Non esiste endpoint broadcast non autenticato. I comandi scadono dopo 60 secondi; ogni proxy ne conserva al massimo 50.

Il proxy gestisce fino a 16 connessioni concorrenti, quindi una connessione browser inattiva o richiesta incompleta non ritarda le altre. Ogni socket ha timeout d’inattività di cinque secondi; le connessioni aggiuntive vengono chiuse quando tutti i worker sono occupati. Inserimento e prelievo sono atomici fra worker.

<a id="smoke-script-all-modes"></a>

### Script di verifica (tutte le modalità)

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Emulatore/dispositivo Android: prima `adb forward tcp:18081 tcp:18081`. Cap/Tauri sono solo loopback — usare questo proxy modalità A per Home Assistant LAN. Dettagli: `docs/capacitor-mobile.md`, sezione Smoke test.

<a id="cors"></a>

### CORS

Il proxy consente richieste browser solo da `OTTPLAY_QUEUE_HTTP_ORIGINS`. Le richieste preflight `OPTIONS` da origine consentita non richiedono token; ogni GET/POST effettivo richiede il codice Bearer. Origini wildcard e `null` non sono accettate. Home Assistant e altri client non-browser possono omettere Origin, ma richiedono comunque autenticazione.

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### Esempio: webhook Home Assistant → proxy locale → lettore

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

### Esempi di automazioni Home Assistant

Gli esempi popup, canale e volume usano il proxy locale. Impostare `ottplay_device_authorization` in `secrets.yaml` di Home Assistant su `Bearer <device-code>` con il codice mostrato dal lettore abilitato.

Lo standby notturno usa il [server comandi](docs/remote-command-server.md) separato. Sostituire URL d’esempio e `DEVICE_UUID` con indirizzo controller e ID registrato; l’alias locale CLI `d1` non è ID dispositivo. Impostare `ottplay_control_authorization` su `Bearer <controller-admin-token>` in `secrets.yaml`. È una credenziale distinta dal codice del proxy locale. Vedere Home Assistant [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) e [segreti](https://www.home-assistant.io/docs/configuration/secrets/).

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

`standby_request` contiene la risposta HTTP per la traccia dell’automazione. HTTP 202 significa solo accodato: conservare `content.id`, poi interrogare `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` con la stessa credenziale per la risposta del lettore. Una nuova richiesta `status` osserva `player.standby` e `player.background`; standby attivo con `suspended` e zero pendenti conferma che il lavoro tracciato è terminato. Per uscire da standby usare la stessa richiesta tipizzata con `"operation":"wake"` (`ott d1 go`). Non ripetere ciecamente mutazioni dopo un timeout. Vedere [API richiesta/risposta](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) e [semantica standby](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake) del controller.

<a id="server-api-reference"></a>

## Riferimento API server

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Endpoint webhook (Rust `ottplay-server`)

Il server Rust e il fallback Python archiviato rifiutano gli endpoint comandi con HTTP 403. `/api/webhook/commands`, `/webhook/notify`, `/webhook/poll` e alias health non accodano, trasmettono o prelevano comandi. L’API generica feedback non può sovrascrivere queste rotte riservate. La consegna modalità A usa il server comandi o proxy locale autenticato configurati separatamente sopra.

<a id="other-endpoints"></a>

### Altri endpoint

| Metodo | Percorso | Descrizione |
|---|---|---|
| `GET` | `/epg/<hash>.json` | Dati EPG del canale |
| `GET` | `/logo/<id>.svg` | Logo canale generato |
| `GET` | `/version/<path>` | Hash versione file |
| `POST` | `/m3u/match-channels` | Associazione canali/EPG |
| `POST` | `/m3u/match-logos` | Associazione loghi |
| `POST` | `/m3u/cp.php` | Proxy flusso |
| `GET/POST` | `/feedback/` | Registro feedback |
| `GET` | `/tmdb/*` | Proxy API TMDb |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## Struttura del progetto

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

## Mappature tasti STB

- **Samsung Tizen**: `RETURN=10009`, `ENTER=13`, colori 403–406.
- **Samsung Maple**: croce direzionale 4/5/6/8, codici SDK originali.
- **LG WebOS**: `RETURN=461`, colori compatibili HbbTV.
- **LG NetCast**: `RETURN=8`, codici HbbTV.
- **MAG**: `RETURN=8`, API gSTB per MAC.
- **Dune HD**: codici standard, API Dune.
- **Android TV**: codici Android (`BACK=4`, `DPAD_*` 19–22, `ENTER=66`).
- **HbbTV/Panasonic/Philips/Sony/ecc.**: codici HbbTV (`RED=403`, `BLUE=406`, `VOL_UP=447`).

<a id="documentation"></a>

## Documentazione

- [Wiki documentazione](./docs/wiki/Home.it.md) / [Wiki in russo](./docs/wiki/Home.ru.md) — navigazione per attività e regole di manutenzione.
- [Rapporto d’implementazione](./docs/implementation-report.it.md) / [Processo e risultato in russo](./docs/implementation-report.ru.md) — diagrammi colorati, comportamento verificato, costo misurato e controlli di rilascio.
- [Guida alla distribuzione](./docs/roadmap-delivery.it.md) / [Nuove funzionalità in russo](./docs/roadmap-delivery.ru.md) — funzioni, limiti e verifiche.
- [Guide rapide in 88 lingue d’interfaccia](./docs/readme/README.md) — generate dalle traduzioni distribuite; manuale principale e guide abbinate sono disponibili in [24 lingue di documentazione](docs/manual-translations.md), mentre gli altri riferimenti tecnici conservano le lingue esistenti.
- [Limiti di qualità e recupero live](./docs/playback-stream-policy.it.md) / [In russo](./docs/playback-stream-policy.ru.md).
- [Associazione manuale XMLTV e accessibilità classica](./docs/guide-binding-accessibility.it.md) / [In russo](./docs/guide-binding-accessibility.ru.md).
- [Verifica audio/video ospitata](./docs/audio-video-check.it.md) / [In russo](./docs/audio-video-check.ru.md).
- [Raccolta Xtream](./docs/xtream-media.it.md) / [In russo](./docs/xtream-media.ru.md).
- [Passaggio tra dispositivi della stessa fonte](./docs/remote-handoff.it.md) / [In russo](./docs/remote-handoff.ru.md).
- [Impostazioni locali recuperabili](./docs/settings-recovery.it.md) / [In russo](./docs/settings-recovery.ru.md).
- [Generazioni browser, sistemi e verifiche della release candidate esatta](docs/browser-compatibility.it.md) / [In russo](docs/browser-compatibility.ru.md).

- [Architettura lettore](./docs/architecture.md) — responsabilità runtime, integrazione provider, riproduzione, guida, adattatori e contratti di build.
- [Pipeline classica ES5](./docs/build-pipeline.md) — compilazione, compatibilità e limiti dimensionali.
- [Nomi asset runtime e migrazione deployment](./docs/asset-layout.md) — percorsi descrittivi condivisi da pacchetti web e nativi.
- [Banco di lavoro remoto](./docs/remote-workbench.md) — ispezione UI/media, ricevute operative ed evidenze salvate.
- [Diagnostica runtime](./docs/runtime-debug.md) — cronologia errori, contatori frame/cicli, metriche native Capacitor/Tauri e debug server.
- [Distribuzione locale macOS](./docs/macos-local-delivery.md) — build da checkout, installazione e verifica locali.

<a id="license"></a>

## Licenza

[MIT](LICENSE) — libero e open source. Contenuti dei provider e dipendenze terze mantengono diritti e licenze propri.

L’applicazione separata [OTTPlay native webOS](docs/native-webos.md), derivata da PlxNative, è distribuita con licenza **GPL-3.0-or-later** insieme al codice sorgente corrispondente.
La licenza MIT nella radice del progetto non modifica la licenza di questa applicazione nativa né delle relative patch.

<a id="desktop-updater--notarization-mode-b"></a>

## Aggiornamento desktop / notarizzazione (modalità B)

La [guida alla firma e aggiornamento desktop](docs/tauri-updater-notarize.md) descrive firma ad hoc macOS, Developer ID/notarizzazione opzionali e verifica del bundle. Il CI di rilascio usa ad hoc senza credenziali Apple. La firma dell’updater è separata; gli aggiornamenti automatici di produzione restano non configurati.

<a id="local-mac-build-helpers"></a>

## Assistenti di build locale Mac

Vedere [docs/local-build-scripts.md](docs/local-build-scripts.md).

<a id="privacy"></a>

## Privacy

Leggere la [politica sulla privacy](docs/privacy-policy.md) per impostazioni locali, servizi configurati e scelte. Contatto privacy e supporto: [alvit.work@gmail.com](mailto:alvit.work@gmail.com).

Studio 2026 è il tema predefinito. Classic e PLi-HD restano selezionabili e le preferenze salvate sono conservate. Vedere [impostazioni interfaccia](docs/interface-settings.md). PLi-HD riconosce Vali, littlesat, VU+NL, Milo e i contributori originali. [Crediti interfaccia e storia del design](docs/interface-history.md) contiene storia in inglese e fonti, accessibili anche dal menu informazioni.

<a id="demo-video-editing"></a>

## Montaggio video dimostrativi

Usare il [flusso locale video-use](docs/demo-video.md) per preparare e montare registrazioni dimostrative. L’assistente conserva tutti i media generati fuori da Git.

<a id="plex-media-library"></a>

## Raccolta multimediale Plex

Ogni lettore può collegarsi a un account Plex o Plex Media Server con il provider **Plex**. L’integrazione usa Plex; Synology è un possibile host del server media. Tutti i video e i brani musicali accessibili appaiono automaticamente nell’elenco dei canali; la selezione della categoria filtra per libreria, cartella o serie. La riproduzione parte dal primo lotto utilizzabile con caricamento in background, ricerca standard e azioni casuale/ripeti, senza configurare Plex sul server OTT. Vedere [accesso Plex e riproduzione diretta](docs/plex-provider.md).

![Caricamento Plex, navigazione file e ciclo di arresto](docs/images/plex-playback-lifecycle.svg)

La [revisione illustrata di affidabilità](docs/plex-provider.md#reliability-review-process-and-results) spiega regole di caricamento/annullamento, correzioni per cataloghi completi e cambio file, risultati misurati Chromium/WebKit.

Un’integrazione opzionale del server OTT espone inoltre catalogo di un server Plex esistente e riproduzione compatibile tramite voce separata della raccolta NAS ed esportazione M3U. Vedere [configurazione raccolta server e accesso client](docs/synology-library.md).

<a id="related-repositories"></a>

## Repository correlati

- [ottplay-core](https://github.com/open-ott-play/ottplay-core) gestisce logica di dominio JVM/ES5 condivisa, contratti di comunicazione e client FOSS2. Il lettore usa artefatti generati; seguire la guida di distribuzione del nucleo per modifiche condivise.
- [ottplay-android](https://github.com/open-ott-play/ottplay-android) è l’app nativa Kotlin/Compose separata, con identità proprie d’installazione e rilascio.
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server) fornisce comandi remoti self-hosted; [ottplay-swop](https://github.com/open-ott-play/ottplay-swop) un trasporto opzionale del testo basato su Worker.
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine) gestisce profilo ospitato della demo browser, media dimostrativi e verifica della pubblicazione.

<a id="project-maintenance"></a>

## Manutenzione progetto

Vedere [requisiti di contribuzione e test](CONTRIBUTING.md), [politica segnalazioni sicurezza](SECURITY.md), [progettazione sicurezza](docs/security-design.md) ed [evidenze OpenSSF e criteri rimanenti](docs/openssf-evidence.md).
