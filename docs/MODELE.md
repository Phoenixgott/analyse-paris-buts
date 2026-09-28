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

## Limite connue : demi-vie de 60 jours

Mesuré sur des ligues simulées (forces constantes, 18 équipes, 8 tirages) : erreur moyenne sur les buts
attendus de **16 % après 7 journées et 13 % après 20 journées avec 60 jours**, contre ~10 % avec
120 jours et ~8 % avec 240 jours. Des forces constantes favorisent les longues demi-vies ; dans la
réalité les équipes évoluent. Le backtest de la phase 6 dira quelle demi-vie est la mieux calibrée.
Conséquence directe : avec 60 jours, une partie des « values » détectées sont des erreurs du modèle.
