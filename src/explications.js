// Textes des info-bulles : chaque pourcentage ou indicateur affiché explique son calcul.
import { POIDS_EQUIPE, POIDS_MATCH, SEUIL_FIABLE } from '../schema/qualite.js';

export const EXPLICATIONS = {
  qualite_donnees:
    `Score de complétude des données, sur 100. Pour chaque équipe (moyenne des deux, ${Object.values(POIDS_EQUIPE).reduce((a, b) => a + b)} pts) : ` +
    `classement ${POIDS_EQUIPE.classement}, forme ${POIDS_EQUIPE.forme}, statistiques ${POIDS_EQUIPE.stats}, Elo ${POIDS_EQUIPE.elo}, ` +
    `jours de repos ${POIDS_EQUIPE.jours_repos}, absents ${POIDS_EQUIPE.absents}, compo ${POIDS_EQUIPE.compo_probable}. ` +
    `Pour le match : confrontations ${POIDS_MATCH.h2h}, cotes ${POIDS_MATCH.cotes}, buteurs ${POIDS_MATCH.buteurs}, arbitre ${POIDS_MATCH.arbitre}, ` +
    `météo ${POIDS_MATCH.meteo}, stade et enjeu ${POIDS_MATCH.stade_enjeu}. Chaque rubrique rapporte ses points au prorata des champs réellement remplis. ` +
    `Sous ${SEUIL_FIABLE}/100 : match non fiable, aucun pari suggéré.`,
  pct_over15:
    'Part des matchs de l’équipe cette saison terminés avec 2 buts ou plus (les deux équipes confondues). Calcul : matchs à 2 buts ou plus ÷ matchs joués × 100.',
  pct_over25:
    'Part des matchs de l’équipe cette saison terminés avec 3 buts ou plus (les deux équipes confondues). Calcul : matchs à 3 buts ou plus ÷ matchs joués × 100.',
  pct_over35:
    'Part des matchs de l’équipe cette saison terminés avec 4 buts ou plus (les deux équipes confondues). Calcul : matchs à 4 buts ou plus ÷ matchs joués × 100.',
  pct_but_avant_30:
    'Part des matchs de l’équipe cette saison où elle a marqué au moins un but avant la 30e minute. Calcul : matchs concernés ÷ matchs joués × 100.',
  buts_marques_moy: 'Buts marqués par match cette saison : total des buts marqués ÷ matchs joués.',
  buts_encaisses_moy: 'Buts encaissés par match cette saison : total des buts encaissés ÷ matchs joués.',
  buts_mt_marques_moy: 'Buts marqués en 1re mi-temps par match : total des buts marqués avant la pause ÷ matchs joués.',
  buts_mt_encaisses_moy: 'Buts encaissés en 1re mi-temps par match : total des buts encaissés avant la pause ÷ matchs joués.',
  xg_moy: 'Buts attendus (xG) par match fournis par la source : qualité des occasions créées. N/D si la source ne les donne pas.',
  tirs_cadres_moy: 'Tirs cadrés par match cette saison : total des tirs cadrés ÷ matchs joués.',
  elo: 'Classement Elo : note de force de l’équipe (plus elle est haute, plus l’équipe est forte). N/D si aucune source ne le fournit.',
  jours_repos: 'Jours écoulés depuis le dernier match officiel de l’équipe.',
  mouvement: 'Mouvement de cote : meilleure cote actuelle − première cote relevée (« ouverture »). ↑ la cote monte, ↓ elle baisse.',

  // Modèle (phase 2)
  buts_attendus:
    'Buts attendus du modèle Dixon-Coles : exp(moyenne de la ligue + avantage du terrain + attaque de l’équipe + défense adverse), estimés sur l’historique pondéré par l’ancienneté (demi-vie réglable), puis ajustés (±10 % maximum).',
  proba_total:
    'Probabilité estimée par le modèle : somme des cases de la grille des scores 0-10 × 0-10 (normalisée à 100 %) où le total de buts dépasse la ligne. « Moins de » = 100 % − « Plus de ».',
  proba_mt:
    'Même grille que pour le match, avec des buts attendus réduits à la part des buts marqués avant la pause (part de la ligue si l’historique suffit, sinon des stats ou de la forme des équipes).',
  proba_buteur:
    'P(marquer) = 1 − exp(−λ). λ = part du joueur dans les buts de son équipe (75 % buts/90 + 25 % tirs/90 × conversion, × minutes prévues / 90, +10 % s’il tire les penaltys, ÷ buts marqués par match de l’équipe) × buts attendus de l’équipe dans ce match.',
  value: 'Value = probabilité du modèle × meilleure cote − 1. Positive : la cote paie plus que le risque estimé. Un pari n’est envisagé qu’à partir du seuil (5 % par défaut).',
  mise: 'Mise conseillée en % de ta bankroll : ¼ du critère de Kelly, (p × cote − 1) ÷ (cote − 1), plafonné à 2 %. 0 % si le pari ne passe pas tous les filtres.',
  confiance:
    'Indice de confiance (0-100) : 40 % qualité des données + 30 % taille de l’échantillon (historique de l’équipe la moins fournie ÷ 15 matchs) + 30 % accord modèle/marché (écart moyen sur Over 1,5/2,5/3,5, 0 dès 15 points d’écart). Sans cotes, les poids restants sont renormalisés. Sous 50 : aucun pari suggéré.',
  scores_probables: 'Probabilité de chaque score exact, lue dans la grille du modèle (cases les plus probables).',
  cote_min: 'Cote minimale acceptable = (1 + seuil de value) ÷ probabilité du modèle. En dessous, le pari n’a plus assez de value.',
  part_mt: 'Part des buts marqués avant la pause, utilisée pour réduire les buts attendus en 1re mi-temps.',
};
