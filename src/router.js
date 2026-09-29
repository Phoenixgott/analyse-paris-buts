// Routes en « # » (compatibles GitHub Pages, sans serveur) :
//   #/                         matchs du jour
//   #/collecte                 récupérer les matchs (prompts de collecte)
//   #/match/<dossier>/<id>     fiche match (dossier = « local », « demo » ou AAAA-MM-JJ)
//   #/top-picks · #/journal[?dossier=&match=&marche=&cote=] (pari prérempli) · #/fiabilite
import { esc } from './format.js';
import { marquerActif } from './composants/navigation.js';
import { viderTableaux } from './composants/tableau-triable.js';
import { toutDetruire } from './graphiques/registre.js';
import { pageAccueil } from './pages/accueil.js';
import { pageMatch } from './pages/match.js';
import { pageCollecte } from './pages/collecte.js';
import { pageFiabilite } from './pages/fiabilite.js';
import { pageTopPicks } from './pages/top-picks.js';
import { pageJournal } from './pages/journal.js';

const ROUTES = [
  { motif: /^#?\/?$/, route: 'accueil', page: (app) => pageAccueil(app) },
  { motif: /^#\/collecte$/, route: 'collecte', page: (app) => pageCollecte(app) },
  { motif: /^#\/match\/([a-z0-9-]+)\/([a-z0-9-]+)$/, route: 'accueil', page: (app, m) => pageMatch(app, m[1], m[2]) },
  { motif: /^#\/top-picks$/, route: 'top-picks', page: (app) => pageTopPicks(app) },
  { motif: /^#\/journal(?:\?(.*))?$/, route: 'journal', page: (app, m) => pageJournal(app, new URLSearchParams(m[1] ?? '')) },
  { motif: /^#\/fiabilite$/, route: 'fiabilite', page: (app) => pageFiabilite(app) },
];

let premierAffichage = true;

async function afficher() {
  const app = document.getElementById('app');
  const hash = location.hash || '#/';
  const trouve = ROUTES.map((r) => ({ r, m: hash.match(r.motif) })).find((x) => x.m);

  viderTableaux();
  toutDetruire();
  app.setAttribute('aria-busy', 'true');
  app.innerHTML = '<p class="chargement">Chargement…</p>';

  try {
    if (!trouve) {
      marquerActif(null);
      document.title = 'Page introuvable — Analyse Paris Buts';
      app.innerHTML = `<section class="carte"><h1 class="page-titre">Page introuvable</h1><p><a href="#/">Retour aux matchs du jour</a></p></section>`;
    } else {
      marquerActif(trouve.r.route ?? trouve.m[1]);
      await trouve.r.page(app, trouve.m);
    }
  } catch (erreur) {
    console.error(erreur);
    app.innerHTML = `<section class="carte alerte" role="alert">
      <h1 class="page-titre">Données indisponibles</h1>
      <p>Impossible de charger cette page (${esc(erreur.message)}). Si tu es hors ligne, ouvre-la une fois avec du réseau pour qu'elle soit gardée en mémoire.</p>
      <p><a href="#/">Retour aux matchs du jour</a></p>
    </section>`;
  } finally {
    app.removeAttribute('aria-busy');
  }

  if (!premierAffichage) {
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }
  premierAffichage = false;
}

export function demarrerRouteur() {
  window.addEventListener('hashchange', afficher);
  afficher();
}
