/**
 * Tests — publierIndicateursAction (T17 CLUSTER 3 — off.1/2 Qualiopi).
 *
 * Stratégie :
 *   - Mock @/lib/prisma pour isoler la logique métier.
 *   - Mock @/server/actions/qualiopi/_guards pour simuler l'authentification.
 *   - Teste les cas nominaux + validations Zod + erreurs métier.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    formation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminPublish: vi.fn().mockResolvedValue({
    userId: "user-admin-uuid",
    role: "super_admin",
  }),
  requireAdminWrite: vi.fn().mockResolvedValue({
    userId: "user-admin-uuid",
    role: "super_admin",
  }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/formations/numbering", () => ({
  allocateFormationNumero: vi.fn().mockResolvedValue("F-2026-001"),
}));

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(0.3),
}));

import { prisma } from "@/lib/prisma";
import { publierIndicateursAction } from "./formations";

const mockPrisma = prisma as unknown as {
  formation: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const FORMATION_ID = "f1234567-89ab-cdef-0123-456789abcdef";

const INDICATEURS_VALIDES = [
  { libelle: "Taux de satisfaction", valeur: 92, unite: "%", annee: 2025 },
  { libelle: "Taux de réalisation", valeur: 88, unite: "%", annee: 2025 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tests publierIndicateursAction
// ─────────────────────────────────────────────────────────────────────────────

describe("publierIndicateursAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publie les indicateurs sur une formation existante", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue({
      id: FORMATION_ID,
      titre: "Formation IA Opérationnelle",
    });
    mockPrisma.formation.update.mockResolvedValue({
      id: FORMATION_ID,
      indicateursPublies: INDICATEURS_VALIDES,
      methodeCalculIndicateurs: "Calcul sur la base des questionnaires de satisfaction.",
      indicateursPubliesAt: new Date("2026-06-06T10:00:00Z"),
    });

    const result = await publierIndicateursAction({
      formationId: FORMATION_ID,
      indicateurs: INDICATEURS_VALIDES,
      methodeCalcul: "Calcul sur la base des questionnaires de satisfaction.",
    });

    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.id).toBe(FORMATION_ID);
      expect(result.data.indicateursPubliesAt).toBeInstanceOf(Date);
    }
  });

  it("appelle prisma.formation.update avec les champs corrects", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue({
      id: FORMATION_ID,
      titre: "Formation test",
    });
    mockPrisma.formation.update.mockResolvedValue({ id: FORMATION_ID });

    await publierIndicateursAction({
      formationId: FORMATION_ID,
      indicateurs: INDICATEURS_VALIDES,
      methodeCalcul: "Méthode de calcul détaillée.",
    });

    expect(mockPrisma.formation.update).toHaveBeenCalledOnce();
    const rawCall = mockPrisma.formation.update.mock.calls[0];
    expect(rawCall).toBeDefined();
    const updateCall = rawCall![0] as {
      where: { id: string };
      data: {
        indicateursPublies: unknown;
        methodeCalculIndicateurs: string;
        indicateursPubliesAt: Date;
      };
    };
    expect(updateCall.where.id).toBe(FORMATION_ID);
    expect(updateCall.data.indicateursPublies).toEqual(INDICATEURS_VALIDES);
    expect(updateCall.data.methodeCalculIndicateurs).toBe("Méthode de calcul détaillée.");
    expect(updateCall.data.indicateursPubliesAt).toBeInstanceOf(Date);
  });

  it("retourne une erreur si formationId est invalide (non-UUID)", async () => {
    const result = await publierIndicateursAction({
      formationId: "not-a-uuid",
      indicateurs: INDICATEURS_VALIDES,
      methodeCalcul: "Test.",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Données invalides");
    }
    expect(mockPrisma.formation.findUnique).not.toHaveBeenCalled();
  });

  it("retourne une erreur si indicateurs est vide", async () => {
    const result = await publierIndicateursAction({
      formationId: FORMATION_ID,
      indicateurs: [],
      methodeCalcul: "Test.",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Données invalides");
    }
  });

  it("retourne une erreur si methodeCalcul est vide", async () => {
    const result = await publierIndicateursAction({
      formationId: FORMATION_ID,
      indicateurs: INDICATEURS_VALIDES,
      methodeCalcul: "",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Données invalides");
    }
  });

  it("retourne une erreur si la formation est introuvable", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue(null);

    const result = await publierIndicateursAction({
      formationId: FORMATION_ID,
      indicateurs: INDICATEURS_VALIDES,
      methodeCalcul: "Méthode de calcul.",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Formation introuvable");
    }
    expect(mockPrisma.formation.update).not.toHaveBeenCalled();
  });

  it("accepte jusqu'à 20 indicateurs", async () => {
    mockPrisma.formation.findUnique.mockResolvedValue({
      id: FORMATION_ID,
      titre: "Formation test",
    });
    mockPrisma.formation.update.mockResolvedValue({ id: FORMATION_ID });

    const vingtIndicateurs = Array.from({ length: 20 }, (_, i) => ({
      libelle: `Indicateur ${i + 1}`,
      valeur: 80 + i,
      unite: "%",
      annee: 2025,
    }));

    const result = await publierIndicateursAction({
      formationId: FORMATION_ID,
      indicateurs: vingtIndicateurs,
      methodeCalcul: "Méthode.",
    });

    expect("data" in result).toBe(true);
  });

  it("refuse plus de 20 indicateurs", async () => {
    const tropDIndicateurs = Array.from({ length: 21 }, (_, i) => ({
      libelle: `Indicateur ${i + 1}`,
      valeur: 80,
      unite: "%",
      annee: 2025,
    }));

    const result = await publierIndicateursAction({
      formationId: FORMATION_ID,
      indicateurs: tropDIndicateurs,
      methodeCalcul: "Méthode.",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Données invalides");
    }
  });
});
