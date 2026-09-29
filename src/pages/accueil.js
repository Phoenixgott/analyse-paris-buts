// Accueil (phase 7, simplifié) : une ligne par match (heure, équipes, verdict, buts attendus).
// Deux vues : « Matchs » et « Paris suggérés ». Les filtres sont rangés derrière un seul bouton.
import { CATEGORIES, dateLongue, esc, heure, nombre, valueTexte } from '../format.js';
import { chargerBacktest, chargerJournee, chargerModele, prechargerFiches } from '../donnees/chargement.js';
import { FILTRES_VIDES, TRANCHES, filtrerMatchs, optionsFiltres, trierMatchs } from '../accueil/filtres.js';
import { badge, badgeDemo } from '../composants/badge.js';
import { ib } from '../composants/info-bulle.js';
import { EXPLICATIONS } from '../explications.js';
import { estFiable } from '../../schema/qualite.js';
import { extrairePicks } from '../journal/picks.js';
import { lireReglages as lireReglagesJournal } from '../journal/service.js';
import { statistiques } from '../journal/paris.js';
import * as local from '../donnees/local.js';
import { vuePicks } from './top-picks.js';

const CLE_FILTRES = 'apb.filtresAccueil';
const CLE_VUE = 'apb.vueAccueil';

function lireSession(cle) {
  try {
    return sessionStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrireSession(cle, valeur) {
  try {
    sessionStorage.setItem(cle, valeur);
  } catch {
    /* non mémorisé */
  }
}

function lireReglages() {
  try {
    return { filtres: { ...FILTRES_VIDES }, tri: 'heure', ...JSON.parse(lireSession(CLE_FILTRES) ?? '{}') };
  } catch {
    return { filtres: { ...FILTRES_VIDES }, tri: 'heure' };
  }
}

export function bandeauDemo(texte) {
  return `<div class="bandeau-demo" role="note">${badgeDemo()}<p>${esc(texte)}</p></div>`;
}

function options(valeurs, choisie, libelle = (v) => v) {
  return valeurs.map((v) => `<option value="${esc(v)}"${v === choisie ? ' selected' : ''}>${esc(libelle(v))}</option>`).join('');
}

function verdictLigne(m) {
  const r = m.modele;
  if (!estFiable(m.qualite_donnees)) return badge('Non fiable', 'nonfiable', 'Qualité des données sous 40/100 : aucun pari');
  if (!r) return badge('N/D', 'nd', 'Modèle non calculé');
  if (r.decision === 'PARIER') return `${badge('PARIER', 'parier')}<span class="ligne-match__value">${esc(valueTexte(r.value))}${ib(EXPLICATIONS.value)}</span>`;
  return badge('PASSER', 'passer');
}

function ligneMatch(m, dossier) {
  const lien = `#/match/${encodeURIComponent(dossier)}/${encodeURIComponent(m.match_id)}`;
  const buts = m.modele?.calculable ? `${nombre(m.modele.buts_attendus, 1)} buts attendus` : 'buts attendus N/D';
  const pari = m.modele?.decision === 'PARIER' ? ` · ${m.modele.libelle}` : '';
  return `<li class="ligne-match${estFiable(m.qualite_donnees) ? '' : ' ligne-match--nonfiable'}">
    <a class="ligne-match__lien" href="${lien}">
      <span class="ligne-match__heure">${esc(heure(m.coup_envoi))}</span>
      <span class="ligne-match__texte">
        <span class="ligne-match__equipes">${esc(m.domicile)} – ${esc(m.exterieur)}</span>
        <span class="ligne-match__sous">${m.demo ? 'DÉMO · ' : ''}${esc(m.competition.nom)} · ${esc(buts)}${esc(pari)}</span>
      </span>
    </a>
    <span class="ligne-match__verdict">${verdictLigne(m)}</span>
  </li>`;
}

function liste(matchs, dossier, tri) {
  if (matchs.length === 0) return '<p class="carte vide">Aucun match ne correspond à ces filtres.</p>';
  if (tri !== 'ligue') return `<ul class="liste-lignes">${matchs.map((m) => ligneMatch(m, dossier)).join('')}</ul>`;
  const groupes = new Map();
  for (const m of matchs) {
    const cle = `${m.competition.nom} · ${m.competition.pays ?? 'N/D'}`;
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(m);
  }
  return [...groupes]
    .map(([titre, ms]) => `<section class="groupe"><h2 class="groupe__titre">${esc(titre)}</h2><ul class="liste-lignes">${ms.map((m) => ligneMatch(m, dossier)).join('')}</ul></section>`)
    .join('');
}

export const CLE_JOUR = 'apb.jour';

export function lireJour() {
  return lireSession(CLE_JOUR);
}

export function selecteurJour(jour, aujourdhui, jours) {
  const choix = [...new Set([aujourdhui, ...jours])].sort();
  const libelle = (j) => `${j === aujourdhui ? 'Aujourd’hui — ' : ''}${dateLongue(j)}`;
  return `<label class="champ champ--jour"><span class="sr-only">Jour</span>
    <select id="choix-jour">
      ${choix.map((j) => `<option value="${j}"${j === jour ? ' selected' : ''}>${esc(libelle(j))}</option>`).join('')}
      <option value="demo"${jour === 'demo' ? ' selected' : ''}>Démonstration (matchs fictifs)</option>
    </select></label>`;
}

/** vueForcee : « picks » depuis l'ancienne adresse #/top-picks (liens des alertes). */
export async function pageAccueil(app, vueForcee = null) {
  document.title = 'Matchs du jour — Analyse Paris Buts';
  if (vueForcee) ecrireSession(CLE_VUE, vueForcee);
  const { dossier, jour, aujourdhui, jours, index, reel } = await chargerJournee(lireJour());
  const tous = index.matchs;
  const opts = optionsFiltres(tous);
  const reglages = lireReglages();
  let vue = lireSession(CLE_VUE) === 'picks' ? 'picks' : 'matchs';
  const collecte = '<a href="#/collecte">Récupérer les matchs</a>';

  // Paris suggérés de la journée (tous les marchés de chaque match, pas seulement le verdict).
  const [entrees, backtest, reglagesJournal, paris] = await Promise.all([
    Promise.all(tous.map(async (resume) => ({ resume, modele: await chargerModele(dossier, resume.match_id), dossier }))),
    chargerBacktest(),
    lireReglagesJournal(),
    local.lister('paris'),
  ]);
  const bankroll = statistiques(paris, reglagesJournal.bankroll_initiale).bankroll;

  app.innerHTML = `
    <header class="page-tete page-tete--ligne">
      <div>
        <h1 class="page-titre">Matchs du jour</h1>
        <p class="page-sous">${esc(dateLongue(reel ? jour : index.date))}</p>
      </div>
      ${selecteurJour(jour, aujourdhui, jours)}
    </header>
    ${
      reel
        ? ''
        : `<div class="bandeau-demo" role="note">${badgeDemo()}<p>Aucun match importé pour aujourd'hui : ces ${tous.length} matchs sont <strong>fictifs</strong> et montrent seulement l'interface. Pour les vrais matchs : ${collecte}.</p></div>`
    }
    ${reel && !tous.length ? `<section class="carte"><p>Aucun match importé pour ce jour. Va dans ${collecte} : le site prépare la demande à coller dans Claude.</p></section>` : ''}
    <div class="barre-vue">
      <div class="seg seg--vue" role="group" aria-label="Affichage">
        <button type="button" data-vue="matchs" aria-pressed="${vue === 'matchs'}">Matchs <span data-nb="matchs"></span></button>
        <button type="button" data-vue="picks" aria-pressed="${vue === 'picks'}">Paris suggérés <span data-nb="picks"></span></button>
      </div>
      <button type="button" class="bouton bouton--petit bouton--discret" id="bouton-filtres" aria-expanded="false" aria-controls="filtres">Filtrer <span id="nb-filtres"></span></button>
    </div>
    <form class="carte filtres" id="filtres" aria-label="Filtres" hidden>
      <label>Pays<select name="pays"><option value="">Tous</option>${options(opts.pays, reglages.filtres.pays)}</select></label>
      <label>Compétition<select name="competition"><option value="">Toutes</option>${options(opts.competition, reglages.filtres.competition)}</select></label>
      <label>Catégorie<select name="categorie"><option value="">Toutes</option>${options(opts.categorie, reglages.filtres.categorie, (c) => CATEGORIES[c])}</select></label>
      <label>Heure<select name="tranche"><option value="">Toutes</option>${options(Object.keys(TRANCHES), reglages.filtres.tranche, (t) => TRANCHES[t].libelle)}</select></label>
      <label>Trier par<select name="tri">
        <option value="heure"${reglages.tri === 'heure' ? ' selected' : ''}>Heure</option>
        <option value="ligue"${reglages.tri === 'ligue' ? ' selected' : ''}>Ligue</option>
        <option value="value"${reglages.tri === 'value' ? ' selected' : ''}>Value</option>
      </select></label>
      <button type="reset" class="bouton bouton--discret">Réinitialiser</button>
    </form>
    <div id="liste" aria-live="polite"></div>`;

  const formulaire = app.querySelector('#filtres');
  const boutonFiltres = app.querySelector('#bouton-filtres');
  const rafraichir = () => {
    const donnees = new FormData(formulaire);
    const filtres = Object.fromEntries(Object.keys(FILTRES_VIDES).map((k) => [k, donnees.get(k) ?? '']));
    const tri = donnees.get('tri') || 'heure';
    ecrireSession(CLE_FILTRES, JSON.stringify({ filtres, tri }));
    const actifs = Object.values(filtres).filter(Boolean).length;
    app.querySelector('#nb-filtres').textContent = actifs ? `(${actifs})` : '';
    const visibles = trierMatchs(filtrerMatchs(tous, filtres), tri);
    const ids = new Set(visibles.map((m) => m.match_id));
    const picks = extrairePicks(entrees.filter((x) => ids.has(x.resume.match_id)));
    app.querySelector('[data-nb="matchs"]').textContent = `(${visibles.length === tous.length ? tous.length : `${visibles.length}/${tous.length}`})`;
    app.querySelector('[data-nb="picks"]').textContent = `(${picks.length})`;
    for (const b of app.querySelectorAll('[data-vue]')) b.setAttribute('aria-pressed', String(b.dataset.vue === vue));
    app.querySelector('#liste').innerHTML = vue === 'picks' ? vuePicks(picks, { bankroll, backtest, nbMatchs: visibles.length }) : liste(visibles, dossier, tri);
  };
  formulaire.addEventListener('change', rafraichir);
  formulaire.addEventListener('reset', (e) => {
    // Le reset natif reviendrait aux choix mémorisés (attributs selected) : on vide explicitement.
    e.preventDefault();
    for (const champ of formulaire.querySelectorAll('select')) champ.value = champ.name === 'tri' ? 'heure' : '';
    rafraichir();
  });
  boutonFiltres.addEventListener('click', () => {
    formulaire.hidden = !formulaire.hidden;
    boutonFiltres.setAttribute('aria-expanded', String(!formulaire.hidden));
  });
  app.querySelector('.seg--vue').addEventListener('click', (e) => {
    const b = e.target.closest('[data-vue]');
    if (!b) return;
    vue = b.dataset.vue;
    ecrireSession(CLE_VUE, vue);
    if (location.hash === '#/top-picks') history.replaceState(null, '', '#/');
    rafraichir();
  });
  rafraichir();

  app.querySelector('#choix-jour').addEventListener('change', (e) => {
    ecrireSession(CLE_JOUR, e.target.value);
    pageAccueil(app);
  });

  prechargerFiches(dossier, tous);
}
