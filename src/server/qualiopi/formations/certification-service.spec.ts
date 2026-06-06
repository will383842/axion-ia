/**
 * Tests — certification-service.ts (T18 CLUSTER B).
 *
 * Stratégie :
 *   - computeCpfEligible : fonction pure, aucun mock nécessaire.
 *   - setCertification : mock @/lib/prisma (pattern validation-service.spec.ts).
 *
 * Couvre :
 *   - Toutes les combinaisons de conditions CPF (certificationType × code × edof).
 *   - Comportement stub.invalid.
 *   - setCertification : merge des champs + recalcul cpfEligible.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Prisma
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    formation: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { computeCpfEligible, setCertification } from "./certification-service";
import type { CertificationFields } from "./certification-service";

const mockPrisma = prisma as unknown as {
  formation: {
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeFields(overrides: Partial<CertificationFields> = {}): CertificationFields {
  return {
    certificationType: "rs",
    codeRncp: null,
    codeRs: "RS1234",
    blocsCompetences: [],
    edofVerifieAt: new Date("2026-01-01"),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeCpfEligible
// ─────────────────────────────────────────────────────────────────────────────

describe("computeCpfEligible", () => {
  it("retourne true si rs + codeRs + edofVerifieAt", () => {
    expect(computeCpfEligible(makeFields())).toBe(true);
  });

  it("retourne true si rncp + codeRncp + edofVerifieAt", () => {
    expect(
      computeCpfEligible(
        makeFields({ certificationType: "rncp", codeRncp: "RNCP5678", codeRs: null }),
      ),
    ).toBe(true);
  });

  it("retourne true si rs + blocsCompetences non vide + edofVerifieAt (sans code)", () => {
    expect(
      computeCpfEligible(makeFields({ codeRs: null, blocsCompetences: [{ libelle: "Bloc 1" }] })),
    ).toBe(true);
  });

  it("retourne false si certificationType = aucune", () => {
    expect(computeCpfEligible(makeFields({ certificationType: "aucune" }))).toBe(false);
  });

  it("retourne false si certificationType = rs mais aucun code ni bloc", () => {
    expect(
      computeCpfEligible(makeFields({ codeRs: null, codeRncp: null, blocsCompetences: [] })),
    ).toBe(false);
  });

  it("retourne false si certificationType = rs + code mais edofVerifieAt null", () => {
    expect(computeCpfEligible(makeFields({ edofVerifieAt: null }))).toBe(false);
  });

  it("retourne false si codeRs est une chaîne vide (après trim)", () => {
    expect(computeCpfEligible(makeFields({ codeRs: "  " }))).toBe(false);
  });

  it("retourne false si codeRncp est une chaîne vide (après trim)", () => {
    expect(
      computeCpfEligible(makeFields({ certificationType: "rncp", codeRncp: "   ", codeRs: null })),
    ).toBe(false);
  });

  it("retourne true si blocsCompetences est un objet non vide (Json Prisma)", () => {
    expect(
      computeCpfEligible(makeFields({ codeRs: null, blocsCompetences: { bc1: "Analyser" } })),
    ).toBe(true);
  });

  it("retourne false si blocsCompetences est un objet vide", () => {
    expect(computeCpfEligible(makeFields({ codeRs: null, blocsCompetences: {} }))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// setCertification
// ─────────────────────────────────────────────────────────────────────────────

describe("setCertification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne { id, cpfEligible: false } en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await setCertification({ formationId: "uuid-test" });
      expect(result).toEqual({ id: "uuid-test", cpfEligible: false });
      expect(mockPrisma.formation.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(mockPrisma.formation.update).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });

  it("met à jour la formation et recalcule cpfEligible=true si conditions réunies", async () => {
    mockPrisma.formation.findUniqueOrThrow.mockResolvedValue({
      certificationType: "aucune",
      codeRncp: null,
      codeRs: null,
      blocsCompetences: [],
      edofVerifieAt: new Date("2026-01-01"),
    });
    mockPrisma.formation.update.mockResolvedValue({});

    const result = await setCertification({
      formationId: "uuid-form-1",
      certificationType: "rs",
      codeRs: "RS9999",
    });

    expect(result.cpfEligible).toBe(true);
    expect(mockPrisma.formation.update).toHaveBeenCalledOnce();
  });

  it("recalcule cpfEligible=false si edofVerifieAt null en base", async () => {
    mockPrisma.formation.findUniqueOrThrow.mockResolvedValue({
      certificationType: "aucune",
      codeRncp: null,
      codeRs: null,
      blocsCompetences: [],
      edofVerifieAt: null,
    });
    mockPrisma.formation.update.mockResolvedValue({});

    const result = await setCertification({
      formationId: "uuid-form-2",
      certificationType: "rs",
      codeRs: "RS0001",
    });

    expect(result.cpfEligible).toBe(false);
  });

  it("préserve les champs courants non fournis dans l'input", async () => {
    mockPrisma.formation.findUniqueOrThrow.mockResolvedValue({
      certificationType: "rs",
      codeRncp: null,
      codeRs: "RS-EXISTING",
      blocsCompetences: [],
      edofVerifieAt: new Date("2026-01-15"),
    });
    mockPrisma.formation.update.mockResolvedValue({});

    // On ne fournit que le certificateur — le code existant doit rester
    const result = await setCertification({
      formationId: "uuid-form-3",
      certificateurNom: "France Compétences",
    });

    // rs + codeRs existant + edofVerifieAt → cpfEligible true
    expect(result.cpfEligible).toBe(true);
  });

  it("met cpfEligible=false dans les data passées à update", async () => {
    mockPrisma.formation.findUniqueOrThrow.mockResolvedValue({
      certificationType: "aucune",
      codeRncp: null,
      codeRs: null,
      blocsCompetences: [],
      edofVerifieAt: null,
    });
    mockPrisma.formation.update.mockResolvedValue({});

    await setCertification({ formationId: "uuid-form-4" });

    const firstCall = mockPrisma.formation.update.mock.calls[0];
    expect(firstCall).toBeDefined();

    const callArgs = firstCall![0] as { data: { cpfEligible: boolean } };
    expect(callArgs.data.cpfEligible).toBe(false);
  });
});
