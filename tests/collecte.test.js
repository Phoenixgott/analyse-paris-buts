import { describe, expect, it } from 'vitest';
import { extraireReponse, importerReponse, instantUtc, score } from '../src/collecte/import.js';
import { promptFiches, promptListe, promptMiseAJour } from '../src/collecte/prompts.js';
import { analyserMatch } from '../modele/analyser.js';
import { genererPrompt } from '../src/prompt/generateur.js';
import { calculerQualite } from '../schema/qualite.js';
import { valider } from '../schema/valider.js';
import { lireJSON, schema } from './aides.js';

const L1 = lireJSON('data/ligues/fr-l1.json');
const NOMS = new Map([['fr-l1', L1.equipes_saison]]);
const MAINTENANT = '2026-10-04T08:00:00Z';
const ctx = (extra = {}) => ({ maintenant: MAINTENANT, noms: NOMS, matchs: new Map(), ...extra });
const enBloc = (obj, avant = 'Voici les données :', apres = '') => `${avant}\n\`\`\`json\n${JSON.stringify(obj, null, 2)}\n\`\`\`\n${apres}`;

const cote = (meilleure, bookmaker = 'Unibet') => ({ meilleure, bookmaker });
const COTES = {
  total_buts: {
    over_0_5: cote(1.06), over_1_5: cote(1.3), over_2_5: cote(1.85), over_3_5: cote(3.1), over_4_5: cote(5.8), over_5_5: cote(11),
    under_0_5: cote(10), under_1_5: cote(3.5), under_2_5: cote(2.0), under_3_5: cote(1.36), under_4_5: cote(1.13), under_5_5: cote(1.04),
  },
  mt_over_0_5: cote(1.4),
  mt_over_1_5: cote(2.6),
  buteur: [{ nom: 'A. Lacazette', equipe: 'D', cote: cote(2.9) }],
};

const equipe = (nom, forme) => ({
  nom,
  elo: 1790,
  classement: { rang: 4, points: 11, joues: 6, bp: 12, bc: 7 },
  forme,
  stats: {
    buts_marques_moy: '2,0', buts_encaisses_moy: 1.17, buts_mt_marques_moy: 0.83, buts_mt_encaisses_moy: 0.5, xg_moy: 1.9, tirs_cadres_moy: 5.3,
    pct_over15: 83, pct_over25: 67, pct_over35: 33, pct_but_avant_30: 50,
    buts_par_tranche: { matchs: 6, marques: [1, 2, 2, 2, 2, 3], encaisses: [1, 1, 1, 1, 2, 1] },
  },
  absents: [{ nom: 'C. Tolisso', raison: 'Blessure (cuisse)' }],
  compo_probable: ['G1', 'D1', 'D2', 'D3', 'D4', 'M1', 'M2', 'M3', 'A1', 'A2', 'A3'],
});

const FICHE = {
  domicile: 'Olympique Lyonnais',
  exterieur: 'Olympique de Marseille',
  competition_id: 'fr-l1',
  coup_envoi: '2026-10-04T18:45:00Z',
  stade: { nom: 'Groupama Stadium', ville: 'Décines-Charpieu' },
  enjeu: 'Choc entre le 4e et le 2e.',
  equipes: {
    domicile: equipe('Olympique Lyonnais', [
      { date: '2026-09-27', adversaire: 'Paris Saint-Germain', lieu: 'E', score: '1-1', score_mt: '0-1' },
      { date: '2026-09-20', adversaire: 'Stade Rennais', lieu: 'D', score: '3 - 1', score_mt: '1-0' },
      { date: '2026-10-11', adversaire: 'Nantes', lieu: 'D', score: '2-0', score_mt: '1-0' }, // futur : écarté
      { date: '2026-09-13', adversaire: 'LOSC Lille', lieu: 'E', score: 'deux-un', score_mt: null }, // illisible : écarté
    ]),
    exterieur: equipe('Olympique de Marseille', [{ date: '2026-09-28', adversaire: 'AS Monaco', lieu: 'D', score: '2-2', score_mt: '3-0' }]),
  },
  h2h: [{ date: '2026-03-01', score: '2-3', score_mt: '1-1' }],
  arbitre: { nom: 'F. Letexier', cartons_moy: 4.2, penaltys_moy: 0.3 }, // pas de source : ignoré
  meteo: { temperature: 16, vent: 9, pluie: 0 },
  buteurs: [{ nom: 'A. Lacazette', equipe: 'D', buts_par_90: 0.55, tirs_par_90: 2.9, tireur_penalty: true, coups_de_pied_arretes: false, minutes_prevues: 80 }],
  cotes: COTES,
  sources: {
    classement: 'https://www.ligue1.fr/classement', forme: 'https://www.sofascore.com/x', stats: 'https://footystats.org/x', h2h: 'https://www.sofascore.com/h2h',
    effectifs: 'https://www.lequipe.fr/x', buteurs: 'https://fbref.com/x', cotes: 'https://www.oddsportal.com/x', meteo: 'https://meteofrance.com/x', elo: 'http://clubelo.com/Lyon',
  },
};

