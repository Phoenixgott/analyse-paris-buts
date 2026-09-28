// Sidebar : tiroir sur mobile (bouton ☰), colonne repliable sur grand écran.
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
  const menu = document.getElementById('bouton-menu');
  const replier = document.getElementById('bouton-replier');
  const sidebar = document.getElementById('sidebar');
  const voile = document.getElementById('voile');

  const fermerTiroir = (rendreFocus = true) => {
    if (!corps.classList.contains('menu-ouvert')) return;
    corps.classList.remove('menu-ouvert');
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Ouvrir le menu');
    voile.hidden = true;
    if (rendreFocus) menu.focus();
  };

  menu.addEventListener('click', () => {
    if (corps.classList.contains('menu-ouvert')) return fermerTiroir();
    corps.classList.add('menu-ouvert');
    menu.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-label', 'Fermer le menu');
    voile.hidden = false;
    sidebar.querySelector('a')?.focus();
  });
  voile.addEventListener('click', () => fermerTiroir());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fermerTiroir();
  });
  sidebar.addEventListener('click', (e) => {
    if (e.target.closest('a')) fermerTiroir(false);
  });

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
