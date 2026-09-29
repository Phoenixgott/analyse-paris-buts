// Page « Fiabilité du modèle » : (1) tes prédictions archivées contre les résultats réels,
// (2) le backtest sur l'historique réel (football-data.co.uk). Brier, log-loss, calibration.
import { esc, pct, valueTexte } from '../format.js';
import * as local from '../donnees/local.js';
import { chargerBacktest } from '../donnees/chargement.js';
import { MARCHES_FIABILITE, SEUIL_ECHANTILLON, calibration, nombreMatchs, paires, resumeParMarche, brier } from '../../modele/fiabilite.js';
import { ib } from '../composants/info-bulle.js';
import { kpiSimple } from '../composants/carte-kpi.js';

const AIDE_BRIER = 'Brier = moyenne de (probabilité annoncée − résultat)², le résultat valant 1 si l’événement a eu lieu et 0 sinon. 0 = parfait ; 0,25 = répondre « 50 % » à chaque match. Plus c’est bas, mieux c’est.';
const AIDE_LOGLOSS = 'Log-loss = −moyenne de ln(probabilité donnée au résultat réel). Punit fortement les certitudes démenties. 0,693 = répondre « 50 % » à chaque match. Plus c’est bas, mieux c’est.';
const AIDE_CALIBRATION = 'Les matchs sont regroupés par tranche de probabilité annoncée (0-10 %, 10-20 %…). Pour chaque tranche : fréquence à laquelle l’événement a réellement eu lieu. Un modèle bien calibré suit la diagonale : quand il dit 60 %, ça arrive 6 fois sur 10.';
const AIDE_MARCHE = 'Probabilité du marché : tirée des cotes Plus/Moins, marge du bookmaker retirée ((1/cote Plus) ÷ (1/cote Plus + 1/cote Moins)). Comparée sur les mêmes matchs.';
const AIDE_ROI = 'ROI simulé = gain total ÷ nombre de paris, avec une mise fixe de 1 sur chaque pari qui passe les règles de value du site (value ≥ 5 %, ≤ 30 %, probabilité ≥ 20 %), à la meilleure cote relevée par football-data.co.uk.';

const n4 = (x) => (x == null ? 'N/D' : x.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }));
const classeCompare = (modele, marche) => (modele == null || marche == null ? '' : modele <= marche ? 'value--pos' : 'value--neg');

function tableCalibration(tranches, libelle) {
  return `<table class="table table--compacte"><caption class="sr-only">${esc(libelle)}</caption>
    <thead><tr><th scope="col">Tranche${ib(AIDE_CALIBRATION)}</th><th scope="col" class="num">Matchs</th><th scope="col" class="num">Annoncé${ib(AIDE_CALIBRATION)}</th><th scope="col" class="num">Observé${ib(AIDE_CALIBRATION)}</th></tr></thead>
    <tbody>${tranches.filter((t) => t.n > 0).map((t) => `<tr><th scope="row">${Math.round(t.de * 100)}-${Math.round(t.a * 100)} %</th><td class="num">${t.n}</td><td class="num">${esc(pct(t.p_moy * 100, 0))}</td><td class="num">${esc(pct(t.frequence * 100, 0))}</td></tr>`).join('')}</tbody></table>`;
}

