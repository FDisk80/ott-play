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

Archivos locales sin Internet: consulte [Vídeos locales y reproducción sin conexión](docs/offline-media.md).

[![Explorador de canales de OTT-play FOSS en perspectiva](docs/images/hero.png)](docs/images/studio-2026-default.png)

*Captura de la interfaz Studio 2026 existente, con ejemplos sintéticos de canales y programas. Abra la imagen para ver la versión original plana; no es una captura de una suscripción activa. [Origen de la imagen y regeneración](docs/images/README.md).*

[Guías rápidas en 88 idiomas](docs/readme/README.md) · [Wiki de documentación](docs/wiki/Home.es.md)

[![Buenas prácticas de OpenSSF](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![Fuzzing: solo RC](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

Los candidatos de publicación públicos ejecutan campañas de fuzzing limitadas y aisladas para el análisis XMLTV nativo/del servidor y la validación de solicitudes a portales. Consulte [alcance del fuzzing, reproducción y pruebas de publicación](FUZZING.md).

Reproductor IPTV/OTT autónomo con servidor HTTP local en Rust. Funciona en Smart TV (LG WebOS, Samsung Tizen, Panasonic, Sony, etc.), decodificadores (Infomir MAG, Dune HD, Enigma2, Android TV) y navegadores de escritorio.

Empiece por la [guía de arquitectura y contribución](docs/architecture.md) para conocer las capas de ejecución, responsabilidades, recetas de extensión de proveedores y verificaciones. Consulte [sesiones de reproducción y ciclos de vida de proveedores](docs/playback-session-architecture.md) para el límite entre núcleo y anfitrión y los contratos de compatibilidad.

<!-- ci-release-process:start -->
<a id="release-process"></a>

## Proceso de publicación

La [estrategia de versiones](RELEASING.md) describe la validación y las reglas de promoción nightly, beta, RC y estable; el [manual de operaciones](docs/release-workflow.md) contiene los comandos locales.
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## Ejecutar en un navegador

Abra la [demostración en línea](https://player.ottplay.here.now/) o compile y sirva el reproductor web con las instrucciones siguientes.

El [despliegue local en macOS](docs/local-http-deployment.md) proporciona orígenes HTTP del reproductor en los puertos 8443–8446. El puerto 8095 está retirado.

En el primer inicio, elija **Probar demostración** para reproducir el patrón de prueba en movimiento o configure su propia lista M3U o proveedor. La demostración también queda disponible en **Cambiar proveedor → Demostración**.

El modo de demostración necesita Internet, pero no una cuenta de proveedor. Sus canales de prueba MP4 y HLS sin sonido se alojan en here.now y los comparten el reproductor web, Tauri, Capacitor y OTT Server. Al cambiar se conservan los ajustes del proveedor existente. Para una **comprobación de imagen y sonido** independiente, abra **Información → Audio → Reproducir** con el motor HTML5 administrado en reposo o durante la televisión en directo. Usa el archivo de prueba audible `av-v1.mp4` alojado en here.now y necesita Internet. El clip no está incluido en los paquetes del reproductor y nunca se descarga al iniciar. Quedan excluidos VOD, archivo y las sustituciones de motor por dispositivo (incluidos PC2/Video.js y los motores nativos); consulte [pasos, tonos esperados y diagrama de alojamiento](docs/audio-video-check.es.md).

Las ventanas instaladas del navegador de escritorio admiten **Window Controls Overlay**: Chrome puede ocultar la barra de título independiente y conservar los botones de ventana y el menú de aplicación sobre el reproductor. Abra la aplicación instalada y elija **Ocultar barra de título** cuando Chrome lo ofrezca; **Mostrar barra de título** restaura el marco normal. Las pestañas comunes y los diseños de TV/contenedores nativos mantienen su comportamiento. Consulte [controles de ventana del navegador](docs/browser-window-controls.md) para los URL de instalación compatibles, la actualización de accesos directos existentes y las verificaciones.

Para avanzar o retroceder diez segundos en la vista principal del vídeo, use **Alt/Opción + Izquierda/Derecha** (**Comando + Izquierda/Derecha** también funciona en macOS), tanto a pantalla completa como en la vista normal. Los vídeos locales, VOD y archivos de canales compatibles usan los mismos controles en web, Tauri y Capacitor. Consulte [atajos de teclado y límites](docs/browser-window-controls.md#playback-keyboard-shortcuts).

En la interfaz PC, **R** reproduce otro canal o vídeo aleatorio de la lista actual sin alterar su orden. Funciona en la vista principal del vídeo y las listas de canales/vídeos; los editores de texto, diálogos, ajustes y restricciones de quiosco mantienen prioridad. Las asignaciones de teclas de otros dispositivos no cambian.

El patrón de prueba sintético se puede regenerar con `scripts/generate-demo-media.sh` (requiere FFmpeg); los medios generados permanecen en el directorio ignorado `.local-artifacts`.

<a id="features"></a>

## Funciones

- **Reproducción**: flujos HLS, DASH y HTTP simple, con límites de calidad administrados de HLS.js/Shaka, recuperación acotada y hasta tres URL de respaldo explícitos por canal en directo. El archivo/VOD nunca cambia a un respaldo en directo; consulte [calidad y recuperación](docs/playback-stream-policy.es.md).
- **EPG**: correspondencia XMLTV, desplazamiento temporal/televisión a la carta, búsqueda de títulos de programas (N5 en EPG), recordatorios y asociación manual de fuente/ID para un canal exacto en la ruta XMLTV alojada/nativa. Consulte [asociación y accesibilidad](docs/guide-binding-accessibility.es.md).
- **Favoritos**: una [colección mixta](docs/mixed-favorites.md) ordenada entre proveedores y perfiles configurados en dispositivos compatibles, con exportación/importación portátil mediante CLI; PIN parental. Las listas por fuente siguen disponibles en el modo alternativo.
- **Ajustes**: exportación/importación JSON de ajustes y favoritos, diario de deshacer para lotes localStorage compatibles, reanudación del archivo según la fuente y comparación exacta de ajustes guardados para los flujos del controlador. La recuperación supone un único escritor; los adaptadores de almacenamiento personalizados conservan una reversión de mejor esfuerzo. Consulte [recuperación de ajustes](docs/settings-recovery.es.md).
- **Interfaz compartida**: OTT Server, Tauri y Capacitor usan el mismo tema y ajustes de visibilidad de la lista de canales. Los ajustes de [colores de la interfaz](docs/interface-colors.md) ofrecen nueve roles de color, una paleta, entrada exacta de valores HEX/RGB/HSV y cinco esquemas y se guardan para cada cliente; los de la lista controlan nombres, picons, programas actuales, progreso y marcadores de archivo.
- **Proveedores**: M3U/M3U8, televisión en directo Xtream y [catálogos de películas/series bajo demanda](docs/xtream-media.es.md), Stalker/Ministra con [películas y episodios anidados](docs/stalker-media.md), Plex y VPortal. Las capacidades del proveedor y el acceso de la cuenta determinan las funciones de archivo y biblioteca disponibles.
- **Comandos push**: control remoto por webhook — cambiar canal, proveedor y lista, mostrar avisos emergentes.
- **Entrada remota de texto (swop)**: teclado del teléfono mediante Cloudflare Worker cuando TV y teléfono están en redes diferentes (sesiones autorizadas por instalación; ♥™ en el teclado virtual).
- **Enrutamiento por dispositivo**: direccionamiento mediante UUID para instalaciones con varios dispositivos.
- **Proxy local**: servidor de comandos local opcional para automatización completamente local (no necesita servidor central).
- **Integración con el controlador**: operadores limitados por dispositivo/acción, resultados de comandos duraderos opcionales, aplicación reanudable de perfiles Local/Home y transferencia de directo/archivo de la misma fuente mediante el [servidor de control](https://github.com/open-ott-play/ottplay-control-server) correspondiente. Requieren controlador/CLI actualizados; una pestaña de navegador independiente no los proporciona.
- **Preferencias remotas tipadas**: descubra los ajustes, lea los valores guardados y efectivos y guarde comprobando la instancia de ejecución, el origen y la revisión; consulte [ajustes remotos y configuración de VPortal](docs/remote-player-settings.md).
- **Depuración**: HUD de reproducción/registro circular opcionales mediante `?debug=1`, inspección remota con consentimiento y comprobación alojada de audio/vídeo bajo demanda.
- **Accesibilidad con teclado**: diálogos clásicos con nombre, contención y devolución del foco Tab, semántica del canal seleccionado y anuncios de estado no intrusivos. Estas mejoras no acreditan conformidad completa con WCAG ni con lectores de pantalla de dispositivos.
- **24 tipos de dispositivo**: asignaciones de teclas del mando por dispositivo.
- **88 idiomas de interfaz**: catálogos correspondientes, [guías rápidas localizadas](docs/readme/README.md) y [alfabetos de teclado comprobados con CLDR](docs/localization.md). El manual principal y las guías de funciones emparejadas están disponibles en [24 idiomas de documentación](docs/manual-translations.md); las demás referencias técnicas mantienen sus idiomas existentes.

La [guía de entrega](docs/roadmap-delivery.es.md) describe las funciones implementadas en esta revisión del código, los límites de plataforma, diagramas y verificaciones. Las versiones instaladas o los despliegues alojados pueden usar una revisión anterior. La [aplicación Android](https://github.com/open-ott-play/ottplay-android) nativa independiente también conserva las elecciones de audio/subtítulos por idioma, función y etiqueta en lugar de índices del manifiesto; su implementación y publicación son independientes de este frontend.

La [revisión de fuentes STB](docs/stb-player-improvements.md) explica las mejoras de medios, recursos y recuperación, las comparaciones de fuentes y sus límites actuales.

<a id="debug-hud"></a>

## HUD de depuración

El HUD local y la persistencia de registros del servidor se activan por separado. Consulte [acceso de diagnóstico, ocultación de datos y conservación](docs/diagnostic-security.md) antes de recopilar registros de otros dispositivos.

Active la depuración mediante una de estas opciones:
- URL: `?debug=1` o `?debug=true`.
- Almacenamiento local: `localStorage.setItem("ottplay_debug", "1")`.
- Propiedad de ventana: `window.__OTT_DEBUG__ = true`.
- Servidor: cuando `/debug/config` devuelve `{enabled: true}`.

Con la depuración activada:
- Pulse **D** para alternar la franja HUD (`ottDebugSetHud` / `__ottDebug.toggleHud()`).
  - Se omite cuando el foco está en INPUT/TEXTAREA/listEdit.
  - Usa `e.key` para evitar el conflicto MAG/Maple PLAY/PREV=68.
- Menú Información → **Debug HUD** → llama a `__ottDebug.toggleHud()`.
- Administrar ajustes → **Debug HUD**:
  - Si la depuración ya está cargada: alterna la visibilidad del HUD.
  - Si no: establece `ottplay_debug=1` + `ottplay_debug_hud=1` y solicita reiniciar.
- Persistencia: `ottDebugSetHud` guarda el estado en `localStorage.ottplay_debug_hud` ("1"/"0").

<a id="capacitor-ios-and-android"></a>

## Capacitor para iOS y Android

Este repositorio empaqueta el frontend TypeScript compartido con Capacitor para iOS y Android 7+. Ambos usan fuentes del sistema y el entorno nativo fijado por npm. Un APK de compatibilidad API 22 independiente admite Android 5.1/6 con WebView 60 o posterior. Ambos APK Android se firman y se incluyen en versiones beta, RC y estables calificadas, junto con el IPA iOS sin firmar. La aplicación Kotlin independiente permanece en [ottplay-android](https://github.com/open-ott-play/ottplay-android).

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

Consulte [configuración de Capacitor](docs/capacitor-mobile.md) y [distribución Android y actualizaciones remotas](docs/android-distributions.md).

La interfaz iOS usa orientación horizontal. Ajustes, configuración del proveedor, consentimiento de control remoto e importación/exportación JSON siguen usando el frontend compartido. La multitarea de tabletas puede anular la orientación solicitada.

En iPhone, deslice verticalmente sobre la lista de canales para recorrer filas y páginas: hacia arriba para canales posteriores y hacia abajo para anteriores. Un gesto rápido continúa varias páginas y desacelera; un arrastre lento mantiene la precisión. Toque la pantalla o pulse una tecla de navegación para detenerlo. Un toque inicia el canal bajo el dedo, aunque otra fila esté seleccionada. Un deslizamiento nunca abre el canal al levantar el dedo.

El vídeo se reproduce integrado en la interfaz del iPhone. Toque la parte inferior para información del programa o abra el menú mientras continúa la reproducción. Imagen en imagen sigue siendo una opción separada.

Prueba de dispositivo: [lista de comprobación del modo B](docs/mode-b-device-smoke.md) y `./scripts/smoke-capacitor-device.sh --help` (compilación/sincronización solo para iOS). Prueba de escritorio Tauri: [lista de escritorio](docs/mode-b-tauri-smoke.md).

<a id="installation"></a>

## Instalación

| Plataforma | Paquete | Notas |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Compilaciones separadas para Apple Silicon e Intel; firma ad hoc salvo que se configure la firma de Apple |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | Varias distribuciones |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode o Homebrew Channel](docs/lg-webos-installation.md); reproductor alojado, requiere red |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode y firma local; paquete de TV sin firmar, distinto de Family Hub](docs/samsung-tizen-installation.md) |
| **iOS** | `.ipa` mediante AltStore / TestFlight / Xcode | Solo instalación externa — todavía no está en App Store |
| **Android (frontend compartido)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | Paquetes Capacitor firmados; elija la versión Android compatible |
| **Android (Kotlin nativo)** | [Aplicación nativa](https://github.com/open-ott-play/ottplay-android) independiente | Repositorio público; aplicación y proceso de publicación separados |

Los instaladores compatibles se adjuntan a versiones calificadas de GitHub: [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **Nota:** los paquetes de aplicación macOS usan firma ad hoc si no hay credenciales de firma Apple; esto no proporciona Developer ID ni notarización. Los instaladores Windows/Linux y los paquetes iOS pueden estar sin firmar. iOS necesita firma antes de instalar en un dispositivo físico. Los APK de publicaciones Android Full y API 22 calificadas usan el certificado de firma establecido; las compilaciones locales de publicación necesitan un keystore configurado para producir APK firmados.

---

<a id="macos"></a>

### macOS

1. Elija la etiqueta deseada en [Versiones](https://github.com/open-ott-play/ottplay-foss/releases). El acceso a la última versión selecciona estable, no beta ni RC.
2. Descargue `OttPlay.FOSS_*_aarch64-apple-darwin.dmg` para Apple Silicon o `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` para Intel. Son compilaciones de arquitectura separadas.
3. Abra el `.dmg` y arrastre **OttPlay FOSS.app** a Aplicaciones.
4. Verifique el paquete copiado antes del primer inicio:

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

La verificación correcta comprueba la integridad del paquete. `Signature=adhoc` significa que la aplicación no tiene identidad de desarrollador autenticada por Apple; no acredita notarización ni aprobación de Gatekeeper. Con descarga fiable y paquete válido, macOS aún puede exigir **Ajustes del Sistema → Privacidad y seguridad → Abrir igualmente** tras el primer intento; consulte [las instrucciones de Apple](https://support.apple.com/en-us/102445).

Un mensaje «la aplicación está dañada» no demuestra que el único problema sea la cuarentena. Si falla la verificación de firma, conserve el error y obtenga una versión corregida. No vuelva a firmar la aplicación descargada ni elimine atributos para hacer pasar por correcta una verificación fallida.

Las alternativas ZIP son `OttPlay.FOSS_aarch64-apple-darwin.app.zip` y `OttPlay.FOSS_x86_64-apple-darwin.app.zip`. Consulte [firma macOS y verificación de artefactos](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact) para extracción, imagen de disco y Gatekeeper. Para compilaciones desde la copia del repositorio e instalación local, use [entrega local macOS](docs/macos-local-delivery.md).

---

<a id="windows"></a>

### Windows

1. Descargue `.msi` o `.exe` de [Versiones](https://github.com/open-ott-play/ottplay-foss/releases/latest).
2. Ejecute el instalador y siga las indicaciones.
3. Inicie desde el menú Inicio o el acceso directo del escritorio.

---

<a id="linux"></a>

### Linux

La reproducción en Linux necesita complementos GStreamer para HLS, H.264 y AAC además de WebKitGTK. Los paquetes declaran estas dependencias; AppImage incluye el entorno multimedia. Consulte [empaquetado multimedia Linux](docs/linux-media-packaging.md) para comprobar códecs y distinguir la aceptación del navegador de la nativa.

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

### Instalación en iOS

iOS requiere firma antes de instalar en un dispositivo físico. Use AltStore Classic para el IPA de publicación sin firmar o compile y firme el código con Xcode. TestFlight requiere una invitación separada, cuando se ofrezca.

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### Opción 1: AltStore Classic (recomendado para uso personal)

AltServer se ejecuta en el ordenador; AltStore Classic se ejecuta en iPhone/iPad e importa el IPA. Basta una cuenta Apple gratuita.

**Requisitos:**

- iPhone/iPad con **iOS/iPadOS 15 o posterior** para la compilación actual de OTT-play.
- Mac o PC Windows con AltServer y cable USB de datos.
- Cuenta Apple para firmar y acceso a Internet para descargar la versión.

**Paso 1: configurar AltStore una vez**

1. Instale AltServer siguiendo su [configuración oficial para macOS](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) o [Windows](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows). Inícielo y use el icono de barra de menús/bandeja del sistema.
2. Conecte el dispositivo por USB, desbloquéelo y acepte las solicitudes de confianza del ordenador/dispositivo. En Mac, compruebe que aparece en Finder.
3. En **menú AltServer → Install AltStore**, elija el dispositivo y complete las solicitudes de cuenta de firma. Espere la notificación de instalación.
4. En el dispositivo, abra **Ajustes → General → VPN y gestión de dispositivos** y confíe en la entrada de desarrollador de su cuenta de firma si se solicita. En iOS 16+, active **Ajustes → Privacidad y seguridad → Modo de desarrollador** y complete el reinicio y las confirmaciones.
5. Abra AltStore en el dispositivo. Si ya está instalado y funciona, omita esta configuración y deje AltServer ejecutándose para la importación siguiente.

**Paso 2: importar la versión seleccionada en iPhone/iPad**

1. Elija una etiqueta exacta de [todas las versiones](https://github.com/open-ott-play/ottplay-foss/releases) y descargue su `ottplay-foss-ios-unsigned.ipa` en Safari del dispositivo. El [acceso a la última versión](https://github.com/open-ott-play/ottplay-foss/releases/latest) selecciona una estable; use la lista completa para instalar beta.
2. Guarde el IPA en Archivos. En **AltStore → My Apps → +**, seleccione el archivo. También puede transferir por AirDrop un IPA descargado en el Mac y guardarlo en Archivos antes de importar. Abrir el IPA en el Mac no realiza este paso de importación.
3. Mantenga AltServer ejecutándose y el USB conectado mientras AltStore firma e instala. Para actualizar, use la misma cuenta de firma de la instalación existente; no elimine la aplicación como primer paso de diagnóstico.
4. Espere a que finalice la importación, compruebe OTT-play en **My Apps** e inícielo.

**Alternativa: importar directamente el URL de la versión**

Con AltStore ya instalado, introduzca este patrón en **Safari del iPhone**, sustituyendo `TAG` por la etiqueta exacta, y acepte **Open in AltStore**:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

Usa el [manejador de URL de instalación de AltStore](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift). Evita una entrada ambigua de Archivos/Recientes cuando varias descargas comparten nombre. El URL debe apuntar al archivo IPA, no a la página de versión.

Por ejemplo, esta importación se verificó el **2026-09-29** con AltStore 2.3 y AltServer 1.8.1. Es un ejemplo histórico fijo, no un enlace a la última versión:

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**Renovación:** las instalaciones con cuenta gratuita caducan tras siete días. Mantenga AltServer accesible y use **AltStore → My Apps → Refresh All** antes de caducar. La renovación en segundo plano también necesita AltServer; consulte [las instrucciones de renovación](https://faq.altstore.io/altstore-classic/your-altstore).

<a id="verify-the-installed-version-before-retrying"></a>

#### Verificar la versión instalada antes de reintentar

El mensaje «Enviado» de AirDrop solo confirma la transferencia. Una barra de progreso de AltStore confirma que empezó la importación. Perder la conexión de duplicación/USB no demuestra que la instalación fallara: compruebe la aplicación instalada antes de enviar de nuevo el IPA.

En un Mac con Xcode instalado y seleccionado como directorio de desarrollo activo, inspeccione el dispositivo sin reinstalar:

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

En `result.apps` del JSON, encuentre OTT-play (`bundleIdentifier` empieza por `play.ott.foss`) y compare `version` y `bundleVersion` con `CFBundleShortVersionString` y `CFBundleVersion` del IPA elegido. Es normal un sufijo de cuenta de firma AltStore en el identificador. Conserve localmente el informe del dispositivo.

El ejemplo beta.9 verificado informa **versión `1.1.51`, compilación `2.2.66`**. Esto confirma la instalación; abrir la aplicación, iniciar sesión en Cloudflare, cargar la lista, reproducir y PiP son comprobaciones separadas del dispositivo.

<a id="troubleshooting-ios-installation"></a>

#### Resolver problemas de instalación en iOS

- **AltServer no tiene ventana o abrirlo mediante automatización agota el tiempo:** use el icono de barra de menús/bandeja. Es una aplicación en segundo plano. Intentar repetidamente abrir una ventana normal no importa el IPA.
- **«Could not find AltServer» o dispositivo USB no disponible:** compruebe que AltServer está ejecutándose, desbloquee el teléfono y revise las solicitudes de confianza. Compruebe la visibilidad en Finder en Mac. Si se perdió la conexión, restablézcala cuando sea seguro y compruebe la versión instalada antes de reintentar. Si persiste, siga [el diagnóstico de conectividad de AltStore](https://faq.altstore.io/altstore-classic/troubleshooting-guide). Si el teléfono proporciona Internet al ordenador, coordine cualquier cambio de cable o red para no interrumpir otros trabajos.
- **Duplicación del iPhone indica «iPhone in Use» o permanece en «Connecting»:** finalice la configuración en el teléfono físico o bloquee su pantalla y déjelo cerca del Mac desbloqueado para duplicarlo. Desbloquear el teléfono termina la duplicación; la confianza/configuración USB puede necesitar primero desbloquearlo. Si una reconexión vuelve a atascarse, cierre la duplicación y continúe en el teléfono. Consulte [los requisitos de Apple](https://support.apple.com/en-us/120421). La duplicación es opcional para instalar.
- **El URL pierde letras latinas o se convierte en cirílico al duplicar:** cambie la **fuente de entrada del Mac a ABC/Inglés**. Con la duplicación enfocada, pulse **Control–Espacio** y seleccione **English (US)** para el teclado físico del iPhone. Las fuentes del Mac y del iPhone pueden ser distintas; cambiar solo la del Mac no bastó en nuestra sesión verificada. Vacíe el campo, escriba de nuevo el URL y compruébelo antes de enviar.
- **Pegar desde el portapapeles en la duplicación se bloquea o inserta texto inesperado:** vacíe el campo y vuelva a escribir lentamente en fragmentos cortos con la fuente English (US) del iPhone o introduzca el URL directamente en el teléfono. La entrada rápida por duplicación puede perder o duplicar caracteres; verifique la dirección completa antes de guardar. No envíe un URL pegado parcialmente. Pegar falló en nuestra sesión; no es requisito del método de URL directo.
- **Archivos/Recientes muestra varios IPA con el mismo nombre:** seleccione la ubicación exacta de descarga o use el URL directo con etiqueta anterior. Puede renombrar una copia local con etiqueta/compilación para identificarla; esto no altera su contenido.
- **La aplicación instalada no abre:** siga las solicitudes de confianza del desarrollador o modo de desarrollador en el teléfono. Compruebe la caducidad en AltStore y renueve si hace falta. Registre el error real si persiste; un error de conexión por sí solo no justifica eliminar y reinstalar.
- **OTT-play abre, pero una lista protegida falla por datos móviles:** instalación y autenticación de la fuente son distintas. Use **Ajustes → Administrar ajustes → Acceso a la fuente** para iniciar sesión en una fuente configurada y vuelva a cargar la lista. Complete las solicitudes biométricas/passkey o de código por correo en el dispositivo físico cuando sea necesario. La fuente debe admitir [la integración iOS Access](docs/ios-source-access.md); instalar no evita una lista de IP autorizadas.
- **Se solicita passkey estando en Wi-Fi de confianza:** para fuentes con integración iOS Access, la aplicación primero prueba la fuente original sin iniciar sesión y usa la entrada móvil autenticada solo tras una denegación de acceso. Compruebe la IP pública que realmente ve la fuente, incluida IPv6: una IPv4 doméstica autorizada no cubre otra IPv6, VPN o dirección móvil. Cambiar de red y reabrir la aplicación limpia su preferencia temporal de ruta. Un error genérico de red/servidor no debería solicitar inicio de sesión.
- **Ya no aparece inicio de sesión, pero la lista está vacía:** una sesión guardada válida se reutiliza sin preguntar de nuevo. Tras una carga fallida anterior o una corrección del servidor, recargue la lista o cierre completamente y reabra una vez la aplicación. Si sigue fallando, verifique que la fuente devuelve una lista y no una página HTML de inicio de sesión o un error JSON. Registre el error mostrado y el estado HTTP; no comparta URL de fuentes con credenciales, cookies o tokens Access.
- **Los canales cargan, pero el vídeo almacena en búfer o informa `SRC_NOT_FOUND`:** cargar listas y reproducir vídeos son comprobaciones distintas. Reintente una vez el canal tras iniciar sesión; si persiste, revise las respuestas del manifiesto y segmentos HLS y la compatibilidad del códec. El error por sí solo no demuestra que cambiar de motor o reinstalar ayude.

<a id="option-2-testflight-if-available"></a>

#### Opción 2: TestFlight (si está disponible)

Si se publica una invitación TestFlight, instale TestFlight desde App Store, abra la invitación en el dispositivo y pulse **Instalar**. Descargar un IPA de GitHub no proporciona una invitación TestFlight.

<a id="option-3-xcode-for-developers"></a>

#### Opción 3: Xcode (para desarrolladores)

Siga [Compilar y abrir](docs/capacitor-mobile.md#build-and-open), seleccione el destino **App** en Xcode, configure su equipo de desarrollo en **Signing & Capabilities**, elija el dispositivo conectado y compile/ejecute. Complete las solicitudes de confianza y modo de desarrollador. Importar el IPA de publicación sin firmar a la ventana Devices de Xcode no aporta la identidad de firma ni el perfil de aprovisionamiento ausentes.

---

<a id="android-application"></a>

### Aplicación Android

Elija el APK Full Capacitor de las versiones de este repositorio para la interfaz compartida. Use el APK de compatibilidad API 22 en Android 5.1–6; necesita WebView 60 o posterior. Conserve la identidad de aplicación y el certificado de firma al actualizar para mantener disponibles los perfiles existentes. Consulte [instrucciones de compilación](android/README.md) y [distribución, firma e instalación remota](docs/android-distributions.md).

El [repositorio ottplay-android](https://github.com/open-ott-play/ottplay-android) independiente contiene la aplicación nativa Kotlin/Compose. Tiene identidad, preferencias y proceso de publicación propios y no sustituye una instalación Capacitor directamente. Los artefactos históricos siguen disponibles.

---

<a id="quick-start"></a>

## Inicio rápido

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

Para las pruebas básicas del navegador, use su propio despliegue de la misma revisión.

Use Node 22 y el conjunto de herramientas estable de Rust. Ejecute el servidor desde la raíz del repositorio para que encuentre los recursos estáticos. Las compilaciones nativas necesitan las herramientas de plataforma descritas abajo; no hacen falta para compilar solo el servidor.

En la primera carga, elija **Probar demostración** o abra **Ajustes → Cambiar proveedor → Listas M3U / M3U8**. Abra **Seleccionar lista**, elija una posición, introduzca **URL de la lista**, guarde y seleccione **Cargar lista**. Usted proporciona la lista o la cuenta de proveedor; la aplicación no incluye una suscripción de canales de pago.

<a id="mode-a-companion-smoke"></a>

## Prueba básica del servidor auxiliar en modo A

Prueba mediante curl del servidor auxiliar modo A (paridad de `ottplay-server` / `archive/server.py`): índice, directorios estáticos, `/logo`, `/version`, `/epg` opcional y sondeo de `POST /m3u/cp.php` sin descargar desde la fuente.

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

Las comprobaciones están en `scripts/modea-smoke-checks.json`. Sin secretos. La cola de comandos / `local_proxy.py` (:8081) se cubre por separado con `scripts/smoke-command-queue.sh` cuando está disponible.

<a id="classic-stalker--ministra-portals"></a>

## Portales clásicos Stalker / Ministra

Elija **Portales Stalker** e introduzca la MAC asignada por el proveedor y el URL completo del portal, por ejemplo `http://provider.example/stalker_portal/c/`. Los URL `/c/index.html`, `/stalker_portal`, `/server/load.php`, `/load.php` y `/portal.php` seleccionan el protocolo MAG clásico. Las configuraciones existentes con dirección de servidor sin ruta mantienen JSON-RPC. El proveedor carga perfil, géneros y canales en directo paginados mediante el núcleo Stalker compartido y después descubre en segundo plano películas y episodios anidados del protocolo clásico `type=vod`. Las rutas de carpetas se convierten en categorías de la lista normal de canales; las descripciones y los pósteres disponibles y los favoritos globales con referencias estables usan la misma interfaz multimedia. Consulte [el comportamiento y los límites del catálogo](docs/stalker-media.md).

Las solicitudes del navegador con servidor propio pasan por `/stalker/api` del auxiliar; las aplicaciones nativas usan su transporte HTTP existente. Los navegadores alojados necesitan rutas configuradas expresamente a través del [relay dedicado](docs/stalker-relay.md). Los recursos del navegador y del servidor deben actualizarse juntos.

La reproducción en directo resuelve los comandos temporales del canal al abrir el flujo; cambiar de canal, detener, PiP y sustituir el proveedor cancelan resoluciones obsoletas. Los comandos HTTP(S) explícitos no temporales se reproducen directamente. Se admite EPG breve. Este proveedor no expone el archivo del portal clásico ni el protocolo independiente `type=series`. El comportamiento existente de archivo/guía JSON-RPC no cambia. Los portales LAN privados que usan la ruta del auxiliar necesitan una entrada exacta en `OTTPLAY_PROXY_LAN_ORIGINS`, como las demás rutas proxy del auxiliar.

La demostración pública Infomir es `http://middleware-stalker.com/stalker_portal/c/`. Devolvió tres entradas de catálogo en directo el 2026-09-26, pero sus puntos de acceso multimedia no estaban disponibles; use un portal/medio de prueba controlado para regresión de reproducción.

<a id="m3u-stream-proxy-header-smoke"></a>

## Prueba de cabeceras del proxy de flujos M3U

Compara las cabeceras de solicitudes ascendentes que inyecta `POST /m3u/cp.php` del auxiliar modo A al obtener un URL de eco controlable (simulación local por defecto — sin proveedores IPTV ni secretos).

Contrato (de `src-rs/core/src/m3u.rs` + `archive/server.py`):
- Inyecta solo **User-Agent** (`OTT-play-FOSS/1.0` por defecto o perfiles `webos` / `tizen` / `viera` / `mag` / `dune`).
- **No** inyecta **Referer** (`M3UProxy` de Capacitor sí; modo A no).
- Elimina un `@` inicial de `url` (formulario jQuery del proveedor).

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

Salida: `0` correcto, `1` no está escuchando, `2` discrepancia de cabeceras/HTTP, `3` uso/dependencias. Complementa `smoke-modea-companion.sh` / `smoke-command-queue.sh`.

<a id="logo-concurrent-bench-smoke"></a>

## Prueba concurrente de rendimiento de logotipos

Prueba de latencia con `GET /logo/<id>.svg` concurrentes (`?ch=` opcional) contra el auxiliar modo A. Informa cantidades correctas/fallidas y p50/p95/p99. La carga predeterminada es práctica para CI local (`CONCURRENCY=200`, `TOTAL=1000`); la prueba prolongada de 10 000 solicitudes es opcional (`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`).

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

Salida: `0` correcto, `1` no escucha / conexión fallida, `2` tasa de errores alta, `3` uso. Complementa `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`.

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## Prueba de actualización y calentamiento de caché XMLTV

Verifica el comportamiento real de la caché XMLTV/EPG del auxiliar modo A contra `src-rs` (sin API inventadas):

- `EPG_CACHE` en memoria servido por `GET /epg/:hash` → siempre `{"epg_data":[...]}` (HTTP 200).
- El inicio del proceso obtiene `EPG_URLS` en segundo plano sin retrasar el inicio HTTP; después de cada descarga completada espera **2 horas** antes de actualizar de nuevo.
- Persistencia SQLite opcional cuando se define `DATABASE_URL` (sin punto público de estado de caché).
- `GET /health` → `OK` confirma disponibilidad HTTP tras un reinicio opcional. Con `--strict-epg` y `--epg-hash`, la prueba también espera EPG no vacío del canal dentro del mismo presupuesto `--warmup-timeout`.

La ruta predeterminada solo usa curl — **no termina procesos**. Pase `--restart-cmd` / `RESTART_CMD` para terminar y reiniciar automáticamente o siga los pasos manuales `launchctl` en `--help`.

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

Salida: `0` correcto, `1` no escucha, `2` aserción/calentamiento fallido, `3` uso. Complementa `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`.

<a id="mode-a-e2e-play-path-smoke"></a>

## Prueba integral de la ruta de reproducción modo A

Prueba de **ruta de reproducción / disponibilidad del flujo** del lado auxiliar (solo HTTP — **no** una prueba integral de interfaz con ventana visible). Contra un auxiliar modo A en ejecución comprueba:

- Salud o índice accesibles.
- Recursos estáticos del contenedor del reproductor (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`).
- `GET /epg/<hash>.json` opcional cuando se define `EPG_HASH`.
- `POST /m3u/match-channels` con un ejemplo JSON sin secretos (lista vacía + un canal sintético).
- **Reproducción** por proxy: `POST /m3u/cp.php` contra un medio controlable (lista HLS local por defecto o `MEDIA_URL`) y validación de HTTP 200 + cuerpo no vacío / `Content-Type` esperado (primeros bytes por el proxy).

Sin credenciales IPTV privadas. Complementa `smoke-modea-companion.sh` (presencia), `smoke-m3u-stream-proxy-headers.sh` (UA/Referer) y `smoke-xmltv-cache-refresh.sh`.

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

Salida: `0` correcto, `1` no escucha, `2` aserción fallida, `3` uso/dependencias.

<a id="capacitor-device-smoke-mode-b"></a>

## Prueba de dispositivo Capacitor (modo B)

**Lista de comprobación** para simulador/emulador (dispositivo físico opcional) de modo B Cap — no HTTP del auxiliar modo A. Una persona marca los resultados de interfaz; el ayudante automatiza herramientas, directorios nativos y curl tolerante de la cola de comandos.

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

Detalles: [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md). Complementa `smoke-command-queue.sh` (loopback Cap); no confundir con las pruebas modo A anteriores.

<a id="tauri-desktop-smoke-mode-b"></a>

## Prueba de escritorio Tauri (modo B)

Lista de escritorio y ayudante para modo B Tauri (ventana / reproducción de canal / PiP). No es HTTP del auxiliar modo A ni prueba de dispositivo Cap.

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

Detalles: [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md). Las credenciales de desarrollador Apple son opcionales para la prueba local; use [firma ad hoc](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials) para una aplicación Mac empaquetada. La aceptación humana sigue cubriendo inicio, reproducción y PiP.

<a id="docker"></a>

## Docker

Las imágenes multiarquitectura (amd64/arm64) se construyen como archivos OCI candidatos. La publicación en el registro promueve el archivo estable aprobado a Docker Hub sin reconstruir; consulte [manual de operaciones](docs/release-workflow.md).

El binario del servidor se compila con **musl** (Alpine) y se distribuye sobre Alpine — **no** requiere GLIBC_2.38+. Así `alvit/ottplay-foss` puede funcionar en Docker de Synology DSM (x86_64) y otros anfitriones con glibc antigua.

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

Las etiquetas estables del registro usan `X.Y.Z`. Actualizar `latest` es una opción explícita separada tras publicar la imagen versionada; los envíos a main y etiquetas Git no publican imágenes.

<a id="build-from-source"></a>

## Compilar desde el código fuente

Las reglas de dominio del reproductor proceden del artefacto Kotlin multiplataforma fijado en `vendor/ottplay-core.js`. Las decisiones sobre guía, archivo, listas, proveedores, estado duradero y reproducción comparten implementación con FOSS2 y Android nativo. Los adaptadores de navegador/TV, Swift y Rust conservan API de dispositivo, códecs, red y efectos de interfaz. El artefacto del navegador mantiene sintaxis ES5 y el arranque de API antiguas admitidas. `npm test`, `check:bundle` y `check:es5` verifican la integración; el manifiesto registra hashes de fuente y salida.

Los validadores de protocolo Control-server y SWOP se generan desde el esquema versionado `contracts/ottplay-wire-v1.json`. Sus recibos de generación comprobados y ejemplos inmutables de compatibilidad evitan copias de políticas específicas de cada consumidor.

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

## Detección de dispositivos

El reproductor admite 24 tipos de dispositivo. Primero detecta mediante el URL `/f/{device_id}/` y después mediante User-Agent.

| ID de dispositivo | Dispositivo |
|---|---|
| `pc` | Navegador PC |
| `pc2` | Reproductor web videojs |
| `nodejs` | Aplicación Windows (Electron) |
| `lg/webos` | Televisores LG WebOS |
| `samsung/tizen` | Televisores Samsung Tizen |
| `samsung/maple` | Televisores Samsung Orsay |
| `mag` | Decodificadores Infomir MAG |
| `dune` | Decodificadores Dune HD |
| `android` | Android TV / tabletas |
| `hbbtv` | Televisores HbbTV |
| `panasonic` | Televisores Panasonic Viera |
| `philips` | Televisores Philips |
| `sony` | Televisores Sony |
| `sharp` | Televisores Sharp |
| `toshiba` | Televisores Toshiba |
| `hisense` | Televisores Hisense |
| `skyworth` | Televisores Skyworth |
| `tcl` | Televisores TCL |
| `vewd` | Dispositivos Vewd |
| `spark` | Receptores Spark |

<a id="push-command-system"></a>

## Sistema de comandos push

Para un servicio separado con varios dispositivos, use [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) y la sección **Servidor de comandos** en **Ajustes → Control remoto**. Introduzca su IP/dirección y el código de acceso de este reproductor; guardar ambos inicia automáticamente el sondeo de comandos de volumen, canal y otros. Una IP sin puerto usa HTTP 8081. Vacíe la dirección o seleccione **Desconectar** para detenerlo. Esta conexión saliente admite entrega confirmada y no necesita un receptor local. Consulte [detalles de conexión y compatibilidad](docs/remote-command-server.md). Los ejemplos siguientes describen el modo existente de proxy/receptor local.

**Buscar servidor de órdenes** permite encontrar un controlador y solicitar la aprobación del operador sin copiar un token de dispositivo. Tauri consulta primero el DNS nativo y, si el resultado está vacío, puede recurrir a un perfil de despliegue configurado explícitamente; los reproductores de navegador, LG y Capacitor usan la ruta del perfil del navegador. Los metadatos de descubrimiento de Home pueden alojarse en here.now de forma independiente del controlador. Las compilaciones genéricas no incluyen automáticamente ese perfil Home y las actualizaciones no sustituyen las conexiones guardadas. Consulte [el comportamiento por plataforma, la configuración del perfil y la resolución de problemas](docs/remote-command-server.md#discovery-and-one-time-approval).

El control remoto HTTP local está **desactivado por defecto** en navegador/reproductor OTT server, Tauri y Capacitor. Actívelo en **Ajustes del reproductor → Control remoto** para generar un código secreto de dispositivo. Los comandos son objetos JSON con campo `"command"`; las solicitudes HTTP requieren `Authorization: Bearer <device-code>`.

<a id="architecture"></a>

### Arquitectura

<a id="local-command-url-recommended"></a>

#### URL de comandos local (recomendado)

Active **Control remoto HTTP local** en **Ajustes del reproductor → Control remoto**, copie el **Código de dispositivo** generado y configure el proxy siguiente con él. Establezca **URL de comandos local** en el punto de comandos del proxy. Mientras esté activado, el reproductor sondea ese URL cada diez segundos con el código en Authorization. Definir un URL no activa por sí solo el control.

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### UUID del dispositivo

El UUID existente (por ejemplo `dev_a1b2c3d4e5`) es metadato público de enrutamiento, no una credencial de autorización. El **Código de dispositivo** separado se genera de forma segura al activar HTTP local y permanece en este dispositivo; no se copia mediante ajustes en la nube. Desactivar HTTP local detiene sondeos/receptores. Reactivarlo genera un código nuevo: actualice proxy e integraciones para revocar la credencial antigua.

Tauri y Capacitor inician su receptor HTTP loopback solo después de esta activación. Los proxies de reenvío deben enviarle el código mostrado como token Bearer. El modo A usa la cola `local_proxy.py` configurada por separado y descrita abajo.

<a id="remote-text-entry-swop"></a>

#### Entrada remota de texto (swop)

Objetivo: escribir desde un teléfono para ♥™ / teclado virtual remoto cuando TV y teléfono están **en redes diferentes**, mediante transferencia de sesión Cloudflare Worker.

- Repositorio Worker: [ottplay-swop](https://github.com/open-ott-play/ottplay-swop).
- **Autorización de instalación:** el reproductor envía solicitudes al repetidor `/swop` del mismo origen en su servidor. Ese servidor añade su token privado de instalación; cualquier cliente del origen registrado puede usar entrada remota. Los UUID identifican sesiones y no necesitan lista de dispositivos autorizados.
- Ajuste: `swopBaseUrl` (vacío = ♥™ muestra «sin configurar» / no actúa). Edítelo en **Ajustes → Control remoto** (tecla **2**) o inyéctelo mediante `/local/swop.json`, ignorado por Git, en instalaciones de operadores.
- `POST /session` incluye `clientId`, `caption` y `draft`; `POST /val` incluye `clientId`, `code` y el `sessionToken` devuelto. El URL del teléfono contiene un token de escritura separado. Los tokens de lectura de sesión permanecen en memoria del navegador.
- **Instalación local:** configure `SWOP_BASE_URL` y `SWOP_INSTALLATION_TOKEN` tras registrar la instalación y sus orígenes LAN/localhost exactos en el Worker. `scripts/install-ottplay-local-service.sh` los conserva en su plist launchd privado con modo 0600. El `/local/swop.json` público solo contiene `{"swopBaseUrl":"/swop"}`. Nunca coloque el token de instalación en recursos públicos.
- **Alojamiento estático:** configure un proxy autenticado del servidor para esos mismos dos puntos. Mantenga el token en los secretos del servicio de alojamiento. Copiar los archivos públicos del reproductor no copia esa credencial del servidor.

> El servidor OTT central mantiene desactivados `/api/webhook/commands`, `/webhook/poll`, `/webhook/notify` y los alias de salud de comandos para todos los métodos HTTP. Use el servidor de comandos separado o un `local_proxy.py` autenticado configurado explícitamente para modo A; el servidor central no tiene cola de difusión de comandos.

<a id="available-commands"></a>

### Comandos disponibles

Todos los ejemplos siguientes usan `http://192.168.1.50:8081/api/webhook/commands` como URL del proxy local. Sustitúyalo por su dirección real y establezca `OTTPLAY_QUEUE_HTTP_TOKEN` en el **Código de dispositivo** mostrado tras activar HTTP en los ajustes. El proxy debe configurarse con el mismo código.

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — mostrar aviso emergente

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| Campo | Tipo | Predeterminado | Descripción |
|---|---|---|---|
| `message` | string | obligatorio | Texto que se mostrará |
| `popup_duration` | number | 5 | Segundos de visualización (esquina superior derecha) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — cambiar de canal por posición

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| Campo | Tipo | Predeterminado | Descripción |
|---|---|---|---|
| `channel_number` | number | obligatorio | Posición del canal en la lista, empezando en 1 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — cambiar de canal por nombre completo o parcial

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

Búsqueda de subcadena sin distinguir mayúsculas. Se usa la primera coincidencia.

| Campo | Tipo | Predeterminado | Descripción |
|---|---|---|---|
| `channel_name` | string | obligatorio | Nombre del canal o una parte |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — cambiar a canal aleatorio

Este comando heredado selecciona canales aptos de la lista o categoría actual. Los números de canal y los intervalos indican posiciones en esa lista; consulte la [política de selección aleatoria segura](docs/remote-command-server.md#safe-random-playback).

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

| Campo | Tipo | Predeterminado | Descripción |
|---|---|---|---|
| `random_range` | [start, end] | lista actual | Intervalo que empieza en 1 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — cambiar proveedor IPTV

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| Campo | Tipo | Predeterminado | Descripción |
|---|---|---|---|
| `provider` | number | obligatorio | Índice del array de proveedores (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — cargar una lista M3U nueva

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| Campo | Tipo | Predeterminado | Descripción |
|---|---|---|---|
| `playlist` | string | obligatorio | URL de la lista M3U |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — actualizar configuración del proveedor

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| Campo | Tipo | Predeterminado | Descripción |
|---|---|---|---|
| `provider_settings` | string | obligatorio | Cadena JSON con configuración del proveedor |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — establecer o ajustar volumen

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

Se ignora silenciosamente en clientes sin control de volumen.

| Campo | Tipo | Predeterminado | Descripción |
|---|---|---|---|
| `volume` | number | — | Nivel absoluto 0–100 |
| `volume_step` | number | — | Cambio relativo, por ejemplo +10 o -5 |

<a id="player-standby-restart-and-exit"></a>

#### Espera, reinicio y salida del reproductor

La cola webhook sin confirmación del proxy local no admite `exit_player` ni solicitudes tipadas de espera/reactivación. Conecte el reproductor al [servidor de comandos](docs/remote-command-server.md) y use su CLI:

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

Sustituya `d1` por el alias registrado. `stop` es alias de `standby`; `start` y `wake` son alias de `go`. Go requiere un reproductor ejecutándose y conectado; no puede iniciar una aplicación cerrada ni despertar un dispositivo desconectado. Un navegador o TV sin salida de aplicación nativa informa que salir no está admitido. La espera mantiene activo el sondeo remoto y no suspende trabajo ajeno del anfitrión o servidor compartido.

Tras standby/go, compruebe con `ott d1 status` el estado de espera/segundo plano y verifique aparte la reproducción reanudada. Tras recargar, confirme un entorno nuevo con `ott d1 doctor`. Tras salir, confirme en el sistema operativo que terminó el proceso; un timeout remoto no demuestra salida. Aceptar el comando no confirma por sí solo estos resultados.

<a id="local-proxy-server"></a>

## Servidor proxy local

`local_proxy.py` es una cola autenticada independiente para un reproductor. Su invocación predeterminada termina sin abrir puerto. Cada instancia usa el código generado por el reproductor; use instancias/puertos separados para varios. Se acepta el parámetro de consulta `device_id` como metadato de compatibilidad y nunca autentica ni selecciona otro dispositivo.

<a id="start-the-proxy"></a>

### Iniciar el proxy

1. Active **Control remoto HTTP local** en el reproductor y copie su **Código de dispositivo**.
2. En el anfitrión del proxy, configure el código y el origen exacto que sirve el reproductor (esquema, host y puerto, sin ruta):

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. Establezca **URL de comandos local** del reproductor en `http://192.168.1.50:8081/api/webhook/commands`.

La dirección de escucha predeterminada es `127.0.0.1`; el ejemplo activa explícitamente LAN. `OTTPLAY_QUEUE_HTTP_ORIGINS` es una lista separada por comas de orígenes de navegador exactos permitidos. Use proxy inverso HTTPS si sirve el reproductor por HTTPS para que las reglas de contenido mixto permitan sondeos. Mantenga secreto el código y fuera de los URL. Si el reproductor genera otro código, reinicie el proxy con el valor nuevo; desactivar solo el reproductor no detiene un proxy gestionado aparte.

<a id="endpoints"></a>

### Puntos de acceso

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/webhook/commands` | Encolar un comando |
| `GET` | `/api/webhook/commands` | Recuperar comandos en cola (sondeo del reproductor) |
| `POST` | `/webhook/notify` | Alias de compatibilidad autenticado |
| `GET` | `/webhook/poll` | Alias de compatibilidad autenticado |

Enviar y extraer requieren el código Bearer correspondiente. No hay punto de difusión sin autenticar. Los comandos caducan tras 60 segundos; cada proxy conserva como máximo 50.

El proxy maneja hasta 16 conexiones simultáneas, por lo que una conexión de navegador inactiva o solicitud incompleta no retrasa otras. Cada socket tiene timeout de inactividad de cinco segundos; se cierran conexiones adicionales si todos los trabajadores están ocupados. Insertar y extraer de la cola son operaciones atómicas entre trabajadores.

<a id="smoke-script-all-modes"></a>

### Script de prueba (todos los modos)

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Emulador/dispositivo Android: primero `adb forward tcp:18081 tcp:18081`. Cap/Tauri solo usan loopback; use este proxy modo A para Home Assistant en LAN. Detalles: `docs/capacitor-mobile.md`, sección Smoke test.

<a id="cors"></a>

### CORS

El proxy solo permite solicitudes del navegador desde `OTTPLAY_QUEUE_HTTP_ORIGINS`. Las previas `OPTIONS` de un origen permitido no necesitan token; todo GET/POST real requiere código Bearer. No se aceptan orígenes comodín ni `null`. Home Assistant y otros clientes no navegador pueden omitir Origin, pero necesitan autenticación.

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### Ejemplo: webhook Home Assistant → proxy local → reproductor

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

### Ejemplos de automatización Home Assistant

Los ejemplos de avisos, canales y volumen usan el proxy local. Configure `ottplay_device_authorization` en `secrets.yaml` de Home Assistant como `Bearer <device-code>` usando el código del reproductor activado.

La espera nocturna usa el [servidor de comandos](docs/remote-command-server.md) separado. Sustituya su URL de ejemplo y `DEVICE_UUID` por la dirección del controlador y el ID registrado; el alias local CLI `d1` no es ID de dispositivo. Configure `ottplay_control_authorization` como `Bearer <controller-admin-token>` en `secrets.yaml`. Es una credencial distinta del código del proxy local. Consulte la documentación Home Assistant de [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) y [secretos](https://www.home-assistant.io/docs/configuration/secrets/).

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

`standby_request` contiene la respuesta HTTP para la traza de automatización. HTTP 202 solo significa encolado: conserve `content.id` y después sondee `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` con la misma credencial del controlador para obtener la respuesta del reproductor. Una solicitud `status` nueva observa `player.standby` y `player.background`; espera activada con `suspended` y cero pendientes confirma que terminó el trabajo rastreado. Para salir de espera use la misma solicitud tipada con `"operation":"wake"` (`ott d1 go`). No repita cambios a ciegas tras un timeout. Consulte la [API de solicitud/respuesta](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) y [semántica de espera](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake) del controlador.

<a id="server-api-reference"></a>

## Referencia API del servidor

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Puntos webhook (Rust `ottplay-server`)

El servidor Rust y la alternativa Python archivada rechazan los puntos de comandos con HTTP 403. `/api/webhook/commands`, `/webhook/notify`, `/webhook/poll` y los alias de salud no encolan, difunden ni extraen comandos. La API genérica de comentarios no puede reemplazar estas rutas reservadas. La entrega modo A usa el servidor de comandos o proxy local autenticado configurados por separado y descritos arriba.

<a id="other-endpoints"></a>

### Otros puntos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/epg/<hash>.json` | Datos EPG del canal |
| `GET` | `/logo/<id>.svg` | Logotipo de canal generado |
| `GET` | `/version/<path>` | Hash de versión del archivo |
| `POST` | `/m3u/match-channels` | Asociación de canales con EPG |
| `POST` | `/m3u/match-logos` | Asociación de logotipos |
| `POST` | `/m3u/cp.php` | Proxy de flujos |
| `GET/POST` | `/feedback/` | Registro de comentarios |
| `GET` | `/tmdb/*` | Proxy API TMDb |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## Estructura del proyecto

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

## Asignaciones de teclas STB

- **Samsung Tizen**: `RETURN=10009`, `ENTER=13`, colores 403–406.
- **Samsung Maple**: cruceta 4/5/6/8, códigos SDK originales.
- **LG WebOS**: `RETURN=461`, colores compatibles HbbTV.
- **LG NetCast**: `RETURN=8`, códigos HbbTV.
- **MAG**: `RETURN=8`, API gSTB para MAC.
- **Dune HD**: códigos estándar, API Dune.
- **Android TV**: códigos Android (`BACK=4`, `DPAD_*` 19–22, `ENTER=66`).
- **HbbTV/Panasonic/Philips/Sony/etc.**: códigos HbbTV (`RED=403`, `BLUE=406`, `VOL_UP=447`).

<a id="documentation"></a>

## Documentación

- [Wiki de documentación](./docs/wiki/Home.es.md) / [Wiki en ruso](./docs/wiki/Home.ru.md) — navegación orientada a tareas y normas de mantenimiento.
- [Informe de implementación](./docs/implementation-report.es.md) / [Proceso y resultado en ruso](./docs/implementation-report.ru.md) — diagramas de colores, comportamiento verificado, coste medido y controles de publicación.
- [Guía de entrega](./docs/roadmap-delivery.es.md) / [Guía de nuevas funciones en ruso](./docs/roadmap-delivery.ru.md) — funciones, límites y verificaciones.
- [Guías rápidas en 88 idiomas de interfaz](./docs/readme/README.md) — generadas desde las traducciones distribuidas; el manual principal y las guías emparejadas están en [24 idiomas de documentación](docs/manual-translations.md), y otras referencias técnicas mantienen sus idiomas existentes.
- [Límites de calidad y recuperación en directo](./docs/playback-stream-policy.es.md) / [En ruso](./docs/playback-stream-policy.ru.md).
- [Asociación manual XMLTV y accesibilidad clásica](./docs/guide-binding-accessibility.es.md) / [En ruso](./docs/guide-binding-accessibility.ru.md).
- [Comprobación alojada de audio/vídeo](./docs/audio-video-check.es.md) / [En ruso](./docs/audio-video-check.ru.md).
- [Biblioteca Xtream](./docs/xtream-media.es.md) / [En ruso](./docs/xtream-media.ru.md).
- [Transferencia entre dispositivos de la misma fuente](./docs/remote-handoff.es.md) / [En ruso](./docs/remote-handoff.ru.md).
- [Ajustes locales recuperables](./docs/settings-recovery.es.md) / [En ruso](./docs/settings-recovery.ru.md).
- [Generaciones de navegadores, sistemas operativos y comprobaciones exactas de candidatos](docs/browser-compatibility.es.md) / [En ruso](docs/browser-compatibility.ru.md).

- [Arquitectura del reproductor](./docs/architecture.md) — responsabilidades de ejecución, integración de proveedores, reproducción, guía, adaptadores de dispositivo y contratos de compilación.
- [Proceso clásico de compilación ES5](./docs/build-pipeline.md) — compilación, comprobaciones de compatibilidad y límites de tamaño.
- [Nombres de recursos de ejecución y migración de despliegue](./docs/asset-layout.md) — rutas descriptivas compartidas por paquetes web y nativos.
- [Banco de trabajo remoto](./docs/remote-workbench.md) — inspección de interfaz/medios, recibos de operaciones y pruebas guardadas.
- [Diagnóstico de ejecución](./docs/runtime-debug.md) — historial de errores, contadores de fotogramas/bucles, métricas nativas Capacitor/Tauri y depuración del servidor.
- [Entrega local macOS](./docs/macos-local-delivery.md) — compilaciones desde copia de trabajo, instalación local y verificación.

<a id="license"></a>

## Licencia

[MIT](LICENSE) — software libre y de código abierto. El contenido de proveedores y las dependencias de terceros mantienen sus propios derechos y licencias.

La aplicación independiente [OTTPlay native webOS](docs/native-webos.md), derivada de PlxNative, se distribuye bajo **GPL-3.0-or-later** con su código fuente correspondiente.
La licencia MIT de la raíz del proyecto no cambia la licencia de esta aplicación nativa ni de sus parches.

<a id="desktop-updater--notarization-mode-b"></a>

## Actualizador de escritorio / notarización (modo B)

La [guía de firma y actualización de escritorio](docs/tauri-updater-notarize.md) describe firma ad hoc de macOS, Developer ID/notarización opcionales y verificación del paquete. CI de publicación usa firma ad hoc sin credenciales Apple. La firma del actualizador es independiente; las actualizaciones automáticas de producción siguen sin configurar.

<a id="local-mac-build-helpers"></a>

## Ayudantes de compilación local Mac

Consulte [docs/local-build-scripts.md](docs/local-build-scripts.md).

<a id="privacy"></a>

## Privacidad

Lea la [política de privacidad](docs/privacy-policy.md) sobre ajustes locales, servicios configurados y opciones disponibles. Contacto de privacidad y soporte: [alvit.work@gmail.com](mailto:alvit.work@gmail.com).

Studio 2026 es el tema de interfaz predeterminado. Classic y PLi-HD siguen disponibles y se conservan las preferencias guardadas. Consulte [ajustes de interfaz](docs/interface-settings.md). El tema PLi-HD reconoce a Vali, littlesat, VU+NL, Milo y los colaboradores originales. Su historia en inglés y enlaces de origen están en [créditos de interfaz e historia del diseño](docs/interface-history.md), también accesibles desde el menú de información del reproductor.

<a id="demo-video-editing"></a>

## Edición de vídeos de demostración

Use el [flujo local video-use](docs/demo-video.md) para preparar y editar grabaciones de demostración. El ayudante mantiene todos los medios generados fuera de Git.

<a id="plex-media-library"></a>

## Biblioteca multimedia Plex

Cada reproductor puede conectarse a una cuenta Plex o Plex Media Server mediante el proveedor **Plex**. La integración usa Plex; Synology es un posible anfitrión del servidor multimedia. Todos los vídeos y las pistas musicales accesibles aparecen automáticamente en la lista de canales; la selección de categoría filtra por biblioteca, carpeta o serie. La reproducción comienza desde el primer lote utilizable, con carga en segundo plano, búsqueda estándar y acciones de aleatorio/repetición, sin configurar Plex en el servidor OTT. Consulte [inicio de sesión Plex y reproducción directa](docs/plex-provider.md).

![Carga Plex, navegación entre archivos y ciclo de cierre](docs/images/plex-playback-lifecycle.svg)

La [revisión ilustrada de fiabilidad](docs/plex-provider.md#reliability-review-process-and-results) explica las normas de carga y cancelación, correcciones para catálogos completos y cambio de archivos, y resultados medidos de validación Chromium/WebKit.

Una integración opcional del servidor OTT también expone el catálogo de un servidor Plex existente y reproducción compatible mediante una entrada de biblioteca NAS separada y exportación M3U. Consulte [configuración de biblioteca del servidor y acceso de clientes](docs/synology-library.md).

<a id="related-repositories"></a>

## Repositorios relacionados

- [ottplay-core](https://github.com/open-ott-play/ottplay-core) mantiene la lógica de dominio JVM/ES5 compartida, contratos de comunicación y cliente FOSS2. Este reproductor consume artefactos generados; siga la guía de entrega del núcleo para cambios compartidos.
- [ottplay-android](https://github.com/open-ott-play/ottplay-android) es la aplicación nativa Kotlin/Compose separada, con identidad de instalación y publicación propias.
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server) proporciona comandos remotos autoalojados; [ottplay-swop](https://github.com/open-ott-play/ottplay-swop) proporciona transporte opcional de texto basado en Worker.
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine) mantiene el perfil alojado de la demostración del navegador, medios de demostración y verificación de publicación.

<a id="project-maintenance"></a>

## Mantenimiento del proyecto

Consulte [requisitos de contribución y pruebas](CONTRIBUTING.md), [política de notificación de seguridad](SECURITY.md), [diseño de seguridad](docs/security-design.md) y [evidencias OpenSSF y criterios pendientes](docs/openssf-evidence.md).
