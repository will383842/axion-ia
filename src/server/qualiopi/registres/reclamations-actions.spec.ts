/**
 * Tests — Server Actions Réclamations (T12 AGENT C).
 *
 * Stratégie :
 *   - Mock @/lib/prisma + @/server/actions/qualiopi/_guards.
 *   - Vérifie les 3 actions : creerReclamationAction, repondreReclamationAction,
 *     setStatutReclamationAction.
 *   - Pattern : Prisma direct dans l'action (+ numérotation via formats.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks (avant imports)
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reclamation: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      // Chemin d'allocation depuis V20 (borne haute sur la série AXI-REC).
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports (après mocks)
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  creerReclamationAction,
  repondreReclamationAction,
  setStatutReclamationAction,
} from "@/server/actions/qualiopi/reclamations";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mockRequireAdminWrite = requireAdminWrite as ReturnType<typeof vi.fn>;
const mockLogActivity = logQualiopiActivity as ReturnType<typeof vi.fn>;
const mockReclamation = (
  prisma as unknown as {
    reclamation: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  }
).reclamation;

const RECLAMATION_UUID = "550e8400-e29b-41d4-a716-446655440010";
const DATE_RECEPTION = new Date("2026-06-01T10:00:00.000Z");

const INPUT_BASE = {
  source: "stagiaire" as const,
  reclamantNom: "Dupont Jean",
  objet: "Retard de livraison du kit",
  description: "Le kit pédagogique n'a pas été livré avant la session.",
  dateReception: DATE_RECEPTION,
};

// ─────────────────────────────────────────────────────────────────────────────
// creerReclamationAction
// ─────────────────────────────────────────────────────────────────────────────

describe("creerReclamationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
    mockLogActivity.mockResolvedValue(undefined);
    mockReclamation.count.mockResolvedValue(0);
    mockReclamation.findMany.mockResolvedValue([]);
    mockReclamation.create.mockResolvedValue({
      id: RECLAMATION_UUID,
      numero: "AXI-REC-2026-001",
    });
  });

  it("retourne { data: { id, numero } } pour une réclamation valide", async () => {
    const result = await creerReclamationAction(INPUT_BASE);

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(RECLAMATION_UUID);
    expect(result.data.numero).toBe("AXI-REC-2026-001");
  });

  it("crée la réclamation avec statut initial 'nouvelle'", async () => {
    await creerReclamationAction(INPUT_BASE);

    expect(mockReclamation.create).toHaveBeenCalledOnce();
    const call = mockReclamation.create.mock.calls[0]?.[0] as { data: { statut: string } };
    expect(call.data.statut).toBe("nouvelle");
  });

  it("logge qualiopi.reclamation.create avec targetType Reclamation", async () => {
    await creerReclamationAction(INPUT_BASE);

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockLogActivity.mock.calls[0]?.[0] as { action: string; targetType: string };
    expect(logCall.action).toBe("qualiopi.reclamation.create");
    expect(logCall.targetType).toBe("Reclamation");
  });

  it("retourne { error } si source est invalide", async () => {
    const result = await creerReclamationAction({
      ...INPUT_BASE,
      source: "inconnue" as "stagiaire",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("ne logge pas si Zod échoue", async () => {
    await creerReclamationAction({ ...INPUT_BASE, source: "invalide" as "stagiaire" });

    expect(mockReclamation.create).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it("retourne { error } générique si create lève une erreur non-P2002", async () => {
    mockReclamation.create.mockRejectedValue(new Error("DB error"));

    const result = await creerReclamationAction(INPUT_BASE);

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toContain("réclamation");
  });

  it("accepte les 4 sources valides", async () => {
    for (const source of ["stagiaire", "client", "financeur", "autre"] as const) {
      vi.clearAllMocks();
      mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
      mockReclamation.count.mockResolvedValue(0);
      mockReclamation.findMany.mockResolvedValue([]);
      mockReclamation.create.mockResolvedValue({
        id: `id-${source}`,
        numero: "AXI-REC-2026-001",
      });

      const result = await creerReclamationAction({ ...INPUT_BASE, source });
      expect("data" in result).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// repondreReclamationAction
// ─────────────────────────────────────────────────────────────────────────────

describe("repondreReclamationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
    mockLogActivity.mockResolvedValue(undefined);
    mockReclamation.findUnique.mockResolvedValue({ id: RECLAMATION_UUID, statut: "nouvelle" });
    mockReclamation.update.mockResolvedValue({ id: RECLAMATION_UUID });
  });

  it("retourne { data: { id } } pour une réponse valide", async () => {
    const result = await repondreReclamationAction({
      id: RECLAMATION_UUID,
      reponse: "Nous vous prions d'accepter nos excuses.",
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(RECLAMATION_UUID);
  });

  it("passe le statut à 'en_cours' si la réclamation est 'nouvelle'", async () => {
    mockReclamation.findUnique.mockResolvedValue({ id: RECLAMATION_UUID, statut: "nouvelle" });

    await repondreReclamationAction({
      id: RECLAMATION_UUID,
      reponse: "Réponse de test.",
    });

    const call = mockReclamation.update.mock.calls[0]?.[0] as {
      data: { statut?: string };
    };
    expect(call.data.statut).toBe("en_cours");
  });

  it("ne change pas le statut si déjà 'en_cours'", async () => {
    mockReclamation.findUnique.mockResolvedValue({ id: RECLAMATION_UUID, statut: "en_cours" });

    await repondreReclamationAction({
      id: RECLAMATION_UUID,
      reponse: "Réponse complémentaire.",
    });

    const call = mockReclamation.update.mock.calls[0]?.[0] as {
      data: { statut?: string };
    };
    expect(call.data.statut).toBeUndefined();
  });

  it("retourne { error: 'Réclamation introuvable' } si findUnique retourne null", async () => {
    mockReclamation.findUnique.mockResolvedValue(null);

    const result = await repondreReclamationAction({
      id: RECLAMATION_UUID,
      reponse: "Test.",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Réclamation introuvable");
  });

  it("retourne { error } si id n'est pas un UUID", async () => {
    const result = await repondreReclamationAction({
      id: "pas-un-uuid",
      reponse: "Test.",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("logge qualiopi.reclamation.repondre", async () => {
    await repondreReclamationAction({
      id: RECLAMATION_UUID,
      reponse: "Réponse de test.",
    });

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockLogActivity.mock.calls[0]?.[0] as { action: string };
    expect(logCall.action).toBe("qualiopi.reclamation.repondre");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// setStatutReclamationAction
// ─────────────────────────────────────────────────────────────────────────────

describe("setStatutReclamationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
    mockLogActivity.mockResolvedValue(undefined);
    mockReclamation.findUnique.mockResolvedValue({ id: RECLAMATION_UUID, statut: "nouvelle" });
    mockReclamation.update.mockResolvedValue({ id: RECLAMATION_UUID });
  });

  it("retourne { data: { id } } pour un statut valide", async () => {
    const result = await setStatutReclamationAction({
      id: RECLAMATION_UUID,
      statut: "resolue",
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(RECLAMATION_UUID);
  });

  it("accepte les 4 statuts valides", async () => {
    for (const statut of ["nouvelle", "en_cours", "resolue", "cloturee"] as const) {
      vi.clearAllMocks();
      mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
      mockReclamation.findUnique.mockResolvedValue({
        id: RECLAMATION_UUID,
        statut: "nouvelle",
      });
      mockReclamation.update.mockResolvedValue({ id: RECLAMATION_UUID });

      const result = await setStatutReclamationAction({ id: RECLAMATION_UUID, statut });
      expect("data" in result).toBe(true);
    }
  });

  it("retourne { error } si statut est invalide", async () => {
    const result = await setStatutReclamationAction({
      id: RECLAMATION_UUID,
      statut: "inconnu" as "resolue",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error: 'Réclamation introuvable' } si findUnique retourne null", async () => {
    mockReclamation.findUnique.mockResolvedValue(null);

    const result = await setStatutReclamationAction({
      id: RECLAMATION_UUID,
      statut: "cloturee",
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Réclamation introuvable");
  });

  it("logge avec l'action qualiopi.reclamation.statut.<statut>", async () => {
    await setStatutReclamationAction({ id: RECLAMATION_UUID, statut: "cloturee" });

    const logCall = mockLogActivity.mock.calls[0]?.[0] as { action: string };
    expect(logCall.action).toBe("qualiopi.reclamation.statut.cloturee");
  });

  it("ne logge pas si Zod échoue", async () => {
    await setStatutReclamationAction({
      id: RECLAMATION_UUID,
      statut: "invalide" as "cloturee",
    });

    expect(mockReclamation.update).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});
