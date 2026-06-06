/**
 * Tests — presence-service (T8).
 *
 * Stratégie : tester la logique de `recomputeTauxPresence` et `upsertCreneau`
 * en mockant `@/lib/prisma` et `@/server/qualiopi/config/site-settings`.
 *
 * La logique pure (computeTauxPresence) est testée dans taux.spec.ts (AGENT A).
 * Ici on vérifie l'orchestration : lecture créneaux → calcul → mise à jour DB.
 */

import { describe, it, expect, vi, beforeEach, assert } from "vitest";

/** Accès sûr à un appel de mock (lève si absent). */
function mockCall<T>(fn: ReturnType<typeof vi.fn>, callIndex = 0): T {
  const call = fn.mock.calls[callIndex];
  assert(call !== undefined, `mockCall: aucun appel à l'index ${callIndex}`);
  return call[0] as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    presenceCreneau: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    enrollment: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(80),
}));

// Mock des dépendances logique pure AGENT A (taux.ts).
vi.mock("./taux", () => ({
  computeTauxPresence: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { computeTauxPresence } from "./taux";
import { recomputeTauxPresence, upsertCreneau } from "./presence-service";

const mockPrisma = prisma as unknown as {
  presenceCreneau: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  enrollment: {
    update: ReturnType<typeof vi.fn>;
  };
};

const mockComputeTauxPresence = computeTauxPresence as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeCreneaux(items: Array<{ id: string; prevue: number; realisee: number }>) {
  return items.map((c) => ({
    id: c.id,
    dureePrevueMinutes: c.prevue,
    dureeRealiseeMinutes: c.realisee,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// recomputeTauxPresence
// ─────────────────────────────────────────────────────────────────────────────

describe("recomputeTauxPresence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Valeur par défaut : taux retourné par computeTauxPresence
    mockComputeTauxPresence.mockReturnValue({
      tauxPct: 75,
      minutesPrevues: 420,
      minutesRealisees: 315,
    });
    mockPrisma.presenceCreneau.update.mockResolvedValue({});
    mockPrisma.enrollment.update.mockResolvedValue({});
  });

  it("met à jour tauxPresencePct avec le résultat de computeTauxPresence", async () => {
    mockPrisma.presenceCreneau.findMany.mockResolvedValue(
      makeCreneaux([
        { id: "c1", prevue: 210, realisee: 210 },
        { id: "c2", prevue: 210, realisee: 105 },
      ]),
    );

    const taux = await recomputeTauxPresence("enrollment-1");

    expect(taux).toBe(75);
    expect(mockPrisma.enrollment.update).toHaveBeenCalledWith({
      where: { id: "enrollment-1" },
      data: { tauxPresencePct: 75 },
    });
  });

  it("retourne 0 et met tauxPresencePct=0 si aucun créneau", async () => {
    mockPrisma.presenceCreneau.findMany.mockResolvedValue([]);
    mockComputeTauxPresence.mockReturnValue({ tauxPct: 0, minutesPrevues: 0, minutesRealisees: 0 });

    const taux = await recomputeTauxPresence("enrollment-vide");

    expect(taux).toBe(0);
    expect(mockPrisma.enrollment.update).toHaveBeenCalledWith({
      where: { id: "enrollment-vide" },
      data: { tauxPresencePct: 0 },
    });
  });

  it("marque present=true si réalisé ≥ 50% du prévu (seuil 0.5)", async () => {
    mockPrisma.presenceCreneau.findMany.mockResolvedValue(
      makeCreneaux([
        { id: "c1", prevue: 210, realisee: 105 }, // exactement 50% → present=true
        { id: "c2", prevue: 210, realisee: 104 }, // < 50% → present=false
        { id: "c3", prevue: 210, realisee: 210 }, // 100% → present=true
      ]),
    );
    mockComputeTauxPresence.mockReturnValue({
      tauxPct: 66,
      minutesPrevues: 630,
      minutesRealisees: 419,
    });

    await recomputeTauxPresence("enrollment-2");

    // Vérifie les flags de présence par créneau
    const updateCalls = mockPrisma.presenceCreneau.update.mock.calls;
    expect(updateCalls).toHaveLength(3);

    const c1Update = updateCalls.find(
      (c: unknown[]) => (c[0] as { where: { id: string } }).where.id === "c1",
    );
    const c2Update = updateCalls.find(
      (c: unknown[]) => (c[0] as { where: { id: string } }).where.id === "c2",
    );
    const c3Update = updateCalls.find(
      (c: unknown[]) => (c[0] as { where: { id: string } }).where.id === "c3",
    );

    expect(c1Update).toBeDefined();
    expect(c2Update).toBeDefined();
    expect(c3Update).toBeDefined();
    expect((c1Update![0] as { data: { present: boolean } }).data.present).toBe(true);
    expect((c2Update![0] as { data: { present: boolean } }).data.present).toBe(false);
    expect((c3Update![0] as { data: { present: boolean } }).data.present).toBe(true);
  });

  it("ne marque pas present si dureePrevue = 0", async () => {
    mockPrisma.presenceCreneau.findMany.mockResolvedValue(
      makeCreneaux([{ id: "c-zero", prevue: 0, realisee: 0 }]),
    );
    mockComputeTauxPresence.mockReturnValue({ tauxPct: 0, minutesPrevues: 0, minutesRealisees: 0 });

    await recomputeTauxPresence("enrollment-3");

    const updateCalls = mockPrisma.presenceCreneau.update.mock.calls;
    const cUpdate = updateCalls.find(
      (c: unknown[]) => (c[0] as { where: { id: string } }).where.id === "c-zero",
    );
    expect(cUpdate).toBeDefined();
    expect((cUpdate![0] as { data: { present: boolean } }).data.present).toBe(false);
  });

  it("retourne 0 en mode stub.invalid (sans accès DB)", async () => {
    const originalUrl = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";

    const taux = await recomputeTauxPresence("any-id");
    expect(taux).toBe(0);
    expect(mockPrisma.presenceCreneau.findMany).not.toHaveBeenCalled();

    process.env["DATABASE_URL"] = originalUrl;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// upsertCreneau
// ─────────────────────────────────────────────────────────────────────────────

describe("upsertCreneau", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.presenceCreneau.upsert.mockResolvedValue({ id: "new-creneau-id" });
  });

  it("appelle prisma.presenceCreneau.upsert avec les bons champs", async () => {
    const date = new Date("2026-06-10T00:00:00.000Z");
    await upsertCreneau({
      enrollmentId: "enroll-1",
      date,
      demiJournee: "matin",
      libelle: "2026-06-10 matin",
      dureePrevueMinutes: 210,
      source: "emargement_presentiel",
      present: true,
      dureeRealiseeMinutes: 180,
    });

    expect(mockPrisma.presenceCreneau.upsert).toHaveBeenCalledOnce();
    const call = mockCall<{
      where: { enrollmentId_date_demiJournee: Record<string, unknown> };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }>(mockPrisma.presenceCreneau.upsert);
    expect(call.where.enrollmentId_date_demiJournee).toMatchObject({
      enrollmentId: "enroll-1",
      date,
      demiJournee: "matin",
    });
    expect(call.create).toMatchObject({
      enrollmentId: "enroll-1",
      libelle: "2026-06-10 matin",
      dureePrevueMinutes: 210,
      dureeRealiseeMinutes: 180,
      present: true,
      source: "emargement_presentiel",
    });
  });

  it("retourne l'id créé/mis à jour", async () => {
    mockPrisma.presenceCreneau.upsert.mockResolvedValue({ id: "creneau-42" });
    const id = await upsertCreneau({
      enrollmentId: "enroll-2",
      date: new Date("2026-06-11T00:00:00.000Z"),
      demiJournee: "apres_midi",
      libelle: "2026-06-11 après-midi",
      dureePrevueMinutes: 210,
      source: "emargement_presentiel",
    });
    expect(id).toBe("creneau-42");
  });

  it("retourne 'stub-id' en mode stub.invalid", async () => {
    const originalUrl = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";

    const id = await upsertCreneau({
      enrollmentId: "enroll-stub",
      date: new Date(),
      demiJournee: "journee",
      libelle: "stub journée",
      dureePrevueMinutes: 420,
      source: "import_zoom",
    });

    expect(id).toBe("stub-id");
    expect(mockPrisma.presenceCreneau.upsert).not.toHaveBeenCalled();

    process.env["DATABASE_URL"] = originalUrl;
  });

  it("ne passe pas les champs optionnels undefined dans la requête (exactOptionalPropertyTypes)", async () => {
    await upsertCreneau({
      enrollmentId: "enroll-3",
      date: new Date("2026-06-12T00:00:00.000Z"),
      demiJournee: "matin",
      libelle: "2026-06-12 matin",
      dureePrevueMinutes: 210,
      source: "emargement_presentiel",
      // heureConnexion, heureDeconnexion, importId, commentaire : absents
    });

    const call = mockCall<{ create: Record<string, unknown> }>(mockPrisma.presenceCreneau.upsert);
    // Les clés ne doivent PAS apparaître dans create/update
    expect("heureConnexion" in call.create).toBe(false);
    expect("heureDeconnexion" in call.create).toBe(false);
    expect("importId" in call.create).toBe(false);
    expect("commentaire" in call.create).toBe(false);
  });

  it("passe les champs optionnels quand ils sont fournis", async () => {
    const connexion = new Date("2026-06-10T08:02:00.000Z");
    const deconnexion = new Date("2026-06-10T17:05:00.000Z");
    await upsertCreneau({
      enrollmentId: "enroll-4",
      date: new Date("2026-06-10T00:00:00.000Z"),
      demiJournee: "journee",
      libelle: "2026-06-10 journée",
      dureePrevueMinutes: 420,
      source: "import_zoom",
      heureConnexion: connexion,
      heureDeconnexion: deconnexion,
      importId: "import-abc",
      commentaire: "connexion stable",
    });

    const call = mockCall<{ create: Record<string, unknown> }>(mockPrisma.presenceCreneau.upsert);
    expect(call.create["heureConnexion"]).toBe(connexion);
    expect(call.create["heureDeconnexion"]).toBe(deconnexion);
    expect(call.create["importId"]).toBe("import-abc");
    expect(call.create["commentaire"]).toBe("connexion stable");
  });
});
