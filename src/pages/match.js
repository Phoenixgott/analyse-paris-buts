// Fiche match — phase 1 : uniquement les données du JSON, aucun calcul de modèle.
import { ND, cote, dateCourte, dateLongue, entier, esc, heure, mouvement, nombre, pct, resultat, texte } from '../format.js';
import { chargerMatch, chargerModele } from '../donnees/chargement.js';
import { sectionModele } from './section-modele.js';
import { badgeCategorie, badgeDemo, badgeNonFiable, badgePalier, pastilleResultat } from '../composants/badge.js';
import { kpiDuel, kpiSimple } from '../composants/carte-kpi.js';
import { tableau } from '../composants/tableau-triable.js';
import { ib } from '../composants/info-bulle.js';
import { EXPLICATIONS } from '../explications.js';
import { SEUIL_FIABLE, estFiable } from '../../schema/qualite.js';
import { bandeauDemo } from './accueil.js';

const SECTIONS = [
  ['resume', 'Résumé'],
  ['modele', 'Modèle'],
  ['forme', 'Forme'],
  ['stats', 'Stats'],
  ['h2h', 'Face-à-face'],
  ['effectifs', 'Effectifs'],
  ['buteurs', 'Buteurs'],
  ['cotes', 'Cotes'],
  ['infos', 'Infos'],
];

function section(id, titre, contenu, sous = '') {
  return `<section class="carte section" id="s-${id}" aria-labelledby="t-${id}">
    <h2 class="section__titre" id="t-${id}">${esc(titre)}</h2>
    ${sous ? `<p class="section__sous">${sous}</p>` : ''}
    ${contenu}
  </section>`;
}

function rangTexte(c) {
  if (!c || c.rang === null) return 'Classement N/D';
  return `${c.rang}${c.rang === 1 ? 'er' : 'e'} · ${entier(c.points)} pts`;
}

function tete(m) {
  const { domicile: d, exterieur: e } = m.equipes;
  const lieu = m.stade ? [m.stade.nom, m.stade.ville].filter(Boolean).join(', ') || ND : ND;
  return `<section class="carte fiche-tete">
    <div class="badges">${m.demo ? badgeDemo() : ''}${badgeCategorie(m.competition.categorie)}${badgePalier(m.competition.palier)}${estFiable(m.qualite_donnees) ? '' : badgeNonFiable()}</div>
    <p class="fiche-tete__compet">${esc(m.competition.nom)} · ${esc(texte(m.competition.pays))}</p>
    <div class="affiche">
      <div class="affiche__equipe"><span class="affiche__nom">${esc(d.nom)}</span><span class="affiche__rang">${esc(rangTexte(d.classement))}</span></div>
      <div class="affiche__centre"><span class="affiche__heure">${esc(heure(m.coup_envoi))}</span><span class="affiche__date">${esc(dateLongue(m.coup_envoi))}</span></div>
      <div class="affiche__equipe affiche__equipe--ext"><span class="affiche__nom">${esc(e.nom)}</span><span class="affiche__rang">${esc(rangTexte(e.classement))}</span></div>
    </div>
    <dl class="fiche-tete__infos">
      <div><dt>Stade</dt><dd>${esc(lieu)}</dd></div>
      <div><dt>Enjeu</dt><dd>${esc(texte(m.enjeu))}</dd></div>
    </dl>
  </section>`;
}

function stat(e, cle) {
  return e.stats ? e.stats[cle] : null;
}

