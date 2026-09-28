// Qualité des données (0-100) : part des champs réellement remplis, pondérée par leur utilité
// pour l'analyse des buts. Calculée à la collecte, jamais estimée à la main.
// Sous SEUIL_FIABLE, le match est « non fiable » et aucun pari n'est suggéré.

export const SEUIL_FIABLE = 40;

// Poids par équipe (la moyenne des deux équipes compte pour 55 points).
export const POIDS_EQUIPE = {
  classement: 10,
  forme: 15,
  stats: 20,
  elo: 3,
  jours_repos: 2,
  absents: 3,
  compo_probable: 2,
};

// Poids du match (45 points).
export const POIDS_MATCH = {
  h2h: 5,
  cotes: 20,
  buteurs: 10,
  arbitre: 4,
  meteo: 3,
  stade_enjeu: 3,
};

const rempli = (v) => v !== null && v !== undefined;

/** Part (0..1) des valeurs non nulles d'un objet, 0 si l'objet est absent. */
function partRemplie(objet, cles = objet ? Object.keys(objet) : []) {
  if (!objet || cles.length === 0) return 0;
  return cles.filter((c) => rempli(objet[c])).length / cles.length;
}

function scoreEquipe(e) {
  const formeComplete = (e.forme ?? []).filter((m) => rempli(m.score)).length;
  const parts = {
    classement: partRemplie(e.classement),
    forme: Math.min(formeComplete, 10) / 10,
    stats: partRemplie(e.stats),
    elo: rempli(e.elo) ? 1 : 0,
    jours_repos: rempli(e.jours_repos) ? 1 : 0,
    absents: Array.isArray(e.absents) ? 1 : 0, // [] = « aucun absent signalé » : information connue
    compo_probable: (e.compo_probable ?? []).length > 0 ? 1 : 0,
  };
  return Object.entries(POIDS_EQUIPE).reduce((s, [cle, poids]) => s + poids * parts[cle], 0);
}

function partCotes(cotes) {
  if (!cotes) return 0;
  const lignes = cotes.total_buts ? Object.values(cotes.total_buts) : [];
  const total = lignes.filter((c) => rempli(c?.meilleure)).length / 12;
  const mt = [cotes.mt_over_0_5, cotes.mt_over_1_5].filter((c) => rempli(c?.meilleure)).length / 2;
  const buteur = (cotes.buteur ?? []).some((b) => rempli(b.cote?.meilleure)) ? 1 : 0;
  return 0.7 * total + 0.15 * mt + 0.15 * buteur;
}

function partButeurs(buteurs) {
  if (!buteurs || buteurs.length === 0) return 0;
  const champs = ['buts_par_90', 'tirs_par_90', 'tireur_penalty', 'coups_de_pied_arretes', 'minutes_prevues'];
  return buteurs.reduce((s, b) => s + partRemplie(b, champs), 0) / buteurs.length;
}

/** Détail du score par rubrique (points obtenus), utile pour l'info-bulle et les tests. */
export function detailQualite(match) {
  const { domicile, exterieur } = match.equipes;
  const detail = {
    equipes: (scoreEquipe(domicile) + scoreEquipe(exterieur)) / 2,
    h2h: POIDS_MATCH.h2h * (Math.min((match.h2h ?? []).length, 5) / 5),
    cotes: POIDS_MATCH.cotes * partCotes(match.cotes),
    buteurs: POIDS_MATCH.buteurs * partButeurs(match.buteurs),
    arbitre: POIDS_MATCH.arbitre * partRemplie(match.arbitre, ['nom', 'cartons_moy', 'penaltys_moy']),
    meteo: POIDS_MATCH.meteo * partRemplie(match.meteo, ['temperature', 'vent', 'pluie']),
    stade_enjeu: 2 * partRemplie(match.stade, ['nom', 'ville']) + (rempli(match.enjeu) ? 1 : 0),
  };
  return detail;
}

export function calculerQualite(match) {
  const total = Object.values(detailQualite(match)).reduce((a, b) => a + b, 0);
  return Math.max(0, Math.min(100, Math.round(total)));
}

export const estFiable = (qualite) => qualite >= SEUIL_FIABLE;
