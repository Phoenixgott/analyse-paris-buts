// Modèle de Dixon et Coles (1997) : buts domicile ~ Poisson(λ), buts extérieur ~ Poisson(μ) avec
//   λ = exp(m + h + attaque[dom] + defense[ext])   μ = exp(m + attaque[ext] + defense[dom])
// (defense > 0 = équipe qui encaisse plus que la moyenne), correction tau des scores faibles et
// pondération des matchs par leur ancienneté : poids = 0,5^(âge en jours / demi-vie).
//
// Estimation en deux temps, transparente et sans dépendance :
//   1. forces, avantage domicile et moyenne par maximum de vraisemblance de Poisson pondéré
//      (mises à jour exactes coordonnée par coordonnée, avec un pseudo-match « moyen » par équipe) ;
//   2. rho par recherche dorée sur la vraisemblance de la correction tau, à forces fixées.
// Puis shrinkage : une équipe avec n < seuil matchs voit ses forces multipliées par n / seuil.
import { bornesRho, tau } from './grille.js';

const JOUR = 86400000;

export function normaliserNom(nom) {
  return String(nom).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function buts(score) {
  const [x, y] = score.split('-').map(Number);
  return { x, y };
}

/** Garde les matchs joués strictement avant dateRef (aucune fuite du futur) et calcule leur poids. */
export function preparerHistorique(historique, dateRef, demiVie) {
  const ref = Date.parse(`${dateRef}T00:00:00Z`);
  return historique
    .filter((m) => m.score && m.date && m.date < dateRef && m.domicile && m.exterieur)
    .map((m) => {
      const age = (ref - Date.parse(`${m.date}T00:00:00Z`)) / JOUR;
      return {
        ...buts(m.score),
        mt: m.score_mt ? buts(m.score_mt) : null,
        dom: normaliserNom(m.domicile),
        ext: normaliserNom(m.exterieur),
        age,
        poids: 0.5 ** (age / demiVie),
      };
    });
}

function rechercheDoree(f, bas, haut, iterations = 80) {
  const g = (Math.sqrt(5) - 1) / 2;
  let a = bas;
  let b = haut;
  let c = b - g * (b - a);
  let d = a + g * (b - a);
  for (let i = 0; i < iterations; i++) {
    if (f(c) > f(d)) b = d;
    else a = c;
    c = b - g * (b - a);
    d = a + g * (b - a);
  }
  return (a + b) / 2;
}

/**
 * Ajuste le modèle sur un historique [{ date, domicile, exterieur, score: "x-y", score_mt }].
 * Renvoie null si aucun match n'est exploitable.
 */
export function ajusterDixonColes(historique, dateRef, r) {
  const matchs = preparerHistorique(historique, dateRef, r.demi_vie_jours);
  if (matchs.length === 0) return null;

  const noms = [...new Set(matchs.flatMap((m) => [m.dom, m.ext]))];
  const idx = new Map(noms.map((n, i) => [n, i]));
  const T = noms.length;
  const nb = new Array(T).fill(0);
  for (const m of matchs) {
    m.i = idx.get(m.dom);
    m.j = idx.get(m.ext);
    nb[m.i]++;
    nb[m.j]++;
  }

  const poidsTotal = matchs.reduce((s, m) => s + m.poids, 0);
  const butsPonderes = matchs.reduce((s, m) => s + m.poids * (m.x + m.y), 0);
  let mu0 = Math.log(Math.max(butsPonderes, 1e-6) / (2 * poidsTotal));
  let h = 0;
  const att = new Array(T).fill(0);
  const def = new Array(T).fill(0);
  const alpha = r.prior_matchs * Math.exp(mu0); // pseudo-match moyen, en buts

  let iterations = 0;
  while (iterations < r.iterations_max) {
    iterations++;
    // La convergence se mesure sur les valeurs recentrées (le recentrage déplace les forces d'une
    // constante à chaque tour, même au point fixe).
    const precedent = [...att, ...def, h, mu0];

    // Attaques
    const sA = new Array(T).fill(0);
    const eA = new Array(T).fill(0);
    for (const m of matchs) {
      sA[m.i] += m.poids * m.x;
      eA[m.i] += m.poids * Math.exp(mu0 + h + def[m.j]);
      sA[m.j] += m.poids * m.y;
      eA[m.j] += m.poids * Math.exp(mu0 + def[m.i]);
    }
    for (let t = 0; t < T; t++) att[t] = Math.log((sA[t] + alpha) / (eA[t] + alpha));

    // Défenses
    const sD = new Array(T).fill(0);
    const eD = new Array(T).fill(0);
    for (const m of matchs) {
      sD[m.j] += m.poids * m.x;
      eD[m.j] += m.poids * Math.exp(mu0 + h + att[m.i]);
      sD[m.i] += m.poids * m.y;
      eD[m.i] += m.poids * Math.exp(mu0 + att[m.j]);
    }
    for (let t = 0; t < T; t++) def[t] = Math.log((sD[t] + alpha) / (eD[t] + alpha));

    // Avantage du terrain
    let sH = 0;
    let eH = 0;
    for (const m of matchs) {
      sH += m.poids * m.x;
      eH += m.poids * Math.exp(mu0 + att[m.i] + def[m.j]);
    }
    h = Math.log(Math.max(sH, 1e-6) / eH);

    // Moyenne, puis recentrage (moyenne des attaques et des défenses = 0)
    let e0 = 0;
    for (const m of matchs) e0 += m.poids * (Math.exp(h + att[m.i] + def[m.j]) + Math.exp(att[m.j] + def[m.i]));
    mu0 = Math.log(Math.max(butsPonderes, 1e-6) / e0);
    const moyA = att.reduce((a, b) => a + b, 0) / T;
    const moyD = def.reduce((a, b) => a + b, 0) / T;
    for (let t = 0; t < T; t++) {
      att[t] -= moyA;
      def[t] -= moyD;
    }
    mu0 += moyA + moyD;

    const actuel = [...att, ...def, h, mu0];
    const ecart = actuel.reduce((max, v, i) => Math.max(max, Math.abs(v - precedent[i])), 0);
    if (ecart < r.tolerance) break;
  }

  // Rho : seuls les scores 0-0, 1-0, 0-1 et 1-1 y contribuent.
  const faibles = matchs
    .filter((m) => m.x <= 1 && m.y <= 1)
    .map((m) => ({ ...m, l: Math.exp(mu0 + h + att[m.i] + def[m.j]), u: Math.exp(mu0 + att[m.j] + def[m.i]) }));
  let [bas, haut] = r.rho_bornes;
  for (const m of faibles) [bas, haut] = bornesRho(m.l, m.u, [bas, haut]);
  const vraisemblanceRho = (rho) => faibles.reduce((s, m) => s + m.poids * Math.log(Math.max(tau(m.x, m.y, m.l, m.u, rho), 1e-12)), 0);
  const rho = faibles.length && haut > bas ? rechercheDoree(vraisemblanceRho, bas + 1e-9, haut - 1e-9) : 0;

  // Part des buts marqués en 1re mi-temps dans cet historique (pondérée).
  const avecMt = matchs.filter((m) => m.mt);
  const butsMt = avecMt.reduce((s, m) => s + m.poids * (m.mt.x + m.mt.y), 0);
  const butsAvecMt = avecMt.reduce((s, m) => s + m.poids * (m.x + m.y), 0);

  const equipes = new Map();
  noms.forEach((nom, t) => {
    const facteur = Math.min(1, nb[t] / r.seuil_shrinkage);
    equipes.set(nom, { attaque: att[t] * facteur, defense: def[t] * facteur, attaque_brute: att[t], defense_brute: def[t], n: nb[t], facteur_shrinkage: facteur });
  });

  return {
    equipes,
    moyenne_log: mu0,
    avantage_domicile_log: h,
    rho,
    n_matchs: matchs.length,
    poids_total: poidsTotal,
    iterations,
    part_mt: avecMt.length ? { valeur: butsAvecMt > 0 ? butsMt / butsAvecMt : null, n_matchs: avecMt.length } : { valeur: null, n_matchs: 0 },
  };
}

/** Buts attendus (λ domicile, μ extérieur) pour un match ; une équipe absente de l'historique vaut la moyenne. */
export function butsAttendus(forces, domicile, exterieur) {
  const vide = { attaque: 0, defense: 0, n: 0, facteur_shrinkage: 0 };
  const d = forces.equipes.get(normaliserNom(domicile)) ?? vide;
  const e = forces.equipes.get(normaliserNom(exterieur)) ?? vide;
  return {
    lambda: Math.exp(forces.moyenne_log + forces.avantage_domicile_log + d.attaque + e.defense),
    mu: Math.exp(forces.moyenne_log + e.attaque + d.defense),
    domicile: d,
    exterieur: e,
  };
}
