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

Fichiers locaux sans Internet : voir [Vidéos locales et lecture hors ligne](docs/offline-media.md).

[![Liste des chaînes OTT-play FOSS en perspective](docs/images/hero.png)](docs/images/studio-2026-default.png)

*Capture de l’interface Studio 2026 existante avec des chaînes et programmes de test synthétiques. Ouvrez l’image pour consulter la vue originale à plat ; il ne s’agit pas d’un abonnement réel. [Source de l’image et régénération](docs/images/README.md).*

[Guides de démarrage en 88 langues](docs/readme/README.md) · [Wiki de documentation](docs/wiki/Home.fr.md)

[![Bonnes pratiques OpenSSF](https://www.bestpractices.dev/projects/15593/badge)](https://www.bestpractices.dev/projects/15593)

[![Fuzzing : RC uniquement](https://img.shields.io/badge/Fuzzing-RC%20only-blue)](FUZZING.md)

Les versions candidates publiques exécutent des campagnes de fuzzing limitées et isolées pour l’analyse XMLTV native/serveur et la validation des requêtes de portail. Voir [périmètre du fuzzing, reproduction et preuves de publication](FUZZING.md).

Lecteur IPTV/OTT autonome avec serveur HTTP local en Rust. Fonctionne sur les Smart TV (LG WebOS, Samsung Tizen, Panasonic, Sony, etc.), les décodeurs (Infomir MAG, Dune HD, Enigma2, Android TV) et les navigateurs de bureau.

Commencez par le [guide d’architecture et de contribution](docs/architecture.md) pour les couches d’exécution, responsabilités, recettes d’extension des fournisseurs et vérifications. Voir [sessions de lecture et durées de vie des fournisseurs](docs/playback-session-architecture.md) pour la frontière entre cœur et hôte et les contrats de compatibilité.

<!-- ci-release-process:start -->
<a id="release-process"></a>

## Processus de publication

La [stratégie de publication](RELEASING.md) décrit la validation et les règles de promotion nightly, bêta, RC et stable ; le [guide d’exploitation](docs/release-workflow.md) fournit les commandes locales.
<!-- ci-release-process:end -->

<a id="run-in-a-browser"></a>

## Exécuter dans un navigateur

Ouvrez la [démonstration en ligne](https://player.ottplay.here.now/) ou compilez et servez le lecteur web en suivant les instructions ci-dessous.

Le [déploiement local macOS](docs/local-http-deployment.md) fournit des origines HTTP du lecteur sur les ports 8443–8446. Le port 8095 est abandonné.

Au premier lancement, choisissez **Essayer la démo** pour lire la mire animée, ou configurez votre propre liste M3U ou fournisseur. La démo reste ensuite accessible depuis **Changer de fournisseur → Démo**.

Le mode démo nécessite Internet, mais aucun compte fournisseur. Ses chaînes de test MP4 et HLS muettes sont hébergées sur here.now et partagées par le lecteur web, Tauri, Capacitor et OTT Server. Les paramètres du fournisseur existant sont conservés lors du changement. Pour une **vérification distincte de l’image et du son**, ouvrez **Informations → Audio → Lire** sur le moteur HTML5 géré, au repos ou pendant la télévision en direct. Cela utilise le fichier audible `av-v1.mp4` hébergé sur here.now et nécessite Internet. Le clip est absent des paquets du lecteur et n’est jamais téléchargé au démarrage. VOD, archives et moteurs remplacés par appareil (y compris PC2/Video.js et les moteurs natifs) sont exclus ; voir [étapes, tonalités attendues et schéma d’hébergement](docs/audio-video-check.fr.md).

Les fenêtres de navigateur installées sur ordinateur prennent en charge **Window Controls Overlay** : Chrome peut masquer la barre de titre séparée tout en conservant ses boutons de fenêtre et le menu d’application au-dessus du lecteur. Ouvrez l’application installée et choisissez **Masquer la barre de titre** lorsque Chrome le propose ; **Afficher la barre de titre** rétablit le cadre habituel. Les onglets ordinaires et les dispositions TV/coques natives gardent leur fonctionnement. Voir [contrôles de fenêtre du navigateur](docs/browser-window-controls.md) pour les URL d’installation compatibles, la mise à jour d’un raccourci existant et les vérifications.

Pour avancer ou reculer de dix secondes dans la vue vidéo principale, utilisez **Alt/Option + Gauche/Droite** (**Commande + Gauche/Droite** fonctionne aussi sur macOS), en plein écran ou en vue normale. Les vidéos locales, la VOD et les archives de chaînes compatibles emploient les mêmes commandes sur web, Tauri et Capacitor. Voir [raccourcis clavier et limites](docs/browser-window-controls.md#playback-keyboard-shortcuts).

Dans l’interface PC, **R** lit une autre chaîne ou vidéo aléatoire de la liste actuelle sans modifier son ordre. Cela fonctionne dans la vue vidéo principale et les listes de chaînes/vidéos ; champs de texte, dialogues, paramètres et restrictions de kiosque restent prioritaires. Les touches des autres appareils ne changent pas.

La mire synthétique peut être régénérée avec `scripts/generate-demo-media.sh` (FFmpeg requis) ; les médias générés restent dans le répertoire ignoré `.local-artifacts`.

<a id="features"></a>

## Fonctionnalités

- **Lecture** : flux HLS, DASH et HTTP simple, avec plafonds de qualité HLS.js/Shaka gérés, récupération limitée et jusqu’à trois URL de secours explicites par chaîne en direct. Archives/VOD ne basculent jamais sur un secours du direct ; voir [qualité et récupération](docs/playback-stream-policy.fr.md).
- **EPG** : correspondance XMLTV, décalage temporel/rattrapage, recherche de titres d’émissions (N5 dans l’EPG), rappels et association manuelle de source/ID à une chaîne précise dans le chemin XMLTV hébergé/natif. Voir [association et accessibilité](docs/guide-binding-accessibility.fr.md).
- **Favoris** : une [collection mixte](docs/mixed-favorites.md) ordonnée entre fournisseurs et profils configurés sur les appareils compatibles, avec export/import portable par CLI ; PIN parental. Les listes par source restent disponibles en mode de repli.
- **Paramètres** : export/import JSON des paramètres et favoris, journal d’annulation des lots localStorage compatibles, reprise d’archive selon la source et comparaison exacte des paramètres enregistrés pour les opérations du contrôleur. La récupération suppose un seul écrivain ; les adaptateurs de stockage personnalisés conservent une restauration au mieux. Voir [récupération des paramètres](docs/settings-recovery.fr.md).
- **Interface partagée** : OTT Server, Tauri et Capacitor utilisent le même thème et les mêmes réglages de visibilité des chaînes. Les réglages des [couleurs de l’interface](docs/interface-colors.md) offrent neuf rôles de couleur, une palette, la saisie précise de valeurs HEX/RGB/HSV et cinq schémas de couleurs et sont enregistrés pour chaque client ; ceux de la liste contrôlent noms, picons, programmes actuels, progression et repères d’archive.
- **Fournisseurs** : M3U/M3U8, direct Xtream avec [catalogues de films/séries à la demande](docs/xtream-media.fr.md), Stalker/Ministra avec [films et épisodes imbriqués](docs/stalker-media.md), Plex et VPortal. Les capacités du fournisseur et l’accès du compte déterminent les fonctions disponibles d’archive et de médiathèque.
- **Commandes push** : télécommande par webhook — changer de chaîne, fournisseur ou liste, afficher des notifications.
- **Saisie distante (swop)** : clavier du téléphone via Cloudflare Worker lorsque TV et téléphone sont sur des réseaux différents (sessions autorisées pour l’installation ; ♥™ sur le clavier virtuel).
- **Routage par appareil** : adressage par UUID pour les installations multiappareils.
- **Proxy local** : serveur de commandes local facultatif pour une automatisation entièrement locale (sans serveur central).
- **Intégration du contrôleur** : opérateurs limités par appareil/action, résultats de commandes durables facultatifs, application reprenable des profils Local/Home et transfert du direct/des archives d’une même source via le [serveur de contrôle](https://github.com/open-ott-play/ottplay-control-server) correspondant. Ces fonctions nécessitent le contrôleur/la CLI à jour ; un onglet de navigateur autonome ne les fournit pas.
- **Préférences distantes typées** : découvrez les réglages, lisez les valeurs enregistrées et effectives, puis enregistrez avec vérification de l’instance d’exécution, de la source et de la révision ; voir [réglages distants et configuration VPortal](docs/remote-player-settings.md).
- **Débogage** : HUD de lecture/journal circulaire activables via `?debug=1`, inspection distante avec consentement et vérification audio/vidéo hébergée à la demande.
- **Accessibilité clavier** : dialogues classiques nommés, confinement et restitution du focus Tab, sémantique de chaîne sélectionnée et annonces d’état discrètes. Ces améliorations ne prouvent pas une conformité complète WCAG ni avec les lecteurs d’écran des appareils.
- **24 types d’appareil** : affectation des touches de télécommande propre à chaque appareil.
- **88 langues d’interface** : catalogues correspondants, [guides de démarrage localisés](docs/readme/README.md) et [alphabets de clavier vérifiés avec CLDR](docs/localization.md). Le manuel principal et les guides fonctionnels associés sont disponibles dans [24 langues de documentation](docs/manual-translations.md) ; les autres références techniques conservent leurs langues existantes.

Le [guide de livraison](docs/roadmap-delivery.fr.md) décrit les fonctions de cette révision, les frontières de plateformes, schémas et vérifications. Les versions installées ou hébergées peuvent employer une révision antérieure. L’[application Android](https://github.com/open-ott-play/ottplay-android) native indépendante conserve aussi les choix audio/sous-titres selon langue, rôle et libellé plutôt que selon les indices du manifeste ; son implémentation et sa publication sont distinctes de ce frontend.

La [revue des sources STB](docs/stb-player-improvements.md) explique les améliorations des médias, des ressources et de la récupération, les comparaisons de sources et les limites actuelles.

<a id="debug-hud"></a>

## HUD de débogage

Le HUD local et la conservation des journaux serveur s’activent séparément. Consultez [accès diagnostic, masquage des données et conservation](docs/diagnostic-security.md) avant de collecter des journaux d’autres appareils.

Activez le débogage par l’un des moyens suivants :
- URL : `?debug=1` ou `?debug=true`.
- Stockage local : `localStorage.setItem("ottplay_debug", "1")`.
- Propriété de fenêtre : `window.__OTT_DEBUG__ = true`.
- Serveur : lorsque `/debug/config` renvoie `{enabled: true}`.

Lorsque le débogage est actif :
- **D** affiche ou masque la bande HUD (`ottDebugSetHud` / `__ottDebug.toggleHud()`).
  - Ignoré lorsque le focus est dans INPUT/TEXTAREA/listEdit.
  - Utilise `e.key` pour éviter le conflit MAG/Maple PLAY/PREV=68.
- Menu Informations → **Debug HUD** → appelle `__ottDebug.toggleHud()`.
- Gérer les paramètres → **Debug HUD** :
  - Débogage déjà chargé : change la visibilité du HUD.
  - Sinon : définit `ottplay_debug=1` + `ottplay_debug_hud=1` et demande un redémarrage.
- Persistance : `ottDebugSetHud` enregistre l’état dans `localStorage.ottplay_debug_hud` ("1"/"0").

<a id="capacitor-ios-and-android"></a>

## Capacitor pour iOS et Android

Ce dépôt empaquette le frontend TypeScript partagé avec Capacitor pour iOS et Android 7+. Tous deux utilisent les polices système et l’environnement natif verrouillé par npm. Un APK de compatibilité API 22 distinct prend en charge Android 5.1/6 avec WebView 60 ou plus récent. Les deux APK Android sont signés et inclus dans les versions bêta, RC et stables qualifiées, avec l’IPA iOS non signé. L’application Kotlin indépendante reste dans [ottplay-android](https://github.com/open-ott-play/ottplay-android).

```sh
npm ci
npm run build:ios             # build and audit the frontend, then sync iOS
npm run cap:ios               # open in Xcode
npm run android:full:release  # build and audit the Full Capacitor APK
npm run android:api22:release # Android 5.1 compatibility APK, same Full interface
```

Voir [configuration de Capacitor](docs/capacitor-mobile.md) et [distribution Android et mises à jour distantes](docs/android-distributions.md).

L’interface iOS utilise le mode paysage. Paramètres, configuration du fournisseur, consentement à la télécommande et import/export JSON continuent d’employer le frontend partagé. Le multitâche sur tablette peut remplacer l’orientation demandée.

Sur iPhone, balayez verticalement la liste pour parcourir lignes et pages : vers le haut pour les chaînes suivantes et vers le bas pour les précédentes. Un geste rapide continue sur plusieurs pages puis ralentit ; un glissement lent reste précis. Touchez l’écran ou appuyez sur une touche de navigation pour arrêter le mouvement. Un seul toucher lance la chaîne sous le doigt, même si une autre ligne est sélectionnée. Un balayage n’ouvre jamais la chaîne au relâchement.

La vidéo se lit dans l’interface de l’iPhone. Touchez le bas de l’écran pour les informations du programme ou ouvrez le menu pendant la lecture. L’image dans l’image reste une option séparée.

Test appareil : [liste de contrôle mode B](docs/mode-b-device-smoke.md) et `./scripts/smoke-capacitor-device.sh --help` (cible de compilation/synchronisation : iOS uniquement). Test Tauri de bureau : [liste de contrôle bureau](docs/mode-b-tauri-smoke.md).

<a id="installation"></a>

## Installation

| Plateforme | Paquet | Notes |
|---|---|---|
| **macOS** | `.dmg` / `.app.zip` | Compilations distinctes Apple Silicon et Intel ; signature ad hoc sauf si la signature Apple est configurée |
| **Windows** | `.msi` / `.exe` | x64 |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | Diverses distributions |
| **LG webOS** | `ottplay-foss-webos.ipk` | [Developer Mode ou Homebrew Channel](docs/lg-webos-installation.md) ; lecteur hébergé, connexion réseau requise |
| **Samsung Tizen TV** | `ottplay-foss-tizen-unsigned.wgt` | [Developer Mode et signature locale ; paquet TV non signé, distinct de Family Hub](docs/samsung-tizen-installation.md) |
| **iOS** | `.ipa` via AltStore / TestFlight / Xcode | Installation externe uniquement — pas encore sur l’App Store |
| **Android (frontend partagé)** | `ottplay-foss-android-full.apk` / `ottplay-foss-android-api22.apk` | Paquets Capacitor signés ; choisir la version Android compatible |
| **Android (Kotlin natif)** | [Application native](https://github.com/open-ott-play/ottplay-android) distincte | Dépôt public ; application et processus de publication séparés |

Les installateurs pris en charge sont joints aux versions GitHub qualifiées : [https://github.com/open-ott-play/ottplay-foss/releases/latest](https://github.com/open-ott-play/ottplay-foss/releases/latest)

> **Remarque :** les paquets d’application macOS utilisent une signature ad hoc sans identifiants Apple ; cela ne fournit ni Developer ID ni notarisation. Les installateurs Windows/Linux et paquets iOS peuvent être non signés. iOS exige une signature avant installation sur appareil physique. Les APK Android Full et API 22 qualifiés utilisent le certificat de signature établi ; les compilations locales de publication nécessitent un keystore configuré pour produire des APK signés.

---

<a id="macos"></a>

### macOS

1. Choisissez le tag voulu dans les [versions](https://github.com/open-ott-play/ottplay-foss/releases). Le raccourci vers la dernière version sélectionne stable, pas bêta ou RC.
2. Téléchargez `OttPlay.FOSS_*_aarch64-apple-darwin.dmg` pour Apple Silicon ou `OttPlay.FOSS_*_x86_64-apple-darwin.dmg` pour Intel. Les architectures ont des compilations distinctes.
3. Ouvrez le `.dmg` et glissez **OttPlay FOSS.app** dans Applications.
4. Vérifiez le paquet copié avant le premier lancement :

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/OttPlay FOSS.app"
codesign --display --verbose=4 "/Applications/OttPlay FOSS.app"
```

Une vérification réussie contrôle l’intégrité du paquet. `Signature=adhoc` signifie que l’application n’a pas d’identité de développeur authentifiée par Apple ; cela ne prouve ni notarisation ni approbation Gatekeeper. Même avec téléchargement fiable et paquet valide, macOS peut demander **Réglages Système → Confidentialité et sécurité → Ouvrir quand même** après le premier essai ; voir [les instructions Apple](https://support.apple.com/en-us/102445).

Le message « application endommagée » ne prouve pas que la quarantaine est seule en cause. Si la vérification de signature échoue, conservez l’erreur et obtenez une version corrigée. Ne signez pas à nouveau l’application téléchargée et ne supprimez pas ses attributs pour faire paraître réussie une vérification échouée.

Les variantes ZIP sont `OttPlay.FOSS_aarch64-apple-darwin.app.zip` et `OttPlay.FOSS_x86_64-apple-darwin.app.zip`. Voir [signature macOS et vérification des artefacts](docs/tauri-updater-notarize.md#verify-a-downloaded-macos-artifact) pour l’extraction, l’image disque et Gatekeeper. Pour compiler depuis une copie du dépôt et installer localement, utilisez [livraison locale macOS](docs/macos-local-delivery.md).

---

<a id="windows"></a>

### Windows

1. Téléchargez `.msi` ou `.exe` dans les [versions](https://github.com/open-ott-play/ottplay-foss/releases/latest).
2. Exécutez l’installateur et suivez les indications.
3. Lancez depuis le menu Démarrer ou le raccourci du bureau.

---

<a id="linux"></a>

### Linux

La lecture Linux exige des greffons GStreamer HLS, H.264 et AAC en plus de WebKitGTK. Les paquets déclarent ces dépendances multimédias ; les AppImage embarquent le framework multimédia. Voir [empaquetage multimédia Linux](docs/linux-media-packaging.md) pour vérifier les codecs et distinguer l’acceptation navigateur de l’acceptation native.

**AppImage :**

```bash
chmod +x OttPlay.FOSS_*_amd64.AppImage
./OttPlay.FOSS_*_amd64.AppImage
```

**Debian/Ubuntu (.deb) :**

```bash
sudo apt install ./OttPlay.FOSS_*.deb
```

**Fedora (.rpm) :**

```bash
sudo dnf --enablerepo=fedora-cisco-openh264 install ./OttPlay.FOSS-*.rpm
```

---

<a id="ios-installation"></a>

### Installation iOS

iOS nécessite une signature avant installation sur appareil physique. Utilisez AltStore Classic pour l’IPA publié non signé ou compilez et signez les sources avec Xcode. TestFlight demande une invitation séparée, lorsqu’elle est proposée.

<a id="option-1-altstore-classic-recommended-for-personal-use"></a>

#### Option 1 : AltStore Classic (recommandé pour un usage personnel)

AltServer fonctionne sur l’ordinateur ; AltStore Classic fonctionne sur l’iPhone/iPad et importe l’IPA. Un compte Apple gratuit suffit.

**Prérequis :**

- iPhone/iPad sous **iOS/iPadOS 15 ou ultérieur** pour la compilation OTT-play actuelle.
- Mac ou PC Windows avec AltServer et câble USB de données.
- Compte Apple pour la signature et accès Internet pour télécharger la version.

**Étape 1 : configurer AltStore une fois**

1. Installez AltServer avec ses instructions officielles [macOS](https://faq.altstore.io/altstore-classic/how-to-install-altstore-macos) ou [Windows](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows). Lancez-le et utilisez son icône de barre de menus/zone de notification.
2. Connectez l’appareil en USB, déverrouillez-le et acceptez les demandes de confiance ordinateur/appareil. Sur Mac, vérifiez sa présence dans le Finder.
3. Dans **menu AltServer → Install AltStore**, sélectionnez l’appareil et suivez les demandes du compte de signature. Attendez la notification d’installation.
4. Sur l’appareil, ouvrez **Réglages → Général → VPN et gestion de l’appareil** et approuvez l’entrée développeur de votre compte de signature si demandé. Sous iOS 16+, activez **Réglages → Confidentialité et sécurité → Mode développeur** et terminez les demandes de redémarrage/confirmation.
5. Ouvrez AltStore sur l’appareil. S’il est déjà installé et opérationnel, ignorez cette configuration et laissez AltServer actif pour l’import ci-dessous.

**Étape 2 : importer la version sélectionnée sur iPhone/iPad**

1. Choisissez un tag exact parmi [toutes les versions](https://github.com/open-ott-play/ottplay-foss/releases) et téléchargez son `ottplay-foss-ios-unsigned.ipa` dans Safari sur l’appareil. Le [raccourci dernière version](https://github.com/open-ott-play/ottplay-foss/releases/latest) sélectionne stable ; utilisez la liste complète pour installer une bêta.
2. Enregistrez l’IPA dans Fichiers. Dans **AltStore → My Apps → +**, sélectionnez ce fichier. Vous pouvez aussi transférer un IPA téléchargé depuis le Mac par AirDrop et l’enregistrer dans Fichiers avant l’import. Ouvrir l’IPA sur le Mac ne réalise pas cette importation.
3. Gardez AltServer actif et le câble USB connecté pendant qu’AltStore signe et installe. Pour une mise à jour, utilisez le même compte de signature que l’installation existante ; ne supprimez pas l’application comme première mesure de dépannage.
4. Attendez la fin de l’importation, vérifiez OTT-play dans **My Apps**, puis lancez-le.

**Alternative : importer directement l’URL de la version**

AltStore étant installé, saisissez ce modèle dans **Safari sur l’iPhone**, en remplaçant `TAG` par le tag exact, et acceptez **Open in AltStore** :

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/TAG/ottplay-foss-ios-unsigned.ipa
```

Cela utilise le [gestionnaire d’URL d’installation d’AltStore](https://github.com/altstoreio/AltStore/blob/develop/AltStore/SceneDelegate.swift). Il évite une entrée Fichiers/Récents ambiguë lorsque plusieurs téléchargements portent le même nom. L’URL doit pointer vers l’IPA, pas vers la page de version.

Par exemple, l’import suivant a été vérifié le **2026-09-29** avec AltStore 2.3 et AltServer 1.8.1. C’est un exemple historique fixe, pas un lien vers la dernière version :

```text
altstore://install?url=https://github.com/open-ott-play/ottplay-foss/releases/download/v1.1.51-beta.9/ottplay-foss-ios-unsigned.ipa
```

**Renouvellement :** les installations avec compte gratuit expirent après sept jours. Gardez AltServer joignable et utilisez **AltStore → My Apps → Refresh All** avant expiration. Le renouvellement en arrière-plan nécessite aussi AltServer ; voir [les instructions d’AltStore](https://faq.altstore.io/altstore-classic/your-altstore).

<a id="verify-the-installed-version-before-retrying"></a>

#### Vérifier la version installée avant de réessayer

Un message AirDrop « Envoyé » ne confirme que le transfert. Une barre de progression AltStore confirme le début de l’importation. Une connexion Recopie/USB perdue ne prouve pas l’échec de l’installation : vérifiez l’application installée avant de renvoyer l’IPA.

Sur un Mac où Xcode est installé et sélectionné comme répertoire de développement actif, inspectez l’appareil sans réinstaller :

```bash
xcrun devicectl list devices
# Substitute the identifier from the device list.
xcrun devicectl device info apps --device '<device-identifier>' \
  --filter "bundleIdentifier BEGINSWITH 'play.ott.foss'" \
  --timeout 20 --json-output /tmp/ottplay-installed-apps.json
```

Dans `result.apps` du JSON, trouvez OTT-play (`bundleIdentifier` commence par `play.ott.foss`) et comparez `version` et `bundleVersion` avec `CFBundleShortVersionString` et `CFBundleVersion` de l’IPA choisi. Un suffixe de compte de signature AltStore sur l’identifiant du paquet est normal. Gardez le rapport de l’appareil local.

L’exemple beta.9 vérifié indique **version `1.1.51`, compilation `2.2.66`**. Cela confirme l’installation ; ouverture, connexion Cloudflare, chargement de liste, lecture et PiP sont des vérifications distinctes sur l’appareil.

<a id="troubleshooting-ios-installation"></a>

#### Dépannage de l’installation iOS

- **AltServer n’a pas de fenêtre, ou son ouverture automatisée expire :** utilisez son icône de barre de menus/zone de notification. C’est une application d’arrière-plan. Répéter l’ouverture d’une fenêtre classique n’importe pas l’IPA.
- **« Could not find AltServer » ou appareil USB indisponible :** vérifiez qu’AltServer fonctionne, déverrouillez le téléphone et contrôlez les demandes de confiance. Vérifiez la présence dans le Finder sur Mac. Si la connexion a été perdue, rétablissez-la sans risque puis vérifiez la version installée avant de réessayer. Suivez [le dépannage de connectivité AltStore](https://faq.altstore.io/altstore-classic/troubleshooting-guide) si nécessaire. Si le téléphone fournit Internet à l’ordinateur, coordonnez tout changement de câble ou réseau pour ne pas interrompre d’autres travaux.
- **Recopie de l’iPhone indique « iPhone in Use » ou reste sur « Connecting » :** terminez la configuration sur le téléphone physique ou verrouillez son écran et laissez-le près du Mac déverrouillé pour la recopie. Déverrouiller le téléphone termine la recopie ; confiance/configuration USB peuvent nécessiter d’abord son déverrouillage. Si une reconnexion bloque encore, quittez la recopie et continuez sur le téléphone. Voir [les exigences Apple](https://support.apple.com/en-us/120421). La recopie n’est pas obligatoire pour installer.
- **Une URL perd ses lettres latines ou devient cyrillique dans la recopie :** passez la **source de saisie du Mac sur ABC/Anglais**. Avec la recopie au premier plan, appuyez sur **Contrôle–Espace** et sélectionnez **English (US)** pour le clavier physique de l’iPhone. Les sources Mac et iPhone peuvent différer ; changer uniquement celle du Mac ne suffisait pas dans notre session vérifiée. Effacez le champ, ressaisissez l’URL et vérifiez-la avant envoi.
- **Coller dans la recopie bloque ou insère un texte inattendu :** effacez le champ et retapez lentement de courts fragments avec la source English (US) de l’iPhone, ou saisissez directement sur le téléphone. Une saisie rapide par recopie peut perdre ou dupliquer des caractères ; vérifiez l’adresse entière avant de sauvegarder. N’envoyez pas une URL partiellement collée. Le collage a échoué dans notre session d’installation ; ce n’est pas un prérequis de la méthode par URL directe.
- **Fichiers/Récents affiche plusieurs IPA de même nom :** sélectionnez l’emplacement exact du téléchargement ou utilisez l’URL directe avec tag ci-dessus. Une copie locale peut être renommée avec son tag/numéro de compilation pour plus de clarté ; cela ne modifie pas son contenu.
- **L’application installée ne s’ouvre pas :** suivez les demandes de confiance développeur ou Mode développeur sur le téléphone. Vérifiez l’expiration dans AltStore et renouvelez si nécessaire. Notez l’erreur réelle si l’échec persiste ; une erreur de connexion seule ne justifie pas de supprimer et réinstaller.
- **OTT-play s’ouvre, mais une liste protégée échoue sur le réseau mobile :** installation et authentification de source sont distinctes. Utilisez **Réglages → Gérer les paramètres → Accès aux sources** pour vous connecter à une source configurée, puis rechargez la liste. Terminez les demandes biométriques/passkey ou de code par courriel sur l’appareil physique. La source doit prendre en charge [l’intégration iOS Access](docs/ios-source-access.md) ; l’installation ne contourne pas une liste d’IP autorisées.
- **Un passkey est demandé sur un Wi-Fi de confiance :** pour les sources intégrées à iOS Access, l’application essaie d’abord la source originale sans connexion et n’utilise l’entrée mobile authentifiée qu’après un refus d’accès. Vérifiez l’IP publique réellement vue par la source, notamment IPv6 : une IPv4 domestique autorisée ne couvre pas une autre IPv6, un VPN ou une adresse mobile. Les changements de réseau et la réouverture de l’application effacent la préférence temporaire de route. Une erreur réseau/serveur générique ne devrait pas déclencher de connexion.
- **La connexion n’apparaît plus, mais la liste est vide :** une session enregistrée valide est réutilisée sans nouvelle demande. Après un chargement échoué ou une correction serveur, rechargez la liste ou fermez complètement puis rouvrez l’application une fois. Si l’échec persiste, vérifiez que la source renvoie une liste plutôt qu’une page HTML de connexion ou une erreur JSON. Notez l’erreur affichée et le statut HTTP ; ne partagez pas d’URL contenant identifiants, cookies ou jetons Access.
- **Les chaînes chargent, mais la vidéo met en mémoire tampon ou indique `SRC_NOT_FOUND` :** chargement de liste et lecture vidéo sont distincts. Réessayez une fois la chaîne après connexion ; si nécessaire, vérifiez les réponses du manifeste et des segments HLS ainsi que les codecs pris en charge. L’erreur seule ne prouve pas qu’un changement de moteur ou une réinstallation aidera.

<a id="option-2-testflight-if-available"></a>

#### Option 2 : TestFlight (si disponible)

Si une invitation TestFlight est publiée, installez TestFlight depuis l’App Store, ouvrez cette invitation sur l’appareil et touchez **Installer**. Le téléchargement d’un IPA GitHub ne fournit pas d’invitation TestFlight.

<a id="option-3-xcode-for-developers"></a>

#### Option 3 : Xcode (pour les développeurs)

Suivez [Compiler et ouvrir](docs/capacitor-mobile.md#build-and-open), sélectionnez la cible **App** dans Xcode, configurez votre équipe sous **Signing & Capabilities**, choisissez l’appareil connecté et compilez/exécutez. Terminez les demandes de confiance et de Mode développeur. Importer l’IPA non signé dans la fenêtre Devices de Xcode ne fournit ni identité de signature ni profil de provisionnement manquants.

---

<a id="android-application"></a>

### Application Android

Choisissez l’APK Full Capacitor des versions de ce dépôt pour l’interface partagée. Utilisez l’APK de compatibilité API 22 sur Android 5.1–6 ; WebView 60 ou ultérieur est nécessaire. Conservez identité d’application et certificat de signature pendant la mise à jour pour garder les profils existants. Voir [instructions de compilation](android/README.md) et [distribution, signature et installation distante](docs/android-distributions.md).

Le [dépôt ottplay-android](https://github.com/open-ott-play/ottplay-android) séparé contient l’application native Kotlin/Compose. Elle possède ses propres identité, préférences et processus de publication et ne remplace pas sur place une installation Capacitor. Les anciens artefacts restent disponibles.

---

<a id="quick-start"></a>

## Démarrage rapide

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

Utilisez votre propre déploiement de la même révision pour les tests fonctionnels du navigateur.

Utilisez Node 22 et la chaîne d’outils Rust stable. Exécutez le serveur depuis la racine du dépôt pour rendre ses ressources statiques disponibles. Les compilations natives nécessitent les outils de plateforme décrits ci-dessous ; ils sont inutiles pour le serveur seul.

Au premier chargement, choisissez **Essayer la démo** ou ouvrez **Réglages → Changer de fournisseur → Listes M3U / M3U8**. Ouvrez **Sélectionner une liste**, choisissez un emplacement, saisissez **URL de la liste**, enregistrez puis choisissez **Charger la liste**. La liste ou le compte fournisseur viennent de vous ; l’application ne fournit aucun abonnement à des chaînes payantes.

<a id="mode-a-companion-smoke"></a>

## Test fonctionnel du serveur compagnon mode A

Test par curl du compagnon mode A (parité `ottplay-server` / `archive/server.py`) : index, répertoires statiques, `/logo`, `/version`, `/epg` facultatif et sonde de `POST /m3u/cp.php` sans téléchargement depuis la source.

```bash
# Local install default (:8443 — scripts/install-ottplay-local-service.sh)
./scripts/smoke-modea-companion.sh

# Docker / cargo CLI default (:8080)
BASE_URL=http://127.0.0.1:8080 ./scripts/smoke-modea-companion.sh

# Optional EPG slice (empty cache → warning, not failure)
EPG_HASH=<channel-hash> ./scripts/smoke-modea-companion.sh
```

Les contrôles se trouvent dans `scripts/modea-smoke-checks.json`. Aucun secret. La file de commandes / `local_proxy.py` (:8081) est couverte séparément par `scripts/smoke-command-queue.sh`, lorsqu’il existe.

<a id="classic-stalker--ministra-portals"></a>

## Portails classiques Stalker / Ministra

Choisissez **Portails Stalker** et saisissez la MAC fournie par l’opérateur et l’URL complète du portail, par exemple `http://provider.example/stalker_portal/c/`. Les URL `/c/index.html`, `/stalker_portal`, `/server/load.php`, `/load.php` et `/portal.php` sélectionnent le protocole MAG classique. Les configurations existantes avec serveur seul conservent JSON-RPC. Le fournisseur charge profil, genres et pages de chaînes en direct via le cœur Stalker partagé, puis découvre en arrière-plan les films et épisodes imbriqués du protocole classique `type=vod`. Les chemins de dossiers deviennent des catégories de la liste habituelle des chaînes ; les descriptions et affiches disponibles et les favoris globaux à références stables utilisent la même interface multimédia. Voir [le comportement et les limites du catalogue](docs/stalker-media.md).

Les requêtes du navigateur sur une installation autohébergée passent par `/stalker/api` du compagnon ; les applications natives utilisent leur transport HTTP existant. Les navigateurs hébergés nécessitent des routes configurées explicitement via le [relais dédié](docs/stalker-relay.md). Les ressources du navigateur et du serveur doivent être mises à jour ensemble.

La lecture en direct résout les commandes temporaires lors de l’ouverture du flux ; changements de chaîne, arrêt, PiP et remplacement du fournisseur annulent les résolutions périmées. Les commandes HTTP(S) explicites non temporaires se lisent directement. L’EPG court est pris en charge. Ce fournisseur n’expose ni les archives du portail classique ni le protocole distinct `type=series`. Le comportement JSON-RPC existant des archives/du guide ne change pas. Les portails LAN privés utilisant la route du compagnon nécessitent une entrée exacte `OTTPLAY_PROXY_LAN_ORIGINS`, comme ses autres routes proxy.

La démo publique Infomir est `http://middleware-stalker.com/stalker_portal/c/`. Elle renvoyait trois entrées de direct le 2026-09-26, mais ses points médias étaient indisponibles ; utilisez une source de test portail/média contrôlée pour les régressions de lecture.

<a id="m3u-stream-proxy-header-smoke"></a>

## Test des en-têtes du proxy de flux M3U

Compare les en-têtes de requête amont injectés par `POST /m3u/cp.php` du compagnon mode A lors de l’accès à une URL d’écho contrôlable (simulation locale par défaut — aucun fournisseur IPTV ni secret).

Contrat (depuis `src-rs/core/src/m3u.rs` + `archive/server.py`) :
- Injecte seulement **User-Agent** (`OTT-play-FOSS/1.0` par défaut ou profils `webos` / `tizen` / `viera` / `mag` / `dune`).
- N’injecte **pas Referer** (`M3UProxy` de Capacitor le fait ; le mode A non).
- Retire le `@` initial de `url` (formulaire jQuery du fournisseur).

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

Codes de sortie : `0` succès, `1` pas d’écoute, `2` divergence en-têtes/HTTP, `3` usage/dépendances. Complète `smoke-modea-companion.sh` / `smoke-command-queue.sh`.

<a id="logo-concurrent-bench-smoke"></a>

## Test de charge simultanée des logos

Test de latence de `GET /logo/<id>.svg` simultanés (`?ch=` facultatif) sur le compagnon mode A. Rapporte nombres de succès/échecs et p50/p95/p99. La charge par défaut convient au CI local (`CONCURRENCY=200`, `TOTAL=1000`) ; le test prolongé complet de 10 000 requêtes est facultatif (`--full` / `LOGO_BENCH_FULL=1` / `TOTAL=10000`).

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

Codes de sortie : `0` succès, `1` pas d’écoute / connexion échouée, `2` taux d’erreur élevé, `3` usage. Complète `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-command-queue.sh`.

<a id="xmltv-cache-refresh--warm-up-smoke"></a>

## Test de rafraîchissement et de préchauffage du cache XMLTV

Vérifie le comportement réel du cache XMLTV/EPG du compagnon mode A selon `src-rs` (aucune API inventée) :

- `EPG_CACHE` en mémoire, servi par `GET /epg/:hash`, renvoie toujours `{"epg_data":[...]}` (HTTP 200).
- Le démarrage du processus récupère `EPG_URLS` en arrière-plan sans retarder HTTP ; chaque récupération terminée est suivie de **2 heures** d’attente avant l’actualisation suivante.
- Persistance SQLite facultative si `DATABASE_URL` est défini (aucun point public d’état du cache).
- `GET /health` → `OK` confirme la disponibilité HTTP après un redémarrage facultatif. Avec `--strict-epg` et `--epg-hash`, le test attend aussi un EPG non vide pour cette chaîne dans le même budget `--warmup-timeout`.

Le chemin par défaut effectue seulement des appels curl — **il ne termine pas de processus**. Passez `--restart-cmd` / `RESTART_CMD` pour un arrêt/redémarrage automatisé, ou suivez les étapes manuelles `launchctl` de `--help`.

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

Codes de sortie : `0` succès, `1` pas d’écoute, `2` assertion/préchauffage échoué, `3` usage. Complète `smoke-modea-companion.sh` / `smoke-m3u-stream-proxy-headers.sh` / `smoke-logo-concurrent-bench.sh` / `smoke-command-queue.sh`.

<a id="mode-a-e2e-play-path-smoke"></a>

## Test de bout en bout du chemin de lecture mode A

Test côté compagnon du **chemin de lecture / de la disponibilité du flux** (HTTP seulement — **pas** un test de bout en bout d’interface avec fenêtre visible). Sur un compagnon mode A actif, il vérifie :

- Disponibilité de health ou de l’index.
- Ressources statiques de la coque du lecteur (`/`, `/styles/player.css`, `/js/jquery-…`, `/f/…`).
- `GET /epg/<hash>.json` facultatif si `EPG_HASH` est défini.
- `POST /m3u/match-channels` avec un exemple JSON sans secret (liste vide + une chaîne synthétique).
- **Lecture** via le proxy de flux : `POST /m3u/cp.php` vers un média contrôlable (liste HLS locale par défaut ou `MEDIA_URL`) avec vérification de HTTP 200 + corps non vide / `Content-Type` attendu (premiers octets à travers le proxy).

Aucun identifiant IPTV privé. Complète `smoke-modea-companion.sh` (présence), `smoke-m3u-stream-proxy-headers.sh` (UA/Referer), `smoke-xmltv-cache-refresh.sh`.

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

Codes de sortie : `0` succès, `1` pas d’écoute, `2` assertion échouée, `3` usage/dépendances.

<a id="capacitor-device-smoke-mode-b"></a>

## Test appareil Capacitor (mode B)

**Liste de contrôle** pour simulateur/émulateur (appareil réel facultatif) mode B Cap — pas pour HTTP compagnon mode A. Un humain valide l’interface ; l’outil automatise chaîne d’outils, répertoires natifs et requête curl non bloquante de la file de commandes.

```bash
./scripts/smoke-capacitor-device.sh --help
./scripts/smoke-capacitor-device.sh --check-native
./scripts/smoke-capacitor-device.sh --queue          # soft-skip if Cap :18081 down
```

Détails : [docs/mode-b-device-smoke.md](docs/mode-b-device-smoke.md). Complète `smoke-command-queue.sh` (loopback Cap) — ne pas confondre avec les tests mode A ci-dessus.

<a id="tauri-desktop-smoke-mode-b"></a>

## Test de bureau Tauri (mode B)

Liste de contrôle bureau et outil pour mode B Tauri (fenêtre / lecture de chaîne / PiP). Ce n’est ni HTTP compagnon mode A ni un test appareil Cap.

```bash
./scripts/smoke-tauri-desktop.sh --help
./scripts/smoke-tauri-desktop.sh
./scripts/smoke-tauri-desktop.sh --check-companion
```

Détails : [docs/mode-b-tauri-smoke.md](docs/mode-b-tauri-smoke.md). Les identifiants développeur Apple sont facultatifs pour un test local ; utilisez la [signature ad hoc](docs/tauri-updater-notarize.md#local-smoke-without-apple-credentials) pour une application Mac empaquetée. La réception humaine couvre toujours lancement, lecture et PiP.

<a id="docker"></a>

## Docker

Les images multiarchitectures (amd64/arm64) sont construites sous forme d’archives OCI candidates. La publication dans le registre promeut l’archive stable approuvée vers Docker Hub sans recompilation ; voir [guide d’exploitation](docs/release-workflow.md).

Le binaire serveur est compilé sur **musl** (Alpine) et distribué sur Alpine — il ne nécessite **pas** GLIBC_2.38+. Cela permet à `alvit/ottplay-foss` de fonctionner sur Synology DSM Docker (x86_64) et d’autres hôtes avec glibc ancienne.

```bash
docker run -d -p 8080:8080 alvit/ottplay-foss
# with EPG source(s) (semicolon-separated):
docker run -d -p 8080:8080 -e EPG_URLS="http://example.com/epg.xml.gz" alvit/ottplay-foss
```

Les tags stables du registre utilisent `X.Y.Z`. Mettre à jour `latest` est une option explicite séparée après publication de l’image versionnée ; les push sur main et tags Git ne publient pas d’images.

<a id="build-from-source"></a>

## Compiler depuis les sources

Les règles métier du lecteur proviennent de l’artefact Kotlin multiplateforme figé dans `vendor/ottplay-core.js`. Les décisions de guide, archive, liste, fournisseur, état durable et lecture partagent leur implémentation avec FOSS2 et Android natif. Les adaptateurs navigateur/TV, Swift et Rust conservent API d’appareil, codecs, réseau et effets d’interface. L’artefact navigateur garde la syntaxe ES5 et l’amorçage des anciennes API prises en charge. `npm test`, `check:bundle` et `check:es5` vérifient l’intégration ; le manifeste de l’artefact consigne les empreintes des sources et résultats.

Les validateurs de protocoles Control-server et SWOP sont générés depuis le schéma versionné `contracts/ottplay-wire-v1.json`. Les reçus de génération vérifiés et les exemples immuables de compatibilité empêchent des copies de politiques propres à chaque consommateur.

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

## Détection des appareils

Le lecteur prend en charge 24 types d’appareil. La détection utilise d’abord l’URL `/f/{device_id}/`, puis User-Agent.

| ID d’appareil | Appareil |
|---|---|
| `pc` | Navigateur PC |
| `pc2` | Lecteur web videojs |
| `nodejs` | Application Windows (Electron) |
| `lg/webos` | Téléviseurs LG WebOS |
| `samsung/tizen` | Téléviseurs Samsung Tizen |
| `samsung/maple` | Téléviseurs Samsung Orsay |
| `mag` | Décodeurs Infomir MAG |
| `dune` | Décodeurs Dune HD |
| `android` | Android TV / tablettes |
| `hbbtv` | Téléviseurs HbbTV |
| `panasonic` | Téléviseurs Panasonic Viera |
| `philips` | Téléviseurs Philips |
| `sony` | Téléviseurs Sony |
| `sharp` | Téléviseurs Sharp |
| `toshiba` | Téléviseurs Toshiba |
| `hisense` | Téléviseurs Hisense |
| `skyworth` | Téléviseurs Skyworth |
| `tcl` | Téléviseurs TCL |
| `vewd` | Appareils Vewd |
| `spark` | Récepteurs Spark |

<a id="push-command-system"></a>

## Système de commandes push

Pour un service multiappareils distinct, utilisez [OTT-play Control Server](https://github.com/open-ott-play/ottplay-control-server) et la section **Serveur de commandes** dans **Réglages → Télécommande**. Saisissez son IP/adresse et le code d’accès de ce lecteur ; enregistrer les deux démarre automatiquement l’interrogation des commandes de volume, chaîne et autres. Une IP sans port utilise HTTP 8081. Effacez l’adresse ou choisissez **Déconnecter** pour arrêter. Cette connexion sortante prend en charge la livraison confirmée et ne nécessite aucun écouteur local. Voir [connexion et compatibilité](docs/remote-command-server.md). Les exemples suivants décrivent le mode proxy/écouteur local existant.

**Rechercher un serveur de commandes** permet de trouver un contrôleur et de demander l’approbation de l’opérateur sans copier de jeton d’appareil. Tauri interroge d’abord le DNS natif et peut, si le résultat est vide, utiliser un profil de déploiement explicitement configuré ; les lecteurs sur navigateur, LG et Capacitor utilisent le parcours du profil navigateur. Les métadonnées de découverte Home peuvent être hébergées sur here.now indépendamment du contrôleur. Les versions génériques n’incluent pas automatiquement ce profil Home et les mises à jour ne remplacent pas les connexions enregistrées. Voir [le comportement des plateformes, la configuration du profil et le dépannage](docs/remote-command-server.md#discovery-and-one-time-approval).

La télécommande HTTP locale est **désactivée par défaut** dans le lecteur navigateur/OTT server, Tauri et Capacitor. Activez-la dans **Paramètres du lecteur → Télécommande** pour générer un code secret d’appareil. Les commandes sont des objets JSON contenant `"command"` ; les requêtes HTTP exigent `Authorization: Bearer <device-code>`.

<a id="architecture"></a>

### Architecture

<a id="local-command-url-recommended"></a>

#### URL locale de commandes (recommandée)

Activez **Télécommande HTTP locale** dans **Paramètres du lecteur → Télécommande**, copiez le **Code d’appareil** généré et configurez le proxy ci-dessous avec ce code. Définissez **URL locale de commandes** sur le point de commandes du proxy. Tant que c’est activé, le lecteur interroge cette URL toutes les dix secondes avec le code dans l’en-tête Authorization. Définir une URL ne suffit pas à activer la commande.

```
Player → GET http://192.168.1.50:8081/api/webhook/commands  (every 10s)
HA/curl → POST http://192.168.1.50:8081/api/webhook/commands  (on demand)
```

<a id="device-uuid"></a>

#### UUID d’appareil

L’UUID existant (par exemple `dev_a1b2c3d4e5`) est une métadonnée publique de routage, pas un identifiant d’autorisation. Le **Code d’appareil** séparé est généré de manière sûre lors de l’activation HTTP locale et reste sur cet appareil ; il n’est pas copié via les paramètres cloud. Désactiver HTTP local arrête interrogations/écouteurs. Réactiver génère un nouveau code : mettez à jour proxy et intégrations pour révoquer l’ancien.

Tauri et Capacitor ne démarrent leur écouteur HTTP loopback qu’après cette activation. Les proxys de transfert doivent lui envoyer le code affiché comme jeton Bearer. Le mode A utilise la file `local_proxy.py` configurée séparément et décrite ci-dessous.

<a id="remote-text-entry-swop"></a>

#### Saisie distante de texte (swop)

Objectif : saisir sur téléphone pour ♥™ / clavier virtuel distant lorsque TV et téléphone sont **sur des réseaux différents**, via transfert de session Cloudflare Worker.

- Dépôt Worker : [ottplay-swop](https://github.com/open-ott-play/ottplay-swop).
- **Autorisation d’installation :** le lecteur envoie ses requêtes au relais `/swop` de même origine de son serveur. Celui-ci ajoute son jeton privé d’installation ; chaque client sur l’origine enregistrée peut employer la saisie distante. Les UUID identifient les sessions et n’exigent aucune liste d’appareils autorisés.
- Paramètre : `swopBaseUrl` (vide = ♥™ affiche « non configuré » / aucune action). Modifiez-le dans **Réglages → Télécommande** (touche **2**) ou injectez-le via `/local/swop.json`, ignoré par Git, sur les installations opérateur.
- `POST /session` contient `clientId`, `caption` et `draft` ; `POST /val` contient `clientId`, `code` et le `sessionToken` renvoyé. L’URL du téléphone contient un jeton d’écriture distinct. Les jetons de lecture restent dans la mémoire du navigateur.
- **Installation locale :** définissez `SWOP_BASE_URL` et `SWOP_INSTALLATION_TOKEN` après enregistrement de l’installation et de ses origines LAN/localhost exactes dans le Worker. `scripts/install-ottplay-local-service.sh` les garde dans sa plist launchd privée, mode 0600. Le `/local/swop.json` public contient seulement `{"swopBaseUrl":"/swop"}`. Ne placez jamais de jeton d’installation dans les ressources publiques.
- **Hébergement statique :** configurez un proxy serveur authentifié pour les mêmes deux points. Gardez le jeton dans les secrets de l’hébergeur. Copier les fichiers publics du lecteur ne copie pas cet identifiant serveur.

> Le serveur OTT central désactive `/api/webhook/commands`, `/webhook/poll`, `/webhook/notify` et les alias de santé des commandes pour toute méthode HTTP. Utilisez le serveur de commandes distinct ou un `local_proxy.py` authentifié explicitement configuré pour le mode A ; le serveur central n’a pas de file de diffusion générale.

<a id="available-commands"></a>

### Commandes disponibles

Tous les exemples suivants utilisent `http://192.168.1.50:8081/api/webhook/commands` comme URL du proxy local. Remplacez-la par votre adresse réelle et définissez `OTTPLAY_QUEUE_HTTP_TOKEN` sur le **Code d’appareil** affiché après activation du contrôle HTTP. Le proxy doit utiliser le même code.

<a id="popup_message--show-notification-popup"></a>

#### `popup_message` — Afficher une notification

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"popup_message","message":"Hello TV!","popup_duration":10}'
```

| Champ | Type | Valeur par défaut | Description |
|---|---|---|---|
| `message` | string | obligatoire | Texte à afficher |
| `popup_duration` | number | 5 | Secondes d’affichage (en haut à droite) |

<a id="channel_by_number--switch-to-channel-by-list-position"></a>

#### `channel_by_number` — Changer de chaîne par position

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_number","channel_number":42}'
```

| Champ | Type | Valeur par défaut | Description |
|---|---|---|---|
| `channel_number` | number | obligatoire | Position dans la liste, à partir de 1 |

<a id="channel_by_name--switch-to-channel-by-partial-name"></a>

#### `channel_by_name` — Changer de chaîne par nom complet ou partiel

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"channel_by_name","channel_name":"discovery"}'
```

Recherche de sous-chaîne insensible à la casse. La première correspondance est retenue.

| Champ | Type | Valeur par défaut | Description |
|---|---|---|---|
| `channel_name` | string | obligatoire | Nom de chaîne ou partie du nom |

<a id="random_channel--switch-to-random-channel"></a>

#### `random_channel` — Choisir une chaîne aléatoire

Cette ancienne commande sélectionne les chaînes admissibles dans la liste ou catégorie actuelle. Les numéros de chaîne et les plages désignent les positions dans cette liste ; voir les [règles de sélection aléatoire sûre](docs/remote-command-server.md#safe-random-playback).

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

| Champ | Type | Valeur par défaut | Description |
|---|---|---|---|
| `random_range` | [start, end] | liste actuelle | Plage commençant à 1 |

<a id="change_provider--switch-iptv-provider"></a>

#### `change_provider` — Changer de fournisseur IPTV

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider","provider":0}'
```

| Champ | Type | Valeur par défaut | Description |
|---|---|---|---|
| `provider` | number | obligatoire | Indice du tableau de fournisseurs (0=m3u, 1=stalker, 2=xtream, ...) |

<a id="change_playlist--load-new-m3u-playlist"></a>

#### `change_playlist` — Charger une nouvelle liste M3U

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_playlist","playlist":"http://example.com/playlist.m3u"}'
```

| Champ | Type | Valeur par défaut | Description |
|---|---|---|---|
| `playlist` | string | obligatoire | URL de liste M3U |

<a id="change_provider_settings--update-provider-configuration"></a>

#### `change_provider_settings` — Mettre à jour le fournisseur

```bash
curl -X POST http://192.168.1.50:8081/api/webhook/commands \
  -H "Authorization: Bearer $OTTPLAY_QUEUE_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"change_provider_settings","provider_settings":"{\"url\":\"http://example.com\",\"login\":\"user\",\"password\":\"pass\"}"}'
```

| Champ | Type | Valeur par défaut | Description |
|---|---|---|---|
| `provider_settings` | string | obligatoire | Chaîne JSON de configuration du fournisseur |

<a id="set_volume--set-or-adjust-volume"></a>

#### `set_volume` — Définir ou ajuster le volume

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

Ignoré silencieusement sur les clients sans réglage de volume.

| Champ | Type | Valeur par défaut | Description |
|---|---|---|---|
| `volume` | number | — | Niveau absolu 0–100 |
| `volume_step` | number | — | Variation relative, par exemple +10 ou -5 |

<a id="player-standby-restart-and-exit"></a>

#### Veille, redémarrage et fermeture du lecteur

La file webhook sans accusé du proxy local ne prend en charge ni `exit_player` ni les requêtes typées de veille/réveil. Connectez le lecteur au [serveur de commandes](docs/remote-command-server.md) et utilisez sa CLI :

```sh
ott d1 standby        # Stop playback and tracked player work; remain connected
ott d1 go             # Leave standby and resume configured provider/profile startup
ott d1 restart stream # Reconnect the current stream
ott d1 restart        # Reload the player; preserve standby if it is set
ott d1 exit           # Exit a supported native app; never enters standby
```

Remplacez `d1` par votre alias enregistré. `stop` est un alias de `standby` ; `start` et `wake` sont des alias de `go`. Go exige un lecteur actif et connecté ; il ne lance pas une application fermée et ne réveille pas un appareil hors ligne. Un navigateur ou téléviseur sans fermeture native signale que cette fonction n’est pas prise en charge. La veille garde l’interrogation distante active et ne suspend pas les travaux indépendants de l’hôte ou du serveur partagé.

Après standby/go, vérifiez l’état veille/arrière-plan avec `ott d1 status` et confirmez séparément la reprise de lecture. Après rechargement, confirmez une nouvelle instance d’exécution avec `ott d1 doctor`. Après fermeture, confirmez via le système que le processus est terminé ; un timeout distant ne prouve pas la fermeture. L’acceptation d’une commande seule ne confirme aucun de ces résultats.

<a id="local-proxy-server"></a>

## Serveur proxy local

`local_proxy.py` est une file authentifiée autonome pour un lecteur. Son invocation par défaut se termine sans ouvrir de port. Chaque instance utilise le code généré par son lecteur ; employez des instances/ports séparés pour plusieurs lecteurs. Le paramètre de requête `device_id` est accepté comme métadonnée de compatibilité et n’authentifie ni ne sélectionne un autre appareil.

<a id="start-the-proxy"></a>

### Démarrer le proxy

1. Activez **Télécommande HTTP locale** dans le lecteur et copiez son **Code d’appareil**.
2. Sur l’hôte proxy, configurez le code et l’origine exacte servant le lecteur (schéma, hôte et port, sans chemin) :

```bash
read -r -s -p 'Device code: ' OTTPLAY_QUEUE_HTTP_TOKEN
export OTTPLAY_QUEUE_HTTP_TOKEN
OTTPLAY_QUEUE_HTTP_ENABLED=1 \
OTTPLAY_QUEUE_HTTP_HOST=0.0.0.0 \
OTTPLAY_QUEUE_HTTP_ORIGINS=http://192.168.1.50:8080 \
python3 local_proxy.py 8081
```

3. Définissez l’**URL locale de commandes** du lecteur sur `http://192.168.1.50:8081/api/webhook/commands`.

L’adresse d’écoute par défaut est `127.0.0.1` ; l’exemple active explicitement le LAN. `OTTPLAY_QUEUE_HTTP_ORIGINS` est une liste d’origines exactes autorisées, séparées par des virgules. Utilisez un proxy inverse HTTPS si le lecteur est servi en HTTPS, pour que les règles de contenu mixte autorisent l’interrogation. Gardez le code secret et hors des URL. Lorsque le lecteur génère un nouveau code, redémarrez le proxy avec cette valeur ; désactiver seulement le lecteur n’arrête pas un processus proxy géré séparément.

<a id="endpoints"></a>

### Points d’accès

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/webhook/commands` | Mettre une commande en file |
| `GET` | `/api/webhook/commands` | Récupérer les commandes (interrogation du lecteur) |
| `POST` | `/webhook/notify` | Alias de compatibilité authentifié |
| `GET` | `/webhook/poll` | Alias de compatibilité authentifié |

Envoi et récupération exigent le même code Bearer. Aucun point de diffusion non authentifié n’existe. Les commandes expirent après 60 secondes ; chaque proxy en conserve au maximum 50.

Le proxy gère jusqu’à 16 connexions simultanées ; une connexion de navigateur inactive ou une requête incomplète ne retarde donc pas les autres commandes. Chaque socket a un délai d’inactivité de cinq secondes ; les connexions supplémentaires sont fermées quand tous les workers sont occupés. Ajout et retrait de la file sont atomiques entre workers.

<a id="smoke-script-all-modes"></a>

### Script de test (tous modes)

```bash
# Export OTTPLAY_QUEUE_HTTP_TOKEN with the enabled test player's device code first.
# Mode B / Capacitor (prefer 127.0.0.1:18081; fallback 18082..=18090)
# Cap+Tauri dual-run: ./scripts/smoke-command-queue.sh --discover
./scripts/smoke-command-queue.sh

# Mode A local_proxy on :8081
BASE_URL=http://127.0.0.1:8081 ./scripts/smoke-command-queue.sh
```

Émulateur/appareil Android : exécutez d’abord `adb forward tcp:18081 tcp:18081`. Cap/Tauri sont limités au loopback — utilisez ce proxy mode A pour Home Assistant sur le LAN. Détails : `docs/capacitor-mobile.md`, section Smoke test.

<a id="cors"></a>

### CORS

Le proxy n’autorise les requêtes de navigateur que depuis `OTTPLAY_QUEUE_HTTP_ORIGINS`. Les requêtes préalables `OPTIONS` d’une origine autorisée n’exigent pas de jeton ; chaque GET/POST réel exige le code Bearer. Les origines génériques et `null` ne sont pas acceptées. Home Assistant et les clients hors navigateur peuvent omettre Origin, mais doivent toujours s’authentifier.

<a id="example-home-assistant-webhook--local-proxy--player"></a>

### Exemple : webhook Home Assistant → proxy local → lecteur

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

### Exemples d’automatisation Home Assistant

Les exemples de notification, chaîne et volume utilisent le proxy local. Définissez `ottplay_device_authorization` dans `secrets.yaml` de Home Assistant sur `Bearer <device-code>`, avec le code affiché par le lecteur activé.

La veille nocturne utilise le [serveur de commandes](docs/remote-command-server.md) distinct. Remplacez son URL d’exemple et `DEVICE_UUID` ci-dessous par l’adresse du contrôleur et l’ID enregistré ; l’alias CLI local `d1` n’est pas un ID d’appareil. Définissez `ottplay_control_authorization` sur `Bearer <controller-admin-token>` dans `secrets.yaml`. Cet identifiant est distinct du code du proxy local. Voir la documentation Home Assistant [RESTful Command](https://www.home-assistant.io/integrations/rest_command/) et [secrets](https://www.home-assistant.io/docs/configuration/secrets/).

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

`standby_request` contient la réponse HTTP pour la trace d’automatisation. HTTP 202 signifie seulement mis en file : conservez `content.id`, puis interrogez `GET /api/requests?device_id=DEVICE_UUID&id=REQUEST_ID` avec le même identifiant du contrôleur pour obtenir la réponse du lecteur. Une nouvelle requête `status` observe `player.standby` et `player.background` ; veille activée avec `suspended` et zéro tâche en attente confirme la fin des travaux suivis du lecteur. Pour quitter la veille, utilisez la même requête typée avec `"operation":"wake"` (`ott d1 go`). Ne répétez pas aveuglément une mutation après un timeout. Voir l’[API requête/réponse](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#requestresponse-extension-protocol-1) et la [sémantique de veille](https://github.com/open-ott-play/ottplay-control-server/blob/main/docs/api.md#player-standby-and-wake) du contrôleur.

<a id="server-api-reference"></a>

## Référence API serveur

<a id="webhook-endpoints-rust-ottplay-server"></a>

### Points webhook (Rust `ottplay-server`)

Le serveur Rust et le repli Python archivé refusent les points de commandes avec HTTP 403. `/api/webhook/commands`, `/webhook/notify`, `/webhook/poll` et les alias de santé ne mettent pas de commandes en file, n’en diffusent pas et n’en retirent pas. L’API générale de retours ne peut pas remplacer ces routes réservées. Le mode A utilise le serveur de commandes ou le proxy local authentifié configurés séparément ci-dessus.

<a id="other-endpoints"></a>

### Autres points

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/epg/<hash>.json` | Données EPG d’une chaîne |
| `GET` | `/logo/<id>.svg` | Logo de chaîne généré |
| `GET` | `/version/<path>` | Empreinte de version de fichier |
| `POST` | `/m3u/match-channels` | Correspondance chaînes/EPG |
| `POST` | `/m3u/match-logos` | Correspondance des logos |
| `POST` | `/m3u/cp.php` | Proxy de flux |
| `GET/POST` | `/feedback/` | Journalisation des retours |
| `GET` | `/tmdb/*` | Proxy API TMDb |

<a id="epg"></a>

### EPG

```bash
# Add XMLTV EPG source(s) via env var (semicolon-separated)
EPG_URLS="http://example.com/epg.xml.gz" ./target/release/ottplay-server --port 8080
```

<a id="project-structure"></a>

## Structure du projet

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

## Affectation des touches STB

- **Samsung Tizen** : `RETURN=10009`, `ENTER=13`, couleurs 403–406.
- **Samsung Maple** : croix directionnelle 4/5/6/8, codes SDK originaux.
- **LG WebOS** : `RETURN=461`, couleurs compatibles HbbTV.
- **LG NetCast** : `RETURN=8`, codes HbbTV.
- **MAG** : `RETURN=8`, API gSTB pour MAC.
- **Dune HD** : codes standard, API Dune.
- **Android TV** : codes Android (`BACK=4`, `DPAD_*` 19–22, `ENTER=66`).
- **HbbTV/Panasonic/Philips/Sony/etc.** : codes HbbTV (`RED=403`, `BLUE=406`, `VOL_UP=447`).

<a id="documentation"></a>

## Documentation

- [Wiki de documentation](./docs/wiki/Home.fr.md) / [Wiki en russe](./docs/wiki/Home.ru.md) — navigation orientée tâches et règles de maintenance.
- [Rapport d’implémentation](./docs/implementation-report.fr.md) / [Processus et résultat en russe](./docs/implementation-report.ru.md) — diagrammes colorés, comportement vérifié, coût mesuré et portes de publication.
- [Guide de livraison](./docs/roadmap-delivery.fr.md) / [Nouvelles fonctions en russe](./docs/roadmap-delivery.ru.md) — fonctions, limites et vérification.
- [Guides de démarrage en 88 langues d’interface](./docs/readme/README.md) — générés depuis les traductions livrées ; le manuel principal et les guides associés existent en [24 langues de documentation](docs/manual-translations.md), les autres références techniques gardant leurs langues existantes.
- [Limites de qualité et récupération du direct](./docs/playback-stream-policy.fr.md) / [En russe](./docs/playback-stream-policy.ru.md).
- [Correspondance XMLTV manuelle et accessibilité classique](./docs/guide-binding-accessibility.fr.md) / [En russe](./docs/guide-binding-accessibility.ru.md).
- [Vérification audio/vidéo hébergée](./docs/audio-video-check.fr.md) / [En russe](./docs/audio-video-check.ru.md).
- [Médiathèque Xtream](./docs/xtream-media.fr.md) / [En russe](./docs/xtream-media.ru.md).
- [Transfert entre appareils de même source](./docs/remote-handoff.fr.md) / [En russe](./docs/remote-handoff.ru.md).
- [Paramètres locaux récupérables](./docs/settings-recovery.fr.md) / [En russe](./docs/settings-recovery.ru.md).
- [Générations de navigateurs, systèmes et vérifications du candidat exact](docs/browser-compatibility.fr.md) / [En russe](docs/browser-compatibility.ru.md).

- [Architecture du lecteur](./docs/architecture.md) — responsabilités d’exécution, intégration fournisseur, lecture, guide, adaptateurs et contrats de compilation.
- [Chaîne de compilation ES5 classique](./docs/build-pipeline.md) — compilation, compatibilité et limites de taille des artefacts.
- [Noms des ressources et migration du déploiement](./docs/asset-layout.md) — chemins descriptifs communs aux paquets web et natifs.
- [Atelier distant](./docs/remote-workbench.md) — inspection interface/médias, reçus d’opérations et preuves conservées.
- [Diagnostics d’exécution](./docs/runtime-debug.md) — historique d’erreurs, compteurs d’images/boucles, mesures natives Capacitor/Tauri et débogage serveur.
- [Livraison locale macOS](./docs/macos-local-delivery.md) — compilation depuis le dépôt, installation locale et vérification.

<a id="license"></a>

## Licence

[MIT](LICENSE) — libre et open source. Les contenus des fournisseurs et dépendances tierces conservent leurs droits et licences propres.

L’application distincte [OTTPlay native webOS](docs/native-webos.md), dérivée de PlxNative, est distribuée sous **GPL-3.0-or-later** avec le code source correspondant.
La licence MIT à la racine du projet ne modifie pas la licence de cette application native ni de ses correctifs.

<a id="desktop-updater--notarization-mode-b"></a>

## Mise à jour bureau / notarisation (mode B)

Le [guide de signature et mise à jour bureau](docs/tauri-updater-notarize.md) décrit signature ad hoc macOS, Developer ID/notarisation facultatifs et vérification du paquet. Le CI de publication utilise une signature ad hoc sans identifiants Apple. La signature des mises à jour est distincte ; les mises à jour automatiques en production ne sont pas configurées.

<a id="local-mac-build-helpers"></a>

## Outils de compilation locale Mac

Voir [docs/local-build-scripts.md](docs/local-build-scripts.md).

<a id="privacy"></a>

## Confidentialité

Consultez la [politique de confidentialité](docs/privacy-policy.md) pour les paramètres locaux, services configurés et choix disponibles. Contact confidentialité et assistance : [alvit.work@gmail.com](mailto:alvit.work@gmail.com).

Studio 2026 est le thème par défaut. Classic et PLi-HD restent sélectionnables et les préférences enregistrées sont conservées. Voir [paramètres d’interface](docs/interface-settings.md). Le thème PLi-HD crédite Vali, littlesat, VU+NL, Milo et les contributeurs d’origine. L’[historique de conception et crédits de l’interface](docs/interface-history.md) contient son histoire en anglais et les liens sources, également accessibles depuis le menu d’informations du lecteur.

<a id="demo-video-editing"></a>

## Montage de vidéos de démonstration

Utilisez le [processus local video-use](docs/demo-video.md) pour préparer et monter les démonstrations. L’outil conserve tous les médias générés hors de Git.

<a id="plex-media-library"></a>

## Médiathèque Plex

Chaque lecteur peut se connecter à un compte Plex ou à Plex Media Server via le fournisseur **Plex**. L’intégration utilise Plex ; Synology est un hôte possible du serveur multimédia. Toutes les vidéos et pistes musicales accessibles apparaissent automatiquement dans la liste des chaînes ; la sélection de catégorie filtre par bibliothèque, dossier ou série. La lecture commence dès le premier lot exploitable, avec chargement en arrière-plan, recherche standard et actions aléatoire/répétition, sans configurer Plex sur le serveur OTT. Voir [connexion Plex et lecture directe](docs/plex-provider.md).

![Chargement Plex, navigation des fichiers et cycle d’arrêt](docs/images/plex-playback-lifecycle.svg)

La [revue illustrée de fiabilité](docs/plex-provider.md#reliability-review-process-and-results) explique les règles de chargement/annulation, les corrections de catalogues complets et de changement de fichier, et les résultats mesurés Chromium/WebKit.

Une intégration facultative du serveur OTT expose aussi le catalogue d’un serveur Plex existant et une lecture compatible via une entrée de bibliothèque NAS distincte et un export M3U. Voir [configuration de bibliothèque côté serveur et accès client](docs/synology-library.md).

<a id="related-repositories"></a>

## Dépôts associés

- [ottplay-core](https://github.com/open-ott-play/ottplay-core) possède la logique métier JVM/ES5 partagée, les contrats réseau et le client FOSS2. Ce lecteur consomme des artefacts générés ; suivez le guide de livraison du cœur pour les changements communs.
- [ottplay-android](https://github.com/open-ott-play/ottplay-android) est l’application native Kotlin/Compose distincte, avec ses propres identités d’installation et de publication.
- [ottplay-control-server](https://github.com/open-ott-play/ottplay-control-server) fournit les commandes distantes auto-hébergées ; [ottplay-swop](https://github.com/open-ott-play/ottplay-swop) fournit un transport de saisie facultatif basé sur Worker.
- [ottplay-web-vitrine](https://github.com/open-ott-play/ottplay-web-vitrine) gère le profil hébergé de la démo navigateur, ses médias et les vérifications de publication.

<a id="project-maintenance"></a>

## Maintenance du projet

Voir [exigences de contribution et de test](CONTRIBUTING.md), [politique de signalement de sécurité](SECURITY.md), [conception de sécurité](docs/security-design.md) et [preuves OpenSSF et critères restants](docs/openssf-evidence.md).
