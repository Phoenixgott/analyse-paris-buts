// Journal de paris : saisie, résolution automatique, statistiques, limites personnelles, alertes.
// Tout reste sur l'appareil (IndexedDB) ; export CSV et sauvegarde possibles.
import { cote as coteTexte, dateLongue, esc, heure, jourParis, pct, proba, valueTexte } from '../format.js';
import * as local from '../donnees/local.js';
import { calculerModeleLocal } from '../donnees/chargement.js';
import { MARCHES, STATUTS, creerPari, resoudreManuellement, statistiques, versCsv } from '../journal/paris.js';
import { alerterLimites, ecrireReglages, jourDe, lireReglages, listerParis, maintenant, nouvelId, resoudreEnAttente, verifierLimites } from '../journal/service.js';
import { envoyerAlerte, topicAleatoire, topicValide } from '../alertes/ntfy.js';
import { kpiSimple } from '../composants/carte-kpi.js';
import { badge } from '../composants/badge.js';
import { ib } from '../composants/info-bulle.js';
import { copier, telecharger } from '../composants/presse-papier.js';
import { EXPLICATIONS } from '../explications.js';

const euros = (v) => (v == null ? 'N/D' : `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
const signeEuros = (v) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${euros(Math.abs(v))}`);
const classeGain = (v) => (v > 0 ? 'value--pos' : v < 0 ? 'value--neg' : '');
const nombre = (texte) => {
  const n = Number(String(texte ?? '').replace(',', '.').trim());
  return texte === '' || texte == null || !Number.isFinite(n) ? null : n;
};

const AIDE_ROI = 'ROI = gains nets ÷ total misé sur les paris gagnés ou perdus (remboursés et annulés exclus). Positif : tu gagnes plus que tu ne mises.';
const AIDE_REUSSITE = 'Taux de réussite = paris gagnés ÷ paris gagnés ou perdus. Il ne dit pas si tu gagnes de l’argent : un taux bas avec de grosses cotes peut être rentable, et l’inverse.';

function libelleOption(m) {
  const d = new Date(m.coup_envoi);
  const jour = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: '2-digit', month: '2-digit' }).format(d);
  return `${jour} ${heure(m.coup_envoi)} · ${m.equipes.domicile.nom} – ${m.equipes.exterieur.nom}`;
}

function carteParis(p) {
  const statut = p.statut === 'gagne' ? badge('Gagné', 'gagne') : p.statut === 'perdu' ? badge('Perdu', 'perdu') : badge(STATUTS[p.statut], p.statut === 'en_cours' ? 'categorie' : 'nd');
  const actions =
    p.statut === 'en_cours'
      ? `<div class="pari__actions" data-pari="${esc(p.id)}">
          <button type="button" class="bouton bouton--petit bouton--discret" data-statut="gagne">Gagné</button>
          <button type="button" class="bouton bouton--petit bouton--discret" data-statut="perdu">Perdu</button>
          <button type="button" class="bouton bouton--petit bouton--discret" data-statut="rembourse">Remboursé</button>
          <button type="button" class="bouton bouton--petit bouton--discret" data-supprimer>Supprimer</button>
        </div>`
      : `<div class="pari__actions" data-pari="${esc(p.id)}">
          <button type="button" class="bouton bouton--petit bouton--discret" data-rouvrir>Rouvrir</button>
          <button type="button" class="bouton bouton--petit bouton--discret" data-supprimer>Supprimer</button>
        </div>`;
  return `<article class="pari pari--${p.statut}">
    <div class="pari__haut"><span class="discret">${esc(dateLongue(p.date_match))}</span>${statut}</div>
    <p class="pari__titre">${esc(p.libelle_match)}</p>
    <p class="pari__detail">${esc(p.libelle_marche)} · cote ${esc(coteTexte(p.cote))} · mise ${esc(euros(p.mise))}${p.gain != null ? ` · <span class="${classeGain(p.gain)}">${esc(signeEuros(p.gain))}</span>` : ''}</p>
    ${p.resultat?.raison ? `<p class="discret">${esc(p.resultat.raison)}${p.resolution === 'auto' ? ' (résolu automatiquement)' : ''}</p>` : ''}
    ${p.note ? `<p class="discret">« ${esc(p.note)} »</p>` : ''}
    ${actions}
  </article>`;
}

