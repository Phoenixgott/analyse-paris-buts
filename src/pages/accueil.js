import { CATEGORIES, dateLongue, esc, heure, nombre, valueTexte } from '../format.js';
import { chargerJournee, prechargerFiches } from '../donnees/chargement.js';
import { FILTRES_VIDES, TRANCHES, filtrerMatchs, optionsFiltres, trierMatchs } from '../accueil/filtres.js';
import { badge, badgeCategorie, badgeDemo, badgeNonFiable, badgePalier, badgeQualite } from '../composants/badge.js';
import { ib } from '../composants/info-bulle.js';
import { EXPLICATIONS } from '../explications.js';
import { estFiable } from '../../schema/qualite.js';

const CLE_FILTRES = 'apb.filtresAccueil';

function lireReglages() {
  try {
    return { filtres: { ...FILTRES_VIDES }, tri: 'heure', ...JSON.parse(sessionStorage.getItem(CLE_FILTRES) ?? '{}') };
  } catch {
    return { filtres: { ...FILTRES_VIDES }, tri: 'heure' };
  }
}

function ecrireReglages(reglages) {
  try {
    sessionStorage.setItem(CLE_FILTRES, JSON.stringify(reglages));
  } catch {
    /* non mémorisé */
  }
}

export function bandeauDemo(texte) {
  return `<div class="bandeau-demo" role="note">${badgeDemo()}<p>${esc(texte)}</p></div>`;
}

function options(valeurs, choisie, libelle = (v) => v) {
  return valeurs
    .map((v) => `<option value="${esc(v)}"${v === choisie ? ' selected' : ''}>${esc(libelle(v))}</option>`)
    .join('');
}

function carteMatch(m, dossier) {
  const fiable = estFiable(m.qualite_donnees);
  const lien = `#/match/${encodeURIComponent(dossier)}/${encodeURIComponent(m.match_id)}`;
  return `<article class="match-carte${fiable ? '' : ' match-carte--nonfiable'}">
    <div class="match-carte__haut">
      <span class="match-carte__heure">${esc(heure(m.coup_envoi))}</span>
      <span class="match-carte__compet">${esc(m.competition.nom)}<span class="match-carte__pays">${esc(m.competition.pays ?? 'N/D')}</span></span>
    </div>
    <a class="match-carte__lien" href="${lien}">
      <span class="match-carte__equipe">${esc(m.domicile)}</span>
      <span class="match-carte__equipe">${esc(m.exterieur)}</span>
    </a>
    <div class="match-carte__bas">
      <span class="badges">${m.demo ? badgeDemo() : ''}${badgeCategorie(m.competition.categorie)}${badgePalier(m.competition.palier)}${fiable ? '' : badgeNonFiable()}</span>
      <span class="match-carte__qualite"><span class="match-carte__label">Qualité</span>${badgeQualite(m.qualite_donnees)}</span>
    </div>
    ${ligneModele(m.modele)}
  </article>`;
}

function ligneModele(r) {
  if (!r) return '<p class="match-carte__modele discret">Modèle : N/D</p>';
  if (!r.calculable) return '<p class="match-carte__modele">' + badge('PASSER', 'passer') + '<span class="discret">Modèle non calculable</span></p>';
  const buts = `<span class="discret">Buts attendus ${esc(nombre(r.buts_attendus))}</span>`;
  if (r.decision === 'PARIER') {
    return `<p class="match-carte__modele">${badge(`Value ${valueTexte(r.value)}`, 'value')}${ib(EXPLICATIONS.value)}<span class="match-carte__pari">${esc(r.libelle)}</span>${buts}</p>`;
  }
  return `<p class="match-carte__modele">${badge('PASSER', 'passer')}${buts}</p>`;
}

function liste(matchs, dossier, tri) {
  if (matchs.length === 0) return '<p class="carte vide">Aucun match ne correspond à ces filtres.</p>';
  if (tri !== 'ligue') return `<div class="grille-matchs">${matchs.map((m) => carteMatch(m, dossier)).join('')}</div>`;
  const groupes = new Map();
  for (const m of matchs) {
    const cle = `${m.competition.nom} · ${m.competition.pays ?? 'N/D'}`;
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(m);
  }
  return [...groupes]
    .map(([titre, ms]) => `<section class="groupe"><h2 class="groupe__titre">${esc(titre)}</h2><div class="grille-matchs">${ms.map((m) => carteMatch(m, dossier)).join('')}</div></section>`)
    .join('');
}

