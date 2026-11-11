/**
 * Garde-fou — la clause « Financement par un opérateur de compétences (OPCO) » n'est
 * plus dans les CGV (décision 21 de Williams, 08/11/2026).
 *
 * Elle avait été ajoutée au lot OPCO O13 (2026-10-04) pour aligner les CGV sur la clause
 * de défaillance du financeur des conventions de formation. Elle est retirée des CGV ;
 * les conventions signées gardent leur propre clause, et ce test continue de la garder.
 *
 * Deux familles :
 *   1. ABSENCE de l'article OPCO dans les CGV, en FR et en EN.
 *   2. COHÉRENCE des conventions signées (clause de défaillance du financeur).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { getLegal } from "@/content/legal";

const CGV = getLegal("conditions-generales");
const TITRE_FR = "Financement par un opérateur de compétences (OPCO)";
const TITRE_EN = "Funding by a skills operator (OPCO)";

describe("CGV — l'article Financement par un OPCO est retiré (décision 21)", () => {
  it("FR : aucune section ne porte le titre de l'article OPCO", () => {
    expect(CGV.fr.sections.some((s) => s.title === TITRE_FR)).toBe(false);
  });

  it("EN : aucune section ne porte le titre de l'article OPCO", () => {
    expect(CGV.en.sections.some((s) => s.title === TITRE_EN)).toBe(false);
  });

  it("« Dédit et abandon en cours d'exécution » reste, et les clauses renvoyées existent", () => {
    const titres = CGV.fr.sections.map((s) => s.title);
    expect(titres).toContain("Dédit et abandon en cours d'exécution");
    expect(titres).toContain("Annulation, report et remboursement");
    expect(CGV.en.sections.map((s) => s.title)).toContain("Cancellation, rescheduling and refund");
  });
});

describe("Conventions signées — clause de défaillance du financeur (relecture tour 2)", () => {
  // Les conventions signées priment sur les CGV (art. 1119 al. 3 C. civ.) :
  // corriger les CGV sans elles laisserait le « pour quelque cause que ce soit »
  // gouverner — y compris les manquements de l'organisme.
  const GABARITS = ["convention.tsx", "convention-tripartite.tsx"];
  const dir = join(process.cwd(), "src/server/qualiopi/documents/templates");

  for (const nom of GABARITS) {
    // JSX : apostrophes échappées et retours à la ligne à normaliser.
    const texte = readFileSync(join(dir, nom), "utf8")
      .replace(/&apos;/g, "'")
      .replace(/\s+/g, " ");

    it(`${nom} : plus de « pour quelque cause que ce soit »`, () => {
      expect(texte).not.toMatch(/pour quelque cause que ce soit/);
    });

    it(`${nom} : réserve le manquement de l'organisme et le dédit/abandon`, () => {
      expect(texte).toMatch(/manquement de l'organisme/);
      expect(texte).toMatch(
        /sauf lorsque la réduction, la caducité ou le non-paiement résulte d'un manquement de l'organisme à ses propres obligations \(inexécution de tout ou partie de l'action, défaut des justificatifs de réalisation qui lui incombent\)\./,
      );
      expect(texte).toMatch(
        /sous réserve des conditions de dédit et d'abandon en cours d'exécution prévues aux conditions générales de vente/,
      );
    });
  }
});
