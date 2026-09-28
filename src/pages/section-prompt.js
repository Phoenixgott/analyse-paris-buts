// Fiche match — prompt d'analyse IA : Copier, Exporter .json, contrôles visibles.
import { esc } from '../format.js';
import { contenuExport, genererPrompt, nomFichierExport } from '../prompt/generateur.js';
import { badgeDemo } from '../composants/badge.js';

export function sectionPrompt(match, modele) {
  const { texte, controles } = genererPrompt(match, modele);
  const ok = controles.ok;
  const verifs = [
    [controles.restants.length === 0, controles.restants.length === 0 ? 'Aucun {{…}} restant' : `${controles.restants.length} {{…}} restant(s) : ${controles.restants.join(', ')}`],
    [controles.json_match_valide, 'JSON des données valide'],
    [controles.json_modele_valide, modele ? 'JSON des calculs valide' : 'Calculs non publiés : « null »'],
  ];
  return `<section class="carte section" id="s-prompt" aria-labelledby="t-prompt">
    <h2 class="section__titre" id="t-prompt">Prompt d’analyse IA</h2>
    <p class="section__sous">Toutes les données de la fiche et les calculs du site, prêts à coller dans une conversation avec l’IA de ton choix. L’IA doit s’appuyer uniquement sur ces données et peut conclure « PASSER ».</p>
    ${match.demo ? `<p class="prompt__demo">${badgeDemo()} Match fictif : le prompt l’indique à l’IA (« données fictives, ne pas parier »).</p>` : ''}
    <div class="prompt__actions">
      <button type="button" class="bouton" id="bouton-copier"${ok ? '' : ' disabled'}>Copier le prompt</button>
      <button type="button" class="bouton bouton--discret" id="bouton-exporter"${ok ? '' : ' disabled'}>Exporter .json</button>
    </div>
    <p class="prompt__etat" id="etat-prompt" role="status" aria-live="polite"></p>
    <ul class="prompt__controles">
      ${verifs.map(([bon, lib]) => `<li class="${bon ? 'controle--ok' : 'controle--ko'}"><span aria-hidden="true">${bon ? '✓' : '✗'}</span> ${esc(lib)}</li>`).join('')}
      <li><span aria-hidden="true">·</span> ${texte.length.toLocaleString('fr-FR')} caractères</li>
    </ul>
    <details class="prompt__apercu">
      <summary>Voir le prompt</summary>
      <textarea class="prompt__texte" id="texte-prompt" readonly rows="12" aria-label="Prompt d’analyse">${esc(texte)}</textarea>
    </details>
  </section>`;
}

async function copier(texte, zone) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    // Repli : sélection du texte puis commande de copie du navigateur.
    zone.closest('details').open = true;
    zone.focus();
    zone.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

function telecharger(nom, contenu) {
  const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
  const lien = Object.assign(document.createElement('a'), { href: url, download: nom });
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function activerPrompt(racine, match, modele) {
  const etat = racine.querySelector('#etat-prompt');
  const zone = racine.querySelector('#texte-prompt');
  if (!etat || !zone) return;
  const { texte } = genererPrompt(match, modele);

  racine.querySelector('#bouton-copier').addEventListener('click', async () => {
    const reussi = await copier(texte, zone);
    etat.textContent = reussi
      ? `Prompt copié (${texte.length.toLocaleString('fr-FR')} caractères). Colle-le dans la conversation avec l’IA.`
      : 'Copie impossible ici : le prompt est sélectionné ci-dessous, copie-le à la main.';
  });

  racine.querySelector('#bouton-exporter').addEventListener('click', () => {
    const json = JSON.stringify(contenuExport(match, modele, texte), null, 2);
    JSON.parse(json); // garde-fou : on n'exporte qu'un JSON relisible
    telecharger(nomFichierExport(match), json);
    etat.textContent = `Fichier ${nomFichierExport(match)} exporté.`;
  });
}
