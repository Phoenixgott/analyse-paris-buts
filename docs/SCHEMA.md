# Schéma JSON d'un match (v1.1.0)

v1.1.0 (phase 3) : ajout de `stats.buts_par_tranche` (graphique « buts par tranche de 15 min »).

Contrat unique entre la collecte, le modèle, les graphiques et le prompt IA.
Définition formelle : [`schema/match.schema.json`](../schema/match.schema.json), vérifiée par
`schema/valider.js` (tests et collecte).

## Règles

- **Toutes les clés sont obligatoires.** Une donnée absente s'écrit `null` (affichée « N/D »), elle
  n'est jamais omise ni devinée. Une clé inconnue est refusée.
- `null` ≠ liste vide : `absents: null` = inconnu ; `absents: []` = la source ne signale aucun absent.
- Heures en UTC (`coup_envoi`, `generated_at`, suffixe `Z`) ; l'affichage se fait en Europe/Paris.
- Dates simples au format `AAAA-MM-JJ`. Scores au format `"2-1"`.
- Pourcentages stockés de 0 à 100 (pas de 0 à 1).

## Champs

| Champ | Type | Remarque |
|---|---|---|
| `schema_version` | `"1.0.0"` | |
| `demo` | booléen | **Ajout au cahier des charges** : `true` = données fictives, toujours marquées DÉMO à l'écran et dans le prompt |
| `match_id` | texte | minuscules, chiffres, tirets |
| `generated_at` | date-heure UTC | |
| `competition` | `{ id, nom, pays, categorie, palier }` | `categorie` : `H`, `F` ou `INT` ; `palier` : 1 ou 2 |
| `coup_envoi` | date-heure UTC | |
| `stade` | `{ nom, ville }` ou null | |
| `enjeu` | texte ou null | |
| `equipes.domicile` / `equipes.exterieur` | équipe | voir ci-dessous |
| `h2h[≤10]` | `{ date, score, score_mt }` | le plus récent d'abord ; score **du point de vue domicile - extérieur du match analysé** |
| `arbitre` | `{ nom, cartons_moy, penaltys_moy }` ou null | |
| `meteo` | `{ temperature (°C), vent (km/h), pluie (mm/h) }` ou null | |
| `buteurs[]` | `{ nom, equipe (D/E), buts_par_90, tirs_par_90, tireur_penalty, coups_de_pied_arretes, minutes_prevues }` | |
| `cotes` | `{ total_buts{over_0_5…over_5_5, under_0_5…under_5_5}, mt_over_0_5, mt_over_1_5, buteur[{nom, equipe, cote}] }` ou null | |
| cote | `{ meilleure, bookmaker, ouverture, mouvement }` ou null | `ouverture` = première cote relevée par la collecte ; `mouvement` = meilleure − ouverture |
| `qualite_donnees` | entier 0-100 | calculé par `schema/qualite.js` ; sous 40 : match non fiable |
| `sources[]` | `{ nom, recupere_le }` | |

### Équipe

| Champ | Type | Remarque |
|---|---|---|
| `id`, `nom`, `elo` | | |
| `classement` | `{ rang, points, joues, bp, bc }` ou null | |
| `forme[≤10]` | `{ date, adversaire, lieu (D/E), score, score_mt }` | le plus récent d'abord ; score **du point de vue de l'équipe** (pour - contre) |
| `stats` | `{ buts_marques_moy, buts_encaisses_moy, buts_mt_marques_moy, buts_mt_encaisses_moy, xg_moy, tirs_cadres_moy, pct_over15, pct_over25, pct_over35, pct_but_avant_30, buts_par_tranche }` ou null | moyennes par match sur la saison ; `pct_over25` = part des matchs à 3 buts ou plus (les deux équipes) |
| `stats.buts_par_tranche` | `{ matchs, marques[6], encaisses[6] }` ou null | buts de la saison par tranche 0-15, 16-30, 31-45, 46-60, 61-75, 76-90 (temps additionnel dans la tranche précédente) ; fourni par les stats d'équipe d'API-Football |
| `jours_repos` | entier ou null | |
| `absents[]` | `{ nom, raison }` ou null | |
| `compo_probable[]` | liste de noms ou null | |

## Qualité des données (0-100)

Par équipe (moyenne des deux, 55 pts) : classement 10, forme 15, statistiques 20, Elo 3, repos 2,
absents 3, compo 2. Match (45 pts) : confrontations 5, cotes 20, buteurs 10, arbitre 4, météo 3,
stade et enjeu 3. Chaque rubrique rapporte ses points au prorata des champs réellement remplis.

## Où sont les données

- **Matchs collectés par prompt** : sur l'appareil (IndexedDB « analyse-paris-buts », magasins
  `annonces`, `matchs`, `modeles`), jamais publiés. Chaque fiche est validée contre ce schéma à l'import
  et à la restauration d'une sauvegarde. `match_id` = `AAAA-MM-JJ-domicile-exterieur` (jour de Paris).
- **Publiés sur le site** :

```
data/index.json                      { jours: [], demo: "demo" }
data/ligues/<competition_id>.json    historique football-data.co.uk, lu par le modèle dans le navigateur
data/demo/…                          6 matchs fictifs et leurs calculs (npm run demo) ; ligues fictives non publiées
```

L'accueil affiche aujourd'hui (Europe/Paris) si des matchs ont été importés, sinon la démo avec un
bandeau DÉMO ; un menu permet de choisir un autre jour importé.
