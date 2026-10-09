// L'archive « Tout télécharger » est un vrai ZIP : somme de contrôle standard, en-têtes et
// répertoire central au bon endroit, contenu restitué tel quel.
import { describe, expect, it } from "vitest";

import { crc32, creerZip } from "./zip";

const enc = new TextEncoder();

describe("crc32", () => {
  it("la valeur de contrôle de référence (« 123456789 » → cbf43926)", () => {
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("creerZip", () => {
  const a = enc.encode("bonjour");
  const b = enc.encode("é — UTF-8");
  const zip = creerZip([
    { nom: "a.txt", octets: a },
    { nom: "dossier/b.txt", octets: b },
  ]);
  const vue = new DataView(zip.buffer);

  it("commence par un en-tête local et finit par la fin de répertoire central", () => {
    expect(vue.getUint32(0, true)).toBe(0x04034b50);
    const fin = zip.length - 22;
    expect(vue.getUint32(fin, true)).toBe(0x06054b50);
    expect(vue.getUint16(fin + 10, true)).toBe(2);
  });

  it("le répertoire central pointe sur le second fichier, dont le contenu est intact", () => {
    const fin = zip.length - 22;
    const debutCentral = vue.getUint32(fin + 16, true);
    expect(vue.getUint32(debutCentral, true)).toBe(0x02014b50);
    const tailleNom1 = vue.getUint16(debutCentral + 28, true);
    const central2 = debutCentral + 46 + tailleNom1;
    const decalage2 = vue.getUint32(central2 + 42, true);
    const tailleNom2 = vue.getUint16(decalage2 + 26, true);
    const contenu = zip.slice(decalage2 + 30 + tailleNom2, decalage2 + 30 + tailleNom2 + b.length);
    expect(new TextDecoder().decode(contenu)).toBe("é — UTF-8");
    expect(vue.getUint32(decalage2 + 14, true)).toBe(crc32(b));
  });
});
