// Stockage local (IndexedDB) des données collectées par prompt : elles restent sur ton appareil.
// Magasins : annonces (liste du jour), matchs (fiches au schéma), modeles (calculs mis en cache).
// Sans IndexedDB (navigation privée stricte…), repli en mémoire : les données sont perdues à la
// fermeture, et la page Récupérer les matchs le signale.
const NOM = 'analyse-paris-buts';
const VERSION = 1;
const CLES = { annonces: 'id', matchs: 'match_id', modeles: 'match_id' };

let base = null;
const memoire = { annonces: new Map(), matchs: new Map(), modeles: new Map() };
let disponible = true;

function ouvrir() {
  return new Promise((ok, ko) => {
    const req = indexedDB.open(NOM, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [magasin, cle] of Object.entries(CLES)) if (!db.objectStoreNames.contains(magasin)) db.createObjectStore(magasin, { keyPath: cle });
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => ko(req.error);
  });
}

async function db() {
  if (!base) {
    base = (typeof indexedDB === 'undefined' ? Promise.reject(new Error('IndexedDB absent')) : ouvrir()).catch((e) => {
      console.warn('Stockage local indisponible, repli en mémoire :', e);
      disponible = false;
      return null;
    });
  }
  return base;
}

const requete = (req) => new Promise((ok, ko) => {
  req.onsuccess = () => ok(req.result);
  req.onerror = () => ko(req.error);
});

export async function stockageDisponible() {
  await db();
  return disponible;
}

export async function lister(magasin) {
  const d = await db();
  if (!d) return [...memoire[magasin].values()];
  return requete(d.transaction(magasin).objectStore(magasin).getAll());
}

export async function lire(magasin, cle) {
  const d = await db();
  if (!d) return memoire[magasin].get(cle) ?? null;
  return (await requete(d.transaction(magasin).objectStore(magasin).get(cle))) ?? null;
}

export async function ecrire(magasin, objets) {
  if (!objets.length) return;
  const d = await db();
  if (!d) {
    for (const o of objets) memoire[magasin].set(o[CLES[magasin]], o);
    return;
  }
  const t = d.transaction(magasin, 'readwrite');
  for (const o of objets) t.objectStore(magasin).put(o);
  await new Promise((ok, ko) => {
    t.oncomplete = ok;
    t.onerror = () => ko(t.error);
  });
  // Demande au navigateur de ne pas effacer ces données en cas de manque de place.
  navigator.storage?.persist?.().catch(() => {});
}

export async function supprimer(magasin, cles) {
  if (!cles.length) return;
  const d = await db();
  if (!d) {
    for (const c of cles) memoire[magasin].delete(c);
    return;
  }
  const t = d.transaction(magasin, 'readwrite');
  for (const c of cles) t.objectStore(magasin).delete(c);
  await new Promise((ok, ko) => {
    t.oncomplete = ok;
    t.onerror = () => ko(t.error);
  });
}
