import { readFileSync, readdirSync } from 'node:fs';

export const schema = JSON.parse(readFileSync(new URL('../schema/match.schema.json', import.meta.url), 'utf8'));

export function lireJSON(chemin) {
  return JSON.parse(readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8'));
}

export function matchsDemo() {
  const dossier = new URL('../data/demo/matchs/', import.meta.url);
  return readdirSync(dossier)
    .filter((f) => f.endsWith('.json'))
    .map((f) => lireJSON(`data/demo/matchs/${f}`));
}

const equipeVide = (nom) => ({
  id: null,
  nom,
  elo: null,
  classement: null,
  forme: null,
  stats: null,
  jours_repos: null,
  absents: null,
  compo_probable: null,
});

/** Match minimal valide où toutes les données facultatives sont absentes (null). */
export function matchVide() {
  return {
    schema_version: '1.0.0',
    demo: false,
    match_id: 'test-vide',
    generated_at: '2026-09-28T05:30:00Z',
    competition: { id: null, nom: 'Test', pays: null, categorie: 'H', palier: 2 },
    coup_envoi: '2026-09-28T18:00:00Z',
    stade: null,
    enjeu: null,
    equipes: { domicile: equipeVide('A'), exterieur: equipeVide('B') },
    h2h: null,
    arbitre: null,
    meteo: null,
    buteurs: null,
    cotes: null,
    qualite_donnees: 0,
    sources: [],
  };
}
