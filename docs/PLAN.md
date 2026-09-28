# Plan — Analyse Paris Buts

Site statique (GitHub Pages, repo `Phoenixgott/analyse-paris-buts`), PWA installable sur Android,
interface en français, fuseau Europe/Paris. Chaque jour : matchs du jour, probabilités de buts
estimées (Over/Under 0.5 → 5.5, 1re mi-temps, buteurs) et prompt d'analyse IA.

## Règles non négociables

1. Aucune donnée inventée : donnée absente = `null`, affichée « N/D ».
2. Aucune clé API dans le front ni dans le repo : GitHub Secrets uniquement.
3. Données de démonstration toujours marquées « DÉMO » à l'écran.
4. Chaque pourcentage affiché a une info-bulle expliquant son calcul.
5. Jamais de promesse de gain ; pied de page 18+ et lien joueurs-info-service.fr.
6. Qualité des données < 40/100 : match « non fiable », aucun pari suggéré.
7. « PASSER » est un verdict valable et fréquent.

## Choix techniques (figés)

Vite + JavaScript vanilla + Chart.js + vite-plugin-pwa ; pas de framework ni de backend.
Collecte : scripts Node 20 dans `/scripts`, lancés par GitHub Actions. Tests : Vitest.
Déploiement : Actions → Pages à chaque push sur `main`. Données JSON commitées dans
`/data/AAAA-MM-JJ/`, purgées après 30 jours (sauf `/data/predictions`).
Cron : 05:30 UTC (matchs, stats, cotes) et 16:00 UTC (cotes et compos du soir).

## Arborescence cible

```
index.html · vite.config.js · package.json
docs/        PLAN.md · SCHEMA.md · SOURCES.md
public/      favicon.svg · icons/
src/         main.js · router.js · etat.js
  styles/    tokens, base, layout, composants
  pages/     accueil · top-picks · match · journal · fiabilite
  composants/ carte-kpi · tableau-triable · badge · info-bulle · filtres · sidebar · bandeau-demo
  graphiques/ forme · over-under · tranches-15 · radar · jauge
  prompt/    modele.js (texte exact) · generateur.js
  journal/   stockage (IndexedDB) · resolution · export-csv · limites
modele/      JS pur partagé site + scripts : dixon-coles · grille · marches · mi-temps · buteurs ·
             ajustements · value-kelly · confiance
schema/      match.schema.json · valider.js
scripts/     sources/ (api-football, football-data, thesportsdb) · lib/ (quota, cache, http,
             normaliser, competitions) · collecte-matin · collecte-soir · purge ·
             archiver-predictions · backtest · alertes-ntfy · generer-icones
data/        AAAA-MM-JJ/ · quota.json · cache/ · predictions/
tests/       Vitest
.github/workflows/ deploy.yml · collecte.yml
```

## Points de conception

- Le modèle tourne dans les Actions (Node) : prédictions archivées et alertes envoyées côté
  serveur ; le site affiche des calculs déjà faits. Le même code `modele/` sert partout.
- Un push fait avec `GITHUB_TOKEN` ne déclenche pas `deploy.yml` : la collecte l'appelle via
  `workflow_call`.
- Journal de paris stocké dans le navigateur (IndexedDB), résolu contre `resultats.json`.
- `qualite_donnees` est calculée à partir des champs réellement remplis.

## Risques connus

| Risque | Conséquence |
|---|---|
| API-Football gratuit : 100 requêtes/jour ; accès aux saisons en cours à vérifier avec la clé | ≈ 10 matchs complets/jour ; palier 2 réduit à la liste des matchs |
| football-data.org gratuit : 12 compétitions, 10 req/min, ni cotes ni xG | Repli calendrier/résultats seulement |
| TheSportsDB gratuit : données pauvres | Repli calendrier |
| xG, cotes buteur, cote d'ouverture rares en gratuit | Souvent N/D ; « ouverture » = première cote relevée par nous |
| Météo et Elo absents des 3 sources | N/D, sauf accord pour Open-Meteo / ClubElo |
| Stats d'arbitre sans source directe | Calcul depuis l'historique, sinon N/D |
| Pages gratuit exige un repo public | Données JSON publiques (aucune clé dedans) |
| Topic ntfy.sh protégé par son seul secret | Nom long aléatoire, en Secret |
| Crons GitHub en retard de 5 à 30 min | Sans gravité |

## Écarts assumés au cahier des charges

- Champ `demo` (booléen) ajouté au schéma du match : la règle 3 (DÉMO toujours visible) doit
  aussi valoir quand un match est exporté ou copié dans le prompt IA.
- Validation du schéma par un petit validateur maison (`schema/valider.js`) plutôt qu'Ajv, pour
  rester dans les dépendances figées.
- Dixon-Coles a besoin de l'historique de toute la ligue, absent du schéma du match : fichier
  séparé `data/ligues/<competition_id>.json` (à remplir par la collecte en phase 4, non publié).
  Sans lui, repli sur la forme des deux équipes.
- Les calculs du modèle sont un fichier à part (`modeles/<id>.json`, schéma dédié) : le schéma du
  match reste le contrat des données collectées.

## Suivi des phases

- Phase 0 : validée le 28/09/2026 (site en ligne, installé sur Android).
- Phase 1 : validée le 28/09/2026.
- Phase 2 : livrée le 28/09/2026, en attente de validation. Point ouvert : demi-vie de 60 jours
  (voir docs/MODELE.md, « Limite connue »).

## Décisions en attente (avant la phase 4)

- Sources gratuites supplémentaires sans clé (Open-Meteo, ClubElo, football-data.co.uk) : oui/non.
- Plan API-Football : gratuit ou payant.

## Phases

| Phase | Contenu | Validation |
|---|---|---|
| 0 | Plan, repo, Vite, PWA, workflow Pages | Accueil en ligne sur Pages, installable |
| 1 | Design, schéma JSON, 6 matchs DÉMO, Accueil + Fiche match sans calcul | Aucun défilement horizontal à 360 px, ouverture hors ligne |
| 2 | Modèle + tests | Grille = 100 %, Over décroissants, Over + Under = 100 %, tests verts |
| 3 | Graphiques + générateur de prompt (Copier, Exporter .json) | Aucun `{{…}}` restant, JSON valide |
| 4 | Collecte réelle : Ligue 1, puis palier 1, puis palier 2 | Schéma respecté, quota jamais dépassé, manquants à null |
| 5 | Top picks, Journal, alertes ntfy.sh | Résolution auto d'un pari test, alerte reçue |
| 6 | Archivage, backtest, page Fiabilité | Brier sur une journée réelle ; < 100 prédictions : « échantillon insuffisant » |
