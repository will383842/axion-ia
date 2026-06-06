/**
 * Tests — validation-service.ts (T11 AGENT A).
 *
 * Stratégie :
 *   - validateOpcoAccord, validateCpfEdof, validateFranceTravail,
 *     validateSousTraitant → fonctions pures, aucun mock nécessaire.
 *   - getFinancementValidations → mock @/lib/prisma (pattern evaluations-service.spec.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Prisma (pour getFinancementValidations uniquement)
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUniqueOrThrow: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  validateOpcoAccord,
  validateOpcoConventionTripartite,
  validateCpfEdof,
  validateFranceTravail,
  validateSousTraitant,
  validateCpfEligibilite,
  getFinancementValidations,
} from "./validation-service";

const mockPrisma = prisma as unknown as {
  trainingSession: { findUniqueOrThrow: ReturnType<typeof vi.fn> };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    financementType: "opco" as const,
    opcoStatut: "non_demande" as const,
    opcoSubrogation: false,
    numeroDossierOpco: null,
    conventionTripartiteSigneeAt: null,
    edofVerifieAt: null,
    ftDispositif: null,
    ftAifPrescriptionDate: null,
    ftPoeiOffreEmploiNumero: null,
    ftPoeiAccordFinancementAt: null,
    ftPoeiEngagementSigneAt: null,
    statut: "planifiee" as const,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// validateOpcoAccord
// ─────────────────────────────────────────────────────────────────────────────

describe("validateOpcoAccord", () => {
  it("retourne ok=true si financementType != opco", () => {
    const result = validateOpcoAccord(makeSession({ financementType: "direct" }));
    expect(result.ok).toBe(true);
  });

  it("retourne ok=false + gravite=critique si opco + planifiee + statut != accord_recu", () => {
    const result = validateOpcoAccord(
      makeSession({ financementType: "opco", opcoStatut: "non_demande", statut: "planifiee" }),
    );
    expect(result.ok).toBe(false);
    expect(result.gravite).toBe("critique");
    expect(result.alerte).toBeTruthy();
  });

  it("retourne ok=true si opco + statut=accord_recu", () => {
    const result = validateOpcoAccord(
      makeSession({ financementType: "opco", opcoStatut: "accord_recu" }),
    );
    expect(result.ok).toBe(true);
  });

  it("retourne ok=true si opco + statut=paiement_recu", () => {
    const result = validateOpcoAccord(
      makeSession({ financementType: "opco", opcoStatut: "paiement_recu" }),
    );
    expect(result.ok).toBe(true);
  });

  it("retourne ok=true si opco + session en_cours (non planifiee)", () => {
    // Session déjà démarrée : l'accord est contraignant seulement avant démarrage
    const result = validateOpcoAccord(
      makeSession({
        financementType: "opco",
        opcoStatut: "demande_en_cours",
        statut: "en_cours",
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("l'alerte mentionne l'accord OPCO", () => {
    const result = validateOpcoAccord(
      makeSession({ financementType: "opco", opcoStatut: "refuse", statut: "planifiee" }),
    );
    expect(result.alerte).toContain("OPCO");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateOpcoConventionTripartite (R2 — audit E2E 2026-06-06)
// ─────────────────────────────────────────────────────────────────────────────

describe("validateOpcoConventionTripartite", () => {
  it("ok=true si financementType != opco", () => {
    expect(validateOpcoConventionTripartite(makeSession({ financementType: "direct" })).ok).toBe(
      true,
    );
  });

  it("ok=true si opco SANS subrogation (pas de tripartite requise)", () => {
    expect(
      validateOpcoConventionTripartite(
        makeSession({ financementType: "opco", opcoSubrogation: false, statut: "planifiee" }),
      ).ok,
    ).toBe(true);
  });

  it("ok=false + critique si opco + subrogation + planifiee + tripartite non signée", () => {
    const result = validateOpcoConventionTripartite(
      makeSession({
        financementType: "opco",
        opcoSubrogation: true,
        statut: "planifiee",
        conventionTripartiteSigneeAt: null,
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.gravite).toBe("critique");
    expect(result.alerte).toContain("tripartite");
  });

  it("ok=true si opco + subrogation + tripartite signée", () => {
    expect(
      validateOpcoConventionTripartite(
        makeSession({
          financementType: "opco",
          opcoSubrogation: true,
          statut: "planifiee",
          conventionTripartiteSigneeAt: new Date(),
        }),
      ).ok,
    ).toBe(true);
  });

  it("ok=true si subrogation sans tripartite mais session déjà démarrée (non planifiee)", () => {
    expect(
      validateOpcoConventionTripartite(
        makeSession({
          financementType: "opco",
          opcoSubrogation: true,
          statut: "en_cours",
          conventionTripartiteSigneeAt: null,
        }),
      ).ok,
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateCpfEdof
// ─────────────────────────────────────────────────────────────────────────────

describe("validateCpfEdof", () => {
  it("retourne ok=true si financementType != cpf", () => {
    const result = validateCpfEdof(makeSession({ financementType: "direct" }), {
      edofVerifieAt: null,
    });
    expect(result.ok).toBe(true);
  });

  it("retourne ok=false + gravite=critique si cpf + edofVerifieAt null partout", () => {
    const result = validateCpfEdof(makeSession({ financementType: "cpf", edofVerifieAt: null }), {
      edofVerifieAt: null,
    });
    expect(result.ok).toBe(false);
    expect(result.gravite).toBe("critique");
  });

  it("retourne ok=true si cpf + edofVerifieAt sur la session", () => {
    const result = validateCpfEdof(
      makeSession({ financementType: "cpf", edofVerifieAt: new Date() }),
      { edofVerifieAt: null },
    );
    expect(result.ok).toBe(true);
  });

  it("retourne ok=true si cpf + edofVerifieAt sur la formation", () => {
    const result = validateCpfEdof(makeSession({ financementType: "cpf", edofVerifieAt: null }), {
      edofVerifieAt: new Date(),
    });
    expect(result.ok).toBe(true);
  });

  it("l'alerte mentionne EDOF", () => {
    const result = validateCpfEdof(makeSession({ financementType: "cpf", edofVerifieAt: null }), {
      edofVerifieAt: null,
    });
    expect(result.alerte).toContain("EDOF");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateFranceTravail
// ─────────────────────────────────────────────────────────────────────────────

describe("validateFranceTravail", () => {
  it("retourne ok=true si financementType != france_travail", () => {
    const result = validateFranceTravail(makeSession({ financementType: "direct" }));
    expect(result.ok).toBe(true);
  });

  it("retourne ok=false si france_travail + dispositif null", () => {
    const result = validateFranceTravail(
      makeSession({ financementType: "france_travail", ftDispositif: null }),
    );
    expect(result.ok).toBe(false);
    expect(result.gravite).toBe("critique");
  });

  it("retourne ok=false si AIF + ftAifPrescriptionDate null", () => {
    const result = validateFranceTravail(
      makeSession({
        financementType: "france_travail",
        ftDispositif: "aif",
        ftAifPrescriptionDate: null,
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.alerte).toContain("AIF");
  });

  it("retourne ok=true si AIF + ftAifPrescriptionDate renseignée", () => {
    const result = validateFranceTravail(
      makeSession({
        financementType: "france_travail",
        ftDispositif: "aif",
        ftAifPrescriptionDate: new Date(),
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("retourne ok=false si POEI + ftPoeiAccordFinancementAt null + session planifiee → critique", () => {
    const result = validateFranceTravail(
      makeSession({
        financementType: "france_travail",
        ftDispositif: "poei",
        ftPoeiOffreEmploiNumero: "2024-123456",
        ftPoeiAccordFinancementAt: null,
        ftPoeiEngagementSigneAt: new Date(),
        statut: "planifiee",
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.gravite).toBe("critique");
    expect(result.alerte).toContain("POEI");
  });

  it("retourne ok=false si POEI + ftPoeiEngagementSigneAt null + session planifiee → critique", () => {
    const result = validateFranceTravail(
      makeSession({
        financementType: "france_travail",
        ftDispositif: "poei",
        ftPoeiOffreEmploiNumero: "2024-123456",
        ftPoeiAccordFinancementAt: new Date(),
        ftPoeiEngagementSigneAt: null,
        statut: "planifiee",
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.gravite).toBe("critique");
    expect(result.alerte).toContain("POEI");
  });

  it("retourne ok=false + critique si POEI + ftPoeiOffreEmploiNumero null + session planifiee (T17)", () => {
    const result = validateFranceTravail(
      makeSession({
        financementType: "france_travail",
        ftDispositif: "poei",
        ftPoeiOffreEmploiNumero: null,
        ftPoeiAccordFinancementAt: new Date(),
        ftPoeiEngagementSigneAt: new Date(),
        statut: "planifiee",
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.gravite).toBe("critique");
    expect(result.alerte).toMatch(/offre.*emploi|POEI/i);
  });

  it("retourne ok=true si POEI + les 3 preuves renseignées + session planifiee", () => {
    const result = validateFranceTravail(
      makeSession({
        financementType: "france_travail",
        ftDispositif: "poei",
        ftPoeiOffreEmploiNumero: "2024-123456",
        ftPoeiAccordFinancementAt: new Date(),
        ftPoeiEngagementSigneAt: new Date(),
        statut: "planifiee",
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("retourne ok=false + warning si POEI + accord manquant + session en_cours (T17 — non bloquant)", () => {
    const result = validateFranceTravail(
      makeSession({
        financementType: "france_travail",
        ftDispositif: "poei",
        ftPoeiOffreEmploiNumero: "2024-123456",
        ftPoeiAccordFinancementAt: null,
        ftPoeiEngagementSigneAt: new Date(),
        statut: "en_cours",
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.gravite).toBe("warning");
  });

  it("retourne ok=true si CSP (pas de conditions supplémentaires)", () => {
    const result = validateFranceTravail(
      makeSession({
        financementType: "france_travail",
        ftDispositif: "csp",
      }),
    );
    expect(result.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateSousTraitant
// ─────────────────────────────────────────────────────────────────────────────

describe("validateSousTraitant", () => {
  it("retourne ok=true si statut != sous_traitant", () => {
    const result = validateSousTraitant({ statut: "salarie", sousTraitantVerifieAt: null });
    expect(result.ok).toBe(true);
  });

  it("retourne ok=false + gravite=critique si sous_traitant non vérifié", () => {
    const result = validateSousTraitant({
      statut: "sous_traitant",
      sousTraitantVerifieAt: null,
    });
    expect(result.ok).toBe(false);
    expect(result.gravite).toBe("critique");
  });

  it("retourne ok=true si sous_traitant + sousTraitantVerifieAt renseigné", () => {
    const result = validateSousTraitant({
      statut: "sous_traitant",
      sousTraitantVerifieAt: new Date(),
    });
    expect(result.ok).toBe(true);
  });

  it("l'alerte mentionne data.gouv.fr ou sous-traitant", () => {
    const result = validateSousTraitant({
      statut: "sous_traitant",
      sousTraitantVerifieAt: null,
    });
    expect(result.alerte).toMatch(/sous.traitant|data\.gouv/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateCpfEligibilite (T18 CLUSTER B)
// ─────────────────────────────────────────────────────────────────────────────

describe("validateCpfEligibilite", () => {
  it("retourne ok=true si financementType != cpf", () => {
    const result = validateCpfEligibilite(makeSession({ financementType: "direct" }), {
      cpfEligible: false,
    });
    expect(result.ok).toBe(true);
  });

  it("retourne ok=false + gravite=critique si cpf + cpfEligible=false", () => {
    const result = validateCpfEligibilite(makeSession({ financementType: "cpf" }), {
      cpfEligible: false,
    });
    expect(result.ok).toBe(false);
    expect(result.gravite).toBe("critique");
  });

  it("retourne ok=true si cpf + cpfEligible=true", () => {
    const result = validateCpfEligibilite(makeSession({ financementType: "cpf" }), {
      cpfEligible: true,
    });
    expect(result.ok).toBe(true);
  });

  it("l'alerte mentionne RS/RNCP ou CPF", () => {
    const result = validateCpfEligibilite(makeSession({ financementType: "cpf" }), {
      cpfEligible: false,
    });
    expect(result.alerte).toMatch(/CPF|RS\/RNCP|EDOF/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getFinancementValidations (wrapper DB)
// ─────────────────────────────────────────────────────────────────────────────

describe("getFinancementValidations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne [] en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const results = await getFinancementValidations("sess-any");
      expect(results).toEqual([]);
      expect(mockPrisma.trainingSession.findUniqueOrThrow).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });

  it("retourne 5 entrées (opco_accord, opco_tripartite, cpf_edof, cpf_eligibilite, france_travail)", async () => {
    mockPrisma.trainingSession.findUniqueOrThrow.mockResolvedValue({
      financementType: "direct",
      opcoStatut: "non_demande",
      opcoSubrogation: false,
      numeroDossierOpco: null,
      conventionTripartiteSigneeAt: null,
      edofVerifieAt: null,
      ftDispositif: null,
      ftAifPrescriptionDate: null,
      ftPoeiOffreEmploiNumero: null,
      ftPoeiAccordFinancementAt: null,
      ftPoeiEngagementSigneAt: null,
      statut: "planifiee",
      formation: { edofVerifieAt: null, cpfEligible: false },
    });
    const results = await getFinancementValidations("sess-uuid-1");
    expect(results).toHaveLength(5);
    const codes = results.map((r) => r.code);
    expect(codes).toContain("opco_accord");
    expect(codes).toContain("opco_tripartite");
    expect(codes).toContain("cpf_edof");
    expect(codes).toContain("cpf_eligibilite");
    expect(codes).toContain("france_travail");
  });

  it("retourne ok=true pour toutes les validations si financement direct sans alerte", async () => {
    mockPrisma.trainingSession.findUniqueOrThrow.mockResolvedValue({
      financementType: "direct",
      opcoStatut: "non_demande",
      opcoSubrogation: false,
      numeroDossierOpco: null,
      edofVerifieAt: null,
      ftDispositif: null,
      ftAifPrescriptionDate: null,
      ftPoeiOffreEmploiNumero: null,
      ftPoeiAccordFinancementAt: null,
      ftPoeiEngagementSigneAt: null,
      statut: "planifiee",
      formation: { edofVerifieAt: null, cpfEligible: false },
    });
    const results = await getFinancementValidations("sess-uuid-2");
    expect(results.every((r) => r.result.ok)).toBe(true);
  });

  it("retourne une entrée opco_accord=false si opco + non_demande + planifiee", async () => {
    mockPrisma.trainingSession.findUniqueOrThrow.mockResolvedValue({
      financementType: "opco",
      opcoStatut: "non_demande",
      opcoSubrogation: false,
      numeroDossierOpco: null,
      edofVerifieAt: null,
      ftDispositif: null,
      ftAifPrescriptionDate: null,
      ftPoeiOffreEmploiNumero: null,
      ftPoeiAccordFinancementAt: null,
      ftPoeiEngagementSigneAt: null,
      statut: "planifiee",
      formation: { edofVerifieAt: null, cpfEligible: false },
    });
    const results = await getFinancementValidations("sess-uuid-3");
    const opco = results.find((r) => r.code === "opco_accord")!;
    expect(opco.result.ok).toBe(false);
    expect(opco.result.gravite).toBe("critique");
  });

  it("retourne cpf_eligibilite=false + critique si cpf + cpfEligible=false", async () => {
    mockPrisma.trainingSession.findUniqueOrThrow.mockResolvedValue({
      financementType: "cpf",
      opcoStatut: "non_demande",
      opcoSubrogation: false,
      numeroDossierOpco: null,
      edofVerifieAt: new Date(),
      ftDispositif: null,
      ftAifPrescriptionDate: null,
      ftPoeiOffreEmploiNumero: null,
      ftPoeiAccordFinancementAt: null,
      ftPoeiEngagementSigneAt: null,
      statut: "planifiee",
      formation: { edofVerifieAt: new Date(), cpfEligible: false },
    });
    const results = await getFinancementValidations("sess-uuid-4");
    const cpfElig = results.find((r) => r.code === "cpf_eligibilite")!;
    expect(cpfElig.result.ok).toBe(false);
    expect(cpfElig.result.gravite).toBe("critique");
  });
});
