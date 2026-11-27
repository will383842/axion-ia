/**
 * @vitest-environment node
 *
 * Les textes, la page et la politique de confidentialité du questionnaire ne portent aucun terme
 * interdit (lieu, prix, promesse, certification, financement, témoignage, mentions de brouillon).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import * as textes from "../textes";
import { LEGAL_PAGES } from "../../legal";

const INTERDITS: ReadonlyArray<RegExp> = [
  /grenoble/i,
  // « euros? » borné par des limites de mot : sans elles, « européenne » (Union européenne) en ferait partie.
  /\d\s?€|\beuros?\b/i,
  /aucun gain garanti/i,
  /qualiopi/i,
  // « Activités financières / assurances » est un libellé de secteur : seul « financ » hors de ce mot est interdit.
  /financ(?!ières)|opco|cpf/i,
  /témoign/i,
  /brouillon/i,
  /à valider/i,
  /À CHOISIR/,
];

function toutLeTexte(valeur: unknown): string {
  if (typeof valeur === "string") return valeur;
  if (Array.isArray(valeur)) return valeur.map(toutLeTexte).join("\n");
  if (valeur && typeof valeur === "object")
    return Object.values(valeur).map(toutLeTexte).join("\n");
  return "";
}

const RACINE = process.cwd();
const sources: Array<[string, string]> = [
  ["textes.ts (valeurs)", toutLeTexte(textes)],
  [
    "page.tsx",
    readFileSync(join(RACINE, "src/app/[locale]/questionnaire-barometre-ia-2027/page.tsx"), "utf8"),
  ],
  [
    "FormulaireBarometre.tsx",
    readFileSync(
      join(RACINE, "src/components/barometre-questionnaire/FormulaireBarometre.tsx"),
      "utf8",
    ),
  ],
  [
    "section de la politique de confidentialité",
    (() => {
      const page = LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite")!;
      return (["fr", "en"] as const)
        .map(
          (l) =>
            page[l].sections.find((s) => s.anchor === "questionnaire-barometre-2027")?.body ?? "",
        )
        .join("\n");
    })(),
  ],
];

describe("termes interdits", () => {
  it("les sources lues ne sont pas vides (témoin de non-vacuité)", () => {
    for (const [nom, texte] of sources) expect(texte.length, nom).toBeGreaterThan(200);
  });

  for (const [nom, texte] of sources) {
    for (const re of INTERDITS) {
      it(`${nom} : aucun ${re}`, () => {
        expect(texte).not.toMatch(re);
      });
    }
  }

  it("le détecteur voit bien un terme fautif (témoin)", () => {
    expect("Financement OPCO").toMatch(INTERDITS[4]!);
    expect("Activités financières").not.toMatch(INTERDITS[4]!);
  });
});