function resume(m) {
  const { domicile: d, exterieur: e } = m.equipes;
  const noms = { nomDom: d.nom, nomExt: e.nom };
  const fiable = estFiable(m.qualite_donnees);
  const cartes = [
    kpiSimple({
      titre: 'Qualité des données',
      valeurHtml: `<span class="qualite qualite--${fiable ? (m.qualite_donnees < 70 ? 'moyenne' : 'bonne') : 'faible'}"><span class="qualite__val">${esc(m.qualite_donnees)}</span><span class="qualite__sur">/100</span></span>`,
      sous: fiable ? 'Données exploitables' : `Sous ${SEUIL_FIABLE} : non fiable`,
      aide: EXPLICATIONS.qualite_donnees,
    }),
    kpiDuel({ titre: 'Buts marqués / match', dom: nombre(stat(d, 'buts_marques_moy')), ext: nombre(stat(e, 'buts_marques_moy')), aide: EXPLICATIONS.buts_marques_moy, ...noms }),
    kpiDuel({ titre: 'Buts encaissés / match', dom: nombre(stat(d, 'buts_encaisses_moy')), ext: nombre(stat(e, 'buts_encaisses_moy')), aide: EXPLICATIONS.buts_encaisses_moy, ...noms }),
    kpiDuel({ titre: 'Matchs à +2,5 buts', dom: pct(stat(d, 'pct_over25')), ext: pct(stat(e, 'pct_over25')), aide: EXPLICATIONS.pct_over25, ...noms }),
    kpiDuel({ titre: 'Buts 1re MT / match', dom: nombre(stat(d, 'buts_mt_marques_moy')), ext: nombre(stat(e, 'buts_mt_marques_moy')), aide: EXPLICATIONS.buts_mt_marques_moy, ...noms }),
    kpiDuel({ titre: 'But avant la 30e', dom: pct(stat(d, 'pct_but_avant_30')), ext: pct(stat(e, 'pct_but_avant_30')), aide: EXPLICATIONS.pct_but_avant_30, ...noms }),
    kpiDuel({ titre: 'xG / match', dom: nombre(stat(d, 'xg_moy')), ext: nombre(stat(e, 'xg_moy')), aide: EXPLICATIONS.xg_moy, ...noms }),
    kpiDuel({ titre: 'Tirs cadrés / match', dom: nombre(stat(d, 'tirs_cadres_moy'), 1), ext: nombre(stat(e, 'tirs_cadres_moy'), 1), aide: EXPLICATIONS.tirs_cadres_moy, ...noms }),
    kpiDuel({ titre: 'Jours de repos', dom: entier(d.jours_repos), ext: entier(e.jours_repos), aide: EXPLICATIONS.jours_repos, ...noms }),
    kpiDuel({ titre: 'Elo', dom: entier(d.elo), ext: entier(e.elo), aide: EXPLICATIONS.elo, ...noms }),
  ];
  const aVenir = `<div class="a-venir"><p>Graphiques (forme, Over/Under, buts par tranche de 15 min, radar, jauge) et prompt d'analyse IA : phase 3.</p></div>`;
  return section('resume', 'Résumé', `<div class="grille-kpi">${cartes.join('')}</div>${aVenir}`);
}

function tableForme(eq) {
  const forme = eq.forme;
  if (!forme) return `<p class="nd-bloc">Forme : ${ND}</p>`;
  const pastilles = forme.map((f) => pastilleResultat(resultat(f.score))).join('');
  return `<div class="bloc-equipe">
    <h3 class="bloc-equipe__titre">${esc(eq.nom)}</h3>
    <p class="pastilles" aria-label="Résultats, du plus récent au plus ancien">${pastilles || ND}</p>
    ${tableau({
      legende: `Forme de ${eq.nom}`,
      tri: { cle: 'date', sens: 'desc' },
      colonnes: [
        { cle: 'date', titre: 'Date', type: 'texte', rendu: (f) => esc(dateCourte(f.date)) },
        { cle: 'adversaire', titre: 'Adversaire', type: 'texte', rendu: (f) => `${esc(texte(f.adversaire))} <span class="lieu">(${esc(f.lieu ?? '?')})</span>` },
        { cle: 'score', titre: 'Score', type: 'texte', triable: false, classe: 'score', rendu: (f) => esc(texte(f.score)) },
        { cle: 'score_mt', titre: 'MT', type: 'texte', triable: false, classe: 'score', rendu: (f) => esc(texte(f.score_mt)) },
        { cle: 'res', titre: 'Rés.', type: 'texte', valeur: (f) => resultat(f.score), rendu: (f) => pastilleResultat(resultat(f.score)) },
      ],
      lignes: forme,
      vide: 'Aucun match récent fourni (N/D)',
    })}
  </div>`;
}

function forme(m) {
  const { domicile: d, exterieur: e } = m.equipes;
  return section(
    'forme',
    'Forme (10 derniers matchs)',
    `<div class="duo">${tableForme(d)}${tableForme(e)}</div>`,
    'Score du point de vue de l’équipe (pour - contre). (D) domicile, (E) extérieur.',
  );
}

