# netAIcad | AI Powered Netacad Helper

Extension d’assistance aux quiz et au parcours des modules Cisco Networking Academy.

Version actuelle : `1.0.23`. Le numéro de référence est celui de `manifest.json`.

Les réponses de l’IA peuvent être incorrectes. Aucun score ni fonctionnement sur toutes les variantes de NetAcad n’est garanti. Utilise l’extension uniquement lorsque les règles de ta formation l’autorisent.

## Fonctionnalités

- Configuration des clés OpenAI, Gemini et Mistral dans la popup.
- Modèle OpenAI personnalisable, avec un réglage de raisonnement à utiliser seulement si le modèle le prend en charge.
- Commande manuelle « Réponse au quiz » et commande distincte de quiz automatique.
- Extraction de QCM à choix unique ou multiples et de questions à associations.
- Vérification de la consigne, du nombre de réponses et de la question visible avant les appels IA.
- Pause entre analyses, attente de stabilisation et relances limitées des clics de réponse non confirmés.
- Panneaux compacts, regroupés et dépliables.
- Page de visualisation pour afficher ou masquer Livre, Log, Réponse au quiz et Quiz automatique.
- Journal de parcours et diagnostics IA exportables en JSON.

## Installation et mises à jour

### Chrome / Chromium

1. Récupère tous les fichiers de la branche `main` : clone le dépôt ou utilise « Code > Download ZIP », puis extrais l’archive.
2. Ouvre `chrome://extensions/` et active le mode développeur.
3. Clique sur « Charger l’extension non empaquetée » et sélectionne le dossier contenant `manifest.json`.
4. Vérifie que la version affichée est `1.0.23`.
5. Recharge toute la page NetAcad, y compris après chaque rechargement de l’extension.

Pour mettre à jour une installation existante, remplace l’ensemble des fichiers du dossier chargé, puis clique sur « Recharger » dans la page des extensions. Ne remplace pas seulement le manifeste : les nouveaux scripts qu’il référence doivent également être présents.

Scripts ajoutés au fil des versions à conserver notamment : `answer-parser.js`, `quiz-cardinality.js`, `ai-error-messages.js`, `quiz-wait.js`, `quiz-click-retry.js` et `ui-visibility.js`.

### Firefox

Le dépôt contient des instructions historiques de chargement temporaire via `about:debugging#/runtime/this-firefox`, en sélectionnant `manifest.json`. La compatibilité complète du manifeste actuel et des fonctionnalités n’est pas garantie sur Firefox. Le repli de clic utilisant `chrome.debugger` cible Chrome.

## Configuration des fournisseurs

1. Clique sur l’icône de l’extension.
2. Choisis le fournisseur et renseigne sa clé.
3. Utilise « Tester la clé », puis « Enregistrer ». Le test ne sauvegarde pas à lui seul une nouvelle clé saisie.
4. Pour OpenAI, utilise aussi « Enregistrer le modèle OpenAI » après modification du modèle ou du raisonnement.

| Fournisseur | Clé | Modèle / comportement |
|---|---|---|
| OpenAI | `chrome.storage.sync` | Modèle personnalisé via l’API Responses ; sans modèle personnalisé, chemin historique `gpt-4o-mini` via Chat Completions. |
| Mistral | `chrome.storage.local` | Modèle configurable ; redirection des requêtes de type `gpt` vers Mistral lorsque ce fournisseur est sélectionné. |
| Gemini | `chrome.storage.sync` | Clé et test distincts ; les commandes historiques de type `gemini` utilisent cette clé. Voir la limite de routage ci-dessous. |

### Limites de configuration à connaître

- Le test de clé vérifie l’accès à la liste des modèles. Il ne garantit ni une génération réussie, ni le quota disponible, ni la compatibilité des paramètres du modèle.
- `gpt-4o-mini` rejette le paramètre `reasoning.effort` dans le cas observé. Pour ce modèle, choisis « Défaut du modèle », ce qui omet ce paramètre ; ne conserve pas un effort comme « Moyen » hérité d’un autre modèle.
- Le code n’effectue pas de négociation automatique des paramètres et ne remplace pas silencieusement le modèle choisi.
- Limite connue Gemini : les nouvelles commandes manuelle et automatique envoient actuellement `modelType: 'gpt'`. Le routeur gère OpenAI et la redirection vers Mistral, mais pas la redirection de ces commandes vers Gemini. Choisir Gemini dans la popup ne garantit donc pas leur utilisation de Gemini. Les diagnostics côté page indiquent la configuration, pas une preuve du routage effectif.

