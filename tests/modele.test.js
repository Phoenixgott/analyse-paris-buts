import { describe, expect, it } from 'vitest';
import { poisson } from '../modele/poisson.js';
import { grilleScores, marchesTotal, probaOver, sommeGrille, tau } from '../modele/grille.js';
import { ajusterDixonColes, butsAttendus, normaliserNom } from '../modele/dixon-coles.js';
import { reglages } from '../modele/reglages.js';
import { correlation, simulerLigue } from './simulation.js';

const R = reglages();
const LAMBDAS = [0.05, 0.3, 0.8, 1.3, 2, 3, 4.5, 6];
const RHOS = [-0.2, -0.1, 0, 0.1, 0.2];

describe('loi de Poisson', () => {
  it('somme à 1 et vaut e^-λ en 0', () => {
    for (const l of LAMBDAS) {
      const s = Array.from({ length: 60 }, (_, k) => poisson(k, l)).reduce((a, b) => a + b);
      expect(s).toBeCloseTo(1, 12);
      expect(poisson(0, l)).toBeCloseTo(Math.exp(-l), 14);
    }
  });
});

describe('grille des scores 0-10 × 0-10', () => {
  it('somme exactement à 100 % pour toutes les combinaisons testées', () => {
    for (const l of LAMBDAS) for (const m of LAMBDAS) for (const rho of RHOS) {
      const g = grilleScores(l, m, rho, 10);
      expect(g).toHaveLength(11);
      expect(g.every((ligne) => ligne.length === 11)).toBe(true);
      expect(Math.abs(sommeGrille(g) - 1)).toBeLessThan(1e-12);
      expect(g.flat().every((p) => p >= 0)).toBe(true);
    }
  });

  it('P(Over 0,5) ≥ P(Over 1,5) ≥ … ≥ P(Over 5,5)', () => {
    for (const l of LAMBDAS) for (const m of LAMBDAS) for (const rho of RHOS) {
      const t = marchesTotal(grilleScores(l, m, rho, 10));
      for (let k = 0; k < 5; k++) expect(t[`over_${k}_5`]).toBeGreaterThanOrEqual(t[`over_${k + 1}_5`]);
    }
  });

  it('Over + Under = 100 % sur chaque ligne', () => {
    for (const l of LAMBDAS) for (const rho of RHOS) {
      const t = marchesTotal(grilleScores(l, l * 0.8, rho, 10));
      for (let k = 0; k <= 5; k++) expect(t[`over_${k}_5`] + t[`under_${k}_5`]).toBe(1);
    }
  });

  it('sans correction (rho = 0), vaut le produit de deux lois de Poisson', () => {
    const g = grilleScores(1.4, 1.1, 0, 10);
    const norme = [...Array(11).keys()].reduce((s, x) => s + poisson(x, 1.4), 0) * [...Array(11).keys()].reduce((s, y) => s + poisson(y, 1.1), 0);
    expect(g[2][1]).toBeCloseTo((poisson(2, 1.4) * poisson(1, 1.1)) / norme, 12);
    expect(tau(3, 2, 1.4, 1.1, 0.15)).toBe(1);
  });

  it('rho < 0 augmente 0-0 et 1-1, diminue 1-0 et 0-1', () => {
    const neutre = grilleScores(1.3, 1.1, 0);
    const corrigee = grilleScores(1.3, 1.1, -0.15);
    expect(corrigee[0][0]).toBeGreaterThan(neutre[0][0]);
    expect(corrigee[1][1]).toBeGreaterThan(neutre[1][1]);
    expect(corrigee[1][0]).toBeLessThan(neutre[1][0]);
    expect(corrigee[0][1]).toBeLessThan(neutre[0][1]);
  });

  it('P(Over 0,5) = 1 − P(0-0)', () => {
    const g = grilleScores(1.2, 0.9, -0.1);
    expect(probaOver(g, 0.5)).toBeCloseTo(1 - g[0][0], 14);
  });
});

