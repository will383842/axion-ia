/**
 * Garde : la liste des gabarits qui lisent le « message personnalisé » est exacte.
 *
 * On lit la SOURCE de chaque gabarit (`src/lib/email/templates/<nom>.tsx`, le nom
 * du fichier est celui du job). Un gabarit qui lit `messagePersonnalise` sans être
 * dans la liste perdrait le texte saisi à la validation ; un gabarit listé qui ne
 * le lit pas afficherait un champ sans effet. Les deux font rougir ce test.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { EMAIL_TEMPLATE_NAMES } from "@/lib/email/templates";
import { GABARITS_QUI_LISENT_LE_MESSAGE, gabaritLitLeMessage } from "./outbox-policy";

const DOSSIER = join(process.cwd(), "src/lib/email/templates");

function gabaritsLisantLeMessage(): string[] {
  return readdirSync(DOSSIER)
    .filter((f) => f.endsWith(".tsx") && !f.endsWith(".spec.tsx") && !f.startsWith("_"))
    .filter((f) => readFileSync(join(DOSSIER, f), "utf8").includes("messagePersonnalise"))
    .map((f) => f.replace(/\.tsx$/, ""))
    .sort();
}

describe("GABARITS_QUI_LISENT_LE_MESSAGE", () => {
  it("égale exactement l'ensemble des gabarits dont la source lit messagePersonnalise", () => {
    expect([...GABARITS_QUI_LISENT_LE_MESSAGE].sort()).toEqual(gabaritsLisantLeMessage());
  });

  it("ne nomme que des gabarits enregistrés", () => {
    for (const nom of GABARITS_QUI_LISENT_LE_MESSAGE) {
      expect(EMAIL_TEMPLATE_NAMES as string[]).toContain(nom);
    }
  });

  it("gabaritLitLeMessage suit la liste", () => {
    expect(gabaritLitLeMessage("facture-envoi")).toBe(true);
    expect(gabaritLitLeMessage("qualiopi-convocation")).toBe(false);
  });
});
