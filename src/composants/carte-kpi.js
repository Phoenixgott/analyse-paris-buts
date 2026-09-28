// Cartes KPI : un indicateur, soit unique, soit comparé domicile / extérieur.
import { esc } from '../format.js';
import { ib } from './info-bulle.js';

export function kpiDuel({ titre, dom, ext, aide, nomDom = 'Dom.', nomExt = 'Ext.' }) {
  return `<article class="kpi">
    <h3 class="kpi__titre">${esc(titre)}${ib(aide)}</h3>
    <div class="kpi__duel">
      <div><span class="kpi__val">${esc(dom)}</span><span class="kpi__camp">${esc(nomDom)}</span></div>
      <div><span class="kpi__val">${esc(ext)}</span><span class="kpi__camp">${esc(nomExt)}</span></div>
    </div>
  </article>`;
}

export function kpiSimple({ titre, valeurHtml, sous = '', aide }) {
  return `<article class="kpi">
    <h3 class="kpi__titre">${esc(titre)}${ib(aide)}</h3>
    <div class="kpi__val kpi__val--seul">${valeurHtml}</div>
    ${sous ? `<p class="kpi__sous">${esc(sous)}</p>` : ''}
  </article>`;
}
