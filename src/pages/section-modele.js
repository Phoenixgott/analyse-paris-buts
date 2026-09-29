// Fiche match — section « Modèle » (phase 2) : probabilités, value, mises, confiance et verdict,
// tous issus de modeles/<match_id>.json. Graphiques et prompt IA : phase 3.
import { ND, cote, esc, nombre, pct, proba, valueTexte } from '../format.js';
import { blocJauge, blocOverUnder } from './blocs-graphiques.js';
import { badge } from '../composants/badge.js';
import { kpiDuel, kpiSimple } from '../composants/carte-kpi.js';
import { tableau } from '../composants/tableau-triable.js';
import { ib } from '../composants/info-bulle.js';
import { EXPLICATIONS } from '../explications.js';

const AIDE_AJUSTEMENTS =
  'Chaque ajustement modifie les buts attendus de l’équipe concernée d’un pourcentage fixe (repos ≤ 3 jours −3 %, derby −2 %, arbitre à penaltys ±1-2 %, pluie −3 %, vent fort −4 %, −1,5 % par absent, max −6 %). La somme est plafonnée à ±10 % par équipe. Une donnée absente n’ajuste rien.';

const classeValue = (v) => (v == null ? '' : v > 0 ? 'value--pos' : v < 0 ? 'value--neg' : '');

function celluleProba(marche) {
  if (!marche) return `<span class="cote--nd">${ND}</span>`;
  const etoile = marche.suggere ? badge('Value', 'value', 'Pari qui passe tous les filtres') : '';
  const detail = marche.cote == null ? 'cote N/D' : `cote ${cote(marche.cote)} · <span class="${classeValue(marche.value)}">${esc(valueTexte(marche.value))}</span>`;
  return `<span class="proba">${esc(proba(marche.proba))}</span>${etoile}<span class="cellule-sous">${detail}</span>`;
}

function lienJournal(dossier, matchId, marche = null, cote = null) {
  const q = new URLSearchParams({ dossier, match: matchId });
  if (marche) q.set('marche', marche);
  if (cote) q.set('cote', String(cote));
  return `#/journal?${q}`;
}

function verdict(m, dossier) {
  const v = m.verdict;
  const local = dossier === 'local';
  const autre = local ? `<p class="verdict__actions"><a href="${lienJournal(dossier, m.match_id)}">Noter un autre pari sur ce match</a></p>` : '';
  if (v.decision === 'PARIER') {
    return `<div class="verdict verdict--parier" role="note">
      <p class="verdict__titre"><span class="verdict__decision">PARIER</span> ${esc(v.libelle)}</p>
      <p class="verdict__detail">Probabilité ${esc(proba(v.proba))} · cote ${esc(cote(v.cote))} (minimum ${esc(cote(v.cote_min))}${ib(EXPLICATIONS.cote_min)}) ·
        value <span class="value--pos">${esc(valueTexte(v.value))}</span>${ib(EXPLICATIONS.value)} · mise ${esc(pct(v.mise_pct * 100, 1))} de la bankroll${ib(EXPLICATIONS.mise)}</p>
      <p class="verdict__avert">Probabilités estimées, pas des certitudes. Lis aussi les arguments contre ce pari avant de jouer.</p>
      ${local ? `<p class="verdict__actions"><a class="bouton bouton--petit" href="${lienJournal(dossier, m.match_id, v.marche, v.cote)}">Noter ce pari dans le journal</a></p>` : m.demo ? '<p class="discret">Match fictif (DÉMO) : il ne peut pas être noté dans le journal.</p>' : ''}
    </div>`;
  }
  return `<div class="verdict verdict--passer" role="note">
    <p class="verdict__titre"><span class="verdict__decision">PASSER</span></p>
    <p class="verdict__detail">${esc(v.raison)}</p>
    <p class="verdict__avert">Passer est un résultat normal et fréquent : aucun pari n’est préférable à un mauvais pari.</p>
    ${autre}
  </div>`;
}

function tableTotal(m) {
  const parMarche = new Map(m.marches.map((x) => [x.marche, x]));
  const lignes = [0, 1, 2, 3, 4, 5].map((k) => ({ ligne: k + 0.5, over: parMarche.get(`over_${k}_5`), under: parMarche.get(`under_${k}_5`) }));
  return tableau({
    legende: 'Total de buts : probabilités du modèle, cotes et value',
    tri: { cle: 'ligne', sens: 'asc' },
    colonnes: [
      { cle: 'ligne', titre: 'Buts', type: 'nombre', rendu: (l) => esc(nombre(l.ligne, 1)) },
      { cle: 'over', titre: 'Plus de', type: 'nombre', valeur: (l) => l.over?.proba ?? null, rendu: (l) => celluleProba(l.over), aide: ib(EXPLICATIONS.proba_total) },
      { cle: 'under', titre: 'Moins de', type: 'nombre', valeur: (l) => l.under?.proba ?? null, rendu: (l) => celluleProba(l.under), aide: ib(EXPLICATIONS.value, 'Comment la value est-elle calculée ?') },
    ],
    lignes,
  });
}

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

export function sectionModele(m, match, dossier = null) {
  if (!m) {
    return `<section class="carte section" id="s-modele" aria-labelledby="t-modele"><h2 class="section__titre" id="t-modele">Modèle</h2><p class="nd-bloc">Calculs du modèle non publiés pour ce match (${ND}).</p></section>`;
  }
  if (!m.calculable) {
    return `<section class="carte section" id="s-modele" aria-labelledby="t-modele"><h2 class="section__titre" id="t-modele">Modèle</h2>${verdict(m, dossier)}</section>`;
  }
  const { domicile: d, exterieur: e } = match.equipes;
  const kpis = [
    kpiDuel({ titre: 'Buts attendus', dom: nombre(m.buts_attendus.domicile), ext: nombre(m.buts_attendus.exterieur), aide: EXPLICATIONS.buts_attendus, nomDom: d.nom, nomExt: e.nom }),
    kpiSimple({ titre: 'Total attendu', valeurHtml: esc(nombre(m.buts_attendus.total)), sous: 'buts dans le match', aide: EXPLICATIONS.buts_attendus }),
    kpiSimple({ titre: 'Plus de 2,5 buts', valeurHtml: esc(proba(m.total_buts.over_2_5)), sous: `Moins de 2,5 : ${proba(m.total_buts.under_2_5)}`, aide: EXPLICATIONS.proba_total }),
  ];
  const scores = `<div class="scores"><h3 class="sous-titre">Scores les plus probables${ib(EXPLICATIONS.scores_probables)}</h3>
    <p class="pastilles">${m.scores_probables.map((s) => `<span class="score-proba"><strong>${esc(s.score)}</strong> ${esc(proba(s.proba))}</span>`).join('')}</p></div>`;

  return `<section class="carte section" id="s-modele" aria-labelledby="t-modele">
    <h2 class="section__titre" id="t-modele">Modèle : probabilités estimées</h2>
    <p class="section__sous">Dixon-Coles, calculé à partir des données de la fiche. Probabilités estimées, pas des certitudes.</p>
    ${verdict(m, dossier)}
    <div class="grille-kpi grille-kpi--3">${kpis.join('')}</div>
    <div class="grille-graphiques">${blocOverUnder(m, match)}${blocJauge(m)}</div>
    <h3 class="sous-titre">Total de buts</h3>
    ${tableTotal(m)}
    <h3 class="sous-titre">1re mi-temps</h3>
    ${tableMiTemps(m)}
    <h3 class="sous-titre">Buteurs</h3>
    ${tableButeurs(m)}
    ${scores}
    ${methode(m)}
  </section>`;
}
