/**
 * Tests — Server Actions Incidents (LOT 4).
 *
 * Stratégie :
 *   - Mock @/server/qualiopi/registres/incidents-service + _guards.
 *   - Vérifie : creerIncidentAction, updateIncidentAction, supprimerIncidentAction.
 *   - Délégation totale au service + validation Zod + audit log.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/server/qualiopi/registres/incidents-service", () => ({
  creerIncident: vi.fn(),
  updateIncident: vi.fn(),
  supprimerIncident: vi.fn(),
  getIncident: vi.fn(),
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid" }),
  requireAdminDelete: vi.fn().mockResolvedValue({ userId: "admin-uuid" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import {
  creerIncident,
  updateIncident,
  supprimerIncident,
  getIncident,
} from "@/server/qualiopi/registres/incidents-service";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  creerIncidentAction,
  updateIncidentAction,
  supprimerIncidentAction,
} from "@/server/actions/qualiopi/incidents";

type MockFn = ReturnType<typeof vi.fn>;

const mockCreer = creerIncident as unknown as MockFn;
const mockUpdate = updateIncident as unknown as MockFn;
const mockSupprimer = supprimerIncident as unknown as MockFn;
const mockGet = getIncident as unknown as MockFn;
const mockLog = logQualiopiActivity as unknown as MockFn;

const INCIDENT_UUID = "550e8400-e29b-41d4-a716-446655440042";

const INPUT_BASE = {
  type: "pedagogique" as const,
  gravite: "mineur" as const,
  titre: "Support obsolète distribué au groupe",
  dateIncident: new Date("2026-02-10T00:00:00.000Z"),
};

// ─────────────────────────────────────────────────────────────────────────────
// creerIncidentAction
// ─────────────────────────────────────────────────────────────────────────────

describe("creerIncidentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreer.mockResolvedValue({ id: INCIDENT_UUID });
  });

  it("retourne { data: { id } } pour un incident valide", async () => {
    const result = await creerIncidentAction(INPUT_BASE);

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.id).toBe(INCIDENT_UUID);
    expect(mockCreer).toHaveBeenCalledOnce();
  });

  it("trace l'action dans l'audit log", async () => {
    await creerIncidentAction(INPUT_BASE);

    expect(mockLog).toHaveBeenCalledOnce();
    const arg = mockLog.mock.calls[0]?.[0] as { action: string; targetType: string };
    expect(arg.action).toBe("qualiopi.incident.create");
    expect(arg.targetType).toBe("Incident");
  });

  it("rejette un type inconnu (Zod)", async () => {
    const result = await creerIncidentAction({
      ...INPUT_BASE,
      type: "cosmique" as never,
    });

    expect(result).toEqual({ error: "Données invalides" });
    expect(mockCreer).not.toHaveBeenCalled();
  });

  it("rejette un titre vide (Zod)", async () => {
    const result = await creerIncidentAction({ ...INPUT_BASE, titre: "" });

    expect(result).toEqual({ error: "Données invalides" });
    expect(mockCreer).not.toHaveBeenCalled();
  });

  it("retourne { error } si le service lève", async () => {
    mockCreer.mockRejectedValue(new Error("DB down"));
    const result = await creerIncidentAction(INPUT_BASE);

    expect("error" in result).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateIncidentAction
// ─────────────────────────────────────────────────────────────────────────────

describe("updateIncidentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ id: INCIDENT_UUID, titre: INPUT_BASE.titre });
    mockUpdate.mockResolvedValue({ id: INCIDENT_UUID });
  });

  it("met à jour le statut + l'action corrective", async () => {
    const result = await updateIncidentAction({
      id: INCIDENT_UUID,
      statut: "resolu",
      actionCorrective: "Supports re-générés + contrôle version",
    });

    expect("data" in result).toBe(true);
    expect(mockUpdate).toHaveBeenCalledOnce();
    const [id, fields] = mockUpdate.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe(INCIDENT_UUID);
    expect(fields["statut"]).toBe("resolu");
    expect(fields["actionCorrective"]).toBe("Supports re-générés + contrôle version");
  });

  it("retourne { error } si l'incident est introuvable", async () => {
    mockGet.mockResolvedValue(null);
    const result = await updateIncidentAction({ id: INCIDENT_UUID, statut: "resolu" });

    expect(result).toEqual({ error: "Incident introuvable" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejette un id non-uuid (Zod)", async () => {
    const result = await updateIncidentAction({ id: "pas-un-uuid", statut: "resolu" });

    expect(result).toEqual({ error: "Données invalides" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// supprimerIncidentAction
// ─────────────────────────────────────────────────────────────────────────────

describe("supprimerIncidentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ id: INCIDENT_UUID, titre: INPUT_BASE.titre });
    mockSupprimer.mockResolvedValue({ id: INCIDENT_UUID });
  });

  it("supprime et trace l'audit", async () => {
    const result = await supprimerIncidentAction({ id: INCIDENT_UUID });

    expect("data" in result).toBe(true);
    expect(mockSupprimer).toHaveBeenCalledWith(INCIDENT_UUID);
    const arg = mockLog.mock.calls[0]?.[0] as { action: string };
    expect(arg.action).toBe("qualiopi.incident.delete");
  });

  it("retourne { error } si l'incident est introuvable", async () => {
    mockGet.mockResolvedValue(null);
    const result = await supprimerIncidentAction({ id: INCIDENT_UUID });

    expect(result).toEqual({ error: "Incident introuvable" });
    expect(mockSupprimer).not.toHaveBeenCalled();
  });
});
