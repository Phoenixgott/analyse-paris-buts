// Navigation : barre d'onglets en bas de l'écran sur téléphone, colonne repliable sur grand écran.
const CLE_REPLI = 'apb.sidebarRepliee';

function lire(cle) {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrire(cle, valeur) {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    /* stockage indisponible : réglage non mémorisé */
  }
}

export function installerNavigation() {
  const corps = document.body;
  const replier = document.getElementById('bouton-replier');
  const appliquerRepli = (replie) => {
    corps.classList.toggle('sidebar-repliee', replie);
    replier.setAttribute('aria-pressed', String(replie));
    replier.setAttribute('aria-label', replie ? 'Déplier le menu' : 'Replier le menu');
  };
  appliquerRepli(lire(CLE_REPLI) === '1');
  replier.addEventListener('click', () => {
    const replie = !corps.classList.contains('sidebar-repliee');
    appliquerRepli(replie);
    ecrire(CLE_REPLI, replie ? '1' : '0');
  });
}

export function marquerActif(route) {
  for (const lien of document.querySelectorAll('#sidebar [data-route]')) {
    if (lien.dataset.route === route) lien.setAttribute('aria-current', 'page');
    else lien.removeAttribute('aria-current');
  }
}
