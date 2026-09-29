# Le modèle, pas à pas

Code : [`modele/`](../modele) (JavaScript pur, sans dépendance). Il tourne **dans le navigateur**
pour les matchs collectés par prompt (10 à 30 ms par match), et dans Node pour la démo.
Réglages : [`modele/reglages.js`](../modele/reglages.js).
Sortie : schéma [`schema/modele.schema.json`](../schema/modele.schema.json) (probabilités de 0 à 1),
mise en cache sur l'appareil. C'est le bloc « CALCULS DU SITE » du prompt IA.

**Probabilités estimées, pas des certitudes.**

## 1. Historique

- Historique de la ligue : `data/ligues/<competition_id>.json`, téléchargé chaque nuit depuis
  football-data.co.uk (saison en cours + précédente),
  `{ equipes_saison, matchs: [{ date, domicile, exterieur, score: "x-y", score_mt, cote_over_2_5, … }] }`.
- Complété par les 10 derniers matchs de chaque équipe (champ `forme` du match), sans doublon : un
  match de la forme est ignoré si l'historique contient déjà un match de cette équipe ce jour-là.
  Sans historique de ligue (sélections, petites ligues), le modèle ne s'appuie que sur la forme.
- **Seuls les matchs joués avant le jour du match comptent** (aucune fuite du futur, testé).
- Poids d'un match = 0,5^(âge en jours / demi-vie). Demi-vie par défaut : 60 jours.

## 2. Dixon-Coles

λ (domicile) = exp(m + h + attaque[dom] + défense[ext]) · μ (extérieur) = exp(m + attaque[ext] + défense[dom]).
`h` = avantage du terrain, estimé **par ligue** (chaque historique est ajusté séparément).

Estimation en deux temps :
1. m, h, attaques et défenses par maximum de vraisemblance de Poisson pondéré, par mises à jour
   exactes coordonnée par coordonnée, avec un pseudo-match « moyen » par équipe (évite une force
   infinie pour une équipe à 0 but) ; moyennes des attaques et des défenses recentrées à 0.
2. ρ (correction des scores 0-0, 1-0, 0-1, 1-1) par recherche dorée dans [−0,2 ; 0,2], à forces fixées.

C'est une approximation classique de l'estimation jointe de Dixon et Coles. Sur une ligue simulée
(20 équipes, 3 saisons), elle retrouve l'avantage du terrain et la moyenne de buts à ±0,05 et les
forces avec une corrélation de 0,93 à 0,98 (tests `tests/modele.test.js`).

**Shrinkage** : une équipe avec n < 8 matchs d'historique voit attaque et défense multipliées par n / 8
(ramenées vers la moyenne de la ligue). Une équipe absente de l'historique vaut la moyenne.

## 3. Ajustements (±10 % cumulés par équipe)

| Règle | Effet sur les buts attendus |
|---|---|
| Repos ≤ 3 jours | −3 % pour l'équipe |
| Derby (mot « derby » dans l'enjeu) | −2 % pour les deux |
| Arbitre ≥ 0,35 penalty/match | +2 % ; ≤ 0,15 : −1 % |
| Pluie ≥ 2 mm/h | −3 % ; vent ≥ 40 km/h : −4 % |
| Absents | −1,5 % par absent (moitié si « incertain »), max −6 % |
| Voyage | non disponible dans les sources : N/D |
| Enjeu | texte libre, non chiffré : « non évalué » |

Heuristiques simples et visibles une par une dans la fiche. Une donnée absente n'ajuste rien.

## 4. Grille, marchés

- Grille 0-10 × 0-10 : τ(x,y) · Poisson(x; λ) · Poisson(y; μ), normalisée à 100 %.
- Over k,5 = somme des cases où x + y > k ; Under = 1 − Over.
- 1re mi-temps : même grille avec λ et μ × part des buts marqués avant la pause (historique de la
  ligue si ≥ 20 matchs avec score à la pause, sinon stats des équipes, sinon leur forme ; sinon N/D).
- Buteur : taux/90 = 75 % buts/90 + 25 % tirs/90 × conversion de l'équipe ; part = taux × minutes
  prévues / 90 × (1,1 si tireur de penalty) ÷ buts marqués par match de l'équipe (max 60 %) ;
  λ = part × buts attendus de l'équipe ; P(marquer) = 1 − exp(−λ). Minutes ou stats absentes : N/D.

## 5. Value, mise, confiance, verdict

- Value = proba × meilleure cote − 1. Mise = ¼ Kelly, plafonnée à 2 % de la bankroll.
- Un pari n'est **suggéré** que si : match fiable (qualité ≥ 40), value ≥ 5 %, value ≤ 30 % (au-delà :
  écart avec le marché trop grand, erreur de modèle probable), probabilité ≥ 20 %, confiance ≥ 50.
- Confiance (0-100) = 40 % qualité des données + 30 % échantillon (historique de l'équipe la moins
  fournie ÷ 15) + 30 % accord modèle/marché (Over 1,5/2,5/3,5, marge retirée ; 0 dès 15 points d'écart).
- Verdict : la meilleure value parmi les paris suggérés, sinon **PASSER** avec la raison.

## Ce que dit le backtest (phase 6, `scripts/backtest/backtest.js`)

Walk-forward hebdomadaire sur l'historique réel football-data.co.uk : chaque semaine, le modèle est
ajusté sur les seuls matchs antérieurs, puis prédit la semaine. **7 029 matchs** (saison 2025/26 et
début 2026/27, 16 championnats), comparés au marché (cotes moyennes Plus/Moins 2,5, marge retirée) :

| Réglages | Brier moyen 1,5/2,5/3,5 | Brier 2,5 (marché : 0,2418) | ROI des values sur 2,5 (cote max) |
|---|---|---|---|
| **60 j, prior 1 (actuels)** | 0,2182 | 0,2563 | −5,8 % (3 490 paris) |
| 240 j, prior 1 | 0,2136 | 0,2509 | −6,2 % |
| 240 j, prior 20 | 0,2102 | 0,2464 | −9,7 % |

- Le modèle est **trop dispersé** (probabilités trop tranchées : écart-type ~13 points contre ~6 pour le
  marché) : quand il annonce 20-30 % sur « +2,5 », c'est arrivé ~44 % du temps ; 70-80 % → ~62 %.
- Une demi-vie plus longue et un prior plus fort améliorent nettement la calibration, **sans atteindre
  le marché**.
- **Aucun réglage testé ne rend les « values » rentables** : ce sont surtout des erreurs du modèle.

Le backtest est relancé chaque nuit par la tâche des historiques ; la page « Fiabilité » l'affiche.