describe('extraction de la réponse', () => {
  it('trouve le bloc JSON au milieu du texte et détecte « SUITE DISPONIBLE »', () => {
    const r = extraireReponse(enBloc({ type: 'liste-matchs', matchs: [] }, 'Voilà :', 'SUITE DISPONIBLE'));
    expect(r.objets).toEqual([{ type: 'liste-matchs', matchs: [] }]);
    expect(r.suite).toBe(true);
  });

  it('répare une virgule finale oubliée et signale un bloc illisible', () => {
    expect(extraireReponse('```json\n{"type":"liste-matchs","matchs":[],}\n```').objets).toHaveLength(1);
    const r = extraireReponse('```json\n{"type": "liste-matchs", "matchs": [\n```');
    expect(r.objets).toHaveLength(0);
    expect(r.erreurs[0]).toMatch(/illisible/);
    expect(extraireReponse('Désolé, je ne peux pas.').erreurs[0]).toMatch(/Aucun bloc JSON/);
  });

  it('refuse une heure sans fuseau et normalise les scores', () => {
    expect(instantUtc('2026-10-04T20:45:00+02:00')).toBe('2026-10-04T18:45:00Z');
    expect(instantUtc('2026-10-04T20:45:00')).toBeNull();
    expect(score('3 - 1')).toBe('3-1');
    expect(score('2:0')).toBe('2-0');
    expect(score('deux-un')).toBeNull();
  });
});

describe('étape 1 : liste des matchs', () => {
  const reponse = enBloc({
    type: 'liste-matchs',
    date: '2026-10-04',
    matchs: [
      { competition_id: 'fr-l1', domicile: 'Olympique Lyonnais', exterieur: 'Olympique de Marseille', coup_envoi: '2026-10-04T18:45:00Z', stade: { nom: 'Groupama Stadium', ville: 'Décines' }, source: 'https://www.ligue1.fr/calendrier' },
      { competition_id: 'fr-l1', domicile: 'Nice', exterieur: 'Lens', coup_envoi: '2026-10-04T13:00:00Z', stade: null, source: null },
      { competition_id: 'fr-l1', domicile: 'Brest', exterieur: 'Lorient', coup_envoi: '2026-10-05T13:00:00Z', source: 'https://www.ligue1.fr/calendrier' },
      { competition_id: 'autre', competition: 'Allsvenskan', pays: 'Suède', categorie: 'H', domicile: 'Malmö FF', exterieur: 'AIK', coup_envoi: '2026-10-04T15:00:00Z', source: 'https://www.flashscore.fr/x' },
    ],
  });
  const r = importerReponse(reponse, ctx({ date: '2026-10-04' }));

  it('garde les matchs sourcés du bon jour, noms de l’historique', () => {
    expect(r.annonces.map((a) => `${a.domicile}-${a.exterieur}`)).toEqual(['Lyon-Marseille', 'Malmö FF-AIK']);
    expect(r.annonces[0]).toMatchObject({ id: '2026-10-04-lyon-marseille', date: '2026-10-04', competition: { id: 'fr-l1', palier: 1 } });
  });

  it('classe une compétition hors liste en palier 2', () => {
    expect(r.annonces[1].competition).toMatchObject({ id: 'autre-allsvenskan', nom: 'Allsvenskan', pays: 'Suède', palier: 2 });
  });

  it('explique chaque match écarté', () => {
    const raisons = r.rapport.ecartes.map((e) => e.raison).join('\n');
    expect(raisons).toMatch(/Aucune URL de source/);
    expect(raisons).toMatch(/Joué le 2026-10-05/);
  });
});

