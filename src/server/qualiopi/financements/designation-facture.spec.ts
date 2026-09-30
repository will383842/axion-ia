import { describe, it, expect } from "vitest";
import { designationFormation, dureeLisible } from "./designation-facture";

describe("designationFormation — la ligne de facture nomme la prestation", () => {
  it("compose intitulé, session, période, durée et stagiaires, sur UNE ligne", () => {
    const d = designationFormation("Formation professionnelle — forfait", {
      intitule: "IA pour l'immobilier",
      numeroSession: "AXI-SESS-2026-001",
      periode: "du 15/09/2026 au 16/09/2026",
      dureeHeures: 14,
      stagiaires: [{ nom: "Martin", prenom: "Jean" }],
    });
    expect(d).toBe(
      "Formation professionnelle — forfait — « IA pour l'immobilier » — session AXI-SESS-2026-001 — réalisée du 15/09/2026 au 16/09/2026 — durée 14 h — stagiaire : MARTIN Jean",
    );
    expect(d).not.toContain("\n");
  });

  it("une journée unique se dit « réalisée le … »", () => {
    expect(designationFormation("Formation", { periode: "15/09/2026" })).toBe(
      "Formation — réalisée le 15/09/2026",
    );
  });

  it("omet ce qui manque, sans blanc ni tiret orphelin", () => {
    expect(designationFormation("Formation professionnelle — forfait", {})).toBe(
      "Formation professionnelle — forfait",
    );
    expect(
      designationFormation("Formation", { intitule: "  ", dureeHeures: 0, stagiaires: [] }),
    ).toBe("Formation");
  });

  it("durée en heures et minutes", () => {
    expect(dureeLisible(3.5)).toBe("3 h 30");
    expect(dureeLisible(7)).toBe("7 h");
  });
});
