// Page « Récupérer les matchs » : collecte SANS clé API.
// Le site prépare une demande → tu la colles dans une conversation Claude avec la recherche web →
// tu recolles la réponse ici → le site la vérifie, la range sur ton appareil et calcule le modèle.
import { dateLongue, esc, heure, jourParis } from '../format.js';
import { COMPETITIONS } from '../collecte/competitions.js';
import { promptFiches, promptListe, promptMiseAJour, promptResultats } from '../collecte/prompts.js';
import { extraireReponse, importerReponse } from '../collecte/import.js';
import * as local from '../donnees/local.js';
import { calculerModeleLocal, chargerNoms } from '../donnees/chargement.js';
import { resumeMatch } from '../../scripts/lib/index-jour.js';
import { extrairePicks } from '../journal/picks.js';
import { alerterValueBets, resoudreEnAttente } from '../journal/service.js';
import { copier, telecharger } from '../composants/presse-papier.js';
import SCHEMA from '../../schema/match.schema.json';
import { valider } from '../../schema/valider.js';

const CLE_COMPETITIONS = 'apb.competitionsCollecte';
const MAX_FICHES = 3;
const MAX_MAJ = 5;
const MAX_RESULTATS = 10;

const GROUPES = [
  ['Championnats', (c) => c.categorie === 'H' && c.fd],
  ['Coupes d’Europe', (c) => ['ucl', 'uel', 'uecl'].includes(c.id)],
  ['Féminines', (c) => c.categorie === 'F'],
  ['Sélections', (c) => c.categorie === 'INT'],
];

function competitionsChoisies() {
  try {
    const v = JSON.parse(localStorage.getItem(CLE_COMPETITIONS));
    if (Array.isArray(v)) return new Set(v);
  } catch {
    /* réglage absent */
  }
  return new Set(['fr-l1']);
}

const maintenant = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const jourDe = (m) => jourParis(new Date(m.coup_envoi));

function etape(num, titre, contenu) {
  return `<section class="carte etape" aria-labelledby="etape-${num}">
    <h2 class="etape__titre" id="etape-${num}"><span class="etape__num" aria-hidden="true">${num}</span>${esc(titre)}</h2>
    ${contenu}
  </section>`;
}

function blocCollage(type, consigne) {
  return `<p class="aide">${consigne}</p>
    <label class="champ">Colle ici la réponse de Claude
      <textarea data-reponse="${type}" rows="5" spellcheck="false" placeholder="La réponse contient un bloc JSON…"></textarea>
    </label>
    <button type="button" class="bouton" data-importer="${type}">Importer la réponse</button>
    <div class="rapport" data-rapport="${type}" role="status" aria-live="polite"></div>`;
}

const ETAPES_CLAUDE =
  'Ouvre une nouvelle conversation Claude, <strong>active la recherche web</strong>, colle la demande et envoie. Si Claude écrit « SUITE DISPONIBLE », réponds « continue » et colle aussi la suite ici.';

function rendreRapport(r, types, suites = []) {
  const lignes = [];
  if (r.annonces) lignes.push(`<li class="ok">✓ ${r.annonces} match(s) ajouté(s) à la liste du jour.</li>`);
  if (r.resultats) lignes.push(`<li class="ok">✓ ${r.resultats} résultat(s) enregistré(s).</li>`);
  for (const s of suites) lignes.push(`<li class="ok">${esc(s)}</li>`);
  for (const n of r.nouveaux) lignes.push(`<li class="ok">✓ Nouvelle fiche : ${esc(n)}</li>`);
  for (const n of r.mis_a_jour) lignes.push(`<li class="ok">↻ Mise à jour : ${esc(n)}</li>`);
  for (const a of r.avertissements) lignes.push(`<li class="attention">⚠ ${esc(a.match)} : ${esc(a.message)}</li>`);
  for (const e of r.ecartes) lignes.push(`<li class="ecarte">✗ ${esc(e.match)} : ${esc(e.raison)}</li>`);
  for (const e of r.erreurs) lignes.push(`<li class="ecarte">✗ ${esc(e)}</li>`);
  if (!lignes.length) lignes.push(`<li class="attention">⚠ Rien d’exploitable dans cette réponse (${esc(types.join(', ') || 'aucun bloc')}).</li>`);
  if (r.suite) lignes.push('<li class="attention">⏳ Claude a écrit « SUITE DISPONIBLE » : réponds-lui « continue », puis colle la suite ici.</li>');
  return `<ul class="rapport__liste">${lignes.join('')}</ul>`;
}

