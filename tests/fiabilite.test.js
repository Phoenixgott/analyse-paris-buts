import { describe, expect, it } from 'vitest';
import { brier, calibration, logLoss, nombreMatchs, paires, realise, resumeParMarche, SEUIL_ECHANTILLON } from '../modele/fiabilite.js';

describe('Brier et log-loss', () => {
  it('valeurs de référence', () => {
    expect(brier([{ p: 1, r: 1 }, { p: 0, r: 0 }])).toBe(0); // parfait
    expect(brier([{ p: 0.5, r: 1 }, { p: 0.5, r: 0 }])).toBe(0.25); // pile ou face
    expect(brier([{ p: 0.8, r: 1 }, { p: 0.3, r: 0 }])).toBeCloseTo((0.04 + 0.09) / 2, 12);
    expect(logLoss([{ p: 0.5, r: 1 }, { p: 0.5, r: 0 }])).toBeCloseTo(Math.log(2), 12);
    expect(brier([])).toBeNull();
  });

  it('log-loss borne les certitudes (pas d’infini)', () => {
    const l = logLoss([{ p: 1, r: 0 }]);
    expect(Number.isFinite(l)).toBe(true);
    expect(l).toBeCloseTo(-Math.log(0.001), 6);
  });
});

describe('calibration', () => {
  it('range chaque probabilité dans sa tranche et calcule la fréquence observée', () => {
    const c = calibration([{ p: 0.05, r: 0 }, { p: 0.72, r: 1 }, { p: 0.78, r: 0 }, { p: 1, r: 1 }], 10);
    expect(c).toHaveLength(10);
    expect(c[0]).toMatchObject({ n: 1, frequence: 0 });
    expect(c[7]).toMatchObject({ n: 2, frequence: 0.5 });
    expect(c[7].p_moy).toBeCloseTo(0.75, 12);
    expect(c[9]).toMatchObject({ n: 1, frequence: 1 }); // p = 1 dans la dernière tranche
    expect(c[3]).toMatchObject({ n: 0, p_moy: null, frequence: null });
  });
});

describe('évaluation des prédictions archivées', () => {
  it('événement réalisé selon le score (match et 1re MT)', () => {
    expect(realise('over_2_5', '2-1', '1-0')).toBe(1);
    expect(realise('over_2_5', '1-1', '1-0')).toBe(0);
    expect(realise('mt_over_0_5', '2-1', '0-0')).toBe(0);
    expect(realise('mt_over_1_5', '2-1', null)).toBeNull();
    expect(realise('buteur:X', '2-1', '1-0')).toBeNull();
  });

  it('associe prédictions et résultats terminés, par marché', () => {
    const predictions = [
      { match_id: 'a', competition_id: 'fr-l1', probas: { over_2_5: 0.6, mt_over_0_5: 0.7 }, marche: { over_2_5: 0.55 } },
      { match_id: 'b', competition_id: 'fr-l1', probas: { over_2_5: 0.4 }, marche: {} },
      { match_id: 'c', competition_id: 'en-pl', probas: { over_2_5: 0.5 } },
    ];
    const resultats = new Map([
      ['a', { statut: 'termine', score: '2-1', score_mt: '0-0' }],
      ['b', { statut: 'termine', score: '0-0', score_mt: null }],
      ['c', { statut: 'reporte', score: null }],
    ]);
    const liste = paires(predictions, resultats);
    expect(liste).toEqual([
      { marche: 'over_2_5', competition_id: 'fr-l1', p: 0.6, p_marche: 0.55, r: 1, match_id: 'a' },
      { marche: 'mt_over_0_5', competition_id: 'fr-l1', p: 0.7, p_marche: null, r: 0, match_id: 'a' },
      { marche: 'over_2_5', competition_id: 'fr-l1', p: 0.4, p_marche: null, r: 0, match_id: 'b' },
    ]);
    expect(nombreMatchs(liste)).toBe(2);
    const r = resumeParMarche(liste).find((x) => x.marche === 'over_2_5');
    expect(r).toMatchObject({ n: 2, n_marche: 1 });
    expect(r.brier).toBeCloseTo((0.16 + 0.16) / 2, 12);
    expect(r.brier_marche).toBeCloseTo(0.2025, 12);
    expect(SEUIL_ECHANTILLON).toBe(100);
  });
});
