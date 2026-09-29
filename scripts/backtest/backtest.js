// Backtest du modèle sur l'historique réel (football-data.co.uk, fichiers publics sans clé).
// « Walk-forward » : chaque semaine, le modèle est ajusté UNIQUEMENT sur les matchs joués avant le lundi
// de cette semaine, puis il prédit les matchs de la semaine. Aucune information future.
// Compare plusieurs demi-vies, mesure la calibration, confronte le modèle au marché (cotes moyennes
// Plus/Moins 2,5, marge retirée) et simule les règles de value du site sur la ligne 2,5 (cotes max).
// Usage : node scripts/backtest/backtest.js   → data/backtest/resume.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { COMPETITIONS, saisonsEuropeennes } from '../../src/collecte/competitions.js';
import { lireCsv, matchDepuisLigne } from '../historiques/csv.js';
import { ajusterDixonColes, butsAttendus } from '../../modele/dixon-coles.js';
import { grilleScores, marchesTotal } from '../../modele/grille.js';
import { marchesMiTemps } from '../../modele/mi-temps.js';
import { REGLAGES, reglages as fusionner } from '../../modele/reglages.js';
import { probaMarche } from '../../modele/confiance.js';
import { brier, calibration, logLoss, MARCHES_FIABILITE, realise } from '../../modele/fiabilite.js';

const BASE = 'https://www.football-data.co.uk';
const r4 = (x) => (x == null ? null : Math.round(x * 10000) / 10000);

const decimal = (v) => {
  const n = Number(v);
  return v !== '' && v != null && Number.isFinite(n) && n > 1 ? n : null;
};

/** Lundi (UTC) de la semaine d'une date AAAA-MM-JJ. */
export function lundi(date) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Prédictions « walk-forward » d'une ligue. matchs : triés ou non, { date, domicile, exterieur, score, score_mt, … }.
 * Seuls les matchs datés à partir de debutEvaluation sont prédits.
 */
export function predireLigue(matchs, { debutEvaluation, demiVie, reglages = {} }) {
  const r = fusionner({ ...reglages, demi_vie_jours: demiVie });
  const tries = [...matchs].sort((a, b) => a.date.localeCompare(b.date));
  const parSemaine = new Map();
  for (const m of tries.filter((x) => x.date >= debutEvaluation)) {
    const s = lundi(m.date);
    if (!parSemaine.has(s)) parSemaine.set(s, []);
    parSemaine.get(s).push(m);
  }
  const sortie = [];
  for (const [semaine, aPredire] of parSemaine) {
    const forces = ajusterDixonColes(tries, semaine, r); // ne garde que les matchs < lundi
    if (!forces) continue;
    const part = forces.part_mt.valeur != null && forces.part_mt.n_matchs >= r.mt_min_matchs ? forces.part_mt.valeur : null;
    for (const m of aPredire) {
      const { lambda, mu } = butsAttendus(forces, m.domicile, m.exterieur);
      const total = marchesTotal(grilleScores(lambda, mu, forces.rho, r.buts_max));
      const probas = Object.fromEntries([0, 1, 2, 3, 4, 5].map((k) => [`over_${k}_5`, total[`over_${k}_5`]]));
      if (part != null) {
        const mt = marchesMiTemps(lambda, mu, forces.rho, part, r.buts_max);
        probas.mt_over_0_5 = mt.over_0_5;
        probas.mt_over_1_5 = mt.over_1_5;
      }
      sortie.push({ ...m, probas, p_marche_2_5: probaMarche(m.cote_over_2_5, m.cote_under_2_5) });
    }
  }
  return sortie;
}

/** Règles de value du site (value ≥ seuil, ≤ value suspecte, proba ≥ min) sur Plus/Moins 2,5, mise fixe de 1. */
export function simulerValue(predictions, r = REGLAGES) {
  let n = 0;
  let profit = 0;
  for (const p of predictions) {
    const o = realise('over_2_5', p.score, null);
    for (const [proba, cote, gagne] of [[p.probas.over_2_5, p.cote_max_over, o === 1], [1 - p.probas.over_2_5, p.cote_max_under, o === 0]]) {
      if (!cote) continue;
      const v = proba * cote - 1;
      if (v < r.seuil_value || v > r.value_suspecte || proba < r.proba_min) continue;
      n++;
      profit += gagne ? cote - 1 : -1;
    }
  }
  return { paris: n, profit: r4(profit), roi: n ? r4(profit / n) : null };
}

