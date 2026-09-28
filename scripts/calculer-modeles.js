// Calcule le modèle de tous les matchs d'une journée déjà collectée.
// Usage : node scripts/calculer-modeles.js AAAA-MM-JJ
// Réglages facultatifs : config/modele.json (mêmes clés que modele/reglages.js).
import { existsSync, readFileSync } from 'node:fs';
import { calculerJournee } from './lib/modeles-jour.js';

const jour = process.argv[2];
if (!jour || !/^\d{4}-\d{2}-\d{2}$/.test(jour)) {
  console.error('Usage : node scripts/calculer-modeles.js AAAA-MM-JJ');
  process.exit(1);
}
if (!existsSync(`data/${jour}/matchs`)) {
  console.error(`Aucun match collecté pour le ${jour} (data/${jour}/matchs absent).`);
  process.exit(1);
}

const reglages = existsSync('config/modele.json') ? JSON.parse(readFileSync('config/modele.json', 'utf8')) : {};
const calculeLe = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
for (const ligne of calculerJournee(jour, { calculeLe, date: jour, demo: false, reglages })) console.log(ligne);
