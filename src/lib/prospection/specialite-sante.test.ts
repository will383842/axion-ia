import { describe, it, expect } from "vitest";
import { normalizeSpecialite, SPECIALITES_SANTE, SPECIALITE_LABELS } from "./specialite-sante";

describe("normalizeSpecialite", () => {
  it("mappe les libellés RPPS courants (variations de formulation)", () => {
    expect(normalizeSpecialite("Cardiologie et maladies vasculaires")).toBe("cardiologie");
    expect(normalizeSpecialite("OPHTALMOLOGIE")).toBe("ophtalmologie");
    expect(normalizeSpecialite("Oto-rhino-laryngologie")).toBe("orl");
    expect(normalizeSpecialite("Gynécologie-obstétrique")).toBe("gynecologie");
    expect(normalizeSpecialite("Endocrinologie, diabétologie")).toBe("endocrinologie");
    expect(normalizeSpecialite("Chirurgien-dentiste")).toBe("stomatologie");
    expect(normalizeSpecialite("Médecine générale")).toBe("medecine_generale");
  });

  it("libellé santé non mappé → autre_specialite (jamais perdu)", () => {
    expect(normalizeSpecialite("Médecine du sport")).toBe("autre_specialite");
  });

  it("libellé vide / absent → null", () => {
    expect(normalizeSpecialite("")).toBeNull();
    expect(normalizeSpecialite(null)).toBeNull();
    expect(normalizeSpecialite(undefined)).toBeNull();
  });

  it("chaque spécialité a un libellé FR", () => {
    for (const s of SPECIALITES_SANTE) {
      expect(SPECIALITE_LABELS[s]).toBeTruthy();
    }
  });
});
