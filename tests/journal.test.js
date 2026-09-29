import { describe, expect, it } from 'vitest';
import { creerPari, depassements, gainSelonStatut, limitesDuJour, resoudreAutomatiquement, resoudreManuellement, statistiques, trancher, versCsv } from '../src/journal/paris.js';
import { extrairePicks, grouperPicks } from '../src/journal/picks.js';
import { alerteLimite, alerteResolution, alerteValueBets, envoyerAlerte, topicAleatoire, topicValide, urlAlerte } from '../src/alertes/ntfy.js';
import { importerReponse } from '../src/collecte/import.js';
import { promptResultats } from '../src/collecte/prompts.js';
import { jourParis } from '../src/format.js';
import { lireJSON } from './aides.js';

const MAINTENANT = '2026-10-04T10:00:00Z';
const nouveau = (extra = {}) => creerPari({ libelle_match: 'Lyon – Marseille', marche: 'over_2_5', cote: '1,85', mise: '10', match_id: '2026-10-04-lyon-marseille', ...extra }, { id: 'p1', maintenant: MAINTENANT }).pari;
const resultat = (score, score_mt = null, buteurs = null, statut = 'termine') => ({ statut, score, score_mt, buteurs });

describe('création d’un pari', () => {
  it('accepte « 1,85 » et « 10 », refuse une cote ou une mise impossible', () => {
    const p = nouveau();
    expect(p).toMatchObject({ cote: 1.85, mise: 10, statut: 'en_cours', libelle_marche: 'Plus de 2,5 buts', gain: null });
    expect(creerPari({ libelle_match: 'A – B', marche: 'over_2_5', cote: '1', mise: '10' }, { id: 'x', maintenant: MAINTENANT }).erreur).toMatch(/cote/);
    expect(creerPari({ libelle_match: 'A – B', marche: 'over_2_5', cote: '2', mise: '-5' }, { id: 'x', maintenant: MAINTENANT }).erreur).toMatch(/mise/);
    expect(creerPari({ libelle_match: '', marche: 'over_2_5', cote: '2', mise: '5' }, { id: 'x', maintenant: MAINTENANT }).erreur).toMatch(/match/);
  });

  it('calcule le gain net selon le statut', () => {
    const p = nouveau();
    expect(gainSelonStatut(p, 'gagne')).toBe(8.5);
    expect(gainSelonStatut(p, 'perdu')).toBe(-10);
    expect(gainSelonStatut(p, 'rembourse')).toBe(0);
  });
});

describe('résolution selon le score', () => {
  it('Plus / Moins de k,5 buts', () => {
    expect(trancher(nouveau({ marche: 'over_2_5' }), resultat('2-1')).statut).toBe('gagne');
    expect(trancher(nouveau({ marche: 'over_2_5' }), resultat('1-1')).statut).toBe('perdu');
    expect(trancher(nouveau({ marche: 'under_2_5' }), resultat('1-1')).statut).toBe('gagne');
    expect(trancher(nouveau({ marche: 'under_0_5' }), resultat('0-0')).statut).toBe('gagne');
    expect(trancher(nouveau({ marche: 'over_5_5' }), resultat('4-2')).statut).toBe('gagne');
  });

  it('1re mi-temps : utilise le score à la pause, sinon ne tranche pas', () => {
    expect(trancher(nouveau({ marche: 'mt_over_0_5' }), resultat('2-1', '0-0')).statut).toBe('perdu');
    expect(trancher(nouveau({ marche: 'mt_over_1_5' }), resultat('2-1', '1-1')).statut).toBe('gagne');
    expect(trancher(nouveau({ marche: 'mt_over_0_5' }), resultat('2-1', null)).statut).toBeNull();
  });

  it('buteur : gagné s’il a marqué (hors contre son camp) ; sinon à trancher à la main', () => {
    const buteurs = [{ nom: 'Alexandre Lacazette', equipe: 'D', csc: false }, { nom: 'J. Défenseur', equipe: 'E', csc: true }];
    expect(trancher(nouveau({ marche: 'buteur:A. Lacazette' }), resultat('2-0', '1-0', buteurs)).statut).toBe('gagne');
    expect(trancher(nouveau({ marche: 'buteur:J. Défenseur' }), resultat('2-0', '1-0', buteurs)).statut).toBeNull();
    expect(trancher(nouveau({ marche: 'buteur:X' }), resultat('2-0', '1-0', null)).statut).toBeNull();
  });

  it('match reporté ou abandonné : pari annulé', () => {
    expect(trancher(nouveau(), resultat(null, null, null, 'reporte')).statut).toBe('annule');
  });

  it('résout automatiquement les paris en cours dont le résultat est connu', () => {
    const paris = [nouveau(), { ...nouveau({ marche: 'mt_over_0_5' }), id: 'p2' }, { ...nouveau({ match_id: 'autre-match' }), id: 'p3' }];
    const res = new Map([['2026-10-04-lyon-marseille', resultat('3-1', null)]]);
    const resolus = resoudreAutomatiquement(paris, res, '2026-10-04T21:00:00Z');
    expect(resolus).toHaveLength(1); // MT inconnue, autre match sans résultat
    expect(resolus[0]).toMatchObject({ id: 'p1', statut: 'gagne', gain: 8.5, resolution: 'auto', resultat: { score: '3-1' } });
  });

  it('résolution manuelle', () => {
    expect(resoudreManuellement(nouveau(), 'perdu', MAINTENANT)).toMatchObject({ statut: 'perdu', gain: -10, resolution: 'manuel' });
  });
});