describe('étape 2 : fiche complète', () => {
  const r = importerReponse(enBloc({ type: 'fiches-matchs', matchs: [FICHE] }), ctx());
  const m = r.matchs[0];

  it('produit une fiche conforme au schéma, noms rapprochés de l’historique', () => {
    expect(r.matchs).toHaveLength(1);
    expect(valider(m, schema)).toEqual([]);
    expect(m.match_id).toBe('2026-10-04-lyon-marseille');
    expect(m.equipes.domicile.nom).toBe('Lyon');
    expect(m.equipes.exterieur.nom).toBe('Marseille');
    expect(m.equipes.domicile.forme.map((f) => f.adversaire)).toEqual(['Paris SG', 'Rennes']);
    expect(m.demo).toBe(false);
  });

  it('écarte la forme future ou illisible, et le score MT impossible', () => {
    expect(m.equipes.domicile.forme).toHaveLength(2);
    expect(m.equipes.domicile.forme[1].score).toBe('3-1');
    expect(m.equipes.exterieur.forme[0].score_mt).toBeNull(); // 3-0 à la pause pour 2-2 à la fin
    expect(r.rapport.ecartes.some((e) => /2 match\(s\) de forme écarté/.test(e.raison))).toBe(true);
  });

  it('ignore un bloc sans URL de source (arbitre)', () => {
    expect(m.arbitre).toBeNull();
    expect(r.rapport.ecartes.some((e) => /sans URL de source.*arbitre/.test(e.raison))).toBe(true);
  });

  it('lit « 2,0 », calcule les jours de repos, la qualité et la cote d’ouverture', () => {
    expect(m.equipes.domicile.stats.buts_marques_moy).toBe(2);
    expect(m.equipes.domicile.jours_repos).toBe(7);
    expect(m.qualite_donnees).toBe(calculerQualite(m));
    expect(m.cotes.total_buts.over_2_5).toEqual({ meilleure: 1.85, bookmaker: 'Unibet', ouverture: 1.85, mouvement: 0 });
    expect(m.sources.some((s) => s.nom.startsWith('cotes : https://www.oddsportal.com'))).toBe(true);
  });

  it('se calcule avec l’historique réel de la Ligue 1, et donne un prompt IA valide', () => {
    const modele = analyserMatch(m, L1.matchs, { calculeLe: MAINTENANT });
    expect(modele.calculable).toBe(true);
    expect(modele.methode.historique.matchs_ligue).toBeGreaterThan(300);
    expect(modele.methode.domicile.n_matchs).toBeGreaterThan(30); // Lyon retrouvé dans l'historique
    expect(modele.methode.exterieur.n_matchs).toBeGreaterThan(30);
    expect(genererPrompt(m, modele).controles.ok).toBe(true);
  });

  it('un nouvel import garde la cote d’ouverture et n’efface rien avec un null', () => {
    const connus = new Map([[m.match_id, m]]);
    const plusTard = structuredClone(FICHE);
    plusTard.cotes.total_buts.over_2_5 = cote(1.95, 'Winamax');
    plusTard.cotes.total_buts.under_2_5 = cote(1.9, 'Winamax');
    delete plusTard.h2h;
    const r2 = importerReponse(enBloc({ type: 'fiches-matchs', matchs: [plusTard] }), ctx({ matchs: connus }));
    const m2 = r2.matchs[0];
    expect(r2.rapport.mis_a_jour).toHaveLength(1);
    expect(m2.cotes.total_buts.over_2_5).toEqual({ meilleure: 1.95, bookmaker: 'Winamax', ouverture: 1.85, mouvement: 0.1 });
    expect(m2.h2h).toEqual(m.h2h);
  });
});

describe('cotes incohérentes', () => {
  it('écarte un total de buts dans un ordre impossible', () => {
    const f = structuredClone(FICHE);
    f.cotes.total_buts.over_3_5 = cote(1.5);
    f.cotes.total_buts.under_3_5 = cote(2.6);
    const r = importerReponse(enBloc({ type: 'fiches-matchs', matchs: [f] }), ctx());
    expect(r.matchs[0].cotes.total_buts).toBeNull();
    expect(r.matchs[0].cotes.mt_over_0_5).not.toBeNull();
    expect(r.rapport.ecartes.some((e) => /ordre impossible/.test(e.raison))).toBe(true);
  });

  it('écarte une paire Plus/Moins à marge impossible', () => {
    const f = structuredClone(FICHE);
    f.cotes.total_buts.over_2_5 = cote(1.85);
    f.cotes.total_buts.under_2_5 = cote(2.9); // 1/1,85 + 1/2,9 = 0,89 : marge négative
    const r = importerReponse(enBloc({ type: 'fiches-matchs', matchs: [f] }), ctx());
    expect(r.matchs[0].cotes.total_buts.over_2_5).toBeNull();
    expect(r.matchs[0].cotes.total_buts.over_1_5).not.toBeNull();
  });

  it('refuse une fiche sans heure UTC', () => {
    const f = { ...structuredClone(FICHE), coup_envoi: '2026-10-04 20:45' };
    const r = importerReponse(enBloc({ type: 'fiches-matchs', matchs: [f] }), ctx());
    expect(r.matchs).toHaveLength(0);
    expect(r.rapport.ecartes[0].raison).toMatch(/fiche refusée/);
  });
});

