// Courbes de calibration (Chart.js chargé à la demande) : probabilité annoncée → fréquence observée.
import { Chart, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js';
import { enregistrer } from './registre.js';

Chart.register(Legend, LinearScale, LineController, LineElement, PointElement, Tooltip);

const pctFr = (v) => `${Math.round(v * 100)} %`;

/** series : [{ nom, couleur, tranches: [{ p_moy, frequence, n }] }] ; tranches de moins de minN matchs ignorées. */
export function dessinerCalibration(canvas, series, minN = 1) {
  return enregistrer(
    new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          { label: 'Calibration parfaite', data: [{ x: 0, y: 0 }, { x: 1, y: 1 }], borderColor: '#B9C3D9', borderWidth: 1, borderDash: [4, 4], pointRadius: 0, pointHitRadius: 0 },
          ...series.map((s) => ({
            label: s.nom,
            data: s.tranches.filter((t) => t.n >= minN && t.n > 0).map((t) => ({ x: t.p_moy, y: t.frequence, n: t.n })),
            borderColor: s.couleur,
            backgroundColor: s.couleur,
            borderWidth: 2,
            pointRadius: 4,
            tension: 0,
          })),
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 300 },
        scales: {
          x: { type: 'linear', min: 0, max: 1, title: { display: true, text: 'Probabilité annoncée', color: '#B9C3D9' }, ticks: { color: '#B9C3D9', callback: pctFr, stepSize: 0.2, maxRotation: 0 }, grid: { color: 'rgba(244, 241, 232, 0.12)' } },
          y: { min: 0, max: 1, title: { display: true, text: 'Fréquence observée', color: '#B9C3D9' }, ticks: { color: '#B9C3D9', callback: pctFr, stepSize: 0.2 }, grid: { color: 'rgba(244, 241, 232, 0.12)' }, border: { display: false } },
        },
        plugins: {
          legend: { labels: { color: '#F4F1E8', usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8 } },
          tooltip: {
            filter: (item) => item.datasetIndex > 0,
            backgroundColor: '#061433',
            borderColor: '#FFD500',
            borderWidth: 1,
            callbacks: { label: (item) => `${item.dataset.label} : annoncé ${pctFr(item.raw.x)}, observé ${pctFr(item.raw.y)} (${item.raw.n} matchs)` },
          },
        },
      },
    }),
  );
}
