// Indice de confiance (0-100) = moyenne pondérée de trois composantes :
//   qualité des données (0-100),
//   échantillon : historique de l'équipe la moins fournie ÷ 15 matchs (plafonné à 100),
//   accord modèle/marché : 100 − écart moyen sur Over 1,5/2,5/3,5 (probabilité du marché sans marge),
//     0 dès 15 points d'écart.
// Une composante indisponible (pas de cotes) est retirée et les poids restants renormalisés.

/** Probabilité implicite du marché, marge du bookmaker retirée (méthode proportionnelle). */
export function probaMarche(coteOver, coteUnder) {
  if (!coteOver || !coteUnder) return null;
  const io = 1 / coteOver;
  const iu = 1 / coteUnder;
  return io / (io + iu);
}

export function accordMarche(lignes, r) {
  const valides = lignes.filter((l) => l.proba_modele != null && l.proba_marche != null);
  if (!valides.length) return null;
  const scores = valides.map((l) => Math.max(0, 1 - Math.abs(l.proba_modele - l.proba_marche) / r.accord_ecart_max));
  return (100 * scores.reduce((a, b) => a + b, 0)) / scores.length;
}

export function indiceConfiance({ qualite, nDomicile, nExterieur, accord }, r) {
  const composantes = {
    qualite,
    echantillon: 100 * Math.min(1, Math.min(nDomicile, nExterieur) / r.echantillon_plein),
    accord,
  };
  let somme = 0;
  let poids = 0;
  for (const [cle, valeur] of Object.entries(composantes)) {
    if (valeur == null) continue;
    somme += r.confiance_poids[cle] * valeur;
    poids += r.confiance_poids[cle];
  }
  return { indice: poids ? Math.round(somme / poids) : null, composantes };
}
