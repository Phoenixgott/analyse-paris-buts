// Fiche match — ce qui vient du modèle : verdict, chiffres clés, ligne de buts à choisir (mise à jour
// sur place) et onglet « Paris » (graphique modèle/marché, 1re mi-temps, buteurs, confiance, méthode).
import { ND, cote, esc, nombre, pct, proba, valueTexte } from '../format.js';
import { blocJauge, blocOverUnder } from './blocs-graphiques.js';
import { badge } from '../composants/badge.js';
import { kpiSimple } from '../composants/carte-kpi.js';
import { tableau } from '../composants/tableau-triable.js';
import { ib } from '../composants/info-bulle.js';
import { EXPLICATIONS } from '../explications.js';
import { rappelBacktest } from '../composants/rappel-backtest.js';
import { LIGNES, detailLigne, ligneInitiale } from '../fiche/ligne.js';
import { SEUIL_FIABLE, estFiable } from '../../schema/qualite.js';

const AIDE_AJUSTEMENTS =
  'Chaque ajustement modifie les buts attendus de l’équipe concernée d’un pourcentage fixe (repos ≤ 3 jours −3 %, derby −2 %, arbitre à penaltys ±1-2 %, pluie −3 %, vent fort −4 %, −1,5 % par absent, max −6 %). La somme est plafonnée à ±10 % par équipe. Une donnée absente n’ajuste rien.';

const AIDE_FILTRES =
  'Un pari n’est suggéré que s’il passe tous les filtres : match fiable (qualité des données ≥ 40/100), value d’au moins 5 % et d’au plus 30 % (au-delà, c’est plus probablement une erreur du modèle), probabilité d’au moins 20 % et confiance d’au moins 50/100. Sinon : PASSER.';

const AIDE_MARCHE = 'Probabilité implicite des cotes du bookmaker, marge retirée : (1/cote Plus) ÷ (1/cote Plus + 1/cote Moins). C’est le trait blanc sur la barre.';

const classeValue = (v) => (v == null ? '' : v > 0 ? 'value--pos' : v < 0 ? 'value--neg' : '');

function celluleProba(marche) {
  if (!marche) return `<span class="cote--nd">${ND}</span>`;
  const etoile = marche.suggere ? badge('Value', 'value', 'Pari qui passe tous les filtres') : '';
  const detail = marche.cote == null ? 'cote N/D' : `cote ${cote(marche.cote)} · <span class="${classeValue(marche.value)}">${esc(valueTexte(marche.value))}</span>`;
  return `<span class="proba">${esc(proba(marche.proba))}</span>${etoile}<span class="cellule-sous">${detail}</span>`;
}

export function lienJournal(dossier, matchId, marche = null, coteVal = null) {
  const q = new URLSearchParams({ dossier, match: matchId });
  if (marche) q.set('marche', marche);
  if (coteVal) q.set('cote', String(coteVal));
  return `#/journal?${q}`;
}

export function verdict(m, dossier, backtest) {
  const v = m.verdict;
  const local = dossier === 'local';
  const autre = local ? `<p class="verdict__actions"><a href="${lienJournal(dossier, m.match_id)}">Noter un autre pari sur ce match</a></p>` : '';
  if (v.decision === 'PARIER') {
    return `<div class="verdict verdict--parier" role="note">
      <p class="verdict__titre"><span class="verdict__decision">PARIER</span> ${esc(v.libelle)}</p>
      <p class="verdict__detail">Probabilité ${esc(proba(v.proba))} · cote ${esc(cote(v.cote))} (minimum ${esc(cote(v.cote_min))}${ib(EXPLICATIONS.cote_min)}) ·
        value <span class="value--pos">${esc(valueTexte(v.value))}</span>${ib(EXPLICATIONS.value)} · mise ${esc(pct(v.mise_pct * 100, 1))} de la bankroll${ib(EXPLICATIONS.mise)}</p>
      ${rappelBacktest(backtest)}
      <p class="verdict__avert">Probabilités estimées, pas des certitudes. Lis aussi les arguments contre ce pari avant de jouer.</p>
      ${local ? `<p class="verdict__actions"><a class="bouton bouton--petit" href="${lienJournal(dossier, m.match_id, v.marche, v.cote)}">Noter ce pari dans le journal</a></p>` : m.demo ? '<p class="discret">Match fictif (DÉMO) : il ne peut pas être noté dans le journal.</p>' : ''}
    </div>`;
  }
  return `<div class="verdict verdict--passer" role="note">
    <p class="verdict__titre"><span class="verdict__decision">PASSER</span></p>
    <p class="verdict__detail">${esc(v.raison)}${ib(AIDE_FILTRES, 'Quand un pari est-il suggéré ?')}</p>
    <p class="verdict__avert">Passer est un résultat normal et fréquent : aucun pari n’est préférable à un mauvais pari.</p>
    ${autre}
  </div>`;
}

