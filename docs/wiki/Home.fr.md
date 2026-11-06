<a id="ott-play-documentation-wiki"></a>

# Wiki de documentation OTT-play

<!-- language-navigation:start -->
<p dir="ltr">
<a href="Home.md" lang="en" dir="ltr">English</a> · <a href="Home.ar.md" lang="ar" dir="rtl">العربية</a> · <a href="Home.bn.md" lang="bn" dir="ltr">বাংলা</a> · <a href="Home.cs.md" lang="cs" dir="ltr">Čeština</a> · <a href="Home.de.md" lang="de" dir="ltr">Deutsch</a> · <a href="Home.es.md" lang="es" dir="ltr">Español</a> · <a href="Home.fa.md" lang="fa" dir="rtl">فارسی</a> · <a href="Home.fr.md" lang="fr" dir="ltr">Français</a>
<br>
<a href="Home.he.md" lang="he" dir="rtl">עברית</a> · <a href="Home.hi.md" lang="hi" dir="ltr">हिन्दी</a> · <a href="Home.id.md" lang="id" dir="ltr">Bahasa Indonesia</a> · <a href="Home.it.md" lang="it" dir="ltr">Italiano</a> · <a href="Home.ja.md" lang="ja" dir="ltr">日本語</a> · <a href="Home.ko.md" lang="ko" dir="ltr">한국어</a> · <a href="Home.nl.md" lang="nl" dir="ltr">Nederlands</a> · <a href="Home.pl.md" lang="pl" dir="ltr">Polski</a>
<br>
<a href="Home.pt.md" lang="pt" dir="ltr">Português</a> · <a href="Home.ru.md" lang="ru" dir="ltr">Русский</a> · <a href="Home.th.md" lang="th" dir="ltr">ไทย</a> · <a href="Home.tr.md" lang="tr" dir="ltr">Türkçe</a> · <a href="Home.uk.md" lang="uk" dir="ltr">Українська</a> · <a href="Home.vi.md" lang="vi" dir="ltr">Tiếng Việt</a> · <a href="Home.zh-Hans.md" lang="zh-Hans" dir="ltr">简体中文</a> · <a href="Home.zh-Hant.md" lang="zh-Hant" dir="ltr">繁體中文</a>
</p>
<!-- language-navigation:end -->

[README](../../README.fr.md) · [Toutes les langues de l’interface](../readme/README.md)

