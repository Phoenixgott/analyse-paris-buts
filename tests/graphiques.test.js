import { describe, expect, it } from 'vitest';
import { etiquettesForme, jauge, overModeleMarche, radarEquipe, serieForme, tranchesEquipe } from '../src/graphiques/donnees.js';
import { lireJSON, matchVide, matchsDemo } from './aides.js';

const matchs = matchsDemo();
const l1 = matchs.find((m) => m.match_id === 'demo-l1-valmont-rivebelle');
const modeleL1 = lireJSON('data/demo/modeles/demo-l1-valmont-rivebelle.json');

describe('courbe de forme', () => {
  it('10 points du plus ancien au plus récent, total = buts pour + contre', () => {
    const s = serieForme(l1.equipes.domicile);
    expect(s).toHaveLength(10);
    const plusRecent = l1.equipes.domicile.forme[0];
    expect(s[9].date).toBe(plusRecent.date);
    const [p, c] = plusRecent.score.split('-').map(Number);
    expect(s[9].total).toBe(p + c);
    expect(etiquettesForme().at(-1)).toBe('Dern.');
  });

  it('aligne à droite une forme incomplète (trous au début, jamais de zéro inventé)', () => {
    const norvege = matchs.find((m) => m.match_id === 'demo-no-fjellby-havnstad');
    const s = serieForme(norvege.equipes.domicile);
    expect(s.slice(0, 7)).toEqual(Array(7).fill(null));
    expect(s[9]).not.toBeNull();
    expect(serieForme(matchVide().equipes.domicile)).toEqual(Array(10).fill(null));
  });
});

describe('barres Over : modèle contre marché', () => {
  it('reprend les probabilités du modèle (en %) et retire la marge des cotes', () => {
    const lignes = overModeleMarche(modeleL1, l1);
    expect(lignes.map((l) => l.ligne)).toEqual(['+0,5', '+1,5', '+2,5', '+3,5', '+4,5', '+5,5']);
    expect(lignes[2].modele).toBeCloseTo(modeleL1.total_buts.over_2_5 * 100, 10);
    const o = l1.cotes.total_buts.over_2_5.meilleure;
    const u = l1.cotes.total_buts.under_2_5.meilleure;
    expect(lignes[2].marche).toBeCloseTo((100 * (1 / o)) / (1 / o + 1 / u), 10);
    for (let k = 0; k < 5; k++) expect(lignes[k].modele).toBeGreaterThanOrEqual(lignes[k + 1].modele);
  });

  it('laisse le marché à null sans cotes', () => {
    const lignes = overModeleMarche(modeleL1, { ...l1, cotes: null });
    expect(lignes.every((l) => l.marche === null)).toBe(true);
  });
});

describe('buts par tranche de 15 minutes', () => {
  it('divise les buts de chaque tranche par les matchs joués', () => {
    const t = l1.equipes.domicile.stats.buts_par_tranche;
    const lignes = tranchesEquipe(l1.equipes.domicile);
    expect(lignes).toHaveLength(6);
    expect(lignes[0].total).toBeCloseTo((t.marques[0] + t.encaisses[0]) / t.matchs, 12);
    // Cohérence : la somme des tranches = buts marqués + encaissés par match.
    const somme = lignes.reduce((s, l) => s + l.total, 0);
    const s = l1.equipes.domicile.stats;
    expect(somme).toBeCloseTo(s.buts_marques_moy + s.buts_encaisses_moy, 1);
  });

  it('renvoie null quand la source ne donne pas les minutes des buts', () => {
    const int = matchs.find((m) => m.match_id === 'demo-int-nordalie-valdoranie');
    expect(tranchesEquipe(int.equipes.domicile)).toBeNull();
    expect(tranchesEquipe(matchVide().equipes.domicile)).toBeNull();
  });
});

describe('radar attaque/défense', () => {
  it('indice 100 = moyenne de la ligue ; exp(force) × 100 pour le modèle', () => {
    const r = radarEquipe(l1.equipes.domicile, modeleL1.methode.domicile, modeleL1);
    expect(r).toHaveLength(6);
    expect(r[0]).toBe(Math.round(Math.exp(modeleL1.methode.domicile.attaque) * 100));
    expect(r[1]).toBe(Math.round(Math.exp(-modeleL1.methode.domicile.defense) * 100));
    expect(r.every((v) => v === null || (v > 0 && v < 400))).toBe(true);
  });

  it('laisse un trou (null) pour une donnée absente et rien sans modèle', () => {
    const pl = matchs.find((m) => m.match_id === 'demo-pl-ashford-kingsbridge'); // sans xG
    const modele = lireJSON('data/demo/modeles/demo-pl-ashford-kingsbridge.json');
    expect(radarEquipe(pl.equipes.domicile, modele.methode.domicile, modele)[5]).toBeNull();
    expect(radarEquipe(pl.equipes.domicile, null, null)).toBeNull();
  });
});

describe('jauge de confiance', () => {
  it('reprend l’indice et le seuil du modèle', () => {
    expect(jauge(modeleL1)).toEqual({ valeur: modeleL1.confiance.indice, seuil: 50 });
    expect(jauge(null)).toEqual({ valeur: null, seuil: 50 });
  });
});