export async function pageJournal(app, query = new URLSearchParams()) {
  document.title = 'Journal de paris — Analyse Paris Buts';
  const resolusAuto = await resoudreEnAttente();
  const [paris, reglages, matchs] = await Promise.all([listerParis(), lireReglages(), local.lister('matchs')]);
  const stats = statistiques(paris, reglages.bankroll_initiale);
  const { limites } = await verifierLimites();

  // Matchs proposés : ceux collectés sur cet appareil, du plus proche au plus lointain.
  const aujourdhui = jourParis();
  const proposes = [...matchs].sort((a, b) => Math.abs(Date.parse(a.coup_envoi) - Date.now()) - Math.abs(Date.parse(b.coup_envoi) - Date.now())).slice(0, 40);
  const matchChoisi = query.get('dossier') === 'local' ? query.get('match') : null;
  const prerempli = !!matchChoisi;

  const alertesLimites = [];
  if (limites.stop_loss_atteint) alertesLimites.push(`Stop-loss atteint aujourd’hui : ${signeEuros(limites.net_jour)} (limite −${euros(limites.stop_loss)}). Arrête-toi pour aujourd’hui.`);
  if (limites.mise_max_atteinte) alertesLimites.push(`Mise maximale du jour atteinte : ${euros(limites.mises_jour)} misés (limite ${euros(limites.mise_max_jour)}).`);

  const kpis = [
    kpiSimple({ titre: 'Bankroll', valeurHtml: stats.bankroll == null ? '<a href="#reglages-journal" data-aller="reglages">À régler</a>' : esc(euros(stats.bankroll)), sous: reglages.bankroll_initiale != null ? `Départ ${euros(reglages.bankroll_initiale)}` : '', aide: 'Bankroll de départ (réglages) + gains nets des paris résolus.' }),
    kpiSimple({ titre: 'Gains nets', valeurHtml: `<span class="${classeGain(stats.gains)}">${esc(signeEuros(stats.gains))}</span>`, sous: `${stats.gagnes} gagné(s), ${stats.perdus} perdu(s)`, aide: 'Somme des gains et pertes des paris résolus (gagné : mise × (cote − 1) ; perdu : − mise ; remboursé : 0).' }),
    kpiSimple({ titre: 'ROI', valeurHtml: `<span class="${classeGain(stats.roi)}">${esc(stats.roi == null ? 'N/D' : valueTexte(stats.roi))}</span>`, sous: `${euros(stats.mises)} misés`, aide: AIDE_ROI }),
    kpiSimple({ titre: 'Réussite', valeurHtml: esc(stats.taux_reussite == null ? 'N/D' : pct(stats.taux_reussite * 100, 0)), sous: `${stats.en_cours} en cours`, aide: AIDE_REUSSITE }),
  ];

  app.innerHTML = `
    <header class="page-tete"><h1 class="page-titre">Journal de paris</h1>
      <p class="page-sous">Tes paris restent sur cet appareil. Probabilités estimées, pas des certitudes.</p></header>
    ${resolusAuto.length ? `<div class="bandeau-demo bandeau--info" role="status"><p>✓ ${resolusAuto.length} pari(s) résolu(s) automatiquement avec les derniers résultats importés.</p></div>` : ''}
    ${alertesLimites.length ? `<div class="bandeau-alerte" role="alert"><strong>Limite atteinte.</strong> ${alertesLimites.map(esc).join(' ')} Besoin d’aide : <a href="https://www.joueurs-info-service.fr/" target="_blank" rel="noopener noreferrer">joueurs-info-service.fr</a>.</div>` : ''}

    <section class="carte section">
      <h2 class="section__titre">Bilan</h2>
      <div class="grille-kpi grille-kpi--4">${kpis.join('')}</div>
      ${
        stats.courbe.length > 1
          ? `<figure class="graphique"><figcaption class="graphique__titre">Courbe de bankroll${ib('Bankroll après chaque pari résolu, dans l’ordre de résolution. Pointillés : bankroll de départ.')}</figcaption>
             <div class="graphique__zone" style="height:220px"><canvas id="g-bankroll" role="img" aria-label="Courbe de bankroll après chaque pari résolu"></canvas></div>
             <details class="graphique__donnees"><summary>Voir les données</summary><div class="table-cadre"><table class="table"><thead><tr><th scope="col">Étape</th><th scope="col" class="num">Bankroll</th></tr></thead><tbody>
               ${stats.courbe.map((c, i) => `<tr><th scope="row">${i === 0 ? 'Départ' : esc(c.libelle)}</th><td class="num">${esc(euros(c.bankroll))}</td></tr>`).join('')}
             </tbody></table></div></details></figure>`
          : '<p class="nd-bloc">La courbe apparaîtra après ton premier pari résolu.</p>'
      }
      <p class="actions-ligne"><button type="button" class="bouton bouton--discret" id="j-csv"${paris.length ? '' : ' disabled'}>Exporter en CSV</button></p>
    </section>

    <details class="carte section" id="bloc-nouveau"${prerempli || !paris.length ? ' open' : ''}>
      <summary class="section__titre resume-titre">Noter un pari</summary>
      <form id="j-form" class="formulaire" novalidate>
        <label class="champ">Match
          <select id="j-match"><option value="">— Choisir un match récupéré —</option>
            ${proposes.map((m) => `<option value="${esc(m.match_id)}"${m.match_id === matchChoisi ? ' selected' : ''}>${esc(libelleOption(m))}</option>`).join('')}
            <option value="__libre">Autre match (saisie libre)</option>
          </select></label>
        <label class="champ" id="j-libre-bloc" hidden>Match (texte libre)<input id="j-libre" maxlength="120" placeholder="Ex. : Rennes – Lille"></label>
        <label class="champ">Pari<select id="j-marche"></select></label>
        <div class="formulaire__ligne">
          <label class="champ">Cote<input id="j-cote" inputmode="decimal" placeholder="1,85" value="${esc(query.get('cote')?.replace('.', ',') ?? '')}"></label>
          <label class="champ">Mise (€)<input id="j-mise" inputmode="decimal" placeholder="5"></label>
        </div>
        <p class="aide" id="j-conseil" aria-live="polite"></p>
        <label class="champ">Note (facultatif)<input id="j-note" maxlength="300"></label>
        <button type="submit" class="bouton bouton--large">Enregistrer le pari</button>
        <p class="etat" id="j-etat" role="status" aria-live="polite"></p>
      </form>
    </details>

    <section class="carte section">
      <h2 class="section__titre">Mes paris <span class="discret">(${paris.length})</span></h2>
      ${paris.length ? `<div class="liste-paris">${paris.map(carteParis).join('')}</div>` : '<p class="nd-bloc">Aucun pari noté pour l’instant.</p>'}
      <p class="aide">Les paris se résolvent tout seuls quand tu importes les résultats (menu Récupérer les matchs, étape 4). Tu peux aussi les trancher à la main.</p>
    </section>

    <details class="carte section" id="reglages-journal">
      <summary class="section__titre resume-titre">Réglages : bankroll, limites, alertes</summary>
      <form id="j-reglages" class="formulaire" novalidate>
        <label class="champ">Bankroll de départ (€)<input id="r-bankroll" inputmode="decimal" value="${esc(reglages.bankroll_initiale ?? '')}"></label>
        <div class="formulaire__ligne">
          <label class="champ">Mise max par jour (€)<input id="r-mise-max" inputmode="decimal" value="${esc(reglages.mise_max_jour ?? '')}"></label>
          <label class="champ">Stop-loss par jour (€)<input id="r-stop" inputmode="decimal" value="${esc(reglages.stop_loss ?? '')}"></label>
        </div>
        <p class="aide">Stop-loss : perte nette maximale acceptée sur les paris placés dans la journée. Le site t’avertit (et te demande de confirmer) avant de dépasser une limite.</p>
        <label class="case"><input type="checkbox" id="r-a-value"${reglages.alertes_value ? ' checked' : ''}> Alerte : nouveaux value bets après un import</label>
        <label class="case"><input type="checkbox" id="r-a-limites"${reglages.alertes_limites ? ' checked' : ''}> Alerte : limite du jour atteinte</label>
        <label class="case"><input type="checkbox" id="r-a-resolutions"${reglages.alertes_resolutions ? ' checked' : ''}> Alerte : paris résolus</label>
        <p class="actions-ligne"><button type="submit" class="bouton">Enregistrer les réglages</button></p>
        <p class="etat" id="r-etat" role="status" aria-live="polite"></p>
      </form>
    </details>

    <details class="carte section" id="bloc-alertes"${topicValide(reglages.ntfy_topic) ? '' : ' open'}>
      <summary class="section__titre resume-titre">Alertes sur ton téléphone ${topicValide(reglages.ntfy_topic) ? '<span class="discret">(activées)</span>' : ''}</summary>
      <ol class="etapes-alertes">
        <li>
          <p><strong>Crée ton canal secret.</strong></p>
          <button type="button" class="bouton" id="r-generer">${topicValide(reglages.ntfy_topic) ? 'Créer un nouveau canal' : 'Créer mon canal'}</button>
          <p class="canal" id="r-canal"${topicValide(reglages.ntfy_topic) ? '' : ' hidden'}>Ton canal : <code id="r-topic-affiche">${esc(reglages.ntfy_topic)}</code></p>
        </li>
        <li>
          <p><strong>Abonne-toi dans l’appli ntfy</strong> (installée sur ce téléphone).</p>
          <a class="bouton" id="r-ouvrir-ntfy" href="${topicValide(reglages.ntfy_topic) ? `ntfy://ntfy.sh/${esc(reglages.ntfy_topic)}` : '#'}"${topicValide(reglages.ntfy_topic) ? '' : ' aria-disabled="true"'}>Ouvrir ntfy et m’abonner</a>
          <p class="aide">Dans ntfy, touche « S’abonner » (Subscribe). Si le bouton n’ouvre rien : dans ntfy, touche <strong>+</strong> en bas à droite, colle le nom du canal (bouton ci-dessous), puis « S’abonner ».</p>
          <button type="button" class="bouton bouton--petit bouton--discret" id="r-copier">Copier le nom du canal</button>
        </li>
        <li>
          <p><strong>Vérifie</strong> : une notification doit arriver dans ntfy.</p>
          <button type="button" class="bouton" id="r-tester">Envoyer une alerte test</button>
        </li>
      </ol>
      <p class="etat" id="a-etat" role="status" aria-live="polite"></p>
      <p class="aide">Toute personne qui connaît ce nom peut lire tes alertes : garde-le pour toi. Elles partent du site vers ntfy.sh, sans clé ni compte.</p>
    </details>`;

  const $ = (s) => app.querySelector(s);

  // --- Graphique ---
  if (stats.courbe.length > 1) {
    const page = location.hash;
    import('../graphiques/journal.js').then(({ dessinerBankroll }) => {
      if (location.hash === page && $('#g-bankroll')) dessinerBankroll($('#g-bankroll'), stats.courbe);
    });
  }

  // --- Formulaire : marchés et mise conseillée selon le match choisi ---
  let modele = null;
  let match = null;
  async function majMarches() {
    const id = $('#j-match').value;
    $('#j-libre-bloc').hidden = id !== '__libre';
    match = matchs.find((m) => m.match_id === id) ?? null;
    modele = match ? await calculerModeleLocal(match) : null;
    const buteurs = (modele?.buteurs ?? []).map((b) => ({ marche: `buteur:${b.nom}`, libelle: `Buteur : ${b.nom}` }));
    const voulu = query.get('marche');
    $('#j-marche').innerHTML = [...MARCHES, ...buteurs].map((m) => `<option value="${esc(m.marche)}"${m.marche === voulu ? ' selected' : ''}>${esc(m.libelle)}</option>`).join('');
    majConseil();
  }
  function majConseil() {
    const m = modele?.marches.find((x) => x.marche === $('#j-marche').value);
    const c = nombre($('#j-cote').value);
    if (!m || m.proba == null) {
      $('#j-conseil').textContent = match ? 'Pas de probabilité du modèle pour ce pari.' : '';
      return;
    }
    const v = c ? m.proba * c - 1 : null;
    const bankroll = stats.bankroll;
    const conseil = m.suggere && bankroll != null ? ` Mise conseillée : ${pct(m.mise_pct * 100, 1)} de ta bankroll, soit ${euros(m.mise_pct * bankroll)}.` : m.suggere ? ` Mise conseillée : ${pct(m.mise_pct * 100, 1)} de ta bankroll.` : ' Ce pari ne passe pas tous les filtres du modèle (mise conseillée : 0).';
    $('#j-conseil').innerHTML = `Modèle : ${esc(proba(m.proba))}${v != null ? ` · value à cette cote <span class="${classeGain(v)}">${esc(valueTexte(v))}</span>` : ''} · cote minimale ${esc(coteTexte(m.cote_min))}.${esc(conseil)}${ib(`${EXPLICATIONS.value} ${EXPLICATIONS.mise}`)}`;
  }
  $('#j-match').addEventListener('change', majMarches);
  $('#j-marche').addEventListener('change', majConseil);
  $('#j-cote').addEventListener('input', majConseil);
  await majMarches();

  $('#j-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#j-match').value;
    const m = matchs.find((x) => x.match_id === id);
    const donnees = {
      libelle_match: m ? `${m.equipes.domicile.nom} – ${m.equipes.exterieur.nom}` : id === '__libre' ? $('#j-libre').value : '',
      match_id: m?.match_id ?? null,
      dossier: m ? 'local' : null,
      date_match: m ? jourDe(m.coup_envoi) : aujourdhui,
      coup_envoi: m?.coup_envoi ?? null,
      competition: m?.competition.nom ?? null,
      marche: $('#j-marche').value,
      cote: $('#j-cote').value,
      mise: $('#j-mise').value,
      note: $('#j-note').value,
    };
    const mm = modele?.marches.find((x) => x.marche === donnees.marche);
    donnees.proba_modele = mm?.proba ?? null;
    const coteN = nombre(donnees.cote);
    donnees.value = mm?.proba != null && coteN ? Math.round((mm.proba * coteN - 1) * 10000) / 10000 : null;
    const { pari, erreur } = creerPari(donnees, { id: nouvelId(), maintenant: maintenant() });
    if (erreur) {
      $('#j-etat').textContent = erreur;
      return;
    }
    const { alertes } = await verifierLimites(pari.mise);
    if (alertes && !window.confirm(`${alertes.join('\n')}\n\nEnregistrer quand même ce pari ?`)) {
      $('#j-etat').textContent = 'Pari non enregistré.';
      return;
    }
    await local.ecrire('paris', [pari]);
    const apres = await verifierLimites();
    const messages = [];
    if (apres.limites.mise_max_atteinte) messages.push(`Mise maximale du jour atteinte (${euros(apres.limites.mises_jour)}).`);
    if (apres.limites.stop_loss_atteint) messages.push(`Stop-loss du jour atteint (${signeEuros(apres.limites.net_jour)}).`);
    if (messages.length) await alerterLimites(messages);
    history.replaceState(null, '', '#/journal');
    await pageJournal(app);
  });

  // --- Résolution manuelle, rouvrir, supprimer ---
  app.querySelectorAll('.pari__actions').forEach((bloc) =>
    bloc.addEventListener('click', async (e) => {
      const bouton = e.target.closest('button');
      if (!bouton) return;
      const p = paris.find((x) => x.id === bloc.dataset.pari);
      if (bouton.dataset.statut) await local.ecrire('paris', [resoudreManuellement(p, bouton.dataset.statut, maintenant())]);
      else if ('rouvrir' in bouton.dataset) await local.ecrire('paris', [{ ...p, statut: 'en_cours', gain: null, resultat: null, resolu_le: null, resolution: null }]);
      else if ('supprimer' in bouton.dataset) {
        if (!window.confirm(`Supprimer le pari « ${p.libelle_match} — ${p.libelle_marche} » ?`)) return;
        await local.supprimer('paris', [p.id]);
      }
      await pageJournal(app);
    }),
  );

  // --- Export CSV ---
  $('#j-csv').addEventListener('click', () => telecharger(`journal-paris-${aujourdhui}.csv`, versCsv(paris), 'text/csv;charset=utf-8'));

  // --- Réglages ---
  app.querySelector('[data-aller="reglages"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    $('#reglages-journal').open = true;
    $('#r-bankroll').focus();
  });
  // --- Alertes : le canal est enregistré dès sa création (rien d'autre à valider) ---
  let topic = reglages.ntfy_topic;
  const afficherCanal = () => {
    const ok = topicValide(topic);
    $('#r-canal').hidden = !ok;
    $('#r-topic-affiche').textContent = topic;
    $('#r-ouvrir-ntfy').href = ok ? `ntfy://ntfy.sh/${topic}` : '#';
    $('#r-ouvrir-ntfy').toggleAttribute('aria-disabled', !ok);
    $('#r-generer').textContent = ok ? 'Créer un nouveau canal' : 'Créer mon canal';
  };
  $('#r-generer').addEventListener('click', async () => {
    if (topicValide(topic) && !window.confirm('Créer un nouveau canal ? Il faudra te réabonner dans ntfy.')) return;
    topic = topicAleatoire();
    await ecrireReglages({ ...(await lireReglages()), ntfy_topic: topic });
    afficherCanal();
    $('#a-etat').textContent = 'Canal créé et enregistré. Étape suivante : « Ouvrir ntfy et m’abonner ».';
  });
  $('#r-ouvrir-ntfy').addEventListener('click', (e) => {
    if (!topicValide(topic)) {
      e.preventDefault();
      $('#a-etat').textContent = 'Crée d’abord ton canal (étape 1).';
    }
  });
  $('#r-copier').addEventListener('click', async () => {
    if (!topicValide(topic)) {
      $('#a-etat').textContent = 'Crée d’abord ton canal (étape 1).';
      return;
    }
    const ok = await copier(topic);
    $('#a-etat').textContent = ok ? `Nom copié : ${topic}. Colle-le dans ntfy (bouton +).` : `Copie impossible : recopie ce nom dans ntfy : ${topic}`;
  });
  $('#r-tester').addEventListener('click', async () => {
    if (!topicValide(topic)) {
      $('#a-etat').textContent = 'Crée d’abord ton canal (étape 1).';
      return;
    }
    try {
      await envoyerAlerte(topic, 'Alerte test : si tu lis ceci, les alertes fonctionnent. Probabilités estimées, pas des certitudes. 18+', { titre: 'Analyse Paris Buts — test', tags: ['soccer'], priorite: 3 });
      $('#a-etat').textContent = 'Alerte test envoyée : elle doit arriver dans ntfy d’ici quelques secondes. Rien reçu ? Vérifie l’abonnement (étape 2).';
    } catch (err) {
      $('#a-etat').textContent = `Envoi impossible : ${err.message}. Vérifie ta connexion internet.`;
    }
  });

  // --- Réglages : bankroll et limites ---
  const lireFormulaire = () => ({
    bankroll_initiale: nombre($('#r-bankroll').value),
    mise_max_jour: nombre($('#r-mise-max').value),
    stop_loss: nombre($('#r-stop').value),
    ntfy_topic: topic,
    alertes_value: $('#r-a-value').checked,
    alertes_limites: $('#r-a-limites').checked,
    alertes_resolutions: $('#r-a-resolutions').checked,
  });
  $('#j-reglages').addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = lireFormulaire();
    for (const [cle, v] of [['bankroll', r.bankroll_initiale], ['mise max', r.mise_max_jour], ['stop-loss', r.stop_loss]]) {
      if (v != null && v <= 0) {
        $('#r-etat').textContent = `La valeur « ${cle} » doit être positive (ou vide).`;
        return;
      }
    }
    await ecrireReglages(r);
    $('#r-etat').textContent = 'Réglages enregistrés.';
    setTimeout(() => pageJournal(app), 600);
  });
}
