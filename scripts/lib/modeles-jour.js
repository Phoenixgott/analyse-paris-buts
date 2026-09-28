// Calcule le modèle de chaque match d'une journée et réécrit l'index du jour.
//   data/<dossier>/matchs/<id>.json   → data/<dossier>/modeles/<id>.json
// Historique de ligue lu dans data/<dossier>/ligues/<competition>.json, sinon data/ligues/<competition>.json.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { analyserMatch } from '../../modele/analyser.js';
import { construireIndex } from './index-jour.js';

const lire = (chemin) => JSON.parse(readFileSync(chemin, 'utf8'));
const ecrire = (chemin, objet) => writeFileSync(chemin, `${JSON.stringify(objet, null, 2)}\n`);

export function chargerHistoriqueLigue(dossier, competitionId, racine = 'data') {
  if (!competitionId) return { matchs: [], source: null };
  for (const chemin of [`${racine}/${dossier}/ligues/${competitionId}.json`, `${racine}/ligues/${competitionId}.json`]) {
    if (existsSync(chemin)) return { matchs: lire(chemin).matchs ?? [], source: chemin };
  }
  return { matchs: [], source: null };
}

export function calculerJournee(dossier, { calculeLe, date, demo, reglages, racine = 'data' }) {
  const base = `${racine}/${dossier}`;
  const matchs = readdirSync(`${base}/matchs`)
    .filter((f) => f.endsWith('.json'))
    .map((f) => lire(`${base}/matchs/${f}`));

  mkdirSync(`${base}/modeles`, { recursive: true });
  const modeles = new Map();
  const bilan = [];
  for (const match of matchs) {
    const historique = chargerHistoriqueLigue(dossier, match.competition.id, racine);
    const modele = analyserMatch(match, historique.matchs, { calculeLe, reglages });
    modeles.set(match.match_id, modele);
    ecrire(`${base}/modeles/${match.match_id}.json`, modele);
    const v = modele.verdict;
    bilan.push(
      `${match.match_id} : qualité ${match.qualite_donnees}/100 · buts attendus ${modele.buts_attendus?.total ?? 'N/D'} · ` +
        `confiance ${modele.confiance.indice ?? 'N/D'} · ${v.decision}${v.libelle ? ` ${v.libelle} @${v.cote} (value ${Math.round(v.value * 1000) / 10} %)` : ` (${v.raison})`}`,
    );
  }
  ecrire(`${base}/index.json`, construireIndex(matchs, { date, demo, genereLe: calculeLe }, modeles));
  return bilan;
}
