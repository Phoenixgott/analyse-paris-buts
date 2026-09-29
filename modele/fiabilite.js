// Mesures de fiabilité des probabilités (fonctions pures, testées).
//   Brier   = moyenne de (p − résultat)², résultat = 1 si l'événement a eu lieu, 0 sinon.
//             0 = parfait ; 0,25 = répondre « 50 % » à chaque fois.
//   Log-loss = −moyenne de [r·ln p + (1 − r)·ln(1 − p)], p borné à [0,001 ; 0,999].
//             Punit fortement les certitudes démenties (0,693 = « 50 % » à chaque fois).
//   Calibration : par tranche de probabilité annoncée, fréquence réellement observée.

export const MARCHES_FIABILITE = [
  ...[0, 1, 2, 3, 4, 5].map((k) => ({ marche: `over_${k}_5`, libelle: `Plus de ${k},5 but${k >= 2 ? 's' : ''}` })),
  { marche: 'mt_over_0_5', libelle: 'Plus de 0,5 but en 1re MT' },
  { marche: 'mt_over_1_5', libelle: 'Plus de 1,5 but en 1re MT' },
];

export const SEUIL_ECHANTILLON = 100;
const BORNE = 0.001;

export function brier(paires) {
  if (!paires.length) return null;
  return paires.reduce((s, { p, r }) => s + (p - r) ** 2, 0) / paires.length;
}

export function logLoss(paires) {
  if (!paires.length) return null;
  return -paires.reduce((s, { p, r }) => {
    const q = Math.min(1 - BORNE, Math.max(BORNE, p));
    return s + (r ? Math.log(q) : Math.log(1 - q));
  }, 0) / paires.length;
}

/** Calibration en `nb` tranches égales : { de, a, n, p_moy, frequence } (tranches vides : n = 0). */
export function calibration(paires, nb = 10) {
  const tranches = Array.from({ length: nb }, (_, i) => ({ de: i / nb, a: (i + 1) / nb, n: 0, somme_p: 0, somme_r: 0 }));
  for (const { p, r } of paires) {
    const t = tranches[Math.min(nb - 1, Math.floor(p * nb))];
    t.n++;
    t.somme_p += p;
    t.somme_r += r;
  }
  return tranches.map(({ de, a, n, somme_p, somme_r }) => ({ de, a, n, p_moy: n ? somme_p / n : null, frequence: n ? somme_r / n : null }));
}

/** Événement réalisé ? (1/0) pour un marché, selon le score final et le score à la pause ; null si inconnu. */
export function realise(marche, score, scoreMt) {
  const total = (s) => (s ? s.split('-').map(Number).reduce((a, b) => a + b, 0) : null);
  const m = /^(mt_)?over_(\d)_5$/.exec(marche);
  if (!m) return null;
  const t = total(m[1] ? scoreMt : score);
  return t == null ? null : Number(t > Number(m[2]));
}

/**
 * Évalue des prédictions archivées. predictions : [{ match_id, competition_id, probas: {marche: p},
 * marche: {marche: p du marché} }] ; resultats : Map match_id → { statut, score, score_mt }.
 * Renvoie les paires { marche, competition_id, p, p_marche, r } des matchs terminés.
 */
export function paires(predictions, resultats) {
  const sortie = [];
  for (const pr of predictions) {
    const res = resultats.get(pr.match_id);
    if (res?.statut !== 'termine') continue;
    for (const { marche } of MARCHES_FIABILITE) {
      const p = pr.probas?.[marche];
      const r = realise(marche, res.score, res.score_mt);
      if (p == null || r == null) continue;
      sortie.push({ marche, competition_id: pr.competition_id, p, p_marche: pr.marche?.[marche] ?? null, r, match_id: pr.match_id });
    }
  }
  return sortie;
}

/** Résumé par marché : n, Brier et log-loss du modèle, et du marché sur les mêmes matchs quand il est connu. */
export function resumeParMarche(liste) {
  return MARCHES_FIABILITE.map(({ marche, libelle }) => {
    const du = liste.filter((x) => x.marche === marche);
    const avecMarche = du.filter((x) => x.p_marche != null);
    return {
      marche,
      libelle,
      n: du.length,
      brier: brier(du),
      log_loss: logLoss(du),
      n_marche: avecMarche.length,
      brier_modele_vs: brier(avecMarche),
      brier_marche: brier(avecMarche.map((x) => ({ p: x.p_marche, r: x.r }))),
    };
  });
}

export function nombreMatchs(liste) {
  return new Set(liste.map((x) => x.match_id)).size;
}
