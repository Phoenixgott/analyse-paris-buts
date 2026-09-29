// Fiche match (phase 7, simplifiée) : en haut l'essentiel (verdict + 3 chiffres), puis la ligne de buts
// à choisir, puis les détails rangés en onglets (Paris, Forme, Stats, Infos, Prompt IA).
import { ND, CATEGORIES, cote, dateCourte, dateLongue, entier, esc, heure, mouvement, nombre, pct, resultat, texte } from '../format.js';
import { chargerBacktest, chargerMatch, chargerModele } from '../donnees/chargement.js';
import { activerLigneButs, blocLigneButs, chiffresCles, panneauParis, verdict } from './section-modele.js';
import { activerPrompt, sectionPrompt } from './section-prompt.js';
import { blocForme, blocRadar, blocTranches } from './blocs-graphiques.js';
import { badgeDemo, badgeNonFiable, pastilleResultat } from '../composants/badge.js';
import { tableau } from '../composants/tableau-triable.js';
import { ib } from '../composants/info-bulle.js';
import { activerOnglets, blocOnglets } from '../composants/onglets.js';
import { EXPLICATIONS } from '../explications.js';
import { SEUIL_FIABLE, estFiable } from '../../schema/qualite.js';
import { bandeauDemo } from './accueil.js';

function rangTexte(c) {
  if (!c || c.rang === null) return 'classement N/D';
  return `${c.rang}${c.rang === 1 ? 'er' : 'e'} · ${entier(c.points)} pts`;
}

function tete(m, calculs, dossier, backtest) {
  const { domicile: d, exterieur: e } = m.equipes;
  const fiable = estFiable(m.qualite_donnees);
  return `<section class="carte resume-match">
    <div class="resume-match__haut">
      <p class="resume-match__compet">${esc(m.competition.nom)} · ${esc(texte(m.competition.pays))}</p>
      <span class="badges">${m.demo ? badgeDemo() : ''}${fiable ? '' : badgeNonFiable()}</span>
    </div>
    <div class="resume-match__affiche">
      <div class="resume-match__equipes">
        <p class="resume-match__equipe"><span class="resume-match__nom">${esc(d.nom)}</span><span class="resume-match__rang">${esc(rangTexte(d.classement))}</span></p>
        <p class="resume-match__equipe"><span class="resume-match__nom">${esc(e.nom)}</span><span class="resume-match__rang">${esc(rangTexte(e.classement))}</span></p>
      </div>
      <p class="resume-match__quand"><span class="resume-match__heure">${esc(heure(m.coup_envoi))}</span><span class="resume-match__date">${esc(dateLongue(m.coup_envoi))}</span></p>
    </div>
    ${
      calculs
        ? verdict(calculs, dossier, backtest)
        : `<p class="nd-bloc">Calculs du modèle non publiés pour ce match (${ND}).${fiable ? '' : ` Match non fiable : qualité des données ${esc(m.qualite_donnees)}/100 (seuil ${SEUIL_FIABLE}), aucun pari.`}</p>`
    }
    ${chiffresCles(calculs, m)}
  </section>`;
}

const stat = (e, cle) => (e.stats ? e.stats[cle] : null);

// --- Forme et face-à-face ---
function tableForme(eq) {
  if (!eq.forme) return `<p class="nd-bloc">Forme de ${esc(eq.nom)} : ${ND}</p>`;
  return `<div class="bloc-equipe">
    <h4 class="bloc-equipe__titre">${esc(eq.nom)}</h4>
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
      lignes: eq.forme,
      vide: 'Aucun match récent fourni (N/D)',
    })}
  </div>`;
}

function panneauForme(m) {
  const { domicile: d, exterieur: e } = m.equipes;
  const ligne = (eq) => `<p class="forme-ligne"><span class="forme-ligne__nom">${esc(eq.nom)}</span><span class="pastilles" aria-label="Résultats de ${esc(eq.nom)}, du plus récent au plus ancien">${eq.forme?.length ? eq.forme.map((f) => pastilleResultat(resultat(f.score))).join('') : ND}</span></p>`;
  const h2h = m.h2h
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
  return `<div class="carte">
    <h2 class="sr-only">Forme</h2>
    <p class="discret">Du plus récent au plus ancien, du point de vue de l’équipe.</p>
    ${ligne(d)}${ligne(e)}
    ${blocForme(m)}
    <details class="volet-detail"><summary>Les 10 derniers matchs en détail</summary>
      <p class="discret">Score pour - contre. (D) domicile, (E) extérieur.</p>
      <div class="duo">${tableForme(d)}${tableForme(e)}</div>
    </details>
    <h3 class="sous-titre">Face-à-face</h3>
    <p class="discret">Score du point de vue ${esc(d.nom)} - ${esc(e.nom)}, quel que soit le terrain.</p>
    ${h2h}
  </div>`;
}