const CLE_JOUR = 'apb.jour';

function lireJour() {
  try {
    return sessionStorage.getItem(CLE_JOUR);
  } catch {
    return null;
  }
}

function selecteurJour(jour, aujourdhui, jours) {
  const options = [...new Set([aujourdhui, ...jours])].sort();
  const libelle = (j) => `${j === aujourdhui ? 'Aujourd’hui — ' : ''}${dateLongue(j)}`;
  return `<label class="champ champ--jour">Jour
    <select id="choix-jour">
      ${options.map((j) => `<option value="${j}"${j === jour ? ' selected' : ''}>${esc(libelle(j))}</option>`).join('')}
      <option value="demo"${jour === 'demo' ? ' selected' : ''}>Démonstration (matchs fictifs)</option>
    </select></label>`;
}

export async function pageAccueil(app) {
  document.title = 'Matchs du jour — Analyse Paris Buts';
  const { dossier, jour, aujourdhui, jours, index, reel } = await chargerJournee(lireJour());
  const tous = index.matchs;
  const opts = optionsFiltres(tous);
  const reglages = lireReglages();
  const collecte = '<a href="#/collecte">Récupérer les matchs</a>';

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
        : `<div class="bandeau-demo" role="note">${badgeDemo()}<p>Aucun match importé pour aujourd'hui : ces ${tous.length} matchs sont <strong>fictifs</strong> (équipes, joueurs et chiffres inventés) et montrent seulement l'interface. Pour les vrais matchs : ${collecte}.</p></div>`
    }
    ${reel && !tous.length ? `<section class="carte"><p>Aucun match importé pour ce jour. Va dans ${collecte} : le site prépare la demande à coller dans Claude.</p></section>` : ''}
    <details class="carte filtres-bloc" id="bloc-filtres">
    <summary class="filtres-bloc__titre">Filtres et tri <span class="filtres-bloc__nb" id="nb-filtres"></span></summary>
    <form class="filtres" id="filtres" aria-label="Filtres">
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
    </details>
    <p class="compteur" id="compteur" aria-live="polite"></p>
    <div id="liste"></div>`;

  // Filtres dépliés sur grand écran, repliés sur téléphone pour montrer les matchs tout de suite.
  app.querySelector('#bloc-filtres').open = window.matchMedia('(min-width: 720px)').matches;
  const formulaire = app.querySelector('#filtres');
  const rafraichir = () => {
    const donnees = new FormData(formulaire);
    const filtres = Object.fromEntries(Object.keys(FILTRES_VIDES).map((k) => [k, donnees.get(k) ?? '']));
    const tri = donnees.get('tri') || 'heure';
    ecrireReglages({ filtres, tri });
    const actifs = Object.values(filtres).filter(Boolean).length;
    app.querySelector('#nb-filtres').textContent = actifs ? `(${actifs} actif${actifs > 1 ? 's' : ''})` : '';
    const visibles = trierMatchs(filtrerMatchs(tous, filtres), tri);
    app.querySelector('#compteur').textContent = `${visibles.length} match${visibles.length > 1 ? 's' : ''} sur ${tous.length}`;
    app.querySelector('#liste').innerHTML = liste(visibles, dossier, tri);
  };
  formulaire.addEventListener('change', rafraichir);
  formulaire.addEventListener('reset', (e) => {
    // Le reset natif reviendrait aux choix mémorisés (attributs selected) : on vide explicitement.
    e.preventDefault();
    for (const champ of formulaire.querySelectorAll('select')) champ.value = champ.name === 'tri' ? 'heure' : '';
    rafraichir();
  });
  rafraichir();

  app.querySelector('#choix-jour').addEventListener('change', (e) => {
    try {
      sessionStorage.setItem(CLE_JOUR, e.target.value);
    } catch {
      /* non mémorisé */
    }
    pageAccueil(app);
  });

  prechargerFiches(dossier, tous);
}
