// Ligue simulée selon le modèle de Dixon-Coles, avec des paramètres connus, pour vérifier que
// l'estimation les retrouve.
import { grilleScores } from '../modele/grille.js';

export function mulberry32(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normale(alea) {
  return Math.sqrt(-2 * Math.log(1 - alea())) * Math.cos(2 * Math.PI * alea());
}

function tirerScore(alea, grille) {
  let u = alea();
  for (let x = 0; x < grille.length; x++) {
    for (let y = 0; y < grille.length; y++) {
      u -= grille[x][y];
      if (u <= 0) return [x, y];
    }
  }
  return [0, 0];
}

function decaler(date, jours) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

/**
 * equipes : nombre d'équipes ; saisons : allers-retours complets ; retourne { vrais, matchs }.
 * attaqueDe(t, date) permet de faire évoluer une force dans le temps.
 */
export function simulerLigue({ graine = 1, equipes = 20, saisons = 3, m = Math.log(1.3), h = 0.25, rho = -0.1, ecart = 0.25, debut = '2023-08-05', attaqueDe } = {}) {
  const alea = mulberry32(graine);
  const noms = Array.from({ length: equipes }, (_, i) => `Équipe ${String(i + 1).padStart(2, '0')}`);
  const att = noms.map(() => ecart * normale(alea));
  const def = noms.map(() => ecart * normale(alea));
  const moyA = att.reduce((a, b) => a + b) / equipes;
  const moyD = def.reduce((a, b) => a + b) / equipes;
  for (let t = 0; t < equipes; t++) {
    att[t] -= moyA;
    def[t] -= moyD;
  }

  // Calendrier « méthode du cercle » : chaque équipe joue une fois par journée.
  const journees = [];
  const rotation = [...Array(equipes).keys()];
  for (let j = 0; j < equipes - 1; j++) {
    const paires = [];
    for (let k = 0; k < equipes / 2; k++) paires.push([rotation[k], rotation[equipes - 1 - k]]);
    journees.push(paires);
    rotation.splice(1, 0, rotation.pop());
  }

  const matchs = [];
  let date = debut;
  for (let s = 0; s < saisons; s++) {
    for (const aller of [true, false]) {
      for (const paires of journees) {
        for (const [a, b] of paires) {
          const [i, j] = aller ? [a, b] : [b, a];
          const ai = attaqueDe ? attaqueDe(i, date, att[i]) : att[i];
          const aj = attaqueDe ? attaqueDe(j, date, att[j]) : att[j];
          const lambda = Math.exp(m + h + ai + def[j]);
          const mu = Math.exp(m + aj + def[i]);
          const [x, y] = tirerScore(alea, grilleScores(lambda, mu, rho, 10));
          matchs.push({ date, domicile: noms[i], exterieur: noms[j], score: `${x}-${y}`, score_mt: null });
        }
        date = decaler(date, 7);
      }
    }
    date = decaler(date, 70); // trêve estivale
  }
  return { vrais: { noms, att, def, m, h, rho }, matchs, derniereDate: date };
}

export function correlation(a, b) {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x) / n;
  const mb = b.reduce((s, x) => s + x) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}
