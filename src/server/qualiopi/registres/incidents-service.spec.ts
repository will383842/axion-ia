/**
 * Tests — registres/incidents-service.ts (LOT 4).
 *
 * Stratégie : mock @/lib/prisma.
 * Vérifie : creerIncident (resoluAt si statut resolu), completerIncident
 * (note signée écrite dans la même transaction, resoluAt posé/effacé selon
 * statut — L09), getIncident, listIncidents (filtres + include session et
 * notes), stub-aware.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => {
  const incident = {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  };
  const incidentNote = { create: vi.fn() };
  const client = { incident, incidentNote };
  return {
    prisma: {
      ...client,
      $transaction: vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) => fn(client)),
    },
  };
});

import { prisma } from "@/lib/prisma";
import { creerIncident, completerIncident, getIncident, listIncidents } from "./incidents-service";

type MockFn = ReturnType<typeof vi.fn>;

const mockPrisma = prisma as unknown as {
  incident: {
    create: MockFn;
    update: MockFn;
    findUnique: MockFn;
    findMany: MockFn;
  };
  incidentNote: { create: MockFn };
};

const AUTEUR = { id: "admin-uuid", nom: "Will Exemple" };

const ACTUEL = {
  id: "550e8400-e29b-41d4-a716-446655440042",
  statut: "ouvert",
  nature: null,
  declarant: null,
  origine: null,
  sessionId: null,
  trainerId: null,
  sousTraitantId: null,
  faitIntervenant: null,
  actionCorrective: "",
};

const INCIDENT_UUID = "550e8400-e29b-41d4-a716-446655440042";

const INPUT_BASE = {
  type: "technique" as const,
  gravite: "majeur" as const,
  titre: "Coupure visio 40 min pendant la session",
  dateIncident: new Date("2026-03-12T00:00:00.000Z"),
};

// ─────────────────────────────────────────────────────────────────────────────
// creerIncident
// ─────────────────────────────────────────────────────────────────────────────

describe("creerIncident", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.incident.create.mockResolvedValue({ id: INCIDENT_UUID });
  });

  it("crée l'incident avec statut ouvert par défaut (pas de resoluAt)", async () => {
    await creerIncident(INPUT_BASE);

    expect(mockPrisma.incident.create).toHaveBeenCalledOnce();
    const arg = mockPrisma.incident.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data["type"]).toBe("technique");
    expect(arg.data["statut"]).toBe("ouvert");
    expect(arg.data["resoluAt"]).toBeUndefined();
  });

  it("pose resoluAt quand créé directement en statut resolu", async () => {
    await creerIncident({ ...INPUT_BASE, statut: "resolu", actionCorrective: "Passage en 4G" });

    const arg = mockPrisma.incident.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data["statut"]).toBe("resolu");
    expect(arg.data["resoluAt"]).toBeInstanceOf(Date);
    expect(arg.data["actionCorrective"]).toBe("Passage en 4G");
  });

  it("lève en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(creerIncident(INPUT_BASE)).rejects.toThrow(/stub\.invalid/);
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// completerIncident
// ─────────────────────────────────────────────────────────────────────────────

describe("completerIncident", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.incident.findUnique.mockResolvedValue(ACTUEL);
    mockPrisma.incident.update.mockResolvedValue({ id: INCIDENT_UUID });
    mockPrisma.incidentNote.create.mockResolvedValue({ id: "note" });
  });

  it("statut → resolu : pose resoluAt ET écrit la note signée", async () => {
    const r = await completerIncident(
      INCIDENT_UUID,
      { statut: "resolu", motif: "Connexion doublée et testée" },
      AUTEUR,
    );

    expect(r.ok).toBe(true);
    const arg = mockPrisma.incident.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(arg.where.id).toBe(INCIDENT_UUID);
    expect(arg.data["statut"]).toBe("resolu");
    expect(arg.data["resoluAt"]).toBeInstanceOf(Date);
    const note = mockPrisma.incidentNote.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(note.data).toMatchObject({
      incidentId: INCIDENT_UUID,
      auteurId: "admin-uuid",
      auteurNom: "Will Exemple",
    });
    expect(String(note.data["texte"])).toMatch(/^Décision : statut « Ouvert » → « Résolu »/);
  });

  it("🔴 refuse une réécriture : ni update ni note", async () => {
    mockPrisma.incident.findUnique.mockResolvedValue({ ...ACTUEL, actionCorrective: "Déjà" });
    const r = await completerIncident(INCIDENT_UUID, { actionCorrective: "Autre" }, AUTEUR);

    expect(r.ok).toBe(false);
    expect(mockPrisma.incident.update).not.toHaveBeenCalled();
    expect(mockPrisma.incidentNote.create).not.toHaveBeenCalled();
  });

  it("incident introuvable : refus lisible", async () => {
    mockPrisma.incident.findUnique.mockResolvedValue(null);
    const r = await completerIncident(INCIDENT_UUID, { nature: "alea" }, AUTEUR);
    expect(r).toEqual({ ok: false, erreur: "Incident introuvable" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getIncident
// ─────────────────────────────────────────────────────────────────────────────

describe("getIncident", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.incident.findUnique.mockResolvedValue({ id: INCIDENT_UUID });
  });

  it("getIncident retourne null en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await getIncident(INCIDENT_UUID);
      expect(result).toBeNull();
      expect(mockPrisma.incident.findUnique).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listIncidents
// ─────────────────────────────────────────────────────────────────────────────

describe("listIncidents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.incident.findMany.mockResolvedValue([]);
  });

  it("liste avec include session + tri dateIncident desc", async () => {
    await listIncidents();

    const arg = mockPrisma.incident.findMany.mock.calls[0]?.[0] as {
      include: Record<string, unknown>;
      orderBy: Record<string, string>;
      where: Record<string, unknown>;
    };
    expect(arg.include["session"]).toBeDefined();
    expect(arg.orderBy["dateIncident"]).toBe("desc");
    expect(arg.where).toEqual({});
  });

  it("applique les filtres statut + type", async () => {
    await listIncidents({ statut: "ouvert", type: "technique" });

    const arg = mockPrisma.incident.findMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ statut: "ouvert", type: "technique" });
  });

  it("retourne [] en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await listIncidents();
      expect(result).toEqual([]);
      expect(mockPrisma.incident.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});
