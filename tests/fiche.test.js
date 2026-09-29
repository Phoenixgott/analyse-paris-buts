import { describe, expect, it } from 'vitest';
import { LIGNES, detailLigne, libelleLigne, ligneInitiale } from '../src/fiche/ligne.js';
import { lireJSON, matchVide, matchsDemo } from './aides.js';

const l1 = matchsDemo().find((m) => m.match_id === 'demo-l1-valmont-rivebelle');
const modele = lireJSON('data/demo/modeles/demo-l1-valmont-rivebelle.json');

describe('ligne de buts choisie sur la fiche', () => {
  it('Plus et Moins d’une même ligne font 100 %, modèle comme marché', () => {
    for (const k of LIGNES) {
      const plus = detailLigne(modele, l1, k, 'plus');
      const moins = detailLigne(modele, l1, k, 'moins');
      expect(plus.proba + moins.proba).toBeCloseTo(1, 10);
      expect(plus.proba).toBe(modele.total_buts[`over_${k}_5`]);
      if (plus.proba_marche != null) expect(plus.proba_marche + moins.proba_marche).toBeCloseTo(1, 12);
    }
  });

  it('reprend la cote et la value calculées par le modèle, marge du marché retirée', () => {
    const d = detailLigne(modele, l1, 2, 'plus');
    const m = modele.marches.find((x) => x.marche === 'over_2_5');
    expect(d).toMatchObject({ marche: 'over_2_5', libelle: 'Plus de 2,5 buts', cote: m.cote, value: m.value, suggere: m.suggere });
    const tb = l1.cotes.total_buts;
    const io = 1 / tb.over_2_5.meilleure;
    expect(d.proba_marche).toBeCloseTo(io / (io + 1 / tb.under_2_5.meilleure), 12);
  });

  it('laisse N/D (null) ce qui manque, sans rien inventer', () => {
    const d = detailLigne(null, matchVide(), 3, 'moins');
    expect(d).toMatchObject({ proba: null, proba_marche: null, cote: null, value: null, suggere: false });
    expect(libelleLigne(0, 'plus')).toBe('Plus de 0,5 but');
  });

  it('ouvre sur la ligne du pari suggéré, sinon Plus de 2,5', () => {
    expect(ligneInitiale({ verdict: { marche: 'under_3_5' } })).toEqual({ k: 3, sens: 'moins' });
    expect(ligneInitiale({ verdict: { marche: 'buteur:X' } })).toEqual({ k: 2, sens: 'plus' });
    expect(ligneInitiale(null)).toEqual({ k: 2, sens: 'plus' });
  });
});