/** Les trois chiffres du haut de la fiche : buts attendus, Plus de 2,5 buts, qualité des données. */
export function chiffresCles(m, match) {
  const fiable = estFiable(match.qualite_donnees);
  const ok = m?.calculable;
  return `<div class="grille-kpi chiffres-cles">
    ${kpiSimple({ titre: 'Buts attendus', valeurHtml: esc(ok ? nombre(m.buts_attendus.total, 1) : ND), sous: ok ? `${nombre(m.buts_attendus.domicile, 1)} – ${nombre(m.buts_attendus.exterieur, 1)}` : '', aide: EXPLICATIONS.buts_attendus })}
    ${kpiSimple({ titre: 'Plus de 2,5 buts', valeurHtml: esc(ok ? proba(m.total_buts.over_2_5, 0) : ND), sous: 'selon le modèle', aide: EXPLICATIONS.proba_total })}
    ${kpiSimple({
      titre: 'Qualité',
      valeurHtml: `<span class="qualite qualite--${fiable ? (match.qualite_donnees < 70 ? 'moyenne' : 'bonne') : 'faible'}"><span class="qualite__val">${esc(match.qualite_donnees)}</span><span class="qualite__sur">/100</span></span>`,
      sous: fiable ? 'des données' : `sous ${SEUIL_FIABLE} : non fiable`,
      aide: EXPLICATIONS.qualite_donnees,
    })}
  </div>`;
}

// --- Ligne de buts : on choisit 0,5 → 5,5 et Plus/Moins, tout se met à jour sur place ---------
function resultatLigne(m, match, dossier, k, sens) {
  const d = detailLigne(m, match, k, sens);
  const largeur = (x) => `${Math.round(x * 1000) / 10}%`;
  const barre =
    d.proba == null
      ? ''
      : `<div class="barre-proba" aria-hidden="true"><span class="barre-proba__modele" style="width:${largeur(d.proba)}"></span>${d.proba_marche != null ? `<span class="barre-proba__marche" style="left:${largeur(d.proba_marche)}"></span>` : ''}</div>`;
  const marche = d.proba_marche == null ? `Marché ${ND}` : `Marché ${esc(proba(d.proba_marche))}${ib(AIDE_MARCHE)}`;
  const coteTxt = d.cote == null ? `cote ${ND}` : `cote ${esc(cote(d.cote))}${d.bookmaker ? ` (${esc(d.bookmaker)})` : ''}`;
  const valueTxt = d.value == null ? '' : ` · value <span class="${classeValue(d.value)}">${esc(valueTexte(d.value))}</span>${ib(EXPLICATIONS.value)}`;
  let suite = '';
  if (d.suggere) {
    suite = `<p class="ligne-buts__pari">${badge('Value', 'value', 'Pari qui passe tous les filtres')} Passe tous les filtres : mise ${esc(pct(d.mise_pct * 100, 1))} de la bankroll${ib(EXPLICATIONS.mise)}
      ${dossier === 'local' ? `<a class="bouton bouton--petit" href="${lienJournal(dossier, m.match_id, d.marche, d.cote)}">Noter ce pari</a>` : ''}</p>`;
  } else if (d.cote != null && d.raison) {
    suite = `<p class="discret">Pas suggéré : ${esc(d.raison.charAt(0).toLowerCase() + d.raison.slice(1))}.${ib(AIDE_FILTRES, 'Quand un pari est-il suggéré ?')}</p>`;
  }
  return `<p class="ligne-buts__titre"><span>${esc(d.libelle)}</span><span class="ligne-buts__proba">${esc(proba(d.proba))}${ib(EXPLICATIONS.proba_total)}</span></p>
    ${barre}
    <p class="ligne-buts__detail">${marche} · ${coteTxt}${valueTxt}</p>
    ${suite}`;
}