function pairesDe(predictions, marche) {
  return predictions.map((p) => ({ p: p.probas[marche], r: realise(marche, p.score, p.score_mt) })).filter((x) => x.p != null && x.r != null);
}

export function mesurer(predictions) {
  const brierPar = {};
  const loglossPar = {};
  for (const { marche } of MARCHES_FIABILITE) {
    const pr = pairesDe(predictions, marche);
    brierPar[marche] = r4(brier(pr));
    loglossPar[marche] = r4(logLoss(pr));
  }
  const cle = ['over_1_5', 'over_2_5', 'over_3_5'].map((m) => brierPar[m]).filter((x) => x != null);
  return { n: predictions.length, brier: brierPar, log_loss: loglossPar, brier_moyen_1_5_a_3_5: cle.length ? r4(cle.reduce((a, b) => a + b) / cle.length) : null };
}

export function comparerMarche(predictions) {
  const avec = predictions.filter((p) => p.p_marche_2_5 != null);
  const pairesModele = avec.map((p) => ({ p: p.probas.over_2_5, r: realise('over_2_5', p.score, null) }));
  const pairesMarche = avec.map((p) => ({ p: p.p_marche_2_5, r: realise('over_2_5', p.score, null) }));
  return { n: avec.length, brier_modele: r4(brier(pairesModele)), brier_marche: r4(brier(pairesMarche)), log_loss_modele: r4(logLoss(pairesModele)), log_loss_marche: r4(logLoss(pairesMarche)) };
}

