// Les pièces de communication respectent la charte de marque D'OFFICE (contrat, art. 8.3 et
// 22 bis) : l'apporteur les publie sans rien retoucher, donc aucun texte ne doit porter un prix,
// une promesse, un financement, le CPF, une certification, ni présenter l'apporteur comme
// salarié, représentant ou agent commercial d'Axion-IA.
import { describe, expect, it } from "vitest";

import {
  bioInstagram,
  mention,
  signatureHtml,
  signatureTexte,
  textesPublication,
  titreLinkedin,
  tousLesTextes,
  VISUELS,
} from "../outils-communication";

const INTERDITS = [
  /\d\s?€|€|\beuros?\b/i,
  /\d\s?%/,
  /gratuit/i,
  /garanti/i,
  /financ/i,
  /\bopco\b/i,
  /\bcpf\b|compte personnel de formation/i,
  /qualiopi|certifi/i,
  /jusqu'à/i,
  /agent commercial|représentant|salarié|commercial d'axion/i,
  /parrain/i,
  /(^|[\s«(])(tu|ton|ta|tes|toi)(?=[\s,.!?;:])/i, // vouvoiement : « êtes » n'est pas « tes »
];

describe("aucun texte ne sort de la charte", () => {
  it.each(tousLesTextes().map((t) => [t.slice(0, 50), t]))("%s…", (_d, texte) => {
    for (const motif of INTERDITS) expect(texte).not.toMatch(motif);
  });
});

describe("la mention obligatoire est partout", () => {
  it.each(["m", "f"] as const)("accord %s : bio, titre LinkedIn, signature, publications", (a) => {
    const m = mention(a);
    expect(bioInstagram(a)).toContain(m);
    expect(titreLinkedin(a)).toContain(m);
    expect(signatureTexte("Marie Dupont", a)).toContain(m);
    for (const p of textesPublication(a))
      expect(p.texte).toMatch(/d'affaires indépendante? pour Axion-IA/);
  });

  it("l'accord suit le choix de l'apporteur", () => {
    expect(mention("m")).toBe("Apporteur d'affaires indépendant — réseau Axion-IA");
    expect(mention("f")).toBe("Apporteuse d'affaires indépendante — réseau Axion-IA");
  });
});

describe("les limites des réseaux", () => {
  it.each(["m", "f"] as const)(
    "bio Instagram ≤ 150 caractères, titre LinkedIn ≤ 220 (accord %s)",
    (a) => {
      expect(bioInstagram(a).length).toBeLessThanOrEqual(150);
      expect(titreLinkedin(a).length).toBeLessThanOrEqual(220);
    },
  );
});

describe("visuels", () => {
  it("un général, puis une activité par visuel ; aucun n'est réservé aux formations", () => {
    expect(VISUELS.map((v) => v.cle)).toEqual([
      "general",
      "formations",
      "audit",
      "mise-en-place",
      "accompagnement",
      "conferences",
    ]);
  });
});

describe("signature d'e-mail", () => {
  it("le nom est échappé : rien ne s'injecte dans le HTML collé", () => {
    const html = signatureHtml(`<img src=x onerror=alert(1)>`, "m");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});
