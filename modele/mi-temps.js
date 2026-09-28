// 1re mi-temps : même grille Dixon-Coles avec des buts attendus réduits à la part de buts marqués
// avant la pause. Cette part vient, par ordre de préférence : de l'historique de la ligue, des stats
// des deux équipes, de leurs 10 derniers matchs. Sans aucune de ces sources : N/D (null).
import { grilleScores, probaOver } from './grille.js';

function somme(valeurs) {
  return valeurs.reduce((a, b) => a + b, 0);
}

export function partButsMt(forces, match, r) {
  if (forces?.part_mt?.valeur != null && forces.part_mt.n_matchs >= r.mt_min_matchs) {
    return { valeur: forces.part_mt.valeur, source: 'historique', n_matchs: forces.part_mt.n_matchs };
  }

  const stats = [match.equipes.domicile.stats, match.equipes.exterieur.stats];
  const cles = ['buts_mt_marques_moy', 'buts_mt_encaisses_moy', 'buts_marques_moy', 'buts_encaisses_moy'];
  if (stats.every((s) => s && cles.every((c) => s[c] != null))) {
    const mt = somme(stats.map((s) => s.buts_mt_marques_moy + s.buts_mt_encaisses_moy));
    const tout = somme(stats.map((s) => s.buts_marques_moy + s.buts_encaisses_moy));
    if (tout > 0) return { valeur: mt / tout, source: 'stats des équipes', n_matchs: null };
  }

  const forme = [match.equipes.domicile.forme, match.equipes.exterieur.forme].flatMap((f) => f ?? []).filter((m) => m.score && m.score_mt);
  if (forme.length >= 6) {
    const total = (s) => s.split('-').map(Number).reduce((a, b) => a + b, 0);
    const tout = somme(forme.map((m) => total(m.score)));
    if (tout > 0) return { valeur: somme(forme.map((m) => total(m.score_mt))) / tout, source: 'forme des équipes', n_matchs: forme.length };
  }
  return null;
}

export function marchesMiTemps(lambda, mu, rho, part, butsMax) {
  const grille = grilleScores(lambda * part, mu * part, rho, butsMax);
  const over05 = probaOver(grille, 0.5);
  const over15 = probaOver(grille, 1.5);
  return {
    buts_attendus: { domicile: lambda * part, exterieur: mu * part },
    over_0_5: over05,
    under_0_5: 1 - over05,
    over_1_5: over15,
    under_1_5: 1 - over15,
  };
}
