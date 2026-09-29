// Paris suggérés (ex-« Top picks ») : les paris qui passent TOUS les filtres du modèle.
// Affichés comme une vue de l'accueil (bouton « Paris suggérés »), plus une page à part.
import { cote, esc, pct, proba, valueTexte } from '../format.js';
import { badge } from '../composants/badge.js';
import { ib } from '../composants/info-bulle.js';
import { rappelBacktest } from '../composants/rappel-backtest.js';
import { EXPLICATIONS } from '../explications.js';

const AIDE_CORRELATION =
  'Deux paris sur le même match dépendent l’un de l’autre (ex. « Plus de 2,5 buts » et « Plus de 1,5 but en 1re MT » gagnent souvent ensemble). Leurs probabilités ne se multiplient pas : un combiné de paris liés est bien moins sûr qu’il n’y paraît, et les bookmakers le refusent parfois.';

export function lienNoter(p) {
  const q = new URLSearchParams({ dossier: p.dossier, match: p.match_id, marche: p.marche, cote: String(p.cote) });
  return `#/journal?${q}`;
}

const lienFiche = (p) => `#/match/${encodeURIComponent(p.dossier)}/${encodeURIComponent(p.match_id)}`;

/** picks : triés par value décroissante (extrairePicks). bankroll : actuelle ou null. */
export function vuePicks(picks, { bankroll, backtest, nbMatchs }) {
  if (!picks.length) {
    return `<section class="carte"><p><strong>Aucun pari suggéré.</strong> Aucun pari ne passe tous les filtres : PASSER est un résultat normal et fréquent.</p><p class="discret">${nbMatchs} match(s) analysé(s).</p></section>`;
  }
  const miseEuros = (p) => (bankroll != null && p.mise_pct ? ` · ${(p.mise_pct * bankroll).toFixed(2).replace('.', ',')} €` : '');
  const lignes = picks
    .map(
      (p) => `<li class="ligne-pick">
      <a class="ligne-pick__match" href="${lienFiche(p)}"><strong>${esc(p.libelle)}</strong>${p.lies ? badge(`lié ×${p.lies + 1}`, 'nonfiable', 'Autre(s) pari(s) suggéré(s) sur le même match') : ''}
        <span class="discret">${esc(p.heure)} · ${esc(p.libelle_match)}</span></a>
      <span class="ligne-pick__chiffres"><span class="proba">${esc(proba(p.proba))}</span> · cote ${esc(cote(p.cote))} · <span class="value--pos">${esc(valueTexte(p.value))}</span>${ib(`${EXPLICATIONS.proba_total} ${EXPLICATIONS.value} ${EXPLICATIONS.mise} Mise conseillée ici : ${pct(p.mise_pct * 100, 1)} de la bankroll. Cote minimale : ${cote(p.cote_min)}. Confiance du modèle : ${p.confiance}/100.`, 'Détail du calcul')}
        <span class="discret">mise ${esc(pct(p.mise_pct * 100, 1))}${miseEuros(p)}</span></span>
      ${p.demo ? '<span class="discret">DÉMO</span>' : `<a class="bouton bouton--petit" href="${lienNoter(p)}" aria-label="Noter ce pari dans le journal">Noter</a>`}
    </li>`,
    )
    .join('');
  return `${rappelBacktest(backtest)}
    <p class="discret">Deux paris du même match sont liés : ne les combine pas en pensant multiplier tes chances.${ib(AIDE_CORRELATION, 'Pourquoi les paris d’un même match sont-ils liés ?')}</p>
    <ul class="liste-lignes">${lignes}</ul>
    <p class="discret">${bankroll == null ? 'Règle ta bankroll dans le <a href="#/journal">journal</a> pour voir les mises en euros.' : `Mises calculées sur ta bankroll actuelle (${bankroll.toFixed(2).replace('.', ',')} €).`}</p>`;
}
