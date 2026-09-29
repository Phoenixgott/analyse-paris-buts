// Journal de paris : création, résolution, statistiques, limites personnelles, export CSV.
// Fonctions pures (testées) ; le stockage est dans donnees/local.js.
import { memeJoueur } from '../collecte/noms.js';

export const STATUTS = { en_cours: 'En cours', gagne: 'Gagné', perdu: 'Perdu', rembourse: 'Remboursé', annule: 'Annulé' };

export const MARCHES = [
  ...[0, 1, 2, 3, 4, 5].flatMap((k) => [
    { marche: `over_${k}_5`, libelle: `Plus de ${k},5 but${k >= 2 ? 's' : ''}` },
    { marche: `under_${k}_5`, libelle: `Moins de ${k},5 but${k >= 2 ? 's' : ''}` },
  ]),
  { marche: 'mt_over_0_5', libelle: 'Plus de 0,5 but en 1re MT' },
  { marche: 'mt_over_1_5', libelle: 'Plus de 1,5 but en 1re MT' },
  { marche: 'autre', libelle: 'Autre (résolution manuelle)' },
];

export function libelleMarche(marche) {
  if (marche?.startsWith('buteur:')) return `Buteur : ${marche.slice(7)}`;
  return MARCHES.find((m) => m.marche === marche)?.libelle ?? marche;
}

const arrondi2 = (x) => Math.round(x * 100) / 100;

/** Vérifie et normalise un pari saisi ; renvoie { pari } ou { erreur }. */
export function creerPari(donnees, { id, maintenant }) {
  const cote = Number(String(donnees.cote ?? '').replace(',', '.'));
  const mise = Number(String(donnees.mise ?? '').replace(',', '.'));
  const libelleMatch = String(donnees.libelle_match ?? '').trim();
  const marche = String(donnees.marche ?? '').trim();
  if (!libelleMatch) return { erreur: 'Indique le match.' };
  if (!marche) return { erreur: 'Choisis le marché.' };
  if (!Number.isFinite(cote) || cote < 1.01 || cote > 1000) return { erreur: 'La cote doit être un nombre entre 1,01 et 1000.' };
  if (!Number.isFinite(mise) || mise <= 0 || mise > 1e6) return { erreur: 'La mise doit être un montant positif.' };
  return {
    pari: {
      id,
      cree_le: maintenant,
      demo: false,
      match_id: donnees.match_id ?? null,
      dossier: donnees.dossier ?? null,
      date_match: donnees.date_match ?? maintenant.slice(0, 10),
      coup_envoi: donnees.coup_envoi ?? null,
      libelle_match: libelleMatch.slice(0, 120),
      competition: donnees.competition ?? null,
      marche,
      libelle_marche: libelleMarche(marche),
      cote: arrondi2(cote),
      mise: arrondi2(mise),
      proba_modele: donnees.proba_modele ?? null,
      value: donnees.value ?? null,
      statut: 'en_cours',
      gain: null,
      resultat: null,
      resolu_le: null,
      resolution: null,
      note: String(donnees.note ?? '').trim().slice(0, 300),
    },
  };
}

export function gainSelonStatut(pari, statut) {
  if (statut === 'gagne') return arrondi2(pari.mise * (pari.cote - 1));
  if (statut === 'perdu') return -pari.mise;
  if (statut === 'rembourse' || statut === 'annule') return 0;
  return null;
}

const buts = (score) => (score ? score.split('-').map(Number).reduce((a, b) => a + b, 0) : null);

/**
 * Résultat d'un pari selon le score. resultat = { statut: 'termine'|'reporte'|'abandonne', score, score_mt, buteurs: [{nom, equipe, csc}] | null }.
 * Renvoie { statut, raison } ; statut null = impossible à trancher automatiquement (à faire à la main).
 */