function stats(m) {
  const { domicile: d, exterieur: e } = m.equipes;
  const c = (eq, cle) => (eq.classement ? eq.classement[cle] : null);
  const lignes = [
    ['Rang', entier(c(d, 'rang')), entier(c(e, 'rang'))],
    ['Points', entier(c(d, 'points')), entier(c(e, 'points'))],
    ['Matchs joués', entier(c(d, 'joues')), entier(c(e, 'joues'))],
    ['Buts pour / contre', `${entier(c(d, 'bp'))} / ${entier(c(d, 'bc'))}`, `${entier(c(e, 'bp'))} / ${entier(c(e, 'bc'))}`],
    ['Buts marqués / match', nombre(stat(d, 'buts_marques_moy')), nombre(stat(e, 'buts_marques_moy')), 'buts_marques_moy'],
    ['Buts encaissés / match', nombre(stat(d, 'buts_encaisses_moy')), nombre(stat(e, 'buts_encaisses_moy')), 'buts_encaisses_moy'],
    ['Buts 1re MT marqués', nombre(stat(d, 'buts_mt_marques_moy')), nombre(stat(e, 'buts_mt_marques_moy')), 'buts_mt_marques_moy'],
    ['Buts 1re MT encaissés', nombre(stat(d, 'buts_mt_encaisses_moy')), nombre(stat(e, 'buts_mt_encaisses_moy')), 'buts_mt_encaisses_moy'],
    ['xG / match', nombre(stat(d, 'xg_moy')), nombre(stat(e, 'xg_moy')), 'xg_moy'],
    ['Tirs cadrés / match', nombre(stat(d, 'tirs_cadres_moy'), 1), nombre(stat(e, 'tirs_cadres_moy'), 1), 'tirs_cadres_moy'],
    ['Matchs à +1,5 but', pct(stat(d, 'pct_over15')), pct(stat(e, 'pct_over15')), 'pct_over15'],
    ['Matchs à +2,5 buts', pct(stat(d, 'pct_over25')), pct(stat(e, 'pct_over25')), 'pct_over25'],
    ['Matchs à +3,5 buts', pct(stat(d, 'pct_over35')), pct(stat(e, 'pct_over35')), 'pct_over35'],
    ['But avant la 30e', pct(stat(d, 'pct_but_avant_30')), pct(stat(e, 'pct_but_avant_30')), 'pct_but_avant_30'],
  ];
  const corps = lignes
    .map(([lib, vd, ve, cle]) => `<tr><th scope="row">${esc(lib)}${cle ? ib(EXPLICATIONS[cle]) : ''}</th><td class="num">${esc(vd)}</td><td class="num">${esc(ve)}</td></tr>`)
    .join('');
  return section(
    'stats',
    'Statistiques comparées',
    `<div class="table-cadre"><table class="table table--stats">
      <caption class="sr-only">Statistiques de la saison</caption>
      <thead><tr><th scope="col">Saison</th><th scope="col" class="num">${esc(d.nom)}</th><th scope="col" class="num">${esc(e.nom)}</th></tr></thead>
      <tbody>${corps}</tbody>
    </table></div>`,
  );
}

function h2h(m) {
  const { domicile: d, exterieur: e } = m.equipes;
  const contenu = m.h2h
    ? tableau({
        legende: 'Confrontations directes',
        tri: { cle: 'date', sens: 'desc' },
        colonnes: [
          { cle: 'date', titre: 'Date', type: 'texte', rendu: (x) => esc(dateCourte(x.date)) },
          { cle: 'score', titre: 'Score', type: 'texte', triable: false, classe: 'score', rendu: (x) => esc(texte(x.score)) },
          { cle: 'score_mt', titre: 'MT', type: 'texte', triable: false, classe: 'score', rendu: (x) => esc(texte(x.score_mt)) },
          {
            cle: 'total',
            titre: 'Buts',
            type: 'nombre',
            valeur: (x) => (x.score ? x.score.split('-').map(Number).reduce((a, b) => a + b) : null),
            rendu: (x) => esc(x.score ? x.score.split('-').map(Number).reduce((a, b) => a + b) : ND),
          },
        ],
        lignes: m.h2h,
        vide: 'Aucune confrontation fournie par la source',
      })
    : `<p class="nd-bloc">Confrontations directes : ${ND}</p>`;
  return section('h2h', 'Face-à-face', contenu, `Score du point de vue ${esc(d.nom)} - ${esc(e.nom)}, quel que soit le terrain.`);
}

function listeAbsents(eq) {
  if (eq.absents === null) return `<p class="nd-bloc">Absents : ${ND}</p>`;
  if (eq.absents.length === 0) return '<p>Aucun absent signalé par la source.</p>';
  return `<ul class="liste">${eq.absents.map((a) => `<li>${esc(a.nom)} <span class="discret">— ${esc(texte(a.raison))}</span></li>`).join('')}</ul>`;
}

