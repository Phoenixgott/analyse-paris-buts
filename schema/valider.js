// Validateur JSON Schema minimal, sans dépendance : couvre exactement les mots-clés utilisés par
// match.schema.json (type, enum, pattern, minimum, maximum, minItems, maxItems, required, properties,
// additionalProperties: false, items, $ref local). Utilisé par les tests et par la collecte.

function typeDe(valeur) {
  if (valeur === null) return 'null';
  if (Array.isArray(valeur)) return 'array';
  if (typeof valeur === 'number') return Number.isInteger(valeur) ? 'integer' : 'number';
  return typeof valeur;
}

function correspondType(valeur, attendu) {
  const t = typeDe(valeur);
  if (attendu === 'number') return t === 'number' || t === 'integer';
  return t === attendu;
}

function resoudre(racine, ref) {
  if (!ref.startsWith('#/')) throw new Error(`$ref non géré : ${ref}`);
  return ref
    .slice(2)
    .split('/')
    .reduce((noeud, cle) => noeud?.[cle], racine);
}

function verifier(valeur, schema, chemin, racine, erreurs) {
  if (schema.$ref) {
    const cible = resoudre(racine, schema.$ref);
    if (!cible) throw new Error(`$ref introuvable : ${schema.$ref}`);
    return verifier(valeur, cible, chemin, racine, erreurs);
  }

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => correspondType(valeur, t))) {
      erreurs.push(`${chemin} : type ${typeDe(valeur)} au lieu de ${types.join('|')}`);
      return;
    }
  }

  if (schema.enum && !schema.enum.includes(valeur)) {
    erreurs.push(`${chemin} : valeur ${JSON.stringify(valeur)} hors de ${JSON.stringify(schema.enum)}`);
  }

  if (valeur === null) return;

  if (typeof valeur === 'string' && schema.pattern && !new RegExp(schema.pattern).test(valeur)) {
    erreurs.push(`${chemin} : « ${valeur} » ne respecte pas ${schema.pattern}`);
  }

  if (typeof valeur === 'number') {
    if (schema.minimum !== undefined && valeur < schema.minimum) erreurs.push(`${chemin} : ${valeur} < ${schema.minimum}`);
    if (schema.maximum !== undefined && valeur > schema.maximum) erreurs.push(`${chemin} : ${valeur} > ${schema.maximum}`);
  }

  if (Array.isArray(valeur)) {
    if (schema.maxItems !== undefined && valeur.length > schema.maxItems) {
      erreurs.push(`${chemin} : ${valeur.length} éléments (max ${schema.maxItems})`);
    }
    if (schema.minItems !== undefined && valeur.length < schema.minItems) {
      erreurs.push(`${chemin} : ${valeur.length} éléments (min ${schema.minItems})`);
    }
    if (schema.items) valeur.forEach((v, i) => verifier(v, schema.items, `${chemin}[${i}]`, racine, erreurs));
    return;
  }

  if (typeof valeur === 'object') {
    for (const cle of schema.required ?? []) {
      if (!(cle in valeur)) erreurs.push(`${chemin}.${cle} : clé manquante (écrire null si la donnée est absente)`);
    }
    const proprietes = schema.properties ?? {};
    for (const [cle, v] of Object.entries(valeur)) {
      if (proprietes[cle]) verifier(v, proprietes[cle], `${chemin}.${cle}`, racine, erreurs);
      else if (schema.additionalProperties === false) erreurs.push(`${chemin}.${cle} : clé inconnue du schéma`);
    }
  }
}

/** Renvoie la liste des erreurs (vide si la valeur respecte le schéma). */
export function valider(valeur, schema) {
  const erreurs = [];
  verifier(valeur, schema, '$', schema, erreurs);
  return erreurs;
}
