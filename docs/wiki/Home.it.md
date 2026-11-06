<a id="ott-play-documentation-wiki"></a>

# Wiki della documentazione OTT-play

<!-- language-navigation:start -->
<p dir="ltr">
<a href="Home.md" lang="en" dir="ltr">English</a> · <a href="Home.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="Home.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="Home.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="Home.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="Home.es.md" lang="es" dir="ltr">Español</a> · <a href="Home.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="Home.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="Home.he.md" lang="he" dir="rtl">עברית</a> · <a href="Home.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="Home.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="Home.it.md" lang="it" dir="ltr">Italiano</a> · <a href="Home.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="Home.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="Home.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="Home.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="Home.pt.md" lang="pt" dir="ltr">Português</a> · <a href="Home.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="Home.th.md" lang="th" dir="ltr">ไทย</a> · <a href="Home.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="Home.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="Home.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="Home.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="Home.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[README](../../README.it.md) · [Tutte le lingue dell’interfaccia](../readme/README.md)

Questa è la pagina iniziale della documentazione versionata nel repository sorgente. GitHub può visualizzare direttamente queste pagine Markdown; mantenerle qui consente di revisionare istruzioni, diagrammi e test insieme al codice. La [Wiki GitHub](https://github.com/open-ott-play/ottplay-foss/wiki) separata viene esportata da queste fonti e indica la revisione sorgente in ogni pagina. Consulta le [istruzioni di pubblicazione](../wiki-publishing.md).

<a id="start-and-install"></a>

## Avvio e installazione

- [Guida pratica](../../README.it.md), disponibile in [24 lingue della documentazione](../manual-translations.md).
- [Guide rapide localizzate per tutte le 88 lingue dell’interfaccia](../readme/README.md). Riutilizzano etichette tradotte e passaggi di navigazione. Non sono 88 manuali tecnici tradotti. Il manuale principale e le guide alle funzioni abbinate hanno edizioni complete in 24 lingue.
- [Pacchetti e aggiornamenti Android Full/API 22](../android-distributions.md), [build Android](../../android/README.md) e [Capacitor iOS/Android](../capacitor-mobile.md).
- [Distribuzione desktop su macOS](../macos-local-delivery.md), [firma/aggiornamento Tauri](../tauri-updater-notarize.md) e [istanze HTTP locali](../local-http-deployment.md).

<a id="process-and-results"></a>

## Processo e risultati

- [Qualificazione browser e verifica del candidato](../browser-compatibility.it.md) ([Русский](../browser-compatibility.ru.md)): destinazioni configurate, diagrammi a colori, controlli sui pacchetti esatti e risultati locali separati.

- [Rapporto d’implementazione e diagrammi a colori](../implementation-report.it.md) ([Русский](../implementation-report.ru.md)): modifiche revisionate, regressioni corrette, risultati misurati e criteri di rilascio ancora da superare.

<a id="use-the-new-capabilities"></a>

## Usare le nuove capacità

- [Distribuzione delle funzioni e limiti delle piattaforme](../roadmap-delivery.it.md) ([Русский](../roadmap-delivery.ru.md)).
- [Limiti di qualità, alternative esplicite per le dirette e recupero limitato](../playback-stream-policy.it.md) ([Русский](../playback-stream-policy.ru.md)).
- [Associazione XMLTV manuale e accessibilità classica](../guide-binding-accessibility.it.md) ([Русский](../guide-binding-accessibility.ru.md)).
- [Controllo ospitato di immagine e suono](../audio-video-check.it.md) ([Русский](../audio-video-check.ru.md)): **Informazioni → Audio → Riproduci**, toni attesi, diagramma dell’hosting e ritorno alla TV in diretta. Il filmato è scaricato su richiesta, richiede Internet e non è nei pacchetti del lettore. La dimostrazione online separata con motivi in movimento è silenziosa.
- [Libreria film/serie Xtream](../xtream-media.it.md) ([Русский](../xtream-media.ru.md)).
- [Passaggio tra lettori con la stessa sorgente](../remote-handoff.it.md) ([Русский](../remote-handoff.ru.md)).
- [Registro locale delle impostazioni e recupero](../settings-recovery.it.md) ([Русский](../settings-recovery.ru.md)).
- [Controllo affidabile, profili riprendibili e passaggio](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.md) ([Русский](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.ru.md)). Richiede una revisione compatibile del controller/CLI e autorizzazioni configurate.
- [Preferenze semantiche audio/sottotitoli in Android nativo](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.md) ([Русский](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.ru.md)). L’applicazione Kotlin nativa è separata dagli APK Capacitor di questo repository.

<a id="configure-sources-and-inspect-problems"></a>

## Configurare le sorgenti e analizzare i problemi

- [Accesso e riproduzione Plex](../plex-provider.md), [architettura della guida](../guide-architecture.md) e [diagnostica EPG ospitata](../hosted-epg-diagnostics.md).
- [Impostazioni dell’interfaccia](../interface-settings.md), [storia del design e riconoscimenti](../interface-history.md) e [cataloghi linguistici/tastiere](../localization.md).
- [Banco di lavoro remoto](../remote-workbench.md), [diagnostica runtime](../runtime-debug.md) e [consenso, oscuramento e conservazione della diagnostica](../diagnostic-security.md).
- [Lista di controllo dispositivi nativi](../mode-b-device-smoke.md), [lista dispositivi Tauri](../mode-b-tauri-smoke.md) e [controlli della finestra del browser](../browser-window-controls.md).

- [Costo misurato delle funzioni](../roadmap-size.it.md), dati grezzi e grafico SVG.

<a id="develop-and-release"></a>

## Sviluppo e rilascio

- [Architettura e responsabilità](../architecture.md), [sessioni di riproduzione](../playback-session-architecture.md) e [build ES5 classica](../build-pipeline.md).
- [Nomi delle risorse runtime](../asset-layout.md), [politica di rilascio](../../RELEASING.md), [manuale operativo dei rilasci](../release-workflow.md) e [fuzzing RC](../../FUZZING.md).
- [Informativa sulla privacy](../privacy-policy.md) e [licenza MIT](../../LICENSE).

Quando modifichi la documentazione, esegui `npm run docs:generate` se cambia un’etichetta dell’interfaccia o un modello di guida rapida, poi `npm run check:docs`. Mantieni complete tutte le traduzioni, metti i limiti delle capacità accanto alle affermazioni e distingui la validazione locale dai test sui dispositivi fisici. I diagrammi sono risorse revisionabili del repository; consulta [l’SVG dell’associazione alla guida](../images/guide-binding.svg) e i diagrammi collegati nelle guide. Il controllo valida le destinazioni relative dei file, non la disponibilità dei siti remoti né ogni ancora dei titoli Markdown.
