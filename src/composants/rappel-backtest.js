// Rappel affiché sous chaque pari suggéré : ce qu'ont donné, sur l'historique réel, les paris choisis par
// les mêmes règles (backtest publié dans data/backtest/resume.json). Sans backtest : message prudent.
import { entier, esc, nombre } from '../format.js';
import { ib } from './info-bulle.js';

const AIDE =
  'Backtest : le modèle a été rejoué semaine par semaine sur les saisons passées de 16 ligues, sans jamais voir les matchs futurs. Les paris Plus/Moins 2,5 buts qui passaient les règles du site (value, proba minimum) ont été simulés avec une mise fixe. Le résultat vaut pour ce type de pari en moyenne, pas pour ce match précis.';

/** Configuration du backtest correspondant aux réglages en service, ou null. */
export function backtestActuel(resume) {
  return resume?.configurations?.find((c) => c.actuelle) ?? null;
}

export function rappelBacktest(resume) {
  const c = backtestActuel(resume);
  const lien = '<a href="#/fiabilite">Fiabilité du modèle</a>';
  if (!c?.value?.paris || c.value.roi == null) {
    return `<p class="rappel-backtest" role="note">Aucun backtest disponible : rien ne prouve que ces paris soient rentables. Voir ${lien}.</p>`;
  }
  const roi = c.value.roi * 100;
  const bilan = roi < 0 ? `ont perdu ${nombre(-roi, 1)} % des mises` : `ont rapporté ${nombre(roi, 1)} % des mises (ce qui ne garantit rien pour la suite)`;
  return `<p class="rappel-backtest rappel-backtest--${roi < 0 ? 'perte' : 'gain'}" role="note"><strong>Rappel :</strong> sur ${esc(entier(c.n))} matchs réels passés, les paris choisis par ces règles ${esc(bilan)}${ib(AIDE, 'Comment ce chiffre est-il calculé ?')} (${esc(entier(c.value.paris))} paris simulés). Voir ${lien}.</p>`;
}
