// Dessin des graphiques de la fiche match avec Chart.js (chargé à la demande, uniquement sur la fiche).
// Couleurs : jaune = domicile / modèle (courbe principale), bleu ciel = extérieur / marché,
// toujours dans ce rôle d'un graphique à l'autre. Vert/rouge ne sont jamais utilisés ici.
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
  Tooltip,
} from 'chart.js';
import { enregistrer } from './registre.js';
import { AXES_RADAR, AXES_RADAR_COURTS, TRANCHES_15, etiquettesForme, jauge, overModeleMarche, radarEquipe, serieForme, tranchesEquipe } from './donnees.js';
import { dateCourte } from '../format.js';

Chart.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Filler, Legend, LinearScale, LineController, LineElement, PointElement, RadarController, RadialLinearScale, Tooltip);

const C = {
  jaune: '#FFD500',
  bleu: '#5AB0FF',
  texte: '#F4F1E8',
  doux: '#B9C3D9',
  grille: 'rgba(244, 241, 232, 0.12)',
  piste: 'rgba(244, 241, 232, 0.14)',
  fond: '#061433',
  alerte: '#FFB35C',
};

const nf = (v, d = 2) => (v == null ? 'N/D' : v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

Chart.defaults.color = C.doux;
Chart.defaults.borderColor = C.grille;
Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
Chart.defaults.font.size = 12;
Chart.defaults.animation = reduit ? false : { duration: 300 };
Chart.defaults.maintainAspectRatio = false;
Object.assign(Chart.defaults.plugins.legend.labels, {
  usePointStyle: true,
  pointStyle: 'circle',
  boxWidth: 8,
  boxHeight: 8,
  pointStyleWidth: 8,
  padding: 12,
  color: C.texte,
});
Object.assign(Chart.defaults.plugins.tooltip, {
  backgroundColor: C.fond,
  borderColor: C.jaune,
  borderWidth: 1,
  titleColor: C.texte,
  bodyColor: C.texte,
  padding: 10,
  boxPadding: 4,
});

const axeY = (titre, extra = {}) => ({
  beginAtZero: true,
  grid: { color: C.grille },
  border: { display: false },
  title: { display: true, text: titre, color: C.doux },
  ...extra,
});
// Étiquettes horizontales, jamais inclinées ; Chart.js en saute si la place manque.
const axeX = { grid: { display: false }, border: { color: C.grille }, ticks: { maxRotation: 0, autoSkipPadding: 6, font: { size: 11 } } };

function forme(canvas, match) {
  const d = serieForme(match.equipes.domicile);
  const e = serieForme(match.equipes.exterieur);
  const serie = (points, nom, couleur) => ({
    label: nom,
    data: points.map((p) => p?.total ?? null),
    points,
    borderColor: couleur,
    backgroundColor: couleur,
    borderWidth: 2,
    pointRadius: 4,
    pointHoverRadius: 6,
    tension: 0,
  });
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: etiquettesForme(),
      datasets: [
        serie(d, match.equipes.domicile.nom, C.jaune),
        serie(e, match.equipes.exterieur.nom, C.bleu),
        { label: 'Seuil 2,5 buts', data: Array(10).fill(2.5), borderColor: C.doux, borderWidth: 1, borderDash: [4, 4], pointRadius: 0, pointHitRadius: 0 },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: axeX, y: axeY('Buts dans le match', { suggestedMax: 6, ticks: { stepSize: 1 } }) },
      plugins: {
        tooltip: {
          filter: (item) => item.datasetIndex < 2,
          callbacks: {
            label: (item) => {
              const p = item.dataset.points[item.dataIndex];
              if (!p) return `${item.dataset.label} : N/D`;
              return `${item.dataset.label} : ${p.score ?? 'N/D'} contre ${p.adversaire ?? 'N/D'} (${p.lieu ?? '?'}) le ${dateCourte(p.date)} → ${p.total ?? 'N/D'} but(s)`;
            },
          },
        },
      },
    },
  });
}

function overUnder(canvas, match, modele) {
  const lignes = overModeleMarche(modele, match);
  const barre = (cle, nom, couleur) => ({
    label: nom,
    data: lignes.map((l) => l[cle]),
    backgroundColor: couleur,
    borderRadius: 4,
    borderSkipped: 'bottom',
    maxBarThickness: 20,
    categoryPercentage: 0.7,
    barPercentage: 0.85,
  });
  return new Chart(canvas, {
    type: 'bar',
    data: { labels: lignes.map((l) => l.ligne), datasets: [barre('modele', 'Modèle', C.jaune), barre('marche', 'Marché (marge retirée)', C.bleu)] },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { ...axeX, title: { display: true, text: 'Plus de … buts', color: C.doux } }, y: axeY('Probabilité', { max: 100, ticks: { callback: (v) => `${v} %` } }) },
      plugins: { tooltip: { callbacks: { label: (item) => `${item.dataset.label} : ${item.raw == null ? 'N/D' : `${nf(item.raw, 1)} %`}` } } },
    },
  });
}