function sectionLocale(liste) {
  const nMatchs = nombreMatchs(liste);
  const resume = resumeParMarche(liste).filter((r) => r.n > 0);
  const insuffisant = nMatchs < SEUIL_ECHANTILLON;
  const lignes = resume
    .map((r) => `<tr><th scope="row">${esc(r.libelle)}</th><td class="num">${r.n}</td><td class="num">${n4(r.brier)}</td><td class="num">${n4(r.log_loss)}</td>
      <td class="num">${r.n_marche ? `<span class="${classeCompare(r.brier_modele_vs, r.brier_marche)}">${n4(r.brier_modele_vs)}</span> / ${n4(r.brier_marche)}<span class="cellule-sous">${r.n_marche} match(s) avec cotes</span>` : 'N/D'}</td></tr>`)
    .join('');
  return `<section class="carte section" aria-labelledby="t-local">
    <h2 class="section__titre" id="t-local">Tes prédictions</h2>
    <p class="section__sous">Chaque probabilité calculée <strong>avant le coup d’envoi</strong> est archivée sur ton appareil, puis comparée au score réel dès que tu importes les résultats (Récupérer les matchs, étape 4).</p>
    ${insuffisant ? `<div class="bandeau-alerte" role="note"><strong>Échantillon insuffisant.</strong> ${nMatchs} match(s) évalué(s) sur les ${SEUIL_ECHANTILLON} nécessaires : ces chiffres varient encore beaucoup, n’en tire aucune conclusion.</div>` : ''}
    ${
      liste.length
        ? `<div class="table-cadre${insuffisant ? ' attenue' : ''}"><table class="table table--compacte">
            <caption class="sr-only">Fiabilité de tes prédictions par marché</caption>
            <thead><tr><th scope="col">Marché</th><th scope="col" class="num">Matchs</th><th scope="col" class="num">Brier${ib(AIDE_BRIER)}</th><th scope="col" class="num">Log-loss${ib(AIDE_LOGLOSS)}</th><th scope="col" class="num">Modèle / marché${ib(`${AIDE_BRIER} ${AIDE_MARCHE}`)}</th></tr></thead>
            <tbody>${lignes}</tbody></table></div>
           <figure class="graphique${insuffisant ? ' attenue' : ''}"><figcaption class="graphique__titre">Calibration — Plus de 2,5 buts${ib(AIDE_CALIBRATION)}</figcaption>
             <div class="graphique__zone" style="height:260px"><canvas id="g-calib-local" role="img" aria-label="Courbe de calibration de tes prédictions Plus de 2,5 buts"></canvas></div>
             <details class="graphique__donnees"><summary>Voir les données</summary><div class="table-cadre">${tableCalibration(calibration(liste.filter((x) => x.marche === 'over_2_5'), 10), 'Calibration de tes prédictions')}</div></details>
           </figure>`
        : '<p class="nd-bloc">Aucune prédiction évaluée pour l’instant : importe des fiches avant les matchs, puis leurs résultats après.</p>'
    }
  </section>`;
}

