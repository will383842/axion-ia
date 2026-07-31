/**
 * Tests — Server Actions Supports de formation (T13 AGENT B).
 *
 * Stratégie :
 *   - Mock `@/lib/prisma` + `@/server/actions/qualiopi/_guards`.
 *   - Mock le service AGENT B : genererSupport, regenererSupport, supprimerSupport.
 *   - Vérifie validation Zod, délégation service, logQualiopiActivity, cas d'erreur.
 */

import { describe, it, expect, vi, beforeEach, assert } from "vitest";

/** Accès sûr à un appel de mock (lève si absent). */
function mockCall<T>(fn: ReturnType<typeof vi.fn>, callIndex = 0): T {
  const call = fn.mock.calls[callIndex];
  assert(call !== undefined, `mockCall: aucun appel à l'index ${callIndex}`);
  return call[0] as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — AVANT tout import des modules testés
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-test-id" }),
  // OBLIGATOIRE : les 6 tests de `describe("supprimerSupportAction")` echouent
  // sans cette entree. Meme `userId` que `requireAdminWrite` — les assertions
  // portent sur le contenu de `logQualiopiActivity`, qui recoit desormais la
  // session rendue par `requireAdminDelete`.
  requireAdminDelete: vi.fn().mockResolvedValue({ userId: "admin-test-id" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

// Mock du service (import dynamique dans les actions)
vi.mock("@/server/qualiopi/supports/supports-service", () => ({
  genererSupport: vi.fn(),
  regenererSupport: vi.fn(),
  supprimerSupport: vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports (après mocks)
// ─────────────────────────────────────────────────────────────────────────────

import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import * as supportsService from "@/server/qualiopi/supports/supports-service";
import {
  genererSupportAction,
  regenererSupportAction,
  supprimerSupportAction,
} from "@/server/actions/qualiopi/supports";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mockRequireAdminWrite = requireAdminWrite as ReturnType<typeof vi.fn>;
const mockLogActivity = logQualiopiActivity as ReturnType<typeof vi.fn>;
const mockGenererSupport = supportsService.genererSupport as ReturnType<typeof vi.fn>;
const mockRegenererSupport = supportsService.regenererSupport as ReturnType<typeof vi.fn>;
const mockSupprimerSupport = supportsService.supprimerSupport as ReturnType<typeof vi.fn>;

const FORMATION_UUID = "550e8400-e29b-41d4-a716-446655440001";
const SUPPORT_UUID = "660e8400-e29b-41d4-a716-446655440002";

// ─────────────────────────────────────────────────────────────────────────────
// genererSupportAction
// ─────────────────────────────────────────────────────────────────────────────

describe("genererSupportAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockGenererSupport.mockResolvedValue({
      id: SUPPORT_UUID,
      pdfUrl: "https://r2.example.com/supports/2026/memo/abc.pdf",
    });
  });

  it("retourne { data: { id, pdfUrl } } pour une entrée valide", async () => {
    const result = await genererSupportAction({
      formationId: FORMATION_UUID,
      type: "memo",
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(SUPPORT_UUID);
    expect(result.data.pdfUrl).toBeTruthy();
  });

  it("délègue à genererSupport avec les bons paramètres", async () => {
    await genererSupportAction({
      formationId: FORMATION_UUID,
      type: "grille_eval",
      enrichirIA: false,
    });

    expect(mockGenererSupport).toHaveBeenCalledOnce();
    const call = mockCall<{ formationId: string; type: string }>(mockGenererSupport);
    expect(call.formationId).toBe(FORMATION_UUID);
    expect(call.type).toBe("grille_eval");
  });

  it("accepte enrichirIA=true", async () => {
    await genererSupportAction({
      formationId: FORMATION_UUID,
      type: "slides_formateur",
      enrichirIA: true,
    });

    expect(mockGenererSupport).toHaveBeenCalledOnce();
    const call = mockCall<{ enrichirIA?: boolean }>(mockGenererSupport);
    expect(call.enrichirIA).toBe(true);
  });

  it("ne passe pas enrichirIA si absent (exactOptionalPropertyTypes)", async () => {
    await genererSupportAction({
      formationId: FORMATION_UUID,
      type: "exercices",
    });

    const call = mockCall<Record<string, unknown>>(mockGenererSupport);
    // enrichirIA peut être undefined ou absent
    expect(call["enrichirIA"] === undefined || !("enrichirIA" in call)).toBe(true);
  });

  it("accepte les 7 types de supports", async () => {
    const types = [
      "slides_formateur",
      "slides_stagiaire",
      "livret_stagiaire",
      "memo",
      "guide_animation",
      "exercices",
      "grille_eval",
    ] as const;

    for (const type of types) {
      vi.clearAllMocks();
      mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
      mockGenererSupport.mockResolvedValue({ id: SUPPORT_UUID, pdfUrl: null });

      const result = await genererSupportAction({ formationId: FORMATION_UUID, type });
      expect("data" in result).toBe(true);
    }
  });

  it("appelle logQualiopiActivity avec l'action correcte", async () => {
    await genererSupportAction({ formationId: FORMATION_UUID, type: "livret_stagiaire" });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const log = mockCall<{ action: string; targetType: string; targetId: string }>(mockLogActivity);
    expect(log.action).toBe("qualiopi.support.generer");
    expect(log.targetType).toBe("SupportFormation");
    expect(log.targetId).toBe(SUPPORT_UUID);
  });

  it("retourne { error } si formationId n'est pas un UUID", async () => {
    const result = await genererSupportAction({
      formationId: "pas-un-uuid",
      type: "memo",
    });

    expect("error" in result).toBe(true);
    expect(mockGenererSupport).not.toHaveBeenCalled();
  });

  it("retourne { error } si type est invalide", async () => {
    const result = await genererSupportAction({
      formationId: FORMATION_UUID,
      type: "type-invalide" as "memo",
    });

    expect("error" in result).toBe(true);
    expect(mockGenererSupport).not.toHaveBeenCalled();
  });

  it("retourne { error } si le service lève une erreur métier", async () => {
    mockGenererSupport.mockRejectedValue(new Error("Formation introuvable : xyz"));

    const result = await genererSupportAction({
      formationId: FORMATION_UUID,
      type: "memo",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Formation introuvable : xyz");
  });

  it("ne logge pas si la validation Zod échoue", async () => {
    await genererSupportAction({ formationId: "invalide", type: "memo" });

    expect(mockGenererSupport).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// regenererSupportAction
// ─────────────────────────────────────────────────────────────────────────────

describe("regenererSupportAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockRegenererSupport.mockResolvedValue({
      id: SUPPORT_UUID,
      pdfUrl: "https://r2.example.com/supports/2026/memo/def.pdf",
    });
  });

  it("retourne { data: { id, pdfUrl } } pour un id valide", async () => {
    const result = await regenererSupportAction({ id: SUPPORT_UUID });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(SUPPORT_UUID);
  });

  it("délègue à regenererSupport avec l'id", async () => {
    await regenererSupportAction({ id: SUPPORT_UUID });

    expect(mockRegenererSupport).toHaveBeenCalledOnce();
    const call = mockCall<{ id: string }>(mockRegenererSupport);
    expect(call.id).toBe(SUPPORT_UUID);
  });

  it("appelle logQualiopiActivity avec l'action correcte", async () => {
    await regenererSupportAction({ id: SUPPORT_UUID });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const log = mockCall<{ action: string; targetType: string; targetId: string }>(mockLogActivity);
    expect(log.action).toBe("qualiopi.support.regenerer");
    expect(log.targetType).toBe("SupportFormation");
    expect(log.targetId).toBe(SUPPORT_UUID);
  });

  it("retourne { error } si id n'est pas un UUID", async () => {
    const result = await regenererSupportAction({ id: "pas-un-uuid" });

    expect("error" in result).toBe(true);
    expect(mockRegenererSupport).not.toHaveBeenCalled();
  });

  it("retourne { error } si regenererSupport lève", async () => {
    mockRegenererSupport.mockRejectedValue(new Error("Support introuvable : xyz"));

    const result = await regenererSupportAction({ id: SUPPORT_UUID });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Support introuvable : xyz");
  });

  it("ne logge pas si la validation Zod échoue", async () => {
    await regenererSupportAction({ id: "invalide" });

    expect(mockRegenererSupport).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// supprimerSupportAction
// ─────────────────────────────────────────────────────────────────────────────

describe("supprimerSupportAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-test-id" });
    mockLogActivity.mockResolvedValue(undefined);
    mockSupprimerSupport.mockResolvedValue(undefined);
  });

  it("retourne { data: { id } } pour un id valide", async () => {
    const result = await supprimerSupportAction({ id: SUPPORT_UUID });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(SUPPORT_UUID);
  });

  it("délègue à supprimerSupport avec l'id correct", async () => {
    await supprimerSupportAction({ id: SUPPORT_UUID });

    expect(mockSupprimerSupport).toHaveBeenCalledOnce();
    // supprimerSupport(id: string) — reçoit id directement
    const firstArg = mockSupprimerSupport.mock.calls[0]![0] as string;
    expect(firstArg).toBe(SUPPORT_UUID);
  });

  it("appelle logQualiopiActivity avec l'action correcte", async () => {
    await supprimerSupportAction({ id: SUPPORT_UUID });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const log = mockCall<{ action: string; targetType: string; targetId: string }>(mockLogActivity);
    expect(log.action).toBe("qualiopi.support.supprimer");
    expect(log.targetType).toBe("SupportFormation");
    expect(log.targetId).toBe(SUPPORT_UUID);
  });

  it("retourne { error } si id n'est pas un UUID", async () => {
    const result = await supprimerSupportAction({ id: "pas-un-uuid" });

    expect("error" in result).toBe(true);
    expect(mockSupprimerSupport).not.toHaveBeenCalled();
  });

  it("retourne { error } si supprimerSupport lève", async () => {
    mockSupprimerSupport.mockRejectedValue(new Error("Support introuvable"));

    const result = await supprimerSupportAction({ id: SUPPORT_UUID });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Support introuvable");
  });

  it("ne logge pas si la validation Zod échoue", async () => {
    await supprimerSupportAction({ id: "invalide" });

    expect(mockSupprimerSupport).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});
