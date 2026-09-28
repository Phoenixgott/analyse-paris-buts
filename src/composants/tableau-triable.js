// Tableaux triables : un clic sur l'en-tête trie la colonne (puis inverse le sens).
// Les valeurs absentes (N/D) restent toujours en bas, quel que soit le sens du tri.
import { esc } from '../format.js';

const registre = new Map();
let compteur = 0;

function comparer(a, b, type) {
  const vide = (v) => v === null || v === undefined || v === '';
  if (vide(a) && vide(b)) return 0;
  if (vide(a)) return Infinity;
  if (vide(b)) return -Infinity;
  if (type === 'nombre') return a - b;
  return String(a).localeCompare(String(b), 'fr', { numeric: true });
}

function corps(cfg) {
  const col = cfg.colonnes.find((c) => c.cle === cfg.tri.cle);
  let lignes = cfg.lignes;
  if (col) {
    const valeur = col.valeur ?? ((l) => l[col.cle]);
    lignes = [...lignes].sort((x, y) => {
      const d = comparer(valeur(x), valeur(y), col.type);
      if (!Number.isFinite(d)) return d; // N/D en bas dans les deux sens
      return cfg.tri.sens === 'desc' ? -d : d;
    });
  }
  if (lignes.length === 0) {
    return `<tr><td colspan="${cfg.colonnes.length}" class="table__vide">${esc(cfg.vide ?? 'Aucune donnée (N/D)')}</td></tr>`;
  }
  return lignes
    .map(
      (l) =>
        `<tr>${cfg.colonnes
          .map((c) => `<td class="${c.type === 'nombre' ? 'num' : ''} ${c.classe ?? ''}">${c.rendu ? c.rendu(l) : esc(l[c.cle] ?? 'N/D')}</td>`)
          .join('')}</tr>`,
    )
    .join('');
}

function entete(cfg) {
  return cfg.colonnes
    .map((c) => {
      const actif = cfg.tri.cle === c.cle;
      const aria = actif ? (cfg.tri.sens === 'asc' ? 'ascending' : 'descending') : 'none';
      const fleche = actif ? (cfg.tri.sens === 'asc' ? '▲' : '▼') : '↕';
      const contenu =
        c.triable === false
          ? esc(c.titre)
          : `<button type="button" class="table__tri" data-col="${esc(c.cle)}">${esc(c.titre)}<span class="table__fleche" aria-hidden="true">${fleche}</span></button>`;
      return `<th scope="col" class="${c.type === 'nombre' ? 'num' : ''}" aria-sort="${aria}">${contenu}${c.aide ?? ''}</th>`;
    })
    .join('');
}

/**
 * colonnes : [{ cle, titre, type: 'nombre'|'texte', rendu?(ligne) → HTML, valeur?(ligne) → valeur de tri,
 *              triable?, aide? (HTML d'info-bulle), classe? }]
 */
export function tableau({ colonnes, lignes, tri = { cle: null, sens: 'asc' }, legende, vide }) {
  const id = `t${++compteur}`;
  registre.set(id, { colonnes, lignes, tri: { ...tri }, vide });
  const cfg = registre.get(id);
  return `<div class="table-cadre"><table class="table" data-tableau="${id}">
    ${legende ? `<caption class="sr-only">${esc(legende)}</caption>` : ''}
    <thead><tr>${entete(cfg)}</tr></thead>
    <tbody>${corps(cfg)}</tbody>
  </table></div>`;
}

export function installerTableaux() {
  document.addEventListener('click', (e) => {
    const bouton = e.target.closest('.table__tri');
    if (!bouton) return;
    const table = bouton.closest('table');
    const cfg = registre.get(table.dataset.tableau);
    if (!cfg) return;
    const cle = bouton.dataset.col;
    const col = cfg.colonnes.find((c) => c.cle === cle);
    cfg.tri =
      cfg.tri.cle === cle
        ? { cle, sens: cfg.tri.sens === 'asc' ? 'desc' : 'asc' }
        : { cle, sens: col.type === 'nombre' ? 'desc' : 'asc' };
    table.tHead.rows[0].innerHTML = entete(cfg);
    table.tBodies[0].innerHTML = corps(cfg);
    table.querySelector(`.table__tri[data-col="${CSS.escape(cle)}"]`)?.focus();
  });
}

/** Oublie les tableaux d'une page quittée. */
export function viderTableaux() {
  registre.clear();
}
