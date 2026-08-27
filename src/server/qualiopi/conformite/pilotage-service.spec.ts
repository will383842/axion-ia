/**
 * Tests — pilotage-service.ts (T12 — AGENT B + filtres LOT 4).
 *
 * Stratégie : mock @/lib/prisma, @/lib/redis, @/server/qualiopi/indicateurs/service,
 *   @/server/qualiopi/config/site-settings.
 * Vérifie : structure PilotageResult (14 métriques), cache Redis (clé
 * année × période × type), stub.invalid, filtres période/typeAction (plages
 * Europe/Paris + `typesActionQualiopi has`), M7 incidents réels + proxy en
 * détail, M9 incidents + réclamations sommés, M11 critère 24 mois,
 * sérialisation exports (pilotageToLignes / pilotageToCsv).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { count: vi.fn() },
    // ⚠️ `groupBy` fait partie du contrat depuis que M4 rend ses MOTIFS.
    // Un mock incomplet est un contrat rompu — patron paye plusieurs fois
    // ici : sans lui, huit tests rougissent sur la FORME du mock et non
    // sur ce qu'ils verifient.
    enrollment: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    reclamation: { count: vi.fn() },
    sousTraitant: { count: vi.fn() },
    documentGenere: { count: vi.fn() },
    trainer: { count: vi.fn() },
    incident: { count: vi.fn() },
    questionnaire: { findMany: vi.fn() },
    evaluationAcquis: { findMany: vi.fn() },
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

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(80),
}));

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getIndicateurs } from "@/server/qualiopi/indicateurs/service";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import {
  getPilotage,
  derivePlage,
  periodeKey,
  periodeLabel,
  pilotageToLignes,
  pilotageToCsv,
  type PilotageResult,
} from "./pilotage-service";

type MockFn = ReturnType<typeof vi.fn>;

const mockP = prisma as unknown as {
  trainingSession: { count: MockFn };
  enrollment: { count: MockFn; findMany: MockFn; groupBy: MockFn };
  reclamation: { count: MockFn };
  sousTraitant: { count: MockFn };
  documentGenere: { count: MockFn };
  trainer: { count: MockFn };
  incident: { count: MockFn };
  questionnaire: { findMany: MockFn };
  evaluationAcquis: { findMany: MockFn };
};
const mockRedis = redis as unknown as { get: MockFn; set: MockFn };
const mockGetIndicateurs = getIndicateurs as unknown as MockFn;
const mockGetConfig = getQualiopiConfig as unknown as MockFn;

function setupCounts() {
  mockP.trainingSession.count.mockResolvedValue(5);
  mockP.enrollment.count.mockResolvedValue(25);
  mockP.reclamation.count.mockResolvedValue(2);
  mockP.sousTraitant.count.mockResolvedValue(1);
  mockP.documentGenere.count.mockResolvedValue(10);
  mockP.trainer.count.mockResolvedValue(3);
  mockP.incident.count.mockResolvedValue(0);
  mockP.enrollment.findMany.mockResolvedValue([]);
  // 🔑 La forme REELLE du contrat, pas le minimum qui passe : `groupBy` rend
  // des lignes `{ sortieMotif, _count: { _all } }`. Un `[]` nu ferait passer
  // les tests en n'exercant JAMAIS la mise en forme des motifs.
  mockP.enrollment.groupBy.mockResolvedValue([
    { sortieMotif: "Emploi retrouve en cours de parcours", _count: { _all: 3 } },
    { sortieMotif: "Raisons de sante", _count: { _all: 1 } },
  ]);
  mockP.questionnaire.findMany.mockResolvedValue([]);
  mockP.evaluationAcquis.findMany.mockResolvedValue([]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests — structure + cache + stub (rétro-compatible getPilotage(2026))
// ─────────────────────────────────────────────────────────────────────────────

describe("getPilotage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
    mockGetConfig.mockResolvedValue(80);
    setupCounts();
  });

  it("retourne un PilotageResult avec les 14 métriques", async () => {
    const result = await getPilotage(2026);

    expect(result.annee).toBe(2026);
    expect(result.periode).toEqual({ type: "annee" });
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

  it("utilise les indicateurs T10 pour m3/m5/m6 en vue année sans filtre", async () => {
    const result = await getPilotage(2026);
    expect(mockGetIndicateurs).toHaveBeenCalledWith(2026);
    expect(result.m6_satisfaction.valeur).toBe(88);
    expect(result.m5_taux_reussite.valeur).toBe(75);
    expect(result.m3_taux_completion.valeur).toBe(95);
    // Pas de calcul direct filtré dans ce mode
    expect(mockP.questionnaire.findMany).not.toHaveBeenCalled();
  });

  it("écrit le résultat en cache Redis (clé année × période × type)", async () => {
    await getPilotage(2026);
    expect(mockRedis.set).toHaveBeenCalledWith(
      "qualiopi:pilotage:2026:annee:all",
      expect.any(String),
      "EX",
      3600,
    );
  });

  it("lit depuis le cache Redis si disponible", async () => {
    const cached = {
      annee: 2026,
      periode: { type: "annee" },
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
    expect(result.m1_prestations.valeur).toBe("cached");
    expect(mockP.trainingSession.count).not.toHaveBeenCalled();
  });

  it("fail-soft si Redis unavailable — continue sans cache", async () => {
    mockRedis.get.mockRejectedValue(new Error("Redis unreachable"));
    mockRedis.set.mockRejectedValue(new Error("Redis unreachable"));

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
      expect(mockP.trainingSession.count).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });

  // ── Filtres LOT 4 ──────────────────────────────────────────────────────────

  it("filtre trimestre : cache key t2 + calcul direct des taux (pas getIndicateurs)", async () => {
    const result = await getPilotage({
      annee: 2026,
      periode: { type: "trimestre", trimestre: 2 },
    });

    expect(result.periode).toEqual({ type: "trimestre", trimestre: 2 });
    expect(mockRedis.set).toHaveBeenCalledWith(
      "qualiopi:pilotage:2026:t2:all",
      expect.any(String),
      "EX",
      3600,
    );
    expect(mockGetIndicateurs).not.toHaveBeenCalled();
    // Taux calculés en direct (formules calcul.ts) sur le périmètre filtré
    expect(mockP.questionnaire.findMany).toHaveBeenCalledOnce();
    expect(mockP.evaluationAcquis.findMany).toHaveBeenCalledOnce();
  });

  it("filtre typeAction : where `typesActionQualiopi has` sur les sessions", async () => {
    const result = await getPilotage({ annee: 2026, typeAction: "cpf" });

    expect(result.typeAction).toBe("cpf");
    // Toutes les requêtes trainingSession.count portent le filtre formation
    const calls = mockP.trainingSession.count.mock.calls as Array<
      [{ where: { formation?: { typesActionQualiopi?: { has: string } } } }]
    >;
    expect(calls.length).toBeGreaterThan(0);
    for (const [arg] of calls) {
      expect(arg.where.formation).toEqual({ typesActionQualiopi: { has: "cpf" } });
    }
  });

  it("M7 = incidents réels du registre + proxy sessions annulées en détail", async () => {
    // 1er appel incident.count (M7) → 4 ; 2e (M9 actionCorrective) → 3
    mockP.incident.count.mockResolvedValueOnce(4).mockResolvedValueOnce(3);
    const result = await getPilotage(2026);

    expect(result.m7_incidents.valeur).toBe(4);
    expect(result.m7_incidents.libelle).toContain("registre");
    expect(result.m7_incidents.detail).toContain("annulées/reportées");
  });

  it("M9 = incidents avec action corrective + réclamations avec actions correctives (sommés)", async () => {
    mockP.incident.count.mockResolvedValueOnce(4).mockResolvedValueOnce(3);
    // reclamation.count mocké à 2 partout → 2 réclamations avec actions correctives
    const result = await getPilotage(2026);

    expect(result.m9_actions_correctives.valeur).toBe(3 + 2);
    expect(result.m9_actions_correctives.detail).toContain("3 incidents");
    expect(result.m9_actions_correctives.detail).toContain("2 réclamations");
  });

  it("M11 : requête trainer avec critère cvUrl + preuve datée (OR internes/sous-traitant)", async () => {
    await getPilotage(2026);

    const calls = mockP.trainer.count.mock.calls as Array<[{ where: Record<string, unknown> }]>;
    // 2e appel = formateurs à jour
    const whereAJour = calls[1]?.[0]?.where as {
      cvUrl?: unknown;
      OR?: Array<Record<string, unknown>>;
    };
    expect(whereAJour.cvUrl).toEqual({ not: null });
    expect(whereAJour.OR).toHaveLength(2);
    expect(whereAJour.OR?.[0]).toMatchObject({ statut: { in: ["salarie", "dirigeant"] } });
    expect(whereAJour.OR?.[1]).toMatchObject({ statut: "sous_traitant" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests — helpers période (Europe/Paris)
// ─────────────────────────────────────────────────────────────────────────────

describe("derivePlage / periodeKey / periodeLabel", () => {
  it("année entière : bornes 1er janvier → 1er janvier N+1 (minuit Paris, hiver = UTC+1)", () => {
    const plage = derivePlage(2026, { type: "annee" });
    expect(plage.gte.toISOString()).toBe("2025-12-31T23:00:00.000Z");
    expect(plage.lt.toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });

  it("trimestre 3 : 1er juillet → 1er octobre (minuit Paris, été = UTC+2)", () => {
    const plage = derivePlage(2026, { type: "trimestre", trimestre: 3 });
    expect(plage.gte.toISOString()).toBe("2026-06-30T22:00:00.000Z");
    expect(plage.lt.toISOString()).toBe("2026-09-30T22:00:00.000Z");
  });

  it("mois de février : 1er février → 1er mars", () => {
    const plage = derivePlage(2026, { type: "mois", mois: 2 });
    expect(plage.gte.toISOString()).toBe("2026-01-31T23:00:00.000Z");
    expect(plage.lt.toISOString()).toBe("2026-02-28T23:00:00.000Z");
  });

  it("periodeKey : annee / t2 / m07", () => {
    expect(periodeKey({ type: "annee" })).toBe("annee");
    expect(periodeKey({ type: "trimestre", trimestre: 2 })).toBe("t2");
    expect(periodeKey({ type: "mois", mois: 7 })).toBe("m07");
  });

  it("periodeLabel : FR lisible", () => {
    expect(periodeLabel(2026, { type: "annee" })).toBe("année 2026");
    expect(periodeLabel(2026, { type: "trimestre", trimestre: 4 })).toBe("T4 2026");
    expect(periodeLabel(2026, { type: "mois", mois: 3 })).toContain("mars");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests — sérialisation exports (pilotageToLignes / pilotageToCsv)
// ─────────────────────────────────────────────────────────────────────────────

function buildFixtureResult(): PilotageResult {
  const m = (libelle: string, valeur: number | string, detail?: string) => ({
    valeur,
    libelle,
    ...(detail !== undefined ? { detail } : {}),
  });
  return {
    annee: 2026,
    periode: { type: "trimestre", trimestre: 1 },
    typeAction: "cpf",
    m1_prestations: m("Prestations", "3 terminée(s) / 5 au total"),
    m2_taux_entree_delai: { valeur: 90, libelle: "Taux d'entrée", unite: "%" },
    m3_taux_completion: { valeur: 95, libelle: "Complétion", unite: "%" },
    m4_taux_abandon: { valeur: 5, libelle: "Abandon", unite: "%" },
    m4_motifs_abandon: [
      { motif: "Emploi retrouvé", nombre: 2 },
      { motif: "Raisons de santé", nombre: 1 },
    ],
    m5_taux_reussite: { valeur: 80, libelle: "Réussite", unite: "%" },
    m6_satisfaction: { valeur: 88, libelle: "Satisfaction", unite: "%" },
    m7_incidents: m("Incidents déclarés (registre)", 2, "Complément : 1 session(s) annulée(s)"),
    m8_reclamations: m("Réclamations", "1 reçue(s)"),
    m9_actions_correctives: m(
      "Actions correctives engagées",
      3,
      "2 incident(s) · 1 réclamation(s)",
    ),
    m10_maj_documentaire: m("Documents générés", 12),
    m11_formateurs_a_jour: m("Formateurs à jour", "2 / 3 (67 %)"),
    m12_adaptations_handicap: m("Adaptations handicap", 1),
    m13_sous_traitances_evaluees: m("Sous-traitances", "1 / 1 (100 %)"),
    m14_conformite_dossiers: m("Conformité dossiers", "3 / 3 (100 %)"),
    calculeAt: new Date("2026-04-02T10:00:00.000Z"),
  };
}

describe("pilotageToLignes / pilotageToCsv", () => {
  it("pilotageToLignes : 14 lignes [Métrique, Valeur, Détail] dans l'ordre M1→M14", () => {
    const lignes = pilotageToLignes(buildFixtureResult());
    expect(lignes).toHaveLength(14);
    expect(lignes[0]?.[0]).toBe("M1 — Prestations");
    expect(lignes[0]?.[1]).toBe("3 terminée(s) / 5 au total");
    expect(lignes[1]?.[1]).toBe("90 %"); // unité concaténée
    expect(lignes[6]?.[2]).toContain("Complément"); // détail M7
    expect(lignes[13]?.[0]).toBe("M14 — Conformité dossiers");
  });

  it("pilotageToCsv : en-tête + 14 lignes + pied de période, guillemets échappés", () => {
    const csv = pilotageToCsv(buildFixtureResult());
    const lignes = csv.trim().split("\n");
    expect(lignes[0]).toBe('"Code";"Métrique";"Valeur";"Unité";"Détail"');
    expect(lignes.filter((l) => l.startsWith('"M'))).toHaveLength(14);
    expect(csv).toContain('"T1 2026"');
    expect(csv).toContain('"cpf"');
  });
});
