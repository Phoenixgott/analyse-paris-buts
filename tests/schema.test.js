import { describe, expect, it } from 'vitest';
import { valider } from '../schema/valider.js';
import { matchVide, matchsDemo, schema } from './aides.js';

describe('schéma JSON d’un match', () => {
  it('accepte un match dont toutes les données facultatives sont null (N/D)', () => {
    expect(valider(matchVide(), schema)).toEqual([]);
  });

  it('refuse une clé manquante : une donnée absente doit être écrite null', () => {
    const m = matchVide();
    delete m.meteo;
    expect(valider(m, schema)).toEqual(['$.meteo : clé manquante (écrire null si la donnée est absente)']);
  });

  it('refuse une clé inconnue, un mauvais type et une valeur hors liste', () => {
    const m = matchVide();
    m.inconnu = 1;
    m.competition.categorie = 'X';
    m.qualite_donnees = '80';
    const erreurs = valider(m, schema);
    expect(erreurs).toHaveLength(3);
    expect(erreurs.join('\n')).toMatch(/inconnu : clé inconnue/);
    expect(erreurs.join('\n')).toMatch(/categorie : valeur "X"/);
    expect(erreurs.join('\n')).toMatch(/qualite_donnees : type string/);
  });

  it('vérifie les objets imbriqués (cotes, forme, pourcentages bornés)', () => {
    const m = matchVide();
    m.equipes.domicile.stats = {
      buts_marques_moy: 1.2,
      buts_encaisses_moy: null,
      buts_mt_marques_moy: null,
      buts_mt_encaisses_moy: null,
      xg_moy: null,
      tirs_cadres_moy: null,
      pct_over15: 120,
      pct_over25: null,
      pct_over35: null,
      pct_but_avant_30: null,
    };
    m.equipes.domicile.forme = [{ date: '2026-09-01', adversaire: 'X', lieu: 'D', score: '2-1', score_mt: '1:0' }];
    const erreurs = valider(m, schema);
    expect(erreurs).toEqual([
      '$.equipes.domicile.forme[0].score_mt : « 1:0 » ne respecte pas ^\\d{1,2}-\\d{1,2}$',
      '$.equipes.domicile.stats.pct_over15 : 120 > 100',
    ]);
  });

  it('valide les 6 matchs de démonstration', () => {
    const matchs = matchsDemo();
    expect(matchs).toHaveLength(6);
    for (const m of matchs) expect(valider(m, schema), m.match_id).toEqual([]);
  });
});
