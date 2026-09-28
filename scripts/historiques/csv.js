// Lecture des fichiers CSV de football-data.co.uk (résultats, scores à la pause, cotes Plus/Moins 2,5).

/** Découpe un CSV (guillemets gérés) en lignes d'objets indexés par l'en-tête. */
export function lireCsv(texte) {
  const lignes = [];
  let champ = '';
  let ligne = [];
  let guillemets = false;
  const t = texte.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (guillemets) {
      if (c === '"' && t[i + 1] === '"') {
        champ += '"';
        i++;
      } else if (c === '"') guillemets = false;
      else champ += c;
    } else if (c === '"') guillemets = true;
    else if (c === ',') {
      ligne.push(champ);
      champ = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = '';
    } else champ += c;
  }
  if (champ !== '' || ligne.length) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  const [entete, ...corps] = lignes.filter((l) => l.some((v) => v.trim() !== ''));
  if (!entete) return [];
  return corps.map((l) => Object.fromEntries(entete.map((cle, k) => [cle.trim(), (l[k] ?? '').trim()])));
}

/** « 21/08/2026 » ou « 21/08/26 » → « 2026-08-21 » (null si illisible). */
export function dateIso(texte) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(texte ?? '');
  if (!m) return null;
  const annee = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${annee}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

const entier = (v) => (/^\d+$/.test(v ?? '') ? Number(v) : null);
const decimal = (v) => {
  const n = Number(v);
  return v !== '' && v != null && Number.isFinite(n) && n > 0 ? n : null;
};

/** Ligne d'un fichier « principal » (mmz4281/<saison>/<code>.csv) ou « nouveau » (new/<pays>.csv). */
export function matchDepuisLigne(l) {
  const date = dateIso(l.Date);
  const domicile = l.HomeTeam || l.Home;
  const exterieur = l.AwayTeam || l.Away;
  const bd = entier(l.FTHG ?? l.HG);
  const be = entier(l.FTAG ?? l.AG);
  if (!date || !domicile || !exterieur || bd == null || be == null) return null; // match non joué ou ligne vide
  const md = entier(l.HTHG);
  const me = entier(l.HTAG);
  return {
    date,
    domicile,
    exterieur,
    score: `${bd}-${be}`,
    score_mt: md == null || me == null ? null : `${md}-${me}`,
    cote_over_2_5: decimal(l['Avg>2.5'] ?? l['BbAv>2.5']),
    cote_under_2_5: decimal(l['Avg<2.5'] ?? l['BbAv<2.5']),
    xg_domicile: decimal(l.HxG),
    xg_exterieur: decimal(l.AxG),
  };
}

/** Équipes de la saison la plus récente (pour imposer leurs noms exacts dans les prompts de collecte). */
export function equipesDe(matchs) {
  return [...new Set(matchs.flatMap((m) => [m.domicile, m.exterieur]))].sort((a, b) => a.localeCompare(b, 'fr'));
}
