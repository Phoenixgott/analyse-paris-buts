import { describe, expect, it } from 'vitest';
import { memeJoueur, nomCanonique, normaliserTexte } from '../src/collecte/noms.js';
import { lireJSON } from './aides.js';

const equipes = (id) => lireJSON(`data/ligues/${id}.json`).equipes_saison;

// [nom écrit par l'IA, compétition, nom attendu dans l'historique]
const CAS = [
  ['Paris Saint-Germain', 'fr-l1', 'Paris SG'],
  ['PSG', 'fr-l1', 'Paris SG'],
  ['Paris FC', 'fr-l1', 'Paris FC'],
  ['Olympique de Marseille', 'fr-l1', 'Marseille'],
  ['Olympique Lyonnais', 'fr-l1', 'Lyon'],
  ['Stade Rennais', 'fr-l1', 'Rennes'],
  ['LOSC Lille', 'fr-l1', 'Lille'],
  ['RC Lens', 'fr-l1', 'Lens'],
  ['OGC Nice', 'fr-l1', 'Nice'],
  ['AS Monaco', 'fr-l1', 'Monaco'],
  ['Stade Brestois 29', 'fr-l1', 'Brest'],
  ['RC Strasbourg Alsace', 'fr-l1', 'Strasbourg'],
  ['Manchester United', 'en-pl', 'Man United'],
  ['Manchester City', 'en-pl', 'Man City'],
  ['Nottingham Forest', 'en-pl', "Nott'm Forest"],
  ['Tottenham Hotspur', 'en-pl', 'Tottenham'],
  ['Brighton & Hove Albion', 'en-pl', 'Brighton'],
  ['Newcastle United', 'en-pl', 'Newcastle'],
  ['Atlético de Madrid', 'es-l1', 'Ath Madrid'],
  ['Athletic Club', 'es-l1', 'Ath Bilbao'],
  ['Real Madrid', 'es-l1', 'Real Madrid'],
  ['Real Sociedad', 'es-l1', 'Sociedad'],
  ['Real Betis', 'es-l1', 'Betis'],
  ['RCD Espanyol', 'es-l1', 'Espanol'],
  ['Rayo Vallecano', 'es-l1', 'Vallecano'],
  ['Deportivo La Coruña', 'es-l1', 'La Coruna'],
  ['Inter Milan', 'it-sa', 'Inter'],
  ['AC Milan', 'it-sa', 'Milan'],
  ['SSC Napoli', 'it-sa', 'Napoli'],
  ['Bayern Munich', 'de-bl1', 'Bayern Munich'],
  ['FC Bayern München', 'de-bl1', 'Bayern Munich'],
  ['Borussia Dortmund', 'de-bl1', 'Dortmund'],
  ['Borussia Mönchengladbach', 'de-bl1', "M'gladbach"],
  ['Eintracht Frankfurt', 'de-bl1', 'Ein Frankfurt'],
  ['1. FC Köln', 'de-bl1', 'FC Koln'],
  ['Bayer Leverkusen', 'de-bl1', 'Leverkusen'],
  ['Hamburger SV', 'de-bl1', 'Hamburg'],
  ['1. FSV Mainz 05', 'de-bl1', 'Mainz'],
  ['FC Schalke 04', 'de-bl1', 'Schalke 04'],
  ['Sporting CP', 'pt-pl', 'Sp Lisbon'],
  ['SC Braga', 'pt-pl', 'Sp Braga'],
  ['Vitória de Guimarães', 'pt-pl', 'Guimaraes'],
  ['PSV', 'nl-ere', 'PSV Eindhoven'],
  ['Fortuna Sittard', 'nl-ere', 'For Sittard'],
  ['NEC Nijmegen', 'nl-ere', 'Nijmegen'],
  ['Union Saint-Gilloise', 'be-pl', 'St. Gilloise'],
  ['Sint-Truiden', 'be-pl', 'St Truiden'],
  ['OH Leuven', 'be-pl', 'Oud-Heverlee Leuven'],
  ['Club Brugge KV', 'be-pl', 'Club Brugge'],
  ['Cercle Brugge', 'be-pl', 'Cercle Brugge'],
  ['Standard de Liège', 'be-pl', 'Standard'],
  ['Kasımpaşa', 'tr-sl', 'Kasimpasa'],
  ['Fenerbahçe', 'tr-sl', 'Fenerbahce'],
  ['Göztepe', 'tr-sl', 'Goztep'],
  ['Heart of Midlothian', 'sc-prem', 'Hearts'],
  ['Dundee United', 'sc-prem', 'Dundee United'],
  ['Dundee FC', 'sc-prem', 'Dundee'],
];

describe('rapprochement des noms d’équipes', () => {
  for (const [ecrit, id, attendu] of CAS) {
    it(`${ecrit} → ${attendu}`, () => {
      expect(nomCanonique(ecrit, equipes(id))?.nom).toBe(attendu);
    });
  }

  it('refuse un rapprochement ambigu ou sans rapport (le nom sera signalé)', () => {
    expect(nomCanonique('Manchester', equipes('en-pl'))).toBeNull(); // City ou United ?
    expect(nomCanonique('FC Barcelone B', equipes('fr-l1'))).toBeNull();
    expect(nomCanonique('Wrexham', equipes('en-pl'))).toBeNull();
  });

  it('reconnaît un joueur écrit avec son initiale, pas un homonyme', () => {
    expect(memeJoueur('A. Lacazette', 'Alexandre Lacazette')).toBe(true);
    expect(memeJoueur('Lacazette', 'Alexandre Lacazette')).toBe(true);
    expect(memeJoueur('Kylian Mbappé', 'K. Mbappe')).toBe(true);
    expect(memeJoueur('B. Lacazette', 'Alexandre Lacazette')).toBe(false);
    expect(memeJoueur('Ethan Mbappé', 'Kylian Mbappé')).toBe(false);
  });

  it('normalise accents, apostrophes et lettres spéciales', () => {
    expect(normaliserTexte("Nott'm Forest")).toBe('nottm forest');
    expect(normaliserTexte('Kasımpaşa')).toBe('kasimpasa');
    expect(normaliserTexte('Brighton & Hove Albion')).toBe('brighton and hove albion');
  });
});
