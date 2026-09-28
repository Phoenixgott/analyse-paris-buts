import { CATEGORIES, esc } from '../format.js';
import { SEUIL_FIABLE } from '../../schema/qualite.js';
import { EXPLICATIONS } from '../explications.js';
import { ib } from './info-bulle.js';

export function badge(texte, variante = 'neutre', titre = '') {
  const t = titre ? ` title="${esc(titre)}"` : '';
  return `<span class="badge badge--${variante}"${t}>${esc(texte)}</span>`;
}

export const badgeDemo = () => badge('DÉMO', 'demo', 'Données de démonstration fictives');

export const badgeCategorie = (c) => badge(c === 'INT' ? 'INT' : c, 'categorie', CATEGORIES[c] ?? c);

export const badgePalier = (p) =>
  badge(`P${p}`, p === 1 ? 'palier1' : 'palier2', p === 1 ? 'Palier 1 : données complètes' : 'Palier 2 : données réduites');

export const badgeNonFiable = () => badge('⚠ Non fiable', 'nonfiable', `Qualité des données sous ${SEUIL_FIABLE}/100`);

export function badgeQualite(q) {
  const niveau = q < SEUIL_FIABLE ? 'faible' : q < 70 ? 'moyenne' : 'bonne';
  return `<span class="qualite qualite--${niveau}"><span class="qualite__val">${esc(q)}</span><span class="qualite__sur">/100</span></span>${ib(EXPLICATIONS.qualite_donnees, 'Comment la qualité des données est-elle calculée ?')}`;
}

export function pastilleResultat(r) {
  if (!r) return badge('N/D', 'nd');
  const libelle = { V: 'Victoire', N: 'Nul', D: 'Défaite' }[r];
  return `<span class="resultat resultat--${r}" title="${libelle}" aria-label="${libelle}">${r}</span>`;
}