export async function pageCollecte(app) {
  document.title = 'Récupérer les matchs — Analyse Paris Buts';
  const choisies = competitionsChoisies();
  const disponible = await local.stockageDisponible();

  const cases = GROUPES.map(([titre, filtre]) => `<fieldset class="groupe-cases"><legend>${esc(titre)}</legend>
      ${COMPETITIONS.filter(filtre)
        .map((c) => `<label class="case"><input type="checkbox" name="competition" value="${c.id}"${choisies.has(c.id) ? ' checked' : ''}> ${esc(c.nom)}${c.categorie === 'H' && c.fd ? ` <span class="discret">${esc(c.pays)}</span>` : ''}</label>`)
        .join('')}
    </fieldset>`).join('');

  app.innerHTML = `
    <header class="page-tete">
      <h1 class="page-titre">Récupérer les matchs</h1>
      <p class="page-sous">Sans clé API : le site prépare une demande, Claude la remplit avec la recherche web, tu recolles sa réponse ici.</p>
    </header>
    ${disponible ? '' : '<div class="bandeau-alerte" role="note"><strong>Stockage indisponible.</strong> Ce navigateur refuse l’enregistrement local : les matchs importés seront perdus à la fermeture. Sauvegarde-les en fichier.</div>'}
    <label class="champ champ--date">Jour des matchs <input type="date" id="c-date" value="${jourParis()}"></label>

    ${etape(1, 'Liste des matchs du jour', `
      <details class="volet" id="volet-competitions">
        <summary><span>Compétitions</span> <span class="volet__resume" id="resume-competitions"></span></summary>
        <div class="grille-cases">${cases}</div>
        <p class="actions-ligne"><button type="button" class="bouton bouton--petit bouton--discret" data-cocher="tout">Tout cocher</button>
          <button type="button" class="bouton bouton--petit bouton--discret" data-cocher="rien">Tout décocher</button></p>
      </details>
      <label class="case"><input type="checkbox" id="c-autres"> Ajouter les autres compétitions (palier 2, données réduites)</label>
      <button type="button" class="bouton bouton--large" data-copier="liste">Copier la demande (liste des matchs)</button>
      <p class="etat" data-etat="liste" role="status" aria-live="polite"></p>
      ${blocCollage('liste', ETAPES_CLAUDE)}`)}

    ${etape(2, 'Fiches complètes des matchs', `
      <p class="aide">Coche 1 à ${MAX_FICHES} matchs à la fois (une demande plus longue risque d’être coupée), puis copie la demande.</p>
      <div id="liste-annonces" class="liste-choix"></div>
      <button type="button" class="bouton bouton--large" data-copier="fiches">Copier la demande (fiches)</button>
      <p class="etat" data-etat="fiches" role="status" aria-live="polite"></p>
      ${blocCollage('fiches', ETAPES_CLAUDE)}`)}

    ${etape(3, 'Juste avant le match : cotes, compositions, absents', `
      <p class="aide">Pour les matchs dont la fiche est importée, 1 à ${MAX_MAJ} à la fois. À faire 1 à 2 heures avant le coup d’envoi.</p>
      <div id="liste-maj" class="liste-choix"></div>
      <button type="button" class="bouton bouton--large" data-copier="maj">Copier la demande (mise à jour)</button>
      <p class="etat" data-etat="maj" role="status" aria-live="polite"></p>
      ${blocCollage('maj', ETAPES_CLAUDE)}`)}

    ${etape(4, 'Après le match : résultats', `
      <p class="aide">Les scores servent à résoudre automatiquement les paris de ton journal. 1 à ${MAX_RESULTATS} matchs à la fois, une fois les matchs terminés.</p>
      <div id="liste-resultats" class="liste-choix"></div>
      <button type="button" class="bouton bouton--large" data-copier="resultats">Copier la demande (résultats)</button>
      <p class="etat" data-etat="resultats" role="status" aria-live="polite"></p>
      ${blocCollage('resultats', ETAPES_CLAUDE)}`)}

    <section class="carte etape">
      <h2 class="etape__titre">Mes données</h2>
      <p id="resume-donnees" class="aide"></p>
      <p><a href="#/" id="lien-jour">Voir les matchs de ce jour →</a></p>
      <p class="actions-ligne">
        <button type="button" class="bouton bouton--discret" id="c-sauver">Sauvegarder (.json)</button>
        <label class="bouton bouton--discret bouton--fichier">Restaurer<input type="file" accept="application/json,.json" id="c-restaurer" hidden></label>
        <button type="button" class="bouton bouton--discret" id="c-effacer">Effacer ce jour</button>
        <button type="button" class="bouton bouton--discret" id="c-tout-effacer">Effacer tous les matchs</button>
      </p>
      <p class="aide">« Effacer » retire les matchs, fiches et résultats de cet appareil. Ton journal de paris, tes réglages et l’archive des prédictions (page Fiabilité) sont conservés.</p>
      <p class="etat" data-etat="donnees" role="status" aria-live="polite"></p>
    </section>
    <details class="carte apercu-demande"><summary>Voir la dernière demande copiée</summary><textarea id="c-demande" readonly rows="10" aria-label="Dernière demande"></textarea></details>`;

  const $ = (s) => app.querySelector(s);
  const dateChoisie = () => $('#c-date').value || jourParis();
  const resumerCompetitions = () => {
    const noms = [...app.querySelectorAll('input[name=competition]:checked')].map((c) => COMPETITIONS.find((x) => x.id === c.value).nom);
    $('#resume-competitions').textContent = noms.length ? `: ${noms.slice(0, 3).join(', ')}${noms.length > 3 ? ` +${noms.length - 3}` : ''}` : ': aucune cochée';
  };
  resumerCompetitions();
  // Replié sur téléphone (le résumé suffit), déplié sur grand écran.
  $('#volet-competitions').open = window.matchMedia('(min-width: 720px)').matches;
  const etat = (type, texte) => {
    $(`[data-etat="${type}"]`).textContent = texte;
  };

  async function rafraichir() {
    const jour = dateChoisie();
    const [annonces, matchs] = await Promise.all([local.lister('annonces'), local.lister('matchs')]);
    const annoncesJour = annonces.filter((a) => a.date === jour).sort((a, b) => a.coup_envoi.localeCompare(b.coup_envoi));
    const matchsJour = matchs.filter((m) => jourDe(m) === jour).sort((a, b) => a.coup_envoi.localeCompare(b.coup_envoi));
    const parId = new Map(matchsJour.map((m) => [m.match_id, m]));

    $('#liste-annonces').innerHTML = annoncesJour.length
      ? annoncesJour
          .map((a) => {
            const m = parId.get(a.id);
            return `<label class="choix"><input type="checkbox" name="annonce" value="${esc(a.id)}">
              <span class="choix__heure">${esc(heure(a.coup_envoi))}</span>
              <span class="choix__texte">${esc(a.domicile)} – ${esc(a.exterieur)}<span class="discret">${esc(a.competition.nom)}</span></span>
              <span class="choix__statut ${m ? 'ok' : ''}">${m ? `fiche ✓ ${m.qualite_donnees}/100` : 'à récupérer'}</span></label>`;
          })
          .join('')
      : '<p class="nd-bloc">Aucun match dans la liste de ce jour : fais d’abord l’étape 1.</p>';

    $('#liste-maj').innerHTML = matchsJour.length
      ? matchsJour
          .map((m) => `<label class="choix"><input type="checkbox" name="maj" value="${esc(m.match_id)}">
            <span class="choix__heure">${esc(heure(m.coup_envoi))}</span>
            <span class="choix__texte">${esc(m.equipes.domicile.nom)} – ${esc(m.equipes.exterieur.nom)}<span class="discret">${esc(m.competition.nom)}</span></span>
            <span class="choix__statut">${m.cotes ? 'cotes ✓' : 'sans cotes'}</span></label>`)
          .join('')
      : '<p class="nd-bloc">Aucune fiche importée pour ce jour.</p>';

    const [resultats, paris] = await Promise.all([local.lister('resultats'), local.lister('paris')]);
    const scores = new Map(resultats.map((r) => [r.match_id, r]));
    $('#liste-resultats').innerHTML = matchsJour.length
      ? matchsJour
          .map((m) => {
            const r = scores.get(m.match_id);
            const enCours = paris.filter((p) => p.match_id === m.match_id && p.statut === 'en_cours').length;
            return `<label class="choix"><input type="checkbox" name="resultat" value="${esc(m.match_id)}">
              <span class="choix__heure">${esc(heure(m.coup_envoi))}</span>
              <span class="choix__texte">${esc(m.equipes.domicile.nom)} – ${esc(m.equipes.exterieur.nom)}<span class="discret">${enCours ? `${enCours} pari(s) en cours` : 'aucun pari en cours'}</span></span>
              <span class="choix__statut ${r ? 'ok' : ''}">${r ? `${esc(r.score ?? r.statut)}${r.score_mt ? ` (${esc(r.score_mt)})` : ''}` : 'à récupérer'}</span></label>`;
          })
          .join('')
      : '<p class="nd-bloc">Aucune fiche importée pour ce jour.</p>';

    const jours = [...new Set(matchs.map(jourDe))].length;
    $('#resume-donnees').textContent = `Sur cet appareil : ${matchs.length} fiche(s) sur ${jours} jour(s). Ce jour (${dateLongue(jour)}) : ${annoncesJour.length} match(s) listé(s), ${matchsJour.length} fiche(s).`;
    $('#lien-jour').href = '#/';
    $('#lien-jour').onclick = () => {
      try {
        sessionStorage.setItem('apb.jour', jour);
      } catch {
        /* non mémorisé */
      }
    };
  }

  // Cases à cocher : limite du nombre de matchs par demande.
  app.addEventListener('change', (e) => {
    const nom = e.target.name;
    if (nom === 'competition') {
      resumerCompetitions();
      const ids = [...app.querySelectorAll('input[name=competition]:checked')].map((c) => c.value);
      try {
        localStorage.setItem(CLE_COMPETITIONS, JSON.stringify(ids));
      } catch {
        /* non mémorisé */
      }
    }
    for (const [n, max, zone] of [['annonce', MAX_FICHES, 'fiches'], ['maj', MAX_MAJ, 'maj'], ['resultat', MAX_RESULTATS, 'resultats']]) {
      if (nom !== n) continue;
      const coches = app.querySelectorAll(`input[name=${n}]:checked`);
      if (coches.length > max) {
        e.target.checked = false;
        etat(zone, `${max} matchs au maximum par demande.`);
      }
    }
  });
  $('#c-date').addEventListener('change', rafraichir);
  app.querySelectorAll('[data-cocher]').forEach((b) =>
    b.addEventListener('click', () => {
      app.querySelectorAll('input[name=competition]').forEach((c) => (c.checked = b.dataset.cocher === 'tout'));
      app.querySelector('input[name=competition]').dispatchEvent(new Event('change', { bubbles: true }));
    }),
  );

  // Copier une demande.
  async function demande(type) {
    const jour = dateChoisie();
    if (type === 'liste') {
      const ids = [...app.querySelectorAll('input[name=competition]:checked')].map((c) => c.value);
      const autres = $('#c-autres').checked;
      if (!ids.length && !autres) return { erreur: 'Coche au moins une compétition.' };
      const noms = await chargerNoms(ids);
      return { texte: promptListe(jour, ids.map((id) => ({ id, noms_equipes: noms.get(id) })), { autres }) };
    }
    if (type === 'fiches') {
      const ids = [...app.querySelectorAll('input[name=annonce]:checked')].map((c) => c.value);
      if (!ids.length) return { erreur: 'Coche 1 à 3 matchs de la liste.' };
      const annonces = (await Promise.all(ids.map((id) => local.lire('annonces', id)))).filter(Boolean);
      const noms = await chargerNoms(annonces.map((a) => a.competition.id));
      return {
        texte: promptFiches(annonces.map((a) => ({ domicile: a.domicile, exterieur: a.exterieur, competition_id: a.competition.palier === 1 ? a.competition.id : 'autre', competition: a.competition.nom, pays: a.competition.pays, coup_envoi: a.coup_envoi, noms_equipes: noms.get(a.competition.id) }))),
      };
    }
    const nom = type === 'maj' ? 'maj' : 'resultat';
    const ids = [...app.querySelectorAll(`input[name=${nom}]:checked`)].map((c) => c.value);
    if (!ids.length) return { erreur: `Coche 1 à ${type === 'maj' ? MAX_MAJ : MAX_RESULTATS} matchs.` };
    const matchs = (await Promise.all(ids.map((id) => local.lire('matchs', id)))).filter(Boolean);
    const liste = matchs.map((m) => ({ domicile: m.equipes.domicile.nom, exterieur: m.equipes.exterieur.nom, coup_envoi: m.coup_envoi }));
    return { texte: type === 'maj' ? promptMiseAJour(liste) : promptResultats(liste) };
  }

  app.querySelectorAll('[data-copier]').forEach((b) =>
    b.addEventListener('click', async () => {
      const type = b.dataset.copier;
      const { texte, erreur } = await demande(type);
      if (erreur) return etat(type, erreur);
      const zone = $('#c-demande');
      zone.value = texte;
      const ok = await copier(texte, zone);
      etat(type, ok ? `Demande copiée (${texte.length.toLocaleString('fr-FR')} caractères). Colle-la dans Claude avec la recherche web.` : 'Copie impossible ici : la demande est affichée tout en bas, copie-la à la main.');
    }),
  );

  // Importer une réponse (le type est reconnu automatiquement).
  app.querySelectorAll('[data-importer]').forEach((b) =>
    b.addEventListener('click', async () => {
      const type = b.dataset.importer;
      const zone = app.querySelector(`[data-reponse="${type}"]`);
      const sortie = app.querySelector(`[data-rapport="${type}"]`);
      if (!zone.value.trim()) {
        sortie.innerHTML = '<ul class="rapport__liste"><li class="attention">⚠ Colle d’abord la réponse de Claude.</li></ul>';
        return;
      }
      const { objets } = extraireReponse(zone.value);
      const ids = objets.flatMap((o) => (Array.isArray(o?.matchs) ? o.matchs.map((m) => m?.competition_id) : []));
      const connus = new Map((await local.lister('matchs')).map((m) => [m.match_id, m]));
      const annonces = new Map((await local.lister('annonces')).map((a) => [a.id, a]));
      const noms = await chargerNoms([...ids, ...[...connus.values()].map((m) => m.competition.id)]);
      const r = importerReponse(zone.value, { maintenant: maintenant(), date: dateChoisie(), noms, matchs: connus, annonces });
      await local.ecrire('annonces', r.annonces);
      await local.ecrire('matchs', r.matchs);
      await local.ecrire('resultats', r.resultats);
      const suites = [];
      // Résultats → résolution automatique des paris du journal.
      if (r.resultats.length) {
        const resolus = await resoudreEnAttente();
        suites.push(resolus.length ? `✓ ${resolus.length} pari(s) du journal résolu(s) automatiquement.` : 'Aucun pari en cours à résoudre avec ces résultats.');
      }
      // Fiches ou mises à jour → value bets éventuels → alerte ntfy (si réglée dans le journal).
      if (r.matchs.length) {
        const entrees = await Promise.all(r.matchs.map(async (m) => ({ resume: resumeMatch(m), modele: await calculerModeleLocal(m), dossier: 'local' })));
        const picks = extrairePicks(entrees);
        if (picks.length) {
          const a = await alerterValueBets(picks);
          suites.push(`${picks.length} value bet(s) repéré(s) par le modèle${a.envoye ? ' — alerte envoyée sur ton téléphone' : ''} : voir Top picks.`);
        }
      }
      sortie.innerHTML = rendreRapport(r.rapport, r.types, suites);
      if (r.annonces.length || r.matchs.length || r.resultats.length) zone.value = '';
      await rafraichir();
    }),
  );

  // Sauvegarde / restauration / effacement.
  $('#c-sauver').addEventListener('click', async () => {
    const [annonces, matchs, paris, resultats, reglages, predictions] = await Promise.all(['annonces', 'matchs', 'paris', 'resultats', 'reglages', 'predictions'].map((m) => local.lister(m)));
    const contenu = { format: 'analyse-paris-buts/sauvegarde', version: 3, exporte_le: maintenant(), annonces, matchs, paris, resultats, reglages, predictions };
    telecharger(`analyse-paris-buts-sauvegarde-${jourParis()}.json`, JSON.stringify(contenu, null, 1));
    etat('donnees', `Sauvegarde : ${matchs.length} fiche(s), ${annonces.length} match(s) listé(s), ${paris.length} pari(s), ${resultats.length} résultat(s).`);
  });
  $('#c-restaurer').addEventListener('change', async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    try {
      const contenu = JSON.parse(await fichier.text());
      if (contenu?.format !== 'analyse-paris-buts/sauvegarde') throw new Error('ce fichier n’est pas une sauvegarde d’Analyse Paris Buts');
      const valides = (contenu.matchs ?? []).filter((m) => valider(m, SCHEMA).length === 0);
      const annonces = (contenu.annonces ?? []).filter((a) => a?.id && a?.coup_envoi && a?.competition);
      const paris = (contenu.paris ?? []).filter((p) => p?.id && p?.libelle_match && p?.marche && Number.isFinite(p?.cote) && Number.isFinite(p?.mise) && p?.statut);
      const resultats = (contenu.resultats ?? []).filter((r) => r?.match_id && r?.statut);
      const reglages = (contenu.reglages ?? []).filter((r) => r?.cle);
      // Seules les prédictions faites avant le coup d'envoi sont acceptées (pas de réécriture a posteriori).
      const predictions = (contenu.predictions ?? []).filter((p) => p?.match_id && p?.probas && p.calcule_le < p.coup_envoi);
      await local.ecrire('predictions', predictions);
      await local.ecrire('matchs', valides);
      await local.ecrire('annonces', annonces);
      await local.ecrire('paris', paris);
      await local.ecrire('resultats', resultats);
      await local.ecrire('reglages', reglages);
      etat('donnees', `Restauré : ${valides.length} fiche(s) (${(contenu.matchs ?? []).length - valides.length} refusée(s), non conformes au schéma), ${annonces.length} match(s) listé(s), ${paris.length} pari(s), ${resultats.length} résultat(s).`);
    } catch (err) {
      etat('donnees', `Restauration impossible : ${err.message}.`);
    }
    e.target.value = '';
    await rafraichir();
  });
  $('#c-effacer').addEventListener('click', async () => {
    const jour = dateChoisie();
    if (!window.confirm(`Effacer les matchs, fiches et résultats du ${dateLongue(jour)} de cet appareil ? (Les paris du journal sont conservés.)`)) return;
    const [annonces, matchs] = await Promise.all([local.lister('annonces'), local.lister('matchs')]);
    const ids = matchs.filter((m) => jourDe(m) === jour).map((m) => m.match_id);
    await local.supprimer('matchs', ids);
    await local.supprimer('modeles', ids);
    await local.supprimer('resultats', ids);
    await local.supprimer('annonces', annonces.filter((a) => a.date === jour).map((a) => a.id));
    etat('donnees', `${ids.length} fiche(s) effacée(s).`);
    await rafraichir();
  });
  $('#c-tout-effacer').addEventListener('click', async () => {
    const n = (await local.lister('matchs')).length + (await local.lister('annonces')).length;
    if (!n) {
      etat('donnees', 'Aucun match à effacer.');
      return;
    }
    if (!window.confirm('Effacer TOUS les matchs, fiches et résultats de cet appareil ?\n\nTon journal de paris, tes réglages et l’archive des prédictions sont conservés. Astuce : « Sauvegarder (.json) » avant, pour pouvoir revenir en arrière.')) return;
    for (const magasin of ['annonces', 'matchs', 'modeles', 'resultats']) await local.vider(magasin);
    try {
      sessionStorage.removeItem('apb.jour');
    } catch {
      /* rien à oublier */
    }
    etat('donnees', 'Tous les matchs ont été effacés. L’accueil affiche de nouveau la démo.');
    await rafraichir();
  });

  await rafraichir();
}
