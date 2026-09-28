import { describe, expect, it } from 'vitest';
import { calculerQualite, detailQualite, estFiable, SEUIL_FIABLE } from '../schema/qualite.js';
import { construireIndex } from '../scripts/lib/index-jour.js';
import { lireJSON, matchVide, matchsDemo } from './aides.js';

const matchs = matchsDemo();

describe('données de démonstration', () => {
  it('sont toutes marquées demo: true avec une source « DÉMO »', () => {
    for (const m of matchs) {
      expect(m.demo, m.match_id).toBe(true);
      expect(m.sources.some((s) => s.nom.startsWith('DÉMO')), m.match_id).toBe(true);
    }
  });

  it('couvrent les cas à montrer : H, F, INT, palier 2 et un match non fiable', () => {
    const categories = new Set(matchs.map((m) => m.competition.categorie));
    expect([...categories].sort()).toEqual(['F', 'H', 'INT']);
    expect(matchs.some((m) => m.competition.palier === 2)).toBe(true);
    expect(matchs.filter((m) => !estFiable(m.qualite_donnees))).toHaveLength(1);
  });

  it('ont un index cohérent avec les fiches', () => {
    const index = lireJSON('data/demo/index.json');
    expect(index.demo).toBe(true);
    expect(index).toEqual(construireIndex(matchs, { date: index.date, demo: true, genereLe: index.genere_le }));
  });

  it('sont pointées par l’index général, sans jour réel inventé', () => {
    const general = lireJSON('data/index.json');
    expect(general.demo).toBe('demo');
    expect(Array.isArray(general.jours)).toBe(true);
  });
});

describe('qualité des données', () => {
  it('vaut 0 quand tout est absent (hors stade/enjeu) : match non fiable', () => {
    expect(calculerQualite(matchVide())).toBe(0);
    expect(estFiable(0)).toBe(false);
  });

  it('est recalculée à l’identique pour chaque match de démo', () => {
    for (const m of matchs) expect(calculerQualite(m), m.match_id).toBe(m.qualite_donnees);
  });

  it('donne 100 quand toutes les rubriques sont remplies', () => {
    const complet = matchs.find((m) => m.match_id === 'demo-l1-valmont-rivebelle');
    expect(calculerQualite(complet)).toBe(100);
  });

  it('pèse 100 points au total et fixe le seuil de fiabilité à 40', () => {
    const complet = matchs.find((m) => m.match_id === 'demo-l1-valmont-rivebelle');
    const total = Object.values(detailQualite(complet)).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(100, 6);
    expect(SEUIL_FIABLE).toBe(40);
    expect(estFiable(39)).toBe(false);
    expect(estFiable(40)).toBe(true);
  });

  it('distingue « aucun absent signalé » ([]) de « absents inconnus » (null)', () => {
    const connu = matchVide();
    connu.equipes.domicile.absents = [];
    connu.equipes.exterieur.absents = [];
    expect(detailQualite(connu).equipes).toBeGreaterThan(detailQualite(matchVide()).equipes);
  });
});
