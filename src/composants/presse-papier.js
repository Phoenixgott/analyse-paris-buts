/** Copie un texte ; en repli, sélectionne la zone de texte fournie et tente la copie du navigateur. */
export async function copier(texte, zone) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    if (!zone) return false;
    const details = zone.closest('details');
    if (details) details.open = true;
    zone.focus();
    zone.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

/** Propose un fichier au téléchargement. */
export function telecharger(nom, contenu, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const lien = Object.assign(document.createElement('a'), { href: url, download: nom });
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
