/**
 * Tests — Server Actions Veille (T12 AGENT C).
 *
 * Stratégie :
 *   - Mock @/server/qualiopi/registres/veille-service + _guards.
 *   - Vérifie : creerVeilleAction, updateVeilleAction, supprimerVeilleAction.
 *   - Délégation totale au service.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/server/qualiopi/registres/veille-service", () => ({
  creerVeille: vi.fn(),
  updateVeille: vi.fn(),
  supprimerVeille: vi.fn(),
  getVeille: vi.fn(),
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireAdminDelete: vi.fn().mockResolvedValue({ userId: "admin-uuid" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import {
  creerVeille,
  updateVeille,
  supprimerVeille,
  getVeille,
} from "@/server/qualiopi/registres/veille-service";
import {
  requireAdminWrite,
  requireAdminDelete,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import {
  creerVeilleAction,
  updateVeilleAction,
  supprimerVeilleAction,
} from "@/server/actions/qualiopi/veille";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mockRequireAdminWrite = requireAdminWrite as ReturnType<typeof vi.fn>;
const mockRequireAdminDelete = requireAdminDelete as ReturnType<typeof vi.fn>;
const mockLogActivity = logQualiopiActivity as ReturnType<typeof vi.fn>;
const mockCreerVeille = creerVeille as ReturnType<typeof vi.fn>;
const mockUpdateVeille = updateVeille as ReturnType<typeof vi.fn>;
const mockSupprimerVeille = supprimerVeille as ReturnType<typeof vi.fn>;
const mockGetVeille = getVeille as ReturnType<typeof vi.fn>;

const VEILLE_UUID = "550e8400-e29b-41d4-a716-446655440020";

const INPUT_BASE = {
  type: "legale" as const,
  source: "Journal Officiel 2026",
  titre: "Décret formation professionnelle 2026-05",
  contenu: "Modification des conditions d'accès au CPF...",
  dateVeille: new Date("2026-05-15T00:00:00.000Z"),
};

const VEILLE_STUB = { id: VEILLE_UUID, type: "legale", titre: INPUT_BASE.titre };

// ─────────────────────────────────────────────────────────────────────────────
// creerVeilleAction
// ─────────────────────────────────────────────────────────────────────────────

describe("creerVeilleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
    mockLogActivity.mockResolvedValue(undefined);
    mockCreerVeille.mockResolvedValue({ id: VEILLE_UUID });
  });

  it("retourne { data: { id } } pour une veille valide", async () => {
    const result = await creerVeilleAction(INPUT_BASE);

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(VEILLE_UUID);
  });

  it("délègue à creerVeille avec type et titre", async () => {
    await creerVeilleAction({ ...INPUT_BASE, actionDecidee: "Mettre à jour le RI" });

    expect(mockCreerVeille).toHaveBeenCalledOnce();
    const arg = mockCreerVeille.mock.calls[0]?.[0] as {
      type: string;
      titre: string;
      actionDecidee: string;
    };
    expect(arg.type).toBe("legale");
    expect(arg.titre).toBe(INPUT_BASE.titre);
    expect(arg.actionDecidee).toBe("Mettre à jour le RI");
  });

  it("accepte les 4 types de veille", async () => {
    for (const type of ["legale", "metiers", "pedagogique", "handicap"] as const) {
      vi.clearAllMocks();
      mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
      mockCreerVeille.mockResolvedValue({ id: `id-${type}` });

      const result = await creerVeilleAction({ ...INPUT_BASE, type });
      expect("data" in result).toBe(true);
    }
  });

  it("logge qualiopi.veille.create avec targetType Veille", async () => {
    await creerVeilleAction(INPUT_BASE);

    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockLogActivity.mock.calls[0]?.[0] as {
      action: string;
      targetType: string;
    };
    expect(logCall.action).toBe("qualiopi.veille.create");
    expect(logCall.targetType).toBe("Veille");
  });

  it("retourne { error } si type est invalide", async () => {
    const result = await creerVeilleAction({ ...INPUT_BASE, type: "autre" as "legale" });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("ne logge pas si Zod échoue", async () => {
    await creerVeilleAction({ ...INPUT_BASE, type: "invalide" as "legale" });

    expect(mockCreerVeille).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateVeilleAction
// ─────────────────────────────────────────────────────────────────────────────

describe("updateVeilleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
    mockLogActivity.mockResolvedValue(undefined);
    mockGetVeille.mockResolvedValue(VEILLE_STUB);
    mockUpdateVeille.mockResolvedValue(VEILLE_STUB);
  });

  it("retourne { data: { id } } pour une mise à jour valide", async () => {
    const result = await updateVeilleAction({ id: VEILLE_UUID, titre: "Titre mis à jour" });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(VEILLE_UUID);
  });

  it("retourne { error } si id n'est pas un UUID", async () => {
    const result = await updateVeilleAction({ id: "pas-uuid", titre: "Test" });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error: 'Entrée de veille introuvable' } si getVeille retourne null", async () => {
    mockGetVeille.mockResolvedValue(null);

    const result = await updateVeilleAction({ id: VEILLE_UUID, titre: "Test" });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Entrée de veille introuvable");
  });

  it("logge qualiopi.veille.update", async () => {
    await updateVeilleAction({ id: VEILLE_UUID, titre: "Mis à jour" });

    const logCall = mockLogActivity.mock.calls[0]?.[0] as { action: string };
    expect(logCall.action).toBe("qualiopi.veille.update");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// supprimerVeilleAction
// ─────────────────────────────────────────────────────────────────────────────

describe("supprimerVeilleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminDelete.mockResolvedValue({ userId: "admin-uuid" });
    mockLogActivity.mockResolvedValue(undefined);
    mockGetVeille.mockResolvedValue(VEILLE_STUB);
    mockSupprimerVeille.mockResolvedValue(VEILLE_STUB);
  });

  it("retourne { data: { id } } pour une suppression valide", async () => {
    const result = await supprimerVeilleAction({ id: VEILLE_UUID });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(VEILLE_UUID);
  });

  it("utilise requireAdminDelete (pas requireAdminWrite)", async () => {
    await supprimerVeilleAction({ id: VEILLE_UUID });

    expect(mockRequireAdminDelete).toHaveBeenCalledOnce();
    expect(mockRequireAdminWrite).not.toHaveBeenCalled();
  });

  it("retourne { error: 'Entrée de veille introuvable' } si getVeille retourne null", async () => {
    mockGetVeille.mockResolvedValue(null);

    const result = await supprimerVeilleAction({ id: VEILLE_UUID });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Entrée de veille introuvable");
  });

  it("logge qualiopi.veille.delete", async () => {
    await supprimerVeilleAction({ id: VEILLE_UUID });

    const logCall = mockLogActivity.mock.calls[0]?.[0] as { action: string };
    expect(logCall.action).toBe("qualiopi.veille.delete");
  });
});
