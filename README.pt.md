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

Ficheiros locais sem Internet: consulte [Vídeos locais e reprodução offline](docs/offline-media.md).

[![Lista de canais do OTT-play FOSS em perspetiva](docs/images/hero.png)](docs/images/studio-2026-default.png)

*Captura da interface Studio 2026 existente com dados sintéticos de canais e programas.
Abra a imagem para ver a versão original plana; não é uma captura de uma subscrição em direto.
[Origem da imagem e regeneração](docs/images/README.md).*

[Guias rápidos em 88 idiomas](docs/readme/README.md) · [Wiki da documentação](docs/wiki/Home.pt.md)

[![Boas práticas OpenSSF](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![Fuzzing: apenas RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

Os candidatos a lançamento públicos executam campanhas de fuzzing limitadas e isoladas para a análise de XMLTV nativa/no servidor e a validação de pedidos aos portais. Consulte o [âmbito do fuzzing, a reprodução e as provas de lançamento](FUZZING.md).

Leitor IPTV/OTT autónomo com servidor HTTP Rust local. Funciona em Smart TVs (LG WebOS, Samsung Tizen, Panasonic, Sony, etc.), descodificadores (Infomir MAG, Dune HD, Enigma2, Android TV) e navegadores de computador.

Comece pelo [guia de arquitetura e contribuição](docs/architecture.md) para conhecer as camadas de execução, responsabilidades, receitas de extensão de fornecedores e verificações. Consulte [sessões de reprodução e duração dos fornecedores](docs/playback-session-architecture.md) para a fronteira entre núcleo e anfitrião e os contratos de compatibilidade.

<!-- ci-release-process:start -->
<a id="release-process"></a>

## Processo de lançamento

Consulte a [estratégia de lançamento](RELEASING.md) para as regras de validação e promoção nightly, beta, RC e estável, e o [manual operacional](docs/release-workflow.md) para os comandos locais.
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## Executar num navegador

Abra a [demonstração online](https://player.ottplay.here.now/) ou compile e sirva o leitor web seguindo as instruções abaixo.

A [instalação local em macOS](docs/local-http-deployment.md) disponibiliza origens HTTP do leitor nas portas 8443–8446. A porta 8095 foi descontinuada.

No primeiro arranque, escolha **Experimentar demonstração** para reproduzir o padrão de teste em movimento, ou configure a sua lista M3U ou fornecedor. A demonstração também fica disponível em **Alterar fornecedor → Demonstração**.

O modo de demonstração precisa de Internet, mas não de uma conta de fornecedor. Os seus canais de teste MP4 e HLS sem som são alojados em here.now e partilhados pelo leitor web, Tauri, Capacitor e OTT Server. As definições dos fornecedores existentes são preservadas ao mudar.
Para uma **verificação de imagem e som** separada, abra **Informações → Áudio → Reproduzir** no motor HTML5 gerido, quando estiver inativo ou a ver TV em direto. Isto usa o ficheiro de teste sonoro `av-v1.mp4` alojado em here.now e requer Internet. O vídeo não está incluído nos pacotes do leitor e nunca é obtido no arranque. VOD, arquivo e substituições do motor por dispositivo (incluindo PC2/Video.js e motores nativos) estão excluídos; consulte os [passos, sons esperados e diagrama de alojamento](docs/audio-video-check.pt.md).

As janelas instaladas do navegador de computador suportam **Window Controls Overlay**: o Chrome pode ocultar a barra de título separada, mantendo os botões da janela e o menu da aplicação sobre o leitor. Abra a aplicação instalada e escolha **Ocultar barra de título** quando o Chrome oferecer essa opção; **Mostrar barra de título** repõe a moldura habitual. Os separadores normais e os layouts de TV ou shells nativas mantêm o comportamento existente. Consulte os [controlos da janela do navegador](docs/browser-window-controls.md) para URLs de instalação suportados, atualização de atalhos existentes e verificação.

Para avançar ou recuar dez segundos na vista principal do vídeo, use **Alt/Option + Esquerda/Direita** (**Command + Esquerda/Direita** também funciona em macOS), tanto em ecrã inteiro como na vista normal. Vídeos locais, VOD e arquivos de canais suportados usam os mesmos controlos na web, Tauri e Capacitor. Consulte os [atalhos de teclado e limites](docs/browser-window-controls.md#playback-keyboard-shortcuts).

Na interface de PC, **R** reproduz outro canal ou vídeo aleatório da lista atual sem alterar a sua ordem. Funciona na vista principal do vídeo e nas listas de canais/vídeos; editores de texto, diálogos, definições e restrições de quiosque mantêm prioridade. As outras associações de teclas por dispositivo não mudam.

O padrão de teste sintético pode ser regenerado com `scripts/generate-demo-media.sh` (requer FFmpeg); os ficheiros gerados ficam no diretório ignorado `.local-artifacts`.

<a id="features"></a>

## Funcionalidades

- **Reprodução**: HLS, DASH e fluxos HTTP simples, com limites de qualidade HLS.js/Shaka geridos, recuperação limitada e até três URLs de reserva explícitos por canal em direto. Arquivo/VOD nunca mudam para uma reserva em direto; consulte [qualidade e recuperação](docs/playback-stream-policy.pt.md).
- **EPG**: correspondência XMLTV, deslocamento temporal/replay, pesquisa por título de programa (N5 no EPG), lembretes e associação manual de fonte/ID a um canal exato no caminho XMLTV alojado/nativo. Consulte [associação e acessibilidade](docs/guide-binding-accessibility.pt.md).
- **Favoritos**: uma [coleção mista](docs/mixed-favorites.md) ordenada entre fornecedores e perfis configurados em dispositivos compatíveis, com exportação/importação portátil via CLI; PIN parental. As listas por fonte continuam disponíveis no modo alternativo.
- **Definições**: exportação/importação JSON de definições e favoritos, diário de anulação para lotes localStorage suportados, retoma de arquivo consciente da origem e comparação exata de definições guardadas para fluxos do controlador. A recuperação pressupõe um único escritor; adaptadores de armazenamento personalizados conservam uma reversão de melhor esforço. Consulte [recuperação de definições](docs/settings-recovery.pt.md).
- **Interface partilhada**: OTT Server, Tauri e Capacitor usam o mesmo tema e definições de visibilidade da lista de canais. As definições de [cores da interface](docs/interface-colors.md) disponibilizam nove funções de cor, uma paleta, introdução exata de valores HEX/RGB/HSV e cinco esquemas e são guardadas para cada cliente; as da lista de canais controlam nomes, picons, programas atuais, progresso e marcas de arquivo.
- **Fornecedores**: M3U/M3U8, TV em direto Xtream com [catálogos de filmes/séries a pedido](docs/xtream-media.pt.md), Stalker/Ministra com [filmes e episódios aninhados](docs/stalker-media.md), Plex e VPortal. As capacidades do fornecedor e o acesso da conta determinam as funções de arquivo e biblioteca multimédia disponíveis.
- **Comandos push**: controlo remoto por webhook — mudar canal, fornecedor ou lista, mostrar notificações
- **Introdução remota de texto (swop)**: teclado do telefone via Cloudflare Worker quando TV e telefone estão em redes diferentes (sessões autorizadas por instalação; ♥™ no teclado virtual)
- **Encaminhamento por dispositivo**: endereçamento por UUID para configurações com vários dispositivos
- **Proxy local**: servidor de comandos local opcional para automação 100% local (sem servidor central)
- **Integração com controlador**: operadores limitados a dispositivos/ações, resultados de comandos duráveis opcionais, aplicação retomável de predefinições Local/Home e passagem de direto/arquivo da mesma origem através do [servidor de controlo](https://github.com/open-ott-play/ottplay-control-server) correspondente. Exigem o controlador/CLI atualizado; um separador autónomo do navegador não os fornece.
- **Preferências remotas tipadas**: descubra as configurações, leia os valores salvos e efetivos e salve verificando a instância de execução, a origem e a revisão; consulte [configurações remotas e configuração do VPortal](docs/remote-player-settings.md).
- **Depuração**: HUD de reprodução/registo circular ativado por `?debug=1`, inspeção remota com consentimento e verificação alojada de áudio/vídeo a pedido
- **Acessibilidade de teclado**: diálogos clássicos nomeados, contenção e reposição do foco Tab, semântica do canal selecionado e anúncios de estado não intrusivos. Estas melhorias não estabelecem conformidade total com WCAG ou leitores de ecrã dos dispositivos.
- **24 tipos de dispositivos**: associações de teclas do comando por dispositivo
- **88 idiomas da interface**: catálogos correspondentes, [guias rápidos localizados](docs/readme/README.md) e [alfabetos do teclado verificados com CLDR](docs/localization.md). O manual principal e os guias de funcionalidades emparelhados estão disponíveis em [24 idiomas de documentação](docs/manual-translations.md); as restantes referências de engenharia conservam os idiomas existentes.

O [guia de entrega](docs/roadmap-delivery.pt.md) descreve as funcionalidades implementadas nesta revisão, os limites das plataformas, diagramas e verificações. Lançamentos instalados ou instalações alojadas podem usar uma revisão anterior. A [aplicação Android](https://github.com/open-ott-play/ottplay-android) nativa independente também conserva escolhas de áudio/legendas por idioma, função e etiqueta, em vez de índices no manifesto; a sua implementação e os seus lançamentos são separados deste frontend.

A [revisão do código-fonte STB](docs/stb-player-improvements.md) explica as melhorias de multimédia, recursos e recuperação, as comparações entre os respetivos códigos-fonte e os limites atuais.

<a id="debug-hud"></a>

## HUD de depuração

O HUD local e a persistência de registos no servidor têm ativações separadas. Consulte [acesso de diagnóstico, ocultação e retenção](docs/diagnostic-security.md) antes de recolher registos de outros dispositivos.

Ative a depuração por uma das seguintes formas:
- URL: `?debug=1` ou `?debug=true`
- Armazenamento local: `localStorage.setItem("ottplay_debug", "1")`
- Propriedade da janela: `window.__OTT_DEBUG__ = true`
- Servidor: quando `/debug/config` devolve `{enabled: true}`

Quando a depuração está ativa:
- Prima **D** para alternar a faixa HUD no ecrã (`ottDebugSetHud` / `__ottDebug.toggleHud()`)
  - Não atua se o foco estiver em INPUT/TEXTAREA/listEdit
  - Usa `e.key` para evitar o conflito MAG/Maple PLAY/PREV=68
- Menu Informações → **HUD de depuração** → chama `__ottDebug.toggleHud()`
- Gerir definições → **HUD de depuração**:
  - Se a depuração já estiver carregada: alterna a visibilidade do HUD
  - Caso contrário: define `ottplay_debug=1` + `ottplay_debug_hud=1` e pede reinício
- Persistência: `ottDebugSetHud` guarda o estado do HUD em `localStorage.ottplay_debug_hud` ("1"/"0")

<a id="capacitor-ios-and-android"></a>

## Capacitor para iOS e Android

Este repositório empacota o frontend TypeScript partilhado com Capacitor para iOS e Android 7+. Ambos usam tipos de letra do sistema e o runtime nativo bloqueado pelo npm. Um APK de compatibilidade API 22 separado suporta Android 5.1/6 com WebView 60 ou posterior. Ambos os APK Android são assinados e incluídos nos lançamentos beta, RC e estáveis qualificados, juntamente com o IPA iOS não assinado. A aplicação Kotlin independente permanece em [ottplay-android](https://github.com/open-ott-play/ottplay-android).

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

Consulte [configuração do Capacitor](docs/capacitor-mobile.md) e [distribuição Android e atualizações remotas](docs/android-distributions.md).

A interface iOS usa orientação horizontal. Definições, configuração de fornecedores, consentimento de controlo remoto e importação/exportação JSON continuam a usar o frontend partilhado. A multitarefa em tablets pode substituir a orientação pedida.

No iPhone, deslize verticalmente sobre a lista de canais para percorrer linhas e páginas; para cima passa aos canais seguintes, para baixo aos anteriores. Um gesto rápido continua por várias páginas e desacelera até parar; um arrasto lento mantém a precisão. Toque no ecrã ou prima uma tecla de navegação para parar o movimento. Um toque inicia o canal sob o dedo, mesmo que outra linha esteja selecionada. Um deslize nunca abre o canal ao levantar o dedo.

O vídeo é reproduzido na própria interface do iPhone. Toque no fundo do ecrã para informações do programa ou abra o menu enquanto a reprodução continua. Picture in Picture permanece uma opção de reprodução separada.

Teste básico no dispositivo: [lista de verificação do Modo B](docs/mode-b-device-smoke.md) e `./scripts/smoke-capacitor-device.sh --help` (compilação/sincronização apenas para iOS). Teste básico Tauri para computador: [lista de verificação de computador](docs/mode-b-tauri-smoke.md).

<a id="installation"></a>

## Instalação

| Plataforma | Pacote | Notas |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Compilações separadas para Apple Silicon e Intel; assinatura ad-hoc salvo configuração de assinatura Apple |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | Várias distribuições |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode ou Homebrew Channel](docs/lg-webos-installation.md); reprodutor hospedado, requer rede |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode e assinatura local; pacote de TV não assinado, separado do Family Hub](docs/samsung-tizen-installation.md) |
| **iOS** | `.ipa` via AltStore / TestFlight / Xcode | Apenas instalação externa — ainda não está na App Store |
| **Android (frontend partilhado)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | Pacotes Capacitor assinados; escolha a versão Android suportada |
| **Android (Kotlin nativo)** | [Aplicação nativa](https://github.com/open-ott-play/ottplay-android) separada | Repositório público; aplicação e fluxo de lançamento separados |

Os instaladores suportados estão anexados aos lançamentos GitHub qualificados: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **Nota:** os pacotes macOS usam assinatura ad-hoc quando faltam credenciais de assinatura Apple; isso não fornece Developer ID nem notarização. Os instaladores Windows/Linux e pacotes de lançamento iOS podem não estar assinados. O iOS exige assinatura antes da instalação num dispositivo físico. Os APK Android Full e API 22 de lançamentos qualificados usam o certificado estabelecido; compilações de lançamento locais precisam de um keystore configurado para produzir APK assinados.

---

<a id="macos"></a>

### macOS

1. Escolha a etiqueta pretendida em [Lançamentos](https://github.com/open-ott-play/ottplay-foss/releases). O atalho para o lançamento mais recente seleciona o estável, não beta ou RC.
2. Descarregue `OttPlay.FOSS_*_aarch64-apple-darwin.dmg` para Apple Silicon ou `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` para Intel. São compilações de arquiteturas separadas.
3. Abra o `.dmg` e arraste **OttPlay FOSS.app** para Aplicações.
4. Verifique o pacote copiado antes do primeiro arranque:

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

Uma verificação bem-sucedida confirma a integridade do pacote. `Signature=adhoc` significa que a aplicação não tem uma identidade de programador autenticada pela Apple; não estabelece notarização nem aprovação pelo Gatekeeper. Com uma origem de descarga de confiança e um pacote válido, o macOS pode ainda exigir **Definições do Sistema → Privacidade e Segurança → Abrir mesmo assim** após a primeira tentativa; consulte as [instruções da Apple](https://support.apple.com/en-us/102445).

Uma mensagem «a aplicação está danificada» não prova, por si só, que o problema seja a quarentena. Se a verificação da assinatura falhar, guarde o erro e obtenha um lançamento corrigido. Não volte a assinar a aplicação descarregada nem remova os seus atributos para fazer uma verificação falhada parecer bem-sucedida.

As alternativas ZIP são `OttPlay.FOSS_aarch64-apple-darwin.app.zip` e `OttPlay.FOSS_x86_64-apple-darwin.app.zip`. Consulte [assinatura macOS e verificação de artefactos](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact) para extração, imagens de disco e verificações Gatekeeper. Para compilações do checkout e instalação local, use [entrega local em macOS](docs/macos-local-delivery.md).

---

<a id="windows"></a>

### Windows

1. Descarregue `.msi` ou `.exe` de [Lançamentos](https://github.com/open-ott-play/ottplay-foss/releases/latest)
2. Execute o instalador e siga as instruções
3. Inicie pelo menu Iniciar ou pelo atalho no Ambiente de Trabalho

---

<a id="linux"></a>

### Linux

A reprodução em Linux requer plugins GStreamer HLS, H.264 e AAC, além de WebKitGTK. Os pacotes declaram estas dependências multimédia; as compilações AppImage incluem a framework multimédia. Consulte [empacotamento multimédia Linux](docs/linux-media-packaging.md) para verificações de codecs e a distinção entre aceitação no navegador e nativa.

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

### Instalação em iOS

O iOS exige assinatura antes da instalação num dispositivo físico. Use AltStore Classic para o IPA de lançamento não assinado, ou compile e assine a partir do código com Xcode. O TestFlight exige um convite separado, quando disponibilizado.

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### Opção 1: AltStore Classic (recomendado para uso pessoal)

O AltServer corre no computador; o AltStore Classic corre no iPhone/iPad e importa o IPA. Uma conta Apple gratuita é suficiente.

**Pré-requisitos:**

- iPhone/iPad com **iOS/iPadOS 15 ou posterior** para a compilação OTT-play atual.
- Mac ou PC Windows com AltServer e cabo USB de dados.
- Conta Apple para assinatura e Internet para descarregar o lançamento.

**Passo 1: configurar o AltStore uma vez**

1. Instale AltServer seguindo a [configuração oficial para macOS](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) ou a [configuração para Windows](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows). Inicie-o e use o ícone na barra de menus/área de notificação.
2. Ligue o dispositivo por USB, desbloqueie-o e aceite os pedidos de confiança do computador/dispositivo. Num Mac, confirme que aparece no Finder.
3. Em **Menu AltServer → Install AltStore**, selecione o dispositivo e conclua os pedidos da conta de assinatura. Espere pela notificação de instalação.
4. No dispositivo, abra **Definições → Geral → VPN e Gestão de Dispositivos** e, se pedido, confie na entrada de programador da sua conta de assinatura. Em iOS 16+, ative **Definições → Privacidade e Segurança → Modo de Programador** e conclua o reinício e as confirmações.
5. Abra AltStore no dispositivo. Se já estiver instalado e a funcionar, ignore esta configuração e mantenha AltServer em execução para a importação seguinte.

**Passo 2: importar o lançamento selecionado no iPhone/iPad**

1. Escolha uma etiqueta exata em [todos os lançamentos](https://github.com/open-ott-play/ottplay-foss/releases) e descarregue o respetivo `ottplay-foss-ios-unsigned.ipa` no Safari do dispositivo. O [atalho para o lançamento mais recente](https://github.com/open-ott-play/ottplay-foss/releases/latest) seleciona um estável; use a lista completa quando pretender uma beta.
2. Guarde o IPA em Ficheiros. Em **AltStore → My Apps → +**, selecione esse ficheiro. Também pode transferir um IPA descarregado do Mac por AirDrop e guardá-lo em Ficheiros antes da importação. Abrir o IPA no Mac não executa esta importação.
3. Mantenha AltServer em execução e o cabo USB ligado enquanto AltStore assina e instala a aplicação. Para atualizar, use a mesma conta de assinatura da instalação existente; não elimine a aplicação como primeira tentativa de resolução.
4. Espere pelo fim da importação, confirme OTT-play em **My Apps** e inicie-o.

**Alternativa: importar diretamente o URL do lançamento**

Com AltStore já instalado, introduza este padrão no **Safari do iPhone**, substituindo `TAG` pela etiqueta exata, e aceite **Abrir no AltStore**:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

Isto usa o [gestor de URLs de instalação](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift) do AltStore. Evita entradas ambíguas em Ficheiros/Recentes quando várias descargas têm o mesmo nome. O URL deve apontar para o ficheiro IPA, não para a página do lançamento.

Por exemplo, a importação seguinte foi verificada em **2026-09-29** com AltStore 2.3 e AltServer 1.8.1. É um exemplo histórico fixo, não uma ligação para a versão mais recente:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**Renovação:** instalações com conta gratuita expiram após sete dias. Mantenha AltServer acessível e use **AltStore → My Apps → Refresh All** antes da expiração. A renovação em segundo plano também precisa de acesso ao AltServer; consulte as [instruções de renovação do AltStore](https://faq.altstore.io/altstore-classic/your-altstore).

<a id="verify-the-installed-version-before-retrying"></a>

#### Verificar a versão instalada antes de repetir

A mensagem «Enviado» do AirDrop confirma apenas a transferência. Uma barra de progresso AltStore confirma o início da importação. Perder a ligação de Espelhamento/USB não prova que a instalação tenha falhado: verifique a aplicação instalada antes de voltar a enviar o IPA.

Num Mac com Xcode instalado e selecionado como diretório de desenvolvimento ativo, inspecione o dispositivo sem reinstalar:

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

Em `result.apps` do JSON, encontre OTT-play (`bundleIdentifier` começa por `play.ott.foss`) e compare `version` e `bundleVersion` com `CFBundleShortVersionString` e `CFBundleVersion` do IPA selecionado. É esperado um sufixo da conta de assinatura AltStore no identificador do pacote. Mantenha o relatório do dispositivo local.

O exemplo beta.9 verificado apresenta **versão `1.1.51`, compilação `2.2.66`**. Isso confirma a instalação; abrir a aplicação, autenticar no Cloudflare, carregar listas, reproduzir e usar PiP são verificações separadas no dispositivo.

<a id="troubleshooting-ios-installation"></a>

#### Resolução de problemas de instalação em iOS

- **AltServer não tem janela, ou a sua abertura por automação excede o tempo:** use o ícone na barra de menus/área de notificação. É uma aplicação em segundo plano. Tentar repetidamente abrir uma janela normal não importa um IPA.
- **«Could not find AltServer» ou dispositivo USB indisponível:** confirme que AltServer corre, desbloqueie o telefone e verifique os pedidos de confiança. Num Mac, confirme a presença no Finder. Se a ligação caiu, volte a ligar quando for seguro e verifique a versão instalada antes de repetir. Siga a [resolução de problemas de ligação do AltStore](https://faq.altstore.io/altstore-classic/troubleshooting-guide) se persistir. Se o telefone fornece Internet ao computador, coordene qualquer mudança de cabo ou rede para não interromper outros trabalhos.
- **Espelhamento do iPhone mostra «iPhone em utilização» ou fica em «A ligar»:** termine a configuração no telefone físico ou bloqueie o ecrã e deixe-o perto do Mac desbloqueado para espelhar. Desbloquear o telefone termina o espelhamento; a confiança/configuração USB pode exigir primeiro o desbloqueio. Se continuar bloqueado após uma reconexão, saia do Espelhamento e continue no telefone. Consulte os [requisitos de Espelhamento da Apple](https://support.apple.com/en-us/120421). O espelhamento é opcional para instalar.
- **Um URL perde letras latinas ou transforma-se em cirílico no Espelhamento:** mude a **origem de entrada do Mac para ABC/Inglês**. Com o Espelhamento focado, prima **Control–Espaço** e escolha **English (US)** para o teclado físico do iPhone. As origens do Mac e do iPhone podem diferir; alterar só a do Mac não foi suficiente na nossa sessão verificada. Limpe o campo, volte a introduzir o URL e inspecione o endereço antes de enviar.
- **Colar da área de transferência no Espelhamento bloqueia ou insere texto inesperado:** limpe o campo e escreva lentamente em pequenos segmentos com a origem English (US) do iPhone, ou introduza o URL diretamente no telefone. A entrada rápida no Espelhamento pode perder ou duplicar caracteres; verifique o endereço completo antes de guardar. Não envie um URL parcialmente colado. Colar falhou na nossa sessão de instalação; não é requisito do método por URL direto.
- **Ficheiros/Recentes mostra vários nomes IPA idênticos:** selecione a localização exata da descarga ou use o URL direto com etiqueta acima. Pode renomear uma cópia local para incluir etiqueta/compilação por clareza; isso não altera o conteúdo.
- **A aplicação instalada não abre:** siga qualquer pedido de confiança no programador ou Modo de Programador no telefone. Verifique a expiração no AltStore e renove se necessário. Registe o erro real se continuar a falhar; um erro de ligação, por si só, não justifica eliminar e reinstalar a aplicação.
- **OTT-play abre, mas uma lista protegida falha pela rede móvel:** instalação e autenticação da fonte são separadas. Use **Definições → Gerir definições → Acesso à fonte** para autenticar numa fonte configurada e recarregue a lista. Conclua pedidos biométricos/passkey ou códigos de email no dispositivo físico quando necessário. A fonte deve suportar a [integração iOS Access](docs/ios-source-access.md); instalar a aplicação não contorna uma lista de IPs permitidos.
- **É pedida passkey numa rede Wi-Fi de confiança:** para fontes com integração iOS Access, a aplicação tenta primeiro a fonte original sem autenticação e usa a entrada móvel autenticada apenas após acesso negado. Verifique o IP público realmente visto pela fonte, incluindo IPv6: um IPv4 doméstico permitido não abrange outro IPv6, VPN ou endereço móvel. Mudanças de rede e reabertura da aplicação limpam a preferência temporária de rota. Um erro genérico de rede/servidor não deve desencadear autenticação.
- **A autenticação já não aparece, mas a lista de canais está vazia:** uma sessão guardada válida é reutilizada sem novo pedido. Após falha anterior de carregamento ou correção no servidor, recarregue a lista ou feche totalmente e reabra a aplicação uma vez. Se persistir, confirme que a fonte devolve uma lista e não uma página HTML de autenticação ou erro JSON. Registe o erro apresentado e o estado HTTP; não partilhe URLs de fontes com credenciais, cookies ou tokens Access.
- **Os canais carregam, mas o vídeo fica a carregar ou apresenta `SRC_NOT_FOUND`:** carregamento da lista e reprodução são verificações separadas. Tente o canal mais uma vez após autenticar; se persistir, verifique as respostas do manifesto HLS e segmentos e o suporte aos codecs do fluxo. O erro, por si só, não prova que trocar de motor ou reinstalar ajude.

<a id="option-2-testflight-if-available"></a>

#### Opção 2: TestFlight (se disponível)

Se houver convite TestFlight publicado, instale TestFlight da App Store, abra o convite no dispositivo e toque em **Instalar**. Descarregar um IPA do GitHub não fornece um convite TestFlight.

<a id="option-3-xcode-for-developers"></a>

#### Opção 3: Xcode (para programadores)

Siga [Compilar e abrir](docs/capacitor-mobile.md#build-and-open), selecione o alvo **App** no Xcode, configure a equipa em **Signing & Capabilities**, escolha o dispositivo ligado e compile/execute. Conclua pedidos de confiança e Modo de Programador conforme necessário. Importar o IPA de lançamento não assinado na janela Devices do Xcode não fornece a identidade de assinatura nem o perfil de aprovisionamento em falta.

---

<a id="android-application"></a>

### Aplicação Android

Escolha o APK Full Capacitor do lançamento deste repositório para a interface partilhada. Use o APK de compatibilidade API 22 em Android 5.1–6; requer WebView 60 ou posterior. Preserve a identidade da aplicação e o certificado de assinatura ao atualizar para manter os perfis existentes. Consulte [instruções de compilação](android/README.md) e [distribuição, assinatura e instalação remota](docs/android-distributions.md).

O [repositório ottplay-android](https://github.com/open-ott-play/ottplay-android) separado contém a aplicação Kotlin/Compose nativa. Tem identidade, preferências e fluxo de lançamento próprios e não substitui diretamente uma instalação Capacitor. Os ficheiros de lançamentos históricos continuam disponíveis.

---

<a id="quick-start"></a>

## Início rápido

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

Use uma instalação própria da mesma revisão para testes básicos no navegador.

Use Node 22 e Rust estável. Execute o servidor a partir da raiz do repositório para disponibilizar os ficheiros estáticos. Compilações nativas requerem as ferramentas de plataforma descritas abaixo; estas não são necessárias para compilar apenas o servidor.

No primeiro carregamento, escolha **Experimentar demonstração** ou abra **Definições → Alterar fornecedor → Listas M3U / M3U8**. Abra **Selecionar lista**, escolha uma posição, introduza o **URL da lista**, guarde e escolha **Carregar lista**. A lista ou conta de fornecedor é fornecida por si; a aplicação não fornece uma subscrição de canais pagos.

<a id="mode-a-companion-smoke"></a>

## Teste básico do companion Modo A

Teste com curl do companion Modo A (paridade `ottplay-server` / `archive/server.py`): índice, diretórios estáticos, `/logo`, `/version`, `/epg` opcional e uma sondagem sem obtenção de conteúdo de `POST /m3u/cp.php`.

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

As verificações estão em `scripts/modea-smoke-checks.json`. Sem segredos. A fila de comandos / `local_proxy.py` (:8081) é coberta separadamente por `scripts/smoke-command-queue.sh` (quando presente).

<a id="classic-stalker--ministra-portals"></a>

## Portais Stalker / Ministra clássicos

Escolha **Portais Stalker** e introduza o MAC fornecido pelo fornecedor e o URL completo do portal, por exemplo `http://provider.example/stalker_portal/c/`. URLs `/c/index.html`, `/stalker_portal`, `/server/load.php`, `/load.php` e `/portal.php` selecionam o protocolo MAG clássico. As configurações existentes de servidor sem caminho mantêm JSON-RPC. O fornecedor carrega perfil, géneros e canais em direto paginados usando o núcleo Stalker partilhado e, em seguida, descobre em segundo plano filmes do protocolo clássico `type=vod` e episódios aninhados. Os caminhos das pastas tornam-se categorias na lista de canais normal; as descrições e os cartazes disponíveis e os Favoritos globais estáveis usam a mesma interface multimédia. Consulte o [comportamento e os limites do catálogo](docs/stalker-media.md).

Os pedidos da versão de navegador alojada pelo próprio utilizador passam pelo endpoint `/stalker/api` do companion; as aplicações nativas usam o seu transporte HTTP existente. As versões de navegador em alojamento externo requerem rotas configuradas explicitamente através do [relay dedicado](docs/stalker-relay.md). Os ficheiros do navegador e do servidor devem ser atualizados em conjunto.

A reprodução em direto resolve comandos temporários dos canais ao abrir um fluxo; mudar de canal, parar, PiP e substituir o fornecedor cancelam resoluções obsoletas. Comandos HTTP(S) explícitos não temporários são reproduzidos diretamente. É suportado EPG curto. O arquivo dos portais clássicos e o dialeto separado `type=series` não são expostos por este fornecedor. O comportamento de arquivo/guia JSON-RPC existente não muda. Os portais LAN privados que usam a rota do companion precisam de uma entrada exata em `OTTPLAY_PROXY_LAN_ORIGINS`, como as outras rotas de proxy do companion.

A demonstração pública Infomir é `http://middleware-stalker.com/stalker_portal/c/`. Devolveu três entradas de catálogo em direto em 2026-09-26, mas os endpoints multimédia estavam indisponíveis; use dados de portal/multimédia controlados para regressão de reprodução.

<a id="m3u-stream-proxy-header-smoke"></a>

## Teste de cabeçalhos do proxy de fluxos M3U

Compara cabeçalhos de pedidos a montante que `POST /m3u/cp.php` do companion Modo A injeta ao obter um URL de eco controlável (simulação local por omissão — sem fornecedores IPTV nem segredos).

Contrato (de `src-rs/core/src/m3u.rs` + `archive/server.py`):
- Injeta apenas **User-Agent** (`OTT-play-FOSS/1.0` por omissão, ou predefinições `webos` / `tizen` / `viera` / `mag` / `dune`).
- **Não** injeta **Referer** (o `M3UProxy` Capacitor injeta; o Modo A não).
- Remove um `@` inicial de `url` (formulário jQuery do fornecedor).

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

Saída: `0` sucesso, `1` não está à escuta, `2` divergência de cabeçalho/HTTP, `3` utilização/dependências. Complementa `smoke-modea-companion.sh` / `smoke-command-queue.sh`.

<a id="logo-concurrent-bench-smoke"></a>

## Teste de desempenho concorrente de logótipos

Teste de latência de `GET /logo/<id>.svg` concorrentes (`?ch=` opcional) no companion Modo A. Apresenta contagens de sucesso/falha e p50/p95/p99. A carga prática local de CI é a predefinição (`CONCURRENCY=200`, `TOTAL=1000`); o ensaio prolongado completo de 10 mil é opcional (`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`).

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

Saída: `0` sucesso, `1` não está à escuta / ligação falhou, `2` taxa de erro elevada, `3` utilização. Complementa `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`.

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## Teste de atualização e aquecimento da cache XMLTV

Verifica o comportamento real da cache XMLTV/EPG do companion Modo A face a `src-rs` (sem APIs inventadas):

- `EPG_CACHE` em memória servido por `GET /epg/:hash` → sempre `{"epg_data":[...]}` (HTTP 200).
- O arranque do processo obtém `EPG_URLS` em segundo plano sem atrasar o arranque HTTP; cada obtenção concluída é seguida de **2h** de espera antes da atualização seguinte.
- Persistência SQLite opcional quando `DATABASE_URL` está definido (sem endpoint público de estado da cache).
- `GET /health` → `OK` confirma disponibilidade HTTP após reinício opcional. Com `--strict-epg` e `--epg-hash`, o teste também espera EPG não vazio desse canal dentro do mesmo orçamento `--warmup-timeout`.

O caminho predefinido só executa curl — **não termina processos**. Passe `--restart-cmd` / `RESTART_CMD` para terminar+reiniciar automaticamente, ou siga os passos manuais `launchctl` em `--help`.

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

Saída: `0` sucesso, `1` não está à escuta, `2` asserção/aquecimento falhou, `3` utilização. Complementa `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`.

<a id="mode-a-e2e-play-path-smoke"></a>

## Teste E2E do caminho de reprodução do Modo A

Teste do **caminho de reprodução/disponibilidade do fluxo** no companion (só HTTP — **não** E2E com interface gráfica visível). Num companion Modo A em execução verifica:

- Health ou índice acessível
- Ficheiros estáticos da estrutura do leitor (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`)
- `GET /epg/<hash>.json` opcional quando `EPG_HASH` está definido
- `POST /m3u/match-channels` com JSON de teste sem segredos (lista vazia + um canal sintético)
- **Reprodução** pelo proxy: `POST /m3u/cp.php` com multimédia controlável (lista HLS local por omissão, ou `MEDIA_URL`) e confirmação de HTTP 200 + corpo não vazio / `Content-Type` esperado (primeiros bytes pelo proxy)

Sem credenciais IPTV privadas. Complementa `smoke-modea-companion.sh` (presença), `smoke-m3u-stream-proxy-headers.sh` (UA/Referer), `smoke-xmltv-cache-refresh.sh`.

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

Saída: `0` sucesso, `1` não está à escuta, `2` asserção falhou, `3` utilização/dependências.

<a id="capacitor-device-smoke-mode-b"></a>

## Teste em dispositivo Capacitor (Modo B)

**Lista de verificação** em simulador/emulador (dispositivo real opcional) para Cap Modo B — não HTTP do companion Modo A. Uma pessoa assinala a aceitação da interface; o auxiliar automatiza ferramentas/diretórios nativos/curl tolerante da fila de comandos.

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

Detalhes: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md). Complementa `smoke-command-queue.sh` (loopback Cap) — não confundir com os testes Modo A acima.

<a id="tauri-desktop-smoke-mode-b"></a>

## Teste de computador Tauri (Modo B)

Lista de verificação e auxiliar para Tauri Modo B (janela/reprodução de canal/PiP). Não é HTTP do companion Modo A nem teste de dispositivo Cap.

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

Detalhes: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md). Credenciais de programador Apple são opcionais para o teste local; use [assinatura ad-hoc](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials) para uma aplicação Mac empacotada. A aceitação humana continua a cobrir arranque, reprodução e PiP.

<a id="docker"></a>

## Docker

As imagens multi-arquitetura (amd64/arm64) são compiladas como arquivos OCI candidatos. A publicação no registo promove o arquivo estável aprovado para Docker Hub sem recompilar; consulte o [manual operacional](docs/release-workflow.md).

O binário do servidor é compilado com **musl** (Alpine) e distribuído sobre Alpine — **não** requer GLIBC_2.38+. Isso mantém `alvit/ottplay-foss` executável no Docker de Synology DSM (x86_64) e noutros anfitriões com glibc antigo.

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

As etiquetas estáveis no registo usam `X.Y.Z`. Atualizar `latest` é uma opção explícita separada após publicar a imagem versionada; pushes para main e etiquetas Git não publicam imagens.

<a id="build-from-source"></a>

## Compilar a partir do código

As regras do domínio do leitor vêm do artefacto Kotlin multiplataforma fixado em `vendor/ottplay-core.js`. Decisões de guia, arquivo, lista, fornecedor, estado durável e reprodução partilham implementação com FOSS2 e Android nativo. Adaptadores de navegador/TV, Swift e Rust mantêm APIs dos dispositivos, codecs, rede e efeitos da interface. O artefacto do navegador conserva sintaxe ES5 e inicialização das APIs antigas suportadas. `npm test`, `check:bundle` e `check:es5` verificam a integração; o manifesto do artefacto regista hashes de origem e saída.

Os validadores dos protocolos control-server e SWOP são gerados do esquema versionado `contracts/ottplay-wire-v1.json`. Os comprovativos verificados do gerador e os dados imutáveis de compatibilidade evitam cópias de políticas específicas por consumidor.

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

## Deteção de dispositivos

O leitor suporta 24 tipos de dispositivos. Deteção: primeiro pelo URL `/f/{device_id}/`, depois por User-Agent.

| ID do dispositivo | Dispositivo |
|---|---|
| `pc` | Navegador de PC |
| `pc2` | Leitor web videojs |
| `nodejs` | Aplicação Windows (Electron) |
| `lg/webos` | TVs LG WebOS |
| `samsung/tizen` | TVs Samsung Tizen |
| `samsung/maple` | TVs Samsung Orsay |
| `mag` | Descodificadores Infomir MAG |
| `dune` | Descodificadores Dune HD |
| `android` | Android TV / tablets |
| `hbbtv` | TVs HbbTV |
| `panasonic` | TVs Panasonic Viera |
| `philips` | TVs Philips |
| `sony` | TVs Sony |
| `sharp` | TVs Sharp |
| `toshiba` | TVs Toshiba |
| `hisense` | TVs Hisense |
| `skyworth` | TVs Skyworth |
| `tcl` | TVs TCL |
| `vewd` | Dispositivos Vewd |
| `spark` | Recetores Spark |

<a id="push-command-system"></a>

## Sistema de comandos push

Para um serviço separado com vários dispositivos, use [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) e a secção **Servidor de comandos** em **Definições → Controlo remoto**. Introduza IP/endereço e o código de acesso deste leitor; guardar ambos inicia automaticamente a consulta de comandos de volume, canal e outros. Um IP sem porta usa HTTP 8081. Limpe o endereço ou escolha **Desligar** para parar. Esta ligação de saída suporta entrega confirmada e não precisa de um listener local. Consulte [ligação e compatibilidade](docs/remote-command-server.md). Os exemplos seguintes descrevem o modo existente de proxy/listener local.

**Procurar servidor de comandos** permite encontrar um controlador e pedir a aprovação do operador sem copiar um token de dispositivo. O Tauri consulta primeiro o DNS nativo e, se o resultado estiver vazio, pode recorrer a um perfil de implementação configurado explicitamente; os leitores de navegador, LG e Capacitor usam o percurso do perfil do navegador. Os metadados de descoberta Home podem ser alojados no here.now independentemente do controlador. As compilações genéricas não incluem automaticamente esse perfil Home e as atualizações não substituem as ligações guardadas. Consulte [o comportamento das plataformas, a configuração do perfil e a resolução de problemas](docs/remote-command-server.md#discovery-and-one-time-approval).

O controlo remoto HTTP local está **desligado por omissão** no navegador/leitor OTT server, Tauri e Capacitor. Ative-o em **Definições do leitor → Controlo remoto** para gerar um código secreto do dispositivo. Os comandos são objetos JSON com campo `"command"`; pedidos HTTP exigem `Authorization: Bearer <device-code>`.

<a id="architecture"></a>

### Arquitetura

<a id="local-command-url-recommended"></a>

#### URL de comandos locais (recomendado)

Ative **Controlo remoto HTTP local** em **Definições do leitor → Controlo remoto**, copie o **Código do dispositivo** gerado e configure o proxy abaixo com esse código. Defina **URL de comandos locais** para o endpoint de comandos do proxy. Enquanto ativo, o leitor consulta este URL a cada 10 segundos com o código no cabeçalho Authorization. Definir apenas um URL não ativa o controlo por comandos.

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### UUID do dispositivo

O UUID do dispositivo existente (por exemplo, `dev_a1b2c3d4e5`) é metadado público de encaminhamento, não uma credencial de autorização. O **Código do dispositivo** separado é gerado de forma segura ao ativar HTTP local e permanece neste dispositivo; não é copiado pelas definições na nuvem. Desativar o controlo HTTP local para a consulta/listeners. Reativar gera um novo código: atualize proxy e integrações para revogar a credencial antiga.

Tauri e Capacitor iniciam o listener HTTP de loopback apenas após esta ativação. Proxies de encaminhamento devem enviar o código apresentado como token Bearer para esse listener. O Modo A usa a fila `local_proxy.py` configurada separadamente abaixo.

<a id="remote-text-entry-swop"></a>

#### Introdução remota de texto (swop)

Objetivo: escrever no telefone para ♥™ / teclado virtual remoto quando TV e telefone estão em **redes diferentes**, através de passagem de sessão por Cloudflare Worker.

- Repositório Worker: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop)
- **Autorização da instalação:** o leitor envia pedidos ao relay `/swop` da mesma origem do seu servidor. Esse servidor adiciona o seu token privado de instalação; todos os clientes da origem registada podem usar a introdução remota de texto. UUIDs identificam sessões e não exigem lista de permissões por dispositivo.
- Definição: `swopBaseUrl` (vazio = ♥™ mostra «não configurado» / não faz nada). Edite em **Definições → Controlo remoto** (tecla **2**) ou injete por `/local/swop.json`, ignorado pelo Git, nas instalações de operadores
- `POST /session` inclui `clientId`, `caption` e `draft`; `POST /val` inclui `clientId`, `code` e o `sessionToken` devolvido. O URL do telefone contém um token de escrita separado. Tokens de leitura da sessão ficam na memória do navegador.
- **Instalação local:** defina `SWOP_BASE_URL` e `SWOP_INSTALLATION_TOKEN` após registar a instalação e as suas origens LAN/localhost exatas no Worker. `scripts/install-ottplay-local-service.sh` preserva-os no plist launchd privado de modo 0600. O `/local/swop.json` público contém apenas `{"swopBaseUrl":"/swop"}`. Nunca coloque um token de instalação em ficheiros públicos.
- **Alojamento estático:** configure um proxy autenticado no servidor para os mesmos dois endpoints. Mantenha o token de instalação nos segredos do serviço de alojamento. Copiar ficheiros públicos do leitor não copia essa credencial do servidor.

> O servidor OTT central mantém `/api/webhook/commands`, `/webhook/poll`, `/webhook/notify` e aliases de saúde dos comandos desativados para todos os métodos HTTP. Use o servidor de comandos separado ou `local_proxy.py` autenticado e explicitamente configurado para Modo A; o servidor central não tem fila de comandos de difusão.

<a id="available-commands"></a>

### Comandos disponíveis

Todos os exemplos abaixo usam `http://192.168.1.50:8081/api/webhook/commands` como URL do proxy local. Substitua-o pelo endereço real e defina `OTTPLAY_QUEUE_HTTP_TOKEN` para o **Código do dispositivo** apresentado após ativar HTTP nas definições. O proxy deve usar o mesmo código.

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — Mostrar notificação

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| Campo | Tipo | Predefinição | Descrição |
|---|---|---|---|
| `message` | string | obrigatório | Texto a mostrar |
| `popup_duration` | number | 5 | Segundos de apresentação (canto superior direito) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — Mudar de canal pela posição na lista

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| Campo | Tipo | Predefinição | Descrição |
|---|---|---|---|
| `channel_number` | number | obrigatório | Posição do canal na lista, começando em 1 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — Mudar de canal pelo nome (parcial)

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

Pesquisa de substring sem distinguir maiúsculas. Ganha a primeira correspondência.

| Campo | Tipo | Predefinição | Descrição |
|---|---|---|---|
| `channel_name` | string | obrigatório | Nome completo ou parcial do canal |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — Mudar para um canal aleatório

Este comando antigo seleciona canais elegíveis da lista ou categoria atual. Os números dos canais e os intervalos indicam posições nessa lista; consulte a [política de seleção aleatória segura](docs/remote-command-server.md#safe-random-playback).

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

| Campo | Tipo | Predefinição | Descrição |
|---|---|---|---|
| `random_range` | [start, end] | lista atual | Intervalo começando em 1 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — Mudar o fornecedor IPTV

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| Campo | Tipo | Predefinição | Descrição |
|---|---|---|---|
| `provider` | number | obrigatório | Índice no vetor de fornecedores (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — Carregar nova lista M3U

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| Campo | Tipo | Predefinição | Descrição |
|---|---|---|---|
| `playlist` | string | obrigatório | URL da lista M3U |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — Atualizar configuração do fornecedor

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| Campo | Tipo | Predefinição | Descrição |
|---|---|---|---|
| `provider_settings` | string | obrigatório | String JSON com configuração do fornecedor |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — Definir ou ajustar volume

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

Ignorado silenciosamente em clientes sem suporte a controlo de volume.

| Campo | Tipo | Predefinição | Descrição |
|---|---|---|---|
| `volume` | number | — | Nível absoluto 0-100 |
| `volume_step` | number | — | Alteração relativa, por exemplo +10 ou -5 |

<a id="player-standby-restart-and-exit"></a>

#### Espera, reinício e saída do leitor

A fila webhook sem confirmação do proxy local não suporta `exit_player` nem pedidos tipados de espera/ativação. Ligue o leitor ao [servidor de comandos](docs/remote-command-server.md) e use a sua CLI:

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

Substitua `d1` pelo alias do leitor registado. `stop` é um alias de `standby`; `start` e `wake` são aliases de `go`. Go exige um leitor em execução e ligado; não inicia uma aplicação fechada nem desperta um dispositivo offline. Um navegador ou TV sem saída nativa indica que a saída não é suportada. A espera mantém a consulta remota ativa e não suspende trabalho não relacionado do anfitrião ou servidor partilhado.

Após standby/go, consulte `ott d1 status` para o estado de espera/segundo plano e verifique a retoma da reprodução separadamente. Após recarregar o leitor, confirme um novo runtime com `ott d1 doctor`. Após sair, confirme no sistema operativo que o processo terminou; um timeout remoto não prova saída. Aceitar um comando não confirma estes resultados.

<a id="local-proxy-server"></a>

## Servidor proxy local

`local_proxy.py` é uma fila de comandos autenticada autónoma para um leitor. A invocação predefinida termina sem abrir porta. Cada instância usa o código gerado pelo leitor; use instâncias/portas separadas para vários leitores. O parâmetro de consulta `device_id` é aceite como metadado de compatibilidade e nunca autentica nem seleciona outro dispositivo.

<a id="start-the-proxy"></a>

### Iniciar o proxy

1. Ative **Controlo remoto HTTP local** no leitor e copie o **Código do dispositivo**.
2. No anfitrião do proxy, configure o código e a origem exata que serve o leitor (esquema, anfitrião e porta, sem caminho):

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. Defina o **URL de comandos locais** do leitor para `http://192.168.1.50:8081/api/webhook/commands`.

O endereço de escuta predefinido é `127.0.0.1`; o exemplo ativa explicitamente acesso LAN. `OTTPLAY_QUEUE_HTTP_ORIGINS` é uma lista de origens exatas separadas por vírgulas. Use proxy inverso HTTPS se servir o leitor em HTTPS, para as regras de conteúdo misto permitirem a consulta. Mantenha o código secreto e fora de URLs. Quando o leitor gerar novo código, reinicie o proxy com esse valor; desativar só o leitor não para um processo de proxy gerido separadamente.

<a id="endpoints"></a>

### Endpoints

| Método | Caminho | Descrição |
|---|---|---|
| `POST` | `/api/webhook/commands` | Colocar comando na fila |
| `GET` | `/api/webhook/commands` | Obter comandos em fila (consulta do leitor) |
| `POST` | `/webhook/notify` | Alias de compatibilidade autenticado |
| `GET` | `/webhook/poll` | Alias de compatibilidade autenticado |

Tanto enviar como retirar comandos exige o código Bearer correspondente. Não existe endpoint de difusão sem autenticação. Os comandos expiram após 60 segundos; cada proxy conserva no máximo 50 comandos.

O proxy trata até 16 ligações em simultâneo, para que uma ligação inativa do navegador ou pedido incompleto não atrase outros comandos. Cada socket tem timeout de inatividade de cinco segundos; ligações adicionais são fechadas enquanto todos os workers estão ocupados. Inserção e retirada da fila são atómicas entre workers.

<a id="smoke-script-all-modes"></a>

### Script de teste (todos os modos)

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Emulador/dispositivo Android: primeiro `adb forward tcp:18081 tcp:18081`. Cap/Tauri são apenas loopback — use este proxy Modo A para Home Assistant na LAN. Detalhes: `docs/capacitor-mobile.md` § Smoke test.

<a id="cors"></a>

### CORS

O proxy permite pedidos do navegador apenas de `OTTPLAY_QUEUE_HTTP_ORIGINS`. Pedidos preliminares `OPTIONS` de origem permitida não precisam de token; todos os GET/POST reais exigem o código Bearer. Origens curinga e `null` não são aceites. Home Assistant e outros clientes não navegador podem omitir Origin, mas continuam a exigir autenticação.

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### Exemplo: webhook Home Assistant → proxy local → leitor

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

### Exemplos de automação Home Assistant

Os exemplos de notificação, canal e volume usam o proxy local. Defina `ottplay_device_authorization` em `secrets.yaml` do Home Assistant para `Bearer <device-code>` com o código mostrado pelo leitor ativado.

A espera noturna usa o [servidor de comandos](docs/remote-command-server.md) separado. Substitua o URL e `DEVICE_UUID` do exemplo pelo endereço do controlador e ID do dispositivo registado; o alias local CLI `d1` não é um ID de dispositivo. Defina `ottplay_control_authorization` para `Bearer <controller-admin-token>` em `secrets.yaml`. Esta credencial é separada do código do proxy local. Consulte a documentação Home Assistant de [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) e [segredos](https://www.home-assistant.io/docs/configuration/secrets/).

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

`standby_request` contém a resposta HTTP para o rastreio da automação. HTTP 202 significa apenas colocado em fila: conserve `content.id` e consulte `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` com a mesma credencial do controlador para obter a resposta do leitor. Um novo pedido `status` observa `player.standby` e `player.background`; espera ativa com `suspended` e zero pendentes confirma que o trabalho acompanhado pelo leitor terminou. Para sair da espera, use o mesmo pedido tipado com `"operation":"wake"` (`ott d1 go`). Não repita uma alteração cegamente após timeout. Consulte a [API pedido/resposta](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) e a [semântica de espera](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake) do controlador.

<a id="server-api-reference"></a>

## Referência da API do servidor

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Endpoints webhook (Rust `ottplay-server`)

O servidor Rust e a alternativa Python arquivada rejeitam endpoints de comandos com HTTP 403. `/api/webhook/commands`, `/webhook/notify`, `/webhook/poll` e aliases de saúde não colocam, difundem nem retiram comandos. A API genérica de feedback não pode substituir estas rotas reservadas. A entrega Modo A usa o servidor de comandos ou proxy autenticado configurados separadamente acima.

<a id="other-endpoints"></a>

### Outros endpoints

| Método | Caminho | Descrição |
|---|---|---|
| `GET` | `/epg/<hash>.json` | Dados EPG do canal |
| `GET` | `/logo/<id>.svg` | Logótipo de canal gerado |
| `GET` | `/version/<path>` | Hash de versão do ficheiro |
| `POST` | `/m3u/match-channels` | Correspondência canal/EPG |
| `POST` | `/m3u/match-logos` | Correspondência de logótipos |
| `POST` | `/m3u/cp.php` | Proxy de fluxo |
| `GET/POST` | `/feedback/` | Registo de feedback |
| `GET` | `/tmdb/*` | Proxy da API TMDb |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## Estrutura do projeto

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

## Associações de teclas STB

- **Samsung Tizen**: `RETURN=10009`, `ENTER=13`, cores 403-406
- **Samsung Maple**: dpad 4/5/6/8, códigos SDK originais
- **LG WebOS**: `RETURN=461`, cores compatíveis com HbbTV
- **LG NetCast**: `RETURN=8`, códigos HbbTV
- **MAG**: `RETURN=8`, API gSTB para MAC
- **Dune HD**: códigos padrão, API Dune
- **Android TV**: códigos Android (`BACK=4`, `DPAD_*` 19-22, `ENTER=66`)
- **HbbTV/Panasonic/Philips/Sony/etc.**: códigos HbbTV (`RED=403`, `BLUE=406`, `VOL_UP=447`)

<a id="documentation"></a>

## Documentação

- [Wiki da documentação](./docs/wiki/Home.pt.md) / [Wiki em russo](./docs/wiki/Home.ru.md) — navegação por tarefas e regras de manutenção.
- [Relatório de implementação](./docs/implementation-report.pt.md) / [Processo e resultado em russo](./docs/implementation-report.ru.md) — diagramas coloridos, comportamento verificado, custo medido e critérios de lançamento.
- [Guia de entrega](./docs/roadmap-delivery.pt.md) / [Guia das novidades em russo](./docs/roadmap-delivery.ru.md) — funcionalidades, limites e verificação.
- [Guias rápidos em 88 idiomas da interface](./docs/readme/README.md) — gerados das traduções fornecidas na interface; o manual principal e os guias de funcionalidades emparelhados estão disponíveis em [24 idiomas de documentação](docs/manual-translations.md).
- [Limites de qualidade e recuperação em direto](./docs/playback-stream-policy.pt.md) / [Em russo](./docs/playback-stream-policy.ru.md).
- [Associação XMLTV manual e acessibilidade clássica](./docs/guide-binding-accessibility.pt.md) / [Em russo](./docs/guide-binding-accessibility.ru.md).
- [Verificação alojada de áudio/vídeo](./docs/audio-video-check.pt.md) / [Em russo](./docs/audio-video-check.ru.md).
- [Biblioteca multimédia Xtream](./docs/xtream-media.pt.md) / [Em russo](./docs/xtream-media.ru.md).
- [Passagem entre dispositivos da mesma origem](./docs/remote-handoff.pt.md) / [Em russo](./docs/remote-handoff.ru.md).
- [Definições locais recuperáveis](./docs/settings-recovery.pt.md) / [Em russo](./docs/settings-recovery.ru.md).
- [Gerações de navegadores, sistemas operativos e verificações exatas dos candidatos a lançamento](docs/browser-compatibility.pt.md) / [Em russo](docs/browser-compatibility.ru.md).

- [Arquitetura do leitor](./docs/architecture.md) — responsabilidades em execução, integração de fornecedores, reprodução, guia, adaptadores e contratos de compilação.
- [Pipeline clássico ES5](./docs/build-pipeline.md) — compilação, verificações de compatibilidade e limites de tamanho dos artefactos.
- [Nomes dos ficheiros de execução e migração de instalações](./docs/asset-layout.md) — caminhos descritivos partilhados pelos pacotes web e nativos.
- [Bancada de trabalho remota](./docs/remote-workbench.md) — inspeção de interface/multimédia, comprovativos de operações e provas guardadas.
- [Diagnóstico em execução](./docs/runtime-debug.md) — histórico de erros, contadores de frames/ciclos, métricas nativas Capacitor/Tauri e depuração do servidor.
- [Entrega local em macOS](./docs/macos-local-delivery.md) — compilações do checkout, instalação local e verificação.

<a id="license"></a>

## Licença

[MIT](LICENSE) — livre e de código aberto. O conteúdo dos fornecedores e as dependências de terceiros conservam os seus direitos e licenças.

A aplicação separada [OTTPlay native webOS](docs/native-webos.md), derivada de PlxNative, é distribuída sob **GPL-3.0-or-later** com o código-fonte correspondente.
A licença MIT na raiz do projeto não altera a licença desta aplicação nativa nem dos seus patches.

<a id="desktop-updater--notarization-mode-b"></a>

## Atualizador de computador / notarização (Modo B)

O [guia de assinatura e atualização para computador](docs/tauri-updater-notarize.md) descreve assinatura ad-hoc macOS, Developer ID/notarização opcionais e verificação de pacotes. O CI de lançamentos usa assinatura ad-hoc sem credenciais Apple. A assinatura do atualizador é separada; as atualizações automáticas de produção continuam por configurar.

<a id="local-mac-build-helpers"></a>

## Auxiliares de compilação local no Mac

Consulte [docs/local-build-scripts.md](docs/local-build-scripts.md).

<a id="privacy"></a>

## Privacidade

Leia a [política de privacidade](docs/privacy-policy.md) para informações sobre definições locais, serviços configurados e as suas escolhas. Contacto de privacidade e suporte: [alvit.work@gmail.com](mailto:alvit.work@gmail.com).

Studio 2026 é o tema predefinido da interface. Classic e PLi-HD continuam selecionáveis e as preferências guardadas são preservadas. Consulte [definições da interface](docs/interface-settings.md). O tema PLi-HD reconhece Vali, littlesat, VU+NL, Milo e os colaboradores upstream. Consulte [créditos e história do design](docs/interface-history.md) para a história em inglês e ligações às origens, também disponível no menu de informações do leitor.

<a id="demo-video-editing"></a>

## Edição de vídeos de demonstração

Use o [fluxo video-use](docs/demo-video.md) local para preparar e editar gravações de demonstração. O auxiliar mantém todos os ficheiros gerados fora do Git.

<a id="plex-media-library"></a>

## Biblioteca multimédia Plex

Cada leitor pode ligar a uma conta Plex ou Plex Media Server através do fornecedor **Plex**. A integração usa Plex; Synology é um possível anfitrião do servidor multimédia. Todos os vídeos e faixas musicais acessíveis aparecem automaticamente na lista de canais; a seleção de categoria filtra por biblioteca, pasta ou série. A reprodução começa com o primeiro lote utilizável, com carregamento em segundo plano, pesquisa padrão e Ações de ordem aleatória/repetição, sem configurar Plex no servidor OTT. Consulte [autenticação Plex e reprodução direta](docs/plex-provider.md).

![Ciclo de carregamento, navegação em ficheiros e encerramento Plex](docs/images/plex-playback-lifecycle.svg)

A [análise de fiabilidade ilustrada](docs/plex-provider.md#reliability-review-process-and-results) explica regras de carregamento e cancelamento, correções para catálogos completos e troca de ficheiros, e resultados medidos da validação Chromium/WebKit.

Uma integração opcional do servidor OTT também expõe o catálogo e reprodução compatível de um servidor Plex existente através de uma entrada separada de biblioteca NAS e exportação M3U. Consulte [configuração da biblioteca no servidor e acesso do cliente](docs/synology-library.md).

<a id="related-repositories"></a>

## Repositórios relacionados

- [ottplay-core](https://github.com/open-ott-play/ottplay-core) contém a lógica de domínio JVM/ES5 partilhada, os contratos de comunicação e o cliente FOSS2. Este leitor consome artefactos gerados; siga o guia de entrega do núcleo para mudanças partilhadas.
- [ottplay-android](https://github.com/open-ott-play/ottplay-android) é a aplicação Kotlin/Compose nativa separada, com identidade própria de instalação e lançamento.
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server) fornece comandos remotos autoalojados; [ottplay-swop](https://github.com/open-ott-play/ottplay-swop) fornece transporte opcional de texto baseado em Worker.
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine) mantém o perfil alojado da demonstração no navegador, os ficheiros de demonstração e a verificação da publicação.

<a id="project-maintenance"></a>

## Manutenção do projeto

Consulte [requisitos de contribuição e testes](CONTRIBUTING.md), a [política de comunicação de segurança](SECURITY.md), o [design de segurança](docs/security-design.md) e as [provas OpenSSF e critérios restantes](docs/openssf-evidence.md).
