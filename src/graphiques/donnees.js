// Données des graphiques de la fiche match (fonctions pures, testées). Une valeur absente reste
// null : le graphique la montre comme un trou, jamais comme un zéro.
import { probaMarche } from '../../modele/confiance.js';

export const TRANCHES_15 = ['0-15', '16-30', '31-45', '46-60', '61-75', '76-90'];

/** Buts par match (pour + contre) sur les 10 derniers matchs, du plus ancien au plus récent,
 *  alignés à droite : le dernier point est toujours le match le plus récent. */
export function serieForme(equipe, n = 10) {
  const forme = (equipe.forme ?? []).slice(0, n);
  const points = forme
    .map((f) => {
      if (!f.score) return { ...f, total: null, pour: null, contre: null };
      const [pour, contre] = f.score.split('-').map(Number);
      return { ...f, total: pour + contre, pour, contre };
    })
    .reverse();
  return [...Array(n - points.length).fill(null), ...points];
}

export function etiquettesForme(n = 10) {
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? 'Dern.' : `M-${n - 1 - i}`));
}

/** Over k,5 : probabilité du modèle et probabilité implicite du marché (marge retirée), en %. */
export function overModeleMarche(modele, match) {
  const tb = match.cotes?.total_buts ?? null;
  return [0, 1, 2, 3, 4, 5].map((k) => {
    const pm = modele?.total_buts?.[`over_${k}_5`];
    const pk = probaMarche(tb?.[`over_${k}_5`]?.meilleure, tb?.[`under_${k}_5`]?.meilleure);
    return { ligne: `+${k},5`, modele: pm == null ? null : pm * 100, marche: pk == null ? null : pk * 100 };
  });
}

/** Buts (marqués + encaissés) par match dans chaque tranche de 15 minutes ; null si N/D. */
export function tranchesEquipe(equipe) {
  const t = equipe.stats?.buts_par_tranche;
  if (!t || !t.matchs || !t.marques || !t.encaisses) return null;
  return TRANCHES_15.map((libelle, i) => {
    const m = t.marques[i];
    const e = t.encaisses[i];
    return {
      tranche: libelle,
      marques: m == null ? null : m / t.matchs,
      encaisses: e == null ? null : e / t.matchs,
      total: m == null || e == null ? null : (m + e) / t.matchs,
    };
  });
}

/**
 * Radar attaque/défense : indices où 100 = moyenne de la ligue (d'après le modèle).
 * Moyenne de buts par équipe et par match = exp(m) × (1 + avantage du terrain) / 2.
 */
export const AXES_RADAR = ['Attaque (modèle)', 'Défense (modèle)', 'Buts marqués', 'Solidité', 'Buts 1re MT', 'xG'];
// Libellés courts autour du radar (le nom complet est dans l'infobulle et le tableau).
export const AXES_RADAR_COURTS = ['Attaque', 'Défense', 'Buts', 'Solidité', 'Buts MT', 'xG'];

export function radarEquipe(equipe, force, modele) {
  if (!modele?.methode || !force) return null;
  const moy = (modele.methode.moyenne_buts_equipe * (1 + modele.methode.avantage_domicile)) / 2;
  const s = equipe.stats;
  const part = modele.mi_temps?.part_buts_mt ?? null;
  const indice = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100));
  return [
    indice(Math.exp(force.attaque)),
    indice(Math.exp(-force.defense)),
    indice(s?.buts_marques_moy != null ? s.buts_marques_moy / moy : null),
    indice(s?.buts_encaisses_moy > 0 ? moy / s.buts_encaisses_moy : null),
    indice(s?.buts_mt_marques_moy != null && part ? s.buts_mt_marques_moy / (moy * part) : null),
    indice(s?.xg_moy != null ? s.xg_moy / moy : null),
  ];
}

export function jauge(modele) {
  const valeur = modele?.confiance?.indice ?? null;
  return { valeur, seuil: modele?.reglages?.confiance_min ?? 50 };
}