export function trancher(pari, resultat) {
  if (!resultat) return { statut: null, raison: 'Résultat inconnu' };
  if (resultat.statut === 'reporte' || resultat.statut === 'abandonne') return { statut: 'annule', raison: `Match ${resultat.statut === 'reporte' ? 'reporté' : 'abandonné'} : pari annulé (règle la plus courante, vérifie celle de ton bookmaker)` };
  const m = /^(over|under)_(\d)_5$/.exec(pari.marche);
  if (m) {
    const total = buts(resultat.score);
    if (total == null) return { statut: null, raison: 'Score final inconnu' };
    const k = Number(m[2]);
    const gagne = m[1] === 'over' ? total > k : total <= k;
    return { statut: gagne ? 'gagne' : 'perdu', raison: `${total} but(s) : ${gagne ? 'gagné' : 'perdu'}` };
  }
  const mt = /^mt_over_(\d)_5$/.exec(pari.marche);
  if (mt) {
    const total = buts(resultat.score_mt);
    if (total == null) return { statut: null, raison: 'Score à la mi-temps inconnu' };
    const gagne = total > Number(mt[1]);
    return { statut: gagne ? 'gagne' : 'perdu', raison: `${total} but(s) en 1re MT : ${gagne ? 'gagné' : 'perdu'}` };
  }
  if (pari.marche.startsWith('buteur:')) {
    if (!Array.isArray(resultat.buteurs)) return { statut: null, raison: 'Liste des buteurs inconnue' };
    const nom = pari.marche.slice(7);
    const trouve = resultat.buteurs.filter((b) => !b.csc).some((b) => memeJoueur(b.nom, nom));
    // Un joueur absent de la feuille de match est souvent remboursé : impossible à savoir d'ici.
    return trouve ? { statut: 'gagne', raison: `${nom} a marqué` } : { statut: null, raison: `${nom} n'est pas dans la liste des buteurs : vérifie s'il a joué (perdu) ou non (souvent remboursé)` };
  }
  return { statut: null, raison: 'Marché à résoudre à la main' };
}

/** Applique les résultats connus aux paris en cours. resultats : Map match_id → résultat. */
export function resoudreAutomatiquement(paris, resultats, maintenant) {
  const resolus = [];
  for (const p of paris) {
    if (p.statut !== 'en_cours' || !p.match_id) continue;
    const r = resultats.get(p.match_id);
    const { statut, raison } = trancher(p, r);
    if (!statut) continue;
    resolus.push({ ...p, statut, gain: gainSelonStatut(p, statut), resultat: { score: r.score, score_mt: r.score_mt, raison }, resolu_le: maintenant, resolution: 'auto' });
  }
  return resolus;
}

export function resoudreManuellement(pari, statut, maintenant, raison = 'Saisi à la main') {
  return { ...pari, statut, gain: gainSelonStatut(pari, statut), resultat: { ...(pari.resultat ?? {}), raison }, resolu_le: maintenant, resolution: 'manuel' };
}

/** Statistiques et courbe de bankroll (paris classés par date de résolution). */
export function statistiques(paris, bankrollInitiale = null) {
  const resolus = paris.filter((p) => p.statut !== 'en_cours').sort((a, b) => (a.resolu_le ?? '').localeCompare(b.resolu_le ?? ''));
  const joues = resolus.filter((p) => p.statut === 'gagne' || p.statut === 'perdu');
  const gagnes = joues.filter((p) => p.statut === 'gagne').length;
  const mises = joues.reduce((s, p) => s + p.mise, 0);
  const gains = resolus.reduce((s, p) => s + (p.gain ?? 0), 0);
  const depart = Number.isFinite(bankrollInitiale) ? bankrollInitiale : 0;
  let cumul = depart;
  const courbe = [{ date: null, bankroll: depart, libelle: 'Départ' }];
  for (const p of resolus) {
    cumul = arrondi2(cumul + (p.gain ?? 0));
    courbe.push({ date: p.resolu_le, bankroll: cumul, libelle: `${p.libelle_match} — ${p.libelle_marche}` });
  }
  return {
    nb: paris.length,
    en_cours: paris.filter((p) => p.statut === 'en_cours').length,
    gagnes,
    perdus: joues.length - gagnes,
    rembourses: resolus.length - joues.length,
    mises: arrondi2(mises),
    gains: arrondi2(gains),
    roi: mises > 0 ? gains / mises : null,
    taux_reussite: joues.length ? gagnes / joues.length : null,
    bankroll: Number.isFinite(bankrollInitiale) ? arrondi2(depart + gains) : null,
    courbe,
  };
}

