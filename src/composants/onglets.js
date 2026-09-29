// Onglets accessibles (motif ARIA « tabs ») : un seul panneau visible, flèches gauche/droite au clavier.
// Le dernier onglet choisi est mémorisé pour la session (d'une fiche à l'autre, on garde le même).
import { esc } from '../format.js';

function lire(cle) {
  try {
    return sessionStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrire(cle, valeur) {
  try {
    sessionStorage.setItem(cle, valeur);
  } catch {
    /* non mémorisé */
  }
}

/** onglets : [{ id, titre | titreHtml, contenu }]. cle : clé de mémorisation de l'onglet actif. */
export function blocOnglets(nom, onglets, cle, { classe = '' } = {}) {
  const memorise = lire(cle);
  const actif = onglets.some((o) => o.id === memorise) ? memorise : onglets[0].id;
  const boutons = onglets
    .map(
      (o) => `<button type="button" role="tab" id="onglet-${o.id}" aria-controls="panneau-${o.id}" aria-selected="${o.id === actif}"${o.id === actif ? '' : ' tabindex="-1"'} data-onglet="${o.id}">${o.titreHtml ?? esc(o.titre)}</button>`,
    )
    .join('');
  const panneaux = onglets
    .map((o) => `<div class="panneau" role="tabpanel" id="panneau-${o.id}" aria-labelledby="onglet-${o.id}" tabindex="0"${o.id === actif ? '' : ' hidden'}>${o.contenu}</div>`)
    .join('');
  return `<div class="onglets${classe ? ` ${classe}` : ''}" data-onglets="${esc(cle)}">
    <div class="onglets__liste" role="tablist" aria-label="${esc(nom)}">${boutons}</div>
    ${panneaux}
  </div>`;
}

/**
 * surChangement(panneau, id) : appelé à l'affichage d'un panneau (ex. dessiner ses graphiques).
 * Renvoie { choisir(id) } pour changer d'onglet depuis le code (sans déplacer la page).
 */
export function activerOnglets(racine, surChangement = () => {}) {
  const bloc = racine.querySelector('[data-onglets]');
  if (!bloc) return { choisir: () => {} };
  const cle = bloc.dataset.onglets;
  const boutons = [...bloc.querySelectorAll('[role=tab]')];
  const choisir = (bouton, focus = false, parUtilisateur = true) => {
    for (const b of boutons) {
      const oui = b === bouton;
      b.setAttribute('aria-selected', String(oui));
      b.tabIndex = oui ? 0 : -1;
      bloc.querySelector(`#${b.getAttribute('aria-controls')}`).hidden = !oui;
    }
    if (focus) bouton.focus();
    if (parUtilisateur) bouton.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    ecrire(cle, bouton.dataset.onglet);
    surChangement(bloc.querySelector(`#${bouton.getAttribute('aria-controls')}`), bouton.dataset.onglet);
  };
  bloc.querySelector('[role=tablist]').addEventListener('click', (e) => {
    const b = e.target.closest('[role=tab]');
    if (b) choisir(b);
  });
  bloc.querySelector('[role=tablist]').addEventListener('keydown', (e) => {
    const i = boutons.indexOf(document.activeElement);
    if (i < 0) return;
    const pas = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (pas) {
      e.preventDefault();
      choisir(boutons[(i + pas + boutons.length) % boutons.length], true);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      choisir(boutons[e.key === 'Home' ? 0 : boutons.length - 1], true);
    }
  });
  return {
    choisir: (id) => {
      const b = boutons.find((x) => x.dataset.onglet === id);
      if (b && b.getAttribute('aria-selected') !== 'true') choisir(b, false, false);
    },
  };
}
