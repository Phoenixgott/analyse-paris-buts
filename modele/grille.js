// Grille des scores Dixon-Coles : P(domicile = x, extérieur = y) pour x, y de 0 à buts_max,
// normalisée pour que la somme fasse exactement 100 %.
import { poisson } from './poisson.js';

/** Correction des scores faibles de Dixon et Coles (1997). */
export function tau(x, y, lambda, mu, rho) {
  if (x === 0 && y === 0) return 1 - lambda * mu * rho;
  if (x === 0 && y === 1) return 1 + lambda * rho;
  if (x === 1 && y === 0) return 1 + mu * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

/** Bornes de rho qui gardent tau ≥ 0 pour ces buts attendus. */
export function bornesRho(lambda, mu, [bas, haut] = [-1, 1]) {
  return [Math.max(bas, -1 / Math.max(lambda, 1e-9), -1 / Math.max(mu, 1e-9)), Math.min(haut, 1 / Math.max(lambda * mu, 1e-9), 1)];
}

export function grilleScores(lambda, mu, rho = 0, butsMax = 10) {
  const [bas, haut] = bornesRho(lambda, mu);
  const r = Math.min(Math.max(rho, bas), haut);
  const grille = [];
  let somme = 0;
  for (let x = 0; x <= butsMax; x++) {
    const ligne = [];
    for (let y = 0; y <= butsMax; y++) {
      const p = Math.max(0, tau(x, y, lambda, mu, r)) * poisson(x, lambda) * poisson(y, mu);
      ligne.push(p);
      somme += p;
    }
    grille.push(ligne);
  }
  return grille.map((ligne) => ligne.map((p) => p / somme));
}

export function sommeGrille(grille) {
  return grille.flat().reduce((a, b) => a + b, 0);
}

/** P(total de buts > seuil) (seuil = 0,5 ; 1,5 ; …). */
export function probaOver(grille, seuil) {
  let p = 0;
  grille.forEach((ligne, x) => ligne.forEach((v, y) => {
    if (x + y > seuil) p += v;
  }));
  return p;
}

/** Scores les plus probables, du plus au moins probable. */
export function scoresProbables(grille, n = 5) {
  return grille
    .flatMap((ligne, x) => ligne.map((p, y) => ({ score: `${x}-${y}`, proba: p })))
    .sort((a, b) => b.proba - a.proba)
    .slice(0, n);
}

/** Over/Under 0,5 → 5,5 déduits de la grille ; Under = 1 − Over exactement. */
export function marchesTotal(grille) {
  const r = {};
  for (let k = 0; k <= 5; k++) r[`over_${k}_5`] = probaOver(grille, k + 0.5);
  for (let k = 0; k <= 5; k++) r[`under_${k}_5`] = 1 - r[`over_${k}_5`];
  return r;
}
