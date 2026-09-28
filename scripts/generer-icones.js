// Génère les icônes PWA (PNG) sans dépendance : anneau jaune sur fond bleu, pas de blason.
// Usage : node scripts/generer-icones.js
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const BLEU = [0x0a, 0x2a, 0x66];
const JAUNE = [0xff, 0xd5, 0x00];

const TABLE_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLE_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloc(type, donnees) {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), donnees]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corps));
  return Buffer.concat([longueur, corps, crc]);
}

function png(taille, pixel) {
  const lignes = Buffer.alloc(taille * (taille * 4 + 1));
  let i = 0;
  for (let y = 0; y < taille; y++) {
    lignes[i++] = 0;
    for (let x = 0; x < taille; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5);
      lignes[i++] = r;
      lignes[i++] = g;
      lignes[i++] = b;
      lignes[i++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(taille, 0);
  ihdr.writeUInt32BE(taille, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', ihdr),
    bloc('IDAT', deflateSync(lignes, { level: 9 })),
    bloc('IEND', Buffer.alloc(0)),
  ]);
}

// Couverture (0..1) d'une forme définie par une distance signée, anticrénelage sur 1 px.
const couverture = (d) => Math.min(1, Math.max(0, 0.5 - d));

function melange(fond, dessus, t) {
  return fond.map((v, k) => Math.round(v + (dessus[k] - v) * t));
}

function icone(taille, { masquable }) {
  const c = taille / 2;
  const echelle = masquable ? 0.6 : 0.8; // zone sûre des icônes masquables : 80 % du diamètre
  const rAnneau = (taille / 2) * echelle * 0.78;
  const epaisseur = taille * echelle * 0.1;
  const rPoint = taille * echelle * 0.14;
  const rayonCoin = taille * 0.22;

  return png(taille, (x, y) => {
    let alpha = 1;
    if (!masquable) {
      // Carré aux coins arrondis.
      const qx = Math.abs(x - c) - (c - rayonCoin);
      const qy = Math.abs(y - c) - (c - rayonCoin);
      const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rayonCoin;
      alpha = couverture(d);
    }
    const r = Math.hypot(x - c, y - c);
    const tAnneau = couverture(Math.abs(r - rAnneau) - epaisseur / 2);
    const tPoint = couverture(r - rPoint);
    const couleur = melange(BLEU, JAUNE, Math.max(tAnneau, tPoint));
    return [...couleur, Math.round(alpha * 255)];
  });
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', icone(192, { masquable: false }));
writeFileSync('public/icons/icon-512.png', icone(512, { masquable: false }));
writeFileSync('public/icons/icon-maskable-512.png', icone(512, { masquable: true }));
console.log('Icônes écrites dans public/icons/');
