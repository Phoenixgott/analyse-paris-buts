// Chargement des JSON publiés sous <base>data/. En hors ligne, le service worker répond depuis son
// cache (stratégie « réseau d'abord »).
import { jourParis } from '../format.js';

const BASE_DONNEES = `${import.meta.env.BASE_URL}data/`;
const memoire = new Map();

export async function chargerJSON(chemin) {
  if (memoire.has(chemin)) return memoire.get(chemin);
  const promesse = fetch(BASE_DONNEES + chemin).then((r) => {
    if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`);
    return r.json();
  });
  memoire.set(chemin, promesse);
  promesse.catch(() => memoire.delete(chemin));
  return promesse;
}

/**
 * Journée à afficher : celle d'aujourd'hui (Europe/Paris) si la collecte l'a publiée, sinon la
 * démo (toujours signalée comme telle).
 */
export async function chargerJournee() {
  const general = await chargerJSON('index.json');
  const aujourdhui = jourParis();
  const dossier = (general.jours ?? []).includes(aujourdhui) ? aujourdhui : general.demo;
  const index = await chargerJSON(`${dossier}/index.json`);
  return { dossier, aujourdhui, index, reel: dossier === aujourdhui };
}

export function chargerMatch(dossier, matchId) {
  return chargerJSON(`${dossier}/matchs/${matchId}.json`);
}

/** Calculs du modèle ; null s'ils n'ont pas (encore) été publiés pour ce match. */
export function chargerModele(dossier, matchId) {
  return chargerJSON(`${dossier}/modeles/${matchId}.json`).catch(() => null);
}

/** Précharge les fiches du jour (palier 1 d'abord) pour qu'elles s'ouvrent aussi hors ligne. */
export function prechargerFiches(dossier, resumes, limite = 80) {
  if (!navigator.onLine) return;
  const ordre = [...resumes]
    .sort((a, b) => a.competition.palier - b.competition.palier)
    .slice(0, limite)
    .flatMap((m) => [`${dossier}/${m.fichier}`, ...(m.modele ? [`${dossier}/modeles/${m.match_id}.json`] : [])]);
  const suivant = () => {
    const chemin = ordre.shift();
    if (!chemin) return;
    chargerJSON(chemin).catch(() => {}).finally(suivant);
  };
  // Trois téléchargements en parallèle, sans gêner l'affichage.
  setTimeout(() => [suivant, suivant, suivant].forEach((f) => f()), 500);
}
