// Une archive ZIP « stockée » (sans compression), écrite à la main pour le bouton « Tout
// télécharger » : les images sont déjà compressées (PNG), une bibliothèque de compression
// alourdirait la page pour rien. Format : APPNOTE 6.3.3, sections 4.3.7, 4.3.12 et 4.3.16.

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(octets: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface FichierZip {
  nom: string;
  octets: Uint8Array;
}

/** Assemble l'archive. Noms en UTF-8 (bit 11), date fixe : le contenu seul compte. */
export function creerZip(fichiers: FichierZip[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const locaux: Uint8Array[] = [];
  const centraux: Uint8Array[] = [];
  let decalage = 0;

  for (const f of fichiers) {
    const nom = enc.encode(f.nom);
    const crc = crc32(f.octets);
    const taille = f.octets.length;

    const local = new Uint8Array(30 + nom.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x0800, true);
    l.setUint16(8, 0, true);
    l.setUint16(10, 0, true);
    l.setUint16(12, 0x21, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, taille, true);
    l.setUint32(22, taille, true);
    l.setUint16(26, nom.length, true);
    l.setUint16(28, 0, true);
    local.set(nom, 30);

    const central = new Uint8Array(46 + nom.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, 0, true);
    c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, taille, true);
    c.setUint32(24, taille, true);
    c.setUint16(28, nom.length, true);
    c.setUint32(42, decalage, true);
    central.set(nom, 46);

    locaux.push(local, f.octets);
    centraux.push(central);
    decalage += local.length + taille;
  }

  const tailleCentral = centraux.reduce((s, x) => s + x.length, 0);
  const fin = new Uint8Array(22);
  const e = new DataView(fin.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, fichiers.length, true);
  e.setUint16(10, fichiers.length, true);
  e.setUint32(12, tailleCentral, true);
  e.setUint32(16, decalage, true);

  const total = new Uint8Array(decalage + tailleCentral + fin.length);
  let p = 0;
  for (const morceau of [...locaux, ...centraux, fin]) {
    total.set(morceau, p);
    p += morceau.length;
  }
  return total;
}