describe('statistiques et limites', () => {
  const paris = [
    { ...nouveau(), id: 'a', statut: 'gagne', gain: 8.5, resolu_le: '2026-10-01T22:00:00Z' },
    { ...nouveau({ cote: 2 }), id: 'b', statut: 'perdu', gain: -10, resolu_le: '2026-10-02T22:00:00Z' },
    { ...nouveau(), id: 'c', statut: 'rembourse', gain: 0, resolu_le: '2026-10-03T22:00:00Z' },
    { ...nouveau(), id: 'd' },
  ];

  it('ROI = gains ÷ mises des paris joués, taux de réussite, courbe de bankroll', () => {
    const s = statistiques(paris, 100);
    expect(s).toMatchObject({ nb: 4, en_cours: 1, gagnes: 1, perdus: 1, rembourses: 1, mises: 20, gains: -1.5, bankroll: 98.5 });
    expect(s.roi).toBeCloseTo(-0.075, 12);
    expect(s.taux_reussite).toBe(0.5);
    expect(s.courbe.map((c) => c.bankroll)).toEqual([100, 108.5, 98.5, 98.5]);
    expect(statistiques([], null)).toMatchObject({ roi: null, taux_reussite: null, bankroll: null });
  });

  it('mise max du jour et stop-loss', () => {
    const jour = (iso) => jourParis(new Date(iso));
    const duJour = [{ ...nouveau(), mise: 30, gain: -30, statut: 'perdu', cree_le: MAINTENANT }, { ...nouveau(), mise: 15, cree_le: MAINTENANT }];
    const l = limitesDuJour(duJour, { mise_max_jour: 50, stop_loss: 25 }, '2026-10-04', jour);
    expect(l).toMatchObject({ mises_jour: 45, net_jour: -30, reste_a_miser: 5, mise_max_atteinte: false, stop_loss_atteint: true });
    const d = depassements(l, 10);
    expect(d).toEqual([
      'Stop-loss atteint aujourd\'hui (−30,00 € pour une limite de −25,00 €).',
      'Ce pari porterait tes mises du jour à 55,00 € pour une limite de 50,00 €.',
    ]);
    expect(depassements(limitesDuJour([], { mise_max_jour: 50 }, '2026-10-04', jour), 10)).toBeNull();
    expect(limitesDuJour(duJour, {}, '2026-10-04', jour)).toMatchObject({ mise_max_jour: null, stop_loss: null, stop_loss_atteint: false });
  });

  it('export CSV pour tableur français', () => {
    const csv = versCsv(paris);
    expect(csv.startsWith('﻿date_pari;date_match;match')).toBe(true);
    expect(csv).toContain(';1,85;10;Gagné;8,5;');
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(5);
  });
});

describe('import des résultats', () => {
  const connus = new Map([['2026-10-04-lyon-marseille', { match_id: '2026-10-04-lyon-marseille', coup_envoi: '2026-10-04T18:45:00Z', equipes: { domicile: { nom: 'Lyon' }, exterieur: { nom: 'Marseille' } } }]]);
  const bloc = (matchs) => `\`\`\`json\n${JSON.stringify({ type: 'resultats-matchs', matchs })}\n\`\`\``;

  it('relie le résultat à la fiche (noms rapprochés) et garde des buteurs cohérents', () => {
    const r = importerReponse(bloc([{ domicile: 'Olympique Lyonnais', exterieur: 'Olympique de Marseille', coup_envoi: '2026-10-04T18:45:00Z', statut: 'termine', score: '2-1', score_mt: '1-0', buteurs: [{ nom: 'A. Lacazette', equipe: 'D', minute: 12 }, { nom: 'X. Défenseur', equipe: 'E', minute: 70, csc: true }, { nom: 'M. Greenwood', equipe: 'E', minute: 80 }], source: 'https://x.test/r' }]), { maintenant: MAINTENANT, matchs: connus });
    expect(r.resultats).toHaveLength(1);
    expect(r.resultats[0]).toMatchObject({ match_id: '2026-10-04-lyon-marseille', score: '2-1', score_mt: '1-0', libelle: 'Lyon – Marseille' });
    expect(r.resultats[0].buteurs).toHaveLength(3);
  });

  it('écarte des buteurs incohérents avec le score, un résultat sans source ou pas terminé', () => {
    const r = importerReponse(bloc([
      { domicile: 'Lyon', exterieur: 'Marseille', coup_envoi: '2026-10-04T18:45:00Z', statut: 'termine', score: '2-1', score_mt: '3-0', buteurs: [{ nom: 'A', equipe: 'D' }], source: 'https://x.test/r' },
      { domicile: 'Nice', exterieur: 'Lens', coup_envoi: '2026-10-04T13:00:00Z', statut: 'termine', score: '1-0', source: null },
      { domicile: 'Brest', exterieur: 'Lorient', coup_envoi: '2026-10-04T15:00:00Z', statut: null, score: null, source: 'https://x.test/b' },
    ]), { maintenant: MAINTENANT, matchs: connus });
    expect(r.resultats).toHaveLength(1);
    expect(r.resultats[0]).toMatchObject({ score_mt: null, buteurs: null });
    const raisons = r.rapport.ecartes.map((e) => e.raison).join('\n');
    expect(raisons).toMatch(/mi-temps supérieur/);
    expect(raisons).toMatch(/buteurs incohérente/);
    expect(raisons).toMatch(/sans URL de source/);
    expect(raisons).toMatch(/pas encore terminé/);
  });

  it('prompt des résultats : score à 90 minutes, contre son camp, source', () => {
    const p = promptResultats([{ domicile: 'Lyon', exterieur: 'Marseille', coup_envoi: '2026-10-04T18:45:00Z' }]);
    expect(p).toContain('1. Lyon vs Marseille');
    expect(p).toContain('SANS prolongation ni tirs au but');
    expect(p).toContain('"type":"resultats-matchs"');
  });
});

