// Affichage des valeurs : une donnée absente (null) s'affiche toujours « N/D », jamais devinée.
export const ND = 'N/D';
export const FUSEAU = 'Europe/Paris';

const estNombre = (v) => typeof v === 'number' && Number.isFinite(v);

export function esc(valeur) {
  return String(valeur ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function texte(v) {
  return v === null || v === undefined || v === '' ? ND : String(v);
}

export function nombre(v, decimales = 2) {
  if (!estNombre(v)) return ND;
  return v.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

export function entier(v) {
  return estNombre(v) ? Math.round(v).toLocaleString('fr-FR') : ND;
}

/** Pourcentage stocké de 0 à 100. */
export function pct(v, decimales = 0) {
  return estNombre(v) ? `${nombre(v, decimales)} %` : ND;
}

/** Probabilité stockée de 0 à 1, affichée en %. */
export function proba(p, decimales = 1) {
  return estNombre(p) ? pct(p * 100, decimales) : ND;
}

/** Value (fraction) signée : « +3,2 % », « −4,1 % ». */
export function valueTexte(v) {
  if (!estNombre(v)) return ND;
  const signe = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${signe}${nombre(Math.abs(v) * 100, 1)} %`;
}

export function cote(v) {
  return nombre(v, 2);
}

/** Écart de cote signé, avec une flèche neutre (ni vert ni rouge : réservés aux gains/pertes). */
export function mouvement(v) {
  if (!estNombre(v)) return ND;
  if (v === 0) return '= 0,00';
  return `${v > 0 ? '↑ +' : '↓ −'}${nombre(Math.abs(v), 2)}`;
}

export function oui(v) {
  if (v === true) return 'Oui';
  if (v === false) return 'Non';
  return ND;
}

export function heure(iso) {
  if (!iso) return ND;
  return new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function heureParis(iso) {
  // Heure (0-23) du coup d'envoi en Europe/Paris, pour le filtre par tranche horaire.
  const parties = new Intl.DateTimeFormat('en-GB', { timeZone: FUSEAU, hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  return Number(parties.find((p) => p.type === 'hour').value);
}

export function dateLongue(iso) {
  if (!iso) return ND;
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: FUSEAU,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso));
}

/** Date courte JJ/MM/AA à partir d'une date AAAA-MM-JJ. */
export function dateCourte(jour) {
  if (!jour) return ND;
  const [a, m, j] = jour.split('-');
  return `${j}/${m}/${a.slice(2)}`;
}

/** Jour AAAA-MM-JJ en Europe/Paris (le jour « du site », quel que soit le fuseau du téléphone). */
export function jourParis(date = new Date()) {
  const parties = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const val = (t) => parties.find((p) => p.type === t).value;
  return `${val('year')}-${val('month')}-${val('day')}`;
}

/** Résultat d'un score « pour-contre » : V, N ou D (null si le score est absent). */
export function resultat(score) {
  if (!score) return null;
  const [p, c] = score.split('-').map(Number);
  return p > c ? 'V' : p === c ? 'N' : 'D';
}

export const CATEGORIES = { H: 'Hommes', F: 'Femmes', INT: 'Sélections' };
