// Analyse complète d'un match : historique → Dixon-Coles → ajustements → grille → marchés →
// buteurs → value/mises → confiance → verdict. Résultat = « CALCULS DU SITE » du prompt IA.
import { reglages as fusionnerReglages } from './reglages.js';
import { ajusterDixonColes, butsAttendus, normaliserNom } from './dixon-coles.js';
import { grilleScores, marchesTotal, scoresProbables } from './grille.js';
import { calculerAjustements } from './ajustements.js';
import { marchesMiTemps, partButsMt } from './mi-temps.js';
import { probaButeurs } from './buteurs.js';
import { evaluerPari } from './value-kelly.js';
import { accordMarche, indiceConfiance, probaMarche } from './confiance.js';
import { estFiable } from '../schema/qualite.js';

export const VERSION_MODELE = '1.1.0';
// Rappel des unités, utile quand ces calculs sont lus par une IA (les pourcentages du match, eux, vont de 0 à 100).
export const UNITES =
  'Probabilités de 0 à 1 (0,25 = 25 %). value et mise_pct en fraction (0,05 = +5 % ; 0,02 = 2 % de la bankroll). Buts attendus en buts par match.';

const arrondi = (x, d = 4) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
// « 0,5 but », « 1,5 but », puis « 2,5 buts » (singulier en dessous de 2).
const ligneTexte = (k) => `${k},5 but${k >= 2 ? 's' : ''}`;

/** Matchs des 10 derniers de chaque équipe, au format historique (score vu du domicile). */
export function historiqueDepuisForme(match) {
  const sortie = [];
  for (const eq of [match.equipes.domicile, match.equipes.exterieur]) {
    for (const f of eq.forme ?? []) {
      if (!f.date || !f.adversaire || !f.score || !f.lieu) continue;
      const inverser = (s) => (s ? s.split('-').reverse().join('-') : null);
      sortie.push(
        f.lieu === 'D'
          ? { date: f.date, domicile: eq.nom, exterieur: f.adversaire, score: f.score, score_mt: f.score_mt }
          : { date: f.date, domicile: f.adversaire, exterieur: eq.nom, score: inverser(f.score), score_mt: inverser(f.score_mt) },
      );
    }
  }
  return sortie;
}

/** Historique de la ligue complété par la forme des deux équipes (sans doublon). */
export function fusionnerHistorique(ligue, forme) {
  const cle = (m) => `${m.date}|${normaliserNom(m.domicile)}|${normaliserNom(m.exterieur)}`;
  const vus = new Set(ligue.map(cle));
  const ajoutes = forme.filter((m) => !vus.has(cle(m)) && vus.add(cle(m)));
  return { matchs: [...ligue, ...ajoutes], n_ligue: ligue.length, n_forme: ajoutes.length };
}

function resultatNonCalculable(match, r, calculeLe, raison) {
  return {
    schema_version: VERSION_MODELE,
    match_id: match.match_id,
    demo: match.demo,
    calcule_le: calculeLe,
    calculable: false,
    fiable: estFiable(match.qualite_donnees),
    reglages: extraitReglages(r),
    methode: null,
    buts_attendus: null,
    ajustements: null,
    grille: null,
    scores_probables: [],
    total_buts: null,
    mi_temps: null,
    buteurs: [],
    marches: [],
    confiance: { indice: null, composantes: { qualite: match.qualite_donnees, echantillon: null, accord: null } },
    verdict: { decision: 'PASSER', marche: null, libelle: null, proba: null, cote: null, cote_min: null, value: null, mise_pct: 0, raison },
    unites: UNITES,
    avertissement: 'Probabilités estimées, pas des certitudes.',
  };
}

function extraitReglages(r) {
  const cles = ['demi_vie_jours', 'seuil_shrinkage', 'buts_max', 'plafond_ajustements', 'seuil_value', 'value_suspecte', 'proba_min', 'fraction_kelly', 'mise_max', 'confiance_min'];
  return Object.fromEntries(cles.map((c) => [c, r[c]]));
}

/**
 * match : fiche au schéma match ; historiqueLigue : [{ date, domicile, exterieur, score, score_mt }] ;
 * options : { reglages, calculeLe }.
 */
