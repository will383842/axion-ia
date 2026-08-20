/**
 * Tests — Server Actions Évaluations + Attestations (T9 AGENT B).
 *
 * Stratégie :
 *   - Mock `@/lib/prisma` + `@/server/actions/qualiopi/_guards`
 *     (requireAdminWrite + logQualiopiActivity).
 *   - Mock les services AGENT A : createEvaluation + genererAttestationPourEnrollment.
 *   - Vérifie les flux principaux + cas d'erreur des 2 actions.
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
  prisma: {},
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-test-id" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/evaluations/evaluations-service", () => ({
  createEvaluation: vi.fn(),
}));

vi.mock("@/server/qualiopi/evaluations/attestation-service", () => ({
  genererAttestationPourEnrollment: vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports (après mocks)
// ─────────────────────────────────────────────────────────────────────────────

import {
  requireAdminWrite,
  requireHabilitation,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import { createEvaluation } from "@/server/qualiopi/evaluations/evaluations-service";
import { genererAttestationPourEnrollment } from "@/server/qualiopi/evaluations/attestation-service";
import {
  createEvaluationAcquisAction,
  genererAttestationAction,
} from "@/server/actions/qualiopi/evaluations";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mockRequireAdminWrite = requireAdminWrite as ReturnType<typeof vi.fn>;
const mockRequireHabilitation = requireHabilitation as ReturnType<typeof vi.fn>;
const mockLogActivity = logQualiopiActivity as ReturnType<typeof vi.fn>;
const mockCreateEvaluation = createEvaluation as ReturnType<typeof vi.fn>;
const mockGenererAttestation = genererAttestationPourEnrollment as ReturnType<typeof vi.fn>;

/** Compétences de base pour les tests */
const COMPETENCES_BASE = [
  { libelle: "Comprendre les bases de l'IA", note: 3 as const },
  { libelle: "Utiliser les outils IA", note: 2 as const },
  { libelle: "Appliquer les techniques", note: 3 as const },
];

const ENROLLMENT_UUID = "550e8400-e29b-41d4-a716-446655440001";

// ─────────────────────────────────────────────────────────────────────────────
// createEvaluationAcquisAction
// ─────────────────────────────────────────────────────────────────────────────

