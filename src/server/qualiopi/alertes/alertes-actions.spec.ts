/**
 * Tests — Server Actions alertes (T15 AGENT C).
 *
 * Stratégie :
 *   - Mock @/server/qualiopi/alertes/alertes-service
 *   - Mock @/server/actions/qualiopi/_guards
 *   - Vérifie : résultats nominaux, propagation erreurs, logs activité,
 *     guard requireAdminWrite appelé, validation Zod (UUID invalide).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  resoudreAlerte: vi.fn(),
  marquerLu: vi.fn(),
  marquerToutLu: vi.fn(),
  synchroniserAlertes: vi.fn(),
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import {
  resoudreAlerte,
  marquerLu,
  marquerToutLu,
  synchroniserAlertes,
} from "@/server/qualiopi/alertes/alertes-service";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  resoudreAlerteAction,
  marquerLuAction,
  marquerToutLuAction,
  synchroniserAlertesAction,
} from "@/server/actions/qualiopi/alertes";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mockRequireAdminWrite = requireAdminWrite as ReturnType<typeof vi.fn>;
const mockLogActivity = logQualiopiActivity as ReturnType<typeof vi.fn>;
const mockResoudreAlerte = resoudreAlerte as ReturnType<typeof vi.fn>;
const mockMarquerLu = marquerLu as ReturnType<typeof vi.fn>;
const mockMarquerToutLu = marquerToutLu as ReturnType<typeof vi.fn>;
const mockSynchroniserAlertes = synchroniserAlertes as ReturnType<typeof vi.fn>;

const VALID_UUID = "11111111-1111-1111-1111-111111111111";
const ALERTE_STUB = {
  id: VALID_UUID,
  code: "opco_sans_accord",
  niveau: "important" as const,
  titre: "Session dans 7 jours sans accord OPCO",
  message: "Aucun accord reçu.",
  cibleType: null,
  cibleId: null,
  lu: false,
  resolue: false,
  resolueAt: null,
  metadata: {},
  createdAt: new Date("2026-06-06T10:00:00Z"),
  updatedAt: new Date("2026-06-06T10:00:00Z"),
};

// ─────────────────────────────────────────────────────────────────────────────
// resoudreAlerteAction
// ─────────────────────────────────────────────────────────────────────────────

describe("resoudreAlerteAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid", role: "admin" });
    mockLogActivity.mockResolvedValue(undefined);
    mockResoudreAlerte.mockResolvedValue({ ...ALERTE_STUB, resolue: true, resolueAt: new Date() });
  });

  it("retourne { data: { id } } nominal", async () => {
    const result = await resoudreAlerteAction({ id: VALID_UUID });
    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(VALID_UUID);
  });

  it("appelle resoudreAlerte avec l'id correct", async () => {
    await resoudreAlerteAction({ id: VALID_UUID });
    expect(mockResoudreAlerte).toHaveBeenCalledWith(VALID_UUID);
  });

  it("appelle requireAdminWrite", async () => {
    await resoudreAlerteAction({ id: VALID_UUID });
    expect(mockRequireAdminWrite).toHaveBeenCalledOnce();
  });

  it("logge qualiopi.alerte.resoudre", async () => {
    await resoudreAlerteAction({ id: VALID_UUID });
    expect(mockLogActivity).toHaveBeenCalledOnce();
    const logCall = mockLogActivity.mock.calls[0]?.[0] as { action: string };
    expect(logCall.action).toBe("qualiopi.alerte.resoudre");
  });

  it("retourne { error } si UUID invalide", async () => {
    const result = await resoudreAlerteAction({ id: "not-a-uuid" });
    expect("error" in result).toBe(true);
    expect(mockResoudreAlerte).not.toHaveBeenCalled();
  });

  it("retourne { error } si resoudreAlerte retourne null (alerte introuvable)", async () => {
    mockResoudreAlerte.mockResolvedValue(null);
    const result = await resoudreAlerteAction({ id: VALID_UUID });
    expect("error" in result).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// marquerLuAction
// ─────────────────────────────────────────────────────────────────────────────

describe("marquerLuAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid", role: "admin" });
    mockLogActivity.mockResolvedValue(undefined);
    mockMarquerLu.mockResolvedValue({ ...ALERTE_STUB, lu: true });
  });

  it("retourne { data: { id } } nominal", async () => {
    const result = await marquerLuAction({ id: VALID_UUID });
    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(VALID_UUID);
  });

  it("appelle marquerLu avec l'id correct", async () => {
    await marquerLuAction({ id: VALID_UUID });
    expect(mockMarquerLu).toHaveBeenCalledWith(VALID_UUID);
  });

  it("logge qualiopi.alerte.marquer_lu", async () => {
    await marquerLuAction({ id: VALID_UUID });
    const logCall = mockLogActivity.mock.calls[0]?.[0] as { action: string };
    expect(logCall.action).toBe("qualiopi.alerte.marquer_lu");
  });

  it("retourne { error } si UUID invalide", async () => {
    const result = await marquerLuAction({ id: "" });
    expect("error" in result).toBe(true);
  });

  it("retourne { error } si marquerLu retourne null", async () => {
    mockMarquerLu.mockResolvedValue(null);
    const result = await marquerLuAction({ id: VALID_UUID });
    expect("error" in result).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// marquerToutLuAction
// ─────────────────────────────────────────────────────────────────────────────

describe("marquerToutLuAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid", role: "admin" });
    mockLogActivity.mockResolvedValue(undefined);
    mockMarquerToutLu.mockResolvedValue({ count: 5 });
  });

  it("retourne { data: { count } } nominal", async () => {
    const result = await marquerToutLuAction();
    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.count).toBe(5);
  });

  it("logge qualiopi.alerte.marquer_tout_lu", async () => {
    await marquerToutLuAction();
    const logCall = mockLogActivity.mock.calls[0]?.[0] as {
      action: string;
      changes: { count: number };
    };
    expect(logCall.action).toBe("qualiopi.alerte.marquer_tout_lu");
    expect(logCall.changes.count).toBe(5);
  });

  it("appelle requireAdminWrite", async () => {
    await marquerToutLuAction();
    expect(mockRequireAdminWrite).toHaveBeenCalledOnce();
  });

  it("count = 0 si aucune alerte non-lue", async () => {
    mockMarquerToutLu.mockResolvedValue({ count: 0 });
    const result = await marquerToutLuAction();
    if (!("data" in result)) return;
    expect(result.data.count).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// synchroniserAlertesAction
// ─────────────────────────────────────────────────────────────────────────────

describe("synchroniserAlertesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminWrite.mockResolvedValue({ userId: "admin-uuid", role: "admin" });
    mockLogActivity.mockResolvedValue(undefined);
    mockSynchroniserAlertes.mockResolvedValue({ crees: 3, resolues: 1 });
  });

  it("retourne { data: { crees, resolues } } nominal", async () => {
    const result = await synchroniserAlertesAction();
    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.crees).toBe(3);
    expect(result.data.resolues).toBe(1);
  });

  it("logge qualiopi.alertes.synchroniser", async () => {
    await synchroniserAlertesAction();
    const logCall = mockLogActivity.mock.calls[0]?.[0] as {
      action: string;
      changes: { crees: number; resolues: number };
    };
    expect(logCall.action).toBe("qualiopi.alertes.synchroniser");
    expect(logCall.changes.crees).toBe(3);
    expect(logCall.changes.resolues).toBe(1);
  });

  it("appelle requireAdminWrite avant de synchroniser", async () => {
    await synchroniserAlertesAction();
    expect(mockRequireAdminWrite).toHaveBeenCalledOnce();
    expect(mockSynchroniserAlertes).toHaveBeenCalledOnce();
  });

  it("propage les erreurs du service", async () => {
    mockSynchroniserAlertes.mockRejectedValue(new Error("DB error"));
    await expect(synchroniserAlertesAction()).rejects.toThrow("DB error");
  });
});
