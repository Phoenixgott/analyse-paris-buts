# Analyse Paris Buts

Matchs de football du jour, probabilités de buts estimées (Over/Under, 1re mi-temps, buteurs) et
prompt d'analyse IA. **Probabilités estimées, pas des certitudes. Réservé aux 18 ans et plus.**

Site : https://phoenixgott.github.io/analyse-paris-buts/ (installable sur Android : Chrome → menu ⋮ →
« Installer l'application »).

## Récupérer les vrais matchs (sans clé API)

Menu **Récupérer les matchs** :

1. **Liste du jour** : choisis la date et les compétitions, touche « Copier la demande ». Ouvre une
   nouvelle conversation Claude, **active la recherche web**, colle et envoie. Recolle la réponse
   dans le site, puis « Importer la réponse ».
2. **Fiches** : coche 1 à 3 matchs de la liste, copie la demande, même principe.
3. **Juste avant le match** : demande courte pour les cotes, compositions et absents.

Si Claude écrit « SUITE DISPONIBLE », réponds « continue » et colle aussi la suite. Après chaque import,
un rapport dit ce qui a été ajouté, rapproché (noms d'équipes) ou écarté, et pourquoi (bloc sans source,
date impossible, cotes incohérentes…). Les matchs restent **sur ton téléphone** : pense à
« Sauvegarder (.json) » de temps en temps.

L'historique des 16 championnats (résultats, scores à la pause) vient de
[football-data.co.uk](https://www.football-data.co.uk/), fichiers publics téléchargés chaque nuit par
une tâche GitHub (`.github/workflows/historiques.yml`), sans clé ni compte.

## Développement

Prérequis : Node.js 20.19 ou plus.

```bash
npm install
npm run dev        # serveur de développement
npm test           # tests Vitest
npm run build      # construit dist/ (site + service worker)
npm run preview    # sert dist/ sur http://localhost:4173/analyse-paris-buts/
npm run icones     # régénère les icônes PWA
npm run demo       # régénère les 6 matchs de démonstration (data/demo/) et leurs calculs
node scripts/historiques/telecharger.js   # met à jour data/ligues/ depuis football-data.co.uk
```

Schéma des données d'un match : [docs/SCHEMA.md](docs/SCHEMA.md). Le modèle expliqué pas à pas :
[docs/MODELE.md](docs/MODELE.md).

## Prompt d'analyse IA

Sur chaque fiche match, « Copier le prompt » met dans le presse-papier le modèle de prompt du cahier
des charges (`src/prompt/modele-prompt.js`) rempli avec le JSON du match et celui des calculs du site ;
« Exporter .json » télécharge le tout (match, calculs, prompt). Le site vérifie avant d'activer les
boutons qu'aucun `{{…}}` ne reste et que les deux JSON sont valides et fidèles aux données.

Le déploiement sur GitHub Pages se fait automatiquement à chaque push sur `main`
(`.github/workflows/deploy.yml`). Dans les réglages du repo : **Settings → Pages → Source :
GitHub Actions**.

Plan complet, règles et risques : [docs/PLAN.md](docs/PLAN.md).

## Jeu responsable

Jouer comporte des risques : endettement, isolement, dépendance. Pour être aidé, appelle le
09 74 75 13 13 (appel non surtaxé) ou va sur [joueurs-info-service.fr](https://www.joueurs-info-service.fr/).