describe('estimation Dixon-Coles', () => {
  const sim = simulerLigue({ graine: 7, equipes: 20, saisons: 3 });
  const lointain = reglages({ demi_vie_jours: 1e6 }); // sans décroissance, pour comparer aux vrais paramètres
  const f = ajusterDixonColes(sim.matchs, sim.derniereDate, lointain);

  it('converge avant le nombre maximal d’itérations', () => {
    expect(f.iterations).toBeLessThan(lointain.iterations_max);
    expect(ajusterDixonColes(sim.matchs, sim.derniereDate, R).iterations).toBeLessThan(R.iterations_max);
  });

  it('retrouve l’avantage du terrain, la moyenne de buts et rho sur une ligue simulée', () => {
    expect(f.n_matchs).toBe(1140);
    expect(Math.abs(f.avantage_domicile_log - sim.vrais.h)).toBeLessThan(0.08);
    expect(Math.abs(f.moyenne_log - sim.vrais.m)).toBeLessThan(0.08);
    expect(Math.abs(f.rho - sim.vrais.rho)).toBeLessThan(0.1);
  });

  it('retrouve les forces d’attaque et de défense (corrélation > 0,9)', () => {
    const noms = sim.vrais.noms.map(normaliserNom);
    expect(correlation(sim.vrais.att, noms.map((n) => f.equipes.get(n).attaque))).toBeGreaterThan(0.9);
    expect(correlation(sim.vrais.def, noms.map((n) => f.equipes.get(n).defense))).toBeGreaterThan(0.9);
  });

  it('ignore les matchs joués le jour du match ou après (aucune fuite du futur)', () => {
    const coupure = sim.matchs[700].date;
    const avant = ajusterDixonColes(sim.matchs.filter((m) => m.date < coupure), coupure, R);
    const tout = ajusterDixonColes(sim.matchs, coupure, R);
    expect(tout.n_matchs).toBe(avant.n_matchs);
    expect(tout.moyenne_log).toBe(avant.moyenne_log);
    expect(tout.rho).toBe(avant.rho);
  });

  it('donne plus de poids aux matchs récents (demi-vie de 240 jours)', () => {
    // L'équipe 01 devient bien plus offensive pour la dernière saison.
    const bascule = '2025-07-01';
    const s = simulerLigue({ graine: 11, attaqueDe: (t, date, a) => (t === 0 && date >= bascule ? a + 0.6 : a) });
    const recente = ajusterDixonColes(s.matchs, s.derniereDate, R).equipes.get(normaliserNom('Équipe 01')).attaque;
    const plate = ajusterDixonColes(s.matchs, s.derniereDate, lointain).equipes.get(normaliserNom('Équipe 01')).attaque;
    const vraieRecente = s.vrais.att[0] + 0.6;
    expect(Math.abs(recente - vraieRecente)).toBeLessThan(Math.abs(plate - vraieRecente));
  });

  it('ramène vers la moyenne une équipe qui a moins de 8 matchs (facteur n / 8)', () => {
    const nouveaux = [
      { date: '2026-05-01', domicile: 'Promu', exterieur: 'Équipe 01', score: '4-0', score_mt: null },
      { date: '2026-05-08', domicile: 'Équipe 02', exterieur: 'Promu', score: '0-3', score_mt: null },
      { date: '2026-05-15', domicile: 'Promu', exterieur: 'Équipe 03', score: '3-1', score_mt: null },
    ];
    const g = ajusterDixonColes([...sim.matchs, ...nouveaux], '2026-06-01', R);
    const promu = g.equipes.get('promu');
    expect(promu.n).toBe(3);
    expect(promu.facteur_shrinkage).toBeCloseTo(3 / 8, 12);
    expect(promu.attaque).toBeCloseTo(promu.attaque_brute * (3 / 8), 12);
    const installe = g.equipes.get(normaliserNom('Équipe 05'));
    expect(installe.facteur_shrinkage).toBe(1);
    expect(installe.attaque).toBe(installe.attaque_brute);
  });

  it('donne la moyenne de la ligue à une équipe inconnue et reste fini avec 0 but marqué', () => {
    const g = ajusterDixonColes([{ date: '2026-01-01', domicile: 'A', exterieur: 'B', score: '0-0', score_mt: null }], '2026-02-01', R);
    const b = butsAttendus(g, 'Inconnue', 'A');
    expect(Number.isFinite(b.lambda) && Number.isFinite(b.mu)).toBe(true);
    expect(b.domicile.n).toBe(0);
  });

  it('renvoie null sans aucun match exploitable', () => {
    expect(ajusterDixonColes([], '2026-01-01', R)).toBeNull();
    expect(ajusterDixonColes([{ date: '2026-03-01', domicile: 'A', exterieur: 'B', score: '1-0' }], '2026-01-01', R)).toBeNull();
  });
});