function sectionBacktest(bt) {
  if (!bt) return '<section class="carte"><p class="nd-bloc">Backtest indisponible (fichier non publié ou hors ligne).</p></section>';
  const actuelle = bt.configurations.find((c) => c.actuelle);
  const meilleure = bt.configurations.find((c) => c.demi_vie === bt.meilleure.demi_vie && c.prior === bt.meilleure.prior);
  const plusPrecisQueMarche = actuelle.marche.brier_modele <= actuelle.marche.brier_marche;
  const constat = `Sur <strong>${actuelle.n.toLocaleString('fr-FR')} matchs réels</strong> (${bt.par_ligue.length} championnats), avec les réglages actuels du site
    (demi-vie ${actuelle.demi_vie} j), le modèle obtient un Brier de <strong>${n4(actuelle.marche.brier_modele)}</strong> sur Plus/Moins 2,5, contre
    <strong>${n4(actuelle.marche.brier_marche)}</strong> pour le marché : il est <strong>${plusPrecisQueMarche ? 'plus' : 'moins'} précis que les bookmakers</strong>.
    Les paris « value » selon les règles du site, sur cette ligne, auraient donné <strong>${actuelle.value.paris.toLocaleString('fr-FR')} paris</strong> pour un ROI de
    <strong class="${actuelle.value.roi >= 0 ? 'value--pos' : 'value--neg'}">${esc(valueTexte(actuelle.value.roi))}</strong>${ib(AIDE_ROI)}.`;
  const cahier = bt.configurations.find((c) => c.demi_vie === 60 && c.prior === 1 && !c.actuelle);
  const reglagesTexte = meilleure && !meilleure.actuelle
    ? `Les réglages les plus justes testés (demi-vie ${meilleure.demi_vie} j, prior ${meilleure.prior}) rendent les probabilités plus fiables (Brier 2,5 : ${n4(meilleure.marche.brier_modele)}), ${meilleure.marche.brier_modele <= meilleure.marche.brier_marche ? 'au niveau du marché' : 'sans atteindre le marché'} ; ROI simulé des values : ${valueTexte(meilleure.value.roi)}.`
    : cahier
      ? `Ce sont les réglages les plus justes testés (prior ${actuelle.prior}). Ceux du cahier des charges (60 j, prior 1) donnaient des probabilités plus tranchées et moins justes (Brier 2,5 : ${n4(cahier.marche.brier_modele)}) ; ROI simulé des values : ${valueTexte(cahier.value.roi)}.`
      : '';
  const lignes = bt.configurations
    .map((c) => `<tr${c.actuelle ? ' class="ligne-actuelle"' : ''}><th scope="row">${c.demi_vie} j · prior ${c.prior}${c.actuelle ? '<span class="cellule-sous">réglages actuels</span>' : ''}${c === meilleure ? '<span class="cellule-sous">les plus justes</span>' : ''}</th>
      <td class="num">${n4(c.brier_moyen_1_5_a_3_5)}</td><td class="num"><span class="${classeCompare(c.marche.brier_modele, c.marche.brier_marche)}">${n4(c.marche.brier_modele)}</span></td>
      <td class="num">${n4(c.log_loss.over_2_5)}</td><td class="num"><span class="${c.value.roi >= 0 ? 'value--pos' : 'value--neg'}">${esc(valueTexte(c.value.roi))}</span><span class="cellule-sous">${c.value.paris} paris</span></td></tr>`)
    .join('');
  const ligues = [...bt.par_ligue]
    .sort((a, b) => (a.marche.brier_modele ?? 1) - (b.marche.brier_modele ?? 1))
    .map((l) => `<tr><th scope="row">${esc(l.nom)}</th><td class="num">${l.n}</td><td class="num"><span class="${classeCompare(l.marche.brier_modele, l.marche.brier_marche)}">${n4(l.marche.brier_modele)}</span></td><td class="num">${n4(l.marche.brier_marche)}</td><td class="num"><span class="${l.value.roi >= 0 ? 'value--pos' : 'value--neg'}">${esc(valueTexte(l.value.roi))}</span></td></tr>`)
    .join('');
  return `<section class="carte section" aria-labelledby="t-backtest">
    <h2 class="section__titre" id="t-backtest">Backtest sur l’historique réel</h2>
    <p class="section__sous">${esc(bt.methode)} Source : ${esc(bt.source)}. Mis à jour le ${esc(bt.genere_le.slice(0, 10))}.</p>
    <div class="constat" role="note"><p>${constat}</p>${reglagesTexte ? `<p>${esc(reglagesTexte)}${ib(`${AIDE_BRIER} ${AIDE_ROI}`)}</p>` : ''}
      <p class="discret">En clair : quand le site signale une « value », c’est le plus souvent le modèle qui se trompe, pas le bookmaker. Probabilités estimées, pas des certitudes.</p></div>
    <div class="grille-kpi grille-kpi--4">
      ${kpiSimple({ titre: 'Matchs évalués', valeurHtml: esc(actuelle.n.toLocaleString('fr-FR')), sous: `${bt.par_ligue.length} championnats`, aide: 'Matchs de la saison précédente et de la saison en cours, prédits semaine après semaine avec les seuls matchs déjà joués.' })}
      ${kpiSimple({ titre: 'Brier 2,5 modèle', valeurHtml: `<span class="${classeCompare(actuelle.marche.brier_modele, actuelle.marche.brier_marche)}">${esc(n4(actuelle.marche.brier_modele))}</span>`, sous: 'réglages actuels', aide: AIDE_BRIER })}
      ${kpiSimple({ titre: 'Brier 2,5 marché', valeurHtml: esc(n4(actuelle.marche.brier_marche)), sous: `${actuelle.marche.n.toLocaleString('fr-FR')} matchs avec cotes`, aide: `${AIDE_BRIER} ${AIDE_MARCHE}` })}
      ${kpiSimple({ titre: 'ROI des values', valeurHtml: `<span class="${actuelle.value.roi >= 0 ? 'value--pos' : 'value--neg'}">${esc(valueTexte(actuelle.value.roi))}</span>`, sous: `${actuelle.value.paris} paris simulés`, aide: AIDE_ROI })}
    </div>
    <figure class="graphique"><figcaption class="graphique__titre">Calibration — Plus de 2,5 buts${ib(`${AIDE_CALIBRATION} Tranches d’au moins 20 matchs seulement.`)}</figcaption>
      <div class="graphique__zone" style="height:280px"><canvas id="g-calib-backtest" role="img" aria-label="Courbes de calibration du backtest, réglages actuels et plus justes"></canvas></div>
      <details class="graphique__donnees"><summary>Voir les données (réglages actuels)</summary><div class="table-cadre">${tableCalibration(bt.calibration.actuelle.over_2_5, 'Calibration du backtest')}</div></details>
    </figure>
    <details class="volet-detail">
      <summary>Voir le détail : réglages comparés, par championnat</summary>
      <h3 class="sous-titre">Réglages comparés</h3>
      <div class="table-cadre"><table class="table table--compacte"><caption class="sr-only">Comparaison des réglages du modèle</caption>
        <thead><tr><th scope="col">Réglages</th><th scope="col" class="num">Brier 1,5-3,5${ib(`${AIDE_BRIER} Moyenne des lignes Plus de 1,5, 2,5 et 3,5 buts.`)}</th><th scope="col" class="num">Brier 2,5${ib(AIDE_BRIER)}</th><th scope="col" class="num">Log-loss 2,5${ib(AIDE_LOGLOSS)}</th><th scope="col" class="num">ROI values${ib(AIDE_ROI)}</th></tr></thead>
        <tbody>${lignes}</tbody></table></div>
      <p class="aide">Demi-vie : ancienneté à laquelle un match pèse deux fois moins. Prior : nombre de « matchs moyens » ajoutés à chaque équipe pour éviter des forces trop tranchées.</p>
      <h3 class="sous-titre">Par championnat (réglages actuels)</h3>
      <div class="table-cadre"><table class="table table--compacte"><caption class="sr-only">Backtest par championnat</caption>
        <thead><tr><th scope="col">Championnat</th><th scope="col" class="num">Matchs</th><th scope="col" class="num">Brier modèle${ib(AIDE_BRIER)}</th><th scope="col" class="num">Brier marché${ib(AIDE_MARCHE)}</th><th scope="col" class="num">ROI${ib(AIDE_ROI)}</th></tr></thead>
        <tbody>${ligues}</tbody></table></div>
      ${bt.indisponibles?.length ? `<p class="discret">Non évalués : ${esc(bt.indisponibles.join(', '))}.</p>` : ''}
    </details>
  </section>`;
}

