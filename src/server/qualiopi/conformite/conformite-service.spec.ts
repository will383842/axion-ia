/**
 * Tests — conformite-service.ts (T12 — AGENT B).
 *
 * Stratégie : mock @/lib/prisma.
 * Vérifie la structure du résultat, le calcul du score (couverts/applicables),
 * le comportement stub.invalid, et que les 32 indicateurs sont présents.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    formation: { count: vi.fn(), findMany: vi.fn() },
    trainingSession: { count: vi.fn() },
    evaluationAcquis: { count: vi.fn() },
    questionnaire: { count: vi.fn() },
    reclamation: { count: vi.fn() },
    veille: { count: vi.fn() },
    partenariat: { count: vi.fn() },
    sousTraitant: { count: vi.fn() },
    trainer: { count: vi.fn() },
    trainee: { count: vi.fn() },
    enrollment: { count: vi.fn() },
    documentGenere: { count: vi.fn() },
    revueDirection: { count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { evaluerConformite } from "./conformite-service";

type MockPrisma = {
  formation: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  trainingSession: { count: ReturnType<typeof vi.fn> };
  evaluationAcquis: { count: ReturnType<typeof vi.fn> };
  questionnaire: { count: ReturnType<typeof vi.fn> };
  reclamation: { count: ReturnType<typeof vi.fn> };
  veille: { count: ReturnType<typeof vi.fn> };
  partenariat: { count: ReturnType<typeof vi.fn> };
  sousTraitant: { count: ReturnType<typeof vi.fn> };
  trainer: { count: ReturnType<typeof vi.fn> };
  trainee: { count: ReturnType<typeof vi.fn> };
  enrollment: { count: ReturnType<typeof vi.fn> };
  documentGenere: { count: ReturnType<typeof vi.fn> };
  revueDirection: { count: ReturnType<typeof vi.fn> };
};

const mockP = prisma as unknown as MockPrisma;

// ─────────────────────────────────────────────────────────────────────────────
// Setup de base : toutes les tables vides
// ─────────────────────────────────────────────────────────────────────────────

function setupEmpty() {
  vi.clearAllMocks();
  mockP.formation.count.mockResolvedValue(0);
  mockP.formation.findMany.mockResolvedValue([]);
  mockP.trainingSession.count.mockResolvedValue(0);
  mockP.evaluationAcquis.count.mockResolvedValue(0);
  mockP.questionnaire.count.mockResolvedValue(0);
  mockP.reclamation.count.mockResolvedValue(0);
  mockP.veille.count.mockResolvedValue(0);
  mockP.partenariat.count.mockResolvedValue(0);
  mockP.sousTraitant.count.mockResolvedValue(0);
  mockP.trainer.count.mockResolvedValue(0);
  mockP.trainee.count.mockResolvedValue(0);
  mockP.enrollment.count.mockResolvedValue(0);
  mockP.documentGenere.count.mockResolvedValue(0);
  mockP.revueDirection.count.mockResolvedValue(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerConformite", () => {
  beforeEach(setupEmpty);

  it("retourne exactement 32 indicateurs", async () => {
    const result = await evaluerConformite();
    expect(result.indicateurs).toHaveLength(32);
  });

  it("tous les numéros de 1 à 32 sont présents", async () => {
    const result = await evaluerConformite();
    const nums = result.indicateurs.map((i) => i.numero).sort((a, b) => a - b);
    for (let n = 1; n <= 32; n++) {
      expect(nums[n - 1]).toBe(n);
    }
  });

  it("DB vide → score 0 %, nbCouverts 0", async () => {
    const result = await evaluerConformite();
    expect(result.nbCouverts).toBe(0);
    expect(result.scorePct).toBe(0);
  });

  it("score = couverts / applicables × 100 (JAMAIS /22)", async () => {
    // Quelques formations + sessions → couvre plusieurs indicateurs TC
    mockP.formation.count.mockResolvedValue(3);
    mockP.formation.findMany.mockResolvedValue([]);
    mockP.trainingSession.count.mockResolvedValue(2);
    mockP.trainer.count.mockResolvedValue(2);
    mockP.documentGenere.count.mockResolvedValue(5);

    const result = await evaluerConformite();
    // Vérifier que le score n'est pas /22 mais /applicables
    if (result.nbApplicables > 0) {
      expect(result.scorePct).toBe(Math.round((result.nbCouverts / result.nbApplicables) * 100));
    }
  });

  it("les conditionnels APP (13,14,15) sont non_applicable pour une action classique", async () => {
    // formation.findMany retourne une formation classique sans alternance_afest
    mockP.formation.findMany.mockResolvedValue([{ typesActionQualiopi: ["classique"] }]);

    const result = await evaluerConformite();
    const appIndicateurs = result.indicateurs.filter((i) => [13, 14, 15].includes(i.numero));
    for (const ind of appIndicateurs) {
      expect(ind.statut, `off.${ind.numero} doit être non_applicable`).toBe("non_applicable");
    }
  });

  it("off.31 couvert si au moins 1 réclamation existe", async () => {
    mockP.reclamation.count.mockResolvedValue(2);
    const result = await evaluerConformite();
    const ind31 = result.indicateurs.find((i) => i.numero === 31);
    expect(ind31?.statut).toBe("couvert");
  });

  it("off.31 a_completer si 0 réclamation", async () => {
    const result = await evaluerConformite();
    const ind31 = result.indicateurs.find((i) => i.numero === 31);
    expect(ind31?.statut).toBe("a_completer");
  });

  it("off.11 couvert si au moins 1 évaluation finale existe", async () => {
    // évaluationsFinales > 0 : count avec type=finale
    mockP.evaluationAcquis.count.mockResolvedValue(3);
    const result = await evaluerConformite();
    const ind11 = result.indicateurs.find((i) => i.numero === 11);
    expect(ind11?.statut).toBe("couvert");
  });

  it("off.23 couvert si au moins 1 veille legale existe", async () => {
    mockP.veille.count.mockResolvedValue(1);
    const result = await evaluerConformite();
    const ind23 = result.indicateurs.find((i) => i.numero === 23);
    expect(ind23?.statut).toBe("couvert");
  });

  it("chaque indicateur a un libelle non vide", async () => {
    const result = await evaluerConformite();
    for (const ind of result.indicateurs) {
      expect(ind.libelle.trim().length, `off.${ind.numero}`).toBeGreaterThan(0);
    }
  });

  it("chaque indicateur a un critere dans [1..7]", async () => {
    const result = await evaluerConformite();
    for (const ind of result.indicateurs) {
      expect(ind.critere).toBeGreaterThanOrEqual(1);
      expect(ind.critere).toBeLessThanOrEqual(7);
    }
  });

  it("nbApplicables ≤ 32", async () => {
    const result = await evaluerConformite();
    expect(result.nbApplicables).toBeLessThanOrEqual(32);
  });

  it("nbCouverts ≤ nbApplicables", async () => {
    mockP.formation.count.mockResolvedValue(5);
    const result = await evaluerConformite();
    expect(result.nbCouverts).toBeLessThanOrEqual(result.nbApplicables);
  });

  it("retourne résultat vide en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await evaluerConformite();
      expect(result.nbCouverts).toBe(0);
      expect(result.scorePct).toBe(0);
      expect(result.indicateurs).toHaveLength(32);
      // En mode stub, aucun mock prisma ne doit être appelé
      expect(mockP.formation.count).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});
