// Compétitions du palier 1 (données complètes). « fd » = fichier football-data.co.uk (historique
// des résultats, sans clé) ; null = pas d'historique public : le modèle se rabat sur la forme.
export const COMPETITIONS = [
  { id: 'fr-l1', nom: 'Ligue 1', pays: 'France', categorie: 'H', fd: 'F1' },
  { id: 'fr-l2', nom: 'Ligue 2', pays: 'France', categorie: 'H', fd: 'F2' },
  { id: 'en-pl', nom: 'Premier League', pays: 'Angleterre', categorie: 'H', fd: 'E0' },
  { id: 'en-ch', nom: 'Championship', pays: 'Angleterre', categorie: 'H', fd: 'E1' },
  { id: 'es-l1', nom: 'La Liga', pays: 'Espagne', categorie: 'H', fd: 'SP1' },
  { id: 'es-l2', nom: 'La Liga 2', pays: 'Espagne', categorie: 'H', fd: 'SP2' },
  { id: 'it-sa', nom: 'Serie A', pays: 'Italie', categorie: 'H', fd: 'I1' },
  { id: 'it-sb', nom: 'Serie B', pays: 'Italie', categorie: 'H', fd: 'I2' },
  { id: 'de-bl1', nom: 'Bundesliga', pays: 'Allemagne', categorie: 'H', fd: 'D1' },
  { id: 'de-bl2', nom: '2. Bundesliga', pays: 'Allemagne', categorie: 'H', fd: 'D2' },
  { id: 'pt-pl', nom: 'Primeira Liga', pays: 'Portugal', categorie: 'H', fd: 'P1' },
  { id: 'nl-ere', nom: 'Eredivisie', pays: 'Pays-Bas', categorie: 'H', fd: 'N1' },
  { id: 'be-pl', nom: 'Pro League', pays: 'Belgique', categorie: 'H', fd: 'B1' },
  { id: 'tr-sl', nom: 'Süper Lig', pays: 'Turquie', categorie: 'H', fd: 'T1' },
  { id: 'sc-prem', nom: 'Premiership', pays: 'Écosse', categorie: 'H', fd: 'SC0' },
  { id: 'us-mls', nom: 'MLS', pays: 'États-Unis', categorie: 'H', fd: 'USA', format: 'nouveau', ligue: 'MLS' },
  { id: 'ucl', nom: 'Ligue des champions', pays: 'Europe', categorie: 'H', fd: null },
  { id: 'uel', nom: 'Europa League', pays: 'Europe', categorie: 'H', fd: null },
  { id: 'uecl', nom: 'Conference League', pays: 'Europe', categorie: 'H', fd: null },
  { id: 'en-wsl', nom: 'Women’s Super League', pays: 'Angleterre', categorie: 'F', fd: null },
  { id: 'fr-d1f', nom: 'D1 féminine', pays: 'France', categorie: 'F', fd: null },
  { id: 'es-ligaf', nom: 'Liga F', pays: 'Espagne', categorie: 'F', fd: null },
  { id: 'int-qualif', nom: 'Qualifications (sélections)', pays: 'International', categorie: 'INT', fd: null },
  { id: 'int-ldn', nom: 'Ligue des nations', pays: 'International', categorie: 'INT', fd: null },
  { id: 'int-amicaux', nom: 'Matchs amicaux (sélections)', pays: 'International', categorie: 'INT', fd: null },
];

export const PAR_ID = new Map(COMPETITIONS.map((c) => [c.id, c]));

/** Palier 2 : toute autre compétition renvoyée par la collecte (données réduites). */
export const ID_PALIER_2 = 'autre';

/** Codes de saison football-data.co.uk : « 2627 » pour 2026/27 (saison commencée en juillet). */
export function saisonsEuropeennes(date = new Date()) {
  const annee = date.getUTCFullYear();
  const debut = date.getUTCMonth() >= 6 ? annee : annee - 1;
  const code = (a) => `${String(a % 100).padStart(2, '0')}${String((a + 1) % 100).padStart(2, '0')}`;
  return { courante: code(debut), precedente: code(debut - 1) };
}
