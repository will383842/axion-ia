/**
 * Tests — couche financement coaching 1-to-1 (validation + facturation par dispositif).
 * Module pur : aucune DB.
 */

import { describe, it, expect } from "vitest";
import {
  validateCoachingFinancement,
  computeCoachingFacturation,
  type CoachingFinancementFields,
} from "./financement-1to1";

function base(overrides: Partial<CoachingFinancementFields> = {}): CoachingFinancementFields {
  return {
    financementType: "direct",
    montantHtCents: 100000,
    subrogation: false,
    numeroDossierOpco: null,
    conventionTripartiteSigneeAt: null,
    priseEnChargeMontantCents: null,
    priseEnChargeUnite: null,
    priseEnChargePlafondFormationCents: null,
    priseEnChargePlafondAnnuelCents: null,
    edofVerifieAt: null,
    resteAChargeCents: null,
    ftDispositif: null,
    ftAifPrescriptionDate: null,
    ftPoeiOffreEmploiNumero: null,
    ftPoeiAccordFinancementAt: null,
    ftPoeiEngagementSigneAt: null,
    ...overrides,
  };
}

describe("validateCoachingFinancement", () => {
  it("direct → aucun pré-requis", () => {
    expect(validateCoachingFinancement(base())).toBeNull();
  });

  it("OPCO sans subrogation → aucun pré-requis bloquant", () => {
    expect(
      validateCoachingFinancement(base({ financementType: "opco", subrogation: false })),
    ).toBeNull();
  });

  it("OPCO subrogation sans n° dossier → bloque", () => {
    const r = validateCoachingFinancement(base({ financementType: "opco", subrogation: true }));
    expect(r).toMatch(/numéro de dossier/i);
  });

  it("OPCO subrogation avec n° dossier mais sans convention tripartite → bloque", () => {
    const r = validateCoachingFinancement(
      base({ financementType: "opco", subrogation: true, numeroDossierOpco: "D-123" }),
    );
    expect(r).toMatch(/convention tripartite/i);
  });

  it("OPCO subrogation complète → OK", () => {
    const r = validateCoachingFinancement(
      base({
        financementType: "opco",
        subrogation: true,
        numeroDossierOpco: "D-123",
        conventionTripartiteSigneeAt: new Date("2026-06-01"),
      }),
    );
    expect(r).toBeNull();
  });

  it("CPF sans vérification EDOF → bloque", () => {
    expect(validateCoachingFinancement(base({ financementType: "cpf" }))).toMatch(/EDOF/i);
  });

  it("CPF avec EDOF vérifié → OK", () => {
    expect(
      validateCoachingFinancement(base({ financementType: "cpf", edofVerifieAt: new Date() })),
    ).toBeNull();
  });

  it("France Travail sans dispositif → bloque", () => {
    expect(validateCoachingFinancement(base({ financementType: "france_travail" }))).toMatch(
      /dispositif/i,
    );
  });

  it("AIF sans date de prescription → bloque", () => {
    expect(
      validateCoachingFinancement(base({ financementType: "france_travail", ftDispositif: "aif" })),
    ).toMatch(/prescription/i);
  });

  it("AIF avec prescription → OK", () => {
    expect(
      validateCoachingFinancement(
        base({
          financementType: "france_travail",
          ftDispositif: "aif",
          ftAifPrescriptionDate: new Date(),
        }),
      ),
    ).toBeNull();
  });

  it("POEI incomplète → bloque (3 pièces requises)", () => {
    expect(
      validateCoachingFinancement(
        base({
          financementType: "france_travail",
          ftDispositif: "poei",
          ftPoeiOffreEmploiNumero: "OE-1",
        }),
      ),
    ).toMatch(/POEI/i);
  });

  it("POEI complète → OK", () => {
    expect(
      validateCoachingFinancement(
        base({
          financementType: "france_travail",
          ftDispositif: "poei",
          ftPoeiOffreEmploiNumero: "OE-1",
          ftPoeiAccordFinancementAt: new Date(),
          ftPoeiEngagementSigneAt: new Date(),
        }),
      ),
    ).toBeNull();
  });
});

describe("computeCoachingFacturation", () => {
  it("direct → forfait, destinataire entreprise, pas d'aide FT", () => {
    const r = computeCoachingFacturation(base({ montantHtCents: 139000 }), 14);
    expect(r.totalHtCents).toBe(139000);
    expect(r.destinataire).toBe("entreprise");
    expect(r.montantAideFranceTravailCents).toBeNull();
    expect(r.subrogation).toBe(false);
  });

  it("OPCO subrogation + barème €/h → ventilation horaire 1 bénéficiaire, destinataire opco", () => {
    const r = computeCoachingFacturation(
      base({
        financementType: "opco",
        subrogation: true,
        numeroDossierOpco: "D-9",
        priseEnChargeMontantCents: 5000, // 50 €/h
        priseEnChargeUnite: "euro_heure",
      }),
      10,
    );
    expect(r.totalHtCents).toBe(50000); // 10 h × 50 €
    expect(r.destinataire).toBe("opco");
    expect(r.numeroDossier).toBe("D-9");
  });

  it("barème €/h plafonné par participant", () => {
    const r = computeCoachingFacturation(
      base({
        financementType: "opco",
        subrogation: true,
        priseEnChargeMontantCents: 5000,
        priseEnChargeUnite: "euro_heure",
        priseEnChargePlafondFormationCents: 30000, // cap 300 €
      }),
      10,
    );
    expect(r.totalHtCents).toBe(30000);
  });

  it("France Travail → montant aide = total − reste à charge, destinataire france_travail", () => {
    const r = computeCoachingFacturation(
      base({
        financementType: "france_travail",
        ftDispositif: "aif",
        montantHtCents: 100000,
        resteAChargeCents: 20000,
      }),
      12,
    );
    expect(r.destinataire).toBe("france_travail");
    expect(r.totalHtCents).toBe(100000);
    expect(r.montantAideFranceTravailCents).toBe(80000);
    expect(r.resteAChargeCents).toBe(20000);
  });
});
