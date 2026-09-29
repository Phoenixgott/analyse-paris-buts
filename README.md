# Analyse Paris Buts

Matchs de football du jour, probabilités de buts estimées (Over/Under, 1re mi-temps, buteurs) et
prompt d'analyse IA. **Probabilités estimées, pas des certitudes. Réservé aux 18 ans et plus.**

Site : https://phoenixgott.github.io/analyse-paris-buts/ (installable sur Android : Chrome → menu ⋮ →
« Installer l'application »).

## Le site en bref

Quatre onglets en bas de l'écran (à gauche sur ordinateur) : **Matchs**, **Récupérer**, **Journal**,
**Fiabilité**.

- **Matchs** : une ligne par match (heure, équipes, verdict, buts attendus). Bouton « Paris suggérés »
  pour ne voir que les paris qui passent tous les filtres du modèle ; « Filtrer » pour le pays, la
  compétition, l'heure ou le tri.
- **Fiche d'un match** : en haut, le verdict (PARIER ou PASSER) et trois chiffres (buts attendus,
  Plus de 2,5 buts, qualité des données). Ensuite, choisis ta ligne de buts (0,5 à 5,5, Plus ou Moins) :
  probabilité, cote et value se mettent à jour aussitôt. Le reste est rangé en onglets : Paris, Forme,
  Stats, Infos, Prompt IA.

## Récupérer les vrais matchs (sans clé API)

Onglet **Récupérer** : quatre étapes, le site propose celle qui est utile maintenant.

1. **Liste** : choisis la date et les compétitions, touche « Copier la demande ». Ouvre une
   nouvelle conversation Claude, **active la recherche web**, colle et envoie. Recolle la réponse
   dans la zone « Colle la réponse de Claude », puis « Importer la réponse ».
2. **Fiches** : coche 1 à 3 matchs de la liste, copie la demande, même principe.
3. **Mise à jour** (1 à 2 h avant le match) : demande courte pour les cotes, compositions et absents.
4. **Résultats** : score final à 90 minutes, mi-temps, buteurs. Les paris du journal se résolvent
   alors tout seuls.

Une seule zone de collage pour les quatre étapes : le site reconnaît le type de réponse. Si Claude écrit
« SUITE DISPONIBLE », réponds « continue » et colle aussi la suite. Après chaque import, un rapport dit
ce qui a été ajouté, rapproché (noms d'équipes) ou écarté, et pourquoi (bloc sans source, date
impossible, cotes incohérentes…). Les matchs restent **sur ton téléphone** : pense à
« Sauvegarder (.json) » de temps en temps (Récupérer → Mes données).

## Paris suggérés, journal et alertes

- **Paris suggérés** (onglet Matchs) : les paris qui passent tous les filtres du modèle, avec la mise
  conseillée et le rappel du backtest. Les paris d'un même match sont marqués « lié » : ne les combine pas.
- **Journal de paris** : « Noter » depuis les paris suggérés ou la fiche d'un match (ou saisie libre), résolution
  automatique avec les résultats importés (ou à la main), bankroll, gains, ROI, taux de réussite,
  courbe de bankroll, export CSV. **Limites** : mise maximale par jour et stop-loss journalier ; le site
  demande confirmation avant de les dépasser.
- **Alertes** (Journal → Réglages) : installe l'application **ntfy**, génère un nom de canal secret,
  abonne-toi à ce nom dans ntfy (serveur ntfy.sh). Alertes : nouveaux value bets après un import, limite
  atteinte, paris résolus. Sans clé ; le nom du canal reste sur ton téléphone.

## Fiabilité du modèle

- **Tes prédictions** : chaque probabilité calculée avant le coup d'envoi est archivée sur l'appareil puis
  comparée au score réel (Brier, log-loss, calibration, comparaison au marché). Sous 100 matchs évalués,
  la page affiche « échantillon insuffisant ».
- **Backtest** : `node scripts/backtest/backtest.js` (aussi chaque nuit) prédit semaine après semaine
  plus de 7 000 matchs réels avec les seuls matchs antérieurs. Résultat actuel : le modèle est moins
  précis que le marché et les « values » ne sont pas rentables (détails dans [docs/MODELE.md](docs/MODELE.md)).

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
