// Génère les 6 matchs de DÉMONSTRATION (équipes, joueurs et chiffres fictifs, tirés au sort de façon
// reproductible) et, pour 4 d'entre eux, l'historique fictif de leur ligue (2 saisons + début de la
// saison en cours) dont sont DÉRIVÉS forme, stats, classement, face-à-face et enjeu : les données
// d'un match sont ainsi cohérentes avec l'historique que lit le modèle.
// Tout est marqué « DÉMO » (champ demo: true, source « DÉMO »).
// Usage : node scripts/demo/generer-demo.js
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { calculerQualite } from '../../schema/qualite.js';
import { grilleScores } from '../../modele/grille.js';
import { calculerJournee } from '../lib/modeles-jour.js';

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

const LIGUES = {
  'demo-fr-l1': {
    m: Math.log(1.35), h: 0.22, debuts: ['2024-08-10', '2025-08-09', '2026-08-08'],
    autres: ['AS Castelnau', 'Stade Brévannes', 'FC Montreval', 'US Belcourt', 'Racing Sarlande', 'SC Aubrac', 'Olympique Lorvilliers', 'AC Pontferrand', 'FC Vireuil', 'Stade Mérignol', 'US Carmaux-Vallée', 'AS Durandeau', 'FC Saint-Aubrin', 'Sporting Lanvaux', 'Stade Orbelin', 'RC Chabeuil'],
  },
  'demo-en-pl': {
    m: Math.log(1.45), h: 0.2, debuts: ['2024-08-17', '2025-08-16', '2026-08-15'],
    autres: ['Harrowgate Athletic', 'Millbrook City', 'Stanford Albion', 'Wexley Town', 'Eastmoor Wanderers', 'Castleford Park', 'Redcliffe United', 'Northam Forest', 'Bramwell City', 'Ashcombe Town', 'Leyton Vale', 'Burnside Rovers', 'Holloway Athletic', 'Pembridge County', 'Southcote Albion', 'Marlow Heath'],
  },
  'demo-it-sa': {
    m: Math.log(1.3), h: 0.24, debuts: ['2024-08-17', '2025-08-16', '2026-08-15'],
    autres: ['US Valdarno', 'AC Rocca Alta', 'Calcio Pietrabianca', 'SS Monteverde', 'FC Torrelunga', 'AS Borgo San Vito', 'US Castelmare', 'AC Serravalle', 'Virtus Lagorosso', 'FC Villanova Sud', 'SS Portonuovo', 'AC Colle Alto', 'US Fontebella', 'Calcio Marinella', 'AS Grottarossa', 'FC Ponte Scuro'],
  },
  'demo-fr-d1f': {
    m: Math.log(1.45), h: 0.15, debuts: ['2024-09-07', '2025-09-06', '2026-08-29'],
    autres: ['FC Lunéville-Est', 'AS Brocéliande', 'Stade Valbonne', 'US Mireval', 'Olympique Tarnais', 'FC Rochebrune', 'AS Belmontais', 'Racing Vauclair', 'Stade Corbières', 'US Aigueblanche'],
  },
};

