<a id="browser-generations-and-operating-systems"></a>

# Browsergeneraties en besturingssystemen

<!-- language-navigation:start -->
<p dir="ltr">
<a href="browser-compatibility.md" lang="en" dir="ltr">English</a> · <a href="browser-compatibility.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="browser-compatibility.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="browser-compatibility.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="browser-compatibility.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="browser-compatibility.es.md" lang="es" dir="ltr">Español</a> · <a href="browser-compatibility.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="browser-compatibility.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="browser-compatibility.he.md" lang="he" dir="rtl">עברית</a> · <a href="browser-compatibility.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="browser-compatibility.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="browser-compatibility.it.md" lang="it" dir="ltr">Italiano</a> · <a href="browser-compatibility.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="browser-compatibility.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="browser-compatibility.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="browser-compatibility.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="browser-compatibility.pt.md" lang="pt" dir="ltr">Português</a> · <a href="browser-compatibility.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="browser-compatibility.th.md" lang="th" dir="ltr">ไทย</a> · <a href="browser-compatibility.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="browser-compatibility.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="browser-compatibility.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="browser-compatibility.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="browser-compatibility.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[Gemeten resultaten](implementation-report.nl.md#browser-gate-integration)

![Ingestelde browserkwalificatie: 35 doelen, 166 scenario-uitvoeringen](diagrams/browser-qualification.svg)

De bestaande controles voor apparaten, media, oude ES5/workers, native interfaces en native HLS van Apple blijven verplicht. De gedeelde TypeScript-workflow voert daarnaast Plex-scenario’s uit op precies het verpakte Mode A-archief: twee gelokaliseerde laad-/herlaadstromen, behoud van de beeldverhouding met HLS.js en Video.js bij mediawissels en herladen, en het natuurlijk afronden van afleveringen in de strikte kioskmodus met HLS.js. De mediascenario’s gebruiken echte decodering; alle scenario’s gebruiken echte DOM en invoer. Alleen de Plex-gegevens en mediabron zijn synthetische lokale testgegevens.

De test voor de beeldverhouding remuxt de ingecheckte H.264/AAC-transportstream naar afzonderlijke fMP4-varianten. De initialisatieheaders gebruiken het merk `iso6` en film-/spoorduren van nul, zoals vereist door [RFC 8216, paragraaf 3.3](https://www.rfc-editor.org/rfc/rfc8216#section-3.3). De AVC-sample-entry gebruikt ook de voorgeschreven gereserveerde bits in het SPS-aantal en de getekende constante `-1` in het laatste veld `pre_defined`. Dit corrigeert de containersyntaxis van de vastgezette testmuxer. Een testcontract controleert deze headers en weigert ongeldige boxes, terwijl het bewijst dat codecparametersets, spoor-ID’s, tijdschalen en bytes van mediafragmenten onveranderd zijn. Dit valideert de synthetische invoer; het bewijst op zichzelf geen browserweergave en vervangt de volledige RC-matrix niet.

Pull requests vereisen het huidige Chromium, Firefox en WebKit op Linux, Chromium op Windows en WebKit op macOS. Nachtelijke en betabuilds vereisen deze vijf doelen. RC-kwalificatie vereist alle 35 opgegeven doelen: drie exacte Playwright-/browsergeneraties op Linux, Windows en macOS, plus geïnstalleerde stabiele Chrome/Edge op alle drie systemen en Chrome/Edge beta op Linux. De twee historische macOS-WebKit-doelen (Playwright 1.62.1 en 1.63.0) gebruiken `macos-15-intel`; hun bewijsbestanden registreren de werkelijke procesarchitectuur en weigeren ARM-runners. Directe MSE-diagnostiek wees uit dat dezelfde H.264-initialisatie- en mediabytes voltooiden op Intel met 1.63 en op ARM met 1.64, terwijl oudere WebKit op de macOS 15 ARM-VM vóór `updateend` vastliep. Andere containers, ManagedMediaSource of een geopend browservenster losten dat niet op. Deze twee doelen blijven alle vijf oorspronkelijke afspeel-/UI-scenario’s vereisen. Deze runnerkeuze doet geen uitspraak over elk fysiek macOS-apparaat of native Safari. Bij het opnieuw genereren van de inventaris moeten deze beoordeelde runnerafwijkingen behouden blijven; het profielcontract weigert verwijdering ervan.

Alle drie Linux-WebKit-generaties gebruiken expliciet de x64-runner `ubuntu-26.04`. De beoordeelde vergelijking van officiële runtimes reproduceerde de overgangsfout in de strikte kioskmodus op Ubuntu 24.04; dezelfde kandidaat met vijf ongewijzigde scenario’s slaagde op Ubuntu 26.04 viermaal achtereen. Zo wordt een samenhangende ondersteunde runtime gekozen, zonder losse multimediabibliotheken te vervangen of afspeelasserties te versoepelen. De andere Linux-browserdoelen behouden hun bestaande runners. Zie [kwalificatie van de Linux-WebKit-runtime](linux-webkit-runtime.md) voor exacte bron, artefact, vergelijkingsresultaten en beperkingen. De volledige RC-matrix en afzonderlijke acceptatie van native pakketten blijven verplicht.

De geteste productversies worden tijdens uitvoering geregistreerd. Playwright Firefox is de aangepaste build van Playwright, geen uitspraak over native Firefox ESR; WebKit is geen Safari. Deze matrix vervangt kwalificatie op fysieke televisies of native shells niet.

De volledige inventaris bevat **35 platformdoelen: 32 doelen met HLS-ondersteuning en drie Windows-WebKit-doelen voor uitsluitend de UI**. Die laatste vereisen nog steeds beide gelokaliseerde laad-/herlaadstromen; hun WebKit-build heeft geen MediaSource of native HLS. Dit is een expliciete beperking, geen geslaagde afspeeldekking. De drie exacte doel-ID’s worden beoordeeld in `scripts/browser-compatibility-profile.cjs`. Een capaciteitstest moet de beperking bevestigen voordat de UI-tests starten. Als MSE (inclusief ManagedMediaSource) of native HLS beschikbaar wordt, faalt de poort tot het profiel is bijgewerkt. Elk ander doel vereist H.264- én AAC-MSE-ondersteuning en alle vijf ongewijzigde scenario’s; verlies van een capaciteit veroorzaakt een fout in plaats van een kleinere suite te kiezen. De capaciteitstest laadt de HLS-bibliotheek van de kandidaat en controleert de backend die de standaardinstelling van de vastgezette instantie kiest: MediaSource, daarna ManagedMediaSource, daarna WebKitMediaSource. Het bewijsbestand noemt deze backend en HLS-versie; een andere standaard of versie vereist expliciete beoordeling van het testcontract.

Een volledige RC vereist dus **166 geslaagde scenario-uitvoeringen** (32 × 5 + 3 × 2), met 35 doelbewijsbestanden. De PR-/nachtelijke-/betasubset blijft vijf doelen en 25 scenario-uitvoeringen. Elk bewijsbestand registreert de exacte scenarioverzameling, capaciteitstest en geslaagde HLS-dekking of expliciete reden waarom HLS niet wordt ondersteund. Dit zijn ingestelde vereisten, geen bewering dat een bepaalde RC ze al heeft voltooid. De beperking wordt bevestigd door de [Windows-buildconfiguratie van WebKit](https://github.com/WebKit/WebKit/blob/56453fdfe0b0ca6258c23e6453b34f70b885d13f/Source/cmake/OptionsWin.cmake#L75) die Playwright 1.64 gebruikt en door de vastgezette runtimetest.

Beide paden downloaden de exacte artefact-ID van de producerende job in de huidige run. Archiefcontrolesommen, broncommit, hashes van verpakte bundles/providers, bestandstypen en paden worden gecontroleerd voordat een vers uitgepakte map wordt aangeboden. Releasecontroles verifiëren ook het vastgelegde buildbewijs. Browserjobs bouwen de geteste code niet opnieuw; ze installeren alleen productieafhankelijkheden. De testserver vereist nog steeds de volledige providerinventaris uit de bron; de compiler wordt alleen geladen wanneer daadwerkelijk een bundle wordt samengesteld, niet bij het lezen van inventarisconstanten. Mislukt, overgeslagen, verouderd of ontbrekend scenariobewijs laat de gedeelde poort falen; traces, daadwerkelijke runtime-identiteit en kandidaatdigest worden per doel bewaard.

De zeven gegenereerde inventaris-/lockbestanden komen van `venus-os-ci-toolkit/scripts/prepare_browser_compatibility.py`. Applicatiepakketten en historische browserpakketten hebben afzonderlijke lockbestanden. GitHub-hosted runners blijven de standaard; de gedeelde workflow behoudt de voorbereide Linux-reservekeuze, terwijl Windows-/macOS-doelen hun eigen native OS vereisen.

Het gedeelde releaseoordeel controleert elk geselecteerd doel en zijn bron-SHA, run, poging, kanaal en exacte kandidaatartefact-ID. Een RC mag het betabewijs van vijf doelen niet gebruiken. Promotie naar stable gebruikt de bytes van de geaccepteerde RC. Voer na een fout de hele kwalificatieworkflow opnieuw uit; bewijsbestanden uit oudere pogingen kunnen een nieuwe kwalificatie niet voltooien.

## Diagnostiek bij beëindiging

Nadat de runtime en de metagegevens van de kandidaat zijn geladen, schrijft
`scripts/browser-acceptance.cjs` het bestand `acceptance-terminal.json` naar
`CI_BROWSER_DIAGNOSTICS` wanneer de acceptatiecontrole eindigt of een uitzondering
opwerpt. Het record bevat de laatste fase, de identiteit van bron en kandidaat, het
browserdoel, de uitvoering en poging, de verstreken tijd en de afsluitstatus van het
testproces, een signaal of een foutcode uit een lijst met toegestane waarden. Het
record is kleiner dan 2 KiB en bevat geen onbewerkte fouten, URL's, stdout/stderr,
omgevingswaarden of geheugendumps. Het bestand wordt met exclusieve toegang en modus
`0600` aangemaakt in de bestaande uitvoermap van de taak; een bestaand bestand of
symbolische koppeling op het uiteindelijke bestandspad wordt niet overschreven.

Dit is **diagnostisch bewijs, geen geslaagde acceptatie**. Het record vermeldt altijd
`acceptance: false`; alleen het afzonderlijke bestand `CI_BROWSER_EVIDENCE` kan een
kandidaat kwalificeren nadat alle bestaande controles zijn geslaagd. Een mislukte
schrijfactie voor diagnostiek mag het oorspronkelijke succes of falen niet vervangen.
Bij een abrupte beëindiging van de wrapper of een fout tijdens het vooraf laden van
metagegevens kan een record ontbreken. Een signaal van het testproces bewijst niet
dat het inhoudsproces van Firefox dat signaal heeft ontvangen. Voor toeschrijving
van een native crash is nog steeds een bijpassende native stack of een gecontroleerde
reproductie nodig; een geslaagde herhaling sluit het onderzoek niet af.

Deze hulpfunctie schakelt geen onbewerkte Firefox-crashrapporten of logging met
`DEBUG=pw:browser` in. Browsergeheugen en console-uitvoer kunnen gevoelige gegevens
bevatten en mogen zonder afzonderlijk beoordeeld beleid voor verzameling en toegang
niet naar gewone geüploade artefacten worden gekopieerd. De volgorde van scenario's,
vastgezette browserversies, één worker, nul herhalingen en de bestaande time-outs
blijven ongewijzigd.

<a id="from-source-to-accepted-candidate"></a>

## Van bron naar geaccepteerde kandidaat

![Bron, pakketverificatie, capaciteitscontroles en bewijs](diagrams/candidate-verification-flow.svg)

1. Bouw de beoordeelde bron en verpak de resulterende Mode A-bestanden. Bewaar de archiefcontrolesom en bronidentiteit bij de kandidaat.
2. Controleer vóór het uitpakken de begrensde archiefgrootte, veilige paden, bestandstypen, bron/versie en volledige hashinventaris van entries/providers. Releasekwalificatie controleert ook het vastgelegde buildbewijs.
3. Test de werkelijke browserversie en mediacapaciteiten. Selecteer het opgegeven profiel; een capaciteitsverschil veroorzaakt een fout in plaats van de dekking stil te verkleinen.
4. Voer de exacte scenarioverzameling uit op de uitgepakte bestanden, zonder opnieuw te bouwen. Eis elk scenario precies eenmaal, zonder overslaan, fouten of herpogingen.
5. Bewaar runtime, capaciteiten, kandidaatdigest en scenarioresultaten. De gedeelde poort controleert verplichte doelen en overeenkomende run/poging/bron voordat bewijs wordt geaccepteerd. Releasecoördinatie en apparaatacceptatie blijven afzonderlijke voorwaarden.

<a id="what-has-been-measured-locally"></a>

## Wat lokaal is gemeten

![Lokale integratiecontrole: afzonderlijke apparaat- en verpakte browsersuites](diagrams/browser-verification-results.svg)

Bij bron `c52f4d07` slaagde de volledige Chromium-apparaatbrowserrun voor 196 tests met één verwachte overgeslagen native-HLS-test. Afzonderlijk slaagde hetzelfde verpakte Mode A-archief voor vijf scenario’s in elk van Chromium 156.0.8078.4, Firefox 157.0 en WebKit 27.2: 15 geslaagd, niets overgeslagen en geen herpogingen. Dit zijn verschillende suites; hun aantallen zijn geen dekkingspercentage of bewijs dat alle 35 hosted doelen slaagden.

De [opgeslagen bewijsbestanden](evidence/post779-local-acceptance/summary.json) identificeren de werkelijke macOS 26.7.1-host. Ze onderscheiden die expliciet van het profiellabel `macos-15` en kwalificeren geen release. Om deze lokale controle op een Mac te herhalen, installeert u de vastgezette afhankelijkheden en Playwright 1.64.0-browsers, bouwt u de huidige bron en voert u het [opgeslagen recept](evidence/post779-local-acceptance/reproduce.sh) uit met de repositorymap als argument. Dit verpakt de bestaande build, controleert de kandidaat, test elke browser en bewaart nieuw bewijs onder `.compatibility/`. Het vereist poort 4189 en weigert een bestaande map `browser-candidate-web` te overschrijven. Houd de bron ongewijzigd tussen bouwen en uitvoeren. Hosted CI en resultaten op fysieke apparaten worden apart bijgehouden in het [implementatierapport](implementation-report.nl.md).
