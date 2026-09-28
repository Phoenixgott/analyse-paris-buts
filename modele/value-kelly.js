// Value et mise.
//   value = proba modèle × cote − 1
//   Kelly = (proba × cote − 1) / (cote − 1) ; mise = ¼ Kelly, plafonnée à 2 % de la bankroll
//   cote minimale acceptable = (1 + seuil de value) / proba

export const value = (p, cote) => p * cote - 1;
export const kelly = (p, cote) => (p * cote - 1) / (cote - 1);
export const coteMinimale = (p, seuil) => (p > 0 ? (1 + seuil) / p : null);

/**
 * contexte : { fiable, confiance } ; renvoie value, kelly, mise (fraction de bankroll), suggéré ou non et pourquoi.
 */
export function evaluerPari(p, cote, r, contexte) {
  const base = { proba: p, cote: cote ?? null, cote_min: p == null ? null : coteMinimale(p, r.seuil_value) };
  if (p == null) return { ...base, value: null, kelly: null, mise_pct: 0, suggere: false, raison: 'Probabilité N/D' };
  if (cote == null) return { ...base, value: null, kelly: null, mise_pct: 0, suggere: false, raison: 'Cote N/D' };

  const v = value(p, cote);
  const k = kelly(p, cote);
  let raison = null;
  if (!contexte.fiable) raison = 'Match non fiable (qualité des données < 40)';
  else if (v < r.seuil_value) raison = `Value ${v >= 0 ? 'insuffisante' : 'négative'} (seuil ${Math.round(r.seuil_value * 100)} %)`;
  else if (v > r.value_suspecte) raison = `Value suspecte (> ${Math.round(r.value_suspecte * 100)} %) : écart trop grand avec le marché, erreur de modèle probable`;
  else if (p < r.proba_min) raison = `Probabilité trop faible (< ${Math.round(r.proba_min * 100)} %)`;
  else if (contexte.confiance == null || contexte.confiance < r.confiance_min) raison = `Confiance insuffisante (< ${r.confiance_min})`;

  const suggere = raison === null;
  return {
    ...base,
    value: v,
    kelly: k,
    mise_pct: suggere ? Math.min(r.fraction_kelly * k, r.mise_max) : 0,
    suggere,
    raison: suggere ? 'Value au-dessus du seuil' : raison,
  };
}
