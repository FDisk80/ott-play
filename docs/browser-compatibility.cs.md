<a id="browser-generations-and-operating-systems"></a>

# Generace prohlížečů a operační systémy

<!-- language-navigation:start -->
<p dir="ltr">
<a href="browser-compatibility.md" lang="en" dir="ltr">English</a> · <a href="browser-compatibility.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="browser-compatibility.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="browser-compatibility.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="browser-compatibility.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="browser-compatibility.es.md" lang="es" dir="ltr">Español</a> · <a href="browser-compatibility.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="browser-compatibility.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="browser-compatibility.he.md" lang="he" dir="rtl">עברית</a> · <a href="browser-compatibility.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="browser-compatibility.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="browser-compatibility.it.md" lang="it" dir="ltr">Italiano</a> · <a href="browser-compatibility.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="browser-compatibility.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="browser-compatibility.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="browser-compatibility.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="browser-compatibility.pt.md" lang="pt" dir="ltr">Português</a> · <a href="browser-compatibility.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="browser-compatibility.th.md" lang="th" dir="ltr">ไทย</a> · <a href="browser-compatibility.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="browser-compatibility.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="browser-compatibility.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="browser-compatibility.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="browser-compatibility.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[Naměřené výsledky](implementation-report.cs.md#browser-gate-integration)

![Nastavená kvalifikace prohlížečů: 35 cílů, 166 provedení scénářů](diagrams/browser-qualification.svg)

Stávající kontroly zařízení, médií, starších ES5/workerů, nativního rozhraní a nativního HLS od Apple zůstávají povinné. Sdílený workflow TypeScript navíc spouští scénáře Plex nad přesným zabaleným archivem Mode A: dva lokalizované postupy načtení/opětovného načtení, zachování poměru stran v HLS.js a Video.js při změně média či obnovení a přirozené dokončení epizody ve striktním kiosku s HLS.js. Mediální scénáře používají skutečné dekódování; všechny scénáře pracují se skutečným DOM a vstupem. Pouze data Plex a zdroj médií jsou syntetická lokální testovací data.

Test poměru stran přebaluje verzovaný transportní proud H.264/AAC do samostatných variant fMP4. Inicializační hlavičky používají značku `iso6` a nulové délky filmu/stop, jak vyžaduje [RFC 8216, oddíl 3.3](https://www.rfc-editor.org/rfc/rfc8216#section-3.3). Záznam vzorku AVC také používá povinné rezervované bity v počtu SPS a konstantu se znaménkem `-1` v koncovém poli `pre_defined`. Tím se opravuje syntaxe kontejneru vytvořeného připnutým testovacím muxerem. Kontrakt testovacích dat ověřuje hlavičky, odmítá chybné boxy a současně dokládá, že sady parametrů kodeku, ID stop, časová měřítka a bajty mediálních fragmentů zůstaly beze změny. Ověřuje to syntetický vstup; samo o sobě to nedokládá přehrávání v prohlížeči ani nenahrazuje úplnou matici RC.

Pull requesty vyžadují aktuální Chromium, Firefox a WebKit na Linuxu, Chromium na Windows a WebKit na macOS. Noční a beta sestavení vyžadují těchto pět cílů. Kvalifikace RC vyžaduje všech 35 deklarovaných cílů: tři přesné generace Playwright/prohlížečů na Linuxu, Windows a macOS, dále nainstalované stabilní Chrome/Edge na všech třech systémech a beta Chrome/Edge na Linuxu. Dva historické cíle macOS WebKit (Playwright 1.62.1 a 1.63.0) používají `macos-15-intel`; jejich doklady zaznamenávají skutečnou architekturu procesu a odmítají ARM runner. Přímá diagnostika MSE ukázala, že stejné inicializační a mediální bajty H.264 se dokončily na Intelu s 1.63 a na ARM s 1.64, zatímco starší WebKit v ARM VM s macOS 15 uvízl před `updateend`. Změna kontejneru, ManagedMediaSource ani otevření okna prohlížeče nepomohly. Tyto dva cíle nadále vyžadují všech pět původních scénářů přehrávání/rozhraní. Volba runneru není tvrzením o každém fyzickém zařízení macOS nebo nativním Safari. Regenerace inventáře musí zachovat tyto posouzené výjimky runnerů; kontrakt profilu odmítá jejich odstranění.

Všechny tři generace Linux WebKit používají výslovně x64 runner `ubuntu-26.04`. Posouzené srovnání oficiálních běhových prostředí zopakovalo selhání přechodu striktního kiosku na Ubuntu 24.04, zatímco stejný kandidát a pět nezměněných scénářů prošly na Ubuntu 26.04 čtyřikrát za sebou. Volí se tím konzistentní podporované prostředí bez nahrazování jednotlivých multimediálních knihoven nebo oslabování kontrol přehrávání. Ostatní linuxové cíle si ponechávají dosavadní runnery. Přesný zdroj, artefakt, výsledky a omezení srovnání uvádí [kvalifikace běhového prostředí Linux WebKit](linux-webkit-runtime.md). Úplná matice RC i samostatná akceptace nativních balíčků zůstávají povinné.

Testované verze produktů se zaznamenávají za běhu. Playwright Firefox je jeho upravená sestava, nikoli tvrzení o nativním Firefox ESR; WebKit není Safari. Tato matice nenahrazuje kvalifikaci na fyzických televizorech nebo v nativních prostředích.

Úplný inventář má **35 platformních cílů: 32 cílů s podporou HLS a tři cíle Windows WebKit pouze pro rozhraní**. Poslední tři stále vyžadují oba lokalizované postupy načtení/opětovného načtení; jejich sestava WebKit nemá MediaSource ani nativní HLS. Jde o deklarované omezení, nikoli úspěšné pokrytí přehrávání. Přesná tři ID cílů se posuzují v `scripts/browser-compatibility-profile.cjs`. Sonda schopností musí omezení potvrdit před spuštěním testů rozhraní. Pokud bude dostupné MSE (včetně ManagedMediaSource) nebo nativní HLS, kontrolní brána selže, dokud se profil neaktualizuje. Každý jiný cíl vyžaduje MSE pro H.264 i AAC a všech pět nezměněných scénářů; ztráta schopnosti způsobí chybu namísto výběru menší sady. Sonda načítá knihovnu HLS kandidáta a ověřuje backend vybraný výchozím nastavením připnuté instance: MediaSource, pak ManagedMediaSource a pak WebKitMediaSource. Doklad uvádí backend a verzi HLS; změna výchozího nastavení nebo verze vyžaduje výslovné posouzení kontraktu sondy.

Úplný RC tedy vyžaduje **166 úspěšných provedení scénářů** (32 × 5 + 3 × 2) a 35 dokladů cílů. Podmnožina PR/noční/beta zůstává na pěti cílech a 25 provedeních. Každý doklad zachycuje přesnou sadu scénářů, sondu schopností a úspěšné pokrytí HLS nebo výslovný důvod nepodporované funkce. Jsou to nakonfigurované požadavky, nikoli tvrzení, že je konkrétní RC již splnil. Omezení potvrzuje [konfigurace sestavení WebKit pro Windows](https://github.com/WebKit/WebKit/blob/56453fdfe0b0ca6258c23e6453b34f70b885d13f/Source/cmake/OptionsWin.cmake#L75) použitá Playwright 1.64 a připnutá běhová sonda.

Obě cesty stahují přesné ID artefaktu vytvořeného produkční úlohou v aktuálním běhu. Před zpřístupněním čerstvě rozbaleného adresáře se ověřují kontrolní součty archivu, zdrojový commit, hashe zabalených bundle/provider souborů, typy souborů a cesty. Kontroly vydání také ověřují neměnný doklad sestavení. Úlohy prohlížečů testovaný kód znovu nesestavují; instalují jen produkční závislosti. Testovací server stále potřebuje úplný inventář providerů ze zdroje; kompilátor se načítá jen při skutečném sestavování bundlu, ne při čtení konstant inventáře. Neúspěšné, přeskočené, zastaralé či chybějící důkazy scénářů způsobí selhání sdílené brány; pro každý cíl se uchovávají záznamy trasování, skutečná identita prostředí a otisk kandidáta.

Sedm generovaných souborů inventáře/lock pochází z `venus-os-ci-toolkit/scripts/prepare_browser_compatibility.py`. Balíčky aplikace a historické balíčky prohlížečů mají oddělené lock soubory. Výchozí zůstávají runnery hostované GitHubem; sdílený workflow zachovává připravenou možnost linuxové zálohy, zatímco cíle Windows/macOS vyžadují svůj nativní OS.

Sdílený verdikt vydání ověřuje každý vybraný cíl a jeho zdrojové SHA, běh, pokus, kanál a přesné ID artefaktu kandidáta. RC nesmí použít beta důkazy z pěti cílů. Povýšení na stable používá bajty přijatého RC. Po chybě znovu spusťte celý kvalifikační workflow; doklady starších pokusů nemohou dokončit novou kvalifikaci.

## Diagnostika ukončení

Po načtení běhového prostředí a metadat kandidáta zapíše `scripts/browser-acceptance.cjs`
soubor `acceptance-terminal.json` do adresáře `CI_BROWSER_DIAGNOSTICS`, když se
akceptační ověření dokončí nebo vyvolá výjimku. Záznam obsahuje poslední fázi, identitu
zdrojů a kandidáta, cílový prohlížeč, běh a pokus, uplynulý čas a stav ukončení
testovacího procesu, signál nebo kód chyby ze seznamu povolených hodnot. Záznam je
menší než 2 KiB a neobsahuje nezpracované chyby, URL, stdout/stderr, hodnoty prostředí
ani výpisy paměti. Soubor se vytváří s výhradním přístupem a oprávněními `0600` ve
stávajícím výstupním adresáři úlohy; existující soubor ani symbolický odkaz na místě
koncového souboru se nepřepisuje.

Jde o **diagnostické podklady, nikoli o úspěšnou akceptaci**. Záznam vždy uvádí
`acceptance: false`; kandidáta může kvalifikovat pouze samostatný soubor
`CI_BROWSER_EVIDENCE`, a to po splnění všech stávajících ověřovacích podmínek. Selhání
zápisu diagnostiky nemůže nahradit původní úspěšný či neúspěšný výsledek. Při náhlém
ukončení obalového procesu nebo selhání načtení metadat před zahájením tohoto kroku
nemusí žádný záznam vzniknout. Signál testovacího procesu nedokazuje, že jej obdržel
proces obsahu Firefoxu. Určení příčiny nativního pádu nadále vyžaduje odpovídající
nativní zásobník nebo řízenou reprodukci chyby; úspěšný opakovaný pokus šetření neuzavírá.

Tento pomocný nástroj nezapíná nezpracované zprávy o pádech Firefoxu ani protokolování
`DEBUG=pw:browser`. Paměť prohlížeče a výstup konzole mohou obsahovat citlivá data a
nesmějí se kopírovat do běžných nahrávaných artefaktů bez samostatně posouzených pravidel
pro sběr a přístup. Pořadí scénářů, pevně stanovené verze prohlížečů, jeden pracovní
proces, žádné opakované pokusy a stávající časové limity zůstávají beze změny.

<a id="from-source-to-accepted-candidate"></a>

## Od zdroje k přijatému kandidátovi

![Zdroj, ověření balíčku, kontroly schopností a důkazy](diagrams/candidate-verification-flow.svg)

1. Sestavte posouzený zdroj a zabalte výsledné soubory Mode A. U kandidáta uchovejte kontrolní součet archivu a identitu zdroje.
2. Před rozbalením ověřte omezenou velikost archivu, bezpečné cesty, typy souborů, zdroj/verzi a úplný inventář hashů položek/providerů. Kvalifikace vydání navíc kontroluje neměnný doklad sestavení.
3. Zjistěte skutečnou verzi prohlížeče a mediální schopnosti. Vyberte deklarovaný profil; neshoda schopností způsobí chybu místo tichého omezení pokrytí.
4. Spusťte přesnou sadu scénářů nad rozbalenými soubory bez nového sestavení. Vyžadujte každý scénář právě jednou, bez přeskočení, chyb nebo opakovaných pokusů.
5. Uchovejte prostředí, schopnosti, otisk kandidáta a výsledky scénářů. Sdílená brána před přijetím důkazů ověří povinné cíle a shodu běhu/pokusu/zdroje. Koordinace vydání a akceptace zařízení zůstávají samostatnými podmínkami.

<a id="what-has-been-measured-locally"></a>

## Co bylo lokálně změřeno

![Lokální ověření integrace: oddělené sady pro zařízení a zabalené prohlížeče](diagrams/browser-verification-results.svg)

Na zdroji `c52f4d07` prošlo v úplném běhu zařízení/prohlížeče Chromium 196 testů s jedním očekávaným přeskočením nativního HLS. Odděleně stejný zabalený archiv Mode A prošel pěti scénáři v každém z Chromium 156.0.8078.4, Firefox 157.0 a WebKit 27.2: 15 úspěchů bez přeskočení a opakování. Jde o různé sady; jejich počty nejsou procentem pokrytí ani důkazem, že prošlo všech 35 hostovaných cílů.

[Uložené doklady](evidence/post779-local-acceptance/summary.json) identifikují skutečný host macOS 26.7.1. Výslovně jej odlišují od štítku profilu `macos-15` a nekvalifikují vydání. Chcete-li lokální kontrolu zopakovat na Macu, nainstalujte zamčené závislosti a prohlížeče Playwright 1.64.0, sestavte aktuální zdroj a spusťte [uložený postup](evidence/post779-local-acceptance/reproduce.sh) s adresářem repozitáře jako argumentem. Zabalí stávající sestavení, ověří kandidáta, prověří každý prohlížeč a uloží nové doklady pod `.compatibility/`. Vyžaduje port 4189 a odmítá přepsat existující adresář `browser-candidate-web`. Mezi sestavením a spuštěním postupu zdroj neměňte. Výsledky hostovaného CI a fyzických zařízení se sledují odděleně ve [zprávě o implementaci](implementation-report.cs.md).
