import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { analyserMatch, fusionnerHistorique, historiqueDepuisForme } from '../modele/analyser.js';
import { valider } from '../schema/valider.js';
import { chargerHistoriqueLigue } from '../scripts/lib/modeles-jour.js';
import { lireJSON, matchVide, matchsDemo } from './aides.js';

const schemaModele = JSON.parse(readFileSync(new URL('../schema/modele.schema.json', import.meta.url), 'utf8'));
const matchs = matchsDemo();
const modeleDe = (id) => lireJSON(`data/demo/modeles/${id}.json`);
const CALCULE_LE = '2026-09-28T05:30:00Z';

describe('modèle appliqué aux 6 matchs de démo', () => {
  it('produit un résultat conforme au schéma, identique à un nouveau calcul (déterministe)', () => {
    for (const m of matchs) {
      const stocke = modeleDe(m.match_id);
      expect(valider(stocke, schemaModele), m.match_id).toEqual([]);
      const recalcule = analyserMatch(m, chargerHistoriqueLigue('demo', m.competition.id).matchs, { calculeLe: CALCULE_LE });
      expect(recalcule).toEqual(stocke);
    }
  });

  it('grille 11 × 11 qui somme à 100 %', () => {
    for (const m of matchs) {
      const { grille } = modeleDe(m.match_id);
      expect(grille).toHaveLength(11);
      expect(Math.abs(grille.flat().reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-4); // arrondi à 6 décimales
    }
  });

  it('P(Over 0,5) ≥ P(Over 1,5) ≥ … ≥ P(Over 5,5) et Over + Under = 100 %', () => {
    for (const m of matchs) {
      const { total_buts: t, mi_temps: mt } = modeleDe(m.match_id);
      for (let k = 0; k < 5; k++) expect(t[`over_${k}_5`]).toBeGreaterThanOrEqual(t[`over_${k + 1}_5`]);
      for (let k = 0; k <= 5; k++) expect(t[`over_${k}_5`] + t[`under_${k}_5`]).toBeCloseTo(1, 10);
      if (mt) {
        expect(mt.over_0_5).toBeLessThanOrEqual(t.over_0_5);
        expect(mt.over_0_5 + mt.under_0_5).toBeCloseTo(1, 10);
        expect(mt.over_1_5 + mt.under_1_5).toBeCloseTo(1, 10);
      }
    }
  });

  it('buts attendus = somme des deux équipes, ajustements dans ±10 %', () => {
    for (const m of matchs) {
      const { buts_attendus: b, ajustements: a } = modeleDe(m.match_id);
      expect(b.total).toBeCloseTo(b.domicile + b.exterieur, 2);
      expect(b.domicile / b.domicile_avant_ajustements - 1).toBeCloseTo(a.total.D, 2);
      expect(Math.abs(a.total.D)).toBeLessThanOrEqual(0.1);
    }
  });

  it('un match non fiable donne PASSER et aucun pari suggéré', () => {
    const m = modeleDe('demo-no-fjellby-havnstad');
    expect(m.fiable).toBe(false);
    expect(m.verdict.decision).toBe('PASSER');
    expect(m.verdict.raison).toMatch(/non fiable/);
    expect(m.marches.some((x) => x.suggere)).toBe(false);
  });

  it('un verdict PARIER correspond à la meilleure value suggérée, mise ≤ 2 %', () => {
    for (const m of matchs) {
      const r = modeleDe(m.match_id);
      const suggeres = r.marches.filter((x) => x.suggere);
      for (const s of suggeres) {
        expect(s.value).toBeGreaterThanOrEqual(r.reglages.seuil_value);
        expect(s.mise_pct).toBeGreaterThan(0);
        expect(s.mise_pct).toBeLessThanOrEqual(0.02);
      }
      if (r.verdict.decision === 'PARIER') {
        expect(r.verdict.value).toBe(Math.max(...suggeres.map((s) => s.value)));
        expect(r.verdict.cote).toBeGreaterThanOrEqual(r.verdict.cote_min);
      } else expect(suggeres).toHaveLength(0);
    }
  });

  it('utilise l’historique de la ligue quand il existe, la forme sinon', () => {
    expect(modeleDe('demo-l1-valmont-rivebelle').methode.historique.matchs_ligue).toBeGreaterThan(500);
    const int = modeleDe('demo-int-nordalie-valdoranie').methode.historique;
    expect(int.matchs_ligue).toBe(0);
    expect(int.matchs_forme).toBe(20);
  });

  it('l’index du jour résume le verdict de chaque match', () => {
    const index = lireJSON('data/demo/index.json');
    for (const r of index.matchs) {
      const m = modeleDe(r.match_id);
      expect(r.modele.decision).toBe(m.verdict.decision);
      expect(r.modele.confiance).toBe(m.confiance.indice);
    }
  });
});

describe('cas limites de l’analyse', () => {
  it('sans aucun historique : non calculable, PASSER, aucune probabilité inventée', () => {
    const r = analyserMatch(matchVide(), [], { calculeLe: CALCULE_LE });
    expect(valider(r, schemaModele)).toEqual([]);
    expect(r.calculable).toBe(false);
    expect(r.total_buts).toBeNull();
    expect(r.verdict).toMatchObject({ decision: 'PASSER' });
  });

  it('ignore les matchs de la ligue joués après le coup d’envoi', () => {
    const m = matchs.find((x) => x.match_id === 'demo-l1-valmont-rivebelle');
    const historique = chargerHistoriqueLigue('demo', m.competition.id).matchs;
    const futur = [...historique, { date: '2026-10-05', domicile: m.equipes.domicile.nom, exterieur: m.equipes.exterieur.nom, score: '9-0', score_mt: '5-0' }];
    expect(analyserMatch(m, futur, { calculeLe: CALCULE_LE })).toEqual(analyserMatch(m, historique, { calculeLe: CALCULE_LE }));
  });

  it('retourne la forme vue du domicile et ne compte pas deux fois un match commun aux deux équipes', () => {
    const m = matchVide();
    m.equipes.domicile.forme = [{ date: '2026-09-01', adversaire: 'B', lieu: 'E', score: '2-1', score_mt: '1-0' }];
    m.equipes.exterieur.forme = [{ date: '2026-09-01', adversaire: 'A', lieu: 'D', score: '1-2', score_mt: '0-1' }];
    const h = historiqueDepuisForme(m);
    expect(h[0]).toEqual({ date: '2026-09-01', domicile: 'B', exterieur: 'A', score: '1-2', score_mt: '0-1' });
    expect(fusionnerHistorique([], h).matchs).toHaveLength(1);
  });
});
