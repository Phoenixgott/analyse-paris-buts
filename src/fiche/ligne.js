// Ligne de buts choisie sur la fiche match (0,5 à 5,5, Plus ou Moins) : probabilité du modèle,
// probabilité du marché (marge retirée), meilleure cote et value. Fonctions pures, testées.
import { probaMarche } from '../../modele/confiance.js';

export const LIGNES = [0, 1, 2, 3, 4, 5];

/** Ligne montrée d'abord : celle du pari suggéré s'il porte sur le total de buts, sinon « Plus de 2,5 ». */
export function ligneInitiale(modele) {
  const m = /^(over|under)_([0-5])_5$/.exec(modele?.verdict?.marche ?? '');
  return m ? { k: Number(m[2]), sens: m[1] === 'over' ? 'plus' : 'moins' } : { k: 2, sens: 'plus' };
}

export function libelleLigne(k, sens) {
  return `${sens === 'plus' ? 'Plus' : 'Moins'} de ${k},5 but${k >= 1 ? 's' : ''}`;
}

export function detailLigne(modele, match, k, sens) {
  const cle = `${sens === 'plus' ? 'over' : 'under'}_${k}_5`;
  const m = modele?.marches?.find((x) => x.marche === cle) ?? null;
  const tb = match?.cotes?.total_buts ?? null;
  const pOver = probaMarche(tb?.[`over_${k}_5`]?.meilleure, tb?.[`under_${k}_5`]?.meilleure);
  return {
    marche: cle,
    libelle: libelleLigne(k, sens),
    proba: m?.proba ?? modele?.total_buts?.[cle] ?? null,
    proba_marche: pOver == null ? null : sens === 'plus' ? pOver : 1 - pOver,
    cote: m?.cote ?? null,
    bookmaker: m?.bookmaker ?? null,
    value: m?.value ?? null,
    cote_min: m?.cote_min ?? null,
    mise_pct: m?.mise_pct ?? 0,
    suggere: !!m?.suggere,
    raison: m?.raison ?? null,
  };
}
