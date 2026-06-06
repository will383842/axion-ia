/**
 * Tests — Server Actions Partenariats (T12 AGENT C).
 *
 * Stratégie :
 *   - Mock @/server/qualiopi/registres/partenariats-service + _guards.
 *   - Vérifie : creerPartenariatAction, updatePartenariatAction.
 *   - Délégation totale au service.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/server/qualiopi/registres/partenariats-service", () => ({
  creerPartenariat: vi.fn(),
  updatePartenariat: vi.fn(),
  getPartenariat: vi.fn(),
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import {
  creerPartenariat,
  updatePartenariat,
  getPartenariat,
} from "@/server/qualiopi/registres/partenariats-service";
import { logQualiopiActivity, requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import {
  creerPartenariatAction,
  updatePartenariatAction,
} from "@/server/actions/qualiopi/partenariats";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mockRequireAdminWrite = requireAdminWrite as ReturnType<typeof vi.fn>;
const mockLogActivity = logQualiopiActivity as ReturnType<typeof vi.fn>;
const mockCreerPartenariat = creerPartenariat as ReturnType<typeof vi.fn>;
const mockUpdatePartenariat = updatePartenariat as ReturnType<typeof vi.fn>;
const mockGetPartenariat = getPartenariat as ReturnType<typeof vi.fn>;

const PARTENARIAT_UUID = "550e8400-e29b-41d4-a716-446655440030";

const INPUT_BASE = {
  nom: "Association Inclusion Numérique",
  type: "réseau_handicap",
  objet: "Accompagnement des stagiaires en situation de handicap",
  dateDebut: new Date("2026-01-01T00:00:00.000Z"),
};

const PARTENARIAT_STUB = { id: PARTENARIAT_UUID, nom: INPUT_BASE.nom };

// ─────────────────────────────────────────────────────────────────────────────
// creerPartenariatAction
// ─────────────────────────────────────────────────────────────────────────────

describe("creerPartenariatAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
    mockLogActivity.mockResolvedValue(undefined);
    mockCreerPartenariat.mockResolvedValue({ id: PARTENARIAT_UUID });
  });

  it("retourne { data: { id } } pour un partenariat valide", async () => {
    const result = await creerPartenariatAction(INPUT_BASE);

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(PARTENARIAT_UUID);
  });

  it("délègue à creerPartenariat avec nom, type et actif", async () => {
    await creerPartenariatAction(INPUT_BASE);

    expect(mockCreerPartenariat).toHaveBeenCalledOnce();
    const arg = mockCreerPartenariat.mock.calls[0]?.[0] as {
      nom: string;
      type: string;
      actif: boolean;
    };
    expect(arg.nom).toBe(INPUT_BASE.nom);
    expect(arg.type).toBe("réseau_handicap");
    expect(arg.actif).toBe(true);
  });

  it("logge qualiopi.partenariat.create", async () => {
    await creerPartenariatAction(INPUT_BASE);

    const logCall = mockLogActivity.mock.calls[0]?.[0] as { action: string; targetType: string };
    expect(logCall.action).toBe("qualiopi.partenariat.create");
    expect(logCall.targetType).toBe("Partenariat");
  });

  it("retourne { error } si nom dépasse 250 caractères", async () => {
    const result = await creerPartenariatAction({ ...INPUT_BASE, nom: "A".repeat(251) });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error } générique si le service lève", async () => {
    mockCreerPartenariat.mockRejectedValue(new Error("DB error"));

    const result = await creerPartenariatAction(INPUT_BASE);

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toContain("partenariat");
  });

  it("ne logge pas si Zod échoue", async () => {
    await creerPartenariatAction({ ...INPUT_BASE, nom: "" });

    expect(mockCreerPartenariat).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updatePartenariatAction
// ─────────────────────────────────────────────────────────────────────────────

describe("updatePartenariatAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid" });
    mockLogActivity.mockResolvedValue(undefined);
    mockGetPartenariat.mockResolvedValue(PARTENARIAT_STUB);
    mockUpdatePartenariat.mockResolvedValue(PARTENARIAT_STUB);
  });

  it("retourne { data: { id } } pour une mise à jour valide", async () => {
    const result = await updatePartenariatAction({ id: PARTENARIAT_UUID, actif: false });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(PARTENARIAT_UUID);
  });

  it("retourne { error } si id n'est pas un UUID", async () => {
    const result = await updatePartenariatAction({ id: "pas-uuid", actif: false });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Données invalides");
  });

  it("retourne { error: 'Partenariat introuvable' } si getPartenariat retourne null", async () => {
    mockGetPartenariat.mockResolvedValue(null);

    const result = await updatePartenariatAction({ id: PARTENARIAT_UUID, actif: false });

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("Partenariat introuvable");
  });

  it("logge qualiopi.partenariat.update", async () => {
    await updatePartenariatAction({ id: PARTENARIAT_UUID, nom: "Nouveau nom" });

    const logCall = mockLogActivity.mock.calls[0]?.[0] as { action: string };
    expect(logCall.action).toBe("qualiopi.partenariat.update");
  });
});
