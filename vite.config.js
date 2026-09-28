import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

// Le site est servi sous https://phoenixgott.github.io/analyse-paris-buts/
export const BASE = '/analyse-paris-buts/';

export const manifeste = {
  name: 'Analyse Paris Buts',
  short_name: 'Paris Buts',
  description:
    'Matchs du jour, probabilités de buts estimées et prompt d’analyse. Probabilités estimées, pas des certitudes. 18+.',
  lang: 'fr',
  dir: 'ltr',
  start_url: BASE,
  scope: BASE,
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#061433',
  theme_color: '#061433',
  categories: ['sports'],
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

const DOSSIER_DONNEES = resolve('data');
// Jamais publiés : cache brut des API (peut contenir des réponses volumineuses).
const EXCLUS = ['cache'];

function fichiersDonnees(dossier = DOSSIER_DONNEES) {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) {
      return dossier === DOSSIER_DONNEES && EXCLUS.includes(entree.name) ? [] : fichiersDonnees(chemin);
    }
    return entree.name.endsWith('.json') ? [chemin] : [];
  });
}

// Publie /data (JSON commités par la collecte) sous <base>data/ : servi en dev, copié au build.
function donnees() {
  return {
    name: 'donnees-json',
    configureServer(server) {
      server.middlewares.use(`${BASE}data`, (req, res, next) => {
        const chemin = resolve(DOSSIER_DONNEES, `.${decodeURIComponent(req.url.split('?')[0])}`);
        const autorise = chemin.startsWith(DOSSIER_DONNEES + sep) && !EXCLUS.some((d) => chemin.startsWith(join(DOSSIER_DONNEES, d)));
        if (!autorise || !existsSync(chemin) || statSync(chemin).isDirectory()) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        createReadStream(chemin).pipe(res);
      });
    },
    generateBundle() {
      for (const chemin of fichiersDonnees()) {
        this.emitFile({
          type: 'asset',
          fileName: `data/${relative(DOSSIER_DONNEES, chemin).split(sep).join('/')}`,
          source: readFileSync(chemin),
        });
      }
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [
    donnees(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: manifeste,
      workbox: {
        // L'application est mise en cache à l'installation ; les données ne le sont pas
        // (elles changent chaque jour) : voir runtimeCaching ci-dessous.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        globIgnores: ['data/**'],
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Données : réseau d'abord (toujours la dernière collecte), cache si hors ligne.
            // Expression régulière (et non fonction) : une fonction est recopiée dans le service
            // worker sans ses variables, BASE y serait indéfini.
            urlPattern: new RegExp(`${BASE}data/.+\\.json$`),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'donnees',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 800, maxAgeSeconds: 35 * 24 * 3600 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.js'],
  },
});
