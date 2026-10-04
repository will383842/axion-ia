/**
 * Tests — regime-paiement-opco.ts (chantier OPCO A3, module PUR).
 *
 * Réforme TVA du 1er octobre 2026 : chaque règle a son TÉMOIN, bords de date
 * inclus (30/09 ↔ 01/10, dépôt Atlas 14/09 ↔ 15/09, Constructys 31/12 ↔ 01/01,
 * effectif 49 ↔ 50).
 */

import { describe, it, expect } from "vitest";
import { regimePaiementOpco, type EntreeRegimePaiement } from "./regime-paiement-opco";

const J = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Petite entreprise d'Atlas, accord du 2026-10-15, sans cofinancement. */
function entree(surcharge: Partial<EntreeRegimePaiement> = {}): EntreeRegimePaiement {
  return {
    opco: "atlas",
    effectif: 10,
    cofinancement: false,
    versementVolontaire: false,
    dateAccord: J("2026-10-15"),
    dateDepot: J("2026-10-01"),
    adhesionOffreMobilites: null,
    aujourdhui: J("2026-10-15"),
    ...surcharge,
  };
}

describe("regimePaiementOpco — OPCO", () => {
  it("OPCO null → inconnu « OPCO non renseigné »", () => {
    const r = regimePaiementOpco(entree({ opco: null }));
    expect(r.regime).toBe("inconnu");
    expect(r.motif).toBe("OPCO non renseigné");
  });

  it("OPCO hors liste → inconnu", () => {
    expect(regimePaiementOpco(entree({ opco: "pas_un_opco" })).regime).toBe("inconnu");
  });

  it.each(["opco_sante", "uniformation"])(
    "%s (hors champ TVA) → subrogation possible même à 500 salariés, source = communiqué commun",
    (opco) => {
      const r = regimePaiementOpco(entree({ opco, effectif: 500, cofinancement: true }));
      expect(r.regime).toBe("subrogation_possible");
      expect(r.source).toContain("CPcommunOpcos_TVA.pdf");
    },
  );
});

describe("regimePaiementOpco — accord antérieur au 1er octobre 2026", () => {
  it("accord du 2026-09-30 → subrogation possible (ancien régime), même à 200 salariés", () => {
    const r = regimePaiementOpco(entree({ effectif: 200, dateAccord: J("2026-09-30") }));
    expect(r.regime).toBe("subrogation_possible");
    expect(r.motif).toContain("accord antérieur au 1er octobre 2026");
  });

  it("accord du 2026-10-01 → nouveau régime (200 salariés → remboursement)", () => {
    const r = regimePaiementOpco(entree({ effectif: 200, dateAccord: J("2026-10-01") }));
    expect(r.regime).toBe("remboursement_entreprise");
  });

  it("accord saisi le 2026-09-30 à 23 h 30 à Paris (21 h 30 UTC) compte pour le 30", () => {
    const r = regimePaiementOpco(
      entree({ effectif: 200, dateAccord: new Date("2026-09-30T21:30:00.000Z") }),
    );
    expect(r.regime).toBe("subrogation_possible");
  });

  it("Atlas : dépôt du 2026-09-14 → ancien régime, sans accord", () => {
    const r = regimePaiementOpco(
      entree({ effectif: 200, dateAccord: null, dateDepot: J("2026-09-14") }),
    );
    expect(r.regime).toBe("subrogation_possible");
  });

  it("Atlas : dépôt du 2026-09-15 → nouveau régime", () => {
    const r = regimePaiementOpco(
      entree({ effectif: 200, dateAccord: null, dateDepot: J("2026-09-15") }),
    );
    expect(r.regime).toBe("remboursement_entreprise");
  });

  it("le dépôt avant le 15/09 ne sauve QUE Atlas (AKTO, 200 salariés)", () => {
    const r = regimePaiementOpco(
      entree({ opco: "akto", effectif: 200, dateAccord: null, dateDepot: J("2026-09-01") }),
    );
    expect(r.regime).toBe("remboursement_entreprise");
  });
});