## Afficher ou masquer les commandes

Dans la popup, ouvre « Ouvrir les réglages d’affichage ».

| Interrupteur | Élément concerné |
|---|---|
| Livre | Bouton de parcours du module, identifié par `netacad-ai-walker-btn`. |
| Log | Bouton et panneau « Logs NetAIcad ». |
| Réponse au quiz | Panneau manuel repliable. |
| Quiz automatique | Lanceur « A » et son panneau. |

Les préférences sont enregistrées dans `chrome.storage.local`. Les règles CSS ciblent les identifiants de l’extension, y compris dans les iframes accessibles, et restent applicables quand les boutons sont recréés.

Masquer une commande ne constitue pas un arrêt de son traitement. Utilise « Arrêter » avant de masquer un mode en cours d’exécution.

## Réponse manuelle au quiz

1. Ouvre la commande repliée « Réponse au quiz ».
2. Clique sur son bouton de réponse pour traiter la question affichée.
3. Pour un QCM, l’extension vérifie la réponse proposée, la met en évidence et tente de sélectionner les options correspondantes.
4. Vérifie le résultat, puis clique toi-même sur « Envoyer ». Cette commande manuelle ne soumet pas automatiquement la réponse.

Pour les associations, le panneau manuel présente les suggestions à reporter et vérifier ; il ne faut pas supposer qu’elles sont toutes sélectionnées automatiquement. Certains libellés manuels mentionnent encore OpenAI même lorsque le routeur sélectionne Mistral.

## Quiz automatique

1. Ouvre un quiz et clique sur le lanceur « A ».
2. Clique sur « Démarrer » et confirme l’avertissement sur les erreurs possibles et la facturation API.
3. Le mode analyse, sélectionne puis tente une soumission de la question, avant d’attendre la suivante.
4. Utilise « Arrêter » pour empêcher les opérations suivantes. Un appel IA déjà lancé peut continuer côté fournisseur et être facturé.

### Pauses et transitions

Avant chaque analyse :

- pause minimale de 1,5 seconde ;
- vérification que la question et ses métadonnées restent identiques pendant 800 ms ;
- attente limitée à 15 secondes supplémentaires si la page reste instable ou si une transition temporaire empêche l’extraction.

Après une soumission, une phase distincte attend jusqu’à 15 secondes la détection de la question suivante ou des résultats. Ces délais ne constituent pas une limite globale unique de 15 secondes pour tout le cycle.

Ces attentes relisent la page : elles ne déclenchent pas de nouvel appel IA ni de nouvelle soumission. Le contrôle d’arrêt reste actif pendant les pauses. Une ambiguïté persistante provoque un arrêt explicite.

### Relances du clic de réponse — version 1.0.23

Lorsqu’un clic de sélection QCM n’est pas confirmé :

- premier cycle de clic, puis au maximum trois relances supplémentaires ;
- pause de 800 ms avant chaque relance ;
- vérification de la question, des métadonnées, du contrôle et de son état avant de recliquer ;
- absence de nouveau clic si l’état attendu est déjà obtenu ;
- arrêt si le contrôle est remplacé, si la question change ou si l’utilisateur demande l’arrêt.

Chaque cycle utilise le mécanisme `robustClick`, qui peut lui-même recourir au repli `chrome.debugger`. Le nombre de cycles ne correspond donc pas nécessairement au nombre d’événements physiques de clic.

Les relances concernent uniquement la sélection QCM associée au message « Clic de réponse non confirmé ». Elles ne relancent ni l’IA, ni « Envoyer », ni l’ensemble du quiz. Les clics d’associations ne bénéficient pas de ces trois relances. Après épuisement, le mode s’arrête sans soumettre cette question.

## Détermination du nombre de réponses

`quiz-cardinality.js` fournit la validation commune utilisée par les extractions synchrones et asynchrones :

- sélection d’un widget dont les options intersectent la zone visible, en tenant compte du viewport et des ancêtres qui masquent les débordements ;
- extraction de la consigne et des options du même widget ;
- reconnaissance de formulations françaises et anglaises, par exemple « Choisissez trois », « Sélectionnez les deux », « Choose exactly two » ;
- comparaison avec les véritables champs `radio` ou `checkbox` ;
- suppression du recours arbitraire à deux réponses lorsqu’aucun nombre n’est reconnu.

