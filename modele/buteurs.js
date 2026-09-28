// Buteurs : λ joueur = part des buts attendus de son équipe × buts attendus de l'équipe dans ce match.
//   taux (buts/90) = 75 % buts/90 + 25 % (tirs/90 × conversion de l'équipe)
//   part           = taux × (minutes prévues / 90) × (1 + bonus si tireur de penalty) ÷ buts marqués/match de l'équipe
//   P(marquer)     = 1 − exp(−λ)
// Toute donnée nécessaire absente (minutes, taux, buts de l'équipe) donne une probabilité N/D.
import { normaliserNom } from './dixon-coles.js';

function butsReferenceEquipe(equipe) {
  if (equipe.stats?.buts_marques_moy != null) return equipe.stats.buts_marques_moy;
  const forme = (equipe.forme ?? []).filter((m) => m.score);
  if (forme.length >= 5) return forme.reduce((s, m) => s + Number(m.score.split('-')[0]), 0) / forme.length;
  return null;
}

function estAbsent(nom, equipe) {
  const n = normaliserNom(nom);
  return (equipe.absents ?? []).some((a) => normaliserNom(a.nom) === n);
}

export function probaButeurs(match, butsAttendusMatch, r) {
  if (!match.buteurs?.length) return [];
  const resultats = [];
  for (const cote of ['D', 'E']) {
    const equipe = cote === 'D' ? match.equipes.domicile : match.equipes.exterieur;
    const lambdaEquipe = cote === 'D' ? butsAttendusMatch.lambda : butsAttendusMatch.mu;
    const joueurs = match.buteurs.filter((b) => b.equipe === cote);
    const avecTirs = joueurs.filter((b) => b.buts_par_90 != null && b.tirs_par_90 > 0);
    const conversion = avecTirs.length
      ? avecTirs.reduce((s, b) => s + b.buts_par_90, 0) / avecTirs.reduce((s, b) => s + b.tirs_par_90, 0)
      : null;
    const reference = butsReferenceEquipe(equipe);

    for (const b of joueurs) {
      let taux = null;
      if (b.buts_par_90 != null && b.tirs_par_90 != null && conversion != null) {
        taux = r.poids_buts_vs_tirs * b.buts_par_90 + (1 - r.poids_buts_vs_tirs) * b.tirs_par_90 * conversion;
      } else if (b.buts_par_90 != null) taux = b.buts_par_90;
      else if (b.tirs_par_90 != null && conversion != null) taux = b.tirs_par_90 * conversion;

      const manques = [];
      if (taux == null) manques.push('buts/90 et tirs/90');
      if (b.minutes_prevues == null) manques.push('minutes prévues');
      if (reference == null || reference <= 0) manques.push('buts marqués par match de l’équipe');
      const absent = estAbsent(b.nom, equipe);

      const base = { nom: b.nom, equipe: cote, taux_90: taux, minutes_prevues: b.minutes_prevues, tireur_penalty: b.tireur_penalty };
      if (absent) {
        resultats.push({ ...base, part: null, lambda: null, proba: null, statut: 'absent' });
        continue;
      }
      if (manques.length) {
        resultats.push({ ...base, part: null, lambda: null, proba: null, statut: `N/D : ${manques.join(', ')}` });
        continue;
      }
      const bonus = b.tireur_penalty === true ? r.bonus_penalty : 0;
      const part = Math.min(r.part_max_joueur, (taux * (b.minutes_prevues / 90) * (1 + bonus)) / reference);
      const lambda = part * lambdaEquipe;
      resultats.push({ ...base, part, lambda, proba: 1 - Math.exp(-lambda), statut: 'calculé' });
    }
  }
  return resultats;
}