const MATCHS = [
  {
    id: 'demo-l1-valmont-rivebelle', graine: 11,
    competition: { id: 'demo-fr-l1', nom: 'Ligue 1', pays: 'France', categorie: 'H', palier: 1 },
    coup_envoi: '2026-09-28T18:45:00Z',
    stade: { nom: 'Stade des Forges', ville: 'Valmont' },
    joues: 7,
    dom: { nom: 'Olympique de Valmont', att: 1.85, def: 0.9, elo: 1712 },
    ext: { nom: 'FC Rivebelle', att: 1.55, def: 1.2, elo: 1668 },
    arbitre: { nom: 'P. Lemarchand', cartons_moy: 4.1, penaltys_moy: 0.31 },
    meteo: { temperature: 14, vent: 12, pluie: 0 },
    sans: [],
  },
  {
    id: 'demo-pl-ashford-kingsbridge', graine: 23,
    competition: { id: 'demo-en-pl', nom: 'Premier League', pays: 'Angleterre', categorie: 'H', palier: 1 },
    coup_envoi: '2026-09-28T19:00:00Z',
    stade: { nom: 'Riverside Park', ville: 'Ashford' },
    joues: 6,
    dom: { nom: 'Ashford Rovers', att: 1.6, def: 1.35, elo: 1745 },
    ext: { nom: 'Kingsbridge United', att: 1.75, def: 1.4, elo: 1760 },
    arbitre: { nom: 'D. Whitmore', cartons_moy: 3.6, penaltys_moy: 0.27 },
    meteo: null,
    sans: ['xg', 'meteo'],
  },
  {
    id: 'demo-sa-montecolle-valdoro', graine: 37,
    competition: { id: 'demo-it-sa', nom: 'Serie A', pays: 'Italie', categorie: 'H', palier: 1 },
    coup_envoi: '2026-09-28T16:30:00Z',
    stade: { nom: 'Stadio del Colle', ville: 'Montecolle' },
    joues: 6,
    dom: { nom: 'AC Montecolle', att: 1.0, def: 1.3, elo: 1590 },
    ext: { nom: 'Sporting Valdoro', att: 0.9, def: 1.5, elo: 1561 },
    arbitre: { nom: 'L. Benedetti', cartons_moy: null, penaltys_moy: null },
    meteo: null,
    sans: ['xg', 'meteo', 'compo', 'cotes_buteur'],
  },
  {
    id: 'demo-d1f-montaval-clairefont', graine: 41,
    competition: { id: 'demo-fr-d1f', nom: 'D1 féminine', pays: 'France', categorie: 'F', palier: 1 },
    coup_envoi: '2026-09-28T13:00:00Z',
    stade: { nom: 'Stade Jean-Brunet', ville: 'Montaval' },
    joues: 4,
    dom: { nom: 'Stade Montaval', att: 2.3, def: 0.7, elo: null },
    ext: { nom: 'AS Clairefont', att: 2.0, def: 0.8, elo: null },
    arbitre: { nom: 'C. Rigaud', cartons_moy: null, penaltys_moy: null },
    meteo: null,
    sans: ['xg', 'elo', 'meteo', 'compo', 'cotes_buteur', 'cotes_mt', 'minutes'],
  },
  {
    // Sans historique de ligue : le modèle se rabat sur la forme des deux sélections.
    id: 'demo-int-nordalie-valdoranie', graine: 53,
    competition: { id: 'demo-int-ldn', nom: 'Ligue des nations', pays: 'International', categorie: 'INT', palier: 1 },
    coup_envoi: '2026-09-28T18:45:00Z',
    stade: { nom: 'Stade national', ville: 'Nordhavn' },
    dom: { nom: 'Nordalie', att: 1.4, def: 1.0, elo: 1655, repos: 3 },
    ext: { nom: 'Valdoranie', att: 1.1, def: 1.3, elo: 1598, repos: 3 },
    classement: null,
    arbitre: null,
    meteo: { temperature: 9, vent: 24, pluie: 1.2 },
    sans: ['xg', 'compo', 'arbitre', 'cotes_buteur', 'cotes_mt', 'enjeu', 'h2h', 'absents', 'buteurs'],
  },
  {
    // Palier 2, presque sans données : match non fiable.
    id: 'demo-no-fjellby-havnstad', graine: 67,
    competition: { id: 'demo-no-d3', nom: '2. divisjon', pays: 'Norvège', categorie: 'H', palier: 2 },
    coup_envoi: '2026-09-28T11:00:00Z',
    stade: { nom: 'Fjellby kunstgress', ville: 'Fjellby' },
    dom: { nom: 'Fjellby IL', att: 1.6, def: 1.5, elo: null, repos: null, classement: { rang: 8, points: 31, joues: 22, bp: 38, bc: 36 } },
    ext: { nom: 'Havnstad FK', att: 1.4, def: 1.7, elo: null, repos: null, classement: { rang: 11, points: 26, joues: 22, bp: 31, bc: 39 } },
    arbitre: null,
    meteo: null,
    formeMax: 3,
    sans: ['stats', 'xg', 'elo', 'meteo', 'arbitre', 'compo', 'absents', 'mt', 'h2h', 'buteurs', 'cotes', 'enjeu'],
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
const normale = (alea) => Math.sqrt(-2 * Math.log(1 - alea())) * Math.cos(2 * Math.PI * alea());

function poissonTirage(alea, lambda) {
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

function tirerScore(alea, grille) {
  let u = alea();
  for (let x = 0; x < grille.length; x++) {
    for (let y = 0; y < grille.length; y++) {
      u -= grille[x][y];
      if (u <= 0) return [x, y];
    }
  }
  return [0, 0];
}

function probaPoissonSup(lambda, seuil) {
  let cumul = 0;
  let terme = Math.exp(-lambda);
  for (let k = 0; k <= seuil; k++) {
    cumul += terme;
    terme *= lambda / (k + 1);
  }
  return 1 - cumul;
}

/** Date AAAA-MM-JJ décalée de `jours` (négatif = dans le passé). */
function decalerDate(iso, jours) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

const joursEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

// --- Ligue fictive --------------------------------------------------------------------------
function simulerLigue(cfg, alea) {
  const ligue = LIGUES[cfg.competition.id];
  const g = Math.exp(ligue.m);
  const noms = [cfg.dom.nom, cfg.ext.nom, ...ligue.autres];
  const n = noms.length;
  const att = noms.map((_, i) => (i === 0 ? Math.log(cfg.dom.att / g) : i === 1 ? Math.log(cfg.ext.att / g) : 0.2 * normale(alea)));
  const def = noms.map((_, i) => (i === 0 ? Math.log(cfg.dom.def / g) : i === 1 ? Math.log(cfg.ext.def / g) : 0.2 * normale(alea)));

  // Calendrier aller (méthode du cercle), puis retour inversé.
  const journees = [];
  const rotation = [...Array(n).keys()];
  for (let j = 0; j < n - 1; j++) {
    const paires = [];
    for (let k = 0; k < n / 2; k++) paires.push(j % 2 === 0 ? [rotation[k], rotation[n - 1 - k]] : [rotation[n - 1 - k], rotation[k]]);
    journees.push(paires);
    rotation.splice(1, 0, rotation.pop());
  }
  // Saison en cours : la journée où se croisent les deux équipes de démo est celle d'aujourd'hui,
  // placée juste après les journées déjà jouées.
  const iCroisement = journees.findIndex((p) => p.some(([a, b]) => (a === 0 && b === 1) || (a === 1 && b === 0)));
  const encours = journees.filter((_, i) => i !== iCroisement);

  const matchs = [];
  const jouer = (i, j, date) => {
    const lambda = Math.exp(ligue.m + ligue.h + att[i] + def[j]);
    const mu = Math.exp(ligue.m + att[j] + def[i]);
    const [x, y] = tirerScore(alea, grilleScores(lambda, mu, -0.08, 10));
    const xm = binomiale(alea, x, 0.45);
    const ym = binomiale(alea, y, 0.45);
    // Minute des buts de 1re MT (uniforme 1-45) : sert au « but avant la 30e ».
    const avant30 = (k) => Array.from({ length: k }, () => 1 + Math.floor(alea() * 45)).some((min) => min < 30);
    matchs.push({ date, i, j, x, y, xm, ym, a30d: avant30(xm), a30e: avant30(ym) });
  };

  ligue.debuts.forEach((debut, s) => {
    const courante = s === ligue.debuts.length - 1;
    const calendrier = courante ? encours.slice(0, cfg.joues) : [...journees, ...journees.map((p) => p.map(([a, b]) => [b, a]))];
    calendrier.forEach((paires, r) => {
      for (const [a, b] of paires) jouer(a, b, decalerDate(debut, 7 * r));
    });
  });

  return {
    noms,
    matchs,
    vraiesForces: { m: ligue.m, h: ligue.h, att, def },
    fichier: {
      competition_id: cfg.competition.id,
      nom: cfg.competition.nom,
      demo: true,
      maj: GENERE_LE,
      matchs: matchs.map((m) => ({ date: m.date, domicile: noms[m.i], exterieur: noms[m.j], score: `${m.x}-${m.y}`, score_mt: `${m.xm}-${m.ym}` })),
    },
  };
}

function classementLigue(sim, saisonDebut) {
  const table = sim.noms.map((nom, t) => ({ t, nom, points: 0, joues: 0, bp: 0, bc: 0 }));
  for (const m of sim.matchs.filter((x) => x.date >= saisonDebut)) {
    const d = table[m.i];
    const e = table[m.j];
    d.joues++;
    e.joues++;
    d.bp += m.x;
    d.bc += m.y;
    e.bp += m.y;
    e.bc += m.x;
    if (m.x > m.y) d.points += 3;
    else if (m.x < m.y) e.points += 3;
    else {
      d.points++;
      e.points++;
    }
  }
  table.sort((a, b) => b.points - a.points || b.bp - b.bc - (a.bp - a.bc) || b.bp - a.bp || a.nom.localeCompare(b.nom));
  table.forEach((ligne, k) => (ligne.rang = k + 1));
  return new Map(table.map((l) => [l.t, l]));
}

function enjeuDepuisRangs(rd, re, n) {
  if (rd <= 2 && re <= 2) return `Choc en tête : le ${rd === 1 ? '1er' : `${rd}e`} reçoit le ${re === 1 ? '1er' : `${re}e`}.`;
  const texte = `le ${rd === 1 ? '1er' : `${rd}e`} reçoit le ${re === 1 ? '1er' : `${re}e`}`;
  if (rd <= 5 && re <= 5) return `Haut de tableau : ${texte}.`;
  if (rd > n - 5 && re > n - 5) return `Lutte pour le maintien : ${texte}.`;
  return `Milieu de tableau : ${texte}.`;
}

// --- Construction d'un match ----------------------------------------------------------------
function construire(cfg) {
  const alea = mulberry32(cfg.graine);
  const sans = new Set(cfg.sans);
  const choisir = (liste) => liste[Math.floor(alea() * liste.length)];
  const nomJoueur = () => `${choisir(INITIALES)}. ${choisir(NOMS)}`;
  const jour = cfg.coup_envoi.slice(0, 10);

  const sim = LIGUES[cfg.competition.id] ? simulerLigue(cfg, alea) : null;
  const classement = sim ? classementLigue(sim, LIGUES[cfg.competition.id].debuts.at(-1)) : null;

  function statsDepuis(saison) {
    if (sans.has('stats') || saison.length === 0) return null;
    const n = saison.length;
    const moy = (f) => r2(saison.reduce((s, m) => s + f(m), 0) / n);
    const pct = (f) => Math.round((100 * saison.filter(f).length) / n);
    return {
      buts_marques_moy: moy((m) => m.pour),
      buts_encaisses_moy: moy((m) => m.contre),
      buts_mt_marques_moy: sans.has('mt') ? null : moy((m) => m.pourMt),
      buts_mt_encaisses_moy: sans.has('mt') ? null : moy((m) => m.contreMt),
      xg_moy: sans.has('xg') ? null : r2(moy((m) => m.pour) * (0.85 + alea() * 0.3)),
      tirs_cadres_moy: r2(2.2 + moy((m) => m.pour) * 1.9 + alea()),
      pct_over15: pct((m) => m.pour + m.contre > 1),
      pct_over25: pct((m) => m.pour + m.contre > 2),
      pct_over35: pct((m) => m.pour + m.contre > 3),
      pct_but_avant_30: pct((m) => m.avant30),
    };
  }

  function absentsEtCompo(eq) {
    return {
      absents: sans.has('absents')
        ? null
        : Array.from({ length: Math.floor(alea() * 3) }, () => ({
            nom: nomJoueur(),
            raison: choisir(['Blessure (cuisse)', 'Suspension', 'Blessure (genou)', 'Incertain', null]),
          })),
      compo_probable: sans.has('compo') ? null : Array.from({ length: 11 }, nomJoueur),
      elo: sans.has('elo') ? null : eq.elo,
    };
  }

  // Équipe issue de la ligue simulée : tout est dérivé des matchs simulés.
  function equipeDeLigue(t, eq, cote) {
    const vus = sim.matchs
      .filter((m) => m.i === t || m.j === t)
      .map((m) => {
        const dom = m.i === t;
        return {
          date: m.date,
          adversaire: sim.noms[dom ? m.j : m.i],
          lieu: dom ? 'D' : 'E',
          pour: dom ? m.x : m.y,
          contre: dom ? m.y : m.x,
          pourMt: dom ? m.xm : m.ym,
          contreMt: dom ? m.ym : m.xm,
          avant30: dom ? m.a30d : m.a30e,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    const saison = vus.filter((m) => m.date >= LIGUES[cfg.competition.id].debuts.at(-1));
    const c = classement.get(t);
    const ac = absentsEtCompo(eq);
    return {
      id: `${cfg.id}-${cote}`,
      nom: eq.nom,
      elo: ac.elo,
      classement: sans.has('classement') ? null : { rang: c.rang, points: c.points, joues: c.joues, bp: c.bp, bc: c.bc },
      forme: vus.slice(0, 10).map((m) => ({ date: m.date, adversaire: m.adversaire, lieu: m.lieu, score: `${m.pour}-${m.contre}`, score_mt: sans.has('mt') ? null : `${m.pourMt}-${m.contreMt}` })),
      stats: statsDepuis(saison),
      jours_repos: sans.has('repos') ? null : joursEntre(vus[0].date, jour),
      absents: ac.absents,
      compo_probable: ac.compo_probable,
    };
  }

  // Équipe sans ligue simulée (sélections, palier 2) : forme contre des adversaires fictifs.
  function equipeLibre(eq, cote) {
    const vus = [];
    let date = decalerDate(jour, -(eq.repos ?? 7));
    for (let i = 0; i < Math.min(cfg.formeMax ?? 10, 10); i++) {
      const pour = poissonTirage(alea, eq.att);
      const contre = poissonTirage(alea, eq.def);
      const pourMt = binomiale(alea, pour, 0.45);
      vus.push({ date, adversaire: `Adversaire fictif ${String.fromCharCode(65 + Math.floor(alea() * 12))}`, lieu: i % 2 === 0 ? 'D' : 'E', pour, contre, pourMt, contreMt: binomiale(alea, contre, 0.45), avant30: pourMt > 0 && alea() < 1 - (1 / 3) ** pourMt });
      date = decalerDate(date, -30);
    }
    const ac = absentsEtCompo(eq);
    return {
      id: `${cfg.id}-${cote}`,
      nom: eq.nom,
      elo: ac.elo,
      classement: sans.has('classement') ? null : eq.classement ?? null,
      forme: vus.map((m) => ({ date: m.date, adversaire: m.adversaire, lieu: m.lieu, score: `${m.pour}-${m.contre}`, score_mt: sans.has('mt') ? null : `${m.pourMt}-${m.contreMt}` })),
      stats: statsDepuis(vus),
      jours_repos: sans.has('repos') ? null : eq.repos ?? null,
      absents: ac.absents,
      compo_probable: ac.compo_probable,
    };
  }

  const domicile = sim ? equipeDeLigue(0, cfg.dom, 'd') : equipeLibre(cfg.dom, 'd');
  const exterieur = sim ? equipeDeLigue(1, cfg.ext, 'e') : equipeLibre(cfg.ext, 'e');

  const h2h =
    sans.has('h2h') || !sim
      ? null
      : sim.matchs
          .filter((m) => (m.i === 0 && m.j === 1) || (m.i === 1 && m.j === 0))
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 10)
          .map((m) => (m.i === 0 ? { date: m.date, score: `${m.x}-${m.y}`, score_mt: `${m.xm}-${m.ym}` } : { date: m.date, score: `${m.y}-${m.x}`, score_mt: `${m.ym}-${m.xm}` }));

  const enjeu = sans.has('enjeu') || !classement ? null : enjeuDepuisRangs(classement.get(0).rang, classement.get(1).rang, sim.noms.length);

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
    // « Marché » fictif : les vraies forces de la simulation, avec une erreur d'environ 5 % par équipe.
    let lambdaD;
    let lambdaE;
    if (sim) {
      const f = sim.vraiesForces;
      lambdaD = Math.exp(f.m + f.h + f.att[0] + f.def[1]);
      lambdaE = Math.exp(f.m + f.att[1] + f.def[0]);
    } else {
      lambdaD = (cfg.dom.att + cfg.ext.def) / 2;
      lambdaE = (cfg.ext.att + cfg.dom.def) / 2;
    }
    lambdaD *= 1 + 0.05 * normale(alea);
    lambdaE *= 1 + 0.05 * normale(alea);
    const lambda = lambdaD + lambdaE;
    const total = {};
    for (let k = 0; k <= 5; k++) total[`over_${k}_5`] = cote(probaPoissonSup(lambda, k), 0.035);
    for (let k = 0; k <= 5; k++) total[`under_${k}_5`] = cote(1 - probaPoissonSup(lambda, k), 0.035);
    cotes = {
      total_buts: total,
      mt_over_0_5: sans.has('cotes_mt') ? null : cote(probaPoissonSup(lambda * 0.45, 0), 0.05),
      mt_over_1_5: sans.has('cotes_mt') ? null : cote(probaPoissonSup(lambda * 0.45, 1), 0.05),
      buteur:
        sans.has('cotes_buteur') || !buteurs
          ? null
          : buteurs.map((b) => ({ nom: b.nom, equipe: b.equipe, cote: cote(1 - Math.exp(-b.buts_par_90 * ((b.minutes_prevues ?? 80) / 90)), 0.15) })),
    };
  }

  const match = {
    schema_version: '1.0.0',
    demo: true,
    match_id: cfg.id,
    generated_at: GENERE_LE,
    competition: cfg.competition,
    coup_envoi: cfg.coup_envoi,
    stade: cfg.stade,
    enjeu,
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
  return { match, ligue: sim?.fichier ?? null };
}

// --- Écriture -------------------------------------------------------------------------------
const dossier = 'data/demo';
rmSync(dossier, { recursive: true, force: true });
mkdirSync(`${dossier}/matchs`, { recursive: true });
mkdirSync(`${dossier}/ligues`, { recursive: true });

const ecrire = (chemin, objet) => writeFileSync(chemin, `${JSON.stringify(objet, null, 2)}\n`);
for (const { match, ligue } of MATCHS.map(construire)) {
  ecrire(`${dossier}/matchs/${match.match_id}.json`, match);
  if (ligue) ecrire(`${dossier}/ligues/${ligue.competition_id}.json`, ligue);
}

// Modèle + index du jour (même chaîne que pour les données réelles).
const bilan = calculerJournee('demo', { calculeLe: GENERE_LE, date: GENERE_LE.slice(0, 10), demo: true });

// Index général : conserve la liste des jours réels déjà collectés.
const cheminIndex = 'data/index.json';
const general = existsSync(cheminIndex) ? JSON.parse(readFileSync(cheminIndex, 'utf8')) : { jours: [] };
ecrire(cheminIndex, { jours: general.jours ?? [], demo: 'demo' });

for (const l of bilan) console.log(l);