Une question à choix unique cohérente attend un choix. Des cases à cocher sans nombre explicite reconnu, une consigne contradictoire ou plusieurs questions visibles peuvent bloquer l’analyse avant l’appel IA. Les formulations reconnues ne couvrent pas toutes les langues ni toutes les variantes de consignes.

La consigne ne transforme jamais des boutons radio en cases à cocher. Si le texte demande plusieurs choix alors que le formulaire est à choix unique, le script s’arrête au lieu de forcer le formulaire.

## Validation des réponses OpenAI

Pour les QCM utilisant un modèle OpenAI personnalisé, `answer-parser.js` accepte les présentations simples et non ambiguës comme `B`, `B.`, `Réponse : B`, `**B**`, `(A); (C)` ou une liste de lettres séparées par des virgules.

Il refuse les explications libres, les doublons, les lettres hors options et un nombre de réponses différent de la demande. Il ne coupe pas silencieusement une liste trop longue et ne complète pas une réponse manquante.

Une réponse techniquement valide n’est pas nécessairement correcte sur le fond. Les associations ont leur propre validation et ne passent pas par ce normaliseur de lettres.

## Logs et diagnostics IA

Ouvre « Logs NetAIcad », reproduis le problème une fois, puis clique sur « Exporter JSON ». « Actualiser » relit le journal ; « Vider » efface les enregistrements disponibles. Un appel encore en cours peut ajouter son résultat après cet effacement.

L’export contient :

- `version` et `exportedAt` ;
- `entries` : événements de parcours de la page principale, jusqu’à 1 000 en mémoire, perdus au rechargement ;
- `aiEntries` : métadonnées IA persistées localement, avec une rétention visant les 100 derniers enregistrements partagés entre les pages et les sources.

Deux enregistrements peuvent décrire un même appel : un côté page (`source: 'ai'`) et un côté service worker (`source: 'openai-worker'`). Ne compte pas chaque ligne comme un nouvel appel facturé. Les identifiants des deux sources sont distincts ; utilise également les horaires et le contexte pour rapprocher les événements.

### Champs utiles

| Champ | Lecture |
|---|---|
| `event` | Début, succès ou erreur du traitement instrumenté. |
| `configuredModel` | Identifiant du modèle configuré, pas une mesure de sa qualité. |
| `keyConfigured` | Présence d’une clé enregistrée, pas validation de la clé. |
| `apiRequested` | Le chemin instrumenté a atteint l’étape d’appel. |
| `stage` | Étape atteinte : entrée, requête, réponse, parsing, etc. |
| `httpStatus` | Statut de la réponse HTTP quand il est disponible. |
| `apiErrorCode`, `apiErrorType`, `apiErrorParam` | Identifiants filtrés de l’erreur API, quand disponibles. |
| `refusalDetected` | Présence d’un marqueur de refus explicite dans l’API Responses. |
| `requiredAnswers`, `optionCount` | Nombre demandé et nombre d’options extraites. |
| `outputCharacters`, `parsedAnswerCount` | Taille du texte et nombre de choix validés, sans stocker les choix. |
| `diagnosticCode` | Cause distinguée par le service worker instrumenté. |

### Codes de diagnostic fréquents

| Code | Signification |
|---|---|
| `REQUEST_CONFIGURATION` | Requête refusée, par exemple paramètre non compatible. Vérifier `apiErrorParam`. |
| `QUOTA_EXHAUSTED` | L’API a renvoyé `insufficient_quota`. |
| `RATE_LIMIT` | L’API a renvoyé `rate_limit_exceeded`. |
| `AUTHENTICATION`, `PERMISSION` | Authentification ou autorisation refusée. |
| `PROVIDER_REFUSAL` | Refus explicitement marqué par OpenAI. |
| `RESPONSE_INCOMPLETE` | Réponse non terminée ; regarder `incompleteReason`. |
| `OUTPUT_COUNT` | Le nombre de choix reçus ne correspond pas au nombre demandé. |
| `OUTPUT_SYNTAX`, `OUTPUT_RANGE`, `OUTPUT_DUPLICATE` | Syntaxe non reconnue, option hors liste ou doublon. |
| `INPUT_COUNTS` | Nombre d’options ou de réponses incohérent avant génération. |
| `TIMEOUT`, `NETWORK_OR_RESPONSE` | Délai dépassé ou problème de réseau / lecture. |
| `LEGACY_ERROR` | Échec du chemin historique, avec moins de détails instrumentés. |

Les messages détaillés sont affichés dans le panneau automatique. Le panneau manuel conserve encore des messages plus génériques. Un refus formulé comme du texte ordinaire sans marqueur `refusal` n’est pas automatiquement reconnu comme refus.

