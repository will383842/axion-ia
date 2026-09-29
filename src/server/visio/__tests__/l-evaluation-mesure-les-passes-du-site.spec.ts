/**
 * ⛔ L'ÉVALUATION MESURE LES PASSES DU SITE, PAS UNE COPIE (O-2a ; fiche PR 6).
 *
 * `scripts/visio/evaluer.ts` ne tourne jamais en CI (il appelle OpenAI) : cette
 * garde lit sa SOURCE. Avant ce correctif, P2 et P3 n'étaient jamais
 * appelées — le compteur « relations hors périmètre » restait à 0, et le
 * seuil « 0 mélange de projets » ne pouvait JAMAIS rougir — et l'entrée de P5
 * était écrite à la main, différente de celle du site.
 *
 * Mutations qui rougissent : retirer l'appel de `filtrerConsolidation`, ou
 * écrire l'entrée de P5 à la main. Contre-témoin : les étapes du site
 * utilisent les MÊMES préparations (sinon l'évaluation mesurerait une
 * branche morte). Angle mort : la campagne elle-même (lancée dans le worker).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const lire = (p: string) => readFileSync(path.resolve(process.cwd(), p), "utf8");

describe("l'évaluation mesure les passes du site", () => {
  const script = lire("scripts/visio/evaluer.ts");

  it("P2, P3, P4, P5 et V2 passent par les préparations du site", () => {
    for (const f of ["preparerP2(", "preparerP3(", "preparerP4(", "entreeP5(", "preparerV2("]) {
      expect(script, f).toContain(f);
    }
    expect(script).toContain("filtrerRattachement(");
    expect(script).toContain("filtrerConsolidation(");
  });

  it("le compteur « relations hors périmètre » est alimenté par le filtre du site", () => {
    expect(script).toMatch(
      /relationsHorsPerimetre = \(c\.relationsHorsPerimetre \?\? 0\) \+ filtre\.horsPerimetre/,
    );
  });

  it("aucune entrée de passe n'est écrite à la main", () => {
    expect(script).not.toMatch(/entree:\s*`/);
  });

  it("contre-témoin : les étapes du site utilisent ces mêmes préparations", () => {
    const passes = lire("src/server/visio/passes-ia.ts");
    for (const f of [
      "preparerP2(d)",
      "preparerP3(d)",
      "preparerP4(d)",
      "entreeP5(d,",
      "preparerV2(d)",
    ]) {
      expect(passes, f).toContain(f);
    }
  });
});