// --- Statistiques ---
function panneauStats(m, calculs) {
  const { domicile: d, exterieur: e } = m.equipes;
  const c = (eq, cle) => (eq.classement ? eq.classement[cle] : null);
  const lignes = [
    ['Classement', rangTexte(d.classement), rangTexte(e.classement)],
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
    ['Jours de repos', entier(d.jours_repos), entier(e.jours_repos), 'jours_repos'],
    ['Elo', entier(d.elo), entier(e.elo), 'elo'],
  ];
  const corps = lignes
    .map(([lib, vd, ve, cle]) => `<tr><th scope="row">${esc(lib)}${cle ? ib(EXPLICATIONS[cle]) : ''}</th><td class="num">${esc(vd)}</td><td class="num">${esc(ve)}</td></tr>`)
    .join('');
  return `<div class="carte">
    <h2 class="sr-only">Statistiques</h2>
    <div class="table-cadre"><table class="table table--stats">
      <caption class="sr-only">Statistiques de la saison</caption>
      <thead><tr><th scope="col">Saison</th><th scope="col" class="num">${esc(d.nom)}</th><th scope="col" class="num">${esc(e.nom)}</th></tr></thead>
      <tbody>${corps}</tbody>
    </table></div>
    <div class="grille-graphiques">${blocTranches(m)}${blocRadar(m, calculs)}</div>
    <h3 class="sous-titre">Buteurs potentiels</h3>
    ${buteurs(m)}
  </div>`;
}

function buteurs(m) {
  if (!m.buteurs) return `<p class="nd-bloc">Buteurs : ${ND}</p>`;
  const nomEq = (c) => (c === 'D' ? m.equipes.domicile.nom : m.equipes.exterieur.nom);
  const roles = (b) => [b.tireur_penalty === true ? 'Pén.' : null, b.coups_de_pied_arretes === true ? 'CPA' : null].filter(Boolean).join(' · ');
  return `${tableau({
    legende: 'Buteurs potentiels',
    tri: { cle: 'buts_par_90', sens: 'desc' },
    colonnes: [
      { cle: 'nom', titre: 'Joueur', type: 'texte', rendu: (b) => `${esc(b.nom)}<span class="cellule-sous">${esc(nomEq(b.equipe))}${roles(b) ? ` · ${esc(roles(b))}` : ''}</span>` },
      { cle: 'buts_par_90', titre: 'Buts/90', type: 'nombre', rendu: (b) => esc(nombre(b.buts_par_90)) },
      { cle: 'tirs_par_90', titre: 'Tirs/90', type: 'nombre', rendu: (b) => esc(nombre(b.tirs_par_90, 1)) },
      { cle: 'minutes_prevues', titre: 'Min.', type: 'nombre', rendu: (b) => esc(entier(b.minutes_prevues)) },
    ],
    lignes: m.buteurs,
  })}<p class="discret">Pén. = tireur de penalty · CPA = coups de pied arrêtés · Min. = minutes prévues.</p>`;
}

// --- Cotes relevées (rangées dans l'onglet Paris) ---
function celluleCote(c) {
  if (!c || c.meilleure === null) return `<span class="cote cote--nd">${ND}</span>`;
  return `<span class="cote">${esc(cote(c.meilleure))}</span><span class="cellule-sous">${esc(texte(c.bookmaker))} · ouv. ${esc(cote(c.ouverture))}</span><span class="cellule-sous mouvement">${esc(mouvement(c.mouvement))}</span>`;
}

function cotes(m) {
  if (!m.cotes) return `<p class="nd-bloc">Cotes : ${ND}</p>`;
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
  const nomEq = (c) => (c === 'D' ? m.equipes.domicile.nom : c === 'E' ? m.equipes.exterieur.nom : ND);
  return `<p class="discret">Meilleure cote, bookmaker, cote d’ouverture (première relevée) et mouvement.</p>
    ${total}
    <div class="table-cadre"><table class="table">
      <thead><tr><th scope="col">1re mi-temps</th><th scope="col" class="num">Cote</th></tr></thead>
      <tbody>
        <tr><th scope="row">Plus de 0,5 but</th><td class="num">${celluleCote(m.cotes.mt_over_0_5)}</td></tr>
        <tr><th scope="row">Plus de 1,5 but</th><td class="num">${celluleCote(m.cotes.mt_over_1_5)}</td></tr>
      </tbody>
    </table></div>
    ${
      m.cotes.buteur
        ? tableau({
            legende: 'Cotes buteur',
            tri: { cle: 'cote', sens: 'asc' },
            colonnes: [
              { cle: 'nom', titre: 'Buteur', type: 'texte', rendu: (b) => `${esc(b.nom)}<span class="cellule-sous">${esc(nomEq(b.equipe))}</span>` },
              { cle: 'cote', titre: 'Cote', type: 'nombre', valeur: (b) => b.cote?.meilleure ?? null, rendu: (b) => celluleCote(b.cote) },
            ],
            lignes: m.cotes.buteur,
          })
        : `<p class="nd-bloc">Cotes buteur : ${ND}</p>`
    }`;
}

