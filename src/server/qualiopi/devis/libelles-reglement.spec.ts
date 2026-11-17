import { describe, expect, it } from "vitest";
import { libellesReglementDevis } from "./libelles-reglement";

describe("libellesReglementDevis", () => {
  it("sans certification : aucun mot de tiers payeur", () => {
    const t = libellesReglementDevis(false);
    expect(t.direct).toBe("Règlement direct");
    for (const m of ["opco", "cpf", "france_travail", "autre_mode_a_tiers"]) {
      expect(t[m]).toBe("Règlement par un tiers (ancien devis)");
    }
    for (const v of Object.values({ d: t.direct, o: t.opco, c: t.cpf, f: t.france_travail })) {
      expect(v).not.toMatch(/opco|cpf|france travail|financ|qualiopi/i);
    }
  });

  it("avec certification : les libellés actuels", () => {
    const t = libellesReglementDevis(true);
    expect(t).toEqual({
      direct: "Direct (entreprise)",
      opco: "OPCO",
      cpf: "CPF / EDOF",
      france_travail: "France Travail",
    });
  });
});