// --- Téléchargement (saison courante, précédente et encore avant pour l'entraînement) -------
async function texte(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'analyse-paris-buts (usage personnel)' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

const avecCotesMax = (l) => {
  const m = matchDepuisLigne(l);
  return m && { ...m, cote_max_over: decimal(l['Max>2.5'] ?? l['BbMx>2.5']), cote_max_under: decimal(l['Max<2.5'] ?? l['BbMx<2.5']) };
};

async function historiqueBacktest(c, maintenant) {
  if (c.format === 'nouveau') {
    const annee = maintenant.getUTCFullYear();
    const lignes = lireCsv(await texte(`${BASE}/new/${c.fd}.csv`)).filter((l) => l.League === c.ligue && Number(l.Season) >= annee - 2);
    const matchs = lignes.map(avecCotesMax).filter(Boolean);
    const debut = matchs.filter((m) => m.date.startsWith(String(annee - 1))).map((m) => m.date).sort()[0];
    return { matchs, debutEvaluation: debut, saisons: [String(annee - 2), String(annee - 1), String(annee)] };
  }
  const { courante, precedente } = saisonsEuropeennes(maintenant);
  const debutPrec = Number(`20${precedente.slice(0, 2)}`);
  const avant = `${String((debutPrec - 1) % 100).padStart(2, '0')}${precedente.slice(0, 2)}`;
  const saisons = [avant, precedente, courante];
  const parSaison = await Promise.all(
    saisons.map((s) => texte(`${BASE}/mmz4281/${s}/${c.fd}.csv`).then((t) => lireCsv(t).map(avecCotesMax).filter(Boolean)).catch(() => [])),
  );
  const debutEvaluation = parSaison[1].map((m) => m.date).sort()[0];
  return { matchs: parSaison.flat(), debutEvaluation, saisons };
}

/** Réglages comparés : l'actuel, ceux du cahier des charges (60 j, prior 1) et des variantes. */
export function configurations() {
  const actuelle = { demi_vie: REGLAGES.demi_vie_jours, prior: REGLAGES.prior_matchs };
  const variantes = [{ demi_vie: 60, prior: 1 }, { demi_vie: 120, prior: 1 }, { demi_vie: 240, prior: 1 }, { demi_vie: 240, prior: 5 }, { demi_vie: 240, prior: 10 }, { demi_vie: 240, prior: 20 }, { demi_vie: 365, prior: 20 }];
  return [{ ...actuelle, actuelle: true }, ...variantes.filter((v) => v.demi_vie !== actuelle.demi_vie || v.prior !== actuelle.prior).map((v) => ({ ...v, actuelle: false }))];
}

const calib = (pr, m) => calibration(pairesDe(pr, m), 10).map((t) => ({ ...t, p_moy: r4(t.p_moy), frequence: r4(t.frequence) }));

export async function lancerBacktest(maintenant = new Date()) {
  const configs = configurations();
  const predictions = configs.map(() => []);
  const parLigue = [];
  const indisponibles = [];
  for (const c of COMPETITIONS.filter((x) => x.fd)) {
    let h;
    try {
      h = await historiqueBacktest(c, maintenant);
    } catch (e) {
      indisponibles.push(`${c.id} (${e.message})`);
      continue;
    }
    if (!h.debutEvaluation || h.matchs.length < 200) {
      indisponibles.push(`${c.id} (historique insuffisant)`);
      continue;
    }
    configs.forEach((cfg, i) => {
      const pr = predireLigue(h.matchs, { debutEvaluation: h.debutEvaluation, demiVie: cfg.demi_vie, reglages: { prior_matchs: cfg.prior } });
      predictions[i].push(...pr.map((p) => ({ ...p, competition_id: c.id })));
      if (cfg.actuelle) parLigue.push({ id: c.id, nom: c.nom, n: pr.length, depuis: h.debutEvaluation, ...mesurer(pr), marche: comparerMarche(pr), value: simulerValue(pr) });
    });
    console.log(`${c.id} : ${parLigue.at(-1).n} matchs prédits depuis le ${h.debutEvaluation}`);
  }
  const resultats = configs.map((cfg, i) => ({ ...cfg, ...mesurer(predictions[i]), marche: comparerMarche(predictions[i]), value: simulerValue(predictions[i]) }));
  const iActuelle = configs.findIndex((c) => c.actuelle);
  const iMeilleure = resultats.reduce((best, r, i) => (r.brier_moyen_1_5_a_3_5 < resultats[best].brier_moyen_1_5_a_3_5 ? i : best), 0);
  return {
    genere_le: maintenant.toISOString().replace(/\.\d+Z$/, 'Z'),
    source: 'football-data.co.uk (résultats, scores à la pause, cotes moyennes et maximales Plus/Moins 2,5)',
    methode: 'Walk-forward hebdomadaire : le modèle est ajusté sur les seuls matchs antérieurs au lundi de la semaine prédite ; évaluation sur la saison précédente et la saison en cours.',
    configurations: resultats,
    actuelle: { demi_vie: configs[iActuelle].demi_vie, prior: configs[iActuelle].prior },
    meilleure: { demi_vie: configs[iMeilleure].demi_vie, prior: configs[iMeilleure].prior },
    calibration: {
      actuelle: Object.fromEntries(['over_1_5', 'over_2_5', 'over_3_5', 'mt_over_0_5'].map((m) => [m, calib(predictions[iActuelle], m)])),
      meilleure: Object.fromEntries(['over_1_5', 'over_2_5', 'over_3_5', 'mt_over_0_5'].map((m) => [m, calib(predictions[iMeilleure], m)])),
    },
    par_ligue: parLigue,
    indisponibles,
  };
}

if (process.argv[1]?.endsWith('backtest.js')) {
  const t0 = Date.now();
  const resume = await lancerBacktest();
  mkdirSync('data/backtest', { recursive: true });
  writeFileSync('data/backtest/resume.json', `${JSON.stringify(resume, null, 1)}\n`);
  console.log(`Terminé en ${Math.round((Date.now() - t0) / 1000)} s · meilleurs réglages : demi-vie ${resume.meilleure.demi_vie} j, prior ${resume.meilleure.prior}`);
  for (const c of resume.configurations) {
    console.log(`  ${c.actuelle ? '*' : ' '} ${c.demi_vie} j / prior ${c.prior} : n=${c.n} · Brier moyen 1,5-3,5 ${c.brier_moyen_1_5_a_3_5} · Brier 2,5 ${c.marche.brier_modele} (marché ${c.marche.brier_marche}) · value ${c.value.paris} paris, ROI ${c.value.roi}`);
  }
  if (resume.indisponibles.length) console.log(`  indisponibles : ${resume.indisponibles.join(', ')}`);
}
