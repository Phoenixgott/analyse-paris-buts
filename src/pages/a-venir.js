const PAGES = {
  'top-picks': {
    titre: 'Top picks',
    phase: 5,
    texte: 'Les meilleurs value bets du jour par marché (total de buts, 1re mi-temps, buteur), avec un avertissement sur la corrélation des combinés.',
  },
  journal: {
    titre: 'Journal de paris',
    phase: 5,
    texte: 'Saisie de tes paris, résolution automatique, ROI, taux de réussite, courbe de bankroll, export CSV et limites personnelles (mise max par jour, stop-loss).',
  },
  fiabilite: {
    titre: 'Fiabilité du modèle',
    phase: 6,
    texte: 'Brier score, log-loss et courbes de calibration par marché et par ligue, calculés sur les prédictions archivées.',
  },
};

export function pageAVenir(app, cle) {
  const p = PAGES[cle];
  document.title = `${p.titre} — Analyse Paris Buts`;
  app.innerHTML = `
    <header class="page-tete"><h1 class="page-titre">${p.titre}</h1></header>
    <section class="carte">
      <p class="a-venir__phase">Disponible en phase ${p.phase}</p>
      <p>${p.texte}</p>
      <p><a href="#/">Retour aux matchs du jour</a></p>
    </section>`;
}
