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

  it('ont un index cohérent avec les fiches et les calculs du modèle', () => {
    const index = lireJSON('data/demo/index.json');
    expect(index.demo).toBe(true);
    const modeles = new Map(matchs.map((m) => [m.match_id, lireJSON(`data/demo/modeles/${m.match_id}.json`)]));
    expect(index).toEqual(construireIndex(matchs, { date: index.date, demo: true, genereLe: index.genere_le }, modeles));
  });

  it('ont un historique de ligue cohérent avec la forme et le classement des équipes', () => {
    const m = matchs.find((x) => x.match_id === 'demo-l1-valmont-rivebelle');
    const ligue = lireJSON(`data/demo/ligues/${m.competition.id}.json`);
    const nom = m.equipes.domicile.nom;
    const derniers = ligue.matchs
      .filter((x) => x.domicile === nom || x.exterieur === nom)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
    expect(m.equipes.domicile.forme.map((f) => f.date)).toEqual(derniers.map((x) => x.date));
    expect(derniers.every((x) => x.date < m.coup_envoi.slice(0, 10))).toBe(true);
    expect(m.equipes.domicile.classement.joues).toBe(7);
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

  // Match démo le plus complet, avec 5 face-à-face (le maximum compté).
  const complet = () => {
    const m = structuredClone(matchs.find((x) => x.match_id === 'demo-l1-valmont-rivebelle'));
    while (m.h2h.length < 5) m.h2h.push({ ...m.h2h[0] });
    return m;
  };

  it('donne 100 quand toutes les rubriques sont remplies', () => {
    expect(calculerQualite(complet())).toBe(100);
  });

  it('retire des points au prorata : 4 face-à-face sur 5 coûtent 1 point', () => {
    const m = complet();
    m.h2h = m.h2h.slice(0, 4);
    expect(calculerQualite(m)).toBe(99);
  });

  it('pèse 100 points au total et fixe le seuil de fiabilité à 40', () => {
    const total = Object.values(detailQualite(complet())).reduce((a, b) => a + b, 0);
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
