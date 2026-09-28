// Télécharge l'historique des résultats (saison en cours + précédente) depuis football-data.co.uk,
// fichiers publics sans clé ni compte, et écrit data/ligues/<competition>.json pour le modèle.
// Une source indisponible est signalée et le fichier existant est conservé (jamais remplacé par du vide).
// Usage : node scripts/historiques/telecharger.js [id-competition ...]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { COMPETITIONS, saisonsEuropeennes } from '../../src/collecte/competitions.js';
import { equipesDe, lireCsv, matchDepuisLigne } from './csv.js';

const BASE = 'https://www.football-data.co.uk';
const DOSSIER = 'data/ligues';

async function telechargerTexte(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'analyse-paris-buts (usage personnel)' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function historique(c, maintenant) {
  if (c.format === 'nouveau') {
    // Un seul fichier toutes saisons ; saisons civiles (MLS).
    const annee = maintenant.getUTCFullYear();
    const lignes = lireCsv(await telechargerTexte(`${BASE}/new/${c.fd}.csv`)).filter((l) => l.League === c.ligue);
    const saison = (s) => lignes.filter((l) => l.Season === String(s)).map(matchDepuisLigne).filter(Boolean);
    const courante = saison(annee);
    return { saisons: [String(annee - 1), String(annee)], precedente: saison(annee - 1), courante };
  }
  const { courante: sc, precedente: sp } = saisonsEuropeennes(maintenant);
  const lire = async (s) => {
    try {
      return lireCsv(await telechargerTexte(`${BASE}/mmz4281/${s}/${c.fd}.csv`)).map(matchDepuisLigne).filter(Boolean);
    } catch (e) {
      // Début de saison : le fichier de la nouvelle saison peut ne pas exister encore.
      if (s === sc && /HTTP 404/.test(e.message)) return [];
      throw e;
    }
  };
  return { saisons: [sp, sc], precedente: await lire(sp), courante: await lire(sc) };
}

export async function telechargerTout(ids = [], maintenant = new Date()) {
  mkdirSync(DOSSIER, { recursive: true });
  const bilan = [];
  for (const c of COMPETITIONS.filter((x) => x.fd && (!ids.length || ids.includes(x.id)))) {
    const chemin = `${DOSSIER}/${c.id}.json`;
    try {
      const h = await historique(c, maintenant);
      const matchs = [...h.precedente, ...h.courante].sort((a, b) => a.date.localeCompare(b.date) || a.domicile.localeCompare(b.domicile));
      if (!matchs.length) throw new Error('aucun match lu');
      const contenu = {
        competition_id: c.id,
        nom: c.nom,
        source: 'football-data.co.uk',
        saisons: h.saisons,
        maj: maintenant.toISOString().replace(/\.\d+Z$/, 'Z'),
        equipes_saison: equipesDe(h.courante.length ? h.courante : h.precedente),
        matchs,
      };
      // On ne réécrit que si les matchs ont changé (évite un commit quotidien pour rien).
      const ancien = existsSync(chemin) ? JSON.parse(readFileSync(chemin, 'utf8')) : null;
      if (ancien && JSON.stringify(ancien.matchs) === JSON.stringify(matchs) && JSON.stringify(ancien.equipes_saison) === JSON.stringify(contenu.equipes_saison)) {
        bilan.push(`${c.id} : inchangé (${matchs.length} matchs)`);
        continue;
      }
      writeFileSync(chemin, `${JSON.stringify(contenu)}\n`);
      bilan.push(`${c.id} : ${matchs.length} matchs (${h.precedente.length} saison ${h.saisons[0]}, ${h.courante.length} saison ${h.saisons[1]})`);
    } catch (e) {
      bilan.push(`${c.id} : INDISPONIBLE (${e.message}) — fichier existant conservé`);
    }
  }
  return bilan;
}

if (process.argv[1]?.endsWith('telecharger.js')) {
  const bilan = await telechargerTout(process.argv.slice(2));
  for (const l of bilan) console.log(l);
  if (bilan.every((l) => l.includes('INDISPONIBLE'))) process.exit(1);
}
