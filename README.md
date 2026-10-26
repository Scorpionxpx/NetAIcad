# netAIcad | AI Powered Netacad Helper

`netAIcad` est une extension Chrome/Firefox qui aide à répondre aux quiz Netacad et à parcourir les modules de lecture, avec des fournisseurs IA configurables.

**Version actuelle : 1.0.11**

## Fonctionnalités

- **Fournisseurs IA configurables** :
  - **OpenAI** — clé API et modèle configurables
  - **Gemini** — catégorie distincte, avec sa propre clé API et son propre test
  - **Mistral AI** — clé API et modèle configurables
- **Réponse au quiz** — extraction de la question, appel au fournisseur actif, sélection des réponses et envoi
- **Quiz automatique** — mode optionnel qui enchaîne les questions d’un quiz, avec arrêt manuel disponible
- **Questions à associations** — prise en charge des questions de type « associer chaque élément à une option »
- **Questions à réponses multiples** — prise en charge des cases à cocher
- **Parcours de module** — assistance à la lecture et à la progression des sections
- **Regroupement des commandes** — les commandes de quiz sont regroupées en bas à droite de la page
- **Visualisation configurable** — affiche ou masque les commandes principales depuis une page dédiée
- **Journal local** — diagnostic limité, exportable en JSON, sans interception réseau

## Installation

### Chrome

1. Ouvre `chrome://extensions/`.
2. Active le **Mode développeur**.
3. Clique sur **Charger l’extension non empaquetée**.
4. Sélectionne le dossier `netAIcad`.

### Firefox

1. Ouvre `about:debugging#/runtime/this-firefox`.
2. Clique sur **Charger un module complémentaire temporaire**.
3. Sélectionne le fichier `manifest.json` du dossier `netAIcad`.

> Le repli de clic approuvé via `chrome.debugger` est spécifique à Chrome.

## Configuration

1. Clique sur l’icône de l’extension.
2. Choisis le fournisseur actif : **OpenAI**, **Gemini** ou **Mistral AI**.
3. Saisis la clé API correspondante.
4. Clique sur **Tester la clé**, puis sur **Enregistrer**.

Chaque fournisseur possède sa propre catégorie :

| Fournisseur | Stockage de la clé | Test |
|---|---|---|
| OpenAI | `chrome.storage.sync` | API OpenAI |
| Gemini | `chrome.storage.sync` | API Google Generative Language |
| Mistral AI | `chrome.storage.local` | API Mistral |

## Visualisation des boutons

Depuis la popup, ouvre **Réglages d’affichage**. La page permet d’activer ou de désactiver l’affichage des commandes suivantes :

| Commande | Effet |
|---|---|
| **Livre** | Affiche ou masque la commande de lecture / parcours du module |
| **Log** | Affiche ou masque le bouton et le journal de diagnostic local |
| **Réponse au quiz** | Affiche ou masque la commande manuelle de réponse au quiz |
| **Quiz automatique** | Affiche ou masque la commande de réponse et d’envoi automatiques |

Les préférences sont enregistrées dans `chrome.storage.local` et appliquées automatiquement, sans recharger l’extension.

## Utilisation

### Réponse au quiz

1. Ouvre un quiz Netacad.
2. Utilise **Réponse au quiz** pour traiter la question affichée.
3. L’extension extrait la question, interroge le fournisseur actif, sélectionne la réponse proposée puis envoie.

### Quiz automatique

1. Ouvre un quiz Netacad.
2. Clique sur **Démarrer le quiz automatique**.
3. Confirme l’avertissement : les réponses peuvent être incorrectes et les appels API peuvent être facturés.
4. Utilise **Arrêter** pour interrompre le traitement des questions suivantes.

Le mode automatique envoie chaque question une seule fois et s’arrête en cas d’ambiguïté, d’échec de détection ou d’erreur API.

## Fichiers principaux

- `manifest.json` — configuration de l’extension
- `content.js` — extraction des quiz, interface et parcours de module
- `quiz-only.js` — commande manuelle de réponse au quiz
- `quiz-auto.js` — mode automatique de réponse et d’envoi
- `quiz-dock.js` — regroupement des commandes de quiz
- `ui-visibility.js` — application des préférences d’affichage
- `diagnostics.js` — journal local et export JSON
- `popup.html` / `popup.js` — configuration des fournisseurs et accès aux réglages d’affichage
- `visibility-options.html` / `visibility-options.js` — page de visualisation des commandes
- `model-worker.js` — service worker et appels aux fournisseurs IA

## Confidentialité

- Les clés API sont stockées localement par le navigateur.
- Les données de quiz ne sont envoyées qu’au fournisseur IA choisi lorsque tu lances une action.
- Le journal de diagnostic reste local et peut être exporté manuellement.
- Aucun stockage de clé API n’est un coffre-fort chiffré.

## Avertissement

Cette extension est fournie à des fins éducatives. Vérifie toujours les suggestions de l’IA et utilise ton propre jugement.