describe('top picks', () => {
  const index = lireJSON('data/demo/index.json');
  const entrees = index.matchs.map((resume) => ({ resume, modele: lireJSON(`data/demo/modeles/${resume.match_id}.json`), dossier: 'demo' }));
  const picks = extrairePicks(entrees);

  it('ne garde que les paris suggérés par le modèle, du meilleur au moins bon', () => {
    const suggeres = entrees.flatMap((e) => e.modele.marches.filter((m) => m.suggere));
    expect(picks).toHaveLength(suggeres.length);
    expect(picks.map((p) => p.value)).toEqual([...picks.map((p) => p.value)].sort((a, b) => b - a));
    expect(picks.every((p) => p.demo)).toBe(true);
  });

  it('signale les paris liés (même match) et regroupe par marché', () => {
    for (const p of picks) expect(p.lies).toBe(picks.filter((q) => q.match_id === p.match_id).length - 1);
    const g = grouperPicks(picks);
    expect(g.map((x) => x.groupe)).toEqual(['total', 'mi_temps', 'buteur']);
    expect(g.reduce((s, x) => s + x.picks.length, 0)).toBe(picks.length);
  });
});

describe('alertes ntfy.sh', () => {
  it('valide et génère un nom de canal difficile à deviner', () => {
    expect(topicValide('apb-abc')).toBe(false);
    expect(topicValide('apb-7hx2kq9m4tzr5w8e')).toBe(true);
    expect(topicValide('avec espace et accents é')).toBe(false);
    const t = topicAleatoire();
    expect(topicValide(t)).toBe(true);
    expect(t).toMatch(/^apb-[a-z2-9]{18}$/);
  });

  it('construit l’URL d’envoi (titre, priorité, étiquettes en paramètres)', () => {
    const u = new URL(urlAlerte('apb-7hx2kq9m4tzr5w8e', { titre: '2 value bets', tags: ['soccer'], priorite: 3 }));
    expect(u.origin + u.pathname).toBe('https://ntfy.sh/apb-7hx2kq9m4tzr5w8e');
    expect(u.searchParams.get('title')).toBe('2 value bets');
    expect(u.searchParams.get('tags')).toBe('soccer');
  });

  it('envoie en POST et refuse un canal invalide', async () => {
    const appels = [];
    await envoyerAlerte('apb-7hx2kq9m4tzr5w8e', 'test', { titre: 'Test' }, async (url, init) => {
      appels.push({ url, init });
      return { ok: true };
    });
    expect(appels[0].init).toEqual({ method: 'POST', body: 'test' });
    await expect(envoyerAlerte('court', 'x', { titre: 't' }, async () => ({ ok: true }))).rejects.toThrow(/invalide/);
  });

  it('messages en français, avec rappel « pas des certitudes » et aide', () => {
    const a = alerteValueBets([{ libelle_match: 'Lyon – Marseille', heure: '20:45', libelle: 'Plus de 2,5 buts', cote: 2.05, value: 0.071, confiance: 72 }]);
    expect(a.titre).toBe('1 value bet — Analyse Paris Buts');
    expect(a.message).toContain('Lyon – Marseille (20:45) : Plus de 2,5 buts @2,05 — value 7,1 %, confiance 72/100');
    expect(a.message).toContain('pas des certitudes');
    expect(alerteLimite(['Stop-loss atteint']).message).toContain('joueurs-info-service.fr');
    const r = alerteResolution([{ libelle_match: 'Lyon – Marseille', libelle_marche: 'Plus de 2,5 buts', statut: 'gagne', gain: 10.2 }, { libelle_match: 'A – B', libelle_marche: 'Moins de 1,5 but', statut: 'perdu', gain: -5 }]);
    expect(r.message).toBe('• Lyon – Marseille — Plus de 2,5 buts : gagné (+10,20 €)\n• A – B — Moins de 1,5 but : perdu (−5,00 €)');
  });
});
