<a id="ott-play-documentation-wiki"></a>

# Wiki de documentação do OTT-play

<!-- language-navigation:start -->
<p dir="ltr">
<a href="Home.md" lang="en" dir="ltr">English</a> · <a href="Home.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="Home.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="Home.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="Home.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="Home.es.md" lang="es" dir="ltr">Español</a> · <a href="Home.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="Home.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="Home.he.md" lang="he" dir="rtl">עברית</a> · <a href="Home.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="Home.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="Home.it.md" lang="it" dir="ltr">Italiano</a> · <a href="Home.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="Home.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="Home.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="Home.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="Home.pt.md" lang="pt" dir="ltr">Português</a> · <a href="Home.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="Home.th.md" lang="th" dir="ltr">ไทย</a> · <a href="Home.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="Home.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="Home.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="Home.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="Home.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[README](../../README.pt.md) · [Todos os idiomas da interface](../readme/README.md)

Esta é a página inicial da documentação versionada no repositório-fonte. O GitHub pode renderizar diretamente estas páginas Markdown; mantê-las aqui coloca instruções, diagramas e testes na mesma revisão do código. A [Wiki do GitHub](https://github.com/open-ott-play/ottplay-foss/wiki) separada é exportada destas fontes e identifica a revisão-fonte em cada página. Veja as [instruções de publicação](../wiki-publishing.md).

<a id="start-and-install"></a>

## Iniciar e instalar

- [Guia prático](../../README.pt.md), disponível em [24 idiomas de documentação](../manual-translations.md).
- [Guias rápidos localizados para os 88 idiomas da interface](../readme/README.md). Eles reutilizam rótulos traduzidos e passos de navegação. Não são 88 manuais técnicos traduzidos. O manual principal e os guias de funções correspondentes têm edições completas em 24 idiomas.
- [Pacotes e atualizações Android Full/API 22](../android-distributions.md), [compilação Android](../../android/README.md) e [Capacitor iOS/Android](../capacitor-mobile.md).
- [Entrega desktop no macOS](../macos-local-delivery.md), [assinatura/atualizador Tauri](../tauri-updater-notarize.md) e [instâncias HTTP locais](../local-http-deployment.md).

<a id="process-and-results"></a>

## Processo e resultados

- [Qualificação de navegadores e verificação do candidato](../browser-compatibility.pt.md) ([Русский](../browser-compatibility.ru.md)): destinos configurados, diagramas coloridos, verificações dos pacotes exatos e resultados locais separados.

- [Relatório de implementação e diagramas coloridos](../implementation-report.pt.md) ([Русский](../implementation-report.ru.md)): mudanças revisadas, regressões corrigidas, resultados medidos e requisitos restantes para liberação.

<a id="use-the-new-capabilities"></a>

## Usar as novas capacidades

- [Entrega de funções e limites das plataformas](../roadmap-delivery.pt.md) ([Русский](../roadmap-delivery.ru.md)).
- [Tetos de qualidade, alternativas explícitas para transmissão ao vivo e recuperação limitada](../playback-stream-policy.pt.md) ([Русский](../playback-stream-policy.ru.md)).
- [Vinculação manual XMLTV e acessibilidade clássica](../guide-binding-accessibility.pt.md) ([Русский](../guide-binding-accessibility.ru.md)).
- [Verificação hospedada de imagem e som](../audio-video-check.pt.md) ([Русский](../audio-video-check.ru.md)): **Informações → Áudio → Reproduzir**, tons esperados, diagrama de hospedagem e retorno à TV ao vivo. O clipe é buscado sob demanda, exige Internet e não está nos pacotes do reprodutor. A demonstração online separada de padrões em movimento é silenciosa.
- [Biblioteca de filmes/séries Xtream](../xtream-media.pt.md) ([Русский](../xtream-media.ru.md)).
- [Transferência do reprodutor na mesma fonte](../remote-handoff.pt.md) ([Русский](../remote-handoff.ru.md)).
- [Diário local de configurações e recuperação](../settings-recovery.pt.md) ([Русский](../settings-recovery.ru.md)).
- [Controle confiável, perfis retomáveis e transferência](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.md) ([Русский](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.ru.md)). Exige uma revisão compatível de controlador/CLI e permissões configuradas.
- [Preferências semânticas de áudio/legendas no Android nativo](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.md) ([Русский](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.ru.md)). O aplicativo Kotlin nativo é separado dos APKs Capacitor deste repositório.

<a id="configure-sources-and-inspect-problems"></a>

## Configurar fontes e investigar problemas

- [Login e reprodução Plex](../plex-provider.md), [arquitetura do guia](../guide-architecture.md) e [diagnóstico EPG hospedado](../hosted-epg-diagnostics.md).
- [Configurações da interface](../interface-settings.md), [história do design e créditos](../interface-history.md) e [catálogos de idiomas/teclados](../localization.md).
- [Bancada remota](../remote-workbench.md), [diagnóstico de execução](../runtime-debug.md) e [consentimento, ocultação e retenção de diagnósticos](../diagnostic-security.md).
- [Lista de verificação de dispositivos nativos](../mode-b-device-smoke.md), [lista de dispositivos Tauri](../mode-b-tauri-smoke.md) e [controles da janela do navegador](../browser-window-controls.md).

- [Custo medido das funções](../roadmap-size.pt.md), evidências brutas e gráfico SVG.

<a id="develop-and-release"></a>

## Desenvolver e publicar

- [Arquitetura e responsabilidades](../architecture.md), [sessões de reprodução](../playback-session-architecture.md) e [compilação ES5 clássica](../build-pipeline.md).
- [Nomes dos recursos de execução](../asset-layout.md), [política de versões](../../RELEASING.md), [manual operacional de publicação](../release-workflow.md) e [fuzzing de RC](../../FUZZING.md).
- [Política de privacidade](../privacy-policy.md) e [licença MIT](../../LICENSE).

Ao alterar a documentação, execute `npm run docs:generate` quando mudar um rótulo da interface ou modelo de guia rápido, depois `npm run check:docs`. Mantenha completas todas as traduções, coloque restrições junto às afirmações e diferencie validação local de testes em dispositivos físicos. Os diagramas são recursos revisáveis do repositório; veja [o SVG de vinculação do guia](../images/guide-binding.svg) e os diagramas vinculados nos guias. O verificador valida destinos relativos de arquivos, não a disponibilidade de sites remotos nem todas as âncoras de títulos Markdown.