export function analyserMatch(match, historiqueLigue = [], options = {}) {
  const r = fusionnerReglages(options.reglages);
  const calculeLe = options.calculeLe ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const dateRef = match.coup_envoi.slice(0, 10);
  const { domicile: d, exterieur: e } = match.equipes;

  // Rien de postérieur au jour du match n'entre dans l'analyse (ni dans les calculs, ni dans les compteurs).
  const passe = (m) => m.date && m.date < dateRef;
  const historique = fusionnerHistorique(historiqueLigue.filter(passe), historiqueDepuisForme(match).filter(passe));
  const forces = ajusterDixonColes(historique.matchs, dateRef, r);
  if (!forces) return resultatNonCalculable(match, r, calculeLe, 'Modèle non calculable : aucun match d’historique pour ces équipes.');

  const base = butsAttendus(forces, d.nom, e.nom);
  const ajustements = calculerAjustements(match, r);
  const lambda = base.lambda * (1 + ajustements.total.D);
  const mu = base.mu * (1 + ajustements.total.E);

  const grille = grilleScores(lambda, mu, forces.rho, r.buts_max);
  const total = marchesTotal(grille);
  const part = partButsMt(forces, match, r);
  const mt = part ? marchesMiTemps(lambda, mu, forces.rho, part.valeur, r.buts_max) : null;
  const buteurs = probaButeurs(match, { lambda, mu }, r);

  const fiable = estFiable(match.qualite_donnees);
  const tb = match.cotes?.total_buts ?? null;
  const accord = accordMarche(
    [1, 2, 3].map((k) => ({
      proba_modele: total[`over_${k}_5`],
      proba_marche: probaMarche(tb?.[`over_${k}_5`]?.meilleure, tb?.[`under_${k}_5`]?.meilleure),
    })),
    r,
  );
  const confiance = indiceConfiance({ qualite: match.qualite_donnees, nDomicile: base.domicile.n, nExterieur: base.exterieur.n, accord }, r);
  const contexte = { fiable, confiance: confiance.indice };

  // Marchés : total de buts, 1re mi-temps, buteurs.
  const marches = [];
  const ajouterMarche = (marche, libelle, groupe, p, coteObj) => {
    const ev = evaluerPari(p, coteObj?.meilleure ?? null, r, contexte);
    marches.push({
      marche,
      libelle,
      groupe,
      proba: arrondi(ev.proba),
      cote: ev.cote,
      bookmaker: coteObj?.bookmaker ?? null,
      value: arrondi(ev.value),
      kelly: arrondi(ev.kelly),
      mise_pct: arrondi(ev.mise_pct),
      cote_min: arrondi(ev.cote_min, 2),
      suggere: ev.suggere,
      raison: ev.raison,
    });
  };
  for (let k = 0; k <= 5; k++) {
    ajouterMarche(`over_${k}_5`, `Plus de ${ligneTexte(k)}`, 'total', total[`over_${k}_5`], tb?.[`over_${k}_5`]);
    ajouterMarche(`under_${k}_5`, `Moins de ${ligneTexte(k)}`, 'total', total[`under_${k}_5`], tb?.[`under_${k}_5`]);
  }
  ajouterMarche('mt_over_0_5', 'Plus de 0,5 but en 1re MT', 'mi_temps', mt?.over_0_5 ?? null, match.cotes?.mt_over_0_5);
  ajouterMarche('mt_over_1_5', 'Plus de 1,5 but en 1re MT', 'mi_temps', mt?.over_1_5 ?? null, match.cotes?.mt_over_1_5);
  const cotesButeur = new Map((match.cotes?.buteur ?? []).map((c) => [normaliserNom(c.nom), c.cote]));
  for (const b of buteurs) {
    ajouterMarche(`buteur:${b.nom}`, `Buteur : ${b.nom}`, 'buteur', b.proba, cotesButeur.get(normaliserNom(b.nom)));
  }

  // Verdict : la meilleure value parmi les paris qui passent tous les filtres, sinon PASSER.
  const suggeres = marches.filter((m) => m.suggere).sort((a, b) => b.value - a.value);
  let verdict;
  if (suggeres.length) {
    const m = suggeres[0];
    verdict = { decision: 'PARIER', marche: m.marche, libelle: m.libelle, proba: m.proba, cote: m.cote, cote_min: m.cote_min, value: m.value, mise_pct: m.mise_pct, raison: `Value de ${Math.round(m.value * 1000) / 10} % au-dessus du seuil` };
  } else {
    let raison;
    if (!fiable) raison = `Match non fiable : qualité des données ${match.qualite_donnees}/100 (< 40).`;
    else if (confiance.indice == null || confiance.indice < r.confiance_min) raison = `Confiance insuffisante : ${confiance.indice ?? 'N/D'}/100 (< ${r.confiance_min}).`;
    else if (!marches.some((m) => m.cote != null)) raison = 'Aucune cote disponible pour comparer au modèle.';
    else raison = `Aucun pari avec une value d’au moins ${Math.round(r.seuil_value * 100)} % (et une probabilité ≥ ${Math.round(r.proba_min * 100)} %).`;
    verdict = { decision: 'PASSER', marche: null, libelle: null, proba: null, cote: null, cote_min: null, value: null, mise_pct: 0, raison };
  }

  const arrondirMarches = (obj, d = 4) => {
    const sortie = {};
    for (const k of Object.keys(obj)) if (k.startsWith('over')) sortie[k] = arrondi(obj[k], d);
    // Under = 1 − Over arrondi : la paire affichée fait toujours exactement 100 %.
    for (const k of Object.keys(obj)) if (k.startsWith('under')) sortie[k] = arrondi(1 - sortie[k.replace('under', 'over')], d);
    return sortie;
  };
  const equipeMethode = (x) => ({ n_matchs: x.n, facteur_shrinkage: arrondi(x.facteur_shrinkage, 3), attaque: arrondi(x.attaque, 3), defense: arrondi(x.defense, 3) });

  return {
    schema_version: VERSION_MODELE,
    match_id: match.match_id,
    demo: match.demo,
    calcule_le: calculeLe,
    calculable: true,
    fiable,
    reglages: extraitReglages(r),
    methode: {
      date_reference: dateRef,
      historique: { matchs_ligue: historique.n_ligue, matchs_forme: historique.n_forme, matchs_utilises: forces.n_matchs },
      domicile: equipeMethode(base.domicile),
      exterieur: equipeMethode(base.exterieur),
      avantage_domicile: arrondi(Math.exp(forces.avantage_domicile_log), 3),
      moyenne_buts_equipe: arrondi(Math.exp(forces.moyenne_log), 3),
      rho: arrondi(forces.rho, 4),
      iterations: forces.iterations,
    },
    buts_attendus: {
      domicile: arrondi(lambda, 3),
      exterieur: arrondi(mu, 3),
      total: arrondi(lambda + mu, 3),
      domicile_avant_ajustements: arrondi(base.lambda, 3),
      exterieur_avant_ajustements: arrondi(base.mu, 3),
    },
    ajustements: {
      liste: ajustements.liste.map((a) => ({ ...a, effet: arrondi(a.effet) })),
      brut: { D: arrondi(ajustements.brut.D), E: arrondi(ajustements.brut.E) },
      total: { D: arrondi(ajustements.total.D), E: arrondi(ajustements.total.E) },
    },
    grille: grille.map((ligne) => ligne.map((p) => arrondi(p, 6))),
    scores_probables: scoresProbables(grille, 5).map((s) => ({ score: s.score, proba: arrondi(s.proba) })),
    total_buts: arrondirMarches(total),
    mi_temps: mt
      ? {
          part_buts_mt: arrondi(part.valeur),
          source: part.source,
          buts_attendus: { domicile: arrondi(mt.buts_attendus.domicile, 3), exterieur: arrondi(mt.buts_attendus.exterieur, 3) },
          ...arrondirMarches(mt),
        }
      : null,
    buteurs: buteurs.map((b) => ({ ...b, taux_90: arrondi(b.taux_90, 3), part: arrondi(b.part), lambda: arrondi(b.lambda), proba: arrondi(b.proba) })),
    marches,
    confiance: {
      indice: confiance.indice,
      composantes: {
        qualite: confiance.composantes.qualite,
        echantillon: arrondi(confiance.composantes.echantillon, 1),
        accord: arrondi(confiance.composantes.accord, 1),
      },
    },
    verdict,
    unites: UNITES,
    avertissement: 'Probabilités estimées, pas des certitudes.',
  };
}
