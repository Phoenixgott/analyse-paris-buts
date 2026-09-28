import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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

export default defineConfig({
  base: BASE,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: manifeste,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.js'],
  },
});
