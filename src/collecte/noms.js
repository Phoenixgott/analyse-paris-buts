// Rapprochement des noms d'équipes écrits par l'IA avec ceux de l'historique (football-data.co.uk),
// pour que le modèle retrouve l'équipe. Le prompt impose déjà les noms exacts ; ceci est le filet de
// sécurité. Un rapprochement n'est accepté que s'il est net et sans ambiguïté, sinon le nom est gardé
// tel quel et signalé.

// Formes connues impossibles à déduire (surnoms, abréviations de la source).
const ALIAS = {
  psg: 'paris sg',
  spurs: 'tottenham',
  'brighton and hove albion': 'brighton',
  'tottenham hotspur': 'tottenham',
  'inter milan': 'inter',
  internazionale: 'inter',
  'fc internazionale milano': 'inter',
  'athletic club': 'ath bilbao',
  'athletic bilbao': 'ath bilbao',
  'atletico madrid': 'ath madrid',
  'atletico de madrid': 'ath madrid',
  'bayern munchen': 'bayern munich',
  'fc bayern munchen': 'bayern munich',
  'fc cologne': 'fc koln',
  cologne: 'fc koln',
  'sporting cp': 'sp lisbon',
  'sporting clube de portugal': 'sp lisbon',
  'sporting lisbonne': 'sp lisbon',
  'sporting lisbon': 'sp lisbon',
  'sc braga': 'sp braga',
  'sporting braga': 'sp braga',
  'istanbul basaksehir': 'buyuksehyr',
  basaksehir: 'buyuksehyr',
  'rasenballsport leipzig': 'rb leipzig',
};

// Mots trop génériques pour distinguer deux clubs.
const GENERIQUES = new Set([
  'fc', 'afc', 'cf', 'sc', 'ac', 'as', 'ss', 'ssc', 'us', 'cd', 'ud', 'sd', 'rc', 'rcd', 'sv', 'fsv', 'vfl', 'vfb', 'tsg', 'fk', 'sk', 'bk',
  'if', 'kv', 'krc', 'kaa', 'ogc', 'losc', 'club', 'de', 'la', 'le', 'les', 'the', 'of', 'and', 'calcio', 'olympique', 'stade', 'racing',
  'association', 'sportive', 'royal', 'royale', 'football',
]);

const SPECIAUX = { ı: 'i', İ: 'i', ø: 'o', Ø: 'o', æ: 'ae', ß: 'ss', đ: 'd', ł: 'l', Ł: 'l' };

export function normaliserTexte(nom) {
  return String(nom ?? '')
    .replace(/[ıİøØæßđłŁ]/g, (c) => SPECIAUX[c])
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function jetons(nom) {
  const n = normaliserTexte(nom);
  const alias = ALIAS[n] ?? n;
  return alias
    .split(' ')
    .map((t) => (t === 'saint' || t === 'sankt' || t === 'sint' ? 'st' : t))
    .filter((t) => t && !GENERIQUES.has(t) && !/^\d+$/.test(t));
}

function sousSequence(court, long) {
  if (court[0] !== long[0]) return false;
  let i = 0;
  for (const c of long) if (c === court[i]) i++;
  return i === court.length;
}

function prefixeCommun(a, b) {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return i;
}

function jetonsEgaux(a, b) {
  if (a === b) return true;
  const [court, long] = a.length <= b.length ? [a, b] : [b, a];
  if (court.length >= 3 && long.startsWith(court)) return true; // « man » / « manchester »
  if (court.length >= 3 && sousSequence(court, long)) return true; // « nottm » / « nottingham »
  const p = prefixeCommun(a, b);
  return p >= 4 && p >= 0.6 * court.length; // « rennais » / « rennes »
}

/** Part des jetons de a retrouvés dans b (un sigle peut couvrir plusieurs mots : « sg » = saint germain). */
function couverture(a, b) {
  if (!a.length) return 0;
  let trouves = 0;
  for (const t of a) {
    if (b.some((u) => jetonsEgaux(t, u))) trouves++;
    else if (t.length >= 2 && t.length <= 3) {
      for (let k = 0; k + t.length <= b.length; k++) {
        if (b.slice(k, k + t.length).map((u) => u[0]).join('') === t) {
          trouves++;
          break;
        }
      }
    }
  }
  return trouves / a.length;
}

export function similarite(a, b) {
  const ja = jetons(a);
  const jb = jetons(b);
  if (!ja.length || !jb.length) return normaliserTexte(a) === normaliserTexte(b) ? 1 : 0;
  // Un sigle d'un côté (« SG », « OH ») peut couvrir plusieurs mots de l'autre, dans les deux sens.
  return (Math.max(couverture(ja, jb), couvertureParSigles(ja, jb)) + Math.max(couverture(jb, ja), couvertureParSigles(jb, ja))) / 2;
}

function couvertureParSigles(b, a) {
  // Mots de b couverts par un sigle de a (ex. b = oud heverlee leuven, a = oh leuven).
  let couverts = 0;
  const utilises = new Set();
  for (let k = 0; k < b.length; k++) {
    if (a.some((t) => jetonsEgaux(t, b[k]))) {
      couverts++;
      continue;
    }
    for (const t of a) {
      if (t.length < 2 || t.length > 3 || utilises.has(`${t}${k}`)) continue;
      const mots = b.slice(k, k + t.length);
      if (mots.length === t.length && mots.map((u) => u[0]).join('') === t) {
        couverts += t.length;
        mots.forEach((_, i) => utilises.add(`${t}${k + i}`));
        k += t.length - 1;
        break;
      }
    }
  }
  return Math.min(1, couverts / b.length);
}

/**
 * Même joueur ? Nom de famille identique (dernier mot) et prénoms compatibles : « A. Lacazette »,
 * « Alexandre Lacazette » et « Lacazette » désignent le même joueur ; « B. Lacazette » non.
 */
export function memeJoueur(a, b) {
  const ja = normaliserTexte(a).split(' ').filter(Boolean);
  const jb = normaliserTexte(b).split(' ').filter(Boolean);
  if (!ja.length || !jb.length || ja.at(-1) !== jb.at(-1)) return false;
  const pa = ja.slice(0, -1);
  const pb = jb.slice(0, -1);
  if (!pa.length || !pb.length) return true;
  return pa[0][0] === pb[0][0] && (pa[0].length === 1 || pb[0].length === 1 || pa[0] === pb[0]);
}

/**
 * Nom de la liste le plus proche de `nom`, ou null si aucun n'est net (score ≥ 0,7) et unique
 * (au moins 0,15 d'avance sur le suivant). Renvoie { nom, score, exact }.
 */
export function nomCanonique(nom, liste) {
  if (!nom || !liste?.length) return null;
  const exact = liste.find((n) => normaliserTexte(n) === normaliserTexte(nom));
  if (exact) return { nom: exact, score: 1, exact: true };
  const scores = liste.map((n) => ({ nom: n, score: similarite(nom, n) })).sort((x, y) => y.score - x.score);
  const [premier, second] = scores;
  if (premier.score >= 0.7 && (!second || premier.score - second.score >= 0.15)) return { ...premier, exact: false };
  return null;
}
