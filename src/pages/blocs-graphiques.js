// Blocs HTML des graphiques : titre + info-bulle, zone de dessin (remplie par graphiques/fiche.js)
// et tableau jumeau « Voir les données » (chaque valeur reste lisible sans le graphique).
// Sans donnée : pas de canvas, un message N/D.
import { ND, dateCourte, esc, nombre, pct } from '../format.js';
import { ib } from '../composants/info-bulle.js';
import { EXPLICATIONS } from '../explications.js';
import { AXES_RADAR, etiquettesForme, jauge, overModeleMarche, radarEquipe, serieForme, tranchesEquipe } from '../graphiques/donnees.js';

function bloc({ id, titre, aide, hauteur = 240, resume, table, vide }) {
  if (vide) {
    return `<figure class="graphique"><figcaption class="graphique__titre">${esc(titre)}${ib(aide)}</figcaption><p class="nd-bloc">${esc(vide)}</p></figure>`;
  }
  return `<figure class="graphique">
    <figcaption class="graphique__titre">${esc(titre)}${ib(aide)}</figcaption>
    <div class="graphique__zone" style="height:${hauteur}px"><canvas id="${id}" role="img" aria-label="${esc(resume)}"></canvas></div>
    <details class="graphique__donnees"><summary>Voir les données</summary><div class="table-cadre">${table}</div></details>
  </figure>`;
}

const tableSimple = (entetes, lignes) =>
  `<table class="table"><thead><tr>${entetes.map((h, i) => `<th scope="col"${i ? ' class="num"' : ''}>${h}</th>`).join('')}</tr></thead>
   <tbody>${lignes.map((l) => `<tr>${l.map((c, i) => (i ? `<td class="num">${c}</td>` : `<th scope="row">${c}</th>`)).join('')}</tr>`).join('')}</tbody></table>`;

export function blocForme(match) {
  const { domicile: d, exterieur: e } = match.equipes;
  if (!d.forme?.length && !e.forme?.length) return bloc({ titre: 'Buts par match (10 derniers)', aide: AIDE_FORME, vide: `Forme des deux équipes : ${ND}` });
  const sd = serieForme(d);
  const se = serieForme(e);
  const cellule = (p) => (p ? `${esc(p.total ?? ND)}<span class="cellule-sous">${esc(p.score ?? ND)} · ${esc(dateCourte(p.date))}</span>` : ND);
  return bloc({
    id: 'g-forme',
    titre: 'Buts par match (10 derniers)',
    aide: AIDE_FORME,
    resume: `Courbe des buts marqués et encaissés par match sur les 10 derniers matchs de ${d.nom} et ${e.nom}, avec un repère à 2,5 buts.`,
    table: tableSimple(['Match', esc(d.nom), esc(e.nom)], etiquettesForme().map((lib, i) => [lib, cellule(sd[i]), cellule(se[i])]).reverse()),
  });
}

const AIDE_FORME =
  'Total de buts (marqués + encaissés) de chaque match des 10 derniers, du plus ancien (M-9) au plus récent. Le trait pointillé marque 2,5 buts : au-dessus, le match aurait gagné un pari « Plus de 2,5 buts ».';

export function blocOverUnder(modele, match) {
  const titre = 'Plus de … buts : modèle contre marché';
  const aide = `${EXPLICATIONS.proba_total} Marché : probabilité implicite des cotes Plus/Moins, marge du bookmaker retirée ((1/cote Plus) ÷ (1/cote Plus + 1/cote Moins)).`;
  if (!modele?.calculable) return bloc({ titre, aide, vide: `Probabilités du modèle : ${ND}` });
  const lignes = overModeleMarche(modele, match);
  return bloc({
    id: 'g-over-under',
    titre,
    aide,
    resume: 'Barres comparant, pour chaque ligne de 0,5 à 5,5 buts, la probabilité du modèle et celle du marché.',
    table: tableSimple(
      ['Ligne', `Modèle${ib(EXPLICATIONS.proba_total)}`, `Marché${ib('Probabilité implicite des cotes, marge du bookmaker retirée.')}`],
      lignes.map((l) => [esc(l.ligne), esc(pct(l.modele, 1)), esc(pct(l.marche, 1))]),
    ),
  });
}

