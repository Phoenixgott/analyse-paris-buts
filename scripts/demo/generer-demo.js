// Génère les 6 matchs de DÉMONSTRATION (équipes et joueurs fictifs, chiffres tirés au sort de
// façon reproductible). Ils servent à construire l'interface avant la collecte réelle et sont
// toujours marqués « DÉMO » (champ demo: true, source « DÉMO »).
// Usage : node scripts/demo/generer-demo.js
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { calculerQualite } from '../../schema/qualite.js';
import { construireIndex } from '../lib/index-jour.js';

const GENERE_LE = '2026-09-28T05:30:00Z';
const SOURCE_DEMO = { nom: 'DÉMO — données fictives (scripts/demo/generer-demo.js)', recupere_le: GENERE_LE };
const BOOKS = ['Book A', 'Book B', 'Book C'];
const NOMS = [
  'Morvan', 'Delacroix', 'Ferrand', 'Okonkwo', 'Lindqvist', 'Barreto', 'Castellan', 'Haddad', 'Vasseur',
  'Kowalczyk', 'Mendes', 'Aubert', 'Tanaka', 'Giraud', 'Solberg', 'Esposti', 'Ndiaye', 'Roussel', 'Varga',
  'Almeida', 'Keller', 'Duval', 'Petrov', 'Laurent', 'Oyelaran', 'Marchetti', 'Brennan', 'Fontaine',
  'Iglesias', 'Maalouf', 'Hoarau', 'Vidal', 'Strand', 'Colombo', 'Diallo', 'Renard', 'Sousa', 'Weber',
];
const INITIALES = 'ABCDEFGHJKLMNPRSTVY';