Cette page est l’accueil de la documentation versionnée dans le dépôt source. GitHub peut afficher directement ces pages Markdown ; les conserver ici permet de réviser instructions, diagrammes et tests avec le code. Le [Wiki GitHub](https://github.com/open-ott-play/ottplay-foss/wiki) séparé est exporté depuis ces sources et indique sa révision source sur chaque page. Voir les [instructions de publication](../wiki-publishing.md).

<a id="start-and-install"></a>

## Démarrer et installer

- [Guide pratique](../../README.fr.md), disponible en [24 langues de documentation](../manual-translations.md).
- [Démarrages rapides localisés pour les 88 langues de l’interface](../readme/README.md). Ils réutilisent les libellés traduits et les étapes de navigation. Ce ne sont pas 88 manuels techniques traduits. Le manuel principal et les guides de fonctionnalités associés existent intégralement dans 24 langues.
- [Paquets et mises à jour Android Full/API 22](../android-distributions.md), [compilation Android](../../android/README.md) et [Capacitor iOS/Android](../capacitor-mobile.md).
- [Livraison bureau sous macOS](../macos-local-delivery.md), [signature/mise à jour Tauri](../tauri-updater-notarize.md) et [instances HTTP locales](../local-http-deployment.md).

<a id="process-and-results"></a>

## Processus et résultats

- [Qualification des navigateurs et vérification du candidat](../browser-compatibility.fr.md) ([Русский](../browser-compatibility.ru.md)) : cibles configurées, diagrammes colorés, vérifications des paquets exacts et résultats locaux distincts.

- [Rapport d’implémentation et diagrammes colorés](../implementation-report.fr.md) ([Русский](../implementation-report.ru.md)) : changements révisés, régressions corrigées, résultats mesurés et critères de publication restants.

<a id="use-the-new-capabilities"></a>

## Utiliser les nouvelles capacités

- [Livraison des fonctionnalités et limites des plateformes](../roadmap-delivery.fr.md) ([Русский](../roadmap-delivery.ru.md)).
- [Plafonds de qualité, sources de secours explicites pour le direct et récupération bornée](../playback-stream-policy.fr.md) ([Русский](../playback-stream-policy.ru.md)).
- [Association XMLTV manuelle et accessibilité classique](../guide-binding-accessibility.fr.md) ([Русский](../guide-binding-accessibility.ru.md)).
- [Test hébergé d’image et de son](../audio-video-check.fr.md) ([Русский](../audio-video-check.ru.md)) : **Informations → Audio → Lire**, tonalités attendues, diagramme d’hébergement et retour au direct. Le clip est récupéré à la demande, nécessite Internet et est absent des paquets du lecteur. La démonstration en ligne séparée de motifs animés est silencieuse.
- [Bibliothèque de films/séries Xtream](../xtream-media.fr.md) ([Русский](../xtream-media.ru.md)).
- [Transfert du lecteur sur une même source](../remote-handoff.fr.md) ([Русский](../remote-handoff.ru.md)).
- [Journal local des réglages et récupération](../settings-recovery.fr.md) ([Русский](../settings-recovery.ru.md)).
- [Contrôle fiable, profils reprenables et transfert](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.md) ([Русский](https://github.com/open-ott-play/ottplay-control-server/blob/9b28c08eefca3948c78336e7e16a45e6fc492e31/docs/reliable-control.ru.md)). Nécessite une révision compatible du contrôleur/CLI et des permissions configurées.
- [Préférences sémantiques audio/sous-titres dans Android natif](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.md) ([Русский](https://github.com/open-ott-play/ottplay-android/blob/be0d8008c75b0badede7022dbb9096e11914227f/docs/TRACK-PREFERENCES.ru.md)). L’application Kotlin native est distincte des APK Capacitor de ce dépôt.

<a id="configure-sources-and-inspect-problems"></a>

## Configurer les sources et examiner les problèmes

- [Connexion et lecture Plex](../plex-provider.md), [architecture du guide](../guide-architecture.md) et [diagnostic EPG hébergé](../hosted-epg-diagnostics.md).
- [Réglages de l’interface](../interface-settings.md), [historique du design et crédits](../interface-history.md) et [catalogues de langues/claviers](../localization.md).
- [Atelier distant](../remote-workbench.md), [diagnostic d’exécution](../runtime-debug.md) et [consentement, masquage et conservation des diagnostics](../diagnostic-security.md).
- [Liste de contrôle des appareils natifs](../mode-b-device-smoke.md), [liste des appareils Tauri](../mode-b-tauri-smoke.md) et [commandes de fenêtre du navigateur](../browser-window-controls.md).

- [Coût mesuré des fonctionnalités](../roadmap-size.fr.md), données brutes et graphique SVG.

<a id="develop-and-release"></a>

## Développer et publier

- [Architecture et responsabilités](../architecture.md), [sessions de lecture](../playback-session-architecture.md) et [compilation ES5 classique](../build-pipeline.md).
- [Noms des ressources d’exécution](../asset-layout.md), [politique de versions](../../RELEASING.md), [guide opérateur de publication](../release-workflow.md) et [fuzzing RC](../../FUZZING.md).
- [Politique de confidentialité](../privacy-policy.md) et [licence MIT](../../LICENSE).

Pour modifier la documentation, exécutez `npm run docs:generate` lorsqu’un libellé d’interface ou modèle de démarrage rapide change, puis `npm run check:docs`. Gardez toutes les traductions complètes, les limites près des affirmations, et distinguez validation locale et essais sur appareils physiques. Les diagrammes sont des ressources révisables du dépôt ; voir [le SVG d’association du guide](../images/guide-binding.svg) et ceux liés aux guides de fonctionnalités. Le vérificateur valide les destinations de fichiers relatives, pas la disponibilité des sites distants ni toutes les ancres de titres Markdown.
