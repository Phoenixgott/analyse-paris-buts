// Top picks : les paris qui passent TOUS les filtres du modèle, regroupés par marché.
import { cote, esc, pct, proba, valueTexte } from '../format.js';
import { chargerJournee, chargerModele } from '../donnees/chargement.js';
import { extrairePicks, grouperPicks } from '../journal/picks.js';
import { lireReglages } from '../journal/service.js';
import { statistiques } from '../journal/paris.js';
import * as local from '../donnees/local.js';
import { badge, badgeDemo } from '../composants/badge.js';
import { ib } from '../composants/info-bulle.js';
import { tableau } from '../composants/tableau-triable.js';
import { EXPLICATIONS } from '../explications.js';
import { CLE_JOUR, lireJour, selecteurJour } from './accueil.js';

const AIDE_CORRELATION =
  'Deux paris sur le même match dépendent l’un de l’autre (ex. « Plus de 2,5 buts » et « Plus de 1,5 but en 1re MT » gagnent souvent ensemble). Leurs probabilités ne se multiplient pas : un combiné de paris liés est bien moins sûr qu’il n’y paraît, et les bookmakers le refusent parfois.';

export function lienNoter(p) {
  const q = new URLSearchParams({ dossier: p.dossier, match: p.match_id, marche: p.marche, cote: String(p.cote) });
  return `#/journal?${q}`;
}

export async function pageTopPicks(app) {
  document.title = 'Top picks — Analyse Paris Buts';
  const { dossier, jour, aujourdhui, jours, index, reel } = await chargerJournee(lireJour());
  const entrees = await Promise.all(index.matchs.map(async (resume) => ({ resume, modele: await chargerModele(dossier, resume.match_id), dossier })));
  const picks = extrairePicks(entrees);
  const [reglages, paris] = await Promise.all([lireReglages(), local.lister('paris')]);
  const bankroll = statistiques(paris, reglages.bankroll_initiale).bankroll;

  const miseEuros = (p) => (bankroll != null && p.mise_pct ? ` · ${(p.mise_pct * bankroll).toFixed(2).replace('.', ',')} €` : '');
  const groupes = grouperPicks(picks)
    .filter((g) => g.picks.length)
    .map((g) => `<section class="carte section">
      <h2 class="section__titre">${esc(g.titre)} <span class="discret">(${g.picks.length})</span></h2>
      ${tableau({
        legende: `Top picks — ${g.titre}`,
        tri: { cle: 'value', sens: 'desc' },
        colonnes: [
          {
            cle: 'libelle_match',
            titre: 'Match et pari',
            type: 'texte',
            valeur: (p) => p.coup_envoi,
            rendu: (p) => `<strong>${esc(p.libelle)}</strong>${p.lies ? badge(`lié ×${p.lies + 1}`, 'nonfiable', 'Autre(s) pick(s) sur le même match') : ''}<span class="cellule-sous">${esc(p.heure)} · ${esc(p.libelle_match)} · confiance ${esc(p.confiance)}/100</span>`,
          },
          { cle: 'proba', titre: 'Proba', type: 'nombre', rendu: (p) => `<span class="proba">${esc(proba(p.proba))}</span><span class="cellule-sous">cote ${esc(cote(p.cote))} · min ${esc(cote(p.cote_min))}</span>`, aide: ib(`${EXPLICATIONS.proba_total} ${EXPLICATIONS.cote_min}`) },
          { cle: 'value', titre: 'Value', type: 'nombre', rendu: (p) => `<span class="value--pos">${esc(valueTexte(p.value))}</span><span class="cellule-sous">mise ${esc(pct(p.mise_pct * 100, 1))}${miseEuros(p)}</span>`, aide: ib(`${EXPLICATIONS.value} ${EXPLICATIONS.mise}`) },
          {
            cle: 'action',
            titre: '',
            type: 'texte',
            triable: false,
            rendu: (p) => (p.demo ? '<span class="discret">DÉMO</span>' : `<a class="bouton bouton--petit" href="${lienNoter(p)}" aria-label="Noter ce pari dans le journal">Noter</a>`),
          },
        ],
        lignes: g.picks,
      })}
    </section>`)
    .join('');

  app.innerHTML = `
    <header class="page-tete page-tete--ligne">
      <div>
        <h1 class="page-titre">Top picks</h1>
        <p class="page-sous">Les paris qui passent tous les filtres du modèle (value, confiance, fiabilité)</p>
      </div>
      ${selecteurJour(jour, aujourdhui, jours)}
    </header>
    ${reel ? '' : `<div class="bandeau-demo" role="note">${badgeDemo()}<p>Matchs <strong>fictifs</strong> : ces picks montrent seulement l’interface. Pour les vrais matchs : <a href="#/collecte">Récupérer les matchs</a>.</p></div>`}
    <div class="bandeau-alerte" role="note"><strong>Paris liés.</strong> Deux picks du même match ne sont pas indépendants : ne les combine pas en pensant multiplier tes chances.${ib(AIDE_CORRELATION, 'Pourquoi les paris d’un même match sont-ils liés ?')}</div>
    ${
      picks.length
        ? groupes
        : `<section class="carte"><p><strong>Aucun pick pour ce jour.</strong> Aucun pari ne passe tous les filtres : PASSER est un résultat normal et fréquent.</p><p class="discret">${index.matchs.length} match(s) analysé(s).</p></section>`
    }
    <p class="discret">Probabilités estimées, pas des certitudes. ${bankroll == null ? 'Règle ta bankroll dans le <a href="#/journal">journal</a> pour voir les mises en euros.' : `Mises calculées sur ta bankroll actuelle (${bankroll.toFixed(2).replace('.', ',')} €).`}</p>`;

  app.querySelector('#choix-jour').addEventListener('change', (e) => {
    try {
      sessionStorage.setItem(CLE_JOUR, e.target.value);
    } catch {
      /* non mémorisé */
    }
    pageTopPicks(app);
  });
}
