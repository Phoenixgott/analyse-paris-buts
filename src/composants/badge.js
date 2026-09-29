import { esc } from '../format.js';
import { SEUIL_FIABLE } from '../../schema/qualite.js';

export function badge(texte, variante = 'neutre', titre = '') {
  const t = titre ? ` title="${esc(titre)}"` : '';
  return `<span class="badge badge--${variante}"${t}>${esc(texte)}</span>`;
}

export const badgeDemo = () => badge('DÉMO', 'demo', 'Données de démonstration fictives');

export const badgeNonFiable = () => badge('⚠ Non fiable', 'nonfiable', `Qualité des données sous ${SEUIL_FIABLE}/100`);

export function pastilleResultat(r) {
  if (!r) return badge('N/D', 'nd');
  const libelle = { V: 'Victoire', N: 'Nul', D: 'Défaite' }[r];
  return `<span class="resultat resultat--${r}" title="${libelle}" aria-label="${libelle}">${r}</span>`;
}
