// Index d'une journée : résumé léger des matchs pour la page d'accueil
// (la fiche complète est chargée à la demande depuis matchs/<match_id>.json).

export function resumeMatch(match) {
  const { competition, equipes } = match;
  return {
    match_id: match.match_id,
    fichier: `matchs/${match.match_id}.json`,
    demo: match.demo,
    coup_envoi: match.coup_envoi,
    competition: {
      id: competition.id,
      nom: competition.nom,
      pays: competition.pays,
      categorie: competition.categorie,
      palier: competition.palier,
    },
    domicile: equipes.domicile.nom,
    exterieur: equipes.exterieur.nom,
    qualite_donnees: match.qualite_donnees,
  };
}

export function construireIndex(matchs, { date, demo, genereLe }) {
  return {
    date,
    demo,
    genere_le: genereLe,
    matchs: matchs
      .map(resumeMatch)
      .sort((a, b) => a.coup_envoi.localeCompare(b.coup_envoi) || a.match_id.localeCompare(b.match_id)),
  };
}