describe("createEvaluationAcquisAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockCreateEvaluation.mockResolvedValue({ id: "eval-new-id" });
  });

  it("retourne { data: { id } } pour une évaluation valide", async () => {
    const result = await createEvaluationAcquisAction({
      enrollmentId: ENROLLMENT_UUID,
      type: "finale",
      dateEvaluation: "2026-06-15",
      competences: COMPETENCES_BASE,
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe("eval-new-id");
  });

  it("🔴 `D6-1-C1` — valider une évaluation exige l'acte `valider_evaluation`", async () => {
    // L'acte existait dans la matrice, il était testé… et appelé NULLE PART.
    // `requireAdminWrite` autorise `editor` : un compte de saisie pouvait donc
    // poser une réussite que l'attestation imprimait ensuite telle quelle.
    //
    // 🔑 Un acte déclaré que rien n'appelle est une garde qui n'existe pas — et
    // sa présence dans la matrice faisait croire l'inverse.
    await createEvaluationAcquisAction({
      enrollmentId: ENROLLMENT_UUID,
      type: "finale",
      dateEvaluation: "2026-06-15",
      competences: COMPETENCES_BASE,
    });
    expect(mockRequireHabilitation).toHaveBeenCalledWith("valider_evaluation");
    expect(
      mockRequireAdminWrite,
      "`requireAdminWrite` autoriserait `editor` : il ne doit plus garder cet acte",
    ).not.toHaveBeenCalled();
  });

  it("trace l'auteur de l'évaluation (evalueParId ← session admin)", async () => {
    await createEvaluationAcquisAction({
      enrollmentId: ENROLLMENT_UUID,
      type: "finale",
      dateEvaluation: "2026-06-15",
      competences: COMPETENCES_BASE,
    });

    // `evalueParId` était une colonne MORTE : jamais écrite, jamais lue. Sans
    // cette traçabilité, impossible de démontrer qui a évalué — sans effet avec
    // un formateur unique, déterminant dès qu'ils sont plusieurs.
    const call = mockCall<{ evalueParId?: string }>(mockCreateEvaluation);
    // 🔴 `admin-uuid` et non `admin-test-id` depuis le 2026-08-20 (`D6-1-C1`) :
    // la garde est passée de `requireAdminWrite` à
    // `requireHabilitation("valider_evaluation")`. Ce test a rougi à ce
    // changement, et c'était son travail — l'auteur tracé vient désormais d'une
    // session HABILITÉE, pas d'un simple compte en écriture.
    expect(call.evalueParId).toBe("admin-uuid");
  });

  it("appelle createEvaluation avec les bons paramètres", async () => {
    await createEvaluationAcquisAction({
      enrollmentId: ENROLLMENT_UUID,
      type: "initiale",
      dateEvaluation: "2026-06-10",
      competences: COMPETENCES_BASE,
      recommandations: "Approfondir les notions de base",
    });

    expect(mockCreateEvaluation).toHaveBeenCalledOnce();
    const call = mockCall<{
      enrollmentId: string;
      type: string;
      dateEvaluation: string;
      competences: typeof COMPETENCES_BASE;
      recommandations: string;
    }>(mockCreateEvaluation);
    expect(call.enrollmentId).toBe(ENROLLMENT_UUID);
    expect(call.type).toBe("initiale");
    expect(call.dateEvaluation).toBe("2026-06-10");
    expect(call.competences).toHaveLength(3);
    expect(call.recommandations).toBe("Approfondir les notions de base");
  });

  it("ne passe pas recommandations si absent (exactOptionalPropertyTypes)", async () => {
    await createEvaluationAcquisAction({
      enrollmentId: ENROLLMENT_UUID,
      type: "finale",
      dateEvaluation: "2026-06-15",
      competences: COMPETENCES_BASE,
      // recommandations absent
    });

    const call = mockCall<Record<string, unknown>>(mockCreateEvaluation);
    expect("recommandations" in call).toBe(false);
  });

  it("accepte les 3 types d'évaluation", async () => {
    for (const type of ["initiale", "intermediaire", "finale"] as const) {
      vi.clearAllMocks();
      mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
      mockCreateEvaluation.mockResolvedValue({ id: `eval-${type}` });

      const result = await createEvaluationAcquisAction({
        enrollmentId: ENROLLMENT_UUID,
        type,
        dateEvaluation: "2026-06-15",
        competences: COMPETENCES_BASE,
      });

      expect("data" in result).toBe(true);
    }
  });

  it("appelle logQualiopiActivity avec l'action correcte", async () => {
    await createEvaluationAcquisAction({
      enrollmentId: ENROLLMENT_UUID,
      type: "finale",
      dateEvaluation: "2026-06-15",
      competences: COMPETENCES_BASE,
    });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{ action: string; targetType: string; targetId: string }>(
      mockLogActivity,
    );
    expect(logCall.action).toBe("qualiopi.evaluation.create");
    expect(logCall.targetType).toBe("EvaluationAcquis");
    expect(logCall.targetId).toBe("eval-new-id");
  });

  it("retourne { error } si enrollmentId n'est pas un UUID", async () => {
    const result = await createEvaluationAcquisAction({
      enrollmentId: "pas-un-uuid",
      type: "finale",
      dateEvaluation: "2026-06-15",
      competences: COMPETENCES_BASE,
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error } si type est invalide", async () => {
    const result = await createEvaluationAcquisAction({
      enrollmentId: ENROLLMENT_UUID,
      type: "mauvais-type" as "initiale",
      dateEvaluation: "2026-06-15",
      competences: COMPETENCES_BASE,
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error } si competences est vide", async () => {
    const result = await createEvaluationAcquisAction({
      enrollmentId: ENROLLMENT_UUID,
      type: "finale",
      dateEvaluation: "2026-06-15",
      competences: [],
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error } si createEvaluation lève une erreur métier", async () => {
    mockCreateEvaluation.mockRejectedValue(new Error("Enrollment introuvable"));

    const result = await createEvaluationAcquisAction({
      enrollmentId: ENROLLMENT_UUID,
      type: "finale",
      dateEvaluation: "2026-06-15",
      competences: COMPETENCES_BASE,
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Enrollment introuvable");
  });

  it("ne logge pas si la validation Zod échoue (pas d'appel service)", async () => {
    await createEvaluationAcquisAction({
      enrollmentId: "invalide",
      type: "finale",
      dateEvaluation: "2026-06-15",
      competences: COMPETENCES_BASE,
    });

    expect(mockCreateEvaluation).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// genererAttestationAction
// ─────────────────────────────────────────────────────────────────────────────

describe("genererAttestationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockGenererAttestation.mockResolvedValue({
      resultat: "complete",
      documentId: "doc-attestation-id",
    });
  });

  it("retourne { data: { resultat, documentId } } pour une attestation complète", async () => {
    const result = await genererAttestationAction({
      enrollmentId: ENROLLMENT_UUID,
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.resultat).toBe("complete");
    expect(result.data.documentId).toBe("doc-attestation-id");
  });

  it("retourne { data } avec documentId=null pour résultat aucune", async () => {
    mockGenererAttestation.mockResolvedValue({ resultat: "aucune", documentId: null });

    const result = await genererAttestationAction({
      enrollmentId: ENROLLMENT_UUID,
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.resultat).toBe("aucune");
    expect(result.data.documentId).toBeNull();
  });

  it("retourne { data } pour résultat partielle", async () => {
    mockGenererAttestation.mockResolvedValue({
      resultat: "partielle",
      documentId: "doc-partielle-id",
    });

    const result = await genererAttestationAction({ enrollmentId: ENROLLMENT_UUID });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.resultat).toBe("partielle");
    expect(result.data.documentId).toBe("doc-partielle-id");
  });

  it("transmet force=true à genererAttestationPourEnrollment", async () => {
    await genererAttestationAction({
      enrollmentId: ENROLLMENT_UUID,
      force: true,
    });

    expect(mockGenererAttestation).toHaveBeenCalledOnce();
    // force passé comme opts (2e argument)
    const optsArg = mockGenererAttestation.mock.calls[0]?.[1] as { force?: boolean } | undefined;
    expect(optsArg?.force).toBe(true);
  });

  it("ne passe pas force si absent (exactOptionalPropertyTypes)", async () => {
    await genererAttestationAction({ enrollmentId: ENROLLMENT_UUID });

    const optsArg = mockGenererAttestation.mock.calls[0]?.[1] as { force?: boolean } | undefined;
    expect(optsArg?.force).toBeUndefined();
  });

  it("appelle logQualiopiActivity avec l'action correcte", async () => {
    await genererAttestationAction({ enrollmentId: ENROLLMENT_UUID });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockCall<{
      action: string;
      targetType: string;
      targetId: string;
      changes: Record<string, unknown>;
    }>(mockLogActivity);
    expect(logCall.action).toBe("qualiopi.attestation.generer");
    expect(logCall.targetType).toBe("Enrollment");
    expect(logCall.targetId).toBe(ENROLLMENT_UUID);
    expect(logCall.changes).toMatchObject({
      resultat: "complete",
      documentId: "doc-attestation-id",
    });
  });

  it("retourne { error } si enrollmentId n'est pas un UUID", async () => {
    const result = await genererAttestationAction({
      enrollmentId: "pas-un-uuid",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error } si genererAttestationPourEnrollment lève", async () => {
    mockGenererAttestation.mockRejectedValue(new Error("Enrollment introuvable : xyz"));

    const result = await genererAttestationAction({ enrollmentId: ENROLLMENT_UUID });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Enrollment introuvable : xyz");
  });

  it("ne logge pas si la validation Zod échoue", async () => {
    await genererAttestationAction({ enrollmentId: "invalide" });

    expect(mockGenererAttestation).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});
