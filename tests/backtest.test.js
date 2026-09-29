import { describe, expect, it } from 'vitest';
import { configurations, lundi, mesurer, predireLigue, simulerValue } from '../scripts/backtest/backtest.js';
import { instantanePrediction } from '../modele/archive.js';
import { simulerLigue } from './simulation.js';
import { lireJSON, matchsDemo } from './aides.js';

describe('backtest walk-forward', () => {
  const sim = simulerLigue({ graine: 3, equipes: 12, saisons: 2 });
  const debut = sim.matchs[140].date;

  it('lundi de la semaine', () => {
    expect(lundi('2026-09-29')).toBe('2026-09-28'); // mardi → lundi
    expect(lundi('2026-09-28')).toBe('2026-09-28');
    expect(lundi('2026-10-04')).toBe('2026-09-28'); // dimanche → lundi précédent
  });

  it('ne prédit que les matchs à partir du début d’évaluation, avec des probabilités cohérentes', () => {
    const pr = predireLigue(sim.matchs, { debutEvaluation: debut, demiVie: 120 });
    expect(pr.length).toBe(sim.matchs.filter((m) => m.date >= debut).length);
    for (const p of pr) {
      expect(p.probas.over_0_5).toBeGreaterThanOrEqual(p.probas.over_5_5);
      expect(p.probas.over_2_5).toBeGreaterThan(0);
      expect(p.probas.over_2_5).toBeLessThan(1);
    }
  });

  it('aucune fuite du futur : changer le score d’un match ne change ni sa prédiction ni celles d’avant', () => {
    const base = predireLigue(sim.matchs, { debutEvaluation: debut, demiVie: 120 });
    const cible = base[40];
    const modifies = sim.matchs.map((m) => (m.date === cible.date && m.domicile === cible.domicile ? { ...m, score: '9-9' } : m));
    const apres = predireLigue(modifies, { debutEvaluation: debut, demiVie: 120 });
    const idx = apres.findIndex((p) => p.date === cible.date && p.domicile === cible.domicile);
    expect(apres[idx].probas).toEqual(cible.probas);
    for (const [i, p] of base.entries()) if (p.date <= cible.date) expect(apres[i].probas).toEqual(p.probas);
  });

  it('mesures et simulation des règles de value', () => {
    const pr = predireLigue(sim.matchs, { debutEvaluation: debut, demiVie: 120 });
    const m = mesurer(pr);
    expect(m.n).toBe(pr.length);
    expect(m.brier.over_2_5).toBeGreaterThan(0);
    expect(m.brier.over_2_5).toBeLessThan(0.3);
    // Cote « juste » ×1,2 sur Plus 2,5 : value de +20 % partout où p ≥ 20 %.
    const v = simulerValue(pr.map((p) => ({ ...p, cote_max_over: 1.2 / p.probas.over_2_5, cote_max_under: null })));
    expect(v.paris).toBe(pr.filter((p) => p.probas.over_2_5 >= 0.2).length);
  });

  it('compare les réglages actuels à des variantes plus prudentes', () => {
    const c = configurations();
    expect(c.filter((x) => x.actuelle)).toEqual([{ demi_vie: 60, prior: 1, actuelle: true }]);
    expect(c.length).toBeGreaterThan(3);
  });

  it('le résumé publié est cohérent', () => {
    const bt = lireJSON('data/backtest/resume.json');
    const actuelle = bt.configurations.find((x) => x.actuelle);
    expect(actuelle.n).toBeGreaterThan(5000);
    expect(bt.par_ligue.reduce((s, l) => s + l.n, 0)).toBe(actuelle.n);
    expect(bt.calibration.actuelle.over_2_5).toHaveLength(10);
    expect(actuelle.marche.brier_marche).toBeGreaterThan(0);
  });
});

describe('archive des prédictions', () => {
  const match = matchsDemo().find((m) => m.match_id === 'demo-l1-valmont-rivebelle');
  const modele = lireJSON('data/demo/modeles/demo-l1-valmont-rivebelle.json');

  it('archive une prédiction faite avant le coup d’envoi, avec les probabilités du marché', () => {
    const a = instantanePrediction(match, modele); // calculée à 05:30Z, match à 18:45Z
    expect(a).toMatchObject({ match_id: match.match_id, competition_id: 'demo-fr-l1', demi_vie: 60 });
    expect(a.probas.over_2_5).toBe(modele.total_buts.over_2_5);
    expect(a.probas.under_2_5).toBeUndefined();
    expect(a.probas.mt_over_0_5).toBe(modele.mi_temps.over_0_5);
    expect(a.marche.over_2_5).toBeGreaterThan(0.3);
  });

  it('refuse une prédiction calculée après le coup d’envoi ou non calculable', () => {
    expect(instantanePrediction(match, { ...modele, calcule_le: '2026-09-28T19:00:00Z' })).toBeNull();
    expect(instantanePrediction(match, { ...modele, calculable: false })).toBeNull();
  });
});
