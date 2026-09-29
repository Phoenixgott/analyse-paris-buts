// Archive des prédictions : instantané des probabilités calculées AVANT le coup d'envoi, pour mesurer
// ensuite la fiabilité du modèle contre les résultats réels (et contre le marché).
import { probaMarche } from './confiance.js';

/** Instantané à archiver, ou null si le calcul est postérieur au coup d'envoi ou impossible. */
export function instantanePrediction(match, modele) {
  if (!modele?.calculable || !(modele.calcule_le < match.coup_envoi)) return null;
  const probas = { ...modele.total_buts };
  for (const k of Object.keys(probas)) if (k.startsWith('under')) delete probas[k];
  if (modele.mi_temps) {
    probas.mt_over_0_5 = modele.mi_temps.over_0_5;
    probas.mt_over_1_5 = modele.mi_temps.over_1_5;
  }
  const tb = match.cotes?.total_buts;
  const marche = {};
  for (let k = 0; k <= 5; k++) {
    const p = probaMarche(tb?.[`over_${k}_5`]?.meilleure, tb?.[`under_${k}_5`]?.meilleure);
    if (p != null) marche[`over_${k}_5`] = Math.round(p * 10000) / 10000;
  }
  return {
    match_id: match.match_id,
    competition_id: match.competition.id,
    competition: match.competition.nom,
    libelle: `${match.equipes.domicile.nom} – ${match.equipes.exterieur.nom}`,
    coup_envoi: match.coup_envoi,
    calcule_le: modele.calcule_le,
    demi_vie: modele.reglages.demi_vie_jours,
    qualite: match.qualite_donnees,
    confiance: modele.confiance.indice,
    probas,
    marche,
  };
}