const MATCHS = [
  {
    id: 'demo-l1-valmont-rivebelle',
    graine: 11,
    competition: { id: 'demo-fr-l1', nom: 'Ligue 1', pays: 'France', categorie: 'H', palier: 1 },
    coup_envoi: '2026-09-28T18:45:00Z',
    stade: { nom: 'Stade des Forges', ville: 'Valmont' },
    enjeu: 'Haut de tableau : le 3e reçoit le 5e.',
    joues: 7,
    dom: { nom: 'Olympique de Valmont', att: 1.8, def: 0.9, rang: 3, elo: 1712, repos: 6 },
    ext: { nom: 'FC Rivebelle', att: 1.5, def: 1.25, rang: 5, elo: 1668, repos: 3 },
    arbitre: { nom: 'P. Lemarchand', cartons_moy: 4.1, penaltys_moy: 0.31 },
    meteo: { temperature: 14, vent: 12, pluie: 0 },
    sans: [],
  },
  {
    id: 'demo-pl-ashford-kingsbridge',
    graine: 23,
    competition: { id: 'demo-en-pl', nom: 'Premier League', pays: 'Angleterre', categorie: 'H', palier: 1 },
    coup_envoi: '2026-09-28T19:00:00Z',
    stade: { nom: 'Riverside Park', ville: 'Ashford' },
    enjeu: 'Milieu de tableau, deux équipes à 2 points d’écart.',
    joues: 6,
    dom: { nom: 'Ashford Rovers', att: 1.55, def: 1.35, rang: 9, elo: 1745, repos: 7 },
    ext: { nom: 'Kingsbridge United', att: 1.7, def: 1.4, rang: 7, elo: 1760, repos: 4 },
    arbitre: { nom: 'D. Whitmore', cartons_moy: 3.6, penaltys_moy: 0.27 },
    meteo: null,
    sans: ['xg', 'meteo'],
  },
  {
    id: 'demo-sa-montecolle-valdoro',
    graine: 37,
    competition: { id: 'demo-it-sa', nom: 'Serie A', pays: 'Italie', categorie: 'H', palier: 1 },
    coup_envoi: '2026-09-28T16:30:00Z',
    stade: { nom: 'Stadio del Colle', ville: 'Montecolle' },
    enjeu: 'Lutte pour le maintien : 16e contre 18e.',
    joues: 6,
    dom: { nom: 'AC Montecolle', att: 1.0, def: 1.3, rang: 16, elo: 1590, repos: 7 },
    ext: { nom: 'Sporting Valdoro', att: 0.9, def: 1.5, rang: 18, elo: 1561, repos: 7 },
    arbitre: { nom: 'L. Benedetti', cartons_moy: null, penaltys_moy: null },
    meteo: null,
    sans: ['xg', 'meteo', 'compo', 'cotes_buteur'],
  },
  {
    id: 'demo-d1f-montaval-clairefont',
    graine: 41,
    competition: { id: 'demo-fr-d1f', nom: 'D1 féminine', pays: 'France', categorie: 'F', palier: 1 },
    coup_envoi: '2026-09-28T13:00:00Z',
    stade: { nom: 'Stade Jean-Brunet', ville: 'Montaval' },
    enjeu: 'Choc en tête : les deux équipes sont invaincues.',
    joues: 4,
    dom: { nom: 'Stade Montaval', att: 2.3, def: 0.7, rang: 1, elo: null, repos: 7 },
    ext: { nom: 'AS Clairefont', att: 2.0, def: 0.8, rang: 2, elo: null, repos: 7 },
    arbitre: { nom: 'C. Rigaud', cartons_moy: null, penaltys_moy: null },
    meteo: null,
    sans: ['xg', 'elo', 'meteo', 'compo', 'cotes_buteur', 'cotes_mt', 'minutes'],
  },
  {
    id: 'demo-int-nordalie-valdoranie',
    graine: 53,
    competition: { id: 'demo-int-ldn', nom: 'Ligue des nations', pays: 'International', categorie: 'INT', palier: 1 },
    coup_envoi: '2026-09-28T18:45:00Z',
    stade: { nom: 'Stade national', ville: 'Nordhavn' },
    enjeu: null,
    joues: null,
    dom: { nom: 'Nordalie', att: 1.4, def: 1.0, rang: null, elo: 1655, repos: 3 },
    ext: { nom: 'Valdoranie', att: 1.1, def: 1.3, rang: null, elo: 1598, repos: 3 },
    arbitre: null,
    meteo: { temperature: 9, vent: 24, pluie: 1.2 },
    sans: ['classement', 'xg', 'compo', 'arbitre', 'cotes_buteur', 'cotes_mt', 'enjeu', 'h2h', 'absents', 'buteurs'],
  },
  {
    id: 'demo-no-fjellby-havnstad',
    graine: 67,
    competition: { id: 'demo-no-d3', nom: '2. divisjon', pays: 'Norvège', categorie: 'H', palier: 2 },
    coup_envoi: '2026-09-28T11:00:00Z',
    stade: { nom: 'Fjellby kunstgress', ville: 'Fjellby' },
    enjeu: null,
    joues: 22,
    dom: { nom: 'Fjellby IL', att: 1.6, def: 1.5, rang: 8, elo: null, repos: null },
    ext: { nom: 'Havnstad FK', att: 1.4, def: 1.7, rang: 11, elo: null, repos: null },
    arbitre: null,
    meteo: null,
    formeMax: 3,
    sans: ['stats', 'xg', 'elo', 'meteo', 'arbitre', 'compo', 'absents', 'repos', 'mt', 'h2h', 'buteurs', 'cotes', 'enjeu'],
  },
];

// --- Hasard reproductible -------------------------------------------------------------------
function mulberry32(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (x) => Math.round(x * 100) / 100;

function poisson(alea, lambda) {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= alea();
  } while (p > l);
  return k - 1;
}

function binomiale(alea, n, p) {
  let k = 0;
  for (let i = 0; i < n; i++) if (alea() < p) k++;
  return k;
}

function probaPoissonSup(lambda, seuil) {
  // P(X > seuil) pour X ~ Poisson(lambda), seuil entier.
  let cumul = 0;
  let terme = Math.exp(-lambda);
  for (let k = 0; k <= seuil; k++) {
    cumul += terme;
    terme *= lambda / (k + 1);
  }
  return 1 - cumul;
}

function decalerDate(iso, jours) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - jours);
  return d.toISOString().slice(0, 10);
}