// --- Infos : effectifs, arbitre, météo, sources ---
function listeAbsents(eq) {
  if (eq.absents === null) return `<p class="nd-bloc">Absents : ${ND}</p>`;
  if (eq.absents.length === 0) return '<p>Aucun absent signalé par la source.</p>';
  return `<ul class="liste">${eq.absents.map((a) => `<li>${esc(a.nom)} <span class="discret">— ${esc(texte(a.raison))}</span></li>`).join('')}</ul>`;
}

function panneauInfos(m) {
  const a = m.arbitre;
  const me = m.meteo;
  const lieu = m.stade ? [m.stade.nom, m.stade.ville].filter(Boolean).join(', ') || ND : ND;
  const genere = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(new Date(m.generated_at));
  const effectif = (eq) => `<div class="bloc-equipe">
    <h4 class="bloc-equipe__titre">${esc(eq.nom)}</h4>
    ${listeAbsents(eq)}
    <p class="discret">Composition probable : ${eq.compo_probable?.length ? esc(eq.compo_probable.join(', ')) : `${ND} (souvent connue 1 h avant le match)`}</p>
  </div>`;
  return `<div class="carte">
    <h2 class="sr-only">Infos</h2>
    <h3 class="sous-titre">Absents et compositions</h3>
    <div class="duo">${effectif(m.equipes.domicile)}${effectif(m.equipes.exterieur)}</div>
    <h3 class="sous-titre">Le match</h3>
    <dl class="grille-infos">
      <div><dt>Stade</dt><dd>${esc(lieu)}</dd></div>
      <div><dt>Enjeu</dt><dd>${esc(texte(m.enjeu))}</dd></div>
      <div><dt>Arbitre</dt><dd>${esc(texte(a?.nom))}</dd></div>
      <div><dt>Cartons / match</dt><dd>${esc(nombre(a?.cartons_moy ?? null, 1))}</dd></div>
      <div><dt>Penaltys / match</dt><dd>${esc(nombre(a?.penaltys_moy ?? null, 2))}</dd></div>
      <div><dt>Température</dt><dd>${me?.temperature != null ? `${esc(nombre(me.temperature, 0))} °C` : ND}</dd></div>
      <div><dt>Vent</dt><dd>${me?.vent != null ? `${esc(nombre(me.vent, 0))} km/h` : ND}</dd></div>
      <div><dt>Pluie</dt><dd>${me?.pluie != null ? `${esc(nombre(me.pluie, 1))} mm/h` : ND}</dd></div>
      <div><dt>Catégorie</dt><dd>${esc(CATEGORIES[m.competition.categorie] ?? m.competition.categorie)} · palier ${esc(m.competition.palier)}</dd></div>
    </dl>
    <h3 class="sous-titre">Sources</h3>
    <ul class="liste">${m.sources.map((s) => `<li>${esc(s.nom)}</li>`).join('')}</ul>
    <p class="discret">Fiche générée le ${esc(genere)} (heure de Paris) · schéma ${esc(m.schema_version)} · <code>${esc(m.match_id)}</code></p>
  </div>`;
}

export async function pageMatch(app, dossier, matchId) {
  const [m, calculs, backtest] = await Promise.all([chargerMatch(dossier, matchId), chargerModele(dossier, matchId), chargerBacktest()]);
  const { domicile: d, exterieur: e } = m.equipes;
  document.title = `${d.nom} – ${e.nom} — Analyse Paris Buts`;

  const onglets = [
    { id: 'paris', titre: 'Paris', contenu: `<div class="carte"><h2 class="sr-only">Paris</h2>${panneauParis(calculs, m, cotes(m))}</div>` },
    { id: 'forme', titre: 'Forme', contenu: panneauForme(m) },
    { id: 'stats', titre: 'Stats', contenu: panneauStats(m, calculs) },
    { id: 'infos', titre: 'Infos', contenu: panneauInfos(m) },
    { id: 'prompt', titre: 'Prompt IA', contenu: sectionPrompt(m, calculs) },
  ];

  app.innerHTML = `
    <p class="retour"><a href="#/">← Matchs du jour</a></p>
    <h1 class="sr-only">${esc(d.nom)} contre ${esc(e.nom)}</h1>
    ${m.demo ? bandeauDemo('Match fictif de démonstration : équipes, joueurs, chiffres et cotes sont inventés.') : ''}
    ${tete(m, calculs, dossier, backtest)}
    ${blocLigneButs(calculs, m, dossier)}
    ${blocOnglets('Détails du match', onglets, 'apb.ongletFiche')}`;

  activerPrompt(app, m, calculs);
  activerLigneButs(app, calculs, m, dossier);

  // Chart.js n'est chargé que sur la fiche ; les graphiques d'un onglet se dessinent à son affichage.
  // Si la page a changé entre-temps, on ne dessine rien.
  const page = location.hash;
  let dessiner = () => {};
  activerOnglets(app, (panneau) => dessiner(panneau));
  import('../graphiques/fiche.js')
    .then(({ dessinerGraphiques }) => {
      if (location.hash !== page) return;
      dessiner = (racine) => dessinerGraphiques(racine, m, calculs);
      dessiner(app);
    })
    .catch((erreur) => console.error('Graphiques indisponibles', erreur));
}
