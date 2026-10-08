import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";
describe("commission suspendue, puis libérée (art. 4.2 bis)", () => {
  it("prévient l'apporteur sans nommer le client ni promettre de délai", async () => {
    const s = await renderEmailTemplate("apporteur-commission-suspension" as never, "fr", {
      contactName: "Claire Martin",
      etat: "suspendue",
    });
    expect(s.subject).toBe("Une de vos commissions est suspendue");
    expect(s.text).toContain("article 4.2 bis");
    const l = await renderEmailTemplate("apporteur-commission-suspension" as never, "fr", {
      contactName: "Claire Martin",
      etat: "levee",
    });
    expect(l.subject).toBe("Votre commission reprend son cours");
  });
});

describe("produit non commissionné (A1.7)", () => {
  it("porte la décision et son motif", async () => {
    const r = await renderEmailTemplate("apporteur-non-commissionne" as never, "fr", {
      contactName: "Claire Martin",
      motifNonCommissionne: "Atelier interne, hors offre.",
    });
    expect(r.subject).toBe("Une prestation n'est pas commissionnée");
    const t = r.text.replace(/\s+/g, " ");
    expect(t).toContain("Atelier interne, hors offre.");
    expect(t).toContain("A1.7");
  });
});