/** Limites du jour (Europe/Paris) : total misé et résultat net des paris placés ce jour-là. */
export function limitesDuJour(paris, reglages, jour, jourDe) {
  const duJour = paris.filter((p) => jourDe(p.cree_le) === jour);
  const misesJour = arrondi2(duJour.reduce((s, p) => s + p.mise, 0));
  const netJour = arrondi2(duJour.reduce((s, p) => s + (p.gain ?? 0), 0));
  const miseMax = Number.isFinite(reglages?.mise_max_jour) && reglages.mise_max_jour > 0 ? reglages.mise_max_jour : null;
  const stopLoss = Number.isFinite(reglages?.stop_loss) && reglages.stop_loss > 0 ? reglages.stop_loss : null;
  return {
    mises_jour: misesJour,
    net_jour: netJour,
    mise_max_jour: miseMax,
    stop_loss: stopLoss,
    reste_a_miser: miseMax == null ? null : arrondi2(Math.max(0, miseMax - misesJour)),
    mise_max_atteinte: miseMax != null && misesJour >= miseMax,
    stop_loss_atteint: stopLoss != null && netJour <= -stopLoss,
  };
}

export const eurosFr = (x) => `${x < 0 ? '−' : ''}${Math.abs(x).toFixed(2).replace('.', ',')} €`;

/** Ce qu'un nouveau pari ferait dépasser (message à confirmer), ou null. */
export function depassements(limites, nouvelleMise) {
  const alertes = [];
  if (limites.stop_loss_atteint) alertes.push(`Stop-loss atteint aujourd'hui (${eurosFr(limites.net_jour)} pour une limite de −${eurosFr(limites.stop_loss)}).`);
  if (limites.mise_max_jour != null && limites.mises_jour + nouvelleMise > limites.mise_max_jour) {
    alertes.push(`Ce pari porterait tes mises du jour à ${eurosFr(limites.mises_jour + nouvelleMise)} pour une limite de ${eurosFr(limites.mise_max_jour)}.`);
  }
  return alertes.length ? alertes : null;
}

const nombreCsv = (x) => (x == null ? '' : String(x).replace('.', ','));
const texteCsv = (t) => `"${String(t ?? '').replace(/"/g, '""')}"`;

/** Export CSV pour tableur français (séparateur « ; », virgule décimale, BOM UTF-8). */
export function versCsv(paris) {
  const entetes = ['date_pari', 'date_match', 'match', 'competition', 'marche', 'cote', 'mise_eur', 'statut', 'gain_eur', 'score', 'score_mt', 'proba_modele', 'value', 'resolution', 'note'];
  const lignes = [...paris]
    .sort((a, b) => a.cree_le.localeCompare(b.cree_le))
    .map((p) => [
      p.cree_le, p.date_match, texteCsv(p.libelle_match), texteCsv(p.competition), texteCsv(p.libelle_marche), nombreCsv(p.cote), nombreCsv(p.mise),
      STATUTS[p.statut], nombreCsv(p.gain), p.resultat?.score ?? '', p.resultat?.score_mt ?? '', nombreCsv(p.proba_modele), nombreCsv(p.value), p.resolution ?? '', texteCsv(p.note),
    ].join(';'));
  return `﻿${entetes.join(';')}\r\n${lignes.join('\r\n')}\r\n`;
}