export async function pageFiabilite(app) {
  document.title = 'Fiabilité du modèle — Analyse Paris Buts';
  const [predictions, resultats, backtest] = await Promise.all([local.lister('predictions'), local.lister('resultats'), chargerBacktest()]);
  const liste = paires(predictions, new Map(resultats.map((r) => [r.match_id, r])));

  app.innerHTML = `
    <header class="page-tete"><h1 class="page-titre">Fiabilité du modèle</h1>
      <p class="page-sous">Les probabilités annoncées se vérifient-elles ? Mesures honnêtes, y compris quand elles ne sont pas flatteuses.</p></header>
    ${sectionLocale(liste)}
    ${sectionBacktest(backtest)}
    <p class="discret">${MARCHES_FIABILITE.length} marchés suivis : Plus de 0,5 à 5,5 buts et 1re mi-temps. ${liste.length ? `Brier moyen de tes prédictions, tous marchés : ${n4(brier(liste))}.` : ''}</p>`;

  const page = location.hash;
  import('../graphiques/fiabilite.js').then(({ dessinerCalibration }) => {
    if (location.hash !== page) return;
    const cLocal = app.querySelector('#g-calib-local');
    if (cLocal) dessinerCalibration(cLocal, [{ nom: 'Tes prédictions', couleur: '#FFD500', tranches: calibration(liste.filter((x) => x.marche === 'over_2_5'), 10) }]);
    const cBt = app.querySelector('#g-calib-backtest');
    if (cBt && backtest) {
      const series = [{ nom: `Réglages actuels (${backtest.actuelle.demi_vie} j, prior ${backtest.actuelle.prior})`, couleur: '#FFD500', tranches: backtest.calibration.actuelle.over_2_5 }];
      if (backtest.meilleure.demi_vie !== backtest.actuelle.demi_vie || backtest.meilleure.prior !== backtest.actuelle.prior) {
        series.push({ nom: `Plus justes (${backtest.meilleure.demi_vie} j, prior ${backtest.meilleure.prior})`, couleur: '#5AB0FF', tranches: backtest.calibration.meilleure.over_2_5 });
      }
      dessinerCalibration(cBt, series, 20);
    }
  });
}
