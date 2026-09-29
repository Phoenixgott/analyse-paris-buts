// Top picks : les paris qui passent tous les filtres du modèle (value ≥ seuil, confiance, fiabilité…),
// regroupés par marché. Deux paris du même match sont signalés comme liés (corrélés).
import { heure } from '../format.js';

export const GROUPES_PICKS = [
  ['total', 'Total de buts'],
  ['mi_temps', '1re mi-temps'],
  ['buteur', 'Buteurs'],
];

/** entrees : [{ resume, modele, dossier }] → picks triés par value décroissante. */
export function extrairePicks(entrees) {
  const picks = [];
  for (const { resume, modele, dossier } of entrees) {
    if (!modele?.calculable) continue;
    for (const m of modele.marches) {
      if (!m.suggere) continue;
      picks.push({
        cle: `${resume.match_id}|${m.marche}`,
        match_id: resume.match_id,
        dossier,
        demo: resume.demo,
        libelle_match: `${resume.domicile} – ${resume.exterieur}`,
        competition: resume.competition.nom,
        coup_envoi: resume.coup_envoi,
        heure: heure(resume.coup_envoi),
        groupe: m.groupe,
        marche: m.marche,
        libelle: m.libelle,
        proba: m.proba,
        cote: m.cote,
        bookmaker: m.bookmaker,
        cote_min: m.cote_min,
        value: m.value,
        mise_pct: m.mise_pct,
        confiance: modele.confiance.indice,
      });
    }
  }
  picks.sort((a, b) => b.value - a.value);
  // Paris liés : plusieurs picks sur le même match.
  const parMatch = new Map();
  for (const p of picks) parMatch.set(p.match_id, (parMatch.get(p.match_id) ?? 0) + 1);
  for (const p of picks) p.lies = parMatch.get(p.match_id) - 1;
  return picks;
}

export function grouperPicks(picks) {
  return GROUPES_PICKS.map(([groupe, titre]) => ({ groupe, titre, picks: picks.filter((p) => p.groupe === groupe) }));
}
