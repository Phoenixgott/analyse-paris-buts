// Générateur du prompt d'analyse IA et de l'export .json (fonctions pures, testées).
//   - remplacement en une seule passe : le contenu injecté n'est jamais relu comme un modèle ;
//   - « {{ » éventuellement présent dans une donnée est neutralisé (JSON : {, texte : « { { »),
//     pour qu'aucun {{…}} ne puisse subsister ou être fabriqué dans le prompt final ;
//   - contrôles renvoyés avec le texte : aucun {{…}} restant, JSON valides et fidèles aux données.
import { MODELE_PROMPT, PLACEHOLDERS } from './modele-prompt.js';
import { dateLongue, heure } from '../format.js';

export const MOTIF_RESTANT = /\{\{[^{}]*\}\}/g;

/** JSON compact sans « {{ » (hors chaînes, un objet JSON ne peut pas contenir « {{ »). */
export function jsonSur(valeur) {
  return JSON.stringify(valeur ?? null).replace(/\{\{/g, '{\\u007b');
}

const texteSur = (t) => String(t ?? 'donnée absente').replace(/\{\{/g, '{ {').replace(/\}\}/g, '} }');

export function valeursPrompt(match, modele) {
  const competition = [match.competition.nom, match.competition.pays].filter(Boolean).join(', ');
  return {
    EQUIPE_DOM: texteSur(match.equipes.domicile.nom),
    EQUIPE_EXT: texteSur(match.equipes.exterieur.nom),
    // Règle 3 : une démo reste signalée comme telle, jusque dans le prompt.
    COMPETITION: texteSur(match.demo ? `${competition} (DÉMO : données fictives, ne pas parier)` : competition),
    DATE_HEURE: texteSur(`${dateLongue(match.coup_envoi)} à ${heure(match.coup_envoi)} (heure de Paris)`),
    JSON_MATCH: jsonSur(match),
    JSON_MODELE: jsonSur(modele),
  };
}

function jsonFidele(chaine, attendu) {
  try {
    return JSON.stringify(JSON.parse(chaine)) === JSON.stringify(attendu ?? null);
  } catch {
    return false;
  }
}

/**
 * Renvoie { texte, controles: { restants, json_match_valide, json_modele_valide, ok } }.
 * modele peut être null (calculs non publiés) : le prompt contient alors « null ».
 */
export function genererPrompt(match, modele) {
  const valeurs = valeursPrompt(match, modele);
  const texte = MODELE_PROMPT.replace(/\{\{([A-Z_]+)\}\}/g, (tout, cle) => (cle in valeurs ? valeurs[cle] : tout));
  const restants = texte.match(MOTIF_RESTANT) ?? [];
  const controles = {
    restants,
    json_match_valide: jsonFidele(valeurs.JSON_MATCH, match),
    json_modele_valide: jsonFidele(valeurs.JSON_MODELE, modele),
  };
  controles.ok = restants.length === 0 && controles.json_match_valide && controles.json_modele_valide && PLACEHOLDERS.every((p) => !texte.includes(`{{${p}}}`));
  return { texte, controles };
}

/** Contenu du fichier exporté (.json). */
export function contenuExport(match, modele, texte, exporteLe = new Date().toISOString()) {
  return {
    format: 'analyse-paris-buts/export',
    version: 1,
    exporte_le: exporteLe,
    demo: match.demo,
    avertissement: 'Probabilités estimées, pas des certitudes. 18+. Aide : joueurs-info-service.fr',
    match,
    modele: modele ?? null,
    prompt: texte,
  };
}

export const nomFichierExport = (match) => `analyse-${match.match_id}${match.demo ? '-DEMO' : ''}.json`;
