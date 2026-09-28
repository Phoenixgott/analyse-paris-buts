// Filtres et tris de la liste des matchs (fonctions pures, testées).
import { heureParis } from '../format.js';

export const TRANCHES = {
  matin: { libelle: 'Avant 14 h', test: (h) => h < 14 },
  apresmidi: { libelle: '14 h – 18 h', test: (h) => h >= 14 && h < 18 },
  soir: { libelle: '18 h – 21 h', test: (h) => h >= 18 && h < 21 },
  nuit: { libelle: '21 h et après', test: (h) => h >= 21 },
};

export const FILTRES_VIDES = { pays: '', competition: '', categorie: '', tranche: '' };

export function optionsFiltres(matchs) {
  const unique = (valeurs) => [...new Set(valeurs.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  return {
    pays: unique(matchs.map((m) => m.competition.pays)),
    competition: unique(matchs.map((m) => m.competition.nom)),
    categorie: ['H', 'F', 'INT'].filter((c) => matchs.some((m) => m.competition.categorie === c)),
  };
}

export function filtrerMatchs(matchs, filtres) {
  return matchs.filter((m) => {
    if (filtres.pays && m.competition.pays !== filtres.pays) return false;
    if (filtres.competition && m.competition.nom !== filtres.competition) return false;
    if (filtres.categorie && m.competition.categorie !== filtres.categorie) return false;
    if (filtres.tranche && !TRANCHES[filtres.tranche]?.test(heureParis(m.coup_envoi))) return false;
    return true;
  });
}

const parHeure = (a, b) => a.coup_envoi.localeCompare(b.coup_envoi) || a.match_id.localeCompare(b.match_id);

/** tri : 'heure' | 'ligue'. ('value' arrive avec le modèle, phase 2.) */
export function trierMatchs(matchs, tri = 'heure') {
  const copie = [...matchs];
  if (tri === 'ligue') {
    return copie.sort(
      (a, b) =>
        a.competition.palier - b.competition.palier ||
        (a.competition.pays ?? '').localeCompare(b.competition.pays ?? '', 'fr') ||
        a.competition.nom.localeCompare(b.competition.nom, 'fr') ||
        parHeure(a, b),
    );
  }
  return copie.sort(parHeure);
}
