import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { manifeste, BASE } from '../vite.config.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('page d’accueil', () => {
  it('est en français', () => {
    expect(html).toMatch(/<html lang="fr">/);
  });

  it('affiche le pied de page 18+ et le lien joueurs-info-service.fr', () => {
    expect(html).toContain('18+');
    expect(html).toContain('https://www.joueurs-info-service.fr/');
    expect(html).toContain('Probabilités estimées, pas des certitudes');
  });
});

describe('manifeste PWA', () => {
  it('est installable sous le sous-chemin GitHub Pages', () => {
    expect(BASE).toBe('/analyse-paris-buts/');
    expect(manifeste.start_url).toBe(BASE);
    expect(manifeste.scope).toBe(BASE);
    expect(manifeste.display).toBe('standalone');
    expect(manifeste.lang).toBe('fr');
  });

  it('déclare des icônes 192, 512 et masquable qui existent', () => {
    const tailles = manifeste.icons.map((i) => i.sizes);
    expect(tailles).toContain('192x192');
    expect(tailles).toContain('512x512');
    expect(manifeste.icons.some((i) => i.purpose === 'maskable')).toBe(true);
    for (const icone of manifeste.icons) {
      expect(existsSync(new URL(`../public/${icone.src}`, import.meta.url)), icone.src).toBe(true);
    }
  });
});