// --- Construction d'un match ----------------------------------------------------------------
function construire(cfg) {
  const alea = mulberry32(cfg.graine);
  const sans = new Set(cfg.sans);
  const choisir = (liste) => liste[Math.floor(alea() * liste.length)];
  const nomJoueur = () => `${choisir(INITIALES)}. ${choisir(NOMS)}`;
  const adversaires = Array.from({ length: 12 }, (_, i) => `Adversaire fictif ${String.fromCharCode(65 + i)}`);

  function equipe(e, cote) {
    const forme = [];
    let date = decalerDate(cfg.coup_envoi, e.repos ?? 7);
    for (let i = 0; i < Math.min(cfg.formeMax ?? 10, 10); i++) {
      const pour = poisson(alea, e.att * (i % 2 === 0 ? 1.05 : 0.95));
      const contre = poisson(alea, e.def);
      const pourMt = binomiale(alea, pour, 0.44);
      const contreMt = binomiale(alea, contre, 0.44);
      forme.push({
        date,
        adversaire: choisir(adversaires),
        lieu: i % 2 === 0 ? 'D' : 'E',
        score: `${pour}-${contre}`,
        score_mt: sans.has('mt') ? null : `${pourMt}-${contreMt}`,
        // Donnée interne au générateur (retirée plus bas) : l'équipe a-t-elle marqué avant la 30e ?
        _avant30: pourMt > 0 && alea() < 1 - (1 / 3) ** pourMt,
      });
      date = decalerDate(date, 7);
    }

    const saison = cfg.joues ? forme.slice(0, Math.min(cfg.joues, forme.length)) : forme;
    const buts = saison.map((m) => m.score.split('-').map(Number));
    const butsMt = saison.map((m) => (m.score_mt ?? '0-0').split('-').map(Number));
    const n = saison.length;
    const moy = (valeurs) => r2(valeurs.reduce((a, b) => a + b, 0) / n);
    const pctTotal = (seuil) => Math.round((100 * buts.filter(([p, c]) => p + c > seuil).length) / n);

    const bp = buts.reduce((s, [p]) => s + p, 0);
    const bc = buts.reduce((s, [, c]) => s + c, 0);
    const points = buts.reduce((s, [p, c]) => s + (p > c ? 3 : p === c ? 1 : 0), 0);
    // Au-delà des 10 matchs de forme (palier 2, 22 journées), le classement est extrapolé.
    const facteur = cfg.joues && cfg.joues > n ? cfg.joues / n : 1;

    const stats = sans.has('stats')
      ? null
      : {
          buts_marques_moy: moy(buts.map(([p]) => p)),
          buts_encaisses_moy: moy(buts.map(([, c]) => c)),
          buts_mt_marques_moy: sans.has('mt') ? null : moy(butsMt.map(([p]) => p)),
          buts_mt_encaisses_moy: sans.has('mt') ? null : moy(butsMt.map(([, c]) => c)),
          xg_moy: sans.has('xg') ? null : r2(moy(buts.map(([p]) => p)) * (0.85 + alea() * 0.3)),
          tirs_cadres_moy: r2(2.2 + e.att * 1.9 + alea()),
          pct_over15: pctTotal(1),
          pct_over25: pctTotal(2),
          pct_over35: pctTotal(3),
          pct_but_avant_30: Math.round((100 * saison.filter((m) => m._avant30).length) / n),
        };

    const absents = sans.has('absents')
      ? null
      : Array.from({ length: Math.floor(alea() * 3) }, () => ({
          nom: nomJoueur(),
          raison: choisir(['Blessure (cuisse)', 'Suspension', 'Blessure (genou)', 'Incertain', null]),
        }));

    return {
      id: `${cfg.id}-${cote}`,
      nom: e.nom,
      elo: sans.has('elo') ? null : e.elo,
      classement: sans.has('classement')
        ? null
        : {
            rang: e.rang,
            points: Math.round(points * facteur),
            joues: cfg.joues,
            bp: Math.round(bp * facteur),
            bc: Math.round(bc * facteur),
          },
      forme: forme.map(({ _avant30, ...m }) => m),
      stats,
      jours_repos: sans.has('repos') ? null : e.repos,
      absents,
      compo_probable: sans.has('compo') ? null : Array.from({ length: 11 }, nomJoueur),
    };
  }

  const domicile = equipe(cfg.dom, 'd');
  const exterieur = equipe(cfg.ext, 'e');

  const h2h = sans.has('h2h')
    ? null
    : Array.from({ length: 6 }, (_, i) => {
        const d = poisson(alea, (cfg.dom.att + cfg.ext.def) / 2);
        const x = poisson(alea, (cfg.ext.att + cfg.dom.def) / 2);
        return {
          date: decalerDate(cfg.coup_envoi, 150 + i * 190 + Math.floor(alea() * 20)),
          score: `${d}-${x}`,
          score_mt: `${binomiale(alea, d, 0.44)}-${binomiale(alea, x, 0.44)}`,
        };
      });

  function joueurs(cote) {
    const profils = [
      { b90: 0.45 + alea() * 0.25, t90: 2.6 + alea(), pen: true, cpa: false, min: 85 },
      { b90: 0.25 + alea() * 0.15, t90: 1.8 + alea() * 0.8, pen: false, cpa: false, min: 75 },
      { b90: 0.12 + alea() * 0.12, t90: 1.1 + alea() * 0.6, pen: false, cpa: true, min: 88 },
    ];
    return profils.map((p) => ({
      nom: nomJoueur(),
      equipe: cote,
      buts_par_90: r2(p.b90),
      tirs_par_90: r2(p.t90),
      tireur_penalty: p.pen,
      coups_de_pied_arretes: p.cpa,
      minutes_prevues: sans.has('minutes') ? null : p.min,
    }));
  }
  const buteurs = sans.has('buteurs') ? null : [...joueurs('D'), ...joueurs('E')];

  function cote(proba, marge) {
    const meilleure = Math.max(1.01, r2(1 / (proba * (1 + marge))));
    const ouverture = Math.max(1.01, r2(meilleure * (0.95 + alea() * 0.1)));
    return { meilleure, bookmaker: choisir(BOOKS), ouverture, mouvement: r2(meilleure - ouverture) };
  }

  let cotes = null;
  if (!sans.has('cotes')) {
    const lambda = (cfg.dom.att + cfg.ext.def) / 2 + (cfg.ext.att + cfg.dom.def) / 2;
    const total = {};
    for (let k = 0; k <= 5; k++) {
      const pOver = probaPoissonSup(lambda, k);
      total[`over_${k}_5`] = cote(pOver, 0.035);
      total[`under_${k}_5`] = cote(1 - pOver, 0.035);
    }
    const ordre = [0, 1, 2, 3, 4, 5].flatMap((k) => [`over_${k}_5`]).concat([0, 1, 2, 3, 4, 5].map((k) => `under_${k}_5`));
    cotes = {
      total_buts: Object.fromEntries(ordre.map((c) => [c, total[c]])),
      mt_over_0_5: sans.has('cotes_mt') ? null : cote(probaPoissonSup(lambda * 0.44, 0), 0.05),
      mt_over_1_5: sans.has('cotes_mt') ? null : cote(probaPoissonSup(lambda * 0.44, 1), 0.05),
      buteur:
        sans.has('cotes_buteur') || !buteurs
          ? null
          : buteurs.map((b) => ({
              nom: b.nom,
              equipe: b.equipe,
              cote: cote(1 - Math.exp(-b.buts_par_90 * ((b.minutes_prevues ?? 80) / 90)), 0.15),
            })),
    };
  }

  const match = {
    schema_version: '1.0.0',
    demo: true,
    match_id: cfg.id,
    generated_at: GENERE_LE,
    competition: cfg.competition,
    coup_envoi: cfg.coup_envoi,
    stade: sans.has('stade') ? null : cfg.stade,
    enjeu: sans.has('enjeu') ? null : cfg.enjeu,
    equipes: { domicile, exterieur },
    h2h,
    arbitre: sans.has('arbitre') ? null : cfg.arbitre,
    meteo: sans.has('meteo') ? null : cfg.meteo,
    buteurs,
    cotes,
    qualite_donnees: 0,
    sources: [SOURCE_DEMO],
  };
  match.qualite_donnees = calculerQualite(match);
  return match;
}

// --- Écriture -------------------------------------------------------------------------------
const dossier = 'data/demo';
rmSync(dossier, { recursive: true, force: true });
mkdirSync(`${dossier}/matchs`, { recursive: true });

const matchs = MATCHS.map(construire);
for (const m of matchs) {
  writeFileSync(`${dossier}/matchs/${m.match_id}.json`, `${JSON.stringify(m, null, 2)}\n`);
}
writeFileSync(
  `${dossier}/index.json`,
  `${JSON.stringify(construireIndex(matchs, { date: GENERE_LE.slice(0, 10), demo: true, genereLe: GENERE_LE }), null, 2)}\n`,
);

// Index général : conserve la liste des jours réels déjà collectés.
const cheminIndex = 'data/index.json';
const general = existsSync(cheminIndex) ? JSON.parse(readFileSync(cheminIndex, 'utf8')) : { jours: [] };
writeFileSync(cheminIndex, `${JSON.stringify({ jours: general.jours ?? [], demo: 'demo' }, null, 2)}\n`);

for (const m of matchs) console.log(`${m.match_id} : qualité ${m.qualite_donnees}/100`);