export function blocTranches(match) {
  const { domicile: d, exterieur: e } = match.equipes;
  const td = tranchesEquipe(d);
  const te = tranchesEquipe(e);
  const titre = 'Buts par tranche de 15 minutes';
  if (!td && !te) return bloc({ titre, aide: EXPLICATIONS.buts_par_tranche, vide: `Minutes des buts non fournies par la source (${ND}).` });
  const cellule = (l) => (l ? `${esc(nombre(l.total))}<span class="cellule-sous">${esc(nombre(l.marques))} marqués · ${esc(nombre(l.encaisses))} encaissés</span>` : ND);
  return bloc({
    id: 'g-tranches',
    titre,
    aide: EXPLICATIONS.buts_par_tranche,
    resume: `Barres des buts par match dans chaque tranche de 15 minutes pour ${d.nom} et ${e.nom}.`,
    table: tableSimple(['Minutes', esc(d.nom), esc(e.nom)], (td ?? te).map((l, i) => [esc(l.tranche), cellule(td?.[i]), cellule(te?.[i])])),
  });
}

const AIDE_RADAR =
  'Indices où 100 = moyenne de la ligue (moyenne estimée par le modèle : buts par équipe et par match). Attaque et défense du modèle : exp(force) × 100 (défense : plus haut = encaisse moins). Buts marqués, buts 1re MT et xG : valeur de l’équipe ÷ moyenne de la ligue × 100. Solidité : moyenne ÷ buts encaissés × 100. Une valeur absente reste un trou.';

export function blocRadar(match, modele) {
  const titre = 'Attaque et défense (indice 100 = moyenne)';
  if (!modele?.calculable) return bloc({ titre, aide: AIDE_RADAR, vide: `Forces du modèle : ${ND}` });
  const { domicile: d, exterieur: e } = match.equipes;
  const rd = radarEquipe(d, modele.methode.domicile, modele);
  const re = radarEquipe(e, modele.methode.exterieur, modele);
  return bloc({
    id: 'g-radar',
    titre,
    aide: AIDE_RADAR,
    hauteur: 340,
    resume: `Radar des indices d’attaque et de défense de ${d.nom} et ${e.nom}, 100 étant la moyenne de la ligue.`,
    table: tableSimple(['Indice', esc(d.nom), esc(e.nom)], AXES_RADAR.map((axe, i) => [esc(axe), esc(rd[i] ?? ND), esc(re[i] ?? ND)])),
  });
}

export function blocJauge(modele) {
  const { valeur, seuil } = jauge(modele);
  const titre = 'Indice de confiance';
  if (valeur == null) return bloc({ titre, aide: EXPLICATIONS.confiance, vide: `Indice de confiance : ${ND}` });
  const c = modele.confiance.composantes;
  return `<figure class="graphique graphique--jauge">
    <figcaption class="graphique__titre">${esc(titre)}${ib(EXPLICATIONS.confiance)}</figcaption>
    <div class="graphique__zone jauge" style="height:150px">
      <canvas id="g-jauge" role="img" aria-label="Jauge : confiance ${esc(valeur)} sur 100, seuil ${esc(seuil)}"></canvas>
      <p class="jauge__valeur"><strong>${esc(valeur)}</strong><span>/100</span></p>
    </div>
    <p class="jauge__legende">${valeur < seuil ? `Sous le seuil de ${esc(seuil)} : aucun pari suggéré.` : `Au-dessus du seuil de ${esc(seuil)} (trait blanc).`}</p>
    <details class="graphique__donnees"><summary>Voir les données</summary><div class="table-cadre">${tableSimple(
      ['Composante', 'Valeur'],
      [
        ['Qualité des données', esc(c.qualite ?? ND)],
        ['Échantillon', esc(c.echantillon == null ? ND : Math.round(c.echantillon))],
        ['Accord modèle/marché', esc(c.accord == null ? ND : Math.round(c.accord))],
        ['Indice', esc(valeur)],
      ],
    )}</div></details>
  </figure>`;
}
