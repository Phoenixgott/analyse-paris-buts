// Graphiques affichés sur la page courante, détruits au changement de page (sans charger Chart.js).
const actifs = new Set();

export function enregistrer(graphique) {
  actifs.add(graphique);
  return graphique;
}

export function toutDetruire() {
  for (const g of actifs) g.destroy();
  actifs.clear();
}
