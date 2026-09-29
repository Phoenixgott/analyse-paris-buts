// Carte KPI : un indicateur, son info-bulle et une ligne de précision.
import { esc } from '../format.js';
import { ib } from './info-bulle.js';

export function kpiSimple({ titre, valeurHtml, sous = '', aide }) {
  return `<article class="kpi">
    <h3 class="kpi__titre">${esc(titre)}${ib(aide)}</h3>
    <div class="kpi__val kpi__val--seul">${valeurHtml}</div>
    ${sous ? `<p class="kpi__sous">${esc(sous)}</p>` : ''}
  </article>`;
}
