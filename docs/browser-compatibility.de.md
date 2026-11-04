<a id="browser-generations-and-operating-systems"></a>

# Browsergenerationen und Betriebssysteme

<!-- language-navigation:start -->
<p dir="ltr">
<a href="browser-compatibility.md" lang="en" dir="ltr">English</a> · <a href="browser-compatibility.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="browser-compatibility.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="browser-compatibility.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="browser-compatibility.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="browser-compatibility.es.md" lang="es" dir="ltr">Español</a> · <a href="browser-compatibility.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="browser-compatibility.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="browser-compatibility.he.md" lang="he" dir="rtl">עברית</a> · <a href="browser-compatibility.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="browser-compatibility.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="browser-compatibility.it.md" lang="it" dir="ltr">Italiano</a> · <a href="browser-compatibility.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="browser-compatibility.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="browser-compatibility.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="browser-compatibility.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="browser-compatibility.pt.md" lang="pt" dir="ltr">Português</a> · <a href="browser-compatibility.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="browser-compatibility.th.md" lang="th" dir="ltr">ไทย</a> · <a href="browser-compatibility.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="browser-compatibility.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="browser-compatibility.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="browser-compatibility.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="browser-compatibility.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[Gemessene Ergebnisse](implementation-report.de.md#browser-gate-integration)

![Konfigurierte Browserqualifikation: 35 Ziele, 166 Szenarioausführungen](diagrams/browser-qualification.svg)

Die vorhandenen Prüfungen für Geräte, Medien, altes ES5/Worker-Verhalten, native Oberflächen und Apples natives HLS bleiben verpflichtend. Der gemeinsame TypeScript-Workflow führt zusätzlich die Plex-Szenarien gegen exakt das gepackte Mode-A-Archiv aus: zwei lokalisierte Lade-/Neuladeabläufe, Beibehaltung des Seitenverhältnisses mit HLS.js und Video.js bei Medienwechsel und Neuladen sowie natürlicher Episodenabschluss im strikten Kioskmodus mit HLS.js. Die Medienszenarien verwenden echte Dekodierung; alle Szenarien verwenden echtes DOM und Eingaben. Nur Plex-Daten und Medienquelle sind synthetische lokale Testdaten.

Der Seitenverhältnis-Testdatensatz verpackt den versionierten H.264/AAC-Transportstrom ohne Neucodierung in getrennte fMP4-Varianten. Seine Initialisierungsheader verwenden die Marke `iso6` und Film-/Spurdauern von null, wie in [RFC 8216 Abschnitt 3.3](https://www.rfc-editor.org/rfc/rfc8216#section-3.3) verlangt. Der AVC-Sample-Eintrag verwendet außerdem die vorgeschriebenen reservierten Bits bei der SPS-Anzahl und die vorzeichenbehaftete Konstante `-1` im abschließenden Feld `pre_defined`. Damit wird die Containersyntax korrigiert, die der festgelegte Testdaten-Muxer erzeugt. Ein Testdatenvertrag prüft diese Header, weist fehlerhafte Boxen zurück und bestätigt zugleich, dass Codec-Parametersätze, Spur-IDs, Zeitskalen und Medienfragmentbytes unverändert bleiben. Das validiert die synthetische Eingabe; es beweist allein weder Browserwiedergabe noch ersetzt es die vollständige RC-Matrix.

Pull Requests erfordern aktuelles Chromium, Firefox und WebKit unter Linux, Chromium unter Windows und WebKit unter macOS. Nightly- und Beta-Builds erfordern dieselben fünf Ziele. Die RC-Qualifikation erfordert alle 35 deklarierten Ziele: drei exakte Playwright-/Browsergenerationen unter Linux, Windows und macOS, dazu installiertes stabiles Chrome/Edge auf allen drei Systemen und Beta-Chrome/Edge unter Linux. Die beiden historischen macOS-WebKit-Ziele (Playwright 1.62.1 und 1.63.0) verwenden `macos-15-intel`; ihre Nachweise erfassen die tatsächliche Prozessarchitektur und weisen ARM-Runner zurück. Die direkte MSE-Diagnose zeigte, dass dieselben H.264-Initialisierungs- und Mediendaten auf Intel mit 1.63 und auf ARM mit 1.64 vollständig verarbeitet wurden, während älteres WebKit in der macOS-15-ARM-VM vor `updateend` hängen blieb. Containerwechsel, ManagedMediaSource oder ein geöffnetes Browserfenster behoben das nicht. Diese beiden Ziele müssen weiterhin alle fünf ursprünglichen Wiedergabe-/UI-Szenarien erfüllen. Die Runnerwahl ist keine Aussage über jedes physische macOS-Gerät oder natives Safari. Eine Neugenerierung des Inventars muss diese geprüften Runner-Ausnahmen erhalten; der Profilvertrag weist ihre Entfernung zurück.

Alle drei Linux-WebKit-Generationen verwenden ausdrücklich den x64-Runner `ubuntu-26.04`. Der geprüfte Vergleich offizieller Laufzeitumgebungen reproduzierte den Fehler beim Übergang im strikten Kioskmodus unter Ubuntu 24.04, während derselbe Kandidat mit fünf unveränderten Szenarien unter Ubuntu 26.04 viermal hintereinander bestand. Damit wird eine konsistente unterstützte Laufzeit gewählt, ohne einzelne Multimedia-Bibliotheken auszutauschen oder Wiedergabeprüfungen abzuschwächen. Die anderen Linux-Browserziele behalten ihre vorhandenen Runner. Siehe [Qualifikation der Linux-WebKit-Laufzeit](linux-webkit-runtime.md) für genaue Quelle, Artefakt, Vergleichsergebnisse und Grenzen. Die vollständige RC-Matrix und die separate Abnahme nativer Pakete bleiben erforderlich.

Die getesteten Produktversionen werden zur Laufzeit erfasst. Playwright Firefox ist dessen gepatchter Build, keine Aussage über natives Firefox ESR; WebKit ist nicht Safari. Diese Matrix ersetzt keine Qualifikation auf physischen Fernsehern oder nativen Shells.

Das gesamte Inventar umfasst **35 Plattformziele: 32 HLS-fähige Ziele und drei Windows-WebKit-Ziele nur für die Oberfläche**. Letztere müssen weiterhin beide lokalisierten Lade-/Neuladeabläufe bestehen; ihr WebKit-Build besitzt weder MediaSource noch natives HLS. Das ist eine deklarierte Einschränkung, keine bestandene Wiedergabeabdeckung. Die drei exakten Ziel-IDs werden in `scripts/browser-compatibility-profile.cjs` geprüft. Vor ihren UI-Tests muss eine Fähigkeitsprüfung die Einschränkung bestätigen. Wird MSE einschließlich ManagedMediaSource oder natives HLS verfügbar, schlägt die Schranke fehl, bis das Profil aktualisiert wird. Jedes andere Ziel benötigt H.264- und AAC-MSE-Unterstützung sowie alle fünf unveränderten Szenarien; der Verlust einer Fähigkeit führt zum Fehlschlag statt zu einer kleineren Testsuite. Die Fähigkeitsprüfung lädt die HLS-Bibliothek des Kandidaten und prüft das Backend, das der festgelegte Instanzstandard auswählt: MediaSource, dann ManagedMediaSource, dann WebKitMediaSource. Der Nachweis nennt Backend und HLS-Version; ein geänderter Standard oder eine geänderte Version verlangt eine ausdrückliche Prüfung des Testvertrags.

Ein vollständiger RC erfordert daher **166 erfolgreiche Szenarioausführungen** (32 × 5 + 3 × 2) und 35 Zielnachweise. Die PR-/Nightly-/Beta-Teilmenge bleibt bei fünf Zielen und 25 Szenarioausführungen. Jeder Nachweis enthält den exakten Szenariosatz, die Fähigkeitsprüfung und entweder bestandene HLS-Abdeckung oder den ausdrücklichen Grund fehlender Unterstützung. Das sind konfigurierte Anforderungen, keine Behauptung, ein bestimmter RC habe sie bereits erfüllt. Die Einschränkung wird durch die von Playwright 1.64 verwendete [WebKit-Windows-Buildkonfiguration](https://github.com/WebKit/WebKit/blob/56453fdfe0b0ca6258c23e6453b34f70b885d13f/Source/cmake/OptionsWin.cmake#L75) und die festgelegte Laufzeitprüfung bestätigt.

Beide Wege laden die exakte Artefakt-ID des erzeugenden Jobs im aktuellen Lauf herunter. Archivprüfsummen, Quellcommit, Hashes gepackter Bundles/Provider, Dateitypen und Pfade werden geprüft, bevor ein frisch entpacktes Verzeichnis bereitgestellt wird. Release-Prüfungen kontrollieren auch den eingefrorenen Build-Nachweis. Browserjobs bauen den getesteten Code nicht neu und installieren nur Produktionsabhängigkeiten. Der Testserver benötigt weiterhin das vollständige Providerinventar aus den Quellen; der Compiler wird erst beim tatsächlichen Zusammenstellen eines Bundles geladen, nicht beim Lesen seiner Inventarkonstanten. Fehlgeschlagene, übersprungene, veraltete oder fehlende Szenarionachweise lassen die gemeinsame Schranke scheitern. Traces, tatsächliche Laufzeitidentität und Kandidaten-Digest werden für jedes Ziel aufbewahrt.

Die sieben erzeugten Inventar-/Lockdateien stammen aus `venus-os-ci-toolkit/scripts/prepare_browser_compatibility.py`. Anwendungs- und historische Browserpakete haben getrennte Lockdateien. GitHub-gehostete Runner bleiben der Standard; der gemeinsame Workflow erhält die vorbereitete Linux-Reserveauswahl, während Windows-/macOS-Ziele ihr natives Betriebssystem benötigen.

Das gemeinsame Release-Urteil prüft jedes ausgewählte Ziel samt Quell-SHA, Lauf, Versuch, Kanal und exakter Kandidaten-Artefakt-ID. Ein RC darf nicht die Beta-Nachweise der fünf Ziele verwenden. Die Stable-Freigabe übernimmt die akzeptierten RC-Bytes. Nach einem Fehler muss der gesamte Qualifikationsworkflow erneut laufen; Nachweise älterer Versuche können keine neue Qualifikation vervollständigen.

## Diagnosedaten zum Abschluss

Nach dem Laden der Laufzeitumgebung und der Kandidatenmetadaten schreibt
`scripts/browser-acceptance.cjs` die Datei `acceptance-terminal.json` nach
`CI_BROWSER_DIAGNOSTICS`, wenn die Abnahmeprüfung endet oder eine Ausnahme auslöst.
Der Datensatz enthält die letzte Phase, die Identität der Quellen und des Kandidaten,
das Browserziel, Lauf und Versuch, die verstrichene Zeit sowie den Exit-Status des
Testprozesses, ein Signal oder einen Fehlercode aus einer Positivliste. Er ist kleiner
als 2 KiB und enthält keine unbearbeiteten Fehler, URLs, stdout/stderr, Umgebungswerte
oder Speicherabbilder. Die Datei wird mit exklusivem Zugriff und dem Modus `0600` im
bestehenden Ausgabeverzeichnis des Jobs angelegt; eine vorhandene Datei oder ein
symbolischer Link am endgültigen Dateipfad wird nicht überschrieben.

Dies sind **Diagnosenachweise, keine erfolgreiche Abnahme**. Der Datensatz weist
immer `acceptance: false` aus; nur die separate Datei `CI_BROWSER_EVIDENCE` kann einen
Kandidaten qualifizieren, nachdem alle bestehenden Prüfbedingungen erfüllt sind.
Ein fehlgeschlagener Diagnose-Schreibvorgang darf das ursprüngliche Erfolgs- oder
Fehlerergebnis nicht ersetzen. Ein abruptes Ende des Wrapper-Prozesses oder ein Fehler
beim vorherigen Laden der Metadaten kann dazu führen, dass kein Datensatz entsteht.
Ein Signal des Testprozesses beweist nicht, dass der Inhaltsprozess von Firefox dieses
Signal erhalten hat. Die Zuordnung eines nativen Absturzes erfordert weiterhin einen
passenden nativen Stack oder eine kontrollierte Reproduktion; ein erfolgreicher
Wiederholungsversuch schließt die Untersuchung nicht ab.

Dieses Hilfsprogramm aktiviert weder unbearbeitete Firefox-Absturzberichte noch die
Protokollierung mit `DEBUG=pw:browser`. Browserspeicher und Konsolenausgabe können
vertrauliche Daten enthalten und dürfen ohne gesondert geprüfte Regeln für Erfassung
und Zugriff nicht in gewöhnliche hochgeladene Artefakte kopiert werden. Szenarioreihenfolge,
festgelegte Browserversionen, ein Worker, keine Wiederholungsversuche und die bestehenden
Zeitlimits bleiben unverändert.

<a id="from-source-to-accepted-candidate"></a>

## Von den Quellen zum akzeptierten Kandidaten

![Quellen, Paketprüfung, Fähigkeitsprüfungen und Nachweise](diagrams/candidate-verification-flow.svg)

1. Bauen Sie die geprüften Quellen und verpacken Sie die erzeugten Mode-A-Dateien. Bewahren Sie Archivprüfsumme und Quellidentität beim Kandidaten auf.
2. Prüfen Sie vor dem Entpacken die begrenzte Archivgröße, sichere Pfade, Dateitypen, Quelle/Version und das vollständige Hashinventar von Einstieg und Providern. Die Release-Qualifikation prüft zusätzlich den eingefrorenen Build-Nachweis.
3. Ermitteln Sie die tatsächliche Browserversion und Medienfähigkeiten. Wählen Sie das deklarierte Profil; eine Abweichung lässt den Test scheitern, statt die Abdeckung still zu reduzieren.
4. Führen Sie den exakten Szenariosatz gegen die entpackten Dateien aus, ohne Neubau. Jedes Szenario muss genau einmal ohne Überspringen, Fehler oder Wiederholung bestehen.
5. Bewahren Sie Laufzeit, Fähigkeiten, Kandidaten-Digest und Szenarioergebnisse auf. Vor Annahme der Nachweise prüft die gemeinsame Schranke die erforderlichen Ziele und übereinstimmenden Lauf, Versuch und Quelle. Release-Koordination und Geräteabnahme bleiben eigene Bedingungen.

<a id="what-has-been-measured-locally"></a>

## Was lokal gemessen wurde

![Lokale Integrationsprüfung: getrennte Geräte- und Paket-Browsersuiten](diagrams/browser-verification-results.svg)

Beim Quellstand `c52f4d07` bestand der vollständige Chromium-Gerätebrowserlauf 196 Tests mit einem erwarteten Überspringen für natives HLS. Separat bestand dasselbe gepackte Mode-A-Archiv je fünf Szenarien in Chromium 156.0.8078.4, Firefox 157.0 und WebKit 27.2: 15 Erfolge, keine Überspringungen oder Wiederholungen. Das sind unterschiedliche Testsuiten; ihre Zählwerte sind weder eine Abdeckungsquote noch ein Beweis für das Bestehen aller 35 gehosteten Ziele.

Die [gespeicherten Nachweise](evidence/post779-local-acceptance/summary.json) identifizieren den tatsächlichen Host mit macOS 26.7.1. Sie unterscheiden ihn ausdrücklich von der Profilbezeichnung `macos-15` und qualifizieren keinen Release. Um diese lokale Prüfung auf einem Mac zu wiederholen, installieren Sie die festgelegten Abhängigkeiten und Playwright-1.64.0-Browser, bauen die aktuellen Quellen und führen dann die [gespeicherte Anleitung](evidence/post779-local-acceptance/reproduce.sh) mit dem Repositoryverzeichnis als Argument aus. Sie verpackt den vorhandenen Build, prüft den Kandidaten, untersucht jeden Browser und speichert neue Nachweise unter `.compatibility/`. Sie benötigt Port 4189 und verweigert das Überschreiben eines vorhandenen `browser-candidate-web`-Verzeichnisses. Lassen Sie die Quellen zwischen Build und Ausführung unverändert. Gehostete CI- und physische Geräteergebnisse werden im [Implementierungsbericht](implementation-report.de.md) getrennt geführt.
