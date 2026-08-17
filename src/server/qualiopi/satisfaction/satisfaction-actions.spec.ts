/**
 * Tests — Server Actions Satisfaction + Indicateurs + BPF (AGENT B — T10).
 *
 * Stratégie :
 *   - Mock `@/lib/prisma` + `@/server/actions/qualiopi/_guards`
 *   - Mock les services AGENT A (satisfaction-service, indicateurs/service, bpf/service)
 *   - Vérifie les flux principaux + cas d'erreur des 4 actions
 *
 * Pas d'import de `next/headers` en test (mocké via _guards).
 */

import { describe, it, expect, vi, beforeEach, assert } from "vitest";

/** Accès sûr à un appel de mock (lève si absent). */
function mockCall<T>(fn: ReturnType<typeof vi.fn>, callIndex = 0): T {
  const call = fn.mock.calls[callIndex];
  assert(call !== undefined, `mockCall: aucun appel à l'index ${callIndex}`);
  return call[0] as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mocks déclarés AVANT tout import des modules testés
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: {
      findMany: vi.fn(),
    },
    questionnaire: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-test-id" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/satisfaction/satisfaction-service", () => ({
  creerQuestionnaire: vi.fn(),
  soumettreReponses: vi.fn(),
}));

vi.mock("@/server/qualiopi/indicateurs/service", () => ({
  getIndicateurs: vi.fn(),
  invalidateIndicateursCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/bpf/service", () => ({
  computeBpf: vi.fn(),
  bpfToCsv: vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports (après mocks)
// ─────────────────────────────────────────────────────────────────────────────

import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  creerQuestionnaire,
  soumettreReponses,
} from "@/server/qualiopi/satisfaction/satisfaction-service";
import { getIndicateurs, invalidateIndicateursCache } from "@/server/qualiopi/indicateurs/service";
import { computeBpf, bpfToCsv } from "@/server/qualiopi/bpf/service";
import { prisma } from "@/lib/prisma";
import {
  genererQuestionnairesSessionAction,
  saisirReponsesQuestionnaireAction,
  recomputeIndicateursAction,
  exportBpfCsvAction,
} from "@/server/actions/qualiopi/satisfaction";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mockRequireAdminWrite = requireAdminWrite as ReturnType<typeof vi.fn>;
const mockLogActivity = logQualiopiActivity as ReturnType<typeof vi.fn>;
const mockCreerQuestionnaire = creerQuestionnaire as ReturnType<typeof vi.fn>;
const mockSoumettreReponses = soumettreReponses as ReturnType<typeof vi.fn>;
const mockGetIndicateurs = getIndicateurs as ReturnType<typeof vi.fn>;
const mockInvalidateCache = invalidateIndicateursCache as ReturnType<typeof vi.fn>;
const mockComputeBpf = computeBpf as ReturnType<typeof vi.fn>;
const mockBpfToCsv = bpfToCsv as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  enrollment: { findMany: ReturnType<typeof vi.fn> };
  questionnaire: { findUnique: ReturnType<typeof vi.fn> };
};

const SESSION_UUID = "550e8400-e29b-41d4-a716-446655440010";
const ENROLLMENT_UUID_1 = "550e8400-e29b-41d4-a716-446655440001";
const ENROLLMENT_UUID_2 = "550e8400-e29b-41d4-a716-446655440002";
const TOKEN = "a".repeat(64);
const FORMATION_UUID = "550e8400-e29b-41d4-a716-446655440020";

const INDICATEURS_FIXTURE = {
  annee: 2026,
  tauxSatisfaction: { tauxPct: 80, nb: 10, fiable: true, libelle: "80 %" },
  tauxReussite: { tauxPct: 90, nb: 20, fiable: true, libelle: "90 %" },
  tauxCompletion: { tauxPct: 95, nb: 20, fiable: true, libelle: "95 %" },
  delaiAccesMoyen: { jours: 14, nb: 20, fiable: true },
  methodes: {
    satisfaction: "méthode satisfaction",
    reussite: "méthode réussite",
    completion: "méthode complétion",
    delaiAcces: "méthode délai",
  },
  calculeAt: new Date("2026-06-06T10:00:00.000Z"),
};

const BPF_FIXTURE = {
  annee: 2026,
  organisme: { raisonSociale: "Axion-IA SAS", nda: "12345678901", siret: "99999999900011" },
  nbSessions: 5,
  nbStagiairesDistincts: 30,
  nbHeuresStagiaires: 300,
  caTotalHtCents: 1500000,
  caParFinanceur: { opco: 500000, cpf: 300000, france_travail: 200000, direct: 500000, mixte: 0 },
  nbFormateursInternes: 2,
  nbFormateursExternes: 1,
  calculeAt: new Date("2026-06-06T10:00:00.000Z"),
};

// ─────────────────────────────────────────────────────────────────────────────
// genererQuestionnairesSessionAction
// ─────────────────────────────────────────────────────────────────────────────

describe("genererQuestionnairesSessionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockPrisma.enrollment.findMany.mockResolvedValue([
      { id: ENROLLMENT_UUID_1 },
      { id: ENROLLMENT_UUID_2 },
    ]);
    mockCreerQuestionnaire.mockResolvedValue({ id: "quest-id", token: TOKEN });
  });

  it("retourne { data: { crees, total } } pour une session avec 2 enrollments (3 types)", async () => {
    const result = await genererQuestionnairesSessionAction({ sessionId: SESSION_UUID });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.total).toBe(6); // 2 enrollments × 3 types
    expect(result.data.crees).toBe(6);
  });

  it("appelle creerQuestionnaire pour chaque enrollment × type", async () => {
    await genererQuestionnairesSessionAction({ sessionId: SESSION_UUID });

    expect(mockCreerQuestionnaire).toHaveBeenCalledTimes(6);
  });

  it("respecte les types personnalisés", async () => {
    await genererQuestionnairesSessionAction({
      sessionId: SESSION_UUID,
      types: ["satisfaction_chaud"],
    });

    expect(mockCreerQuestionnaire).toHaveBeenCalledTimes(2); // 2 enrollments × 1 type
    const call = mockCall<{ type: string }>(mockCreerQuestionnaire);
    expect(call.type).toBe("satisfaction_chaud");
  });

  it("est idempotent (creerQuestionnaire déjà-créé ne compte pas comme erreur)", async () => {
    // Même si creerQuestionnaire retourne un existant, crees++ quand même
    mockCreerQuestionnaire.mockResolvedValue({ id: "existing-id", token: TOKEN });

    const result = await genererQuestionnairesSessionAction({ sessionId: SESSION_UUID });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.crees).toBe(6);
  });

  it("fail-soft par questionnaire : continue si creerQuestionnaire lève sur un", async () => {
    mockCreerQuestionnaire
      .mockRejectedValueOnce(new Error("erreur question 1"))
      .mockResolvedValue({ id: "quest-ok", token: TOKEN });

    const result = await genererQuestionnairesSessionAction({ sessionId: SESSION_UUID });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.crees).toBe(5); // 1 erreur fail-soft
  });

  it("retourne { error } si sessionId n'est pas un UUID", async () => {
    const result = await genererQuestionnairesSessionAction({ sessionId: "pas-un-uuid" });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("appelle logQualiopiActivity avec l'action correcte", async () => {
    await genererQuestionnairesSessionAction({ sessionId: SESSION_UUID });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{ action: string; targetType: string; targetId: string }>(
      mockLogActivity,
    );
    expect(logCall.action).toBe("qualiopi.satisfaction.generer_questionnaires");
    expect(logCall.targetType).toBe("TrainingSession");
    expect(logCall.targetId).toBe(SESSION_UUID);
  });

  it("ne logge pas si la validation Zod échoue", async () => {
    await genererQuestionnairesSessionAction({ sessionId: "invalide" });

    expect(mockCreerQuestionnaire).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// saisirReponsesQuestionnaireAction
// ─────────────────────────────────────────────────────────────────────────────

describe("saisirReponsesQuestionnaireAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockSoumettreReponses.mockResolvedValue({ id: "quest-repondu-id" });
    mockInvalidateCache.mockResolvedValue(undefined);
    mockPrisma.questionnaire.findUnique.mockResolvedValue({
      enrollment: { session: { dateDebut: new Date("2026-06-15T00:00:00.000Z") } },
    });
  });

  it("retourne { data: { id } } pour des réponses valides", async () => {
    const result = await saisirReponsesQuestionnaireAction({
      token: TOKEN,
      reponses: { q1: "oui", q2: "non" },
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe("quest-repondu-id");
  });

  it("invalide le cache indicateurs de l'année de la session", async () => {
    await saisirReponsesQuestionnaireAction({
      token: TOKEN,
      reponses: { q1: "oui" },
    });

    expect(mockInvalidateCache).toHaveBeenCalledOnce();
    const callArg = mockInvalidateCache.mock.calls[0]?.[0];
    expect(callArg).toBe(2026);
  });

  it("transmet noteGlobale à soumettreReponses", async () => {
    await saisirReponsesQuestionnaireAction({
      token: TOKEN,
      reponses: { q1: "satisfait" },
      noteGlobale: 4,
    });

    expect(mockSoumettreReponses).toHaveBeenCalledOnce();
    const call = mockCall<{
      token: string;
      reponses: Record<string, unknown>;
      noteGlobale: number;
    }>(mockSoumettreReponses);
    expect(call.noteGlobale).toBe(4);
  });

  it("ne passe pas noteGlobale si absent (exactOptionalPropertyTypes)", async () => {
    await saisirReponsesQuestionnaireAction({
      token: TOKEN,
      reponses: { q1: "neutre" },
    });

    const call = mockCall<Record<string, unknown>>(mockSoumettreReponses);
    expect("noteGlobale" in call).toBe(false);
  });

  it("retourne { error: 'Questionnaire introuvable' } si soumettreReponses retourne null", async () => {
    mockSoumettreReponses.mockResolvedValue(null);

    const result = await saisirReponsesQuestionnaireAction({
      token: TOKEN,
      reponses: { q1: "oui" },
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Questionnaire introuvable");
  });

  it("retourne { error } si noteGlobale est hors plage", async () => {
    const result = await saisirReponsesQuestionnaireAction({
      token: TOKEN,
      reponses: {},
      noteGlobale: 6,
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error } si token est vide", async () => {
    const result = await saisirReponsesQuestionnaireAction({
      token: "",
      reponses: {},
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("appelle logQualiopiActivity avec l'action correcte", async () => {
    await saisirReponsesQuestionnaireAction({
      token: TOKEN,
      reponses: { q1: "oui" },
      noteGlobale: 5,
    });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{ action: string; targetType: string; targetId: string }>(
      mockLogActivity,
    );
    expect(logCall.action).toBe("qualiopi.satisfaction.saisir_reponses");
    expect(logCall.targetType).toBe("Questionnaire");
    expect(logCall.targetId).toBe("quest-repondu-id");
  });

  it("ne logge pas si la validation Zod échoue", async () => {
    await saisirReponsesQuestionnaireAction({ token: "", reponses: {} });

    expect(mockSoumettreReponses).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// recomputeIndicateursAction
// ─────────────────────────────────────────────────────────────────────────────

describe("recomputeIndicateursAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockInvalidateCache.mockResolvedValue(undefined);
    mockGetIndicateurs.mockResolvedValue(INDICATEURS_FIXTURE);
  });

  it("retourne { data: indicateurs } après recalcul", async () => {
    const result = await recomputeIndicateursAction({ annee: 2026 });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.annee).toBe(2026);
    expect(result.data.tauxSatisfaction.tauxPct).toBe(80);
  });

  it("invalide le cache avant de calculer", async () => {
    await recomputeIndicateursAction({ annee: 2026 });

    // invalidateIndicateursCache appelé avant getIndicateurs
    const invalidateOrder = mockInvalidateCache.mock.invocationCallOrder[0];
    const getOrder = mockGetIndicateurs.mock.invocationCallOrder[0];
    expect(invalidateOrder).toBeDefined();
    expect(getOrder).toBeDefined();
    if (invalidateOrder !== undefined && getOrder !== undefined) {
      expect(invalidateOrder).toBeLessThan(getOrder);
    }
  });

  it("passe formationId si fourni", async () => {
    await recomputeIndicateursAction({ annee: 2026, formationId: FORMATION_UUID });

    expect(mockGetIndicateurs).toHaveBeenCalledOnce();
    const callArgs = mockGetIndicateurs.mock.calls[0];
    expect(callArgs?.[0]).toBe(2026);
    expect(callArgs?.[1]).toBe(FORMATION_UUID);
  });

  it("ne passe pas formationId si absent (exactOptionalPropertyTypes)", async () => {
    await recomputeIndicateursAction({ annee: 2026 });

    const callArgs = mockGetIndicateurs.mock.calls[0];
    expect(callArgs?.[1]).toBeUndefined();
  });

  it("retourne { error } si annee < 2020", async () => {
    const result = await recomputeIndicateursAction({ annee: 2019 });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("appelle logQualiopiActivity avec l'action correcte", async () => {
    await recomputeIndicateursAction({ annee: 2026 });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{ action: string; targetType: string; targetId: string }>(
      mockLogActivity,
    );
    expect(logCall.action).toBe("qualiopi.indicateurs.recompute");
    expect(logCall.targetType).toBe("Indicateurs");
    expect(logCall.targetId).toBe("2026");
  });

  it("retourne { error } si getIndicateurs lève", async () => {
    mockGetIndicateurs.mockRejectedValue(new Error("Erreur DB"));

    const result = await recomputeIndicateursAction({ annee: 2026 });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Erreur DB");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// exportBpfCsvAction
// ─────────────────────────────────────────────────────────────────────────────

describe("exportBpfCsvAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockComputeBpf.mockResolvedValue(BPF_FIXTURE);
    mockBpfToCsv.mockReturnValue("csv;contenu\n2026;données");
  });

  it("retourne { data: { csv, filename } } pour une année valide", async () => {
    const result = await exportBpfCsvAction({ annee: 2026 });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.csv).toBe("csv;contenu\n2026;données");
    expect(result.data.filename).toBe("bpf-2026-axion-ia.csv");
  });

  it("appelle computeBpf avec l'année", async () => {
    await exportBpfCsvAction({ annee: 2026 });

    expect(mockComputeBpf).toHaveBeenCalledOnce();
    expect(mockComputeBpf.mock.calls[0]?.[0]).toBe(2026);
  });

  it("passe le résultat de computeBpf à bpfToCsv", async () => {
    await exportBpfCsvAction({ annee: 2026 });

    expect(mockBpfToCsv).toHaveBeenCalledOnce();
    expect(mockBpfToCsv.mock.calls[0]?.[0]).toBe(BPF_FIXTURE);
  });

  it("retourne { error } si annee invalide", async () => {
    const result = await exportBpfCsvAction({ annee: 2019 });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error } si computeBpf lève", async () => {
    mockComputeBpf.mockRejectedValue(new Error("DB inaccessible"));

    const result = await exportBpfCsvAction({ annee: 2026 });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("DB inaccessible");
  });

  it("appelle logQualiopiActivity avec l'action correcte", async () => {
    await exportBpfCsvAction({ annee: 2026 });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{
      action: string;
      targetType: string;
      targetId: string;
      changes: Record<string, unknown>;
    }>(mockLogActivity);
    expect(logCall.action).toBe("qualiopi.bpf.export_csv");
    expect(logCall.targetType).toBe("BPF");
    expect(logCall.targetId).toBe("2026");
    expect(logCall.changes).toMatchObject({ annee: 2026, nbSessions: 5 });
  });

  it("ne logge pas si la validation Zod échoue", async () => {
    await exportBpfCsvAction({ annee: 1990 });

    expect(mockComputeBpf).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});
