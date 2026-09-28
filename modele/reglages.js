// Réglages du modèle. Ce sont des paramètres de calcul (documentés et modifiables), pas des données :
// aucune valeur ici ne remplace une donnée absente d'un match.
export const REGLAGES = {
  // Dixon-Coles
  demi_vie_jours: 60, // décroissance temporelle : un match de 60 jours pèse 2 fois moins qu'un match d'aujourd'hui
  prior_matchs: 1, // pseudo-match « moyen » ajouté à chaque équipe pour éviter les forces infinies (0 but en 2 matchs)
  seuil_shrinkage: 8, // sous 8 matchs, les forces sont ramenées vers la moyenne de la ligue au prorata (n / 8)
  rho_bornes: [-0.2, 0.2], // correction des scores faibles (0-0, 1-0, 0-1, 1-1)
  buts_max: 10, // grille 0-10 × 0-10
  iterations_max: 500,
  tolerance: 1e-8,

  // 1re mi-temps
  mt_min_matchs: 20, // matchs avec score à la pause nécessaires pour utiliser la part de buts en MT de la ligue

  // Buteurs
  poids_buts_vs_tirs: 0.75, // taux de buts du joueur = 75 % buts/90 + 25 % (tirs/90 × conversion de l'équipe)
  bonus_penalty: 0.1, // +10 % pour le tireur de penalty
  part_max_joueur: 0.6, // un joueur ne peut pas porter plus de 60 % des buts attendus de son équipe

  // Ajustements (en fraction des buts attendus), plafonnés à ±10 % cumulés par équipe
  plafond_ajustements: 0.1,
  ajustements: {
    repos_jours_max: 3, // 3 jours de repos ou moins : fatigue
    repos_effet: -0.03,
    derby_effet: -0.02,
    arbitre_penaltys_haut: 0.35,
    arbitre_penaltys_bas: 0.15,
    arbitre_effet_haut: 0.02,
    arbitre_effet_bas: -0.01,
    pluie_mm_h: 2,
    pluie_effet: -0.03,
    vent_km_h: 40,
    vent_effet: -0.04,
    absent_effet: -0.015, // par absent (moitié si « incertain »)
    absents_effet_max: -0.06,
  },

  // Value et mises
  seuil_value: 0.05, // value = proba × cote − 1 ; pari envisagé à partir de +5 %
  value_suspecte: 0.3, // au-delà de +30 %, l'écart avec le marché est plus probablement une erreur du modèle
  proba_min: 0.2, // pas de pari sur un événement estimé à moins de 20 %
  fraction_kelly: 0.25,
  mise_max: 0.02, // 2 % de la bankroll au maximum

  // Indice de confiance
  confiance_min: 50,
  confiance_poids: { qualite: 0.4, echantillon: 0.3, accord: 0.3 },
  echantillon_plein: 15, // matchs d'historique par équipe pour un échantillon jugé complet
  accord_ecart_max: 0.15, // écart modèle/marché (Over 1.5/2.5/3.5) à partir duquel l'accord vaut 0
};

export function reglages(surcharges = {}) {
  return {
    ...REGLAGES,
    ...surcharges,
    ajustements: { ...REGLAGES.ajustements, ...(surcharges.ajustements ?? {}) },
    confiance_poids: { ...REGLAGES.confiance_poids, ...(surcharges.confiance_poids ?? {}) },
  };
}
