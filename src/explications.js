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
};