Les diagnostics n’effectuent pas de requête IA supplémentaire et n’impliquent pas de relance payante. Un événement de succès indique une réponse API traitée, pas la confirmation du score ni de la soumission NetAcad. Une erreur de sélection du formulaire peut survenir après un succès IA.

## Dépannage

| Symptôme | Vérification |
|---|---|
| Ancienne version dans les logs | Recharger l’extension et toute la page ; regarder l’horodatage des nouveaux événements, car les anciens restent stockés. |
| Script absent / extension non chargée | Installer tous les fichiers référencés dans le manifeste, pas seulement les fichiers modifiés récemment. |
| `reasoning.effort` non pris en charge | Choisir « Défaut du modèle » ou un effort réellement compatible, puis enregistrer le modèle. |
| `OUTPUT_COUNT` | Comparer la consigne visible et `requiredAnswers` ; ne pas supposer un problème de clé ou de crédit. |
| Plusieurs questions visibles | Laisser finir la transition ; le mode automatique attend de manière bornée. Si cela persiste, exporter les logs et joindre une capture. |
| Clic non confirmé | La version 1.0.23 tente trois relances de sélection QCM ; vérifier le formulaire si elles échouent. |
| Bouton Livre toujours visible | Vérifier le réglage d’affichage, la version, puis recharger la page ; la règle cible `netacad-ai-walker-btn`. |
| Log vide après un arrêt avant génération | Les erreurs locales d’extraction ou de clic ne sont pas toutes persistées dans `aiEntries` ; joindre le message visible. |

## Fichiers principaux

| Fichier | Rôle |
|---|---|
| `manifest.json` | Version, permissions, ordre de chargement et service worker. |
| `content.js` | Fonctions historiques d’extraction, de clic et de parcours. |
| `reading-fixes.js`, `completion-fixes.js` | Ajustements du parcours et de la progression. |
| `quiz-cardinality.js` | Question visible, extraction QCM et nombre de réponses. |
| `quiz-only.js` | Assistance manuelle à la question courante. |
| `quiz-auto.js` | Boucle automatique, sélection et soumission contrôlée. |
| `quiz-wait.js` | Pause et attente de stabilité annulables. |
| `quiz-click-retry.js` | Relances limitées de sélection. |
| `quiz-dock.js` | Placement commun des commandes. |
| `ai-error-messages.js` | Messages d’erreur détaillés du mode automatique. |
| `answer-parser.js` | Normalisation et validation des lettres OpenAI. |
| `model-worker.js` | Modèles OpenAI personnalisés et diagnostics structurés. |
| `provider-worker.js`, `background.js`, `shared.js` | Routage, fonctions historiques et construction des prompts. |
| `diagnostics.js` | Collecte côté page, interface du journal et export. |
| `ui-visibility.js` | Règles de masquage par identifiants exacts. |
| `popup.html`, `popup.js`, `popup-model.js` | Configuration des fournisseurs et du modèle. |
| `visibility-options.html`, `visibility-options.js` | Tableau de réglage des boutons. |

## Tests

Depuis la racine du dépôt, avec Node.js :

```bash
node --test tests/*.test.js
```

Les tests versionnés couvrent notamment les helpers partagés, le parseur des lettres, le nombre de réponses et des calculs de visibilité géométrique. Les tests de logique ne remplacent pas une validation dans une session NetAcad réelle, avec ses animations, iframes et contrôles.

## Confidentialité et limites

- OpenAI et Gemini utilisent historiquement `chrome.storage.sync` pour leurs clés : ce stockage peut être synchronisé par le navigateur. Mistral utilise `chrome.storage.local`. Aucun de ces mécanismes ne constitue un coffre-fort dédié.
- Le mode automatique transmet plusieurs questions au fournisseur après confirmation initiale ; il ne redemande pas une confirmation pour chaque appel.
- L’export de diagnostic ne contient pas les clés, les questions, les réponses brutes ou les messages d’erreur bruts ; il enregistre des métadonnées et codes filtrés. Les traces de console historiques sont distinctes de cet export.
- Les enregistrements IA locaux restent disponibles après rechargement jusqu’à suppression ou éviction par la rétention.
- Les appels déjà lancés peuvent être facturés, même si le traitement s’arrête ensuite sur le formulaire.
- Aucune garantie de détection parfaite, d’absence de régression, de compatibilité Firefox complète ou de justesse des réponses n’est fournie.
