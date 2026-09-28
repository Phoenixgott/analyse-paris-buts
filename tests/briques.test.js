import { describe, expect, it } from 'vitest';
import { reglages } from '../modele/reglages.js';
import { calculerAjustements } from '../modele/ajustements.js';
import { probaButeurs } from '../modele/buteurs.js';
import { coteMinimale, evaluerPari, kelly, value } from '../modele/value-kelly.js';
import { accordMarche, indiceConfiance, probaMarche } from '../modele/confiance.js';
import { marchesMiTemps, partButsMt } from '../modele/mi-temps.js';
import { grilleScores, probaOver } from '../modele/grille.js';
import { matchVide } from './aides.js';

const R = reglages();
const OK = { fiable: true, confiance: 80 };

describe('value et mise (Kelly ¼, plafond 2 %)', () => {
  it('value = proba × cote − 1 et Kelly = (p × cote − 1) / (cote − 1)', () => {
    expect(value(0.5, 2.2)).toBeCloseTo(0.1, 12);
    expect(kelly(0.5, 2.2)).toBeCloseTo(0.1 / 1.2, 12);
    expect(coteMinimale(0.5, 0.05)).toBeCloseTo(2.1, 12);
  });

  it('mise = ¼ Kelly quand elle reste sous 2 %', () => {
    const e = evaluerPari(0.5, 2.12, R, OK); // value 6 %, Kelly 5,36 %
    expect(e.suggere).toBe(true);
    expect(e.mise_pct).toBeCloseTo(0.25 * kelly(0.5, 2.12), 12);
    expect(e.mise_pct).toBeLessThan(0.02);
  });

  it('plafonne la mise à 2 % de la bankroll', () => {
    const e = evaluerPari(0.6, 2, R, OK); // value 20 %, ¼ Kelly = 5 %
    expect(e.suggere).toBe(true);
    expect(e.mise_pct).toBe(0.02);
  });

  it('ne suggère rien sous le seuil de 5 %, ni sur un match non fiable, ni sans confiance', () => {
    expect(evaluerPari(0.5, 2.08, R, OK)).toMatchObject({ suggere: false, mise_pct: 0 });
    expect(evaluerPari(0.6, 2, R, { fiable: false, confiance: 90 })).toMatchObject({ suggere: false, mise_pct: 0 });
    expect(evaluerPari(0.6, 2, R, { fiable: true, confiance: 49 })).toMatchObject({ suggere: false });
    expect(evaluerPari(0.6, 2, R, { fiable: true, confiance: null })).toMatchObject({ suggere: false });
  });

  it('écarte une value suspecte (> 30 %) et un événement à moins de 20 %', () => {
    expect(evaluerPari(0.5, 3, R, OK).raison).toMatch(/suspecte/);
    expect(evaluerPari(0.15, 8, R, OK)).toMatchObject({ suggere: false });
  });

  it('renvoie N/D sans cote ou sans probabilité, sans jamais inventer', () => {
    expect(evaluerPari(0.5, null, R, OK)).toMatchObject({ value: null, suggere: false, raison: 'Cote N/D' });
    expect(evaluerPari(null, 2, R, OK)).toMatchObject({ value: null, cote_min: null, suggere: false });
  });

  it('respecte un seuil de value réglé autrement', () => {
    const r10 = reglages({ seuil_value: 0.1 });
    expect(evaluerPari(0.5, 2.12, r10, OK).suggere).toBe(false);
  });
});

describe('ajustements bornés à ±10 %', () => {
  it('ne touche à rien quand les données sont absentes (statut N/D)', () => {
    const a = calculerAjustements(matchVide(), R);
    expect(a.total).toEqual({ D: 0, E: 0 });
    expect(a.liste.filter((x) => x.statut === 'N/D').length).toBeGreaterThan(5);
  });

  it('cumule les effets mais plafonne à −10 % par équipe', () => {
    const m = matchVide();
    m.meteo = { temperature: 5, vent: 55, pluie: 4 }; // −4 % et −3 %
    m.equipes.domicile.jours_repos = 2; // −3 %
    m.equipes.domicile.absents = Array.from({ length: 6 }, (_, i) => ({ nom: `J${i}`, raison: 'Blessure' })); // −6 %
    m.equipes.exterieur.jours_repos = 7;
    m.equipes.exterieur.absents = [];
    const a = calculerAjustements(m, R);
    expect(a.brut.D).toBeCloseTo(-0.16, 12);
    expect(a.total.D).toBe(-0.1);
    expect(a.total.E).toBeCloseTo(-0.07, 12);
  });

  it('compte un absent « incertain » pour moitié', () => {
    const m = matchVide();
    m.equipes.domicile.absents = [{ nom: 'A', raison: 'Incertain' }, { nom: 'B', raison: 'Suspension' }];
    expect(calculerAjustements(m, R).total.D).toBeCloseTo(1.5 * -0.015, 12);
  });
});

