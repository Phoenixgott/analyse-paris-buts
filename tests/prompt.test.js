import { describe, expect, it } from 'vitest';
import { MODELE_PROMPT, PLACEHOLDERS } from '../src/prompt/modele-prompt.js';
import { contenuExport, genererPrompt, MOTIF_RESTANT, nomFichierExport } from '../src/prompt/generateur.js';
import { lireJSON, matchVide, matchsDemo } from './aides.js';

// Copie indépendante du texte du cahier des charges : toute modification du modèle fait échouer ce test.
const TEXTE_CAHIER = [
  'Tu es un analyste de paris football rigoureux. Tu ne disposes QUE des données ci-dessous.',
  "RÈGLES : chaque affirmation cite un champ du JSON ; sinon écris « donnée absente ». N'invente rien. Aucune promesse de gain.",
  '',
  'MATCH : {{EQUIPE_DOM}} vs {{EQUIPE_EXT}} — {{COMPETITION}} — {{DATE_HEURE}}',
  'DONNÉES : {{JSON_MATCH}}',
  'CALCULS DU SITE : {{JSON_MODELE}}',
  '',
  'TÂCHES',
  '1. Contexte de chaque équipe (5 lignes max : forme, absents, enjeu).',
  '2. Total de buts : ta probabilité pour Over/Under 0.5 → 5.5, comparée au modèle et aux cotes.',
  '3. Buts en 1re mi-temps : Over 0.5 et 1.5, avec justification.',
  '4. Buteurs : top 5 avec probabilité et risque (minutes, rotation).',
  '5. Trois scénarios (pessimiste, central, optimiste) avec buts attendus.',
  '6. Arguments CONTRE chaque pari envisagé (obligatoire).',
  '7. Verdict : pari recommandé avec cote minimale acceptable, ou « PASSER ».',
  '',
  "FORMAT : d'abord un bloc JSON { marches: [{marche, proba, cote_min, confiance}], verdict, risques[] }, puis un résumé de 200 mots maximum.",
].join('\n');

const ligne = (texte, prefixe) => texte.split('\n').find((l) => l.startsWith(prefixe)).slice(prefixe.length);

describe('modèle de prompt', () => {
  it('est le texte exact du cahier des charges', () => {
    expect(MODELE_PROMPT).toBe(TEXTE_CAHIER);
  });

  it('contient les 6 emplacements et aucun autre', () => {
    const trouves = [...MODELE_PROMPT.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]);
    expect(trouves.sort()).toEqual([...PLACEHOLDERS].sort());
  });
});

describe('prompt généré pour les 6 matchs de démo', () => {
  for (const match of matchsDemo()) {
    const modele = lireJSON(`data/demo/modeles/${match.match_id}.json`);
    const { texte, controles } = genererPrompt(match, modele);

    it(`${match.match_id} : aucun {{…}} restant`, () => {
      expect(texte.match(MOTIF_RESTANT)).toBeNull();
      expect(controles.restants).toEqual([]);
      expect(controles.ok).toBe(true);
    });

    it(`${match.match_id} : JSON valides et identiques aux données`, () => {
      expect(JSON.parse(ligne(texte, 'DONNÉES : '))).toEqual(match);
      expect(JSON.parse(ligne(texte, 'CALCULS DU SITE : '))).toEqual(modele);
    });

    it(`${match.match_id} : en-tête lisible, démo signalée`, () => {
      const entete = ligne(texte, 'MATCH : ');
      expect(entete).toContain(`${match.equipes.domicile.nom} vs ${match.equipes.exterieur.nom}`);
      expect(entete).toContain('(heure de Paris)');
      expect(entete).toContain('DÉMO');
    });
  }
});

describe('robustesse', () => {
  it('neutralise des {{…}} présents dans les données sans altérer le JSON', () => {
    const m = matchVide();
    m.equipes.domicile.nom = '{{JSON_MATCH}}';
    m.equipes.exterieur.nom = 'FC }}{{EQUIPE_DOM}}';
    m.enjeu = 'Texte {{piège}} avec \\{{ antislash';
    const { texte, controles } = genererPrompt(m, null);
    expect(texte.match(MOTIF_RESTANT)).toBeNull();
    expect(controles.ok).toBe(true);
    expect(JSON.parse(ligne(texte, 'DONNÉES : '))).toEqual(m);
    expect(ligne(texte, 'MATCH : ')).toContain('{ {JSON_MATCH} }');
  });

  it('écrit « null » quand les calculs du modèle ne sont pas publiés', () => {
    const { texte, controles } = genererPrompt(matchVide(), null);
    expect(ligne(texte, 'CALCULS DU SITE : ')).toBe('null');
    expect(controles.ok).toBe(true);
  });

  it('ne signale pas DÉMO pour un match réel', () => {
    const { texte } = genererPrompt(matchVide(), null);
    expect(ligne(texte, 'MATCH : ')).not.toContain('DÉMO');
  });
});

describe('export .json', () => {
  it('produit un JSON valide qui contient match, calculs et prompt', () => {
    const match = matchsDemo()[0];
    const modele = lireJSON(`data/demo/modeles/${match.match_id}.json`);
    const { texte } = genererPrompt(match, modele);
    const contenu = contenuExport(match, modele, texte, '2026-09-28T10:00:00.000Z');
    const relu = JSON.parse(JSON.stringify(contenu));
    expect(relu).toEqual(contenu);
    expect(relu).toMatchObject({ format: 'analyse-paris-buts/export', version: 1, demo: true, match, modele, prompt: texte });
    expect(nomFichierExport(match)).toBe(`analyse-${match.match_id}-DEMO.json`);
  });
});
