/**
 * Tests — Server Actions Incidents (LOT 4).
 *
 * Stratégie :
 *   - Mock @/server/qualiopi/registres/incidents-service + _guards.
 *   - Vérifie : creerIncidentAction, updateIncidentAction (compléter / décider,
 *     jamais réécrire — L09), ajouterNoteIncidentAction.
 *   - Délégation totale au service + validation Zod + audit log.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ADR 0060 — le verrou du dossier de session a sa propre suite
// (`src/server/qualiopi/sessions/__tests__/`) ; ici, le dossier est ouvert.
vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", () => ({
  assertDossierOuvert: async () => ({ ok: true, sessionId: null }),
  assertDossierOuvertSiRegeneration: async () => ({ ok: true, sessionId: null }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/server/qualiopi/registres/incidents-service", () => ({
  creerIncident: vi.fn(),
  completerIncident: vi.fn(),
  ajouterNoteIncident: vi.fn(),
  getIncident: vi.fn(),
}));

vi.mock("@/server/qualiopi/registres/auteur", () => ({
  auteurAdministrateur: vi.fn().mockResolvedValue({ id: "admin-uuid", nom: "Will Exemple" }),
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
  creerIncident,
  completerIncident,
  ajouterNoteIncident,
  getIncident,
} from "@/server/qualiopi/registres/incidents-service";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  creerIncidentAction,
  updateIncidentAction,
  ajouterNoteIncidentAction,
} from "@/server/actions/qualiopi/incidents";

type MockFn = ReturnType<typeof vi.fn>;

const mockCreer = creerIncident as unknown as MockFn;
const mockCompleter = completerIncident as unknown as MockFn;
const mockNote = ajouterNoteIncident as unknown as MockFn;
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

describe("updateIncidentAction — compléter ou décider, jamais réécrire (L09)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompleter.mockResolvedValue({
      ok: true,
      incident: { id: INCIDENT_UUID },
      note: "Décision",
    });
  });

  it("délègue la décision au service, signée du nom réel de la personne connectée", async () => {
    const result = await updateIncidentAction({
      id: INCIDENT_UUID,
      statut: "resolu",
      motif: "Supports re-générés et contrôlés",
      actionCorrective: "Supports re-générés + contrôle version",
    });

    expect("data" in result).toBe(true);
    expect(mockCompleter).toHaveBeenCalledOnce();
    const [id, demande, auteur] = mockCompleter.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { nom: string },
    ];
    expect(id).toBe(INCIDENT_UUID);
    expect(demande["statut"]).toBe("resolu");
    expect(demande["actionCorrective"]).toBe("Supports re-générés + contrôle version");
    expect(auteur.nom).toBe("Will Exemple");
  });

  it.each(["titre", "description", "type", "gravite", "dateIncident"])(
    "🔴 refuse de réécrire le champ figé « %s »",
    async (champ) => {
      const result = await updateIncidentAction({
        id: INCIDENT_UUID,
        [champ]: "valeur",
      } as never);
      expect(result).toEqual({ error: expect.stringMatching(/ne se réécrit pas/) });
      expect(mockCompleter).not.toHaveBeenCalled();
    },
  );

  it("relaie le refus du service (incident introuvable, valeur déjà posée…)", async () => {
    mockCompleter.mockResolvedValue({ ok: false, erreur: "Incident introuvable" });
    const result = await updateIncidentAction({ id: INCIDENT_UUID, nature: "alea" });

    expect(result).toEqual({ error: "Incident introuvable" });
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("rejette un id non-uuid (Zod)", async () => {
    const result = await updateIncidentAction({ id: "pas-un-uuid", statut: "resolu" });

    expect(result).toEqual({ error: "Données invalides" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ajouterNoteIncidentAction
// ─────────────────────────────────────────────────────────────────────────────

describe("ajouterNoteIncidentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ id: INCIDENT_UUID, titre: INPUT_BASE.titre });
    mockNote.mockResolvedValue({ id: "note" });
  });

  it("ajoute la note avec l'auteur réel et trace l'audit", async () => {
    const result = await ajouterNoteIncidentAction({
      id: INCIDENT_UUID,
      texte: "Gravité réévaluée : majeur",
    });

    expect("data" in result).toBe(true);
    expect(mockNote).toHaveBeenCalledWith(INCIDENT_UUID, "Gravité réévaluée : majeur", {
      id: "admin-uuid",
      nom: "Will Exemple",
    });
    const arg = mockLog.mock.calls[0]?.[0] as { action: string };
    expect(arg.action).toBe("qualiopi.incident.note");
  });

  it("retourne { error } si l'incident est introuvable", async () => {
    mockGet.mockResolvedValue(null);
    const result = await ajouterNoteIncidentAction({ id: INCIDENT_UUID, texte: "Une note" });

    expect(result).toEqual({ error: "Incident introuvable" });
    expect(mockNote).not.toHaveBeenCalled();
  });
});