function tranches(canvas, match) {
  const d = tranchesEquipe(match.equipes.domicile);
  const e = tranchesEquipe(match.equipes.exterieur);
  const barre = (lignes, nom, couleur) => ({
    label: nom,
    data: lignes ? lignes.map((l) => l.total) : Array(6).fill(null),
    lignes,
    backgroundColor: couleur,
    borderRadius: 4,
    borderSkipped: 'bottom',
    maxBarThickness: 20,
    categoryPercentage: 0.7,
    barPercentage: 0.85,
  });
  return new Chart(canvas, {
    type: 'bar',
    data: { labels: TRANCHES_15, datasets: [barre(d, match.equipes.domicile.nom, C.jaune), barre(e, match.equipes.exterieur.nom, C.bleu)] },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { ...axeX, title: { display: true, text: 'Minutes', color: C.doux } }, y: axeY('Buts par match') },
      plugins: {
        tooltip: {
          callbacks: {
            label: (item) => {
              const l = item.dataset.lignes?.[item.dataIndex];
              if (!l) return `${item.dataset.label} : N/D`;
              return `${item.dataset.label} : ${nf(l.total)} (marqués ${nf(l.marques)} · encaissés ${nf(l.encaisses)})`;
            },
          },
        },
      },
    },
  });
}

function radar(canvas, match, modele) {
  const serie = (valeurs, nom, couleur, fond) => ({
    label: nom,
    data: valeurs,
    borderColor: couleur,
    backgroundColor: fond,
    pointBackgroundColor: couleur,
    borderWidth: 2,
    pointRadius: 3,
    fill: true,
  });
  return new Chart(canvas, {
    type: 'radar',
    data: {
      labels: AXES_RADAR_COURTS,
      datasets: [
        serie(radarEquipe(match.equipes.domicile, modele.methode.domicile, modele), match.equipes.domicile.nom, C.jaune, 'rgba(255, 213, 0, 0.12)'),
        serie(radarEquipe(match.equipes.exterieur, modele.methode.exterieur, modele), match.equipes.exterieur.nom, C.bleu, 'rgba(90, 176, 255, 0.12)'),
        { label: 'Moyenne de la ligue (100)', data: Array(6).fill(100), borderColor: C.doux, borderWidth: 1, borderDash: [4, 4], pointRadius: 0, fill: false },
      ],
    },
    options: {
      spanGaps: false,
      scales: {
        r: {
          min: 0,
          suggestedMax: 200,
          ticks: { stepSize: 100, backdropColor: 'transparent', color: C.doux, font: { size: 9 } },
          grid: { color: C.grille },
          angleLines: { color: C.grille },
          pointLabels: { color: C.texte, font: { size: 11 }, padding: 4 },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => AXES_RADAR[items[0].dataIndex],
            label: (item) => `${item.dataset.label} : ${item.raw == null ? 'N/D' : `indice ${item.raw}`}`,
          },
        },
      },
    },
  });
}

// Repère du seuil de confiance sur la jauge (trait fin à l'angle du seuil).
const repereSeuil = {
  id: 'repereSeuil',
  afterDatasetsDraw(chart, _args, opts) {
    const arc = chart.getDatasetMeta(0).data[0];
    if (!arc) return;
    const angle = -Math.PI + (opts.seuil / 100) * Math.PI;
    const { ctx } = chart;
    ctx.save();
    ctx.strokeStyle = C.texte;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(arc.x + Math.cos(angle) * (arc.innerRadius - 4), arc.y + Math.sin(angle) * (arc.innerRadius - 4));
    ctx.lineTo(arc.x + Math.cos(angle) * (arc.outerRadius + 4), arc.y + Math.sin(angle) * (arc.outerRadius + 4));
    ctx.stroke();
    ctx.restore();
  },
};

function jaugeConfiance(canvas, modele) {
  const { valeur, seuil } = jauge(modele);
  return new Chart(canvas, {
    type: 'doughnut',
    data: { datasets: [{ data: [valeur, 100 - valeur], backgroundColor: [valeur < seuil ? C.alerte : C.jaune, C.piste], borderWidth: 0 }] },
    options: {
      rotation: -90,
      circumference: 180,
      cutout: '74%',
      events: [],
      plugins: { legend: { display: false }, tooltip: { enabled: false }, repereSeuil: { seuil } },
    },
    plugins: [repereSeuil],
  });
}

/** Dessine tous les graphiques présents dans la page (les blocs sans donnée n'ont pas de canvas). */
export function dessinerGraphiques(racine, match, modele) {
  const dessins = {
    'g-forme': (c) => forme(c, match),
    'g-over-under': (c) => overUnder(c, match, modele),
    'g-tranches': (c) => tranches(c, match),
    'g-radar': (c) => radar(c, match, modele),
    'g-jauge': (c) => jaugeConfiance(c, modele),
  };
  for (const [id, dessiner] of Object.entries(dessins)) {
    const canvas = racine.querySelector(`#${id}`);
    if (canvas) enregistrer(dessiner(canvas));
  }
}