function scores(m) {
  return `<div class="scores"><h3 class="sous-titre">Scores les plus probables${ib(EXPLICATIONS.scores_probables)}</h3>
    <p class="pastilles">${m.scores_probables.map((s) => `<span class="score-proba"><strong>${esc(s.score)}</strong> ${esc(proba(s.proba))}</span>`).join('')}</p></div>`;
}

export function blocLigneButs(m, match, dossier) {
  const titre = '<h2 class="section__titre" id="t-ligne">Choisis ta ligne de buts</h2>';
  if (!m?.calculable) {
    return `<section class="carte ligne-buts" aria-labelledby="t-ligne">${titre}<p class="nd-bloc">Probabilités du modèle : ${ND}${m ? '' : ' (calculs non publiés pour ce match)'}.</p></section>`;
  }
  const { k, sens } = ligneInitiale(m);
  return `<section class="carte ligne-buts" aria-labelledby="t-ligne">
    ${titre}
    <div class="seg" role="group" aria-label="Ligne de buts">${LIGNES.map((i) => `<button type="button" data-k="${i}" aria-pressed="${i === k}">${i},5</button>`).join('')}</div>
    <div class="seg seg--sens" role="group" aria-label="Plus ou moins de buts">
      <button type="button" data-sens="plus" aria-pressed="${sens === 'plus'}">Plus de</button>
      <button type="button" data-sens="moins" aria-pressed="${sens === 'moins'}">Moins de</button>
    </div>
    <div class="ligne-buts__resultat" aria-live="polite">${resultatLigne(m, match, dossier, k, sens)}</div>
    ${scores(m)}
  </section>`;
}

export function activerLigneButs(racine, m, match, dossier) {
  const bloc = racine.querySelector('.ligne-buts');
  if (!bloc || !m?.calculable) return;
  let { k, sens } = ligneInitiale(m);
  bloc.addEventListener('click', (e) => {
    const b = e.target.closest('.seg button');
    if (!b) return;
    if (b.dataset.k != null) k = Number(b.dataset.k);
    if (b.dataset.sens) sens = b.dataset.sens;
    for (const x of bloc.querySelectorAll('[data-k]')) x.setAttribute('aria-pressed', String(Number(x.dataset.k) === k));
    for (const x of bloc.querySelectorAll('[data-sens]')) x.setAttribute('aria-pressed', String(x.dataset.sens === sens));
    bloc.querySelector('.ligne-buts__resultat').innerHTML = resultatLigne(m, match, dossier, k, sens);
  });
}

// --- Onglet « Paris » -------------------------------------------------------------------------
function tableMiTemps(m) {
  if (!m.mi_temps) return `<p class="nd-bloc">1re mi-temps : ${ND} (part des buts en 1re MT inconnue).</p>`;
  const lignes = m.marches.filter((x) => x.groupe === 'mi_temps');
  return `<p class="section__sous">Part des buts avant la pause : ${esc(proba(m.mi_temps.part_buts_mt))}${ib(EXPLICATIONS.part_mt)} (source : ${esc(m.mi_temps.source)}).</p>
    ${tableau({
      legende: '1re mi-temps',
      colonnes: [
        { cle: 'libelle', titre: 'Marché', type: 'texte', triable: false },
        { cle: 'proba', titre: 'Proba', type: 'nombre', triable: false, rendu: (x) => celluleProba(x), aide: ib(EXPLICATIONS.proba_mt) },
      ],
      lignes,
    })}`;
}

function tableButeurs(m) {
  if (!m.buteurs.length) return `<p class="nd-bloc">Buteurs : ${ND}</p>`;
  const parNom = new Map(m.marches.filter((x) => x.groupe === 'buteur').map((x) => [x.marche.slice('buteur:'.length), x]));
  const nomEquipe = (c) => (c === 'D' ? 'Dom.' : 'Ext.');
  return tableau({
    legende: 'Buteurs : probabilité de marquer',
    tri: { cle: 'proba', sens: 'desc' },
    colonnes: [
      { cle: 'nom', titre: 'Joueur', type: 'texte', rendu: (b) => `${esc(b.nom)}<span class="cellule-sous">${nomEquipe(b.equipe)}${b.statut !== 'calculé' ? ` · ${esc(b.statut)}` : ''}</span>` },
      { cle: 'proba', titre: 'Marquer', type: 'nombre', rendu: (b) => celluleProba(b.proba == null ? { proba: null, cote: null } : parNom.get(b.nom)), aide: ib(EXPLICATIONS.proba_buteur) },
    ],
    lignes: m.buteurs,
  });
}

