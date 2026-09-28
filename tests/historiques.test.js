import { describe, expect, it } from 'vitest';
import { dateIso, equipesDe, lireCsv, matchDepuisLigne } from '../scripts/historiques/csv.js';
import { saisonsEuropeennes } from '../src/collecte/competitions.js';
import { lireJSON } from './aides.js';

// Extraits réels (format) des fichiers football-data.co.uk.
const PRINCIPAL = '﻿Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG,HTR,HxG,AxG,Avg>2.5,Avg<2.5\r\n' +
  'F1,21/08/2026,19:45,Marseille,Strasbourg,4,0,H,0,0,D,1.86,0.19,1.72,2.14\r\n' +
  'F1,20/09/2026,19:45,Marseille,Paris SG,1,2,A,0,0,D,1.98,5.09,1.61,2.35\r\n' +
  'F1,27/09/2026,15:00,Lens,"Nice, OGC",,,,,,,,,,\r\n';
const NOUVEAU = 'Country,League,Season,Date,Time,Home,Away,HG,AG,Res\n' +
  'USA,MLS,2026,28/09/2026,00:00,Columbus Crew,Inter Miami,2,1,H\n';

describe('lecture des CSV football-data.co.uk', () => {
  it('lit l’en-tête (BOM retiré), les guillemets et les fins de ligne Windows', () => {
    const l = lireCsv(PRINCIPAL);
    expect(l).toHaveLength(3);
    expect(l[0].Div).toBe('F1');
    expect(l[2].AwayTeam).toBe('Nice, OGC');
  });

  it('convertit une ligne jouée, avec score à la pause, cotes Plus/Moins 2,5 et xG', () => {
    expect(matchDepuisLigne(lireCsv(PRINCIPAL)[0])).toEqual({
      date: '2026-08-21', domicile: 'Marseille', exterieur: 'Strasbourg', score: '4-0', score_mt: '0-0',
      cote_over_2_5: 1.72, cote_under_2_5: 2.14, xg_domicile: 1.86, xg_exterieur: 0.19,
    });
  });

  it('ignore un match pas encore joué (score vide)', () => {
    expect(matchDepuisLigne(lireCsv(PRINCIPAL)[2])).toBeNull();
  });

  it('lit le format « nouveau » (MLS) sans score à la pause', () => {
    expect(matchDepuisLigne(lireCsv(NOUVEAU)[0])).toMatchObject({ date: '2026-09-28', domicile: 'Columbus Crew', score: '2-1', score_mt: null, cote_over_2_5: null });
  });

  it('comprend les dates à 2 ou 4 chiffres', () => {
    expect(dateIso('05/08/23')).toBe('2023-08-05');
    expect(dateIso('5/8/2023')).toBe('2023-08-05');
    expect(dateIso('2023-08-05')).toBeNull();
  });

  it('liste les équipes sans doublon', () => {
    const m = lireCsv(PRINCIPAL).map(matchDepuisLigne).filter(Boolean);
    expect(equipesDe(m)).toEqual(['Marseille', 'Paris SG', 'Strasbourg']);
  });
});

describe('saisons', () => {
  it('2026/27 à partir de juillet 2026, 2025/26 avant', () => {
    expect(saisonsEuropeennes(new Date('2026-09-28T12:00:00Z'))).toEqual({ courante: '2627', precedente: '2526' });
    expect(saisonsEuropeennes(new Date('2026-05-10T12:00:00Z'))).toEqual({ courante: '2526', precedente: '2425' });
    expect(saisonsEuropeennes(new Date('2000-09-01T12:00:00Z'))).toEqual({ courante: '0001', precedente: '9900' });
  });
});

describe('historiques téléchargés', () => {
  it('Ligue 1 : format attendu, matchs triés, aucun match postérieur au téléchargement', () => {
    const l = lireJSON('data/ligues/fr-l1.json');
    expect(l).toMatchObject({ competition_id: 'fr-l1', source: 'football-data.co.uk' });
    expect(l.matchs.length).toBeGreaterThan(300);
    expect(l.equipes_saison.length).toBe(18);
    const dates = l.matchs.map((m) => m.date);
    expect(dates).toEqual([...dates].sort());
    expect(dates.at(-1) <= l.maj.slice(0, 10)).toBe(true);
    expect(l.matchs.every((m) => /^\d+-\d+$/.test(m.score))).toBe(true);
  });
});
