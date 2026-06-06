/**
 * Tests — evaluations-service.ts (T9).
 *
 * Stratégie : mock @/lib/prisma + @/server/qualiopi/config/site-settings.
 * La logique pure (scoring.ts) n'est PAS mockée — elle est déjà couverte par
 * scoring.spec.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    evaluationAcquis: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(70),
}));

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import {
  createEvaluation,
  listEvaluationsForEnrollment,
  getFinaleReussite,
} from "./evaluations-service";

const mockPrisma = prisma as unknown as {
  evaluationAcquis: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
};

const mockGetConfig = getQualiopiConfig as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeCompetences(notes: Array<1 | 2 | 3 | undefined>) {
  return notes.map((note, i) => ({
    libelle: `Compétence ${i + 1}`,
    ...(note !== undefined ? { note } : {}),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// createEvaluation
// ─────────────────────────────────────────────────────────────────────────────

describe("createEvaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue(70);
    mockPrisma.evaluationAcquis.create.mockResolvedValue({ id: "eval-uuid-1" });
  });

  it("retourne l'id créé", async () => {
    const result = await createEvaluation({
      enrollmentId: "enroll-1",
      type: "finale",
      dateEvaluation: "2026-06-10",
      competences: makeCompetences([3, 3, 2]),
    });
    expect(result).toEqual({ id: "eval-uuid-1" });
  });

  it("calcule et insère score/niveau/réussite corrects (score 100 % → acquis + réussi)", async () => {
    await createEvaluation({
      enrollmentId: "enroll-2",
      type: "initiale",
      dateEvaluation: "2026-06-10",
      competences: makeCompetences([3, 3, 3]),
    });

    expect(mockPrisma.evaluationAcquis.create).toHaveBeenCalledOnce();
    const call = mockPrisma.evaluationAcquis.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data["scoreObtenu"]).toBe(9);
    expect(call.data["scoreMax"]).toBe(9);
    expect(call.data["scorePct"]).toBe(100);
    expect(call.data["niveauGlobal"]).toBe("acquis");
    expect(call.data["reussite"]).toBe(true);
  });

  it("calcule non_acquis + échec si toutes les notes absentes", async () => {
    await createEvaluation({
      enrollmentId: "enroll-3",
      type: "intermediaire",
      dateEvaluation: "2026-06-11",
      competences: makeCompetences([undefined, undefined]),
    });

    const call = mockPrisma.evaluationAcquis.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data["niveauGlobal"]).toBe("non_acquis");
    expect(call.data["reussite"]).toBe(false);
    expect(call.data["scorePct"]).toBe(0);
  });

  it("respecte le seuil de réussite issu de getQualiopiConfig", async () => {
    mockGetConfig.mockResolvedValue(80); // seuil plus élevé
    await createEvaluation({
      enrollmentId: "enroll-4",
      type: "finale",
      dateEvaluation: "2026-06-12",
      competences: makeCompetences([3, 3, 2]), // 8/9 = 89% → acquis
    });

    const call = mockPrisma.evaluationAcquis.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    // 8/9*100 = 89 → reussite true (seuil 80)
    expect(call.data["reussite"]).toBe(true);
  });

  it("n'inclut pas recommandations si absent (exactOptionalPropertyTypes)", async () => {
    await createEvaluation({
      enrollmentId: "enroll-5",
      type: "initiale",
      dateEvaluation: "2026-06-10",
      competences: makeCompetences([2]),
    });

    const call = mockPrisma.evaluationAcquis.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect("recommandations" in call.data).toBe(false);
  });

  it("inclut recommandations quand fourni", async () => {
    await createEvaluation({
      enrollmentId: "enroll-6",
      type: "finale",
      dateEvaluation: "2026-06-10",
      competences: makeCompetences([2]),
      recommandations: "Revoir module 3",
    });

    const call = mockPrisma.evaluationAcquis.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data["recommandations"]).toBe("Revoir module 3");
  });

  it("lève si DATABASE_URL contient stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(
        createEvaluation({
          enrollmentId: "any",
          type: "initiale",
          dateEvaluation: "2026-06-10",
          competences: [],
        }),
      ).rejects.toThrow();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listEvaluationsForEnrollment
// ─────────────────────────────────────────────────────────────────────────────

describe("listEvaluationsForEnrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.evaluationAcquis.findMany.mockResolvedValue([]);
  });

  it("appelle findMany avec le bon enrollmentId", async () => {
    await listEvaluationsForEnrollment("enroll-7");
    expect(mockPrisma.evaluationAcquis.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { enrollmentId: "enroll-7" } }),
    );
  });

  it("retourne les évaluations en tableau", async () => {
    const fakeEval = { id: "e1", enrollmentId: "enroll-7", type: "finale" };
    mockPrisma.evaluationAcquis.findMany.mockResolvedValue([fakeEval]);
    const result = await listEvaluationsForEnrollment("enroll-7");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "e1" });
  });

  it("retourne [] en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await listEvaluationsForEnrollment("any");
      expect(result).toEqual([]);
      expect(mockPrisma.evaluationAcquis.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getFinaleReussite
// ─────────────────────────────────────────────────────────────────────────────

describe("getFinaleReussite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne true si l'évaluation finale la plus récente est réussie", async () => {
    mockPrisma.evaluationAcquis.findFirst.mockResolvedValue({ reussite: true });
    const result = await getFinaleReussite("enroll-8");
    expect(result).toBe(true);
  });

  it("retourne false si l'évaluation finale est non réussie", async () => {
    mockPrisma.evaluationAcquis.findFirst.mockResolvedValue({ reussite: false });
    const result = await getFinaleReussite("enroll-8");
    expect(result).toBe(false);
  });

  it("retourne null si aucune évaluation finale n'existe", async () => {
    mockPrisma.evaluationAcquis.findFirst.mockResolvedValue(null);
    const result = await getFinaleReussite("enroll-9");
    expect(result).toBeNull();
  });

  it("filtre sur type finale et trie par date décroissante", async () => {
    mockPrisma.evaluationAcquis.findFirst.mockResolvedValue({ reussite: true });
    await getFinaleReussite("enroll-10");
    expect(mockPrisma.evaluationAcquis.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enrollmentId: "enroll-10", type: "finale" },
        orderBy: { dateEvaluation: "desc" },
      }),
    );
  });

  it("retourne null en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await getFinaleReussite("any");
      expect(result).toBeNull();
      expect(mockPrisma.evaluationAcquis.findFirst).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});