function methode(m) {
  const me = m.methode;
  const eq = (x, nom) => `<li>${esc(nom)} : ${esc(x.n_matchs)} match(s) d’historique, forces ${x.facteur_shrinkage < 1 ? `ramenées vers la moyenne (× ${esc(nombre(x.facteur_shrinkage, 2))}, moins de ${esc(m.reglages.seuil_shrinkage ?? 8)} matchs)` : 'non réduites'} · attaque ${esc(nombre(x.attaque, 3))} · défense ${esc(nombre(x.defense, 3))}</li>`;
  const ajust = m.ajustements.liste
    .map((a) => `<tr><td>${esc(a.type)}</td><td class="num">${a.statut === 'appliqué' ? esc(valueTexte(a.effet)) : '—'}</td><td>${esc(a.statut)}<span class="cellule-sous">${esc(a.raison)}</span></td></tr>`)
    .join('');
  return `<details class="methode">
    <summary>Comment c’est calculé</summary>
    <ul class="liste">
      <li>Historique : ${esc(me.historique.matchs_ligue)} matchs de la ligue + ${esc(me.historique.matchs_forme)} tirés de la forme des équipes (${esc(me.historique.matchs_utilises)} utilisés, joués avant le ${esc(me.date_reference)}), pondérés par une demi-vie de ${esc(m.reglages.demi_vie_jours)} jours.</li>
      <li>Moyenne de la ligue : ${esc(nombre(me.moyenne_buts_equipe, 2))} but(s) par équipe et par match · avantage du terrain × ${esc(nombre(me.avantage_domicile, 2))} · correction des scores faibles ρ = ${esc(nombre(me.rho, 3))}.</li>
      ${eq(me.domicile, 'Domicile')}
      ${eq(me.exterieur, 'Extérieur')}
      <li>Buts attendus avant ajustements : ${esc(nombre(m.buts_attendus.domicile_avant_ajustements, 2))} – ${esc(nombre(m.buts_attendus.exterieur_avant_ajustements, 2))} ; ajustements retenus : domicile ${esc(valueTexte(m.ajustements.total.D))}, extérieur ${esc(valueTexte(m.ajustements.total.E))} (plafond ±10 %).${ib(AIDE_AJUSTEMENTS)}</li>
    </ul>
    <div class="table-cadre"><table class="table">
      <caption class="sr-only">Ajustements</caption>
      <thead><tr><th scope="col">Ajustement</th><th scope="col" class="num">Effet${ib(AIDE_AJUSTEMENTS)}</th><th scope="col">Statut${ib('appliqué : la donnée est connue et déclenche l’ajustement · aucun : donnée connue, pas d’effet · N/D : donnée absente, rien n’est ajusté · non évalué : texte libre non chiffré. Les pourcentages entre parenthèses sont les paramètres de la règle.')}</th></tr></thead>
      <tbody>${ajust}</tbody>
    </table></div>
    <p class="discret">Réglages : seuil de value ${esc(pct(m.reglages.seuil_value * 100, 0))}, Kelly × ${esc(nombre(m.reglages.fraction_kelly, 2))}, mise max ${esc(pct(m.reglages.mise_max * 100, 0))}, confiance min ${esc(m.reglages.confiance_min)}.${ib(`${EXPLICATIONS.value} ${EXPLICATIONS.mise}`)} Calculé le ${esc(m.calcule_le.slice(0, 16).replace('T', ' '))} UTC.</p>
  </details>`;
}

/** Contenu de l'onglet « Paris ». cotesHtml : toutes les cotes relevées (données du match). */
export function panneauParis(m, match, cotesHtml) {
  const cotes = `<details class="volet-detail"><summary>Toutes les cotes relevées</summary>${cotesHtml}</details>`;
  if (!m?.calculable) return `<p class="nd-bloc">Probabilités du modèle : ${ND}.</p>${cotes}`;
  return `${blocOverUnder(m, match)}
    <h3 class="sous-titre">1re mi-temps</h3>
    ${tableMiTemps(m)}
    <h3 class="sous-titre">Buteurs</h3>
    ${tableButeurs(m)}
    ${blocJauge(m)}
    ${cotes}
    ${methode(m)}`;
}
