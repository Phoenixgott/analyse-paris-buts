// Info-bulles accessibles : un bouton « ? » à côté de chaque pourcentage ou indicateur.
// Une seule bulle, en position fixe et bornée à l'écran (jamais de débordement à 360 px).
// S'ouvre au toucher, au clic ou au clavier ; se ferme par Échap, un clic ailleurs, un changement
// de page ou quand son bouton sort de l'écran.
import { esc } from '../format.js';

let bulle = null;
let boutonActif = null;

export function ib(texte, libelle = 'Comment ce chiffre est-il calculé ?') {
  if (!texte) return '';
  return `<button type="button" class="ib" data-ib="${esc(texte)}" aria-label="${esc(libelle)}" aria-expanded="false">?</button>`;
}

function fermer() {
  if (!bulle || bulle.hidden) return;
  bulle.hidden = true;
  if (boutonActif) {
    boutonActif.setAttribute('aria-expanded', 'false');
    boutonActif.removeAttribute('aria-describedby');
  }
  boutonActif = null;
}

function ouvrir(bouton) {
  bulle.textContent = bouton.dataset.ib;
  bulle.hidden = false;
  bouton.setAttribute('aria-expanded', 'true');
  bouton.setAttribute('aria-describedby', 'bulle-aide');
  boutonActif = bouton;
  positionner();
}

// Au défilement, la bulle suit son bouton ; elle ne se ferme que si le bouton sort de l'écran
// (un léger défilement juste après le toucher ne doit pas la refermer).
function suivre() {
  if (!boutonActif || bulle.hidden) return;
  const r = boutonActif.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) fermer();
  else positionner();
}

function positionner() {
  const bouton = boutonActif;
  const marge = 8;
  const r = bouton.getBoundingClientRect();
  const largeur = bulle.offsetWidth;
  const hauteur = bulle.offsetHeight;
  const gauche = Math.min(Math.max(r.left + r.width / 2 - largeur / 2, marge), window.innerWidth - largeur - marge);
  let haut = r.bottom + marge;
  if (haut + hauteur > window.innerHeight - marge) haut = Math.max(marge, r.top - hauteur - marge);
  bulle.style.left = `${gauche}px`;
  bulle.style.top = `${haut}px`;
}

export function installerInfoBulles() {
  bulle = document.createElement('div');
  bulle.id = 'bulle-aide';
  bulle.className = 'bulle';
  bulle.setAttribute('role', 'tooltip');
  bulle.hidden = true;
  document.body.append(bulle);

  document.addEventListener('click', (e) => {
    const bouton = e.target.closest('.ib');
    if (bouton) {
      e.preventDefault();
      e.stopPropagation();
      if (bouton === boutonActif) fermer();
      else {
        fermer();
        ouvrir(bouton);
      }
      return;
    }
    if (!e.target.closest('.bulle')) fermer();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const b = boutonActif;
      fermer();
      b?.focus();
    }
  });
  window.addEventListener('scroll', suivre, { passive: true, capture: true });
  window.addEventListener('resize', suivre);
  window.addEventListener('hashchange', fermer);
}
