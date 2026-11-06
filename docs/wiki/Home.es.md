<a id="ott-play-documentation-wiki"></a>

# Wiki de documentación de OTT-play

<!-- language-navigation:start -->
<p dir="ltr">
<a href="Home.md" lang="en" dir="ltr">English</a> · <a href="Home.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="Home.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="Home.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="Home.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="Home.es.md" lang="es" dir="ltr">Español</a> · <a href="Home.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="Home.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="Home.he.md" lang="he" dir="rtl">עברית</a> · <a href="Home.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="Home.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="Home.it.md" lang="it" dir="ltr">Italiano</a> · <a href="Home.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="Home.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="Home.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="Home.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="Home.pt.md" lang="pt" dir="ltr">Português</a> · <a href="Home.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="Home.th.md" lang="th" dir="ltr">ไทย</a> · <a href="Home.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="Home.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="Home.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="Home.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="Home.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[README](../../README.es.md) · [Todos los idiomas de la interfaz](../readme/README.md)

Esta es la página inicial de documentación versionada en el repositorio fuente. GitHub puede representar directamente estas páginas Markdown; mantenerlas aquí permite revisar instrucciones, diagramas y pruebas junto con el código. La [Wiki de GitHub](https://github.com/open-ott-play/ottplay-foss/wiki) separada se exporta desde estas fuentes e identifica su revisión fuente en cada página. Consulta las [instrucciones de publicación](../wiki-publishing.md).

<a id="start-and-install"></a>

## Inicio e instalación

- [Guía práctica](../../README.es.md), disponible en [24 idiomas de documentación](../manual-translations.md).
- [Inicios rápidos localizados para los 88 idiomas de interfaz](../readme/README.md). Reutilizan etiquetas traducidas de la interfaz y pasos de navegación. No son 88 manuales técnicos traducidos. El manual principal y las guías de funciones emparejadas tienen ediciones completas en 24 idiomas.
- [Paquetes y actualizaciones Android Full/API 22](../android-distributions.md), [compilación Android](../../android/README.md) y [Capacitor iOS/Android](../capacitor-mobile.md).
- [Distribución de escritorio en macOS](../macos-local-delivery.md), [firma/actualizador Tauri](../tauri-updater-notarize.md) e [instancias HTTP locales](../local-http-deployment.md).

<a id="process-and-results"></a>

## Proceso y resultados

- [Cualificación de navegadores y verificación del candidato](../browser-compatibility.es.md) ([Русский](../browser-compatibility.ru.md)): destinos configurados, diagramas en color, comprobaciones del paquete exacto y resultados locales separados.

- [Informe de implementación y diagramas en color](../implementation-report.es.md) ([Русский](../implementation-report.ru.md)): cambios revisados, regresiones corregidas, resultados medidos y requisitos de publicación pendientes.

<a id="use-the-new-capabilities"></a>

## Usar las nuevas capacidades

- [Entrega de funciones y límites de plataforma](../roadmap-delivery.es.md) ([Русский](../roadmap-delivery.ru.md)).
- [Límites de calidad, alternativas explícitas para directo y recuperación acotada](../playback-stream-policy.es.md) ([Русский](../playback-stream-policy.ru.md)).
- [Vinculación manual XMLTV y accesibilidad clásica](../guide-binding-accessibility.es.md) ([Русский](../guide-binding-accessibility.ru.md)).
- [Prueba alojada de imagen y sonido](../audio-video-check.es.md) ([Русский](../audio-video-check.ru.md)): **Información → Audio → Reproducir**, tonos esperados, diagrama de alojamiento y vuelta a TV en directo. El clip se obtiene bajo demanda, requiere Internet y no está en los paquetes del reproductor. La demostración en línea separada de patrones móviles es silenciosa.
- [Biblioteca de películas/series Xtream](../xtream-media.es.md) ([Русский](../xtream-media.ru.md)).
- [Transferencia del reproductor con la misma fuente](../remote-handoff.es.md) ([Русский](../remote-handoff.ru.md)).
- [Diario local de ajustes y recuperación](../settings-recovery.es.md) ([Русский](../settings-recovery.ru.md)).
- [Control fiable, perfiles reanudables y transferencia](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.md) ([Русский](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.ru.md)). Requiere una revisión compatible del controlador/CLI y permisos configurados.
- [Preferencias semánticas de audio/subtítulos en Android nativo](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.md) ([Русский](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.ru.md)). La aplicación Kotlin nativa es independiente de los APK Capacitor de este repositorio.

<a id="configure-sources-and-inspect-problems"></a>

## Configurar fuentes e investigar problemas

- [Inicio de sesión y reproducción Plex](../plex-provider.md), [arquitectura de la guía](../guide-architecture.md) y [diagnóstico EPG alojado](../hosted-epg-diagnostics.md).
- [Ajustes de interfaz](../interface-settings.md), [historia del diseño y créditos](../interface-history.md) y [catálogos de idiomas/teclados](../localization.md).
- [Banco de trabajo remoto](../remote-workbench.md), [diagnóstico de ejecución](../runtime-debug.md) y [consentimiento, ocultación y retención de diagnósticos](../diagnostic-security.md).
- [Lista de comprobación de dispositivos nativos](../mode-b-device-smoke.md), [lista de dispositivos Tauri](../mode-b-tauri-smoke.md) y [controles de ventana del navegador](../browser-window-controls.md).

- [Coste medido de las funciones](../roadmap-size.es.md), evidencias sin procesar y gráfico SVG.

<a id="develop-and-release"></a>

## Desarrollo y publicación

- [Arquitectura y responsabilidades](../architecture.md), [sesiones de reproducción](../playback-session-architecture.md) y [compilación ES5 clásica](../build-pipeline.md).
- [Nombres de recursos de ejecución](../asset-layout.md), [política de versiones](../../RELEASING.md), [manual operativo de publicación](../release-workflow.md) y [fuzzing de RC](../../FUZZING.md).
- [Política de privacidad](../privacy-policy.md) y [licencia MIT](../../LICENSE).

Al modificar documentación, ejecuta `npm run docs:generate` cuando cambie una etiqueta de interfaz o plantilla de inicio rápido y luego `npm run check:docs`. Mantén completas todas las traducciones, sitúa las restricciones junto a las afirmaciones y distingue la validación local de las pruebas con dispositivos físicos. Los diagramas son recursos revisables del repositorio; consulta [el SVG de vinculación de guía](../images/guide-binding.svg) y los diagramas enlazados desde las guías. El comprobador valida destinos de archivos relativos, no la disponibilidad de sitios remotos ni todos los anclajes de encabezados Markdown.
