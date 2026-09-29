// Courbe de bankroll du journal (Chart.js chargé à la demande).
import { CategoryScale, Chart, Filler, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js';
import { enregistrer } from './registre.js';

Chart.register(CategoryScale, Filler, LinearScale, LineController, LineElement, PointElement, Tooltip);

const euros = (v) => `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export function dessinerBankroll(canvas, courbe) {
  const depart = courbe[0]?.bankroll ?? 0;
  return enregistrer(
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: courbe.map((_, i) => (i === 0 ? 'Départ' : `#${i}`)),
        datasets: [
          { data: courbe.map((c) => c.bankroll), borderColor: '#FFD500', backgroundColor: '#FFD500', borderWidth: 2, pointRadius: 3, tension: 0 },
          { data: courbe.map(() => depart), borderColor: '#B9C3D9', borderWidth: 1, borderDash: [4, 4], pointRadius: 0, pointHitRadius: 0 },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 300 },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#B9C3D9', maxRotation: 0, autoSkipPadding: 8 } },
          y: { grid: { color: 'rgba(244, 241, 232, 0.12)' }, border: { display: false }, ticks: { color: '#B9C3D9', callback: (v) => `${v} €` } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: (item) => item.datasetIndex === 0,
            backgroundColor: '#061433',
            borderColor: '#FFD500',
            borderWidth: 1,
            callbacks: { label: (item) => `${euros(item.raw)} — ${courbe[item.dataIndex].libelle}` },
          },
        },
      },
    }),
  );
}
