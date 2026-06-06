/**
 * Tests — indicateurs/service.ts (T10 — AGENT A).
 *
 * Stratégie : mock @/lib/prisma + @/lib/redis + @/server/qualiopi/config/site-settings.
 * Les fonctions pures (calcul.ts) NE sont PAS mockées.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    questionnaire: { findMany: vi.fn() },
    evaluationAcquis: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(80),
}));

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { getIndicateurs, invalidateIndicateursCache } from "./service";

const mockPrisma = prisma as unknown as {
  questionnaire: { findMany: ReturnType<typeof vi.fn> };
  evaluationAcquis: { findMany: ReturnType<typeof vi.fn> };
  enrollment: { findMany: ReturnType<typeof vi.fn> };
};

const mockRedis = redis as unknown as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  keys: ReturnType<typeof vi.fn>;
};

const mockGetConfig = getQualiopiConfig as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// getIndicateurs
// ─────────────────────────────────────────────────────────────────────────────

describe("getIndicateurs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
    mockRedis.keys.mockResolvedValue([]);
    mockGetConfig.mockResolvedValue(80);
    mockPrisma.questionnaire.findMany.mockResolvedValue([]);
    mockPrisma.evaluationAcquis.findMany.mockResolvedValue([]);
    mockPrisma.enrollment.findMany.mockResolvedValue([]);
  });

  it("retourne une structure IndicateursResult valide", async () => {
    const result = await getIndicateurs(2026);

    expect(result).toMatchObject({
      annee: 2026,
      tauxSatisfaction: expect.objectContaining({ tauxPct: 0, nb: 0, fiable: false }),
      tauxReussite: expect.objectContaining({ tauxPct: 0, nb: 0, fiable: false }),
      tauxCompletion: expect.objectContaining({ tauxPct: 0, nb: 0, fiable: false }),
      delaiAccesMoyen: expect.objectContaining({ jours: 0, nb: 0 }),
      methodes: expect.objectContaining({
        satisfaction: expect.any(String),
        reussite: expect.any(String),
        completion: expect.any(String),
        delaiAcces: expect.any(String),
      }),
      calculeAt: expect.any(Date),
    });
  });

  it("retourne des valeurs calculées depuis les données Prisma", async () => {
    // 5 notes de satisfaction
    mockPrisma.questionnaire.findMany.mockResolvedValue([
      { noteGlobale: 5 },
      { noteGlobale: 4 },
      { noteGlobale: 5 },
      { noteGlobale: 4 },
      { noteGlobale: 5 },
    ]);
    // 5 évaluations finales avec niveau acquis
    mockPrisma.evaluationAcquis.findMany.mockResolvedValue([
      { niveauGlobal: "acquis" },
      { niveauGlobal: "acquis" },
      { niveauGlobal: "acquis" },
      { niveauGlobal: "acquis" },
      { niveauGlobal: "acquis" },
    ]);
    // 5 enrollments avec taux de présence >= 80
    const base = new Date("2026-01-01T00:00:00.000Z");
    const debut = new Date("2026-02-01T00:00:00.000Z");
    mockPrisma.enrollment.findMany.mockResolvedValue([
      { tauxPresencePct: 90, createdAt: base, session: { dateDebut: debut } },
      { tauxPresencePct: 85, createdAt: base, session: { dateDebut: debut } },
      { tauxPresencePct: 80, createdAt: base, session: { dateDebut: debut } },
      { tauxPresencePct: 95, createdAt: base, session: { dateDebut: debut } },
      { tauxPresencePct: 100, createdAt: base, session: { dateDebut: debut } },
    ]);

    const result = await getIndicateurs(2026);

    // AVG([5,4,5,4,5]) = 4.6 → 4.6/5*100 = 92 %
    expect(result.tauxSatisfaction.tauxPct).toBe(92);
    expect(result.tauxSatisfaction.fiable).toBe(true);
    // 100 % réussite
    expect(result.tauxReussite.tauxPct).toBe(100);
    expect(result.tauxReussite.fiable).toBe(true);
    // 100 % complétion (tous >= 80)
    expect(result.tauxCompletion.tauxPct).toBe(100);
    expect(result.tauxCompletion.fiable).toBe(true);
  });

  it("lit depuis le cache Redis si disponible", async () => {
    const cachedResult = {
      annee: 2026,
      tauxSatisfaction: { tauxPct: 75, nb: 10, fiable: true, libelle: "75 %" },
      tauxReussite: { tauxPct: 80, nb: 10, fiable: true, libelle: "80 %" },
      tauxCompletion: { tauxPct: 90, nb: 10, fiable: true, libelle: "90 %" },
      delaiAccesMoyen: { jours: 14, nb: 10 },
      methodes: { satisfaction: "...", reussite: "...", completion: "...", delaiAcces: "..." },
      calculeAt: new Date("2026-06-06T10:00:00.000Z").toISOString(),
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));

    const result = await getIndicateurs(2026);

    expect(result.tauxSatisfaction.tauxPct).toBe(75);
    // Ne doit pas appeler Prisma
    expect(mockPrisma.questionnaire.findMany).not.toHaveBeenCalled();
  });

  it("écrit dans le cache Redis après calcul", async () => {
    await getIndicateurs(2026);

    expect(mockRedis.set).toHaveBeenCalledWith(
      "qualiopi:indicateurs:2026:all",
      expect.any(String),
      "EX",
      3600,
    );
  });

  it("utilise la clé avec formationId si fourni", async () => {
    await getIndicateurs(2026, "formation-uuid-123");

    expect(mockRedis.get).toHaveBeenCalledWith("qualiopi:indicateurs:2026:formation-uuid-123");
    expect(mockRedis.set).toHaveBeenCalledWith(
      "qualiopi:indicateurs:2026:formation-uuid-123",
      expect.any(String),
      "EX",
      3600,
    );
  });

  it("retourne résultat vide en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await getIndicateurs(2026);
      expect(result.tauxSatisfaction.nb).toBe(0);
      expect(result.tauxReussite.nb).toBe(0);
      expect(mockPrisma.questionnaire.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });

  it("inclut la méthode de calcul satisfaction avec nb évaluations et période", async () => {
    mockPrisma.questionnaire.findMany.mockResolvedValue([
      { noteGlobale: 5 },
      { noteGlobale: 4 },
      { noteGlobale: 3 },
    ]);

    const result = await getIndicateurs(2026);

    expect(result.methodes.satisfaction).toContain("01/01/2026");
    expect(result.methodes.satisfaction).toContain("31/12/2026");
    expect(result.methodes.satisfaction).toContain("3 évaluations");
  });

  it("utilise le seuil de présence de getQualiopiConfig", async () => {
    mockGetConfig.mockResolvedValue(70);
    mockPrisma.enrollment.findMany.mockResolvedValue([
      {
        tauxPresencePct: 70,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        session: { dateDebut: new Date("2026-02-01T00:00:00.000Z") },
      },
      {
        tauxPresencePct: 69,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        session: { dateDebut: new Date("2026-02-01T00:00:00.000Z") },
      },
    ]);

    const result = await getIndicateurs(2026);
    // Avec seuil 70 : 70 >= 70 = 1/2 = 50%
    expect(result.tauxCompletion.tauxPct).toBe(50);
    expect(result.methodes.completion).toContain("70");
  });

  it("fail-soft si Redis en erreur (pas de blocage)", async () => {
    mockRedis.get.mockRejectedValue(new Error("Redis down"));
    mockRedis.set.mockRejectedValue(new Error("Redis down"));

    // Ne doit pas lever
    await expect(getIndicateurs(2026)).resolves.toBeDefined();
    // Doit quand même appeler Prisma
    expect(mockPrisma.questionnaire.findMany).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// invalidateIndicateursCache
// ─────────────────────────────────────────────────────────────────────────────

describe("invalidateIndicateursCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.keys.mockResolvedValue([]);
    mockRedis.del.mockResolvedValue(1);
  });

  it("invalide les clés d'une année spécifique", async () => {
    mockRedis.keys.mockResolvedValue([
      "qualiopi:indicateurs:2026:all",
      "qualiopi:indicateurs:2026:formation-xyz",
    ]);

    await invalidateIndicateursCache(2026);

    expect(mockRedis.keys).toHaveBeenCalledWith("qualiopi:indicateurs:2026:*");
    expect(mockRedis.del).toHaveBeenCalledWith(
      "qualiopi:indicateurs:2026:all",
      "qualiopi:indicateurs:2026:formation-xyz",
    );
  });

  it("invalide toutes les clés si aucune année fournie", async () => {
    mockRedis.keys.mockResolvedValue(["qualiopi:indicateurs:2025:all"]);

    await invalidateIndicateursCache();

    expect(mockRedis.keys).toHaveBeenCalledWith("qualiopi:indicateurs:*");
  });

  it("ne tente pas del si aucune clé trouvée", async () => {
    mockRedis.keys.mockResolvedValue([]);

    await invalidateIndicateursCache(2026);

    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  it("fail-soft si Redis en erreur", async () => {
    mockRedis.keys.mockRejectedValue(new Error("Redis down"));

    await expect(invalidateIndicateursCache(2026)).resolves.toBeUndefined();
  });
});