describe('buteurs : P(marquer) = 1 − exp(−λ)', () => {
  const base = () => {
    const m = matchVide();
    m.equipes.domicile.stats = { buts_marques_moy: 1.5, buts_encaisses_moy: 1, buts_mt_marques_moy: null, buts_mt_encaisses_moy: null, xg_moy: null, tirs_cadres_moy: null, pct_over15: null, pct_over25: null, pct_over35: null, pct_but_avant_30: null };
    m.equipes.domicile.absents = [{ nom: 'Z. Absent', raison: 'Blessure' }];
    m.buteurs = [
      { nom: 'A. Buteur', equipe: 'D', buts_par_90: 0.6, tirs_par_90: 3, tireur_penalty: true, coups_de_pied_arretes: false, minutes_prevues: 90 },
      { nom: 'B. Ailier', equipe: 'D', buts_par_90: 0.3, tirs_par_90: 2, tireur_penalty: false, coups_de_pied_arretes: false, minutes_prevues: 45 },
      { nom: 'C. Inconnu', equipe: 'D', buts_par_90: 0.3, tirs_par_90: 2, tireur_penalty: false, coups_de_pied_arretes: false, minutes_prevues: null },
      { nom: 'Z. Absent', equipe: 'D', buts_par_90: 0.5, tirs_par_90: 2, tireur_penalty: false, coups_de_pied_arretes: false, minutes_prevues: 90 },
      { nom: 'E. Sans stats', equipe: 'E', buts_par_90: 0.4, tirs_par_90: 2, tireur_penalty: false, coups_de_pied_arretes: false, minutes_prevues: 90 },
    ];
    return m;
  };

  it('calcule λ = part × buts attendus de l’équipe, avec tirs, minutes et penalty', () => {
    const [a, b] = probaButeurs(base(), { lambda: 2, mu: 1 }, R);
    const conversion = (0.6 + 0.3 + 0.3 + 0.5) / (3 + 2 + 2 + 2);
    const tauxA = 0.75 * 0.6 + 0.25 * 3 * conversion;
    expect(a.part).toBeCloseTo((tauxA * 1 * 1.1) / 1.5, 12);
    expect(a.lambda).toBeCloseTo(a.part * 2, 12);
    expect(a.proba).toBeCloseTo(1 - Math.exp(-a.lambda), 12);
    expect(b.part).toBeLessThan(a.part); // 45 minutes, pas de penalty
  });

  it('donne N/D si les minutes prévues ou les buts de l’équipe manquent, et écarte un absent', () => {
    const r = probaButeurs(base(), { lambda: 2, mu: 1 }, R);
    expect(r.find((x) => x.nom === 'C. Inconnu')).toMatchObject({ proba: null, statut: 'N/D : minutes prévues' });
    expect(r.find((x) => x.nom === 'Z. Absent')).toMatchObject({ proba: null, statut: 'absent' });
    expect(r.find((x) => x.nom === 'E. Sans stats').proba).toBeNull(); // équipe extérieure sans stats ni forme
  });

  it('plafonne la part d’un joueur à 60 % des buts de son équipe', () => {
    const m = base();
    m.buteurs[0].buts_par_90 = 3;
    const [a] = probaButeurs(m, { lambda: 2, mu: 1 }, R);
    expect(a.part).toBe(0.6);
  });
});

describe('1re mi-temps', () => {
  it('utilise la part de buts en MT de l’historique quand il y a assez de matchs', () => {
    const p = partButsMt({ part_mt: { valeur: 0.44, n_matchs: 300 } }, matchVide(), R);
    expect(p).toEqual({ valeur: 0.44, source: 'historique', n_matchs: 300 });
  });

  it('renvoie null (N/D) sans historique, stats ni forme', () => {
    expect(partButsMt({ part_mt: { valeur: null, n_matchs: 0 } }, matchVide(), R)).toBeNull();
  });

  it('P(Over 0,5 MT) ≤ P(Over 0,5 match) et Over + Under = 100 %', () => {
    for (const [l, u] of [[0.6, 0.4], [1.5, 1.2], [3, 2]]) {
      const mt = marchesMiTemps(l, u, -0.1, 0.44, 10);
      expect(mt.over_0_5).toBeLessThanOrEqual(probaOver(grilleScores(l, u, -0.1), 0.5));
      expect(mt.over_0_5).toBeGreaterThanOrEqual(mt.over_1_5);
      expect(mt.over_0_5 + mt.under_0_5).toBe(1);
      expect(mt.over_1_5 + mt.under_1_5).toBe(1);
    }
  });
});

describe('indice de confiance', () => {
  it('reste entre 0 et 100 et renormalise sans cotes', () => {
    expect(indiceConfiance({ qualite: 100, nDomicile: 30, nExterieur: 30, accord: 100 }, R).indice).toBe(100);
    expect(indiceConfiance({ qualite: 0, nDomicile: 0, nExterieur: 0, accord: 0 }, R).indice).toBe(0);
    const sansCotes = indiceConfiance({ qualite: 80, nDomicile: 15, nExterieur: 15, accord: null }, R);
    expect(sansCotes.indice).toBe(Math.round((0.4 * 80 + 0.3 * 100) / 0.7));
  });

  it('mesure l’accord modèle/marché avec les probabilités du marché sans marge', () => {
    expect(probaMarche(1.9, 1.9)).toBeCloseTo(0.5, 12);
    expect(probaMarche(null, 1.9)).toBeNull();
    expect(accordMarche([{ proba_modele: 0.5, proba_marche: 0.5 }], R)).toBe(100);
    expect(accordMarche([{ proba_modele: 0.65, proba_marche: 0.5 }], R)).toBeCloseTo(0, 10);
    expect(accordMarche([{ proba_modele: 0.5, proba_marche: null }], R)).toBeNull();
  });
});
