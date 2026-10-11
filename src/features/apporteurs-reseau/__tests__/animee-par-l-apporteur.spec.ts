import { describe, expect, it } from "vitest";

import { animeeParLApporteur, sirenDe } from "../animee-par-l-apporteur";

describe("L12j — pas de commission sur une formation animée par l'apporteur (pur, non branché)", () => {
  it("même SIREN (principal ou co-formateur) → vrai ; SIREN différent ou inconnu → faux", () => {
    expect(animeeParLApporteur(["12345678900011", "98765432100022"], "123456789")).toBe(true);
    expect(animeeParLApporteur(["98765432100022"], "123456789")).toBe(false);
    expect(animeeParLApporteur([null, ""], "123456789")).toBe(false);
    expect(animeeParLApporteur(["12345678900011"], null)).toBe(false);
    expect(sirenDe("123 456 789 00011")).toBe("123456789");
    expect(sirenDe("1234")).toBeNull();
  });
});
