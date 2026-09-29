// Services du journal : réglages, paris, résolution automatique et alertes (stockage local).
import * as local from '../donnees/local.js';
import { jourParis } from '../format.js';
import { depassements, limitesDuJour, resoudreAutomatiquement } from './paris.js';
import { alerteLimite, alerteResolution, alerteValueBets, envoyerAlerte, topicValide } from '../alertes/ntfy.js';

export const REGLAGES_DEFAUT = {
  cle: 'journal',
  bankroll_initiale: null,
  mise_max_jour: null,
  stop_loss: null,
  ntfy_topic: '',
  alertes_value: true,
  alertes_limites: true,
  alertes_resolutions: true,
};

export const maintenant = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
export const jourDe = (iso) => jourParis(new Date(iso));

export async function lireReglages() {
  return { ...REGLAGES_DEFAUT, ...((await local.lire('reglages', 'journal')) ?? {}) };
}

export async function ecrireReglages(reglages) {
  await local.ecrire('reglages', [{ ...REGLAGES_DEFAUT, ...reglages, cle: 'journal' }]);
}

export async function listerParis() {
  return (await local.lister('paris')).sort((a, b) => b.cree_le.localeCompare(a.cree_le));
}

export function nouvelId() {
  return crypto.randomUUID?.() ?? `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Envoie une alerte si le canal est réglé et le type d'alerte activé ; ne lève jamais d'erreur. */
export async function alerter(type, contenu) {
  const r = await lireReglages();
  if (!topicValide(r.ntfy_topic) || !r[`alertes_${type}`]) return { envoye: false, raison: 'alertes désactivées ou canal non réglé' };
  try {
    await envoyerAlerte(r.ntfy_topic, contenu.message, { titre: contenu.titre, tags: contenu.tags, priorite: contenu.priorite });
    return { envoye: true };
  } catch (e) {
    return { envoye: false, raison: e.message };
  }
}

/** Résout les paris en cours avec les résultats connus ; enregistre et alerte. Renvoie les paris résolus. */
export async function resoudreEnAttente() {
  const [paris, resultats] = await Promise.all([local.lister('paris'), local.lister('resultats')]);
  const resolus = resoudreAutomatiquement(paris, new Map(resultats.map((r) => [r.match_id, r])), maintenant());
  if (resolus.length) {
    await local.ecrire('paris', resolus);
    await alerter('resolutions', alerteResolution(resolus));
  }
  return resolus;
}

/** Limites du jour et, si un nouveau pari les dépasse, les messages d'avertissement. */
export async function verifierLimites(nouvelleMise = 0) {
  const [paris, reglages] = await Promise.all([local.lister('paris'), lireReglages()]);
  const limites = limitesDuJour(paris, reglages, jourParis(), jourDe);
  return { limites, alertes: nouvelleMise > 0 ? depassements(limites, nouvelleMise) : null };
}

export async function alerterLimites(messages) {
  return alerter('limites', alerteLimite(messages));
}

/** Alerte des nouveaux value bets (jamais deux fois le même). */
export async function alerterValueBets(picks) {
  const deja = new Set((await local.lire('reglages', 'alertes-envoyees'))?.cles ?? []);
  const nouveaux = picks.filter((p) => !p.demo && !deja.has(p.cle));
  if (!nouveaux.length) return { envoye: false, raison: 'aucun nouveau value bet' };
  const res = await alerter('value', alerteValueBets(nouveaux));
  if (res.envoye) await local.ecrire('reglages', [{ cle: 'alertes-envoyees', cles: [...deja, ...nouveaux.map((p) => p.cle)].slice(-500) }]);
  return { ...res, nombre: nouveaux.length };
}
