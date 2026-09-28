// Index d'une journée : résumé léger des matchs pour la page d'accueil
// (la fiche complète est chargée à la demande depuis matchs/<match_id>.json, le calcul du modèle
// depuis modeles/<match_id>.json).

export function resumeModele(modele) {
  if (!modele) return null;
  const values = modele.marches.map((m) => m.value).filter((v) => v != null);
  return {
    calculable: modele.calculable,
    buts_attendus: modele.buts_attendus?.total ?? null,
    over_2_5: modele.total_buts?.over_2_5 ?? null,
    confiance: modele.confiance.indice,
    decision: modele.verdict.decision,
    libelle: modele.verdict.libelle,
    value: modele.verdict.value,
    value_max: values.length ? Math.max(...values) : null,
    nb_suggeres: modele.marches.filter((m) => m.suggere).length,
  };
}

export function resumeMatch(match, modele = null) {
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
    modele: resumeModele(modele),
  };
}

/** modeles : Map match_id → résultat du modèle (facultatif). */
export function construireIndex(matchs, { date, demo, genereLe }, modeles = new Map()) {
  return {
    date,
    demo,
    genere_le: genereLe,
    matchs: matchs
      .map((m) => resumeMatch(m, modeles.get(m.match_id) ?? null))
      .sort((a, b) => a.coup_envoi.localeCompare(b.coup_envoi) || a.match_id.localeCompare(b.match_id)),
  };
}