function effectifs(m) {
  const bloc = (eq) => `<div class="bloc-equipe">
    <h3 class="bloc-equipe__titre">${esc(eq.nom)}</h3>
    <h4 class="sous-titre">Absents</h4>
    ${listeAbsents(eq)}
    <h4 class="sous-titre">Composition probable</h4>
    ${eq.compo_probable?.length ? `<p class="compo">${eq.compo_probable.map(esc).join(', ')}</p>` : `<p class="nd-bloc">${ND} (souvent connue 1 h avant le match)</p>`}
  </div>`;
  return section('effectifs', 'Effectifs', `<div class="duo">${bloc(m.equipes.domicile)}${bloc(m.equipes.exterieur)}</div>`);
}

function buteurs(m) {
  if (!m.buteurs) return section('buteurs', 'Buteurs potentiels', `<p class="nd-bloc">Buteurs : ${ND}</p>`);
  const nomEq = (c) => (c === 'D' ? m.equipes.domicile.nom : m.equipes.exterieur.nom);
  const roles = (b) => [b.tireur_penalty === true ? 'Pén.' : null, b.coups_de_pied_arretes === true ? 'CPA' : null].filter(Boolean).join(' · ');
  return section(
    'buteurs',
    'Buteurs potentiels',
    tableau({
      legende: 'Buteurs potentiels',
      tri: { cle: 'buts_par_90', sens: 'desc' },
      colonnes: [
        { cle: 'nom', titre: 'Joueur', type: 'texte', rendu: (b) => `${esc(b.nom)}<span class="cellule-sous">${esc(nomEq(b.equipe))}${roles(b) ? ` · ${esc(roles(b))}` : ''}</span>` },
        { cle: 'buts_par_90', titre: 'Buts/90', type: 'nombre', rendu: (b) => esc(nombre(b.buts_par_90)) },
        { cle: 'tirs_par_90', titre: 'Tirs/90', type: 'nombre', rendu: (b) => esc(nombre(b.tirs_par_90, 1)) },
        { cle: 'minutes_prevues', titre: 'Min.', type: 'nombre', rendu: (b) => esc(entier(b.minutes_prevues)) },
      ],
      lignes: m.buteurs,
    }),
    'Pén. = tireur de penalty · CPA = tire les coups de pied arrêtés. Min. = minutes prévues.',
  );
}

function celluleCote(c) {
  if (!c || c.meilleure === null) return `<span class="cote cote--nd">${ND}</span>`;
  return `<span class="cote">${esc(cote(c.meilleure))}</span><span class="cellule-sous">${esc(texte(c.bookmaker))} · ouv. ${esc(cote(c.ouverture))}</span><span class="cellule-sous mouvement">${esc(mouvement(c.mouvement))}</span>`;
}

function cotes(m) {
  if (!m.cotes) return section('cotes', 'Cotes', `<p class="nd-bloc">Cotes : ${ND}</p>`);
  const tb = m.cotes.total_buts;
  const lignesTotal = [0, 1, 2, 3, 4, 5].map((k) => ({ ligne: k + 0.5, over: tb?.[`over_${k}_5`] ?? null, under: tb?.[`under_${k}_5`] ?? null }));
  const aideMvt = ib(EXPLICATIONS.mouvement, 'Que signifie le mouvement de cote ?');
  const total = tb
    ? tableau({
        legende: 'Cotes du total de buts',
        tri: { cle: 'ligne', sens: 'asc' },
        colonnes: [
          { cle: 'ligne', titre: 'Buts', type: 'nombre', rendu: (l) => esc(nombre(l.ligne, 1)) },
          { cle: 'over', titre: 'Plus de', type: 'nombre', valeur: (l) => l.over?.meilleure ?? null, rendu: (l) => celluleCote(l.over) },
          { cle: 'under', titre: 'Moins de', type: 'nombre', valeur: (l) => l.under?.meilleure ?? null, rendu: (l) => celluleCote(l.under), aide: aideMvt },
        ],
        lignes: lignesTotal,
      })
    : `<p class="nd-bloc">Total de buts : ${ND}</p>`;

  const mt = `<h3 class="sous-titre">1re mi-temps</h3>
    <div class="table-cadre"><table class="table">
      <thead><tr><th scope="col">Marché</th><th scope="col" class="num">Cote</th></tr></thead>
      <tbody>
        <tr><th scope="row">Plus de 0,5 but en 1re MT</th><td class="num">${celluleCote(m.cotes.mt_over_0_5)}</td></tr>
        <tr><th scope="row">Plus de 1,5 but en 1re MT</th><td class="num">${celluleCote(m.cotes.mt_over_1_5)}</td></tr>
      </tbody>
    </table></div>`;

  const nomEq = (c) => (c === 'D' ? m.equipes.domicile.nom : c === 'E' ? m.equipes.exterieur.nom : ND);
  const buteur = `<h3 class="sous-titre">Buteur (à tout moment)</h3>${
    m.cotes.buteur
      ? tableau({
          legende: 'Cotes buteur',
          tri: { cle: 'cote', sens: 'asc' },
          colonnes: [
            { cle: 'nom', titre: 'Joueur', type: 'texte', rendu: (b) => `${esc(b.nom)}<span class="cellule-sous">${esc(nomEq(b.equipe))}</span>` },
            { cle: 'cote', titre: 'Cote', type: 'nombre', valeur: (b) => b.cote?.meilleure ?? null, rendu: (b) => celluleCote(b.cote) },
          ],
          lignes: m.cotes.buteur,
        })
      : `<p class="nd-bloc">Cotes buteur : ${ND}</p>`
  }`;

  return section('cotes', 'Cotes', `${total}${mt}${buteur}`, 'Meilleure cote relevée, bookmaker, cote d’ouverture (première relevée) et mouvement.');
}

