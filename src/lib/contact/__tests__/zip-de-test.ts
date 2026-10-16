/**
 * Fabrique d'archives ZIP MINIMALES pour les tests (entrées stockées, sans
 * compression ni CRC) : de vrais en-têtes locaux, un vrai répertoire central,
 * un vrai enregistrement de fin — ce que le contrôle lit par `Range`.
 */

export function fabriquerZip(
  entrees: ReadonlyArray<readonly [nom: string, contenu: string]>,
  options: { commentaire?: string; prefixe?: Uint8Array } = {},
): Uint8Array {
  const locaux: Buffer[] = [];
  const central: Buffer[] = [];
  let decalage = 0;
  for (const [nom, contenu] of entrees) {
    const n = Buffer.from(nom, "utf8");
    const d = Buffer.from(contenu, "utf8");
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0);
    l.writeUInt16LE(20, 4);
    l.writeUInt32LE(d.length, 18);
    l.writeUInt32LE(d.length, 22);
    l.writeUInt16LE(n.length, 26);
    locaux.push(l, n, d);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt32LE(d.length, 20);
    c.writeUInt32LE(d.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(decalage, 42);
    central.push(c, n);
    decalage += 30 + n.length + d.length;
  }
  const cd = Buffer.concat(central);
  const com = Buffer.from(options.commentaire ?? "", "utf8");
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(cd.length, 12);
  fin.writeUInt32LE(decalage, 16);
  fin.writeUInt16LE(com.length, 20);
  return new Uint8Array(Buffer.concat([...locaux, cd, fin, com]));
}
