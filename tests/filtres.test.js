import { describe, expect, it } from 'vitest';
import { FILTRES_VIDES, filtrerMatchs, optionsFiltres, trierMatchs } from '../src/accueil/filtres.js';
import { EXPLICATIONS } from '../src/explications.js';
import { lireJSON, schema } from './aides.js';

const { matchs } = lireJSON('data/demo/index.json');
const ids = (liste) => liste.map((m) => m.match_id);

describe('filtres de l’accueil', () => {
  it('sans filtre, garde tous les matchs', () => {
    expect(filtrerMatchs(matchs, FILTRES_VIDES)).toHaveLength(6);
  });

  it('filtre par pays, compétition, catégorie et tranche horaire (heure de Paris)', () => {
    expect(ids(filtrerMatchs(matchs, { ...FILTRES_VIDES, pays: 'France' })).sort()).toEqual([
      'demo-d1f-montaval-clairefont',
      'demo-l1-valmont-rivebelle',
    ]);
    expect(ids(filtrerMatchs(matchs, { ...FILTRES_VIDES, competition: 'Serie A' }))).toEqual(['demo-sa-montecolle-valdoro']);
    expect(ids(filtrerMatchs(matchs, { ...FILTRES_VIDES, categorie: 'F' }))).toEqual(['demo-d1f-montaval-clairefont']);
    expect(ids(filtrerMatchs(matchs, { ...FILTRES_VIDES, categorie: 'INT' }))).toEqual(['demo-int-nordalie-valdoranie']);
    // 13:00 et 15:00 à Paris → « Avant 14 h » ne garde que 13:00.
    expect(ids(filtrerMatchs(matchs, { ...FILTRES_VIDES, tranche: 'matin' }))).toEqual(['demo-no-fjellby-havnstad']);
    expect(filtrerMatchs(matchs, { ...FILTRES_VIDES, tranche: 'nuit' })).toHaveLength(1); // 21:00
  });

  it('combine les filtres', () => {
    expect(filtrerMatchs(matchs, { ...FILTRES_VIDES, pays: 'France', categorie: 'INT' })).toEqual([]);
  });

  it('propose uniquement les options présentes dans la journée', () => {
    const o = optionsFiltres(matchs);
    expect(o.categorie).toEqual(['H', 'F', 'INT']);
    expect(o.pays).toEqual(['Angleterre', 'France', 'International', 'Italie', 'Norvège']);
  });
});

describe('tris de l’accueil', () => {
  it('trie par heure de coup d’envoi', () => {
    const heures = trierMatchs(matchs, 'heure').map((m) => m.coup_envoi);
    expect(heures).toEqual([...heures].sort());
  });

  it('trie par ligue : palier 1 avant palier 2, puis pays et compétition', () => {
    const tries = trierMatchs(matchs, 'ligue');
    expect(tries.at(-1).competition.palier).toBe(2);
    expect(tries[0].competition.pays).toBe('Angleterre');
  });

  it('ne modifie pas la liste d’origine', () => {
    const copie = [...matchs];
    trierMatchs(matchs, 'ligue');
    expect(matchs).toEqual(copie);
  });
});

describe('info-bulles', () => {
  it('chaque pourcentage et chaque statistique du schéma a une explication', () => {
    const cles = Object.keys(schema.$defs.equipe.properties.stats.properties);
    for (const cle of cles) expect(EXPLICATIONS[cle], cle).toBeTruthy();
    expect(EXPLICATIONS.qualite_donnees).toMatch(/40\/100/);
  });
});