function infos(m) {
  const a = m.arbitre;
  const me = m.meteo;
  const genere = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(new Date(m.generated_at));
  return section(
    'infos',
    'Arbitre, météo et sources',
    `<dl class="grille-infos">
      <div><dt>Arbitre</dt><dd>${esc(texte(a?.nom))}</dd></div>
      <div><dt>Cartons / match</dt><dd>${esc(nombre(a?.cartons_moy ?? null, 1))}</dd></div>
      <div><dt>Penaltys / match</dt><dd>${esc(nombre(a?.penaltys_moy ?? null, 2))}</dd></div>
      <div><dt>Température</dt><dd>${me?.temperature != null ? `${esc(nombre(me.temperature, 0))} °C` : ND}</dd></div>
      <div><dt>Vent</dt><dd>${me?.vent != null ? `${esc(nombre(me.vent, 0))} km/h` : ND}</dd></div>
      <div><dt>Pluie</dt><dd>${me?.pluie != null ? `${esc(nombre(me.pluie, 1))} mm/h` : ND}</dd></div>
    </dl>
    <h3 class="sous-titre">Sources</h3>
    <ul class="liste">${m.sources.map((s) => `<li>${esc(s.nom)}</li>`).join('')}</ul>
    <p class="discret">Fiche générée le ${esc(genere)} (heure de Paris) · schéma ${esc(m.schema_version)} · <code>${esc(m.match_id)}</code></p>`,
  );
}

function sommaire() {
  return `<nav class="sommaire" aria-label="Sections de la fiche">${SECTIONS.map(([id, lib]) => `<button type="button" data-cible="s-${id}">${esc(lib)}</button>`).join('')}</nav>`;
}

export async function pageMatch(app, dossier, matchId) {
  const [m, calculs] = await Promise.all([chargerMatch(dossier, matchId), chargerModele(dossier, matchId)]);
  const { domicile: d, exterieur: e } = m.equipes;
  document.title = `${d.nom} – ${e.nom} — Analyse Paris Buts`;
  const fiable = estFiable(m.qualite_donnees);

  app.innerHTML = `
    <p class="retour"><a href="#/">← Matchs du jour</a></p>
    <h1 class="sr-only">${esc(d.nom)} contre ${esc(e.nom)}</h1>
    ${m.demo ? bandeauDemo('Match fictif de démonstration : équipes, joueurs, chiffres et cotes sont inventés.') : ''}
    ${tete(m)}
    ${
      fiable
        ? ''
        : `<div class="bandeau-alerte" role="note"><strong>Match non fiable.</strong> Qualité des données ${esc(m.qualite_donnees)}/100 (seuil ${SEUIL_FIABLE}) : aucun pari ne sera suggéré pour ce match.</div>`
    }
    ${sommaire()}
    ${resume(m)}
    ${sectionModele(calculs, m)}
    ${forme(m)}
    ${stats(m)}
    ${h2h(m)}
    ${effectifs(m)}
    ${buteurs(m)}
    ${cotes(m)}
    ${infos(m)}`;

  app.querySelector('.sommaire').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-cible]');
    if (!b) return;
    const cible = document.getElementById(b.dataset.cible);
    cible.scrollIntoView({ behavior: 'smooth', block: 'start' });
    cible.querySelector('h2')?.setAttribute('tabindex', '-1');
    cible.querySelector('h2')?.focus({ preventScroll: true });
  });
}
