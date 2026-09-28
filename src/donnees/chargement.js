// Chargement des données affichées :
//   - « local » : matchs collectés par prompt, stockés sur l'appareil ; le modèle est calculé ici même,
//     avec l'historique de la ligue publié sous <base>data/ligues/ ;
//   - « demo » (ou une journée publiée) : JSON sous <base>data/.
// En hors ligne, le service worker répond depuis son cache (stratégie « réseau d'abord »).
import { jourParis } from '../format.js';
import * as local from './local.js';
import { analyserMatch, VERSION_MODELE } from '../../modele/analyser.js';
import { construireIndex } from '../../scripts/lib/index-jour.js';

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

/** Historique d'une ligue (football-data.co.uk) ou null s'il n'existe pas / n'est pas joignable. */
export function chargerHistorique(competitionId) {
  if (!competitionId) return Promise.resolve(null);
  return chargerJSON(`ligues/${competitionId}.json`).catch(() => null);
}

/** Noms d'équipes de la saison, par compétition (pour les prompts et l'import). */
export async function chargerNoms(ids) {
  const noms = new Map();
  await Promise.all([...new Set(ids)].filter(Boolean).map(async (id) => {
    const h = await chargerHistorique(id);
    if (h?.equipes_saison?.length) noms.set(id, h.equipes_saison);
  }));
  return noms;
}

const maintenant = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const jourDe = (m) => jourParis(new Date(m.coup_envoi));

/** Calcul du modèle pour un match local, mis en cache tant que ni la fiche ni l'historique ne changent. */
export async function calculerModeleLocal(match) {
  const historique = await chargerHistorique(match.competition.id);
  const cle = `${match.generated_at}|${historique?.maj ?? 'sans-historique'}|${VERSION_MODELE}`;
  const cache = await local.lire('modeles', match.match_id);
  if (cache?.cle === cle) return cache.modele;
  const modele = analyserMatch(match, historique?.matchs ?? [], { calculeLe: maintenant() });
  await local.ecrire('modeles', [{ match_id: match.match_id, cle, modele }]);
  return modele;
}

export async function joursLocaux() {
  const matchs = await local.lister('matchs');
  return [...new Set(matchs.map(jourDe))].sort();
}

async function journeeLocale(jour) {
  const matchs = (await local.lister('matchs')).filter((m) => jourDe(m) === jour);
  const modeles = new Map();
  for (const m of matchs) modeles.set(m.match_id, await calculerModeleLocal(m));
  return construireIndex(matchs, { date: jour, demo: false, genereLe: maintenant() }, modeles);
}

/**
 * Journée à afficher. Sans choix : aujourd'hui (Europe/Paris) si des matchs ont été collectés,
 * sinon la démo (toujours signalée). jourDemande = « demo » ou AAAA-MM-JJ.
 */
export async function chargerJournee(jourDemande = null) {
  const aujourdhui = jourParis();
  const jours = await joursLocaux();
  const demo = async () => {
    const general = await chargerJSON('index.json');
    return { dossier: general.demo, jour: 'demo', aujourdhui, jours, index: await chargerJSON(`${general.demo}/index.json`), reel: false };
  };
  if (jourDemande === 'demo') return demo();
  const jour = jourDemande ?? aujourdhui;
  if (jours.includes(jour)) return { dossier: 'local', jour, aujourdhui, jours, index: await journeeLocale(jour), reel: true };
  if (jourDemande) return { dossier: 'local', jour, aujourdhui, jours, index: { date: jour, demo: false, matchs: [] }, reel: true };
  return demo();
}

export async function chargerMatch(dossier, matchId) {
  if (dossier === 'local') {
    const m = await local.lire('matchs', matchId);
    if (!m) throw new Error('match introuvable sur cet appareil');
    return m;
  }
  return chargerJSON(`${dossier}/matchs/${matchId}.json`);
}

/** Calculs du modèle ; null s'ils n'ont pas (encore) été publiés pour ce match. */
export async function chargerModele(dossier, matchId) {
  if (dossier === 'local') {
    const m = await local.lire('matchs', matchId);
    return m ? calculerModeleLocal(m) : null;
  }
  return chargerJSON(`${dossier}/modeles/${matchId}.json`).catch(() => null);
}

/** Précharge les fiches publiées du jour (palier 1 d'abord) pour qu'elles s'ouvrent aussi hors ligne. */
export function prechargerFiches(dossier, resumes, limite = 80) {
  if (!navigator.onLine || dossier === 'local') return;
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
