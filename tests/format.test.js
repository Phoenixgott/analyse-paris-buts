import { describe, expect, it } from 'vitest';
import { ND, cote, dateCourte, entier, esc, heure, heureParis, jourParis, mouvement, nombre, pct, resultat, texte } from '../src/format.js';

describe('affichage N/D', () => {
  it('affiche « N/D » pour toute valeur absente, jamais 0', () => {
    for (const f of [nombre, entier, pct, cote, mouvement, texte, dateCourte, heure]) {
      expect(f(null)).toBe(ND);
      expect(f(undefined)).toBe(ND);
    }
    expect(nombre(Number.NaN)).toBe(ND);
    expect(texte('')).toBe(ND);
  });

  it('formate les nombres à la française', () => {
    expect(nombre(1.5)).toBe('1,50');
    expect(nombre(0)).toBe('0,00');
    expect(pct(57)).toBe('57 %');
    expect(cote(1.85)).toBe('1,85');
    expect(dateCourte('2026-09-22')).toBe('22/09/26');
  });

  it('montre le mouvement de cote avec une flèche neutre', () => {
    expect(mouvement(0.05)).toBe('↑ +0,05');
    expect(mouvement(-0.1)).toBe('↓ −0,10');
    expect(mouvement(0)).toBe('= 0,00');
  });

  it('échappe le HTML des données collectées', () => {
    expect(esc('<b>"A" & \'B\'</b>')).toBe('&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;');
  });
});

describe('fuseau Europe/Paris', () => {
  it('convertit l’heure UTC en heure de Paris (été : UTC+2, hiver : UTC+1)', () => {
    expect(heure('2026-09-28T18:45:00Z')).toBe('20:45');
    expect(heure('2026-12-05T19:00:00Z')).toBe('20:00');
    expect(heureParis('2026-09-28T22:30:00Z')).toBe(0);
  });

  it('calcule le jour de Paris, pas celui du fuseau du téléphone', () => {
    expect(jourParis(new Date('2026-09-28T22:30:00Z'))).toBe('2026-09-29');
    expect(jourParis(new Date('2026-09-28T21:59:00Z'))).toBe('2026-09-28');
  });
});

describe('résultat d’un score', () => {
  it('lit V/N/D du point de vue de l’équipe', () => {
    expect(resultat('2-1')).toBe('V');
    expect(resultat('1-1')).toBe('N');
    expect(resultat('0-3')).toBe('D');
    expect(resultat(null)).toBe(null);
  });
});
