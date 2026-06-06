/**
 * Tests — pilotage-service.ts (T12 — AGENT B).
 *
 * Stratégie : mock @/lib/prisma, @/lib/redis,
 *   @/server/qualiopi/indicateurs/service, @/server/qualiopi/bpf/service.
 * Vérifie la structure PilotageResult (14 métriques), le cache Redis,
 * et le comportement stub.invalid.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { count: vi.fn() },
    enrollment: { count: vi.fn() },
    reclamation: { count: vi.fn() },
    sousTraitant: { count: vi.fn() },
    documentGenere: { count: vi.fn() },
    trainer: { count: vi.fn() },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
  },
}));

vi.mock("@/server/qualiopi/indicateurs/service", () => ({
  getIndicateurs: vi.fn().mockResolvedValue({
    annee: 2026,
    tauxSatisfaction: { tauxPct: 88, nb: 10, fiable: true, libelle: "88 %" },
    tauxReussite: { tauxPct: 75, nb: 8, fiable: true, libelle: "75 %" },
    tauxCompletion: { tauxPct: 95, nb: 10, fiable: true, libelle: "95 %" },
    delaiAccesMoyen: { jours: 7, nb: 10 },
    methodes: { satisfaction: "", reussite: "", completion: "", delaiAcces: "" },
    calculeAt: new Date(),
  }),
}));

vi.mock("@/server/qualiopi/bpf/service", () => ({
  computeBpf: vi.fn().mockResolvedValue({
    annee: 2026,
    organisme: { raisonSociale: "Axion-IA SAS", nda: "99999999999", siret: "00000000000000" },
    nbSessions: 5,
    nbStagiairesDistincts: 25,
    nbHeuresStagiaires: 200,
    caTotalHtCents: 1000000,
    caParFinanceur: { opco: 0, cpf: 0, france_travail: 0, direct: 1000000, mixte: 0 },
    nbFormateursInternes: 2,
    nbFormateursExternes: 1,
    calculeAt: new Date(),
  }),
}));

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getPilotage } from "./pilotage-service";

type MockPrisma = {
  trainingSession: { count: ReturnType<typeof vi.fn> };
  enrollment: { count: ReturnType<typeof vi.fn> };
  reclamation: { count: ReturnType<typeof vi.fn> };
  sousTraitant: { count: ReturnType<typeof vi.fn> };
  documentGenere: { count: ReturnType<typeof vi.fn> };
  trainer: { count: ReturnType<typeof vi.fn> };
};

const mockP = prisma as unknown as MockPrisma;
const mockRedis = redis as unknown as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

function setupCounts() {
  mockP.trainingSession.count.mockResolvedValue(5);
  mockP.enrollment.count.mockResolvedValue(25);
  mockP.reclamation.count.mockResolvedValue(2);
  mockP.sousTraitant.count.mockResolvedValue(1);
  mockP.documentGenere.count.mockResolvedValue(10);
  mockP.trainer.count.mockResolvedValue(3);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("getPilotage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
    setupCounts();
  });

  it("retourne un PilotageResult avec les 14 métriques", async () => {
    const result = await getPilotage(2026);

    expect(result.annee).toBe(2026);
    expect(result.m1_prestations).toBeDefined();
    expect(result.m2_taux_entree_delai).toBeDefined();
    expect(result.m3_taux_completion).toBeDefined();
    expect(result.m4_taux_abandon).toBeDefined();
    expect(result.m5_taux_reussite).toBeDefined();
    expect(result.m6_satisfaction).toBeDefined();
    expect(result.m7_incidents).toBeDefined();
    expect(result.m8_reclamations).toBeDefined();
    expect(result.m9_actions_correctives).toBeDefined();
    expect(result.m10_maj_documentaire).toBeDefined();
    expect(result.m11_formateurs_a_jour).toBeDefined();
    expect(result.m12_adaptations_handicap).toBeDefined();
    expect(result.m13_sous_traitances_evaluees).toBeDefined();
    expect(result.m14_conformite_dossiers).toBeDefined();
    expect(result.calculeAt).toBeInstanceOf(Date);
  });

  it("chaque métrique a un libelle non vide", async () => {
    const result = await getPilotage(2026);
    const metriques = [
      result.m1_prestations,
      result.m2_taux_entree_delai,
      result.m3_taux_completion,
      result.m4_taux_abandon,
      result.m5_taux_reussite,
      result.m6_satisfaction,
      result.m7_incidents,
      result.m8_reclamations,
      result.m9_actions_correctives,
      result.m10_maj_documentaire,
      result.m11_formateurs_a_jour,
      result.m12_adaptations_handicap,
      result.m13_sous_traitances_evaluees,
      result.m14_conformite_dossiers,
    ];
    for (const m of metriques) {
      expect(m.libelle.trim().length, `libelle vide sur ${m.libelle}`).toBeGreaterThan(0);
    }
  });

  it("utilise les indicateurs T10 pour m3/m5/m6", async () => {
    const result = await getPilotage(2026);
    // Taux satisfaction = 88 (depuis le mock getIndicateurs)
    expect(result.m6_satisfaction.valeur).toBe(88);
    // Taux réussite = 75
    expect(result.m5_taux_reussite.valeur).toBe(75);
    // Taux complétion = 95
    expect(result.m3_taux_completion.valeur).toBe(95);
  });

  it("écrit le résultat en cache Redis", async () => {
    await getPilotage(2026);
    expect(mockRedis.set).toHaveBeenCalledWith(
      "qualiopi:pilotage:2026",
      expect.any(String),
      "EX",
      3600,
    );
  });

  it("lit depuis le cache Redis si disponible", async () => {
    const cached = {
      annee: 2026,
      m1_prestations: { valeur: "cached", libelle: "Prestations" },
      m2_taux_entree_delai: { valeur: 0, libelle: "T2", unite: "%" },
      m3_taux_completion: { valeur: 0, libelle: "T3", unite: "%" },
      m4_taux_abandon: { valeur: 0, libelle: "T4", unite: "%" },
      m5_taux_reussite: { valeur: 0, libelle: "T5", unite: "%" },
      m6_satisfaction: { valeur: 0, libelle: "T6", unite: "%" },
      m7_incidents: { valeur: 0, libelle: "T7" },
      m8_reclamations: { valeur: 0, libelle: "T8" },
      m9_actions_correctives: { valeur: 0, libelle: "T9" },
      m10_maj_documentaire: { valeur: 0, libelle: "T10" },
      m11_formateurs_a_jour: { valeur: 0, libelle: "T11" },
      m12_adaptations_handicap: { valeur: 0, libelle: "T12" },
      m13_sous_traitances_evaluees: { valeur: 0, libelle: "T13" },
      m14_conformite_dossiers: { valeur: 0, libelle: "T14" },
      calculeAt: new Date().toISOString(),
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(cached));

    const result = await getPilotage(2026);
    // Doit retourner la valeur cachée sans appeler Prisma
    expect(result.m1_prestations.valeur).toBe("cached");
    expect(mockP.trainingSession.count).not.toHaveBeenCalled();
  });

  it("fail-soft si Redis unavailable — continue sans cache", async () => {
    mockRedis.get.mockRejectedValue(new Error("Redis unreachable"));
    mockRedis.set.mockRejectedValue(new Error("Redis unreachable"));

    // Ne doit pas lever
    const result = await getPilotage(2026);
    expect(result.annee).toBe(2026);
  });

  it("retourne PilotageResult vide en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await getPilotage(2026);
      expect(result.annee).toBe(2026);
      expect(result.calculeAt).toBeInstanceOf(Date);
      // Aucun mock Prisma ne doit être appelé
      expect(mockP.trainingSession.count).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});
