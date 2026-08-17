// Garde de routage de la fiche contact.
//
// Le risque réel n'est pas que la route casse : c'est que le `matcher` de
// `src/proxy.ts` reprenne la main sur `/williams-jullin.vcf` et le 301 vers
// `/fr/williams-jullin.vcf`, qui n'existe pas. Les cartes de visite déjà
// distribuées mèneraient alors à une page 404, sans aucun moyen de les
// corriger. Le même piège s'est produit en prod le 2026-08-16 avec `.html`.
//
// Ce test ne cherche pas la chaîne « vcf » dans le fichier — un commentaire la
// contient déjà, la garde ne rougirait jamais. Il EXTRAIT le motif réel du
// matcher, en construit une expression régulière et la fait tourner.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GET } from "./route";

/** Récupère le motif du `matcher` tel qu'il est réellement écrit dans proxy.ts. */
function matcherRegex(): RegExp {
  const source = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
  const ligne = source.split("\n").find((l) => l.trim().startsWith('"/((?!'));
  if (!ligne) throw new Error("Motif du matcher introuvable dans src/proxy.ts");
  // La ligne est un littéral TypeScript : on retire guillemets et virgule
  // finale, puis on déséchappe les `\\` du littéral vers la regex.
  const pattern = ligne.trim().replace(/^"/, "").replace(/",?$/, "").replace(/\\\\/g, "\\");
  return new RegExp(`^${pattern}$`);
}

describe("routage de /williams-jullin.vcf", () => {
  const matcher = matcherRegex();

  it("est exclu du matcher du proxy", () => {
    // Exclu = NON capturé par le matcher = le middleware ne s'exécute pas.
    expect(matcher.test("/williams-jullin.vcf")).toBe(false);
  });

  it("laisse le matcher couvrir les pages normales", () => {
    // Contre-épreuve : sans elle, une regex cassée « exclurait » tout et le
    // test ci-dessus passerait au vert pour de mauvaises raisons.
    expect(matcher.test("/a-propos")).toBe(true);
    expect(matcher.test("/fr/contact")).toBe(true);
  });
});

describe("réponse de /williams-jullin.vcf", () => {
  const res = GET();

  it("annonce le type MIME d'une fiche contact", () => {
    expect(res.headers.get("Content-Type")).toBe("text/vcard; charset=utf-8");
  });

  it("s'affiche au lieu de se télécharger", () => {
    // `inline` évite à Safari iOS de ranger le fichier dans Fichiers : la fiche
    // s'ouvre directement, avec son bouton « Créer un nouveau contact ».
    expect(res.headers.get("Content-Disposition")).toContain("inline");
    expect(res.headers.get("Content-Disposition")).toContain("williams-jullin.vcf");
  });

  it("reste hors des index de recherche", () => {
    expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
  });

  it("renvoie bien la fiche", async () => {
    const body = await res.text();
    expect(body.startsWith("BEGIN:VCARD")).toBe(true);
    expect(body).toContain("FN:Williams Jullin");
  });
});
