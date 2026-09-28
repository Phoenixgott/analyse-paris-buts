// Ajustements des buts attendus (heuristiques simples, affichées une par une).
// Chaque équipe cumule les effets qui la concernent, plafonnés à ±10 % au total.
// Une donnée absente n'ajuste rien : l'ajustement est listé avec le statut « N/D ».

// Textes lisibles en français (virgule décimale, vrai signe moins).
const nombreFr = (x) => String(Math.round(Math.abs(x) * 100) / 100).replace('.', ',');
const pctTexte = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${nombreFr(x * 100)} %`;

export function calculerAjustements(match, r) {
  const a = r.ajustements;
  const liste = [];
  const ajouter = (type, equipe, effet, statut, raison) => liste.push({ type, equipe, effet, statut, raison });
  const { domicile: d, exterieur: e } = match.equipes;

  for (const [cote, eq] of [['D', d], ['E', e]]) {
    if (eq.jours_repos == null) ajouter('repos', cote, 0, 'N/D', `${eq.nom} : jours de repos inconnus`);
    else if (eq.jours_repos <= a.repos_jours_max) ajouter('repos', cote, a.repos_effet, 'appliqué', `${eq.nom} : ${eq.jours_repos} jour(s) de repos (≤ ${a.repos_jours_max})`);
    else ajouter('repos', cote, 0, 'aucun', `${eq.nom} : ${eq.jours_repos} jours de repos`);
  }

  ajouter('voyage', 'DE', 0, 'N/D', 'Distance de déplacement non fournie par les sources');

  if (match.enjeu == null) ajouter('derby', 'DE', 0, 'N/D', 'Enjeu inconnu : derby non détectable');
  else if (/derby/i.test(match.enjeu)) ajouter('derby', 'DE', a.derby_effet, 'appliqué', 'Derby signalé dans l’enjeu');
  else ajouter('derby', 'DE', 0, 'aucun', 'Pas de derby signalé');

  ajouter('enjeu', 'DE', 0, match.enjeu == null ? 'N/D' : 'non évalué', match.enjeu == null ? 'Enjeu inconnu' : 'Texte libre : non traduit en effet chiffré (à lire dans la fiche)');

  const pen = match.arbitre?.penaltys_moy;
  if (pen == null) ajouter('arbitre', 'DE', 0, 'N/D', 'Penaltys sifflés par l’arbitre inconnus');
  else if (pen >= a.arbitre_penaltys_haut) ajouter('arbitre', 'DE', a.arbitre_effet_haut, 'appliqué', `Arbitre : ${nombreFr(pen)} penalty/match (≥ ${nombreFr(a.arbitre_penaltys_haut)})`);
  else if (pen <= a.arbitre_penaltys_bas) ajouter('arbitre', 'DE', a.arbitre_effet_bas, 'appliqué', `Arbitre : ${nombreFr(pen)} penalty/match (≤ ${nombreFr(a.arbitre_penaltys_bas)})`);
  else ajouter('arbitre', 'DE', 0, 'aucun', `Arbitre : ${nombreFr(pen)} penalty/match`);

  const m = match.meteo;
  if (m == null || m.pluie == null) ajouter('pluie', 'DE', 0, 'N/D', 'Pluie inconnue');
  else if (m.pluie >= a.pluie_mm_h) ajouter('pluie', 'DE', a.pluie_effet, 'appliqué', `Pluie ${nombreFr(m.pluie)} mm/h (≥ ${nombreFr(a.pluie_mm_h)})`);
  else ajouter('pluie', 'DE', 0, 'aucun', `Pluie ${nombreFr(m.pluie)} mm/h`);
  if (m == null || m.vent == null) ajouter('vent', 'DE', 0, 'N/D', 'Vent inconnu');
  else if (m.vent >= a.vent_km_h) ajouter('vent', 'DE', a.vent_effet, 'appliqué', `Vent ${nombreFr(m.vent)} km/h (≥ ${nombreFr(a.vent_km_h)})`);
  else ajouter('vent', 'DE', 0, 'aucun', `Vent ${nombreFr(m.vent)} km/h`);

  for (const [cote, eq] of [['D', d], ['E', e]]) {
    if (eq.absents == null) {
      ajouter('absents', cote, 0, 'N/D', `${eq.nom} : absents inconnus`);
      continue;
    }
    const nombre = eq.absents.reduce((s, x) => s + (/incertain/i.test(x.raison ?? '') ? 0.5 : 1), 0);
    const effet = Math.max(a.absents_effet_max, nombre * a.absent_effet);
    if (nombre === 0) ajouter('absents', cote, 0, 'aucun', `${eq.nom} : aucun absent signalé`);
    else ajouter('absents', cote, effet, 'appliqué', `${eq.nom} : ${nombreFr(nombre)} absent(s) (${pctTexte(a.absent_effet)} chacun, max ${pctTexte(a.absents_effet_max)})`);
  }

  const brut = { D: 0, E: 0 };
  for (const x of liste) {
    if (x.equipe === 'D' || x.equipe === 'DE') brut.D += x.effet;
    if (x.equipe === 'E' || x.equipe === 'DE') brut.E += x.effet;
  }
  const borne = (v) => Math.max(-r.plafond_ajustements, Math.min(r.plafond_ajustements, v));
  return { liste, brut, total: { D: borne(brut.D), E: borne(brut.E) } };
}
