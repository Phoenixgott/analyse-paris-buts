// Alertes ntfy.sh envoyées depuis le navigateur (sans clé, sans serveur à nous).
// Le « topic » (nom du canal) est secret : il reste sur l'appareil, jamais dans le dépôt.
export const SERVEUR_NTFY = 'https://ntfy.sh';

export const topicValide = (t) => /^[A-Za-z0-9_-]{12,64}$/.test(String(t ?? ''));

/** Nom de canal difficile à deviner (quiconque connaît le nom peut lire les alertes). */
export function topicAleatoire(alea = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) {
  const car = 'abcdefghijkmnpqrstuvwxyz23456789';
  return `apb-${Array.from({ length: 18 }, () => car[Math.floor(alea() * car.length)]).join('')}`;
}

/** URL d'envoi : titre, étiquettes et priorité en paramètres (requête simple, sans pré-vérification CORS). */
export function urlAlerte(topic, { titre, tags = [], priorite = 3 }) {
  const params = new URLSearchParams({ title: titre, priority: String(priorite) });
  if (tags.length) params.set('tags', tags.join(','));
  return `${SERVEUR_NTFY}/${encodeURIComponent(topic)}?${params}`;
}

export async function envoyerAlerte(topic, message, options, fetchImpl = fetch) {
  if (!topicValide(topic)) throw new Error('nom de canal ntfy invalide (12 à 64 lettres, chiffres, - ou _)');
  const r = await fetchImpl(urlAlerte(topic, options), { method: 'POST', body: message });
  if (!r.ok) throw new Error(`ntfy.sh a répondu ${r.status}`);
  return true;
}

// ---- Messages ----------------------------------------------------------------------------
const pct = (x) => `${(Math.round(x * 1000) / 10).toString().replace('.', ',')} %`;

export function alerteValueBets(picks) {
  const lignes = picks.slice(0, 6).map((p) => `• ${p.libelle_match} (${p.heure}) : ${p.libelle} @${String(p.cote).replace('.', ',')} — value ${pct(p.value)}, confiance ${p.confiance}/100`);
  return {
    titre: `${picks.length} value bet${picks.length > 1 ? 's' : ''} — Analyse Paris Buts`,
    message: `${lignes.join('\n')}${picks.length > 6 ? `\n… et ${picks.length - 6} autre(s)` : ''}\nProbabilités estimées, pas des certitudes. 18+`,
    tags: ['soccer'],
    priorite: 3,
  };
}

export function alerteLimite(messages) {
  return { titre: 'Limite atteinte — Analyse Paris Buts', message: `${messages.join('\n')}\nFais une pause. Aide : joueurs-info-service.fr`, tags: ['warning'], priorite: 4 };
}

const euros = (x) => `${Math.abs(x).toFixed(2).replace('.', ',')} €`;

export function alerteResolution(paris) {
  const lignes = paris.map((p) => `• ${p.libelle_match} — ${p.libelle_marche} : ${p.statut === 'gagne' ? `gagné (+${euros(p.gain)})` : p.statut === 'perdu' ? `perdu (−${euros(p.gain)})` : 'remboursé/annulé'}`);
  return { titre: `${paris.length} pari${paris.length > 1 ? 's' : ''} résolu${paris.length > 1 ? 's' : ''}`, message: lignes.join('\n'), tags: ['white_check_mark'], priorite: 2 };
}
