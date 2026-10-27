# Developpement du bouton Livre

Branche : `develop/livre-auto`. Version experimentale, non fusionnee dans `main`. Le manifeste reste en 1.0.23 : verifier la branche telechargee, pas seulement le numero de version.

## Comportement

- Cliquer sur Livre lance le parcours de la page courante a partir de sa position actuelle. Un second clic demande l'arret.
- Defilement par petits pas, avec pauses et controle d'arret.
- Ouverture unique par element des controles reconnus : accordéons, onglets inactifs et contenus a reveler. Les boutons generiques ne sont pas cliques sans critere reconnu.
- Arret lorsqu'une video visible est detectee, sans lancer sa lecture. La detection porte sur les elements HTML video et les conteneurs reconnus ; les lecteurs non reconnus peuvent echapper a cette detection.
- Arret egalement devant un quiz ou un contenu integre visible (iframe, object, embed), par precaution.
- Aucun appel IA, aucun envoi de quiz, aucune ecriture de progression et aucun changement automatique de chapitre.
- L'arrivee en bas de page n'atteste pas que NetAcad a valide la lecture.

## Installation de test

Recuperer tous les fichiers de cette branche dans un dossier distinct. Desactiver l'installation stable avant de charger ce dossier dans Chrome pour eviter deux extensions actives sur la meme page. Recharger toute la page NetAcad. Le panneau Livre indique le lancement puis la raison de l'arret.

## Verification

```bash
node --test tests/reading-walker.test.js
```

Les tests couvrent la selection des commandes et la priorite des conditions d'arret. Ils ne valident pas le DOM reel de NetAcad, les clics reconnus par Angular, les iframes reelles ni la geometrie du defilement. Une validation dans le navigateur reste necessaire : texte seul, accordeons, onglets, video, quiz, conteneur scrollable et arret manuel.
