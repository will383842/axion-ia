/**
 * Corrections de l'audit Opus (4e passe) : le dernier segment « x et y » est toujours éclaté.
 */
import { describe, expect, it } from "vitest";
import { reecrireTexte } from "./regles";

describe("énumération sans nombre ni « : » : rien de perdu", () => {
  it.each([
    [
      "Nous proposons audit, formation, financement OPCO et suivi.",
      "Nous proposons audit, formation et suivi.",
    ],
    [
      "Nous proposons audit, formation, prise en charge OPCO et suivi.",
      "Nous proposons audit, formation et suivi.",
    ],
    [
      "Nous proposons l'audit, la formation, le financement OPCO et le suivi.",
      "Nous proposons l'audit, la formation et le suivi.",
    ],
    ["Audit, financement OPCO ou suivi.", "Audit ou suivi."],
  ])("%s", (entree, attendu) => {
    const r = reecrireTexte(entree, "fr");
    if (r.ambigus.length > 0) expect(r.modifie).toBe(false);
    else expect(r.valeur).toBe(attendu);
    expect(r.valeur).toContain("suivi");
  });
  it("nombre APRÈS la liste : corrigé ou ambigu", () => {
    const r = reecrireTexte("Audit, formation, financement OPCO et suivi : nos 4 offres.", "fr");
    if (r.ambigus.length > 0) expect(r.modifie).toBe(false);
    else expect(r.valeur).toBe("Audit, formation et suivi : nos 3 offres.");
  });
});