describe("regimePaiementOpco — Constructys", () => {
  it("accord du 2026-12-31 → remboursement, même à 5 salariés", () => {
    const r = regimePaiementOpco(
      entree({ opco: "constructys", effectif: 5, dateAccord: J("2026-12-31") }),
    );
    expect(r.regime).toBe("remboursement_entreprise");
    expect(r.source).toContain("constructys.fr");
  });

  it("accord du 2027-01-01 → inconnu (nouveau régime début 2027)", () => {
    const r = regimePaiementOpco(
      entree({ opco: "constructys", effectif: 5, dateAccord: J("2027-01-01") }),
    );
    expect(r.regime).toBe("inconnu");
  });

  it("sans accord, la date du jour sert de repère", () => {
    const r = regimePaiementOpco(
      entree({ opco: "constructys", dateAccord: null, aujourdhui: J("2027-02-01") }),
    );
    expect(r.regime).toBe("inconnu");
  });
});

describe("regimePaiementOpco — effectif et cofinancement", () => {
  it("effectif null → inconnu « effectif non renseigné »", () => {
    const r = regimePaiementOpco(entree({ effectif: null }));
    expect(r.regime).toBe("inconnu");
    expect(r.motif).toBe("effectif non renseigné");
  });

  it("effectif 49 → subrogation possible (Atlas)", () => {
    expect(regimePaiementOpco(entree({ effectif: 49 })).regime).toBe("subrogation_possible");
  });

  it("effectif 50 → remboursement entreprise", () => {
    expect(regimePaiementOpco(entree({ effectif: 50 })).regime).toBe("remboursement_entreprise");
  });

  it("cofinancement → remboursement entreprise", () => {
    const r = regimePaiementOpco(entree({ cofinancement: true }));
    expect(r.regime).toBe("remboursement_entreprise");
    expect(r.motif).toContain("cofinancement ou un versement volontaire");
  });

  it("versement volontaire → remboursement entreprise", () => {
    expect(regimePaiementOpco(entree({ versementVolontaire: true })).regime).toBe(
      "remboursement_entreprise",
    );
  });
});

describe("regimePaiementOpco — par OPCO, moins de 50 salariés", () => {
  it.each(["atlas", "akto", "opcommerce", "afdas"])("%s → subrogation possible", (opco) => {
    const r = regimePaiementOpco(entree({ opco }));
    expect(r.regime).toBe("subrogation_possible");
    expect(r.motif).toContain("moins de 50 salariés");
  });

  it("mobilites avec adhésion à l'offre de services → subrogation possible", () => {
    const r = regimePaiementOpco(entree({ opco: "mobilites", adhesionOffreMobilites: true }));
    expect(r.regime).toBe("subrogation_possible");
  });

  it.each([false, null])("mobilites sans adhésion (%s) → inconnu", (adhesion) => {
    const r = regimePaiementOpco(entree({ opco: "mobilites", adhesionOffreMobilites: adhesion }));
    expect(r.regime).toBe("inconnu");
    expect(r.motif).toContain("offre de services");
  });

  it.each(["opco_ep", "opco2i", "ocapiat"])("%s → inconnu (selon le dispositif)", (opco) => {
    const r = regimePaiementOpco(entree({ opco }));
    expect(r.regime).toBe("inconnu");
    expect(r.motif).toContain("accord de prise en charge");
  });
});

describe("regimePaiementOpco — forme du résultat", () => {
  it("chaque résultat porte un motif et une source non vides", () => {
    for (const opco of [null, "atlas", "constructys", "mobilites", "opco_ep", "opco_sante"]) {
      const r = regimePaiementOpco(entree({ opco }));
      expect(r.motif.length).toBeGreaterThan(0);
      expect(r.source.length).toBeGreaterThan(0);
    }
  });
});