describe('étape 3 : mise à jour avant le match', () => {
  const base = importerReponse(enBloc({ type: 'fiches-matchs', matchs: [FICHE] }), ctx()).matchs[0];
  const connus = new Map([[base.match_id, base]]);

  it('met à jour cotes de mi-temps, absents et compo sans effacer le total de buts', () => {
    const maj = {
      type: 'maj-matchs',
      matchs: [{
        domicile: 'Lyon', exterieur: 'Olympique de Marseille', coup_envoi: '2026-10-04T18:45:00Z',
        cotes: { mt_over_0_5: cote(1.45), mt_over_1_5: cote(2.7) },
        absents: { domicile: [], exterieur: [{ nom: 'J. Absent', raison: 'Suspension' }] },
        compo_probable: { domicile: ['X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'X8', 'X9', 'X10', 'X11'], exterieur: null },
        sources: { cotes: 'https://www.oddsportal.com/y', effectifs: 'https://www.lequipe.fr/compos' },
      }],
    };
    const r = importerReponse(enBloc(maj), ctx({ matchs: connus }));
    const m = r.matchs[0];
    expect(valider(m, schema)).toEqual([]);
    expect(m.cotes.mt_over_0_5).toEqual({ meilleure: 1.45, bookmaker: 'Unibet', ouverture: 1.4, mouvement: 0.05 });
    expect(m.cotes.total_buts).toEqual(base.cotes.total_buts);
    expect(m.equipes.domicile.absents).toEqual([]);
    expect(m.equipes.exterieur.absents).toEqual([{ nom: 'J. Absent', raison: 'Suspension' }]);
    expect(m.equipes.domicile.compo_probable[0]).toBe('X1');
    expect(m.equipes.exterieur.compo_probable).toEqual(base.equipes.exterieur.compo_probable);
    for (const change of ['cotes', 'absents domicile', 'compo domicile', 'absents exterieur']) expect(r.rapport.mis_a_jour[0]).toContain(change);
  });

  it('refuse la mise à jour d’un match dont la fiche n’a pas été importée', () => {
    const r = importerReponse(enBloc({ type: 'maj-matchs', matchs: [{ domicile: 'Nice', exterieur: 'Lens', coup_envoi: '2026-10-04T13:00:00Z' }] }), ctx({ matchs: connus }));
    expect(r.matchs).toHaveLength(0);
    expect(r.rapport.ecartes[0].raison).toMatch(/importe d’abord sa fiche/);
  });
});

describe('prompts de collecte', () => {
  it('liste : date, compétitions, noms imposés, format et règles', () => {
    const p = promptListe('2026-10-04', [{ id: 'fr-l1', noms_equipes: L1.equipes_saison }, { id: 'ucl' }], { autres: true, maxAutres: 5 });
    expect(p).toContain('dimanche 4 octobre 2026 (2026-10-04)');
    expect(p).toContain('Ligue 1 (France) — competition_id « fr-l1 » — noms d\'équipes à écrire exactement ainsi : Angers, Auxerre');
    expect(p).toContain('Ligue des champions (Europe) — competition_id « ucl »');
    expect(p).toContain('les 5 matchs les plus suivis');
    expect(p).toContain('"type":"liste-matchs"');
    expect(p).toContain('SUITE DISPONIBLE');
    expect(p).not.toMatch(/\{\{/);
  });

  it('fiches : matchs, format complet, obligation de sources', () => {
    const p = promptFiches([{ domicile: 'Lyon', exterieur: 'Marseille', competition_id: 'fr-l1', coup_envoi: '2026-10-04T18:45:00Z', noms_equipes: L1.equipes_saison }]);
    expect(p).toContain('1. Lyon vs Marseille — Ligue 1 — competition_id « fr-l1 » — coup d\'envoi 2026-10-04T18:45:00Z (20:45 heure de Paris)');
    for (const cle of ['"buts_par_tranche"', '"h2h"', '"cotes"', '"sources"', 'Un bloc sans source sera ignoré']) expect(p).toContain(cle);
    expect(p).toContain('"type":"fiches-matchs"');
  });

  it('mise à jour : cotes, absents, compositions', () => {
    const p = promptMiseAJour([{ domicile: 'Lyon', exterieur: 'Marseille', coup_envoi: '2026-10-04T18:45:00Z' }]);
    expect(p).toContain('1. Lyon vs Marseille — coup d\'envoi 2026-10-04T18:45:00Z (20:45 heure de Paris)');
    expect(p).toContain('"type":"maj-matchs"');
  });
});
